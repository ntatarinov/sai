// REQ-035 — the control of a project against a real engine (design
// docs/design/REQ-035-team-web-control.md r4, section 15): the scripted executor
// (REQ-010), the engine as a separate process (spawnEngine of
// team-engine-helpers.js) or the engine of the server; the server in the process
// of the test or as the command (spawnWeb). Every executor and engine is started
// only after assertSafeEnv: the data folder and HOME are temporary. Waits are by an
// event of the journal (until), never by a pause, except the windows of time a
// criterion sets (5 s after a pause or a stop, 10–12 s without an ack, 2 s after
// SIGCONT). Criteria 2, 3, 4, 7 (the engine stops), 8 (CTL-2…CTL-8c′).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createEngine } from "../src/team/engine/engine.js";
import { readProject } from "../src/team/store.js";
import { createEngines } from "../src/web/engines.js";
import {
  FIXTURES,
  assertSafeEnv,
  fakeStarts,
  journal,
  sha256,
  spawnTeam,
  waitUntil,
  withLimit,
  writePlan,
} from "./exec-helpers.js";
import {
  GOAL_OK,
  PASS,
  WORK_OK,
  engineProject,
  engineReady,
  isQuestion,
  item,
  ok,
  planRun,
  scenarioRun,
  spawnEngine,
  until,
} from "./team-engine-helpers.js";
import {
  request,
  spawnWeb,
  startServer,
  webSandbox,
  within,
  writeHeaders,
} from "./team-web-helpers.js";

const SENT = { result_text: "Отправлено" };
const fail = (text) => ({ error_text: text, field: null, reload: false });
const UNCONFIRMED = fail(
  "Команда не подтверждена, проверьте состояние проекта через несколько секунд",
);
const AFTER_FAILURE = fail(
  "Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше",
);
const ctlPath = (id) => `/api/projects/${id}/control`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LINK = /^Sai Team: http:\/\/127\.0\.0\.1:(\d+)\/\n$/;

const ofType = (events, type) => events.filter((e) => e.type === type);
const pairs = (events) => events.map((e) => [e.type, e.source]);
const workRun = (task) => (e) =>
  e.type === "RUN_STARTED" && e.data.purpose === "work" && e.task === task;
const lockOf = (p) =>
  JSON.parse(fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8"));
const phrases = (page) => page.happening.map((h) => h.text);

// The number of work runs of each task (Ф6).
function workRuns(events) {
  const out = {};
  for (const e of events) {
    if (e.type === "RUN_STARTED" && e.data.purpose === "work") {
      out[e.task] = (out[e.task] ?? 0) + 1;
    }
  }
  return out;
}

function doneOf(events) {
  const out = {};
  for (const e of ofType(events, "TASK_DONE"))
    out[e.task] = (out[e.task] ?? 0) + 1;
  return out;
}

// The hash of a file once it has stayed the same for `polls` polls in a row.
async function stableHash(file, polls = 5, gapMs = 40) {
  let last = sha256(fs.readFileSync(file));
  let same = 0;
  for (let i = 0; i < 250 && same < polls; i++) {
    await sleep(gapMs);
    const now = sha256(fs.readFileSync(file));
    same = now === last ? same + 1 : 0;
    last = now;
  }
  assert.ok(same >= polls, "the journal did not settle");
  return last;
}

// Three independent tasks a, b, c; the work of each takes workMs.
function threeTasks(workMs, reviewMs = 0) {
  return [
    planRun([item("a"), item("b"), item("c")]),
    scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: workMs }]),
    scenarioRun(
      { purpose: "review" },
      PASS,
      reviewMs > 0 ? [{ delay_ms: reviewMs }] : [],
    ),
    scenarioRun({ purpose: "goal_check" }, GOAL_OK),
  ];
}

// The ceiling 0.2 and runs of 0.05 (as EN-40): plan, work, review, work — then
// «ждёт решения» because of the ceiling, with one question.
const BUDGET_RUNS = [
  scenarioRun({ purpose: "plan" }, ok({ tasks: [item("a"), item("b")] })),
  scenarioRun({ purpose: "work" }, WORK_OK),
  scenarioRun({ purpose: "review" }, PASS),
  scenarioRun({ purpose: "goal_check" }, GOAL_OK),
].map((r) => ({ ...r, result: { ...r.result, cost_usd: 0.05 } }));
const isBudgetWait = (e) =>
  e.type === "PROJECT_WAITING" && e.data.reason === "budget";

