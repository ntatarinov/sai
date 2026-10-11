// The rules of REQ-038 for one file or one text (design REQ-039, 6): the same functions
// that `handoffs-check` calls, without copying. Nothing is written.
import { readBlobs, fileHistory } from "./git-history.js";
import { versionReader, formatReport } from "./check.js";
import { locate } from "./locate.js";
import {
  checkFile,
  checkHomePaths,
  parseHandoff,
  ruleNumber,
} from "./rules.js";

function byBytes(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// Violations of a text that is not in a commit yet (`dirty`): the rules H1-H9, H11 and
// H10, without the base of exceptions. `commitOf(segments, value)` as in checkFile.
export function checkText({ rel, text, nowSec, commitOf }) {
  const bytes = Buffer.from(text, "utf8");
  const parsed = parseHandoff(bytes);
  const loc = parsed.doc === undefined ? locate("") : locate(parsed.text);
  const found = [
    ...checkFile({ rel, bytes, parsed, loc, dirty: true, nowSec, commitOf }),
    ...checkHomePaths({ rel, text, loc, excepted: () => false }),
  ];
  return found.sort(
    (a, b) =>
      byBytes(a.file, b.file) ||
      a.line - b.line ||
      byBytes(a.field, b.field) ||
      ruleNumber(a.rule) - ruleNumber(b.rule),
  );
}

// `commitOf` for H7 from the history of the file in git; a file that is not in the
// history gives null for every value.
export function historyReader(root, rel) {
  const commits = fileHistory(root).get(rel) ?? [];
  if (commits.length === 0) return () => null;
  const versions = readBlobs(
    root,
    commits.map((c) => `${c.hash}:${rel}`),
  );
  return versionReader(commits, versions);
}

// The lines of violations as `handoffs-check` prints them, without the summary line.
export function violationLines(violations) {
  return formatReport({
    violations,
    unusedLines: [],
    shallow: false,
    filesChecked: 0,
    exceptionsUsed: 0,
    exceptionsTotal: 0,
  }).slice(0, -1);
}
