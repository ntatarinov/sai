// Sai Team core: recovery after a crash, reading of a broken journal (design
// REQ-009, TM-16, TM-17, TM-18, TM-19, TM-51, TM-54, TM-64, TM-65, TM-66, TM-67, TM-68).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { TeamError } from "../src/team/errors.js";
import { reduce } from "../src/team/reducer.js";
import { openWriter, readProject } from "../src/team/store.js";
import { withFaults } from "./fault-inject.js";
import {
  assertAppendRefused,
  assertRefusal,
  assertDead,
  assertStatusChanges,
  countJournalCalls,
  crashWriter,
  deadPid,
  describeRun,
  endRun,
  eng,
  journalOf,
  lockOf,
  loseLockAfterAppend,
  makeClock,
  makeHome,
  newProject,
  openTracked,
  planTask,
  RECOVERY_FIXTURE,
  BATCH_TYPES,
  runRecoveryOpen,
  runTeam,
  runOpeners,
  runWriterChild,
  sha256,
  snapshot,
  startProject,
  startRun,
  typesOf,
  usr,
  withPlan,
} from "./team-helpers.js";

// A project in work whose writer has gone: a task in work, the journal then gets a
// tail. (r5) The writer is closed by close() and the tail is added to the journal: the
// only crash of this fixture is the cut line (way (b) of section 15.1). `afterStart`
// writes more after the start of t-0001. Returns { id, dir, events, home, clock }.
function crashed(
  t,
  tail,
  build = (w) => withPlan(w, [planTask("t-0001", "developer")]),
  afterStart = () => {},
) {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  build(p.writer);
  p.writer.append({
    source: "ENGINE",
    type: "TASK_STARTED",
    task: "t-0001",
    data: {},
  });
  afterStart(p.writer);
  p.writer.close();
  if (tail !== undefined) fs.appendFileSync(p.events, tail);
  return { ...p, home, clock };
}

// The fixture of a real crash (TM-54): three open runs, a task on review with an open
// review run, another on review with no open run.
const FIXTURE_CRASH_RUNNING = `H.withPlan(w, [
  H.planTask("t-0001", "developer"),
  H.planTask("t-0002", "designer"),
  H.planTask("t-0003", "lawyer"),
]);
w.append(H.eng("TASK_STARTED", {}, "t-0001"));
H.startRun(w, "work", "developer", "t-0001");
w.append(H.eng("TASK_STARTED", {}, "t-0002"));
H.endRun(w, H.startRun(w, "work", "designer", "t-0002"), "t-0002");
w.append(H.eng("TASK_REVIEW", {}, "t-0002"));
H.startRun(w, "review", "reviewer", "t-0002");
w.append(H.eng("TASK_STARTED", {}, "t-0003"));
H.endRun(w, H.startRun(w, "work", "lawyer", "t-0003"), "t-0003");
w.append(H.eng("TASK_REVIEW", {}, "t-0003"));
H.startRun(w, "goal_check", "reviewer");`;

const PARTIAL = '{"seq":9,"ts":"2026-01-01T09:00:00.1';
const NOT_JSON = "{это не JSON\n";

function out(r) {
  assert.equal(r.status, 0, describeRun(r));
  return JSON.parse(r.stdout);
}

// ---- TM-16 ---------------------------------------------------------------------------

for (const [name, tail] of [
  ["a tail without a line break", PARTIAL],
  ["a tail that is not JSON, with a line break", NOT_JSON],
]) {
  test(`TM-16 reading with ${name}: the state of the whole lines, a note, no change of the files`, (t) => {
    const p = crashed(t, tail);
    const before = snapshot(p.dir);
    const wholeLines = journalOf(p.events).length;

    const project = out(runTeam(p.home, ["project", p.id])).project;
    assert.equal(project.tasks[0].status, "running");
    assert.equal(project.tasks[0].status_text, "в работе");
    assert.equal(project.status, "running");
    assert.equal(project.tail.line, wholeLines + 1);
    assert.equal(project.tail.bytes, Buffer.byteLength(tail));
    assert.equal(project.tail.text, "Последняя строка журнала не дописана");

    const events = out(runTeam(p.home, ["events", p.id, "--limit", "200"]));
    assert.equal(events.events.length, wholeLines);
    assert.equal(events.tail.line, wholeLines + 1);
    assert.equal(events.tail.text, "Последняя строка журнала не дописана");

    const list = out(runTeam(p.home, ["projects"])).projects;
    assert.equal(list.length, 1);
    assert.equal(list[0].tail.line, wholeLines + 1);

    const api = readProject(p.id, { home: p.home });
    assert.equal(api.tail.line, wholeLines + 1);
    assert.equal(api.state.tasks[0].status, "running");
    assert.deepStrictEqual(snapshot(p.dir), before, "reading changes nothing");
  });
}

// ---- TM-17 ---------------------------------------------------------------------------

test("TM-17 say cuts the broken tail, names it, closes the open run, interrupts the task in work", (t) => {
  const tail = '{"seq":9,"text":"привет, мир';
  const p = crashed(t, tail, undefined, (w) =>
    startRun(w, "work", "developer", "t-0001"),
  );
  const whole = fs
    .readFileSync(p.events)
    .subarray(0, fs.statSync(p.events).size - Buffer.byteLength(tail));
  const lines = journalOf(p.events).length;

  const res = out(runTeam(p.home, ["say", p.id, "--text", "После аварии"]));
  const after = fs.readFileSync(p.events);
  assert.ok(
    after.subarray(0, whole.length).equals(whole),
    "the whole lines are the same",
  );
  const events = journalOf(p.events);
  assert.deepStrictEqual(typesOf(events.slice(lines)), [
    "JOURNAL_RECOVERED",
    "RUN_FINISHED",
    "TASK_INTERRUPTED",
    "PROJECT_RECOVERED",
    "CHAT",
  ]);
  const [recovered, finished, interrupted, projectRecovered] =
    events.slice(lines);
  assert.deepStrictEqual(finished.data, {
    run_id: "r-00001",
    outcome: "interrupted",
    summary: null,
    cost_usd: null,
    files: [],
  });
  assert.equal(finished.task, "t-0001");
  assert.deepStrictEqual(projectRecovered.data, {
    from_status: "running",
    closed_runs: 1,
    interrupted_tasks: 1,
  });
  assert.deepStrictEqual(recovered.data, {
    line: lines + 1,
    dropped_bytes: Buffer.byteLength(tail),
  });
  assert.equal(recovered.source, "ENGINE");
  assert.equal(interrupted.task, "t-0001");
  assert.deepStrictEqual(interrupted.data, { cause: "recovery" });
  assert.ok(res.notices.some((n) => n.includes("Журнал восстановлен")));
  assert.ok(res.notices.some((n) => n.includes("t-0001")));
  assert.equal(res.event.type, "CHAT");
  assert.equal(res.event.data.text, "После аварии");
  assert.equal(readProject(p.id, { home: p.home }).tail, null);
});

test("TM-17 a last whole line that is not JSON is cut with its line break counted", (t) => {
  const p = crashed(t, NOT_JSON);
  const lines = journalOf(p.events).length;
  runTeam(p.home, ["say", p.id, "--text", "Привет"]);
  const recovered = journalOf(p.events)[lines];
  assert.equal(recovered.type, "JOURNAL_RECOVERED");
  assert.deepStrictEqual(recovered.data, {
    line: lines + 1,
    dropped_bytes: Buffer.byteLength(NOT_JSON),
  });
});

// ---- TM-18 ---------------------------------------------------------------------------

function middle(t, bad) {
  const p = crashed(t);
  const events = journalOf(p.events);
  const first = JSON.stringify(events[0]);
  const next = (seq, over = {}) =>
    JSON.stringify({
      seq,
      ts: events[0].ts,
      project: p.id,
      task: null,
      source: "USER",
      type: "CHAT",
      data: { text: "Привет", kind: "message", truncated: false },
      ...over,
    });
  const lines = [first, bad(next), next(3)];
  fs.writeFileSync(p.events, `${lines.join("\n")}\n`);
  return p;
}

