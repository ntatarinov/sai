import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PUBLIC_LANGS } from "../../public/shared/i18n/lang.js";
import { createApp } from "../../server/app.js";
import { createDb, toDbError } from "../../server/db/index.js";
import { migrate } from "../../server/db/migrate.js";
import { loadIntake } from "../../server/routes/demo.js";
import { routeTable } from "../../server/routes/index.js";
import {
  ADMIN,
  ORIGIN,
  PREVIEW,
  TABLES,
  USER_PASSWORD,
  fastHasher,
  randomToken,
  sameText,
  sha256Hex,
  totpCode,
} from "../fixtures/auth.js";
import { MIGRATIONS, migrationList } from "../fixtures/db.js";
import { APP } from "../fixtures/helpers.js";

// REQ-115 criteria 7 and 8 (AC2.1, the code design M2AUTH, 4.12, 4.13 and C12): the route-level isolation suite
// over the route table read at test time (IS-1, IS-2) and over a planted pair of test-only tenant routes
// (IS-3), the strict body that refuses an organisation key (IS-4), and the organisation that never comes from
// the query or a header (IS-5), each call pair from an equal starting state (a clone of one database).

// The generated fields of the answers that the comparison of IS-5 masks (the code design M2AUTH, 4.13, C12),
// mirrored here from the design: each with its kind and the shape its value must have before it is masked.
// Every other route masks nothing. The kinds id and time have no row in M2.2.
const KINDS = ["id", "code", "token", "time"];
const RE_ORIGIN = ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** @type {Record<string, Array<{ field: string, kind: string, shape: RegExp, count?: number }>>} */
const MASKED = {
  "POST /api/auth/reauth": [
    { field: "token", kind: "token", shape: /^[A-Za-z0-9_-]{43}$/ },
  ],
  "POST /api/admin/users/:id/reset-link": [
    {
      field: "link",
      kind: "code",
      shape: new RegExp(`^${RE_ORIGIN}/reset\\.html#c=[A-Za-z0-9_-]{22}$`),
    },
  ],
  "POST /api/admin/totp/enrol": [
    { field: "secret", kind: "code", shape: /^[A-Z2-7]{32}$/ },
    {
      field: "otpauth",
      kind: "code",
      shape:
        /^otpauth:\/\/totp\/Sai:[^?]+\?secret=[A-Z2-7]{32}&issuer=Sai&algorithm=SHA1&digits=6&period=30$/,
    },
  ],
  "POST /api/admin/totp/confirm": [
    {
      field: "recovery_codes[*]",
      kind: "code",
      shape: /^[A-Z2-7]{16}$/,
      count: 10,
    },
  ],
};

/**
 * The body of an answer with the fields of its route's MASKED rows replaced by their kind, after the shape
 * of each value was checked; a value of another shape, a missing field or a wrong count is a finding.
 * @param {string} route
 * @param {string} text
 * @returns {{ body: string, findings: string[] }}
 */
export function masked(route, text) {
  const rows = MASKED[route] ?? [];
  if (rows.length === 0) return { body: text, findings: [] };
  /** @type {string[]} */
  const findings = [];
  /** @type {any} */
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { body: text, findings: [`${route}: not JSON`] };
  }
  for (const r of rows) {
    if (!KINDS.includes(r.kind)) findings.push(`${route}: kind ${r.kind}`);
    const star = r.field.endsWith("[*]");
    const key = star ? r.field.slice(0, -3) : r.field;
    const value = body?.[key];
    const values = star ? value : [value];
    if (!Array.isArray(values) || (star && r.count !== values.length)) {
      findings.push(`${route}: ${r.field} count`);
      continue;
    }
    for (const v of values)
      if (typeof v !== "string" || !r.shape.test(v))
        findings.push(`${route}: ${r.field} shape`);
    body[key] = star ? values.map(() => `<${r.kind}>`) : `<${r.kind}>`;
  }
  return { body: JSON.stringify(body), findings };
}

