// Every statement of the auth services (REQ-114; the code design M2AUTH, 4.5.4 and 4.9): named functions that
// take the query `q` of the caller's transaction and parameters. Every text is a constant with bound
// parameters (Q9); every time is a parameter from the app's clock, never now(). Services and routes call
// these functions and never run a statement themselves.

/** @typedef {import("./index.js").Q} Q */

/**
 * @param {number} ms
 * @returns {string}
 */
export const iso = (ms) => new Date(ms).toISOString();

/**
 * A time column as milliseconds, or null.
 * @param {unknown} value
 * @returns {number | null}
 */
export function msOf(value) {
  if (value === null || value === undefined) return null;
  const t = new Date(/** @type {string | number | Date} */ (value)).getTime();
  return Number.isFinite(t) ? t : null;
}

// Sessions (4.9.3).

/**
 * The live session of a token hash: not idle since `idleAfter`, not past its absolute end, its user active;
 * with the user's only membership.
 * @param {Q} q
 * @param {string} tokenHash
 * @param {number} idleAfter the oldest last_seen_at still live (now - 12 h)
 * @param {number} now
 * @returns {Promise<{ id: string, user_id: string, is_platform_admin: boolean, org_id: string | null, role: string | null } | null>}
 */
export async function readSession(q, tokenHash, idleAfter, now) {
  const r = await q.query(
    "select s.id, s.user_id, u.is_platform_admin, m.org_id, m.role from auth_sessions s join users u on u.id = s.user_id left join org_members m on m.user_id = s.user_id where s.token_hash = $1 and s.last_seen_at > $2::timestamptz and s.abs_expires_at > $3::timestamptz and u.status = 'active'",
    [tokenHash, iso(idleAfter), iso(now)],
  );
  return r.rows[0] ?? null;
}

/**
 * @param {Q} q
 * @param {{ userId: string, tokenHash: string, csrfHash: string, now: number, absExpiresAt: number, ipHmac: string | null }} s
 * @returns {Promise<string>} the session id
 */
export async function insertSession(q, s) {
  const r = await q.query(
    "insert into auth_sessions (user_id, token_hash, csrf_hash, created_at, last_seen_at, abs_expires_at, ip_hmac) values ($1, $2, $3, $4::timestamptz, $4::timestamptz, $5::timestamptz, $6) returning id",
    [
      s.userId,
      s.tokenHash,
      s.csrfHash,
      iso(s.now),
      iso(s.absExpiresAt),
      s.ipHmac,
    ],
  );
  return r.rows[0].id;
}

/**
 * @param {Q} q
 * @param {string} id
 * @param {number} now
 */
export async function touchSession(q, id, now) {
  await q.query(
    "update auth_sessions set last_seen_at = $2::timestamptz where id = $1",
    [id, iso(now)],
  );
}

/**
 * @param {Q} q
 * @param {string} id
 */
export async function deleteSession(q, id) {
  await q.query("delete from auth_sessions where id = $1", [id]);
}

/**
 * Every session of the user but `keepId` (a password change keeps the current one).
 * @param {Q} q
 * @param {string} userId
 * @param {string} keepId
 */
export async function deleteOtherSessions(q, userId, keepId) {
  await q.query("delete from auth_sessions where user_id = $1 and id <> $2", [
    userId,
    keepId,
  ]);
}

/**
 * @param {Q} q
 * @param {string} userId
 */
export async function deleteUserSessions(q, userId) {
  await q.query("delete from auth_sessions where user_id = $1", [userId]);
}

// Users.

/**
 * The account of an e-mail, read without a lock (the first statement of a login, 4.9.5).
 * @param {Q} q
 * @param {string} emailNorm
 * @returns {Promise<{ id: string, status: string, is_platform_admin: boolean } | null>}
 */
export async function findAccount(q, emailNorm) {
  const r = await q.query(
    "select id, status, is_platform_admin from users where email_norm = $1",
    [emailNorm],
  );
  return r.rows[0] ?? null;
}

