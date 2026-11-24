import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { createPgAdapter } from "../../server/db/pg.js";
import { routeTable } from "../../server/routes/index.js";
import { PERSONAL_DATA_GATE } from "../../server/services/orgs.js";
import { authHarness } from "../fixtures/auth.js";
import { APP, pgStandIn, waitFor } from "../fixtures/helpers.js";
import {
  CONSENT,
  STATE_TABLES,
  acceptBody,
  acceptInvite,
  codeOf,
  consentSha,
  createInvite,
  inviteBody,
  inviteHash,
  joinAsClient,
  ownerOrgId,
  plantInvite,
  setRegistrationMode,
} from "../fixtures/m23.js";

// REQ-116 criteria 1 to 7 and 10 (the code design M2PROJ, 4.3 N1 and N2 and N4, 4.5.1, C4 to C9, 5; section 7.1) on
// PGlite through app.request, with the injected clock. The oracles are the test's own: the HMAC of a code is
// computed with node:crypto from the harness pepper, the consent digests come from the literals of
// fixtures/m23.js, the state is read by plain SQL. A refused call is checked by the sha256 of every row of the
// tables that a state change could touch (the rate_limits row of the address is the one thing that may change).

/** The tables compared before and after a refusal (a session is state too). */
const SAME = /** @type {const} */ (["auth_sessions", ...STATE_TABLES]);

/**
 * The app with its actors: the platform admin and one user of each role in one customer organisation.
 * @param {import("node:test").TestContext} t
 * @param {Parameters<typeof authHarness>[1]} [o]
 */
async function world(t, o) {
  const h = await authHarness(t, o);
  const A = await h.actors();
  return { h, A, admin: A.admin };
}

/** The row count of a table. @param {any} h @param {string} table */
const count = async (h, table) =>
  Number((await h.sql(`select count(*)::int as c from ${table}`))[0].c);

/**
 * Runs `call`, and checks the answer and that the rows of SAME are byte for byte what they were.
 * @param {any} h
 * @param {string} name
 * @param {number} status
 * @param {string | null} code
 * @param {() => Promise<any>} call
 */
async function refused(h, name, status, code, call) {
  const before = await h.digest(SAME);
  const r = await call();
  assert.equal(r.status, status, `${name}: ${r.text}`);
  if (code !== null) assert.equal(r.json?.error, code, `${name}: ${r.text}`);
  assert.deepEqual(await h.digest(SAME), before, `${name}: state changed`);
  return r;
}

test("INV-1 the admin creates an invite with a re-auth token: the link is shown once, the row holds only the HMAC of the code, it lives 7 days, one audit row holds the token's id", async (t) => {
  const { h, A, admin } = await world(t);
  const counts0 = { inv: await count(h, "invites") };
  const token = await h.reauthToken(admin, "owner_identity");
  const r = await h.call("POST", "/api/admin/invites", {
    as: admin,
    reauth: token,
    body: inviteBody(),
  });
  assert.equal(r.status, 201, r.text);
  assert.deepEqual(Object.keys(r.json).sort(), ["expires_at", "link"]);
  assert.match(
    r.json.link,
    /^http:\/\/127\.0\.0\.1:1\/invite\.html#c=[A-Za-z0-9_-]{22}$/,
  );
  const code = codeOf(r.json.link);
  assert.equal(
    r.json.expires_at,
    new Date(h.now() + 7 * 24 * 3600 * 1000).toISOString(),
  );
  const rows = await h.sql("select * from invites");
  assert.equal(rows.length, counts0.inv + 1);
  const inv = rows[0];
  assert.equal(inv.code_hash, inviteHash(h.pepper, code));
  assert.equal(new Date(inv.expires_at).getTime(), h.now() + 604800000);
  assert.equal(inv.email_norm, "new.client@example.test");
  assert.equal(inv.org_id, null);
  assert.equal(inv.org_name, "Client Co");
  assert.equal(inv.role, "org_owner");
  assert.equal(inv.owner_identity, true);
  assert.equal(inv.created_by, admin.id);
  assert.equal(inv.used_at, null);
  assert.equal(inv.used_by, null);
  // The code stands in no table, in no form: not as text, not as hex, not as base64.
  const bytes = Buffer.from(code, "base64url");
  assert.equal(bytes.length, 16);
  const dump = await h.dump();
  for (const form of [code, bytes.toString("hex"), bytes.toString("base64")])
    assert.ok(!dump.includes(form), form);
  // One audit row, with the id of the token that was spent.
  const audit = await h.sql(
    "select * from audit_log where action = 'invite.create'",
  );
  assert.equal(audit.length, 1);
  const spent = await h.sql(
    "select id from reauth_tokens where purpose = 'owner_identity' and used_at is not null",
  );
  assert.equal(spent.length, 1);
  assert.equal(audit[0].details.reauth_id, spent[0].id);
  assert.deepEqual(Object.keys(audit[0].details).sort(), [
    "owner_identity",
    "reauth_id",
    "role",
  ]);
  assert.equal(audit[0].details.role, "org_owner");
  assert.equal(audit[0].details.owner_identity, true);
  assert.equal(audit[0].actor_kind, "admin");
  assert.equal(audit[0].actor_id, admin.id);
  assert.equal(audit[0].target_kind, "invite");
  assert.equal(audit[0].target_id, inv.id);
  assert.equal(audit[0].org_id, null);
  // An invite into an existing customer organisation: its id is on the row and on the audit row; no name.
  const second = await createInvite(
    h,
    admin,
    inviteBody({
      email: "Viewer.Person@Example.test",
      role: "viewer",
      org_name: undefined,
      organisation: A.member.orgId,
    }),
  );
  assert.equal(second.status, 201, second.text);
  const row2 = (
    await h.sql("select * from invites where code_hash = $1", [
      inviteHash(h.pepper, /** @type {string} */ (second.code)),
    ])
  )[0];
  assert.equal(row2.org_name, null);
  assert.equal(row2.role, "viewer");
  assert.notEqual(row2.org_id, null);
  const audit2 = await h.sql(
    "select * from audit_log where action = 'invite.create' and target_id = $1",
    [row2.id],
  );
  assert.equal(audit2.length, 1);
  assert.equal(audit2[0].org_id, row2.org_id);
  // The chain of the audit log still verifies.
  const verify = await h.call("GET", "/api/admin/audit/verify", { as: admin });
  assert.equal(verify.json.ok, true);
});

