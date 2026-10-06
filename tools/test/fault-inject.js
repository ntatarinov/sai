// Failure injection for tests (design REQ-002 §9.2, ISS-0002; extended by design
// REQ-009 §15.3). Not a test file. Two modes:
//
// 1. `--import` (the original mode). Loaded into a CLI process with
//      node --import <url or path of this file> src/cli.js <command> ...
//    it reads SAI_TEST_FAULTS (a JSON array of faults) at load time and patches
//    methods of the default object of `node:fs` - the object every module of
//    tools/src calls its fs functions through (`fs.renameSync(...)`, never a
//    destructured copy) - until the process ends. A failure can so be made to happen
//    inside the CLI, where the exit code, stdout and stderr of the real command are
//    visible; `mock.method` in the test process cannot reach that far. It must be
//    loaded before the CLI, so it patches nothing else.
//
// 2. Library (REQ-009 §15.3, N1). Imported by a test (`import { withFaults,
//    installFaults } from "./fault-inject.js"`) it patches nothing at load time and
//    does not read SAI_TEST_FAULTS. installFaults(faults) patches fs and returns
//    { restore(), fired() }; withFaults(faults, fn) calls fn with the faults
//    installed and always restores them.
//
// The mode is `--import` when the module is named by a `--import` option of this
// process (in process.execArgv or NODE_OPTIONS, as a URL or as a path). When
// SAI_TEST_FAULTS is set but the module was not loaded that way, loading fails
// instead of the faults silently never being installed.
//
// A fault (each fires once):
//
//   fn      writeFileSync | renameSync | linkSync | unlinkSync | chmodSync | mkdirSync |
//           rmSync | lstatSync | openSync (by path) | writeSync | fsyncSync |
//           ftruncateSync (by descriptor)
//   paths   methods with one path: the call matches when its first argument is one of
//           these absolute paths; methods by descriptor: the call matches when its
//           descriptor was opened by fs.openSync with one of these paths while the
//           faults were installed
//   from,to renameSync and linkSync: the call matches when the given ones are equal to
//           the first and the second argument
//   nth     which matching call fails; 1 when absent
//   effect  throw         throw an OS error, do nothing else
//           partial       (writeFileSync) write the first floor(n/2) characters of the
//                         data - n is the length of the string in characters - with the
//                         real method and the same parameters, then throw;
//                         (writeSync) write the first floor(n/2) bytes of what the call
//                         was to write - n bytes - with the real method, the same
//                         descriptor and the same start, then throw
//           kill          SIGKILL to this process before the call
//           partial-kill  the same half of the data, then SIGKILL
//           preempt       (writeFileSync) first create the file with the text
//                         "held by another process\n", then call the real method (its
//                         EEXIST is then real)
//           bug           throw TypeError("injected bug"): no `code`, no `syscall`
//   code    OS code for `throw` and `partial`. The error is an Error with the message
//           "<code>: injected fault, <syscall> '<path>'" and the fields `code`, `errno`
//           (a negative number), `syscall` (the method name without "Sync") and `path`
//           (for a method by descriptor: the path the descriptor was opened with).
//
// A broken configuration throws before anything is patched, so that the CLI dies at
// once (or installFaults throws) and the test fails, instead of the fault silently
// never firing.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SINGLE_PATH = [
  "writeFileSync",
  "unlinkSync",
  "chmodSync",
  "mkdirSync",
  "rmSync",
  "lstatSync",
  "openSync",
];
const TWO_PATHS = ["renameSync", "linkSync"];
const BY_FD = ["writeSync", "fsyncSync", "ftruncateSync"];
const EFFECTS = ["throw", "partial", "kill", "partial-kill", "preempt", "bug"];
const ONLY_FOR_WRITE = {
  partial: ["writeFileSync", "writeSync"],
  "partial-kill": ["writeFileSync", "writeSync"],
  preempt: ["writeFileSync"],
};
const NEEDS_CODE = ["throw", "partial"];
const KEYS = ["fn", "paths", "from", "to", "nth", "effect", "code"];
const FOREIGN_TEXT = "held by another process\n";

function invalid(index, message) {
  return new Error(`fault-inject: fault ${index}: ${message}`);
}

