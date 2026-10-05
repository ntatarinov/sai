// Shared contract of the Pixel Office journal line (design section 3.2).
// Pure ES module: no Node API, no DOM. The server, the hook, the page and the
// tests all import this one file, so the line shape is defined in one place.

// The seven hook events Pixel Office subscribes to (design 1.1).
export const HOOK_EVENTS = Object.freeze([
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "PostToolUse",
]);

// The only keys a journal line may have, in canonical order. A line is built
// from these keys only: a new field in a hook input never reaches the journal.
export const LINE_KEYS = Object.freeze([
  "time",
  "source",
  "hook_event_name",
  "session_id",
  "agent_id",
  "agent_type",
  "tool_use_id",
  "launched_agent_id",
  "subagent_type",
  "description",
]);

export const SOURCE_REAL = "REAL";

// Tolerance of the write path: a request time farther from the server clock
// than this is refused.
export const WRITE_SKEW_MS = 60000;
// Twice the write tolerance: the page marks a line that is earlier than the
// latest time before it by more than this (design 4.1, rule b).
export const READ_CONFLICT_MS = 120000;
// The last line of the journal is marked when it is later than the clock of
// the reader by more than this (design 4.1, rule c).
export const LAST_LINE_FUTURE_MS = 60000;

// Longest stored task description, in code points.
export const DESCRIPTION_MAX = 100;

// Page polling period and the limit of one request (design 4.6).
export const POLL_MS = 2000;
export const POLL_TIMEOUT_MS = 3000;

// Extra constants of the line format, shared by the hook and the server.
export const ID_MAX = 128;
export const SOURCE_MAX = 16;

const EVENT_SET = new Set(HOOK_EVENTS);
const KEY_SET = new Set(LINE_KEYS);

// Keys every line has, by event. Other allowed keys are optional for any event.
const REQUIRED_BY_EVENT = Object.freeze({
  SessionStart: Object.freeze([]),
  SessionEnd: Object.freeze([]),
  UserPromptSubmit: Object.freeze([]),
  Stop: Object.freeze([]),
  SubagentStart: Object.freeze(["agent_id"]),
  SubagentStop: Object.freeze(["agent_id"]),
  PostToolUse: Object.freeze(["tool_use_id", "launched_agent_id"]),
});

const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Number of code points of a string, counting no further than cap + 1.
export function codePointLength(s, cap = Infinity) {
  let n = 0;
  const it = s[Symbol.iterator]();
  while (!it.next().done) {
    n += 1;
    if (n > cap) break;
  }
  return n;
}

function lengthInRange(s, min, max) {
  if (typeof s !== "string") return false;
  // A string has at least as many UTF-16 units as code points and at most twice.
  if (s.length < min) return false;
  if (s.length <= max) return true;
  if (s.length > max * 2) return false;
  const n = codePointLength(s, max);
  return n >= min && n <= max;
}

function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// ISO 8601 UTC with milliseconds, in the exact form Date#toISOString gives.
export function isCanonicalTime(s) {
  if (typeof s !== "string" || !TIME_PATTERN.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t) && new Date(t).toISOString() === s;
}

// The first DESCRIPTION_MAX code points (not UTF-16 units) of a description.
export function truncateDescription(s) {
  if (typeof s !== "string") return "";
  if (s.length <= DESCRIPTION_MAX) return s;
  let out = "";
  let n = 0;
  for (const ch of s) {
    if (n === DESCRIPTION_MAX) break;
    out += ch;
    n += 1;
  }
  return out;
}

// A key name may be echoed in an error reason only if it is short and plain.
function safeKeyName(name) {
  return /^[A-Za-z0-9_-]{1,40}$/.test(name) ? name : "?";
}

// Checks one line. withSource: the line comes from the journal file and has
// "source" (any short non-empty string, so a foreign value can be shown with
// a mark); otherwise it comes from a write request, where "source" is forbidden.
// Returns {ok: true, line} with a new object (allowed keys only, canonical
// order) or {ok: false, reason}. Reasons: not_object, has_source,
// unknown_key:<name>, unknown_event, missing:<key>, bad_time, bad_value:<key>.
export function checkLine(value, withSource) {
  if (!isPlainObject(value)) return { ok: false, reason: "not_object" };
  if (!withSource && Object.hasOwn(value, "source")) {
    return { ok: false, reason: "has_source" };
  }
  for (const key of Object.keys(value)) {
    if (!KEY_SET.has(key)) {
      return { ok: false, reason: `unknown_key:${safeKeyName(key)}` };
    }
  }
  if (!Object.hasOwn(value, "hook_event_name")) {
    return { ok: false, reason: "missing:hook_event_name" };
  }
  const event = value.hook_event_name;
  if (typeof event !== "string" || !EVENT_SET.has(event)) {
    return { ok: false, reason: "unknown_event" };
  }
  const required = ["time", "session_id", ...REQUIRED_BY_EVENT[event]];
  if (withSource) required.push("source");
  for (const key of required) {
    if (!Object.hasOwn(value, key))
      return { ok: false, reason: `missing:${key}` };
  }
  const line = {};
  for (const key of LINE_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    const v = value[key];
    if (key === "time") {
      if (!isCanonicalTime(v)) return { ok: false, reason: "bad_time" };
    } else if (key === "source") {
      if (!lengthInRange(v, 1, SOURCE_MAX)) {
        return { ok: false, reason: "bad_value:source" };
      }
    } else if (key === "hook_event_name") {
      // Checked above.
    } else if (key === "agent_type") {
      if (!lengthInRange(v, 0, ID_MAX)) {
        return { ok: false, reason: "bad_value:agent_type" };
      }
    } else if (key === "description") {
      if (!lengthInRange(v, 0, DESCRIPTION_MAX)) {
        return { ok: false, reason: "bad_value:description" };
      }
    } else if (!lengthInRange(v, 1, ID_MAX)) {
      return { ok: false, reason: `bad_value:${key}` };
    }
    line[key] = v;
  }
  return { ok: true, line };
}

// Checks a line read from the journal file or from a server response: the
// line, or null when it is not a valid journal line.
export function parseLine(value) {
  const r = checkLine(value, true);
  return r.ok ? r.line : null;
}
