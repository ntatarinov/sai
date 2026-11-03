// E2K-01 ... E2K-63: the tests of the end-to-end kit (REQ-104) that need no real
// browser. A stand-in program (fixtures/e2e/fake-chrome.js) speaks the protocol; the
// runner is tried on plain spec files in fixtures/e2e/specs. The oracles are the
// design's own tables and literals (docs/design/REQ-104-e2e-chrome-kit.md), not the
// values the kit exports, except the public API under test. Every test makes its own
// folders under a private temporary root and removes them itself.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hasHomePath, hasTempPath } from "../src/traces/rules.js";
import { launchBrowser } from "./e2e/kit/browser.js";
import { connect } from "./e2e/kit/cdp.js";
import {
  REGISTRY_VAR,
  dropBrowserRegistry,
  liveRegistrations,
  makeBrowserRegistry,
  makeTempDir,
  removeTempDir,
  signalGroup,
  sweepBrowserRegistry,
} from "./e2e/kit/cleanup.js";
import {
  consoleError,
  entryFromEvent,
  evaluateConsole,
  makeDeclaration,
} from "./e2e/kit/console.js";
import { E2eError, safeText } from "./e2e/kit/errors.js";
import { CHROME_PLACES, findChrome } from "./e2e/kit/find-chrome.js";
import {
  assertLoopbackUrl,
  assertOutsideRepo,
  assertShotPath,
  assertUnderTempRoot,
  repoRoot,
  tempRoot,
} from "./e2e/kit/guards.js";
import { Page } from "./e2e/kit/page.js";
import {
  analyseTap,
  formatRecord,
  listSpecs,
  parseSelection,
  runAll,
  specArgument,
  specEnv,
} from "./e2e/kit/runner.js";

const LIMIT = { timeout: 30000 };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, "..");
const E2E = path.join(HERE, "e2e");
const KIT = path.join(E2E, "kit");
const FIXTURES = path.join(HERE, "fixtures", "e2e");
const FAKE = path.join(FIXTURES, "fake-chrome.js");
const SPECS = path.join(FIXTURES, "specs");
const TAPS = path.join(FIXTURES, "tap");

// Words that the greps of the requirement forbid in the tests are put together at
// run time, so that no contiguous forbidden string stands in this file (design 11).
const RDP = ["remote", "-debugging", "-port"].join("");
const SANDBOX_FLAGS = [
  ["--no", "-sandbox"].join(""),
  ["--disable", "-setuid", "-sandbox"].join(""),
];
const BAD_TOKENS = [
  [".sk", "ip("].join(""),
  [".to", "do("].join(""),
  ["|", "| tr", "ue"].join(""),
  ["eslint", "-disable"].join(""),
];
const BAD_OPTION = new RegExp(
  ["\\{\\s*(?:", "sk", "ip|", "to", "do)\\s*:"].join(""),
);
const SECRET_SHAPES = [
  new RegExp(["gh", "p_[A-Za-z0-9]{20,}"].join("")),
  new RegExp(["s", "k-[A-Za-z0-9]{20,}"].join("")),
  new RegExp(["BEGIN [A-Z ]*PRIV", "ATE KEY"].join("")),
];

// A private temporary root for this file: every folder the kit makes lies under it,
// so the lists below cannot be disturbed by other test files that run at the same
// time. The outer root is kept to make a folder that is outside the kit's root.
const OUTER_TMP = fs.realpathSync(os.tmpdir());
const MY_TMP = fs.realpathSync(
  fs.mkdtempSync(path.join(OUTER_TMP, "sai-kit-test-")),
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function until(check, ms = 8000, what = "the condition") {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) assert.fail(`${what} did not become true`);
    await sleep(20);
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

// After a kill the death comes later than the call: the signal is delivered and the
// dead process is reaped by its parent after the call has returned, and a process that
// is dead but not yet reaped (a zombie) still answers kill(pid, 0). So a test that has
// seen a process end by a kill waits, with a limit, until both the pid and its group
// answer ESRCH; one check right after the end is a race (ISS-0103). It returns true
// or fails with a message that names what was waited for.
async function waitGone(pid, what, ms = 5000) {
  return until(
    () => pidGone(pid) && groupGone(pid),
    ms,
    `${what}, pid ${pid} and its group, being gone`,
  );
}

function kitFolders() {
  return fs.readdirSync(MY_TMP).filter((name) => name.startsWith("sai-e2e-"));
}

function assertNothingRegistered() {
  const live = liveRegistrations();
  assert.deepEqual(live.groups, []);
  assert.deepEqual(live.dirs, []);
  assert.equal(live.hooks, 0);
}

function fakeEnv(mode, extra = {}) {
  const env = {
    ...process.env,
    SAI_CHROME: FAKE,
    SAI_FAKE_CHROME_MODE: mode,
    ...extra,
  };
  delete env[REGISTRY_VAR];
  return env;
}

function readLog(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));
}

function logPids(file) {
  return readLog(file).flatMap((event) =>
    event.event === "start" || event.event === "child" ? [event.pid] : [],
  );
}

function calls(file, method) {
  return readLog(file).filter(
    (event) => event.event === "call" && event.method === method,
  );
}

// A started stand-in browser, with a log file in its own folder.
async function startFake(mode, options = {}) {
  const dir = scratch(`fake-${mode}`);
  const log = path.join(dir, "log.jsonl");
  const browser = await launchBrowser({
    env: fakeEnv(mode, { SAI_FAKE_CHROME_LOG: log }),
    ...options,
  });
  return { browser, dir, log };
}

async function assertNextStartWorks() {
  const { browser, dir } = await startFake("ok");
  try {
    assert.equal(browser.product, "FakeChrome/1.2.3");
  } finally {
    await browser.close();
    drop(dir);
  }
}

// The stand-in started by hand (no registration): for tests of the protocol client.
async function spawnFake(mode, extra = {}) {
  const child = spawn(FAKE, [], {
    detached: true,
    stdio: ["ignore", "ignore", "pipe"],
    env: fakeEnv(mode, extra),
  });
  let text = "";
  child.stderr.setEncoding("utf8");
  const wsUrl = await new Promise((resolve, reject) => {
    child.stderr.on("data", (chunk) => {
      text += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(text);
      if (match) resolve(match[1]);
    });
    child.once("error", reject);
    child.once("exit", () => reject(new Error("the stand-in exited")));
  });
  return {
    pid: child.pid,
    wsUrl,
    stop() {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // already gone
      }
    },
  };
}

function moduleUrl(file) {
  return pathToFileURL(path.join(KIT, file)).href;
}

// A script for a child process: written into a folder of the test, run by node.
function writeScript(dir, name, text) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, text);
  return file;
}

// Runs a child and collects its output; kills it by SIGKILL after `ms`.
function runChild(file, args, env, ms = 20000) {
  const child = spawn(process.execPath, [file, ...args], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const result = { stdout: "", stderr: "", child, timedOut: false };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (result.stdout += chunk));
  child.stderr.on("data", (chunk) => (result.stderr += chunk));
  result.done = new Promise((resolve) => {
    const timer = setTimeout(() => {
      result.timedOut = true;
      child.kill("SIGKILL");
    }, ms);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      result.code = code;
      result.signal = signal;
      resolve(result);
    });
  });
  return result;
}

const REFUSED_URLS = [
  "http://example.com/",
  "https://127.0.0.1:1/",
  "http://localhost:1/",
  "http://10.0.0.1/",
  "file:///etc/hosts",
  "http://127.0.0.1@example.com/",
  "http://127.0.0.1:1@example.com/",
  "http://user:pw@127.0.0.1:1/",
  "http://u@127.0.0.1:1/",
  "http://127.0.0.1.example.com:1/",
  "http://example.com:1/http://127.0.0.1:1/",
  "http://[::1]:1/",
  "http://[::ffff:127.0.0.1]:1/",
  "http://127.0.0.1/",
  "http://127.0.0.1:0/",
  "http://127.0.0.1:65536/",
  "http://127.0.0.2:1/",
  "http://0.0.0.0:1/",
  "ws://127.0.0.1:1/",
  "ftp://127.0.0.1:1/",
  "javascript:1",
  "data:text/html,x",
  "about:blank",
  "chrome://version",
  "//127.0.0.1:1/",
  "",
  null,
  5,
  {},
];

// ---------------------------------------------------------------- criterion 1

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

test(
  "E2K-01 nothing like the kit existed: the debugging-port word only under tools/test",
  LIMIT,
  () => {
    const inSrc = walk(path.join(TOOLS, "src")).filter((file) =>
      fs.readFileSync(file, "utf8").includes(RDP),
    );
    assert.deepEqual(inSrc, []);
    const inTest = walk(path.join(TOOLS, "test"))
      .filter((file) => fs.readFileSync(file, "utf8").includes(RDP))
      .map((file) => path.relative(TOOLS, file).split(path.sep).join("/"));
    assert.ok(inTest.length >= 1);
    assert.ok(inTest.every((file) => file.startsWith("test/")));
    assert.ok(
      inTest.some((file) => file.startsWith("test/e2e/kit/")),
      "the kit itself names the port option",
    );
    // the other files of tools/ that are not tests or sources
    for (const name of ["package.json", "eslint.config.js"]) {
      assert.ok(!fs.readFileSync(path.join(TOOLS, name), "utf8").includes(RDP));
    }
  },
);

function importsOf(text) {
  const found = [];
  const fromRe = /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gmu;
  const bareRe = /^\s*import\s*["']([^"']+)["']/gmu;
  for (const m of text.matchAll(fromRe)) found.push(m[1]);
  for (const m of text.matchAll(bareRe)) found.push(m[1]);
  return found;
}

test(
  "E2K-02 imports are node: modules or relative paths, no require, no bare dynamic import",
  LIMIT,
  () => {
    const files = [
      ...walk(KIT),
      path.join(E2E, "run.js"),
      path.join(E2E, "smoke.e2e.js"),
      FAKE,
      fileURLToPath(import.meta.url),
    ];
    assert.ok(files.length >= 13);
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      const name = path.relative(TOOLS, file);
      for (const spec of importsOf(text)) {
        assert.ok(
          spec.startsWith("node:") ||
            spec.startsWith("./") ||
            spec.startsWith("../"),
          `${name}: import of "${spec}"`,
        );
      }
      assert.doesNotMatch(text, /\brequire\s*\(/u, name);
      for (const m of text.matchAll(/\bimport\s*\(\s*(["'])([^"']+)\1/gu)) {
        assert.ok(
          m[2].startsWith("node:") || m[2].startsWith("."),
          `${name}: dynamic import of "${m[2]}"`,
        );
      }
    }
  },
);

test(
  "E2K-03 no dependency was added: package.json and the lock agree on the four development ones",
  LIMIT,
  () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"),
    );
    const lock = JSON.parse(
      fs.readFileSync(path.join(TOOLS, "package-lock.json"), "utf8"),
    );
    const four = {
      "@eslint/js": "10.0.1",
      eslint: "10.11.0",
      globals: "17.12.0",
      prettier: "3.9.9",
    };
    assert.equal(Object.hasOwn(pkg, "dependencies"), false);
    assert.deepEqual(pkg.devDependencies, four);
    assert.equal(Object.hasOwn(lock.packages[""], "dependencies"), false);
    assert.deepEqual(lock.packages[""].devDependencies, four);
  },
);

// ---------------------------------------------------------------- criterion 2

const PLACES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
];
const BIN = path.join(path.sep, "usr", "local", "bin");

// the full path of a place in the folder BIN (the macOS place is a full path itself)
function candidate(place, dir = BIN) {
  return path.isAbsolute(place) ? place : path.join(dir, place);
}

test(
  "E2K-04 SAI_CHROME names an existing file: it wins although every place exists",
  LIMIT,
  () => {
    const chosen = path.join(path.sep, "opt", "sai-test", "chrome");
    const found = findChrome({
      env: { SAI_CHROME: chosen, PATH: BIN },
      exists: () => true,
    });
    assert.equal(found.path, chosen);
    assert.equal(found.from, "SAI_CHROME");
  },
);

test(
  "E2K-05 SAI_CHROME names a missing file: not found, and no place is tried",
  LIMIT,
  () => {
    const missing = path.join(path.sep, "opt", "sai-test", "missing");
    const asked = [];
    assert.throws(
      () =>
        findChrome({
          env: { SAI_CHROME: missing, PATH: BIN },
          exists: (file) => {
            asked.push(file);
            return file !== missing;
          },
        }),
      (err) =>
        err instanceof E2eError &&
        err.code === "CHROME_NOT_FOUND" &&
        err.message.includes("SAI_CHROME") &&
        err.message.includes(missing),
    );
    assert.deepEqual(asked, [missing]);
  },
);

test(
  "E2K-06 without SAI_CHROME the five places are tried in order",
  LIMIT,
  () => {
    assert.deepEqual([...CHROME_PLACES], PLACES);
    assert.ok(Object.isFrozen(CHROME_PLACES));
    const env = { PATH: BIN };
    // only the places k..5 exist: place k wins
    for (let k = 0; k < PLACES.length; k++) {
      const present = new Set(PLACES.slice(k).map((place) => candidate(place)));
      const found = findChrome({ env, exists: (file) => present.has(file) });
      assert.equal(found.path, candidate(PLACES[k]), `from place ${k + 1}`);
      assert.equal(found.place, PLACES[k]);
      assert.equal(found.from, "place");
    }
    // each place alone is chosen
    for (const place of PLACES) {
      const found = findChrome({
        env,
        exists: (file) => file === candidate(place),
      });
      assert.equal(found.path, candidate(place));
    }
    // a name is looked up in every directory of PATH, in order
    const first = path.join(path.sep, "first");
    const second = path.join(path.sep, "second");
    const both = { PATH: [first, second].join(path.delimiter) };
    assert.equal(
      findChrome({
        env: both,
        exists: (file) => file === path.join(second, "chromium"),
      }).path,
      path.join(second, "chromium"),
    );
    assert.equal(
      findChrome({
        env: both,
        exists: (file) =>
          file === path.join(second, "chromium") ||
          file === path.join(first, "chromium"),
      }).path,
      path.join(first, "chromium"),
    );
    // a name earlier in the list beats a later name found in an earlier directory
    assert.equal(
      findChrome({
        env: both,
        exists: (file) =>
          file === path.join(first, "chromium") ||
          file === path.join(second, "google-chrome"),
      }).path,
      path.join(second, "google-chrome"),
    );
  },
);

test(
  "E2K-07 nothing found: the message names SAI_CHROME and the five places in order",
  LIMIT,
  () => {
    let error;
    try {
      findChrome({ env: { PATH: BIN }, exists: () => false });
    } catch (err) {
      error = err;
    }
    assert.ok(error instanceof E2eError);
    assert.equal(error.code, "CHROME_NOT_FOUND");
    assert.ok(error.message.includes("SAI_CHROME"));
    let from = 0;
    for (const place of PLACES) {
      const at = error.message.indexOf(place, from);
      assert.ok(at >= from, `place ${place} in order`);
      from = at + place.length;
    }
    const numbered = error.message
      .split("\n")
      .filter((line) => /^\s+\d+\) /u.test(line));
    assert.equal(numbered.length, 5);
    assert.equal(
      numbered.filter((line) => line.endsWith("(in PATH)")).length,
      4,
    );
    assert.ok(error.message.includes("(5)"));
    assert.ok(
      !error.message.split("\n").some((line) => /^\s+at /u.test(line)),
      "no stack line",
    );
  },
);