function parseList(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("fault-inject: the faults must be a non-empty array");
  }
  return list.map((fault, i) => {
    if (fault === null || typeof fault !== "object" || Array.isArray(fault)) {
      throw invalid(i, "not an object");
    }
    for (const key of Object.keys(fault)) {
      if (!KEYS.includes(key)) throw invalid(i, `unknown field "${key}"`);
    }
    if (![...SINGLE_PATH, ...TWO_PATHS, ...BY_FD].includes(fault.fn)) {
      throw invalid(i, `unknown fn "${fault.fn}"`);
    }
    if (!EFFECTS.includes(fault.effect)) {
      throw invalid(i, `unknown effect "${fault.effect}"`);
    }
    const onlyFor = ONLY_FOR_WRITE[fault.effect];
    if (onlyFor !== undefined && !onlyFor.includes(fault.fn)) {
      throw invalid(
        i,
        `effect "${fault.effect}" is for ${onlyFor.join(" and ")} only`,
      );
    }
    if (NEEDS_CODE.includes(fault.effect) && typeof fault.code !== "string") {
      throw invalid(i, `effect "${fault.effect}" needs a string "code"`);
    }
    if (TWO_PATHS.includes(fault.fn)) {
      if (fault.paths !== undefined) throw invalid(i, `use from/to, not paths`);
      if (fault.from === undefined && fault.to === undefined) {
        throw invalid(i, `needs "from" or "to"`);
      }
    } else if (
      !Array.isArray(fault.paths) ||
      fault.paths.length === 0 ||
      fault.from !== undefined ||
      fault.to !== undefined
    ) {
      throw invalid(i, `needs a non-empty "paths" and no from/to`);
    }
    const nth = fault.nth ?? 1;
    if (!Number.isInteger(nth) || nth < 1) throw invalid(i, `bad "nth"`);
    return { ...fault, nth, seen: 0, fired: false };
  });
}

function parseEnv(text) {
  if (text === undefined) {
    throw new Error("fault-inject: SAI_TEST_FAULTS is not set");
  }
  const list = JSON.parse(text);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("fault-inject: SAI_TEST_FAULTS must be a non-empty array");
  }
  return parseList(list);
}

function osError(fault, target) {
  const syscall = fault.fn.replace(/Sync$/, "");
  const err = new Error(
    `${fault.code}: injected fault, ${syscall} '${target}'`,
  );
  err.code = fault.code;
  err.errno = -(os.constants.errno[fault.code] ?? 1);
  err.syscall = syscall;
  err.path = target;
  return err;
}

function firstHalf(data) {
  const half = Math.floor(data.length / 2);
  return typeof data === "string"
    ? data.slice(0, half)
    : data.subarray(0, half);
}

function killSelf() {
  process.kill(process.pid, "SIGKILL");
  // SIGKILL cannot be caught. Should it be late, no further fs call may happen.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10_000);
  throw new Error("fault-inject: the process outlived its own SIGKILL");
}

// The real writeSync with the first half of what the call was to write.
function writeHalf(real, args) {
  const [fd, data, ...rest] = args;
  if (typeof data === "string") {
    // writeSync(fd, string[, position[, encoding]])
    const encoding = typeof rest[1] === "string" ? rest[1] : "utf8";
    const buf = Buffer.from(data, encoding);
    return real.call(fs, fd, buf, 0, Math.floor(buf.length / 2), rest[0]);
  }
  const view = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  let offset;
  let length;
  let position;
  if (rest[0] !== null && typeof rest[0] === "object") {
    // writeSync(fd, buffer, { offset, length, position })
    offset = rest[0].offset ?? 0;
    length = rest[0].length;
    position = rest[0].position;
  } else {
    offset = rest[0] ?? 0;
    length = rest[1];
    position = rest[2];
  }
  const n = length ?? view.length - offset;
  return real.call(fs, fd, view, offset, Math.floor(n / 2), position);
}

