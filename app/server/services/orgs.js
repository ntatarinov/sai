import crypto from "node:crypto";
import { rules } from "../auth/password.js";
import { openSession, setCookie } from "../auth/sessions.js";
import {
  deleteSession,
  deleteUserSessions,
  insertMember,
} from "../db/auth-store.js";
import { DbError } from "../db/index.js";
import {
  accountExists,
  anonymiseUser,
  claimInvite,
  closeDeletionRequests,
  deleteUnusedInvitesOf,
  deleteUserMemberships,
  deleteUserReauth,
  deleteUserResets,
  findInviteByHash,
  findOrg,
  insertConsent,
  insertCustomerOrg,
  insertDeletionRequest,
  insertInvitedUser,
  insertInvite,
  listOpenDeletions,
  lockUserForDelete,
  orgMemberCount,
  orgsOfUser,
  readOpenDeletion,
  readRegistrationMode,
  scrubInviteEmails,
  setInviteUsedBy,
} from "../db/org-store.js";
import { msOf } from "../db/auth-store.js";
import { UUID } from "../db/tx.js";
import { HttpError } from "../http/errors.js";
import { emailNorm } from "../http/schema.js";
import { appendAudit } from "./audit.js";
import { purgeOrgProjects } from "./projects.js";

// Organisations, invitations, consent and deletion (REQ-116; the code design M2PROJ, 4.5.1). Services hold the
// rules and never run a statement: every statement is a named function of db/org-store.js. Every function runs
// inside the request transaction of the pipeline under platform settings; a refusal that must keep its counters
// is returned, every other refusal is thrown (the whole transaction rolls back, M2AUTH C4).

/** @typedef {import("../http/auth-mw.js").AuthContext} AuthContext */
/** @typedef {import("../db/index.js").Q} Q */
/** @typedef {{ status: number, body: unknown, headers?: Array<[string, string]> }} RouteAnswer */

/**
 * The G7 gate of the personal-data rule (a constant, changed by a release): `owner_only` lets only invites for
 * an owner identity through; `invited` is the owner's answer «б» (the code design M2PROJ, C7). A test pins this
 * value; the app takes the gate from `deps.auth.personalDataGate` when it is given.
 * @type {"owner_only" | "invited"}
 */
export const PERSONAL_DATA_GATE = "owner_only";

/** An invite lives 7 days. */
export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

/** What a deleted account holds in place of the personal fields (C10). */
export const DELETED_NAME = "Deleted account";
/** The form of a stored hash that no computation gives: a login against it never verifies. */
export const DELETED_HASH = "scrypt$17$8$1$deleted$deleted";

/**
 * @param {string} userId
 * @returns {string}
 */
export const deletedEmail = (userId) => `deleted-${userId}@deleted.invalid`;

const CODE_FORM = /^[A-Za-z0-9_-]{22}$/;
const ROLES = Object.freeze(["org_owner", "org_admin", "member", "viewer"]);

/**
 * A returned refusal: its counters commit, nothing else changes.
 * @param {import("../http/errors.js").ErrorCode} code
 * @param {number} status
 * @returns {RouteAnswer}
 */
const returned = (code, status) => ({ status, body: { error: code } });

/**
 * @param {AuthContext} ctx
 * @returns {import("../auth/keys.js").Keys}
 */
function keysOf(ctx) {
  if (!ctx.keys) throw new HttpError("server_config");
  return ctx.keys;
}

/**
 * Creates an invite (N4): the code is shown once in the link and kept only as its HMAC.
 * @param {Q} q
 * @param {AuthContext} ctx
 * @param {{ adminId: string, reauthId: string, email: string, role: string, organisation: string | null, orgName: string | null, ownerIdentity: boolean, now: number, ip: string | null }} input
 * @returns {Promise<{ id: string, link: string, expiresAt: number }>}
 */
export async function createInvite(q, ctx, input) {
  const keys = keysOf(ctx);
  // The cross-field rules: an existing organisation or a new one, never both and never neither; a new
  // organisation's first person is its owner.
  if ((input.organisation === null) === (input.orgName === null))
    throw new HttpError("bad_body");
  if (!ROLES.includes(input.role)) throw new HttpError("bad_body");
  if (input.orgName !== null && input.role !== "org_owner")
    throw new HttpError("bad_body");
  /** @type {string | null} */
  let orgId = null;
  if (input.organisation !== null) {
    const org = UUID.test(input.organisation)
      ? await findOrg(q, input.organisation)
      : null;
    if (!org) throw new HttpError("not_found");
    orgId = org.id;
    // Every member of the owner organisation is an owner identity (ARCH §4), whatever the gate says.
    if (org.kind === "owner" && !input.ownerIdentity)
      throw new HttpError("owner_identity_required");
  }
  if (ctx.gate === "owner_only" && !input.ownerIdentity)
    throw new HttpError("personal_data_gate");
  const norm = emailNorm(input.email);
  if (await accountExists(q, norm)) throw new HttpError("account_exists");
  const code = crypto.randomBytes(16).toString("base64url");
  const expiresAt = input.now + INVITE_TTL_MS;
  const id = await insertInvite(q, {
    orgId,
    orgName: input.orgName,
    emailNorm: norm,
    role: input.role,
    ownerIdentity: input.ownerIdentity,
    codeHash: keys.mac("invite", code),
    expiresAt,
    createdBy: input.adminId,
    now: input.now,
  });
  await appendAudit(
    q,
    {
      orgId,
      actorKind: "admin",
      actorId: input.adminId,
      action: "invite.create",
      targetKind: "invite",
      targetId: id,
      ip: input.ip,
      details: {
        role: input.role,
        owner_identity: input.ownerIdentity,
        reauth_id: input.reauthId,
      },
    },
    { now: input.now, mac: keys.mac },
  );
  return { id, link: `${ctx.appOrigin}/invite.html#c=${code}`, expiresAt };
}

