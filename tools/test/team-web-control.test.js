// REQ-035 — the control of a project on the page of Sai Team (design
// docs/design/REQ-035-team-web-control.md r4, section 15): the server in the process
// of the test (port 0), fixtures only through the API of the core, the key of the
// page taken the way the page takes it (GET /, meta[name="sai-page"]). Criteria 1,
// 3 (the engines of the server, CTL-3c), 4 (the body without the confirmation, a
// stopped project), 5, 6, 7, 8 (two tabs, an engine late), 9, 11, 12, 13
// (CTL-1a…CTL-13). Every refusal is checked together with the unchanged state: the
// hash of the journal, the lock, the files of inbox/ and the calls of the engines.
// CTL-1b runs the real index.html and app.js in the model of the DOM
// (team-web-dom.js — not a browser: what it does not cover is said there and in
// team-web-control-page.test.js). ISS-0020 (design
// docs/design/ISS-0020-pause-text-for-waiting.md r2, section 9): CTL-14a, 14b, 14d,
// 14e, 14f, 14g at the end of the file (fixtures: team-web-control-pause-kit.js).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TeamError } from "../src/team/errors.js";
import { ROLE_CODES } from "../src/team/roles.js";
import { PROJECT_STATUS, TASK_STATUS } from "../src/team/schema.js";
import { openWriter } from "../src/team/store.js";
import { controlFailure } from "../src/web/api.js";
import {
  BODY_MAX,
  CONTROL_BODY_MAX,
  ENGINE_START_WAIT_MS,
  START_POLL_MS,
} from "../src/web/config.js";
import { controlRefusal, controlsFor } from "../src/web/display.js";
import { createEngines } from "../src/web/engines.js";
import {
  TEXT,
  WHY_NOT_STARTED,
  WHY_OTHER,
  resumeFailed,
} from "../src/web/texts.js";
import { installFaults } from "./fault-inject.js";
import {
  REPO_ROOT,
  TOOLS_DIR,
  journal,
  sha256,
  waitUntil,
} from "./exec-helpers.js";
import {
  GOAL_OK,
  PASS,
  WORK_OK,
  engineProject,
  engineReady,
  item,
  planRun,
  scenarioRun,
  spawnEngine,
  until,
} from "./team-engine-helpers.js";
import { deadPid, holdWriter, listFilesLive } from "./team-helpers.js";
import { loadPage } from "./team-web-dom.js";
import {
  LINE,
  OUTCOME_CASES,
  TASK_DECISION,
  approvalAnsweredPaused,
  budgetPaused,
  goalNoRunPaused,
  goalPaused,
  plainPaused,
  planPaused,
  promiseWords,
  recoveryWithQuestion,
  resumeOutcome,
  taskQuestionBudgetPaused,
  taskQuestionOpen,
  taskQuestionPaused,
} from "./team-web-control-pause-kit.js";
import {
  ROLE_NUMBERS,
  projectsInEveryStatus,
  richProject,
} from "./team-web-fixtures.js";
import {
  NOT_FOUND_BODY,
  PUBLIC_DIR,
  WEB_SRC,
  ask,
  eng,
  fakeEngines,
  planTask,
  project,
  readOf,
  request,
  snapshot,
  startRun,
  startServer,
  technical as technicalWords,
  usr,
  webSandbox,
  withPlan,
  writeHeaders,
} from "./team-web-helpers.js";

const NOT_UNDERSTOOD = {
  error_text: "Запрос не понят. Обновите страницу",
  field: null,
  reload: false,
};
const NO_STACK =
  /\n\s+at |Error:|\.js:\d+|E_[A-Z]|EIO|errno|syscall|\/tmp\/|sai-exec-test/;
const fail = (text) => ({ error_text: text, field: null, reload: false });
const ctlPath = (id) => `/api/projects/${id}/control`;

// ---- the state of a project that a refusal must leave as it is ----------------------

function inboxFiles(p) {
  return listFilesLive(path.join(p.dir, "inbox"));
}

function lockText(p) {
  const file = path.join(p.dir, "writer.lock");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

// The hash of the journal, the lock (pid and holder, byte for byte) and the files
// of inbox/.
function stateOf(p) {
  return {
    journal: sha256(fs.readFileSync(p.events)),
    lock: lockText(p),
    inbox: inboxFiles(p),
  };
}

const newEvents = (p, before) =>
  journal(p)
    .slice(before)
    .map((e) => [e.type, e.source]);

// A POST of control with the right headers; every answer of this file is checked
// for the key of the page (criterion 6, CTL-6e).
async function ctl(s, id, body, over = {}) {
  const key = over.key ?? (await s.key());
  const r = await s.post(ctlPath(id), body, { ...over, key });
  assert.equal(r.text.includes(key), false, "the key is in no answer");
  return r;
}

// ---- fixtures through the API of the core (design section 15) ------------------------

function running(t, box) {
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.close();
  return p;
}

function pausedByUser(t, box) {
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.append(usr("PROJECT_PAUSED"));
  p.w.close();
  return p;
}

// «ждёт решения» because the ceiling is reached; raised — a BUDGET_SET after it
// (the command budget of the terminal).
function waitingBudget(t, box, { raised = false, paused = false } = {}) {
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.append(eng("PROJECT_WAITING", { reason: "budget" }));
  ask(
    p.w,
    "Достигнут потолок расходов. Поднимите потолок, чтобы продолжить, или остановите проект",
  );
  if (raised) p.w.append(usr("BUDGET_SET", { budget_usd: 10 }));
  if (paused) p.w.append(usr("PROJECT_PAUSED"));
  p.w.close();
  return p;
}

// «ждёт решения» with a question of the project (the plan was not made).
function waitingPlanFailed(t, box) {
  const p = project(t, box);
  p.w.append(usr("PROJECT_STARTED", { parallel: 2 }));
  p.w.append(eng("PLANNING_STARTED", { round: 0 }));
  p.w.append(eng("PROJECT_WAITING", { reason: "plan_failed" }));
  ask(p.w, "План не составлен. Уточните цель или остановите проект");
  p.w.close();
  return p;
}

// A project with a question about a task (richProject waits for the decision on
// t-0006); paused — then paused by the user.
function withTaskQuestion(t, box, { paused = false } = {}) {
  const p = richProject(t, box);
  if (paused) p.w.append(usr("PROJECT_PAUSED"));
  p.w.close();
  return p;
}

// Paused by the core after a failure (Ф14): a task in work with an open run, the
// writer gone; the next writer of the core recovers the project (PROJECT_RECOVERED).
function pausedByRecovery(t, box) {
  const p = workLeft(t, box);
  openWriter(p.id, { home: box.home }).close();
  assert.equal(readOf(box, p.id).state.paused_by, "recovery");
  return p;
}

// «в работе», the task t-0001 in work with its run open, the writer closed.
function workLeft(t, box) {
  const p = project(t, box);
  withPlan(p.w, [planTask("t-0001", "researcher")]);
  p.w.append(eng("TASK_STARTED", {}, "t-0001"));
  startRun(p.w, "work", "researcher", "t-0001");
  p.w.close();
  return p;
}

// A lock left by an engine that died (a pid of an ended process, holder engine).
function deadEngineLock(p) {
  fs.writeFileSync(
    path.join(p.dir, "writer.lock"),
    `${JSON.stringify({ pid: deadPid(), since: new Date().toISOString(), holder: "engine" })}\n`,
    { mode: 0o600 },
  );
}

function everyStatus(t, box) {
  const all = projectsInEveryStatus(t, box);
  for (const [, p] of all) p.w.close();
  return all;
}

// The buttons of section 5.1: [pause, resume, stop].
const BUTTONS = Object.freeze({
  created: [false, false, false],
  planning: [true, false, true],
  running: [true, false, true],
  waiting_user: [true, false, true],
  paused: [false, true, true],
  stopped: [false, false, false],
  done: [false, false, false],
  failed: [false, false, false],
});

const PAUSE_TEXT =
  "Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше";
const STOPPED_TEXT = "Проект остановлен. Продолжить его нельзя";

// ---- criterion 1 ------------------------------------------------------------------------

test("CTL-1a (crit. 1) GET of a project in each status: controls are exactly the row of the table of section 5.1 and controls.api is the address of control (a string, not a Link); pause_text only when paused, stopped_text only when stopped", async (t) => {
  const box = webSandbox(t);
  const all = everyStatus(t, box);
  assert.deepStrictEqual(
    all.map(([s]) => s).sort(),
    [...PROJECT_STATUS].sort(),
    "every status of a project",
  );
  const s = await startServer(t, box);
  for (const [status, p] of all) {
    const r = await s.get(`/api/projects/${p.id}`);
    assert.equal(r.status, 200, status);
    assert.equal(r.json.status, status);
    const [pause, resume, stop] = BUTTONS[status];
    assert.deepStrictEqual(
      r.json.controls,
      { pause, resume, stop, api: `/api/projects/${p.id}/control` },
      status,
    );
    assert.equal(r.json.pause_text, status === "paused" ? PAUSE_TEXT : null);
    assert.equal(
      r.json.stopped_text,
      status === "stopped" ? STOPPED_TEXT : null,
    );
    assert.doesNotMatch(r.text, /командой resume/);
  }
  // the pure rule of the table, for every status of the schema
  for (const status of PROJECT_STATUS) {
    const [pause, resume, stop] = BUTTONS[status];
    assert.deepStrictEqual(
      controlsFor(status),
      { pause, resume, stop },
      status,
    );
  }
  assert.deepStrictEqual(s.engines.calls, []);
});

// The page of the server behind the fake fetch of the model of the DOM: every
// request goes to the real server; the writes are counted.
function serverFetch(port, writes = []) {
  return async (pth, init) => {
    const method = init?.method ?? "GET";
    const headers =
      method === "POST"
        ? writeHeaders(port, init.headers["X-Sai-Page"], {
            "Content-Type": init.headers["Content-Type"],
          })
        : {};
    if (method === "POST") writes.push({ path: pth, body: init.body });
    const r = await request(port, {
      method,
      path: pth,
      headers,
      body: init?.body,
    });
    return { status: r.status, raw: r.text };
  };
}

async function waitFor(fn, what, ms = 10_000) {
  const deadline = Date.now() + ms;
  for (;;) {
    if (fn()) return;
    assert.ok(Date.now() < deadline, `${what}: not within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const norm = (text) => text.replace(/\s+/g, " ").trim();

test("CTL-1b (crit. 1) the real index.html and app.js (model of the DOM) on the answers of the server for a project in each status: exactly the buttons of the table are shown, the line «на паузе» and the line «остановлен» with their texts; no button and no block of control where the table has none", async (t) => {
  const box = webSandbox(t);
  const all = everyStatus(t, box);
  const s = await startServer(t, box);
  const key = await s.key();
  const writes = [];
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    key,
    fetch: serverFetch(s.port, writes),
  });
  await page.settle();
  for (const [status, p] of all) {
    await page.go(`#/projects/${p.id}`);
    await waitFor(
      () => page.eval(`app.project !== null && app.project.id`) === p.id,
      status,
    );
    await page.settle();
    const [pause, resume, stop] = BUTTONS[status];
    assert.deepStrictEqual(
      ["ctl-pause", "ctl-resume", "ctl-stop"].map((id) => page.byId(id).shown),
      [pause, resume, stop],
      status,
    );
    assert.equal(page.byId("controls").shown, pause || resume || stop, status);
    const pauseLine = page.byId("project-pause");
    assert.equal(pauseLine.shown, status === "paused", status);
    assert.equal(pauseLine.textContent, status === "paused" ? PAUSE_TEXT : "");
    const stoppedLine = page.byId("project-stopped");
    assert.equal(stoppedLine.shown, status === "stopped", status);
    assert.equal(
      stoppedLine.textContent,
      status === "stopped" ? STOPPED_TEXT : "",
    );
    assert.equal(page.byId("stop-confirm").shown, false);
  }
  assert.deepStrictEqual(writes, [], "showing writes nothing");
});

function srcFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) srcFiles(abs, out);
    else out.push(abs);
  }
  return out;
}

