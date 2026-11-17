// The page of the virtual team in a real headless Chrome, with the scripted test
// executor only (REQ-107, criteria 1-7; docs/design/REQ-107-e2e-team-web.md, 4.1-4.4
// and 8; decisions/0113). Every test makes its own folder under the temporary root
// (the data folder, which the server makes itself, a copy of the trap and a copy of
// the scenario), starts its own server through the starter of the kit and its own
// browser, and shares nothing with another test. The starter is called in two
// helpers only, with options made by teamOptions and not changed: the trap copy is
// merged last into the environment of the server, and no other name than the retry
// pause can be given (decisions/0113, О5, О23). The refused starts and the recorded
// start pass a spawn that records and throws (rule R2-S). The variable of real runs
// is never given. The oracles: the words of the requirement and of the README, the
// words of the empty list as measured on the tag (О6) and the scenario files; the
// code of the page is never read. The page text is read as the visitor reads it:
// the innerText of shown elements; the plain-words rules are also applied to the
// source text (textContent) and to the lines (innerText not folded) of the
// refusals, where a stack line keeps its line start. The end facts of criterion 1
// are read in the body and again after the stand stopped. Every wait is for a fact,
// with a limit; a wait that proves that nothing was sent lasts WINDOW_FLOOR_MS at
// least. A red message names the place and holds names, counts, true or false and
// the texts of the page, never a value of the environment, the path of a system
// error or a listing of a folder. Run by `cd tools && npm run e2e -- team-web`.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  E2eError,
  makeTempDir,
  removeTempDir,
  startStand,
  tempRoot,
  withBrowser,
  withStand,
} from "./kit/index.js";

const LIMIT = { timeout: 90000 };
const TOOLS = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const FIXTURES = path.join(TOOLS, "test", "fixtures", "e2e");
const BASIC = path.join(TOOLS, "test", "fixtures", "team", "engine-basic.json");
const SLOW = path.join(FIXTURES, "team-slow.json");
const FAIL = path.join(FIXTURES, "team-fail.json");
const TRAP = path.join(FIXTURES, "claude-trap.js");
const TRAP_LIMIT_MS = 10000;
const PROJECT_ID = /^p-[0-9]{8}-[0-9a-f]+$/u;
// The shortest window of a proof that something is not sent: the wait for the
// page's next poll ends only when this time has passed as well, so a page that
// polls at once cannot end the window early (decisions/0114, Д2 and Д3 (b)).
const WINDOW_FLOOR_MS = 3000;

// The link line of the server (README "Sai Team — the interface").
const LINK = /^Sai Team: (http:\/\/127\.0\.0\.1:\d+\/)$/mu;
// The words of the empty list, measured on the tag (decisions/0113, О6).
const EMPTY_WORDS =
  "Проектов пока нет. Опишите цель одной фразой — и команда возьмётся за работу.";
// The words of the requirement and of the README.
const MARK = "тестовый исполнитель";
const HEADINGS = [
  "Что происходит",
  "Кто занимается",
  "Когда будет готово",
  "Есть ли проблема",
  "Нужно ли что-то от меня",
  "Результат",
];
const IN_WORK = "в работе";
const DONE = "выполнен";
const PAUSE = "Пауза";
const RESUME = "Продолжить";
const STOP = "Остановить";
const DONT_STOP = "Не останавливать";
const PAUSED_WORDS =
  "Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше";
const STOPPED_WORDS = "Проект остановлен. Продолжить его нельзя";
const FAILED_WORDS = "Попытка не удалась";
const CHAT_TEXT = "<b>привет</b> & «тест»";
// The four marks of criterion 6 and, beyond its letter, the shape of a code of
// tools/src/team/errors.js: E_ and a capital, not inside a longer word (О21), and
// the shape of a stack frame: a line "at <place>:<line>:<column>" or "at
// <place>:<line>", with or without its blanks and its closing bracket, which a line
// in its own block keeps when CSS drops its blanks (decisions/0114, Д4 and Д9 (b)).
const BAD = [
  /^\s+at /mu,
  /undefined/u,
  /\[object/u,
  /Error:/u,
  /(?<![A-Za-z0-9_])E_[A-Z][A-Z0-9_]*/u,
  /^[ \t]*at \S.*:\d+(?::\d+)?\)?[ \t]*$/mu,
];
// The only name a test may add to the environment of a server: the retry pause of
// the failure stand (README "Other settings"; decisions/0113, О5).
const EXTRA_NAMES = ["SAI_TEAM_RETRY_DELAY_MS"];
// The base list of the starter (README "Servers for the page specs").
const BASE_NAMES = [
  "PATH",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "TZ",
  "SystemRoot",
];
// The names the starter and teamOptions give the server beyond the base list.
const GIVEN_NAMES = [
  "HOME",
  "SAI_TEAM_CLAUDE_BIN",
  "SAI_TEAM_HOME",
  "USERPROFILE",
];
// The browser's own line for the missing /favicon.ico: once per start of the
// browser, at least one with two tabs (decisions/0113, О10).
const FAVICON = {
  kind: "browser-log",
  text: "Failed to load resource: the server responded with a status of 404 (Not Found)",
  path: "/favicon.ico",
};
// The browser's own line for an answer 500 of the list, on the server whose data
// folder cannot be made (design F27).
const LIST_500 = {
  kind: "browser-log",
  text: "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
  path: "/api/projects",
};

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function sameList(a, b) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

