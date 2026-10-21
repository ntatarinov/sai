// The rule of understandable text (design REQ-054, 4.11 and 5.4): a phrase is at most
// MAX_WORDS words, and the text does not address the reader as "ты".
import { MAX_WORDS, SECOND_PERSON_WORDS } from "./limits.js";

const SECOND_PERSON = new Set(SECOND_PERSON_WORDS);
const WORD_PARTS = /[\p{L}\p{N}]+/gu;

// The signs a text for the visitor may not hold (decision 0076): control signs (Cc)
// except U+0009-U+000D, format signs (Cf), the line and paragraph separators, and a
// single half of a surrogate pair. This is the only place that lists them.
const FORBIDDEN = /(?![\t-\r])[\p{Cc}\p{Cf}\u2028\u2029]|\p{Cs}/u;

// null, or { unit, half } for the first forbidden sign from the left. The whole text is
// looked at (no trim). unit is the code point of the sign; for a single half of a pair it
// is the code unit, and half is true.
export function forbiddenSign(text) {
  const found = FORBIDDEN.exec(text);
  if (found === null) return null;
  const unit = found[0].codePointAt(0);
  return { unit, half: unit >= 0xd800 && unit <= 0xdfff };
}

// The length in code points after the spaces at both ends are cut off.
export function trimmedLength(s) {
  return [...s.trim()].length;
}

// The phrases of a text: it is cut after ".", "!", "?" or "…" followed by a space sign
// or by the end (a dot inside "1.5" does not cut). The rest after the last sign is a phrase too.
export function phrasesOf(text) {
  return text.split(/(?<=[.!?…])(?:\s+|$)/);
}

// A word is a part between space signs that has a letter or a digit ("—" is no word).
export function wordCount(phrase) {
  return phrase.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

// Whole words of the text (borders: neither a letter nor a digit), lower case.
export function wordsOf(text) {
  return text.toLowerCase().match(WORD_PARTS) ?? [];
}

export function hasSecondPerson(text) {
  return wordsOf(text).some((w) => SECOND_PERSON.has(w));
}

// null, or { kind: "long", words } for the first phrase longer than MAX_WORDS.
export function wordsProblem(text) {
  for (const phrase of phrasesOf(text)) {
    const words = wordCount(phrase);
    if (words > MAX_WORDS) return { kind: "long", words };
  }
  return null;
}

// null, or { kind: "formal" }, or { kind: "long", words }. The address is looked at first.
export function textProblem(text) {
  if (hasSecondPerson(text)) return { kind: "formal" };
  return wordsProblem(text);
}
