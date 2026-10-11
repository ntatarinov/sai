// Lines of the fields of a handoff (design REQ-038, 4.2 and 4.3): the text of a JSON
// file that has already been parsed is scanned once; for a path of a field the line of
// its key (of the start of its value in an array), and for a line its string tokens.
const KEY_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/u;

// The path of a field as printed and as written in the file of exceptions: `$` for the
// whole file, keys through a point, an index of an array as `[N]`; a key outside the
// grammar is written as `?`.
export function fieldPath(segments) {
  if (segments.length === 0) return "$";
  let out = "";
  segments.forEach((segment, i) => {
    if (typeof segment === "number") out += `[${segment}]`;
    else {
      const key = KEY_SEGMENT.test(segment) ? segment : "?";
      out += i === 0 ? key : `.${key}`;
    }
  });
  return out;
}

const EMPTY = {
  lineOf: () => 1,
  tokensOnLine: () => [],
};

// The scanner works only on valid JSON; on any text it cannot follow it answers as for a
// file that is not JSON.
export function locate(text) {
  const lines = new Map();
  const tokens = new Map();
  let i = 0;
  let line = 1;

  const eatSpace = () => {
    for (;;) {
      const c = text[i];
      if (c === "\n") line++;
      else if (c !== " " && c !== "\t" && c !== "\r") return;
      i++;
    }
  };

  // Reads a string at `i`; returns its raw text and, when asked, its decoded value.
  const readString = (decode) => {
    const start = i;
    i++;
    while (text[i] !== '"') {
      if (text[i] === undefined) throw new Error("unterminated");
      i += text[i] === "\\" ? 2 : 1;
    }
    i++;
    const raw = text.slice(start, i);
    return { raw, value: decode ? JSON.parse(raw) : undefined };
  };

  const addToken = (raw, segments) => {
    if (!tokens.has(line)) tokens.set(line, []);
    tokens.get(line).push({ raw, path: fieldPath(segments), segments });
  };

  const readValue = (segments) => {
    eatSpace();
    const c = text[i];
    if (c === "{") {
      i++;
      eatSpace();
      if (text[i] === "}") {
        i++;
        return;
      }
      for (;;) {
        eatSpace();
        const keyLine = line;
        const key = readString(true);
        const child = [...segments, key.value];
        lines.set(fieldPath(child), keyLine);
        addToken(key.raw, child);
        eatSpace();
        if (text[i] !== ":") throw new Error("colon");
        i++;
        readValue(child);
        eatSpace();
        if (text[i] === ",") i++;
        else if (text[i] === "}") {
          i++;
          return;
        } else throw new Error("object");
      }
    }
    if (c === "[") {
      i++;
      eatSpace();
      if (text[i] === "]") {
        i++;
        return;
      }
      for (let index = 0; ; index++) {
        eatSpace();
        const child = [...segments, index];
        lines.set(fieldPath(child), line);
        readValue(child);
        eatSpace();
        if (text[i] === ",") i++;
        else if (text[i] === "]") {
          i++;
          return;
        } else throw new Error("array");
      }
    }
    if (c === '"') {
      const s = readString(false);
      addToken(s.raw, segments);
      return;
    }
    const start = i;
    while (i < text.length && !",]} \t\r\n".includes(text[i])) i++;
    if (i === start) throw new Error("value");
  };

  try {
    readValue([]);
  } catch {
    return EMPTY;
  }
  return {
    lineOf: (path) => lines.get(path) ?? 1,
    tokensOnLine: (n) => tokens.get(n) ?? [],
  };
}
