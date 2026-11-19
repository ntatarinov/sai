import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import net from "node:net";
import { test } from "node:test";
import {
  APP,
  childEnv,
  readApp,
  request,
  startNode,
} from "../fixtures/helpers.js";

// REQ-108 criterion 15 (Q10).

const INDEX = readApp("public/index.html");
const NOT_FOUND = readApp("public/404.html");

/** @param {import("node:test").TestContext} t */
async function ports(t) {
  /** @type {Set<net.Socket>} */
  const socks = new Set();
  const silent = net.createServer((s) => {
    s.on("error", () => {});
    socks.add(s);
  });
  await new Promise((r) => silent.listen(0, "127.0.0.1", () => r(null)));
  t.after(() => {
    for (const k of socks) k.destroy();
    silent.close();
  });
  const free = net.createServer();
  await new Promise((r) => free.listen(0, "127.0.0.1", () => r(null)));
  const refused = /** @type {net.AddressInfo} */ (free.address()).port;
  await new Promise((r) => free.close(() => r(null)));
  return [refused, /** @type {net.AddressInfo} */ (silent.address()).port];
}

const MARK = ["pw", "MARK", "down"].join("-");

test("DD-1 migrate exits within 15 000 ms with one plain line", async (t) => {
  for (const port of await ports(t)) {
    const started = Date.now();
    const r = spawnSync(process.execPath, ["server/db/migrate.js"], {
      cwd: APP,
      env: childEnv({
        DATABASE_URL: `postgres://owner_x:${MARK}@127.0.0.1:${port}/d`,
      }),
      encoding: "utf8",
      timeout: 20000,
    });
    assert.notEqual(r.status, 0);
    assert.ok(Date.now() - started < 15000, `${Date.now() - started} ms`);
    // Exactly one of the two lines of a database that does not answer: an exit with no line, or with
    // another one (the fallback «an unexpected error» included), is red.
    const lines = r.stderr.trim().split("\n");
    assert.equal(lines.length, 1, r.stderr);
    assert.match(
      lines[0],
      /^migrate: refused: (the database does not answer|no answer from the database)$/,
    );
    for (const bad of ["127.0.0.1", String(port), "owner_x", MARK])
      assert.ok(!r.stderr.includes(bad), bad);
    assert.doesNotMatch(r.stderr, /^\s+at /m);
  }
});

test("DD-2 the server stays alive and serves / and /nope", async (t) => {
  for (const port of await ports(t)) {
    const s = startNode(t, {
      PORT: "0",
      DATABASE_URL: `postgres://owner_x:${MARK}@127.0.0.1:${port}/d`,
    });
    const p = await s.ready;
    // The answers of criteria 4 and 5: the status, the type and the bytes of the page.
    const root = await request(p, "/");
    assert.equal(root.status, 200);
    assert.equal(root.headers["content-type"], "text/html; charset=utf-8");
    assert.ok(
      root.body.equals(INDEX),
      "the body of / is app/public/index.html",
    );
    const nope = await request(p, "/nope");
    assert.equal(nope.status, 404);
    assert.equal(nope.headers["content-type"], "text/html; charset=utf-8");
    assert.ok(nope.body.equals(NOT_FOUND), "the body of /nope is 404.html");
    const again = await request(p, "/");
    assert.equal(again.status, 200);
    assert.ok(again.body.equals(INDEX));
    assert.ok(!s.err().includes(MARK) && !s.err().includes("owner_x"));
    s.child.kill("SIGTERM");
    await s.exited;
  }
});
