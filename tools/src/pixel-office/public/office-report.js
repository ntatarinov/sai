// A report of the office over a journal, for the step "real session" of the
// acceptance (design 3.8): the same functions that the page calls, run in Node
// over the lines of a journal file.
//
//   node office-report.js --journal <file> [--session <id>]
//
// This is a program for Node, not a pure module: it reads files and writes to
// the output. The browser never loads it. It writes nothing to the journal or
// anywhere else, so the journal is the same before and after.
//
// Exit code: 0 the report is printed; 1 nothing can be reported (no file, a
// directory instead of it, not readable, no valid lines, no lines of the
// session); 2 wrong use. Messages are in Russian on stderr, without a stack
// trace; on a failure stdout is empty.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NODE_REFUSAL_EXIT, refuseBelowNodeFloor } from "../../node-floor.js";
import { buildModel } from "./model.js";
import { MAIN_KEY, buildOffice, countStates } from "./office-model.js";
import { parseLine } from "./schema.js";

const STARTS_FILE = "server-starts.jsonl";
const USAGE =
  "Использование: node office-report.js --journal <файл> [--session <идентификатор>]";

// Only a failure to read a file: it has a message for the user.
class ReportError extends Error {
  constructor(message, code) {
    super(message);
    this.exitCode = code;
  }
}

// --------------------------------------------------------------- arguments

// Returns {journal, session} or {error}. Unknown key, a key without a value,
// a key given twice, an empty value: wrong use.
function parseArgs(argv) {
  let journal = null;
  let session = null;
  let sessionGiven = false;
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key !== "--journal" && key !== "--session") {
      return { error: `неизвестный аргумент «${key}»` };
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      return { error: `у ключа ${key} нет значения` };
    }
    i += 1;
    if (value === "") return { error: `у ключа ${key} пустое значение` };
    if (key === "--journal") {
      if (journal !== null) return { error: "ключ --journal задан дважды" };
      journal = value;
    } else {
      if (sessionGiven) return { error: "ключ --session задан дважды" };
      sessionGiven = true;
      session = value;
    }
  }
  if (journal === null) return { error: "не указан ключ --journal" };
  return { journal, session };
}

// ------------------------------------------------------------------- files

// Reads a text file; an error of the system becomes a message in Russian.
// What: what the file is, for the message.
function readText(file, what, missingIsEmpty) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    const code = err !== null && typeof err === "object" ? err.code : undefined;
    if (missingIsEmpty && (code === "ENOENT" || code === "ENOTDIR")) {
      return null;
    }
    if (code === "ENOENT" || code === "ENOTDIR") {
      throw new ReportError(`${what} не найден: ${file}`, 1);
    }
    if (code === "EISDIR") {
      throw new ReportError(`${what}: вместо файла каталог: ${file}`, 1);
    }
    if (code === "EACCES" || code === "EPERM") {
      throw new ReportError(`${what} не читается (нет прав): ${file}`, 1);
    }
    throw new ReportError(
      `${what} не читается: ${file} (код ошибки ${code ?? "неизвестен"})`,
      1,
    );
  }
}

// The complete lines of a text: those that end with a newline. A tail without
// one is a line that is still being written and is not counted (as on the
// server).
function completeLines(text) {
  const end = text.lastIndexOf("\n");
  return end < 0 ? [] : text.slice(0, end).split("\n");
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // A line that is not JSON is a corrupted line.
    return undefined;
  }
}

// ------------------------------------------------------------------ report

