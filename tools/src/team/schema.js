// The single event schema of Sai Team (design REQ-009, sections 3 and 4): the line of
// the journal, the catalog of the 37 event types, the statuses, the limits, the
// patterns and the check of the form of an event. A pure module without Node API.
import { eventError } from "./errors.js";
import { ROLE_CODES } from "./roles.js";

export const SOURCES = Object.freeze(["ENGINE", "AGENT", "USER"]);
export const EXECUTORS = Object.freeze(["claude-cli", "scripted"]);

// The keys of a journal line, in this order (section 3.1).
export const EVENT_KEYS = Object.freeze([
  "seq",
  "ts",
  "project",
  "task",
  "source",
  "type",
  "data",
]);

export const PROJECT_STATUS = Object.freeze([
  "created",
  "planning",
  "running",
  "paused",
  "waiting_user",
  "stopped",
  "done",
  "failed",
]);

export const TASK_STATUS = Object.freeze([
  "waiting",
  "running",
  "review",
  "done",
  "failed",
  "waiting_user",
  "interrupted",
]);

export const PROJECT_STATUS_TEXT = Object.freeze({
  created: "создан",
  planning: "планирование",
  running: "в работе",
  paused: "на паузе",
  waiting_user: "ждёт решения пользователя",
  stopped: "остановлен",
  done: "выполнен",
  failed: "не удалось",
});

export const TASK_STATUS_TEXT = Object.freeze({
  waiting: "ждёт",
  running: "в работе",
  review: "на проверке",
  done: "готово",
  failed: "не удалось",
  waiting_user: "ждёт решения пользователя",
  interrupted: "прервана",
});

export const FINAL_PROJECT_STATUS = Object.freeze([
  "stopped",
  "done",
  "failed",
]);

export const LIMITS = Object.freeze({
  GOAL_MAX: 2000,
  TEXT_MAX: 4000,
  DONE_WHEN_MAX: 2000,
  SUMMARY_MAX: 2000,
  DETAIL_MAX: 500,
  FILE_NAME_MAX: 80,
  WORK_PATH_MAX: 255,
  WORK_PATH_PARTS_MAX: 8,
  FILE_BYTES_MAX: 5 * 1024 * 1024,
  SCENARIO_BYTES_MAX: 1024 * 1024,
  LINE_BYTES_MAX: 1024 * 1024,
  PLAN_TASKS_MAX: 40,
  PROJECT_TASKS_MAX: 200,
  RUN_FILES_MAX: 50,
  PAGE_DEFAULT: 50,
  PAGE_MAX: 200,
  TIME_SKEW_MS: 2000,
  BUDGET_MAX: 100000,
});

export const PATTERNS = Object.freeze({
  project: /^p-[0-9]{8}-[0-9a-f]{6}$/,
  task: /^t-[0-9]{4}$/,
  run: /^r-[0-9]{5}$/,
  hash: /^[0-9a-f]{64}$/,
  ts: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  name: /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}$/,
});

// ISO 8601 UTC with milliseconds, exactly in the form of Date#toISOString().
export function isCanonicalTs(s) {
  if (typeof s !== "string" || !PATTERNS.ts.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t) && new Date(t).toISOString() === s;
}

// ---- kinds of fields (section 3.4) ------------------------------------------------

const text = (max, extra = {}) => ({ kind: "text", max, ...extra });
const code = (values, extra = {}) => ({ kind: "code", values, ...extra });
const int = (min, max = Number.MAX_SAFE_INTEGER, extra = {}) => ({
  kind: "int",
  min,
  max,
  ...extra,
});
const money = (min = 0, max = Infinity, extra = {}) => ({
  kind: "money",
  min,
  max,
  ...extra,
});
const bool = () => ({ kind: "bool" });
const taskId = () => ({ kind: "id", pattern: "task" });
const runId = () => ({ kind: "id", pattern: "run" });
const name = (extra = {}) => ({ kind: "name", ...extra });
const hash = () => ({ kind: "hash" });
const list = (max, item, min = 0) => ({ kind: "list", max, min, item });
const object = (fields) => ({ kind: "object", fields });