/**
 * @typedef {object} UserAuthRow
 * @property {string} id
 * @property {string} email
 * @property {string} status
 * @property {boolean} is_platform_admin
 * @property {string} password_hash
 * @property {string | null} totp_secret_enc
 * @property {unknown} totp_enabled_at
 * @property {unknown} totp_last_step
 * @property {number} failed_logins
 * @property {unknown} failed_since
 * @property {unknown} locked_until
 * @property {number} reauth_failures
 * @property {unknown} reauth_failed_since
 * @property {unknown} reauth_locked_until
 */

/**
 * The users row with its counters under a row lock (4.9.5: an active ordinary account at login; the user's
 * own row at re-auth and password change).
 * @param {Q} q
 * @param {string} id
 * @returns {Promise<UserAuthRow | null>}
 */
export async function lockUser(q, id) {
  const r = await q.query(
    "select id, email, status, is_platform_admin, password_hash, totp_secret_enc, totp_enabled_at, totp_last_step, failed_logins, failed_since, locked_until, reauth_failures, reauth_failed_since, reauth_locked_until from users where id = $1 for update",
    [id],
  );
  return r.rows[0] ?? null;
}

/**
 * The same columns without a lock (the platform admin at login: his users row is never locked by a login).
 * @param {Q} q
 * @param {string} id
 * @returns {Promise<UserAuthRow | null>}
 */
export async function readUser(q, id) {
  const r = await q.query(
    "select id, email, status, is_platform_admin, password_hash, totp_secret_enc, totp_enabled_at, totp_last_step, failed_logins, failed_since, locked_until, reauth_failures, reauth_failed_since, reauth_locked_until from users where id = $1",
    [id],
  );
  return r.rows[0] ?? null;
}

/**
 * The login counter of an ordinary account after a failure.
 * @param {Q} q
 * @param {string} id
 * @param {{ fails: number, since: number, lockedUntil: number | null }} c
 */
export async function setLoginCounter(q, id, c) {
  await q.query(
    "update users set failed_logins = $2, failed_since = $3::timestamptz, locked_until = $4::timestamptz where id = $1",
    [
      id,
      c.fails,
      iso(c.since),
      c.lockedUntil === null ? null : iso(c.lockedUntil),
    ],
  );
}

/**
 * A successful login: the login counter cleared and last_login_at set.
 * @param {Q} q
 * @param {string} id
 * @param {number} now
 */
export async function loginSucceeded(q, id, now) {
  await q.query(
    "update users set failed_logins = 0, failed_since = null, locked_until = null, last_login_at = $2::timestamptz where id = $1",
    [id, iso(now)],
  );
}

/**
 * A successful login of the platform admin: only last_login_at (he has no login counter).
 * @param {Q} q
 * @param {string} id
 * @param {number} now
 */
export async function setLastLogin(q, id, now) {
  await q.query(
    "update users set last_login_at = $2::timestamptz where id = $1",
    [id, iso(now)],
  );
}

/**
 * The re-auth counter (4.9.5): never the login counter.
 * @param {Q} q
 * @param {string} id
 * @param {{ fails: number, since: number | null, lockedUntil: number | null }} c
 */
export async function setReauthCounter(q, id, c) {
  await q.query(
    "update users set reauth_failures = $2, reauth_failed_since = $3::timestamptz, reauth_locked_until = $4::timestamptz where id = $1",
    [
      id,
      c.fails,
      c.since === null ? null : iso(c.since),
      c.lockedUntil === null ? null : iso(c.lockedUntil),
    ],
  );
}

/**
 * @param {Q} q
 * @param {string} id
 * @param {string} passwordHash
 */
export async function setPasswordHash(q, id, passwordHash) {
  await q.query("update users set password_hash = $2 where id = $1", [
    id,
    passwordHash,
  ]);
}

/**
 * A reset: the new hash and every lock counter cleared.
 * @param {Q} q
 * @param {string} id
 * @param {string} passwordHash
 */
export async function resetPassword(q, id, passwordHash) {
  await q.query(
    "update users set password_hash = $2, failed_logins = 0, failed_since = null, locked_until = null, reauth_failures = 0, reauth_failed_since = null, reauth_locked_until = null where id = $1 and status = 'active'",
    [id, passwordHash],
  );
}

