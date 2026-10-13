import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function hasHeading(text, heading) {
  return text.split("\n").some((l) => l.trim() === heading);
}

test("REQ-002 AC1: decisions/0002 has every section and the owner's confirmation", () => {
  const text = read("decisions/0002-process-tooling-node.md");
  for (const h of [
    "Вопрос",
    "Варианты",
    "Решение",
    "Почему",
    "Граница",
    "Основание",
  ]) {
    assert.ok(hasHeading(text, `## ${h}`), `missing ## ${h}`);
  }
  assert.ok(text.includes("Подтверждено владельцем"));
});

test("REQ-003 AC1: WF-06 document has the required sections and steps 0-7", () => {
  const text = read("docs/workflows/WF-06-idea-selection.md");
  for (const h of [
    "Роли",
    "Шаги",
    "Артефакты",
    "Handoff-ы",
    "Цикл доработки",
    "Условия остановки",
  ]) {
    assert.ok(hasHeading(text, `## ${h}`), `missing ## ${h}`);
  }
  for (let n = 0; n <= 7; n++) {
    assert.ok(text.includes(`Шаг ${n}`), `missing Шаг ${n}`);
  }
});

test("REQ-003 AC2: WF-06 roles exist and are bound to the quality bar", () => {
  for (const role of ["idea-analyst", "idea-judge", "verdict-executor"]) {
    const text = read(`.claude/agents/${role}.md`);
    assert.ok(
      text.includes("## Quality bar — binding"),
      `${role}: no quality bar block`,
    );
  }
  assert.ok(read(".claude/agents/orchestrator.md").includes("WF-06"));
});

test("REQ-003 AC3: analyst and judge have a reading scope that overrides CLAUDE.md", () => {
  for (const role of ["idea-analyst", "idea-judge"]) {
    const text = read(`.claude/agents/${role}.md`);
    assert.ok(
      hasHeading(text, "## Reading scope"),
      `${role}: no ## Reading scope`,
    );
    const scope = text.split("## Reading scope")[1].split("\n## ")[0];
    assert.ok(
      scope.includes("overrides the start-up reading list in `CLAUDE.md`"),
      `${role}: reading scope does not override CLAUDE.md`,
    );
    const [allowedPart, forbiddenPart = ""] = scope.split("**Do not read:**");
    for (const token of ["runs/<RUN-ID>/", "docs/quality-bar.md"]) {
      assert.ok(allowedPart.includes(token), `${role}: ${token} not allowed`);
    }
    const forbidden = forbiddenPart.split("\n- ")[0];
    assert.doesNotMatch(
      forbidden,
      /\bmay\b|\bcan\b|\ballowed\b/i,
      `${role}: the "Do not read" list must not grant anything`,
    );
    for (const token of [
      "`ideas/`",
      "`ideas/README.md`",
      "`STATE.md`",
      "`docs/requirements.yaml`",
      "`decisions/`",
    ]) {
      assert.ok(
        forbidden.includes(token),
        `${role}: ${token} is not in the "Do not read" list`,
      );
      assert.ok(
        !allowedPart.includes(token),
        `${role}: ${token} appears among the allowed sources`,
      );
    }
  }
  const claude = read("CLAUDE.md");
  assert.ok(
    claude.includes("IDEA-ANALYST") &&
      claude.includes("IDEA-JUDGE") &&
      claude.includes("Reading scope"),
    "CLAUDE.md has no exception line for IDEA-ANALYST and IDEA-JUDGE",
  );
});

// ---------------------------------------------------------------------------------------
// REQ-030 (design docs/design/REQ-030-github-check.md, 7.1-7.3): the check on GitHub, the
// hook before a push and the README section. Criteria 2 and 3 are steps after the push to
// GitHub, not tests. The tests read the workflow, the hook and the README from the working
// tree of the project; every hook run happens in its own temporary repository.
// ---------------------------------------------------------------------------------------

const WORKFLOW_REL = ".github/workflows/check.yml";
const HOOK_REL = ".githooks/pre-push";
const README_HEADING = "## Проверка на GitHub и перед отправкой";
const README_PREVIOUS = "## Как открыть на другом компьютере";

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

// The non-blank lines after the line `header` that are indented deeper than `indent`.
function lineBlock(lines, header, indent) {
  const at = lines.indexOf(header);
  if (at < 0) return null;
  const out = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === "") continue;
    if (indentOf(line) <= indent) break;
    out.push(line);
  }
  return out;
}

// Applies one change to a text and checks that the text really changed.
function change(text, from, to) {
  const changed =
    typeof from === "string"
      ? text.replace(from, () => to)
      : text.replace(from, to);
  assert.notEqual(changed, text, `the change did not apply: ${String(from)}`);
  return changed;
}

// ---- criterion 1: the workflow file (CI-1 ... CI-8) ----------------------------------

const CI_SHA_LINE =
  /^ {8}uses: actions\/(checkout|setup-node)@[0-9a-f]{40} # v\d+\.\d+\.\d+$/u;
const CI_FORBIDDEN = [
  "||",
  "continue-on-error",
  "secrets.",
  "GITHUB_TOKEN",
  "set +e",
  "exit 0",
  "curl",
  "wget",
  "http://",
  "https://",
  "docker://",
  "pull_request_target",
  "workflow_run",
  "workflow_dispatch",
  "schedule",
  "actions/cache",
];

