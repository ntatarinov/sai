// Tests of the ceiling of cost and the accounting of the spent sum (design REQ-010,
// section 15.1: EX-31...EX-34, EX-47, EX-50; criteria 8 and 11). Only the fake
// executable is started.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readConfig } from "../src/team/config.js";
import { TeamError } from "../src/team/errors.js";
import { checkBudget, getExecutor, runCapFor } from "../src/team/executor.js";
import { ceil6, floor6, maxBudgetFor, round6 } from "../src/team/runner.js";
import {
  TEAM_SRC,
  argAfter,
  describeRun,
  execEnv,
  fakeStarts,
  ioFor,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  requestFor,
  runTeam,
  sha256,
  snapshot,
  stateOf,
  types,
  writePlan,
  withLimit,
} from "./exec-helpers.js";
import { roleByCode } from "../src/team/roles.js";

function run(sb, p, over = {}, task = p.task) {
  return runTeam(["run-task", p.id, task], execEnv(sb, over));
}

test("EX-31 the spent sum grows with every run; the ceiling of a run is the rest (SAI_TEAM_RUN_CAP_USD=1)", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    runs: [
      { stream: "stream-error.jsonl", set_cost: 0.3, exit: 1 },
      { stream: "stream-error.jsonl", set_cost: 0.3, exit: 1 },
      { stream: "stream-ok.jsonl", set_cost: 0.3 },
    ],
  });
  const p = makeProject(sb);
  const r = run(sb, p, { SAI_TEAM_RUN_CAP_USD: "1" });
  assert.equal(r.status, 0, describeRun(r));
  const events = journal(p);
  assert.deepEqual(
    ofType(events, "BUDGET_SPENT").map((e) => e.data.total_usd),
    [0.3, 0.6, 0.9],
  );
  assert.deepEqual(
    fakeStarts(sb).map((s) => argAfter(s.argv, "--max-budget-usd")),
    ["1", "0.7", "0.4"],
  );
  assert.deepEqual(
    ofType(events, "RUN_STARTED").map((e) => e.data.max_budget_usd),
    [1, 0.7, 0.4],
  );
  assert.equal(stateOf(sb, p.id).spent_usd, 0.9);
});

test("EX-32 no rest: E_BUDGET_EXHAUSTED, one RUN_REFUSED line, nothing else changes, no process", (t) => {
  const sb = makeSandbox(t);
  // The first task spends the whole ceiling and fails (a task left "on review" would be
  // closed as interrupted by the recovery of the next writer: see the report).
  writePlan(sb, {
    default: { stream: "stream-error.jsonl", set_cost: 1, exit: 1 },
  });
  const p = makeProject(sb, { tasks: 2 });
  const first = run(sb, p, { SAI_TEAM_RUN_CAP_USD: "1" });
  assert.equal(first.status, 1, describeRun(first));
  assert.equal(stateOf(sb, p.id).spent_usd, 1);
  assert.equal(fakeStarts(sb).length, 1);

  const second = "t-0002";
  const before = fs.readFileSync(p.events);
  const projectStatus = stateOf(sb, p.id).status;
  const r = run(sb, p, {}, second);
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(r.stdout, "");
  assert.equal(
    r.stderr,
    "E_BUDGET_EXHAUSTED: Потолок расходов проекта исчерпан: запуск не начат\n",
  );
  assert.equal(fakeStarts(sb).length, 1, "a process was started");
  const after = fs.readFileSync(p.events);
  assert.ok(
    after.subarray(0, before.length).equals(before),
    "the old lines changed",
  );
  const oldCount = before.toString("utf8").split("\n").length - 1;
  const added = journal(p).slice(oldCount);
  assert.deepEqual(types(added), ["RUN_REFUSED"]);
  assert.equal(added[0].data.reason, "budget_exhausted");
  assert.equal(stateOf(sb, p.id).tasks[1].status, "waiting");
  assert.equal(stateOf(sb, p.id).status, projectStatus);
  assert.equal(stateOf(sb, p.id).spent_usd, 1);
  assert.equal(ofType(journal(p), "TASK_STARTED").length, 1);

  // Without the switch the earlier condition wins: the journal does not change at all.
  const frozen = sha256(fs.readFileSync(p.events));
  const off = run(sb, p, { SAI_TEAM_REAL_RUNS: undefined }, second);
  assert.equal(off.status, 1, describeRun(off));
  assert.ok(off.stderr.startsWith("E_REAL_RUNS_OFF: "), off.stderr);
  assert.equal(sha256(fs.readFileSync(p.events)), frozen);
});

