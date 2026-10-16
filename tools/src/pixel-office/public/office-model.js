// The office as a pure function of the model of the page (design 3.6, 3.7,
// 4.5): who sits where, in which colour, who is working, which routes exist,
// which bubbles the events give, what the board and the card of an agent show.
// No state is kept except the cache of layouts by the number of desks
// (LAYOUTS below): the same journal always gives the same office, and the
// same number of desks always gives the same layout object, because Sim
// (office-sim.js) sees that the grid changed by comparing the layout objects
// by identity (decision D21). Pure ES
// module: no DOM and no Node API, no clock and no randomness (the time of a
// bubble is the time written in the journal line).

import { buildLayout } from "./layout.js";
import { ITEM_STATES, UNCONFIRMED_STATES } from "./model.js";
import { BUBBLE_TEXTS, MAIN_LABEL, ROLE_UNKNOWN } from "./texts.js";
import { roleName } from "./words.js";

export const MAIN_KEY = "main";

// The key of the character of a role. The keys of the main session and of
// the roles never coincide, so no name of a role is reserved (decision D17).
export function roleKey(role) {
  return `role:${role}`;
}

// The colours of the characters (design 4.5): 0 is the main session, 1-11 the
// roles by the number of their desk.
export const ROLE_PALETTE = Object.freeze([
  "#e8b64c",
  "#5aa9ff",
  "#b48ce8",
  "#48c98a",
  "#4fd0c0",
  "#7ed957",
  "#ef6b5e",
  "#f08a5d",
  "#6bd4ef",
  "#9aa7ff",
  "#f0c674",
  "#c98ad4",
]);

// The number of the colour of desk d: 0 for the main session, 1 + ((d - 1) mod
// 11) for a role. The desk depends only on the journal, so does the colour.
export function colorOfDesk(d) {
  if (!Number.isSafeInteger(d) || d <= 0) return 0;
  return 1 + ((d - 1) % 11);
}

// A bubble is seen from the time of its event to 10 seconds after it.
export const BUBBLE_WINDOW_MS = 10000;
// Columns of the board; the roles that do not fit are counted in "+N".
export const BOARD_COLUMNS = 3;

const LABEL_MAX = 16;
const CARD_COMPLETED_MAX = 5;
const CARD_UNCONFIRMED_MAX = 10;
const CARD_UNRECORDED_MAX = 5;
const CARD_EVENTS_MAX = 10;

// The former short caption of a role (decision D13). It is kept as a rule and
// an export, but no caption is built with it any more: the canvas, the board
// and the legend show the name of the role in plain words (REQ-048,
// decision 0058). If the role ends
// with brackets that hold something and are simple (no other bracket between
// the last "(" and the final ")"), the text of that pair is taken; otherwise
// the whole role. A result longer than 16 code points is cut to the first 15
// and an ellipsis. Nested or unbalanced brackets are not parsed: the role is
// taken whole.
export function roleLabel(role) {
  let text = typeof role === "string" ? role : "";
  if (text.endsWith(")")) {
    const open = text.lastIndexOf("(");
    if (open >= 0) {
      const inner = text.slice(open + 1, -1);
      if (inner !== "" && !inner.includes(")")) text = inner;
    }
  }
  const points = Array.from(text);
  if (points.length > LABEL_MAX) return `${points.slice(0, 15).join("")}…`;
  return text;
}

// A count for each of the five states. A state that is not one of them is
// not counted (only the model gives states, so it cannot happen), so a count
// is never NaN.
export function countStates(items) {
  const counts = {};
  for (const state of ITEM_STATES) counts[state] = 0;
  for (const item of items) {
    if (Object.hasOwn(counts, item.state)) counts[item.state] += 1;
  }
  return counts;
}

// One layout object per number of desks: the simulator sees that the grid
// changed by comparing the objects (design 4.5, decision D21).
const LAYOUTS = new Map();

function layoutFor(deskCount) {
  let layout = LAYOUTS.get(deskCount);
  if (layout === undefined) {
    layout = buildLayout(deskCount);
    LAYOUTS.set(deskCount, layout);
  }
  return layout;
}

function roleOf(agentType) {
  return typeof agentType === "string" && agentType !== ""
    ? agentType
    : ROLE_UNKNOWN;
}

