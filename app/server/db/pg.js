import pg from "pg";
import { DbError, toDbError } from "./index.js";

// The Postgres adapter (the only importer of `pg`, ARCH §2.2). Timeouts: decisions/0116 О11.

/** @typedef {import("./index.js").Adapter} Adapter */

// The client-side limit of one statement of the runtime pool, below the 4000 ms of /api/health. pg's
// connect limit ends when the session has started, and a statement has no limit of its own, so a
// connection that goes silent after its start (a half-open socket) would hold its statement, and the
// selfcheck that waits on it, forever. With this limit the statement fails as E_DB_DOWN and the pool
// drops that connection; the next use opens a new one. The server-side statement_timeout is not set:
// its effect behind the Neon pooler is not measured (spike S3).
export const QUERY_TIMEOUT_MS = 3000;

// The client-side limit of the COMMIT of a request transaction (the code design M2AUTH, 4.5.1 and 4.5.2):
// the request waits at most this long for the COMMIT's answer after its deadline guard passed, so the
// worst answer comes at 4000 + 900 ms.
export const COMMIT_LIMIT_MS = 900;

/**
 * @param {string} url
 * @param {{ connectTimeoutMs: number, max?: number }} options
 * @returns {Adapter}
 */
export function createPgAdapter(url, { connectTimeoutMs, max = 3 }) {
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: connectTimeoutMs,
    query_timeout: QUERY_TIMEOUT_MS,
    keepAlive: true,
    max,
    idleTimeoutMillis: 10000,
  });
  pool.on("error", () => {});
  return {
    async query(text, params) {
      try {
        const r = await pool.query(text, params);
        return { rows: r.rows };
      } catch (err) {
        throw toDbError(err);
      }
    },
    async exec(text) {
      try {
        await pool.query(text);
      } catch (err) {
        throw toDbError(err);
      }
    },
    // One connection of the pool between BEGIN and COMMIT. On any throw the transaction is rolled back and
    // the connection is dropped (release(true)), so a broken or silent connection never returns to the
    // pool. The throw of `fn` goes on unchanged; a failure of BEGIN, COMMIT or the connect is a DbError.
    // While the client is held, an `error` listener of its own catches a connection that drops (the pool
    // listens only to idle clients, so without it the event would end the process, decisions/0137
    // Addition 5): the transaction then fails as E_DB_DOWN (the pipeline answers 503 and its log line holds
    // the code, never the message), and the client is released as broken.
    async transaction(fn) {
      /** @type {pg.PoolClient} */
      let client;
      try {
        client = await pool.connect();
      } catch (err) {
        throw toDbError(err);
      }
      let broken = false;
      const onError = () => {
        broken = true;
      };
      client.on("error", onError);
      // A client back in the pool loses the listener (the pool's idle listener takes over); a dropped one
      // keeps it while it ends, so a late event of its socket cannot end the process either.
      const release = (/** @type {boolean} */ drop) => {
        const gone = drop || broken;
        client.release(gone);
        if (!gone) client.off("error", onError);
      };
      /** @param {string | pg.QueryConfig} statement @param {unknown[]} [params] */
      const run = async (statement, params) => {
        if (broken) throw new DbError("E_DB_DOWN");
        try {
          const r = await client.query(statement, params);
          return { rows: r.rows };
        } catch (err) {
          throw toDbError(err);
        }
      };
      let value;
      try {
        await run("begin");
        value = await fn({ query: (text, params) => run(text, params) });
        await run(
          /** @type {pg.QueryConfig} */ ({
            text: "commit",
            query_timeout: COMMIT_LIMIT_MS,
          }),
        );
      } catch (err) {
        // Not awaited: the answer does not wait for the ROLLBACK of a silent connection (which has its own
        // statement limit); the connection is dropped once it settles, and dropping it rolls back as well.
        void client
          .query("rollback")
          .catch(() => {})
          .finally(() => release(true));
        throw err;
      }
      release(false);
      return value;
    },
    async close() {
      await pool.end();
    },
  };
}

/**
 * One connection for the migration runner (a session lock needs one session).
 * @param {string} url
 * @param {{ connectTimeoutMs: number }} options
 * @returns {Promise<Adapter>}
 */
export async function connectPgSession(url, { connectTimeoutMs }) {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: connectTimeoutMs,
  });
  client.on("error", () => {});
  try {
    await client.connect();
  } catch (err) {
    throw toDbError(err);
  }
  return {
    async query(text, params) {
      try {
        const r = await client.query(text, params);
        return { rows: r.rows };
      } catch (err) {
        throw toDbError(err);
      }
    },
    async exec(text) {
      try {
        await client.query(text);
      } catch (err) {
        throw toDbError(err);
      }
    },
    async close() {
      await client.end();
    },
  };
}