/**
 * @param {Q} q
 * @param {string} id
 * @returns {Promise<{ id: string, display_name: string, language: string, is_platform_admin: boolean } | null>}
 */
export async function readProfile(q, id) {
  const r = await q.query(
    "select id, display_name, language, is_platform_admin from users where id = $1 and status = 'active'",
    [id],
  );
  return r.rows[0] ?? null;
}

/**
 * The memberships of a user with the organisation's name and kind, read with an explicit user filter under
 * platform settings (the user's own rows only).
 * @param {Q} q
 * @param {string} userId
 * @returns {Promise<Array<{ org_id: string, name: string, kind: string, role: string }>>}
 */
export async function listMemberships(q, userId) {
  const r = await q.query(
    "select m.org_id, o.name, o.kind, m.role from org_members m join orgs o on o.id = m.org_id where m.user_id = $1 order by m.org_id",
    [userId],
  );
  return r.rows;
}

/**
 * Whether an active user has this id.
 * @param {Q} q
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function isLiveUser(q, id) {
  const r = await q.query(
    "select 1 as one from users where id = $1 and status = 'active'",
    [id],
  );
  return r.rows.length === 1;
}

// Setup (4.9.6).

/**
 * The setup guard: the one insert of setup_done; false when it was there already.
 * @param {Q} q
 * @returns {Promise<boolean>}
 */
export async function claimSetup(q) {
  const r = await q.query(
    "insert into platform_settings (key, value) values ('setup_done', 'true'::jsonb) on conflict do nothing returning key",
  );
  return r.rows.length === 1;
}

/**
 * The platform admin, who is also the owner identity.
 * @param {Q} q
 * @param {{ email: string, emailNorm: string, name: string, passwordHash: string, language: string }} u
 * @returns {Promise<string>} the user id
 */
export async function insertAdmin(q, u) {
  const r = await q.query(
    "insert into users (email, email_norm, display_name, password_hash, language, is_platform_admin, is_owner_identity) values ($1, $2, $3, $4, $5, true, true) returning id",
    [u.email, u.emailNorm, u.name, u.passwordHash, u.language],
  );
  return r.rows[0].id;
}

/**
 * The owner organisation, with AI allowed.
 * @param {Q} q
 * @param {string} name
 * @param {string} createdBy
 * @returns {Promise<string>} the organisation id
 */
export async function insertOwnerOrg(q, name, createdBy) {
  const r = await q.query(
    "insert into orgs (name, kind, ai_allowed, created_by) values ($1, 'owner', true, $2) returning id",
    [name, createdBy],
  );
  return r.rows[0].id;
}

/**
 * @param {Q} q
 * @param {string} orgId
 * @param {string} userId
 * @param {string} role
 */
export async function insertMember(q, orgId, userId, role) {
  await q.query(
    "insert into org_members (org_id, user_id, role) values ($1, $2, $3)",
    [orgId, userId, role],
  );
}

// The login counter of an e-mail without an active account (4.9.5, decisions/0137 Addition B7a, N2c).

/**
 * Makes the row exist, then locks it.
 * @param {Q} q
 * @param {string} key
 * @param {number} now
 * @returns {Promise<{ fails: number, failed_since: unknown, locked_until: unknown }>}
 */
export async function lockLoginFailures(q, key, now) {
  await q.query(
    "insert into login_failures (key, fails, updated_at) values ($1, 0, $2::timestamptz) on conflict (key) do nothing",
    [key, iso(now)],
  );
  const r = await q.query(
    "select fails, failed_since, locked_until from login_failures where key = $1 for update",
    [key],
  );
  return r.rows[0];
}

/**
 * @param {Q} q
 * @param {string} key
 * @param {{ fails: number, since: number, lockedUntil: number | null }} c
 * @param {number} now
 */
