// The check of the handoffs of a repository (design REQ-038, 3.3): the base first, then
// every handoffs/**/*.json that git lists, each on its own. Writes nothing. Every fs call
// goes through the default `fs` object, so that the tests can inject failures.
import fs from "node:fs";
import path from "node:path";
import { isOsError, sha256 } from "../util.js";
import { MAX_FILE_BYTES, readText } from "../traces/check.js";
import { listRepoFiles, repoRoot } from "../traces/git-files.js";
import { TraceError, readExceptions } from "../traces/lists.js";
import { applyBase, readBase, verifyBase } from "./exceptions.js";
import { fileHistory, isShallow, readBlobs } from "./git-history.js";
import { locate } from "./locate.js";
import {
  checkDuplicates,
  checkFile,
  checkHomePaths,
  parseHandoff,
  ruleNumber,
  valueAt,
  valueHash,
} from "./rules.js";

// How many versions of files are read from git in one call.
const CHUNK_SPECS = 1000;

// A control character (below 0x20 or 0x7f) in a name.
function hasControl(name) {
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function closeFile(fd) {
  try {
    fs.closeSync(fd);
  } catch (err) {
    if (!isOsError(err)) throw err;
  }
}

function readFailure(reason) {
  return new TraceError("E_HC_READ", `файл не читается (${reason})`);
}

// The bytes of one handoff: never through a link out of the root, never more than
// MAX_FILE_BYTES. Any failure stops the whole check (an incomplete check is never green).
function readHandoff(root, realRoot, rel) {
  const abs = path.join(root, rel);
  let fd;
  try {
    const stat = fs.lstatSync(abs);
    if (!stat.isFile()) throw readFailure("не обычный файл");
    const real = fs.realpathSync(abs);
    const inside = path.relative(realRoot, real);
    if (inside === "" || inside.startsWith("..") || path.isAbsolute(inside))
      throw readFailure("ссылка за корень");
    if (stat.size > MAX_FILE_BYTES) return { tooLarge: true };
    fd = fs.openSync(abs, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let buf = Buffer.allocUnsafe(Math.min(stat.size, MAX_FILE_BYTES) + 1);
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
    if (total > MAX_FILE_BYTES) return { tooLarge: true };
    return { bytes: buf.subarray(0, total) };
  } catch (err) {
    if (err instanceof TraceError) throw err;
    if (!isOsError(err)) throw err;
    throw readFailure(err.code);
  } finally {
    if (fd !== undefined) closeFile(fd);
  }
}

function byBytes(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// The versions of a file in the history, parsed on demand and only once; null for a
// version that is not a JSON object.
function versionReader(commits, versions) {
  const docs = new Array(commits.length);
  return (segments, value) => {
    for (let i = 0; i < commits.length; i++) {
      if (docs[i] === undefined)
        docs[i] =
          versions[i] === null ? null : (parseHandoff(versions[i]).doc ?? null);
      if (docs[i] === null) continue;
      const at = valueAt(docs[i], segments);
      if (at.found && at.value === value) return commits[i];
    }
    return null;
  };
}

// Report (4.4): { filesChecked, violations (after the base), exceptionsTotal,
// exceptionsUsed, unusedLines, shallow }. `root` is any folder inside the repository.
export function checkHandoffs({
  root: start,
  nowSec = Math.floor(Date.now() / 1000),
}) {
  const root = repoRoot(start);
  const files = listRepoFiles(root).filter(
    (rel) => rel.startsWith("handoffs/") && rel.endsWith(".json"),
  );
  if (files.some(hasControl))
    throw new TraceError("E_HC_NAME", "имя файла с управляющим знаком");
  const shallow = isShallow(root);
  const history = fileHistory(root);
  const base = readBase(root);
  verifyBase(root, base, shallow);
  const traceExceptions = readExceptions(root);
  const realRoot = fs.realpathSync(root);

  const found = [];
  const entries = [];
  let next = 0;
  while (next < files.length) {
    const group = [];
    let specs = 0;
    while (next < files.length && (group.length === 0 || specs < CHUNK_SPECS)) {
      const rel = files[next++];
      const commits = history.get(rel) ?? [];
      group.push({ rel, commits });
      specs += 1 + commits.length;
    }
    const blobs = readBlobs(
      root,
      group.flatMap((g) => [
        `HEAD:${g.rel}`,
        ...g.commits.map((c) => `${c.hash}:${g.rel}`),
      ]),
    );
    let at = 0;
    for (const g of group) {
      const head = blobs[at];
      const versions = blobs.slice(at + 1, at + 1 + g.commits.length);
      at += 1 + g.commits.length;
      const read = readHandoff(root, realRoot, g.rel);
      const bytes = read.bytes ?? Buffer.alloc(0);
      const parsed = parseHandoff(bytes, read.tooLarge === true);
      const loc = parsed.doc === undefined ? locate("") : locate(parsed.text);
      found.push(
        ...checkFile({
          rel: g.rel,
          bytes,
          parsed,
          loc,
          dirty: head === null || !head.equals(bytes),
          nowSec,
          commitOf: versionReader(g.commits, versions),
        }),
      );
      if (parsed.doc !== undefined && Object.hasOwn(parsed.doc, "handoff_id"))
        entries.push({
          rel: g.rel,
          handoffId: parsed.doc.handoff_id,
          line: loc.lineOf("handoff_id"),
          valueHash: valueHash(true, parsed.doc.handoff_id),
        });
      const traced = readText(root, realRoot, g.rel);
      if (traced.text !== undefined)
        found.push(
          ...checkHomePaths({
            rel: g.rel,
            text: traced.text,
            loc,
            excepted: (lineText) =>
              traceExceptions.has(
                `${g.rel}\t${sha256(Buffer.from(lineText, "utf8"))}`,
              ),
          }),
        );
    }
  }
  found.push(...checkDuplicates(entries));

  const { remaining, used } = applyBase(found, base.rows);
  remaining.sort(
    (a, b) =>
      byBytes(a.file, b.file) ||
      a.line - b.line ||
      byBytes(a.field, b.field) ||
      ruleNumber(a.rule) - ruleNumber(b.rule),
  );
  return {
    filesChecked: files.length,
    violations: remaining,
    exceptionsTotal: base.rows.length,
    exceptionsUsed: used.size,
    unusedLines: base.rows.map((r) => r.n).filter((n) => !used.has(n)),
    shallow,
  };
}

// The stdout lines of a report (3.4).
export function formatReport(report) {
  const out = report.violations.map(
    (v) => `${v.file}:${v.line} — ${v.rule}: ${v.field}: ${v.message}`,
  );
  for (const n of report.unusedLines)
    out.push(
      `handoffs-check: исключение не использовано: tools/handoffs/exceptions.tsv:${n}`,
    );
  if (report.shallow)
    out.push(
      "handoffs-check: история git неполная — сверка с коммитами по доступной истории",
    );
  out.push(
    `handoffs-check: файлов проверено ${report.filesChecked}, нарушений ${report.violations.length}, исключений использовано ${report.exceptionsUsed} из ${report.exceptionsTotal}`,
  );
  return out;
}

export function exitCodeOf(report) {
  return report.violations.length > 0 ? 1 : 0;
}
