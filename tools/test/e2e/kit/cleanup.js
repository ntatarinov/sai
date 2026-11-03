import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { E2eError } from "./errors.js";
import { assertOutsideRepo, assertUnderTempRoot, tempRoot } from "./guards.js";

// The registry of what the kit started and made (process groups and folders),
// and the handlers that clean it up on exit and on signals (design section 4.4).
// Everything is registered at the moment it is created, before the first wait.

const groups = new Map(); // pgid -> profile folder or undefined
const dirs = new Set();
const sweepDirs = new Set(); // registry folders of the runner (see below)
const recordFiles = new Map(); // pgid -> the record file written for the runner
const hooks = [];
const errorsOfHooks = [];
let installed = false;
let hookLimit = 10000;
let phase = "idle"; // idle -> waiting (hooks run) -> cleaning (no more signals)
let firstSignal = null;

const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];

export function registerGroup(pgid, profileDir) {
  groups.set(pgid, profileDir);
}

export function unregisterGroup(pgid) {
  groups.delete(pgid);
  const record = recordFiles.get(pgid);
  recordFiles.delete(pgid);
  if (record !== undefined) {
    try {
      fs.rmSync(record, { force: true });
    } catch {
      // the runner skips a record whose folder is gone
    }
  }
}

// Process groups: one place for the signal, the wait and the stop, used by the
// browser (browser.js) and by the runner for the process group of a spec file.
function groupGone(pgid) {
  try {
    process.kill(-pgid, 0);
    return false;
  } catch (err) {
    return err.code === "ESRCH";
  }
}

// -> true when the signal was sent, false when it was refused or the group is gone.
// A group id of 0 or 1 (or one that is not a whole number) is refused: -0 is the
// group of this very process and -1 is every process the user may signal.
export function signalGroup(pgid, signal) {
  if (!Number.isInteger(pgid) || pgid <= 1) return false;
  try {
    process.kill(-pgid, signal);
    return true;
  } catch {
    // ESRCH: the group is gone
    return false;
  }
}

export async function waitGroupGone(pgid, ms) {
  const deadline = performance.now() + ms;
  while (!groupGone(pgid)) {
    if (performance.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return true;
}

// SIGTERM to the group, a wait of `graceMs`, SIGKILL, a wait of 3 s; true when the group is gone.
export async function stopGroup(pgid, graceMs) {
  signalGroup(pgid, "SIGTERM");
  if (await waitGroupGone(pgid, graceMs)) return true;
  signalGroup(pgid, "SIGKILL");
  return waitGroupGone(pgid, 3000);
}

function removeDirSync(dir) {
  fs.rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 50,
  });
}

// The runner's list of the browsers its spec started (the spec process cannot be
// trusted to clean up: it may be stopped by SIGKILL, and Chrome sits in its own
// process group). The runner makes a folder, hands its path to the spec in the
// variable below; every launchBrowser writes there one file "<pgid>.json" with the
// group and the profile folder, and removes it when the browser is closed. After a
// spec ends, is stopped, or the runner exits, the runner kills the groups that are
// still listed and removes their folders.
export const REGISTRY_VAR = "SAI_E2E_REGISTRY";
const RECORD_NAME = /^[1-9][0-9]{0,9}\.json$/;
const PROFILE_NAME = /^sai-e2e-profile-[A-Za-z0-9]+$/;

// Called by the spec process for a browser it has just started. The folder of the
// list comes from the environment of THIS process (the runner set it for the spec),
// never from the `env` option of a launch: that one is only the environment of
// Chrome, and a spec may give it any content. The list is a second net, so a failure
// to write it never fails the launch.
export function noteBrowserForRunner(pgid, profileDir) {
  const dir = process.env[REGISTRY_VAR];
  if (typeof dir !== "string" || !Number.isInteger(pgid) || pgid < 2) return;
  try {
    const folder = assertUnderTempRoot(dir);
    const file = path.join(folder, `${pgid}.json`);
    fs.writeFileSync(file, JSON.stringify({ pgid, profileDir }), {
      mode: 0o600,
    });
    recordFiles.set(pgid, file);
  } catch {
    // the spec's own clean-up still runs
  }
}

export function makeBrowserRegistry() {
  const dir = makeTempDir("registry");
  sweepDirs.add(dir);
  return dir;
}

