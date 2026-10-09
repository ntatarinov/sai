// Sai Team engine: the hang of the check of the ceiling (design REQ-013, section 22,
// M25). A separate file: with the mutant "enough() is always true" the in-process
// tests of team-engine-budget.test.js hang in a loop; this one runs the engine as
// a process with its own limit, so the mutant gives a red test, not a hang.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  journal,
  ofType,
  runTeam,
  types,
  describeRun,
  withLimit,
} from "./exec-helpers.js";
import {
  ok,
  WORK_OK,
  PASS,
  GOAL_OK,
  item,
  isQuestion,
  engineProject,
  until,
  spawnEngine,
} from "./team-engine-helpers.js";

const costly = (match, result, cost) => ({
  match,
  steps: [],
  result: { ...result, cost_usd: cost },
});
const isBudgetWait = (x) =>
  x.type === "PROJECT_WAITING" && x.data.reason === "budget";
const budgetProject = (t, budget, runs) => engineProject(t, runs, { budget });

// ---- M25 -------------------------------------------------------------------------

test(
  "EN-40 (M25) the engine as a process: at the ceiling it asks the question within its own limit; a hang of the check of the ceiling is a red test, not a wait",
  { timeout: 60_000 },
  async (t) => {
    const p = budgetProject(t, 0.2, [
      costly({ purpose: "plan" }, ok({ tasks: [item("a"), item("b")] }), 0.05),
      costly({ purpose: "work" }, WORK_OK, 0.05),
      costly({ purpose: "review" }, PASS, 0.05),
      costly({ purpose: "goal_check" }, GOAL_OK, 0.05),
    ]);
    const run = spawnEngine(t, p, ["start", p.id, "--parallel", "1"]);
    // the engine is another process: a loop in it cannot stop the timers of the test
    await until(p, isQuestion, "the question at the ceiling", 20_000);
    const events = journal(p);
    const wait = events.find(isBudgetWait);
    assert.ok(wait, types(events).join(", "));
    assert.ok(
      ofType(events, "RUN_STARTED").every((r) => r.seq < wait.seq),
      "no run after the wait",
    );
    assert.equal(ofType(events, "RUN_STARTED").length, 4);
    assert.equal(run.child.exitCode, null, "the engine is alive and waits");
    // stop the engine through the channel and wait for its end within a limit
    const stopped = runTeam(["stop", p.id], p.env);
    assert.equal(stopped.status, 0, describeRun(stopped));
    const done = await withLimit(run.done, 20_000);
    assert.equal(done.status, 0, done.stderr);
  },
);
