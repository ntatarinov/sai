import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { test } from "node:test";
import { headerFailures } from "../../scripts/smoke.js";
import { APP } from "../fixtures/helpers.js";

// REQ-109 criterion 5, with stand-in servers on port 0.

const GOOD = {
  "Content-Security-Policy": "default-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

/** @param {import("node:test").TestContext} t @param {(req: http.IncomingMessage, res: http.ServerResponse, port: number) => void} handler */
async function stand(t, handler) {
  /** @type {string[]} */
  const seen = [];
  const s = http.createServer((req, res) => {
    seen.push(req.url ?? "");
    handler(req, res, /** @type {net.AddressInfo} */ (s.address()).port);
  });
  await new Promise((r) => s.listen(0, "127.0.0.1", () => r(null)));
  t.after(() => new Promise((r) => s.close(() => r(null))));
  return { port: /** @type {net.AddressInfo} */ (s.address()).port, seen };
}

/** @param {any} over */
const site =
  (over = {}) =>
  (
    /** @type {http.IncomingMessage} */ req,
    /** @type {http.ServerResponse} */ res,
    /** @type {number} */ port,
  ) => {
    const url = req.url ?? "/";
    const h = { ...GOOD, ...(over.headers ?? {}) };
    for (const k of Object.keys(h)) if (h[k] === null) delete h[k];
    if (url === "/" && (req.headers.host ?? "").startsWith("localhost")) {
      res
        .writeHead(over.previewStatus ?? 307, {
          Location: over.previewLocation
            ? over.previewLocation(port)
            : `http://127.0.0.1:${port}/`,
        })
        .end();
    } else if (url === "/")
      res
        .writeHead(over.rootStatus ?? 200, {
          ...h,
          ...(over.rootLocation ? { Location: over.rootLocation } : {}),
        })
        .end("<p>x</p>");
    else if (url === "/api/health")
      res
        .writeHead(over.healthStatus ?? 200, {
          "Content-Type": "application/json",
        })
        .end(
          JSON.stringify({
            ok: true,
            version: over.version === null ? undefined : (over.version ?? "v1"),
            node: over.node ?? "v22.23.4",
          }),
        );
    else if (url.startsWith("/api/")) {
      if (over.nested) over.nested(res);
      else
        res
          .writeHead(404, { "Content-Type": "application/json" })
          .end('{"error":"not_found"}');
    } else
      res
        .writeHead(over.randomStatus ?? 404, { "Content-Type": "text/html" })
        .end("<p>404</p>");
  };

/** @param {string[]} args */
function smoke(args) {
  return new Promise((resolve) => {
    const started = Date.now();
    const c = spawn(process.execPath, ["scripts/smoke.js", ...args], {
      cwd: APP,
      env: { PATH: process.env.PATH ?? "" },
    });
    let out = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (out += d));
    c.on("exit", (code) => resolve({ code, out, ms: Date.now() - started }));
  });
}

test("SM-1 a right stand-in passes with one line per check", async (t) => {
  const s = await stand(t, site());
  const r = /** @type {any} */ (
    await smoke([
      "--base",
      `http://127.0.0.1:${s.port}`,
      "--preview",
      `http://localhost:${s.port}`,
      "--expect-version",
      "v1",
    ])
  );
  assert.equal(r.code, 0, r.out);
  assert.equal(
    r.out
      .trim()
      .split("\n")
      .filter((l) => l.startsWith("smoke: ok")).length,
    8,
  );
});

test("SM-2 each wrong answer fails and names its check", async (t) => {
  const cases = [
    [{ rootStatus: 500 }, "/ 200"],
    [{ headers: { "Content-Security-Policy": null } }, "headers of /"],
    [
      { headers: { "Content-Security-Policy": "script-src 'unsafe-inline'" } },
      "headers of /",
    ],
    [{ headers: { "X-Content-Type-Options": null } }, "headers of /"],
    [{ headers: { "X-Frame-Options": "SAMEORIGIN" } }, "headers of /"],
    [{ headers: { "Referrer-Policy": null } }, "headers of /"],
    [{ headers: { "X-Robots-Tag": "all" } }, "headers of /"],
    [{ headers: { "X-Powered-By": "x" } }, "headers of /"],
    [{ headers: { Server: "srv/1.2" } }, "headers of /"],
    [{ healthStatus: 503 }, "/api/health 200"],
    [{ version: null }, "/api/health version"],
    [{ version: "v2" }, "/api/health version"],
    [{ node: "v22.23.3" }, "/api/health node"],
    [
      {
        nested: (/** @type {any} */ res) =>
          res.writeHead(404, { "Content-Type": "text/html" }).end("<p>no</p>"),
      },
      "nested /api 404",
    ],
    [
      {
        nested: (/** @type {any} */ res) =>
          res
            .writeHead(200, { "Content-Type": "application/json" })
            .end('{"error":"x"}'),
      },
      "nested /api 404",
    ],
    [
      {
        nested: (/** @type {any} */ res) =>
          res
            .writeHead(404, { "Content-Type": "application/json" })
            .end('{"error":"x","more":1}'),
      },
      "nested /api 404",
    ],
    [{ randomStatus: 200 }, "random path 404"],
    [{ previewStatus: 200 }, "preview 307"],
  ];
  assert.equal(cases.length, 18);
  for (const [over, name] of cases) {
    const s = await stand(t, site(over));
    const r = /** @type {any} */ (
      await smoke([
        "--base",
        `http://127.0.0.1:${s.port}`,
        "--preview",
        `http://localhost:${s.port}`,
        "--expect-version",
        "v1",
      ])
    );
    assert.notEqual(r.code, 0, JSON.stringify(over));
    assert.ok(r.out.includes(`FAIL ${name}`), `${name}: ${r.out}`);
  }
});

