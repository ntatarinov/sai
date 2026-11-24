import crypto from "node:crypto";
import { base32Encode, SECRET_BYTES, verifyCode } from "../auth/totp.js";
import {
  claimTotpStep,
  clearTotp,
  deleteUnusedResets,
  enableTotp,
  insertReset,
  isLiveUser,
  lockUser,
  msOf,
  setTotpPending,
} from "../db/auth-store.js";
import { UUID } from "../db/tx.js";
import { keysOf } from "../http/auth-mw.js";
import { HttpError } from "../http/errors.js";
import { withBody } from "../http/schema.js";
import { verifyAudit } from "../services/audit.js";
import { audit, auditRecovery, refusal, secondFactor } from "./auth.js";

// The admin routes (REQ-114 criteria 7 and 8, REQ-115 criterion 10; the code design M2AUTH, 4.4 rows 11-15):
// the reset link, the TOTP enrolment, confirmation and switch-off, and the audit verify. Only the platform
// admin reaches them: everyone else gets the uniform 404 before any other check (meta.admin).

/** @typedef {import("../http/auth-mw.js").AuthContext} AuthContext */
/** @typedef {import("../http/auth-mw.js").PipelineRequest} PipelineRequest */
/** @typedef {import("../auth/sessions.js").Session} Session */
/** @typedef {{ status: number, body: unknown, headers?: Array<[string, string]> }} RouteAnswer */

export const RESET_TTL_MS = 30 * 60 * 1000;
const RECOVERY_CODES = 10;

/**
 * @param {string | null} reauth
 */
const adminMeta = (reauth) =>
  Object.freeze({
    tenant: false,
    admin: true,
    reauth,
    worker: false,
    session: true,
    rateLimit: /** @type {"user"} */ ("user"),
  });

/**
 * @param {AuthContext} ctx
 */
export function adminRoutes(ctx) {
  /**
   * The admin's own users row under a lock.
   * @param {PipelineRequest} req
   */
  async function ownRow(req) {
    const session = /** @type {Session} */ (req.session);
    const row = await lockUser(req.q, session.userId);
    if (!row) throw new HttpError("not_found");
    return row;
  }

  /** POST /api/admin/users/:id/reset-link (4.4 row 11, 4.9.8). @param {PipelineRequest} req */
  async function resetLink(req) {
    const session = /** @type {Session} */ (req.session);
    const id = req.params.id ?? "";
    if (!UUID.test(id) || !(await isLiveUser(req.q, id)))
      throw new HttpError("not_found");
    const code = crypto.randomBytes(16).toString("base64url");
    await deleteUnusedResets(req.q, id);
    await insertReset(req.q, {
      userId: id,
      codeHash: keysOf(ctx).mac("reset", code),
      createdBy: session.userId,
      now: req.now,
      expiresAt: req.now + RESET_TTL_MS,
    });
    await audit(ctx, req, {
      action: "auth.reset_link_issued",
      actorKind: "admin",
      actorId: session.userId,
      targetKind: "user",
      targetId: id,
      details: { reauth_id: /** @type {string} */ (req.reauthId) },
    });
    return {
      status: 200,
      body: { link: `${ctx.appOrigin}/reset.html#c=${code}` },
    };
  }

  /** POST /api/admin/totp/enrol (4.4 row 12, 4.9.7). @param {PipelineRequest} req */
  async function enrol(req) {
    const row = await ownRow(req);
    if (msOf(row.totp_enabled_at) !== null) throw new HttpError("totp_state");
    const secret = crypto.randomBytes(SECRET_BYTES);
    await setTotpPending(req.q, row.id, keysOf(ctx).sealTotp(secret, row.id));
    await audit(ctx, req, {
      action: "auth.totp_enrol",
      actorKind: "admin",
      actorId: row.id,
      targetKind: "user",
      targetId: row.id,
      details: { reauth_id: /** @type {string} */ (req.reauthId) },
    });
    const text = base32Encode(secret);
    return {
      status: 200,
      body: {
        secret: text,
        otpauth: `otpauth://totp/Sai:${encodeURIComponent(row.email)}?secret=${text}&issuer=Sai&algorithm=SHA1&digits=6&period=30`,
      },
    };
  }

  /** POST /api/admin/totp/confirm (4.4 row 13). @param {PipelineRequest} req */
  async function confirm(req) {
    const row = await ownRow(req);
    if (row.totp_secret_enc === null || msOf(row.totp_enabled_at) !== null)
      throw new HttpError("totp_state");
    const keys = keysOf(ctx);
    const secret = keys.openTotp(row.totp_secret_enc, row.id);
    const last =
      row.totp_last_step === null ? null : Number(row.totp_last_step);
    const step = secret
      ? verifyCode(secret, req.body.code, Math.floor(req.now / 1000), last)
      : null;
    if (step === null || !(await claimTotpStep(req.q, row.id, step)))
      return refusal("totp_invalid", 401);
    const codes = Array.from({ length: RECOVERY_CODES }, () =>
      base32Encode(crypto.randomBytes(10)),
    );
    await enableTotp(
      req.q,
      row.id,
      req.now,
      codes.map((c) => keys.mac("recovery", c)),
    );
    await audit(ctx, req, {
      action: "auth.totp_confirm",
      actorKind: "admin",
      actorId: row.id,
      targetKind: "user",
      targetId: row.id,
    });
    return { status: 200, body: { recovery_codes: codes } };
  }

  /** POST /api/admin/totp/off (4.4 row 14). @param {PipelineRequest} req */
  async function off(req) {
    const row = await ownRow(req);
    if (msOf(row.totp_enabled_at) === null) throw new HttpError("totp_state");
    const sf = await secondFactor(ctx, req.q, row, req.body.code, req.now);
    if (!sf.ok) return refusal("totp_invalid", 401);
    if (sf.method === "recovery")
      await auditRecovery(ctx, req, row.id, "admin", sf.remaining ?? 0);
    await clearTotp(req.q, row.id);
    await audit(ctx, req, {
      action: "auth.totp_off",
      actorKind: "admin",
      actorId: row.id,
      targetKind: "user",
      targetId: row.id,
      details: {
        reauth_id: /** @type {string} */ (req.reauthId),
        method: sf.method,
      },
    });
    return { status: 200, body: { ok: true } };
  }

  /** GET /api/admin/audit/verify (4.4 row 15, 4.11). @param {PipelineRequest} req */
  async function verify(req) {
    const r = await verifyAudit(req.q);
    return {
      status: 200,
      body: r.ok
        ? { ok: true, count: r.count }
        : { ok: false, count: r.count, bad_id: r.badId },
    };
  }

  const row = (
    /** @type {string} */ method,
    /** @type {string} */ path,
    /** @type {string | null} */ reauth,
    /** @type {(req: PipelineRequest) => Promise<RouteAnswer>} */ handler,
    /** @type {import("../http/schema.js").Shape} */ shape,
  ) =>
    withBody(
      Object.freeze({ method, path, meta: adminMeta(reauth), handler }),
      shape,
    );

  return [
    row("POST", "/api/admin/users/:id/reset-link", "reset_link", resetLink, {}),
    row("POST", "/api/admin/totp/enrol", "totp_enrol", enrol, {}),
    row("POST", "/api/admin/totp/confirm", null, confirm, {
      code: { kind: "form", re: /^[0-9]{6}$/ },
    }),
    row("POST", "/api/admin/totp/off", "totp_off", off, {
      code: { kind: "form", re: /^(?:[0-9]{6}|[A-Za-z2-7]{16})$/ },
    }),
    row("GET", "/api/admin/audit/verify", null, verify, {}),
  ];
}
