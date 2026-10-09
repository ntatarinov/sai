// Sai Team engine: critical tasks, approvals and the decisions of the user (design
// REQ-013, section 21, criterion 6: EN-35 ... EN-39) and the closed tasks of C1
// (EN-80). Only the scripted executor is started, after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TeamError } from "../src/team/errors.js";
import { phrasesForJournal } from "../src/team/language.js";
import { replay } from "../src/team/reducer.js";
import { TEAM_SRC, journal, ofType, types, withLimit } from "./exec-helpers.js";
import {
  endRun,
  eng,
  journalOf,
  makeClock,
  makeHome,
  planTask,
  sha256,
  startProject,
  startRun,
  usr,
  withPlan,
  workTask,
} from "./team-helpers.js";
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

// ---- EN-80 (C1), the core part --------------------------------------------------------

function reviewPassed(w, id) {
  workTask(w, id);
  w.append(eng("TASK_REVIEW", {}, id));
  const run = startRun(w, "review", "reviewer", id);
  endRun(w, run, id);
  w.append(
    eng("REVIEW_RESULT", { run_id: run, passed: true, notes: "Хорошо" }, id),
  );
}

function goalCheck(w, passed) {
  const run = startRun(w, "goal_check", "reviewer");
  w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: run }));
  endRun(w, run);
  w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: run,
      passed,
      notes: passed ? "Цель достигнута" : "Нет",
    }),
  );
}

test("EN-80 (core) after reject the dependents are closed by dependency_closed and the project reaches PROJECT_DONE with the rest done and a passed goal check", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  withPlan(w, [
    planTask("t-0001", "marketer", { critical: true }),
    planTask("t-0002", "designer", { depends_on: ["t-0001"] }),
    planTask("t-0003", "researcher"),
  ]);
  reviewPassed(w, "t-0001");
  w.writeResultFile({
    task: "t-0001",
    name: "t-0001-1-post.md",
    content: "Черновик поста",
    kind: "draft",
  });
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "approval", draft: "t-0001-1-post.md" },
      "t-0001",
    ),
  );
  w.append(
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0001"),
  );
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "rejected_by_user", detail: "Отклонено пользователем" },
      "t-0001",
    ),
  );
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "dependency_closed", detail: "Задача зависит от отклонённой" },
      "t-0002",
    ),
  );
  reviewPassed(w, "t-0003");
  w.append(
    eng("TASK_DONE", { via: "review", external_action_done: false }, "t-0003"),
  );
  goalCheck(w, true);
  w.append(eng("PROJECT_DONE"));
  assert.equal(w.state.status, "done");
  const events = journalOf(p.events);
  assert.deepStrictEqual(replay(events), w.state);
  const t2 = events.filter(
    (e) => e.type === "TASK_FAILED" && e.task === "t-0002",
  );
  assert.equal(t2.length, 1);
  assert.equal(t2[0].data.reason, "dependency_closed");
});

test("EN-80 (core) PROJECT_DONE without at least one done task is E_TRANSITION, the journal is byte for byte the same", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  withPlan(w, [planTask("t-0001", "marketer", { critical: true })]);
  reviewPassed(w, "t-0001");
  w.writeResultFile({
    task: "t-0001",
    name: "t-0001-1-post.md",
    content: "Черновик",
    kind: "draft",
  });
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "approval", draft: "t-0001-1-post.md" },
      "t-0001",
    ),
  );
  w.append(
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0001"),
  );
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "rejected_by_user", detail: "Отклонено пользователем" },
      "t-0001",
    ),
  );
  goalCheck(w, true);
  const before = sha256(fs.readFileSync(p.events));
  let caught = null;
  try {
    w.append(eng("PROJECT_DONE"));
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof TeamError);
  assert.equal(caught.code, "E_TRANSITION");
  assert.equal(caught.details.rule, "И6");
  assert.equal(
    sha256(fs.readFileSync(path.join(p.dir, "events.jsonl"))),
    before,
  );
  assert.equal(w.state.status, "running");
});

// ---- EN-35 ... EN-39, EN-80 with the engine --------------------------------------

const DRAFT = scenarioRun(
  { purpose: "work", task: "t-0001" },
  {
    ...WORK_OK,
    files: [
      { name: "post.md", content: "Вымышленный черновик поста", kind: "draft" },
    ],
  },
  [{ record_input: "input.md" }],
);

