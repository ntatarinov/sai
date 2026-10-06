// The runner closes the run on every path (design REQ-010, section 8.2, step 8; EX-52,
// EX-53; invariant И22 of the core). EX-52: a healthy writer, the run is closed before
// the error goes up. EX-53: a broken writer, the lock stays and the next writer
// recovers the project. Only the fake executable is started; the failures of the
// operating system come from fault-inject.js.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readConfig } from "../src/team/config.js";
import { TeamError } from "../src/team/errors.js";
import { runTask } from "../src/team/runner.js";
import { openWriter } from "../src/team/store.js";
import { installFaults } from "./fault-inject.js";
import {
  CHILD_TIMEOUT_MS,
  CLI_PATH,
  FAULT_PATH,
  TOOLS_DIR,
  assertSafeEnv,
  describeRun,
  execEnv,
  fakeLog,
  fakeStarts,
  journal,
  killQuietly,
  makeProject,
  makeSandbox,
  ofType,
  pidAlive,
  reapFakes,
  runTeam,
  sha256,
  snapshot,
  stateOf,
  types,
  waitUntil,
  withLimit,
  writePlan,
} from "./exec-helpers.js";

const DETAIL_FAILED = "Исполнитель завершился с ошибкой";
const DETAIL_DISK = "Не удалось записать файл результата на диск";
const DETAIL_FILE = "Файл результата не найден в рабочей папке или недопустим";
const PLAN_PLAIN = { default: { stream: "stream-ok.jsonl", set_cost: 0.05 } };
const PLAN_FILE = {
  default: {
    stream: "stream-ok.jsonl",
    set_cost: 0.05,
    work_files: [{ path: "report.md", content: "Итог работы\n" }],
    answer_files: ["report.md"],
  },
};

// A project, its command environment and the fake file's plan.
function setup(t, plan) {
  const sb = makeSandbox(t);
  writePlan(sb, plan);
  const p = makeProject(sb);
  // a project that is running (the commands of the owner start it first)
  const starter = openWriter(p.id, { home: sb.home });
  starter.append({
    source: "USER",
    type: "PROJECT_STARTED",
    task: null,
    data: { parallel: 1 },
  });
  starter.close();
  const env = execEnv(sb);
  assertSafeEnv(env);
  return { sb, p, env, config: readConfig(env) };
}

// The partial file of the first result file of the first attempt.
const partialOf = (p) => path.join(p.files, ".partial-t-0001-1-report.md");

// A command with fault-inject.js; the pid of the child is returned too (the lock
// of a broken writer belongs to it).
function runCommand(argv, env, faults) {
  assertSafeEnv(env);
  // Output goes to files, not pipes (as runTeam): a descendant that keeps a pipe open
  // after the command is killed must not keep spawnSync waiting.
  const dir = fs.mkdtempSync(path.join(path.dirname(env.HOME), ".out-"));
  const outFd = fs.openSync(path.join(dir, "out"), "w");
  const errFd = fs.openSync(path.join(dir, "err"), "w");
  let r;
  try {
    r = spawnSync(
      process.execPath,
      ["--import", FAULT_PATH, CLI_PATH, ...argv],
      {
        stdio: ["ignore", outFd, errFd],
        timeout: CHILD_TIMEOUT_MS,
        killSignal: "SIGKILL",
        env: { ...env, SAI_TEST_FAULTS: JSON.stringify(faults) },
        cwd: TOOLS_DIR,
      },
    );
  } finally {
    fs.closeSync(outFd);
    fs.closeSync(errFd);
  }
  const read = (name) => fs.readFileSync(path.join(dir, name), "utf8");
  const out = { stdout: read("out"), stderr: read("err") };
  fs.rmSync(dir, { recursive: true, force: true });
  if (r.error) reapFakes(env.HOME);
  return {
    status: r.status,
    signal: r.signal,
    stdout: out.stdout,
    stderr: out.stderr,
    pid: r.pid,
  };
}

