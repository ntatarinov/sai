import { OPTIONS } from "../../public/shared/project/quick-facts.js";
import { HttpError } from "../http/errors.js";
import { withPlan } from "../http/plan.js";
import { withBody } from "../http/schema.js";
import {
  listProjects,
  planCreate,
  planIdeaEdit,
  readProjectForOrg,
  runCreate,
  runIdeaEdit,
} from "../services/projects.js";

// The tenant routes of the projects (REQ-117; the code design M2PROJ, 4.3 rows N11-N14): the list, the creation,
// the project page and the idea edit of the session's own organisation. The two writes have a plan (http/plan.js):
// the pipeline runs it on the platform settings of the request transaction, appends the audit row it returns, then
// switches to tenant settings and runs the handler, so the audit row commits with the action. The organisation is
// the session's, never a body key (IS-4).

/** @typedef {import("../http/auth-mw.js").AuthContext} AuthContext */
/** @typedef {import("../http/auth-mw.js").PipelineRequest} PipelineRequest */
/** @typedef {import("../auth/sessions.js").Session} Session */

const TENANT_META = Object.freeze({
  tenant: true,
  admin: false,
  reauth: null,
  worker: false,
  session: true,
  rateLimit: /** @type {"user"} */ ("user"),
});

/**
 * @param {AuthContext} ctx
 */
export function projectRoutes(ctx) {
  /** GET /api/projects (N11). @param {PipelineRequest} req */
  async function list(req) {
    const session = /** @type {Session} */ (req.session);
    return {
      status: 200,
      body: {
        projects: await listProjects(
          req.q,
          /** @type {string} */ (session.orgId),
        ),
      },
    };
  }

  /** GET /api/projects/:id (N13). @param {PipelineRequest} req */
  async function read(req) {
    const session = /** @type {Session} */ (req.session);
    const project = await readProjectForOrg(
      req.q,
      req.params.id ?? "",
      /** @type {string} */ (session.orgId),
    );
    if (!project) throw new HttpError("not_found");
    return { status: 200, body: project };
  }

  return [
    withBody(
      Object.freeze({
        method: "GET",
        path: "/api/projects",
        meta: TENANT_META,
        handler: list,
      }),
      {},
    ),
    withPlan(
      withBody(
        Object.freeze({
          method: "POST",
          path: "/api/projects",
          meta: TENANT_META,
          handler: runCreate,
        }),
        {
          title: { kind: "text", min: 1, max: 120 },
          idea: { kind: "text", min: 1, max: 8000 },
          what: { kind: "enum", values: OPTIONS.what },
          whom: { kind: "enum", values: OPTIONS.whom },
          lang: { kind: "enum", values: OPTIONS.lang },
        },
      ),
      (req) => planCreate(ctx, req),
    ),
    withBody(
      Object.freeze({
        method: "GET",
        path: "/api/projects/:id",
        meta: TENANT_META,
        handler: read,
      }),
      {},
    ),
    withPlan(
      withBody(
        Object.freeze({
          method: "POST",
          path: "/api/projects/:id/idea",
          meta: TENANT_META,
          handler: runIdeaEdit,
        }),
        {
          text: { kind: "text", min: 1, max: 8000 },
          reason: { kind: "text", min: 1, max: 2000 },
        },
      ),
      planIdeaEdit,
    ),
  ];
}
