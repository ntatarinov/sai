import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN, authHarness, totpCode } from "../fixtures/auth.js";

// REQ-114 criterion 5 (the code design M2AUTH, 4.9.5, 4.10, C16, C19), with the clock injected: the lock of an
// ordinary account, its 15-minute window, the admin who is never locked but delayed per address (1, 2, 4 … 60
// s, no scrypt while delayed), the login limit per address, the separate re-auth counter, the uniform
// answers of an e-mail without an account, and the TOTP failures that feed the admin delay.

const MIN = 60 * 1000;

/** @typedef {import("../fixtures/auth.js").AuthHarness} H */

/**
 * @param {H} h
 * @param {string} email
 * @param {string} password
 * @param {string} ip
 * @param {string} [code]
 */
async function login(h, email, password, ip, code) {
  const before = h.hasher.count();
  const r = await h.call("POST", "/api/auth/login", {
    ip,
    body: { email, password, ...(code ? { code } : {}) },
  });
  return { r, scrypts: h.hasher.count() - before };
}

/** @param {H} h @param {string} id */
const counters = async (h, id) =>
  (
    await h.sql(
      "select failed_logins, locked_until, reauth_failures, reauth_locked_until from users where id = $1",
      [id],
    )
  )[0];

test("LO-1 an ordinary account after 5 wrong passwords in 15 minutes refuses the sixth attempt, also with the right password, with 429 locked and Retry-After, without scrypt; after 15 minutes the right password works", async (t) => {
  const h = await authHarness(t);
  const u = await h.addUser();
  const start = h.now();
  for (let i = 1; i <= 5; i++) {
    const { r, scrypts } = await login(
      h,
      u.email,
      `wrong-pass-${i}x`,
      `192.0.2.${i}`,
    );
    assert.equal(r.status, 401, `failure ${i}`);
    assert.deepEqual(r.json, { error: "invalid_credentials" });
    assert.equal(scrypts, 1);
    h.tick(2 * MIN);
  }
  const lockedAt = start + 4 * 2 * MIN;
  for (const [password, ip] of [
    [u.password, "192.0.2.6"],
    ["wrong-pass-6x", "192.0.2.7"],
  ]) {
    const { r, scrypts } = await login(h, u.email, password, ip);
    assert.equal(r.status, 429, password);
    assert.deepEqual(r.json, { error: "locked" });
    assert.equal(
      r.headers.get("retry-after"),
      String(Math.ceil((lockedAt + 15 * MIN - h.now()) / 1000)),
    );
    assert.equal(scrypts, 0, "a locked account runs no scrypt");
    assert.deepEqual(r.setCookie, []);
  }
  h.setNow(lockedAt + 15 * MIN - 1000);
  assert.equal(
    (await login(h, u.email, u.password, "192.0.2.8")).r.status,
    429,
    "1 s before the end",
  );
  h.setNow(lockedAt + 15 * MIN);
  const ok = await login(h, u.email, u.password, "192.0.2.9");
  assert.equal(ok.r.status, 200, "after 15 minutes");
  assert.deepEqual(await counters(h, u.id), {
    failed_logins: 0,
    locked_until: null,
    reauth_failures: 0,
    reauth_locked_until: null,
  });
});

test("LO-2 4 wrong, 16 minutes, 4 wrong does not lock; 4 wrong, 14 minutes, 1 wrong locks", async (t) => {
  const h = await authHarness(t);
  const u = await h.addUser();
  for (let i = 0; i < 4; i++)
    await login(h, u.email, "wrong-pass-aa", `192.0.2.${10 + i}`);
  h.tick(16 * MIN);
  for (let i = 0; i < 4; i++) {
    const { r } = await login(h, u.email, "wrong-pass-bb", `192.0.2.${20 + i}`);
    assert.equal(r.status, 401);
  }
  assert.equal(
    (await login(h, u.email, u.password, "192.0.2.30")).r.status,
    200,
  );
  const v = await h.addUser();
  for (let i = 0; i < 4; i++)
    await login(h, v.email, "wrong-pass-cc", `192.0.2.${40 + i}`);
  h.tick(14 * MIN);
  assert.equal(
    (await login(h, v.email, "wrong-pass-dd", "192.0.2.50")).r.status,
    401,
  );
  const locked = await login(h, v.email, v.password, "192.0.2.51");
  assert.equal(locked.r.status, 429);
  assert.deepEqual(locked.r.json, { error: "locked" });
});

