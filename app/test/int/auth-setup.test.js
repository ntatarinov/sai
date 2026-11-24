import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN,
  authHarness,
  randomToken,
  sha256Hex,
} from "../fixtures/auth.js";

// REQ-114 criterion 2 (the code design M2AUTH, 4.4 row 4, 4.9.6, 4.10): the one-time setup of the platform
// admin with SETUP_TOKEN_HASH = sha256 of a token made by the test, the uniform 404 of every refusal,
// two parallel calls, the hourly limit per address, and the body rules (an ASCII e-mail, the
// common-password list). The oracle reads the rows by plain SQL.

const GUARDED = [
  "users",
  "orgs",
  "org_members",
  "platform_settings",
  "audit_log",
];

/** @param {Record<string, number>} c */
const guarded = (c) => Object.fromEntries(GUARDED.map((t) => [t, c[t]]));

/**
 * @param {import("../fixtures/auth.js").AuthHarness} h
 * @param {Record<string, unknown>} body
 * @param {string} [ip]
 */
const post = (h, body, ip) => h.call("POST", "/api/auth/setup", { body, ip });

/** The body of a right setup call. @param {import("../fixtures/auth.js").AuthHarness} h */
const right = (h) => ({
  token: h.setupToken,
  email: ADMIN.email,
  name: ADMIN.name,
  password: ADMIN.password,
});

/** The answer of an unknown /api address to the same request. */
const unknownOf = (
  /** @type {import("../fixtures/auth.js").AuthHarness} */ h,
  /** @type {Record<string, unknown>} */ body,
) => h.call("POST", "/api/nope-setup", { body });

test("SU-1 setup with the token answers 201 and creates exactly the admin, the owner organisation, the membership, setup_done and one audit row", async (t) => {
  const h = await authHarness(t);
  const before = await h.counts();
  const r = await post(h, { ...right(h), language: "kk" });
  assert.equal(r.status, 201, r.text);
  assert.deepEqual(r.json, { ok: true });
  assert.deepEqual(r.setCookie, []);
  const after = await h.counts();
  assert.deepEqual(guarded(after), {
    users: before.users + 1,
    orgs: before.orgs + 1,
    org_members: before.org_members + 1,
    platform_settings: before.platform_settings + 1,
    audit_log: before.audit_log + 1,
  });
  const [u] = await h.sql(
    "select id, email, email_norm, display_name, language, is_platform_admin, is_owner_identity, status from users",
  );
  assert.deepEqual(
    { ...u, id: undefined },
    {
      id: undefined,
      email: ADMIN.email,
      email_norm: ADMIN.norm,
      display_name: ADMIN.name,
      language: "kk",
      is_platform_admin: true,
      is_owner_identity: true,
      status: "active",
    },
  );
  const [o] = await h.sql("select id, kind, ai_allowed from orgs");
  assert.equal(o.kind, "owner");
  assert.equal(o.ai_allowed, true);
  assert.deepEqual(
    await h.sql("select org_id, user_id, role from org_members"),
    [{ org_id: o.id, user_id: u.id, role: "org_owner" }],
  );
  assert.deepEqual(
    await h.sql("select value from platform_settings where key = 'setup_done'"),
    [{ value: true }],
  );
  const audit = await h.sql("select action, actor_id, details from audit_log");
  assert.deepEqual(audit, [
    { action: "auth.setup", actor_id: u.id, details: {} },
  ]);
  // The stored password is a hash of the planted password, never the text.
  const dump = await h.dump();
  assert.ok(!dump.includes(ADMIN.password));
  assert.ok(!dump.includes(h.setupToken));
});

test("SU-2 another token, a second call with the token, an unset hash and a hash that is not 64 hex characters each answer 404 byte-equal to an unknown /api address, with the row counts unchanged", async (t) => {
  const h = await authHarness(t);
  let calls = 0;
  const check = async (
    /** @type {import("../fixtures/auth.js").AuthHarness} */ x,
    /** @type {Record<string, unknown>} */ body,
    /** @type {string} */ label,
  ) => {
    const before = guarded(await x.counts());
    // A fresh address per call: the setup limit of 5 per hour (SU-4) is not what this case checks.
    calls += 1;
    const r = await post(x, body, `192.0.2.${100 + calls}`);
    assert.equal(r.status, 404, `${label}: ${r.text}`);
    assert.equal(r.same, (await unknownOf(x, body)).same, label);
    assert.deepEqual(r.setCookie, []);
    assert.deepEqual(guarded(await x.counts()), before, label);
  };
  // Before setup: tokens other than T (random, one character changed, the hash itself, malformed).
  const t2 = h.setupToken;
  const changed = `${t2.slice(0, -1)}${t2.endsWith("A") ? "B" : "A"}`;
  for (const token of [randomToken(), changed, sha256Hex(t2), "", t2.slice(1)])
    await check(h, { ...right(h), token }, `token ${token.slice(0, 8)}`);
  assert.equal((await post(h, right(h), "192.0.2.99")).status, 201);
  await check(h, right(h), "a second call with T");
  await check(h, { ...right(h), email: "other@example.test" }, "a third call");
  // An unset hash and malformed hashes (setup not done in each).
  const token = randomToken();
  for (const hash of [
    null,
    "",
    sha256Hex(token).slice(1),
    `${sha256Hex(token)}0`,
    sha256Hex(token).toUpperCase(),
    `${sha256Hex(token).slice(1)}g`,
  ]) {
    const x = await authHarness(t, { setupTokenHash: hash });
    await check(x, { ...right(x), token }, `hash ${JSON.stringify(hash)}`);
    await check(x, right(x), `hash ${JSON.stringify(hash)}, harness token`);
  }
});