// ---------------------------------------------------------------------------------------------------------
// The world of this file: one PGlite instance per state behind an adapter of the same contract as
// server/db/pglite.js (PGlite's own transaction()), so a state can be cloned whole (PGlite.clone()), and the
// app over it with injected accounts. The clock, the pepper, the setup token and the hasher are shared by the
// clones of one world, so two clones answer one request alike.

/**
 * @param {PGlite} pg
 * @param {{ transactions: number }} counter
 * @returns {import("../../server/db/index.js").Adapter}
 */
function adapterOf(pg, counter) {
  /** @param {any} on */
  const query =
    (on) => async (/** @type {string} */ t, /** @type {unknown[]} */ p) => {
      try {
        return { rows: (await on.query(t, p)).rows };
      } catch (err) {
        throw toDbError(err);
      }
    };
  return {
    query: query(pg),
    exec: async (t) => {
      try {
        await pg.exec(t);
      } catch (err) {
        throw toDbError(err);
      }
    },
    close: async () => {},
    transaction: (fn) => {
      counter.transactions += 1;
      return pg.transaction((tx) => fn({ query: query(tx) }));
    },
  };
}

/**
 * @typedef {object} Actor
 * @property {string} id
 * @property {string} email
 * @property {string} password
 * @property {string | null} orgId
 * @property {string} ip
 * @property {string | null} cookie
 * @property {string | null} csrf
 */

/**
 * @typedef {object} Shared what the clones of one world share
 * @property {Buffer} pepper
 * @property {string} setupToken
 * @property {{ now: number }} clock
 * @property {ReturnType<typeof fastHasher>} hasher
 * @property {any} [routeTable]
 */

/**
 * The app over one PGlite instance (already under sai_app_login) and the helpers of the tests.
 * @param {PGlite} pg
 * @param {Shared} shared
 */
