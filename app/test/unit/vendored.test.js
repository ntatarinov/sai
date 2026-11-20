import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { blank } from "../fixtures/blank.js";
import { APP, ROOT, tempDir } from "../fixtures/helpers.js";

// REQ-111 criterion 6: the byte copy of the picker's engine, its record app/vendored.json, the step
// `vendored` of the check, who imports the copy, and the declaration file that stands in for the copy under tsc.

const COPY = "server/vendor/picker-engine.js";
const SOURCE = "tools/src/picker/engine.js";
const DECLARATION = "server/vendor/picker-engine.d.ts";
const sha = (/** @type {Buffer} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const bytesOf = (/** @type {string} */ rel) =>
  fs.readFileSync(path.join(APP, rel));

test("VD-1 vendored.json lists exactly one entry; the sha256 of the copy, of its source and the recorded value are equal", () => {
  const record = JSON.parse(
    fs.readFileSync(path.join(APP, "vendored.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(record), ["entries"]);
  assert.equal(record.entries.length, 1);
  const [entry] = record.entries;
  assert.deepEqual(Object.keys(entry).sort(), ["file", "sha256", "source"]);
  assert.equal(entry.file, COPY);
  assert.equal(entry.source, SOURCE);
  assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  const copy = sha(bytesOf(COPY));
  const source = sha(fs.readFileSync(path.join(ROOT, SOURCE)));
  assert.equal(copy, source, "the copy is not the bytes of its source");
  assert.equal(
    entry.sha256,
    copy,
    "the recorded value is not the sha256 of the copy",
  );
  assert.ok(bytesOf(COPY).equals(fs.readFileSync(path.join(ROOT, SOURCE))));
});

// ---------------------------------------------------------------------------------------------------------
// VD-2 who imports the copy.

const SOURCE_EXT = /\.(?:js|mjs|cjs)$/;
const ALLOWED_IMPORTERS = ["server/routes/demo.js"];

/**
 * The import specifiers of a source file: `import … from "x"`, `import "x"`, `export … from "x"` and
 * `import("x")` (comments blanked, so a path in a comment is no import).
 * @param {string} src
 * @returns {string[]}
 */
function specifiersOf(src) {
  const kept = blank(src, true);
  return [
    ...kept.matchAll(/\b(?:from|import)\s*\(?\s*(["'`])([^"'`\n]+)\1/g),
  ].map((m) => m[2]);
}

/**
 * The findings of VD-2 over the sources of app/ (path from app/ → text): the files that import the copy and
 * are not the demo code, and every relative import that leaves app/.
 * @param {Map<string, string>} files
 * @returns {string[]}
 */
function importFindings(files) {
  const copyAbs = path.join(APP, COPY);
  /** @type {string[]} */
  const out = [];
  for (const [rel, src] of files)
    for (const spec of specifiersOf(src)) {
      if (!spec.startsWith(".")) continue;
      const target = path.resolve(APP, path.dirname(rel), spec);
      if (target === copyAbs && !ALLOWED_IMPORTERS.includes(rel))
        out.push(`${rel} imports the copy`);
      if (path.relative(APP, target).startsWith(".."))
        out.push(`${rel} imports ${spec}, outside app/`);
    }
  return out;
}

test("VD-2 server/vendor holds no other .js file; the copy is imported only by server/routes/demo.js, by no file of public, api or scripts, and no file imports from outside app/", () => {
  const vendor = fs.readdirSync(path.join(APP, "server", "vendor")).sort();
  assert.deepEqual(vendor, ["picker-engine.d.ts", "picker-engine.js"]);
  assert.deepEqual(
    vendor.filter((f) => f.endsWith(".js")),
    ["picker-engine.js"],
  );
  /** @type {Map<string, string>} */
  const files = new Map();
  /** @param {string} dir */
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || (dir === APP && e.name === "test"))
        continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile() && SOURCE_EXT.test(e.name))
        files.set(
          path.relative(APP, abs).split(path.sep).join("/"),
          fs.readFileSync(abs, "utf8"),
        );
    }
  };
  walk(APP);
  assert.ok(files.size > 30, `${files.size} source files read`);
  assert.deepEqual(importFindings(files), []);
  // The demo route does import the copy (the reader is no blind rule), and it is the one importer.
  const importers = [...files]
    .filter(([rel, src]) =>
      specifiersOf(src).some(
        (s) =>
          s.startsWith(".") &&
          path.resolve(APP, path.dirname(rel), s) === path.join(APP, COPY),
      ),
    )
    .map(([rel]) => rel);
  assert.deepEqual(importers, ALLOWED_IMPORTERS);
  // The planted imports are red, each with its finding; the twins are green.
  const demo = files.get("server/routes/demo.js") ?? "";
  /** @type {Array<[string, string, string, RegExp]>} the name, the file, its text, the finding */
  const red = [
    [
      "a page module",
      "public/js/pages/x.js",
      'import { computeResult } from "../../../server/vendor/picker-engine.js";',
      /imports the copy/,
    ],
    [
      "a script",
      "scripts/x.js",
      "import * as e from '../server/vendor/picker-engine.js';",
      /imports the copy/,
    ],
    [
      "the api entry",
      "api/x.js",
      'export { computeResult } from "../server/vendor/picker-engine.js";',
      /imports the copy/,
    ],
    [
      "a dynamic import",
      "server/http/x.js",
      'const e = await import("../vendor/picker-engine.js");',
      /imports the copy/,
    ],
    [
      "a server file that is not the demo",
      "server/routes/other.js",
      'import { computeResult } from "../vendor/picker-engine.js";',
      /imports the copy/,
    ],
    [
      "an import with a line break",
      "server/lib/x.js",
      'import {\n  computeResult,\n} from\n  "../vendor/picker-engine.js";',
      /imports the copy/,
    ],
    [
      "the engine of tools/ imported by the demo",
      "server/routes/demo.js",
      `${demo}\nimport { computeResult as c } from "../../../tools/src/picker/engine.js";`,
      /outside app\//,
    ],
    [
      "the original office",
      "public/office/x.js",
      'import "../../../tools/src/pixel-office/public/layout.js";',
      /outside app\//,
    ],
  ];
  for (const [name, rel, text, want] of red) {
    const copy = new Map(files).set(rel, text);
    const found = importFindings(copy);
    assert.ok(
      found.some((f) => want.test(f)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
  const green = new Map(files)
    .set(
      "server/lib/x.js",
      '// import { a } from "../vendor/picker-engine.js";\nconst s = "picker-engine.js";',
    )
    .set(
      "server/lib/y.js",
      'import { a } from "./z.js";\n/* from "../../tools/x.js" */',
    );
  assert.deepEqual(importFindings(green), []);
});

// ---------------------------------------------------------------------------------------------------------
// VD-3 the step on temporary copies.

/** The names and bytes of every file under a folder.
 * @param {string} dir */
const snapshot = (dir) =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(e.parentPath, e.name))
    .sort()
    .map((f) => `${path.relative(dir, f)} ${sha(fs.readFileSync(f))}`);

/**
 * A temporary tree of the shape the step reads — app/scripts/vendored.js, app/vendored.json, the copy and the
 * source — with the real files in it, and the step run from its app/ folder.
 * @param {import("node:test").TestContext} t
 * @param {(root: string) => void} [plant]
 */
function runStep(t, plant) {
  const root = tempDir(t);
  /** @type {Array<[string, string]>} the file in the project, its place in the tree */
  const parts = [
    [path.join(APP, "scripts", "vendored.js"), "app/scripts/vendored.js"],
    [path.join(APP, "vendored.json"), "app/vendored.json"],
    [path.join(APP, COPY), `app/${COPY}`],
    [path.join(ROOT, SOURCE), SOURCE],
  ];
  for (const [from, to] of parts) {
    fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    fs.copyFileSync(from, path.join(root, to));
  }
  if (plant) plant(root);
  const before = snapshot(root);
  const r = spawnSync(process.execPath, ["scripts/vendored.js"], {
    cwd: path.join(root, "app"),
    encoding: "utf8",
  });
  // The step only reads: every run leaves the tree as it found it.
  assert.deepEqual(snapshot(root), before);
  return { root, ...r };
}

test("VD-3 the step vendored on temporary copies: the real files pass; a changed byte of the copy, a stale record, a second file in the folder and a changed source each end with exit 1 and their own line", (t) => {
  const fine = runStep(t);
  assert.equal(fine.status, 0, fine.stdout + fine.stderr);
  assert.equal(fine.stdout, "vendored: 1 file matches its source\n");
  assert.equal(fine.stderr, "");
  // The step run on the real app/ itself, as the check runs it.
  const real = spawnSync(process.execPath, ["scripts/vendored.js"], {
    cwd: APP,
    encoding: "utf8",
  });
  assert.equal(real.status, 0, real.stdout);
  assert.equal(real.stdout, "vendored: 1 file matches its source\n");
  const recorded = JSON.parse(
    fs.readFileSync(path.join(APP, "vendored.json"), "utf8"),
  ).entries[0].sha256;
  /** @type {Array<[string, (root: string) => void, RegExp[]]>} the name, the plant, the lines that must stand (each line starts with «vendored: ») */
  const damaged = [
    [
      "one byte of the copy changed",
      (root) => fs.appendFileSync(path.join(root, "app", COPY), "\n"),
      [
        new RegExp(
          `^vendored: ${COPY}: the copy is not the bytes of its source ${SOURCE} \\(its sha256 is [0-9a-f]{64}, the recorded one ${recorded}\\)$`,
          "m",
        ),
      ],
    ],
    [
      "a stale recorded hash",
      (root) => {
        const file = path.join(root, "app", "vendored.json");
        fs.writeFileSync(
          file,
          fs.readFileSync(file, "utf8").replace(recorded, "0".repeat(64)),
        );
      },
      [
        /^vendored: vendored\.json: the sha256 recorded for server\/vendor\/picker-engine\.js is stale: the copy and its source are both [0-9a-f]{64}$/m,
      ],
    ],
    [
      "a second file in the folder",
      (root) =>
        fs.writeFileSync(
          path.join(root, "app", "server/vendor/extra.js"),
          "export {};\n",
        ),
      [
        /^vendored: server\/vendor\/extra\.js: a \.js file in server\/vendor\/ that vendored\.json does not list$/m,
      ],
    ],
    [
      "a second file in a folder below",
      (root) => {
        fs.mkdirSync(path.join(root, "app", "server/vendor/deep"));
        fs.writeFileSync(
          path.join(root, "app", "server/vendor/deep/x.js"),
          "export {};\n",
        );
      },
      [
        /^vendored: server\/vendor\/deep\/x\.js: a \.js file in server\/vendor\//m,
      ],
    ],
    [
      "a changed source",
      (root) => fs.appendFileSync(path.join(root, SOURCE), "\n"),
      [
        new RegExp(
          `^vendored: ${SOURCE}: the source of ${COPY} is not the recorded bytes \\(its sha256 is [0-9a-f]{64}, the recorded one ${recorded}\\)$`,
          "m",
        ),
      ],
    ],
    [
      "the copy missing",
      (root) => fs.rmSync(path.join(root, "app", COPY)),
      [new RegExp(`^vendored: ${COPY}: the copy is missing$`, "m")],
    ],
    [
      "the source missing",
      (root) => fs.rmSync(path.join(root, SOURCE)),
      [
        new RegExp(
          `^vendored: ${SOURCE}: the source of ${COPY} is missing$`,
          "m",
        ),
      ],
    ],
    [
      "no record",
      (root) => fs.rmSync(path.join(root, "app", "vendored.json")),
      [/^vendored: vendored\.json: is missing$/m],
    ],
    [
      "a record that is not JSON",
      (root) => fs.writeFileSync(path.join(root, "app", "vendored.json"), "{"),
      [/^vendored: vendored\.json: not JSON$/m],
    ],
    [
      "a record with a second key",
      (root) =>
        fs.writeFileSync(
          path.join(root, "app", "vendored.json"),
          '{"entries": [], "x": 1}',
        ),
      [
        /^vendored: vendored\.json: not an object with exactly the key entries, a list$/m,
      ],
    ],
    [
      "an entry that leaves the folder",
      (root) => {
        const file = path.join(root, "app", "vendored.json");
        fs.writeFileSync(
          file,
          fs.readFileSync(file, "utf8").replace(`"${COPY}"`, '"../x.js"'),
        );
      },
      [
        /^vendored: vendored\.json: entries\[0\]\.file: not a plain path inside app\/$/m,
      ],
    ],
  ];
  for (const [name, plant, lines] of damaged) {
    const r = runStep(t, plant);
    assert.equal(r.status, 1, `${name}: ${r.stdout}${r.stderr}`);
    assert.equal(r.stderr, "", name);
    for (const line of lines) assert.match(r.stdout, line, name);
    assert.ok(!r.stdout.includes("matches its source"), name);
    assert.ok(
      r.stdout
        .split("\n")
        .filter(Boolean)
        .every((l) => l.startsWith("vendored: ")),
      name,
    );
  }
});

// ---------------------------------------------------------------------------------------------------------
// VD-4 the declaration and jsconfig.json.

const EXPORTED = /^export declare (?:const|function) ([A-Za-z_$][\w$]*)/gm;

/**
 * The findings of VD-4 over a declaration file's text, the export names of the copy and a parsed jsconfig.json.
 * @param {string} declaration
 * @param {string[]} copyNames
 * @param {any} jsconfig
 * @returns {string[]}
 */
function declarationFindings(declaration, copyNames, jsconfig) {
  /** @type {string[]} */
  const out = [];
  const declared = [...declaration.matchAll(EXPORTED)].map((m) => m[1]).sort();
  const names = [...copyNames].sort();
  for (const n of declared)
    if (!names.includes(n))
      out.push(`the declaration names ${n}, which the copy lacks`);
  for (const n of names)
    if (!declared.includes(n)) out.push(`the declaration lacks ${n}`);
  const exclude = jsconfig.exclude;
  if (JSON.stringify(exclude) !== JSON.stringify(["node_modules", COPY]))
    out.push(`jsconfig.json excludes ${JSON.stringify(exclude)}`);
  return out;
}

test("VD-4 the export names of the declaration equal the copy's; jsconfig.json excludes exactly the copy", async () => {
  const mod = await import(pathToFileURL(path.join(APP, COPY)).href);
  const names = Object.keys(mod).sort();
  assert.deepEqual(names, [
    "ANSWER_REASONS",
    "computeResult",
    "resolveAnswers",
    "visibleQuestions",
  ]);
  const declaration = fs.readFileSync(path.join(APP, DECLARATION), "utf8");
  const jsconfig = JSON.parse(
    fs.readFileSync(path.join(APP, "jsconfig.json"), "utf8"),
  );
  assert.deepEqual(declarationFindings(declaration, names, jsconfig), []);
  assert.deepEqual(
    [...declaration.matchAll(EXPORTED)].map((m) => m[1]).sort(),
    names,
  );
  assert.deepEqual(jsconfig.exclude, ["node_modules", COPY]);
  // The declaration's only other export line is the empty one that keeps its types local.
  const exports = declaration.split("\n").filter((l) => /^export\b/.test(l));
  assert.deepEqual(
    exports.filter(
      (l) =>
        !/^export declare (?:const|function) /.test(l) && l !== "export {};",
    ),
    [],
  );
  // The damaged copies: a name the copy lacks, a name missing, a wider exclude, a missing exclude.
  /** @type {Array<[string, string, any, RegExp]>} */
  const damaged = [
    [
      "the declaration names an export the copy lacks",
      `${declaration}\nexport declare function leadsOf(a: unknown): number;\n`,
      jsconfig,
      /names leadsOf, which the copy lacks/,
    ],
    [
      "the declaration lacks an export",
      declaration.replace(
        /^export declare function visibleQuestions/m,
        "declare function visibleQuestions",
      ),
      jsconfig,
      /lacks visibleQuestions/,
    ],
    [
      "jsconfig.json excludes server/vendor/**",
      declaration,
      { ...jsconfig, exclude: ["node_modules", "server/vendor/**"] },
      /jsconfig\.json excludes/,
    ],
    [
      "jsconfig.json does not exclude the copy",
      declaration,
      { ...jsconfig, exclude: ["node_modules"] },
      /jsconfig\.json excludes/,
    ],
    [
      "jsconfig.json excludes one file more",
      declaration,
      { ...jsconfig, exclude: ["node_modules", COPY, "server/app.js"] },
      /jsconfig\.json excludes/,
    ],
  ];
  for (const [name, text, config, want] of damaged) {
    assert.notEqual(text, declaration + "x", name);
    const found = declarationFindings(text, names, config);
    assert.ok(
      found.some((f) => want.test(f)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
});
