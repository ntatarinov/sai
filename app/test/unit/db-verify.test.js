import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  compare,
  CONTENT_TABLES,
  readSnapshot,
} from "../../scripts/db-verify.js";
import { APP, childEnv, pgStandIn } from "../fixtures/helpers.js";

// REQ-120 criterion 1 (the code design M2AUTH, 6.1): the comparer of db-verify on snapshots that its reader
// takes from real PGlite databases (so the reader's count and hashes are proved too), and the refusals of
// the command line. The oracle of each case is the kind of difference the requirement names for it, written
// here; no rule is imported from the script but the two functions under test and its closed list.

// A row value that no printed line may hold (the requirement: «no printed line holds a row value»).
const MARK = "dv-value-mark";

// Four tables: schema_migrations, users and audit_log (both of the closed list) and notes (outside it).
const SCHEMA = [
  "create table schema_migrations (name text primary key, sha256 text not null)",
  "create table users (id uuid primary key, email text not null, n integer not null)",
  "create table audit_log (id bigint primary key, hash text not null)",
  "create table notes (id integer primary key, body text not null)",
  `insert into schema_migrations values ('0001_init.sql', '${"a".repeat(64)}'), ('0002_identity.sql', '${"b".repeat(64)}')`,
  `insert into users values ('11111111-1111-4111-8111-111111111111', '${MARK}-1@example.test', 1), ('22222222-2222-4222-8222-222222222222', '${MARK}-2@example.test', 2)`,
  `insert into audit_log values (1, '${"c".repeat(64)}'), (2, '${"d".repeat(64)}')`,
  `insert into notes values (1, '${MARK} one'), (2, '${MARK} two'), (3, '${MARK} three')`,
];
const TABLES = ["audit_log", "notes", "schema_migrations", "users"];
const NEXT_MIGRATION = `insert into schema_migrations values ('0003_more.sql', '${"e".repeat(64)}')`;

/**
 * A fresh in-memory PGlite with the schema above and then `extra`, and the reader db-verify is given.
 * @param {string[]} extra
 */
async function database(extra = []) {
  const db = new PGlite();
  for (const s of [...SCHEMA, ...extra]) await db.exec(s);
  return {
    db,
    q: {
      query: async (/** @type {string} */ t, /** @type {unknown[]} */ p) => ({
        rows: (await db.query(t, p)).rows,
      }),
    },
  };
}

/**
 * The snapshots of A (the schema) and of B (the schema and `extra`), each read by the reader under test; in
 * the previous-schema mode B's content is hashed over A's columns, as main does.
 * @param {string[]} extra
 * @param {"same" | "previous-schema"} mode
 */
async function pair(extra, mode) {
  const a = await database();
  const b = await database(extra);
  try {
    const sa = await readSnapshot(a.q);
    const columnsOf =
      mode === "previous-schema"
        ? new Map(
            [...sa.tables].map(([n, t]) => [n, t.columns.map((c) => c.name)]),
          )
        : undefined;
    const sb = await readSnapshot(b.q, { columnsOf });
    return { sa, sb, out: compare(sa, sb, { mode }) };
  } finally {
    await a.db.close();
    await b.db.close();
  }
}

/** Every printed line is the fixed form of the script: a table name and a closed verdict, nothing else. */
const LINE =
  /^db-verify: (?:[a-z_]+: (?:ok|differs: (?:missing in A|missing in B|row count|primary keys|content|column dropped|column retyped|column added without a default|names|sha256|not one row more))|equal|different)$/;

/** @param {string[]} lines */
function noValue(lines) {
  for (const l of lines) {
    assert.match(l, LINE);
    assert.ok(!l.includes(MARK), l);
    assert.ok(!/@|postgres|:\/\/|[0-9a-f]{16}/.test(l), l);
  }
}

/**
 * A planted difference: exit 1, exactly the one line `<table>: differs: <kind>`, every other table ok.
 * @param {{ lines: string[], code: number }} out
 * @param {string[]} tables the tables that get a line
 * @param {string} table
 * @param {string} kind
 */
function differsOnly(out, tables, table, kind) {
  assert.equal(out.code, 1, out.lines.join("\n"));
  assert.deepEqual(out.lines, [
    ...tables.map((t) =>
      t === table ? `db-verify: ${t}: differs: ${kind}` : `db-verify: ${t}: ok`,
    ),
    "db-verify: different",
  ]);
  noValue(out.lines);
}