for (const [name, bad] of [
  ["a line that is not JSON", () => "{не JSON"],
  ["a line with a wrong number", (next) => next(5)],
  [
    "a line with a type that does not exist",
    (next) => next(2, { type: "NO_SUCH" }),
  ],
  [
    "a line of another project",
    (next) => next(2, { project: "p-20260101-ffffff" }),
  ],
  [
    "a line with a transition that is not allowed",
    (next) => next(2, { source: "ENGINE", type: "PROJECT_DONE", data: {} }),
  ],
]) {
  test(`TM-18 ${name} in the middle: the project does not open, nothing is passed over silently`, (t) => {
    const p = middle(t, bad);
    fs.chmodSync(p.dir, 0o755);
    const before = snapshot(p.dir);
    const say = runTeam(p.home, ["say", p.id, "--text", "Привет"]);
    assert.equal(say.status, 1, describeRun(say));
    assert.equal(say.stdout, "");
    assert.match(
      say.stderr,
      /^E_CORRUPT: Журнал проекта повреждён в строке 2: /,
    );
    const read = runTeam(p.home, ["project", p.id]);
    assert.equal(read.status, 1);
    assert.match(
      read.stderr,
      /^E_CORRUPT: Журнал проекта повреждён в строке 2: /,
    );
    assert.deepStrictEqual(
      snapshot(p.dir),
      before,
      "files and modes are unchanged",
    );
    const err = assertRefusal(
      p.dir,
      () => openWriter(p.id, { home: p.home }),
      "E_CORRUPT",
    );
    assert.equal(err.details.line, 2);
    assert.equal(
      out(runTeam(p.home, ["projects"])).projects[0].error.code,
      "E_CORRUPT",
    );
  });
}

// ---- TM-19 ---------------------------------------------------------------------------

// t-0002 is on review with no open run (as after run-task of REQ-010); t-0001, started
// by crashed(), is running with no run.
function withReviewTask(w) {
  withPlan(w, [
    planTask("t-0001", "developer"),
    planTask("t-0002", "designer"),
  ]);
  w.append(eng("TASK_STARTED", {}, "t-0002"));
  endRun(w, startRun(w, "work", "designer", "t-0002"), "t-0002");
  w.append(eng("TASK_REVIEW", {}, "t-0002"));
}

const taskStatuses = (p) =>
  Object.fromEntries(
    readProject(p.id, { home: p.home }).state.tasks.map((x) => [
      x.id,
      x.status,
    ]),
  );

test("TM-19 a second say after a recovery adds exactly one event; a task on review without an open run is interrupted by neither say", (t) => {
  const p = crashed(t, PARTIAL, withReviewTask);
  runTeam(p.home, ["say", p.id, "--text", "Первое"]);
  const afterFirst = journalOf(p.events);
  assert.deepStrictEqual(
    afterFirst.filter((e) => e.type === "TASK_INTERRUPTED").map((e) => e.task),
    ["t-0001"],
  );
  assert.deepStrictEqual(taskStatuses(p), {
    "t-0001": "interrupted",
    "t-0002": "review",
  });
  assert.equal(
    afterFirst.filter((e) => e.type === "PROJECT_RECOVERED").length,
    1,
  );
  assert.equal(readProject(p.id, { home: p.home }).state.status, "paused");
  const second = out(runTeam(p.home, ["say", p.id, "--text", "Второе"]));
  const afterSecond = journalOf(p.events);
  assert.equal(afterSecond.length, afterFirst.length + 1);
  assert.equal(afterSecond.at(-1).type, "CHAT");
  assert.equal(afterSecond.at(-1).data.text, "Второе");
  assert.deepStrictEqual(second.notices, []);
  assert.equal(
    afterSecond.filter((e) => e.type === "PROJECT_RECOVERED").length,
    1,
  );
  assert.equal(
    afterSecond.filter((e) => e.type === "JOURNAL_RECOVERED").length,
    1,
  );
  assert.deepStrictEqual(
    afterSecond.filter((e) => e.type === "TASK_INTERRUPTED").map((e) => e.task),
    ["t-0001"],
  );
  assert.deepStrictEqual(taskStatuses(p), {
    "t-0001": "interrupted",
    "t-0002": "review",
  });
});

// (r8) was: a task in work without an open run, closed normally, "gets nothing
// appended". By section 6.3 (step 8, "or tasks in work") that is a sign of recovery, so
// the fixture is now a project closed normally with no open work at all (t-0001 and
// t-0002 both on review, no open run); the property is kept: nothing is appended. The
// new behaviour has a test of its own below.
function reviewOnly(w) {
  withPlan(w, [
    planTask("t-0001", "developer"),
    planTask("t-0002", "designer"),
  ]);
  for (const [id, role] of [
    ["t-0001", "developer"],
    ["t-0002", "designer"],
  ]) {
    w.append(eng("TASK_STARTED", {}, id));
    endRun(w, startRun(w, "work", role, id), id);
    w.append(eng("TASK_REVIEW", {}, id));
  }
}

test("TM-19 a whole journal gets nothing appended", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  reviewOnly(p.writer);
  p.writer.close();
  const before = fs.readFileSync(p.events);
  const lines = journalOf(p.events).length;
  const res = out(runTeam(home, ["say", p.id, "--text", "Первое"]));
  assert.deepStrictEqual(res.notices, []);
  const after = fs.readFileSync(p.events);
  assert.ok(after.subarray(0, before.length).equals(before));
  assert.deepStrictEqual(typesOf(journalOf(p.events).slice(lines)), ["CHAT"]);
  assert.deepStrictEqual(taskStatuses({ id: p.id, home }), {
    "t-0001": "review",
    "t-0002": "review",
  });
  assert.deepStrictEqual(readProject(p.id, { home }).state.runs.open, {});
});

test("TM-19 (r8) a task in work with no open run after a normal close is unfinished work: the first opening interrupts it once, the second adds only CHAT; a task on review stays", (t) => {
  const p = crashed(t, undefined, withReviewTask);
  const lines = journalOf(p.events).length;
  const first = out(runTeam(p.home, ["say", p.id, "--text", "Первое"]));
  assert.deepStrictEqual(first.notices, [
    "Прерваны задачи: t-0001",
    "Работа проекта прервалась — продолжите её командой возобновления",
  ]);
  const added = journalOf(p.events).slice(lines);
  assert.deepStrictEqual(typesOf(added), [
    "TASK_INTERRUPTED",
    "PROJECT_RECOVERED",
    "CHAT",
  ]);
  assert.equal(added[0].task, "t-0001");
  assert.equal(added[0].data.cause, "recovery");
  assert.deepStrictEqual(
    {
      from_status: added[1].data.from_status,
      closed_runs: added[1].data.closed_runs,
      interrupted_tasks: added[1].data.interrupted_tasks,
    },
    { from_status: "running", closed_runs: 0, interrupted_tasks: 1 },
  );
  assert.deepStrictEqual(taskStatuses(p), {
    "t-0001": "interrupted",
    "t-0002": "review",
  });
  const afterFirst = journalOf(p.events).length;
  const second = out(runTeam(p.home, ["say", p.id, "--text", "Второе"]));
  assert.deepStrictEqual(second.notices, []);
  const more = journalOf(p.events).slice(afterFirst);
  assert.deepStrictEqual(typesOf(more), ["CHAT"]);
  assert.deepStrictEqual(taskStatuses(p), {
    "t-0001": "interrupted",
    "t-0002": "review",
  });
});

test("TM-19 reopening a project that has nothing to recover appends nothing", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  p.writer.close();
  const before = fs.readFileSync(p.events);
  const w = openWriter(p.id, { home, now: clock });
  assert.deepStrictEqual(w.notices, []);
  w.close();
  assert.ok(fs.readFileSync(p.events).equals(before));

  // a project that a user paused: no recovery either
  const q = startProject(t, home, clock);
  withPlan(q.writer, [planTask("t-0001", "lawyer")]);
  q.writer.append(usr("PROJECT_PAUSED"));
  q.writer.close();
  const paused = fs.readFileSync(q.events);
  const again = openWriter(q.id, { home, now: clock });
  assert.deepStrictEqual(again.notices, []);
  assert.equal(again.state.status, "paused");
  assert.equal(again.state.paused_by, "user");
  again.close();
  assert.ok(fs.readFileSync(q.events).equals(paused));
});

