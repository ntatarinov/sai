// REQ-011, criterion 4 (design REQ-011, sections 5.5, 7.1-7.3; decisions/0025, W4,
// W8): the six questions of the page of a project on fixture journals made through
// the API of the core. Every expected value is computed by the test from the
// journal (replay, the phrases of the module «язык»), never taken from the code of
// the server (WEB-4a…WEB-4g, properties of the rule of the due time and of the
// busy roles).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { phrasesForJournal } from "../src/team/language.js";
import { replay } from "../src/team/reducer.js";
import { ROLES, publicRole } from "../src/team/roles.js";
import { PROJECT_STATUS_TEXT, TASK_STATUS_TEXT } from "../src/team/schema.js";
import { projectView } from "../src/team/view.js";
import { busyRoles, dueText, projectPage } from "../src/web/display.js";
import { journal, snapshot } from "./exec-helpers.js";
import { engineProject, runToEnd } from "./team-engine-helpers.js";
import {
  MIN,
  T0,
  ask,
  clockAt,
  doneIn,
  endRun,
  eng,
  fail,
  planTask,
  project,
  readOf,
  startRun,
  startServer,
  toReview,
  usr,
  webSandbox,
  withPlan,
  work,
} from "./team-web-helpers.js";

const titleOf = (code) => publicRole(ROLES.find((r) => r.code === code)).title;
const noOf = (code) => ROLES.findIndex((r) => r.code === code) + 1;

async function page(s, p) {
  const r = await s.get(`/api/projects/${p.id}`);
  assert.equal(r.status, 200, r.text);
  return r.json;
}

// ---- (1) what is going on --------------------------------------------------------------

