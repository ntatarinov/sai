import {
  afterFailure,
  delaySeconds,
  isAhead,
  secondsLeft,
} from "../auth/lockout.js";
import { DUMMY_HASH, rules } from "../auth/password.js";
import { isPurpose, issueReauth, REAUTH_TTL_MS } from "../auth/reauth.js";
import { clearCookie, openSession, setCookie } from "../auth/sessions.js";
import { setupTokenMatches } from "../auth/setup.js";
import { verifyCode } from "../auth/totp.js";
import {
  claimSetup,
  claimTotpStep,
  consumeReset,
  deleteDelay,
  deleteOtherSessions,
  deleteSession,
  deleteUnusedResets,
  deleteUserSessions,
  findAccount,
  insertAdmin,
  iso,
  insertMember,
  insertOwnerOrg,
  listMemberships,
  lockDelay,
  lockLoginFailures,
  lockUser,
  loginSucceeded,
  msOf,
  readProfile,
  readUser,
  resetPassword,
  setDelay,
  setLastLogin,
  setLoginCounter,
  setLoginFailures,
  setPasswordHash,
  setReauthCounter,
  useRecovery,
} from "../db/auth-store.js";
import { keysOf } from "../http/auth-mw.js";
import { addressKey } from "../http/rate-limit.js";
import { HttpError } from "../http/errors.js";
import { emailNorm, withBody } from "../http/schema.js";
import { appendAudit } from "../services/audit.js";
import { readOpenDeletion } from "../db/org-store.js";
import { requestDeletion } from "../services/orgs.js";

// The auth routes (REQ-114; the code design M2AUTH, 4.4 rows 4-10): setup, login, logout, me, password,
// re-auth and reset. Each handler runs inside the request transaction of the pipeline (http/auth-mw.js) with
// its query `q`; a refusal that must be counted is returned, every other refusal is thrown.

/** @typedef {import("../http/auth-mw.js").AuthContext} AuthContext */
/** @typedef {import("../http/auth-mw.js").PipelineRequest} PipelineRequest */
/** @typedef {import("../db/index.js").Q} Q */
/** @typedef {import("../db/auth-store.js").UserAuthRow} UserAuthRow */
/** @typedef {{ status: number, body: unknown, headers?: Array<[string, string]> }} RouteAnswer */
/** @typedef {import("../services/audit.js").AuditEntry} AuditEntry */

/**
 * A returned refusal: its counters commit with it.
 * @param {import("../http/errors.js").ErrorCode} code
 * @param {number} status
 * @param {number} [retryAfter]
 * @returns {RouteAnswer}
 */
export function refusal(code, status, retryAfter) {
  return {
    status,
    body: { error: code },
    ...(retryAfter === undefined
      ? {}
      : {
          headers: /** @type {Array<[string, string]>} */ ([
            ["Retry-After", String(retryAfter)],
          ]),
        }),
  };
}

/** The meta of a route: the six keys of REQ-115 criterion 6. */
const sessionMeta = (
  /** @type {"setup" | "login" | "reset" | "user"} */ rateLimit,
) =>
  Object.freeze({
    tenant: false,
    admin: false,
    reauth: null,
    worker: false,
    session: true,
    rateLimit,
  });

/**
 * Writes one audit row in the request transaction.
 * @param {AuthContext} ctx
 * @param {PipelineRequest} req
 * @param {Partial<AuditEntry> & { action: string, actorKind: AuditEntry["actorKind"] }} entry
 */
export function audit(ctx, req, entry) {
  return appendAudit(
    req.q,
    {
      orgId: null,
      actorId: null,
      targetKind: null,
      targetId: null,
      ip: req.clientIp,
      details: {},
      ...entry,
    },
    { now: req.now, mac: keysOf(ctx).mac },
  );
}

