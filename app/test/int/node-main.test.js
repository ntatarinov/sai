import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  APP,
  missingTestFiles,
  readApp,
  request,
  startNode,
  tempDir,
} from "../fixtures/helpers.js";

// REQ-108 criteria 4 and 5, and the presence guard of the unit step (criterion 2).

// The unit test files that the criteria of REQ-108 and REQ-109 name (decisions/0118 О17): the presence
// guard of the unit step runs here, in the int step.
const UNIT_FILES = [
  "npmrc",
  "import-boundaries",
  "node-floor",
  "no-string-sql",
  "db-config",
  "body",
  "ci-workflow",
  "docker-files",
  "vercel-config",
  "headers-parity",
  "smoke",
  "check-public",
  "vercel-build",
  "runbooks",
  "public-pages",
  "texts",
  "forbidden-words",
  "theme-contrast",
  "intake",
  "vendored",
  "public-build",
  "port-parity",
  "office-pure",
  "office-stage",
  "office-view",
];

const INDEX = readApp("public/index.html");
const NOT_FOUND = readApp("public/404.html");

test("NM-1 two local hosts, the closed page, the preview redirect, SIGTERM", async (t) => {
  const s = startNode(t, { PORT: "0" });
  const port = await s.ready;
  assert.ok(port > 0);
  assert.equal(
    s
      .out()
      .split("\n")
      .filter((l) => /^http:\/\//.test(l)).length,
    2,
  );
  const root = await request(port, "/");
  assert.equal(root.status, 200);
  assert.equal(root.headers["content-type"], "text/html; charset=utf-8");
  assert.ok(root.body.equals(INDEX));
  assert.match(INDEX.toString(), /Sai — закрытое тестирование/);
  assert.match(INDEX.toString(), /<html lang="ru">/);
  for (const p of ["/", "/x/y", "/api/health"]) {
    const r = await request(port, p, { host: `localhost:${port}` });
    assert.equal(r.status, 307, p);
    assert.equal(
      new URL(String(r.headers.location)).origin,
      `http://127.0.0.1:${port}`,
    );
  }
  const query = await request(port, "/x/y?q=1&r=2", {
    host: `localhost:${port}`,
  });
  assert.equal(query.headers.location, `http://127.0.0.1:${port}/x/y?q=1&r=2`);
  for (const h of [
    { host: "evil.example" },
    {
      host: `localhost:${port}`,
      headers: { "X-Forwarded-Host": "evil.example" },
    },
  ]) {
    const r = await request(port, "/x", h);
    assert.ok(!String(r.headers.location ?? "").includes("evil.example"));
  }
  // A path that starts with // is a path of the app origin, never another host.
  for (const p of ["//evil.example/x", "///evil.example/x?q=1"]) {
    const r = await request(port, p, { host: `localhost:${port}` });
    assert.equal(r.status, 307, p);
    const location = new URL(String(r.headers.location));
    assert.equal(location.origin, `http://127.0.0.1:${port}`, p);
    assert.equal(location.pathname + location.search, p);
  }
  const p404 = await request(port, "/api/p/x", { host: `localhost:${port}` });
  assert.equal(p404.status, 404);
  assert.equal(p404.body.toString(), '{"error":"not_found"}');
  const started = Date.now();
  s.child.kill("SIGTERM");
  const ex = /** @type {any} */ (await s.exited);
  assert.equal(ex.code, 0);
  assert.ok(Date.now() - started < 5000);
});

test("NM-2 production without DATABASE_URL refuses with one plain line naming DATABASE_URL", async (t) => {
  const s = startNode(t, { PORT: "0", NODE_ENV: "production" });
  const ex = /** @type {any} */ (await s.exited);
  assert.notEqual(ex.code, 0);
  const lines = s.err().trim().split("\n");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /DATABASE_URL/);
  assert.doesNotMatch(s.err(), /^\s+at /m);
});

