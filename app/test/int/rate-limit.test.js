import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { createEntry } from "../../api/index.js";
import { createFunctionApp } from "../../server/app.js";
import { readConfig } from "../../server/config.js";
import { ADMIN, authDb, authHarness } from "../fixtures/auth.js";
import { request, startNode } from "../fixtures/helpers.js";

// REQ-114 criterion 9 (the code design M2AUTH, 4.10, decisions/0137 Addition 4 SEC F2): the keys of the limits
// and the stored address are HMAC(SECRET_PEPPER, …) and no column or log line holds the address; the Node
// server reads only the socket address, the Vercel entry only x-forwarded-for; the first call over each limit
// answers 429 with Retry-After; an IPv6 client is limited by its /64; the lazy cleanup removes rows older
// than 24 h. The keys are recomputed here with node:crypto from the pepper the test gives.

const MIN = 60 * 1000;
const WINDOWS = {
  setup: 60 * MIN,
  login: 15 * MIN,
  reset: 15 * MIN,
  user: 10 * MIN,
};

/** @param {Buffer} pepper @param {string} label @param {string} text */
const mac = (pepper, label, text) =>
  crypto
    .createHmac("sha256", pepper)
    .update(`${label}\u0000${text}`, "utf8")
    .digest("hex");

/** Waits while the real clock is within `ms` of the end of a fixed window of `windowMs` (no fresh window mid-test). */
async function awayFromBoundary(
  /** @type {number} */ windowMs,
  /** @type {number} */ ms,
) {
  const left = windowMs - (Date.now() % windowMs);
  if (left < ms) await new Promise((r) => setTimeout(r, left + 50));
}

test("RL-1 after requests from planted addresses no column of rate_limits, auth_sessions, audit_log, login_delays, login_failures and no log line holds an address in clear; the stored values are the HMACs of the pepper", async (t) => {
  const h = await authHarness(t);
  const v4 = "203.0.113.77";
  const v6 = "2001:db8:77:1::5";
  await h.setup({ ip: v4 });
  const user = await h.signIn(
    await h.addUser({ email: "planted.user@example.test" }),
    { ip: v4 },
  );
  await h.call("POST", "/api/auth/login", {
    ip: v6,
    body: { email: ADMIN.email, password: "wrong-admin-pass-1" },
  });
  await h.call("POST", "/api/auth/login", {
    ip: v6,
    body: { email: "nobody@example.test", password: "wrong-pass-2x" },
  });
  await h.call("POST", "/api/auth/reset", {
    ip: v4,
    body: { code: "A".repeat(22), password: "reset-pass-123x" },
  });
  await h.call("GET", "/api/auth/me", { as: user, origin: null });
  const text = [
    ...(await Promise.all(
      [
        "rate_limits",
        "auth_sessions",
        "audit_log",
        "login_delays",
        "login_failures",
      ].map(async (tb) => JSON.stringify(await h.sql(`select * from ${tb}`))),
    )),
    JSON.stringify(h.logs),
  ].join("\n");
  for (const form of [
    v4,
    v6,
    "2001:db8:77:1::/64",
    "2001:db8:77:1",
    "2001:0db8",
    Buffer.from(v4).toString("hex"),
    Buffer.from(v4).toString("base64"),
    "203.0.113",
  ])
    assert.ok(!text.includes(form), `the address in clear: ${form}`);
  const sessions = await h.sql(
    "select ip_hmac from auth_sessions where user_id = $1",
    [user.id],
  );
  assert.deepEqual(sessions, [{ ip_hmac: mac(h.pepper, "ip", v4) }]);
  const keys = new Set(
    (await h.sql("select key from rate_limits")).map((r) => r.key),
  );
  for (const k of [
    mac(h.pepper, "rl", `setup\u0000${v4}`),
    mac(h.pepper, "rl", `login\u0000${v4}`),
    mac(h.pepper, "rl", `reset\u0000${v4}`),
    mac(h.pepper, "rl", "login\u00002001:db8:77:1::/64"),
  ])
    assert.ok(
      keys.has(k),
      "a limit key is the HMAC of the limit and the address",
    );
  for (const k of keys) assert.match(k, /^[0-9a-f]{64}$/);
  assert.deepEqual(await h.sql("select key from login_delays"), [
    { key: mac(h.pepper, "delay", "2001:db8:77:1::/64") },
  ]);
  for (const row of await h.sql(
    "select ip_hmac from audit_log where ip_hmac is not null",
  ))
    assert.ok(
      [mac(h.pepper, "ip", v4), mac(h.pepper, "ip", v6)].includes(row.ip_hmac),
    );
});

