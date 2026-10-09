// Sai Team engine: a task that fails and the answers of the user to it (design
// REQ-013, sections 8.2, 9; criterion 3: EN-20, EN-21). Only the scripted executor
// is started, after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { journal, ofType, sha256, withLimit } from "./exec-helpers.js";
import {
  WORK_OK,
  PASS,
  GOAL_OK,
  scenarioRun,
  planRun,
  item,
  isQuestion,
  engineProject,
  startEngine,
  until,
  pauseAndExit,
  rewriteScenario,
  inputs,
} from "./team-engine-helpers.js";

const FAILS_A = scenarioRun(
  { purpose: "work", task: "t-0001" },
  { outcome: "failed" },
);

// ---- EN-20 -----------------------------------------------------------------------

test(
  "EN-20 a task that always fails: after its retries TASK_FAILED, PROJECT_WAITING task_failed, one question; the independent task in work is brought to its result",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a"), item("b")]),
      FAILS_A,
      scenarioRun({ purpose: "work", task: "t-0002" }, WORK_OK, [
        { delay_ms: 600 },
      ]),
      scenarioRun({ purpose: "review" }, PASS),
    ]);
    const e = startEngine(t, p);
    await until(
      p,
      (x) => x.type === "TASK_REVIEW" && x.task === "t-0002",
      "the review of b",
    );
    await pauseAndExit(e);
    const events = journal(p);
    const a = events.filter((x) => x.task === "t-0001");
    assert.equal(ofType(a, "RUN_STARTED").length, 3, "1 + 2 retries");
    assert.equal(ofType(a, "TASK_RETRY").length, 2);
    const failed = ofType(a, "TASK_FAILED");
    assert.deepStrictEqual(
      failed.map((x) => x.data),
      [
        {
          reason: "retries_exhausted",
          detail: "Исполнитель завершился с ошибкой",
        },
      ],
    );
    const waiting = ofType(events, "PROJECT_WAITING");
    assert.deepStrictEqual(
      waiting.map((x) => [x.data.reason, x.task]),
      [["task_failed", "t-0001"]],
    );
    const questions = events.filter(isQuestion);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].task, "t-0001");
    assert.equal(
      questions[0].data.text,
      "Задача «Вымышленная задача a» не получилась: Исполнитель завершился с ошибкой. Изменить её или отклонить?",
    );
    assert.ok(waiting[0].seq > failed[0].seq);
    assert.equal(questions[0].seq, waiting[0].seq + 1);
    // b was in work when the project began to wait; it reached its result, and
    // nothing new began while the project waited
    const reviewOfB = events.find(
      (x) => x.type === "TASK_REVIEW" && x.task === "t-0002",
    );
    assert.ok(reviewOfB.seq > waiting[0].seq);
    assert.equal(
      events.filter((x) => x.type === "RUN_STARTED" && x.seq > waiting[0].seq)
        .length,
      0,
    );
    assert.equal(e.engine.state().status, "paused");
  },
);

// ---- EN-21 -----------------------------------------------------------------------

test(
  "EN-21 answer change --text: the task runs again and its input carries the text; approve is refused (E_ANSWER_KIND) and changes nothing",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [planRun([item("a")]), FAILS_A]);
    const e = startEngine(t, p);
    await until(p, isQuestion, "the question");
    const before = sha256(fs.readFileSync(p.events));
    await assert.rejects(
      e.engine.command({
        kind: "answer",
        args: { task: "t-0001", decision: "approve", text: null },
      }),
      (err) => err.code === "E_ANSWER_KIND",
    );
    assert.equal(sha256(fs.readFileSync(p.events)), before);
    rewriteScenario(p, [
      scenarioRun({ purpose: "work" }, WORK_OK, [{ record_input: "input.md" }]),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const decision = await e.engine.command({
      kind: "answer",
      args: {
        task: "t-0001",
        decision: "change",
        text: "Возьмите вымышленный прайс-лист поставщика Б",
      },
    });
    assert.equal(decision.type, "DECISION_RECEIVED");
    assert.equal(decision.source, "USER");
    const result = await withLimit(e.running);
    assert.equal(result.status, "done");
    const events = journal(p);
    const resumed = ofType(events, "PROJECT_RESUMED");
    assert.deepStrictEqual(
      resumed.map((x) => [x.source, x.data.after]),
      [["ENGINE", "decision"]],
    );
    const restart = events.find(
      (x) => x.type === "TASK_STARTED" && x.seq > decision.seq,
    );
    assert.equal(restart.task, "t-0001");
    const [input] = inputs(p, "-input.md");
    assert.ok(input.includes("Возьмите вымышленный прайс-лист поставщика Б"));
  },
);

test(
  "EN-21 answer reject: the task stays failed and the input of the next plan carries the refusal",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a"), item("b")], [{ record_input: "plan.md" }]),
      FAILS_A,
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const e = startEngine(t, p);
    await until(p, isQuestion, "the question");
    const decision = await e.engine.command({
      kind: "answer",
      args: { task: "t-0001", decision: "reject", text: null },
    });
    const result = await withLimit(e.running);
    assert.equal(result.status, "done");
    const events = journal(p);
    assert.equal(
      events.filter(
        (x) =>
          x.task === "t-0001" &&
          x.seq > decision.seq &&
          x.type.startsWith("TASK_"),
      ).length,
      0,
      "a rejected failed task does not change",
    );
    assert.equal(e.engine.state().tasks[0].status, "failed");
    assert.deepStrictEqual(
      ofType(events, "PLANNING_STARTED").map((x) => x.data.round),
      [0, 1],
    );
    const plans = inputs(p, "-plan.md");
    assert.equal(plans.length, 2);
    assert.equal(plans[0].includes("отклонена пользователем"), false);
    assert.match(
      plans[1],
      /Закрытые задачи после прошлого плана:\n— t-0001: Вымышленная задача a — отклонена пользователем/,
    );
  },
);
