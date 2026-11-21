import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// vendored (REQ-111 criterion 6, ARCH §2.1; design docs/design/REQ-111-112-public-landing.md, 4.8): every
// entry of app/vendored.json names a byte copy, its `file` (from app/), its `source` (from the repository
// root) and the `sha256` of its bytes. For each entry the sha256 of the copy, the sha256 of the source and
// the recorded value are equal, and server/vendor/ holds no .js file that is not the `file` of an entry. A
// missing or unreadable file is a finding, and so is a vendored.json that cannot be read or does not have
// exactly this shape (then the other rules are not read: they rest on the entries). Everything is read in
// one call, and no file that is missing or cannot be read makes it throw.
//
// The step `vendored` of npm run check runs this file from app/, with no arguments, on the app/ folder it
// lies in: one line `vendored: <file>: <rule>` per finding and exit 1, or `vendored: 1 file matches its
// source` and exit 0.

const APP = fileURLToPath(new URL("../", import.meta.url));
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const RECORD = "vendored.json";
const VENDOR = "server/vendor";
const ENTRY_KEYS = ["file", "sha256", "source"];
const SHA256 = /^[0-9a-f]{64}$/;

/**
 * @param {Buffer} bytes
 * @returns {string} the sha256 of `bytes` in lowercase hex
 */
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Why a file could not be read, in words: "is missing" for ENOENT, else "cannot be read (<code>)".
 * @param {unknown} err
 * @returns {string}
 */
function readFailure(err) {
  const code = /** @type {NodeJS.ErrnoException} */ (err).code;
  if (code === "ENOENT") return "is missing";
  return `cannot be read (${typeof code === "string" ? code : "an error"})`;
}

/**
 * The sha256 of the file at `abs`, or why it could not be read.
 * @param {string} abs
 * @returns {{ hash: string } | { failure: string }}
 */
function hashOf(abs) {
  try {
    return { hash: sha256(fs.readFileSync(abs)) };
  } catch (err) {
    return { failure: readFailure(err) };
  }
}

/**
 * Whether `value` is a plain relative path with "/" separators that stays inside its folder: not empty, no
 * "\", and no empty, "." or ".." part (so no leading "/").
 * @param {unknown} value
 * @returns {value is string}
 */
function plainPath(value) {
  return (
    typeof value === "string" &&
    value !== "" &&
    !value.includes("\\") &&
    value
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** @typedef {{ file: string, source: string, sha256: string }} Entry */

/**
 * The entries of the record, or the findings of its shape.
 * @param {string} appDir
 * @returns {{ entries: Entry[] } | { findings: string[] }}
 */
function readRecord(appDir) {
  /** @type {string} */
  let text;
  try {
    text = fs.readFileSync(path.join(appDir, RECORD), "utf8");
  } catch (err) {
    return { findings: [`${RECORD}: ${readFailure(err)}`] };
  }
  /** @type {unknown} */
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    return { findings: [`${RECORD}: not JSON`] };
  }
  if (
    !isObject(record) ||
    Object.keys(record).join(",") !== "entries" ||
    !Array.isArray(record.entries)
  )
    return {
      findings: [
        `${RECORD}: not an object with exactly the key entries, a list`,
      ],
    };
  /** @type {string[]} */
  const findings = [];
  /** @type {Entry[]} */
  const entries = [];
  record.entries.forEach((/** @type {unknown} */ entry, i) => {
    const at = `${RECORD}: entries[${i}]`;
    if (
      !isObject(entry) ||
      Object.keys(entry).sort().join(",") !== ENTRY_KEYS.join(",")
    ) {
      findings.push(
        `${at}: not an object with exactly the keys file, source and sha256`,
      );
      return;
    }
    const { file, source, sha256: recorded } = entry;
    const bad = [];
    if (!plainPath(file)) bad.push(`${at}.file: not a plain path inside app/`);
    if (!plainPath(source))
      bad.push(`${at}.source: not a plain path inside the repository`);
    if (typeof recorded !== "string" || !SHA256.test(recorded))
      bad.push(`${at}.sha256: not 64 lowercase hex digits`);
    if (bad.length > 0) findings.push(...bad);
    else
      entries.push({
        file: /** @type {string} */ (file),
        source: /** @type {string} */ (source),
        sha256: /** @type {string} */ (recorded),
      });
  });
  return findings.length > 0 ? { findings } : { entries };
}

/**
 * The paths (from app/, with "/" separators) of every entry under `rel` whose name ends in .js and that is
 * not a folder, every level down; links are listed, not followed. A missing server/vendor/ holds none.
 * @param {string} appDir
 * @param {string} rel
 * @param {string[]} files
 * @param {string[]} findings
 */
function jsFiles(appDir, rel, files, findings) {
  /** @type {fs.Dirent[]} */
  let list;
  try {
    list = fs.readdirSync(path.join(appDir, rel), { withFileTypes: true });
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    if (!(rel === VENDOR && code === "ENOENT"))
      findings.push(`${rel}: the folder ${readFailure(err)}`);
    return;
  }
  for (const e of list) {
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) jsFiles(appDir, r, files, findings);
    else if (e.name.endsWith(".js")) files.push(r);
  }
}

