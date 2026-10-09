// Sai Team core: the state is rebuilt from the journal, the transitions and the
// invariants (design REQ-009, TM-02, TM-03, TM-04, TM-05, TM-52, TM-53, TM-55, TM-62).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PROJECT_ENTRIES } from "../src/team/home.js";
import { EVENT_TYPES } from "../src/team/schema.js";
import { listProjects, readProject } from "../src/team/store.js";
import { eventView, projectView } from "../src/team/view.js";
import {
  TEAM_SRC,
  agent,
  assertAppendRefused,
  assertStatusChanges,
  assertRefusal,
  buildDone,
  buildFailed,
  buildStopped,
  endRun,
  eng,
  finishTask,
  journalOf,
  makeClock,
  makeHome,
  newProject,
  openTracked,
  planTask,
  reviewTask,
  runModule,
  startProject,
  startRun,
  STORE_URL,
  usr,
  withPlan,
  workTask,
} from "./team-helpers.js";

// ---- TM-02 ---------------------------------------------------------------------------

for (const executor of ["claude-cli", "scripted"]) {
  test(`TM-02 the state of the writer equals the state another process rebuilds (${executor})`, (t) => {
    const home = makeHome(t);
    const clock = makeClock();
    const scenario = Buffer.from('{"steps":[]}\n');
    const { id } = newProject(
      home,
      clock,
      executor === "scripted"
        ? { executor, scenario_bytes: scenario }
        : { executor },
    );
    const writer = openTracked(t, home, id, clock);
    buildDone(writer);
    const events = journalOf(path.join(home, id, "events.jsonl"));
    assert.ok(events.length >= 30, `only ${events.length} events`);
    assert.ok(new Set(events.map((e) => e.type)).size >= 30);
    assert.equal(writer.state.status, "done");

    const out = runModule(
      home,
      `import { readProject } from ${JSON.stringify(STORE_URL)};
process.stdout.write(JSON.stringify(readProject(${JSON.stringify(id)}, { home: process.env.SAI_TEAM_HOME }).state));`,
    );
    assert.deepStrictEqual(JSON.parse(out), writer.state);
    assert.deepStrictEqual(readProject(id, { home }).state, writer.state);
    assertStatusChanges(events);
  });
}

// ---- TM-03 ---------------------------------------------------------------------------

function entryOf(name) {
  return PROJECT_ENTRIES.find(
    (e) => (e.name !== undefined && e.name === name) || e.pattern?.test(name),
  );
}

test("TM-03 the entries of a project folder are exactly the list PROJECT_ENTRIES; no derived state file", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const scripted = newProject(home, clock, {
    executor: "scripted",
    scenario_bytes: Buffer.from('{"a":1}'),
  });
  const plain = newProject(home, clock);
  const writer = openTracked(t, home, scripted.id, clock);
  writer.say("Привет");
  const other = openTracked(t, home, plain.id, clock);
  const check = (id, scriptedProject, locked) => {
    const dir = path.join(home, id);
    const names = fs.readdirSync(dir).sort();
    for (const name of names) {
      const entry = entryOf(name);
      assert.ok(entry, `${name} is not in PROJECT_ENTRIES`);
      const st = fs.lstatSync(path.join(dir, name));
      assert.equal(entry.kind === "dir" ? st.isDirectory() : st.isFile(), true);
      assert.equal(st.mode & 0o777, entry.mode, `mode of ${name}`);
      if (entry.when === "scripted") assert.equal(scriptedProject, true);
      if (entry.when === "writer") assert.equal(locked, true);
    }
    assert.equal(names.includes("scenario.json"), scriptedProject);
    assert.equal(names.includes("writer.lock"), locked);
    for (const must of ["events.jsonl", "files", "work"]) {
      assert.ok(names.includes(must), `${must} is missing`);
    }
  };
  check(scripted.id, true, true);
  check(plain.id, false, true);
  // nobody names a derived state file in the list
  for (const entry of PROJECT_ENTRIES) {
    assert.doesNotMatch(String(entry.name ?? entry.pattern), /state|cache/i);
  }
  // work/ is empty and 0700, without files of the core
  const work = path.join(home, scripted.id, "work");
  assert.deepStrictEqual(fs.readdirSync(work), []);
  assert.equal(fs.lstatSync(work).mode & 0o777, 0o700);

  writer.close();
  other.close();
  check(scripted.id, true, false);
  check(plain.id, false, false);

  // deleting everything except events.jsonl, files/, work/, scenario.json changes
  // nothing about the state
  const dir = path.join(home, scripted.id);
  const before = readProject(scripted.id, { home }).state;
  fs.writeFileSync(path.join(dir, "state.json"), "{}");
  fs.writeFileSync(path.join(dir, "cache.json"), "{}");
  for (const name of fs.readdirSync(dir)) {
    if (!["events.jsonl", "files", "work", "scenario.json"].includes(name)) {
      fs.rmSync(path.join(dir, name), { recursive: true });
    }
  }
  assert.deepStrictEqual(readProject(scripted.id, { home }).state, before);
  assert.deepStrictEqual(listProjects({ home }).projects.length, 2);
});

