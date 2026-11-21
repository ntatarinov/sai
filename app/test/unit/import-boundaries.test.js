import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { APP, tempDir } from "../fixtures/helpers.js";

// REQ-108 criterion 3 (ARCH §2.2, decisions/0094, decisions/0116 О22, N1, N2).

const ID = "A-Za-z0-9_$";
const SERVER_PACKAGES = ["hono", "@hono/node-server", "zod", "fflate"];
const DB_PACKAGES = {
  pg: "server/db/pg.js",
  "@electric-sql/pglite": "server/db/pglite.js",
};
// The core modules of criterion 3 and О5, and those that also reach the network, start another process or
// run a text as code: cluster, inspector (a session evaluates code), repl, test (runs files) and sqlite
// (loads native extensions). Every internal `node:_…` module (`node:_http_client`, `node:_tls_wrap`) is
// banned as well, in `findings`.
const BANNED_NODE = [
  "child_process",
  "https",
  "http2",
  "net",
  "tls",
  "dgram",
  "dns",
  "worker_threads",
  "vm",
  "cluster",
  "inspector",
  "repl",
  "test",
  "sqlite",
];
const HTTP_NAMED = [
  "createServer",
  "Server",
  "IncomingMessage",
  "ServerResponse",
  "STATUS_CODES",
];
const HTTP_BANNED_MEMBERS = [
  "request",
  "get",
  "Agent",
  "ClientRequest",
  "globalAgent",
];
// The members of the process object that app/server and app/api use. Every other member is red: those that
// load a module or native code (`getBuiltinModule`, `binding`, `dlopen`), replace the process (`execve`) or
// give the whole object again (`default`), and any member added later.
const PROCESS_ALLOWED = [
  "argv",
  "env",
  "exit",
  "exitCode",
  "once",
  "stderr",
  "stdout",
  "version",
];

// The tokens after which a `/` starts a regular expression: a punctuator that cannot end an operand (a
// division `/` and a spread `...` included), the start of the text, and "ctl)", the `)` of the condition
// of `if`, `while`, `for` or `with`.
const REGEX_AFTER = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  ";",
  "+",
  "-",
  "*",
  "%",
  "<",
  ">",
  "~",
  "^",
  "/",
  "...",
  "ctl)",
]);
// The keywords after which an expression begins; after `.` (`x.in`) they are names and end one.
const REGEX_AFTER_WORD = new Set([
  "return",
  "typeof",
  "case",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "delete",
  "void",
  "throw",
  "yield",
  "await",
  "extends",
  "default",
  "break",
  "continue",
]);
// The tokens after which a `/` may start either: `}` (of a block or of an object), `++` and `--` (prefix
// or postfix) and `of` (a keyword in `for (… of …)`, a name elsewhere).
const SLASH_EITHER = new Set(["}", "++", "--", "of"]);

/**
 * Reads a source text once, token by token, into `code` (its comments, strings, template text and regular
 * expressions blanked with spaces; the code of `${…}` stays) and `kept` (only its comments blanked); both
 * keep line breaks and lengths. A `/` starts a regular expression or is a division by the token before it
 * (REGEX_AFTER, REGEX_AFTER_WORD). Where that token leaves both open (SLASH_EITHER) the scan reads a
 * division and lists the place in `slashes`, which `findings` makes red, so no text that the scan could
 * read the other way hides code from the rules.
 * @param {string} src
 */
export function scan(src) {
  const code = src.split("");
  const kept = src.split("");
  /** @type {number[]} */
  const slashes = [];
  /** @type {number[]} the open `{` inside each `${…}`, innermost last */
  const tpl = [];
  /** @type {boolean[]} for each open `(`, whether it holds the condition of `if`, `while`, `for` or `with` */
  const parens = [];
  // The last token (a word, a punctuator, "0" for a literal, "ctl)"), the token before it, whether the
  // last word follows `.` (a property name), and whether the next word character starts a new word.
  let prev = "";
  let before = "";
  let dotted = false;
  let fresh = true;
  const blankAll = (/** @type {number} */ a, /** @type {number} */ b) => {
    for (let k = a; k < b; k++) if (src[k] !== "\n") code[k] = kept[k] = " ";
  };
  const blankCode = (/** @type {number} */ a, /** @type {number} */ b) => {
    for (let k = a; k < b; k++) if (src[k] !== "\n") code[k] = " ";
  };
  const token = (/** @type {string} */ t) => {
    before = prev;
    prev = t;
    dotted = false;
    fresh = true;
  };
  let i = 0;
  if (src.startsWith("#!")) {
    const e = src.indexOf("\n");
    i = e < 0 ? src.length : e;
    blankAll(0, i);
  }
  while (i < src.length) {
    const ch = src[i];
    const nx = src[i + 1];
    if (tpl.length && tpl[tpl.length - 1] === 0 && ch === "}") {
      tpl.pop();
      i = template(i + 1);
      continue;
    }
    if (ch === "/" && (nx === "/" || nx === "*")) {
      const e = nx === "/" ? src.indexOf("\n", i) : src.indexOf("*/", i + 2);
      const end = e < 0 ? src.length : nx === "/" ? e : e + 2;
      blankAll(i, end);
      i = end;
      fresh = true;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let k = i + 1;
      while (k < src.length && src[k] !== ch && src[k] !== "\n")
        k += src[k] === "\\" ? 2 : 1;
      blankCode(i + 1, k);
      i = k + 1;
      token("0");
      continue;
    }
    if (ch === "`") {
      i = template(i + 1);
      continue;
    }
    if (ch === "/") {
      if (SLASH_EITHER.has(prev) && !(prev === "of" && dotted)) slashes.push(i);
      else if (
        REGEX_AFTER.has(prev) ||
        (!dotted && REGEX_AFTER_WORD.has(prev))
      ) {
        let k = i + 1;
        let cls = false;
        while (k < src.length && src[k] !== "\n") {
          if (src[k] === "\\") k += 2;
          else if (src[k] === "[") ((cls = true), k++);
          else if (src[k] === "]") ((cls = false), k++);
          else if (src[k] === "/" && !cls) break;
          else k++;
        }
        blankCode(i + 1, k);
        i = k + 1;
        while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
        token("0");
        continue;
      }
      token("/");
      i++;
      continue;
    }
    if (tpl.length && ch === "{") tpl[tpl.length - 1] += 1;
    if (tpl.length && ch === "}") tpl[tpl.length - 1] -= 1;
    if (/[A-Za-z0-9_$]/.test(ch)) {
      if (fresh || !/[A-Za-z0-9_$]$/.test(prev)) {
        // A name after `.`, `?.` or `#` (a private name such as `#return`) is a property, not a keyword.
        const property = prev === "." || prev === ".." || prev === "#";
        token(ch);
        dotted = property;
        fresh = false;
      } else prev += ch;
    } else if (/\s/.test(ch)) fresh = true;
    else if ((ch === "+" || ch === "-") && prev === ch && src[i - 1] === ch)
      prev = ch + ch;
    else if (
      ch === "." &&
      (prev === "." || prev === "..") &&
      src[i - 1] === "."
    )
      prev += ".";
    else if (ch === "(") {
      parens.push(
        !dotted &&
          (["if", "while", "for", "with"].includes(prev) ||
            (prev === "await" && before === "for")),
      );
      token("(");
    } else if (ch === ")") token(parens.pop() ? "ctl)" : ")");
    else token(ch);
    i++;
  }
  return { code: code.join(""), kept: kept.join(""), slashes };

  /**
   * Blanks the text of a template from `k` to its end or to its next `${`, and gives the index after it.
   * @param {number} k
   */
  function template(k) {
    const start = k;
    while (k < src.length) {
      if (src[k] === "\\") k += 2;
      else if (src[k] === "`") {
        blankCode(start, k);
        token("0");
        return k + 1;
      } else if (src[k] === "$" && src[k + 1] === "{") {
        blankCode(start, k);
        tpl.push(0);
        token("{");
        return k + 2;
      } else k++;
    }
    blankCode(start, k);
    return k;
  }
}

