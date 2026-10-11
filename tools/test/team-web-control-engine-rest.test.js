// REQ-035 — the control of a project against a real engine (design
// docs/design/REQ-035-team-web-control.md r4, section 15): the scripted executor
// (REQ-010), the engine as a separate process (spawnEngine of
// team-engine-helpers.js) or the engine of the server; the server in the process
// of the test or as the command (spawnWeb). Every executor and engine is started
// only after assertSafeEnv: the data folder and HOME are temporary. Waits are by an
// event of the journal (until), never by a pause, except the windows of time a
// criterion sets (5 s after a pause or a stop, 10–12 s without an ack, 2 s after
// SIGCONT). Criteria 2, 3, 4, 7 (the engine stops), 8 (CTL-2…CTL-8c′), in three files (helpers: team-web-control-engine-kit.js); this one: (CTL-4b, CTL-7b, CTL-8b, CTL-8c, CTL-8c′).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createEngine } from "../src/team/engine/engine.js";
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
  engineProject,
  engineReady,
  isQuestion,
  until,
} from "./team-engine-helpers.js";
import { startServer, webSandbox, within } from "./team-web-helpers.js";
import {
  SENT,
  fail,
  UNCONFIRMED,
  AFTER_FAILURE,
  ctlPath,
  sleep,
  ofType,
  pairs,
  workRun,
  phrases,
  threeTasks,
  BUDGET_RUNS,
  isBudgetWait,
  engineProcess,
  killed,
  projectFiles,
} from "./team-web-control-engine-kit.js";

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
