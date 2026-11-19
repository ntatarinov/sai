import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { APP } from "../fixtures/helpers.js";

// REQ-108 criterion 7 (Q9): no template literal with ${ and no + concatenation as the SQL text of a
// query(, .query(, exec( or .exec( call in app/server.

/**
 * The index after the comment that starts at `k`, or -1 when no comment starts there.
 * @param {string} src
 * @param {number} k
 */
function commentEnd(src, k) {
  if (src[k] !== "/") return -1;
  if (src[k + 1] === "/") {
    const e = src.indexOf("\n", k);
    return e < 0 ? src.length : e;
  }
  if (src[k + 1] === "*") {
    const e = src.indexOf("*/", k + 2);
    return e < 0 ? src.length : e + 2;
  }
  return -1;
}

/**
 * The index after the string literal whose quote is at `k`.
 * @param {string} src
 * @param {number} k
 */
function stringEnd(src, k) {
  const quote = src[k];
  let i = k + 1;
  while (i < src.length && src[i] !== quote) i += src[i] === "\\" ? 2 : 1;
  return i + 1;
}

/**
 * The template literal whose backtick is at `k`: the index after it, and whether it holds a `${…}`.
 * An escaped backtick does not end it; the code of each `${…}` is skipped with its own strings,
 * comments and templates.
 * @param {string} src
 * @param {number} k
 * @returns {{ end: number, substitution: boolean }}
 */
function template(src, k) {
  let substitution = false;
  let i = k + 1;
  while (i < src.length) {
    if (src[i] === "\\") i += 2;
    else if (src[i] === "`") return { end: i + 1, substitution };
    else if (src[i] === "$" && src[i + 1] === "{") {
      substitution = true;
      i = scan(src, i + 2, "}").end + 1;
    } else i++;
  }
  return { end: i, substitution };
}

/**
 * Scans code from `k` to the first `,` or `close` at its own top level (a `close` or `)`, `]`, `}` that
 * closes an outer bracket ends it too). Reports a template literal with `${` and a `+` met at that
 * level, tagged templates (`String.raw\`…\``) included.
 * @param {string} src
 * @param {number} k
 * @param {string} close
 * @returns {{ end: number, substitution: boolean, plus: boolean }}
 */
function scan(src, k, close) {
  let depth = 0;
  let substitution = false;
  let plus = false;
  let i = k;
  while (i < src.length) {
    const ch = src[i];
    const c = commentEnd(src, i);
    if (c >= 0) i = c;
    else if (ch === "'" || ch === '"') i = stringEnd(src, i);
    else if (ch === "`") {
      const t = template(src, i);
      if (depth === 0 && t.substitution) substitution = true;
      i = t.end;
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      i++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) break;
      depth--;
      i++;
    } else if (depth === 0 && (ch === "," || ch === close)) break;
    else {
      if (ch === "+" && depth === 0) plus = true;
      i++;
    }
  }
  return { end: i, substitution, plus };
}

/**
 * The SQL text built from strings: the first argument of each `query(` and `exec(` call, read up to
 * its `,` or `)`, holds a template literal with `${` or a `+` at its top level.
 * @param {string} src
 * @returns {string[]}
 */
export function stringSql(src) {
  const out = [];
  for (const m of src.matchAll(/(?:^|[^A-Za-z0-9_$])(query|exec)\s*\(/g)) {
    const first = scan(src, (m.index ?? 0) + m[0].length, ")");
    if (first.substitution) out.push(`${m[1]}: a template with \${`);
    if (first.plus) out.push(`${m[1]}: a + concatenation`);
  }
  return out;
}

/** @param {string} dir */
const files = (dir) =>
  fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.join(dir, f));

test("SQL-1 no file of app/server builds SQL text from strings", () => {
  const all = files(path.join(APP, "server")).flatMap((f) =>
    stringSql(fs.readFileSync(f, "utf8")).map((x) => `${f}: ${x}`),
  );
  assert.deepEqual(all, []);
});

test("SQL-2 each planted form is red, parameters are green", () => {
  for (const red of [
    "db.query(`select ${x}`)",
    "query(`x ${y}`, [])",
    "a.exec(`drop ${t}`)",
    "exec(`${t}`)",
    'db.query("select " + x)',
    'exec("a" + b)',
    "db.query(text + more, [1])",
    // A template first, then a + (the template itself has no ${).
    "db.query(`select * from t where id = ` + id)",
    "exec(`a` + b)",
    "db.query(`select * from users where name = '` + name + `'`)",
    "db.query(`select *\n  from t\n  where id = `\n  + id)",
    // A tagged template, an escaped backtick before the ${, a quote inside a comment.
    "db.query(String.raw`select ${x}`)",
    "db.query(`a \\` ${x}`)",
    'db.query(/* " */ "select " + x)',
  ])
    assert.notDeepEqual(stringSql(red), [], red);
  for (const green of [
    'db.query("select $1", [x])',
    "db.query(SQL)",
    "a.exec(`create table t (x int)`)",
    'q("a", [b + 1])',
    "query(text, [a + b])",
    "db.query(`select $1`, [a + b])",
    'db.query("select $1", [`${a}`])',
    'db.query("a \\" + b")',
  ])
    assert.deepEqual(stringSql(green), [], green);
});