test("WEB-4a (1) the last 5 phrases of the module «язык» in the order of the journal, each with the time of its event; fewer events — fewer phrases", async (t) => {
  const box = webSandbox(t);
  const c = clockAt();
  const p = project(t, box, {}, { clock: c });
  const s = await startServer(t, box);
  const few = await page(s, p);
  const ev0 = journal(p);
  assert.deepStrictEqual(
    few.happening,
    ev0.map((e, i) => ({ at: e.ts, text: phrasesForJournal(ev0)[i] })),
  );
  withPlan(p.w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  work(p.w, "t-0001");
  p.w.say("Вымышленное сообщение владельца");
  toReview(p.w, "t-0001");
  const events = journal(p);
  assert.ok(events.length > 5);
  const phrases = phrasesForJournal(events);
  const got = await page(s, p);
  assert.equal(got.happening.length, 5);
  assert.deepStrictEqual(
    got.happening,
    events.slice(-5).map((e, i) => ({
      at: e.ts,
      text: phrases[events.length - 5 + i],
    })),
  );
  assert.equal(got.happening.at(-1).at, events.at(-1).ts, "the last is last");
});

// ---- (2) who is busy --------------------------------------------------------------------

test("WEB-4b (2) only the roles of tasks running or on review, without repeats, by the number of their first such task; every status of a task is in the fixture", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  const w = p.w;
  withPlan(w, [
    planTask("t-0001", "lawyer"),
    planTask("t-0002", "marketer"),
    planTask("t-0003", "researcher"),
    planTask("t-0004", "marketer"),
    planTask("t-0005", "developer"),
    planTask("t-0006", "designer"),
    planTask("t-0007", "support"),
    planTask("t-0008", "business_analyst"),
  ]);
  doneIn(w, p.clock, "t-0001", T0 + MIN, MIN); // done
  w.append(eng("TASK_STARTED", {}, "t-0003")); // running
  work(w, "t-0002"); // running → review below
  toReview(w, "t-0002");
  work(w, "t-0004"); // running, marketer again
  fail(w, "t-0005"); // failed
  work(w, "t-0006");
  w.append(eng("TASK_INTERRUPTED", { cause: "stop" }, "t-0006"));
  work(w, "t-0007");
  toReview(w, "t-0007");
  w.append(
    eng(
      "TASK_WAITING_USER",
      { reason: "review_failed", draft: null },
      "t-0007",
    ),
  );
  // t-0008 stays waiting
  const state = replay(journal(p));
  assert.deepStrictEqual(
    [...new Set(state.tasks.map((x) => x.status))].sort(),
    [...Object.keys(TASK_STATUS_TEXT)].sort(),
    "every status of a task",
  );
  const expected = [];
  for (const task of [...state.tasks].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!["running", "review"].includes(task.status)) continue;
    if (expected.some((r) => r.code === task.role)) continue;
    expected.push({ code: task.role });
  }
  const s = await startServer(t, box);
  const got = await page(s, p);
  assert.deepStrictEqual(
    got.busy,
    expected.map(({ code }) => ({
      n: noOf(code),
      title: titleOf(code),
      link: { to: "role", api: `/api/projects/${p.id}/roles/${noOf(code)}` },
    })),
  );
  assert.deepStrictEqual(
    got.busy.map((r) => r.title),
    [titleOf("marketer"), titleOf("researcher")],
  );
  // (3) the statuses of every task in words, the reason only where it belongs
  const events = journal(p);
  const phrases = phrasesForJournal(events);
  const lastPhrase = (type, id) => {
    let at = -1;
    events.forEach((e, i) => {
      if (e.type === type && e.task === id) at = i;
    });
    return at === -1 ? null : phrases[at];
  };
  const REASON = {
    failed: "TASK_FAILED",
    waiting_user: "TASK_WAITING_USER",
    interrupted: "TASK_INTERRUPTED",
  };
  assert.equal(got.tasks.length, 8);
  for (const brief of got.tasks) {
    const task = state.tasks.find((x) => x.id === brief.id);
    assert.equal(brief.status, task.status);
    assert.equal(brief.status_text, TASK_STATUS_TEXT[task.status]);
    assert.equal(brief.text, task.text);
    assert.equal(
      brief.reason_text,
      REASON[task.status] === undefined
        ? null
        : lastPhrase(REASON[task.status], task.id),
      brief.id,
    );
    assert.deepStrictEqual(brief.role, {
      n: noOf(task.role),
      title: titleOf(task.role),
      link: {
        to: "role",
        api: `/api/projects/${p.id}/roles/${noOf(task.role)}`,
      },
    });
    assert.deepStrictEqual(brief.link, {
      to: "task",
      api: `/api/projects/${p.id}/tasks/${task.id}`,
    });
  }
  assert.deepStrictEqual(
    got.tasks.map((x) => x.id),
    state.tasks.map((x) => x.id).sort(),
  );
  assert.equal(got.tasks_empty_text, null);
});

// ---- (3) the due time -------------------------------------------------------------------

// The rule of the requirement computed by the test from the journal: the median of
// the durations of done tasks (TASK_STARTED first → TASK_DONE), × ⌈u/p⌉.
function expectedDue(events) {
  const state = replay(events);
  if (["stopped", "done", "failed"].includes(state.status)) {
    return PROJECT_STATUS_TEXT[state.status];
  }
  const durations = [];
  for (const task of state.tasks.filter((x) => x.status === "done")) {
    const start = events.find(
      (e) => e.type === "TASK_STARTED" && e.task === task.id,
    );
    const end = events.findLast(
      (e) => e.type === "TASK_DONE" && e.task === task.id,
    );
    if (start && end) durations.push(Date.parse(end.ts) - Date.parse(start.ts));
  }
  if (durations.length < 2) return "срок пока не оценить";
  durations.sort((a, b) => a - b);
  const h = durations.length / 2;
  const m =
    durations.length % 2 === 1
      ? durations[Math.floor(h)]
      : (durations[h - 1] + durations[h]) / 2;
  const u = state.tasks.filter((x) =>
    ["waiting", "running", "review", "interrupted", "waiting_user"].includes(
      x.status,
    ),
  ).length;
  const k = Math.ceil(u / state.parallel);
  if (m * k <= 0) return "срок пока не оценить";
  return `примерно через ${Math.ceil((m * k) / MIN)} мин`;
}

