// The Node floor of tools/ (REQ-110; design docs/design/REQ-110-tools-node-floor.md,
// section 2; decisions/0119 and 0120, items О7 and О8). A pure module: it loads no other
// module and reads neither the disk nor the environment; the guard reads the running
// version only as the default of its second argument. The one source of the floor is `engines` of tools/package.json,
// and the test node-floor.test.js checks that NODE_FLOOR is equal to it.

// The only JavaScript text of the floor.
export const NODE_FLOOR = "22.23.4";

// The exit code of a refusal of every entry point but the Pixel Office server, which
// keeps its code 1 (decisions/0119, item О7).
export const NODE_REFUSAL_EXIT = 2;

// Three whole numbers joined by dots, each 0 or 1 to 9 digits with no leading zero, the
// whole text anchored: a pre-release suffix, a sign, a space or a line end is refused.
const VERSION_SHAPE =
  /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/u;

// A version is shown in the refusal line as given only in this shape, so the line stays
// one line and holds no control character.
const SHOWN_SHAPE = /^[0-9A-Za-z.+-]{1,64}$/u;
const UNKNOWN_VERSION = "неизвестная версия";

// The three numbers of a version, or null when it is not a text of the shape.
function versionParts(version) {
  if (typeof version !== "string") return null;
  const m = VERSION_SHAPE.exec(version);
  if (m === null) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// True only for a version whose major equals the floor's and whose minor and patch are at
// or above the floor's, compared as numbers. A malformed floor accepts nothing.
export function meetsNodeFloor(version) {
  const floor = versionParts(NODE_FLOOR);
  const got = versionParts(version);
  if (floor === null || got === null) return false;
  if (got[0] !== floor[0]) return false;
  if (got[1] !== floor[1]) return got[1] > floor[1];
  return got[2] >= floor[2];
}

// The refusal line without its line end; the floor and its major come from NODE_FLOOR.
export function nodeFloorRefusal(version) {
  const shown =
    typeof version === "string" && SHOWN_SHAPE.test(version)
      ? version
      : UNKNOWN_VERSION;
  const major = NODE_FLOOR.split(".")[0];
  return `Нужен Node ${major} не ниже ${NODE_FLOOR}, а запущен ${shown}: команда остановлена, ничего не записано. Подробности — tools/README.md, раздел «Check».`;
}

// False when the version meets the floor, and then `stderr` is not touched. Else writes
// the refusal line and its line end in one write and returns true; the caller stops at
// once with its exit code. A write that throws is swallowed: the exit code still says it.
export function refuseBelowNodeFloor(stderr, version = process.versions.node) {
  if (meetsNodeFloor(version)) return false;
  try {
    stderr.write(`${nodeFloorRefusal(version)}\n`);
  } catch {
    // The stderr of the command is closed; nothing more can be said.
  }
  return true;
}
