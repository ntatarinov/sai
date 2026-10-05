import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mock } from "node:test";
import { applyVerdict } from "../src/apply.js";
import {
  BLOCK_HEADING,
  CRITERIA,
  LENSES,
  REQUIRED_CHECKS,
  SCHEMAS,
} from "../src/contract.js";
import { prepareRun } from "../src/prepare.js";
import { sha256, stableJson } from "../src/util.js";

export const RUN_ID = "WF06-20260925-01";
export const IDS = ["01-alpha", "02-beta"];
export const LABELS = { market: "a-m", execution: "a-e", owner_fit: "a-o" };
export const ALPHA = "ideas/01-alpha.md";
export const BETA = "ideas/02-beta.md";
export const BAR = "docs/quality-bar.md";

export const Q = {
  a1: "Альфа приводит заявки малому бизнесу через умный квиз.",
  a2: "Спрос на квизы доказан платящими клиентами конструкторов.",
  a3: "Конкурентов много на рынке квизов",
  b1: "Бета подбирает размер одежды покупателю по росту и весу.",
  b2: "Проверка спроса у магазинов стоит почти ноль.",
  bar: "Летфлоу — нижняя граница качества проекта.",
  conclusion: "Альфу выбрали окончательно.",
};

export const ALPHA_TEXT = `# Идея 1 — Альфа: квизы для заявок

Записано: 2026-09-23. Статус: выбрана.
Продолжение статусного абзаца.

## Суть

${Q.a1}
${Q.a2}

| Идея | Что нашли | Итог |
|---|---|---|
| Квиз | ${Q.a3} | Отброшено |

<!-- conclusion:start -->
## Решение

${Q.conclusion}
<!-- conclusion:end -->
`;

export const BETA_TEXT = `# Идея 2 — Бета: подбор размера

## Суть

${Q.b1}
${Q.b2}
`;

export const STATE_TEXT = `# Состояние проекта

### Решение владельца о старте

Не принято.

### Что делать дальше — по порядку

1. Проверить спрос.
`;

// Round-1 scores. Final after round 3: market 01-alpha demand_evidence 4 -> 3.
export const R1 = {
  market: {
    "01-alpha": { demand_evidence: 4, competition_gap: 2 },
    "02-beta": { demand_evidence: 3, competition_gap: 4 },
  },
  execution: {
    "01-alpha": { cost_to_test: 3, build_fit: 4 },
    "02-beta": { cost_to_test: 5, build_fit: 4 },
  },
  owner_fit: {
    "01-alpha": { owner_goals: 2, no_selling_self: 4 },
    "02-beta": { owner_goals: 4, no_selling_self: 5 },
  },
};

const EVIDENCE = {
  "01-alpha": { source: ALPHA, quote: Q.a1 },
  "02-beta": { source: BETA, quote: Q.b1 },
};

export function ev(source, quote) {
  return { source, quote };
}

export function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sai-wf06-"));
  const files = {
    [ALPHA]: ALPHA_TEXT,
    [BETA]: BETA_TEXT,
    "ideas/README.md":
      "# Идеи\n\n| Файл | Статус |\n|---|---|\n| 02 | Выбрана |\n",
    [BAR]: `# Планка\n\n${Q.bar}\n`,
    "STATE.md": STATE_TEXT,
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  fs.mkdirSync(path.join(root, "runs"));
  return root;
}

export function prepareOptions(overrides = {}) {
  return {
    runId: RUN_ID,
    candidates: [...IDS],
    context: [BAR],
    analysts: { ...LABELS },
    judge: "judge",
    executor: "executor",
    createdAt: "2026-09-25T10:00:00Z",
    ...overrides,
  };
}

function assessment(lens) {
  return {
    schema: SCHEMAS.assessment,
    run_id: RUN_ID,
    produced_by: { role: "IDEA-ANALYST", instance: LABELS[lens] },
    lens,
    ideas: IDS.map((id) => ({
      idea_id: id,
      scores: Object.fromEntries(
        CRITERIA[lens].map((c) => [
          c,
          {
            score: R1[lens][id][c],
            evidence: [EVIDENCE[id]],
            comment: "обоснование",
          },
        ]),
      ),
      summary: "сводка",
    })),
  };
}

const DISAGREEMENTS = [
  {
    raised_by: "market",
    lens: "owner_fit",
    idea_id: "02-beta",
    criterion: "owner_goals",
    proposed: 3,
    evidence: ev(BETA, Q.b2),
  },
  {
    raised_by: "execution",
    lens: "market",
    idea_id: "01-alpha",
    criterion: "demand_evidence",
    proposed: 3,
    evidence: ev(ALPHA, Q.a3),
  },
];

