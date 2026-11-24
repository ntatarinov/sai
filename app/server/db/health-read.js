// The one read of GET /api/health (REQ-115 criterion 4; the code design M2AUTH, 4.5.4): the applied
// migrations, one statement through the runtime database, no transaction. It stands under app/server/db/,
// the one place of database calls.

export const HEALTH_SQL = "select name, sha256 from schema_migrations";

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} db
 * @returns {Promise<{ rows: Array<{ name: string, sha256: string }> }>}
 */
export function readAppliedMigrations(db) {
  return db.query(HEALTH_SQL);
}
