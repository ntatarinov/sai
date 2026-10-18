// The card of one instance of an agent (REQ-044, design 3.7): one task of the
// model — one agent_id — with its task, its three lines of state, who
// launched it, whom it launched, its starts and returns and the other
// instances of its role. Everything comes from the lines of the journal, the
// records of server starts and the clock of the page in the model; links are
// made only by equal identifiers. Pure ES module: no DOM, no Node API, no
// clock.

import { mainRowOfTask } from "./main-card.js";
import {
  UNCONFIRMED_STATES,
  ageOf,
  showsAge,
  showsSessionEvent,
} from "./model.js";
import { shownInPanel } from "./panels.js";
import { MAIN_KEY, buildCard, roleKey } from "./office-model.js";
import { ROLE_UNKNOWN } from "./texts.js";
import { repeatedStarts, roleAbout, roleName, shortId } from "./words.js";

// The instances shown in the list before "Остальные экземпляры".
export const INSTANCES_SHOWN = 5;

function nonEmpty(value) {
  return typeof value === "string" && value !== "";
}

function ids(value) {
  return {
    short: shortId(value),
    full: typeof value === "string" ? value : "",
  };
}

// The items of the list of the model that are tasks of this role, in the
// order of the list (rule d: in progress first, new ones on top).
export function roleInstances(model, role) {
  return model.list.filter(
    (item) => item.kind === "task" && item.role === role,
  );
}

// The instance a click on a character opens: the first task of its role in
// the order of the list; null for the main session and an unknown key.
export function defaultInstance(model, characterKey) {
  if (characterKey === MAIN_KEY) return null;
  const tasks = model.list.filter(
    (item) => item.kind === "task" && roleKey(item.role) === characterKey,
  );
  if (tasks.length === 0) return null;
  // (1) in progress — the first of them in the order of the list.
  const working = tasks.find((t) => t.state === "in_progress");
  if (working !== undefined) return working.key;
  // (2) the ones that need attention, else (3) all: the one with the latest
  // own event (REQ-047, criterion 8; design 4.5).
  const attention = tasks.filter((t) => UNCONFIRMED_STATES.includes(t.state));
  const pool = attention.length > 0 ? attention : tasks;
  let best = pool[0];
  for (const t of pool) if (ownEvent(t) > ownEvent(best)) best = t;
  return best.key;
}

// The line of the latest own event of a task: its last start or its last stop
// (trusted lines of the model); a handoff and a record do not count.
function ownEvent(task) {
  const stops = task.stop_indices;
  const lastStop = stops.length === 0 ? -1 : stops[stops.length - 1];
  return Math.max(task.last_start_index, lastStop);
}

// The trusted PostToolUse lines with a given field equal to key; lines of one
// tool_use_id count once (the first), as in rule z.
function linkLines(model, field, key) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < model.entries.length; i++) {
    const e = model.entries[i];
    if (model.trusted[i] !== true || e.hook_event_name !== "PostToolUse") {
      continue;
    }
    if (e[field] !== key) continue;
    if (typeof e.tool_use_id === "string") {
      if (seen.has(e.tool_use_id)) continue;
      seen.add(e.tool_use_id);
    }
    out.push(i);
  }
  return out;
}

// The earliest usable record of a server start after line `index`
// (design D11): the start after which the events stopped being written.
function serverStartAfter(model, index) {
  const count = model.entries.length;
  for (const s of model.serverStarts) {
    if (s === null || typeof s !== "object") continue;
    const lines = s.journal_lines;
    if (!Number.isInteger(lines) || lines < 0 || lines > count) continue;
    if (lines > index) return typeof s.time === "string" ? s.time : null;
  }
  return null;
}

function instanceItem(item, entries, current) {
  const withSession = showsSessionEvent(item.state);
  const withAge = showsAge(item.state);
  const start = entries[item.last_start_index];
  return {
    key: item.key,
    short: shortId(item.key),
    state: item.state,
    last_start_at: start === null || start === undefined ? null : start.time,
    session_last_event_at: withSession ? item.session_last_event_at : null,
    age_ms: withAge ? item.age_ms : null,
    description: nonEmpty(item.description) ? item.description : null,
    current: item.key === current,
  };
}

