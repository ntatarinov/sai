// E2S-01 ... E2S-20: the tests of the server starter of the end-to-end kit
// (tools/test/e2e/kit/stand.js, REQ-105, docs/design/REQ-105-e2e-picker.md, 4.1 and
// 11.1). No browser: the stand-in server tools/test/fixtures/e2e-stand/fake-stand.js
// prints the link and logs what happened to it (one JSON line per event), and
// E2S-17 starts the real picker server. The oracles are the design's numbers, codes
// and words and the stand-in's log, not the values the starter exports. Every test
// waits for a fact it can read, with a limit, never for a stretch of time; a process
// that a test learned from the log and that is still alive at the end of the test
// is killed by its pid, so a red run leaves nothing behind.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser } from "./e2e/kit/browser.js";
import { REGISTRY_VAR, liveRegistrations } from "./e2e/kit/cleanup.js";
import { E2eError, startStand, withStand } from "./e2e/kit/index.js";
import { runAll } from "./e2e/kit/runner.js";

const LIMIT = { timeout: 30000 };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, "..");
const KIT = path.join(HERE, "e2e", "kit");
const STAND_JS = path.join(KIT, "stand.js");
const INDEX_JS = path.join(KIT, "index.js");
const STAND_FIXTURES = path.join(HERE, "fixtures", "e2e-stand");
const FAKE_STAND = path.join(STAND_FIXTURES, "fake-stand.js");
const STAND_SPECS = path.join(STAND_FIXTURES, "specs");
const SLEEP_SPEC = path.join(STAND_SPECS, "sleep-stand.e2e.js");
const FAKE_CHROME = path.join(HERE, "fixtures", "e2e", "fake-chrome.js");
const KIT_URL = pathToFileURL(INDEX_JS).href;
// The link line of the stand-in and of the picker: group 1 is the address before /t/.
const LINK = /(http:\/\/127\.0\.0\.1:\d+)\/t\//u;
// The base list of the design (4.1, C-1): the only variables of the spec process
// that a stand gets, besides what the caller gives.
const BASE = [
  "PATH",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "TZ",
  "SystemRoot",
];
// Names that the platform adds to a child by itself, whatever the parent passes; the
// starter does not give them (README, decisions/0109), so they are not a leak:
// macOS adds __CF_USER_TEXT_ENCODING to every process, and Node passes
// NODE_V8_COVERAGE on to every child when the spec process has it.
const PLATFORM_NAMES = ["__CF_USER_TEXT_ENCODING", "NODE_V8_COVERAGE"];
// The kept text of each stream (4.1, step 5).
const KEPT = 65536;
const RANGE = "from 1 to 2147483647";

// Words that E2S-19 looks for are put together at run time, so that this file, which
// E2S-19 reads too, holds no forbidden string (design, section 3).
const SKIP_WORDS = [
  [".sk", "ip("].join(""),
  [".to", "do("].join(""),
  ["|", "| tr", "ue"].join(""),
  ["eslint", "-disable"].join(""),
];
const SKIP_OPTION = new RegExp(
  ["\\{\\s*(?:", "sk", "ip|", "to", "do)\\s*:"].join(""),
);
const SECRET_SHAPES = [
  new RegExp(["gh", "p_[A-Za-z0-9]{20,}"].join("")),
  new RegExp(["s", "k-[A-Za-z0-9]{20,}"].join("")),
  new RegExp(["BEGIN [A-Z ]*PRIV", "ATE KEY"].join("")),
];
const SANDBOX_FLAGS = [
  ["--no", "-sandbox"].join(""),
  ["--disable", "-setuid", "-sandbox"].join(""),
];

// A private temporary root for this file: every folder the kit makes lies under it,
// so the lists below are not disturbed by other test files running at the same time.
const OUTER_TMP = fs.realpathSync(os.tmpdir());
const MY_TMP = fs.realpathSync(
  fs.mkdtempSync(path.join(OUTER_TMP, "sai-stand-test-")),
);
process.env.TMPDIR = MY_TMP;
delete process.env[REGISTRY_VAR];
after(() => {
  fs.rmSync(MY_TMP, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 50,
  });
});

function scratch(label) {
  return fs.mkdtempSync(path.join(MY_TMP, `t-${label}-`));
}

function drop(dir) {
  fs.rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 50,
  });
}

