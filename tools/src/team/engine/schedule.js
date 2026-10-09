// The schedule of the engine of Sai Team (design REQ-013, section 6; criterion 2):
// which actions to begin now, the reserve of the ceiling for parallel runs. Pure
// functions: no clock, no disk; the engine passes the state of the writer, its
// view (what is in work now and the facts of the journal) and the settings.
import { isClosedTask } from "../reducer.js";
import { floor6, maxBudgetFor } from "../runner.js";
import { openQuestions, pendingDecisions, questionAsked } from "./answers.js";

export const PARALLEL_DEFAULT = 2;
export const PARALLEL_ALLOWED = Object.freeze([1, 2, 3]);
export const CYCLE_RUNS_MAX = 3;
export const ROUNDS_MAX = 2;
export const SINGLE_RUNS_MAX = 3;
export const MIN_RUN_USD = 0.01;

// The note of a critical task (section 7.1).
export const CRITICAL_NOTE =
  "Это действие нельзя выполнять: подготовьте черновик файлом и отметьте его видом draft";
export const DRAFT_NEEDED_NOTE = "Нужен черновик файлом с видом draft";

const FINAL = ["stopped", "done", "failed"];
const SLOT_KINDS = ["work", "review", "reassign"];
const PROJECT_KINDS = ["plan", "goal"];

// Section 6.3: the ceiling of the next run when `reservedByOthers` is already
// promised to the runs in work. null when the project has no ceiling (scripted).
export function slotBudget(state, config, reservedByOthers) {
  if (!(state.budget_usd > 0)) return null;
  const max = maxBudgetFor(state, config);
  const rest = state.budget_usd - state.spent_usd - reservedByOthers;
  return Math.max(0, floor6(Math.min(max, rest)));
}

function enough(reserve) {
  return reserve === null || reserve >= MIN_RUN_USD;
}

function findTask(state, id) {
  return state.tasks.find((t) => t.id === id) ?? null;
}

function depsDone(state, t) {
  return t.depends_on.every((d) => findTask(state, d)?.status === "done");
}

// The waiting tasks whose dependencies are all done.
export function readyTasks(state) {
  return state.tasks
    .filter((t) => t.status === "waiting" && depsDone(state, t))
    .map((t) => t.id);
}

// The waiting tasks that depend on a closed one (C1).
export function dependentsToClose(state) {
  return state.tasks
    .filter(
      (t) =>
        t.status === "waiting" &&
        t.depends_on.some((d) => {
          const dep = findTask(state, d);
          return dep !== null && isClosedTask(dep);
        }),
    )
    .map((t) => t.id);
}

function hasDraftSince(state, facts, t) {
  const since = facts.startedSeq[t.id] ?? 0;
  return state.files.some(
    (f) => f.task === t.id && f.kind === "draft" && f.seq > since,
  );
}

function noteOf(t, text) {
  const parts = [];
  if (t.critical) parts.push(CRITICAL_NOTE);
  if (text !== null && text !== undefined) parts.push(text);
  return parts.length === 0 ? null : parts.join("\n\n");
}

// What the task needs now (section 6.1, step 5), or null:
// { kind: "work", note } | { kind: "review", finish } | { kind: "reassign", giveUp }.
function candidateFor(state, facts, t, change) {
  if (change !== null) return { kind: "work", note: noteOf(t, change.text) };
  const launches = facts.launches[t.id] ?? 0;
  const failedReview = (notes) =>
    launches < CYCLE_RUNS_MAX
      ? { kind: "work", note: noteOf(t, notes) }
      : { kind: "reassign", giveUp: facts.reassigned.has(t.id) };
  switch (t.status) {
    case "waiting":
    case "interrupted":
      return depsDone(state, t)
        ? { kind: "work", note: noteOf(t, null) }
        : null;
    case "failed":
      return facts.budgetFailed.has(t.id) && depsDone(state, t)
        ? { kind: "work", note: noteOf(t, null) }
        : null;
    case "review": {
      const last = t.last_review;
      if (last !== null && last.seq > (t.review_since_seq ?? 0)) {
        return last.passed
          ? { kind: "review", finish: true }
          : failedReview(last.notes);
      }
      if (t.critical && !hasDraftSince(state, facts, t)) {
        return failedReview(DRAFT_NEEDED_NOTE);
      }
      return { kind: "review", finish: false };
    }
    default:
      return null;
  }
}

function needsRun(cand) {
  if (cand.kind === "review") return !cand.finish;
  if (cand.kind === "reassign") return !cand.giveUp;
  return true;
}

