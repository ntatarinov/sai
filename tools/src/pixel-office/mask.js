// Masking of secrets in stored text (design REQ-008, section 3; criteria 7
// and 18). A pure module without Node API: the hook, the server and the
// command import it, so the three lines of masking apply the same rules.
//
// Every rule is one pass over the text: a regular expression with a single
// unbounded repetition (no nested or adjacent repetitions over one class of
// characters) or a plain scan. A value that already starts with the label is
// never taken again, so masking twice changes nothing.
import {
  MASK_LABEL,
  codePointLength,
  firstCodePoints,
} from "./public/schema.js";

// A character of a token: letters, digits and _ + = -.
const TOKEN_CHAR = /[A-Za-z0-9_+=-]/;
const SCHEME_CHAR = /[A-Za-z0-9+.-]/;
const SPACE = /\s/;

function isTokenChar(ch) {
  return ch !== undefined && TOKEN_CHAR.test(ch);
}

function isSpace(ch) {
  return ch !== undefined && SPACE.test(ch);
}

// M1: a PEM block, from -----BEGIN to the end of the -----END ...----- line;
// without -----END, to the end of the text (and the scan stops there).
function maskPem(text) {
  let out = "";
  let pos = 0;
  for (;;) {
    const begin = text.indexOf("-----BEGIN", pos);
    if (begin === -1) break;
    out += text.slice(pos, begin) + MASK_LABEL;
    const end = text.indexOf("-----END", begin + 10);
    if (end === -1) return out;
    const close = text.indexOf("-----", end + 8);
    if (close === -1) return out;
    pos = close + 5;
  }
  return out + text.slice(pos);
}

// M2: the value of an Authorization header, to the end of the line.
const AUTH_HEADER = /(^|[^A-Za-z0-9_])(authorization[:=])([^\r\n]*)/gi;

function maskAuthHeader(text) {
  return text.replace(AUTH_HEADER, (all, left, name, rest) => {
    let i = 0;
    while (i < rest.length && (rest[i] === " " || rest[i] === "\t")) i += 1;
    const value = rest.slice(i);
    if (value === "" || value.startsWith(MASK_LABEL)) return all;
    return `${left}${name}${rest.slice(0, i)}${MASK_LABEL}`;
  });
}

// M3: user:password in scheme://user:password@host. One scan from each "://";
// the user and the password have no "/", "@" or white space, the user no ":".
function maskUrlCredentials(text) {
  let out = "";
  let pos = 0;
  let from = 0;
  for (;;) {
    const sep = text.indexOf("://", from);
    if (sep === -1) break;
    from = sep + 3;
    if (sep === 0 || !SCHEME_CHAR.test(text[sep - 1])) continue;
    let i = sep + 3;
    while (i < text.length && !"/@:".includes(text[i]) && !isSpace(text[i])) {
      i += 1;
    }
    if (i === sep + 3 || text[i] !== ":") continue;
    let j = i + 1;
    while (j < text.length && !"/@".includes(text[j]) && !isSpace(text[j])) {
      j += 1;
    }
    if (j === i + 1 || text[j] !== "@") continue;
    out += text.slice(pos, sep + 3) + MASK_LABEL;
    pos = j;
    from = j;
  }
  return out + text.slice(pos);
}

// M4-M6: keys with a known prefix. On the left the start of the text or a
// character that is not a letter or a digit ("=", "_", "-", ":" and a quote are
// boundaries). The left character is checked in the input of the pass and is
// not replaced (rule V5 of the design).
const PREFIXED_KEYS = [
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/g,
  /(?<![A-Za-z0-9])gh[pos]_[A-Za-z0-9]{20,}/g,
  /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/g,
  /(?<![A-Za-z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9_+=-])/g,
];

function maskPrefixedKeys(text) {
  let out = text;
  for (const rule of PREFIXED_KEYS) out = out.replace(rule, MASK_LABEL);
  return out;
}

// M7: three parts of base64url through dots (x.y.z). The run is a maximal
// segment of [A-Za-z0-9_-] and "."; dots at its very end are punctuation.
const DOTTED_RUN = /[A-Za-z0-9_.-]+/g;

function maskThreeParts(text) {
  return text.replace(DOTTED_RUN, (run) => {
    let end = run.length;
    while (end > 0 && run[end - 1] === ".") end -= 1;
    const body = run.slice(0, end);
    const parts = body.split(".");
    if (parts.length !== 3 || parts.some((p) => p === "")) return run;
    return MASK_LABEL + run.slice(end);
  });
}

