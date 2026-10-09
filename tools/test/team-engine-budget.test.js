// Sai Team engine: the ceiling of the project (design REQ-013, sections 6.3 and 10;
// criterion 7: EN-40 ... EN-43). The counter of runs is the journal (RUN_STARTED)
// and the ceiling of each run is its max_budget_usd — the value the executor
// claude-cli passes as --max-budget-usd. Only the scripted executor is started,
// after assertSafeEnv (see result.issues of step 22 about claude-cli).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { main } from "../src/team/cli.js";
import { openWriter } from "../src/team/store.js";
import {
  describeRun,
  journal,
  ofType,
  runTeam,
  sha256,
  types,
  withLimit,
} from "./exec-helpers.js";
import { countJournalCalls } from "./team-helpers.js";
import {
  ok,
  WORK_OK,
  PASS,
  GOAL_OK,
  item,
  isQuestion,
  engineProject,
  startEngine,
  until,
  pauseAndExit,
} from "./team-engine-helpers.js";

const costly = (match, result, cost, steps = []) => ({
  match,
  steps,
  result: { ...result, cost_usd: cost },
});
const isBudgetWait = (x) =>
  x.type === "PROJECT_WAITING" && x.data.reason === "budget";

// spent before each event: the total of the last BUDGET_SPENT before it.
function spentBefore(events, seq) {
  let spent = 0;
  let budget = null;
  for (const e of events) {
    if (e.seq >= seq) break;
    if (e.type === "PROJECT_CREATED") budget = e.data.budget_usd;
    if (e.type === "BUDGET_SET") budget = e.data.budget_usd;
    if (e.type === "BUDGET_SPENT") spent = e.data.total_usd;
  }
  return { spent, budget };
}

function budgetProject(t, budget, runs) {
  return engineProject(t, runs, { budget });
}

// ---- EN-40 -----------------------------------------------------------------------

test(
  "EN-40 the ceiling is reached: no run begins after it, PROJECT_WAITING budget and one question",
  { timeout: 60_000 },
  async (t) => {
    const p = budgetProject(t, 0.2, [
      costly({ purpose: "plan" }, ok({ tasks: [item("a"), item("b")] }), 0.05),
      costly({ purpose: "work" }, WORK_OK, 0.05),
      costly({ purpose: "review" }, PASS, 0.05),
      costly({ purpose: "goal_check" }, GOAL_OK, 0.05),
    ]);
    const e = startEngine(t, p, { parallel: 1 });
    await until(p, isQuestion, "the question");
    await pauseAndExit(e);
    const events = journal(p);
    const wait = events.find(isBudgetWait);
    assert.ok(wait, types(events).join(", "));
    const runs = ofType(events, "RUN_STARTED");
    assert.equal(runs.length, 4, "plan, work, review, work");
    assert.ok(
      runs.every((r) => r.seq < wait.seq),
      "no run after the wait",
    );
    assert.equal(ofType(events, "RUN_REFUSED").length, 0);
    const question = events.find(isQuestion);
    assert.equal(question.seq, wait.seq + 1);
    assert.equal(
      question.data.text,
      "Достигнут потолок расходов. Поднимите потолок, чтобы продолжить, или остановите проект",
    );
    assert.equal(e.engine.state().spent_usd, 0.2);
  },
);

// ---- EN-41 -----------------------------------------------------------------------

test(
  "EN-41 budget not above the spent, 0, negative or not a number: refused, the journal unchanged",
  { timeout: 60_000 },
  async (t) => {
    const p = budgetProject(t, 0.2, [
      costly({ purpose: "plan" }, ok({ tasks: [item("a")] }), 0.05),
    ]);
    const w = openWriter(p.id, { home: p.sb.home });
    try {
      w.append({
        source: "USER",
        type: "PROJECT_STARTED",
        task: null,
        data: { parallel: 1 },
      });
      w.append({
        source: "ENGINE",
        type: "PLANNING_STARTED",
        task: null,
        data: { round: 0 },
      });
      const run = w.nextRunId();
      w.append({
        source: "ENGINE",
        type: "RUN_STARTED",
        task: null,
        data: {
          run_id: run,
          purpose: "plan",
          role: "project_manager",
          executor: "scripted",
          max_budget_usd: 0.05,
        },
      });
      w.append({
        source: "ENGINE",
        type: "RUN_FINISHED",
        task: null,
        data: {
          run_id: run,
          outcome: "failed",
          summary: null,
          cost_usd: 0.05,
          files: [],
        },
      });
      w.append({
        source: "ENGINE",
        type: "BUDGET_SPENT",
        task: null,
        data: {
          run_id: run,
          cost_usd: 0.05,
          accounted: "reported",
          total_usd: 0.05,
        },
      });
    } finally {
      w.close();
    }
    const before = sha256(fs.readFileSync(p.events));
    const usage =
      "E_USAGE: Сумма: число больше 0 и не больше 100000, до 6 знаков после точки\n";
    for (const [value, code, text] of [
      ["0", 2, usage],
      ["-1", 2, usage],
      ["x", 2, usage],
      ["100001", 2, usage],
      [
        "0.05",
        1,
        "E_BUDGET_LOW: Новый потолок должен быть больше уже израсходованного\n",
      ],
      [
        "0.01",
        1,
        "E_BUDGET_LOW: Новый потолок должен быть больше уже израсходованного\n",
      ],
    ]) {
      const r = runTeam(["budget", p.id, value], p.env);
      assert.equal(r.status, code, `${value}: ${describeRun(r)}`);
      assert.equal(r.stderr, text, value);
      assert.equal(sha256(fs.readFileSync(p.events)), before, value);
    }
    const missing = runTeam(["budget", p.id], p.env);
    assert.equal(missing.status, 2);
    assert.equal(missing.stderr, "E_USAGE: Нужна сумма: budget <id> <сумма>\n");
    // a refusal of the form never opens the journal
    const counts = countJournalCalls(t, p.events);
    const io = { stdout: { write: () => {} }, stderr: { write: () => {} } };
    assert.equal(main(["budget", p.id, "0"], p.env, io), 2);
    assert.deepStrictEqual(counts, {
      writeSync: 0,
      fsyncSync: 0,
      ftruncateSync: 0,
    });
  },
);

