// The reading rule, tasks, rows of the main session and sessions (design
// section 4, 3.5). Pure ES module: no DOM and no Node API. The page and the
// tests call the same functions.
//
// The input is one array of journal lines: element i is line i of the file,
// or null for a corrupted line. "Earlier" and "later" always mean the order
// in the file (the order of acceptance), never a comparison of `time`.
// Every key that comes from the journal (roles, identifiers) is stored in a
// Map, so values such as __proto__ or constructor are ordinary strings.

import {
  LAST_LINE_FUTURE_MS,
  PROMPT_KINDS,
  READ_CONFLICT_MS,
  SOURCE_REAL,
  STALE_AFTER_MS,
} from "./schema.js";
import { ROLE_UNKNOWN } from "./texts.js";

const CONFLICT_MS = READ_CONFLICT_MS;

// The five states of a task and of a row of the main session, in the order of
// showing, and the two that mean "the journal does not confirm that the work
// goes on" (REQ-042, decision 0051).
export const ITEM_STATES = Object.freeze([
  "in_progress",
  "stale",
  "restarted",
  "completed",
  "unrecorded",
]);
export const UNCONFIRMED_STATES = Object.freeze(["stale", "restarted"]);

// The age of a time written as text against the clock of the page: null if
// either is not readable, otherwise not below zero (a clock that went back
// gives 0).
export function ageOf(iso, nowMs) {
  if (typeof iso !== "string" || !Number.isFinite(nowMs)) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, nowMs - ms);
}

// Fresh data: the age is known and not above the threshold (the border is
// strict: exactly the threshold is still fresh).
function isFresh(age) {
  return age !== null && age <= STALE_AFTER_MS;
}

// A usable element: an object with the two keys every rule reads. Elements
// that are not usable take part in nothing and are marked with nothing.
function isLine(e) {
  return (
    e !== null &&
    typeof e === "object" &&
    typeof e.hook_event_name === "string" &&
    typeof e.session_id === "string"
  );
}

// ---------------------------------------------------------------- 4.1

// Count of values below x (lower) or not above x (upper) in a sorted array.
function bound(sorted, x, inclusive) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < x || (inclusive && sorted[mid] === x)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// For every position p of ts: how many earlier positions are later than
// ts[p] by more than the conflict threshold, plus how many later positions are
// earlier than ts[p] by more than it. Fenwick tree over the ranks of the
// times: O(n log n).
function conflictDegrees(ts) {
  const count = ts.length;
  const sorted = Float64Array.from(ts).sort();
  const size = sorted.length;
  const tree = new Int32Array(size + 1);
  const add = (value) => {
    for (let i = bound(sorted, value, false) + 1; i <= size; i += i & -i) {
      tree[i] += 1;
    }
  };
  const upTo = (cnt) => {
    let sum = 0;
    for (let i = cnt; i > 0; i -= i & -i) sum += tree[i];
    return sum;
  };
  const degree = new Int32Array(count);
  for (let p = 0; p < count; p++) {
    degree[p] += p - upTo(bound(sorted, ts[p] + CONFLICT_MS, true));
    add(ts[p]);
  }
  tree.fill(0);
  for (let p = count - 1; p >= 0; p--) {
    degree[p] += upTo(bound(sorted, ts[p] - CONFLICT_MS, false));
    add(ts[p]);
  }
  return degree;
}

// Rule (b). real: indices of the unmarked lines with source REAL, in file
// order. A conflict is a pair (i, j), i earlier than j in the file, with
// t(j) < t(i) - threshold. While conflicts exist, the line that is in the most
// conflicts gets the mark; on a tie the later one in the file; a marked line
// leaves the conflicts that remain.
function markConflicts(real, times, marks) {
  const positions = real.filter((i) => Number.isFinite(times[i]));
  if (positions.length < 2) return;

  // Fast path: a conflict exists if and only if some line is earlier than the
  // latest time before it by more than the threshold. One pass.
  let latest = -Infinity;
  let conflict = false;
  for (const i of positions) {
    if (times[i] < latest - CONFLICT_MS) {
      conflict = true;
      break;
    }
    if (times[i] > latest) latest = times[i];
  }
  if (!conflict) return;

  const ts = positions.map((i) => times[i]);
  const degree = conflictDegrees(ts);
  let candidates = [];
  for (let p = 0; p < ts.length; p++) if (degree[p] > 0) candidates.push(p);

  while (candidates.length > 0) {
    let best = 0;
    for (let k = 1; k < candidates.length; k++) {
      const a = candidates[k];
      const b = candidates[best];
      if (degree[a] > degree[b] || (degree[a] === degree[b] && a > b)) best = k;
    }
    const chosen = candidates[best];
    marks[positions[chosen]] = "conflict";
    const rest = [];
    for (let k = 0; k < candidates.length; k++) {
      if (k === best) continue;
      const q = candidates[k];
      const earlier = q < chosen ? q : chosen;
      const later = q < chosen ? chosen : q;
      if (ts[later] < ts[earlier] - CONFLICT_MS) degree[q] -= 1;
      if (degree[q] > 0) rest.push(q);
    }
    candidates = rest;
  }
}

