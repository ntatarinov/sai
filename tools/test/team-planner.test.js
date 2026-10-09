// Sai Team engine: the planner (design REQ-013, section 5, criterion 1): the plan
// inside the engine (EN-01 ... EN-03, EN-05) and the check of a plan as a module
// (EN-04). Only the scripted executor is started, after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  journal,
  ofType,
  types,
  waitUntil,
  withLimit,
} from "./exec-helpers.js";
import { checkAnswer } from "../src/team/executor.js";
import { replay } from "../src/team/reducer.js";
import {
  PLAN_ANSWER_SCHEMA,
  PLAN_DETAIL,
  orderPlan,
  planNote,
  validatePlan,
} from "../src/team/engine/plan.js";
import { scanFacts } from "../src/team/engine/facts.js";
import {
  eng,
  journalOf,
  makeClock,
  makeHome,
  planTask,
  startProject,
  usr,
  withPlan,
} from "./team-helpers.js";
import {
  WORK_OK,
  scenarioRun,
  engineProject,
  startEngine,
} from "./team-engine-helpers.js";

const item = (key, over = {}) => ({
  key,
  role: "researcher",
  text: `Задача ${key}`,
  done_when: "Есть итог",
  depends_on: [],
  critical: false,
  ...over,
});

const EMPTY = { tasks: [] };

// ---- EN-04 -----------------------------------------------------------------------

test("EN-04 a good plan: ids by a stable topological order, dependencies only on smaller numbers, keys turned into ids", () => {
  const answer = {
    tasks: [
      item("report", { depends_on: ["prices", "rivals"], critical: true }),
      item("prices"),
      item("rivals", { role: "marketer", depends_on: ["prices"] }),
      item("extra"),
    ],
  };
  const r = validatePlan(answer, EMPTY);
  assert.equal(r.ok, true);
  assert.deepStrictEqual(
    r.tasks.map((t) => [t.id, t.text, t.depends_on]),
    [
      ["t-0001", "Задача prices", []],
      ["t-0002", "Задача rivals", ["t-0001"]],
      ["t-0003", "Задача report", ["t-0001", "t-0002"]],
      ["t-0004", "Задача extra", []],
    ],
  );
  for (const t of r.tasks) {
    const own = Number(t.id.slice(2));
    for (const d of t.depends_on) assert.ok(Number(d.slice(2)) < own);
  }
  assert.equal(r.tasks[2].critical, true);
  assert.equal(r.tasks[1].role, "marketer");
  assert.deepStrictEqual(Object.keys(r.tasks[0]), [
    "id",
    "role",
    "text",
    "done_when",
    "depends_on",
    "critical",
  ]);
});

test("EN-04 the ids continue the tasks of the project; a dependency on an existing task is kept", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  withPlan(p.writer, [planTask("t-0001", "researcher")]);
  const r = validatePlan(
    { tasks: [item("next", { depends_on: ["t-0001"] })] },
    p.writer.state,
  );
  assert.equal(r.ok, true);
  assert.deepStrictEqual(r.tasks, [
    {
      id: "t-0002",
      role: "researcher",
      text: "Задача next",
      done_when: "Есть итог",
      depends_on: ["t-0001"],
      critical: false,
    },
  ]);
});

