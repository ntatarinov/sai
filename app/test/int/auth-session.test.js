import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { COMMON_PASSWORDS } from "../../server/auth/common-passwords.js";
import { authHarness, HTTPS_ORIGIN } from "../fixtures/auth.js";

// REQ-114 criteria 3 and 1 («PW-4 at the password change»), the code design M2AUTH 4.9.3, 4.7 steps 1 and 11:
// the cookie flags by APP_ORIGIN, the token only as an HMAC, the idle and the absolute limit on an injected
// clock, the rotation at login, logout, the password change, and the body of GET /api/auth/me.

const HOUR = 3600 * 1000;

/** The attributes of one Set-Cookie line: the name, the value and the lower-case attribute map. */
function parseCookie(/** @type {string} */ line) {
  const [pair, ...rest] = line.split(";").map((p) => p.trim());
  const at = pair.indexOf("=");
  /** @type {Record<string, string>} */
  const attrs = {};
  for (const a of rest) {
    const i = a.indexOf("=");
    attrs[(i < 0 ? a : a.slice(0, i)).toLowerCase()] =
      i < 0 ? "" : a.slice(i + 1);
  }
  return { name: pair.slice(0, at), value: pair.slice(at + 1), attrs };
}

/** @param {import("../fixtures/auth.js").AuthHarness} h @param {import("../fixtures/auth.js").Actor} a */
const me = (h, a, cookie = a.cookie) =>
  h.call("GET", "/api/auth/me", { as: a, cookie, origin: null });

