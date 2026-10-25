// The text of the site by key and language, with the placeholders {name} filled in.
// The texts themselves are in texts.js; this file only fills them.
import { TEXTS } from "./texts.js";

// say(key, lang, values) -> string. A key or a language that texts.js does not have is
// a mistake of the program and throws; it never gives an empty string. The value is put
// in by a function, so "$&" or "$1" in a value stay letters. A placeholder without a
// value stays as it is, for example "{min}".
export function say(key, lang, values = {}) {
  if (!Object.hasOwn(TEXTS, key)) throw new Error(`no text for the key ${key}`);
  const entry = TEXTS[key];
  if (!Object.hasOwn(entry, lang))
    throw new Error(`no text for the key ${key} in the language ${lang}`);
  const given = values ?? {};
  return entry[lang].replace(/\{([a-z0-9_]+)\}/gu, (whole, name) =>
    Object.hasOwn(given, name) ? String(given[name]) : whole,
  );
}
