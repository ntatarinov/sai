// Helpers of the tests of the executors of Sai Team (design REQ-010, section 15.2).
// Not a test file.
//
// The rule of these tests: a real Claude Code is never started. Every command and
// every direct call of an executor goes through assertSafeEnv(), which throws at once
// unless SAI_TEAM_CLAUDE_BIN names the fake executable of tools/test/fixtures/team/
// (or a name missing-* that does not exist there), the data folder and HOME are
// inside the temporary folder of the operating system, and (for a relative name)
// PATH is an empty temporary folder. Nothing here may touch ~/.sai-team or
// ~/.sai-pixel-office, and nothing uses a network or a port.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readConfig } from "../src/team/config.js";
import { roleByCode } from "../src/team/roles.js";
import { WORK_ANSWER_SCHEMA } from "../src/team/executor.js";
import { createProject, openWriter, readProject } from "../src/team/store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOOLS_DIR = path.resolve(HERE, "..");
export const REPO_ROOT = path.resolve(TOOLS_DIR, "..");
export const TEAM_SRC = path.join(TOOLS_DIR, "src", "team");
export const CLI_PATH = path.join(TEAM_SRC, "cli.js");
export const FIXTURES = path.join(HERE, "fixtures", "team");
export const FAULT_PATH = path.join(HERE, "fault-inject.js");
export const FAULT_URL = pathToFileURL(FAULT_PATH).href;
export const CHILD_TIMEOUT_MS = 45_000;
// A bound for tests that await an in-process call which may hang if a protection breaks.
export const CALL_LIMIT_MS = 30_000;

// ---- the guard (AP-025) ------------------------------------------------------------

export function fakeClaudePath() {
  return path.join(FIXTURES, "fake-claude.js");
}

export function probeClaudePath() {
  return path.join(FIXTURES, "fake-claude-probe.js");
}

function realOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

// The real path of a path that may not exist yet: the real path of its nearest
// existing parent (links followed) plus the rest of the names.
function realWithMissingTail(p) {
  const tail = [];
  let cur = path.resolve(p);
  for (;;) {
    const real = realOrNull(cur);
    if (real !== null) return path.join(real, ...tail);
    const parent = path.dirname(cur);
    if (parent === cur) return path.resolve(p);
    tail.unshift(path.basename(cur));
    cur = parent;
  }
}

function insideDir(file, dir) {
  const rel = path.relative(dir, file);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isEmptyTempDir(p) {
  const real = realOrNull(p);
  if (real === null || !path.isAbsolute(p)) return false;
  if (!insideDir(real, realOrNull(os.tmpdir()))) return false;
  try {
    return fs.statSync(real).isDirectory() && fs.readdirSync(real).length === 0;
  } catch {
    return false;
  }
}

function checkFolder(name, value) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    throw new Error(`exec test: ${name} must be an absolute path`);
  }
  const resolved = path.resolve(value);
  const real = realWithMissingTail(resolved);
  const tmp = realOrNull(os.tmpdir());
  if (!insideDir(real, tmp)) {
    throw new Error(`exec test: ${name} is not inside the temporary folder`);
  }
  const home = os.homedir();
  const realHome = realOrNull(home) ?? home;
  const forbidden = [".sai-team", ".sai-pixel-office"].flatMap((n) => [
    path.join(home, n),
    path.join(realHome, n),
  ]);
  if (real === home || real === realHome) {
    throw new Error(`exec test: ${name} is the home folder of the user`);
  }
  for (const f of forbidden) {
    if (real === f || insideDir(real, f)) {
      throw new Error(`exec test: ${name} is a real data folder of the user`);
    }
  }
}

