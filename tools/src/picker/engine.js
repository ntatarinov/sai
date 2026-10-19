// The picker engine (design REQ-055): which questions are visible, the points of every
// solution, the best solutions, the mark "clear leader", the hypotheses and the
// explanation of every point. A pure module with no import: it reads no file, no clock
// and no environment, has no state between calls, and builds its words only from the
// strings of the tenant file.
//
// The tenant is an object that the check of the tenant file (REQ-054) has accepted; the
// engine does not check it again. Its objects have no prototype, so they are read only
// with Object.hasOwn. The answers are any value that came from JSON: what is not right
// is an answer error, never an exception.

export const ANSWER_REASONS = Object.freeze([
  "not_object",
  "unknown_question",
  "wrong_kind",
  "unknown_option",
  "duplicate_option",
  "empty_list",
  "not_integer",
  "out_of_range",
  "missing_required",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failure(question, reason) {
  return { code: "E_ANSWER", question, reason };
}

// Is the condition true for the state "question id -> normalized answer"? A question that
// is not in the state (not visible, not answered, a wrong answer) makes it false, none_of too.
function holds(condition, state) {
  const answer = state.get(condition.question);
  if (answer === undefined) return false;
  if (Object.hasOwn(condition, "any_of")) {
    return (
      Array.isArray(answer) &&
      condition.any_of.some((id) => answer.includes(id))
    );
  }
  if (Object.hasOwn(condition, "none_of")) {
    return (
      Array.isArray(answer) &&
      !condition.none_of.some((id) => answer.includes(id))
    );
  }
  if (typeof answer !== "number") return false;
  if (Object.hasOwn(condition, "min") && answer < condition.min) return false;
  if (Object.hasOwn(condition, "max") && answer > condition.max) return false;
  return true;
}

function holdsAll(conditions, state) {
  return conditions.every((condition) => holds(condition, state));
}

function optionIds(question) {
  return question.options.map((option) => option.id);
}

// The check of one answer to a visible question: { ok: true, value } with the normalized
// answer (the ids in the order of the options, or the number), or { ok: false, reason }.
function checkAnswer(question, answer) {
  if (question.type === "number") {
    if (typeof answer !== "number") return { ok: false, reason: "wrong_kind" };
    if (!Number.isSafeInteger(answer))
      return { ok: false, reason: "not_integer" };
    if (answer < question.min || answer > question.max)
      return { ok: false, reason: "out_of_range" };
    return { ok: true, value: answer === 0 ? 0 : answer };
  }
  const ids = optionIds(question);
  if (question.type === "single") {
    if (typeof answer !== "string") return { ok: false, reason: "wrong_kind" };
    if (!ids.includes(answer)) return { ok: false, reason: "unknown_option" };
    return { ok: true, value: [answer] };
  }
  if (!Array.isArray(answer)) return { ok: false, reason: "wrong_kind" };
  if (answer.length === 0) return { ok: false, reason: "empty_list" };
  const chosen = new Set();
  for (let i = 0; i < answer.length; i++) {
    const item = answer[i];
    if (typeof item !== "string") return { ok: false, reason: "wrong_kind" };
    if (!ids.includes(item)) return { ok: false, reason: "unknown_option" };
    if (chosen.has(item)) return { ok: false, reason: "duplicate_option" };
    chosen.add(item);
  }
  return { ok: true, value: ids.filter((id) => chosen.has(id)) };
}

// The walk over the questions in the order of the file, the same for the soft and the
// strict pass. `strict` stops at the first answer error and returns it.
function walk(questions, answers, strict) {
  const given = isObject(answers) ? answers : null;
  const visible = [];
  const state = new Map();
  for (const question of questions) {
    const shown =
      !Object.hasOwn(question, "show_if") || holdsAll(question.show_if, state);
    if (!shown) continue;
    visible.push(question.id);
    if (given === null || !Object.hasOwn(given, question.id)) {
      if (strict && question.required)
        return { error: failure(question.id, "missing_required") };
      continue;
    }
    const checked = checkAnswer(question, given[question.id]);
    if (checked.ok) state.set(question.id, checked.value);
    else if (strict) return { error: failure(question.id, checked.reason) };
  }
  return { visible, state };
}

// The smallest key of the answers (by code units) that is not a question of the tenant.
function smallestUnknownKey(questions, answers) {
  const known = new Set(questions.map((question) => question.id));
  let smallest = null;
  for (const key of Object.keys(answers)) {
    if (!known.has(key) && (smallest === null || key < smallest))
      smallest = key;
  }
  return smallest;
}

// The strict pass: the first error, or the visible questions with the normalized answers.
function strictWalk(tenant, answers) {
  if (!isObject(answers)) return { error: failure(null, "not_object") };
  const unknown = smallestUnknownKey(tenant.questions, answers);
  if (unknown !== null) return { error: failure(unknown, "unknown_question") };
  return walk(tenant.questions, answers, true);
}

// The ids of the visible questions in the order of the file. Nothing is refused: answers
// that are no object count as empty ones, a wrong answer counts as no answer.
export function visibleQuestions(tenant, answers) {
  return walk(tenant.questions, answers, false).visible;
}

// { ok: true, visible, answers } with the normalized answers to the visible answered
// questions, or { ok: false, error } with the first error.
export function resolveAnswers(tenant, answers) {
  const walked = strictWalk(tenant, answers);
  if (walked.error !== undefined) return { ok: false, error: walked.error };
  const resolved = {};
  for (const id of walked.visible) {
    if (!walked.state.has(id)) continue;
    const value = walked.state.get(id);
    resolved[id] = Array.isArray(value) ? value.slice() : value;
  }
  return { ok: true, visible: walked.visible, answers: resolved };
}

// One explanation line for a condition: the question and what was chosen or answered.
function because(condition, state) {
  const answer = state.get(condition.question);
  if (Array.isArray(answer))
    return { question: condition.question, selected: answer.slice() };
  return { question: condition.question, value: answer };
}

function describeSolution(solution, score, fired, state) {
  const described = {
    id: solution.id,
    name: solution.name,
    summary: solution.summary,
    includes: solution.includes.slice(),
    needs_from_you: solution.needs_from_you.slice(),
    next_steps: solution.next_steps.slice(),
  };
  if (Object.hasOwn(solution, "price_text"))
    described.price_text = solution.price_text;
  if (Object.hasOwn(solution, "duration_text"))
    described.duration_text = solution.duration_text;
  described.not_suitable_when = solution.not_suitable_when.slice();
  described.score = score;
  described.rules = fired.map((rule) => ({
    id: rule.id,
    points: rule.points,
    text: rule.text,
    because: rule.when.map((condition) => because(condition, state)),
  }));
  return described;
}

// The whole result: { ok: true, result } or { ok: false, error }.
export function computeResult(tenant, answers) {
  const walked = strictWalk(tenant, answers);
  if (walked.error !== undefined) return { ok: false, error: walked.error };
  const state = walked.state;
  const settings = tenant.result;

  // The points: the sum of the points of the rules of a solution whose conditions all hold.
  const firedBySolution = new Map();
  const scores = new Map();
  for (const solution of tenant.solutions) {
    firedBySolution.set(solution.id, []);
    scores.set(solution.id, 0);
  }
  for (const rule of tenant.rules) {
    if (!holdsAll(rule.when, state)) continue;
    firedBySolution.get(rule.solution).push(rule);
    scores.set(rule.solution, scores.get(rule.solution) + rule.points);
  }

  // The order: points down, then the place in the file (an explicit tie-break).
  const ranked = tenant.solutions
    .map((solution, place) => ({
      solution,
      place,
      score: scores.get(solution.id),
    }))
    .sort((a, b) => b.score - a.score || a.place - b.place);
  const best = ranked
    .filter((entry) => entry.score >= settings.min_score)
    .slice(0, settings.top);

  let clearLeader = null;
  if (best.length === 1) clearLeader = true;
  else if (best.length > 1)
    clearLeader = best[0].score - best[1].score >= settings.clear_lead_gap;

  const hypotheses = [];
  if (Object.hasOwn(tenant, "hypotheses")) {
    for (const hypothesis of tenant.hypotheses) {
      if (holdsAll(hypothesis.when, state))
        hypotheses.push({
          id: hypothesis.id,
          title: hypothesis.title,
          explanation: hypothesis.explanation,
        });
    }
  }

  return {
    ok: true,
    result: {
      clear_leader: clearLeader,
      recommended: best.map((entry) =>
        describeSolution(
          entry.solution,
          entry.score,
          firedBySolution.get(entry.solution.id),
          state,
        ),
      ),
      no_match_text: best.length === 0 ? settings.no_match_text : null,
      ranking: ranked.map((entry) => ({
        solution: entry.solution.id,
        score: entry.score,
      })),
      hypotheses,
    },
  };
}