// ---- TM-51 ---------------------------------------------------------------------------

test("TM-51 a process killed in the middle of a write: the next say recovers and writes one CHAT", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.close();
  const lines = journalOf(p.events).length;
  const statusBefore = readProject(p.id, { home }).state.status;
  const killed = runTeam(home, ["say", p.id, "--text", "Не дойдёт"], {
    faults: [{ fn: "writeSync", paths: [p.events], effect: "partial-kill" }],
  });
  assert.equal(killed.signal, "SIGKILL", describeRun(killed));
  const text = fs.readFileSync(p.events, "utf8");
  assert.ok(!text.endsWith("\n"), "a half line is left");
  assert.equal(journalOf(p.events).length, lines);
  const broken =
    Buffer.byteLength(text) -
    Buffer.byteLength(text.slice(0, text.lastIndexOf("\n") + 1));

  const next = out(runTeam(home, ["say", p.id, "--text", "Дойдёт"]));
  const events = journalOf(p.events);
  assert.deepStrictEqual(
    events.slice(lines).map((e) => e.type),
    ["LOCK_STALE_REMOVED", "JOURNAL_RECOVERED", "CHAT"],
  );
  // (r5) the lock of the killed process, the cut line and the CHAT; nothing else,
  // and the status of the project is as it was (no run, no task)
  assert.equal(events.length, lines + 3);
  assert.equal(readProject(p.id, { home }).state.status, statusBefore);
  assert.equal(events[lines + 1].data.dropped_bytes, broken);
  assert.equal(events[lines + 1].data.line, lines + 1);
  assert.equal(events.filter((e) => e.type === "CHAT").length, 1);
  assert.equal(events.at(-1).data.text, "Дойдёт");
  assert.ok(next.notices.some((n) => n.includes("Журнал восстановлен")));
  assert.equal(readProject(p.id, { home }).tail, null);
});

// ---- TM-54 ---------------------------------------------------------------------------

test("TM-54 recovery closes every open run, interrupts the tasks, pauses the project 'by a crash'; only a resume continues", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = newProject(home, clock);
  p.dir = path.join(home, p.id);
  p.events = path.join(p.dir, "events.jsonl");
  // (r5) a real crash: the child process (way (a)) is killed by SIGKILL holding the
  // lock; t-0001 in work with an open run, t-0002 on review with an open review run,
  // t-0003 on review with no open run, an open goal check.
  const pid = crashWriter(home, p.id, FIXTURE_CRASH_RUNNING);
  const lines = journalOf(p.events).length;
  assert.deepStrictEqual(
    Object.keys(readProject(p.id, { home }).state.runs.open),
    ["r-00001", "r-00003", "r-00005"],
  );

  const res = out(runTeam(home, ["say", p.id, "--text", "После аварии"]));
  const added = journalOf(p.events).slice(lines);
  assert.deepStrictEqual(
    added.map((e) => [e.type, e.task, e.source]),
    [
      ["LOCK_STALE_REMOVED", null, "ENGINE"],
      ["RUN_FINISHED", "t-0001", "ENGINE"],
      ["RUN_FINISHED", "t-0002", "ENGINE"],
      ["RUN_FINISHED", null, "ENGINE"],
      ["TASK_INTERRUPTED", "t-0001", "ENGINE"],
      ["TASK_INTERRUPTED", "t-0002", "ENGINE"],
      ["PROJECT_RECOVERED", null, "ENGINE"],
      ["CHAT", null, "USER"],
    ],
  );
  assert.deepStrictEqual(added[0].data, { pid });
  added.shift();
  assert.deepStrictEqual(
    added
      .slice(0, 3)
      .map((e) => [
        e.data.run_id,
        e.data.outcome,
        e.data.summary,
        e.data.cost_usd,
        e.data.files,
      ]),
    [
      ["r-00001", "interrupted", null, null, []],
      ["r-00003", "interrupted", null, null, []],
      ["r-00005", "interrupted", null, null, []],
    ],
  );
  assert.deepStrictEqual(added[3].data, { cause: "recovery" });
  assert.deepStrictEqual(added[5].data, {
    from_status: "running",
    closed_runs: 3,
    interrupted_tasks: 2,
  });
  assert.ok(res.notices.some((n) => n.includes("возобновления")));

  const view = out(runTeam(home, ["project", p.id])).project;
  assert.equal(view.status, "paused");
  assert.deepStrictEqual(view.pause.by, "recovery");
  assert.match(view.pause.text, /прервано аварией/);
  assert.deepStrictEqual(
    view.tasks.map((x) => x.status),
    ["interrupted", "interrupted", "review"],
  );

  const w = openTracked(t, home, p.id, makeClock(Date.now(), 1));
  assert.equal(w.state.status, "paused");
  assert.equal(w.state.paused_by, "recovery");
  const dir = p.dir;
  // nothing that starts work, no second pause, no resume for another reason
  assertAppendRefused(
    w,
    dir,
    eng("TASK_STARTED", {}, "t-0001"),
    "E_TRANSITION",
    "И13",
  );
  assertAppendRefused(
    w,
    dir,
    eng("PLANNING_STARTED", { round: 1 }),
    "E_TRANSITION",
    "И13",
  );
  assertAppendRefused(w, dir, usr("PROJECT_PAUSED"), "E_TRANSITION");
  assertAppendRefused(w, dir, eng("PROJECT_DONE"), "E_TRANSITION");
  assertAppendRefused(
    w,
    dir,
    eng("PROJECT_WAITING", { reason: "budget" }),
    "E_TRANSITION",
  );
  for (const after of ["command", "decision", "budget"]) {
    assertAppendRefused(
      w,
      dir,
      usr("PROJECT_RESUMED", { parallel: null, after }),
      "E_TRANSITION",
    );
  }
  w.append(usr("PROJECT_RESUMED", { parallel: null, after: "recovery" }));
  assert.equal(w.state.status, "running");
  assert.equal(w.state.paused_by, null);
  // the work goes on: the interrupted task starts again, a new attempt is counted
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  startRun(w, "work", "developer", "t-0001");
  assert.equal(w.state.tasks[0].attempts, 2);
  // a resume of a running project is never a change of the status
  for (const after of ["command", "decision", "budget", "recovery"]) {
    assertAppendRefused(
      w,
      dir,
      eng("PROJECT_RESUMED", { parallel: null, after }),
      "E_TRANSITION",
    );
    assertAppendRefused(
      w,
      dir,
      usr("PROJECT_RESUMED", { parallel: null, after }),
      "E_TRANSITION",
    );
  }
  assertStatusChanges(journalOf(p.events));
});

test("TM-54 a project paused by the user is resumed only by 'command'; an interrupt needs no open run", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  const { writer: w, dir } = p;
  withPlan(w, [planTask("t-0001", "developer")]);
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  const run = startRun(w, "work", "developer", "t-0001");
  assertAppendRefused(
    w,
    dir,
    eng("TASK_INTERRUPTED", { cause: "stop" }, "t-0001"),
    "E_TRANSITION",
    "И14",
  );
  w.append(
    eng(
      "RUN_FINISHED",
      {
        run_id: run,
        outcome: "cancelled",
        summary: null,
        cost_usd: null,
        files: [],
      },
      "t-0001",
    ),
  );
  w.append(usr("PROJECT_PAUSED"));
  assertAppendRefused(
    w,
    dir,
    usr("PROJECT_RESUMED", { parallel: null, after: "recovery" }),
    "E_TRANSITION",
    "И13",
  );
  assertAppendRefused(
    w,
    dir,
    usr("PROJECT_RESUMED", { parallel: null, after: "decision" }),
    "E_TRANSITION",
    "И13",
  );
  w.append(usr("PROJECT_RESUMED", { parallel: null, after: "command" }));
  assert.equal(w.state.status, "running");
});

