// Sai Team engine: the pure functions and the single run as modules (design
// REQ-013, sections 4.5, 6, 8, 9; round 2 of the plan, section 24). The schedule
// (criterion 2), the reserve of the ceiling (criterion 7), the questions and the
// answers (criteria 3, 6), the facts of the journal (criterion 10) and runSingle
// (criteria 1, 5, 8). Only the scripted executor is called, after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readConfig } from "../src/team/config.js";
import { TeamError } from "../src/team/errors.js";
import { createProject, openWriter } from "../src/team/store.js";
import {
  checkDecision,
  openQuestions,
  pendingDecisions,
  questionAsked,
  questionText,
  QUESTION,
} from "../src/team/engine/answers.js";
import { emptyFacts, noteEvent, scanFacts } from "../src/team/engine/facts.js";
import {
  CRITICAL_NOTE,
  CYCLE_RUNS_MAX,
  MIN_RUN_USD,
  PARALLEL_DEFAULT,
  nextActions,
  readyTasks,
  slotBudget,
} from "../src/team/engine/schedule.js";
import { PLAN_ANSWER_SCHEMA } from "../src/team/engine/plan.js";
import { REVIEW_ANSWER_SCHEMA } from "../src/team/engine/review.js";
import { runSingle } from "../src/team/engine/single-run.js";
import { assertSafeEnv, execEnv, makeSandbox, sha256 } from "./exec-helpers.js";
import {
  endRun,
  eng,
  journalOf,
  makeClock,
  makeHome,
  planTask,
  startProject,
  startRun,
  usr,
  withPlan,
} from "./team-helpers.js";

const CONFIG = Object.freeze({
  realRuns: false,
  claudeBin: "claude",
  web: true,
  taskTimeoutMs: 20_000,
  retryDelayMs: 0,
  runCapUsd: null,
});

function viewOf(p, inFlight = []) {
  return {
    inFlight: new Map(inFlight.map((a, i) => [a.task ?? `k${i}`, a])),
    stopping: false,
    facts: scanFacts(journalOf(p.events)),
  };
}

function running(t, tasks, over = {}, parallel = 2) {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock(), over);
  p.writer.append(usr("PROJECT_STARTED", { parallel }));
  p.writer.append(eng("PLANNING_STARTED", { round: 0 }));
  p.writer.append(eng("PLAN_RECEIVED", { round: 0, tasks }));
  return p;
}

function work(w, id, outcome = "ok") {
  const role = w.state.tasks.find((x) => x.id === id).role;
  w.append(eng("TASK_STARTED", {}, id));
  endRun(w, startRun(w, "work", role, id), id, { outcome });
}

function review(w, id, passed, notes = "Замечание") {
  const run = startRun(w, "review", "reviewer", id);
  endRun(w, run, id);
  w.append(eng("REVIEW_RESULT", { run_id: run, passed, notes }, id));
}

function done(w, id) {
  work(w, id);
  w.append(eng("TASK_REVIEW", {}, id));
  review(w, id, true);
  w.append(
    eng("TASK_DONE", { via: "review", external_action_done: false }, id),
  );
}

const kinds = (actions) => actions.map((a) => [a.kind, a.task ?? null]);

// ---- slotBudget (section 6.3) -----------------------------------------------------

test("slotBudget: null without a ceiling; the smaller of the ceiling of a run and the rest after the reserves; never below 0", () => {
  const s = (budget, spent) => ({ budget_usd: budget, spent_usd: spent });
  assert.equal(slotBudget(s(0, 0), CONFIG, 0), null);
  assert.equal(slotBudget(s(1, 0), CONFIG, 0), 0.25);
  assert.equal(slotBudget(s(1, 0.9), CONFIG, 0), 0.1);
  assert.equal(slotBudget(s(1, 0.9), CONFIG, 0.05), 0.05);
  assert.equal(slotBudget(s(1, 0.9), CONFIG, 0.5), 0);
  assert.equal(slotBudget(s(1, 0.1), { ...CONFIG, runCapUsd: 0.3 }, 0.1), 0.3);
  assert.equal(slotBudget(s(1, 0.1), CONFIG, 0.123456789), 0.25);
  assert.equal(slotBudget(s(1, 0.8), CONFIG, 0.0333333), 0.166666);
});

// ---- nextActions (section 6.1) ------------------------------------------------------

