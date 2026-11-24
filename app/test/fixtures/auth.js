import crypto from "node:crypto";
import { createApp } from "../../server/app.js";
import { createDb } from "../../server/db/index.js";
import { migrate } from "../../server/db/migrate.js";
import { openPglite } from "../../server/db/pglite.js";
import { MIGRATIONS, migrationList } from "./db.js";

// Account helpers of app/test (no test here; the code design M2AUTH, 9): a migrated PGlite under the login
// role, the app with an injected clock, pepper, setup hash and a counting hasher, requests through
// app.request with a chosen client address, the actors of the permission matrix, and the readers of the
// state (row counts, sha256 of every row, a dump of every column) that the refusal tests compare before and
// after. The oracles here are the test's own: the TOTP codes are computed by an RFC 6238 implementation of
// this file, the hasher is a stand-in of the same stored form, and the state is read by plain SQL.

/** The app origin of the local cookie `sai_s` (4.9.3). */
export const ORIGIN = "http://127.0.0.1:1";
/** An https app origin (the cookie `__Host-sai_s`). */
export const HTTPS_ORIGIN = "https://sai.example";
export const PREVIEW = "http://localhost:1";

/** Every table of 0001, 0002 and 0003, in name order (guard row G21 of the code design M2PROJ). */
export const TABLES = Object.freeze([
  "audit_log",
  "auth_sessions",
  "deletion_requests",
  "idea_versions",
  "invites",
  "login_delays",
  "login_failures",
  "org_members",
  "orgs",
  "password_resets",
  "platform_settings",
  "projects",
  "rate_limits",
  "reauth_tokens",
  "schema_migrations",
  "user_consents",
  "users",
]);

/** The planted identity of the platform admin made by setup. */
export const ADMIN = Object.freeze({
  email: "Owner.Admin@Example.test",
  norm: "owner.admin@example.test",
  name: "Owner Admin",
  password: "owner-admin-pass-7Q",
});

/** The ten-plus character password of the ordinary users the tests make. */
export const USER_PASSWORD = "member-pass-4Kd9";

/**
 * A hasher of the stored form `scrypt$17$8$1$<salt 22>$<key 86>` (so the column check of users holds) that
 * runs sha512 instead of scrypt, counts every computation, and can wait before answering (a slow scrypt).
 * @param {{ delayMs?: number }} [o]
 */
