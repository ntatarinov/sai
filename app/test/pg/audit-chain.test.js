import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createApp } from "../../server/app.js";
import { createDb } from "../../server/db/index.js";
import { createPgAdapter } from "../../server/db/pg.js";
import { withPlatform, withTenant } from "../../server/db/tx.js";
import { appendAudit } from "../../server/services/audit.js";
import {
  ADMIN,
  ORIGIN,
  PREVIEW,
  USER_PASSWORD,
  fastHasher,
  randomToken,
  sameText,
  sha256Hex,
} from "../fixtures/auth.js";
import { migrationList } from "../fixtures/db.js";
import { APP, childEnv } from "../fixtures/helpers.js";
import {
  admin,
  client,
  freshDatabase,
  newPassword,
  url,
} from "../fixtures/pg-env.js";

// REQ-115 criterion 10 (the code design M2AUTH, 4.11; decisions/0137 Addition 4, SEC F1) on the real Postgres of
// the job pg: the one audit writer under 20 parallel inserts, the verify route of the platform admin, the hash
// of every row recomputed here by the formula of the requirement, a tampered row found by its id, a details key
// outside the closed list refused before any row, and the uniform 404 of the verify route.

const ZERO = "0".repeat(64);

/**
 * JSON with object keys sorted by UTF-16 code units at every level and no white space (the test's own form of
 * the requirement's canonical_json).
 * @param {unknown} v
 * @returns {string}
 */
