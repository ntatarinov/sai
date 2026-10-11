// The rules of a trace in one line of source text (design REQ-014, 3.2 and 3.4): a path
// of a home folder, its encoded form in the name of a Claude Code project folder, and a
// Markdown link that leaves the root of the repository. Both work on the source text,
// not on the normalized one (3.1, step 0).
import { posix } from "node:path";

// (a) "/Users/<name>" or "/home/<name>": nothing or a character outside [A-Za-z0-9._-]
// before the first "/", at least one character of [A-Za-z0-9._-] after the second.
const HOME_PATH = /(?:^|[^A-Za-z0-9._-])\/(?:Users|home)\/[A-Za-z0-9._-]/u;
// (a2) "-Users-<name>-" or "-home-<name>-": nothing or a character outside [A-Za-z0-9]
// before the first "-", a name of [A-Za-z0-9._] and a "-" right after it.
const HOME_ENCODED = /(?:^|[^A-Za-z0-9])-(?:Users|home)-[A-Za-z0-9._]+-/u;

export function hasHomePath(line) {
  return HOME_PATH.test(line) || HOME_ENCODED.test(line);
}

// (b) A root of a temporary folder with a name after it (design REQ-038, 5.5): the
// first "/" of the root stands at the start or after a character outside
// [A-Za-z0-9._-], and at least one character of [A-Za-z0-9._-] follows the root and "/".
const TEMP_ROOT =
  /\/(?:private\/tmp|private\/var\/folders|var\/folders|tmp)\/(?=[A-Za-z0-9._-])/gu;

// Not a trace: the root stands right after a placeholder in angle brackets. One pass:
// the last "<" and the last ">" before the closing ">" are remembered while the matches
// are walked in order, so the time is linear in the length of the text.
export function hasTempPath(text) {
  let scanned = 0;
  let lastLt = -1;
  let lastGt = -1;
  for (const m of text.matchAll(TEMP_ROOT)) {
    if (m.index === 0) return true;
    const before = text[m.index - 1];
    if (/[A-Za-z0-9._-]/u.test(before)) continue;
    if (before === ">") {
      for (; scanned < m.index - 1; scanned += 1) {
        if (text[scanned] === "<") lastLt = scanned;
        else if (text[scanned] === ">") lastGt = scanned;
      }
      if (lastLt >= 0 && m.index - 1 - lastLt >= 2 && lastGt < lastLt) continue;
    }
    return true;
  }
  return false;
}

export function isMarkdown(rel) {
  return rel.toLowerCase().endsWith(".md");
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/u;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
const DEFINITION = /^ {0,3}\[((?:[^\]\\]|\\.)+)\]:/u;
const HEX2 = /^[0-9A-Fa-f]{2}$/u;

// A longer line is not parsed for links (3.4, r3): a note, the code does not change.
export const MAX_LINE_CHARS = 100_000;

function isSpace(c) {
  return c === " " || c === "\t";
}

// The first index >= i where `test(i)` holds, for every i (len when none): one pass from
// the end, so every lookup below is O(1) and a line is parsed in linear time (3.4, r3).
function nextWhere(len, test) {
  const next = new Int32Array(len + 1);
  next[len] = len;
  for (let i = len - 1; i >= 0; i--) next[i] = test(i) ? i : next[i + 1];
  return next;
}

// The first index >= `from` in the sorted array `list`, or undefined.
function firstAtLeast(list, from) {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < from) lo = mid + 1;
    else hi = mid;
  }
  return list[lo];
}

// The tables of one line for destinations and titles. `esc[i]`: the character is
// escaped by a backslash (counted from the start of the line, as in a destination).
function destinationTables(line) {
  const len = line.length;
  const esc = new Uint8Array(len + 1);
  for (let i = 1; i <= len; i++)
    esc[i] = line[i - 1] === "\\" && esc[i - 1] === 0 ? 1 : 0;
  const plain = (i, ch) => line[i] === ch && esc[i] === 0;
  // depth[i]: unescaped "(" minus unescaped ")" before i; closers: by depth before them.
  const depth = new Int32Array(len + 1);
  const closers = new Map();
  for (let i = 0; i < len; i++) {
    let d = depth[i];
    if (plain(i, "(")) d++;
    else if (plain(i, ")")) {
      if (!closers.has(d)) closers.set(d, []);
      closers.get(d).push(i);
      d--;
    }
    depth[i + 1] = d;
  }
  return {
    len,
    depth,
    closers,
    space: nextWhere(len, (i) => isSpace(line[i]) && esc[i] === 0),
    nonSpace: nextWhere(len, (i) => !isSpace(line[i])),
    gt: nextWhere(len, (i) => line[i] === ">"),
    lt: nextWhere(len, (i) => line[i] === "<"),
    title: {
      '"': nextWhere(len, (i) => plain(i, '"')),
      "'": nextWhere(len, (i) => plain(i, "'")),
      ")": nextWhere(len, (i) => plain(i, ")")),
    },
  };
}

// A destination and an optional title starting at `p` (3.4, kinds 1 and 2). Returns
// { dest, end } where `end` is the index after the title and the spaces, or null when
// the text does not have this form.
function destinationAndTitle(line, t, p) {
  let i = p <= t.len ? t.nonSpace[p] : t.len;
  let dest;
  if (line[i] === "<") {
    const close = t.gt[i + 1];
    if (close === t.len) return null;
    if (t.lt[i + 1] < close) return null;
    dest = line.slice(i + 1, close);
    i = close + 1;
  } else {
    const start = i;
    const ws = t.space[start];
    // The first ")" at depth 0 from `start` ends the destination.
    const closer = firstAtLeast(t.closers.get(t.depth[start]) ?? [], start);
    if (closer !== undefined && closer < ws) i = closer;
    else {
      i = ws;
      if (t.depth[ws] !== t.depth[start]) return null;
    }
    dest = line.slice(start, i);
  }
  const beforeTitle = i;
  i = t.nonSpace[i];
  const closerOf = { '"': '"', "'": "'", "(": ")" }[line[i]];
  if (closerOf !== undefined && i > beforeTitle) {
    const j = t.title[closerOf][i + 1];
    if (j === t.len) return null;
    i = t.nonSpace[j + 1];
  }
  return { dest, end: i };
}

