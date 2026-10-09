// The check of a repository (design REQ-014, 6): the data files first, then every file
// git lists, each on its own. Writes nothing. Every fs call goes through the default
// `fs` object, so the tests can inject failures.
import fs from "node:fs";
import path from "node:path";
import { isOsError, sha256 } from "../util.js";
import { listRepoFiles } from "./git-files.js";
import {
  decodeUtf8,
  readExceptions,
  readHashes,
  readOpenList,
} from "./lists.js";
import { hasHomePath, isMarkdown, markdownLinks } from "./rules.js";
import { makeMatcher } from "./words.js";

const BINARY_PROBE = 8000;
// A larger file is not read (6, r3): skipped like a binary one.
export const MAX_FILE_BYTES = 16 * 1024 * 1024;

// The label printed instead of a path that has a name of the list (2.1, 3.5).
function hiddenLabel(index, rel) {
  return `<файл №${index + 1}, sha256 пути ${sha256(Buffer.from(rel, "utf8")).slice(0, 12)}>`;
}

// The set of hashes to look for: the file of hashes and the open list.
export function loadLists(root, env, cwd) {
  const hashes = new Set(readHashes(root));
  const exceptions = readExceptions(root);
  const openList = readOpenList(env, root, cwd);
  if (openList !== null) for (const h of openList.hashes) hashes.add(h);
  return { hashes, exceptions, openList };
}

