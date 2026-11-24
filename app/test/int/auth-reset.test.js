import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { COMMON_PASSWORDS } from "../../server/auth/common-passwords.js";
import { authHarness } from "../fixtures/auth.js";

// REQ-114 criteria 8 and 1 (RS-2, the common list at a reset), the code design M2AUTH 4.4 rows 10-11, 4.9.8,
// with the clock injected: the admin issues a one-time link with a re-auth token; the database holds only
// HMAC(pepper, "reset\0" + code); using it within 30 minutes sets the password and ends every session of that
// user; a second use, a late use, a short or a listed password are refused with the password and the
// sessions unchanged; the route answers the uniform 404 to everyone but the admin; issue and use are
// audited.

const MIN = 60 * 1000;

/** @typedef {import("../fixtures/auth.js").AuthHarness} H */
/** @typedef {import("../fixtures/auth.js").Actor} Actor */

/** @param {H} h @param {Actor} admin @param {string} id */
async function issue(h, admin, id) {
  const r = await h.call("POST", `/api/admin/users/${id}/reset-link`, {
    as: admin,
    reauth: await h.reauthToken(admin, "reset_link"),
    body: {},
  });
  assert.equal(r.status, 200, r.text);
  const m = new RegExp(
    `^${h.origin.replace(/[.:/]/g, "\\$&")}/reset\\.html#c=([A-Za-z0-9_-]{22})$`,
  ).exec(r.json.link);
  assert.ok(m, r.json.link);
  assert.deepEqual(Object.keys(r.json), ["link"]);
  return m[1];
}

let ip = 0;
/** @param {H} h @param {string} code @param {string} password */
const use = (h, code, password) =>
  h.call("POST", "/api/auth/reset", {
    ip: `198.18.7.${++ip}`,
    body: { code, password },
  });

/** @param {H} h @param {Actor} u */
const me = (h, u) => h.call("GET", "/api/auth/me", { as: u, origin: null });

/** @param {H} h @param {string} action */
const audits = async (h, action) =>
  (
    await h.sql("select count(*)::int as n from audit_log where action = $1", [
      action,
    ])
  )[0].n;

test("RS-1 a link issued by the admin with a re-auth token holds a code shown once (stored only as HMAC); used within 30 minutes it sets the password and ends every session of that user", async (t) => {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const u = await h.signIn(await h.addUser());
  const u2 = await h.signIn(
    { ...u, cookie: null, csrf: null },
    { ip: "192.0.2.80" },
  );
  const v = await h.signIn(await h.addUser());
  const code = await issue(h, admin, u.id);
  const rows = await h.sql(
    "select user_id, code_hash, created_by, used_at from password_resets",
  );
  assert.deepEqual(rows, [
    {
      user_id: u.id,
      code_hash: crypto
        .createHmac("sha256", h.pepper)
        .update(`reset\u0000${code}`, "utf8")
        .digest("hex"),
      created_by: admin.id,
      used_at: null,
    },
  ]);
  const dump = await h.dump();
  for (const f of [code, Buffer.from(code, "base64url").toString("hex")])
    assert.ok(!dump.includes(f));
  h.tick(30 * MIN - 1000);
  const r = await use(h, code, "a-reset-password-11");
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { ok: true });
  assert.deepEqual(r.setCookie, []);
  for (const s of [u, u2])
    assert.equal((await me(h, s)).status, 401, "a session of the user ended");
  assert.equal((await me(h, v)).status, 200, "another user's session stays");
  assert.deepEqual(
    await h.sql(
      "select count(*)::int as n from auth_sessions where user_id = $1",
      [u.id],
    ),
    [{ n: 0 }],
  );
  const newLogin = await h.call("POST", "/api/auth/login", {
    ip: "192.0.2.81",
    body: { email: u.email, password: "a-reset-password-11" },
  });
  assert.equal(newLogin.status, 200);
  const oldLogin = await h.call("POST", "/api/auth/login", {
    ip: "192.0.2.82",
    body: { email: u.email, password: u.password },
  });
  assert.equal(oldLogin.status, 401);
  // A new link voids the earlier unused one.
  const first = await issue(h, admin, v.id);
  const second = await issue(h, admin, v.id);
  assert.deepEqual([(await use(h, first, "void-link-pass-12")).status], [400]);
  assert.equal((await use(h, second, "fresh-link-pass-13")).status, 200);
});