test("CTL-1c (crit. 1) grep -rn 'командой resume' tools/src/web/ finds nothing (the files of the server and of the page are read)", () => {
  const files = srcFiles(WEB_SRC);
  assert.ok(files.some((f) => f.endsWith("texts.js")));
  assert.ok(files.some((f) => f.endsWith("app.js")));
  for (const f of files) {
    assert.equal(
      fs.readFileSync(f, "utf8").includes("командой resume"),
      false,
      f,
    );
  }
});

// ---- criterion 3: the engines of the server (section 7) --------------------------------

// The factory of CTL-3c (i): the engine opens on the next macrotask; then its run
// is refused with E_DISK, and its state is { status: S } (as the real engine: the
// writer opens later, the refusal comes after it; Ф15, Ф17).
function openingLater(S, made) {
  return (id, opts) => {
    made.push({ id, mode: opts.mode });
    let opened = false;
    return {
      state: () => (opened ? { status: S } : null),
      run: () =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            opened = true;
            reject(new TeamError("E_DISK", "сбой записи движка с pid 4242"));
          }, 0);
        }),
      requestStop: () => {},
    };
  };
}

const outcome = (r) => ({
  resumed: r.resumed,
  error: r.error === null ? null : r.error.code,
  late: r.late,
});

test("CTL-3c (i) (crit. 3; section 7, r1 L6, r2 F4) engines.resume with a factory whose engine opens on the next macrotask and then fails with E_DISK: the first look is synchronous and sees nothing; the second sees the state first and the refusal after — S = running (and every status a pause reaches only by PROJECT_RESUMED) → resumed true with the error; S = paused, stopped, failed → resumed false with the error; the factory is called once, in the mode resume", async (t) => {
  const box = webSandbox(t);
  for (const [S, resumed] of [
    ["running", true],
    ["planning", true],
    ["waiting_user", true],
    ["done", true],
    ["paused", false],
    ["stopped", false],
    ["failed", false],
  ]) {
    const made = [];
    const warned = [];
    const engines = createEngines({
      home: box.home,
      env: box.env,
      warn: (l) => warned.push(l),
      create: openingLater(S, made),
    });
    const r = await engines.resume("p-20990101-a1b2c3");
    assert.deepStrictEqual(
      outcome(r),
      { resumed, error: "E_DISK", late: false },
      S,
    );
    assert.deepStrictEqual(
      made,
      [{ id: "p-20990101-a1b2c3", mode: "resume" }],
      S,
    );
    assert.equal(warned.length, 1, `${S}: one line of the engine for stderr`);
    assert.equal(engines.has("p-20990101-a1b2c3"), false, S);
  }
});

test("CTL-3c (iii) (crit. 3; section 7, r2 F4) an engine whose state is running at once and whose run does not end: resume answers { resumed: true, error: null, late: false } at the first, synchronous look — a timer of 0 ms set right after the call has not run when the answer comes; has(id) is true while it runs; a second resume — E_ALREADY_RUNNING without a second engine", async (t) => {
  const box = webSandbox(t);
  const made = [];
  let stopRun = () => {};
  const create = (id, opts) => {
    made.push({ id, mode: opts.mode });
    return {
      state: () => ({ status: "running" }),
      run: () =>
        new Promise((resolve) => {
          stopRun = resolve;
        }),
      requestStop: () => stopRun(),
    };
  };
  const engines = createEngines({
    home: box.home,
    env: box.env,
    warn: () => {},
    create,
  });
  t.after(() => engines.stopAll(1000));
  let marked = false;
  // the timer is set BEFORE the call: it is queued ahead of any wait inside resume
  setTimeout(() => {
    marked = true;
  }, 0);
  const pending = engines.resume("p-20990101-a1b2c3");
  const r = await pending;
  assert.equal(marked, false, "the answer came before the first wait");
  assert.deepStrictEqual(outcome(r), {
    resumed: true,
    error: null,
    late: false,
  });
  assert.equal(engines.has("p-20990101-a1b2c3"), true);
  assert.equal(engines.has("p-20990101-d4e5f6"), false);
  const again = await engines.resume("p-20990101-a1b2c3");
  assert.deepStrictEqual(outcome(again), {
    resumed: false,
    error: "E_ALREADY_RUNNING",
    late: false,
  });
  assert.equal(made.length, 1, "no second engine");
  assert.equal(await engines.stopAll(1000), true);
  assert.equal(engines.has("p-20990101-a1b2c3"), false);
});

test("CTL-3c (iv) (section 7, steps 3 and 4) with fixed clocks (mock timers of setTimeout and Date): an engine that ends without a resumption and without a refusal — E_INTERNAL; an engine that neither resumes nor refuses within ENGINE_START_WAIT_MS — late, not before the wait is over", async (t) => {
  const box = webSandbox(t);
  // ends at once, the project still paused
  const quiet = createEngines({
    home: box.home,
    env: box.env,
    warn: () => {},
    create: () => ({
      state: () => ({ status: "paused" }),
      run: () => Promise.resolve({ status: "paused" }),
      requestStop: () => {},
    }),
  });
  assert.deepStrictEqual(outcome(await quiet.resume("p-20990101-a1b2c3")), {
    resumed: false,
    error: "E_INTERNAL",
    late: false,
  });
  // never opens: late after exactly the wait
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const slow = createEngines({
    home: box.home,
    env: box.env,
    warn: () => {},
    create: () => ({
      state: () => null,
      run: () => new Promise(() => {}),
      requestStop: () => {},
    }),
  });
  let answer = null;
  slow.resume("p-20990101-a1b2c3").then((r) => {
    answer = r;
  });
  const flush = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };
  await flush();
  let waited = 0;
  while (answer === null && waited < ENGINE_START_WAIT_MS * 2) {
    t.mock.timers.tick(START_POLL_MS);
    waited += START_POLL_MS;
    await flush();
    if (waited < ENGINE_START_WAIT_MS) {
      assert.equal(answer, null, `no answer at ${waited} ms`);
    }
  }
  assert.deepStrictEqual(outcome(answer), {
    resumed: false,
    error: null,
    late: true,
  });
  assert.equal(waited, ENGINE_START_WAIT_MS);
  t.mock.timers.reset();
});

test("CTL-3c (ii) (crit. 3; section 6.3, r1 L6) the engine of the server wrote the resumption and failed at once ({ resumed: true, error: E_DISK }): 500 «Проект продолжен, но работа сразу прервалась…»; the handler writes no warning and nothing to the journal; resume of the engines is called exactly once, start never", async (t) => {
  const box = webSandbox(t);
  const p = pausedByUser(t, box);
  const engines = fakeEngines(undefined, {
    resume: {
      resumed: true,
      error: new TeamError("E_DISK", "сбой записи движка"),
      late: false,
    },
  });
  const s = await startServer(t, box, { engines });
  const before = stateOf(p);
  const r = await ctl(s, p.id, { action: "resume" });
  assert.equal(r.status, 500, r.text);
  assert.deepStrictEqual(
    r.json,
    fail(
      "Проект продолжен, но работа сразу прервалась. Проверьте состояние проекта через несколько секунд",
    ),
  );
  assert.doesNotMatch(r.text, NO_STACK);
  assert.deepStrictEqual(s.warnings, [], "postControl writes no second line");
  assert.deepStrictEqual(stateOf(p), before);
  assert.deepStrictEqual(engines.resumes, [p.id]);
  assert.deepStrictEqual(engines.calls, []);
});

test("CTL-3 (section 6.3, step 2) «Продолжить» of a paused project without a live engine goes to engines.resume of the server, never to deliver: a refusal of the opening of the engine is «Проект не продолжен: <why>»; an engine that came up meanwhile (E_ALREADY_RUNNING) — the project read anew is still paused → «Команда не выполнена…»; the journal and inbox/ unchanged", async (t) => {
  const box = webSandbox(t);
  for (const [err, status, text] of [
    [
      new TeamError("E_SCENARIO", "сценарий"),
      409,
      "Проект не продолжен: сценарий тестового исполнителя неверен",
    ],
    [
      new TeamError("E_NO_BUDGET", "нет потолка"),
      409,
      "Проект не продолжен: у проекта нет потолка расходов",
    ],
    [
      new TeamError("E_EXECUTOR", "исполнитель"),
      409,
      "Проект не продолжен: внутренняя ошибка",
    ],
    [
      new TeamError("E_ALREADY_RUNNING", "уже идёт"),
      409,
      "Команда не выполнена, повторите через несколько секунд",
    ],
  ]) {
    const p = pausedByUser(t, box);
    const engines = fakeEngines(undefined, {
      resume: { resumed: false, error: err, late: false },
    });
    const s = await startServer(t, box, { engines });
    const before = stateOf(p);
    const r = await ctl(s, p.id, { action: "resume" });
    assert.equal(r.status, status, `${err.code}: ${r.text}`);
    assert.deepStrictEqual(r.json, fail(text), err.code);
    assert.deepStrictEqual(stateOf(p), before, err.code);
    assert.deepStrictEqual(engines.resumes, [p.id], err.code);
    assert.deepStrictEqual(engines.asked, [p.id], err.code);
    assert.deepStrictEqual(s.warnings, [], err.code);
    await s.close();
  }
});

