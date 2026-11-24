import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { test } from "node:test";
import { sha256Hex, totpCode } from "../fixtures/auth.js";
import { request, startNode, waitFor } from "../fixtures/helpers.js";

// REQ-108 criterion 10 (request id and logs); REQ-114 criterion 12 (LG-2: no personal data or secret of the
// account routes in the server's output).

const KEYS = [
  "ts",
  "level",
  "req_id",
  "route",
  "status",
  "ms",
  "actor_kind",
  "org_id",
  "job_id",
  "code",
];

test("LG-1 one JSON line per request, the request id, no personal data", async (t) => {
  const s = startNode(t, { PORT: "0" });
  const port = await s.ready;
  const a = await request(port, "/nope?t=QMARK1", {
    method: "POST",
    body: "BMARK2",
    headers: {
      Cookie: "c=CMARK3",
      Authorization: "Bearer AMARK4",
      "X-Forwarded-For": "203.0.113.7",
    },
  });
  const b = await request(port, "/api/health");
  const planted = await request(port, "/", {
    headers: { "X-Request-Id": "planted-id" },
  });
  assert.ok(
    a.headers["x-request-id"] &&
      a.headers["x-request-id"] !== b.headers["x-request-id"],
  );
  assert.ok(planted.headers["x-request-id"]);
  assert.notEqual(planted.headers["x-request-id"], "planted-id");
  const lines = () =>
    s
      .out()
      .split("\n")
      .filter((l) => l.startsWith("{"));
  await waitFor(() => lines().length >= 3, 5000, "three log lines");
  assert.equal(lines().length, 3);
  for (const l of lines())
    for (const k of Object.keys(JSON.parse(l))) assert.ok(KEYS.includes(k), k);
  assert.deepEqual(
    lines().map((l) => JSON.parse(l).req_id),
    [a, b, planted].map((r) => r.headers["x-request-id"]),
  );
  const all = s.out() + s.err();
  for (const m of [
    "QMARK1",
    "BMARK2",
    "CMARK3",
    "AMARK4",
    "203.0.113.7",
    "planted-id",
  ])
    assert.ok(!all.includes(m), m);
});

/**
 * A request from a chosen local address (127.0.0.5 is a loopback address, so the server's socket sees a
 * client address that the test planted).
 * @param {number} port
 * @param {string} method
 * @param {string} path
 * @param {{ body?: unknown, cookie?: string, csrf?: string, reauth?: string }} [o]
 * @returns {Promise<{ status: number, json: any, setCookie: string[] }>}
 */
