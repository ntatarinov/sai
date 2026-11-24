import crypto from "node:crypto";
import {
  STAGES,
  canMove,
  isStage,
} from "../../public/shared/project/stages.js";
import { iso, msOf } from "../db/auth-store.js";
import {
  boardCounts,
  boardProjects,
  insertIdeaVersion,
  insertProject,
  latestQuickFacts,
  listProjectsOf,
  lockProject,
  nextVersion,
  purgeOrg,
  readAuditRows,
  readCardRow,
  readProjectRow,
  readVersions,
  setStage,
  touchProject,
} from "../db/project-store.js";
import { UUID } from "../db/tx.js";
import { HttpError } from "../http/errors.js";
import { countRequest } from "../http/rate-limit.js";
import { appendAudit } from "./audit.js";

// Projects and their idea versions (REQ-117; the code design M2PROJ, 4.5.2). Services hold the rules and never
// run a statement: every statement is a named function of db/project-store.js. The plans (`planCreate`,
// `planIdeaEdit`) run on the platform settings of the request transaction before the switch to tenant settings
// (http/plan.js); the `run…` handlers run after it, under row-level security.

/** @typedef {import("../http/auth-mw.js").AuthContext} AuthContext */
/** @typedef {import("../http/auth-mw.js").PipelineRequest} PipelineRequest */
/** @typedef {import("../db/index.js").Q} Q */
/** @typedef {import("../auth/sessions.js").Session} Session */
/** @typedef {{ status: number, body: unknown, headers?: Array<[string, string]> }} RouteAnswer */

/** The roles that write; `viewer` reads only (decisions/0127 И, 0135 О8). */
export const WRITE_ROLES = Object.freeze(["org_owner", "org_admin", "member"]);

/**
 * @param {string | null} role
 * @returns {boolean}
 */
export const canWrite = (role) => role !== null && WRITE_ROLES.includes(role);

/** The most projects the board shows per stage and the project list shows in all (C18). */
export const BOARD_LIMIT = 200;
/** The most rows an audit page holds (C18). */
export const AUDIT_PAGE = 50;

/**
 * The time column of a row as an ISO text with milliseconds.
 * @param {unknown} value
 * @returns {string}
 */
const isoOf = (value) => iso(/** @type {number} */ (msOf(value)));

/**
 * @param {AuthContext} ctx
 * @returns {import("../auth/keys.js").Keys}
 */
function keysOf(ctx) {
  if (!ctx.keys) throw new HttpError("server_config");
  return ctx.keys;
}

// Create (N12).

/**
 * The plan of `POST /api/projects`: the role, the daily limit, the new id and the audit entry.
 * @param {AuthContext} ctx
 * @param {PipelineRequest} req
 * @returns {Promise<{ audit: import("../http/plan.js").PlannedAudit, state: { id: string } }>}
 */
export async function planCreate(ctx, req) {
  const session = /** @type {Session} */ (req.session);
  if (!canWrite(session.role)) throw new HttpError("forbidden");
  // The 21st creation of one user within one fixed 24-hour window is a thrown 429: the count rolls back.
  await countRequest(
    req.q,
    keysOf(ctx).mac,
    "project",
    session.userId,
    req.now,
  );
  const id = crypto.randomUUID();
  return {
    audit: {
      action: "project.create",
      targetKind: "project",
      targetId: id,
      details: { stage: "draft" },
    },
    state: { id },
  };
}

/**
 * The handler of `POST /api/projects`, under tenant settings: the project and its version 1.
 * @param {PipelineRequest} req
 * @returns {Promise<RouteAnswer>}
 */
export async function runCreate(req) {
  const session = /** @type {Session} */ (req.session);
  const orgId = /** @type {string} */ (session.orgId);
  const { id } = /** @type {{ id: string }} */ (req.plan);
  await insertProject(req.q, {
    id,
    orgId,
    title: req.body.title,
    language: req.body.lang,
    createdBy: session.userId,
    now: req.now,
  });
  await insertIdeaVersion(req.q, {
    orgId,
    projectId: id,
    version: 1,
    text: req.body.idea,
    quickFacts: {
      what: req.body.what,
      whom: req.body.whom,
      lang: req.body.lang,
    },
    reason: null,
    createdBy: session.userId,
    now: req.now,
  });
  return { status: 201, body: { id, stage: "draft", version: 1 } };
}

// Edit the idea (N14, N9).