// ---- criterion 4 --------------------------------------------------------------------------

test('CTL-4c (crit. 4) a direct POST of a stop without the confirmation — no confirmed, confirmed false, "true", 1 — with the right Host, Origin, type and key: 400 «Запрос не понят. Обновите страницу»; the journal, the lock and inbox/ unchanged; the project still runs', async (t) => {
  const box = webSandbox(t);
  const p = running(t, box);
  const s = await startServer(t, box);
  const before = stateOf(p);
  for (const body of [
    { action: "stop" },
    { action: "stop", confirmed: false },
    { action: "stop", confirmed: "true" },
    { action: "stop", confirmed: 1 },
    { action: "stop", confirmed: null },
    { action: "stop", confirmed: [true] },
  ]) {
    const r = await ctl(s, p.id, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.deepStrictEqual(r.json, NOT_UNDERSTOOD, JSON.stringify(body));
  }
  assert.deepStrictEqual(stateOf(p), before);
  assert.equal(readOf(box, p.id).state.status, "running");
  assert.deepStrictEqual(s.engines.calls, []);
});

test("CTL-4d (crit. 4, 12) a stopped project: a direct «Продолжить» → 409 «Проект остановлен. Продолжить его нельзя»; the journal unchanged; the status is still «остановлен»", async (t) => {
  const box = webSandbox(t);
  const stopped = everyStatus(t, box).find(([st]) => st === "stopped")[1];
  const s = await startServer(t, box);
  const before = stateOf(stopped);
  const r = await ctl(s, stopped.id, { action: "resume" });
  assert.equal(r.status, 409, r.text);
  assert.deepStrictEqual(r.json, fail(STOPPED_TEXT));
  assert.deepStrictEqual(stateOf(stopped), before);
  const page = (await s.get(`/api/projects/${stopped.id}`)).json;
  assert.equal(page.status_text, "остановлен");
  assert.deepStrictEqual(s.engines.resumes, []);
});

// ---- criterion 5 ----------------------------------------------------------------------------

test("CTL-5a (crit. 5) the commands of criterion 5 on the current files: no appendFile|writeFile|createWriteStream|openSync|rename and no inbox in tools/src/web/; deliver only in api.js; no node:(https|net|tls|dgram) in tools/src/web/; no node:(http|https|net|tls|dgram) and no fetch( in tools/src/team/", () => {
  const web = srcFiles(WEB_SRC);
  const deliverIn = [];
  for (const f of web) {
    const body = fs.readFileSync(f, "utf8");
    const rel = path.relative(WEB_SRC, f);
    assert.doesNotMatch(
      body,
      /appendFile|writeFile|createWriteStream|openSync|rename/,
      rel,
    );
    assert.doesNotMatch(body, /inbox/, rel);
    assert.doesNotMatch(body, /node:(https|net|tls|dgram)/, rel);
    if (/deliver/.test(body)) deliverIn.push(rel);
  }
  assert.deepStrictEqual(deliverIn, ["api.js"]);
  const api = fs.readFileSync(path.join(WEB_SRC, "api.js"), "utf8");
  assert.ok(/\bdeliver\(/.test(api), "a call of deliver is found");
  const team = srcFiles(path.join(TOOLS_DIR, "src", "team"));
  assert.ok(team.length >= 10);
  for (const f of team) {
    assert.doesNotMatch(
      fs.readFileSync(f, "utf8"),
      /node:(http|https|net|tls|dgram)|fetch[(]/,
      f,
    );
  }
});

test("CTL-5b (crit. 5; Ф14, case A) «в работе» with a plan, no open run and no task in work, the lock left by a dead engine; the server has no engine: «Пауза» → 200 «Отправлено»; the new events are exactly LOCK_STALE_REMOVED (ENGINE) and one PROJECT_PAUSED (USER); the status is «на паузе»; the engines are not asked to start", async (t) => {
  const box = webSandbox(t);
  const p = running(t, box);
  deadEngineLock(p);
  const s = await startServer(t, box);
  const lines = journal(p).length;
  const r = await ctl(s, p.id, { action: "pause" });
  assert.equal(r.status, 200, r.text);
  assert.deepStrictEqual(r.json, { result_text: "Отправлено" });
  assert.deepStrictEqual(newEvents(p, lines), [
    ["LOCK_STALE_REMOVED", "ENGINE"],
    ["PROJECT_PAUSED", "USER"],
  ]);
  const page = (await s.get(`/api/projects/${p.id}`)).json;
  assert.equal(page.status_text, "на паузе");
  assert.deepStrictEqual(inboxFiles(p), []);
  assert.equal(lockText(p), null, "the core let the lock go");
  assert.deepStrictEqual(s.engines.calls, []);
  assert.deepStrictEqual(s.engines.resumes, []);
});

test("CTL-5b′ (crit. 5, 8; Ф14, case B) the same, but a task in work with its run open: «Пауза» → 409 «Проект уже на паузе: работа прервалась из-за сбоя…»; no PROJECT_PAUSED, the core recovered the project (LOCK_STALE_REMOVED, RUN_FINISHED, TASK_INTERRUPTED, PROJECT_RECOVERED); the page shows «на паузе» and «Продолжить»; a second press writes nothing", async (t) => {
  const box = webSandbox(t);
  const p = workLeft(t, box);
  deadEngineLock(p);
  const s = await startServer(t, box);
  const lines = journal(p).length;
  const r = await ctl(s, p.id, { action: "pause" });
  assert.equal(r.status, 409, r.text);
  assert.deepStrictEqual(r.json, fail(TEXT.ctlPausedAfterFailure));
  assert.equal(
    r.json.error_text,
    "Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше",
  );
  assert.deepStrictEqual(newEvents(p, lines), [
    ["LOCK_STALE_REMOVED", "ENGINE"],
    ["RUN_FINISHED", "ENGINE"],
    ["TASK_INTERRUPTED", "ENGINE"],
    ["PROJECT_RECOVERED", "ENGINE"],
  ]);
  const page = (await s.get(`/api/projects/${p.id}`)).json;
  assert.equal(page.status_text, "на паузе");
  assert.equal(page.controls.resume, true);
  const after = stateOf(p);
  const again = await ctl(s, p.id, { action: "pause" });
  assert.equal(again.status, 409);
  assert.deepStrictEqual(again.json, fail(TEXT.ctlPausedAfterFailure));
  assert.deepStrictEqual(stateOf(p), after, "no new event");
});

test("CTL-5c (crit. 5) the right to write is held by a process, not an engine (the writer of the core that the short command say opens, here opened by the test): «Пауза» → 409 «Команда не выполнена, повторите через несколько секунд»; the journal, the lock and inbox/ unchanged", async (t) => {
  const box = webSandbox(t);
  const p = running(t, box);
  const w = openWriter(p.id, { home: box.home });
  t.after(() => w.close());
  const s = await startServer(t, box);
  const before = stateOf(p);
  assert.ok(before.lock !== null && !before.lock.includes("engine"));
  for (const body of [
    { action: "pause" },
    { action: "stop", confirmed: true },
  ]) {
    const r = await ctl(s, p.id, body);
    assert.equal(r.status, 409, r.text);
    assert.deepStrictEqual(
      r.json,
      fail("Команда не выполнена, повторите через несколько секунд"),
    );
  }
  assert.deepStrictEqual(stateOf(p), before);
  w.close();
});

// ---- criterion 6 ------------------------------------------------------------------------

// A project of the scripted executor led by an engine of another process, in a long
// work run (it writes nothing while the run goes on).
async function liveEngine(t) {
  const p = engineProject(t, [
    planRun([item("a")]),
    scenarioRun({ purpose: "work" }, WORK_OK, [{ delay_ms: 40_000 }]),
    scenarioRun({ purpose: "review" }, PASS),
    scenarioRun({ purpose: "goal_check" }, GOAL_OK),
  ]);
  const box = { sb: p.sb, env: p.env, home: p.sb.home };
  const run = spawnEngine(t, p);
  await engineReady(p);
  await until(
    p,
    (e) => e.type === "RUN_STARTED" && e.data.purpose === "work",
    "the work run",
  );
  // the engine has written all it writes before the run ends
  await new Promise((r) => setTimeout(r, 300));
  return { p, box, run };
}

test(
  "CTL-6a (crit. 6) six requests on a running project with an engine of another process — a foreign Host, a foreign Origin, no Origin, text/plain, no key, a key of another start: each is refused; the journal (hash), the lock (pid, holder) and inbox/ (the list of files) are the same before and after; the engine got no message",
  { timeout: 90_000 },
  async (t) => {
    const { p, box } = await liveEngine(t);
    const s = await startServer(t, box);
    const key = await s.key();
    const before = stateOf(p);
    assert.match(before.lock, /"holder":"engine"/);
    const body = JSON.stringify({ action: "pause" });
    const answers = [
      await s.request({
        method: "POST",
        path: ctlPath(p.id),
        headers: { ...writeHeaders(s.port, key), Host: "evil.test" },
        body,
      }),
      await ctl(s, p.id, body, { headers: { Origin: "http://evil.test" } }),
      await ctl(s, p.id, body, { headers: { Origin: undefined } }),
      await ctl(s, p.id, body, { headers: { "Content-Type": "text/plain" } }),
      await ctl(s, p.id, body, { headers: { "X-Sai-Page": undefined } }),
      await ctl(s, p.id, body, { key: "b".repeat(64) }),
    ];
    assert.deepStrictEqual(
      answers.map((r) => [r.status, r.json.error_text, r.json.reload]),
      [
        [403, "Запрос отклонён", false],
        [403, TEXT.refused, false],
        [403, TEXT.refused, false],
        [403, TEXT.refused, false],
        [403, TEXT.refused, false],
        [403, TEXT.staleKeyControl, true],
      ],
    );
    assert.deepStrictEqual(stateOf(p), before);
    assert.equal(
      journal(p).filter((e) => e.type === "PROJECT_PAUSED").length,
      0,
    );
  },
);

test("CTL-6b (crit. 6; section 3.4, step 4) a key of the right form from a former start of the server: 403 with reload true and the text «Sai Team был перезапущен, и эта страница устарела. Обновите страницу и повторите», no data of the project in the answer; the chat keeps its own text", async (t) => {
  const box = webSandbox(t);
  const p = running(t, box);
  const s = await startServer(t, box);
  const before = stateOf(p);
  const r = await ctl(s, p.id, { action: "pause" }, { key: "c".repeat(64) });
  assert.equal(r.status, 403);
  assert.deepStrictEqual(r.json, {
    error_text:
      "Sai Team был перезапущен, и эта страница устарела. Обновите страницу и повторите",
    field: null,
    reload: true,
  });
  assert.equal(r.text.includes(p.id), false, "no id of the project");
  assert.equal(r.text.includes("Вымышленная цель"), false, "no goal");
  assert.deepStrictEqual(stateOf(p), before);
  const chat = await s.post(
    `/api/projects/${p.id}/chat`,
    { text: "x" },
    { key: "c".repeat(64) },
  );
  assert.equal(chat.json.error_text, TEXT.staleKey);
});

// A body of the right form padded with spaces to `bytes` bytes (JSON allows them).
const padded = (body, bytes) => {
  const text = JSON.stringify(body);
  return text + " ".repeat(bytes - Buffer.byteLength(text));
};

test("CTL-6c (crit. 6; section 3.2, 3.4 step 5) 400 «Запрос не понят» and the journal unchanged for: an extra key (confirmed of a pause or resume too), no key, an unknown action, a root that is not an object, not JSON, not UTF-8, and a right body padded to 4097, 8192 and 70000 bytes (declared and chunked) — never «Сообщение слишком большое»; exactly 4096 bytes is read — 200 and one PROJECT_PAUSED", async (t) => {
  const box = webSandbox(t);
  const p = running(t, box);
  const s = await startServer(t, box);
  const key = await s.key();
  const before = stateOf(p);
  assert.equal(CONTROL_BODY_MAX, 4096);
  const bodies = [
    { action: "pause", x: 1 },
    { action: "pause", confirmed: true },
    { action: "resume", confirmed: true },
    { action: "stop", confirmed: true, x: 1 },
    {},
    { act: "pause" },
    { action: "restart" },
    { action: "PAUSE" },
    { action: ["pause"] },
    "[1]",
    '"pause"',
    "null",
    "{",
    "",
    Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d]),
    padded({ action: "pause" }, 4097),
    padded({ action: "pause" }, 8192),
    padded({ action: "pause" }, 70_000),
  ];
  for (const b of bodies) {
    const r = await ctl(s, p.id, b, { key });
    const tag = Buffer.isBuffer(b) ? "not UTF-8" : String(b).slice(0, 40);
    assert.equal(r.status, 400, `${tag}: ${r.text}`);
    assert.deepStrictEqual(r.json, NOT_UNDERSTOOD, tag);
  }
  assert.ok(70_000 > BODY_MAX, "more than the limit of the chat too");
  // by the bytes read: no Content-Length, 8192 bytes in parts
  const big = padded({ action: "pause" }, 8192);
  const chunked = await request(s.port, {
    method: "POST",
    path: ctlPath(p.id),
    headers: {
      ...writeHeaders(s.port, key),
      "Transfer-Encoding": "chunked",
    },
    parts: [
      [Buffer.from(big.slice(0, 3000)), 0],
      [Buffer.from(big.slice(3000)), 0],
    ],
    end: true,
  });
  assert.equal(chunked.status, 400);
  assert.deepStrictEqual(chunked.json, NOT_UNDERSTOOD);
  assert.deepStrictEqual(stateOf(p), before, "nothing changed");
  assert.deepStrictEqual(s.engines.calls, []);
  // the edge: exactly 4096 bytes is a request
  const lines = journal(p).length;
  const edge = padded({ action: "pause" }, 4096);
  assert.equal(Buffer.byteLength(edge), 4096);
  const r = await ctl(s, p.id, edge, { key });
  assert.equal(r.status, 200, r.text);
  assert.deepStrictEqual(r.json, { result_text: "Отправлено" });
  assert.deepStrictEqual(newEvents(p, lines), [["PROJECT_PAUSED", "USER"]]);
});

test("CTL-6d (crit. 6; Q8 for projects) «../x», an absolute path and a project that is not there give one answer «Не найдено» — the same status and the same bytes; a path of one project changes no other project", async (t) => {
  const box = webSandbox(t);
  const a = running(t, box);
  const b = running(t, box);
  const s = await startServer(t, box);
  const key = await s.key();
  const before = snapshot(box.home);
  const answers = [];
  for (const pth of [
    "/api/projects/..%2Fx/control",
    "/api/projects/../x/control",
    "/api/projects/%2Fetc%2Fpasswd/control",
    `/api/projects/${encodeURIComponent(box.home)}/control`,
    "/api/projects/p-20990101-a1b2c3/control",
  ]) {
    const r = await request(s.port, {
      method: "POST",
      path: pth,
      headers: writeHeaders(s.port, key),
      body: JSON.stringify({ action: "pause" }),
    });
    answers.push([r.status, r.text]);
  }
  for (const a2 of answers) assert.deepStrictEqual(a2, [404, NOT_FOUND_BODY]);
  assert.deepStrictEqual(snapshot(box.home), before);
  // Q8: the path names the one project that changes
  const bBefore = stateOf(b);
  const r = await ctl(s, a.id, { action: "pause" }, { key });
  assert.equal(r.status, 200);
  assert.equal(readOf(box, a.id).state.status, "paused");
  assert.deepStrictEqual(stateOf(b), bBefore);
  assert.equal(readOf(box, b.id).state.status, "running");
});

test("CTL-6e (crit. 6; Q7) the key of the page is in no answer of control (success and refusals) and in no file of SAI_TEAM_HOME, the journal included", async (t) => {
  const box = webSandbox(t);
  const all = everyStatus(t, box);
  const s = await startServer(t, box);
  const key = await s.key();
  const texts = [];
  for (const [, p] of all) {
    for (const body of [
      { action: "pause" },
      { action: "resume" },
      { action: "stop", confirmed: true },
      { action: "stop" },
    ]) {
      const r = await ctl(s, p.id, body, { key });
      texts.push(r.text);
    }
  }
  assert.ok(texts.length === 32);
  for (const text of texts) assert.equal(text.includes(key), false);
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = fs.lstatSync(abs);
      if (st.isDirectory()) walk(abs);
      else
        assert.equal(fs.readFileSync(abs, "latin1").includes(key), false, abs);
    }
  };
  walk(box.home);
  assert.equal(s.warnings.join("\n").includes(key), false, "nor in err");
});

