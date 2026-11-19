import path from "node:path";
import { createApp } from "../../server/app.js";
import { createDb } from "../../server/db/index.js";
import { migrate, readMigrations } from "../../server/db/migrate.js";
import { openPglite } from "../../server/db/pglite.js";
import { loadStaticSite } from "../../server/static.js";
import { APP } from "./helpers.js";

// Database helpers of app/test (no test here): the migrated PGlite of decisions/0116 О10, a counting
// adapter, an adapter that throws on every call, and createApp with them.

export const MIGRATIONS = path.join(APP, "db", "migrations");
export const migrationList = () =>
  readMigrations(MIGRATIONS).map(({ name, sha256 }) => ({ name, sha256 }));

/** A migrated PGlite whose session user is sai_app_login (the local database of decisions/0116 О10). */
export async function migratedPglite() {
  const adapter = await openPglite(null);
  await migrate({ adapter, dir: MIGRATIONS, password: null });
  await adapter.switchToLoginRole();
  return adapter;
}

/** @param {import("../../server/db/index.js").Adapter} inner */
export function counting(inner) {
  /** @type {string[]} */
  const texts = [];
  return {
    texts,
    adapter: {
      query: (/** @type {string} */ t, /** @type {unknown[]} */ p) => (
        texts.push(t),
        inner.query(t, p)
      ),
      exec: (/** @type {string} */ t) => (texts.push(t), inner.exec(t)),
      close: () => inner.close(),
    },
  };
}

export const throwing = () => {
  let calls = 0;
  const fail = () => {
    calls += 1;
    throw new Error("the adapter was called");
  };
  return {
    calls: () => calls,
    adapter: { query: fail, exec: fail, close: async () => {} },
  };
};

/** @param {{ adapter?: any, siteGate?: boolean, origins?: any, log?: (e: any) => void, migrations?: any }} o */
export function appWith(o = {}) {
  return createApp({
    config: { siteGate: o.siteGate ?? false, version: "dev" },
    origins: o.origins ?? {
      app: "http://127.0.0.1:1",
      preview: "http://localhost:1",
    },
    db: o.adapter ? createDb(o.adapter) : null,
    site: loadStaticSite(),
    migrations: o.migrations ?? migrationList(),
    log: o.log ?? (() => {}),
  });
}
