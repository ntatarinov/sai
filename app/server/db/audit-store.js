// The statements of the audit writer and of its verify (REQ-115 criterion 10; the code design M2AUTH, 4.11).
// This file is the only place of the insert into audit_log. The query `q` is that of a platform transaction:
// the SELECT policy of audit_log gives rows to app.role 'platform' only.

/** @typedef {import("./index.js").Q} Q */

/** The advisory lock of the chain: one writer at a time reads the last hash and appends. */
export const AUDIT_LOCK_KEY = 7300115;

/**
 * The app.role of the caller's transaction ('' when none is set): the writer refuses anything but
 * 'platform', because the chain's last hash is visible to platform settings only (decisions/0137 Addition 4).
 * @param {Q} q
 * @returns {Promise<string>}
 */
export async function currentAppRole(q) {
  const r = await q.query(
    "select coalesce(current_setting('app.role', true), '') as role",
  );
  return String(r.rows[0]?.role ?? "");
}

/**
 * @param {Q} q
 */
export async function lockChain(q) {
  await q.query("select pg_advisory_xact_lock($1::bigint)", [AUDIT_LOCK_KEY]);
}

/**
 * @param {Q} q
 * @returns {Promise<string>} the next id as decimal text
 */
export async function nextAuditId(q) {
  const r = await q.query("select nextval('audit_log_id_seq')::text as id");
  return String(r.rows[0].id);
}

/**
 * @param {Q} q
 * @returns {Promise<string | null>} the hash of the newest row
 */
export async function lastAuditHash(q) {
  const r = await q.query(
    "select hash from audit_log order by id desc limit 1",
  );
  return r.rows[0]?.hash ?? null;
}

/**
 * @typedef {object} AuditRow
 * @property {string} id
 * @property {string | null} org_id
 * @property {string} actor_kind
 * @property {string | null} actor_id
 * @property {string} action
 * @property {string | null} target_kind
 * @property {string | null} target_id
 * @property {string | null} ip_hmac
 * @property {Record<string, unknown>} details
 * @property {string} prev_hash
 * @property {string} hash
 * @property {string} created_at ISO text with milliseconds
 */

/**
 * @param {Q} q
 * @param {AuditRow} row
 */
export async function insertAudit(q, row) {
  await q.query(
    "insert into audit_log (id, org_id, actor_kind, actor_id, action, target_kind, target_id, ip_hmac, details, prev_hash, hash, created_at) values ($1::bigint, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::timestamptz)",
    [
      row.id,
      row.org_id,
      row.actor_kind,
      row.actor_id,
      row.action,
      row.target_kind,
      row.target_id,
      row.ip_hmac,
      JSON.stringify(row.details),
      row.prev_hash,
      row.hash,
      row.created_at,
    ],
  );
}

/**
 * One page of rows in id order after `afterId` (decimal text; "0" for the first page).
 * @param {Q} q
 * @param {string} afterId
 * @param {number} limit
 * @returns {Promise<Array<Omit<AuditRow, "created_at"> & { created_at: unknown }>>}
 */
export async function readAuditPage(q, afterId, limit) {
  const r = await q.query(
    "select id::text as id, org_id, actor_kind, actor_id, action, target_kind, target_id, ip_hmac, details, prev_hash, hash, created_at from audit_log where id > $1::bigint order by audit_log.id limit $2",
    [afterId, limit],
  );
  return r.rows;
}