// ---- TM-04 ---------------------------------------------------------------------------

function sourcesBelow(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourcesBelow(file));
    else if (entry.name.endsWith(".js")) out.push(file);
  }
  return out.sort();
}

test("TM-04 the places that write files in tools/src/team are exactly the five of the design (four of the core and the channel of REQ-013)", () => {
  const found = [];
  for (const file of sourcesBelow(TEAM_SRC)) {
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/writeFile|appendFile|createWriteStream/.test(line)) {
          found.push({
            file: path.relative(TEAM_SRC, file),
            line: i + 1,
            text: line.trim(),
          });
        }
      });
  }
  assert.deepStrictEqual(
    found.map((f) => f.file).sort(),
    [
      path.join("engine", "channel.js"),
      "files.js",
      "lock.js",
      "store.js",
      "store.js",
    ],
    found.map((f) => `${f.file}:${f.line}`).join(", "),
  );
  for (const hit of found) {
    assert.match(
      hit.text,
      /fs\.writeFileSync\(/,
      "only writeFileSync, through fs.*",
    );
  }
});

// ---- TM-05 ---------------------------------------------------------------------------

function running(t, tasks, over = {}) {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock(), over);
  if (tasks !== undefined) withPlan(p.writer, tasks);
  return p;
}

function readyForDone(w) {
  finishTask(w, "t-0001");
  const goal = startRun(w, "goal_check", "reviewer");
  w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: goal }));
  w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: goal,
      passed: true,
      notes: "Цель достигнута",
    }),
  );
  endRun(w, goal);
}

test("TM-05 И2: statuses change only as the table says; after a final status only the allowed events", (t) => {
  const p = running(t);
  const { writer: w, dir } = p;
  assertAppendRefused(w, dir, eng("PROJECT_DONE"), "E_TRANSITION", "И2");
  assertAppendRefused(w, dir, usr("PROJECT_PAUSED"), "E_TRANSITION", "И2");
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  assertAppendRefused(
    w,
    dir,
    usr("PROJECT_STARTED", { parallel: 1 }),
    "E_TRANSITION",
    "И2",
  );
  w.append(usr("PROJECT_STOPPED"));
  assertAppendRefused(
    w,
    dir,
    eng("PLANNING_STARTED", { round: 0 }),
    "E_TRANSITION",
    "И2",
  );
  assertAppendRefused(w, dir, usr("PROJECT_STOPPED"), "E_TRANSITION", "И2");
  assertAppendRefused(
    w,
    dir,
    usr("PROJECT_RESUMED", { parallel: null, after: "command" }),
    "E_TRANSITION",
  );
  // the events allowed after a final status are accepted
  w.say("Спасибо");
  w.addMemory({ kind: "note", text: "Итог записан" });
  assert.equal(w.state.status, "stopped");
});

test("TM-05 И3: a task does not start before its dependencies are done", (t) => {
  const p = running(t, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "marketer", { depends_on: ["t-0001"] }),
  ]);
  assertAppendRefused(
    p.writer,
    p.dir,
    eng("TASK_STARTED", {}, "t-0002"),
    "E_TRANSITION",
    "И3",
  );
  finishTask(p.writer, "t-0001");
  p.writer.append(eng("TASK_STARTED", {}, "t-0002"));
  assert.equal(p.writer.state.tasks[1].status, "running");
});