function dueProject(t, box, durations, unfinished, parallel) {
  const c = clockAt(T0);
  const p = project(t, box, {}, { clock: c });
  const n = durations.length + unfinished;
  const tasks = [];
  for (let i = 1; i <= n; i += 1) {
    tasks.push(planTask(`t-${String(i).padStart(4, "0")}`, "researcher"));
  }
  withPlan(p.w, tasks, parallel);
  let at = T0 + MIN;
  durations.forEach((d, i) => {
    doneIn(p.w, c, `t-${String(i + 1).padStart(4, "0")}`, at, d);
    at += d + MIN;
  });
  return p;
}

test("WEB-4c (3) the example of the requirement: done in 2, 4 and 9 minutes, five unfinished, parallel 2 — «примерно через 12 мин» (median 4 × 3)", async (t) => {
  const box = webSandbox(t);
  const p = dueProject(t, box, [2 * MIN, 4 * MIN, 9 * MIN], 5, 2);
  const s = await startServer(t, box);
  const got = await page(s, p);
  assert.equal(got.due_text, expectedDue(journal(p)));
  assert.equal(got.due_text, "примерно через 12 мин");
});

test("WEB-4c (3) one done task — «срок пока не оценить»; none — the same; an even number of durations — the mean of the two middle ones; rounding up to the minute; all done (u = 0) — «срок пока не оценить»", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  const cases = [
    [[3 * MIN], 4, 2, "срок пока не оценить"],
    [[], 4, 2, "срок пока не оценить"],
    [[2 * MIN, 4 * MIN, 6 * MIN, 10 * MIN], 1, 1, "примерно через 5 мин"],
    [[MIN + 1, MIN + 1], 1, 1, "примерно через 2 мин"],
    [[2 * MIN, 4 * MIN], 0, 2, "срок пока не оценить"],
    [[5 * MIN, 5 * MIN, 5 * MIN], 3, 3, "примерно через 5 мин"],
    [[MIN, 3 * MIN], 7, 3, "примерно через 6 мин"],
  ];
  for (const [durations, u, par, text] of cases) {
    const p = dueProject(t, box, durations, u, par);
    const got = await page(s, p);
    assert.equal(
      got.due_text,
      expectedDue(journal(p)),
      JSON.stringify(durations),
    );
    assert.equal(got.due_text, text, JSON.stringify([durations, u, par]));
  }
});

test("WEB-4c (3, r3 F5) the median below zero (the clock went back between the start and the end of two tasks) — «срок пока не оценить», never «примерно через −N мин» or «0 мин»", async (t) => {
  const box = webSandbox(t);
  const c = clockAt(T0);
  const p = project(t, box, {}, { clock: c });
  const w = p.w;
  withPlan(w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "researcher"),
    planTask("t-0003", "researcher"),
  ]);
  // A USER event may be up to 2 s earlier than the last one; the ENGINE events
  // after it may not be earlier than it — so TASK_DONE comes 1.5 s before its
  // TASK_STARTED.
  const backwards = (id, at) => {
    c.set(at);
    w.append(eng("TASK_STARTED", {}, id));
    const run = startRun(w, "work", "researcher", id);
    endRun(w, run, id);
    toReview(w, id);
    const review = startRun(w, "review", "reviewer", id);
    endRun(w, review, id);
    w.append(
      eng(
        "REVIEW_RESULT",
        { run_id: review, passed: true, notes: "Хорошо" },
        id,
      ),
    );
    c.set(at - 1500);
    w.say("Часы компьютера переведены назад");
    w.append(
      eng("TASK_DONE", { via: "review", external_action_done: false }, id),
    );
  };
  backwards("t-0001", T0 + 10 * MIN);
  backwards("t-0002", T0 + 20 * MIN);
  const events = journal(p);
  const d = ["t-0001", "t-0002"].map(
    (id) =>
      Date.parse(
        events.findLast((e) => e.type === "TASK_DONE" && e.task === id).ts,
      ) -
      Date.parse(
        events.find((e) => e.type === "TASK_STARTED" && e.task === id).ts,
      ),
  );
  assert.deepStrictEqual(
    d,
    [-1500, -1500],
    "the fixture has negative durations",
  );
  const s = await startServer(t, box);
  const got = await page(s, p);
  assert.equal(got.due_text, "срок пока не оценить");
  assert.equal(got.due_text, expectedDue(events));
  assert.doesNotMatch(got.due_text, /−|-|0 мин/);
});