export function fastHasher(o = {}) {
  let computations = 0;
  const key = (/** @type {Buffer} */ salt, /** @type {string} */ pw) =>
    crypto
      .createHash("sha512")
      .update(salt)
      .update(pw.normalize("NFC"), "utf8")
      .digest("base64url");
  const wait = () =>
    o.delayMs ? new Promise((r) => setTimeout(r, o.delayMs)) : null;
  return {
    count: () => computations,
    /** @param {string} pw */
    async hash(pw) {
      computations += 1;
      await wait();
      const salt = crypto.randomBytes(16);
      return `scrypt$17$8$1$${salt.toString("base64url")}$${key(salt, pw)}`;
    },
    /** @param {string} pw @param {string} stored */
    async verify(pw, stored) {
      computations += 1;
      await wait();
      const m =
        /^scrypt\$17\$8\$1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]+)$/.exec(
          stored,
        );
      return m !== null && key(Buffer.from(m[1], "base64url"), pw) === m[2];
    },
  };
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 without padding, decoded by this file. @param {string} text */
export function base32Bytes(text) {
  let bits = 0;
  let value = 0;
  /** @type {number[]} */
  const out = [];
  for (const ch of text) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error(`not base32: ${ch}`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

/**
 * RFC 4226 HOTP with HMAC-SHA1 and dynamic truncation, written here (not imported from the code).
 * @param {Buffer} key
 * @param {number} counter
 * @param {number} digits
 */
export function hotpOf(key, counter, digits) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", key).update(msg).digest();
  const o = mac[19] & 0x0f;
  const n = mac.readUInt32BE(o) & 0x7fffffff;
  return String(n % 10 ** digits).padStart(digits, "0");
}

/**
 * The 6-digit TOTP code of a base32 secret at a clock time (ms), `offset` steps of 30 s away.
 * @param {string} secret
 * @param {number} ms
 * @param {number} [offset]
 */
export const totpCode = (secret, ms, offset = 0) =>
  hotpOf(base32Bytes(secret), Math.floor(ms / 30000) + offset, 6);

/** A 43-character token text of 32 random bytes. */
export const randomToken = () => crypto.randomBytes(32).toString("base64url");
/** @param {string} text */
export const sha256Hex = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");

/**
 * A migrated PGlite under sai_app_login, and the readers of its state. `sql` runs one statement in its own
 * transaction as sai_app with app.role «platform» (every row visible, the test's own path, never the app's).
 */
export async function authDb() {
  const raw = await openPglite(null);
  await migrate({ adapter: raw, dir: MIGRATIONS, password: null });
  await raw.switchToLoginRole();
  const tx = /** @type {NonNullable<typeof raw.transaction>} */ (
    raw.transaction
  );
  /**
   * @param {string} text
   * @param {unknown[]} [params]
   * @returns {Promise<any[]>}
   */
  const sql = (text, params) =>
    tx(async (c) => {
      await c.query("set local role sai_app");
      await c.query("select set_config('app.role', 'platform', true)");
      return (await c.query(text, params)).rows;
    });
  /** @param {string} table */
  const rowsOf = async (table) => {
    if (!TABLES.includes(table)) throw new Error(`not a table: ${table}`);
    const rows = await sql(`select row_to_json(x)::text as j from ${table} x`);
    return rows.map((r) => /** @type {string} */ (r.j)).sort();
  };
  /** The row count of every table. */
  const counts = async () => {
    /** @type {Record<string, number>} */
    const out = {};
    for (const t of TABLES) out[t] = (await rowsOf(t)).length;
    return out;
  };
  /**
   * The sha256 of every row of each table (sorted JSON texts), leaving out the named columns.
   * @param {readonly string[]} [tables]
   * @param {Record<string, readonly string[]>} [omit]
   */
  const digest = async (tables = TABLES, omit = {}) => {
    /** @type {Record<string, string>} */
    const out = {};
    for (const t of tables) {
      const rows = (await rowsOf(t)).map((j) => {
        const o = JSON.parse(j);
        for (const c of omit[t] ?? []) delete o[c];
        return JSON.stringify(o);
      });
      out[t] = crypto
        .createHash("sha256")
        .update(rows.sort().join("\n"))
        .digest("hex");
    }
    return out;
  };
  /** Every column of every row of every table as one text (bytea in its \x hex form). */
  const dump = async () => {
    const parts = [];
    for (const t of TABLES) parts.push(...(await rowsOf(t)));
    return parts.join("\n");
  };
  return { raw, sql, counts, digest, dump };
}

/**
 * @typedef {object} Actor
 * @property {string} id
 * @property {string} email
 * @property {string} password
 * @property {string | null} orgId
 * @property {string} role the membership role, or "platform_admin"
 * @property {string} ip the client address of its calls
 * @property {string | null} cookie `name=value` of its session cookie
 * @property {string | null} csrf
 */

/**
 * @typedef {object} CallOptions
 * @property {Actor | null} [as] sends the actor's cookie and CSRF token (and its address unless `ip` is given)
 * @property {unknown} [body] an object is sent as JSON, a string as it is; undefined sends no body
 * @property {string | null} [cookie] a Cookie header (overrides the actor's)
 * @property {string | null} [csrf] an x-sai-csrf header (overrides the actor's)
 * @property {string | null} [reauth] an x-sai-reauth header
 * @property {string | null} [ip] the client address the app is given (null: none)
 * @property {string | null} [origin] the Origin header; null sends none (default: the app origin)
 * @property {string | null} [type] the Content-Type of a body; null sends none
 * @property {Record<string, string>} [headers] more headers
 */

/**
 * @typedef {object} Answer
 * @property {number} status
 * @property {string} text
 * @property {any} json
 * @property {Headers} headers
 * @property {string[]} setCookie
 * @property {string | null} cookie `name=value` of the first Set-Cookie
 * @property {string} same the status, body and headers except Date and X-Request-Id, for byte-equal compares
 */

/**
 * The status, the body and every header but Date and X-Request-Id, as one text.
 * @param {number} status
 * @param {string} text
 * @param {Headers} headers
 */
export function sameText(status, text, headers) {
  const h = [...headers]
    .filter(([k]) => k !== "date" && k !== "x-request-id")
    .map(([k, v]) => `${k}: ${v}`)
    .sort();
  return JSON.stringify([status, text, h]);
}

/**
 * The app on a migrated PGlite with injected accounts. Options: `origin` (the app origin), `hasher`,
 * `setupTokenHash` (default the hash of `h.setupToken`; null leaves it unset), `pepper`, `clock` start (ms),
 * `random` (the cleanup source; default never), `txDeadlineMs`, `wrap(raw)` (the adapter the app is given,
 * built around the PGlite adapter), `routeTable`, `demo`, `auth` (more of deps.auth: the G7 gate
 * `personalDataGate` and the planted `consentTexts`, REQ-116).
 * @param {import("node:test").TestContext} t
 * @param {{ origin?: string, hasher?: ReturnType<typeof fastHasher>, setupTokenHash?: string | null, pepper?: Buffer, clock?: number, random?: () => number, txDeadlineMs?: number, wrap?: (raw: any) => any, routeTable?: any, demo?: any, auth?: { personalDataGate?: "owner_only" | "invited", consentTexts?: Record<string, Record<string, string>> } }} [o]
 */
export async function authHarness(t, o = {}) {
  const db = await authDb();
  t.after(() => db.raw.close());
  const origin = o.origin ?? ORIGIN;
  const hasher = o.hasher ?? fastHasher();
  const setupToken = randomToken();
  const pepper = o.pepper ?? crypto.randomBytes(32);
  let now = o.clock ?? Date.UTC(2026, 10, 24, 9, 0, 0);
  let transactions = 0;
  const inner = o.wrap ? o.wrap(db.raw) : db.raw;
  const adapter = {
    query: (/** @type {string} */ s, /** @type {unknown[]} */ p) =>
      inner.query(s, p),
    exec: (/** @type {string} */ s) => inner.exec(s),
    close: async () => {},
    transaction: (/** @type {any} */ fn) => {
      transactions += 1;
      return inner.transaction(fn);
    },
  };
  /** @type {Record<string, unknown>[]} */
  const logs = [];
  const app = createApp({
    config: { siteGate: false, version: "dev" },
    origins: { app: origin, preview: PREVIEW },
    db: createDb(/** @type {any} */ (adapter)),
    site: null,
    migrations: migrationList(),
    log: (e) => logs.push(e),
    demo: o.demo,
    routeTable: o.routeTable,
    auth: {
      pepper,
      setupTokenHash:
        o.setupTokenHash === undefined
          ? sha256Hex(setupToken)
          : o.setupTokenHash,
      clock: () => now,
      random: o.random ?? (() => 1),
      passwords: hasher,
      txDeadlineMs: o.txDeadlineMs,
      ...o.auth,
    },
  });

  /**
   * @param {string} method
   * @param {string} path
   * @param {CallOptions} [c]
   * @returns {Promise<Answer>}
   */
  async function call(method, path, c = {}) {
    /** @type {Record<string, string>} */
    const h = { ...c.headers };
    const og = c.origin === undefined ? origin : c.origin;
    if (og !== null) h.Origin = og;
    const body =
      c.body === undefined
        ? undefined
        : typeof c.body === "string"
          ? c.body
          : JSON.stringify(c.body);
    const type = c.type === undefined ? "application/json" : c.type;
    if (body !== undefined && type !== null) h["Content-Type"] = type;
    const cookie = c.cookie === undefined ? (c.as?.cookie ?? null) : c.cookie;
    if (cookie !== null) h.Cookie = cookie;
    const csrf = c.csrf === undefined ? (c.as?.csrf ?? null) : c.csrf;
    if (csrf !== null) h["x-sai-csrf"] = csrf;
    if (c.reauth) h["x-sai-reauth"] = c.reauth;
    const ip =
      c.ip === undefined ? (c.as?.ip ?? "203.0.113.10") : (c.ip ?? null);
    const res = await app.request(
      `${origin}${path}`,
      { method, headers: h, body },
      { clientIp: ip },
    );
    const text = await res.text();
    /** @type {any} */
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON: json stays null
    }
    const setCookie = res.headers.getSetCookie();
    return {
      status: res.status,
      text,
      json,
      headers: res.headers,
      setCookie,
      cookie: setCookie[0] ? setCookie[0].split(";")[0] : null,
      same: sameText(res.status, text, res.headers),
    };
  }

  let orgCount = 0;
  let userCount = 0;
  /** A customer organisation. @param {string} [name] */
  async function addOrg(name) {
    orgCount += 1;
    const rows = await db.sql(
      "insert into orgs (name, kind) values ($1, 'customer') returning id",
      [name ?? `Customer ${orgCount}`],
    );
    return /** @type {string} */ (rows[0].id);
  }

  /** @type {string | null} */
  let firstOrg = null;
  /**
   * An account inserted by the test (no route of M2.2 makes ordinary users), with a membership unless
   * `role` is null.
   * @param {{ email?: string, name?: string, password?: string, role?: string | null, orgId?: string, status?: string, ip?: string }} [u]
   * @returns {Promise<Actor>}
   */
  async function addUser(u = {}) {
    userCount += 1;
    const email = u.email ?? `user${userCount}@example.test`;
    const password = u.password ?? USER_PASSWORD;
    const rows = await db.sql(
      "insert into users (email, email_norm, display_name, password_hash, status) values ($1, $2, $3, $4, $5) returning id",
      [
        email,
        email.toLowerCase(),
        u.name ?? "Test User",
        await hasher.hash(password),
        u.status ?? "active",
      ],
    );
    const id = /** @type {string} */ (rows[0].id);
    const role = u.role === undefined ? "member" : u.role;
    let orgId = null;
    if (role !== null) {
      firstOrg ??= await addOrg();
      orgId = u.orgId ?? firstOrg;
      await db.sql(
        "insert into org_members (org_id, user_id, role) values ($1, $2, $3)",
        [orgId, id, role],
      );
    }
    return {
      id,
      email,
      password,
      orgId,
      role: role ?? "none",
      ip: u.ip ?? `198.51.100.${userCount + 20}`,
      cookie: null,
      csrf: null,
    };
  }

  /**
   * Setup with the right token; the admin as an actor (not signed in).
   * @param {{ ip?: string }} [o2]
   * @returns {Promise<Actor>}
   */
  async function setup(o2 = {}) {
    const r = await call("POST", "/api/auth/setup", {
      ip: o2.ip ?? "192.0.2.200",
      body: {
        token: setupToken,
        email: ADMIN.email,
        name: ADMIN.name,
        password: ADMIN.password,
      },
    });
    if (r.status !== 201)
      throw new Error(`setup answered ${r.status} ${r.text}`);
    const rows = await db.sql(
      "select id, org_id from users join org_members on user_id = id where is_platform_admin",
    );
    return {
      id: rows[0].id,
      email: ADMIN.email,
      password: ADMIN.password,
      orgId: rows[0].org_id,
      role: "platform_admin",
      ip: "192.0.2.201",
      cookie: null,
      csrf: null,
    };
  }

  /**
   * Signs the actor in (POST login, then GET me for the CSRF token); throws unless the login answers 200.
   * @param {Actor} a
   * @param {{ code?: string, ip?: string, password?: string }} [o2]
   * @returns {Promise<Actor>}
   */
  async function signIn(a, o2 = {}) {
    const r = await call("POST", "/api/auth/login", {
      ip: o2.ip ?? a.ip,
      origin,
      cookie: null,
      csrf: null,
      body: {
        email: a.email,
        password: o2.password ?? a.password,
        ...(o2.code ? { code: o2.code } : {}),
      },
    });
    if (r.status !== 200 || !r.cookie)
      throw new Error(`login of ${a.email} answered ${r.status} ${r.text}`);
    a.cookie = r.cookie;
    const me = await call("GET", "/api/auth/me", { as: a, origin: null });
    if (me.status !== 200) throw new Error(`me answered ${me.status}`);
    a.csrf = me.json.csrf;
    return a;
  }

  /**
   * A fresh re-auth token of a purpose for a signed-in actor.
   * @param {Actor} a
   * @param {string} purpose
   * @param {{ code?: string }} [o2]
   */
  async function reauthToken(a, purpose, o2 = {}) {
    const r = await call("POST", "/api/auth/reauth", {
      as: a,
      body: {
        password: a.password,
        purpose,
        ...(o2.code ? { code: o2.code } : {}),
      },
    });
    if (r.status !== 200)
      throw new Error(`reauth answered ${r.status} ${r.text}`);
    return /** @type {string} */ (r.json.token);
  }

  /**
   * The six actors of the permission matrix (4.12): setup done, the platform admin and one user of each
   * organisation role in one customer organisation, each signed in; `anonymous` is null.
   */
  async function actors() {
    const admin = await signIn(await setup());
    const out = { anonymous: null, admin };
    for (const role of ["viewer", "member", "org_admin", "org_owner"])
      Object.assign(out, {
        [role]: await signIn(
          await addUser({
            role,
            email: `${role.replace("_", "-")}@example.test`,
          }),
        ),
      });
    return /** @type {{ anonymous: null, admin: Actor, viewer: Actor, member: Actor, org_admin: Actor, org_owner: Actor }} */ (
      out
    );
  }

  return {
    app,
    db,
    sql: db.sql,
    counts: db.counts,
    digest: db.digest,
    dump: db.dump,
    raw: db.raw,
    origin,
    hasher,
    pepper,
    setupToken,
    logs,
    call,
    addOrg,
    addUser,
    setup,
    signIn,
    reauthToken,
    actors,
    transactions: () => transactions,
    now: () => now,
    /** @param {number} ms */
    tick: (ms) => {
      now += ms;
    },
    /** @param {number} ms */
    setNow: (ms) => {
      now = ms;
    },
  };
}

/** @typedef {Awaited<ReturnType<typeof authHarness>>} AuthHarness */