function cut(text, max = 120) {
  const value = String(text);
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// ---- the scenario files: the oracle of the counts and of the task text -----------

function scenarioOf(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function runOf(file, purpose) {
  const runs = scenarioOf(file).runs ?? [];
  const run = runs.find((one) => one?.match?.purpose === purpose);
  assert.ok(run !== undefined, `the ${purpose} run of ${path.basename(file)}`);
  return run;
}

function planTasks(file) {
  const tasks = runOf(file, "plan").result?.answer?.tasks;
  assert.ok(
    Array.isArray(tasks) && tasks.length > 0,
    `the plan run of ${path.basename(file)} has tasks`,
  );
  return tasks;
}

// ---- the folders of a test and the options of its server -------------------------

// folders made by testFolders; only these may reach a real start
const OWN_FOLDERS = new WeakSet();
// options made by teamOptions -> the folders they were made from
const MADE = new WeakMap();

// The folder of one test under the temporary root: a copy of the trap (its own
// folder, mode 0700) and a copy of the scenario, each checked against its source at
// once, and the data folder, which is not made (the server makes it).
function testFolders(scenario) {
  const root = makeTempDir("team-web");
  try {
    const trapDir = path.join(root, "trap");
    fs.mkdirSync(trapDir, { mode: 0o700 });
    const trap = path.join(trapDir, "claude-trap.js");
    fs.copyFileSync(TRAP, trap);
    assert.ok(sha256(trap) === sha256(TRAP), "the trap copy is exact");
    // a copy keeps the mode of its source; the copy is made executable by its name
    fs.chmodSync(trap, 0o700);
    const copy = path.join(root, "scenario.json");
    fs.copyFileSync(scenario, copy);
    assert.ok(sha256(copy) === sha256(scenario), "the scenario copy is exact");
    const folders = Object.freeze({
      root,
      data: path.join(root, "data"),
      trap,
      marker: path.join(trapDir, "started"),
      scenario: copy,
    });
    OWN_FOLDERS.add(folders);
    return folders;
  } catch (err) {
    removeTempDir(root);
    throw err;
  }
}

// A system error of Node (a reading of the disk or a start that failed: it has a
// syscall) is told by its call, its code and its place (the line of this file, or
// the place given), not by Node's message, which holds the path, here a temporary
// path of the test (ISS-0116, probe J01); any other error is thrown as it is.
function withoutPath(err, place = null) {
  const system =
    typeof err?.syscall === "string" && typeof err.code === "string";
  if (!system) return err;
  const at = String(err.stack).split(`${import.meta.url}:`)[1] ?? "";
  const line = /^\d+/u.exec(at)?.[0] ?? "?";
  const told = new Error(
    `a system error: ${err.syscall.split(" ")[0]} ${err.code}, ${place ?? `at line ${line} of the spec`}`,
  );
  if (err.cleanupError !== undefined) told.cleanupError = err.cleanupError;
  return told;
}

// Every test runs in its folders: made first, removed last, and a system error on
// the way is told without its path. The removal is told so as well; when the body
// failed too, the body's error is thrown and the removal's is attached to it as
// cleanupError, as the kit's withStand does (decisions/0114, Д7).
async function inFolders(scenario, body) {
  let folders;
  try {
    folders = testFolders(scenario);
  } catch (err) {
    throw withoutPath(err);
  }
  let value;
  let failed = false;
  let failure;
  try {
    value = await body(folders);
  } catch (err) {
    failed = true;
    failure = withoutPath(err);
  }
  try {
    removeTempDir(folders.root);
  } catch (err) {
    const removal = withoutPath(
      err,
      "at the removal of the folder of the test",
    );
    if (!failed) throw removal;
    if (failure !== null && typeof failure === "object") {
      try {
        // an earlier clean-up error of the body's error is kept on the removal's
        if (failure.cleanupError !== undefined) {
          removal.cleanupError = failure.cleanupError;
        }
        failure.cleanupError = removal;
      } catch {
        // a frozen body error is thrown without it
      }
    }
  }
  if (failed) throw failure;
  return value;
}

// The only source of the options of a server. `env` may name only EXTRA_NAMES;
// `data` replaces the data folder (the second server of `failure`). The trap is
// merged last, so no given name can replace it. The options are frozen and known
// by their object, so a spread at a call site is refused by the two helpers below.
function teamOptions(folders, { env = {}, data = folders.data } = {}) {
  for (const name of Object.keys(env)) {
    assert.ok(
      EXTRA_NAMES.includes(name),
      `teamOptions: ${name} may not be given`,
    );
  }
  const options = Object.freeze({
    name: "team",
    args: Object.freeze([
      "src/web/main.js",
      "--port",
      "0",
      "--executor",
      "scripted",
      "--scenario",
      folders.scenario,
    ]),
    readyPattern: LINK,
    stateEnv: Object.freeze({ SAI_TEAM_HOME: data }),
    env: Object.freeze({ ...env, SAI_TEAM_CLAUDE_BIN: folders.trap }),
  });
  MADE.set(options, folders);
  return options;
}

// A start needs options made by teamOptions and not changed; a real start (no
// injected spawn) also needs them made from the folders of the test itself.
function checkedOptions(options, deps) {
  assert.ok(
    MADE.has(options),
    "a stand takes its options from teamOptions, unchanged",
  );
  if (deps?.spawn === undefined) {
    assert.ok(
      OWN_FOLDERS.has(MADE.get(options)),
      "a real stand gets the trap copy and the scenario copy of its test",
    );
  }
  return options;
}

// a stand started by the two helpers below -> the folders of its options
const STARTED = new WeakMap();
// a stand -> the project folders its end check saw and their executors (endChecks)
const SEEN = new WeakMap();

// The two calls of the starter in this file. Each reads the end facts of criterion
// 1 again after its stand stopped (afterStop).
async function teamStand(options, deps) {
  const stand = await startStand(checkedOptions(options, deps), deps);
  STARTED.set(stand, MADE.get(options));
  return stand;
}

async function withTeam(options, body) {
  let started = null;
  const value = await withStand(checkedOptions(options, undefined), (stand) => {
    started = stand;
    STARTED.set(stand, MADE.get(options));
    return body(stand);
  });
  afterStop(started, "withTeam");
  return value;
}

// A start with a spawn that records and throws (rule R2-S) -> the code of the
// error it ended with; only the code, since a message of the kit can hold the
// refused path or value.
async function startCode(options, recorder) {
  assert.ok(typeof recorder === "function", "a recorded start has its spawn");
  try {
    await teamStand(options, { spawn: recorder });
  } catch (err) {
    return err instanceof E2eError ? err.code : "not an error of the kit";
  }
  return "no error";
}

// The stand is stopped whatever the body did; a body that passed needs the end of
// the server after SIGTERM to be code 0 (criterion 6) and the end facts of
// criterion 1 after the stop.
async function untilStopped(stand, body) {
  let failure = null;
  try {
    await body();
  } catch (err) {
    failure = err;
  }
  let end;
  try {
    end = await stand.stop();
  } catch (err) {
    if (failure === null) failure = err;
  }
  if (failure !== null) throw failure;
  assert.deepEqual(end, { code: 0, signal: null }, "SIGTERM ends the server");
  afterStop(stand, "untilStopped");
}

// ---- readings of the disk ----------------------------------------------------------

// the one reading of the trap's marker, used by the control and by the end check
function trapStarted(folders) {
  return fs.existsSync(folders.marker);
}

// Starts the copy of the trap as the executor would: by its own path, with PATH
// and a home folder of the test only. -> its exit code.
function runTrap(folders) {
  const home = path.join(folders.root, "trap-home");
  fs.mkdirSync(home, { mode: 0o700 });
  return new Promise((resolve, reject) => {
    const options = {
      cwd: folders.root,
      env: { PATH: process.env.PATH, HOME: home },
      stdio: ["ignore", "ignore", "ignore"],
    };
    // the home of the copy is a checked fact, before it starts: the folder of the
    // test made above, never the person's home (decisions/0113, О19)
    assert.ok(
      options.env.HOME === home,
      "the trap control gives the copy the home folder of the test",
    );
    const child = spawn(folders.trap, [], options);
    const limit = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // it ended already
      }
      reject(new Error(`the trap did not end in ${TRAP_LIMIT_MS} ms`));
    }, TRAP_LIMIT_MS);
    child.on("error", (err) => {
      clearTimeout(limit);
      // the check and the code only: Node's message of a failed start names the
      // copy by its path, a temporary path (ISS-0116, the note)
      reject(
        new Error(
          `the trap control: the copy did not start (${err.code ?? "error"})`,
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(limit);
      resolve(code);
    });
  });
}

// The project folders of a data folder, sorted; none when the folder does not
// exist or cannot be one.
function projectIds(data) {
  let names;
  try {
    names = fs.readdirSync(data);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return [];
    throw err;
  }
  return names.filter((name) => PROJECT_ID.test(name)).sort();
}

// The executor of each of the projects `ids` of a data folder, as "<id> <executor>":
// the one its journal was created with (its first line, PROJECT_CREATED), which the
// page marks (README: a project is claude-cli unless it is the test one). A missing
// journal or a first line that is not that event is told by words, never by its
// text.
function executorsOf(data, ids) {
  return ids.map((id) => {
    let text;
    try {
      text = fs.readFileSync(path.join(data, id, "events.jsonl"), "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return `${id} no journal`;
      throw err;
    }
    let first = null;
    try {
      first = JSON.parse(text.split("\n")[0]);
    } catch {
      // not a line of the journal: told below
    }
    const created =
      first?.type === "PROJECT_CREATED" &&
      typeof first.data?.executor === "string";
    return `${id} ${created ? first.data.executor : "not created by its journal"}`;
  });
}

function journalFile(folders, id) {
  return path.join(folders.data, id, "events.jsonl");
}

function journal(folders, id) {
  return fs
    .readFileSync(journalFile(folders, id), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));
}

function typesOf(folders, id) {
  return journal(folders, id).map((event) => event.type);
}

// The shape of an environment as spawn reads it (inherited names included): the
// wanted names that are there, and only a count of the others (no value).
function envShape(env, wanted) {
  const names = [];
  for (const name in env) names.push(name);
  return {
    plain: Object.getPrototypeOf(env) === Object.prototype,
    symbols: Object.getOwnPropertySymbols(env).length,
    names: names.filter((name) => wanted.includes(name)).sort(),
    others: names.filter((name) => !wanted.includes(name)).length,
  };
}

// the names of the kit's folders in the temporary root
function kitFolders() {
  return fs
    .readdirSync(tempRoot())
    .filter((name) => name.startsWith("sai-e2e-"))
    .sort();
}

// A plain sentence: not empty, and none of BAD. The message names the place and the
// pattern, not the text.
function assertPlain(text, what) {
  assert.ok(
    typeof text === "string" && text.trim() !== "",
    `${what}: a text that is not empty`,
  );
  for (const bad of BAD) assert.ok(!bad.test(text), `${what}: holds ${bad}`);
}

// A wait for a fact of this process (not of the page), with a limit.
async function until(fact, limitMs, what) {
  const deadline = performance.now() + limitMs;
  while (!fact()) {
    assert.ok(performance.now() < deadline, `waited ${limitMs} ms for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// ---- page code: an expression, or a function with its args -------------------------

const shown = (id) =>
  `(() => { const e = document.getElementById(${JSON.stringify(id)}); return e !== null && !e.hidden && e.getClientRects().length > 0; })()`;
// the text of a shown element as the visitor reads it, white space folded; else null
const textOf = (id) =>
  `(() => { const e = document.getElementById(${JSON.stringify(id)}); return e !== null && !e.hidden && e.getClientRects().length > 0 ? e.innerText.replace(/\\s+/g, " ").trim() : null; })()`;
// the texts of the shown elements of a selector, folded
const textsOf = (selector) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getClientRects().length > 0).map((e) => e.innerText.replace(/\\s+/g, " ").trim())`;
// The source text of an element, not folded (its textContent), else null; and the
// same for the shown elements of a selector. A folded text has no line start after
// its first character, so the stack mark of BAD is read here (criteria 5, 6).
const sourceOf = (id) =>
  `(() => { const e = document.getElementById(${JSON.stringify(id)}); return e === null ? null : e.textContent; })()`;
const sourcesOf = (selector) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getClientRects().length > 0).map((e) => e.textContent)`;
// The lines of a shown element as the visitor reads them (its innerText, not
// folded), else null; and the same for the shown elements of a selector. A line
// shown in its own block is a line here, while textContent joins the blocks with no
// break, so the stack-frame shape of BAD is read here (decisions/0114, Д4).
const linesOf = (id) =>
  `(() => { const e = document.getElementById(${JSON.stringify(id)}); return e !== null && !e.hidden && e.getClientRects().length > 0 ? e.innerText : null; })()`;
const linesOfAll = (selector) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getClientRects().length > 0).map((e) => e.innerText)`;
const STATUS = textOf("project-status");
const statusIs = (word) => `(${STATUS}) === ${JSON.stringify(word)}`;
const BUTTONS = `["ctl-pause", "ctl-resume", "ctl-stop"].map((id) => document.getElementById(id)).filter((e) => e !== null && !e.hidden && e.getClientRects().length > 0).map((e) => e.innerText.trim())`;
const HEADINGS_SHOWN = textsOf("#answers h3");
const ROWS = `[...document.querySelectorAll("#projects > li")].filter((e) => e.getClientRects().length > 0).length`;
const rowsAre = (n) => `(${ROWS}) === ${n}`;
const ROW_GOALS = textsOf("#projects > li .pcard-goal");
const MARKED_ROWS = `[...document.querySelectorAll("#projects > li")].filter((li) => li.getClientRects().length > 0 && [...li.querySelectorAll(".mark-test")].some((m) => m.getClientRects().length > 0 && m.innerText.trim() === ${JSON.stringify(MARK)})).length`;
const ON_PROJECT = `location.hash.startsWith("#/projects/")`;
const PHRASES = textsOf("#happening .phrase-text");

async function openList(page, stand) {
  const { status } = await page.goto(stand.url);
  assert.equal(status, 200, "the page answers 200");
}

// the main path of a person: a goal of one phrase and a ceiling of 1 dollar
async function createProject(page, goal) {
  await page.type("#goal", goal);
  await page.type("#budget", "1");
  await page.click("#create");
}

// Opens the project of a row of the list by a click (a goto that changes only the
// part after # fires no load event, design F24).
async function openRow(page, goal) {
  const at = await page.evaluate(
    `(goal) => [...document.querySelectorAll("#projects > li .pcard-goal")].findIndex((e) => e.innerText.trim() === goal) + 1`,
    [goal],
  );
  assert.ok(at > 0, `the row of «${goal}»`);
  await page.click(`#projects > li:nth-child(${at}) a.pcard`);
  await page.waitFor(ON_PROJECT, {
    timeoutMs: 5000,
    description: "the project address",
  });
}

// The end of every test whose server has a data folder: the trap was never started,
// and the rows with the mark equal the project folders on the disk (criterion 1;
// decisions/0113, О4).
async function endChecks(page, stand, folders) {
  assert.equal(trapStarted(folders), false, "the trap was never started");
  const ids = projectIds(folders.data);
  SEEN.set(stand, { ids, executors: executorsOf(folders.data, ids) });
  await openList(page, stand);
  if (ids.length === 0) {
    await page.waitFor(shown("projects-empty"), {
      timeoutMs: 10000,
      description: "the words of the empty list",
    });
  }
  await page.waitFor(rowsAre(ids.length), {
    timeoutMs: 10000,
    description: `${ids.length} rows`,
  });
  assert.equal(
    await page.evaluate(MARKED_ROWS),
    ids.length,
    "rows with the mark = project folders",
  );
}

// The end facts of criterion 1 read again after the stand stopped (ISS-0116, L1;
// decisions/0114, Д3 (a) and Д9 (a)): a server that starts its Claude program, makes
// a project folder or rewrites the executor of a project while it shuts down is
// seen here. The data folder is the one the server got; its project folders and
// the executor of each are those the end check saw against the rows with the mark,
// and none if no end check ran.
function afterStop(stand, where) {
  assert.ok(STARTED.has(stand), `${where}: a stand of this file`);
  assert.equal(
    trapStarted(STARTED.get(stand)),
    false,
    `the trap was never started, after the stop (${where})`,
  );
  const seen = SEEN.get(stand) ?? { ids: [], executors: [] };
  const data = stand.stateEnv.SAI_TEAM_HOME;
  const ids = projectIds(data);
  assert.ok(
    sameList(ids, seen.ids),
    `no project folder appeared after the end check, after the stop (${where})`,
  );
  assert.ok(
    sameList(executorsOf(data, ids), seen.executors),
    `the executor of every project is the one the end check saw, after the stop (${where})`,
  );
}

// ------------------------------------------------------------------ criterion 1

test("stand", LIMIT, async () => {
  await inFolders(BASIC, async (folders) => {
    // (a) the positive control of the trap: its copy, started as an executor would
    // start it, ends with 1 and leaves its marker; the marker is removed, so the
    // end check can see a start
    assert.equal(trapStarted(folders), false, "no marker before the control");
    assert.equal(await runTrap(folders), 1, "the trap ends with code 1");
    assert.equal(trapStarted(folders), true, "the trap leaves its marker");
    fs.rmSync(folders.marker);
    assert.equal(trapStarted(folders), false, "the marker is removed");

    // (b) refusals of rule P: a spawn that records and throws, never the real one
    const recorded = [];
    const recorder = (...call) => {
      recorded.push(call);
      throw new Error("recorded, not started");
    };
    const before = kitFolders();
    for (const [what, options] of [
      [
        "a data folder inside the repository",
        teamOptions(folders, { data: path.join(TOOLS, ".sai-team-e2e") }),
      ],
      [
        "the trap inside the repository",
        teamOptions({ ...folders, trap: TRAP }),
      ],
      [
        "the scenario inside the repository",
        teamOptions({ ...folders, scenario: BASIC }),
      ],
    ]) {
      assert.equal(
        await startCode(options, recorder),
        "PATH_REFUSED",
        `refused: ${what}`,
      );
    }
    assert.equal(recorded.length, 0, "no refused call reached the spawn");

    // (c) the recorded start of the options every test uses
    assert.equal(
      await startCode(teamOptions(folders), recorder),
      "STAND_START_FAILED",
      "the recorded start ends at the recorder",
    );
    assert.equal(recorded.length, 1, "the recorded start reached the spawn");
    const [program, args, opts] = recorded[0];
    assert.ok(program === process.execPath, "the program is this Node");
    const wantedArgs = teamOptions(folders).args;
    assert.equal(args.length, wantedArgs.length, "the number of arguments");
    for (let i = 0; i < args.length - 1; i += 1) {
      assert.equal(args[i], wantedArgs[i], `argument ${i + 1}`);
    }
    assert.ok(
      args.at(-1) === fs.realpathSync(folders.scenario),
      "the scenario argument is the real path of the scenario copy",
    );
    // the environment of the server: its shape first, then two values one by one
    const shape = envShape(opts.env, [...BASE_NAMES, ...GIVEN_NAMES]);
    assert.ok(shape.plain && shape.symbols === 0, "a plain environment");
    assert.equal(shape.others, 0, "no name beyond the base list and the given");
    assert.deepEqual(
      shape.names.filter((name) => !BASE_NAMES.includes(name)),
      GIVEN_NAMES,
      "the names beyond the base list",
    );
    assert.ok(shape.names.includes("PATH"), "PATH from the base list");
    assert.ok(
      opts.env.PATH === process.env.PATH,
      "PATH of the server: the PATH of the spec process",
    );
    assert.ok(!("SAI_TEAM_REAL_RUNS" in opts.env), "no real runs");
    assert.ok(
      opts.env.SAI_TEAM_CLAUDE_BIN === fs.realpathSync(folders.trap),
      "the Claude program of the server is the trap copy",
    );
    assert.ok(
      opts.env.SAI_TEAM_HOME ===
        path.join(fs.realpathSync(folders.root), "data"),
      "the data folder of the server is the test's own",
    );
    assert.ok(
      sameList(kitFolders(), before),
      "the refusals and the recorded start left no folder",
    );

    // (d) the stand: the link, nothing written at the start, the empty list in words
    await withTeam(teamOptions(folders), async (stand) => {
      assert.match(`Sai Team: ${stand.url}`, LINK);
      assert.equal(
        fs.existsSync(folders.data),
        false,
        "the start writes nothing",
      );
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        const page = await browser.newPage();
        await openList(page, stand);
        await page.waitFor(shown("projects-empty"), {
          timeoutMs: 10000,
          description: "the words of the empty list",
        });
        assert.equal(
          await page.evaluate(textOf("projects-empty")),
          EMPTY_WORDS,
          "the words of the empty list",
        );
        assert.equal(await page.evaluate(ROWS), 0, "no row");
        await endChecks(page, stand, folders);
      });
      assert.equal(
        fs.readdirSync(stand.homeDir).length,
        0,
        "the home folder of the stand holds nothing",
      );
    });
    assert.equal(trapStarted(folders), false, "the trap was never started");
  });
});

// ------------------------------------------------------------------ criterion 2

test("create", LIMIT, async () => {
  const goal = "Подготовить вымышленный план открытия пекарни на углу";
  await inFolders(BASIC, async (folders) => {
    await withTeam(teamOptions(folders), async (stand) => {
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        const page = await browser.newPage();
        await openList(page, stand);
        await page.waitFor(shown("projects-empty"), {
          timeoutMs: 10000,
          description: "the words of the empty list",
        });
        await createProject(page, goal);
        await page.waitFor(ON_PROJECT, {
          timeoutMs: 10000,
          description: "the project address after the create",
        });
        const ids = projectIds(folders.data);
        assert.equal(ids.length, 1, "one project folder");
        assert.equal(
          await page.evaluate("location.hash"),
          `#/projects/${ids[0]}`,
          "the id of the folder is in the address",
        );
        assert.ok(
          fs.existsSync(journalFile(folders, ids[0])),
          "the journal file of the project exists",
        );
        await page.waitFor(
          `(${HEADINGS_SHOWN}).length === ${HEADINGS.length}`,
          {
            timeoutMs: 10000,
            description: "the six headings",
          },
        );
        assert.deepEqual(
          await page.evaluate(HEADINGS_SHOWN),
          HEADINGS,
          "the six headings of the README, in order",
        );
        await openList(page, stand);
        await page.waitFor(rowsAre(1), {
          timeoutMs: 10000,
          description: "one row",
        });
        assert.deepEqual(
          await page.evaluate(ROW_GOALS),
          [goal],
          "the goal, verbatim",
        );
        assert.equal(
          await page.evaluate(MARKED_ROWS),
          1,
          "the row has the mark",
        );
        assert.equal(
          await page.evaluate(
            `document.querySelector("#projects > li a.pcard").getAttribute("href")`,
          ),
          `#/projects/${ids[0]}`,
          "the id of the folder is in the row link",
        );
        await page.reload();
        await page.waitFor(rowsAre(1), {
          timeoutMs: 10000,
          description: "one row after the reload",
        });
        assert.deepEqual(
          await page.evaluate(ROW_GOALS),
          [goal],
          "the goal after the reload",
        );
        await endChecks(page, stand, folders);
      });
    });
  });
});

