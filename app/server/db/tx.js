import { TX_DEADLINE_MS } from "./index.js";

// Transactions under the group role (ARCH §4; the code design M2AUTH, 4.3 and 4.5.3). Every statement of the
// callback runs in one transaction on one connection, after `set local role sai_app` and the two
// set_config calls; both settings end with the transaction, so the connection answers the login role and an
// empty app.org_id afterwards. A request never nests transactions: the pipeline opens one with withPlatform
// and a tenant route switches that same transaction to tenant settings with switchToTenant. This file is the
// only place of the text that sets app.role.

/** @typedef {import("./index.js").Q} Q */

/** A lower-case uuid text (ARCH §14.2), checked before any statement. */
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SET_ROLE = "set local role sai_app";
const SETTINGS =
  "select set_config('app.org_id', $1, true), set_config('app.role', $2, true)";

/**
 * @param {unknown} value
 * @returns {value is string}
 */
const isUuid = (value) => typeof value === "string" && UUID.test(value);

/**
 * @template T
 * @param {Pick<import("./index.js").Db, "transaction">} db
 * @param {string} orgId
 * @param {string} role
 * @param {(q: Q) => Promise<T>} fn
 * @param {{ deadlineAt?: number }} opts
 * @returns {Promise<T>}
 */
function run(db, orgId, role, fn, opts) {
  return db.transaction(
    async (q) => {
      await q.query(SET_ROLE);
      await q.query(SETTINGS, [orgId, role]);
      return fn({ query: (text, params) => q.query(text, params) });
    },
    { deadlineAt: opts.deadlineAt ?? performance.now() + TX_DEADLINE_MS },
  );
}

/**
 * A tenant transaction of the organisation `orgId`. A value that is not a uuid throws before any statement.
 * @template T
 * @param {Pick<import("./index.js").Db, "transaction">} db
 * @param {string} orgId
 * @param {(q: Q) => Promise<T>} fn
 * @param {{ deadlineAt?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withTenant(db, orgId, fn, opts = {}) {
  if (!isUuid(orgId)) throw new TypeError("withTenant: orgId is not a uuid");
  return run(db, orgId, "tenant", fn, opts);
}

/**
 * A platform transaction: every row of the tenant tables is visible; the code filters by org_id itself.
 * @template T
 * @param {Pick<import("./index.js").Db, "transaction">} db
 * @param {(q: Q) => Promise<T>} fn
 * @param {{ deadlineAt?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withPlatform(db, fn, opts = {}) {
  return run(db, "", "platform", fn, opts);
}

/**
 * Switches the transaction of `q` from platform to tenant settings of `orgId` (the code design M2AUTH, 4.5.3,
 * B4): the rest of that transaction runs under them on the same connection. There is no way back to
 * platform. A value that is not a uuid throws before any statement.
 * @param {Q} q
 * @param {string} orgId
 * @returns {Promise<void>}
 */
export async function switchToTenant(q, orgId) {
  if (!isUuid(orgId))
    throw new TypeError("switchToTenant: orgId is not a uuid");
  await q.query(SETTINGS, [orgId, "tenant"]);
}