// One installation: the faults, the saved functions and the interceptors.
function install(faults) {
  const fdPaths = new Map();
  const saved = new Map();
  const interceptors = new Map();
  const watchedPaths = new Set();
  let needsFds = false;
  for (const fault of faults) {
    if (BY_FD.includes(fault.fn)) needsFds = true;
    for (const p of fault.paths ?? []) watchedPaths.add(p);
  }

  function matches(fault, args) {
    if (TWO_PATHS.includes(fault.fn)) {
      return (
        (fault.from === undefined || String(args[0]) === fault.from) &&
        (fault.to === undefined || String(args[1]) === fault.to)
      );
    }
    if (BY_FD.includes(fault.fn)) {
      const p = fdPaths.get(args[0]);
      return p !== undefined && fault.paths.includes(p);
    }
    return fault.paths.includes(String(args[0]));
  }

  // The fault that fires for this call, if any: the first matching one whose turn
  // it is.
  function due(fn, args) {
    for (const fault of faults) {
      if (fault.fn !== fn || fault.fired || !matches(fault, args)) continue;
      fault.seen += 1;
      if (fault.seen === fault.nth) {
        fault.fired = true;
        return fault;
      }
    }
    return undefined;
  }

  function targetOf(fn, args) {
    return BY_FD.includes(fn) ? fdPaths.get(args[0]) : String(args[0]);
  }

  function intercept(fn) {
    const real = fs[fn];
    saved.set(fn, real);
    const injected = function injected(...args) {
      const fault = due(fn, args);
      if (fault !== undefined) {
        switch (fault.effect) {
          case "throw":
            throw osError(fault, targetOf(fn, args));
          case "bug":
            throw new TypeError("injected bug");
          case "kill":
            return killSelf();
          case "partial":
            if (fn === "writeSync") writeHalf(real, args);
            else real.call(fs, args[0], firstHalf(args[1]), ...args.slice(2));
            throw osError(fault, targetOf(fn, args));
          case "partial-kill":
            if (fn === "writeSync") writeHalf(real, args);
            else real.call(fs, args[0], firstHalf(args[1]), ...args.slice(2));
            return killSelf();
          case "preempt":
            real.call(fs, args[0], FOREIGN_TEXT);
            return real.apply(fs, args);
          default:
            throw invalid(-1, `unreachable effect "${fault.effect}"`);
        }
      }
      if (fn === "closeSync") fdPaths.delete(args[0]);
      const result = real.apply(fs, args);
      if (fn === "openSync" && needsFds && watchedPaths.has(String(args[0]))) {
        fdPaths.set(result, String(args[0]));
      }
      return result;
    };
    interceptors.set(fn, injected);
    fs[fn] = injected;
  }

  const fns = new Set(faults.map((fault) => fault.fn));
  if (needsFds) {
    fns.add("openSync");
    fns.add("closeSync");
  }
  for (const fn of fns) intercept(fn);

  let restored = false;
  return {
    restore() {
      if (restored) return;
      restored = true;
      const changed = [];
      for (const [fn, real] of saved) {
        if (fs[fn] !== interceptors.get(fn)) changed.push(fn);
        fs[fn] = real;
      }
      fdPaths.clear();
      if (changed.length > 0) {
        throw new Error(
          `fault-inject: fs.${changed[0]} changed by someone else`,
        );
      }
    },
    fired() {
      return faults.map((fault) => fault.fired);
    },
  };
}

let active = null;

// Library mode: patches fs with the faults. Returns { restore(), fired() }.
export function installFaults(list) {
  if (active !== null) throw new Error("fault-inject: already installed");
  const faults = parseList(list);
  const handle = install(faults);
  active = handle;
  return {
    restore() {
      if (active === handle) active = null;
      handle.restore();
    },
    fired: () => handle.fired(),
  };
}

// Library mode: fn() with the faults installed; they are removed in any case. The
// exception of fn is returned, not thrown; an error of restore() is thrown.
export function withFaults(list, fn) {
  const handle = installFaults(list);
  let value;
  let error = null;
  try {
    value = fn();
  } catch (err) {
    error = err;
    value = undefined;
  } finally {
    handle.restore();
  }
  return { value, error, fired: handle.fired() };
}

// ---- the --import mode -------------------------------------------------------------

function importValues(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--import" && i + 1 < argv.length) {
      out.push(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--import=")) {
      out.push(arg.slice("--import=".length));
    }
  }
  return out;
}

function namesThisModule(value) {
  if (value === import.meta.url) return true;
  try {
    if (/^file:/i.test(value)) return new URL(value).href === import.meta.url;
    return pathToFileURL(path.resolve(value)).href === import.meta.url;
  } catch {
    return false;
  }
}

function loadedByImport() {
  const fromOptions = (process.env.NODE_OPTIONS ?? "")
    .split(/\s+/)
    .filter((part) => part !== "");
  return [...importValues(process.execArgv), ...importValues(fromOptions)].some(
    namesThisModule,
  );
}

if (loadedByImport()) {
  active = install(parseEnv(process.env.SAI_TEST_FAULTS));
} else if (process.env.SAI_TEST_FAULTS !== undefined) {
  throw new Error(
    "fault-inject: SAI_TEST_FAULTS is set, but this module was not loaded with --import",
  );
}
