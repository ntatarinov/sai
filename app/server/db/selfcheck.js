// The role selfcheck (ARCH §4, decisions/0116 О17): the login role of the runtime connection must have
// rolsuper and rolbypassrls false. One statement; the same text on Postgres and on PGlite.
//
// The statement reads every role the session user is a member of, itself included, and folds them into
// one reading: a role it can become with `set role` counts as its own. 0001 keeps a role that already
// exists as it is and grants sai_app and sai_preview to sai_app_login, and the tenant statements of M2 run
// under `set local role sai_app` (ARCH §4), so a sai_app with BYPASSRLS or SUPERUSER, made before 0001 or
// changed after it, must refuse the connection too. No row (never the case: a role is a member of itself)
// reads as unsafe.
export const SELFCHECK_SQL =
  "select coalesce(bool_or(rolsuper), true) as rolsuper, coalesce(bool_or(rolbypassrls), true) as rolbypassrls from pg_roles where pg_has_role(session_user, oid, 'MEMBER')";

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