/**
 * What the holder of a code sees (N1): the organisation's name, the role and the languages the consent can be
 * given in; null for an unknown, expired or used code. It shows no e-mail and no id.
 * @param {Q} q
 * @param {AuthContext} ctx
 * @param {string} code
 * @param {number} now
 * @returns {Promise<{ org: { name: string, new: boolean }, role: string, consentLangs: string[] } | null>}
 */
export async function viewInvite(q, ctx, code, now) {
  if (!CODE_FORM.test(code)) return null;
  const invite = await findInviteByHash(
    q,
    keysOf(ctx).mac("invite", code),
    now,
  );
  if (!invite) return null;
  const isNew = invite.org_id === null;
  return {
    org: {
      name: /** @type {string} */ (
        isNew ? invite.org_name : invite.existing_name
      ),
      new: isNew,
    },
    role: invite.role,
    consentLangs: Object.keys(ctx.consent).filter(
      (l) => ctx.consent[l] !== null,
    ),
  };
}

/**
 * Accepts an invite (N2). Refusals that depend only on the body are thrown; refusals that depend on the state of
 * the database are returned, so the rate count of the address commits and nothing else changes. The invite is
 * spent by one conditional update after every check and after the password hash, so a returned refusal never
 * spends it and no row lock is held through the scrypt.
 * @param {Q} q
 * @param {AuthContext} ctx
 * @param {{ body: Record<string, any>, code: string, now: number, clientIp: string | null, oldSessionId: string | null }} input
 * @returns {Promise<RouteAnswer>}
 */
export async function acceptInvite(q, ctx, input) {
  const keys = keysOf(ctx);
  const body = input.body;
  // (1) and (2): the consent.
  if (body.consent !== true) throw new HttpError("consent_required");
  const want = ctx.consent[body.consent_lang] ?? null;
  if (want === null || body.consent_sha256 !== want)
    throw new HttpError("consent_stale");
  // (3): the password rule.
  if (rules(body.password) !== "ok") throw new HttpError("password_rules");
  // (4): the registration mode: no row or `invite` or `open` accept, `closed` and any other value refuse.
  const mode = await readRegistrationMode(q);
  if (!(mode === null || mode === "invite" || mode === "open"))
    return returned("registration_closed", 403);
  // (5) and (6): the invite and its e-mail; one uniform answer for an unknown, expired or used code and for a
  // wrong e-mail (C6).
  if (!CODE_FORM.test(input.code)) return returned("not_found", 404);
  const codeHash = keys.mac("invite", input.code);
  const invite = await findInviteByHash(q, codeHash, input.now);
  if (!invite) return returned("not_found", 404);
  const norm = emailNorm(body.email);
  if (norm !== invite.email_norm) return returned("not_found", 404);
  // (7): the gate, also for a row planted in the database.
  if (ctx.gate === "owner_only" && !invite.owner_identity)
    return returned("personal_data_gate", 403);
  // (8): the e-mail has an account.
  if (await accountExists(q, norm)) return returned("account_exists", 409);
  // (9): the password hash, before the claim.
  const passwordHash = await ctx.passwords.hash(body.password);
  // (10): the claim; no row means the parallel winner took it.
  const inviteId = await claimInvite(q, codeHash, input.now);
  if (inviteId === null) return returned("not_found", 404);
  // (11): the user, the consent record and the membership (a new organisation first).
  /** @type {string} */
  let userId;
  try {
    userId = await insertInvitedUser(q, {
      email: body.email,
      emailNorm: norm,
      name: body.name,
      passwordHash,
      language: body.consent_lang,
      ownerIdentity: invite.owner_identity,
    });
  } catch (err) {
    // A unique violation on the e-mail lost a race: the transaction is aborted and rolls back whole.
    if (err instanceof DbError && err.sqlstate === "23505")
      throw new HttpError("account_exists");
    throw err;
  }
  await insertConsent(q, {
    userId,
    sha256: body.consent_sha256,
    lang: body.consent_lang,
    now: input.now,
  });
  /** @type {string} */
  let orgId;
  /** @type {string} */
  let role;
  if (invite.org_id !== null) {
    orgId = invite.org_id;
    role = invite.role;
  } else {
    orgId = await insertCustomerOrg(
      q,
      /** @type {string} */ (invite.org_name),
      userId,
    );
    role = "org_owner";
  }
  await insertMember(q, orgId, userId, role);
  // (12) and (13): the invite is marked used and the row is audited.
  await setInviteUsedBy(q, inviteId, userId);
  // The e-mail's other unused invites go: none of them can create the account again (SEC F1).
  await deleteUnusedInvitesOf(q, norm, inviteId);
  await appendAudit(
    q,
    {
      orgId,
      actorKind: "user",
      actorId: userId,
      action: "invite.accept",
      targetKind: "invite",
      targetId: inviteId,
      ip: input.clientIp,
      details: { role, owner_identity: invite.owner_identity },
    },
    { now: input.now, mac: keys.mac },
  );
  // (14): the old session of the request ends, a new one opens (rotation).
  if (input.oldSessionId !== null) await deleteSession(q, input.oldSessionId);
  const s = await openSession(q, keys, {
    userId,
    ip: input.clientIp,
    now: input.now,
  });
  return {
    status: 200,
    body: { ok: true },
    headers: [
      [
        "Set-Cookie",
        setCookie(/** @type {string} */ (ctx.cookieName), s.token),
      ],
    ],
  };
}

