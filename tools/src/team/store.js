// The API of the Sai Team core (design REQ-009, sections 6, 7 and 11): creating a
// project, the writer (the only way to write to a project) and reading.
//
// Every write goes through Writer: the check of the form, masking, the transition,
// the time, the check of the lock and the write are one synchronous call. The
// state is never stored apart from the journal; it is rebuilt from events.jsonl.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { maskSecrets } from "../pixel-office/mask.js";
import { TeamError, eventError, fromOsError, notFoundError } from "./errors.js";
import {
  cleanPartials,
  checkFreeName,
  checkName,
  contentOf,
  publishResultFile,
  readWorkFile,
  removeResultFile,
} from "./files.js";
import {
  EVENTS_FILE,
  FILES_DIR,
  SCENARIO_FILE,
  WORK_DIR,
  ensureHome,
  ensureModes,
  inspectHome,
  modeWarnings,
  resolveHome,
  resolveProjectDir,
} from "./home.js";
import { appendBatch, appendLine, readJournal, truncateTo } from "./journal.js";
import {
  ENGINE_HOLDER,
  acquireLock,
  assertLockHeld,
  cleanLockLeftovers,
  lockHolder,
  releaseLock,
} from "./lock.js";
import { reduce, reduceInPlace, runIdFor, taskIdFor } from "./reducer.js";
import {
  DROPPED_MAX,
  EVENT_TYPES,
  LIMITS,
  PATTERNS,
  checkInput,
  checkWorkPath,
  isCanonicalTs,
  mapTextFields,
} from "./schema.js";
import { eventView, projectSummary } from "./view.js";

const CREATE_ATTEMPTS = 5;
const INPUT_KEYS = ["source", "type", "task", "data", "ts"];
const CREATE_KEYS = ["goal", "budget_usd", "executor", "scenario_bytes"];

function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function codePoints(s) {
  return [...s].length;
}

function homeOf(opts) {
  if (typeof opts.home === "string") return opts.home;
  return resolveHome(opts.env ?? process.env);
}

// The clock: opts.now (tests) or Date.now; milliseconds or a Date.
function clockOf(opts) {
  const now = typeof opts.now === "function" ? opts.now : Date.now;
  return () => {
    const value = now();
    const ms = value instanceof Date ? value.getTime() : value;
    if (typeof ms !== "number" || !Number.isFinite(ms)) {
      throw new TeamError(
        "E_INTERNAL",
        "Внутренняя ошибка ядра Sai Team (now)",
      );
    }
    return ms;
  };
}

function internalError(what) {
  return new TeamError(
    "E_INTERNAL",
    `Внутренняя ошибка ядра Sai Team (${what})`,
  );
}

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

function lineOf(event) {
  const line = `${JSON.stringify(event)}\n`;
  if (Buffer.byteLength(line, "utf8") > LIMITS.LINE_BYTES_MAX) {
    throw new TeamError("E_EVENT_TOO_BIG", "Событие слишком большое");
  }
  return line;
}

function notTextError() {
  return new TeamError("E_EVENT", "Файл результата должен быть текстом UTF-8", {
    field: "bytes",
  });
}

function writerBroken() {
  return new TeamError(
    "E_WRITER_BROKEN",
    "Запись прервана сбоем; откройте проект заново",
  );
}

// ---- the writer -----------------------------------------------------------------

// The internal append of each writer (recovery): it may write the types and the
// values that only the core writes (N4). Not exported, so no caller outside this
// module reaches it; the public append refuses them.
const INTERNAL_APPEND = new WeakMap();
// The internal batch append (recovery, ORCH decision PROD-20261006-01 step 36):
// several core events as one write with consecutive seq; all or nothing.
const INTERNAL_BATCH = new WeakMap();
// The internal mark "broken" (recovery: a failed cut of the journal tail is a
// failed write too).
const INTERNAL_BREAK = new WeakMap();

class Writer {
  #dir;
  #eventsFile;
  #filesDir;
  #pid;
  #clock;
  #bytes;
  #broken = false;
  #closed = false;