test(
  "E2K-08 SAI_CHROME that is empty, relative, a folder or not executable is refused without a fallback",
  LIMIT,
  () => {
    const asked = [];
    const exists = (file) => {
      asked.push(file);
      return true;
    };
    for (const value of ["", "chrome", "./chrome", "bin/chrome"]) {
      assert.throws(
        () => findChrome({ env: { SAI_CHROME: value, PATH: BIN }, exists }),
        (err) =>
          err.code === "CHROME_NOT_FOUND" && err.message.includes("SAI_CHROME"),
        JSON.stringify(value),
      );
    }
    assert.deepEqual(asked, [], "no place and no value was looked up");

    // the real lookup: a folder and a file without the execute bit are refused
    const dir = scratch("chrome");
    try {
      const plain = path.join(dir, "plain");
      fs.writeFileSync(plain, "#!/bin/sh\n", { mode: 0o644 });
      const runnable = path.join(dir, "runnable");
      fs.writeFileSync(runnable, "#!/bin/sh\n", { mode: 0o755 });
      fs.chmodSync(plain, 0o644);
      fs.chmodSync(runnable, 0o755);
      for (const value of [dir, plain, path.join(dir, "absent")]) {
        assert.throws(
          () => findChrome({ env: { SAI_CHROME: value, PATH: BIN } }),
          (err) => err.code === "CHROME_NOT_FOUND",
          value,
        );
      }
      assert.equal(
        findChrome({ env: { SAI_CHROME: runnable } }).path,
        runnable,
      );
    } finally {
      drop(dir);
    }

    // an empty entry of PATH is not the current folder
    const seen = [];
    assert.throws(() =>
      findChrome({
        env: { PATH: `${path.delimiter}${BIN}${path.delimiter}` },
        exists: (file) => {
          seen.push(file);
          return false;
        },
      }),
    );
    assert.ok(seen.length > 0);
    assert.ok(seen.every((file) => path.isAbsolute(file)));
    assert.ok(seen.every((file) => file === PLACES[0] || file.startsWith(BIN)));
    // no PATH at all does not crash
    assert.throws(
      () => findChrome({ env: {}, exists: () => false }),
      (err) => err.code === "CHROME_NOT_FOUND",
    );
    // a variable that is present but undefined counts as unset
    const lone = candidate("chromium");
    assert.equal(
      findChrome({
        env: { SAI_CHROME: undefined, PATH: BIN },
        exists: (file) => file === lone,
      }).path,
      lone,
    );
  },
);

test(
  "E2K-09 the command with a missing SAI_CHROME fails clearly and leaves nothing",
  LIMIT,
  () => {
    assert.ok(
      listSpecs(E2E).includes("smoke"),
      "the real tree holds smoke.e2e.js, else the message would be NO_SPECS",
    );
    const before = kitFolders();
    const env = {
      ...process.env,
      SAI_CHROME: path.join(path.sep, "no", "such", "chrome"),
    };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ["test/e2e/run.js"], {
      cwd: TOOLS,
      env,
      encoding: "utf8",
      timeout: 20000,
    });
    assert.equal(run.status, 1);
    const errors = run.stderr
      .split("\n")
      .filter((line) => line.startsWith("e2e: error="));
    assert.equal(errors.length, 1, run.stderr);
    assert.ok(errors[0].startsWith("e2e: error=CHROME_NOT_FOUND:"));
    assert.ok(errors[0].includes("SAI_CHROME"));
    assert.ok(errors[0].includes("/no/such/chrome"));
    assert.ok(!run.stderr.split("\n").some((line) => /^\s+at /u.test(line)));
    assert.ok(!run.stdout.includes("e2e: browser="));
    const lines = run.stdout.split("\n").filter((line) => line !== "");
    assert.match(
      lines.at(-1),
      /^e2e: command=npm run e2e selection=all exit=1 duration_ms=[0-9]+$/u,
    );
    assert.deepEqual(kitFolders(), before);
  },
);

// ---------------------------------------------------------------- criterion 4

// A started browser that failed to start leaves nothing: used by E2K-10 ... E2K-14.
async function failedStart(mode, options, check) {
  const dir = scratch(`fail-${mode}`);
  const log = path.join(dir, "log.jsonl");
  try {
    const began = Date.now();
    let error = null;
    try {
      await launchBrowser({
        env: fakeEnv(mode, { SAI_FAKE_CHROME_LOG: log }),
        ...options,
      });
    } catch (err) {
      error = err;
    }
    assert.ok(error instanceof E2eError, `${mode}: launch must reject`);
    const elapsed = Date.now() - began;
    check(error, elapsed);
    // the stand-in (and anything it started) is gone, nothing is registered or left
    const pids = logPids(log);
    assert.ok(pids.length >= 1, "the stand-in started");
    for (const pid of pids)
      assert.ok(pidGone(pid) && groupGone(pid), `pid ${pid}`);
    assertNothingRegistered();
    assert.deepEqual(kitFolders(), []);
    return error;
  } finally {
    drop(dir);
  }
}

test(
  "E2K-10 the browser exits at once: START_EXITED, nothing left, a second start works",
  LIMIT,
  async () => {
    const error = await failedStart(
      "exit-early",
      { startTimeoutMs: 15000 },
      (err, elapsed) => {
        assert.equal(err.code, "START_EXITED");
        assert.ok(err.message.includes("exit code 3"), err.message);
        assert.ok(
          err.message.includes("fake: cannot start, boom"),
          err.message,
        );
        assert.ok(
          elapsed < 5000,
          `noticed in ${elapsed} ms, not by the start timer`,
        );
      },
    );
    assert.equal(error.details.exitCode, 3);
    assert.ok(pidGone(error.details.pid));
    assert.equal(fs.existsSync(error.details.profileDir), false);
    await assertNextStartWorks();
  },
);

test(
  "E2K-11 the browser never says it is ready: START_TIMEOUT, the process is killed",
  LIMIT,
  async () => {
    for (const mode of ["hang", "hang-ignore-term"]) {
      const error = await failedStart(mode, { startTimeoutMs: 1000 }, (err) => {
        assert.equal(err.code, "START_TIMEOUT");
        assert.ok(err.message.includes("did not start"), err.message);
        assert.ok(err.message.includes("1000"), err.message);
      });
      assert.ok(pidGone(error.details.pid) && groupGone(error.details.pid));
      assert.equal(fs.existsSync(error.details.profileDir), false);
    }
    await assertNextStartWorks();
  },
);

const CLOSED = (err) =>
  err instanceof E2eError && err.code === "BROWSER_CLOSED";

test(
  "E2K-12 the browser dies or the socket closes: BROWSER_CLOSED, later calls the same, nothing left",
  LIMIT,
  async () => {
    // the socket is closed at once, or on the first call
    for (const mode of ["close-on-connect", "port-then-close"]) {
      await failedStart(mode, {}, (err, elapsed) => {
        assert.equal(err.code, "BROWSER_CLOSED", mode);
        assert.ok(elapsed < 5000, `${mode}: ${elapsed} ms`);
      });
    }

    // the browser is killed while the first call is pending
    const dir = scratch("killed-pending");
    const log = path.join(dir, "log.jsonl");
    try {
      const pending = launchBrowser({
        env: fakeEnv("no-answer", { SAI_FAKE_CHROME_LOG: log }),
        callTimeoutMs: 30000,
      });
      const outcome = pending.then(
        () => null,
        (err) => err,
      );
      await until(() => calls(log, "Browser.getVersion").length === 1);
      const started = Date.now();
      process.kill(-logPids(log)[0], "SIGKILL");
      const error = await outcome;
      assert.ok(CLOSED(error), String(error));
      assert.ok(Date.now() - started < 5000);
      assertNothingRegistered();
      assert.deepEqual(kitFolders(), []);
    } finally {
      drop(dir);
    }

    // a started browser is killed: pending and later calls reject, close() cleans up
    const { browser, dir: dir2 } = await startFake("ok");
    try {
      const pidBefore = browser.pid;
      process.kill(-pidBefore, "SIGKILL");
      const began = Date.now();
      await assert.rejects(browser.send("Browser.getVersion"), CLOSED);
      assert.ok(Date.now() - began < 5000);
      await assert.rejects(browser.send("Browser.getVersion"), CLOSED);
      await assert.rejects(browser.newPage(), CLOSED);
      await browser.close();
      assert.equal(fs.existsSync(browser.profileDir), false);
      assert.ok(groupGone(pidBefore));
    } finally {
      drop(dir2);
    }
    assertNothingRegistered();
    assert.deepEqual(kitFolders(), []);
    await assertNextStartWorks();
  },
);

test(
  "E2K-13 an answer that is not JSON: PROTOCOL_BAD_ANSWER naming each pending method",
  LIMIT,
  async () => {
    // through the client: two calls are pending, both are rejected, each names its method
    const fake = await spawnFake("bad-json");
    try {
      const connection = await connect(fake.wsUrl, { callTimeoutMs: 5000 });
      const [a, b] = await Promise.allSettled([
        connection.send("Page.enable"),
        connection.send("Runtime.enable"),
      ]);
      assert.equal(a.status, "rejected");
      assert.equal(b.status, "rejected");
      assert.equal(a.reason.code, "PROTOCOL_BAD_ANSWER");
      assert.equal(b.reason.code, "PROTOCOL_BAD_ANSWER");
      assert.ok(a.reason.message.startsWith("Page.enable:"), a.reason.message);
      assert.ok(
        b.reason.message.startsWith("Runtime.enable:"),
        b.reason.message,
      );
      // the connection is closed and later calls reject as closed
      assert.equal(connection.isClosed(), true);
      await assert.rejects(connection.send("Page.enable"), CLOSED);
    } finally {
      fake.stop();
    }

    // through the launch: the first call is answered with garbage
    await failedStart("bad-json", {}, (err) => {
      assert.equal(err.code, "PROTOCOL_BAD_ANSWER");
      assert.ok(err.message.includes("Browser.getVersion"), err.message);
    });
    await assertNextStartWorks();
  },
);

test(
  "E2K-14 an error object in the answer: PROTOCOL_ERROR with the method and the message",
  LIMIT,
  async () => {
    const fake = await spawnFake("error-object");
    try {
      const connection = await connect(fake.wsUrl, { callTimeoutMs: 5000 });
      await assert.rejects(
        connection.send("Page.enable"),
        (err) =>
          err.code === "PROTOCOL_ERROR" &&
          err.message.includes("Page.enable") &&
          err.message.includes("boom from fake") &&
          err.details.code === -32000,
      );
      // an error answer does not close the connection
      assert.equal(connection.isClosed(), false);
      connection.close();
    } finally {
      fake.stop();
    }
    await failedStart("error-object", {}, (err) => {
      assert.equal(err.code, "PROTOCOL_ERROR");
      assert.ok(err.message.includes("Browser.getVersion"));
      assert.ok(err.message.includes("boom from fake"));
    });
    await assertNextStartWorks();
  },
);

test(
  "E2K-15 no answer: CALL_TIMEOUT naming the method, the connection stays usable",
  LIMIT,
  async () => {
    const fake = await spawnFake("no-answer");
    try {
      const connection = await connect(fake.wsUrl, { callTimeoutMs: 500 });
      for (const method of ["Page.enable", "Runtime.enable"]) {
        const began = Date.now();
        await assert.rejects(
          connection.send(method),
          (err) =>
            err.code === "CALL_TIMEOUT" && err.message.startsWith(`${method}:`),
        );
        const elapsed = Date.now() - began;
        assert.ok(elapsed >= 450 && elapsed < 5000, `${elapsed} ms`);
        // not closed by the timeout: the next call times out the same way
        assert.equal(connection.isClosed(), false);
      }
      connection.close();
    } finally {
      fake.stop();
    }
    await failedStart("no-answer", { callTimeoutMs: 500 }, (err) => {
      assert.equal(err.code, "CALL_TIMEOUT");
      assert.ok(err.message.includes("Browser.getVersion"));
    });
    await assertNextStartWorks();
  },
);

test(
  "E2K-16 a browser that writes a lot to stderr does not block: the pipe is drained",
  LIMIT,
  async () => {
    // the premise: a writer that uses fs.writeSync blocks on a pipe that nobody reads
    const dir = scratch("noisy");
    try {
      const marker = path.join(dir, "done");
      const script = writeScript(
        dir,
        "writer.mjs",
        `import fs from "node:fs";
const chunk = "x".repeat(4095) + "\\n";
for (let i = 0; i < 256; i++) {
  let done = false;
  while (!done) {
    try {
      fs.writeSync(2, chunk);
      done = true;
    } catch (err) {
      if (err.code !== "EAGAIN") throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
  }
}
fs.writeFileSync(${JSON.stringify(marker)}, "done");
`,
      );
      const writer = spawn(process.execPath, [script], {
        stdio: ["ignore", "ignore", "pipe"],
      });
      try {
        await sleep(600);
        assert.equal(
          writer.exitCode,
          null,
          "the writer is blocked on the unread pipe",
        );
        assert.equal(fs.existsSync(marker), false);
        writer.stderr.resume();
        await until(() => fs.existsSync(marker), 10000, "the writer finishing");
      } finally {
        writer.kill("SIGKILL");
      }
    } finally {
      drop(dir);
    }

    // the kit reads on after the port line: start and a call finish
    const began = Date.now();
    const { browser, dir: fakeDir } = await startFake("noisy", {
      callTimeoutMs: 8000,
    });
    try {
      assert.equal(browser.product, "FakeChrome/1.2.3");
      const answer = await browser.send("Browser.getVersion");
      assert.equal(answer.product, "FakeChrome/1.2.3");
      assert.ok(Date.now() - began < 10000);
    } finally {
      await browser.close();
      drop(fakeDir);
    }
    assertNothingRegistered();
  },
);

test(
  "E2K-17 close() ends the whole process group, also one that ignores SIGTERM",
  LIMIT,
  async () => {
    const { browser, dir, log } = await startFake("with-child");
    try {
      const child = readLog(log).find((event) => event.event === "child").pid;
      assert.ok(!pidGone(child));
      await browser.close();
      assert.ok(pidGone(browser.pid) && groupGone(browser.pid));
      assert.ok(pidGone(child), "the child of the browser is gone too");
      assert.equal(fs.existsSync(browser.profileDir), false);
    } finally {
      drop(dir);
    }
    assertNothingRegistered();

    // SIGTERM is ignored: close() escalates to SIGKILL after the grace time
    const stubborn = await startFake("ok-ignore-term", { closeGraceMs: 500 });
    try {
      const began = Date.now();
      await stubborn.browser.close();
      const elapsed = Date.now() - began;
      assert.ok(elapsed >= 450, `the grace time was waited (${elapsed} ms)`);
      assert.ok(elapsed < 5000, `${elapsed} ms`);
      assert.ok(
        pidGone(stubborn.browser.pid) && groupGone(stubborn.browser.pid),
      );
      assert.equal(fs.existsSync(stubborn.browser.profileDir), false);
    } finally {
      drop(stubborn.dir);
    }
    assertNothingRegistered();
    // close() twice is one close
    const again = await startFake("ok");
    try {
      const first = again.browser.close();
      const second = again.browser.close();
      assert.equal(first, second);
      await first;
    } finally {
      drop(again.dir);
    }
  },
);

const BROWSER_URL = moduleUrl("browser.js");
const SCENARIOS = [
  ["SIGTERM", 143],
  ["SIGINT", 130],
  ["SIGHUP", 129],
  ["exit", 3],
  ["throw", 1],
];

