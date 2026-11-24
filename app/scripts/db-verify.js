import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// db-verify (REQ-120 criterion 1; ARCH §20.4; decisions/0136 О13; the code design M2AUTH, 6.1): compares two
// databases, A and B, whose addresses come only from SAI_VERIFY_A_URL and SAI_VERIFY_B_URL.
//   node scripts/db-verify.js                    mode same: B is a restored copy of A
//   node scripts/db-verify.js --previous-schema  A has the previous migrations, B one migration more
// One line per table, sorted by name, then «db-verify: equal» (exit 0) or «db-verify: different» (exit 1); a
// wrong call, a missing variable, a database that does not answer or a role that cannot read every row is
// exit 2 with one line. No line holds a row value or an address. Every statement is a constant text; every
// table and column name is a bound parameter (Q9, C11).

/** The tables whose content is compared in mode same (when the table exists). */
export const CONTENT_TABLES = Object.freeze([
  "audit_log",
  "users",
  "orgs",
  "org_members",
  "platform_settings",
  "artifact_files",
]);

const CONNECT_TIMEOUT_MS = 10000;
const TOTAL_TIMEOUT_MS = 120000;
const USAGE =
  "usage: db-verify.js [--previous-schema]; the addresses come from SAI_VERIFY_A_URL and SAI_VERIFY_B_URL";

// The session settings that fix how values are written into the XML of the rows.
const SESSION_SQL =
  "set time zone 'UTC'; set datestyle = 'ISO, YMD'; set intervalstyle = 'iso_8601'; set extra_float_digits = 3; set bytea_output = 'hex'";
const ROLE_SQL =
  "select coalesce(bool_or(rolsuper or rolbypassrls), false) as ok from pg_roles where pg_has_role(current_user, oid, 'MEMBER')";
const TABLES_SQL =
  "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name";
const COLUMNS_SQL =
  "select table_name, column_name, udt_name, is_nullable = 'YES' as nullable, column_default is not null as has_default from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position";
const PK_SQL =
  "select c.relname as table_name, a.attname as column_name from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace join unnest(i.indkey) with ordinality k(attnum, ord) on true join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum where i.indisprimary and n.nspname = 'public' order by c.relname, k.ord";
const MIGRATIONS_SQL =
  "select name, sha256 from schema_migrations order by name";
const COUNT_SQL =
  "select query_to_xml(format('select count(*) as n from public.%I', $1::text), false, false, '') as x";
const ROWS_SQL =
  "select query_to_xml(format('select %s from public.%I order by %s', (select string_agg(quote_ident(c), ', ' order by o) from unnest($2::text[]) with ordinality u(c, o)), $1::text, (select string_agg(quote_ident(c), ', ' order by o) from unnest($3::text[]) with ordinality u(c, o))), true, true, '') as x";

/**
 * @typedef {{ name: string, type: string, nullable: boolean, hasDefault: boolean }} Column
 * @typedef {{ columns: Column[], pk: string[], count: number, pkSha: string, contentSha: string | null }} TableSnapshot
 * @typedef {{ migrations: Array<{ name: string, sha256: string }>, tables: Map<string, TableSnapshot> }} Snapshot
 * @typedef {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} Reader
 */

/** @param {unknown} text */
const sha = (text) =>
  createHash("sha256")
    .update(String(text ?? ""), "utf8")
    .digest("hex");

/**
 * Reads the snapshot of one database.
 * @param {Reader} q
 * @param {{ columnsOf?: Map<string, string[]> }} [options] the columns whose content is hashed per table
 *   (previous-schema: A's columns, for B); by default each table's own columns
 * @returns {Promise<Snapshot>}
 */