test("LO-3 the admin after 20 wrong passwords is not locked: from the first address the n-th failure delays the next attempt 2^(n-1) s (at most 60) with Retry-After and no scrypt; the right password from a second address logs in at once", async (t) => {
  const h = await authHarness(t);
  const admin = await h.setup();
  const ip = "192.0.2.77";
  const LIMIT = 9;
  const WINDOW = 15 * MIN;
  let windowStart = Math.floor(h.now() / WINDOW) * WINDOW;
  let inWindow = 0;
  /** Keeps the requests of this address under the login limit by moving to the next window. */
  const room = (/** @type {number} */ n) => {
    if (Math.floor(h.now() / WINDOW) * WINDOW !== windowStart) {
      windowStart = Math.floor(h.now() / WINDOW) * WINDOW;
      inWindow = 0;
    }
    if (inWindow + n > LIMIT) {
      windowStart += WINDOW;
      h.setNow(windowStart);
      inWindow = 0;
    }
    inWindow += n;
  };
  for (let n = 1; n <= 20; n++) {
    room(3);
    const fail = await login(h, admin.email, `wrong-admin-${n}x`, ip);
    assert.equal(fail.r.status, 401, `failure ${n}: ${fail.r.text}`);
    assert.equal(fail.scrypts, 1);
    const delay = Math.min(2 ** (n - 1), 60);
    const at = h.now();
    const early = await login(h, admin.email, admin.password, ip);
    assert.equal(early.r.status, 429, `after failure ${n}`);
    assert.deepEqual(early.r.json, { error: "rate_limited" });
    assert.equal(early.r.headers.get("retry-after"), String(delay), `n = ${n}`);
    assert.equal(early.scrypts, 0, "no scrypt while delayed");
    if (delay > 1) {
      h.setNow(at + (delay - 1) * 1000);
      const late = await login(h, admin.email, admin.password, ip);
      assert.equal(late.r.status, 429);
      assert.equal(late.r.headers.get("retry-after"), "1");
      assert.equal(late.scrypts, 0);
    } else inWindow -= 1;
    h.setNow(at + delay * 1000);
  }
  assert.deepEqual(await counters(h, admin.id), {
    failed_logins: 0,
    locked_until: null,
    reauth_failures: 0,
    reauth_locked_until: null,
  });
  const second = await login(h, ADMIN.email, ADMIN.password, "192.0.2.78");
  assert.equal(second.r.status, 200, "a second address at once");
  room(1);
  const first = await login(h, ADMIN.email, ADMIN.password, ip);
  assert.equal(first.r.status, 200, "the first address after the delay");
  assert.deepEqual(
    await h.sql("select count(*)::int as n from login_delays"),
    [{ n: 0 }],
    "a success removes the delay row of its address",
  );
});

test("LO-4 login is limited to 10 per 15 minutes per address for an ordinary account and for the admin: the eleventh answers 429 with Retry-After", async (t) => {
  const h = await authHarness(t);
  const admin = await h.setup();
  const u = await h.addUser();
  for (const [
    a,
    ip,
  ] of /** @type {Array<[import("../fixtures/auth.js").Actor, string]>} */ ([
    [u, "192.0.2.90"],
    [admin, "192.0.2.91"],
  ])) {
    for (let i = 0; i < 10; i++) {
      const { r } = await login(h, a.email, a.password, ip);
      assert.equal(r.status, 200, `${a.role} login ${i + 1}`);
    }
    const before = await h.digest();
    const { r, scrypts } = await login(h, a.email, a.password, ip);
    assert.equal(r.status, 429, a.role);
    assert.deepEqual(r.json, { error: "rate_limited" });
    const ws = Math.floor(h.now() / (15 * MIN)) * 15 * MIN;
    assert.equal(
      r.headers.get("retry-after"),
      String(Math.ceil((ws + 15 * MIN - h.now()) / 1000)),
    );
    assert.equal(scrypts, 0);
    assert.deepEqual(
      await h.digest(),
      before,
      "the refused request changes no row",
    );
    assert.equal(
      (await login(h, a.email, a.password, "192.0.2.92")).r.status,
      200,
      "another address",
    );
  }
});

test("LO-5 five wrong re-auth passwords refuse re-auth for 15 minutes (429 reauth_locked) while the login still works, and the login counters stay unchanged", async (t) => {
  const h = await authHarness(t);
  const u = await h.signIn(await h.addUser());
  const reauth = (/** @type {string} */ password) =>
    h.call("POST", "/api/auth/reauth", {
      as: u,
      body: { password, purpose: "settings" },
    });
  for (let i = 0; i < 5; i++) {
    const r = await reauth(`wrong-reauth-${i}x`);
    assert.equal(r.status, 401);
    assert.deepEqual(r.json, { error: "invalid_credentials" });
    h.tick(MIN);
  }
  const lockedAt = h.now() - MIN;
  const before = h.hasher.count();
  const locked = await reauth(u.password);
  assert.equal(locked.status, 429);
  assert.deepEqual(locked.json, { error: "reauth_locked" });
  assert.equal(
    locked.headers.get("retry-after"),
    String(Math.ceil((lockedAt + 15 * MIN - h.now()) / 1000)),
  );
  assert.equal(h.hasher.count(), before, "no scrypt while re-auth is locked");
  const c = await counters(h, u.id);
  assert.equal(c.failed_logins, 0);
  assert.equal(c.locked_until, null);
  assert.equal(c.reauth_failures, 5);
  const loginOk = await login(h, u.email, u.password, "192.0.2.95");
  assert.equal(loginOk.r.status, 200, "the login of the same user still works");
  assert.equal((await reauth(u.password)).status, 429, "re-auth still locked");
  h.setNow(lockedAt + 15 * MIN);
  assert.equal((await reauth(u.password)).status, 200, "after 15 minutes");
  const after = await counters(h, u.id);
  assert.equal(after.failed_logins, 0);
  assert.equal(after.locked_until, null);
  assert.equal(after.reauth_failures, 0);
});