// Kills (SIGKILL, once) the groups still listed in `dir` whose profile folder still
// exists, and removes their folders and the records; -> the number of groups killed.
// Only records of the exact shape are used: a file name "<number>.json", a number
// above 1 that is not this process, a profile folder directly under the temporary
// root whose name starts with "sai-e2e-profile-". Never throws.
export function sweepBrowserRegistry(dir) {
  let killed = 0;
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of names) {
    if (!RECORD_NAME.test(name)) continue;
    const file = path.join(dir, name);
    try {
      const record = JSON.parse(fs.readFileSync(file, "utf8"));
      const pgid = Number(name.slice(0, -".json".length));
      const profile = record?.profileDir;
      if (
        record?.pgid === pgid &&
        pgid > 1 &&
        pgid !== process.pid &&
        typeof profile === "string"
      ) {
        const real = assertUnderTempRoot(profile);
        const shapeOk =
          path.dirname(real) === tempRoot() &&
          PROFILE_NAME.test(path.basename(real));
        if (shapeOk && fs.existsSync(real)) {
          // the folder is the proof that the browser was not closed in order
          if (signalGroup(pgid, "SIGKILL")) killed++;
          removeDirSync(real);
        }
      }
    } catch {
      // not a record of ours, or the folder could not be removed: nothing more can be done
    }
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // nothing more can be done
    }
  }
  return killed;
}

// Sweeps the registry, then removes its folder.
export function dropBrowserRegistry(dir) {
  sweepBrowserRegistry(dir);
  sweepDirs.delete(dir);
  removeTempDir(dir);
}

// Kills every registered group and removes every registered folder; never throws.
// The registry is cleared, so a group is never killed twice (a gone pid may be reused).
export function cleanupAllSync() {
  for (const dir of [...sweepDirs]) {
    try {
      sweepBrowserRegistry(dir);
    } catch {
      // never throws
    }
  }
  sweepDirs.clear();
  const pgids = [...groups.keys()];
  groups.clear();
  for (const file of recordFiles.values()) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // nothing more can be done
    }
  }
  recordFiles.clear();
  for (const pgid of pgids) signalGroup(pgid, "SIGKILL");
  const folders = [...dirs];
  dirs.clear();
  for (const dir of folders) {
    try {
      removeDirSync(dir);
    } catch {
      // nothing more can be done at this point
    }
  }
}

export function makeTempDir(label) {
  if (typeof label !== "string" || !/^[a-z0-9-]{1,24}$/.test(label)) {
    throw new E2eError(
      "USAGE",
      "makeTempDir: the label must match ^[a-z0-9-]{1,24}$",
    );
  }
  installHandlers();
  // the temporary root must not be inside the repository; checked before anything is made
  const root = assertOutsideRepo(tempRoot());
  const dir = fs.mkdtempSync(path.join(root, `sai-e2e-${label}-`));
  dirs.add(dir);
  return dir;
}

export function removeTempDir(dir) {
  if (!dirs.has(dir)) {
    throw new E2eError(
      "USAGE",
      "removeTempDir: the folder was not made by makeTempDir",
    );
  }
  removeDirSync(dir);
  dirs.delete(dir);
}

// hook(signal) -> Promise | void. Hooks run before the clean-up of a signal and are awaited.
export function addSignalHook(hook) {
  const entry = { hook };
  hooks.push(entry);
  return () => {
    const i = hooks.indexOf(entry);
    if (i !== -1) hooks.splice(i, 1);
  };
}

export function liveRegistrations() {
  return { groups: [...groups.keys()], dirs: [...dirs], hooks: hooks.length };
}

export function hookErrors() {
  return [...errorsOfHooks];
}

function exitNow() {
  phase = "cleaning";
  try {
    cleanupAllSync();
  } catch {
    // never throws
  }
  process.exit(128 + os.constants.signals[firstSignal]);
}

async function runHooks(signal) {
  const calls = hooks.map((entry) => entry.hook);
  const settled = calls.map(async (hook) => {
    try {
      await hook(signal);
    } catch (err) {
      errorsOfHooks.push(err);
    }
  });
  let timer;
  const limit = new Promise((resolve) => {
    timer = setTimeout(resolve, hookLimit);
  });
  try {
    await Promise.race([Promise.all(settled), limit]);
  } finally {
    clearTimeout(timer);
  }
}

function onSignal(signal) {
  if (phase === "cleaning") return;
  if (phase === "waiting") {
    exitNow();
    return;
  }
  firstSignal = signal;
  phase = "waiting";
  runHooks(signal).then(
    () => {
      if (phase === "waiting") exitNow();
    },
    () => {
      if (phase === "waiting") exitNow();
    },
  );
}

// Idempotent; the option is read by the first call in the process only.
export function installHandlers({ hookLimitMs = 10000 } = {}) {
  if (installed) return;
  installed = true;
  hookLimit = hookLimitMs;
  process.on("exit", () => cleanupAllSync());
  for (const signal of SIGNALS) process.on(signal, onSignal);
}
