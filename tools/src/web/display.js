// The answers of the API from the replayed state (design REQ-011, sections 5 and
// 7). Pure functions without Node API: every answer is built anew from what the
// core read for this request, nothing is cached (criterion 8).
//
// No role code, no internal field of the catalog, no executor by name, no path of
// a file, no cost and no ceiling leaves this module (section 5.3).
import { openQuestions, questionAsked } from "../team/engine/answers.js";
import { scanFacts } from "../team/engine/facts.js";
import { PARALLEL_DEFAULT } from "../team/engine/schedule.js";
import { phrasesForJournal } from "../team/language.js";
import { progress } from "../team/reducer.js";
import { ROLES, publicRole } from "../team/roles.js";
import {
  FINAL_PROJECT_STATUS,
  PROJECT_STATUS_TEXT,
  TASK_STATUS_TEXT,
} from "../team/schema.js";
import { projectView } from "../team/view.js";
import { LAST_PHRASES } from "./config.js";
import { TEXT, dueIn, progressOf, waitsCount } from "./texts.js";

// ---- links (section 5.2) ------------------------------------------------------------

function projectApi(id) {
  return `/api/projects/${id}`;
}

function projectLink(id) {
  return { to: "project", api: projectApi(id) };
}

function chatLink(id) {
  return { to: "chat", api: `${projectApi(id)}/chat` };
}

function taskLink(id, task) {
  return { to: "task", api: `${projectApi(id)}/tasks/${task}` };
}

function roleLink(id, n) {
  return { to: "role", api: `${projectApi(id)}/roles/${n}` };
}

// ---- roles by number (decisions/0025, W5) -------------------------------------------

export function roleNo(code) {
  return ROLES.findIndex((r) => r.code === code) + 1;
}

export function roleOfNo(n) {
  if (!Number.isInteger(n) || n < 1 || n > ROLES.length) return null;
  return ROLES[n - 1];
}

function roleRef(id, code) {
  const n = roleNo(code);
  return { n, title: publicRole(ROLES[n - 1]).title, link: roleLink(id, n) };
}

// ---- tasks --------------------------------------------------------------------------

// The event type whose phrase explains each status (section 5.5, reason_text).
const REASON_EVENT = Object.freeze({
  failed: "TASK_FAILED",
  waiting_user: "TASK_WAITING_USER",
  interrupted: "TASK_INTERRUPTED",
});

// For each task and each type of REASON_EVENT: the phrase of its last such event.
function reasonPhrases(events, phrases) {
  const types = new Set(Object.values(REASON_EVENT));
  const out = new Map();
  events.forEach((event, i) => {
    if (typeof event.task === "string" && types.has(event.type)) {
      out.set(`${event.type} ${event.task}`, phrases[i]);
    }
  });
  return out;
}