// The rules of the workflow in one place: the list of violations, each starting with
// the id of the test that owns the rule. `engines` is the `engines.node` of tools/.
function ciFindings(buf, engines) {
  const text = buf.toString("utf8");
  const out = [];
  const add = (n, msg) => out.push(`CI-${n}: ${msg}`);
  const lines = text.split("\n");

  // CI-1: the form of the file
  if (!Buffer.from(text, "utf8").equals(buf)) add(1, "not valid UTF-8");
  if (text.includes("\r")) add(1, "has a CR");
  if (text.includes("\t")) add(1, "has a tab");
  if (!text.endsWith("\n")) add(1, "no newline at the end");
  const top = lines
    .filter((l) => /^[A-Za-z_][\w-]*:/u.test(l))
    .map((l) => l.slice(0, l.indexOf(":")));
  if (!same(top, ["name", "on", "permissions", "concurrency", "jobs"]))
    add(1, `top-level keys are ${top.join(",")}`);

  // CI-2: the triggers
  const on = lineBlock(lines, "on:", 0) ?? [];
  const onKeys = on.filter((l) => indentOf(l) === 2).map((l) => l.trim());
  if (!same(onKeys, ["push:", "pull_request:"]))
    add(2, `triggers are ${onKeys.join(",")}`);
  if (!same(lineBlock(on, "  push:", 2), ["    branches:", '      - "**"']))
    add(2, "push is not branches: all");
  if (!same(lineBlock(on, "  pull_request:", 2), []))
    add(2, "pull_request has a filter or is missing");
  if (/pull_request_target|workflow_run|workflow_dispatch|schedule/u.test(text))
    add(2, "a forbidden trigger");

  // CI-3: Node 22, in step with engines
  const nodeLines = lines.filter((l) => /node-version:/u.test(l));
  if (
    !same(
      nodeLines.map((l) => l.trim()),
      ['node-version: "22"'],
    )
  )
    add(3, `node-version lines are ${nodeLines.join("|")}`);
  const range = /^>=(\d+) <(\d+)$/u.exec(engines ?? "");
  if (range === null || range[1] !== "22" || range[2] !== "23")
    add(3, `engines.node is ${engines}`);

  // CI-4: the four steps
  const jobs = (lineBlock(lines, "jobs:", 0) ?? []).filter(
    (l) => indentOf(l) === 2,
  );
  if (!same(jobs, ["  check:"])) add(4, `jobs are ${jobs.join(",")}`);
  const steps = [];
  const stepsAt = lines.findIndex((l) => l.trim() === "steps:");
  if (stepsAt >= 0) {
    for (const line of lines.slice(stepsAt + 1)) {
      if (line.trim() === "") continue;
      if (indentOf(line) <= 4) break;
      if (/^ {6}- /u.test(line)) steps.push([line]);
      else steps.at(-1)?.push(line);
    }
  }
  const has = (step, line) => step.some((l) => l.trim() === line);
  const usesOf = (step) => step.find((l) => /^\s*(?:- )?uses:/u.test(l)) ?? "";
  if (steps.length !== 4) add(4, `${steps.length} steps, need 4`);
  else {
    if (!usesOf(steps[0]).includes("uses: actions/checkout@"))
      add(4, "step 1 is not checkout");
    if (!usesOf(steps[1]).includes("uses: actions/setup-node@"))
      add(4, "step 2 is not setup-node");
    if (!has(steps[2], "run: npm ci")) add(4, "step 3 is not run: npm ci");
    if (!has(steps[3], "run: npm run check"))
      add(4, "step 4 is not run: npm run check");
    for (const step of [steps[2], steps[3]]) {
      if (!has(step, "working-directory: tools"))
        add(4, "a run step without working-directory: tools");
    }
  }
  const runs = lines.filter((l) => /^\s*(?:- )?run:/u.test(l));
  if (
    !same(
      runs.map((l) => l.trim()),
      ["run: npm ci", "run: npm run check"],
    )
  )
    add(4, `run lines are ${runs.join("|")}`);

  // CI-5: only two actions, each pinned to a full commit
  const uses = lines.filter((l) => /\buses:/u.test(l));
  const bad = uses.filter((l) => !CI_SHA_LINE.test(l));
  if (bad.length > 0) add(5, `not pinned or not official: ${bad.join("|")}`);
  const names = uses.map((l) => /actions\/([\w-]+)@/u.exec(l)?.[1]);
  if (!same(names, ["checkout", "setup-node"]))
    add(5, `actions are ${names.join(",")}`);

  // CI-6: full history, no stored credentials, no cache
  if (steps.length === 4) {
    if (!has(steps[0], "fetch-depth: 0"))
      add(6, "checkout without fetch-depth: 0");
    if (!has(steps[0], "persist-credentials: false"))
      add(6, "checkout without persist-credentials: false");
    if (!has(steps[1], "package-manager-cache: false"))
      add(6, "setup-node without package-manager-cache: false");
  }
  const cacheLines = lines.filter((l) => /cache/iu.test(l));
  if (
    !same(
      cacheLines.map((l) => l.trim()),
      ["package-manager-cache: false"],
    )
  )
    add(6, `cache lines are ${cacheLines.join("|")}`);

  // CI-7: nothing that hides a red check, no secrets, no addresses, least rights
  for (const word of CI_FORBIDDEN)
    if (text.includes(word)) add(7, `contains ${word}`);
  if (/(?:^|\s)(?:if|env):/mu.test(text)) add(7, "contains if: or env:");
  if (/token:/iu.test(text)) add(7, "contains token:");
  const dollar = lines.filter((l) => l.includes("${{"));
  if (
    !same(
      dollar.map((l) => l.trim()),
      ["group: check-${{ github.ref }}"],
    )
  )
    add(7, `expressions are ${dollar.join("|")}`);
  const rights = (lineBlock(lines, "permissions:", 0) ?? []).map((l) =>
    l.trim(),
  );
  if (!same(rights, ["contents: read"]))
    add(7, `permissions are ${rights.join(",")}`);
  if (/:\s*write\b/u.test(text)) add(7, "a write right");
  return out;
}

function readWorkflow() {
  return fs.readFileSync(path.join(ROOT, WORKFLOW_REL));
}