// ------------------------------------------------------------------ criterion 3

test("finish", LIMIT, async () => {
  const goal = "Собрать вымышленную сводку для проверки конца работы";
  // M: the number of tasks of the plan, read from the scenario file
  const m = planTasks(BASIC).length;
  await inFolders(BASIC, async (folders) => {
    await withTeam(teamOptions(folders), async (stand) => {
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        const page = await browser.newPage();
        await openList(page, stand);
        await page.waitFor(shown("projects-empty"), {
          timeoutMs: 10000,
          description: "the words of the empty list",
        });
        await createProject(page, goal);
        await page.waitFor(ON_PROJECT, {
          timeoutMs: 10000,
          description: "the project address after the create",
        });
        await page.waitFor(statusIs(DONE), {
          timeoutMs: 60000,
          pollMs: 100,
          description: `the status «${DONE}»`,
        });
        assert.equal(
          await page.evaluate(textOf("project-progress")),
          `${m} из ${m} задач`,
          "the progress of a finished project",
        );
        assert.equal(
          await page.evaluate(shown("results-empty")),
          false,
          "«Результат» does not say it is empty",
        );
        const result = await page.evaluate(textOf("results"));
        assert.ok(
          typeof result === "string" && result !== "",
          "«Результат» is not empty",
        );
        assert.deepEqual(
          await page.evaluate(BUTTONS),
          [],
          "a finished project has no button",
        );
        assert.equal(
          await page.evaluate(shown("controls")),
          false,
          "a finished project has no control block",
        );
        const [id] = projectIds(folders.data);
        assert.equal(
          typesOf(folders, id).at(-1),
          "PROJECT_DONE",
          "the last event of the journal",
        );
        await endChecks(page, stand, folders);
      });
    });
  });
});

