import { PGlite } from "@electric-sql/pglite";
import { toDbError } from "./index.js";

// The PGlite adapter (the only importer of PGlite, ARCH §2.2): the local and test database outside
// production (decisions/0116 О10). PGlite starts as the superuser «postgres»; after the migrations
// switchToLoginRole() makes sai_app_login the session user, so the selfcheck reads the same columns as
// on Postgres. The switch is used only here, never with a DATABASE_URL.

/**
 * @param {string | null} dir a data folder, or null for an in-memory database
 */
export async function openPglite(dir) {
  const db = dir ? new PGlite(dir) : new PGlite();
  await db.waitReady;
  /** @type {import("./index.js").Adapter & { switchToLoginRole: () => Promise<void> }} */
  const adapter = {
    async query(text, params) {
      try {
        const r = await db.query(text, params);
        return { rows: r.rows };
      } catch (err) {
        throw toDbError(err);
      }
    },
    async exec(text) {
      try {
        await db.exec(text);
      } catch (err) {
        throw toDbError(err);
      }
    },
    // PGlite's own transaction(), never a manual BEGIN through exec: PGlite serialises transaction(), so
    // no statement of another request runs inside this one (the code design M2AUTH, C7, F9). A transaction
    // is never opened inside another (F25). The throw of `fn` goes on unchanged; a failure of BEGIN or
    // COMMIT is a DbError.
    async transaction(fn) {
      let fromFn = false;
      try {
        return await db.transaction(async (tx) => {
          try {
            return await fn({
              async query(text, params) {
                try {
                  const r = await tx.query(text, params);
                  return { rows: r.rows };
                } catch (err) {
                  throw toDbError(err);
                }
              },
            });
          } catch (err) {
            fromFn = true;
            throw err;
          }
        });
      } catch (err) {
        if (fromFn) throw err;
        throw toDbError(err);
      }
    },
    async close() {
      await db.close();
    },
    async switchToLoginRole() {
      await db.exec("set session authorization sai_app_login");
    },
  };
  return adapter;
}
