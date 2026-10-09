// Sai Team engine: the check of a result by a separate run of the reviewer and the
// choice of another role (design REQ-013, section 8; criterion 5: EN-30 ... EN-32).
// Only the scripted executor is started, after assertSafeEnv.
import assert from "node:assert/strict";
import { test } from "node:test";
import { journal, ofType, types } from "./exec-helpers.js";
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

const FAIL_REVIEW = scenarioRun(
  { purpose: "review" },
  ok({ passed: false, notes: "Нет таблицы вымышленных цен" }),
);
const purposes = (events) =>
  ofType(events, "RUN_STARTED").reduce((acc, e) => {
    acc[e.data.purpose] = (acc[e.data.purpose] ?? 0) + 1;
    return acc;
  }, {});

// Every TASK_DONE by a review follows a passed REVIEW_RESULT of the same task after
// its last TASK_REVIEW, and that result came from a run of the reviewer that is not
// the run of the work.
function assertDoneOnlyAfterReview(events) {
  const lastReview = new Map();
  const passedSince = new Map();
  for (const e of events) {
    if (e.type === "TASK_REVIEW") {
      lastReview.set(e.task, e.seq);
      passedSince.set(e.task, false);
    }
    if (e.type === "REVIEW_RESULT" && e.data.passed) {
      passedSince.set(e.task, true);
    }
    if (e.type === "TASK_DONE" && e.data.via === "review") {
      assert.equal(
        passedSince.get(e.task),
        true,
        `TASK_DONE ${e.task} seq ${e.seq}`,
      );
    }
  }
}

// ---- EN-30 -----------------------------------------------------------------------

test(
  "EN-30 on review: a separate run of the reviewer with its own run_id, REVIEW_RESULT passed, then TASK_DONE; no TASK_DONE without a passed check",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a"), item("b", { depends_on: ["a"] })]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    assert.equal((await runToEnd(p)).status, "done");
    const events = journal(p);
    for (const task of ["t-0001", "t-0002"]) {
      const own = events.filter((e) => e.task === task);
      const work = ofType(own, "RUN_STARTED").find(
        (e) => e.data.purpose === "work",
      );
      const review = ofType(own, "RUN_STARTED").find(
        (e) => e.data.purpose === "review",
      );
      assert.equal(review.data.role, "reviewer");
      assert.notEqual(review.data.run_id, work.data.run_id);
      const result = ofType(own, "REVIEW_RESULT")[0];
      assert.equal(result.data.run_id, review.data.run_id);
      assert.equal(result.data.passed, true);
      const order = types(own).filter((x) =>
        ["TASK_REVIEW", "RUN_STARTED", "REVIEW_RESULT", "TASK_DONE"].includes(
          x,
        ),
      );
      assert.deepStrictEqual(order, [
        "RUN_STARTED",
        "TASK_REVIEW",
        "RUN_STARTED",
        "REVIEW_RESULT",
        "TASK_DONE",
      ]);
    }
    assertDoneOnlyAfterReview(events);
  },
);

// ---- EN-31 -----------------------------------------------------------------------

test(
  "EN-31 a result that never passes: 3 runs of the first role (2nd and 3rd with the notes), another role from the catalog, 3 more runs, then the question",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ record_input: "input.md" }]),
      FAIL_REVIEW,
      scenarioRun(
        { purpose: "reassign" },
        ok({ role: "financial_analyst", reason: "Нужен расчёт цен" }),
        [{ record_input: "reassign.md" }],
      ),
    ]);
    const e = startEngine(t, p);
    await until(p, isQuestion, "the question");
    await pauseAndExit(e);
    const events = journal(p);
    assert.deepStrictEqual(purposes(events), {
      plan: 1,
      work: 6,
      review: 6,
      reassign: 1,
    });
    const works = ofType(events, "RUN_STARTED").filter(
      (x) => x.data.purpose === "work",
    );
    assert.deepStrictEqual(
      works.map((x) => x.data.role),
      [
        "researcher",
        "researcher",
        "researcher",
        "financial_analyst",
        "financial_analyst",
        "financial_analyst",
      ],
    );
    const reassigned = ofType(events, "TASK_REASSIGNED");
    assert.deepStrictEqual(
      reassigned.map((x) => x.data),
      [
        {
          from_role: "researcher",
          to_role: "financial_analyst",
          reason: "Нужен расчёт цен",
        },
      ],
    );
    assert.ok(
      reassigned[0].seq > works[2].seq && reassigned[0].seq < works[3].seq,
    );
    const reassignRun = ofType(events, "RUN_STARTED").find(
      (x) => x.data.purpose === "reassign",
    );
    assert.equal(reassignRun.data.role, "project_manager");
    const workInputs = inputs(p, "-input.md");
    assert.equal(workInputs.length, 6);
    assert.equal(workInputs[0].includes("Нет таблицы вымышленных цен"), false);
    for (const i of [1, 2, 4, 5]) {
      assert.ok(
        workInputs[i].includes("Нет таблицы вымышленных цен"),
        `input ${i + 1}`,
      );
    }
    const [choice] = inputs(p, "-reassign.md");
    assert.ok(choice.includes("financial_analyst: Финансовый аналитик"));
    const waiting = ofType(events, "TASK_WAITING_USER");
    assert.deepStrictEqual(
      waiting.map((x) => x.data),
      [{ reason: "review_failed", draft: null }],
    );
    assert.deepStrictEqual(
      ofType(events, "PROJECT_WAITING").map((x) => [x.data.reason, x.task]),
      [["review_failed", "t-0001"]],
    );
    const questions = events.filter(isQuestion);
    assert.equal(questions.length, 1);
    assert.equal(
      questions[0].data.text,
      "Результат задачи «Вымышленная задача a» не прошёл проверку и у другого специалиста. Изменить задачу или отклонить её?",
    );
    assertDoneOnlyAfterReview(events);
  },
);

// ---- EN-32 -----------------------------------------------------------------------

for (const [label, role] of [
  ["the same role", "researcher"],
  ["a role out of the catalog", "astrologer"],
]) {
  test(
    `EN-32 the choice of ${label}: the question at once, no TASK_REASSIGNED`,
    { timeout: 60_000 },
    async (t) => {
      const p = engineProject(t, [
        planRun([item("a")]),
        scenarioRun({ purpose: "work" }, WORK_OK),
        FAIL_REVIEW,
        scenarioRun({ purpose: "reassign" }, ok({ role, reason: "Так лучше" })),
      ]);
      const e = startEngine(t, p);
      await until(p, isQuestion, "the question");
      await pauseAndExit(e);
      const events = journal(p);
      assert.equal(ofType(events, "TASK_REASSIGNED").length, 0);
      assert.deepStrictEqual(purposes(events), {
        plan: 1,
        work: 3,
        review: 3,
        reassign: 1,
      });
      assert.deepStrictEqual(
        ofType(events, "TASK_WAITING_USER").map((x) => x.data.reason),
        ["review_failed"],
      );
      assert.equal(events.filter(isQuestion).length, 1);
    },
  );
}
