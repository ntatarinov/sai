// Times of a handoff (design REQ-038, 5.2): the strict form of a time, the word "unknown",
// the list of the fields that hold a time, and the times written inside a note.
const STRICT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/u;
const IN_TEXT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z/gu;
const UNKNOWN = /^неизвестно(?![\p{L}\p{N}])/u;
// Keys under which the earlier value of a correction is quoted: not checked.
const QUOTED_KEYS = new Set(["was", "previous"]);
const CORRECTION_KEYS = new Set(["orch_correction", "orch_note"]);

// Seconds since the epoch of a time `YYYY-MM-DDTHH:MM:SSZ` with an existing date, or
// null for anything else (also for a value that is not a string).
export function parseTime(value) {
  if (typeof value !== "string") return null;
  const m = STRICT.exec(value);
  if (m === null) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, 0);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== minute ||
    d.getUTCSeconds() !== second
  )
    return null;
  return d.getTime() / 1000;
}

// A string that begins with the word "неизвестно": a letter or a digit may not follow.
export function isUnknownTime(value) {
  return typeof value === "string" && UNKNOWN.test(value);
}

// `YYYY-MM-DDTHH:MM:SSZ` of a count of seconds.
export function formatUtc(seconds) {
  return new Date(seconds * 1000).toISOString().replace(/\.\d{3}Z$/u, "Z");
}

function isTimeKey(key) {
  return key === "at" || key.endsWith("_at");
}

// Every field that holds a time, at any depth: { segments, value }. The key is `at` or
// ends with `_at`; the value of such a key is not walked into. The subtrees under
// `was` and `previous` inside `orch_correction` and `orch_note` are left out.
export function timeFieldPaths(doc) {
  const found = [];
  const walk = (value, segments, inCorrection) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, [...segments, i], inCorrection));
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      const child = value[key];
      const next = [...segments, key];
      if (inCorrection && QUOTED_KEYS.has(key)) continue;
      if (isTimeKey(key)) {
        found.push({ segments: next, value: child });
        continue;
      }
      walk(child, next, inCorrection || CORRECTION_KEYS.has(key));
    }
  };
  walk(doc, [], false);
  return found;
}

// The times inside a text: { text, seconds }; a time without seconds counts as :00; a
// date that does not exist is not a time.
export function noteTimes(text) {
  const out = [];
  for (const m of text.matchAll(IN_TEXT)) {
    const full = m[0].length === 17 ? `${m[0].slice(0, 16)}:00Z` : m[0];
    const seconds = parseTime(full);
    if (seconds !== null) out.push({ text: m[0], seconds });
  }
  return out;
}