// ------------------------------------------------------------------ criterion 4

test("control", LIMIT, async () => {
  const goalA = "Вымышленная неспешная проверка паузы";
  const goalB = "Вымышленная неспешная проверка остановки";
  // In work for 10 s at least, by the file (design 4.2, rule 1): the delays of a
  // work run times the tasks of the plan, and the tasks a chain, so the delays add
  // up whatever number of tasks the engine runs at once.
  const tasks = planTasks(SLOW);
  const delay = (runOf(SLOW, "work").steps ?? []).reduce(
    (sum, step) => sum + (Number.isInteger(step?.delay_ms) ? step.delay_ms : 0),
    0,
  );
  assert.ok(
    delay * tasks.length >= 10000,
    "in work for 10 s at least (the file)",
  );
  for (let i = 1; i < tasks.length; i += 1) {
    assert.ok(
      Array.isArray(tasks[i].depends_on) &&
        sameList(tasks[i].depends_on, [tasks[i - 1].key]),
      `task ${i + 1} depends on the one before it`,
    );
  }
  await inFolders(SLOW, async (folders) => {
    await withTeam(teamOptions(folders), async (stand) => {
      await withBrowser(async (browser) => {
        // two tabs: at least one line, the second rests on the browser's cache
        browser.expect(FAVICON);
        const page = await browser.newPage();
        await openList(page, stand);
        await page.waitFor(shown("projects-empty"), {
          timeoutMs: 10000,
          description: "the words of the empty list",
        });

        // project A: pause and continue
        await createProject(page, goalA);
        await page.waitFor(ON_PROJECT, {
          timeoutMs: 10000,
          description: "the address of project A",
        });
        const [a] = projectIds(folders.data);
        await page.waitFor(statusIs(IN_WORK), {
          timeoutMs: 10000,
          description: `A: the status «${IN_WORK}»`,
        });
        assert.deepEqual(
          await page.evaluate(BUTTONS),
          [PAUSE, STOP],
          "A in work: «Пауза» and «Остановить», no «Продолжить»",
        );
        // criterion 3 beyond its letter (decisions/0113, О21): in work, the
        // progress reads N из M with M the tasks of the file and N smaller
        const progress = /^(\d+) из (\d+) задач$/u.exec(
          (await page.evaluate(textOf("project-progress"))) ?? "",
        );
        assert.ok(
          progress !== null,
          "A in work: the progress reads N из M задач",
        );
        assert.equal(
          Number(progress[2]),
          tasks.length,
          "M = the tasks of the plan",
        );
        assert.ok(
          Number(progress[1]) < Number(progress[2]),
          "N < M while in work",
        );
        await page.click("#ctl-pause");
        await page.waitFor(shown("project-pause"), {
          timeoutMs: 10000,
          description: "A: the pause line",
        });
        assert.equal(
          await page.evaluate(textOf("project-pause")),
          PAUSED_WORDS,
          "A: the pause phrase",
        );
        assert.deepEqual(
          await page.evaluate(BUTTONS),
          [RESUME, STOP],
          "A paused: «Продолжить» and «Остановить», no «Пауза»",
        );
        assert.equal(
          typesOf(folders, a).filter((type) => type === "PROJECT_PAUSED")
            .length,
          1,
          "A: the journal holds the pause event",
        );
        await page.click("#ctl-resume");
        await page.waitFor(
          `${statusIs(IN_WORK)} && !(${shown("project-pause")})`,
          {
            timeoutMs: 10000,
            description: `A: «${IN_WORK}» again, no pause line`,
          },
        );
        assert.deepEqual(
          await page.evaluate(BUTTONS),
          [PAUSE, STOP],
          "A in work again: «Пауза» and «Остановить»",
        );

        // project B: the confirmation, «Не останавливать», the stop
        await openList(page, stand);
        await page.waitFor(rowsAre(1), {
          timeoutMs: 10000,
          description: "the row of A",
        });
        await createProject(page, goalB);
        await page.waitFor(
          `${ON_PROJECT} && !location.hash.endsWith(${JSON.stringify(a)})`,
          { timeoutMs: 10000, description: "the address of project B" },
        );
        const b = projectIds(folders.data).find((id) => id !== a);
        assert.ok(b !== undefined, "the folder of project B");
        await page.waitFor(statusIs(IN_WORK), {
          timeoutMs: 10000,
          description: `B: the status «${IN_WORK}»`,
        });
        await page.click("#ctl-stop");
        await page.waitFor(shown("stop-confirm"), {
          timeoutMs: 5000,
          description: "B: the confirmation",
        });
        assert.equal(
          await page.evaluate(textOf("stop-no")),
          DONT_STOP,
          "B: the confirmation offers «Не останавливать»",
        );
        assert.equal(
          await page.evaluate(textOf("stop-yes")),
          STOP,
          "B: the confirmation offers «Остановить»",
        );
        // «Не останавливать» changes nothing, proved over a window (decisions/0113,
        // О12, О32): from its click until WINDOW_FLOOR_MS have passed and the
        // page's own next poll of B has come (decisions/0114, Д2), read from the
        // page's records of requests, the page sends no request but a GET (a stop
        // is a POST to the control of the project); then B's journal has no stop
        // event and the page still shows B in work with its buttons
        const recordsBefore = page.network().length;
        const sinceCancel = () => page.network().slice(recordsBefore);
        const pollOfB = `${stand.url}api/projects/${b}`;
        await page.click("#stop-no");
        const cancelAt = performance.now();
        await page.waitFor(`!(${shown("stop-confirm")})`, {
          timeoutMs: 5000,
          description: "B: the confirmation closed",
        });
        await until(
          () =>
            performance.now() - cancelAt >= WINDOW_FLOOR_MS &&
            sinceCancel().some((r) => r.method === "GET" && r.url === pollOfB),
          8000,
          `B: ${WINDOW_FLOOR_MS} ms and the page's next poll after «Не останавливать»`,
        );
        assert.equal(
          sinceCancel().filter((r) => r.method !== "GET").length,
          0,
          "B: «Не останавливать» sends no request but a GET",
        );
        assert.equal(
          typesOf(folders, b).includes("PROJECT_STOPPED"),
          false,
          "B: «Не останавливать» leaves no stop event",
        );
        assert.equal(
          await page.evaluate(STATUS),
          IN_WORK,
          "B: still in work after «Не останавливать»",
        );
        assert.deepEqual(
          await page.evaluate(BUTTONS),
          [PAUSE, STOP],
          "B: still «Пауза» and «Остановить» after «Не останавливать»",
        );
        await page.click("#ctl-stop");
        await page.waitFor(shown("stop-confirm"), {
          timeoutMs: 5000,
          description: "B: the confirmation again",
        });
        await page.click("#stop-yes");
        await page.waitFor(shown("project-stopped"), {
          timeoutMs: 15000,
          description: "B: the stop line",
        });
        assert.equal(
          await page.evaluate(textOf("project-stopped")),
          STOPPED_WORDS,
          "B: the stop phrase",
        );
        assert.deepEqual(
          await page.evaluate(BUTTONS),
          [],
          "B stopped: no button",
        );
        assert.equal(
          typesOf(folders, b).includes("PROJECT_STOPPED"),
          true,
          "B: the journal holds the stop event",
        );
        const tab = await browser.newPage();
        await tab.goto(`${stand.url}#/projects/${b}`);
        await tab.waitFor(shown("project-stopped"), {
          timeoutMs: 10000,
          description: "B in a new tab: the stop line",
        });
        assert.equal(
          await tab.evaluate(textOf("project-stopped")),
          STOPPED_WORDS,
          "B in a new tab: the stop phrase",
        );
        assert.deepEqual(
          await tab.evaluate(BUTTONS),
          [],
          "B in a new tab: no button",
        );

        // project A runs to its end
        await openList(page, stand);
        await page.waitFor(rowsAre(2), {
          timeoutMs: 10000,
          description: "the rows of A and B",
        });
        await openRow(page, goalA);
        await page.waitFor(statusIs(DONE), {
          timeoutMs: 60000,
          pollMs: 100,
          description: `A: the status «${DONE}»`,
        });
        const types = typesOf(folders, a);
        assert.ok(
          types.includes("PROJECT_PAUSED") &&
            types.indexOf("PROJECT_PAUSED") < types.indexOf("PROJECT_RESUMED"),
          "A: the pause event before the continue event",
        );
        assert.equal(types.at(-1), "PROJECT_DONE", "A: the last event");
        // in work for 10 s at least, read from A's journal (design 4.2, rule 2):
        // from the first TASK_STARTED to PROJECT_DONE
        const events = journal(folders, a);
        const started = events.find((event) => event.type === "TASK_STARTED");
        const done = events.findLast((event) => event.type === "PROJECT_DONE");
        assert.ok(
          started !== undefined && done !== undefined,
          "A: the journal has a started task and the end",
        );
        assert.ok(
          Date.parse(done.ts) - Date.parse(started.ts) >= 10000,
          "in work for 10 s at least (the journal)",
        );
        await endChecks(page, stand, folders);
      });
    });
  });
});

