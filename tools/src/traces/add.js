// `npm run traces -- add` (design REQ-014, 2.2; decisions/0021, D8): the names from
// stdin become hashes in tools/traces/forbidden-names.sha256. Under a lock, with the
// file read again right before the write, and written only through writeAllOrNothing
// (decisions/0004). No name and no hash is ever printed.
import fs from "node:fs";
import path from "node:path";
import { Issues, isOsError, sha256, writeAllOrNothing } from "../util.js";
import {
  HASHES_HEADER,
  HASHES_REL,
  TraceError,
  decodeUtf8,
  parseHashes,
  parseNames,
  readHashesBytes,
} from "./lists.js";

const INPUT_MAX = 64 * 1024;
const INPUT_WAIT_MS = 30_000;
const RETRY_MS = 20;
const LOCK_REL = "tools/traces/.forbidden-names.sha256.lock";
const FOLDERS = ["tools", "tools/traces"];
const LOCK_TEXT = /^(\d{1,10}) \S+\n?$/u;
const BUSY_LOCK = `идёт другое пополнение; если нет — удалите ${LOCK_REL}`;

// Reads stdin up to one byte over `limit`, so a longer input is refused without
// holding all of it. A non-blocking input (EAGAIN) is polled every 20 ms; `waitMs`
// without a new byte is E_TRACE_NAME (2.2, r3). A blocking input waits for its end.
export function readInput(limit = INPUT_MAX, waitMs = INPUT_WAIT_MS) {
  const chunks = [];
  let total = 0;
  const buf = Buffer.alloc(16 * 1024);
  let lastByte = Date.now();
  for (;;) {
    let n;
    try {
      n = fs.readSync(0, buf, 0, buf.length, null);
    } catch (err) {
      if (!isOsError(err)) throw err;
      if (err.code === "EAGAIN") {
        if (Date.now() - lastByte >= waitMs)
          throw new TraceError(
            "E_TRACE_NAME",
            `ввод не закончился за ${Math.round(waitMs / 1000)} с`,
          );
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_MS);
        continue;
      }
      if (err.code === "EOF") break;
      throw new TraceError("E_TRACE_NAME", `ввод не читается (${err.code})`);
    }
    if (n === 0) break;
    lastByte = Date.now();
    chunks.push(Buffer.from(buf.subarray(0, n)));
    total += n;
    if (total > limit) break;
  }
  return Buffer.concat(chunks);
}

// The names of the input: { names, hashes }; a bad input throws E_TRACE_NAME.
function namesOfInput(bytes) {
  if (bytes.length > INPUT_MAX)
    throw new TraceError("E_TRACE_NAME", "ввод больше 64 КиБ");
  const text = decodeUtf8(bytes);
  if (text === null) throw new TraceError("E_TRACE_NAME", "ввод не в UTF-8");
  const parsed = parseNames(text, "E_TRACE_NAME");
  if (parsed.names === 0)
    throw new TraceError("E_TRACE_NAME", "пустой ввод: нет ни одного названия");
  return parsed;
}

function writeFailure(rel, why, err) {
  const issues = new Issues();
  issues.add("E_WRITE", rel, `${why} (${err.code})`);
  return issues;
}

const OUTSIDE = "папка записи — ссылка или вне репозитория; запись отказана";

// Before the lock and any write (2.2, step 3a, r3): no link on the way to the file of
// hashes, and tools/traces inside the root. Returns null or Issues.
function guardWritePath(root) {
  let folderExists = false;
  for (const rel of [...FOLDERS, HASHES_REL]) {
    let stat;
    try {
      stat = fs.lstatSync(path.join(root, rel));
    } catch (err) {
      if (!isOsError(err)) throw err;
      if (err.code === "ENOENT") break;
      return writeFailure(rel, "cannot be checked", err);
    }
    if (rel === FOLDERS[1]) folderExists = true;
    if (stat.isSymbolicLink()) {
      const issues = new Issues();
      issues.add("E_WRITE", rel, `${OUTSIDE} (ELOOP)`);
      return issues;
    }
  }
  if (!folderExists) return null;
  let realRoot;
  let realFolder;
  try {
    realRoot = fs.realpathSync(root);
    realFolder = fs.realpathSync(path.join(root, FOLDERS[1]));
  } catch (err) {
    if (!isOsError(err)) throw err;
    return writeFailure(FOLDERS[1], "cannot be checked", err);
  }
  const rel = path.relative(realRoot, realFolder);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    const issues = new Issues();
    issues.add("E_WRITE", FOLDERS[1], `${OUTSIDE} (EXDEV)`);
    return issues;
  }
  return null;
}

