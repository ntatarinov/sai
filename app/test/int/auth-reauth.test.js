import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { routeTable } from "../../server/routes/index.js";
import { authHarness, totpCode } from "../fixtures/auth.js";

// REQ-114 criterion 6 (the code design M2AUTH, 4.9.4, 4.7 step 8), with the clock injected: a re-auth token
// works once, for its own purpose, in its own session, for its own user, for 5 minutes; an unknown purpose is
// refused before any scrypt; the token is stored only as an HMAC; every route marked `reauth` refuses a call
// without a token with the state unchanged. A planted route of the test (deps.routeTable) consumes the purpose
// «settings», so the binding to the user is checked for an ordinary user too.

/** The purposes of the closed table of the code design, 4.9.4, and user_delete (the code design M2PROJ, C12, guard row G2). */
const PURPOSES = [
  "reset_link",
  "totp_enrol",
  "totp_off",
  "dev_start",
  "dev_resume",
  "worker_token",
  "settings",
  "kill_switch_off",
  "ai_allow",
  "codes",
  "owner_identity",
  "user_delete",
];

/** A planted route that consumes the purpose «settings» and counts the actions it does. */
function planted() {
  let actions = 0;
  const row = Object.freeze({
    method: "POST",
    path: "/api/test/settings",
    meta: Object.freeze({
      tenant: false,
      admin: false,
      reauth: "settings",
      worker: false,
      session: true,
      rateLimit: "user",
    }),
    handler: async () => {
      actions += 1;
      return { status: 200, body: { ok: true } };
    },
  });
  return { row, actions: () => actions };
}

/** @param {import("node:test").TestContext} t */
async function harness(t) {
  const p = planted();
  /** @type {ReadonlyArray<any>} */
  let rows = [];
  const h = await authHarness(t, {
    routeTable: (/** @type {any} */ deps) =>
      (rows = [...routeTable(deps), p.row]),
  });
  return { h, p, rows: () => rows };
}

