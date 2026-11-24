import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../../server/db/migrate.js";
import { openPglite } from "../../server/db/pglite.js";
import { APP, childEnv, tempDir } from "../fixtures/helpers.js";

// REQ-108 criterion 7 (PGlite) and the PGlite part of criterion 8 (the password form, decisions/0116 О24);
// REQ-115 guard rows (2) and (9) and the grants step of decisions/0137 О1 (the code design M2AUTH, 4.2.4: MG-6,
// MG-7; the guard edits A16, A17). The migration files are read at test time, so 0003 and later join MG-1.

const MIGRATIONS = path.join(APP, "db", "migrations");
const run = (/** @type {Record<string, string>} */ env) =>
  spawnSync(process.execPath, ["server/db/migrate.js"], {
    cwd: APP,
    env: childEnv(env),
    encoding: "utf8",
  });

/** @param {string} dir */
async function state(dir) {
  const db = new PGlite(dir);
  const rows = (
    await db.query(
      "select name, sha256, applied_at::text as at from schema_migrations order by name",
    )
  ).rows;
  const tables = (
    await db.query(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    )
  ).rows;
  const cols = (
    await db.query(
      "select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' order by 1, 2",
    )
  ).rows;
  const settings = (
    await db.query("select count(*)::int as n from platform_settings")
  ).rows[0];
  await db.close();
  return { rows, tables, cols, settings };
}

// The tables of 0001 and 0002 (0002 has eleven; the code design M2AUTH, 4.2 and B7a), sorted.
const TABLES = [
  "audit_log",
  "auth_sessions",
  "invites",
  "login_delays",
  "login_failures",
  "org_members",
  "orgs",
  "password_resets",
  "platform_settings",
  "rate_limits",
  "reauth_tokens",
  "schema_migrations",
  "users",
];

/** Every migration file in name order with the sha256 of its bytes, computed here. */
const filesWithSha = () =>
  fs
    .readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((n) => [
      n,
      createHash("sha256")
        .update(fs.readFileSync(path.join(MIGRATIONS, n)))
        .digest("hex"),
    ]);

test("MG-1 from an empty database every migration is applied once, in name order; a second run applies nothing", async (t) => {
  const dir = path.join(tempDir(t), "pgl");
  const a = run({ PGLITE_DIR: dir });
  assert.equal(a.status, 0, a.stderr);
  const s1 = await state(dir);
  const files = filesWithSha();
  assert.ok(files.length >= 2, files.join(", "));
  assert.deepEqual(
    s1.rows.map((r) => [r.name, r.sha256]),
    files,
  );
  // Each file was applied, in name order, by its own log line.
  assert.deepEqual(
    a.stdout.split("\n").filter((l) => l.startsWith("migrate: applied ")),
    files.map(([n]) => `migrate: applied ${n}`),
  );
  assert.deepEqual(
    s1.tables.map((r) => r.table_name),
    TABLES,
  );
  // The columns of the two tables of 0001 with their types (criterion 7 names `value jsonb`).
  assert.deepEqual(
    s1.cols
      .filter((r) =>
        ["platform_settings", "schema_migrations"].includes(r.table_name),
      )
      .map((r) => `${r.table_name}.${r.column_name} ${r.data_type}`),
    [
      "platform_settings.key text",
      "platform_settings.updated_at timestamp with time zone",
      "platform_settings.updated_by uuid",
      "platform_settings.value jsonb",
      "schema_migrations.applied_at timestamp with time zone",
      "schema_migrations.name text",
      "schema_migrations.sha256 text",
    ],
  );
  assert.equal(s1.settings.n, 0);
  const b = run({ PGLITE_DIR: dir });
  assert.equal(b.status, 0);
  assert.match(b.stdout, /^migrate: nothing to apply$/m);
  assert.deepEqual(await state(dir), s1);
});