/**
 * The text with its comments, strings, template text and regular expressions blanked (`scan(src).code`),
 * or with `commentsOnly` only its comments (`scan(src).kept`), so a comment between the words of an import
 * hides nothing.
 * @param {string} src
 * @param {boolean} [commentsOnly]
 */
export function blank(src, commentsOnly = false) {
  const s = scan(src);
  return commentsOnly ? s.kept : s.code;
}

// A block comment and a line comment, each with one possible end (its first `*/`, the end of its line),
// so a pattern that fails never tries them again at another length.
const BLOCK = String.raw`\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\/`;
const LINE = String.raw`\/\/[^\n]*(?![^\n])`;
// What may stand between two tokens: white space and comments.
const GAP = String.raw`(?:\s|${BLOCK}|${LINE})*`;
// A string literal with its escapes, a `\` and the character after it (a quote or a line break), so a
// string such as `"x\"y'z"` or `"it's.js"` ends at its own closing quote, as it does for the scan and Node.
const STRING = String.raw`'(?:[^'\\\n]|\\[\s\S])*'|"(?:[^"\\\n]|\\[\s\S])*"`;
// The clause of a static import or export, from its keyword up to its `from`: any text but a quote and `;`,
// with whole comments and whole string literals in it (an ES2022 name such as `"get"`). The clause alone
// takes the spaces there, so no two parts of a pattern can share them.
const CLAUSE = String.raw`((?:[^'";/]|\/(?![*/])|${BLOCK}|${LINE}|${STRING})*?)`;
// The module text, its quotes included; `findings` reads the text between them.
const FROM = String.raw`\bfrom${GAP}(${STRING})`;
// Tried at every `import` and `export` word (sticky), so a clause that runs on over the next statement
// never hides that statement's own clause; `import{` and `export*` need no space.
const STATIC_IMPORT = new RegExp(
  String.raw`import(?=[\s{*/])${CLAUSE}${FROM}`,
  "y",
);
const STATIC_EXPORT = new RegExp(
  String.raw`export(?=[\s{*/])${CLAUSE}${FROM}`,
  "y",
);
const BARE_IMPORT = new RegExp(String.raw`import${GAP}(${STRING})`, "y");
const CALL = new RegExp(String.raw`\b(?:import|require)${GAP}\(${GAP}`, "g");
const LITERAL = new RegExp(String.raw`^(?:${STRING})`);
const AFTER_ARGUMENT = new RegExp(String.raw`^${GAP}[,)]`);
// The tokens of an import clause: a string literal, a comment, a brace, a comma, a star, a word.
const CLAUSE_TOKEN = new RegExp(
  String.raw`${STRING}|\/\*[\s\S]*?\*\/|\/\/[^\n]*|[{},*]|[^\s{},*'"/]+|\S`,
  "g",
);

/**
 * The imports of a file, read on the raw text (an import inside a comment counts, N1); `findings` reads
 * them again on the text with its comments blanked. `form` is "import" (`import … from`), "export"
 * (`export … from`), "bare" (`import "<m>"`) or "call" (`import("<m>")` and `require("<m>")`, whose binding
 * the clause cannot show). `spec` is the text between the quotes, its escapes kept; `at` is the place of
 * the `import` or `export` word (-1 for a call), which `declarationsOf` compares.
 * @param {string} raw
 */
export function importsOf(raw) {
  /** @type {Array<{ spec: string, clause: string, form: "import" | "export" | "bare" | "call", at: number }>} */
  const list = [];
  for (const k of raw.matchAll(/\b(import|export)\b/g)) {
    const at = k.index ?? 0;
    const re = k[1] === "import" ? STATIC_IMPORT : STATIC_EXPORT;
    re.lastIndex = at;
    const m = re.exec(raw);
    if (m)
      list.push({
        spec: m[2].slice(1, -1),
        clause: m[1],
        form: k[1] === "import" ? "import" : "export",
        at,
      });
    if (k[1] === "import") {
      BARE_IMPORT.lastIndex = at;
      const b = BARE_IMPORT.exec(raw);
      if (b)
        list.push({ spec: b[1].slice(1, -1), clause: "", form: "bare", at });
    }
  }
  for (const spec of callsOf(raw))
    if (spec !== null) list.push({ spec, clause: "", form: "call", at: -1 });
  return list;
}

/**
 * The places of the declarations of the code that name a module: every `import` word that is not a call
 * (`import(`), not `import.meta` and not a property or a key (`x.import`, `{ import: 1 }`), and every
 * `export` word followed by `*`, or by a `{…}` list and `from`. `code` is the text with its comments,
 * strings and template text blanked, so no word inside them counts and a string name (`"}"`) hides no
 * brace. `findings` makes red every place that no import form read, so a declaration the patterns cannot
 * read is never silent.
 * @param {string} code
 * @returns {number[]}
 */