function byNumber(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sortedTasks(state) {
  return [...state.tasks].sort(byNumber);
}

function taskBrief(id, task, reasons) {
  const type = REASON_EVENT[task.status];
  const reason =
    type === undefined ? null : (reasons.get(`${type} ${task.id}`) ?? null);
  return {
    id: task.id,
    text: task.text,
    status: task.status,
    status_text: TASK_STATUS_TEXT[task.status],
    reason_text: reason,
    role: roleRef(id, task.role),
    link: taskLink(id, task.id),
  };
}

// The read of one project for the builders below: the state, the tail, the events
// and what several answers share.
function context(read) {
  const { state, events } = read;
  const phrases = phrasesForJournal(events);
  return {
    state,
    tail: read.tail,
    events,
    phrases,
    reasons: reasonPhrases(events, phrases),
    tasks: new Map(state.tasks.map((t) => [t.id, t])),
  };
}

// ---- the fields shared by the list and the page of a project ------------------------

function commonFields(id, goal, createdAt, status, executor, p) {
  const needs = status === "waiting_user";
  const test = executor === "scripted";
  return {
    id,
    goal,
    created_at: createdAt,
    status,
    status_text: PROJECT_STATUS_TEXT[status],
    progress: p,
    progress_text: p === null ? TEXT.noTasks : progressOf(p.done, p.total),
    needs_decision: needs,
    needs_decision_text: needs ? TEXT.needsDecision : null,
    test_executor: test,
    test_executor_text: test ? TEXT.testExecutor : null,
  };
}

// summary: an element of listProjects of the core — a ProjectSummary, or
// { id, error } for a project the core could not read.
export function listItem(summary) {
  if (summary.error !== undefined) {
    return {
      id: summary.id,
      broken: true,
      problem_text:
        summary.error.code === "E_CORRUPT" ? TEXT.corrupt : TEXT.readFailed,
      link: null,
    };
  }
  return {
    ...commonFields(
      summary.id,
      summary.goal,
      summary.created_at,
      summary.status,
      summary.executor,
      summary.progress ?? null,
    ),
    broken: false,
    link: projectLink(summary.id),
  };
}

// ---- the six questions (section 7) --------------------------------------------------

const UNFINISHED = Object.freeze([
  "waiting",
  "running",
  "review",
  "interrupted",
  "waiting_user",
]);

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Section 7.2 (and decisions/0025, W4).
export function dueText(state, events) {
  if (FINAL_PROJECT_STATUS.includes(state.status)) {
    return PROJECT_STATUS_TEXT[state.status];
  }
  const firstStart = new Map();
  const doneAt = new Map();
  for (const event of events) {
    if (typeof event.task !== "string") continue;
    if (event.type === "TASK_STARTED" && !firstStart.has(event.task)) {
      firstStart.set(event.task, Date.parse(event.ts));
    } else if (event.type === "TASK_DONE") {
      doneAt.set(event.task, Date.parse(event.ts));
    }
  }
  const durations = [];
  for (const t of state.tasks) {
    if (t.status !== "done") continue;
    if (!firstStart.has(t.id) || !doneAt.has(t.id)) continue;
    durations.push(doneAt.get(t.id) - firstStart.get(t.id));
  }
  if (durations.length < 2) return TEXT.dueUnknown;
  const m = median(durations);
  const u = state.tasks.filter((t) => UNFINISHED.includes(t.status)).length;
  const p = state.parallel ?? PARALLEL_DEFAULT;
  const k = Math.ceil(u / p);
  if (m * k <= 0) return TEXT.dueUnknown;
  return dueIn(Math.ceil((m * k) / 60_000));
}

// Section 7.3: the open waits for a decision that the engine opened by a question
// in the chat; one wait — one question.
export function openWaits(state, events) {
  const facts = scanFacts(events);
  const questions = [];
  for (const q of openQuestions(state, facts)) {
    if (q.task !== null) {
      if (!questionAsked(state, facts, q.task)) continue;
      questions.push({
        task: q.task,
        chat_n: facts.askedSeq[q.task],
        link: taskLink(state.id, q.task),
      });
      continue;
    }
    let lastWaiting = 0;
    for (const e of events) {
      if (e.type === "PROJECT_WAITING") lastWaiting = e.seq;
    }
    const asked = events.find(
      (e) =>
        e.type === "CHAT" &&
        e.source === "ENGINE" &&
        e.task === null &&
        e.data.kind === "question" &&
        e.seq > lastWaiting,
    );
    if (asked === undefined) continue;
    questions.push({ task: null, chat_n: asked.seq, link: chatLink(state.id) });
  }
  questions.sort((a, b) => a.chat_n - b.chat_n);
  return { count: questions.length, questions };
}

export function busyRoles(state) {
  const out = [];
  const seen = new Set();
  for (const t of sortedTasks(state)) {
    if (t.status !== "running" && t.status !== "review") continue;
    if (seen.has(t.role)) continue;
    seen.add(t.role);
    out.push(roleRef(state.id, t.role));
  }
  return out;
}

function happening(ctx) {
  const from = Math.max(0, ctx.events.length - LAST_PHRASES);
  const out = [];
  for (let i = from; i < ctx.events.length; i += 1) {
    out.push({ at: ctx.events[i].ts, text: ctx.phrases[i] });
  }
  return out;
}

// A file of a result with a task (state.files[].task !== null; design REQ-011
// r3, section 7.1 (6), decisions/0025, W8): its task and the role of that task.
// The reducer refuses a file whose task is not in the plan, so the task is
// always found.
function resultRef(ctx, file) {
  const id = ctx.state.id;
  const task = ctx.tasks.get(file.task);
  return {
    name: file.name,
    task: task.id,
    task_text: task.text,
    role: roleRef(id, task.role),
    link: taskLink(id, task.id),
  };
}

// read = readProject of the core: { state, tail, events }.
export function projectPage(read) {
  const ctx = context(read);
  const { state, events } = ctx;
  const id = state.id;
  const view = projectView(state, read.tail, events);
  const waits = openWaits(state, events);
  const tasks = sortedTasks(state);
  let tasksEmpty = null;
  if (tasks.length === 0) {
    tasksEmpty =
      state.status === "created" || state.status === "planning"
        ? TEXT.planPending
        : TEXT.noTasksAtAll;
  }
  return {
    ...commonFields(
      id,
      state.goal,
      state.created_at,
      state.status,
      state.executor,
      progress(state),
    ),
    pause_text: state.status === "paused" ? TEXT.paused : null,
    tail_text: read.tail ? TEXT.tail : null,
    happening: happening(ctx),
    busy: busyRoles(state),
    due_text: dueText(state, events),
    problems: {
      failed: tasks
        .filter((t) => t.status === "failed")
        .map((t) => taskBrief(id, t, ctx.reasons)),
      waiting_text:
        view.waiting === undefined ? null : view.waiting.reason_text,
    },
    waits: {
      count: waits.count,
      count_text: waits.count === 0 ? TEXT.waitsNone : waitsCount(waits.count),
      note_text: waits.count > 0 ? TEXT.decisionsLater : null,
      questions: waits.questions,
    },
    results: state.files
      .filter((f) => f.task !== null)
      .map((f) => resultRef(ctx, f)),
    tasks: tasks.map((t) => taskBrief(id, t, ctx.reasons)),
    tasks_empty_text: tasksEmpty,
    links: { chat: chatLink(id) },
  };
}

// ---- the chat -----------------------------------------------------------------------

// entry: an element of state.chat ({ seq, ts, source, kind, text, task,
// truncated }); tasks: the tasks of the project by id; open: the numbers of the
// open questions (section 7.3).
function chatMessage(id, entry, tasks, open) {
  const question = entry.kind === "question";
  const isOpen = open.has(entry.seq);
  const labels = [];
  if (question) labels.push(TEXT.labelQuestion);
  if (isOpen) labels.push(TEXT.labelOpen);
  const truncated = entry.truncated === true;
  if (truncated) labels.push(TEXT.labelTruncated);
  const user = entry.source === "USER";
  const task =
    typeof entry.task === "string" ? (tasks.get(entry.task) ?? null) : null;
  return {
    n: entry.seq,
    at: entry.ts,
    from: user ? "user" : "team",
    author_text: user ? TEXT.authorUser : TEXT.authorTeam,
    question,
    open: isOpen,
    truncated,
    labels_text: labels,
    text: entry.text,
    task:
      task === null
        ? null
        : {
            text: task.text,
            role_title: publicRole(ROLES[roleNo(task.role) - 1]).title,
            link: taskLink(id, task.id),
          },
  };
}

export function chatPage(read) {
  const ctx = context(read);
  const { state } = ctx;
  const open = new Set(
    openWaits(state, ctx.events).questions.map((q) => q.chat_n),
  );
  return {
    project: {
      id: state.id,
      goal: state.goal,
      status_text: PROJECT_STATUS_TEXT[state.status],
      test_executor_text:
        state.executor === "scripted" ? TEXT.testExecutor : null,
      link: projectLink(state.id),
    },
    messages: state.chat.map((c) => chatMessage(state.id, c, ctx.tasks, open)),
  };
}

// The message a sending wrote: the event of the core or of the engine, in the
// form of the view of an event ({ seq, ts, source, type, task, data }). It is a
// message of the user, never a question the engine opened, so it is not open;
// null when there is no such event in the answer.
export function sentMessage(id, event) {
  if (
    event === null ||
    typeof event !== "object" ||
    event.type !== "CHAT" ||
    event.data === null ||
    typeof event.data !== "object"
  ) {
    return null;
  }
  return chatMessage(
    id,
    {
      seq: event.seq,
      ts: event.ts,
      source: event.source,
      kind: event.data.kind,
      text: event.data.text,
      task: null,
      truncated: event.data.truncated === true,
    },
    new Map(),
    new Set(),
  );
}

// ---- the task and the role ----------------------------------------------------------

function projectRef(state) {
  return { id: state.id, goal: state.goal, link: projectLink(state.id) };
}

// null when the task is not a task of this project.
export function taskPage(read, taskId) {
  const ctx = context(read);
  const task = ctx.tasks.get(taskId) ?? null;
  if (task === null) return null;
  return {
    project: projectRef(ctx.state),
    task: {
      ...taskBrief(ctx.state.id, task, ctx.reasons),
      done_when: task.done_when,
      files: [...task.files],
    },
  };
}

// null when n is not a number of the catalog.
export function roleCard(read, n) {
  const role = roleOfNo(n);
  if (role === null) return null;
  const ctx = context(read);
  const pub = publicRole(role);
  return {
    project: projectRef(ctx.state),
    role: { n, title: pub.title, description: pub.description },
    tasks: sortedTasks(ctx.state)
      .filter((t) => t.role === role.code)
      .map((t) => taskBrief(ctx.state.id, t, ctx.reasons)),
  };
}
