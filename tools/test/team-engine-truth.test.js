// Sai Team engine: the truth of the events (design REQ-013, sections 16 and 18;
// criterion 11: EN-70 ... EN-72). Only the scripted executor is started, after
// assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TEAM_SRC, journal, types } from "./exec-helpers.js";
import { assertStatusChanges } from "./team-helpers.js";
import {
  ok,
  WORK_OK,
  PASS,
  scenarioRun,
  item,
  isQuestion,
  engineProject,
  startEngine,
  until,
  pauseAndExit,
} from "./team-engine-helpers.js";

// Scenarios with every kind of path: a plan rejected once, a failed review and a
// new attempt, a critical task with its draft, a goal check that fails once.
function journals(t) {
  const plans = [
    scenarioRun(
      { purpose: "plan", attempt: 1 },
      ok({ tasks: [item("a", { depends_on: ["a"] })] }),
    ),
    scenarioRun(
      { purpose: "plan", attempt: 2 },
      ok({
        tasks: [
          item("a"),
          item("b", { depends_on: ["a"], role: "marketer" }),
          item("c"),
        ],
      }),
    ),
  ];
  const first = engineProject(t, [
    ...plans,
    scenarioRun({ purpose: "work" }, WORK_OK, [
      { activity: "reading" },
      { delay_ms: 50 },
      { activity: "writing", text: "Готовлю вымышленную таблицу" },
    ]),
    scenarioRun(
      { purpose: "review", task: "t-0002" },
      ok({ passed: false, notes: "Нет вывода" }),
      [{ activity: "reading" }],
    ),
    scenarioRun({ purpose: "review" }, PASS, [{ activity: "thinking" }]),
    scenarioRun(
      { purpose: "goal_check" },
      ok({ passed: false, notes: "Не хватает вывода" }),
    ),
  ]);
  return first;
}

function assertTimes(events, readAt) {
  let prev = null;
  for (const e of events) {
    const at = Date.parse(e.ts);
    assert.ok(at <= readAt, `seq ${e.seq} is later than the clock`);
    if (e.source === "ENGINE" && prev !== null) {
      assert.ok(at >= prev, `seq ${e.seq} is earlier than the previous one`);
    }
    prev = at;
  }
}

// ---- EN-70 -----------------------------------------------------------------------

test(
  "EN-70 the times of the events of the engine never go back and never pass the clock; every change of status is one event that really changes it",
  { timeout: 60_000 },
  async (t) => {
    const p = journals(t);
    const e = startEngine(t, p, { parallel: 2 });
    await until(p, isQuestion, "the question");
    // after three failed reviews of b the role changes; the run of the choice has no
    // scenario: the question about b ends the scenario
    await pauseAndExit(e);
    const events = journal(p);
    assert.ok(events.length > 40, `${events.length}`);
    assertTimes(events, Date.now());
    assertStatusChanges(events);
    const kinds = new Set(types(events));
    for (const type of [
      "PLAN_REJECTED",
      "PLAN_RETRY",
      "PLAN_RECEIVED",
      "TASK_REVIEW",
      "REVIEW_RESULT",
      "TASK_DONE",
      "PROJECT_WAITING",
      "PROJECT_PAUSED",
    ]) {
      assert.ok(kinds.has(type), type);
    }
  },
);

// ---- EN-71 -----------------------------------------------------------------------

test(
  "EN-71 every AGENT_ACTIVITY comes inside its open run, after its task began and before its result",
  { timeout: 60_000 },
  async (t) => {
    const p = journals(t);
    const e = startEngine(t, p, { parallel: 2 });
    await until(p, isQuestion, "the question");
    await pauseAndExit(e);
    const events = journal(p);
    const open = new Map();
    const started = new Set();
    let activities = 0;
    for (const ev of events) {
      if (ev.type === "TASK_STARTED") started.add(ev.task);
      if (
        [
          "TASK_REVIEW",
          "TASK_DONE",
          "TASK_FAILED",
          "TASK_INTERRUPTED",
        ].includes(ev.type)
      ) {
        if (ev.type !== "TASK_REVIEW") started.delete(ev.task);
      }
      if (ev.type === "RUN_STARTED") open.set(ev.data.run_id, ev);
      if (ev.type === "RUN_FINISHED") open.delete(ev.data.run_id);
      if (ev.type === "AGENT_ACTIVITY") {
        activities += 1;
        const run = open.get(ev.data.run_id);
        assert.ok(run, `seq ${ev.seq}: its run is open`);
        assert.equal(ev.task, run.task);
        if (run.data.purpose === "work") {
          assert.ok(started.has(ev.task), `seq ${ev.seq}: its task began`);
        }
      }
    }
    assert.ok(activities >= 6, `${activities}`);
  },
);

// ---- EN-72 -----------------------------------------------------------------------

function writePlaces(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...writePlaces(abs));
    else if (entry.name.endsWith(".js")) {
      fs.readFileSync(abs, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/appendFile|createWriteStream|writeFile/.test(line)) {
            out.push({
              file: path.relative(TEAM_SRC, abs),
              line: i + 1,
              text: line.trim(),
            });
          }
        });
    }
  }
  return out;
}

test("EN-72 the places that write files: the four of the core, and in the engine only the channel (engine/channel.js)", () => {
  const places = writePlaces(TEAM_SRC);
  const core = places.filter((x) => !x.file.startsWith(`engine${path.sep}`));
  const engine = places.filter((x) => x.file.startsWith(`engine${path.sep}`));
  assert.deepStrictEqual(core.map((x) => x.file).sort(), [
    "files.js",
    "lock.js",
    "store.js",
    "store.js",
  ]);
  for (const x of engine) {
    assert.equal(
      x.file,
      path.join("engine", "channel.js"),
      `${x.file}:${x.line}`,
    );
  }
  for (const x of places) assert.match(x.text, /fs\.writeFileSync\(/);
  // the journal is written by the core only: no engine module opens a file for
  // writing in another way
  for (const name of fs.readdirSync(path.join(TEAM_SRC, "engine"))) {
    if (name === "channel.js") continue;
    const text = fs.readFileSync(path.join(TEAM_SRC, "engine", name), "utf8");
    assert.equal(/\bfs\./.test(text), false, name);
    assert.equal(/node:fs/.test(text), false, name);
  }
});
