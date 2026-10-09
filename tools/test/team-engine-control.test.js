// Sai Team engine: pause, resume and stop (design REQ-013, section 12; criterion 9,
// part (1): EN-50 ... EN-52). The commands through the channel inbox/ follow in
// round 4 (team-channel.test.js); here the engine takes them in its own process
// and the commands work without an engine. Only the scripted executor and the fake
// executable are started, after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createEngine } from "../src/team/engine/engine.js";
import { openWriter } from "../src/team/store.js";
import {
  assertSafeEnv,
  describeRun,
  execEnv,
  fakeChildren,
  fakeStarts,
  groupAliveOf,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  pidAlive,
  runTeam,
  sha256,
  snapshot,
  types,
  waitUntil,
  withLimit,
  writePlan,
} from "./exec-helpers.js";
import {
  GOAL_OK,
  PASS,
  WORK_OK,
  engineProject,
  item,
  planRun,
  rewriteScenario,
  scenarioRun,
  startEngine,
  until,
} from "./team-engine-helpers.js";

// ---- EN-50 -----------------------------------------------------------------------

test(
  "EN-50 pause through the engine: no new task begins, the tasks in work are brought to their result; resume goes on to the end",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a"), item("b"), item("c")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 400 }]),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const e = startEngine(t, p, { parallel: 2 });
    await until(
      p,
      (x) => x.type === "TASK_STARTED" && x.task === "t-0002",
      "two tasks in work",
    );
    const paused = await e.engine.command({ kind: "pause", args: {} });
    assert.equal(paused.type, "PROJECT_PAUSED");
    assert.equal(paused.source, "USER");
    await until(
      p,
      (x) => x.type === "TASK_REVIEW" && x.task === "t-0002",
      "the second task brought to its result",
    );
    await until(
      p,
      (x) => x.type === "TASK_REVIEW" && x.task === "t-0001",
      "the first task brought to its result",
    );
    let events = journal(p);
    assert.equal(
      events.filter(
        (x) =>
          x.seq > paused.seq &&
          (x.type === "TASK_STARTED" || x.type === "RUN_STARTED"),
      ).length,
      0,
      "nothing began on pause",
    );
    assert.equal(e.engine.state().status, "paused");
    const resumed = await e.engine.command({
      kind: "resume",
      args: { parallel: null },
    });
    assert.deepStrictEqual(resumed.data, { parallel: null, after: "command" });
    const result = await withLimit(e.running);
    assert.equal(result.status, "done");
    events = journal(p);
    assert.ok(
      events.some(
        (x) =>
          x.type === "TASK_STARTED" &&
          x.task === "t-0003" &&
          x.seq > resumed.seq,
      ),
    );
  },
);