const L = LIMITS;
const ROUND = int(0, 2);
const PLAN_TASK = object({
  id: taskId(),
  role: code(ROLE_CODES),
  text: text(L.TEXT_MAX),
  done_when: text(L.DONE_WHEN_MAX),
  depends_on: list(L.PLAN_TASKS_MAX, taskId()),
  critical: bool(),
});

function type(sources, task, fields, extra = {}) {
  return Object.freeze({
    sources: Object.freeze(sources),
    task,
    fields: Object.freeze(fields),
    coreOnly: extra.coreOnly === true,
    coreOnlyValues: Object.freeze(extra.coreOnlyValues ?? {}),
  });
}

// task: "required" | "none" | "optional" | "by_purpose" (RUN_STARTED: required for
// work and review, none for plan and goal_check) | "by_run" (as the task of its
// RUN_STARTED; the reducer compares, rule И7).
export const EVENT_TYPES = Object.freeze({
  PROJECT_CREATED: type(
    ["ENGINE"],
    "none",
    {
      goal: text(L.GOAL_MAX),
      budget_usd: money(0, L.BUDGET_MAX),
      executor: code(EXECUTORS),
      scenario_file: code(["scenario.json"], { nullable: true }),
    },
    { coreOnly: true },
  ),
  PROJECT_STARTED: type(["USER"], "none", { parallel: int(1, 3) }),
  PLANNING_STARTED: type(["ENGINE"], "none", { round: ROUND }),
  PLAN_REJECTED: type(["ENGINE"], "none", {
    round: ROUND,
    attempt: int(1, 2),
    reason: code([
      "schema",
      "cycle",
      "too_many",
      "unknown_role",
      "bad_dependency",
    ]),
    detail: text(L.DETAIL_MAX),
  }),
  PLAN_RETRY: type(["ENGINE"], "none", { round: ROUND, attempt: int(2, 2) }),
  PLAN_RECEIVED: type(["ENGINE"], "none", {
    round: ROUND,
    tasks: list(L.PLAN_TASKS_MAX, PLAN_TASK, 1),
  }),
  PROJECT_WAITING: type(["ENGINE"], "optional", {
    reason: code([
      "plan_failed",
      "budget",
      "task_failed",
      "review_failed",
      "approval",
      "goal_check_failed",
    ]),
  }),
  PROJECT_PAUSED: type(["USER"], "none", {}),
  PROJECT_RESUMED: type(["USER", "ENGINE"], "none", {
    parallel: int(1, 3, { nullable: true }),
    after: code(["command", "decision", "budget", "recovery"]),
  }),
  PROJECT_RECOVERED: type(
    ["ENGINE"],
    "none",
    {
      from_status: code(["planning", "running"]),
      closed_runs: int(0),
      interrupted_tasks: int(0),
    },
    { coreOnly: true },
  ),
  PROJECT_STOPPED: type(["USER"], "none", {}),
  PROJECT_DONE: type(["ENGINE"], "none", {}),
  PROJECT_FAILED: type(["ENGINE"], "none", {
    reason: code(["user_rejected", "unrecoverable"]),
    detail: text(L.DETAIL_MAX),
  }),
  GOAL_CHECK_STARTED: type(["ENGINE"], "none", {
    round: ROUND,
    run_id: runId(),
  }),
  GOAL_CHECK_RESULT: type(["ENGINE"], "none", {
    round: ROUND,
    run_id: runId(),
    passed: bool(),
    notes: text(L.TEXT_MAX),
  }),
  BUDGET_SPENT: type(["ENGINE"], "optional", {
    run_id: runId(),
    cost_usd: money(),
    accounted: code(["reported", "assumed"]),
    total_usd: money(),
  }),
  BUDGET_SET: type(["USER"], "none", { budget_usd: money(0, L.BUDGET_MAX) }),
  CHAT: type(["USER", "ENGINE"], "optional", {
    text: text(L.TEXT_MAX),
    kind: code(["message", "question"]),
    truncated: bool(),
  }),
  MEMORY_ADDED: type(["ENGINE", "AGENT", "USER"], "optional", {
    kind: code(["fact", "decision", "note"]),
    text: text(L.TEXT_MAX),
    executor: code(EXECUTORS, { optional: true }),
  }),
  RESULT_FILE: type(
    ["ENGINE"],
    "optional",
    {
      name: name(),
      bytes: int(0, L.FILE_BYTES_MAX),
      sha256: hash(),
      kind: code(["result", "draft"]),
      from_work: bool(),
    },
    { coreOnly: true },
  ),
  LOCK_STALE_REMOVED: type(
    ["ENGINE"],
    "none",
    { pid: int(1) },
    { coreOnly: true },
  ),
  JOURNAL_RECOVERED: type(
    ["ENGINE"],
    "none",
    { line: int(2), dropped_bytes: int(1) },
    { coreOnly: true },
  ),
  TASK_CREATED: type(["ENGINE", "USER"], "required", {
    role: code(ROLE_CODES),
    text: text(L.TEXT_MAX),
    done_when: text(L.DONE_WHEN_MAX),
    depends_on: list(L.PLAN_TASKS_MAX, taskId()),
    critical: bool(),
  }),
  TASK_STARTED: type(["ENGINE"], "required", {}),
  RUN_STARTED: type(["ENGINE"], "by_purpose", {
    run_id: runId(),
    purpose: code(["work", "review", "plan", "goal_check"]),
    role: code(ROLE_CODES),
    executor: code(EXECUTORS),
    max_budget_usd: money(0, Infinity, { nullable: true }),
  }),
  AGENT_ACTIVITY: type(["AGENT"], "by_run", {
    run_id: runId(),
    activity: code(["reading", "searching", "writing", "thinking", "other"]),
    executor: code(EXECUTORS),
    text: text(L.SUMMARY_MAX, { nullable: true }),
  }),
  RUN_FINISHED: type(
    ["ENGINE"],
    "by_run",
    {
      run_id: runId(),
      outcome: code([
        "ok",
        "failed",
        "timeout",
        "cancelled",
        "interrupted",
        "invalid_output",
        "not_found",
        "network",
      ]),
      summary: text(L.SUMMARY_MAX, { nullable: true }),
      cost_usd: money(0, Infinity, { nullable: true }),
      files: list(L.RUN_FILES_MAX, name()),
    },
    { coreOnlyValues: { outcome: ["interrupted"] } },
  ),
  RUN_REFUSED: type(["ENGINE"], "required", {
    reason: code(["budget_exhausted"]),
    detail: text(L.DETAIL_MAX),
  }),
  TASK_RETRY: type(["ENGINE"], "required", {
    next_attempt: int(2),
    delay_ms: int(0),
    reason: code(["failed", "timeout", "invalid_output", "network"]),
  }),
  TASK_REVIEW: type(["ENGINE"], "required", {}),
  REVIEW_RESULT: type(["ENGINE"], "required", {
    run_id: runId(),
    passed: bool(),
    notes: text(L.TEXT_MAX),
  }),
  TASK_REASSIGNED: type(["ENGINE"], "required", {
    from_role: code(ROLE_CODES),
    to_role: code(ROLE_CODES),
    reason: text(L.DETAIL_MAX),
  }),
  TASK_WAITING_USER: type(["ENGINE"], "required", {
    reason: code(["approval", "review_failed"]),
    draft: name({ nullable: true }),
  }),
  DECISION_RECEIVED: type(["USER"], "required", {
    decision: code(["approve", "change", "reject"]),
    text: text(L.TEXT_MAX, { nullable: true }),
  }),
  TASK_DONE: type(["ENGINE"], "required", {
    via: code(["review", "approval"]),
    external_action_done: bool(),
  }),
  TASK_FAILED: type(["ENGINE"], "required", {
    reason: code([
      "retries_exhausted",
      "rejected_by_user",
      "executor_not_found",
      "invalid_output",
      "result_file",
    ]),
    detail: text(L.DETAIL_MAX),
  }),
  TASK_INTERRUPTED: type(
    ["ENGINE"],
    "required",
    { cause: code(["recovery", "stop", "cancel"]) },
    { coreOnlyValues: { cause: ["recovery"] } },
  ),
});

