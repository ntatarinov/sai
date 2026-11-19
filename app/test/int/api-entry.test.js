import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createEntry } from "../../api/index.js";
import { createFunctionApp } from "../../server/app.js";
import { readConfig } from "../../server/config.js";
import { SELFCHECK_SQL } from "../../server/db/selfcheck.js";
import { APP, childEnv } from "../fixtures/helpers.js";
import { counting, migratedPglite } from "../fixtures/db.js";

// REQ-109 criteria 2 and 3 (through the function entry).

const BASE = "https://app.example.test";

/** @param {any} adapter */
const entryWith = (adapter) =>
  createEntry(() =>
    createFunctionApp(readConfig({ APP_ORIGIN: BASE }), {
      adapter,
      log: () => {},
    }),
  );

test("AE-1 the rewritten path answers like the plain one; __p is not passed on; bad values are refused", async () => {
  const inner = await migratedPglite();
  const seen = [];
  const e = entryWith({
    ...inner,
    query: (/** @type {string} */ t, /** @type {any} */ p) => (
      seen.push(t),
      inner.query(t, p)
    ),
  });
  const a = await e.fetch(new Request(`${BASE}/api/index?__p=health`));
  const b = await e.fetch(new Request(`${BASE}/api/health`));
  assert.equal(a.status, b.status);
  assert.deepEqual(Object.keys(await a.json()), Object.keys(await b.json()));
  const n1 = await (
    await e.fetch(new Request(`${BASE}/api/index?__p=x/y`))
  ).text();
  const n2 = await (await e.fetch(new Request(`${BASE}/api/x/y`))).text();
  assert.equal(n1, '{"error":"not_found"}');
  assert.equal(n1, n2);
  for (const v of [
    "../index.html",
    "%2e%2e/x",
    "//evil.example/x",
    "https://evil.example/",
    "a".repeat(10000),
  ]) {
    const r = await e.fetch(
      new Request(`${BASE}/api/index?__p=${encodeURIComponent(v)}`),
    );
    assert.ok(r.status === 404 || r.status === 400, v.slice(0, 20));
    assert.ok(!(r.headers.get("location") ?? "").includes("evil"));
  }
  assert.equal(
    (await e.fetch(new Request(`${BASE}/api/index?__p=health`))).status,
    200,
  );
  await inner.close();
});

test("AE-2 through the entry an unsafe role answers 503 role unsafe on every request, and only the selfcheck runs", async () => {
  const c = counting({
    query: async () => ({ rows: [{ rolsuper: false, rolbypassrls: true }] }),
    exec: async () => {},
    close: async () => {},
  });
  const e = entryWith(c.adapter);
  for (let i = 0; i < 3; i++) {
    const r = await e.fetch(new Request(`${BASE}/api/index?__p=health`));
    assert.equal(r.status, 503);
    assert.equal((await r.json()).role, "unsafe");
  }
  assert.deepEqual(c.texts, [SELFCHECK_SQL]);
});

test("AE-3 the app sees the restored path and the other parameters, never __p and never a path outside /api/", async () => {
  /** @type {string[]} */
  const seen = [];
  const e = createEntry(async () => ({
    fetch: (/** @type {Request} */ r) => {
      const u = new URL(r.url);
      seen.push(u.pathname + u.search);
      return new Response("x");
    },
  }));
  await e.fetch(new Request(`${BASE}/api/index?__p=health&x=1`));
  assert.deepEqual(seen, ["/api/health?x=1"]);
  for (const v of [
    "../index.html",
    "%2e%2e/x",
    "//evil.example/x",
    "https://evil.example/",
    "health/../../x",
    "a".repeat(10000),
  ]) {
    seen.length = 0;
    await e.fetch(
      new Request(`${BASE}/api/index?__p=${encodeURIComponent(v)}`),
    );
    assert.equal(seen.length, 1);
    assert.equal(seen[0], "/api/index", v.slice(0, 20));
  }
  seen.length = 0;
  await e.fetch(new Request(`${BASE}/api/index?__p=a&__p=b`));
  assert.deepEqual(seen, ["/api/index"]);
});