test("nextActions: at most `parallel` work actions, by ascending id, only tasks whose dependencies are done", (t) => {
  const p = running(
    t,
    [
      planTask("t-0001", "researcher"),
      planTask("t-0002", "designer", { depends_on: ["t-0001"] }),
      planTask("t-0003", "marketer"),
      planTask("t-0004", "lawyer"),
      planTask("t-0005", "developer"),
    ],
    {},
    2,
  );
  const w = p.writer;
  assert.deepStrictEqual(readyTasks(w.state), [
    "t-0001",
    "t-0003",
    "t-0004",
    "t-0005",
  ]);
  assert.deepStrictEqual(kinds(nextActions(w.state, viewOf(p), CONFIG)), [
    ["work", "t-0001"],
    ["work", "t-0003"],
  ]);
  const busy = viewOf(p, [{ kind: "work", task: "t-0001", reserve_usd: 0.25 }]);
  assert.deepStrictEqual(kinds(nextActions(w.state, busy, CONFIG)), [
    ["work", "t-0003"],
  ]);
  const full = viewOf(p, [
    { kind: "work", task: "t-0001", reserve_usd: 0.25 },
    { kind: "review", task: "t-0003", reserve_usd: 0.25 },
  ]);
  assert.deepStrictEqual(nextActions(w.state, full, CONFIG), []);
  assert.deepStrictEqual(
    nextActions(w.state, { ...viewOf(p), stopping: true }, CONFIG),
    [],
  );
});

test("nextActions: the limit follows parallel 1 and 3 of the project; the default is 2", (t) => {
  const tasks = [1, 2, 3, 4].map((i) => planTask(`t-000${i}`, "researcher"));
  for (const parallel of [1, 3]) {
    const p = running(t, tasks, {}, parallel);
    assert.equal(
      nextActions(p.writer.state, viewOf(p), CONFIG).length,
      parallel,
    );
  }
  assert.equal(PARALLEL_DEFAULT, 2);
});

test("nextActions: the reserves of the runs in work and of the chosen ones never exceed the rest (section 6.3)", (t) => {
  const p = running(
    t,
    [1, 2, 3].map((i) => planTask(`t-000${i}`, "researcher")),
    { budget_usd: 1 },
    3,
  );
  const w = p.writer;
  // spent 0.62 of 1: the rest is 0.38
  w.append(
    eng("BUDGET_SPENT", {
      run_id: startRun(w, "goal_check", "reviewer"),
      cost_usd: 0.62,
      accounted: "reported",
      total_usd: 0.62,
    }),
  );
  const actions = nextActions(w.state, viewOf(p), CONFIG);
  assert.deepStrictEqual(
    actions.map((a) => a.reserve_usd),
    [0.25, 0.13],
  );
  const sum = actions.reduce((s, a) => s + a.reserve_usd, 0);
  assert.ok(sum <= 0.38 + 1e-9);
  const inWork = viewOf(p, [
    { kind: "work", task: "t-0009", reserve_usd: 0.3 },
  ]);
  const rest = nextActions(w.state, inWork, CONFIG);
  assert.deepStrictEqual(
    rest.map((a) => a.reserve_usd),
    [0.08],
  );
});

test("nextActions: nothing in work and every candidate blocked by the ceiling — wait for the budget", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")], { budget_usd: 1 });
  const w = p.writer;
  w.append(
    eng("BUDGET_SPENT", {
      run_id: startRun(w, "goal_check", "reviewer"),
      cost_usd: 0.995,
      accounted: "reported",
      total_usd: 0.995,
    }),
  );
  assert.ok(slotBudget(w.state, CONFIG, 0) < MIN_RUN_USD);
  assert.deepStrictEqual(nextActions(w.state, viewOf(p), CONFIG), [
    { kind: "wait", question: { kind: "budget", task: null } },
  ]);
  // with a run in work the engine waits for it instead
  const busy = viewOf(p, [{ kind: "work", task: "t-0009", reserve_usd: 0 }]);
  assert.deepStrictEqual(nextActions(w.state, busy, CONFIG), []);
});