export async function readSnapshot(q, { columnsOf } = {}) {
  const names = (await q.query(TABLES_SQL)).rows.map((r) => r.table_name);
  /** @type {Map<string, Column[]>} */
  const cols = new Map(names.map((n) => [n, []]));
  for (const r of (await q.query(COLUMNS_SQL)).rows)
    cols.get(r.table_name)?.push({
      name: r.column_name,
      type: r.udt_name,
      nullable: r.nullable === true,
      hasDefault: r.has_default === true,
    });
  /** @type {Map<string, string[]>} */
  const pks = new Map();
  for (const r of (await q.query(PK_SQL)).rows) {
    if (!pks.has(r.table_name)) pks.set(r.table_name, []);
    pks.get(r.table_name)?.push(r.column_name);
  }
  /** @type {Map<string, TableSnapshot>} */
  const tables = new Map();
  for (const name of names) {
    const columns = cols.get(name) ?? [];
    const own = columns.map((c) => c.name);
    const pk = pks.get(name) ?? own;
    const countXml = String(
      (await q.query(COUNT_SQL, [name])).rows[0]?.x ?? "",
    );
    const m = countXml.match(/<n>([0-9]+)<\/n>/);
    const count = m ? Number(m[1]) : -1;
    const rows = async (/** @type {string[]} */ list) =>
      list.length === 0
        ? ""
        : (await q.query(ROWS_SQL, [name, list, pk])).rows[0]?.x;
    const content = (columnsOf?.get(name) ?? own).filter((c) =>
      own.includes(c),
    );
    tables.set(name, {
      columns,
      pk,
      count,
      pkSha: sha(await rows(pk)),
      contentSha: sha(await rows(content)),
    });
  }
  const migrations = tables.has("schema_migrations")
    ? (await q.query(MIGRATIONS_SQL)).rows.map((r) => ({
        name: String(r.name),
        sha256: String(r.sha256),
      }))
    : [];
  return { migrations, tables };
}

/**
 * The difference of one table, or null (previous-schema columns first, then rows).
 * @param {TableSnapshot} a
 * @param {TableSnapshot} b
 * @param {boolean} previous
 * @param {boolean} content whether the content is compared
 * @returns {string | null}
 */
function tableDifference(a, b, previous, content) {
  if (previous) {
    for (const c of a.columns) {
      const other = b.columns.find((x) => x.name === c.name);
      if (!other) return "column dropped";
      if (other.type !== c.type) return "column retyped";
    }
    for (const c of b.columns)
      if (
        !a.columns.some((x) => x.name === c.name) &&
        !c.nullable &&
        !c.hasDefault
      )
        return "column added without a default";
  }
  if (a.count !== b.count) return "row count";
  if (a.pkSha !== b.pkSha) return "primary keys";
  if (content && a.contentSha !== b.contentSha) return "content";
  return null;
}

/**
 * The rule of schema_migrations, or null.
 * @param {Snapshot["migrations"]} a
 * @param {Snapshot["migrations"]} b
 * @param {boolean} previous
 * @returns {string | null}
 */
function migrationsDifference(a, b, previous) {
  const names = (/** @type {Snapshot["migrations"]} */ list) =>
    list.map((m) => m.name);
  const head = previous ? b.slice(0, a.length) : b;
  if (names(a).join("\n") !== names(head).join("\n")) return "names";
  if (a.some((m, i) => m.sha256 !== head[i].sha256)) return "sha256";
  if (previous && b.length !== a.length + 1) return "not one row more";
  return null;
}

/**
 * The pure comparer.
 * @param {Snapshot} a
 * @param {Snapshot} b
 * @param {{ mode: "same" | "previous-schema" }} options
 * @returns {{ lines: string[], code: 0 | 1 }}
 */