// The character of the one who launched a task: "main", the role of the task
// with that agent_id, or, if there is none, agent_type of the linking line.
// Null if the launcher cannot be determined: then there is no route.
function launcherKey(task, taskByAgent) {
  const by = task.launched_by;
  if (by === null || by === undefined) return null;
  if (by.kind === "main") return MAIN_KEY;
  if (by.kind !== "subagent") return null;
  const known = taskByAgent.get(by.agent_id);
  return roleKey(known !== undefined ? known.role : roleOf(by.agent_type));
}

function timeMs(model, index) {
  const e = model.entries[index];
  return e === null || e === undefined ? NaN : Date.parse(e.time);
}

// Builds the office from the model.
export function buildOffice(model) {
  // The roles in the order of their first appearance: model.tasks are in the
  // order of the first start of each task.
  const roleTasks = new Map();
  for (const task of model.tasks) {
    const list = roleTasks.get(task.role);
    if (list === undefined) roleTasks.set(task.role, [task]);
    else list.push(task);
  }

  const hasMain = model.sessions.length > 0;
  const characters = [];
  if (hasMain) {
    const rows = model.mainRows;
    const counts = countStates(rows);
    characters.push({
      key: MAIN_KEY,
      kind: "main",
      full: MAIN_LABEL,
      label: MAIN_LABEL,
      desk_index: 0,
      color: colorOfDesk(0),
      working: counts.in_progress > 0,
      working_count: counts.in_progress,
      counts,
      sessions_running: model.sessions.filter((s) => s.running).length,
    });
  }
  // Every role with a task has a desk: 1, 2, 3, ... with no limit (D11, D17).
  let desk = 1;
  for (const [role, tasks] of roleTasks) {
    const counts = countStates(tasks);
    characters.push({
      key: roleKey(role),
      kind: "role",
      full: role,
      label: roleName(role),
      desk_index: desk,
      color: colorOfDesk(desk),
      working: counts.in_progress > 0,
      working_count: counts.in_progress,
      counts,
    });
    desk += 1;
  }

  const layout = layoutFor(characters.length);
  const byKey = new Map(characters.map((c) => [c.key, c]));
  const desks = characters.map((c) => ({ index: c.desk_index, key: c.key }));
  const seat = (key) => [...layout.desks[byKey.get(key).desk_index].seat];
  const approach = (key) => [
    ...layout.desks[byKey.get(key).desk_index].approach,
  ];

  // Routes: a handoff at the first start of a task, a result at every stop.
  const taskByAgent = new Map(model.tasks.map((t) => [t.key, t]));
  const routes = [];
  for (const task of model.tasks) {
    const launcher = launcherKey(task, taskByAgent);
    const target = roleKey(task.role);
    if (launcher === null || launcher === target) continue;
    if (!byKey.has(launcher) || !byKey.has(target)) continue;
    // Only the first start counts: a repeated start is a resumption of the
    // same task, and nobody launched it anew.
    const handoffId = `${task.first_start_index}:handoff`;
    routes.push({
      id: handoffId,
      event_index: task.first_start_index,
      time: model.entries[task.first_start_index].time,
      kind: "handoff",
      walker: launcher,
      target,
      task_key: task.key,
      after: null,
      from_cell: seat(launcher),
      to_cell: approach(target),
    });
    // The end of a task: the role goes to the desk of the launcher and back.
    // It waits for the handoff of the same task.
    for (const stop of task.stop_indices) {
      routes.push({
        id: `${stop}:result`,
        event_index: stop,
        time: model.entries[stop].time,
        kind: "result",
        walker: target,
        target: launcher,
        task_key: task.key,
        after: handoffId,
        from_cell: seat(target),
        to_cell: approach(launcher),
      });
    }
  }
  const order = (route) => (route.kind === "handoff" ? 0 : 1);
  routes.sort((a, b) => a.event_index - b.event_index || order(a) - order(b));

  // Bubbles: one event per case, only from trusted lines (the model holds
  // nothing else). The time is that of the hook, written in the line.
  const bubbleEvents = [];
  const addBubble = (key, phrase, index) => {
    const ms = timeMs(model, index);
    if (Number.isFinite(ms)) {
      bubbleEvents.push({ key, phrase, event_index: index, time_ms: ms });
    }
  };
  for (const task of model.tasks) {
    const key = roleKey(task.role);
    addBubble(key, "got_task", task.first_start_index);
    for (const stop of task.stop_indices) addBubble(key, "done", stop);
  }
  if (hasMain) {
    for (const row of model.mainRows) {
      addBubble(MAIN_KEY, "got_request", row.start_index);
      if (row.closed_by === "stop" && row.end_index !== null) {
        addBubble(MAIN_KEY, "answer_ready", row.end_index);
      }
    }
  }
  bubbleEvents.sort(
    (a, b) => a.time_ms - b.time_ms || a.event_index - b.event_index,
  );

  // The board: the tasks of the running sessions, a column per role in the
  // order of the desks.
  const running = new Set(
    model.sessions.filter((s) => s.running).map((s) => s.session_id),
  );
  const boardRoles = [];
  for (const [role, tasks] of roleTasks) {
    const live = tasks.filter((t) => running.has(t.session_id));
    if (live.length === 0) continue;
    const character = byKey.get(roleKey(role));
    boardRoles.push({
      key: character.key,
      label: character.label,
      color: character.color,
      counts: countStates(live),
    });
  }

  return {
    layout,
    desks,
    characters,
    routes,
    bubble_events: bubbleEvents,
    board: {
      columns: boardRoles.slice(0, BOARD_COLUMNS),
      more: Math.max(0, boardRoles.length - BOARD_COLUMNS),
    },
  };
}