test("nextActions: a failed task is asked about once and stops new work; the dependents of a closed task are closed", (t) => {
  const p = running(t, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "designer", { depends_on: ["t-0001"] }),
    planTask("t-0003", "marketer"),
  ]);
  const w = p.writer;
  work(w, "t-0001", "failed");
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Нет" },
      "t-0001",
    ),
  );
  assert.deepStrictEqual(nextActions(w.state, viewOf(p), CONFIG), [
    { kind: "wait", question: { kind: "task_failed", task: "t-0001" } },
  ]);
  w.append(eng("PROJECT_WAITING", { reason: "task_failed" }, "t-0001"));
  w.append(
    eng(
      "CHAT",
      { text: "Вопрос", kind: "question", truncated: false },
      "t-0001",
    ),
  );
  assert.equal(questionAsked(w.state, viewOf(p).facts, "t-0001"), true);
  assert.deepStrictEqual(nextActions(w.state, viewOf(p), CONFIG), []);
  w.append(
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0001"),
  );
  assert.deepStrictEqual(nextActions(w.state, viewOf(p), CONFIG), [
    { kind: "close_dependents", tasks: ["t-0002"] },
  ]);
});

test("nextActions: the cycle of a task on review — passed: finish; failed: work with the notes, then the choice of a role, then the question", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")]);
  const w = p.writer;
  work(w, "t-0001");
  w.append(eng("TASK_REVIEW", {}, "t-0001"));
  assert.deepStrictEqual(kinds(nextActions(w.state, viewOf(p), CONFIG)), [
    ["review", "t-0001"],
  ]);
  review(w, "t-0001", false, "Нет таблицы");
  let a = nextActions(w.state, viewOf(p), CONFIG);
  assert.equal(a[0].kind, "work");
  assert.equal(a[0].note, "Нет таблицы");
  for (let n = 2; n <= CYCLE_RUNS_MAX; n += 1) {
    work(w, "t-0001");
    w.append(eng("TASK_REVIEW", {}, "t-0001"));
    review(w, "t-0001", false, `Замечание ${n}`);
  }
  a = nextActions(w.state, viewOf(p), CONFIG);
  assert.deepStrictEqual(kinds(a), [["reassign", "t-0001"]]);
  assert.equal(a[0].giveUp, false);
  w.append(
    eng(
      "TASK_REASSIGNED",
      { from_role: "researcher", to_role: "marketer", reason: "Другой взгляд" },
      "t-0001",
    ),
  );
  a = nextActions(w.state, viewOf(p), CONFIG);
  assert.equal(a[0].kind, "work", "a new cycle of the new role");
  for (let n = 1; n <= CYCLE_RUNS_MAX; n += 1) {
    work(w, "t-0001");
    w.append(eng("TASK_REVIEW", {}, "t-0001"));
    review(w, "t-0001", false, `Снова ${n}`);
  }
  a = nextActions(w.state, viewOf(p), CONFIG);
  assert.deepStrictEqual(a, [
    { kind: "reassign", giveUp: true, task: "t-0001", reserve_usd: 0 },
  ]);
  const passed = running(t, [planTask("t-0001", "researcher")]);
  work(passed.writer, "t-0001");
  passed.writer.append(eng("TASK_REVIEW", {}, "t-0001"));
  review(passed.writer, "t-0001", true);
  assert.deepStrictEqual(
    nextActions(passed.writer.state, viewOf(passed), CONFIG),
    [{ kind: "review", finish: true, task: "t-0001", reserve_usd: 0 }],
  );
});

test("nextActions: a critical task without its draft goes back to work with the note, without a review run", (t) => {
  const p = running(t, [planTask("t-0001", "marketer", { critical: true })]);
  const w = p.writer;
  let a = nextActions(w.state, viewOf(p), CONFIG);
  assert.equal(a[0].note, CRITICAL_NOTE);
  work(w, "t-0001");
  w.append(eng("TASK_REVIEW", {}, "t-0001"));
  a = nextActions(w.state, viewOf(p), CONFIG);
  assert.equal(a[0].kind, "work");
  assert.equal(
    a[0].note,
    `${CRITICAL_NOTE}\n\nНужен черновик файлом с видом draft`,
  );
});