/**
 * The user's own deletion request (N3), after the route checked the password: the first request stores one row
 * and one audit row, a second while one is open stores nothing and answers the first one's time.
 * @param {Q} q
 * @param {AuthContext} ctx
 * @param {{ userId: string, orgId: string | null, now: number, ip: string | null }} input
 * @returns {Promise<{ requestedAt: number }>}
 */
export async function requestDeletion(q, ctx, input) {
  const id = await insertDeletionRequest(q, input.userId, input.now);
  if (id === null) {
    const at = msOf(await readOpenDeletion(q, input.userId));
    return { requestedAt: at ?? input.now };
  }
  await appendAudit(
    q,
    {
      orgId: input.orgId,
      actorKind: "user",
      actorId: input.userId,
      action: "account.deletion_request",
      targetKind: "user",
      targetId: input.userId,
      ip: input.ip,
      details: {},
    },
    { now: input.now, mac: keysOf(ctx).mac },
  );
  return { requestedAt: input.now };
}

/**
 * The open deletion requests, oldest first (N5).
 * @param {Q} q
 * @returns {Promise<Array<{ id: string, user_id: string, name: string, email: string, requested_at: number }>>}
 */
export async function listDeletions(q) {
  const rows = await listOpenDeletions(q);
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    name: r.display_name,
    email: r.email,
    requested_at: /** @type {number} */ (msOf(r.requested_at)),
  }));
}

/**
 * Deletes an account (N6), in the caller's one platform transaction: the personal fields are replaced by
 * placeholders, his sessions, tokens, reset codes and membership are removed, the used invite's e-mail is
 * replaced, his requests are closed, the projects of an organisation left with no member are purged, and the
 * action is audited. The consent record stays: it holds a digest, a language and a time, no personal value.
 * @param {Q} q
 * @param {AuthContext} ctx
 * @param {{ adminId: string, targetId: string, reauthId: string, now: number, ip: string | null }} input
 * @returns {Promise<void>}
 */
export async function deleteAccount(q, ctx, input) {
  const target = UUID.test(input.targetId)
    ? await lockUserForDelete(q, input.targetId)
    : null;
  if (!target || target.status === "deleted") throw new HttpError("not_found");
  if (target.is_platform_admin) throw new HttpError("forbidden");
  const orgIds = await orgsOfUser(q, target.id);
  await anonymiseUser(q, target.id, {
    email: deletedEmail(target.id),
    emailNorm: deletedEmail(target.id),
    name: DELETED_NAME,
    passwordHash: DELETED_HASH,
  });
  await deleteUserSessions(q, target.id);
  await deleteUserReauth(q, target.id);
  await deleteUserResets(q, target.id);
  await deleteUserMemberships(q, target.id);
  await scrubInviteEmails(q, target.id, deletedEmail(target.id));
  // Every unused invite of his e-mail goes too, not only the ones he used (SEC F1).
  await deleteUnusedInvitesOf(q, target.email_norm, null);
  await closeDeletionRequests(q, target.id, input.now);
  for (const orgId of orgIds)
    if ((await orgMemberCount(q, orgId)) === 0)
      await purgeOrgProjects(q, orgId);
  await appendAudit(
    q,
    {
      orgId: null,
      actorKind: "admin",
      actorId: input.adminId,
      action: "account.delete",
      targetKind: "user",
      targetId: target.id,
      ip: input.ip,
      details: { reauth_id: input.reauthId },
    },
    { now: input.now, mac: keysOf(ctx).mac },
  );
}
