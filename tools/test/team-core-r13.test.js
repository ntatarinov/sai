// Sai Team core, the corrections r13 for the engine of REQ-013 (design REQ-009,
// section 20; TM-69 ... TM-72; design REQ-013, sections 2.1 and 2.3, C1, C2, C4,
// C6, C7). The former tests of the core are not changed by these corrections.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { lockHolder } from "../src/team/lock.js";
import { phrasesForJournal } from "../src/team/language.js";
import { replay } from "../src/team/reducer.js";
import { openWriter, readProject } from "../src/team/store.js";
import { installFaults } from "./fault-inject.js";
import {
  assertAppendRefused,
  buildDone,
  crashWriter,
  endRun,
  eng,
  journalOf,
  lockOf,
  makeClock,
  makeHome,
  newProject,
  openTracked,
  planTask,
  sha256,
  startProject,
  startRun,
  usr,
  withPlan,
  workTask,
} from "./team-helpers.js";

const NONCE_A = "0123456789abcdef";
const NONCE_B = "fedcba9876543210";
const MSG_1 = "m-000000000001.json";
const MSG_2 = "m-000000000002.json";

function fileHash(file) {
  return sha256(fs.readFileSync(file));
}

// A project with the plan of `tasks` (all of role developer unless given).
function planned(t, home, clock, tasks) {
  const p = startProject(t, home, clock);
  withPlan(p.writer, tasks);
  return p;
}

// The task t is rejected by the user while it waits for an approval.
function rejectCritical(w, id) {
  workTask(w, id);
  w.append(eng("TASK_REVIEW", {}, id));
  const run = startRun(w, "review", "reviewer", id);
  endRun(w, run, id);
  w.append(
    eng("REVIEW_RESULT", { run_id: run, passed: true, notes: "Хорошо" }, id),
  );
  w.writeResultFile({
    task: id,
    name: `${id}-draft.md`,
    content: "Черновик",
    kind: "draft",
  });
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "approval", draft: `${id}-draft.md` },
      id,
    ),
  );
  w.append(usr("DECISION_RECEIVED", { decision: "reject", text: null }, id));
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "rejected_by_user", detail: "Отклонено пользователем" },
      id,
    ),
  );
}

function passTask(w, id) {
  workTask(w, id);
  w.append(eng("TASK_REVIEW", {}, id));
  const run = startRun(w, "review", "reviewer", id);
  endRun(w, run, id);
  w.append(
    eng("REVIEW_RESULT", { run_id: run, passed: true, notes: "Хорошо" }, id),
  );
  w.append(
    eng("TASK_DONE", { via: "review", external_action_done: false }, id),
  );
}

function goalPassed(w) {
  const run = startRun(w, "goal_check", "reviewer");
  w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: run }));
  endRun(w, run);
  w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: run,
      passed: true,
      notes: "Цель достигнута",
    }),
  );
}

// ---- TM-69 (C1) ----------------------------------------------------------------------

test("TM-69 C1: PROJECT_DONE with one done task and one rejected task and a passed goal check is accepted", (t) => {
  const home = makeHome(t);
  const p = planned(t, home, makeClock(), [
    planTask("t-0001", "developer", { critical: true }),
    planTask("t-0002", "designer"),
  ]);
  const w = p.writer;
  rejectCritical(w, "t-0001");
  passTask(w, "t-0002");
  goalPassed(w);
  w.append(eng("PROJECT_DONE"));
  assert.equal(w.state.status, "done");
  assert.deepStrictEqual(
    replay(journalOf(p.events)),
    w.state,
    "the journal gives the same state",
  );
});

test("TM-69 C1: a task failed and then rejected by a decision (last_decision reject) is closed too", (t) => {
  const home = makeHome(t);
  const p = planned(t, home, makeClock(), [
    planTask("t-0001", "developer"),
    planTask("t-0002", "designer"),
  ]);
  const w = p.writer;
  w.append(eng("TASK_STARTED", {}, "t-0001"));
  endRun(w, startRun(w, "work", "developer", "t-0001"), "t-0001", {
    outcome: "failed",
  });
  w.append(
    eng(
      "TASK_FAILED",
      { reason: "retries_exhausted", detail: "Исполнитель упал" },
      "t-0001",
    ),
  );
  passTask(w, "t-0002");
  goalPassed(w);
  // not closed yet: a failed task without a decision blocks the end (И6)
  assertAppendRefused(w, p.dir, eng("PROJECT_DONE"), "E_TRANSITION", "И6");
  w.append(
    usr("DECISION_RECEIVED", { decision: "reject", text: null }, "t-0001"),
  );
  // the decision changed a task: the goal check is older than the change
  assertAppendRefused(w, p.dir, eng("PROJECT_DONE"), "E_TRANSITION", "И6");
  goalPassed(w);
  w.append(eng("PROJECT_DONE"));
  assert.equal(w.state.status, "done");
});

