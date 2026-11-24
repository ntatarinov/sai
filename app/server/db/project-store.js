import { currentAppRole } from "./audit-store.js";
import { iso } from "./auth-store.js";

// Every statement of the project services (REQ-117; the code design M2PROJ, 4.6 and question О1): named
// functions that take the query `q` of the caller's transaction and parameters. Every text is a constant with
// bound parameters (Q9); every time is a parameter from the app's clock, never now(). This file is the only place
// that changes a project's row after its insert and the only place that deletes idea versions (the purge): the
// statements stand here and the services in services/projects.js hold the rules (DBC-1). The functions of a
// tenant route's handler run under tenant settings and still carry the organisation (two walls, C2); the ones
// of a plan or an admin route run under platform settings and filter by the organisation they are given.

/** @typedef {import("./index.js").Q} Q */

/**
 * @param {Q} q
 * @param {{ id: string, orgId: string, title: string, language: string, createdBy: string, now: number }} p
 */
export async function insertProject(q, p) {
  await q.query(
    "insert into projects (id, org_id, title, language, stage, created_by, created_at, updated_at) values ($1, $2, $3, $4, 'draft', $5, $6::timestamptz, $6::timestamptz)",
    [p.id, p.orgId, p.title, p.language, p.createdBy, iso(p.now)],
  );
}

/**
 * @param {Q} q
 * @param {{ orgId: string, projectId: string, version: number, text: string, quickFacts: Record<string, string>, reason: string | null, createdBy: string, now: number }} v
 */
export async function insertIdeaVersion(q, v) {
  await q.query(
    "insert into idea_versions (org_id, project_id, version, text, quick_facts, reason, created_by, created_at) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz)",
    [
      v.orgId,
      v.projectId,
      v.version,
      v.text,
      JSON.stringify(v.quickFacts),
      v.reason,
      v.createdBy,
      iso(v.now),
    ],
  );
}

/**
 * The project row under a lock (`for update`), by id and, when `orgId` is given, by organisation: a project of
 * another organisation answers null exactly as a missing one. `orgId` null is the platform admin's read.
 * @param {Q} q
 * @param {string} id
 * @param {string | null} orgId
 * @returns {Promise<{ id: string, org_id: string, stage: string } | null>}
 */
export async function lockProject(q, id, orgId) {
  const r = await q.query(
    "select id, org_id, stage from projects where id = $1 and ($2::uuid is null or org_id = $2::uuid) for update",
    [id, orgId],
  );
  return r.rows[0] ?? null;
}

/**
 * The next version number of a project (the plan holds the project row lock).
 * @param {Q} q
 * @param {string} projectId
 * @returns {Promise<number>}
 */
export async function nextVersion(q, projectId) {
  const r = await q.query(
    "select coalesce(max(version), 0) + 1 as next from idea_versions where project_id = $1",
    [projectId],
  );
  return Number(r.rows[0].next);
}

/**
 * @param {Q} q
 * @param {string} id
 * @param {string} orgId
 * @param {number} now
 */
export async function touchProject(q, id, orgId, now) {
  await q.query(
    "update projects set updated_at = $3::timestamptz where id = $1 and org_id = $2",
    [id, orgId, iso(now)],
  );
}

/**
 * The one statement that changes a stage.
 * @param {Q} q
 * @param {string} id
 * @param {string} orgId
 * @param {string} stage
 * @param {number} now
 * @returns {Promise<boolean>} whether the row was there
 */
export async function setStage(q, id, orgId, stage, now) {
  const r = await q.query(
    "update projects set stage = $3, updated_at = $4::timestamptz where id = $1 and org_id = $2 returning id",
    [id, orgId, stage, iso(now)],
  );
  return r.rows.length === 1;
}

/**
 * The quick facts of the newest version.
 * @param {Q} q
 * @param {string} projectId
 * @param {string} orgId
 * @returns {Promise<Record<string, string> | null>}
 */
export async function latestQuickFacts(q, projectId, orgId) {
  const r = await q.query(
    "select quick_facts from idea_versions where project_id = $1 and org_id = $2 order by version desc limit 1",
    [projectId, orgId],
  );
  return r.rows[0]?.quick_facts ?? null;
}

/**
 * The projects of an organisation, newest update first.
 * @param {Q} q
 * @param {string} orgId
 * @param {number} limit
 * @returns {Promise<Array<{ id: string, title: string, stage: string, updated_at: unknown }>>}
 */
export async function listProjectsOf(q, orgId, limit) {
  const r = await q.query(
    "select id, title, stage, updated_at from projects where org_id = $1 order by updated_at desc, id limit $2",
    [orgId, limit],
  );
  return r.rows;
}

/**
 * One project of an organisation.
 * @param {Q} q
 * @param {string} id
 * @param {string} orgId
 * @returns {Promise<{ id: string, title: string, stage: string, language: string, created_at: unknown, updated_at: unknown } | null>}
 */
