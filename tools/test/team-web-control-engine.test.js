// REQ-035 — the control of a project against a real engine (design
// docs/design/REQ-035-team-web-control.md r4, section 15): the scripted executor
// (REQ-010), the engine as a separate process (spawnEngine of
// team-engine-helpers.js) or the engine of the server; the server in the process
// of the test or as the command (spawnWeb). Every executor and engine is started
// only after assertSafeEnv: the data folder and HOME are temporary. Waits are by an
// event of the journal (until), never by a pause, except the windows of time a
// criterion sets (5 s after a pause or a stop, 10–12 s without an ack, 2 s after
// SIGCONT). Criteria 2, 3, 4, 7 (the engine stops), 8 (CTL-2…CTL-8c′), in three files (helpers: team-web-control-engine-kit.js); this one: (CTL-2, CTL-3d, CTL-8a).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readProject } from "../src/team/store.js";
import { journal, sha256 } from "./exec-helpers.js";
import { isQuestion, until } from "./team-engine-helpers.js";
import { startServer, webSandbox } from "./team-web-helpers.js";
import {
  SENT,
  UNCONFIRMED,
  ctlPath,
  sleep,
  ofType,
  pairs,
  workRun,
  lockOf,
  phrases,
  workRuns,
  doneOf,
  stableHash,
  threeTasks,
  BUDGET_RUNS,
  isBudgetWait,
  engineProcess,
  webCommand,
  projectFiles,
  stopCommand,
} from "./team-web-control-engine-kit.js";

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

test(
  "CTL-3d (crit. 3; r2 F3, Ф16) a project «ждёт решения» because of the ceiling, the server (the command) stopped by SIGINT — the project is paused with its wait; after a restart the page shows «на паузе», the text of the pause of a project that waited for the ceiling (ISS-0020: pausedBudget) and «Продолжить»; the press → «Отправлено»; the new events are exactly one PROJECT_RESUMED of USER (after command), PROJECT_WAITING budget and the question about the ceiling; no run, nothing spent; the answer says «ждёт решения пользователя» with «Пауза» and «Остановить»",
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
    // ISS-0020: the project waited for the ceiling — the line says so and does
    // not promise that the work goes on (design ISS-0020 r2, section 9)
    assert.equal(
      page.pause_text,
      "Проект на паузе. Он ждал вашего решения о потолке расходов. Если потолка по-прежнему не хватает, после «Продолжить» он снова спросит об этом",
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