// ------------------------------------------------------------------ criterion 5

test("chat", LIMIT, async () => {
  const goal = "Вымышленная проверка чата команды";
  const MESSAGES = `[...document.querySelectorAll("#chat-list > li")].filter((e) => e.getClientRects().length > 0).length`;
  await inFolders(BASIC, async (folders) => {
    await withTeam(teamOptions(folders), async (stand) => {
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        const page = await browser.newPage();
        await openList(page, stand);
        await page.waitFor(shown("projects-empty"), {
          timeoutMs: 10000,
          description: "the words of the empty list",
        });
        await createProject(page, goal);
        await page.waitFor(ON_PROJECT, {
          timeoutMs: 10000,
          description: "the project address after the create",
        });
        const [id] = projectIds(folders.data);
        // a finished project: nothing but the chat writes its journal any more
        await page.waitFor(statusIs(DONE), {
          timeoutMs: 60000,
          pollMs: 100,
          description: `the status «${DONE}»`,
        });
        // the chat is ready: its form is shown and the page has its answer (the
        // words of an empty chat, or a row)
        await page.waitFor(
          `${shown("chat-form")} && (${shown("chat-empty")} || (${MESSAGES}) > 0)`,
          { timeoutMs: 10000, description: "the chat ready" },
        );
        const n0 = await page.evaluate(MESSAGES);
        await page.type("#chat-text", CHAT_TEXT);
        await page.click("#chat-send");
        await page.waitFor(`(${MESSAGES}) === ${n0 + 1}`, {
          timeoutMs: 10000,
          description: "the sent message in the list",
        });
        const texts = await page.evaluate(
          `[...document.querySelectorAll("#chat-list > li .msg-text")].filter((e) => e.getClientRects().length > 0).map((e) => e.innerText)`,
        );
        assert.equal(
          texts.at(-1),
          CHAT_TEXT,
          "the message, exactly as written",
        );
        assert.equal(
          await page.evaluate(
            `document.querySelectorAll("#chat-list .msg-text *, #chat-list b").length`,
          ),
          0,
          "no element is made from the text",
        );
        const chats = journal(folders, id).filter(
          (event) => event.type === "CHAT" && event.source === "USER",
        );
        assert.equal(chats.length, 1, "one message event from the person");
        assert.equal(chats[0].data?.text, CHAT_TEXT, "the text in the journal");

        // An empty message and a message of blanks: one snapshot, both tries, then
        // a window until WINDOW_FLOOR_MS have passed since the tries and the page's
        // own next poll of its chat has come (decisions/0113, О12; decisions/0114,
        // Д3 (b)).
        const file = journalFile(folders, id);
        const chatApi = `/api/projects/${id}/chat`;
        const pathOf = (url) => {
          try {
            return new URL(url).pathname;
          } catch {
            return "";
          }
        };
        const chatGets = () =>
          page
            .network()
            .filter((r) => r.method === "GET" && pathOf(r.url) === chatApi)
            .length;
        const posts = () =>
          page.network().filter((r) => r.method === "POST").length;
        assert.equal(
          await page.evaluate(`document.getElementById("chat-text").value`),
          "",
          "the page empties the field after a sent message",
        );
        const size = fs.statSync(file).size;
        const hash = sha256(file);
        const gets0 = chatGets();
        const posts0 = posts();
        let sent = 0;
        for (const typed of ["", "   "]) {
          // type focuses the field (and puts nothing in for ""): Ctrl+Enter goes to
          // the field, whose handler sends; then the button
          await page.type("#chat-text", typed);
          const disabled = await page.evaluate(
            `document.getElementById("chat-send").disabled`,
          );
          const before = posts();
          await page.press("Enter", { ctrl: true });
          await page.click("#chat-send");
          if (disabled) continue;
          // the control was not disabled: the server must refuse the try with a
          // plain sentence; its browser line is declared once for the test, since
          // a declaration claims every matching line
          if (sent === 0) {
            browser.expect({
              kind: "browser-log",
              text: "Failed to load resource: the server responded with a status of 400 (Bad Request)",
              path: chatApi,
            });
          }
          sent += 1;
          await page.waitFor(
            `document.getElementById("chat-result").getAttribute("data-tone") === "err"`,
            { timeoutMs: 10000, description: "the refusal of the try" },
          );
          assert.ok(posts() > before, "the try was sent");
          assertPlain(
            await page.evaluate(textOf("chat-result")),
            "the refusal of the chat",
          );
          assertPlain(
            await page.evaluate(sourceOf("chat-result")),
            "the source text of the refusal of the chat",
          );
          assertPlain(
            await page.evaluate(linesOf("chat-result")),
            "the lines of the refusal of the chat",
          );
        }
        const triesEnd = performance.now();
        await until(
          () =>
            performance.now() - triesEnd >= WINDOW_FLOOR_MS &&
            chatGets() > gets0,
          8000,
          `${WINDOW_FLOOR_MS} ms and the page's own next poll of its chat`,
        );
        if (sent === 0) {
          assert.equal(posts(), posts0, "the disabled control sent nothing");
        }
        assert.ok(
          fs.statSync(file).size === size && sha256(file) === hash,
          "the journal is unchanged: the same size and sha256",
        );
        await endChecks(page, stand, folders);
      });
    });
  });
});

