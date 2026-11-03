import { E2eError, safeText } from "./errors.js";

// The pure matcher of console entries and declarations (design section 4.7).
// It depends on nothing but the error type.

const MAX_TEXT = 500;

function cut(text) {
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
}

function firstLine(text) {
  return String(text ?? "").split("\n")[0];
}

function argText(arg) {
  if (arg === null || typeof arg !== "object") return String(arg);
  if (arg.value !== undefined)
    return typeof arg.value === "string" ? arg.value : String(arg.value);
  if (arg.description !== undefined) return String(arg.description);
  return String(arg.type ?? "");
}

// entryFromEvent(message, { page, at }) -> Entry | null
// Entry = { kind: "console"|"exception"|"rejection"|"browser-log", text, url?, source?, page, at }
// Warnings, info and debug are not entries.
export function entryFromEvent(message, { page, at }) {
  const params = message?.params ?? {};
  if (message?.method === "Runtime.consoleAPICalled") {
    if (params.type !== "error" && params.type !== "assert") return null;
    const text = (params.args ?? []).map(argText).join(" ");
    return { kind: "console", text: cut(text), page, at };
  }
  if (message?.method === "Runtime.exceptionThrown") {
    const details = params.exceptionDetails ?? {};
    const described = details.exception?.description;
    const base = described !== undefined ? described : details.text;
    const kind =
      details.text === "Uncaught (in promise)" ? "rejection" : "exception";
    return { kind, text: cut(firstLine(base)), page, at };
  }
  if (message?.method === "Log.entryAdded") {
    const entry = params.entry ?? {};
    if (entry.level !== "error") return null;
    const result = { kind: "browser-log", text: cut(String(entry.text ?? "")) };
    if (entry.url !== undefined) result.url = entry.url;
    if (entry.source !== undefined) result.source = entry.source;
    result.page = page;
    result.at = at;
    return result;
  }
  return null;
}

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}

// A declaration is { kind, text, path?, once? }. `text` is compared exactly.
// once: false -> at least one matching entry, no upper limit (expect);
// once: true  -> at least one and at most one (expectOncePerStart).
export function makeDeclaration({ kind, text, path, once = false }) {
  if (typeof kind !== "string" || typeof text !== "string") {
    throw new E2eError("USAGE", "expect: kind and text must be strings");
  }
  if (path !== undefined && typeof path !== "string") {
    throw new E2eError("USAGE", "expect: path must be a string");
  }
  const declaration = { kind, text, once: once === true };
  if (path !== undefined) declaration.path = path;
  return declaration;
}

function matches(entry, declaration) {
  if (entry.kind !== declaration.kind) return false;
  if (entry.text !== declaration.text) return false;
  if (declaration.path !== undefined && pathOf(entry.url) !== declaration.path)
    return false;
  return true;
}

// evaluateConsole(entries, declarations) -> { unexpected, unmet }
// Entries are taken in order; each is claimed by the first declaration (in the
// order of declaring) that matches it and still has room.
export function evaluateConsole(entries, declarations) {
  const counts = declarations.map(() => 0);
  const unexpected = [];
  for (const entry of entries) {
    let claimed = false;
    for (let i = 0; i < declarations.length; i++) {
      const room = declarations[i].once ? counts[i] < 1 : true;
      if (room && matches(entry, declarations[i])) {
        counts[i]++;
        claimed = true;
        break;
      }
    }
    if (!claimed) unexpected.push(entry);
  }
  const unmet = declarations.filter((_, i) => counts[i] === 0);
  return { unexpected, unmet };
}

function describeEntry(entry) {
  return `${entry.kind}: ${safeText(entry.text)}${entry.url ? ` (${safeText(entry.url)})` : ""}`;
}

function describeDeclaration(declaration) {
  return `${declaration.kind}: ${safeText(declaration.text)}${declaration.path ? ` (path ${safeText(declaration.path)})` : ""}`;
}

// At most this many entries of each kind are listed; the counts above them are whole.
const LISTED_MAX = 20;

function listLines(items, describe) {
  const lines = items.slice(0, LISTED_MAX).map((item) => `  ${describe(item)}`);
  if (items.length > LISTED_MAX) {
    lines.push(`  ... and ${items.length - LISTED_MAX} more`);
  }
  return lines;
}

// -> an E2eError CONSOLE_ENTRIES, or null when nothing is wrong
export function consoleError(unexpected, unmet) {
  if (unexpected.length === 0 && unmet.length === 0) return null;
  const lines = [
    `${unexpected.length} unexpected console entries:`,
    ...listLines(unexpected, describeEntry),
    `${unmet.length} declared entries did not happen:`,
    ...listLines(unmet, describeDeclaration),
  ];
  return new E2eError("CONSOLE_ENTRIES", lines.join("\n"), {
    unexpected,
    unmet,
  });
}