test("CTL-6f (crit. 6) every GET — the list, the projects, the chats, the tasks, the roles of projects in every status — and GET, PUT, DELETE of the address of control (405 «Запрос не понят», Allow: POST, no handler called) leave every path and hash of SAI_TEAM_HOME the same", async (t) => {
  const box = webSandbox(t);
  const all = everyStatus(t, box);
  const s = await startServer(t, box);
  const before = snapshot(box.home);
  const paths = ["/", "/api/projects"];
  for (const [, p] of all) {
    paths.push(`/api/projects/${p.id}`, `/api/projects/${p.id}/chat`);
    for (const task of readOf(box, p.id).state.tasks)
      paths.push(`/api/projects/${p.id}/tasks/${task.id}`);
    for (const n of ROLE_NUMBERS)
      paths.push(`/api/projects/${p.id}/roles/${n}`);
  }
  for (const pth of paths) {
    const r = await s.get(pth);
    assert.equal(r.status, 200, pth);
  }
  for (const [, p] of all) {
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const r = await s.request({ method, path: ctlPath(p.id) });
      assert.equal(r.status, 405, `${method} ${r.text}`);
      assert.equal(r.headers.allow, "POST", method);
      assert.deepStrictEqual(r.json, NOT_UNDERSTOOD, method);
    }
  }
  assert.deepStrictEqual(snapshot(box.home), before);
  assert.deepStrictEqual(s.warnings, [], "no handler failed");
  assert.deepStrictEqual(s.engines.calls, []);
});

// ---- criterion 7 ------------------------------------------------------------------------

const T7 = {
  alreadyPaused: "Проект уже на паузе",
  alreadyRunning: "Проект уже работает",
  stoppedFinal: STOPPED_TEXT,
  alreadyStopped: "Проект уже остановлен",
  finished: "Проект уже завершён",
  taskDecision:
    "Проект ждёт вашего решения по задаче. Ответить на странице пока нельзя — это появится позже",
  budget:
    "Продолжить нельзя: потолок расходов исчерпан. Как поднять потолок, написано в инструкции Sai Team",
  decision:
    "Проект ждёт вашего решения. Продолжить его с этой страницы пока нельзя — это появится позже",
  notStarted: "Проект ещё не начал работу. Повторите через несколько секунд",
  afterFailure:
    "Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше",
};

const STOP = { action: "stop", confirmed: true };

test("CTL-7a (crit. 7; section 5.2) the table «state, action → text»: each refusal is 409 with its text; the journal, the lock and inbox/ unchanged after each; «ждёт решения» with a raised ceiling and «создан» — the engine got nothing (inbox/ empty), and no engine was started or resumed", async (t) => {
  const box = webSandbox(t);
  const st = Object.fromEntries(everyStatus(t, box));
  const rows = [
    [
      "на паузе (по команде), «Пауза»",
      pausedByUser(t, box),
      { action: "pause" },
      T7.alreadyPaused,
    ],
    [
      "в работе, «Продолжить»",
      st.running,
      { action: "resume" },
      T7.alreadyRunning,
    ],
    [
      "планирование, «Продолжить»",
      st.planning,
      { action: "resume" },
      T7.alreadyRunning,
    ],
    [
      "остановлен, «Продолжить»",
      st.stopped,
      { action: "resume" },
      T7.stoppedFinal,
    ],
    ["остановлен, «Остановить»", st.stopped, STOP, T7.alreadyStopped],
    ["остановлен, «Пауза»", st.stopped, { action: "pause" }, T7.alreadyStopped],
    ["выполнен, «Пауза»", st.done, { action: "pause" }, T7.finished],
    ["выполнен, «Продолжить»", st.done, { action: "resume" }, T7.finished],
    ["выполнен, «Остановить»", st.done, STOP, T7.finished],
    ["не удалось, «Пауза»", st.failed, { action: "pause" }, T7.finished],
    ["не удалось, «Продолжить»", st.failed, { action: "resume" }, T7.finished],
    ["не удалось, «Остановить»", st.failed, STOP, T7.finished],
    [
      "ждёт решения по задаче, «Продолжить»",
      withTaskQuestion(t, box),
      { action: "resume" },
      T7.taskDecision,
    ],
    [
      "ждёт решения, потолок, «Продолжить»",
      waitingBudget(t, box),
      { action: "resume" },
      T7.budget,
    ],
    [
      "ждёт решения, потолок поднят, «Продолжить»",
      waitingBudget(t, box, { raised: true }),
      { action: "resume" },
      T7.decision,
    ],
    [
      "ждёт решения, план не составлен, «Продолжить»",
      waitingPlanFailed(t, box),
      { action: "resume" },
      T7.decision,
    ],
    ["создан, «Пауза»", st.created, { action: "pause" }, T7.notStarted],
    ["создан, «Продолжить»", st.created, { action: "resume" }, T7.notStarted],
    ["создан, «Остановить»", st.created, STOP, T7.notStarted],
    [
      "на паузе с вопросом по задаче, «Продолжить»",
      withTaskQuestion(t, box, { paused: true }),
      { action: "resume" },
      T7.taskDecision,
    ],
    [
      "на паузе после сбоя, «Пауза»",
      pausedByRecovery(t, box),
      { action: "pause" },
      T7.afterFailure,
    ],
    [
      "на паузе во время ожидания по потолку, «Пауза»",
      waitingBudget(t, box, { paused: true }),
      { action: "pause" },
      T7.alreadyPaused,
    ],
  ];
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines });
  for (const [name, p, body, text] of rows) {
    const before = stateOf(p);
    const r = await ctl(s, p.id, body);
    assert.equal(r.status, 409, `${name}: ${r.text}`);
    assert.deepStrictEqual(r.json, fail(text), name);
    assert.deepStrictEqual(stateOf(p), before, name);
    assert.deepStrictEqual(inboxFiles(p), [], `${name}: inbox/ empty`);
    assert.doesNotMatch(r.text, NO_STACK, name);
  }
  assert.deepStrictEqual(engines.calls, []);
  assert.deepStrictEqual(engines.resumes, []);
  assert.deepStrictEqual(s.warnings, []);
});