test("NM-3 unknown addresses, the static files and the escapes", async (t) => {
  const s = startNode(t, { PORT: "0" });
  const port = await s.ready;
  const bodies = [];
  // `/api/%68ealth` decodes to /api/health: the raw path names no route, so it is an unknown address.
  for (const p of ["/api/x", "/api/x/y/z", "/api/p/x", "/api/%68ealth"]) {
    const r = await request(port, p);
    assert.equal(r.status, 404, p);
    assert.match(String(r.headers["content-type"]), /^application\/json/);
    const v = JSON.parse(r.body.toString());
    assert.deepEqual(Object.keys(v), ["error"]);
    assert.equal(typeof v.error, "string");
    bodies.push(r.body.toString());
  }
  assert.equal(new Set(bodies).size, 1);
  // `/%61pi/health` is a page path (it does not start with /api/), never the health route.
  for (const p of ["/nope", "/a/b.html", "/%61pi/health"]) {
    const r = await request(port, p);
    assert.equal(r.status, 404, p);
    assert.ok(r.body.equals(NOT_FOUND), p);
  }
  const index = await request(port, "/index.html");
  assert.equal(index.status, 200);
  assert.ok(index.body.equals(INDEX));
  for (const p of [
    "/../package.json",
    "/%2e%2e/package.json",
    "/..%2fpackage.json",
    "/.env",
    "/server/app.js",
    "/db/migrations/0001_init.sql",
    "//etc/passwd",
    "/css/",
  ]) {
    const r = await request(port, p);
    assert.ok(r.status === 404 || r.status === 400, `${p}: ${r.status}`);
    if (r.status === 404) assert.ok(r.body.equals(NOT_FOUND), p);
  }
  assert.equal((await request(port, "/")).status, 200);
});

test("NM-4 the static map serves no dot-name, no unknown type and no folder", async (t) => {
  const { loadStaticSite } = await import("../../server/static.js");
  const dir = tempDir(t);
  for (const f of [
    "index.html",
    "404.html",
    "gate.html",
    ".env.html",
    "a.sql",
    "ok.txt",
  ])
    fs.writeFileSync(path.join(dir, f), "x");
  fs.mkdirSync(path.join(dir, ".git"));
  fs.writeFileSync(path.join(dir, ".git", "c.html"), "x");
  const site = loadStaticSite(dir);
  for (const p of ["/.env.html", "/a.sql", "/.git/c.html", "/.git", "/"]) {
    if (p === "/") assert.ok(site.lookup(p));
    else assert.equal(site.lookup(p), null, p);
  }
  assert.ok(site.lookup("/ok.txt"));
});

test("NM-5 app/test/unit holds its 25 named test files; a copy without one is red", (t) => {
  const real = path.join(APP, "test", "unit");
  assert.deepEqual(missingTestFiles(real, UNIT_FILES), []);
  const files = fs.readdirSync(real);
  for (const gone of UNIT_FILES) {
    const copy = path.join(tempDir(t), "unit");
    fs.mkdirSync(copy);
    for (const f of files)
      if (f !== `${gone}.test.js`) fs.writeFileSync(path.join(copy, f), "");
    assert.deepEqual(missingTestFiles(copy, UNIT_FILES), [gone], gone);
  }
});

test("NM-6 the local server serves the whole source: examples.html and the texts module with its kk values and order_ keys, byte for byte", async (t) => {
  const s = startNode(t, { PORT: "0" });
  const port = await s.ready;
  const examples = await request(port, "/examples.html");
  assert.equal(examples.status, 200);
  assert.equal(examples.headers["content-type"], "text/html; charset=utf-8");
  assert.ok(examples.body.equals(readApp("public/examples.html")));
  const texts = await request(port, "/shared/i18n/texts.js");
  assert.equal(texts.status, 200);
  assert.equal(texts.headers["content-type"], "text/javascript; charset=utf-8");
  const source = readApp("public/shared/i18n/texts.js");
  assert.ok(texts.body.equals(source));
  // The bytes are the source's: the kk values and the order_ keys are in them (the closed build removes
  // them from the public set; the local server keeps them).
  assert.match(texts.body.toString(), /\border_[a-z_]+:/);
  assert.match(texts.body.toString(), /\bkk: /);
  assert.match(examples.body.toString(), /order_/);
  // The page's own scripts and style sheets are served as the source holds them too.
  for (const p of [
    "/shared/i18n/lang.js",
    "/office/view.js",
    "/css/site.css",
    "/index.html",
  ]) {
    const r = await request(port, p);
    assert.equal(r.status, 200, p);
    assert.ok(r.body.equals(readApp(`public${p}`)), p);
  }
});