// Throws at once unless the environment may be given to a command or an executor:
// the three forms of SAI_TEAM_CLAUDE_BIN of section 15.2, the data folder and HOME
// inside the temporary folder. `fixturesDir` is replaceable only for the tests of
// this guard itself.
export function assertSafeEnv(env, fixturesDir = FIXTURES) {
  if (env === null || typeof env !== "object") {
    throw new Error("exec test: no environment");
  }
  checkFolder("SAI_TEAM_HOME", env.SAI_TEAM_HOME);
  checkFolder("HOME", env.HOME);
  const bin = env.SAI_TEAM_CLAUDE_BIN;
  if (typeof bin !== "string" || bin === "") {
    throw new Error("exec test: SAI_TEAM_CLAUDE_BIN is not set");
  }
  const fixtures = realOrNull(fixturesDir);
  if (fixtures === null) throw new Error("exec test: no fixtures folder");

  if (path.isAbsolute(bin)) {
    // Form 1: a working file inside fixtures/team.
    const real = realOrNull(bin);
    if (real !== null) {
      if (!insideDir(real, fixtures) || !fs.statSync(real).isFile()) {
        throw new Error("exec test: SAI_TEAM_CLAUDE_BIN is outside fixtures");
      }
      if (path.basename(bin).startsWith("missing-")) {
        throw new Error("exec test: a missing-* name that exists");
      }
      try {
        fs.accessSync(real, fs.constants.X_OK);
      } catch {
        throw new Error("exec test: SAI_TEAM_CLAUDE_BIN is not executable");
      }
      return;
    }
    // Form 2: "no file" for a refusal: missing-* in fixtures, lstat gives ENOENT.
    const dir = realOrNull(path.dirname(bin));
    if (dir !== fixtures || !path.basename(bin).startsWith("missing-")) {
      throw new Error("exec test: SAI_TEAM_CLAUDE_BIN is outside fixtures");
    }
    try {
      fs.lstatSync(bin);
    } catch (err) {
      if (err.code === "ENOENT") return;
      throw err;
    }
    throw new Error("exec test: a missing-* name that exists");
  }
  // Form 3: a relative name for the refusal E_CONFIG, PATH is an empty temp folder.
  if (bin.includes("/") || !bin.startsWith("missing-")) {
    throw new Error("exec test: a relative SAI_TEAM_CLAUDE_BIN is not allowed");
  }
  if (!isEmptyTempDir(env.PATH)) {
    throw new Error("exec test: a relative name needs an empty PATH folder");
  }
}

// ---- sandbox and environment -------------------------------------------------------

// { root, home (SAI_TEAM_HOME), user (HOME of the commands), emptyPath }
export function makeSandbox(t) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "sai-exec-test-")),
  );
  t.after(() => {
    // Whatever a hung test left running is stopped before its folder goes.
    reapFakes(path.join(root, "user"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const sb = {
    root,
    home: path.join(root, "team"),
    user: path.join(root, "user"),
    emptyPath: path.join(root, "empty-path"),
  };
  fs.mkdirSync(sb.home, { mode: 0o700 });
  fs.mkdirSync(sb.user, { mode: 0o700 });
  fs.mkdirSync(sb.emptyPath, { mode: 0o700 });
  return sb;
}

// The environment of a command: temporary data folder and HOME, the fake file,
// real runs on, short timeout and pause. `over` replaces; undefined removes.
export function execEnv(sb, over = {}) {
  const env = {
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
    HOME: sb.user,
    SAI_TEAM_HOME: sb.home,
    SAI_TEAM_CLAUDE_BIN: fakeClaudePath(),
    SAI_TEAM_REAL_RUNS: "1",
    SAI_TEAM_TASK_TIMEOUT_MS: "20000",
    SAI_TEAM_RETRY_DELAY_MS: "0",
  };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return env;
}

// ---- running commands --------------------------------------------------------------

function nodeArguments(argv, nodeArgs) {
  if (nodeArgs.length === 0) return [CLI_PATH, ...argv];
  if (nodeArgs.length !== 2 || nodeArgs[0] !== "--import") {
    throw new Error("exec test: only --import <file in fixtures/test> allowed");
  }
  const real = realOrNull(nodeArgs[1]);
  const allowed = [realOrNull(FIXTURES), realOrNull(FAULT_PATH)];
  if (real === null || !(insideDir(real, allowed[0]) || real === allowed[1])) {
    throw new Error("exec test: --import of a foreign file");
  }
  return [...nodeArgs, CLI_PATH, ...argv];
}

// A command as a child process. Always after assertSafeEnv().
export function runTeam(argv, env, nodeArgs = []) {
  assertSafeEnv(env);
  // Output goes to files, not pipes: a descendant that keeps a pipe open after
  // the command is killed would otherwise keep spawnSync waiting forever. The files
  // are next to HOME, inside the temporary folder of the test, which goes with it.
  const dir = fs.mkdtempSync(path.join(path.dirname(env.HOME), ".out-"));
  const outFd = fs.openSync(path.join(dir, "out"), "w");
  const errFd = fs.openSync(path.join(dir, "err"), "w");
  let r;
  try {
    r = spawnSync(process.execPath, nodeArguments(argv, nodeArgs), {
      stdio: ["ignore", outFd, errFd],
      timeout: CHILD_TIMEOUT_MS,
      killSignal: "SIGKILL",
      env,
      cwd: TOOLS_DIR,
    });
  } finally {
    fs.closeSync(outFd);
    fs.closeSync(errFd);
  }
  const read = (name) => fs.readFileSync(path.join(dir, name), "utf8");
  const out = { stdout: read("out"), stderr: read("err") };
  fs.rmSync(dir, { recursive: true, force: true });
  // A command that did not finish: whatever it started must not stay.
  if (r.error) reapFakes(env.HOME);
  return {
    status: r.status,
    signal: r.signal,
    stdout: out.stdout,
    stderr: out.stderr,
    error: r.error,
  };
}

// Kills every fake-claude process (and its child) recorded in a user folder.
export function reapFakes(userHome) {
  let lines;
  try {
    lines = readLines(path.join(userHome, "fake-claude", "log.jsonl"));
  } catch {
    return;
  }
  for (const e of lines) {
    if (!e || !Number.isInteger(e.pid) || !pidAlive(e.pid)) continue;
    // Only a process that still is the fake file or its child (a pid may be reused).
    let cmd;
    try {
      cmd = execFileSync("ps", ["-o", "command=", "-p", String(e.pid)], {
        encoding: "utf8",
      });
    } catch {
      continue;
    }
    if (/fake-claude|setInterval\(\(\) => \{\}, 1000\)/u.test(cmd)) {
      killQuietly(e.pid);
    }
  }
}

// Awaits a promise of an in-process call but fails the test by assertion, not by
// hanging, when it does not settle in time (a broken timeout or kill).
export async function withLimit(promise, ms = CALL_LIMIT_MS) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new assert.AssertionError({
            message: `no result within ${ms} ms (hang)`,
          }),
        ),
      ms,
    );
  });
  try {
    return await Promise.race([promise, limit]);
  } finally {
    clearTimeout(timer);
  }
}