test("CTL-7a (property; section 5.1–5.2) on every state of the table: an action the page lets through (controlRefusal null) always has its button shown (controlsFor) — the page is nowhere wider than its buttons; a hidden button's action is always refused before sending", (t) => {
  const box = webSandbox(t);
  const all = [
    ...everyStatus(t, box).map(([, p]) => p),
    pausedByUser(t, box),
    withTaskQuestion(t, box),
    withTaskQuestion(t, box, { paused: true }),
    waitingBudget(t, box),
    waitingBudget(t, box, { raised: true }),
    waitingBudget(t, box, { paused: true }),
    waitingPlanFailed(t, box),
    pausedByRecovery(t, box),
  ];
  let allowed = 0;
  for (const p of all) {
    const { state, events } = readOf(box, p.id);
    const shown = controlsFor(state.status);
    for (const action of ["pause", "resume", "stop"]) {
      const refusal = controlRefusal(action, state, events);
      const tag = `${state.status} ${action}`;
      if (refusal === null) {
        allowed += 1;
        assert.equal(shown[action], true, `${tag}: allowed without a button`);
      }
      if (!shown[action]) assert.equal(typeof refusal, "string", tag);
      if (refusal !== null) {
        assert.deepStrictEqual(technicalWords(refusal), [], tag);
      }
    }
  }
  assert.ok(allowed >= 10, String(allowed));
});

test("CTL-7b (crit. 7; Q10) failures with the server in the process: the lock held by a writer of another process → «Команда не выполнена…»; EIO on the write of the journal → «Диск не принимает записи: команда не выполнена…»; the write and its rollback fail → «…команда могла выполниться…»; a damaged line in the middle of the journal → «Данные проекта повреждены…»; no project → «Не найдено»; no stack, code or path; the next request answers 200", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  const key = await s.key();
  const next = async (tag) => {
    const r = await s.get("/api/projects");
    assert.equal(r.status, 200, `${tag}: the next request`);
  };
  // another writer holds the lock
  const held = running(t, box);
  const holder = await holdWriter(t, box.home, held.id);
  let before = stateOf(held);
  let r = await ctl(s, held.id, { action: "pause" }, { key });
  assert.equal(r.status, 409);
  assert.deepStrictEqual(
    r.json,
    fail("Команда не выполнена, повторите через несколько секунд"),
  );
  assert.deepStrictEqual(stateOf(held), before);
  await holder.kill();
  await next("busy");
  // EIO on the write of PROJECT_PAUSED
  const disk = running(t, box);
  before = sha256(fs.readFileSync(disk.events));
  let faults = installFaults([
    { fn: "writeSync", paths: [disk.events], effect: "throw", code: "EIO" },
  ]);
  try {
    r = await ctl(s, disk.id, { action: "pause" }, { key });
  } finally {
    faults.restore();
  }
  assert.deepStrictEqual(faults.fired(), [true]);
  assert.equal(r.status, 500, r.text);
  assert.deepStrictEqual(
    r.json,
    fail(
      "Диск не принимает записи: команда не выполнена. Освободите место и повторите",
    ),
  );
  assert.doesNotMatch(r.text, NO_STACK);
  assert.equal(sha256(fs.readFileSync(disk.events)), before);
  assert.deepStrictEqual(inboxFiles(disk), []);
  await next("EIO");
  // the write and its rollback fail: the event may be there
  const unsure = running(t, box);
  faults = installFaults([
    { fn: "fsyncSync", paths: [unsure.events], effect: "throw", code: "EIO" },
    {
      fn: "ftruncateSync",
      paths: [unsure.events],
      effect: "throw",
      code: "EIO",
    },
  ]);
  try {
    r = await ctl(s, unsure.id, { action: "pause" }, { key });
  } finally {
    faults.restore();
  }
  assert.deepStrictEqual(faults.fired(), [true, true]);
  assert.equal(r.status, 500, r.text);
  assert.deepStrictEqual(
    r.json,
    fail(
      "Диск не принимает записи: команда могла выполниться. Проверьте состояние проекта, прежде чем нажимать снова",
    ),
  );
  assert.doesNotMatch(r.text, NO_STACK);
  await next("rollback");
  // a damaged line in the middle of the journal
  const broken = running(t, box);
  const lines = fs.readFileSync(broken.events, "utf8").split("\n");
  lines[1] = "{испорчено";
  fs.writeFileSync(broken.events, lines.join("\n"));
  before = stateOf(broken);
  r = await ctl(s, broken.id, { action: "pause" }, { key });
  assert.equal(r.status, 500, r.text);
  assert.deepStrictEqual(
    r.json,
    fail("Данные проекта повреждены — проект нельзя показать"),
  );
  assert.deepStrictEqual(stateOf(broken), before);
  await next("corrupt");
  // no project
  r = await ctl(s, "p-20990101-a1b2c3", { action: "pause" }, { key });
  assert.equal(r.status, 404);
  assert.equal(r.text, NOT_FOUND_BODY);
  await next("not found");
});

// The rows of section 6.4 that do not read the project: [code, status, text].
const FAILURE_ROWS = [
  ["E_NOT_FOUND", 404, "Не найдено"],
  ["E_CORRUPT", 500, "Данные проекта повреждены — проект нельзя показать"],
  [
    "E_DISK",
    500,
    "Диск не принимает записи: команда не выполнена. Освободите место и повторите",
  ],
  [
    "E_PROJECT_BUSY",
    409,
    "Команда не выполнена, повторите через несколько секунд",
  ],
  [
    "E_CHANNEL_FULL",
    409,
    "Команда не выполнена, повторите через несколько секунд",
  ],
  [
    "E_CHANNEL_DROPPED",
    409,
    "Команда не выполнена, повторите через несколько секунд",
  ],
  [
    "E_ENGINE_STOPPING",
    409,
    "Проект сейчас останавливается, повторите через несколько секунд",
  ],
  [
    "E_CHANNEL_TIMEOUT",
    504,
    "Команда не подтверждена, проверьте состояние проекта через несколько секунд",
  ],
  [
    "E_CHANNEL_UNCONFIRMED",
    504,
    "Команда не подтверждена, проверьте состояние проекта через несколько секунд",
  ],
  [
    "E_CHANNEL_STALE",
    504,
    "Команда не подтверждена, проверьте состояние проекта через несколько секунд",
  ],
  [
    "E_CHANNEL",
    500,
    "Связь с работающим проектом недоступна. Перезапустите Sai Team",
  ],
  [
    "E_CHANNEL_BAD",
    500,
    "Связь с работающим проектом недоступна. Перезапустите Sai Team",
  ],
  ["E_USAGE", 400, "Запрос не понят. Обновите страницу"],
];

const STATE_CODES = [
  "E_PAUSE_STATE",
  "E_STOPPED",
  "E_FINISHED",
  "E_ALREADY_RUNNING",
  "E_NOT_STARTED",
  "E_OPEN_QUESTION",
  "E_BUDGET_NEEDED",
  "E_TRANSITION",
];

const BAIT = "сообщение ядра: pid 4242, /tmp/sai/p-1/inbox, E_SECRET_CODE";

