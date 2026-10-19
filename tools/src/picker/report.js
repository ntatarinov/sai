// The order and the shape of the output lines (design REQ-054, 5.8 and 6.1).
import { MAX_LINES } from "./limits.js";
import { positionKey } from "./json.js";
import { pathText, show } from "./places.js";

// Where a place starts in the file: its own offset, or the offset of the longest
// beginning of its path that exists (a missing field is put at its parent); the root is 0.
function offsetOf(path, positions) {
  if (path.length === 0) return 0;
  for (let length = path.length; length >= 0; length--) {
    const offset = positions.get(positionKey(path.slice(0, length)));
    if (offset !== undefined) return offset;
  }
  return 0;
}

// A new list, ordered by the place in the file; equal places keep the order of finding.
export function orderIssues(issues, positions) {
  return issues
    .map((issue, index) => ({
      issue,
      index,
      offset: offsetOf(issue.path, positions),
    }))
    .sort((a, b) => a.offset - b.offset || a.index - b.index)
    .map((entry) => entry.issue);
}

// "<file>: <place>: <code>: <text>"; the place is given as written.
export function issueLine(fileName, place, code, text) {
  return `${show(fileName)}: ${place}: ${code}: ${text}`;
}

// The lines of the issues in the order of the file, at most MAX_LINES, and a last line
// with the number of the rest.
export function formatIssues(fileName, issues, positions) {
  const ordered = orderIssues(issues, positions);
  const lines = ordered
    .slice(0, MAX_LINES)
    .map((issue) =>
      issueLine(fileName, pathText(issue.path), issue.code, issue.text),
    );
  if (ordered.length > MAX_LINES)
    lines.push(`И ещё ошибок: ${ordered.length - MAX_LINES}.`);
  return lines;
}