// The missing folders of the target, created in order; returns the ones this call made.
function makeFolders(root) {
  const made = [];
  for (const rel of FOLDERS) {
    const abs = path.join(root, rel);
    try {
      fs.mkdirSync(abs);
      made.push(abs);
    } catch (err) {
      if (!isOsError(err)) throw err;
      if (err.code === "EEXIST") continue;
      return {
        made,
        issues: writeFailure(rel, "cannot create the folder", err),
      };
    }
  }
  return { made, issues: null };
}

// Removes the folders this call created, newest first, only while they are empty.
function removeFolders(made) {
  for (const abs of [...made].reverse()) {
    try {
      fs.rmdirSync(abs);
    } catch (err) {
      if (!isOsError(err)) throw err;
    }
  }
}

// The OS error of one fs call, or null; a program error still throws.
function osErrorOf(call) {
  try {
    call();
    return null;
  } catch (err) {
    if (!isOsError(err)) throw err;
    return err;
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code !== "ESRCH";
  }
}

// Takes the lock (exclusive create). Returns null when taken, or Issues/TraceError.
function takeLock(root) {
  const abs = path.join(root, LOCK_REL);
  for (let attempt = 0; attempt < 2; attempt++) {
    let fd;
    try {
      fd = fs.openSync(abs, "wx", 0o600);
    } catch (err) {
      if (!isOsError(err)) throw err;
      if (err.code !== "EEXIST")
        return writeFailure(LOCK_REL, "cannot create the lock", err);
      let text;
      try {
        text = fs.readFileSync(abs, "utf8");
      } catch (readErr) {
        if (!isOsError(readErr)) throw readErr;
        if (readErr.code === "ENOENT") continue;
        return new TraceError("E_TRACE_BUSY", BUSY_LOCK);
      }
      const m = LOCK_TEXT.exec(text);
      if (attempt > 0 || m === null || pidAlive(Number(m[1])))
        return new TraceError("E_TRACE_BUSY", BUSY_LOCK);
      try {
        fs.unlinkSync(abs);
      } catch (unlinkErr) {
        if (!isOsError(unlinkErr)) throw unlinkErr;
        if (unlinkErr.code !== "ENOENT")
          return new TraceError("E_TRACE_BUSY", BUSY_LOCK);
      }
      continue;
    }
    let failure = null;
    try {
      fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}\n`);
    } catch (err) {
      failure = err;
    }
    const closeErr = osErrorOf(() => fs.closeSync(fd));
    failure ??= closeErr;
    if (failure === null) return null;
    osErrorOf(() => fs.unlinkSync(abs));
    if (!isOsError(failure)) throw failure;
    return writeFailure(LOCK_REL, "cannot write the lock", failure);
  }
  return new TraceError("E_TRACE_BUSY", BUSY_LOCK);
}

function bytesSha(bytes) {
  return bytes === null ? "none" : sha256(bytes);
}

// Adds the hashes of `inputBytes`. Returns { added, existed } or { issues } (E_WRITE
// lines); throws TraceError for a bad input, a broken file of hashes or a busy lock.
export function addNames(root, inputBytes) {
  const { hashes: incoming } = namesOfInput(inputBytes);
  const guard = guardWritePath(root);
  if (guard !== null) return { issues: guard };
  const folders = makeFolders(root);
  if (folders.issues !== null) {
    removeFolders(folders.made);
    return { issues: folders.issues };
  }
  let locked = false;
  let done = false;
  try {
    const lock = takeLock(root);
    if (lock instanceof TraceError) throw lock;
    if (lock !== null) return { issues: lock };
    locked = true;

    const before = readHashesBytes(root);
    const current = before === null ? [] : parseHashes(decodeUtf8(before));
    const all = new Set(current);
    let added = 0;
    for (const h of incoming) {
      if (!all.has(h)) {
        all.add(h);
        added++;
      }
    }
    const existed = incoming.size - added;
    if (added === 0) {
      done = true;
      return { added, existed };
    }
    const content = `${[HASHES_HEADER, ...[...all].sort()].join("\n")}\n`;

    // Read again right before the write: a change means a write that bypassed the lock.
    if (bytesSha(readHashesBytes(root)) !== bytesSha(before))
      throw new TraceError(
        "E_TRACE_BUSY",
        "файл хешей изменился во время пополнения; повторите",
      );
    const issues = new Issues();
    writeAllOrNothing(root, [{ rel: HASHES_REL, content }], issues);
    if (!issues.empty) return { issues };
    done = true;
    return { added, existed };
  } finally {
    if (locked) {
      const err = osErrorOf(() => fs.unlinkSync(path.join(root, LOCK_REL)));
      if (err !== null)
        process.stderr.write(
          `traces: замок не удалён (${err.code}); удалите ${LOCK_REL}\n`,
        );
    }
    if (!done) removeFolders(folders.made);
  }
}
