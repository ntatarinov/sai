import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN, authHarness } from "../fixtures/auth.js";

// REQ-114 criterion 1, the login part (the code design M2AUTH, 4.4 row 5, 4.9.5, C18, C19): an unknown e-mail,
// a wrong password, a disabled and a deleted account answer byte-equal (except Date and X-Request-Id) with
// exactly one scrypt computation each (the hasher the app is given counts them), no cookie and no session
// row; a non-ASCII e-mail is a body error before any statement; an upper-case ASCII e-mail signs in as its
// lower case.

/**
 * @param {import("../fixtures/auth.js").AuthHarness} h
 * @param {string} email
 * @param {string} password
 * @param {string} ip
 */
async function login(h, email, password, ip) {
  const before = h.hasher.count();
  const r = await h.call("POST", "/api/auth/login", {
    ip,
    body: { email, password },
  });
  return { r, scrypts: h.hasher.count() - before };
}

test("LI-1 an unknown e-mail and a wrong password (ordinary account and admin) answer byte-equal with exactly one scrypt each", async (t) => {
  const h = await authHarness(t);
  await h.setup();
  const user = await h.addUser({ email: "known.user@example.test" });
  const cases = [
    ["known.user@example.test", "wrong-password-1"],
    ["KNOWN.USER@example.test", "wrong-password-2"],
    [ADMIN.email, "wrong-password-3"],
    ["nobody@example.test", "wrong-password-4"],
    ["no.such.person@another.example", user.password],
    ["x@y", "wrong-password-5"],
  ];
  /** @type {string[]} */
  const answers = [];
  let ip = 10;
  for (const [email, password] of cases) {
    const { r, scrypts } = await login(h, email, password, `192.0.2.${ip++}`);
    assert.equal(r.status, 401, `${email}: ${r.text}`);
    assert.deepEqual(r.json, { error: "invalid_credentials" });
    assert.equal(scrypts, 1, `${email}: one scrypt computation`);
    answers.push(r.same);
  }
  for (const a of answers) assert.equal(a, answers[0]);
});

test("LI-2 a refused login sets no cookie and adds no auth_sessions row", async (t) => {
  const h = await authHarness(t);
  const user = await h.addUser();
  let ip = 20;
  for (const [email, password] of [
    [user.email, "wrong-password-1"],
    ["nobody@example.test", "wrong-password-2"],
    [user.email, `${user.password}x`],
    [user.email, user.password.slice(0, -1)],
  ]) {
    const before = await h.counts();
    const { r } = await login(h, email, password, `192.0.2.${ip++}`);
    assert.equal(r.status, 401);
    assert.deepEqual(r.setCookie, []);
    const after = await h.counts();
    assert.equal(after.auth_sessions, before.auth_sessions);
    assert.equal(after.auth_sessions, 0);
  }
  const ok = await login(h, user.email, user.password, "192.0.2.30");
  assert.equal(ok.r.status, 200, "the right password still signs in");
  assert.equal(ok.r.setCookie.length, 1);
  assert.equal((await h.counts()).auth_sessions, 1);
});

test("LI-3 a disabled and a deleted account answer byte-equal to a wrong password with one scrypt, also with the right password, and their users rows stay unchanged", async (t) => {
  const h = await authHarness(t);
  const active = await h.addUser({ email: "active@example.test" });
  const disabled = await h.addUser({
    email: "disabled@example.test",
    status: "disabled",
  });
  const deleted = await h.addUser({
    email: "deleted@example.test",
    status: "deleted",
  });
  const wrong = await login(h, active.email, "wrong-password-9", "192.0.2.40");
  assert.equal(wrong.r.status, 401);
  let ip = 41;
  for (const u of [disabled, deleted]) {
    const row = async () =>
      JSON.stringify(await h.sql("select * from users where id = $1", [u.id]));
    const before = await row();
    for (const password of [u.password, "wrong-password-9"]) {
      const { r, scrypts } = await login(
        h,
        u.email,
        password,
        `192.0.2.${ip++}`,
      );
      assert.equal(r.same, wrong.r.same, `${u.email} ${password}`);
      assert.equal(scrypts, 1);
      assert.deepEqual(r.setCookie, []);
    }
    assert.equal(await row(), before, `${u.email}: the users row is unchanged`);
  }
  assert.equal((await h.counts()).auth_sessions, 0);
});

test("LI-4 a non-ASCII e-mail → 400 bad_body with the state unchanged and no scrypt; an upper-case ASCII e-mail signs in as its lower case", async (t) => {
  const h = await authHarness(t);
  const user = await h.addUser({ email: "Mixed.Case@Example.test" });
  const before = await h.digest();
  for (const email of [
    "mixed.case@exämple.test",
    "Дима@example.test",
    "mixed.case＠example.test",
    "mixed case@example.test",
    "mixed.case@example.test\n",
    "a@b@example.test",
  ]) {
    const { r, scrypts } = await login(h, email, user.password, "192.0.2.50");
    assert.equal(r.status, 400, JSON.stringify(email));
    assert.deepEqual(r.json, { error: "bad_body" });
    assert.equal(scrypts, 0);
  }
  assert.deepEqual(await h.digest(), before);
  for (const email of [
    "MIXED.CASE@EXAMPLE.TEST",
    "mixed.case@example.test",
    "Mixed.Case@Example.test",
  ]) {
    const { r } = await login(h, email, user.password, "192.0.2.51");
    assert.equal(r.status, 200, email);
    assert.equal(r.setCookie.length, 1);
  }
});
