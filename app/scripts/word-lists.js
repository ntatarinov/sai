// The word lists of the forbidden-words lint (REQ-111 criterion 3, ARCH §17; design
// docs/design/REQ-111-112-public-landing.md, 4.10): no guarantees, «free», a promise of time, «100 %», prices
// or days, terms. This is the one file of app/ outside app/test that holds the forms (AP-014); it lies under
// app/scripts/, not under app/public/, so check-public, which reads app/public, never meets its own lists
// (AP-093). The lists are closed: a form that is not written here is no violation, and a new form is added
// by an amendment of the requirement.
//
// A word is a run of Unicode letters and digits (L and N); everything else — punctuation, spaces, the
// hyphen — is a border. A word is compared whole, never as a part of a longer word (AP-120), and without
// letter case (both sides in lower case by toLocaleLowerCase("ru")). Each list of a language applies to the
// texts of that language only. List П is a rule, not a list of words: the number 100 taken whole, then
// nothing, a space, U+00A0 or U+202F, then the sign % or one of its words as a whole word, in every language
// (decisions/0124 О3). The sign ₸ anywhere is a finding of list Ц, in every language.

/** The languages of the lists. */
export const LANGS = Object.freeze(["ru", "kk", "en"]);

/**
 * @typedef {"ru" | "kk" | "en"} Lang
 * @typedef {Readonly<Record<Lang, readonly string[]>>} List the forms of one list in each language
 * @typedef {{ list: string, form: string }} LintFinding a list and the form of it that a text holds
 */

/**
 * @param {Record<Lang, string[]>} forms
 * @returns {List}
 */
const list = (forms) =>
  Object.freeze({
    ru: Object.freeze([...forms.ru]),
    kk: Object.freeze([...forms.kk]),
    en: Object.freeze([...forms.en]),
  });

/**
 * The five lists of words, each with its forms in each language, written as the requirement writes them:
 * Г a guarantee (14 / 7 / 6), Б free (10 / 2 / 2), В a promise of time (9 / 5 / 2), Ц prices and days
 * (23 / 11 / 8), С terms (10 / 7 / 2) — 118 forms.
 */
export const LISTS = Object.freeze({
  Г: list({
    ru: [
      "гарантия",
      "гарантии",
      "гарантию",
      "гарантией",
      "гарантий",
      "гарантируем",
      "гарантирует",
      "гарантируют",
      "гарантирую",
      "гарантированно",
      "гарантированный",
      "гарантированная",
      "гарантированное",
      "гарантированные",
    ],
    kk: [
      "кепіл",
      "кепілдік",
      "кепілдігі",
      "кепілдікті",
      "кепілдігін",
      "кепілдейміз",
      "кепілдейді",
    ],
    en: [
      "guarantee",
      "guarantees",
      "guaranteed",
      "guaranteeing",
      "warranty",
      "warranties",
    ],
  }),
  Б: list({
    ru: [
      "бесплатно",
      "бесплатный",
      "бесплатная",
      "бесплатное",
      "бесплатные",
      "бесплатного",
      "бесплатной",
      "бесплатному",
      "бесплатным",
      "бесплатных",
    ],
    kk: ["тегін", "тегінге"],
    en: ["free", "gratis"],
  }),
  В: list({
    ru: [
      "минута",
      "минуту",
      "минуты",
      "минуте",
      "минутой",
      "минут",
      "минутам",
      "минутами",
      "минутах",
    ],
    kk: ["минут", "минутта", "минуттан", "минутты", "минуттар"],
    en: ["minute", "minutes"],
  }),
  Ц: list({
    ru: [
      "цена",
      "цены",
      "цене",
      "цену",
      "ценой",
      "цен",
      "ценам",
      "ценами",
      "ценах",
      "день",
      "дня",
      "дню",
      "днём",
      "днем",
      "дне",
      "дни",
      "дней",
      "дням",
      "днями",
      "днях",
      "тенге",
      "стоимость",
      "стоимости",
    ],
    kk: [
      "баға",
      "бағасы",
      "бағаны",
      "бағаның",
      "бағада",
      "күн",
      "күні",
      "күнді",
      "күндер",
      "күндері",
      "теңге",
    ],
    en: ["price", "prices", "cost", "costs", "day", "days", "tenge", "KZT"],
  }),
  С: list({
    ru: [
      "срок",
      "срока",
      "сроку",
      "сроком",
      "сроке",
      "сроки",
      "сроков",
      "срокам",
      "сроками",
      "сроках",
    ],
    kk: [
      "мерзім",
      "мерзімі",
      "мерзімін",
      "мерзімде",
      "мерзімнен",
      "мерзімдер",
      "мерзімдері",
    ],
    en: ["deadline", "deadlines"],
  }),
});

/** The name of the rule of one hundred percent, a list without forms of its own. */
const PERCENT = "П";
/**
 * The one narrow exception of the lint (REQ-111 criterion 3 as amended, decisions/0135 О13 and 0136 О16; the code
 * design M2PROJ, 4.8): the five sentences of the consent of an invitation name the term in which a deletion
 * request is carried out. These are the keys of those sentences in the texts module; the same list stands in
 * public/shared/consent.js, which cannot import from here (a test asserts the two are equal).
 */
export const CONSENT_KEYS = Object.freeze([
  "consent_s1",
  "consent_s2",
  "consent_s3",
  "consent_s4",
  "consent_s5",
]);

/**
 * For each language, the one phrase that is taken out of the value of a consent key before the lists are
 * applied. Its list Ц form («дней», «күні», «days») stands once in each language, inside this phrase only.
 * @type {Readonly<Record<Lang, string>>}
 */