test("TM-54 recovery of planning: the open plan run is closed, no task is interrupted, the project pauses", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = newProject(home, clock);
  p.dir = path.join(home, p.id);
  p.events = path.join(p.dir, "events.jsonl");
  // (r5) a real crash by SIGKILL with the open run of the plan
  crashWriter(
    home,
    p.id,
    `w.append(H.usr("PROJECT_STARTED", { parallel: 1 }));
w.append(H.eng("PLANNING_STARTED", { round: 0 }));
H.startRun(w, "plan", "project_manager");`,
  );
  const lines = journalOf(p.events).length;
  const w = openTracked(t, home, p.id, makeClock(Date.now(), 1));
  const added = journalOf(p.events).slice(lines);
  assert.deepStrictEqual(typesOf(added), [
    "LOCK_STALE_REMOVED",
    "RUN_FINISHED",
    "PROJECT_RECOVERED",
  ]);
  assert.deepStrictEqual(added[2].data, {
    from_status: "planning",
    closed_runs: 1,
    interrupted_tasks: 0,
  });
  assert.equal(w.state.status, "paused");
  assert.equal(w.state.paused_by, "recovery");
  assertAppendRefused(
    w,
    p.dir,
    eng("PLAN_RETRY", { round: 0, attempt: 2 }),
    "E_TRANSITION",
    "И13",
  );
});

// ---- the leftovers of a crash (design 6.3, step 7) ---------------------------------------

test("a writer removes the leftovers of a crash of dead processes and leaves those of live ones", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  p.writer.close();
  const dead = deadPid();
  const live = process.ppid;
  const lockText = (pid) =>
    `${JSON.stringify({ pid, since: "2026-01-01T09:00:00.000Z" })}\n`;
  const leftovers = [
    `writer.lock.${dead}.new`,
    `writer.lock.stale-${dead}`,
    `writer.lock.${live}.new`,
    `writer.lock.stale-${live}`,
  ];
  for (const name of leftovers)
    fs.writeFileSync(path.join(p.dir, name), lockText(dead), { mode: 0o600 });
  fs.writeFileSync(path.join(p.dir, "files", ".partial-half.md"), "полфайла", {
    mode: 0o600,
  });
  fs.writeFileSync(path.join(p.dir, "files", "done.md"), "готовый", {
    mode: 0o600,
  });
  const lines = journalOf(p.events).length;
  const w = openTracked(t, home, p.id, clock);
  assert.deepStrictEqual(
    fs.readdirSync(p.dir).sort(),
    [
      "events.jsonl",
      "files",
      `writer.lock`,
      `writer.lock.${live}.new`,
      `writer.lock.stale-${live}`,
      "work",
    ].sort(),
  );
  assert.deepStrictEqual(fs.readdirSync(path.join(p.dir, "files")), [
    "done.md",
  ]);
  assert.equal(journalOf(p.events).length, lines, "leftovers are not events");
  assert.equal(w.state.last_seq, lines);
});

// ---- TM-64 (r5, decision of ORCH (1)) -------------------------------------------------------

const RECOVERY_TYPES = [
  "LOCK_STALE_REMOVED",
  "JOURNAL_RECOVERED",
  "PROJECT_RECOVERED",
];

// (r8) case (A): a task on review with no open run. Case (B), the task in work with its
// open run after a normal close, is a sign of unfinished work now: its own test below.
for (const [name, build, check] of [
  [
    "a task on review with no open run (as after run-task)",
    (w) => {
      withPlan(w, [planTask("t-0001", "developer")]);
      w.append(eng("TASK_STARTED", {}, "t-0001"));
      endRun(w, startRun(w, "work", "developer", "t-0001"), "t-0001");
      w.append(eng("TASK_REVIEW", {}, "t-0001"));
    },
    (state) => {
      assert.equal(state.tasks[0].status, "review");
      assert.deepStrictEqual(state.runs.open, {});
    },
  ],
]) {
  test(`TM-64 a clean reopening writes no recovery: ${name}`, (t) => {
    const home = makeHome(t);
    const clock = makeClock();
    const p = startProject(t, home, clock);
    build(p.writer);
    p.writer.close();
    assert.equal(
      fs.existsSync(path.join(p.dir, "writer.lock")),
      false,
      "closed by close(): no lock, whole last line",
    );
    const lines = journalOf(p.events).length;
    const hash = sha256(fs.readFileSync(p.events));
    const status = readProject(p.id, { home }).state.status;
    const reopen = makeClock(Date.now(), 1);
    for (let i = 0; i < 3; i += 1) {
      const w = openWriter(p.id, { home, now: reopen });
      assert.deepStrictEqual(w.notices, []);
      w.close();
      assert.equal(sha256(fs.readFileSync(p.events)), hash, `reopening ${i}`);
    }
    const w = openWriter(p.id, { home, now: reopen });
    w.say("После трёх открытий");
    w.close();
    const added = journalOf(p.events).slice(lines);
    assert.deepStrictEqual(typesOf(added), ["CHAT"]);
    for (const type of [...RECOVERY_TYPES, "RUN_FINISHED"]) {
      assert.equal(
        journalOf(p.events)
          .slice(lines)
          .filter((e) => e.type === type).length,
        0,
        type,
      );
    }
    const state = readProject(p.id, { home }).state;
    assert.equal(state.status, status);
    assert.equal(state.paused_by, null);
    check(state);
  });
}

test("TM-64 (B) (r8) a task in work with its open run after a normal close (the error of the caller, I7): the FIRST opening recovers it, later openings and say write only CHAT", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const p = startProject(t, home, clock);
  withPlan(p.writer, [planTask("t-0001", "developer")]);
  p.writer.append(eng("TASK_STARTED", {}, "t-0001"));
  startRun(p.writer, "work", "developer", "t-0001");
  p.writer.close();
  assert.equal(
    fs.existsSync(path.join(p.dir, "writer.lock")),
    false,
    "closed by close(): no lock, whole last line",
  );
  const lines = journalOf(p.events).length;
  const reopen = makeClock(Date.now(), 1);
  const w1 = openWriter(p.id, { home, now: reopen });
  assert.deepStrictEqual(w1.notices, [
    "Закрыты прерванные запуски: 1",
    "Прерваны задачи: t-0001",
    "Работа проекта прервалась — продолжите её командой возобновления",
  ]);
  w1.close();
  const first = journalOf(p.events).slice(lines);
  assert.deepStrictEqual(typesOf(first), [
    "RUN_FINISHED",
    "TASK_INTERRUPTED",
    "PROJECT_RECOVERED",
  ]);
  assert.equal(first[0].data.run_id, "r-00001");
  assert.equal(first[0].data.outcome, "interrupted");
  assert.equal(first[1].task, "t-0001");
  assert.equal(first[1].data.cause, "recovery");
  assert.deepStrictEqual(
    {
      from_status: first[2].data.from_status,
      closed_runs: first[2].data.closed_runs,
      interrupted_tasks: first[2].data.interrupted_tasks,
    },
    { from_status: "running", closed_runs: 1, interrupted_tasks: 1 },
  );
  for (const type of ["LOCK_STALE_REMOVED", "JOURNAL_RECOVERED"]) {
    assert.equal(first.filter((e) => e.type === type).length, 0, type);
  }
  const state = readProject(p.id, { home }).state;
  assert.equal(state.status, "paused");
  assert.equal(state.paused_by, "recovery");
  assert.equal(state.tasks[0].status, "interrupted");
  assert.deepStrictEqual(state.runs.open, {});

  const hash = sha256(fs.readFileSync(p.events));
  for (let i = 0; i < 3; i += 1) {
    const w = openWriter(p.id, { home, now: reopen });
    assert.deepStrictEqual(w.notices, []);
    w.close();
    assert.equal(sha256(fs.readFileSync(p.events)), hash, `reopening ${i}`);
  }
  const w = openWriter(p.id, { home, now: reopen });
  w.say("После трёх открытий");
  w.close();
  assert.deepStrictEqual(
    typesOf(journalOf(p.events).slice(lines + first.length)),
    ["CHAT"],
  );
});

// ---- TM-65 (r5, decisions of ORCH (2), (3), И13, И21) ----------------------------------------

// t-0001 on review with no open run: work finished, review not started.
function reviewWithoutRun(w) {
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  endRun(w, startRun(w, "work", "developer", "t-0001"), "t-0001");
  w.append(eng("TASK_REVIEW", {}, "t-0001"));
}

