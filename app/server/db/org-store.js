import { iso } from "./auth-store.js";

// Every statement of the invitation, consent and deletion services (REQ-116; the code design M2PROJ, 4.6): named
// functions that take the query `q` of the caller's transaction and parameters. Every text is a constant with
// bound parameters (Q9); every time is a parameter from the app's clock, never now(). Services and routes call
// these functions and never run a statement themselves (DBC-1). All of them run under platform settings: the
// code filters by the organisation or the user itself.

/** @typedef {import("./index.js").Q} Q */

// Registration mode and organisations.

/**
 * The registration mode as stored (a JSON text), or null when no row exists.
 * @param {Q} q
 * @returns {Promise<unknown>}
 */
export async function readRegistrationMode(q) {
  const r = await q.query(
    "select value from platform_settings where key = 'registration_mode'",
  );
  return r.rows.length === 0 ? null : r.rows[0].value;
}

/**
 * @param {Q} q
 * @param {string} id
 * @returns {Promise<{ id: string, name: string, kind: string } | null>}
 */
export async function findOrg(q, id) {
  const r = await q.query("select id, name, kind from orgs where id = $1", [
    id,
  ]);
  return r.rows[0] ?? null;
}

/**
 * Whether an account (in any status) has this normalised e-mail.
 * @param {Q} q
 * @param {string} emailNorm
 * @returns {Promise<boolean>}
 */
export async function accountExists(q, emailNorm) {
  const r = await q.query("select 1 as one from users where email_norm = $1", [
    emailNorm,
  ]);
  return r.rows.length > 0;
}

// Invites.

/**
 * @param {Q} q
 * @param {{ orgId: string | null, orgName: string | null, emailNorm: string, role: string, ownerIdentity: boolean, codeHash: string, expiresAt: number, createdBy: string, now: number }} i
 * @returns {Promise<string>} the invite id
 */
export async function insertInvite(q, i) {
  const r = await q.query(
    "insert into invites (org_id, org_name, email_norm, role, owner_identity, code_hash, expires_at, created_by, created_at) values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9::timestamptz) returning id",
    [
      i.orgId,
      i.orgName,
      i.emailNorm,
      i.role,
      i.ownerIdentity,
      i.codeHash,
      iso(i.expiresAt),
      i.createdBy,
      iso(i.now),
    ],
  );
  return r.rows[0].id;
}

/**
 * The unused, unexpired invite of a code hash, with the name of its organisation.
 * @param {Q} q
 * @param {string} codeHash
 * @param {number} now
 * @returns {Promise<{ id: string, org_id: string | null, org_name: string | null, email_norm: string, role: string, owner_identity: boolean, existing_name: string | null } | null>}
 */
export async function findInviteByHash(q, codeHash, now) {
  const r = await q.query(
    "select i.id, i.org_id, i.org_name, i.email_norm, i.role, i.owner_identity, o.name as existing_name from invites i left join orgs o on o.id = i.org_id where i.code_hash = $1 and i.used_at is null and i.expires_at > $2::timestamptz",
    [codeHash, iso(now)],
  );
  return r.rows[0] ?? null;
}

/**
 * The one conditional update that spends an invite: the invite's id, or null when it is used, expired or gone
 * (the parallel winner took it).
 * @param {Q} q
 * @param {string} codeHash
 * @param {number} now
 * @returns {Promise<string | null>}
 */
export async function claimInvite(q, codeHash, now) {
  const r = await q.query(
    "update invites set used_at = $2::timestamptz where code_hash = $1 and used_at is null and expires_at > $2::timestamptz returning id",
    [codeHash, iso(now)],
  );
  return r.rows[0]?.id ?? null;
}

/**
 * @param {Q} q
 * @param {string} inviteId
 * @param {string} userId
 */
export async function setInviteUsedBy(q, inviteId, userId) {
  await q.query("update invites set used_by = $2 where id = $1", [
    inviteId,
    userId,
  ]);
}

/**
 * The e-mail of the invites a deleted user used is replaced (the invite row holds his address).
 * @param {Q} q
 * @param {string} userId
 * @param {string} emailNorm the placeholder
 */
export async function scrubInviteEmails(q, userId, emailNorm) {
  await q.query("update invites set email_norm = $2 where used_by = $1", [
    userId,
    emailNorm,
  ]);
}

/**
 * Every unused invite of an e-mail address, except `exceptId` when it is given (a deletion removes all of them; an
 * accepted invite removes the others, so no old invite can create the account again and no address stays in clear).
 * @param {Q} q
 * @param {string} emailNorm
 * @param {string | null} exceptId
 */
export async function deleteUnusedInvitesOf(q, emailNorm, exceptId) {
  await q.query(
    "delete from invites where email_norm = $1 and used_at is null and ($2::uuid is null or id <> $2::uuid)",
    [emailNorm, exceptId],
  );
}

// New accounts.

/**
 * A user created by an accepted invite: never the platform admin; the owner-identity flag is the invite's.
 * @param {Q} q
 * @param {{ email: string, emailNorm: string, name: string, passwordHash: string, language: string, ownerIdentity: boolean }} u
 * @returns {Promise<string>} the user id
 */