test("TM-69 C1: all tasks closed and none done — PROJECT_DONE is refused (И6), the journal is byte for byte the same", (t) => {
  const home = makeHome(t);
  const p = planned(t, home, makeClock(), [
    planTask("t-0001", "developer", { critical: true }),
    planTask("t-0002", "designer", { depends_on: ["t-0001"] }),
  ]);
  const w = p.writer;
  rejectCritical(w, "t-0001");
  w.append(
    eng(
      "TASK_FAILED",
      {
        reason: "dependency_closed",
        detail: "Задача зависит от отклонённой",
      },
      "t-0002",
    ),
  );
  goalPassed(w);
  const before = fileHash(p.events);
  const err = assertAppendRefused(
    w,
    p.dir,
    eng("PROJECT_DONE"),
    "E_TRANSITION",
    "И6",
  );
  assert.match(err.message, /И6/);
  assert.equal(fileHash(p.events), before);
  assert.equal(w.broken, false, "a refusal does not break the writer");
});

test("TM-69 C1, И25: dependency_closed only from waiting and only with a closed dependency", (t) => {
  const home = makeHome(t);
  const p = planned(t, home, makeClock(), [
    planTask("t-0001", "developer", { critical: true }),
    planTask("t-0002", "designer"),
    planTask("t-0003", "designer", { depends_on: ["t-0002"] }),
    planTask("t-0004", "designer", { depends_on: ["t-0001"] }),
  ]);
  const w = p.writer;
  const closed = (id) =>
    eng(
      "TASK_FAILED",
      { reason: "dependency_closed", detail: "Задача зависит от отклонённой" },
      id,
    );
  // no closed dependency (t-0002 waits; t-0002 itself has no dependency)
  assertAppendRefused(w, p.dir, closed("t-0003"), "E_TRANSITION", "И25");
  assertAppendRefused(w, p.dir, closed("t-0002"), "E_TRANSITION", "И25");
  rejectCritical(w, "t-0001");
  // a closed dependency, but the task is not waiting
  w.append(eng("TASK_STARTED", {}, "t-0002"));
  assertAppendRefused(w, p.dir, closed("t-0002"), "E_TRANSITION", "И25");
  // waiting with a closed dependency: accepted, the task is closed
  w.append(closed("t-0004"));
  const t4 = w.state.tasks.find((x) => x.id === "t-0004");
  assert.equal(t4.status, "failed");
  assert.equal(t4.reason, "dependency_closed");
});

test("TM-69 C1: the phrase of dependency_closed and its constant detail", (t) => {
  const home = makeHome(t);
  const p = planned(t, home, makeClock(), [
    planTask("t-0001", "developer", { critical: true }),
    planTask("t-0002", "designer", { depends_on: ["t-0001"] }),
  ]);
  rejectCritical(p.writer, "t-0001");
  p.writer.append(
    eng(
      "TASK_FAILED",
      { reason: "dependency_closed", detail: "Задача зависит от отклонённой" },
      "t-0002",
    ),
  );
  const events = journalOf(p.events);
  const phrases = phrasesForJournal(events);
  assert.equal(
    phrases[phrases.length - 1],
    "Дизайнер: задача не нужна — она зависела от отклонённой",
  );
});

// ---- TM-70 (C2) ----------------------------------------------------------------------

function reviewing(t, home) {
  const p = planned(t, home, makeClock(), [planTask("t-0001", "developer")]);
  workTask(p.writer, "t-0001");
  p.writer.append(eng("TASK_REVIEW", {}, "t-0001"));
  return p;
}

const reassign = (w, role, task = "t-0001") =>
  eng(
    "RUN_STARTED",
    {
      run_id: w.nextRunId(),
      purpose: "reassign",
      role,
      executor: w.state.executor,
      max_budget_usd: null,
    },
    task,
  );