// Polls `check` until it gives a true value, at most `ms`; fails with a message that
// names what was waited for.
async function until(check, ms, what) {
  const deadline = performance.now() + ms;
  for (;;) {
    const value = check();
    if (value) return value;
    if (performance.now() > deadline) {
      assert.fail(`${what} did not happen in ${ms} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// The value of `promise`, or LATE when it did not settle in `ms`.
const LATE = Symbol("late");
async function within(promise, ms) {
  let timer;
  const limit = new Promise((resolve) => {
    timer = setTimeout(() => resolve(LATE), ms);
  });
  try {
    return await Promise.race([promise, limit]);
  } finally {
    clearTimeout(timer);
  }
}

function pidGone(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (err) {
    return err.code === "ESRCH";
  }
}

function groupGone(pgid) {
  try {
    process.kill(-pgid, 0);
    return false;
  } catch (err) {
    return err.code === "ESRCH";
  }
}

// A killed process is dead later than the call that killed it, and a dead process
// that is not reaped yet still answers kill(pid, 0): so a test waits, with a limit,
// until the pid and its group answer ESRCH (ISS-0103), never one check.
async function waitGone(pid, what, ms = 5000) {
  return until(
    () => pidGone(pid) && groupGone(pid),
    ms,
    `${what}, pid ${pid} and its group, being gone,`,
  );
}

function sendSignal(target, name) {
  try {
    process.kill(target, name);
  } catch {
    // gone already
  }
}

function kitFolders() {
  return fs.readdirSync(MY_TMP).filter((name) => name.startsWith("sai-e2e-"));
}

function assertNothingRegistered() {
  const live = liveRegistrations();
  assert.deepEqual(live.groups, [], "a process group is still registered");
  assert.deepEqual(live.dirs, [], "a folder is still registered");
  assert.equal(live.hooks, 0, "a signal hook is still registered");
}

function readLog(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));
}

function eventsOf(file, name) {
  return readLog(file).filter((event) => event.event === name);
}

// The pid of the stand-in, from its first event (written before anything else).
function startPid(file) {
  const [start] = eventsOf(file, "start");
  assert.ok(
    start,
    `the stand-in wrote no start event to ${path.basename(file)}`,
  );
  return start.pid;
}

// Kills, by pid, every process of the stand-in that its log names and that is still
// alive: the leader with its group, then the child of "with-child".
function killFromLog(file) {
  for (const event of readLog(file)) {
    if (!Number.isInteger(event.pid) || event.pid < 2 || pidGone(event.pid)) {
      continue;
    }
    if (event.event === "start") sendSignal(-event.pid, "SIGKILL");
    sendSignal(event.pid, "SIGKILL");
  }
}

// The options of a start of the stand-in in `mode`, logging to `log`; `extra` adds
// options, and its env is added to the two variables of the stand-in.
function fakeOptions(mode, log, extra = {}) {
  const { env = {}, ...rest } = extra;
  return {
    name: "fake",
    args: [FAKE_STAND],
    readyPattern: LINK,
    env: { SAI_FAKE_STAND_MODE: mode, SAI_FAKE_STAND_LOG: log, ...env },
    ...rest,
  };
}

// -> the error a promise rejects with; fails when it fulfils. A start that should
// have failed and gave a stand has it stopped first, so nothing is left to the
// tests after this one.
async function failureOf(promise, what) {
  let value;
  try {
    value = await promise;
  } catch (err) {
    return err;
  }
  if (value !== null && typeof value?.stop === "function") {
    await value.stop().catch(() => {});
  }
  return assert.fail(`${what}: no error was thrown`);
}

function assertKitError(err, code, what) {
  assert.ok(err instanceof E2eError, `${what}: not the kit's error: ${err}`);
  assert.equal(err.code, code, `${what}: ${err.message}`);
}

// A spawn for deps.spawn that counts its calls and then does `behaviour`.
function countingSpawn(behaviour) {
  const calls = [];
  return {
    calls,
    spawn(file, args, options) {
      calls.push({ file, args, options });
      return behaviour(file, args, options);
    },
  };
}

function refusingSpawn() {
  const err = new Error("spawn refused by the test");
  err.code = "EACCES";
  throw err;
}

// A spawn for deps.spawn that gives the starter the real child, but passes the
// "exit" event of the main process on only when `ready()` is true or `ms` have gone
// by, polled every 10 ms: every step the starter takes after that end comes after
// the fact `ready()` waits for.
function spawnHoldingExit(ready, ms) {
  return (file, args, options) => {
    const child = spawn(file, args, options);
    const held = (listener) => (code, signal) => {
      const deadline = performance.now() + ms;
      const pass = () => {
        if (ready() || performance.now() > deadline) listener(code, signal);
        else setTimeout(pass, 10);
      };
      pass();
    };
    for (const method of ["on", "once", "addListener"]) {
      const original = child[method].bind(child);
      child[method] = (name, listener) =>
        original(name, name === "exit" ? held(listener) : listener);
    }
    return child;
  };
}

// A spawn for deps.spawn that gives the starter the real child, but hands it "exit"
// (code 0) and "close" as soon as the log `log` of the stand-in shows "term", polled
// every 5 ms, and never passes on the real ones. The starter then sends its final
// SIGKILL while the stand-in, a child of this process, is still in the group: this
// process reaps it only when its event loop turns, so the group is gone right after
// stop() only if stop() waited for it (decisions/0109, О18 as corrected after the
// second pass of the gate; the probe of that gate).
function spawnEndingAtTerm(log) {
  return (file, args, options) => {
    const child = spawn(file, args, options);
    const held = { exit: [], close: [] };
    const poll = setInterval(() => {
      if (eventsOf(log, "term").length === 0) return;
      clearInterval(poll);
      for (const listener of held.exit) listener(0, null);
      for (const listener of held.close) listener(0, null);
    }, 5);
    // the real end only stops the polling
    child.on("exit", () => clearInterval(poll));
    for (const method of ["on", "once", "addListener"]) {
      const original = child[method].bind(child);
      child[method] = (name, listener) => {
        if (name === "exit" || name === "close") {
          held[name].push(listener);
          return child;
        }
        return original(name, listener);
      };
    }
    return child;
  };
}

// A child of deps.spawn with no pid, so the starter has no group to register, to
// signal or to wait for. With pipes, its streams are real ones.
function fakeChild({ pipes }) {
  const child = new EventEmitter();
  child.pid = undefined;
  child.stdout = pipes ? new PassThrough() : null;
  child.stderr = pipes ? new PassThrough() : null;
  return child;
}

// Starts `node --input-type=module -e <source>` with the environment of this file
// (its temporary root, no list of the runner) and collects its output.
function startChild(source) {
  const env = { ...process.env };
  delete env[REGISTRY_VAR];
  delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const run = { child, stdout: "", stderr: "", ended: false };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (run.stdout += chunk));
  child.stderr.on("data", (chunk) => (run.stderr += chunk));
  run.closed = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      run.ended = true;
      resolve({ code, signal });
    });
  });
  return run;
}

// The source of a child that starts the stand-in through the kit (by its file URL),
// with the options `extra` added, and then runs `rest`.
function childSource(log, rest, extra = {}) {
  return [
    'import fs from "node:fs";',
    `import { startStand } from ${JSON.stringify(KIT_URL)};`,
    "const stand = await startStand({",
    '  name: "child",',
    `  args: [${JSON.stringify(FAKE_STAND)}],`,
    `  readyPattern: new RegExp(${JSON.stringify(LINK.source)}, "u"),`,
    `  env: { SAI_FAKE_STAND_MODE: "ok", SAI_FAKE_STAND_LOG: ${JSON.stringify(log)} },`,
    `  ...${JSON.stringify(extra)},`,
    "});",
    rest,
  ].join("\n");
}

// A child starts the stand-in with the options `extra`, stops it, prints what stop()
// gave and the line "stopped", and leaves its main code. The test waits for that line
// (20 s), then for the end of the child, at most 3000 ms: a timer of the starter that
// outlived its call would keep the child alive (a test process would wait for it
// too). -> what stop() gave in the child.
async function stopInChild(log, extra, what) {
  const run = startChild(
    childSource(
      log,
      'const stopped = await stand.stop();\nprocess.stdout.write(JSON.stringify(stopped) + "\\nstopped\\n");',
      extra,
    ),
  );
  try {
    await until(
      () => run.stdout.includes("stopped\n") || run.ended,
      20000,
      `${what}: the line stopped of the child`,
    );
    assert.ok(run.stdout.includes("stopped\n"), `${what}: ${run.stderr}`);
    const end = await within(run.closed, 3000);
    if (end === LATE) {
      sendSignal(run.child.pid, "SIGKILL");
      assert.fail(
        `${what}: the child was still alive 3000 ms after stopped: a timer of the starter outlived its call`,
      );
    }
    assert.deepEqual(end, { code: 0, signal: null }, what);
    assert.equal(run.stderr, "", `${what}: the stderr of the child`);
    return JSON.parse(run.stdout.split("\n")[0]);
  } finally {
    if (!run.ended) sendSignal(run.child.pid, "SIGKILL");
  }
}

// Stops a stand that a test started, whatever happened in the test, so that a test
// that fails half-way leaves no marker and no registration to the tests after it.
// stop() is one promise: a stand the test stopped itself is not signalled again, and
// the test has looked at its outcome already.
async function stopQuietly(stand) {
  if (stand) await stand.stop().catch(() => {});
}

function collector() {
  const parts = [];
  return {
    write: (text) => parts.push(text),
    text: () => parts.join(""),
  };
}

function importsOf(text) {
  const found = [];
  const fromRe = /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gmu;
  const bareRe = /^\s*import\s*["']([^"']+)["']/gmu;
  for (const m of text.matchAll(fromRe)) found.push(m[1]);
  for (const m of text.matchAll(bareRe)) found.push(m[1]);
  return found;
}

// The expression that tells a stack line (design 4.4, hasStack): a line that starts
// with blanks and "at ". Not \s, which also takes a newline and so crosses lines.
function hasStack(text) {
  return /^[ \t]+at /mu.test(text);
}

// ---------------------------------------------------------------- start and stop