test("CTL-7c (crit. 7; section 6.4) controlFailure: every code gives the status and the text of its row without a warning; the rows «state» read the project anew (stopped + E_PAUSE_STATE → «Проект уже остановлен», paused after a failure → «…из-за сбоя…», a state that allows the action again → «Команда не выполнена…»); the codes of the precheck → «Проект не продолжен: …»; E_INTERNAL, an unknown code and not a TeamError → 500 and exactly one warning; no message of the error, code or path in an answer", (t) => {
  const box = webSandbox(t);
  const st = Object.fromEntries(everyStatus(t, box));
  const recovered = pausedByRecovery(t, box);
  const body = (r) => JSON.stringify(r.body);
  const call = (id, action, err) => {
    const warned = [];
    const r = controlFailure(
      { home: box.home, warn: (l) => warned.push(l) },
      id,
      action,
      err,
    );
    assert.equal(body(r).includes("4242"), false);
    assert.doesNotMatch(body(r), /E_[A-Z]|\/tmp|inbox|pid/);
    return { r, warned };
  };
  for (const [code, status, text] of FAILURE_ROWS) {
    for (const action of ["pause", "resume", "stop"]) {
      const { r, warned } = call(
        st.running.id,
        action,
        new TeamError(code, BAIT),
      );
      assert.deepStrictEqual(r, { status, body: fail(text) }, code);
      assert.deepStrictEqual(warned, [], code);
    }
  }
  const unsure = call(
    st.running.id,
    "pause",
    new TeamError("E_DISK", BAIT, { rollback: "failed" }),
  );
  assert.deepStrictEqual(unsure.r, {
    status: 500,
    body: fail(
      "Диск не принимает записи: команда могла выполниться. Проверьте состояние проекта, прежде чем нажимать снова",
    ),
  });
  // the rows «state»: the text of the project read anew
  for (const code of STATE_CODES) {
    const stopped = call(st.stopped.id, "pause", new TeamError(code, BAIT));
    assert.deepStrictEqual(
      stopped.r,
      { status: 409, body: fail(T7.alreadyStopped) },
      code,
    );
    assert.deepStrictEqual(stopped.warned, [], code);
    const again = call(st.running.id, "pause", new TeamError(code, BAIT));
    assert.deepStrictEqual(
      again.r,
      {
        status: 409,
        body: fail("Команда не выполнена, повторите через несколько секунд"),
      },
      code,
    );
  }
  assert.deepStrictEqual(
    call(recovered.id, "pause", new TeamError("E_PAUSE_STATE", BAIT)).r,
    { status: 409, body: fail(T7.afterFailure) },
  );
  assert.deepStrictEqual(
    call(st.stopped.id, "resume", new TeamError("E_STOPPED", BAIT)).r,
    { status: 409, body: fail(STOPPED_TEXT) },
  );
  assert.deepStrictEqual(
    call(st.done.id, "stop", new TeamError("E_FINISHED", BAIT)).r,
    { status: 409, body: fail(T7.finished) },
  );
  // the read anew fails: by step 3 of section 6.1
  assert.deepStrictEqual(
    call("p-20990101-a1b2c3", "pause", new TeamError("E_PAUSE_STATE", BAIT)).r,
    { status: 404, body: fail("Не найдено") },
  );
  // the precheck of the engine «resume»
  for (const [code, why] of [
    ...Object.entries(WHY_NOT_STARTED).filter(([c]) => c !== "E_DISK"),
    ["E_EXECUTOR", WHY_OTHER],
    ["E_EXECUTOR_NOT_FOUND", WHY_OTHER],
  ]) {
    const { r, warned } = call(
      st.paused.id,
      "resume",
      new TeamError(code, BAIT),
    );
    assert.deepStrictEqual(
      r,
      { status: 409, body: fail(`Проект не продолжен: ${why}`) },
      code,
    );
    assert.deepStrictEqual(warned, [], code);
  }
  // the last row: exactly one line for stderr
  for (const err of [
    new TeamError("E_INTERNAL", BAIT),
    new TeamError("E_SOMETHING_NEW", BAIT),
    new Error(BAIT),
    "a string",
  ]) {
    const { r, warned } = call(st.running.id, "pause", err);
    assert.deepStrictEqual(r, {
      status: 500,
      body: fail("Что-то пошло не так. Повторите позже"),
    });
    assert.equal(warned.length, 1, String(err));
  }
});

// ---- criterion 8 ------------------------------------------------------------------------

test("CTL-8e (crit. 8 (д)) two tabs: «Пауза» from the first → «Отправлено», then from the second → 409 «Проект уже на паузе»; two at the same moment — one «Отправлено», the other a refusal; each time the journal has exactly one PROJECT_PAUSED", async (t) => {
  const box = webSandbox(t);
  const s = await startServer(t, box);
  const key = await s.key();
  const p = running(t, box);
  const first = await ctl(s, p.id, { action: "pause" }, { key });
  assert.equal(first.status, 200, first.text);
  const before = stateOf(p);
  const second = await ctl(s, p.id, { action: "pause" }, { key });
  assert.equal(second.status, 409);
  assert.deepStrictEqual(second.json, fail(T7.alreadyPaused));
  assert.deepStrictEqual(stateOf(p), before);
  assert.equal(journal(p).filter((e) => e.type === "PROJECT_PAUSED").length, 1);
  // at the same moment
  const q = running(t, box);
  const both = await Promise.all([
    ctl(s, q.id, { action: "pause" }, { key }),
    ctl(s, q.id, { action: "pause" }, { key }),
  ]);
  assert.deepStrictEqual(both.map((r) => r.status).sort(), [200, 409]);
  const refused = both.find((r) => r.status === 409).json.error_text;
  assert.ok(
    [
      T7.alreadyPaused,
      "Команда не выполнена, повторите через несколько секунд",
    ].includes(refused),
    refused,
  );
  assert.equal(journal(q).filter((e) => e.type === "PROJECT_PAUSED").length, 1);
});

test("CTL-8g (crit. 8; section 6.3, r1 L2) the engine of the server neither wrote the resumption nor refused within the wait ({ resumed: false, error: null, late: true }): 504 «Команда не подтверждена…», not «Отправлено»; the journal unchanged; resume of the engines called exactly once", async (t) => {
  const box = webSandbox(t);
  const p = pausedByUser(t, box);
  const engines = fakeEngines(undefined, {
    resume: { resumed: false, error: null, late: true },
  });
  const s = await startServer(t, box, { engines });
  const before = stateOf(p);
  const r = await ctl(s, p.id, { action: "resume" });
  assert.equal(r.status, 504, r.text);
  assert.deepStrictEqual(
    r.json,
    fail(
      "Команда не подтверждена, проверьте состояние проекта через несколько секунд",
    ),
  );
  assert.deepStrictEqual(stateOf(p), before);
  assert.deepStrictEqual(engines.resumes, [p.id]);
  assert.deepStrictEqual(engines.calls, []);
});

test("CTL-8 (section 6.1, step 2; decisions/0032, C5) one command per project at a time in this server: while «Продолжить» of a project waits for its engine, a second command of the same project is 409 «Команда не выполнена…» without a read or a write; a command of another project goes on", async (t) => {
  const box = webSandbox(t);
  const p = pausedByUser(t, box);
  const other = running(t, box);
  let release = () => {};
  const engines = fakeEngines();
  engines.resume = (id) => {
    engines.resumes.push(id);
    return new Promise((resolve) => {
      release = () => resolve({ resumed: true, error: null, late: false });
    });
  };
  const s = await startServer(t, box, { engines });
  const key = await s.key();
  const pending = ctl(s, p.id, { action: "resume" }, { key });
  await waitUntil(() => engines.resumes.length === 1, 5000);
  const before = stateOf(p);
  const busy = await ctl(s, p.id, STOP, { key });
  assert.equal(busy.status, 409);
  assert.deepStrictEqual(
    busy.json,
    fail("Команда не выполнена, повторите через несколько секунд"),
  );
  assert.deepStrictEqual(stateOf(p), before);
  const free = await ctl(s, other.id, { action: "pause" }, { key });
  assert.equal(free.status, 200, "another project is not held");
  release();
  const r = await pending;
  assert.equal(r.status, 200);
  // the set is emptied after the answer
  const after = await ctl(s, p.id, STOP, { key });
  assert.equal(after.status, 200, after.text);
});

// ---- criterion 9 --------------------------------------------------------------------------

const CODES = [...PROJECT_STATUS, ...TASK_STATUS, ...ROLE_CODES];
const EXTRA = ["resume", "pause", "stop", "ack", "inbox"];
const EXTRA_CYRILLIC = ["движок", "канал", "очеред", "замок"];

// The problems of a text of REQ-035: the helper of criterion 7 of REQ-011 and the
// words of criterion 9 of REQ-035.
function problems(text) {
  const out = [...technicalWords(text, CODES)];
  for (const w of EXTRA) {
    if (new RegExp(`(^|[^A-Za-z0-9_])${w}`, "i").test(text)) out.push(w);
  }
  for (const w of EXTRA_CYRILLIC) {
    if (text.toLowerCase().includes(w)) out.push(w);
  }
  return out;
}

function visibleText(html) {
  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const attrs = [];
  for (const m of body.matchAll(
    /\s(title|alt|placeholder|aria-label|label|value)="([^"]*)"/g,
  )) {
    attrs.push(m[2]);
  }
  body = body.replace(/<[^>]*>/g, " ");
  return [body, ...attrs].join(" ");
}

test("CTL-9 (crit. 9) every text of REQ-035 — the strings of texts.js, «Проект не продолжен» with every reason, every error_text/result_text/pause_text/stopped_text of the answers on projects in every status and of the refusals, the visible text of public/*.html — has no word of criterion 7 of REQ-011, no code, no %, no «процент» and none of resume, pause, stop, движок, канал, очередь, ack, замок, inbox; the buttons are exactly «Пауза», «Продолжить», «Остановить», «Не останавливать»", async (t) => {
  // the checker sees each word
  for (const bad of [
    "командой resume",
    "Pause",
    "stop",
    "движок занят",
    "канал недоступен",
    "очередь полна",
    "нет ack",
    "замок держит",
    "папка inbox",
    "50%",
    "статус paused",
  ]) {
    assert.notDeepStrictEqual(problems(bad), [], bad);
  }
  const texts = [
    ...Object.values(TEXT),
    ...[...Object.values(WHY_NOT_STARTED), WHY_OTHER].map(resumeFailed),
  ];
  // the answers on every status: GET and each action
  const box = webSandbox(t);
  const all = everyStatus(t, box);
  const s = await startServer(t, box, {
    engines: fakeEngines(undefined, {
      resume: { resumed: false, error: null, late: true },
    }),
  });
  for (const [, p] of all) {
    const page = (await s.get(`/api/projects/${p.id}`)).json;
    for (const k of ["pause_text", "stopped_text"])
      if (page[k] !== null) texts.push(page[k]);
    for (const b of [
      { action: "pause" },
      { action: "resume" },
      STOP,
      { action: "stop" },
    ]) {
      const r = await ctl(s, p.id, b);
      for (const k of ["error_text", "result_text"])
        if (typeof r.json[k] === "string") texts.push(r.json[k]);
    }
  }
  for (const code of [...FAILURE_ROWS.map(([c]) => c), "E_INTERNAL"]) {
    const r = controlFailure(
      { home: box.home, warn: () => {} },
      all[0][1].id,
      "pause",
      new TeamError(code, "x"),
    );
    texts.push(r.body.error_text);
  }
  const html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  texts.push(visibleText(html));
  assert.ok(texts.length > 60, String(texts.length));
  for (const text of texts) assert.deepStrictEqual(problems(text), [], text);
  // the names of the buttons, in the markup of the page
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    fetch: () => ({ status: 200, body: { projects: [] } }),
  });
  const name = (id) => norm(page.byId(id).textContent);
  assert.deepStrictEqual(
    ["ctl-pause", "ctl-resume", "ctl-stop", "stop-no", "stop-yes"].map(name),
    ["Пауза", "Продолжить", "Остановить", "Не останавливать", "Остановить"],
  );
  for (const id of [
    "ctl-pause",
    "ctl-resume",
    "ctl-stop",
    "stop-no",
    "stop-yes",
  ])
    assert.equal(page.byId(id).getAttribute("type"), "button", id);
});

// ---- criteria 11, 12, 13 ------------------------------------------------------------------

function decision0030() {
  const dir = path.join(REPO_ROOT, "decisions");
  const name = fs.readdirSync(dir).find((n) => n.startsWith("0030-"));
  assert.ok(name, "decisions/0030-*.md");
  return fs.readFileSync(path.join(dir, name), "utf8");
}

