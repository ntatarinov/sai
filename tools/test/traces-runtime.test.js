// REQ-014, criterion 4: no external service at run time (design REQ-014, 11, TR-4a-TR-4f).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { listRepoFiles, repoRoot } from "../src/traces/git-files.js";
import { TOOLS, makeRepo } from "./fixtures/traces/helpers.js";

const SRC = path.join(TOOLS, "src");
const NETWORK_FILES = [
  "pixel-office/hook.js",
  "pixel-office/main.js",
  "pixel-office/note.js",
  "pixel-office/server.js",
  "pixel-office/public/boot.js",
  "web/server.js",
  "web/public/app.js",
];
const CHILD_PROCESS_FILES = [
  "handoffs/git-history.js",
  "team/executors/claude-cli.js",
  "traces/git-files.js",
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (e.isFile()) out.push(abs);
  }
  return out;
}

function srcFiles(ext) {
  return walk(SRC)
    .filter((f) => f.endsWith(ext))
    .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
    .sort();
}

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), "utf8");
}

const NET = "(?:node:)?(?:http|https|net|tls|dgram)";
const NETWORK_FORMS = [
  new RegExp(`\\bfrom\\s*["']${NET}["']`, "u"),
  new RegExp(`\\bimport\\s*\\(\\s*["']${NET}["']\\s*\\)`, "u"),
  new RegExp(`\\brequire\\s*\\(\\s*["']${NET}["']\\s*\\)`, "u"),
  new RegExp(`\\bimport\\s*["']${NET}["']`, "u"),
  /\bfetch\(/u,
];

function usesNetwork(body) {
  return NETWORK_FORMS.some((re) => re.test(body));
}

test("TR-4a tools/package.json has no dependencies of run time", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"),
  );
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    assert.equal(pkg[field], undefined, field);
  }
  assert.ok(Object.keys(pkg.devDependencies).length > 0);
});

test("TR-4b network imports and fetch( are exactly in the files of NETWORK_FILES", () => {
  const found = srcFiles(".js").filter((rel) => usesNetwork(read(rel)));
  assert.deepEqual(found, [...NETWORK_FILES].sort());
  // Every form of import is recognized (the list cannot go stale unnoticed).
  for (const body of [
    'import http from "node:http";',
    "const x = await import('node:https');",
    'const n = require("net");',
    'export { connect } from "node:tls";',
    'import "node:dgram";',
    "window.fetch(url)",
  ]) {
    assert.ok(usesNetwork(body), body);
  }
  assert.ok(!usesNetwork("fetchFn(url)"));
  assert.ok(!usesNetwork(read("traces/git-files.js")));
});

// The arguments of a call starting at `open` (the index of "("), split at the top level.
function callArgs(body, open) {
  const args = [];
  let depth = 0;
  let quote = null;
  let start = open + 1;
  for (let i = open; i < body.length; i++) {
    const c = body[i];
    if (quote !== null) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) {
        const last = body.slice(start, i).trim();
        if (last !== "") args.push(last);
        return args;
      }
    } else if (c === "," && depth === 1) {
      args.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  throw new Error("unclosed call");
}

// An array literal of string literals and the one allowed name `startDir`.
function arrayItems(text) {
  assert.match(text, /^\[[\s\S]*\]$/u, text);
  return callArgs(`(${text.slice(1, -1)})`, 0).map((item) => {
    if (item === "startDir") return "<папка>";
    const m = /^"([^"\\]*)"$/u.exec(item);
    assert.ok(m !== null, `not a literal: ${item}`);
    return m[1];
  });
}

