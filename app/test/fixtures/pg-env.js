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

/** @param {string} database */
export async function client(
  database = "postgres",
  user = "postgres",
  password = admin().password,
) {
  const c = new pg.Client({ connectionString: url(user, password, database) });
  await c.connect();
  return c;
}

/** @param {import("node:test").TestContext} t */
export async function freshDatabase(t) {
  const name = `sai_t_${randomBytes(6).toString("hex")}`;
  const c = await client();
  await c.query(`create database ${name}`);
  await c.end();
  t.after(async () => {
    const d = await client();
    await d.query(`drop database if exists ${name} with (force)`);
    await d.end();
  });
  return name;
}

export const newPassword = () =>
  ["t", randomBytes(18).toString("base64url"), "%@:/"].join("");