function enginesNode() {
  return JSON.parse(read("tools/package.json")).engines.node;
}

function ciOwn(id) {
  return ciFindings(readWorkflow(), enginesNode()).filter((f) =>
    f.startsWith(`${id}:`),
  );
}

test("REQ-030 AC1 CI-1: .github/workflows/check.yml is a plain UTF-8 file with LF, no tabs and exactly the five top-level keys", () => {
  const abs = path.join(ROOT, WORKFLOW_REL);
  assert.ok(fs.lstatSync(abs).isFile(), "not a regular file");
  assert.deepEqual(ciOwn("CI-1"), []);
});

test("REQ-030 AC1 CI-2: the workflow runs on push to every branch and on pull_request, and on nothing else", () => {
  assert.deepEqual(ciOwn("CI-2"), []);
});

test("REQ-030 AC1 CI-3: node-version is 22 and the major version equals engines.node of tools/package.json", () => {
  assert.deepEqual(ciOwn("CI-3"), []);
});

test("REQ-030 AC1 CI-4: four steps in order, checkout, setup-node, npm ci, npm run check, both runs in tools/", () => {
  assert.deepEqual(ciOwn("CI-4"), []);
});

test("REQ-030 AC1 CI-5: exactly two actions, checkout and setup-node of the actions owner, each pinned to a 40 character commit", () => {
  assert.deepEqual(ciOwn("CI-5"), []);
});

test("REQ-030 AC1 CI-6: full history, no stored credentials, no cache of any kind", () => {
  assert.deepEqual(ciOwn("CI-6"), []);
});

test("REQ-030 AC1 CI-7: nothing hides a red check; no secrets, tokens, addresses or write rights", () => {
  assert.deepEqual(ciOwn("CI-7"), []);
});

test("REQ-030 AC1 CI-8: the rules are not blind: the real file has no violation and every damaged copy of it has the expected one", () => {
  const original = readWorkflow().toString("utf8");
  const engines = enginesNode();
  assert.deepEqual(ciFindings(Buffer.from(original), engines), []);
  const shaOf = (name) =>
    new RegExp(
      `(uses: actions/${name}@)[0-9a-f]{40}( # v\\d+\\.\\d+\\.\\d+)`,
      "u",
    );
  const extra = (line) =>
    change(
      original,
      "          fetch-depth: 0\n",
      `          fetch-depth: 0\n          ${line}\n`,
    );
  const mutants = [
    [
      "a CR",
      "CI-1",
      () => change(original, "name: check\n", "name: check\r\n"),
    ],
    ["a tab", "CI-1", () => change(original, "    runs-on", "\truns-on")],
    ["a sixth top-level key", "CI-1", () => `${original}extra: 1\n`],
    [
      "pull_request removed",
      "CI-2",
      () => change(original, "  pull_request:\n", ""),
    ],
    [
      "push removed",
      "CI-2",
      () => change(original, '  push:\n    branches:\n      - "**"\n', ""),
    ],
    [
      "a schedule added",
      "CI-2",
      () =>
        change(original, "  pull_request:\n", "  pull_request:\n  schedule:\n"),
    ],
    [
      "pull_request_target",
      "CI-2",
      () => change(original, "  pull_request:\n", "  pull_request_target:\n"),
    ],
    [
      "node-version 20",
      "CI-3",
      () => change(original, 'node-version: "22"', 'node-version: "20"'),
    ],
    [
      "node-version 23",
      "CI-3",
      () => change(original, 'node-version: "22"', 'node-version: "23"'),
    ],
    ["engines changed", "CI-3", () => original, ">=22 <24"],
    [
      "setup-node step removed",
      "CI-4",
      () =>
        change(original, /^ {6}- name: Install Node 22\n(?: {8,}.*\n)+/mu, ""),
    ],
    [
      "the two runs swapped",
      "CI-4",
      () =>
        change(
          change(original, "run: npm ci", "run: @@"),
          "run: npm run check",
          "run: npm ci",
        ).replace("run: @@", "run: npm run check"),
    ],
    [
      "npm run test instead of npm run check",
      "CI-4",
      () => change(original, "run: npm run check", "run: npm run test"),
    ],
    [
      "working-directory removed",
      "CI-4",
      () => change(original, "        working-directory: tools\n", ""),
    ],
    [
      "checkout by tag",
      "CI-5",
      () => change(original, shaOf("checkout"), "$1v7"),
    ],
    [
      "setup-node by branch",
      "CI-5",
      () => change(original, shaOf("setup-node"), "$1main"),
    ],
    [
      "a third action",
      "CI-5",
      () =>
        `${original}      - name: Third\n        uses: actions/upload-artifact@${"a".repeat(40)} # v4.0.0\n`,
    ],
    [
      "a 39 character commit",
      "CI-5",
      () =>
        change(
          original,
          /(uses: actions\/checkout@[0-9a-f]{39})[0-9a-f]/u,
          "$1",
        ),
    ],
    [
      "another owner",
      "CI-5",
      () =>
        change(original, "uses: actions/checkout@", "uses: other/checkout@"),
    ],
    [
      "fetch-depth removed",
      "CI-6",
      () => change(original, "          fetch-depth: 0\n", ""),
    ],
    [
      "persist-credentials removed",
      "CI-6",
      () => change(original, "          persist-credentials: false\n", ""),
    ],
    [
      "package-manager-cache removed",
      "CI-6",
      () => change(original, "          package-manager-cache: false\n", ""),
    ],
    [
      "cache: npm added",
      "CI-6",
      () =>
        change(
          original,
          '          node-version: "22"\n',
          '          node-version: "22"\n          cache: npm\n',
        ),
    ],
    ...[
      "a || true",
      "continue-on-error: true",
      "x: ${{ secrets.EXAMPLE }}",
      "if: always()",
      "env:",
      "token: example",
      "x: GITHUB_TOKEN",
      "x: set +e",
      "x: exit 0",
      "x: curl",
      "x: wget",
      "x: http://example.test",
      "x: https://example.test",
      "x: ${{ github.sha }}",
    ].map((line) => [`the line "${line}"`, "CI-7", () => extra(line)]),
    [
      "write rights",
      "CI-7",
      () => change(original, "contents: read", "contents: write"),
    ],
  ];
  for (const [name, expected, make, engineText = engines] of mutants) {
    const found = ciFindings(Buffer.from(make()), engineText);
    assert.ok(
      found.some((f) => f.startsWith(`${expected}:`)),
      `${name}: expected a ${expected} violation, got ${JSON.stringify(found)}`,
    );
  }
});

