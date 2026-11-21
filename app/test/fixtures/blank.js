// The one reader of JavaScript text for the tests of app/test (no test here): `scan` reads a source text once,
// token by token, and `blank` gives it with its comments, strings, template text and regular expressions blanked
// with spaces, the line breaks and every offset kept, so a search in the blanked text finds the code only and a
// position in it is a position in the source. The code of a template's `${…}` stays. It is the tests' own reader:
// it is written here and imports nothing from the code under test. It lives in fixtures/ and not in a test file
// because importing a test file runs its tests again (AP-014: one reader, so a case fixed in it is fixed for every
// test that uses it).

// The tokens after which a `/` starts a regular expression: a punctuator that cannot end an operand (a
// division `/` and a spread `...` included), the start of the text, and "ctl)", the `)` of the condition
// of `if`, `while`, `for` or `with`.
const REGEX_AFTER = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  ";",
  "+",
  "-",
  "*",
  "%",
  "<",
  ">",
  "~",
  "^",
  "/",
  "...",
  "ctl)",
]);
// The keywords after which an expression begins; after `.` (`x.in`) they are names and end one.
const REGEX_AFTER_WORD = new Set([
  "return",
  "typeof",
  "case",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "delete",
  "void",
  "throw",
  "yield",
  "await",
  "extends",
  "default",
  "break",
  "continue",
]);
// The tokens after which a `/` may start either: `}` (of a block or of an object), `++` and `--` (prefix
// or postfix) and `of` (a keyword in `for (… of …)`, a name elsewhere).
const SLASH_EITHER = new Set(["}", "++", "--", "of"]);

/**
 * Reads a source text once, token by token, into `code` (its comments, strings, template text and regular
 * expressions blanked with spaces; the code of `${…}` stays) and `kept` (only its comments blanked); both
 * keep line breaks and lengths. A `/` starts a regular expression or is a division by the token before it
 * (REGEX_AFTER, REGEX_AFTER_WORD). Where that token leaves both open (SLASH_EITHER) the scan reads a
 * division and lists the place in `slashes`, which `findings` makes red, so no text that the scan could
 * read the other way hides code from the rules.
 * @param {string} src
 */