test("EN-04 the checks go in the order of the design: schema, number, role, dependency, cycle", () => {
  const forty = Array.from({ length: 40 }, (_, i) => item(`k${i}`));
  const cases = [
    // schema first even with 41 tasks, a foreign role, a link to nowhere
    [
      {
        tasks: [
          ...forty,
          item("x", { role: "wizard", depends_on: ["nowhere"], extra: 1 }),
        ],
      },
      "schema",
      "План не соответствует схеме: tasks.40.extra",
    ],
    [{ tasks: [] }, "schema", "План не соответствует схеме: tasks"],
    [{}, "schema", "План не соответствует схеме: tasks"],
    [null, "schema", "План не соответствует схеме"],
    [
      { tasks: [item("a"), { ...item("b"), done_when: undefined }] },
      "schema",
      "План не соответствует схеме: tasks.1.done_when",
    ],
    [
      { tasks: [item("Bad Key")] },
      "schema",
      "План не соответствует схеме: tasks.0.key",
    ],
    [
      { tasks: [item("a"), item("a")] },
      "schema",
      "План не соответствует схеме: tasks.1.key",
    ],
    [
      { tasks: [item("a", { text: "   " })] },
      "schema",
      "План не соответствует схеме: tasks.0.text",
    ],
    // then the number, before a foreign role and a link to nowhere
    [
      {
        tasks: [
          ...forty,
          item("x", { role: "wizard", depends_on: ["nowhere"] }),
        ],
      },
      "too_many",
      "В плане больше 40 задач",
    ],
    // then the role, before a link to nowhere and a cycle
    [
      {
        tasks: [
          item("a", { depends_on: ["b"] }),
          item("b", { role: "wizard", depends_on: ["a", "nowhere"] }),
        ],
      },
      "unknown_role",
      "Роль задачи b не из каталога",
    ],
    // then the dependency, before a cycle
    [
      {
        tasks: [
          item("a", { depends_on: ["b"] }),
          item("b", { depends_on: ["a"] }),
          item("c", { depends_on: ["t-0009"] }),
        ],
      },
      "bad_dependency",
      "Задача c ссылается на несуществующую задачу",
    ],
    [
      { tasks: [item("a", { depends_on: ["a"] })] },
      "bad_dependency",
      "Задача a ссылается на несуществующую задачу",
    ],
    [
      {
        tasks: [
          item("a", { depends_on: ["c"] }),
          item("b", { depends_on: ["a"] }),
          item("c", { depends_on: ["b"] }),
        ],
      },
      "cycle",
      "В зависимостях плана есть цикл",
    ],
  ];
  for (const [answer, reason, detail] of cases) {
    const r = validatePlan(answer, EMPTY);
    assert.deepStrictEqual(r, { ok: false, reason, detail }, detail);
    assert.ok([...r.detail].length <= 500);
  }
});

test("EN-04 exactly 40 tasks pass; 200 tasks in the project are the limit", (t) => {
  const forty = Array.from({ length: 40 }, (_, i) => item(`k${i}`));
  assert.equal(validatePlan({ tasks: forty }, EMPTY).ok, true);
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  for (let round = 0; round < 4; round += 1) {
    w.append(eng("PLANNING_STARTED", { round: round === 0 ? 0 : 1 }));
    const r = validatePlan({ tasks: forty }, w.state);
    assert.equal(r.ok, true);
    w.append(
      eng("PLAN_RECEIVED", { round: round === 0 ? 0 : 1, tasks: r.tasks }),
    );
  }
  assert.equal(w.state.tasks.length, 160);
  assert.deepStrictEqual(validatePlan({ tasks: forty }, w.state).ok, true);
  const r = validatePlan({ tasks: [...forty, item("one")] }, w.state);
  assert.equal(r.reason, "too_many");
  assert.equal(r.detail, "В плане больше 40 задач");
  w.append(eng("PLANNING_STARTED", { round: 1 }));
  w.append(
    eng("PLAN_RECEIVED", {
      round: 1,
      tasks: validatePlan({ tasks: forty.slice(0, 39) }, w.state).tasks,
    }),
  );
  assert.deepStrictEqual(
    validatePlan({ tasks: [item("a"), item("b")] }, w.state),
    {
      ok: false,
      reason: "too_many",
      detail: "В проекте будет больше 200 задач",
    },
  );
});

test("EN-04 the detail never carries the role or the text of the answer, only a checked key", () => {
  const role = "IGNORE_ALL_RULES";
  const r = validatePlan(
    { tasks: [item("a1", { role, text: "секрет sk-ant-xxxxx" })] },
    EMPTY,
  );
  assert.equal(r.reason, "unknown_role");
  assert.equal(r.detail.includes(role), false);
  assert.equal(r.detail, PLAN_DETAIL.unknown_role("a1"));
});