// ---- criterion 4: the hook (PH-1 ... PH-8) -------------------------------------------

const ZERO_HASH = "0".repeat(40);
const SOME_HASH = "0123456789abcdef0123456789abcdef01234567";
const PUSH_LINE = `HEAD ${SOME_HASH} refs/heads/feature/example ${ZERO_HASH}\n`;
const DELETE_LINE = `(delete) ${ZERO_HASH} refs/heads/feature/example ${SOME_HASH}\n`;
// The address of the remote is passed to the hook as the second argument; it must never
// be printed (it can carry credentials). The example is made up.
const REMOTE_ADDRESS = `${"ssh"}://${"user"}:${"pw-example"}@host.example/x.git`;
const HOOK_TIMEOUT_MS = 120_000;

function onPath(name) {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (dir === "") continue;
    const candidate = path.join(dir, name);
    try {
      if (fs.statSync(candidate).isFile()) {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      }
    } catch {
      // not here
    }
  }
  throw new Error(`condition not created: ${name} is not on the PATH`);
}

// The environment of a nested run: the runner of tests inside a test reports to its parent
// unless NODE_TEST_CONTEXT is dropped (it then returns 0 even on a red test); the
// variables of the running npm and of git are dropped as well, so that the nested npm
// and git work on the fixture and not on this project.
function nestedEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key === "NODE_TEST_CONTEXT" || key === "INIT_CWD") continue;
    if (key.startsWith("GIT_") || /^npm_/iu.test(key)) continue;
    env[key] = value;
  }
  return {
    ...env,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    ...extra,
  };
}

function tempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function put(dir, rel, text, mode = 0o644) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  fs.chmodSync(abs, mode);
}

function run(file, args, options) {
  const r = spawnSync(file, args, {
    encoding: "utf8",
    timeout: HOOK_TIMEOUT_MS,
    ...options,
  });
  if (r.error) throw r.error;
  return {
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    out: r.stdout + r.stderr,
  };
}

// What the check script of a fixture does. "green" and "red" are the one script of
// tools/package.json, node --test over the files of test/ (the form "test/" alone fails
// with MODULE_NOT_FOUND even on a green test).
function checkScript(kind, marker) {
  if (kind === "exit7") return "node exit7.js";
  const tests = 'node --test "test/**/*.test.js"';
  return marker ? `node marker.js && ${tests}` : tests;
}

const GREEN_CASE =
  'import { test } from "node:test";\ntest("green", () => {});\n';
const RED_CASE =
  'import assert from "node:assert/strict";\nimport { test } from "node:test";\ntest("red", () => {\n  assert.fail("red on purpose");\n});\n';

function writeTools(dir, kind, marker) {
  put(
    dir,
    "tools/package.json",
    `${JSON.stringify({ name: "fixture", private: true, type: "module", scripts: { check: checkScript(kind, marker) } }, null, 2)}\n`,
  );
  put(dir, "tools/test/case.test.js", kind === "red" ? RED_CASE : GREEN_CASE);
  put(dir, "tools/exit7.js", "process.exit(7);\n");
  put(
    dir,
    "tools/marker.js",
    'import fs from "node:fs";\nfs.writeFileSync("ran.marker", "1");\n',
  );
}

function git(dir, args) {
  return run("git", args, { cwd: dir, env: nestedEnv() });
}

// A fixture repository in a temporary folder of its own: the copy of the hook (the
// text may be a damaged one), a fake tools/ with a real green or red test, and, when
// asked, a git repository with one commit.
function makeFixture(
  t,
  {
    hook = read(HOOK_REL),
    kind = "green",
    marker = false,
    repo = true,
    tools = true,
  } = {},
) {
  const dir = tempDir(t, "sai-req030-");
  put(dir, HOOK_REL, hook, 0o755);
  put(dir, "README.md", "fixture\n");
  if (tools) writeTools(dir, kind, marker);
  if (repo) {
    assert.equal(git(dir, ["init", "-q"]).status, 0);
    assert.equal(git(dir, ["add", "-A"]).status, 0);
    const commit = git(dir, [
      "-c",
      "user.name=fixture",
      "-c",
      "user.email=fixture@example.test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-q",
      "-m",
      "fixture",
    ]);
    assert.equal(commit.status, 0, commit.out);
  }
  return dir;
}

// The precondition of PH-3, PH-4 and PH-5 (in the spirit of PH-7): before the hook runs,
// the test runs the check script of such a fixture itself, in a folder of its own and
// without NODE_TEST_CONTEXT, and makes sure that a red test gives a code other than 0, a
// green one gives 0 and the script of code 7 gives 7. Otherwise the test is red with
// "condition not created": the cause would be the environment and not the hook.
function assertFixtureBehaves(t, kind, marker = false) {
  const dir = makeFixture(t, { kind, marker, repo: false });
  const r = run("npm", ["run", "check"], {
    cwd: path.join(dir, "tools"),
    env: nestedEnv(),
  });
  const marked = fs.existsSync(path.join(dir, "tools", "ran.marker"));
  const where = `condition not created (${kind}): ${r.out}`;
  if (kind === "green") assert.equal(r.status, 0, where);
  else if (kind === "exit7") assert.equal(r.status, 7, where);
  else assert.ok(r.status !== 0 && r.status !== null, where);
  if (marker)
    assert.ok(
      marked,
      `condition not created: the marker script did not run: ${r.out}`,
    );
  else
    assert.ok(
      !marked,
      "condition not created: a marker without the marker script",
    );
}

