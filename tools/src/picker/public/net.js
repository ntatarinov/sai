// The only way of the page to the server. Both addresses are relative: the page is
// "/t/<id>/" and ends with a slash, so they stay under the address of the same tenant.
// The page asks for the questionnaire and sends the answers; it asks for nothing else.
//
// The functions never throw. Every outcome is one of three:
//   { kind: "ok", body }                           the answer 200 with a right body
//   { kind: "network" }                            no answer: no net, a refusal, 20 s
//   { kind: "server", status, code, message }      any other answer, or a body that
//                                                  is not what the server gives

export const API_QUESTIONNAIRE = "api/questionnaire";
export const API_RESULT = "api/result";
export const REQUEST_TIMEOUT_MS = 20000;

const LANGS = ["ru", "kk", "en"];
const DEFAULT_LANG = "ru";
const MAX_MESSAGE_LENGTH = 300;
const MAX_QUESTIONS = 30;
const MAX_OPTIONS = 8;
const MAX_CONDITIONS = 3;
const MAX_IDS = 8;
// The longest texts of a questionnaire, in signs, as the files of the tenants allow.
const MAX_NAME = 60;
const MAX_INTRO = 400;
const MAX_TITLE = 200;
const MAX_HELP = 300;
const MAX_LABEL = 100;
const MAX_UNIT = 20;

// The single call to the network. The limit of time is added here, so no request is
// without it; the mode, the referrer policy and the credentials stay as the browser
// has them, because the server wants the header "Origin" of the same address.
async function request(path, init) {
  return fetch(path, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInteger(value) {
  return Number.isSafeInteger(value);
}

// Is the value a text of at most `max` signs (the signs are counted as whole signs and
// without the blanks at both ends, as the files of the tenants are checked)?
function text(value, max) {
  return typeof value === "string" && [...value.trim()].length <= max;
}

function strings(value) {
  return (
    Array.isArray(value) &&
    value.length <= MAX_IDS &&
    value.every((item) => typeof item === "string")
  );
}

function rightLang(lang) {
  return LANGS.includes(lang);
}

function rightCondition(condition) {
  if (!isObject(condition) || typeof condition.question !== "string")
    return false;
  const has = (key) => Object.hasOwn(condition, key);
  if (has("any_of"))
    return (
      strings(condition.any_of) && !has("none_of") && !has("min") && !has("max")
    );
  if (has("none_of"))
    return strings(condition.none_of) && !has("min") && !has("max");
  if (!has("min") && !has("max")) return false;
  return (
    (!has("min") || isInteger(condition.min)) &&
    (!has("max") || isInteger(condition.max))
  );
}

function rightOptions(options) {
  if (!Array.isArray(options)) return false;
  if (options.length < 2 || options.length > MAX_OPTIONS) return false;
  const ids = new Set();
  for (const option of options) {
    if (!isObject(option)) return false;
    if (typeof option.id !== "string" || !text(option.label, MAX_LABEL))
      return false;
    ids.add(option.id);
  }
  return ids.size === options.length;
}

function rightQuestion(question) {
  if (!isObject(question)) return false;
  const has = (key) => Object.hasOwn(question, key);
  if (typeof question.id !== "string" || question.id === "") return false;
  if (!text(question.title, MAX_TITLE)) return false;
  if (has("help") && !text(question.help, MAX_HELP)) return false;
  if (typeof question.required !== "boolean") return false;
  if (has("unit") && !text(question.unit, MAX_UNIT)) return false;
  if (question.type === "number") {
    if (!isInteger(question.min) || !isInteger(question.max)) return false;
    if (question.min >= question.max) return false;
  } else if (question.type === "single" || question.type === "multiple") {
    if (!rightOptions(question.options)) return false;
  } else return false;
  if (has("show_if")) {
    const conditions = question.show_if;
    if (!Array.isArray(conditions)) return false;
    if (conditions.length === 0 || conditions.length > MAX_CONDITIONS)
      return false;
    if (!conditions.every(rightCondition)) return false;
  }
  return true;
}

// Does the body of the questionnaire have the form that the page can show? Only what
// the page reads is checked, and the texts and the lists are held to the limits of the
// files of the tenants, so an answer that is not the answer of the server cannot make
// the page build a huge screen.
function rightQuestionnaire(body) {
  if (!isObject(body)) return false;
  if (typeof body.version !== "string" || !/^[0-9a-f]{64}$/u.test(body.version))
    return false;
  if (!rightLang(body.lang)) return false;
  const languages = body.languages;
  if (!Array.isArray(languages) || languages.length < 1 || languages.length > 3)
    return false;
  if (
    !languages.every(rightLang) ||
    new Set(languages).size !== languages.length
  )
    return false;
  if (!languages.includes(body.lang)) return false;
  if (!text(body.name, MAX_NAME) || !text(body.intro, MAX_INTRO)) return false;
  const questions = body.questions;
  if (
    !Array.isArray(questions) ||
    questions.length < 1 ||
    questions.length > MAX_QUESTIONS
  )
    return false;
  if (!questions.every(rightQuestion)) return false;
  if (
    new Set(questions.map((question) => question.id)).size !== questions.length
  )
    return false;
  const plain = questions.filter(
    (question) => !Object.hasOwn(question, "show_if"),
  ).length;
  return (
    isInteger(body.questions_min) &&
    isInteger(body.questions_max) &&
    body.questions_min >= 0 &&
    body.questions_max <= MAX_QUESTIONS &&
    body.questions_min <= body.questions_max &&
    body.questions_max === questions.length &&
    body.questions_min === plain
  );
}

// Does the body of the result have the four keys of the right kind? What is in the
// lists is not read by this page.
function rightResult(body) {
  return (
    isObject(body) &&
    (body.clear_leader === null || typeof body.clear_leader === "boolean") &&
    Array.isArray(body.recommended) &&
    (body.no_match_text === null || typeof body.no_match_text === "string") &&
    Array.isArray(body.hypotheses)
  );
}

// One call: the request, the reading of the answer, the sorting into the three outcomes.
async function call(path, makeInit, rightBody) {
  try {
    const response = await request(path, makeInit());
    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      // The time ran out while the body was coming: it is a lost net, not a bad body.
      if (error?.name === "TimeoutError" || error?.name === "AbortError")
        throw error;
    }
    if (response.status === 200) {
      return rightBody(body)
        ? { kind: "ok", body }
        : { kind: "server", status: 200, code: null, message: null };
    }
    const named = isObject(body);
    const message = named ? body.message : null;
    return {
      kind: "server",
      status: response.status,
      code: named && typeof body.error === "string" ? body.error : null,
      message:
        typeof message === "string" &&
        message !== "" &&
        message.length <= MAX_MESSAGE_LENGTH
          ? message
          : null,
    };
  } catch {
    return { kind: "network" };
  }
}

// GET the questionnaire in the language `lang` (one of ru, kk, en; any other value is
// asked as ru).
export function getQuestionnaire(lang) {
  const wanted = rightLang(lang) ? lang : DEFAULT_LANG;
  return call(
    `${API_QUESTIONNAIRE}?lang=${wanted}`,
    () => undefined,
    rightQuestionnaire,
  );
}

// POST the answers and get the result in the language `lang`. The body has one key.
export function postResult(lang, answers) {
  const wanted = rightLang(lang) ? lang : DEFAULT_LANG;
  return call(
    `${API_RESULT}?lang=${wanted}`,
    () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }),
    rightResult,
  );
}