/** @param {import("node:test").TestContext} t */
function copyMigrations(t) {
  const dir = path.join(tempDir(t), "m");
  fs.mkdirSync(dir);
  fs.copyFileSync(
    path.join(MIGRATIONS, "0001_init.sql"),
    path.join(dir, "0001_init.sql"),
  );
  return dir;
}

test("MG-2 failures leave the state unchanged", async (t) => {
  const dir = path.join(tempDir(t), "pgl");
  const m = copyMigrations(t);
  assert.equal(run({ PGLITE_DIR: dir, MIGRATIONS_DIR: m }).status, 0);
  const before = await state(dir);
  fs.writeFileSync(
    path.join(m, "9999_bad.sql"),
    "create table t_first (x int);\nselect * from no_such_table;\n",
  );
  const a = run({ PGLITE_DIR: dir, MIGRATIONS_DIR: m });
  assert.notEqual(a.status, 0);
  assert.deepEqual(await state(dir), before);
  fs.rmSync(path.join(m, "9999_bad.sql"));
  fs.appendFileSync(path.join(m, "0001_init.sql"), "\n-- changed\n");
  const b = run({ PGLITE_DIR: dir, MIGRATIONS_DIR: m });
  assert.notEqual(b.status, 0);
  assert.equal(b.stderr.trim().split("\n").length, 1);
  assert.match(b.stderr, /0001_init\.sql/);
  assert.deepEqual(await state(dir), before);
  const m2 = copyMigrations(t);
  fs.writeFileSync(path.join(m2, "2_Bad-name.sql"), "select 1;\n");
  const c = run({ PGLITE_DIR: dir, MIGRATIONS_DIR: m2 });
  assert.notEqual(c.status, 0);
  assert.deepEqual(await state(dir), before);
});

test("MG-3 the password form on PGlite: the value only among bound parameters; no error carries it", async () => {
  const value = ["pw", "MARK", String(Date.now())].join("-");
  const adapter = await openPglite(null);
  /** @type {Array<{ text: string, params: unknown[] }>} */
  const log = [];
  const rec = {
    query: (/** @type {string} */ text, /** @type {unknown[]} */ params) => (
      log.push({ text, params: params ?? [] }),
      adapter.query(text, params)
    ),
    exec: (/** @type {string} */ text) => (
      log.push({ text, params: [] }),
      adapter.exec(text)
    ),
    close: () => adapter.close(),
  };
  const lines = [];
  await migrate({
    adapter: rec,
    dir: MIGRATIONS,
    password: value,
    log: (l) => lines.push(l),
  });
  assert.ok(log.every((e) => !e.text.includes(value)));
  assert.ok(log.some((e) => e.params.includes(value)));
  assert.ok(!lines.join("\n").includes(value));
  const roles = (
    await adapter.query(
      "select rolname, rolcanlogin, rolsuper, rolbypassrls from pg_roles where rolname like 'sai%' order by 1",
    )
  ).rows;
  assert.deepEqual(roles, [
    {
      rolname: "sai_app",
      rolcanlogin: false,
      rolsuper: false,
      rolbypassrls: false,
    },
    {
      rolname: "sai_app_login",
      rolcanlogin: true,
      rolsuper: false,
      rolbypassrls: false,
    },
    {
      rolname: "sai_preview",
      rolcanlogin: false,
      rolsuper: false,
      rolbypassrls: false,
    },
  ]);
  assert.match(
    (
      await adapter.query(
        "select rolpassword from pg_authid where rolname = 'sai_app_login'",
      )
    ).rows[0].rolpassword,
    /^SCRAM-SHA-256\$/,
  );
  await adapter.exec("drop role sai_app_login");
  await assert.rejects(
    migrate({ adapter: rec, dir: MIGRATIONS, password: value }),
    (e) => !JSON.stringify({ m: e.message, s: e.stack }).includes(value),
  );
  await adapter.close();
});