test("INV-2 refused creations leave invites and audit_log (and every other table) unchanged and the token unspent; an ordinary user and an anonymous caller get the 404 of an unknown /api address; the G7 constant is «owner_only»", async (t) => {
  const { h, A, admin } = await world(t);
  assert.equal(PERSONAL_DATA_GATE, "owner_only");
  const owner = await ownerOrgId(h);
  const customer = A.member.orgId;
  const unspent = async () =>
    Number(
      (
        await h.sql(
          "select count(*)::int as c from reauth_tokens where used_at is null and purpose = 'owner_identity'",
        )
      )[0].c,
    );
  // No token (and wrong ones): 403 reauth_required, nothing written.
  for (const reauth of [null, "x", "not-a-token-of-43-characters"])
    await refused(h, `reauth ${reauth}`, 403, "reauth_required", () =>
      h.call("POST", "/api/admin/invites", {
        as: admin,
        reauth,
        body: inviteBody(),
      }),
    );
  const token = await h.reauthToken(admin, "owner_identity");
  /** @type {Array<[string, number, string, Record<string, unknown>]>} */
  const bad = [
    [
      "the gate: a flag false",
      403,
      "personal_data_gate",
      inviteBody({ owner_identity: false }),
    ],
    [
      "the gate: a flag false for an existing organisation",
      403,
      "personal_data_gate",
      {
        email: "c@example.test",
        role: "member",
        owner_identity: false,
        organisation: customer,
      },
    ],
    [
      "the owner organisation with the flag false (before the gate)",
      400,
      "owner_identity_required",
      {
        email: "c@example.test",
        role: "member",
        owner_identity: false,
        organisation: owner,
      },
    ],
    [
      "organisation and a name",
      400,
      "bad_body",
      {
        email: "c@example.test",
        role: "org_owner",
        owner_identity: true,
        organisation: customer,
        org_name: "X",
      },
    ],
    [
      "neither organisation nor name",
      400,
      "bad_body",
      { email: "c@example.test", role: "org_owner", owner_identity: true },
    ],
    [
      "a new organisation with another role than org_owner",
      400,
      "bad_body",
      inviteBody({ role: "member" }),
    ],
    ["a role outside the four", 400, "bad_body", inviteBody({ role: "root" })],
    [
      "a name of 121 characters",
      400,
      "bad_body",
      inviteBody({ org_name: "n".repeat(121) }),
    ],
    ["an empty name", 400, "bad_body", inviteBody({ org_name: "" })],
    ["a key org_id", 400, "bad_body", { ...inviteBody(), org_id: customer }],
    ["a key orgId", 400, "bad_body", { ...inviteBody(), orgId: customer }],
    [
      "owner_identity as a string",
      400,
      "bad_body",
      inviteBody({ owner_identity: "true" }),
    ],
    [
      "a missing owner_identity",
      400,
      "bad_body",
      (({ owner_identity: _o, ...rest }) => rest)(inviteBody()),
    ],
    [
      "an unknown organisation",
      404,
      "not_found",
      {
        email: "c@example.test",
        role: "member",
        owner_identity: true,
        organisation: crypto.randomUUID(),
      },
    ],
    [
      "a text that is no uuid as organisation",
      400,
      "bad_body",
      {
        email: "c@example.test",
        role: "member",
        owner_identity: true,
        organisation: "nope",
      },
    ],
    [
      "an e-mail that has an account",
      409,
      "account_exists",
      {
        email: "Member@Example.test",
        role: "member",
        owner_identity: true,
        organisation: customer,
      },
    ],
    [
      "an e-mail that is no address",
      400,
      "bad_body",
      inviteBody({ email: "not-an-address" }),
    ],
  ];
  for (const [name, status, code, body] of bad)
    await refused(h, name, status, code, () =>
      h.call("POST", "/api/admin/invites", { as: admin, reauth: token, body }),
    );
  assert.equal(
    await unspent(),
    1,
    "a refused creation does not spend the token",
  );
  // The same token still works for a good call, and only once.
  const ok = await h.call("POST", "/api/admin/invites", {
    as: admin,
    reauth: token,
    body: {
      email: "Fine@Example.test",
      role: "member",
      owner_identity: true,
      organisation: customer,
    },
  });
  assert.equal(ok.status, 201, ok.text);
  const again = await h.call("POST", "/api/admin/invites", {
    as: admin,
    reauth: token,
    body: inviteBody({ email: "Other@Example.test" }),
  });
  assert.equal(again.status, 403);
  // An invite into the owner organisation WITH the flag is allowed.
  const into = await createInvite(h, admin, {
    email: "second.identity@example.test",
    role: "member",
    owner_identity: true,
    organisation: owner,
  });
  assert.equal(into.status, 201, into.text);
  // An ordinary user of every role and an anonymous caller: the 404 of an unknown address, with and without Origin.
  for (const [who, actor] of /** @type {Array<[string, any]>} */ ([
    ["viewer", A.viewer],
    ["member", A.member],
    ["org_admin", A.org_admin],
    ["org_owner", A.org_owner],
    ["anonymous", null],
  ]))
    for (const origin of [undefined, null]) {
      const before = await h.digest(SAME);
      const res = await h.call("POST", "/api/admin/invites", {
        as: actor,
        origin,
        body: inviteBody(),
      });
      const unknown = await h.call("POST", "/api/admin/never-there", {
        as: actor,
        origin,
        body: inviteBody(),
      });
      assert.equal(res.status, 404, `${who} ${origin}`);
      assert.equal(res.same, unknown.same, `${who} ${origin}`);
      assert.deepEqual(await h.digest(SAME), before);
    }
});