/**
 * The second factor of an account with TOTP on, after a right password: a 6-digit code of the steps t-1,
 * t, t+1 newer than the last used one (the step claimed by one conditional update), or a recovery code (used
 * by one conditional update). An account without TOTP passes with the method "password".
 * @param {AuthContext} ctx
 * @param {Q} q
 * @param {UserAuthRow} row
 * @param {string | null} code
 * @param {number} now
 * @returns {Promise<{ ok: true, method: "password" | "totp" | "recovery", remaining?: number } | { ok: false, error: "totp_required" | "totp_invalid", reason: "totp_missing" | "totp_wrong" }>}
 */
export async function secondFactor(ctx, q, row, code, now) {
  if (msOf(row.totp_enabled_at) === null)
    return { ok: true, method: "password" };
  if (code === null)
    return { ok: false, error: "totp_required", reason: "totp_missing" };
  const keys = keysOf(ctx);
  if (/^[0-9]{6}$/.test(code)) {
    const secret =
      row.totp_secret_enc === null
        ? null
        : keys.openTotp(row.totp_secret_enc, row.id);
    const last =
      row.totp_last_step === null ? null : Number(row.totp_last_step);
    const step = secret
      ? verifyCode(secret, code, Math.floor(now / 1000), last)
      : null;
    if (step !== null && (await claimTotpStep(q, row.id, step)))
      return { ok: true, method: "totp" };
    return { ok: false, error: "totp_invalid", reason: "totp_wrong" };
  }
  const remaining = await useRecovery(
    q,
    row.id,
    keys.mac("recovery", code.toUpperCase()),
  );
  if (remaining === null)
    return { ok: false, error: "totp_invalid", reason: "totp_wrong" };
  return { ok: true, method: "recovery", remaining };
}

/**
 * The audit row of a used recovery code.
 * @param {AuthContext} ctx
 * @param {PipelineRequest} req
 * @param {string} userId
 * @param {"user" | "admin"} actorKind
 * @param {number} remaining
 */
export function auditRecovery(ctx, req, userId, actorKind, remaining) {
  return audit(ctx, req, {
    action: "auth.totp_recovery_used",
    actorKind,
    actorId: userId,
    targetKind: "user",
    targetId: userId,
    details: { remaining },
  });
}

const NEW_PASSWORD = Object.freeze({ kind: "text", max: 1024 });
const PASSWORD = Object.freeze({ kind: "text", max: 128 });
const CODE = Object.freeze({
  kind: "form",
  re: /^(?:[0-9]{6}|[A-Za-z2-7]{16})$/,
  optional: true,
});

/**
 * @param {AuthContext} ctx
 */
