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