function worldOn(pg, shared) {
  const counter = { transactions: 0 };
  const app = createApp({
    config: { siteGate: false, version: "dev" },
    origins: { app: ORIGIN, preview: PREVIEW },
    db: createDb(adapterOf(pg, counter)),
    site: null,
    migrations: migrationList(),
    log: () => {},
    demo: { intake: loadIntake(), langs: PUBLIC_LANGS },
    routeTable: shared.routeTable,
    auth: {
      pepper: shared.pepper,
      setupTokenHash: sha256Hex(shared.setupToken),
      clock: () => shared.clock.now,
      random: () => 1,
      passwords: shared.hasher,
    },
  });
  /**
   * One statement as sai_app with app.role platform (the test's own path, never the app's).
   * @param {string} text
   * @param {unknown[]} [params]
   * @returns {Promise<any[]>}
   */
  const sql = (text, params) =>
    pg.transaction(async (tx) => {
      await tx.query("set local role sai_app");
      await tx.query("select set_config('app.role', 'platform', true)");
      return (await tx.query(text, params)).rows;
    });
  /**
   * @param {string} method
   * @param {string} p
   * @param {{ as?: Actor | null, body?: unknown, reauth?: string | null, origin?: string | null, headers?: Record<string, string>, ip?: string }} [c]
   */
  async function call(method, p, c = {}) {
    /** @type {Record<string, string>} */
    const h = { ...c.headers };
    const og = c.origin === undefined ? ORIGIN : c.origin;
    if (og !== null) h.Origin = og;
    const body =
      c.body === undefined
        ? undefined
        : typeof c.body === "string"
          ? c.body
          : JSON.stringify(c.body);
    if (body !== undefined) h["Content-Type"] = "application/json";
    if (c.as?.cookie) h.Cookie = c.as.cookie;
    if (c.as?.csrf) h["x-sai-csrf"] = c.as.csrf;
    if (c.reauth) h["x-sai-reauth"] = c.reauth;
    const res = await app.request(
      `${ORIGIN}${p}`,
      { method, headers: h, body },
      { clientIp: c.ip ?? c.as?.ip ?? "203.0.113.10" },
    );
    const text = await res.text();
    /** @type {any} */
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON
    }
    const cookie = res.headers.getSetCookie()[0]?.split(";")[0] ?? null;
    return {
      status: res.status,
      text,
      json,
      cookie,
      same: sameText(res.status, text, res.headers),
    };
  }
  /** @param {Actor} a */
  async function signIn(a) {
    const r = await call("POST", "/api/auth/login", {
      ip: a.ip,
      body: { email: a.email, password: a.password },
    });
    if (r.status !== 200 || !r.cookie)
      throw new Error(`login of ${a.email}: ${r.status} ${r.text}`);
    a.cookie = r.cookie;
    const me = await call("GET", "/api/auth/me", { as: a, origin: null });
    a.csrf = me.json.csrf;
    return a;
  }
  /** @param {Actor} a @param {string} purpose @param {string} [code] */
  async function reauthToken(a, purpose, code) {
    const r = await call("POST", "/api/auth/reauth", {
      as: a,
      body: { password: a.password, purpose, ...(code ? { code } : {}) },
    });
    if (r.status !== 200) throw new Error(`reauth: ${r.status} ${r.text}`);
    return /** @type {string} */ (r.json.token);
  }
  let users = 0;
  /** @param {string | null} orgId @param {string | null} role */
  async function addUser(orgId, role) {
    users += 1;
    const email = `iso-${users}-${crypto.randomBytes(3).toString("hex")}@example.test`;
    const [row] = await sql(
      "insert into users (email, email_norm, display_name, password_hash) values ($1, $1, 'Iso User', $2) returning id",
      [email, await shared.hasher.hash(USER_PASSWORD)],
    );
    if (role)
      await sql(
        "insert into org_members (org_id, user_id, role) values ($1, $2, $3)",
        [orgId, row.id, role],
      );
    return /** @type {Actor} */ ({
      id: row.id,
      email,
      password: USER_PASSWORD,
      orgId,
      ip: `198.51.100.${(users % 200) + 20}`,
      cookie: null,
      csrf: null,
    });
  }
  /** @param {string} name */
  async function addOrg(name) {
    const [row] = await sql(
      "insert into orgs (name, kind) values ($1, 'customer') returning id",
      [name],
    );
    return /** @type {string} */ (row.id);
  }
  /** Every row of every table, as sorted JSON texts per table. */
  async function rows() {
    /** @type {Record<string, string[]>} */
    const out = {};
    for (const t of TABLES)
      out[t] = (await sql(`select row_to_json(x)::text as j from ${t} x`))
        .map((r) => /** @type {string} */ (r.j))
        .sort();
    return out;
  }
  /** The sha256 of every table's rows. */
  async function digest() {
    const all = await rows();
    return Object.fromEntries(
      Object.entries(all).map(([t, list]) => [t, sha256Hex(list.join("\n"))]),
    );
  }
  let closed = false;
  return {
    pg,
    /** Closes the instance once (a second call does nothing). */
    close: async () => {
      if (closed) return;
      closed = true;
      await pg.close();
    },
    shared,
    app,
    sql,
    call,
    signIn,
    reauthToken,
    addUser,
    addOrg,
    rows,
    digest,
    transactions: () => counter.transactions,
  };
}

/** @typedef {ReturnType<typeof worldOn>} World */

/**
 * A fresh world: a migrated PGlite under sai_app_login, setup done, a customer organisation B with a user of
 * each organisation role and organisation A with a member, each signed in, and organisation X that no actor
 * belongs to (the planted organisation of IS-5).
 * @param {import("node:test").TestContext} t
 * @param {{ routeTable?: any }} [o]
 */
