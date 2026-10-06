// The interface of an executor of Sai Team (design REQ-010, section 3): the schema
// of the answer and its check, the text of a task, the tools of a role, the
// ceiling of one run and the choice of the executor.
//
//   run(request, io) -> Promise<RunResult>   one attempt, one process, no retries
//
// Everything here is pure except getExecutor, which imports the two executors.
// No executor writes the journal: only the caller does (runner.js, the engine of
// REQ-013), through the writer of the core.
import { has, isPlainObject } from "./common.js";
import { RUN_CAP_SHARE } from "./config.js";
import { TeamError, executorError } from "./errors.js";
import * as claudeCli from "./executors/claude-cli.js";
import * as scripted from "./executors/scripted.js";

export const ACTIVITY_MAX = 300;

// RunResult.outcome: RUN_FINISHED.outcome of the core without "interrupted".
export const OUTCOMES = Object.freeze([
  "ok",
  "failed",
  "timeout",
  "cancelled",
  "invalid_output",
  "not_found",
  "network",
]);

const PROMPT_MAX = 200_000;
const CUT_MARK = "[обрезано]";
const MONEY_EPSILON = 1e-6;

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

// The answer of a work task (section 3.3); also passed to --json-schema.
export const WORK_ANSWER_SCHEMA = deepFreeze({
  type: "object",
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 2000 },
    files: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 255 },
          kind: { type: "string", enum: ["result", "draft"] },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    memory: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["fact", "decision", "note"] },
          text: { type: "string", minLength: 1, maxLength: 4000 },
        },
        required: ["kind", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "files"],
  additionalProperties: false,
});

// ---- money (six digits after the point) -------------------------------------------

// The tolerance of toFixed(3) removes the error of x * 1e6 (0.7 * 1e6 is not exact).
function micro(x) {
  return Number((x * 1e6).toFixed(3));
}

export function floor6(x) {
  return Math.floor(micro(x)) / 1e6;
}

export function ceil6(x) {
  return Math.ceil(micro(x)) / 1e6;
}

export function round6(x) {
  return Math.round(micro(x)) / 1e6;
}

// ---- the check of an answer (a subset of JSON Schema) -------------------------------

const KEYWORDS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "enum",
  "minimum",
  "maximum",
]);

function schemaError(keyword) {
  return new TeamError(
    "E_INTERNAL",
    `Внутренняя ошибка ядра Sai Team (schema: ${keyword})`,
  );
}

function typeFits(type, value) {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      throw schemaError(`type ${String(type)}`);
  }
}

function codePoints(s) {
  return [...s].length;
}

// Returns the path of the first mismatch, or null.
function mismatch(schema, value, at) {
  if (!isPlainObject(schema)) throw schemaError("schema");
  for (const key of Object.keys(schema)) {
    if (!KEYWORDS.has(key)) throw schemaError(key);
  }
  if (
    has(schema, "additionalProperties") &&
    schema.additionalProperties !== false
  ) {
    throw schemaError("additionalProperties");
  }
  if (has(schema, "type") && !typeFits(schema.type, value)) return at;
  if (has(schema, "enum")) {
    if (!Array.isArray(schema.enum)) throw schemaError("enum");
    if (!schema.enum.includes(value)) return at;
  }
  if (typeof value === "string") {
    const n = codePoints(value);
    if (has(schema, "minLength") && n < schema.minLength) return at;
    if (has(schema, "maxLength") && n > schema.maxLength) return at;
  }
  if (typeof value === "number") {
    if (has(schema, "minimum") && value < schema.minimum) return at;
    if (has(schema, "maximum") && value > schema.maximum) return at;
  }
  if (Array.isArray(value)) {
    if (has(schema, "minItems") && value.length < schema.minItems) return at;
    if (has(schema, "maxItems") && value.length > schema.maxItems) return at;
    if (has(schema, "items")) {
      for (let i = 0; i < value.length; i += 1) {
        const bad = mismatch(schema.items, value[i], `${at}[${i}]`);
        if (bad !== null) return bad;
      }
    }
  }
  if (isPlainObject(value)) {
    const props = has(schema, "properties") ? schema.properties : {};
    if (!isPlainObject(props)) throw schemaError("properties");
    const required = has(schema, "required") ? schema.required : [];
    if (!Array.isArray(required)) throw schemaError("required");
    for (const key of required) {
      if (!has(value, key)) return `${at}.${key}`;
    }
    for (const key of Object.keys(value)) {
      if (has(props, key)) {
        const bad = mismatch(props[key], value[key], `${at}.${key}`);
        if (bad !== null) return bad;
      } else if (schema.additionalProperties === false) {
        return `${at}.${key}`;
      }
    }
  }
  return null;
}

export function checkAnswer(schema, value) {
  const bad = mismatch(schema, value, "$");
  return bad === null ? { ok: true } : { ok: false, path: bad };
}

// ---- the text of a task (stdin of the process) -------------------------------------