export async function readProjectRow(q, id, orgId) {
  const r = await q.query(
    "select id, title, stage, language, created_at, updated_at from projects where id = $1 and org_id = $2",
    [id, orgId],
  );
  return r.rows[0] ?? null;
}

/**
 * The versions of a project in order, with the author's name and platform-admin flag.
 * @param {Q} q
 * @param {string} projectId
 * @param {string} orgId
 * @returns {Promise<Array<{ version: number, text: string, reason: string | null, quick_facts: Record<string, string>, created_at: unknown, created_by: string, display_name: string, is_platform_admin: boolean }>>}
 */
export async function readVersions(q, projectId, orgId) {
  const r = await q.query(
    "select v.version, v.text, v.reason, v.quick_facts, v.created_at, v.created_by, u.display_name, u.is_platform_admin from idea_versions v join users u on u.id = v.created_by where v.project_id = $1 and v.org_id = $2 order by v.version",
    [projectId, orgId],
  );
  return r.rows;
}

/**
 * The true count of projects per stage.
 * @param {Q} q
 * @returns {Promise<Array<{ stage: string, n: number }>>}
 */
export async function boardCounts(q) {
  const r = await q.query(
    "select stage, count(*)::int as n from projects group by stage",
  );
  return r.rows;
}

/**
 * The newest `limit` projects of each stage (of one stage when `stage` is given), with the organisation's name.
 * @param {Q} q
 * @param {string | null} stage
 * @param {number} limit
 * @returns {Promise<Array<{ id: string, title: string, stage: string, org_name: string, updated_at: unknown }>>}
 */
export async function boardProjects(q, stage, limit) {
  const r = await q.query(
    "select id, title, stage, org_name, updated_at from (select p.id, p.title, p.stage, p.updated_at, o.name as org_name, row_number() over (partition by p.stage order by p.updated_at desc, p.id) as rn from projects p join orgs o on o.id = p.org_id where ($1::text is null or p.stage = $1::text)) t where rn <= $2 order by stage, rn",
    [stage, limit],
  );
  return r.rows;
}

/**
 * The project of the admin's card, with its organisation's name.
 * @param {Q} q
 * @param {string} id
 * @returns {Promise<{ id: string, org_id: string, org_name: string, title: string, stage: string, language: string, created_at: unknown, updated_at: unknown } | null>}
 */
export async function readCardRow(q, id) {
  const r = await q.query(
    "select p.id, p.org_id, o.name as org_name, p.title, p.stage, p.language, p.created_at, p.updated_at from projects p join orgs o on o.id = p.org_id where p.id = $1",
    [id],
  );
  return r.rows[0] ?? null;
}

/**
 * One page of the audit log in id order after `after` (decimal text): the closed columns only, never the
 * address code, the organisation or a hash. The order names the table's own column: a bare `id` would be the
 * text output column and sort as text.
 * @param {Q} q
 * @param {string} after
 * @param {number} limit
 * @returns {Promise<Array<{ id: string, actor_kind: string, action: string, target_kind: string | null, target_id: string | null, created_at: unknown, details: Record<string, unknown> }>>}
 */
export async function readAuditRows(q, after, limit) {
  const r = await q.query(
    "select id::text as id, actor_kind, action, target_kind, target_id, created_at, details from audit_log where id > $1::bigint order by audit_log.id limit $2",
    [after, limit],
  );
  return r.rows;
}

/**
 * The purge of an organisation's projects (REQ-117 criterion 9): the one place that deletes idea versions. It
 * refuses unless the transaction is under platform settings (no statement runs) and refuses the organisation of
 * kind owner (a read only, no delete), sets the transaction-local
 * setting that the insert-only trigger of idea_versions reads, deletes the organisation's versions, clears the
 * setting, then deletes its projects.
 * @param {Q} q
 * @param {string} orgId
 * @returns {Promise<{ versions: number, projects: number }>}
 */
export async function purgeOrg(q, orgId) {
  if ((await currentAppRole(q)) !== "platform")
    throw new TypeError("purge: only under platform settings");
  // The owner organisation is never purged (SEC F4): refused before any delete.
  const org = await q.query("select kind from orgs where id = $1", [orgId]);
  if (org.rows[0]?.kind === "owner")
    throw new TypeError("purge: the owner organisation is never purged");
  await q.query("select set_config('app.purge_org', $1, true)", [orgId]);
  const v = await q.query(
    "delete from idea_versions where org_id = $1 returning id",
    [orgId],
  );
  await q.query("select set_config('app.purge_org', '', true)");
  const p = await q.query(
    "delete from projects where org_id = $1 returning id",
    [orgId],
  );
  return { versions: v.rows.length, projects: p.rows.length };
}