test("RL-2 on the Node server eleven logins from one socket, each with another X-Forwarded-For, end with 429 on the eleventh", async (t) => {
  await awayFromBoundary(15 * MIN, 30000);
  const s = startNode(t, {
    PORT: "0",
    SECRET_PEPPER: crypto.randomBytes(32).toString("base64url"),
  });
  const port = await s.ready;
  const answers = [];
  for (let i = 1; i <= 11; i++) {
    const r = await request(port, "/api/auth/login", {
      method: "POST",
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        "Content-Type": "application/json",
        "X-Forwarded-For": `198.51.100.${i}`,
        "X-Real-IP": `198.51.100.${100 + i}`,
        Forwarded: `for=198.51.100.${200 + i}`,
      },
      body: JSON.stringify({
        email: `n${i}@example.test`,
        password: "wrong-pass-xx",
      }),
    });
    answers.push([
      r.status,
      JSON.parse(r.body.toString()).error,
      r.headers["retry-after"] ?? null,
    ]);
  }
  assert.deepEqual(
    answers.slice(0, 10),
    Array.from({ length: 10 }, () => [401, "invalid_credentials", null]),
  );
  assert.equal(answers[10][0], 429, JSON.stringify(answers[10]));
  assert.equal(answers[10][1], "rate_limited");
  assert.match(String(answers[10][2]), /^[1-9][0-9]*$/);
  s.child.kill("SIGKILL");
});

test("RL-3 the Vercel entry reads only x-forwarded-for: a planted x-real-ip changes nothing, and another x-forwarded-for value gets its own window", async (t) => {
  await awayFromBoundary(15 * MIN, 30000);
  const db = await authDb();
  t.after(() => db.raw.close());
  const BASE = "https://app.example.test";
  const entry = createEntry(() =>
    createFunctionApp(
      readConfig({
        APP_ORIGIN: BASE,
        SECRET_PEPPER: crypto.randomBytes(32).toString("base64url"),
      }),
      { adapter: db.raw, log: () => {} },
    ),
  );
  /** @param {Record<string, string>} headers */
  const reset = async (headers) => {
    const r = await entry.fetch(
      new Request(`${BASE}/api/index?__p=auth/reset`, {
        method: "POST",
        headers: {
          Origin: BASE,
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          code: crypto.randomBytes(16).toString("base64url"),
          password: "entry-reset-pass-1",
        }),
      }),
    );
    return [r.status, (await r.json()).error];
  };
  for (let i = 1; i <= 10; i++)
    assert.deepEqual(
      await reset({
        "x-forwarded-for": "198.51.100.7",
        "x-real-ip": `192.0.2.${i}`,
      }),
      [400, "reset_invalid"],
      `call ${i}`,
    );
  assert.deepEqual(
    await reset({
      "x-forwarded-for": "198.51.100.7",
      "x-real-ip": "192.0.2.99",
    }),
    [429, "rate_limited"],
  );
  assert.deepEqual(
    await reset({
      "x-forwarded-for": "198.51.100.8",
      "x-real-ip": "192.0.2.1",
    }),
    [400, "reset_invalid"],
    "another x-forwarded-for",
  );
  // Without x-forwarded-for every request shares one bucket, whatever x-real-ip says.
  for (let i = 1; i <= 10; i++)
    assert.deepEqual(
      await reset({ "x-real-ip": `192.0.2.${i}` }),
      [400, "reset_invalid"],
      `no x-forwarded-for ${i}`,
    );
  assert.deepEqual(await reset({ "x-real-ip": "192.0.2.200" }), [
    429,
    "rate_limited",
  ]);
  // An x-forwarded-for that is not one address is the shared bucket too.
  assert.deepEqual(
    await reset({ "x-forwarded-for": "198.51.100.9, 198.51.100.10" }),
    [429, "rate_limited"],
  );
  assert.deepEqual(await reset({ "x-forwarded-for": "not-an-address" }), [
    429,
    "rate_limited",
  ]);
});