// A quote opens a value only as its first character (rule V1).
const QUOTES = "'\"`";

function isLineEnd(ch) {
  return ch === "\n" || ch === "\r";
}

// A value in quotes that opens at text[open] (rules V2-V4): it closes at the
// first same quote further on the same line that is not escaped ("\" escapes
// the next character unless that is the end of the line); without one it runs
// to the end of the line (the line end itself stays) or of the text. Returns
// the end of the value (exclusive) and whether it is empty ("").
function scanQuoted(text, open) {
  const quote = text[open];
  let i = open + 1;
  while (i < text.length) {
    const ch = text[i];
    if (isLineEnd(ch)) break;
    if (ch === "\\" && i + 1 < text.length && !isLineEnd(text[i + 1])) {
      i += 2;
    } else if (ch === quote) {
      return { end: i + 1, empty: i === open + 1 };
    } else {
      i += 1;
    }
  }
  return { end: i, empty: false };
}

// The value of a pair at text[from]: in quotes (V1-V4) or to white space or a
// quote. Returns the end of the consumed value and whether to replace it.
function scanValue(text, from) {
  if (QUOTES.includes(text[from] ?? "\0")) {
    const { end, empty } = scanQuoted(text, from);
    return { end, replace: !empty };
  }
  let end = from;
  while (
    end < text.length &&
    !isSpace(text[end]) &&
    !QUOTES.includes(text[end])
  ) {
    end += 1;
  }
  const value = text.slice(from, end);
  return { end, replace: value !== "" && !value.startsWith(MASK_LABEL) };
}

// M8: the value after "Bearer" and spaces or tabs (on the left no
// [A-Za-z0-9_], checked in the input of the pass - V5). The search goes on
// after the consumed value, so every character is looked at a bounded number
// of times.
const BEARER = /(?<![A-Za-z0-9_])bearer[ \t]+/gi;

function maskBearer(text) {
  let out = "";
  let pos = 0;
  BEARER.lastIndex = 0;
  for (;;) {
    const match = BEARER.exec(text);
    if (match === null) break;
    const from = BEARER.lastIndex;
    const { end, replace } = scanValue(text, from);
    if (replace) {
      out += text.slice(pos, from) + MASK_LABEL;
      pos = end;
    }
    BEARER.lastIndex = end;
  }
  return out + text.slice(pos);
}

// M9: name=value or name: value, names in any case. The name is a maximal
// identifier segment ([A-Za-z0-9_-]) equal to one of the names below or ending
// with one after "_" or "-" (DB_PASSWORD, my_password); right after the segment
// one optional quote (a JSON key), then "=" or ":", then spaces or tabs, then
// the value (scanValue). One pass over the segments; no regular expression
// with a repetition before the name (that would be quadratic).
const NAMES = [
  "token",
  "secret",
  "password",
  "passwd",
  "api_key",
  "apikey",
  "authorization",
];
const NAME_TAIL = 14; // the longest name and the "_" or "-" before it
const SEGMENT = /[A-Za-z0-9_-]+/g;

function endsWithName(segment) {
  const tail = segment.slice(-NAME_TAIL).toLowerCase();
  return NAMES.some((name) => {
    if (!tail.endsWith(name)) return false;
    if (segment.length === name.length) return true;
    const before = tail[tail.length - name.length - 1];
    return before === "_" || before === "-";
  });
}

function maskNamedValues(text) {
  let out = "";
  let pos = 0;
  SEGMENT.lastIndex = 0;
  for (;;) {
    const match = SEGMENT.exec(text);
    if (match === null) break;
    if (!endsWithName(match[0])) continue;
    let i = SEGMENT.lastIndex;
    if (QUOTES.includes(text[i] ?? "\0")) i += 1;
    if (text[i] !== "=" && text[i] !== ":") continue;
    i += 1;
    while (text[i] === " " || text[i] === "\t") i += 1;
    const { end, replace } = scanValue(text, i);
    if (replace) {
      out += text.slice(pos, i) + MASK_LABEL;
      pos = end;
    }
    SEGMENT.lastIndex = end;
  }
  return out + text.slice(pos);
}

// M10: a long random string - a maximal run of token characters, at least 32
// long, with a lowercase letter and a digit or an uppercase letter. Not a
// part of a path or of a dotted name: on the left no "/" or "."; on the right
// no "/", and a "." only as punctuation (followed by the end, white space or a
// character that is neither a token character nor "/").
const TOKEN_RUN = /[A-Za-z0-9_+=-]+/g;
const LONG_MIN = 32;

