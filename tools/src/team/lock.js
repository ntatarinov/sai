// The lock of the writer (design REQ-009, section 6.2): one process holds the right
// to write to a project. The lock is created atomically (a temporary file and
// linkSync, which refuses an existing name); a lock whose pid is not alive is stale
// and is taken away by renameSync with a check of its content.
import fs from "node:fs";
import path from "node:path";
import { TeamError, fromOsError } from "./errors.js";
import { LOCK_FILE } from "./home.js";

export { LOCK_FILE };

const LOCK_BYTES_MAX = 4096;
const ROUNDS_MAX = 3;
const NEW_PATTERN = /^writer\.lock\.([0-9]+)\.new$/;
const STALE_PATTERN = /^writer\.lock\.stale-([0-9]+)$/;

function busy(pid) {
  return new TeamError(
    "E_PROJECT_BUSY",
    pid === null
      ? "Проект занят другим процессом"
      : `Проект занят другим процессом (pid ${pid})`,
    { pid },
  );
}

function badLock() {
  return new TeamError(
    "E_LOCK_BAD",
    `Файл-замок проекта повреждён: удалите ${LOCK_FILE} вручную, если проект никто не использует`,
  );
}

function lockLost() {
  return new TeamError(
    "E_LOCK_LOST",
    "Право записи на проект потеряно; откройте проект заново",
  );
}

// true when a process with this pid exists (EPERM: it exists, it is not ours).
export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code !== "ESRCH";
  }
}

// (r13, C4) The only holder a lock may name: the engine of REQ-013.
export const ENGINE_HOLDER = "engine";

// (0026, design ISS-0010 section 4.1) Memory of this process only; nothing of it
// is written to disk. The key is path.resolve(projectDir).
// HELD: the ticket of the last successful acquireLock of this process on a folder.
// ORPHANED: folders whose lock was left by a broken writer of this process that
// was closed while it still held the lock, and not taken again since (R1).
const HELD = new Map();
const ORPHANED = new Set();

function keyOf(projectDir) {
  return path.resolve(projectDir);
}

// (0026 R2) The only place of the rule "the holder is alive": a live pid, except
// the pid of this process on a folder its closed broken writer left behind.
export function holdsLive(pid, projectDir) {
  return (
    isAlive(pid) && !(pid === process.pid && ORPHANED.has(keyOf(projectDir)))
  );
}

// (0026 R1) Called by close() of a broken writer: marks the folder only when this
// writer still holds the lock — its ticket is the last one this process took on
// the folder, and writer.lock is byte for byte what that take wrote. Writes no
// file; never throws (a failed read leaves the folder unmarked).
export function noteOrphanedLock(projectDir, ticket) {
  try {
    const key = keyOf(projectDir);
    if (ticket === undefined || ticket === null) return false;
    if (HELD.get(key) !== ticket) return false;
    const file = path.join(projectDir, LOCK_FILE);
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size > LOCK_BYTES_MAX) return false;
    if (fs.readFileSync(file, "utf8") !== ticket.bytes) return false;
    ORPHANED.add(key);
    return true;
  } catch {
    return false;
  }
}

// The pid in a lock file, or null when there is no file; throws E_LOCK_BAD for a
// lock that is not a small regular file with JSON {"pid": int >= 1}.
function readLockPid(file) {
  const value = readLock(file);
  return value === null ? null : value.pid;
}

// The content of a lock file ({ pid, ...} as JSON), or null when there is no file.
function readLock(file) {
  let st;
  try {
    st = fs.lstatSync(file);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw fromOsError(err, "read");
  }
  if (!st.isFile() || st.size > LOCK_BYTES_MAX) throw badLock();
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw fromOsError(err, "read");
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw badLock();
  }
  if (
    value === null ||
    typeof value !== "object" ||
    !Number.isInteger(value.pid) ||
    value.pid < 1
  ) {
    throw badLock();
  }
  return value;
}

// The pid of the current lock of a project, whether it is alive and who holds it
// (r13, C4: "engine" only for exactly that string, otherwise null), or null.
export function lockHolder(projectDir) {
  const value = readLock(path.join(projectDir, LOCK_FILE));
  if (value === null) return null;
  return {
    pid: value.pid,
    alive: holdsLive(value.pid, projectDir),
    holder: value.holder === ENGINE_HOLDER ? ENGINE_HOLDER : null,
  };
}

function unlinkQuietly(file) {
  try {
    fs.unlinkSync(file);
  } catch {
    // A leftover; the next writer removes it (cleanLockLeftovers).
  }
}

