// The rule of the visible questions and of the right answers. It is the same rule that
// the server uses, kept here as a copy because the server file does not reach the page;
// a test of the repository compares the two on many sets of answers. A change of the
// rule on the server is a change of this file.

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failure(reason) {
  return { ok: false, reason };
}

// The check of one answer to one question: { ok: true, value } with the answer in its
// normal form (a list of one id for "single", the ids in the order of the options for
// "multiple", the number for "number"), or { ok: false, reason }. Any value is allowed.
export function checkAnswer(question, raw) {
  if (question.type === "number") {
    if (typeof raw !== "number") return failure("wrong_kind");
    if (!Number.isSafeInteger(raw)) return failure("not_integer");
    if (raw < question.min || raw > question.max)
      return failure("out_of_range");
    return { ok: true, value: raw === 0 ? 0 : raw };
  }
  const ids = question.options.map((option) => option.id);
  if (question.type === "single") {
    if (typeof raw !== "string") return failure("wrong_kind");
    if (!ids.includes(raw)) return failure("unknown_option");
    return { ok: true, value: [raw] };
  }
  if (!Array.isArray(raw)) return failure("wrong_kind");
  if (raw.length === 0) return failure("empty_list");
  const chosen = new Set();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (typeof item !== "string") return failure("wrong_kind");
    if (!ids.includes(item)) return failure("unknown_option");
    if (chosen.has(item)) return failure("duplicate_option");
    chosen.add(item);
  }
  return { ok: true, value: ids.filter((id) => chosen.has(id)) };
}

// Is the condition true for the state "question id -> answer in its normal form"? A
// question that has no right answer there makes every condition false, "none_of" too.
function holds(condition, state) {
  const answer = state.get(condition.question);
  if (answer === undefined) return false;
  if (Object.hasOwn(condition, "any_of"))
    return (
      Array.isArray(answer) &&
      condition.any_of.some((id) => answer.includes(id))
    );
  if (Object.hasOwn(condition, "none_of"))
    return (
      Array.isArray(answer) &&
      !condition.none_of.some((id) => answer.includes(id))
    );
  if (typeof answer !== "number") return false;
  if (Object.hasOwn(condition, "min") && answer < condition.min) return false;
  if (Object.hasOwn(condition, "max") && answer > condition.max) return false;
  return true;
}

// The ids of the visible questions in the order of the questionnaire. `answers` is any
// value: what is not an object counts as no answers, a wrong answer counts as no answer.
export function visibleIds(questions, answers) {
  const given = isObject(answers) ? answers : null;
  const visible = [];
  const state = new Map();
  for (const question of questions) {
    const shown =
      !Object.hasOwn(question, "show_if") ||
      question.show_if.every((condition) => holds(condition, state));
    if (!shown) continue;
    visible.push(question.id);
    if (given === null || !Object.hasOwn(given, question.id)) continue;
    const checked = checkAnswer(question, given[question.id]);
    if (checked.ok) state.set(question.id, checked.value);
  }
  return visible;
}
