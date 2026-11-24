import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { blank } from "../fixtures/blank.js";
import { APP } from "../fixtures/helpers.js";

// REQ-115 criterion 4, the one place of database calls (the code design M2AUTH, 4.5.4, B4): in every .js file of
// app/server and app/api outside app/server/db/, a `.query(`, `.exec(` or `.transaction(` call is a database
// call, except an `.exec(` written directly after a regular-expression literal (`/…/flags.exec(`, the form of
// app/server/config.js); comments and strings are blanked first (the reader of fixtures/blank.js). And the text
// that sets app.role stands only in app/server/db/tx.js, so no code but the helpers can switch a transaction
// back to platform.

/**
 * Every .js file of app/server and app/api as `<path under app/>` → text.
 * @returns {Map<string, string>}
 */
function productFiles() {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const dir of ["server", "api"])
    for (const f of fs.readdirSync(path.join(APP, dir), { recursive: true })) {
      const rel = `${dir}/${String(f).split(path.sep).join("/")}`;
      if (rel.endsWith(".js"))
        out.set(rel, fs.readFileSync(path.join(APP, rel), "utf8"));
    }
  return out;
}

const RE_LITERAL = /^\/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[a-z]*$/;

/**
 * The database calls of one source text: each `.query(`, `.exec(` and `.transaction(` of its code (comments,
 * strings, template text and regular expressions blanked), but an `.exec(` whose receiver is a regular-expression
 * literal.
 * @param {string} src
 * @returns {string[]} the method names, in order
 */
