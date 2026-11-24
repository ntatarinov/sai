import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { formatDateTime } from "../../public/shared/format/kz.js";
import { withPlatform } from "../../server/db/tx.js";
import { purgeOrgProjects } from "../../server/services/projects.js";
import { authHarness } from "../fixtures/auth.js";
import { APP } from "../fixtures/helpers.js";
import {
  CLIENT_PASSWORD,
  STATE_TABLES,
  addProject,
  joinAsClient,
  ownerOrgId,
  plantInvite,
} from "../fixtures/m23.js";

// REQ-116 criterion 6 and REQ-117 criterion 9 (the code design M2PROJ, 4.3 N3, N5 and N6, 4.5.1, C10 to C12, 5,
// 16; section 7): the user's deletion request, the admin's list of requests with its KZ date, the deletion with
// the placeholders, the refusals with unchanged state, and the purge of an organisation's projects. The
// placeholders and the KZ date are the test's own literals; the state is read by plain SQL.

const SAME = /** @type {const} */ (["auth_sessions", ...STATE_TABLES]);
/** The tables a refused request must not touch (the re-auth counter of the user's row and its audit row are the things a wrong password commits, M2AUTH 4.9.5). */
const KEPT = /** @type {const} */ ([
  "deletion_requests",
  "invites",
  "org_members",
  "orgs",
  "user_consents",
]);

/** @param {import("node:test").TestContext} t */
async function world(t) {
  const h = await authHarness(t);
  const A = await h.actors();
  return { h, A, admin: A.admin };
}

/** @param {any} h @param {string} sql @param {unknown[]} [p] */
const one = async (h, sql, p) => (await h.sql(sql, p))[0];
/** @param {any} h @param {string} table */
const count = async (h, table) =>
  Number((await one(h, `select count(*)::int as c from ${table}`)).c);

/**
 * The deletion request of an actor with his password (or another).
 * @param {any} h
 * @param {any} actor
 * @param {string} [password]
 */
const request = (h, actor, password) =>
  h.call("POST", "/api/account/deletion-request", {
    as: actor,
    body: { password: password ?? actor.password },
  });

test("DEL-1 a signed-in user's request with his password stores one request with the clock time and writes one audit row", async (t) => {
  const { h, A } = await world(t);
  for (const [role, actor] of /** @type {Array<[string, any]>} */ ([
    ["viewer", A.viewer],
    ["member", A.member],
    ["org_admin", A.org_admin],
    ["org_owner", A.org_owner],
  ])) {
    const before = {
      req: await count(h, "deletion_requests"),
      aud: await count(h, "audit_log"),
    };
    h.tick(1000);
    const r = await request(h, actor);
    assert.equal(r.status, 200, `${role}: ${r.text}`);
    assert.deepEqual(r.json, {
      ok: true,
      requested_at: new Date(h.now()).toISOString(),
    });
    assert.equal(await count(h, "deletion_requests"), before.req + 1);
    const row = await one(
      h,
      "select * from deletion_requests where user_id = $1",
      [actor.id],
    );
    assert.equal(new Date(row.requested_at).getTime(), h.now());
    assert.equal(row.closed_at, null);
    const audit = await h.sql(
      "select * from audit_log where action = 'account.deletion_request' and actor_id = $1",
      [actor.id],
    );
    assert.equal(audit.length, 1, role);
    assert.equal(audit[0].actor_kind, "user");
    assert.equal(audit[0].target_kind, "user");
    assert.equal(audit[0].target_id, actor.id);
    assert.equal(audit[0].org_id, actor.orgId);
    assert.deepEqual(audit[0].details, {});
    assert.equal(
      (
        await h.sql(
          "select count(*)::int as c from audit_log where action = 'account.deletion_request'",
        )
      )[0].c,
      await count(h, "deletion_requests"),
    );
    assert.ok((await count(h, "audit_log")) > before.aud);
    // The request shows on his own account answer.
    const me = await h.call("GET", "/api/auth/me", { as: actor, origin: null });
    assert.equal(
      me.json.deletion_requested_at,
      new Date(h.now()).toISOString(),
    );
  }
});