test("TM-65 (1) a crash by a dead lock: a task on review with no open run stays on review, the project is not paused", (t) => {
  const home = makeHome(t);
  const p = newProject(home, makeClock());
  p.events = path.join(home, p.id, "events.jsonl");
  const pid = crashWriter(
    home,
    p.id,
    `H.withPlan(w, [H.planTask("t-0001", "developer")]);
w.append(H.eng("TASK_STARTED", {}, "t-0001"));
H.endRun(w, H.startRun(w, "work", "developer", "t-0001"), "t-0001");
w.append(H.eng("TASK_REVIEW", {}, "t-0001"));`,
  );
  const lines = journalOf(p.events).length;
  assert.deepStrictEqual(
    readProject(p.id, { home }).state.runs.open,
    {},
    "no open run",
  );
  out(runTeam(home, ["say", p.id, "--text", "После аварии"]));
  const added = journalOf(p.events).slice(lines);
  assert.deepStrictEqual(typesOf(added), ["LOCK_STALE_REMOVED", "CHAT"]);
  assert.deepStrictEqual(added[0].data, { pid });
  const state = readProject(p.id, { home }).state;
  assert.equal(state.tasks[0].status, "review");
  assert.equal(state.status, "running");
  assert.equal(state.paused_by, null);
  assert.equal(
    journalOf(p.events).some((e) => e.type === "PROJECT_RECOVERED"),
    false,
  );
});

test("TM-65 (2) a cut last line: the same, only JOURNAL_RECOVERED and CHAT", (t) => {
  const p = crashed(
    t,
    PARTIAL,
    (w) => withPlan(w, [planTask("t-0001", "developer")]),
    (w) => {
      endRun(w, startRun(w, "work", "developer", "t-0001"), "t-0001");
      w.append(eng("TASK_REVIEW", {}, "t-0001"));
    },
  );
  const lines = journalOf(p.events).length;
  out(runTeam(p.home, ["say", p.id, "--text", "После обрыва"]));
  assert.deepStrictEqual(typesOf(journalOf(p.events).slice(lines)), [
    "JOURNAL_RECOVERED",
    "CHAT",
  ]);
  const state = readProject(p.id, { home: p.home }).state;
  assert.equal(state.tasks[0].status, "review");
  assert.equal(state.status, "running");
});

test("TM-65 (3) a crash with a task in work with no open run and a task on review with no open run: only the first is interrupted; PROJECT_RECOVERED says 0 and 1", (t) => {
  const home = makeHome(t);
  const p = newProject(home, makeClock());
  p.events = path.join(home, p.id, "events.jsonl");
  crashWriter(
    home,
    p.id,
    `H.withPlan(w, [H.planTask("t-0001", "developer"), H.planTask("t-0002", "designer")]);
w.append(H.eng("TASK_STARTED", {}, "t-0001"));
H.endRun(w, H.startRun(w, "work", "developer", "t-0001"), "t-0001");
w.append(H.eng("TASK_REVIEW", {}, "t-0001"));
w.append(H.eng("TASK_STARTED", {}, "t-0002"));`,
  );
  const lines = journalOf(p.events).length;
  out(runTeam(home, ["say", p.id, "--text", "После аварии"]));
  const added = journalOf(p.events).slice(lines);
  assert.deepStrictEqual(
    added.map((e) => [e.type, e.task]),
    [
      ["LOCK_STALE_REMOVED", null],
      ["TASK_INTERRUPTED", "t-0002"],
      ["PROJECT_RECOVERED", null],
      ["CHAT", null],
    ],
  );
  assert.deepStrictEqual(added[2].data, {
    from_status: "running",
    closed_runs: 0,
    interrupted_tasks: 1,
  });
  const state = readProject(p.id, { home }).state;
  assert.deepStrictEqual(
    state.tasks.map((x) => x.status),
    ["review", "interrupted"],
  );
  assert.equal(state.status, "paused");
  assert.equal(state.paused_by, "recovery");
});

// An event as the journal holds it, for a direct call of reduce.
function nextEvent(state, source, type, data, task = null) {
  return {
    seq: state.last_seq + 1,
    ts: new Date(T0_LATER + state.last_seq * 10).toISOString(),
    project: state.id,
    task,
    source,
    type,
    data,
  };
}
const T0_LATER = Date.UTC(2026, 0, 1, 10, 0, 0);

function assertReduceRefused(state, event, rule) {
  const frozen = structuredClone(state);
  let caught = null;
  try {
    reduce(state, event);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof TeamError, `${event.type}: ${caught}`);
  assert.equal(caught.code, "E_TRANSITION", caught.message);
  assert.equal(caught.details.rule, rule);
  assert.deepStrictEqual(state, frozen, "reduce does not change its input");
}

test("TM-65 (4) reduce directly: И21 and И13", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  withPlan(w, [
    planTask("t-0001", "developer"),
    planTask("t-0002", "designer"),
  ]);
  reviewWithoutRun(w);
  const recoveryInterrupt = (state, task) =>
    nextEvent(state, "ENGINE", "TASK_INTERRUPTED", { cause: "recovery" }, task);

  // И21: a task on review that has no interrupted review run cannot be interrupted
  const base = structuredClone(w.state);
  assert.equal(base.tasks[0].status, "review");
  assertReduceRefused(base, recoveryInterrupt(base, "t-0001"), "И21");

  // a review run that ended ok is not an interrupted one either
  const review = startRun(w, "review", "reviewer", "t-0001");
  endRun(w, review, "t-0001");
  const okRun = structuredClone(w.state);
  assert.equal(okRun.tasks[0].status, "review");
  assertReduceRefused(okRun, recoveryInterrupt(okRun, "t-0001"), "И21");

  // the cause 'stop' on a task on review is allowed: И21 is only for 'recovery'
  const stopped = reduce(
    okRun,
    nextEvent(okRun, "ENGINE", "TASK_INTERRUPTED", { cause: "stop" }, "t-0001"),
  );
  assert.equal(stopped.tasks[0].status, "interrupted");

  // a review run that was interrupted: the task may be interrupted by the recovery
  const second = startRun(w, "review", "reviewer", "t-0001");
  const open = structuredClone(w.state);
  let state = reduce(
    open,
    nextEvent(
      open,
      "ENGINE",
      "RUN_FINISHED",
      {
        run_id: second,
        outcome: "interrupted",
        summary: null,
        cost_usd: null,
        files: [],
      },
      "t-0001",
    ),
  );
  state = reduce(state, recoveryInterrupt(state, "t-0001"));
  assert.equal(state.tasks[0].status, "interrupted");

  // the real writer ends the run normally; it holds no open run any more
  endRun(w, second, "t-0001");

  // И13: nothing was interrupted
  const idle = structuredClone(w.state);
  assertReduceRefused(
    idle,
    nextEvent(idle, "ENGINE", "PROJECT_RECOVERED", {
      from_status: "running",
      closed_runs: 0,
      interrupted_tasks: 0,
    }),
    "И13",
  );
  // И13: a task in work is left: the recovery is not complete
  w.append(eng("TASK_STARTED", {}, "t-0002"));
  const running = structuredClone(w.state);
  assertReduceRefused(
    running,
    nextEvent(running, "ENGINE", "PROJECT_RECOVERED", {
      from_status: "running",
      closed_runs: 0,
      interrupted_tasks: 1,
    }),
    "И13",
  );
  // accepted: a task on review with no open run stays, a task in work was interrupted
  const done = reduce(
    running,
    nextEvent(
      running,
      "ENGINE",
      "TASK_INTERRUPTED",
      { cause: "recovery" },
      "t-0002",
    ),
  );
  const paused = reduce(
    done,
    nextEvent(done, "ENGINE", "PROJECT_RECOVERED", {
      from_status: "running",
      closed_runs: 0,
      interrupted_tasks: 1,
    }),
  );
  assert.equal(paused.status, "paused");
  assert.equal(paused.paused_by, "recovery");
  assert.equal(paused.tasks[0].status, "review");
  assert.equal(paused.tasks[1].status, "interrupted");
});

// ---- TM-66 (r6, decision of ORCH (1), И22) -------------------------------------------------

function projectWithPlan(t, home) {
  const p = startProject(t, home, makeClock());
  withPlan(p.writer, [planTask("t-0001", "developer")]);
  p.writer.close();
  return p;
}