test("RA-1 the right password and a purpose of the table answer a token of 43 characters for 300 s; it works once for a route of its purpose", async (t) => {
  const { h, p } = await harness(t);
  const admin = await h.signIn(await h.setup());
  const u = await h.signIn(await h.addUser());
  for (const purpose of PURPOSES) {
    const r = await h.call("POST", "/api/auth/reauth", {
      as: u,
      body: { password: u.password, purpose },
    });
    assert.equal(r.status, 200, `${purpose}: ${r.text}`);
    assert.deepEqual(Object.keys(r.json).sort(), ["expires_in", "token"]);
    assert.match(r.json.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(r.json.expires_in, 300);
  }
  const token = await h.reauthToken(u, "settings");
  const used = await h.call("POST", "/api/test/settings", {
    as: u,
    reauth: token,
    body: {},
  });
  assert.equal(used.status, 200);
  assert.equal(p.actions(), 1);
  // A real route of its purpose: the admin's reset link.
  const before = (await h.counts()).password_resets;
  const link = await h.call("POST", `/api/admin/users/${u.id}/reset-link`, {
    as: admin,
    reauth: await h.reauthToken(admin, "reset_link"),
    body: {},
  });
  assert.equal(link.status, 200);
  assert.equal((await h.counts()).password_resets, before + 1);
});

test("RA-2 a second use, a use after 5 minutes + 1 s, a use from another session of the same user, by another user and for another purpose each answer 403 reauth_required and the action does not happen", async (t) => {
  const { h, p } = await harness(t);
  const admin = await h.signIn(await h.setup());
  const u = await h.signIn(await h.addUser());
  const u2 = await h.signIn(
    { ...u, cookie: null, csrf: null },
    { ip: "192.0.2.70" },
  );
  const v = await h.signIn(await h.addUser());
  const admin2 = await h.signIn(
    { ...admin, cookie: null, csrf: null },
    { ip: "192.0.2.71" },
  );
  /** @param {import("../fixtures/auth.js").Actor} as @param {string} token @param {string} label */
  const refused = async (as, token, label, path = "/api/test/settings") => {
    const actions = p.actions();
    const digest = await h.digest();
    const r = await h.call("POST", path, { as, reauth: token, body: {} });
    assert.equal(r.status, 403, `${label}: ${r.text}`);
    assert.deepEqual(r.json, { error: "reauth_required" }, label);
    assert.equal(p.actions(), actions, `${label}: the action did not happen`);
    assert.deepEqual(await h.digest(), digest, `${label}: rows unchanged`);
  };
  // Second use.
  const once = await h.reauthToken(u, "settings");
  assert.equal(
    (
      await h.call("POST", "/api/test/settings", {
        as: u,
        reauth: once,
        body: {},
      })
    ).status,
    200,
  );
  await refused(u, once, "second use");
  // Expiry: 5 minutes − 1 s works, 5 minutes + 1 s does not.
  const fresh = await h.reauthToken(u, "settings");
  h.tick(5 * 60 * 1000 - 1000);
  assert.equal(
    (
      await h.call("POST", "/api/test/settings", {
        as: u,
        reauth: fresh,
        body: {},
      })
    ).status,
    200,
  );
  const late = await h.reauthToken(u, "settings");
  h.tick(5 * 60 * 1000 + 1000);
  await refused(u, late, "after 5 minutes + 1 s");
  // Another session of the same user, another user, another purpose.
  const mine = await h.reauthToken(u, "settings");
  await refused(u2, mine, "another session of the same user");
  await refused(v, mine, "another user");
  const other = await h.reauthToken(u, "codes");
  await refused(u, other, "another purpose");
  await refused(
    u,
    `${mine.slice(0, -1)}${mine.endsWith("A") ? "B" : "A"}`,
    "a changed token",
  );
  await refused(
    u,
    crypto.randomBytes(32).toString("base64url"),
    "a random token",
  );
  await refused(u, mine.slice(1), "a short token");
  // The token is still good in its own session (the refusals did not consume it).
  assert.equal(
    (
      await h.call("POST", "/api/test/settings", {
        as: u,
        reauth: mine,
        body: {},
      })
    ).status,
    200,
  );
  // The same rules on a real admin route.
  const target = await h.addUser();
  const path = `/api/admin/users/${target.id}/reset-link`;
  const t1 = await h.reauthToken(admin, "reset_link");
  await refused(admin2, t1, "admin: another session", path);
  const t2 = await h.reauthToken(admin, "totp_enrol");
  await refused(admin, t2, "admin: another purpose", path);
  assert.equal(
    (await h.call("POST", path, { as: admin, reauth: t1, body: {} })).status,
    200,
  );
  await refused(admin, t1, "admin: second use", path);
  const t3 = await h.reauthToken(admin, "reset_link");
  h.tick(5 * 60 * 1000 + 1000);
  await refused(admin, t3, "admin: after 5 minutes + 1 s", path);
});

test("RA-3 an unknown purpose → 400 unknown_purpose before any scrypt, with every row unchanged", async (t) => {
  const { h } = await harness(t);
  const u = await h.signIn(await h.addUser());
  const before = await h.digest();
  const scrypts = h.hasher.count();
  for (const purpose of [
    "",
    "nope",
    "RESET_LINK",
    "reset_link ",
    " settings",
    "settings​",
    "reset-link",
    "admin",
  ]) {
    const r = await h.call("POST", "/api/auth/reauth", {
      as: u,
      body: { password: u.password, purpose },
    });
    assert.equal(r.status, 400, JSON.stringify(purpose));
    assert.ok(
      r.json.error === "unknown_purpose" || r.json.error === "bad_body",
      `${JSON.stringify(purpose)}: ${r.text}`,
    );
    if (/^[A-Za-z_ -]*$/.test(purpose))
      assert.equal(r.json.error, "unknown_purpose", purpose);
  }
  assert.equal(h.hasher.count(), scrypts);
  assert.deepEqual(await h.digest(), before);
});

test("RA-4 the token value is stored only as a hash: no column of any table holds it in any of its forms", async (t) => {
  const { h } = await harness(t);
  const u = await h.signIn(await h.addUser());
  const tokens = [];
  for (const purpose of ["settings", "codes", "reset_link"])
    tokens.push(await h.reauthToken(u, purpose));
  const dump = await h.dump();
  for (const token of tokens) {
    const bytes = Buffer.from(token, "base64url");
    for (const form of [token, bytes.toString("hex"), bytes.toString("base64")])
      assert.ok(!dump.includes(form), form.slice(0, 8));
  }
  const rows = await h.sql("select token_hash from reauth_tokens");
  assert.equal(rows.length, 3);
  for (const r of rows) assert.match(r.token_hash, /^[0-9a-f]{64}$/);
});

test("RA-5 every route of the real table marked reauth answers 403 reauth_required without a token, with every row unchanged", async (t) => {
  const { h, rows } = await harness(t);
  const admin = await h.signIn(await h.setup());
  const target = await h.addUser();
  const victim = await h.addUser({ email: "victim@example.test" });
  // TOTP on, so that the switch-off route would act if the token were not checked.
  const enrol = await h.call("POST", "/api/admin/totp/enrol", {
    as: admin,
    reauth: await h.reauthToken(admin, "totp_enrol"),
    body: {},
  });
  const secret = enrol.json.secret;
  assert.equal(
    (
      await h.call("POST", "/api/admin/totp/confirm", {
        as: admin,
        body: { code: totpCode(secret, h.now()) },
      })
    ).status,
    200,
  );
  h.tick(30000);
  /** @type {Record<string, () => { path: string, body: Record<string, unknown> }>} */
  const CASES = {
    "POST /api/admin/users/:id/reset-link": () => ({
      path: `/api/admin/users/${target.id}/reset-link`,
      body: {},
    }),
    "POST /api/admin/totp/enrol": () => ({
      path: "/api/admin/totp/enrol",
      body: {},
    }),
    "POST /api/admin/totp/off": () => ({
      path: "/api/admin/totp/off",
      body: { code: totpCode(secret, h.now()) },
    }),
    "POST /api/test/settings": () => ({ path: "/api/test/settings", body: {} }),
    // REQ-116 (guard row G2): the invite route (purpose owner_identity) and the deletion route (user_delete).
    "POST /api/admin/invites": () => ({
      path: "/api/admin/invites",
      body: {
        email: "invited@example.test",
        role: "org_owner",
        owner_identity: true,
        org_name: "Invited Co",
      },
    }),
    "POST /api/admin/users/:id/delete": () => ({
      path: `/api/admin/users/${victim.id}/delete`,
      body: {},
    }),
  };
  const marked = rows().filter((r) => r.meta.reauth !== null);
  t.diagnostic(`RA-5 routes marked reauth: ${marked.length}`);
  assert.ok(marked.length >= 6);
  const markedKeys = marked.map((r) => `${r.method} ${r.path}`);
  for (const key of [
    "POST /api/admin/invites",
    "POST /api/admin/users/:id/delete",
  ])
    assert.ok(markedKeys.includes(key), `${key} is marked reauth`);
  for (const r of marked) {
    const key = `${r.method} ${r.path}`;
    assert.ok(CASES[key], `no case for ${key}`);
    const c = CASES[key]();
    for (const reauth of [null, "x", "not-a-token-of-43-characters"]) {
      const before = await h.digest();
      const res = await h.call(r.method, c.path, {
        as: admin,
        reauth,
        body: c.body,
      });
      assert.equal(res.status, 403, `${key}: ${res.text}`);
      assert.deepEqual(res.json, { error: "reauth_required" });
      assert.deepEqual(await h.digest(), before, key);
    }
  }
});
