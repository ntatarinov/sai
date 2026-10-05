// State directory of Pixel Office: location, permissions, the write secret and
// small files (design 2.2, 3.1). Every OS error here becomes a StateDirError
// with a message for the owner; callers never see a raw fs exception (AP-014).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ENV_STATE_DIR, SECRET_FILE, STATE_DIR_NAME } from "./config.js";

// Codes: E_STATE_PATH (bad path in the environment), E_STATE_DIR (the directory
// or a file in it is unusable), E_SECRET_SHORT (secret file shorter than
// SECRET_MIN), E_STATE_WRITE (a file could not be written).
export class StateDirError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StateDirError";
    this.code = code;
  }
}

// 32 random bytes in base64url are 43 characters.
export const SECRET_MIN = 43;
// Small files (secret, port, node path) are never larger than this.
const SMALL_FILE_MAX = 4096;
// Opening a state file for reading: a link in the last path component is
// refused (ELOOP) instead of followed, and a pipe does not block the open.
// What is read, and the mode that is narrowed, is the object that was opened
// and checked through its descriptor, never whatever a path points to later.
const READ_FLAGS =
  fs.constants.O_RDONLY |
  (fs.constants.O_NOFOLLOW ?? 0) |
  (fs.constants.O_NONBLOCK ?? 0);

function osCode(err) {
  return err && typeof err.code === "string" ? err.code : "EIO";
}

function lstatOrNull(target) {
  try {
    return fs.lstatSync(target);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw new StateDirError(
      "E_STATE_DIR",
      `Не удалось проверить каталог состояния ${target} (${osCode(err)})`,
    );
  }
}

// The state directory: SAI_PIXEL_OFFICE_DIR if it is set (it must be an
// absolute path), otherwise <home>/.sai-pixel-office.
export function resolveStateDir(env, home) {
  const fromEnv = env ? env[ENV_STATE_DIR] : undefined;
  if (typeof fromEnv === "string" && fromEnv !== "") {
    if (!path.isAbsolute(fromEnv)) {
      throw new StateDirError(
        "E_STATE_PATH",
        `Переменная ${ENV_STATE_DIR} должна содержать абсолютный путь (сейчас: ${fromEnv})`,
      );
    }
    return path.resolve(fromEnv);
  }
  if (typeof home !== "string" || !path.isAbsolute(home)) {
    throw new StateDirError(
      "E_STATE_PATH",
      `Не найден домашний каталог: задайте ${ENV_STATE_DIR} (абсолютный путь)`,
    );
  }
  return path.join(home, STATE_DIR_NAME);
}

// Creates the directory with mode 0700, or checks an existing one: it must be
// a plain directory (not a link) of the current user; wider modes are narrowed.
export function ensureStateDir(dir) {
  let st = lstatOrNull(dir);
  if (st === null) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch (err) {
      throw new StateDirError(
        "E_STATE_DIR",
        `Не удалось создать каталог состояния ${dir} (${osCode(err)})`,
      );
    }
    st = lstatOrNull(dir);
  }
  if (st === null || !st.isDirectory()) {
    throw new StateDirError(
      "E_STATE_DIR",
      `Каталог состояния ${dir} — не обычный каталог (это файл или ссылка). Укажите другой через ${ENV_STATE_DIR} или удалите его`,
    );
  }
  if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
    throw new StateDirError(
      "E_STATE_DIR",
      `Каталог состояния ${dir} принадлежит другому пользователю`,
    );
  }
  if ((st.mode & 0o777) !== 0o700) {
    try {
      fs.chmodSync(dir, 0o700);
    } catch (err) {
      throw new StateDirError(
        "E_STATE_DIR",
        `Не удалось сузить права каталога ${dir} до 0700 (${osCode(err)})`,
      );
    }
  }
}

// Opens a small regular file without following a link, runs fn(fd, stat) on
// it and closes it. Throws the OS error: ELOOP for a link, ENOTFILE for any
// other kind of file than a regular one, E2BIG for a file that is too large.
function withSmallFile(file, fn) {
  const fd = fs.openSync(file, READ_FLAGS);
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) {
      throw Object.assign(new Error("not a regular file"), {
        code: "ENOTFILE",
      });
    }
    if (st.size > SMALL_FILE_MAX) {
      throw Object.assign(new Error("file is too large"), { code: "E2BIG" });
    }
    return fn(fd, st);
  } finally {
    fs.closeSync(fd);
  }
}

// Text of a small regular file, or throws the OS error.
function readSmall(file) {
  return withSmallFile(file, (fd) => fs.readFileSync(fd, "utf8"));
}

function writeAll(fd, buf) {
  let offset = 0;
  while (offset < buf.length) {
    const n = fs.writeSync(fd, buf, offset, buf.length - offset);
    if (n <= 0) throw Object.assign(new Error("short write"), { code: "EIO" });
    offset += n;
  }
}