test("TM-66 (1) a process that ended by itself with a broken writer: the lock of the dead pid stays; the next writer recovers", (t) => {
  const home = makeHome(t);
  const p = projectWithPlan(t, home);
  const before = snapshot(p.dir);
  const base = journalOf(p.events).length;
  // TASK_STARTED is the 1st write of the child, RUN_STARTED the 2nd, the say the 3rd
  const r = runWriterChild(
    home,
    p.id,
    `w.append(H.eng("TASK_STARTED", {}, "t-0001"));
H.startRun(w, "work", "developer", "t-0001");
const out = [];
for (const text of ["Сбой", "Ещё"]) {
  try { w.say(text); out.push("ok"); } catch (e) { out.push(e.code); }
}
w.close();
process.stdout.write(JSON.stringify(out));`,
    {
      faults: [
        {
          fn: "writeSync",
          paths: [p.events],
          effect: "throw",
          code: "EIO",
          nth: 3,
        },
      ],
    },
  );
  assert.equal(r.status, 0, describeRun(r));
  assert.equal(r.signal, null);
  assert.deepStrictEqual(JSON.parse(r.stdout), ["E_DISK", "E_WRITER_BROKEN"]);
  // close() of the broken writer wrote nothing: the journal ends at RUN_STARTED
  const after = journalOf(p.events);
  assert.deepStrictEqual(typesOf(after.slice(base)), [
    "TASK_STARTED",
    "RUN_STARTED",
  ]);
  assert.equal(readProject(p.id, { home }).tail, null);
  assert.equal(lockOf(p.dir).pid, r.pid);
  const bytes = fs.readFileSync(p.events);
  assert.ok(before["events.jsonl"].size < bytes.length);

  const w = openTracked(t, home, p.id, makeClock(Date.now(), 1));
  assert.ok(w.notices.some((n) => n.includes(String(r.pid))));
  assert.ok(w.notices.some((n) => n.includes("t-0001")));
  const added = journalOf(p.events).slice(base + 2);
  assert.deepStrictEqual(
    added.map((e) => [e.type, e.task]),
    [
      ["LOCK_STALE_REMOVED", null],
      ["RUN_FINISHED", "t-0001"],
      ["TASK_INTERRUPTED", "t-0001"],
      ["PROJECT_RECOVERED", null],
    ],
  );
  assert.deepStrictEqual(added[0].data, { pid: r.pid });
  assert.deepStrictEqual(
    [added[1].data.run_id, added[1].data.outcome],
    ["r-00001", "interrupted"],
  );
  assert.deepStrictEqual(added[2].data, { cause: "recovery" });
  assert.deepStrictEqual(added[3].data, {
    from_status: "running",
    closed_runs: 1,
    interrupted_tasks: 1,
  });
  assert.deepStrictEqual(w.state.runs.open, {});
  w.say("После восстановления");
  w.close();
  assert.equal(journalOf(p.events).at(-1).type, "CHAT");
  const reopened = openTracked(t, home, p.id, makeClock(Date.now(), 1));
  reopened.say("Ещё");
  assert.deepStrictEqual(
    typesOf(journalOf(p.events).slice(base + 2 + 4)),
    ["CHAT", "CHAT"],
    "no second recovery",
  );
  assert.deepStrictEqual(reopened.state.runs.open, {});
});

test("TM-66 (1) the crash of the process by SIGKILL after a broken writer is the same: one recovery", (t) => {
  const home = makeHome(t);
  const p = projectWithPlan(t, home);
  const base = journalOf(p.events).length;
  const r = runWriterChild(
    home,
    p.id,
    `w.append(H.eng("TASK_STARTED", {}, "t-0001"));
H.startRun(w, "work", "developer", "t-0001");`,
    { kill: true },
  );
  assert.equal(r.signal, "SIGKILL", describeRun(r));
  assert.equal(lockOf(p.dir).pid, r.pid);
  const w = openTracked(t, home, p.id, makeClock(Date.now(), 1));
  assert.deepStrictEqual(typesOf(journalOf(p.events).slice(base + 2)), [
    "LOCK_STALE_REMOVED",
    "RUN_FINISHED",
    "TASK_INTERRUPTED",
    "PROJECT_RECOVERED",
  ]);
  assert.equal(w.state.status, "paused");
});

test("TM-66 (2) the process is alive: close() of a broken writer leaves the lock byte for byte, the project is busy for this process", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  withPlan(w, [planTask("t-0001", "developer")]);
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  startRun(w, "work", "developer", "t-0001");
  const result = withFaults(
    [{ fn: "writeSync", paths: [p.events], effect: "throw", code: "EIO" }],
    () => w.say("Сбой"),
  );
  assert.deepStrictEqual(result.fired, [true]);
  assert.equal(result.error.code, "E_DISK");
  assertRefusal(p.dir, () => w.say("Ещё"), "E_WRITER_BROKEN");
  assert.equal(w.broken, true);
  const lockFile = path.join(p.dir, "writer.lock");
  const lockBytes = fs.readFileSync(lockFile);
  const folder = snapshot(p.dir);
  assert.equal(lockOf(p.dir).pid, process.pid);

  w.close();
  assert.ok(fs.readFileSync(lockFile).equals(lockBytes));
  assert.deepStrictEqual(snapshot(p.dir), folder, "close() changed nothing");
  const busy = assertRefusal(
    p.dir,
    () => openWriter(p.id, { home, now: makeClock(Date.now(), 1) }),
    "E_PROJECT_BUSY",
  );
  assert.equal(busy.details.pid, process.pid);
  // a second close() and a write after close() change nothing and do not throw
  w.close();
  assertRefusal(p.dir, () => w.say("После"), "E_WRITER_BROKEN");
  assert.deepStrictEqual(snapshot(p.dir), folder);
});

test("TM-66 (3) markBroken(): a healthy writer becomes broken and keeps its lock on close()", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  p.writer.say("До");
  assert.equal(w.broken, false);
  w.markBroken();
  assert.equal(w.broken, true);
  assertRefusal(p.dir, () => w.say("После"), "E_WRITER_BROKEN");
  const lockBytes = fs.readFileSync(path.join(p.dir, "writer.lock"));
  const folder = snapshot(p.dir);
  w.close();
  assert.ok(fs.readFileSync(path.join(p.dir, "writer.lock")).equals(lockBytes));
  assert.deepStrictEqual(snapshot(p.dir), folder);
  assertRefusal(
    p.dir,
    () => openWriter(p.id, { home, now: makeClock(Date.now(), 1) }),
    "E_PROJECT_BUSY",
  );
  // markBroken() twice and after close() is not an error
  w.markBroken();
  w.markBroken();
  assert.deepStrictEqual(snapshot(p.dir), folder);
});

test("TM-66 (4) control: a healthy writer gives the lock back; a writer that lost its lock does not touch the lock of another", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  p.writer.say("Здоровый");
  p.writer.close();
  assert.equal(fs.existsSync(path.join(p.dir, "writer.lock")), false);
  const hash = sha256(fs.readFileSync(p.events));
  const again = openWriter(p.id, { home, now: makeClock(Date.now(), 1) });
  assert.deepStrictEqual(again.notices, []);
  again.close();
  assert.equal(sha256(fs.readFileSync(p.events)), hash, "no events");
  assert.equal(fs.existsSync(path.join(p.dir, "writer.lock")), false);

  // a lock taken over by another live process (E_LOCK_LOST)
  const lost = openWriter(p.id, { home, now: makeClock(Date.now(), 1) });
  const lockFile = path.join(p.dir, "writer.lock");
  fs.rmSync(lockFile);
  fs.writeFileSync(
    lockFile,
    `${JSON.stringify({ pid: process.ppid, since: "2026-10-06T08:00:00.000Z" })}\n`,
    { mode: 0o600 },
  );
  const foreign = fs.readFileSync(lockFile);
  const lostCounts = countJournalCalls(t, p.events);
  assertRefusal(p.dir, () => lost.say("Нет замка"), "E_LOCK_LOST");
  assert.deepStrictEqual(lostCounts, {
    writeSync: 0,
    fsyncSync: 0,
    ftruncateSync: 0,
  });
  lost.close();
  assert.ok(
    fs.readFileSync(lockFile).equals(foreign),
    "the lock of another stays",
  );
  assert.equal(sha256(fs.readFileSync(p.events)), hash);
});