// Two requests through the default export of app/api/index.js; each answer is printed as one line
// `answer <json>` after the entry's own log lines.
const TWO_REQUESTS = `
const { default: entry } = await import("./api/index.js");
for (let i = 0; i < 2; i++) {
  const r = await entry.fetch(new Request("${BASE}/api/index?__p=health"));
  const answer = {
    status: r.status,
    type: r.headers.get("content-type"),
    cache: r.headers.get("cache-control"),
    body: await r.text(),
  };
  process.stdout.write("answer " + JSON.stringify(answer) + "\\n");
}
`;

test("AE-4 readConfig throwing in the entry answers 503 server_config with no-store, and the next request tries again", () => {
  const bad = "not-a-port";
  const r = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", TWO_REQUESTS],
    {
      cwd: APP,
      env: childEnv({ PORT: bad }),
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split("\n");
  const answers = lines
    .filter((l) => l.startsWith("answer "))
    .map((l) => JSON.parse(l.slice("answer ".length)));
  assert.deepEqual(answers, [
    {
      status: 503,
      type: "application/json; charset=utf-8",
      cache: "no-store",
      body: '{"error":"server_config"}',
    },
    {
      status: 503,
      type: "application/json; charset=utf-8",
      cache: "no-store",
      body: '{"error":"server_config"}',
    },
  ]);
  const logs = lines.filter((l) => !l.startsWith("answer "));
  assert.equal(logs.length, 2, "one log line per failed build");
  for (const l of logs) assert.equal(JSON.parse(l).code, "E_CONFIG_PORT");
  assert.ok(!r.stdout.includes(bad) && !r.stderr.includes(bad));
});

// Four requests through the default export of app/api/index.js, the rewritten and the plain form of two
// addresses; each answer is printed as one line `answer <json>` beside the app's own log lines.
const FOUR_REQUESTS = `
const { default: entry } = await import("./api/index.js");
for (const path of ["/api/index?__p=health", "/api/health", "/api/index?__p=x/y", "/api/x/y"]) {
  const r = await entry.fetch(new Request("${BASE}" + path));
  const answer = { path, status: r.status, body: await r.text() };
  process.stdout.write("answer " + JSON.stringify(answer) + "\\n");
}
`;

test("AE-5 the default export restores the rewritten path: __p=health answers as /api/health, __p=x/y as /api/x/y", () => {
  // No DATABASE_URL: the function app has no database, so /api/health answers 503 with its keys.
  const r = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", FOUR_REQUESTS],
    { cwd: APP, env: childEnv({}), encoding: "utf8", timeout: 20000 },
  );
  assert.equal(r.status, 0, r.stderr);
  /** @type {Record<string, { status: number, body: string }>} */
  const answers = {};
  for (const l of r.stdout.trim().split("\n"))
    if (l.startsWith("answer ")) {
      const a = JSON.parse(l.slice("answer ".length));
      answers[a.path] = { status: a.status, body: a.body };
    }
  const rewritten = answers["/api/index?__p=health"];
  const plain = answers["/api/health"];
  assert.equal(rewritten.status, 503, rewritten.body);
  assert.equal(rewritten.status, plain.status);
  assert.deepEqual(Object.keys(JSON.parse(rewritten.body)), [
    "ok",
    "db",
    "role",
    "migrations_pending",
    "version",
    "node",
  ]);
  assert.deepEqual(
    Object.keys(JSON.parse(rewritten.body)),
    Object.keys(JSON.parse(plain.body)),
  );
  assert.deepEqual(answers["/api/index?__p=x/y"], {
    status: 404,
    body: '{"error":"not_found"}',
  });
  assert.deepEqual(answers["/api/index?__p=x/y"], answers["/api/x/y"]);
});
