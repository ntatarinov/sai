// Words of the page that are derived from a journal line: the name of a role
// in plain words (REQ-036), the case, the words and "who" of a line of the
// journal (REQ-045) and the short form of an identifier. The words of line i
// depend only on line i and the lines before it: not on the marks of the
// reading rule, not on the clock. Pure ES module: no DOM, no Node API, no
// clock.

import { SOURCE_REAL, isNoteLine } from "./schema.js";
import {
  EVENT_TABLE,
  HISTORY_WHO_ORCH,
  MAIN_LABEL,
  ROLE_NAMES,
  ROLE_UNKNOWN,
} from "./texts.js";

// A role of Sai is named "Sai <words> (<CODE>)" (the files of .claude/agents/).
const SAI_ROLE = /^Sai [^()]+ \(([A-Z][A-Z0-9-]*)\)$/;

// The name of a role in plain words: a role of Sai with a code of ROLE_NAMES
// gets its name; any other text is shown whole, as it came (decision 0055,
// item 1); no role gives ROLE_UNKNOWN. Nothing is cut.
export function roleName(role) {
  if (typeof role !== "string" || role === "") return ROLE_UNKNOWN;
  const match = SAI_ROLE.exec(role);
  if (match !== null && Object.hasOwn(ROLE_NAMES, match[1])) {
    return ROLE_NAMES[match[1]];
  }
  return role;
}

// The first 8 code points of an identifier; not a string gives "".
export function shortId(id) {
  return Array.from(typeof id === "string" ? id : "")
    .slice(0, 8)
    .join("");
}

// A template with a mark put together with a text from the journal: split and
// join, never String.replace (it reads "$&" and "$'" in the text, design D12).
function put(template, mark, value) {
  return template.split(mark).join(value);
}

function isObject(e) {
  return e !== null && typeof e === "object";
}

// The lines of the file that are repeated starts: a SubagentStart with a
// string agent_id such that an earlier line of the file is a SubagentStart of
// the same agent_id with the source REAL. The marks of the reading rule are not
// read (decision 0055, item 2): the words of a line never change with later
// lines or with the clock.
export function repeatedStarts(entries) {
  const out = new Set();
  const started = new Set();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!isObject(e) || e.hook_event_name !== "SubagentStart") continue;
    if (typeof e.agent_id !== "string") continue;
    if (started.has(e.agent_id)) out.add(i);
    if (e.source === SOURCE_REAL) started.add(e.agent_id);
  }
  return out;
}

// The case of EVENT_TABLE of a line, without its mark; null for a line of an
// unknown kind (the reading of the journal drops such lines).
export function eventCase(entry, repeated) {
  if (isNoteLine(entry)) return "orch_note";
  if (!isObject(entry)) return null;
  switch (entry.hook_event_name) {
    case "SessionStart":
      return "session_start";
    case "SessionEnd":
      return "session_end";
    case "UserPromptSubmit":
      if (entry.prompt_kind === "owner") return "prompt_owner";
      if (entry.prompt_kind === "service") return "prompt_service";
      return "prompt_unknown";
    case "Stop":
      return "stop";
    case "SubagentStart":
      return repeated ? "agent_resume" : "agent_start";
    case "SubagentStop":
      return "agent_stop";
    case "PostToolUse":
      return "handoff";
    default:
      return null;
  }
}

// The raw role of a line for {role}: only from the line itself.
export function lineRole(entry) {
  if (!isObject(entry)) return "";
  const kind = entry.hook_event_name;
  if (kind === "SubagentStart" || kind === "SubagentStop") {
    return typeof entry.agent_type === "string" ? entry.agent_type : "";
  }
  if (kind === "PostToolUse") {
    return typeof entry.subagent_type === "string" ? entry.subagent_type : "";
  }
  return "";
}

// The words of a line: the words of its case with the name of its role.
export function eventWords(caseKey, entry) {
  const row = caseKey === null ? undefined : EVENT_TABLE[caseKey];
  if (row === undefined || typeof row.words !== "string") {
    return isObject(entry) && typeof entry.hook_event_name === "string"
      ? entry.hook_event_name
      : "";
  }
  return put(row.words, "{role}", roleName(lineRole(entry)));
}

// "Who" of a line: the main session for its events, the role of the agent for
// its start and stop, the one who handed over the task for a handoff, the
// orchestrator for its record.
export function whoOf(entry) {
  if (isNoteLine(entry)) return HISTORY_WHO_ORCH;
  if (!isObject(entry)) return MAIN_LABEL;
  const kind = entry.hook_event_name;
  if (kind === "SubagentStart" || kind === "SubagentStop") {
    return roleName(entry.agent_type);
  }
  if (kind === "PostToolUse") {
    return typeof entry.agent_id === "string" && entry.agent_id !== ""
      ? roleName(entry.agent_type)
      : MAIN_LABEL;
  }
  return MAIN_LABEL;
}

// The text of the reason of a mark "not from hooks"; "" for no reason.
export function markReason(reason, entry) {
  const reasons = EVENT_TABLE.marked.reasons;
  if (typeof reason !== "string" || !Object.hasOwn(reasons, reason)) return "";
  const source =
    isObject(entry) && typeof entry.source === "string" ? entry.source : "";
  return put(reasons[reason], "{source}", source);
}