function runHook(
  dir,
  { stdin = PUSH_LINE, args = ["origin", REMOTE_ADDRESS], env } = {},
) {
  return run(onPath("sh"), [HOOK_REL, ...args], {
    cwd: dir,
    input: stdin,
    env: env ?? nestedEnv(),
  });
}

// The state of a folder: the type, mode and hash of everything in it except .git (whose
// state is kept by the output of git status) and, when there is a repository, the output
// of git status --porcelain.
function snapshot(dir) {
  const entries = [];
  const walk = (current) => {
    for (const name of fs.readdirSync(current).sort()) {
      if (current === dir && name === ".git") continue;
      const abs = path.join(current, name);
      const rel = path.relative(dir, abs);
      const st = fs.lstatSync(abs);
      if (st.isDirectory()) {
        entries.push([rel, "dir", st.mode & 0o777]);
        walk(abs);
      } else if (st.isSymbolicLink()) {
        entries.push([rel, "link", fs.readlinkSync(abs)]);
      } else {
        const hash = crypto
          .createHash("sha256")
          .update(fs.readFileSync(abs))
          .digest("hex");
        entries.push([rel, "file", st.mode & 0o777, hash]);
      }
    }
  };
  walk(dir);
  const status = fs.existsSync(path.join(dir, ".git"))
    ? git(dir, ["status", "--porcelain", "--untracked-files=all"]).out
    : null;
  return { entries, status };
}

// A PATH with only git and sh in it: a new folder of symbolic links to the two programs
// found on the system before the run.
function pathWithoutNpm(t) {
  const bin = tempDir(t, "sai-req030-bin-");
  for (const name of ["git", "sh"])
    fs.symlinkSync(onPath(name), path.join(bin, name));
  const probe = run(onPath("sh"), ["-c", "command -v npm"], {
    env: { PATH: bin },
  });
  assert.notEqual(
    probe.status,
    0,
    `condition not created: npm is found on ${bin}: ${probe.out}`,
  );
  return bin;
}

const HOOK_FORBIDDEN = ["--no-verify", "||", "set +e", "curl", "wget", "://"];

function hookFindings(text) {
  const out = [];
  const add = (n, msg) => out.push(`PH-${n}: ${msg}`);
  if (text.split("\n")[0] !== "#!/bin/sh")
    add(1, "the first line is not #!/bin/sh");
  if (text.includes("\r")) add(1, "has a CR");
  for (const word of HOOK_FORBIDDEN)
    if (text.includes(word)) add(2, `contains ${word}`);
  if (/\beval\b/u.test(text)) add(2, "contains eval");
  if ((text.match(/\bexit 0\b/gu) ?? []).length > 1)
    add(2, "more than one exit 0");
  // The command itself on a line of its own (the message of the hook names it too), and
  // the move into tools/ by "cd", also in the form "if ! cd".
  if (!/^\s*npm run check\s*$/mu.test(text))
    add(2, "no line that runs npm run check");
  if (!/^\s*(?:if\s+!\s+)?cd\s+\S*tools\S*/mu.test(text))
    add(2, "no cd into tools");
  return out;
}

function hookOwn(id) {
  return hookFindings(read(HOOK_REL)).filter((f) => f.startsWith(`${id}:`));
}

test("REQ-030 AC4 PH-1: .githooks/pre-push is a regular file the owner may execute, starts with #!/bin/sh and has no CR", () => {
  const abs = path.join(ROOT, HOOK_REL);
  assert.ok(
    fs.lstatSync(abs).isFile(),
    "not a regular file (a link does not count)",
  );
  fs.accessSync(abs, fs.constants.X_OK);
  assert.deepEqual(hookOwn("PH-1"), []);
});

test("REQ-030 AC4 PH-2: the hook runs npm run check from tools/ and has no bypass, no ||, no eval, no address and at most one exit 0", () => {
  assert.deepEqual(hookOwn("PH-2"), []);
  const original = read(HOOK_REL);
  const mutants = [
    [
      "a first line other than the shell",
      "PH-1",
      () => change(original, "#!/bin/sh", "#!/bin/bash"),
    ],
    ["a CR", "PH-1", () => change(original, "#!/bin/sh\n", "#!/bin/sh\r\n")],
    ["--no-verify", "PH-2", () => `${original}# --no-verify\n`],
    [
      "a ||",
      "PH-2",
      () =>
        change(
          original,
          "npm run check\ncode=$?",
          "npm run check || true\ncode=$?",
        ),
    ],
    ["set +e", "PH-2", () => `${original}set +e\n`],
    ["eval", "PH-2", () => `${original}eval true\n`],
    ["curl", "PH-2", () => `${original}curl --version\n`],
    ["wget", "PH-2", () => `${original}wget --version\n`],
    ["an address", "PH-2", () => `${original}# ${REMOTE_ADDRESS}\n`],
    ["a second exit 0", "PH-2", () => `${original}exit 0\n`],
    [
      "the run of npm run check removed",
      "PH-2",
      () => change(original, "npm run check\ncode=$?", "true\ncode=$?"),
    ],
    [
      "the move into tools removed",
      "PH-2",
      () => change(original, 'if ! cd "$root/tools"; then', "if ! true; then"),
    ],
  ];
  for (const [name, expected, make] of mutants) {
    const found = hookFindings(make());
    assert.ok(
      found.some((f) => f.startsWith(`${expected}:`)),
      `${name}: expected a ${expected} violation, got ${JSON.stringify(found)}`,
    );
  }
});

