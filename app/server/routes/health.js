import { DbError } from "../db/index.js";

// GET /api/health (ARCH §13, decisions/0116 О5): exactly ok, db, role, migrations_pending, version, node.

export const HEALTH_DEADLINE_MS = 4000;

/**
 * @template T
 * @param {Promise<T>} work
 * @param {number} ms
 * @returns {Promise<T>}
 */
function within(work, ms) {
  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new DbError("E_DB_DOWN")), ms);
  });
  return /** @type {Promise<T>} */ (Promise.race([work, late])).finally(() =>
    clearTimeout(timer),
  );
}

/**
 * @param {{ db: import("../db/index.js").Db | null, migrations: ReadonlyArray<{ name: string, sha256: string }>, version: string, deadlineMs?: number }} deps
 */
export function healthHandler({
  db,
  migrations,
  version,
  deadlineMs = HEALTH_DEADLINE_MS,
}) {
  return async () => {
    /** @type {{ ok: boolean, db: "ok" | "down", role: "ok" | "unsafe" | "unknown", migrations_pending: number | null, version: string, node: string }} */
    const body = {
      ok: false,
      db: "down",
      role: "unknown",
      migrations_pending: null,
      version,
      node: process.version,
    };
    if (db) {
      try {
        const r = await within(
          db.query("select name, sha256 from schema_migrations"),
          deadlineMs,
        );
        const applied = new Map(r.rows.map((row) => [row.name, row.sha256]));
        body.db = "ok";
        body.role = "ok";
        body.migrations_pending = migrations.filter(
          (m) => applied.get(m.name) !== m.sha256,
        ).length;
        body.ok = body.migrations_pending === 0;
      } catch (err) {
        if (err instanceof DbError && err.code === "E_DB_ROLE") {
          body.db = "ok";
          body.role = "unsafe";
        } else if (err instanceof DbError && err.code === "E_DB_QUERY") {
          body.db = "ok";
          body.role = db.roleState() === "ok" ? "ok" : "unknown";
        }
      }
    }
    return { status: body.ok ? 200 : 503, body };
  };
}
