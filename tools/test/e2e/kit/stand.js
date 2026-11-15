import { spawn as nodeSpawn } from "node:child_process";
import path from "node:path";
import {
  installHandlers,
  makeTempDir,
  noteBrowserForRunner,
  registerGroup,
  removeTempDir,
  signalGroup,
  unregisterGroup,
  waitGroupGone,
} from "./cleanup.js";
import { E2eError, safeText } from "./errors.js";
import { assertLoopbackUrl, assertUnderTempRoot, repoRoot } from "./guards.js";

// Starts a server process of Sai for a page spec as its own process group, reads
// its link from stdout, and stops it (docs/design/REQ-105-e2e-picker.md, section
// 4.1). Clean-up is registered at spawn, before the first wait.

const KEPT_CHARS = 65536;
const NAME = /^[a-z0-9-]{1,24}$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const GONE_WAIT_MS = 3000;
const DRAIN_WAIT_MS = 1000;
const MAX_TIMER_MS = 2147483647; // Node fires a longer timer after 1 ms

// The only variables of the spec process that the starter passes to the server,
// each read by name: no token or switch of the developer's shell, no HOME variable.
// The home folder itself is not hidden: Node finds it through the system's list of
// users (decisions/0109). The system and Node may add variables of their own, none
// given by the starter: __CF_USER_TEXT_ENCODING on macOS, and NODE_V8_COVERAGE when
// the spec process has it.
function baseEnvironment() {
  const named = {
    PATH: process.env.PATH,
    TMPDIR: process.env.TMPDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    LANG: process.env.LANG,
    LC_ALL: process.env.LC_ALL,
    TZ: process.env.TZ,
    SystemRoot: process.env.SystemRoot,
  };
  const out = {};
  for (const [key, value] of Object.entries(named)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function usage(message) {
  return new E2eError("USAGE", `startStand: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkOptions(options) {
  if (!isPlainObject(options)) throw usage("the options must be an object");
  const {
    name,
    args,
    readyPattern,
    cwd = path.join(repoRoot(), "tools"),
    env = {},
    stateDirs = [],
    startTimeoutMs = 15000,
    stopTimeoutMs = 10000,
  } = options;
  if (typeof name !== "string" || !NAME.test(name)) {
    throw usage("name must match ^[a-z0-9-]{1,24}$");
  }
  if (
    !Array.isArray(args) ||
    args.length === 0 ||
    args.some((arg) => typeof arg !== "string" || arg.includes("\0"))
  ) {
    throw usage("args must be a non-empty list of strings without NUL");
  }
  if (
    !(readyPattern instanceof RegExp) ||
    readyPattern.global ||
    readyPattern.sticky
  ) {
    throw usage("readyPattern must be a RegExp without the flags g and y");
  }
  // an empty alternative added to the source tells how many groups the pattern has
  const groups = new RegExp(`${readyPattern.source}|`, readyPattern.flags).exec(
    "",
  );
  if (groups.length !== 2) {
    throw usage("readyPattern must have exactly one capture group");
  }
  if (typeof cwd !== "string" || cwd === "" || cwd.includes("\0")) {
    throw usage("cwd must be a non-empty path without NUL");
  }
  if (!isPlainObject(env)) throw usage("env must be an object");
  for (const [key, value] of Object.entries(env)) {
    if (!ENV_NAME.test(key)) {
      throw usage(`env name "${safeText(key, 40)}" is not a variable name`);
    }
    if (typeof value !== "string" || value.includes("\0")) {
      throw usage(`env value of ${key} must be a string without NUL`);
    }
  }
  if (!Array.isArray(stateDirs)) throw usage("stateDirs must be a list");
  for (const [label, value] of [
    ["startTimeoutMs", startTimeoutMs],
    ["stopTimeoutMs", stopTimeoutMs],
  ]) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_TIMER_MS) {
      throw usage(
        `${label} must be a whole number of milliseconds from 1 to ${MAX_TIMER_MS}`,
      );
    }
  }
  return {
    name,
    args,
    readyPattern,
    cwd,
    env,
    stateDirs,
    startTimeoutMs,
    stopTimeoutMs,
  };
}

function exitInfoOf(exit) {
  return exit.signal ? `signal ${exit.signal}` : `exit code ${exit.code}`;
}

function lastLineOf(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.length ? lines[lines.length - 1] : "";
}

function keep(kept, chunk) {
  const text = kept + chunk;
  return text.length > KEPT_CHARS ? text.slice(-KEPT_CHARS) : text;
}

export class Stand {
  #state;
  #marker;
  #stopTimeoutMs;
  #stopPromise = null;
  #sentTerm = false;

  constructor({ name, pid, url, stateDirs, state, marker, stopTimeoutMs }) {
    const parsed = new URL(url);
    this.name = name;
    this.pid = pid;
    this.url = url;
    this.origin = parsed.origin;
    this.port = Number(parsed.port);
    this.stateDirs = Object.freeze([...stateDirs]);
    this.#state = state;
    this.#marker = marker;
    this.#stopTimeoutMs = stopTimeoutMs;
    Object.freeze(this);
  }

  stdout() {
    return this.#state.out;
  }

  stderr() {
    return this.#state.err;
  }

  isRunning() {
    return this.#state.exit === null;
  }

  exitInfo() {
    return this.#state.exit === null ? null : { ...this.#state.exit };
  }

  // Idempotent: every call returns the same promise, SIGTERM is sent once.
  stop() {
    if (this.#stopPromise === null) this.#stopPromise = this.#doStop();
    return this.#stopPromise;
  }

  async #doStop() {
    const state = this.#state;
    let timedOut = false;
    if (state.exit === null) {
      this.#sentTerm = true;
      signalGroup(this.pid, "SIGTERM");
      let timer;
      const limit = new Promise((resolve) => {
        timer = setTimeout(() => resolve("timeout"), this.#stopTimeoutMs);
      });
      try {
        timedOut = (await Promise.race([state.exited, limit])) === "timeout";
      } finally {
        clearTimeout(timer);
      }
    }
    // whatever the main process left behind (a child of its own) goes with SIGKILL
    signalGroup(this.pid, "SIGKILL");
    const gone = await waitGroupGone(this.pid, GONE_WAIT_MS);
    // a group that survived SIGKILL is reported below, not waited for
    if (gone) {
      await state.exited;
      await state.closed;
    }
    unregisterGroup(this.pid);
    let markerReason = null;
    try {
      removeTempDir(this.#marker);
    } catch (err) {
      markerReason = `the folder could not be removed (${err.code ?? "error"})`;
    }
    const exit = state.exit;
    if (!gone || markerReason !== null) {
      // the end of the main process closes the message
      const end =
        exit === null
          ? "the main process did not end"
          : `the main process ended with ${exitInfoOf(exit)}`;
      throw new E2eError(
        "CLEANUP_FAILED",
        `could not clean up "${this.name}": pid ${this.pid}: ` +
          `${gone ? markerReason : "the process group is still alive after SIGKILL"}; ${end}`,
        { pid: this.pid },
      );
    }
    if (timedOut) {
      throw new E2eError(
        "STAND_STOP_TIMEOUT",
        `${this.name} did not stop in ${this.#stopTimeoutMs} ms after SIGTERM; it was killed`,
        { pid: this.pid },
      );
    }
    // the only good end is code 0 after the SIGTERM of stop(): a stand is a server,
    // so one that ended by itself fails whatever its code (decisions/0109)
    if (!this.#sentTerm || exit.code !== 0 || exit.signal) {
      throw new E2eError(
        "STAND_EXIT",
        `${this.name} ended with ${exitInfoOf(exit)}` +
          `${this.#sentTerm ? " after SIGTERM" : " on its own"}. ` +
          `Last line of its stderr: "${safeText(lastLineOf(state.err), 300)}"`,
        { pid: this.pid, exitCode: exit.code, signal: exit.signal },
      );
    }
    return { code: 0, signal: null };
  }
}

// Kills the group, waits for it, removes the registration and the marker folder.
// A child that could not be started has no pid and no group: only the folder goes.
async function abortStart(pid, marker) {
  if (pid !== undefined) {
    signalGroup(pid, "SIGKILL");
    await waitGroupGone(pid, GONE_WAIT_MS);
    unregisterGroup(pid);
  }
  try {
    removeTempDir(marker);
  } catch {
    // the exit handler tries again
  }
}

// startStand(options, deps?) -> Stand. `deps.spawn` is for the tests only.
export async function startStand(options, deps = {}) {
  const spawn = deps?.spawn ?? nodeSpawn;
  if (typeof spawn !== "function") throw usage("deps.spawn must be a function");
  const {
    name,
    args,
    readyPattern,
    cwd,
    env,
    stateDirs,
    startTimeoutMs,
    stopTimeoutMs,
  } = checkOptions(options);
  // every state folder is checked before anything is made or started
  const realStateDirs = stateDirs.map((dir) => assertUnderTempRoot(dir));
  const marker = makeTempDir("profile");

  let child;
  try {
    child = spawn(process.execPath, args, {
      cwd,
      env: { ...baseEnvironment(), ...env },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    await abortStart(undefined, marker);
    throw new E2eError(
      "STAND_START_FAILED",
      `could not start "${name}": ${err.code ?? "error"}`,
      {},
      err,
    );
  }
  const pid = child.pid;
  if (pid !== undefined) {
    registerGroup(pid, marker);
    noteBrowserForRunner(pid, marker);
    installHandlers();
  }

  const state = { out: "", err: "", exit: null, exited: null, closed: null };
  let resolveExited;
  let resolveClosed;
  state.exited = new Promise((resolve) => {
    resolveExited = resolve;
  });
  state.closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });
  let drainTimer;
  let settled = false;
  let settle;

  // the outcome of the start is told by its kind, not by a value that may be missing
  const outcome = new Promise((resolve) => {
    // every path that ends the wait clears the timer (a timer left armed keeps the
    // spec process alive for its whole time)
    const timer = setTimeout(() => settle({ kind: "timeout" }), startTimeoutMs);
    settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
  });

  // the error event is listened for before the pipes are touched (as in runner.js):
  // a child that could not be started (EMFILE) has no pipes
  child.on("error", (err) => {
    settle({
      kind: "error",
      error: new E2eError(
        "STAND_START_FAILED",
        `could not start "${name}": ${err.code ?? "error"}`,
        {},
        err,
      ),
    });
  });
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("error", () => {});
  child.stderr?.on("error", () => {});
  // both pipes are read to the end for the life of the process: a full pipe blocks it
  child.stdout?.on("data", (chunk) => {
    state.out = keep(state.out, chunk);
    if (settled) return;
    const match = readyPattern.exec(state.out);
    if (match) settle({ kind: "link", text: match[1] });
  });
  child.stderr?.on("data", (chunk) => {
    state.err = keep(state.err, chunk);
  });
  child.on("exit", (code, signal) => {
    state.exit = { code, signal };
    resolveExited();
    // the last lines may still be on their way; a helper that holds the pipes open
    // is waited for a moment only
    drainTimer = setTimeout(resolveClosed, DRAIN_WAIT_MS);
  });
  child.on("close", () => {
    clearTimeout(drainTimer);
    resolveClosed();
  });
  state.closed.then(() => settle({ kind: "exited" }));

  const result = await outcome;
  let failure = null;
  let url;
  if (result.kind === "link") {
    // a group that took no part in the match gives undefined: refused as a link
    try {
      url = assertLoopbackUrl(result.text);
    } catch (err) {
      failure = err;
    }
  } else if (result.kind === "error") {
    failure = result.error;
  } else if (result.kind === "timeout") {
    failure = new E2eError(
      "STAND_START_TIMEOUT",
      `${name} did not print its link in ${startTimeoutMs} ms; it was killed`,
      { pid },
    );
  } else {
    // no exit seen (a child of deps.spawn that sends close alone): the end is unknown
    const end = state.exit ?? { code: null, signal: null };
    failure = new E2eError(
      "STAND_START_EXITED",
      `${name} exited before it printed its link (${exitInfoOf(end)}). ` +
        `Last line of its stderr: "${safeText(lastLineOf(state.err), 300)}"`,
      { pid, exitCode: end.code, signal: end.signal },
    );
  }
  if (failure !== null) {
    await abortStart(pid, marker);
    throw failure;
  }
  return new Stand({
    name,
    pid,
    url,
    stateDirs: realStateDirs,
    state,
    marker,
    stopTimeoutMs,
  });
}

// withStand(options, body) -> the value of body. The stand is always stopped.
// A body error is thrown as it is; a failure of the stop is attached to it as
// cleanupError, unless it is that same error or the body error cannot take it.
export async function withStand(options, body) {
  if (typeof body !== "function") {
    throw new E2eError("USAGE", "withStand: the body must be a function");
  }
  const stand = await startStand(options);
  let value;
  let failed = false;
  let failure;
  try {
    value = await body(stand);
  } catch (err) {
    failed = true;
    failure = err;
  }
  try {
    await stand.stop();
  } catch (cleanupError) {
    if (!failed) throw cleanupError;
    // the body may have awaited the failing stop() itself: the same error adds nothing
    if (
      cleanupError !== failure &&
      failure !== null &&
      typeof failure === "object"
    ) {
      try {
        failure.cleanupError = cleanupError;
      } catch {
        // a frozen body error is thrown without it
      }
    }
  }
  if (failed) throw failure;
  return value;
}