test("TR-4c child_process only in claude-cli.js and git-files.js; git-files.js calls git exactly twice with fixed arguments", (t) => {
  const found = srcFiles(".js").filter((rel) =>
    /child_process/u.test(read(rel)),
  );
  assert.deepEqual(found, CHILD_PROCESS_FILES);

  const body = read("traces/git-files.js");
  const imports = [
    ...body.matchAll(
      /import\s+([^;]*?)\s+from\s+["'](?:node:)?child_process["']/gu,
    ),
  ];
  assert.equal(imports.length, 1);
  assert.equal(imports[0][1].replace(/\s+/gu, " "), "{ execFileSync }");
  assert.doesNotMatch(
    body,
    /shell|\bexec\(|execSync|spawn|fork|execFile\(|require\(/u,
  );
  const calls = [...body.matchAll(/execFileSync\(/gu)].map((m) =>
    callArgs(body, m.index + "execFileSync".length),
  );
  assert.equal(calls.length, 2);
  for (const args of calls) assert.equal(args[0], '"git"');
  assert.deepEqual(
    calls.map((args) => arrayItems(args[1])),
    [
      [
        "-c",
        "core.fsmonitor=false",
        "-C",
        "<папка>",
        "rev-parse",
        "--show-toplevel",
      ],
      [
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.quotePath=false",
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ],
    ],
  );

  // Behavior: the same list as git itself gives, sorted by UTF-8 bytes.
  const repo = makeRepo(
    t,
    { "b.txt": "b\n", "a/é.txt": "e\n", "Z.txt": "z\n", "new.txt": "n\n" },
    { untracked: ["new.txt"] },
  );
  repo.write(".gitignore", "ignored.txt\n");
  repo.write("ignored.txt", "x\n");
  const saved = { ...process.env };
  t.after(() => {
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  });
  Object.assign(process.env, repo.env);
  const root = repoRoot(path.join(repo.root, "a"));
  assert.equal(root, repo.root);
  const expected = repo
    .lsFiles()
    .sort((x, y) => Buffer.compare(Buffer.from(x), Buffer.from(y)));
  assert.deepEqual(listRepoFiles(root), expected);
  assert.ok(!expected.includes("ignored.txt"));
  assert.ok(expected.includes("new.txt"));
});

test("TR-4d the addresses of NETWORK_FILES are 127.0.0.1, localhost or HOST of config.js", async () => {
  for (const rel of NETWORK_FILES) {
    const body = read(rel);
    const importsHost =
      /import\s*\{[^}]*\bHOST\b[^}]*\}\s*from\s*["']\.\/config\.js["']/u.test(
        body,
      );
    const redeclares = /\b(?:const|let|var|function)\s+HOST\b/u.test(body);
    // (1) every "://"
    for (const m of body.matchAll(/:\/\//gu)) {
      const before = body.slice(Math.max(0, m.index - 5), m.index);
      const after = body.slice(m.index + 3, m.index + 40);
      assert.match(before, /https?$/u, `${rel}: ${before}://${after}`);
      if (after.startsWith("${")) {
        assert.ok(
          after.startsWith("${HOST}") && importsHost && !redeclares,
          `${rel}: ://${after}`,
        );
      } else {
        assert.match(after, /^(127\.0\.0\.1|localhost)[:/"'`]/u, rel);
      }
    }
    // (2) host: and host,
    for (const m of body.matchAll(/\bhost\s*:\s*([^,\n}]+)/gu)) {
      assert.ok(
        ["HOST", "config.HOST", '"127.0.0.1"'].includes(m[1].trim()),
        `${rel}: host: ${m[1]}`,
      );
    }
    const shorthand = [...body.matchAll(/^\s*host,\s*$/gmu)];
    if (rel !== "pixel-office/hook.js") assert.equal(shorthand.length, 0, rel);
  }
  const hook = read("pixel-office/hook.js");
  assert.match(
    hook,
    /const\s+config\s*=\s*await\s+import\(\s*["']\.\/config\.js["']\s*\)/u,
  );
  // The shorthand `host,` sits inside the function post(.
  const postDef = hook.indexOf("function post(");
  assert.ok(postDef !== -1);
  const postEnd = hook.indexOf("\n}\n", postDef);
  for (const m of hook.matchAll(/^\s*host,\s*$/gmu)) {
    assert.ok(m.index > postDef && m.index < postEnd, "host, outside post(");
  }
  const calls = [...hook.matchAll(/\bpost\(/gu)].filter(
    (m) => !hook.slice(Math.max(0, m.index - 9), m.index).endsWith("function "),
  );
  assert.ok(calls.length >= 1);
  for (const m of calls) {
    const args = callArgs(hook, m.index + "post".length);
    assert.equal(args[1], "config.HOST");
  }
  // (3) listen( of each server gets HOST (Pixel Office and the business
  // interface of Sai Team, design REQ-011, section 12).
  for (const rel of ["pixel-office/server.js", "web/server.js"]) {
    const server = read(rel);
    const listens = [...server.matchAll(/\.listen\(/gu)].map((m) =>
      callArgs(server, m.index + ".listen".length),
    );
    assert.ok(listens.length >= 1, rel);
    for (const args of listens)
      assert.equal(args[args.length - 1], "HOST", rel);
  }
  // (4)
  const config = await import("../src/pixel-office/config.js");
  assert.equal(config.HOST, "127.0.0.1");
  const web = await import("../src/web/config.js");
  assert.equal(web.HOST, "127.0.0.1");
});

test("TR-4e the page fetches only its own server, by a relative address", () => {
  const pub = srcFiles(".js").filter((rel) => rel.includes("/public/"));
  for (const rel of pub) {
    const body = read(rel);
    const fetches = [...body.matchAll(/\bfetch\(/gu)];
    if (rel === "pixel-office/public/boot.js") {
      assert.equal(fetches.length, 1);
      assert.match(body, /\(url, init\) => window\.fetch\(url, init\)/u);
    } else if (rel === "web/public/app.js") {
      // Design REQ-011, section 12: exactly one fetch(, inside request(path,
      // init); every address constant is a relative /api path; no other way to
      // reach the network.
      assert.equal(fetches.length, 1, rel);
      const start = body.indexOf("async function request(path, init) {");
      assert.ok(start !== -1, rel);
      const end = body.indexOf("\n}\n", start);
      assert.ok(fetches[0].index > start && fetches[0].index < end, rel);
      assert.match(body.slice(start, end), /window\.fetch\(path, \{/u);
      const consts = [
        ...body.matchAll(/const\s+(API_[A-Z_]+)\s*=\s*"([^"]*)"/gu),
      ];
      assert.ok(consts.length >= 1, rel);
      for (const m of consts) assert.match(m[2], /^\/api(\/|$)/u, m[1]);
      assert.doesNotMatch(
        body,
        /XMLHttpRequest|WebSocket|EventSource|sendBeacon|new URL\(|location\.origin|importScripts/u,
        rel,
      );
    } else {
      assert.equal(fetches.length, 0, rel);
    }
    const fetchFns = [...body.matchAll(/\bfetchFn\(/gu)];
    if (rel !== "pixel-office/public/app.js")
      assert.equal(fetchFns.length, 0, rel);
    for (const m of body.matchAll(/\bgetJson\(/gu)) {
      if (body.slice(Math.max(0, m.index - 9), m.index).endsWith("function "))
        continue;
      const [arg] = callArgs(body, m.index + "getJson".length);
      const api = /^`\$\{(API_[A-Z_]+)\}/u.exec(arg);
      if (api !== null) {
        const def = new RegExp(`const\\s+${api[1]}\\s*=\\s*"(/[^"]*)"`, "u");
        assert.match(body, def, `${rel}: ${api[1]}`);
      } else {
        assert.match(arg, /^["'`]\//u, `${rel}: getJson(${arg})`);
      }
    }
  }
  const app = read("pixel-office/public/app.js");
  const start = app.indexOf("function getJson(url) {");
  assert.ok(start !== -1);
  const indent = app.slice(app.lastIndexOf("\n", start) + 1, start);
  const end = app.indexOf(`\n${indent}}\n`, start);
  const inside = [...app.slice(start, end).matchAll(/\bfetchFn\(/gu)].length;
  assert.ok(inside >= 1);
  assert.equal([...app.matchAll(/\bfetchFn\(/gu)].length, inside);
});

test("TR-4f the files of public/ have no http:// or https:// except 127.0.0.1 and localhost", () => {
  const files = walk(SRC).filter((f) =>
    /\/public\/[^/]+$/u.test(f.split(path.sep).join("/")),
  );
  assert.ok(files.length > 0);
  for (const f of files) {
    const body = fs.readFileSync(f, "utf8");
    for (const m of body.matchAll(/https?:\/\/([^\s"'`/:)]*)/gu)) {
      assert.ok(["127.0.0.1", "localhost"].includes(m[1]), `${f}: ${m[0]}`);
    }
  }
});
