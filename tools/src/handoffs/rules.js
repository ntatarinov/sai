// The rules H1-H9 and H11 on one handoff, H10 on the lines of its text, and H3 on all of
// them (design REQ-038, 4 and 5). Pure functions: the text, the clock and the answers of
// git come in as arguments. Nothing here is printed: a message holds a rule, a time or a
// status, never a value of a field and never the text of a parse error.
import { sha256, isNonEmptyString, isPlainObject } from "../util.js";
import { hasHomePath, hasTempPath } from "../traces/rules.js";
import { fieldPath } from "./locate.js";
import {
  formatUtc,
  isUnknownTime,
  noteTimes,
  parseTime,
  timeFieldPaths,
} from "./times.js";

export const REQUIRED_FIELDS = [
  "handoff_id",
  "run_id",
  "workflow_id",
  "step",
  "from_agent",
  "to_agent",
  "file",
  "status",
  "context",
  "task",
  "created_at",
  "started_at",
  "completed_at",
  "result",
];

const FINISHED = new Set(["COMPLETED", "FAILED"]);
const NO_COMPLETED_AT = new Set(["IN_PROGRESS", "PENDING", "CANCELLED"]);
const STATUS_WORD = /^[A-Z_]{1,20}$/u;
const MAX_DEPTH = 200;
const NOT_LISTED = "значение не из списка";

// A status as it may be printed (a word of capitals) or a phrase that hides the value.
function shown(value) {
  return typeof value === "string" && STATUS_WORD.test(value)
    ? value
    : NOT_LISTED;
}

// The number of the rule for the order of the output: "H10" -> 10.
export function ruleNumber(rule) {
  return Number(rule.slice(1));
}

// The deepest nesting of brackets outside strings, counting stops above the limit.
function tooDeep(text) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "[" || c === "{") {
      if (++depth > MAX_DEPTH) return true;
    } else if (c === "]" || c === "}") depth--;
  }
  return false;
}

// H1: the bytes of a file into { doc, text } or { reason }. A BOM is kept in the text,
// so that it breaks the parse.
export function parseHandoff(bytes, tooLarge = false) {
  if (tooLarge) return { reason: "файл больше 16 МиБ" };
  if (bytes.length === 0) return { reason: "файл пуст" };
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return { reason: "не UTF-8" };
  }
  if (tooDeep(text)) return { reason: "ошибка разбора JSON" };
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { reason: "ошибка разбора JSON" };
  }
  if (!isPlainObject(doc)) return { reason: "верхний уровень — не объект" };
  return { doc, text };
}

// The value at a path of segments in a parsed document: { found, value }.
export function valueAt(doc, segments) {
  let value = doc;
  for (const segment of segments) {
    if (typeof segment === "number") {
      if (!Array.isArray(value) || segment >= value.length)
        return { found: false };
      value = value[segment];
    } else {
      if (!isPlainObject(value) || !Object.hasOwn(value, segment))
        return { found: false };
      value = value[segment];
    }
  }
  return { found: true, value };
}

// The hash of a value for the file of exceptions (4.2): sha256 of its JSON without
// spaces; of the empty string when the field is not there.
export function valueHash(found, value) {
  return sha256(Buffer.from(found ? JSON.stringify(value) : "", "utf8"));
}

// The violations of one file, one per (rule, field) (4.1).
class Collector {
  constructor(rel, bytes, doc, loc) {
    this.rel = rel;
    this.bytes = bytes;
    this.doc = doc;
    this.loc = loc;
    this.list = [];
    this.seen = new Set();
  }

