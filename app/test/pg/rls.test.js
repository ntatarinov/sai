import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createDb, TX_DEADLINE_MS } from "../../server/db/index.js";
import { createPgAdapter } from "../../server/db/pg.js";
import { withPlatform, withTenant } from "../../server/db/tx.js";
import { APP, childEnv } from "../fixtures/helpers.js";
import {
  admin,
  client,
  freshDatabase,
  newPassword,
  url,
} from "../fixtures/pg-env.js";

// REQ-115 criteria 1, 2 and 3 and the least grants of 4.2.3 (the code design M2AUTH, 4.2.2, 4.2.3; RLS-5) on the
// real Postgres of the job pg: row-level security enabled and forced with a policy for sai_app on every table
// with org_id (orgs by its id), three organisations behind the tx.js helpers, 20 parallel tenant transactions
// over a pool, the append-only audit log for sai_app and for the owner, and the grants of the app roles.

/**
 * A fresh database migrated by the runner with a password for sai_app_login.
 * @param {import("node:test").TestContext} t
 */
async function migrated(t) {
  const db = await freshDatabase(t);
  const pw = newPassword();
  const m = spawnSync(process.execPath, ["server/db/migrate.js"], {
    cwd: APP,
    env: childEnv({
      DATABASE_URL: url("postgres", admin().password, db),
      APP_DB_PASSWORD: pw,
    }),
    encoding: "utf8",
  });
  assert.equal(m.status, 0, m.stderr);
  return { db, pw };
}

/**
 * The tenant tables, read from the catalogue at test time: every table of public with an org_id column, and
 * orgs (checked by its id with the same rule).
 * @param {import("pg").Client} c
 * @returns {Promise<string[]>}
 */
async function tenantTables(c) {
  const rows = (
    await c.query(
      "select distinct k.table_name as t from information_schema.columns k join information_schema.tables x on x.table_schema = k.table_schema and x.table_name = k.table_name where k.table_schema = 'public' and k.column_name = 'org_id' and x.table_type = 'BASE TABLE' order by 1",
    )
  ).rows.map((r) => /** @type {string} */ (r.t));
  return ["orgs", ...rows.filter((x) => x !== "orgs")];
}

/**
 * The findings of RLS-1: a tenant table without row security enabled, forced, or a policy that applies to
 * sai_app; a table of public owned by an app role.
 * @param {import("pg").Client} c
 * @returns {Promise<{ count: number, findings: string[] }>}
 */
export async function rlsFindings(c) {
  const findings = [];
  const tables = await tenantTables(c);
  for (const t of tables) {
    const [row] = (
      await c.query(
        "select c.relrowsecurity as rls, c.relforcerowsecurity as forced, (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and ('sai_app' = any (p.roles) or 'public' = any (p.roles))) as policies from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = $1",
        [t],
      )
    ).rows;
    if (!row?.rls) findings.push(`${t}: row security not enabled`);
    if (!row?.forced) findings.push(`${t}: row security not forced`);
    if (!(row?.policies > 0)) findings.push(`${t}: no policy for sai_app`);
  }
  for (const r of (
    await c.query(
      "select c.relname as t, pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f') and pg_get_userbyid(c.relowner) in ('sai_app', 'sai_preview', 'sai_app_login') order by 1",
    )
  ).rows)
    findings.push(`${r.t}: owned by ${r.owner}`);
  return { count: tables.length - 1, findings };
}

test("RLS-1 every table with org_id has row security enabled and forced with a policy for sai_app (orgs by its id); a planted table is reported by name; no table is owned by an app role", async (t) => {
  const { db } = await migrated(t);
  const c = await client(db);
  try {
    const r = await rlsFindings(c);
    t.diagnostic(`RLS-1: ${r.count} tables with org_id, and orgs`);
    assert.ok(r.count >= 3, `${r.count}`);
    assert.deepEqual(r.findings, []);
    for (const name of ["org_members", "invites", "audit_log"])
      assert.ok((await tenantTables(c)).includes(name), name);
  } finally {
    await c.end();
  }
  // A copy of the schema in a fresh database with planted tables: each is reported by name.
  const second = await migrated(t);
  const d = await client(second.db);
  try {
    await d.query(
      "create table planted_none (id integer primary key, org_id uuid)",
    );
    await d.query(
      "create table planted_soft (id integer primary key, org_id uuid)",
    );
    await d.query("alter table planted_soft enable row level security");
    await d.query(
      "create policy planted_soft_p on planted_soft for all to sai_app using (true)",
    );
    await d.query(
      "create table planted_bare (id integer primary key, org_id uuid)",
    );
    await d.query("alter table planted_bare enable row level security");
    await d.query("alter table planted_bare force row level security");
    await d.query("create table planted_owned (x integer)");
    await d.query("alter table planted_owned owner to sai_app");
    assert.deepEqual((await rlsFindings(d)).findings, [
      "planted_bare: no policy for sai_app",
      "planted_none: row security not enabled",
      "planted_none: row security not forced",
      "planted_none: no policy for sai_app",
      "planted_soft: row security not forced",
      "planted_owned: owned by sai_app",
    ]);
  } finally {
    await d.end();
  }
});