function rightBoundaryOk(text, end) {
  const next = text[end];
  if (next === undefined) return true;
  if (next === "/") return false;
  if (next !== ".") return true;
  const after = text[end + 1];
  return after === undefined || (!isTokenChar(after) && after !== "/");
}

function maskLongStrings(text) {
  return text.replace(TOKEN_RUN, (run, offset) => {
    if (run.length < LONG_MIN) return run;
    const prev = offset === 0 ? undefined : text[offset - 1];
    if (prev === "/" || prev === ".") return run;
    if (!rightBoundaryOk(text, offset + run.length)) return run;
    const lower = /[a-z]/.test(run);
    const other = /[0-9A-Z]/.test(run);
    return lower && other ? MASK_LABEL : run;
  });
}

const RULES = [
  maskPem,
  maskAuthHeader,
  maskUrlCredentials,
  maskPrefixedKeys,
  maskThreeParts,
  maskBearer,
  maskNamedValues,
  maskLongStrings,
];

// Replaces every match of the rules M1-M10 with MASK_LABEL. Not a string: "".
export function maskSecrets(text) {
  if (typeof text !== "string") return "";
  let out = text;
  for (const rule of RULES) out = rule(out);
  return out;
}

// Text for storage: the first scanMax UTF-16 units (without half of a
// surrogate pair; when the input is longer, the run without white space that
// the cut went through is dropped, so no part of a secret stays at the edge),
// masked, then cut to limit code points. White space only gives "".
export function prepareText(raw, scanMax, limit) {
  if (typeof raw !== "string") return { text: "", truncated: false };
  let truncated = false;
  let text = raw;
  if (raw.length > scanMax) {
    truncated = true;
    let end = scanMax;
    const last = raw.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    if (!isSpace(raw[end]) && end > 0 && !isSpace(raw[end - 1])) {
      while (end > 0 && !isSpace(raw[end - 1])) end -= 1;
    }
    text = raw.slice(0, end);
  }
  text = maskSecrets(text);
  if (codePointLength(text, limit) > limit) {
    text = firstCodePoints(text, limit);
    truncated = true;
  }
  if (text.trim() === "") text = "";
  return { text, truncated };
}

// ---- findSecrets: the check of the content of a result file (REQ-102) ----------
//
// A pure function over a text: nothing is replaced, a secret is only found or
// not found. It returns null or { form } with form F1...F9 (the forms of
// REQ-102) and never holds the value, an offset or a part of the input, so a
// caller may log the result. Every step is one forward pass over the text or
// over a value: no regular expression with a repeated group over unbounded
// text and no search of the rest of the text for each candidate. A search for
// the closer of a template group that failed is remembered for the rest of the
// line (the record of one pass), and the closers at the end of a value are
// dropped by six counters and one walk back. The rules of maskSecrets above are
// not touched.

// The kinds of a value.
const FIND_NONE = 0;
const FIND_KEEP = 1;
const FIND_LITERAL = 2;