test("WEB-4c (3) a project in a final status shows its status instead of a due time", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  // done: all tasks done, the goal check passed
  const c = clockAt(T0);
  const done = project(t, box, {}, { clock: c });
  withPlan(done.w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  doneIn(done.w, c, "t-0001", T0 + MIN, 2 * MIN);
  doneIn(done.w, c, "t-0002", T0 + 5 * MIN, 3 * MIN);
  const g = startRun(done.w, "goal_check", "reviewer");
  done.w.append(eng("GOAL_CHECK_STARTED", { round: 0, run_id: g }));
  done.w.append(
    eng("GOAL_CHECK_RESULT", {
      round: 0,
      run_id: g,
      passed: true,
      notes: "Есть",
    }),
  );
  endRun(done.w, g);
  done.w.append(eng("PROJECT_DONE"));
  // stopped and failed
  const stopped = project(t, box);
  withPlan(stopped.w, [planTask("t-0001", "researcher")]);
  stopped.w.append(usr("PROJECT_STOPPED"));
  const failed = project(t, box);
  failed.w.append(usr("PROJECT_STARTED", { parallel: 1 }));
  failed.w.append(
    eng("PROJECT_FAILED", { reason: "unrecoverable", detail: "Нет доступа" }),
  );
  for (const [p, status] of [
    [done, "done"],
    [stopped, "stopped"],
    [failed, "failed"],
  ]) {
    const got = await page(s, p);
    assert.equal(got.status, status);
    assert.equal(got.due_text, PROJECT_STATUS_TEXT[status]);
    assert.equal(got.due_text, expectedDue(journal(p)));
  }
});

