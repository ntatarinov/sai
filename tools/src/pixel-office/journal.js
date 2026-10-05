// The event journal and the server-start records (design 2.2, 3.1, 3.4).
// events.jsonl is only ever appended to; this module has no way to rewrite it.
// Every OS error becomes JournalWriteError or JournalReadError (AP-014).
import fs from "node:fs";
import path from "node:path";
import { EVENTS_FILE, STARTS_FILE } from "./config.js";
import { SOURCE_REAL, isCanonicalTime, parseLine } from "./public/schema.js";

// The journal (or the start records) cannot be appended to: read-only file,
// full disk, missing directory. code is the OS code, for example EACCES.
export class JournalWriteError extends Error {
  constructor(code, file = EVENTS_FILE) {
    super(`Не удалось дописать файл ${file} (${code})`);
    this.name = "JournalWriteError";
    this.code = code;
  }
}

// The journal (or the start records) cannot be read: EACCES, EISDIR, EIO...
export class JournalReadError extends Error {
  constructor(code, file = EVENTS_FILE) {
    super(`Не удалось прочитать файл ${file} (${code})`);
    this.name = "JournalReadError";
    this.code = code;
  }
}

const NEWLINE = 0x0a;
// The index of line starts is built from the file in pieces of this size.
const SCAN_CHUNK = 1024 * 1024;
// lastOwnerPrompt reads the journal from the end in batches of this many lines.
const BACK_BATCH = 512;

// Opening the journal and the start records: a link in the last path component
// is refused (ELOOP) instead of followed, so nothing is read from or appended
// to another file through a link; a pipe does not block the open.
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const APPEND_FLAGS =
  fs.constants.O_RDWR | fs.constants.O_APPEND | fs.constants.O_CREAT | NOFOLLOW;
const READ_FLAGS =
  fs.constants.O_RDONLY | NOFOLLOW | (fs.constants.O_NONBLOCK ?? 0);

function osCode(err) {
  return err && typeof err.code === "string" ? err.code : "EIO";
}

// Error code for something that is not a regular file (stat of the path itself).
function notRegular(st) {
  if (st.isSymbolicLink()) return "ELOOP";
  return st.isDirectory() ? "EISDIR" : "ENOTFILE";
}

function writeAll(fd, buf) {
  let offset = 0;
  while (offset < buf.length) {
    const n = fs.writeSync(fd, buf, offset, buf.length - offset);
    if (n <= 0) throw Object.assign(new Error("short write"), { code: "EIO" });
    offset += n;
  }
}

// Appends text in one write in append mode (the file is created with mode
// 0600). If the file does not end with a line break (a cut-off write, a hand
// edit), a line break goes first, in the same write: the broken tail becomes a
// separate corrupt line instead of being glued to the new one.
function appendText(file, name, text) {
  let fd;
  try {
    fd = fs.openSync(file, APPEND_FLAGS, 0o600);
  } catch (err) {
    throw new JournalWriteError(osCode(err), name);
  }
  let failure = null;
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) {
      throw Object.assign(new Error("not a regular file"), {
        code: notRegular(st),
      });
    }
    let data = text;
    if (st.size > 0) {
      const last = Buffer.alloc(1);
      const got = fs.readSync(fd, last, 0, 1, st.size - 1);
      if (got === 1 && last[0] !== NEWLINE) data = `\n${text}`;
    }
    writeAll(fd, Buffer.from(data, "utf8"));
  } catch (err) {
    failure = err;
  }
  try {
    fs.closeSync(fd);
  } catch (err) {
    failure ??= err;
  }
  if (failure !== null) throw new JournalWriteError(osCode(failure), name);
}

// The text of a regular file, read through a descriptor that was opened
// without following a link; null when there is no such file. Throws the OS
// error otherwise (ELOOP for a link, EISDIR or ENOTFILE for another kind of file).
function readRegularText(file) {
  let fd = null;
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile()) {
      throw Object.assign(new Error("not a regular file"), {
        code: notRegular(st),
      });
    }
    fd = fs.openSync(file, READ_FLAGS);
    if (!fs.fstatSync(fd).isFile()) {
      throw Object.assign(new Error("not a regular file"), {
        code: "ENOTFILE",
      });
    }
    return fs.readFileSync(fd, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Nothing was written: there is nothing to lose by a failed close.
      }
    }
  }
}