test("INV-3 GET of a valid code answers the organisation, the role and the consent languages and nothing else; an unknown, expired, used or malformed code answers the same 404", async (t) => {
  const { h, A, admin } = await world(t);
  const made = await createInvite(h, admin);
  const code = /** @type {string} */ (made.code);
  const view = (/** @type {string} */ c, o = {}) =>
    h.call("GET", `/api/invites/${c}`, { ip: "203.0.113.77", ...o });
  const r = await view(code);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(Object.keys(r.json).sort(), [
    "consent_langs",
    "org",
    "role",
  ]);
  assert.deepEqual(r.json.org, { name: "Client Co", new: true });
  assert.equal(r.json.role, "org_owner");
  assert.deepEqual([...r.json.consent_langs].sort(), ["en", "kk", "ru"]);
  const invite = (await h.sql("select id from invites"))[0];
  for (const secret of [
    "example.test",
    invite.id,
    admin.id,
    "New.Client",
    "new.client",
  ])
    assert.ok(!r.text.toLowerCase().includes(secret.toLowerCase()), secret);
  // An invite for an existing organisation shows that organisation's name.
  const existing = await createInvite(h, admin, {
    email: "someone@example.test",
    role: "member",
    owner_identity: true,
    organisation: A.member.orgId,
  });
  const orgName = (
    await h.sql("select name from orgs where id = $1", [A.member.orgId])
  )[0].name;
  const r2 = await view(/** @type {string} */ (existing.code));
  assert.deepEqual(r2.json.org, { name: orgName, new: false });
  assert.equal(r2.json.role, "member");
  // The mode `closed` does not stop the view (the accept refuses).
  await setRegistrationMode(h, "closed");
  assert.equal((await view(code)).status, 200);
  await setRegistrationMode(h, null);
  // The 404s: byte-equal except Date and X-Request-Id.
  const unknown = await view("A".repeat(22));
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.json, { error: "not_found" });
  const shapes = [
    "abc",
    "A".repeat(21),
    "A".repeat(23),
    `${"A".repeat(21)}!`,
    "a%20b",
  ];
  for (const s of shapes) {
    const x = await view(s);
    assert.equal(x.same, unknown.same, s);
  }
  // Used: after an accept the code answers the same 404.
  const acc = await acceptInvite(h, code);
  assert.equal(acc.status, 200, acc.text);
  assert.equal((await view(code)).same, unknown.same);
  // Expired: 7 days and one second after the creation.
  const exp = /** @type {string} */ (existing.code);
  h.tick(7 * 24 * 3600 * 1000 + 1000);
  const late = await view(exp);
  assert.equal(late.same, unknown.same);
});

test("INV-4 a valid accept creates one user, one membership with the invite's role, for a new organisation one customer organisation with ai_allowed false, spends the code, audits it, signs the user in and ends the old session; the e-mail's other unused invites are gone", async (t) => {
  const { h, A, admin } = await world(t);
  const made = await createInvite(h, admin);
  const other = await createInvite(
    h,
    admin,
    inviteBody({ org_name: "Other Co" }),
  );
  assert.equal(
    await count(h, "invites"),
    2,
    "two unused invites of one e-mail exist",
  );
  const old = await h.signIn(
    await h.addUser({
      email: "old@example.test",
      role: "viewer",
      orgId: A.member.orgId,
    }),
  );
  assert.equal((await count(h, "auth_sessions")) > 0, true);
  const oldSessions = Number(
    (
      await h.sql(
        "select count(*)::int as c from auth_sessions where user_id = $1",
        [old.id],
      )
    )[0].c,
  );
  assert.equal(oldSessions, 1);
  const before = {
    users: await count(h, "users"),
    orgs: await count(h, "orgs"),
    members: await count(h, "org_members"),
    consents: await count(h, "user_consents"),
    audit: await count(h, "audit_log"),
  };
  h.tick(1000);
  const r = await acceptInvite(
    h,
    /** @type {string} */ (made.code),
    acceptBody(),
    { as: old },
  );
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json, { ok: true });
  assert.match(r.cookie ?? "", /^sai_s=/);
  assert.equal(await count(h, "users"), before.users + 1);
  assert.equal(await count(h, "orgs"), before.orgs + 1);
  assert.equal(await count(h, "org_members"), before.members + 1);
  assert.equal(await count(h, "user_consents"), before.consents + 1);
  assert.equal(await count(h, "audit_log"), before.audit + 1);
  const user = (
    await h.sql(
      "select * from users where email_norm = 'new.client@example.test'",
    )
  )[0];
  assert.equal(user.email, "NEW.CLIENT@example.test");
  assert.equal(user.display_name, "Aigul K");
  assert.equal(user.is_owner_identity, true);
  assert.equal(user.is_platform_admin, false);
  assert.equal(user.status, "active");
  assert.equal(user.language, "ru");
  const org = (
    await h.sql(
      "select o.* from orgs o join org_members m on m.org_id = o.id where m.user_id = $1",
      [user.id],
    )
  )[0];
  assert.equal(org.kind, "customer");
  assert.equal(org.name, "Client Co");
  assert.equal(org.ai_allowed, false);
  assert.equal(org.created_by, user.id);
  const member = (
    await h.sql("select * from org_members where user_id = $1", [user.id])
  )[0];
  assert.equal(member.role, "org_owner");
  assert.equal(member.org_id, org.id);
  const inv = (
    await h.sql("select * from invites where used_by = $1", [user.id])
  )[0];
  assert.equal(new Date(inv.used_at).getTime(), h.now());
  assert.equal(
    inv.code_hash,
    inviteHash(h.pepper, /** @type {string} */ (made.code)),
  );
  const audit = await h.sql(
    "select * from audit_log where action = 'invite.accept'",
  );
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_kind, "user");
  assert.equal(audit[0].actor_id, user.id);
  assert.equal(audit[0].org_id, org.id);
  assert.equal(audit[0].target_kind, "invite");
  assert.equal(audit[0].target_id, inv.id);
  assert.deepEqual(audit[0].details, {
    role: "org_owner",
    owner_identity: true,
  });
  // The old session of the caller is deleted, the new one works.
  assert.equal(
    Number(
      (
        await h.sql(
          "select count(*)::int as c from auth_sessions where user_id = $1",
          [old.id],
        )
      )[0].c,
    ),
    0,
  );
  const me = await h.call("GET", "/api/auth/me", {
    cookie: r.cookie,
    origin: null,
    ip: "203.0.113.50",
  });
  assert.equal(me.status, 200, me.text);
  assert.equal(me.json.id, user.id);
  assert.equal(
    (await h.call("GET", "/api/auth/me", { as: old, origin: null })).status,
    401,
  );
  // The other unused invite of the same e-mail is gone and its code no longer works (SEC F1).
  assert.equal(
    Number(
      (
        await h.sql(
          "select count(*)::int as c from invites where used_at is null and email_norm = 'new.client@example.test'",
        )
      )[0].c,
    ),
    0,
  );
  const stale = await acceptInvite(
    h,
    /** @type {string} */ (other.code),
    acceptBody(),
    {
      ip: "203.0.113.51",
    },
  );
  assert.equal(stale.status, 404);
  assert.equal(await count(h, "users"), before.users + 1);
  // An invite into an existing organisation: the invite's role, no new organisation.
  const into = await createInvite(h, admin, {
    email: "Joiner@Example.test",
    role: "viewer",
    owner_identity: true,
    organisation: A.member.orgId,
  });
  const orgs0 = await count(h, "orgs");
  const r2 = await acceptInvite(
    h,
    /** @type {string} */ (into.code),
    acceptBody({ email: "joiner@example.test", name: "Joiner" }),
    { ip: "203.0.113.52" },
  );
  assert.equal(r2.status, 200, r2.text);
  assert.equal(await count(h, "orgs"), orgs0);
  const joiner = (
    await h.sql("select id from users where email_norm = 'joiner@example.test'")
  )[0];
  const m2 = (
    await h.sql("select * from org_members where user_id = $1", [joiner.id])
  )[0];
  assert.equal(m2.org_id, A.member.orgId);
  assert.equal(m2.role, "viewer");
  // The audit chain verifies.
  assert.equal(
    (await h.call("GET", "/api/admin/audit/verify", { as: admin })).json.ok,
    true,
  );
});

