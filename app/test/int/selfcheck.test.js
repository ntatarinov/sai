import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createFunctionApp } from "../../server/app.js";
import { readConfig } from "../../server/config.js";
import { createDb, openRuntimeDb } from "../../server/db/index.js";
import { migrate } from "../../server/db/migrate.js";
import { openPglite } from "../../server/db/pglite.js";
import {
  judgeRole,
  runSelfcheck,
  SELFCHECK_SQL,
} from "../../server/db/selfcheck.js";
import {
  APP,
  pgStandIn,
  standIn,
  startNode,
  tempDir,
  waitFor,
} from "../fixtures/helpers.js";
import {
  counting,
  migratedPglite,
  migrationList,
  MIGRATIONS,
} from "../fixtures/db.js";

// REQ-108 criterion 8 (the int part).

const REFUSAL =
  "sai: refused: the database role of the app is a superuser or bypasses row security";

/**
 * The outcome of `p` within `ms`: its rejection reason, "fulfilled", or "pending" when it has not
 * settled, so a promise that never settles fails the test instead of holding it.
 * @param {Promise<unknown>} p
 * @param {number} ms
 * @returns {Promise<any>}
 */
function settle(p, ms) {
  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  return Promise.race([
    p.then(
      () => "fulfilled",
      (e) => e,
    ),
    new Promise((r) => {
      timer = setTimeout(() => r("pending"), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

test("SC-1 the judgement of a role reading", () => {
  assert.equal(judgeRole({ rolsuper: true, rolbypassrls: false }), "unsafe");
  assert.equal(judgeRole({ rolsuper: false, rolbypassrls: true }), "unsafe");
  assert.equal(judgeRole(undefined), "unsafe");
  assert.equal(judgeRole({ rolsuper: false, rolbypassrls: false }), "ok");
});

for (const attr of ["superuser", "bypassrls"]) {
  test(`SC-2 node-main on a database whose login role has ${attr} exits with one plain line`, async (t) => {
    const dir = path.join(tempDir(t), "pgl");
    const db = new PGlite(dir);
    const ad = {
      query: (/** @type {string} */ q, /** @type {any[]} */ p) =>
        db.query(q, p),
      exec: (/** @type {string} */ q) => db.exec(q).then(() => {}),
      close: () => db.close(),
    };
    await migrate({ adapter: ad, dir: MIGRATIONS, password: null });
    await db.exec(`alter role sai_app_login ${attr}`);
    await db.close();
    const s = startNode(t, { PORT: "0", PGLITE_DIR: dir });
    const ex = /** @type {any} */ (await s.exited);
    assert.notEqual(ex.code, 0);
    // Exactly the refusal line: an exit with no line, or with another one, is red.
    assert.deepEqual(s.err().trim().split("\n"), [REFUSAL]);
    assert.doesNotMatch(s.err(), /sai_app_login|postgres|^\s+at /m);
    assert.ok(!s.err().includes(dir), "the line names no PGlite folder");
  });
}

test("SC-3 no statement before the selfcheck passes, at the start and after the database comes back", async () => {
  const inner = await migratedPglite();
  let down = true;
  const c = counting({
    query: (t, p) =>
      down
        ? Promise.reject(
            Object.assign(new Error("x"), { code: "ECONNREFUSED" }),
          )
        : inner.query(t, p),
    exec: (t) => inner.exec(t),
    close: () => inner.close(),
  });
  const db = createDb(c.adapter);
  await assert.rejects(db.query("select 1"));
  assert.deepEqual(c.texts, [SELFCHECK_SQL]);
  down = false;
  await db.query("select 1");
  assert.deepEqual(c.texts, [SELFCHECK_SQL, SELFCHECK_SQL, "select 1"]);
  // A silent database: a selfcheck that never ends counts as down at its deadline, so the caller gets
  // E_DB_DOWN instead of waiting for ever, and the next use runs the selfcheck again.
  let silent = true;
  const q = counting({
    query: (t, p) => (silent ? new Promise(() => {}) : inner.query(t, p)),
    exec: (t) => inner.exec(t),
    close: async () => {},
  });
  const quiet = createDb(q.adapter, { selfcheckDeadlineMs: 100 });
  const started = Date.now();
  const first = await settle(quiet.query("select 1"), 3000);
  assert.equal(first?.code, "E_DB_DOWN", String(first));
  assert.ok(Date.now() - started < 3000, `${Date.now() - started} ms`);
  assert.deepEqual(q.texts, [SELFCHECK_SQL]);
  silent = false;
  assert.equal(await settle(quiet.query("select 1"), 3000), "fulfilled");
  assert.deepEqual(q.texts, [SELFCHECK_SQL, SELFCHECK_SQL, "select 1"]);
  await db.close();
});

/** Every .js file of the product (app/ without node_modules/ and test/), as paths under app/. */
const productFiles = () =>
  ["api", "server", "scripts"].flatMap((dir) =>
    fs
      .readdirSync(path.join(APP, dir), { recursive: true })
      .map((f) => `${dir}/${String(f).split(path.sep).join("/")}`)
      .filter((f) => f.endsWith(".js")),
  );

test("SC-4 the PGlite reading stands only in the PGlite branch; openRuntimeDb with a DATABASE_URL sends no statement", async (t) => {
  const read = (/** @type {string} */ f) =>
    fs.readFileSync(path.join(APP, f), "utf8");
  const files = productFiles();
  assert.ok(files.includes("server/db/pglite.js"));
  assert.deepEqual(
    files.filter((f) => /set session authorization/i.test(read(f))),
    ["server/db/pglite.js"],
  );
  // A call of the switch, read on the code without its comments (a comment may name the method, and
  // the definition `switchToLoginRole() {` is not a call).
  const code = (/** @type {string} */ f) =>
    read(f).replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, "$1");
  const call = /switchToLoginRole\s*(?:\?\.\s*)?\(\s*\)(?!\s*\{)/g;
  const calls = (/** @type {string} */ f) => [...code(f).matchAll(call)];
  assert.deepEqual(
    files.filter((f) => calls(f).length > 0),
    ["server/db/index.js"],
  );
  // Every call stands in the PGlite branch of openRuntimeDb: after the Postgres branch has returned and
  // after PGlite was imported.
  const index = code("server/db/index.js");
  const postgres = index.indexOf("if (config.databaseUrl)");
  const pglite = index.indexOf('await import("./pglite.js")');
  assert.ok(postgres > 0 && pglite > postgres);
  const at = calls("server/db/index.js").map((m) => m.index ?? -1);
  assert.equal(at.length, 1, "one call of the switch");
  assert.ok(at[0] > pglite, "the call stands in the PGlite branch");
  const db = await standIn(t);
  const folder = path.join(tempDir(t), "pgl-never");
  const mark = ["pw", "MARK", "sc4"].join("-");
  const config = readConfig({
    DATABASE_URL: `postgres://owner_x:${mark}@127.0.0.1:${db.port}/d`,
    PGLITE_DIR: folder,
  });
  const opened = await openRuntimeDb(config, { connectTimeoutMs: 1000 });
  const probe = await db.barrier();
  assert.equal(opened.roleState(), "unchecked");
  assert.ok(!fs.existsSync(folder), "no PGlite folder was made");
  assert.deepEqual(db.seen, [probe], "the database got no connection");
  await opened.close();
});

const HEALTH_SQL = "select name, sha256 from schema_migrations";

test("SC-5 a selfcheck that gets no answer on a started session ends as down; the client drops that connection, and the next use opens a new one, runs the selfcheck again and answers", async (t) => {
  // The first connection starts its session and then never answers a statement (a half-open socket);
  // the later ones answer as a migrated database with a safe login role.
  const migrations = migrationList();
  const pg = await pgStandIn(t, {
    plan: (n) => (n === 1 ? "stall" : "answer"),
    answer: (text) =>
      text === SELFCHECK_SQL
        ? {
            fields: [
              ["rolsuper", 16],
              ["rolbypassrls", 16],
            ],
            rows: [["f", "f"]],
          }
        : text === HEALTH_SQL
          ? {
              fields: [
                ["name", 25],
                ["sha256", 25],
              ],
              rows: migrations.map((m) => [m.name, m.sha256]),
            }
          : null,
  });
  const app = await createFunctionApp(
    readConfig({
      DATABASE_URL: `postgres://sai_app_login@127.0.0.1:${pg.port}/d`,
    }),
    { log: () => {} },
  );
  const started = Date.now();
  const first = await app.request("http://127.0.0.1:1/api/health");
  assert.equal(first.status, 503);
  assert.equal((await first.json()).db, "down");
  assert.ok(Date.now() - started < 5000, `${Date.now() - started} ms`);
  // The silent statement failed in the client, and the pool closed its connection: no client of the
  // pool stays held by it.
  await waitFor(() => pg.closed.has(1), 5000, "the silent connection closed");
  const next = await app.request("http://127.0.0.1:1/api/health");
  assert.equal(next.status, 200);
  assert.equal((await next.json()).ok, true);
  assert.deepEqual(pg.statements, [
    [1, SELFCHECK_SQL],
    [2, SELFCHECK_SQL],
    [2, HEALTH_SQL],
  ]);
});

test("SC-6 the selfcheck reads every role the login role is a member of: a sai_app with BYPASSRLS kept from before 0001, or made a superuser after it, is refused", async () => {
  for (const [label, before, after, want] of [
    ["clean", null, null, "ok"],
    [
      "sai_app with bypassrls before 0001",
      "create role sai_app nologin bypassrls",
      null,
      "unsafe",
    ],
    [
      "sai_app made a superuser after 0001",
      null,
      "alter role sai_app superuser",
      "unsafe",
    ],
    [
      "sai_preview given bypassrls after 0001",
      null,
      "alter role sai_preview bypassrls",
      "unsafe",
    ],
  ]) {
    const ad = await openPglite(null);
    if (before) await ad.exec(before);
    await migrate({ adapter: ad, dir: MIGRATIONS, password: null });
    if (after) await ad.exec(after);
    await ad.switchToLoginRole();
    // The login role itself keeps NOSUPERUSER NOBYPASSRLS: only a role it can become differs.
    assert.deepEqual(
      (
        await ad.query(
          "select rolsuper, rolbypassrls from pg_roles where rolname = session_user",
        )
      ).rows,
      [{ rolsuper: false, rolbypassrls: false }],
      label,
    );
    assert.equal(await runSelfcheck(ad), want, label);
    await ad.close();
  }
});