// ---- EN-42 -----------------------------------------------------------------------

test(
  "EN-42 a bigger ceiling: BUDGET_SET of the user; resume goes on and every run gets a ceiling within the new rest",
  { timeout: 60_000 },
  async (t) => {
    const p = budgetProject(t, 0.2, [
      costly({ purpose: "plan" }, ok({ tasks: [item("a"), item("b")] }), 0.05),
      costly({ purpose: "work" }, WORK_OK, 0.05),
      costly({ purpose: "review" }, PASS, 0.05),
      costly({ purpose: "goal_check" }, GOAL_OK, 0.05),
    ]);
    const e = startEngine(t, p, { parallel: 1 });
    await until(p, isQuestion, "the question");
    const before = sha256(fs.readFileSync(p.events));
    await assert.rejects(
      e.engine.command({ kind: "resume", args: { parallel: null } }),
      (err) => err.code === "E_BUDGET_NEEDED",
    );
    await assert.rejects(
      e.engine.command({ kind: "budget", args: { budget_usd: 0.2 } }),
      (err) => err.code === "E_BUDGET_LOW",
    );
    assert.equal(sha256(fs.readFileSync(p.events)), before);
    const set = await e.engine.command({
      kind: "budget",
      args: { budget_usd: 0.5 },
    });
    assert.equal(set.source, "USER");
    assert.deepStrictEqual(set.data, { budget_usd: 0.5 });
    const resumed = await e.engine.command({
      kind: "resume",
      args: { parallel: null },
    });
    assert.equal(resumed.data.after, "budget");
    const result = await withLimit(e.running);
    assert.equal(result.status, "done");
    const events = journal(p);
    const after = ofType(events, "RUN_STARTED").filter(
      (r) => r.seq > resumed.seq,
    );
    assert.ok(after.length >= 2, "the review of b and the goal check");
    for (const run of after) {
      const { spent, budget } = spentBefore(events, run.seq);
      assert.equal(budget, 0.5);
      assert.ok(
        run.data.max_budget_usd <= budget - spent + 1e-9,
        JSON.stringify(run),
      );
      assert.ok(run.data.max_budget_usd > 0);
    }
  },
);

// ---- EN-43 -----------------------------------------------------------------------

test(
  "EN-43 two runs at once: the sum of the ceilings of the open runs never exceeds the rest",
  { timeout: 60_000 },
  async (t) => {
    const p = budgetProject(t, 0.3, [
      costly({ purpose: "plan" }, ok({ tasks: [item("a"), item("b")] }), 0.2),
      costly({ purpose: "work" }, WORK_OK, 0.01, [{ delay_ms: 300 }]),
      costly({ purpose: "review" }, PASS, 0.01),
      costly({ purpose: "goal_check" }, GOAL_OK, 0.01),
    ]);
    const e = startEngine(t, p, { parallel: 2 });
    await until(
      p,
      (x) => x.type === "RUN_FINISHED" && x.task !== null,
      "the first work",
    );
    await pauseAndExit(e);
    const events = journal(p);
    const open = new Map();
    let together = 0;
    for (const ev of events) {
      if (ev.type === "RUN_STARTED") {
        open.set(ev.data.run_id, ev.data.max_budget_usd);
        const { spent, budget } = spentBefore(events, ev.seq);
        const sum = [...open.values()].reduce((s, x) => s + x, 0);
        assert.ok(sum <= budget - spent + 1e-9, `${sum} > ${budget - spent}`);
        together = Math.max(together, open.size);
      }
      if (ev.type === "RUN_FINISHED") open.delete(ev.data.run_id);
    }
    assert.equal(together, 2, "two runs were open at once");
    const works = ofType(events, "RUN_STARTED").filter(
      (r) => r.data.purpose === "work",
    );
    assert.deepStrictEqual(
      works.slice(0, 2).map((r) => r.data.max_budget_usd),
      [0.075, 0.025],
    );
  },
);
