// The panels of the page as pure functions of the model (design 3.10,
// 4.9-4.11): the line "Сейчас", the rows of the journal and its filters, the
// panel of tasks with the summaries of the sessions. The page draws what these
// functions return; the tests call the same functions. Pure ES module: no DOM
// and no Node API, no clock.

import { ageText, fmtDateTime } from "./format.js";
import {
  MAIN_ROW,
  NOW_EMPTY,
  NOW_PREFIX,
  NOW_UNCONFIRMED,
  UNCONFIRMED_LEAD,
  UNCONFIRMED_RESTART,
  UNCONFIRMED_STALE,
  UNCONFIRMED_STALE_AGE,
} from "./texts.js";
import { isNoteLine } from "./schema.js";
import {
  eventCase,
  eventWords,
  repeatedStarts,
  roleName,
  whoOf,
} from "./words.js";

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

// One row of "Сейчас" for an item in progress: the main row is MAIN_ROW; a
// task is the name of its role in plain words and, if there is one, " — " and
// its description. Only the role and the description of the journal.
function nowRow(item) {
  if (item.kind === "main") {
    return {
      key: item.key,
      kind: "main",
      role: null,
      description: null,
      text: MAIN_ROW,
    };
  }
  const role = roleName(item.role);
  const description =
    typeof item.description === "string" && item.description !== ""
      ? item.description
      : null;
  return {
    key: item.key,
    kind: "task",
    role,
    description,
    text: description === null ? role : `${role} — ${description}`,
  };
}

// The block "Сейчас" of the header (REQ-036): one row for every item in
// progress, in the order of the list (rule d: the same order as "Текущие").
// With nothing in progress — "в работе ничего нет" and, if some items are not
// confirmed, their number and, as the title, the reason (REQ-042).
export function nowLine(model) {
  const current = model.list.filter((item) => item.state === "in_progress");
  const rows = current.map(nowRow);
  let text = NOW_PREFIX;
  let title;
  let unconfirmed = 0;
  if (rows.length === 0) {
    text += NOW_EMPTY;
    title = null;
    unconfirmed = model.unconfirmed.count;
    if (unconfirmed >= 1) {
      text += NOW_UNCONFIRMED.replace("{n}", String(unconfirmed));
      title = unconfirmedNote(model).text;
    }
    if (title === null) title = text;
  } else {
    text += rows.map((row) => row.text).join("");
    title = NOW_PREFIX + rows.map((row) => row.text).join("\n");
  }
  return {
    text,
    busy: rows.length > 0,
    count: rows.length,
    unconfirmed,
    rows,
    title,
  };
}

// -------------------------------------------------------------- journal

// One view per line of the journal in the order of the file (design 4.10,
// REQ-045): every hook line, the marked ones too, and every record of the
// orchestrator. The words and "who" come from the line itself and the lines
// before it (words.js); the description of a start or a stop of an agent comes
// through the link of identifiers (rule z) and may appear later.
export function journalRows(model, office) {
  const taskByKey = new Map(model.tasks.map((t) => [t.key, t]));
  const officeLines = new Set(office.routes.map((r) => r.event_index));
  const repeated = repeatedStarts(model.entries);
  const hookView = (row) => {
    const entry = model.entries[row.index];
    const kind = row.event;
    // The description only through the link of identifiers: never guessed.
    let description = "";
    if (kind === "PostToolUse") {
      description = row.description;
    } else if (
      !row.marked &&
      (kind === "SubagentStart" || kind === "SubagentStop")
    ) {
      const task = taskByKey.get(entry.agent_id);
      if (
        task !== undefined &&
        typeof task.description === "string" &&
        task.description !== ""
      ) {
        description = task.description;
      }
    }
    const caseKey = eventCase(entry, repeated.has(row.index));
    return {
      index: row.index,
      kind: "hook",
      event: kind,
      case: caseKey,
      time: row.time,
      session_id: row.session_id,
      source: row.source,
      marked: row.marked,
      reason: row.reason,
      tone: TONES[kind] ?? "session",
      who: whoOf(entry),
      words: eventWords(caseKey, entry),
      description,
      work: WORK_EVENTS.includes(kind),
      office: officeLines.has(row.index),
      // "owner", "service" or null: which row may open the window of history
      // (REQ-008, design 7.5).
      prompt_kind: row.prompt_kind,
    };
  };
  const noteView = (entry, index) => ({
    index,
    kind: "note",
    event: null,
    case: "orch_note",
    time: entry.time,
    session_id:
      typeof entry.session_id === "string" && entry.session_id !== ""
        ? entry.session_id
        : null,
    source: entry.source,
    marked: false,
    reason: null,
    tone: "note",
    who: whoOf(entry),
    words: eventWords("orch_note", entry),
    description: "",
    work: false,
    office: false,
    prompt_kind: null,
  });
  // model.journal is in the order of the file; the records are merged in by
  // their line.
  const out = [];
  let k = 0;
  const journal = model.journal;
  for (let i = 0; i < model.entries.length; i++) {
    const entry = model.entries[i];
    if (k < journal.length && journal[k].index === i) {
      out.push(hookView(journal[k]));
      k += 1;
    } else if (isNoteLine(entry)) {
      out.push(noteView(entry, i));
    }
  }
  return out;
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