export function databaseCalls(src) {
  const code = blank(src);
  const kept = blank(src, true);
  const out = [];
  for (const m of code.matchAll(/\.\s*(query|exec|transaction)\s*\(/g)) {
    const at = m.index ?? 0;
    if (m[1] === "exec") {
      // The receiver: a regular-expression literal, which the blanking keeps as its two slashes (and its
      // flags) with spaces between; the text with only its comments blanked holds it whole.
      let s = at;
      while (s > 0 && /[a-z]/.test(code[s - 1])) s -= 1;
      if (code[s - 1] === "/") {
        s -= 1;
        while (s > 0 && code[s - 1] === " ") s -= 1;
        if (code[s - 1] === "/" && RE_LITERAL.test(kept.slice(s - 1, at)))
          continue;
      }
    }
    out.push(m[1]);
  }
  return out;
}

/**
 * The findings of DBC-1 and DBC-2 over a file map: every database call outside app/server/db/, by path.
 * @param {Map<string, string>} files
 * @returns {string[]}
 */
export function callFindings(files) {
  const out = [];
  for (const [rel, src] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (rel.startsWith("server/db/")) continue;
    for (const call of databaseCalls(src)) out.push(`${rel}: .${call}(`);
  }
  return out;
}

/**
 * The files outside app/server/db/tx.js that hold the text that sets app.role.
 * @param {Map<string, string>} files
 * @returns {string[]}
 */
export function roleSetters(files) {
  return [...files]
    .filter(
      ([rel, src]) =>
        rel !== "server/db/tx.js" &&
        /set_config\s*\(\s*['"`]app\.role['"`]/.test(src),
    )
    .map(([rel]) => rel)
    .sort();
}

test("DBC-1 no file of app/server or app/api outside app/server/db/ calls the database; routes/health.js is no exception", () => {
  const files = productFiles();
  assert.ok(files.size > 30, `${files.size} files`);
  for (const rel of [
    "server/routes/health.js",
    "server/routes/auth.js",
    "server/routes/admin.js",
    "server/services/audit.js",
    "server/http/auth-mw.js",
    "server/config.js",
    "api/index.js",
  ])
    assert.ok(files.has(rel), rel);
  assert.deepEqual(callFindings(files), []);
  // The calls exist where they belong (a reader that finds none would prove nothing).
  assert.ok(
    databaseCalls(files.get("server/db/auth-store.js") ?? "").length > 10,
  );
  assert.ok(
    databaseCalls(files.get("server/db/health-read.js") ?? "").length > 0,
  );
  // The `.exec(` of a regular-expression literal in config.js is read and is no database call.
  const config = files.get("server/config.js") ?? "";
  assert.match(config, /\/[^\n]*\/[a-z]*\.exec\(/);
  assert.deepEqual(databaseCalls(config), []);
});

test("DBC-2 a planted call in a service or a route is reported by its path; the regular-expression and text forms are not calls", () => {
  const files = productFiles();
  /** @type {Array<[string, string, string]>} */
  const red = [
    [
      "server/services/x.js",
      'export const f = (db) => db.query("select 1");\n',
      ".query(",
    ],
    [
      "server/routes/x.js",
      "export const g = async (q) => { await q.exec(TEXT); };\n",
      ".exec(",
    ],
    [
      "server/routes/y.js",
      "export const h = (db) => db.transaction(async () => 1);\n",
      ".transaction(",
    ],
    // A regular expression kept in a constant and called with .exec( reads as a call (4.5.4: such a
    // constant is called with .test( or String.prototype.match).
    [
      "server/http/z.js",
      "const RE = /a/;\nexport const m = (s) => RE.exec(s);\n",
      ".exec(",
    ],
    [
      "server/http/w.js",
      "export const k = (c) =>\n  c\n    .query(\n      'x',\n    );\n",
      ".query(",
    ],
  ];
  for (const [rel, text, call] of red)
    assert.deepEqual(
      callFindings(new Map(files).set(rel, text)),
      [`${rel}: ${call}`],
      rel,
    );
  // M45: the real audit service with one statement of its own.
  const audit = files.get("server/services/audit.js") ?? "";
  const planted = audit.replace(
    "export async function appendAudit(q, entry, ctx) {",
    'export async function appendAudit(q, entry, ctx) {\n  await q.query("select 1");',
  );
  assert.notEqual(planted, audit);
  assert.deepEqual(
    callFindings(new Map(files).set("server/services/audit.js", planted)),
    ["server/services/audit.js: .query("],
  );
  // Green: a regular-expression literal's .exec(, the method names in a comment, a string or a template text,
  // and a call under app/server/db/.
  for (const [rel, text] of [
    ["server/http/a.js", "export const m = (s) => /^[a-z]+$/i.exec(s);\n"],
    [
      "server/http/b.js",
      "// db.query(x) is not called here\nexport const n = 1;\n",
    ],
    [
      "server/http/c.js",
      'export const t = "q.exec(x) and db.transaction(f)";\n',
    ],
    ["server/http/d.js", "export const u = `.query(${1})`;\n"],
    ["server/db/e.js", 'export const v = (q) => q.query("select 1");\n'],
  ])
    assert.deepEqual(callFindings(new Map(files).set(rel, text)), [], rel);
});

test("DBC-3 the text that sets app.role stands only in app/server/db/tx.js; a planted copy in auth-store.js is red", () => {
  const files = productFiles();
  assert.match(files.get("server/db/tx.js") ?? "", /set_config\('app\.role'/);
  assert.deepEqual(roleSetters(files), []);
  const store = files.get("server/db/auth-store.js") ?? "";
  // M54: a store function that switches its transaction back to platform.
  const planted = `${store}\nexport const back = (q) => q.query("select set_config('app.role', 'platform', true)");\n`;
  assert.deepEqual(
    roleSetters(new Map(files).set("server/db/auth-store.js", planted)),
    ["server/db/auth-store.js"],
  );
  // The same text with other quotes or blanks, in a route or in the entry, is red too.
  for (const [rel, text] of [
    [
      "server/routes/x.js",
      "q.query(`select set_config( 'app.role', $1, true)`)",
    ],
    ["api/x.js", "const S = 'select set_config(\"app.role\", $1, true)';"],
  ])
    assert.deepEqual(roleSetters(new Map(files).set(rel, text)), [rel], rel);
});
