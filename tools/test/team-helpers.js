// Helpers of the tests of the Sai Team core (design REQ-009, section 15). Not a test
// file. Every test works in its own temporary data folder; nothing here may touch
// ~/.sai-team or ~/.sai-pixel-office, and assertSafeHome() refuses such a folder.
//
// Rules of the helpers:
//  - the data folder is always passed explicitly (`{ home }`) or through the
//    environment of a child process, together with a HOME of the child that points
//    into the temporary folder as well;
//  - an object is compared with assert.deepStrictEqual (assert/strict), never by its
//    text; a refusal is checked together with the unchanged state of the files
//    (snapshot before and after);
//  - failures of the operating system are injected only by fault-inject.js; this file
//    holds no mechanism of its own for that.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TeamError } from "../src/team/errors.js";
import { reduce } from "../src/team/reducer.js";
import { createProject, openWriter } from "../src/team/store.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOOLS_DIR = path.resolve(HERE, "..");
export const REPO_ROOT = path.resolve(TOOLS_DIR, "..");
export const TEAM_SRC = path.join(TOOLS_DIR, "src", "team");
export const CLI_PATH = path.join(TEAM_SRC, "cli.js");
export const STORE_URL = pathToFileURL(path.join(TEAM_SRC, "store.js")).href;
export const FAULT_URL = pathToFileURL(path.join(HERE, "fault-inject.js")).href;
export const HELPERS_URL = import.meta.url;
export const CHILD_TIMEOUT_MS = 30_000;

// In the past of every real clock, so that a command run as a child process (it uses
// the real clock) never sees a journal from the future.
export const T0 = Date.UTC(2026, 0, 1, 9, 0, 0);

// ---- the data folder ---------------------------------------------------------------

// Throws unless `home` is an absolute path that is neither ~/.sai-team nor
// ~/.sai-pixel-office (nor inside them). Returns the resolved path.
export function assertSafeHome(home) {
  if (typeof home !== "string" || home === "") {
    throw new Error("team test: SAI_TEAM_HOME is not set");
  }
  if (!path.isAbsolute(home)) {
    throw new Error("team test: SAI_TEAM_HOME must be an absolute path");
  }
  const resolved = path.resolve(home);
  for (const name of [".sai-team", ".sai-pixel-office"]) {
    const forbidden = path.join(os.homedir(), name);
    if (resolved === forbidden || resolved.startsWith(forbidden + path.sep)) {
      throw new Error(`team test: ${resolved} is a real data folder`);
    }
  }
  return resolved;
}