export function compare(a, b, { mode }) {
  const previous = mode === "previous-schema";
  const names = new Set([...a.tables.keys()]);
  if (!previous) for (const n of b.tables.keys()) names.add(n);
  /** @type {string[]} */
  const lines = [];
  let different = false;
  for (const name of [...names].sort()) {
    const ta = a.tables.get(name);
    const tb = b.tables.get(name);
    /** @type {string | null} */
    let kind;
    if (!ta) kind = "missing in A";
    else if (!tb) kind = "missing in B";
    else if (name === "schema_migrations")
      kind = migrationsDifference(a.migrations, b.migrations, previous);
    else
      kind = tableDifference(
        ta,
        tb,
        previous,
        previous || CONTENT_TABLES.includes(name),
      );
    if (kind) different = true;
    lines.push(
      kind ? `db-verify: ${name}: differs: ${kind}` : `db-verify: ${name}: ok`,
    );
  }
  lines.push(different ? "db-verify: different" : "db-verify: equal");
  return { lines, code: different ? 1 : 0 };
}

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 * @param {(line: string) => void} print
 * @param {(line: string) => void} fail
 * @returns {Promise<number>}
 */
export async function main(argv, env, print, fail) {
  if (
    argv.length > 1 ||
    (argv.length === 1 && argv[0] !== "--previous-schema")
  ) {
    fail(`db-verify: refused: ${USAGE}`);
    return 2;
  }
  const mode = argv.length === 1 ? "previous-schema" : "same";
  const urlA = env.SAI_VERIFY_A_URL;
  const urlB = env.SAI_VERIFY_B_URL;
  if (!urlA) {
    fail("db-verify: refused: SAI_VERIFY_A_URL is not set");
    return 2;
  }
  if (!urlB) {
    fail("db-verify: refused: SAI_VERIFY_B_URL is not set");
    return 2;
  }
  const { connectPgSession } = await import("../server/db/pg.js");
  /** @type {Array<{ close: () => Promise<void> }>} */
  const open = [];
  /**
   * @param {"A" | "B"} side
   * @param {string} url
   * @returns {Promise<import("../server/db/index.js").Adapter | string>}
   */
  const connect = async (side, url) => {
    let adapter;
    try {
      adapter = await connectPgSession(url, {
        connectTimeoutMs: CONNECT_TIMEOUT_MS,
      });
    } catch {
      return `db-verify: refused: ${side} does not answer`;
    }
    open.push(adapter);
    try {
      await adapter.exec(SESSION_SQL);
      const ok = (await adapter.query(ROLE_SQL)).rows[0]?.ok === true;
      if (!ok)
        return `db-verify: refused: the role of ${side} cannot read every row (it needs SUPERUSER or BYPASSRLS)`;
    } catch {
      return `db-verify: refused: ${side} does not answer`;
    }
    return adapter;
  };
  try {
    const a = await connect("A", urlA);
    if (typeof a === "string") {
      fail(a);
      return 2;
    }
    const b = await connect("B", urlB);
    if (typeof b === "string") {
      fail(b);
      return 2;
    }
    /** @type {Snapshot} */
    let sa;
    /** @type {Snapshot} */
    let sb;
    try {
      sa = await readSnapshot(a);
    } catch {
      fail("db-verify: refused: a read of A failed");
      return 2;
    }
    /** @type {Map<string, string[]> | undefined} */
    const columnsOf =
      mode === "previous-schema"
        ? new Map(
            [...sa.tables].map(([n, t]) => [n, t.columns.map((c) => c.name)]),
          )
        : undefined;
    try {
      sb = await readSnapshot(b, { columnsOf });
    } catch {
      fail("db-verify: refused: a read of B failed");
      return 2;
    }
    const r = compare(sa, sb, { mode });
    for (const line of r.lines) print(line);
    return r.code;
  } finally {
    for (const x of open) await x.close().catch(() => {});
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const timer = setTimeout(() => {
    process.stderr.write(
      "db-verify: refused: no answer within the time limit\n",
    );
    process.exit(2);
  }, TOTAL_TIMEOUT_MS);
  timer.unref();
  process.exitCode = await main(
    process.argv.slice(2),
    process.env,
    (l) => process.stdout.write(`${l}\n`),
    (l) => process.stderr.write(`${l}\n`),
  );
}
