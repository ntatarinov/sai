import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browser.js";
import {
  REGISTRY_VAR,
  addSignalHook,
  dropBrowserRegistry,
  installHandlers,
  makeBrowserRegistry,
  registerGroup,
  stopGroup,
  sweepBrowserRegistry,
  unregisterGroup,
} from "./cleanup.js";
import { E2eError, safeText } from "./errors.js";

// The runner of the spec files tools/test/e2e/<name>.e2e.js (design section 6):
// selection, one `node --test` process per file in its own process group, the
// analysis of its TAP text, the record line, and the stop on signals.

const TOOLS_DIR = fileURLToPath(new URL("../../../", import.meta.url));
const SPEC_NAME = /^[a-z0-9][a-z0-9-]*\.e2e\.js$/;

export function listSpecs(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && SPEC_NAME.test(entry.name))
    .map((entry) => entry.name.slice(0, -".e2e.js".length))
    .sort();
}

// -> { selection, names }; names keep the order given
export function parseSelection(argv, available) {
  if (argv.length === 0) return { selection: "all", names: [...available] };
  const seen = new Set();
  for (const name of argv) {
    if (!available.includes(name)) {
      throw new E2eError(
        "SELECTION_UNKNOWN",
        `no spec file "${safeText(name)}"; the spec files are: ${available.join(", ")}`,
      );
    }
    if (seen.has(name)) {
      throw new E2eError(
        "SELECTION_DUPLICATE",
        `the spec file "${name}" is given twice`,
      );
    }
    seen.add(name);
  }
  return { selection: argv.join(","), names: [...argv] };
}

function countOf(text, label) {
  const match = new RegExp(`^# ${label} (\\d+)\\s*$`, "m").exec(text);
  return match ? Number(match[1]) : 0;
}

// Reads the counts of a TAP text. A file that holds no test prints nothing, or
// registers itself as one passing test named by its own path.
export function analyseTap(text, specArg) {
  const counts = {
    tests: countOf(text, "tests"),
    pass: countOf(text, "pass"),
    fail: countOf(text, "fail"),
    cancelled: countOf(text, "cancelled"),
    skipped: countOf(text, "skipped"),
    todo: countOf(text, "todo"),
  };
  const top = text.split("\n").filter((line) => /^(ok|not ok) /.test(line));
  const wanted = `ok 1 - ${String(specArg).replaceAll("\\", "/")}`;
  const only =
    top.length === 1 && top[0].replaceAll("\\", "/").trimEnd() === wanted;
  return {
    ...counts,
    noTests: counts.tests === 0 || (counts.tests === 1 && only),
  };
}

export function formatRecord({ command, selection, exit, durationMs }) {
  return `e2e: command=${command} selection=${selection} exit=${exit} duration_ms=${Math.round(durationMs)}`;
}

// A copy of the environment for a spec process: only NODE_TEST_CONTEXT is removed
// (a nested `node --test` prints nothing when it is set).
export function specEnv(env) {
  const copy = { ...env };
  delete copy.NODE_TEST_CONTEXT;
  return copy;
}

function realOf(dir) {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

// The path of a spec file relative to the tools folder, with "/" and no "./".
export function specArgument(specDir, name) {
  const rel = path.relative(realOf(TOOLS_DIR), realOf(specDir));
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new E2eError(
      "USAGE",
      "specArgument: the spec folder must lie inside the tools folder",
    );
  }
  return [
    ...rel.split(path.sep).filter((part) => part !== ""),
    `${name}.e2e.js`,
  ].join("/");
}