test("TM-05 И4: done by review needs a passed review after the review began; done by approval needs the approval", (t) => {
  const p = running(t, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "marketer", { critical: true }),
    planTask("t-0003", "lawyer"),
  ]);
  const { writer: w, dir } = p;
  workTask(w, "t-0001");
  const done = (via, external = false) =>
    eng("TASK_DONE", { via, external_action_done: external }, "t-0001");
  assertAppendRefused(w, dir, done("review"), "E_TRANSITION", "И4");
  w.append(eng("TASK_REVIEW", {}, "t-0001"));
  assertAppendRefused(w, dir, done("review"), "E_TRANSITION", "И4");
  const run = startRun(w, "review", "reviewer", "t-0001");
  endRun(w, run, "t-0001");
  w.append(
    eng(
      "REVIEW_RESULT",
      { run_id: run, passed: false, notes: "Не годится" },
      "t-0001",
    ),
  );
  assertAppendRefused(w, dir, done("review"), "E_TRANSITION", "И4");
  assertAppendRefused(w, dir, done("approval"), "E_TRANSITION", "И4");

  // approval: only a critical task, only after the approve of the user
  workTask(w, "t-0002");
  w.writeResultFile({
    task: "t-0002",
    name: "draft.md",
    content: "Черновик",
    kind: "draft",
  });
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "approval", draft: "draft.md" },
      "t-0002",
    ),
  );
  const approval = (external) =>
    eng(
      "TASK_DONE",
      { via: "approval", external_action_done: external },
      "t-0002",
    );
  assertAppendRefused(w, dir, approval(false), "E_TRANSITION", "И4");
  w.append(
    usr("DECISION_RECEIVED", { decision: "change", text: "Короче" }, "t-0002"),
  );
  assertAppendRefused(w, dir, approval(false), "E_TRANSITION", "И4");
  w.append(
    usr("DECISION_RECEIVED", { decision: "approve", text: null }, "t-0002"),
  );
  assertAppendRefused(w, dir, approval(true), "E_TRANSITION", "И4");
  w.append(approval(false));
  assert.equal(w.state.tasks[1].status, "done");
});

test("TM-05 И5: the number of a new task is the next one, dependencies go to smaller numbers, the role is from the catalog", (t) => {
  const p = running(t);
  const { writer: w, dir } = p;
  const created = (task, over = {}) =>
    eng(
      "TASK_CREATED",
      {
        role: "lawyer",
        text: "Проверить договор",
        done_when: "Риски названы",
        depends_on: [],
        critical: false,
        ...over,
      },
      task,
    );
  assertAppendRefused(w, dir, created("t-0002"), "E_TRANSITION", "И5");
  assertAppendRefused(
    w,
    dir,
    created("t-0001", { depends_on: ["t-0001"] }),
    "E_TRANSITION",
    "И5",
  );
  assertAppendRefused(
    w,
    dir,
    created("t-0001", { depends_on: ["t-0005"] }),
    "E_TRANSITION",
    "И5",
  );
  assertAppendRefused(w, dir, created("t-0001", { role: "wizard" }), "E_EVENT");
  w.append(created("t-0001"));
  w.append(created("t-0002", { depends_on: ["t-0001"] }));
  assert.equal(w.state.tasks.length, 2);
});

test("TM-05 И5: at most 200 tasks in a project and at most 40 in a plan", (t) => {
  const p = running(t);
  const { writer: w, dir } = p;
  const forty = Array.from({ length: 41 }, (_, i) =>
    planTask(`t-${String(i + 1).padStart(4, "0")}`, "researcher"),
  );
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  assertAppendRefused(
    w,
    dir,
    eng("PLAN_RECEIVED", { round: 0, tasks: forty }),
    "E_EVENT",
  );
  w.append(eng("PLAN_RECEIVED", { round: 0, tasks: forty.slice(0, 40) }));
  for (let i = 40; i < 200; i += 1) {
    w.addTask({
      role: "researcher",
      text: `Задача ${i + 1}`,
      done_when: "Готово",
    });
  }
  assert.equal(w.state.tasks.length, 200);
  assertRefusal(
    dir,
    () =>
      w.addTask({ role: "researcher", text: "Лишняя", done_when: "Готово" }),
    "E_TRANSITION",
    "И5",
  );
});

test("TM-05 И6: the project is done only with all tasks done and a goal check after the last change", (t) => {
  const p = running(t, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  const { writer: w, dir } = p;
  assertAppendRefused(w, dir, eng("PROJECT_DONE"), "E_TRANSITION", "И6");
  finishTask(w, "t-0001");
  assertAppendRefused(w, dir, eng("PROJECT_DONE"), "E_TRANSITION", "И6");
  finishTask(w, "t-0002");
  assertAppendRefused(w, dir, eng("PROJECT_DONE"), "E_TRANSITION", "И6");
  const goal = startRun(w, "goal_check", "reviewer");
  w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: goal }));
  w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: goal,
      passed: false,
      notes: "Не хватает",
    }),
  );
  assertAppendRefused(w, dir, eng("PROJECT_DONE"), "E_TRANSITION", "И6");
  w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: goal,
      passed: true,
      notes: "Хватает",
    }),
  );
  w.addTask({ role: "lawyer", text: "Ещё одна", done_when: "Готово" });
  assertAppendRefused(w, dir, eng("PROJECT_DONE"), "E_TRANSITION", "И6");
});

test("TM-05 И6: a project without tasks cannot be done", (t) => {
  const p = running(t);
  p.writer.append(usr("PROJECT_STARTED", { parallel: 1 }));
  assertAppendRefused(
    p.writer,
    p.dir,
    eng("PROJECT_DONE"),
    "E_TRANSITION",
    "И6",
  );
});