  constructor({ id, dir, pid, clock, state, bytes, notices, scenario }) {
    this.id = id;
    this.state = state;
    this.notices = notices;
    this.workDir = path.join(dir, WORK_DIR);
    this.scenarioPath = scenario ? path.join(dir, SCENARIO_FILE) : null;
    this.#dir = dir;
    this.#eventsFile = path.join(dir, EVENTS_FILE);
    this.#filesDir = path.join(dir, FILES_DIR);
    this.#pid = pid;
    this.#clock = clock;
    this.#bytes = bytes;
    INTERNAL_APPEND.set(this, (input) => this.#append(input, true));
    INTERNAL_BATCH.set(this, (inputs) => this.#appendBatch(inputs));
    INTERNAL_BREAK.set(this, () => {
      this.#broken = true;
    });
  }

  // Steps 1-6 of section 6.4: everything except the write. Returns the event, the
  // next state and the line; changes nothing. `state` is the state the event
  // follows (the current one, or the state after the previous events of a batch).
  #prepare(input, internal, state = this.state) {
    if (this.#broken || this.#closed) throw writerBroken();
    if (!isPlainObject(input)) throw eventError("event");
    for (const key of Object.keys(input)) {
      if (!INPUT_KEYS.includes(key)) throw eventError(key);
    }
    const spec = has(EVENT_TYPES, input.type) ? EVENT_TYPES[input.type] : null;
    if (!internal && spec !== null) {
      if (spec.coreOnly) {
        throw new TeamError(
          "E_EVENT",
          `Событие отклонено: тип ${input.type} пишет только ядро`,
          { field: "type" },
        );
      }
      for (const [field, values] of Object.entries(spec.coreOnlyValues)) {
        if (isPlainObject(input.data) && values.includes(input.data[field])) {
          throw new TeamError(
            "E_EVENT",
            `Событие отклонено: значение ${field} = ${input.data[field]} пишет только ядро`,
            { field },
          );
        }
      }
    }
    const base = {
      source: input.source,
      type: input.type,
      task: input.task ?? null,
      data: input.data,
    };
    checkInput(base, { limits: false });
    const data = mapTextFields(base.type, base.data, maskSecrets);
    checkInput({ ...base, data });

    const nowMs = this.#clock();
    let ts = new Date(nowMs).toISOString();
    if (base.source === "ENGINE") {
      if (has(input, "ts")) throw eventError("ts");
    } else if (input.ts !== undefined) {
      if (!isCanonicalTs(input.ts)) throw eventError("ts");
      if (Date.parse(input.ts) > nowMs) {
        throw new TeamError(
          "E_TIME",
          "Время события позже текущего времени компьютера",
          { rule: "И11" },
        );
      }
      ts = input.ts;
    }
    const event = {
      seq: state.last_seq + 1,
      ts,
      project: this.id,
      task: base.task,
      source: base.source,
      type: base.type,
      data,
    };
    const next = reduce(state, event);
    return { event, next, line: lineOf(event) };
  }

  // Step 7-9 of section 6.4: the write. Any failure breaks the writer (F1).
  #commit(prepared) {
    try {
      this.#bytes = appendLine(
        this.#eventsFile,
        this.#bytes,
        prepared.line,
        () => assertLockHeld(this.#dir, this.#pid),
      );
    } catch (err) {
      this.#broken = true;
      throw err instanceof TeamError ? err : fromOsError(err, "write");
    }
    this.state = prepared.next;
    return prepared.event;
  }

  #append(input, internal) {
    return this.#commit(this.#prepare(input, internal));
  }