test("SS-1 with APP_ORIGIN https a login sets exactly one cookie __Host-sai_s with Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain", async (t) => {
  const h = await authHarness(t, { origin: HTTPS_ORIGIN });
  const u = await h.addUser();
  const r = await h.call("POST", "/api/auth/login", {
    ip: u.ip,
    body: { email: u.email, password: u.password },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.setCookie.length, 1, r.setCookie.join(" | "));
  const c = parseCookie(r.setCookie[0]);
  assert.equal(c.name, "__Host-sai_s");
  assert.match(c.value, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(c.value, "base64url").length, 32);
  assert.ok("secure" in c.attrs, "Secure");
  assert.ok("httponly" in c.attrs, "HttpOnly");
  assert.equal(c.attrs.samesite, "Lax");
  assert.equal(c.attrs.path, "/");
  assert.ok(!("domain" in c.attrs), "no Domain");
  assert.equal(c.attrs["max-age"], "604800");
  // The cookie works on the https origin.
  u.cookie = r.cookie;
  assert.equal((await me(h, u)).status, 200);
});

test("SS-2 with APP_ORIGIN http://127.0.0.1:<port> the cookie is sai_s with HttpOnly, SameSite=Lax, Path=/; any other origin answers 503 server_config and sets no cookie", async (t) => {
  const h = await authHarness(t);
  const u = await h.addUser();
  const r = await h.call("POST", "/api/auth/login", {
    ip: u.ip,
    body: { email: u.email, password: u.password },
  });
  assert.equal(r.status, 200);
  assert.equal(r.setCookie.length, 1);
  const c = parseCookie(r.setCookie[0]);
  assert.equal(c.name, "sai_s");
  assert.match(c.value, /^[A-Za-z0-9_-]{43}$/);
  assert.ok("httponly" in c.attrs);
  assert.equal(c.attrs.samesite, "Lax");
  assert.equal(c.attrs.path, "/");
  assert.ok(!("domain" in c.attrs));
  for (const origin of [
    "http://localhost:2",
    "http://127.0.0.2:1",
    "http://sai.example",
  ]) {
    const x = await authHarness(t, { origin });
    const v = await x.addUser();
    const before = await x.digest();
    const refused = await x.call("POST", "/api/auth/login", {
      ip: v.ip,
      body: { email: v.email, password: v.password },
    });
    assert.equal(refused.status, 503, origin);
    assert.deepEqual(refused.json, { error: "server_config" });
    assert.deepEqual(refused.setCookie, []);
    assert.deepEqual(await x.digest(), before);
  }
});

test("SS-3 the session token and the CSRF token occur in no column of any table, in their text, base64url, base64 and hex forms", async (t) => {
  const h = await authHarness(t);
  const users = [
    await h.signIn(await h.addUser()),
    await h.signIn(await h.addUser()),
  ];
  const dump = await h.dump();
  for (const u of users) {
    const token = /** @type {string} */ (u.cookie).split("=")[1];
    for (const secret of [token, /** @type {string} */ (u.csrf)]) {
      const bytes = Buffer.from(secret, "base64url");
      for (const form of [
        secret,
        bytes.toString("base64"),
        bytes.toString("hex"),
        bytes.toString("hex").toUpperCase(),
        crypto.createHash("sha256").update(secret).digest("hex"),
      ])
        assert.ok(
          !dump.includes(form),
          `a form of a token is in the dump: ${form.slice(0, 8)}`,
        );
    }
    // The row holds the HMAC of the token (64 hex), not the token.
    const rows = await h.sql(
      "select token_hash, csrf_hash from auth_sessions where user_id = $1",
      [u.id],
    );
    assert.equal(rows.length, 1);
    assert.match(rows[0].token_hash, /^[0-9a-f]{64}$/);
    assert.match(rows[0].csrf_hash, /^[0-9a-f]{64}$/);
  }
});

test("SS-4 a session idle for 12 h − 1 s works and one idle for 12 h + 1 s answers 401", async (t) => {
  const h = await authHarness(t);
  const u = await h.signIn(await h.addUser());
  h.tick(12 * HOUR - 1000);
  assert.equal((await me(h, u)).status, 200, "12 h − 1 s idle");
  h.tick(12 * HOUR - 1000);
  assert.equal(
    (await me(h, u)).status,
    200,
    "again 12 h − 1 s after the last use",
  );
  h.tick(12 * HOUR + 1000);
  const late = await me(h, u);
  assert.equal(late.status, 401);
  assert.deepEqual(late.json, { error: "auth_required" });
  // A second session idle exactly to the bound and one second over it.
  const v = await h.signIn(await h.addUser());
  h.tick(12 * HOUR + 1000);
  assert.equal((await me(h, v)).status, 401);
});

test("SS-5 a session used every hour works at 7 days − 1 s and answers 401 after 7 days + 1 s", async (t) => {
  const h = await authHarness(t);
  const u = await h.signIn(await h.addUser());
  const start = h.now();
  for (let i = 1; i < 7 * 24; i++) {
    h.setNow(start + i * HOUR);
    assert.equal((await me(h, u)).status, 200, `hour ${i}`);
  }
  h.setNow(start + 7 * 24 * HOUR - 1000);
  assert.equal((await me(h, u)).status, 200, "7 days − 1 s");
  h.setNow(start + 7 * 24 * HOUR + 1000);
  assert.equal((await me(h, u)).status, 401, "7 days + 1 s");
});

test("SS-6 a login rotates the cookie: a cookie set before the login is not accepted after it, and its row is gone", async (t) => {
  const h = await authHarness(t);
  const u = await h.signIn(await h.addUser());
  const old = /** @type {string} */ (u.cookie);
  const r = await h.call("POST", "/api/auth/login", {
    as: u,
    body: { email: u.email, password: u.password },
  });
  assert.equal(r.status, 200);
  assert.notEqual(r.cookie, old);
  assert.equal((await me(h, u, old)).status, 401, "the old cookie");
  assert.equal((await me(h, u, r.cookie)).status, 200, "the new cookie");
  assert.deepEqual(
    await h.sql(
      "select count(*)::int as n from auth_sessions where user_id = $1",
      [u.id],
    ),
    [{ n: 1 }],
  );
});

test("SS-7 POST /api/auth/logout ends the session (the old cookie answers 401) and clears the cookie", async (t) => {
  const h = await authHarness(t);
  const u = await h.signIn(await h.addUser());
  const other = await h.signIn(await h.addUser());
  const r = await h.call("POST", "/api/auth/logout", { as: u, body: {} });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.equal(r.setCookie.length, 1);
  const c = parseCookie(r.setCookie[0]);
  assert.equal(c.name, "sai_s");
  assert.equal(c.value, "");
  assert.equal(c.attrs["max-age"], "0");
  assert.equal(c.attrs.path, "/");
  assert.equal((await me(h, u)).status, 401);
  assert.deepEqual(await h.sql("select user_id from auth_sessions"), [
    { user_id: other.id },
  ]);
  assert.equal(
    (await me(h, other)).status,
    200,
    "another user's session stays",
  );
});

test("SS-8 a password change ends every other session of the user and keeps the current one; a wrong current password changes nothing; an unused reset code is void afterwards", async (t) => {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const u = await h.signIn(await h.addUser());
  const second = await h.signIn(
    { ...u, cookie: null, csrf: null },
    { ip: "192.0.2.61" },
  );
  const third = await h.signIn(
    { ...u, cookie: null, csrf: null },
    { ip: "192.0.2.62" },
  );
  const stranger = await h.signIn(await h.addUser());
  // An unused reset link for the user, issued before the change.
  const link = await h.call("POST", `/api/admin/users/${u.id}/reset-link`, {
    as: admin,
    reauth: await h.reauthToken(admin, "reset_link"),
    body: {},
  });
  assert.equal(link.status, 200);
  const code = link.json.link.split("#c=")[1];
  // A wrong current password: password_hash and the session rows unchanged (the session's own last_seen_at
  // is the one column a signed-in request changes, 4.7 step 11).
  const omit = { auth_sessions: ["last_seen_at"] };
  const before = await h.digest(
    ["users", "auth_sessions", "password_resets"],
    omit,
  );
  const hashBefore = await h.sql(
    "select password_hash from users where id = $1",
    [u.id],
  );
  const wrong = await h.call("POST", "/api/auth/password", {
    as: u,
    body: { current: "not-the-password-1", next: "a-new-password-77" },
  });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, { error: "invalid_credentials" });
  assert.deepEqual(
    await h.sql("select password_hash from users where id = $1", [u.id]),
    hashBefore,
  );
  const afterWrong = await h.digest(["auth_sessions", "password_resets"], omit);
  assert.equal(afterWrong.auth_sessions, before.auth_sessions);
  assert.equal(afterWrong.password_resets, before.password_resets);
  for (const s of [u, second, third])
    assert.equal((await me(h, s)).status, 200);
  // The change.
  const r = await h.call("POST", "/api/auth/password", {
    as: u,
    body: { current: u.password, next: "a-new-password-77" },
  });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { ok: true });
  assert.equal((await me(h, u)).status, 200, "the current session stays");
  assert.equal((await me(h, second)).status, 401);
  assert.equal((await me(h, third)).status, 401);
  assert.equal(
    (await me(h, stranger)).status,
    200,
    "another user's session stays",
  );
  assert.deepEqual(
    await h.sql(
      "select count(*)::int as n from auth_sessions where user_id = $1",
      [u.id],
    ),
    [{ n: 1 }],
  );
  const reset = await h.call("POST", "/api/auth/reset", {
    ip: "192.0.2.63",
    body: { code, password: "reset-after-change-8" },
  });
  assert.equal(reset.status, 400);
  assert.deepEqual(reset.json, { error: "reset_invalid" });
  const newLogin = await h.call("POST", "/api/auth/login", {
    ip: "192.0.2.64",
    body: { email: u.email, password: "a-new-password-77" },
  });
  assert.equal(newLogin.status, 200);
  const oldLogin = await h.call("POST", "/api/auth/login", {
    ip: "192.0.2.65",
    body: { email: u.email, password: u.password },
  });
  assert.equal(oldLogin.status, 401);
});