// A seeded generator (no randomness without a seed).
function lcg(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

test("WEB-4c property: on 500 generated states dueText equals the rule of the requirement computed independently (median, ⌈u/p⌉, rounding up, edges ≤ 0 and fewer than 2)", () => {
  const rnd = lcg(20261010);
  const statuses = Object.keys(TASK_STATUS_TEXT);
  const pstat = [
    "running",
    "waiting_user",
    "paused",
    "planning",
    "done",
    "stopped",
    "failed",
  ];
  for (let n = 0; n < 500; n += 1) {
    const count = Math.floor(rnd() * 9);
    const tasks = [];
    const events = [];
    let seq = 0;
    for (let i = 1; i <= count; i += 1) {
      const id = `t-${String(i).padStart(4, "0")}`;
      const status = statuses[Math.floor(rnd() * statuses.length)];
      tasks.push({ id, status, role: "researcher" });
      if (status === "done") {
        const start = T0 + Math.floor(rnd() * 100) * MIN;
        // durations from −2 s to 20 min, some exactly equal
        const d =
          Math.floor(rnd() * 4) === 0 ? 0 : Math.floor(rnd() * 20 * MIN) - 2000;
        events.push({
          seq: ++seq,
          type: "TASK_STARTED",
          task: id,
          ts: new Date(start).toISOString(),
        });
        if (rnd() < 0.3) {
          // a second start (a retry) does not move the first one
          events.push({
            seq: ++seq,
            type: "TASK_STARTED",
            task: id,
            ts: new Date(start + 5000).toISOString(),
          });
        }
        events.push({
          seq: ++seq,
          type: "TASK_DONE",
          task: id,
          ts: new Date(start + d).toISOString(),
        });
      }
    }
    const state = {
      status: pstat[Math.floor(rnd() * pstat.length)],
      tasks,
      parallel: 1 + Math.floor(rnd() * 3),
    };
    const want = expectedDueOf(state, events);
    assert.equal(
      dueText(state, events),
      want,
      JSON.stringify({ state, events }),
    );
  }
});

function expectedDueOf(state, events) {
  if (["stopped", "done", "failed"].includes(state.status)) {
    return PROJECT_STATUS_TEXT[state.status];
  }
  const ds = [];
  for (const x of state.tasks.filter((y) => y.status === "done")) {
    const s = events.find((e) => e.type === "TASK_STARTED" && e.task === x.id);
    const e2 = events.findLast(
      (e) => e.type === "TASK_DONE" && e.task === x.id,
    );
    if (s && e2) ds.push(Date.parse(e2.ts) - Date.parse(s.ts));
  }
  if (ds.length < 2) return "срок пока не оценить";
  ds.sort((a, b) => a - b);
  const m =
    ds.length % 2
      ? ds[(ds.length - 1) / 2]
      : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2;
  const u = state.tasks.filter(
    (x) => !["done", "failed"].includes(x.status),
  ).length;
  const k = Math.ceil(u / state.parallel);
  return m * k <= 0
    ? "срок пока не оценить"
    : `примерно через ${Math.ceil((m * k) / MIN)} мин`;
}

test("WEB-4b property: on 300 generated plans busyRoles is the roles of running and review tasks, first by number, no repeats", () => {
  const rnd = lcg(42);
  const statuses = Object.keys(TASK_STATUS_TEXT);
  for (let n = 0; n < 300; n += 1) {
    const tasks = [];
    const count = Math.floor(rnd() * 12);
    for (let i = 1; i <= count; i += 1) {
      tasks.push({
        id: `t-${String(i).padStart(4, "0")}`,
        status: statuses[Math.floor(rnd() * statuses.length)],
        role: ROLES[Math.floor(rnd() * ROLES.length)].code,
      });
    }
    // shuffled: the order of the state must not matter
    const shuffled = [...tasks].sort(() => (rnd() < 0.5 ? -1 : 1));
    const want = [];
    for (const x of tasks) {
      if (!["running", "review"].includes(x.status)) continue;
      if (!want.includes(x.role)) want.push(x.role);
    }
    const got = busyRoles({ id: "p-20990101-a1b2c3", tasks: shuffled });
    assert.deepStrictEqual(
      got.map((r) => r.n),
      want.map(noOf),
    );
    for (const r of got)
      assert.equal(r.title, publicRole(ROLES[r.n - 1]).title);
  }
});

// ---- (4) problems ------------------------------------------------------------------------

test("WEB-4d (4) the failed tasks by number with the phrase of their last TASK_FAILED, and the reason of the wait in words", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  const w = p.w;
  withPlan(w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
    planTask("t-0003", "marketer"),
  ]);
  fail(w, "t-0003", "Источник данных недоступен");
  fail(w, "t-0001", "Попытки закончились");
  w.append(eng("PROJECT_WAITING", { reason: "task_failed" }, "t-0001"));
  const events = journal(p);
  const phrases = phrasesForJournal(events);
  const state = replay(events);
  const s = await startServer(t, box);
  const got = await page(s, p);
  assert.deepStrictEqual(
    got.problems.failed.map((x) => x.id),
    ["t-0001", "t-0003"],
  );
  for (const f of got.problems.failed) {
    const i = events.findLastIndex(
      (e) => e.type === "TASK_FAILED" && e.task === f.id,
    );
    assert.equal(f.reason_text, phrases[i]);
    assert.equal(f.status_text, TASK_STATUS_TEXT.failed);
  }
  const view = projectView(state, null, events);
  assert.equal(got.problems.waiting_text, view.waiting.reason_text);
  assert.equal(typeof got.problems.waiting_text, "string");
  // no problems — an empty list and null
  const quiet = project(t, box);
  withPlan(quiet.w, [planTask("t-0001", "researcher")]);
  const q = await page(s, quiet);
  assert.deepStrictEqual(q.problems, { failed: [], waiting_text: null });
});