export async function insertInvitedUser(q, u) {
  const r = await q.query(
    "insert into users (email, email_norm, display_name, password_hash, language, is_owner_identity) values ($1, $2, $3, $4, $5, $6) returning id",
    [u.email, u.emailNorm, u.name, u.passwordHash, u.language, u.ownerIdentity],
  );
  return r.rows[0].id;
}

/**
 * A new customer organisation, with AI not allowed.
 * @param {Q} q
 * @param {string} name
 * @param {string} createdBy
 * @returns {Promise<string>} the organisation id
 */
export async function insertCustomerOrg(q, name, createdBy) {
  const r = await q.query(
    "insert into orgs (name, kind, ai_allowed, created_by) values ($1, 'customer', false, $2) returning id",
    [name, createdBy],
  );
  return r.rows[0].id;
}

/**
 * The consent record: the digest of the exact sentence shown, its language and the time.
 * @param {Q} q
 * @param {{ userId: string, sha256: string, lang: string, now: number }} c
 */
export async function insertConsent(q, c) {
  await q.query(
    "insert into user_consents (user_id, text_sha256, lang, accepted_at) values ($1, $2, $3, $4::timestamptz)",
    [c.userId, c.sha256, c.lang, iso(c.now)],
  );
}

// Deletion requests and deletion.

/**
 * The first open request of the user stores one row; a second while one is open stores nothing.
 * @param {Q} q
 * @param {string} userId
 * @param {number} now
 * @returns {Promise<string | null>} the new request's id, or null when one was open
 */
export async function insertDeletionRequest(q, userId, now) {
  const r = await q.query(
    "insert into deletion_requests (user_id, requested_at) values ($1, $2::timestamptz) on conflict (user_id) where closed_at is null do nothing returning id",
    [userId, iso(now)],
  );
  return r.rows[0]?.id ?? null;
}

/**
 * The time of the user's open deletion request, or null.
 * @param {Q} q
 * @param {string} userId
 * @returns {Promise<unknown>}
 */
export async function readOpenDeletion(q, userId) {
  const r = await q.query(
    "select requested_at from deletion_requests where user_id = $1 and closed_at is null",
    [userId],
  );
  return r.rows[0]?.requested_at ?? null;
}

/**
 * The open requests, oldest first, with the requester's name and e-mail (the admin must know whom to delete).
 * @param {Q} q
 * @returns {Promise<Array<{ id: string, user_id: string, display_name: string, email: string, requested_at: unknown }>>}
 */
export async function listOpenDeletions(q) {
  const r = await q.query(
    "select d.id, d.user_id, u.display_name, u.email, d.requested_at from deletion_requests d join users u on u.id = d.user_id where d.closed_at is null order by d.requested_at, d.id",
  );
  return r.rows;
}

/**
 * The target's users row under a lock.
 * @param {Q} q
 * @param {string} id
 * @returns {Promise<{ id: string, status: string, is_platform_admin: boolean, email_norm: string } | null>}
 */
export async function lockUserForDelete(q, id) {
  const r = await q.query(
    "select id, status, is_platform_admin, email_norm from users where id = $1 for update",
    [id],
  );
  return r.rows[0] ?? null;
}

/**
 * The organisations of a user's memberships.
 * @param {Q} q
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function orgsOfUser(q, userId) {
  const r = await q.query(
    "select org_id from org_members where user_id = $1 order by org_id",
    [userId],
  );
  return r.rows.map((x) => x.org_id);
}

/**
 * @param {Q} q
 * @param {string} orgId
 * @returns {Promise<number>}
 */
export async function orgMemberCount(q, orgId) {
  const r = await q.query(
    "select count(*)::int as n from org_members where org_id = $1",
    [orgId],
  );
  return Number(r.rows[0].n);
}

/**
 * The personal fields replaced by the placeholders, the TOTP fields and the counters cleared, the status
 * `deleted` (the account can no longer log in).
 * @param {Q} q
 * @param {string} id
 * @param {{ email: string, emailNorm: string, name: string, passwordHash: string }} p
 */
export async function anonymiseUser(q, id, p) {
  await q.query(
    "update users set email = $2, email_norm = $3, display_name = $4, password_hash = $5, totp_secret_enc = null, totp_enabled_at = null, totp_last_step = null, totp_recovery = '{}', failed_logins = 0, failed_since = null, locked_until = null, reauth_failures = 0, reauth_failed_since = null, reauth_locked_until = null, status = 'deleted' where id = $1",
    [id, p.email, p.emailNorm, p.name, p.passwordHash],
  );
}

/**
 * @param {Q} q
 * @param {string} userId
 */
export async function deleteUserReauth(q, userId) {
  await q.query("delete from reauth_tokens where user_id = $1", [userId]);
}

/**
 * @param {Q} q
 * @param {string} userId
 */
export async function deleteUserResets(q, userId) {
  await q.query("delete from password_resets where user_id = $1", [userId]);
}

/**
 * @param {Q} q
 * @param {string} userId
 */
export async function deleteUserMemberships(q, userId) {
  await q.query("delete from org_members where user_id = $1", [userId]);
}

/**
 * @param {Q} q
 * @param {string} userId
 * @param {number} now
 */
export async function closeDeletionRequests(q, userId, now) {
  await q.query(
    "update deletion_requests set closed_at = $2::timestamptz where user_id = $1 and closed_at is null",
    [userId, iso(now)],
  );
}
