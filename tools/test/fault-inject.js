// Failure injection for the write-phase tests (design REQ-002 §9.2, ISS-0002).
//
// Not a test file and never imported by one: it is loaded into a CLI process with
//   node --import <url of this file> src/cli.js <command> ...
// and patches methods of the default object of `node:fs` - the object every module of
// tools/src calls its fs functions through (`fs.renameSync(...)`, never a destructured
// copy). A failure can so be made to happen inside the CLI, where the exit code, stdout
// and stderr of the real command are visible; `mock.method` in the test process cannot
// reach that far. It must be loaded before the CLI, so it patches nothing else.
//
// SAI_TEST_FAULTS is a JSON array of faults; each fault fires once.
//
//   fn      writeFileSync | renameSync | linkSync | unlinkSync | chmodSync | mkdirSync |
//           rmSync | lstatSync
//   paths   methods with one path: the call matches when its first argument is one of
//           these absolute paths
//   from,to renameSync and linkSync: the call matches when the given ones are equal to
//           the first and the second argument
//   nth     which matching call fails; 1 when absent
//   effect  throw         throw an OS error, do nothing else
//           partial       (writeFileSync) write the first floor(n/2) characters of the
//                         data - n is the length of the string in characters - with the
//                         real method and the same parameters, then throw
//           kill          SIGKILL to this process before the call
//           partial-kill  the same half of the data, then SIGKILL
//           preempt       (writeFileSync) first create the file with the text
//                         "held by another process\n", then call the real method (its
//                         EEXIST is then real)
//           bug           throw TypeError("injected bug"): no `code`, no `syscall`
//   code    OS code for `throw` and `partial`. The error is an Error with the message
//           "<code>: injected fault, <syscall> '<path>'" and the fields `code`, `errno`
//           (a negative number), `syscall` (the method name without "Sync") and `path`.
//
// A broken configuration throws at load time, so that the CLI dies at once and the test
// fails, instead of the fault silently never firing.
import fs from "node:fs";
import os from "node:os";

const SINGLE_PATH = [
  "writeFileSync",
  "unlinkSync",
  "chmodSync",
  "mkdirSync",
  "rmSync",
  "lstatSync",
];
const TWO_PATHS = ["renameSync", "linkSync"];
const EFFECTS = ["throw", "partial", "kill", "partial-kill", "preempt", "bug"];
const ONLY_FOR_WRITE = ["partial", "partial-kill", "preempt"];
const NEEDS_CODE = ["throw", "partial"];
const KEYS = ["fn", "paths", "from", "to", "nth", "effect", "code"];
const FOREIGN_TEXT = "held by another process\n";

function invalid(index, message) {
  return new Error(`fault-inject: fault ${index}: ${message}`);
}

function parse(text) {
  if (text === undefined) {
    throw new Error("fault-inject: SAI_TEST_FAULTS is not set");
  }
  const list = JSON.parse(text);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("fault-inject: SAI_TEST_FAULTS must be a non-empty array");
  }
  return list.map((fault, i) => {
    for (const key of Object.keys(fault)) {
      if (!KEYS.includes(key)) throw invalid(i, `unknown field "${key}"`);
    }
    if (![...SINGLE_PATH, ...TWO_PATHS].includes(fault.fn)) {
      throw invalid(i, `unknown fn "${fault.fn}"`);
    }
    if (!EFFECTS.includes(fault.effect)) {
      throw invalid(i, `unknown effect "${fault.effect}"`);
    }
    if (ONLY_FOR_WRITE.includes(fault.effect) && fault.fn !== "writeFileSync") {
      throw invalid(i, `effect "${fault.effect}" is for writeFileSync only`);
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

const faults = parse(process.env.SAI_TEST_FAULTS);

function matches(fault, args) {
  if (TWO_PATHS.includes(fault.fn)) {
    return (
      (fault.from === undefined || String(args[0]) === fault.from) &&
      (fault.to === undefined || String(args[1]) === fault.to)
    );
  }
  return fault.paths.includes(String(args[0]));
}

// The fault that fires for this call, if any: the first matching one whose turn it is.
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

function osError(fault, args) {
  const syscall = fault.fn.replace(/Sync$/, "");
  const target = String(args[0]);
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

for (const fn of new Set(faults.map((fault) => fault.fn))) {
  const real = fs[fn];
  fs[fn] = function injected(...args) {
    const fault = due(fn, args);
    if (fault === undefined) return real.apply(fs, args);
    switch (fault.effect) {
      case "throw":
        throw osError(fault, args);
      case "bug":
        throw new TypeError("injected bug");
      case "kill":
        return killSelf();
      case "partial":
        real.call(fs, args[0], firstHalf(args[1]), ...args.slice(2));
        throw osError(fault, args);
      case "partial-kill":
        real.call(fs, args[0], firstHalf(args[1]), ...args.slice(2));
        return killSelf();
      case "preempt":
        real.call(fs, args[0], FOREIGN_TEXT);
        return real.apply(fs, args);
      default:
        throw invalid(-1, `unreachable effect "${fault.effect}"`);
    }
  };
}
