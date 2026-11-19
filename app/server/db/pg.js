import pg from "pg";
import { toDbError } from "./index.js";

// The Postgres adapter (the only importer of `pg`, ARCH §2.2). Timeouts: decisions/0116 О11.

/** @typedef {import("./index.js").Adapter} Adapter */

// The client-side limit of one statement of the runtime pool, below the 4000 ms of /api/health. pg's
// connect limit ends when the session has started, and a statement has no limit of its own, so a
// connection that goes silent after its start (a half-open socket) would hold its statement, and the
// selfcheck that waits on it, forever. With this limit the statement fails as E_DB_DOWN and the pool
// drops that connection; the next use opens a new one. The server-side statement_timeout is not set:
// its effect behind the Neon pooler is not measured (spike S3).
export const QUERY_TIMEOUT_MS = 3000;

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
