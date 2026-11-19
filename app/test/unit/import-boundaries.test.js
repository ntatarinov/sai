import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { APP } from "../fixtures/helpers.js";

// REQ-108 criterion 3 (ARCH §2.2, decisions/0094, decisions/0116 О22, N1, N2).

const ID = "A-Za-z0-9_$";
const SERVER_PACKAGES = ["hono", "@hono/node-server", "zod", "fflate"];
const DB_PACKAGES = {
  pg: "server/db/pg.js",
  "@electric-sql/pglite": "server/db/pglite.js",
};
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

/**
 * Blanks comments, strings and the text of template literals (the code of `${…}` stays) with spaces,
 * keeping line breaks and lengths.
 * @param {string} src
 */
export function blank(src) {
  const out = src.split("");
  let i = 0;
  /** @type {number[]} */
  const tpl = [];
  let prev = "";
  const fill = (/** @type {number} */ a, /** @type {number} */ b) => {
    for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < src.length) {
    const ch = src[i];
    const nx = src[i + 1];
    if (tpl.length && tpl[tpl.length - 1] === 0 && ch === "}") {
      tpl.pop();
      i = scanTemplate(i + 1);
      continue;
    }
    if (ch === "/" && nx === "/") {
      const e = src.indexOf("\n", i);
      const end = e < 0 ? src.length : e;
      fill(i, end);
      i = end;
      continue;
    }
    if (ch === "/" && nx === "*") {
      const e = src.indexOf("*/", i + 2);
      const end = e < 0 ? src.length : e + 2;
      fill(i, end);
      i = end;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let k = i + 1;
      while (k < src.length && src[k] !== ch && src[k] !== "\n")
        k += src[k] === "\\" ? 2 : 1;
      fill(i + 1, k);
      i = k + 1;
      prev = "x";
      continue;
    }
    if (ch === "`") {
      i = scanTemplate(i + 1);
      prev = "x";
      continue;
    }
    if (ch === "/" && /[(,=:[!&|?{};+\-*%<>~^]|^$|return|typeof/.test(prev)) {
      let k = i + 1;
      let cls = false;
      while (k < src.length && src[k] !== "\n") {
        if (src[k] === "\\") k += 2;
        else if (src[k] === "[") ((cls = true), k++);
        else if (src[k] === "]") ((cls = false), k++);
        else if (src[k] === "/" && !cls) break;
        else k++;
      }
      fill(i + 1, k);
      i = k + 1;
      prev = "x";
      continue;
    }
    if (tpl.length && ch === "{") tpl[tpl.length - 1] += 1;
    if (tpl.length && ch === "}") tpl[tpl.length - 1] -= 1;
    if (!/\s/.test(ch))
      prev = /[A-Za-z0-9_$]/.test(ch)
        ? /[A-Za-z]/.test(prev)
          ? prev + ch
          : ch
        : ch;
    i++;
  }
  return out.join("");

  /** @param {number} k */
  function scanTemplate(k) {
    const start = k;
    while (k < src.length) {
      if (src[k] === "\\") k += 2;
      else if (src[k] === "`") {
        fill(start, k);
        return k + 1;
      } else if (src[k] === "$" && src[k + 1] === "{") {
        fill(start, k);
        tpl.push(0);
        return k + 2;
      } else k++;
    }
    fill(start, k);
    return k;
  }
}

/**
 * The imports of a file, read on the raw text (an import inside a comment counts, N1). `form` is
 * "import" (`import … from`), "export" (`export … from`), "bare" (`import "<m>"`) or "call"
 * (`import("<m>")` and `require("<m>")`, whose binding the clause cannot show).
 * @param {string} raw
 */
export function importsOf(raw) {
  /** @type {Array<{ spec: string, clause: string, form: "import" | "export" | "bare" | "call" }>} */
  const list = [];
  for (const m of raw.matchAll(
    /\bimport\s+([^'";]*?)\s*\bfrom\s*(['"])([^'"]+)\2/g,
  ))
    list.push({ spec: m[3], clause: m[1], form: "import" });
  for (const m of raw.matchAll(
    /\bexport\s+([^'";]*?)\s*\bfrom\s*(['"])([^'"]+)\2/g,
  ))
    list.push({ spec: m[3], clause: m[1], form: "export" });
  for (const m of raw.matchAll(/\bimport\s*(['"])([^'"]+)\1/g))
    list.push({ spec: m[2], clause: "", form: "bare" });
  for (const m of raw.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g))
    list.push({ spec: m[2], clause: "", form: "call" });
  for (const m of raw.matchAll(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g))
    list.push({ spec: m[2], clause: "", form: "call" });
  return list;
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
  const code = blank(raw);
  const inServer = rel.startsWith("server/");
  const inApi = rel.startsWith("api/");
  const inShared = rel.startsWith("public/shared/");
  const inPage =
    rel.startsWith("public/js/") || rel.startsWith("public/office/");
  if (!(inServer || inApi || inShared || inPage || rel.startsWith("worker/")))
    return out;
  const dir = path.posix.dirname(rel);
  for (const { spec, clause, form } of importsOf(raw)) {
    if (spec.startsWith(".") || spec.startsWith("/")) {
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
        if (BANNED_NODE.includes(mod)) out.push(`import ${spec}`);
        else if (mod === "http") {
          if (rel !== "server/node-main.js")
            out.push(`import ${spec} outside node-main.js`);
          // In node-main.js the member rules read the names a static `import … from` binds. A module
          // object from import( or require( is a binding they cannot see, and a re-export hands the
          // client members to every importer, so node:http comes in by a static import only.
          else if (form === "call")
            out.push("node:http by import( or require(");
          else if (form === "export") out.push("node:http re-exported");
          else {
            const named = /\{([^}]*)\}/.exec(clause);
            if (named)
              for (const part of named[1].split(",")) {
                const name = part.trim().split(/\s+as\s+/)[0];
                if (name && !HTTP_NAMED.includes(name))
                  out.push(`node:http member ${name}`);
              }
            const binding = /^\s*(?:\*\s*as\s+)?([A-Za-z_$][\w$]*)/.exec(
              clause.replace(/\{[^}]*\}/, ""),
            );
            if (binding && binding[1] !== "") {
              const b = binding[1];
              const member = new RegExp(
                `(^|[^${ID}.])${b}\\s*(\\?\\.|\\.)\\s*(${HTTP_BANNED_MEMBERS.join("|")})(?![${ID}])`,
              );
              const bracket = new RegExp(
                `(^|[^${ID}.])${b}\\s*(\\?\\.)?\\s*\\[\\s*(['"\`])(${HTTP_BANNED_MEMBERS.join("|")})\\3\\s*\\]`,
              );
              const destructure = new RegExp(`\\}\\s*=\\s*${b}(?![${ID}])`);
              if (
                member.test(code) ||
                bracket.test(raw) ||
                destructure.test(code)
              )
                out.push(`node:http client member on ${b}`);
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
  if (
    /\bimport\s*\(\s*[^'"\s]/.test(code.replace(/import\s*\(\s*\s*\)/g, "")) ||
    /\brequire\s*\(\s*[^'"\s)]/.test(code)
  ) {
    const lit = /\b(import|require)\s*\(\s*(['"])/g;
    const all = /\b(import|require)\s*\(/g;
    if ((raw.match(all) ?? []).length !== (raw.match(lit) ?? []).length)
      out.push("import( or require( with a non-literal");
  }
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
    if (new RegExp(`(^|[^${ID}])getBuiltinModule(?![${ID}])`).test(code))
      out.push("getBuiltinModule");
    if (new RegExp(`(^|[^${ID}.])(eval|Function)\\s*\\(`).test(code))
      out.push("eval or Function");
  }
  if (
    inShared &&
    new RegExp(`(^|[^${ID}.])(document|window)(?![${ID}])`).test(code)
  )
    out.push("document or window");
  return out;
}

/** @param {string} dir @param {string} rel @param {string[]} acc */
function walk(dir, rel, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || (rel === "" && e.name === "test"))
      continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, acc);
    else if (e.name.endsWith(".js")) acc.push(r);
  }
  return acc;
}

test("IB-1 the real tree of app/ breaks no rule", () => {
  const files = walk(APP, "", []);
  assert.ok(
    files.includes("server/node-main.js") && files.includes("api/index.js"),
  );
  const all = files.flatMap((f) =>
    findings(f, fs.readFileSync(path.join(APP, f), "utf8")).map(
      (x) => `${f}: ${x}`,
    ),
  );
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
];

test("IB-2 every planted twin that breaks a rule is red with its own finding", () => {
  assert.equal(RED.length, 53);
  for (const [rel, text, label] of RED)
    assert.ok(
      findings(rel, text).includes(label),
      `${rel}: ${text} -> ${JSON.stringify(findings(rel, text))}`,
    );
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
  const byKey = 'globalThis["fetch"];';
  assert.doesNotMatch(blank(byKey), /fetch/);
  assert.ok(findings("server/a.js", byKey).includes("fetch by key"));
  const member = 'import http from "node:http";\nhttp["request"]("x");';
  assert.doesNotMatch(blank(member), /request/);
  assert.deepEqual(findings("server/node-main.js", member), [
    "node:http client member on http",
  ]);
});