// The engine of a project as a separate process, ready (holds the lock, inbox/).
async function engineProcess(t, runs, over = {}) {
  const p = engineProject(t, runs, over);
  const box = { sb: p.sb, env: p.env, home: p.sb.home };
  const run = spawnEngine(t, p, ["start", p.id, "--parallel", "1"]);
  const lock = await engineReady(p);
  return { p, box, run, lock };
}

async function killed(run, signal = "SIGKILL") {
  const ended = new Promise((r) => run.child.once("exit", r));
  run.child.kill(signal);
  await ended;
}

// ---- criteria 2 and 3 ---------------------------------------------------------------------

test(
  "CTL-2 and CTL-3a (crit. 2, 3) scripted, three independent tasks of 3 s, parallel 1, the engine a process of the command start: «Пауза» during task 1 → «Отправлено», one PROJECT_PAUSED of USER, the lock the same (holder engine, pid); after the pause no task starts (the count of TASK_STARTED after 5 s equals the count at PROJECT_PAUSED), the run of task 1 comes to its end; after 5 s the answer says «на паузе» with «Продолжить» and «Остановить» and the phrase «Проект на паузе». Then «Продолжить» → one PROJECT_RESUMED of USER, the answer right after says «в работе» and «Работа над проектом продолжается», and the project comes to «выполнен»",
  { timeout: 120_000 },
  async (t) => {
    const { p, box, lock } = await engineProcess(t, threeTasks(3000, 1500));
    assert.equal(lock.holder, "engine");
    const s = await startServer(t, box);
    const key = await s.key();
    await until(p, workRun("t-0001"), "the work of task 1");
    await sleep(300);
    const r = await s.post(ctlPath(p.id), { action: "pause" }, { key });
    assert.equal(r.status, 200, r.text);
    assert.deepStrictEqual(r.json, SENT);
    const paused = ofType(journal(p), "PROJECT_PAUSED");
    assert.deepStrictEqual(pairs(paused), [["PROJECT_PAUSED", "USER"]]);
    assert.deepStrictEqual(lockOf(p), lock, "the lock is the same");
    const pausedSeq = paused[0].seq;
    const startedAtPause = journal(p).filter(
      (e) => e.type === "TASK_STARTED" && e.seq < pausedSeq,
    ).length;
    // the window of criterion 2
    await sleep(5000);
    const events = journal(p);
    assert.equal(
      ofType(events, "TASK_STARTED").length,
      startedAtPause,
      "no task started after the pause",
    );
    const run1 = events.find(workRun("t-0001")).data.run_id;
    const end1 = events.find(
      (e) => e.type === "RUN_FINISHED" && e.data.run_id === run1,
    );
    assert.ok(
      end1 && end1.seq > pausedSeq,
      "the run of task 1 came to its end",
    );
    assert.equal(end1.data.outcome, "ok");
    assert.equal(ofType(events, "PROJECT_PAUSED").length, 1);
    assert.deepStrictEqual(lockOf(p), lock);
    const page = (await s.get(`/api/projects/${p.id}`)).json;
    assert.equal(page.status_text, "на паузе");
    assert.deepStrictEqual(page.controls, {
      pause: false,
      resume: true,
      stop: true,
      api: ctlPath(p.id),
    });
    assert.ok(
      phrases(page).includes("Проект на паузе"),
      phrases(page).join(" | "),
    );

    // CTL-3a: «Продолжить» to the live engine of the process
    const resumed = await s.post(ctlPath(p.id), { action: "resume" }, { key });
    assert.equal(resumed.status, 200, resumed.text);
    assert.deepStrictEqual(resumed.json, SENT);
    const right = (await s.get(`/api/projects/${p.id}`)).json;
    assert.equal(right.status_text, "в работе");
    assert.ok(
      phrases(right).includes("Работа над проектом продолжается"),
      phrases(right).join(" | "),
    );
    await until(p, (e) => e.type === "PROJECT_DONE", "the end", 60_000);
    const all = journal(p);
    const res = ofType(all, "PROJECT_RESUMED");
    assert.deepStrictEqual(pairs(res), [["PROJECT_RESUMED", "USER"]]);
    assert.equal(res[0].data.after, "command");
    assert.deepStrictEqual(workRuns(all), {
      "t-0001": 1,
      "t-0002": 1,
      "t-0003": 1,
    });
    assert.deepStrictEqual(doneOf(all), {
      "t-0001": 1,
      "t-0002": 1,
      "t-0003": 1,
    });
    const end = (await s.get(`/api/projects/${p.id}`)).json;
    assert.equal(end.status_text, "выполнен");
  },
);