test("TM-05 И7: runs, their tasks, the review result and the goal check refer to real runs", (t) => {
  const p = running(t, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  const { writer: w, dir } = p;
  const ex = w.state.executor;
  const bad = (run_id) => ({
    run_id,
    activity: "other",
    executor: ex,
    text: null,
  });
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  assertAppendRefused(
    w,
    dir,
    eng(
      "RUN_STARTED",
      {
        run_id: "r-00002",
        purpose: "work",
        role: "researcher",
        executor: ex,
        max_budget_usd: null,
      },
      "t-0001",
    ),
    "E_TRANSITION",
    "И7",
  );
  assertAppendRefused(
    w,
    dir,
    agent("AGENT_ACTIVITY", bad("r-00001"), "t-0001"),
    "E_TRANSITION",
    "И7",
  );
  assertAppendRefused(
    w,
    dir,
    eng(
      "RUN_FINISHED",
      {
        run_id: "r-00001",
        outcome: "ok",
        summary: null,
        cost_usd: null,
        files: [],
      },
      "t-0001",
    ),
    "E_TRANSITION",
    "И7",
  );
  const run = startRun(w, "work", "researcher", "t-0001");
  // the task of the event is the task of the run
  assertAppendRefused(
    w,
    dir,
    agent("AGENT_ACTIVITY", bad(run), "t-0002"),
    "E_TRANSITION",
    "И7",
  );
  assertAppendRefused(
    w,
    dir,
    eng(
      "RUN_FINISHED",
      { run_id: run, outcome: "ok", summary: null, cost_usd: null, files: [] },
      "t-0002",
    ),
    "E_TRANSITION",
    "И7",
  );
  endRun(w, run, "t-0001");
  // a review result needs a run of the review of this very task
  w.append(eng("TASK_REVIEW", {}, "t-0001"));
  assertAppendRefused(
    w,
    dir,
    eng(
      "REVIEW_RESULT",
      { run_id: run, passed: true, notes: "Хорошо" },
      "t-0001",
    ),
    "E_TRANSITION",
    "И7",
  );
  // a goal check needs a goal-check run
  assertAppendRefused(
    w,
    dir,
    eng("GOAL_CHECK_STARTED", { round: 0, run_id: run }),
    "E_TRANSITION",
    "И7",
  );
  assertAppendRefused(
    w,
    dir,
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: run,
      passed: true,
      notes: "Да",
    }),
    "E_TRANSITION",
    "И7",
  );
});

test("TM-05 И8: the cost of a run is charged once, for its task, with the right total; the ceiling is above zero and above the spent", (t) => {
  const p = running(t, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  const { writer: w, dir } = p;
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  const run = startRun(w, "work", "researcher", "t-0001");
  endRun(w, run, "t-0001", { cost_usd: 1 });
  const spent = (over = {}, task = "t-0001") =>
    eng(
      "BUDGET_SPENT",
      {
        run_id: run,
        cost_usd: 1,
        accounted: "reported",
        total_usd: 1,
        ...over,
      },
      task,
    );
  assertAppendRefused(w, dir, spent({ total_usd: 2 }), "E_TRANSITION", "И8");
  assertAppendRefused(
    w,
    dir,
    spent({ run_id: "r-00009" }),
    "E_TRANSITION",
    "И8",
  );
  assertAppendRefused(w, dir, spent({}, "t-0002"), "E_TRANSITION", "И8");
  w.append(spent());
  assert.equal(w.state.spent_usd, 1);
  assertAppendRefused(w, dir, spent({ total_usd: 2 }), "E_TRANSITION", "И8");
  assertAppendRefused(
    w,
    dir,
    usr("BUDGET_SET", { budget_usd: 1 }),
    "E_TRANSITION",
    "И8",
  );
  assertAppendRefused(
    w,
    dir,
    usr("BUDGET_SET", { budget_usd: 0 }),
    "E_TRANSITION",
    "И8",
  );
  w.append(usr("BUDGET_SET", { budget_usd: 1.5 }));
  assert.equal(w.state.budget_usd, 1.5);
});

test("TM-05 И9: a reassignment names the real role of the task and another role", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")]);
  const { writer: w, dir } = p;
  const move = (from_role, to_role) =>
    eng(
      "TASK_REASSIGNED",
      { from_role, to_role, reason: "Нужен другой специалист" },
      "t-0001",
    );
  assertAppendRefused(w, dir, move("lawyer", "marketer"), "E_TRANSITION", "И9");
  assertAppendRefused(
    w,
    dir,
    move("researcher", "researcher"),
    "E_TRANSITION",
    "И9",
  );
  assertAppendRefused(w, dir, move("researcher", "wizard"), "E_EVENT");
  w.append(move("researcher", "lawyer"));
  assert.equal(w.state.tasks[0].role, "lawyer");
});