async function freshWorld(t, o = {}) {
  const pg = new PGlite();
  const adapter = adapterOf(pg, { transactions: 0 });
  await migrate({ adapter, dir: MIGRATIONS, password: null });
  await pg.exec("set session authorization sai_app_login");
  /** @type {Shared} */
  const shared = {
    pepper: crypto.randomBytes(32),
    setupToken: randomToken(),
    clock: { now: Date.UTC(2026, 10, 24, 9, 0, 0) },
    hasher: fastHasher(),
    routeTable: o.routeTable,
  };
  const w = worldOn(pg, shared);
  t.after(() => w.close());
  const s = await w.call("POST", "/api/auth/setup", {
    ip: "192.0.2.200",
    body: {
      token: shared.setupToken,
      email: ADMIN.email,
      name: ADMIN.name,
      password: ADMIN.password,
    },
  });
  assert.equal(s.status, 201, s.text);
  const [adminRow] = await w.sql(
    "select id from users where is_platform_admin",
  );
  /** @type {Actor} */
  const admin = await w.signIn({
    id: adminRow.id,
    email: ADMIN.email,
    password: ADMIN.password,
    orgId: null,
    ip: "192.0.2.201",
    cookie: null,
    csrf: null,
  });
  const orgA = await w.addOrg("Organisation A");
  const orgB = await w.addOrg("Organisation B");
  const orgX = await w.addOrg("Organisation X");
  const memberA = await w.signIn(await w.addUser(orgA, "member"));
  /** @type {Record<string, Actor>} */
  const inB = {};
  for (const role of ["viewer", "member", "org_admin", "org_owner"])
    inB[role] = await w.signIn(await w.addUser(orgB, role));
  return { ...w, admin, orgA, orgB, orgX, memberA, inB };
}

/**
 * A clone of the world's whole database as another world of the same shared parts (an equal starting state).
 * @param {import("node:test").TestContext} t
 * @param {World} w
 */
async function cloneOf(t, w) {
  await w.pg.exec("reset session authorization");
  const pg = await w.pg.clone();
  await w.pg.exec("set session authorization sai_app_login");
  await pg.exec("set session authorization sai_app_login");
  const c = worldOn(pg, w.shared);
  t.after(() => c.close());
  return c;
}

/**
 * The canonical request of a route for the actor that the route serves (the code design M2AUTH, 4.12), made
 * ready on `w`: its re-auth token, the TOTP state, a fresh reset code, a throwaway account. The request itself
 * is not sent.
 * @param {Awaited<ReturnType<typeof freshWorld>>} base the actors
 * @param {World} w the world the preparation runs on
 * @param {string} route
 */
async function canonical(base, w, route) {
  const [method, template] = route.split(" ");
  const member = base.inB.member;
  const admin = base.admin;
  const answers = JSON.parse(
    fs.readFileSync(
      path.join(APP, "content", "sai-intake.answers", "landing.json"),
      "utf8",
    ),
  );
  /** @type {{ method: string, path: string, as: Actor | null, body?: Record<string, unknown>, reauth?: string | null }} */
  const r = { method, path: template, as: null };
  switch (route) {
    case "GET /api/demo/questionnaire":
    case "GET /api/health":
      break;
    case "POST /api/demo/result":
      r.body = { answers };
      break;
    case "POST /api/auth/setup":
      r.body = {
        token: base.shared.setupToken,
        email: "second@example.test",
        name: "Second",
        password: "second-admin-pass-8Kd",
      };
      break;
    case "POST /api/auth/login":
      r.body = { email: member.email, password: member.password };
      r.as = member;
      break;
    case "POST /api/auth/logout":
      r.body = {};
      r.as = member;
      break;
    case "GET /api/auth/me":
      r.as = member;
      break;
    case "POST /api/auth/password":
      r.body = { current: member.password, next: "changed-pass-9Zq" };
      r.as = member;
      break;
    case "POST /api/auth/reauth":
      r.body = { password: member.password, purpose: "settings" };
      r.as = member;
      break;
    case "POST /api/auth/reset": {
      const target = await w.addUser(null, null);
      const link = await w.call(
        "POST",
        `/api/admin/users/${target.id}/reset-link`,
        {
          as: admin,
          body: {},
          reauth: await w.reauthToken(admin, "reset_link"),
        },
      );
      assert.equal(link.status, 200, link.text);
      r.body = {
        code: /#c=([A-Za-z0-9_-]{22})$/.exec(link.json.link)?.[1],
        password: "reset-pass-7Hq2x",
      };
      break;
    }
    case "POST /api/admin/users/:id/reset-link":
      r.path = template.replace(":id", (await w.addUser(null, null)).id);
      r.body = {};
      r.as = admin;
      r.reauth = await w.reauthToken(admin, "reset_link");
      break;
    case "POST /api/admin/totp/enrol":
      r.body = {};
      r.as = admin;
      r.reauth = await w.reauthToken(admin, "totp_enrol");
      break;
    case "POST /api/admin/totp/confirm":
    case "POST /api/admin/totp/off": {
      const e = await w.call("POST", "/api/admin/totp/enrol", {
        as: admin,
        body: {},
        reauth: await w.reauthToken(admin, "totp_enrol"),
      });
      assert.equal(e.status, 200, e.text);
      const code = () => totpCode(e.json.secret, base.shared.clock.now);
      r.as = admin;
      if (route.endsWith("/confirm")) {
        r.body = { code: code() };
        break;
      }
      const c = await w.call("POST", "/api/admin/totp/confirm", {
        as: admin,
        body: { code: code() },
      });
      assert.equal(c.status, 200, c.text);
      base.shared.clock.now += 30000;
      r.reauth = await w.reauthToken(admin, "totp_off", code());
      base.shared.clock.now += 30000;
      r.body = { code: code() };
      break;
    }
    case "GET /api/admin/audit/verify":
      r.as = admin;
      break;
    default:
      throw new Error(`no canonical request for ${route}`);
  }
  return r;
}

