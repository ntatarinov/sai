// The panels of the page as pure functions of the model (design 3.10,
// 4.9-4.11): the line "Сейчас", the rows of the journal and its filters, the
// panel of tasks with the summaries of the sessions. The page draws what these
// functions return; the tests call the same functions. Pure ES module: no DOM
// and no Node API, no clock.

import { roleLabel } from "./office-model.js";
import {
  EVENT_LABELS,
  MAIN_LABEL,
  MAIN_ROW,
  NOW_EMPTY,
  NOW_MORE,
  NOW_PREFIX,
  ROLE_UNKNOWN,
} from "./texts.js";

// The journal shows the last 200 rows that pass the filter, the panel of
// tasks 300 items of the list. This limits only the drawing: the rules, the
// office and the summaries read the whole array.
export const JOURNAL_LIMIT = 200;
export const LIST_LIMIT = 300;
export const FILTERS = Object.freeze(["all", "work", "office"]);
// The kinds of the filter "Работа".
export const WORK_EVENTS = Object.freeze([
  "UserPromptSubmit",
  "Stop",
  "PostToolUse",
  "SubagentStart",
  "SubagentStop",
]);

const MAIN_EVENTS = new Set([
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "Stop",
]);

const TONES = Object.freeze({
  UserPromptSubmit: "start",
  SubagentStart: "start",
  Stop: "end",
  SubagentStop: "end",
  PostToolUse: "handoff",
  SessionStart: "session",
  SessionEnd: "session",
});

// ------------------------------------------------------------- "Сейчас"

// The line of the header: the first item of "Текущие" (the list is already in
// the order of rule d: the ones in progress first, the new ones on top) and
// how many more items are in progress.
export function nowLine(model) {
  const current = model.list.filter((item) => item.state === "in_progress");
  let text = NOW_PREFIX;
  if (current.length === 0) {
    text += NOW_EMPTY;
  } else {
    const first = current[0];
    if (first.kind === "main") {
      text += MAIN_ROW;
    } else {
      text += roleLabel(first.role);
      if (typeof first.description === "string" && first.description !== "") {
        text += ` — ${first.description}`;
      }
    }
    if (current.length > 1) {
      text += NOW_MORE.replace("{n}", String(current.length - 1));
    }
  }
  return { text, busy: current.length > 0, count: current.length };
}

// -------------------------------------------------------------- journal

// One view per non-empty line of the file, the marked ones too, in the order
// of the file (design 4.10).
export function journalRows(model, office) {
  const taskByKey = new Map(model.tasks.map((t) => [t.key, t]));
  const officeLines = new Set(office.routes.map((r) => r.event_index));
  return model.journal.map((row) => {
    const kind = row.event;
    let who = row.role;
    if (who === "") who = MAIN_EVENTS.has(kind) ? MAIN_LABEL : ROLE_UNKNOWN;
    // The description only through the link of identifiers: never guessed.
    let description = "";
    if (kind === "PostToolUse") {
      description = row.description;
    } else if (
      !row.marked &&
      (kind === "SubagentStart" || kind === "SubagentStop")
    ) {
      const task = taskByKey.get(model.entries[row.index].agent_id);
      if (
        task !== undefined &&
        typeof task.description === "string" &&
        task.description !== ""
      ) {
        description = task.description;
      }
    }
    return {
      index: row.index,
      time: row.time,
      session_id: row.session_id,
      source: row.source,
      marked: row.marked,
      kind,
      tone: TONES[kind] ?? "session",
      who,
      event: EVENT_LABELS[kind] ?? kind,
      description,
      work: WORK_EVENTS.includes(kind),
      office: officeLines.has(row.index),
    };
  });
}

// The rows of a filter: matching is how many rows pass it, rows the last
// min(matching, limit) of them in the order of the file. An unknown filter is
// "all".
export function filterJournal(rows, filter, limit = JOURNAL_LIMIT) {
  let passing = rows;
  if (filter === "work") passing = rows.filter((r) => r.work);
  else if (filter === "office") passing = rows.filter((r) => r.office);
  const max = Number.isSafeInteger(limit) && limit >= 0 ? limit : JOURNAL_LIMIT;
  return {
    rows: max === 0 ? [] : passing.slice(-max),
    matching: passing.length,
  };
}

// ---------------------------------------------------------------- tasks

// For every session: m tasks whose session is this one (the session of the
// last start, so a task resumed in another session counts there), n of them
// completed, k different roles among them. Counted over all tasks, before
// the limit of the list.
export function sessionStats(model) {
  const stats = new Map();
  const roles = new Map();
  for (const s of model.sessions) {
    stats.set(s.session_id, { n: 0, m: 0, k: 0 });
    roles.set(s.session_id, new Set());
  }
  for (const task of model.tasks) {
    let entry = stats.get(task.session_id);
    if (entry === undefined) {
      entry = { n: 0, m: 0, k: 0 };
      stats.set(task.session_id, entry);
      roles.set(task.session_id, new Set());
    }
    entry.m += 1;
    if (task.state === "completed") entry.n += 1;
    roles.get(task.session_id).add(task.role);
  }
  for (const [id, entry] of stats) entry.k = roles.get(id).size;
  return stats;
}

function sessionCard(sessionId, running, stats) {
  const s = stats.get(sessionId) ?? { n: 0, m: 0, k: 0 };
  return {
    kind: "session",
    session_id: sessionId,
    running,
    n: s.n,
    m: s.m,
    k: s.k,
  };
}

// The body of the panel of tasks (design 4.11).
export function taskPanel(model, limit = LIST_LIMIT) {
  const stats = sessionStats(model);
  const runningIds = new Set();
  const runningSessions = model.sessions
    .filter((s) => s.running)
    .sort((a, b) => b.first_index - a.first_index);
  for (const s of runningSessions) runningIds.add(s.session_id);
  const running = runningSessions.map((s) =>
    sessionCard(s.session_id, true, stats),
  );

  const max = Number.isSafeInteger(limit) && limit >= 0 ? limit : LIST_LIMIT;
  const shownItems = model.list.slice(0, max);
  const current = [];
  const history = [];
  const summarized = new Set();
  for (const item of shownItems) {
    if (item.state === "in_progress") {
      current.push(item);
      continue;
    }
    const sid = item.session_id;
    if (!runningIds.has(sid) && !summarized.has(sid)) {
      summarized.add(sid);
      const card = sessionCard(sid, false, stats);
      if (card.m >= 1) history.push(card);
    }
    history.push(item);
  }

  return {
    running,
    current,
    history,
    shown: shownItems.length,
    total: model.list.length,
    starts: [...model.serverStarts].reverse(),
  };
}