function writeAllSync(fd, text) {
  const buffer = Buffer.from(text);
  let offset = 0;
  while (offset < buffer.length) {
    try {
      offset += fs.writeSync(fd, buffer, offset);
    } catch (err) {
      if (err.code !== "EAGAIN") return;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
  }
}

// The default sinks write synchronously, so a line is on its way before the next step.
const stdoutSink = { write: (text) => writeAllSync(1, text) };
const stderrSink = { write: (text) => writeAllSync(2, text) };

function defaultSpawnSpec({ args, cwd, env, detached }) {
  return spawn(process.execPath, args, {
    cwd,
    env,
    detached,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function reasonOf(error) {
  if (!error) return "no process id";
  return error.code ?? String(error.message).split("\n")[0];
}

function oneLine(text) {
  return String(text).split("\n")[0];
}

function toSink(sink) {
  return typeof sink === "function" ? { write: sink } : sink;
}

// runAll -> the exit code (0: all selected files passed; 1: anything else).
// out and err are objects with write(text) or plain functions taking the text.
export async function runAll({
  specDir,
  argv = [],
  env = process.env,
  now = () => performance.now(),
  out = stdoutSink,
  err = stderrSink,
  spawnSpec = defaultSpawnSpec,
  launch = launchBrowser,
  fileTimeoutMs = 120000,
  killGraceMs = 5000,
} = {}) {
  const started = now();
  const stdout = toSink(out);
  const stderr = toSink(err);
  // the arguments are the operator's text: shown cut and without control characters
  const command =
    argv.length > 0
      ? `npm run e2e -- ${safeText(argv.join(" "), 200)}`
      : "npm run e2e";
  const selectionText = argv.length > 0 ? safeText(argv.join(","), 200) : "all";

  let recordPrinted = false;
  let interrupted = false;
  let running = null; // { pgid }
  let registryDir = null; // the list of the browsers the spec files start
  const printRecord = (exit) => {
    if (recordPrinted) return;
    recordPrinted = true;
    stdout.write(
      `${formatRecord({ command, selection: selectionText, exit, durationMs: now() - started })}\n`,
    );
  };

  installHandlers();
  const removeHook = addSignalHook(async (signal) => {
    if (recordPrinted) return;
    stderr.write(`e2e: error=INTERRUPTED: ${signal}\n`);
    printRecord(1);
    interrupted = true;
    if (running) {
      await stopGroup(running.pgid, killGraceMs);
      unregisterGroup(running.pgid);
    }
    if (registryDir !== null) sweepBrowserRegistry(registryDir);
  });

  async function runOne({ name, specArg }) {
    const child = spawnSpec({
      args: ["--test", "--test-reporter=tap", specArg],
      cwd: TOOLS_DIR,
      env: { ...specEnv(env), [REGISTRY_VAR]: registryDir },
      detached: true,
    });
    let failedToStart = null;
    child?.on?.("error", (error) => {
      failedToStart = failedToStart ?? error;
    });
    if (typeof child?.pid !== "number") {
      await new Promise((resolve) => setImmediate(resolve));
      throw new E2eError(
        "SPEC_FAILED",
        `${name}.e2e.js could not be started: ${reasonOf(failedToStart)}`,
      );
    }
    const pgid = child.pid;
    registerGroup(pgid);
    running = { pgid };

    let text = "";
    child.stdout?.setEncoding?.("utf8");
    child.stdout?.on("data", (chunk) => {
      const piece = String(chunk);
      text += piece;
      stdout.write(piece);
    });

    let stopping = null;
    const watchdog = setTimeout(() => {
      stopping = stopGroup(pgid, killGraceMs);
    }, fileTimeoutMs);

    const ended = await new Promise((resolve) => {
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    clearTimeout(watchdog);
    if (stopping) await stopping;
    running = null;
    unregisterGroup(pgid);
    // a browser the spec did not close (the spec was stopped or hung) is killed now
    sweepBrowserRegistry(registryDir);

    if (interrupted) return;
    if (failedToStart) {
      throw new E2eError(
        "SPEC_FAILED",
        `${name}.e2e.js could not be started: ${reasonOf(failedToStart)}`,
      );
    }
    if (stopping) {
      throw new E2eError(
        "SPEC_TIMEOUT",
        `${name}.e2e.js did not finish in ${fileTimeoutMs} ms; it was stopped`,
      );
    }
    if (ended.code !== 0) {
      const how = ended.signal
        ? `signal ${ended.signal}`
        : `exit code ${ended.code}`;
      throw new E2eError("SPEC_FAILED", `${name}.e2e.js failed (${how})`);
    }
    const tap = analyseTap(text, specArg);
    if (tap.fail > 0 || tap.cancelled > 0) {
      throw new E2eError(
        "SPEC_FAILED",
        `${name}.e2e.js failed (${tap.fail} failed tests)`,
      );
    }
    if (tap.noTests) {
      throw new E2eError("SPEC_NO_TESTS", `${name}.e2e.js registered no test`);
    }
    if (tap.skipped > 0 || tap.todo > 0) {
      throw new E2eError(
        "SPEC_SKIPPED",
        `${name}.e2e.js has ${tap.skipped} skipped and ${tap.todo} todo tests; none is allowed`,
      );
    }
  }

  let exitCode;
  try {
    if (typeof specDir !== "string")
      throw new E2eError("USAGE", "runAll: specDir is required");
    specArgument(specDir, "x"); // refuses a folder outside the tools folder
    const available = listSpecs(specDir);
    if (available.length === 0) {
      throw new E2eError(
        "NO_SPECS",
        "no spec files *.e2e.js in tools/test/e2e",
      );
    }
    const { names } = parseSelection(argv, available);

    const browser = await launch({ env });
    if (interrupted) return 1;
    stdout.write(`e2e: browser=${safeText(browser.product, 100)}\n`);
    await browser.close();
    if (interrupted) return 1;

    registryDir = makeBrowserRegistry();

    for (const name of names) {
      stdout.write(`e2e: file=${name}\n`);
      await runOne({ name, specArg: specArgument(specDir, name) });
      if (interrupted) return 1;
    }
    exitCode = 0;
  } catch (error) {
    if (interrupted) return 1;
    if (error instanceof E2eError) {
      // the whole message: it may hold several lines (the places tried for Chrome)
      stderr.write(`e2e: error=${error.code}: ${error.message}\n`);
    } else {
      stderr.write(
        `e2e: error=INTERNAL: ${safeText(oneLine(error?.message ?? error), 500)}\n`,
      );
    }
    exitCode = 1;
  } finally {
    removeHook();
    if (registryDir !== null) {
      try {
        dropBrowserRegistry(registryDir);
      } catch {
        // the exit handler tries again
      }
    }
  }
  printRecord(exitCode);
  return exitCode;
}
