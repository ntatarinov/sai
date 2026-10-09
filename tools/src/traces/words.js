// The one rule that splits text into words and pairs of words (design REQ-014, 3.1;
// decisions/0021, D6). It is shared by `add`, `check`, the open list and the paths of
// files, so a name is hashed the same way when it is added and when it is looked for.
import { createHash } from "node:crypto";

// Removed without a separator (3.1, step 0 (c)): zero width space, non-joiner, joiner,
// word joiner, soft hyphen, byte order mark.
const INVISIBLE = /\u200B|\u200C|\u200D|\u2060|\u00AD|\uFEFF/gu;
// A word: letters and digits of Unicode; everything else separates (3.1, step 2).
const WORD = /[\p{L}\p{N}]+/gu;
const MIN_WORD = 3;

// Step 0: NFKC, lower case without locale, invisible characters removed. One line at a
// time, so line numbers stay what they are in the source text.
function normalizeLine(line) {
  return line.normalize("NFKC").toLowerCase().replace(INVISIBLE, "");
}

function codePoints(word) {
  return [...word].length;
}

// The words of `text` after steps 0-3, each with the line (from 1) it starts on.
export function tokenize(text) {
  const out = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const m of normalizeLine(lines[i]).matchAll(WORD)) {
      if (codePoints(m[0]) >= MIN_WORD) out.push({ word: m[0], line: i + 1 });
    }
  }
  return out;
}

function hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function wordHash(word) {
  return hex(word);
}

export function pairHash(a, b) {
  return hex(`${a} ${b}`);
}

// One name of the list (a line of the input of `add` or of the open list) into the
// hashes it is looked for by: one word - its hash; two words - the hash of the pair.
export function nameToHashes(name) {
  const parts = [...normalizeLine(name).matchAll(WORD)].map((m) => m[0]);
  if (parts.length === 0) return { ok: false, reason: "EMPTY" };
  if (parts.some((p) => codePoints(p) < MIN_WORD))
    return { ok: false, reason: "SHORT_PART" };
  if (parts.length === 1) return { ok: true, hashes: [wordHash(parts[0])] };
  if (parts.length === 2)
    return { ok: true, hashes: [pairHash(parts[0], parts[1])] };
  return { ok: false, reason: "TOO_MANY_WORDS" };
}

// Matches the words and pairs of `text` against `hashes` (a Set of hex). Returns the
// sorted line numbers with a match; a pair counts on the line of its first word. The
// caches live as long as the matcher, so one word is hashed once per run (3.1).
export function makeMatcher(hashes) {
  const wordCache = new Map();
  const pairCache = new Map();
  const cached = (cache, key, make) => {
    let h = cache.get(key);
    if (h === undefined) {
      h = make();
      cache.set(key, h);
    }
    return h;
  };
  return function matchLines(text) {
    const lines = new Set();
    if (hashes.size === 0) return [];
    const words = tokenize(text);
    for (let i = 0; i < words.length; i++) {
      const { word, line } = words[i];
      if (hashes.has(cached(wordCache, word, () => wordHash(word))))
        lines.add(line);
      if (i + 1 < words.length) {
        const next = words[i + 1].word;
        const key = `${word} ${next}`;
        if (hashes.has(cached(pairCache, key, () => pairHash(word, next))))
          lines.add(line);
      }
    }
    return [...lines].sort((a, b) => a - b);
  };
}