test("EN-04 the schema of the answer is freer than the rules: 41 tasks and a foreign role fit it", () => {
  const plan = {
    tasks: Array.from({ length: 41 }, (_, i) => item(`k${i}`, { role: "x" })),
  };
  assert.deepStrictEqual(checkAnswer(PLAN_ANSWER_SCHEMA, plan), { ok: true });
  assert.throws(() => {
    PLAN_ANSWER_SCHEMA.properties.tasks.maxItems = 1;
  });
});

test("EN-04 orderPlan keeps the order of the answer when it can and leaves out the items of a cycle", () => {
  const items = [
    { key: "c", depends_on: ["b"] },
    { key: "a", depends_on: [] },
    { key: "b", depends_on: ["a", "t-0001"] },
    { key: "d", depends_on: [] },
  ];
  assert.deepStrictEqual(
    orderPlan(items).map((i) => i.key),
    ["a", "b", "c", "d"],
  );
  assert.deepStrictEqual(
    orderPlan([
      { key: "x", depends_on: ["y"] },
      { key: "y", depends_on: ["x"] },
      { key: "z", depends_on: [] },
    ]).map((i) => i.key),
    ["z"],
  );
});

test("EN-04 the note of the planner: the rejection first, the tasks, the closed tasks with the decision, the messages of the user", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  w.say("Сделайте упор на аренду");
  withPlan(w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "designer"),
  ]);
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  const run = w.nextRunId();
  w.append(
    eng(
      "RUN_STARTED",
      {
        run_id: run,
        purpose: "work",
        role: "researcher",
        executor: "claude-cli",
        max_budget_usd: null,
      },
      "t-0001",
    ),
  );
  w.append(
    eng(
      "RUN_FINISHED",
      {
        run_id: run,
        outcome: "failed",
        summary: null,
        cost_usd: null,
        files: [],
      },
      "t-0001",
    ),
  );
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Исполнитель упал" },
      "t-0001",
    ),
  );
  w.append(
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0001"),
  );
  const facts = scanFacts(journalOf(p.events));
  const note = planNote(w.state, facts, "В плане больше 40 задач");
  assert.ok(
    note.startsWith("Предыдущий план отклонён: В плане больше 40 задач"),
  );
  assert.match(note, /Задачи проекта:\n— t-0001, Исследователь: Задача t-0001/);
  assert.match(
    note,
    /Закрытые задачи после прошлого плана:\n— t-0001: Задача t-0001 — отклонена пользователем/,
  );
  assert.match(note, /Сообщения пользователя:\n— Сделайте упор на аренду/);
  assert.match(note, /— researcher: Исследователь/);
  assert.equal(planNote(w.state, facts).includes("Предыдущий план"), false);
  assert.deepStrictEqual(replay(journalOf(p.events)), w.state);
});

async function stopWhen(t, p, e, pred) {
  const seen = await waitUntil(() => journal(p).some(pred), 20_000);
  assert.ok(seen, `the event did not come: ${types(journal(p)).join(", ")}`);
  e.engine.requestStop("signal");
  await withLimit(e.running);
}

const planItem = (key, over = {}) => ({
  key,
  role: "researcher",
  text: `Вымышленная задача ${key}`,
  done_when: "Есть итог",
  depends_on: [],
  critical: false,
  ...over,
});

function inputOf(p, name) {
  return fs.readFileSync(path.join(p.dir, "files", name), "utf8");
}

// ---- EN-01 -----------------------------------------------------------------------