// White space as in JavaScript (the same set as SPACE); a line end is "\n" and
// "\r" only; HWS is white space that is not a line end.
//
// findIsLineEnd and findIsQuote below repeat isLineEnd and QUOTES of the rules
// M1-M10 on purpose, in char-code form: the passes of findSecrets read the text
// with charCodeAt in their inner loops, and a call of the string helpers there
// (text[i], then isLineEnd(ch) and QUOTES.includes(ch)) costs about three times
// more per character (measured on 5 million characters: 10-14 ms against 31 ms).
// The sets are the same: "\n" and "\r"; the quotes ', " and `.
function findIsWs(c) {
  return (
    c === 32 ||
    (c >= 9 && c <= 13) ||
    c === 0xa0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
}

function findIsLineEnd(c) {
  return c === 10 || c === 13;
}

function findIsHws(c) {
  return findIsWs(c) && !findIsLineEnd(c);
}

function findIsQuote(c) {
  return c === 39 || c === 34 || c === 96;
}

function findIsLetter(c) {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

function findIsDigit(c) {
  return c >= 48 && c <= 57;
}

// A character of a segment of a name: [A-Za-z0-9_-].
function findIsSegment(c) {
  return findIsLetter(c) || findIsDigit(c) || c === 95 || c === 45;
}

// A character of an identifier of a path, a call or a bare name: Latin letters,
// "_" and "$", no digits.
function findIsIdent(c) {
  return findIsLetter(c) || c === 95 || c === 36;
}

function findLowerAscii(s) {
  return s.replace(/[A-Z]/g, (m) => String.fromCharCode(m.charCodeAt(0) + 32));
}

// ---- template groups (class Ш of the requirement) ----

// The end (exclusive) of the template group that starts at text[i], or -1:
// "${{...}}" to the first "}}", "${...}" to the first "}", "{{...}}" to the
// first "}}", "$(...)" to the first ")", "<...>" to the first ">" with no "<"
// inside. A group is not empty and lies on one line. An opener has exactly one
// closer and there is no fallback from one form to another: "${{ a }" has no
// "}}", so it is no group. The search goes forward from the first character
// after the opener and stops at the closer, at a line end, at limit, or (for
// "<") at a second "<". rec is the record of one pass, or null: a search that
// ran to a line end or to the end of the text is written down as { from,
// lineEnd }, and every later search of the same closer that starts inside
// [from, lineEnd] fails at once, so a line full of unclosed groups is read
// once. With a limit before the end of the text (the content of a quotation,
// the password of an address) there is no record: the caller reads that region
// once.
function findGroup(text, i, rec, limit) {
  const c = text.charCodeAt(i);
  let start;
  let kind;
  if (c === 36) {
    const d = text.charCodeAt(i + 1);
    if (d === 123) {
      if (text.charCodeAt(i + 2) === 123) {
        start = i + 3;
        kind = "}}";
      } else {
        start = i + 2;
        kind = "}";
      }
    } else if (d === 40) {
      start = i + 2;
      kind = ")";
    } else {
      return -1;
    }
  } else if (c === 123) {
    if (text.charCodeAt(i + 1) !== 123) return -1;
    start = i + 2;
    kind = "}}";
  } else if (c === 60) {
    return findAngleGroup(text, i + 1, limit);
  } else {
    return -1;
  }
  const known = rec === null ? undefined : rec[kind];
  if (known !== undefined && known.from <= start && start <= known.lineEnd) {
    return -1;
  }
  const closer = kind === ")" ? 41 : 125;
  const pair = kind === "}}";
  let j = start;
  while (j < limit) {
    const d = text.charCodeAt(j);
    if (findIsLineEnd(d)) break;
    if (d === closer) {
      if (!pair || (j + 1 < limit && text.charCodeAt(j + 1) === 125)) {
        // The closer at the first position is an empty group: nothing is
        // written down, the scan did not run to the end of the line.
        return j === start ? -1 : j + (pair ? 2 : 1);
      }
    }
    j += 1;
  }
  if (rec !== null) rec[kind] = { from: start, lineEnd: j };
  return -1;
}

// "<...>": not empty, one line, no second "<". The scans of two groups never
// overlap (the next one starts at the second "<"), so there is no record.
function findAngleGroup(text, start, limit) {
  for (let j = start; j < limit; j += 1) {
    const d = text.charCodeAt(j);
    if (d === 62) return j === start ? -1 : j + 1;
    if (d === 60 || findIsLineEnd(d)) return -1;
  }
  return -1;
}

// "$NAME" or "%NAME%" over text[a, b), NAME = [A-Za-z_][A-Za-z0-9_]*.
function findIsNameTemplate(text, a, b) {
  const c = text.charCodeAt(a);
  let from = a + 1;
  let to = b;
  if (c === 37) {
    if (b - a < 3 || text.charCodeAt(b - 1) !== 37) return false;
    to = b - 1;
  } else if (c !== 36) {
    return false;
  }
  if (from >= to) return false;
  const first = text.charCodeAt(from);
  if (!findIsLetter(first) && first !== 95) return false;
  for (from += 1; from < to; from += 1) {
    const d = text.charCodeAt(from);
    if (!findIsLetter(d) && !findIsDigit(d) && d !== 95) return false;
  }
  return true;
}

// ---- the classes of a value ----

// Class З: the whole value (case-insensitive) is one of 26 words, or a chain of
// at least three of "*", "x", "X", or, for a value that is made only of
// [A-Za-z0-9_.-], it starts with "your" or contains "example". A value with any
// other character (an ampersand, a slash, a colon, an at sign, a space) is
// judged without these last two tests, so text with "example" or "your" glued
// behind a real value does not make the value a placeholder.
const FIND_PLACEHOLDERS = new Set([
  "password",
  "passwd",
  "pass",
  "pwd",
  "secret",
  "token",
  "key",
  "changeme",
  "change-me",
  "change_me",
  "changeit",
  "example",
  "sample",
  "placeholder",
  "dummy",
  "demo",
  "test",
  "admin",
  "root",
  "user",
  "guest",
  "postgres",
  "mysql",
  "none",
  "null",
  "undefined",
]);
const FIND_PLACEHOLDER_MAX = 11;
const FIND_YOUR = "your";
const FIND_EXAMPLE = "example";

// true when text[at...] starts with the lower-case ASCII word (any case).
function findWordAt(text, at, word) {
  for (let m = 0; m < word.length; m += 1) {
    if ((text.charCodeAt(at + m) | 32) !== word.charCodeAt(m)) return false;
  }
  return true;
}

// true when text[a, b) is made only of [A-Za-z0-9_.-] (the set of a run of the
// form F7, findIsRunChar below). One forward pass.
function findIsWordOnly(text, a, b) {
  for (let k = a; k < b; k += 1) {
    if (!findIsRunChar(text.charCodeAt(k))) return false;
  }
  return true;
}

function findIsPlaceholder(text, a, b) {
  const len = b - a;
  if (len >= 3) {
    let k = a;
    while (k < b) {
      const c = text.charCodeAt(k);
      if (c !== 42 && c !== 120 && c !== 88) break;
      k += 1;
    }
    if (k === b) return true;
  }
  if (
    len <= FIND_PLACEHOLDER_MAX &&
    FIND_PLACEHOLDERS.has(findLowerAscii(text.slice(a, b)))
  ) {
    return true;
  }
  // The two substring tests (REQ-102, class З) count only for a value of the
  // set [A-Za-z0-9_.-]: the first hit decides, the value is read once more.
  if (len >= FIND_YOUR.length && findWordAt(text, a, FIND_YOUR)) {
    return findIsWordOnly(text, a, b);
  }
  for (let k = a; k + FIND_EXAMPLE.length <= b; k += 1) {
    if (
      (text.charCodeAt(k) | 32) === 101 &&
      findWordAt(text, k, FIND_EXAMPLE)
    ) {
      return findIsWordOnly(text, a, b);
    }
  }
  return false;
}

function findIdentEnd(text, k, b) {
  let e = k;
  while (e < b && findIsIdent(text.charCodeAt(e))) e += 1;
  return e;
}

// The end of the separator "." or "?." at text[e], or -1.
function findDotEnd(text, e, b) {
  const c = text.charCodeAt(e);
  if (c === 46) return e + 1;
  if (c === 63 && e + 1 < b && text.charCodeAt(e + 1) === 46) return e + 2;
  return -1;
}

// Class В1: two or more identifiers joined by "." or "?.".
function findIsPath(text, a, b) {
  let k = a;
  let parts = 0;
  for (;;) {
    const e = findIdentEnd(text, k, b);
    if (e === k) return false;
    parts += 1;
    if (e === b) return parts >= 2;
    k = findDotEnd(text, e, b);
    if (k === -1) return false;
  }
}

// Class В2: an identifier or a path directly followed by "(".
function findIsCall(text, a, b) {
  let k = a;
  for (;;) {
    const e = findIdentEnd(text, k, b);
    if (e === k || e >= b) return false;
    if (text.charCodeAt(e) === 40) return true;
    k = findDotEnd(text, e, b);
    if (k === -1) return false;
  }
}

const FIND_KEYWORDS = new Set([
  "string",
  "number",
  "boolean",
  "any",
  "unknown",
  "void",
  "never",
  "object",
  "bigint",
  "symbol",
  "true",
  "false",
  "str",
  "int",
  "float",
  "bool",
  "bytes",
  "dict",
  "list",
  "nil",
  "self",
  "this",
  "await",
  "async",
  "new",
  "function",
]);
const FIND_KEYWORD_MAX = 8;

// Class В3: letters and "_" only, and a word of the list of types and keywords,
// or "_" and a letter, or a lower-case letter directly before an upper-case one.
function findIsBare(text, a, b) {
  let underscore = false;
  let letter = false;
  let humps = false;
  let prev = 0;
  for (let k = a; k < b; k += 1) {
    const c = text.charCodeAt(k);
    if (c === 95) {
      underscore = true;
    } else if (findIsLetter(c)) {
      letter = true;
      if (c <= 90 && prev >= 97 && prev <= 122) humps = true;
    } else {
      return false;
    }
    prev = c;
  }
  if ((underscore && letter) || humps) return true;
  return (
    b - a <= FIND_KEYWORD_MAX &&
    FIND_KEYWORDS.has(findLowerAscii(text.slice(a, b)))
  );
}

// Class В4: only the characters "{", "[", "(", "|", ">".
function findIsBlock(text, a, b) {
  for (let k = a; k < b; k += 1) {
    const c = text.charCodeAt(k);
    if (c !== 123 && c !== 91 && c !== 40 && c !== 124 && c !== 62) {
      return false;
    }
  }
  return true;
}

// ---- the value ----

// A quotation that opens at text[open]: it closes at the same quote on the same
// line ("\" escapes the next character unless that is a line end); without a
// closing quote it runs to the end of the line or of the text.
function findQuoted(text, open) {
  const n = text.length;
  const quote = text.charCodeAt(open);
  let i = open + 1;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (findIsLineEnd(c)) break;
    if (c === 92 && i + 1 < n && !findIsLineEnd(text.charCodeAt(i + 1))) {
      i += 2;
    } else if (c === quote) {
      return { contentEnd: i, end: i + 1 };
    } else {
      i += 1;
    }
  }
  return { contentEnd: i, end: i };
}

// The end of text[i, end) without its closers that have no pair: a trailing ")",
// "]" or "}" is dropped while the value holds more closers of its kind than
// openers of its kind. Six counters in one forward pass, then one walk back;
// nothing is searched for a dropped closer.
function findDropClosers(text, i, end) {
  const last = text.charCodeAt(end - 1);
  if (last !== 41 && last !== 93 && last !== 125) return end;
  const opened = [0, 0, 0];
  const closed = [0, 0, 0];
  for (let k = i; k < end; k += 1) {
    const c = text.charCodeAt(k);
    if (c === 40) opened[0] += 1;
    else if (c === 41) closed[0] += 1;
    else if (c === 91) opened[1] += 1;
    else if (c === 93) closed[1] += 1;
    else if (c === 123) opened[2] += 1;
    else if (c === 125) closed[2] += 1;
  }
  let stop = end;
  while (stop > i) {
    const c = text.charCodeAt(stop - 1);
    const kind = c === 41 ? 0 : c === 93 ? 1 : c === 125 ? 2 : -1;
    if (kind === -1 || closed[kind] <= opened[kind]) break;
    closed[kind] -= 1;
    stop -= 1;
  }
  return stop;
}

// The value at text[i]: { end, kind } with kind none (empty: a line end, the
// end of the text, a pair of quotes), keep (a placeholder, a template, and for
// an unquoted value a path, a call, a bare identifier when allowBareId, a block
// opener) or literal. end is where the caller goes on. rec is the record of
// failed group searches of the pass.
function findValue(text, i, allowBareId, rec) {
  const n = text.length;
  const c = i < n ? text.charCodeAt(i) : 10;
  if (findIsLineEnd(c)) return { end: i, kind: FIND_NONE };
  if (findIsQuote(c)) {
    const { contentEnd, end } = findQuoted(text, i);
    const a = i + 1;
    if (contentEnd === a) return { end, kind: FIND_NONE };
    const keep =
      findIsPlaceholder(text, a, contentEnd) ||
      findGroup(text, a, null, contentEnd) === contentEnd ||
      findIsNameTemplate(text, a, contentEnd);
    return { end, kind: keep ? FIND_KEEP : FIND_LITERAL };
  }
  const group = findGroup(text, i, rec, n);
  let end = group === -1 ? i : group;
  while (end < n) {
    const d = text.charCodeAt(end);
    if (findIsWs(d) || findIsQuote(d) || d === 44 || d === 59) break;
    end += 1;
  }
  const stop = end === i ? i : findDropClosers(text, i, end);
  if (stop === i) return { end, kind: FIND_NONE };
  const keep =
    group === stop ||
    findIsPlaceholder(text, i, stop) ||
    findIsNameTemplate(text, i, stop) ||
    findIsPath(text, i, stop) ||
    findIsCall(text, i, stop) ||
    (allowBareId && findIsBare(text, i, stop)) ||
    findIsBlock(text, i, stop);
  return { end, kind: keep ? FIND_KEEP : FIND_LITERAL };
}

// ---- the forms ----

// F1: any "-----BEGIN", except the line "-----BEGIN CERTIFICATE-----" with no
// dash directly before or after it.
const FIND_CERT = "-----BEGIN CERTIFICATE-----";

function findPem(text) {
  let pos = 0;
  for (;;) {
    const at = text.indexOf("-----BEGIN", pos);
    if (at === -1) return false;
    const certificate =
      text.startsWith(FIND_CERT, at) &&
      text.charCodeAt(at - 1) !== 45 &&
      text.charCodeAt(at + FIND_CERT.length) !== 45;
    if (!certificate) return true;
    pos = at + 10;
  }
}

// F3: scheme://user:password@host with a password that is neither a
// placeholder nor a whole template. With no user the form does not apply.
function findUrlPassword(text) {
  const n = text.length;
  let from = 0;
  for (;;) {
    const sep = text.indexOf("://", from);
    if (sep === -1) return false;
    from = sep + 3;
    if (sep === 0 || !SCHEME_CHAR.test(text[sep - 1])) continue;
    let i = from;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 47 || c === 64 || c === 58 || findIsWs(c)) break;
      i += 1;
    }
    if (i === from || text.charCodeAt(i) !== 58) continue;
    let j = i + 1;
    while (j < n) {
      const c = text.charCodeAt(j);
      if (c === 47 || c === 64 || findIsWs(c)) break;
      j += 1;
    }
    if (j === i + 1 || text.charCodeAt(j) !== 64) continue;
    const a = i + 1;
    const kept =
      findIsPlaceholder(text, a, j) ||
      findGroup(text, a, null, j) === j ||
      findIsNameTemplate(text, a, j);
    if (!kept) return true;
    from = j;
  }
}

