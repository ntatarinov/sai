// The details of one line of the journal (REQ-045, criterion 3): when, where
// it came from, the session, the agent, the task as it is now, what it means,
// what it does not prove, the mark and the technical fields. Pure ES module: no
// DOM, no Node API, no reading of the clock (tzLabel reads the time zone).

import { fmtDateTime, tzLabel } from "./format.js";
import { mainChoiceOpens, mainRowOfEvent } from "./main-card.js";
import { shownInPanel } from "./panels.js";
import { LINE_KEYS, SOURCE_ORCH, SOURCE_REAL, isNoteLine } from "./schema.js";
import {
  AGENT_MAIN,
  AGENT_ORCH,
  EVENT_TABLE,
  GO_AGENT,
  GO_FROM,
  GO_PANEL,
  GO_TASK_EVENTS,
  GO_TO,
  HISTORY_OPEN,
  MAIN_LABEL,
  MARK_PREFIX,
  SOURCE_WORDS,
  TASK_MAIN_NOT_FOUND,
  TASK_NOT_FOUND,
  TASK_NOT_RELATED,
  TIME_UNKNOWN,
} from "./texts.js";
import {
  eventCase,
  eventWords,
  markReason,
  repeatedStarts,
  roleName,
  shortId,
} from "./words.js";

function nonEmpty(value) {
  return typeof value === "string" && value !== "";
}

function isHookLine(e) {
  return (
    e !== null &&
    typeof e === "object" &&
    typeof e.hook_event_name === "string" &&
    typeof e.session_id === "string"
  );
}

function sourceText(source) {
  if (source === SOURCE_REAL) return SOURCE_WORDS.REAL;
  if (source === SOURCE_ORCH) return SOURCE_WORDS.ORCH;
  // The value of source itself is shown only in the technical fields
  // (REQ-048, design D6).
  return SOURCE_WORDS.other;
}

function whenText(time) {
  const shown = fmtDateTime(time);
  return shown === "" ? TIME_UNKNOWN : `${shown} · ${tzLabel()}`;
}

function agentText(e) {
  if (isNoteLine(e)) return AGENT_ORCH;
  const kind = e.hook_event_name;
  const withAgent =
    kind === "SubagentStart" ||
    kind === "SubagentStop" ||
    (kind === "PostToolUse" && nonEmpty(e.agent_id));
  if (!withAgent) return AGENT_MAIN;
  return `${roleName(e.agent_type)} · ${shortId(e.agent_id)}`;
}

// A task by its key: its name, 8 characters of the key and its state now.
function taskOf(model, key) {
  const task = model.tasks.find((t) => t.key === key);
  if (task === undefined) return { text: TASK_NOT_FOUND, state: null };
  return {
    text: `${roleName(task.role)} · ${shortId(task.key)}`,
    state: task.state,
  };
}

// A row of the main session by a rule, with its state now.
function mainRowOf(row, missing) {
  if (row === undefined) return { text: missing, state: null };
  return { text: MAIN_LABEL, state: row.state };
}

// The field "Задача" (design 4.2): the current state, so it may change.
function taskField(model, history, e, index, marked) {
  const notRelated = { text: TASK_NOT_RELATED, state: null };
  if (marked) return notRelated;
  if (isNoteLine(e)) {
    const request = history.requests.find((r) =>
      r.notes.some((n) => n.index === index),
    );
    if (request === undefined) return notRelated;
    const row = model.mainRows.find((r) => r.key === `main:${request.index}`);
    return row === undefined ? notRelated : mainRowOf(row, TASK_NOT_RELATED);
  }
  switch (e.hook_event_name) {
    case "SubagentStart":
    case "SubagentStop":
      return taskOf(model, e.agent_id);
    case "PostToolUse":
      return taskOf(model, e.launched_agent_id);
    case "UserPromptSubmit":
      return mainRowOf(
        model.mainRows.find((r) => r.key === `main:${index}`),
        TASK_MAIN_NOT_FOUND,
      );
    case "Stop":
      return mainRowOf(
        model.mainRows.find((r) => r.end_index === index),
        TASK_MAIN_NOT_FOUND,
      );
    default:
      return notRelated;
  }
}

// Every field of the line in the order of LINE_KEYS as text, except the text
// of a message of the owner.
function techFields(e) {
  const out = [];
  for (const key of LINE_KEYS) {
    if (key === "prompt_text" || !Object.hasOwn(e, key)) continue;
    const value = e[key];
    out.push([key, typeof value === "string" ? value : JSON.stringify(value)]);
  }
  return out;
}

// ------------------------------------------------------------ transitions

