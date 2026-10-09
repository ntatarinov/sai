// The facts of the engine of Sai Team (design REQ-013, section 4.5): what the
// engine needs to know beyond the state of the core, read from the journal. A pure
// module without Node API.
//
// scanFacts(events) replays a whole journal; noteEvent(facts, event) applies one
// event the engine learned of after it was written. The engine keeps nothing that
// the journal cannot give back after a restart: the same events give the same
// facts (EN-66).
import { FAIL_DETAIL } from "../language.js";

const CLOSING_REASONS = ["rejected_by_user", "dependency_closed"];
const TASK_STATUS_EVENTS = new Set([
  "TASK_STARTED",
  "TASK_REVIEW",
  "TASK_WAITING_USER",
  "TASK_DONE",
  "TASK_FAILED",
  "TASK_INTERRUPTED",
]);

// Facts = {
//   launches:        { [task]: int }  TASK_STARTED of the task after its last
//                                     TASK_REASSIGNED or DECISION_RECEIVED{change}
//   applied:         Set<seq>         DECISION_RECEIVED after which the task
//                                     changed its status
//   closedSincePlan: string[]         tasks closed after the last plan (C1)
//   lastPlanningSeq: int | null       seq of the last PLANNING_STARTED
//   planOpen:        { round } | null a PLANNING_STARTED without its PLAN_RECEIVED
//   reassigned:      Set<task>        tasks with a TASK_REASSIGNED
//   startedSeq:      { [task]: seq }  the last TASK_STARTED of a task
//   failedSeq:       { [task]: seq }  the last TASK_FAILED of a task
//   failDetail:      { [task]: text } its detail
//   budgetFailed:    Set<task>        failed because the ceiling was reached
//                                     (FAIL_DETAIL.budget), until started again
//   askedSeq:        { [task]: seq }  the last question (CHAT) about a task
//   reviewNotes:     { [task]: text[] } notes of the failed reviews of the cycle
//   goalNotes:       text | null      the notes of the last goal check
//   pending:         { [task]: seq }  a decision whose task has not changed yet
// }
export function emptyFacts() {
  return {
    launches: {},
    applied: new Set(),
    closedSincePlan: [],
    lastPlanningSeq: null,
    planOpen: null,
    reassigned: new Set(),
    startedSeq: {},
    failedSeq: {},
    failDetail: {},
    budgetFailed: new Set(),
    askedSeq: {},
    reviewNotes: {},
    goalNotes: null,
    pending: {},
  };
}

function resetCycle(facts, task) {
  facts.launches[task] = 0;
  facts.reviewNotes[task] = [];
}

function addClosed(facts, task) {
  if (!facts.closedSincePlan.includes(task)) facts.closedSincePlan.push(task);
}

export function noteEvent(facts, event) {
  if (event === null || typeof event !== "object") return;
  const task = typeof event.task === "string" ? event.task : null;
  const data = event.data ?? {};
  if (task !== null && TASK_STATUS_EVENTS.has(event.type)) {
    if (Object.hasOwn(facts.pending, task)) {
      facts.applied.add(facts.pending[task]);
      delete facts.pending[task];
    }
  }
  switch (event.type) {
    case "PLANNING_STARTED":
      facts.lastPlanningSeq = event.seq;
      facts.planOpen = { round: data.round };
      break;
    case "PLAN_RECEIVED":
      facts.planOpen = null;
      facts.closedSincePlan = [];
      break;
    case "TASK_STARTED":
      facts.launches[task] = (facts.launches[task] ?? 0) + 1;
      facts.startedSeq[task] = event.seq;
      facts.budgetFailed.delete(task);
      break;
    case "TASK_REASSIGNED":
      facts.reassigned.add(task);
      resetCycle(facts, task);
      break;
    case "DECISION_RECEIVED":
      facts.pending[task] = event.seq;
      if (data.decision === "change") resetCycle(facts, task);
      if (data.decision === "reject") addClosed(facts, task);
      break;
    case "TASK_FAILED":
      facts.failedSeq[task] = event.seq;
      facts.failDetail[task] = data.detail;
      if (data.detail === FAIL_DETAIL.budget) facts.budgetFailed.add(task);
      if (CLOSING_REASONS.includes(data.reason)) addClosed(facts, task);
      break;
    case "REVIEW_RESULT":
      if (data.passed === false) {
        facts.reviewNotes[task] = [...(facts.reviewNotes[task] ?? [])];
        facts.reviewNotes[task].push(data.notes);
      }
      break;
    case "GOAL_CHECK_RESULT":
      facts.goalNotes = data.notes;
      break;
    case "CHAT":
      if (data.kind === "question" && task !== null) {
        facts.askedSeq[task] = event.seq;
      }
      break;
    default:
      break;
  }
}

export function scanFacts(events) {
  const facts = emptyFacts();
  for (const event of events) noteEvent(facts, event);
  return facts;
}
