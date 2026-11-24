import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  APP,
  missingTestFiles,
  readApp,
  readRoot,
  ROOT,
  tempDir,
} from "../fixtures/helpers.js";

// REQ-108 criteria 1, 2 and 13 (.env.example), REQ-109 criteria 7 (the check-public step) and 10 (the grep
// of the test selectors, the same text as in REQ-108 criterion 2).

const ALLOWED_DEPS = ["hono", "@hono/node-server", "pg", "zod", "fflate"];
const ALLOWED_DEV = [
  "@electric-sql/pglite",
  "typescript",
  "eslint",
  "@eslint/js",
  "globals",
  "prettier",
  "playwright-core",
  "@types/node",
  "@types/pg",
];
const LICENCES = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"];

// The int and pg test files that the criteria of REQ-108, REQ-109, REQ-114, REQ-115 and REQ-120 name
// (decisions/0118 О17; the code design M2AUTH, guard edits A1 and A2): the presence guard of the int and pg
// steps runs here, in the unit step.
const INT_FILES = [
  "node-main",
  "migrate",
  "selfcheck",
  "site-gate",
  "logging",
  "db-down",
  "api-entry",
  "health",
  "headers",
  "smoke-local",
  "demo",
  "demo-parity",
  "auth-login",
  "auth-setup",
  "auth-session",
  "auth-csrf",
  "auth-lockout",
  "auth-reauth",
  "auth-totp",
  "auth-reset",
  "rate-limit",
  "auth-db-down",
  "uat-login",
  "tx",
  "isolation",
  "permission-matrix",
];
const PG_FILES = [
  "migrate-pg",
  "selfcheck-pg",
  "rls",
  "audit-chain",
  "db-verify-pg",
  "auth-race-pg",
];
// The e2e test files of REQ-111 criterion 12 and REQ-112 criterion 6, with the 15 named tests of the code design
// 10 that they hold (the e2e step is not in the check chain; this guard is what makes an emptied folder red).
const E2E_FILES = ["landing", "stage"];
const E2E_TESTS = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `LD-${n}`),
  ...[1, 2, 3, 4, 5, 6].map((n) => `ST-${n}`),
];

// The regular expression of the grep of REQ-108 criterion 2 and REQ-109 criterion 10, as written there: the
// method forms (a dot, one of the three selector names, a parenthesis) and the option forms (the name and a
// colon) with any value but false. The criterion runs it as `grep -rnE '<this>' app/test`, which must print
// no line.
export const SELECTOR_GREP =
  /\.(skip|todo|only) *\(|(^|[^A-Za-z0-9_$.])(skip|todo|only) *: *([^f ]|f[^a]|fa[^l]|fal[^s]|fals[^e]|false[A-Za-z0-9_$])/;

/**
 * The lines that SELECTOR_GREP hits in every file under `dir` (any file, whatever its name), read line by
 * line, each as `<path>:<line>:<text>` like a line of `grep -rn`. Unlike grep -r, which skips a link met
 * inside the folder, a link to a file is read as that file and a link to a folder or to nothing throws, so
 * this reading is stricter than the criterion's grep (NPM-6 checks the three links).
 * @param {string} dir
 * @returns {string[]}
 */
export function selectorHits(dir) {
  /** @type {string[]} */
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...selectorHits(p));
    else
      fs.readFileSync(p, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (SELECTOR_GREP.test(line)) out.push(`${p}:${i + 1}:${line}`);
        });
  }
  return out;
}

