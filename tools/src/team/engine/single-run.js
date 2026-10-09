// One run of the engine of Sai Team without a work attempt (design REQ-013,
// sections 5, 8 and 11): the plan, the check of a result, the check of the goal and
// the choice of another role. The same protections as a run of runTask (design
// REQ-010, section 8.2): the checks of the executor before any write, the run is
// closed on every path, and a write that cannot be made breaks the writer.
import { prepareText } from "../../pixel-office/mask.js";
import { TeamError } from "../errors.js";
import { getExecutor } from "../executor.js";
import { cancelCauseOf, recordableCost, round6 } from "../runner.js";
import { roleByCode } from "../roles.js";
import { LIMITS, checkResultName } from "../schema.js";

const PURPOSES = ["plan", "review", "goal_check", "reassign"];

function prepared(text, limit) {
  if (typeof text !== "string") return null;
  const out = prepareText(text, limit * 4, limit).text;
  return out === "" ? null : out;
}

function internal(what) {
  return new TeamError(
    "E_INTERNAL",
    `Внутренняя ошибка ядра Sai Team (${what})`,
  );
}

// spec = { purpose, role, task: id | null, context, answer_schema, maxBudget,
//          attempt?, afterStart?(run_id) }
// opts = { env, config, signal, spawn? } — a run that ends cancelled interrupts its
//        task with the reason of the abort of the signal ("stop"; else "cancel").
// Returns { result: RunResult | null, run_id: string | null, error: TeamError |
// null }: a refusal of the checks — no run, error; a failure after RUN_STARTED —
// the run is closed as failed, error. Never throws.
export async function runSingle(writer, spec, opts) {
  const {
    purpose,
    role,
    task = null,
    context,
    answer_schema: answerSchema,
    maxBudget,
    attempt = 1,
    afterStart = null,
  } = spec;
  const config = opts.config;
  const start = writer.state;
  if (!PURPOSES.includes(purpose) || roleByCode(role) === null) {
    return { result: null, run_id: null, error: internal("single run") };
  }
  const taskRecord =
    task === null ? null : (start.tasks.find((t) => t.id === task) ?? null);
  if (task !== null && taskRecord === null) {
    return {
      result: null,
      run_id: null,
      error: new TeamError(
        "E_TASK_NOT_FOUND",
        "Задача не найдена в этом проекте",
      ),
    };
  }
  const controller = new AbortController();
  const outer = opts.signal ?? null;
  const onAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", onAbort, { once: true });

  let runId = null;
  let open = false;
  let writeError = null;
  let result = null;
  const request = {
    project: {
      id: start.id,
      executor: start.executor,
      budget_usd: start.budget_usd,
      spent_usd: start.spent_usd,
    },
    run_id: null,
    purpose,
    role: roleByCode(role),
    task:
      taskRecord === null
        ? null
        : {
            id: taskRecord.id,
            text: taskRecord.text,
            done_when: taskRecord.done_when,
          },
    attempt,
    context,
    limits: {
      max_budget_usd: maxBudget,
      timeout_ms: config.taskTimeoutMs,
      work_dir: writer.workDir,
    },
    answer_schema: answerSchema,
    scenario_path: writer.scenarioPath,
  };
  const io = {
    onEvent: (event) => onEvent(event),
    signal: controller.signal,
    env: opts.env ?? process.env,
    config,
    spawn: opts.spawn,
  };

  function onEvent(event) {
    if (writeError !== null || !open) return;
    try {
      writer.append({
        source: "AGENT",
        type: "AGENT_ACTIVITY",
        task,
        data: {
          run_id: runId,
          activity: event.activity,
          executor: start.executor,
          text: prepared(event.text, LIMITS.SUMMARY_MAX),
        },
      });
    } catch (err) {
      writeError = err;
      controller.abort();
    }
  }

  function finishRun(outcome, summary, cost, files) {
    writer.append({
      source: "ENGINE",
      type: "RUN_FINISHED",
      task,
      data: { run_id: runId, outcome, summary, cost_usd: cost, files },
    });
    open = false;
  }

  // BUDGET_SPENT after a run with a process, as runTask does (REQ-010, 8.4).
  function charge(cost) {
    if (result === null || !result.spawned) return;
    const amount = cost === null ? (maxBudget === null ? 0 : maxBudget) : cost;
    writer.append({
      source: "ENGINE",
      type: "BUDGET_SPENT",
      task,
      data: {
        run_id: runId,
        cost_usd: amount,
        accounted: cost === null ? "assumed" : "reported",
        total_usd: round6(writer.state.spent_usd + amount),
      },
    });
  }

  // The files the test executor keeps in memory (the input it recorded): result
  // files without a task, named after the run. Only a run without a task lists
  // them in RUN_FINISHED (И15: a file of the run is a file of its task).
  function importOutputs() {
    const names = [];
    for (const output of result.outputs ?? []) {
      const name = `${runId}-${output.name}`;
      if (!checkResultName(name).ok) continue;
      writer.importResultBytes({
        task: null,
        name,
        bytes: output.bytes,
        kind: output.kind,
      });
      names.push(name);
    }
    return task === null ? names : [];
  }

  function closeAfterError() {
    try {
      if (open) {
        const cost = result === null ? null : recordableCost(result.cost_usd);
        finishRun("failed", null, cost, []);
        charge(cost);
      }
    } catch {
      writer.markBroken();
    }
  }

  try {
    let executor;
    try {
      executor = getExecutor(start.executor);
      executor.check(request, io);
    } catch (err) {
      if (err instanceof TeamError) {
        return { result: null, run_id: null, error: err };
      }
      throw err;
    }
    runId = writer.nextRunId();
    request.run_id = runId;
    writer.append({
      source: "ENGINE",
      type: "RUN_STARTED",
      task,
      data: {
        run_id: runId,
        purpose,
        role,
        executor: start.executor,
        max_budget_usd: maxBudget,
      },
    });
    open = true;
    if (afterStart !== null) afterStart(runId);
    result = await executor.run(request, io);
    if (writeError !== null) throw writeError;
    const cost = recordableCost(result.cost_usd);
    const names = result.outcome === "ok" ? importOutputs() : [];
    finishRun(
      result.outcome,
      prepared(result.summary, LIMITS.SUMMARY_MAX),
      cost,
      names,
    );
    charge(cost);
    if (result.outcome === "cancelled" && task !== null) {
      const cause = cancelCauseOf(outer);
      const t = writer.state.tasks.find((x) => x.id === task);
      if (t.status === "review" || t.status === "running") {
        writer.append({
          source: "ENGINE",
          type: "TASK_INTERRUPTED",
          task,
          data: { cause },
        });
      }
    }
    return { result, run_id: runId, error: null };
  } catch (err) {
    closeAfterError();
    const error = err instanceof TeamError ? err : internal("single run");
    return { result: null, run_id: runId, error };
  } finally {
    outer?.removeEventListener("abort", onAbort);
  }
}
