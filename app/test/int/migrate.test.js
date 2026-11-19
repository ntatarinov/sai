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

// REQ-108 criterion 7 (PGlite) and the PGlite part of criterion 8 (the password form, decisions/0116 О24).

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

test("MG-1 from an empty database 0001 is applied once; a second run applies nothing", async (t) => {
  const dir = path.join(tempDir(t), "pgl");
  const a = run({ PGLITE_DIR: dir });
  assert.equal(a.status, 0, a.stderr);
  const s1 = await state(dir);
  const sha = createHash("sha256")
    .update(fs.readFileSync(path.join(MIGRATIONS, "0001_init.sql")))
    .digest("hex");
  assert.deepEqual(
    s1.rows.map((r) => [r.name, r.sha256]),
    [["0001_init.sql", sha]],
  );
  assert.deepEqual(
    s1.tables.map((r) => r.table_name),
    ["platform_settings", "schema_migrations"],
  );
  // The columns with their types (criterion 7 names `value jsonb`).
  assert.deepEqual(
    s1.cols.map((r) => `${r.table_name}.${r.column_name} ${r.data_type}`),
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
    path.join(m, "0002_bad.sql"),
    "create table t_first (x int);\nselect * from no_such_table;\n",
  );
  const a = run({ PGLITE_DIR: dir, MIGRATIONS_DIR: m });
  assert.notEqual(a.status, 0);
  assert.deepEqual(await state(dir), before);
  fs.rmSync(path.join(m, "0002_bad.sql"));
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