function lockOf(p) {
  return JSON.parse(fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8"));
}

function assertDead(pid) {
  assert.throws(
    () => process.kill(pid, 0),
    (err) => err.code === "ESRCH",
    `pid ${pid} must be dead`,
  );
}

// No process of the fake file may stay; killed quietly if one does.
async function assertNoFakeProcess(t, sb) {
  const pids = fakeLog(sb)
    .filter((e) => e.event === "start")
    .map((e) => e.pid);
  t.after(() => pids.forEach((pid) => killQuietly(pid)));
  for (const pid of pids) {
    const gone = await waitUntil(() => !pidAlive(pid), 10_000);
    assert.ok(gone, `the fake file ${pid} is still alive`);
  }
}

// After a closed run on a healthy writer (EX-52 (в)).
function assertCleanAfterClose(sb, p, writer, runIds) {
  writer.close();
  assert.equal(
    fs.existsSync(path.join(p.dir, "writer.lock")),
    false,
    "close() of a healthy writer gives the lock back",
  );
  const bytes = sha256(fs.readFileSync(p.events));
  const lines = journal(p).length;
  const again = openWriter(p.id, { home: sb.home });
  assert.deepStrictEqual(again.notices, [], "nothing to recover");
  again.close();
  assert.equal(
    sha256(fs.readFileSync(p.events)),
    bytes,
    "the journal is as it was",
  );
  const w = openWriter(p.id, { home: sb.home });
  w.say("После запуска");
  w.close();
  const added = journal(p).slice(lines);
  assert.deepStrictEqual(types(added), ["CHAT"]);
  for (const id of runIds) {
    const closed = journal(p).filter(
      (e) => e.type === "RUN_FINISHED" && e.data.run_id === id,
    );
    assert.equal(closed.length, 1, `${id} is closed exactly once`);
  }
}

// ---- EX-52 -----------------------------------------------------------------------------

test("EX-52 (a) the executor throws an error that is not a TeamError after RUN_STARTED: the run and the task are closed before the same error goes up", async (t) => {
  const { sb, p, env, config } = setup(t, PLAN_PLAIN);
  const writer = openWriter(p.id, { home: sb.home });
  t.after(() => writer.close());
  const lines = journal(p).length;
  const context = {
    get goal() {
      throw new Error("boom");
    },
    memory: [],
    deps: [],
    note: null,
  };
  let caught = null;
  try {
    await withLimit(runTask(writer, "t-0001", { env, config, context }));
  } catch (err) {
    caught = err;
  }
  assert.ok(caught !== null, "runTask must reject");
  assert.equal(caught.message, "boom", "the same error, not replaced");
  assert.equal(caught instanceof TeamError, false);
  assert.equal(caught.constructor, Error);

  const added = journal(p).slice(lines);
  assert.deepStrictEqual(types(added), [
    "TASK_STARTED",
    "RUN_STARTED",
    "RUN_FINISHED",
    "TASK_FAILED",
  ]);
  assert.deepStrictEqual(added[2].data, {
    run_id: added[1].data.run_id,
    outcome: "failed",
    summary: null,
    cost_usd: null,
    files: [],
  });
  assert.deepStrictEqual(added[3].data, {
    reason: "retries_exhausted",
    detail: DETAIL_FAILED,
  });
  assert.equal(ofType(added, "BUDGET_SPENT").length, 0, "no process, no cost");
  assert.equal(fakeStarts(sb).length, 0, "the fake file was not started");
  const state = stateOf(sb, p.id);
  assert.deepStrictEqual(state.runs.open, {});
  assert.equal(state.tasks[0].status, "failed");
  assert.equal(state.spent_usd, 0);
  assertCleanAfterClose(sb, p, writer, [added[1].data.run_id]);
});

test("EX-52 (b) the acceptance of the result raises an error that is not a refusal of a file: the run ends failed with the reported cost, BUDGET_SPENT is written, the task fails, the same error goes up", async (t) => {
  const { sb, p, env, config } = setup(t, PLAN_FILE);
  const writer = openWriter(p.id, { home: sb.home });
  t.after(() => writer.close());
  const lines = journal(p).length;
  const fault = installFaults([
    { fn: "writeFileSync", paths: [partialOf(p)], effect: "bug" },
  ]);
  let caught = null;
  try {
    await withLimit(runTask(writer, "t-0001", { env, config }));
  } catch (err) {
    caught = err;
  } finally {
    fault.restore();
  }
  assert.deepStrictEqual(fault.fired(), [true], "the fault must fire");
  assert.ok(caught instanceof TypeError, String(caught));
  assert.equal(caught instanceof TeamError, false);

  const added = journal(p).slice(lines);
  assert.deepStrictEqual(
    types(added).filter((x) => x !== "AGENT_ACTIVITY"),
    [
      "TASK_STARTED",
      "RUN_STARTED",
      "RUN_FINISHED",
      "BUDGET_SPENT",
      "TASK_FAILED",
    ],
  );
  const finished = ofType(added, "RUN_FINISHED")[0];
  const spent = ofType(added, "BUDGET_SPENT")[0];
  assert.equal(finished.data.outcome, "failed");
  assert.equal(finished.data.cost_usd, 0.05);
  assert.deepStrictEqual(finished.data.files, []);
  assert.equal(spent.data.accounted, "reported");
  assert.equal(spent.data.cost_usd, 0.05);
  assert.equal(spent.data.run_id, finished.data.run_id);
  assert.deepStrictEqual(ofType(added, "TASK_FAILED")[0].data, {
    reason: "result_file",
    detail: DETAIL_FILE,
  });
  assert.equal(ofType(added, "RESULT_FILE").length, 0);
  assert.deepStrictEqual(fs.readdirSync(p.files), []);
  assert.equal(fakeStarts(sb).length, 1);
  const state = stateOf(sb, p.id);
  assert.deepStrictEqual(state.runs.open, {});
  assert.equal(state.tasks[0].status, "failed");
  assert.equal(state.spent_usd, 0.05);
  await assertNoFakeProcess(t, sb);
  assertCleanAfterClose(sb, p, writer, [finished.data.run_id]);
});

// ---- EX-54 -----------------------------------------------------------------------------

test("EX-54 (a) ENOSPC on the write of the result file: the writer is whole, runTask returns the refusal, the run ends failed, BUDGET_SPENT reported, TASK_FAILED result_file with the detail result_disk, no lock", async (t) => {
  const { sb, p, env, config } = setup(t, PLAN_FILE);
  const writer = openWriter(p.id, { home: sb.home });
  t.after(() => writer.close());
  const lines = journal(p).length;
  const fault = installFaults([
    {
      fn: "writeFileSync",
      paths: [partialOf(p)],
      effect: "throw",
      code: "ENOSPC",
    },
  ]);
  let result;
  try {
    result = await withLimit(runTask(writer, "t-0001", { env, config }));
  } finally {
    fault.restore();
  }
  assert.deepStrictEqual(fault.fired(), [true], "the fault must fire");
  assert.ok(result.error instanceof TeamError, "a refusal, not a throw");
  assert.equal(result.error.code, "E_DISK");
  assert.equal(result.error.details?.rollback, undefined);

  const added = journal(p).slice(lines);
  assert.deepStrictEqual(
    types(added).filter((x) => x !== "AGENT_ACTIVITY"),
    [
      "TASK_STARTED",
      "RUN_STARTED",
      "RUN_FINISHED",
      "BUDGET_SPENT",
      "TASK_FAILED",
    ],
  );
  const finished = ofType(added, "RUN_FINISHED")[0];
  const spent = ofType(added, "BUDGET_SPENT")[0];
  assert.equal(finished.data.outcome, "failed");
  assert.equal(finished.data.cost_usd, 0.05);
  assert.deepStrictEqual(finished.data.files, []);
  assert.equal(spent.data.accounted, "reported");
  assert.equal(spent.data.cost_usd, 0.05);
  assert.deepStrictEqual(ofType(added, "TASK_FAILED")[0].data, {
    reason: "result_file",
    detail: DETAIL_DISK,
  });
  assert.notEqual(DETAIL_DISK, DETAIL_FILE);
  assert.equal(ofType(added, "RESULT_FILE").length, 0);
  assert.deepStrictEqual(fs.readdirSync(p.files), []);
  assert.equal(writer.broken, false);
  const state = stateOf(sb, p.id);
  assert.deepStrictEqual(state.runs.open, {});
  assert.equal(state.tasks[0].status, "failed");
  assert.equal(state.spent_usd, 0.05);
  await assertNoFakeProcess(t, sb);
  assertCleanAfterClose(sb, p, writer, [finished.data.run_id]);
});

test("EX-54 (b) ENOSPC on the write of the event RESULT_FILE: E_DISK with a rollback, the writer is broken, nothing is closed, the lock stays, the next say recovers", async (t) => {
  // The number of the write of RESULT_FILE is measured on a clean run of the same
  // command, not guessed.
  const probe = setup(t, PLAN_FILE);
  const probeLines = journal(probe.p).length;
  // an inert fault: the 9999th write of the journal never comes
  const clean = runCommand(["run-task", probe.p.id, probe.p.task], probe.env, [
    {
      fn: "writeSync",
      paths: [probe.p.events],
      effect: "throw",
      code: "EIO",
      nth: 9999,
    },
  ]);
  assert.equal(clean.status, 0, describeRun(clean));
  const at = types(journal(probe.p).slice(probeLines)).indexOf("RESULT_FILE");
  assert.ok(at > 2, "RESULT_FILE follows TASK_STARTED, RUN_STARTED, activity");

  const { sb, p, env } = setup(t, PLAN_FILE);
  const lines = journal(p).length;
  const r = runCommand(["run-task", p.id, p.task], env, [
    {
      fn: "writeSync",
      paths: [p.events],
      effect: "throw",
      code: "ENOSPC",
      nth: at + 1,
    },
  ]);
  assert.notEqual(r.status, 0, describeRun(r));
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^E_DISK: .*\(ENOSPC\)/u);
  assert.doesNotMatch(r.stderr, /\n\s+at |Uncaught/u);
  assert.equal(lockOf(p).pid, r.pid, "the broken writer keeps its lock");
  assertDead(r.pid);
  const events = journal(p).slice(lines);
  for (const type of [
    "RESULT_FILE",
    "RUN_FINISHED",
    "BUDGET_SPENT",
    "TASK_FAILED",
  ]) {
    assert.equal(ofType(events, type).length, 0, `${type} must not be written`);
  }
  assert.deepStrictEqual(types(events).slice(0, 2), [
    "TASK_STARTED",
    "RUN_STARTED",
  ]);
  assert.equal(events.length, at, "nothing after the failed write");
  assert.equal(fs.readFileSync(p.events).at(-1), 0x0a, "whole lines only");
  assert.deepStrictEqual(fs.readdirSync(p.files), []);
  await assertNoFakeProcess(t, sb);
  assertRecoveredBySay(sb, p, r.pid, lines + events.length);
});

