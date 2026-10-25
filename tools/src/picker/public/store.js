// The storage of the browser: one value per tenant under the key "sai-picker:<id>", with
// the answers of the visitor, the last question and the language, and nothing else (no
// name, no phone, no mail). Every function only works with that one key and never
// throws: a storage that refuses gives a plain answer instead.
//
// The value is a string of JSON with exactly five keys:
//   { format: 1, version, lang, current, answers }

export const STORAGE_PREFIX = "sai-picker:";

const FORMAT = 1;
const LANGS = ["ru", "kk", "en"];
const VERSION_FORM = /^[0-9a-f]{64}$/u;
const MAX_VALUE_LENGTH = 32768;
const MAX_ID_LENGTH = 64;
const MAX_ANSWERS = 30;
const MAX_TEXT_LENGTH = 200;
const MAX_LIST_LENGTH = 8;

function emptySaved() {
  return {
    version: null,
    lang: null,
    current: null,
    answers: Object.create(null),
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(id) {
  return typeof id === "string" && id.length >= 1 && id.length <= MAX_ID_LENGTH;
}

function shortText(value) {
  return typeof value === "string" && value.length <= MAX_TEXT_LENGTH;
}

// Is the value a stored answer: a short string, a list of 1 to 8 short strings, or a
// whole number?
function storedAnswer(value) {
  if (typeof value === "number") return Number.isSafeInteger(value);
  if (Array.isArray(value))
    return (
      value.length >= 1 &&
      value.length <= MAX_LIST_LENGTH &&
      value.every(shortText)
    );
  return shortText(value);
}

// The identifier of the tenant in the path of the page: "/t/<id>/" and nothing else,
// the id from 1 to 64 signs without "/". Any other path gives null.
export function tenantIdOf(pathname) {
  if (typeof pathname !== "string") return null;
  if (!pathname.startsWith("/t/") || !pathname.endsWith("/")) return null;
  const id = pathname.slice(3, -1);
  return id.includes("/") || !validId(id) ? null : id;
}

function readAnswers(value) {
  const out = Object.create(null);
  if (!isObject(value)) return out;
  let count = 0;
  for (const key of Object.keys(value)) {
    if (count >= MAX_ANSWERS) break;
    if (!validId(key) || !storedAnswer(value[key])) continue;
    out[key] = Array.isArray(value[key]) ? value[key].slice() : value[key];
    count += 1;
  }
  return out;
}

// The saved state of the tenant: { ok, saved }. `ok` is false when the storage itself
// refuses; then `saved` is empty. No key, a text that is not JSON, a value of another
// form or a too long one give `ok: true` and an empty `saved` (the value stays). Each
// field is read on its own: a wrong version drops the answers and the place but keeps a
// right language.
export function readSaved(id) {
  if (!validId(id)) return { ok: false, saved: emptySaved() };
  let text;
  try {
    text = localStorage.getItem(STORAGE_PREFIX + id);
  } catch {
    return { ok: false, saved: emptySaved() };
  }
  if (typeof text !== "string" || text.length > MAX_VALUE_LENGTH)
    return { ok: true, saved: emptySaved() };
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: true, saved: emptySaved() };
  }
  if (!isObject(value) || value.format !== FORMAT)
    return { ok: true, saved: emptySaved() };
  const saved = emptySaved();
  if (typeof value.lang === "string" && LANGS.includes(value.lang))
    saved.lang = value.lang;
  if (typeof value.version === "string" && VERSION_FORM.test(value.version)) {
    saved.version = value.version;
    if (validId(value.current)) saved.current = value.current;
    saved.answers = readAnswers(value.answers);
  }
  return { ok: true, saved };
}

// Writes the state { version, lang, current, answers } as one value of five keys. True
// when it is written, false when the storage refuses.
export function writeSaved(id, state) {
  if (!validId(id)) return false;
  try {
    const answers = Object.create(null);
    for (const key of Object.keys(state.answers))
      answers[key] = state.answers[key];
    const text = JSON.stringify({
      format: FORMAT,
      version: state.version,
      lang: state.lang,
      current: state.current,
      answers,
    });
    localStorage.setItem(STORAGE_PREFIX + id, text);
    return true;
  } catch {
    return false;
  }
}

// Removes the value of the tenant and nothing else. True or false as writeSaved.
export function clearSaved(id) {
  if (!validId(id)) return false;
  try {
    localStorage.removeItem(STORAGE_PREFIX + id);
    return true;
  } catch {
    return false;
  }
}
