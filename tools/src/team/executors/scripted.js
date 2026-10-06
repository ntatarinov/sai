// The test executor `scripted` (design REQ-010, section 6): only for tests. It
// plays the scenario copied into the folder of the project (writer.scenarioPath)
// and touches the disk only to read that copy: the result files it gives are kept
// in memory (RunResult.outputs) and accepted by the core (importResultBytes).
// Every event it causes is marked with the executor "scripted".
import fs from "node:fs";
import { abortablePause, has, isPlainObject } from "../common.js";
import { executorError } from "../errors.js";
import {
  ACTIVITY_MAX,
  buildPrompt,
  checkAnswer,
  checkBudget,
} from "../executor.js";
import { FAIL_DETAIL } from "../language.js";
import { ROLE_CODES } from "../roles.js";
import { LIMITS, PATTERNS, checkResultName } from "../schema.js";

export const code = "scripted";

const RUNS_MAX = 200;
const STEPS_MAX = 100;
const FILES_MAX = 50;
const CONTENT_BYTES_MAX = 1024 * 1024;
const DELAY_MS_MAX = 60_000;
const PURPOSES = ["work", "review", "plan", "goal_check"];
const ACTIVITIES = ["reading", "searching", "writing", "thinking", "other"];
const RESULT_OUTCOMES = [
  "ok",
  "failed",
  "timeout",
  "network",
  "invalid_output",
];
const NO_MATCH_DETAIL = "В сценарии нет шага для этой задачи";
const { O_RDONLY, O_NOFOLLOW } = fs.constants;

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

function scenarioError() {
  return executorError("E_SCENARIO");
}

function onlyKeys(obj, keys) {
  if (!isPlainObject(obj)) throw scenarioError();
  for (const key of Object.keys(obj)) {
    if (!keys.includes(key)) throw scenarioError();
  }
}

function checkMatch(match) {
  onlyKeys(match, ["role", "purpose", "task", "attempt"]);
  if (has(match, "role") && !ROLE_CODES.includes(match.role)) {
    throw scenarioError();
  }
  if (has(match, "purpose") && !PURPOSES.includes(match.purpose)) {
    throw scenarioError();
  }
  if (
    has(match, "task") &&
    (typeof match.task !== "string" || !PATTERNS.task.test(match.task))
  ) {
    throw scenarioError();
  }
  if (
    has(match, "attempt") &&
    (!Number.isInteger(match.attempt) || match.attempt < 1)
  ) {
    throw scenarioError();
  }
}

function checkStep(step) {
  if (!isPlainObject(step)) throw scenarioError();
  if (has(step, "activity")) {
    onlyKeys(step, ["activity", "text"]);
    if (!ACTIVITIES.includes(step.activity)) throw scenarioError();
    if (
      has(step, "text") &&
      step.text !== null &&
      typeof step.text !== "string"
    ) {
      throw scenarioError();
    }
    return;
  }
  if (has(step, "delay_ms")) {
    onlyKeys(step, ["delay_ms"]);
    const ms = step.delay_ms;
    if (!Number.isInteger(ms) || ms < 0 || ms > DELAY_MS_MAX) {
      throw scenarioError();
    }
    return;
  }
  if (has(step, "record_input")) {
    onlyKeys(step, ["record_input"]);
    if (!checkResultName(step.record_input).ok) throw scenarioError();
    return;
  }
  throw scenarioError();
}

function checkResult(result) {
  onlyKeys(result, ["outcome", "answer", "cost_usd", "files"]);
  if (!RESULT_OUTCOMES.includes(result.outcome)) throw scenarioError();
  if (has(result, "answer") && !isPlainObject(result.answer)) {
    throw scenarioError();
  }
  if (
    has(result, "cost_usd") &&
    (typeof result.cost_usd !== "number" ||
      !Number.isFinite(result.cost_usd) ||
      result.cost_usd < 0)
  ) {
    throw scenarioError();
  }
  if (has(result, "files")) {
    if (!Array.isArray(result.files) || result.files.length > FILES_MAX) {
      throw scenarioError();
    }
    const names = new Set();
    for (const file of result.files) {
      onlyKeys(file, ["name", "content", "kind"]);
      if (!checkResultName(file.name).ok || names.has(file.name)) {
        throw scenarioError();
      }
      names.add(file.name);
      if (
        typeof file.content !== "string" ||
        Buffer.byteLength(file.content, "utf8") > CONTENT_BYTES_MAX
      ) {
        throw scenarioError();
      }
      if (has(file, "kind") && !["result", "draft"].includes(file.kind)) {
        throw scenarioError();
      }
    }
  }
}

// The form of section 6.2; any deviation is E_SCENARIO.
export function parseScenario(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > LIMITS.SCENARIO_BYTES_MAX) {
    throw scenarioError();
  }
  let value;
  try {
    value = JSON.parse(strictUtf8.decode(bytes));
  } catch {
    throw scenarioError();
  }
  onlyKeys(value, ["version", "runs"]);
  if (value.version !== 1) throw scenarioError();
  if (
    !Array.isArray(value.runs) ||
    value.runs.length < 1 ||
    value.runs.length > RUNS_MAX
  ) {
    throw scenarioError();
  }
  for (const r of value.runs) {
    onlyKeys(r, ["match", "steps", "result"]);
    checkMatch(r.match);
    if (!Array.isArray(r.steps) || r.steps.length > STEPS_MAX) {
      throw scenarioError();
    }
    r.steps.forEach(checkStep);
    checkResult(r.result);
  }
  return value;
}