test("nextActions: all done — the goal check; a fresh passed check — done; closed tasks since the plan — a round of more tasks", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")]);
  const w = p.writer;
  done(w, "t-0001");
  assert.deepStrictEqual(kinds(nextActions(w.state, viewOf(p), CONFIG)), [
    ["goal", null],
  ]);
  const run = startRun(w, "goal_check", "reviewer");
  w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: run }));
  endRun(w, run);
  w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: run,
      passed: true,
      notes: "Да",
    }),
  );
  assert.deepStrictEqual(nextActions(w.state, viewOf(p), CONFIG), [
    { kind: "done" },
  ]);

  const q = running(t, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "marketer", { critical: true }),
  ]);
  done(q.writer, "t-0001");
  work(q.writer, "t-0002");
  q.writer.append(eng("TASK_REVIEW", {}, "t-0002"));
  review(q.writer, "t-0002", true);
  q.writer.writeResultFile({
    task: "t-0002",
    name: "d.md",
    content: "Черновик",
    kind: "draft",
  });
  q.writer.append(
    eng("TASK_WAITING_USER", { reason: "approval", draft: "d.md" }, "t-0002"),
  );
  q.writer.append(
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0002"),
  );
  q.writer.append(
    eng(
      "TASK_FAILED",
      { reason: "rejected_by_user", detail: "Отклонено пользователем" },
      "t-0002",
    ),
  );
  assert.deepStrictEqual(nextActions(q.writer.state, viewOf(q), CONFIG), [
    { kind: "plan", round: 1, reserve_usd: 1.25 },
  ]);
});

test("nextActions: a paused project begins nothing; a project without tasks plans round 0", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.append(usr("PROJECT_STARTED", { parallel: 2 }));
  assert.deepStrictEqual(nextActions(p.writer.state, viewOf(p), CONFIG), [
    { kind: "plan", round: 0, reserve_usd: 1.25 },
  ]);
  p.writer.append(usr("PROJECT_PAUSED"));
  assert.deepStrictEqual(nextActions(p.writer.state, viewOf(p), CONFIG), []);
});

// ---- facts (section 4.5) ------------------------------------------------------------

test("facts: scanFacts equals noteEvent event by event; launches reset by a reassignment and by change; applied after a change of status", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")]);
  const w = p.writer;
  work(w, "t-0001");
  w.append(eng("TASK_REVIEW", {}, "t-0001"));
  review(w, "t-0001", false, "Плохо");
  work(w, "t-0001");
  let f = scanFacts(journalOf(p.events));
  assert.equal(f.launches["t-0001"], 2);
  assert.deepStrictEqual(f.reviewNotes["t-0001"], ["Плохо"]);
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Нет" },
      "t-0001",
    ),
  );
  const d = w.append(
    usr("DECISION_RECEIVED", { decision: "change", text: "Иначе" }, "t-0001"),
  );
  f = scanFacts(journalOf(p.events));
  assert.equal(f.launches["t-0001"], 0);
  assert.equal(f.applied.has(d.seq), false);
  assert.deepStrictEqual(pendingDecisions(w.state, f), [
    { task: "t-0001", decision: "change", text: "Иначе", seq: d.seq },
  ]);
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  const events = journalOf(p.events);
  f = scanFacts(events);
  assert.equal(f.applied.has(d.seq), true);
  assert.equal(f.launches["t-0001"], 1);
  assert.deepStrictEqual(pendingDecisions(w.state, f), []);
  const step = emptyFacts();
  for (const e of events) noteEvent(step, e);
  assert.deepStrictEqual(step, f);
});

test("facts: a failure by the ceiling is not a question; the task goes back to work once the ceiling allows", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")]);
  const w = p.writer;
  work(w, "t-0001", "failed");
  w.append(
    eng(
      "TASK_FAILED",
      {
        reason: "retries_exhausted",
        detail: "Потолок расходов исчерпан: повтор не начат",
      },
      "t-0001",
    ),
  );
  const f = scanFacts(journalOf(p.events));
  assert.equal(f.budgetFailed.has("t-0001"), true);
  assert.deepStrictEqual(openQuestions(w.state, f), []);
  assert.deepStrictEqual(kinds(nextActions(w.state, viewOf(p), CONFIG)), [
    ["work", "t-0001"],
  ]);
});

// ---- answers (section 9.2) -----------------------------------------------------------