test("CTL-11 (crit. 11) the decision before the code: decisions/0030 names tools/src/web/engines.js, resume and 0025, and its row in decisions/README.md says «Принято»; engines.js launches the engine of a paused project in the mode resume", () => {
  const d = decision0030();
  assert.ok(d.includes("tools/src/web/engines.js"));
  assert.ok(/resume/.test(d));
  assert.ok(/0025/.test(d));
  const readme = fs.readFileSync(
    path.join(REPO_ROOT, "decisions", "README.md"),
    "utf8",
  );
  const row = readme.split("\n").find((l) => l.includes("0030"));
  assert.ok(row && row.includes("Принято"), row);
  const engines = fs.readFileSync(path.join(WEB_SRC, "engines.js"), "utf8");
  const lines = engines.split("\n").filter((l) => /resume/.test(l));
  assert.ok(lines.length >= 1);
  assert.ok(
    lines.some((l) => /launch\(id, "resume"\)/.test(l)),
    "the engine is made in the mode resume",
  );
  assert.ok(/create\(id, \{ home, env, mode \}\)/.test(engines));
});

test("CTL-12 (crit. 12) the stop cannot be undone: grep -n 'нельзя отменить' decisions/0030-*.md finds a line; the text of the confirmation on the page has «Это нельзя отменить»", () => {
  assert.ok(decision0030().includes("нельзя отменить"));
  const page = loadPage({
    publicDir: PUBLIC_DIR,
    fetch: () => ({ status: 200, body: { projects: [] } }),
  });
  assert.equal(
    norm(page.byId("stop-confirm-text").textContent),
    "Остановить проект? Это нельзя отменить. Начатая работа прервётся, продолжить проект потом нельзя.",
  );
});

test("CTL-13 (crit. 13) tools/README.md, the section «## Sai Team — the interface»: the lines with «Продолжить», «irreversible», «Пауза», «Остановить» — at least 1 each, with resume — at least 2; the command npm run team -- resume stays; the files team-web-control*.test.js are in the run of npm test", () => {
  const readme = fs.readFileSync(path.join(TOOLS_DIR, "README.md"), "utf8");
  const section = [];
  let inside = false;
  for (const line of readme.split("\n")) {
    if (/^## Sai Team — the interface/.test(line)) {
      inside = true;
      continue;
    }
    if (/^## /.test(line)) inside = false;
    if (inside) section.push(line);
  }
  const count = (w) => section.filter((l) => l.includes(w)).length;
  for (const w of ["Продолжить", "irreversible", "Пауза", "Остановить"])
    assert.ok(count(w) >= 1, w);
  assert.ok(count("resume") >= 2, "resume");
  assert.ok(count("npm run team -- resume") >= 1);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(TOOLS_DIR, "package.json"), "utf8"),
  );
  assert.equal(pkg.scripts.test, 'node --test "test/**/*.test.js"');
  assert.match(pkg.scripts.check, /npm run test$/);
  const mine = fs
    .readdirSync(path.join(TOOLS_DIR, "test"))
    .filter((n) => /^team-web-control.*\.test\.js$/.test(n))
    .sort();
  assert.deepStrictEqual(mine, [
    "team-web-control-engine-3b.test.js",
    "team-web-control-engine-rest.test.js",
    "team-web-control-engine.test.js",
    "team-web-control-page.test.js",
    "team-web-control.test.js",
  ]);
});

// ---- ISS-0020: the line of a pause by the reason of the wait (CTL-14a…14g) ------------
// Design docs/design/ISS-0020-pause-text-for-waiting.md r2, section 9; contract r7,
// section 15.2. Fixtures — team-web-control-pause-kit.js (only the API of the core).

// The cases of CTL-14a: [name, build, the expected line (null — no line)].
const PAUSE_CASES = [
  [
    "(i) ждал по потолку, потолок не поднят",
    (t, box) => budgetPaused(t, box),
    LINE.budget,
  ],
  [
    "(ii) потолок поднят с запасом",
    (t, box) => budgetPaused(t, box, { raise: 10 }),
    LINE.budget,
  ],
  [
    "(ii′) RAISED-TINY",
    (t, box) => budgetPaused(t, box, { raise: 1.005 }),
    LINE.budget,
  ],
  ["(iii) plan_failed", (t, box) => planPaused(t, box), LINE.plan],
  [
    "(iii′) PLAN-SPENT",
    (t, box) => planPaused(t, box, { spent: true }),
    LINE.plan,
  ],
  ["(iv) goal_check_failed", (t, box) => goalPaused(t, box), LINE.goal],
  ["(iv′) GOAL-NO-RUN", (t, box) => goalNoRunPaused(t, box), LINE.goal],
  [
    "(v) вопрос по задаче",
    (t, box) => taskQuestionPaused(t, box),
    LINE.taskQuestion,
  ],
  [
    "(vi) вопрос по задаче при ожидании по потолку",
    (t, box) => taskQuestionBudgetPaused(t, box),
    LINE.taskQuestion,
  ],
  ["(vii) без ожидания", (t, box) => plainPaused(t, box), LINE.paused],
  [
    "(viii) approval без вопроса",
    (t, box) => approvalAnsweredPaused(t, box),
    LINE.paused,
  ],
  [
    "waiting_user по потолку (не пауза)",
    (t, box) => waitingBudget(t, box),
    null,
  ],
  ["running", (t, box) => running(t, box), null],
];

// What each fixture of CTL-14a is (guards the fixtures themselves).
const PAUSE_STATES = {
  "(i) ждал по потолку, потолок не поднят": ["paused", "budget", false],
  "(ii) потолок поднят с запасом": ["paused", "budget", false],
  "(ii′) RAISED-TINY": ["paused", "budget", false],
  "(iii) plan_failed": ["paused", "plan_failed", false],
  "(iii′) PLAN-SPENT": ["paused", "plan_failed", false],
  "(iv) goal_check_failed": ["paused", "goal_check_failed", false],
  "(iv′) GOAL-NO-RUN": ["paused", "goal_check_failed", false],
  "(v) вопрос по задаче": ["paused", "review_failed", true],
  "(vi) вопрос по задаче при ожидании по потолку": ["paused", "budget", true],
  "(vii) без ожидания": ["paused", null, false],
  "(viii) approval без вопроса": ["paused", "approval", false],
  "waiting_user по потолку (не пауза)": ["waiting_user", "budget", false],
  running: ["running", null, false],
};

test("CTL-14a (ISS-0020 К-1; crit. 1) GET of a paused project: the line of the pause by the reason of the wait — the ceiling (not raised, raised with a reserve, RAISED-TINY) → pausedBudget; plan_failed and PLAN-SPENT → pausedPlan; goal_check_failed and GOAL-NO-RUN → pausedGoalCheck; a question about a task (also while waiting for the ceiling) → pausedTaskQuestion; no wait and approval without a question → paused; waiting_user and running → null; the journal, the lock and inbox/ the same after GET", async (t) => {
  const box = webSandbox(t);
  const made = PAUSE_CASES.map(([name, build, line]) => [
    name,
    build(t, box),
    line,
  ]);
  const s = await startServer(t, box);
  for (const [name, p, line] of made) {
    const read = readOf(box, p.id);
    const [status, reason, question] = PAUSE_STATES[name];
    assert.equal(read.state.status, status, name);
    assert.equal(read.state.waiting?.reason ?? null, reason, name);
    assert.equal(taskQuestionOpen(read), question, name);
    const before = stateOf(p);
    const r = await s.get(`/api/projects/${p.id}`);
    assert.equal(r.status, 200, name);
    assert.equal(r.json.pause_text, line, name);
    assert.deepStrictEqual(stateOf(p), before, `${name}: GET writes nothing`);
  }
  assert.deepStrictEqual(s.engines.calls, []);
});

test("CTL-14b (ISS-0020 К-1, К-2; crit. 1, 7) property «the line does not promise an outcome» on the fixtures of CTL-14a, CTL-14g and every status: (а) a wait for the ceiling, the plan or the goal check without a question about a task — no «чтобы работа пошла дальше», no «Нажмите «Продолжить»», none of the whole words «запустит», «сразу», «пойдёт», «продолжит» (\\p{L} with the flag u, N1), but «снова спросит», and «запустить» only after «может»; (б) when «Продолжить» is refused, no «Нажмите «Продолжить»», and (д) the line says «не сработает»; (в) the line paused only without a wait of the three reasons and without a question about a task; (г) the fixtures of one reason that differ only by a raise or by the rest give one line", async (t) => {
  // the checker of whole words (N1): it finds the promises and does not find the
  // right texts
  for (const bad of [
    "план запустит заново",
    "Работа пойдёт дальше",
    "он сразу снова спросит",
    "проект продолжит работу",
    "Сразу спросит",
  ])
    assert.notDeepStrictEqual(promiseWords(bad), [], bad);
  for (const good of [
    "«Продолжить» может запустить новую работу",
    "Нажмите «Продолжить»",
    "сразуже",
    "запустить",
  ])
    assert.deepStrictEqual(promiseWords(good), [], good);
  assert.equal(
    /\bзапустит\b/.test("план запустит заново"),
    false,
    "\\b of JS does not see Cyrillic: it is not used",
  );

  const box = webSandbox(t);
  const made = [
    ...PAUSE_CASES.map(([name, build]) => [name, build(t, box)]),
    ...OUTCOME_CASES.map(([name, build]) => [name, build(t, box)]),
    ...everyStatus(t, box).map(([status, p]) => [`status ${status}`, p]),
    ["paused by recovery", pausedByRecovery(t, box)],
    ["paused by recovery with a question", recoveryWithQuestion(t, box)],
  ];
  const s = await startServer(t, box);
  const lines = new Map();
  let promised = 0;
  let refused = 0;
  for (const [name, p] of made) {
    const read = readOf(box, p.id);
    const line = (await s.get(`/api/projects/${p.id}`)).json.pause_text;
    lines.set(name, line);
    const paused = read.state.status === "paused";
    assert.equal(line === null, !paused, `${name}: a line only when paused`);
    if (!paused) continue;
    const reason = read.state.waiting?.reason ?? null;
    const question = taskQuestionOpen(read);
    const three = ["budget", "plan_failed", "goal_check_failed"].includes(
      reason,
    );
    // (а)
    if (three && !question) {
      promised += 1;
      assert.equal(line.includes("чтобы работа пошла дальше"), false, name);
      assert.equal(line.includes("Нажмите «Продолжить»"), false, name);
      assert.deepStrictEqual(promiseWords(line), [], name);
      assert.ok(line.includes("снова спросит"), `${name}: «снова спросит»`);
      for (const m of line.matchAll(/запустить/gu))
        assert.equal(line.slice(m.index - 6, m.index), "может ", name);
    }
    // (б), (д)
    const refusal = controlRefusal("resume", read.state, read.events);
    if (typeof refusal === "string") {
      refused += 1;
      assert.equal(line.includes("Нажмите «Продолжить»"), false, name);
      assert.ok(
        line.includes("«Продолжить» не сработает"),
        `${name}: the line warns of the refusal`,
      );
    }
    // (в)
    if (line === LINE.paused) {
      assert.equal(three, false, name);
      assert.equal(question, false, name);
    }
  }
  assert.ok(promised >= 14, `cases of (а): ${promised}`);
  assert.ok(refused >= 3, `cases of (б): ${refused}`);
  // (г) one reason — one line, whatever the raise and the rest
  for (const group of [
    [
      "(i) ждал по потолку, потолок не поднят",
      "(ii) потолок поднят с запасом",
      "(ii′) RAISED-TINY",
      "BUDGET-NOT-RAISED",
      "RAISED-TINY",
      "RAISED-AMPLE",
    ],
    ["(iii) plan_failed", "(iii′) PLAN-SPENT", "PLAN0", "PLAN-SPENT"],
    [
      "(iv) goal_check_failed",
      "(iv′) GOAL-NO-RUN",
      "GOAL-AFTER-CHECK",
      "GOAL-SPENT",
      "GOAL-NO-RUN",
    ],
  ]) {
    const seen = new Set(group.map((name) => lines.get(name)));
    assert.equal(seen.size, 1, group.join(", "));
    assert.notEqual([...seen][0], LINE.paused, group[0]);
  }
});

