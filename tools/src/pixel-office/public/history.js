// The window "Просмотр истории" as a pure function of the model (REQ-008,
// design section 7.2-7.3): the requests of the owner, the window of each one,
// its tasks, its status, the records of the orchestrator tied to it and its
// timeline. Pure ES module: no DOM and no Node API, no clock. The page and the
// tests call the same function.
//
// Only the lines of the journal take part: nothing is guessed. A record of the
// orchestrator (a line without hook_event_name) never changes the tasks, the
// rows of the main session, the marks or the office: the model is built
// without such lines, and this module only reads it.

import { fmtDateTime } from "./format.js";
import { firstLine, isNoteLine } from "./schema.js";
import {
  HISTORY_NOTE_AUTO,
  HISTORY_NOTE_BY,
  HISTORY_TITLE_NO_TEXT,
  HISTORY_WHO_ORCH,
  MAIN_LABEL,
} from "./texts.js";
import { eventCase, eventWords, repeatedStarts, roleName } from "./words.js";

// The first line of a text in the title is at most this long (code points).
export const TITLE_MAX = 120;

const MAIN_EVENTS = new Set([
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "Stop",
]);

function nonEmpty(value) {
  return typeof value === "string" && value !== "";
}

// The title of a request (rule 6): the number of the requirement and the first
// line of the last record, else the first line of the message, else the
// caption with the time of the request.
function titleOf(note, text, time) {
  if (note !== null && note.req_id !== null) {
    return `${note.req_id} — ${firstLine(note.text, TITLE_MAX)}`;
  }
  const line = text === null ? "" : firstLine(text, TITLE_MAX);
  if (line !== "") return line;
  return HISTORY_TITLE_NO_TEXT.replace("{time}", fmtDateTime(time));
}

// "Later" for records of the orchestrator: the larger time, on a tie the
// larger index (rule 5).
function laterNote(a, b) {
  const ta = Date.parse(a.time);
  const tb = Date.parse(b.time);
  if (ta !== tb) return ta > tb;
  return a.index > b.index;
}

// Who and what of one trusted hook line of the timeline (rule 7). The words
// are those of the journal (REQ-045): the same table, the same rule of a
// repeated start.
function eventView(e, index, taskByKey, repeated) {
  const kind = e.hook_event_name;
  let who;
  const what = eventWords(eventCase(e, repeated), e);
  let detail = null;
  if (kind === "PostToolUse") {
    who = nonEmpty(e.agent_id) ? roleName(e.agent_type) : MAIN_LABEL;
    if (nonEmpty(e.description)) detail = e.description;
  } else if (MAIN_EVENTS.has(kind)) {
    who = MAIN_LABEL;
  } else {
    who = roleName(e.agent_type);
    if (kind === "SubagentStart") {
      const task = taskByKey.get(e.agent_id);
      if (task !== undefined && nonEmpty(task.description)) {
        detail = task.description;
      }
    }
  }
  return { time: e.time, index, who, what, detail, kind: "event" };
}

function noteView(note) {
  const view = {
    time: note.time,
    index: note.index,
    who: HISTORY_WHO_ORCH,
    what: note.auto
      ? `${HISTORY_NOTE_BY} · ${HISTORY_NOTE_AUTO}`
      : HISTORY_NOTE_BY,
    detail: note.text,
    kind: "note",
  };
  if (note.auto) view.auto = true;
  return view;
}

// The timeline order: the time, on a tie a hook line before a record of the
// orchestrator, then the index.
function byTime(a, b) {
  const ta = Date.parse(a.time);
  const tb = Date.parse(b.time);
  if (ta !== tb) return ta - tb;
  if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
  return a.index - b.index;
}