/**
 * The plan of `POST /api/projects/:id/idea`: the project of the session's organisation locked (a foreign or a
 * missing one is a 404, before the role), the role, the next version number.
 * @param {PipelineRequest} req
 * @returns {Promise<{ audit: import("../http/plan.js").PlannedAudit, state: { projectId: string, version: number } }>}
 */
export async function planIdeaEdit(req) {
  const session = /** @type {Session} */ (req.session);
  const id = req.params.id ?? "";
  const project = UUID.test(id)
    ? await lockProject(req.q, id, session.orgId)
    : null;
  if (!project) throw new HttpError("not_found");
  if (!canWrite(session.role)) throw new HttpError("forbidden");
  const version = await nextVersion(req.q, project.id);
  return {
    audit: {
      action: "project.idea_version",
      targetKind: "project",
      targetId: project.id,
      details: { version },
    },
    state: { projectId: project.id, version },
  };
}

/**
 * The handler of `POST /api/projects/:id/idea`, under tenant settings: the new version and the project's
 * `updated_at`; the quick facts are copied from the newest version.
 * @param {PipelineRequest} req
 * @returns {Promise<RouteAnswer>}
 */
export async function runIdeaEdit(req) {
  const session = /** @type {Session} */ (req.session);
  const orgId = /** @type {string} */ (session.orgId);
  const { projectId, version } =
    /** @type {{ projectId: string, version: number }} */ (req.plan);
  const facts = await latestQuickFacts(req.q, projectId, orgId);
  await insertIdeaVersion(req.q, {
    orgId,
    projectId,
    version,
    text: req.body.text,
    quickFacts: facts ?? {},
    reason: req.body.reason,
    createdBy: session.userId,
    now: req.now,
  });
  await touchProject(req.q, projectId, orgId, req.now);
  return { status: 200, body: { version } };
}

/**
 * The platform admin's edit of a project's idea (N9), in his platform transaction with no plan: the project is
 * locked by id alone, the version is inserted with the project's organisation, the action is audited with the
 * actor kind `admin` and the project's organisation.
 * @param {Q} q
 * @param {AuthContext} ctx
 * @param {{ adminId: string, projectId: string, text: string, reason: string, now: number, ip: string | null }} input
 * @returns {Promise<{ version: number }>}
 */
export async function adminIdeaEdit(q, ctx, input) {
  const project = UUID.test(input.projectId)
    ? await lockProject(q, input.projectId, null)
    : null;
  if (!project) throw new HttpError("not_found");
  const version = await nextVersion(q, project.id);
  const facts = await latestQuickFacts(q, project.id, project.org_id);
  await insertIdeaVersion(q, {
    orgId: project.org_id,
    projectId: project.id,
    version,
    text: input.text,
    quickFacts: facts ?? {},
    reason: input.reason,
    createdBy: input.adminId,
    now: input.now,
  });
  await touchProject(q, project.id, project.org_id, input.now);
  await appendAudit(
    q,
    {
      orgId: project.org_id,
      actorKind: "admin",
      actorId: input.adminId,
      action: "project.idea_version",
      targetKind: "project",
      targetId: project.id,
      ip: input.ip,
      details: { version },
    },
    { now: input.now, mac: keysOf(ctx).mac },
  );
  return { version };
}

// Reads (N11, N13, N7, N8, N10).

/**
 * The projects of an organisation (N11), newest update first.
 * @param {Q} q
 * @param {string} orgId
 * @returns {Promise<Array<{ id: string, title: string, stage: string, updated_at: string }>>}
 */
export async function listProjects(q, orgId) {
  const rows = await listProjectsOf(q, orgId, BOARD_LIMIT);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    stage: r.stage,
    updated_at: isoOf(r.updated_at),
  }));
}

/**
 * The project page of an organisation (N13): null for a foreign or a missing project, with no difference.
 * @param {Q} q
 * @param {string} id
 * @param {string} orgId
 */
export async function readProjectForOrg(q, id, orgId) {
  if (!UUID.test(id)) return null;
  const p = await readProjectRow(q, id, orgId);
  if (!p) return null;
  const versions = await readVersions(q, p.id, orgId);
  return {
    id: p.id,
    title: p.title,
    stage: p.stage,
    language: p.language,
    quick_facts: factsOf(versions),
    created_at: isoOf(p.created_at),
    updated_at: isoOf(p.updated_at),
    versions: versions.map((v) => ({
      version: v.version,
      text: v.text,
      reason: v.reason,
      // The platform admin is a mark, never his id or name (SEC F2).
      author: v.is_platform_admin
        ? { id: null, name: null, platform: true }
        : { id: v.created_by, name: v.display_name },
      created_at: isoOf(v.created_at),
    })),
  };
}