test("DEL-2 a second request while one is open adds no row and no audit row and answers 2xx with the first time", async (t) => {
  const { h, A } = await world(t);
  const first = await request(h, A.member);
  assert.equal(first.status, 200);
  const digest = await h.digest(["deletion_requests", "audit_log"]);
  h.tick(60 * 1000);
  const second = await request(h, A.member);
  assert.equal(second.status, 200, second.text);
  assert.equal(second.json.requested_at, first.json.requested_at);
  assert.deepEqual(await h.digest(["deletion_requests", "audit_log"]), digest);
  // After the request is closed, a new one is stored again (the closed row stays).
  await h.sql(
    "update deletion_requests set closed_at = $1::timestamptz where user_id = $2",
    [new Date(h.now()).toISOString(), A.member.id],
  );
  const third = await request(h, A.member);
  assert.equal(third.status, 200);
  assert.equal(third.json.requested_at, new Date(h.now()).toISOString());
  assert.equal(
    Number(
      (
        await one(
          h,
          "select count(*)::int as c from deletion_requests where user_id = $1",
          [A.member.id],
        )
      ).c,
    ),
    2,
  );
});

test("DEL-3 a wrong password, a locked re-auth, an anonymous caller and the platform admin store no request", async (t) => {
  const { h, A, admin } = await world(t);
  const untouched = async () => h.digest(KEPT);
  const before = await untouched();
  const requests = async () =>
    Number(
      (
        await one(
          h,
          "select count(*)::int as c from audit_log where action = 'account.deletion_request'",
        )
      ).c,
    );
  // A wrong password: 401, no request, no deletion-request audit row; the re-auth counter of the user's row and
  // its one audit row (auth.reauth_failed, the rule of M2AUTH 4.9.5) are what commits.
  const auditBefore = await count(h, "audit_log");
  const wrong = await request(h, A.viewer, "wrong-password-1");
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, { error: "invalid_credentials" });
  assert.deepEqual(await untouched(), before);
  assert.equal(await requests(), 0);
  assert.equal(await count(h, "audit_log"), auditBefore + 1);
  assert.equal(
    (
      await one(
        h,
        "select action, details from audit_log order by id desc limit 1",
      )
    ).action,
    "auth.reauth_failed",
  );
  assert.equal(
    Number(
      (
        await one(h, "select reauth_failures from users where id = $1", [
          A.viewer.id,
        ])
      ).reauth_failures,
    ),
    1,
  );
  // An anonymous caller: 401.
  const anon = await h.call("POST", "/api/account/deletion-request", {
    body: { password: "x" },
  });
  assert.equal(anon.status, 401);
  assert.deepEqual(await untouched(), before);
  // The platform admin: 403 forbidden (his account cannot be deleted), no row, with his right password.
  const adm = await request(h, admin);
  assert.equal(adm.status, 403, adm.text);
  assert.deepEqual(adm.json, { error: "forbidden" });
  assert.deepEqual(await untouched(), before);
  // A body with a key it does not know and an empty body: 400, nothing written.
  const extra = await h.call("POST", "/api/account/deletion-request", {
    as: A.org_admin,
    body: { password: A.org_admin.password, org_id: A.org_admin.orgId },
  });
  assert.equal(extra.status, 400);
  assert.deepEqual(await untouched(), before);
  // Five wrong passwords lock the re-auth rule: even the right password then answers 429 reauth_locked.
  for (let i = 0; i < 5; i += 1) {
    const r = await request(h, A.org_owner, `wrong-reauth-${i}x`);
    assert.equal(r.status, 401, `attempt ${i}`);
    h.tick(60 * 1000);
  }
  const locked = await request(h, A.org_owner);
  assert.equal(locked.status, 429, locked.text);
  assert.deepEqual(locked.json, { error: "reauth_locked" });
  assert.deepEqual(await untouched(), before);
  assert.equal(await count(h, "deletion_requests"), 0);
  assert.equal(await requests(), 0);
});

