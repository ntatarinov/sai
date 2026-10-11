// REQ-035 — the control of a project against a real engine (design
// docs/design/REQ-035-team-web-control.md r4, section 15): the scripted executor
// (REQ-010), the engine as a separate process (spawnEngine of
// team-engine-helpers.js) or the engine of the server; the server in the process
// of the test or as the command (spawnWeb). Every executor and engine is started
// only after assertSafeEnv: the data folder and HOME are temporary. Waits are by an
// event of the journal (until), never by a pause, except the windows of time a
// criterion sets (5 s after a pause or a stop, 10–12 s without an ack, 2 s after
// SIGCONT). Criteria 2, 3, 4, 7 (the engine stops), 8 (CTL-2…CTL-8c′), in three files (helpers: team-web-control-engine-kit.js); this one: CTL-3b.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { journal } from "./exec-helpers.js";
import {
  GOAL_OK,
  PASS,
  WORK_OK,
  item,
  planRun,
  scenarioRun,
  until,
} from "./team-engine-helpers.js";
import { webSandbox } from "./team-web-helpers.js";
import {
  SENT,
  ctlPath,
  ofType,
  pairs,
  workRun,
  lockOf,
  workRuns,
  doneOf,
  webCommand,
  projectFiles,
  stopCommand,
} from "./team-web-control-engine-kit.js";

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