test("MG-4 the guarded block: a failing password statement gives an error with no value in any field", async () => {
  const { PASSWORD_BLOCK } = await import("../../server/db/migrate.js");
  const db = new PGlite();
  const value = ["pw", "MARK", "guard"].join("-");
  await db.exec("begin");
  await db.query("select set_config('sai.app_db_password', $1, true)", [value]);
  const err = await db.exec(PASSWORD_BLOCK).then(
    () => null,
    (e) => e,
  );
  assert.ok(err, "the block must fail: sai_app_login does not exist here");
  for (const k of Object.getOwnPropertyNames(err))
    assert.ok(!String(err[k]).includes(value), k);
  assert.equal(err.code, "P0001");
  await db.exec("rollback");
  await db.close();
});

test("MG-5 without APP_DB_PASSWORD sai_app_login has no password; the roles and the membership of criterion 8", async (t) => {
  const dir = path.join(tempDir(t), "pgl");
  const r = run({ PGLITE_DIR: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^migrate: applied 0001_init\.sql$/m);
  assert.match(r.stdout, /^migrate: the grants are set$/m);
  assert.doesNotMatch(r.stdout, /password/);
  const db = new PGlite(dir);
  const roles = (
    await db.query(
      "select a.rolname, a.rolcanlogin, a.rolsuper, a.rolbypassrls, a.rolpassword is null as no_password from pg_authid a where a.rolname like 'sai%' order by 1",
    )
  ).rows;
  const member = (
    await db.query(
      "select b.rolname from pg_auth_members m join pg_roles a on a.oid = m.member join pg_roles b on b.oid = m.roleid where a.rolname = 'sai_app_login' order by 1",
    )
  ).rows.map((x) => /** @type {any} */ (x).rolname);
  await db.close();
  assert.deepEqual(roles, [
    {
      rolname: "sai_app",
      rolcanlogin: false,
      rolsuper: false,
      rolbypassrls: false,
      no_password: true,
    },
    {
      rolname: "sai_app_login",
      rolcanlogin: true,
      rolsuper: false,
      rolbypassrls: false,
      no_password: true,
    },
    {
      rolname: "sai_preview",
      rolcanlogin: false,
      rolsuper: false,
      rolbypassrls: false,
      no_password: true,
    },
  ]);
  assert.deepEqual(member, ["sai_app", "sai_preview"]);
});

// The least grants of the app roles (the code design M2AUTH, 4.2.3), written here as the oracle of MG-6: every
// privilege of sai_app on a relation of the public schema, as `<relation> <privilege>`, sorted.
const APP_GRANTS = [
  ...["INSERT", "SELECT"].map((p) => `audit_log ${p}`),
  "audit_log_id_seq USAGE",
  ...["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => `auth_sessions ${p}`),
  ...["INSERT", "SELECT", "UPDATE"].map((p) => `invites ${p}`),
  ...["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => `login_delays ${p}`),
  ...["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => `login_failures ${p}`),
  ...["INSERT", "SELECT"].map((p) => `org_members ${p}`),
  ...["INSERT", "SELECT"].map((p) => `orgs ${p}`),
  ...["DELETE", "INSERT", "SELECT", "UPDATE"].map(
    (p) => `password_resets ${p}`,
  ),
  ...["INSERT", "SELECT"].map((p) => `platform_settings ${p}`),
  ...["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => `rate_limits ${p}`),
  ...["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => `reauth_tokens ${p}`),
  "schema_migrations SELECT",
  ...["INSERT", "SELECT", "UPDATE"].map((p) => `users ${p}`),
].sort();
// The grants of a database built from 0001 alone: those of its own two tables.
const GRANTS_0001 = [
  "platform_settings INSERT",
  "platform_settings SELECT",
  "schema_migrations SELECT",
];

/**
 * The privileges of the app roles as granted (read from the access lists, not from the code): every
 * `<relation> <privilege>` of sai_app and of sai_preview on the public schema's relations, and the schema
 * privileges of both.
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} db
 */
async function grantsOf(db) {
  const rel = async (/** @type {string} */ role) =>
    (
      await db.query(
        "select c.relname || ' ' || a.privilege_type as g from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join lateral aclexplode(c.relacl) a where n.nspname = 'public' and a.grantee = (select oid from pg_roles where rolname = $1) order by 1",
        [role],
      )
    ).rows
      .map((r) => /** @type {string} */ (r.g))
      .sort();
  const schema = (
    await db.query(
      "select r.rolname || ' ' || a.privilege_type as g from pg_namespace n cross join lateral aclexplode(n.nspacl) a join pg_roles r on r.oid = a.grantee where n.nspname = 'public' and r.rolname in ('sai_app', 'sai_preview') order by 1",
    )
  ).rows
    .map((r) => /** @type {string} */ (r.g))
    .sort();
  return {
    app: await rel("sai_app"),
    preview: await rel("sai_preview"),
    schema,
  };
}

/** @param {string} dir a PGlite folder */
async function grantsIn(dir) {
  const db = new PGlite(dir);
  try {
    return await grantsOf(db);
  } finally {
    await db.close();
  }
}

const SCHEMA_GRANTS = ["sai_app USAGE", "sai_preview USAGE"];

test("MG-6 the grants step: revoked grants come back by one run; a database of 0001 alone gets the grants of its own tables and no error; a failing grants file is refused and changes no grant", async (t) => {
  // (a) Every grant of the design's table after a migrate run; revoked, they come back by one more run.
  const dir = path.join(tempDir(t), "pgl");
  const first = run({ PGLITE_DIR: dir });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /^migrate: the grants are set$/m);
  const want = { app: APP_GRANTS, preview: [], schema: SCHEMA_GRANTS };
  assert.deepEqual(await grantsIn(dir), want);
  const db = new PGlite(dir);
  await db.exec(
    "revoke all on all tables in schema public from sai_app, sai_preview; revoke all on all sequences in schema public from sai_app, sai_preview; revoke all on schema public from sai_app, sai_preview",
  );
  const revoked = await grantsOf(db);
  await db.close();
  assert.deepEqual(revoked, { app: [], preview: [], schema: [] });
  const again = run({ PGLITE_DIR: dir });
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /^migrate: nothing to apply$/m);
  assert.match(again.stdout, /^migrate: the grants are set$/m);
  assert.deepEqual(await grantsIn(dir), want);

  // (b) MIGRATIONS_DIR with 0001 alone: exit 0, the grants line, exactly the grants of its own two tables;
  // the newest migrations applied later bring theirs (the rehearsal's database B).
  const old = path.join(tempDir(t), "pgl-0001");
  const only = copyMigrations(t);
  const r = run({ PGLITE_DIR: old, MIGRATIONS_DIR: only });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /^migrate: the grants are set$/m);
  assert.deepEqual(await grantsIn(old), {
    app: GRANTS_0001,
    preview: [],
    schema: SCHEMA_GRANTS,
  });
  const later = run({ PGLITE_DIR: old });
  assert.equal(later.status, 0, later.stderr);
  assert.deepEqual(await grantsIn(old), want);

  // (c) In-process, a planted grants file whose second block names a missing table without the guard: the
  // run rejects with E_MIGRATE_GRANTS, and no grant changed, also not those of the first block.
  const adapter = await openPglite(null);
  t.after(() => adapter.close());
  await migrate({ adapter, dir: MIGRATIONS, password: null });
  await adapter.exec("revoke all on public.users from sai_app");
  const before = await grantsOf(adapter);
  assert.ok(!before.app.some((g) => g.startsWith("users ")));
  const real = fs.readFileSync(path.join(APP, "db", "grants.sql"), "utf8");
  const blocks = [...real.matchAll(/do \$\$ begin[\s\S]*?end \$\$;/g)];
  assert.ok(blocks.length >= 2, "the grants file has blocks");
  assert.match(blocks[0][0], /public\.users/);
  const planted = path.join(tempDir(t), "grants.sql");
  fs.writeFileSync(
    planted,
    real.replace(
      blocks[1][0],
      () => "grant select, insert on public.no_such_table to sai_app;",
    ),
  );
  /** @type {string[]} */
  const lines = [];
  await assert.rejects(
    migrate({
      adapter,
      dir: MIGRATIONS,
      password: null,
      grantsFile: planted,
      log: (l) => lines.push(l),
    }),
    (e) =>
      /** @type {any} */ (e).code === "E_MIGRATE_GRANTS" &&
      /** @type {Error} */ (e).message ===
        "migrate: refused: the grants step failed",
  );
  assert.ok(!lines.includes("migrate: the grants are set"), lines.join("\n"));
  assert.deepEqual(await grantsOf(adapter), before);
  // The real file afterwards gives every grant back.
  await migrate({ adapter, dir: MIGRATIONS, password: null });
  assert.deepEqual((await grantsOf(adapter)).app, APP_GRANTS);
});

/**
 * The text of an SQL file without its `--` comments, its white space folded to one blank.
 * @param {string} text
 */
const sqlCode = (text) =>
  text
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();

const SCHEMA_LINES = [
  "grant usage on schema public to sai_app, sai_preview",
  "grant select on schema_migrations to sai_app",
];

/**
 * The findings of the file rules of app/db/grants.sql (the code design M2AUTH, 4.2.4 and H1).
 * @param {string} grants the text of grants.sql
 * @param {Map<string, string>} migrations the migration files by name
 * @returns {string[]}
 */
export function grantsFindings(grants, migrations) {
  const out = [];
  /** @type {Map<string, string>} */
  const tables = new Map();
  /** @type {Map<string, string>} */
  const sequences = new Map();
  for (const [name, text] of migrations) {
    const code = sqlCode(text);
    for (const m of code.matchAll(
      /\bcreate table (?:if not exists )?([a-z_][a-z0-9_]*)/gi,
    ))
      tables.set(m[1], name);
    for (const m of code.matchAll(
      /\bcreate sequence (?:if not exists )?([a-z_][a-z0-9_]*)/gi,
    ))
      sequences.set(m[1], name);
    const grantsHere = code
      .split(";")
      .map((x) => x.trim())
      .filter((x) => /^grant\b/i.test(x));
    if (name === "0001_init.sql") {
      if (
        JSON.stringify(grantsHere) !==
        JSON.stringify([
          "grant sai_app to sai_app_login",
          "grant sai_preview to sai_app_login",
          ...SCHEMA_LINES,
        ])
      )
        out.push("0001_init.sql: not its four grants");
    } else if (/\bgrant\b/i.test(code)) out.push(`${name} holds a grant`);
  }
  const code = sqlCode(grants);
  if (/\bexecute\b/i.test(code)) out.push("grants.sql holds execute");
  const blockRe =
    /do \$\$ begin if to_regclass\('public\.([a-z_][a-z0-9_]*)'\) is not null then (.*?) end if; end \$\$;/g;
  /** @type {string[]} */
  const seen = [];
  for (const m of code.matchAll(blockRe)) {
    const table = m[1];
    if (seen.includes(table)) out.push(`block ${table}: a second block`);
    seen.push(table);
    if (!tables.has(table))
      out.push(`block ${table}: no migration creates the table`);
    for (const st of m[2]
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean)) {
      const g =
        /^grant [a-z]+(?:, [a-z]+)* on (sequence )?public\.([a-z_][a-z0-9_]*) to sai_app$/.exec(
          st,
        );
      const ok =
        g !== null &&
        (g[1]
          ? g[2].startsWith(`${table}_`) &&
            g[2].endsWith("_seq") &&
            sequences.get(g[2]) === tables.get(table)
          : g[2] === table);
      if (!ok) out.push(`block ${table}: ${st}`);
    }
  }
  const rest = code
    .replace(blockRe, "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  if (JSON.stringify(rest) !== JSON.stringify(SCHEMA_LINES))
    for (const st of rest.filter((x) => !SCHEMA_LINES.includes(x)))
      out.push(`outside a block: ${st}`);
  for (const line of SCHEMA_LINES)
    if (!rest.includes(line)) out.push(`missing: ${line}`);
  for (const table of [...tables.keys()].sort())
    if (table !== "schema_migrations" && !seen.includes(table))
      out.push(`no block for ${table}`);
  return out;
}

test("MG-7 the file rules of app/db/grants.sql: each block names a table of a migration and grants on it or its sequence only; no grant outside a block but the two schema lines; no execute; no migration but 0001 holds a grant", () => {
  const grants = fs.readFileSync(path.join(APP, "db", "grants.sql"), "utf8");
  const migrations = new Map(
    fs
      .readdirSync(MIGRATIONS)
      .filter((n) => n.endsWith(".sql"))
      .sort()
      .map((n) => [n, fs.readFileSync(path.join(MIGRATIONS, n), "utf8")]),
  );
  assert.deepEqual(grantsFindings(grants, migrations), []);
  const block = (/** @type {string} */ table) => {
    const m = new RegExp(
      `do \\$\\$ begin\\n  if to_regclass\\('public\\.${table}'\\)[\\s\\S]*?end \\$\\$;\\n`,
    ).exec(grants);
    assert.ok(m, `the block of ${table}`);
    return m[0];
  };
  const swap = (/** @type {string} */ a, /** @type {string} */ b) => {
    assert.ok(grants.includes(a), a);
    return grants.replace(a, () => b);
  };
  /** @type {Array<[string, string, Map<string, string>]>} */
  const cases = [
    // M49: a block that names a misspelt table.
    [
      "block user: no migration creates the table",
      swap("to_regclass('public.users')", "to_regclass('public.user')"),
      migrations,
    ],
    [
      "block orgs: grant select, insert on public.users to sai_app",
      swap(
        "grant select, insert on public.orgs to sai_app;",
        "grant select, insert on public.users to sai_app;",
      ),
      migrations,
    ],
    [
      "block users: grant usage on sequence public.audit_log_id_seq to sai_app",
      swap(
        "grant select, insert, update on public.users to sai_app;",
        "grant select, insert, update on public.users to sai_app;\n    grant usage on sequence public.audit_log_id_seq to sai_app;",
      ),
      migrations,
    ],
    [
      "outside a block: grant select on public.users to sai_app",
      `${grants}\ngrant select on public.users to sai_app;\n`,
      migrations,
    ],
    [
      "grants.sql holds execute",
      swap(
        "grant select, insert on public.orgs to sai_app;",
        "execute 'grant select, insert on public.orgs to sai_app';",
      ),
      migrations,
    ],
    [
      "missing: grant select on schema_migrations to sai_app",
      swap("grant select on schema_migrations to sai_app;\n", ""),
      migrations,
    ],
    [
      "no block for login_failures",
      swap(block("login_failures"), ""),
      migrations,
    ],
    ["block users: a second block", `${grants}\n${block("users")}`, migrations],
    [
      "0002_identity.sql holds a grant",
      grants,
      new Map(migrations).set(
        "0002_identity.sql",
        `${migrations.get("0002_identity.sql")}\ngrant select on users to sai_app;\n`,
      ),
    ],
    [
      "no block for t_new",
      grants,
      new Map(migrations).set("9999_new.sql", "create table t_new (x int);\n"),
    ],
  ];
  for (const [label, text, files] of cases) {
    const found = grantsFindings(text, files);
    assert.ok(found.includes(label), `${label}: ${JSON.stringify(found)}`);
  }
});