// The server as the command on the scripted executor: { run, port, key }.
async function webCommand(t, box, scenarioFile) {
  const run = spawnWeb(
    t,
    ["--port", "0", "--executor", "scripted", "--scenario", scenarioFile],
    box.env,
  );
  const line = await within(run.firstLine, 20_000, "the link");
  const m = LINK.exec(line ?? "");
  assert.ok(m !== null, `the line: ${JSON.stringify(line)} ${run.err()}`);
  const port = Number(m[1]);
  const keyPage = await request(port, { path: "/" });
  const key = /<meta name="sai-page" content="([0-9a-f]{64})"/.exec(
    keyPage.text,
  )[1];
  const post = (pth, body) =>
    request(port, {
      method: "POST",
      path: pth,
      headers: writeHeaders(port, key),
      body: JSON.stringify(body),
    });
  const get = (pth) => request(port, { path: pth });
  return { run, port, key, post, get };
}

function projectFiles(box, id) {
  const dir = path.join(box.home, id);
  return { id, dir, events: path.join(dir, "events.jsonl") };
}

async function stopCommand(web) {
  web.run.child.kill("SIGINT");
  const end = await within(web.run.done, 30_000, "the end of the server");
  assert.equal(end.code, 0, end.stderr);
}

test(
  "CTL-3b (crit. 3, 11) the server as the command on scripted leads a project made through its POST; SIGINT during task 2 — the server ends, the project is paused; a second server on the same SAI_TEAM_HOME says «на паузе» with «Продолжить»; the press → the lock is held by an engine with the pid of the new server, one PROJECT_RESUMED, the project comes to «выполнен»; the runs: done before the pause — 1, not begun at the signal — 1, broken by the signal — at most 2 with one TASK_DONE",
  { timeout: 150_000 },
  async (t) => {
    const box = webSandbox(t);
    const scenario = path.join(box.sb.root, "scenario.json");
    fs.writeFileSync(
      scenario,
      JSON.stringify({
        version: 1,
        runs: [
          planRun([item("a"), item("b"), item("c", { depends_on: ["b"] })]),
          scenarioRun(
            { purpose: "work", task: "t-0002", attempt: 1 },
            WORK_OK,
            [{ delay_ms: 30_000 }],
          ),
          scenarioRun({ purpose: "work", task: "t-0002" }, WORK_OK, [
            { delay_ms: 1500 },
          ]),
          scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 200 }]),
          scenarioRun({ purpose: "review" }, PASS),
          scenarioRun({ purpose: "goal_check" }, GOAL_OK),
        ],
      }),
    );
    const first = await webCommand(t, box, scenario);
    const made = await first.post("/api/projects", {
      goal: "Вымышленная цель с перезапуском",
      budget_usd: 5,
    });
    assert.equal(made.status, 201, made.text);
    const p = projectFiles(box, made.json.project.id);
    await until(
      p,
      (e) => e.type === "TASK_DONE" && e.task === "t-0001",
      "task 1",
    );
    await until(p, workRun("t-0002"), "task 2");
    await stopCommand(first);
    let events = journal(p);
    assert.equal(events.at(-1).type, "PROJECT_PAUSED");
    assert.equal(events.at(-1).source, "USER");
    assert.deepStrictEqual(
      ofType(events, "TASK_INTERRUPTED").map((e) => e.task),
      ["t-0002"],
    );
    assert.equal(
      ofType(events, "TASK_STARTED").filter((e) => e.task === "t-0003").length,
      0,
    );

    const second = await webCommand(t, box, scenario);
    const page = (await second.get(`/api/projects/${p.id}`)).json;
    assert.equal(page.status_text, "на паузе");
    assert.equal(page.controls.resume, true);
    const r = await second.post(ctlPath(p.id), { action: "resume" });
    assert.equal(r.status, 200, r.text);
    assert.deepStrictEqual(r.json, SENT);
    const lock = lockOf(p);
    assert.deepStrictEqual(
      [lock.holder, lock.pid],
      ["engine", second.run.child.pid],
      "the engine of the new server holds the project",
    );
    await until(p, (e) => e.type === "PROJECT_DONE", "the end", 60_000);
    events = journal(p);
    assert.deepStrictEqual(pairs(ofType(events, "PROJECT_RESUMED")), [
      ["PROJECT_RESUMED", "USER"],
    ]);
    const runs = workRuns(events);
    assert.equal(runs["t-0001"], 1, "done before the pause");
    assert.equal(runs["t-0003"], 1, "not begun at the signal");
    assert.ok(runs["t-0002"] <= 2, `broken: ${runs["t-0002"]}`);
    assert.deepStrictEqual(doneOf(events), {
      "t-0001": 1,
      "t-0002": 1,
      "t-0003": 1,
    });
    assert.equal(
      (await second.get(`/api/projects/${p.id}`)).json.status_text,
      "выполнен",
    );
    await stopCommand(second);
  },
);