// Builds the report object from the lines of the journal (null for the lines
// that are not valid), the records of server starts and the clock. session:
// null for the whole journal.
export function buildReport(entries, starts, nowMs, session) {
  const model = buildModel(entries, starts, nowMs);
  const office = buildOffice(model);
  const inScope = (sessionId) => session === null || sessionId === session;

  let events = 0;
  let trusted = 0;
  let skipped = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i] === null) {
      skipped += 1;
      continue;
    }
    if (!inScope(entries[i].session_id)) continue;
    events += 1;
    if (model.trusted[i]) trusted += 1;
  }

  const sessions = model.sessions.filter((s) => inScope(s.session_id));
  const rows = model.mainRows.filter((r) => inScope(r.session_id));
  const mainCharacter = office.characters.find((c) => c.key === MAIN_KEY);
  const main = {
    present: sessions.length > 0,
    sessions_running: sessions.filter((s) => s.running).length,
    working:
      session === null
        ? mainCharacter !== undefined && mainCharacter.working
        : rows.some((r) => r.state === "in_progress"),
  };

  const tasks = model.tasks.filter((t) => inScope(t.session_id));
  const taskKeys = new Set(tasks.map((t) => t.key));
  // A character for every role that has a task in the scope, in the order of
  // the desks. Every role with a task has a desk, so desk_index is a number.
  const roles = [];
  for (const character of office.characters) {
    if (character.kind !== "role") continue;
    const mine = tasks.filter((t) => t.role === character.full);
    if (mine.length === 0) continue;
    const counts = countStates(mine);
    roles.push({
      key: character.key,
      role: character.full,
      desk_index: character.desk_index,
      working: counts.in_progress > 0,
      working_count: counts.in_progress,
      counts,
    });
  }
  const routes = office.routes
    .filter((r) => taskKeys.has(r.task_key))
    .map((r) => ({
      kind: r.kind,
      walker: r.walker,
      target: r.target,
      from_cell: r.from_cell,
      to_cell: r.to_cell,
    }));

  return {
    session,
    events,
    trusted,
    skipped_lines: skipped,
    main,
    roles,
    routes,
  };
}

// Runs the command. argv: the arguments after the name of the program; io:
// {stdout, stderr} with the method write; nowFn: the clock (milliseconds), the
// real one by default. Returns the exit code.
export function runReport(argv, io = process, nowFn = Date.now) {
  // The Node floor (REQ-110), before the arguments and the journal are read.
  if (refuseBelowNodeFloor(io.stderr)) return NODE_REFUSAL_EXIT;
  const out = (text) => io.stdout.write(text);
  const err = (text) => io.stderr.write(`${text}\n`);
  try {
    const args = parseArgs(argv);
    if (args.error !== undefined) {
      err(`Ошибка: ${args.error}.`);
      err(USAGE);
      return 2;
    }

    const text = readText(args.journal, "Журнал", false);
    const entries = [];
    let skipped = 0;
    for (const raw of completeLines(text)) {
      const line = parseLine(parseJson(raw));
      if (line === null) skipped += 1;
      entries.push(line);
    }
    if (skipped > 0) {
      err(`Предупреждение: пропущено испорченных строк журнала: ${skipped}.`);
    }
    if (entries.every((e) => e === null)) {
      throw new ReportError(
        `Нечего отчитывать: в журнале нет годных строк: ${args.journal}`,
        1,
      );
    }

    // The starts of the server are in the same directory as the journal; if
    // there is no such file, there were no records.
    const startsFile = path.join(path.dirname(args.journal), STARTS_FILE);
    const startsText = readText(startsFile, "Файл запусков сервера", true);
    const starts = [];
    let startsSkipped = 0;
    if (startsText !== null) {
      for (const raw of completeLines(startsText)) {
        const value = parseJson(raw);
        const good =
          value !== null &&
          typeof value === "object" &&
          typeof value.time === "string" &&
          Number.isInteger(value.journal_lines) &&
          value.journal_lines >= 0;
        if (good) starts.push(value);
        else startsSkipped += 1;
      }
    }
    if (startsSkipped > 0) {
      err(
        `Предупреждение: пропущено испорченных записей запусков сервера: ${startsSkipped}.`,
      );
    }

    if (
      args.session !== null &&
      !entries.some((e) => e !== null && e.session_id === args.session)
    ) {
      throw new ReportError(
        `В журнале нет строк сессии ${args.session}: ${args.journal}`,
        1,
      );
    }

    const report = buildReport(entries, starts, nowFn(), args.session);
    out(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (e) {
    if (e instanceof ReportError) {
      err(e.message);
      return e.exitCode;
    }
    // A defect of the program, not of the input: a message, never a trace.
    err(`Внутренняя ошибка отчёта: ${e instanceof Error ? e.message : e}`);
    return 1;
  }
}

// True if this file is the program that Node was started with.
function isMain() {
  try {
    return (
      typeof process.argv[1] === "string" &&
      fs.realpathSync(process.argv[1]) ===
        fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    // The path of the program cannot be resolved: then it was not started
    // as a program.
    return false;
  }
}

if (isMain()) process.exitCode = runReport(process.argv.slice(2));