test("INV-5 each refused accept leaves users, orgs, org_members, audit_log, the consent table and the invite row byte for byte as they were; a state-dependent refusal commits the address's rate count only", async (t) => {
  const { h, A, admin } = await world(t);
  const made = await createInvite(h, admin);
  const code = /** @type {string} */ (made.code);
  let n = 0;
  const ip = () => `203.0.113.${100 + (n += 1)}`;
  const acc = (/** @type {Record<string, unknown>} */ b, c = code) =>
    acceptInvite(h, c, b, { ip: ip() });
  // Body-dependent refusals (thrown: the rate count rolls back too).
  const rl0 = await h.digest(["rate_limits"]);
  await refused(h, "consent key missing", 400, "bad_body", () =>
    acc((({ consent: _c, ...rest }) => rest)(acceptBody())),
  );
  await refused(h, "consent false", 400, "consent_required", () =>
    acc(acceptBody({ consent: false })),
  );
  await refused(h, "the digest of another text", 400, "consent_stale", () =>
    acc(acceptBody({ consent_sha256: consentSha("en") })),
  );
  await refused(
    h,
    "a digest of the right text in another language",
    400,
    "consent_stale",
    () => acc(acceptBody({ consent_lang: "en" })),
  );
  await refused(h, "a digest that is no hex", 400, "bad_body", () =>
    acc(acceptBody({ consent_sha256: "z".repeat(64) })),
  );
  await refused(h, "a password of 9 characters", 400, "password_rules", () =>
    acc(acceptBody({ password: "abcdef123" })),
  );
  await refused(h, "a key organisation", 400, "bad_body", () =>
    acc({ ...acceptBody(), organisation: A.member.orgId }),
  );
  await refused(h, "a key org_id", 400, "bad_body", () =>
    acc({ ...acceptBody(), org_id: A.member.orgId }),
  );
  await refused(h, "an empty name", 400, "bad_body", () =>
    acc(acceptBody({ name: "" })),
  );
  assert.deepEqual(
    await h.digest(["rate_limits"]),
    rl0,
    "a thrown refusal leaves the rate rows as they were",
  );
  // State-dependent refusals (returned).
  await refused(h, "another e-mail", 404, "not_found", () =>
    acc(acceptBody({ email: "other@example.test" })),
  );
  await refused(h, "an unknown code", 404, "not_found", () =>
    acc(acceptBody(), "B".repeat(22)),
  );
  await refused(h, "a text that is no code", 404, "not_found", () =>
    acc(acceptBody(), "abc"),
  );
  // A used code planted with no account behind it: not_found, not account_exists.
  const used = await plantInvite(h, {
    code: "U".repeat(22),
    email: "used@example.test",
    createdBy: admin.id,
    orgId: A.member.orgId,
    usedAt: h.now(),
  });
  await refused(h, "a used code", 404, "not_found", () =>
    acc(acceptBody({ email: "used@example.test" }), used.code),
  );
  // An e-mail that already has an account.
  const dup = await plantInvite(h, {
    code: "E".repeat(22),
    email: "member@example.test",
    createdBy: admin.id,
    orgId: A.member.orgId,
  });
  await refused(h, "an e-mail with an account", 409, "account_exists", () =>
    acc(acceptBody({ email: "Member@example.test" }), dup.code),
  );
  // The gate, with a row not for an owner identity planted directly.
  const gated = await plantInvite(h, {
    code: "G".repeat(22),
    email: "gated@example.test",
    createdBy: admin.id,
    orgId: A.member.orgId,
    ownerIdentity: false,
  });
  await refused(h, "the gate at acceptance", 403, "personal_data_gate", () =>
    acc(acceptBody({ email: "gated@example.test" }), gated.code),
  );
  // The mode `closed`.
  await setRegistrationMode(h, "closed");
  await refused(h, "registration closed", 403, "registration_closed", () =>
    acc(acceptBody()),
  );
  await setRegistrationMode(h, null);
  // A code after 7 days + 1 s.
  const keep = h.now();
  h.setNow(keep + 7 * 24 * 3600 * 1000 + 1000);
  await refused(h, "an expired code", 404, "not_found", () =>
    acc(acceptBody()),
  );
  h.setNow(keep);
  // After every refusal the code still works: it was never spent.
  const ok = await acc(acceptBody());
  assert.equal(ok.status, 200, ok.text);
  // And a second accept of the used code answers not_found with nothing changed.
  await refused(h, "the code a second time", 404, "not_found", () =>
    acc(acceptBody({ name: "Second" })),
  );
  // A returned refusal commits the rate count of its address (the rate row exists for that address).
  assert.ok((await count(h, "rate_limits")) > 0);
  // A language with no complete text on the server (production serves no kk) and a stale sentence.
  const texts = Object.fromEntries(
    CONSENT.ru.map((s, i) => [
      `consent_s${i + 1}`,
      { ru: s, en: CONSENT.en[i] },
    ]),
  );
  const w2 = await world(t, { auth: { consentTexts: texts } });
  const made2 = await createInvite(w2.h, w2.admin);
  const view = await w2.h.call("GET", `/api/invites/${made2.code}`, {
    ip: "203.0.113.80",
  });
  assert.deepEqual([...view.json.consent_langs].sort(), ["en", "ru"]);
  await refused(
    w2.h,
    "a language with no complete text",
    400,
    "consent_stale",
    () =>
      acceptInvite(
        w2.h,
        /** @type {string} */ (made2.code),
        acceptBody({ consent_lang: "kk", consent_sha256: consentSha("kk") }),
        { ip: "203.0.113.81" },
      ),
  );
  const stale = Object.fromEntries(
    CONSENT.ru.map((s, i) => [
      `consent_s${i + 1}`,
      { ru: i === 2 ? `${s} Изменено.` : s, en: CONSENT.en[i] },
    ]),
  );
  const w3 = await world(t, { auth: { consentTexts: stale } });
  const made3 = await createInvite(w3.h, w3.admin);
  await refused(
    w3.h,
    "the digest of the previous sentence",
    400,
    "consent_stale",
    () =>
      acceptInvite(w3.h, /** @type {string} */ (made3.code), acceptBody(), {
        ip: "203.0.113.82",
      }),
  );
});