test(
  "EN-50 pause and resume without an engine: the command writes PROJECT_PAUSED itself; resume becomes the engine and finishes the project",
  { timeout: 90_000 },
  (t) => {
    const p = engineProject(t, [
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const w = openWriter(p.id, { home: p.sb.home });
    try {
      w.append({
        source: "USER",
        type: "PROJECT_STARTED",
        task: null,
        data: { parallel: 2 },
      });
      w.append({
        source: "ENGINE",
        type: "PLANNING_STARTED",
        task: null,
        data: { round: 0 },
      });
      w.append({
        source: "ENGINE",
        type: "PLAN_RECEIVED",
        task: null,
        data: {
          round: 0,
          tasks: [
            {
              id: "t-0001",
              role: "researcher",
              text: "Вымышленная задача",
              done_when: "Есть итог",
              depends_on: [],
              critical: false,
            },
          ],
        },
      });
    } finally {
      w.close();
    }
    const pause = runTeam(["pause", p.id], p.env);
    assert.equal(pause.status, 0, describeRun(pause));
    const out = JSON.parse(pause.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.event.type, "PROJECT_PAUSED");
    assert.deepStrictEqual(out.event.data, {});
    const again = runTeam(["pause", p.id], p.env);
    assert.equal(again.status, 1);
    assert.equal(
      again.stderr,
      "E_PAUSE_STATE: Поставить на паузу можно только проект в работе или ждущий решения\n",
    );
    const resume = runTeam(["resume", p.id], p.env);
    assert.equal(resume.status, 0, describeRun(resume));
    assert.deepStrictEqual(JSON.parse(resume.stdout).project, {
      id: p.id,
      status: "done",
      status_text: "выполнен",
    });
    const events = journal(p);
    assert.deepStrictEqual(
      ofType(events, "PROJECT_RESUMED").map((x) => [x.source, x.data.after]),
      [["USER", "command"]],
    );
    assert.equal(fs.existsSync(path.join(p.dir, "writer.lock")), false);
  },
);

// ---- EN-51 -----------------------------------------------------------------------

test(
  "EN-51 stop: the processes of the executor and their children are gone, the tasks interrupted by stop, PROJECT_STOPPED; resume is refused (E_STOPPED)",
  { timeout: 90_000 },
  async (t) => {
    const sb = makeSandbox(t);
    const p = makeProject(sb, { tasks: 2, role: ["researcher", "marketer"] });
    const env = execEnv(sb);
    assertSafeEnv(env);
    writePlan(sb, {
      default: { stream: "stream-ok.jsonl", hang: true, spawn_child: true },
    });
    const engine = createEngine(p.id, { home: sb.home, env, mode: "start" });
    const running = engine.run();
    t.after(async () => {
      engine.requestStop("signal");
      await running.catch(() => {});
    });
    const ready = await waitUntil(
      () => fakeStarts(sb).length === 2 && fakeChildren(sb).length === 2,
      20_000,
    );
    assert.ok(ready, "two runs and their children");
    const pids = [
      ...fakeStarts(sb).map((x) => x.pid),
      ...fakeChildren(sb).map((x) => x.pid),
    ];
    const stopped = await withLimit(engine.command({ kind: "stop", args: {} }));
    assert.equal(stopped.type, "PROJECT_STOPPED");
    assert.equal(stopped.source, "USER");
    const result = await withLimit(running);
    assert.equal(result.status, "stopped");
    for (const pid of fakeStarts(sb).map((x) => x.pid)) {
      assert.equal(groupAliveOf(pid), false, `group ${pid}`);
    }
    for (const pid of pids) assert.equal(pidAlive(pid), false, `pid ${pid}`);
    const events = journal(p);
    assert.deepStrictEqual(
      ofType(events, "TASK_INTERRUPTED").map((x) => [x.task, x.data.cause]),
      [
        ["t-0001", "stop"],
        ["t-0002", "stop"],
      ].sort(),
    );
    assert.deepStrictEqual(
      ofType(events, "RUN_FINISHED").map((x) => x.data.outcome),
      ["cancelled", "cancelled"],
    );
    assert.equal(types(events).at(-1), "PROJECT_STOPPED");
    assert.equal(Object.keys(engine.state().runs.open).length, 0);
    const before = sha256(fs.readFileSync(p.events));
    const tree = snapshot(p.dir);
    const r = runTeam(["resume", p.id], env);
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(
      r.stderr,
      "E_STOPPED: Проект остановлен — продолжить его нельзя\n",
    );
    assert.equal(sha256(fs.readFileSync(p.events)), before);
    assert.deepStrictEqual(snapshot(p.dir), tree);
  },
);

// ---- EN-52 -----------------------------------------------------------------------

test(
  "EN-52 every new command for a project that does not exist: «Проект не найден», exit 1, nothing created",
  { timeout: 90_000 },
  (t) => {
    const sb = makeSandbox(t);
    const env = execEnv(sb);
    const id = "p-20260101-abcdef";
    fs.writeFileSync(path.join(sb.home, "keep"), "x");
    const before = snapshot(sb.home);
    const commands = [
      ["start", id],
      ["resume", id],
      ["pause", id],
      ["stop", id],
      ["budget", id, "5"],
      ["answer", id, "t-0001", "approve"],
      ["say", id, "Привет"],
      ["say", id, "--text", "Привет"],
    ];
    for (const argv of commands) {
      const r = runTeam(argv, env);
      assert.equal(r.status, 1, `${argv[0]}: ${describeRun(r)}`);
      assert.equal(r.stdout, "");
      assert.equal(r.stderr, "E_NOT_FOUND: Проект не найден\n", argv[0]);
    }
    assert.deepStrictEqual(snapshot(sb.home), before);
    assert.equal(fakeStarts(sb).length, 0);
  },
);

// ---- EN-50: a pause cancels the run of the planner (section 12.1) ------------------

const SLOW_PLAN = (tasks) =>
  scenarioRun({ purpose: "plan" }, { outcome: "ok", answer: { tasks } }, [
    { delay_ms: 30_000 },
  ]);

async function pauseDuringPlan(t, p, e, round) {
  await until(
    p,
    (x) => x.type === "PLANNING_STARTED" && x.data.round === round,
    `the planning of round ${round}`,
  );
  const started = await waitUntil(() =>
    journal(p).find(
      (x) =>
        x.type === "RUN_STARTED" &&
        x.data.purpose === "plan" &&
        x.seq >
          journal(p).find(
            (y) => y.type === "PLANNING_STARTED" && y.data.round === round,
          ).seq,
    ),
  );
  assert.ok(started, "the run of the planner began");
  const paused = await e.engine.command({ kind: "pause", args: {} });
  await until(
    p,
    (x) =>
      x.type === "RUN_FINISHED" &&
      x.data.run_id === started.data.run_id &&
      x.data.outcome === "cancelled",
    `the run of the planner of round ${round} closed as cancelled`,
    5_000,
  );
  const events = journal(p);
  const closed = events.find(
    (x) => x.type === "RUN_FINISHED" && x.data.run_id === started.data.run_id,
  );
  assert.ok(closed.seq > paused.seq);
  assert.equal(
    events.filter((x) => x.type === "PLAN_RECEIVED" && x.data.round === round)
      .length,
    0,
  );
  return paused;
}

test(
  "EN-50 a pause cancels the run of the planner of round 0; resume plans the same round again",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [SLOW_PLAN([item("a")])]);
    const e = startEngine(t, p);
    await pauseDuringPlan(t, p, e, 0);
    rewriteScenario(p, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const resumed = await e.engine.command({
      kind: "resume",
      args: { parallel: null },
    });
    assert.equal((await withLimit(e.running)).status, "done");
    const again = journal(p).filter(
      (x) => x.type === "PLANNING_STARTED" && x.seq > resumed.seq,
    );
    assert.deepStrictEqual(
      again.map((x) => x.data.round),
      [0],
    );
  },
);

test(
  "EN-50 a pause cancels the run of the planner of a round of more tasks (round 1, after a failed goal check)",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun(
        { purpose: "goal_check" },
        { outcome: "ok", answer: { passed: false, notes: "Мало" } },
        [{ delay_ms: 500 }],
      ),
    ]);
    const e = startEngine(t, p);
    await until(
      p,
      (x) => x.type === "RUN_STARTED" && x.data.purpose === "goal_check",
      "the goal check",
    );
    rewriteScenario(p, [SLOW_PLAN([item("b")])]);
    await pauseDuringPlan(t, p, e, 1);
    rewriteScenario(p, [
      planRun([item("b")]),
      scenarioRun({ purpose: "work" }, WORK_OK),
      scenarioRun({ purpose: "review" }, PASS),
      scenarioRun({ purpose: "goal_check" }, GOAL_OK),
    ]);
    const resumed = await e.engine.command({
      kind: "resume",
      args: { parallel: null },
    });
    assert.equal((await withLimit(e.running)).status, "done");
    assert.deepStrictEqual(
      journal(p)
        .filter((x) => x.type === "PLANNING_STARTED" && x.seq > resumed.seq)
        .map((x) => x.data.round),
      [1],
    );
  },
);

