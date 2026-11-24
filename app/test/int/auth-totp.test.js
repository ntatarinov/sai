import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { ADMIN, authHarness, base32Bytes, totpCode } from "../fixtures/auth.js";

// REQ-114 criterion 7 (the code design M2AUTH, 4.4 rows 12-14, 4.9.7), with the clock injected: only the
// platform admin enrols and only with a re-auth token; the secret is shown once and stored only encrypted;
// the login stays password only until a valid code confirms; then the codes of t-1, t and t+1 work once,
// wrong codes feed the admin delay and never lock; ten recovery codes work once each and are stored as
// HMAC(pepper, "recovery\0" + code); switching off needs a token and a code; each step writes one audit row.
// The codes are computed by the RFC 6238 implementation of fixtures/auth.js.

/** @typedef {import("../fixtures/auth.js").AuthHarness} H */
/** @typedef {import("../fixtures/auth.js").Actor} Actor */

let ipCount = 0;
/** A fresh address per login, so the admin delay of one address does not hide what a case checks. */
const nextIp = () =>
  `198.18.${Math.floor(++ipCount / 250)}.${(ipCount % 250) + 1}`;

/**
 * @param {H} h
 * @param {string | undefined} code
 * @param {string} [ip]
 */
const adminLogin = (h, code, ip = nextIp()) =>
  h.call("POST", "/api/auth/login", {
    ip,
    body: {
      email: ADMIN.email,
      password: ADMIN.password,
      ...(code === undefined ? {} : { code }),
    },
  });

/** @param {H} h @param {string} action */
const auditCount = async (h, action) =>
  (
    await h.sql("select count(*)::int as n from audit_log where action = $1", [
      action,
    ])
  )[0].n;

/** Setup, the admin signed in, an enrolment started. @param {import("node:test").TestContext} t */
async function enrolled(t) {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const r = await h.call("POST", "/api/admin/totp/enrol", {
    as: admin,
    reauth: await h.reauthToken(admin, "totp_enrol"),
    body: {},
  });
  assert.equal(r.status, 200, r.text);
  return { h, admin, secret: /** @type {string} */ (r.json.secret), enrol: r };
}

/** Enrolled and confirmed; the recovery codes. @param {import("node:test").TestContext} t */
async function confirmed(t) {
  const e = await enrolled(t);
  const r = await e.h.call("POST", "/api/admin/totp/confirm", {
    as: e.admin,
    body: { code: totpCode(e.secret, e.h.now()) },
  });
  assert.equal(r.status, 200, r.text);
  e.h.tick(60000);
  return { ...e, codes: /** @type {string[]} */ (r.json.recovery_codes) };
}

/** A 6-digit code that is none of the codes of the steps t-2 … t+2. @param {string} secret @param {number} ms */
function wrongCode(secret, ms) {
  const near = new Set([-2, -1, 0, 1, 2].map((o) => totpCode(secret, ms, o)));
  for (let i = 0; ; i++) {
    const c = String(i).padStart(6, "0");
    if (!near.has(c)) return c;
  }
}

test("TT-1 only the platform admin can start an enrolment, and only with a re-auth token: an ordinary user and an anonymous caller → 404 byte-equal to an unknown address, the admin without a token → 403", async (t) => {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const u = await h.signIn(await h.addUser());
  const before = await h.digest();
  const userToken = await h.reauthToken(u, "totp_enrol");
  const after = await h.digest();
  for (const [
    as,
    reauth,
    label,
  ] of /** @type {Array<[Actor | null, string | null, string]>} */ ([
    [u, userToken, "an ordinary user with a token of the purpose"],
    [u, null, "an ordinary user"],
    [null, null, "anonymous"],
  ])) {
    const r = await h.call("POST", "/api/admin/totp/enrol", {
      as,
      reauth,
      body: {},
    });
    const unknown = await h.call("POST", "/api/admin/totp/nope", {
      as,
      reauth,
      body: {},
    });
    assert.equal(r.status, 404, label);
    assert.equal(r.same, unknown.same, label);
  }
  assert.deepEqual(await h.digest(), after, "the refusals change no row");
  assert.notDeepEqual(before, after);
  const none = await h.call("POST", "/api/admin/totp/enrol", {
    as: admin,
    body: {},
  });
  assert.equal(none.status, 403);
  assert.deepEqual(none.json, { error: "reauth_required" });
  assert.deepEqual(
    await h.sql("select totp_secret_enc from users where is_platform_admin"),
    [{ totp_secret_enc: null }],
  );
  const ok = await h.call("POST", "/api/admin/totp/enrol", {
    as: admin,
    reauth: await h.reauthToken(admin, "totp_enrol"),
    body: {},
  });
  assert.equal(ok.status, 200);
  assert.match(ok.json.secret, /^[A-Z2-7]{32}$/);
  assert.equal(base32Bytes(ok.json.secret).length, 20);
  assert.equal(
    ok.json.otpauth,
    `otpauth://totp/Sai:${encodeURIComponent(ADMIN.email)}?secret=${ok.json.secret}&issuer=Sai&algorithm=SHA1&digits=6&period=30`,
  );
});