test("DEL-4 the admin's list shows the request with its time in the KZ format; an ordinary user and an anonymous caller get the 404 of an unknown address", async (t) => {
  const { h, A, admin } = await world(t);
  // The injected clock is 2026-11-24 09:00 UTC: 14:00 in Astana.
  assert.equal(h.now(), Date.UTC(2026, 10, 24, 9, 0, 0));
  const r1 = await request(h, A.member);
  assert.equal(r1.status, 200);
  h.tick(30 * 60 * 1000);
  const r2 = await request(h, A.viewer);
  assert.equal(r2.status, 200);
  const list = await h.call("GET", "/api/admin/deletion-requests", {
    as: admin,
  });
  assert.equal(list.status, 200, list.text);
  assert.deepEqual(Object.keys(list.json), ["requests"]);
  assert.equal(list.json.requests.length, 2);
  const [first, second] = list.json.requests;
  assert.deepEqual(Object.keys(first).sort(), [
    "email",
    "id",
    "name",
    "requested_at",
    "user_id",
  ]);
  assert.equal(first.user_id, A.member.id, "oldest first");
  assert.equal(first.email, A.member.email);
  assert.equal(first.name, "Test User");
  assert.equal(second.user_id, A.viewer.id);
  assert.equal(first.requested_at, "2026-11-24T09:00:00.000Z");
  assert.equal(
    formatDateTime(Date.parse(first.requested_at)),
    "24.11.2026, 14:00",
  );
  assert.equal(
    formatDateTime(Date.parse(second.requested_at)),
    "24.11.2026, 14:30",
  );
  // A closed request is not listed.
  await h.sql(
    "update deletion_requests set closed_at = $1::timestamptz where user_id = $2",
    [new Date(h.now()).toISOString(), A.member.id],
  );
  const after = await h.call("GET", "/api/admin/deletion-requests", {
    as: admin,
  });
  assert.deepEqual(
    after.json.requests.map((/** @type {any} */ x) => x.user_id),
    [A.viewer.id],
  );
  // The 404s.
  for (const actor of /** @type {Array<any>} */ ([
    A.member,
    A.viewer,
    A.org_admin,
    A.org_owner,
    null,
  ])) {
    const res = await h.call("GET", "/api/admin/deletion-requests", {
      as: actor,
    });
    const unknown = await h.call("GET", "/api/admin/never-there", {
      as: actor,
    });
    assert.equal(res.status, 404);
    assert.equal(res.same, unknown.same);
  }
});

/** A client with everything a deletion must remove: sessions, a re-auth token, a reset code, TOTP columns, an unused invite of his address, a request. */
async function loaded(/** @type {any} */ h, /** @type {any} */ admin) {
  const client = await joinAsClient(h, admin, {
    email: "Delete.Me@Example.test",
    orgName: "Doomed Co",
    name: "Dina Deletable",
    ip: "203.0.113.70",
  });
  await h.reauthToken(client, "settings");
  await h.signIn(client, { ip: "203.0.113.71" });
  await h.sql(
    "insert into password_resets (user_id, code_hash, created_by, created_at, expires_at) values ($1, $2, $3, $4::timestamptz, $5::timestamptz)",
    [
      client.id,
      "a".repeat(64),
      admin.id,
      new Date(h.now()).toISOString(),
      new Date(h.now() + 1800000).toISOString(),
    ],
  );
  await h.sql(
    "update users set totp_secret_enc = 'v1.AAAAAAAAAAAAAAAA.BBBB.CCCCCCCCCCCCCCCCCCCCCC', totp_enabled_at = $2::timestamptz, totp_last_step = 12345, totp_recovery = $3, failed_logins = 2, reauth_failures = 1 where id = $1",
    [client.id, new Date(h.now()).toISOString(), [`${"b".repeat(64)}`]],
  );
  await plantInvite(h, {
    code: "L".repeat(22),
    email: "Delete.Me@Example.test",
    createdBy: admin.id,
    orgId: client.orgId,
  });
  assert.equal((await request(h, client)).status, 200);
  return client;
}