/**
 * The quick facts of the newest version of a project's version rows.
 * @param {Array<{ quick_facts: Record<string, string> }>} versions in version order
 * @returns {Record<string, string>}
 */
const factsOf = (versions) => versions[versions.length - 1]?.quick_facts ?? {};

/**
 * The request board (N7): per stage the true count and the newest projects. An unknown stage is a 400.
 * @param {Q} q
 * @param {string | null} stage
 */
export async function board(q, stage) {
  if (stage !== null && !isStage(stage)) throw new HttpError("bad_request");
  const counts = new Map(
    (await boardCounts(q)).map((r) => [r.stage, Number(r.n)]),
  );
  const rows = await boardProjects(q, stage, BOARD_LIMIT);
  return {
    stages: STAGES.filter((s) => stage === null || s === stage).map((s) => ({
      stage: s,
      count: counts.get(s) ?? 0,
      projects: rows
        .filter((r) => r.stage === s)
        .map((r) => ({
          id: r.id,
          title: r.title,
          org_name: r.org_name,
          updated_at: isoOf(r.updated_at),
        })),
    })),
  };
}

/**
 * The admin's card of a project (N8); null when there is no such project. The caller writes the audit row.
 * @param {Q} q
 * @param {string} id
 */
export async function card(q, id) {
  if (!UUID.test(id)) return null;
  const p = await readCardRow(q, id);
  if (!p) return null;
  const versions = await readVersions(q, p.id, p.org_id);
  return {
    orgId: p.org_id,
    card: {
      id: p.id,
      title: p.title,
      stage: p.stage,
      language: p.language,
      org: { id: p.org_id, name: p.org_name },
      quick_facts: factsOf(versions),
      created_at: isoOf(p.created_at),
      updated_at: isoOf(p.updated_at),
      versions: versions.map((v) => ({
        version: v.version,
        text: v.text,
        reason: v.reason,
        author: {
          id: v.created_by,
          name: v.display_name,
          admin: v.is_platform_admin === true,
        },
        created_at: isoOf(v.created_at),
      })),
    },
  };
}

/**
 * One page of the audit log (N10): the rows after `after` in id order, at most 50, closed columns only.
 * @param {Q} q
 * @param {string | null} after
 */
export async function auditPage(q, after) {
  if (after !== null && !/^[0-9]{1,15}$/.test(after))
    throw new HttpError("bad_request");
  const rows = await readAuditRows(q, after ?? "0", AUDIT_PAGE);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      actor_kind: r.actor_kind,
      action: r.action,
      target_kind: r.target_kind,
      target_id: r.target_id,
      created_at: isoOf(r.created_at),
      details: r.details,
    })),
    next: rows.length === AUDIT_PAGE ? rows[rows.length - 1].id : null,
  };
}

// Stages and the purge.

/**
 * The only place that changes a stage: refuses unless `canMove` of the stage table allows the pair, sets the
 * stage and `updated_at`, audits `project.stage`. No route of M2 calls it (the first moves are M3).
 * @param {Q} q
 * @param {AuthContext} ctx
 * @param {{ projectId: string, orgId: string, to: string, actor: { kind: "user" | "admin", id: string }, now: number, ip?: string | null }} input
 * @returns {Promise<void>}
 */
export async function moveStage(q, ctx, input) {
  const project = UUID.test(input.projectId)
    ? await lockProject(q, input.projectId, input.orgId)
    : null;
  if (!project) throw new HttpError("not_found");
  if (!canMove(project.stage, input.to)) throw new HttpError("forbidden");
  await setStage(q, project.id, input.orgId, input.to, input.now);
  await appendAudit(
    q,
    {
      orgId: input.orgId,
      actorKind: input.actor.kind,
      actorId: input.actor.id,
      action: "project.stage",
      targetKind: "project",
      targetId: project.id,
      ip: input.ip ?? null,
      details: { stage: input.to },
    },
    { now: input.now, mac: keysOf(ctx).mac },
  );
}

/**
 * The purge helper of REQ-117 criterion 9: the projects and idea versions of an organisation with no member
 * left. Nothing else deletes idea versions.
 * @param {Q} q
 * @param {string} orgId
 * @returns {Promise<{ versions: number, projects: number }>}
 */
export const purgeOrgProjects = (q, orgId) => purgeOrg(q, orgId);