test("TM-70 C2: RUN_STARTED reassign for a task on review, by the project manager, in a running project — accepted, with its phrase", (t) => {
  const home = makeHome(t);
  const p = reviewing(t, home);
  const w = p.writer;
  const ev = w.append(reassign(w, "project_manager"));
  assert.equal(ev.data.purpose, "reassign");
  assert.equal(w.state.runs.open[ev.data.run_id].purpose, "reassign");
  endRun(w, ev.data.run_id, "t-0001");
  w.append(
    eng(
      "TASK_REASSIGNED",
      { from_role: "developer", to_role: "designer", reason: "Нужен дизайнер" },
      "t-0001",
    ),
  );
  const phrases = phrasesForJournal(journalOf(p.events));
  assert.ok(
    phrases.includes("Руководитель проекта подбирает другого специалиста"),
  );
});

test("TM-70 C2: reassign with another role, a task not on review, a project not running or without a task — refused, the journal is byte for byte the same", (t) => {
  const home = makeHome(t);
  const p = reviewing(t, home);
  const w = p.writer;
  const before = fileHash(p.events);
  assertAppendRefused(w, p.dir, reassign(w, "reviewer"), "E_TRANSITION", "И16");
  assertAppendRefused(
    w,
    p.dir,
    reassign(w, "project_manager", null),
    "E_EVENT",
  );
  assert.equal(fileHash(p.events), before);

  // the project is paused: refused
  w.append(usr("PROJECT_PAUSED"));
  const paused = fileHash(p.events);
  assertAppendRefused(
    w,
    p.dir,
    reassign(w, "project_manager"),
    "E_TRANSITION",
    "И16",
  );
  assert.equal(fileHash(p.events), paused);

  // a task that is not on review: refused
  const q = planned(t, home, makeClock(), [planTask("t-0001", "developer")]);
  assertAppendRefused(
    q.writer,
    q.dir,
    reassign(q.writer, "project_manager"),
    "E_TRANSITION",
    "И16",
  );
});

// ---- TM-71 (C4) ----------------------------------------------------------------------

test("TM-71 C4: the lock of the engine names its holder; lockHolder returns it; the lock without holder is as before", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const engine = openWriter(id, { home, now: clock, holder: "engine" });
  try {
    const lock = lockOf(dir);
    assert.deepStrictEqual(Object.keys(lock), ["pid", "since", "holder"]);
    assert.equal(lock.holder, "engine");
    assert.equal(lock.pid, process.pid);
    assert.deepStrictEqual(lockHolder(dir), {
      pid: process.pid,
      alive: true,
      holder: "engine",
    });
  } finally {
    engine.close();
  }
  const plain = openWriter(id, { home, now: clock });
  try {
    assert.deepStrictEqual(Object.keys(lockOf(dir)), ["pid", "since"]);
    assert.equal(lockHolder(dir).holder, null);
  } finally {
    plain.close();
  }
  assert.equal(lockHolder(dir), null);
});

test("TM-71 C4: a holder other than the engine is refused before any file is touched; a foreign holder value reads as null", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const before = fs.readdirSync(dir).sort();
  assert.throws(
    () => openWriter(id, { home, now: clock, holder: "server" }),
    (err) => err.code === "E_INTERNAL",
  );
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), before);
  fs.writeFileSync(
    path.join(dir, "writer.lock"),
    `${JSON.stringify({ pid: process.pid, since: "x", holder: "Engine" })}\n`,
    { mode: 0o600 },
  );
  assert.equal(lockHolder(dir).holder, null);
  fs.unlinkSync(path.join(dir, "writer.lock"));
});

test("TM-71 C4: a stale lock of the engine is removed as any other (LOCK_STALE_REMOVED)", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const dir = path.join(home, id);
  const pid = crashWriter(home, id, "w.say('до аварии');");
  const lock = lockOf(dir);
  fs.writeFileSync(
    path.join(dir, "writer.lock"),
    `${JSON.stringify({ ...lock, holder: "engine" })}\n`,
    { mode: 0o600 },
  );
  assert.deepStrictEqual(lockHolder(dir), {
    pid,
    alive: false,
    holder: "engine",
  });
  const w = openWriter(id, {
    home,
    now: makeClock(Date.now(), 1),
    holder: "engine",
  });
  t.after(() => w.close());
  const events = journalOf(path.join(dir, "events.jsonl"));
  const stale = events.filter((e) => e.type === "LOCK_STALE_REMOVED");
  assert.equal(stale.length, 1);
  assert.deepStrictEqual(stale[0].data, { pid });
  assert.equal(lockOf(dir).holder, "engine");
  assert.equal(lockOf(dir).pid, process.pid);
});

// ---- TM-72 (C6, C7) ------------------------------------------------------------------

const chatMsg = (text, msg, nonce) =>
  usr("CHAT", { text, kind: "message", truncated: false, msg, nonce });

