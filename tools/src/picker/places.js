// Places and shown values (design REQ-054, 5.5). Everything that comes from the file
// and is put into a message passes through show().
import { SHOWN_CHARS } from "./limits.js";
import { hasSecondPerson, wordsOf } from "./text-rules.js";

export const ROOT_PLACE = "весь файл";

const HIDDEN = "(скрыто)";
// Words of a parser or of a program that no message may contain (design REQ-054, D8).
const FORBIDDEN_WORDS = new Set([
  "unexpected",
  "token",
  "undefined",
  "null",
  "nan",
]);
const FORBIDDEN_SPELLINGS = ["Unexpected", "token", "undefined", "null", "NaN"];
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isSpaceOrControl(ch) {
  const code = ch.codePointAt(0);
  if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  return /[\s\p{Cf}]/u.test(ch);
}

function mustHide(shown) {
  if (hasSecondPerson(shown)) return true;
  if (wordsOf(shown).some((w) => FORBIDDEN_WORDS.has(w))) return true;
  return FORBIDDEN_SPELLINGS.some((w) => shown.includes(w));
}

// A value for a message: no space or control signs, at most SHOWN_CHARS code points,
// and no word that the messages must not contain.
export function show(value) {
  const chars = [];
  for (const ch of String(value)) chars.push(isSpaceOrControl(ch) ? "_" : ch);
  const shown =
    chars.length > SHOWN_CHARS
      ? `${chars.slice(0, SHOWN_CHARS).join("")}…`
      : chars.join("");
  return mustHide(shown) ? HIDDEN : shown;
}

// questions[3].show_if[0].question; the first key has no dot; a key that is no plain
// name (or that show() changes) is written as ["key"].
export function pathText(path) {
  if (path.length === 0) return ROOT_PLACE;
  let out = "";
  path.forEach((segment, index) => {
    if (typeof segment === "number") {
      out += `[${segment}]`;
      return;
    }
    const shown = show(segment);
    if (IDENTIFIER.test(segment) && shown === segment) {
      out += index === 0 ? segment : `.${segment}`;
    } else {
      out += `["${shown}"]`;
    }
  });
  return out;
}
