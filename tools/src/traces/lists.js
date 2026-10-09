// The data files of the check (design REQ-014, 5): the file of hashes, the file of
// exceptions and the open list of SAI_TRACE_LIST. A broken file is an error before any
// file of the repository is looked at; no error text has a path outside the repository,
// a name or a line of the open list.
import fs from "node:fs";
import path from "node:path";
import { isOsError, sha256 } from "../util.js";
import { nameToHashes } from "./words.js";

export const HASHES_REL = "tools/traces/forbidden-names.sha256";
export const EXCEPTIONS_REL = "tools/traces/exceptions.tsv";
export const HASHES_HEADER =
  "# sai traces v1: sha256 слов и пар слов; правило — docs/design/REQ-014-traces.md, п. 3.1";

const HEX64 = /^[0-9a-f]{64}$/u;
const OPEN_LIST_MAX = 1024 * 1024;
const REASON_MAX = 300;

// A handled failure of the command: one stderr line `traces: <code>: <message>`, exit 2.
export class TraceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const NAME_REASONS = {
  EMPTY: "нет ни одного слова",
  SHORT_PART: "часть названия короче 3 знаков",
  TOO_MANY_WORDS: "больше двух слов",
};

// Strict UTF-8; null when the bytes are not.
export function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// The names of a list (input of `add`, the open list): one per non-empty line, "#"
// lines skipped. Returns { names, hashes: Set }; a bad line throws `code` with its
// number and reason, never its text.
export function parseNames(text, code) {
  const hashes = new Set();
  let names = 0;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("#")) continue;
    const result = nameToHashes(line);
    if (!result.ok)
      throw new TraceError(
        code,
        `строка ${i + 1}: ${NAME_REASONS[result.reason]}`,
      );
    names++;
    for (const h of result.hashes) hashes.add(h);
  }
  return { names, hashes };
}

// Checks the text of the file of hashes (5.1). Returns the hashes in file order.
export function parseHashes(text) {
  const bad = (n, why) =>
    new TraceError("E_TRACE_HASHES", `файл хешей, строка ${n}: ${why}`);
  if (text === null) throw bad(1, "не UTF-8");
  if (!text.endsWith("\n")) {
    throw bad(text.split("\n").length, "нет перевода строки в конце");
  }
  const lines = text.slice(0, -1).split("\n");
  if (lines[0] !== HASHES_HEADER) throw bad(1, "нет заголовка");
  const hashes = [];
  for (let i = 1; i < lines.length; i++) {
    if (!HEX64.test(lines[i]))
      throw bad(i + 1, "не хеш (ожидается 64 знака 0-9a-f)");
    const prev = hashes[hashes.length - 1];
    if (prev !== undefined && lines[i] === prev) throw bad(i + 1, "повтор");
    if (prev !== undefined && lines[i] < prev)
      throw bad(i + 1, "нарушен порядок по возрастанию");
    hashes.push(lines[i]);
  }
  return hashes;
}

// The bytes of the file of hashes, or null when there is no such file.
export function readHashesBytes(root) {
  try {
    return fs.readFileSync(path.join(root, HASHES_REL));
  } catch (err) {
    if (!isOsError(err)) throw err;
    if (err.code === "ENOENT") return null;
    throw new TraceError(
      "E_TRACE_HASHES",
      `файл хешей не читается (${err.code})`,
    );
  }
}

export function readHashes(root) {
  const bytes = readHashesBytes(root);
  if (bytes === null) {
    throw new TraceError(
      "E_TRACE_HASHES",
      "нет файла хешей; создайте его: npm run traces -- add",
    );
  }
  return parseHashes(decodeUtf8(bytes));
}

// The file of exceptions (5.2): Map "<path>\t<hash>" -> line number. No file - none.
export function readExceptions(root) {
  let bytes;
  try {
    bytes = fs.readFileSync(path.join(root, EXCEPTIONS_REL));
  } catch (err) {
    if (!isOsError(err)) throw err;
    if (err.code === "ENOENT") return new Map();
    throw new TraceError(
      "E_TRACE_EXCEPTIONS",
      `файл исключений не читается (${err.code})`,
    );
  }
  const bad = (n, why) =>
    new TraceError(
      "E_TRACE_EXCEPTIONS",
      `файл исключений, строка ${n}: ${why}`,
    );
  const text = decodeUtf8(bytes);
  if (text === null) throw bad(1, "не UTF-8");
  const out = new Map();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const line = lines[i].endsWith("\r") ? lines[i].slice(0, -1) : lines[i];
    if (line === "" || line.startsWith("#")) continue;
    const fields = line.split("\t");
    if (fields.length !== 3) throw bad(n, "нужно три поля через табуляцию");
    const [rel, hash, reason] = fields;
    const segments = rel.split("/");
    if (
      rel === "" ||
      rel.startsWith("/") ||
      rel.includes("\\") ||
      segments.some((s) => s === "" || s === "." || s === "..")
    )
      throw bad(n, "путь не от корня репозитория");
    if (!HEX64.test(hash)) throw bad(n, "хеш строки — 64 знака 0-9a-f");
    const reasonLength = [...reason].length;
    if (reason.trim() === "" || reasonLength > REASON_MAX)
      throw bad(n, `причина — от 1 до ${REASON_MAX} знаков`);
    const key = `${rel}\t${hash}`;
    if (out.has(key)) throw bad(n, "повтор пары путь и хеш");
    out.set(key, n);
  }
  return out;
}

function isInside(root, abs) {
  const rel = path.relative(root, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// The open list of SAI_TRACE_LIST (5.3): null when the variable is not set, else
// { hashes, names, sha256 }. Its path and its lines are never in a message.
export function readOpenList(env, root, cwd) {
  const value = env.SAI_TRACE_LIST;
  if (value === undefined) return null;
  if (value === "") throw new TraceError("E_TRACE_LIST", "переменная пуста");
  const abs = path.resolve(cwd, value);
  const inside = () =>
    new TraceError(
      "E_TRACE_LIST_INSIDE",
      "открытый список лежит внутри репозитория; держите его вне Sai",
    );
  if (isInside(root, abs)) throw inside();
  let bytes;
  try {
    if (isInside(fs.realpathSync(root), fs.realpathSync(abs))) throw inside();
    const stat = fs.statSync(abs);
    if (!stat.isFile())
      throw new TraceError("E_TRACE_LIST", "открытый список — не файл");
    if (stat.size > OPEN_LIST_MAX)
      throw new TraceError("E_TRACE_LIST", "открытый список больше 1 МиБ");
    bytes = fs.readFileSync(abs);
  } catch (err) {
    if (!isOsError(err)) throw err;
    const why = err.code === "ENOENT" ? "нет файла" : `не читается`;
    throw new TraceError(
      "E_TRACE_LIST",
      `открытый список: ${why} (${err.code})`,
    );
  }
  if (bytes.length > OPEN_LIST_MAX)
    throw new TraceError("E_TRACE_LIST", "открытый список больше 1 МиБ");
  const text = decodeUtf8(bytes);
  if (text === null)
    throw new TraceError("E_TRACE_LIST", "открытый список не в UTF-8");
  const { names, hashes } = parseNames(text, "E_TRACE_LIST");
  return { hashes, names, sha256: sha256(bytes) };
}