// A new temporary data folder (mode 0700), removed after the test. The folder around
// it (path.dirname(home)) is the test's own scratch space for decoys.
export function makeHome(t, { create = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sai-team-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = assertSafeHome(path.join(root, "home"));
  if (create) fs.mkdirSync(home, { mode: 0o700 });
  return home;
}

export function scratchOf(home) {
  return path.dirname(home);
}

// The environment of a child process: the data folder and a HOME inside the same
// temporary folder, so that even a bug cannot reach the real home folder.
export function childEnv(home, extra = {}) {
  const safe = assertSafeHome(home);
  const env = { ...process.env };
  delete env.SAI_TEST_FAULTS;
  delete env.NODE_OPTIONS;
  env.SAI_TEAM_HOME = safe;
  env.HOME = path.dirname(safe);
  return { ...env, ...extra };
}

// ---- clock and ids -----------------------------------------------------------------

// The clock given to the API as `now`. By default every call is `step` ms after the
// previous one; set(ms) fixes it, auto(ms) lets it run on from ms.
export function makeClock(start = T0, step = 10) {
  let t = start - step;
  let fixed = null;
  const clock = () => {
    if (fixed !== null) return fixed;
    t += step;
    return t;
  };
  clock.set = (ms) => {
    fixed = ms;
  };
  clock.auto = (ms) => {
    fixed = null;
    t = ms - step;
  };
  return clock;
}

let idCounter = 0;
function nextHex() {
  idCounter += 1;
  return (0xa1b2c3 + idCounter).toString(16).padStart(6, "0");
}

// ---- projects ----------------------------------------------------------------------

export function newProject(home, clock, over = {}, opts = {}) {
  const input = {
    goal: "Подготовить план запуска кофейни",
    budget_usd: 5,
    executor: "claude-cli",
    ...over,
  };
  return createProject(input, {
    home,
    now: clock,
    randomId: () => nextHex(),
    ...opts,
  });
}

// Opens the writer and closes it after the test.
export function openTracked(t, home, id, clock, opts = {}) {
  const writer = openWriter(id, { home, now: clock, ...opts });
  t.after(() => writer.close());
  return writer;
}

// A project with its writer: { id, writer, dir, events }.
export function startProject(t, home, clock, over = {}) {
  const { id } = newProject(home, clock, over);
  const writer = openTracked(t, home, id, clock);
  return {
    id,
    writer,
    dir: path.join(home, id),
    events: path.join(home, id, "events.jsonl"),
  };
}

export const eng = (type, data = {}, task = null) => ({
  source: "ENGINE",
  type,
  task,
  data,
});
export const usr = (type, data = {}, task = null) => ({
  source: "USER",
  type,
  task,
  data,
});
export const agent = (type, data = {}, task = null) => ({
  source: "AGENT",
  type,
  task,
  data,
});

export const planTask = (id, role, over = {}) => ({
  id,
  role,
  text: `Задача ${id}`,
  done_when: "Есть готовый результат",
  depends_on: [],
  critical: false,
  ...over,
});

export function startRun(
  w,
  purpose,
  role,
  task = null,
  { executor = w.state.executor, max = null } = {},
) {
  const run_id = w.nextRunId();
  w.append(
    eng(
      "RUN_STARTED",
      { run_id, purpose, role, executor, max_budget_usd: max },
      task,
    ),
  );
  return run_id;
}

export function endRun(w, run_id, task = null, over = {}) {
  return w.append(
    eng(
      "RUN_FINISHED",
      {
        run_id,
        outcome: "ok",
        summary: null,
        cost_usd: null,
        files: [],
        ...over,
      },
      task,
    ),
  );
}

// project running with a plan of the given tasks.
export function withPlan(w, tasks) {
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  w.append(eng("PLAN_RECEIVED", { round: 0, tasks }));
}

// The task runs: started, one work run, finished.
export function workTask(w, id) {
  const role = w.state.tasks.find((x) => x.id === id).role;
  w.append(eng("TASK_STARTED", {}, id));
  endRun(w, startRun(w, "work", role, id), id);
}

// A task through its review to done.
export function reviewTask(w, id) {
  w.append(eng("TASK_REVIEW", {}, id));
  const run = startRun(w, "review", "reviewer", id);
  endRun(w, run, id);
  w.append(
    eng("REVIEW_RESULT", { run_id: run, passed: true, notes: "Хорошо" }, id),
  );
  w.append(
    eng("TASK_DONE", { via: "review", external_action_done: false }, id),
  );
}

export function finishTask(w, id) {
  workTask(w, id);
  reviewTask(w, id);
}

// The whole life of a project up to PROJECT_DONE: more than 30 events of almost every
// kind (the types that cannot follow a final status are covered by buildOthers and
// buildRecovered). Returns the ids of the files written.
export function buildDone(w) {
  const ex = w.state.executor;
  w.append(usr("PROJECT_STARTED", { parallel: 2 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  const plan1 = startRun(w, "plan", "project_manager");
  w.append(
    agent("AGENT_ACTIVITY", {
      run_id: plan1,
      activity: "thinking",
      executor: ex,
      text: null,
    }),
  );
  endRun(w, plan1, null, { outcome: "invalid_output" });
  w.append(
    eng("PLAN_REJECTED", {
      round: 0,
      attempt: 1,
      reason: "schema",
      detail: "В плане нет критерия готовности",
    }),
  );
  w.append(eng("PLAN_RETRY", { round: 0, attempt: 2 }));
  endRun(w, startRun(w, "plan", "project_manager"));
  w.append(
    eng("PLAN_RECEIVED", {
      round: 0,
      tasks: [
        planTask("t-0001", "financial_analyst"),
        planTask("t-0002", "marketer", {
          depends_on: ["t-0001"],
          critical: true,
        }),
        planTask("t-0003", "business_analyst"),
      ],
    }),
  );
  w.addTask({
    role: "lawyer",
    text: "Проверить договор аренды",
    done_when: "Риски названы",
    depends_on: ["t-0001"],
  });
  w.addTask(
    {
      role: "support",
      text: "Подготовить ответы клиентам",
      done_when: "Ответы готовы",
    },
    "USER",
  );
  w.say("Добавьте сравнение цен");
  w.append(
    eng("CHAT", {
      text: "Какой город выбрать?",
      kind: "question",
      truncated: false,
    }),
  );
  w.addMemory({ kind: "fact", text: "Бюджет на аренду — 300 тысяч" });
  w.addMemory({ kind: "decision", text: "Берём аренду на год" }, "USER");
  w.addMemory({ kind: "note", text: "Цены уточнить", executor: ex }, "AGENT");
  w.append(usr("BUDGET_SET", { budget_usd: 10 }));

  // t-0001: a work run with a file and a cost, then its review.
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  const work1 = startRun(w, "work", "financial_analyst", "t-0001", { max: 2 });
  w.append(
    agent(
      "AGENT_ACTIVITY",
      {
        run_id: work1,
        activity: "reading",
        executor: ex,
        text: "Читает таблицу цен",
      },
      "t-0001",
    ),
  );
  w.writeResultFile({
    task: "t-0001",
    name: "calc.md",
    content: "Расчёт цен\n",
  });
  endRun(w, work1, "t-0001", {
    files: ["calc.md"],
    cost_usd: 0.5,
    summary: "Расчёт готов",
  });
  w.append(
    eng(
      "BUDGET_SPENT",
      { run_id: work1, cost_usd: 0.5, accounted: "reported", total_usd: 0.5 },
      "t-0001",
    ),
  );
  reviewTask(w, "t-0001");

  // t-0002 (critical): retry, a draft, the decision of the user, done by approval.
  w.append(eng("TASK_STARTED", {}, "t-0002"));
  w.append(
    eng(
      "TASK_RETRY",
      { next_attempt: 2, delay_ms: 0, reason: "failed" },
      "t-0002",
    ),
  );
  const work2 = startRun(w, "work", "marketer", "t-0002");
  w.writeResultFile({
    task: "t-0002",
    name: "draft.md",
    content: "Черновик письма\n",
    kind: "draft",
  });
  endRun(w, work2, "t-0002", { files: ["draft.md"] });
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "approval", draft: "draft.md" },
      "t-0002",
    ),
  );
  w.append(
    usr("DECISION_RECEIVED", { decision: "approve", text: null }, "t-0002"),
  );
  w.append(
    eng(
      "TASK_DONE",
      { via: "approval", external_action_done: false },
      "t-0002",
    ),
  );

  // t-0003: reassigned before it starts.
  w.append(
    eng(
      "TASK_REASSIGNED",
      {
        from_role: "business_analyst",
        to_role: "researcher",
        reason: "Нужны данные из сети",
      },
      "t-0003",
    ),
  );
  finishTask(w, "t-0003");

  // t-0004 refused by the budget, started later.
  w.append(
    eng(
      "RUN_REFUSED",
      { reason: "budget_exhausted", detail: "Потолок исчерпан" },
      "t-0004",
    ),
  );
  w.append(eng("TASK_STARTED", {}, "t-0004"));
  endRun(w, startRun(w, "work", "lawyer", "t-0004"), "t-0004", {
    outcome: "failed",
  });
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Попытки закончились" },
      "t-0004",
    ),
  );
  w.append(eng("PROJECT_WAITING", { reason: "task_failed" }, "t-0004"));
  w.append(eng("PROJECT_RESUMED", { parallel: null, after: "decision" }));
  w.append(usr("PROJECT_PAUSED"));
  w.append(usr("PROJECT_RESUMED", { parallel: 1, after: "command" }));
  finishTask(w, "t-0004");
  finishTask(w, "t-0005");

  // the goal check, then the end.
  const goal = startRun(w, "goal_check", "reviewer");
  w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: goal }));
  w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: goal,
      passed: true,
      notes: "Цель достигнута",
    }),
  );
  endRun(w, goal);
  w.append(eng("PROJECT_DONE"));
}