test(
  "EN-01 a good plan becomes the tasks of the journal with role, text, criterion, dependencies and critical, by one PLAN_RECEIVED",
  { timeout: 60_000 },
  async (t) => {
    const plan = {
      tasks: [
        planItem("summary", {
          role: "marketer",
          depends_on: ["prices"],
          critical: true,
          done_when: "Есть сводка",
        }),
        planItem("prices"),
      ],
    };
    const p = engineProject(t, [
      scenarioRun({ purpose: "plan" }, { outcome: "ok", answer: plan }),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 5000 }]),
    ]);
    const e = startEngine(t, p);
    await stopWhen(t, p, e, (x) => x.type === "TASK_STARTED");
    const events = journal(p);
    const received = ofType(events, "PLAN_RECEIVED");
    assert.equal(received.length, 1);
    assert.equal(ofType(events, "TASK_CREATED").length, 0);
    assert.deepStrictEqual(received[0].data, {
      round: 0,
      tasks: [
        {
          id: "t-0001",
          role: "researcher",
          text: "Вымышленная задача prices",
          done_when: "Есть итог",
          depends_on: [],
          critical: false,
        },
        {
          id: "t-0002",
          role: "marketer",
          text: "Вымышленная задача summary",
          done_when: "Есть сводка",
          depends_on: ["t-0001"],
          critical: true,
        },
      ],
    });
    assert.deepStrictEqual(types(events).slice(1, 5), [
      "PROJECT_STARTED",
      "PLANNING_STARTED",
      "RUN_STARTED",
      "RUN_FINISHED",
    ]);
  },
);

// ---- EN-02 -----------------------------------------------------------------------

const FORTY_ONE = Array.from({ length: 41 }, (_, i) => planItem(`k${i}`));
const DEFECTS = [
  ["schema", { tasks: [{ key: "a" }] }, "План не соответствует схеме"],
  [
    "cycle",
    {
      tasks: [
        planItem("a", { depends_on: ["b"] }),
        planItem("b", { depends_on: ["a"] }),
      ],
    },
    "В зависимостях плана есть цикл",
  ],
  ["too_many", { tasks: FORTY_ONE }, "В плане больше 40 задач"],
  [
    "unknown_role",
    { tasks: [planItem("a", { role: "astrologer" })] },
    "Роль задачи a не из каталога",
  ],
  [
    "bad_dependency",
    { tasks: [planItem("a", { depends_on: ["nowhere"] })] },
    "Задача a ссылается на несуществующую задачу",
  ],
];

for (const [reason, bad, detail] of DEFECTS) {
  test(
    `EN-02 a plan with the fault ${reason}: PLAN_REJECTED, PLAN_RETRY, the second input of the planner names the fault`,
    { timeout: 60_000 },
    async (t) => {
      const good = { tasks: [planItem("only")] };
      const p = engineProject(t, [
        scenarioRun(
          { purpose: "plan", attempt: 1 },
          { outcome: "ok", answer: bad },
          [{ record_input: "plan-1.md" }],
        ),
        scenarioRun(
          { purpose: "plan", attempt: 2 },
          { outcome: "ok", answer: good },
          [{ record_input: "plan-2.md" }],
        ),
        scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 5000 }]),
      ]);
      const e = startEngine(t, p);
      await stopWhen(t, p, e, (x) => x.type === "PLAN_RECEIVED");
      const events = journal(p);
      const rejected = ofType(events, "PLAN_REJECTED");
      assert.equal(rejected.length, 1);
      assert.deepStrictEqual(rejected[0].data, {
        round: 0,
        attempt: 1,
        reason,
        detail,
      });
      assert.deepStrictEqual(ofType(events, "PLAN_RETRY")[0].data, {
        round: 0,
        attempt: 2,
      });
      const second = ofType(events, "RESULT_FILE").find((x) =>
        x.data.name.endsWith("plan-2.md"),
      );
      assert.ok(second, "the second input is recorded");
      assert.ok(
        inputOf(p, second.data.name).includes(
          `Предыдущий план отклонён: ${detail}`,
        ),
      );
      assert.equal(ofType(events, "PLAN_RECEIVED")[0].data.tasks.length, 1);
    },
  );
}