function from5(port, method, path, o = {}) {
  /** @type {Record<string, string>} */
  const headers = { Origin: `http://127.0.0.1:${port}` };
  const body = o.body === undefined ? undefined : JSON.stringify(o.body);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (o.cookie) headers.Cookie = o.cookie;
  if (o.csrf) headers["x-sai-csrf"] = o.csrf;
  if (o.reauth) headers["x-sai-reauth"] = o.reauth;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers,
        localAddress: "127.0.0.5",
        agent: false,
      },
      (res) => {
        /** @type {Buffer[]} */
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // not JSON
          }
          const sc = res.headers["set-cookie"];
          resolve({
            status: res.statusCode ?? 0,
            json,
            setCookie: Array.isArray(sc) ? sc : [],
          });
        });
      },
    );
    req.setTimeout(15000, () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

test("LG-2 after setup, a right and a wrong login, logout, a password change, re-auth, a TOTP enrolment with a code and a reset link, the server's output holds no planted e-mail, name, password, token, code, secret or client address, and every line keeps the keys of LG-1", async (t) => {
  const setupToken = crypto.randomBytes(32).toString("base64url");
  const s = startNode(t, {
    PORT: "0",
    SECRET_PEPPER: crypto.randomBytes(32).toString("base64url"),
    SETUP_TOKEN_HASH: sha256Hex(setupToken),
  });
  const port = await s.ready;
  const email = "Planted.Owner.Qx7@Example.test";
  const name = "Plantedname Wq";
  const p1 = "planted-pass-one-Q1";
  const p2 = "planted-pass-two-Q2";
  const p3 = "planted-pass-three-Q3";
  const wrong = "planted-wrong-pass-Q4";
  const planted = [
    email,
    email.toLowerCase(),
    name,
    p1,
    p2,
    p3,
    wrong,
    setupToken,
    "127.0.0.5",
  ];
  const setup = await from5(port, "POST", "/api/auth/setup", {
    body: { token: setupToken, email, name, password: p1 },
  });
  assert.equal(setup.status, 201);
  const login = await from5(port, "POST", "/api/auth/login", {
    body: { email, password: p1 },
  });
  assert.equal(login.status, 200);
  const cookie = login.setCookie[0].split(";")[0];
  planted.push(cookie.split("=")[1]);
  const me = await from5(port, "GET", "/api/auth/me", { cookie });
  const csrf = me.json.csrf;
  planted.push(csrf);
  const s1 = { cookie, csrf };
  const reauth = async (
    /** @type {string} */ purpose,
    /** @type {string} */ password,
    code = "",
  ) => {
    const r = await from5(port, "POST", "/api/auth/reauth", {
      ...s1,
      body: { password, purpose, ...(code ? { code } : {}) },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    planted.push(r.json.token);
    return r.json.token;
  };
  const enrol = await from5(port, "POST", "/api/admin/totp/enrol", {
    ...s1,
    reauth: await reauth("totp_enrol", p1),
    body: {},
  });
  assert.equal(enrol.status, 200);
  const secret = enrol.json.secret;
  const code = totpCode(secret, Date.now());
  planted.push(secret, code);
  const confirm = await from5(port, "POST", "/api/admin/totp/confirm", {
    ...s1,
    body: { code },
  });
  assert.equal(confirm.status, 200);
  const recovery = confirm.json.recovery_codes;
  planted.push(...recovery);
  const change = await from5(port, "POST", "/api/auth/password", {
    ...s1,
    body: { current: p1, next: p2 },
  });
  assert.equal(change.status, 200);
  const link = await from5(
    port,
    "POST",
    `/api/admin/users/${me.json.id}/reset-link`,
    {
      ...s1,
      reauth: await reauth("reset_link", p2, recovery[0]),
      body: {},
    },
  );
  assert.equal(link.status, 200);
  const resetCode = link.json.link.split("#c=")[1];
  planted.push(resetCode);
  assert.equal(
    (
      await from5(port, "POST", "/api/auth/reset", {
        body: { code: resetCode, password: p3 },
      })
    ).status,
    200,
  );
  const again = await from5(port, "POST", "/api/auth/login", {
    body: { email, password: p3, code: recovery[1] },
  });
  assert.equal(again.status, 200);
  const cookie2 = again.setCookie[0].split(";")[0];
  planted.push(cookie2.split("=")[1]);
  const csrf2 = (await from5(port, "GET", "/api/auth/me", { cookie: cookie2 }))
    .json.csrf;
  planted.push(csrf2);
  assert.equal(
    (
      await from5(port, "POST", "/api/auth/logout", {
        cookie: cookie2,
        csrf: csrf2,
        body: {},
      })
    ).status,
    200,
  );
  const bad = await from5(port, "POST", "/api/auth/login", {
    body: { email, password: wrong, code: recovery[2] },
  });
  assert.equal(bad.status, 401);
  const lines = () =>
    s
      .out()
      .split("\n")
      .filter((l) => l.startsWith("{"));
  await waitFor(
    () => lines().some((l) => JSON.parse(l).status === 401),
    5000,
    "the last log line",
  );
  assert.ok(lines().length >= 14, `${lines().length} lines`);
  for (const l of lines())
    for (const k of Object.keys(JSON.parse(l))) assert.ok(KEYS.includes(k), k);
  assert.ok(
    lines().some((l) => JSON.parse(l).actor_kind === "admin"),
    "a line of a signed-in request names its actor kind",
  );
  const all = s.out() + s.err();
  for (const m of planted) {
    assert.ok(m && m.length >= 6, "a planted value");
    assert.ok(
      !all.includes(m),
      `the output holds a planted value: ${m.slice(0, 6)}…`,
    );
  }
  assert.ok(
    !all.toLowerCase().includes("planted"),
    "no part of a planted text",
  );
  s.child.kill("SIGKILL");
});