test("RL-4 the first call over each limit (setup 5 per hour, login and reset 10 per 15 minutes per address, 600 per 10 minutes per session) answers 429 with Retry-After and the count stays at the limit", async (t) => {
  const h = await authHarness(t);
  h.setNow(Date.UTC(2026, 10, 24, 9, 3, 17, 250));
  // A session by the login alone: GET /api/auth/me of signIn would be the first count of the user window.
  const u = await h.addUser();
  u.cookie = (
    await h.call("POST", "/api/auth/login", {
      ip: "192.0.2.250",
      body: { email: u.email, password: u.password },
    })
  ).cookie;
  let n = 0;
  /** @type {Array<[keyof typeof WINDOWS, number, () => Promise<import("../fixtures/auth.js").Answer>, string]>} */
  const limits = [
    [
      "setup",
      5,
      () =>
        h.call("POST", "/api/auth/setup", {
          ip: "192.0.2.1",
          body: {
            token: "x".repeat(43),
            email: "a@example.test",
            name: "A",
            password: "setup-pass-123x",
          },
        }),
      "192.0.2.1",
    ],
    [
      "login",
      10,
      () =>
        h.call("POST", "/api/auth/login", {
          ip: "192.0.2.2",
          body: {
            email: `nobody${++n}@example.test`,
            password: "wrong-pass-123",
          },
        }),
      "192.0.2.2",
    ],
    [
      "reset",
      10,
      () =>
        h.call("POST", "/api/auth/reset", {
          ip: "192.0.2.3",
          body: { code: "B".repeat(22), password: "reset-pass-123x" },
        }),
      "192.0.2.3",
    ],
    [
      "user",
      600,
      () => h.call("GET", "/api/auth/me", { as: u, origin: null }),
      "",
    ],
  ];
  for (const [name, max, send] of limits) {
    for (let i = 0; i < max; i++) {
      const r = await send();
      assert.notEqual(r.status, 429, `${name} call ${i + 1}`);
    }
    h.tick(1000);
    const r = await send();
    assert.equal(r.status, 429, name);
    assert.deepEqual(r.json, { error: "rate_limited" });
    const w = WINDOWS[name];
    const ws = Math.floor(h.now() / w) * w;
    assert.equal(
      r.headers.get("retry-after"),
      String(Math.ceil((ws + w - h.now()) / 1000)),
      name,
    );
    assert.ok(!/minut|секунд|минут/i.test(r.text), "no duration in the answer");
  }
  const counts = (
    await h.sql("select count from rate_limits order by count")
  ).map((r) => r.count);
  for (const max of [5, 10, 10, 600])
    assert.ok(counts.includes(max), `a window at its limit ${max}: ${counts}`);
  assert.ok(!counts.some((c) => c > 600));
});

