// A reader of JavaScript text for the tests of app/test (no test here): the text with its comments, strings,
// template text and regular expressions blanked with spaces, the line breaks and every offset kept, so a
// search in the blanked text finds the code only and a position in it is a position in the source. The code
// of a template's `${…}` stays. It is the tests' own reader: it is written here and imports nothing from the
// code under test. (A test file cannot be imported for this: importing one runs its tests again.)

const KEYWORDS_BEFORE_REGEX = new Set([
  "return",
  "typeof",
  "case",
  "in",
  "of",
  "delete",
  "void",
  "throw",
  "new",
  "else",
  "do",
  "yield",
  "await",
]);
const SIGNS_BEFORE_REGEX = "(,=:[!&|?{};+-*%<>~^";

/**
 * @param {string} src
 * @param {boolean} [commentsOnly] blank only the comments: strings, templates and regular expressions stay
 * @returns {string} a text of the same length
 */
export function blank(src, commentsOnly = false) {
  const n = src.length;
  const out = src.split("");
  /** @param {number} a @param {number} b */
  const wipe = (a, b) => {
    for (let k = a; k < b; k++)
      if (src[k] !== "\n" && src[k] !== "\r") out[k] = " ";
  };
  /** @param {number} at the quote */
  const skipString = (at) => {
    let j = at + 1;
    while (j < n && src[j] !== src[at] && src[j] !== "\n")
      j += src[j] === "\\" ? 2 : 1;
    return Math.min(j + 1, n);
  };
  /** @param {number} at the slash */
  const skipRegex = (at) => {
    let j = at + 1;
    let inClass = false;
    while (j < n && src[j] !== "\n") {
      if (src[j] === "\\") j += 2;
      else {
        if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) break;
        j++;
      }
    }
    return Math.min(j + 1, n);
  };
  /** @param {number} at the backtick @returns {number} the index after the closing backtick */
  const scanTemplate = (at) => {
    let j = at + 1;
    let textStart = j;
    while (j < n) {
      if (src[j] === "\\") j += 2;
      else if (src[j] === "`") {
        if (!commentsOnly) wipe(textStart, j);
        return j + 1;
      } else if (src[j] === "$" && src[j + 1] === "{") {
        if (!commentsOnly) wipe(textStart, j);
        j = scanCode(j + 2, true);
        textStart = j;
      } else j++;
    }
    return n;
  };
  /** @param {number} from @param {boolean} untilBrace @returns {number} */
  const scanCode = (from, untilBrace) => {
    let i = from;
    let depth = 0;
    let last = "";
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === "/" && d === "/") {
        const end = src.indexOf("\n", i);
        const stop = end < 0 ? n : end;
        wipe(i, stop);
        i = stop;
      } else if (c === "/" && d === "*") {
        const end = src.indexOf("*/", i + 2);
        const stop = end < 0 ? n : end + 2;
        wipe(i, stop);
        i = stop;
      } else if (c === '"' || c === "'") {
        const stop = skipString(i);
        if (!commentsOnly) wipe(i + 1, stop - 1);
        i = stop;
        last = "0";
      } else if (c === "`") {
        i = scanTemplate(i);
        last = "0";
      } else if (
        c === "/" &&
        (last === "" ||
          SIGNS_BEFORE_REGEX.includes(last) ||
          KEYWORDS_BEFORE_REGEX.has(last))
      ) {
        const stop = skipRegex(i);
        if (!commentsOnly) wipe(i + 1, stop - 1);
        i = stop;
        last = "0";
      } else if (/[A-Za-z_$]/.test(c)) {
        let j = i + 1;
        while (j < n && /[\w$]/.test(src[j])) j++;
        last = src.slice(i, j);
        i = j;
      } else if (/[0-9]/.test(c)) {
        let j = i + 1;
        while (j < n && /[\w.]/.test(src[j])) j++;
        last = "0";
        i = j;
      } else {
        if (c === "{") depth++;
        else if (c === "}") {
          if (untilBrace && depth === 0) return i + 1;
          depth--;
        }
        if (!/\s/.test(c)) last = c;
        i++;
      }
    }
    return n;
  };
  scanCode(0, false);
  return out.join("");
}