function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v !== null && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonicalJson(/** @type {any} */ (v)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

/**
 * Every stored row in id order, read by the owner, each with the hash recomputed here: sha256(prev_hash ||
 * canonical_json(row without hash)), the id as decimal text and created_at as ISO text with milliseconds.
 * The order names the table's column: a bare `order by id` would sort by the text alias (1, 10, 11, …, 2).
 * @param {import("pg").Client} c
 */
async function chain(c) {
  const rows = (
    await c.query(
      "select id::text as id, org_id, actor_kind, actor_id, action, target_kind, target_id, ip_hmac, details, prev_hash, hash, created_at from audit_log order by audit_log.id",
    )
  ).rows;
  return rows.map((r) => {
    const { hash, ...rest } = r;
    const row = { ...rest, created_at: new Date(r.created_at).toISOString() };
    return {
      id: /** @type {string} */ (r.id),
      prev: /** @type {string} */ (r.prev_hash),
      hash: /** @type {string} */ (hash),
      recomputed: crypto
        .createHash("sha256")
        .update(`${r.prev_hash}${canonicalJson(row)}`, "utf8")
        .digest("hex"),
    };
  });
}

/**
 * A migrated database, the app on it as sai_app_login over a pool, setup done and the admin and an ordinary
 * member signed in.
 * @param {import("node:test").TestContext} t
 */
async function world(t) {
  const name = await freshDatabase(t);
  const pw = newPassword();
  const m = spawnSync(process.execPath, ["server/db/migrate.js"], {
    cwd: APP,
    env: childEnv({
      DATABASE_URL: url("postgres", admin().password, name),
      APP_DB_PASSWORD: pw,
    }),
    encoding: "utf8",
  });
  assert.equal(m.status, 0, m.stderr);
  const c = await client(name);
  t.after(() => c.end());
  const db = createDb(
    createPgAdapter(url("sai_app_login", pw, name), {
      connectTimeoutMs: 5000,
      max: 8,
    }),
  );
  t.after(() => db.close());
  const hasher = fastHasher();
  const pepper = crypto.randomBytes(32);
  const setupToken = randomToken();
  const app = createApp({
    config: { siteGate: false, version: "dev" },
    origins: { app: ORIGIN, preview: PREVIEW },
    db,
    site: null,
    migrations: migrationList(),
    log: () => {},
    auth: {
      pepper,
      setupTokenHash: sha256Hex(setupToken),
      clock: () => Date.UTC(2026, 10, 24, 9, 0, 0),
      random: () => 1,
      passwords: hasher,
    },
  });
  /**
   * @param {string} method
   * @param {string} p
   * @param {{ cookie?: string | null, body?: unknown, ip?: string }} [o]
   */
  const call = async (method, p, o = {}) => {
    /** @type {Record<string, string>} */
    const h = {};
    if (method !== "GET") {
      h.Origin = ORIGIN;
      h["Content-Type"] = "application/json";
    }
    if (o.cookie) h.Cookie = o.cookie;
    const res = await app.request(
      `${ORIGIN}${p}`,
      {
        method,
        headers: h,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
      },
      { clientIp: o.ip ?? "203.0.113.30" },
    );
    const text = await res.text();
    return {
      status: res.status,
      text,
      same: sameText(res.status, text, res.headers),
      cookie: res.headers.getSetCookie()[0]?.split(";")[0] ?? null,
    };
  };
  const s = await call("POST", "/api/auth/setup", {
    body: {
      token: setupToken,
      email: ADMIN.email,
      name: ADMIN.name,
      password: ADMIN.password,
    },
  });
  assert.equal(s.status, 201, s.text);
  const signIn = async (
    /** @type {string} */ email,
    /** @type {string} */ password,
    /** @type {string} */ ip,
  ) => {
    const r = await call("POST", "/api/auth/login", {
      body: { email, password },
      ip,
    });
    assert.equal(r.status, 200, r.text);
    return /** @type {string} */ (r.cookie);
  };
  const adminCookie = await signIn(ADMIN.email, ADMIN.password, "192.0.2.10");
  const [org] = (
    await c.query(
      "insert into orgs (name, kind) values ('Customer', 'customer') returning id",
    )
  ).rows;
  const [user] = (
    await c.query(
      "insert into users (email, email_norm, display_name, password_hash) values ('member@example.test', 'member@example.test', 'Member', $1) returning id",
      [await hasher.hash(USER_PASSWORD)],
    )
  ).rows;
  await c.query(
    "insert into org_members (org_id, user_id, role) values ($1, $2, 'member')",
    [org.id, user.id],
  );
  const memberCookie = await signIn(
    "member@example.test",
    USER_PASSWORD,
    "192.0.2.11",
  );
  return {
    c,
    db,
    call,
    adminCookie,
    memberCookie,
    orgId: /** @type {string} */ (org.id),
    pepper,
  };
}

const ctx = {
  now: Date.UTC(2026, 10, 24, 9, 30, 0),
  mac: (/** @type {string} */ label, /** @type {string} */ text) =>
    crypto
      .createHmac("sha256", "audit-chain-test")
      .update(`${label}\0${text}`)
      .digest("hex"),
};

test("AC-1 20 parallel inserts through the writer: verify answers ok with the row count, and every hash recomputed from the stored rows equals the stored one in one unbroken chain", async (t) => {
  const w = await world(t);
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      withPlatform(w.db, (q) =>
        appendAudit(
          q,
          {
            orgId: i % 2 ? w.orgId : null,
            actorKind: "system",
            actorId: null,
            action: "auth.login_failed",
            targetKind: null,
            targetId: null,
            ip: `198.51.100.${i + 1}`,
            details: { reason: "unknown_email" },
          },
          { ...ctx, now: ctx.now + i },
        ),
      ),
    ),
  );
  assert.equal(new Set(results).size, 20);
  const rows = await chain(w.c);
  assert.ok(rows.length >= 23, `${rows.length} rows`);
  let prev = ZERO;
  for (const r of rows) {
    assert.equal(r.prev, prev, `row ${r.id}: prev_hash`);
    assert.equal(r.recomputed, r.hash, `row ${r.id}: hash`);
    prev = r.hash;
  }
  // No two rows share a prev_hash (a writer without the lock forks the chain).
  assert.equal(new Set(rows.map((r) => r.prev)).size, rows.length);
  const v = await w.call("GET", "/api/admin/audit/verify", {
    cookie: w.adminCookie,
  });
  assert.equal(v.status, 200, v.text);
  assert.deepEqual(JSON.parse(v.text), { ok: true, count: rows.length });
  // No address in clear: the ip of each written row is its HMAC.
  const ips = (
    await w.c.query("select ip_hmac from audit_log where ip_hmac is not null")
  ).rows.map((r) => r.ip_hmac);
  assert.ok(ips.length >= 20 && ips.every((x) => /^[0-9a-f]{64}$/.test(x)));
  // The command of the criterion: `insert into audit_log` stands in the one writer file only.
  /** @type {string[]} */
  const hits = [];
  for (const f of fs.readdirSync(path.join(APP, "server"), {
    recursive: true,
  })) {
    const rel = String(f).split(path.sep).join("/");
    if (!rel.endsWith(".js")) continue;
    if (
      /insert\s+into\s+audit_log/i.test(
        fs.readFileSync(path.join(APP, "server", rel), "utf8"),
      )
    )
      hits.push(rel);
  }
  assert.deepEqual(hits, ["db/audit-store.js"]);
});