test("CTL-14d (ISS-0020 К-2; crit. 7) a paused project with a question about a task: «Продолжить» → 409 «Проект ждёт вашего решения по задаче…»; the real pause of the core after a failure with a question open (a failed task, a second task in work with its run open, the writer reopened → paused_by recovery): «Пауза» → 409 «Проект уже на паузе», «Продолжить» → the refusal of the task; the real pause after a failure without a question (CTL-5b′) → «Проект уже на паузе: работа прервалась из-за сбоя…» as before; the journal, the lock and inbox/ unchanged after each; no engine called", async (t) => {
  const box = webSandbox(t);
  const question = taskQuestionPaused(t, box);
  const recq = recoveryWithQuestion(t, box);
  const rec = pausedByRecovery(t, box);
  assert.equal(taskQuestionOpen(readOf(box, rec.id)), false, "no question");
  // the pure rule of the server on the same states
  const r1 = readOf(box, recq.id);
  assert.equal(controlRefusal("pause", r1.state, r1.events), T7.alreadyPaused);
  const r2 = readOf(box, rec.id);
  assert.equal(controlRefusal("pause", r2.state, r2.events), T7.afterFailure);
  const engines = fakeEngines();
  const s = await startServer(t, box, { engines });
  const rows = [
    [
      "на паузе с вопросом по задаче, «Продолжить»",
      question,
      { action: "resume" },
      TASK_DECISION,
    ],
    [
      "на паузе с вопросом по задаче, «Пауза»",
      question,
      { action: "pause" },
      T7.alreadyPaused,
    ],
    [
      "пауза после сбоя с вопросом, «Пауза»",
      recq,
      { action: "pause" },
      T7.alreadyPaused,
    ],
    [
      "пауза после сбоя с вопросом, «Продолжить»",
      recq,
      { action: "resume" },
      TASK_DECISION,
    ],
    [
      "пауза после сбоя без вопроса, «Пауза»",
      rec,
      { action: "pause" },
      T7.afterFailure,
    ],
  ];
  for (const [name, p, body, text] of rows) {
    const before = stateOf(p);
    const r = await ctl(s, p.id, body);
    assert.equal(r.status, 409, `${name}: ${r.text}`);
    assert.deepStrictEqual(r.json, fail(text), name);
    assert.deepStrictEqual(stateOf(p), before, name);
    assert.deepStrictEqual(inboxFiles(p), [], `${name}: inbox/ empty`);
    assert.doesNotMatch(r.text, NO_STACK, name);
  }
  // the page of the paused project with a question still shows «Продолжить»
  const page = (await s.get(`/api/projects/${recq.id}`)).json;
  assert.equal(page.pause_text, LINE.taskQuestion);
  assert.equal(page.controls.resume, true);
  assert.deepStrictEqual(engines.calls, []);
  assert.deepStrictEqual(engines.resumes, []);
  assert.deepStrictEqual(s.warnings, []);
});

test("CTL-14e (ISS-0020 К-4; crit. 9) the texts of the pause — TEXT.paused, pausedBudget, pausedPlan, pausedGoalCheck, pausedTaskQuestion — and every pause_text of CTL-14a: no technical word, no code, no %, no «процент», none of resume, pause, stop, движок, канал, очередь, ack, замок, inbox; public/*.js have no Cyrillic; DISPLAY_KEYS of team-web-words.test.js is not cut", async (t) => {
  for (const key of [
    "paused",
    "pausedBudget",
    "pausedPlan",
    "pausedGoalCheck",
    "pausedTaskQuestion",
  ])
    assert.equal(typeof TEXT[key], "string", key);
  const texts = Object.entries(TEXT)
    .filter(([k]) => /^paused/.test(k))
    .map(([, v]) => v);
  const box = webSandbox(t);
  const made = PAUSE_CASES.map(([, build]) => build(t, box));
  const s = await startServer(t, box);
  for (const p of made) {
    const line = (await s.get(`/api/projects/${p.id}`)).json.pause_text;
    if (line !== null) texts.push(line);
  }
  assert.ok(texts.length >= 16, String(texts.length));
  for (const text of texts) {
    assert.deepStrictEqual(problems(text), [], text);
    assert.equal(text.includes("%"), false, text);
    assert.equal(/процент/iu.test(text), false, text);
  }
  for (const name of fs
    .readdirSync(PUBLIC_DIR)
    .filter((n) => n.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8");
    assert.equal(/\p{Script=Cyrillic}/u.test(src), false, name);
  }
  const words = fs.readFileSync(
    path.join(TOOLS_DIR, "test", "team-web-words.test.js"),
    "utf8",
  );
  const set = words.match(/const DISPLAY_KEYS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(set, "DISPLAY_KEYS");
  const keys = [...set[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  for (const k of [
    "status_text",
    "progress_text",
    "needs_decision_text",
    "test_executor_text",
    "problem_text",
    "pause_text",
    "stopped_text",
    "tail_text",
    "due_text",
    "waiting_text",
    "count_text",
    "note_text",
    "tasks_empty_text",
    "reason_text",
    "error_text",
    "result_text",
    "author_text",
    "role_title",
    "title",
    "description",
  ])
    assert.ok(keys.includes(k), k);
});

// The section «## Sai Team — интерфейс» of tools/README.md, as lines.
function readmeSection() {
  const readme = fs.readFileSync(path.join(TOOLS_DIR, "README.md"), "utf8");
  const section = [];
  let inside = false;
  for (const line of readme.split("\n")) {
    if (/^## Sai Team — the interface/.test(line)) {
      inside = true;
      continue;
    }
    if (/^## /.test(line)) inside = false;
    if (inside) section.push(line);
  }
  return section;
}

test("CTL-14f (ISS-0020 К-5; crit. 13) README, the section «## Sai Team — the interface», agrees with the texts of the pause: it has the words that were not there before the fix — «can start making», «is still not enough», «does not work while the question is without an answer», «the pause line says so in advance»; the paragraph about the pause of a waiting project says «does not close the question» (N2: the phrase is checked in that paragraph, the section had it before only elsewhere); the former words «a new paid run» and «asks you again» and the words of criterion 12 stay", () => {
  const section = readmeSection();
  const text = section.join("\n");
  for (const w of [
    "can start making",
    "is still not enough",
    "does not work while the question is without an answer",
    "the pause line says so in advance",
    "a new paid run",
    "asks you again",
  ])
    assert.ok(text.includes(w), w);
  const paragraph = section.filter((l) =>
    l.includes(
      "If a project was put on a pause while it waited for a decision",
    ),
  );
  assert.equal(
    paragraph.length,
    1,
    "the paragraph about the pause of a waiting project",
  );
  assert.ok(
    paragraph[0].includes("does not close the question"),
    "«does not close the question» in the paragraph",
  );
  const count = (w) => section.filter((l) => l.includes(w)).length;
  for (const w of ["Продолжить", "irreversible", "Пауза", "Остановить"])
    assert.ok(count(w) >= 1, w);
  assert.ok(count("resume") >= 2, "resume");
});

test("CTL-14g (ISS-0020 К-6; crit. 1, 7) the line is true at every outcome of «Продолжить» (Ф24–Ф26, N4): BUDGET-NOT-RAISED, RAISED-TINY, RAISED-AMPLE, PLAN0, PLAN-SPENT, GOAL-AFTER-CHECK, GOAL-SPENT, GOAL-NO-RUN — GET gives exactly the literal of its reason; on a second project made the same way the command resume of the core writes PROJECT_RESUMED (after command) and the schedule of the engine (nextActions) gives the class of the outcome — the project asks again (wait) or a paid run (plan, goal, work, review); the line allows that outcome: asks again → «снова спросит»; a run of the plan or the goal check → «может запустить»; a run after the ceiling → the condition «Если потолка по-прежнему не хватает»; no promise; both classes are seen", async (t) => {
  const box = webSandbox(t);
  const made = OUTCOME_CASES.map(([name, build, line, cls]) => [
    name,
    build(t, box),
    build(t, box),
    LINE[line],
    line,
    cls,
  ]);
  const s = await startServer(t, box);
  const classes = new Set();
  for (const [name, shown, copy, expected, reason, cls] of made) {
    const before = stateOf(shown);
    const line = (await s.get(`/api/projects/${shown.id}`)).json.pause_text;
    assert.equal(line, expected, name);
    assert.deepStrictEqual(stateOf(shown), before, name);
    const out = resumeOutcome(box, copy);
    assert.equal(out.cls, cls, `${name}: ${out.kinds.join(",")}`);
    classes.add(out.cls);
    assert.deepStrictEqual(promiseWords(line), [], name);
    assert.equal(line.includes("чтобы работа пошла дальше"), false, name);
    if (out.cls === "ask") assert.ok(line.includes("снова спросит"), name);
    else if (reason === "budget")
      assert.ok(line.includes("Если потолка по-прежнему не хватает"), name);
    else assert.ok(line.includes("может запустить"), name);
  }
  assert.deepStrictEqual([...classes].sort(), ["ask", "run"], "both outcomes");
});
