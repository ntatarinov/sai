import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { E2eError, safeText } from "./errors.js";

// Checks that stand inside the action they protect (design section 4.3, 8):
// the callers use the value these functions return, never the raw input.

// The real path of the root of Sai, computed from the place of this file
// (tools/test/e2e/kit -> four folders up), not from the current folder.
export function repoRoot() {
  return fs.realpathSync(
    fileURLToPath(new URL("../../../../", import.meta.url)),
  );
}

// The real path of the system temporary folder (TMPDIR is honoured).
export function tempRoot() {
  return fs.realpathSync(os.tmpdir());
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  if (rel === "") return true;
  if (path.isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(`..${path.sep}`);
}

// Resolves an absolute path the way the system would, symbolic links included,
// also for the part that does not exist yet: every segment is followed one by
// one, so a link met before a ".." is honoured.
function resolveReal(absolute) {
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep);
  let current = parsed.root;
  let exists = true;
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      current = path.dirname(current);
      continue;
    }
    const candidate = path.join(current, segment);
    if (exists) {
      try {
        fs.lstatSync(candidate);
        current = fs.realpathSync(candidate);
        continue;
      } catch (err) {
        if (err.code === "ENOENT" || err.code === "ENOTDIR") {
          // a link that points nowhere: follow its target by hand
          try {
            const target = fs.readlinkSync(candidate);
            current = resolveReal(path.resolve(current, target));
            continue;
          } catch {
            exists = false;
          }
        } else {
          throw err;
        }
      }
    }
    current = candidate;
  }
  return current;
}

function refusePath(input, reason) {
  const shown =
    typeof input === "string" ? safeText(input) : `[${typeof input}]`;
  return new E2eError("PATH_REFUSED", `refused path "${shown}": ${reason}`);
}

function realOf(input) {
  if (typeof input !== "string" || input === "" || !path.isAbsolute(input)) {
    throw refusePath(input, "not absolute");
  }
  // a NUL character, a name that is too long, a link loop: refused, not a raw system error
  try {
    return resolveReal(input);
  } catch {
    throw refusePath(input, "not a usable path");
  }
}

// -> the real path of a path that is not inside the repository
export function assertOutsideRepo(input) {
  const real = realOf(input);
  if (isInside(real, repoRoot()))
    throw refusePath(input, "inside the repository");
  return real;
}

// -> the real path of a path that lies under the temporary root
export function assertUnderTempRoot(input) {
  const real = realOf(input);
  if (!isInside(real, tempRoot()))
    throw refusePath(input, "outside the temporary root");
  return real;
}

// -> the real path of a .png file under the temporary root, outside the repository
export function assertShotPath(input) {
  const real = realOf(input);
  if (path.extname(real).toLowerCase() !== ".png")
    throw refusePath(input, "not a .png file");
  if (isInside(real, repoRoot()))
    throw refusePath(input, "inside the repository");
  if (!isInside(real, tempRoot()))
    throw refusePath(input, "outside the temporary root");
  return real;
}

function refuseUrl(input) {
  const shown =
    typeof input === "string" ? safeText(input) : `[${typeof input}]`;
  return new E2eError(
    "URL_REFUSED",
    `refused to open "${shown}": only http://127.0.0.1:<port>/… is allowed`,
  );
}

// -> the normalized href; only http://127.0.0.1:<port>/… is accepted
export function assertLoopbackUrl(input) {
  if (typeof input !== "string") throw refuseUrl(input);
  let url;
  try {
    url = new URL(input);
  } catch {
    throw refuseUrl(input);
  }
  const port = Number(url.port);
  const ok =
    url.protocol === "http:" &&
    url.hostname === "127.0.0.1" &&
    url.username === "" &&
    url.password === "" &&
    url.port !== "" &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535;
  if (!ok) throw refuseUrl(input);
  return url.href;
}