test(
  "CTL-3d (crit. 3; r2 F3, Ф16) a project «ждёт решения» because of the ceiling, the server (the command) stopped by SIGINT — the project is paused with its wait; after a restart the page shows «на паузе», the text of the pause and «Продолжить»; the press → «Отправлено»; the new events are exactly one PROJECT_RESUMED of USER (after command), PROJECT_WAITING budget and the question about the ceiling; no run, nothing spent; the answer says «ждёт решения пользователя» with «Пауза» and «Остановить»",
  { timeout: 150_000 },
  async (t) => {
    const box = webSandbox(t);
    const scenario = path.join(box.sb.root, "scenario.json");
    fs.writeFileSync(
      scenario,
      JSON.stringify({ version: 1, runs: BUDGET_RUNS }),
    );
    const first = await webCommand(t, box, scenario);
    const made = await first.post("/api/projects", {
      goal: "Вымышленная цель с потолком",
      budget_usd: 0.2,
    });
    assert.equal(made.status, 201, made.text);
    const p = projectFiles(box, made.json.project.id);
    await until(p, isBudgetWait, "the wait of the ceiling");
    await until(p, isQuestion, "the question");
    await stopCommand(first);
    const read = readProject(p.id, { home: box.home });
    assert.equal(read.state.status, "paused");
    assert.deepStrictEqual(read.state.waiting, {
      reason: "budget",
      task: null,
    });
    assert.deepStrictEqual(pairs([journal(p).at(-1)]), [
      ["PROJECT_PAUSED", "USER"],
    ]);
    const spent = read.state.spent_usd;

    const second = await webCommand(t, box, scenario);
    const page = (await second.get(`/api/projects/${p.id}`)).json;
    assert.equal(page.status_text, "на паузе");
    assert.equal(
      page.pause_text,
      "Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше",
    );
    assert.deepStrictEqual(page.controls, {
      pause: false,
      resume: true,
      stop: true,
      api: ctlPath(p.id),
    });
    const lines = journal(p).length;
    const r = await second.post(ctlPath(p.id), { action: "resume" });
    assert.equal(r.status, 200, r.text);
    assert.deepStrictEqual(r.json, SENT);
    await until(
      p,
      (e) => e.seq > lines && isQuestion(e),
      "the question after the resumption",
    );
    await sleep(500);
    const added = journal(p).slice(lines);
    assert.deepStrictEqual(pairs(added), [
      ["PROJECT_RESUMED", "USER"],
      ["PROJECT_WAITING", "ENGINE"],
      ["CHAT", "ENGINE"],
    ]);
    assert.equal(added[0].data.after, "command");
    assert.equal(added[1].data.reason, "budget");
    assert.equal(added[2].data.kind, "question");
    assert.equal(
      added[2].data.text,
      "Достигнут потолок расходов. Поднимите потолок, чтобы продолжить, или остановите проект",
    );
    assert.equal(readProject(p.id, { home: box.home }).state.spent_usd, spent);
    const after = (await second.get(`/api/projects/${p.id}`)).json;
    assert.equal(after.status_text, "ждёт решения пользователя");
    assert.deepStrictEqual(after.controls, {
      pause: true,
      resume: false,
      stop: true,
      api: ctlPath(p.id),
    });
    await stopCommand(second);
  },
);