test("PW-4 at the password change: a password of the common list (also in upper case) and one of 9 or 129 characters → 400 password_rules with every row unchanged", async (t) => {
  const h = await authHarness(t);
  const u = await h.signIn(await h.addUser());
  const before = await h.digest();
  const listed = [
    COMMON_PASSWORDS[0],
    COMMON_PASSWORDS[COMMON_PASSWORDS.length - 1],
    "password123",
  ];
  for (const next of [
    ...listed,
    ...listed.map((p) => p.toUpperCase()),
    "nine-char",
    "x".repeat(129),
  ]) {
    const r = await h.call("POST", "/api/auth/password", {
      as: u,
      body: { current: u.password, next },
    });
    assert.equal(r.status, 400, next);
    assert.deepEqual(r.json, { error: "password_rules" }, next);
  }
  assert.deepEqual(await h.digest(), before);
});

test("SS-9 GET /api/auth/me answers the id, name, language, platform-admin flag, memberships and the CSRF token, and no hash or TOTP field", async (t) => {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const u = await h.signIn(
    await h.addUser({ name: "Planted Name", role: "viewer" }),
  );
  const stored =
    JSON.stringify(
      await h.sql(
        "select password_hash, totp_secret_enc, totp_recovery from users",
      ),
    ) +
    JSON.stringify(
      await h.sql("select token_hash, csrf_hash from auth_sessions"),
    );
  for (const [
    a,
    admin_,
  ] of /** @type {Array<[import("../fixtures/auth.js").Actor, boolean]>} */ ([
    [u, false],
    [admin, true],
  ])) {
    const r = await me(h, a);
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json).sort(), [
      "csrf",
      "id",
      "language",
      "memberships",
      "name",
      "platform_admin",
    ]);
    const [row] = await h.sql(
      "select display_name, language from users where id = $1",
      [a.id],
    );
    assert.equal(r.json.id, a.id);
    assert.equal(r.json.name, row.display_name);
    assert.equal(r.json.language, row.language);
    assert.equal(r.json.platform_admin, admin_);
    assert.deepEqual(r.json.memberships, [
      { org_id: a.orgId, role: admin_ ? "org_owner" : "viewer" },
    ]);
    assert.match(r.json.csrf, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(r.json.csrf, a.csrf);
    for (const word of [
      "password",
      "hash",
      "totp",
      "recovery",
      "secret",
      "token",
    ])
      assert.ok(!r.text.toLowerCase().includes(word), word);
    for (const m of stored.matchAll(/[0-9a-f]{64}|scrypt\$[^"]+/g))
      assert.ok(!r.text.includes(m[0]));
  }
  assert.equal(u.orgId !== null, true);
});