/** @param {World} w */
const realRoutes = (w) => {
  /** @type {any[]} */
  let table = [];
  // The table as the app builds it: createApp calls routeTable once with its own deps.
  createApp({
    config: { siteGate: false, version: "dev" },
    origins: { app: ORIGIN, preview: PREVIEW },
    db: null,
    site: null,
    migrations: migrationList(),
    log: () => {},
    demo: { intake: loadIntake(), langs: PUBLIC_LANGS },
    routeTable: (/** @type {any} */ deps) => (table = [...routeTable(deps)]),
    auth: { pepper: w.shared.pepper, setupTokenHash: null },
  });
  return table;
};

// ---------------------------------------------------------------------------------------------------------
// The suite of IS-1 and IS-2: every tenant route of a table needs its case; an object route answers a foreign
// object exactly like a missing one and an anonymous caller 401; a list or create route shows no id or name of
// a foreign object, and a row it creates carries the caller's organisation.

/**
 * @typedef {{ kind: "object", make: (orgId: string) => Promise<string> }
 *   | { kind: "list", make: (orgId: string) => Promise<string>, secrets: (orgId: string) => string[] }
 *   | { kind: "create", created: () => Promise<string | null>, secrets: (orgId: string) => string[] }} Case
 */

/**
 * @param {Awaited<ReturnType<typeof freshWorld>>} w
 * @param {any[]} table the route rows
 * @param {Record<string, Case>} cases by `<METHOD> <path>`
 * @returns {Promise<{ count: number, findings: string[] }>}
 */