export function authRoutes(ctx) {
  /**
   * The re-auth counter of the user's own row after a failure (the wrong current password of a password
   * change counts too, decisions/0137 О12).
   * @param {PipelineRequest} req
   * @param {UserAuthRow} row
   * @param {"wrong_password" | "totp_missing" | "totp_wrong"} reason
   * @param {"invalid_credentials" | "totp_required" | "totp_invalid"} code
   * @param {string | null} purpose
   */
  async function reauthFailure(req, row, reason, code, purpose) {
    const c = afterFailure(
      { fails: row.reauth_failures, since: msOf(row.reauth_failed_since) },
      req.now,
    );
    await setReauthCounter(req.q, row.id, c);
    await audit(ctx, req, {
      action: "auth.reauth_failed",
      actorKind: row.is_platform_admin ? "admin" : "user",
      actorId: row.id,
      targetKind: "user",
      targetId: row.id,
      details: purpose === null ? { reason } : { reason, purpose },
    });
    return refusal(code, 401);
  }

  /**
   * The user's own row under a lock, and the answer when re-auth is locked.
   * @param {PipelineRequest} req
   * @param {string | null} purpose
   * @returns {Promise<{ row: UserAuthRow } | { answer: RouteAnswer }>}
   */
  async function ownRow(req, purpose) {
    const session = /** @type {import("../auth/sessions.js").Session} */ (
      req.session
    );
    const row = await lockUser(req.q, session.userId);
    if (!row) throw new HttpError("auth_required");
    const lockedUntil = msOf(row.reauth_locked_until);
    if (isAhead(lockedUntil, req.now)) {
      await audit(ctx, req, {
        action: "auth.reauth_failed",
        actorKind: row.is_platform_admin ? "admin" : "user",
        actorId: row.id,
        targetKind: "user",
        targetId: row.id,
        details:
          purpose === null
            ? { reason: "locked" }
            : { reason: "locked", purpose },
      });
      return {
        answer: refusal(
          "reauth_locked",
          429,
          secondsLeft(/** @type {number} */ (lockedUntil), req.now),
        ),
      };
    }
    return { row };
  }

  /**
   * A successful login: the old session of the request is ended (rotation), a new one opened.
   * @param {PipelineRequest} req
   * @param {UserAuthRow | { id: string, is_platform_admin: boolean }} row
   * @param {"password" | "totp" | "recovery"} method
   * @returns {Promise<RouteAnswer>}
   */
  async function signIn(req, row, method) {
    const keys = keysOf(ctx);
    if (req.session) await deleteSession(req.q, req.session.id);
    const s = await openSession(req.q, keys, {
      userId: row.id,
      ip: req.clientIp,
      now: req.now,
    });
    await audit(ctx, req, {
      action: "auth.login",
      actorKind: row.is_platform_admin ? "admin" : "user",
      actorId: row.id,
      targetKind: "user",
      targetId: row.id,
      details: { method, session_id: s.id },
    });
    return {
      status: 200,
      body: { ok: true },
      headers: /** @type {Array<[string, string]>} */ ([
        [
          "Set-Cookie",
          setCookie(/** @type {string} */ (ctx.cookieName), s.token),
        ],
      ]),
    };
  }

  /**
   * A failed login audit row.
   * @param {PipelineRequest} req
   * @param {string} reason
   * @param {string | null} userId
   */
  function failedLogin(req, reason, userId) {
    return audit(ctx, req, {
      action: "auth.login_failed",
      actorKind: "system",
      targetKind: "user",
      targetId: userId,
      details: { reason },
    });
  }

  /**
   * An e-mail without an active account (unknown, disabled, deleted): the counter of login_failures, one
   * scrypt on DUMMY_HASH, the answer of a wrong password; the users row is never written (B7a, N2c).
   * @param {PipelineRequest} req
   * @param {string} norm
   * @param {string | null} userId
   */
  async function noAccount(req, norm, userId) {
    const key = keysOf(ctx).mac("acct", norm);
    const row = await lockLoginFailures(req.q, key, req.now);
    const lockedUntil = msOf(row.locked_until);
    if (isAhead(lockedUntil, req.now)) {
      await failedLogin(req, "locked", userId);
      return refusal(
        "locked",
        429,
        secondsLeft(/** @type {number} */ (lockedUntil), req.now),
      );
    }
    await ctx.passwords.verify(req.body.password, DUMMY_HASH);
    const c = afterFailure(
      { fails: row.fails, since: msOf(row.failed_since) },
      req.now,
    );
    await setLoginFailures(req.q, key, c, req.now);
    await failedLogin(
      req,
      userId === null ? "unknown_email" : "disabled",
      userId,
    );
    return refusal("invalid_credentials", 401);
  }

  /**
   * An active ordinary account: its users row locked, the lock checked before scrypt.
   * @param {PipelineRequest} req
   * @param {UserAuthRow} row
   */
  async function ordinary(req, row) {
    const lockedUntil = msOf(row.locked_until);
    if (isAhead(lockedUntil, req.now)) {
      await failedLogin(req, "locked", row.id);
      return refusal(
        "locked",
        429,
        secondsLeft(/** @type {number} */ (lockedUntil), req.now),
      );
    }
    const fail = async (
      /** @type {string} */ reason,
      /** @type {"invalid_credentials" | "totp_required" | "totp_invalid"} */ code,
    ) => {
      const c = afterFailure(
        { fails: row.failed_logins, since: msOf(row.failed_since) },
        req.now,
      );
      await setLoginCounter(req.q, row.id, c);
      await failedLogin(req, reason, row.id);
      return refusal(code, 401);
    };
    if (!(await ctx.passwords.verify(req.body.password, row.password_hash)))
      return fail("wrong_password", "invalid_credentials");
    const sf = await secondFactor(
      ctx,
      req.q,
      row,
      req.body.code ?? null,
      req.now,
    );
    if (!sf.ok) return fail(sf.reason, sf.error);
    await loginSucceeded(req.q, row.id, req.now);
    if (sf.method === "recovery")
      await auditRecovery(ctx, req, row.id, "user", sf.remaining ?? 0);
    return signIn(req, row, sf.method);
  }

  /**
   * The platform admin: never locked and his users row never locked by a login; the delay row of the
   * client address is locked instead and checked before scrypt (P2).
   * @param {PipelineRequest} req
   * @param {string} id
   * @param {string} norm
   */
  async function admin(req, id, norm) {
    const key = keysOf(ctx).mac("delay", addressKey(req.clientIp ?? "unknown"));
    const d = await lockDelay(req.q, key, req.now);
    const nextAt = msOf(d.next_at);
    if (isAhead(nextAt, req.now)) {
      await failedLogin(req, "delay", id);
      return refusal(
        "rate_limited",
        429,
        secondsLeft(/** @type {number} */ (nextAt), req.now),
      );
    }
    const row = await readUser(req.q, id);
    if (!row || row.status !== "active") return noAccount(req, norm, id);
    const fail = async (
      /** @type {string} */ reason,
      /** @type {"invalid_credentials" | "totp_required" | "totp_invalid"} */ code,
    ) => {
      await setDelay(
        req.q,
        key,
        d.fails + 1,
        req.now + delaySeconds(d.fails) * 1000,
        req.now,
      );
      await failedLogin(req, reason, id);
      return refusal(code, 401);
    };
    if (!(await ctx.passwords.verify(req.body.password, row.password_hash)))
      return fail("wrong_password", "invalid_credentials");
    const sf = await secondFactor(
      ctx,
      req.q,
      row,
      req.body.code ?? null,
      req.now,
    );
    if (!sf.ok) return fail(sf.reason, sf.error);
    await deleteDelay(req.q, key);
    await setLastLogin(req.q, id, req.now);
    if (sf.method === "recovery")
      await auditRecovery(ctx, req, id, "admin", sf.remaining ?? 0);
    return signIn(req, row, sf.method);
  }

  /** POST /api/auth/login (4.4 row 5, 4.9.5). @param {PipelineRequest} req */
  async function login(req) {
    const norm = emailNorm(req.body.email);
    const account = await findAccount(req.q, norm);
    if (!account || account.status !== "active")
      return noAccount(req, norm, account?.id ?? null);
    if (account.is_platform_admin) return admin(req, account.id, norm);
    const row = await lockUser(req.q, account.id);
    // A status changed between the two reads takes the branch of the locked read.
    if (!row || row.status !== "active")
      return noAccount(req, norm, account.id);
    if (row.is_platform_admin) return admin(req, account.id, norm);
    return ordinary(req, row);
  }

  /** POST /api/auth/setup (4.4 row 4, 4.9.6). @param {PipelineRequest} req */
  async function setup(req) {
    if (!setupTokenMatches(ctx.setupTokenHash, req.body.token))
      return refusal("not_found", 404);
    if (rules(req.body.password) !== "ok")
      throw new HttpError("password_rules");
    if (!(await claimSetup(req.q))) return refusal("not_found", 404);
    const passwordHash = await ctx.passwords.hash(req.body.password);
    const userId = await insertAdmin(req.q, {
      email: req.body.email,
      emailNorm: emailNorm(req.body.email),
      name: req.body.name,
      passwordHash,
      language: req.body.language ?? "ru",
    });
    const orgId = await insertOwnerOrg(req.q, req.body.name, userId);
    await insertMember(req.q, orgId, userId, "org_owner");
    await audit(ctx, req, {
      action: "auth.setup",
      actorKind: "admin",
      actorId: userId,
      targetKind: "user",
      targetId: userId,
    });
    return { status: 201, body: { ok: true } };
  }

  /** POST /api/auth/logout (4.4 row 6). @param {PipelineRequest} req */
  async function logout(req) {
    const session = /** @type {import("../auth/sessions.js").Session} */ (
      req.session
    );
    await deleteSession(req.q, session.id);
    await audit(ctx, req, {
      action: "auth.logout",
      actorKind: session.isAdmin ? "admin" : "user",
      actorId: session.userId,
      targetKind: "user",
      targetId: session.userId,
      details: { session_id: session.id },
    });
    return {
      status: 200,
      body: { ok: true },
      headers: /** @type {Array<[string, string]>} */ ([
        ["Set-Cookie", clearCookie(/** @type {string} */ (ctx.cookieName))],
      ]),
    };
  }

  /** GET /api/auth/me (4.4 row 7). @param {PipelineRequest} req */
  async function me(req) {
    const session = /** @type {import("../auth/sessions.js").Session} */ (
      req.session
    );
    const profile = await readProfile(req.q, session.userId);
    if (!profile) throw new HttpError("auth_required");
    const memberships = await listMemberships(req.q, session.userId);
    const deletion = msOf(await readOpenDeletion(req.q, session.userId));
    return {
      status: 200,
      body: {
        id: profile.id,
        name: profile.display_name,
        language: profile.language,
        platform_admin: profile.is_platform_admin === true,
        memberships: memberships.map((m) => ({
          org_id: m.org_id,
          name: m.name,
          kind: m.kind,
          role: m.role,
        })),
        deletion_requested_at: deletion === null ? null : iso(deletion),
        csrf: session.csrf,
      },
    };
  }

  /** POST /api/auth/password (4.4 row 8). @param {PipelineRequest} req */
  async function password(req) {
    if (rules(req.body.next) !== "ok") throw new HttpError("password_rules");
    const own = await ownRow(req, null);
    if ("answer" in own) return own.answer;
    const row = own.row;
    if (!(await ctx.passwords.verify(req.body.current, row.password_hash)))
      return reauthFailure(
        req,
        row,
        "wrong_password",
        "invalid_credentials",
        null,
      );
    const session = /** @type {import("../auth/sessions.js").Session} */ (
      req.session
    );
    await setPasswordHash(
      req.q,
      row.id,
      await ctx.passwords.hash(req.body.next),
    );
    await setReauthCounter(req.q, row.id, {
      fails: 0,
      since: null,
      lockedUntil: null,
    });
    await deleteOtherSessions(req.q, row.id, session.id);
    // An unused reset link of the admin no longer sets a password (decisions/0137 Addition 4, SEC F5).
    await deleteUnusedResets(req.q, row.id);
    await audit(ctx, req, {
      action: "auth.password_change",
      actorKind: row.is_platform_admin ? "admin" : "user",
      actorId: row.id,
      targetKind: "user",
      targetId: row.id,
      details: { session_id: session.id },
    });
    return { status: 200, body: { ok: true } };
  }

  /** POST /api/auth/reauth (4.4 row 9, 4.9.4). @param {PipelineRequest} req */
  async function reauth(req) {
    const purpose = req.body.purpose;
    if (!isPurpose(purpose)) throw new HttpError("unknown_purpose");
    const own = await ownRow(req, purpose);
    if ("answer" in own) return own.answer;
    const row = own.row;
    if (!(await ctx.passwords.verify(req.body.password, row.password_hash)))
      return reauthFailure(
        req,
        row,
        "wrong_password",
        "invalid_credentials",
        purpose,
      );
    const sf = await secondFactor(
      ctx,
      req.q,
      row,
      req.body.code ?? null,
      req.now,
    );
    if (!sf.ok) return reauthFailure(req, row, sf.reason, sf.error, purpose);
    const session = /** @type {import("../auth/sessions.js").Session} */ (
      req.session
    );
    await setReauthCounter(req.q, row.id, {
      fails: 0,
      since: null,
      lockedUntil: null,
    });
    const actorKind = row.is_platform_admin ? "admin" : "user";
    if (sf.method === "recovery")
      await auditRecovery(ctx, req, row.id, actorKind, sf.remaining ?? 0);
    const t = await issueReauth(req.q, keysOf(ctx), {
      userId: row.id,
      sessionId: session.id,
      purpose,
      now: req.now,
    });
    await audit(ctx, req, {
      action: "auth.reauth",
      actorKind,
      actorId: row.id,
      targetKind: "user",
      targetId: row.id,
      details: { purpose, method: sf.method, reauth_id: t.id },
    });
    return {
      status: 200,
      body: { token: t.token, expires_in: REAUTH_TTL_MS / 1000 },
    };
  }

  /** POST /api/account/deletion-request (N3, REQ-116 criterion 6). @param {PipelineRequest} req */
  async function deletionRequest(req) {
    const session = /** @type {import("../auth/sessions.js").Session} */ (
      req.session
    );
    // The platform admin's account cannot be deleted, so a request that can never be carried out is not stored.
    if (session.isAdmin) throw new HttpError("forbidden");
    const own = await ownRow(req, null);
    if ("answer" in own) return own.answer;
    const row = own.row;
    if (!(await ctx.passwords.verify(req.body.password, row.password_hash)))
      return reauthFailure(
        req,
        row,
        "wrong_password",
        "invalid_credentials",
        null,
      );
    await setReauthCounter(req.q, row.id, {
      fails: 0,
      since: null,
      lockedUntil: null,
    });
    const r = await requestDeletion(req.q, ctx, {
      userId: row.id,
      orgId: session.orgId,
      now: req.now,
      ip: req.clientIp,
    });
    return {
      status: 200,
      body: { ok: true, requested_at: iso(r.requestedAt) },
    };
  }

  /** POST /api/auth/reset (4.4 row 10, 4.9.8). @param {PipelineRequest} req */
  async function reset(req) {
    if (rules(req.body.password) !== "ok")
      throw new HttpError("password_rules");
    const code = req.body.code;
    const userId = /^[A-Za-z0-9_-]{22}$/.test(code)
      ? await consumeReset(req.q, keysOf(ctx).mac("reset", code), req.now)
      : null;
    if (userId === null) {
      await audit(ctx, req, {
        action: "auth.reset_failed",
        actorKind: "system",
      });
      return refusal("reset_invalid", 400);
    }
    await resetPassword(
      req.q,
      userId,
      await ctx.passwords.hash(req.body.password),
    );
    await deleteUserSessions(req.q, userId);
    await audit(ctx, req, {
      action: "auth.reset_used",
      actorKind: "system",
      targetKind: "user",
      targetId: userId,
    });
    return { status: 200, body: { ok: true } };
  }

  const row = (
    /** @type {string} */ method,
    /** @type {string} */ path,
    /** @type {"setup" | "login" | "reset" | "user"} */ rateLimit,
    /** @type {(req: PipelineRequest) => Promise<RouteAnswer>} */ handler,
    /** @type {import("../http/schema.js").Shape} */ shape,
  ) =>
    withBody(
      Object.freeze({ method, path, meta: sessionMeta(rateLimit), handler }),
      shape,
    );

  return [
    row("POST", "/api/auth/setup", "setup", setup, {
      token: { kind: "text", max: 128 },
      email: { kind: "email" },
      name: { kind: "text", min: 1, max: 80 },
      password: NEW_PASSWORD,
      language: { kind: "enum", values: ["ru", "kk", "en"], optional: true },
    }),
    row("POST", "/api/auth/login", "login", login, {
      email: { kind: "email" },
      password: PASSWORD,
      code: CODE,
    }),
    row("POST", "/api/auth/logout", "user", logout, {}),
    row("GET", "/api/auth/me", "user", me, {}),
    row("POST", "/api/auth/password", "user", password, {
      current: PASSWORD,
      next: NEW_PASSWORD,
    }),
    row("POST", "/api/auth/reauth", "user", reauth, {
      password: PASSWORD,
      purpose: { kind: "text", max: 32 },
      code: CODE,
    }),
    row("POST", "/api/auth/reset", "reset", reset, {
      code: { kind: "text", max: 64 },
      password: NEW_PASSWORD,
    }),
    row("POST", "/api/account/deletion-request", "user", deletionRequest, {
      password: PASSWORD,
    }),
  ];
}
