// Shared helpers of the three files team-web-control-engine*.test.js (REQ-035):
// split only so that node --test runs them in parallel.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sha256 } from "./exec-helpers.js";
import {
  GOAL_OK,
  PASS,
  WORK_OK,
  engineProject,
  engineReady,
  item,
  ok,
  planRun,
  scenarioRun,
  spawnEngine,
} from "./team-engine-helpers.js";
import {
  accessKeyOfLine,
  request,
  spawnWeb,
  within,
  writeHeaders,
} from "./team-web-helpers.js";

export const SENT = { result_text: "Отправлено" };
export const fail = (text) => ({
  error_text: text,
  field: null,
  reload: false,
});
export const UNCONFIRMED = fail(
  "Команда не подтверждена, проверьте состояние проекта через несколько секунд",
);
export const AFTER_FAILURE = fail(
  "Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше",
);
export const ctlPath = (id) => `/api/projects/${id}/control`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const LINK =
  /^Sai Team: http:\/\/127\.0\.0\.1:(\d+)\/\?k=[0-9a-f]{64}\n$/;

export const ofType = (events, type) => events.filter((e) => e.type === type);
export const pairs = (events) => events.map((e) => [e.type, e.source]);
export const workRun = (task) => (e) =>
  e.type === "RUN_STARTED" && e.data.purpose === "work" && e.task === task;
export const lockOf = (p) =>
  JSON.parse(fs.readFileSync(path.join(p.dir, "writer.lock"), "utf8"));
export const phrases = (page) => page.happening.map((h) => h.text);

// The number of work runs of each task (Ф6).
export function workRuns(events) {
  const out = {};
  for (const e of events) {
    if (e.type === "RUN_STARTED" && e.data.purpose === "work") {
      out[e.task] = (out[e.task] ?? 0) + 1;
    }
  }
  return out;
}

export function doneOf(events) {
  const out = {};
  for (const e of ofType(events, "TASK_DONE"))
    out[e.task] = (out[e.task] ?? 0) + 1;
  return out;
}

// The hash of a file once it has stayed the same for `polls` polls in a row.
export async function stableHash(file, polls = 5, gapMs = 40) {
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
export function threeTasks(workMs, reviewMs = 0) {
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
export const BUDGET_RUNS = [
  scenarioRun({ purpose: "plan" }, ok({ tasks: [item("a"), item("b")] })),
  scenarioRun({ purpose: "work" }, WORK_OK),
  scenarioRun({ purpose: "review" }, PASS),
  scenarioRun({ purpose: "goal_check" }, GOAL_OK),
].map((r) => ({ ...r, result: { ...r.result, cost_usd: 0.05 } }));
export const isBudgetWait = (e) =>
  e.type === "PROJECT_WAITING" && e.data.reason === "budget";

// The engine of a project as a separate process, ready (holds the lock, inbox/).
export async function engineProcess(t, runs, over = {}) {
  const p = engineProject(t, runs, over);
  const box = { sb: p.sb, env: p.env, home: p.sb.home };
  const run = spawnEngine(t, p, ["start", p.id, "--parallel", "1"]);
  const lock = await engineReady(p);
  return { p, box, run, lock };
}

export async function killed(run, signal = "SIGKILL") {
  const ended = new Promise((r) => run.child.once("exit", r));
  run.child.kill(signal);
  await ended;
}

// ---- criteria 2 and 3 ---------------------------------------------------------------------

// The server as the command on the scripted executor: { run, port, key }.
export async function webCommand(t, box, scenarioFile) {
  const run = spawnWeb(
    t,
    ["--port", "0", "--executor", "scripted", "--scenario", scenarioFile],
    box.env,
  );
  const line = await within(run.firstLine, 20_000, "the link");
  const m = LINK.exec(line ?? "");
  assert.ok(m !== null, `the line: ${JSON.stringify(line)} ${run.err()}`);
  accessKeyOfLine(line); // ISS-0122: the cookie of the link for request()
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

export function projectFiles(box, id) {
  const dir = path.join(box.home, id);
  return { id, dir, events: path.join(dir, "events.jsonl") };
}

export async function stopCommand(web) {
  web.run.child.kill("SIGINT");
  const end = await within(web.run.done, 30_000, "the end of the server");
  assert.equal(end.code, 0, end.stderr);
}