function crossreview(lens) {
  const items = [];
  for (const other of LENSES.filter((l) => l !== lens)) {
    for (const id of IDS) {
      for (const c of CRITERIA[other]) {
        const d = DISAGREEMENTS.find(
          (x) =>
            x.raised_by === lens &&
            x.lens === other &&
            x.idea_id === id &&
            x.criterion === c,
        );
        const base = {
          lens: other,
          idea_id: id,
          criterion: c,
          their_score: R1[other][id][c],
        };
        items.push(
          d
            ? {
                ...base,
                stance: "disagree",
                proposed_score: d.proposed,
                note: "не согласен",
                evidence: [d.evidence],
              }
            : { ...base, stance: "agree", note: "согласен" },
        );
      }
    }
  }
  return {
    schema: SCHEMAS.crossreview,
    run_id: RUN_ID,
    produced_by: { role: "IDEA-ANALYST", instance: LABELS[lens] },
    lens,
    items,
  };
}

function response(lens, responses) {
  return {
    schema: SCHEMAS.response,
    run_id: RUN_ID,
    produced_by: { role: "IDEA-ANALYST", instance: LABELS[lens] },
    lens,
    responses,
  };
}

export function verdict(version = 1) {
  return {
    schema: SCHEMAS.verdict,
    run_id: RUN_ID,
    produced_by: { role: "IDEA-JUDGE", instance: "judge" },
    version,
    created_at: "2026-09-25T11:00:00Z",
    ranking: [
      { idea_id: "02-beta", rank: 1, total: 25, rationale: "выше сумма" },
      { idea_id: "01-alpha", rank: 2, total: 18, rationale: "ниже сумма" },
    ],
    chosen: "02-beta",
    confidence: "medium",
    reasons: [
      {
        text: "Спрос проверяется дёшево",
        refs: [
          { lens: "execution", idea_id: "02-beta", criterion: "cost_to_test" },
        ],
      },
      {
        text: "Не требует продавать себя",
        refs: [
          {
            lens: "owner_fit",
            idea_id: "02-beta",
            criterion: "no_selling_self",
          },
        ],
      },
    ],
    dissent: [
      {
        raised_by: "market",
        lens: "owner_fit",
        idea_id: "02-beta",
        criterion: "owner_goals",
        resolution: "балл сохранён, риск в условиях",
      },
    ],
    conditions: ["Проверить спрос у 20 магазинов"],
    kill_criteria: ["Никто не платит"],
    owner_decision_required: true,
    next_actions: [
      {
        to_agent: "REQ-ANALYST",
        task: "Составить требования к демо",
        acceptance_criteria: ["Требования прошли REQ-VALIDATOR"],
      },
    ],
  };
}

export const VERDICT_MD =
  "# Вердикт\n\nВыбрана идея 02-beta.\n\n## Ограничения\n\nАналитики знали название проекта.\n";

export function review(version = 1, decision = "ACCEPT") {
  return {
    schema: SCHEMAS.review,
    run_id: RUN_ID,
    produced_by: { role: "VERDICT-EXECUTOR", instance: "executor" },
    version,
    decision,
    checks: REQUIRED_CHECKS.map((name) => ({
      name,
      result: "PASS",
      detail: "проверено",
    })),
    issues: decision === "REJECT" ? ["нужно уточнить причины"] : [],
  };
}

export function artifacts() {
  return {
    "assessment-market.json": assessment("market"),
    "assessment-execution.json": assessment("execution"),
    "assessment-owner_fit.json": assessment("owner_fit"),
    "crossreview-market.json": crossreview("market"),
    "crossreview-execution.json": crossreview("execution"),
    "crossreview-owner_fit.json": crossreview("owner_fit"),
    "response-market.json": response("market", [
      {
        raised_by: "execution",
        idea_id: "01-alpha",
        criterion: "demand_evidence",
        action: "revise",
        from: 4,
        to: 3,
        reason: "согласен снизить",
      },
    ]),
    "response-execution.json": response("execution", []),
    "response-owner_fit.json": response("owner_fit", [
      {
        raised_by: "market",
        idea_id: "02-beta",
        criterion: "owner_goals",
        action: "hold",
        reason: "держусь",
        evidence: [ev(BETA, Q.b1)],
      },
    ]),
    "verdict-1.json": verdict(1),
    "verdict-1.md": VERDICT_MD,
    "verdict-review-1.json": review(1),
  };
}

export function runDirOf(root) {
  return path.join(root, "runs", RUN_ID);
}

export function writeArtifacts(root, arts) {
  for (const [name, value] of Object.entries(arts)) {
    const target = path.join(runDirOf(root), name);
    if (value === undefined) fs.rmSync(target, { force: true });
    else
      fs.writeFileSync(
        target,
        typeof value === "string" ? value : stableJson(value),
      );
  }
}

// A project with a complete, valid run; `mutate` edits the artifacts before writing.
export function validRun(mutate) {
  const root = makeProject();
  const prepared = prepareRun(root, prepareOptions());
  assert.ok(prepared.issues.empty, JSON.stringify(prepared.issues.list));
  const arts = artifacts();
  if (mutate) mutate(arts, root);
  writeArtifacts(root, arts);
  return { root, runDir: runDirOf(root), arts, seal: prepared.seal };
}

