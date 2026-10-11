// Shared fixtures of the tests of the line of a pause (ISS-0020, design
// docs/design/ISS-0020-pause-text-for-waiting.md r2, section 9; contract
// docs/design/REQ-035-team-web-control.md r7, section 15.2): CTL-14a, 14b, 14d,
// 14e, 14g (team-web-control.test.js) and CTL-14c (team-web-control-page.test.js).
// Every fixture is made only through the API of the core: the writer of the core
// (openWriter, append — the reducer checks each event), the commands of the core
// (applyCommand: pause, budget, resume) and the reopening of a writer (recovery).
// No state is written by hand. The expected texts are literals of section 3 of the
// design, not an import of TEXT.
import assert from "node:assert/strict";
import { openQuestions } from "../src/team/engine/answers.js";
import { applyCommand } from "../src/team/engine/commands.js";
import { scanFacts } from "../src/team/engine/facts.js";
import { nextActions } from "../src/team/engine/schedule.js";
import { openWriter } from "../src/team/store.js";
import {
  ask,
  endRun,
  eng,
  passReview,
  planTask,
  project,
  readOf,
  startRun,
  toReview,
  usr,
  withPlan,
  work,
} from "./team-web-helpers.js";
import { richProject } from "./team-web-fixtures.js";

// Section 3 of the design (texts of ORCH, r2).
export const LINE = Object.freeze({
  paused: "Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше",
  budget:
    "Проект на паузе. Он ждал вашего решения о потолке расходов. Если потолка по-прежнему не хватает, после «Продолжить» он снова спросит об этом",
  plan: "Проект на паузе. Он ждал вашего решения: план не составился. «Продолжить» может запустить составление плана заново — это тратит деньги в пределах потолка проекта; если не выйдет или потолка не хватит, проект снова спросит вас",
  goal: "Проект на паузе. Он ждал вашего решения: цель не подтвердилась. «Продолжить» может запустить новую работу или проверку — это тратит деньги в пределах потолка проекта; если решение по-прежнему нужно, проект снова спросит вас",
  taskQuestion:
    "Проект на паузе. У задачи есть вопрос к вам, и пока на него нет ответа, «Продолжить» не сработает. Ответить на странице пока нельзя — это появится позже",
});

export const TASK_DECISION =
  "Проект ждёт вашего решения по задаче. Ответить на странице пока нельзя — это появится позже";

// The configuration the engine gives to the commands and to the schedule
// (scripted runs: no ceiling of a run of its own).
export const CORE_CONFIG = Object.freeze({
  realRuns: false,
  claudeBin: "claude",
  web: true,
  taskTimeoutMs: 20_000,
  retryDelayMs: 0,
  runCapUsd: null,
});

// A command of the core (as the engine applies a message of the channel).
export function coreCommand(box, p, w, kind, args = {}) {
  return applyCommand(
    w,
    { kind, args },
    { facts: scanFacts(readOf(box, p.id).events), config: CORE_CONFIG },
  );
}

// A question about a task is open (the rule of the core: openQuestions).
export function taskQuestionOpen(read) {
  return openQuestions(read.state, scanFacts(read.events)).some(
    (q) => q.task !== null,
  );
}

// A run that cost `cost` and its BUDGET_SPENT, as the engine writes them.
function spend(w, purpose, role, cost, task = null) {
  const run = startRun(w, purpose, role, task);
  endRun(w, run, task, { cost_usd: cost });
  w.append(
    eng(
      "BUDGET_SPENT",
      {
        run_id: run,
        cost_usd: cost,
        accounted: "reported",
        total_usd: +(w.state.spent_usd + cost).toFixed(6),
      },
      task,
    ),
  );
  return run;
}

function pauseAndClose(box, p) {
  coreCommand(box, p, p.w, "pause");
  p.w.close();
  return p;
}

// «ждёт решения» because of the ceiling: 1 of 1 spent on the first of two tasks;
// raise — the command budget of the core after PROJECT_WAITING (1.005 is
// RAISED-TINY, Ф24); then the command pause.
export function budgetPaused(t, box, { raise = null } = {}) {
  const p = project(t, box, { budget_usd: 1 });
  const w = p.w;
  withPlan(
    w,
    [planTask("t-0001", "researcher"), planTask("t-0002", "researcher")],
    1,
  );
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  spend(w, "work", "researcher", 1, "t-0001");
  w.append(eng("PROJECT_WAITING", { reason: "budget" }));
  ask(
    w,
    "Достигнут потолок расходов. Поднимите потолок, чтобы продолжить, или остановите проект",
  );
  if (raise !== null) coreCommand(box, p, w, "budget", { budget_usd: raise });
  return pauseAndClose(box, p);
}