export async function setLoginFailures(q, key, c, now) {
  await q.query(
    "update login_failures set fails = $2, failed_since = $3::timestamptz, locked_until = $4::timestamptz, updated_at = $5::timestamptz where key = $1",
    [
      key,
      c.fails,
      iso(c.since),
      c.lockedUntil === null ? null : iso(c.lockedUntil),
      iso(now),
    ],
  );
}

// The admin delay per client address (4.9.5, P2).

/**
 * Makes the row of the address exist (fails 0), then locks it.
 * @param {Q} q
 * @param {string} key
 * @param {number} now
 * @returns {Promise<{ fails: number, next_at: unknown }>}
 */
export async function lockDelay(q, key, now) {
  await q.query(
    "insert into login_delays (key, fails, next_at, updated_at) values ($1, 0, $2::timestamptz, $2::timestamptz) on conflict (key) do nothing",
    [key, iso(now)],
  );
  const r = await q.query(
    "select fails, next_at from login_delays where key = $1 for update",
    [key],
  );
  return r.rows[0];
}

/**
 * @param {Q} q
 * @param {string} key
 * @param {number} fails
 * @param {number} nextAt
 * @param {number} now
 */
export async function setDelay(q, key, fails, nextAt, now) {
  await q.query(
    "update login_delays set fails = $2, next_at = $3::timestamptz, updated_at = $4::timestamptz where key = $1",
    [key, fails, iso(nextAt), iso(now)],
  );
}

/**
 * @param {Q} q
 * @param {string} key
 */
export async function deleteDelay(q, key) {
  await q.query("delete from login_delays where key = $1", [key]);
}

// Rate limits (4.10).

/**
 * Increments and reads the fixed window in one statement.
 * @param {Q} q
 * @param {string} key
 * @param {number} windowStart
 * @returns {Promise<number>} the count after this request
 */
export async function bumpRate(q, key, windowStart) {
  const r = await q.query(
    "insert into rate_limits (key, window_start, count) values ($1, $2::timestamptz, 1) on conflict (key, window_start) do update set count = rate_limits.count + 1 returning count",
    [key, iso(windowStart)],
  );
  return Number(r.rows[0].count);
}

/**
 * The lazy cleanup (4.10): rows past their use.
 * @param {Q} q
 * @param {number} now
 */
export async function cleanup(q, now) {
  const day = iso(now - 24 * 3600 * 1000);
  const month = iso(now - 30 * 24 * 3600 * 1000);
  await q.query(
    "delete from rate_limits where window_start < $1::timestamptz",
    [day],
  );
  await q.query("delete from login_delays where updated_at < $1::timestamptz", [
    day,
  ]);
  await q.query(
    "delete from login_failures where updated_at < $1::timestamptz",
    [day],
  );
  await q.query(
    "delete from auth_sessions where abs_expires_at < $1::timestamptz",
    [month],
  );
  await q.query(
    "delete from reauth_tokens where expires_at < $1::timestamptz",
    [month],
  );
  await q.query(
    "delete from password_resets where expires_at < $1::timestamptz",
    [month],
  );
  // Unused invites past their expiry by 30 days (ARCH §4 retention; the code design M2PROJ, 4.4). Under platform
  // settings this reaches every organisation's invites; under tenant settings only the caller's (row-level
  // security), so the cleanup of a tenant route does less, never more.
  await q.query(
    "delete from invites where used_at is null and expires_at < $1::timestamptz",
    [month],
  );
}

// Re-auth tokens (4.9.4).

/**
 * @param {Q} q
 * @param {{ userId: string, sessionId: string, purpose: string, tokenHash: string, now: number, expiresAt: number }} t
 * @returns {Promise<string>} the token id
 */
export async function insertReauth(q, t) {
  const r = await q.query(
    "insert into reauth_tokens (user_id, auth_session_id, purpose, token_hash, created_at, expires_at) values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz) returning id",
    [
      t.userId,
      t.sessionId,
      t.purpose,
      t.tokenHash,
      iso(t.now),
      iso(t.expiresAt),
    ],
  );
  return r.rows[0].id;
}

