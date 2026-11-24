import { HttpError } from "../http/errors.js";
import { withBody } from "../http/schema.js";
import { adminIdeaEdit, auditPage, board, card } from "../services/projects.js";
import { audit } from "./auth.js";

// The admin routes of the request board, the card and the audit page (REQ-117; the code design M2PROJ, 4.3 rows
// N7-N10). Only the platform admin reaches them: everyone else gets the uniform 404 before any other check
// (meta.admin). They run on the platform settings of the request transaction and filter by the project they are
// given; none is a tenant route.

/** @typedef {import("../http/auth-mw.js").AuthContext} AuthContext */
/** @typedef {import("../http/auth-mw.js").PipelineRequest} PipelineRequest */
/** @typedef {import("../auth/sessions.js").Session} Session */

const ADMIN_META = Object.freeze({
  tenant: false,
  admin: true,
  reauth: null,
  worker: false,
  session: true,
  rateLimit: /** @type {"user"} */ ("user"),
});

/**
 * @param {AuthContext} ctx
 */
export function adminProjectRoutes(ctx) {
  /** GET /api/admin/requests (N7). @param {PipelineRequest} req */
  async function requests(req) {
    return {
      status: 200,
      body: await board(req.q, req.query.get("stage")),
    };
  }

  /** GET /api/admin/projects/:id (N8): one `admin_read` audit row per call, none for a miss. @param {PipelineRequest} req */
  async function read(req) {
    const session = /** @type {Session} */ (req.session);
    const found = await card(req.q, req.params.id ?? "");
    if (!found) throw new HttpError("not_found");
    await audit(ctx, req, {
      action: "admin_read",
      actorKind: "admin",
      actorId: session.userId,
      orgId: found.orgId,
      targetKind: "project",
      targetId: found.card.id,
    });
    return { status: 200, body: found.card };
  }

  /** POST /api/admin/projects/:id/idea (N9). @param {PipelineRequest} req */
  async function edit(req) {
    const session = /** @type {Session} */ (req.session);
    const r = await adminIdeaEdit(req.q, ctx, {
      adminId: session.userId,
      projectId: req.params.id ?? "",
      text: req.body.text,
      reason: req.body.reason,
      now: req.now,
      ip: req.clientIp,
    });
    return { status: 200, body: { version: r.version } };
  }

  /** GET /api/admin/audit (N10). @param {PipelineRequest} req */
  async function auditRows(req) {
    return {
      status: 200,
      body: await auditPage(req.q, req.query.get("after")),
    };
  }

  return [
    withBody(
      Object.freeze({
        method: "GET",
        path: "/api/admin/requests",
        meta: ADMIN_META,
        handler: requests,
      }),
      {},
    ),
    withBody(
      Object.freeze({
        method: "GET",
        path: "/api/admin/projects/:id",
        meta: ADMIN_META,
        handler: read,
      }),
      {},
    ),
    withBody(
      Object.freeze({
        method: "POST",
        path: "/api/admin/projects/:id/idea",
        meta: ADMIN_META,
        handler: edit,
      }),
      {
        text: { kind: "text", min: 1, max: 8000 },
        reason: { kind: "text", min: 1, max: 2000 },
      },
    ),
    withBody(
      Object.freeze({
        method: "GET",
        path: "/api/admin/audit",
        meta: ADMIN_META,
        handler: auditRows,
      }),
      {},
    ),
  ];
}