async function isolationSuite(w, table, cases) {
  const findings = [];
  let count = 0;
  const memberB = w.inB.member;
  for (const row of table.filter((r) => r.meta.tenant === true)) {
    const route = `${row.method} ${row.path}`;
    const c = cases[route];
    if (!c) {
      findings.push(`${route}: a tenant route without a case`);
      continue;
    }
    count += 1;
    const get = row.method === "GET";
    const opt = (/** @type {Actor | null} */ as) => ({
      as,
      ...(get ? { origin: null } : { body: {} }),
    });
    if (c.kind === "object") {
      if (!row.path.includes(":id")) findings.push(`${route}: no :id`);
      const foreign = await c.make(w.orgA);
      const a1 = await w.call(
        row.method,
        row.path.replace(":id", foreign),
        opt(memberB),
      );
      const a2 = await w.call(
        row.method,
        row.path.replace(":id", crypto.randomUUID()),
        opt(memberB),
      );
      if (a1.status !== 404 || a2.status !== 404)
        findings.push(
          `${route}: answers ${a1.status} and ${a2.status}, not 404`,
        );
      if (a1.same !== a2.same)
        findings.push(
          `${route}: a foreign object answers unlike a missing one`,
        );
      const anon = await w.call(
        row.method,
        row.path.replace(":id", foreign),
        opt(null),
      );
      if (anon.status !== 401)
        findings.push(`${route}: anonymous ${anon.status}`);
    } else {
      if (c.kind === "list") await c.make(w.orgA);
      const a = await w.call(row.method, row.path, opt(memberB));
      if (a.status < 200 || a.status > 299)
        findings.push(`${route}: answers ${a.status}`);
      for (const s of c.secrets(w.orgA))
        if (a.text.includes(s)) findings.push(`${route}: shows ${s}`);
      if (c.kind === "create") {
        const org = await c.created();
        if (org !== w.orgB) findings.push(`${route}: created in ${org}`);
      }
      const anon = await w.call(row.method, row.path, opt(null));
      if (anon.status !== 401)
        findings.push(`${route}: anonymous ${anon.status}`);
    }
  }
  return { count, findings };
}

// The cases of the tenant routes of the real table, by `<METHOD> <path>`: none in M2.2 (REQ-117 brings the
// tenant routes and their cases; a tenant route without a case here fails IS-1).
/** @type {Record<string, Case>} */
const CASES = {};

test("IS-1 every tenant route of the real table that takes an object id answers a foreign object byte-equal to a missing one (404) and an anonymous caller 401; a tenant route without a case fails", async (t) => {
  const w = await freshWorld(t);
  const table = realRoutes(w);
  assert.ok(table.length >= 15, `${table.length} routes`);
  const r = await isolationSuite(
    w,
    table.filter((x) => x.path.includes(":id")),
    CASES,
  );
  t.diagnostic(`isolation IS-1: ${r.count} object-id tenant routes`);
  assert.deepEqual(r.findings, []);
  // A tenant route that the cases do not name is a finding (the rule that makes REQ-117 enter its cases).
  const planted = {
    ...table[0],
    path: "/api/projects/:id",
    meta: { ...table[0].meta, tenant: true },
  };
  assert.deepEqual((await isolationSuite(w, [planted], CASES)).findings, [
    `${planted.method} /api/projects/:id: a tenant route without a case`,
  ]);
});

test("IS-2 every tenant list or create route of the real table shows no id or name of a foreign object and creates rows of the caller's organisation", async (t) => {
  const w = await freshWorld(t);
  const table = realRoutes(w).filter((x) => !x.path.includes(":id"));
  const r = await isolationSuite(w, table, CASES);
  t.diagnostic(`isolation IS-2: ${r.count} list or create tenant routes`);
  assert.deepEqual(r.findings, []);
});

