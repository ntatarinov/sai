// The journal of a project, events.jsonl (design REQ-009, sections 6.4 and 7.2):
// reading and checking it, appending whole lines with fsync, cutting a broken
// tail. The only places that write it are appendLine and appendBatch (open + one
// write + fsync), truncateTo and their rollback (ftruncate); section 13.
import fs from "node:fs";
import {
  TeamError,
  diskWriteMessage,
  fromOsError,
  isOsError,
  notFoundError,
} from "./errors.js";
import { reduceInPlace } from "./reducer.js";
import { checkEnvelope } from "./schema.js";

const NEWLINE = 0x0a;
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const READ_FLAGS =
  fs.constants.O_RDONLY | NOFOLLOW | (fs.constants.O_NONBLOCK ?? 0);
const APPEND_FLAGS = fs.constants.O_WRONLY | fs.constants.O_APPEND | NOFOLLOW;
const TRUNCATE_FLAGS = fs.constants.O_WRONLY | NOFOLLOW;

function corrupt(line, what) {
  return new TeamError(
    "E_CORRUPT",
    `Журнал проекта повреждён в строке ${line}: ${what}`,
    { line },
  );
}

function closeQuietly(fd) {
  try {
    fs.closeSync(fd);
  } catch {
    // Only a descriptor is lost; the data were written (or nothing was).
  }
}

function readAll(file) {
  let fd;
  try {
    fd = fs.openSync(file, READ_FLAGS);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ELOOP") throw notFoundError();
    throw fromOsError(err, "read");
  }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw notFoundError();
    const chunks = [];
    let total = 0;
    const chunk = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const got = fs.readSync(fd, chunk, 0, chunk.length, total);
      if (got <= 0) break;
      chunks.push(Buffer.from(chunk.subarray(0, got)));
      total += got;
    }
    return Buffer.concat(chunks, total);
  } catch (err) {
    throw fromOsError(err, "read");
  } finally {
    closeQuietly(fd);
  }
}

const decoder = new TextDecoder("utf-8", { fatal: true });

function parseLine(buf) {
  try {
    return { ok: true, value: JSON.parse(decoder.decode(buf)) };
  } catch {
    return { ok: false };
  }
}

// Reads and checks the whole journal without changing anything.
// { events, state, tail: { line, bytes } | null, bytes } — bytes is the length of
// the whole lines (where a writer cuts a broken tail). expectedId: the first line
// must belong to this project, otherwise "not found" (section 7.1).
export function readJournal(file, expectedId = null) {
  const buf = readAll(file);
  if (buf.length === 0) throw notFoundError();
  const lines = [];
  let start = 0;
  for (;;) {
    const at = buf.indexOf(NEWLINE, start);
    if (at === -1) break;
    lines.push({ from: start, to: at + 1, body: buf.subarray(start, at) });
    start = at + 1;
  }
  let tail = null;
  let goodEnd = start;
  if (start < buf.length) {
    tail = { line: lines.length + 1, bytes: buf.length - start };
  }
  const parsed = lines.map((l) => parseLine(l.body));
  // A last whole line that is not JSON is a broken tail too.
  if (tail === null && lines.length > 0 && !parsed[lines.length - 1].ok) {
    const last = lines.pop();
    parsed.pop();
    tail = { line: lines.length + 1, bytes: last.to - last.from };
    goodEnd = last.from;
  }
  if (lines.length === 0) throw notFoundError();
  const first = parsed[0];
  if (
    first.ok &&
    expectedId !== null &&
    (first.value === null ||
      typeof first.value !== "object" ||
      first.value.project !== expectedId)
  ) {
    throw notFoundError();
  }
  const events = [];
  let state = null;
  for (let i = 0; i < lines.length; i += 1) {
    const n = i + 1;
    if (!parsed[i].ok) throw corrupt(n, "строка не JSON");
    const event = parsed[i].value;
    try {
      checkEnvelope(event);
    } catch (err) {
      throw corrupt(n, err.message);
    }
    if (event.seq !== n)
      throw corrupt(n, "номер события не равен номеру строки");
    try {
      state = reduceInPlace(state, event);
    } catch (err) {
      if (err instanceof TeamError) throw corrupt(n, err.message);
      throw err;
    }
    events.push(event);
  }
  return { events, state, tail, bytes: goodEnd };
}

function writeAll(fd, buf) {
  let offset = 0;
  while (offset < buf.length) {
    const n = fs.writeSync(fd, buf, offset, buf.length - offset);
    if (!Number.isInteger(n) || n <= 0) {
      throw Object.assign(new Error("short write"), { code: "EIO" });
    }
    offset += n;
  }
}

// Appends whole lines as one write (section 6.4, step 7): the lock check, the
// size check, the write, fsync. On a failed write or fsync the file is cut back
// to expectedBytes (ftruncate + fsync), so either all the lines are written or
// the journal is as it was. Any throw means the writer must be treated as broken.
function appendBytes(file, expectedBytes, buf, lockCheck) {
  lockCheck();
  let fd;
  try {
    fd = fs.openSync(file, APPEND_FLAGS);
  } catch (err) {
    throw fromOsError(err, "write");
  }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.size !== expectedBytes) {
      throw new TeamError(
        "E_CONFLICT",
        "Журнал изменён другим процессом; откройте проект заново",
      );
    }
  } catch (err) {
    closeQuietly(fd);
    if (err instanceof TeamError) throw err;
    throw fromOsError(err, "write");
  }
  try {
    writeAll(fd, buf);
    fs.fsyncSync(fd);
  } catch (err) {
    let rollback = "ok";
    try {
      fs.ftruncateSync(fd, expectedBytes);
      fs.fsyncSync(fd);
    } catch {
      rollback = "failed";
    }
    closeQuietly(fd);
    if (!isOsError(err)) throw err;
    const code = err.code;
    throw new TeamError(
      "E_DISK",
      diskWriteMessage(code, rollback === "failed"),
      {
        os_code: code,
        rollback,
      },
    );
  }
  closeQuietly(fd);
  return expectedBytes + buf.length;
}

// Appends one line; returns the new length of the journal.
export function appendLine(file, expectedBytes, line, lockCheck) {
  return appendBytes(file, expectedBytes, Buffer.from(line, "utf8"), lockCheck);
}

// Appends several whole lines as one batch (recovery, section 6.3, step 8): one
// write of their concatenation, one fsync, one rollback; all or nothing.
export function appendBatch(file, expectedBytes, lines, lockCheck) {
  const buf = Buffer.from(lines.join(""), "utf8");
  return appendBytes(file, expectedBytes, buf, lockCheck);
}

// Cuts the journal to `bytes` (a broken tail, section 6.3 step 8.1) and syncs.
export function truncateTo(file, bytes) {
  let fd;
  try {
    fd = fs.openSync(file, TRUNCATE_FLAGS);
  } catch (err) {
    throw fromOsError(err, "write");
  }
  try {
    fs.ftruncateSync(fd, bytes);
    fs.fsyncSync(fd);
  } catch (err) {
    throw fromOsError(err, "write");
  } finally {
    closeQuietly(fd);
  }
}