// Each scenario runs the hook (the real one or a damaged copy) in fixtures of its own and
// returns the list of what is wrong; an empty list means the scenario is satisfied.
const RED_AND_SEVEN = (t, hook) => {
  const problems = [];
  const red = makeFixture(t, { hook, kind: "red" });
  const r = runHook(red);
  if (r.status === 0) problems.push("a red test: the hook exits with 0");
  const seven = makeFixture(t, { hook, kind: "exit7" });
  const s = runHook(seven);
  if (s.status !== 1)
    problems.push(`a check of code 7: the hook exits with ${s.status}, need 1`);
  if (!s.out.includes("(код 7)"))
    problems.push(`a check of code 7: no "(код 7)" in ${s.out}`);
  return problems;
};

const GREEN = (t, hook) => {
  const problems = [];
  const r = runHook(makeFixture(t, { hook, kind: "green" }));
  if (r.status !== 0)
    problems.push(`a green test: the hook exits with ${r.status}`);
  if (!/# pass 1\b/u.test(r.out))
    problems.push(`a green test: the check did not run: ${r.out}`);
  return problems;
};

test("REQ-030 AC4 PH-3: a red test stops the push (code other than 0) and the hook reports the real code of the check", (t) => {
  assertFixtureBehaves(t, "red");
  assertFixtureBehaves(t, "exit7");
  assert.deepEqual(RED_AND_SEVEN(t, read(HOOK_REL)), []);
  const original = read(HOOK_REL);
  const mutants = [
    [
      "the code of the check is lost",
      change(original, "code=$?", "true\ncode=$?"),
    ],
    [
      "the check does not decide",
      change(
        original,
        'if [ "$code" -ne 0 ]; then',
        'if [ "$code" -ne 0 ] && false; then',
      ),
    ],
    ["the printed code is lost", change(original, "(код $code)", "(код $?)")],
  ];
  for (const [name, hook] of mutants) {
    assert.notDeepEqual(RED_AND_SEVEN(t, hook), [], `not caught: ${name}`);
  }
});

test("REQ-030 AC4 PH-4: a green test lets the push go (code 0) and the check really runs", (t) => {
  assertFixtureBehaves(t, "green");
  assert.deepEqual(GREEN(t, read(HOOK_REL)), []);
  const original = read(HOOK_REL);
  const stops = change(
    original,
    'echo "pre-push: проверка прошла"',
    'echo "pre-push: проверка прошла"\nexit 1',
  );
  assert.notDeepEqual(GREEN(t, stops), [], "not caught: the hook always stops");
});

// The fixture of PH-5: a red test and a check script that writes a marker file when it
// runs. The marker tells whether the check was started.
function skipScenarios(t, hook) {
  const problems = [];
  const started = (stdin) => {
    const dir = makeFixture(t, { hook, kind: "red", marker: true });
    const r = runHook(dir, { stdin });
    return { r, marker: fs.existsSync(path.join(dir, "tools", "ran.marker")) };
  };
  const onlyDeletes = started(
    DELETE_LINE + DELETE_LINE.replace("feature/example", "feature/other"),
  );
  if (onlyDeletes.r.status !== 0)
    problems.push(`only deletions: code ${onlyDeletes.r.status}`);
  if (onlyDeletes.marker)
    problems.push("only deletions: the check was started");
  const wide = started(
    `(delete) ${"0".repeat(64)} refs/heads/feature/example ${"a".repeat(64)}\n`,
  );
  if (wide.r.status !== 0 || wide.marker)
    problems.push("only deletions with 64 character hashes: not skipped");
  const mixed = started(DELETE_LINE + PUSH_LINE);
  if (!mixed.marker)
    problems.push("a deletion and a push: the check was not started");
  if (mixed.r.status === 0)
    problems.push("a deletion and a push of red code: code 0");
  const tag = started(`refs/tags/t1 ${SOME_HASH} refs/tags/t1 ${ZERO_HASH}\n`);
  if (!tag.marker) problems.push("a push of a tag: the check was not started");
  const noHash = started("HEAD\n");
  if (!noHash.marker)
    problems.push(
      "a line without a hash is not a deletion: the check was not started",
    );
  const empty = started("");
  if (!empty.marker) problems.push("an empty input: the check was not started");
  return problems;
}

test("REQ-030 AC4 PH-5: a push of only deletions does not start the check; a push of code, a mixed one and an empty input do", (t) => {
  assertFixtureBehaves(t, "red", true);
  assert.deepEqual(skipScenarios(t, read(HOOK_REL)), []);
  const original = read(HOOK_REL);
  const condition = 'if [ "$seen" -eq 1 ] && [ "$code_pushed" -eq 0 ]; then';
  assert.notDeepEqual(
    skipScenarios(t, change(original, condition, "if false; then")),
    [],
    "not caught: no skip at all",
  );
  assert.notDeepEqual(
    skipScenarios(t, change(original, condition, 'if [ "$seen" -eq 1 ]; then')),
    [],
    "not caught: skip of everything",
  );
});

// The four ways the hook refuses before or instead of the check, each as a fixture and a
// run; `write` is the line a damaged hook gets there to write a file.
const REFUSALS = [
  {
    name: "a red check",
    message: 'echo "pre-push: проверка не прошла',
    make: (t, hook) => ({ dir: makeFixture(t, { hook, kind: "red" }) }),
  },
  {
    name: "no tools/",
    message: 'echo "pre-push: нет папки tools',
    make: (t, hook) => ({ dir: makeFixture(t, { hook, tools: false }) }),
  },
  {
    name: "no npm on the PATH",
    message: 'echo "pre-push: не найден npm',
    make: (t, hook) => ({
      dir: makeFixture(t, { hook }),
      env: nestedEnv({ PATH: pathWithoutNpm(t) }),
    }),
  },
  {
    name: "outside a git repository",
    message: 'echo "pre-push: это не git-репозиторий',
    make: (t, hook) => ({
      dir: makeFixture(t, { hook, repo: false }),
      env: nestedEnv({ GIT_CEILING_DIRECTORIES: fs.realpathSync(os.tmpdir()) }),
      outside: true,
    }),
  },
];

// Runs the hook on a refusal and returns { r, before, after }.
function refusal(t, spec, hook) {
  const { dir, env, outside } = spec.make(t, hook);
  if (outside) {
    const probe = run("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      env,
    });
    assert.notEqual(
      probe.status,
      0,
      `condition not created: ${dir} is inside a repository`,
    );
  }
  const before = snapshot(dir);
  const r = runHook(dir, { env });
  return { r, before, after: snapshot(dir) };
}

