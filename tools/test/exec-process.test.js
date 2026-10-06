// Tests of the processes of claude-cli: timeout, cancel, the process group, one process
// at a time, the settings of the timeout (design REQ-010, section 15.1: EX-22...EX-25,
// EX-46; criterion 7). Only the fake executable is started; every process that a test
// starts is checked to be gone at its end.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { readConfig } from "../src/team/config.js";
import { getExecutor } from "../src/team/executor.js";
import { FAIL_DETAIL } from "../src/team/language.js";
import { failDetailFor } from "../src/team/runner.js";
import {
  describeRun,
  execEnv,
  fakeChildren,
  fakeEnds,
  fakeLog,
  fakeStarts,
  ioFor,
  journal,
  killQuietly,
  makeProject,
  makeSandbox,
  ofType,
  pidAlive,
  requestFor,
  runTeam,
  sha256,
  spawnTeam,
  stateOf,
  types,
  waitUntil,
  writePlan,
  withLimit,
} from "./exec-helpers.js";

const HANG = {
  stream: "stream-no-result.jsonl",
  spawn_child: true,
  hang: true,
};

async function allGone(sb) {
  const pids = [
    ...fakeStarts(sb).map((e) => e.pid),
    ...fakeChildren(sb).map((e) => e.pid),
  ];
  for (const pid of pids) {
    const gone = await waitUntil(() => !pidAlive(pid), 3000);
    if (!gone) killQuietly(pid);
    assert.ok(gone, `process ${pid} is still alive`);
  }
  return pids;
}

test("EX-22 a timeout stops the process and its child: run() returns, nothing is left", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: HANG });
  const p = makeProject(sb);
  const request = requestFor(sb, p.id);
  // 3000 ms, not 1000: under load the fake file may need a second to start and write
  // the pid of its child; the point (a timeout stops both) is unchanged.
  request.limits.timeout_ms = 3000;
  const io = ioFor(sb);
  const began = Date.now();
  let res;
  try {
    res = await withLimit(getExecutor("claude-cli").run(request, io));
  } finally {
    for (const e of fakeLog(sb)) if (e.pid) killQuietly(e.pid);
  }
  const took = Date.now() - began;
  assert.equal(res.outcome, "timeout");
  assert.equal(res.transient, true);
  assert.equal(res.spawned, true);
  assert.equal(res.detail, FAIL_DETAIL.timeout);
  assert.ok(took >= 2700 && took < 15000, `took ${took} ms`);
  const pids = [
    ...fakeStarts(sb).map((e) => e.pid),
    ...fakeChildren(sb).map((e) => e.pid),
  ];
  assert.equal(pids.length, 2, "the fake file and its child");
});

test("EX-22 the whole task with a timeout: three timeouts, no process of any attempt remains", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: HANG });
  const p = makeProject(sb);
  const r = runTeam(
    ["run-task", p.id, p.task],
    execEnv(sb, { SAI_TEAM_TASK_TIMEOUT_MS: "3000" }),
  );
  try {
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(
      r.stderr,
      "E_TASK_FAILED: Задача не получилась: Задача заняла слишком много времени\n",
    );
    const events = journal(p);
    const finished = ofType(events, "RUN_FINISHED");
    assert.equal(finished.length, 3);
    for (const e of finished) assert.equal(e.data.outcome, "timeout");
    const failed = ofType(events, "TASK_FAILED");
    assert.equal(failed[0].data.reason, "retries_exhausted");
    assert.equal(failed[0].data.detail, "Задача заняла слишком много времени");
    const pids = await allGone(sb);
    assert.equal(pids.length, 6);
  } finally {
    for (const e of fakeLog(sb)) if (e.pid) killQuietly(e.pid);
  }
});

