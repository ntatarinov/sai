// Helpers of the tests of `npm run handoffs-check` (design REQ-038, 12). Not a test file.
// Every case gets its own temporary git repository (sandbox of the traces helpers: HOME
// and the git configuration inside the temporary folder), and commits get the times
// that the case names, so no test depends on the clock of the machine unless it says so.
// The paths of home folders are put together from parts, so that this file is not a
// trace itself.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { checkHandoffs, formatReport } from "../src/handoffs/check.js";
import {
  HASHES_HEADER,
  HASHES_REL,
  SAI,
  TOOLS,
  git,
  sandbox,
} from "./fixtures/traces/helpers.js";

export { SAI, TOOLS };
export const CLI = path.join(TOOLS, "src", "handoffs", "cli.js");
export const BASE_FILE = "tools/handoffs/exceptions.tsv";
export const DECISION_FILE = "decisions/0036-handoffs-check-base.md";

// "/Users/", "/home/" from parts.
export const MAC = "/Us" + "ers/";

// A fixed instant after every time of the fixtures: the "clock" of the in-process checks.
export const NOW = Date.UTC(2030, 0, 1) / 1000;

export const RUN = "R-1";
export const REL = `handoffs/${RUN}/step-01-a.json`;

// "2025-03-01T05:30:00Z" of "05:30:00".
export const T = (hms) => `2025-03-01T${hms}Z`;

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export const EMPTY_HASH = sha256("");

// The hash of a value as the file of exceptions has it (design 4.2).
export const hashOf = (value) => sha256(JSON.stringify(value));

// A valid handoff of the file `rel`; `over` replaces fields (an undefined value drops one).
export function doc(rel = REL, over = {}) {
  const parts = rel.split("/");
  return {
    handoff_id: `h-${parts.slice(1).join("-")}`,
    run_id: parts[1],
    workflow_id: "WF-02",
    step: "01",
    from_agent: "ORCH",
    to_agent: "BACKEND-DEV",
    file: rel,
    status: "COMPLETED",
    context: { requirement_ids: ["REQ-900"] },
    task: { description: "fixture" },
    created_at: T("05:00:00"),
    started_at: T("05:10:00"),
    completed_at: T("05:30:00"),
    result: { status: "COMPLETED", summary: "ok" },
    ...over,
  };
}

export const text = (d) => `${JSON.stringify(d, null, 2)}\n`;

// The first line (from 1) that contains `needle`.
export function lineOf(content, needle) {
  const at = content.split("\n").findIndex((l) => l.includes(needle));
  assert.ok(at >= 0, `no line with ${needle}`);
  return at + 1;
}

// A hash of every file and folder of a folder, `.git` included: equal before and after a
// run that must not write.
export function treeHash(dir) {
  const lines = [];
  const walk = (abs, rel) => {
    for (const name of fs.readdirSync(abs).sort()) {
      const p = path.join(abs, name);
      const r = rel === "" ? name : `${rel}/${name}`;
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) lines.push(`l ${r} ${fs.readlinkSync(p)}`);
      else if (st.isDirectory()) {
        lines.push(`d ${r}`);
        walk(p, r);
      } else lines.push(`f ${r} ${sha256(fs.readFileSync(p))}`);
    }
  };
  walk(dir, "");
  return sha256(lines.join("\n"));
}

// The violation lines of an output (everything before the `handoffs-check:` lines).
export function violationLines(stdout) {
  return stdout
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("handoffs-check:"));
}

export function summaryOf(stdout) {
  const lines = stdout.split("\n").filter((l) => l !== "");
  return lines[lines.length - 1];
}

export function assertNoStack(stderr) {
  assert.doesNotMatch(stderr, /\n\s+at /u, stderr);
  assert.doesNotMatch(stderr, /node:internal|Error:/u, stderr);
}

