// The answers of the user and the open questions of the engine of Sai Team (design
// REQ-013, sections 9 and 15.4; criteria 3 and 6). A pure module without Node API:
// the check of an answer runs on the current state, in the same synchronous call
// as its write (commands.js).
import { TeamError, engineError } from "../errors.js";
import { isClosedTask } from "../reducer.js";

const EXCERPT_MAX = 200;

function excerpt(text) {
  const points = [...String(text)];
  return points.length <= EXCERPT_MAX
    ? points.join("")
    : `${points.slice(0, EXCERPT_MAX).join("")}…`;
}

// The texts of the questions (section 15.4): constant words around data (the text
// of a task, the constant detail of a failure).
export const QUESTION = Object.freeze({
  approval: (task) =>
    `От вас требуется решение: черновик задачи «${excerpt(task.text)}» готов. Одобрить, изменить или отклонить?`,
  review_failed: (task) =>
    `Результат задачи «${excerpt(task.text)}» не прошёл проверку и у другого специалиста. Изменить задачу или отклонить её?`,
  task_failed: (task, detail) =>
    `Задача «${excerpt(task.text)}» не получилась: ${detail}. Изменить её или отклонить?`,
  budget: () =>
    "Достигнут потолок расходов. Поднимите потолок, чтобы продолжить, или остановите проект",
  plan_failed: (_task, detail = null) =>
    detail === null
      ? "Не удалось составить план. Уточните цель сообщением и продолжите проект или остановите его"
      : `Не удалось составить план: ${detail}. Уточните цель сообщением и продолжите проект или остановите его`,
  goal_check_failed: (_task, detail = null) =>
    detail === null
      ? "Цель пока не достигнута после дополнительных задач. Добавьте указания и продолжите проект или остановите его"
      : `Не удалось сверить результаты с целью: ${detail}. Добавьте указания и продолжите проект или остановите его`,
});

export const DECISIONS = Object.freeze(["approve", "change", "reject"]);
const PROJECT_QUESTIONS = ["budget", "plan_failed", "goal_check_failed"];

function findTask(state, id) {
  return state.tasks.find((t) => t.id === id) ?? null;
}

export function closedTasks(state) {
  return state.tasks.filter((t) => isClosedTask(t)).map((t) => t.id);
}

// A decision of the user that still has to be carried out (section 9.3): not yet
// applied (the task has not changed its status after it) and with something to
// do. A reject of a failed task needs nothing: the task is closed by it.
function actionable(task, facts) {
  const d = task.last_decision;
  if (d === null || facts.applied.has(d.seq)) return false;
  switch (d.decision) {
    case "approve":
      return task.status === "waiting_user" && task.reason === "approval";
    case "reject":
      return task.status === "waiting_user";
    case "change":
      return ["failed", "waiting_user", "review"].includes(task.status);
    default:
      return false;
  }
}

// [{ task, decision, text, seq }] in the order of the ids of the tasks.
export function pendingDecisions(state, facts) {
  return state.tasks
    .filter((t) => actionable(t, facts))
    .map((t) => ({
      task: t.id,
      decision: t.last_decision.decision,
      text: t.last_decision.text,
      seq: t.last_decision.seq,
    }));
}

// The open questions (section 9.4): Question = { kind, task } (task null for the
// questions of the project). A question is closed by an answer (a decision still
// to be carried out) or by a new status.
export function openQuestions(state, facts) {
  const out = [];
  for (const t of state.tasks) {
    if (actionable(t, facts)) continue;
    if (t.status === "waiting_user") {
      out.push({ kind: t.reason, task: t.id });
    } else if (
      t.status === "failed" &&
      !isClosedTask(t) &&
      !facts.budgetFailed.has(t.id)
    ) {
      out.push({ kind: "task_failed", task: t.id });
    }
  }
  if (
    state.status === "waiting_user" &&
    state.waiting !== null &&
    PROJECT_QUESTIONS.includes(state.waiting.reason)
  ) {
    out.push({ kind: state.waiting.reason, task: null });
  }
  return out;
}

// The question about a task was already asked: a CHAT question after the event
// that made the task wait (TASK_WAITING_USER or TASK_FAILED).
export function questionAsked(state, facts, taskId) {
  const t = findTask(state, taskId);
  if (t === null) return true;
  const since =
    t.status === "waiting_user"
      ? (t.waiting_since_seq ?? 0)
      : (facts.failedSeq[taskId] ?? 0);
  return (facts.askedSeq[taskId] ?? 0) > since;
}

// The text of the CHAT that opens a question.
export function questionText(state, facts, question) {
  const t = question.task === null ? null : findTask(state, question.task);
  if (question.kind === "task_failed") {
    return QUESTION.task_failed(t, facts.failDetail[t.id] ?? "");
  }
  return QUESTION[question.kind](t, question.detail ?? null);
}

function usage(message) {
  return new TeamError("E_USAGE", message);
}

// Section 9.2: the answer of the user before any write. Returns { kind } of the
// question it answers; throws TeamError. Only this project is searched: a task of
// another project is "not found". (r5.2, F-8) A task that failed only on the
// ceiling has no open question (it starts again once the ceiling allows): an
// answer for it is E_NOT_WAITING.
export function checkDecision(state, taskId, decision, text, facts) {
  if (!DECISIONS.includes(decision)) {
    throw usage("Решение: approve, change или reject");
  }
  if (decision === "change" && (text === null || text === undefined)) {
    throw usage("Для change нужен --text");
  }
  if (decision !== "change" && text !== null && text !== undefined) {
    throw usage("--text нужен только для change");
  }
  const t = findTask(state, taskId);
  if (t === null) {
    throw new TeamError("E_TASK_NOT_FOUND", "Задача не найдена в этом проекте");
  }
  if (t.status === "waiting_user" && t.reason === "approval") {
    return { kind: "approval" };
  }
  if (t.status === "waiting_user" && t.reason === "review_failed") {
    if (decision === "approve") throw engineError("E_ANSWER_KIND");
    return { kind: "review_failed" };
  }
  if (
    t.status === "failed" &&
    !isClosedTask(t) &&
    !facts.budgetFailed.has(t.id)
  ) {
    if (decision === "approve") throw engineError("E_ANSWER_KIND");
    return { kind: "task_failed" };
  }
  throw engineError("E_NOT_WAITING");
}