test("TM-05 И10: a decision to change has a text; an approval only for a task that waits", (t) => {
  const p = running(t, [planTask("t-0001", "marketer", { critical: true })]);
  const { writer: w, dir } = p;
  assertAppendRefused(
    w,
    dir,
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0001"),
    "E_TRANSITION",
    "И10",
  );
  workTask(w, "t-0001");
  w.writeResultFile({
    task: "t-0001",
    name: "draft.md",
    content: "Черновик",
    kind: "draft",
  });
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "approval", draft: "draft.md" },
      "t-0001",
    ),
  );
  assertAppendRefused(
    w,
    dir,
    usr("DECISION_RECEIVED", { decision: "change", text: null }, "t-0001"),
    "E_TRANSITION",
    "И10",
  );
  w.append(
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0001"),
  );
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "rejected_by_user", detail: "Отклонено" },
      "t-0001",
    ),
  );
  assertAppendRefused(
    w,
    dir,
    usr("DECISION_RECEIVED", { decision: "approve", text: null }, "t-0001"),
    "E_TRANSITION",
    "И10",
  );
  w.append(
    usr(
      "DECISION_RECEIVED",
      { decision: "change", text: "Переделать" },
      "t-0001",
    ),
  );
});

// ---- TM-52 ---------------------------------------------------------------------------

test("TM-52 a plan with a role outside the catalog or a dependency forward creates no task at all", (t) => {
  const p = running(t);
  const { writer: w, dir } = p;
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  const plan = (tasks) => eng("PLAN_RECEIVED", { round: 0, tasks });
  assertAppendRefused(
    w,
    dir,
    plan([planTask("t-0001", "researcher"), planTask("t-0002", "wizard")]),
    "E_EVENT",
  );
  assertAppendRefused(
    w,
    dir,
    plan([
      planTask("t-0001", "researcher", { depends_on: ["t-0002"] }),
      planTask("t-0002", "lawyer"),
    ]),
    "E_TRANSITION",
    "И5",
  );
  assertAppendRefused(
    w,
    dir,
    plan([planTask("t-0001", "researcher"), planTask("t-0003", "lawyer")]),
    "E_TRANSITION",
    "И5",
  );
  assertAppendRefused(
    w,
    dir,
    plan([planTask("t-0002", "researcher")]),
    "E_TRANSITION",
    "И5",
  );
  assertAppendRefused(w, dir, plan([]), "E_EVENT");
  assert.deepStrictEqual(w.state.tasks, []);
  w.append(
    plan([
      planTask("t-0001", "researcher"),
      planTask("t-0002", "lawyer", { depends_on: ["t-0001"] }),
    ]),
  );
  // the whole plan is one line of the journal
  const lines = journalOf(p.events);
  assert.equal(lines.at(-1).type, "PLAN_RECEIVED");
  assert.equal(lines.at(-1).data.tasks.length, 2);
  assert.equal(w.state.tasks.length, 2);
});

// ---- TM-53 ---------------------------------------------------------------------------

test("TM-53 И12: every event of an agent carries the executor of the project", (t) => {
  const p = running(t);
  const { writer: w, dir } = p;
  assert.equal(w.state.executor, "claude-cli");
  w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  const wrong = {
    run_id: "r-00001",
    purpose: "plan",
    role: "project_manager",
    max_budget_usd: null,
  };
  assertAppendRefused(
    w,
    dir,
    eng("RUN_STARTED", { ...wrong, executor: "scripted" }),
    "E_TRANSITION",
    "И12",
  );
  const run = startRun(w, "plan", "project_manager", null, {
    executor: "claude-cli",
  });
  assertAppendRefused(
    w,
    dir,
    agent("AGENT_ACTIVITY", {
      run_id: run,
      activity: "reading",
      executor: "scripted",
      text: null,
    }),
    "E_TRANSITION",
    "И12",
  );
  w.append(
    agent("AGENT_ACTIVITY", {
      run_id: run,
      activity: "reading",
      executor: "claude-cli",
      text: null,
    }),
  );
  assertAppendRefused(
    w,
    dir,
    agent("MEMORY_ADDED", {
      kind: "note",
      text: "Заметка",
      executor: "scripted",
    }),
    "E_TRANSITION",
    "И12",
  );
  w.append(
    agent("MEMORY_ADDED", {
      kind: "note",
      text: "Заметка",
      executor: "claude-cli",
    }),
  );
  // the form: no executor from an agent, an executor from the others
  assertAppendRefused(
    w,
    dir,
    agent("MEMORY_ADDED", { kind: "note", text: "Заметка" }),
    "E_EVENT",
  );
  assertAppendRefused(
    w,
    dir,
    eng("MEMORY_ADDED", {
      kind: "note",
      text: "Заметка",
      executor: "claude-cli",
    }),
    "E_EVENT",
  );
  assertAppendRefused(
    w,
    dir,
    usr("MEMORY_ADDED", {
      kind: "note",
      text: "Заметка",
      executor: "claude-cli",
    }),
    "E_EVENT",
  );
  assertAppendRefused(
    w,
    dir,
    agent("AGENT_ACTIVITY", { run_id: run, activity: "reading", text: null }),
    "E_EVENT",
  );
  assertRefusal(
    dir,
    () => w.addMemory({ kind: "note", text: "Без исполнителя" }, "AGENT"),
    "E_EVENT",
  );
  assertRefusal(
    dir,
    () => w.addMemory({ kind: "note", text: "Лишний", executor: "claude-cli" }),
    "E_EVENT",
  );
});