// Builds every request of the owner from the model of the page.
export function buildHistory(model) {
  const { entries, marks } = model;
  const count = entries.length;
  const repeated = repeatedStarts(entries);

  // Rule 1: the messages of the owner, by session, in the order of the file.
  const owners = [];
  const bySession = new Map();
  for (let i = 0; i < count; i++) {
    const e = entries[i];
    if (
      model.trusted[i] !== true ||
      marks[i] !== null ||
      e.hook_event_name !== "UserPromptSubmit" ||
      e.prompt_kind !== "owner"
    ) {
      continue;
    }
    const owner = {
      index: i,
      session_id: e.session_id,
      time: e.time,
      end: count,
    };
    owners.push(owner);
    const list = bySession.get(e.session_id);
    if (list === undefined) bySession.set(e.session_id, [owner]);
    else {
      // Rule 2: the next message of the same session closes the window.
      list[list.length - 1].end = i;
      list.push(owner);
    }
  }

  // The window that holds index i of session sid (the message itself
  // included), or null: lines before the first message are in no window.
  function windowAt(sid, i) {
    const list = bySession.get(sid);
    if (list === undefined) return null;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (list[mid].index <= i) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? null : list[lo - 1];
  }

  // Rule 5: the records of the orchestrator and the request of each.
  const byTimeOfOwner = new Map();
  for (const owner of owners) {
    const list = byTimeOfOwner.get(owner.time);
    if (list === undefined) byTimeOfOwner.set(owner.time, [owner]);
    else list.push(owner);
  }
  const notesOf = new Map();
  for (let i = 0; i < count; i++) {
    const e = entries[i];
    if (!isNoteLine(e) || !nonEmpty(e.request_time)) continue;
    const candidates = byTimeOfOwner.get(e.request_time);
    if (candidates === undefined) continue;
    let owner = null;
    if (candidates.length === 1) {
      owner = candidates[0];
    } else {
      const same = candidates.filter((c) => c.session_id === e.session_id);
      if (same.length === 1) owner = same[0];
    }
    if (owner === null) continue;
    const note = {
      time: e.time,
      text: e.note_text,
      req_id: nonEmpty(e.req_id) ? e.req_id : null,
      auto: e.request_time_auto === true,
      index: i,
    };
    const list = notesOf.get(owner.index);
    if (list === undefined) notesOf.set(owner.index, [note]);
    else list.push(note);
  }

  // Rule 3: the tasks of a window, by the line of the first start.
  const tasksOf = new Map();
  const windowOfTask = new Map();
  const ordered = [...model.tasks].sort(
    (a, b) => a.first_start_index - b.first_start_index,
  );
  const taskByKey = new Map();
  for (const task of ordered) {
    taskByKey.set(task.key, task);
    const first = entries[task.first_start_index];
    if (first === null || typeof first !== "object") continue;
    const owner = windowAt(first.session_id, task.first_start_index);
    if (owner === null || task.first_start_index === owner.index) continue;
    if (task.first_start_index >= owner.end) continue;
    windowOfTask.set(task.key, `req:${owner.index}`);
    const list = tasksOf.get(owner.index);
    if (list === undefined) tasksOf.set(owner.index, [task]);
    else list.push(task);
  }

  // Rule 4 and rule 8: the rows of the main session that began in a window.
  const lastRowOf = new Map();
  const windowOfMainRow = new Map();
  for (const row of model.mainRows) {
    const owner = windowAt(row.session_id, row.start_index);
    if (owner === null || row.start_index >= owner.end) continue;
    windowOfMainRow.set(row.key, `req:${owner.index}`);
    const last = lastRowOf.get(owner.index);
    if (last === undefined || row.start_index > last.start_index) {
      lastRowOf.set(owner.index, row);
    }
  }

  const requests = [];
  const byKey = new Map();
  for (const owner of owners) {
    const i = owner.index;
    const j = owner.end;
    const sid = owner.session_id;
    const e = entries[i];
    const text = nonEmpty(e.prompt_text) ? e.prompt_text : null;

    const notes = notesOf.get(i) ?? [];
    let note = null;
    for (const n of notes) if (note === null || laterNote(n, note)) note = n;

    let finishedAt = null;
    const timeline = [
      {
        time: e.time,
        index: i,
        who: MAIN_LABEL,
        what: eventWords("prompt_owner", e),
        detail: null,
        kind: "event",
      },
    ];
    for (let k = i + 1; k < j; k++) {
      const line = entries[k];
      if (model.trusted[k] !== true || line.session_id !== sid) continue;
      timeline.push(eventView(line, k, taskByKey, repeated.has(k)));
      if (line.hook_event_name === "Stop" && !nonEmpty(line.agent_id)) {
        finishedAt = line.time;
      }
    }
    for (const n of notes) timeline.push(noteView(n));
    timeline.sort(byTime);

    const tasks = (tasksOf.get(i) ?? []).map((task, k) => ({
      ordinal: k + 1,
      key: task.key,
      role: task.role,
      // The name of the role in plain words, as everywhere (REQ-048); the raw
      // role stays in the data.
      name: roleName(task.role),
      description: nonEmpty(task.description) ? task.description : null,
      state: task.state,
      started_at: task.started_at,
      ended_at: task.ended_at,
      session_last_event_at: task.session_last_event_at,
    }));

    const lastRow = lastRowOf.get(i);
    const request = {
      key: `req:${i}`,
      index: i,
      session_id: sid,
      time: e.time,
      text,
      truncated: e.prompt_truncated === true,
      title: titleOf(note, text, e.time),
      state: lastRow === undefined ? "in_progress" : lastRow.state,
      started_at: e.time,
      finished_at: finishedAt,
      note,
      notes,
      tasks,
      timeline,
    };
    requests.push(request);
    byKey.set(request.key, request);
  }

  return { requests, byKey, windowOfTask, windowOfMainRow };
}
