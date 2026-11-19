import { runSelfcheck } from "./selfcheck.js";

// The runtime database of the app: no statement runs before the role selfcheck has passed (REQ-108
// criterion 8, the gate's F13), at the start and after the database was unreachable or silent. This file
// also holds the adapter contract and the database errors shared by pg.js, pglite.js and migrate.js.

/**
 * The adapter contract (shared by pg.js, pglite.js and the test doubles). `query` is one statement with
 * bound parameters; `exec` is the simple protocol: several statements, no parameters (the migration
 * files and constant statements). Every error is a DbError.
 * @typedef {object} Adapter
 * @property {(text: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 * @property {(text: string) => Promise<void>} exec
 * @property {() => Promise<void>} close
 */

/** @typedef {"E_DB_DOWN" | "E_DB_ROLE" | "E_DB_QUERY"} DbErrorCode */

/** @type {Readonly<Record<DbErrorCode, string>>} */
const DB_MESSAGES = Object.freeze({
  E_DB_DOWN: "the database does not answer",
  E_DB_ROLE: "the database role is unsafe",
  E_DB_QUERY: "a database statement failed",
});

// A database error of the app. The message is the code's fixed text, never the client's message: the
// client puts the host and port into it (measured 2026-11-17: «connect ECONNREFUSED 127.0.0.1:<port>»).
export class DbError extends Error {
  /** @param {DbErrorCode} code @param {string | null} [sqlstate] */
  constructor(code, sqlstate) {
    super(DB_MESSAGES[code]);
    this.code = code;
    this.sqlstate = sqlstate ?? null;
  }
}

/**
 * An error with a five-character SQLSTATE outside class 08 becomes E_DB_QUERY with that state; anything
 * else (a refused, silent or broken connection) becomes E_DB_DOWN. The client's message is never kept.
 * @param {unknown} err
 * @returns {DbError}
 */
export function toDbError(err) {
  if (err instanceof DbError) return err;
  const code = /** @type {{ code?: unknown }} */ (err)?.code;
  if (
    typeof code === "string" &&
    /^[0-9A-Z]{5}$/.test(code) &&
    !code.startsWith("08")
  )
    return new DbError("E_DB_QUERY", code);
  return new DbError("E_DB_DOWN");
}

/** @typedef {"unchecked" | "ok" | "unsafe"} RoleState */

// The deadline of one selfcheck (the 4000 ms of /api/health and of node-main's start). A selfcheck that
// has no answer by then counts as a down database: its callers get E_DB_DOWN, the state stays
// "unchecked", and the next use runs a new selfcheck, so one statement that never ends cannot keep every
// later use waiting on it. A late answer of the earlier one still sets the state: it reads the same role.
export const SELFCHECK_DEADLINE_MS = 4000;

/**
 * @param {Adapter} adapter
 * @param {{ selfcheckDeadlineMs?: number }} [options]
 */
export function createDb(
  adapter,
  { selfcheckDeadlineMs = SELFCHECK_DEADLINE_MS } = {},
) {
  /** @type {RoleState} */
  let state = "unchecked";
  /** @type {Promise<void> | null} */
  let checking = null;
  const current = () => state;
  /** One selfcheck, shared by the parallel callers until it ends or its deadline passes. */
  function startCheck() {
    /** @type {NodeJS.Timeout | undefined} */
    let timer;
    const run = runSelfcheck(adapter).then((v) => {
      state = v;
    });
    /** @type {Promise<never>} */
    const late = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new DbError("E_DB_DOWN")),
        selfcheckDeadlineMs,
      );
    });
    const shared = Promise.race([run, late]).finally(() => {
      clearTimeout(timer);
      if (checking === shared) checking = null;
    });
    return shared;
  }
  async function ensureSafe() {
    if (state === "ok") return;
    if (state === "unsafe") throw new DbError("E_DB_ROLE");
    checking ??= startCheck();
    await checking;
    if (current() !== "ok") throw new DbError("E_DB_ROLE");
  }
  return {
    ensureSafe,
    roleState: current,
    /** @param {string} text @param {unknown[]} [params] */
    async query(text, params) {
      await ensureSafe();
      return adapter.query(text, params);
    },
    async close() {
      await adapter.close();
    },
  };
}

/** @typedef {ReturnType<typeof createDb>} Db */

/**
 * The database the Node entry opens (no statement yet): Postgres by URL, or PGlite outside production.
 * @param {import("../config.js").Config} config
 * @param {{ connectTimeoutMs: number }} options
 * @returns {Promise<Db>}
 */
export async function openRuntimeDb(config, { connectTimeoutMs }) {
  if (config.databaseUrl) {
    const { createPgAdapter } = await import("./pg.js");
    return createDb(createPgAdapter(config.databaseUrl, { connectTimeoutMs }));
  }
  const { openPglite } = await import("./pglite.js");
  const { migrate, defaultMigrationsDir } = await import("./migrate.js");
  const adapter = await openPglite(config.pgliteDir);
  await migrate({
    adapter,
    dir: config.migrationsDir ?? defaultMigrationsDir(),
    password: null,
  });
  await adapter.switchToLoginRole();
  return createDb(adapter);
}
