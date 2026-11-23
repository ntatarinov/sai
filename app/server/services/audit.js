import { createHash } from "node:crypto";
import {
  insertAudit,
  lastAuditHash,
  lockChain,
  nextAuditId,
  readAuditPage,
} from "../db/audit-store.js";
import { UUID } from "../db/tx.js";
import { PURPOSES } from "../auth/reauth.js";

// The one audit writer (ARCH §14.5; REQ-115 criterion 10; the code design M2AUTH, 4.11): one row per event, in
// the caller's platform transaction, so the action and its row commit together. Under the advisory lock of
// the chain it takes the next id, reads the last hash and stores hash = sha256(prev_hash + canonical(row)).
// Only closed actions and closed details keys: no e-mail, name, address or token ever enters a row; the
// address enters only as its HMAC.

/** @typedef {import("../db/index.js").Q} Q */

export const ACTIONS = Object.freeze([
  "auth.setup",
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "auth.password_change",
  "auth.reauth",
  "auth.reauth_failed",
  "auth.reset_link_issued",
  "auth.reset_used",
  "auth.reset_failed",
  "auth.totp_enrol",
  "auth.totp_confirm",
  "auth.totp_recovery_used",
  "auth.totp_off",
]);

const ACTOR_KINDS = Object.freeze(["user", "admin", "worker", "system"]);

const REASONS = Object.freeze([
  "unknown_email",
  "wrong_password",
  "locked",
  "delay",
  "totp_missing",
  "totp_wrong",
  "disabled",
  "expired",
]);

const METHODS = Object.freeze(["password", "totp", "recovery"]);

/** @type {Readonly<Record<string, (v: unknown) => boolean>>} */
const DETAILS = Object.freeze({
  purpose: (v) => typeof v === "string" && PURPOSES.includes(v), // the re-auth table, 4.9.4
  reason: (v) => typeof v === "string" && REASONS.includes(v),
  method: (v) => typeof v === "string" && METHODS.includes(v),
  remaining: (v) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 10,
  reauth_id: (v) => typeof v === "string" && UUID.test(v),
  session_id: (v) => typeof v === "string" && UUID.test(v),
});

export const ZERO_HASH = "0".repeat(64);
const PAGE = 1000;

/**
 * JSON with object keys sorted by UTF-16 code units at every level and no white space.
 * @param {unknown} value
 * @returns {string}
 */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = /** @type {Record<string, unknown>} */ (value);
    const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * The hash of a row: sha256 hex of prev_hash followed by the canonical form of every column but the hash.
 * @param {Omit<import("../db/audit-store.js").AuditRow, "hash">} row
 * @returns {string}
 */
export function rowHash(row) {
  const body = canonical({
    id: row.id,
    org_id: row.org_id,
    actor_kind: row.actor_kind,
    actor_id: row.actor_id,
    action: row.action,
    target_kind: row.target_kind,
    target_id: row.target_id,
    ip_hmac: row.ip_hmac,
    details: row.details,
    prev_hash: row.prev_hash,
    created_at: row.created_at,
  });
  return createHash("sha256")
    .update(row.prev_hash + body, "utf8")
    .digest("hex");
}

/**
 * @typedef {object} AuditEntry
 * @property {string | null} orgId
 * @property {"user" | "admin" | "worker" | "system"} actorKind
 * @property {string | null} actorId
 * @property {string} action one of ACTIONS
 * @property {string | null} targetKind
 * @property {string | null} targetId
 * @property {string | null} ip the normalised client address, or null; stored only as its HMAC
 * @property {Record<string, unknown>} details closed keys only
 */

/**
 * Checks the entry before any statement; a wrong action, actor or details key throws TypeError.
 * @param {AuditEntry} entry
 */
function check(entry) {
  if (!ACTIONS.includes(entry.action))
    throw new TypeError("audit: an unknown action");
  if (!ACTOR_KINDS.includes(entry.actorKind))
    throw new TypeError("audit: an unknown actor kind");
  for (const id of [entry.orgId, entry.actorId])
    if (id !== null && !(typeof id === "string" && UUID.test(id)))
      throw new TypeError("audit: an id that is not a uuid");
  if (entry.targetKind !== null && typeof entry.targetKind !== "string")
    throw new TypeError("audit: a target kind that is not a text");
  if (
    entry.targetId !== null &&
    !(typeof entry.targetId === "string" && entry.targetId.length <= 64)
  )
    throw new TypeError("audit: a target id that is not a short text");
  const details = entry.details;
  if (details === null || typeof details !== "object" || Array.isArray(details))
    throw new TypeError("audit: details that are not an object");
  for (const [k, v] of Object.entries(details)) {
    const rule = Object.hasOwn(DETAILS, k) ? DETAILS[k] : null;
    if (!rule || !rule(v))
      throw new TypeError("audit: a details key outside the list");
  }
}

/**
 * Appends one row to the chain in the caller's platform transaction.
 * @param {Q} q
 * @param {AuditEntry} entry
 * @param {{ now: number, mac: (label: string, text: string) => string }} ctx the clock time and the HMAC of keys.js
 * @returns {Promise<string>} the id of the row
 */
export async function appendAudit(q, entry, ctx) {
  check(entry);
  await lockChain(q);
  const id = await nextAuditId(q);
  const prev = (await lastAuditHash(q)) ?? ZERO_HASH;
  /** @type {Omit<import("../db/audit-store.js").AuditRow, "hash">} */
  const row = {
    id,
    org_id: entry.orgId,
    actor_kind: entry.actorKind,
    actor_id: entry.actorId,
    action: entry.action,
    target_kind: entry.targetKind,
    target_id: entry.targetId,
    ip_hmac: entry.ip === null ? null : ctx.mac("ip", entry.ip),
    details: entry.details,
    prev_hash: prev,
    created_at: new Date(ctx.now).toISOString(),
  };
  await insertAudit(q, { ...row, hash: rowHash(row) });
  return id;
}

/**
 * Recomputes the chain in id order (ids may have gaps: a rolled-back writer took a number).
 * @param {Q} q
 * @returns {Promise<{ ok: boolean, count: number, badId?: string }>}
 */
export async function verifyAudit(q) {
  let prev = ZERO_HASH;
  let after = "0";
  let count = 0;
  for (;;) {
    const rows = await readAuditPage(q, after, PAGE);
    for (const r of rows) {
      count += 1;
      const created = new Date(
        /** @type {string | number | Date} */ (r.created_at),
      ).toISOString();
      const want = rowHash({ ...r, created_at: created });
      if (r.prev_hash !== prev || r.hash !== want)
        return { ok: false, count, badId: r.id };
      prev = r.hash;
      after = r.id;
    }
    if (rows.length < PAGE) return { ok: true, count };
  }
}