/** @returns {string[]} the broken rules */
export function packageFindings(npmrc, pkg, lock, tools, tracked) {
  const out = [];
  const lines = npmrc.split("\n").map((l) => l.trim());
  for (const need of [
    "save-exact=true",
    "engine-strict=true",
    "ignore-scripts=true",
  ])
    if (!lines.includes(need)) out.push(`npmrc ${need}`);
  if (pkg.private !== true) out.push("private");
  if (pkg.type !== "module") out.push("type");
  if (pkg.engines?.node !== "22.x") out.push("engines");
  for (const [k, v] of Object.entries({
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }))
    if (!/^\d+\.\d+\.\d+$/.test(String(v))) out.push(`exact ${k}`);
  for (const k of Object.keys(pkg.dependencies ?? {}))
    if (!ALLOWED_DEPS.includes(k)) out.push(`dep ${k}`);
  for (const k of Object.keys(pkg.devDependencies ?? {}))
    if (!ALLOWED_DEV.includes(k)) out.push(`devDep ${k}`);
  for (const k of ["eslint", "@eslint/js", "globals", "prettier"])
    if (pkg.devDependencies?.[k] !== tools.devDependencies?.[k])
      out.push(`tools version ${k}`);
  for (const k of ["preinstall", "install", "postinstall", "prepare"])
    if (pkg.scripts?.[k] !== undefined) out.push(`script ${k}`);
  if (!tracked.includes("app/package-lock.json"))
    out.push("lockfile not tracked");
  if (lock.lockfileVersion !== 3) out.push("lockfileVersion");
  for (const [k, v] of Object.entries(lock.packages ?? {}))
    if (
      k &&
      !String(v.resolved ?? "").startsWith("https://registry.npmjs.org/")
    )
      out.push(`resolved ${k}`);
  for (const k of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))
    if (!LICENCES.includes(lock.packages?.[`node_modules/${k}`]?.license))
      out.push(`licence ${k}`);
  return out;
}

// The e2e script of REQ-111 criterion 11 and the code design 4.12, exactly: one browser at a time, the files
// of app/test/e2e, no selector.
const E2E_COMMAND = 'node --test --test-concurrency=1 "test/e2e/**/*.test.js"';