test("INV-6 five parallel accepts of one code: exactly one 200, the others 404, one user and one membership", async (t) => {
  const { h, admin } = await world(t);
  const made = await createInvite(
    h,
    admin,
    inviteBody({ email: "Race@Example.test", org_name: "Race Co" }),
  );
  const users0 = await count(h, "users");
  const orgs0 = await count(h, "orgs");
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      acceptInvite(
        h,
        /** @type {string} */ (made.code),
        acceptBody({ email: "race@example.test", name: `R${i}` }),
        { ip: `203.0.113.${110 + i}` },
      ),
    ),
  );
  assert.deepEqual(
    results.map((r) => r.status).sort(),
    [200, 404, 404, 404, 404],
    results.map((r) => r.text).join(" "),
  );
  assert.equal(await count(h, "users"), users0 + 1);
  assert.equal(await count(h, "orgs"), orgs0 + 1);
  assert.equal(
    Number(
      (
        await h.sql(
          "select count(*)::int as c from org_members m join users u on u.id = m.user_id where u.email_norm = 'race@example.test'",
        )
      )[0].c,
    ),
    1,
  );
  assert.equal(await count(h, "user_consents"), 1);
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as c from audit_log where action = 'invite.accept'",
      )
    )[0].c,
    1,
  );
});

test("INV-7 the eleventh accept within one hour from one address answers 429 with Retry-After and changes nothing; another address is not limited; a new hour starts again", async (t) => {
  const { h } = await world(t);
  const ip = "203.0.113.200";
  const call = (/** @type {string} */ c, /** @type {string} */ from = ip) =>
    acceptInvite(h, c, acceptBody(), { ip: from });
  for (let i = 1; i <= 10; i += 1) {
    const r = await call("C".repeat(22));
    assert.equal(r.status, 404, `accept ${i}: ${r.text}`);
  }
  const before = await h.digest(SAME);
  const eleventh = await call("C".repeat(22));
  assert.equal(eleventh.status, 429, eleventh.text);
  assert.equal(eleventh.json.error, "rate_limited");
  assert.match(eleventh.headers.get("retry-after") ?? "", /^[1-9][0-9]*$/);
  assert.deepEqual(await h.digest(SAME), before);
  // Another address is not limited.
  assert.equal((await call("C".repeat(22), "203.0.113.201")).status, 404);
  // The GET of an invite has its own, higher limit (60 per hour): 60 pass, the 61st does not.
  for (let i = 1; i <= 60; i += 1) {
    const r = await h.call("GET", `/api/invites/${"D".repeat(22)}`, {
      ip: "203.0.113.202",
    });
    assert.equal(r.status, 404, `view ${i}`);
  }
  assert.equal(
    (
      await h.call("GET", `/api/invites/${"D".repeat(22)}`, {
        ip: "203.0.113.202",
      })
    ).status,
    429,
  );
  // A new hour: counted again.
  h.tick(3600 * 1000 + 1000);
  assert.equal((await call("C".repeat(22))).status, 404);
});