test(
  "E2K-18 a test process that ends by a signal, process.exit or a throw leaves no browser and no folder",
  LIMIT,
  async () => {
    const dir = scratch("scenario");
    try {
      const script = writeScript(
        dir,
        "start.mjs",
        `import fs from "node:fs";
import { launchBrowser } from ${JSON.stringify(BROWSER_URL)};
const [, , how, resultFile] = process.argv;
const browser = await launchBrowser();
fs.writeFileSync(resultFile, JSON.stringify({ pid: browser.pid, profileDir: browser.profileDir }));
if (how === "exit") process.exit(3);
if (how === "throw") throw new Error("the body failed");
setInterval(() => {}, 1000);
`,
      );
      for (const [how, expected] of SCENARIOS) {
        const resultFile = path.join(dir, `${how}.json`);
        const run = runChild(script, [how, resultFile], fakeEnv("ok"), 20000);
        if (how.startsWith("SIG")) {
          await until(
            () => fs.existsSync(resultFile),
            15000,
            "the browser start",
          );
          run.child.kill(how);
        }
        await run.done;
        assert.equal(run.timedOut, false, how);
        assert.equal(run.code, expected, `${how}: ${run.stderr}`);
        const { pid, profileDir } = JSON.parse(
          fs.readFileSync(resultFile, "utf8"),
        );
        assert.ok(
          await waitGone(pid, `${how}: the stand-in`),
          `${how}: the stand-in is gone`,
        );
        assert.equal(
          fs.existsSync(profileDir),
          false,
          `${how}: the folder is gone`,
        );
      }
      assert.deepEqual(kitFolders(), []);
    } finally {
      drop(dir);
    }
  },
);

// ISS-0103: the real E2K-18 and E2K-38 cannot be made red on every machine, so the
// state that made them red is held by hand. A parent kills a process (or its group),
// writes the pid, and then blocks its own event loop, so it does not reap: the killed
// process stays a zombie, and kill(pid, 0) still succeeds, until a file tells the
// parent to go on. The single check of the old tests is false at that moment; the
// bounded wait must wait through it and end with true only after the parent has
// reaped. A live process must make the wait fail in time with a message that names
// what was waited for, and must be left alone.
const HOLD_SCRIPT = `import fs from "node:fs";
import { spawn } from "node:child_process";
const [, , how, pidFile, releaseFile] = process.argv;
const victim = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
  detached: true,
  stdio: "ignore",
});
if (how === "group") process.kill(-victim.pid, "SIGKILL");
else process.kill(victim.pid, "SIGKILL");
fs.writeFileSync(pidFile + ".part", String(victim.pid));
fs.renameSync(pidFile + ".part", pidFile);
const nap = new Int32Array(new SharedArrayBuffer(4));
const stop = Date.now() + 20000;
while (!fs.existsSync(releaseFile) && Date.now() < stop) Atomics.wait(nap, 0, 0, 5);
`;

test(
  "E2K-62 a stand-in that was killed but is not reaped yet is waited for, a live one fails the wait in time and is left alone",
  LIMIT,
  async () => {
    const dir = scratch("hold");
    const groups = [];
    const members = [];
    try {
      const script = writeScript(dir, "hold.mjs", HOLD_SCRIPT);
      for (const how of ["group", "pid"]) {
        const pidFile = path.join(dir, `${how}.pid`);
        const releaseFile = path.join(dir, `${how}.release`);
        const run = runChild(
          script,
          [how, pidFile, releaseFile],
          { PATH: process.env.PATH, TMPDIR: MY_TMP },
          25000,
        );
        const pid = Number(
          await until(
            () => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8"),
            15000,
            `${how}: the kill`,
          ),
        );
        // the state of the old tests: killed, not reaped, the single check is false
        assert.equal(
          pidGone(pid),
          false,
          `${how}: kill(pid, 0) still succeeds`,
        );
        assert.equal(groupGone(pid), false, `${how}: the group still answers`);
        let settled = false;
        const waiting = waitGone(pid, `${how}: the held stand-in`).then(
          (value) => {
            settled = true;
            return value;
          },
        );
        await sleep(300);
        assert.equal(
          settled,
          false,
          `${how}: the wait goes on while it is held`,
        );
        fs.writeFileSync(releaseFile, "go");
        assert.equal(await waiting, true, `${how}: the wait ends with true`);
        assert.equal(pidGone(pid) && groupGone(pid), true, how);
        await run.done;
        assert.equal(run.timedOut, false, how);
        assert.equal(run.code, 0, `${how}: ${run.stderr}`);
      }

      // a process that is alive: the wait fails after its limit, names what it
      // waited for, and does not touch the process
      const child = spawn(
        process.execPath,
        ["-e", "setInterval(() => {}, 1000)"],
        { detached: true, stdio: "ignore" },
      );
      const live = child.pid;
      groups.push(live);
      const began = Date.now();
      await assert.rejects(
        waitGone(live, "the live stand-in", 300),
        (err) =>
          err.message.includes("the live stand-in") &&
          err.message.includes(String(live)) &&
          err.message.includes("being gone"),
      );
      const waited = Date.now() - began;
      assert.ok(waited >= 300, `it waited the limit, not less: ${waited} ms`);
      assert.ok(waited < 3000, `it stopped at the limit given: ${waited} ms`);
      assert.equal(pidGone(live), false, "the live process is untouched");
      assert.equal(groupGone(live), false);

      // the leader is gone but a member of its group is alive: the pid answers
      // ESRCH alone, so the wait must look at the group too
      const leaderScript = writeScript(
        dir,
        "leader.mjs",
        `import { spawn } from "node:child_process";
spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }).unref();
`,
      );
      const leader = spawn(process.execPath, [leaderScript], {
        detached: true,
        stdio: "ignore",
      });
      const leaderPid = leader.pid;
      groups.push(leaderPid);
      await until(() => pidGone(leaderPid), 15000, "the leader ending");
      assert.equal(groupGone(leaderPid), false, "a member keeps the group");
      await assert.rejects(
        waitGone(leaderPid, "the group with a live member", 300),
        (err) => err.message.includes("the group with a live member"),
      );
      process.kill(-leaderPid, "SIGKILL");
      assert.equal(await waitGone(leaderPid, "the group after the kill"), true);

      // a live process that is not a group leader: it shares the group of this test,
      // so its pid is no group id and the group check on that pid answers ESRCH at
      // once. A wait that looked at the group alone would end with true for it.
      const member = spawn(
        process.execPath,
        ["-e", "setInterval(() => {}, 1000)"],
        { stdio: "ignore" },
      );
      const memberPid = member.pid;
      members.push(memberPid);
      assert.equal(pidGone(memberPid), false, "the member is alive");
      assert.equal(
        groupGone(memberPid),
        true,
        "its pid is no group id: the group check alone says gone",
      );
      await assert.rejects(
        waitGone(memberPid, "a live process that is no group leader", 300),
        (err) =>
          err.message.includes("a live process that is no group leader") &&
          err.message.includes(String(memberPid)),
      );
      assert.equal(pidGone(memberPid), false, "the member is untouched");
    } finally {
      for (const memberPid of members) {
        try {
          process.kill(memberPid, "SIGKILL");
        } catch {
          // already gone
        }
        await waitGone(memberPid, "a stand-in member at the end");
      }
      for (const group of groups) {
        try {
          process.kill(-group, "SIGKILL");
        } catch {
          // already gone
        }
        await waitGone(group, "a stand-in group at the end");
      }
      drop(dir);
    }
  },
);

// ISS-0103: E2K-62 pins the helper, this pins its use. The real E2K-18 and E2K-38
// cannot be made red on every machine, so a call site that went back to one check,
// lost its assertion or got a tiny limit would stay unnoticed. The text of the two
// tests is read by tokens, not by lines, so a reformat does not matter. Comments are
// blanked out with spaces (offsets and line numbers stay), the body of a test runs to
// the closing line of its call.
function blankComments(text) {
  return text.replace(/^[ \t]*\/\/[^\n]*/gmu, (line) =>
    " ".repeat(line.length),
  );
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function callArguments(text, open) {
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i += 1;
      while (i < text.length && text[i] !== ch) i += text[i] === "\\" ? 2 : 1;
    } else if ("([{".includes(ch)) {
      depth += 1;
    } else if (")]}".includes(ch)) {
      depth -= 1;
      if (depth === 0) {
        args.push(text.slice(start, i));
        break;
      }
    } else if (ch === "," && depth === 1) {
      args.push(text.slice(start, i));
      start = i + 1;
    }
  }
  const trimmed = args.map((arg) => arg.trim());
  if (trimmed.at(-1) === "") trimmed.pop();
  return trimmed;
}