test("SU-3 two parallel calls with the token on an empty database give exactly one 2xx and one 404 and one admin", async (t) => {
  for (let round = 0; round < 3; round++) {
    const h = await authHarness(t);
    const answers = await Promise.all([
      post(h, right(h), "192.0.2.31"),
      post(h, { ...right(h), email: "second@example.test" }, "192.0.2.32"),
    ]);
    assert.deepEqual(
      answers.map((a) => a.status).sort(),
      [201, 404],
      answers.map((a) => a.text).join(" "),
    );
    assert.deepEqual(
      await h.sql(
        "select count(*)::int as n from users where is_platform_admin",
      ),
      [{ n: 1 }],
    );
    assert.deepEqual(guarded(await h.counts()), {
      users: 1,
      orgs: 1,
      org_members: 1,
      platform_settings: 1,
      audit_log: 1,
    });
  }
});

test("SU-4 the sixth call within one hour from one address answers 429 with Retry-After; another address is not limited", async (t) => {
  const h = await authHarness(t);
  const start = Date.UTC(2026, 10, 24, 9, 10, 0);
  h.setNow(start);
  const bad = { ...right(h), token: randomToken() };
  for (let i = 0; i < 5; i++) {
    const r = await post(h, bad, "192.0.2.41");
    assert.equal(r.status, 404, `call ${i + 1}`);
    h.tick(60 * 1000);
  }
  const before = await h.digest();
  const sixth = await post(h, right(h), "192.0.2.41");
  assert.equal(sixth.status, 429);
  assert.deepEqual(sixth.json, { error: "rate_limited" });
  const windowStart = Math.floor(h.now() / 3600000) * 3600000;
  assert.equal(
    sixth.headers.get("retry-after"),
    String(Math.ceil((windowStart + 3600000 - h.now()) / 1000)),
  );
  assert.deepEqual(await h.digest(), before, "the refusal changes no row");
  assert.equal((await post(h, right(h), "192.0.2.42")).status, 201);
  // After the hour window the first address is counted afresh.
  h.setNow(windowStart + 3600000);
  assert.equal((await post(h, bad, "192.0.2.41")).status, 404);
});

test("SU-5 a non-ASCII e-mail → 400 bad_body and a listed common password → 400 password_rules, with every row unchanged (no 500)", async (t) => {
  const h = await authHarness(t);
  const before = await h.digest();
  for (const email of [
    "Дима@example.test",
    "owner@пример.рф",
    "ÖWNER@example.test",
    "owner＠example.test",
    "own er@example.test",
    "owner@@example.test",
    "a@b@example.test",
    "owner​@example.test",
    "@example.test",
    "owner@",
    `${"a".repeat(65)}@example.test`,
  ]) {
    const r = await post(h, { ...right(h), email });
    assert.equal(r.status, 400, `${email}: ${r.text}`);
    assert.deepEqual(r.json, { error: "bad_body" }, email);
  }
  for (const password of [
    "1234567890",
    "QWERTYUIOP",
    "Password123",
    "123456789",
    "x".repeat(129),
  ]) {
    const r = await post(h, { ...right(h), password });
    assert.equal(r.status, 400, password);
    assert.deepEqual(r.json, { error: "password_rules" }, password);
  }
  assert.deepEqual(await h.digest(), before);
  assert.equal(h.hasher.count(), 0, "no scrypt for a refused body");
  // An ASCII e-mail with upper case is stored with its lower-case norm.
  assert.equal((await post(h, right(h))).status, 201);
  assert.deepEqual(await h.sql("select email, email_norm from users"), [
    { email: ADMIN.email, email_norm: ADMIN.norm },
  ]);
});