test("TM-53 every type of the catalog that an agent may write has the field executor", () => {
  const agentTypes = Object.entries(EVENT_TYPES)
    .filter(([, spec]) => spec.sources.includes("AGENT"))
    .map(([name]) => name)
    .sort();
  assert.deepStrictEqual(agentTypes, ["AGENT_ACTIVITY", "MEMORY_ADDED"]);
  for (const name of agentTypes) {
    assert.ok(
      Object.hasOwn(EVENT_TYPES[name].fields, "executor"),
      `${name} has no field executor`,
    );
  }
});

// ---- TM-55 ---------------------------------------------------------------------------

test("TM-55 a file of a task is in Task.files; the reason and the question of the project are set and cleared by their events", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")]);
  const { writer: w } = p;
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  startRun(w, "work", "researcher", "t-0001");
  w.writeResultFile({ task: "t-0001", name: "a.md", content: "Текст" });
  assert.deepStrictEqual(w.state.tasks[0].files, ["a.md"]);
  assert.deepStrictEqual(
    w.state.files.map((f) => [f.name, f.task, f.kind, f.from_work]),
    [["a.md", "t-0001", "result", false]],
  );
  w.append(
    eng(
      "RUN_FINISHED",
      {
        run_id: "r-00001",
        outcome: "failed",
        summary: null,
        cost_usd: null,
        files: ["a.md"],
      },
      "t-0001",
    ),
  );
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Нет" },
      "t-0001",
    ),
  );
  assert.equal(w.state.tasks[0].reason, "retries_exhausted");
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  assert.equal(w.state.tasks[0].reason, null);

  w.append(eng("PROJECT_WAITING", { reason: "task_failed" }, "t-0001"));
  const waiting = w.state.waiting;
  assert.deepStrictEqual(waiting, { reason: "task_failed", task: "t-0001" });
  w.append(usr("PROJECT_PAUSED"));
  assert.deepStrictEqual(w.state.waiting, waiting);
  assert.equal(w.state.paused_by, "user");
  w.append(usr("PROJECT_RESUMED", { parallel: null, after: "command" }));
  assert.equal(w.state.waiting, null);
  assert.equal(w.state.paused_by, null);
  assert.equal(w.state.status, "running");
});

test("TM-55 the files a run names were written by this run for its task", (t) => {
  const p = running(t, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  const { writer: w, dir } = p;
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  w.append(eng("TASK_STARTED", {}, "t-0002"));
  w.writeResultFile({
    task: "t-0001",
    name: "before.md",
    content: "До запуска",
  });
  const run1 = startRun(w, "work", "researcher", "t-0001");
  const run2 = startRun(w, "work", "lawyer", "t-0002");
  w.writeResultFile({ task: "t-0002", name: "other.md", content: "Чужой" });
  w.writeResultFile({ task: "t-0001", name: "mine.md", content: "Мой" });
  const finish = (run, task, files) =>
    eng(
      "RUN_FINISHED",
      { run_id: run, outcome: "ok", summary: null, cost_usd: null, files },
      task,
    );
  assertAppendRefused(
    w,
    dir,
    finish(run1, "t-0001", ["before.md"]),
    "E_TRANSITION",
    "И15",
  );
  assertAppendRefused(
    w,
    dir,
    finish(run1, "t-0001", ["other.md"]),
    "E_TRANSITION",
    "И15",
  );
  assertAppendRefused(
    w,
    dir,
    finish(run1, "t-0001", ["missing.md"]),
    "E_TRANSITION",
    "И15",
  );
  w.append(finish(run1, "t-0001", ["mine.md"]));
  w.append(finish(run2, "t-0002", ["other.md"]));
});

test("TM-55 an event about a task that does not exist, a run with a role not of the task, a refusal for a done task", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")]);
  const { writer: w, dir } = p;
  assertAppendRefused(
    w,
    dir,
    eng("TASK_STARTED", {}, "t-0099"),
    "E_TASK_NOT_FOUND",
  );
  assertAppendRefused(
    w,
    dir,
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0099"),
    "E_TASK_NOT_FOUND",
  );
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  assertAppendRefused(
    w,
    dir,
    eng(
      "RUN_STARTED",
      {
        run_id: "r-00001",
        purpose: "work",
        role: "lawyer",
        executor: "claude-cli",
        max_budget_usd: null,
      },
      "t-0001",
    ),
    "E_TRANSITION",
    "И16",
  );
  assertAppendRefused(
    w,
    dir,
    eng(
      "RUN_STARTED",
      {
        run_id: "r-00001",
        purpose: "review",
        role: "reviewer",
        executor: "claude-cli",
        max_budget_usd: null,
      },
      "t-0001",
    ),
    "E_TRANSITION",
    "И16",
  );
  endRun(w, startRun(w, "work", "researcher", "t-0001"), "t-0001");
  reviewTask(w, "t-0001");
  assertAppendRefused(
    w,
    dir,
    eng("RUN_REFUSED", { reason: "budget_exhausted", detail: "Нет" }, "t-0001"),
    "E_TRANSITION",
    "И18",
  );
});