test("TM-72 C6: an event with msg and nonce is accepted and replayed; msgs and nonces are kept in the order of the journal", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  w.append(chatMsg("Привет", MSG_1, NONCE_A));
  w.append(usr("PROJECT_STARTED", { parallel: 2 }));
  w.append(usr("PROJECT_PAUSED", { msg: MSG_2, nonce: NONCE_B }));
  assert.deepStrictEqual(w.state.msgs, [MSG_1, MSG_2]);
  assert.deepStrictEqual(w.state.nonces, [NONCE_A, NONCE_B]);
  const events = journalOf(p.events);
  assert.deepStrictEqual(events[1].data, {
    text: "Привет",
    kind: "message",
    truncated: false,
    msg: MSG_1,
    nonce: NONCE_A,
  });
  assert.deepStrictEqual(replay(events), w.state);
  const read = readProject(p.id, { home }).state;
  assert.deepStrictEqual(read.msgs, [MSG_1, MSG_2]);
});

test("TM-72 И24: a second event with the same msg or the same nonce is refused before the write; the writer stays usable", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  w.append(chatMsg("Первое", MSG_1, NONCE_A));
  const before = fileHash(p.events);
  assertAppendRefused(
    w,
    p.dir,
    chatMsg("Второе", MSG_1, NONCE_B),
    "E_TRANSITION",
    "И24",
  );
  assertAppendRefused(
    w,
    p.dir,
    chatMsg("Второе", MSG_2, NONCE_A),
    "E_TRANSITION",
    "И24",
  );
  assertAppendRefused(
    w,
    p.dir,
    usr("PROJECT_STOPPED", { msg: MSG_1, nonce: NONCE_B }),
    "E_TRANSITION",
    "И24",
  );
  assert.equal(fileHash(p.events), before);
  assert.equal(w.broken, false);
  w.append(chatMsg("Второе", MSG_2, NONCE_B));
  assert.equal(w.state.chat.length, 2);
});

test("TM-72 C6: msg without nonce, nonce without msg, a bad pattern, msg on an event of the engine — E_EVENT", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  const bad = [
    usr("CHAT", { text: "x", kind: "message", truncated: false, msg: MSG_1 }),
    usr("CHAT", {
      text: "x",
      kind: "message",
      truncated: false,
      nonce: NONCE_A,
    }),
    chatMsg("x", "m-1.json", NONCE_A),
    chatMsg("x", "../m-000000000001.json", NONCE_A),
    chatMsg("x", MSG_1, "0123456789ABCDEF"),
    chatMsg("x", MSG_1, "0123"),
    eng("CHAT", {
      text: "x",
      kind: "message",
      truncated: false,
      msg: MSG_1,
      nonce: NONCE_A,
    }),
    eng("PROJECT_RESUMED", {
      parallel: null,
      after: "decision",
      msg: MSG_1,
      nonce: NONCE_A,
    }),
    usr("PROJECT_STARTED", { parallel: 1, msg: MSG_1, nonce: NONCE_A }),
  ];
  for (const input of bad) assertAppendRefused(w, p.dir, input, "E_EVENT");
});

test("TM-72 C7: dropped on a CHAT of the user, empty, longer than 100 or with a repeat — E_EVENT; a nonce already in nonces — E_TRANSITION", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  const many = Array.from({ length: 101 }, (_, i) =>
    i.toString(16).padStart(16, "0"),
  );
  const engineChat = (dropped) =>
    eng("CHAT", { text: "Уборка", kind: "message", truncated: false, dropped });
  assertAppendRefused(
    w,
    p.dir,
    usr("CHAT", {
      text: "x",
      kind: "message",
      truncated: false,
      dropped: [NONCE_A],
    }),
    "E_EVENT",
  );
  assertAppendRefused(w, p.dir, engineChat([]), "E_EVENT");
  assertAppendRefused(w, p.dir, engineChat(many), "E_EVENT");
  assertAppendRefused(w, p.dir, engineChat([NONCE_A, NONCE_A]), "E_EVENT");
  assertAppendRefused(w, p.dir, engineChat(["not-a-nonce"]), "E_EVENT");
  w.append(chatMsg("Первое", MSG_1, NONCE_A));
  assertAppendRefused(
    w,
    p.dir,
    engineChat([NONCE_B, NONCE_A]),
    "E_TRANSITION",
    "И24",
  );
  w.append(engineChat([NONCE_B]));
  assert.deepStrictEqual(w.state.nonces, [NONCE_A, NONCE_B]);
  assertAppendRefused(
    w,
    p.dir,
    chatMsg("Опоздавший", MSG_2, NONCE_B),
    "E_TRANSITION",
    "И24",
  );
});

