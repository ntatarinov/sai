// The role selfcheck (ARCH §4, decisions/0116 О17): the login role of the runtime connection must have
// rolsuper and rolbypassrls false. One statement; the same text on Postgres and on PGlite.
//
// The statement reads every role the session user is a member of, itself included, and folds them into
// one reading: a role it can become with `set role` counts as its own. 0001 keeps a role that already
// exists as it is and grants sai_app and sai_preview to sai_app_login, and the tenant statements of M2 run
// under `set local role sai_app` (ARCH §4), so a sai_app with BYPASSRLS or SUPERUSER, made before 0001 or
// changed after it, must refuse the connection too. No row (never the case: a role is a member of itself)
// reads as unsafe.
//
// A table owner can switch row security off for its table, so a role that owns (or is a member of a role
// that owns) a relation of the public schema reads as bypassing row security too (REQ-115 criterion 5; the
// code design M2AUTH, 4.6): the statement keeps its two columns and folds the ownership into rolbypassrls.
export const SELFCHECK_SQL =
  "select coalesce(bool_or(r.rolsuper), true) as rolsuper, coalesce(bool_or(r.rolbypassrls), true) or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f') and pg_has_role(session_user, c.relowner, 'MEMBER')) as rolbypassrls from pg_roles r where pg_has_role(session_user, r.oid, 'MEMBER')";

/** @typedef {{ rolsuper: unknown, rolbypassrls: unknown }} RoleReading */

/**
 * @param {RoleReading | undefined} row
 * @returns {"ok" | "unsafe"}
 */
export function judgeRole(row) {
  if (!row) return "unsafe";
  return row.rolsuper === false && row.rolbypassrls === false ? "ok" : "unsafe";
}

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} adapter
 * @returns {Promise<"ok" | "unsafe">}
 */
export async function runSelfcheck(adapter) {
  const r = await adapter.query(SELFCHECK_SQL);
  return judgeRole(r.rows[0]);
}