test("EX-22 failDetailFor: a group that did not go wins over the outcome", () => {
  assert.equal(
    failDetailFor({ outcome: "timeout", detail: FAIL_DETAIL.group }),
    "group",
  );
  assert.equal(failDetailFor({ outcome: "timeout" }), "timeout");
  assert.equal(
    failDetailFor({ outcome: "failed", detail: FAIL_DETAIL.group }),
    "group",
  );
  assert.equal(
    failDetailFor({ outcome: "cancelled", detail: FAIL_DETAIL.group }),
    "group",
  );
  assert.equal(failDetailFor({ outcome: "failed" }), "failed");
  assert.equal(failDetailFor({ outcome: "network" }), "network");
  assert.equal(failDetailFor({ outcome: "not_found" }), "not_found");
  assert.equal(
    failDetailFor({ outcome: "invalid_output", detail: FAIL_DETAIL.schema }),
    "schema",
  );
  assert.equal(
    failDetailFor({ outcome: "invalid_output", detail: FAIL_DETAIL.too_big }),
    "too_big",
  );
  assert.equal(
    failDetailFor({
      outcome: "invalid_output",
      detail: FAIL_DETAIL.invalid_output,
    }),
    "invalid_output",
  );
});

test("EX-23 SIGTERM to run-task: the task is interrupted, no process is left, exit is not 0", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: HANG });
  const p = makeProject(sb);
  const { child, done } = spawnTeam(["run-task", p.id, p.task], execEnv(sb));
  try {
    const started = await waitUntil(() => fakeChildren(sb).length >= 1, 15_000);
    assert.ok(started, "the fake file did not start its child");
    child.kill("SIGTERM");
    const r = await done;
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, "E_TASK_CANCELLED: Задача прервана\n");
    const events = journal(p);
    const interrupted = ofType(events, "TASK_INTERRUPTED");
    assert.equal(interrupted.length, 1);
    assert.deepEqual(interrupted[0].data, { cause: "cancel" });
    const finished = ofType(events, "RUN_FINISHED");
    assert.equal(finished.length, 1);
    assert.equal(finished[0].data.outcome, "cancelled");
    assert.equal(stateOf(sb, p.id).tasks[0].status, "interrupted");
    assert.equal(fakeStarts(sb).length, 1, "no new attempt after a cancel");
    const pids = await allGone(sb);
    assert.equal(pids.length, 2);
  } finally {
    for (const e of fakeLog(sb)) if (e.pid) killQuietly(e.pid);
    child.kill("SIGKILL");
  }
});

test("EX-24 three attempts (failure, failure, success): never two processes at once", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    runs: [
      { stream: "stream-error.jsonl", exit: 1 },
      { stream: "stream-error.jsonl", exit: 1 },
      { stream: "stream-ok.jsonl", set_cost: 0.05 },
    ],
  });
  const p = makeProject(sb);
  const r = runTeam(
    ["run-task", p.id, p.task],
    execEnv(sb, { SAI_TEAM_RETRY_DELAY_MS: "50" }),
  );
  try {
    assert.equal(r.status, 0, describeRun(r));
    const starts = fakeStarts(sb);
    const ends = fakeEnds(sb);
    assert.equal(starts.length, 3);
    assert.equal(ends.length, 3);
    for (let n = 0; n < 2; n += 1) {
      assert.ok(
        ends[n].t <= starts[n + 1].t,
        `attempt ${n + 1} ended at ${ends[n].t}, the next started at ${starts[n + 1].t}`,
      );
    }
    const events = journal(p);
    assert.equal(ofType(events, "TASK_RETRY").length, 2);
    await allGone(sb);
    // The journal does not overlap either: RUN_STARTED only after the previous RUN_FINISHED.
    let open = 0;
    for (const e of events) {
      if (e.type === "RUN_STARTED") open += 1;
      if (e.type === "RUN_FINISHED") open -= 1;
      assert.ok(open >= 0 && open <= 1);
    }
    assert.equal(open, 0);
  } finally {
    for (const e of fakeLog(sb)) if (e.pid) killQuietly(e.pid);
  }
});