// ---- EX-53 -----------------------------------------------------------------------------

// What the next writer does after a command that left the lock: the stale lock is
// taken, the open run is closed as interrupted, the task is interrupted, the project
// pauses; the second call recovers nothing again.
function assertRecoveredBySay(sb, p, pid, lines) {
  const say = runTeam(["say", p.id, "--text", "После сбоя"], execEnv(sb));
  assert.equal(say.status, 0, describeRun(say));
  const out = JSON.parse(say.stdout);
  assert.ok(
    out.notices.some((n) => n.includes(String(pid))),
    "the lock is named",
  );
  assert.ok(
    out.notices.some((n) => n.includes("t-0001")),
    "the task is named",
  );
  const added = journal(p).slice(lines);
  assert.deepStrictEqual(types(added), [
    "LOCK_STALE_REMOVED",
    "RUN_FINISHED",
    "TASK_INTERRUPTED",
    "PROJECT_RECOVERED",
    "CHAT",
  ]);
  assert.deepStrictEqual(added[0].data, { pid });
  assert.deepStrictEqual(
    [added[1].data.run_id, added[1].data.outcome],
    ["r-00001", "interrupted"],
  );
  assert.deepStrictEqual(added[2].data, { cause: "recovery" });
  assert.deepStrictEqual(added[3].data, {
    from_status: "running",
    closed_runs: 1,
    interrupted_tasks: 1,
  });
  const state = stateOf(sb, p.id);
  assert.deepStrictEqual(state.runs.open, {});
  assert.equal(state.tasks[0].status, "interrupted");
  assert.equal(state.status, "paused");
  assert.equal(state.paused_by, "recovery");
  const again = runTeam(["say", p.id, "--text", "Ещё"], execEnv(sb));
  assert.equal(again.status, 0, describeRun(again));
  assert.deepStrictEqual(JSON.parse(again.stdout).notices, []);
  assert.deepStrictEqual(types(journal(p).slice(lines + added.length)), [
    "CHAT",
  ]);
}