// F4, F5, F6: keys with a known prefix, no letter or digit directly to the left.
const FIND_PREFIXED = [
  [/(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/, "F4"],
  [/(?<![A-Za-z0-9])gh[pos]_[A-Za-z0-9]{20,}/, "F5"],
  [/(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}/, "F5"],
  [/(?<![A-Za-z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9_+=-])/, "F6"],
];

function findPrefixedKey(text) {
  for (const [rule, form] of FIND_PREFIXED) {
    if (rule.test(text)) return form;
  }
  return null;
}

// F7: a run of [A-Za-z0-9_.-] (dots at its end are punctuation) that starts
// with "eyJ" and has exactly two dots with three parts that are not empty.
function findIsRunChar(c) {
  return findIsSegment(c) || c === 46;
}

function findJwt(text) {
  const n = text.length;
  let pos = 0;
  for (;;) {
    const at = text.indexOf("eyJ", pos);
    if (at === -1) return false;
    pos = at + 3;
    if (at > 0 && findIsRunChar(text.charCodeAt(at - 1))) continue;
    let end = at;
    while (end < n && findIsRunChar(text.charCodeAt(end))) end += 1;
    let body = end;
    while (body > at && text.charCodeAt(body - 1) === 46) body -= 1;
    let dots = 0;
    let empty = false;
    for (let k = at; k < body; k += 1) {
      if (text.charCodeAt(k) !== 46) continue;
      dots += 1;
      if (text.charCodeAt(k - 1) === 46) empty = true;
    }
    if (dots === 2 && !empty) return true;
    pos = end;
  }
}

// F8: the word Bearer (no letter, digit or "_" to the left), spaces or tabs,
// then a value. Not a value: a line end, the end of the text, a quote followed
// by white space or the end (the closing quote of a string).
const FIND_BEARER = /(?<![A-Za-z0-9_])bearer[ \t]+/gi;

function findBearer(text) {
  const n = text.length;
  const rec = {};
  FIND_BEARER.lastIndex = 0;
  for (;;) {
    const match = FIND_BEARER.exec(text);
    if (match === null) return false;
    const from = FIND_BEARER.lastIndex;
    const c = from < n ? text.charCodeAt(from) : 10;
    let found;
    if (findIsLineEnd(c)) {
      found = { end: from, kind: FIND_NONE };
    } else if (
      findIsQuote(c) &&
      (from + 1 >= n || findIsWs(text.charCodeAt(from + 1)))
    ) {
      found = { end: from, kind: FIND_NONE };
    } else {
      found = findValue(text, from, false, rec);
    }
    if (found.kind === FIND_LITERAL) {
      FIND_BEARER.lastIndex = 0;
      return true;
    }
    FIND_BEARER.lastIndex = Math.max(found.end, from);
  }
}

// F2 and F9: a pair name=value or name: value. The name is a maximal segment
// [A-Za-z0-9_-] equal to one of the names or ending with one after "_" or "-".
const FIND_NAMES = [
  "token",
  "secret",
  "password",
  "passwd",
  "api_key",
  "apikey",
  "authorization",
];
const FIND_NAME_AUTH = 6;
const FIND_NAME_MIN = 5;

// -1: not a name; else the index in FIND_NAMES.
function findNameOf(text, a, b) {
  if (b - a < FIND_NAME_MIN) return -1;
  const last = text.charCodeAt(b - 1) | 32;
  if (last !== 110 && last !== 116 && last !== 100 && last !== 121) return -1;
  const tail = findLowerAscii(text.slice(Math.max(a, b - NAME_TAIL), b));
  for (let m = 0; m < FIND_NAMES.length; m += 1) {
    const name = FIND_NAMES[m];
    if (!tail.endsWith(name)) continue;
    if (b - a === name.length) return m;
    const before = tail.charCodeAt(tail.length - name.length - 1);
    if (before === 95 || before === 45) return m;
  }
  return -1;
}

// The schemes of an Authorization value (a closed list, any case).
const FIND_SCHEMES = new Set([
  "basic",
  "bearer",
  "digest",
  "token",
  "negotiate",
  "ntlm",
  "oauth",
  "apikey",
  "bot",
]);
const FIND_SCHEME_MAX = 9;

// The end of a scheme word at text[q], or -1. The word ends at white space, a
// quote or the end of the text.
function findSchemeEnd(text, q) {
  const n = text.length;
  let e = q;
  while (e < n && e - q <= FIND_SCHEME_MAX) {
    const c = text.charCodeAt(e);
    if (findIsWs(c) || findIsQuote(c)) break;
    e += 1;
  }
  if (e - q < 3 || e - q > FIND_SCHEME_MAX) return -1;
  return FIND_SCHEMES.has(findLowerAscii(text.slice(q, e))) ? e : -1;
}

// The value of Authorization after the sign, at text[p]: wide white space (not
// a line end), one optional opening quote, an optional scheme and the same white
// space after it. After a scheme the value is what follows (a quote followed by
// white space or the end is the closing quote of a string: no value; a bare
// identifier is a literal). With no scheme the value is the first word (a bare
// identifier is an expression), or, when a quote opens it, the whole quotation.
function findAuthorization(text, p, rec) {
  const n = text.length;
  let from = p;
  while (findIsHws(text.charCodeAt(from))) from += 1;
  const quoted = findIsQuote(text.charCodeAt(from));
  const scheme = findSchemeEnd(text, quoted ? from + 1 : from);
  if (scheme === -1) return findValue(text, from, true, rec);
  let r = scheme;
  while (findIsHws(text.charCodeAt(r))) r += 1;
  const c = r < n ? text.charCodeAt(r) : 10;
  if (findIsLineEnd(c)) return { end: r, kind: FIND_NONE };
  if (findIsQuote(c) && (r + 1 >= n || findIsWs(text.charCodeAt(r + 1)))) {
    return { end: r, kind: FIND_NONE };
  }
  return findValue(text, r, false, rec);
}

function findNamedValue(text) {
  const n = text.length;
  const rec = {};
  let i = 0;
  while (i < n) {
    if (!findIsSegment(text.charCodeAt(i))) {
      i += 1;
      continue;
    }
    const a = i;
    i += 1;
    while (i < n && findIsSegment(text.charCodeAt(i))) i += 1;
    const name = findNameOf(text, a, i);
    if (name === -1) continue;
    let p = i;
    if (findIsQuote(text.charCodeAt(p))) p += 1;
    const sign = text.charCodeAt(p);
    if (sign !== 58 && sign !== 61) continue;
    p += 1;
    let found;
    if (name === FIND_NAME_AUTH) {
      found = findAuthorization(text, p, rec);
    } else {
      while (text.charCodeAt(p) === 32 || text.charCodeAt(p) === 9) p += 1;
      found = findValue(text, p, true, rec);
    }
    if (found.kind === FIND_LITERAL)
      return name === FIND_NAME_AUTH ? "F2" : "F9";
    i = Math.max(found.end, p);
  }
  return null;
}

// null when no form finds a secret in text; otherwise { form }. The cheapest
// forms go first; the first hit is returned.
export function findSecrets(text) {
  if (typeof text !== "string") return null;
  if (findPem(text)) return { form: "F1" };
  if (findUrlPassword(text)) return { form: "F3" };
  const key = findPrefixedKey(text);
  if (key !== null) return { form: key };
  if (findJwt(text)) return { form: "F7" };
  if (findBearer(text)) return { form: "F8" };
  const named = findNamedValue(text);
  return named === null ? null : { form: named };
}
