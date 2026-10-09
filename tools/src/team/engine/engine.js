// The engine of Sai Team (design REQ-013, sections 4-12 and 14-17): one long-lived
// process per project that holds the right to write (the lock of the core with
// holder "engine", C4), plans, starts and checks the tasks, asks the user and
// finishes the project. One process, one thread of JavaScript: every write of the
// journal is synchronous and goes through the one writer, in turn.
//
// Everything needed after a restart is read back from the journal (facts.js); the
// view keeps only what lives while the process lives (the runs in work).
import path from "node:path";
import { readConfig } from "../config.js";
import { TeamError, engineError } from "../errors.js";
import { getExecutor } from "../executor.js";
import {
  SCENARIO_FILE,
  WORK_DIR,
  resolveHome,
  resolveProjectDir,
} from "../home.js";
import { FAIL_DETAIL } from "../language.js";
import { ENGINE_HOLDER, lockHolder } from "../lock.js";
import { roleByCode, ROLE_CODES } from "../roles.js";
import { defaultContext, failDetailFor, runTask } from "../runner.js";
import { PROJECT_STATUS_TEXT } from "../schema.js";
import { openWriter, readProject } from "../store.js";
import { openQuestions, pendingDecisions, questionText } from "./answers.js";
import { applyCommand, checkResume } from "./commands.js";
import { noteEvent, scanFacts } from "./facts.js";
import {
  PLAN_ANSWER_SCHEMA,
  PLAN_DETAIL,
  planNote,
  validatePlan,
} from "./plan.js";
import {
  GOAL_ANSWER_SCHEMA,
  REASSIGN_ANSWER_SCHEMA,
  REVIEW_ANSWER_SCHEMA,
  goalContext,
  reassignNote,
  reviewContext,
} from "./review.js";
import {
  MIN_RUN_USD,
  PARALLEL_DEFAULT,
  ROUNDS_MAX,
  SINGLE_RUNS_MAX,
  nextActions,
  slotBudget,
} from "./schedule.js";
import { runSingle } from "./single-run.js";
import { INBOX_POLL_MS, openInbox } from "./channel.js";
import { eventView } from "../view.js";

// The statuses a task is started from by the engine: every TASK_STARTED of the core.
const ENGINE_START_FROM = Object.freeze([
  "waiting",
  "interrupted",
  "failed",
  "review",
  "waiting_user",
]);
const FINAL = ["stopped", "done", "failed"];
const LIVE = ["planning", "running", "waiting_user"];
const WAITING = ["planning", "running"];
// A wake that keeps finding work without an end is a bug of the program.
const STEPS_MAX = 10_000;
const CANCEL_WAIT_MS = 15_000;
const REJECTED_DETAIL = "Отклонено пользователем";
const BUSY_RETRIES = 3;
const BUSY_PAUSE_MS = 100;

function internal(what) {
  return new TeamError(
    "E_INTERNAL",
    `Внутренняя ошибка ядра Sai Team (${what})`,
  );
}