test("checkDecision: the table of the design; nothing is written", (t) => {
  const p = running(t, [
    planTask("t-0001", "marketer", { critical: true }),
    planTask("t-0002", "researcher"),
    planTask("t-0003", "designer"),
    planTask("t-0004", "lawyer"),
  ]);
  const w = p.writer;
  work(w, "t-0001");
  w.append(eng("TASK_REVIEW", {}, "t-0001"));
  review(w, "t-0001", true);
  w.writeResultFile({
    task: "t-0001",
    name: "d.md",
    content: "Черновик",
    kind: "draft",
  });
  w.append(
    eng("TASK_WAITING_USER", { reason: "approval", draft: "d.md" }, "t-0001"),
  );
  work(w, "t-0002");
  w.append(eng("TASK_REVIEW", {}, "t-0002"));
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "review_failed", draft: null },
      "t-0002",
    ),
  );
  work(w, "t-0003", "failed");
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Нет" },
      "t-0003",
    ),
  );
  const before = sha256(fs.readFileSync(p.events));
  const s = w.state;
  const facts0 = scanFacts(journalOf(p.events));
  const code = (fn) => {
    try {
      fn();
      return "ok";
    } catch (err) {
      assert.ok(err instanceof TeamError);
      return err.code;
    }
  };
  const table = [
    ["t-0001", "approve", null, "ok"],
    ["t-0001", "change", "Иначе", "ok"],
    ["t-0001", "reject", null, "ok"],
    ["t-0002", "approve", null, "E_ANSWER_KIND"],
    ["t-0002", "change", "Иначе", "ok"],
    ["t-0002", "reject", null, "ok"],
    ["t-0003", "approve", null, "E_ANSWER_KIND"],
    ["t-0003", "change", "Иначе", "ok"],
    ["t-0003", "reject", null, "ok"],
    ["t-0004", "approve", null, "E_NOT_WAITING"],
    ["t-0004", "change", "Иначе", "E_NOT_WAITING"],
    ["t-0004", "reject", null, "E_NOT_WAITING"],
    ["t-0099", "reject", null, "E_TASK_NOT_FOUND"],
    ["t-0001", "change", null, "E_USAGE"],
    ["t-0001", "approve", "x", "E_USAGE"],
    ["t-0001", "maybe", null, "E_USAGE"],
  ];
  for (const [task, decision, text, expected] of table) {
    assert.equal(
      code(() => checkDecision(s, task, decision, text, facts0)),
      expected,
      `${task} ${decision}`,
    );
  }
  assert.deepStrictEqual(checkDecision(s, "t-0002", "reject", null, facts0), {
    kind: "review_failed",
  });
  assert.equal(sha256(fs.readFileSync(p.events)), before);
  const f = scanFacts(journalOf(p.events));
  assert.deepStrictEqual(openQuestions(s, f), [
    { kind: "approval", task: "t-0001" },
    { kind: "review_failed", task: "t-0002" },
    { kind: "task_failed", task: "t-0003" },
  ]);
  assert.equal(
    questionText(s, f, { kind: "approval", task: "t-0001" }),
    "От вас требуется решение: черновик задачи «Задача t-0001» готов. Одобрить, изменить или отклонить?",
  );
  assert.equal(
    questionText(s, f, { kind: "task_failed", task: "t-0003" }),
    "Задача «Задача t-0003» не получилась: Нет. Изменить её или отклонить?",
  );
  assert.equal(
    QUESTION.budget(),
    "Достигнут потолок расходов. Поднимите потолок, чтобы продолжить, или остановите проект",
  );
});

// ---- runSingle (section 4.4, 19) ----------------------------------------------------

function scriptedProject(t, scenario) {
  const sb = makeSandbox(t);
  const env = execEnv(sb);
  assertSafeEnv(env);
  const made = createProject(
    {
      goal: "Вымышленная цель для проверки движка",
      budget_usd: 1,
      executor: "scripted",
      scenario_bytes: Buffer.from(JSON.stringify(scenario)),
    },
    { home: sb.home },
  );
  const w = openWriter(made.id, { home: sb.home });
  t.after(() => w.close());
  return {
    sb,
    env,
    w,
    events: path.join(sb.home, made.id, "events.jsonl"),
    config: readConfig(env),
  };
}

const PLAN_OK = {
  tasks: [
    {
      key: "a",
      role: "researcher",
      text: "Собрать вымышленные цены",
      done_when: "Есть таблица",
      depends_on: [],
      critical: false,
    },
  ],
};

