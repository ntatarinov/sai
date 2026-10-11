// The closing of a handoff (design REQ-039, 5): only the two values `status` and
// `completed_at` of the top level are replaced in the text, the new text is checked by
// the rules of REQ-038 before it is written, and the write is all-or-nothing
// (decisions/0004). Every fs call goes through the default `fs` object.
import fs from "node:fs";
import path from "node:path";
import { Issues, isOsError, writeAllOrNothing } from "../util.js";
import { MAX_FILE_BYTES, readText } from "../traces/check.js";
import { HandoffError } from "./errors.js";
import { checkText, historyReader, violationLines } from "./one-file.js";
import { parseHandoff } from "./rules.js";
import { formatUtc, parseTime } from "./times.js";

const KEYS = ["status", "completed_at"];
const WORD = /^[A-Z_]{1,20}$/u;

const shown = (v) => (typeof v === "string" && WORD.test(v) ? v : null);
const word = (v) => shown(v) ?? "значение не из списка";

function stateError(message) {
  return new HandoffError("E_HO_STATE", message, 1);
}
function pathError(reason) {
  return new HandoffError("E_HO_PATH", `путь: ${reason}`, 1);
}

function hasControl(v) {
  for (let i = 0; i < v.length; i++) {
    const code = v.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

// The path from the root: the form (5.2). Returns it unchanged.
function checkPathForm(arg) {
  if (arg === "") throw pathError("пустой");
  if (hasControl(arg) || arg.includes("\\"))
    throw pathError("управляющий знак или обратная косая черта");
  if (arg.startsWith("/")) throw pathError("абсолютный путь");
  if (arg.split("/").some((p) => p === "" || p === "." || p === ".."))
    throw pathError("пустая часть или . или ..");
  if (!arg.startsWith("handoffs/") || !arg.endsWith(".json"))
    throw pathError("ожидается handoffs/<...>.json");
  return arg;
}

// No link on the way, the file is a regular one.
function checkNoLinks(root, rel) {
  const parts = rel.split("/");
  for (let n = 1; n <= parts.length; n++) {
    const part = parts.slice(0, n).join("/");
    let stat;
    try {
      stat = fs.lstatSync(path.join(root, part));
    } catch (err) {
      if (!isOsError(err)) throw err;
      if (err.code === "ENOENT")
        throw new HandoffError("E_HO_FILE", "файла нет", 1);
      throw new HandoffError("E_HO_IO", `файл не читается (${err.code})`, 2);
    }
    if (stat.isSymbolicLink()) throw pathError("на пути ссылка");
    if (n < parts.length && !stat.isDirectory())
      throw pathError("на пути не папка");
    if (n === parts.length && !stat.isFile())
      throw pathError("не обычный файл");
  }
}

const SKIPS = {
  deleted: () => new HandoffError("E_HO_FILE", "файла нет", 1),
  unreadable: () => new HandoffError("E_HO_IO", "файл не читается", 2),
  "outside-root": () => pathError("ссылка за корень"),
  "not-regular": () => pathError("не обычный файл"),
  "too-large": () => new HandoffError("E_HO_FILE", "файл больше 16 МиБ", 1),
  binary: () => new HandoffError("E_HO_FILE", "не текст UTF-8", 1),
};

// The text of the file, or a refusal. A text that does not return to the same bytes
// (a BOM was dropped) is refused: the other bytes of the file must stay as they are.
function readClosing(root, realRoot, rel) {
  const read = readText(root, realRoot, rel);
  if (read.skip !== undefined) throw SKIPS[read.skip]();
  let raw;
  try {
    raw = fs.readFileSync(path.join(root, rel));
  } catch (err) {
    if (!isOsError(err)) throw err;
    throw new HandoffError("E_HO_IO", `файл не читается (${err.code})`, 2);
  }
  if (
    raw.length > MAX_FILE_BYTES ||
    !raw.equals(Buffer.from(read.text, "utf8"))
  )
    throw new HandoffError("E_HO_FILE", "не текст UTF-8", 1);
  return { text: read.text, raw };
}

// The offsets { start, end } of the values of the top-level keys `status` and
// `completed_at` in the text of a valid JSON object: Map(key -> spans[]). Values of the
// same names inside other objects are not touched.
function topLevelSpans(text) {
  const spans = new Map();
  let i = 0;
  const space = () => {
    while (" \t\r\n".includes(text[i])) i++;
  };
  const string = () => {
    i++;
    while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    i++;
  };
  const value = () => {
    const c = text[i];
    if (c === '"') return string();
    if (c === "{" || c === "[") {
      let depth = 0;
      for (;;) {
        const d = text[i];
        if (d === '"') {
          string();
          continue;
        }
        if (d === "{" || d === "[") depth++;
        else if (d === "}" || d === "]") depth--;
        i++;
        if (depth === 0) return;
      }
    }
    while (i < text.length && !",}] \t\r\n".includes(text[i])) i++;
  };
  space();
  i++;
  for (;;) {
    space();
    if (text[i] === "}") break;
    const keyStart = i;
    string();
    const key = JSON.parse(text.slice(keyStart, i));
    space();
    i++;
    space();
    const start = i;
    value();
    if (KEYS.includes(key)) {
      if (!spans.has(key)) spans.set(key, []);
      spans.get(key).push({ start, end: i });
    }
    space();
    if (text[i] === ",") i++;
  }
  return spans;
}

function duplicateKey() {
  return new HandoffError(
    "E_HO_FILE",
    "ключ status или completed_at повторён на верхнем уровне",
    1,
  );
}

// The text with the top-level `status` and `completed_at` replaced; every other byte is
// kept. `edits`: { status: "COMPLETED", completed_at: "2099-12-31T10:00:00Z" }. The new
// text is parsed and compared with the old document in the same call.
export function spliceTopLevel(text, edits) {
  const parsed = parseHandoff(Buffer.from(text, "utf8"));
  if (parsed.doc === undefined)
    throw new HandoffError(
      "E_HO_FILE",
      `файл не читается как JSON: ${parsed.reason}`,
      1,
    );
  const spans = topLevelSpans(text);
  const found = KEYS.map((k) => spans.get(k) ?? []);
  if (found.some((list) => list.length > 1)) throw duplicateKey();
  const internal = () =>
    new HandoffError(
      "E_HO_INTERNAL",
      "новый текст не прошёл самопроверку; файл не записан",
      2,
    );
  if (found.some((list) => list.length !== 1)) throw internal();
  const cuts = KEYS.map((k, n) => ({
    ...found[n][0],
    value: JSON.stringify(edits[k]),
  })).sort((a, b) => b.start - a.start);
  let out = text;
  for (const cut of cuts)
    out = out.slice(0, cut.start) + cut.value + out.slice(cut.end);
  const check = parseHandoff(Buffer.from(out, "utf8"));
  const expected = { ...parsed.doc, ...edits };
  if (
    check.doc === undefined ||
    JSON.stringify(check.doc) !== JSON.stringify(expected)
  )
    throw internal();
  return out;
}

const OS_REASONS = [
  [
    ["EACCES", "EPERM", "EROFS"],
    "нет права записи в папку или файл (или только чтение)",
  ],
  [
    ["ENOSPC", "EDQUOT", "EFBIG"],
    "на диске нет места или файл слишком велик для записи",
  ],
  [["EIO"], "ошибка ввода-вывода диска"],
  [["ELOOP"], "на пути ссылка"],
  [
    ["EEXIST"],
    "остался временный или резервный файл прерванной или параллельной записи",
  ],
  [["EMFILE", "ENFILE"], "слишком много открытых файлов"],
];

function reasonOf(code) {
  for (const [codes, text] of OS_REASONS) if (codes.includes(code)) return text;
  return `ошибка записи (${code})`;
}

const exists = (root, rel) => {
  try {
    fs.lstatSync(path.join(root, rel));
    return true;
  } catch (err) {
    if (!isOsError(err)) throw err;
    return false;
  }
};

function sameBytes(root, rel, bytes) {
  try {
    return fs.readFileSync(path.join(root, rel)).equals(bytes);
  } catch (err) {
    if (!isOsError(err)) throw err;
    return false;
  }
}

// The Russian line of a failed write: the code of the system is taken from the first
// line of the writer, the state of the file is found by looking at the disk.
function writeFailure(root, rel, issues, oldBytes, newBytes) {
  const side = (suffix) =>
    `${path.posix.dirname(rel)}/.${path.posix.basename(rel)}${suffix}`;
  const tmp = side(".sai-tmp");
  const old = side(".sai-old");
  if (sameBytes(root, rel, newBytes))
    return new HandoffError(
      "E_HO_WRITE",
      `файл закрыт (${rel}), но резервный файл не удалён: ${old}; удалите его вручную`,
      2,
    );
  const code =
    /\((E[A-Z0-9]+)\)/u.exec(issues.list[0].message)?.[1] ?? "код не определён";
  const state = sameBytes(root, rel, oldBytes)
    ? "файл прежний"
    : "файл мог измениться: проверьте его";
  const left = [tmp, old].filter((r) => exists(root, r));
  const tail =
    left.length > 0 ? `; остались ${left.join(", ")}; удалите вручную` : "";
  return new HandoffError(
    "E_HO_WRITE",
    `запись не удалась: ${rel}: ${reasonOf(code)}; ${state}${tail}`,
    2,
  );
}

// Closes the handoff `arg` (a path from the root) with `status`; returns the two lines
// for stdout. `now()` is the clock in milliseconds, read once.
export function closeHandoff({ root, arg, status, now = () => Date.now() }) {
  const rel = checkPathForm(arg);
  checkNoLinks(root, rel);
  const realRoot = fs.realpathSync(root);
  const { text, raw } = readClosing(root, realRoot, rel);

  const parsed = parseHandoff(raw);
  if (parsed.doc === undefined)
    throw new HandoffError(
      "E_HO_FILE",
      `файл не читается как JSON: ${parsed.reason}`,
      1,
    );
  const doc = parsed.doc;
  if (doc.status !== "PENDING" && doc.status !== "IN_PROGRESS")
    throw stateError(
      `status сейчас ${word(doc.status)}: закрываются только PENDING и IN_PROGRESS`,
    );
  if (doc.completed_at !== null)
    throw stateError(
      "completed_at уже записан; записанное не перезаписывается",
    );
  if (
    doc.result === null ||
    typeof doc.result !== "object" ||
    Array.isArray(doc.result)
  )
    throw stateError("result не объект: получатель пишет result до закрытия");
  if (doc.result.status !== status) {
    if (doc.result.status === "IN_PROGRESS")
      throw stateError(
        "это остановка (result.status IN_PROGRESS): командой close она не закрывается",
      );
    throw stateError(
      `result.status (${word(doc.result.status)}) не равен --status (${status})`,
    );
  }
  const spans = topLevelSpans(text);
  if (KEYS.some((k) => (spans.get(k) ?? []).length > 1)) throw duplicateKey();

  const nowSec = Math.floor(now() / 1000);
  const stamp = formatUtc(nowSec);
  const started = parseTime(doc.started_at);
  if (started !== null && started > nowSec)
    throw new HandoffError(
      "E_HO_CLOCK",
      `started_at позже часов (${stamp})`,
      1,
    );

  const next = spliceTopLevel(text, { status, completed_at: stamp });
  const violations = checkText({
    rel,
    text: next,
    nowSec,
    commitOf: historyReader(root, rel),
  });
  if (violations.length > 0)
    throw new HandoffError(
      "E_HO_RULES",
      `новый текст нарушает правила учёта (REQ-038): нарушений ${violations.length}; строки — в stdout; файл не записан`,
      1,
      violationLines(violations),
    );

  const side = (suffix) =>
    `${path.posix.dirname(rel)}/.${path.posix.basename(rel)}${suffix}`;
  for (const leftover of [side(".sai-tmp"), side(".sai-old")])
    if (exists(root, leftover))
      throw new HandoffError(
        "E_HO_BUSY",
        `остался временный файл ${leftover} от прерванной или параллельной записи; файл не изменён; если параллельной записи нет, удалите его`,
        1,
      );
  const again = readClosing(root, realRoot, rel);
  if (!again.raw.equals(raw))
    throw stateError("файл изменён во время закрытия; повторите вызов");

  const newBytes = Buffer.from(next, "utf8");
  const issues = new Issues();
  writeAllOrNothing(root, [{ rel, content: next }], issues);
  if (!issues.empty) throw writeFailure(root, rel, issues, raw, newBytes);
  return [rel, `status: ${status}, completed_at: ${stamp}`];
}