// The forms 2 and 3 of the guard: a refusal that must not start any executable;
// the log of the fake file must not exist afterwards.
export function runTeamExpectRefusal(argv, env) {
  assertSafeEnv(env);
  const r = runTeam(argv, env);
  assert.equal(
    fs.existsSync(path.join(env.HOME, "fake-claude", "log.jsonl")),
    false,
    "a refusal must not start the fake file",
  );
  return r;
}

// Same as runTeam but asynchronous; the child is returned for a signal.
export function spawnTeam(argv, env) {
  assertSafeEnv(env);
  const child = spawn(process.execPath, nodeArguments(argv, []), {
    env,
    cwd: TOOLS_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => {
    stdout += c;
  });
  child.stderr.on("data", (c) => {
    stderr += c;
  });
  const done = new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reapFakes(env.HOME);
    }, CHILD_TIMEOUT_MS);
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stdout, stderr });
    });
  });
  return { child, done };
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

// ---- the fake file: plan and log ---------------------------------------------------

export function writePlan(sb, plan, file = "plan.json") {
  const dir = path.join(sb.user, "fake-claude");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(plan));
}

// A plan written as text (for values JSON.stringify cannot make, such as 1e999).
export function writeRawPlan(sb, text, file = "plan.json") {
  const dir = path.join(sb.user, "fake-claude");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, file), text);
}

function readLines(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return text
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => JSON.parse(l));
}

export function fakeLog(sb, file = "log.jsonl") {
  return readLines(path.join(sb.user, "fake-claude", file));
}

export function fakeStarts(sb) {
  return fakeLog(sb).filter((e) => e.event === "start");
}

export function fakeEnds(sb) {
  return fakeLog(sb).filter((e) => e.event === "end");
}

export function fakeChildren(sb) {
  return fakeLog(sb).filter((e) => e.event === "child");
}

export function fakeStdin(sb, n) {
  return fs.readFileSync(path.join(sb.user, "fake-claude", `stdin-${n}.bin`));
}