// The plan was not made (plan_failed); spent — the ceiling is used up by the run
// of the plan (PLAN-SPENT, Ф25), else there is a rest (PLAN0).
export function planPaused(t, box, { spent = false } = {}) {
  const p = project(t, box, { budget_usd: spent ? 1 : 5 });
  const w = p.w;
  w.append(usr("PROJECT_STARTED", { parallel: 2 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  spend(w, "plan", "project_manager", spent ? 1 : 0.01);
  w.append(eng("PROJECT_WAITING", { reason: "plan_failed" }));
  ask(w, "План не составлен. Уточните цель или остановите проект");
  return pauseAndClose(box, p);
}

// The goal check of round 0 did not pass (goal_check_failed after a check);
// spent — the check used up the ceiling (GOAL-SPENT, N4 of the gate of step 30).
export function goalPaused(t, box, { spent = false } = {}) {
  const p = project(t, box, { budget_usd: spent ? 1 : 5 });
  const w = p.w;
  withPlan(w, [planTask("t-0001", "researcher")]);
  work(w, "t-0001");
  toReview(w, "t-0001");
  passReview(w, "t-0001");
  const cost = spent ? 1 : 0.01;
  const g = startRun(w, "goal_check", "reviewer");
  w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: g }));
  w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: g,
      passed: false,
      notes: "Нет вымышленного вывода",
    }),
  );
  endRun(w, g, null, { cost_usd: cost });
  w.append(
    eng("BUDGET_SPENT", {
      run_id: g,
      cost_usd: cost,
      accounted: "reported",
      total_usd: +(w.state.spent_usd + cost).toFixed(6),
    }),
  );
  w.append(eng("PROJECT_WAITING", { reason: "goal_check_failed" }));
  ask(w, "Цель не подтвердилась. Что делать дальше?");
  return pauseAndClose(box, p);
}

// A round whose only task failed and was rejected by the user (closed).
function closedRound(w, round, id) {
  if (round === 0) w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round }));
  w.append(
    eng("PLAN_RECEIVED", { round, tasks: [planTask(id, "researcher")] }),
  );
  w.append(eng("TASK_STARTED", {}, id));
  endRun(w, startRun(w, "work", "researcher", id), id, { outcome: "failed" });
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Вымышленный сбой" },
      id,
    ),
  );
  w.append(usr("DECISION_RECEIVED", { decision: "reject", text: null }, id));
}

// GOAL-NO-RUN (Ф26): goal_check_failed without a goal check — the round is
// ROUNDS_MAX (2), every task closed, none done.
export function goalNoRunPaused(t, box) {
  const p = project(t, box);
  closedRound(p.w, 0, "t-0001");
  closedRound(p.w, 1, "t-0002");
  closedRound(p.w, 2, "t-0003");
  p.w.append(eng("PROJECT_WAITING", { reason: "goal_check_failed" }));
  return pauseAndClose(box, p);
}

// A question about a task (richProject waits for the decision on t-0006), paused.
export function taskQuestionPaused(t, box) {
  const p = richProject(t, box);
  return pauseAndClose(box, p);
}

// A question about a task while the project waits because of the ceiling.
export function taskQuestionBudgetPaused(t, box) {
  const p = project(t, box, { budget_usd: 1 });
  const w = p.w;
  withPlan(
    w,
    [planTask("t-0001", "researcher"), planTask("t-0002", "researcher")],
    1,
  );
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  spend(w, "work", "researcher", 1, "t-0001");
  toReview(w, "t-0001");
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "review_failed", draft: null },
      "t-0001",
    ),
  );
  ask(w, "Изменить задачу или отклонить её?", "t-0001");
  w.append(eng("PROJECT_WAITING", { reason: "budget" }));
  return pauseAndClose(box, p);
}

// The project waited for an approval of a critical task, was paused, and the
// approval came while paused (the command answer of the core): the reason stays
// approval, no question about a task is open.
export function approvalAnsweredPaused(t, box) {
  const p = project(t, box);
  const w = p.w;
  withPlan(w, [planTask("t-0001", "researcher", { critical: true })]);
  work(w, "t-0001");
  w.writeResultFile({
    task: "t-0001",
    name: "t-0001-1-post.md",
    content: "Вымышленный черновик",
    kind: "draft",
  });
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "approval", draft: "t-0001-1-post.md" },
      "t-0001",
    ),
  );
  w.append(eng("PROJECT_WAITING", { reason: "approval" }, "t-0001"));
  ask(w, "Одобрить черновик задачи?", "t-0001");
  coreCommand(box, p, w, "pause");
  coreCommand(box, p, w, "answer", {
    task: "t-0001",
    decision: "approve",
    text: null,
  });
  w.close();
  return p;
}

