// The view of a checked tenant file in one language (design REQ-061, 5.5). The engine
// reads the view, so it does not know the languages. Nothing here reads the disk, the
// clock or the environment; the input is never changed and nothing is thrown.
import { isFormatV2 } from "./lang-check.js";
import { DEFAULT_LANGUAGE, LANGUAGES } from "./limits.js";

// A text in languages is known by its form, not by its place: an object with exactly the
// keys ru, kk and en. This is right only for a file that checkBytes has passed (any other
// object with extra fields is an E_FIELD there), so pick is called on such a file only.
// A new field of a tenant file must not be an object with exactly these three keys.
function isTextInLanguages(value) {
  const keys = Object.keys(value);
  return (
    keys.length === LANGUAGES.length && LANGUAGES.every((l) => keys.includes(l))
  );
}

function define(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

// A new copy of the value where each object with the keys ru, kk and en is the string
// of `language`. The order of keys and items stays. Numbers and booleans are copied.
function pick(value, language) {
  if (Array.isArray(value)) return value.map((item) => pick(item, language));
  if (value === null || typeof value !== "object") return value;
  if (isTextInLanguages(value)) return value[language];
  const copy = Object.create(Object.getPrototypeOf(value));
  for (const key of Object.keys(value))
    define(copy, key, pick(value[key], language));
  return copy;
}

// The languages of a file: ru, kk and en for /2, ru alone for the rest. A new list each time.
export function fileLanguages(tenant) {
  return isFormatV2(tenant) ? [...LANGUAGES] : [DEFAULT_LANGUAGE];
}

// The tenant in one language. A file /1 is returned as it is (any language gives ru).
// For /2 a new object is built; a language that is not in LANGUAGES gives ru.
export function tenantInLanguage(tenant, language) {
  if (!isFormatV2(tenant)) return tenant;
  const chosen =
    typeof language === "string" && LANGUAGES.includes(language)
      ? language
      : DEFAULT_LANGUAGE;
  return pick(tenant, chosen);
}