function waitGoneProblems(text, id, sites, groupArguments) {
  const starts = [...text.matchAll(/^test\(\s*"(E2K-\d+) /gmu)];
  const first = starts.find((m) => m[1] === id);
  if (!first) return [`${id}: the test is not in this file`];
  const end = text.slice(first.index).search(/^\);/mu);
  const from = first.index;
  const body = text.slice(from, end < 0 ? text.length : from + end);
  const problems = [];
  const where = (index) => `${id} line ${lineAt(text, from + index)}`;
  const calls = [...body.matchAll(/\bwaitGone\s*\(/gu)];
  const asserted = [
    ...body.matchAll(/assert\s*\.\s*ok\s*\(\s*await\s+waitGone\s*\(/gu),
  ];
  if (asserted.length !== sites || calls.length !== sites) {
    problems.push(
      `${id} line ${lineAt(text, from)}: expected ${sites} assert.ok(await waitGone(...)) places, found ${asserted.length} of ${calls.length} calls`,
    );
  }
  for (const m of asserted) {
    const open = m.index + m[0].length - 1;
    const args = callArguments(body, open);
    const limit = args[2]?.replaceAll("_", "");
    if (args.length < 2 || args.length > 3) {
      problems.push(
        `${where(m.index)}: waitGone takes the pid, a name and a limit`,
      );
    } else if (
      args.length === 3 &&
      !(/^\d+$/u.test(limit) && Number(limit) >= 1000)
    ) {
      problems.push(
        `${where(m.index)}: the limit ${args[2]} is below 1000 ms or not a number`,
      );
    }
  }
  for (const m of body.matchAll(/\bpidGone\s*\(/gu)) {
    problems.push(
      `${where(m.index)}: pidGone( is the single check after a kill`,
    );
  }
  for (const m of body.matchAll(/\bgroupGone\s*\(/gu)) {
    const [arg] = callArguments(body, m.index + m[0].length - 1);
    if (!groupArguments.includes(arg)) {
      problems.push(
        `${where(m.index)}: groupGone(${arg}) of a killed process without waitGone`,
      );
    }
  }
  return problems;
}

test(
  "E2K-63 the three places that wait for a killed stand-in use the bounded wait, not one check",
  LIMIT,
  () => {
    const text = blankComments(
      fs.readFileSync(fileURLToPath(import.meta.url), "utf8"),
    );
    // E2K-18: one place for the five scenarios. E2K-38: the signal loop and the
    // preflight; after the loop waits, the group of the leader and of the browser
    // may be asked once more.
    const problems = [
      ...waitGoneProblems(text, "E2K-18", 1, []),
      ...waitGoneProblems(text, "E2K-38", 2, ["leader", "pids.browser"]),
    ];
    assert.equal(problems.length, 0, problems.join("\n"));
  },
);

test(
  "E2K-19 a peer that never answers the upgrade: CALL_TIMEOUT of the connect, nothing left",
  LIMIT,
  async () => {
    await failedStart("no-upgrade", { callTimeoutMs: 700 }, (err, elapsed) => {
      assert.equal(err.code, "CALL_TIMEOUT");
      assert.ok(err.message.includes("connect"), err.message);
      assert.ok(err.message.includes("700"), err.message);
      assert.ok(elapsed >= 600 && elapsed < 8000, `${elapsed} ms`);
    });

    // the same through the client against a plain TCP server that accepts and says nothing
    const sockets = new Set();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on("error", () => {});
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address();
      const began = Date.now();
      await assert.rejects(
        connect(`ws://127.0.0.1:${port}/devtools/browser/x`, {
          callTimeoutMs: 500,
        }),
        (err) => err.code === "CALL_TIMEOUT" && err.message.includes("connect"),
      );
      assert.ok(Date.now() - began >= 450);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
    // a port where nothing listens: the connection is lost
    const idle = net.createServer();
    await new Promise((resolve) => idle.listen(0, "127.0.0.1", resolve));
    const { port: closedPort } = idle.address();
    await new Promise((resolve) => idle.close(resolve));
    await assert.rejects(
      connect(`ws://127.0.0.1:${closedPort}/x`, { callTimeoutMs: 2000 }),
      CLOSED,
    );
    await assertNextStartWorks();
  },
);

// ---------------------------------------------------------------- criterion 5

test(
  "E2K-20 assertLoopbackUrl: only http://127.0.0.1:<port>/ is accepted, and the result is normalized",
  LIMIT,
  () => {
    for (const input of REFUSED_URLS) {
      assert.throws(
        () => assertLoopbackUrl(input),
        (err) =>
          err instanceof E2eError &&
          err.code === "URL_REFUSED" &&
          err.message.startsWith("refused to open"),
        String(input),
      );
    }
    const accepted = [
      ["http://127.0.0.1:1234/x", "http://127.0.0.1:1234/x"],
      ["HTTP://127.0.0.1:1234/x?a=1#b", "http://127.0.0.1:1234/x?a=1#b"],
      [" http://127.0.0.1:1234/ ", "http://127.0.0.1:1234/"],
      ["http://127.1:1234/", "http://127.0.0.1:1234/"],
      ["http://127.0.0.1:65535", "http://127.0.0.1:65535/"],
      ["http://127.0.0.1:1/a/../b", "http://127.0.0.1:1/b"],
    ];
    for (const [input, href] of accepted) {
      assert.equal(assertLoopbackUrl(input), href, input);
    }
    // a very long input is refused and the message is cut
    const long = `http://example.com/${"a".repeat(5000)}`;
    assert.throws(
      () => assertLoopbackUrl(long),
      (err) => err.code === "URL_REFUSED" && err.message.length < 600,
    );
  },
);

test(
  "E2K-21 goto checks the address before any protocol call and navigates to the normalized one",
  LIMIT,
  async () => {
    const { browser, dir, log } = await startFake("ok");
    try {
      const tab = await browser.newPage();
      for (const input of REFUSED_URLS) {
        await assert.rejects(
          tab.goto(input),
          (err) => err instanceof E2eError && err.code === "URL_REFUSED",
          String(input),
        );
      }
      assert.equal(
        calls(log, "Page.navigate").length,
        0,
        "no navigation was sent",
      );
      const accepted = [
        "http://127.0.0.1:1234/x",
        "HTTP://127.0.0.1:1234/x?a=1#b",
        " http://127.0.0.1:1234/ ",
        "http://127.1:1234/",
        "http://127.0.0.1:55/a\tb\nc",
      ];
      for (const [i, input] of accepted.entries()) {
        const answer = await tab.goto(input);
        const sent = calls(log, "Page.navigate");
        assert.equal(sent.length, i + 1);
        assert.equal(sent[i].params.url, new URL(input).href);
        assert.equal(answer.url, new URL(input).href);
      }
      assert.equal(
        calls(log, "Page.navigate").at(-1).params.url,
        "http://127.0.0.1:55/abc",
      );
    } finally {
      await browser.close();
      drop(dir);
    }
  },
);

test(
  "E2K-22 a screenshot path must be a .png file under the temporary root and outside the repository",
  LIMIT,
  async () => {
    const dir = scratch("shots");
    const { browser, dir: fakeDir, log } = await startFake("ok");
    try {
      const link = path.join(dir, "link");
      fs.symlinkSync(TOOLS, link);
      const back = path.relative(MY_TMP, ROOT_OF_REPO());
      const refused = [
        path.join(TOOLS, "shot.png"),
        path.join(ROOT_OF_REPO(), "shot.png"),
        `${MY_TMP}${path.sep}${back}${path.sep}shot.png`,
        path.join(link, "shot.png"),
        "shot.png",
        path.join(".", "shot.png"),
        path.join(dir, "shot.jpg"),
        path.join(dir, "shot"),
        path.join(path.parse(MY_TMP).root, "shot.png"),
        "",
      ];
      const tab = await browser.newPage();
      for (const target of refused) {
        assert.throws(
          () => assertShotPath(target),
          (err) => err instanceof E2eError && err.code === "PATH_REFUSED",
          target,
        );
        await assert.rejects(
          tab.screenshot(target),
          (err) => err.code === "PATH_REFUSED",
          target,
        );
      }
      assert.equal(calls(log, "Page.captureScreenshot").length, 0);
      assert.equal(fs.existsSync(path.join(TOOLS, "shot.png")), false);
      assert.equal(fs.existsSync(path.join(ROOT_OF_REPO(), "shot.png")), false);
      assert.equal(fs.existsSync(path.join(dir, "shot.jpg")), false);
      assert.deepEqual(fs.readdirSync(dir), ["link"]);

      const good = path.join(dir, "shot.png");
      assert.equal(assertShotPath(good), good);
      const result = await tab.screenshot(good);
      const data = fs.readFileSync(good);
      assert.deepEqual(
        [...data.subarray(0, 8)],
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
      assert.equal(result.bytes, data.length);
      assert.equal(calls(log, "Page.captureScreenshot").length, 1);

      // the other two guards
      assert.throws(
        () => assertOutsideRepo(TOOLS),
        (err) => err.code === "PATH_REFUSED",
      );
      assert.throws(
        () => assertOutsideRepo(path.join(link, "x")),
        (err) => err.code === "PATH_REFUSED",
      );
      assert.equal(assertOutsideRepo(dir), dir);
      assert.equal(assertUnderTempRoot(good), good);
      for (const outside of [
        path.parse(MY_TMP).root,
        path.dirname(MY_TMP),
        "relative/x",
        "",
      ]) {
        assert.throws(
          () => assertUnderTempRoot(outside),
          (err) => err.code === "PATH_REFUSED",
          outside,
        );
      }
    } finally {
      await browser.close();
      drop(fakeDir);
      drop(dir);
    }
  },
);

function ROOT_OF_REPO() {
  return path.resolve(TOOLS, "..");
}

test(
  "E2K-23 a temporary root inside the repository is refused before anything is made",
  LIMIT,
  async () => {
    const dir = scratch("insiderepo");
    try {
      const script = writeScript(
        dir,
        "probe.mjs",
        `import fs from "node:fs";
import { launchBrowser } from ${JSON.stringify(BROWSER_URL)};
import path from "node:path";
import { makeTempDir } from ${JSON.stringify(moduleUrl("cleanup.js"))};
import { assertOutsideRepo, assertShotPath, assertUnderTempRoot } from ${JSON.stringify(moduleUrl("guards.js"))};
const out = {};
// a path that is under the temporary root AND inside the repository: the repository wins
const shot = path.join(process.env.TMPDIR, "shot.png");
const reason = (guard) => {
  try { guard(shot); return "accepted"; } catch (err) { return err.code + ": " + err.message.split(": ").at(-1); }
};
out.shot = reason(assertShotPath);
out.outside = reason(assertOutsideRepo);
out.under = reason(assertUnderTempRoot);
try { makeTempDir("probe"); out.make = "made"; } catch (err) { out.make = err.code; }
try { await launchBrowser(); out.launch = "started"; } catch (err) { out.launch = err.code; }
out.left = fs.readdirSync(process.env.TMPDIR).filter((name) => name.startsWith("sai-e2e-"));
process.stdout.write(JSON.stringify(out));
`,
      );
      // HERE is a folder of the repository that exists
      const run = runChild(script, [], fakeEnv("ok", { TMPDIR: HERE }), 20000);
      await run.done;
      assert.equal(run.timedOut, false);
      assert.equal(run.code, 0, run.stderr);
      assert.deepEqual(JSON.parse(run.stdout), {
        shot: "PATH_REFUSED: inside the repository",
        outside: "PATH_REFUSED: inside the repository",
        under: "accepted",
        make: "PATH_REFUSED",
        launch: "PATH_REFUSED",
        left: [],
      });
      assert.deepEqual(
        fs.readdirSync(HERE).filter((name) => name.startsWith("sai-e2e-")),
        [],
      );
    } finally {
      drop(dir);
    }
  },
);

test(
  "E2K-24 the profile folder and a made folder lie under the temporary root, outside the repository",
  LIMIT,
  async () => {
    const { browser, dir, log } = await startFake("ok");
    try {
      const real = fs.realpathSync(browser.profileDir);
      assert.ok(real.startsWith(MY_TMP + path.sep));
      assert.ok(!real.startsWith(repoRoot() + path.sep));
      assert.equal(tempRoot(), MY_TMP);
      assert.ok(path.basename(real).startsWith("sai-e2e-"));
      const probe = makeTempDir("probe");
      try {
        assert.ok(fs.realpathSync(probe).startsWith(MY_TMP + path.sep));
        assert.ok(path.basename(probe).startsWith("sai-e2e-probe-"));
        assert.ok(fs.statSync(probe).isDirectory());
      } finally {
        removeTempDir(probe);
      }
      assert.equal(fs.existsSync(probe), false);
      assert.equal(readLog(log)[0].event, "start");
    } finally {
      await browser.close();
      drop(dir);
    }
    // a folder that was not made by makeTempDir is not removed by removeTempDir
    const foreign = scratch("foreign");
    try {
      assert.throws(
        () => removeTempDir(foreign),
        (err) => err.code === "USAGE",
      );
      assert.ok(fs.existsSync(foreign));
      for (const label of ["", "UPPER", "a b", "x".repeat(25), "a/b", "../x"]) {
        assert.throws(
          () => makeTempDir(label),
          (err) => err.code === "USAGE",
          label,
        );
      }
    } finally {
      drop(foreign);
    }
    // the stand-in is an executable program
    assert.equal(fs.statSync(FAKE).mode & 0o777, 0o755);
    assert.ok(fs.readFileSync(FAKE, "utf8").startsWith("#!/usr/bin/env node"));
    assert.deepEqual(kitFolders(), []);
  },
);

test(
  "E2K-25 the argument list: the sandbox stays on, only this computer can be reached",
  LIMIT,
  async () => {
    const { browser, dir, log } = await startFake("ok");
    try {
      const argv = readLog(log).find((event) => event.event === "start").argv;
      const expected = [
        "--headless=new",
        `--${RDP}=0`,
        `--user-data-dir=${browser.profileDir}`,
        "--no-first-run",
        "--disable-gpu",
        "--no-proxy-server",
        "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
        "about:blank",
      ];
      assert.deepEqual(argv, expected);
      assert.deepEqual([...browser.args], expected);
      assert.ok(Object.isFrozen(browser.args));
      for (const argument of argv) {
        for (const flag of SANDBOX_FLAGS) assert.notEqual(argument, flag);
        assert.ok(!argument.toLowerCase().includes("sandbox"), argument);
      }
    } finally {
      await browser.close();
      drop(dir);
    }
    // no file under tools/test/e2e and no stand-in names a sandbox flag, comments included
    const files = [...walk(E2E), FAKE];
    assert.ok(files.length >= 12);
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      for (const flag of SANDBOX_FLAGS) {
        assert.ok(
          !text.includes(flag),
          `${path.relative(TOOLS, file)} names ${flag}`,
        );
      }
    }
  },
);

test(
  "E2K-26 text that a page or the operator controls is made safe before it reaches a message",
  LIMIT,
  () => {
    const table = [
      ["a\nb", "a\\nb"],
      ["a\r\nb", "a\\r\\nb"],
      ["a\tb", "a\\tb"],
      ["\u001b[31mred", "\\u001b[31mred"],
      ["x\u007fy", "x\\u007fy"],
      ["x\u0085y", "x\\u0085y"],
      ["a\u2028b\u2029c", "a\\u2028b\\u2029c"],
      ["plain text 123", "plain text 123"],
      ["привет", "привет"],
      ["x::y", "x::y"],
      ["", ""],
    ];
    for (const [input, expected] of table) {
      assert.equal(safeText(input), expected, JSON.stringify(input));
    }
    // a leading "::" (a command of the CI log) is neutralised
    for (const input of ["::error::x", "::set-output name=a::b", "::"]) {
      const shown = safeText(input);
      assert.ok(!shown.startsWith("::"), shown);
      assert.notEqual(shown, input);
    }
    assert.ok(
      !safeText("\n::error::x")
        .split("\n")
        .some((line) => line.startsWith("::")),
    );
    // cut at the limit with the count of the rest
    assert.equal(
      safeText("a".repeat(300)),
      `${"a".repeat(200)}... (100 more characters)`,
    );
    assert.equal(safeText("abcdef", 3), "abc... (3 more characters)");
    assert.equal(safeText("a".repeat(200)), "a".repeat(200));
    // values that are not strings
    assert.equal(safeText(Symbol("s")), "Symbol(s)");
    assert.equal(safeText(42), "42");
    assert.equal(safeText(null), "null");
    assert.equal(
      safeText({
        toString() {
          throw new Error("no text");
        },
      }),
      "[unprintable]",
    );

    // a property over seeded random strings: no control character survives, no
    // leading "::", and the length is bounded
    let seed = 20261103;
    const next = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      return seed;
    };
    const alphabet = [
      0, 1, 8, 9, 10, 13, 27, 31, 58, 58, 65, 97, 127, 133, 159, 160, 8232,
      8233, 1076,
    ];
    for (let i = 0; i < 300; i++) {
      const length = next() % 400;
      let text = "";
      for (let j = 0; j < length; j++) {
        text += String.fromCharCode(alphabet[next() % alphabet.length]);
      }
      const shown = safeText(text, 120);
      for (const ch of shown) {
        const code = ch.charCodeAt(0);
        assert.ok(
          !(
            code < 32 ||
            (code >= 127 && code <= 159) ||
            code === 8232 ||
            code === 8233
          ),
          `control character ${code}`,
        );
      }
      assert.ok(!shown.startsWith("::"));
      assert.ok(shown.length <= 120 * 6 + 40);
    }

    // the list of console entries: counts whole, at most 20 + 20 lines, no line starts with "::"
    const entry = (n) => ({
      kind: "console",
      text: `::error::entry ${n}\nsecond line`,
      page: 0,
      at: n,
    });
    const unexpected = Array.from({ length: 25 }, (_, n) => entry(n));
    const unmet = Array.from({ length: 25 }, (_, n) => ({
      kind: "console",
      text: `::missing ${n}\nmore`,
      once: false,
    }));
    const error = consoleError(unexpected, unmet);
    assert.equal(error.code, "CONSOLE_ENTRIES");
    const lines = error.message.split("\n");
    assert.equal(lines[0], "25 unexpected console entries:");
    assert.ok(lines.includes("25 declared entries did not happen:"));
    assert.equal(lines.length, 1 + 20 + 1 + 1 + 20 + 1);
    assert.equal(
      lines.filter((line) => line.includes("... and 5 more")).length,
      2,
    );
    assert.ok(!lines.some((line) => line.startsWith("::")));
    assert.ok(lines.every((line) => line.length < 600));
    assert.equal(consoleError([], []), null);
    assert.equal(
      consoleError(unexpected.slice(0, 1), []).message.split("\n").length,
      3,
    );
  },
);

test(
  "E2K-27 a path with a NUL, a name that is too long or a link loop is refused, not a raw system error",
  LIMIT,
  () => {
    const dir = scratch("badpaths");
    try {
      fs.symlinkSync(path.join(dir, "b"), path.join(dir, "a"));
      fs.symlinkSync(path.join(dir, "a"), path.join(dir, "b"));
      const bad = [
        `${dir}${path.sep}na\u0000me.png`,
        path.join(dir, `${"n".repeat(300)}.png`),
        path.join(dir, "a", "x.png"),
      ];
      for (const target of bad) {
        for (const guard of [
          assertShotPath,
          assertUnderTempRoot,
          assertOutsideRepo,
        ]) {
          assert.throws(
            () => guard(target),
            (err) =>
              err instanceof E2eError &&
              err.code === "PATH_REFUSED" &&
              !err.message.includes("\n") &&
              err.message.length < 600,
            `${guard.name}: ${target.length} chars`,
          );
        }
      }
      // a path that is not a string is refused with its type only
      for (const value of [null, 5, {}, undefined]) {
        assert.throws(
          () => assertShotPath(value),
          (err) => err.code === "PATH_REFUSED",
        );
      }
      assert.deepEqual(fs.readdirSync(dir).sort(), ["a", "b"]);
    } finally {
      drop(dir);
    }
  },
);

// A page on a stand-in connection: the answers are given by the test.
function stubPage(answer) {
  const sent = [];
  const connection = {
    async send(method, params, sessionId) {
      sent.push({ method, params, sessionId });
      return answer(method, params);
    },
    subscribe: () => () => {},
  };
  const page = new Page({
    connection,
    sessionId: "S1",
    targetId: "T1",
    index: 0,
    onEntry: () => {},
    declarations: () => [],
  });
  return { page, sent };
}

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test(
  "E2K-28 the page methods fail with named errors and change nothing they were not asked to",
  LIMIT,
  async () => {
    const dir = scratch("page");
    try {
      // a screenshot that cannot be written: SCREENSHOT_FAILED, no file
      const shot = stubPage(() => ({ data: PNG_1X1 }));
      const missingFolder = path.join(dir, "no-such-folder", "a.png");
      await assert.rejects(
        shot.page.screenshot(missingFolder),
        (err) =>
          err.code === "SCREENSHOT_FAILED" &&
          err.message.includes("ENOENT") &&
          !err.message.includes("\n"),
      );
      assert.equal(fs.existsSync(path.dirname(missingFolder)), false);
      const target = path.join(dir, "ok.png");
      assert.equal(
        (await shot.page.screenshot(target)).bytes,
        fs.statSync(target).size,
      );
      // a browser answer that is not a PNG is refused and writes nothing
      const notPng = stubPage(() => ({
        data: Buffer.from("not a png").toString("base64"),
      }));
      const refusedFile = path.join(dir, "no.png");
      await assert.rejects(
        notPng.page.screenshot(refusedFile),
        (err) =>
          err.code === "PROTOCOL_ERROR" && err.message.includes("not a PNG"),
      );
      assert.equal(fs.existsSync(refusedFile), false);

      // waitFor: the last protocol error is named, other errors pass through at once
      const flaky = stubPage((method) => {
        if (method === "Runtime.evaluate") {
          throw new E2eError(
            "PROTOCOL_ERROR",
            "Runtime.evaluate: Execution context was destroyed (code -32000)",
          );
        }
        return {};
      });
      await assert.rejects(
        flaky.page.waitFor("window.ready", { timeoutMs: 150, pollMs: 20 }),
        (err) =>
          err.code === "WAIT_TIMEOUT" &&
          err.message.includes("waited 150 ms") &&
          err.message.includes(
            "last protocol error: Runtime.evaluate: Execution context was destroyed",
          ),
      );
      assert.ok(
        flaky.sent.filter((c) => c.method === "Runtime.evaluate").length >= 2,
      );
      const closed = stubPage(() => {
        throw new E2eError(
          "BROWSER_CLOSED",
          "the browser is closed (exit code 1)",
        );
      });
      await assert.rejects(
        closed.page.waitFor("1", { timeoutMs: 5000 }),
        (err) => err.code === "BROWSER_CLOSED",
      );
      assert.equal(
        closed.sent.length,
        1,
        "no second poll after a closed browser",
      );
      const falsy = stubPage(() => ({ result: { value: false } }));
      await assert.rejects(
        falsy.page.waitFor("x", { timeoutMs: 100, pollMs: 20 }),
        (err) =>
          err.code === "WAIT_TIMEOUT" &&
          err.message.includes("last value: false") &&
          !err.message.includes("last protocol error"),
      );
      const truthy = stubPage(() => ({ result: { value: "yes" } }));
      assert.equal(await truthy.page.waitFor("x"), "yes");
      assert.equal(truthy.sent.length, 1);

      // evaluate: page code is a string, a function is refused before any call
      const idle = stubPage(() => ({ result: { value: 1 } }));
      for (const source of [() => 1, 5, null, undefined, {}]) {
        await assert.rejects(
          idle.page.evaluate(source),
          (err) => err.code === "USAGE",
        );
      }
      await assert.rejects(
        idle.page.evaluate("1", "not an array"),
        (err) => err.code === "USAGE",
      );
      assert.equal(idle.sent.length, 0);
      const thrown = stubPage(() => ({
        exceptionDetails: {
          text: "Uncaught",
          exception: { description: "Error: bad\n    at x" },
        },
      }));
      await assert.rejects(
        thrown.page.evaluate("bad()"),
        (err) =>
          err.code === "PAGE_EXCEPTION" &&
          err.message === "the page script threw: Error: bad",
      );

      // click on a covered element: the name of the cover is shown on one line
      const covered = stubPage(() => ({
        result: { value: { state: "covered", by: "layer\n::error::x" } },
      }));
      await assert.rejects(
        covered.page.click("#go"),
        (err) =>
          err.code === "CLICK_INTERCEPTED" &&
          !err.message.includes("\n") &&
          err.message.includes("layer"),
      );
      assert.equal(
        covered.sent.some((c) => c.method === "Input.dispatchMouseEvent"),
        false,
        "a covered element is not pressed",
      );
      await assert.rejects(
        covered.page.click(5),
        (err) => err.code === "USAGE",
      );

      // sizes and schemes: a page that reports other numbers is an error
      const stuck = stubPage((method) =>
        method === "Runtime.evaluate"
          ? { result: { value: { innerWidth: 980, innerHeight: 568 } } }
          : {},
      );
      await assert.rejects(
        stuck.page.setViewport(320, 568),
        (err) =>
          err.code === "VIEWPORT_MISMATCH" &&
          err.message.includes("320") &&
          err.message.includes("980"),
      );
      for (const [w, h] of [
        [0, 10],
        [1.5, 10],
        [10, 20000],
        ["a", 10],
      ]) {
        await assert.rejects(
          stuck.page.setViewport(w, h),
          (err) => err.code === "USAGE",
        );
      }
      const wrongScheme = stubPage((method) =>
        method === "Runtime.evaluate" ? { result: { value: false } } : {},
      );
      await assert.rejects(
        wrongScheme.page.setColorScheme("dark"),
        (err) => err.code === "SCHEME_MISMATCH",
      );
      await assert.rejects(
        wrongScheme.page.setColorScheme("blue"),
        (err) => err.code === "USAGE",
      );
      assert.equal(await wrongScheme.page.setColorScheme("light"), false);

      // horizontal overflow is strict: equal widths do not overflow
      for (const [scrollWidth, innerWidth, overflowing] of [
        [320, 320, false],
        [321, 320, true],
        [200, 320, false],
        [1470, 1470, false],
      ]) {
        const probe = stubPage(() => ({
          result: { value: { scrollWidth, innerWidth } },
        }));
        assert.deepEqual(await probe.page.horizontalOverflow(), {
          overflowing,
          scrollWidth,
          innerWidth,
        });
      }

      // a closed page refuses calls
      const gone = stubPage(() => ({}));
      await gone.page.close();
      await assert.rejects(
        gone.page.evaluate("1"),
        (err) => err.code === "USAGE",
      );
      await assert.rejects(
        gone.page.goto("http://127.0.0.1:1/"),
        (err) => err.code === "USAGE",
      );
    } finally {
      drop(dir);
    }
  },
);

test(
  "E2K-29 a group id that could hit more than one group is refused by the signal helper",
  LIMIT,
  async () => {
    // signal 0 only asks whether the group exists, so a refusal cannot hurt this process
    for (const bad of [
      0,
      1,
      -1,
      -5,
      1.5,
      NaN,
      Infinity,
      "123",
      true,
      null,
      undefined,
      {},
    ]) {
      assert.equal(signalGroup(bad, 0), false, String(bad));
    }
    const sleeper = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      {
        detached: true,
        stdio: "ignore",
      },
    );
    const exited = new Promise((resolve) => sleeper.once("exit", resolve));
    try {
      assert.equal(signalGroup(sleeper.pid, 0), true);
      assert.equal(
        signalGroup(String(sleeper.pid), 0),
        false,
        "a number written as text",
      );
      assert.equal(signalGroup(sleeper.pid + 0.5, 0), false);
      assert.equal(signalGroup(sleeper.pid, "SIGKILL"), true);
      await exited;
      assert.equal(signalGroup(sleeper.pid, 0), false, "a gone group");
    } finally {
      try {
        process.kill(-sleeper.pid, "SIGKILL");
      } catch {
        // already gone
      }
    }
  },
);

// ---------------------------------------------------------------- criterion 7

function collector() {
  const parts = [];
  return {
    parts,
    write: (text) => parts.push(text),
    text: () => parts.join(""),
  };
}

test(
  "E2K-30 the choice of spec files: the order given, unknown and repeated names refused",
  LIMIT,
  async () => {
    assert.deepEqual(listSpecs(SPECS), [
      "empty",
      "exit-one",
      "fail",
      "pass-a",
      "pass-b",
      "skipped",
      "sleep",
      "sleep-chrome",
      "sleep-stubborn",
      "todo",
    ]);
    // only files with the exact shape of a name count
    const dir = scratch("specnames");
    try {
      for (const name of [
        "x.e2e.js",
        "A.e2e.js",
        "y.js",
        "z.e2e.js.bak",
        ".e2e.js",
        "-a.e2e.js",
        "ok-1.e2e.js",
      ]) {
        fs.writeFileSync(path.join(dir, name), "");
      }
      fs.mkdirSync(path.join(dir, "dir.e2e.js"));
      assert.deepEqual(listSpecs(dir), ["ok-1", "x"]);
      assert.deepEqual(listSpecs(path.join(dir, "absent")), []);
    } finally {
      drop(dir);
    }

    const available = ["a", "b", "c", "smoke"];
    assert.deepEqual(parseSelection([], available), {
      selection: "all",
      names: available,
    });
    assert.deepEqual(parseSelection(["b", "a"], available), {
      selection: "b,a",
      names: ["b", "a"],
    });
    assert.deepEqual(parseSelection(["smoke"], available), {
      selection: "smoke",
      names: ["smoke"],
    });
    assert.throws(
      () => parseSelection(["nosuch"], available),
      (err) =>
        err.code === "SELECTION_UNKNOWN" &&
        err.message.includes("a, b, c, smoke") &&
        !/pass|# /u.test(err.message),
    );
    for (const bad of [
      "../smoke",
      "smoke.e2e.js",
      "",
      "smoke/x",
      "SMOKE",
      " smoke",
      "a,b",
    ]) {
      assert.throws(
        () => parseSelection([bad], available),
        (err) => err.code === "SELECTION_UNKNOWN",
        JSON.stringify(bad),
      );
    }
    assert.throws(
      () => parseSelection(["a", "b", "a"], available),
      (err) => err.code === "SELECTION_DUPLICATE",
    );

    // through the runner: an unknown name stops before any browser or spec starts
    let started = 0;
    const out = collector();
    const err = collector();
    const code = await runAll({
      specDir: SPECS,
      argv: ["nosuch"],
      out,
      err,
      launch: async () => {
        started++;
        throw new Error("must not start");
      },
      spawnSpec: () => {
        started++;
        throw new Error("must not spawn");
      },
    });
    assert.equal(code, 1);
    assert.equal(started, 0);
    assert.match(err.text(), /^e2e: error=SELECTION_UNKNOWN: /u);
    assert.ok(!out.text().includes("# pass"));
    assert.match(
      out.text().trimEnd().split("\n").at(-1),
      /^e2e: command=npm run e2e -- nosuch selection=nosuch exit=1 duration_ms=[0-9]+$/u,
    );
    // no spec file in the folder
    const none = collector();
    const noneErr = collector();
    assert.equal(
      await runAll({ specDir: FIXTURES, out: none, err: noneErr }),
      1,
    );
    assert.match(noneErr.text(), /^e2e: error=NO_SPECS: /u);
    assertNothingRegistered();
  },
);

test(
  "E2K-31 the record line has the shape the requirement demands",
  LIMIT,
  () => {
    const shape =
      /^e2e: command=.+ selection=smoke exit=0 duration_ms=[0-9]+$/u;
    const line = formatRecord({
      command: "npm run e2e -- smoke",
      selection: "smoke",
      exit: 0,
      durationMs: 12345.6,
    });
    assert.match(line, shape);
    assert.ok(!line.includes("\n"));
    assert.equal(
      formatRecord({
        command: "npm run e2e",
        selection: "all",
        exit: 1,
        durationMs: 0,
      }),
      "e2e: command=npm run e2e selection=all exit=1 duration_ms=0",
    );
    assert.equal(
      formatRecord({
        command: "npm run e2e -- a b",
        selection: "a,b",
        exit: 0,
        durationMs: 2500,
      }),
      "e2e: command=npm run e2e -- a b selection=a,b exit=0 duration_ms=2500",
    );
    assert.match(
      formatRecord({
        command: "x",
        selection: "all",
        exit: 1,
        durationMs: 0.4,
      }),
      /duration_ms=[0-9]+$/u,
    );
  },
);

// The environment of the runner under test: the way `npm test` starts a test file.
function runnerEnv(extra = {}) {
  return fakeEnv("ok", { NODE_TEST_CONTEXT: "child-v8", ...extra });
}

function launchFromEnv({ env }) {
  return launchBrowser({ env });
}

async function runNames(names, options = {}) {
  const out = collector();
  const err = collector();
  let launches = 0;
  const code = await runAll({
    specDir: SPECS,
    argv: names,
    env: runnerEnv(),
    out,
    err,
    launch: (arg) => {
      launches++;
      return launchFromEnv(arg);
    },
    ...options,
  });
  return { code, out: out.text(), err: err.text(), launches };
}

function markers(text) {
  return text.split("\n").filter((line) => /^e2e: (browser|file)=/u.test(line));
}

function lastLine(text) {
  return text.trimEnd().split("\n").at(-1);
}

test(
  "E2K-32 the runner: order of the files, one browser line, stop at the first failure, no silent pass",
  LIMIT,
  async () => {
    const first = await runNames(["pass-a", "pass-b"]);
    assert.equal(first.code, 0, first.err);
    assert.deepEqual(markers(first.out), [
      "e2e: browser=FakeChrome/1.2.3",
      "e2e: file=pass-a",
      "e2e: file=pass-b",
    ]);
    assert.equal(first.launches, 1);
    assert.equal(
      (first.out.match(/^# pass 1$/gmu) ?? []).length,
      2,
      "the TAP of both files is forwarded",
    );
    assert.ok(
      first.out.indexOf("e2e: file=pass-a") <
        first.out.indexOf("e2e: file=pass-b"),
    );
    assert.match(
      lastLine(first.out),
      /^e2e: command=npm run e2e -- pass-a pass-b selection=pass-a,pass-b exit=0 duration_ms=[0-9]+$/u,
    );
    assertNothingRegistered();

    const reversed = await runNames(["pass-b", "pass-a"]);
    assert.equal(reversed.code, 0, reversed.err);
    assert.deepEqual(markers(reversed.out).slice(1), [
      "e2e: file=pass-b",
      "e2e: file=pass-a",
    ]);
    assertNothingRegistered();

    const stopped = await runNames(["pass-a", "fail", "pass-b"]);
    assert.equal(stopped.code, 1);
    assert.deepEqual(markers(stopped.out).slice(1), [
      "e2e: file=pass-a",
      "e2e: file=fail",
    ]);
    assert.ok(!stopped.out.includes("e2e: file=pass-b"));
    assert.match(stopped.err, /e2e: error=SPEC_FAILED: fail\.e2e\.js failed/u);
    assert.match(lastLine(stopped.out), /exit=1 duration_ms=[0-9]+$/u);
    assert.equal(
      stopped.out.split("\n").filter((line) => line.startsWith("e2e: command="))
        .length,
      1,
    );
    assertNothingRegistered();

    for (const [name, code] of [
      ["empty", "SPEC_NO_TESTS"],
      ["skipped", "SPEC_SKIPPED"],
      ["todo", "SPEC_SKIPPED"],
    ]) {
      const run = await runNames([name]);
      assert.equal(run.code, 1, name);
      assert.ok(
        run.err.startsWith(`e2e: error=${code}:`),
        `${name}: ${run.err}`,
      );
      assert.match(lastLine(run.out), /exit=1 duration_ms=[0-9]+$/u);
      assertNothingRegistered();
    }
    // every test passes and the process still ends with a non-zero code: the file fails.
    // The stand-in prints the passing TAP of the committed text and exits with 1.
    const passingTap = fs.readFileSync(path.join(TAPS, "normal.txt"), "utf8");
    const nonZero = await runNames(["exit-one"], {
      spawnSpec: ({ cwd, env, detached }) =>
        spawn(
          process.execPath,
          [
            "-e",
            `process.stdout.write(${JSON.stringify(passingTap)}); process.exitCode = 1;`,
          ],
          { cwd, env, detached, stdio: ["ignore", "pipe", "inherit"] },
        ),
    });
    assert.match(
      nonZero.out,
      /^# fail 0$/mu,
      "the TAP itself shows no failure",
    );
    assert.equal(nonZero.code, 1);
    assert.ok(
      nonZero.err.startsWith(
        "e2e: error=SPEC_FAILED: exit-one.e2e.js failed (exit code 1)",
      ),
      nonZero.err,
    );
    assert.match(lastLine(nonZero.out), /exit=1 duration_ms=[0-9]+$/u);
    assertNothingRegistered();
    assert.deepEqual(kitFolders(), []);
  },
);

test(
  "E2K-33 a file that hangs is stopped with its whole process group",
  LIMIT,
  async () => {
    for (const name of ["sleep", "sleep-stubborn"]) {
      const dir = scratch(name);
      try {
        const pidFile = path.join(dir, "pid");
        const leaders = [];
        const out = collector();
        const err = collector();
        const began = Date.now();
        const code = await runAll({
          specDir: SPECS,
          argv: [name],
          env: runnerEnv({ SAI_FIXTURE_PIDFILE: pidFile }),
          out,
          err,
          launch: launchFromEnv,
          fileTimeoutMs: 3000,
          killGraceMs: 500,
          spawnSpec: ({ args, cwd, env, detached }) => {
            const child = spawn(process.execPath, args, {
              cwd,
              env,
              detached,
              stdio: ["ignore", "pipe", "inherit"],
            });
            leaders.push(child.pid);
            return child;
          },
        });
        assert.equal(code, 1, name);
        assert.match(err.text(), /^e2e: error=SPEC_TIMEOUT: /u);
        assert.ok(Date.now() - began < 20000);
        assert.equal(leaders.length, 1);
        assert.ok(
          fs.existsSync(pidFile),
          "the file wrote its pid before it was stopped",
        );
        const fileChild = Number(fs.readFileSync(pidFile, "utf8"));
        assert.notEqual(
          fileChild,
          leaders[0],
          "the file runs in a child of the leader",
        );
        await until(
          () =>
            pidGone(leaders[0]) && pidGone(fileChild) && groupGone(leaders[0]),
          8000,
          `${name}: the group ending`,
        );
        assertNothingRegistered();
        assert.match(lastLine(out.text()), /exit=1 duration_ms=[0-9]+$/u);
      } finally {
        drop(dir);
      }
    }
    assert.deepEqual(kitFolders(), []);
  },
);

test(
  "E2K-34 the TAP of a spec file is read right, and the committed texts hold no path of a machine",
  LIMIT,
  () => {
    const arg = (name) => `test/fixtures/e2e/specs/${name}.e2e.js`;
    const read = (name) =>
      fs.readFileSync(path.join(TAPS, `${name}.txt`), "utf8");
    const normal = analyseTap(read("normal"), arg("pass-a"));
    assert.deepEqual(
      [
        normal.tests,
        normal.pass,
        normal.fail,
        normal.skipped,
        normal.todo,
        normal.noTests,
      ],
      [1, 1, 0, 0, 0, false],
    );
    const empty = analyseTap(read("empty"), arg("empty"));
    assert.equal(empty.tests, 1);
    assert.equal(empty.noTests, true);
    // the single-line rule is tied to the exact string
    for (const other of [
      `tools/${arg("empty")}`,
      `./${arg("empty")}`,
      path.join(TOOLS, arg("empty")),
      arg("pass-a"),
    ]) {
      assert.equal(analyseTap(read("empty"), other).noTests, false, other);
    }
    assert.equal(
      analyseTap(read("empty"), arg("empty").replaceAll("/", "\\")).noTests,
      true,
    );
    const skipped = analyseTap(read("skipped"), arg("skipped"));
    assert.deepEqual(
      [skipped.tests, skipped.skipped, skipped.todo, skipped.noTests],
      [2, 1, 0, false],
    );
    const todo = analyseTap(read("todo"), arg("todo"));
    assert.deepEqual(
      [todo.tests, todo.skipped, todo.todo, todo.noTests],
      [2, 0, 1, false],
    );
    const failing = analyseTap(read("failing"), arg("fail"));
    assert.deepEqual(
      [failing.tests, failing.pass, failing.fail, failing.noTests],
      [1, 0, 1, false],
    );
    // nothing printed by the nested run
    const nothing = analyseTap("", arg("pass-a"));
    assert.equal(nothing.tests, 0);
    assert.equal(nothing.noTests, true);
    assert.equal(analyseTap("garbage\nlines\n", arg("pass-a")).noTests, true);

    // the committed texts and spec fixtures hold no path of a machine
    const checked = [...walk(TAPS), ...walk(SPECS)];
    assert.equal(walk(TAPS).length, 5);
    assert.equal(walk(SPECS).length, 10);
    for (const file of checked) {
      const text = fs.readFileSync(file, "utf8");
      const name = path.relative(TOOLS, file);
      assert.equal(hasTempPath(text), false, `${name}: temporary path`);
      for (const line of text.split("\n")) {
        assert.equal(hasHomePath(line), false, `${name}: ${line}`);
        assert.ok(!line.includes("file:"), `${name}: ${line}`);
        assert.doesNotMatch(
          line,
          /(?:^|[\s'"([])\/[A-Za-z0-9._~-]/u,
          `${name}: ${line}`,
        );
        assert.doesNotMatch(
          line,
          /(?:^|[\s'"([])[A-Za-z]:[\\/]/u,
          `${name}: ${line}`,
        );
      }
    }
    assert.match(
      read("failing"),
      /^ {2}location: 'test\/fixtures\/e2e\/specs\/fail\.e2e\.js:\d+:\d+'$/mu,
    );
  },
);

test(
  "E2K-35 console entries and declarations: exact text, the first declaration claims, path narrows, once is once",
  LIMIT,
  () => {
    const text404 =
      "Failed to load resource: the server responded with a status of 404 (Not Found)";
    const log = (url, text = text404, kind = "browser-log") => ({
      kind,
      text,
      url: `http://127.0.0.1:5${url}`,
      page: 0,
      at: 1,
    });
    const decl = (spec) => makeDeclaration(spec);

    // exact text: neither a shorter nor a longer declaration claims
    for (const text of [
      "Failed to load resource",
      `${text404} extra`,
      text404.toLowerCase(),
    ]) {
      const result = evaluateConsole(
        [log("/x")],
        [decl({ kind: "browser-log", text })],
      );
      assert.equal(result.unexpected.length, 1, text);
      assert.equal(result.unmet.length, 1, text);
    }
    // a declaration of another kind does not claim
    const otherKind = evaluateConsole(
      [log("/x")],
      [decl({ kind: "console", text: text404 })],
    );
    assert.equal(otherKind.unexpected.length, 1);
    assert.equal(otherKind.unmet.length, 1);

    // path narrows: the favicon declaration does not claim a page 404
    const favicon = decl({
      kind: "browser-log",
      text: text404,
      path: "/favicon.ico",
      once: true,
    });
    const narrow = evaluateConsole(
      [log("/page"), log("/favicon.ico?v=2")],
      [favicon],
    );
    assert.deepEqual(
      narrow.unexpected.map((e) => new URL(e.url).pathname),
      ["/page"],
    );
    assert.equal(narrow.unmet.length, 0);
    const noUrl = evaluateConsole(
      [{ kind: "browser-log", text: text404, page: 0, at: 1 }],
      [favicon],
    );
    assert.equal(noUrl.unexpected.length, 1);

    // the first declaration, in the order of declaring, claims
    const general = decl({ kind: "browser-log", text: text404 });
    const both = evaluateConsole(
      [log("/favicon.ico"), log("/page")],
      [favicon, general],
    );
    assert.deepEqual(both, { unexpected: [], unmet: [] });
    // declared the other way round, the general one takes both and the specific one is unmet
    const swapped = evaluateConsole(
      [log("/favicon.ico"), log("/page")],
      [general, favicon],
    );
    assert.equal(swapped.unexpected.length, 0);
    assert.equal(swapped.unmet.length, 1);
    assert.equal(swapped.unmet[0].path, "/favicon.ico");

    // once: a second matching entry is unexpected; expect: no upper limit
    const twice = evaluateConsole(
      [log("/favicon.ico"), log("/favicon.ico")],
      [favicon],
    );
    assert.equal(twice.unexpected.length, 1);
    const many = evaluateConsole([log("/a"), log("/b"), log("/c")], [general]);
    assert.deepEqual(many, { unexpected: [], unmet: [] });
    // a declaration with no entry is unmet; with no declaration every entry is unexpected
    assert.equal(evaluateConsole([], [general, favicon]).unmet.length, 2);
    assert.equal(
      evaluateConsole([log("/a"), log("/b")], []).unexpected.length,
      2,
    );
    assert.deepEqual(evaluateConsole([], []), { unexpected: [], unmet: [] });

    // a declaration that never happened is an error on its own, and so is an entry
    // that no declaration claims
    const unmetOnly = consoleError([], [general]);
    assert.equal(unmetOnly.code, "CONSOLE_ENTRIES");
    assert.match(unmetOnly.message, /^0 unexpected console entries:/u);
    assert.match(unmetOnly.message, /1 declared entries did not happen:/u);
    const unexpectedOnly = consoleError([log("/a")], []);
    assert.equal(unexpectedOnly.code, "CONSOLE_ENTRIES");
    assert.match(unexpectedOnly.message, /^1 unexpected console entries:/u);

    // declarations are checked when they are made
    for (const bad of [
      { kind: 1, text: "x" },
      { kind: "console" },
      { kind: "console", text: "x", path: 5 },
    ]) {
      assert.throws(
        () => makeDeclaration(bad),
        (err) => err.code === "USAGE",
      );
    }

    // the events of the browser become entries of four kinds; warnings are not entries
    const at = { page: 0, at: 7 };
    const consoleEvent = (args, type = "error") =>
      entryFromEvent(
        { method: "Runtime.consoleAPICalled", params: { type, args } },
        at,
      );
    assert.deepEqual(
      consoleEvent([
        { type: "string", value: "x" },
        { type: "number", value: 5 },
      ]),
      {
        kind: "console",
        text: "x 5",
        page: 0,
        at: 7,
      },
    );
    assert.equal(
      consoleEvent([{ type: "string", value: "w" }], "warning"),
      null,
    );
    assert.equal(consoleEvent([{ type: "string", value: "w" }], "log"), null);
    assert.equal(
      consoleEvent([{ type: "string", value: "a" }], "assert").kind,
      "console",
    );
    const thrown = entryFromEvent(
      {
        method: "Runtime.exceptionThrown",
        params: {
          exceptionDetails: {
            text: "Uncaught",
            exception: { description: "Error: boom\n    at t" },
          },
        },
      },
      at,
    );
    assert.deepEqual([thrown.kind, thrown.text], ["exception", "Error: boom"]);
    const rejected = entryFromEvent(
      {
        method: "Runtime.exceptionThrown",
        params: {
          exceptionDetails: {
            text: "Uncaught (in promise)",
            exception: { description: "Error: rej" },
          },
        },
      },
      at,
    );
    assert.deepEqual(
      [rejected.kind, rejected.text],
      ["rejection", "Error: rej"],
    );
    const logged = entryFromEvent(
      {
        method: "Log.entryAdded",
        params: {
          entry: {
            level: "error",
            text: "t",
            url: "http://127.0.0.1:1/f",
            source: "network",
          },
        },
      },
      at,
    );
    assert.deepEqual(
      [logged.kind, logged.text, logged.url, logged.source],
      ["browser-log", "t", "http://127.0.0.1:1/f", "network"],
    );
    for (const level of ["warning", "info", "verbose"]) {
      assert.equal(
        entryFromEvent(
          { method: "Log.entryAdded", params: { entry: { level, text: "t" } } },
          at,
        ),
        null,
      );
    }
    assert.equal(
      entryFromEvent({ method: "Page.loadEventFired", params: {} }, at),
      null,
    );
    assert.equal(
      consoleEvent([{ type: "string", value: "y".repeat(900) }]).text.length,
      500,
    );
  },
);

// ---------------------------------------------------------------- criterion 6

test(
  "E2K-36 a new page gets the window and the light scheme from the kit, whatever the machine prefers",
  LIMIT,
  async () => {
    const { browser, dir, log } = await startFake("ok");
    try {
      const first = await browser.newPage();
      await first.goto("http://127.0.0.1:1/");
      await browser.newPage();
      const events = readLog(log).filter((event) => event.event === "call");
      const media = events.filter(
        (e) => e.method === "Emulation.setEmulatedMedia",
      );
      const metrics = events.filter(
        (e) => e.method === "Emulation.setDeviceMetricsOverride",
      );
      assert.equal(media.length, 2, "one per page");
      assert.equal(metrics.length, 2, "one per page");
      for (const call of media) {
        assert.deepEqual(call.params, {
          features: [{ name: "prefers-color-scheme", value: "light" }],
        });
      }
      for (const call of metrics) {
        assert.deepEqual(call.params, {
          width: 1470,
          height: 784,
          deviceScaleFactor: 1,
          mobile: false,
        });
      }
      const at = (method) => events.findIndex((e) => e.method === method);
      const navigate = at("Page.navigate");
      assert.ok(navigate > at("Emulation.setEmulatedMedia"));
      assert.ok(navigate > at("Emulation.setDeviceMetricsOverride"));
      // each page has its own session
      assert.notEqual(media[0].sessionId, media[1].sessionId);
    } finally {
      await browser.close();
      drop(dir);
    }
  },
);

// ---------------------------------------------------------------- criterion 7

const TAP_NORMAL = fs.readFileSync(path.join(TAPS, "normal.txt"), "utf8");

// A child that looks like a spec process; its output and end are given by the test.
function fakeChild({ pid = 2147483646, text = TAP_NORMAL, code = 0 } = {}) {
  const child = new EventEmitter();
  child.pid = pid;
  child.stdout = new PassThrough();
  setImmediate(() => {
    child.stdout.write(text);
    child.stdout.end();
    setImmediate(() => child.emit("close", code, null));
  });
  return child;
}

test(
  "E2K-37 the spec process gets the exact argument, folder, environment and its own process group",
  LIMIT,
  async () => {
    const recorded = [];
    const out = collector();
    const err = collector();
    const env = runnerEnv({ SAI_CHROME: FAKE });
    const code = await runAll({
      specDir: SPECS,
      argv: ["pass-a"],
      env,
      out,
      err,
      launch: launchFromEnv,
      spawnSpec: (arg) => {
        recorded.push(arg);
        return fakeChild();
      },
    });
    assert.equal(code, 0, err.text());
    assert.equal(recorded.length, 1);
    const [arg] = recorded;
    assert.deepEqual(Object.keys(arg).sort(), [
      "args",
      "cwd",
      "detached",
      "env",
    ]);
    assert.deepEqual(arg.args, [
      "--test",
      "--test-reporter=tap",
      "test/fixtures/e2e/specs/pass-a.e2e.js",
    ]);
    assert.equal(fs.realpathSync(arg.cwd), fs.realpathSync(TOOLS));
    assert.equal(arg.detached, true);
    assert.equal(Object.hasOwn(arg.env, "NODE_TEST_CONTEXT"), false);
    assert.equal(
      env.NODE_TEST_CONTEXT,
      "child-v8",
      "the environment given was not changed",
    );
    const registry = arg.env[REGISTRY_VAR];
    assert.equal(typeof registry, "string");
    assert.ok(registry.startsWith(MY_TMP + path.sep));
    const rest = { ...arg.env };
    delete rest[REGISTRY_VAR];
    const expected = { ...env };
    delete expected.NODE_TEST_CONTEXT;
    assert.deepEqual(
      rest,
      expected,
      "every other key and value passes through",
    );
    assertNothingRegistered();
    assert.deepEqual(kitFolders(), []);

    // a spec process that could not be started: SPEC_FAILED, nothing registered
    const failedErr = collector();
    const failedOut = collector();
    const failedCode = await runAll({
      specDir: SPECS,
      argv: ["pass-a", "pass-b"],
      env,
      out: failedOut,
      err: failedErr,
      launch: launchFromEnv,
      spawnSpec: () => {
        const child = new EventEmitter();
        process.nextTick(() =>
          child.emit(
            "error",
            Object.assign(new Error("spawn failed"), { code: "ENOENT" }),
          ),
        );
        return child;
      },
    });
    assert.equal(failedCode, 1);
    assert.match(
      failedErr.text(),
      /^e2e: error=SPEC_FAILED: pass-a\.e2e\.js could not be started: ENOENT$/mu,
    );
    assert.ok(
      !failedOut.text().includes("e2e: file=pass-b"),
      "the run stopped",
    );
    assertNothingRegistered();

    // a folder outside the tools folder is refused and nothing is spawned
    const outside = scratch("outside");
    try {
      let spawned = 0;
      const usageErr = collector();
      const usageCode = await runAll({
        specDir: outside,
        env,
        out: collector(),
        err: usageErr,
        launch: launchFromEnv,
        spawnSpec: () => {
          spawned++;
          return fakeChild();
        },
      });
      assert.equal(usageCode, 1);
      assert.equal(spawned, 0);
      assert.match(usageErr.text(), /^e2e: error=USAGE: /u);
    } finally {
      drop(outside);
    }

    // the pure helpers
    const plain = { PATH: "/bin", SAI_CHROME: "/x" };
    assert.deepEqual(specEnv(plain), plain);
    assert.notEqual(specEnv(plain), plain);
    const withContext = { ...plain, NODE_TEST_CONTEXT: "child-v8" };
    assert.deepEqual(specEnv(withContext), plain);
    assert.equal(withContext.NODE_TEST_CONTEXT, "child-v8");
    assert.equal(
      specArgument(SPECS, "pass-a"),
      "test/fixtures/e2e/specs/pass-a.e2e.js",
    );
    assert.equal(specArgument(E2E, "smoke"), "test/e2e/smoke.e2e.js");
    assert.throws(
      () => specArgument(scratchOutside(), "x"),
      (e) => e.code === "USAGE",
    );
  },
);

function scratchOutside() {
  return path.parse(MY_TMP).root;
}

const RUNNER_URL = moduleUrl("runner.js");
const CLEANUP_URL = moduleUrl("cleanup.js");

const INTERRUPT_SCRIPT = `import fs from "node:fs";
import { spawn } from "node:child_process";
import { runAll } from ${JSON.stringify(RUNNER_URL)};
import { launchBrowser } from ${JSON.stringify(BROWSER_URL)};
const [, , specDir, name, leaderFile] = process.argv;
const code = await runAll({
  specDir,
  argv: [name],
  launch: ({ env }) => launchBrowser({ env }),
  spawnSpec: ({ args, cwd, env, detached }) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      detached,
      stdio: ["ignore", "pipe", "inherit"],
    });
    fs.writeFileSync(leaderFile, String(child.pid));
    return child;
  },
});
process.exitCode = code;
`;

function times(text, needle) {
  return text.split(needle).length - 1;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

test(
  "E2K-38 a signal to the runner stops the running file and its browsers and prints one record",
  LIMIT,
  async () => {
    const dir = scratch("interrupt");
    try {
      const script = writeScript(dir, "runner.mjs", INTERRUPT_SCRIPT);
      for (const [signal, expected] of [
        ["SIGTERM", 143],
        ["SIGINT", 130],
        ["SIGHUP", 129],
      ]) {
        const log = path.join(dir, `${signal}.log`);
        const pidFile = path.join(dir, `${signal}.pids`);
        const leaderFile = path.join(dir, `${signal}.leader`);
        const run = runChild(
          script,
          [SPECS, "sleep-chrome", leaderFile],
          fakeEnv("with-child", {
            SAI_FAKE_CHROME_LOG: log,
            SAI_FIXTURE_PIDFILE: pidFile,
          }),
          25000,
        );
        const pids = await until(
          () => readJson(pidFile),
          15000,
          `${signal}: the browser start`,
        );
        const began = Date.now();
        run.child.kill(signal);
        await run.done;
        assert.equal(run.timedOut, false, signal);
        assert.equal(run.code, expected, `${signal}: ${run.stderr}`);
        assert.ok(Date.now() - began < 9000, `${signal}: stopped in time`);
        assert.ok(
          fs.existsSync(`${pidFile}.term`),
          `${signal}: the file was asked to stop with SIGTERM and ran its handler`,
        );
        assert.equal(
          times(run.stderr, `e2e: error=INTERRUPTED: ${signal}`),
          1,
          run.stderr,
        );
        assert.ok(!run.stderr.includes("SPEC_FAILED"));
        assert.equal(times(run.stdout, "e2e: command="), 1, run.stdout);
        assert.match(
          lastLine(run.stdout),
          /^e2e: command=.* exit=1 duration_ms=[0-9]+$/u,
        );
        const leader = Number(fs.readFileSync(leaderFile, "utf8"));
        for (const pid of [leader, pids.spec, pids.browser, ...logPids(log)]) {
          assert.ok(
            await waitGone(pid, `${signal}: a process of the run`),
            `${signal}: pid ${pid} is gone`,
          );
        }
        assert.ok(groupGone(leader));
        assert.ok(groupGone(pids.browser));
        assert.equal(
          fs.existsSync(pids.profileDir),
          false,
          `${signal}: profile folder`,
        );
        assert.deepEqual(kitFolders(), []);
      }

      // a signal during the preflight, when no file has started
      const log = path.join(dir, "preflight.log");
      const leaderFile = path.join(dir, "preflight.leader");
      const run = runChild(
        script,
        [SPECS, "sleep-chrome", leaderFile],
        fakeEnv("no-answer", { SAI_FAKE_CHROME_LOG: log }),
        25000,
      );
      await until(
        () => calls(log, "Browser.getVersion").length >= 1,
        15000,
        "the preflight call",
      );
      const began = Date.now();
      run.child.kill("SIGTERM");
      await run.done;
      assert.equal(run.timedOut, false);
      assert.equal(run.code, 143, run.stderr);
      assert.ok(Date.now() - began < 9000);
      assert.equal(
        times(run.stderr, "e2e: error=INTERRUPTED: SIGTERM"),
        1,
        run.stderr,
      );
      assert.equal(times(run.stdout, "e2e: command="), 1, run.stdout);
      assert.match(lastLine(run.stdout), /exit=1 duration_ms=[0-9]+$/u);
      assert.ok(!run.stdout.includes("e2e: file="));
      assert.equal(fs.existsSync(leaderFile), false, "no spec was started");
      for (const pid of logPids(log)) {
        assert.ok(await waitGone(pid, "the preflight stand-in"));
      }
      assert.deepEqual(kitFolders(), []);
    } finally {
      drop(dir);
    }
  },
);

const HOOK_SCRIPT = `import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { addSignalHook, hookErrors, installHandlers, registerGroup } from ${JSON.stringify(CLEANUP_URL)};
const [, , mode, dir] = process.argv;
installHandlers({ hookLimitMs: mode === "d" ? 30000 : 1000 });
const sleeper = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
  detached: true,
  stdio: "ignore",
});
registerGroup(sleeper.pid);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mark = (name, text = "1") => fs.writeFileSync(path.join(dir, name), String(text));
if (mode === "a") {
  addSignalHook(async () => {
    await wait(200);
    mark("marker-a");
  });
}
if (mode === "b" || mode === "d") addSignalHook(() => new Promise(() => {}));
if (mode === "c") {
  addSignalHook(() => {
    throw new Error("hook failed");
  });
  addSignalHook(() => mark("marker-c", hookErrors().length));
}
if (mode === "e") {
  const remove = addSignalHook(() => mark("marker-e"));
  remove();
}
if (mode === "f") {
  addSignalHook(async () => {
    await wait(600);
    mark("marker-f1");
  });
  addSignalHook(async () => {
    await wait(600);
    mark("marker-f2");
  });
}
mark("group", sleeper.pid);
mark("ready");
setInterval(() => {}, 1000);
`;

async function hookCase(script, mode, signals) {
  const dir = scratch(`hooks-${mode}`);
  try {
    const run = runChild(script, [mode, dir], { ...process.env }, 15000);
    await until(
      () => fs.existsSync(path.join(dir, "ready")),
      10000,
      "the child setup",
    );
    const group = Number(fs.readFileSync(path.join(dir, "group"), "utf8"));
    const began = Date.now();
    for (const [i, [signal, delay]] of signals.entries()) {
      if (i > 0) await sleep(delay);
      run.child.kill(signal);
    }
    await run.done;
    const elapsed = Date.now() - began;
    await until(() => groupGone(group), 5000, "the group ending");
    const markers = fs
      .readdirSync(dir)
      .filter((name) => name.startsWith("marker-"));
    const texts = Object.fromEntries(
      markers.map((name) => [
        name,
        fs.readFileSync(path.join(dir, name), "utf8"),
      ]),
    );
    return { run, elapsed, markers, texts };
  } finally {
    drop(dir);
  }
}

test(
  "E2K-46 the runner process ends at once after the record line: no timer of a finished file is left armed",
  LIMIT,
  async () => {
    const dir = scratch("prompt-exit");
    try {
      const script = writeScript(dir, "runner.mjs", INTERRUPT_SCRIPT);
      const leaderFile = path.join(dir, "leader");
      const run = runChild(
        script,
        [SPECS, "pass-a", leaderFile],
        fakeEnv("ok"),
        15000,
      );
      let recordAt = null;
      run.child.stdout.on("data", () => {
        if (recordAt === null && run.stdout.includes("\ne2e: command=")) {
          recordAt = Date.now();
        }
      });
      await run.done;
      const endedAt = Date.now();
      assert.equal(run.timedOut, false, "the process did not end by itself");
      assert.equal(run.code, 0, run.stderr);
      assert.match(lastLine(run.stdout), /^e2e: command=.* exit=0 /u);
      assert.notEqual(recordAt, null, run.stdout);
      // the file timeout of the runner is 120000 ms: a timer left armed would hold the process that long
      assert.ok(
        endedAt - recordAt < 4000,
        `the process ended ${endedAt - recordAt} ms after the record line`,
      );
      assert.ok(groupGone(Number(fs.readFileSync(leaderFile, "utf8"))));
      assert.deepEqual(kitFolders(), []);
    } finally {
      drop(dir);
    }
  },
);

test(
  "E2K-39 signal hooks: awaited together, limited, a throwing hook and a second signal do not stop the clean-up",
  LIMIT,
  async () => {
    const dir = scratch("hook-script");
    try {
      const script = writeScript(dir, "hooks.mjs", HOOK_SCRIPT);
      // (a) a hook is awaited before the exit; SIGHUP gives 129
      const a = await hookCase(script, "a", [["SIGHUP"]]);
      assert.equal(a.run.code, 129, a.run.stderr);
      assert.deepEqual(a.markers, ["marker-a"]);
      // (b) a hook that never answers: the exit comes after the limit, not before, not never
      const b = await hookCase(script, "b", [["SIGTERM"]]);
      assert.equal(b.run.timedOut, false);
      assert.equal(b.run.code, 143, b.run.stderr);
      assert.ok(b.elapsed >= 900 && b.elapsed < 8000, `${b.elapsed} ms`);
      // (c) a hook that throws: the other hook and the clean-up still run
      const c = await hookCase(script, "c", [["SIGTERM"]]);
      assert.equal(c.run.code, 143, c.run.stderr);
      assert.deepEqual(c.markers, ["marker-c"]);
      assert.equal(
        c.texts["marker-c"],
        "1",
        "the error of the first hook was kept",
      );
      // (d) a second signal ends the wait at once, with the code of the first signal
      const d = await hookCase(script, "d", [["SIGTERM"], ["SIGINT", 300]]);
      assert.equal(d.run.timedOut, false);
      assert.equal(d.run.code, 143, d.run.stderr);
      assert.ok(d.elapsed < 4000, `${d.elapsed} ms`);
      // (e) a hook that was removed is never called
      const e = await hookCase(script, "e", [["SIGTERM"]]);
      assert.equal(e.run.code, 143, e.run.stderr);
      assert.deepEqual(e.markers, []);
      // (f) two hooks run at once: both finish inside a limit that is shorter than their sum
      const f = await hookCase(script, "f", [["SIGTERM"]]);
      assert.equal(f.run.code, 143, f.run.stderr);
      assert.deepEqual(f.markers.sort(), ["marker-f1", "marker-f2"]);
      assert.ok(f.elapsed < 4000);
    } finally {
      drop(dir);
    }
  },
);

test(
  "E2K-40 the scripts: e2e is the command, test stays free of the browser, check ends with e2e",
  LIMIT,
  () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"),
    );
    assert.equal(pkg.scripts.e2e, "node test/e2e/run.js");
    assert.equal(pkg.scripts.test, 'node --test "test/**/*.test.js"');
    const keys = Object.keys(pkg.scripts);
    assert.equal(keys.indexOf("e2e"), keys.indexOf("test") + 1);
    assert.equal(keys.indexOf("check"), keys.indexOf("e2e") + 1);
    assert.equal(keys.at(-1), "check");
    assert.deepEqual(
      pkg.scripts.check.split("&&").map((step) => step.trim()),
      [
        "npm run format:check",
        "npm run lint",
        "npm run traces",
        "npm run handoffs-check",
        "npm run test",
        "npm run e2e",
      ],
    );
    assert.ok(!pkg.scripts.check.includes("|"));
  },
);

test(
  "E2K-41 duration_ms is the whole-number difference of the clock",
  LIMIT,
  async () => {
    const record = async (start, end) => {
      const out = collector();
      let first = true;
      await runAll({
        specDir: SPECS,
        argv: ["nosuch"],
        out,
        err: collector(),
        now: () => {
          if (first) {
            first = false;
            return start;
          }
          return end;
        },
      });
      return lastLine(out.text());
    };
    assert.match(await record(1000, 3500), /exit=1 duration_ms=2500$/u);
    assert.match(await record(10.2, 12.6), /exit=1 duration_ms=2$/u);
    assert.match(await record(5, 5), /exit=1 duration_ms=0$/u);
    const readme = fs.readFileSync(path.join(TOOLS, "README.md"), "utf8");
    const section = readme.slice(
      readme.indexOf("## End-to-end tests in a real browser"),
    );
    for (const word of ["duration_ms", "30000", "240000"]) {
      assert.ok(section.includes(word), word);
    }
  },
);

test(
  "E2K-42 what the runner prints is whole, on the right lines, and safe to put in a log",
  LIMIT,
  async () => {
    // the places tried for Chrome stay on separate lines (the whole message is printed)
    const missing = collector();
    const missingOut = collector();
    const code = await runAll({
      specDir: SPECS,
      env: { PATH: "" },
      out: missingOut,
      err: missing,
      launch: async ({ env }) => findChrome({ env, exists: () => false }),
    });
    assert.equal(code, 1);
    const lines = missing.text().split("\n");
    assert.ok(
      lines[0].startsWith(
        "e2e: error=CHROME_NOT_FOUND: no Chrome or Chromium found.",
      ),
    );
    for (const [i, place] of PLACES.entries()) {
      assert.ok(
        lines.some(
          (line) => line.startsWith(`  ${i + 1}) `) && line.includes(place),
        ),
        place,
      );
    }
    assert.ok(lines.includes("  5) chromium-browser (in PATH)"));
    assert.ok(!missingOut.text().includes("e2e: browser="));
    assert.match(lastLine(missingOut.text()), /exit=1 duration_ms=[0-9]+$/u);

    // an error that is not of the kit is one line
    const internal = collector();
    await runAll({
      specDir: SPECS,
      out: collector(),
      err: internal,
      launch: async () => {
        throw new Error("first line\nsecond line\n::error::third");
      },
    });
    assert.equal(internal.text(), "e2e: error=INTERNAL: first line\n");

    // an argument of the operator: no line starts with "::", newlines are shown as text,
    // a very long one is cut
    for (const argument of [
      "bad\n::error::x",
      "::error::y",
      `x${"a".repeat(100000)}`,
    ]) {
      const o = collector();
      const e = collector();
      const result = await runAll({
        specDir: SPECS,
        argv: [argument],
        out: o,
        err: e,
      });
      assert.equal(result, 1);
      for (const text of [o.text(), e.text()]) {
        assert.ok(
          !text.split("\n").some((line) => line.startsWith("::")),
          text.slice(0, 200),
        );
        assert.ok(text.length < 1500, `${text.length} characters`);
      }
      assert.equal(
        e
          .text()
          .split("\n")
          .filter((line) => line !== "").length,
        1,
      );
      assert.equal(
        o
          .text()
          .split("\n")
          .filter((line) => line !== "").length,
        1,
      );
      assert.ok(e.text().startsWith("e2e: error=SELECTION_UNKNOWN: "));
    }
    const multi = collector();
    await runAll({
      specDir: SPECS,
      argv: ["a\nb"],
      out: collector(),
      err: multi,
    });
    assert.ok(multi.text().includes("a\\nb"));

    // SAI_CHROME with a newline, a leading "::" or a huge value
    const values = [
      path.join(path.sep, "no", "such\n::error::x"),
      "::x\ny",
      path.join(path.sep, "no", `${"b".repeat(100000)}`),
    ];
    for (const value of values) {
      assert.throws(
        () => findChrome({ env: { SAI_CHROME: value }, exists: () => false }),
        (err) =>
          err.code === "CHROME_NOT_FOUND" &&
          !err.message.includes("\n") &&
          err.message.length < 1500 &&
          !err.message.split("\n").some((line) => line.startsWith("::")),
      );
      const e = collector();
      await runAll({
        specDir: SPECS,
        env: { SAI_CHROME: value },
        out: collector(),
        err: e,
        launch: async ({ env }) => findChrome({ env, exists: () => false }),
      });
      assert.equal(
        e
          .text()
          .split("\n")
          .filter((line) => line !== "").length,
        1,
      );
      assert.ok(!e.text().startsWith("::"));
      assert.ok(e.text().length < 1600);
    }
    assertNothingRegistered();
  },
);

async function stoppedWithBrowser(block) {
  const dir = scratch(`blocked-${block}`);
  try {
    const log = path.join(dir, "log.jsonl");
    const pidFile = path.join(dir, "pids");
    const out = collector();
    const err = collector();
    const code = await runAll({
      specDir: SPECS,
      argv: ["sleep-chrome"],
      env: fakeEnv("with-child", {
        SAI_FAKE_CHROME_LOG: log,
        SAI_FIXTURE_PIDFILE: pidFile,
        SAI_FIXTURE_BLOCK: block,
      }),
      out,
      err,
      launch: launchFromEnv,
      fileTimeoutMs: 4000,
      killGraceMs: 500,
    });
    assert.equal(code, 1, `block=${block}: ${err.text()}`);
    assert.match(err.text(), /^e2e: error=SPEC_TIMEOUT: /u);
    const pids = readJson(pidFile);
    assert.ok(pids, "the file started its browser before it was stopped");
    assert.equal(typeof pids.profileDir, "string");
    // the browser of the file and everything it started are gone, its folder too
    for (const pid of [pids.spec, pids.browser, ...logPids(log)]) {
      await until(
        () => pidGone(pid),
        5000,
        `block=${block}: pid ${pid} ending`,
      );
    }
    assert.ok(groupGone(pids.browser));
    assert.equal(fs.existsSync(pids.profileDir), false);
    assert.deepEqual(kitFolders(), []);
    assertNothingRegistered();
  } finally {
    drop(dir);
  }
}

test(
  "E2K-43 a file that hangs after it started a browser leaves no process and no folder",
  LIMIT,
  () => stoppedWithBrowser("0"),
);

test(
  "E2K-45 a file that blocks its own event loop after it started a browser leaves no process and no folder",
  LIMIT,
  () => stoppedWithBrowser("1"),
);

// ---------------------------------------------------------------- the registry of browsers

test(
  "E2K-44 the list of browsers of the runner: written from the spec's own environment, swept after a spec, strict about what it trusts",
  LIMIT,
  async () => {
    const registry = makeBrowserRegistry();
    const outer = fs.mkdtempSync(path.join(OUTER_TMP, "sai-kit-outside-"));
    const stoppedPids = [];
    const workDirs = [];
    try {
      // (a) the launch option env has no such variable (and a wrong one): a record is written
      // from the environment of this process, and removed when the browser is closed
      process.env[REGISTRY_VAR] = registry;
      const lacking = await startFake("ok");
      workDirs.push(lacking.dir);
      const wrong = await startFake("ok");
      workDirs.push(wrong.dir);
      assert.deepEqual(
        fs.readdirSync(registry).sort(),
        [`${lacking.browser.pid}.json`, `${wrong.browser.pid}.json`].sort(),
      );
      const record = JSON.parse(
        fs.readFileSync(
          path.join(registry, `${lacking.browser.pid}.json`),
          "utf8",
        ),
      );
      assert.deepEqual(record, {
        pgid: lacking.browser.pid,
        profileDir: lacking.browser.profileDir,
      });
      await lacking.browser.close();
      await wrong.browser.close();
      assert.deepEqual(fs.readdirSync(registry), []);

      // a launch whose env option carries a wrong value of the variable still writes into ours
      const decoy = path.join(outer, "decoy");
      fs.mkdirSync(decoy);
      const log = path.join(lacking.dir, "log2.jsonl");
      const odd = await launchBrowser({
        env: fakeEnv("ok", { SAI_FAKE_CHROME_LOG: log, [REGISTRY_VAR]: decoy }),
      });
      assert.deepEqual(fs.readdirSync(registry), [`${odd.pid}.json`]);
      assert.deepEqual(fs.readdirSync(decoy), []);
      await odd.close();

      // (b) a browser that is not closed is killed by the sweep, folder and record gone
      const open = await startFake("with-child");
      workDirs.push(open.dir);
      const child = readLog(open.log).find(
        (event) => event.event === "child",
      ).pid;
      assert.equal(sweepBrowserRegistry(registry), 1);
      await until(
        () => pidGone(open.browser.pid) && pidGone(child),
        5000,
        "the sweep",
      );
      assert.equal(fs.existsSync(open.browser.profileDir), false);
      assert.deepEqual(fs.readdirSync(registry), []);
      stoppedPids.push(open.browser.pid);
      await open.browser.close();

      // (c) no variable: no record, no failure
      delete process.env[REGISTRY_VAR];
      const bare = await startFake("ok");
      workDirs.push(bare.dir);
      assert.deepEqual(fs.readdirSync(registry), []);
      await bare.browser.close();

      // (d) a variable that points outside the temporary root: nothing is written there
      process.env[REGISTRY_VAR] = outer;
      const outside = await startFake("ok");
      workDirs.push(outside.dir);
      assert.deepEqual(fs.readdirSync(outer), ["decoy"]);
      await outside.browser.close();
      delete process.env[REGISTRY_VAR];

      // (e) records that are not of the exact shape are not trusted
      const sleeper = spawn(
        process.execPath,
        ["-e", "setInterval(() => {}, 1000)"],
        {
          detached: true,
          stdio: "ignore",
        },
      );
      const deepSleepers = [];
      try {
        const wrongShape = scratch("wrong-shape");
        workDirs.push(wrongShape);
        const goodShape = fs.mkdtempSync(path.join(MY_TMP, "sai-e2e-profile-"));
        workDirs.push(goodShape);
        const write = (name, body) =>
          fs.writeFileSync(path.join(registry, name), JSON.stringify(body));
        write(`${sleeper.pid}.json`, {
          pgid: sleeper.pid,
          profileDir: wrongShape,
        });
        write("1.json", { pgid: 1, profileDir: goodShape });
        write(`${process.pid}.json`, {
          pgid: process.pid,
          profileDir: goodShape,
        });
        write("9999999.json", { pgid: 123, profileDir: goodShape });
        write("foreign.json", { pgid: sleeper.pid, profileDir: goodShape });
        write("0.json", { pgid: 0, profileDir: goodShape });
        write("12.json", { pgid: 12, profileDir: outer });
        // a folder with the right name, but one level deeper than the temporary root
        const nestedParent = scratch("nested-profile");
        workDirs.push(nestedParent);
        const nested = path.join(nestedParent, "sai-e2e-profile-nested");
        fs.mkdirSync(nested);
        const deepSleeper = spawn(
          process.execPath,
          ["-e", "setInterval(() => {}, 1000)"],
          { detached: true, stdio: "ignore" },
        );
        deepSleepers.push(deepSleeper);
        write(`${deepSleeper.pid}.json`, {
          pgid: deepSleeper.pid,
          profileDir: nested,
        });
        fs.writeFileSync(path.join(registry, "13.json"), "not json");
        assert.equal(sweepBrowserRegistry(registry), 0);
        assert.ok(
          !pidGone(deepSleeper.pid),
          "a record of a folder one level too deep killed nothing",
        );
        assert.ok(fs.existsSync(nested), "the deeper folder was not removed");
        assert.ok(
          !pidGone(sleeper.pid),
          "a record of the wrong shape killed nothing",
        );
        assert.ok(fs.existsSync(wrongShape));
        assert.ok(
          fs.existsSync(goodShape),
          "no folder was removed on a record that is not trusted",
        );
        assert.ok(fs.existsSync(outer));
        // names that are not of the shape "<number>.json" are neither used nor removed
        assert.deepEqual(fs.readdirSync(registry).sort(), [
          "0.json",
          "foreign.json",
        ]);
        fs.rmSync(path.join(registry, "0.json"));
        fs.rmSync(path.join(registry, "foreign.json"));
        // the same record with the right folder shape and a live group is trusted once
        write(`${sleeper.pid}.json`, {
          pgid: sleeper.pid,
          profileDir: goodShape,
        });
        assert.equal(sweepBrowserRegistry(registry), 1);
        await until(() => pidGone(sleeper.pid), 5000, "the sleeper ending");
        assert.equal(fs.existsSync(goodShape), false);
        assert.equal(sweepBrowserRegistry(path.join(registry, "absent")), 0);
      } finally {
        for (const one of [sleeper, ...deepSleepers]) {
          try {
            process.kill(-one.pid, "SIGKILL");
          } catch {
            // gone already
          }
        }
      }
    } finally {
      delete process.env[REGISTRY_VAR];
      dropBrowserRegistry(registry);
      drop(outer);
      for (const dir of workDirs) drop(dir);
    }
    for (const pid of stoppedPids) assert.ok(pidGone(pid));
    assertNothingRegistered();
    assert.deepEqual(kitFolders(), []);
  },
);

// ---------------------------------------------------------------- criteria 10, 11

const SCANNED = () => [
  ...walk(KIT),
  path.join(E2E, "run.js"),
  path.join(E2E, "smoke.e2e.js"),
  fileURLToPath(import.meta.url),
  FAKE,
];

test(
  "E2K-50 the scanned files hold no skip, no turned-off rule, no secret, and read only the named variables",
  LIMIT,
  () => {
    const files = SCANNED();
    const here = fileURLToPath(import.meta.url);
    const ENV_NAMES = new Set([
      "SAI_CHROME",
      "PATH",
      "TMPDIR",
      "SAI_FAKE_CHROME_MODE",
      "SAI_FAKE_CHROME_LOG",
      "SAI_FIXTURE_PIDFILE",
    ]);
    const bare = new RegExp(
      ["process", "\\.env(?![.\\[A-Za-z0-9_])"].join(""),
      "gu",
    );
    const property = new RegExp(
      ["process", "\\.env\\.([A-Za-z_][A-Za-z0-9_]*)"].join(""),
      "gu",
    );
    const literal = new RegExp(
      ["process", "\\.env\\[\\s*[\"']([^\"']+)[\"']\\s*\\]"].join(""),
      "gu",
    );
    const computed = new RegExp(
      ["process", "\\.env\\[(?!\\s*[\"'])"].join(""),
      "gu",
    );
    const bareAllowed = new Map([
      ["find-chrome.js", 1],
      ["browser.js", 1],
      ["runner.js", 1],
    ]);
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      const name = path.relative(TOOLS, file);
      const base = path.basename(file);
      for (const token of BAD_TOKENS)
        assert.ok(!text.includes(token), `${name}: ${token}`);
      assert.doesNotMatch(text, BAD_OPTION, name);
      for (const shape of SECRET_SHAPES) assert.doesNotMatch(text, shape, name);
      for (const m of text.matchAll(property)) {
        assert.ok(ENV_NAMES.has(m[1]), `${name}: reads ${m[1]}`);
      }
      for (const m of text.matchAll(literal)) {
        assert.ok(ENV_NAMES.has(m[1]), `${name}: reads ${m[1]}`);
      }
      const bareCount = [...text.matchAll(bare)].length;
      if (file !== here) {
        assert.equal(
          bareCount,
          bareAllowed.get(base) ?? 0,
          `${name}: the whole environment object`,
        );
      }
      // a computed key is the variable of the list of browsers, in the kit's cleanup only
      const computedCount = [...text.matchAll(computed)].length;
      if (base === "cleanup.js") assert.equal(computedCount, 1, name);
      else if (file !== here) assert.equal(computedCount, 0, name);
      // the variable of the nested test runner is named in the runner and in this file only
      if (base !== "runner.js" && file !== here) {
        assert.ok(!text.includes("NODE_TEST_CONTEXT"), name);
      }
    }
    assert.ok(
      fs
        .readFileSync(path.join(KIT, "runner.js"), "utf8")
        .includes("NODE_TEST_CONTEXT"),
    );
    assert.ok(
      fs
        .readFileSync(path.join(KIT, "cleanup.js"), "utf8")
        .includes("[REGISTRY_VAR]"),
    );
    // the only files of the fixtures that are not scanned are the specs and the tap texts
    const unscanned = walk(FIXTURES)
      .filter((file) => !files.includes(file))
      .map((file) => path.relative(FIXTURES, file).split(path.sep)[0])
      .sort();
    assert.ok(
      unscanned.every((top) => top === "specs" || top === "tap"),
      unscanned.join(","),
    );
    assert.ok(files.includes(FAKE));
  },
);

test(
  "E2K-60 the README of tools/ has the section, its tokens, the table row and the six steps",
  LIMIT,
  () => {
    const readme = fs.readFileSync(path.join(TOOLS, "README.md"), "utf8");
    const heading = "## End-to-end tests in a real browser";
    assert.equal(
      readme.split("\n").filter((line) => line === heading).length,
      1,
    );
    const start = readme.indexOf(`\n${heading}\n`) + 1;
    const rest = readme.slice(start + heading.length);
    const next = rest.search(/\n## /u);
    const section = next === -1 ? rest : rest.slice(0, next);
    for (const token of [
      "SAI_CHROME",
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
      "e2e: browser=",
      "e2e: file=",
      "e2e: command=",
      "duration_ms",
      "30000",
      "240000",
      "npm run e2e",
      "npm run e2e -- smoke",
      "withBrowser",
      "evaluate",
      "TMPDIR",
      "SIGINT",
      "SIGTERM",
      "SIGHUP",
      "sandbox",
      "never skipped",
      "REQ-105",
      "REQ-106",
      "REQ-107",
    ]) {
      assert.ok(section.includes(token), `the section lacks: ${token}`);
    }
    assert.match(section, /^\|\s*smoke\.e2e\.js\s*\|\s*REQ-104\s*\|$/mu);

    const checkAt = readme.indexOf("\n## Check");
    assert.ok(checkAt >= 0);
    const afterCheck = readme.slice(checkAt + 1);
    const checkEnd = afterCheck.slice(3).search(/\n## /u);
    const check =
      checkEnd === -1 ? afterCheck : afterCheck.slice(0, checkEnd + 3);
    let from = 0;
    for (const step of [
      "npm run format:check",
      "npm run lint",
      "npm run traces",
      "npm run handoffs-check",
      "npm run test",
      "npm run e2e",
    ]) {
      const at = check.indexOf(step, from);
      assert.ok(at >= from, `the sentence of Check names ${step} in order`);
      from = at + step.length;
    }
    assert.ok(
      section.includes("the sixth and last step of `npm run check`"),
      "the section names e2e as the sixth and last step of the check",
    );
  },
);

test(
  "E2K-61 the root README names Chrome, and the departure from decision 0023 is on record",
  LIMIT,
  () => {
    const root = path.resolve(TOOLS, "..");
    const readme = fs
      .readFileSync(path.join(root, "README.md"), "utf8")
      .split("\n");
    const at = readme.indexOf("## How to open on another computer");
    assert.ok(at >= 0);
    const end = readme.findIndex((line, i) => i > at && line.startsWith("1. "));
    assert.ok(end > at);
    const paragraph = readme.slice(at + 1, end).join("\n");
    assert.ok(paragraph.includes("Chrome"));
    assert.ok(paragraph.includes("SAI_CHROME"));
    assert.ok(paragraph.includes("fails"));
    assert.ok(!paragraph.includes("://"));

    const toolsReadme = fs.readFileSync(path.join(TOOLS, "README.md"), "utf8");
    const checkAt = toolsReadme.indexOf("\n## Check");
    const checkText = toolsReadme.slice(
      checkAt,
      checkAt + toolsReadme.slice(checkAt + 4).search(/\n## /u) + 4,
    );
    assert.ok(checkText.includes("Chrome"));
    assert.ok(checkText.includes("SAI_CHROME"));

    const decision = fs.readFileSync(
      path.join(root, "decisions", "0107-e2e-real-chrome-in-check.md"),
      "utf8",
    );
    assert.equal(
      decision
        .split("\n")
        .filter((line) => /^Status: \*\*accepted\*\*/u.test(line)).length,
      1,
    );
    assert.ok(decision.includes("REQ-104"));
  },
);

test(
  "E2K-51 at the end nothing the kit made is left: no group, no folder, no hook",
  LIMIT,
  () => {
    assertNothingRegistered();
    assert.deepEqual(kitFolders(), []);
    // every folder this file made was removed by its test
    assert.deepEqual(fs.readdirSync(MY_TMP), []);
  },
);