// ---- checks ---------------------------------------------------------------------

function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function codePointLength(s) {
  return [...s].length;
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// Checks one value against its kind; throws E_EVENT naming the field.
function checkValue(spec, value, field, limits) {
  if (value === null && spec.nullable === true) return;
  switch (spec.kind) {
    case "text":
      if (typeof value !== "string" || value.trim() === "") {
        throw eventError(field);
      }
      if (limits && codePointLength(value) > spec.max) throw eventError(field);
      return;
    case "name":
      if (!checkResultName(value).ok) throw eventError(field);
      return;
    case "code":
      if (typeof value !== "string" || !spec.values.includes(value)) {
        throw eventError(field);
      }
      return;
    case "id":
      if (typeof value !== "string" || !PATTERNS[spec.pattern].test(value)) {
        throw eventError(field);
      }
      return;
    case "hash":
      if (typeof value !== "string" || !PATTERNS.hash.test(value)) {
        throw eventError(field);
      }
      return;
    case "int":
      if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
        throw eventError(field);
      }
      return;
    case "money":
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < spec.min ||
        value > spec.max ||
        Number(value.toFixed(6)) !== value
      ) {
        throw eventError(field);
      }
      return;
    case "bool":
      if (typeof value !== "boolean") throw eventError(field);
      return;
    case "list":
      if (
        !Array.isArray(value) ||
        value.length < spec.min ||
        value.length > spec.max
      ) {
        throw eventError(field);
      }
      value.forEach((item, i) =>
        checkValue(spec.item, item, `${field}[${i}]`, limits),
      );
      return;
    case "object":
      checkFields(spec.fields, value, field, limits);
      return;
    default:
      throw eventError(field);
  }
}

