// The three quick facts of a new project (the code design M2PROJ, 4.7): closed sets of ids, each id a tap
// on the new-project page. The text of an option is the key qf_<key>_<id>, the label of a question the
// key qf_<key>_label, both in the texts module. «unknown» stands for «not known yet». The language of a
// project is a language of the site other than kk (ARCH §17: kk output of the AI is not offered), taken from
// the one language list of i18n/lang.js, so a language added there is offered here without a second list.

import { SOURCE_LANGS } from "../i18n/lang.js";

/** The names of the three facts, in the order of the page. */
export const QUICK_KEYS = Object.freeze(["what", "whom", "lang"]);

/** The ids of each fact. */
export const OPTIONS = Object.freeze({
  what: Object.freeze(["site", "shop", "bot", "app", "tool", "unknown"]),
  whom: Object.freeze(["customers", "team", "myself", "unknown"]),
  lang: Object.freeze(SOURCE_LANGS.filter((l) => l !== "kk")),
});

/**
 * Whether `id` is an option of the fact `key`.
 * @param {string} key
 * @param {unknown} id
 * @returns {boolean}
 */
export function isOption(key, id) {
  if (key !== "what" && key !== "whom" && key !== "lang") return false;
  return typeof id === "string" && OPTIONS[key].includes(id);
}