const ids250 = Array.from({ length: 250 }, (_, i) =>
  (0x1000 + i).toString(16).padStart(16, "0"),
);
const partText = (k, i, m) =>
  `Сообщения, полученные до готовности проекта, не выполнены: ${k}${m > 1 ? ` (часть ${i} из ${m})` : ""}`;

test("TM-72 C7: recordDropped with 250 identifiers writes 3 events (100, 100, 50) as one batch", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  const shuffled = [...ids250].reverse();
  const events = w.recordDropped(shuffled, partText);
  assert.deepStrictEqual(
    events.map((e) => e.data.dropped.length),
    [100, 100, 50],
  );
  assert.deepStrictEqual(
    events.flatMap((e) => e.data.dropped),
    [...ids250].sort(),
    "ascending, each once",
  );
  assert.deepStrictEqual(
    events.map((e) => e.data.text),
    [
      "Сообщения, полученные до готовности проекта, не выполнены: 100 (часть 1 из 3)",
      "Сообщения, полученные до готовности проекта, не выполнены: 100 (часть 2 из 3)",
      "Сообщения, полученные до готовности проекта, не выполнены: 50 (часть 3 из 3)",
    ],
  );
  for (const e of events) {
    assert.equal(e.source, "ENGINE");
    assert.equal(e.type, "CHAT");
    assert.equal(e.data.kind, "message");
  }
  assert.equal(w.state.nonces.length, 250);
  assert.deepStrictEqual(w.recordDropped([], partText), []);
  assert.deepStrictEqual(replay(journalOf(p.events)), w.state);
});

test("TM-72 C7: a failed fsync of the batch writes none of the parts; the writer is broken", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  const w = p.writer;
  const before = fileHash(p.events);
  const fault = installFaults([
    { fn: "fsyncSync", paths: [p.events], effect: "throw", code: "EIO" },
  ]);
  let caught = null;
  try {
    w.recordDropped(ids250, partText);
  } catch (err) {
    caught = err;
  } finally {
    fault.restore();
  }
  assert.equal(caught?.code, "E_DISK");
  assert.equal(fileHash(p.events), before, "no part was written");
  assert.equal(w.broken, true);
  assert.deepStrictEqual(
    journalOf(p.events).filter((e) => e.data.dropped !== undefined),
    [],
  );
});

test("TM-72 a journal without the new fields replays into the state of before r13 plus empty msgs and nonces", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock());
  buildDone(p.writer);
  const state = replay(journalOf(p.events));
  assert.deepStrictEqual(state.msgs, []);
  assert.deepStrictEqual(state.nonces, []);
  assert.deepStrictEqual(state, p.writer.state);
});

test("TM-38 (r13): the phrases of dependency_closed, reassign and of events with msg; scripted gets its suffix", (t) => {
  const home = makeHome(t);
  const p = startProject(t, home, makeClock(), { executor: "scripted" });
  // a scripted project without a scenario file is enough for writing events
  const w = p.writer;
  w.append(chatMsg("Вопрос", MSG_1, NONCE_A));
  withPlan(w, [
    planTask("t-0001", "developer"),
    planTask("t-0002", "designer", { depends_on: ["t-0001"] }),
  ]);
  workTask(w, "t-0001");
  w.append(eng("TASK_REVIEW", {}, "t-0001"));
  const run = w.append(reassign(w, "project_manager")).data.run_id;
  endRun(w, run, "t-0001");
  w.append(usr("PROJECT_PAUSED", { msg: MSG_2, nonce: NONCE_B }));
  const phrases = phrasesForJournal(journalOf(p.events));
  assert.ok(phrases.includes("Новое сообщение от вас"));
  assert.ok(
    phrases.includes(
      "Руководитель проекта подбирает другого специалиста — тестовый исполнитель",
    ),
  );
  assert.equal(phrases[phrases.length - 1], "Проект на паузе");
});

// openTracked is used by the helpers of the plan; keep the import honest.
test("TM-72 a writer opened for the engine and a plain one write the same events", (t) => {
  const home = makeHome(t);
  const clock = makeClock();
  const { id } = newProject(home, clock);
  const w = openTracked(t, home, id, clock, { holder: "engine" });
  w.append(chatMsg("Через канал", MSG_1, NONCE_A));
  assert.equal(w.state.chat[0].text, "Через канал");
});
