import { runSelfcheck } from "./selfcheck.js";

// The runtime database of the app: no statement runs before the role selfcheck has passed (REQ-108
// criterion 8, the gate's F13), at the start and after the database was unreachable or silent. This file
// also holds the adapter contract and the database errors shared by pg.js, pglite.js and migrate.js.

/**
 * The query of one transaction: one statement with bound parameters on the transaction's connection.
 * @typedef {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} Q
 */

/**
 * The adapter contract (shared by pg.js, pglite.js and the test doubles). `query` is one statement with
 * bound parameters; `exec` is the simple protocol: several statements, no parameters (the migration
 * files and constant statements). `transaction(fn)` runs every statement of `fn` on one connection
 * between BEGIN and COMMIT; a throw of `fn` rolls back and goes on unchanged (the code design M2AUTH,
 * 4.5.1). Every database error is a DbError. Test doubles of the health and demo routes may lack
 * `transaction`: those routes never call it.
 * @typedef {object} Adapter
 * @property {(text: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 * @property {(text: string) => Promise<void>} exec
 * @property {() => Promise<void>} close
 * @property {<T>(fn: (c: Q) => Promise<T>) => Promise<T>} [transaction]
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

// The deadline of one request transaction (the code design M2AUTH, 4.5.2): the pipeline sets it once per
// request as its start on the monotonic clock plus this value. With the COMMIT limit of pg.js (900 ms)
// the worst answer comes at 4.9 s, inside the 5 s of REQ-114 criterion 10.
export const TX_DEADLINE_MS = 4000;

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
    /**
     * One request transaction with its deadline (the code design M2AUTH, 4.5.2). The selfcheck runs first;
     * every statement of `fn` first checks the deadline and is not sent once it has passed (E_DB_DOWN), and
     * so does the end of `fn` before COMMIT, so a late transaction is rolled back, never committed. The
     * caller gets E_DB_DOWN at the deadline while `fn` still runs; once COMMIT is sent that answer is off
     * and the caller waits for COMMIT's own answer (the COMMIT limit of the adapter).
     * @template T
     * @param {(q: Q) => Promise<T>} fn
     * @param {{ deadlineAt: number }} options `deadlineAt` on the clock of performance.now()
     * @returns {Promise<T>}
     */
    transaction(fn, { deadlineAt }) {
      const late = () => performance.now() >= deadlineAt;
      let committing = false;
      /** @type {NodeJS.Timeout | undefined} */
      let timer;
      /** @type {Promise<never>} */
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(
          () => {
            if (!committing) reject(new DbError("E_DB_DOWN"));
          },
          Math.max(0, deadlineAt - performance.now()),
        );
      });
      const work = (async () => {
        await ensureSafe();
        if (late()) throw new DbError("E_DB_DOWN");
        if (typeof adapter.transaction !== "function")
          throw new DbError("E_DB_QUERY");
        return adapter.transaction(async (c) => {
          /** @type {Q} */
          const q = {
            query(text, params) {
              if (late()) return Promise.reject(new DbError("E_DB_DOWN"));
              return c.query(text, params);
            },
          };
          const value = await fn(q);
          if (late()) throw new DbError("E_DB_DOWN");
          committing = true;
          return value;
        });
      })();
      // The late transaction settles after the caller's answer; its outcome is the rollback above.
      work.catch(() => {});
      return /** @type {Promise<T>} */ (Promise.race([work, deadline])).finally(
        () => clearTimeout(timer),
      );
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