function checkFields(fields, data, prefix, limits) {
  const where = (key) => (prefix === "" ? key : `${prefix}.${key}`);
  if (!isPlainObject(data)) throw eventError(prefix === "" ? "data" : prefix);
  for (const key of Object.keys(data)) {
    if (!has(fields, key)) throw eventError(where(key));
  }
  for (const [key, spec] of Object.entries(fields)) {
    if (!has(data, key)) {
      if (spec.optional === true) continue;
      throw eventError(where(key));
    }
    checkValue(spec, data[key], where(key), limits);
  }
}

// Rules of the form across fields (sections 4.1 and 4.2).
function checkCrossFields(input) {
  const { type, source, data, task } = input;
  if (type === "PROJECT_CREATED") {
    if (data.scenario_file !== null && data.executor !== "scripted") {
      throw eventError("scenario_file");
    }
  } else if (type === "CHAT") {
    if (data.kind === "question" && source !== "ENGINE") {
      throw eventError("kind");
    }
  } else if (type === "MEMORY_ADDED") {
    // И12, N3: the executor is required from an agent and forbidden otherwise.
    if ((source === "AGENT") !== has(data, "executor")) {
      throw eventError("executor");
    }
  } else if (type === "RUN_STARTED") {
    const needsTask = data.purpose === "work" || data.purpose === "review";
    if (needsTask !== (task !== null)) throw eventError("task");
  }
}

