// One task of Sai Team (design REQ-010, section 8): checks, attempts with retries,
// the ceiling of each run, the journal and the result files. Everything is written
// through the one writer of the project; nothing is written until the checks of
// steps 1-4 have passed.
import fs from "node:fs";
import path from "node:path";
import { maskSecrets, prepareText } from "../pixel-office/mask.js";
import { abortablePause } from "./common.js";
import { RETRIES_MAX } from "./config.js";
import { TeamError, executorError, fromOsError } from "./errors.js";
import {
  WORK_ANSWER_SCHEMA,
  ceil6,
  checkBudget,
  floor6,
  getExecutor,
  round6,
  runCapFor,
} from "./executor.js";
import { FILES_DIR } from "./home.js";
import { FAIL_DETAIL } from "./language.js";
import { readWorkFile } from "./files.js";
import { roleByCode } from "./roles.js";
import {
  LIMITS,
  TASK_STATUS_TEXT,
  checkResultName,
  checkWorkPath,
} from "./schema.js";

export { ceil6, floor6, round6 };

const MONEY_EPSILON = 1e-6;
const ATTEMPTS_MAX = 1 + RETRIES_MAX;
const MEMORY_CONTEXT_MAX = 50;
// The statuses run-task starts a task from; the engine of REQ-013 passes its own
// (opts.startFrom, design REQ-013, section 2.2, C5).
const STARTABLE = Object.freeze(["waiting", "interrupted", "failed"]);
const CANCEL_CAUSES = Object.freeze(["cancel", "stop"]);

// The cause of an interrupted run from the reason of the abort of its signal:
// "stop" or "cancel"; any other reason is "cancel" (section 2.2, C5). The one
// place of this rule (runTask, runSingle).
export function cancelCauseOf(signal) {
  return CANCEL_CAUSES.includes(signal?.reason) ? signal.reason : "cancel";
}
const PROJECT_RUNNABLE = ["created", "running", "waiting_user"];
const REFUSED_DETAIL = "Потолок расходов исчерпан";
const NOFOLLOW = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW;
// The largest reported cost of one run the journal takes as it is: up to it the
// sums of six digits after the point stay exact (spent + cost = total of
// BUDGET_SPENT). One run is limited by --max-budget-usd (at most BUDGET_MAX), so a
// bigger number is not a cost.
const COST_REPORTED_MAX = 1e9;

// The ceiling of the next run (section 8.4).
export function maxBudgetFor(state, config) {
  if (!(state.budget_usd > 0)) return null;
  const remaining = state.budget_usd - state.spent_usd;
  if (remaining <= MONEY_EPSILON) return 0;
  return floor6(Math.min(remaining, runCapFor(state, config)));
}

// The reported cost of a run as the core can write it (six digits, rounded up),
// or null: a cost that is not a finite number >= 0, or whose rounding is not
// finite or above COST_REPORTED_MAX, counts as not reported (BUDGET_SPENT then
// charges the ceiling of the run, accounted "assumed").
export function recordableCost(raw) {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  const cost = ceil6(raw);
  if (!Number.isFinite(cost) || cost > COST_REPORTED_MAX) return null;
  return cost;
}

// The key of FAIL_DETAIL for the last attempt (section 8.3): a group that did not
// go first, then by the outcome.
export function failDetailFor(runResult) {
  if (runResult.detail === FAIL_DETAIL.group) return "group";
  switch (runResult.outcome) {
    case "timeout":
      return "timeout";
    case "network":
      return "network";
    case "not_found":
      return "not_found";
    case "invalid_output":
      if (runResult.detail === FAIL_DETAIL.schema) return "schema";
      if (runResult.detail === FAIL_DETAIL.too_big) return "too_big";
      return "invalid_output";
    default:
      return "failed";
  }
}

function prepared(text, limit) {
  if (typeof text !== "string") return null;
  const out = prepareText(text, limit * 4, limit).text;
  return out === "" ? null : out;
}

function taskView(state, taskId) {
  const t = state.tasks.find((x) => x.id === taskId);
  const role = roleByCode(t.role);
  return {
    id: t.id,
    role_title: role === null ? "" : role.title,
    status: t.status,
    status_text: TASK_STATUS_TEXT[t.status],
    attempts: t.attempts,
    files: [...t.files],
  };
}

