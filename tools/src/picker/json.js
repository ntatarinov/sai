// A strict JSON reader (design REQ-054, 5.3). It accepts and rejects what JSON.parse
// accepts and rejects, with three differences: a repeated key in one object and nesting
// deeper than MAX_DEPTH are refused, and a failure tells the place as line and column
// instead of an English message. It also records where every member and element
// starts, so that the errors found later can be put in the order of the file.
import { MAX_DEPTH } from "./limits.js";

// The key of a place in the map of positions.
export function positionKey(path) {
  return JSON.stringify(path);
}

// Line: 1 + the number of LF before the offset. Column: 1 + the number of code points
// after the last LF (a CR before an LF belongs to the line it ends).
export function lineColumn(text, offset) {
  const end = Math.min(Math.max(offset, 0), text.length);
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 0x0a) {
      line += 1;
      lineStart = i + 1;
    }
  }
  let column = 1;
  for (let i = lineStart; i < end; i++) {
    const code = text.charCodeAt(i);
    const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;
    const afterHigh =
      i > lineStart &&
      text.charCodeAt(i - 1) >= 0xd800 &&
      text.charCodeAt(i - 1) <= 0xdbff;
    if (!(isLowSurrogate && afterHigh)) column += 1;
  }
  return { line, column };
}

// Thrown inside the reader only and always caught by parseJson.
class Failure {
  constructor(kind, offset, key) {
    this.kind = kind;
    this.offset = offset;
    this.key = key;
  }
}

const isDigit = (c) => c >= 0x30 && c <= 0x39;
const isHex = (c) =>
  isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
// A sign that may not follow a number right away.
const isNumberTail = (c) =>
  isDigit(c) ||
  (c >= 0x41 && c <= 0x5a) ||
  (c >= 0x61 && c <= 0x7a) ||
  c === 0x2e ||
  c === 0x2b ||
  c === 0x2d;

const SIMPLE_ESCAPES = new Map([
  [0x22, '"'],
  [0x5c, "\\"],
  [0x2f, "/"],
  [0x62, "\b"],
  [0x66, "\f"],
  [0x6e, "\n"],
  [0x72, "\r"],
  [0x74, "\t"],
]);

const LITERALS = new Map([
  [0x74, ["true", true]],
  [0x66, ["false", false]],
  [0x6e, ["null", null]],
]);

// parseJson(text) -> { ok: true, value, positions } | { ok: false, kind, offset, line,
// column, key? }. The BOM is removed by the caller; the text has none.
export function parseJson(text) {
  const n = text.length;
  const positions = new Map();
  let pos = 0;

  const passBlanks = () => {
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c !== 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return;
      pos += 1;
    }
  };

  // The code at pos; a Failure of the kind `end` when the text is over.
  const need = () => {
    if (pos >= n) throw new Failure("end", n);
    return text.charCodeAt(pos);
  };

  const readString = () => {
    pos += 1; // the opening quote
    let out = "";
    let from = pos;
    for (;;) {
      const c = need();
      if (c === 0x22) {
        out += text.slice(from, pos);
        pos += 1;
        return out;
      }
      if (c < 0x20) throw new Failure("control", pos);
      if (c !== 0x5c) {
        pos += 1;
        continue;
      }
      out += text.slice(from, pos);
      pos += 1;
      const e = need();
      const simple = SIMPLE_ESCAPES.get(e);
      if (simple !== undefined) {
        out += simple;
        pos += 1;
      } else if (e === 0x75) {
        pos += 1;
        let code = 0;
        for (let k = 0; k < 4; k++) {
          const h = need();
          if (!isHex(h)) throw new Failure("char", pos);
          code = code * 16 + parseInt(text[pos], 16);
          pos += 1;
        }
        out += String.fromCharCode(code);
      } else {
        throw new Failure("char", pos);
      }
      from = pos;
    }
  };

  const readDigits = () => {
    if (!isDigit(need())) throw new Failure("char", pos);
    while (pos < n && isDigit(text.charCodeAt(pos))) pos += 1;
  };

  const readNumber = () => {
    const start = pos;
    if (text.charCodeAt(pos) === 0x2d) pos += 1;
    if (need() === 0x30) pos += 1;
    else readDigits();
    if (pos < n && text.charCodeAt(pos) === 0x2e) {
      pos += 1;
      readDigits();
    }
    if (pos < n && (text.charCodeAt(pos) | 0x20) === 0x65) {
      pos += 1;
      const s = need();
      if (s === 0x2b || s === 0x2d) pos += 1;
      readDigits();
    }
    if (pos < n && isNumberTail(text.charCodeAt(pos)))
      throw new Failure("char", pos);
    return Number(text.slice(start, pos));
  };

  const readLiteral = (word, result) => {
    for (let k = 0; k < word.length; k++) {
      if (need() !== word.charCodeAt(k)) throw new Failure("char", pos);
      pos += 1;
    }
    return result;
  };

  // A value at pos; `level` is the number of containers open around it.
  const readValue = (path, level, markStart) => {
    passBlanks();
    const c = need();
    if (markStart) positions.set(positionKey(path), pos);
    if (c === 0x7b) return readObject(path, level);
    if (c === 0x5b) return readArray(path, level);
    if (c === 0x22) return readString();
    if (c === 0x2d || isDigit(c)) return readNumber();
    const literal = LITERALS.get(c);
    if (literal !== undefined) return readLiteral(literal[0], literal[1]);
    throw new Failure("char", pos);
  };

  const readObject = (path, level) => {
    if (level + 1 > MAX_DEPTH) throw new Failure("depth", pos);
    pos += 1;
    const obj = Object.create(null);
    passBlanks();
    if (need() === 0x7d) {
      pos += 1;
      return obj;
    }
    for (;;) {
      passBlanks();
      if (need() !== 0x22) throw new Failure("char", pos);
      const keyOffset = pos;
      const key = readString();
      if (Object.hasOwn(obj, key)) throw new Failure("dup", keyOffset, key);
      passBlanks();
      if (need() !== 0x3a) throw new Failure("char", pos);
      pos += 1;
      path.push(key);
      positions.set(positionKey(path), keyOffset);
      obj[key] = readValue(path, level + 1, false);
      path.pop();
      passBlanks();
      const c = need();
      pos += 1;
      if (c === 0x7d) return obj;
      if (c !== 0x2c) throw new Failure("char", pos - 1);
    }
  };

  const readArray = (path, level) => {
    if (level + 1 > MAX_DEPTH) throw new Failure("depth", pos);
    pos += 1;
    const list = [];
    passBlanks();
    if (need() === 0x5d) {
      pos += 1;
      return list;
    }
    for (;;) {
      path.push(list.length);
      list.push(readValue(path, level + 1, true));
      path.pop();
      passBlanks();
      const c = need();
      pos += 1;
      if (c === 0x5d) return list;
      if (c !== 0x2c) throw new Failure("char", pos - 1);
    }
  };

  try {
    const value = readValue([], 0, true);
    passBlanks();
    if (pos < n) throw new Failure("trailing", pos);
    return { ok: true, value, positions };
  } catch (err) {
    if (!(err instanceof Failure)) throw err;
    const failure = { ok: false, kind: err.kind, offset: err.offset };
    Object.assign(failure, lineColumn(text, err.offset));
    if (err.kind === "dup") failure.key = err.key;
    return failure;
  }
}