// ---- TM-67 (r8, S1, decision of ORCH) --------------------------------------------------

const RACE_ROUNDS = 20;
const RACE_OPENERS = 6;

test(
  "TM-67 a race of openers after a crash: the recovery is written exactly once, nothing stays open",
  { timeout: 280_000 },
  async (t) => {
    const fixture = `H.withPlan(w, [
  H.planTask("t-0001", "developer"),
  H.planTask("t-0002", "designer"),
]);
w.append(H.eng("TASK_STARTED", {}, "t-0001"));
H.startRun(w, "work", "developer", "t-0001");
w.append(H.eng("TASK_STARTED", {}, "t-0002"));
H.endRun(w, H.startRun(w, "work", "designer", "t-0002"), "t-0002");
w.append(H.eng("TASK_REVIEW", {}, "t-0002"));`;
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const home = makeHome(t);
      const clock = makeClock();
      const { id } = newProject(home, clock);
      const dir = path.join(home, id);
      const events = path.join(dir, "events.jsonl");
      const pid = crashWriter(home, id, fixture);
      assert.deepStrictEqual(
        Object.keys(readProject(id, { home }).state.runs.open),
        ["r-00001"],
        `round ${round}: the fixture has the open run`,
      );
      const crashLines = journalOf(events).length;

      const results = await runOpeners(home, id, RACE_OPENERS);
      const tag = `round ${round}`;
      for (const r of results) {
        assert.ok(
          r.result === "opened" ||
            r.result === "error E_PROJECT_BUSY" ||
            r.result === "error E_LOCK_LOST",
          `${tag}: opener ${r.i}: ${JSON.stringify(r)}`,
        );
      }
      // E_LOCK_LOST / E_PROJECT_BUSY: the loser of a race on a stale lock (3+ openers)
      // writes nothing more - the recorded residual risk of REQ-009 (6.2, F6, S6). The
      // test checks the RESULT, not the outcome of each opener: in rare rounds under
      // load nobody gets the project open, the recovery is written all the same.
      const opened = results.filter((r) => r.result === "opened").length;

      const added = journalOf(events).slice(crashLines);
      const of = (type) => added.filter((e) => e.type === type);
      assert.equal(of("RUN_FINISHED").length, 1, `${tag}: RUN_FINISHED`);
      assert.equal(of("RUN_FINISHED")[0].data.run_id, "r-00001");
      assert.equal(of("RUN_FINISHED")[0].data.outcome, "interrupted");
      assert.equal(
        of("TASK_INTERRUPTED").length,
        1,
        `${tag}: TASK_INTERRUPTED`,
      );
      assert.equal(of("TASK_INTERRUPTED")[0].task, "t-0001");
      assert.equal(of("TASK_INTERRUPTED")[0].data.cause, "recovery");
      assert.equal(
        of("PROJECT_RECOVERED").length,
        1,
        `${tag}: PROJECT_RECOVERED`,
      );
      // (r10) One batch: the three events of the recovery are written together, with
      // the numbers of the real work of the fixture (one open run, one task in work).
      const recovered1 = of("PROJECT_RECOVERED")[0].data;
      assert.deepStrictEqual(
        recovered1,
        { from_status: "running", closed_runs: 1, interrupted_tasks: 1 },
        tag,
      );
      const at = added.findIndex((e) => e.type === "RUN_FINISHED");
      assert.deepStrictEqual(
        typesOf(added.slice(at, at + 3)),
        ["RUN_FINISHED", "TASK_INTERRUPTED", "PROJECT_RECOVERED"],
        `${tag}: the three events of the recovery follow each other`,
      );
      assert.deepStrictEqual(
        added.slice(at, at + 3).map((e) => e.seq),
        [added[at].seq, added[at].seq + 1, added[at].seq + 2],
        `${tag}: seq in a row`,
      );
      // A notice of a removed stale lock names a process of this round that is gone:
      // the crashed writer, or an opener that lost the race on the stale lock (F6, S6)
      // and left its lock; each pid at most once. Who removes which lock is the race,
      // not the recovery: the recovery is checked by the lines above and below.
      const known = new Set([pid, ...results.map((r) => r.pid)]);
      const stale = of("LOCK_STALE_REMOVED").map((e) => e.data.pid);
      assert.equal(new Set(stale).size, stale.length, `${tag}: stale locks`);
      for (const e of of("LOCK_STALE_REMOVED")) {
        assert.deepStrictEqual(Object.keys(e.data), ["pid"], tag);
        assert.ok(known.has(e.data.pid), `${tag}: stale lock of ${e.data.pid}`);
      }
      assert.equal(of("JOURNAL_RECOVERED").length, 0, `${tag}: no cut line`);
      const firstChat = added.findIndex((e) => e.type === "CHAT");
      const recovered = added.findIndex((e) => e.type === "PROJECT_RECOVERED");
      assert.ok(
        firstChat === -1 || recovered < firstChat,
        `${tag}: the recovery comes before any CHAT`,
      );
      assert.equal(of("CHAT").length, opened, `${tag}: one CHAT per opener`);

      const state = readProject(id, { home }).state;
      assert.deepStrictEqual(state.runs.open, {}, `${tag}: open runs`);
      assert.deepStrictEqual(
        state.tasks.map((x) => [x.id, x.status]),
        [
          ["t-0001", "interrupted"],
          ["t-0002", "review"],
        ],
        tag,
      );
      assert.equal(state.status, "paused");
      assert.equal(state.paused_by, "recovery");
      assert.equal(
        fs.existsSync(path.join(dir, "writer.lock")),
        false,
        `${tag}: lock`,
      );

      const hash = sha256(fs.readFileSync(events));
      const w = openWriter(id, { home, now: makeClock(Date.now(), 1) });
      assert.deepStrictEqual(w.notices, [], `${tag}: a further opening`);
      w.close();
      assert.equal(
        sha256(fs.readFileSync(events)),
        hash,
        `${tag}: journal as it was`,
      );
    }
  },
);

// ---- TM-68 (r10, decision of ORCH, И23) --------------------------------------------------
// The batch of the recovery (section 6.3, steps 8.4-8.6) is written whole or not at all.

function assertThrowsCode(fn, code) {
  assert.throws(fn, (err) => err instanceof TeamError && err.code === code);
}

// The events of the recovery in the journal after `from` lines: all three, in a row
// (seq in a row), or none.
function recoveryRows(events, from) {
  const tail = events.slice(from);
  const rows = tail.filter((e) => BATCH_TYPES.includes(e.type));
  if (rows.length === 0) return [];
  assert.deepStrictEqual(typesOf(rows), BATCH_TYPES, "all three or none");
  assert.deepStrictEqual(
    rows.map((e) => e.seq),
    [rows[0].seq, rows[0].seq + 1, rows[0].seq + 2],
    "seq in a row",
  );
  const at = tail.indexOf(rows[0]);
  assert.deepStrictEqual(
    tail.slice(at, at + 3),
    rows,
    "no other event between the three",
  );
  return rows;
}

function assertRecoveredOnce(events, from, tag) {
  const rows = recoveryRows(events, from);
  assert.equal(rows.length, 3, `${tag}: exactly one batch`);
  assert.deepStrictEqual(
    [rows[0].data.run_id, rows[0].data.outcome],
    ["r-00001", "interrupted"],
    tag,
  );
  assert.equal(rows[1].task, "t-0001", tag);
  assert.deepStrictEqual(rows[1].data, { cause: "recovery" }, tag);
  assert.deepStrictEqual(
    rows[2].data,
    { from_status: "running", closed_runs: 1, interrupted_tasks: 1 },
    tag,
  );
}

function assertRecoveredState(id, home, tag) {
  const state = readProject(id, { home }).state;
  assert.deepStrictEqual(state.runs.open, {}, `${tag}: open runs`);
  assert.deepStrictEqual(
    state.tasks.map((x) => [x.id, x.status]),
    [
      ["t-0001", "interrupted"],
      ["t-0002", "review"],
    ],
    tag,
  );
  assert.equal(state.status, "paused", tag);
  assert.equal(state.paused_by, "recovery", tag);
}