export function declarationsOf(code) {
  const list = [];
  const listFrom = new RegExp(String.raw`^\s*\{[^}]*\}\s*from(?![${ID}])`);
  for (const m of code.matchAll(
    new RegExp(`(?<![${ID}.])(import|export)(?![${ID}])`, "g"),
  )) {
    const at = m.index ?? 0;
    const after = code.slice(at + m[0].length);
    if (
      m[1] === "import"
        ? /^\s*[^\s(.:]/.test(after)
        : /^\s*\*/.test(after) || listFrom.test(after)
    )
      list.push(at);
  }
  return list;
}

/**
 * The calls `import(…)` and `require(…)` of a text: for each, the module text of its first argument when
 * that argument is one string literal followed by `)` or `,`, and null for any other argument. `findings`
 * reads them on the raw text (a call inside a comment or a string counts, and a comment may stand between
 * the word, the parenthesis and the quote) and again on the blanked code, whose module texts it takes from
 * `raw`. The module rules and the non-literal rule read these lists, and the raw reading does not depend on
 * the blanking, so a call is either read as an import or red as a non-literal: the two rules never both
 * stay silent.
 * @param {string} text
 * @param {string} [raw] the text of the same length that the module texts are read from
 * @returns {Array<string | null>}
 */
export function callsOf(text, raw = text) {
  const list = [];
  for (const m of text.matchAll(CALL)) {
    const at = (m.index ?? 0) + m[0].length;
    // `import()` imports nothing (a syntax error) and `require()` throws.
    if (text[at] === ")") continue;
    const lit = LITERAL.exec(text.slice(at));
    const end = at + (lit ? lit[0].length : 0);
    list.push(
      lit && AFTER_ARGUMENT.test(text.slice(end))
        ? raw.slice(at + 1, end - 1)
        : null,
    );
  }
  return list;
}

/**
 * The bindings of an import clause, read with its comments as spaces: the default and namespace names, and
 * each named import as [imported name, local name], the quotes of a string name dropped and its escapes
 * kept, so a name written with an escape (`"getBuiltin\u004dodule"`) is never equal to a name of the
 * allowed lists. Null when the text is not one clause (it runs on over another statement, say), which the
 * rules of node:http, node:module and node:process make red.
 * @param {string} clause
 * @returns {{ bindings: string[], named: Array<[string, string]> } | null}
 */
export function clauseOf(clause) {
  const t = (clause.match(CLAUSE_TOKEN) ?? []).filter(
    (x) => !/^\/[*/]/.test(x),
  );
  const ident = (/** @type {string | undefined} */ x) =>
    x !== undefined &&
    /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u.test(x);
  /** @type {string[]} */
  const bindings = [];
  /** @type {Array<[string, string]>} */
  const named = [];
  let i = 0;
  const namespace = () => {
    if (t[i] !== "*" || t[i + 1] !== "as" || !ident(t[i + 2])) return false;
    bindings.push(t[i + 2]);
    i += 3;
    return true;
  };
  const braces = () => {
    if (t[i] !== "{") return false;
    i++;
    while (t[i] !== "}") {
      const name = t[i];
      if (name === undefined) return false;
      const str = /^(["'])[\s\S]*\1$/.test(name);
      if (!str && !ident(name)) return false;
      i++;
      let local = name;
      if (t[i] === "as") {
        if (!ident(t[i + 1])) return false;
        local = t[i + 1];
        i += 2;
      } else if (str) return false;
      named.push([str ? name.slice(1, -1) : name, local]);
      if (t[i] === ",") i++;
      else if (t[i] !== "}") return false;
    }
    i++;
    return true;
  };
  if (!namespace() && !braces()) {
    if (!ident(t[i])) return null;
    bindings.push(t[i]);
    i++;
    if (t[i] === ",") {
      i++;
      if (!namespace() && !braces()) return null;
    }
  }
  return i === t.length ? { bindings, named } : null;
}

/** @param {string} name */
const escapeName = (name) => name.replace(/\$/g, "\\$");
// The text before a default or namespace binding in its own import clause.
const IN_IMPORT =
  /\bimport\s*(?:[\p{ID_Start}$_][\p{ID_Continue}$]*\s*,\s*)?(?:\*\s*as\s+)?$/u;

/**
 * The findings on a default or namespace binding `b` of node:http in node-main.js. The binding is used
 * only as `b.<name>`, `b?.<name>` or `b["<name>"]` with a name of the server part (HTTP_NAMED), so the
 * member rules see every name read on it: the client members, `default` (the whole module again),
 * `WebSocket` and every other member are red, and so is any other use (exported, given another name,
 * passed on, read with a computed key), which hands the module on where these rules cannot see it.
 * @param {string} b
 * @param {string} raw
 * @param {string} code `raw` blanked
 * @param {string} kept `raw` with only its comments blanked
 * @returns {string[]}
 */
function httpBindingFindings(b, raw, code, kept) {
  const out = [];
  const name = escapeName(b);
  const banned = HTTP_BANNED_MEMBERS.join("|");
  const member = new RegExp(
    `(^|[^${ID}.])${name}\\s*(\\?\\.|\\.)\\s*(${banned})(?![${ID}])`,
  );
  const bracket = new RegExp(
    `(^|[^${ID}.])${name}\\s*(\\?\\.)?\\s*\\[\\s*(['"\`])(${banned})\\3\\s*\\]`,
  );
  const destructure = new RegExp(`\\}\\s*=\\s*${name}(?![${ID}])`);
  if (
    member.test(code) ||
    bracket.test(raw) ||
    bracket.test(kept) ||
    destructure.test(code)
  )
    out.push(`node:http client member on ${b}`);
  for (const m of code.matchAll(
    new RegExp(`(?<![${ID}])${name}(?![${ID}])`, "g"),
  )) {
    const at = m.index ?? 0;
    const before = code.slice(0, at);
    const after = code.slice(at + b.length);
    // A member of another object (`x.http`; the spread `...http` is not one), or the binding in its import.
    if (/(^|[^.])\.\s*$/.test(before)) continue;
    if (IN_IMPORT.test(before)) continue;
    const used =
      /^\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(after)?.[1] ??
      /^\s*(?:\?\.)?\s*\[\s*(['"`])([A-Za-z_$][\w$]*)\1\s*\]/.exec(
        kept.slice(at + b.length),
      )?.[2];
    if (used !== undefined) {
      if (HTTP_BANNED_MEMBERS.includes(used))
        out.push(`node:http client member on ${b}`);
      else if (!HTTP_NAMED.includes(used))
        out.push(`node:http member ${used} on ${b}`);
    } else if (/^\s*(?:\?\.)?\s*\[/.test(after))
      out.push(`node:http computed member on ${b}`);
    else if (/\bexport\s+default\s+$|\bexport\s*\{[^}]*$/.test(before))
      out.push(`node:http binding ${b} exported`);
    else if (/(^|[^=!<>])=\s*$/.test(before))
      out.push(`node:http binding ${b} aliased`);
    else out.push(`node:http binding ${b} as a value`);
  }
  return out;
}

/**
 * The findings on a name `b` of the process object in app/server and app/api: the global `process`, or a
 * default or namespace binding of node:process. It is used only as `b.<name>`, `b?.<name>` or `b["<name>"]`
 * with a name of PROCESS_ALLOWED (`b.default` is the whole object again, red like every other name); a
 * computed member and any other use (another name, a value passed on, a destructuring) hand the object on
 * where these rules cannot see it, and are red. `b.once(…)` gives the process object back, so it stands
 * only as a statement of its own, `b.once(…);`.
 * @param {string} b
 * @param {string} code
 * @param {string} kept `code`'s text with only its comments blanked
 * @returns {string[]}
 */
function processFindings(b, code, kept) {
  const out = [];
  for (const m of code.matchAll(
    new RegExp(`(?<![${ID}])${escapeName(b)}(?![${ID}])`, "g"),
  )) {
    const at = m.index ?? 0;
    const before = code.slice(0, at);
    const after = code.slice(at + b.length);
    if (/(^|[^.])\.\s*$/.test(before)) continue;
    if (IN_IMPORT.test(before)) continue;
    const used =
      /^\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(after)?.[1] ??
      /^\s*(?:\?\.)?\s*\[\s*(['"`])([A-Za-z_$][\w$]*)\1\s*\]/.exec(
        kept.slice(at + b.length),
      )?.[2];
    if (used !== undefined) {
      if (!PROCESS_ALLOWED.includes(used)) out.push(`process member ${used}`);
      else if (used === "once") {
        const call = /^\s*\??\.\s*once\s*\(/.exec(after);
        const end = call
          ? closeOf(code, at + b.length + call[0].length - 1)
          : -1;
        const head = before.trimEnd();
        if (
          end < 0 ||
          !(head === "" || /[;{}]$/.test(head)) ||
          !/^\s*;/.test(code.slice(end + 1))
        )
          out.push("process.once not a statement of its own");
      }
    } else if (/^\s*(?:\?\.)?\s*\[/.test(after))
      out.push("process computed member");
    else out.push("process as a value");
  }
  return out;
}

/**
 * The place of the `)` that closes the `(` at `open` in the blanked code, or -1. Strings, comments, template
 * text and regular expressions are spaces there, so every parenthesis left belongs to the code.
 * @param {string} code
 * @param {number} open
 */
function closeOf(code, open) {
  let depth = 0;
  for (let k = open; k < code.length; k++) {
    if (code[k] === "(") depth++;
    else if (code[k] === ")" && --depth === 0) return k;
  }
  return -1;
}

/** @param {string} spec */
const pkgOf = (spec) =>
  spec.startsWith("@")
    ? spec.split("/").slice(0, 2).join("/")
    : spec.split("/")[0];

/**
 * @param {string} rel the path under app/, with "/" separators
 * @param {string} raw
 * @returns {string[]}
 */
export function findings(rel, raw) {
  const out = [];
  const { code, kept, slashes } = scan(raw);
  const inServer = rel.startsWith("server/");
  const inApi = rel.startsWith("api/");
  const inShared = rel.startsWith("public/shared/");
  const inPage =
    rel.startsWith("public/js/") || rel.startsWith("public/office/");
  if (!(inServer || inApi || inShared || inPage || rel.startsWith("worker/")))
    return out;
  const dir = path.posix.dirname(rel);
  // The calls on the blanked code and on the raw text; the import forms on the raw text (N1) and on the
  // text with its comments blanked.
  const calls = [...callsOf(code, raw), ...callsOf(raw)];
  const imports = [...importsOf(raw), ...importsOf(kept)];
  for (const spec of calls)
    if (spec !== null) imports.push({ spec, clause: "", form: "call", at: -1 });
  // A declaration of the code that no form read would pass every module rule unread.
  const read = new Set(imports.map((x) => x.at));
  for (const at of declarationsOf(code))
    if (!read.has(at)) out.push("an import or export not read");
  for (const { spec, clause, form } of imports) {
    // An escape names the same module to Node but another text to these rules (`"node:https"`).
    if (spec.includes("\\")) out.push("an escape in a module text");
    if (spec.startsWith(".") || spec.startsWith("/")) {
      // In Node a module text is a path of the computer when it starts with `/`; and only a plain path
      // of a .js file is a file these rules read (`.mjs`, `.cjs`, `.ts` and `.node` files load too, and
      // `?`, `#` and `%` give a path that ends in .js to another file).
      if ((inServer || inApi) && spec.startsWith("/"))
        out.push(`import ${spec}`);
      if ((inServer || inApi) && !/^\.\.?\/[\w./-]*\.js$/.test(spec))
        out.push(`import ${spec} not a .js file`);
      const target = path.posix.normalize(path.posix.join(dir, spec));
      if (
        inServer &&
        !(target.startsWith("server/") || target.startsWith("public/shared/"))
      )
        out.push(`import ${spec}`);
      if (inApi && !["server/app.js", "server/config.js"].includes(target))
        out.push(`import ${spec}`);
      if (inShared && !target.startsWith("public/shared/"))
        out.push(`import ${spec}`);
      if (inPage && !target.startsWith("public/")) out.push(`import ${spec}`);
      continue;
    }
    if (inShared || inPage) {
      out.push(`import ${spec}`);
      continue;
    }
    if (inApi) {
      out.push(`import ${spec}`);
      continue;
    }
    if (inServer) {
      if (spec.startsWith("node:")) {
        const mod = spec.slice(5).split("/")[0];
        if (BANNED_NODE.includes(mod) || mod.startsWith("_"))
          out.push(`import ${spec}`);
        else if (mod === "http") {
          if (rel !== "server/node-main.js")
            out.push(`import ${spec} outside node-main.js`);
          // In node-main.js the member rules read the names a static `import … from` binds. A module
          // object from import( or require( is a binding they cannot see, and a re-export hands the
          // client members to every importer, so node:http comes in by a static import only.
          else if (form === "call")
            out.push("node:http by import( or require(");
          else if (form === "export") out.push("node:http re-exported");
          else if (form === "import") {
            const parsed = clauseOf(clause);
            if (!parsed) out.push("node:http import clause not read");
            else {
              for (const [name] of parsed.named)
                if (!HTTP_NAMED.includes(name))
                  out.push(`node:http member ${name}`);
              for (const b of parsed.bindings)
                out.push(...httpBindingFindings(b, raw, code, kept));
            }
          }
        } else if (mod === "module") {
          // Only `import { createRequire } from "node:module"`: the rules of `require` read the module
          // texts of that one loader, and any other member (`Module`, `register`) or form gives a loader
          // they cannot see.
          const parsed = form === "import" ? clauseOf(clause) : null;
          if (
            !parsed ||
            parsed.bindings.length > 0 ||
            JSON.stringify(parsed.named) !==
              JSON.stringify([["createRequire", "createRequire"]])
          )
            out.push("node:module other than { createRequire }");
        } else if (mod === "process") {
          // The process object again: a default or namespace binding gets the rules of `process`, and a
          // named import only a name of PROCESS_ALLOWED, compared as written (a name with an escape is
          // never one of them, and `{ default as p }` is the whole object).
          if (form === "call") out.push("node:process by import( or require(");
          else if (form === "export") out.push("node:process re-exported");
          else if (form === "import") {
            const parsed = clauseOf(clause);
            if (!parsed) out.push("node:process import clause not read");
            else {
              for (const [name] of parsed.named)
                if (!PROCESS_ALLOWED.includes(name))
                  out.push(`process member ${name}`);
              for (const b of parsed.bindings)
                out.push(...processFindings(b, code, kept));
            }
          }
        }
        continue;
      }
      const pkg = pkgOf(spec);
      if (pkg in DB_PACKAGES) {
        if (DB_PACKAGES[/** @type {keyof typeof DB_PACKAGES} */ (pkg)] !== rel)
          out.push(`import ${spec} outside its adapter`);
      } else if (!SERVER_PACKAGES.includes(pkg)) out.push(`import ${spec}`);
    }
  }
  if (calls.includes(null)) out.push("import( or require( with a non-literal");
  // `require` is read where it is called, and only the `require` of `const require = createRequire(…)`
  // reaches a module: another name for either (an alias, an argument, a computed key) would hide the
  // module text, so `createRequire` is read on the text with only its comments blanked, where a string key
  // (`m["createRequire"]`) holds it too.
  for (const m of kept.matchAll(
    new RegExp(`(?<![${ID}])createRequire(?![${ID}])`, "g"),
  )) {
    const at = m.index ?? 0;
    const before = kept.slice(0, at);
    const after = kept.slice(at + m[0].length);
    if (
      !(
        /(^|[^\w$.])(const|let|var)\s+require\s*=\s*$/.test(before) &&
        /^\s*\(/.test(after)
      ) &&
      !(/\bimport\s*\{[^}]*$/.test(before) && /^\s*[,}]/.test(after))
    )
      out.push("createRequire not bound to require");
  }
  for (const m of code.matchAll(
    new RegExp(`(?<![${ID}])require(?![${ID}])`, "g"),
  )) {
    const at = m.index ?? 0;
    const before = code.slice(0, at);
    const after = code.slice(at + m[0].length);
    // A member of another object, or a call, which the call rules read.
    if (/(^|[^.])\.\s*$/.test(before) || /^\s*\(/.test(after)) continue;
    if (
      /(^|[^\w$.])(const|let|var)\s+$/.test(before) &&
      /^\s*=\s*createRequire\s*\(/.test(after)
    )
      continue;
    out.push("require not called");
  }
  // An escape in a name (`fetch`) is the same name to the language but another text to these rules.
  if (code.includes("\\")) out.push("an escape outside a string");
  // A `/` that the scan could read either way may hide code (SLASH_EITHER).
  if ((inServer || inApi || inShared) && slashes.length > 0)
    out.push("a slash after }, ++, -- or of");
  if (inServer || inApi) {
    const fetchRe = new RegExp(`(^|[^${ID}.?])fetch(?![${ID}])`, "g");
    for (const m of code.matchAll(fetchRe)) {
      const after = code.slice((m.index ?? 0) + m[0].length);
      if (/^\s*:/.test(after)) continue;
      if (/^\s*\([^()]*\)\s*\{/.test(after)) continue;
      if (/\?\.\s*$/.test(code.slice(0, (m.index ?? 0) + m[1].length)))
        continue;
      out.push("fetch");
    }
    // The other outside clients of the runtime: `WebSocket` (a global of Node 22) and `EventSource`.
    if (
      new RegExp(`(^|[^${ID}.])(WebSocket|EventSource)(?![${ID}])`).test(code)
    )
      out.push("WebSocket or EventSource");
    if (
      new RegExp(
        `(^|[^${ID}.])(globalThis|global|self|window)(?![${ID}])`,
      ).test(code)
    )
      out.push("a global object");
    if (
      /\b(globalThis|global|self|window)\s*\[\s*(['"`])fetch\2\s*\]/.test(raw)
    )
      out.push("fetch by key");
    // Read with the strings kept, so a string key (`process["getBuiltinModule"]`) counts.
    if (new RegExp(`(^|[^${ID}])getBuiltinModule(?![${ID}])`).test(kept))
      out.push("getBuiltinModule");
    out.push(...processFindings("process", code, kept));
    // A text run as code: `eval` and `Function` as whole names not after `.` (a call, an alias such as
    // `const F = Function`, `(0, eval)(…)`, an argument of `Reflect.construct`), and `constructor` read on
    // the text with the strings kept (`f.constructor`, `f?.constructor`, `f["constructor"]`,
    // `{ constructor: F } = f`, `Reflect.get(f, "constructor")`), which gives `Function` from any function.
    // Only a method definition `constructor(…) {` that starts its line stays allowed. A named limit of
    // these text rules: a key built at run time (`f["constr" + "uctor"]`, a key held in a variable) is not
    // read, as no rule can read a computed member of an arbitrary object.
    if (new RegExp(`(^|[^${ID}.])(eval|Function)(?![${ID}])`).test(code))
      out.push("eval or Function");
    for (const m of kept.matchAll(
      new RegExp(`(?<![${ID}])constructor(?![${ID}])`, "g"),
    )) {
      const at = m.index ?? 0;
      const line = kept.slice(kept.lastIndexOf("\n", at - 1) + 1, at);
      if (
        !/^[ \t]*$/.test(line) ||
        !/^[ \t]*\([^()]*\)[ \t]*\{/.test(kept.slice(at + m[0].length))
      )
        out.push("constructor read");
    }
    // These rules read names as ASCII text: a name or a space outside ASCII would pass them unread.
    if (/[^\t\n\r -~]/.test(code))
      out.push("a non-ASCII character in the code");
  }
  if (
    inShared &&
    new RegExp(`(^|[^${ID}.])(document|window)(?![${ID}])`).test(code)
  )
    out.push("document or window");
  return [...new Set(out)];
}

/**
 * Every entry of `dir` that is not a folder, as [the path under app/, whether it is a link], except the
 * top-level node_modules/ and test/ (a node_modules/ deeper down is read).
 * @param {string} dir
 * @param {string} rel
 * @param {Array<[string, boolean]>} acc
 */
function walk(dir, rel, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (rel === "" && (e.name === "node_modules" || e.name === "test"))
      continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, acc);
    else acc.push([r, e.isSymbolicLink()]);
  }
  return acc;
}

/**
 * The entries of app/ that the rules cannot read: a link (its target is not read), and under app/server,
 * app/api and app/worker a file that is not a .js file (`.mjs`, `.cjs`, `.ts` and `.node` files load too).
 * @param {Array<[string, boolean]>} entries
 * @returns {string[]}
 */
export function fileFindings(entries) {
  const out = [];
  for (const [rel, link] of entries)
    if (link) out.push(`a link: ${rel}`);
    else if (/^(server|api|worker)\//.test(rel) && !rel.endsWith(".js"))
      out.push(`a file that is not .js: ${rel}`);
  return out;
}

test("IB-1 the real tree of app/ breaks no rule", () => {
  const entries = walk(APP, "", []);
  const files = entries
    .filter(([f, link]) => !link && f.endsWith(".js"))
    .map(([f]) => f);
  assert.ok(
    files.includes("server/node-main.js") && files.includes("api/index.js"),
  );
  const all = [
    ...fileFindings(entries),
    ...files.flatMap((f) =>
      findings(f, fs.readFileSync(path.join(APP, f), "utf8")).map(
        (x) => `${f}: ${x}`,
      ),
    ),
  ];
  assert.deepEqual(all, []);
});

// Each red twin with the finding of the rule it breaks: every rule is red on its own planted copy
// (criterion 3), so a twin that is red for another reason does not count.
const RED = [
  ["server/a.js", 'import https from "node:https";', "import node:https"],
  ["server/a.js", 'import h2 from "node:http2";', "import node:http2"],
  ["server/a.js", 'import net from "node:net";', "import node:net"],
  ["server/a.js", 'import tls from "node:tls";', "import node:tls"],
  ["server/a.js", 'const d = await import("node:dgram");', "import node:dgram"],
  [
    "server/a.js",
    'import { lookup } from "node:dns/promises";',
    "import node:dns/promises",
  ],
  [
    "server/a.js",
    'import http from "node:http";',
    "import node:http outside node-main.js",
  ],
  ["server/a.js", 'import { request } from "undici";', "import undici"],
  ["server/a.js", 'import axios from "axios";', "import axios"],
  ["server/a.js", 'import got from "got";', "import got"],
  ["server/a.js", 'import f from "node-fetch";', "import node-fetch"],
  ["server/a.js", 'import https from "https";', "import https"],
  [
    "server/a.js",
    'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nconst h = require("node:https");',
    "import node:https",
  ],
  ["server/a.js", 'import pg from "pg";', "import pg outside its adapter"],
  ["server/db/tx.js", 'import pg from "pg";', "import pg outside its adapter"],
  [
    "server/node-main.js",
    'import http from "node:http";\nhttp.request("x");',
    "node:http client member on http",
  ],
  [
    "server/node-main.js",
    'import * as h from "node:http";\nh.get("x");',
    "node:http client member on h",
  ],
  [
    "server/node-main.js",
    'import { get } from "node:http";',
    "node:http member get",
  ],
  [
    "server/node-main.js",
    'import { request as r } from "node:http";',
    "node:http member request",
  ],
  [
    "server/node-main.js",
    'import { Agent } from "node:http";',
    "node:http member Agent",
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\nhttp["request"]("x");',
    "node:http client member on http",
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\nhttp?.get("x");',
    "node:http client member on http",
  ],
  [
    "server/node-main.js",
    'const h = await import("node:http");\nh.request("x");',
    "node:http by import( or require(",
  ],
  [
    "server/node-main.js",
    'const { request } = await import("node:http");',
    "node:http by import( or require(",
  ],
  [
    "server/node-main.js",
    'import("node:http").then((m) => m.request(u));',
    "node:http by import( or require(",
  ],
  [
    "server/node-main.js",
    'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nrequire("node:http").get("x");',
    "node:http by import( or require(",
  ],
  [
    "server/node-main.js",
    'export * from "node:http";',
    "node:http re-exported",
  ],
  ["server/a.js", "await fetch(url);", "fetch"],
  ["server/a.js", "fetch (url);", "fetch"],
  ["server/a.js", "globalThis.fetch(url);", "a global object"],
  ["server/a.js", "const f = globalThis.fetch;", "a global object"],
  ["server/a.js", 'globalThis["fetch"];', "fetch by key"],
  ["server/a.js", "const f = fetch;", "fetch"],
  ["server/a.js", "const t = `${fetch(url)}`;", "fetch"],
  ["server/a.js", "const { fetch: f } = globalThis;", "a global object"],
  ["server/a.js", 'Reflect.get(globalThis, "fetch");', "a global object"],
  [
    "server/a.js",
    'process.getBuiltinModule("node:https");',
    "getBuiltinModule",
  ],
  [
    "server/node-main.js",
    'import * as http from "node:http";\nconst { request } = http;',
    "node:http client member on http",
  ],
  ["server/a.js", '// import x from "node:https"', "import node:https"],
  [
    "server/a.js",
    'import x from "../../tools/src/x.js";',
    "import ../../tools/src/x.js",
  ],
  ["server/a.js", 'import x from "../worker/x.js";', "import ../worker/x.js"],
  [
    "server/a.js",
    "await import(name);",
    "import( or require( with a non-literal",
  ],
  [
    "server/a.js",
    'import cp from "node:child_process";',
    "import node:child_process",
  ],
  [
    "server/a.js",
    'import { Worker } from "node:worker_threads";',
    "import node:worker_threads",
  ],
  ["server/a.js", "eval(code);", "eval or Function"],
  ["server/a.js", 'import x from "honox";', "import honox"],
  ["server/a.js", 'import x from "pg-native";', "import pg-native"],
  [
    "server/a.js",
    'import { PGlite } from "@electric-sql/pglite";',
    "import @electric-sql/pglite outside its adapter",
  ],
  [
    "api/index.js",
    'import x from "../server/db/pg.js";',
    "import ../server/db/pg.js",
  ],
  ["public/shared/a.js", "document.title = 1;", "document or window"],
  ["public/shared/a.js", "const w = window;", "document or window"],
  ["public/shared/a.js", 'import x from "../js/x.js";', "import ../js/x.js"],
  [
    "public/js/a.js",
    'import x from "../../server/app.js";',
    "import ../../server/app.js",
  ],
  // A comment inside a call or between the words of an import, a call whose argument is more than one
  // literal, and the node:http binding exported, given another name, passed on or read by a computed key.
  [
    "server/node-main.js",
    'const h = await import(\n  // the server part\n  "node:http"\n);\nh.get("x");',
    "node:http by import( or require(",
  ],
  ["server/a.js", 'await import(/* x */ "node:https");', "import node:https"],
  ["server/a.js", 'await import("node:https" /* x */);', "import node:https"],
  [
    "server/a.js",
    'await import("node:https", { with: {} });',
    "import node:https",
  ],
  ["server/a.js", 'await import /* x */ ("node:https");', "import node:https"],
  [
    "server/a.js",
    'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nrequire(\n  // x\n  "node:https",\n);',
    "import node:https",
  ],
  [
    "server/a.js",
    'await import("node:" + "https");',
    "import( or require( with a non-literal",
  ],
  ["server/a.js", 'import x from /* x */ "node:https";', "import node:https"],
  ["server/a.js", 'import /* "x" */ x from "node:https";', "import node:https"],
  ["server/a.js", 'import /* x */ "node:https";', "import node:https"],
  [
    "server/node-main.js",
    'export * from /* x */ "node:http";',
    "node:http re-exported",
  ],
  [
    "server/node-main.js",
    'import * as http from "node:http";\nexport { http };',
    "node:http binding http exported",
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\nexport default http;',
    "node:http binding http exported",
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\nconst h = http;\nh.request("x");',
    "node:http binding http aliased",
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\nuse(http);',
    "node:http binding http as a value",
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\nconst k = "request";\nhttp[k]("x");',
    "node:http computed member on http",
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\nhttp[/* x */ "request"]("x");',
    "node:http client member on http",
  ],
  [
    "server/node-main.js",
    'import /* x */ http from "node:http";\nhttp.request("x");',
    "node:http client member on http",
  ],
  [
    "server/node-main.js",
    'import http, * as h from "node:http";\nh.request("x");',
    "node:http client member on h",
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\n[...http.get("x")];',
    "node:http client member on http",
  ],
  [
    "server/node-main.js",
    'import $ from "node:http";\n$.request("x");',
    "node:http client member on $",
  ],
  // An escape, and a `require` that hides its module text behind another name.
  [
    "server/a.js",
    'import x from "node:\\u0068ttps";',
    "an escape in a module text",
  ],
  ["server/a.js", "\\u0066etch(url);", "an escape outside a string"],
  [
    "server/a.js",
    'import { createRequire } from "node:module";\nconst r = createRequire(import.meta.url);\nr("node:https");',
    "createRequire not bound to require",
  ],
  [
    "server/a.js",
    'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nconst r = require;\nr("node:https");',
    "require not called",
  ],
  // An ES2022 string name in a clause, a clause without spaces, and a clause that runs on over the next
  // statement, whose own clause is still read.
  [
    "server/a.js",
    'import { "get" as get } from "node:https";\nget("https://x");',
    "import node:https",
  ],
  [
    "server/node-main.js",
    'import { "request" as r } from "node:http";\nr("http://x");',
    "node:http member request",
  ],
  [
    "server/node-main.js",
    'export { "request" as r } from "node:http";',
    "node:http re-exported",
  ],
  ["server/a.js", 'import { "x" as y } from "axios";', "import axios"],
  [
    "api/index.js",
    'import { "x" as y } from "../server/db/pg.js";',
    "import ../server/db/pg.js",
  ],
  ["server/a.js", 'import{get}from"node:https";', "import node:https"],
  ["server/node-main.js", 'export*from"node:http";', "node:http re-exported"],
  [
    "server/node-main.js",
    'const u = import .meta.url\nimport * as http from "node:http"\nhttp.get(u)',
    "node:http client member on http",
  ],
  [
    "server/node-main.js",
    'const u = import .meta.url\nimport { createServer } from "node:http"',
    "node:http import clause not read",
  ],
  // On a node:http binding only the members of the server part: `default` is the whole module again;
  // a binding whose name is not ASCII.
  [
    "server/node-main.js",
    'import * as http from "node:http";\nhttp.default.get("http://x");',
    "node:http member default on http",
  ],
  [
    "server/node-main.js",
    'import * as http from "node:http";\nhttp?.default?.request("http://x");',
    "node:http member default on http",
  ],
  [
    "server/node-main.js",
    'import * as http from "node:http";\nnew http.WebSocket("ws://x");',
    "node:http member WebSocket on http",
  ],
  [
    "server/node-main.js",
    'import π from "node:http";\nπ.request("http://x");',
    "node:http client member on π",
  ],
  [
    "server/node-main.js",
    'import π from "node:http";\nπ.request("http://x");',
    "a non-ASCII character in the code",
  ],
  // A loader by a computed key, node:module beyond `{ createRequire }`, and the process object.
  [
    "server/a.js",
    'import * as m from "node:module";\nconst r = m["createRequire"](import.meta.url);\nr("node:https").get("https://x");',
    "node:module other than { createRequire }",
  ],
  [
    "server/a.js",
    'import { Module } from "node:module";\nModule._load("node:https");',
    "node:module other than { createRequire }",
  ],
  [
    "server/a.js",
    'const r = lib["createRequire"](import.meta.url);',
    "createRequire not bound to require",
  ],
  [
    "server/a.js",
    'process["getBuiltinModule"]("node:https").get("https://x");',
    "getBuiltinModule",
  ],
  [
    "server/a.js",
    'process[`getBuiltinModule`]("node:https");',
    "process member getBuiltinModule",
  ],
  [
    "server/a.js",
    'process["getBuiltin" + "Module"]("node:https");',
    "process computed member",
  ],
  [
    "server/a.js",
    'const p = process;\np["getBuiltin" + "Module"]("node:https");',
    "process as a value",
  ],
  [
    "server/a.js",
    'import p from "node:process";\np["getBuiltin" + "Module"]("node:https");',
    "process computed member",
  ],
  [
    "server/a.js",
    'import { getBuiltinModule as g } from "node:process";',
    "process member getBuiltinModule",
  ],
  [
    "server/a.js",
    'const p = await import("node:process");',
    "node:process by import( or require(",
  ],
  ["server/a.js", 'process.binding("tcp_wrap");', "process member binding"],
  // A call the old blanking hid: a regular expression after the `)` of a condition, a name that begins
  // with a keyword.
  [
    "server/a.js",
    'if (x) /"/.test(s), import(/**/"node:https");',
    "import node:https",
  ],
  [
    "server/a.js",
    'if (x) /"/.test(s), import(name);',
    "import( or require( with a non-literal",
  ],
  [
    "server/a.js",
    'if (x) /"/.test(s), require(name);',
    "import( or require( with a non-literal",
  ],
  [
    "server/a.js",
    'const p = (returnValue / 1, import(/* c */ "node:https")) / 1;',
    "import node:https",
  ],
  // The raw reading alone sees a call that the scan hides behind a slash it cannot read.
  [
    "server/a.js",
    'if (x) {} /"/.test(s), import(name); //"',
    "import( or require( with a non-literal",
  ],
  // Each place of the scan where a `/` is a regular expression or a division: the call stays visible, or
  // the slash is red where both readings are open.
  ["server/a.js", 'if (x) /"/.test(s), fetch(url); //"', "fetch"],
  ["server/a.js", "const p = (returnValue / 1, fetch(url)) / 1;", "fetch"],
  ["server/a.js", 'const t = `${/"/.test(s) ? fetch(url) : 1}`; //"', "fetch"],
  [
    "server/a.js",
    'for await (const x of y) /"/.test(s), fetch(url); //"',
    "fetch",
  ],
  [
    "server/a.js",
    'function f() {\n  if (a) return 1;\n  else return /"/.test(s), fetch(url); //"\n}',
    "fetch",
  ],
  [
    "server/a.js",
    "const v = x.return / 1, f = fetch(url), w = 1 / 2;",
    "fetch",
  ],
  [
    "server/a.js",
    "class A {\n  #return = 1;\n  m() {\n    return this.#return / 1, fetch(url), 1 / 2;\n  }\n}",
    "fetch",
  ],
  ["server/a.js", 'const a = [.../"/.exec(s), fetch(url)]; //"', "fetch"],
  ["server/a.js", 'const a = b / /"/.lastIndex, c = fetch(url); //"', "fetch"],
  [
    "server/a.js",
    'if (x) {} /"/.test(s), fetch(url); //"',
    "a slash after }, ++, -- or of",
  ],
  [
    "server/a.js",
    'const a = ++/"/.lastIndex, b = fetch(url); //"',
    "a slash after }, ++, -- or of",
  ],
  [
    "server/a.js",
    'for (const m of /"/.exec(s) ?? [fetch(url)]) m; //"',
    "a slash after }, ++, -- or of",
  ],
  // The other outside clients and the modules that reach the network, run code or start a process.
  ["server/a.js", 'new WebSocket("wss://x");', "WebSocket or EventSource"],
  [
    "server/a.js",
    'import { ClientRequest } from "node:_http_client";',
    "import node:_http_client",
  ],
  [
    "server/a.js",
    'import { connect } from "node:_tls_wrap";',
    "import node:_tls_wrap",
  ],
  [
    "server/a.js",
    'import { Session } from "node:inspector";',
    "import node:inspector",
  ],
  ["server/a.js", 'import cluster from "node:cluster";', "import node:cluster"],
  // A path of the computer, and module texts that are not a plain path of a .js file.
  ["server/a.js", 'await import("/opt/x.js");', "import /opt/x.js"],
  ["server/a.js", 'import "./evil.mjs";', "import ./evil.mjs not a .js file"],
  ["server/a.js", 'import "./evil.ts";', "import ./evil.ts not a .js file"],
  [
    "server/a.js",
    'import "./evil.mjs?.js";',
    "import ./evil.mjs?.js not a .js file",
  ],
  [
    "server/a.js",
    'require("./native.node");',
    "import ./native.node not a .js file",
  ],
  // A string with an escaped quote, the other quote or a line continuation in a clause or a module text
  // (prettier keeps `"x\"y'z"`), each read to its own closing quote; a declaration no form can read.
  [
    "server/a.js",
    'export { request as "x\\"y\'z" } from "node:https";',
    "import node:https",
  ],
  [
    "server/a.js",
    'import { "x\\"y\'z" as z } from "../worker/x.js";',
    "import ../worker/x.js",
  ],
  [
    "server/a.js",
    'import { "x\\"y\'z" as z } from "../../tools/src/x.js";',
    "import ../../tools/src/x.js",
  ],
  [
    "server/a.js",
    'import { "x\\"y\'z" as h } from "node:http";',
    "import node:http outside node-main.js",
  ],
  [
    "server/a.js",
    'import { "a\\\nb" as r } from "node:https";',
    "import node:https",
  ],
  [
    "server/a.js",
    'import x from "../worker/it\'s.js";',
    "import ../worker/it's.js",
  ],
  ["server/a.js", 'import "../worker/it\'s.js";', "import ../worker/it's.js"],
  [
    "server/node-main.js",
    'import { "x\\"y\'z" as w, createServer } from "node:http";',
    "node:http member x\\\"y'z",
  ],
  [
    "api/index.js",
    'import { "x\\"y\'z" as y } from "../server/db/pg.js";',
    "import ../server/db/pg.js",
  ],
  [
    "public/shared/a.js",
    'import { "x\\"y\'z" as y } from "../js/x.js";',
    "import ../js/x.js",
  ],
  [
    "server/a.js",
    "import x from `node:https`;",
    "an import or export not read",
  ],
  [
    "server/node-main.js",
    "export * from `node:http`;",
    "an import or export not read",
  ],
  // node:process by its allowed members only: a name with an escape, `default` (the whole object), a
  // member read on it, `execve`, and a member that no list names.
  [
    "server/a.js",
    'import { "getBuiltin\\u004dodule" as g } from "node:process";\nexport const get = g("node:https").get;',
    "process member getBuiltin\\u004dodule",
  ],
  [
    "server/a.js",
    'import { "bind\\u0069ng" as b } from "node:process";\nb("spawn_sync");',
    "process member bind\\u0069ng",
  ],
  [
    "server/a.js",
    'import { default as p } from "node:process";\np.dlopen(m, "/opt/addon.node");',
    "process member default",
  ],
  [
    "server/a.js",
    'import * as p from "node:process";\np.default.binding("spawn_sync");',
    "process member default",
  ],
  [
    "server/a.js",
    'import { default as p } from "node:process";\np.binding("spawn_sync");',
    "process member default",
  ],
  [
    "server/a.js",
    'process.execve?.("/usr/bin/curl", ["curl", "https://example.invalid/"]);',
    "process member execve",
  ],
  ["server/a.js", "process.report.writeReport();", "process member report"],
  [
    "api/index.js",
    'process.dlopen(m, "/opt/addon.node");',
    "process member dlopen",
  ],
  // `once` gives the process object back: chained, given a name, passed on.
  [
    "server/a.js",
    'process.once("SIGUSR2", () => {}).execve("/usr/bin/curl", ["curl"]);',
    "process.once not a statement of its own",
  ],
  [
    "server/a.js",
    'const p = process.once("SIGUSR2", () => {});\np.binding("spawn_sync");',
    "process.once not a statement of its own",
  ],
  [
    "server/a.js",
    'use(process.once("SIGUSR2", f));',
    "process.once not a statement of its own",
  ],
  // A text run as code through another name for eval or Function, or through `constructor`.
  [
    "server/a.js",
    'const F = Function;\nexport const f = F("return fe" + "tch")();',
    "eval or Function",
  ],
  [
    "server/a.js",
    'export const f = (0, eval)("fe" + "tch");',
    "eval or Function",
  ],
  [
    "server/a.js",
    'export const f = Reflect.construct(Function, ["return fe" + "tch"])();',
    "eval or Function",
  ],
  ["api/index.js", "const e = eval;", "eval or Function"],
  [
    "server/a.js",
    'export const f = (() => {}).constructor("return fe" + "tch")();',
    "constructor read",
  ],
  ["server/a.js", "const { constructor: F } = () => {};", "constructor read"],
  [
    "server/a.js",
    'const F = Reflect.get(() => {}, "constructor");',
    "constructor read",
  ],
  ["server/a.js", 'const F = f?.["constructor"];', "constructor read"],
];

const GREEN = [
  ["server/node-main.js", 'import { createServer } from "node:http";'],
  [
    "server/node-main.js",
    'import { createServer, STATUS_CODES } from "node:http";',
  ],
  [
    "server/node-main.js",
    'import http from "node:http";\nhttp.createServer();',
  ],
  ["server/node-main.js", "const x = 1;"],
  [
    "server/app.js",
    'import { cors } from "hono/cors";\napp.get("/x");\nmap.get(k);\napp.request("/x");',
  ],
  [
    "server/config.js",
    'import process from "node:process";\nimport fs from "node:fs/promises";',
  ],
  ["server/db/pg.js", 'import pg from "pg";'],
  ["server/db/pglite.js", 'import { PGlite } from "@electric-sql/pglite";'],
  ["server/db/migrate.js", 'import { x } from "./pg.js";'],
  [
    "api/index.js",
    'import { createApp } from "../server/app.js";\nimport { readConfig } from "../server/config.js";',
  ],
  ["server/a.js", "app.fetch(new Request(u, req));"],
  ["server/a.js", "export default { fetch(request) { return 1; } };"],
  ["server/a.js", "const o = { async fetch(request) { return 1; } };"],
  ["server/a.js", "serve({ fetch: app.fetch });"],
  ["server/a.js", "export default { fetch: app.fetch };"],
  ["server/a.js", "// fetch(x)\nconst s = 'fetch(x)';"],
  ["server/a.js", "prefetch(); refetch(); fetchAll();"],
  [
    "server/a.js",
    'import { x } from "../public/shared/x.js";\nimport { y } from "./http/y.js";',
  ],
  ["public/shared/a.js", "const windowSize = opts.document;"],
  ["public/js/a.js", 'import { x } from "../shared/x.js";'],
  // The allowed forms beside the rules of the comments, the binding and `require`.
  [
    "server/a.js",
    'const { x } = await import(/* the adapter */ "./db/pg.js");',
  ],
  [
    "server/node-main.js",
    'import * as http from "node:http";\nconst server = http.createServer();\nexport { server };',
  ],
  [
    "server/a.js",
    'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nconst x = require("./x.js");',
  ],
  ["server/a.js", "const required = opts.require;\nrequireAll();"],
  // The members of process that load nothing, a division and a regular expression the scan reads right,
  // and a server name read by a string key.
  [
    "server/a.js",
    'process.stdout.write(`${process.env.X ?? ""}\\n`);\nprocess.exitCode = process.argv[1] ? 0 : 1;',
  ],
  [
    "server/a.js",
    "const s = (Date.now() - t0) / 1000;\nconst ok = /^v22\\./.test(v) && a.length / 2 > 1;",
  ],
  [
    "server/node-main.js",
    'import * as http from "node:http";\nhttp["createServer"]();',
  ],
  // A string name with an escaped quote from an own file, a local export list, the members of process the
  // app uses, a method definition `constructor`, and names that only contain eval or Function.
  [
    "server/a.js",
    'import { "x\\"y\'z" as y } from "./x.js";\nexport { y };\nexport const s = "it\'s";',
  ],
  [
    "server/a.js",
    'import { env, argv } from "node:process";\nconst a = env.X ?? argv[1];',
  ],
  [
    "server/a.js",
    'process.once("SIGTERM", stop);\nprocess.exit(process.exitCode ?? 0);\nprocess.stderr.write(process.version);',
  ],
  [
    "server/a.js",
    'function main() {\n  process.once("SIGINT", () => {\n    stop(f(1));\n  });\n}',
  ],
  [
    "server/a.js",
    "export class E extends Error {\n  constructor(code, message) {\n    super(message);\n    this.code = code;\n  }\n}",
  ],
  [
    "server/a.js",
    'const evaluate = o.eval;\nconst Functions = o.Function;\nconst s = "Function";',
  ],
];

test("IB-2 every planted twin that breaks a rule is red with its own finding", (t) => {
  assert.equal(RED.length, 161);
  for (const [rel, text, label] of RED)
    assert.ok(
      findings(rel, text).includes(label),
      `${rel}: ${text} -> ${JSON.stringify(findings(rel, text))}`,
    );
  // The entries the rules cannot read are red, and a node_modules/ below the top is read.
  /** @type {Array<[[string, boolean], string]>} */
  const entries = [
    [["server/evil.mjs", false], "a file that is not .js: server/evil.mjs"],
    [["api/evil.ts", false], "a file that is not .js: api/evil.ts"],
    [["server/lib", true], "a link: server/lib"],
  ];
  for (const [entry, label] of entries)
    assert.ok(fileFindings([entry]).includes(label), label);
  assert.deepEqual(
    fileFindings([
      ["server/app.js", false],
      ["public/index.html", false],
    ]),
    [],
  );
  const dir = tempDir(t);
  fs.mkdirSync(path.join(dir, "server", "node_modules"), { recursive: true });
  fs.mkdirSync(path.join(dir, "node_modules"));
  fs.writeFileSync(path.join(dir, "server", "node_modules", "x.js"), "");
  fs.writeFileSync(path.join(dir, "node_modules", "y.js"), "");
  assert.deepEqual(walk(dir, "", []), [["server/node_modules/x.js", false]]);
});

test("IB-3 every planted twin that keeps the rules is green", () => {
  for (const [rel, text] of GREEN)
    assert.deepEqual(findings(rel, text), [], `${rel}: ${text}`);
});

test("IB-4 the blanking: comments, strings and template text are blank, ${…} code stays; bracket keys are read on the raw text", () => {
  for (const text of [
    "// fetch(x)",
    "/* fetch(x) */",
    'const s = "fetch(x)";',
    "const s = 'fetch(x)';",
    "const t = `fetch(x)`;",
  ])
    assert.deepEqual(findings("server/a.js", text), [], text);
  assert.deepEqual(findings("server/a.js", "const t = `a ${fetch(x)} b`;"), [
    "fetch",
  ]);
  const src = 'const t = `a ${fetch(x)} b`; // c d\nconst s = "e f";';
  const blanked = blank(src);
  assert.equal(blanked.length, src.length);
  assert.equal(blanked.split("\n").length, src.split("\n").length);
  assert.ok(blanked.includes("${fetch(x)}"), blanked);
  assert.doesNotMatch(blanked, /a \$|c d|e f/);
  // With only the comments blanked, the strings and the template text stay where they were.
  assert.equal(blank(src, true), src.replace("// c d", " ".repeat(6)));
  const byKey = 'globalThis["fetch"];';
  assert.doesNotMatch(blank(byKey), /fetch/);
  assert.ok(findings("server/a.js", byKey).includes("fetch by key"));
  const member = 'import http from "node:http";\nhttp["request"]("x");';
  assert.doesNotMatch(blank(member), /request/);
  assert.deepEqual(findings("server/node-main.js", member), [
    "node:http client member on http",
  ]);
  // A `/` after the `)` of a condition or after `return` starts a regular expression, after a name or the
  // `)` of a call it divides, and after `}`, `++`, `--` or `of` it is listed in `slashes`.
  assert.equal(blank('if (x) /"/.test(s);'), "if (x) / /.test(s);");
  assert.equal(blank('f(x) / "a";'), 'f(x) / " ";');
  assert.equal(blank('else return /"/;'), "else return / /;");
  assert.equal(blank('returnValue / "a";'), 'returnValue / " ";');
  // The raw reading does not depend on the scan: a comment that holds a quote may stand between the words
  // of an import, and between the word, the parenthesis and the quote of a call.
  for (const text of [
    'import x from /* " */ "node:https";',
    'import /* " */ x from "node:https";',
    'import /* " */ "node:https";',
    'export * from /* " */ "node:https";',
  ])
    assert.deepEqual(
      importsOf(text).map((x) => x.spec),
      ["node:https"],
      text,
    );
  assert.deepEqual(callsOf('import /* " */ (/* " */ "node:https")'), [
    "node:https",
  ]);
  // A string is read to its own closing quote, its escapes kept: in a clause, in a module text, in a call.
  assert.deepEqual(
    importsOf('export { request as "x\\"y\'z" } from "node:https";').map(
      (x) => [x.spec, x.at],
    ),
    [["node:https", 0]],
  );
  assert.deepEqual(
    importsOf('import "./it\'s.js";\nimport y from "./a\\"b.js";').map(
      (x) => x.spec,
    ),
    ["./it's.js", './a\\"b.js'],
  );
  assert.deepEqual(callsOf('import("./it\'s.js")'), ["./it's.js"]);
  assert.deepEqual(clauseOf('{ "x\\"y\'z" as r, "a\\\nb" as s }'), {
    bindings: [],
    named: [
      ["x\\\"y'z", "r"],
      ["a\\\nb", "s"],
    ],
  });
  // The declarations that name a module, and the words that are not one: a call, import.meta, a property,
  // a key, a local export list, and the words inside a string or a comment.
  const decl =
    'import x from "a";\nexport { y };\nexport * from "b";\nexport { "}" as z } from "c";\nimport.meta.url;\nimport("d");\no.import;\nconst k = { import: 1 };\n// import w from "e"\nconst s = "import v from \'f\'";';
  assert.deepEqual(declarationsOf(blank(decl)), [
    0,
    decl.indexOf("export *"),
    decl.indexOf('export { "}"'),
  ]);
  assert.deepEqual(
    scan("{} /a/;\nx++ / 2;\nfor (y of /b/);").slashes,
    [3, 12, 27],
  );
});