test("EX-53 (a) the write of AGENT_ACTIVITY fails in the command run-task: E_DISK without a stack, the lock of the dead process stays, the journal ends at RUN_STARTED, the next say recovers", async (t) => {
  const { sb, p, env } = setup(t, PLAN_PLAIN);
  const lines = journal(p).length;
  // the writes of the command: TASK_STARTED 1, RUN_STARTED 2, AGENT_ACTIVITY 3
  const r = runCommand(["run-task", p.id, p.task], env, [
    {
      fn: "writeSync",
      paths: [p.events],
      effect: "throw",
      code: "EIO",
      nth: 3,
    },
  ]);
  assert.notEqual(r.status, 0, describeRun(r));
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^E_DISK: Не удалось записать на диск \(EIO\)/u);
  assert.doesNotMatch(r.stderr, /\n\s+at |Uncaught/u);
  assert.equal(lockOf(p).pid, r.pid, "the lock of the process of the command");
  assertDead(r.pid);
  const events = journal(p);
  assert.deepStrictEqual(types(events.slice(lines)), [
    "TASK_STARTED",
    "RUN_STARTED",
  ]);
  assert.equal(fs.readFileSync(p.events).at(-1), 0x0a, "whole lines only");
  await assertNoFakeProcess(t, sb);
  assertRecoveredBySay(sb, p, r.pid, lines + 2);
});