// Two projects that end otherwise: stopped (with an interrupted task) and failed.
export function buildStopped(w) {
  withPlan(w, [planTask("t-0001", "developer")]);
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  w.append(eng("TASK_INTERRUPTED", { cause: "stop" }, "t-0001"));
  w.append(usr("PROJECT_STOPPED"));
}

export function buildFailed(w) {
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(
    eng("PROJECT_FAILED", {
      reason: "unrecoverable",
      detail: "Нет доступа к исполнителю",
    }),
  );
}

// A pid of a process that has ended.
export function deadPid() {
  const r = spawnSync(process.execPath, ["-e", ""], {
    timeout: CHILD_TIMEOUT_MS,
  });
  assert.equal(r.status, 0);
  return r.pid;
}

// A running project that was left: a task in work with an open run, a task on review
// with an open run, an open goal check. Returns the ids of the tasks.
export function leaveRunning(w) {
  withPlan(w, [
    planTask("t-0001", "developer"),
    planTask("t-0002", "designer"),
  ]);
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  startRun(w, "work", "developer", "t-0001");
  w.append(eng("TASK_STARTED", {}, "t-0002"));
  endRun(w, startRun(w, "work", "designer", "t-0002"), "t-0002");
  w.append(eng("TASK_REVIEW", {}, "t-0002"));
  startRun(w, "review", "reviewer", "t-0002");
  startRun(w, "goal_check", "reviewer");
}