// ---- (5) waits for a decision ------------------------------------------------------------

function waitsOf(got) {
  return {
    count: got.waits.count,
    count_text: got.waits.count_text,
    note_text: got.waits.note_text,
    questions: got.waits.questions,
  };
}

const NOTE =
  "Ответить на вопрос можно будет в окне решений — оно появится позже. Сообщение в чате вопрос не закрывает.";

test("WEB-4e (5) a wait where both the task and the project wait for the user is one question; an answer closes it; no question in the chat — no wait; open in the chat exactly while counted", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  const mk = () => {
    const p = project(t, box);
    withPlan(p.w, [
      planTask("t-0001", "researcher"),
      planTask("t-0002", "lawyer"),
    ]);
    work(p.w, "t-0002");
    toReview(p.w, "t-0002");
    p.w.append(
      eng(
        "TASK_WAITING_USER",
        { reason: "review_failed", draft: null },
        "t-0002",
      ),
    );
    p.w.append(eng("PROJECT_WAITING", { reason: "review_failed" }, "t-0002"));
    return p;
  };
  // no question yet
  const silent = mk();
  const g0 = await page(s, silent);
  assert.equal(replay(journal(silent)).status, "waiting_user");
  assert.deepStrictEqual(waitsOf(g0), {
    count: 0,
    count_text: "Ничего не нужно",
    note_text: null,
    questions: [],
  });
  // asked: one wait, though the task and the project both wait
  const asked = mk();
  const q = ask(asked.w, "Изменить задачу или отклонить её?", "t-0002");
  const g1 = await page(s, asked);
  assert.deepStrictEqual(waitsOf(g1), {
    count: 1,
    count_text: "Вопросов, ждущих ответа: 1",
    note_text: NOTE,
    questions: [
      {
        task: "t-0002",
        chat_n: q.seq,
        link: { to: "task", api: `/api/projects/${asked.id}/tasks/t-0002` },
      },
    ],
  });
  const chat1 = (await s.get(`/api/projects/${asked.id}/chat`)).json;
  const m1 = chat1.messages.find((m) => m.n === q.seq);
  assert.equal(m1.question, true);
  assert.equal(m1.open, true);
  assert.deepStrictEqual(m1.labels_text, ["вопрос", "ждёт ответа"]);
  // answered: the decision closes it in the same answer
  asked.w.append(
    usr("DECISION_RECEIVED", { decision: "change", text: "Иначе" }, "t-0002"),
  );
  const g2 = await page(s, asked);
  assert.equal(g2.waits.count, 0);
  assert.equal(g2.waits.note_text, null);
  const m2 = (await s.get(`/api/projects/${asked.id}/chat`)).json.messages.find(
    (m) => m.n === q.seq,
  );
  assert.equal(m2.open, false);
  assert.deepStrictEqual(m2.labels_text, ["вопрос"]);
});