// One pass over a line: escapes, code spans and pairs of brackets. Returns `opener`
// (a "[" that opens text) and `match` (its "]", or -1).
function bracketTables(line) {
  const len = line.length;
  // The maximal runs of backticks, by length: a code span closes at the next run of
  // exactly the same length (3.4, "Код в строке").
  const runsByLength = new Map();
  for (let i = 0; i < len;) {
    if (line[i] !== "`") {
      i++;
      continue;
    }
    let j = i;
    while (line[j] === "`") j++;
    if (!runsByLength.has(j - i)) runsByLength.set(j - i, []);
    runsByLength.get(j - i).push(i);
    i = j;
  }
  const opener = new Uint8Array(len);
  const match = new Int32Array(len).fill(-1);
  const stack = [];
  for (let i = 0; i < len;) {
    const c = line[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "`") {
      let j = i;
      while (line[j] === "`") j++;
      const close = firstAtLeast(runsByLength.get(j - i), j);
      i = close === undefined ? j : close + (j - i);
      continue;
    }
    if (c === "[") {
      opener[i] = 1;
      stack.push(i);
    } else if (c === "]" && stack.length > 0) match[stack.pop()] = i;
    i++;
  }
  return { opener, match };
}

// The bytes of `text` with every %XX decoded, as strict UTF-8; null when a "%" is not
// followed by two hex digits or the bytes are not valid UTF-8 (3.4, "Адрес").
function percentDecode(text) {
  const bytes = [];
  for (let i = 0; i < text.length;) {
    if (text[i] === "%") {
      const pair = text.slice(i + 1, i + 3);
      if (!HEX2.test(pair)) return null;
      bytes.push(Number.parseInt(pair, 16));
      i += 3;
      continue;
    }
    const cp = text.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    bytes.push(...Buffer.from(ch, "utf8"));
    i += ch.length;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    return null;
  }
}

// "ok" (not checked or inside), "out" (a trace) or "unparsed" (a broken %XX).
function judgeAddress(fileRel, raw) {
  const unescaped = raw.replace(/\\(.)/gsu, "$1");
  if (unescaped === "" || SCHEME.test(unescaped) || unescaped.startsWith("#"))
    return "ok";
  const cut = unescaped.search(/[#?]/u);
  const bare = cut === -1 ? unescaped : unescaped.slice(0, cut);
  const decoded = percentDecode(bare);
  if (decoded === null) return "unparsed";
  if (decoded.startsWith("/") || decoded.startsWith("~")) return "out";
  const resolved = posix.normalize(posix.join(posix.dirname(fileRel), decoded));
  return resolved === ".." || resolved.startsWith("../") ? "out" : "ok";
}

// The addresses of one line outside a fenced block: the definition, or every inline
// link and image (nested ones too). Linear in the length of the line.
function lineAddresses(line) {
  if (!line.includes("[")) return [];
  let tables = null;
  const dest = () => (tables ??= destinationTables(line));
  const def = DEFINITION.exec(line);
  if (def !== null) {
    const after = def[0].length;
    if (isSpace(line[after])) {
      const parsed = destinationAndTitle(line, dest(), after);
      if (parsed !== null && parsed.end === line.length) return [parsed.dest];
    }
  }
  const { opener, match } = bracketTables(line);
  const out = [];
  const jumps = new Map();
  for (let i = 0; i < line.length;) {
    const jump = jumps.get(i);
    if (jump !== undefined) {
      i = jump;
      continue;
    }
    if (opener[i] === 1) {
      const close = match[i];
      if (close !== -1 && line[close + 1] === "(") {
        const parsed = destinationAndTitle(line, dest(), close + 2);
        if (parsed !== null && line[parsed.end] === ")") {
          out.push(parsed.dest);
          // The text is scanned for nested links; the destination is skipped.
          jumps.set(close, parsed.end + 1);
        }
      }
    }
    i++;
  }
  return out;
}

// Per line of a Markdown file (from 1): "out" when a link leaves the root, "unparsed"
// when an address cannot be decoded, "long" when the line is not parsed for links.
// Returns { out: number[], unparsed: number[], long: number[] }.
export function markdownLinks(fileRel, lines) {
  const out = [];
  const unparsed = [];
  const long = [];
  let fence = null;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (fence !== null) {
      const m = /^ {0,3}(`+|~+) *$/u.exec(line);
      if (m !== null && m[1][0] === fence.ch && m[1].length >= fence.len)
        fence = null;
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open !== null && !(open[1][0] === "`" && open[2].includes("`"))) {
      fence = { ch: open[1][0], len: open[1].length };
      continue;
    }
    if (line.length > MAX_LINE_CHARS) {
      long.push(n + 1);
      continue;
    }
    let isOut = false;
    let isUnparsed = false;
    for (const dest of lineAddresses(line)) {
      const verdict = judgeAddress(fileRel, dest);
      if (verdict === "out") isOut = true;
      else if (verdict === "unparsed") isUnparsed = true;
    }
    if (isOut) out.push(n + 1);
    if (isUnparsed) unparsed.push(n + 1);
  }
  return { out, unparsed, long };
}