test("EX-32 a direct run() with no rest: E_BUDGET_EXHAUSTED and run() writes nothing", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    default: { stream: "stream-error.jsonl", set_cost: 1, exit: 1 },
  });
  const p = makeProject(sb, { tasks: 2 });
  assert.equal(run(sb, p, { SAI_TEAM_RUN_CAP_USD: "1" }).status, 1);
  const tree = snapshot(p.dir);
  const request = requestFor(sb, p.id);
  request.task = { id: "t-0002", text: "x", done_when: "y" };
  request.role = roleByCode("researcher");
  assert.equal(request.project.spent_usd, 1);
  const io = ioFor(sb);
  await assert.rejects(
    () => withLimit(getExecutor("claude-cli").run(request, io)),
    (err) => err instanceof TeamError && err.code === "E_BUDGET_EXHAUSTED",
  );
  assert.equal(io.events.length, 0);
  assert.equal(fakeStarts(sb).length, 1);
  assert.deepEqual(snapshot(p.dir), tree);
});

test("EX-33 a run without a cost line is charged with the ceiling of that run, not with the whole rest", (t) => {
  const sb = makeSandbox(t);
  // (a) the result line has no total_cost_usd.
  writePlan(sb, { default: { stream: "stream-no-cost.jsonl" } });
  const a = makeProject(sb);
  assert.equal(run(sb, a).status, 0);
  const spentA = ofType(journal(a), "BUDGET_SPENT");
  assert.equal(spentA.length, 1);
  assert.deepEqual(
    [
      spentA[0].data.cost_usd,
      spentA[0].data.accounted,
      spentA[0].data.total_usd,
    ],
    [0.25, "assumed", 0.25],
  );
  assert.equal(ofType(journal(a), "RUN_FINISHED")[0].data.cost_usd, null);
  // (b) a timeout.
  writePlan(sb, { default: { stream: "stream-no-result.jsonl", hang: true } });
  const b = makeProject(sb);
  assert.equal(run(sb, b, { SAI_TEAM_TASK_TIMEOUT_MS: "1000" }).status, 1);
  const spentB = ofType(journal(b), "BUDGET_SPENT");
  assert.equal(spentB.length, 3);
  assert.deepEqual(
    [
      spentB[0].data.cost_usd,
      spentB[0].data.accounted,
      spentB[0].data.total_usd,
    ],
    [0.25, "assumed", 0.25],
  );
  assert.equal(
    spentB[0].data.cost_usd,
    ofType(journal(b), "RUN_STARTED")[0].data.max_budget_usd,
  );
  assert.deepEqual(
    spentB.map((e) => e.data.total_usd),
    [0.25, 0.5, 0.75],
  );
});

test("EX-33 scripted without cost_usd: assumed, the ceiling of the run; with a ceiling of 0 the charge is 0 but still assumed", (t) => {
  const sb = makeSandbox(t);
  const scenario = Buffer.from(
    JSON.stringify({
      version: 1,
      runs: [
        {
          match: {},
          steps: [],
          result: { outcome: "ok", answer: { summary: "Итог", files: [] } },
        },
      ],
    }),
  );
  const a = makeProject(sb, { executor: "scripted", scenario_bytes: scenario });
  assert.equal(run(sb, a).status, 0);
  assert.deepEqual(
    ofType(journal(a), "BUDGET_SPENT").map((e) => [
      e.data.cost_usd,
      e.data.accounted,
    ]),
    [[0.25, "assumed"]],
  );
  const b = makeProject(sb, {
    executor: "scripted",
    scenario_bytes: scenario,
    budget_usd: 0,
  });
  assert.equal(run(sb, b).status, 0);
  assert.deepEqual(
    ofType(journal(b), "BUDGET_SPENT").map((e) => [
      e.data.cost_usd,
      e.data.accounted,
    ]),
    [[0, "assumed"]],
  );
  assert.equal(ofType(journal(b), "RUN_STARTED")[0].data.max_budget_usd, null);
});

test("EX-33 the README states the rule of a run without a cost", () => {
  const text = fs.readFileSync(
    path.join(TEAM_SRC, "..", "..", "README.md"),
    "utf8",
  );
  const at = text.indexOf("## Sai Team — исполнители");
  const section = text.slice(at);
  assert.match(section, /по худшему случаю/u);
  assert.match(section, /accounted: assumed/u);
  assert.match(section, /не весь остаток/u);
});

test("EX-34 the code of Sai Team has no network module and no fetch", () => {
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else {
        const body = fs.readFileSync(abs, "utf8");
        assert.doesNotMatch(
          body,
          /node:(http|https|http2|net|tls|dgram|dns)\b|from\s+["'](http|https|net|tls|dgram|dns)["']/u,
          abs,
        );
        assert.doesNotMatch(body, /\bfetch\s*\(/u, abs);
        assert.doesNotMatch(body, /\bWebSocket\b|\bXMLHttpRequest\b/u, abs);
      }
    }
  };
  walk(TEAM_SRC);
});