// ---- files -------------------------------------------------------------------------

export function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Every path under `dir` (and `dir` itself) with its kind, mode and, for a file, its
// size and sha256; links are listed, never followed.
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
        size: st.size,
        sha256: sha256(fs.readFileSync(abs)),
      };
    }
  };
  walk(dir, ".");
  return out;
}

export function assertSnapshot(dir, before, message) {
  assert.deepStrictEqual(snapshot(dir), before, message);
}

export function modeOf(p) {
  return fs.lstatSync(p).mode & 0o777;
}

// The whole lines of a journal as objects. A broken tail (the last line without a line
// break or not JSON) is left out; a broken line anywhere else throws.
export function journalOf(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.pop();
  const out = [];
  lines.forEach((line, i) => {
    try {
      out.push(JSON.parse(line));
    } catch (err) {
      if (i !== lines.length - 1) throw err;
    }
  });
  return out;
}

export function typesOf(events) {
  return events.map((e) => e.type);
}

// ---- refusals ----------------------------------------------------------------------

// `fn` must throw a TeamError with this code (and details.rule when given); nothing
// under `dir` changes. Returns the error.
export function assertRefusal(dir, fn, code, rule) {
  const before = snapshot(dir);
  let caught = null;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof TeamError, `expected a TeamError, got ${caught}`);
  assert.equal(caught.code, code, `${caught.code}: ${caught.message}`);
  if (rule !== undefined) assert.equal(caught.details.rule, rule);
  assert.deepStrictEqual(snapshot(dir), before, "the files must not change");
  return caught;
}

// The same for a refused append of a writer: files and state are unchanged.
export function assertAppendRefused(w, dir, input, code, rule) {
  const state = structuredClone(w.state);
  const err = assertRefusal(dir, () => w.append(input), code, rule);
  assert.deepStrictEqual(w.state, state, "the state must not change");
  return err;
}

const STATUS_CHANGERS = [
  "PROJECT_STARTED",
  "PLANNING_STARTED",
  "PLAN_RECEIVED",
  "PROJECT_WAITING",
  "PROJECT_PAUSED",
  "PROJECT_RESUMED",
  "PROJECT_RECOVERED",
  "PROJECT_STOPPED",
  "PROJECT_DONE",
  "PROJECT_FAILED",
];
const TASK_STATUS_CHANGERS = [
  "TASK_STARTED",
  "TASK_REVIEW",
  "TASK_WAITING_USER",
  "TASK_DONE",
  "TASK_FAILED",
  "TASK_INTERRUPTED",
];