test("TT-2 the secret is shown once: no column of any table holds its base32 form or its raw bytes, and no later answer repeats it", async (t) => {
  const { h, admin, secret } = await enrolled(t);
  const raw = base32Bytes(secret);
  const forms = [
    secret,
    secret.toLowerCase(),
    raw.toString("hex"),
    raw.toString("base64"),
    raw.toString("base64url"),
    raw.toString("latin1"),
  ];
  const check = async () => {
    const dump = await h.dump();
    for (const f of forms)
      assert.ok(!dump.includes(f), `a form of the secret: ${f.slice(0, 6)}`);
  };
  await check();
  const [row] = await h.sql(
    "select totp_secret_enc, totp_enabled_at from users where is_platform_admin",
  );
  assert.match(row.totp_secret_enc, /^v1\./);
  assert.equal(row.totp_enabled_at, null);
  const me = await h.call("GET", "/api/auth/me", { as: admin, origin: null });
  assert.ok(!me.text.includes(secret));
  const c = await h.call("POST", "/api/admin/totp/confirm", {
    as: admin,
    body: { code: totpCode(secret, h.now()) },
  });
  assert.equal(c.status, 200);
  assert.ok(!c.text.includes(secret));
  await check();
});

test("TT-3 until a valid code confirms the enrolment the login stays password only; a wrong code does not confirm", async (t) => {
  const { h, admin, secret } = await enrolled(t);
  const ok = await adminLogin(h, undefined);
  assert.equal(ok.status, 200, "password only while the enrolment is pending");
  const wrong = await h.call("POST", "/api/admin/totp/confirm", {
    as: admin,
    body: { code: wrongCode(secret, h.now()) },
  });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, { error: "totp_invalid" });
  assert.equal(
    (await adminLogin(h, undefined)).status,
    200,
    "still password only",
  );
  const reauth = await h.call("POST", "/api/auth/reauth", {
    as: admin,
    body: { password: ADMIN.password, purpose: "settings" },
  });
  assert.equal(reauth.status, 200, "re-auth too");
  const c = await h.call("POST", "/api/admin/totp/confirm", {
    as: admin,
    body: { code: totpCode(secret, h.now()) },
  });
  assert.equal(c.status, 200);
  h.tick(60000);
  const after = await adminLogin(h, undefined);
  assert.equal(after.status, 401, "after the confirmation a code is needed");
  assert.deepEqual(after.json, { error: "totp_required" });
});

test("TT-4 after the confirmation: login and re-auth without a code or with a wrong code are refused; codes of t-1, t and t+1 are accepted; the same code again is refused; t-2 and t+2 are refused", async (t) => {
  const { h, admin, secret } = await confirmed(t);
  const missing = await adminLogin(h, undefined);
  assert.equal(missing.status, 401);
  assert.deepEqual(missing.json, { error: "totp_required" });
  const wrong = await adminLogin(h, wrongCode(secret, h.now()));
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, { error: "totp_invalid" });
  for (const off of [-2, 2, -3, 3]) {
    const r = await adminLogin(h, totpCode(secret, h.now(), off));
    assert.equal(r.status, 401, `offset ${off}`);
    assert.deepEqual(r.json, { error: "totp_invalid" });
  }
  for (const off of [-1, 0, 1]) {
    const code = totpCode(secret, h.now(), off);
    const r = await adminLogin(h, code);
    assert.equal(r.status, 200, `offset ${off}: ${r.text}`);
    const again = await adminLogin(h, code);
    assert.equal(again.status, 401, `offset ${off} a second time`);
    assert.deepEqual(again.json, { error: "totp_invalid" });
  }
  // Re-auth needs the code too, with the same rules.
  h.tick(5 * 30000);
  const reauth = (/** @type {Record<string, string>} */ extra) =>
    h.call("POST", "/api/auth/reauth", {
      as: admin,
      body: { password: ADMIN.password, purpose: "settings", ...extra },
    });
  const r1 = await reauth({});
  assert.deepEqual([r1.status, r1.json], [401, { error: "totp_required" }]);
  const r2 = await reauth({ code: wrongCode(secret, h.now()) });
  assert.deepEqual([r2.status, r2.json], [401, { error: "totp_invalid" }]);
  const code = totpCode(secret, h.now());
  const r3 = await reauth({ code });
  assert.equal(r3.status, 200);
  const r4 = await reauth({ code });
  assert.deepEqual(
    [r4.status, r4.json],
    [401, { error: "totp_invalid" }],
    "the used code again",
  );
});

