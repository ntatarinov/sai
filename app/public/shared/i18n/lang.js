// The languages of the public pages and the one rule that picks the language of a page (the code
// design of the public landing, 4.1; ARCH §17). Pure: it imports nothing and reads no page, no
// browser storage and no request header, so the pages, the server and the build share one rule.

/** The languages of the local set: the local server, the tests and the texts module. */
export const SOURCE_LANGS = Object.freeze(["ru", "kk", "en"]);

/**
 * The public languages: the languages of the public set of the build and of the function entry
 * (gate G9). kk stays out of them until the owner answers G9; a change of this constant is a
 * release.
 */
export const PUBLIC_LANGS = Object.freeze(["ru", "en"]);

/**
 * The language of a page: `query` when it is one of `langs` exactly, else `stored` when it is
 * one of `langs` exactly, else "ru".
 * @param {string | null} query the value of `?lang=` of the address, or null
 * @param {string | null} stored the language the reader chose before, or null
 * @param {readonly string[]} langs the languages of the build
 * @returns {string}
 */
export function pickLang(query, stored, langs) {
  if (query !== null && langs.includes(query)) return query;
  if (stored !== null && langs.includes(stored)) return stored;
  return "ru";
}