// ---- F-2 of the review: one way for a command (receive) ---------------------------

test(
  "a command of the engine: before the opening E_INTERNAL, during a stop E_ENGINE_STOPPING, after the end E_CHANNEL_TIMEOUT «Проект завершил работу» — the same rules as the channel",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planRun([item("a")]),
      scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 30_000 }]),
    ]);
    assertSafeEnv(p.env);
    const engine = createEngine(p.id, {
      home: p.sb.home,
      env: p.env,
      mode: "start",
    });
    await assert.rejects(
      engine.command({ kind: "say", args: { text: "Рано" } }),
      (err) => err.code === "E_INTERNAL",
    );
    const running = engine.run();
    t.after(async () => {
      engine.requestStop("signal");
      await running.catch(() => {});
    });
    await until(
      p,
      (e) => e.type === "RUN_STARTED" && e.task !== null,
      "the work",
    );
    // all three in one synchronous turn: the stop is still going on for the others
    const stopping = engine.command({ kind: "stop", args: {} });
    const during = engine.command({
      kind: "say",
      args: { text: "Во время остановки" },
    });
    const second = engine.command({ kind: "stop", args: {} });
    await assert.rejects(during, (err) => err.code === "E_ENGINE_STOPPING");
    await assert.rejects(second, (err) => err.code === "E_ENGINE_STOPPING");
    assert.equal((await withLimit(stopping)).type, "PROJECT_STOPPED");
    await withLimit(running);
    await assert.rejects(
      engine.command({ kind: "say", args: { text: "Поздно" } }),
      (err) =>
        err.code === "E_CHANNEL_TIMEOUT" &&
        err.message === "Проект завершил работу. Повторите команду",
    );
    assert.equal(
      journal(p).filter((e) => e.type === "PROJECT_STOPPED").length,
      1,
    );
  },
);
