// The model of the questionnaire page without the document: the progress, the next and
// the previous question, the answers and the number from the text of a field. Every
// function is pure: it does not change its input and does not read the page.
//
// The answers are an object without a prototype, "question id -> stored answer": a
// string for "single" (the id of the option), a list of ids in the order of the options
// for "multiple", a whole number for "number".
import { checkAnswer, visibleIds } from "./rules.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function emptyAnswers() {
  return Object.create(null);
}

function findQuestion(questions, id) {
  return questions.find((question) => question.id === id);
}

// The answer in the form that is stored and sent.
function stored(question, value) {
  return question.type === "single" ? value[0] : value;
}

function ownAnswer(answers, id) {
  return isObject(answers) && Object.hasOwn(answers, id);
}

function hasRightAnswer(question, answers) {
  return (
    ownAnswer(answers, question.id) &&
    checkAnswer(question, answers[question.id]).ok
  );
}

// The progress { k, n }. k is the place of the current question among the visible ones
// (from 1; 0 when the question is not visible). n is the number of the questions that
// are visible now plus those that are hidden but have a condition on a question that is
// not above the current one: the visitor has not passed that question yet, and its
// answer may open them. So n does not grow when the visitor goes forward.
export function progress(questions, answers, currentId) {
  const visible = visibleIds(questions, answers);
  const shown = new Set(visible);
  const place = new Map(questions.map((question, i) => [question.id, i]));
  const current = place.has(currentId) ? place.get(currentId) : Infinity;
  let n = 0;
  for (const question of questions) {
    if (shown.has(question.id)) {
      n += 1;
      continue;
    }
    const conditions = question.show_if ?? [];
    if (
      conditions.some(
        (condition) =>
          place.has(condition.question) &&
          place.get(condition.question) >= current,
      )
    )
      n += 1;
  }
  return { k: visible.indexOf(currentId) + 1, n };
}

// The id of the first visible question: the first question has no condition.
export function firstVisible(questions) {
  return visibleIds(questions, null)[0] ?? null;
}

// The id of the visible question after the current one, or null.
export function nextVisible(questions, answers, currentId) {
  const visible = visibleIds(questions, answers);
  const at = visible.indexOf(currentId);
  return at === -1 || at === visible.length - 1 ? null : visible[at + 1];
}

// The id of the visible question before the current one, or null.
export function previousVisible(questions, answers, currentId) {
  const visible = visibleIds(questions, answers);
  const at = visible.indexOf(currentId);
  return at <= 0 ? null : visible[at - 1];
}

// The new answers with the answer `raw` to the question `id`. An undefined or a wrong
// `raw` clears the answer. Then the answers to the questions that are hidden now are
// removed, by one new count of the visible questions: a question that is hidden is not
// in the state, so a question that depends on it is hidden too. The input is not changed.
export function setAnswer(questions, answers, id, raw) {
  const next = emptyAnswers();
  if (isObject(answers)) {
    for (const key of Object.keys(answers)) next[key] = answers[key];
  }
  const question = findQuestion(questions, id);
  const checked =
    question !== undefined && raw !== undefined
      ? checkAnswer(question, raw)
      : { ok: false };
  if (checked.ok) next[id] = stored(question, checked.value);
  else delete next[id];
  const shown = new Set(visibleIds(questions, next));
  for (const key of Object.keys(next)) {
    if (!shown.has(key)) delete next[key];
  }
  return next;
}

// The new answers that have only the own answers of the visible questions, each of them
// right and in its normal form. Unknown keys, hidden and wrong answers are dropped.
export function pruneAnswers(questions, answers) {
  const out = emptyAnswers();
  if (!isObject(answers)) return out;
  const shown = new Set(visibleIds(questions, answers));
  for (const question of questions) {
    if (!shown.has(question.id) || !Object.hasOwn(answers, question.id))
      continue;
    const checked = checkAnswer(question, answers[question.id]);
    if (checked.ok) out[question.id] = stored(question, checked.value);
  }
  return out;
}

// The answers for the body of the request of the result.
export function bodyAnswers(questions, answers) {
  return pruneAnswers(questions, answers);
}

// The id of the first visible required question without a right answer, or null.
export function openQuestion(questions, answers) {
  const shown = new Set(visibleIds(questions, answers));
  for (const question of questions) {
    if (
      shown.has(question.id) &&
      question.required &&
      !hasRightAnswer(question, answers)
    )
      return question.id;
  }
  return null;
}

// The question to continue from: the saved one if it is visible, else the first visible
// one without a right answer, else the first visible one; and not farther than the first
// required question without an answer, so a required question cannot be jumped over.
export function entryQuestion(questions, answers, savedCurrent) {
  const visible = visibleIds(questions, answers);
  if (visible.length === 0) return null;
  let entry = visible.includes(savedCurrent) ? savedCurrent : null;
  if (entry === null) {
    entry =
      visible.find(
        (id) => !hasRightAnswer(findQuestion(questions, id), answers),
      ) ?? visible[0];
  }
  const open = openQuestion(questions, answers);
  if (open !== null && visible.indexOf(open) < visible.indexOf(entry))
    return open;
  return entry;
}

// True when no visible question is after the current one.
export function isLastVisible(questions, answers, currentId) {
  return nextVisible(questions, answers, currentId) === null;
}

// The number in the text of a field: { state: "empty" }, { state: "invalid" } or
// { state: "ok", value }. `badInput` is the mark of the browser that the field holds a
// text that is not a number. Only digits with a minus before them are an answer.
export function readNumber(text, badInput) {
  if (badInput === true || typeof text !== "string")
    return { state: "invalid" };
  if (text === "") return { state: "empty" };
  if (!/^-?[0-9]+$/u.test(text)) return { state: "invalid" };
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return { state: "invalid" };
  return { state: "ok", value: value === 0 ? 0 : value };
}

// The answer of the button "Next": { ok: true } or { ok: false, message } where the
// message is "required" (a required question has no right answer) or "range" (the field
// of a number holds a text that is not a number in the limits, also when the question
// is not required). `raw` is the stored answer or undefined; `numberState` is the result
// of readNumber for a number field, else undefined.
export function verdict(question, raw, numberState) {
  if (question.type === "number" && numberState !== undefined) {
    if (numberState.state === "invalid") return { ok: false, message: "range" };
    if (numberState.state === "ok") {
      const inside =
        numberState.value >= question.min && numberState.value <= question.max;
      return inside ? { ok: true } : { ok: false, message: "range" };
    }
    return question.required
      ? { ok: false, message: "required" }
      : { ok: true };
  }
  const right = raw !== undefined && checkAnswer(question, raw).ok;
  if (!right && question.required) return { ok: false, message: "required" };
  return { ok: true };
}