test("REQ-030 AC4 PH-6: every refusal of the hook leaves the folder as it was; a hook that writes a file there is seen", (t) => {
  assertFixtureBehaves(t, "red");
  const original = read(HOOK_REL);
  for (const spec of REFUSALS) {
    const { r, before, after } = refusal(t, spec, original);
    assert.notEqual(
      r.status,
      0,
      `${spec.name}: the hook did not refuse: ${r.out}`,
    );
    assert.deepEqual(after, before, `${spec.name}: the state changed`);
    // The same refusal with a hook that writes a file on this path: the snapshot must differ.
    const line = original
      .split("\n")
      .find((l) => l.includes(spec.message.slice(6)));
    assert.ok(
      line !== undefined,
      `${spec.name}: the message is not in the hook`,
    );
    const damaged = change(original, line, `${line}\n  echo x > mutant.log`);
    const bad = refusal(t, spec, damaged);
    assert.notDeepEqual(
      bad.after,
      bad.before,
      `${spec.name}: a written file is not seen`,
    );
  }
});

test("REQ-030 AC4 PH-7: no tools/, no npm on the PATH and no git repository each give a message and a code other than 0, and no check is started", (t) => {
  const original = read(HOOK_REL);
  const expected = {
    "no tools/": "нет папки tools",
    "no npm on the PATH": "не найден npm",
    "outside a git repository": "это не git-репозиторий",
  };
  for (const spec of REFUSALS.filter((s) => expected[s.name])) {
    const { r, before, after } = refusal(t, spec, original);
    assert.notEqual(r.status, 0, `${spec.name}: code 0`);
    assert.ok(
      r.out.includes(expected[spec.name]),
      `${spec.name}: no message in ${r.out}`,
    );
    assert.ok(!r.out.includes("проверка прошла"), `${spec.name}: ${r.out}`);
    assert.ok(
      !r.out.includes("# tests"),
      `${spec.name}: the check was started: ${r.out}`,
    );
    assert.deepEqual(after, before, `${spec.name}: the state changed`);
  }
});

test("REQ-030 AC4 PH-7 (tools/ that cannot be entered): a message, code 1 and the state unchanged", (t) => {
  assert.notEqual(
    process.getuid?.(),
    0,
    "this test needs a user that is not root",
  );
  const dir = makeFixture(t);
  const tools = path.join(dir, "tools");
  const before = snapshot(dir);
  const mode = fs.statSync(tools).mode & 0o777;
  fs.chmodSync(tools, 0o000);
  let r;
  try {
    // A check that the folder is really closed: the test is red if it is not.
    assert.throws(() => fs.readdirSync(tools), /EACCES/u);
    r = runHook(dir);
  } finally {
    fs.chmodSync(tools, mode);
  }
  assert.equal(r.status, 1, r.out);
  assert.ok(r.out.includes("не удалось перейти в папку tools"), r.out);
  assert.deepEqual(snapshot(dir), before);
});

test("REQ-030 AC4 PH-8: the address of the remote, the second argument, is never printed", (t) => {
  const original = read(HOOK_REL);
  const leaks = (hook) => {
    const found = [];
    for (const kind of ["green", "red"]) {
      const r = runHook(makeFixture(t, { hook, kind }));
      if (r.out.includes(REMOTE_ADDRESS) || r.out.includes("pw-example"))
        found.push(`${kind}: ${r.out}`);
    }
    const none = runHook(makeFixture(t, { hook, tools: false }));
    if (none.out.includes("pw-example")) found.push(`no tools: ${none.out}`);
    return found;
  };
  assert.deepEqual(leaks(original), []);
  const prints = change(
    original,
    'echo "pre-push: проверка прошла"',
    'echo "pre-push: проверка прошла $2"',
  );
  assert.notDeepEqual(
    leaks(prints),
    [],
    "not caught: the hook prints the address",
  );
});

// ---- criterion 4 (README part) and criterion 5: the README section (RD-1 ... RD-4) ---

const README_WORDS = [
  ".github/workflows/check.yml",
  "npm run check",
  "Node 22",
  "gh run list --workflow check.yml",
  "защиты ветки нет",
  "decisions/0023",
  "D1",
  "мерж подтверждает владелец",
  ".githooks/pre-push",
  "около 2 минут",
  "git config core.hooksPath .githooks",
  "обход",
  "рабочей папке",
];
const README_COMMAND = "git config core.hooksPath .githooks";
const README_BANNED = [
  "ветка защищена",
  "защита включена",
  "обязательная проверка",
  "приватн",
  "публичн",
  "403",
];
const HOME_IN_TEXT = new RegExp(
  String.raw`(?:^|[^A-Za-z0-9._-])/(?:${"Us"}ers|${"ho"}me)/[A-Za-z0-9._-]`,
  "u",
);