/** @returns {string[]} */
export function checkScriptFindings(pkg) {
  const out = [];
  const check = String(pkg.scripts?.check ?? "");
  const steps = check.split(" && ");
  const want = [
    "prettier --check .",
    "eslint . --max-warnings 0",
    "tsc --noEmit -p jsconfig.json",
    "node scripts/check-public.js",
    "node scripts/vendored.js",
    "node ../tools/src/picker/cli.js check content/sai-intake.json",
    "npm run test:unit",
    "npm run test:int",
  ];
  if (JSON.stringify(steps) !== JSON.stringify(want)) out.push("check chain");
  const tsc = steps.indexOf("tsc --noEmit -p jsconfig.json");
  const pub = steps.indexOf("node scripts/check-public.js");
  const unit = steps.indexOf("npm run test:unit");
  if (!(tsc >= 0 && pub > tsc && unit > pub)) out.push("check-public place");
  if (/\|\||;/.test(check)) out.push("no || or ;");
  for (const k of ["test:unit", "test:int", "test:pg", "test:e2e"])
    if (
      /--test-only|--test-name-pattern|--test-skip-pattern/.test(
        String(pkg.scripts?.[k] ?? ""),
      )
    )
      out.push(`selector ${k}`);
  if (!/^node --test .*test\/unit\//.test(String(pkg.scripts?.["test:unit"])))
    out.push("test:unit");
  if (!/^node --test .*test\/int\//.test(String(pkg.scripts?.["test:int"])))
    out.push("test:int");
  if (pkg.scripts?.["test:e2e"] !== E2E_COMMAND) out.push("test:e2e");
  return out;
}

/**
 * The names of the environment variables a source reads: `raw("NAME")` (config.js), `env.NAME`,
 * `env["NAME"]` and `process.env.NAME`.
 * @param {string} src
 * @returns {Set<string>}
 */
export function envNamesRead(src) {
  const names = new Set();
  for (const m of src.matchAll(/\braw\(\s*["']([A-Z][A-Z0-9_]*)["']\s*\)/g))
    names.add(m[1]);
  for (const m of src.matchAll(/\benv\s*\??\.\s*([A-Z][A-Z0-9_]*)\b/g))
    names.add(m[1]);
  for (const m of src.matchAll(
    /\benv\s*(?:\?\.)?\[\s*(["'`])([A-Z][A-Z0-9_]*)\1\s*\]/g,
  ))
    names.add(m[2]);
  return names;
}

/**
 * @param {Array<[string, string]>} sources [file, text] of the code that reads the environment
 * @param {string} example the text of app/.env.example
 * @returns {string[]}
 */
export function envFindings(sources, example) {
  const out = [];
  const listed = new Set();
  for (const raw of example.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) {
      out.push("a line that is not NAME=");
      continue;
    }
    if (m[2] !== "") out.push(`a value for ${m[1]}`);
    listed.add(m[1]);
  }
  for (const [file, src] of sources)
    for (const name of envNamesRead(src))
      if (!listed.has(name)) out.push(`unlisted ${name} in ${file}`);
  return out;
}

/** The code whose reads ENV-1 checks: every .js of server/, api/, scripts/ and the pg variables. */
function envSources() {
  /** @type {Array<[string, string]>} */
  const out = [];
  for (const dir of ["server", "api", "scripts"])
    for (const f of fs.readdirSync(path.join(APP, dir), { recursive: true }))
      if (String(f).endsWith(".js")) {
        const rel = `${dir}/${String(f).split(path.sep).join("/")}`;
        out.push([rel, fs.readFileSync(path.join(APP, rel), "utf8")]);
      }
  const pgEnv = "test/fixtures/pg-env.js";
  out.push([pgEnv, fs.readFileSync(path.join(APP, pgEnv), "utf8")]);
  return out;
}

const real = () => ({
  npmrc: readApp(".npmrc").toString(),
  pkg: JSON.parse(readApp("package.json").toString()),
  lock: JSON.parse(readApp("package-lock.json").toString()),
  tools: JSON.parse(readRoot("tools/package.json")),
  tracked: execFileSync("git", ["ls-files", "app/package-lock.json"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean),
});

test("NPM-1 the real package files keep every pinning rule", () => {
  const r = real();
  assert.deepEqual(
    packageFindings(r.npmrc, r.pkg, r.lock, r.tools, r.tracked),
    [],
  );
});

test("NPM-2 each damaged copy breaks its rule", () => {
  const r = real();
  const clone = () => structuredClone(r);
  const cases = [
    ["a ^ range", (c) => (c.pkg.dependencies.hono = "^4.0.0"), "exact hono"],
    ["engines >=22", (c) => (c.pkg.engines.node = ">=22"), "engines"],
    [
      "no ignore-scripts",
      (c) => (c.npmrc = c.npmrc.replace("ignore-scripts=true", "")),
      "npmrc ignore-scripts=true",
    ],
    [
      "a git+ resolved",
      (c) =>
        (c.lock.packages["node_modules/hono"].resolved =
          "git+https://example.invalid/x.git"),
      "resolved node_modules/hono",
    ],
    [
      "a tarball resolved",
      (c) =>
        (c.lock.packages["node_modules/pg"].resolved =
          "https://example.invalid/pg.tgz"),
      "resolved node_modules/pg",
    ],
    [
      "another licence",
      (c) => (c.lock.packages["node_modules/pg"].license = "GPL-3.0"),
      "licence pg",
    ],
    [
      "a postinstall",
      (c) => (c.pkg.scripts.postinstall = "node x.js"),
      "script postinstall",
    ],
    [
      "an unlisted dependency",
      (c) => (c.pkg.dependencies.axios = "1.0.0"),
      "dep axios",
    ],
    [
      "another prettier",
      (c) => (c.pkg.devDependencies.prettier = "3.0.0"),
      "tools version prettier",
    ],
  ];
  for (const [name, damage, rule] of cases) {
    const c = clone();
    damage(c);
    assert.ok(
      packageFindings(c.npmrc, c.pkg, c.lock, c.tools, c.tracked).includes(
        rule,
      ),
      name,
    );
  }
});

test("NPM-3 the check script is the one chain, with no selector and no ||", () => {
  const { pkg } = real();
  assert.deepEqual(checkScriptFindings(pkg), []);
  const jsconfig = JSON.parse(readApp("jsconfig.json").toString());
  assert.equal(jsconfig.compilerOptions.checkJs, true);
  const damaged = structuredClone(pkg);
  damaged.scripts.check += " || true";
  assert.ok(checkScriptFindings(damaged).includes("no || or ;"));
  const selector = structuredClone(pkg);
  selector.scripts["test:unit"] += " --test-only";
  assert.ok(checkScriptFindings(selector).includes("selector test:unit"));
  const noPublic = structuredClone(pkg);
  noPublic.scripts.check = noPublic.scripts.check.replace(
    " && node scripts/check-public.js",
    "",
  );
  assert.ok(checkScriptFindings(noPublic).includes("check chain"));
  // The eight steps of the code design 4.12: a copy without one of the two new steps, with them swapped or
  // with one moved behind the tests is red by the chain, whatever else it keeps.
  const steps8 = pkg.scripts.check.split(" && ");
  assert.equal(steps8.length, 8);
  const vendored = "node scripts/vendored.js";
  const content =
    "node ../tools/src/picker/cli.js check content/sai-intake.json";
  assert.deepEqual(steps8.slice(3, 6), [
    "node scripts/check-public.js",
    vendored,
    content,
  ]);
  /** @type {Array<[string, string[]]>} */
  const chains = [
    ["without vendored", steps8.filter((s) => s !== vendored)],
    ["without content", steps8.filter((s) => s !== content)],
    [
      "vendored behind content",
      [...steps8.slice(0, 4), content, vendored, ...steps8.slice(6)],
    ],
    [
      "content behind the tests",
      [...steps8.filter((s) => s !== content), content],
    ],
    [
      "vendored behind the tests",
      [...steps8.filter((s) => s !== vendored), vendored],
    ],
  ];
  for (const [name, chain] of chains) {
    const copy = structuredClone(pkg);
    copy.scripts.check = chain.join(" && ");
    assert.ok(checkScriptFindings(copy).includes("check chain"), name);
  }
  // test:e2e is exactly the command of 4.12; a selector, another folder, a changed concurrency, a missing
  // script and an extra word are each red, and the selector also by the loop of the three other scripts.
  assert.equal(
    pkg.scripts["test:e2e"],
    'node --test --test-concurrency=1 "test/e2e/**/*.test.js"',
  );
  for (const [name, command] of [
    ["a selector", `${pkg.scripts["test:e2e"]} --test-only`],
    ["a name pattern", `${pkg.scripts["test:e2e"]} --test-name-pattern=x`],
    [
      "another folder",
      'node --test --test-concurrency=1 "test/int/**/*.test.js"',
    ],
    [
      "another concurrency",
      'node --test --test-concurrency=2 "test/e2e/**/*.test.js"',
    ],
    ["an extra word", `${pkg.scripts["test:e2e"]} --watch`],
  ]) {
    const copy = structuredClone(pkg);
    copy.scripts["test:e2e"] = command;
    assert.ok(checkScriptFindings(copy).includes("test:e2e"), name);
  }
  const selectorE2e = structuredClone(pkg);
  selectorE2e.scripts["test:e2e"] += " --test-skip-pattern=x";
  assert.ok(checkScriptFindings(selectorE2e).includes("selector test:e2e"));
  const noE2e = structuredClone(pkg);
  delete noE2e.scripts["test:e2e"];
  assert.ok(checkScriptFindings(noE2e).includes("test:e2e"));
});

test("NPM-4 check-public stands after tsc and before npm run test:unit; moved after test:unit it is red", () => {
  const { pkg } = real();
  assert.ok(!checkScriptFindings(pkg).includes("check-public place"));
  const steps = pkg.scripts.check.split(" && ");
  const moved = structuredClone(pkg);
  moved.scripts.check = [
    ...steps.filter((s) => s !== "node scripts/check-public.js"),
  ]
    .flatMap((s) =>
      s === "npm run test:unit" ? [s, "node scripts/check-public.js"] : [s],
    )
    .join(" && ");
  assert.notEqual(moved.scripts.check, pkg.scripts.check);
  assert.ok(checkScriptFindings(moved).includes("check-public place"));
});

test("NPM-5 app/test/int holds its 26 named test files and app/test/pg its 6; a copy without one is red", (t) => {
  assert.deepEqual(
    missingTestFiles(path.join(APP, "test", "int"), INT_FILES),
    [],
  );
  assert.deepEqual(
    missingTestFiles(path.join(APP, "test", "pg"), PG_FILES),
    [],
  );
  for (const [folder, names] of /** @type {const} */ ([
    ["int", INT_FILES],
    ["pg", PG_FILES],
  ])) {
    const files = fs.readdirSync(path.join(APP, "test", folder));
    for (const gone of names) {
      const copy = path.join(tempDir(t), folder);
      fs.mkdirSync(copy);
      for (const f of files)
        if (f !== `${gone}.test.js`) fs.writeFileSync(path.join(copy, f), "");
      assert.deepEqual(missingTestFiles(copy, names), [gone], gone);
    }
  }
});

/**
 * The named tests of the e2e files in `dir`: the ids (`LD-1` …) of the lines that open a test, and the number of
 * lines that open one by any name. A `test(` whose first words are not an id is counted in `calls` only, so a
 * renamed or an anonymous test is found; a test written with a selector (`test.<name>(`) is no line of either.
 * @param {string} dir
 * @returns {{ ids: string[], calls: number }}
 */
function e2eTests(dir) {
  /** @type {string[]} */
  const ids = [];
  let calls = 0;
  for (const name of E2E_FILES) {
    const text = fs.readFileSync(path.join(dir, `${name}.test.js`), "utf8");
    calls += (text.match(/^test\(/gm) ?? []).length;
    for (const m of text.matchAll(/^test\(\s*["`']((?:LD|ST)-\d+) /gm))
      ids.push(m[1]);
  }
  return { ids: ids.sort(), calls };
}

test("NPM-7 app/test/e2e holds landing and stage with their 15 named tests; an emptied folder, a copy without a file and a copy with a test skipped, renamed or missing are red", (t) => {
  const real = path.join(APP, "test", "e2e");
  assert.deepEqual(missingTestFiles(real, E2E_FILES), []);
  const want = [...E2E_TESTS].sort();
  assert.deepEqual(e2eTests(real), { ids: want, calls: want.length });
  // A copy of the folder without one file, and an emptied folder: the guard names what is missing.
  for (const gone of E2E_FILES) {
    const copy = path.join(tempDir(t), "e2e");
    fs.mkdirSync(copy);
    for (const f of fs.readdirSync(real))
      if (f !== `${gone}.test.js`) fs.writeFileSync(path.join(copy, f), "");
    assert.deepEqual(missingTestFiles(copy, E2E_FILES), [gone], gone);
  }
  const empty = path.join(tempDir(t), "e2e");
  fs.mkdirSync(empty);
  assert.deepEqual(missingTestFiles(empty, E2E_FILES), E2E_FILES);
  // Damaged copies of the real files: each is red by its ids or its count. The selector is built from parts, so
  // that this file holds no such form (NPM-6).
  const skip = ["sk", "ip"].join("");
  const todo = ["to", "do"].join("");
  /** @type {Array<[string, string, (text: string) => string]>} */
  const damage = [
    [
      "landing",
      "a test skipped",
      (x) => x.replace(/^test\(\s*"LD-3 /m, `test.${skip}("LD-3 `),
    ],
    [
      "landing",
      "a test marked later",
      (x) => x.replace(/^test\(\s*"LD-5 /m, `test.${todo}("LD-5 `),
    ],
    [
      "stage",
      "a test renamed",
      (x) => x.replace(/^test\(\s*"ST-4 /m, 'test("a walk '),
    ],
    [
      "stage",
      "a test missing",
      (x) => x.replace(/^test\(\s*"ST-6 /m, "function unused(){}\n// "),
    ],
    ["landing", "every test removed", (x) => x.replace(/^test\(/gm, "// ")],
  ];
  for (const [file, what, change] of damage) {
    const copy = path.join(tempDir(t), "e2e");
    fs.mkdirSync(copy);
    for (const f of E2E_FILES) {
      const text = fs.readFileSync(path.join(real, `${f}.test.js`), "utf8");
      fs.writeFileSync(
        path.join(copy, `${f}.test.js`),
        f === file ? change(text) : text,
      );
    }
    assert.notDeepEqual(
      e2eTests(copy),
      { ids: want, calls: want.length },
      what,
    );
    assert.notEqual(
      fs.readFileSync(path.join(copy, `${file}.test.js`), "utf8"),
      fs.readFileSync(path.join(real, `${file}.test.js`), "utf8"),
      `${what}: the damage changed the copy`,
    );
  }
});

test("NPM-6 no line under app/test is hit by the grep of criterion 2 for the skip, todo and only selectors", (t) => {
  assert.deepEqual(selectorHits(path.join(APP, "test")), []);
  // A control on planted lines, built from parts so that this file holds none: each selector form is hit,
  // the benign lines are not, and a planted file deep in a folder is found by its path and line.
  const names = [
    ["sk", "ip"],
    ["to", "do"],
    ["on", "ly"],
  ].map((p) => p.join(""));
  for (const n of names) {
    for (const line of [
      `test.${n}("x", () => {});`,
      `describe.${n} ("x", () => {});`,
      `test("x", { ${n}: true }, () => {});`,
      `test("x", { ${n}: "later" }, () => {});`,
      `test("x", { ${n} : 1 }, () => {});`,
      `test("x", { ${n}: falsey }, () => {});`,
      `${n}:x`,
    ])
      assert.ok(SELECTOR_GREP.test(line), `not hit: ${line}`);
    for (const line of [
      `test("x", { ${n}: false }, () => {});`,
      `const o = { no${n}: true, ${n}ped: 1 };`,
      `const ${n}Count = a.${n};`,
      `// ${n} the slow case`,
    ])
      assert.ok(!SELECTOR_GREP.test(line), `hit: ${line}`);
  }
  const dir = tempDir(t);
  const deep = path.join(dir, "int", "deep");
  fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(path.join(dir, "a.test.js"), "const a = 1;\n");
  const planted = `test("y", { ${names[0]}: true });`;
  fs.writeFileSync(path.join(deep, ".hidden"), `x\n${planted}\n`);
  assert.deepEqual(selectorHits(dir), [
    `${path.join(deep, ".hidden")}:2:${planted}`,
  ]);
  // Links met inside the folder, which grep -r skips: a link to the planted file is read as that file, a
  // link to a folder or to nothing throws (each in a folder of its own).
  const toFile = path.join(tempDir(t), "to-file.js");
  fs.symlinkSync(path.join(deep, ".hidden"), toFile);
  assert.deepEqual(selectorHits(path.dirname(toFile)), [
    `${toFile}:2:${planted}`,
  ]);
  const toFolder = tempDir(t);
  fs.symlinkSync(deep, path.join(toFolder, "to-folder"));
  assert.throws(() => selectorHits(toFolder), { code: "EISDIR" });
  const toNothing = tempDir(t);
  fs.symlinkSync(
    path.join(toNothing, "gone.js"),
    path.join(toNothing, "to-nothing.js"),
  );
  assert.throws(() => selectorHits(toNothing), { code: "ENOENT" });
});

test("ENV-1 every variable the code reads is a line NAME= with an empty value in .env.example", () => {
  const sources = envSources();
  const example = readApp(".env.example").toString();
  assert.deepEqual(envFindings(sources, example), []);
  const read = new Set(sources.flatMap(([, s]) => [...envNamesRead(s)]));
  for (const n of [
    "NODE_ENV",
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "APP_DB_PASSWORD",
    "SITE_GATE",
    "MIGRATE_ON_BUILD",
    "PGLITE_DIR",
    "MIGRATIONS_DIR",
    "SAI_PG_HOST",
    "SAI_PG_PORT",
    "SAI_PG_SUPERUSER_PASSWORD",
  ])
    assert.ok(read.has(n), `the reader finds ${n}`);
  const planted = ["SAI", "PLANTED", "X"].join("_");
  for (const form of [
    `const v = process.env.${planted};`,
    `const v = env["${planted}"];`,
    `const v = raw("${planted}");`,
  ])
    assert.ok(
      envFindings([...sources, ["server/planted.js", form]], example).includes(
        `unlisted ${planted} in server/planted.js`,
      ),
      form,
    );
  assert.ok(
    envFindings(
      sources,
      example.replace("\nPORT=\n", "\nPORT=8080\n"),
    ).includes("a value for PORT"),
  );
  assert.ok(
    envFindings(sources, example.replace("\nAPP_DB_PASSWORD=\n", "\n")).some(
      (f) => f.startsWith("unlisted APP_DB_PASSWORD"),
    ),
  );
});
