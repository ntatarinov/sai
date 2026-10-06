// Tests of the retries of a task: pause, count, timeouts and network failures (design
// REQ-010, section 15.1: EX-26...EX-29; criteria 8 and 9). claude-cli runs against
// the fake executable, scripted against the scenario of the fixtures.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { roleByCode } from "../src/team/roles.js";
import {
  FIXTURES,
  argAfter,
  describeRun,
  execEnv,
  fakeStarts,
  journal,
  makeProject,
  makeSandbox,
  ms,
  ofType,
  runTeam,
  stateOf,
  writePlan,
} from "./exec-helpers.js";

const FLAKY = fs.readFileSync(path.join(FIXTURES, "scenario-flaky.json"));

function run(sb, p, over = {}) {
  return runTeam(["run-task", p.id, p.task], execEnv(sb, over));
}

const phrasesOf = (sb, p) =>
  JSON.parse(runTeam(["events", p.id, "--limit", "200"], execEnv(sb)).stdout)
    .events;

test("EX-26 claude-cli, costs reported: three runs, two retries after a pause, the ceiling of each run is a quarter", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    runs: [
      { stream: "stream-error.jsonl", set_cost: 0.05, exit: 1 },
      { stream: "stream-error.jsonl", set_cost: 0.05, exit: 1 },
      { stream: "stream-ok.jsonl", set_cost: 0.05 },
    ],
  });
  const p = makeProject(sb);
  const r = run(sb, p, { SAI_TEAM_RETRY_DELAY_MS: "200" });
  assert.equal(r.status, 0, describeRun(r));
  const events = journal(p);
  const started = ofType(events, "RUN_STARTED");
  assert.deepEqual(
    started.map((e) => e.data.max_budget_usd),
    [0.25, 0.25, 0.25],
  );
  const retry = ofType(events, "TASK_RETRY");
  assert.equal(retry.length, 2);
  for (const e of retry) {
    assert.equal(e.data.reason, "failed");
    assert.equal(e.data.delay_ms, 200);
  }
  assert.deepEqual(
    retry.map((e) => e.data.next_attempt),
    [2, 3],
  );
  const spent = ofType(events, "BUDGET_SPENT");
  assert.equal(spent.length, 3);
  for (const e of spent) assert.equal(e.data.accounted, "reported");
  assert.equal(stateOf(sb, p.id).tasks[0].attempts, 3);
  assert.equal(stateOf(sb, p.id).tasks[0].status, "review");
  const finished = ofType(events, "RUN_FINISHED");
  for (let i = 0; i < 2; i += 1) {
    const gap = ms(started[i + 1].ts) - ms(finished[i].ts);
    assert.ok(gap >= 195, `pause before attempt ${i + 2}: ${gap} ms`);
  }
  assert.equal(fakeStarts(sb).length, 3);
});

test("EX-26 the pause is the configured one (0 ms is no pause, 500 ms is a pause)", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    runs: [
      { stream: "stream-error.jsonl", set_cost: 0.01, exit: 1 },
      { stream: "stream-ok.jsonl", set_cost: 0.01 },
    ],
  });
  const p = makeProject(sb);
  const r = run(sb, p, { SAI_TEAM_RETRY_DELAY_MS: "500" });
  assert.equal(r.status, 0, describeRun(r));
  const events = journal(p);
  const retry = ofType(events, "TASK_RETRY")[0];
  assert.equal(retry.data.delay_ms, 500);
  const gap =
    ms(ofType(events, "RUN_STARTED")[1].ts) -
    ms(ofType(events, "RUN_FINISHED")[0].ts);
  assert.ok(gap >= 495, `${gap} ms`);
});

test("EX-26 claude-cli, costs not reported: each run is charged with its own ceiling, accounted assumed", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    runs: [
      { stream: "stream-no-result.jsonl", exit: 1 },
      { stream: "stream-no-result.jsonl", exit: 1 },
      { stream: "stream-ok.jsonl", set_cost: 0.05 },
    ],
  });
  const p = makeProject(sb);
  const r = run(sb, p, { SAI_TEAM_RETRY_DELAY_MS: "10" });
  assert.equal(r.status, 0, describeRun(r));
  const events = journal(p);
  const spent = ofType(events, "BUDGET_SPENT");
  assert.deepEqual(
    spent.map((e) => [e.data.cost_usd, e.data.accounted]),
    [
      [0.25, "assumed"],
      [0.25, "assumed"],
      [0.05, "reported"],
    ],
  );
  const third = fakeStarts(sb)[2].argv;
  assert.equal(argAfter(third, "--max-budget-usd"), "0.25");
  assert.equal(stateOf(sb, p.id).tasks[0].status, "review");
});

test("EX-26 the same retries with scripted: flaky scenario, three runs, two retries", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb, { executor: "scripted", scenario_bytes: FLAKY });
  const r = run(sb, p, { SAI_TEAM_RETRY_DELAY_MS: "50" });
  assert.equal(r.status, 0, describeRun(r));
  const events = journal(p);
  assert.equal(ofType(events, "RUN_STARTED").length, 3);
  assert.equal(ofType(events, "TASK_RETRY").length, 2);
  assert.deepEqual(
    ofType(events, "RUN_FINISHED").map((e) => e.data.outcome),
    ["failed", "failed", "ok"],
  );
  assert.equal(stateOf(sb, p.id).tasks[0].status, "review");
  assert.equal(fakeStarts(sb).length, 0, "scripted starts no process");
});