/**
 * The findings and the number of entries, from one read of the record, the copies, the sources and
 * server/vendor/.
 * @param {{ appDir: string, rootDir: string }} dirs
 * @returns {{ findings: string[], count: number }}
 */
function report({ appDir, rootDir }) {
  const read = readRecord(appDir);
  if ("findings" in read) return { findings: read.findings, count: 0 };
  /** @type {string[]} */
  const out = [];
  for (const { file, source, sha256: recorded } of read.entries) {
    const copy = hashOf(path.join(appDir, file));
    const original = hashOf(path.join(rootDir, source));
    if ("failure" in copy) out.push(`${file}: the copy ${copy.failure}`);
    if ("failure" in original)
      out.push(`${source}: the source of ${file} ${original.failure}`);
    if ("failure" in copy || "failure" in original) continue;
    if (copy.hash === recorded && original.hash === recorded) continue;
    if (copy.hash === original.hash) {
      out.push(
        `${RECORD}: the sha256 recorded for ${file} is stale: the copy and its source are both ${copy.hash}`,
      );
      continue;
    }
    if (copy.hash !== recorded)
      out.push(
        `${file}: the copy is not the bytes of its source ${source} (its sha256 is ${copy.hash}, the recorded one ${recorded})`,
      );
    if (original.hash !== recorded)
      out.push(
        `${source}: the source of ${file} is not the recorded bytes (its sha256 is ${original.hash}, the recorded one ${recorded})`,
      );
  }
  /** @type {string[]} */
  const files = [];
  jsFiles(appDir, VENDOR, files, out);
  const listed = new Set(read.entries.map((e) => e.file));
  for (const f of files.sort())
    if (!listed.has(f))
      out.push(`${f}: a .js file in ${VENDOR}/ that ${RECORD} does not list`);
  return { findings: out, count: read.entries.length };
}

/**
 * Every byte copy of app/vendored.json against its record and its source, and server/vendor/ against the
 * entries, in one call.
 * @param {{ appDir: string, rootDir: string }} dirs app/ and the repository root
 * @returns {string[]} the findings, each `<file>: <rule>`; empty when every copy matches its source
 */
export function checkVendored(dirs) {
  return report(dirs).findings;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { findings, count } = report({ appDir: APP, rootDir: ROOT });
  for (const f of findings) process.stdout.write(`vendored: ${f}\n`);
  if (findings.length === 0)
    process.stdout.write(
      count === 1
        ? "vendored: 1 file matches its source\n"
        : `vendored: ${count} files match their sources\n`,
    );
  process.exitCode = findings.length ? 1 : 0;
}