test("SM-3 HSTS only for an https base (the pure decision)", () => {
  const h = new Headers(GOOD);
  assert.deepEqual(headerFailures(h, false), []);
  assert.deepEqual(headerFailures(h, true), ["hsts"]);
  h.set("Strict-Transport-Security", "max-age=31536000");
  assert.deepEqual(headerFailures(h, true), []);
});

test("SM-4 a redirect of / is red and its target gets no request", async (t) => {
  const target = await stand(t, (_q, res) => res.end("x"));
  const s = await stand(
    t,
    site({
      rootStatus: 302,
      rootLocation: `http://127.0.0.1:${target.port}/elsewhere`,
    }),
  );
  const r = /** @type {any} */ (
    await smoke(["--base", `http://127.0.0.1:${s.port}`])
  );
  assert.notEqual(r.code, 0);
  assert.deepEqual(target.seen, []);
});

test("SM-5 a base that is not http or https is refused with no request", async () => {
  for (const base of ["file:///etc", "ftp://127.0.0.1/"]) {
    const r = /** @type {any} */ (await smoke(["--base", base]));
    assert.equal(r.code, 2);
  }
});

test("SM-6 a refused port and a silent stand-in end within 15 000 ms, one plain line, no stack", async (t) => {
  /** @type {Set<net.Socket>} */
  const socks = new Set();
  const silent = net.createServer((sock) => socks.add(sock));
  await new Promise((r) => silent.listen(0, "127.0.0.1", () => r(null)));
  t.after(() => {
    for (const k of socks) k.destroy();
    silent.close();
  });
  const free = net.createServer();
  await new Promise((r) => free.listen(0, "127.0.0.1", () => r(null)));
  const fp = /** @type {net.AddressInfo} */ (free.address()).port;
  await new Promise((r) => free.close(() => r(null)));
  for (const port of [
    fp,
    /** @type {net.AddressInfo} */ (silent.address()).port,
  ]) {
    const r = /** @type {any} */ (
      await smoke(["--base", `http://127.0.0.1:${port}`])
    );
    assert.notEqual(r.code, 0);
    assert.ok(r.ms < 15000, `${r.ms} ms`);
    assert.doesNotMatch(r.out, /^\s+at /m);
    // Exactly the one line of a site that does not answer: an exit with no line is red.
    assert.equal(r.out.trim(), "smoke: FAIL the site did not answer", r.out);
  }
});

test("SM-7 a preview 307 to another origin is red; without --expect-version any version string passes", async (t) => {
  for (const other of [
    (/** @type {number} */ p) => `http://127.0.0.1:${p === 65535 ? 1 : p + 1}/`,
    (/** @type {number} */ p) => `https://127.0.0.1:${p}/`,
    () => "http://evil.example/",
  ]) {
    const s = await stand(t, site({ previewLocation: other }));
    const r = /** @type {any} */ (
      await smoke([
        "--base",
        `http://127.0.0.1:${s.port}`,
        "--preview",
        `http://localhost:${s.port}`,
      ])
    );
    assert.notEqual(r.code, 0, other(s.port));
    assert.ok(r.out.includes("FAIL preview 307"), `${other(s.port)}: ${r.out}`);
  }
  const s = await stand(t, site({ version: "any-text 1.2" }));
  const r = /** @type {any} */ (
    await smoke(["--base", `http://127.0.0.1:${s.port}`])
  );
  assert.equal(r.code, 0, r.out);
  assert.ok(r.out.includes("smoke: ok /api/health version"), r.out);
});