// An event that is named as a change of a status really changes it (criterion 11 of
// REQ-013): replays the journal event by event.
export function assertStatusChanges(events) {
  let state = null;
  for (const event of events) {
    const after = reduce(state, event);
    if (STATUS_CHANGERS.includes(event.type)) {
      assert.notEqual(
        state.status,
        after.status,
        `${event.type} (seq ${event.seq}) must change the status of the project`,
      );
    }
    if (TASK_STATUS_CHANGERS.includes(event.type)) {
      const was = state.tasks.find((t) => t.id === event.task).status;
      const now = after.tasks.find((t) => t.id === event.task).status;
      assert.notEqual(
        was,
        now,
        `${event.type} (seq ${event.seq}) must change the status of the task`,
      );
    }
    state = after;
  }
}

// ---- child processes ---------------------------------------------------------------

export function runTeam(home, args, { faults, env } = {}) {
  const node = [];
  if (faults !== undefined) node.push("--import", FAULT_URL);
  node.push(CLI_PATH, ...args);
  const childEnvironment = childEnv(home, env);
  if (faults !== undefined) {
    childEnvironment.SAI_TEST_FAULTS = JSON.stringify(faults);
  }
  const r = spawnSync(process.execPath, node, {
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    env: childEnvironment,
  });
  return {
    status: r.status,
    signal: r.signal,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    error: r.error,
    pid: r.pid,
  };
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

// Runs a piece of ES-module code in a child process (the second process that reads
// what the first wrote); stdout is returned.
export function runModule(home, code) {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    env: childEnv(home),
  });
  assert.equal(r.status, 0, describeRun(r));
  return r.stdout;
}

// A child process that takes the right to write to a project through the API and
// holds it until it is killed. Returns { pid, kill() }.
export async function holdWriter(t, home, id) {
  const code = `import { openWriter } from ${JSON.stringify(STORE_URL)};
openWriter(process.env.TEAM_TEST_ID, { home: process.env.SAI_TEAM_HOME });
process.stdout.write("ready " + process.pid + "\\n");
setTimeout(() => {}, 120000);`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
    env: childEnv(home, { TEAM_TEST_ID: id }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill("SIGKILL"));
  await new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    const timer = setTimeout(
      () => reject(new Error(`the holder did not start: ${err}`)),
      CHILD_TIMEOUT_MS,
    );
    child.stderr.on("data", (d) => {
      err += d;
    });
    child.stdout.on("data", (d) => {
      out += d;
      if (/ready \d+\n/.test(out)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", () => {
      clearTimeout(timer);
      reject(new Error(`the holder ended early: ${err}`));
    });
  }).catch((e) => {
    child.kill("SIGKILL");
    throw e;
  });
  child.removeAllListeners("exit");
  return {
    pid: child.pid,
    kill: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const ended = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGKILL");
      await ended;
    },
  };
}

// ---- crashes and broken writers (design REQ-009, section 15.1, r5 and r6) ----------------

// Runs `body` (a piece of ES-module code; `w` is the writer of the project opened
// through the API with a clock of its own, `H` is this file) in a child process.
// kill: true ends the process with SIGKILL after the body without close(): a real
// crash, the lock of a dead pid stays (way (a) of the design). faults: a list for
// fault-inject.js (--import), the way (c): the child breaks its writer by a real
// failure, calls close() and ends by itself. Returns { status, signal, stdout,
// stderr, pid }.
export function runWriterChild(
  home,
  id,
  body,
  { faults, kill = false, clockStart = T0 + 600_000 } = {},
) {
  const code = `import * as H from ${JSON.stringify(HELPERS_URL)};
import { openWriter } from ${JSON.stringify(STORE_URL)};
const w = openWriter(process.env.TEAM_TEST_ID, { home: process.env.SAI_TEAM_HOME, now: H.makeClock(${clockStart}, 10) });
${body}
${kill ? 'process.kill(process.pid, "SIGKILL");' : ""}`;
  const node = [];
  if (faults !== undefined) node.push("--import", FAULT_URL);
  node.push("--input-type=module", "-e", code);
  const extra = { TEAM_TEST_ID: id };
  const env = childEnv(home, extra);
  if (faults !== undefined) env.SAI_TEST_FAULTS = JSON.stringify(faults);
  const r = spawnSync(process.execPath, node, {
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    env,
  });
  return {
    status: r.status,
    signal: r.signal,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    pid: r.pid,
  };
}