test("LO-6 an unknown e-mail: five failures answer byte-equal to those of an existing account, the sixth answers byte-equal 429 locked with the same Retry-After, and login_failures holds no clear e-mail", async (t) => {
  const h = await authHarness(t);
  const u = await h.addUser({ email: "existing@example.test" });
  const ghost = "Ghost.Person@Example.test";
  for (let i = 1; i <= 6; i++) {
    const a = await login(h, u.email, `wrong-pass-${i}y`, `192.0.2.${100 + i}`);
    const b = await login(h, ghost, `wrong-pass-${i}y`, `192.0.2.${120 + i}`);
    assert.equal(a.r.same, b.r.same, `attempt ${i}`);
    assert.equal(a.r.status, i <= 5 ? 401 : 429, `attempt ${i}`);
    assert.equal(a.scrypts, b.scrypts, `attempt ${i}: scrypt`);
    assert.equal(b.scrypts, i <= 5 ? 1 : 0);
    if (i === 6) {
      assert.deepEqual(b.r.json, { error: "locked" });
      assert.ok(Number(b.r.headers.get("retry-after")) > 0);
    }
    h.tick(MIN);
  }
  // The same e-mail in another case is the same counter.
  const upper = await login(
    h,
    ghost.toUpperCase(),
    "wrong-pass-7y",
    "192.0.2.140",
  );
  assert.equal(upper.r.status, 429);
  const rows = await h.sql("select * from login_failures");
  assert.equal(rows.length, 1);
  assert.match(rows[0].key, /^[0-9a-f]{64}$/);
  const text = JSON.stringify(rows).toLowerCase();
  for (const part of [ghost.toLowerCase(), "ghost.person", "example.test"])
    assert.ok(!text.includes(part), part);
  assert.ok(!(await h.dump()).toLowerCase().includes("ghost.person"));
});

test("LO-7 the admin with TOTP on: a right password with no code and with a wrong code each add one failure to the delay (the next attempt before the delay → 429, no scrypt)", async (t) => {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const enrol = await h.call("POST", "/api/admin/totp/enrol", {
    as: admin,
    reauth: await h.reauthToken(admin, "totp_enrol"),
    body: {},
  });
  const secret = enrol.json.secret;
  const confirm = await h.call("POST", "/api/admin/totp/confirm", {
    as: admin,
    body: { code: totpCode(secret, h.now()) },
  });
  assert.equal(confirm.status, 200);
  h.tick(60000);
  const ip = "192.0.2.150";
  const none = await login(h, ADMIN.email, ADMIN.password, ip);
  assert.equal(none.r.status, 401);
  assert.deepEqual(none.r.json, { error: "totp_required" });
  const at1 = h.now();
  const early1 = await login(
    h,
    ADMIN.email,
    ADMIN.password,
    ip,
    totpCode(secret, h.now()),
  );
  assert.equal(early1.r.status, 429, "after a missing code");
  assert.equal(early1.r.headers.get("retry-after"), "1");
  assert.equal(early1.scrypts, 0);
  h.setNow(at1 + 1000);
  const wrongCode =
    totpCode(secret, h.now()) === "000000" ? "111111" : "000000";
  const wrong = await login(h, ADMIN.email, ADMIN.password, ip, wrongCode);
  assert.equal(wrong.r.status, 401);
  assert.deepEqual(wrong.r.json, { error: "totp_invalid" });
  const at2 = h.now();
  const early2 = await login(
    h,
    ADMIN.email,
    ADMIN.password,
    ip,
    totpCode(secret, h.now()),
  );
  assert.equal(early2.r.status, 429, "after a wrong code");
  assert.equal(
    early2.r.headers.get("retry-after"),
    "2",
    "the second failure in a row",
  );
  assert.equal(early2.scrypts, 0);
  h.setNow(at2 + 2000);
  const ok = await login(
    h,
    ADMIN.email,
    ADMIN.password,
    ip,
    totpCode(secret, h.now()),
  );
  assert.equal(ok.r.status, 200, "after the delay with the right code");
  assert.deepEqual(await counters(h, admin.id), {
    failed_logins: 0,
    locked_until: null,
    reauth_failures: 0,
    reauth_locked_until: null,
  });
});