// The data of the card of the instance with this key, or null if the model
// has no such task.
export function buildInstanceCard(model, office, taskKey, history = null) {
  const task = model.tasks.find((t) => t.key === taskKey);
  if (task === undefined) return null;
  const role = task.role;
  const title = roleName(role);
  const characterKey = roleKey(role);
  const character = office.characters.find((c) => c.key === characterKey);
  const repeated = repeatedStarts(model.entries);
  const now = model.now_ms;

  // Starts, returns and the end of the session, from trusted lines only.
  const starts = [];
  const returns = [];
  let sessionEndAt = null;
  for (let i = 0; i < model.entries.length; i++) {
    if (model.trusted[i] !== true) continue;
    const e = model.entries[i];
    const kind = e.hook_event_name;
    if (kind === "SubagentStart" && e.agent_id === taskKey) {
      starts.push({
        index: i,
        at: e.time,
        kind: repeated.has(i) ? "resume" : "start",
      });
    } else if (kind === "SubagentStop" && e.agent_id === taskKey) {
      returns.push({ index: i, at: e.time });
    } else if (
      kind === "SessionEnd" &&
      e.session_id === task.session_id &&
      i > task.last_start_index
    ) {
      sessionEndAt = e.time;
    }
  }

  const lastStart = starts.length === 0 ? null : starts[starts.length - 1];
  const lastReturn = returns.length === 0 ? null : returns[returns.length - 1];
  let agentEvent = null;
  if (lastStart !== null || lastReturn !== null) {
    const stopLater =
      lastReturn !== null &&
      (lastStart === null || lastReturn.index > lastStart.index);
    const at = stopLater ? lastReturn.at : lastStart.at;
    agentEvent = {
      kind: stopLater ? "stop" : lastStart.kind,
      at,
      age_ms: ageOf(at, now),
    };
  }

  // The lines of the handoff of this task (rule z).
  const givenLines = linkLines(model, "launched_agent_id", taskKey);
  const given = givenLines.map((i) => {
    const e = model.entries[i];
    return {
      index: i,
      at: e.time,
      by: nonEmpty(e.agent_id)
        ? {
            kind: "subagent",
            name: roleName(e.agent_type),
            short: shortId(e.agent_id),
          }
        : { kind: "main" },
      description: nonEmpty(e.description) ? e.description : null,
    };
  });
  let currentTask;
  if (given.length === 0) currentTask = { kind: "no_link" };
  else if (given.length > 1) currentTask = { kind: "several" };
  else if (given[0].description !== null) {
    currentTask = { kind: "described", text: given[0].description };
  } else currentTask = { kind: "no_description" };

  let launcher;
  if (given.length === 0) launcher = { kind: "none", reason: "no_link" };
  else if (given.length > 1) launcher = { kind: "none", reason: "several" };
  else if (task.launched_by === null || task.launched_by.kind === "main") {
    launcher = { kind: "main" };
  } else {
    const key = task.launched_by.agent_id;
    const other = model.tasks.find((t) => t.key === key);
    launcher = {
      kind: "subagent",
      key,
      name: roleName(
        other === undefined ? task.launched_by.agent_type : other.role,
      ),
      short: shortId(key),
      has_task: other !== undefined,
      state: other === undefined ? null : other.state,
    };
  }

  const launched = linkLines(model, "agent_id", taskKey).map((i) => {
    const e = model.entries[i];
    const key =
      typeof e.launched_agent_id === "string" ? e.launched_agent_id : "";
    const other = model.tasks.find((t) => t.key === key);
    return {
      index: i,
      key,
      short: shortId(key),
      name: roleName(other === undefined ? e.subagent_type : other.role),
      state: other === undefined ? null : other.state,
      has_task: other !== undefined,
    };
  });

  const all = roleInstances(model, role).map((item) =>
    instanceItem(item, model.entries, taskKey),
  );

  return {
    key: taskKey,
    role,
    character_key: characterKey,
    color: character === undefined ? 0 : character.color,
    title,
    // What the role does, under the title (REQ-051, criterion 8).
    about: roleAbout(role),
    code: role !== title && role !== ROLE_UNKNOWN ? role : null,
    agent: ids(taskKey),
    session: ids(task.session_id),
    current_task: currentTask,
    task_state: {
      state: task.state,
      session_last_event_at: task.session_last_event_at,
      age_ms: task.age_ms,
      last_start:
        lastStart === null ? null : { kind: lastStart.kind, at: lastStart.at },
      server_start_at:
        task.state === "restarted"
          ? serverStartAfter(model, task.last_start_index)
          : null,
      stop_at: task.state === "completed" ? task.ended_at : null,
      session_end_at: task.state === "unrecorded" ? sessionEndAt : null,
    },
    agent_event: agentEvent,
    workplace: {
      working: character !== undefined && character.working === true,
      count: character === undefined ? 0 : character.working_count,
    },
    launcher,
    given,
    starts,
    returns,
    launched,
    instances: {
      total: all.length,
      shown: all.slice(0, INSTANCES_SHOWN),
      rest: all.slice(INSTANCES_SHOWN),
    },
    role_card: buildCard(model, office, characterKey),
    // The transitions of the card (REQ-047, criterion 2): is the task among
    // the items shown in the panel; the row of the main session for
    // "Основная сессия" of "Кто запустил" (design 4.6).
    links: {
      panel: shownInPanel(model).has(taskKey),
      main_row:
        history === null ? null : mainRowOfTask(model, history, taskKey),
    },
  };
}
