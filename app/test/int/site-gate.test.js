import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "../../server/config.js";
import { readApp, request, standIn, startNode } from "../fixtures/helpers.js";
import { appWith, throwing } from "../fixtures/db.js";

// REQ-108 criterion 9.

const GATE = readApp("public/gate.html");
const INDEX = readApp("public/index.html");
const NOT_FOUND = readApp("public/404.html");

test("SG-1 SITE_GATE closes every path with 503 and calls no database", async () => {
  const th = throwing();
  const app = appWith({ siteGate: true, adapter: th.adapter });
  const api = new Set();
  for (const host of ["127.0.0.1:1", "localhost:1"]) {
    for (const p of ["/", "/nope"]) {
      const r = await app.request(`http://${host}${p}`);
      assert.equal(r.status, 503);
      assert.ok(Buffer.from(await r.arrayBuffer()).equals(GATE));
    }
    for (const p of ["/api/health", "/api/x/y"]) {
      const r = await app.request(`http://${host}${p}`);
      assert.equal(r.status, 503);
      const text = await r.text();
      assert.deepEqual(Object.keys(JSON.parse(text)), ["error"]);
      api.add(text);
    }
  }
  assert.equal(api.size, 1);
  // The gate stands before the body limit: a body above it gets the gate answer, not 413.
  const big = await app.request("http://127.0.0.1:1/api/x", {
    method: "POST",
    body: new Uint8Array(70000),
  });
  assert.equal(big.status, 503);
  assert.equal(await big.text(), [...api][0]);
  const page = await app.request("http://127.0.0.1:1/", {
    method: "POST",
    body: new Uint8Array(70000),
  });
  assert.equal(page.status, 503);
  assert.ok(Buffer.from(await page.arrayBuffer()).equals(GATE));
  assert.equal(th.calls(), 0);
});

test("SG-2 any non-empty SITE_GATE closes, empty or unset opens", async () => {
  for (const v of ["closed", "CLOSED", " closed", "1", "open"]) {
    const { siteGate } = readConfig({ SITE_GATE: v });
    assert.equal(siteGate, true, v);
    const r = await appWith({ siteGate }).request("http://127.0.0.1:1/");
    assert.equal(r.status, 503, v);
  }
  for (const v of ["", undefined]) {
    const { siteGate } = readConfig({ SITE_GATE: v });
    assert.equal(siteGate, false, String(v));
    const app = appWith({ siteGate });
    const root = await app.request("http://127.0.0.1:1/");
    assert.equal(root.status, 200);
    assert.ok(Buffer.from(await root.arrayBuffer()).equals(INDEX));
    const nope = await app.request("http://127.0.0.1:1/nope");
    assert.equal(nope.status, 404);
    assert.ok(Buffer.from(await nope.arrayBuffer()).equals(NOT_FOUND));
    const api = await app.request("http://127.0.0.1:1/api/x/y");
    assert.equal(api.status, 404);
    assert.equal(await api.text(), '{"error":"not_found"}');
  }
});

test("SG-3 node-main with SITE_GATE set opens no database connection at the start and in three requests", async (t) => {
  const db = await standIn(t);
  const mark = ["pw", "MARK", "gate"].join("-");
  const s = startNode(t, {
    PORT: "0",
    SITE_GATE: "closed",
    DATABASE_URL: `postgres://owner_x:${mark}@127.0.0.1:${db.port}/d`,
  });
  const port = await s.ready;
  for (const p of ["/", "/api/health", "/nope"])
    assert.equal((await request(port, p)).status, 503, p);
  const probe = await db.barrier();
  assert.deepEqual(db.seen, [probe], "the database got no connection");
  s.child.kill("SIGTERM");
  const ex = /** @type {any} */ (await s.exited);
  assert.equal(ex.code, 0);
});