test("EX-47 the rest is gone after the second run: no retry is announced, RUN_REFUSED and TASK_FAILED with the budget text", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    runs: [
      { stream: "stream-error.jsonl", set_cost: 0.6, exit: 1 },
      { stream: "stream-no-result.jsonl", hang: true },
    ],
  });
  const p = makeProject(sb);
  const r = run(sb, p, {
    SAI_TEAM_RUN_CAP_USD: "0.6",
    SAI_TEAM_TASK_TIMEOUT_MS: "1000",
    SAI_TEAM_RETRY_DELAY_MS: "10",
  });
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(
    r.stderr,
    "E_TASK_FAILED: Задача не получилась: Потолок расходов исчерпан: повтор не начат\n",
  );
  const events = journal(p);
  assert.deepEqual(
    ofType(events, "RUN_STARTED").map((e) => e.data.max_budget_usd),
    [0.6, 0.4],
  );
  assert.deepEqual(
    ofType(events, "BUDGET_SPENT").map((e) => [
      e.data.cost_usd,
      e.data.accounted,
      e.data.total_usd,
    ]),
    [
      [0.6, "reported", 0.6],
      [0.4, "assumed", 1],
    ],
  );
  const retry = ofType(events, "TASK_RETRY");
  assert.equal(
    retry.length,
    1,
    "only the retry after the first run is announced",
  );
  assert.equal(retry[0].data.reason, "failed");
  const afterSecond = types(events).slice(
    types(events).lastIndexOf("BUDGET_SPENT") + 1,
  );
  assert.deepEqual(afterSecond, ["RUN_REFUSED", "TASK_FAILED"]);
  const refused = ofType(events, "RUN_REFUSED")[0];
  assert.equal(refused.data.reason, "budget_exhausted");
  const failed = ofType(events, "TASK_FAILED")[0];
  assert.equal(failed.data.reason, "retries_exhausted");
  assert.equal(
    failed.data.detail,
    "Потолок расходов исчерпан: повтор не начат",
  );
  assert.equal(fakeStarts(sb).length, 2);
  const view = JSON.parse(
    runTeam(["events", p.id, "--limit", "200"], execEnv(sb)).stdout,
  ).events;
  assert.equal(
    view.find((e) => e.type === "TASK_FAILED").phrase,
    `${roleByCode("researcher").name}: потолок расходов исчерпан, задача остановлена`,
  );
  assert.equal(stateOf(sb, p.id).tasks[0].status, "failed");
});

test("EX-50 the ceiling of a run: a quarter of the project, the variable, the rest; the arithmetic of six digits", () => {
  const cfg = (over = {}) => ({ runCapUsd: null, ...over });
  assert.equal(runCapFor({ budget_usd: 1 }, cfg()), 0.25);
  assert.equal(runCapFor({ budget_usd: 1 }, cfg({ runCapUsd: 0.4 })), 0.4);
  assert.equal(runCapFor({ budget_usd: 0 }, cfg()), null);
  assert.equal(runCapFor({ budget_usd: 0 }, cfg({ runCapUsd: 0.4 })), null);
  assert.equal(maxBudgetFor({ budget_usd: 1, spent_usd: 0 }, cfg()), 0.25);
  assert.equal(
    maxBudgetFor({ budget_usd: 1, spent_usd: 0.9 }, cfg({ runCapUsd: 0.4 })),
    0.1,
  );
  assert.equal(maxBudgetFor({ budget_usd: 1, spent_usd: 0.9 }, cfg()), 0.1);
  assert.equal(maxBudgetFor({ budget_usd: 1, spent_usd: 1 }, cfg()), 0);
  assert.equal(maxBudgetFor({ budget_usd: 1, spent_usd: 7 }, cfg()), 0);
  assert.equal(maxBudgetFor({ budget_usd: 0, spent_usd: 0 }, cfg()), null);
  assert.equal(maxBudgetFor({ budget_usd: 0.000003, spent_usd: 0 }, cfg()), 0);
  assert.equal(maxBudgetFor({ budget_usd: 10, spent_usd: 0 }, cfg()), 2.5);
  assert.equal(floor6(0.7), 0.7);
  assert.equal(floor6(0.29), 0.29);
  assert.equal(floor6(0.00000075), 0);
  assert.equal(floor6(0.1234569), 0.123456);
  assert.equal(ceil6(0.1234561), 0.123457);
  assert.equal(ceil6(0.1 + 0.2), 0.3);
  assert.equal(round6(0.1 + 0.2), 0.3);
  assert.equal(round6(0.0000004), 0);
  assert.equal(round6(0.0000005), 0.000001);
});

