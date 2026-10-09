// Helpers of the tests of the engine of Sai Team (design REQ-013, section 21;
// decisions/0020). Not a test file.
//
// The rule of these tests: an executor is started only after assertSafeEnv
// (exec-helpers.js) — the data folder and HOME are temporary, the executable is
// the fake one of fixtures/team. Waits are by an event of the journal, never by a
// pause. Every project made here checks on its end that no PROJECT_DONE came
// without a passed goal check before it (EN-47).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createEngine } from "../src/team/engine/engine.js";
import { createProject } from "../src/team/store.js";
import {
  assertSafeEnv,
  execEnv,
  journal,
  makeSandbox,
  spawnTeam,
  types,
  waitUntil,
  withLimit,
} from "./exec-helpers.js";

export const GOAL = "Сравнить вымышленные цены трёх поставщиков";

export const ok = (answer) => ({ outcome: "ok", answer });
export const WORK_OK = ok({
  summary: "Готово по вымышленным данным",
  files: [],
});
export const PASS = ok({ passed: true, notes: "Критерий выполнен" });
export const GOAL_OK = ok({ passed: true, notes: "Цель достигнута" });

// One record of the scenario of scripted; every record sets its cost.
export const scenarioRun = (match, result, steps = []) => ({
  match,
  steps,
  result: { cost_usd: 0.01, ...result },
});
export const planRun = (tasks, steps = []) =>
  scenarioRun({ purpose: "plan" }, ok({ tasks }), steps);
export const item = (key, over = {}) => ({
  key,
  role: "researcher",
  text: `Вымышленная задача ${key}`,
  done_when: "Есть итог",
  depends_on: [],
  critical: false,
  ...over,
});

export const isQuestion = (e) =>
  e.type === "CHAT" && e.data.kind === "question";

// EN-47: PROJECT_DONE only after a passed GOAL_CHECK_RESULT.
export function assertDoneAfterGoal(events) {
  let passed = false;
  for (const e of events) {
    if (e.type === "GOAL_CHECK_RESULT") passed = e.data.passed === true;
    if (e.type === "PROJECT_DONE") {
      assert.ok(
        passed,
        `PROJECT_DONE without a passed goal check (seq ${e.seq})`,
      );
    }
  }
}

// A project of the scripted executor with the scenario `runs`:
// { sb, env, id, dir, events, scenario }.
export function engineProject(t, runs, over = {}) {
  const sb = makeSandbox(t);
  const env = execEnv(sb, over.env ?? {});
  assertSafeEnv(env);
  const { id } = createProject(
    {
      goal: over.goal ?? GOAL,
      budget_usd: over.budget ?? 5,
      executor: "scripted",
      scenario_bytes: Buffer.from(JSON.stringify({ version: 1, runs })),
    },
    { home: sb.home },
  );
  const dir = path.join(sb.home, id);
  const p = {
    sb,
    env,
    id,
    dir,
    events: path.join(dir, "events.jsonl"),
    scenario: path.join(dir, "scenario.json"),
  };
  t.after(() => {
    if (fs.existsSync(p.events)) assertDoneAfterGoal(journal(p));
  });
  return p;
}

// The engine in the process of the test; stopped (pause and exit) after the test.
export function startEngine(t, p, opts = {}) {
  assertSafeEnv(p.env);
  const engine = createEngine(p.id, {
    home: p.sb.home,
    env: p.env,
    mode: "start",
    ...opts,
  });
  const running = engine.run();
  t.after(async () => {
    engine.requestStop("signal");
    await running.catch(() => {});
  });
  return { engine, running };
}

export async function runToEnd(p, opts = {}) {
  assertSafeEnv(p.env);
  const engine = createEngine(p.id, {
    home: p.sb.home,
    env: p.env,
    mode: "start",
    ...opts,
  });
  return withLimit(engine.run());
}

export async function until(p, pred, what, ms = 20_000) {
  const seen = await waitUntil(() => journal(p).some(pred), ms);
  assert.ok(seen, `${what} did not come: ${types(journal(p)).join(", ")}`);
}

export async function pauseAndExit(e) {
  e.engine.requestStop("signal");
  return withLimit(e.running);
}

// The scripted executor reads the copy of its scenario in the project at every
// run: a test replaces it to make the next runs behave otherwise.
export function rewriteScenario(p, runs) {
  fs.writeFileSync(p.scenario, JSON.stringify({ version: 1, runs }), {
    mode: 0o600,
  });
}

// The texts of the recorded inputs (record_input) whose names end with `suffix`.
export function inputs(p, suffix) {
  return journal(p)
    .filter((e) => e.type === "RESULT_FILE" && e.data.name.endsWith(suffix))
    .map((e) =>
      fs.readFileSync(path.join(p.dir, "files", e.data.name), "utf8"),
    );
}

// ---- the engine as a process and the channel (design REQ-013, section 13) ---------

// The engine of a project as a child process (start or resume), through the
// command line; after the test it is killed if still alive.
export function spawnEngine(t, p, argv = ["start", p.id]) {
  assertSafeEnv(p.env);
  const run = spawnTeam(argv, p.env);
  t.after(() => {
    if (run.child.exitCode === null && run.child.signalCode === null) {
      run.child.kill("SIGKILL");
    }
  });
  return run;
}

// Waits until the engine holds the lock with holder "engine" and inbox/ is ready.
export async function engineReady(p, ms = 20_000) {
  const ok = await waitUntil(() => {
    try {
      const lock = JSON.parse(
        fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8"),
      );
      return (
        lock.holder === "engine" &&
        fs.existsSync(path.join(p.dir, "inbox", "ack")) &&
        journal(p).some((e) => e.source === "USER")
      );
    } catch {
      return false;
    }
  }, ms);
  assert.ok(ok, "the engine did not get ready");
  return JSON.parse(fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8"));
}

// The engine in the process of the test with a hand-driven poll: tick() runs one
// poll (the inbox and the schedule) when the test wants it.
export function manualEngine(t, p, opts = {}) {
  assertSafeEnv(p.env);
  const timers = [];
  const engine = createEngine(p.id, {
    home: p.sb.home,
    env: p.env,
    mode: "start",
    poll: {
      setTimer: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimer: () => {},
    },
    ...opts,
  });
  const running = engine.run();
  t.after(async () => {
    engine.requestStop("signal");
    await running.catch(() => {});
  });
  const tick = () => {
    const fn = timers.shift();
    if (fn !== undefined) fn();
  };
  return { engine, running, tick };
}

// The USER events of a journal that carry a message of the channel.
export const viaChannel = (events) =>
  events.filter((e) => e.source === "USER" && e.data.msg !== undefined);