// ---------------------------------------------------------------------------
// Strict listing (design REQ-002 §9.2). One entry per path under the root, found with
// lstat: folders, files, links and anything else, each with its permission bits; files
// also with their size, the sha256 of their bytes and their modification time in
// nanoseconds; links with their text. Links are never followed and pipes and sockets
// never opened (reading a pipe that has no writer hangs). The modification time of a
// folder is not part of it: creating and removing a temporary file in a folder changes
// it (design §5.2).
// ---------------------------------------------------------------------------

function modeText(st) {
  return (Number(st.mode) & 0o7777).toString(8).padStart(4, "0");
}

function digestOf(abs) {
  try {
    return sha256(fs.readFileSync(abs));
  } catch (err) {
    if (err.code === "EACCES" || err.code === "EPERM") return "unreadable";
    throw err;
  }
}

function collect(abs, label, out) {
  const st = fs.lstatSync(abs, { bigint: true });
  const entry = { path: label, type: "o", mode: modeText(st) };
  out.push(entry);
  if (st.isDirectory()) {
    entry.type = "d";
    for (const name of fs.readdirSync(abs)) {
      const child = label === "." ? name : `${label}/${name}`;
      collect(path.join(abs, name), child, out);
    }
  } else if (st.isSymbolicLink()) {
    entry.type = "l";
    entry.link = fs.readlinkSync(abs);
  } else if (st.isFile()) {
    entry.type = "f";
    entry.size = Number(st.size);
    entry.sha = digestOf(abs);
    entry.mtimeNs = String(st.mtimeNs);
  }
}

function byPath(a, b) {
  if (a.path === b.path) return 0;
  return a.path < b.path ? -1 : 1;
}

// The strict listing as a Map from path to entry, sorted by path. `.` is `root` itself;
// the other paths are relative to it, "/"-separated. `extra` are absolute paths outside
// `root` (a file, or a folder with everything in it) that are listed as well.
export function listing(root, ...extra) {
  const out = [];
  collect(root, ".", out);
  for (const abs of extra) {
    assert.ok(path.isAbsolute(abs), `extra path must be absolute: ${abs}`);
    if (fs.existsSync(abs) || isLink(abs)) collect(abs, abs, out);
    else out.push({ path: abs, type: "-" });
  }
  out.sort(byPath);
  return new Map(out.map((entry) => [entry.path, entry]));
}