test("INV-8 a user's owner-identity flag changes only through setup and an accepted invite (copied from the invite the admin created with a re-auth token); every owner-identity invite wrote one audit row", async (t) => {
  const { h, admin } = await world(t);
  const flags = async () =>
    JSON.stringify(
      (await h.sql("select id, is_owner_identity from users order by id")).map(
        (r) => [r.id, r.is_owner_identity],
      ),
    );
  const before = await flags();
  const adminRow = (
    await h.sql("select is_owner_identity from users where id = $1", [admin.id])
  )[0];
  assert.equal(
    adminRow.is_owner_identity,
    true,
    "setup makes the admin an owner identity",
  );
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as c from users where is_owner_identity",
      )
    )[0].c,
    1,
  );
  // Every route of the real table, called as every actor with an empty body and with no re-auth token.
  /** @type {ReadonlyArray<any>} */
  let rows = [];
  const w = await world(t, {
    routeTable: (/** @type {any} */ deps) => (rows = routeTable(deps)),
  });
  const wFlags = async () =>
    JSON.stringify(
      (
        await w.h.sql("select id, is_owner_identity from users order by id")
      ).map((r) => [r.id, r.is_owner_identity]),
    );
  const wBefore = await wFlags();
  const actors = [
    null,
    w.A.viewer,
    w.A.member,
    w.A.org_admin,
    w.A.org_owner,
    w.admin,
  ];
  const subst = (/** @type {string} */ p) =>
    p.replace(":id", crypto.randomUUID()).replace(":code", "Q".repeat(22));
  assert.ok(rows.length >= 27, `${rows.length} routes`);
  for (const r of rows) {
    if (r.path === "/api/auth/setup") continue;
    for (const as of actors)
      await w.h.call(r.method, subst(r.path), {
        as,
        ip: "203.0.113.99",
        body: r.method === "GET" ? undefined : {},
      });
  }
  assert.equal(await wFlags(), wBefore, "no route flipped a flag");
  assert.equal(await flags(), before);
  // Under the gate «a» the flag of an accepted user is the invite's: true.
  const made = await createInvite(h, admin);
  assert.equal(
    (await acceptInvite(h, /** @type {string} */ (made.code))).status,
    200,
  );
  assert.equal(
    (
      await h.sql(
        "select is_owner_identity from users where email_norm = 'new.client@example.test'",
      )
    )[0].is_owner_identity,
    true,
  );
  // Into the owner organisation: the accepted user is an owner identity there.
  const into = await createInvite(h, admin, {
    email: "second.identity@example.test",
    role: "member",
    owner_identity: true,
    organisation: await ownerOrgId(h),
  });
  assert.equal(
    (
      await acceptInvite(
        h,
        /** @type {string} */ (into.code),
        acceptBody({ email: "second.identity@example.test" }),
        { ip: "203.0.113.55" },
      )
    ).status,
    200,
  );
  const second = (
    await h.sql(
      "select is_owner_identity from users where email_norm = 'second.identity@example.test'",
    )
  )[0];
  assert.equal(second.is_owner_identity, true);
  // Each owner-identity invite wrote one audit row with its token.
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as c from audit_log where action = 'invite.create' and details->>'owner_identity' = 'true'",
      )
    )[0].c,
    2,
  );
  assert.equal(
    (
      await h.sql(
        "select count(*)::int as c from audit_log where action = 'invite.create' and details ? 'reauth_id'",
      )
    )[0].c,
    2,
  );
  // Under the gate «b» a flag false is allowed for an existing customer organisation and the user's flag is false;
  // the owner organisation still needs the flag.
  const w2 = await world(t, { auth: { personalDataGate: "invited" } });
  const customer = w2.A.member.orgId;
  const plain = await createInvite(w2.h, w2.admin, {
    email: "plain@example.test",
    role: "member",
    owner_identity: false,
    organisation: customer,
  });
  assert.equal(plain.status, 201, plain.text);
  const r = await acceptInvite(
    w2.h,
    /** @type {string} */ (plain.code),
    acceptBody({ email: "plain@example.test" }),
    { ip: "203.0.113.56" },
  );
  assert.equal(r.status, 200, r.text);
  assert.equal(
    (
      await w2.h.sql(
        "select is_owner_identity from users where email_norm = 'plain@example.test'",
      )
    )[0].is_owner_identity,
    false,
  );
  const refusedOwner = await w2.h.call("POST", "/api/admin/invites", {
    as: w2.admin,
    reauth: await w2.h.reauthToken(w2.admin, "owner_identity"),
    body: {
      email: "x@example.test",
      role: "member",
      owner_identity: false,
      organisation: await ownerOrgId(w2.h),
    },
  });
  assert.equal(refusedOwner.status, 400);
  assert.equal(refusedOwner.json.error, "owner_identity_required");
  // A plain row planted for the owner organisation is refused by the database (the trigger), never a half account.
  const planted = await plantInvite(w2.h, {
    code: "O".repeat(22),
    email: "intruder@example.test",
    createdBy: w2.admin.id,
    orgId: await ownerOrgId(w2.h),
    ownerIdentity: false,
  });
  const usersBefore = await count(w2.h, "users");
  const intruder = await acceptInvite(
    w2.h,
    planted.code,
    acceptBody({ email: "intruder@example.test" }),
    { ip: "203.0.113.57" },
  );
  assert.equal(intruder.status, 500, intruder.text);
  assert.equal(await count(w2.h, "users"), usersBefore, "no half account");
  assert.equal(
    (
      await w2.h.sql("select used_at from invites where id = $1", [planted.id])
    )[0].used_at,
    null,
  );
  // The files that name the column: the design's list (the grep -w of the criterion, run here over app/server).
  const named = [];
  const walk = (/** @type {string} */ dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (
        e.name.endsWith(".js") &&
        /\bis_owner_identity\b/.test(fs.readFileSync(p, "utf8"))
      )
        named.push(path.relative(APP, p).split(path.sep).join("/"));
    }
  };
  walk(path.join(APP, "server"));
  assert.deepEqual(named.sort(), [
    "server/db/auth-store.js",
    "server/db/org-store.js",
  ]);
});

test("INV-9 with no registration_mode row, `invite` and `open` an accept works; `closed` and an unrecognised value refuse it with the state unchanged", async (t) => {
  const { h, admin } = await world(t);
  let n = 0;
  const attempt = async (
    /** @type {string | null} */ mode,
    /** @type {number} */ status,
  ) => {
    n += 1;
    await setRegistrationMode(h, mode);
    const email = `mode${n}@example.test`;
    const made = await createInvite(
      h,
      admin,
      inviteBody({ email, org_name: `Mode Co ${n}` }),
    );
    const call = () =>
      acceptInvite(
        h,
        /** @type {string} */ (made.code),
        acceptBody({ email }),
        { ip: `203.0.113.${120 + n}` },
      );
    if (status === 200) {
      const r = await call();
      assert.equal(r.status, 200, `${mode}: ${r.text}`);
    } else
      await refused(h, `mode ${mode}`, status, "registration_closed", call);
  };
  await attempt(null, 200);
  await attempt("invite", 200);
  await attempt("open", 200);
  await attempt("closed", 403);
  await attempt("weird", 403);
  await attempt("", 403);
  // Back to `invite`: the refused invite of «closed» still works (it was never spent).
  await setRegistrationMode(h, "invite");
  const left = await h.sql(
    "select email_norm from invites where used_at is null order by email_norm",
  );
  assert.deepEqual(
    left.map((r) => r.email_norm),
    ["mode4@example.test", "mode5@example.test", "mode6@example.test"],
  );
});