test(
  "EN-02 the second plan is faulty too: PROJECT_WAITING plan_failed, a question, no task is created",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      scenarioRun(
        { purpose: "plan" },
        { outcome: "ok", answer: { tasks: FORTY_ONE } },
      ),
    ]);
    const e = startEngine(t, p);
    await stopWhen(
      t,
      p,
      e,
      (x) => x.type === "CHAT" && x.data.kind === "question",
    );
    const events = journal(p);
    assert.deepStrictEqual(
      ofType(events, "PLAN_REJECTED").map((x) => [
        x.data.attempt,
        x.data.reason,
      ]),
      [
        [1, "too_many"],
        [2, "too_many"],
      ],
    );
    const waiting = ofType(events, "PROJECT_WAITING");
    assert.deepStrictEqual(
      waiting.map((x) => x.data.reason),
      ["plan_failed"],
    );
    const question = ofType(events, "CHAT").filter(
      (x) => x.data.kind === "question",
    );
    assert.equal(question.length, 1);
    assert.equal(
      question[0].data.text,
      "Не удалось составить план. Уточните цель сообщением и продолжите проект или остановите его",
    );
    assert.equal(ofType(events, "TASK_CREATED").length, 0);
    assert.equal(ofType(events, "PLAN_RECEIVED").length, 0);
    assert.equal(e.engine.state().tasks.length, 0);
  },
);

// ---- EN-03 -----------------------------------------------------------------------

test(
  "EN-03 a plan of exactly 40 tasks is accepted",
  { timeout: 60_000 },
  async (t) => {
    const forty = Array.from({ length: 40 }, (_, i) => planItem(`k${i}`));
    const p = engineProject(t, [
      scenarioRun(
        { purpose: "plan" },
        { outcome: "ok", answer: { tasks: forty } },
      ),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 5000 }]),
    ]);
    const e = startEngine(t, p);
    await stopWhen(t, p, e, (x) => x.type === "PLAN_RECEIVED");
    const events = journal(p);
    assert.equal(ofType(events, "PLAN_REJECTED").length, 0);
    assert.equal(ofType(events, "PLAN_RECEIVED")[0].data.tasks.length, 40);
    assert.equal(e.engine.state().tasks.length, 40);
  },
);

// ---- EN-05 -----------------------------------------------------------------------

test(
  "EN-05 a failed run of the planner is not a fault of a plan: PROJECT_WAITING plan_failed without PLAN_REJECTED",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      scenarioRun({ purpose: "plan" }, { outcome: "failed" }),
    ]);
    const e = startEngine(t, p);
    await stopWhen(
      t,
      p,
      e,
      (x) => x.type === "CHAT" && x.data.kind === "question",
    );
    const events = journal(p);
    assert.equal(ofType(events, "PLAN_REJECTED").length, 0);
    assert.equal(ofType(events, "PLAN_RETRY").length, 0);
    assert.deepStrictEqual(
      ofType(events, "PROJECT_WAITING").map((x) => x.data.reason),
      ["plan_failed"],
    );
    assert.equal(ofType(events, "RUN_STARTED").length, 1, "no second attempt");
    assert.equal(
      events.find((x) => x.type === "CHAT" && x.data.kind === "question").data
        .text,
      "Не удалось составить план: Исполнитель завершился с ошибкой. Уточните цель сообщением и продолжите проект или остановите его",
    );
  },
);

test(
  "EN-05 an answer out of the schema of the executor (invalid_output) is the fault schema",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      scenarioRun(
        { purpose: "plan", attempt: 1 },
        { outcome: "ok", answer: { tasks: [{ key: "a", extra: 1 }] } },
      ),
      scenarioRun(
        { purpose: "plan", attempt: 2 },
        { outcome: "ok", answer: { tasks: [planItem("a")] } },
      ),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 5000 }]),
    ]);
    const e = startEngine(t, p);
    await stopWhen(t, p, e, (x) => x.type === "PLAN_RECEIVED");
    const rejected = ofType(journal(p), "PLAN_REJECTED");
    assert.deepStrictEqual(rejected[0].data, {
      round: 0,
      attempt: 1,
      reason: "schema",
      detail: "План не соответствует схеме",
    });
  },
);
