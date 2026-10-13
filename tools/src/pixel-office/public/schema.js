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
  // REQ-008 (decisions/0011): the text of an owner message (kind A) and the
  // record of the orchestrator (kind B), design REQ-008 2.1.
  "prompt_kind",
  "prompt_text",
  "prompt_truncated",
  "note_text",
  "req_id",
  "request_time",
  "request_time_auto",
]);

export const SOURCE_REAL = "REAL";
// Source of a record of the orchestrator (kind B); the server sets it.
export const SOURCE_ORCH = "ORCH";

// Kind of a UserPromptSubmit message: written by the owner or by the system.
export const PROMPT_KINDS = Object.freeze(["owner", "service"]);
// Longest stored text of an owner message and of a record of the
// orchestrator, and longest session_id of such a record, in code points.
export const PROMPT_MAX = 4000;
export const NOTE_MAX = 2000;
export const NOTE_SESSION_MAX = 200;
// Number of a requirement: "REQ-008"; "REQ-8" and "../x" do not pass.
export const REQ_ID_PATTERN = /^REQ-[0-9]{3,6}$/;
// What stands in the text instead of a masked secret.
export const MASK_LABEL = "[скрыто]";
// A message whose text (without leading white space) starts with one of these
// is a service message: its text is never stored.
export const SERVICE_MARKERS = Object.freeze([
  "<system-reminder>",
  "[SYSTEM NOTIFICATION",
  "<task-notification",
  "Another Claude session",
  "This session is being continued",
]);

// Tolerance of the write path: a request time farther from the server clock
// than this is refused.
export const WRITE_SKEW_MS = 60000;
// Twice the write tolerance: the page marks a line that is earlier than the
// latest time before it by more than this (design 4.1, rule b).
export const READ_CONFLICT_MS = 120000;
// The last line of the journal is marked when it is later than the clock of
// the reader by more than this (design 4.1, rule c).
export const LAST_LINE_FUTURE_MS = 60000;
// A task or a row of the main session with no trusted event of its session for
// longer than this (60 minutes) is "no fresh data", not "in progress"
// (REQ-042, decision 0049). The one place where the number is written.
export const STALE_AFTER_MS = 3600000;

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
// Fields of an owner message: only UserPromptSubmit lines have them.
const PROMPT_KEYS = new Set(["prompt_kind", "prompt_text", "prompt_truncated"]);
// Fields of a record of the orchestrator: never in a hook event line.
const NOTE_ONLY_KEYS = new Set([
  "note_text",
  "req_id",
  "request_time",
  "request_time_auto",
]);
// The keys a record of the orchestrator may have.
const NOTE_LINE_KEYS = new Set([
  "time",
  "source",
  "session_id",
  ...NOTE_ONLY_KEYS,
]);

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

// The first max code points (not UTF-16 units) of a string.
export function firstCodePoints(s, max) {
  let out = "";
  let n = 0;
  for (const ch of s) {
    if (n === max) break;
    out += ch;
    n += 1;
  }
  return out;
}

// The first DESCRIPTION_MAX code points (not UTF-16 units) of a description.
export function truncateDescription(s) {
  if (typeof s !== "string") return "";
  if (s.length <= DESCRIPTION_MAX) return s;
  return firstCodePoints(s, DESCRIPTION_MAX);
}

// A key name may be echoed in an error reason only if it is short and plain.
export function safeKeyName(name) {
  return /^[A-Za-z0-9_-]{1,40}$/.test(name) ? name : "?";
}

// True for a string of white space only (or an empty one).
function isBlank(s) {
  return s.trim() === "";
}

// The fields of an owner message (REQ-008 2.1, kind A) of an event line that
// passed the other checks: null when they are right, a reason otherwise.
function promptFieldsReason(value, event) {
  for (const key of PROMPT_KEYS) {
    if (Object.hasOwn(value, key) && event !== "UserPromptSubmit") {
      return `not_allowed:${key}`;
    }
  }
  const hasKind = Object.hasOwn(value, "prompt_kind");
  if (hasKind && !PROMPT_KINDS.includes(value.prompt_kind)) {
    return "bad_value:prompt_kind";
  }
  if (Object.hasOwn(value, "prompt_text")) {
    if (
      !hasKind ||
      value.prompt_kind !== "owner" ||
      !lengthInRange(value.prompt_text, 1, PROMPT_MAX)
    ) {
      return "bad_value:prompt_text";
    }
  }
  if (Object.hasOwn(value, "prompt_truncated")) {
    if (
      value.prompt_truncated !== true ||
      !Object.hasOwn(value, "prompt_text")
    ) {
      return "bad_value:prompt_truncated";
    }
  }
  return null;
}