test("AC-2 a row changed by the owner with the trigger disabled: verify answers ok false with the id of that row", async (t) => {
  const w = await world(t);
  for (let i = 0; i < 5; i++)
    await withPlatform(w.db, (q) =>
      appendAudit(
        q,
        {
          orgId: null,
          actorKind: "system",
          actorId: null,
          action: "auth.login_failed",
          targetKind: null,
          targetId: null,
          ip: null,
          details: { reason: "wrong_password" },
        },
        ctx,
      ),
    );
  const rows = await chain(w.c);
  const victim = rows[Math.floor(rows.length / 2)].id;
  await w.c.query("alter table audit_log disable trigger audit_log_no_change");
  await w.c.query(
    'update audit_log set details = \'{"reason":"locked"}\'::jsonb where id = $1::bigint',
    [victim],
  );
  await w.c.query("alter table audit_log enable trigger audit_log_no_change");
  const v = await w.call("GET", "/api/admin/audit/verify", {
    cookie: w.adminCookie,
  });
  assert.equal(v.status, 200, v.text);
  const body = JSON.parse(v.text);
  assert.equal(body.ok, false);
  assert.equal(String(body.bad_id), victim);
  // The recomputation here finds the same row.
  assert.deepEqual(
    (await chain(w.c)).filter((r) => r.recomputed !== r.hash).map((r) => r.id),
    [victim],
  );
});

test("AC-3 an entry whose details hold a key outside the closed list is refused and writes no row; so is any entry under tenant settings", async (t) => {
  const w = await world(t);
  const count = async () =>
    (await w.c.query("select count(*)::int as n from audit_log")).rows[0].n;
  const before = await count();
  const entry = {
    orgId: null,
    actorKind: /** @type {const} */ ("system"),
    actorId: null,
    action: "auth.login_failed",
    targetKind: null,
    targetId: null,
    ip: null,
    details: { reason: "unknown_email" },
  };
  for (const details of [
    { email: "a@example.test" },
    { reason: "unknown_email", name: "x" },
    { token: "t" },
  ])
    await assert.rejects(
      withPlatform(w.db, (q) => appendAudit(q, { ...entry, details }, ctx)),
      (e) =>
        e instanceof TypeError &&
        e.message === "audit: a details key outside the list",
      JSON.stringify(details),
    );
  assert.equal(await count(), before);
  await assert.rejects(
    withTenant(w.db, w.orgId, (q) => appendAudit(q, entry, ctx)),
    (e) =>
      e instanceof TypeError &&
      e.message === "audit: the writer runs only under platform settings",
  );
  assert.equal(await count(), before);
  // The chain is still whole and the next right entry is written.
  await withPlatform(w.db, (q) => appendAudit(q, entry, ctx));
  assert.equal(await count(), before + 1);
  const v = await w.call("GET", "/api/admin/audit/verify", {
    cookie: w.adminCookie,
  });
  assert.deepEqual(JSON.parse(v.text), { ok: true, count: before + 1 });
});

test("AC-4 verify answers an ordinary user and an anonymous caller 404 byte-equal to an unknown /api address", async (t) => {
  const w = await world(t);
  for (const cookie of [w.memberCookie, null]) {
    const v = await w.call("GET", "/api/admin/audit/verify", { cookie });
    const u = await w.call("GET", "/api/admin/audit/nope", { cookie });
    assert.equal(v.status, 404);
    assert.equal(v.same, u.same, String(cookie));
  }
});