// A real crash: the child writes `body` and dies by SIGKILL holding the lock. The
// lock of the dead pid must be there afterwards. Returns the pid.
export function crashWriter(home, id, body) {
  const r = runWriterChild(home, id, body, { kill: true });
  assert.equal(r.signal, "SIGKILL", describeRun(r));
  const lock = lockOf(path.join(home, id));
  assert.equal(lock.pid, r.pid, "the lock of the dead process stays");
  return r.pid;
}

// N child processes that open the project at the same moment (a barrier on the wall
// clock), write one CHAT "opener <i>" and close (r8, TM-67). Each is limited in time
// and killed when it is not over; the promise settles when all are over. Returns
// [{ i, status, signal, result }] with result = "opened" or the code of the TeamError.
export async function runOpeners(home, id, n, { startInMs = 700 } = {}) {
  const code = `import { openWriter } from ${JSON.stringify(STORE_URL)};
const at = Number(process.env.TEAM_TEST_AT);
await new Promise((r) => setTimeout(r, Math.max(0, at - Date.now())));
try {
  const w = openWriter(process.env.TEAM_TEST_ID, { home: process.env.SAI_TEAM_HOME });
  try {
    w.say("opener " + process.env.TEAM_TEST_N);
  } finally {
    w.close();
  }
  process.stdout.write("opened\\n");
} catch (e) {
  process.stdout.write("error " + (e && e.code) + "\\n");
}`;
  const at = Date.now() + startInMs;
  const jobs = [];
  for (let i = 0; i < n; i += 1) {
    jobs.push(
      new Promise((resolve) => {
        const child = spawn(
          process.execPath,
          ["--input-type=module", "-e", code],
          {
            env: childEnv(home, {
              TEAM_TEST_ID: id,
              TEAM_TEST_AT: String(at),
              TEAM_TEST_N: String(i),
            }),
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let out = "";
        child.stdout.on("data", (d) => {
          out += d;
        });
        child.stderr.on("data", (d) => {
          out += "STDERR " + d;
        });
        const timer = setTimeout(() => child.kill("SIGKILL"), CHILD_TIMEOUT_MS);
        child.on("close", (status, signal) => {
          clearTimeout(timer);
          resolve({ i, pid: child.pid, status, signal, result: out.trim() });
        });
      }),
    );
  }
  return Promise.all(jobs);
}

// The content of writer.lock of a project folder.
export function lockOf(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "writer.lock"), "utf8"));
}

// The pid is not a live process.
export function assertDead(pid) {
  assert.throws(
    () => process.kill(pid, 0),
    (err) => err.code === "ESRCH",
    `pid ${pid} must be dead`,
  );
}

// After a writer was broken and its process ended (r6): the only change in the folder
// is writer.lock of that dead pid; everything else is as in `before`.
export function assertOnlyDeadLockAdded(dir, before, pid) {
  const now = snapshot(dir);
  const lock = now["writer.lock"];
  assert.ok(lock !== undefined, "writer.lock must stay (rule 1 of r6)");
  assert.equal(lock.mode, 0o600);
  assert.equal(lockOf(dir).pid, pid);
  assertDead(pid);
  delete now["writer.lock"];
  assert.deepStrictEqual(now, before, "nothing but the lock changed");
}

// The Date of an ISO string in milliseconds.
export const ms = (iso) => Date.parse(iso);

// ---- the batch of a recovery (design REQ-009, section 15.1d, r10, TM-68) ----------------

// The fixture of TM-68: project `running`, t-0001 in work with its open run r-00001,
// t-0002 on review with no open run (it stays on review).
export const RECOVERY_FIXTURE = `H.withPlan(w, [
  H.planTask("t-0001", "developer"),
  H.planTask("t-0002", "designer"),
]);
w.append(H.eng("TASK_STARTED", {}, "t-0001"));
H.startRun(w, "work", "developer", "t-0001");
w.append(H.eng("TASK_STARTED", {}, "t-0002"));
H.endRun(w, H.startRun(w, "work", "designer", "t-0002"), "t-0002");
w.append(H.eng("TASK_REVIEW", {}, "t-0002"));`;