  add(rule, segments, message) {
    const field = fieldPath(segments);
    const key = `${rule}\t${field}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    let hash;
    if (this.doc === null) hash = sha256(this.bytes);
    else {
      const at = valueAt(this.doc, segments);
      hash = valueHash(at.found, at.value);
    }
    this.list.push({
      file: this.rel,
      rule,
      field,
      line: this.loc.lineOf(field),
      message,
      valueHash: hash,
    });
  }
}

// H4 (5.1): the status against the result and against the state of the file.
function checkStatus(doc, dirty, out) {
  const status = doc.status;
  if (typeof status === "string" && FINISHED.has(status)) {
    if (!isPlainObject(doc.result))
      out.add("H4", ["result"], `result не объект при ${status}`);
    else if (doc.result.status !== status)
      out.add(
        "H4",
        ["result", "status"],
        `result.status (${shown(doc.result.status)}) не равен status (${status})`,
      );
    return;
  }
  if (status === "CANCELLED") {
    const c = doc.orch_cancellation;
    if (
      !isPlainObject(c) ||
      typeof c.at !== "string" ||
      !isNonEmptyString(c.reason)
    )
      out.add(
        "H4",
        ["orch_cancellation"],
        "нет orch_cancellation с at и reason",
      );
    return;
  }
  if (status === "PENDING" || status === "IN_PROGRESS") {
    if (dirty) return;
    const stopped =
      status === "IN_PROGRESS" &&
      isPlainObject(doc.result) &&
      doc.result.status === "IN_PROGRESS";
    if (!stopped) {
      out.add(
        "H4",
        ["status"],
        `${status} в коммите: в коммите только законченные handoff-ы`,
      );
      return;
    }
    if (doc.completed_at !== null)
      out.add(
        "H4",
        ["completed_at"],
        "у остановки IN_PROGRESS completed_at не null",
      );
    const first = Array.isArray(doc.result.issues)
      ? doc.result.issues[0]
      : undefined;
    if (
      !isPlainObject(first) ||
      first.kind !== "BLOCKED" ||
      typeof first.at !== "string"
    )
      out.add(
        "H4",
        ["result", "issues"],
        "у остановки IN_PROGRESS первая запись issues — не «BLOCKED» с at",
      );
    return;
  }
  out.add("H4", ["status"], `недопустимое значение ${shown(status)}`);
}

// H5-H7 (5.2) on every field that holds a time.
function checkTimes(doc, nowSec, commitOf, out) {
  for (const { segments, value } of timeFieldPaths(doc)) {
    if (value === null) continue;
    if (isUnknownTime(value)) continue;
    const seconds = parseTime(value);
    if (seconds === null) {
      out.add("H5", segments, "значение не вида ГГГГ-ММ-ДДTчч:мм:ссZ");
    } else if (seconds > nowSec) {
      out.add("H6", segments, `${value} позже часов (${formatUtc(nowSec)})`);
    } else {
      const commit = commitOf(segments, value);
      if (commit !== null && seconds > commit.time)
        out.add(
          "H7",
          segments,
          `${value} позже коммита ${commit.hash.slice(0, 7)} (${formatUtc(commit.time)}), в который вошло значение`,
        );
    }
  }
  if (
    Object.hasOwn(doc, "status") &&
    doc.completed_at === null &&
    !NO_COMPLETED_AT.has(doc.status)
  )
    out.add("H5", ["completed_at"], `null при ${shown(doc.status)}`);
}

// H9 (5.3): the corrections of ORCH.
function checkCorrections(doc, nowSec, commitOf, out) {
  for (const key of ["orch_correction", "orch_note"]) {
    if (!Object.hasOwn(doc, key)) continue;
    const value = doc[key];
    const items = Array.isArray(value)
      ? value.map((item, i) => ({ item, segments: [key, i] }))
      : [{ item: value, segments: [key] }];
    for (const { item, segments } of items) {
      if (!isPlainObject(item)) {
        out.add("H9", segments, "не объект и не список объектов");
        continue;
      }
      if (!isNonEmptyString(item.by))
        out.add("H9", [...segments, "by"], "нет непустой строки by");
      if (!Object.hasOwn(item, "at"))
        out.add("H9", [...segments, "at"], "нет поля at");
      const noteAt = [...segments, "at_note"];
      if (item.at === null && !isNonEmptyString(item.at_note))
        out.add("H9", noteAt, "at null без непустого at_note");
      if (typeof item.at_note === "string")
        checkNote(item.at_note, noteAt, nowSec, commitOf, out);
    }
  }
}

function checkNote(note, segments, nowSec, commitOf, out) {
  for (const t of noteTimes(note)) {
    if (t.seconds > nowSec) {
      out.add("H9", segments, `время ${t.text} в тексте позже часов`);
      return;
    }
    const commit = commitOf(segments, note);
    if (commit !== null && t.seconds > commit.time) {
      out.add(
        "H9",
        segments,
        `время ${t.text} в тексте позже коммита ${commit.hash.slice(0, 7)} (${formatUtc(commit.time)})`,
      );
      return;
    }
  }
}

// H11 (5.5): a temporary folder in a decoded string value, at any depth; keys are not
// looked at.
function checkTempPaths(doc, out) {
  const walk = (value, segments) => {
    if (typeof value === "string") {
      if (hasTempPath(value)) out.add("H11", segments, "путь временной папки");
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, [...segments, i]));
    } else if (value !== null && typeof value === "object") {
      for (const key of Object.keys(value))
        walk(value[key], [...segments, key]);
    }
  };
  walk(doc, []);
}

// H1-H9 and H11 on one file. `input`: rel, bytes, parsed (from parseHandoff), loc (from
// locate), dirty (the file is not in HEAD or differs from it), nowSec and commitOf(
// segments, value) -> { hash, time } | null (the earliest commit with that value).
export function checkFile(input) {
  const { rel, bytes, parsed, loc, dirty, nowSec, commitOf } = input;
  const doc = parsed.doc ?? null;
  const out = new Collector(rel, bytes, doc, loc);
  if (doc === null) {
    out.add("H1", [], `файл не читается как JSON: ${parsed.reason}`);
    return out.list;
  }
  const has = (key) => Object.hasOwn(doc, key);
  for (const field of REQUIRED_FIELDS)
    if (!has(field)) out.add("H2", [field], "нет поля");

  const parts = rel.split("/");
  if (has("file") && doc.file !== rel)
    out.add("H3", ["file"], "file не равен пути файла");
  if (has("run_id")) {
    if (parts.length < 3)
      out.add("H3", ["run_id"], "у файла нет папки прогона");
    else if (doc.run_id !== parts[1])
      out.add("H3", ["run_id"], "run_id не равен имени папки прогона");
  }

  if (has("status")) checkStatus(doc, dirty, out);
  checkTimes(doc, nowSec, commitOf, out);
  const started = parseTime(doc.started_at);
  const completed = parseTime(doc.completed_at);
  if (started !== null && completed !== null && completed < started)
    out.add(
      "H8",
      ["completed_at"],
      `${doc.completed_at} раньше started_at ${doc.started_at}`,
    );
  checkCorrections(doc, nowSec, commitOf, out);
  checkTempPaths(doc, out);
  return out.list;
}

// H3 on all files (5.1): `entries` in the order of the bytes of the paths, each
// { rel, handoffId, line, valueHash }. A repeat of a string handoff_id is a violation of
// every file but the first.
export function checkDuplicates(entries) {
  const first = new Map();
  const list = [];
  for (const entry of entries) {
    if (typeof entry.handoffId !== "string") continue;
    const earlier = first.get(entry.handoffId);
    if (earlier === undefined) {
      first.set(entry.handoffId, entry.rel);
      continue;
    }
    list.push({
      file: entry.rel,
      rule: "H3",
      field: "handoff_id",
      line: entry.line,
      message: `повтор handoff_id, первый — ${earlier}`,
      valueHash: entry.valueHash,
    });
  }
  return list;
}

// H10 (5.4, 5.7): the lines of the text that have a path of a home folder and are not an
// exception of traces. `excepted(lineText)` answers for the exceptions; the field is the
// one whose token holds the path.
export function checkHomePaths({ rel, text, loc, excepted }) {
  const list = [];
  const seen = new Set();
  const lines = text
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
  lines.forEach((lineText, index) => {
    if (!hasHomePath(lineText) || excepted(lineText)) return;
    const n = index + 1;
    const tokens = loc.tokensOnLine(n);
    const token = tokens.find((t) => hasHomePath(t.raw)) ?? tokens[0];
    const field = token === undefined ? "$" : token.path;
    if (seen.has(field)) return;
    seen.add(field);
    list.push({
      file: rel,
      rule: "H10",
      field,
      line: n,
      message: "путь домашнего каталога",
      valueHash: "",
    });
  });
  return list;
}