export function argAfter(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

// ---- projects and journals ---------------------------------------------------------

// A project made through the API of the core (the clock is the real one): { id, task,
// dir, events, files, work }. `role` makes the task t-0001; `executor`,
// `budget_usd`, `scenario_bytes` as in createProject.
export function makeProject(sb, over = {}) {
  const { role = "researcher", tasks = 1, text = null, ...input } = over;
  const made = createProject(
    {
      goal: "Сравнить цены трёх вымышленных поставщиков",
      budget_usd: 1,
      executor: "claude-cli",
      ...input,
    },
    { home: sb.home },
  );
  const id = made.id;
  const writer = openWriter(id, { home: sb.home });
  try {
    for (let i = 0; i < tasks; i += 1) {
      writer.addTask(
        {
          role: Array.isArray(role) ? role[i] : role,
          text: text ?? `Вымышленная задача ${i + 1}`,
          done_when: "Есть краткий итог",
        },
        "USER",
      );
    }
  } finally {
    writer.close();
  }
  const dir = path.join(sb.home, id);
  return {
    id,
    task: "t-0001",
    dir,
    events: path.join(dir, "events.jsonl"),
    files: path.join(dir, "files"),
    work: path.join(dir, "work"),
  };
}

export function journal(p) {
  const file = typeof p === "string" ? p : p.events;
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.pop();
  return lines.map((l) => JSON.parse(l));
}

export const types = (events) => events.map((e) => e.type);
export const ofType = (events, type) => events.filter((e) => e.type === type);

export function stateOf(sb, id) {
  return readProject(id, { home: sb.home }).state;
}

export function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Every path under `dir` with kind, mode and sha256 of a file; links are not followed.
export function snapshot(dir) {
  const out = {};
  const walk = (abs, rel) => {
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) {
      out[rel] = { kind: "link", target: fs.readlinkSync(abs) };
    } else if (st.isDirectory()) {
      out[rel] = { kind: "dir", mode: st.mode & 0o777 };
      for (const name of fs.readdirSync(abs).sort()) {
        walk(path.join(abs, name), rel === "." ? name : `${rel}/${name}`);
      }
    } else {
      out[rel] = {
        kind: "file",
        mode: st.mode & 0o777,
        sha256: sha256(fs.readFileSync(abs)),
      };
    }
  };
  walk(dir, ".");
  return out;
}

export function allFilesText(dir) {
  const out = [];
  const walk = (abs) => {
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs)) walk(path.join(abs, name));
    } else out.push(fs.readFileSync(abs).toString("latin1"));
  };
  walk(dir);
  return out.join("\n");
}

// ---- direct calls of an executor ---------------------------------------------------

export function requestFor(sb, id, over = {}) {
  const state = stateOf(sb, id);
  const task = state.tasks[0];
  const config = readConfig(execEnv(sb));
  const cap = Math.floor(state.budget_usd * 0.25 * 1e6) / 1e6;
  return {
    project: {
      id,
      executor: state.executor,
      budget_usd: state.budget_usd,
      spent_usd: state.spent_usd,
    },
    run_id: "r-00001",
    purpose: "work",
    role: roleByCode(task.role),
    task: { id: task.id, text: task.text, done_when: task.done_when },
    attempt: 1,
    context: { goal: state.goal, memory: [], deps: [], note: null },
    limits: {
      max_budget_usd: state.budget_usd > 0 ? cap : null,
      timeout_ms: config.taskTimeoutMs,
      work_dir: path.join(sb.home, id, "work"),
    },
    answer_schema: WORK_ANSWER_SCHEMA,
    scenario_path:
      state.scenario_file === null
        ? null
        : path.join(sb.home, id, state.scenario_file),
    ...over,
  };
}

// io for run()/check(): the same guard as for commands.
export function ioFor(sb, over = {}, envOver = {}) {
  const env = execEnv(sb, envOver);
  assertSafeEnv(env);
  const events = [];
  const io = {
    onEvent: (e) => events.push(e),
    signal: new AbortController().signal,
    env,
    config: readConfig(env),
    ...over,
  };
  io.events = events;
  return io;
}

// ---- processes ---------------------------------------------------------------------

export function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

export function groupAliveOf(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

export async function waitUntil(fn, ms = 10_000, step = 25) {
  const until = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > until) return null;
    await new Promise((r) => setTimeout(r, step));
  }
}

// Kills a process and its group, quietly; for finally blocks of tests.
export function killQuietly(pid) {
  for (const target of [pid, -pid]) {
    try {
      process.kill(target, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

export const ms = (iso) => Date.parse(iso);