  // Core events as one batch: each is prepared on the state after the previous
  // ones (consecutive seq), then all lines are written by one write and one fsync
  // after one check of the lock; a failure cuts the journal back to where it was
  // and breaks the writer (F1). Returns the events and the state after each (the
  // caller reads the state between events, e.g. the status for step 8.6).
  #appendBatch(inputs) {
    if (inputs.length === 0) return [];
    const prepared = [];
    let state = this.state;
    for (const input of inputs) {
      const one = this.#prepare(input, true, state);
      prepared.push(one);
      state = one.next;
    }
    try {
      this.#bytes = appendBatch(
        this.#eventsFile,
        this.#bytes,
        prepared.map((p) => p.line),
        () => assertLockHeld(this.#dir, this.#pid),
      );
    } catch (err) {
      this.#broken = true;
      throw err instanceof TeamError ? err : fromOsError(err, "write");
    }
    this.state = state;
    return prepared.map((p) => p.event);
  }

  append(input) {
    return this.#append(input, false);
  }

  say(text) {
    if (typeof text !== "string") throw eventError("text");
    if (
      codePoints(text) > LIMITS.TEXT_MAX ||
      codePoints(maskSecrets(text)) > LIMITS.TEXT_MAX
    ) {
      throw new TeamError(
        "E_TOO_LONG",
        `Сообщение длиннее ${LIMITS.TEXT_MAX} знаков — сократите его`,
      );
    }
    return this.append({
      source: "USER",
      type: "CHAT",
      task: null,
      data: { text, kind: "message", truncated: false },
    });
  }

  // (r13, C7) The clean-up of the channel of the engine: the nonces of messages
  // that were not executed, by DROPPED_MAX in one CHAT of the engine each, all
  // parts as one batch (all or nothing, one fsync). textFor(count, part, parts)
  // gives the text of a part. An empty list writes nothing.
  recordDropped(ids, textFor) {
    if (!Array.isArray(ids)) throw eventError("dropped");
    if (typeof textFor !== "function") throw eventError("text");
    if (ids.length === 0) return [];
    const sorted = [...ids].sort();
    const parts = [];
    for (let i = 0; i < sorted.length; i += DROPPED_MAX) {
      parts.push(sorted.slice(i, i + DROPPED_MAX));
    }
    return this.#appendBatch(
      parts.map((part, i) => ({
        source: "ENGINE",
        type: "CHAT",
        task: null,
        data: {
          text: textFor(part.length, i + 1, parts.length),
          kind: "message",
          truncated: false,
          dropped: part,
        },
      })),
    );
  }

  addTask(task, source = "ENGINE") {
    if (!isPlainObject(task)) throw eventError("task");
    const {
      role,
      text,
      done_when: doneWhen,
      depends_on: dependsOn = [],
      critical = false,
    } = task;
    return this.append({
      source,
      type: "TASK_CREATED",
      task: this.nextTaskId(),
      data: {
        role,
        text,
        done_when: doneWhen,
        depends_on: dependsOn,
        critical,
      },
    });
  }

  addMemory(memory, source = "ENGINE") {
    if (!isPlainObject(memory)) throw eventError("memory");
    const { kind, text, task = null, executor = null } = memory;
    const data = { kind, text };
    if (source === "AGENT") {
      if (executor === null) throw eventError("executor");
      data.executor = executor;
    } else if (executor !== null) {
      throw eventError("executor");
    }
    return this.append({ source, type: "MEMORY_ADDED", task, data });
  }

  // Sections 6.6 and 6.7: the file, then its event RESULT_FILE (only the core
  // writes it). A failed event removes the file again.
  #publish({ task, name, content, kind, fromWork }) {
    if (this.#broken || this.#closed) throw writerBroken();
    checkFreeName(this.#filesDir, name);
    if (typeof content !== "string") throw eventError("content");
    const masked = maskSecrets(content);
    const { bytes, sha256 } = contentOf(masked);
    const prepared = this.#prepare(
      {
        source: "ENGINE",
        type: "RESULT_FILE",
        task,
        data: { name, bytes, sha256, kind, from_work: fromWork },
      },
      true,
    );
    const written = publishResultFile(this.#filesDir, name, masked);
    if (written.sha256 !== sha256) throw internalError("sha256");
    try {
      return this.#commit(prepared);
    } catch (err) {
      if (!removeResultFile(this.#filesDir, name)) {
        err.details = { ...err.details, cleanup: "failed" };
      }
      throw err;
    }
  }

  writeResultFile(file) {
    if (!isPlainObject(file)) throw eventError("file");
    const { task = null, name, content, kind = "result" } = file;
    return this.#publish({ task, name, content, kind, fromWork: false });
  }

  importWorkFile(file) {
    if (!isPlainObject(file)) throw eventError("file");
    const { task = null, path: rel, kind = "result" } = file;
    if (!checkWorkPath(rel).ok) {
      throw new TeamError(
        "E_WORK_FILE",
        "Файл результата не найден в рабочей папке или недопустим",
        { reason: "path" },
      );
    }
    const name = file.name ?? rel.split("/").pop();
    checkName(name);
    if (this.#broken || this.#closed) throw writerBroken();
    const content = readWorkFile(this.workDir, rel);
    return this.#publish({ task, name, content, kind, fromWork: true });
  }

  // Section 6.8 (r4): a result file the executor holds in memory (the test
  // executor writes nothing to disk). Strict UTF-8 text only, as from work/.
  importResultBytes(file) {
    if (this.#broken || this.#closed) throw writerBroken();
    if (!isPlainObject(file)) throw eventError("file");
    const { task = null, name, bytes, kind = "result" } = file;
    checkName(name);
    if (!Buffer.isBuffer(bytes)) throw notTextError();
    if (bytes.length > LIMITS.FILE_BYTES_MAX) {
      throw new TeamError("E_EVENT", "Файл результата слишком большой", {
        field: "bytes",
      });
    }
    let content;
    try {
      content = strictUtf8.decode(bytes);
    } catch {
      throw notTextError();
    }
    return this.#publish({ task, name, content, kind, fromWork: false });
  }

  nextTaskId() {
    return taskIdFor(this.state.tasks.length + 1);
  }

  nextRunId() {
    return runIdFor(this.state.runs.next);
  }

  // true once a write of the journal failed (write, fsync, ftruncate, the lock or
  // the size check): this writer cannot write any more.
  get broken() {
    return this.#broken;
  }

  // The caller could not finish what it wrote (an open run it cannot close): the
  // writer is treated as broken and keeps its lock on close().
  markBroken() {
    this.#broken = true;
  }

  // Gives the right to write back. Never throws; a lock left behind becomes stale
  // when the process ends. A broken writer keeps its lock (rule 1 of ORCH,
  // PROD-20261006-01 step 16): its open runs could not be closed, so the project is
  // left as after a crash, and the next writer recovers it once this process is
  // gone (section 6.3, step 8); until then the project is busy.
  close() {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#broken) return;
    releaseLock(this.#dir, this.#pid);
  }
}

// ---- creating a project (section 6.5) ----------------------------------------------

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

function checkScenario(bytes, executor) {
  if (bytes === null) return;
  if (executor !== "scripted") {
    throw new TeamError(
      "E_EVENT",
      "Сценарий допустим только для тестового исполнителя",
      { field: "scenario_bytes" },
    );
  }
  if (!Buffer.isBuffer(bytes) || bytes.length > LIMITS.SCENARIO_BYTES_MAX) {
    throw eventError("scenario_bytes");
  }
  let value;
  try {
    value = JSON.parse(strictUtf8.decode(bytes));
  } catch {
    throw eventError("scenario_bytes");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw eventError("scenario_bytes");
  }
}

function randomHex(opts) {
  const value =
    typeof opts.randomId === "function"
      ? opts.randomId()
      : crypto.randomBytes(3);
  const hex = Buffer.isBuffer(value) ? value.toString("hex") : value;
  if (typeof hex !== "string" || !/^[0-9a-f]{6}$/.test(hex)) {
    throw internalError("randomId");
  }
  return hex;
}

export function createProject(input, opts = {}) {
  if (!isPlainObject(input)) throw eventError("input");
  for (const key of Object.keys(input)) {
    if (!CREATE_KEYS.includes(key)) throw eventError(key);
  }
  const scenario = input.scenario_bytes ?? null;
  const raw = {
    goal: input.goal,
    budget_usd: input.budget_usd,
    executor: input.executor,
    scenario_file: scenario === null ? null : SCENARIO_FILE,
  };
  const base = { source: "ENGINE", type: "PROJECT_CREATED", task: null };
  if (scenario !== null && input.executor !== "scripted") {
    checkScenario(scenario, input.executor);
  }
  checkInput({ ...base, data: raw }, { limits: false });
  const data = mapTextFields("PROJECT_CREATED", raw, maskSecrets);
  checkInput({ ...base, data });
  checkScenario(scenario, data.executor);

  const home = homeOf(opts);
  const clock = clockOf(opts);
  const notices = ensureHome(home);
  const ts = new Date(clock()).toISOString();
  const day = ts.slice(0, 10).replaceAll("-", "");

  let id = null;
  for (let i = 0; i < CREATE_ATTEMPTS && id === null; i += 1) {
    const candidate = `p-${day}-${randomHex(opts)}`;
    try {
      if (
        lstatOrNull(path.join(home, candidate)) === null &&
        lstatOrNull(path.join(home, `.creating-${candidate}`)) === null
      ) {
        id = candidate;
      }
    } catch (err) {
      throw fromOsError(err, "write");
    }
  }
  if (id === null) {
    throw new TeamError(
      "E_DISK",
      "Не удалось записать на диск (EEXIST); данные проекта не изменены",
      { os_code: "EEXIST" },
    );
  }

  const event = { seq: 1, ts, project: id, task: null, ...base, data };
  const ordered = {
    seq: event.seq,
    ts: event.ts,
    project: event.project,
    task: event.task,
    source: event.source,
    type: event.type,
    data: event.data,
  };
  const state = reduce(null, ordered);
  const line = lineOf(ordered);

  const creating = path.join(home, `.creating-${id}`);
  const final = path.join(home, id);
  let made = false;
  try {
    fs.mkdirSync(creating, { mode: 0o700 });
    made = true;
    fs.mkdirSync(path.join(creating, FILES_DIR), { mode: 0o700 });
    fs.mkdirSync(path.join(creating, WORK_DIR), { mode: 0o700 });
    if (scenario !== null) {
      fs.writeFileSync(path.join(creating, SCENARIO_FILE), scenario, {
        flag: "wx",
        mode: 0o600,
        flush: true,
      });
    }
    fs.writeFileSync(path.join(creating, EVENTS_FILE), Buffer.from(line), {
      flag: "wx",
      mode: 0o600,
      flush: true,
    });
    if (lstatOrNull(final) !== null) {
      throw Object.assign(new Error("project exists"), { code: "EEXIST" });
    }
    fs.renameSync(creating, final);
  } catch (err) {
    if (made) {
      try {
        fs.rmSync(creating, { recursive: true, force: true });
      } catch {
        // A leftover .creating-* is skipped by reading (section 6.5, step 6).
      }
    }
    throw fromOsError(err, "write");
  }
  return { id, state, notices };
}

// ---- opening for writing (section 6.3) ---------------------------------------------

// (r13, C4) opts.holder: only "engine" (the engine of REQ-013); absent — null.
function lockHolderOf(opts) {
  if (opts.holder === undefined || opts.holder === null) return null;
  if (opts.holder !== ENGINE_HOLDER) throw internalError("holder");
  return ENGINE_HOLDER;
}

export function openWriter(id, opts = {}) {
  const home = homeOf(opts);
  const clock = clockOf(opts);
  const lockAs = lockHolderOf(opts);
  const pid = process.pid;
  const dir = resolveProjectDir(home, id);
  const holder = lockHolder(dir);
  if (holder !== null && holder.alive) {
    throw new TeamError(
      "E_PROJECT_BUSY",
      `Проект занят другим процессом (pid ${holder.pid})`,
      { pid: holder.pid },
    );
  }
  const eventsFile = path.join(dir, EVENTS_FILE);
  readJournal(eventsFile, id);
  const { stalePid } = acquireLock(
    dir,
    pid,
    new Date(clock()).toISOString(),
    lockAs,
  );
  let writer = null;
  try {
    const journal = readJournal(eventsFile, id);
    const notices = [];
    notices.push(...ensureModes(dir));
    cleanLockLeftovers(dir);
    cleanPartials(path.join(dir, FILES_DIR));
    let scenario;
    try {
      scenario = lstatOrNull(path.join(dir, SCENARIO_FILE)) !== null;
    } catch (err) {
      throw fromOsError(err, "read");
    }
    writer = new Writer({
      id,
      dir,
      pid,
      clock,
      state: journal.state,
      bytes: journal.bytes,
      notices,
      scenario: scenario && journal.state.scenario_file !== null,
    });
    recover(writer, journal, eventsFile, stalePid, notices);
    return writer;
  } catch (err) {
    // A recovery whose write failed leaves the lock (close() of a broken writer):
    // the crash is still there for the next writer.
    if (writer === null) releaseLock(dir, pid);
    else writer.close();
    throw err;
  }
}

// Step 8 of section 6.3: the events of recovery through the internal append
// (steps 8.2-8.3, one write each) and the internal batch append (steps 8.4-8.6,
// one write for all).
// (r8, S1) The writer that got the lock recovers by the journal, not by who
// removed a stale lock: the last line is cut off, or there is unclosed work (open
// runs or running tasks). Under a new lock the previous holder is gone, and a
// cleanly closed writer leaves no open runs (И22), so such work has no writer.
// stalePid is only a notice (step 8.2): in a race of openers one process removes
// the stale lock and another takes the free name. Without any sign nothing is
// written and nothing is interrupted (also after a clean close(); a review task
// without an open run is not a sign). After recovery no sign is left, so it runs
// exactly once.
function recover(writer, journal, eventsFile, stalePid, notices) {
  const appendInternal = INTERNAL_APPEND.get(writer);
  if (journal.tail !== null) {
    try {
      truncateTo(eventsFile, journal.bytes);
    } catch (err) {
      INTERNAL_BREAK.get(writer)();
      throw err;
    }
  }
  if (stalePid !== null) {
    appendInternal({
      source: "ENGINE",
      type: "LOCK_STALE_REMOVED",
      data: { pid: stalePid },
    });
    notices.push(
      `Снят устаревший замок процесса ${stalePid}: проект снова доступен`,
    );
  }
  if (journal.tail !== null) {
    appendInternal({
      source: "ENGINE",
      type: "JOURNAL_RECOVERED",
      data: { line: journal.tail.line, dropped_bytes: journal.tail.bytes },
    });
    notices.push(
      `Журнал восстановлен: отброшена недописанная строка ${journal.tail.line} (${journal.tail.bytes} байт)`,
    );
  }
  // Steps 8.4-8.6 as one batch (ORCH decision PROD-20261006-01 step 36): a writer
  // that lost its lock between closing runs and PROJECT_RECOVERED would leave the
  // project "running" with no work and no sign of recovery for the next writer.
  // Step 8.4: close every open run, in run_id order.
  const state = writer.state;
  const openRuns = Object.entries(state.runs.open).sort(([a], [b]) =>
    a < b ? -1 : 1,
  );
  const reviewInterrupted = new Set();
  const batch = [];
  for (const [runId, run] of openRuns) {
    batch.push({
      source: "ENGINE",
      type: "RUN_FINISHED",
      task: run.task,
      data: {
        run_id: runId,
        outcome: "interrupted",
        summary: null,
        cost_usd: null,
        files: [],
      },
    });
    if (run.purpose === "review" && run.task !== null) {
      reviewInterrupted.add(run.task);
    }
  }
  // Step 8.5: interrupt every running task (I8: also without an open run) and
  // every review task whose review run was closed in step 8.4 (И21); a review
  // task without an open run waits for its check and stays review. Closing a run
  // changes no task status, so the tasks are read from the state before the batch.
  const interrupted = state.tasks
    .filter(
      (t) =>
        t.status === "running" ||
        (t.status === "review" && reviewInterrupted.has(t.id)),
    )
    .map((t) => t.id)
    .sort();
  for (const taskId of interrupted) {
    batch.push({
      source: "ENGINE",
      type: "TASK_INTERRUPTED",
      task: taskId,
      data: { cause: "recovery" },
    });
  }
  // Step 8.6: the project pauses only if something was interrupted. Neither
  // RUN_FINISHED nor TASK_INTERRUPTED changes the project status.
  const status = state.status;
  const pauses =
    (status === "planning" || status === "running") &&
    openRuns.length + interrupted.length > 0;
  if (pauses) {
    batch.push({
      source: "ENGINE",
      type: "PROJECT_RECOVERED",
      data: {
        from_status: status,
        closed_runs: openRuns.length,
        interrupted_tasks: interrupted.length,
      },
    });
  }
  INTERNAL_BATCH.get(writer)(batch);
  if (openRuns.length > 0) {
    notices.push(`Закрыты прерванные запуски: ${openRuns.length}`);
  }
  if (interrupted.length > 0) {
    notices.push(`Прерваны задачи: ${interrupted.join(", ")}`);
  }
  if (pauses) {
    notices.push(
      "Работа проекта прервалась — продолжите её командой возобновления",
    );
  }
}

// ---- reading (section 7.3) --------------------------------------------------------

function openForReading(id, opts) {
  if (typeof id !== "string" || !PATTERNS.project.test(id)) {
    throw notFoundError();
  }
  const home = homeOf(opts);
  const { exists, warnings } = inspectHome(home);
  if (!exists) throw notFoundError();
  const dir = resolveProjectDir(home, id);
  const journal = readJournal(path.join(dir, EVENTS_FILE), id);
  return {
    journal,
    warnings: [...new Set([...warnings, ...modeWarnings(dir)])],
  };
}

export function listProjects(opts = {}) {
  const home = homeOf(opts);
  const { exists, warnings } = inspectHome(home);
  if (!exists) return { projects: [], warnings };
  let names;
  try {
    names = fs.readdirSync(home);
  } catch (err) {
    throw fromOsError(err, "read");
  }
  const projects = [];
  const all = new Set(warnings);
  for (const name of names.filter((n) => PATTERNS.project.test(n)).sort()) {
    try {
      const dir = resolveProjectDir(home, name);
      const journal = readJournal(path.join(dir, EVENTS_FILE), name);
      for (const w of modeWarnings(dir)) all.add(w);
      projects.push({ state: journal.state, tail: journal.tail });
    } catch (err) {
      if (!(err instanceof TeamError)) throw err;
      if (err.code === "E_NOT_FOUND") continue;
      projects.push({
        id: name,
        error: { code: err.code, message: err.message },
      });
    }
  }
  projects.sort((a, b) => {
    const ka = a.state?.created_at ?? "~";
    const kb = b.state?.created_at ?? "~";
    if (ka !== kb) return ka < kb ? -1 : 1;
    const ia = a.state?.id ?? a.id;
    const ib = b.state?.id ?? b.id;
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
  return {
    projects: projects.map((p) =>
      p.state === undefined ? p : projectSummary(p.state, p.tail),
    ),
    warnings: [...all],
  };
}

export function readProject(id, opts = {}) {
  const { journal, warnings } = openForReading(id, opts);
  return {
    state: journal.state,
    tail: journal.tail,
    events: journal.events,
    warnings,
  };
}

function usage(message) {
  return new TeamError("E_USAGE", message);
}

export function readEvents(id, opts = {}) {
  const after = opts.after ?? 0;
  const limit = opts.limit ?? LIMITS.PAGE_DEFAULT;
  if (!Number.isSafeInteger(after) || after < 0) {
    throw usage("--after: целое ≥ 0");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMITS.PAGE_MAX) {
    throw usage(`--limit: целое от 1 до ${LIMITS.PAGE_MAX}`);
  }
  const { journal, warnings } = openForReading(id, opts);
  const events = [];
  const views = [];
  let state = null;
  let more = false;
  for (const event of journal.events) {
    if (event.seq > after) {
      if (events.length === limit) {
        more = true;
        break;
      }
      events.push(event);
      views.push(eventView(event, state));
    }
    state = reduceInPlace(state, event);
  }
  return {
    events,
    views,
    next_after: more ? events[events.length - 1].seq : null,
    tail: journal.tail,
    warnings,
  };
}