/**
 * The one consuming statement: a token of this user, session and purpose, unused and not expired.
 * @param {Q} q
 * @param {{ tokenHash: string, userId: string, sessionId: string, purpose: string, now: number }} t
 * @returns {Promise<string | null>} the token id, or null
 */
export async function consumeReauth(q, t) {
  const r = await q.query(
    "update reauth_tokens set used_at = $5::timestamptz where token_hash = $1 and user_id = $2 and auth_session_id = $3 and purpose = $4 and used_at is null and expires_at > $5::timestamptz returning id",
    [t.tokenHash, t.userId, t.sessionId, t.purpose, iso(t.now)],
  );
  return r.rows[0]?.id ?? null;
}

// Reset codes (4.9.8).

/**
 * @param {Q} q
 * @param {string} userId
 */
export async function deleteUnusedResets(q, userId) {
  await q.query(
    "delete from password_resets where user_id = $1 and used_at is null",
    [userId],
  );
}

/**
 * @param {Q} q
 * @param {{ userId: string, codeHash: string, createdBy: string, now: number, expiresAt: number }} c
 */
export async function insertReset(q, c) {
  await q.query(
    "insert into password_resets (user_id, code_hash, created_by, created_at, expires_at) values ($1, $2, $3, $4::timestamptz, $5::timestamptz)",
    [c.userId, c.codeHash, c.createdBy, iso(c.now), iso(c.expiresAt)],
  );
}

/**
 * The one consuming statement of a reset code of an active user.
 * @param {Q} q
 * @param {string} codeHash
 * @param {number} now
 * @returns {Promise<string | null>} the user id, or null
 */
export async function consumeReset(q, codeHash, now) {
  const r = await q.query(
    "update password_resets set used_at = $2::timestamptz where code_hash = $1 and used_at is null and expires_at > $2::timestamptz and user_id in (select id from users where status = 'active') returning user_id",
    [codeHash, iso(now)],
  );
  return r.rows[0]?.user_id ?? null;
}

// TOTP (4.9.7).

/**
 * A new pending secret: not yet required at login.
 * @param {Q} q
 * @param {string} id
 * @param {string} secretEnc
 */
export async function setTotpPending(q, id, secretEnc) {
  await q.query(
    "update users set totp_secret_enc = $2, totp_enabled_at = null, totp_last_step = null, totp_recovery = '{}' where id = $1",
    [id, secretEnc],
  );
}

/**
 * Claims a TOTP step atomically; false for a replay (the step or a newer one was used).
 * @param {Q} q
 * @param {string} id
 * @param {number} step
 * @returns {Promise<boolean>}
 */
export async function claimTotpStep(q, id, step) {
  const r = await q.query(
    "update users set totp_last_step = $2::bigint where id = $1 and (totp_last_step is null or totp_last_step < $2::bigint) returning id",
    [id, step],
  );
  return r.rows.length === 1;
}

/**
 * @param {Q} q
 * @param {string} id
 * @param {number} now
 * @param {string[]} recoveryHashes
 */
export async function enableTotp(q, id, now, recoveryHashes) {
  await q.query(
    "update users set totp_enabled_at = $2::timestamptz, totp_recovery = $3::text[] where id = $1",
    [id, iso(now), recoveryHashes],
  );
}

/**
 * Uses one recovery code atomically: the codes left, or null when it is not there.
 * @param {Q} q
 * @param {string} id
 * @param {string} codeHash
 * @returns {Promise<number | null>}
 */
export async function useRecovery(q, id, codeHash) {
  const r = await q.query(
    "update users set totp_recovery = array_remove(totp_recovery, $2::text) where id = $1 and $2::text = any(totp_recovery) returning cardinality(totp_recovery) as remaining",
    [id, codeHash],
  );
  return r.rows.length === 1 ? Number(r.rows[0].remaining) : null;
}

/**
 * @param {Q} q
 * @param {string} id
 */
export async function clearTotp(q, id) {
  await q.query(
    "update users set totp_secret_enc = null, totp_enabled_at = null, totp_last_step = null, totp_recovery = '{}' where id = $1",
    [id],
  );
}