export const DELETION_TERM = Object.freeze({
  ru: "в течение 15 рабочих дней",
  kk: "15 жұмыс күні ішінде",
  en: "within 15 working days",
});

/**
 * The value of a consent key with the first occurrence of its language's deletion-term phrase taken out, once;
 * a value without the phrase comes back as it is. Nothing else is taken out.
 * @param {string} value
 * @param {string} lang one of LANGS (anything else throws a RangeError)
 * @returns {string}
 */
export function stripDeletionTerm(value, lang) {
  if (typeof value !== "string")
    throw new TypeError("stripDeletionTerm: the value is not a string");
  if (typeof lang !== "string" || !LANGS.includes(lang))
    throw new RangeError(
      "stripDeletionTerm: the language is not one of ru, kk, en",
    );
  const phrase = DELETION_TERM[/** @type {Lang} */ (lang)];
  const at = value.indexOf(phrase);
  return at < 0 ? value : value.slice(0, at) + value.slice(at + phrase.length);
}

/** The sign of the tenge: a finding of list Ц wherever it stands, in every language. */
const TENGE_SIGN = "₸";
/** The list whose finding the sign of the tenge is. */
const TENGE_LIST = "Ц";
/** The names of the lists that lintText applies when it is not told which: Г, Б, В, П, Ц and С. */
const NAMES = Object.freeze(["Г", "Б", "В", PERCENT, "Ц", "С"]);
/** The words that may stand after the number 100 in rule П, in every language. */
const PERCENT_WORDS = ["процентов", "процента", "процент", "пайыз", "percent"];
// Rule П: 100 with no decimal digit before it, nor a digit and «.» or «,»; with no digit, «.digit» or
// «,digit» after it; then nothing, a space, U+00A0 or U+202F; then «%» or one of PERCENT_WORDS as a whole
// word, in any letter case.
const PERCENT_RULE = new RegExp(
  `(?<!\\p{Nd})(?<!\\p{Nd}[.,])100(?!\\p{Nd})(?![.,]\\p{Nd})[ \\u00A0\\u202F]?(?:%|(?:${PERCENT_WORDS.join("|")})(?![\\p{L}\\p{N}]))`,
  "giu",
);
const WORD = /[\p{L}\p{N}]+/gu;

/** @param {string} s */
const lower = (s) => s.toLocaleLowerCase("ru");

/**
 * For each language, every form of every list in lower case → the list and the form as written.
 * @type {ReadonlyMap<string, ReadonlyMap<string, LintFinding>>}
 */
const FORMS_BY_LANG = new Map(
  LANGS.map((lang) => {
    /** @type {Map<string, LintFinding>} */
    const forms = new Map();
    for (const [name, forms3] of Object.entries(LISTS))
      for (const form of forms3[/** @type {Lang} */ (lang)])
        forms.set(lower(form), { list: name, form });
    return [lang, forms];
  }),
);

/**
 * The findings of the lint in one text of one language: every list form, the rule П and the sign ₸ that
 * the text holds, in the order in which they first stand in it, each pair of a list and a form once. For a
 * list of words the form is the list's own (as the requirement writes it); for П it is the text matched
 * (the number, the sign between and the sign or the word as written); for ₸ it is the sign.
 * @param {string} text the text, a string (anything else throws a TypeError)
 * @param {string} lang the language of the text, one of LANGS (anything else throws a RangeError)
 * @param {readonly string[]} [lists] the names of the lists to apply, each of Г, Б, В, П, Ц and С (an
 *   unknown name throws a RangeError; not a list throws a TypeError); all six when it is left out
 * @returns {LintFinding[]} empty when the text holds no form
 */
export function lintText(text, lang, lists = NAMES) {
  if (typeof text !== "string")
    throw new TypeError("lintText: the text is not a string");
  if (typeof lang !== "string" || !LANGS.includes(lang))
    throw new RangeError("lintText: the language is not one of ru, kk, en");
  if (!Array.isArray(lists))
    throw new TypeError("lintText: the lists are not a list of names");
  for (const name of lists)
    if (!NAMES.includes(name))
      throw new RangeError(
        "lintText: a list is not one of Г, Б, В, П, Ц and С",
      );
  const apply = new Set(lists);
  /** @type {Array<{ at: number, finding: LintFinding }>} */
  const found = [];
  const forms = /** @type {ReadonlyMap<string, LintFinding>} */ (
    FORMS_BY_LANG.get(lang)
  );
  for (const m of text.matchAll(WORD)) {
    const hit = forms.get(lower(m[0]));
    if (hit && apply.has(hit.list))
      found.push({ at: m.index, finding: { list: hit.list, form: hit.form } });
  }
  if (apply.has(PERCENT))
    for (const m of text.matchAll(PERCENT_RULE))
      found.push({ at: m.index, finding: { list: PERCENT, form: m[0] } });
  if (apply.has(TENGE_LIST))
    for (let at = text.indexOf(TENGE_SIGN); at >= 0;) {
      found.push({ at, finding: { list: TENGE_LIST, form: TENGE_SIGN } });
      at = text.indexOf(TENGE_SIGN, at + TENGE_SIGN.length);
    }
  found.sort((a, b) => a.at - b.at);
  const seen = new Set();
  /** @type {LintFinding[]} */
  const out = [];
  for (const { finding } of found) {
    const id = `${finding.list}\u0000${finding.form}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(finding);
  }
  return out;
}