const A = "a1111111-1111-4111-8111-111111111111";
const B = "b2222222-2222-4222-8222-222222222222";
const C = "c3333333-3333-4333-8333-333333333333";
const ORGS = /** @type {const} */ ([A, B, C]);
const HASH = `scrypt$17$8$1$${"A".repeat(22)}$${"A".repeat(86)}`;
const hex = (/** @type {string} */ ch) => ch.repeat(64);

/**
 * Three organisations with rows in every tenant table (written as the owner, past row security): per
 * organisation a user with a membership, an invite and two audit rows; and one user without a membership.
 * @param {import("pg").Client} c
 */
async function fixture(c) {
  /** @type {Record<string, string>} */
  const users = {};
  let n = 0;
  for (const org of ORGS) {
    n += 1;
    await c.query(
      "insert into orgs (id, name, kind) values ($1, $2, 'customer')",
      [org, `Org ${n}`],
    );
    const [u] = (
      await c.query(
        "insert into users (email, email_norm, display_name, password_hash) values ($1, $1, 'User', $2) returning id",
        [`u${n}@example.test`, HASH],
      )
    ).rows;
    users[org] = u.id;
    await c.query(
      "insert into org_members (org_id, user_id, role) values ($1, $2, 'member')",
      [org, u.id],
    );
    await c.query(
      "insert into invites (org_id, email_norm, role, code_hash, expires_at, created_by) values ($1, $2, 'viewer', $3, now() + interval '1 day', $4)",
      [org, `i${n}@example.test`, hex(String(n)), u.id],
    );
    for (const k of [1, 2])
      await c.query(
        "insert into audit_log (id, org_id, actor_kind, action, prev_hash, hash, created_at) values (nextval('audit_log_id_seq'), $1, 'system', 'auth.login_failed', $2, $3, now())",
        [org, hex("0"), hex(String(n * 2 + k))],
      );
  }
  const [free] = (
    await c.query(
      "insert into users (email, email_norm, display_name, password_hash) values ('free@example.test', 'free@example.test', 'Free', $1) returning id",
      [HASH],
    )
  ).rows;
  return { users, free: /** @type {string} */ (free.id) };
}

/** The column that names a row's organisation. @param {string} table */
const orgColumn = (table) => (table === "orgs" ? "id" : "org_id");

/**
 * The row count of every tenant table, read by the owner.
 * @param {import("pg").Client} c
 * @param {string[]} tables
 */
async function counts(c, tables) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const t of tables)
    out[t] = (await c.query(`select count(*)::int as n from ${t}`)).rows[0].n;
  return out;
}

/**
 * The app's database as sai_app_login over a pool of `max` connections.
 * @param {import("node:test").TestContext} t
 * @param {{ db: string, pw: string }} m
 * @param {number} max
 */
function appDb(t, m, max) {
  const db = createDb(
    createPgAdapter(url("sai_app_login", m.pw, m.db), {
      connectTimeoutMs: 5000,
      max,
    }),
  );
  t.after(() => db.close());
  return db;
}

/** @param {Promise<unknown>} p */
const sqlstateOf = (p) =>
  p.then(
    () => "allowed",
    (e) => /** @type {any} */ (e).sqlstate ?? String(e),
  );