// ---------------------------------------------------------------- bubbles

// The bubbles at the moment nowMs (the clock of the computer): of the events
// with 0 <= nowMs - time_ms <= 10 000, for every character the one latest in
// the journal. The events are sorted by time_ms, so the window is found by a
// binary search.
export function bubblesAt(office, nowMs) {
  const out = new Map();
  const events = office.bubble_events;
  if (!Number.isFinite(nowMs)) return out;
  const from = nowMs - BUBBLE_WINDOW_MS;
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].time_ms < from) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < events.length && events[i].time_ms <= nowMs; i++) {
    const e = events[i];
    const held = out.get(e.key);
    if (held === undefined || e.event_index > held.event_index) {
      out.set(e.key, {
        phrase: e.phrase,
        text: BUBBLE_TEXTS[e.phrase],
        event_index: e.event_index,
        time_ms: e.time_ms,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the card

// Does a journal row belong to the card of this character? The events of a
// role are the trusted lines that came from inside a subagent of that role
// (they have agent_id) plus the linking lines of its tasks. A line without
// agent_id belongs to the main session even if it has agent_type (a session
// started with an agent of its own).
function belongsTo(entry, isMain, role, taskKeys) {
  const hasAgent = typeof entry.agent_id === "string" && entry.agent_id !== "";
  if (isMain) return !hasAgent;
  if (hasAgent && roleOf(entry.agent_type) === role) return true;
  return (
    entry.hook_event_name === "PostToolUse" &&
    taskKeys.has(entry.launched_agent_id)
  );
}

// The card of one character, from the same model as the journal and the list
// (design 3.7). Null if there is no such character.
export function buildCard(model, office, key) {
  const character = office.characters.find((c) => c.key === key);
  if (character === undefined) return null;
  const isMain = character.kind === "main";
  const role = character.full;
  const mine = model.list.filter((item) =>
    isMain ? item.kind === "main" : item.kind === "task" && item.role === role,
  );
  const inProgress = mine.filter((item) => item.state === "in_progress");
  // "No fresh data" and "server restarted" in the order of the list; the
  // total is counted before the limit.
  const unconfirmedAll = mine.filter((item) =>
    UNCONFIRMED_STATES.includes(item.state),
  );
  const unrecordedAll = mine.filter((item) => item.state === "unrecorded");
  const completed = mine
    .filter((item) => item.state === "completed")
    .sort((a, b) => b.end_index - a.end_index)
    .slice(0, CARD_COMPLETED_MAX);

  const taskKeys = new Set(
    isMain ? [] : model.tasks.filter((t) => t.role === role).map((t) => t.key),
  );
  const events = [];
  for (let i = model.journal.length - 1; i >= 0; i--) {
    const row = model.journal[i];
    if (row.marked) continue;
    if (belongsTo(model.entries[row.index], isMain, role, taskKeys)) {
      events.push(row);
      if (events.length === CARD_EVENTS_MAX) break;
    }
  }

  const card = {
    key: character.key,
    kind: character.kind,
    full: character.full,
    label: character.label,
    color: character.color,
    working_count: character.working_count,
    in_progress: inProgress,
    unconfirmed: unconfirmedAll.slice(0, CARD_UNCONFIRMED_MAX),
    unconfirmed_total: unconfirmedAll.length,
    recent_completed: completed,
    unrecorded: unrecordedAll.slice(0, CARD_UNRECORDED_MAX),
    unrecorded_total: unrecordedAll.length,
    recent_events: events,
  };
  if (isMain) card.sessions_running = character.sessions_running;
  return card;
}