test("EX-53 (b) the run cannot be closed: the original error comes out, RUN_FINISHED is not written, the lock stays, the next say recovers", async (t) => {
  // The number of the write of RUN_FINISHED is measured on a run of the same command
  // with the acceptance error alone, not guessed.
  const probe = setup(t, PLAN_FILE);
  const probeLines = journal(probe.p).length;
  const failAccept = {
    fn: "writeFileSync",
    paths: [partialOf(probe.p)],
    effect: "bug",
  };
  const clean = runCommand(["run-task", probe.p.id, probe.p.task], probe.env, [
    failAccept,
  ]);
  const cleanEvents = journal(probe.p).slice(probeLines);
  const at = types(cleanEvents).indexOf("RUN_FINISHED");
  assert.ok(at > 2, "RUN_FINISHED follows TASK_STARTED, RUN_STARTED, activity");
  assert.equal(
    clean.stderr,
    "E_INTERNAL: Внутренняя ошибка ядра Sai Team (TypeError)\n",
  );
  assert.equal(fs.existsSync(path.join(probe.p.dir, "writer.lock")), false);

  const { sb, p, env } = setup(t, PLAN_FILE);
  const lines = journal(p).length;
  const r = runCommand(["run-task", p.id, p.task], env, [
    { ...failAccept, paths: [partialOf(p)] },
    {
      fn: "writeSync",
      paths: [p.events],
      effect: "throw",
      code: "EIO",
      nth: at + 1,
    },
  ]);
  assert.notEqual(r.status, 0, describeRun(r));
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, clean.stderr, "the text of the original error");
  assert.doesNotMatch(r.stderr, /E_DISK|EIO/u);
  assert.equal(lockOf(p).pid, r.pid);
  assertDead(r.pid);
  const events = journal(p).slice(lines);
  assert.equal(ofType(events, "RUN_FINISHED").length, 0);
  assert.equal(ofType(events, "TASK_FAILED").length, 0);
  assert.deepStrictEqual(types(events).slice(0, 2), [
    "TASK_STARTED",
    "RUN_STARTED",
  ]);
  assert.equal(events.length, at, "nothing after the failed write");
  assert.equal(fs.readFileSync(p.events).at(-1), 0x0a);
  await assertNoFakeProcess(t, sb);
  assertRecoveredBySay(sb, p, r.pid, lines + events.length);
});

test("EX-53 (c) a closing that is refused makes the writer broken: the original error goes up, the writer writes no more, close() leaves the lock", async (t) => {
  const { sb, p, env, config } = setup(t, PLAN_FILE);
  const writer = openWriter(p.id, { home: sb.home });
  t.after(() => writer.close());
  const original = writer.append.bind(writer);
  t.mock.method(writer, "append", (input) => {
    if (input.type === "RUN_FINISHED") {
      throw new TeamError("E_TRANSITION", "мнимый отказ записи закрытия");
    }
    return original(input);
  });
  const fault = installFaults([
    { fn: "writeFileSync", paths: [partialOf(p)], effect: "bug" },
  ]);
  let caught = null;
  try {
    await withLimit(runTask(writer, "t-0001", { env, config }));
  } catch (err) {
    caught = err;
  } finally {
    fault.restore();
  }
  assert.deepStrictEqual(fault.fired(), [true]);
  assert.ok(caught instanceof TypeError, String(caught));
  assert.equal(
    caught.message.includes("мнимый"),
    false,
    "not the error of the closing",
  );
  assert.equal(writer.broken, true);
  assert.equal(ofType(journal(p), "RUN_FINISHED").length, 0);

  const bytes = sha256(fs.readFileSync(p.events));
  const folder = snapshot(p.dir);
  let refused = null;
  try {
    writer.say("После");
  } catch (err) {
    refused = err;
  }
  assert.ok(refused instanceof TeamError);
  assert.equal(refused.code, "E_WRITER_BROKEN");
  assert.deepStrictEqual(
    snapshot(p.dir),
    folder,
    "a refused write changes nothing",
  );

  const lockFile = path.join(p.dir, "writer.lock");
  const lockBytes = fs.readFileSync(lockFile);
  writer.close();
  assert.ok(
    fs.readFileSync(lockFile).equals(lockBytes),
    "the lock is as it was",
  );
  assert.equal(lockOf(p).pid, process.pid);
  assert.equal(sha256(fs.readFileSync(p.events)), bytes);
  assert.deepStrictEqual(snapshot(p.dir), folder);
  await assertNoFakeProcess(t, sb);
});