const HEADERS = Object.freeze({
  role: "## Роль",
  goal: "## Цель проекта",
  task: "## Задача",
  doneWhen: "## Критерий готовности",
  memory: "## Память проекта",
  deps: "## Результаты задач, от которых зависит эта",
  note: "## Замечания",
  rules: "## Правила",
});

const RULES = [
  "- Работай только с файлами текущей папки.",
  "- Результат — файлы в текущей папке.",
  "- Ничего не отправляй и не публикуй вовне.",
  "- Ответ — по заданной схеме: summary (краткий итог), files (пути файлов результата относительно текущей папки), memory (что стоит запомнить проекту).",
].join("\n");

// The first `max` UTF-16 units of s without splitting a surrogate pair.
function cut(s, max) {
  if (s.length <= max) return s;
  let end = Math.max(0, max);
  const last = s.charCodeAt(end - 1);
  if (end > 0 && last >= 0xd800 && last <= 0xdbff) end -= 1;
  return s.slice(0, end);
}

export function buildPrompt(request) {
  const { role, task, context } = request;
  const head = [];
  head.push(`${HEADERS.role}\n${role.name}\n${role.description}`);
  head.push(`${HEADERS.goal}\n${context.goal}`);
  if (task !== null && task !== undefined) {
    head.push(`${HEADERS.task}\n${task.text}`);
    head.push(`${HEADERS.doneWhen}\n${task.done_when}`);
  }
  const memory = Array.isArray(context.memory) ? context.memory : [];
  head.push(
    `${HEADERS.memory}\n${
      memory.length === 0
        ? "нет"
        : memory.map((m) => `— ${m.kind}: ${m.text}`).join("\n")
    }`,
  );
  const tail = [];
  if (context.note !== null && context.note !== undefined) {
    tail.push(`${HEADERS.note}\n${context.note}`);
  }
  tail.push(`${HEADERS.rules}\n${RULES}`);

  const deps = Array.isArray(context.deps) ? context.deps : [];
  const fixed = [...head, ...tail].join("\n\n").length;
  let room = PROMPT_MAX - fixed - HEADERS.deps.length - 4;
  let depsText = null;
  if (deps.length > 0) {
    const parts = [];
    for (const dep of deps) {
      const title = `### ${dep.name}\n`;
      room -= title.length + 2;
      const content = String(dep.content);
      if (content.length <= room) {
        parts.push(`${title}${content}`);
        room -= content.length;
      } else {
        const kept = cut(content, room - CUT_MARK.length - 1);
        parts.push(`${title}${kept}\n${CUT_MARK}`);
        room = Math.max(0, room - kept.length - CUT_MARK.length - 1);
      }
    }
    depsText = `${HEADERS.deps}\n${parts.join("\n\n")}`;
  }
  const sections = [...head];
  if (depsText !== null) sections.push(depsText);
  sections.push(...tail);
  return sections.join("\n\n");
}

// ---- tools, ceiling, budget --------------------------------------------------------

const WEB_TOOLS = Object.freeze(["WebSearch", "WebFetch"]);

export function toolsForRole(role, config) {
  const tools = Array.isArray(role?.internal?.tools) ? role.internal.tools : [];
  if (config.web === false) return tools.filter((t) => !WEB_TOOLS.includes(t));
  return [...tools];
}

// The ceiling of one run (section 8.4); null when the project has no ceiling.
export function runCapFor(project, config) {
  if (!(project.budget_usd > 0)) return null;
  if (config.runCapUsd !== null && config.runCapUsd !== undefined) {
    return config.runCapUsd;
  }
  return floor6(project.budget_usd * RUN_CAP_SHARE);
}

function isMoney(x) {
  return typeof x === "number" && Number.isFinite(x);
}

// The condition of the rest (section 3.2): throws E_BUDGET_EXHAUSTED. The ceiling
// and the spent sum must be finite numbers: NaN or a string would make every
// comparison false and let the run through.
export function checkBudget(request) {
  const { budget_usd: budget, spent_usd: spent } = request.project;
  const max = request.limits.max_budget_usd;
  if (!isMoney(budget) || !isMoney(spent)) {
    throw executorError("E_BUDGET_EXHAUSTED");
  }
  if (budget > 0) {
    if (
      typeof max !== "number" ||
      !Number.isFinite(max) ||
      !(max > MONEY_EPSILON) ||
      max > budget - spent + MONEY_EPSILON
    ) {
      throw executorError("E_BUDGET_EXHAUSTED");
    }
    return;
  }
  if (max !== null) throw executorError("E_BUDGET_EXHAUSTED");
}

// ---- the choice of the executor ----------------------------------------------------

// Only the two codes; there is no default and no fallback (section 3.5).
export function getExecutor(code) {
  if (code === claudeCli.code) return claudeCli;
  if (code === scripted.code) return scripted;
  throw executorError("E_EXECUTOR");
}