test("DEL-5 the admin's delete with a user_delete token replaces the personal fields by the placeholders, removes sessions, tokens, resets and the membership, scrubs every invite of his address, closes his request and keeps the consent record; a login then answers as for an unknown e-mail; no audit row holds his e-mail or name", async (t) => {
  const { h, admin } = await world(t);
  const client = await loaded(h, admin);
  const other = await joinAsClient(h, admin, {
    email: "stays@example.test",
    orgName: "Stays Co",
    name: "Stan Stays",
    ip: "203.0.113.72",
  });
  const projects = await addProject(h, {
    orgId: client.orgId,
    createdBy: client.id,
  });
  assert.ok(projects.id);
  // Before: what must go is there.
  const cnt = (/** @type {string} */ table) =>
    one(h, `select count(*)::int as c from ${table} where user_id = $1`, [
      client.id,
    ]).then((r) => Number(r.c));
  assert.ok((await cnt("auth_sessions")) >= 1);
  assert.ok((await cnt("reauth_tokens")) >= 1);
  assert.equal(await cnt("org_members"), 1);
  assert.equal(await cnt("password_resets"), 1);
  assert.equal(
    Number(
      (
        await one(
          h,
          "select count(*)::int as c from invites where email_norm = 'delete.me@example.test'",
        )
      ).c,
    ),
    2,
  );
  const otherRow = () =>
    one(h, "select row_to_json(u)::text as j from users u where id = $1", [
      other.id,
    ]).then((r) => r.j);
  const otherBefore = await otherRow();
  const token = await h.reauthToken(admin, "user_delete");
  h.tick(1000);
  const r = await h.call("POST", `/api/admin/users/${client.id}/delete`, {
    as: admin,
    reauth: token,
    body: {},
  });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { ok: true });
  const user = await one(h, "select * from users where id = $1", [client.id]);
  assert.equal(user.status, "deleted");
  assert.equal(user.email, `deleted-${client.id}@deleted.invalid`);
  assert.equal(user.email_norm, `deleted-${client.id}@deleted.invalid`);
  assert.equal(user.display_name, "Deleted account");
  assert.match(user.password_hash, /^scrypt\$17\$8\$1\$/);
  assert.equal(user.totp_secret_enc, null);
  assert.equal(user.totp_enabled_at, null);
  assert.equal(user.totp_last_step, null);
  assert.deepEqual(user.totp_recovery, []);
  assert.equal(user.failed_logins, 0);
  assert.equal(user.reauth_failures, 0);
  assert.equal(user.locked_until, null);
  assert.equal(user.is_owner_identity, true, "only the personal fields change");
  for (const table of [
    "auth_sessions",
    "reauth_tokens",
    "org_members",
    "password_resets",
  ])
    assert.equal(await cnt(table), 0, table);
  // No invite row of his address is left, unused or used (SEC F1); the used one holds the placeholder.
  const invites = await h.sql(
    "select * from invites where used_by = $1 or email_norm like '%delete.me%'",
    [client.id],
  );
  assert.deepEqual(
    invites.map((x) => [x.email_norm, x.used_at !== null]),
    [[`deleted-${client.id}@deleted.invalid`, true]],
  );
  assert.equal(
    Number(
      (
        await one(
          h,
          "select count(*)::int as c from invites where used_at is null and email_norm = 'delete.me@example.test'",
        )
      ).c,
    ),
    0,
  );
  const closed = await one(
    h,
    "select closed_at from deletion_requests where user_id = $1",
    [client.id],
  );
  assert.equal(new Date(closed.closed_at).getTime(), h.now());
  assert.equal(await cnt("user_consents"), 1, "the consent record stays");
  // The other client's row is byte for byte the same.
  assert.equal(await otherRow(), otherBefore);
  // The audit row of the deletion.
  const audit = await h.sql(
    "select * from audit_log where action = 'account.delete'",
  );
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_kind, "admin");
  assert.equal(audit[0].actor_id, admin.id);
  assert.equal(audit[0].target_kind, "user");
  assert.equal(audit[0].target_id, client.id);
  const spent = await one(
    h,
    "select id from reauth_tokens where purpose = 'user_delete' and used_at is not null",
  );
  assert.deepEqual(audit[0].details, { reauth_id: spent.id });
  // No audit row holds the old e-mail or name (every text column of every row), and no table does.
  const auditText = (
    await h.sql("select row_to_json(x)::text as j from audit_log x")
  )
    .map((x) => x.j)
    .join("\n")
    .toLowerCase();
  for (const secret of [
    "delete.me@example.test",
    "dina deletable",
    "dina",
    "delete.me",
  ])
    assert.ok(!auditText.includes(secret), secret);
  const dump = (await h.dump()).toLowerCase();
  for (const secret of ["delete.me@example.test", "dina deletable"])
    assert.ok(!dump.includes(secret), `dump: ${secret}`);
  // A login with the old e-mail and password answers as for an unknown e-mail; the old session is dead.
  const old = await h.call("POST", "/api/auth/login", {
    ip: "203.0.113.73",
    body: { email: "Delete.Me@Example.test", password: CLIENT_PASSWORD },
  });
  const ghost = await h.call("POST", "/api/auth/login", {
    ip: "203.0.113.74",
    body: { email: "Never.Existed@Example.test", password: CLIENT_PASSWORD },
  });
  assert.equal(old.status, 401);
  assert.equal(old.same, ghost.same);
  assert.equal(
    (await h.call("GET", "/api/auth/me", { as: client, origin: null })).status,
    401,
  );
  // The audit chain still verifies.
  assert.equal(
    (await h.call("GET", "/api/admin/audit/verify", { as: admin })).json.ok,
    true,
  );
  // The same user cannot be deleted twice.
  const again = await h.call("POST", `/api/admin/users/${client.id}/delete`, {
    as: admin,
    reauth: await h.reauthToken(admin, "user_delete"),
    body: {},
  });
  assert.equal(again.status, 404);
});