// A temporary repository of Sai: a first commit (the base) with an ordinary file and the
// file of hashes of traces; unless `seal: false`, the base is pinned at once.
export function newSai(t, { seal = true } = {}) {
  const sb = sandbox(t);
  const root = path.join(sb.dir, "repo");
  fs.mkdirSync(root);
  const sai = {
    root,
    dir: sb.dir,
    env: sb.env,
    write(rel, content) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      return abs;
    },
    writeDoc(rel, d) {
      return sai.write(rel, text(d));
    },
    read(rel) {
      return fs.readFileSync(path.join(root, rel));
    },
    git(...args) {
      return git(root, sb.env, ...args);
    },
    // Commits everything with the given committer time (and author time).
    commit(committer, { author = committer, message = "c" } = {}) {
      const env = {
        ...sb.env,
        GIT_COMMITTER_DATE: committer,
        GIT_AUTHOR_DATE: author,
      };
      git(root, env, "add", "-A");
      git(root, env, "commit", "-q", "--allow-empty", "-m", message);
      return sai.head();
    },
    head() {
      return sai.git("rev-parse", "HEAD").trim();
    },
    // Pins the base at `commit` (default: HEAD) with the given lines of records.
    seal(rows = [], commit = sai.head()) {
      sai.write(
        DECISION_FILE,
        `# 0036 — fixture\n\nБаза handoffs-check: ${commit}\n`,
      );
      sai.write(
        BASE_FILE,
        `# fixture\n# база: ${commit}\n${rows.map((r) => `${r}\n`).join("")}`,
      );
      return commit;
    },
    tree() {
      return treeHash(root);
    },
    // The command as a child process: `node cli.js <args> --root <root>`.
    run(args = [], { env, root: rootArg = root, cwd } = {}) {
      return runCli(args, { root: rootArg, env: { ...sb.env, ...env }, cwd });
    },
    // The same, and the whole tree must be as it was.
    runUnchanged(args = [], opts = {}) {
      const before = sai.tree();
      const r = sai.run(args, opts);
      assert.equal(sai.tree(), before, "the command changed the tree");
      return r;
    },
    // In-process check with the clock `nowSec`: { report, lines }.
    check(nowSec = NOW) {
      const report = checkHandoffs({ root, nowSec });
      return { report, lines: formatReport(report) };
    },
  };
  sai.write("README.md", "fixture\n");
  sai.write(HASHES_REL, `${HASHES_HEADER}\n`);
  sai.git("init", "-q");
  sai.commit("2025-01-01T00:00:00Z", { message: "base" });
  if (seal) sai.seal();
  return sai;
}