test(
  "E2S-01 a stand starts, gives its loopback address and stops with code 0 (modes ok and ok-late)",
  LIMIT,
  async () => {
    for (const mode of ["ok", "ok-late"]) {
      const dir = scratch(mode);
      const log = path.join(dir, "log.jsonl");
      let stand = null;
      try {
        stand = await startStand(fakeOptions(mode, log));
        assert.equal(stand.name, "fake");
        assert.equal(stand.pid, startPid(log), `${mode}: pid`);
        assert.ok(Number.isInteger(stand.port), `${mode}: port`);
        assert.ok(stand.port >= 1 && stand.port <= 65535, `${mode}: port`);
        // group 1 of the pattern is the address before /t/: the path is cut
        assert.equal(stand.url, `http://127.0.0.1:${stand.port}/`);
        assert.equal(stand.origin, `http://127.0.0.1:${stand.port}`);
        await until(
          () => stand.stdout().includes(`${stand.origin}/t/demo/\n`),
          5000,
          `${mode}: the whole link line`,
        );
        assert.deepEqual(stand.stateDirs, []);
        assert.equal(stand.isRunning(), true);
        assert.equal(stand.exitInfo(), null);
        const answer = await fetch(stand.url, {
          headers: { connection: "close" },
        });
        assert.equal(answer.status, 200);
        assert.equal(await answer.text(), "ok");
        // while it runs, its group is registered and its marker folder exists
        assert.deepEqual(liveRegistrations().groups, [stand.pid]);
        const markers = kitFolders();
        assert.equal(markers.length, 1, `${mode}: ${markers.join(",")}`);
        assert.match(markers[0], /^sai-e2e-profile-/u);

        assert.deepEqual(await stand.stop(), { code: 0, signal: null });
        // stop() resolves only once the group is gone (4.1): its own wait polled the
        // group and let the loop reap, so one check fits here (decisions/0108,
        // addendum of 2026-11-03); the bounded wait below stays
        assert.ok(groupGone(stand.pid), `${mode}: the group after stop()`);
        assert.equal(stand.isRunning(), false);
        assert.deepEqual(stand.exitInfo(), { code: 0, signal: null });
        assert.ok(await waitGone(stand.pid, `${mode}: the stand`));
        assert.deepEqual(kitFolders(), [], `${mode}: the marker folder`);
        assertNothingRegistered();
        assert.equal(eventsOf(log, "term").length, 1, `${mode}: one SIGTERM`);
      } finally {
        await stopQuietly(stand);
        killFromLog(log);
        drop(dir);
      }
    }
  },
);