test(
  "CTL-3d (variant) the same project paused by the button while the engine of the server lives, then «Продолжить» through the channel: the same new events — PROJECT_RESUMED of USER, PROJECT_WAITING budget, the question — and no run",
  { timeout: 120_000 },
  async (t) => {
    const box = webSandbox(t);
    const s = await startServer(t, box, {
      engines: "real",
      scenario: { version: 1, runs: BUDGET_RUNS },
    });
    const key = await s.key();
    const made = await s.post(
      "/api/projects",
      { goal: "Вымышленная цель с потолком", budget_usd: 0.2 },
      { key },
    );
    assert.equal(made.status, 201, made.text);
    const p = projectFiles(box, made.json.project.id);
    await until(p, isQuestion, "the question");
    const pause = await s.post(ctlPath(p.id), { action: "pause" }, { key });
    assert.equal(pause.status, 200, pause.text);
    assert.equal(s.engines.has(p.id), true, "the engine of the server lives");
    const lines = journal(p).length;
    const r = await s.post(ctlPath(p.id), { action: "resume" }, { key });
    assert.equal(r.status, 200, r.text);
    await until(p, (e) => e.seq > lines && isQuestion(e), "the question");
    await sleep(500);
    const added = journal(p).slice(lines);
    assert.deepStrictEqual(pairs(added), [
      ["PROJECT_RESUMED", "USER"],
      ["PROJECT_WAITING", "ENGINE"],
      ["CHAT", "ENGINE"],
    ]);
    assert.ok(added[0].data.msg, "through the channel");
    assert.equal(added[1].data.reason, "budget");
  },
);

// ---- criterion 4 -----------------------------------------------------------------------

test(
  "CTL-4b (crit. 4) scripted with a task in work, the engine a process: the confirmed stop → «Отправлено»; one PROJECT_STOPPED of USER, the run cancelled, the task «прервана»; after 5 s the answer says «остановлен», the phrase «Проект остановлен», no buttons, the text «Проект остановлен. Продолжить его нельзя»; the engine ended",
  { timeout: 90_000 },
  async (t) => {
    const { p, box, run } = await engineProcess(t, threeTasks(30_000));
    const s = await startServer(t, box);
    await until(p, workRun("t-0001"), "the work");
    const r = await s.post(ctlPath(p.id), { action: "stop", confirmed: true });
    assert.equal(r.status, 200, r.text);
    assert.deepStrictEqual(r.json, SENT);
    const end = await within(run.done, 20_000, "the end of the engine");
    assert.equal(end.status, 0, end.stderr);
    await sleep(5000);
    const events = journal(p);
    assert.deepStrictEqual(pairs(ofType(events, "PROJECT_STOPPED")), [
      ["PROJECT_STOPPED", "USER"],
    ]);
    assert.equal(events.at(-1).type, "PROJECT_STOPPED");
    const run1 = events.find(workRun("t-0001")).data.run_id;
    assert.equal(
      events.find((e) => e.type === "RUN_FINISHED" && e.data.run_id === run1)
        .data.outcome,
      "cancelled",
    );
    assert.deepStrictEqual(
      ofType(events, "TASK_INTERRUPTED").map((e) => [e.task, e.data.cause]),
      [["t-0001", "stop"]],
    );
    const page = (await s.get(`/api/projects/${p.id}`)).json;
    assert.equal(page.status_text, "остановлен");
    assert.ok(phrases(page).includes("Проект остановлен"));
    assert.equal(page.stopped_text, "Проект остановлен. Продолжить его нельзя");
    assert.deepStrictEqual(page.controls, {
      pause: false,
      resume: false,
      stop: false,
      api: ctlPath(p.id),
    });
    assert.equal(
      page.tasks.find((x) => x.id === "t-0001").status_text,
      "прервана",
    );
  },
);

// ---- criterion 7: the engine stops ------------------------------------------------------