// The files of the tasks this one depends on (masked already: files/ holds only
// masked text). Only the tasks of task.depends_on (design REQ-013, section 7.1).
export function depsOf(writer, task) {
  const filesDir = path.join(path.dirname(writer.workDir), FILES_DIR);
  const deps = [];
  for (const depId of task.depends_on) {
    const dep = writer.state.tasks.find((t) => t.id === depId);
    if (dep === undefined) continue;
    for (const name of dep.files) {
      let content;
      try {
        content = fs.readFileSync(path.join(filesDir, name), {
          encoding: "utf8",
          flag: NOFOLLOW,
        });
      } catch (err) {
        throw fromOsError(err, "read");
      }
      deps.push({ task: depId, name, content: maskSecrets(content) });
    }
  }
  return deps;
}

export function defaultContext(writer, task) {
  const state = writer.state;
  return {
    goal: state.goal,
    memory: state.memory
      .slice(-MEMORY_CONTEXT_MAX)
      .map((m) => ({ kind: m.kind, text: m.text })),
    deps: depsOf(writer, task),
    note: null,
  };
}

// RunTaskResult = { status, task, last_outcome, attempts, spent_usd, budget_usd,
//                   run, error }.
// The options of the engine of REQ-013 (section 2.2, C5; run-task passes none):
// startFrom — the statuses a task is started from; budgetFor(state) — the ceiling
// of the next run, asked at every point the ceiling is taken (by default
// maxBudgetFor). The cause of TASK_INTERRUPTED on a cancel is the reason of the
// abort of opts.signal ("stop" or "cancel"; any other reason is "cancel").
export async function runTask(writer, taskId, opts = {}) {
  const config = opts.config;
  const signal = opts.signal ?? new AbortController().signal;
  const sleep = typeof opts.sleep === "function" ? opts.sleep : abortablePause;
  const startFrom = opts.startFrom ?? STARTABLE;
  const budgetFor =
    typeof opts.budgetFor === "function"
      ? opts.budgetFor
      : (state) => maxBudgetFor(state, config);
  // The cause of TASK_INTERRUPTED is the reason of the abort of the signal: the
  // engine aborts a stop with "stop" (section 12.3); any other abort is "cancel".
  const cancelCause = () => cancelCauseOf(signal);
  if (!Array.isArray(startFrom)) {
    throw new TeamError(
      "E_INTERNAL",
      "Внутренняя ошибка ядра Sai Team (runner options)",
    );
  }

  // Steps 1-2: the task and the project.
  const start = writer.state;
  const task = start.tasks.find((t) => t.id === taskId);
  if (task === undefined) {
    throw new TeamError("E_TASK_NOT_FOUND", "Задача не найдена в этом проекте");
  }
  if (!startFrom.includes(task.status)) {
    throw executorError("E_TASK_STATE", TASK_STATUS_TEXT[task.status]);
  }
  for (const depId of task.depends_on) {
    const dep = start.tasks.find((t) => t.id === depId);
    if (dep === undefined || dep.status !== "done") {
      throw executorError("E_TASK_STATE", "ждёт результат других задач");
    }
  }
  if (!PROJECT_RUNNABLE.includes(start.status)) {
    throw executorError("E_PROJECT_STATE");
  }

  // Step 3: the executor and its checks, before any write.
  const executor = getExecutor(start.executor);
  const role = roleByCode(task.role);
  const context = opts.context ?? defaultContext(writer, task);
  const request = {
    project: {
      id: start.id,
      executor: start.executor,
      budget_usd: start.budget_usd,
      spent_usd: start.spent_usd,
    },
    run_id: null,
    purpose: "work",
    role,
    task: { id: task.id, text: task.text, done_when: task.done_when },
    attempt: 1,
    context,
    limits: {
      max_budget_usd: budgetFor(start),
      timeout_ms: config.taskTimeoutMs,
      work_dir: writer.workDir,
    },
    answer_schema: WORK_ANSWER_SCHEMA,
    scenario_path: writer.scenarioPath,
  };

  // The run of one attempt may be stopped by the user (signal) or by a failed
  // write of an event (then nothing more is written).
  let writeError = null;
  let attemptAbort = null;
  const io = {
    onEvent: (event) => onEvent(event),
    signal,
    env: opts.env ?? process.env,
    config,
    spawn: opts.spawn,
  };

  try {
    executor.check(request, io);
  } catch (err) {
    if (err instanceof TeamError && err.code === "E_BUDGET_EXHAUSTED") {
      refuse(writer, taskId);
      return finish("refused", null, err, null);
    }
    throw err;
  }

  // Step 5.
  writer.append({
    source: "ENGINE",
    type: "TASK_STARTED",
    task: taskId,
    data: {},
  });

  let runId = null;
  // The run this call has started and not yet closed: { id, maxBudget, result }.
  let openRun = null;
  // true while the result files of an ok attempt are accepted (section 8.5).
  let accepting = false;
  function onEvent(event) {
    if (writeError !== null || runId === null) return;
    try {
      writer.append({
        source: "AGENT",
        type: "AGENT_ACTIVITY",
        task: taskId,
        data: {
          run_id: runId,
          activity: event.activity,
          executor: start.executor,
          text: prepared(event.text, LIMITS.SUMMARY_MAX),
        },
      });
    } catch (err) {
      writeError = err;
      attemptAbort?.abort();
    }
  }

  function finish(status, lastOutcome, error, run) {
    const s = writer.state;
    return {
      status,
      task: taskView(s, taskId),
      last_outcome: lastOutcome,
      attempts: s.tasks.find((t) => t.id === taskId).attempts,
      spent_usd: s.spent_usd,
      budget_usd: s.budget_usd,
      run,
      error,
    };
  }

  // Step 6: the attempts. On every path that leaves by a throw the open run and
  // the running task are closed before the error goes up (rule 2 of ORCH,
  // PROD-20261006-01 step 16; closeAfterError).
  let failure = null;
  try {
    return await attempts();
  } catch (err) {
    failure = err;
    throw err;
  } finally {
    if (failure !== null) closeAfterError();
  }

  async function attempts() {
    for (let n = 1; n <= ATTEMPTS_MAX; n += 1) {
      const maxBudget = budgetFor(writer.state);
      request.attempt = n;
      request.project.spent_usd = writer.state.spent_usd;
      request.limits.max_budget_usd = maxBudget;
      runId = writer.nextRunId();
      request.run_id = runId;
      writer.append({
        source: "ENGINE",
        type: "RUN_STARTED",
        task: taskId,
        data: {
          run_id: runId,
          purpose: "work",
          role: task.role,
          executor: start.executor,
          max_budget_usd: maxBudget,
        },
      });
      openRun = { id: runId, maxBudget, result: null };

      const controller = new AbortController();
      attemptAbort = controller;
      const onCancel = () => controller.abort();
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onCancel, { once: true });
      let result;
      try {
        result = await executor.run(request, {
          ...io,
          signal: controller.signal,
        });
      } catch (err) {
        signal.removeEventListener("abort", onCancel);
        attemptAbort = null;
        if (writeError !== null) throw writeError;
        if (!(err instanceof TeamError)) throw err;
        // Step 6.3: refused before the start (in one writer this does not happen).
        finishRun(runId, "failed", null, null, []);
        const budget = err.code === "E_BUDGET_EXHAUSTED";
        if (budget) refuse(writer, taskId);
        failTask("retries_exhausted", budget ? "budget" : "failed");
        throw err;
      }
      signal.removeEventListener("abort", onCancel);
      attemptAbort = null;
      openRun.result = result;
      // Step 7: a failed write — the process is already stopped; write nothing more.
      if (writeError !== null) throw writeError;
      runId = null;
      const thisRunId = request.run_id;
      const cost = recordableCost(result.cost_usd);

      if (result.outcome === "ok") {
        accepting = true;
        // The name of a file carries the number of the attempt of the task (its
        // RUN_STARTED work, И16): unique across the calls of the engine, which
        // starts one task several times (design REQ-013, sections 8.2, 9.3); for
        // a fresh task of run-task it is the attempt of this call, as before.
        const accepted = await acceptResult(
          result,
          writer.state.tasks.find((t) => t.id === taskId).attempts,
        );
        accepting = false;
        if (accepted.error !== null) {
          finishRun(thisRunId, "failed", null, cost, accepted.names);
          const spent = chargeIfSpawned(result, cost, thisRunId, maxBudget);
          failTask("result_file", accepted.detailKey);
          return finish(
            "failed",
            "failed",
            accepted.error,
            runView("failed", spent),
          );
        }
        for (const m of result.memory) {
          const text = prepared(m.text, LIMITS.TEXT_MAX);
          if (text === null) continue;
          writer.addMemory(
            { kind: m.kind, text, task: taskId, executor: start.executor },
            "AGENT",
          );
        }
        finishRun(
          thisRunId,
          "ok",
          prepared(result.summary, LIMITS.SUMMARY_MAX),
          cost,
          accepted.names,
        );
        const spent = chargeIfSpawned(result, cost, thisRunId, maxBudget);
        writer.append({
          source: "ENGINE",
          type: "TASK_REVIEW",
          task: taskId,
          data: {},
        });
        return finish("review", "ok", null, runView("ok", spent));
      }

      // Step 6.5: a failed attempt.
      finishRun(thisRunId, result.outcome, null, cost, []);
      const spent = chargeIfSpawned(result, cost, thisRunId, maxBudget);
      const run = runView(result.outcome, spent);
      if (result.outcome === "not_found") {
        failTask("executor_not_found", "not_found");
        return finish(
          "failed",
          result.outcome,
          executorError("E_EXECUTOR_NOT_FOUND"),
          run,
        );
      }
      if (result.outcome === "cancelled") {
        interrupt();
        return finish(
          "interrupted",
          result.outcome,
          executorError("E_TASK_CANCELLED"),
          run,
        );
      }
      if (result.transient && n < ATTEMPTS_MAX) {
        const next = {
          ...request,
          project: { ...request.project, spent_usd: writer.state.spent_usd },
          limits: {
            ...request.limits,
            max_budget_usd: budgetFor(writer.state),
          },
        };
        let budgetLeft = true;
        try {
          checkBudget(next);
        } catch (err) {
          if (!(err instanceof TeamError)) throw err;
          budgetLeft = false;
        }
        if (!budgetLeft) {
          refuse(writer, taskId);
          failTask("retries_exhausted", "budget");
          return finish(
            "failed",
            result.outcome,
            executorError("E_TASK_FAILED", FAIL_DETAIL.budget),
            run,
          );
        }
        writer.append({
          source: "ENGINE",
          type: "TASK_RETRY",
          task: taskId,
          data: {
            next_attempt: n + 1,
            delay_ms: config.retryDelayMs,
            reason: result.outcome,
          },
        });
        if (!(await sleep(config.retryDelayMs, signal)) || signal.aborted) {
          interrupt();
          return finish(
            "interrupted",
            result.outcome,
            executorError("E_TASK_CANCELLED"),
            run,
          );
        }
        continue;
      }
      const key = failDetailFor(result);
      failTask(
        result.outcome === "invalid_output" && key !== "group"
          ? "invalid_output"
          : "retries_exhausted",
        key,
      );
      return finish(
        "failed",
        result.outcome,
        executorError("E_TASK_FAILED", FAIL_DETAIL[key]),
        run,
      );
    }
    throw new TeamError(
      "E_INTERNAL",
      "Внутренняя ошибка ядра Sai Team (runner)",
    );
  }

  // ---- the writes of one attempt ----------------------------------------------

  function finishRun(id, outcome, summary, cost, files) {
    writer.append({
      source: "ENGINE",
      type: "RUN_FINISHED",
      task: taskId,
      data: { run_id: id, outcome, summary, cost_usd: cost, files },
    });
    if (openRun !== null && openRun.id === id) openRun = null;
  }

  // Rules 2-3 of ORCH (PROD-20261006-01 step 16): an error of any kind (a write,
  // the executor's own exception, acceptResult) leaves no open run and no running
  // task behind. The run is closed as failed (with BUDGET_SPENT when its process
  // ran), the task fails; a write that cannot be made breaks the writer, which
  // then keeps its lock on close() (rule 1), and the next writer recovers the
  // project as after a crash. Never throws: the original error goes up.
  function closeAfterError() {
    try {
      if (openRun !== null) {
        const { id, maxBudget, result } = openRun;
        const cost = result === null ? null : recordableCost(result.cost_usd);
        finishRun(id, "failed", null, cost, []);
        if (result !== null) chargeIfSpawned(result, cost, id, maxBudget);
      }
      const t = writer.state.tasks.find((x) => x.id === taskId);
      if (t !== undefined && t.status === "running") {
        if (accepting) {
          failTask("result_file", "result_file");
        } else {
          failTask("retries_exhausted", "failed");
        }
      }
    } catch {
      writer.markBroken();
    }
  }

  // BUDGET_SPENT after every attempt with a process (section 8.4). Returns
  // { cost_usd, accounted } or null.
  // reported: recordableCost(result.cost_usd).
  function chargeIfSpawned(result, reported, id, maxBudget) {
    if (!result.spawned) return null;
    let cost;
    let accounted;
    if (reported === null) {
      cost = maxBudget === null ? 0 : maxBudget;
      accounted = "assumed";
    } else {
      cost = reported;
      accounted = "reported";
    }
    writer.append({
      source: "ENGINE",
      type: "BUDGET_SPENT",
      task: taskId,
      data: {
        run_id: id,
        cost_usd: cost,
        accounted,
        total_usd: round6(writer.state.spent_usd + cost),
      },
    });
    return { cost_usd: cost, accounted };
  }

  function failTask(reason, detailKey) {
    writer.append({
      source: "ENGINE",
      type: "TASK_FAILED",
      task: taskId,
      data: { reason, detail: FAIL_DETAIL[detailKey] },
    });
  }

  function interrupt() {
    writer.append({
      source: "ENGINE",
      type: "TASK_INTERRUPTED",
      task: taskId,
      data: {
        cause: cancelCause(),
      },
    });
  }

  function runView(outcome, spent) {
    return {
      outcome,
      cost_usd: spent === null ? null : spent.cost_usd,
      accounted: spent === null ? null : spent.accounted,
    };
  }

  // Section 8.5: the result files of an ok attempt. Returns { names, error,
  // detailKey }; error is the TeamError for the command (null — all accepted).
  async function acceptResult(result, attempt) {
    const names = [];
    const refusal = (err, detailKey) => ({ names, error: err, detailKey });
    const fileRefusal = () =>
      refusal(
        executorError("E_TASK_FAILED", FAIL_DETAIL.result_file),
        "result_file",
      );
    const isFileRefusal = (err) =>
      err instanceof TeamError &&
      ["E_WORK_FILE", "E_FILE_NAME", "E_FILE_EXISTS", "E_EVENT"].includes(
        err.code,
      );

    const planned = [];
    if (result.executor === "claude-cli") {
      // Step 1: every path and every file is checked before the first write.
      for (const file of result.files) {
        if (!checkWorkPath(file.path).ok) return fileRefusal();
        try {
          readWorkFile(writer.workDir, file.path);
        } catch (err) {
          if (isFileRefusal(err)) return fileRefusal();
          throw err;
        }
        const name = `${taskId}-${attempt}-${file.path.split("/").pop()}`;
        if (!checkResultName(name).ok) return fileRefusal();
        planned.push({ path: file.path, name, kind: file.kind });
      }
    } else {
      for (const output of result.outputs) {
        const name = `${taskId}-${attempt}-${output.name}`;
        if (!checkResultName(name).ok) return fileRefusal();
        planned.push({ bytes: output.bytes, name, kind: output.kind });
      }
    }

    for (const item of planned) {
      try {
        if (item.path !== undefined) {
          writer.importWorkFile({
            task: taskId,
            path: item.path,
            name: item.name,
            kind: item.kind,
          });
        } else {
          writer.importResultBytes({
            task: taskId,
            name: item.name,
            bytes: item.bytes,
            kind: item.kind,
          });
        }
      } catch (err) {
        if (isFileRefusal(err)) return fileRefusal();
        if (err instanceof TeamError && err.code === "E_DISK") {
          if (writerBroken(err)) throw err;
          return refusal(err, "result_disk");
        }
        throw err;
      }
      names.push(item.name);
    }

    // Step 4: the unmasked sources of the accepted files leave work/.
    for (const item of planned) {
      if (item.path === undefined) continue;
      removeSource(writer.workDir, item.path);
    }
    return { names, error: null, detailKey: null };
  }

  // The whole path is walked again right before the unlink (as readWorkFile
  // does): work/ itself and every folder on the way must be real folders, the
  // last part a regular file; a link anywhere — nothing is removed.
  function removeSource(workDir, relPath) {
    try {
      let st = fs.lstatSync(workDir);
      if (!st.isDirectory() || st.isSymbolicLink()) return;
      const parts = relPath.split("/");
      let current = workDir;
      for (let i = 0; i < parts.length; i += 1) {
        if (parts[i] === "" || parts[i] === "." || parts[i] === "..") return;
        current = path.join(current, parts[i]);
        st = fs.lstatSync(current);
        if (st.isSymbolicLink()) return;
        const last = i === parts.length - 1;
        if (last ? !st.isFile() : !st.isDirectory()) return;
      }
      fs.unlinkSync(current);
    } catch (err) {
      if (err && err.code === "ENOENT") return;
      writer.notices.push(
        "Не удалось удалить исходный файл результата из рабочей папки",
      );
    }
  }
}

// A failed write of the journal itself breaks the writer (its error carries the
// result of the rollback); a failed write of a result file does not.
function writerBroken(err) {
  return err.details !== undefined && err.details.rollback !== undefined;
}

// Step 4 of section 8.2 and the refusals between attempts: one line RUN_REFUSED.
function refuse(writer, taskId) {
  writer.append({
    source: "ENGINE",
    type: "RUN_REFUSED",
    task: taskId,
    data: { reason: "budget_exhausted", detail: REFUSED_DETAIL },
  });
}