test("RS-2 a second use, a use after 30 minutes + 1 s, a password of 9 characters and a password of the common list are refused, and password_hash and the session rows stay unchanged", async (t) => {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const u = await h.signIn(await h.addUser());
  const state = () => h.digest(["users", "auth_sessions"]);
  /** @param {string} code @param {string} password @param {string} error @param {string} label */
  const refused = async (code, password, error, label) => {
    const before = await state();
    const r = await use(h, code, password);
    assert.equal(r.status, 400, `${label}: ${r.text}`);
    assert.deepEqual(r.json, { error }, label);
    assert.deepEqual(await state(), before, label);
  };
  // Rules first: the code stays usable after a refused password.
  const code = await issue(h, admin, u.id);
  await refused(code, "123456789", "password_rules", "9 characters");
  await refused(code, "x".repeat(129), "password_rules", "129 characters");
  for (const listed of [
    COMMON_PASSWORDS[0],
    COMMON_PASSWORDS[COMMON_PASSWORDS.length - 1],
    "password123",
    "PASSWORD123",
    "QwErTyUiOp",
  ])
    await refused(code, listed, "password_rules", `listed ${listed}`);
  assert.equal(
    (await use(h, code, "first-use-pass-21")).status,
    200,
    "the code still works",
  );
  // A second use.
  await refused(code, "second-use-pass-22", "reset_invalid", "second use");
  // A use after 30 minutes + 1 s.
  const late = await issue(h, admin, u.id);
  h.tick(30 * MIN + 1000);
  await refused(late, "late-use-pass-23", "reset_invalid", "30 minutes + 1 s");
  // Codes that were never issued, of another length or changed in one character.
  const live = await issue(h, admin, u.id);
  for (const bad of [
    crypto.randomBytes(16).toString("base64url"),
    `${live.slice(0, -1)}${live.endsWith("A") ? "B" : "A"}`,
    live.slice(1),
    `${live}A`,
    "",
  ])
    await refused(
      bad,
      "never-issued-pass-24",
      "reset_invalid",
      `code ${bad.slice(0, 6)}`,
    );
  assert.equal((await use(h, live, "last-use-pass-25")).status, 200);
});

test("RS-3 the reset-link route answers 404 byte-equal to an unknown /api address for an ordinary user and for an anonymous caller", async (t) => {
  const h = await authHarness(t);
  await h.setup();
  const u = await h.signIn(await h.addUser());
  const v = await h.addUser();
  const token = await h.reauthToken(u, "reset_link");
  const before = await h.digest();
  for (const [
    as,
    reauth,
  ] of /** @type {Array<[Actor | null, string | null]>} */ ([
    [u, token],
    [u, null],
    [null, null],
    [null, token],
  ])) {
    for (const id of [v.id, u.id, "not-a-uuid"]) {
      const r = await h.call("POST", `/api/admin/users/${id}/reset-link`, {
        as,
        reauth,
        body: {},
      });
      const unknown = await h.call("POST", `/api/admin/users/${id}/nope`, {
        as,
        reauth,
        body: {},
      });
      assert.equal(r.status, 404);
      assert.equal(r.same, unknown.same, `${as ? "user" : "anonymous"} ${id}`);
    }
  }
  assert.deepEqual(await h.digest(), before);
});

test("RS-4 the issue and the use each write one audit row", async (t) => {
  const h = await authHarness(t);
  const admin = await h.signIn(await h.setup());
  const u = await h.addUser();
  assert.equal(await audits(h, "auth.reset_link_issued"), 0);
  const code = await issue(h, admin, u.id);
  assert.equal(await audits(h, "auth.reset_link_issued"), 1);
  assert.equal(await audits(h, "auth.reset_used"), 0);
  assert.equal((await use(h, code, "audited-reset-pass-31")).status, 200);
  assert.equal(await audits(h, "auth.reset_used"), 1);
  assert.equal(await audits(h, "auth.reset_link_issued"), 1);
  const rows = await h.sql(
    "select action, target_id, details from audit_log where action like 'auth.reset%' order by id",
  );
  assert.equal(rows[0].target_id, u.id);
  assert.match(rows[0].details.reauth_id, /^[0-9a-f-]{36}$/);
  assert.ok(!JSON.stringify(rows).includes(code));
});
