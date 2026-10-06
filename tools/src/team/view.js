// The forms of the output of the commands (design REQ-009, section 10.2). A pure
// module without Node API. No role code, no `internal` field of the catalog, no
// scenario_file and no path of work/ goes into ProjectSummary or ProjectView.
import { phrase, phrasesForJournal } from "./language.js";
import { progress } from "./reducer.js";
import { publicRole, roleByCode } from "./roles.js";
import { PROJECT_STATUS_TEXT, TASK_STATUS_TEXT } from "./schema.js";

export const TAIL_TEXT = "Последняя строка журнала не дописана";

const PAUSE_TEXT = Object.freeze({
  user: "по вашей команде",
  recovery: "прервано аварией — возобновите проект",
});

function pauseOf(state) {
  if (state.status !== "paused" || state.paused_by === null) return null;
  return { by: state.paused_by, text: PAUSE_TEXT[state.paused_by] };
}

function roleTitle(code) {
  const role = roleByCode(code);
  return role === null ? "" : publicRole(role).title;
}

export function projectSummary(state, tail) {
  const out = {
    id: state.id,
    goal: state.goal,
    status: state.status,
    status_text: PROJECT_STATUS_TEXT[state.status],
    executor: state.executor,
    created_at: state.created_at,
    updated_at: state.updated_at,
  };
  const pause = pauseOf(state);
  if (pause !== null) out.pause = pause;
  const p = progress(state);
  if (p !== null) out.progress = p;
  if (tail) out.tail = { line: tail.line, bytes: tail.bytes };
  return out;
}

// The phrase of each task: the phrase of the last event about it; a task created
// by a plan and untouched since gets the phrase of its creation, against the
// current state.
function taskPhrases(state, events) {
  const phrases = phrasesForJournal(events);
  const byTask = new Map();
  events.forEach((event, i) => {
    if (typeof event.task === "string") byTask.set(event.task, phrases[i]);
  });
  for (const t of state.tasks) {
    if (byTask.has(t.id)) continue;
    byTask.set(
      t.id,
      phrase(
        {
          type: "TASK_CREATED",
          task: t.id,
          source: "ENGINE",
          data: { role: t.role, depends_on: t.depends_on },
        },
        state,
      ),
    );
  }
  return byTask;
}

export function projectView(state, tail, events) {
  const phrases = taskPhrases(state, events);
  const out = {
    id: state.id,
    goal: state.goal,
    status: state.status,
    status_text: PROJECT_STATUS_TEXT[state.status],
    executor: state.executor,
    budget_usd: state.budget_usd,
    spent_usd: state.spent_usd,
    created_at: state.created_at,
    updated_at: state.updated_at,
  };
  const pause = pauseOf(state);
  if (pause !== null) out.pause = pause;
  const p = progress(state);
  if (p !== null) out.progress = p;
  if (state.waiting !== null) {
    out.waiting = {
      reason_text: phrase(
        {
          type: "PROJECT_WAITING",
          task: state.waiting.task,
          source: "ENGINE",
          data: { reason: state.waiting.reason },
        },
        state,
      ),
      task: state.waiting.task,
    };
  }
  out.tasks = state.tasks.map((t) => ({
    id: t.id,
    role_title: roleTitle(t.role),
    text: t.text,
    done_when: t.done_when,
    depends_on: [...t.depends_on],
    critical: t.critical,
    status: t.status,
    status_text: TASK_STATUS_TEXT[t.status],
    attempts: t.attempts,
    files: [...t.files],
    phrase: phrases.get(t.id),
  }));
  out.memory = state.memory.map((m) => ({
    kind: m.kind,
    text: m.text,
    task: m.task,
  }));
  out.files = state.files.map((f) => ({
    name: f.name,
    task: f.task,
    bytes: f.bytes,
    kind: f.kind,
  }));
  out.chat = state.chat.map((c) => ({
    seq: c.seq,
    ts: c.ts,
    source: c.source,
    kind: c.kind,
    text: c.text,
    task: c.task,
  }));
  if (tail) out.tail = { line: tail.line, bytes: tail.bytes, text: TAIL_TEXT };
  return out;
}

export function eventView(event, stateBefore) {
  return {
    seq: event.seq,
    ts: event.ts,
    source: event.source,
    type: event.type,
    task: event.task,
    data: event.data,
    phrase: phrase(event, stateBefore),
  };
}