test(
  "CTL-7b (crit. 7) the engine of the server is stopping (requestStop signal) while its run does not end yet (the fake claude under SIGSTOP): «Пауза» → 409 «Проект сейчас останавливается, повторите через несколько секунд»; the server writes nothing, the command is not taken (only the PROJECT_PAUSED of the signal, without a message of the channel); the next request answers 200",
  { timeout: 90_000 },
  async (t) => {
    const box = webSandbox(t);
    writePlan(box.sb, { default: { stream: "stream-ok.jsonl", hang: true } });
    const made = [];
    const warnings = [];
    const engines = createEngines({
      home: box.home,
      env: box.env,
      warn: (l) => warnings.push(l),
      create: (id, opts) => {
        const e = createEngine(id, opts);
        made.push(e);
        return e;
      },
    });
    const s = await startServer(t, box, { executor: "claude-cli", engines });
    const key = await s.key();
    const created = await s.post(
      "/api/projects",
      { goal: "Вымышленная цель", budget_usd: 1 },
      { key },
    );
    assert.equal(created.status, 201, created.text);
    const p = projectFiles(box, created.json.project.id);
    assert.ok(await waitUntil(() => fakeStarts(box.sb).length === 1, 20_000));
    const fakePid = fakeStarts(box.sb)[0].pid;
    // the run cannot end before the grace of the kill is over (SIGTERM waits)
    process.kill(fakePid, "SIGSTOP");
    t.after(() => {
      try {
        process.kill(fakePid, "SIGCONT");
      } catch {
        // gone
      }
    });
    made[0].requestStop("signal");
    const r = await s.post(ctlPath(p.id), { action: "pause" }, { key });
    assert.equal(r.status, 409, r.text);
    assert.deepStrictEqual(
      r.json,
      fail("Проект сейчас останавливается, повторите через несколько секунд"),
    );
    assert.equal(await engines.stopAll(15_000), true);
    const events = journal(p);
    const paused = ofType(events, "PROJECT_PAUSED");
    assert.equal(paused.length, 1, "only the pause of the signal");
    assert.equal(paused[0].data.msg, undefined, "not the command of the page");
    assert.equal((await s.get("/api/projects")).status, 200);
  },
);

// ---- criterion 8 -----------------------------------------------------------------------

test(
  "CTL-8a (crit. 8 (а)) the engine under SIGSTOP: «Пауза» gets its answer not before 10 and not after 12 s — 504 «Команда не подтверждена…»; the server writes nothing; after SIGCONT and 2 s no PROJECT_PAUSED of this press; the next «Пауза» → «Отправлено»",
  { timeout: 120_000 },
  async (t) => {
    const { p, box, run } = await engineProcess(t, threeTasks(40_000));
    const s = await startServer(t, box);
    const key = await s.key();
    await until(p, workRun("t-0001"), "the work");
    process.kill(run.child.pid, "SIGSTOP");
    t.after(() => {
      try {
        process.kill(run.child.pid, "SIGCONT");
      } catch {
        // gone
      }
    });
    const before = await stableHash(p.events);
    const started = Date.now();
    const r = await s.post(ctlPath(p.id), { action: "pause" }, { key });
    const took = Date.now() - started;
    assert.equal(r.status, 504, r.text);
    assert.deepStrictEqual(r.json, UNCONFIRMED);
    assert.ok(took >= 10_000 && took <= 12_000, `${took} ms`);
    assert.equal(
      sha256(fs.readFileSync(p.events)),
      before,
      "the server wrote nothing",
    );
    process.kill(run.child.pid, "SIGCONT");
    await sleep(2000);
    assert.equal(ofType(journal(p), "PROJECT_PAUSED").length, 0);
    const next = await s.post(ctlPath(p.id), { action: "pause" }, { key });
    assert.equal(next.status, 200, next.text);
    assert.equal(ofType(journal(p), "PROJECT_PAUSED").length, 1);
  },
);

