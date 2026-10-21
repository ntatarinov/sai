// The files of the page of the picker site (design REQ-056, 5.5): public/ is read from the
// disk at every request, nothing is kept. Every call of the file system goes through the
// `fs` object (`fs.openSync(...)`), so that a test can make it fail.
import fs from "node:fs";
import path from "node:path";
import { STATIC_NAME, STATIC_TYPES } from "./config.js";

export const DEFAULT_PUBLIC_DIR = path.join(import.meta.dirname, "public");

// Opening a file of public/: a link in the last part of the name is refused (ELOOP)
// instead of followed, and a pipe or a device does not block the opening.
const OPEN_FLAGS =
  fs.constants.O_RDONLY |
  (fs.constants.O_NOFOLLOW ?? 0) |
  (fs.constants.O_NONBLOCK ?? 0);

// Errors of opening that mean "no such file here".
const NO_SUCH_FILE = new Set([
  "ENOENT",
  "ENOTDIR",
  "EISDIR",
  "ENAMETOOLONG",
  "ELOOP",
]);

// assetType(name) -> the Content-Type of a file of public/, or null when the name is not
// one: a plain name of at most 64 signs, no "..", and an extension of STATIC_TYPES.
export function assetType(name) {
  if (typeof name !== "string") return null;
  if (!STATIC_NAME.test(name) || name.includes("..")) return null;
  const extension = path.extname(name);
  return Object.hasOwn(STATIC_TYPES, extension)
    ? STATIC_TYPES[extension]
    : null;
}

// readAsset(dir, name) -> { type, bytes }, or null when there is no such file: a wrong
// name, a missing file, a link, a folder, a pipe. Any other error of the system goes up
// as it is (the server answers 500).
export function readAsset(dir, name) {
  const type = assetType(name);
  if (type === null) return null;
  let fd;
  try {
    fd = fs.openSync(path.join(dir, name), OPEN_FLAGS);
  } catch (err) {
    if (NO_SUCH_FILE.has(err?.code)) return null;
    throw err;
  }
  try {
    if (!fs.fstatSync(fd).isFile()) return null;
    return { type, bytes: fs.readFileSync(fd) };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // The file was only read: a failed close changes nothing in what was read.
    }
  }
}