// Checks one hook event line (kind A). withSource: the line comes from the
// journal file and has "source" (any short non-empty string except ORCH, so a
// foreign value can be shown with a mark; a hook event can never come from
// the orchestrator); otherwise it comes from a write request, where "source"
// is forbidden. Returns {ok: true, line} with a new object (allowed keys only,
// canonical order) or {ok: false, reason}. Reasons: not_object, has_source,
// unknown_key:<name>, not_allowed:<key>, unknown_event, missing:<key>,
// bad_time, bad_value:<key>.
export function checkLine(value, withSource) {
  if (!isPlainObject(value)) return { ok: false, reason: "not_object" };
  if (!withSource && Object.hasOwn(value, "source")) {
    return { ok: false, reason: "has_source" };
  }
  for (const key of Object.keys(value)) {
    if (!KEY_SET.has(key)) {
      return { ok: false, reason: `unknown_key:${safeKeyName(key)}` };
    }
    if (NOTE_ONLY_KEYS.has(key)) {
      return { ok: false, reason: `not_allowed:${key}` };
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
  const promptReason = promptFieldsReason(value, event);
  if (promptReason !== null) return { ok: false, reason: promptReason };
  const line = {};
  for (const key of LINE_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    const v = value[key];
    if (key === "time") {
      if (!isCanonicalTime(v)) return { ok: false, reason: "bad_time" };
    } else if (key === "source") {
      if (!lengthInRange(v, 1, SOURCE_MAX) || v === SOURCE_ORCH) {
        return { ok: false, reason: "bad_value:source" };
      }
    } else if (key === "hook_event_name" || PROMPT_KEYS.has(key)) {
      // Checked above and by promptFieldsReason below.
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

// Checks a record of the orchestrator as it stands in the journal file (kind
// B, REQ-008 2.1): time and source ORCH (both set by the server), note_text,
// and optionally session_id, req_id, request_time, request_time_auto. Returns
// {ok: true, line} with a new object in canonical order or {ok: false,
// reason}. Reasons: not_object, unknown_key:<name>, not_allowed:<key>,
// missing:<key>, bad_time, bad_value:<key>, empty_note.
export function checkNoteLine(value) {
  if (!isPlainObject(value)) return { ok: false, reason: "not_object" };
  for (const key of Object.keys(value)) {
    if (!KEY_SET.has(key)) {
      return { ok: false, reason: `unknown_key:${safeKeyName(key)}` };
    }
    if (!NOTE_LINE_KEYS.has(key)) {
      return { ok: false, reason: `not_allowed:${key}` };
    }
  }
  for (const key of ["time", "source", "note_text"]) {
    if (!Object.hasOwn(value, key)) {
      return { ok: false, reason: `missing:${key}` };
    }
  }
  if (!isCanonicalTime(value.time)) return { ok: false, reason: "bad_time" };
  if (value.source !== SOURCE_ORCH) {
    return { ok: false, reason: "bad_value:source" };
  }
  if (!lengthInRange(value.note_text, 0, NOTE_MAX)) {
    return { ok: false, reason: "bad_value:note_text" };
  }
  if (isBlank(value.note_text)) return { ok: false, reason: "empty_note" };
  if (
    Object.hasOwn(value, "session_id") &&
    !lengthInRange(value.session_id, 1, NOTE_SESSION_MAX)
  ) {
    return { ok: false, reason: "bad_value:session_id" };
  }
  if (
    Object.hasOwn(value, "req_id") &&
    (typeof value.req_id !== "string" || !REQ_ID_PATTERN.test(value.req_id))
  ) {
    return { ok: false, reason: "bad_value:req_id" };
  }
  const hasRequestTime = Object.hasOwn(value, "request_time");
  if (hasRequestTime && !isCanonicalTime(value.request_time)) {
    return { ok: false, reason: "bad_value:request_time" };
  }
  if (
    Object.hasOwn(value, "request_time_auto") &&
    (value.request_time_auto !== true || !hasRequestTime)
  ) {
    return { ok: false, reason: "bad_value:request_time_auto" };
  }
  const line = {};
  for (const key of LINE_KEYS) {
    if (Object.hasOwn(value, key)) line[key] = value[key];
  }
  return { ok: true, line };
}

// True only for a record of the orchestrator: source ORCH and no
// hook_event_name key at all (whatever its value).
export function isNoteLine(line) {
  return (
    isPlainObject(line) &&
    line.source === SOURCE_ORCH &&
    !Object.hasOwn(line, "hook_event_name")
  );
}

// Checks a line read from the journal file or from a server response: the
// line, or null when it is not a valid journal line. A line without
// hook_event_name and with source ORCH is a record of the orchestrator; any
// other line is a hook event (and a hook event with source ORCH is refused).
export function parseLine(value) {
  const r = isNoteLine(value) ? checkNoteLine(value) : checkLine(value, true);
  return r.ok ? r.line : null;
}

// The first non-empty line of a text (trimmed), at most max code points;
// a longer one is cut to max code points and gets "…".
export function firstLine(text, max) {
  if (typeof text !== "string") return "";
  let found = "";
  for (const piece of text.split(/\r\n|\n|\r/)) {
    const trimmed = piece.trim();
    if (trimmed !== "") {
      found = trimmed;
      break;
    }
  }
  if (codePointLength(found, max) <= max) return found;
  return `${firstCodePoints(found, max)}…`;
}
