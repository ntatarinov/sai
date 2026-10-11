// The base of exceptions (design REQ-038, 6): the file of records, the commit of the base
// pinned by a record of decisions/, the check of every record against that commit, and
// the removal of the violations that a record covers. A broken base is an error before
// any handoff is looked at; no message holds a value from a record.
import fs from "node:fs";
import path from "node:path";
import { isOsError, isPlainObject, sha256 } from "../util.js";
import { TraceError, decodeUtf8 } from "../traces/lists.js";
import { commitExists, isAncestorOfHead, readBlobs } from "./git-history.js";
import { ruleNumber, valueAt, valueHash } from "./rules.js";

export const BASE_REL = "tools/handoffs/exceptions.tsv";
export const EMIT_REASON =
  "старое нарушение до REQ-038; handoff не переписывается (quality-bar §6, п. 8)";

const HEADER = /^# база: ([0-9a-f]{40})$/u;
const DECISION_FILE = /^(\d{4})-.+\.md$/u;
const DECISION_LINE = /^База handoffs-check: ([0-9a-f]{40})[ \t]*$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const RULES = new Set([
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "H7",
  "H8",
  "H9",
  "H11",
]);
const FIELD =
  /^(?:\$|[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+|\[(?:0|[1-9]\d*)\])*)$/u;
const REASON_MAX = 300;

function headerError(why) {
  return new TraceError("E_HC_BASE_HEADER", why);
}

function rowError(n, why) {
  return new TraceError("E_HC_BASE_ROW", `файл базы, строка ${n}: ${why}`);
}

// The path of a field of a record into segments: "result.issues[0].at" -> keys and
// indexes.
function segmentsOf(field) {
  if (field === "$") return [];
  return [...field.matchAll(/([A-Za-z0-9_-]+)|\[(\d+)\]/gu)].map((m) =>
    m[1] !== undefined ? m[1] : Number(m[2]),
  );
}

// The file of records (6.1): { commit, rows } with rows { n, file, rule, field, hash }.
export function readBase(root) {
  let bytes;
  try {
    bytes = fs.readFileSync(path.join(root, BASE_REL));
  } catch (err) {
    if (!isOsError(err)) throw err;
    throw headerError(
      err.code === "ENOENT"
        ? "нет файла базы исключений"
        : `файл базы исключений не читается (${err.code})`,
    );
  }
  const text = decodeUtf8(bytes);
  if (text === null) throw rowError(1, "не UTF-8");
  const headers = [];
  const rows = [];
  const keys = new Set();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const line = lines[i].endsWith("\r") ? lines[i].slice(0, -1) : lines[i];
    if (line === "") continue;
    if (line.startsWith("#")) {
      const m = HEADER.exec(line);
      if (m !== null) headers.push(m[1]);
      continue;
    }
    const fields = line.split("\t");
    if (fields.length !== 5)
      throw rowError(n, "нужно пять полей через табуляцию");
    const [file, rule, field, hash, reason] = fields;
    const parts = file.split("/");
    if (
      !file.startsWith("handoffs/") ||
      !file.endsWith(".json") ||
      file.includes("\\") ||
      parts.some((s) => s === "" || s === "." || s === "..")
    )
      throw rowError(n, "путь не от корня репозитория или не handoffs/*.json");
    if (!RULES.has(rule)) throw rowError(n, "код правила — H1…H9 или H11");
    if (!FIELD.test(field)) throw rowError(n, "путь поля не по грамматике");
    if (!HEX64.test(hash)) throw rowError(n, "хеш — 64 знака 0-9a-f");
    if (reason.trim() === "" || [...reason].length > REASON_MAX)
      throw rowError(n, `причина — от 1 до ${REASON_MAX} знаков`);
    const key = `${file}\t${rule}\t${field}`;
    if (keys.has(key)) throw rowError(n, "повтор записи");
    keys.add(key);
    rows.push({ n, file, rule, field, hash });
  }
  if (headers.length !== 1)
    throw headerError(
      headers.length === 0
        ? "нет строки «# база: <коммит>»"
        : "строка «# база:» больше одной",
    );
  return { commit: headers[0], rows };
}