test("EX-25 the timeout of a task: default 20 minutes, bad values are E_CONFIG", () => {
  assert.equal(readConfig({}).taskTimeoutMs, 1_200_000);
  assert.equal(
    readConfig({ SAI_TEAM_TASK_TIMEOUT_MS: "1000" }).taskTimeoutMs,
    1000,
  );
  assert.equal(
    readConfig({ SAI_TEAM_TASK_TIMEOUT_MS: "86400000" }).taskTimeoutMs,
    86_400_000,
  );
  for (const bad of [
    "999",
    "x",
    "86400001",
    "1.5",
    "-5",
    "",
    "1e4",
    " 1000",
    "0",
  ]) {
    assert.throws(
      () => readConfig({ SAI_TEAM_TASK_TIMEOUT_MS: bad }),
      (err) =>
        err.code === "E_CONFIG" &&
        err.message === "Неверная настройка SAI_TEAM_TASK_TIMEOUT_MS",
      JSON.stringify(bad),
    );
  }
  assert.equal(readConfig({}).retryDelayMs, 10_000);
  assert.equal(readConfig({ SAI_TEAM_RETRY_DELAY_MS: "0" }).retryDelayMs, 0);
  assert.equal(
    readConfig({ SAI_TEAM_RETRY_DELAY_MS: "600000" }).retryDelayMs,
    600_000,
  );
  for (const bad of ["-1", "x", "600001", "", "1.5"]) {
    assert.throws(
      () => readConfig({ SAI_TEAM_RETRY_DELAY_MS: bad }),
      (err) =>
        err.code === "E_CONFIG" &&
        err.message === "Неверная настройка SAI_TEAM_RETRY_DELAY_MS",
      JSON.stringify(bad),
    );
  }
});

test("EX-25 a bad timeout on the command line: E_CONFIG, exit 2, nothing written, nothing started", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-ok.jsonl" } });
  const p = makeProject(sb);
  const before = sha256(fs.readFileSync(p.events));
  for (const [name, value] of [
    ["SAI_TEAM_TASK_TIMEOUT_MS", "999"],
    ["SAI_TEAM_TASK_TIMEOUT_MS", "x"],
    ["SAI_TEAM_RETRY_DELAY_MS", "700000"],
  ]) {
    const r = runTeam(
      ["run-task", p.id, p.task],
      execEnv(sb, { [name]: value }),
    );
    assert.equal(r.status, 2, describeRun(r));
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, `E_CONFIG: Неверная настройка ${name}\n`);
    assert.doesNotMatch(
      r.stderr,
      new RegExp(value === "x" ? "=x" : value, "u"),
    );
    assert.equal(sha256(fs.readFileSync(p.events)), before);
    assert.equal(fakeStarts(sb).length, 0);
  }
});

test("EX-46 a cancel during the pause between attempts: interrupted, no open run, no new process", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    default: { stream: "stream-error.jsonl", set_cost: 0.01, exit: 1 },
  });
  const p = makeProject(sb);
  const { child, done } = spawnTeam(
    ["run-task", p.id, p.task],
    execEnv(sb, { SAI_TEAM_RETRY_DELAY_MS: "60000" }),
  );
  try {
    const waiting = await waitUntil(
      () => fs.existsSync(p.events) && types(journal(p)).includes("TASK_RETRY"),
      15_000,
    );
    assert.ok(waiting, "the retry was not announced");
    const began = Date.now();
    child.kill("SIGTERM");
    const r = await done;
    assert.ok(Date.now() - began < 10_000, "the cancel waited for the pause");
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.stderr, "E_TASK_CANCELLED: Задача прервана\n");
    const events = journal(p);
    const interrupted = ofType(events, "TASK_INTERRUPTED");
    assert.equal(interrupted.length, 1);
    assert.deepEqual(interrupted[0].data, { cause: "cancel" });
    assert.equal(
      ofType(events, "RUN_STARTED").length,
      ofType(events, "RUN_FINISHED").length,
      "an open run",
    );
    assert.equal(ofType(events, "RUN_STARTED").length, 1);
    assert.equal(
      fakeStarts(sb).length,
      1,
      "a new process started after the cancel",
    );
    assert.equal(stateOf(sb, p.id).tasks[0].status, "interrupted");
    assert.equal(ofType(events, "TASK_FAILED").length, 0);
  } finally {
    child.kill("SIGKILL");
  }
});