// A project closed normally with the open work of the fixture: the first writing of
// the next opening is the batch itself (no stale lock before it).
function closedFixture(t) {
  const home = makeHome(t);
  const { id } = newProject(home, makeClock());
  const dir = path.join(home, id);
  const r = runWriterChild(home, id, `${RECOVERY_FIXTURE}\nw.close();`);
  assert.equal(r.status, 0, describeRun(r));
  assert.equal(fs.existsSync(path.join(dir, "writer.lock")), false);
  const events = path.join(dir, "events.jsonl");
  assert.deepStrictEqual(
    Object.keys(readProject(id, { home }).state.runs.open),
    ["r-00001"],
  );
  return { home, id, dir, events };
}

// After a failed write: the journal as before, the lock of the dead child stays, and
// the next opening recovers exactly once.
function failedBatchCase(t, fault, label) {
  const p = closedFixture(t);
  const hash = sha256(fs.readFileSync(p.events));
  const base = journalOf(p.events).length;
  const r = runRecoveryOpen(p.home, p.id, {
    faults: [{ ...fault, paths: [p.events] }],
  });
  assert.equal(r.status, 0, describeRun(r));
  assert.equal(r.signal, null);
  assert.deepStrictEqual(
    r.result,
    { code: "E_DISK", rollback: "ok" },
    `${label}: ${r.stderr}`,
  );
  assert.equal(
    sha256(fs.readFileSync(p.events)),
    hash,
    `${label}: journal as it was`,
  );
  assert.deepStrictEqual(recoveryRows(journalOf(p.events), base), []);
  assert.equal(
    lockOf(p.dir).pid,
    r.pid,
    `${label}: the lock of the dead child`,
  );
  assertDead(r.pid);

  openTracked(t, p.home, p.id, makeClock(Date.now(), 1)).close();
  const events = journalOf(p.events);
  assert.deepStrictEqual(
    typesOf(events.slice(base)),
    ["LOCK_STALE_REMOVED", ...BATCH_TYPES],
    `${label}: the next opening`,
  );
  assertRecoveredOnce(events, base, label);
  assertRecoveredState(p.id, p.home, label);
  const after = sha256(fs.readFileSync(p.events));
  openWriter(p.id, { home: p.home, now: makeClock(Date.now(), 1) }).close();
  assert.equal(
    sha256(fs.readFileSync(p.events)),
    after,
    `${label}: no second recovery`,
  );
  return { p, base };
}

test("TM-68 (a) a failed write (EIO) of the batch: the journal as it was, the next opening recovers once", (t) => {
  failedBatchCase(t, { fn: "writeSync", effect: "throw", code: "EIO" }, "a");
});

test("TM-68 (b) half of the batch written, then a failure: the journal as it was, the next opening recovers once", (t) => {
  const { p, base } = failedBatchCase(
    t,
    { fn: "writeSync", effect: "partial", code: "ENOSPC" },
    "b",
  );
  // The half that was written held at least one whole line: the rollback had work.
  const lines = fs
    .readFileSync(p.events, "utf8")
    .split("\n")
    .slice(base + 1, base + 4)
    .map((l) => Buffer.byteLength(`${l}\n`));
  const total = lines.reduce((a, b) => a + b, 0);
  assert.ok(lines[0] <= Math.floor(total / 2), "the half holds a whole line");
});

test("TM-68 (c) a failed fsync after the whole batch was written: the journal as it was, the next opening recovers once", (t) => {
  failedBatchCase(t, { fn: "fsyncSync", effect: "throw", code: "EIO" }, "c");
});

test("TM-68 (d) the lock lost BEFORE the batch: E_LOCK_LOST, no event of the recovery, the next opening recovers once", (t) => {
  const home = makeHome(t);
  const { id } = newProject(home, makeClock());
  const dir = path.join(home, id);
  const events = path.join(dir, "events.jsonl");
  const lock = path.join(dir, "writer.lock");
  const pid = crashWriter(home, id, RECOVERY_FIXTURE);
  const base = journalOf(events).length;
  const before = fs.readFileSync(events);

  const { foreign } = loseLockAfterAppend(t, events, lock, 1);
  const counts = countJournalCalls(t, events);
  assertThrowsCode(
    () => openWriter(id, { home, now: makeClock(Date.now(), 1) }),
    "E_LOCK_LOST",
  );
  t.mock.restoreAll();
  // Only the line LOCK_STALE_REMOVED was written (one write, one fsync); the batch was
  // refused before any call at the journal: no second write, no rollback.
  assert.deepStrictEqual(counts, {
    writeSync: 1,
    fsyncSync: 1,
    ftruncateSync: 0,
  });
  const added = journalOf(events).slice(base);
  assert.deepStrictEqual(typesOf(added), ["LOCK_STALE_REMOVED"]);
  assert.deepStrictEqual(added[0].data, { pid });
  assert.ok(
    fs.readFileSync(events).subarray(0, before.length).equals(before),
    "the old lines are as they were",
  );
  assert.deepStrictEqual(recoveryRows(journalOf(events), base), []);
  assert.equal(
    fs.readFileSync(lock, "utf8"),
    foreign,
    "the lock of the other stays",
  );

  // The other process is gone: its lock is replaced by the lock of a dead pid.
  fs.writeFileSync(
    lock,
    `${JSON.stringify({ pid: deadPid(), since: "2026-10-06T08:00:00.000Z" })}\n`,
    { mode: 0o600 },
  );
  openWriter(id, { home, now: makeClock(Date.now(), 1) }).close();
  const all = journalOf(events);
  assert.deepStrictEqual(typesOf(all.slice(base)), [
    "LOCK_STALE_REMOVED",
    "LOCK_STALE_REMOVED",
    ...BATCH_TYPES,
  ]);
  assertRecoveredOnce(all, base, "d");
  assertRecoveredState(id, home, "d");
});

test("TM-68 (e) the lock lost AFTER the batch: the batch is whole, the next write is E_LOCK_LOST, the next opening adds no recovery", (t) => {
  const home = makeHome(t);
  const { id } = newProject(home, makeClock());
  const dir = path.join(home, id);
  const events = path.join(dir, "events.jsonl");
  const lock = path.join(dir, "writer.lock");
  crashWriter(home, id, RECOVERY_FIXTURE);
  const base = journalOf(events).length;

  const { foreign } = loseLockAfterAppend(t, events, lock, 2);
  const w = openWriter(id, { home, now: makeClock(Date.now(), 1) });
  t.mock.restoreAll();
  const after = journalOf(events);
  assert.deepStrictEqual(typesOf(after.slice(base)), [
    "LOCK_STALE_REMOVED",
    ...BATCH_TYPES,
  ]);
  assertRecoveredOnce(after, base, "e");
  assertRecoveredState(id, home, "e");
  const hash = sha256(fs.readFileSync(events));
  assertThrowsCode(() => w.say("Чужой замок"), "E_LOCK_LOST");
  assert.equal(
    sha256(fs.readFileSync(events)),
    hash,
    "a refused write changes nothing",
  );
  w.close();
  assert.equal(
    fs.readFileSync(lock, "utf8"),
    foreign,
    "the lock of the other stays",
  );

  fs.writeFileSync(
    lock,
    `${JSON.stringify({ pid: deadPid(), since: "2026-10-06T08:00:00.000Z" })}\n`,
    { mode: 0o600 },
  );
  openWriter(id, { home, now: makeClock(Date.now(), 1) }).close();
  const all = journalOf(events);
  assert.deepStrictEqual(typesOf(all.slice(base + 4)), ["LOCK_STALE_REMOVED"]);
  assert.equal(all.filter((e) => e.type === "PROJECT_RECOVERED").length, 1);
});

test("TM-68 (f) one fsync of the journal for the whole batch, one write, no ftruncate", (t) => {
  const p = closedFixture(t);
  const base = journalOf(p.events).length;
  const counts = countJournalCalls(t, p.events);
  openWriter(p.id, { home: p.home, now: makeClock(Date.now(), 1) }).close();
  t.mock.restoreAll();
  assert.deepStrictEqual(typesOf(journalOf(p.events).slice(base)), BATCH_TYPES);
  assert.equal(counts.fsyncSync, 1, "one fsync for three events");
  assert.equal(counts.ftruncateSync, 0, "no rollback");
  assert.equal(counts.writeSync, 1, "one write for three events");
});