// The strict listing taken in a child process with a time limit. For a row that has a pipe
// in the root: a tree() that opened the pipe would hang for ever in this process and freeze
// the whole test file; in a child it is killed after the limit and the row fails instead.
export function listingInChild(root, ...extra) {
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { listing } from ${JSON.stringify(import.meta.url)}; process.stdout.write(JSON.stringify([...listing(process.argv[1], ...process.argv.slice(2)).values()]));`,
      root,
      ...extra,
    ],
    { encoding: "utf8", timeout: CLI_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
  );
  assert.equal(
    child.status,
    0,
    `the listing must finish in time: ${JSON.stringify({ signal: child.signal, error: child.error?.code, stderr: child.stderr })}`,
  );
  return new Map(JSON.parse(child.stdout).map((entry) => [entry.path, entry]));
}

function isLink(abs) {
  try {
    return fs.lstatSync(abs).isSymbolicLink();
  } catch {
    return false;
  }
}

// `<type> <mode> <size> <content> <time> <path>`, "-" where a field does not apply.
export function describeEntry(entry) {
  if (entry.type === "-") return `- - - - - ${entry.path}`;
  const size = entry.size === undefined ? "-" : String(entry.size);
  const content = entry.type === "l" ? `-> ${entry.link}` : (entry.sha ?? "-");
  const time = entry.mtimeNs ?? "-";
  return `${entry.type} ${entry.mode} ${size} ${content} ${time} ${entry.path}`;
}

// The same listing as one text, entries joined with "\n". Existing tests compare it
// before and after a command with assert.equal.
export function tree(root, ...extra) {
  return [...listing(root, ...extra).values()].map(describeEntry).join("\n");
}

// What differs between two listings, one text per difference; empty when they are equal.
export function listingDiff(before, after) {
  const out = [];
  for (const [p, b] of before) {
    const a = after.get(p);
    if (a === undefined) out.push(`removed: ${describeEntry(b)}`);
    else if (describeEntry(a) !== describeEntry(b)) {
      out.push(`changed: ${describeEntry(b)}  ->  ${describeEntry(a)}`);
    }
  }
  for (const [p, a] of after) {
    if (!before.has(p)) out.push(`added: ${describeEntry(a)}`);
  }
  return out;
}

export function assertSameListing(before, after) {
  assert.deepEqual(
    listingDiff(before, after),
    [],
    "the strict listing must not change",
  );
}

// `after` equals `before` except for the entries named here. `replaced`: paths that are
// in both, `added`: paths that are only in `after`. Each maps a path to the fields of the
// entry that are expected (only those are compared; a time that cannot be known in
// advance is simply left out). Anything else that differs is a failure.
export function assertListingChange(
  before,
  after,
  { replaced = {}, added = {} } = {},
) {
  const problems = [];
  const check = (entry, want, how) => {
    for (const [key, value] of Object.entries(want)) {
      if (entry[key] !== value) {
        problems.push(
          `${how} ${entry.path}: ${key} is ${entry[key]}, expected ${value}`,
        );
      }
    }
  };
  for (const [p, b] of before) {
    const a = after.get(p);
    if (p in replaced) {
      if (a === undefined) problems.push(`removed: ${describeEntry(b)}`);
      else check(a, replaced[p], "replaced");
    } else if (a === undefined) problems.push(`removed: ${describeEntry(b)}`);
    else if (describeEntry(a) !== describeEntry(b)) {
      problems.push(`changed: ${describeEntry(b)}  ->  ${describeEntry(a)}`);
    }
  }
  for (const [p, a] of after) {
    if (before.has(p)) continue;
    if (p in added) check(a, added[p], "added");
    else problems.push(`added: ${describeEntry(a)}`);
  }
  for (const p of Object.keys(added)) {
    if (!after.has(p)) problems.push(`missing: ${p}`);
  }
  for (const p of Object.keys(replaced)) {
    if (!before.has(p)) problems.push(`not in the listing before: ${p}`);
  }
  assert.deepEqual(problems, [], "the strict listing changed in other ways");
}

// The fields a regular file with these bytes and permission bits must have.
export function fileSpec(text, mode) {
  const bytes = Buffer.from(text, "utf8");
  return { type: "f", mode, size: bytes.length, sha: sha256(bytes) };
}

// Entries whose name is one of the temporary names of the write phase (design §5.5).
export function leftoversIn(map) {
  return [...map.keys()].filter((p) =>
    p.split("/").some((segment) => segment.includes(".sai-")),
  );
}

export function assertCode(result, code) {
  const codes = result.issues.codes();
  assert.ok(
    codes.includes(code),
    `expected ${code}, got [${codes.join(", ")}]`,
  );
}

export function readRunJson(root) {
  return JSON.parse(
    fs.readFileSync(path.join(runDirOf(root), "run.json"), "utf8"),
  );
}

export function writeRunJson(root, run) {
  fs.writeFileSync(path.join(runDirOf(root), "run.json"), stableJson(run));
}

// ---------------------------------------------------------------------------
// Tests of the write phase (design REQ-002 §9): fixture states, running the CLI with
// failures injected, the checks A1-A6 and K1-K4 of §9.3, the temporary names of §5.5.
// ---------------------------------------------------------------------------

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(TEST_DIR, "..", "src", "cli.js");
const FAULT_MODULE_URL = pathToFileURL(
  path.join(TEST_DIR, "fault-inject.js"),
).href;
const REAL_ROOT = path.resolve(TEST_DIR, "..", "..");
// A hung command (the code before the fix on a pipe, W51) is killed and fails the row
// instead of freezing the suite (design §9.2).
const CLI_TIMEOUT_MS = 10_000;

export const RUN_REL = `runs/${RUN_ID}`;
export const STATE_REL = "STATE.md";
export const PROPOSED_REL = `${RUN_REL}/proposed-actions.json`;
export const REPORT_REL = `${RUN_REL}/apply-report.json`;

// `.<name>.sai-tmp` and `.<name>.sai-old` beside a path (design §5.5); the path may be
// absolute or relative to the root.
export function tempOf(abs) {
  return path.join(path.dirname(abs), `.${path.basename(abs)}.sai-tmp`);
}

export function oldOf(abs) {
  return path.join(path.dirname(abs), `.${path.basename(abs)}.sai-old`);
}

// SAFETY: apply-verdict overwrites STATE.md. These tests run a pipeline command only on
// a fixture made by makeProject() in the temporary folder, never on the real project,
// its runs/ or its STATE.md. Every command runner below checks it first.
export function assertFixtureRoot(root) {
  const abs = path.resolve(root);
  assert.ok(
    path.dirname(abs) === path.resolve(os.tmpdir()) &&
      path.basename(abs).startsWith("sai-wf06-") &&
      abs !== REAL_ROOT,
    `refusing to run a pipeline command on ${abs}: not a fixture of makeProject()`,
  );
  return abs;
}

// ---- things a row puts in the way; each returns the function that takes it away -------

export function makeOutside() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sai-outside-"));
}

// Sets the permission bits of `abs`; the returned function puts back the ones it had.
// Relies on permissions being enforced, i.e. on a user that is not root (as the existing
// tests with chmod do).
export function lock(abs, mode) {
  assert.notEqual(
    process.getuid?.(),
    0,
    "this row needs a user that is not root",
  );
  const had = fs.statSync(abs).mode & 0o7777;
  fs.chmodSync(abs, mode);
  return () => fs.chmodSync(abs, had);
}

// Removes what a run is expected to leave behind (a file, or a folder with everything in it).
export function removeAfter(...paths) {
  return () => {
    for (const p of paths) fs.rmSync(p, { recursive: true, force: true });
  };
}

// One function that runs the given ones, last first, even if one of them fails.
export function undoAll(...undos) {
  return () => {
    let failure;
    for (const undo of [...undos].reverse()) {
      try {
        undo?.();
      } catch (err) {
        failure ??= err;
      }
    }
    if (failure) throw failure;
  };
}

// There is no call in Node that makes a pipe, so `mkfifo` does (design §9.2).
export function makeFifo(abs) {
  execFileSync("mkfifo", [abs], { timeout: CLI_TIMEOUT_MS });
  assert.ok(fs.lstatSync(abs).isFIFO());
  return () => fs.unlinkSync(abs);
}

// A child `node` started in the folder of the file listens on the relative name and ends;
// the socket file stays. The absolute path would be too long for a socket on macOS
// (104 bytes), and process.chdir in this process is not used (design §9.2).
export function makeSocket(abs) {
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      "require('node:net').createServer().listen(process.argv[1], () => process.exit(0))",
      path.basename(abs),
    ],
    { cwd: path.dirname(abs), encoding: "utf8", timeout: CLI_TIMEOUT_MS },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.ok(fs.lstatSync(abs).isSocket());
  return () => fs.unlinkSync(abs);
}

// The permission bits a new file or folder gets from the OS (default mode and umask), as
// four octal digits: the test makes one itself in `dir` and removes it again.
export function newFileMode(dir) {
  const probe = path.join(dir, `.mode-probe-${process.pid}`);
  fs.writeFileSync(probe, "x");
  try {
    return modeText(fs.lstatSync(probe, { bigint: true }));
  } finally {
    fs.rmSync(probe);
  }
}

export function newDirMode(dir) {
  const probe = path.join(dir, `.mode-probe-${process.pid}`);
  fs.mkdirSync(probe);
  try {
    return modeText(fs.lstatSync(probe, { bigint: true }));
  } finally {
    fs.rmdirSync(probe);
  }
}

// The first floor(n/2) characters of a text, n counted in characters: what the `partial`
// effect of fault-inject.js writes (design §9.2).
export function firstHalf(text) {
  return text.slice(0, Math.floor(text.length / 2));
}

// ---- running the CLI as a separate process, with failures injected ---------------------

// The lines of stderr, without the final line break.
export function stderrLines(r) {
  if (r.stderr === "") return [];
  const lines = r.stderr.split("\n");
  assert.equal(lines.pop(), "", "stderr must end with a line break");
  return lines;
}

export function describeRun(r) {
  return JSON.stringify({
    status: r.status,
    signal: r.signal,
    error: r.error?.code,
    stdout: r.stdout,
    stderr: r.stderr,
  });
}

function runCli(root, args, { faults = [], ulimitF } = {}) {
  assertFixtureRoot(root);
  const node = [];
  if (faults.length > 0) node.push("--import", FAULT_MODULE_URL);
  node.push(CLI_PATH, ...args);
  const env = { ...process.env };
  delete env.SAI_TEST_FAULTS;
  if (faults.length > 0) env.SAI_TEST_FAULTS = JSON.stringify(faults);
  // `ulimit -f 1` makes the OS refuse a write beyond one block with a real EFBIG (W34).
  const [command, argv] =
    ulimitF === undefined
      ? [process.execPath, node]
      : [
          "/bin/sh",
          [
            "-c",
            `ulimit -f ${ulimitF} && exec "$@"`,
            "sh",
            process.execPath,
            ...node,
          ],
        ];
  const r = spawnSync(command, argv, {
    encoding: "utf8",
    timeout: CLI_TIMEOUT_MS,
    env,
  });
  return {
    status: r.status,
    signal: r.signal,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    error: r.error,
  };
}

export function runApplyCli(root, runDir, options) {
  return runCli(root, ["apply-verdict", runDir, "--root", root], options);
}

// prepare-run with the arguments of prepareOptions(), `--created-at` included, so that a
// second run produces the same bytes (design §4.1, §9.5).
export function runPrepareCli(root, options) {
  const o = prepareOptions();
  const args = [
    "prepare-run",
    o.runId,
    "--candidates",
    o.candidates.join(","),
    "--context",
    o.context.join(","),
    ...LENSES.flatMap((lens) => ["--analyst", `${lens}=${o.analysts[lens]}`]),
    "--judge",
    o.judge,
    "--executor",
    o.executor,
    "--created-at",
    o.createdAt,
    "--root",
    root,
  ];
  return runCli(root, args, options);
}

// ---- injected failures (fault-inject.js; design §9.2) ----------------------------------

// "The new bytes of the target are written": the temporary file of the fixed code, and the
// target itself in the code before the fix.
export function writeNewFault(abs, effect, code) {
  return { fn: "writeFileSync", paths: [abs, tempOf(abs)], effect, code };
}

// "The target is committed": the rename of the fixed code, and the write of the code
// before the fix, which is what makes its new bytes visible. Exactly one of them fires.
export function commitFaults(abs, effect, code) {
  return [
    { fn: "renameSync", from: tempOf(abs), to: abs, effect, code },
    { fn: "writeFileSync", paths: [abs], effect, code },
  ];
}

// ---- the lines the command prints --------------------------------------------------------

export function writeLine(file, text) {
  return `E_WRITE ${file}: ${text}`;
}

const LEFTOVER_TAIL =
  "from an interrupted or concurrent run (EEXIST); nothing was changed; if no other command is running, delete and re-run";

export function leftoverLine(file, ...found) {
  return `E_WRITE ${file}: leftover ${found.join(", ")} ${LEFTOVER_TAIL}`;
}

// ---- fixture states of apply-verdict (design §9.2) --------------------------------------

const BIG_PARAGRAPH = `\n${"Строка длинной заметки для проверки предела размера файла. ".repeat(40)}\n`;
const THE_PAST = 946684800; // 2000-01-01T00:00:00Z

// Every file of the fixture gets an old modification time, so that "this file was not
// touched" and "this is the same file" are visible in the listing whatever the clock
// resolution of the file system is.
function backdate(root) {
  for (const [p, entry] of listing(root)) {
    if (entry.type === "f")
      fs.utimesSync(path.join(root, p), THE_PAST, THE_PAST);
  }
}

function fixtureOf(root) {
  return {
    root,
    runDir: runDirOf(root),
    state: path.join(root, STATE_REL),
    proposed: path.join(root, PROPOSED_REL),
    report: path.join(root, REPORT_REL),
  };
}

// RF: recommend, first application: no block in STATE.md, no proposed-actions.json, no
// apply-report.json. `bigState` appends a paragraph to STATE.md (W34).
export function stateRF({ bigState = false } = {}) {
  const { root } = validRun((_arts, projectRoot) => {
    if (bigState) {
      fs.appendFileSync(path.join(projectRoot, STATE_REL), BIG_PARAGRAPH);
    }
  });
  backdate(root);
  return fixtureOf(root);
}

// RR: recommend, repeated: after a clean application one stale line is inserted after
// the heading of the block in STATE.md and one "\n" is appended to proposed-actions.json
// and apply-report.json. The targets named in `stale` all have to be replaced.
export function stateRR({
  stale = ["state", "proposed", "report"],
  bigState = false,
} = {}) {
  const fx = stateRF({ bigState });
  const applied = applyVerdict(fx.root, fx.runDir);
  assert.deepEqual(applied.issues.list, []);
  if (stale.includes("state")) {
    const text = fs.readFileSync(fx.state, "utf8");
    assert.ok(text.includes(`${BLOCK_HEADING}\n`));
    fs.writeFileSync(
      fx.state,
      text.replace(
        `${BLOCK_HEADING}\n`,
        `${BLOCK_HEADING}\nУстаревшая строка.\n`,
      ),
    );
  }
  if (stale.includes("proposed")) fs.appendFileSync(fx.proposed, "\n");
  if (stale.includes("report")) fs.appendFileSync(fx.report, "\n");
  backdate(fx.root);
  return fx;
}

// EF: escalate, first application: three REJECT, no block, no apply-report.json;
// proposed-actions.json never appears.
export function stateEF() {
  const { root } = validRun((arts) => {
    for (const n of [1, 2, 3]) {
      arts[`verdict-${n}.json`] = verdict(n);
      arts[`verdict-${n}.md`] = arts["verdict-1.md"];
      arts[`verdict-review-${n}.json`] = review(n, "REJECT");
    }
  });
  backdate(root);
  return fixtureOf(root);
}

const cleanCache = new Map();

// The bytes of the targets after an application without any obstacle on a fresh fixture
// of the same state (RR has the same as RF), computed once per test file by calling
// applyVerdict in this process (design §9.2). `files` maps the path from the root to the
// text; `absent` lists the targets that must not exist (proposed-actions.json at EF).
export function cleanTargets(kind, options = {}) {
  const key = `${kind}:${JSON.stringify(options)}`;
  if (!cleanCache.has(key)) {
    const fx = kind === "EF" ? stateEF() : stateRF(options);
    const applied = applyVerdict(fx.root, fx.runDir);
    assert.deepEqual(applied.issues.list, []);
    const files = {
      [STATE_REL]: fs.readFileSync(fx.state, "utf8"),
      [REPORT_REL]: fs.readFileSync(fx.report, "utf8"),
    };
    if (kind !== "EF")
      files[PROPOSED_REL] = fs.readFileSync(fx.proposed, "utf8");
    cleanCache.set(key, {
      files,
      absent: kind === "EF" ? [PROPOSED_REL] : [],
    });
  }
  return cleanCache.get(key);
}

// The text of each target, or undefined where it does not exist. Only for states where the
// targets are regular files (reading a pipe would hang).
export function readTargets(fx) {
  const read = (abs) =>
    fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : undefined;
  return {
    state: read(fx.state),
    proposed: read(fx.proposed),
    report: read(fx.report),
  };
}

// K2: each target holds exactly the bytes named for it. `expected` maps state, proposed,
// report to [label, text].
export function assertTargetBytes(fx, expected) {
  const got = readTargets(fx);
  for (const [name, [label, text]] of Object.entries(expected)) {
    assert.equal(
      got[name],
      text,
      `${name} must hold exactly its ${label} bytes`,
    );
  }
}

// ---- the checks of §9.3 -----------------------------------------------------------------

// Runs every check even when an earlier one failed, and fails at the end naming all that
// failed: the row of the code before the fix lists which of A1-A6 it breaks (§9.4, §9.5).
export function checks() {
  const failed = [];
  return {
    run(label, fn) {
      try {
        fn();
      } catch (err) {
        failed.push({ label, text: `${err.name}: ${err.message}` });
      }
    },
    done() {
      if (failed.length === 0) return;
      const names = [...new Set(failed.map((f) => f.label.split(" ")[0]))].join(
        ", ",
      );
      assert.fail(
        `failed checks: ${names}\n${failed.map((f) => `--- ${f.label}\n${f.text}`).join("\n")}`,
      );
    },
  };
}

// A command that is refused or fails (checks A1-A6): `setup` puts the obstacle in the way
// and returns the function that takes it away; `run` runs the command; `lines` are the
// exact lines of stderr, or `crash` says the command died of a program error and has
// to show the exception with its trace. `delta(before)` replaces A5 ("equal") by
// "equal except for the entries it names" (design §9.4, rows with "A5 заменяется").
// `converge` is A6, run after the obstacle and the named leftovers are gone. `list` takes
// the strict listing (listingInChild for a row with a pipe in the root).
export function refusal({
  root,
  extra = [],
  setup,
  run,
  code = 1,
  lines,
  crash = false,
  delta,
  converge,
  list = listing,
}) {
  const c = checks();
  let undo;
  try {
    undo = setup?.();
    const before = list(root, ...extra);
    const r = run();
    c.run("A1 exit code", () => assert.equal(r.status, code, describeRun(r)));
    c.run("A2 stdout is empty", () =>
      assert.equal(r.stdout, "", "stdout must be empty"),
    );
    if (crash) {
      c.run("A3 a program error, not E_WRITE", () => {
        assert.match(r.stderr, /TypeError: injected bug/);
        assert.doesNotMatch(r.stderr, /^E_WRITE /m);
      });
      c.run("A4 the stack trace is kept", () =>
        assert.match(r.stderr, /^\s+at /m),
      );
    } else {
      c.run("A3 stderr lines", () => assert.deepEqual(stderrLines(r), lines));
      c.run("A4 no stack trace", () =>
        assert.doesNotMatch(r.stderr, /^\s+at /m, "stderr has a stack trace"),
      );
    }
    c.run("A5 strict listing", () => {
      const after = list(root, ...extra);
      if (delta) assertListingChange(before, after, delta(before));
      else assertSameListing(before, after);
    });
  } finally {
    undo?.();
  }
  c.run("A6 convergence", converge);
  c.done();
}

// A control row: the command succeeds. `delta(before)` names how the strict listing
// changes; `verify(c, r)` adds checks on the result `r` and the bytes of the targets.
export function success({
  root,
  extra = [],
  setup,
  run,
  stdout,
  delta,
  verify,
}) {
  const c = checks();
  let undo;
  try {
    undo = setup?.();
    const before = listing(root, ...extra);
    const r = run();
    c.run("A1 exit code", () => assert.equal(r.status, 0, describeRun(r)));
    c.run("A2 stdout", () => {
      if (typeof stdout === "string") assert.equal(r.stdout, stdout);
      else assert.match(r.stdout, stdout);
    });
    c.run("A3 stderr is empty", () => assert.equal(r.stderr, ""));
    const after = listing(root, ...extra);
    c.run("A5 strict listing", () =>
      assertListingChange(before, after, delta(before)),
    );
    c.run("A5 no .sai- entry is left", () =>
      assert.deepEqual(leftoversIn(after), []),
    );
    verify?.(c, r);
  } finally {
    undo?.();
  }
  c.done();
}

// A command killed by SIGKILL (design §9.3, K1-K4): `run` is the run with the kill
// fault, `k2` checks the bytes, `rerun` is the same command without a fault and has to
// refuse naming `lines` and change nothing, `remove` are the leftovers it names, and
// `converge` is A6 after they are gone.
export function interrupted({
  root,
  extra = [],
  run,
  k2,
  rerun,
  lines,
  remove,
  converge,
}) {
  const c = checks();
  const r = run();
  c.run("K1 killed by SIGKILL", () => {
    assert.equal(r.signal, "SIGKILL", describeRun(r));
    assert.equal(r.status, null, describeRun(r));
  });
  c.run("K2 the bytes of the targets", k2);
  const before = listing(root, ...extra);
  const again = rerun();
  c.run("K3 exit code", () =>
    assert.equal(again.status, 1, describeRun(again)),
  );
  c.run("K3 stdout is empty", () => assert.equal(again.stdout, ""));
  c.run("K3 stderr lines", () => assert.deepEqual(stderrLines(again), lines));
  c.run("K3 no stack trace", () =>
    assert.doesNotMatch(again.stderr, /^\s+at /m, "stderr has a stack trace"),
  );
  c.run("K3 strict listing", () =>
    assertSameListing(before, listing(root, ...extra)),
  );
  removeAfter(...remove)();
  c.run("K4 convergence", converge);
  c.done();
}

// A6 for apply-verdict: after the cause is removed, the same call in this process, with
// no failure injected, replaces something (or nothing, if `alreadyNew`), a second one
// changes nothing, the targets hold the clean bytes and nothing of the write phase is
// left.
export function assertApplyConverges(fx, clean, { alreadyNew = false } = {}) {
  assertFixtureRoot(fx.root);
  const first = applyVerdict(fx.root, fx.runDir);
  assert.deepEqual(first.issues.list, [], "the re-run must succeed");
  if (alreadyNew) {
    assert.equal(first.changed, 0, "there is nothing left to replace");
  } else {
    assert.ok(
      first.changed > 0,
      `the re-run must replace something: ${first.changed}`,
    );
  }
  const second = applyVerdict(fx.root, fx.runDir);
  assert.deepEqual(second.issues.list, []);
  assert.equal(second.changed, 0, "the second re-run must change nothing");
  for (const [rel, text] of Object.entries(clean.files)) {
    assert.equal(
      fs.readFileSync(path.join(fx.root, rel), "utf8"),
      text,
      `${rel} must hold the clean bytes`,
    );
  }
  for (const rel of clean.absent) {
    assert.equal(
      fs.existsSync(path.join(fx.root, rel)),
      false,
      `${rel} must not exist`,
    );
  }
  assert.deepEqual(leftoversIn(listing(fx.root)), []);
}

// ---- prepare-run ---------------------------------------------------------------------

// Every file under `dir` as an object from the path inside `dir` to the text.
export function readFolder(dir, prefix = "", out = {}) {
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    const rel = prefix === "" ? name : `${prefix}/${name}`;
    if (fs.lstatSync(abs).isDirectory()) readFolder(abs, rel, out);
    else out[rel] = fs.readFileSync(abs, "utf8");
  }
  return out;
}

let cleanPrepared;

// The files of the run folder after a prepare-run without any obstacle, computed once per
// test file by calling prepareRun in this process.
export function cleanPrepare() {
  if (cleanPrepared === undefined) {
    const root = makeProject();
    const result = prepareRun(root, prepareOptions());
    assert.deepEqual(result.issues.list, []);
    cleanPrepared = readFolder(runDirOf(root));
  }
  return cleanPrepared;
}

// A6 for prepare-run: the same call in this process, with the same `--created-at`, succeeds,
// the files of the run folder are the clean ones and nothing of the write phase is left.
export function assertPrepareConverges(root) {
  assertFixtureRoot(root);
  const result = prepareRun(root, prepareOptions());
  assert.deepEqual(result.issues.list, [], "the re-run must succeed");
  assert.deepEqual(readFolder(runDirOf(root)), cleanPrepare());
  assert.deepEqual(leftoversIn(listing(root)), []);
}

// ---- counting fs calls in this process (W53, P18; design §9.2) ---------------------------

// Wraps the given fs methods so that each call is appended to `events` in order, with the
// path it concerns (for fsyncSync: the path the descriptor was opened with), and goes on
// to the real method. Call `restore()` in a `finally`.
export function recordFs(names) {
  const events = [];
  const opened = new Map();
  for (const name of names) {
    const real = fs[name];
    mock.method(fs, name, (...args) => {
      if (name === "fsyncSync") {
        events.push({ fn: name, path: opened.get(args[0]) });
      } else if (name !== "openSync") {
        events.push({ fn: name, path: String(args[0]), to: String(args[1]) });
      }
      const result = real.apply(fs, args);
      if (name === "openSync") opened.set(result, String(args[0]));
      return result;
    });
  }
  return { events, restore: () => mock.restoreAll() };
}
