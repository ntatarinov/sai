import { withBody } from "../http/schema.js";
import { acceptInvite, viewInvite } from "../services/orgs.js";

// The two public invitation routes (REQ-116; the code design M2PROJ, 4.3 rows N1 and N2). Their `session` is true
// although the holder of a code usually has none: they take the request pipeline (a transaction, the deadline, the
// rate limit), which the non-pipeline path cannot give them (C20). An unknown, expired or used code and a wrong
// e-mail all answer the same 404 `not_found`; a refusal that depends on the state of the database is returned, so
// the rate count of the address commits with it.

/** @typedef {import("../http/auth-mw.js").AuthContext} AuthContext */
/** @typedef {import("../http/auth-mw.js").PipelineRequest} PipelineRequest */
/** @typedef {{ status: number, body: unknown, headers?: Array<[string, string]> }} RouteAnswer */

/** @param {"invite" | "invite_view"} rateLimit */
const inviteMeta = (rateLimit) =>
  Object.freeze({
    tenant: false,
    admin: false,
    reauth: null,
    worker: false,
    session: true,
    rateLimit,
  });

/**
 * @param {AuthContext} ctx
 */
export function inviteRoutes(ctx) {
  /** GET /api/invites/:code (N1). @param {PipelineRequest} req */
  async function view(req) {
    const v = await viewInvite(req.q, ctx, req.params.code ?? "", req.now);
    if (v === null) return { status: 404, body: { error: "not_found" } };
    return {
      status: 200,
      body: { org: v.org, role: v.role, consent_langs: v.consentLangs },
    };
  }

  /** POST /api/invites/:code/accept (N2). @param {PipelineRequest} req */
  async function accept(req) {
    return acceptInvite(req.q, ctx, {
      body: req.body,
      code: req.params.code ?? "",
      now: req.now,
      clientIp: req.clientIp,
      oldSessionId: req.session?.id ?? null,
    });
  }

  return [
    withBody(
      Object.freeze({
        method: "GET",
        path: "/api/invites/:code",
        meta: inviteMeta("invite_view"),
        handler: view,
      }),
      {},
    ),
    withBody(
      Object.freeze({
        method: "POST",
        path: "/api/invites/:code/accept",
        meta: inviteMeta("invite"),
        handler: accept,
      }),
      {
        name: { kind: "text", min: 1, max: 80 },
        email: { kind: "email" },
        password: { kind: "text", max: 1024 },
        consent: { kind: "bool" },
        consent_sha256: { kind: "form", re: /^[0-9a-f]{64}$/ },
        consent_lang: { kind: "enum", values: ["ru", "kk", "en"] },
      },
    ),
  ];
}