test("DEL-6 a delete without a token, of the platform admin (even by himself), by an ordinary user, of a missing, a deleted or a malformed id is refused with every row unchanged and the token unspent", async (t) => {
  const { h, A, admin } = await world(t);
  const client = await loaded(h, admin);
  const token = await h.reauthToken(admin, "user_delete");
  const unspent = async () =>
    Number(
      (
        await one(
          h,
          "select count(*)::int as c from reauth_tokens where used_at is null and purpose = 'user_delete'",
        )
      ).c,
    );
  const run = async (
    /** @type {string} */ name,
    /** @type {number} */ status,
    /** @type {string | null} */ code,
    /** @type {() => Promise<any>} */ call,
  ) => {
    const before = await h.digest(SAME);
    const r = await call();
    assert.equal(r.status, status, `${name}: ${r.text}`);
    if (code !== null) assert.equal(r.json?.error, code, name);
    assert.deepEqual(await h.digest(SAME), before, `${name}: state changed`);
    assert.equal(await unspent(), 1, `${name}: the token was spent`);
    return r;
  };
  for (const reauth of [null, "x", "not-a-token-of-43-characters"])
    await run(`no token (${reauth})`, 403, "reauth_required", () =>
      h.call("POST", `/api/admin/users/${client.id}/delete`, {
        as: admin,
        reauth,
        body: {},
      }),
    );
  await run("the admin himself", 403, "forbidden", () =>
    h.call("POST", `/api/admin/users/${admin.id}/delete`, {
      as: admin,
      reauth: token,
      body: {},
    }),
  );
  // The token of another purpose does not work for a delete.
  const wrongPurpose = await h.reauthToken(admin, "owner_identity");
  const before = await h.digest(SAME);
  const wp = await h.call("POST", `/api/admin/users/${client.id}/delete`, {
    as: admin,
    reauth: wrongPurpose,
    body: {},
  });
  assert.equal(wp.status, 403);
  assert.deepEqual(wp.json, { error: "reauth_required" });
  assert.deepEqual(await h.digest(SAME), before);
  for (const [who, actor] of /** @type {Array<[string, any]>} */ ([
    ["viewer", A.viewer],
    ["member", A.member],
    ["org_admin", A.org_admin],
    ["org_owner", A.org_owner],
    ["the client himself", client],
    ["anonymous", null],
  ])) {
    const res = await run(`by ${who}`, 404, null, () =>
      h.call("POST", `/api/admin/users/${client.id}/delete`, {
        as: actor,
        reauth: token,
        body: {},
      }),
    );
    const unknown = await h.call(
      "POST",
      `/api/admin/never-there/${client.id}`,
      { as: actor, reauth: token, body: {} },
    );
    assert.equal(res.same, unknown.same, who);
  }
  await run("a missing user", 404, "not_found", () =>
    h.call("POST", `/api/admin/users/${crypto.randomUUID()}/delete`, {
      as: admin,
      reauth: token,
      body: {},
    }),
  );
  await run("a malformed id", 404, "not_found", () =>
    h.call("POST", "/api/admin/users/not-a-uuid/delete", {
      as: admin,
      reauth: token,
      body: {},
    }),
  );
  await run("a key org_id", 400, "bad_body", () =>
    h.call("POST", `/api/admin/users/${client.id}/delete`, {
      as: admin,
      reauth: token,
      body: { org_id: client.orgId },
    }),
  );
  // A deleted user: 404 (use a second token: the first one is still unspent and must stay so).
  const ok = await h.call("POST", `/api/admin/users/${client.id}/delete`, {
    as: admin,
    reauth: token,
    body: {},
  });
  assert.equal(ok.status, 200, ok.text);
  const fresh = await h.reauthToken(admin, "user_delete");
  const digest = await h.digest(SAME);
  const dead = await h.call("POST", `/api/admin/users/${client.id}/delete`, {
    as: admin,
    reauth: fresh,
    body: {},
  });
  assert.equal(dead.status, 404);
  assert.deepEqual(await h.digest(SAME), digest);
  assert.equal(await unspent(), 1);
});

