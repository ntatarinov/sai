import assert from "node:assert/strict";
import { test } from "node:test";
import { createFunctionApp } from "../../server/app.js";
import { readConfig } from "../../server/config.js";
import { securityHeaders } from "../../server/http/headers.js";
import { readApp, request, startNode } from "../fixtures/helpers.js";
import { appWith, throwing } from "../fixtures/db.js";

// REQ-109 criterion 4 (the Node answers).

const HTTP_SET = securityHeaders({ https: false });

/** @param {Record<string, any>} h @param {boolean} api */
function check(h, api, label) {
  for (const [n, v] of HTTP_SET)
    assert.equal(h[n.toLowerCase()], v, `${label}: ${n}`);
  if (api) assert.equal(h["cache-control"], "no-store", label);
  assert.equal(h.server, undefined, label);
  assert.equal(h["x-powered-by"], undefined, label);
  assert.equal(h["strict-transport-security"], undefined, label);
}

test("HD-1 every answer of the Node server carries the http set", async (t) => {
  const s = startNode(t, { PORT: "0" });
  const port = await s.ready;
  for (const [p, api, o] of [
    ["/", false, {}],
    ["/nope", false, {}],
    ["/api/health", true, {}],
    ["/api/x/y", true, {}],
    ["/api/%68ealth", true, {}],
    ["/x", false, { host: `localhost:${port}` }],
    ["/api/x", true, { method: "POST", body: Buffer.alloc(70000) }],
  ]) {
    const r = await request(port, p, o);
    check(r.headers, api, `${p} ${r.status}`);
  }
  const gate = startNode(t, { PORT: "0", SITE_GATE: "closed" });
  const gp = await gate.ready;
  const g = await request(gp, "/");
  assert.equal(g.status, 503);
  check(g.headers, false, "gate");
});

test("HD-2 the 413 of a large body", async () => {
  const r = await appWith().request("http://127.0.0.1:1/api/x", {
    method: "POST",
    body: new Uint8Array(70000),
  });
  assert.equal(r.status, 413);
});

test("HD-3 the routes match the raw path, as /api and the static map read it: an encoded form runs no route and no database call, and every raw /api answer has no-store", async () => {
  const NOT_FOUND = readApp("public/404.html");
  // `%61` is `a` and `%68` is `h`: decoded, the first four paths name /api/health or /api.
  const encoded = [
    "/%61pi/health",
    "/%61%70%69/health",
    "/%61pi",
    "/api/%68ealth",
    "/api/health%2F",
    "/api%2Fhealth",
  ];
  const isApi = (/** @type {string} */ p) =>
    p === "/api" || p.startsWith("/api/");
  for (const shape of ["node", "function"]) {
    const th = throwing();
    const app =
      shape === "node"
        ? appWith({ adapter: th.adapter })
        : await createFunctionApp(readConfig({}), {
            adapter: th.adapter,
            log: () => {},
          });
    for (const p of encoded)
      for (const method of ["GET", "HEAD", "POST"]) {
        const label = `${shape} ${method} ${p}`;
        const r = await app.request(`http://127.0.0.1:1${p}`, { method });
        assert.equal(r.status, 404, label);
        const body = Buffer.from(await r.arrayBuffer());
        // The node app serves pages, the function only /api: a page path of the function gets the
        // uniform 404 too.
        if (method === "HEAD") assert.equal(body.length, 0, label);
        else if (isApi(p) || shape === "function")
          assert.equal(body.toString(), '{"error":"not_found"}', label);
        else assert.ok(body.equals(NOT_FOUND), label);
        assert.equal(
          r.headers.get("cache-control"),
          isApi(p) ? "no-store" : null,
          label,
        );
      }
    assert.equal(th.calls(), 0, `${shape}: no database call`);
    for (const p of ["/api", "/api/", "/api/x/y", "/api/p/x"]) {
      const r = await app.request(`http://127.0.0.1:1${p}`);
      assert.equal(r.status, 404, `${shape} ${p}`);
      assert.equal(r.headers.get("cache-control"), "no-store", `${shape} ${p}`);
    }
  }
});