// The commit pinned by the record of decisions/ with the largest number that has the line
// "База handoffs-check: <40 hex>" (6.2); read from the disk.
export function readDecisionCommit(root) {
  const dir = path.join(root, "decisions");
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (err) {
    if (!isOsError(err)) throw err;
    throw new TraceError(
      "E_HC_DECISION",
      `каталог decisions/ не читается (${err.code})`,
    );
  }
  const found = new Map();
  for (const name of names.sort()) {
    const m = DECISION_FILE.exec(name);
    if (m === null) continue;
    let bytes;
    try {
      bytes = fs.readFileSync(path.join(dir, name));
    } catch (err) {
      if (!isOsError(err)) throw err;
      throw new TraceError(
        "E_HC_DECISION",
        `запись decisions/ не читается (${err.code})`,
      );
    }
    const text = decodeUtf8(bytes);
    if (text === null) continue;
    for (const raw of text.split("\n")) {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      const hit = DECISION_LINE.exec(line);
      if (hit === null) continue;
      const number = Number(m[1]);
      if (!found.has(number)) found.set(number, new Set());
      found.get(number).add(hit[1]);
    }
  }
  if (found.size === 0)
    throw new TraceError(
      "E_HC_DECISION",
      "в decisions/ нет строки «База handoffs-check: <коммит>»",
    );
  const hashes = found.get(Math.max(...found.keys()));
  if (hashes.size !== 1)
    throw new TraceError(
      "E_HC_DECISION",
      "в записи decisions/ с наибольшим номером несколько разных коммитов базы",
    );
  return [...hashes][0];
}

// 6.2 and 6.3: the base against the record of decisions/ and against git.
export function verifyBase(root, base, shallow) {
  const pinned = readDecisionCommit(root);
  if (pinned !== base.commit)
    throw new TraceError(
      "E_HC_BASE_COMMIT",
      "шапка базы не совпала с записью decisions/",
    );
  if (!commitExists(root, base.commit))
    throw new TraceError(
      "E_HC_BASE_COMMIT",
      shallow
        ? "в неполной истории нет коммита базы"
        : "нет такого коммита базы",
    );
  if (!isAncestorOfHead(root, base.commit))
    throw new TraceError("E_HC_BASE_COMMIT", "коммит базы — не предок HEAD");
  const blobs = readBlobs(
    root,
    base.rows.map((row) => `${base.commit}:${row.file}`),
  );
  base.rows.forEach((row, i) => {
    const bytes = blobs[i];
    if (bytes === null) throw rowError(row.n, "файла нет в коммите базы");
    if (!matchesVersion(row, bytes))
      throw rowError(row.n, "значение не совпало с коммитом базы");
  });
}

// A record against the bytes of the file in the commit of the base (6.3, step 2).
function matchesVersion(row, bytes) {
  if (row.field === "$") return sha256(bytes) === row.hash;
  let doc;
  try {
    doc = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    );
  } catch {
    return false;
  }
  if (!isPlainObject(doc)) return false;
  const at = valueAt(doc, segmentsOf(row.field));
  return valueHash(at.found, at.value) === row.hash;
}

// Removes the violations that a record covers (6.3, step 3): the same file, rule and
// field and the same hash of the value. Returns { remaining, used: Set of line numbers }.
export function applyBase(violations, rows) {
  const byKey = new Map(
    rows.map((row) => [`${row.file}\t${row.rule}\t${row.field}`, row]),
  );
  const used = new Set();
  const remaining = [];
  for (const v of violations) {
    const row = byKey.get(`${v.file}\t${v.rule}\t${v.field}`);
    if (row !== undefined && row.hash === v.valueHash) used.add(row.n);
    else remaining.push(v);
  }
  return { remaining, used };
}

function byBytes(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// The records for the violations of H1-H9 and H11 (6.5), in the order: path, number of
// the rule, path of the field.
export function emitRecords(violations) {
  return violations
    .filter((v) => v.rule !== "H10")
    .sort(
      (a, b) =>
        byBytes(a.file, b.file) ||
        ruleNumber(a.rule) - ruleNumber(b.rule) ||
        byBytes(a.field, b.field),
    )
    .map(
      (v) => `${v.file}\t${v.rule}\t${v.field}\t${v.valueHash}\t${EMIT_REASON}`,
    );
}