test("DV-1 two databases filled alike are equal: exit 0, one ok line per table; the reader counts the real rows; a count-only difference is red", async () => {
  const { sa, sb, out } = await pair([], "same");
  assert.equal(out.code, 0);
  assert.deepEqual(out.lines, [
    ...TABLES.map((t) => `db-verify: ${t}: ok`),
    "db-verify: equal",
  ]);
  noValue(out.lines);
  // The reader's count is the real number of rows of each table (a count that reads 0 on both sides
  // would hide one row more).
  assert.deepEqual(
    Object.fromEntries([...sa.tables].map(([n, t]) => [n, t.count])),
    { audit_log: 2, notes: 3, schema_migrations: 2, users: 2 },
  );
  assert.deepEqual([...sa.tables.keys()].sort(), [...sb.tables.keys()].sort());
  // Two snapshots that differ only in the count of one table (keys and content hashes equal).
  const users = /** @type {any} */ (sb.tables.get("users"));
  const tables = new Map(sb.tables);
  tables.set("users", { ...users, count: users.count + 1 });
  differsOnly(
    compare(sa, { ...sb, tables }, { mode: "same" }),
    TABLES,
    "users",
    "row count",
  );
});

test("DV-2 each of the six planted differences gives exit 1 and one line naming the table and the kind; a content change outside the closed list is not compared", async () => {
  assert.ok(CONTENT_TABLES.includes("users"));
  assert.ok(CONTENT_TABLES.includes("audit_log"));
  assert.ok(!CONTENT_TABLES.includes("notes"));
  /** @type {Array<[string, string[], string[], string, string]>} */
  const cases = [
    [
      "one row more",
      [`insert into notes values (4, '${MARK} four')`],
      TABLES,
      "notes",
      "row count",
    ],
    [
      "one primary key changed",
      [
        "update users set id = '33333333-3333-4333-8333-333333333333' where n = 2",
      ],
      TABLES,
      "users",
      "primary keys",
    ],
    [
      "one content row changed in a table of the closed list",
      ["update users set n = 7 where n = 2"],
      TABLES,
      "users",
      "content",
    ],
    [
      "one content row changed in audit_log",
      [`update audit_log set hash = '${"9".repeat(64)}' where id = 2`],
      TABLES,
      "audit_log",
      "content",
    ],
    [
      "a table missing in B",
      ["drop table notes"],
      TABLES,
      "notes",
      "missing in B",
    ],
    [
      "a table missing in A",
      ["create table extra (id integer primary key)"],
      [...TABLES, "extra"].sort(),
      "extra",
      "missing in A",
    ],
    [
      "an extra migration row",
      [NEXT_MIGRATION],
      TABLES,
      "schema_migrations",
      "names",
    ],
    [
      "a changed migration sha256",
      [
        `update schema_migrations set sha256 = '${"f".repeat(64)}' where name = '0002_identity.sql'`,
      ],
      TABLES,
      "schema_migrations",
      "sha256",
    ],
  ];
  for (const [label, extra, tables, table, kind] of cases) {
    const { out } = await pair(extra, "same");
    try {
      differsOnly(out, tables, table, kind);
    } catch (err) {
      throw new Error(`${label}: ${/** @type {Error} */ (err).message}`, {
        cause: err,
      });
    }
  }
  // notes is outside the closed list: its content is not compared in mode same.
  const { out } = await pair(
    [`update notes set body = '${MARK} changed' where id = 1`],
    "same",
  );
  assert.equal(out.code, 0, out.lines.join("\n"));
});

/**
 * The command line in a child process (asynchronous: the stand-in database below lives in this process).
 * @param {string[]} args
 * @param {Record<string, string>} env
 * @returns {Promise<{ status: number | null, stdout: string, stderr: string }>}
 */
function cli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/db-verify.js", ...args], {
      cwd: APP,
      env: childEnv(env),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), 60000);
    child.on("error", reject);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

/** A port of 127.0.0.1 where nothing listens: a server bound on port 0, then closed. */
async function closedPort() {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", () => r(null)));
  const port = /** @type {net.AddressInfo} */ (server.address()).port;
  await new Promise((r) => server.close(() => r(null)));
  return port;
}

/**
 * Exit 2 with exactly the one line `want` on stderr, nothing on stdout, no stack, no address and no
 * password.
 * @param {{ status: number | null, stdout: string, stderr: string }} r
 * @param {string} want
 * @param {string[]} secrets
 */
function refused(r, want, secrets) {
  assert.equal(r.status, 2, `${r.stdout}\n${r.stderr}`);
  assert.deepEqual(r.stderr.split("\n"), [want, ""]);
  assert.equal(r.stdout, "");
  assert.doesNotMatch(r.stderr, /^\s+at /m);
  for (const s of secrets) assert.ok(!r.stderr.includes(s), s);
}