test("WEB-4e (5) a question of the project (the ceiling) counts only when asked after the last PROJECT_WAITING; two waits are ordered by the number of their question", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  // asked before the wait: an old question does not open the new wait
  const old = project(t, box);
  withPlan(old.w, [planTask("t-0001", "researcher")]);
  ask(old.w, "Старый вопрос о потолке");
  old.w.append(eng("PROJECT_WAITING", { reason: "budget" }));
  const g0 = await page(s, old);
  assert.equal(g0.status, "waiting_user");
  assert.equal(g0.waits.count, 0);
  // asked after the wait
  const p = project(t, box);
  withPlan(p.w, [
    planTask("t-0001", "researcher"),
    planTask("t-0002", "lawyer"),
  ]);
  fail(p.w, "t-0002", "Попытки закончились");
  const qTask = ask(
    p.w,
    "Задача не получилась. Изменить её или отклонить?",
    "t-0002",
  );
  p.w.append(eng("PROJECT_WAITING", { reason: "budget" }));
  const qProject = ask(p.w, "Достигнут потолок расходов");
  const g = await page(s, p);
  assert.deepStrictEqual(g.waits.questions, [
    {
      task: "t-0002",
      chat_n: qTask.seq,
      link: { to: "task", api: `/api/projects/${p.id}/tasks/t-0002` },
    },
    {
      task: null,
      chat_n: qProject.seq,
      link: { to: "chat", api: `/api/projects/${p.id}/chat` },
    },
  ]);
  assert.equal(g.waits.count, 2);
  assert.equal(g.waits.count_text, "Вопросов, ждущих ответа: 2");
  const chat = (await s.get(`/api/projects/${p.id}/chat`)).json.messages;
  const open = chat.filter((m) => m.open).map((m) => m.n);
  assert.deepStrictEqual(open, [qTask.seq, qProject.seq]);
  const oldChat = (await s.get(`/api/projects/${old.id}/chat`)).json.messages;
  assert.deepStrictEqual(
    oldChat.filter((m) => m.open),
    [],
    "the old question is not open",
  );
});

// ---- (6) result ------------------------------------------------------------------------

test("WEB-4f (6, r3 F1) the result is exactly the files with a task, in the order of the state, each with its task, the text of the task and its role; a file without a task never appears; a project with only such files has results []", async (t) => {
  const box = webSandbox(t);
  const p = project(t, box);
  const w = p.w;
  withPlan(w, [planTask("t-0001", "researcher"), planTask("t-0002", "lawyer")]);
  w.writeResultFile({
    task: null,
    name: "r-00001-plan-input.md",
    content: "вход",
  });
  work(w, "t-0001", ["prices.md", "t-0001-1-input.md"]);
  w.writeResultFile({
    task: null,
    name: "r-00006-goal-input.md",
    content: "вход",
  });
  work(w, "t-0002", ["contract.md"]);
  const state = replay(journal(p));
  const withTask = state.files.filter((f) => f.task !== null);
  assert.ok(state.files.length > withTask.length, "the fixture has both kinds");
  const s = await startServer(t, box);
  const got = await page(s, p);
  assert.deepStrictEqual(
    got.results.map((r) => r.name),
    withTask.map((f) => f.name),
  );
  assert.deepStrictEqual(
    new Set(got.results.map((r) => r.name)),
    new Set(state.tasks.flatMap((x) => x.files)),
  );
  for (const r of got.results) {
    const task = state.tasks.find((x) => x.id === r.task);
    assert.ok(task.files.includes(r.name));
    assert.equal(r.task_text, task.text);
    assert.deepStrictEqual(r.role, {
      n: noOf(task.role),
      title: titleOf(task.role),
      link: {
        to: "role",
        api: `/api/projects/${p.id}/roles/${noOf(task.role)}`,
      },
    });
    assert.deepStrictEqual(r.link, {
      to: "task",
      api: `/api/projects/${p.id}/tasks/${task.id}`,
    });
  }
  const text = JSON.stringify(got);
  for (const f of state.files.filter((x) => x.task === null)) {
    assert.ok(!text.includes(f.name), f.name);
  }
  // only files without a task
  const only = project(t, box);
  withPlan(only.w, [planTask("t-0001", "researcher")]);
  only.w.writeResultFile({
    task: null,
    name: "r-00001-plan-input.md",
    content: "вход",
  });
  const g2 = await page(s, only);
  assert.equal(replay(journal(only)).files.length, 1);
  assert.deepStrictEqual(g2.results, []);
  // the page of the task lists the same names
  const tp = (await s.get(`/api/projects/${p.id}/tasks/t-0001`)).json;
  assert.deepStrictEqual(tp.task.files, ["prices.md", "t-0001-1-input.md"]);
});