test("RLS-2 three organisations: under withTenant(A) every tenant table shows only A's rows (audit_log none); without app.org_id none; a write with B's organisation is refused and every count stays", async (t) => {
  const m = await migrated(t);
  const c = await client(m.db);
  t.after(() => c.end());
  const { users, free } = await fixture(c);
  const tables = await tenantTables(c);
  // Every listed table has rows of each organisation (a table without its fixture rows fails here).
  for (const table of tables)
    for (const org of ORGS)
      assert.ok(
        (
          await c.query(
            `select count(*)::int as n from ${table} where ${orgColumn(table)} = $1`,
            [org],
          )
        ).rows[0].n > 0,
        `${table} has no row of ${org}`,
      );
  const db = appDb(t, m, 4);
  for (const org of ORGS) {
    const seen = await withTenant(db, org, async (q) => {
      /** @type {Record<string, string[]>} */
      const out = {};
      for (const table of tables)
        out[table] = (
          await q.query(`select ${orgColumn(table)}::text as o from ${table}`)
        ).rows.map((r) => r.o);
      return out;
    });
    for (const table of tables)
      if (table === "audit_log")
        assert.deepEqual(seen[table], [], `${org} ${table}`);
      else {
        assert.ok(seen[table].length > 0, `${org} ${table}`);
        assert.ok(
          seen[table].every((o) => o === org),
          `${org} ${table}: ${seen[table]}`,
        );
      }
  }
  // A transaction under sai_app without app.org_id (and without app.role) sees no row of any tenant table.
  const none = await db.transaction(
    async (q) => {
      await q.query("set local role sai_app");
      /** @type {Record<string, number>} */
      const out = {};
      for (const table of tables)
        out[table] = (
          await q.query(`select count(*)::int as n from ${table}`)
        ).rows[0].n;
      return out;
    },
    { deadlineAt: performance.now() + TX_DEADLINE_MS },
  );
  assert.deepEqual(none, Object.fromEntries(tables.map((x) => [x, 0])));
  // Writes under withTenant(A) that carry B's organisation: an INSERT and an UPDATE that sets it, for every
  // tenant table but audit_log. Each is refused (42501) and no count changes.
  /** @type {Record<string, Array<[string, string, unknown[]]>>} */
  const writes = {
    orgs: [
      [
        "insert",
        "insert into orgs (id, name, kind) values ($1, 'Planted', 'customer')",
        [B],
      ],
      ["update", "update orgs set id = $1 where id = $2", [B, A]],
    ],
    org_members: [
      [
        "insert",
        "insert into org_members (org_id, user_id, role) values ($1, $2, 'viewer')",
        [B, free],
      ],
      [
        "update",
        "update org_members set org_id = $1 where org_id = $2",
        [B, A],
      ],
    ],
    invites: [
      [
        "insert",
        "insert into invites (org_id, email_norm, role, code_hash, expires_at, created_by) values ($1, 'p@example.test', 'viewer', $2, now() + interval '1 day', $3)",
        [B, hex("e"), users[A]],
      ],
      ["update", "update invites set org_id = $1 where org_id = $2", [B, A]],
    ],
  };
  for (const table of tables.filter((x) => x !== "audit_log"))
    assert.ok(writes[table], `no refused writes for the tenant table ${table}`);
  const before = await counts(c, tables);
  for (const [table, list] of Object.entries(writes))
    for (const [kind, text, params] of list) {
      const state = await sqlstateOf(
        withTenant(db, A, (q) => q.query(text, params)),
      );
      assert.equal(state, "42501", `${table} ${kind}`);
      assert.deepEqual(await counts(c, tables), before, `${table} ${kind}`);
    }
  // The refusals are those of row security, not of a missing grant: the same statements in a session of
  // sai_app with the settings of A name the policy (invites has the UPDATE grant; every table has INSERT).
  const s = await client(m.db, "sai_app_login", m.pw);
  try {
    for (const [table, list] of Object.entries(writes))
      for (const [kind, text, params] of list) {
        if (kind === "update" && table !== "invites") continue;
        await s.query("begin");
        await s.query("set local role sai_app");
        await s.query(
          "select set_config('app.org_id', $1, true), set_config('app.role', 'tenant', true)",
          [A],
        );
        const err = await s.query(text, params).then(
          () => null,
          (e) => e,
        );
        await s.query("rollback");
        assert.ok(err, `${table} ${kind} allowed`);
        assert.match(
          String(err.message),
          /row-level security/,
          `${table} ${kind}`,
        );
      }
  } finally {
    await s.end();
  }
  assert.deepEqual(await counts(c, tables), before);
});

test("RLS-3 20 parallel withTenant transactions for A, B and C over a pool of 4 each read only their own organisation's rows", async (t) => {
  const m = await migrated(t);
  const c = await client(m.db);
  t.after(() => c.end());
  await fixture(c);
  const tables = (await tenantTables(c)).filter((x) => x !== "audit_log");
  const db = appDb(t, m, 4);
  const runs = Array.from({ length: 20 }, (_, i) => ORGS[i % 3]);
  const seen = await Promise.all(
    runs.map((org, i) =>
      withTenant(db, org, async (q) => {
        const [who] = (
          await q.query(
            "select current_setting('app.org_id', true) as o, pg_backend_pid() as pid",
          )
        ).rows;
        // A short wait inside the transaction, so the transactions overlap on the pool.
        await q.query("select pg_sleep($1::float8)", [0.02 + (i % 4) * 0.01]);
        /** @type {string[]} */
        const orgs = [];
        for (const table of tables)
          for (const r of (
            await q.query(`select ${orgColumn(table)}::text as o from ${table}`)
          ).rows)
            orgs.push(r.o);
        return { org, who: who.o, pid: who.pid, orgs };
      }),
    ),
  );
  for (const x of seen) {
    assert.equal(x.who, x.org);
    assert.ok(x.orgs.length >= tables.length, JSON.stringify(x));
    assert.ok(
      x.orgs.every((o) => o === x.org),
      JSON.stringify(x),
    );
  }
  // The transactions ran on more than one connection of the pool, so the settings had a chance to leak.
  const pids = new Set(seen.map((x) => x.pid));
  assert.ok(pids.size >= 2, `${pids.size} connections`);
});

