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

// REQ-108 criteria 1, 2 and 13 (.env.example), REQ-109 criterion 7 (the check-public step).

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

// The int and pg test files that the criteria of REQ-108 and REQ-109 name (decisions/0118 О17): the
// presence guard of the int and pg steps runs here, in the unit step.
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
];
const PG_FILES = ["migrate-pg", "selfcheck-pg"];

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
    "npm run test:unit",
    "npm run test:int",
  ];
  if (JSON.stringify(steps) !== JSON.stringify(want)) out.push("check chain");
  const tsc = steps.indexOf("tsc --noEmit -p jsconfig.json");
  const pub = steps.indexOf("node scripts/check-public.js");
  const unit = steps.indexOf("npm run test:unit");
  if (!(tsc >= 0 && pub > tsc && unit > pub)) out.push("check-public place");
  if (/\|\||;/.test(check)) out.push("no || or ;");
  for (const k of ["test:unit", "test:int", "test:pg"])
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

test("NPM-5 app/test/int holds its 10 named test files and app/test/pg its 2; a copy without one is red", (t) => {
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
