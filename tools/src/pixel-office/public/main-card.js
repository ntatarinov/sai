// The card of the main session (REQ-047, criterion 1; design 3.8): one row of
// the main session — one request — with its state and its basis, what it
// launched in the window of its request, the other rows of its session and the
// other sessions. Everything comes from the lines of the journal, the records
// of server starts and the clock of the page in the model; links are made only
// by identifiers and the windows of the requests (rule 3 of the window of
// history). Pure ES module: no DOM, no Node API, no clock.

import { fmtDateTime } from "./format.js";
import { MAIN_KEY, buildCard } from "./office-model.js";
import { shownInPanel } from "./panels.js";
import { FILTER_SESSION_OPTION, TIME_UNKNOWN } from "./texts.js";
import { eventCase, roleName, shortId } from "./words.js";

// The other rows of the session shown before "показано n из N".
export const OTHER_ROWS_SHOWN = 5;

function rowsOf(model, sid) {
  return model.mainRows
    .filter((r) => r.session_id === sid)
    .sort((a, b) => a.start_index - b.start_index);
}

function sel(row, sid) {
  return {
    row: row === undefined || row === null ? null : row.key,
    session: sid,
  };
}

// The one rule of whether the card of the main session opens on a choice
// {row, session}: the model knows its session (buildMainCard gives null
// otherwise). The transitions of the details of an event (linksOf) and the page
// (openMain) both ask it, so a transition is offered only where a card opens.
export function mainChoiceOpens(model, choice) {
  return (
    choice !== null &&
    choice !== undefined &&
    model.sessions.some((s) => s.session_id === choice.session)
  );
}

// The row the card opens on by default: the first row of the main session in
// the order of the list (rule d); no rows — the first running session, else the
// last one; no sessions — null.
export function defaultMainSel(model) {
  const first = model.list.find((item) => item.kind === "main");
  if (first !== undefined) return sel(first, first.session_id);
  if (model.sessions.length === 0) return null;
  const running = model.sessions.find((s) => s.running);
  const session = running ?? model.sessions[model.sessions.length - 1];
  return sel(null, session.session_id);
}

// The row of the main session for "Основная сессия" of the card of a task
// (design 4.6): the row of the request in whose window the first start of the
// task lies; no window — the first row of the session of the task.
export function mainRowOfTask(model, history, taskKey) {
  const task = model.tasks.find((t) => t.key === taskKey);
  if (task === undefined) return null;
  const first = model.entries[task.first_start_index];
  const sid =
    first !== null && typeof first === "object"
      ? first.session_id
      : task.session_id;
  const window = history.windowOfTask.get(taskKey);
  if (window !== undefined) {
    const row = model.mainRows.find((r) => r.key === `main:${window.slice(4)}`);
    if (row !== undefined) return sel(row, row.session_id);
  }
  return sel(rowsOf(model, sid)[0], sid);
}

// The row of the main session an event leads to: a request — its own row; a
// Stop — the row it closed; a handoff of the main session — the row open at
// that line; else (and when there is no such row) the first row of the
// session.
export function mainRowOfEvent(model, index) {
  const e = model.entries[index];
  if (e === null || e === undefined || typeof e.session_id !== "string") {
    return null;
  }
  const rows = rowsOf(model, e.session_id);
  let row;
  if (e.hook_event_name === "UserPromptSubmit") {
    row = rows.find((r) => r.start_index === index);
  } else if (e.hook_event_name === "Stop") {
    row = rows.find((r) => r.end_index === index);
  } else if (e.hook_event_name === "PostToolUse") {
    const before = rows.filter((r) => r.start_index < index);
    row = before[before.length - 1];
  }
  return sel(row ?? rows[0], e.session_id);
}

// The earliest usable record of a server start after line `index`.
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

// The basis of the line "Задача" (design 4.7).
function basisOf(model, row) {
  const start = model.entries[row.start_index];
  let closed = null;
  if (row.state === "unrecorded") {
    for (let i = row.start_index + 1; i < model.entries.length; i++) {
      const e = model.entries[i];
      if (model.trusted[i] !== true || e.session_id !== row.session_id)
        continue;
      if (
        e.hook_event_name === "UserPromptSubmit" ||
        e.hook_event_name === "SessionEnd"
      ) {
        closed = { case: eventCase(e, false), at: e.time };
        break;
      }
    }
  }
  return {
    session_last_event_at: row.session_last_event_at,
    age_ms: row.age_ms,
    start: { case: eventCase(start, false), at: row.started_at },
    stop_at: row.state === "completed" ? row.ended_at : null,
    closed,
    server_start_at:
      row.state === "restarted"
        ? serverStartAfter(model, row.start_index)
        : null,
  };
}

function sessionLabel(id, firstAt) {
  return FILTER_SESSION_OPTION.split("{id}")
    .join(shortId(id))
    .split("{time}")
    .join(fmtDateTime(firstAt) || TIME_UNKNOWN);
}

// The data of the card of the main session for a choice {row, session}, or
// null if the model has no such session.
export function buildMainCard(model, office, history, choice) {
  if (!mainChoiceOpens(model, choice)) return null;
  const session = model.sessions.find((s) => s.session_id === choice.session);
  const sid = session.session_id;
  const rows = rowsOf(model, sid);
  let row = rows.find((r) => r.key === choice.row);
  if (row === undefined && choice.row !== null) row = rows[0];
  const character = office.characters.find((c) => c.key === MAIN_KEY);
  const shown = shownInPanel(model);

  let launched = [];
  let otherRows = { total: 0, shown: [] };
  if (row !== undefined) {
    const window = history.windowOfMainRow.get(row.key);
    if (window !== undefined) {
      launched = model.tasks
        .filter((t) => {
          if (t.launched_by === null || t.launched_by.kind !== "main") {
            return false;
          }
          const first = model.entries[t.first_start_index];
          return (
            first !== null &&
            typeof first === "object" &&
            first.session_id === sid &&
            history.windowOfTask.get(t.key) === window
          );
        })
        .map((t) => ({
          key: t.key,
          short: shortId(t.key),
          name: roleName(t.role),
          state: t.state,
        }));
    }
    const others = rows
      .filter((r) => r.key !== row.key)
      .sort((a, b) => b.start_index - a.start_index);
    otherRows = {
      total: others.length,
      shown: others.slice(0, OTHER_ROWS_SHOWN).map((r) => ({
        key: r.key,
        case: eventCase(model.entries[r.start_index], false),
        at: r.started_at,
        state: r.state,
      })),
    };
  }

  const firstAt = (s) => {
    const e = model.entries[s.first_index];
    return e === null || e === undefined ? null : e.time;
  };
  const sessions = model.sessions
    .filter((s) => s.session_id !== sid)
    .sort((a, b) => Number(b.running) - Number(a.running))
    .map((s) => ({
      id: s.session_id,
      label: sessionLabel(s.session_id, firstAt(s)),
      running: s.running,
    }));

  return {
    key: row === undefined ? `session:${sid}` : row.key,
    session: { short: shortId(sid), full: sid },
    row:
      row === undefined
        ? null
        : { key: row.key, state: row.state, basis: basisOf(model, row) },
    history_note:
      row !== undefined && history.windowOfMainRow.has(row.key)
        ? "has_window"
        : "no_window",
    workplace: {
      working: character !== undefined && character.working === true,
      count: character === undefined ? 0 : character.working_count,
    },
    links: { panel: row !== undefined && shown.has(row.key) },
    launched,
    other_rows: otherRows,
    sessions,
    role_card: buildCard(model, office, MAIN_KEY),
  };
}