// Section 6.1. view = { inFlight: Map<key, { kind, task, reserve_usd }>,
// stopping, facts }. Action =
//   { kind: "close_dependents", tasks } | { kind: "wait", question }
//   | { kind: "plan", round, reserve_usd } | { kind: "goal", reserve_usd }
//   | { kind: "work", task, note, reserve_usd }
//   | { kind: "review", task, finish, reserve_usd }
//   | { kind: "reassign", task, giveUp, reserve_usd } | { kind: "done" }
export function nextActions(state, view, config) {
  if (view.stopping || state === null) return [];
  const status = state.status;
  if (FINAL.includes(status) || status === "created") return [];
  const facts = view.facts;
  const out = [];
  if (status === "paused") return out;
  if (status === "planning") {
    // A plan begun before a restart without a run in work: it goes on in the same
    // round and attempt (no new PLANNING_STARTED, the project is not running).
    if (view.inFlight.size > 0) return out;
    const reserve = slotBudget(state, config, 0);
    if (!enough(reserve)) return [budgetWait()];
    return [
      {
        kind: "plan",
        round: state.plan.round,
        resume: true,
        reserve_usd: reserve ?? 0,
      },
    ];
  }

  // 1. The dependents of closed tasks (C1); 2. the questions not asked yet.
  const closing = dependentsToClose(state);
  if (closing.length > 0)
    out.push({ kind: "close_dependents", tasks: closing });
  const questions = openQuestions(state, facts).filter((q) => q.task !== null);
  for (const q of questions) {
    if (!questionAsked(state, facts, q.task))
      out.push({ kind: "wait", question: q });
  }
  if (status !== "running" || out.length > 0 || questions.length > 0) {
    return out;
  }

  const inFlight = [...view.inFlight.values()];
  if (inFlight.some((a) => PROJECT_KINDS.includes(a.kind))) return out;
  const idle = inFlight.length === 0;
  const projectRun = (action) => {
    const reserve = slotBudget(state, config, 0);
    if (!enough(reserve)) return [budgetWait()];
    return [{ ...action, reserve_usd: reserve ?? 0 }];
  };

  // 3. A plan that was begun and not received; no tasks — the first plan.
  if (facts.planOpen !== null) {
    return idle
      ? projectRun({ kind: "plan", round: facts.planOpen.round })
      : out;
  }
  if (state.tasks.length === 0) {
    return idle ? projectRun({ kind: "plan", round: 0 }) : out;
  }

  // 4-5. The free places and the candidates by ascending id.
  const busy = new Set(inFlight.map((a) => a.task).filter((x) => x !== null));
  const changes = new Map(
    pendingDecisions(state, facts).map((d) => [d.task, d]),
  );
  const parallel = state.parallel ?? PARALLEL_DEFAULT;
  let free =
    parallel - inFlight.filter((a) => SLOT_KINDS.includes(a.kind)).length;
  let reserved = inFlight.reduce((sum, a) => sum + (a.reserve_usd ?? 0), 0);
  let blocked = false;
  const tasks = [...state.tasks].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const t of tasks) {
    if (busy.has(t.id)) continue;
    const change = changes.get(t.id);
    const cand = candidateFor(
      state,
      facts,
      t,
      change !== undefined && change.decision === "change" ? change : null,
    );
    if (cand === null) continue;
    if (!needsRun(cand)) {
      out.push({ ...cand, task: t.id, reserve_usd: 0 });
      continue;
    }
    if (free <= 0) continue;
    const reserve = slotBudget(state, config, reserved);
    if (!enough(reserve)) {
      blocked = true;
      continue;
    }
    out.push({ ...cand, task: t.id, reserve_usd: reserve ?? 0 });
    reserved += reserve ?? 0;
    free -= 1;
  }
  if (out.length > 0 || !idle) return out;

  // 6-7. Nothing in work and nothing to begin.
  if (blocked) return [budgetWait()];
  const settled = state.tasks.every(
    (t) => t.status === "done" || isClosedTask(t),
  );
  if (!settled) return out;
  const anyDone = state.tasks.some((t) => t.status === "done");
  const round = state.plan.round;
  const goal = state.goal_check;
  const goalFresh =
    goal.seq !== null && goal.seq > (state.tasks_changed_seq ?? 0);
  if (round < ROUNDS_MAX && facts.closedSincePlan.length > 0) {
    return projectRun({ kind: "plan", round: round + 1 });
  }
  if (!anyDone) {
    return round < ROUNDS_MAX
      ? projectRun({ kind: "plan", round: round + 1 })
      : [{ kind: "wait", question: { kind: "goal_check_failed", task: null } }];
  }
  if (goalFresh && goal.passed === true) return [{ kind: "done" }];
  if (goalFresh && goal.passed === false && round < ROUNDS_MAX) {
    return projectRun({ kind: "plan", round: round + 1 });
  }
  return projectRun({ kind: "goal" });
}

function budgetWait() {
  return { kind: "wait", question: { kind: "budget", task: null } };
}