test("TT-5 wrong codes count for the admin delay and the login limit of the address and never lock the admin", async (t) => {
  const { h, secret } = await confirmed(t);
  const ip = "198.19.0.7";
  let delay = 1;
  for (let i = 0; i < 8; i++) {
    const r = await adminLogin(h, wrongCode(secret, h.now()), ip);
    assert.equal(r.status, 401, `wrong code ${i + 1}`);
    const early = await adminLogin(h, totpCode(secret, h.now()), ip);
    assert.equal(early.status, 429, `the delay after wrong code ${i + 1}`);
    assert.equal(early.headers.get("retry-after"), String(delay));
    h.tick(delay * 1000);
    delay = Math.min(delay * 2, 60);
    if (i === 3) h.tick(15 * 60 * 1000);
  }
  const [row] = await h.sql(
    "select failed_logins, locked_until from users where is_platform_admin",
  );
  assert.deepEqual(row, { failed_logins: 0, locked_until: null });
  assert.equal(
    (await adminLogin(h, totpCode(secret, h.now()), "198.19.0.8")).status,
    200,
    "another address at once",
  );
});

test("TT-6 each of the ten recovery codes works once in place of a code and is refused the second time; the database holds them only as HMAC", async (t) => {
  const { h, admin, codes, secret } = await confirmed(t);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[A-Z2-7]{16}$/);
  const mac = (/** @type {string} */ c) =>
    crypto
      .createHmac("sha256", h.pepper)
      .update(`recovery\u0000${c}`, "utf8")
      .digest("hex");
  const stored = async () =>
    /** @type {string[]} */ (
      (
        await h.sql("select totp_recovery from users where id = $1", [admin.id])
      )[0].totp_recovery
    );
  assert.deepEqual([...(await stored())].sort(), codes.map(mac).sort());
  const dump = await h.dump();
  for (const c of codes)
    assert.ok(!dump.includes(c) && !dump.includes(c.toLowerCase()));
  for (let i = 0; i < codes.length; i++) {
    const r = await adminLogin(h, codes[i]);
    assert.equal(r.status, 200, `recovery code ${i + 1}: ${r.text}`);
    assert.equal((await stored()).length, 9 - i);
    const again = await adminLogin(h, codes[i]);
    assert.equal(again.status, 401, `recovery code ${i + 1} again`);
    assert.deepEqual(again.json, { error: "totp_invalid" });
  }
  assert.deepEqual(await stored(), []);
  assert.equal(
    (await adminLogin(h, totpCode(secret, h.now()))).status,
    200,
    "the app code still works",
  );
});