export function scan(src) {
  const code = src.split("");
  const kept = src.split("");
  /** @type {number[]} */
  const slashes = [];
  /** @type {number[]} the open `{` inside each `${…}`, innermost last */
  const tpl = [];
  /** @type {boolean[]} for each open `(`, whether it holds the condition of `if`, `while`, `for` or `with` */
  const parens = [];
  // The last token (a word, a punctuator, "0" for a literal, "ctl)"), the token before it, whether the
  // last word follows `.` (a property name), and whether the next word character starts a new word.
  let prev = "";
  let before = "";
  let dotted = false;
  let fresh = true;
  const blankAll = (/** @type {number} */ a, /** @type {number} */ b) => {
    for (let k = a; k < b; k++) if (src[k] !== "\n") code[k] = kept[k] = " ";
  };
  const blankCode = (/** @type {number} */ a, /** @type {number} */ b) => {
    for (let k = a; k < b; k++) if (src[k] !== "\n") code[k] = " ";
  };
  const token = (/** @type {string} */ t) => {
    before = prev;
    prev = t;
    dotted = false;
    fresh = true;
  };
  let i = 0;
  if (src.startsWith("#!")) {
    const e = src.indexOf("\n");
    i = e < 0 ? src.length : e;
    blankAll(0, i);
  }
  while (i < src.length) {
    const ch = src[i];
    const nx = src[i + 1];
    if (tpl.length && tpl[tpl.length - 1] === 0 && ch === "}") {
      tpl.pop();
      i = template(i + 1);
      continue;
    }
    if (ch === "/" && (nx === "/" || nx === "*")) {
      const e = nx === "/" ? src.indexOf("\n", i) : src.indexOf("*/", i + 2);
      const end = e < 0 ? src.length : nx === "/" ? e : e + 2;
      blankAll(i, end);
      i = end;
      fresh = true;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let k = i + 1;
      while (k < src.length && src[k] !== ch && src[k] !== "\n")
        k += src[k] === "\\" ? 2 : 1;
      blankCode(i + 1, k);
      i = k + 1;
      token("0");
      continue;
    }
    if (ch === "`") {
      i = template(i + 1);
      continue;
    }
    if (ch === "/") {
      if (SLASH_EITHER.has(prev) && !(prev === "of" && dotted)) slashes.push(i);
      else if (
        REGEX_AFTER.has(prev) ||
        (!dotted && REGEX_AFTER_WORD.has(prev))
      ) {
        let k = i + 1;
        let cls = false;
        while (k < src.length && src[k] !== "\n") {
          if (src[k] === "\\") k += 2;
          else if (src[k] === "[") ((cls = true), k++);
          else if (src[k] === "]") ((cls = false), k++);
          else if (src[k] === "/" && !cls) break;
          else k++;
        }
        blankCode(i + 1, k);
        i = k + 1;
        while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
        token("0");
        continue;
      }
      token("/");
      i++;
      continue;
    }
    if (tpl.length && ch === "{") tpl[tpl.length - 1] += 1;
    if (tpl.length && ch === "}") tpl[tpl.length - 1] -= 1;
    if (/[A-Za-z0-9_$]/.test(ch)) {
      if (fresh || !/[A-Za-z0-9_$]$/.test(prev)) {
        // A name after `.`, `?.` or `#` (a private name such as `#return`) is a property, not a keyword.
        const property = prev === "." || prev === ".." || prev === "#";
        token(ch);
        dotted = property;
        fresh = false;
      } else prev += ch;
    } else if (/\s/.test(ch)) fresh = true;
    else if ((ch === "+" || ch === "-") && prev === ch && src[i - 1] === ch)
      prev = ch + ch;
    else if (
      ch === "." &&
      (prev === "." || prev === "..") &&
      src[i - 1] === "."
    )
      prev += ".";
    else if (ch === "(") {
      parens.push(
        !dotted &&
          (["if", "while", "for", "with"].includes(prev) ||
            (prev === "await" && before === "for")),
      );
      token("(");
    } else if (ch === ")") token(parens.pop() ? "ctl)" : ")");
    else token(ch);
    i++;
  }
  return { code: code.join(""), kept: kept.join(""), slashes };

  /**
   * Blanks the text of a template from `k` to its end or to its next `${`, and gives the index after it.
   * @param {number} k
   */
  function template(k) {
    const start = k;
    while (k < src.length) {
      if (src[k] === "\\") k += 2;
      else if (src[k] === "`") {
        blankCode(start, k);
        token("0");
        return k + 1;
      } else if (src[k] === "$" && src[k + 1] === "{") {
        blankCode(start, k);
        tpl.push(0);
        token("{");
        return k + 2;
      } else k++;
    }
    blankCode(start, k);
    return k;
  }
}

/**
 * The text with its comments, strings, template text and regular expressions blanked (`scan(src).code`),
 * or with `commentsOnly` only its comments (`scan(src).kept`), so a comment between the words of an import
 * hides nothing.
 * @param {string} src
 * @param {boolean} [commentsOnly]
 */
export function blank(src, commentsOnly = false) {
  const s = scan(src);
  return commentsOnly ? s.kept : s.code;
}

/**
 * The import specifiers of a source: `import … from "x"`, `import "x"`, `export … from "x"` and `import("x")`,
 * the comments blanked and the strings kept (so a path in a comment is no import).
 * @param {string} src
 * @returns {string[]}
 */
export function specifiersOf(src) {
  return [
    ...blank(src, true).matchAll(
      /\b(?:from|import)\s*\(?\s*(["'`])([^"'`\n]+)\1/g,
    ),
  ].map((m) => m[2]);
}