test("RL-5 the lazy cleanup (injected random below 0.01) removes rate_limits, login_delays and login_failures rows older than 24 h and expired sessions, tokens and codes older than 30 days, and keeps newer rows", async (t) => {
  let random = 1;
  const h = await authHarness(t, { random: () => random });
  const admin = await h.signIn(await h.setup());
  const u = await h.signIn(await h.addUser());
  await h.reauthToken(u, "settings");
  const link = await h.call("POST", `/api/admin/users/${u.id}/reset-link`, {
    as: admin,
    reauth: await h.reauthToken(admin, "reset_link"),
    body: {},
  });
  assert.equal(link.status, 200);
  await h.call("POST", "/api/auth/login", {
    ip: "192.0.2.60",
    body: { email: ADMIN.email, password: "wrong-admin-pass-9" },
  });
  await h.call("POST", "/api/auth/login", {
    ip: "192.0.2.61",
    body: { email: "ghost@example.test", password: "wrong-pass-9x" },
  });
  const n = async (/** @type {string} */ tb) =>
    (await h.sql(`select count(*)::int as n from ${tb}`))[0].n;
  const old = {
    rate_limits: await n("rate_limits"),
    login_delays: await n("login_delays"),
    login_failures: await n("login_failures"),
  };
  assert.ok(
    old.rate_limits > 0 && old.login_delays === 1 && old.login_failures === 1,
  );
  // 24 h − 1 s later with the cleanup drawn: nothing is old enough.
  h.tick(24 * 3600 * 1000 - 1000);
  random = 0.0099;
  const fresh = await h.signIn(
    { ...u, cookie: null, csrf: null },
    { ip: "192.0.2.62" },
  );
  assert.equal(await n("login_delays"), 1);
  assert.equal(await n("login_failures"), 1);
  // 24 h + 1 s: with random ≥ 0.01 nothing is removed, below 0.01 the old rows go and the newer stay.
  h.tick(2000);
  random = 0.01;
  await h.call("GET", "/api/auth/me", { as: fresh, origin: null });
  assert.equal(await n("login_delays"), 1, "random 0.01 runs no cleanup");
  random = 0.0099;
  await h.call("GET", "/api/auth/me", { as: fresh, origin: null });
  assert.equal(await n("login_delays"), 0);
  assert.equal(await n("login_failures"), 0);
  const windows = (await h.sql("select window_start from rate_limits")).map(
    (r) => new Date(r.window_start).getTime(),
  );
  assert.ok(windows.length > 0);
  for (const w of windows)
    assert.ok(
      w >= h.now() - 24 * 3600 * 1000,
      "only windows of the last 24 h stay",
    );
  // Sessions 30 days after their absolute end, tokens and codes 30 days after their expiry.
  assert.ok((await n("auth_sessions")) >= 3);
  h.tick(37 * 24 * 3600 * 1000 + 1000);
  random = 0.5;
  const late = await h.signIn(await h.addUser(), { ip: "192.0.2.63" });
  const before = {
    s: await n("auth_sessions"),
    r: await n("reauth_tokens"),
    p: await n("password_resets"),
  };
  random = 0.001;
  await h.call("GET", "/api/auth/me", { as: late, origin: null });
  assert.deepEqual(await h.sql("select user_id from auth_sessions"), [
    { user_id: late.id },
  ]);
  assert.equal(await n("reauth_tokens"), 0);
  assert.equal(await n("password_resets"), 0);
  assert.ok(before.s > 1 && before.r > 0 && before.p > 0);
});

test("RL-6 two IPv6 addresses of one /64 share one login window and one admin delay row; an address of another /64 does not", async (t) => {
  const h = await authHarness(t);
  const admin = await h.setup();
  const a = "2001:db8:5:6::1";
  const b = "2001:db8:5:6:ffff:ffff:ffff:2";
  const c = "2001:db8:5:7::1";
  const wrong = (/** @type {string} */ ip) =>
    h.call("POST", "/api/auth/login", {
      ip,
      body: { email: admin.email, password: "wrong-admin-pass-v6" },
    });
  assert.equal((await wrong(a)).status, 401);
  const shared = await wrong(b);
  assert.equal(shared.status, 429, "the delay of the /64");
  assert.deepEqual(shared.json, { error: "rate_limited" });
  assert.equal((await wrong(c)).status, 401, "another /64");
  assert.equal(
    (await h.sql("select count(*)::int as n from login_delays"))[0].n,
    2,
  );
  h.tick(60 * MIN);
  for (let i = 0; i < 10; i++) {
    const ip = i % 2 ? a : b;
    const r = await h.call("POST", "/api/auth/login", {
      ip,
      body: { email: `n${i}@example.test`, password: "wrong-pass-v6x" },
    });
    assert.equal(r.status, 401, `login ${i + 1}`);
  }
  const eleventh = await h.call("POST", "/api/auth/login", {
    ip: "2001:db8:5:6:1:2:3:4",
    body: { email: "n11@example.test", password: "wrong-pass-v6x" },
  });
  assert.equal(eleventh.status, 429);
  assert.deepEqual(eleventh.json, { error: "rate_limited" });
  const other = await h.call("POST", "/api/auth/login", {
    ip: c,
    body: { email: "n12@example.test", password: "wrong-pass-v6x" },
  });
  assert.equal(other.status, 401);
});