test("DEL-7 deleting the only member of a customer organisation removes that organisation's projects and idea versions and keeps their audit rows; deleting one of two members keeps them; the owner organisation is never purged", async (t) => {
  const { h, A, admin } = await world(t);
  const lone = await joinAsClient(h, admin, {
    email: "lone@example.test",
    orgName: "Lone Co",
    name: "Lone",
    ip: "203.0.113.75",
  });
  const p1 = await addProject(h, {
    orgId: lone.orgId,
    createdBy: lone.id,
    title: "Lone shop",
    versions: [{ text: "one" }, { text: "two", reason: "why" }],
  });
  const p2 = await addProject(h, {
    orgId: lone.orgId,
    createdBy: lone.id,
    title: "Lone bot",
  });
  // A project of another organisation and of the owner organisation stay whatever happens.
  const keep = await addProject(h, {
    orgId: A.member.orgId,
    createdBy: A.member.id,
    title: "Member org project",
  });
  const ownerOrg = await ownerOrgId(h);
  const ownersOwn = await addProject(h, {
    orgId: ownerOrg,
    createdBy: admin.id,
    title: "Owner project",
  });
  // A pair: delete one member of an organisation that keeps another: the projects stay.
  const pair = await joinAsClient(h, admin, {
    email: "pair@example.test",
    orgName: "Pair Co",
    name: "Pair One",
    ip: "203.0.113.76",
  });
  const second = await h.addUser({
    email: "pair2@example.test",
    role: "member",
    orgId: pair.orgId,
  });
  await addProject(h, {
    orgId: pair.orgId,
    createdBy: pair.id,
    title: "Pair project",
  });
  const del = async (/** @type {string} */ id) =>
    h.call("POST", `/api/admin/users/${id}/delete`, {
      as: admin,
      reauth: await h.reauthToken(admin, "user_delete"),
      body: {},
    });
  const projectsOf = async (/** @type {string} */ org) => ({
    p: Number(
      (
        await one(
          h,
          "select count(*)::int as c from projects where org_id = $1",
          [org],
        )
      ).c,
    ),
    v: Number(
      (
        await one(
          h,
          "select count(*)::int as c from idea_versions where org_id = $1",
          [org],
        )
      ).c,
    ),
  });
  assert.deepEqual(await projectsOf(pair.orgId), { p: 1, v: 1 });
  const d1 = await del(second.id);
  assert.equal(d1.status, 200, d1.text);
  assert.deepEqual(
    await projectsOf(pair.orgId),
    { p: 1, v: 1 },
    "an organisation that keeps a member keeps its projects",
  );
  // The lone member: the organisation is left with no member, so its projects go.
  assert.deepEqual(await projectsOf(lone.orgId), { p: 2, v: 3 });
  const auditBefore = Number(
    (
      await one(
        h,
        "select count(*)::int as c from audit_log where org_id = $1",
        [lone.orgId],
      )
    ).c,
  );
  assert.ok(auditBefore >= 1);
  const d2 = await del(lone.id);
  assert.equal(d2.status, 200, d2.text);
  assert.deepEqual(await projectsOf(lone.orgId), { p: 0, v: 0 });
  assert.equal(
    Number(
      (
        await one(
          h,
          "select count(*)::int as c from audit_log where org_id = $1",
          [lone.orgId],
        )
      ).c,
    ),
    auditBefore,
    "the audit rows of the organisation stay",
  );
  assert.equal(
    Number(
      (
        await one(
          h,
          "select count(*)::int as c from projects where id = any($1::uuid[])",
          [[p1.id, p2.id]],
        )
      ).c,
    ),
    0,
  );
  // Other organisations' projects are untouched.
  assert.deepEqual(await projectsOf(A.member.orgId), { p: 1, v: 1 });
  assert.deepEqual(await projectsOf(ownerOrg), { p: 1, v: 1 });
  assert.equal(
    Number(
      (
        await one(
          h,
          "select count(*)::int as c from projects where id = any($1::uuid[])",
          [[keep.id, ownersOwn.id]],
        )
      ).c,
    ),
    2,
  );
  // The purge helper refuses the owner organisation before any delete (SEC F4), with every row unchanged.
  const before = await h.digest(SAME);
  await assert.rejects(
    () =>
      withPlatform({ transaction: h.raw.transaction.bind(h.raw) }, (q) =>
        purgeOrgProjects(q, ownerOrg),
      ),
    (/** @type {any} */ e) => e instanceof TypeError && /owner/.test(e.message),
  );
  assert.deepEqual(await h.digest(SAME), before);
  // A customer organisation still purges through the helper (its counts come back).
  const extra = await joinAsClient(h, admin, {
    email: "extra@example.test",
    orgName: "Extra Co",
    name: "Extra",
    ip: "203.0.113.77",
  });
  await addProject(h, {
    orgId: extra.orgId,
    createdBy: extra.id,
    versions: [{ text: "a" }, { text: "b", reason: "c" }],
  });
  await h.sql("delete from org_members where user_id = $1", [extra.id]);
  const res = await withPlatform(
    { transaction: h.raw.transaction.bind(h.raw) },
    (q) => purgeOrgProjects(q, extra.orgId),
  );
  assert.deepEqual(res, { versions: 2, projects: 1 });
  assert.deepEqual(await projectsOf(extra.orgId), { p: 0, v: 0 });
});

test("DEL-8 `delete from idea_versions` and `purge_org` stand in app/server only in the project store", async () => {
  /** @type {string[]} */
  const deletes = [];
  /** @type {string[]} */
  const settings = [];
  const walk = (/** @type {string} */ dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js")) {
        const rel = path.relative(APP, p).split(path.sep).join("/");
        const text = fs.readFileSync(p, "utf8");
        if (/delete\s+from\s+idea_versions/i.test(text)) deletes.push(rel);
        if (/purge_org/.test(text)) settings.push(rel);
      }
    }
  };
  walk(path.join(APP, "server"));
  assert.deepEqual(deletes, ["server/db/project-store.js"]);
  assert.deepEqual(settings, ["server/db/project-store.js"]);
  // Self-check of the scan: the expression finds a planted line in any case and spacing, and not another table.
  const holds = (/** @type {string} */ text) =>
    /delete\s+from\s+idea_versions/i.test(text);
  assert.ok(holds("DELETE  FROM idea_versions where x"));
  assert.ok(!holds("delete from projects where x"));
});
