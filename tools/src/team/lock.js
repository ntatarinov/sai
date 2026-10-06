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

// The pid in a lock file, or null when there is no file; throws E_LOCK_BAD for a
// lock that is not a small regular file with JSON {"pid": int >= 1}.
function readLockPid(file) {
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
  return value.pid;
}

// The pid of the current lock of a project and whether it is alive, or null.
export function lockHolder(projectDir) {
  const pid = readLockPid(path.join(projectDir, LOCK_FILE));
  return pid === null ? null : { pid, alive: isAlive(pid) };
}

function unlinkQuietly(file) {
  try {
    fs.unlinkSync(file);
  } catch {
    // A leftover; the next writer removes it (cleanLockLeftovers).
  }
}

// Takes the right to write. Returns { stalePid } — the pid of a stale lock that
// was removed, or null. Throws E_PROJECT_BUSY, E_LOCK_BAD or E_DISK.
export function acquireLock(projectDir, pid, since = new Date().toISOString()) {
  const lockFile = path.join(projectDir, LOCK_FILE);
  const tempFile = path.join(projectDir, `${LOCK_FILE}.${pid}.new`);
  const staleFile = path.join(projectDir, `${LOCK_FILE}.stale-${pid}`);
  const content = Buffer.from(`${JSON.stringify({ pid, since })}\n`, "utf8");
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
    if (linked) return { stalePid };

    const holder = readLockPid(lockFile);
    if (holder === null) continue;
    if (isAlive(holder)) throw busy(holder);
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