export const BATCH_TYPES = [
  "RUN_FINISHED",
  "TASK_INTERRUPTED",
  "PROJECT_RECOVERED",
];

// A child process that opens a project (the recovery runs inside openWriter), closes
// the writer when it got one and ends by itself with code 0. faults: a list for
// fault-inject.js (--import). Prints the result: "opened" or { code, rollback }.
// Returns { status, signal, pid, result, stderr }.
export function runRecoveryOpen(home, id, { faults } = {}) {
  const code = `import { openWriter } from ${JSON.stringify(STORE_URL)};
try {
  const w = openWriter(process.env.TEAM_TEST_ID, { home: process.env.SAI_TEAM_HOME });
  w.close();
  process.stdout.write(JSON.stringify("opened"));
} catch (e) {
  process.stdout.write(JSON.stringify({ code: e && e.code, rollback: e && e.details && e.details.rollback }));
}`;
  const node = [];
  if (faults !== undefined) node.push("--import", FAULT_URL);
  node.push("--input-type=module", "-e", code);
  const env = childEnv(home, { TEAM_TEST_ID: id });
  if (faults !== undefined) env.SAI_TEST_FAULTS = JSON.stringify(faults);
  const r = spawnSync(process.execPath, node, {
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    env,
  });
  return {
    status: r.status,
    signal: r.signal,
    pid: r.pid,
    result: r.stdout ? JSON.parse(r.stdout) : null,
    stderr: r.stderr ?? "",
  };
}

// Counts, by descriptors the journal was opened for appending with, the calls of
// write, fsync and ftruncate in the process of the test (t.mock.method, a count and no
// failure). Returns { counts, journalOpens } read after the work.
export function countJournalCalls(t, eventsFile) {
  const real = {
    openSync: fs.openSync,
    closeSync: fs.closeSync,
    writeSync: fs.writeSync,
    fsyncSync: fs.fsyncSync,
    ftruncateSync: fs.ftruncateSync,
  };
  const fds = new Set();
  const counts = { writeSync: 0, fsyncSync: 0, ftruncateSync: 0 };
  t.mock.method(fs, "openSync", function (...args) {
    const fd = real.openSync.apply(fs, args);
    if (args[0] === eventsFile && typeof args[1] === "number") {
      if ((args[1] & fs.constants.O_APPEND) !== 0) fds.add(fd);
    }
    return fd;
  });
  // A closed descriptor number is reused by the operating system (a lock file, say):
  // it is no longer the journal.
  t.mock.method(fs, "closeSync", function (...args) {
    fds.delete(args[0]);
    return real.closeSync.apply(fs, args);
  });
  for (const fn of ["writeSync", "fsyncSync", "ftruncateSync"]) {
    t.mock.method(fs, fn, function (...args) {
      if (fds.has(args[0])) counts[fn] += 1;
      return real[fn].apply(fs, args);
    });
  }
  return counts;
}

// Replaces writer.lock by the lock of another LIVE process (the parent of the test)
// right after the K-th close of a descriptor of the journal opened for appending
// (the K-th append of the opening has been written). No OS error: the lock simply
// changes hands, as in TM-56. Returns { foreign, restore() }.
export function loseLockAfterAppend(t, eventsFile, lockFile, k) {
  const realOpen = fs.openSync;
  const realClose = fs.closeSync;
  const realWriteFile = fs.writeFileSync;
  const foreign = `${JSON.stringify({ pid: process.ppid, since: "2026-10-06T08:00:00.000Z" })}\n`;
  const fds = new Set();
  let closes = 0;
  t.mock.method(fs, "openSync", function (...args) {
    const fd = realOpen.apply(fs, args);
    if (args[0] === eventsFile && typeof args[1] === "number") {
      if ((args[1] & fs.constants.O_APPEND) !== 0) fds.add(fd);
    }
    return fd;
  });
  t.mock.method(fs, "closeSync", function (...args) {
    const fd = args[0];
    const result = realClose.apply(fs, args);
    if (fds.delete(fd)) {
      closes += 1;
      if (closes === k) realWriteFile(lockFile, foreign, { mode: 0o600 });
    }
    return result;
  });
  return { foreign };
}