function criticalProject(t, extra = []) {
  return engineProject(t, [
    planRun(
      [
        item("post", { role: "marketer", critical: true }),
        item("after", { depends_on: ["post"] }),
        item("other"),
      ],
      [{ record_input: "plan.md" }],
    ),
    DRAFT,
    ...extra,
    scenarioRun({ purpose: "work" }, WORK_OK),
    scenarioRun({ purpose: "review" }, PASS),
    scenarioRun({ purpose: "goal_check" }, GOAL_OK),
  ]);
}

async function untilApproval(p) {
  await until(
    p,
    (x) => isQuestion(x) && x.task === "t-0001",
    "the question of the approval",
  );
}

test(
  "EN-35 a critical task: its draft is a file, it waits for the user after the check, the question asks for a decision, its dependents do not begin",
  { timeout: 60_000 },
  async (t) => {
    const p = criticalProject(t);
    const e = startEngine(t, p);
    await untilApproval(p);
    await pauseAndExit(e);
    const events = journal(p);
    const draft = ofType(events, "RESULT_FILE").find(
      (x) => x.data.kind === "draft",
    );
    assert.equal(draft.task, "t-0001");
    assert.equal(draft.data.name, "t-0001-1-post.md");
    assert.equal(
      fs.readFileSync(path.join(p.dir, "files", draft.data.name), "utf8"),
      "Вымышленный черновик поста",
    );
    const [input] = inputs(p, "-input.md");
    assert.ok(
      input.includes(
        "Это действие нельзя выполнять: подготовьте черновик файлом и отметьте его видом draft",
      ),
    );
    const own = events.filter((x) => x.task === "t-0001");
    assert.deepStrictEqual(types(own).slice(-3), [
      "TASK_WAITING_USER",
      "PROJECT_WAITING",
      "CHAT",
    ]);
    assert.deepStrictEqual(ofType(own, "TASK_WAITING_USER")[0].data, {
      reason: "approval",
      draft: "t-0001-1-post.md",
    });
    const review = ofType(own, "REVIEW_RESULT");
    assert.equal(review.length, 1, "the critical task passed a check first");
    assert.ok(
      events
        .find((x) => isQuestion(x) && x.task === "t-0001")
        .data.text.startsWith(
          "От вас требуется решение: черновик задачи «Вымышленная задача post» готов",
        ),
    );
    assert.equal(
      events.filter((x) => x.type === "TASK_STARTED" && x.task === "t-0002")
        .length,
      0,
    );
    assert.equal(
      ofType(events, "TASK_DONE").filter((x) => x.task === "t-0001").length,
      0,
    );
  },
);

test(
  "EN-36 answer approve: DECISION_RECEIVED of the user, TASK_DONE via approval without an action outside, its phrase says so",
  { timeout: 60_000 },
  async (t) => {
    const p = criticalProject(t);
    const e = startEngine(t, p);
    await untilApproval(p);
    const decision = await e.engine.command({
      kind: "answer",
      args: { task: "t-0001", decision: "approve", text: null },
    });
    assert.equal(decision.source, "USER");
    assert.deepStrictEqual(decision.data, { decision: "approve", text: null });
    const result = await withLimit(e.running);
    assert.equal(result.status, "done");
    const events = journal(p);
    const done = events.find(
      (x) => x.type === "TASK_DONE" && x.task === "t-0001",
    );
    assert.deepStrictEqual(done.data, {
      via: "approval",
      external_action_done: false,
    });
    assert.ok(done.seq > decision.seq);
    const phrases = phrasesForJournal(events);
    assert.equal(
      phrases[events.indexOf(done)],
      "Черновик принят, действие вовне не выполнено — тестовый исполнитель",
    );
    assert.ok(
      events.some((x) => x.type === "TASK_STARTED" && x.task === "t-0002"),
      "the dependent begins after the approval",
    );
  },
);

test(
  "EN-37 answer change --text: the critical task runs again with the text in its input",
  { timeout: 60_000 },
  async (t) => {
    const p = criticalProject(t);
    const e = startEngine(t, p);
    await untilApproval(p);
    const decision = await e.engine.command({
      kind: "answer",
      args: {
        task: "t-0001",
        decision: "change",
        text: "Сделайте тон дружелюбнее",
      },
    });
    await until(
      p,
      (x) => x.type === "TASK_WAITING_USER" && x.seq > decision.seq,
      "the second approval",
    );
    await pauseAndExit(e);
    const all = inputs(p, "-input.md");
    assert.equal(all.length, 2);
    assert.equal(all[0].includes("Сделайте тон дружелюбнее"), false);
    assert.ok(all[1].includes("Сделайте тон дружелюбнее"));
    assert.ok(all[1].includes("подготовьте черновик файлом"));
  },
);