test("IS-3 the suite on a planted pair of tenant routes on the request's one transaction: green on the routes that read with the session's organisation, red on those that read by id alone", async (t) => {
  /** @type {Array<{ id: string, org_id: string, name: string }>} */
  const objects = [];
  /** @type {any[]} */
  const inside = [];
  const meta = Object.freeze({
    tenant: true,
    admin: false,
    reauth: null,
    worker: false,
    session: true,
    rateLimit: /** @type {const} */ ("user"),
  });
  /**
   * A handler that first records what the transaction is (one transaction, tenant settings of the session's
   * organisation, B4), then answers from the test-only list. A handler opens no transaction.
   * @param {(req: any) => any} answer
   */
  const handler = (answer) => async (/** @type {any} */ req) => {
    const [who] = (
      await req.q.query(
        "select current_user as u, current_setting('app.role', true) as r, current_setting('app.org_id', true) as o",
      )
    ).rows;
    inside.push({ who, orgId: req.session.orgId });
    return answer(req);
  };
  const missing = { status: 404, body: { error: "not_found" } };
  /** @param {boolean} good */
  const planted = (good) => [
    Object.freeze({
      method: "GET",
      path: "/api/t/items/:id",
      meta,
      handler: handler((req) => {
        const o = objects.find(
          (x) =>
            x.id === req.params.id && (!good || x.org_id === req.session.orgId),
        );
        return o ? { status: 200, body: o } : missing;
      }),
    }),
    Object.freeze({
      method: "GET",
      path: "/api/t/items",
      meta,
      handler: handler((req) => ({
        status: 200,
        body: {
          items: objects.filter((x) => !good || x.org_id === req.session.orgId),
        },
      })),
    }),
    Object.freeze({
      method: "POST",
      path: "/api/t/items",
      meta,
      handler: handler((req) => {
        // The bad one takes the organisation of the first object, not the session's.
        const o = {
          id: crypto.randomUUID(),
          org_id: good ? req.session.orgId : (objects[0]?.org_id ?? ""),
          name: `made-${objects.length}`,
        };
        objects.push(o);
        return { status: 201, body: { id: o.id } };
      }),
    }),
  ];
  const make = async (/** @type {string} */ orgId) => {
    const o = {
      id: crypto.randomUUID(),
      org_id: orgId,
      name: `secret-name-${objects.length}`,
    };
    objects.push(o);
    return o.id;
  };
  const secrets = (/** @type {string} */ orgId) =>
    objects.filter((o) => o.org_id === orgId).flatMap((o) => [o.id, o.name]);
  /** @type {Record<string, Case>} */
  const cases = {
    "GET /api/t/items/:id": { kind: "object", make },
    "GET /api/t/items": { kind: "list", make, secrets },
    "POST /api/t/items": {
      kind: "create",
      secrets,
      created: async () => objects.at(-1)?.org_id ?? null,
    },
  };
  for (const good of [true, false]) {
    objects.length = 0;
    inside.length = 0;
    const rows = planted(good);
    const w = await freshWorld(t, {
      routeTable: (/** @type {any} */ deps) => [...routeTable(deps), ...rows],
    });
    const before = w.transactions();
    const r = await isolationSuite(w, rows, cases);
    assert.equal(r.count, 3);
    if (good) assert.deepEqual(r.findings, []);
    else {
      // Red on each of the three: the foreign object, the foreign list entries, the foreign organisation.
      const of = (/** @type {string} */ p) =>
        r.findings.filter((x) => x.startsWith(p));
      assert.deepEqual(of("GET /api/t/items/:id:"), [
        "GET /api/t/items/:id: answers 200 and 404, not 404",
        "GET /api/t/items/:id: a foreign object answers unlike a missing one",
      ]);
      assert.ok(
        of("GET /api/t/items: shows ").length >= 2,
        r.findings.join("\n"),
      );
      // The row made in the foreign organisation also shows up in the answer as a foreign object.
      assert.ok(
        of("POST /api/t/items:").includes(
          `POST /api/t/items: created in ${w.orgA}`,
        ),
        r.findings.join("\n"),
      );
    }
    // Every request ran on one transaction (seven requests: three of the object case, two each of the list
    // and the create case); each handler call ran under tenant settings of the session's organisation (the
    // anonymous calls stop at 401 before the handler).
    assert.equal(w.transactions() - before, 7);
    assert.equal(inside.length, 4);
    for (const x of inside)
      assert.deepEqual(x.who, { u: "sai_app", r: "tenant", o: x.orgId });
  }
});

