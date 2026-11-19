import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { createFunctionApp } from "../../server/app.js";
import { readConfig } from "../../server/config.js";
import { SELFCHECK_SQL } from "../../server/db/selfcheck.js";
import { standIn } from "../fixtures/helpers.js";
import { appWith, migratedPglite, migrationList } from "../fixtures/db.js";

// REQ-109 criterion 3 (PGlite after the migration).

const KEYS = ["ok", "db", "role", "migrations_pending", "version", "node"];

/** A local port where nothing listens. */
async function refusedPort() {
  const free = net.createServer();
  await new Promise((r) => free.listen(0, "127.0.0.1", () => r(null)));
  const port = /** @type {net.AddressInfo} */ (free.address()).port;
  await new Promise((r) => free.close(() => r(null)));
  return port;
}

test("HL-1 a healthy answer", async () => {
  const ad = await migratedPglite();
  const r = await appWith({ adapter: ad }).request(
    "http://127.0.0.1:1/api/health",
  );
  assert.equal(r.status, 200);
  assert.match(String(r.headers.get("content-type")), /^application\/json/);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(await r.json(), {
    ok: true,
    db: "ok",
    role: "ok",
    migrations_pending: 0,
    version: "dev",
    node: process.version,
  });
  await ad.close();
});

test("HL-2 the failure answers: down, unsafe, one pending; nothing else leaks", async (t) => {
  const ad = await migratedPglite();
  const down = {
    query: () =>
      Promise.reject(
        Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5"), {
          code: "ECONNREFUSED",
        }),
      ),
    exec: async () => {},
    close: async () => {},
  };
  const silent = {
    query: () => new Promise(() => {}),
    exec: async () => {},
    close: async () => {},
  };
  const unsafe = {
    query: async () => ({ rows: [{ rolsuper: true, rolbypassrls: false }] }),
    exec: async () => {},
    close: async () => {},
  };
  const cases = [
    [down, { db: "down" }],
    [silent, { db: "down" }],
    [unsafe, { role: "unsafe" }],
    [
      ad,
      { migrations_pending: 1 },
      [...migrationList(), { name: "0002_more.sql", sha256: "0".repeat(64) }],
    ],
  ];
  for (const [adapter, want, migrations] of cases) {
    const started = Date.now();
    const r = await appWith({ adapter, migrations }).request(
      "http://127.0.0.1:1/api/health",
    );
    assert.ok(Date.now() - started < 5000);
    assert.equal(r.status, 503);
    const text = await r.text();
    const body = JSON.parse(text);
    assert.deepEqual(Object.keys(body), KEYS);
    assert.equal(body.ok, false);
    for (const [k, v] of Object.entries(want)) assert.equal(body[k], v);
    assert.doesNotMatch(text, /127\.0\.0\.1|ECONNREFUSED|Error|\n\s+at /);
  }
  await ad.close();
  // The real path: the function app with the pg adapter and a DATABASE_URL that holds a user, a planted
  // password, a host and a port, against a refused port and a stand-in that never answers.
  const mark = ["pw", "MARK", "hl"].join("-");
  for (const port of [await refusedPort(), (await standIn(t)).port]) {
    /** @type {string[]} */
    const lines = [];
    const app = await createFunctionApp(
      readConfig({
        DATABASE_URL: `postgres://owner_x:${mark}@127.0.0.1:${port}/d`,
      }),
      { log: (e) => lines.push(JSON.stringify(e)) },
    );
    const started = Date.now();
    const r = await app.request("http://127.0.0.1:1/api/health");
    assert.ok(Date.now() - started < 5000, `${Date.now() - started} ms`);
    assert.equal(r.status, 503);
    const text = await r.text();
    const body = JSON.parse(text);
    assert.deepEqual(Object.keys(body), KEYS);
    assert.equal(body.ok, false);
    assert.equal(body.db, "down");
    for (const bad of [mark, "owner_x", "127.0.0.1", "postgres://"]) {
      assert.ok(!text.includes(bad), `${bad} in ${text}`);
      assert.ok(!lines.join("\n").includes(bad), `${bad} in the log`);
    }
    assert.ok(!text.includes(String(port)), `the port in ${text}`);
    assert.doesNotMatch(text, /ECONNREFUSED|Error|timeout|\n\s+at /);
  }
});

test("HL-3 after each failure the next request is answered and schema_migrations is unchanged", async () => {
  const ad = await migratedPglite();
  const rows = async () =>
    (await ad.query("select name, sha256 from schema_migrations order by name"))
      .rows;
  const before = await rows();
  assert.equal(before.length, migrationList().length);
  // Every failing adapter stands in front of the real database, so a statement of the app would reach it.
  const through = {
    exec: (/** @type {string} */ q) => ad.exec(q),
    close: async () => {},
  };
  const cases = [
    {
      ...through,
      query: () =>
        Promise.reject(
          Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5"), {
            code: "ECONNREFUSED",
          }),
        ),
    },
    { ...through, query: () => new Promise(() => {}) },
    {
      ...through,
      query: (/** @type {string} */ q, /** @type {any[]} */ p) =>
        q === SELFCHECK_SQL
          ? Promise.resolve({ rows: [{ rolsuper: false, rolbypassrls: true }] })
          : ad.query(q, p),
    },
    {
      ...through,
      query: (/** @type {string} */ q, /** @type {any[]} */ p) =>
        ad.query(q, p),
      migrations: [
        ...migrationList(),
        { name: "0002_more.sql", sha256: "0".repeat(64) },
      ],
    },
  ];
  for (const { migrations, ...adapter } of cases) {
    const app = appWith({ adapter, migrations });
    const first = await app.request("http://127.0.0.1:1/api/health");
    assert.equal(first.status, 503);
    const started = Date.now();
    const next = await app.request("http://127.0.0.1:1/api/health");
    assert.ok(Date.now() - started < 5000, `${Date.now() - started} ms`);
    assert.equal(next.status, 503);
    assert.deepEqual(Object.keys(await next.json()), KEYS);
    const page = await app.request("http://127.0.0.1:1/");
    assert.equal(page.status, 200);
  }
  assert.deepEqual(await rows(), before);
  await ad.close();
});

test("HL-4 version is APP_VERSION, and dev when it is unset", async () => {
  for (const [env, want] of /** @type {const} */ ([
    [{ APP_VERSION: "abc" }, "abc"],
    [{}, "dev"],
  ])) {
    const ad = await migratedPglite();
    const app = await createFunctionApp(readConfig(env), {
      adapter: ad,
      log: () => {},
    });
    const r = await app.request("http://127.0.0.1:1/api/health");
    assert.equal(r.status, 200);
    assert.equal((await r.json()).version, want);
    await ad.close();
  }
});
