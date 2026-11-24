import { randomBytes } from "node:crypto";
import pg from "pg";

// The real Postgres of the CI job pg (REQ-108 criterion 8). The three variables are listed in
// app/.env.example; a missing one fails the test with a plain message, never a skip.

export function admin() {
  const host = process.env.SAI_PG_HOST;
  const port = process.env.SAI_PG_PORT;
  const password = process.env.SAI_PG_SUPERUSER_PASSWORD;
  if (!host || !port || !password)
    throw new Error(
      "test:pg needs SAI_PG_HOST, SAI_PG_PORT and SAI_PG_SUPERUSER_PASSWORD (the job pg of app.yml sets them)",
    );
  return { host, port, password };
}

/** @param {string} user @param {string} password @param {string} database */
export function url(user, password, database) {
  const a = admin();
  const host = a.host.startsWith("/") ? "localhost" : `${a.host}:${a.port}`;
  const query = a.host.startsWith("/") ? `?host=${a.host}` : "";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${database}${query}`;
}

// The clients of client() still open on each database of freshDatabase. node:test runs the after hooks of a
// test in the order they were registered, so the drop of freshDatabase runs before the hooks that end the
// test's own clients; `drop database … with (force)` would terminate such a client (57P01), and a pg.Client
// without an error listener turns that into an uncaught exception that fails the test running at that moment.
// The drop therefore ends them first; a later end() of the test is then a no-op.
/** @type {Map<string, Set<pg.Client>>} */
const open = new Map();

/** @param {string} database */
export async function client(
  database = "postgres",
  user = "postgres",
  password = admin().password,
) {
  const c = new pg.Client({ connectionString: url(user, password, database) });
  await c.connect();
  const set = open.get(database);
  if (set) {
    set.add(c);
    c.once("end", () => set.delete(c));
  }
  return c;
}

/** @param {import("node:test").TestContext} t */
export async function freshDatabase(t) {
  const name = `sai_t_${randomBytes(6).toString("hex")}`;
  const c = await client();
  await c.query(`create database ${name}`);
  await c.end();
  open.set(name, new Set());
  t.after(async () => {
    for (const x of [...(open.get(name) ?? [])]) await x.end();
    open.delete(name);
    const d = await client();
    await d.query(`drop database if exists ${name} with (force)`);
    await d.end();
  });
  return name;
}

export const newPassword = () =>
  ["t", randomBytes(18).toString("base64url"), "%@:/"].join("");