test(
  "CTL-8b (crit. 8 (б)) the ack is lost, the event is written (the engine with the preload fixtures/team/no-ack.js): «Пауза» → 504 «Команда не подтверждена…»; the journal has one PROJECT_PAUSED; the next answer of the project says «на паузе»",
  { timeout: 120_000 },
  async (t) => {
    const p = engineProject(t, threeTasks(40_000));
    const box = { sb: p.sb, env: p.env, home: p.sb.home };
    const env = {
      ...p.env,
      NODE_OPTIONS: `--import ${path.join(FIXTURES, "no-ack.js")}`,
    };
    assertSafeEnv(env);
    const run = spawnTeam(["start", p.id, "--parallel", "1"], env);
    t.after(() => run.child.kill("SIGKILL"));
    await engineReady(p);
    const s = await startServer(t, box);
    await until(p, workRun("t-0001"), "the work");
    const r = await withLimit(
      s.post(ctlPath(p.id), { action: "pause" }),
      20_000,
    );
    assert.equal(r.status, 504, r.text);
    assert.deepStrictEqual(r.json, UNCONFIRMED);
    assert.deepStrictEqual(pairs(ofType(journal(p), "PROJECT_PAUSED")), [
      ["PROJECT_PAUSED", "USER"],
    ]);
    const page = (await s.get(`/api/projects/${p.id}`)).json;
    assert.equal(page.status_text, "на паузе");
    assert.equal(page.controls.resume, true);
  },
);

test(
  "CTL-8c (crit. 8 (в); Ф14) the engine of a project «ждёт решения» (nothing to break: no open run, no task in work) is killed by SIGKILL: «Пауза» → «Отправлено», the new events are exactly LOCK_STALE_REMOVED (ENGINE, the pid of the dead engine) and one PROJECT_PAUSED (USER); the answer says «на паузе»",
  { timeout: 90_000 },
  async (t) => {
    const { p, box, run, lock } = await engineProcess(t, BUDGET_RUNS, {
      budget: 0.2,
    });
    const s = await startServer(t, box);
    await until(p, isBudgetWait, "the wait of the ceiling");
    await until(p, isQuestion, "the question");
    await killed(run);
    const lines = journal(p).length;
    const r = await s.post(ctlPath(p.id), { action: "pause" });
    assert.equal(r.status, 200, r.text);
    assert.deepStrictEqual(r.json, SENT);
    const added = journal(p).slice(lines);
    assert.deepStrictEqual(pairs(added), [
      ["LOCK_STALE_REMOVED", "ENGINE"],
      ["PROJECT_PAUSED", "USER"],
    ]);
    assert.equal(added[0].data.pid, lock.pid);
    const page = (await s.get(`/api/projects/${p.id}`)).json;
    assert.equal(page.status_text, "на паузе");
  },
);

test(
  "CTL-8c′ (crit. 8; Ф14, case B) the engine is killed by SIGKILL during a task: «Пауза» → 409 «Проект уже на паузе: работа прервалась из-за сбоя…»; no PROJECT_PAUSED; the new events are LOCK_STALE_REMOVED, RUN_FINISHED (interrupted), TASK_INTERRUPTED, PROJECT_RECOVERED (all ENGINE); the answer says «на паузе» with «Продолжить»; the server does not repeat: a second press — the same text, no new event",
  { timeout: 90_000 },
  async (t) => {
    const { p, box, run } = await engineProcess(t, threeTasks(3000));
    const s = await startServer(t, box);
    await until(p, workRun("t-0001"), "the work");
    await killed(run);
    const lines = journal(p).length;
    const r = await s.post(ctlPath(p.id), { action: "pause" });
    assert.equal(r.status, 409, r.text);
    assert.deepStrictEqual(r.json, AFTER_FAILURE);
    const added = journal(p).slice(lines);
    assert.deepStrictEqual(pairs(added), [
      ["LOCK_STALE_REMOVED", "ENGINE"],
      ["RUN_FINISHED", "ENGINE"],
      ["TASK_INTERRUPTED", "ENGINE"],
      ["PROJECT_RECOVERED", "ENGINE"],
    ]);
    assert.equal(added[1].data.outcome, "interrupted");
    assert.equal(ofType(journal(p), "PROJECT_PAUSED").length, 0);
    const page = (await s.get(`/api/projects/${p.id}`)).json;
    assert.equal(page.status_text, "на паузе");
    assert.equal(page.controls.resume, true);
    const hash = sha256(fs.readFileSync(p.events));
    const again = await s.post(ctlPath(p.id), { action: "pause" });
    assert.equal(again.status, 409);
    assert.deepStrictEqual(again.json, AFTER_FAILURE);
    assert.equal(sha256(fs.readFileSync(p.events)), hash, "no new event");
  },
);