test("WEB-4f (6) a real run of the scenario engine-basic: the inputs of the runs without a task are not in the result, every file with a task is", async (t) => {
  const scen = JSON.parse(
    fs.readFileSync(
      new URL("./fixtures/team/engine-basic.json", import.meta.url),
    ),
  );
  const p = engineProject(t, scen.runs);
  await runToEnd(p);
  const read = readOf({ home: p.sb.home }, p.id);
  assert.equal(read.state.status, "done");
  const nulls = read.state.files.filter((f) => f.task === null);
  assert.ok(nulls.length >= 1, "engine-basic writes inputs without a task");
  const got = projectPage(read);
  assert.deepStrictEqual(
    got.results.map((r) => r.name),
    read.state.files.filter((f) => f.task !== null).map((f) => f.name),
  );
  for (const f of nulls) {
    assert.ok(!got.results.some((r) => r.name === f.name), f.name);
  }
  assert.ok(got.results.length >= 1);
  assert.equal(got.due_text, PROJECT_STATUS_TEXT.done);
});

// ---- the states of the page -------------------------------------------------------------

test("WEB-4g pause_text after the engine of the server is stopped by a signal; tail_text with an unfinished last line; tasks_empty_text before the plan and without tasks; null otherwise; reading changes nothing", async (t) => {
  const box = webSandbox(t);
  const SLOW = {
    version: 1,
    runs: [
      {
        match: { purpose: "plan" },
        steps: [{ delay_ms: 30_000 }],
        result: { outcome: "failed", cost_usd: 0.01 },
      },
    ],
  };
  const s = await startServer(t, box, { engines: "real", scenario: SLOW });
  const r = await s.post("/api/projects", {
    goal: "Вымышленная",
    budget_usd: 1,
  });
  assert.equal(r.status, 201, r.text);
  const id = r.json.project.id;
  const running = (await s.get(`/api/projects/${id}`)).json;
  assert.equal(running.status, "planning");
  assert.equal(running.pause_text, null);
  assert.equal(
    running.tasks_empty_text,
    "Плана пока нет — команда его составляет",
  );
  assert.equal(await s.engines.stopAll(15_000), true);
  const paused = (await s.get(`/api/projects/${id}`)).json;
  assert.equal(paused.status, "paused");
  assert.equal(
    paused.pause_text,
    "Проект приостановлен, продолжите его командой resume",
  );
  assert.equal(paused.tail_text, null);
  assert.equal(paused.tasks_empty_text, "Задач нет");

  const created = project(t, box);
  created.w.close();
  const c = (await s.get(`/api/projects/${created.id}`)).json;
  assert.equal(c.status, "created");
  assert.equal(c.tasks_empty_text, "Плана пока нет — команда его составляет");
  assert.equal(c.pause_text, null);
  // an unfinished last line (a crash in the middle of a write)
  fs.appendFileSync(created.events, '{"seq":2,"ty');
  const before = snapshot(box.home);
  const tailed = (await s.get(`/api/projects/${created.id}`)).json;
  assert.equal(
    tailed.tail_text,
    "Последняя запись проекта не дописана — она будет убрана при следующем действии",
  );
  assert.equal(tailed.pause_text, null);
  const listed = (await s.get("/api/projects")).json.projects.find(
    (x) => x.id === created.id,
  );
  assert.equal(listed.broken, false);
  assert.deepStrictEqual(snapshot(box.home), before, "reading cut nothing");
});
