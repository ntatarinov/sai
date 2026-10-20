// The languages and the texts of the picker site (design REQ-061, 7 and 8). The file
// runs in the browser and in Node, so it has no dependencies and no calls to the
// platform. Everything it exports is frozen.

export const LANGUAGES = Object.freeze(["ru", "kk", "en"]);
export const DEFAULT_LANGUAGE = "ru";

// The name of each language in that language.
export const LANGUAGE_NAMES = Object.freeze({
  ru: "Русский",
  kk: "Қазақша",
  en: "English",
});

// A text of the site: a key -> { ru, kk, en }. A placeholder {name} is the same in all
// three languages. Later work adds its keys here (prefixes lead_, advice_).
export const TEXTS = Object.freeze({
  language_switcher_label: Object.freeze({
    ru: "Язык",
    kk: "Тіл",
    en: "Language",
  }),
});

// A value is right when it is exactly one of LANGUAGES.
function isLanguage(value) {
  return typeof value === "string" && LANGUAGES.includes(value);
}

// chooseLanguage({ query, stored, available }) -> "ru" | "kk" | "en". The first right
// value of the address, then of the stored choice, else the default; a language that
// the file does not have gives the default (the second value is not tried). Nothing
// else is read, so a header of the request has no effect. It never throws.
export function chooseLanguage(input = {}) {
  try {
    if (input === null || typeof input !== "object") return DEFAULT_LANGUAGE;
    const { query, stored, available } = input;
    let wanted = DEFAULT_LANGUAGE;
    if (isLanguage(query)) wanted = query;
    else if (isLanguage(stored)) wanted = stored;
    if (!Array.isArray(available) || !available.includes(wanted))
      return DEFAULT_LANGUAGE;
    return wanted;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