// The reading rule: for every element of the journal null (trusted) or the
// reason of the mark "not from hooks": "source", "conflict" or "future".
// Only the mark "future" depends on nowMs; the others depend on the content.
export function readRule(entries, nowMs) {
  const count = entries.length;
  const marks = new Array(count).fill(null);
  const times = new Float64Array(count);
  const real = [];
  let last = -1;
  for (let i = 0; i < count; i++) {
    const e = entries[i];
    if (!isLine(e)) {
      times[i] = NaN;
      continue;
    }
    times[i] = Date.parse(e.time);
    last = i;
    if (e.source !== SOURCE_REAL) marks[i] = "source";
    else real.push(i);
  }
  markConflicts(real, times, marks);
  // Rule (c): the last line of the file, if it is still unmarked, is marked
  // when it is later than the clock of the reader by more than the tolerance.
  if (
    last >= 0 &&
    marks[last] === null &&
    times[last] > nowMs + LAST_LINE_FUTURE_MS
  ) {
    marks[last] = "future";
  }
  return marks;
}

// ---------------------------------------------------------------- 3.4

// Records of server starts that the rules may use: journal_lines is a whole
// number from 0 to the number of lines of the journal. A record with more is a
// trace of a deleted or truncated journal (design 3.4, E33) and is dropped.
// The records are returned whole, in the order of the file.
function usableStarts(serverStarts, lineCount) {
  if (!Array.isArray(serverStarts)) return [];
  const out = [];
  for (const s of serverStarts) {
    if (s === null || typeof s !== "object") continue;
    const lines = s.journal_lines;
    if (!Number.isInteger(lines) || lines < 0 || lines > lineCount) continue;
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------- 3.5 journal

// The kind of a request (owner or service) of a UserPromptSubmit line, or
// null for other events and for lines written before the kind existed.
function promptKind(e) {
  return e.hook_event_name === "UserPromptSubmit" &&
    PROMPT_KINDS.includes(e.prompt_kind)
    ? e.prompt_kind
    : null;
}

function journalRow(e, index, mark) {
  const kind = e.hook_event_name;
  let role = typeof e.agent_type === "string" ? e.agent_type : "";
  let description = "";
  if (kind === "PostToolUse") {
    role = typeof e.subagent_type === "string" ? e.subagent_type : "";
    description = typeof e.description === "string" ? e.description : "";
  }
  return {
    index,
    time: e.time,
    event: kind,
    role,
    description,
    session_id: e.session_id,
    source: typeof e.source === "string" ? e.source : "",
    marked: mark !== null,
    reason: mark,
    prompt_kind: promptKind(e),
  };
}

// ---------------------------------------------------------------- 4.2

// The role of a task: agent_type of the first start, or the caption for a
// task without a role.
function roleOf(agentType) {
  return typeof agentType === "string" && agentType !== ""
    ? agentType
    : ROLE_UNKNOWN;
}

// The linking PostToolUse lines of a task (rule z): all trusted lines with
// launched_agent_id equal to the key of the task, duplicates (the same
// tool_use_id) collapsed. Exactly one left gives the description, the type
// and the launcher; none or several give nothing. Nothing is matched by order,
// time or "the nearest call": a guessed description never exists.
function linkOf(indices, entries) {
  if (!indices) return null;
  const seen = new Set();
  const unique = [];
  for (const index of indices) {
    const id = entries[index].tool_use_id;
    if (typeof id === "string") {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    unique.push(index);
  }
  if (unique.length !== 1) return null;
  const e = entries[unique[0]];
  const launchedBy =
    typeof e.agent_id === "string" && e.agent_id !== ""
      ? {
          kind: "subagent",
          agent_id: e.agent_id,
          agent_type: typeof e.agent_type === "string" ? e.agent_type : "",
        }
      : { kind: "main" };
  return {
    description: typeof e.description === "string" ? e.description : null,
    subagent_type: typeof e.subagent_type === "string" ? e.subagent_type : null,
    launched_by: launchedBy,
  };
}

// ---------------------------------------------------------------- the model

// Builds the whole model of the page from one array of journal lines.
// serverStarts: the records {time, journal_lines} as the server sent them.
export function buildModel(entries, serverStarts, nowMs) {
  const count = entries.length;
  const marks = readRule(entries, nowMs);
  const trusted = new Array(count);
  for (let i = 0; i < count; i++) {
    trusted[i] = isLine(entries[i]) && marks[i] === null;
  }

  const startRecords = usableStarts(serverStarts, count);
  // A server start is "after line i" if journal_lines > i (design D5).
  let latestStart = -1;
  for (const s of startRecords) {
    if (s.journal_lines > latestStart) latestStart = s.journal_lines;
  }
  const lastRecord =
    startRecords.length > 0 ? startRecords[startRecords.length - 1] : null;
  const lastStart = lastRecord === null ? 0 : lastRecord.journal_lines;

  const sessionMap = new Map();
  const taskMap = new Map();
  const taskDrafts = [];
  const posts = new Map();
  const lastEnd = new Map();
  const openRow = new Map();
  const mainRows = [];
  const journal = [];

  for (let i = 0; i < count; i++) {
    const e = entries[i];
    if (!isLine(e)) continue;
    journal.push(journalRow(e, i, marks[i]));
    if (!trusted[i]) continue;

    const sid = e.session_id;
    const kind = e.hook_event_name;
    let session = sessionMap.get(sid);
    if (session === undefined) {
      session = {
        session_id: sid,
        first_index: i,
        first_event_at: e.time,
        last_index: i,
        last_event_at: e.time,
        last_kind: kind,
      };
      sessionMap.set(sid, session);
    } else {
      session.last_index = i;
      session.last_event_at = e.time;
      session.last_kind = kind;
    }

    if (kind === "UserPromptSubmit" || kind === "SessionEnd") {
      // The next request or the end of the session closes the open row of the
      // same session, and only a row that began before it.
      const open = openRow.get(sid);
      if (open !== undefined) {
        open.state = "unrecorded";
        open.closed_by = kind === "SessionEnd" ? "session_end" : "next_prompt";
        openRow.delete(sid);
      }
      if (kind === "SessionEnd") lastEnd.set(sid, i);
      if (kind === "UserPromptSubmit") {
        const row = {
          kind: "main",
          key: `main:${i}`,
          session_id: sid,
          state: "in_progress",
          started_at: e.time,
          ended_at: null,
          start_index: i,
          end_index: null,
          closed_by: null,
          prompt_kind: promptKind(e),
        };
        mainRows.push(row);
        openRow.set(sid, row);
      }
    } else if (kind === "Stop") {
      // The end of the answer closes only a row that is open; without one it
      // changes nothing and no start is invented.
      const open = openRow.get(sid);
      if (open !== undefined) {
        open.state = "completed";
        open.ended_at = e.time;
        open.end_index = i;
        open.closed_by = "stop";
        openRow.delete(sid);
      }
    } else if (kind === "SubagentStart") {
      const key = e.agent_id;
      let task = taskMap.get(key);
      if (task === undefined) {
        task = {
          key,
          role: roleOf(e.agent_type),
          session_id: sid,
          started_at: e.time,
          resumed_at: null,
          first_start_index: i,
          last_start_index: i,
          stop_indices: [],
          last_stop_time: null,
          last_is_stop: false,
        };
        taskMap.set(key, task);
        taskDrafts.push(task);
      } else {
        task.session_id = sid;
        task.resumed_at = e.time;
        task.last_start_index = i;
        task.last_is_stop = false;
      }
    } else if (kind === "SubagentStop") {
      // A stop without a recorded start creates no task: it stays only in
      // the journal.
      const task = taskMap.get(e.agent_id);
      if (task !== undefined) {
        task.stop_indices.push(i);
        task.last_stop_time = e.time;
        task.last_is_stop = true;
      }
    } else if (kind === "PostToolUse") {
      const launched = e.launched_agent_id;
      if (typeof launched === "string") {
        const list = posts.get(launched);
        if (list === undefined) posts.set(launched, [i]);
        else list.push(i);
      }
    }
  }

  // The age of the last trusted event of each session, against the clock of
  // the page (REQ-042). Task and row take the age of their session.
  const sessionAge = new Map();
  for (const [sid, s] of sessionMap)
    sessionAge.set(sid, ageOf(s.last_event_at, nowMs));
  const lastEventOf = (sid) => {
    const session = sessionMap.get(sid);
    return session === undefined ? null : session.last_event_at;
  };

  // Rows that no event closed (rows closed by an event are done above; a late
  // Stop would already have closed the others): a server start after the
  // request names the restart; otherwise the age decides.
  for (const row of mainRows) {
    row.session_last_event_at = lastEventOf(row.session_id);
    row.age_ms = sessionAge.has(row.session_id)
      ? sessionAge.get(row.session_id)
      : null;
    if (row.state !== "in_progress") continue;
    if (latestStart > row.start_index) {
      row.state = "restarted";
      row.closed_by = "server_start";
    } else if (!isFresh(row.age_ms)) {
      row.state = "stale";
    }
  }

  const sessions = [];
  for (const s of sessionMap.values()) {
    const age = sessionAge.get(s.session_id);
    const open = s.last_kind !== "SessionEnd";
    let word = null;
    if (open && isFresh(age)) {
      if (s.last_index >= lastStart) word = "running";
    } else if (open) {
      word = "stale";
    }
    sessions.push({
      session_id: s.session_id,
      first_index: s.first_index,
      first_event_at: s.first_event_at,
      last_index: s.last_index,
      last_event_at: s.last_event_at,
      age_ms: age,
      word,
      running: word === "running",
    });
  }

  const tasks = taskDrafts.map((t) => {
    const lastEventAt = lastEventOf(t.session_id);
    const age = sessionAge.has(t.session_id)
      ? sessionAge.get(t.session_id)
      : null;
    const endOfSession = lastEnd.get(t.session_id);
    let state;
    let closedBy = null;
    if (t.last_is_stop) {
      state = "completed";
      closedBy = "stop";
    } else if (
      endOfSession !== undefined &&
      endOfSession > t.last_start_index
    ) {
      state = "unrecorded";
      closedBy = "session_end";
    } else if (latestStart > t.last_start_index) {
      state = "restarted";
      closedBy = "server_start";
    } else if (!isFresh(age)) {
      state = "stale";
    } else {
      state = "in_progress";
    }
    const link = linkOf(posts.get(t.key), entries);
    return {
      key: t.key,
      role: t.role,
      session_id: t.session_id,
      state,
      closed_by: closedBy,
      age_ms: age,
      description: link === null ? null : link.description,
      subagent_type: link === null ? null : link.subagent_type,
      launched_by: link === null ? null : link.launched_by,
      started_at: t.started_at,
      resumed_at: t.resumed_at,
      ended_at: state === "completed" ? t.last_stop_time : null,
      first_start_index: t.first_start_index,
      last_start_index: t.last_start_index,
      end_index:
        state === "completed"
          ? t.stop_indices[t.stop_indices.length - 1]
          : null,
      stop_indices: t.stop_indices,
      session_last_event_at: lastEventAt,
    };
  });

  // Order of showing (rule d): the ones in progress first, then the rest; in a
  // group the new ones on top, by the line of the latest start.
  const list = [];
  for (const t of tasks) list.push({ kind: "task", ...t });
  for (const r of mainRows) list.push({ ...r });
  const position = (item) =>
    item.kind === "task" ? item.last_start_index : item.start_index;
  list.sort((a, b) => {
    const rankA = a.state === "in_progress" ? 0 : 1;
    const rankB = b.state === "in_progress" ? 0 : 1;
    return rankA - rankB || position(b) - position(a);
  });

  // How many items of the whole list the journal does not confirm (no limit
  // of the panel applies here).
  const unconfirmed = {
    stale: 0,
    restarted: 0,
    count: 0,
    oldest_stale_age_ms: null,
  };
  for (const item of list) {
    if (item.state === "stale") {
      unconfirmed.stale += 1;
      if (
        item.age_ms !== null &&
        (unconfirmed.oldest_stale_age_ms === null ||
          item.age_ms > unconfirmed.oldest_stale_age_ms)
      ) {
        unconfirmed.oldest_stale_age_ms = item.age_ms;
      }
    } else if (item.state === "restarted") {
      unconfirmed.restarted += 1;
    }
  }
  unconfirmed.count = unconfirmed.stale + unconfirmed.restarted;

  return {
    entries,
    marks,
    trusted,
    sessions,
    tasks,
    mainRows,
    list,
    journal,
    serverStarts: Array.isArray(serverStarts) ? serverStarts : [],
    now_ms: nowMs,
    last_start:
      lastRecord === null
        ? null
        : { time: lastRecord.time, journal_lines: lastRecord.journal_lines },
    unconfirmed,
  };
}