export function runCli(args, { root, env, cwd, input } = {}) {
  const full = root === undefined ? args : [...args, "--root", root];
  const r = spawnSync(process.execPath, [CLI, ...full], {
    cwd: cwd ?? TOOLS,
    env,
    input: input ?? "",
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

export function describe(r) {
  return `status ${r.status}\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}`;
}

// The expectation of a stop: code 2, nothing on stdout, one stderr line with the code.
export function assertStop(r, code, textPart) {
  assert.equal(r.status, 2, describe(r));
  assert.equal(r.stdout, "", describe(r));
  const lines = r.stderr.split("\n").filter((l) => l !== "");
  assert.equal(lines.length, 1, describe(r));
  assert.ok(
    lines[0].startsWith(`handoffs-check: ${code}: `),
    `stderr: ${r.stderr}`,
  );
  if (textPart !== undefined)
    assert.ok(lines[0].includes(textPart), `stderr: ${r.stderr}`);
  assertNoStack(r.stderr);
}

// ---- helpers of the tests of `npm run handoff` (design REQ-039, 10) -------------------
// The command is started as a child process with the working folder of a temporary
// repository (it has no key --root), the project's `.claude/agents/` is copied into the
// repository, and the clock is the real one: a test reads it before and after.

export const HANDOFF = path.join(TOOLS, "src", "handoffs", "handoff.js");
export const FAULT_MODULE = path.join(TOOLS, "test", "fault-inject.js");
export const AGENTS_DIR = path.join(SAI, ".claude", "agents");
export const FAKE_RUN = "PROD-20991231-01";
export const FAKE_REL = `handoffs/${FAKE_RUN}/step-05b-test-design-validator-req999-r1.json`;
export const FAKE_ID = `step05b-req999-r1-${FAKE_RUN}`;

// The call of the requirement, word for word (invented data).
export const CANON = {
  run: FAKE_RUN,
  step: "05b",
  role: "TEST-DESIGN-VALIDATOR",
  workflow: "WF-02",
  task: "Проверить тесты REQ-999",
  qualifier: "req999",
  suffix: "r1",
};

// `{ run: "X", criterion: ["a", "b"] }` -> ["new", "--run", "X", "--criterion", "a", ...].
// An undefined value drops the key; an array repeats it.
export function newArgs(opts = {}) {
  const out = ["new"];
  for (const [key, value] of Object.entries(opts)) {
    if (value === undefined) continue;
    for (const item of [].concat(value)) out.push(`--${key}`, item);
  }
  return out;
}

export const canonArgs = (over = {}) => newArgs({ ...CANON, ...over });

// The run of the command in `cwd`: { status, stdout, stderr }. `faults` is a list for
// fault-inject.js (the --import mode); `env` replaces the environment of the process.
export function runHandoff(args, { cwd, env, faults } = {}) {
  const pre = [];
  const full = { ...env };
  if (faults !== undefined) {
    pre.push("--import", FAULT_MODULE);
    full.SAI_TEST_FAULTS = JSON.stringify(faults);
  }
  const r = spawnSync(process.execPath, [...pre, HANDOFF, ...args], {
    cwd,
    env: full,
    input: "",
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// A temporary repository of Sai with the roles of the project in `.claude/agents/`,
// everything committed (a clean tree). `sai.cmd(args, { faults, env })` runs the command
// in it; `sai.tag(name)` puts a light tag (`annotated: true` - an annotated one).
export function newCmdRepo(t) {
  const sai = newSai(t);
  fs.cpSync(AGENTS_DIR, path.join(sai.root, ".claude", "agents"), {
    recursive: true,
  });
  sai.commit("2025-01-02T00:00:00Z", { message: "agents" });
  sai.cmd = (args, { faults, env } = {}) =>
    runHandoff(args, {
      cwd: sai.root,
      env: { ...sai.env, ...env },
      faults,
    });
  sai.tag = (name, { annotated = false } = {}) => {
    if (annotated) sai.git("tag", "-a", "-m", "base", name);
    else sai.git("tag", name);
  };
  sai.status = () => sai.git("status", "--porcelain");
  sai.json = (rel) => JSON.parse(sai.read(rel).toString("utf8"));
  return sai;
}

// The tag of the base of a run.
export const baseTag = (run) => `base/${run}`;

// The refusal of a run of the command: code, empty stdout (unless `stdout` is true),
// exactly one stderr line `handoff: <CODE>: ...` without a stack.
export function assertRefusal(r, exit, code, { stdout = false } = {}) {
  assert.equal(r.status, exit, describe(r));
  if (!stdout) assert.equal(r.stdout, "", describe(r));
  const lines = r.stderr.split("\n").filter((l) => l !== "");
  assert.equal(lines.length, 1, describe(r));
  assert.ok(lines[0].startsWith(`handoff: ${code}: `), describe(r));
  assertNoStack(r.stderr);
  return lines[0];
}

// All files and empty folders of a tree below `dir`, without `.git`: sorted relative
// paths, a folder ends with "/".
export function listTree(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const name of fs.readdirSync(abs).sort()) {
      if (rel === "" && name === ".git") continue;
      const p = path.join(abs, name);
      const r = rel === "" ? name : `${rel}/${name}`;
      const st = fs.lstatSync(p);
      if (st.isDirectory() && !st.isSymbolicLink()) {
        out.push(`${r}/`);
        walk(p, r);
      } else out.push(r);
    }
  };
  walk(dir, "");
  return out;
}

// The hashes of the files of a tree below `dir` (not `.git`), { rel: sha256 }.
export function fileHashes(dir) {
  const out = {};
  for (const rel of listTree(dir)) {
    if (rel.endsWith("/")) continue;
    const abs = path.join(dir, rel);
    out[rel] = fs.lstatSync(abs).isSymbolicLink()
      ? `link ${fs.readlinkSync(abs)}`
      : sha256(fs.readFileSync(abs));
  }
  return out;
}

// The handoff that a recipient hands in: the file `rel` of `sai` read, `over` put over
// its fields and written back with two spaces. Returns the new document.
export function recipientWrites(sai, rel, over) {
  const d = { ...sai.json(rel), ...over };
  sai.write(rel, `${JSON.stringify(d, null, 2)}\n`);
  return d;
}

// The same run, started without waiting: a promise of { status, stdout, stderr }.
export function startHandoff(args, { cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [HANDOFF, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (d) => (stdout += d));
    child.stderr.setEncoding("utf8").on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}