test("DV-3 a URL as an argument, a missing variable, an unreachable database and a role that cannot read every row: exit 2 with one line and no stack", async (t) => {
  const pw = ["pw", "MARK", "dv3"].join("-");
  const port = await closedPort();
  const url = `postgres://verify_user:${pw}@127.0.0.1:${port}/d`;
  const usage =
    "db-verify: refused: usage: db-verify.js [--previous-schema]; the addresses come from SAI_VERIFY_A_URL and SAI_VERIFY_B_URL";
  for (const args of [[url], ["--a", url], ["--previous-schema", url]])
    refused(await cli(args, {}), usage, [pw, String(port)]);
  refused(
    await cli([], { SAI_VERIFY_B_URL: url }),
    "db-verify: refused: SAI_VERIFY_A_URL is not set",
    [pw],
  );
  refused(
    await cli(["--previous-schema"], { SAI_VERIFY_A_URL: url }),
    "db-verify: refused: SAI_VERIFY_B_URL is not set",
    [pw],
  );
  refused(
    await cli([], { SAI_VERIFY_A_URL: url, SAI_VERIFY_B_URL: url }),
    "db-verify: refused: A does not answer",
    [pw, String(port), "verify_user"],
  );
  // A database that answers, but whose role is neither a superuser nor BYPASSRLS: forced RLS would hide
  // rows and give a false «equal».
  const pg = await pgStandIn(t, {
    plan: () => "answer",
    answer: (text) =>
      /\bpg_roles\b/.test(text)
        ? { fields: [["ok", 16]], rows: [["f"]] }
        : { fields: [], rows: [] },
  });
  const blind = `postgres://verify_user:${pw}@127.0.0.1:${pg.port}/d`;
  refused(
    await cli([], { SAI_VERIFY_A_URL: blind, SAI_VERIFY_B_URL: blind }),
    "db-verify: refused: the role of A cannot read every row (it needs SUPERUSER or BYPASSRLS)",
    [pw, String(pg.port)],
  );
  // No table was read on that database.
  assert.ok(
    pg.statements.every(([, s]) => !/information_schema|query_to_xml/.test(s)),
  );
});

test("DV-4 previous-schema: an additive migration (a new table, a nullable column and a column with a default on seeded tables, one migration row more) is equal", async () => {
  const { out } = await pair(
    [
      NEXT_MIGRATION,
      "create table extra (id integer primary key)",
      "insert into extra values (1)",
      "alter table notes add column tag text",
      "update notes set tag = 'x'",
      "alter table users add column flag boolean not null default false",
    ],
    "previous-schema",
  );
  assert.equal(out.code, 0, out.lines.join("\n"));
  // Tables only B has are not compared: one line per table of A.
  assert.deepEqual(out.lines, [
    ...TABLES.map((t) => `db-verify: ${t}: ok`),
    "db-verify: equal",
  ]);
});

test("DV-5 previous-schema: each of the eight differences gives exit 1 and one line naming the table or schema_migrations and the kind", async () => {
  /** @type {Array<[string, string[], string, string]>} */
  const cases = [
    [
      "a dropped column",
      [NEXT_MIGRATION, "alter table notes drop column body"],
      "notes",
      "column dropped",
    ],
    [
      "a retyped column",
      [NEXT_MIGRATION, "alter table users alter column n type bigint"],
      "users",
      "column retyped",
    ],
    [
      "a dropped table",
      [NEXT_MIGRATION, "drop table notes"],
      "notes",
      "missing in B",
    ],
    [
      "a deleted row",
      [NEXT_MIGRATION, "delete from notes where id = 3"],
      "notes",
      "row count",
    ],
    [
      "a changed row of a table outside the closed list",
      [NEXT_MIGRATION, `update notes set body = '${MARK} x' where id = 2`],
      "notes",
      "content",
    ],
    [
      "an added NOT NULL column without a default",
      [
        NEXT_MIGRATION,
        "alter table notes add column must integer not null default 0",
        "alter table notes alter column must drop default",
      ],
      "notes",
      "column added without a default",
    ],
    [
      "a changed sha256 of an older migration row",
      [
        NEXT_MIGRATION,
        `update schema_migrations set sha256 = '${"f".repeat(64)}' where name = '0001_init.sql'`,
      ],
      "schema_migrations",
      "sha256",
    ],
    [
      "two new migration rows",
      [
        NEXT_MIGRATION,
        `insert into schema_migrations values ('0004_again.sql', '${"9".repeat(64)}')`,
      ],
      "schema_migrations",
      "not one row more",
    ],
  ];
  for (const [label, extra, table, kind] of cases) {
    const { out } = await pair(extra, "previous-schema");
    try {
      differsOnly(out, TABLES, table, kind);
    } catch (err) {
      throw new Error(`${label}: ${/** @type {Error} */ (err).message}`, {
        cause: err,
      });
    }
  }
  // Without the one migration row more the previous-schema rule is red too.
  const { out } = await pair([], "previous-schema");
  differsOnly(out, TABLES, "schema_migrations", "not one row more");
});