test("EX-50 argv: a quarter by default, the variable when set, the rest when it is smaller; a tiny ceiling is refused", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-ok.jsonl", set_cost: 0.9 } });
  const a = makeProject(sb);
  assert.equal(run(sb, a).status, 0);
  assert.equal(argAfter(fakeStarts(sb)[0].argv, "--max-budget-usd"), "0.25");
  const b = makeProject(sb, { tasks: 2 });
  assert.equal(run(sb, b, { SAI_TEAM_RUN_CAP_USD: "0.4" }).status, 0);
  assert.equal(argAfter(fakeStarts(sb)[1].argv, "--max-budget-usd"), "0.4");
  // 0.9 is spent; the second task gets the rest 0.1, though the variable says 0.4.
  assert.equal(run(sb, b, { SAI_TEAM_RUN_CAP_USD: "0.4" }, "t-0002").status, 0);
  assert.equal(argAfter(fakeStarts(sb)[2].argv, "--max-budget-usd"), "0.1");
  // A ceiling of the project so small that a quarter of it rounds to 0.
  const c = makeProject(sb, { budget_usd: 0.000003 });
  const before = fakeStarts(sb).length;
  const r = run(sb, c);
  assert.equal(r.status, 1, describeRun(r));
  assert.ok(r.stderr.startsWith("E_BUDGET_EXHAUSTED: "), r.stderr);
  assert.equal(fakeStarts(sb).length, before);
  assert.deepEqual(types(journal(c)).slice(-1), ["RUN_REFUSED"]);
  assert.equal(ofType(journal(c), "TASK_STARTED").length, 0);
});

test("EX-50 SAI_TEAM_RUN_CAP_USD: the bounds and the form", (t) => {
  for (const bad of [
    "0",
    "0.009999",
    "0.000001",
    "-1",
    "x",
    "1e3",
    "1.1234567",
    "",
    "100000.01",
    "100001",
    " 1",
    "1 ",
  ]) {
    assert.throws(
      () => readConfig({ SAI_TEAM_RUN_CAP_USD: bad }),
      (err) =>
        err.code === "E_CONFIG" &&
        err.message === "Неверная настройка SAI_TEAM_RUN_CAP_USD",
      JSON.stringify(bad),
    );
  }
  assert.equal(readConfig({ SAI_TEAM_RUN_CAP_USD: "0.01" }).runCapUsd, 0.01);
  assert.equal(
    readConfig({ SAI_TEAM_RUN_CAP_USD: "100000" }).runCapUsd,
    100000,
  );
  assert.equal(readConfig({ SAI_TEAM_RUN_CAP_USD: "2.5" }).runCapUsd, 2.5);
  assert.equal(readConfig({}).runCapUsd, null);

  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-ok.jsonl" } });
  const p = makeProject(sb);
  const before = sha256(fs.readFileSync(p.events));
  for (const bad of [
    "0",
    "0.009999",
    "0.000001",
    "-1",
    "x",
    "1e3",
    "1.1234567",
    "",
  ]) {
    const r = run(sb, p, { SAI_TEAM_RUN_CAP_USD: bad });
    assert.equal(r.status, 2, `${JSON.stringify(bad)}: ${describeRun(r)}`);
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      "E_CONFIG: Неверная настройка SAI_TEAM_RUN_CAP_USD\n",
    );
    assert.equal(sha256(fs.readFileSync(p.events)), before);
  }
  assert.equal(fakeStarts(sb).length, 0);
});

test("EX-50 checkBudget: the rest and the ceiling of a run, with a tolerance of 1e-6", () => {
  const req = (budget, spent, max) => ({
    project: { budget_usd: budget, spent_usd: spent },
    limits: { max_budget_usd: max },
  });
  const refused = (r) =>
    assert.throws(
      () => checkBudget(r),
      (err) => err instanceof TeamError && err.code === "E_BUDGET_EXHAUSTED",
    );
  checkBudget(req(1, 0, 0.25));
  checkBudget(req(1, 0.75, 0.25));
  checkBudget(req(1, 0.75, 0.250001));
  checkBudget(req(0, 0, null));
  refused(req(1, 0.75, 0.2501));
  refused(req(1, 0, 0));
  refused(req(1, 0, 1e-6));
  refused(req(1, 0, null));
  refused(req(1, 0, -1));
  refused(req(1, 1, 0.25));
  refused(req(0, 0, 0.25));
});