test("TT-7 switching TOTP off needs a re-auth token and a valid code; afterwards the login is password only", async (t) => {
  const { h, admin, secret } = await confirmed(t);
  const state = async () =>
    (
      await h.sql(
        "select totp_secret_enc, totp_enabled_at, totp_recovery from users where id = $1",
        [admin.id],
      )
    )[0];
  const on = await state();
  const reauth = async () => {
    h.tick(30000);
    return h.reauthToken(admin, "totp_off", {
      code: totpCode(secret, h.now()),
    });
  };
  const before = await h.digest();
  const noToken = await h.call("POST", "/api/admin/totp/off", {
    as: admin,
    body: { code: totpCode(secret, h.now(), 1) },
  });
  assert.deepEqual(
    [noToken.status, noToken.json],
    [403, { error: "reauth_required" }],
  );
  assert.deepEqual(await h.digest(), before);
  const otherPurpose = await h.call("POST", "/api/admin/totp/off", {
    as: admin,
    reauth: await h.reauthToken(admin, "totp_enrol", {
      code: totpCode(secret, h.now() + 30000),
    }),
    body: { code: totpCode(secret, h.now(), 2) },
  });
  assert.deepEqual(
    [otherPurpose.status, otherPurpose.json],
    [403, { error: "reauth_required" }],
  );
  h.tick(30000);
  const token = await reauth();
  h.tick(30000);
  const wrong = await h.call("POST", "/api/admin/totp/off", {
    as: admin,
    reauth: token,
    body: { code: wrongCode(secret, h.now()) },
  });
  assert.deepEqual(
    [wrong.status, wrong.json],
    [401, { error: "totp_invalid" }],
  );
  assert.deepEqual(await state(), on, "TOTP stays on after a wrong code");
  const token2 = await reauth();
  h.tick(30000);
  const off = await h.call("POST", "/api/admin/totp/off", {
    as: admin,
    reauth: token2,
    body: { code: totpCode(secret, h.now()) },
  });
  assert.equal(off.status, 200, off.text);
  assert.deepEqual(off.json, { ok: true });
  assert.deepEqual(await state(), {
    totp_secret_enc: null,
    totp_enabled_at: null,
    totp_recovery: [],
  });
  assert.equal(
    (await adminLogin(h, undefined)).status,
    200,
    "password only again",
  );
  const again = await h.call("POST", "/api/admin/totp/off", {
    as: admin,
    reauth: await h.reauthToken(admin, "totp_off"),
    body: { code: totpCode(secret, h.now()) },
  });
  assert.deepEqual([again.status, again.json], [409, { error: "totp_state" }]);
});

test("TT-8 every enrolment, confirmation, recovery-code use and switch-off writes one audit row", async (t) => {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const counts = async () =>
    Object.fromEntries(
      await Promise.all(
        [
          "auth.totp_enrol",
          "auth.totp_confirm",
          "auth.totp_recovery_used",
          "auth.totp_off",
        ].map(async (a) => [a, await auditCount(h, a)]),
      ),
    );
  const zero = {
    "auth.totp_enrol": 0,
    "auth.totp_confirm": 0,
    "auth.totp_recovery_used": 0,
    "auth.totp_off": 0,
  };
  assert.deepEqual(await counts(), zero);
  const e = await h.call("POST", "/api/admin/totp/enrol", {
    as: admin,
    reauth: await h.reauthToken(admin, "totp_enrol"),
    body: {},
  });
  assert.deepEqual(await counts(), { ...zero, "auth.totp_enrol": 1 });
  const c = await h.call("POST", "/api/admin/totp/confirm", {
    as: admin,
    body: { code: totpCode(e.json.secret, h.now()) },
  });
  assert.deepEqual(await counts(), {
    ...zero,
    "auth.totp_enrol": 1,
    "auth.totp_confirm": 1,
  });
  h.tick(30000);
  assert.equal((await adminLogin(h, c.json.recovery_codes[0])).status, 200);
  assert.deepEqual(await counts(), {
    ...zero,
    "auth.totp_enrol": 1,
    "auth.totp_confirm": 1,
    "auth.totp_recovery_used": 1,
  });
  const token = await h.reauthToken(admin, "totp_off", {
    code: c.json.recovery_codes[1],
  });
  assert.equal(
    await auditCount(h, "auth.totp_recovery_used"),
    2,
    "a recovery code at re-auth",
  );
  const off = await h.call("POST", "/api/admin/totp/off", {
    as: admin,
    reauth: token,
    body: { code: totpCode(e.json.secret, h.now()) },
  });
  assert.equal(off.status, 200);
  assert.deepEqual(await counts(), {
    "auth.totp_enrol": 1,
    "auth.totp_confirm": 1,
    "auth.totp_recovery_used": 2,
    "auth.totp_off": 1,
  });
  const details = await h.sql(
    "select action, details from audit_log where action like 'auth.totp%' order by id",
  );
  const text = JSON.stringify(details);
  assert.ok(!text.includes(e.json.secret));
  for (const code of c.json.recovery_codes) assert.ok(!text.includes(code));
});