function defaultWarn(message) {
  process.stderr.write(`${message}\n`);
}

// options = { warn }: where warnings go; by default the stderr of the process.
export function createJournal(dir, options = {}) {
  const warn = typeof options.warn === "function" ? options.warn : defaultWarn;
  const eventsFile = path.join(dir, EVENTS_FILE);
  const startsFile = path.join(dir, STARTS_FILE);

  // Index of the journal file: offsets[i] is the byte offset where line i
  // starts; consumed is the offset after the last complete line (a tail
  // without a line break is not a line yet). New bytes are scanned on demand;
  // a file that became shorter or was replaced is scanned again from the start.
  const index = { dev: null, ino: null, consumed: 0, offsets: [] };
  const warnedLines = new Set();
  const warnedStarts = new Set();

  function resetIndex() {
    index.dev = null;
    index.ino = null;
    index.consumed = 0;
    index.offsets = [];
    warnedLines.clear();
  }

  function scanNewBytes(size) {
    let fd;
    try {
      fd = fs.openSync(eventsFile, READ_FLAGS);
    } catch (err) {
      throw new JournalReadError(osCode(err), EVENTS_FILE);
    }
    let failure = null;
    try {
      const chunk = Buffer.allocUnsafe(
        Math.min(SCAN_CHUNK, size - index.consumed),
      );
      let position = index.consumed;
      let lineStart = index.consumed;
      while (position < size) {
        const want = Math.min(chunk.length, size - position);
        const got = fs.readSync(fd, chunk, 0, want, position);
        if (got <= 0) break;
        const view = chunk.subarray(0, got);
        let from = 0;
        for (;;) {
          const at = view.indexOf(NEWLINE, from);
          if (at === -1) break;
          index.offsets.push(lineStart);
          lineStart = position + at + 1;
          index.consumed = lineStart;
          from = at + 1;
        }
        position += got;
      }
    } catch (err) {
      failure = err;
    }
    try {
      fs.closeSync(fd);
    } catch (err) {
      failure ??= err;
    }
    if (failure !== null) {
      throw new JournalReadError(osCode(failure), EVENTS_FILE);
    }
  }

  function refresh() {
    let st;
    try {
      st = fs.lstatSync(eventsFile);
    } catch (err) {
      if (err.code === "ENOENT") {
        resetIndex();
        return;
      }
      throw new JournalReadError(osCode(err), EVENTS_FILE);
    }
    if (!st.isFile()) {
      throw new JournalReadError(notRegular(st), EVENTS_FILE);
    }
    if (
      st.dev !== index.dev ||
      st.ino !== index.ino ||
      st.size < index.consumed
    ) {
      resetIndex();
      index.dev = st.dev;
      index.ino = st.ino;
    }
    if (st.size > index.consumed) scanNewBytes(st.size);
  }

  // Raw texts of lines [from, end), or null when the file no longer matches
  // the index (it was edited under us).
  function readLines(from, end) {
    const startByte = index.offsets[from];
    const endByte =
      end < index.offsets.length ? index.offsets[end] : index.consumed;
    const buf = Buffer.allocUnsafe(endByte - startByte);
    let fd;
    try {
      fd = fs.openSync(eventsFile, READ_FLAGS);
    } catch (err) {
      throw new JournalReadError(osCode(err), EVENTS_FILE);
    }
    let failure = null;
    let filled = 0;
    try {
      while (filled < buf.length) {
        const got = fs.readSync(
          fd,
          buf,
          filled,
          buf.length - filled,
          startByte + filled,
        );
        if (got <= 0) break;
        filled += got;
      }
    } catch (err) {
      failure = err;
    }
    try {
      fs.closeSync(fd);
    } catch (err) {
      failure ??= err;
    }
    if (failure !== null) {
      throw new JournalReadError(osCode(failure), EVENTS_FILE);
    }
    if (filled !== buf.length) return null;
    const parts = buf.toString("utf8").split("\n");
    if (parts.length !== end - from + 1 || parts[parts.length - 1] !== "") {
      return null;
    }
    parts.pop();
    return parts;
  }

  function corruptLine(number) {
    if (!warnedLines.has(number)) {
      warnedLines.add(number);
      warn(`Pixel Office: строка журнала ${number} испорчена и пропущена`);
    }
    return null;
  }

  function parseEventLine(text, number) {
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      return corruptLine(number);
    }
    const line = parseLine(value);
    return line === null ? corruptLine(number) : line;
  }

  function isNonNegativeInteger(n) {
    return Number.isSafeInteger(n) && n >= 0;
  }

  function parseStart(text, number) {
    let value = null;
    try {
      value = JSON.parse(text);
    } catch {
      // Falls through to the warning below.
    }
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      isCanonicalTime(value.time) &&
      isNonNegativeInteger(value.journal_lines)
    ) {
      return { time: value.time, journal_lines: value.journal_lines };
    }
    if (!warnedStarts.has(number)) {
      warnedStarts.add(number);
      warn(
        `Pixel Office: запись запуска сервера ${number} испорчена и пропущена`,
      );
    }
    return null;
  }

  // Number of complete lines in the journal; 0 when there is no file.
  function lineCount() {
    refresh();
    return index.offsets.length;
  }

  return {
    // Appends one line (an object) to the journal.
    append(line) {
      appendText(eventsFile, EVENTS_FILE, `${JSON.stringify(line)}\n`);
    },

    // Lines from number `after` (from 0): {lines, from, events}. lines is the
    // number of complete lines now; from is the number of the first returned
    // line (0 when `after` is not an integer inside [0, lines]); events has one
    // element per line, at most `limit` of them when it is given: the line
    // object, or null for a corrupt line.
    read(after, limit) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        refresh();
        const lines = index.offsets.length;
        const from =
          Number.isInteger(after) && after >= 0 && after <= lines ? after : 0;
        const room = Number.isInteger(limit) && limit >= 0 ? limit : lines;
        const end = Math.min(lines, from + room);
        if (end <= from) return { lines, from, events: [] };
        const texts = readLines(from, end);
        if (texts === null) {
          resetIndex();
          continue;
        }
        const events = texts.map((text, i) => parseEventLine(text, from + i));
        return { lines, from, events };
      }
      throw new JournalReadError("EIO", EVENTS_FILE);
    },

    // The last line in file order (not by time) that is an owner message: a
    // hook UserPromptSubmit with source REAL and prompt_kind "owner"; of the
    // given session when sessionId is not null, of any session when it is
    // null (REQ-008 5.3). {time, session_id} or null. Reads from the end in
    // batches through the index of line starts and stops at the first match;
    // corrupt lines are skipped as in read.
    lastOwnerPrompt(sessionId) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        refresh();
        let end = index.offsets.length;
        let stale = false;
        while (end > 0) {
          const from = Math.max(0, end - BACK_BATCH);
          const texts = readLines(from, end);
          if (texts === null) {
            resetIndex();
            stale = true;
            break;
          }
          for (let i = texts.length - 1; i >= 0; i -= 1) {
            const line = parseEventLine(texts[i], from + i);
            if (
              line !== null &&
              line.hook_event_name === "UserPromptSubmit" &&
              line.source === SOURCE_REAL &&
              line.prompt_kind === "owner" &&
              (sessionId === null || line.session_id === sessionId)
            ) {
              return { time: line.time, session_id: line.session_id };
            }
          }
          end = from;
        }
        if (!stale) return null;
      }
      throw new JournalReadError("EIO", EVENTS_FILE);
    },

    // Appends {time, journal_lines} to the server-start records: the clock of
    // the server and the number of complete journal lines at this moment.
    recordStart(nowIso) {
      if (!isCanonicalTime(nowIso)) {
        throw new TypeError("recordStart needs a canonical ISO time");
      }
      const record = { time: nowIso, journal_lines: lineCount() };
      appendText(startsFile, STARTS_FILE, `${JSON.stringify(record)}\n`);
      return record;
    },

    // All server-start records in order; a corrupt record is skipped with a
    // warning. No file: an empty list.
    starts() {
      let text;
      try {
        text = readRegularText(startsFile);
      } catch (err) {
        throw new JournalReadError(osCode(err), STARTS_FILE);
      }
      if (text === null) return [];
      const pieces = text.split("\n");
      pieces.pop();
      const out = [];
      pieces.forEach((piece, i) => {
        const record = parseStart(piece, i);
        if (record !== null) out.push(record);
      });
      return out;
    },

    lineCount,
  };
}