test("EX-27 an executor that always fails: exactly three runs, then TASK_FAILED, exit 1", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-error.jsonl", exit: 1 } });
  const p = makeProject(sb);
  const r = run(sb, p, { SAI_TEAM_RETRY_DELAY_MS: "123" });
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(r.stdout, "");
  assert.equal(
    r.stderr,
    "E_TASK_FAILED: Задача не получилась: Исполнитель завершился с ошибкой\n",
  );
  const events = journal(p);
  assert.equal(ofType(events, "RUN_STARTED").length, 3);
  assert.equal(ofType(events, "RUN_FINISHED").length, 3);
  const retry = ofType(events, "TASK_RETRY");
  assert.equal(retry.length, 2);
  for (const e of retry) assert.equal(e.data.delay_ms, 123);
  const failed = ofType(events, "TASK_FAILED");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].data.reason, "retries_exhausted");
  assert.equal(failed[0].data.detail, "Исполнитель завершился с ошибкой");
  assert.equal(fakeStarts(sb).length, 3);
  assert.equal(stateOf(sb, p.id).tasks[0].status, "failed");
  assert.equal(stateOf(sb, p.id).tasks[0].attempts, 3);
  // The last event of the journal is the failure: nothing after it.
  assert.equal(events.at(-1).type, "TASK_FAILED");
});

test("EX-27 a failed task can be started again and gets three more runs", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-error.jsonl", exit: 1 } });
  const p = makeProject(sb);
  assert.equal(run(sb, p).status, 1);
  assert.equal(fakeStarts(sb).length, 3);
  assert.equal(run(sb, p).status, 1);
  assert.equal(fakeStarts(sb).length, 6);
  assert.equal(ofType(journal(p), "RUN_STARTED").length, 6);
});

test("EX-28 claude-cli: a timeout is a temporary failure; two timeouts, then a success", (t) => {
  const sb = makeSandbox(t);
  const hang = { stream: "stream-no-result.jsonl", hang: true };
  writePlan(sb, {
    runs: [hang, hang, { stream: "stream-ok.jsonl", set_cost: 0.1 }],
  });
  const p = makeProject(sb);
  const r = run(sb, p, {
    SAI_TEAM_TASK_TIMEOUT_MS: "1000",
    SAI_TEAM_RETRY_DELAY_MS: "10",
  });
  assert.equal(r.status, 0, describeRun(r));
  const events = journal(p);
  assert.deepEqual(
    ofType(events, "RUN_FINISHED").map((e) => e.data.outcome),
    ["timeout", "timeout", "ok"],
  );
  const spent = ofType(events, "BUDGET_SPENT");
  assert.deepEqual(
    spent.map((e) => [e.data.cost_usd, e.data.accounted]),
    [
      [0.25, "assumed"],
      [0.25, "assumed"],
      [0.1, "reported"],
    ],
  );
  const retry = ofType(events, "TASK_RETRY");
  assert.equal(retry.length, 2);
  for (const e of retry) assert.equal(e.data.reason, "timeout");
  const started = ofType(events, "RUN_STARTED");
  assert.equal(started[2].data.max_budget_usd, 0.25);
  assert.equal(stateOf(sb, p.id).spent_usd, 0.6);
  assert.equal(stateOf(sb, p.id).tasks[0].status, "review");
  assert.equal(fakeStarts(sb).length, 3);
});

test("EX-29 a network failure of the Researcher: three runs, the phrases say what happened and promise a retry only when it comes", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-web-error.jsonl", exit: 1 } });
  const p = makeProject(sb, { role: "researcher" });
  const r = run(sb, p, { SAI_TEAM_RETRY_DELAY_MS: "10" });
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(r.stdout, "");
  assert.equal(
    r.stderr,
    "E_TASK_FAILED: Задача не получилась: Нет доступа к сети\n",
  );
  assert.doesNotMatch(r.stderr, /\n\s+at /u);
  const events = journal(p);
  const finished = ofType(events, "RUN_FINISHED");
  assert.equal(finished.length, 3);
  for (const e of finished) assert.equal(e.data.outcome, "network");
  const retry = ofType(events, "TASK_RETRY");
  assert.equal(retry.length, 2, "the third retry must not be announced");
  for (const e of retry) assert.equal(e.data.reason, "network");
  const failed = ofType(events, "TASK_FAILED");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].data.reason, "retries_exhausted");
  assert.equal(failed[0].data.detail, "Нет доступа к сети");
  const name = roleByCode("researcher").name;
  const view = phrasesOf(sb, p);
  for (const e of view.filter((x) => x.type === "RUN_FINISHED")) {
    assert.equal(e.phrase, "Нет доступа к сети");
  }
  for (const e of view.filter((x) => x.type === "TASK_RETRY")) {
    assert.equal(e.phrase, `${name} попробует ещё раз`);
  }
  const last = view.filter((x) => x.type === "TASK_FAILED");
  assert.equal(last.length, 1);
  assert.equal(
    last[0].phrase,
    `${name}: нет доступа к сети, задача не получилась`,
  );
  for (const e of view) {
    if (e.type !== "TASK_RETRY")
      assert.doesNotMatch(e.phrase, /попробу/u, e.type);
  }
  assert.equal(fakeStarts(sb).length, 3);
  assert.equal(stateOf(sb, p.id).tasks[0].status, "failed");
});

test("EX-29 an error of a tool that is not a network tool is not a network failure", (t) => {
  const sb = makeSandbox(t);
  // stream-error ends with an error result and no web tool: outcome failed.
  writePlan(sb, { default: { stream: "stream-error.jsonl", exit: 1 } });
  const p = makeProject(sb, { role: "researcher" });
  assert.equal(run(sb, p, { SAI_TEAM_RETRY_DELAY_MS: "0" }).status, 1);
  const events = journal(p);
  for (const e of ofType(events, "RUN_FINISHED"))
    assert.equal(e.data.outcome, "failed");
  assert.equal(
    ofType(events, "TASK_FAILED")[0].data.detail,
    "Исполнитель завершился с ошибкой",
  );
});
