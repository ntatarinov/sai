// Reading a tenant file (design REQ-054, 5.9 and 7.5). The only file of the module that
// touches the disk and the paths. The file is only read, never changed; a bad file or a
// failure of the system is a PickerError with one plain line, any other error is a
// program error and goes up as it is. Every call of the file system goes through the
// `fs` object (`fs.lstatSync(...)`), so that a test can make it fail.
import fs from "node:fs";
import path from "node:path";
import { lineColumn } from "./json.js";
import { MAX_FILE_BYTES } from "./limits.js";
import { show } from "./places.js";
import { firstInvalidUtf8 } from "./utf8.js";

// An expected refusal; its message is one line in Russian.
export class PickerError extends Error {
  constructor(message) {
    super(message);
    this.name = "PickerError";
  }
}

const notFound = (name) => `Файл не найден: ${name}. Проверьте путь.`;
const isLink = (name) => `${name} — ссылка. Укажите сам файл, а не ссылку.`;
const noRight = (name) => `Нет права читать файл ${name}. Проверьте права.`;
const MISSING = new Map([
  ["ENOENT", notFound],
  ["ENOTDIR", notFound],
]);
const OPEN_REFUSALS = new Map([
  ...MISSING,
  ["ELOOP", isLink],
  ["EACCES", noRight],
  ["EPERM", noRight],
]);

// An error of the operating system has a string `code` and a string `syscall`.
function isOsError(err) {
  return typeof err?.code === "string" && typeof err?.syscall === "string";
}

// What to throw for a failed call: a PickerError for an error of the system (the line
// is taken from `known` by the code, else it is the general one), the error itself otherwise.
function refusalOf(err, name, known) {
  if (!isOsError(err)) return err;
  const make = known.get(err.code);
  if (make !== undefined) return new PickerError(make(name));
  return new PickerError(
    `Не удалось прочитать файл ${name} (${show(err.code)}). Проверьте файл.`,
  );
}

// The folder check of the mode with `baseDir`: the file is inside the folder, and no
// step of the way below the folder is a link.
function checkInside(abs, baseDir, name) {
  const base = path.resolve(baseDir);
  const rel = path.relative(base, abs);
  if (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rel)
  ) {
    throw new PickerError(
      `Файл ${name} лежит вне папки арендаторов. Положите его в эту папку.`,
    );
  }
  let current = base;
  for (const part of rel.split(path.sep).slice(0, -1)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (err) {
      if (isOsError(err) && MISSING.has(err.code)) return; // the next step says "not found"
      throw refusalOf(err, name, MISSING);
    }
    if (stat.isSymbolicLink()) {
      throw new PickerError(
        `Файл ${name} лежит за ссылкой на папку. Положите его в саму папку арендаторов.`,
      );
    }
  }
}

function checkKind(stat, name) {
  if (stat.isSymbolicLink()) throw new PickerError(isLink(name));
  if (stat.isDirectory()) {
    throw new PickerError(
      `${name} — папка, а не файл. Укажите файл арендатора.`,
    );
  }
  if (!stat.isFile()) {
    throw new PickerError(
      `${name} — не обычный файл. Укажите файл арендатора.`,
    );
  }
}

const tooBig = (name) =>
  new PickerError(`Файл ${name} больше 512 КБ. Сократите его.`);

// readTenantFile(file, { baseDir }) -> { bytes, fileName }. Steps Ч1-Ч6 of the design.
export function readTenantFile(file, options = {}) {
  if (typeof file !== "string" || file === "" || file.includes("\0")) {
    throw new PickerError(
      "Путь к файлу пустой или с недопустимым знаком. Проверьте путь.",
    );
  }
  const abs = path.resolve(file);
  const fileName = path.basename(abs) || abs;
  const name = show(fileName);
  if (options?.baseDir !== undefined) {
    if (typeof options.baseDir !== "string" || options.baseDir.includes("\0"))
      throw new TypeError("baseDir must be a path");
    checkInside(abs, options.baseDir, name);
  }
  let found;
  try {
    found = fs.lstatSync(abs);
  } catch (err) {
    throw refusalOf(err, name, MISSING);
  }
  checkKind(found, name);
  const flags =
    fs.constants.O_RDONLY |
    (fs.constants.O_NOFOLLOW ?? 0) |
    (fs.constants.O_NONBLOCK ?? 0);
  let fd;
  try {
    try {
      fd = fs.openSync(abs, flags);
    } catch (err) {
      throw refusalOf(err, name, OPEN_REFUSALS);
    }
    // From here an error of the system gets the general line.
    const opened = fs.fstatSync(fd);
    if (!opened.isFile()) {
      throw new PickerError(
        `${name} — не обычный файл. Укажите файл арендатора.`,
      );
    }
    if (opened.size > MAX_FILE_BYTES) throw tooBig(name);
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const got = fs.readSync(fd, buffer, total, buffer.length - total, null);
      if (got === 0) break;
      total += got;
    }
    if (total > MAX_FILE_BYTES) throw tooBig(name);
    return { bytes: new Uint8Array(buffer.subarray(0, total)), fileName };
  } catch (err) {
    if (err instanceof PickerError) throw err;
    throw refusalOf(err, name, new Map());
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // The file was only read: a failed close changes nothing in what was read.
      }
    }
  }
}

// The text of the bytes: a BOM at the start is dropped and not counted. When the bytes are
// not UTF-8, the place of the first bad byte (line and column by the text before it).
export function decodeTenantBytes(bytes) {
  const hasBom =
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf;
  const body = hasBom ? bytes.subarray(3) : bytes;
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  const bad = firstInvalidUtf8(body);
  if (bad >= 0) {
    const before = decoder.decode(body.subarray(0, bad));
    return { ok: false, ...lineColumn(before, before.length) };
  }
  return { ok: true, text: decoder.decode(body) };
}