test("INV-10 no route of the real table creates a user but setup (with the token) and accept (with a code); the statement and the setting stand only where the design puts them", async (t) => {
  /** @type {ReadonlyArray<any>} */
  let rows = [];
  const { h, A } = await world(t, {
    routeTable: (/** @type {any} */ deps) => (rows = routeTable(deps)),
  });
  const actors = [null, A.viewer, A.member, A.org_admin, A.org_owner, A.admin];
  const users0 = await count(h, "users");
  let called = 0;
  for (const r of rows) {
    if (r.path === "/api/auth/setup" || r.path === "/api/invites/:code/accept")
      continue;
    for (const as of actors) {
      called += 1;
      await h.call(
        r.method,
        r.path
          .replace(":id", crypto.randomUUID())
          .replace(":code", "Q".repeat(22)),
        {
          as,
          ip: "203.0.113.98",
          body: r.method === "GET" ? undefined : {},
        },
      );
    }
  }
  assert.ok(called >= 25 * 6, `${called} calls`);
  assert.equal(
    await count(h, "users"),
    users0,
    "no other route changed the users table",
  );
  // The two that may: setup with a wrong token and accept with no code create none.
  const bad = await h.call("POST", "/api/auth/setup", {
    ip: "203.0.113.97",
    body: {
      token: "wrong",
      email: "a@example.test",
      name: "A",
      password: "some-long-pass-1",
    },
  });
  assert.equal(bad.status, 404);
  assert.equal(await count(h, "users"), users0);
  // The greps of the criterion, over app/server.
  /** @type {string[]} */
  const inserts = [];
  /** @type {string[]} */
  const modes = [];
  const walk = (/** @type {string} */ dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js")) {
        const rel = path.relative(APP, p).split(path.sep).join("/");
        const text = fs.readFileSync(p, "utf8");
        if (/insert\s+into\s+users\b/i.test(text)) inserts.push(rel);
        text.split("\n").forEach((line, i) => {
          if (/registration_mode/.test(line)) modes.push(`${rel}:${i + 1}`);
        });
      }
    }
  };
  walk(path.join(APP, "server"));
  assert.deepEqual(inserts.sort(), [
    "server/db/auth-store.js",
    "server/db/org-store.js",
  ]);
  assert.equal(modes.length, 1, modes.join(" "));
  assert.match(modes[0], /^server\/db\/org-store\.js:\d+$/);
  const line = fs
    .readFileSync(path.join(APP, "server/db/org-store.js"), "utf8")
    .split("\n")[Number(modes[0].split(":")[1]) - 1];
  assert.match(
    line,
    /select value from platform_settings where key = 'registration_mode'/,
  );
  assert.doesNotMatch(line, /insert|update|delete/i);
});

test("INV-11 after an accept the consent row holds the sha256 of the sentence shown, its language and the clock time; users and the consent table hold no other personal column", async (t) => {
  const { h, admin } = await world(t);
  const made = await createInvite(h, admin);
  h.tick(5000);
  const kk = await acceptInvite(
    h,
    /** @type {string} */ (made.code),
    acceptBody({ consent_lang: "kk", consent_sha256: consentSha("kk") }),
  );
  assert.equal(kk.status, 200, kk.text);
  const user = (
    await h.sql(
      "select id, language from users where email_norm = 'new.client@example.test'",
    )
  )[0];
  assert.equal(user.language, "kk");
  const rows = await h.sql("select * from user_consents where user_id = $1", [
    user.id,
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), [
    "accepted_at",
    "lang",
    "text_sha256",
    "user_id",
  ]);
  assert.equal(rows[0].text_sha256, consentSha("kk"));
  assert.equal(rows[0].lang, "kk");
  assert.equal(new Date(rows[0].accepted_at).getTime(), h.now());
  // The ru accept of another invite stores the ru digest.
  const made2 = await createInvite(
    h,
    admin,
    inviteBody({ email: "ru@example.test", org_name: "Ru Co" }),
  );
  const ru = await acceptInvite(
    h,
    /** @type {string} */ (made2.code),
    acceptBody({ email: "ru@example.test" }),
    { ip: "203.0.113.60" },
  );
  assert.equal(ru.status, 200);
  const ruUser = (
    await h.sql("select id from users where email_norm = 'ru@example.test'")
  )[0];
  assert.equal(
    (
      await h.sql(
        "select text_sha256, lang from user_consents where user_id = $1",
        [ruUser.id],
      )
    )[0].text_sha256,
    consentSha("ru"),
  );
  // The column lists: the 21 of users (as 0002 made them) and the four of the consent table.
  const columns = async (/** @type {string} */ table) =>
    (
      await h.sql(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by column_name",
        [table],
      )
    ).map((r) => r.column_name);
  assert.deepEqual(
    await columns("users"),
    [
      "id",
      "email",
      "email_norm",
      "display_name",
      "password_hash",
      "is_platform_admin",
      "is_owner_identity",
      "totp_secret_enc",
      "totp_enabled_at",
      "totp_last_step",
      "totp_recovery",
      "language",
      "status",
      "failed_logins",
      "failed_since",
      "locked_until",
      "reauth_failures",
      "reauth_failed_since",
      "reauth_locked_until",
      "created_at",
      "last_login_at",
    ].sort(),
  );
  assert.deepEqual(await columns("user_consents"), [
    "accepted_at",
    "lang",
    "text_sha256",
    "user_id",
  ]);
});