// The writer of the engine as the engine and runTask use it: every event written
// through append (and the batch of the clean-up) is noted in the facts at once.
function trackedWriter(writer, onEvent) {
  return new Proxy(writer, {
    get(target, prop) {
      if (prop === "append") {
        return (input) => {
          const event = target.append(input);
          onEvent(event);
          return event;
        };
      }
      if (prop === "recordDropped") {
        return (...args) => {
          const events = target.recordDropped(...args);
          for (const e of events) onEvent(e);
          return events;
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

// EngineOpts = { home?, env, config?, now?, parallel?, mode, spawn?, sleep?,
//                poll?: { setTimer, clearTimer } }
// Engine = { run(), state(), requestStop(reason), command(message, ids?) }
export function createEngine(id, opts) {
  const env = opts.env ?? process.env;
  const mode = opts.mode;
  const setTimer = opts.poll?.setTimer ?? setTimeout;
  const clearTimer = opts.poll?.clearTimer ?? clearTimeout;
  const notices = [];
  const view = { inFlight: new Map(), stopping: false, facts: null };

  let config = opts.config ?? null;
  let home = null;
  let projectDir = null;
  let writer = null;
  let tw = null;
  let opened = false;
  let fatal = null;
  let stop = null; // { reason: "stop" | "signal", ids, resolve, reject }
  let exiting = false;
  let timer = null;
  let ticking = false;
  let again = false;
  let finish = null;
  let inbox = null;

  const state = () => writer.state;
  const note = (event) => noteEvent(view.facts, event);

  // ---- opening (section 4.2) -------------------------------------------------------

  function checkMode(s, facts, lockAlive) {
    if (mode === "start") {
      if (s.status !== "created") throw engineError("E_NOT_STARTABLE");
      return;
    }
    if (s.status === "planning" || s.status === "running") {
      if (lockAlive) throw engineError("E_ALREADY_RUNNING");
      return;
    }
    checkResume(s, facts, config);
  }

  function probeOf(s) {
    return {
      project: {
        id: s.id,
        executor: s.executor,
        budget_usd: s.budget_usd,
        spent_usd: s.spent_usd,
      },
      run_id: null,
      purpose: "plan",
      role: roleByCode("project_manager"),
      task: null,
      attempt: 1,
      context: { goal: s.goal, memory: [], deps: [], note: null },
      limits: {
        max_budget_usd: slotBudget(s, config, 0),
        timeout_ms: config.taskTimeoutMs,
        work_dir: path.join(projectDir, WORK_DIR),
      },
      answer_schema: PLAN_ANSWER_SCHEMA,
      scenario_path:
        s.scenario_file === null ? null : path.join(projectDir, SCENARIO_FILE),
    };
  }

  // Step 3 (criterion 2): the checks of the executor before any write. A ceiling
  // that is reached is not a refusal here: the engine waits for a new one.
  function preflight(s) {
    const executor = getExecutor(s.executor);
    try {
      executor.check(probeOf(s), {
        onEvent: () => {},
        signal: new AbortController().signal,
        env,
        config,
        spawn: opts.spawn,
      });
    } catch (err) {
      if (err instanceof TeamError && err.code === "E_BUDGET_EXHAUSTED") return;
      throw err;
    }
  }

  // Section 14: an opener that loses the race for the lock looks again whether
  // the winner is an engine (its lock then names it) before it gives up.
  async function openRetrying() {
    for (let i = 0; ; i += 1) {
      try {
        return openWriter(id, { home, now: opts.now, holder: ENGINE_HOLDER });
      } catch (err) {
        if (!(err instanceof TeamError) || err.code !== "E_PROJECT_BUSY") {
          throw err;
        }
        const holder = lockHolder(projectDir);
        if (
          holder !== null &&
          holder.alive &&
          holder.holder === ENGINE_HOLDER
        ) {
          throw mode === "start"
            ? engineError("E_ENGINE_RUNNING", { pid: holder.pid })
            : engineError("E_ALREADY_RUNNING");
        }
        if (i >= BUSY_RETRIES) throw err;
        await new Promise((r) => setTimeout(r, BUSY_PAUSE_MS));
      }
    }
  }

  async function open() {
    if (config === null) config = readConfig(env);
    home = typeof opts.home === "string" ? opts.home : resolveHome(env);
    const read = readProject(id, { home });
    projectDir = resolveProjectDir(home, id);
    const holder = lockHolder(projectDir);
    const lockAlive = holder !== null && holder.alive;
    if (lockAlive && holder.holder === ENGINE_HOLDER && mode === "start") {
      throw engineError("E_ENGINE_RUNNING", { pid: holder.pid });
    }
    checkMode(read.state, scanFacts(read.events), lockAlive);
    preflight(read.state);
    writer = await openRetrying();
    try {
      notices.push(...writer.notices);
      const events = readProject(id, { home }).events;
      view.facts = scanFacts(events);
      checkMode(writer.state, view.facts, false);
      preflight(writer.state);
      tw = trackedWriter(writer, note);
      inbox = openInbox(projectDir, tw, id);
      notices.push(...inbox.notices);
      if (mode === "start") {
        tw.append({
          source: "USER",
          type: "PROJECT_STARTED",
          task: null,
          data: { parallel: opts.parallel ?? PARALLEL_DEFAULT },
        });
      } else if (!WAITING.includes(writer.state.status)) {
        applyCommand(
          tw,
          { kind: "resume", args: { parallel: opts.parallel ?? null } },
          { facts: view.facts, config },
        );
      } else {
        notices.push("Работа проекта продолжается после остановки процесса");
      }
    } catch (err) {
      writer.close();
      throw err;
    }
    opened = true;
  }

  // ---- the loop (section 4.3) ----------------------------------------------------

  function arm() {
    if (exiting) return;
    timer = setTimer(() => {
      timer = null;
      wake();
      arm();
    }, INBOX_POLL_MS);
  }

  function wake() {
    if (!opened || exiting) return;
    if (ticking) {
      again = true;
      return;
    }
    ticking = true;
    try {
      let steps = 0;
      do {
        again = false;
        if (fatal === null) tick();
        steps += 1;
        if (steps > STEPS_MAX) throw internal("loop");
      } while (again && fatal === null);
    } catch (err) {
      fail(err);
    } finally {
      ticking = false;
    }
    maybeExit();
  }

  function tick() {
    serveInbox();
    if (view.stopping) return;
    applyDecisions();
    const actions = nextActions(state(), view, config);
    for (const action of actions) {
      if (view.stopping) return;
      const before = state().last_seq;
      begin(action);
      if (state().last_seq !== before) again = true;
    }
  }

  // Section 9.3: the answers of the user that are not carried out yet.
  function applyDecisions() {
    for (const d of pendingDecisions(state(), view.facts)) {
      if (d.decision === "approve") {
        tw.append({
          source: "ENGINE",
          type: "TASK_DONE",
          task: d.task,
          data: { via: "approval", external_action_done: false },
        });
      } else if (d.decision === "reject") {
        tw.append({
          source: "ENGINE",
          type: "TASK_FAILED",
          task: d.task,
          data: { reason: "rejected_by_user", detail: REJECTED_DETAIL },
        });
      }
    }
    const s = state();
    if (
      s.status === "waiting_user" &&
      openQuestions(s, view.facts).length === 0
    ) {
      tw.append({
        source: "ENGINE",
        type: "PROJECT_RESUMED",
        task: null,
        data: { parallel: null, after: "decision" },
      });
    }
  }

  // ---- actions (section 4.4) -----------------------------------------------------

  function begin(action) {
    switch (action.kind) {
      case "close_dependents":
        for (const task of action.tasks) {
          tw.append({
            source: "ENGINE",
            type: "TASK_FAILED",
            task,
            data: {
              reason: "dependency_closed",
              detail: FAIL_DETAIL.dependency_closed,
            },
          });
        }
        return;
      case "wait":
        ask(action.question);
        return;
      case "done":
        tw.append({
          source: "ENGINE",
          type: "PROJECT_DONE",
          task: null,
          data: {},
        });
        return;
      case "work":
        launch("work", action.task, action.reserve_usd, (entry) =>
          workRun(entry, action),
        );
        return;
      case "review":
        if (action.finish) finishReview(action.task);
        else {
          launch("review", action.task, action.reserve_usd, (entry) =>
            reviewRun(entry, action.task),
          );
        }
        return;
      case "reassign":
        if (action.giveUp) giveUp(action.task);
        else {
          launch("reassign", action.task, action.reserve_usd, (entry) =>
            reassignRun(entry, action.task),
          );
        }
        return;
      case "plan":
        launch("plan", null, action.reserve_usd, (entry) =>
          planRun(entry, action),
        );
        return;
      case "goal":
        launch("goal", null, action.reserve_usd, (entry) => goalRun(entry));
        return;
      default:
        throw internal("action");
    }
  }

  function reservedExcept(key) {
    let sum = 0;
    for (const [k, a] of view.inFlight) if (k !== key) sum += a.reserve_usd;
    return sum;
  }

  // Starts an asynchronous action: it lives in view.inFlight until it settles.
  function launch(kind, task, reserve, body) {
    const key = task ?? kind;
    const abort = new AbortController();
    const entry = {
      kind,
      task,
      abort,
      reserve_usd: reserve ?? 0,
      runOpts: {
        env,
        config,
        signal: abort.signal,
        spawn: opts.spawn,
        sleep: opts.sleep,
      },
    };
    entry.budget = (s) => {
      const r = slotBudget(s, config, reservedExcept(key));
      entry.reserve_usd = r ?? 0;
      return r;
    };
    view.inFlight.set(key, entry);
    let promise;
    try {
      promise = Promise.resolve(body(entry));
    } catch (err) {
      promise = Promise.reject(err);
    }
    promise
      .catch((err) => fail(err))
      .finally(() => {
        view.inFlight.delete(key);
        wake();
      });
  }

  function writeFailure(r) {
    // A failed write breaks the writer: the engine stops (section 14).
    if (writer.broken) throw r.error ?? internal("writer");
  }

  // A run of runTask (section 6.1, 7.1).
  async function workRun(entry, action) {
    const task = state().tasks.find((t) => t.id === action.task);
    const runOpts = {
      ...entry.runOpts,
      startFrom: ENGINE_START_FROM,
      budgetFor: entry.budget,
      context: { ...defaultContext(tw, task), note: action.note },
    };
    entry.runOpts = runOpts;
    const before = state().tasks.find((t) => t.id === action.task);
    let result;
    try {
      result = await runTask(tw, action.task, runOpts);
    } catch (err) {
      if (writer.broken) throw err;
      const now = state().tasks.find((t) => t.id === action.task);
      // Nothing was written (a refusal of the checks): the engine cannot go on.
      if (now.status === before.status && now.attempts === before.attempts) {
        throw err;
      }
      notices.push(`Задача ${action.task}: ${err.message}`);
      return;
    }
    if (result.status === "refused" && view.inFlight.size === 1) {
      ask({ kind: "budget", task: null });
    }
  }

  // The check of a result (section 8.2): a separate run of the reviewer.
  async function reviewRun(entry, taskId) {
    let last = null;
    for (let n = 1; n <= SINGLE_RUNS_MAX; n += 1) {
      if (entry.abort.signal.aborted) return;
      const reserve = entry.budget(state());
      if (reserve !== null && reserve < MIN_RUN_USD) return;
      const task = state().tasks.find((t) => t.id === taskId);
      const r = await runSingle(
        tw,
        {
          purpose: "review",
          role: "reviewer",
          task: taskId,
          context: reviewContext(tw, task),
          answer_schema: REVIEW_ANSWER_SCHEMA,
          maxBudget: reserve,
        },
        entry.runOpts,
      );
      writeFailure(r);
      if (r.run_id === null) {
        if (r.error?.code === "E_BUDGET_EXHAUSTED") return;
        throw r.error;
      }
      if (r.result?.outcome === "cancelled") return;
      const answer = r.result?.outcome === "ok" ? r.result.answer : null;
      if (answer !== null && answer.notes.trim() !== "") {
        if (state().tasks.find((t) => t.id === taskId).status !== "review") {
          return;
        }
        tw.append({
          source: "ENGINE",
          type: "REVIEW_RESULT",
          task: taskId,
          data: {
            run_id: r.run_id,
            passed: answer.passed,
            notes: answer.notes,
          },
        });
        if (answer.passed) finishReview(taskId);
        return;
      }
      last = r.result;
    }
    if (state().tasks.find((t) => t.id === taskId).status !== "review") return;
    const key = last === null ? "failed" : failDetailFor(last);
    tw.append({
      source: "ENGINE",
      type: "TASK_FAILED",
      task: taskId,
      data: {
        reason: "retries_exhausted",
        detail: FAIL_DETAIL[key] ?? FAIL_DETAIL.failed,
      },
    });
  }

  function latestDraft(task) {
    const drafts = state().files.filter(
      (f) => f.task === task && f.kind === "draft",
    );
    return drafts.length === 0 ? null : drafts[drafts.length - 1].name;
  }

  // A passed check: an ordinary task is done; a critical one waits for the user.
  function finishReview(taskId) {
    const t = state().tasks.find((x) => x.id === taskId);
    if (!t.critical) {
      tw.append({
        source: "ENGINE",
        type: "TASK_DONE",
        task: taskId,
        data: { via: "review", external_action_done: false },
      });
      return;
    }
    const draft = latestDraft(taskId);
    tw.append({
      source: "ENGINE",
      type: "TASK_WAITING_USER",
      task: taskId,
      data:
        draft === null
          ? { reason: "review_failed", draft: null }
          : { reason: "approval", draft },
    });
  }

  function giveUp(taskId) {
    tw.append({
      source: "ENGINE",
      type: "TASK_WAITING_USER",
      task: taskId,
      data: { reason: "review_failed", draft: latestDraft(taskId) },
    });
  }

  // Section 8.3: the project manager chooses another role (C2).
  async function reassignRun(entry, taskId) {
    const reserve = entry.budget(state());
    if (reserve !== null && reserve < MIN_RUN_USD) return;
    const task = state().tasks.find((t) => t.id === taskId);
    const r = await runSingle(
      tw,
      {
        purpose: "reassign",
        role: "project_manager",
        task: taskId,
        context: {
          ...defaultContext(tw, { depends_on: [] }),
          note: reassignNote(state(), task, view.facts),
        },
        answer_schema: REASSIGN_ANSWER_SCHEMA,
        maxBudget: reserve,
      },
      entry.runOpts,
    );
    writeFailure(r);
    if (r.run_id === null && r.error?.code === "E_BUDGET_EXHAUSTED") return;
    if (r.result?.outcome === "cancelled") return;
    const now = state().tasks.find((t) => t.id === taskId);
    if (now.status !== "review") return;
    const answer = r.result?.outcome === "ok" ? r.result.answer : null;
    if (
      answer !== null &&
      ROLE_CODES.includes(answer.role) &&
      answer.role !== now.role &&
      answer.reason.trim() !== ""
    ) {
      tw.append({
        source: "ENGINE",
        type: "TASK_REASSIGNED",
        task: taskId,
        data: {
          from_role: now.role,
          to_role: answer.role,
          reason: answer.reason,
        },
      });
      return;
    }
    giveUp(taskId);
  }

  // Section 5.1: the plan of a round with one more attempt after a rejected plan.
  async function planRun(entry, action) {
    if (!action.resume) {
      tw.append({
        source: "ENGINE",
        type: "PLANNING_STARTED",
        task: null,
        data: { round: action.round },
      });
    }
    for (;;) {
      if (entry.abort.signal.aborted || state().status !== "planning") return;
      const plan = state().plan;
      const rejected = plan.last_rejection;
      if (rejected !== null && rejected.attempt === plan.attempt) {
        if (plan.attempt === 1) {
          tw.append({
            source: "ENGINE",
            type: "PLAN_RETRY",
            task: null,
            data: { round: plan.round, attempt: 2 },
          });
          continue;
        }
        ask({ kind: "plan_failed", task: null });
        return;
      }
      const reserve = slotBudget(state(), config, 0);
      if (reserve !== null && reserve < MIN_RUN_USD) {
        ask({ kind: "budget", task: null });
        return;
      }
      entry.reserve_usd = reserve ?? 0;
      const rejection = plan.attempt === 2 ? (rejected?.detail ?? null) : null;
      const r = await runSingle(
        tw,
        {
          purpose: "plan",
          role: "project_manager",
          task: null,
          context: {
            ...defaultContext(tw, { depends_on: [] }),
            note: planNote(state(), view.facts, rejection),
          },
          answer_schema: PLAN_ANSWER_SCHEMA,
          maxBudget: reserve,
          attempt: plan.attempt,
        },
        entry.runOpts,
      );
      writeFailure(r);
      if (state().status !== "planning") return;
      if (r.run_id === null && r.error?.code === "E_BUDGET_EXHAUSTED") {
        ask({ kind: "budget", task: null });
        return;
      }
      if (r.result?.outcome === "cancelled") return;
      let verdict;
      if (r.result?.outcome === "ok") {
        verdict = validatePlan(r.result.answer, state());
      } else if (r.result?.outcome === "invalid_output") {
        verdict = {
          ok: false,
          reason: "schema",
          detail: PLAN_DETAIL.schema(null),
        };
      } else {
        // Section 5.4: no plan, but not a fault of a plan.
        const detail =
          r.result === null
            ? FAIL_DETAIL.failed
            : (FAIL_DETAIL[failDetailFor(r.result)] ?? FAIL_DETAIL.failed);
        ask({ kind: "plan_failed", task: null, detail });
        return;
      }
      if (verdict.ok) {
        tw.append({
          source: "ENGINE",
          type: "PLAN_RECEIVED",
          task: null,
          data: { round: plan.round, tasks: verdict.tasks },
        });
        return;
      }
      tw.append({
        source: "ENGINE",
        type: "PLAN_REJECTED",
        task: null,
        data: {
          round: plan.round,
          attempt: plan.attempt,
          reason: verdict.reason,
          detail: verdict.detail,
        },
      });
    }
  }

  // Section 11: the check of the goal; a round of more tasks when it fails.
  async function goalRun(entry) {
    let last = null;
    for (let n = 1; n <= SINGLE_RUNS_MAX; n += 1) {
      if (entry.abort.signal.aborted) return;
      const reserve = slotBudget(state(), config, 0);
      if (reserve !== null && reserve < MIN_RUN_USD) {
        if (state().status === "running") ask({ kind: "budget", task: null });
        return;
      }
      entry.reserve_usd = reserve ?? 0;
      const round = state().plan.round;
      const r = await runSingle(
        tw,
        {
          purpose: "goal_check",
          role: "reviewer",
          task: null,
          context: goalContext(tw),
          answer_schema: GOAL_ANSWER_SCHEMA,
          maxBudget: reserve,
          afterStart: (runId) => {
            tw.append({
              source: "ENGINE",
              type: "GOAL_CHECK_STARTED",
              task: null,
              data: { round, run_id: runId },
            });
          },
        },
        entry.runOpts,
      );
      writeFailure(r);
      if (r.run_id === null) {
        if (r.error?.code === "E_BUDGET_EXHAUSTED") return;
        throw r.error;
      }
      if (r.result?.outcome === "cancelled") return;
      const answer = r.result?.outcome === "ok" ? r.result.answer : null;
      if (answer !== null && answer.notes.trim() !== "") {
        tw.append({
          source: "ENGINE",
          type: "GOAL_CHECK_RESULT",
          task: null,
          data: {
            round,
            run_id: r.run_id,
            passed: answer.passed,
            notes: answer.notes,
          },
        });
        if (state().status !== "running") return;
        if (answer.passed) {
          tw.append({
            source: "ENGINE",
            type: "PROJECT_DONE",
            task: null,
            data: {},
          });
        } else if (state().plan.round >= ROUNDS_MAX) {
          ask({ kind: "goal_check_failed", task: null });
        }
        // A failed check below the last round: the round of more tasks is begun
        // by nextActions as an action of its own ("plan"), which a pause cancels.
        return;
      }
      last = r.result;
    }
    if (state().status === "running") {
      const key = last === null ? "failed" : failDetailFor(last);
      ask({
        kind: "goal_check_failed",
        task: null,
        detail: FAIL_DETAIL[key] ?? FAIL_DETAIL.failed,
      });
    }
  }

  // Sections 9, 10: the wait of the project (when it runs) and the one question.
  function ask(question) {
    const s = state();
    if (WAITING.includes(s.status)) {
      tw.append({
        source: "ENGINE",
        type: "PROJECT_WAITING",
        task: question.task,
        data: { reason: question.kind },
      });
    } else if (question.task === null) {
      return;
    }
    tw.append({
      source: "ENGINE",
      type: "CHAT",
      task: question.task,
      data: {
        text: questionText(state(), view.facts, question),
        kind: "question",
        truncated: false,
      },
    });
  }

  // ---- stop, pause with exit, failure (sections 12, 14, 17) ------------------------

  // The cause of the cancel goes with the abort itself (signal.reason): "stop" for
  // a stop, "cancel" otherwise (section 2.2, C5).
  function abortAll(cause) {
    for (const entry of view.inFlight.values()) entry.abort.abort(cause);
  }

  function fail(err) {
    if (fatal === null) fatal = err ?? internal("engine");
    view.stopping = true;
    abortAll("cancel");
  }

  function maybeExit() {
    if (exiting || !opened) return;
    if (fatal !== null) {
      if (view.inFlight.size > 0) return;
      exit();
      return;
    }
    if (stop !== null) {
      if (view.inFlight.size > 0) return;
      try {
        const s = state();
        if (stop.reason === "stop" && !FINAL.includes(s.status)) {
          const before = state();
          stop.event = applyCommand(tw, { kind: "stop", args: {} }, stop.ids);
          if (stop.taken !== undefined) {
            answer(stop.taken, {
              ok: true,
              event: eventView(stop.event, before),
              notices: [],
            });
          }
        } else if (stop.reason === "signal" && LIVE.includes(s.status)) {
          tw.append({
            source: "USER",
            type: "PROJECT_PAUSED",
            task: null,
            data: {},
          });
        }
      } catch (err) {
        fatal = err;
      }
      exit();
      return;
    }
    if (FINAL.includes(state().status) && view.inFlight.size === 0) exit();
  }

  function exit() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    // Section 13.8: every message that lies in inbox/ is executed or refused
    // before the lock is given back; a broken writer answers none (section 14).
    if (fatal === null && !writer.broken) {
      try {
        serveInbox(true);
      } catch (err) {
        fatal = err;
      }
    }
    exiting = true;
    writer.close();
    if (stop !== null && stop.resolve !== undefined) {
      if (fatal === null) stop.resolve(stop.event);
      else stop.reject(fatal);
    }
    finish();
  }

  // reason: "stop" (the command stop: actions stopped, then PROJECT_STOPPED) or
  // "signal" (SIGINT/SIGTERM: actions stopped, then PROJECT_PAUSED, exit).
  function requestStop(reason, ids = {}) {
    if (stop !== null || exiting) return;
    if (reason !== "stop" && reason !== "signal") throw internal("stop");
    stop = { reason, ids };
    view.stopping = true;
    abortAll(reason === "stop" ? "stop" : "cancel");
    queueMicrotask(() => {
      wake();
      maybeExit();
    });
  }

  // ---- the channel (sections 13.5, 13.8) -------------------------------------------

  function answer(m, body) {
    try {
      inbox.answer(m, body);
    } catch {
      // No ack: the sender reports "not confirmed"; the event, if any, is written.
    }
  }

  function refuse(m, err) {
    answer(m, { ok: false, code: err.code, message: err.message });
  }

  // The one way a command of the user reaches a running engine (section 15.5): the
  // channel (handleTaken) and command() both come here. Returns { event } (written
  // in this synchronous call) or { pending: true } (a stop: PROJECT_STOPPED comes
  // after the actions stop). Throws the refusal as a TeamError.
  function receive(message, ids, draining = false) {
    if (!opened) throw internal("engine not open");
    if (exiting && !draining) throw engineError("E_CHANNEL_TIMEOUT_GONE");
    if (fatal !== null) throw engineError("E_ENGINE_STOPPING");
    const s = state();
    // (r5.3, R-1) From a stop or a signal of the process until the exit, every
    // message is refused, a stop too: the actions are being stopped first.
    if (stop !== null && !draining) throw engineError("E_ENGINE_STOPPING");
    if (stop !== null && stop.reason === "stop") {
      throw engineError("E_ENGINE_STOPPING");
    }
    if (draining) {
      // The exit after a signal or a final status (section 13.8).
      if (FINAL.includes(s.status) && message.kind !== "say") {
        throw engineError("E_FINISHED");
      }
      if (message.kind === "resume") throw engineError("E_ENGINE_STOPPING");
    } else if (message.kind === "stop") {
      if (s.status === "stopped") throw engineError("E_STOPPED");
      if (s.status === "done" || s.status === "failed") {
        throw engineError("E_FINISHED");
      }
      requestStop("stop", ids);
      return { pending: true };
    }
    return { event: execute(message, ids) };
  }

  // One taken message of the channel: receive, then its ack.
  function handleTaken(m, draining = false) {
    const ids = { msg: m.msg, nonce: m.nonce };
    const before = state();
    let r;
    try {
      r = receive({ kind: m.kind, args: m.args }, ids, draining);
    } catch (err) {
      if (!(err instanceof TeamError) || writer.broken) throw err;
      refuse(m, err);
      return;
    }
    if (r.pending) {
      stop.taken = m;
      return;
    }
    answer(m, { ok: true, event: eventView(r.event, before), notices: [] });
    again = true;
  }

  function serveInbox(draining = false) {
    if (inbox === null) return;
    for (;;) {
      const m = inbox.take();
      if (m === null) break;
      handleTaken(m, draining);
    }
    inbox.sweep();
  }

  // The check and the write of a command while the engine works.
  function execute(message, ids) {
    const event = applyCommand(tw, message, {
      ...ids,
      facts: view.facts,
      config,
    });
    if (message.kind === "pause") {
      // Section 12.1: a run of the planner in work is cancelled (its plan would
      // not be taken on pause); the other actions are brought to their result.
      for (const entry of view.inFlight.values()) {
        if (entry.kind === "plan") entry.abort.abort("cancel");
      }
    }
    return event;
  }

  // A command of the user while the engine works, in its own process (the tests
  // call it): the same receive as the channel; a stop settles after PROJECT_STOPPED.
  function command(message, ids = {}) {
    try {
      const r = receive(message, ids);
      if (r.pending) {
        return new Promise((resolve, reject) => {
          stop.resolve = resolve;
          stop.reject = reject;
        });
      }
      queueMicrotask(wake);
      return Promise.resolve(r.event);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async function run() {
    await open();
    const done = new Promise((resolve) => {
      finish = resolve;
    });
    arm();
    wake();
    await done;
    if (fatal !== null) throw fatal;
    const s = writer.state;
    return {
      status: s.status,
      status_text: PROJECT_STATUS_TEXT[s.status],
      notices: [...notices],
    };
  }

  return {
    run,
    state: () => (writer === null ? null : writer.state),
    requestStop,
    command,
    // The facts the engine keeps in memory (EN-66 compares them with the journal).
    facts: () => view.facts,
  };
}

// For cli.js: start and resume as a process of the engine. The first SIGINT or
// SIGTERM pauses the project and ends the process; if the actions do not stop in
// CANCEL_WAIT_MS, the process ends without writing (the next opener recovers).
export async function runEngineCommand(mode, args, env) {
  const engine = createEngine(args.id, {
    env,
    mode,
    parallel: args.parallel ?? null,
  });
  let forced = null;
  const onSignal = () => {
    if (forced !== null) return;
    engine.requestStop("signal");
    forced = setTimeout(() => process.exit(1), CANCEL_WAIT_MS);
    forced.unref();
  };
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
  try {
    const result = await engine.run();
    return {
      ok: true,
      project: {
        id: args.id,
        status: result.status,
        status_text: result.status_text,
      },
      notices: result.notices,
    };
  } finally {
    process.removeListener("SIGTERM", onSignal);
    process.removeListener("SIGINT", onSignal);
    if (forced !== null) clearTimeout(forced);
  }
}