// ------------------------------------------------------------------ criterion 6

test("failure", LIMIT, async () => {
  const goal = "Вымышленная проверка отказа задачи";
  const [task] = planTasks(FAIL);
  // (a) every attempt of the task fails; no pause between the attempts (О5)
  await inFolders(FAIL, async (folders) => {
    const stand = await teamStand(
      teamOptions(folders, { env: { SAI_TEAM_RETRY_DELAY_MS: "0" } }),
    );
    await untilStopped(stand, async () => {
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        const page = await browser.newPage();
        await openList(page, stand);
        await page.waitFor(shown("projects-empty"), {
          timeoutMs: 10000,
          description: "the words of the empty list",
        });
        await createProject(page, goal);
        await page.waitFor(ON_PROJECT, {
          timeoutMs: 10000,
          description: "the project address after the create",
        });
        const [first] = projectIds(folders.data);
        await page.waitFor(`(${textsOf("#failed > li")}).length > 0`, {
          timeoutMs: 20000,
          pollMs: 100,
          description: "a row of the failed task",
        });
        const phrases = await page.evaluate(PHRASES);
        assert.ok(
          phrases.some((phrase) => phrase.startsWith(FAILED_WORDS)),
          "«Попытка не удалась» among the phrases of «Что происходит»",
        );
        const problem = await page.evaluate(textOf("answer-problems"));
        assert.ok(
          typeof problem === "string" && problem.startsWith("Есть ли проблема"),
          "the answer «Есть ли проблема» is shown",
        );
        assert.ok(
          problem.includes(task.text),
          "«Есть ли проблема» names the task of the plan",
        );
        const [reason] = await page.evaluate(
          textsOf("#failed > li .frow-reason"),
        );
        assertPlain(reason, "the reason of the failed task");
        const [reasonSource] = await page.evaluate(
          sourcesOf("#failed > li .frow-reason"),
        );
        assertPlain(
          reasonSource,
          "the source text of the reason of the failed task",
        );
        const reasonLines = await page.evaluate(
          linesOfAll("#failed > li .frow-reason"),
        );
        assert.ok(
          reasonLines.length > 0,
          "the lines of the reason of the failed task: a shown row",
        );
        for (const lines of reasonLines) {
          assertPlain(lines, "the lines of the reason of the failed task");
        }
        assert.ok(
          problem.includes(reason),
          "«Есть ли проблема» gives the reason",
        );
        assertPlain(
          await page.evaluate("document.body.innerText"),
          "the text of the page",
        );
        assertPlain(
          await page.evaluate("document.body.textContent"),
          "the source text of the page",
        );
        await openList(page, stand);
        await page.waitFor(rowsAre(1), {
          timeoutMs: 10000,
          description: "the list still loads",
        });
        await createProject(page, "Вторая вымышленная проверка после отказа");
        await page.waitFor(
          `${ON_PROJECT} && !location.hash.endsWith(${JSON.stringify(first)})`,
          {
            timeoutMs: 10000,
            description: "the address of the second project",
          },
        );
        assert.equal(
          projectIds(folders.data).length,
          2,
          "a new project after the failure",
        );
        await endChecks(page, stand, folders);
      });
    });
  });

  // (b) a data folder that cannot be made: under a regular file
  await inFolders(BASIC, async (folders) => {
    const file = path.join(folders.root, "f");
    const bytes = "a regular file\n";
    fs.writeFileSync(file, bytes);
    const data = path.join(file, "home");
    const listing = fs.readdirSync(folders.root).sort();
    const stand = await teamStand(teamOptions(folders, { data }));
    await untilStopped(stand, async () => {
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        browser.expect(LIST_500);
        const page = await browser.newPage();
        await openList(page, stand);
        await createProject(page, "Вымышленная проверка недоступной папки");
        await page.waitFor(
          `document.getElementById("create-result").getAttribute("data-tone") === "err"`,
          { timeoutMs: 10000, description: "the refusal of the create" },
        );
        assertPlain(
          await page.evaluate(textOf("create-result")),
          "the refusal of the create",
        );
        assertPlain(
          await page.evaluate(sourceOf("create-result")),
          "the source text of the refusal of the create",
        );
        assertPlain(
          await page.evaluate(linesOf("create-result")),
          "the lines of the refusal of the create",
        );
        assert.equal(
          await page.evaluate("location.hash"),
          "",
          "the page stays on the list",
        );
        assert.equal(await page.evaluate(ROWS), 0, "no project in the list");
        assert.ok(
          sameList(fs.readdirSync(folders.root).sort(), listing),
          "no folder is made: the folder of the test lists the same names",
        );
        assert.ok(
          fs.lstatSync(file).isFile() &&
            fs.readFileSync(file, "utf8") === bytes,
          "the regular file keeps its bytes",
        );
        let code = null;
        try {
          fs.lstatSync(data);
        } catch (err) {
          code = err.code;
        }
        assert.equal(code, "ENOTDIR", "the data folder cannot be made");
        assert.ok(stand.isRunning(), "the server is alive");
        // the next request is answered
        await openList(page, stand);
        // the end of this server: the trap was never started, and no project
        // folder and no row with the mark
        assert.equal(trapStarted(folders), false, "the trap was never started");
        assert.equal(projectIds(data).length, 0, "no project folder");
        assert.equal(
          await page.evaluate(MARKED_ROWS),
          0,
          "rows with the mark = project folders",
        );
      });
    });
  });
});

