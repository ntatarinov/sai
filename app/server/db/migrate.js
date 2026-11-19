import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ConfigError, readConfig } from "../config.js";
import { DbError } from "./index.js";

// The migration runner (ARCH §4 «Migrations»): plain SQL in name order, one transaction each, under a
// session advisory lock, sha256 recorded; a changed applied file stops the run before any statement.
// After the files, the password step sets the password of sai_app_login from APP_DB_PASSWORD on every
// run (decisions/0116 О24, N3): the value is only a bound parameter; the dynamic statement that quotes
// it runs inside a block whose handler replaces any error, so no error carries the statement.

export const NAME = /^\d{4}_[a-z0-9_]+\.sql$/;
export const LOCK_KEY = 7300108;
export const CONNECT_TIMEOUT_MS = 10000;

export class MigrateError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function defaultMigrationsDir() {
  return fileURLToPath(new URL("../../db/migrations/", import.meta.url));
}

/**
 * @param {string} dir
 * @returns {Array<{ name: string, text: string, sha256: string }>}
 */
export function readMigrations(dir) {
  const names = fs.readdirSync(dir).sort();
  return names.map((name) => {
    if (!NAME.test(name))
      throw new MigrateError(
        "E_MIGRATE_NAME",
        `migrate: refused: ${name} is not a migration file name`,
      );
    const bytes = fs.readFileSync(path.join(dir, name));
    return {
      name,
      text: bytes.toString("utf8"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
}

export const PASSWORD_BLOCK =
  "do $$ begin execute format('alter role sai_app_login password %L', current_setting('sai.app_db_password')); exception when others then raise exception 'sai: the password step failed' using errcode = 'P0001'; end $$";

/**
 * @param {{ adapter: import("./index.js").Adapter, dir: string, password: string | null, log?: (line: string) => void }} options
 * @returns {Promise<{ applied: string[] }>}
 */
export async function migrate({ adapter, dir, password, log = () => {} }) {
  const files = readMigrations(dir);
  await adapter.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    const exists = await adapter.query(
      "select to_regclass('public.schema_migrations') is not null as present",
    );
    /** @type {Map<string, string>} */
    const applied = new Map();
    if (exists.rows[0]?.present) {
      const r = await adapter.query(
        "select name, sha256 from schema_migrations order by name",
      );
      for (const row of r.rows) applied.set(row.name, row.sha256);
    }
    for (const [name, sha] of applied) {
      const file = files.find((f) => f.name === name);
      if (!file)
        throw new MigrateError(
          "E_MIGRATE_MISSING",
          `migrate: refused: ${name} was applied and its file is missing`,
        );
      if (file.sha256 !== sha)
        throw new MigrateError(
          "E_MIGRATE_CHANGED",
          `migrate: refused: ${name} changed after it was applied`,
        );
    }
    const done = [];
    for (const file of files) {
      if (applied.has(file.name)) continue;
      await adapter.exec("begin");
      try {
        await adapter.exec(file.text);
        await adapter.query(
          "insert into schema_migrations (name, sha256) values ($1, $2)",
          [file.name, file.sha256],
        );
        await adapter.exec("commit");
      } catch (err) {
        await adapter.exec("rollback").catch(() => {});
        const state =
          err instanceof DbError && err.sqlstate ? ` (${err.sqlstate})` : "";
        throw new MigrateError(
          "E_MIGRATE_FAILED",
          `migrate: refused: ${file.name} failed${state}`,
        );
      }
      done.push(file.name);
      log(`migrate: applied ${file.name}`);
    }
    if (password !== null) {
      await adapter.exec("begin");
      try {
        await adapter.query(
          "select set_config('sai.app_db_password', $1, true)",
          [password],
        );
        await adapter.exec("set local log_parameter_max_length_on_error = 0");
        await adapter.exec(PASSWORD_BLOCK);
        await adapter.exec("commit");
      } catch {
        await adapter.exec("rollback").catch(() => {});
        throw new MigrateError(
          "E_MIGRATE_PASSWORD",
          "migrate: refused: the password step of sai_app_login failed",
        );
      }
      log("migrate: the password of sai_app_login is set");
    }
    if (done.length === 0) log("migrate: nothing to apply");
    return { applied: done };
  } finally {
    await adapter
      .query("select pg_advisory_unlock($1)", [LOCK_KEY])
      .catch(() => {});
  }
}

async function main() {
  let config;
  try {
    config = readConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`migrate: ${err.message}\n`);
      return 2;
    }
    throw err;
  }
  const dir = config.migrationsDir ?? defaultMigrationsDir();
  const timer = setTimeout(() => {
    process.stderr.write("migrate: refused: no answer from the database\n");
    process.exit(2);
  }, CONNECT_TIMEOUT_MS + 2000);
  timer.unref();
  let adapter;
  try {
    if (config.migrationUrl) {
      const { connectPgSession } = await import("./pg.js");
      adapter = await connectPgSession(config.migrationUrl, {
        connectTimeoutMs: CONNECT_TIMEOUT_MS,
      });
    } else if (config.pgliteDir) {
      const { openPglite } = await import("./pglite.js");
      adapter = await openPglite(config.pgliteDir);
    } else {
      process.stderr.write(
        "migrate: refused: set DATABASE_URL (or PGLITE_DIR outside production)\n",
      );
      return 2;
    }
    await migrate({
      adapter,
      dir,
      password: config.appDbPassword,
      log: (l) => process.stdout.write(`${l}\n`),
    });
    return 0;
  } catch (err) {
    if (err instanceof MigrateError) {
      process.stderr.write(`${err.message}\n`);
      return 1;
    }
    if (err instanceof DbError) {
      process.stderr.write(`migrate: refused: ${err.message}\n`);
      return 2;
    }
    process.stderr.write("migrate: refused: an unexpected error\n");
    return 2;
  } finally {
    clearTimeout(timer);
    await adapter?.close().catch(() => {});
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await main();
}
