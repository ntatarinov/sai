// The plan of a tenant route that writes (REQ-117; the code design M2PROJ, C1 and 4.4; decisions/0138 C1). The
// audit writer runs only under platform settings, while a tenant route's handler runs under tenant settings, so
// the route's plan runs first, on the platform part of the request transaction: it reads and locks what it needs
// with an explicit organisation filter, checks the role, decides the facts the audit row needs and returns the
// audit entry. The pipeline (step 9a of http/auth-mw.js) appends that entry and only then switches to tenant
// settings and runs the handler. The plan is kept beside its route row in a WeakMap, like the body shape of
// http/schema.js, so a row keeps exactly the keys method, path, meta and handler.

/**
 * What a plan wants audited: exactly these four keys. The organisation, the actor and the address of the row
 * are taken from the session and the request by the pipeline, never from the plan.
 * @typedef {object} PlannedAudit
 * @property {string} action
 * @property {string | null} targetKind
 * @property {string | null} targetId
 * @property {Record<string, unknown>} details
 */

/**
 * @typedef {(req: import("./auth-mw.js").PipelineRequest) => Promise<{ audit: PlannedAudit | null, state: unknown }>} Plan
 */

/** The four keys of a planned audit entry, and no other. */
export const PLANNED_AUDIT_KEYS = Object.freeze([
  "action",
  "targetKind",
  "targetId",
  "details",
]);

/** @type {WeakMap<object, Plan>} */
const PLANS = new WeakMap();

/**
 * Keeps the plan beside the row. A plan belongs to a tenant route only: any other row throws a TypeError at
 * table build.
 * @template {{ meta: { tenant: boolean } }} R
 * @param {R} row
 * @param {Plan} plan
 * @returns {R}
 */
export function withPlan(row, plan) {
  if (row.meta.tenant !== true)
    throw new TypeError("withPlan: a plan belongs to a tenant route only");
  if (typeof plan !== "function")
    throw new TypeError("withPlan: the plan is not a function");
  PLANS.set(row, plan);
  return row;
}

/**
 * The plan of a row, or undefined.
 * @param {object} row
 * @returns {Plan | undefined}
 */
export const planOf = (row) => PLANS.get(row);