// The form of an event without its envelope: { source, type, task, data }. With
// limits: false the lengths of the text fields are not checked (they are checked
// again after masking, section 3.4). Throws E_EVENT naming the field.
export function checkInput(input, { limits = true } = {}) {
  if (!isPlainObject(input)) throw eventError("event");
  if (!SOURCES.includes(input.source)) throw eventError("source");
  if (typeof input.type !== "string" || !has(EVENT_TYPES, input.type)) {
    throw eventError("type");
  }
  const spec = EVENT_TYPES[input.type];
  if (!spec.sources.includes(input.source)) throw eventError("source");
  const task = input.task ?? null;
  if (
    task !== null &&
    (typeof task !== "string" || !PATTERNS.task.test(task))
  ) {
    throw eventError("task");
  }
  if (spec.task === "required" && task === null) throw eventError("task");
  if (spec.task === "none" && task !== null) throw eventError("task");
  checkFields(spec.fields, input.data, "", limits);
  checkCrossFields({ ...input, task });
}

// The whole line of the journal: the envelope (section 3.1) and the data.
export function checkEnvelope(event) {
  if (!isPlainObject(event)) throw eventError("event");
  const keys = Object.keys(event);
  if (
    keys.length !== EVENT_KEYS.length ||
    keys.some((key, i) => key !== EVENT_KEYS[i])
  ) {
    const missing = EVENT_KEYS.find((key) => !has(event, key));
    throw eventError(
      missing ?? keys.find((k) => !EVENT_KEYS.includes(k)) ?? "event",
    );
  }
  if (!Number.isInteger(event.seq) || event.seq < 1) throw eventError("seq");
  if (!isCanonicalTs(event.ts)) throw eventError("ts");
  if (
    typeof event.project !== "string" ||
    !PATTERNS.project.test(event.project)
  ) {
    throw eventError("project");
  }
  if (event.task !== null && typeof event.task !== "string") {
    throw eventError("task");
  }
  checkInput({
    source: event.source,
    type: event.type,
    task: event.task,
    data: event.data,
  });
}

// The paths of the text fields of a type: the only fields that are masked.
export function textFields(typeName) {
  const spec = EVENT_TYPES[typeName];
  if (spec === undefined) return [];
  const out = [];
  for (const [key, field] of Object.entries(spec.fields)) {
    if (field.kind === "text") out.push(key);
    if (field.kind === "list" && field.item.kind === "object") {
      for (const [sub, f] of Object.entries(field.item.fields)) {
        if (f.kind === "text") out.push(`${key}[].${sub}`);
      }
    }
  }
  return out;
}

// A copy of data with fn applied to every string in a text field of the type
// (masking, section 3.4). Other values are copied as they are.
export function mapTextFields(typeName, data, fn) {
  if (!isPlainObject(data)) return data;
  const out = { ...data };
  for (const path of textFields(typeName)) {
    const [head, sub] = path.split("[].");
    if (sub === undefined) {
      if (typeof out[head] === "string") out[head] = fn(out[head]);
    } else if (Array.isArray(out[head])) {
      out[head] = out[head].map((item) =>
        isPlainObject(item) && typeof item[sub] === "string"
          ? { ...item, [sub]: fn(item[sub]) }
          : item,
      );
    }
  }
  return out;
}

// The name of a result file (section 6.6.1): not masked, only this pattern.
export function checkResultName(value) {
  if (typeof value !== "string") return { ok: false, reason: "not a string" };
  if (!PATTERNS.name.test(value)) return { ok: false, reason: "pattern" };
  if (value.includes("..")) return { ok: false, reason: "dots" };
  if (value.startsWith(".")) return { ok: false, reason: "leading dot" };
  return { ok: true };
}

// A relative path inside work/ (section 6.7.1).
export function checkWorkPath(value) {
  if (typeof value !== "string" || value === "") {
    return { ok: false, reason: "not a string" };
  }
  if (value.length > LIMITS.WORK_PATH_MAX) return { ok: false, reason: "long" };
  if (value.includes("\\") || value.includes("\0")) {
    return { ok: false, reason: "character" };
  }
  const parts = value.split("/");
  if (parts.length > LIMITS.WORK_PATH_PARTS_MAX) {
    return { ok: false, reason: "parts" };
  }
  for (const part of parts) {
    if (!checkResultName(part).ok) return { ok: false, reason: "part" };
  }
  return { ok: true };
}
