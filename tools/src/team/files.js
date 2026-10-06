// Result files of a project (design REQ-009, sections 6.6 and 6.7): publishing a
// file in files/ (a temporary .partial-<name> and linkSync, which never replaces an
// existing name) and reading a text file from the work folder of the executor
// without following links.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TeamError, eventError, fromOsError } from "./errors.js";
import { LIMITS, checkResultName, checkWorkPath } from "./schema.js";

const PARTIAL_PREFIX = ".partial-";
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const READ_FLAGS =
  fs.constants.O_RDONLY | NOFOLLOW | (fs.constants.O_NONBLOCK ?? 0);

function fileNameError() {
  return new TeamError("E_FILE_NAME", "Недопустимое имя файла результата");
}

function fileExistsError() {
  return new TeamError("E_FILE_EXISTS", "Файл с таким именем уже есть");
}

function workFileError(reason) {
  return new TeamError(
    "E_WORK_FILE",
    "Файл результата не найден в рабочей папке или недопустим",
    { reason },
  );
}

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function unlinkQuietly(file) {
  try {
    fs.unlinkSync(file);
    return true;
  } catch (err) {
    return err.code === "ENOENT";
  }
}

export function checkName(name) {
  if (!checkResultName(name).ok) throw fileNameError();
}

// files/ must be a real folder (not a link) of the project.
function checkFilesDir(filesDir) {
  let st;
  try {
    st = fs.lstatSync(filesDir);
  } catch (err) {
    throw fromOsError(err, "write");
  }
  if (!st.isDirectory() || st.isSymbolicLink()) {
    throw new TeamError("E_DISK", "Папка файлов результата недоступна", {
      os_code: "ENOTDIR",
    });
  }
}

// The bytes and the sha256 of a (masked) text, checked against FILE_BYTES_MAX.
export function contentOf(content) {
  if (typeof content !== "string") throw eventError("content");
  const buf = Buffer.from(content, "utf8");
  if (buf.length > LIMITS.FILE_BYTES_MAX) throw eventError("content");
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  return { buf, bytes: buf.length, sha256 };
}

// Throws E_FILE_NAME for a bad name and E_FILE_EXISTS when the name is taken.
export function checkFreeName(filesDir, name) {
  checkName(name);
  checkFilesDir(filesDir);
  let st;
  try {
    st = lstatOrNull(path.join(filesDir, name));
  } catch (err) {
    throw fromOsError(err, "read");
  }
  if (st !== null) throw fileExistsError();
}

// Writes files/<name> with the given (already masked) text, mode 0600, never over
// an existing name. Returns { bytes, sha256 }. On failure nothing is left.
export function publishResultFile(filesDir, name, content) {
  const { buf, bytes, sha256 } = contentOf(content);
  checkFreeName(filesDir, name);
  const partial = path.join(filesDir, `${PARTIAL_PREFIX}${name}`);
  const target = path.join(filesDir, name);
  let created = false;
  try {
    fs.writeFileSync(partial, buf, { flag: "wx", mode: 0o600, flush: true });
    created = true;
    try {
      fs.linkSync(partial, target);
    } catch (err) {
      if (err.code === "EEXIST") throw fileExistsError();
      throw err;
    }
    try {
      fs.unlinkSync(partial);
    } catch (err) {
      unlinkQuietly(target);
      throw err;
    }
    created = false;
  } catch (err) {
    if (created) unlinkQuietly(partial);
    if (err instanceof TeamError) throw err;
    throw fromOsError(err, "write");
  }
  return { bytes, sha256 };
}

// Removes a published file again (its event could not be written). true when the
// file is gone.
export function removeResultFile(filesDir, name) {
  return unlinkQuietly(path.join(filesDir, name));
}

// Removes the leftovers .partial-* of a crash.
export function cleanPartials(filesDir) {
  let names;
  try {
    names = fs.readdirSync(filesDir);
  } catch (err) {
    throw fromOsError(err, "read");
  }
  for (const name of names) {
    if (!name.startsWith(PARTIAL_PREFIX)) continue;
    try {
      fs.unlinkSync(path.join(filesDir, name));
    } catch (err) {
      if (err.code !== "ENOENT") throw fromOsError(err, "write");
    }
  }
}

const decoder = new TextDecoder("utf-8", { fatal: true });

// The text of work/<relPath> (section 6.7): the path is checked before any access
// to files; every part is walked with lstat (no links); the file is opened without
// following a link and must be the same file; at most FILE_BYTES_MAX bytes; strict
// UTF-8. Every refusal is E_WORK_FILE.
export function readWorkFile(workDir, relPath) {
  if (!checkWorkPath(relPath).ok) throw workFileError("path");
  const parts = relPath.split("/");
  let current = workDir;
  let st;
  try {
    st = fs.lstatSync(current);
    if (!st.isDirectory() || st.isSymbolicLink()) throw workFileError("work");
    for (let i = 0; i < parts.length; i += 1) {
      current = path.join(current, parts[i]);
      st = fs.lstatSync(current);
      if (st.isSymbolicLink()) throw workFileError("link");
      if (st.isFile() && st.nlink !== 1) throw workFileError("link");
      const last = i === parts.length - 1;
      if (last ? !st.isFile() : !st.isDirectory()) throw workFileError("kind");
    }
  } catch (err) {
    if (err instanceof TeamError) throw err;
    throw workFileError(err && err.code === "ENOENT" ? "missing" : "access");
  }
  if (st.size > LIMITS.FILE_BYTES_MAX) throw workFileError("size");
  let fd;
  try {
    fd = fs.openSync(current, READ_FLAGS);
  } catch {
    throw workFileError("open");
  }
  let buf;
  try {
    const fst = fs.fstatSync(fd);
    if (
      !fst.isFile() ||
      fst.nlink !== 1 ||
      fst.dev !== st.dev ||
      fst.ino !== st.ino ||
      fst.size > LIMITS.FILE_BYTES_MAX
    ) {
      throw workFileError("changed");
    }
    buf = Buffer.alloc(fst.size);
    let got = 0;
    while (got < buf.length) {
      const n = fs.readSync(fd, buf, got, buf.length - got, got);
      if (n <= 0) break;
      got += n;
    }
    if (got !== buf.length) throw workFileError("changed");
  } catch (err) {
    if (err instanceof TeamError) throw err;
    throw workFileError("read");
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Read only; nothing to lose.
    }
  }
  try {
    return decoder.decode(buf);
  } catch {
    throw workFileError("not text");
  }
}