// Reads the copy in exactly one way: lstat, then one read that does not follow
// a link (a link gives ELOOP).
function readScenario(file) {
  if (typeof file !== "string") throw scenarioError();
  let bytes;
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink()) throw scenarioError();
    if (st.size > LIMITS.SCENARIO_BYTES_MAX) throw scenarioError();
    bytes = fs.readFileSync(file, { flag: O_RDONLY | O_NOFOLLOW });
  } catch {
    throw scenarioError();
  }
  if (bytes.length > LIMITS.SCENARIO_BYTES_MAX) throw scenarioError();
  return parseScenario(bytes);
}

// The checks before a run (section 6.1); returns the scenario. Writes nothing.
export function check(request, _io) {
  if (request.project.executor !== code) throw executorError("E_EXECUTOR");
  if (request.scenario_path === null || request.scenario_path === undefined) {
    throw scenarioError();
  }
  const scenario = readScenario(request.scenario_path);
  checkBudget(request);
  return scenario;
}

function matches(match, request) {
  if (has(match, "role") && match.role !== request.role.code) return false;
  if (has(match, "purpose") && match.purpose !== request.purpose) return false;
  if (has(match, "task") && match.task !== (request.task?.id ?? null)) {
    return false;
  }
  if (has(match, "attempt") && match.attempt !== request.attempt) return false;
  return true;
}

const DETAIL_BY_OUTCOME = {
  failed: FAIL_DETAIL.failed,
  timeout: FAIL_DETAIL.timeout,
  network: FAIL_DETAIL.network,
  invalid_output: FAIL_DETAIL.invalid_output,
};

export async function run(request, io) {
  const scenario = check(request, io);
  const signal = io.signal ?? null;
  const stats = { lines: 0, skipped: 0, activities: 0, dropped_activities: 0 };
  const out = {
    executor: code,
    outcome: "failed",
    transient: true,
    spawned: true,
    answer: null,
    summary: null,
    files: [],
    outputs: [],
    memory: [],
    cost_usd: null,
    detail: null,
    stats,
  };
  const chosen = scenario.runs.find((r) => matches(r.match, request));
  if (chosen === undefined) return { ...out, detail: NO_MATCH_DETAIL };

  const recorded = [];
  for (const step of chosen.steps) {
    if (signal?.aborted) {
      return { ...out, outcome: "cancelled", transient: false };
    }
    if (has(step, "activity")) {
      if (stats.activities >= ACTIVITY_MAX) {
        stats.dropped_activities += 1;
        continue;
      }
      stats.activities += 1;
      try {
        io.onEvent({
          kind: "activity",
          activity: step.activity,
          text: step.text ?? null,
        });
      } catch {
        // The caller handles the failures of its own writes (it aborts the run).
      }
    } else if (has(step, "delay_ms")) {
      if (!(await abortablePause(step.delay_ms, signal))) {
        return { ...out, outcome: "cancelled", transient: false };
      }
    } else {
      recorded.push({
        name: step.record_input,
        bytes: Buffer.from(buildPrompt(request), "utf8"),
        kind: "result",
      });
    }
  }
  if (signal?.aborted)
    return { ...out, outcome: "cancelled", transient: false };

  const result = chosen.result;
  out.cost_usd = has(result, "cost_usd") ? result.cost_usd : null;
  if (result.outcome !== "ok") {
    return {
      ...out,
      outcome: result.outcome,
      detail: DETAIL_BY_OUTCOME[result.outcome],
    };
  }
  const invalid = (detail) => ({ ...out, outcome: "invalid_output", detail });
  if (!has(result, "answer")) return invalid(FAIL_DETAIL.invalid_output);
  const answer = result.answer;
  if (!checkAnswer(request.answer_schema, answer).ok) {
    return invalid(FAIL_DETAIL.schema);
  }
  // scripted names no file in work/: its files are the outputs below.
  if (Array.isArray(answer.files) && answer.files.length > 0) {
    return invalid(FAIL_DETAIL.schema);
  }
  const outputs = [...recorded];
  for (const file of result.files ?? []) {
    outputs.push({
      name: file.name,
      bytes: Buffer.from(file.content, "utf8"),
      kind: file.kind ?? "result",
    });
  }
  const names = new Set(outputs.map((o) => o.name));
  if (names.size !== outputs.length) return invalid(FAIL_DETAIL.schema);
  return {
    ...out,
    outcome: "ok",
    transient: false,
    answer,
    summary: typeof answer.summary === "string" ? answer.summary : null,
    outputs,
    memory: Array.isArray(answer.memory)
      ? answer.memory.map((m) => ({ kind: m.kind, text: m.text }))
      : [],
  };
}