function isInside(realRoot, real) {
  const rel = path.relative(realRoot, real);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function skipOf(err) {
  if (!isOsError(err)) throw err;
  return { skip: err.code === "ENOENT" ? "deleted" : "unreadable" };
}

// At most `MAX_FILE_BYTES + 1` bytes of `abs`, never following a final link. `size` is
// the size seen by lstat; a file that grows meanwhile is read on, up to the limit.
function readBounded(abs, size) {
  let buf = Buffer.allocUnsafe(Math.min(size, MAX_FILE_BYTES) + 1);
  const fd = fs.openSync(abs, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    let total = 0;
    for (;;) {
      if (total === buf.length) {
        if (buf.length > MAX_FILE_BYTES) break;
        const bigger = Buffer.allocUnsafe(
          Math.min(buf.length * 2, MAX_FILE_BYTES + 1),
        );
        buf.copy(bigger, 0, 0, total);
        buf = bigger;
      }
      const n = fs.readSync(fd, buf, total, buf.length - total, null);
      if (n === 0) break;
      total += n;
    }
    return buf.subarray(0, total);
  } finally {
    fs.closeSync(fd);
  }
}

// The text of the file `rel` of the repository, or the reason it is skipped (6, step 3):
// not followed out of the root, not read when larger than MAX_FILE_BYTES.
export function readText(root, realRoot, rel) {
  const abs = path.join(root, rel);
  let stat;
  try {
    stat = fs.lstatSync(abs);
  } catch (err) {
    return skipOf(err);
  }
  if (!stat.isFile()) return { skip: "not-regular" };
  let real;
  try {
    real = fs.realpathSync(abs);
  } catch (err) {
    return skipOf(err);
  }
  if (!isInside(realRoot, real)) return { skip: "outside-root" };
  if (stat.size > MAX_FILE_BYTES) return { skip: "too-large" };
  let bytes;
  try {
    bytes = readBounded(abs, stat.size);
  } catch (err) {
    return skipOf(err);
  }
  if (bytes.length > MAX_FILE_BYTES) return { skip: "too-large" };
  if (bytes.subarray(0, BINARY_PROBE).includes(0)) return { skip: "binary" };
  const text = decodeUtf8(bytes);
  if (text === null) return { skip: "binary" };
  return { text };
}

function splitLines(text) {
  return text
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
}

// Report (6): see the design for the shape. `notes` are the lines with an address that
// cannot be decoded ("ссылка не разобрана"): not a trace, they do not change the code.
export function checkRepo({ root, env = process.env, cwd = process.cwd() }) {
  const { hashes, exceptions, openList } = loadLists(root, env, cwd);
  const files = listRepoFiles(root);
  const realRoot = fs.realpathSync(root);
  const match = makeMatcher(hashes);
  const findings = [];
  const notes = [];
  const longLines = [];
  const skipped = [];
  const hiddenPaths = new Map();
  const used = new Set();
  let filesChecked = 0;

  const excepted = (rel, lineText) => {
    const key = `${rel}\t${sha256(Buffer.from(lineText, "utf8"))}`;
    const n = exceptions.get(key);
    if (n === undefined) return false;
    used.add(n);
    return true;
  };

  files.forEach((rel, index) => {
    if (match(rel).length > 0) {
      hiddenPaths.set(rel, hiddenLabel(index, rel));
      findings.push({ path: rel, line: null, kind: "path-name" });
    }
    const read = readText(root, realRoot, rel);
    if (read.skip !== undefined) {
      skipped.push({ path: rel, reason: read.skip });
      return;
    }
    filesChecked++;
    const lines = splitLines(read.text);
    lines.forEach((lineText, i) => {
      if (hasHomePath(lineText) && !excepted(rel, lineText))
        findings.push({ path: rel, line: i + 1, kind: "home" });
    });
    for (const line of match(read.text))
      findings.push({ path: rel, line, kind: "name" });
    if (isMarkdown(rel)) {
      const links = markdownLinks(rel, lines);
      for (const line of links.out) {
        if (!excepted(rel, lines[line - 1]))
          findings.push({ path: rel, line, kind: "link" });
      }
      for (const line of links.unparsed) notes.push({ path: rel, line });
      for (const line of links.long) longLines.push({ path: rel, line });
    }
  });

  const nameFindings = findings.filter(
    (f) => f.kind === "name" || f.kind === "path-name",
  ).length;
  return {
    filesChecked,
    findings,
    notes,
    longLines,
    hiddenPaths,
    skipped,
    unusedExceptions: [...exceptions.values()]
      .filter((n) => !used.has(n))
      .sort((a, b) => a - b),
    openList:
      openList === null
        ? null
        : { sha256: openList.sha256, names: openList.names, nameFindings },
  };
}

const KIND_TEXT = {
  home: "путь домашнего каталога",
  name: "название из списка",
  link: "ссылка за корень репозитория",
  note: "ссылка не разобрана (негодный %XX)",
  long: "ссылки не разобраны (строка длиннее 100000 знаков)",
  "path-name": "название из списка в имени файла",
};
const KIND_ORDER = [
  "home",
  "name",
  "link",
  "note",
  "long",
  "path-name",
  "skipped",
];
const SKIP_TEXT = {
  binary: "двоичный файл",
  unreadable: "не читается",
  deleted: "удалён в рабочей копии",
  "not-regular": "не обычный файл",
  "too-large": "больше 16 МиБ",
  "outside-root": "вне корня репозитория",
};

function byBytes(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// The stdout lines of a report (2.1). Never the found text: a path with a name is
// replaced by its label everywhere.
export function formatReport(report) {
  const rows = [
    ...report.findings.map((f) => ({ ...f, text: KIND_TEXT[f.kind] })),
    ...report.notes.map((n) => ({ ...n, kind: "note", text: KIND_TEXT.note })),
    ...report.longLines.map((n) => ({
      ...n,
      kind: "long",
      text: KIND_TEXT.long,
    })),
    ...report.skipped.map((s) => ({
      path: s.path,
      line: null,
      kind: "skipped",
      text: `пропущен: ${SKIP_TEXT[s.reason]}`,
    })),
  ];
  rows.sort(
    (a, b) =>
      byBytes(a.path, b.path) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  const out = rows.map((r) => {
    const shown = report.hiddenPaths.get(r.path) ?? r.path;
    return r.line === null
      ? `${shown}: ${r.text}`
      : `${shown}:${r.line}: ${r.text}`;
  });
  for (const n of report.unusedExceptions)
    out.push(
      `traces: исключение не использовано: tools/traces/exceptions.tsv:${n}`,
    );
  out.push(
    `traces: файлов проверено ${report.filesChecked}, следов ${report.findings.length}, пропущено ${report.skipped.length}`,
  );
  if (report.openList !== null) {
    const o = report.openList;
    out.push(
      `traces: открытый список: sha256 ${o.sha256}, названий ${o.names}, совпадений названий ${o.nameFindings}`,
    );
  }
  return out;
}

// The exit code of a report (2.1): 1 a trace; 2 no trace but an unread file; else 0.
export function exitCodeOf(report) {
  if (report.findings.length > 0) return 1;
  if (report.skipped.some((s) => s.reason === "unreadable")) return 2;
  return 0;
}
