// The texts of the answers of the picker site server (design REQ-056, 5.4). The words are
// the keys of TEXTS (public/texts.js); this file only picks one and puts the values in.
// Nothing here reads the disk, the clock or the environment.
import { LANGUAGES, TEXTS } from "./public/texts.js";

const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/gu;

// textOf(key, lang, values) -> the text of `key` in `lang`, each {name} replaced by
// values[name]. A key or a language that is not in TEXTS is a program error. The value is
// put in by a function, so that "$&" or "$1" in it stay letters, and a value is not read
// again for further placeholders.
export function textOf(key, lang, values = {}) {
  if (typeof key !== "string" || !Object.hasOwn(TEXTS, key))
    throw new Error("unknown text key");
  if (typeof lang !== "string" || !Object.hasOwn(TEXTS[key], lang))
    throw new Error("unknown text language");
  return TEXTS[key][lang].replace(PLACEHOLDER, (whole, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
}

// The text in all the languages in one line, for an answer where the language is not
// known yet: "ru / kk / en".
export function textInAllLanguages(key, values = {}) {
  return LANGUAGES.map((lang) => textOf(key, lang, values)).join(" / ");
}

// errorBody(code, key, lang, values, extra) -> the JSON text { error, message, ...extra }.
// lang null gives the message in all the languages.
export function errorBody(code, key, lang, values = {}, extra = {}) {
  const message =
    lang === null ? textInAllLanguages(key, values) : textOf(key, lang, values);
  return JSON.stringify({ error: code, message, ...extra });
}