test("runSingle: a plan run is opened, its activity and its input recorded, closed with the answer; the input is a result file without a task", async (t) => {
  const p = scriptedProject(t, {
    version: 1,
    runs: [
      {
        match: { purpose: "plan" },
        steps: [{ activity: "thinking" }, { record_input: "input.md" }],
        result: { outcome: "ok", cost_usd: 0.01, answer: PLAN_OK },
      },
    ],
  });
  p.w.append(usr("PROJECT_STARTED", { parallel: 2 }));
  p.w.append(eng("PLANNING_STARTED", { round: 0 }));
  const r = await runSingle(
    p.w,
    {
      purpose: "plan",
      role: "project_manager",
      task: null,
      context: { goal: p.w.state.goal, memory: [], deps: [], note: "Заметка" },
      answer_schema: PLAN_ANSWER_SCHEMA,
      maxBudget: 0.25,
    },
    { env: p.env, config: p.config },
  );
  assert.equal(r.error, null);
  assert.equal(r.run_id, "r-00001");
  assert.deepStrictEqual(r.result.answer, PLAN_OK);
  const events = journalOf(p.events);
  assert.deepStrictEqual(
    events.slice(3).map((e) => e.type),
    [
      "RUN_STARTED",
      "AGENT_ACTIVITY",
      "RESULT_FILE",
      "RUN_FINISHED",
      "BUDGET_SPENT",
    ],
  );
  assert.equal(events[3].data.purpose, "plan");
  assert.equal(events[5].data.name, "r-00001-input.md");
  assert.equal(events[5].task, null);
  assert.deepStrictEqual(events[6].data.files, ["r-00001-input.md"]);
  assert.equal(events[7].data.cost_usd, 0.01);
  assert.equal(Object.keys(p.w.state.runs.open).length, 0);
});

test("runSingle: a refusal of the checks of the executor writes nothing; an exception after RUN_STARTED closes the run as failed and keeps the writer", async (t) => {
  const p = scriptedProject(t, {
    version: 1,
    runs: [
      {
        match: { purpose: "review" },
        steps: [],
        result: {
          outcome: "ok",
          cost_usd: 0,
          answer: { passed: true, notes: "Хорошо" },
        },
      },
    ],
  });
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  work(p.w, "t-0001");
  p.w.append(eng("TASK_REVIEW", {}, "t-0001"));
  const spec = {
    purpose: "review",
    role: "reviewer",
    task: "t-0001",
    context: { goal: "x", memory: [], deps: [], note: null },
    answer_schema: REVIEW_ANSWER_SCHEMA,
    maxBudget: 0.25,
  };
  const before = sha256(fs.readFileSync(p.events));
  const refused = await runSingle(
    p.w,
    { ...spec, maxBudget: 5 },
    { env: p.env, config: p.config },
  );
  assert.equal(refused.error?.code, "E_BUDGET_EXHAUSTED");
  assert.equal(refused.run_id, null);
  assert.equal(sha256(fs.readFileSync(p.events)), before);

  const broken = await runSingle(
    p.w,
    {
      ...spec,
      afterStart: () => {
        throw new Error("a bug of the caller");
      },
    },
    { env: p.env, config: p.config },
  );
  assert.equal(broken.error?.code, "E_INTERNAL");
  const events = journalOf(p.events);
  const last = events[events.length - 1];
  assert.equal(last.type, "RUN_FINISHED");
  assert.equal(last.data.outcome, "failed");
  assert.equal(last.data.run_id, broken.run_id);
  assert.equal(p.w.broken, false);
  assert.equal(Object.keys(p.w.state.runs.open).length, 0);
  const ok = await runSingle(p.w, spec, { env: p.env, config: p.config });
  assert.deepStrictEqual(ok.result.answer, { passed: true, notes: "Хорошо" });
  assert.notEqual(ok.run_id, broken.run_id);
});

test("runSingle: a cancelled review run is closed cancelled and its task interrupted with the cause given at the end", async (t) => {
  const p = scriptedProject(t, {
    version: 1,
    runs: [
      {
        match: { purpose: "review" },
        steps: [{ delay_ms: 5000 }],
        result: {
          outcome: "ok",
          cost_usd: 0,
          answer: { passed: true, notes: "Да" },
        },
      },
    ],
  });
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  work(p.w, "t-0001");
  p.w.append(eng("TASK_REVIEW", {}, "t-0001"));
  const controller = new AbortController();
  const opts = { env: p.env, config: p.config, signal: controller.signal };
  const pending = runSingle(
    p.w,
    {
      purpose: "review",
      role: "reviewer",
      task: "t-0001",
      context: { goal: "x", memory: [], deps: [], note: null },
      answer_schema: REVIEW_ANSWER_SCHEMA,
      maxBudget: 0.25,
    },
    opts,
  );
  controller.abort("stop");
  const r = await pending;
  assert.equal(r.result.outcome, "cancelled");
  const events = journalOf(p.events);
  assert.deepStrictEqual(
    events
      .slice(-3)
      .map((e) => [e.type, e.data.outcome ?? e.data.cause ?? e.data.accounted]),
    [
      ["RUN_FINISHED", "cancelled"],
      ["BUDGET_SPENT", "assumed"],
      ["TASK_INTERRUPTED", "stop"],
    ],
  );
});