test(
  "EN-37 and EN-80 answer reject: TASK_FAILED rejected_by_user, its dependent closed by dependency_closed, the next plan hears of it, and the project is done with the rest done and a passed goal check",
  { timeout: 60_000 },
  async (t) => {
    const p = criticalProject(t);
    const e = startEngine(t, p);
    await untilApproval(p);
    await until(
      p,
      (x) => x.type === "TASK_DONE" && x.task === "t-0003",
      "the independent task",
    );
    rewriteScenario(p, [
      planRun([item("instead")], [{ record_input: "plan.md" }]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const decision = await e.engine.command({
      kind: "answer",
      args: { task: "t-0001", decision: "reject", text: null },
    });
    const result = await withLimit(e.running);
    assert.equal(result.status, "done");
    const events = journal(p).filter((x) => x.seq > decision.seq);
    assert.deepStrictEqual(
      ofType(events, "TASK_FAILED").map((x) => [
        x.task,
        x.data.reason,
        x.data.detail,
      ]),
      [
        ["t-0001", "rejected_by_user", "Отклонено пользователем"],
        ["t-0002", "dependency_closed", "Задача зависит от отклонённой"],
      ],
    );
    const state = e.engine.state();
    assert.deepStrictEqual(
      state.tasks.map((x) => [x.id, x.status]),
      [
        ["t-0001", "failed"],
        ["t-0002", "failed"],
        ["t-0003", "done"],
        ["t-0004", "done"],
      ],
    );
    const plans = inputs(p, "-plan.md");
    assert.equal(plans.length, 2);
    assert.match(
      plans[1],
      /— t-0001: Вымышленная задача post — отклонена пользователем/,
    );
    assert.match(
      plans[1],
      /— t-0002: Вымышленная задача after — закрыта: зависела от отклонённой задачи/,
    );
    assert.equal(state.status, "done");
  },
);

test(
  "EN-38 an answer for a task that does not wait and for the id of a task of another project is refused; the journal is unchanged",
  { timeout: 60_000 },
  async (t) => {
    const other = engineProject(t, [
      planRun([item("w"), item("x"), item("y"), item("z")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 5000 }]),
    ]);
    const p = criticalProject(t);
    // the other project has t-0004; this one has only t-0001 ... t-0003
    const second = startEngine(t, other);
    await until(
      other,
      (x) => x.type === "PLAN_RECEIVED",
      "the plan of the other",
    );
    await pauseAndExit(second);
    const e = startEngine(t, p);
    await untilApproval(p);
    const before = fs.readFileSync(p.events);
    const cases = [
      [{ task: "t-0002", decision: "reject", text: null }, "E_NOT_WAITING"],
      [{ task: "t-0003", decision: "change", text: "x" }, "E_NOT_WAITING"],
      [{ task: "t-0004", decision: "reject", text: null }, "E_TASK_NOT_FOUND"],
      [{ task: "t-0009", decision: "reject", text: null }, "E_TASK_NOT_FOUND"],
      [{ task: "t-0002", decision: "approve", text: null }, "E_NOT_WAITING"],
    ];
    for (const [args, code] of cases) {
      await assert.rejects(
        e.engine.command({ kind: "answer", args }),
        (err) => err instanceof TeamError && err.code === code,
        `${args.task} ${args.decision}`,
      );
    }
    assert.deepStrictEqual(fs.readFileSync(p.events), before);
    assert.equal(
      journal(other).some(
        (x) => x.type === "PLAN_RECEIVED" && x.data.tasks.length === 4,
      ),
      true,
      "t-0004 exists in the other project",
    );
  },
);

test("EN-39 the code of Sai Team has no network module and no fetch", () => {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".js")) {
        fs.readFileSync(abs, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (/node:(http|https|net|tls|dgram)|fetch[(]/.test(line)) {
              found.push(`${path.relative(TEAM_SRC, abs)}:${i + 1}`);
            }
          });
      }
    }
  };
  walk(TEAM_SRC);
  assert.deepStrictEqual(found, []);
});
