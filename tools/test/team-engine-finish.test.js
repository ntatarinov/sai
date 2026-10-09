// Sai Team engine: the end of a project — the check of the goal and the rounds of
// more tasks (design REQ-013, section 11; criterion 8: EN-45 ... EN-47). Only the
// scripted executor is started, after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { FIXTURES, journal, ofType, types } from "./exec-helpers.js";
import {
  ok,
  WORK_OK,
  PASS,
  GOAL_OK,
  scenarioRun,
  planRun,
  item,
  isQuestion,
  engineProject,
  startEngine,
  runToEnd,
  until,
  pauseAndExit,
  inputs,
} from "./team-engine-helpers.js";

// EN-47: PROJECT_DONE only after a GOAL_CHECK_RESULT passed (any journal).
function doneOnlyAfterGoal(events) {
  let passed = false;
  for (const e of events) {
    if (e.type === "GOAL_CHECK_RESULT") passed = e.data.passed === true;
    if (e.type === "PROJECT_DONE") assert.ok(passed, `seq ${e.seq}`);
  }
}

// ---- EN-45 -----------------------------------------------------------------------

test(
  "EN-45 the goal check passed: PROJECT_DONE right after it",
  { timeout: 60_000 },
  async (t) => {
    const runs = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, "engine-basic.json"), "utf8"),
    ).runs;
    for (const r of runs) assert.equal(typeof r.result.cost_usd, "number");
    const p = engineProject(t, runs);
    const result = await runToEnd(p);
    assert.deepStrictEqual(result, {
      status: "done",
      status_text: "выполнен",
      notices: [],
    });
    const events = journal(p);
    assert.deepStrictEqual(types(events).slice(-7), [
      "RUN_STARTED",
      "GOAL_CHECK_STARTED",
      "RESULT_FILE",
      "RUN_FINISHED",
      "BUDGET_SPENT",
      "GOAL_CHECK_RESULT",
      "PROJECT_DONE",
    ]);
    const goal = ofType(events, "GOAL_CHECK_RESULT")[0];
    assert.deepStrictEqual(goal.data.passed, true);
    assert.equal(goal.data.round, 0);
    const started = ofType(events, "GOAL_CHECK_STARTED")[0];
    assert.equal(started.data.run_id, goal.data.run_id);
    const run = ofType(events, "RUN_STARTED").find(
      (x) => x.data.run_id === goal.data.run_id,
    );
    assert.equal(run.data.purpose, "goal_check");
    assert.equal(run.data.role, "reviewer");
    doneOnlyAfterGoal(events);
  },
);

// ---- EN-46 -----------------------------------------------------------------------

test(
  "EN-46 the goal check fails: a round of more tasks (1), again (2), then PROJECT_WAITING goal_check_failed and a question",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")], [{ record_input: "plan.md" }]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun(
        { purpose: "goal_check" },
        ok({ passed: false, notes: "Нет вымышленного вывода для владельца" }),
      ),
    ]);
    const e = startEngine(t, p);
    await until(p, isQuestion, "the question");
    await pauseAndExit(e);
    const events = journal(p);
    assert.deepStrictEqual(
      ofType(events, "PLANNING_STARTED").map((x) => x.data.round),
      [0, 1, 2],
    );
    assert.deepStrictEqual(
      ofType(events, "GOAL_CHECK_RESULT").map((x) => [
        x.data.round,
        x.data.passed,
      ]),
      [
        [0, false],
        [1, false],
        [2, false],
      ],
    );
    assert.deepStrictEqual(
      ofType(events, "PROJECT_WAITING").map((x) => x.data.reason),
      ["goal_check_failed"],
    );
    const question = events.filter(isQuestion);
    assert.equal(question.length, 1);
    assert.equal(
      question[0].data.text,
      "Цель пока не достигнута после дополнительных задач. Добавьте указания и продолжите проект или остановите его",
    );
    assert.equal(ofType(events, "PROJECT_DONE").length, 0);
    const plans = inputs(p, "-plan.md");
    assert.equal(plans.length, 3);
    assert.ok(
      plans[1].includes(
        "Замечания сверки цели:\nНет вымышленного вывода для владельца",
      ),
    );
    assert.ok(plans[1].includes("Раунд плана: 1"));
    assert.equal(e.engine.state().tasks.length, 3);
  },
);

// ---- EN-47 -----------------------------------------------------------------------

test(
  "EN-47 in the journals of the engine no PROJECT_DONE comes without a passed goal check before it",
  { timeout: 60_000 },
  async (t) => {
    const passed = engineProject(t, [
      planRun([item("a"), item("b")]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    assert.equal((await runToEnd(passed)).status, "done");
    doneOnlyAfterGoal(journal(passed));
    // the same check is made after every test of the engine (engineProject)
    const broken = [{ seq: 1, type: "PROJECT_DONE", data: {} }];
    assert.throws(() => doneOnlyAfterGoal(broken));
  },
);