// Paused without a wait.
export function plainPaused(t, box) {
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  return pauseAndClose(box, p);
}

// Paused by the core after a failure with a question about a task open (N4 of
// step 28): t-0001 failed (its question is open), t-0002 in work with its run
// open, the writer gone; the next writer of the core recovers the project.
export function recoveryWithQuestion(t, box) {
  const p = project(t, box);
  const w = p.w;
  withPlan(w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "researcher"),
  ]);
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  endRun(w, startRun(w, "work", "researcher", "t-0001"), "t-0001", {
    outcome: "failed",
  });
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Вымышленный сбой" },
      "t-0001",
    ),
  );
  w.append(eng("TASK_STARTED", {}, "t-0002"));
  startRun(w, "work", "researcher", "t-0002");
  w.close();
  openWriter(p.id, { home: box.home }).close();
  const read = readOf(box, p.id);
  assert.equal(read.state.status, "paused");
  assert.equal(read.state.paused_by, "recovery");
  assert.equal(taskQuestionOpen(read), true, "the question of t-0001 is open");
  return p;
}

// The cases of CTL-14g (the probes of the gates, Ф24–Ф26 and N4): [name, build,
// line, the class of the outcome of «Продолжить»].
export const OUTCOME_CASES = Object.freeze([
  ["BUDGET-NOT-RAISED", (t, box) => budgetPaused(t, box), "budget", "ask"],
  [
    "RAISED-TINY",
    (t, box) => budgetPaused(t, box, { raise: 1.005 }),
    "budget",
    "ask",
  ],
  [
    "RAISED-AMPLE",
    (t, box) => budgetPaused(t, box, { raise: 10 }),
    "budget",
    "run",
  ],
  ["PLAN0", (t, box) => planPaused(t, box), "plan", "run"],
  [
    "PLAN-SPENT",
    (t, box) => planPaused(t, box, { spent: true }),
    "plan",
    "ask",
  ],
  ["GOAL-AFTER-CHECK", (t, box) => goalPaused(t, box), "goal", "run"],
  [
    "GOAL-SPENT",
    (t, box) => goalPaused(t, box, { spent: true }),
    "goal",
    "ask",
  ],
  ["GOAL-NO-RUN", (t, box) => goalNoRunPaused(t, box), "goal", "ask"],
]);

const RUN_KINDS = ["plan", "goal", "work", "review", "reassign"];

// «Продолжить» on a project: the command resume of the core on a new writer, then
// what the schedule of the engine does next (nextActions). Returns the class
// ("ask" — the project asks again, "run" — a paid run) and the actions.
export function resumeOutcome(box, p) {
  const w = openWriter(p.id, { home: box.home });
  try {
    const before = w.state.spent_usd;
    const ev = coreCommand(box, p, w, "resume");
    assert.equal(ev.type, "PROJECT_RESUMED");
    assert.equal(ev.data.after, "command");
    const read = readOf(box, p.id);
    const actions = nextActions(
      read.state,
      { inFlight: new Map(), stopping: false, facts: scanFacts(read.events) },
      CORE_CONFIG,
    );
    assert.ok(actions.length > 0, "the engine does something");
    const first = actions[0];
    const kinds = actions.map((a) =>
      a.kind === "wait" ? `wait:${a.question.kind}` : a.kind,
    );
    assert.equal(read.state.spent_usd, before, "the command spends nothing");
    if (first.kind === "wait") return { cls: "ask", kinds };
    assert.ok(RUN_KINDS.includes(first.kind), kinds.join(","));
    return { cls: "run", kinds };
  } finally {
    w.close();
  }
}

// A word that promises an outcome, as a whole word: bounded by non-letters by
// \p{L} with the flag u (N1 of step 30: \b of JS does not see Cyrillic, and a
// substring finds «запустит» in «может запустить» and «продолжит» in «Продолжить»).
const PROMISES = ["запустит", "сразу", "пойдёт", "продолжит"];
export function promiseWords(text) {
  return PROMISES.filter((w) =>
    new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, "iu").test(text),
  );
}