test("IS-4 every route of the real table that takes a JSON body refuses an added org_id or orgId key with 400 and leaves every table unchanged", async (t) => {
  const w = await freshWorld(t);
  const routes = realRoutes(w)
    .filter((r) => r.method !== "GET")
    .map((r) => `${r.method} ${r.path}`);
  t.diagnostic(`isolation IS-4: ${routes.length} routes with a body`);
  assert.ok(routes.length >= 11, routes.join(", "));
  /** @type {string[]} */
  const wrong = [];
  for (const route of routes) {
    // Each route on its own clone of the world, so no earlier route's action decides it.
    const x = await cloneOf(t, w);
    const req = await canonical(w, x, route);
    for (const key of ["org_id", "orgId"]) {
      const before = await x.digest();
      const a = await x.call(req.method, req.path, {
        as: req.as,
        body: { ...req.body, [key]: w.orgX },
        reauth: req.reauth ?? null,
      });
      if (a.status !== 400 || a.json?.error !== "bad_body")
        wrong.push(`${route} ${key}: ${a.status} ${a.text}`);
      if (JSON.stringify(await x.digest()) !== JSON.stringify(before))
        wrong.push(`${route} ${key}: the state changed`);
    }
    // The same request without the key is taken (the refusal is the key's, not the request's).
    const ok = await x.call(req.method, req.path, {
      as: req.as,
      body: req.body,
      reauth: req.reauth ?? null,
    });
    if (
      route !== "POST /api/auth/setup" &&
      (ok.status < 200 || ok.status > 299)
    )
      wrong.push(`${route} without the key: ${ok.status} ${ok.text}`);
    await x.close();
  }
  assert.deepEqual(wrong, []);
});

test("IS-5 a query org_id and a header x-sai-org of another organisation change no answer: each call pair from one cloned state answers the same status and the same body after the masks of MASKED; no row takes the planted organisation", async (t) => {
  const w = await freshWorld(t);
  const routes = realRoutes(w).map((r) => `${r.method} ${r.path}`);
  t.diagnostic(`isolation IS-5: ${routes.length} routes`);
  // The mask table names routes of the real table only, each with fields of the four kinds.
  for (const route of Object.keys(MASKED))
    assert.ok(routes.includes(route), route);
  /** @type {string[]} */
  const wrong = [];
  for (const route of routes) {
    const prepared = await cloneOf(t, w);
    const req = await canonical(w, prepared, route);
    const plain = await cloneOf(t, prepared);
    const planted = await cloneOf(t, prepared);
    const sep = req.path.includes("?") ? "&" : "?";
    const a = await plain.call(req.method, req.path, {
      as: req.as,
      body: req.body,
      reauth: req.reauth ?? null,
      ...(req.method === "GET" ? { origin: null } : {}),
    });
    const b = await planted.call(
      req.method,
      `${req.path}${sep}org_id=${w.orgX}`,
      {
        as: req.as,
        body: req.body,
        reauth: req.reauth ?? null,
        headers: { "x-sai-org": w.orgX },
        ...(req.method === "GET" ? { origin: null } : {}),
      },
    );
    const ma = masked(route, a.text);
    const mb = masked(route, b.text);
    wrong.push(...ma.findings, ...mb.findings);
    if (a.status !== b.status)
      wrong.push(`${route}: ${a.status} and ${b.status}`);
    if (ma.body !== mb.body) wrong.push(`${route}: the bodies differ`);
    // The planted organisation's id stands in no more rows than without it (no row took it).
    const times = async (/** @type {World} */ x) =>
      Object.values(await x.rows())
        .flat()
        .filter((j) => j.includes(w.orgX)).length;
    if ((await times(plain)) !== (await times(planted)))
      wrong.push(`${route}: a row took the planted organisation`);
    await prepared.close();
    await plain.close();
    await planted.close();
  }
  assert.deepEqual(wrong, []);
  // The masks: a value of another shape, a wrong count and a missing field are findings.
  assert.deepEqual(
    masked(
      "POST /api/auth/reauth",
      JSON.stringify({ token: "short", expires_in: 300 }),
    ).findings,
    ["POST /api/auth/reauth: token shape"],
  );
  assert.deepEqual(
    masked(
      "POST /api/admin/totp/confirm",
      JSON.stringify({ recovery_codes: ["A".repeat(16)] }),
    ).findings,
    ["POST /api/admin/totp/confirm: recovery_codes[*] count"],
  );
  assert.deepEqual(masked("GET /api/auth/me", '{"id":1}'), {
    body: '{"id":1}',
    findings: [],
  });
});