// Text of a small state file, or null when it is missing or unusable. For the
// hook, which treats every failure as "nothing to do".
export function readStateText(dir, name) {
  try {
    return readSmall(path.join(dir, name));
  } catch {
    return null;
  }
}

function secretFromText(text) {
  const secret = text.trim();
  return secret.length >= SECRET_MIN ? secret : null;
}

// Creates the secret file on the first run, in one operation that fails when
// the file already exists (no "check, then create"); otherwise reads it and
// narrows its mode to 0600. Returns the secret without the line break.
export function ensureSecret(dir, randomBytes = crypto.randomBytes) {
  const file = path.join(dir, SECRET_FILE);
  const fresh = randomBytes(32).toString("base64url");
  if (fresh.length < SECRET_MIN) {
    throw new StateDirError(
      "E_SECRET_SHORT",
      "Не удалось получить случайный секрет достаточной длины",
    );
  }
  let fd;
  try {
    fd = fs.openSync(file, "wx", 0o600);
  } catch (err) {
    if (err.code !== "EEXIST") {
      throw new StateDirError(
        "E_STATE_WRITE",
        `Не удалось создать файл секрета ${file} (${osCode(err)})`,
      );
    }
    return readExistingSecret(file);
  }
  let failure = null;
  try {
    fs.fchmodSync(fd, 0o600);
    writeAll(fd, Buffer.from(`${fresh}\n`, "utf8"));
  } catch (err) {
    failure = err;
  }
  try {
    fs.closeSync(fd);
  } catch (err) {
    failure ??= err;
  }
  if (failure !== null) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // Best effort: a leftover file is reported by the next start as a short
      // secret, with the instruction to delete it.
    }
    throw new StateDirError(
      "E_STATE_WRITE",
      `Не удалось записать файл секрета ${file} (${osCode(failure)})`,
    );
  }
  return fresh;
}

// Reads an existing secret file and narrows its mode to 0600 through the same
// descriptor. A link is refused: it would send both the read and the chmod to
// another file.
function readExistingSecret(file) {
  let secret;
  let narrowing = null;
  try {
    secret = withSmallFile(file, (fd, st) => {
      const value = secretFromText(fs.readFileSync(fd, "utf8"));
      // A short secret leaves the file as it is (the owner is told to delete it).
      if (value !== null && (st.mode & 0o077) !== 0) {
        try {
          fs.fchmodSync(fd, 0o600);
        } catch (err) {
          narrowing = err;
        }
      }
      return value;
    });
  } catch (err) {
    throw new StateDirError(
      "E_STATE_DIR",
      `Файл секрета ${file} не читается или не годится (${osCode(err)}). Удалите файл и запустите снова: секрет создастся заново`,
    );
  }
  if (secret === null) {
    throw new StateDirError(
      "E_SECRET_SHORT",
      `Файл секрета ${file} короче ${SECRET_MIN} символов. Удалите файл и запустите снова: секрет создастся заново`,
    );
  }
  if (narrowing !== null) {
    throw new StateDirError(
      "E_STATE_DIR",
      `Не удалось сузить права файла секрета ${file} до 0600 (${osCode(narrowing)})`,
    );
  }
  return secret;
}

// The secret for the hook: null when the file is missing or too short.
export function readSecret(dir) {
  const text = readStateText(dir, SECRET_FILE);
  return text === null ? null : secretFromText(text);
}

// Writes <dir>/<name> through a temporary file and a rename, so a reader sees
// the old or the new content, never a half-written file. Mode 0600. Whatever
// stands at the temporary name (a leftover, a planted link) is removed itself
// and never followed, and the file is then created exclusively; the mode is set
// through the descriptor. A link at <name> is replaced by the rename, not followed.
export function writeSmallFile(dir, name, text) {
  if (
    typeof name !== "string" ||
    name === "" ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new StateDirError(
      "E_STATE_WRITE",
      `Недопустимое имя файла состояния: ${String(name)}`,
    );
  }
  const target = path.join(dir, name);
  const tmp = `${target}.tmp-${process.pid}`;
  let fd = null;
  try {
    fs.rmSync(tmp, { force: true });
    fd = fs.openSync(tmp, "wx", 0o600);
    fs.fchmodSync(fd, 0o600);
    writeAll(fd, Buffer.from(text, "utf8"));
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, target);
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Best effort: the error below is the one that matters.
      }
    }
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Best effort: the temporary file is named after the process.
    }
    throw new StateDirError(
      "E_STATE_WRITE",
      `Не удалось записать файл ${name} в каталоге ${dir} (${osCode(err)})`,
    );
  }
}

// Names of the files in the directory, sorted; a missing directory has none.
export function stateFiles(dir) {
  try {
    return fs.readdirSync(dir).sort();
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw new StateDirError(
      "E_STATE_DIR",
      `Не удалось прочитать каталог состояния ${dir} (${osCode(err)})`,
    );
  }
}
