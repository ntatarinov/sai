// The text rules of the public pages: the rules of tools/src/picker/text-rules.js with the same
// names, parameters and answers, written here because the files under public/shared import only
// public/shared (ARCH §2.1, §2.2). A phrase is at most MAX_WORDS words, the text does not address
// the reader as «ты», and it holds no control or invisible sign. A parity test drives both copies
// with the same texts.

/** The most words one phrase may have. */
export const MAX_WORDS = 18;

/** The words of the second person singular, in lower case; a text that holds one is refused. */
export const SECOND_PERSON_WORDS = Object.freeze([
  "ты",
  "тебя",
  "тебе",
  "тобой",
  "твой",
  "твоя",
  "твоё",
  "твои",
]);

const SECOND_PERSON = new Set(SECOND_PERSON_WORDS);
const WORD_PARTS = /[\p{L}\p{N}]+/gu;

// The signs a text for the visitor may not hold, the same as the picker's rule: control signs
// (Cc) except U+0009-U+000D, format signs (Cf), the line and paragraph separators, and a single
// half of a surrogate pair.
const FORBIDDEN = /(?![\t-\r])[\p{Cc}\p{Cf}\u2028\u2029]|\p{Cs}/u;

/**
 * null, or { unit, half } for the first forbidden sign from the left. The whole text is looked
 * at (no trim). unit is the code point of the sign; for a single half of a pair it is the code
 * unit, and half is true.
 * @param {string} text
 * @returns {{ unit: number, half: boolean } | null}
 */
export function forbiddenSign(text) {
  const found = FORBIDDEN.exec(text);
  if (found === null) return null;
  const unit = /** @type {number} */ (found[0].codePointAt(0));
  return { unit, half: unit >= 0xd800 && unit <= 0xdfff };
}

/**
 * The length in code points after the spaces at both ends are cut off.
 * @param {string} s
 * @returns {number}
 */
export function trimmedLength(s) {
  return [...s.trim()].length;
}

/**
 * The phrases of a text: it is cut after ".", "!", "?" or "…" followed by a space sign or by the
 * end (a dot inside "1.5" does not cut). The rest after the last sign is a phrase too.
 * @param {string} text
 * @returns {string[]}
 */
export function phrasesOf(text) {
  return text.split(/(?<=[.!?…])(?:\s+|$)/);
}

/**
 * The number of words of a phrase: a word is a part between space signs that has a letter or a
 * digit ("—" is no word).
 * @param {string} phrase
 * @returns {number}
 */
export function wordCount(phrase) {
  return phrase.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * The whole words of the text (borders: neither a letter nor a digit), in lower case.
 * @param {string} text
 * @returns {string[]}
 */
export function wordsOf(text) {
  return text.toLowerCase().match(WORD_PARTS) ?? [];
}

/**
 * Whether the text holds a word of SECOND_PERSON_WORDS.
 * @param {string} text
 * @returns {boolean}
 */
export function hasSecondPerson(text) {
  return wordsOf(text).some((w) => SECOND_PERSON.has(w));
}

/**
 * null, or { kind: "long", words } for the first phrase longer than MAX_WORDS.
 * @param {string} text
 * @returns {{ kind: "long", words: number } | null}
 */
export function wordsProblem(text) {
  for (const phrase of phrasesOf(text)) {
    const words = wordCount(phrase);
    if (words > MAX_WORDS) return { kind: "long", words };
  }
  return null;
}

/**
 * null, or { kind: "formal" }, or { kind: "long", words }. The address is looked at first.
 * @param {string} text
 * @returns {{ kind: "formal" } | { kind: "long", words: number } | null}
 */
export function textProblem(text) {
  if (hasSecondPerson(text)) return { kind: "formal" };
  return wordsProblem(text);
}
