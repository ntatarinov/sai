import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { connectPgSession } from "../../server/db/pg.js";
import { migrate } from "../../server/db/migrate.js";
import { APP, childEnv } from "../fixtures/helpers.js";
import {
  admin,
  client,
  freshDatabase,
  newPassword,
  url,
} from "../fixtures/pg-env.js";

// REQ-108 criterion 8 on real Postgres (the job pg). N4: the statement log is taken from an in-process run
// of migrate() with a recording adapter; the process run is checked for its printed lines.

const MIGRATIONS = path.join(APP, "db", "migrations");

/** Every file of app/ outside node_modules/, as absolute paths. */
export function appFiles(dir = APP, acc = /** @type {string[]} */ ([])) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) appFiles(abs, acc);
    else if (e.isFile()) acc.push(abs);
  }
  return acc;
}

/** @param {Record<string, string>} env */
function migrateProcess(env) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, ["server/db/migrate.js"], {
      cwd: APP,
      env: childEnv(env),
    });
    let out = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (out += d));
    c.on("exit", (code) => resolve({ code, out }));
  });
}

const roles = async (/** @type {any} */ c) =>
  (
    await c.query(
      "select rolname, rolcanlogin, rolsuper, rolbypassrls from pg_roles where rolname in ('sai_app', 'sai_preview', 'sai_app_login') order by 1",
    )
  ).rows;

test("MP-1 roles, the login with APP_DB_PASSWORD, no table owned, no org_id, the value nowhere but bound parameters", async (t) => {
  const db = await freshDatabase(t);
  const pw = newPassword();
  const r = /** @type {any} */ (
    await migrateProcess({
      DATABASE_URL: url("postgres", admin().password, db),
      APP_DB_PASSWORD: pw,
    })
  );
  assert.equal(r.code, 0, r.out);
  assert.ok(!r.out.includes(pw));
  assert.deepEqual(
    appFiles().filter((f) => fs.readFileSync(f).includes(pw)),
    [],
    "no file of app/ holds the value",
  );
  const c = await client(db);
  assert.deepEqual(await roles(c), [
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
  const member = (
    await c.query(
      "select b.rolname from pg_auth_members m join pg_roles a on a.oid = m.member join pg_roles b on b.oid = m.roleid where a.rolname = 'sai_app_login' order by 1",
    )
  ).rows.map((x) => x.rolname);
  assert.deepEqual(member, ["sai_app", "sai_preview"]);
  const owned = (
    await c.query(
      "select count(*)::int as n from pg_tables where tableowner in ('sai_app', 'sai_preview', 'sai_app_login')",
    )
  ).rows[0].n;
  assert.equal(owned, 0);
  assert.equal(
    (
      await c.query(
        "select count(*)::int as n from information_schema.columns where table_schema = 'public' and column_name = 'org_id'",
      )
    ).rows[0].n,
    0,
  );
  assert.ok(
    !JSON.stringify(
      (await c.query("select * from schema_migrations")).rows,
    ).includes(pw),
  );
  await c.end();
  const login = await client(db, "sai_app_login", pw);
  assert.equal(
    (await login.query("select session_user as u")).rows[0].u,
    "sai_app_login",
  );
  await login.end();
  const s = await connectPgSession(url("postgres", admin().password, db), {
    connectTimeoutMs: 5000,
  });
  /** @type {Array<{ text: string, params: unknown[] }>} */
  const log = [];
  const rec = {
    query: (/** @type {string} */ q, /** @type {any} */ p) => (
      log.push({ text: q, params: p ?? [] }),
      s.query(q, p)
    ),
    exec: (/** @type {string} */ q) => (
      log.push({ text: q, params: [] }),
      s.exec(q)
    ),
    close: () => s.close(),
  };
  const pw2 = newPassword();
  await migrate({ adapter: rec, dir: MIGRATIONS, password: pw2 });
  assert.ok(
    log.every((e) => !e.text.includes(pw2)) &&
      log.some((e) => e.params.includes(pw2)),
  );
  await s.exec("drop role if exists sai_t_absent");
  const broken = {
    ...rec,
    exec: (/** @type {string} */ q) =>
      rec.exec(
        q.replace("alter role sai_app_login", "alter role sai_t_absent"),
      ),
  };
  await assert.rejects(
    migrate({ adapter: broken, dir: MIGRATIONS, password: pw2 }),
    (e) =>
      !JSON.stringify({
        m: /** @type {Error} */ (e).message,
        s: /** @type {Error} */ (e).stack,
      }).includes(pw2),
  );
  await s.close();
});

test("MP-2 two migrate processes at once both end with 0 and one row per file", async (t) => {
  const db = await freshDatabase(t);
  const env = { DATABASE_URL: url("postgres", admin().password, db) };
  const [a, b] = /** @type {any[]} */ (
    await Promise.all([migrateProcess(env), migrateProcess(env)])
  );
  assert.deepEqual([a.code, b.code], [0, 0], a.out + b.out);
  const c = await client(db);
  assert.deepEqual((await c.query("select name from schema_migrations")).rows, [
    { name: "0001_init.sql" },
  ]);
  await c.end();
});

test("MP-3 0001 on a second database where the roles exist keeps their attributes", async (t) => {
  const first = await freshDatabase(t);
  assert.equal(
    /** @type {any} */ (
      await migrateProcess({
        DATABASE_URL: url("postgres", admin().password, first),
      })
    ).code,
    0,
  );
  const c0 = await client();
  const before = await roles(c0);
  const second = await freshDatabase(t);
  const r = /** @type {any} */ (
    await migrateProcess({
      DATABASE_URL: url("postgres", admin().password, second),
    })
  );
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(await roles(c0), before);
  await c0.end();
});