// ------------------------------------------------------------------ criterion 7

test("windows", LIMIT, async () => {
  const goal = "Вымышленная проверка трёх окон";
  // "Inside the window" is what the person can see and reach of the create button in
  // that window (ISS-0116, L2; decisions/0114, Д8 and Д14), each part read on its own:
  // it lies sideways inside the window before any scroll (as picker.e2e.js reads
  // it); scrolled into view, the window did not move sideways, and no box the person
  // cannot scroll moved (a box whose computed overflow on that axis is neither auto
  // nor scroll, from the button's parent up to the body, and the window itself when
  // its overflow, from the root or else the body, is hidden or clip); the button is
  // wholly inside the window; and the element the window shows at its centre is the
  // button or a node inside it (not a box over it, a clip or a hidden button).
  const REACH = `(() => {
    const b = document.getElementById("create");
    const s = b.getBoundingClientRect();
    const boxes = [];
    for (let e = b.parentElement; e !== null && e !== document.documentElement; e = e.parentElement) boxes.push([e, e.scrollLeft, e.scrollTop]);
    const viewY = scrollY;
    b.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = b.getBoundingClientRect();
    const can = (v) => v === "auto" || v === "scroll";
    const boxMoved = boxes.some(([e, x, y]) => { const st = getComputedStyle(e); return (e.scrollLeft !== x && !can(st.overflowX)) || (e.scrollTop !== y && !can(st.overflowY)); });
    const root = getComputedStyle(document.documentElement).overflowY;
    const view = root === "visible" ? getComputedStyle(document.body).overflowY : root;
    const viewMoved = scrollY !== viewY && (view === "hidden" || view === "clip");
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      sideways: s.left >= 0 && s.right <= innerWidth,
      noSidewaysScroll: scrollX === 0,
      noHiddenScroll: !boxMoved && !viewMoved,
      inWindow: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      atCentre: hit !== null && b.contains(hit),
    };
  })()`;
  const REACH_PARTS = [
    ["sideways", "lies sideways inside the window before any scroll"],
    ["noSidewaysScroll", "is reached with no sideways scroll of the window"],
    [
      "noHiddenScroll",
      "is reached with no scroll of a box the person cannot scroll",
    ],
    ["inWindow", "is inside the window"],
    ["atCentre", "is what the window shows at its centre"],
  ];
  const noUnexpected = (browser, where) => {
    const unexpected = browser.unexpectedEntries();
    assert.equal(
      unexpected.length,
      0,
      `${where}: unexpected console entries: ${unexpected
        .slice(0, 5)
        .map((entry) => `${entry.kind}: ${cut(entry.text)}`)
        .join("; ")}`,
    );
  };
  await inFolders(BASIC, async (folders) => {
    await withTeam(teamOptions(folders), async (stand) => {
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        const page = await browser.newPage();
        await openList(page, stand);
        await page.waitFor(shown("projects-empty"), {
          timeoutMs: 10000,
          description: "the words of the empty list",
        });
        await createProject(page, goal);
        await page.waitFor(ON_PROJECT, {
          timeoutMs: 10000,
          description: "the project address after the create",
        });
        await page.waitFor(statusIs(DONE), {
          timeoutMs: 60000,
          pollMs: 100,
          description: `the status «${DONE}»`,
        });
        for (const [width, height] of [
          [1470, 784],
          [390, 844],
          [320, 568],
        ]) {
          const where = `${width}x${height}`;
          await page.setViewport(width, height);
          await openList(page, stand);
          await page.waitFor(rowsAre(1), {
            timeoutMs: 10000,
            description: `${where}: one row`,
          });
          const reach = await page.evaluate(REACH);
          for (const [part, what] of REACH_PARTS) {
            assert.equal(
              reach?.[part],
              true,
              `${where}: the create button ${what}`,
            );
          }
          noUnexpected(browser, `${where}, the list page`);
          await openRow(page, goal);
          await page.waitFor(statusIs(DONE), {
            timeoutMs: 10000,
            description: `${where}: the project page`,
          });
          noUnexpected(browser, `${where}, the project page`);
        }
        await endChecks(page, stand, folders);
      });
    });
  });
});