// Takes the right to write. Returns { stalePid, ticket }: the pid of a stale lock
// that was removed, or null, and (0026 R1) the ticket of this take — a frozen
// { bytes } compared by reference, for noteOrphanedLock only. Throws
// E_PROJECT_BUSY, E_LOCK_BAD or E_DISK. holder (r13, C4): "engine" writes
// {"pid","since","holder":"engine"}; null — the former content; any other value
// is a bug of the program. (0026 R2) A lock of this process left by its closed
// broken writer is stale for this process.
export function acquireLock(
  projectDir,
  pid,
  since = new Date().toISOString(),
  holder = null,
) {
  if (holder !== null && holder !== ENGINE_HOLDER) {
    throw new Error("acquireLock: unknown holder");
  }
  const lockFile = path.join(projectDir, LOCK_FILE);
  const tempFile = path.join(projectDir, `${LOCK_FILE}.${pid}.new`);
  const staleFile = path.join(projectDir, `${LOCK_FILE}.stale-${pid}`);
  const body = holder === null ? { pid, since } : { pid, since, holder };
  const content = Buffer.from(`${JSON.stringify(body)}\n`, "utf8");
  let stalePid = null;
  for (let round = 0; round < ROUNDS_MAX; round += 1) {
    // The temporary name carries our own pid: no other live process uses it, so a
    // leftover with it is ours to remove.
    unlinkQuietly(tempFile);
    try {
      fs.writeFileSync(tempFile, content, {
        flag: "wx",
        mode: 0o600,
        flush: true,
      });
    } catch (err) {
      throw fromOsError(err, "write");
    }
    let linked = false;
    try {
      fs.linkSync(tempFile, lockFile);
      linked = true;
    } catch (err) {
      if (err.code !== "EEXIST") {
        unlinkQuietly(tempFile);
        throw fromOsError(err, "write");
      }
    }
    unlinkQuietly(tempFile);
    if (linked) {
      const key = keyOf(projectDir);
      const ticket = Object.freeze({ bytes: content.toString("utf8") });
      HELD.set(key, ticket);
      ORPHANED.delete(key);
      return { stalePid, ticket };
    }

    const holder = readLockPid(lockFile);
    if (holder === null) continue;
    if (holdsLive(holder, projectDir)) throw busy(holder);
    try {
      fs.renameSync(lockFile, staleFile);
    } catch (err) {
      if (err.code === "ENOENT") continue;
      throw fromOsError(err, "write");
    }
    let moved;
    try {
      moved = readLockPid(staleFile);
    } catch {
      moved = null;
    }
    if (moved === holder) {
      unlinkQuietly(staleFile);
      stalePid = holder;
      continue;
    }
    // Between our read and our rename another process took the lock: give it back.
    try {
      fs.linkSync(staleFile, lockFile);
    } catch {
      // EEXIST (F6): a third process took the free name; the lock of the second
      // is lost, and it finds out on its next append (E_LOCK_LOST).
    }
    unlinkQuietly(staleFile);
    throw busy(moved);
  }
  throw busy(null);
}

// Gives the right back: removes the lock only when it holds our pid.
export function releaseLock(projectDir, pid) {
  const lockFile = path.join(projectDir, LOCK_FILE);
  let holder;
  try {
    holder = readLockPid(lockFile);
  } catch {
    return;
  }
  if (holder === pid) unlinkQuietly(lockFile);
}

// Throws E_LOCK_LOST unless writer.lock is a regular file with our pid (F6).
export function assertLockHeld(projectDir, pid) {
  let holder;
  try {
    holder = readLockPid(path.join(projectDir, LOCK_FILE));
  } catch {
    throw lockLost();
  }
  if (holder !== pid) throw lockLost();
}

// Removes temporary and stale lock files whose pid is not alive.
export function cleanLockLeftovers(projectDir) {
  let names;
  try {
    names = fs.readdirSync(projectDir);
  } catch (err) {
    throw fromOsError(err, "read");
  }
  for (const name of names) {
    const m = NEW_PATTERN.exec(name) ?? STALE_PATTERN.exec(name);
    if (m === null) continue;
    const pid = Number(m[1]);
    if (pid >= 1 && Number.isSafeInteger(pid) && isAlive(pid)) continue;
    try {
      fs.unlinkSync(path.join(projectDir, name));
    } catch (err) {
      if (err.code !== "ENOENT") throw fromOsError(err, "write");
    }
  }
}