// The transitions of the details of an event (design 4.3): the buttons of the
// field "Агент" and of the field "Задача" and the texts that stand instead of a
// button that cannot be.
function linksOf(model, history, e, index, marked) {
  const agent = [];
  const task = [];
  const notes = { panel: null, window: null, agent: null };
  const hasTask = (key) => model.tasks.some((t) => t.key === key);
  // The card of the main session only where it opens: a marked line of a
  // session the model does not know leads "как у её вида" (design 4.3) to a
  // card that is not there, so it has no button.
  const toMain = (label) => {
    const target = mainRowOfEvent(model, index);
    if (mainChoiceOpens(model, target)) {
      agent.push({ go: "card-main", target, label });
    }
  };
  const shown = shownInPanel(model);
  const toTask = (ref, windowKey) => {
    if (shown.has(ref.key)) {
      task.push({ go: "panel", target: ref.key, label: GO_PANEL });
    } else {
      notes.panel = "missing";
    }
    task.push({ go: "task-events", target: ref, label: GO_TASK_EVENTS });
    if (windowKey !== undefined) {
      task.push({ go: "history", target: windowKey, label: HISTORY_OPEN });
    } else {
      notes.window = "missing";
    }
  };
  const toRow = (rowKey) => {
    if (rowKey === undefined || rowKey === null) return;
    toTask({ kind: "main", key: rowKey }, history.windowOfMainRow.get(rowKey));
  };
  if (isNoteLine(e)) {
    const request = history.requests.find((r) =>
      r.notes.some((n) => n.index === index),
    );
    if (request !== undefined) {
      const row = model.mainRows.find((r) => r.key === `main:${request.index}`);
      if (row !== undefined) toRow(row.key);
    }
    return { agent, task, notes };
  }
  const kind = e.hook_event_name;
  // The field "Агент".
  if (kind === "SubagentStart" || kind === "SubagentStop") {
    if (hasTask(e.agent_id)) {
      agent.push({ go: "card-instance", target: e.agent_id, label: GO_AGENT });
    } else {
      notes.agent = "missing";
    }
  } else if (kind === "PostToolUse") {
    if (nonEmpty(e.agent_id)) {
      if (hasTask(e.agent_id)) {
        agent.push({ go: "card-instance", target: e.agent_id, label: GO_FROM });
      } else {
        notes.agent = "missing";
      }
    } else {
      toMain(GO_FROM);
    }
  } else {
    toMain(GO_AGENT);
  }
  // The field "Задача": a marked line, the start and the end of a session have
  // no transitions.
  if (marked || kind === "SessionStart" || kind === "SessionEnd") {
    return { agent, task, notes };
  }
  if (kind === "SubagentStart" || kind === "SubagentStop") {
    if (hasTask(e.agent_id)) {
      toTask(
        { kind: "task", key: e.agent_id },
        history.windowOfTask.get(e.agent_id),
      );
    }
  } else if (kind === "PostToolUse") {
    const key = e.launched_agent_id;
    if (nonEmpty(key) && hasTask(key)) {
      task.push({ go: "card-instance", target: key, label: GO_TO });
      toTask({ kind: "task", key }, history.windowOfTask.get(key));
    }
  } else if (kind === "UserPromptSubmit") {
    toRow(model.mainRows.find((r) => r.key === `main:${index}`)?.key);
  } else if (kind === "Stop") {
    toRow(model.mainRows.find((r) => r.end_index === index)?.key);
  }
  return { agent, task, notes };
}

// The details of line `index` of the file, or null if it is neither a hook
// line nor a record of the orchestrator.
export function eventDetails(model, history, index) {
  const e = model.entries[index];
  const note = isNoteLine(e);
  if (!note && !isHookLine(e)) return null;
  const reason = note ? null : (model.marks[index] ?? null);
  const marked = reason !== null;
  const caseKey = eventCase(e, repeatedStarts(model.entries).has(index));
  const own = caseKey === null ? undefined : EVENT_TABLE[caseKey];
  const told = marked || own === undefined ? EVENT_TABLE.marked : own;
  return {
    index,
    case: caseKey,
    when: whenText(e.time),
    source: sourceText(e.source),
    session: nonEmpty(e.session_id)
      ? { short: shortId(e.session_id), full: e.session_id }
      : null,
    agent: agentText(e),
    task: taskField(model, history, e, index, marked),
    words: eventWords(caseKey, e),
    meaning: told.meaning,
    not_proved: told.not_proved,
    mark: marked ? MARK_PREFIX + markReason(reason, e) : null,
    note: note
      ? {
          text: typeof e.note_text === "string" ? e.note_text : "",
          req_id: nonEmpty(e.req_id) ? e.req_id : null,
          request_time: nonEmpty(e.request_time) ? e.request_time : null,
          auto: e.request_time_auto === true,
        }
      : null,
    tech: techFields(e),
    links: linksOf(model, history, e, index, marked),
  };
}