test(
  "E2S-02 a wrong option is refused with USAGE before anything is made or started; the timeouts take 1 to 2147483647",
  LIMIT,
  async () => {
    const counter = countingSpawn(refusingSpawn);
    const deps = { spawn: counter.spawn };
    const base = {
      name: "fake",
      args: [FAKE_STAND],
      readyPattern: LINK,
    };
    const timeoutCases = [];
    for (const option of ["startTimeoutMs", "stopTimeoutMs"]) {
      for (const value of [0, -1, 1.5, NaN, Infinity, 2147483648, "1000"]) {
        timeoutCases.push([
          `${option} ${String(value)}`,
          { [option]: value },
          new RegExp(
            `^startStand: ${option} must be a whole number of milliseconds ${RANGE}$`,
            "u",
          ),
        ]);
      }
    }
    const nulMessage =
      /^startStand: env value of SAI_FAKE_GIVEN must be a string without NUL$/u;
    const cwdMessage =
      /^startStand: cwd must be a non-empty path without NUL$/u;
    const argsMessage = /args must be a non-empty list of strings without NUL/u;
    const nameMessage = /name must match/u;
    const cases = [
      ["a pattern that is a string", { readyPattern: "(x)" }, /readyPattern/u],
      ["a pattern with no group", { readyPattern: /x/u }, /exactly one/u],
      [
        "a pattern with two groups",
        { readyPattern: /(x)(y)/u },
        /exactly one/u,
      ],
      [
        "a pattern with the flag g",
        { readyPattern: /(x)/gu },
        /flags g and y/u,
      ],
      [
        "a pattern with the flag y",
        { readyPattern: /(x)/uy },
        /flags g and y/u,
      ],
      ["a name with a capital and a blank", { name: "Bad Name" }, nameMessage],
      ["an empty name", { name: "" }, nameMessage],
      ["a name of 25 characters", { name: "a".repeat(25) }, nameMessage],
      ["a name that is a number", { name: 5 }, nameMessage],
      ["no args", { args: [] }, argsMessage],
      ["args that are a string", { args: FAKE_STAND }, argsMessage],
      ["args with a number", { args: [FAKE_STAND, 1] }, argsMessage],
      ["args with a NUL", { args: [`${FAKE_STAND}\0`] }, argsMessage],
      [
        "an env value that is a number",
        { env: { SAI_FAKE_GIVEN: 1 } },
        nulMessage,
      ],
      [
        "an env value with a NUL",
        { env: { SAI_FAKE_GIVEN: "given-value-x\0y" } },
        nulMessage,
      ],
      ["an env that is a list", { env: [] }, /env must be an object/u],
      [
        "an env name that is not a variable name",
        { env: { "1BAD": "x" } },
        /env name "1BAD" is not a variable name/u,
      ],
      ["an empty cwd", { cwd: "" }, cwdMessage],
      ["a cwd with a NUL", { cwd: `${TOOLS}\0` }, cwdMessage],
      ["a cwd that is a number", { cwd: 5 }, cwdMessage],
      ["stateDirs that are a string", { stateDirs: MY_TMP }, /stateDirs/u],
      ...timeoutCases,
    ];
    for (const [what, patch, message] of cases) {
      const err = await failureOf(
        startStand({ ...base, ...patch }, deps),
        what,
      );
      assertKitError(err, "USAGE", what);
      assert.match(err.message, message, what);
      // the value of a variable is never put into a message
      assert.ok(!err.message.includes("given-value-x"), what);
    }
    for (const options of [null, [], "fake"]) {
      const err = await failureOf(startStand(options, deps), String(options));
      assertKitError(err, "USAGE", "options that are not an object");
      assert.match(err.message, /the options must be an object/u);
    }
    const badDeps = await failureOf(
      startStand(base, { spawn: "spawn" }),
      "a deps.spawn that is not a function",
    );
    assertKitError(badDeps, "USAGE", "deps.spawn");
    assert.match(badDeps.message, /deps\.spawn must be a function/u);
    assert.equal(counter.calls.length, 0, "a refused option started nothing");
    assert.deepEqual(kitFolders(), [], "a refused option made no folder");
    assertNothingRegistered();

    // the bounds of the timeouts are taken: the start goes on to the spawn
    const bounds = [
      { startTimeoutMs: 1 },
      { stopTimeoutMs: 1 },
      { startTimeoutMs: 2147483647 },
      { stopTimeoutMs: 2147483647 },
    ];
    for (const patch of bounds) {
      const what = JSON.stringify(patch);
      const before = counter.calls.length;
      const err = await failureOf(
        startStand({ ...base, ...patch }, deps),
        what,
      );
      assertKitError(err, "STAND_START_FAILED", what);
      assert.equal(counter.calls.length, before + 1, what);
    }
    assert.deepEqual(kitFolders(), []);
    assertNothingRegistered();

    // the longest timer Node keeps: a real stand starts and stops with both of them,
    // in a child process, so that a timer that stayed armed cannot hold this file
    const dir = scratch("bounds");
    const log = path.join(dir, "log.jsonl");
    try {
      const stopped = await stopInChild(
        log,
        { startTimeoutMs: 2147483647, stopTimeoutMs: 2147483647 },
        "the longest timers",
      );
      assert.deepEqual(stopped, { code: 0, signal: null });
      assert.ok(
        await waitGone(startPid(log), "the stand of the longest timers"),
      );
      assert.deepEqual(kitFolders(), []);
    } finally {
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-03 a state folder outside the temporary root is refused before the marker and the spawn; a good one is given as its real path",
  LIMIT,
  async () => {
    const counter = countingSpawn(refusingSpawn);
    const dir = scratch("state");
    const homeLink = path.join(dir, "home-link");
    fs.symlinkSync(os.homedir(), homeLink);
    const realState = path.join(dir, "real-state");
    fs.mkdirSync(realState);
    const log = path.join(dir, "log.jsonl");
    let stand = null;
    try {
      const refused = [
        ["the home folder", [os.homedir()]],
        ["a relative path", ["state-of-the-stand"]],
        ["a folder inside the repository", [path.join(TOOLS, "test")]],
        ["a link in the temporary root to the home folder", [homeLink]],
        ["a good folder and the home folder", [realState, os.homedir()]],
      ];
      for (const [what, stateDirs] of refused) {
        const err = await failureOf(
          startStand(fakeOptions("ok", log, { stateDirs }), {
            spawn: counter.spawn,
          }),
          what,
        );
        assertKitError(err, "PATH_REFUSED", what);
        assert.equal(counter.calls.length, 0, `${what}: started nothing`);
        assert.deepEqual(kitFolders(), [], `${what}: made no folder`);
      }
      assertNothingRegistered();

      // a link and a ".." under the root: the stand is given the real path
      const stateLink = path.join(dir, "state-link");
      fs.symlinkSync(realState, stateLink);
      const dotted = [dir, "real-state", "..", "real-state"].join(path.sep);
      stand = await startStand(
        fakeOptions("ok", log, { stateDirs: [stateLink, dotted] }),
      );
      const real = fs.realpathSync(realState);
      assert.deepEqual([...stand.stateDirs], [real, real]);
      assert.ok(Object.isFrozen(stand.stateDirs));
      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
      assert.ok(await waitGone(stand.pid, "the stand with a state folder"));
      assert.deepEqual(kitFolders(), []);
      assertNothingRegistered();
    } finally {
      await stopQuietly(stand);
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-04 a program that cannot be started fails at once with STAND_START_FAILED, with nothing registered and no folder",
  LIMIT,
  async () => {
    const dir = scratch("no-start");
    const log = path.join(dir, "log.jsonl");
    let stand = null;
    try {
      // a cwd that does not exist: the child has no pid and an error event comes
      const counter = countingSpawn((file, args, options) =>
        spawn(file, args, options),
      );
      const startedAt = performance.now();
      const err = await failureOf(
        startStand(
          fakeOptions("ok", log, { cwd: path.join(dir, "no-such-folder") }),
          { spawn: counter.spawn },
        ),
        "a missing cwd",
      );
      const took = performance.now() - startedAt;
      assertKitError(err, "STAND_START_FAILED", "a missing cwd");
      assert.equal(err.message, 'could not start "fake": ENOENT');
      assert.ok(took < 1000, `the start failed after ${Math.round(took)} ms`);
      assert.equal(counter.calls.length, 1);
      // an undefined pid registered by mistake would be an entry of the groups
      assertNothingRegistered();
      assert.deepEqual(kitFolders(), []);
      assert.deepEqual(readLog(log), [], "the stand-in never ran");

      // a spawn that throws at once (N19)
      const thrower = countingSpawn(refusingSpawn);
      const thrown = await failureOf(
        startStand(fakeOptions("ok", log), { spawn: thrower.spawn }),
        "a spawn that throws",
      );
      assertKitError(thrown, "STAND_START_FAILED", "a spawn that throws");
      assert.equal(thrown.message, 'could not start "fake": EACCES');
      assert.equal(thrower.calls.length, 1);
      assertNothingRegistered();
      assert.deepEqual(kitFolders(), []);

      // a child without pipes that ends by its error event, as Node gives it when
      // the descriptors run out (EMFILE): the kit's error, not a TypeError
      const pipeless = countingSpawn(() => {
        const child = fakeChild({ pipes: false });
        setImmediate(() => {
          const error = new Error("spawn EMFILE");
          error.code = "EMFILE";
          child.emit("error", error);
          child.emit("close", -24, null);
        });
        return child;
      });
      const noPipes = await failureOf(
        startStand(fakeOptions("ok", log), { spawn: pipeless.spawn }),
        "a child without pipes",
      );
      assertKitError(noPipes, "STAND_START_FAILED", "a child without pipes");
      assert.equal(noPipes.message, 'could not start "fake": EMFILE');
      assertNothingRegistered();
      assert.deepEqual(kitFolders(), []);

      // a second start works
      stand = await startStand(fakeOptions("ok", log));
      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
      assert.ok(await waitGone(stand.pid, "the second start"));
      assertNothingRegistered();
    } finally {
      await stopQuietly(stand);
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-05 the stand gets the base list and the given variables only, never the whole environment",
  LIMIT,
  async () => {
    const dir = scratch("env");
    const log = path.join(dir, "log.jsonl");
    const leaks = ["SAI_FAKE_LEAK", "HOME", "SAI_TEAM_REAL_RUNS"];
    const touched = [...leaks, "NODE_TEST_CONTEXT", "LANG"];
    const saved = new Map(touched.map((name) => [name, process.env[name]]));
    process.env.SAI_FAKE_LEAK = "leak";
    process.env.HOME = os.homedir();
    process.env.SAI_TEAM_REAL_RUNS = "1";
    // under node --test it is set already; alone, the test sets it itself
    process.env.NODE_TEST_CONTEXT =
      saved.get("NODE_TEST_CONTEXT") ?? "child-v8";
    process.env.LANG = "en_US.UTF-8";
    const given = {
      SAI_FAKE_STAND_MODE: "ok",
      SAI_FAKE_STAND_LOG: log,
      SAI_FAKE_GIVEN: "a given value",
      LANG: "C",
    };
    const counter = countingSpawn((file, args, options) =>
      spawn(file, args, options),
    );
    let stand;
    try {
      stand = await startStand(fakeOptions("ok", log, { env: given }), {
        spawn: counter.spawn,
      });
      // what the starter handed over: the base names it has, then the given ones
      const expected = {};
      for (const name of BASE) {
        if (typeof process.env[name] === "string") {
          expected[name] = process.env[name];
        }
      }
      Object.assign(expected, given);
      assert.equal(counter.calls.length, 1);
      assert.equal(counter.calls[0].file, process.execPath);
      assert.deepEqual(counter.calls[0].args, [FAKE_STAND]);
      assert.deepEqual(counter.calls[0].options.env, expected);
      assert.equal(
        counter.calls[0].options.env.LANG,
        "C",
        "a given base name wins",
      );

      // what the child has: no name outside the list, the given names, the platform's
      const [envEvent] = eventsOf(log, "env");
      assert.ok(envEvent, "the stand-in logged its environment");
      const allowed = new Set([...Object.keys(expected), ...PLATFORM_NAMES]);
      const foreign = envEvent.keys.filter((name) => !allowed.has(name));
      assert.deepEqual(foreign, [], `names the stand got: ${envEvent.keys}`);
      for (const name of [...leaks, "NODE_TEST_CONTEXT"]) {
        assert.ok(!envEvent.keys.includes(name), `${name} reached the stand`);
      }
      for (const name of Object.keys(expected)) {
        assert.ok(envEvent.keys.includes(name), `${name} did not reach it`);
      }
      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
      assert.ok(await waitGone(stand.pid, "the stand"));
      assertNothingRegistered();
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      await stopQuietly(stand);
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-06 a stand that ends before its link fails with STAND_START_EXITED, its code and its last stderr line, and leaves nothing",
  LIMIT,
  async () => {
    const dir = scratch("exit-early");
    const log = path.join(dir, "log.jsonl");
    const log2 = path.join(dir, "log2.jsonl");
    let stand = null;
    try {
      const err = await failureOf(
        startStand(fakeOptions("exit-early", log, { startTimeoutMs: 10000 })),
        "exit-early",
      );
      assertKitError(err, "STAND_START_EXITED", "exit-early");
      assert.equal(
        err.message,
        'fake exited before it printed its link (exit code 3). Last line of its stderr: "fake stand: cannot start, boom"',
      );
      const pid = startPid(log);
      assert.equal(err.details.pid, pid);
      assert.equal(err.details.exitCode, 3);
      assert.equal(err.details.signal, null);
      // a failed start rejects only once the group is gone (4.1, step 7); no await
      // since the rejection, one check after the kit's own wait (decisions/0108)
      assert.ok(groupGone(pid), "exit-early: the group after the failed start");
      assert.ok(await waitGone(pid, "the stand-in that exited"));
      assert.deepEqual(kitFolders(), []);
      assertNothingRegistered();

      // a child of deps.spawn that sends close and no exit: the end is unknown
      const closeOnly = countingSpawn(() => {
        const child = fakeChild({ pipes: true });
        let ended = 0;
        const onEnd = () => {
          ended += 1;
          if (ended === 2) child.emit("close", null, null);
        };
        child.stdout.on("end", onEnd);
        child.stderr.on("end", onEnd);
        setImmediate(() => {
          child.stdout.end("not the link\n");
          child.stderr.end("fake child: last words\n");
        });
        return child;
      });
      const unknown = await failureOf(
        startStand(fakeOptions("ok", log2), { spawn: closeOnly.spawn }),
        "a close with no exit",
      );
      assertKitError(unknown, "STAND_START_EXITED", "a close with no exit");
      assert.equal(
        unknown.message,
        'fake exited before it printed its link (exit code null). Last line of its stderr: "fake child: last words"',
      );
      assert.equal(unknown.details.exitCode, null);
      assert.equal(unknown.details.signal, null);
      assert.deepEqual(kitFolders(), []);
      assertNothingRegistered();

      // a second start works
      stand = await startStand(fakeOptions("ok", log2));
      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
      assert.ok(await waitGone(stand.pid, "the second start"));
      assertNothingRegistered();
    } finally {
      await stopQuietly(stand);
      killFromLog(log);
      killFromLog(log2);
      drop(dir);
    }
  },
);

test(
  "E2S-07 a stand that prints no link is killed at the start limit: STAND_START_TIMEOUT",
  LIMIT,
  async () => {
    const dir = scratch("hang");
    const log = path.join(dir, "log.jsonl");
    try {
      const err = await failureOf(
        startStand(fakeOptions("hang", log, { startTimeoutMs: 1500 })),
        "hang",
      );
      assertKitError(err, "STAND_START_TIMEOUT", "hang");
      assert.equal(
        err.message,
        "fake did not print its link in 1500 ms; it was killed",
      );
      const pid = startPid(log);
      assert.equal(err.details.pid, pid);
      // a failed start rejects only once the group is gone (4.1, step 7); no await
      // since the rejection, one check after the kit's own wait (decisions/0108)
      assert.ok(groupGone(pid), "hang: the group after the failed start");
      assert.ok(await waitGone(pid, "the stand-in that printed no link"));
      // it was killed, not asked to stop
      assert.equal(eventsOf(log, "term").length, 0);
      assert.deepEqual(kitFolders(), []);
      assertNothingRegistered();
    } finally {
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-08 a link that is not of 127.0.0.1, or a group that took no part in the match, is refused with URL_REFUSED and the stand is removed",
  LIMIT,
  async () => {
    const dir = scratch("link");
    try {
      const generic = /^(http:\/\/\S+?)\/t\//mu;
      const cases = [
        [
          "a foreign link",
          "foreign-link",
          generic,
          /"http:\/\/example\.com:1"/u,
        ],
        [
          "an optional group that took no part",
          "ok",
          /(no-such-text)?Fake stand ready\./u,
          /"\[undefined\]"/u,
        ],
        [
          "a group of the other alternative",
          "ok",
          /Fake stand ready\.|(never-printed)/u,
          /"\[undefined\]"/u,
        ],
      ];
      for (const [
        index,
        [what, mode, readyPattern, shown],
      ] of cases.entries()) {
        const log = path.join(dir, `case-${index}.jsonl`);
        try {
          const err = await failureOf(
            startStand(fakeOptions(mode, log, { readyPattern })),
            what,
          );
          assertKitError(err, "URL_REFUSED", what);
          assert.match(err.message, shown, what);
          // a failed start rejects only once the group is gone (4.1, step 7); no
          // await since the rejection, one check after the kit's own wait
          // (decisions/0108)
          assert.ok(
            groupGone(startPid(log)),
            `${what}: the group after the failed start`,
          );
          assert.ok(await waitGone(startPid(log), `${what}: the stand-in`));
          assert.deepEqual(kitFolders(), [], what);
          assertNothingRegistered();
        } finally {
          killFromLog(log);
        }
      }
      // the control: the same generic pattern takes a loopback link
      const log = path.join(dir, "control.jsonl");
      let stand = null;
      try {
        stand = await startStand(
          fakeOptions("ok", log, { readyPattern: generic }),
        );
        assert.equal(stand.url, `http://127.0.0.1:${stand.port}/`);
        assert.deepEqual(await stand.stop(), { code: 0, signal: null });
        assert.ok(await waitGone(stand.pid, "the control stand"));
      } finally {
        await stopQuietly(stand);
        killFromLog(log);
      }
    } finally {
      drop(dir);
    }
  },
);

test(
  "E2S-09 a stand that ends with code 1 after SIGTERM fails stop() with STAND_EXIT and is removed",
  LIMIT,
  async () => {
    const dir = scratch("exit-one");
    const log = path.join(dir, "log.jsonl");
    let stand = null;
    try {
      stand = await startStand(fakeOptions("exit-one", log));
      const err = await failureOf(stand.stop(), "exit-one");
      assertKitError(err, "STAND_EXIT", "exit-one");
      assert.equal(
        err.message,
        'fake ended with exit code 1 after SIGTERM. Last line of its stderr: ""',
      );
      assert.equal(err.details.exitCode, 1);
      assert.equal(err.details.signal, null);
      assert.equal(stand.isRunning(), false);
      assert.deepEqual(stand.exitInfo(), { code: 1, signal: null });
      assert.equal(eventsOf(log, "term").length, 1);
      assert.ok(await waitGone(stand.pid, "the stand that ended with 1"));
      assert.deepEqual(kitFolders(), []);
      assertNothingRegistered();
    } finally {
      await stopQuietly(stand);
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-10 a stand that ignores SIGTERM is killed after the stop limit: STAND_STOP_TIMEOUT",
  LIMIT,
  async () => {
    const dir = scratch("ignore-term");
    const log = path.join(dir, "log.jsonl");
    let stand = null;
    try {
      stand = await startStand(
        fakeOptions("ignore-term", log, { stopTimeoutMs: 1500 }),
      );
      const startedAt = performance.now();
      const err = await failureOf(stand.stop(), "ignore-term");
      const took = performance.now() - startedAt;
      assertKitError(err, "STAND_STOP_TIMEOUT", "ignore-term");
      assert.equal(
        err.message,
        "fake did not stop in 1500 ms after SIGTERM; it was killed",
      );
      // the wait was the configured one: not shorter, and bounded
      assert.ok(
        took >= 1400 && took <= 6000,
        `stop() took ${Math.round(took)} ms`,
      );
      assert.equal(eventsOf(log, "term").length, 1);
      assert.equal(stand.isRunning(), false);
      assert.deepEqual(stand.exitInfo(), { code: null, signal: "SIGKILL" });
      assert.ok(await waitGone(stand.pid, "the stand that ignored SIGTERM"));
      assert.deepEqual(kitFolders(), []);
      assertNothingRegistered();
    } finally {
      await stopQuietly(stand);
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-11 stop() is one promise and one SIGTERM; a stand that ended by itself fails stop() whatever its code",
  LIMIT,
  async () => {
    const dir = scratch("twice");
    const logs = ["ok", "die-later", "quit-later"].map((mode) =>
      path.join(dir, `${mode}.jsonl`),
    );
    const stands = [];
    try {
      const stand = await startStand(fakeOptions("ok", logs[0]));
      stands.push(stand);
      const first = stand.stop();
      const second = stand.stop();
      assert.equal(first, second, "two calls give the same promise");
      assert.deepEqual(await first, { code: 0, signal: null });
      assert.equal(stand.stop(), first, "a call after the end too");
      assert.equal(eventsOf(logs[0], "term").length, 1, "one SIGTERM");
      assert.ok(await waitGone(stand.pid, "the stand stopped twice"));

      // die-later ends with 5, quit-later with 0, both by themselves 300 ms after
      // the link: stop() must find them ended, so the test waits for that fact first
      const own = [
        ["die-later", logs[1], 5],
        ["quit-later", logs[2], 0],
      ];
      for (const [mode, log, code] of own) {
        const ended = await startStand(fakeOptions(mode, log));
        stands.push(ended);
        await until(
          () => !ended.isRunning(),
          5000,
          `${mode}: the end of the stand`,
        );
        assert.deepEqual(ended.exitInfo(), { code, signal: null }, mode);
        const failure = ended.stop();
        const err = await failureOf(failure, mode);
        assertKitError(err, "STAND_EXIT", mode);
        assert.equal(
          err.message,
          `fake ended with exit code ${code} on its own. Last line of its stderr: ""`,
          mode,
        );
        assert.equal(ended.stop(), failure, `${mode}: the same promise`);
        assert.equal(await failureOf(ended.stop(), mode), err, mode);
        assert.equal(eventsOf(log, "term").length, 0, `${mode}: no SIGTERM`);
        assert.ok(await waitGone(ended.pid, `${mode}: the stand`));
        assert.deepEqual(kitFolders(), [], mode);
        assertNothingRegistered();
      }
    } finally {
      for (const stand of stands) await stopQuietly(stand);
      for (const log of logs) killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-12 a noisy stand is never blocked: both streams are read to the end and keep their last 65536 characters",
  LIMIT,
  async () => {
    const dir = scratch("noisy");
    const log = path.join(dir, "log.jsonl");
    let stand = null;
    try {
      stand = await startStand(fakeOptions("noisy", log));
      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
      for (const [label, text] of [
        ["stdout", stand.stdout()],
        ["stderr", stand.stderr()],
      ]) {
        // the stand-in wrote 512 chunks of 4096 characters, then the line END
        assert.equal(text.length, KEPT, `${label}: ${text.length} characters`);
        assert.ok(text.endsWith("\nEND\n"), `${label} ends with the line END`);
        assert.ok(!text.includes("Fake stand ready."), `${label} is the tail`);
      }
      assert.ok(await waitGone(stand.pid, "the noisy stand"));
      assertNothingRegistered();
    } finally {
      await stopQuietly(stand);
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-13 the group gets SIGTERM and then SIGKILL: a child that ignores SIGTERM is removed too",
  LIMIT,
  async () => {
    const dir = scratch("with-child");
    const log = path.join(dir, "log.jsonl");
    const ignoringLog = path.join(dir, "ignore-term.jsonl");
    let stand = null;
    let ignoring = null;
    try {
      // The starter sends SIGTERM to the group, waits for the end of the main process
      // and then sends SIGKILL to the group. Whether the child saw the SIGTERM is a
      // race with that SIGKILL (lost 29 times of 206 under load). So the starter
      // hears of the end of the main process only once the child has logged that it
      // saw SIGTERM, or after 5000 ms: the SIGKILL can only come later, never
      // earlier, and a SIGTERM to the main process alone still leaves no child-term.
      const sawTerm = () => eventsOf(log, "child-term").length > 0;
      // the link is printed only after the child has logged that it ignores SIGTERM
      stand = await startStand(fakeOptions("with-child", log), {
        spawn: spawnHoldingExit(sawTerm, 5000),
      });
      const children = eventsOf(log, "child");
      const ready = eventsOf(log, "child-ready");
      assert.equal(children.length, 1, "one child event");
      assert.equal(ready.length, 1, "one child-ready event");
      const childPid = children[0].pid;
      assert.equal(ready[0].pid, childPid);
      assert.notEqual(childPid, stand.pid);
      assert.equal(
        pidGone(childPid),
        false,
        "the child is alive before stop()",
      );

      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
      // stop() resolves only once the group, the child too, is gone (4.1); one
      // check after the kit's own wait (decisions/0108), the bounded waits stay
      assert.ok(groupGone(stand.pid), "the group after stop()");
      assert.ok(await waitGone(stand.pid, "the stand"));
      assert.ok(await waitGone(childPid, "the child that ignored SIGTERM"));
      // the signal went to the group: the child saw it before the SIGKILL (N18)
      assert.deepEqual(
        eventsOf(log, "child-term").map((event) => event.pid),
        [childPid],
      );
      assert.equal(eventsOf(log, "term").length, 1);
      assert.deepEqual(kitFolders(), []);
      assertNothingRegistered();

      // A second stand: the main process itself ignores SIGTERM (mode ignore-term),
      // and the starter hears of its end (code 0) as soon as it logged the SIGTERM,
      // never of the real end. At the final SIGKILL the group still holds it, and only
      // this process reaps it: so the check right after stop() fails without luck when
      // stop() does not wait for the group after its SIGKILL (the mutant V12).
      ignoring = await startStand(fakeOptions("ignore-term", ignoringLog), {
        spawn: spawnEndingAtTerm(ignoringLog),
      });
      assert.equal(
        pidGone(ignoring.pid),
        false,
        "ignore-term: the stand-in is alive before stop()",
      );
      assert.deepEqual(
        await ignoring.stop(),
        { code: 0, signal: null },
        "ignore-term: stop()",
      );
      assert.ok(groupGone(ignoring.pid), "ignore-term: the group after stop()");
      assert.ok(await waitGone(ignoring.pid, "ignore-term: the stand-in"));
      assert.equal(
        eventsOf(ignoringLog, "term").length,
        1,
        "ignore-term: one SIGTERM",
      );
      assert.deepEqual(kitFolders(), [], "ignore-term: the marker folder");
      assertNothingRegistered();
    } finally {
      await stopQuietly(stand);
      killFromLog(log);
      // a stand-in that ignores SIGTERM is alive until a SIGKILL, so a stop() not
      // called yet still ends; then the log names the process to kill by its pid
      await stopQuietly(ignoring);
      killFromLog(ignoringLog);
      drop(dir);
    }
  },
);

test(
  "E2S-14 no timer of the starter outlives its call: the process ends right after stop()",
  LIMIT,
  async () => {
    const dir = scratch("timers");
    const log = path.join(dir, "log.jsonl");
    try {
      // the default limits: 15000 ms for the start, 10000 ms for the stop
      const stopped = await stopInChild(log, {}, "the default timeouts");
      assert.deepEqual(stopped, { code: 0, signal: null });
      assert.ok(await waitGone(startPid(log), "the stand of the child"));
      assert.deepEqual(kitFolders(), []);
    } finally {
      killFromLog(log);
      drop(dir);
    }
  },
);

test(
  "E2S-15 withStand gives the value of its body, throws the body's own error, and always stops the stand",
  LIMIT,
  async () => {
    const dir = scratch("with-stand");
    const logOf = (label) => path.join(dir, `${label}.jsonl`);
    const labels = [
      "value",
      "body-error",
      "both-fail",
      "stop-fails",
      "self",
      "frozen",
      "null",
    ];
    let seen = null;
    const remember = (stand) => {
      seen = stand;
    };
    const assertStopped = async (what) => {
      assert.ok(seen, `${what}: the body ran`);
      assert.equal(seen.isRunning(), false, `${what}: the stand was stopped`);
      assert.ok(await waitGone(seen.pid, `${what}: the stand`));
      assert.deepEqual(kitFolders(), [], what);
      assertNothingRegistered();
      seen = null;
    };
    try {
      // the value of the body
      const value = await withStand(
        fakeOptions("ok", logOf("value")),
        (stand) => {
          remember(stand);
          assert.equal(stand.isRunning(), true);
          return "the value of the body";
        },
      );
      assert.equal(value, "the value of the body");
      await assertStopped("a good body");

      // a body error comes back as the same object, the stop that went well adds nothing
      const boom = new Error("the body failed on purpose");
      const bodyError = await failureOf(
        withStand(fakeOptions("ok", logOf("body-error")), (stand) => {
          remember(stand);
          throw boom;
        }),
        "a failing body",
      );
      assert.equal(bodyError, boom);
      assert.equal(Object.hasOwn(boom, "cleanupError"), false);
      await assertStopped("a failing body");

      // a failing body and a failing stop: the body error, with the stop error on it
      const both = new Error("the body failed, and so does the stop");
      const bothError = await failureOf(
        withStand(fakeOptions("exit-one", logOf("both-fail")), (stand) => {
          remember(stand);
          throw both;
        }),
        "a failing body and stop",
      );
      assert.equal(bothError, both);
      assertKitError(bothError.cleanupError, "STAND_EXIT", "the stop error");
      assert.match(
        bothError.cleanupError.message,
        /exit code 1 after SIGTERM/u,
      );
      await assertStopped("a failing body and stop");

      // a good body and a failing stop: the stop error
      const stopError = await failureOf(
        withStand(fakeOptions("exit-one", logOf("stop-fails")), (stand) => {
          remember(stand);
          return "never seen";
        }),
        "a failing stop",
      );
      assertKitError(stopError, "STAND_EXIT", "a failing stop");
      await assertStopped("a failing stop");

      // the body awaited the failing stop() itself: the same error, nothing attached to it
      const selfError = await failureOf(
        withStand(fakeOptions("exit-one", logOf("self")), async (stand) => {
          remember(stand);
          await stand.stop();
        }),
        "a body that stopped the stand",
      );
      assertKitError(selfError, "STAND_EXIT", "a body that stopped the stand");
      assert.equal(Object.hasOwn(selfError, "cleanupError"), false);
      await assertStopped("a body that stopped the stand");

      // a body error that cannot take a property is thrown unchanged, not a TypeError
      const frozen = Object.freeze(new Error("a frozen body error"));
      const frozenError = await failureOf(
        withStand(fakeOptions("exit-one", logOf("frozen")), (stand) => {
          remember(stand);
          throw frozen;
        }),
        "a frozen body error",
      );
      assert.equal(frozenError, frozen);
      assert.equal(Object.hasOwn(frozen, "cleanupError"), false);
      await assertStopped("a frozen body error");

      // a body that throws null is a failure, and null comes back
      let nothingThrown = true;
      try {
        await withStand(fakeOptions("exit-one", logOf("null")), (stand) => {
          remember(stand);
          throw null;
        });
      } catch (err) {
        nothingThrown = false;
        assert.equal(err, null);
      }
      assert.equal(nothingThrown, false, "a body that throws null failed");
      await assertStopped("a body that throws null");

      // a body that is not a function starts nothing
      const usage = await failureOf(
        withStand(fakeOptions("ok", logOf("value")), "not a function"),
        "a body that is not a function",
      );
      assertKitError(usage, "USAGE", "a body that is not a function");
      assert.deepEqual(kitFolders(), []);
      assertNothingRegistered();
    } finally {
      for (const label of labels) killFromLog(logOf(label));
      drop(dir);
    }
  },
);

test(
  "E2S-16 a spec process that ends by a signal, process.exit or a throw leaves no stand and no folder",
  LIMIT,
  async () => {
    // the child writes the pid of its stand and only then ends, so the handlers of
    // the starter are in place before it acts
    const ways = [
      ["SIGTERM", 'process.kill(process.pid, "SIGTERM");', 143],
      ["SIGINT", 'process.kill(process.pid, "SIGINT");', 130],
      ["SIGHUP", 'process.kill(process.pid, "SIGHUP");', 129],
      ["process.exit(3)", "process.exit(3);", 3],
      ["an uncaught throw", 'throw new Error("thrown on purpose");', 1],
    ];
    for (const [way, act, code] of ways) {
      const dir = scratch("exits");
      const log = path.join(dir, "log.jsonl");
      const pidFile = path.join(dir, "stand.pid");
      const run = startChild(
        childSource(
          log,
          [
            `fs.writeFileSync(${JSON.stringify(pidFile)}, String(stand.pid));`,
            "setInterval(() => {}, 1000);",
            act,
          ].join("\n"),
        ),
      );
      try {
        const end = await within(run.closed, 20000);
        if (end === LATE) {
          sendSignal(run.child.pid, "SIGKILL");
          assert.fail(`${way}: the child did not end in 20000 ms`);
        }
        assert.deepEqual(end, { code, signal: null }, `${way}: ${run.stderr}`);
        assert.ok(fs.existsSync(pidFile), `${way}: the child wrote no pid`);
        const standPid = Number(fs.readFileSync(pidFile, "utf8"));
        assert.equal(standPid, startPid(log), way);
        assert.ok(await waitGone(standPid, `${way}: the stand`));
        assert.deepEqual(kitFolders(), [], `${way}: a folder was left`);
      } finally {
        if (!run.ended) sendSignal(run.child.pid, "SIGKILL");
        killFromLog(log);
        drop(dir);
      }
    }
  },
);

test(
  "E2S-17 the real picker server through the starter: its questionnaire, then code 0 and nothing on stderr",
  LIMIT,
  async () => {
    const stand = await startStand({
      name: "picker",
      args: [
        "src/picker/cli.js",
        "serve",
        "--tenants",
        "src/picker/demo-tenants",
        "--port",
        "0",
      ],
      readyPattern: LINK,
    });
    let stopped;
    try {
      assert.equal(stand.url, `http://127.0.0.1:${stand.port}/`);
      // the start ends at the first link line; the next lines may come in a later
      // chunk of the pipe, so the test waits for them
      for (const id of ["uchet-pro", "svet-marketing"]) {
        await until(
          () => stand.stdout().includes(`${stand.origin}/t/${id}/\n`),
          5000,
          `the link line of ${id}`,
        );
      }
      const answer = await fetch(
        `${stand.origin}/t/uchet-pro/api/questionnaire?lang=ru`,
        { headers: { connection: "close" } },
      );
      assert.equal(answer.status, 200);
      assert.equal((await answer.json()).name, "Учёт-Про");
    } finally {
      stopped = await stand.stop().catch((err) => err);
    }
    assert.deepEqual(stopped, { code: 0, signal: null });
    assert.equal(stand.stderr(), "");
    assert.ok(await waitGone(stand.pid, "the picker server"));
    assert.deepEqual(kitFolders(), []);
    assertNothingRegistered();
  },
);

// The runner stops a spec that hangs with a stand, as E2K-43 and E2K-45 do with a
// browser: the spec's own handlers, or (event loop blocked) the runner's list.
async function runnerStopsStand(block) {
  const dir = scratch(`runner-${block}`);
  const pidFile = path.join(dir, "pids.json");
  const log = `${pidFile}.log`;
  let pids = null;
  try {
    const env = {
      ...process.env,
      SAI_CHROME: FAKE_CHROME,
      SAI_FAKE_CHROME_MODE: "ok",
      SAI_FIXTURE_PIDFILE: pidFile,
      SAI_FIXTURE_BLOCK: block,
    };
    delete env[REGISTRY_VAR];
    const out = collector();
    const err = collector();
    const code = await runAll({
      specDir: STAND_SPECS,
      argv: ["sleep-stand"],
      env,
      out,
      err,
      launch: ({ env: launchEnv }) => launchBrowser({ env: launchEnv }),
      fileTimeoutMs: 4000,
      killGraceMs: 500,
    });
    assert.equal(code, 1, `block=${block}: ${err.text()}`);
    assert.equal(
      err.text(),
      "e2e: error=SPEC_TIMEOUT: sleep-stand.e2e.js did not finish in 4000 ms; it was stopped\n",
    );
    assert.match(
      out.text(),
      /^e2e: command=npm run e2e -- sleep-stand selection=sleep-stand exit=1 duration_ms=\d+$/mu,
    );
    // the start of a stand takes about 0.1 s against the 4000 ms of the runner
    assert.ok(
      fs.existsSync(pidFile),
      `block=${block}: the spec wrote no pid file in the 4000 ms of the runner, so its stand did not start in time`,
    );
    pids = JSON.parse(fs.readFileSync(pidFile, "utf8"));
    assert.equal(pids.stand, startPid(log), `block=${block}`);
    assert.ok(await waitGone(pids.stand, `block=${block}: the stand`));
    assert.ok(await waitGone(pids.spec, `block=${block}: the spec process`));
    assert.deepEqual(kitFolders(), [], `block=${block}: a folder was left`);
    assertNothingRegistered();
  } finally {
    if (pids !== null && !pidGone(pids.spec)) sendSignal(pids.spec, "SIGKILL");
    killFromLog(log);
    drop(dir);
  }
}

test(
  "E2S-18 the runner removes the stand of a spec it stopped, also when the spec blocks its own event loop",
  LIMIT,
  async () => {
    await runnerStopsStand("0");
    await runnerStopsStand("1");
  },
);

test(
  "E2S-19 the starter, the stand-in, the fixture spec and this file: no skip, no secret, no sandbox flag, named variables only",
  LIMIT,
  () => {
    const files = [
      STAND_JS,
      FAKE_STAND,
      SLEEP_SPEC,
      fileURLToPath(import.meta.url),
    ];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      const name = path.relative(TOOLS, file);
      for (const word of SKIP_WORDS) {
        assert.ok(!text.includes(word), `${name}: ${word}`);
      }
      assert.doesNotMatch(text, SKIP_OPTION, name);
      for (const shape of SECRET_SHAPES) assert.doesNotMatch(text, shape, name);
      for (const flag of SANDBOX_FLAGS) {
        assert.ok(!text.includes(flag), `${name}: ${flag}`);
      }
      for (const spec of importsOf(text)) {
        assert.ok(
          spec.startsWith("node:") ||
            spec.startsWith("./") ||
            spec.startsWith("../"),
          `${name}: import of "${spec}"`,
        );
      }
      assert.doesNotMatch(text, /\brequire\s*\(/u, name);
    }

    // the starter reads the base list by name and nothing else of the environment
    const stand = fs.readFileSync(STAND_JS, "utf8");
    const env = ["process", "\\.env"].join("");
    const property = new RegExp(`${env}\\.([A-Za-z_][A-Za-z0-9_]*)`, "gu");
    const literal = new RegExp(`${env}\\[\\s*["']([^"']+)["']\\s*\\]`, "gu");
    const computed = new RegExp(`${env}\\[(?!\\s*["'])`, "gu");
    const bare = new RegExp(`${env}(?![.\\[A-Za-z0-9_])`, "gu");
    const read = new Set([
      ...[...stand.matchAll(property)].map((m) => m[1]),
      ...[...stand.matchAll(literal)].map((m) => m[1]),
    ]);
    assert.deepEqual([...read].sort(), [...BASE].sort());
    assert.equal([...stand.matchAll(computed)].length, 0, "a computed key");
    assert.equal([...stand.matchAll(bare)].length, 0, "the whole environment");
    assert.ok(!stand.includes("NODE_TEST_CONTEXT"));

    // the two exports, and the README section of the end-to-end tests
    assert.match(
      fs.readFileSync(INDEX_JS, "utf8"),
      /^export \{ startStand, withStand \} from "\.\/stand\.js";$/mu,
    );
    const readme = fs.readFileSync(path.join(TOOLS, "README.md"), "utf8");
    const at = readme.indexOf("\n## End-to-end tests in a real browser\n");
    assert.ok(at >= 0, "the README section");
    const rest = readme.slice(at + 1);
    const next = rest.slice(3).search(/\n## /u);
    const section = next === -1 ? rest : rest.slice(0, next + 3);
    for (const token of ["startStand", "withStand", "80000"]) {
      assert.ok(section.includes(token), `the README section lacks ${token}`);
    }
  },
);

test(
  "E2S-20 the stand-in's stack mode and the expression that tells a stack line",
  LIMIT,
  async () => {
    const dir = scratch("stack");
    const log = path.join(dir, "log.jsonl");
    let stand = null;
    try {
      stand = await startStand(fakeOptions("stack", log));
      // the two lines come after the link
      await until(
        () => stand.stderr().includes("    at fake (file.js:1:1)\n"),
        5000,
        "the stack lines on the stderr of the stand",
      );
      assert.equal(stand.stderr(), "Error: boom\n    at fake (file.js:1:1)\n");
      assert.equal(hasStack(stand.stderr()), true);
      assert.equal(hasStack("    at fake (file.js:1:1)"), true);
      // "at " inside a line, and a line that starts with "at " after an empty line
      assert.equal(hasStack("we arrive at the end"), false);
      assert.equal(hasStack("note\n\nat start"), false);
      // the control: with \s the second text is taken, so it tells the two apart
      assert.equal(/^\s+at /mu.test("note\n\nat start"), true);
      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
      assert.ok(await waitGone(stand.pid, "the stand of the stack mode"));
      assertNothingRegistered();
    } finally {
      await stopQuietly(stand);
      killFromLog(log);
      drop(dir);
    }
  },
);