// The section of the README and the list of violations, each starting with the id of
// the test that owns the rule.
function readmeFindings(text) {
  const out = [];
  const add = (n, msg) => out.push(`RD-${n}: ${msg}`);
  const lines = text.split("\n");
  const where = (heading) =>
    lines.flatMap((l, i) => (l.trim() === heading ? [i] : []));
  const mine = where(README_HEADING);
  const previous = where(README_PREVIOUS);
  if (mine.length !== 1)
    add(1, `${mine.length} headings "${README_HEADING}", need 1`);
  if (previous.length !== 1)
    add(1, `${previous.length} headings "${README_PREVIOUS}"`);
  if (mine.length !== 1 || previous.length !== 1) {
    // Without exactly one section no later rule can hold; saying so keeps RD-2...RD-4
    // from passing on nothing.
    for (const n of [2, 3, 4]) add(n, "there is no single section to read");
    return out;
  }
  if (mine[0] < previous[0])
    add(1, "the section stands before the section it follows");
  else if (lines.slice(previous[0] + 1, mine[0]).some((l) => /^## /u.test(l)))
    add(1, "another ## section stands between the two");
  const end = lines.findIndex((l, i) => i > mine[0] && /^## /u.test(l));
  const body = lines.slice(mine[0] + 1, end < 0 ? lines.length : end);
  const section = body.join("\n");
  for (const bad of ["://", "git@"])
    if (section.includes(bad)) add(1, `the section has ${bad}`);
  if (HOME_IN_TEXT.test(section))
    add(1, "the section has a path of a home folder");

  const flat = section.replace(/\s+/gu, " ");
  for (const word of README_WORDS)
    if (!flat.includes(word)) add(2, `no "${word}"`);

  let inBlock = false;
  let commandInBlock = false;
  for (const line of body) {
    if (/^\s*```/u.test(line)) inBlock = !inBlock;
    else if (inBlock && line.trim() === README_COMMAND) commandInBlock = true;
  }
  if (!commandInBlock)
    add(3, `"${README_COMMAND}" is not on a line of its own in a code block`);

  const lower = flat.toLowerCase();
  for (const bad of README_BANNED)
    if (lower.includes(bad)) add(4, `the section has "${bad}"`);
  return out;
}

function readmeOwn(id) {
  return readmeFindings(read("README.md")).filter((f) =>
    f.startsWith(`${id}:`),
  );
}

test('REQ-030 AC5 RD-1: README.md has one section after "Как открыть на другом компьютере", on its own, with no address and no path', () => {
  assert.deepEqual(readmeOwn("RD-1"), []);
});

test('REQ-030 AC4 AC5 RD-2: the section has the thirteen exact words, including "защиты ветки нет" in lower case', () => {
  assert.equal(README_WORDS.length, 13);
  assert.deepEqual(readmeOwn("RD-2"), []);
});

test("REQ-030 AC4 AC5 RD-3: git config core.hooksPath .githooks stands on a line of its own in a code block of the section", () => {
  assert.deepEqual(readmeOwn("RD-3"), []);
});

test("REQ-030 AC5 RD-4: the section claims no protection and says nothing about the visibility of the repository", () => {
  assert.deepEqual(readmeOwn("RD-4"), []);
});

test("REQ-030 AC5 RD-1..RD-4: the rules are not blind: every damaged copy of the README has the expected violation", () => {
  const original = read("README.md");
  assert.deepEqual(readmeFindings(original), []);
  const inSection = (line) =>
    change(original, `${README_HEADING}\n`, `${README_HEADING}\n\n${line}\n`);
  const lines = original.split("\n");
  const start = lines.indexOf(README_HEADING);
  const end = lines.findIndex((l, i) => i > start && /^## /u.test(l));
  const section = lines.slice(start, end).join("\n");
  const without = original.replace(section, "");
  const sectionText = (fn) => change(original, section, fn(section));
  const mutants = [
    [
      "a heading of the third level",
      "RD-1",
      () => change(original, README_HEADING, `#${README_HEADING}`),
    ],
    ["the heading twice", "RD-1", () => `${original}\n${README_HEADING}\n`],
    [
      "the section before the one it follows",
      "RD-1",
      () =>
        change(
          without,
          `${README_PREVIOUS}\n`,
          `${section}\n${README_PREVIOUS}\n`,
        ),
    ],
    ["an address", "RD-1", () => inSection(`см. ${"https"}://example.test`)],
    ["an address of git", "RD-1", () => inSection(`${"git"}@example.test:a/b`)],
    [
      "a path of a home folder",
      "RD-1",
      () => inSection(`${"/Us"}ers/example/x`),
    ],
    ...README_WORDS.map((word) => [
      `the words "${word}" removed`,
      "RD-2",
      () => sectionText((s) => s.split(word).join("ZZ")),
    ]),
    [
      '"защиты ветки нет" in capitals',
      "RD-2",
      () =>
        sectionText((s) =>
          s.split("защиты ветки нет").join("Защиты ветки нет"),
        ),
    ],
    [
      "the command only in a paragraph",
      "RD-3",
      () =>
        sectionText((s) =>
          s.replace(
            /```\n(?:git config core\.hooksPath \.githooks\n)```/u,
            `\`${README_COMMAND}\``,
          ),
        ),
    ],
    ...README_BANNED.map((word) => [
      `the words "${word}"`,
      "RD-4",
      () => inSection(`Это: ${word}.`),
    ]),
  ];
  for (const [name, expected, make] of mutants) {
    const found = readmeFindings(make());
    assert.ok(
      found.some((f) => f.startsWith(`${expected}:`)),
      `${name}: expected a ${expected} violation, got ${JSON.stringify(found)}`,
    );
  }
});