test("INV-12 /api/auth/me of an accepted user lists exactly one membership {org_id, name, kind, role}; the answers of the routes of this block to a member of organisation A never hold organisation B's id, name or people", async (t) => {
  const { h, admin } = await world(t);
  const a = await joinAsClient(h, admin, {
    email: "alpha@example.test",
    orgName: "Alpha Org",
    name: "Alpha Person",
    ip: "203.0.113.61",
  });
  const b = await joinAsClient(h, admin, {
    email: "beta@example.test",
    orgName: "Beta Unique Org",
    name: "Beta Person",
    ip: "203.0.113.62",
  });
  const me = await h.call("GET", "/api/auth/me", { as: a, origin: null });
  assert.equal(me.status, 200);
  assert.deepEqual(me.json.memberships, [
    { org_id: a.orgId, name: "Alpha Org", kind: "customer", role: "org_owner" },
  ]);
  assert.equal(me.json.deletion_requested_at, null);
  assert.deepEqual(Object.keys(me.json).sort(), [
    "csrf",
    "deletion_requested_at",
    "id",
    "language",
    "memberships",
    "name",
    "platform_admin",
  ]);
  // B has a project; the calls of A over every route of the block.
  const bProject = await h.call("POST", "/api/projects", {
    as: b,
    body: {
      title: "Beta Secret Shop",
      idea: "Beta idea",
      what: "shop",
      whom: "team",
      lang: "ru",
    },
  });
  assert.equal(bProject.status, 201, bProject.text);
  const bodies = [me.text];
  const own = await h.call("POST", "/api/projects", {
    as: a,
    body: {
      title: "Alpha Shop",
      idea: "Alpha idea",
      what: "shop",
      whom: "team",
      lang: "ru",
    },
  });
  const ownId = own.json.id;
  const view = await createInvite(
    h,
    admin,
    inviteBody({ email: "gamma@example.test", org_name: "Gamma Org" }),
  );
  const calls = /** @type {Array<[string, string, any]>} */ ([
    ["GET", "/api/projects", undefined],
    [
      "POST",
      "/api/projects",
      {
        title: "Alpha Two",
        idea: "More",
        what: "app",
        whom: "myself",
        lang: "en",
      },
    ],
    ["GET", `/api/projects/${ownId}`, undefined],
    [
      "POST",
      `/api/projects/${ownId}/idea`,
      { text: "Alpha text", reason: "Alpha reason" },
    ],
    ["GET", `/api/projects/${bProject.json.id}`, undefined],
    [
      "POST",
      `/api/projects/${bProject.json.id}/idea`,
      { text: "x", reason: "y" },
    ],
    ["POST", "/api/account/deletion-request", { password: a.password }],
    ["POST", "/api/account/deletion-request", { password: a.password }],
    ["GET", `/api/invites/${view.code}`, undefined],
    ["GET", "/api/admin/requests", undefined],
    ["GET", `/api/admin/projects/${bProject.json.id}`, undefined],
    ["GET", "/api/admin/audit", undefined],
    ["GET", "/api/admin/deletion-requests", undefined],
    ["POST", `/api/admin/users/${b.id}/delete`, {}],
    ["POST", "/api/admin/invites", inviteBody()],
  ]);
  for (const [method, p, body] of calls) {
    const r = await h.call(method, p, { as: a, body, ip: a.ip });
    bodies.push(r.text);
  }
  const all = bodies.join("\n");
  for (const secret of [
    b.orgId,
    "Beta Unique Org",
    b.id,
    "Beta Person",
    "beta@example.test",
    "Beta Secret Shop",
    bProject.json.id,
  ])
    assert.ok(!all.includes(/** @type {string} */ (secret)), String(secret));
  assert.ok(all.includes("Alpha Shop"), "the own organisation's data is shown");
});

/** A harness whose app talks to PGlite, or to a closed port, or to a stand-in that never answers a statement. */
async function switching(/** @type {import("node:test").TestContext} */ t) {
  const stand = await pgStandIn(t, { plan: () => "stall", answer: () => null });
  const closed = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = /** @type {net.AddressInfo} */ (s.address()).port;
      s.close(() => resolve(port));
    });
  });
  const refusedAdapter = createPgAdapter(
    `postgres://u:p@127.0.0.1:${closed}/d`,
    { connectTimeoutMs: 4000 },
  );
  const silent = createPgAdapter(`postgres://u:p@127.0.0.1:${stand.port}/d`, {
    connectTimeoutMs: 4000,
  });
  t.after(() => {
    void refusedAdapter.close().catch(() => {});
    void silent.close().catch(() => {});
  });
  /** @type {"ok" | "refused" | "silent"} */
  let mode = "ok";
  const h = await authHarness(t, {
    wrap: (/** @type {any} */ raw) => {
      const cur = () =>
        mode === "ok" ? raw : mode === "refused" ? refusedAdapter : silent;
      return {
        query: (/** @type {string} */ s, /** @type {unknown[]} */ p) =>
          cur().query(s, p),
        exec: (/** @type {string} */ s) => cur().exec(s),
        close: async () => {},
        transaction: (/** @type {any} */ fn) => cur().transaction(fn),
      };
    },
  });
  return {
    h,
    set: (/** @type {"ok" | "refused" | "silent"} */ m) => (mode = m),
    released: () =>
      waitFor(
        () =>
          [...new Set(stand.statements.map(([id]) => id))].every((id) =>
            stand.closed.has(id),
          ),
        15000,
        "the stalled connections to be released",
      ),
  };
}

test("INV-13 with a database that refuses or never answers, the accept answers 503 db_unavailable within 5 s with no cookie and writes nothing; the code is not spent", async (t) => {
  const { h, set, released } = await switching(t);
  const admin = await h.signIn(await h.setup());
  const made = await createInvite(h, admin);
  const code = /** @type {string} */ (made.code);
  const before = await h.digest(SAME);
  for (const mode of /** @type {const} */ (["refused", "silent", "refused"])) {
    set(mode);
    for (const call of [
      () => acceptInvite(h, code, acceptBody(), { ip: "203.0.113.90" }),
      () => h.call("GET", `/api/invites/${code}`, { ip: "203.0.113.91" }),
    ]) {
      const started = performance.now();
      const r = await call();
      assert.equal(r.status, 503, `${mode}: ${r.text}`);
      assert.deepEqual(r.json, { error: "db_unavailable" }, mode);
      assert.ok(performance.now() - started < 5000, mode);
      assert.deepEqual(r.setCookie, [], mode);
    }
    if (mode === "silent") await released();
  }
  set("ok");
  assert.deepEqual(await h.digest(SAME), before, "the failures changed no row");
  const again = await acceptInvite(h, code, acceptBody(), {
    ip: "203.0.113.92",
  });
  assert.equal(again.status, 200, "the code was never spent");
});
