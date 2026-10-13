// The panels of the page as pure functions of the model (design 3.10,
// 4.9-4.11): the line "Сейчас", the rows of the journal and its filters, the
// panel of tasks with the summaries of the sessions. The page draws what these
// functions return; the tests call the same functions. Pure ES module: no DOM
// and no Node API, no clock.

import { ageText, fmtDateTime } from "./format.js";
import { roleLabel } from "./office-model.js";
import {
  EVENT_LABELS,
  MAIN_LABEL,
  MAIN_ROW,
  NOW_EMPTY,
  NOW_MORE,
  NOW_PREFIX,
  NOW_UNCONFIRMED,
  ROLE_UNKNOWN,
  UNCONFIRMED_LEAD,
  UNCONFIRMED_RESTART,
  UNCONFIRMED_STALE,
  UNCONFIRMED_STALE_AGE,
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

// The colour group of each kind of event: the stripe of a journal row and the
// dot of a line of the timeline of the window of history.
export const TONES = Object.freeze({
  UserPromptSubmit: "start",
  SubagentStart: "start",
  Stop: "end",
  SubagentStop: "end",
  PostToolUse: "handoff",
  SessionStart: "session",
  SessionEnd: "session",
});

// ------------------------------------------------------------- "Сейчас"

// The explanation of the items that the journal does not confirm: one text for
// the line "Сейчас" (as its title) and the note over the history. Null if there
// is no such item. The age and the time come from the model; the page has no
// clock here.
export function unconfirmedNote(model) {
  const u = model.unconfirmed;
  if (u.count === 0) return null;
  const parts = [UNCONFIRMED_LEAD];
  if (u.stale >= 1) {
    let part = UNCONFIRMED_STALE.replace("{n}", String(u.stale));
    // The age of the oldest one may be unknown: then only the first sentence.
    if (u.oldest_stale_age_ms !== null) {
      part += ` ${UNCONFIRMED_STALE_AGE.replace(
        "{age}",
        ageText(u.oldest_stale_age_ms),
      )}`;
    }
    parts.push(part);
  }
  if (u.restarted >= 1 && model.last_start !== null) {
    const time = fmtDateTime(model.last_start.time);
    if (time !== "") {
      parts.push(
        UNCONFIRMED_RESTART.replace("{n}", String(u.restarted)).replace(
          "{time}",
          time,
        ),
      );
    }
  }
  return { text: parts.join(" "), stale: u.stale, restarted: u.restarted };
}

// The line of the header: the first item of "Текущие" (the list is already in
// the order of rule d: the ones in progress first, the new ones on top) and
// how many more items are in progress. With nothing in progress and some
// items without confirmation, the number of them and, as the title, the reason.
export function nowLine(model) {
  const current = model.list.filter((item) => item.state === "in_progress");
  let text = NOW_PREFIX;
  let unconfirmed = 0;
  let title = null;
  if (current.length === 0) {
    text += NOW_EMPTY;
    unconfirmed = model.unconfirmed.count;
    if (unconfirmed >= 1) {
      text += NOW_UNCONFIRMED.replace("{n}", String(unconfirmed));
      title = unconfirmedNote(model).text;
    }
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
  return {
    text,
    busy: current.length > 0,
    count: current.length,
    unconfirmed,
    title: title === null ? text : title,
  };
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
      // "owner", "service" or null: which row may open the window of history
      // (REQ-008, design 7.5).
      prompt_kind: row.prompt_kind,
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

// The card of a session: the word (running, stale or none), the first and the
// last trusted event and the age of the last one. No count of tasks and no
// progress: the journal does not know how much of the work is left.
function sessionCard(session, running) {
  return {
    kind: "session",
    session_id: session.session_id,
    running,
    word: session.word,
    first_event_at: session.first_event_at,
    last_event_at: session.last_event_at,
    age_ms: session.age_ms,
  };
}

// The body of the panel of tasks (design 4.11).
export function taskPanel(model, limit = LIST_LIMIT) {
  const sessionById = new Map(model.sessions.map((s) => [s.session_id, s]));
  // The sessions that have tasks, over all tasks, before the limit.
  const hasTasks = new Set(model.tasks.map((t) => t.session_id));
  const runningIds = new Set();
  const runningSessions = model.sessions
    .filter((s) => s.running)
    .sort((a, b) => b.first_index - a.first_index);
  for (const s of runningSessions) runningIds.add(s.session_id);
  const running = runningSessions.map((s) => sessionCard(s, true));

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
      const session = sessionById.get(sid);
      if (session !== undefined && hasTasks.has(sid)) {
        history.push(sessionCard(session, false));
      }
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
    // The note stands with the second part of the line "Сейчас": only when
    // nothing is in progress.
    unconfirmed_note: model.list.some((item) => item.state === "in_progress")
      ? null
      : unconfirmedNote(model),
  };
}