test("TM-55 И6: a memory entry with a task does not move the last change of the tasks; a file with a task does", (t) => {
  const p = running(t, [planTask("t-0001", "researcher")]);
  const { writer: w, dir } = p;
  readyForDone(w);
  const before = w.state.tasks_changed_seq;
  w.addMemory({ kind: "fact", text: "Факт о задаче", task: "t-0001" });
  assert.equal(w.state.tasks_changed_seq, before);
  w.append(eng("PROJECT_DONE"));
  assert.equal(w.state.status, "done");

  const q = running(t, [planTask("t-0001", "researcher")]);
  readyForDone(q.writer);
  q.writer.writeResultFile({
    task: "t-0001",
    name: "late.md",
    content: "Поздний файл",
  });
  assertAppendRefused(
    q.writer,
    q.dir,
    eng("PROJECT_DONE"),
    "E_TRANSITION",
    "И6",
  );
  assert.ok(dir !== q.dir);
});

test("TM-55 И19: a task that waits for approval is critical and has a draft of its own", (t) => {
  const p = running(t, [
    planTask("t-0001", "marketer", { critical: true }),
    planTask("t-0002", "lawyer", { critical: true }),
    planTask("t-0003", "support"),
  ]);
  const { writer: w, dir } = p;
  for (const id of ["t-0001", "t-0002", "t-0003"])
    w.append(eng("TASK_STARTED", {}, id));
  w.writeResultFile({
    task: "t-0001",
    name: "draft1.md",
    content: "Черновик 1",
    kind: "draft",
  });
  w.writeResultFile({
    task: "t-0001",
    name: "result1.md",
    content: "Результат 1",
    kind: "result",
  });
  w.writeResultFile({
    task: "t-0002",
    name: "draft2.md",
    content: "Черновик 2",
    kind: "draft",
  });
  w.writeResultFile({ task: "t-0003", name: "note3.md", content: "Файл 3" });
  const waiting = (task, reason, draft) =>
    eng("TASK_WAITING_USER", { reason, draft }, task);
  assertAppendRefused(
    w,
    dir,
    waiting("t-0001", "approval", null),
    "E_TRANSITION",
    "И19",
  );
  assertAppendRefused(
    w,
    dir,
    waiting("t-0001", "approval", "result1.md"),
    "E_TRANSITION",
    "И19",
  );
  assertAppendRefused(
    w,
    dir,
    waiting("t-0001", "approval", "draft2.md"),
    "E_TRANSITION",
    "И19",
  );
  assertAppendRefused(
    w,
    dir,
    waiting("t-0001", "approval", "nothing.md"),
    "E_TRANSITION",
    "И19",
  );
  assertAppendRefused(
    w,
    dir,
    waiting("t-0003", "approval", "note3.md"),
    "E_TRANSITION",
    "И19",
  );
  assertAppendRefused(
    w,
    dir,
    waiting("t-0003", "review_failed", "draft2.md"),
    "E_TRANSITION",
    "И19",
  );
  w.append(waiting("t-0001", "approval", "draft1.md"));
  w.append(waiting("t-0003", "review_failed", null));
  assert.equal(w.state.tasks[0].status, "waiting_user");
  assert.equal(w.state.tasks[2].status, "waiting_user");
  w.append(waiting("t-0002", "review_failed", "draft2.md"));
});