test("RLS-4 audit_log: UPDATE, DELETE and TRUNCATE are refused for sai_app and for the owner; SELECT shows no row to a tenant and every row to the platform; the count stays", async (t) => {
  const m = await migrated(t);
  const c = await client(m.db);
  t.after(() => c.end());
  await fixture(c);
  const total = async () =>
    (await c.query("select count(*)::int as n from audit_log")).rows[0].n;
  const n = await total();
  assert.equal(n, 6);
  const db = appDb(t, m, 2);
  const statements = [
    "update audit_log set action = 'auth.logout'",
    "delete from audit_log",
    "truncate audit_log",
  ];
  for (const text of statements) {
    for (const run of [
      (/** @type {string} */ s) => withPlatform(db, (q) => q.query(s)),
      (/** @type {string} */ s) => withTenant(db, A, (q) => q.query(s)),
    ])
      assert.equal(await sqlstateOf(run(text)), "42501", `sai_app: ${text}`);
    assert.equal(await total(), n);
    // The owner (the role that ran the migrations) meets the trigger.
    const [{ owner }] = (
      await c.query(
        "select pg_get_userbyid(relowner) as owner from pg_class where relname = 'audit_log'",
      )
    ).rows;
    assert.equal(owner, "postgres");
    const err = await c.query(text).then(
      () => null,
      (e) => e,
    );
    assert.ok(err, `owner: ${text} allowed`);
    assert.equal(err.code, "P0001", `owner: ${text}`);
    assert.equal(await total(), n);
  }
  const tenantRows = await withTenant(
    db,
    A,
    async (q) => (await q.query("select id from audit_log")).rows,
  );
  assert.deepEqual(tenantRows, []);
  const platformRows = await withPlatform(
    db,
    async (q) => (await q.query("select id from audit_log")).rows,
  );
  assert.equal(platformRows.length, n);
  // Without app.role the SELECT policy shows nothing either.
  const bare = await db.transaction(
    async (q) => {
      await q.query("set local role sai_app");
      return (await q.query("select id from audit_log")).rows;
    },
    { deadlineAt: performance.now() + TX_DEADLINE_MS },
  );
  assert.deepEqual(bare, []);
  assert.equal(await total(), n);
});

// The least grants of 4.2.3 (written here from the design): table → privileges of sai_app.
const GRANTS = {
  audit_log: ["INSERT", "SELECT"],
  auth_sessions: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  invites: ["INSERT", "SELECT", "UPDATE"],
  login_delays: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  login_failures: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  org_members: ["INSERT", "SELECT"],
  orgs: ["INSERT", "SELECT"],
  password_resets: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  platform_settings: ["INSERT", "SELECT"],
  rate_limits: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  reauth_tokens: ["DELETE", "INSERT", "SELECT", "UPDATE"],
  schema_migrations: ["SELECT"],
  users: ["INSERT", "SELECT", "UPDATE"],
};

test("RLS-5 the grants of the app roles equal the table of the design: sai_app exactly those privileges and usage of audit_log_id_seq; sai_preview nothing on any table", async (t) => {
  const { db } = await migrated(t);
  const c = await client(db);
  try {
    const grants = async (/** @type {string} */ role) =>
      (
        await c.query(
          "select table_name as t, privilege_type as p from information_schema.role_table_grants where table_schema = 'public' and grantee = $1 order by 1, 2",
          [role],
        )
      ).rows.map((r) => `${r.t} ${r.p}`);
    const want = Object.entries(GRANTS)
      .flatMap(([table, list]) => list.map((p) => `${table} ${p}`))
      .sort();
    assert.deepEqual((await grants("sai_app")).sort(), want);
    assert.deepEqual(await grants("sai_preview"), []);
    assert.deepEqual(await grants("sai_app_login"), []);
    // Every table of the schema is in the table (a new table without its line is red).
    const tables = (
      await c.query(
        "select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1",
      )
    ).rows.map((r) => r.t);
    assert.deepEqual(tables, Object.keys(GRANTS).sort());
    const seq = (
      await c.query(
        "select c.relname || ' ' || pg_get_userbyid(a.grantee) || ' ' || a.privilege_type as g from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join lateral aclexplode(c.relacl) a where n.nspname = 'public' and c.relkind = 'S' order by 1",
      )
    ).rows.map((r) => r.g);
    assert.deepEqual(
      seq.filter((g) => !g.includes(" postgres ")),
      ["audit_log_id_seq sai_app USAGE"],
    );
  } finally {
    await c.end();
  }
});