// ---- TM-62 ---------------------------------------------------------------------------

test("TM-62 the second attempt at a plan is PLAN_RETRY; planning never follows planning", (t) => {
  const p = running(t);
  const { writer: w, dir } = p;
  const rejected = (attempt) =>
    eng("PLAN_REJECTED", {
      round: 0,
      attempt,
      reason: "schema",
      detail: "Нет критерия",
    });
  const retry = eng("PLAN_RETRY", { round: 0, attempt: 2 });
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  assert.equal(w.state.status, "planning");
  assert.equal(w.state.plan.attempt, 1);
  assertAppendRefused(
    w,
    dir,
    eng("PLANNING_STARTED", { round: 0 }),
    "E_TRANSITION",
  );
  assertAppendRefused(w, dir, retry, "E_TRANSITION");
  assertAppendRefused(w, dir, rejected(2), "E_TRANSITION");
  w.append(rejected(1));
  assert.equal(w.state.plan.last_rejection.reason, "schema");
  w.append(retry);
  assert.equal(w.state.status, "planning");
  assert.equal(w.state.plan.attempt, 2);
  assertAppendRefused(w, dir, retry, "E_TRANSITION");
  assertAppendRefused(
    w,
    dir,
    eng("PLANNING_STARTED", { round: 0 }),
    "E_TRANSITION",
  );
  w.append(rejected(2));
  assertAppendRefused(w, dir, retry, "E_TRANSITION");
  w.append(
    eng("PLAN_RECEIVED", {
      round: 0,
      tasks: [planTask("t-0001", "researcher")],
    }),
  );
  assert.equal(w.state.status, "running");
  assert.equal(w.state.plan.last_rejection, null);
});

test("TM-62 the phrase of the retry, the form of its source and the status changes along the journal", (t) => {
  const p = running(t);
  const { writer: w, dir } = p;
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  w.append(
    eng("PLAN_REJECTED", {
      round: 0,
      attempt: 1,
      reason: "cycle",
      detail: "Цикл",
    }),
  );
  assertAppendRefused(
    w,
    dir,
    usr("PLAN_RETRY", { round: 0, attempt: 2 }),
    "E_EVENT",
  );
  w.append(eng("PLAN_RETRY", { round: 0, attempt: 2 }));
  w.append(
    eng("PLAN_RECEIVED", {
      round: 0,
      tasks: [planTask("t-0001", "researcher")],
    }),
  );
  const events = journalOf(p.events);
  assertStatusChanges(events);
  const out = readProject(p.id, { home: path.dirname(dir) });
  const view = projectView(out.state, out.tail, out.events);
  assert.equal(view.status, "running");
  assert.equal(
    eventView(
      events.find((e) => e.type === "PLAN_RETRY"),
      null,
    ).phrase,
    "Руководитель проекта составляет план заново",
  );
});

test("TM-62 (by the code, the design is silent) a plan of another round or a repeated rejection of one attempt is refused", (t) => {
  const p = running(t);
  const { writer: w, dir } = p;
  w.append(eng("PLANNING_STARTED", { round: 1 }));
  assertAppendRefused(
    w,
    dir,
    eng("PLAN_REJECTED", {
      round: 0,
      attempt: 1,
      reason: "schema",
      detail: "Нет",
    }),
    "E_TRANSITION",
  );
  assertAppendRefused(
    w,
    dir,
    eng("PLAN_RECEIVED", { round: 0, tasks: [planTask("t-0001", "lawyer")] }),
    "E_TRANSITION",
  );
  w.append(
    eng("PLAN_REJECTED", {
      round: 1,
      attempt: 1,
      reason: "schema",
      detail: "Нет",
    }),
  );
  assertAppendRefused(
    w,
    dir,
    eng("PLAN_REJECTED", {
      round: 1,
      attempt: 1,
      reason: "cycle",
      detail: "Цикл",
    }),
    "E_TRANSITION",
  );
});

// A plan without tasks is refused by the form of PLAN_RECEIVED (by the code: the
// design names only the upper bound); stopped and failed projects of the same
// helpers end properly.
test("TM-05 the ends of a project: stopped with an interrupted task, failed", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const a = newProject(home, clock);
  const wa = openTracked(t, home, a.id, clock);
  buildStopped(wa);
  assert.equal(wa.state.status, "stopped");
  assert.equal(wa.state.tasks[0].status, "interrupted");
  const b = newProject(home, clock);
  const wb = openTracked(t, home, b.id, clock);
  buildFailed(wb);
  assert.equal(wb.state.status, "failed");
  assertStatusChanges(journalOf(path.join(home, a.id, "events.jsonl")));
  assertStatusChanges(journalOf(path.join(home, b.id, "events.jsonl")));
});
