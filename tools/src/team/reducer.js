// The state of a project from its events (design REQ-009, section 5): the shape of
// the state, the transitions of the statuses, the invariants И1-И21 and the
// progress. A pure module without Node API: reduce() does not change its input and
// reads neither the clock nor the environment, so the state of the writer is deeply
// equal to the state another process rebuilds from the file (criterion 2).
import { TeamError, transitionError } from "./errors.js";
import { FINAL_PROJECT_STATUS, LIMITS } from "./schema.js";

// Events allowed after a final status of the project (И2).
const AFTER_FINAL = new Set([
  "CHAT",
  "MEMORY_ADDED",
  "RUN_FINISHED",
  "BUDGET_SPENT",
  "TASK_INTERRUPTED",
  "LOCK_STALE_REMOVED",
  "JOURNAL_RECOVERED",
]);

// Events that start work: forbidden while the project is paused by recovery (И13).
const WORK_STARTERS = new Set([
  "PLANNING_STARTED",
  "PLAN_RETRY",
  "PLAN_RECEIVED",
  "TASK_STARTED",
  "RUN_STARTED",
  "TASK_REVIEW",
  "GOAL_CHECK_STARTED",
]);

const MONEY_EPSILON = 1e-6;

export function initialState() {
  return null;
}

export function taskIdFor(n) {
  return `t-${String(n).padStart(4, "0")}`;
}

export function runIdFor(n) {
  return `r-${String(n).padStart(5, "0")}`;
}

function taskNumber(id) {
  return Number(id.slice(2));
}

function fail(rule, what) {
  throw transitionError(rule, what);
}

function requireStatus(state, allowed, rule, what) {
  if (!allowed.includes(state.status)) fail(rule, what);
}

function findTask(state, id) {
  return state.tasks.find((t) => t.id === id) ?? null;
}

function openRunOfTask(state, taskId) {
  return Object.values(state.runs.open).some((run) => run.task === taskId);
}

// И21: the last closed review run of the task, started after it went to review,
// was closed as interrupted.
function reviewRunInterrupted(state, t) {
  let last = null;
  for (const run of Object.values(state.runs.closed)) {
    if (run.purpose !== "review" || run.task !== t.id) continue;
    if (run.started_seq <= (t.review_since_seq ?? 0)) continue;
    if (last === null || run.started_seq > last.started_seq) last = run;
  }
  return last !== null && last.outcome === "interrupted";
}

function anyRun(state, runId) {
  return state.runs.open[runId] ?? state.runs.closed[runId] ?? null;
}

function newTask(id, data, ts) {
  return {
    id,
    role: data.role,
    text: data.text,
    done_when: data.done_when,
    depends_on: [...data.depends_on],
    critical: data.critical,
    status: "waiting",
    attempts: 0,
    files: [],
    last_review: null,
    last_decision: null,
    waiting_since_seq: null,
    review_since_seq: null,
    reason: null,
    created_at: ts,
    updated_at: ts,
  };
}

// И5 for a list of new tasks (TASK_CREATED: one; PLAN_RECEIVED: the plan).
function checkNewTasks(state, items) {
  if (state.tasks.length + items.length > LIMITS.PROJECT_TASKS_MAX) {
    fail("И5", `в проекте не больше ${LIMITS.PROJECT_TASKS_MAX} задач`);
  }
  items.forEach((item, i) => {
    const expected = taskIdFor(state.tasks.length + i + 1);
    if (item.id !== expected)
      fail("И5", `номер задачи должен быть ${expected}`);
    const own = taskNumber(item.id);
    const seen = new Set();
    for (const dep of item.depends_on) {
      if (seen.has(dep)) fail("И5", "зависимость повторяется");
      seen.add(dep);
      if (taskNumber(dep) >= own || taskNumber(dep) < 1) {
        fail("И5", "зависимость только от задачи с меньшим номером");
      }
    }
  });
}

function initState(event) {
  const d = event.data;
  return {
    id: event.project,
    goal: d.goal,
    status: "created",
    executor: d.executor,
    budget_usd: d.budget_usd,
    spent_usd: 0,
    scenario_file: d.scenario_file,
    created_at: event.ts,
    updated_at: event.ts,
    last_seq: event.seq,
    last_ts: event.ts,
    parallel: null,
    paused_by: null,
    plan: { round: 0, attempt: 0, last_rejection: null },
    goal_check: { round: 0, passed: null, seq: null },
    tasks_changed_seq: null,
    waiting: null,
    tasks: [],
    runs: { next: 1, open: {}, closed: {}, charged: [] },
    memory: [],
    files: [],
    chat: [],
  };
}

function checkTime(state, event) {
  const prev = Date.parse(state.last_ts);
  const at = Date.parse(event.ts);
  if (event.source === "ENGINE") {
    if (at < prev) {
      throw new TeamError(
        "E_TIME",
        "Часы компьютера показывают время раньше последней записи проекта",
        { rule: "И11" },
      );
    }
  } else if (at < prev - LIMITS.TIME_SKEW_MS) {
    throw new TeamError(
      "E_TIME",
      `Время события раньше допустимого: больше чем на ${LIMITS.TIME_SKEW_MS} мс раньше последней записи`,
      { rule: "И11" },
    );
  }
}

// ---- handlers: each checks everything first, then changes the state -------------

const PROJECT_LIVE = [
  "created",
  "planning",
  "running",
  "paused",
  "waiting_user",
];

const HANDLERS = {
  PROJECT_STARTED(s, e) {
    requireStatus(s, ["created"], "И2", "проект уже запущен");
    s.status = "running";
    s.parallel = e.data.parallel;
  },
  PLANNING_STARTED(s, e) {
    requireStatus(s, ["created", "running"], "И20", "планирование уже идёт");
    s.status = "planning";
    s.plan = { round: e.data.round, attempt: 1, last_rejection: null };
  },
  PLAN_REJECTED(s, e) {
    const d = e.data;
    requireStatus(s, ["planning"], "И20", "план сейчас не составляется");
    if (d.round !== s.plan.round) fail("И20", "другой раунд плана");
    if (d.attempt !== s.plan.attempt) fail("И20", "другая попытка плана");
    if (
      s.plan.last_rejection !== null &&
      s.plan.last_rejection.attempt === s.plan.attempt
    ) {
      fail("И20", "эта попытка плана уже отклонена");
    }
    s.plan.last_rejection = {
      reason: d.reason,
      detail: d.detail,
      attempt: d.attempt,
    };
  },
  PLAN_RETRY(s, e) {
    requireStatus(s, ["planning"], "И20", "план сейчас не составляется");
    const last = s.plan.last_rejection;
    if (last === null || last.attempt !== 1 || s.plan.attempt !== 1) {
      fail("И20", "повтор плана только после отклонения первой попытки");
    }
    if (e.data.round !== s.plan.round) fail("И20", "другой раунд плана");
    s.plan.attempt = 2;
  },
  PLAN_RECEIVED(s, e) {
    requireStatus(s, ["planning"], "И2", "план сейчас не составляется");
    if (e.data.round !== s.plan.round) fail("И20", "другой раунд плана");
    checkNewTasks(s, e.data.tasks);
    for (const item of e.data.tasks) s.tasks.push(newTask(item.id, item, e.ts));
    s.status = "running";
    s.plan.last_rejection = null;
    s.tasks_changed_seq = e.seq;
  },
  PROJECT_WAITING(s, e) {
    requireStatus(s, ["planning", "running"], "И2", "проект не в работе");
    s.status = "waiting_user";
    s.waiting = { reason: e.data.reason, task: e.task };
  },
  PROJECT_PAUSED(s) {
    requireStatus(
      s,
      ["planning", "running", "waiting_user"],
      "И2",
      "поставить на паузу можно только идущий проект",
    );
    s.status = "paused";
    s.paused_by = "user";
  },
  PROJECT_RESUMED(s, e) {
    const after = e.data.after;
    if (s.status === "paused") {
      const expected = s.paused_by === "recovery" ? "recovery" : "command";
      if (after !== expected) fail("И13", "причина возобновления не та");
    } else if (s.status === "waiting_user") {
      if (after !== "decision" && after !== "budget") {
        fail("И13", "причина возобновления не та");
      }
    } else {
      fail(
        "И13",
        "возобновить можно только проект на паузе или ждущий решения",
      );
    }
    s.status = "running";
    s.waiting = null;
    s.paused_by = null;
    if (e.data.parallel !== null) s.parallel = e.data.parallel;
  },
  PROJECT_RECOVERED(s, e) {
    requireStatus(s, ["planning", "running"], "И13", "проект не в работе");
    if (e.data.from_status !== s.status) fail("И13", "статус проекта другой");
    if (Object.keys(s.runs.open).length > 0) {
      fail("И13", "есть открытые запуски");
    }
    // (r5) A review task without an open run waits for its check and may stay.
    if (s.tasks.some((t) => t.status === "running")) {
      fail("И13", "есть задачи в работе");
    }
    if (e.data.closed_runs + e.data.interrupted_tasks < 1) {
      fail("И13", "восстановление ничего не прервало");
    }
    s.status = "paused";
    s.paused_by = "recovery";
  },
  PROJECT_STOPPED(s) {
    requireStatus(s, PROJECT_LIVE, "И2", "проект уже завершён");
    s.status = "stopped";
    s.waiting = null;
    s.paused_by = null;
  },
  PROJECT_DONE(s) {
    requireStatus(s, ["running"], "И2", "проект не в работе");
    if (s.tasks.length === 0) fail("И6", "в проекте нет задач");
    if (s.tasks.some((t) => t.status !== "done")) {
      fail("И6", "не все задачи готовы");
    }
    if (
      s.goal_check.passed !== true ||
      s.goal_check.seq === null ||
      s.goal_check.seq <= (s.tasks_changed_seq ?? 0)
    ) {
      fail("И6", "нет проверки цели после последнего изменения задач");
    }
    s.status = "done";
    s.waiting = null;
  },
  PROJECT_FAILED(s) {
    requireStatus(s, PROJECT_LIVE, "И2", "проект уже завершён");
    s.status = "failed";
    s.waiting = null;
    s.paused_by = null;
  },
  GOAL_CHECK_STARTED(s, e) {
    const run = s.runs.open[e.data.run_id];
    if (run === undefined || run.purpose !== "goal_check") {
      fail("И7", "нет открытого запуска проверки цели");
    }
    s.goal_check.round = e.data.round;
    s.goal_check.passed = null;
  },
  GOAL_CHECK_RESULT(s, e) {
    const run = anyRun(s, e.data.run_id);
    if (run === null || run.purpose !== "goal_check") {
      fail("И7", "нет запуска проверки цели");
    }
    s.goal_check = { round: e.data.round, passed: e.data.passed, seq: e.seq };
  },
  BUDGET_SPENT(s, e) {
    const d = e.data;
    const run = anyRun(s, d.run_id);
    if (run === null) fail("И8", "нет такого запуска");
    if (s.runs.charged.includes(d.run_id)) {
      fail("И8", "расход этого запуска уже учтён");
    }
    if ((e.task ?? null) !== run.task)
      fail("И8", "задача не та, что у запуска");
    if (Math.abs(s.spent_usd + d.cost_usd - d.total_usd) > MONEY_EPSILON) {
      fail("И8", "итог расходов не сходится");
    }
    s.spent_usd = d.total_usd;
    s.runs.charged.push(d.run_id);
  },
  BUDGET_SET(s, e) {
    const b = e.data.budget_usd;
    if (!(b > 0) || !(b > s.spent_usd)) {
      fail("И8", "потолок должен быть больше нуля и больше потраченного");
    }
    s.budget_usd = b;
  },
  CHAT(s, e) {
    s.chat.push({
      seq: e.seq,
      ts: e.ts,
      source: e.source,
      kind: e.data.kind,
      text: e.data.text,
      task: e.task,
      truncated: e.data.truncated,
    });
  },
  MEMORY_ADDED(s, e) {
    if (e.source === "AGENT" && e.data.executor !== s.executor) {
      fail("И12", "исполнитель не тот, что у проекта");
    }
    s.memory.push({
      seq: e.seq,
      kind: e.data.kind,
      text: e.data.text,
      task: e.task,
      source: e.source,
    });
  },
  RESULT_FILE(s, e) {
    const d = e.data;
    if (s.files.some((f) => f.name === d.name)) {
      fail("P6", "файл с таким именем уже есть");
    }
    s.files.push({
      seq: e.seq,
      name: d.name,
      task: e.task,
      bytes: d.bytes,
      sha256: d.sha256,
      kind: d.kind,
      from_work: d.from_work,
    });
    if (e.task !== null) {
      const t = findTask(s, e.task);
      t.files.push(d.name);
      t.updated_at = e.ts;
      s.tasks_changed_seq = e.seq;
    }
  },
  LOCK_STALE_REMOVED() {},
  JOURNAL_RECOVERED() {},
  TASK_CREATED(s, e) {
    checkNewTasks(s, [{ id: e.task, depends_on: e.data.depends_on }]);
    s.tasks.push(newTask(e.task, e.data, e.ts));
    s.tasks_changed_seq = e.seq;
  },
  TASK_STARTED(s, e, t) {
    if (
      !["waiting", "interrupted", "failed", "review", "waiting_user"].includes(
        t.status,
      )
    ) {
      fail("И2", "задачу нельзя начать в этом статусе");
    }
    for (const dep of t.depends_on) {
      if (findTask(s, dep)?.status !== "done") {
        fail("И3", "не все зависимости задачи готовы");
      }
    }
    t.status = "running";
    t.reason = null;
    touch(s, e, t);
  },
  RUN_STARTED(s, e) {
    const d = e.data;
    if (d.run_id !== runIdFor(s.runs.next)) {
      fail("И7", `номер запуска должен быть ${runIdFor(s.runs.next)}`);
    }
    if (d.executor !== s.executor)
      fail("И12", "исполнитель не тот, что у проекта");
    let t = null;
    if (d.purpose === "work" || d.purpose === "review") {
      t = findTask(s, e.task);
      if (d.purpose === "work") {
        if (t.status !== "running") fail("И16", "задача не в работе");
        if (d.role !== t.role) fail("И16", "роль запуска не та, что у задачи");
      } else {
        if (t.status !== "review") fail("И16", "задача не на проверке");
        if (d.role !== "reviewer") fail("И16", "проверку ведёт проверяющий");
      }
      if (openRunOfTask(s, t.id))
        fail("И16", "у задачи уже есть открытый запуск");
    } else if (d.purpose === "plan") {
      if (s.status !== "planning") fail("И16", "план сейчас не составляется");
      if (d.role !== "project_manager") {
        fail("И16", "план составляет руководитель проекта");
      }
    } else {
      if (s.status !== "running") fail("И16", "проект не в работе");
      if (d.role !== "reviewer") fail("И16", "цель сверяет проверяющий");
    }
    s.runs.open[d.run_id] = {
      purpose: d.purpose,
      role: d.role,
      task: e.task,
      executor: d.executor,
      started_seq: e.seq,
    };
    s.runs.next += 1;
    if (d.purpose === "work") {
      t.attempts += 1;
      touch(s, e, t);
    }
  },
  AGENT_ACTIVITY(s, e) {
    const run = s.runs.open[e.data.run_id];
    if (run === undefined) fail("И7", "нет такого открытого запуска");
    if ((e.task ?? null) !== run.task)
      fail("И7", "задача не та, что у запуска");
    if (e.data.executor !== s.executor || e.data.executor !== run.executor) {
      fail("И12", "исполнитель не тот, что у проекта");
    }
  },
  RUN_FINISHED(s, e) {
    const d = e.data;
    const run = s.runs.open[d.run_id];
    if (run === undefined) fail("И7", "нет такого открытого запуска");
    if ((e.task ?? null) !== run.task)
      fail("И7", "задача не та, что у запуска");
    for (const fileName of d.files) {
      const file = s.files.find((f) => f.name === fileName);
      if (
        file === undefined ||
        file.task !== run.task ||
        file.seq <= run.started_seq
      ) {
        fail("И15", "файл не записан этим запуском");
      }
    }
    delete s.runs.open[d.run_id];
    s.runs.closed[d.run_id] = {
      purpose: run.purpose,
      task: run.task,
      outcome: d.outcome,
      started_seq: run.started_seq,
    };
  },
  RUN_REFUSED(s, e, t) {
    if (!["waiting", "running", "interrupted", "failed"].includes(t.status)) {
      fail("И18", "задачу в этом статусе не запускают");
    }
    if (openRunOfTask(s, t.id))
      fail("И18", "у задачи уже есть открытый запуск");
  },
  TASK_RETRY(s, e, t) {
    if (t.status !== "running") fail("И2", "задача не в работе");
  },
  TASK_REVIEW(s, e, t) {
    if (t.status !== "running") fail("И2", "задача не в работе");
    t.status = "review";
    t.review_since_seq = e.seq;
    touch(s, e, t);
  },
  REVIEW_RESULT(s, e, t) {
    if (t.status !== "review") fail("И2", "задача не на проверке");
    const run = anyRun(s, e.data.run_id);
    if (
      run === null ||
      run.purpose !== "review" ||
      run.task !== t.id ||
      run.started_seq <= (t.review_since_seq ?? 0)
    ) {
      fail("И7", "нет запуска проверки этой задачи");
    }
    t.last_review = {
      run_id: e.data.run_id,
      passed: e.data.passed,
      notes: e.data.notes,
      seq: e.seq,
    };
    touch(s, e, t);
  },
  TASK_REASSIGNED(s, e, t) {
    if (!["review", "failed", "interrupted", "waiting"].includes(t.status)) {
      fail("И2", "задачу в этом статусе не передают");
    }
    if (e.data.from_role !== t.role) fail("И9", "прежняя роль не та");
    if (e.data.to_role === t.role) fail("И9", "новая роль та же");
    t.role = e.data.to_role;
    touch(s, e, t);
  },
  TASK_WAITING_USER(s, e, t) {
    if (t.status !== "running" && t.status !== "review") {
      fail("И2", "задача не в работе");
    }
    const { reason, draft } = e.data;
    const file =
      draft === null ? null : (s.files.find((f) => f.name === draft) ?? null);
    if (reason === "approval") {
      if (t.critical !== true)
        fail("И19", "одобрение нужно только важной задаче");
      if (file === null || file.kind !== "draft" || file.task !== t.id) {
        fail("И19", "нужен черновик этой задачи");
      }
    } else if (draft !== null && (file === null || file.task !== t.id)) {
      fail("И19", "файл не этой задачи");
    }
    t.status = "waiting_user";
    t.reason = reason;
    t.waiting_since_seq = e.seq;
    touch(s, e, t);
  },
  DECISION_RECEIVED(s, e, t) {
    const { decision, text } = e.data;
    if (t.status !== "waiting_user" && t.status !== "failed") {
      fail("И10", "задача не ждёт решения");
    }
    if (decision === "approve" && t.status !== "waiting_user") {
      fail("И10", "одобрить можно только ждущую решения задачу");
    }
    if (decision === "change" && text === null) {
      fail("И10", "нужно описать изменение");
    }
    t.last_decision = { decision, text, seq: e.seq };
    touch(s, e, t);
  },
  TASK_DONE(s, e, t) {
    const d = e.data;
    if (d.via === "review") {
      if (
        t.status !== "review" ||
        t.last_review === null ||
        t.last_review.passed !== true ||
        t.last_review.seq <= (t.review_since_seq ?? 0)
      ) {
        fail("И4", "нет пройденной проверки");
      }
    } else if (
      t.status !== "waiting_user" ||
      t.critical !== true ||
      t.last_decision === null ||
      t.last_decision.decision !== "approve" ||
      t.last_decision.seq <= (t.waiting_since_seq ?? 0) ||
      d.external_action_done !== false
    ) {
      fail("И4", "нет одобрения пользователя");
    }
    t.status = "done";
    t.reason = null;
    touch(s, e, t);
  },
  TASK_FAILED(s, e, t) {
    if (
      !["running", "review", "waiting_user", "interrupted", "waiting"].includes(
        t.status,
      )
    ) {
      fail("И2", "задачу в этом статусе нельзя завершить неудачей");
    }
    t.status = "failed";
    t.reason = e.data.reason;
    touch(s, e, t);
  },
  TASK_INTERRUPTED(s, e, t) {
    if (t.status !== "running" && t.status !== "review") {
      fail("И2", "задача не в работе");
    }
    if (openRunOfTask(s, t.id)) fail("И14", "у задачи есть открытый запуск");
    if (
      e.data.cause === "recovery" &&
      t.status === "review" &&
      !reviewRunInterrupted(s, t)
    ) {
      fail("И21", "проверка задачи не прерывалась");
    }
    t.status = "interrupted";
    t.reason = e.data.cause;
    touch(s, e, t);
  },
};

// "Changes the task" (section 5.3): the task gets updated_at, the project
// tasks_changed_seq (И6).
function touch(s, e, t) {
  t.updated_at = e.ts;
  s.tasks_changed_seq = e.seq;
}

// Applies one event to a state the caller owns (it is changed in place) and
// returns the state. Throws TeamError on a broken rule; the state is then
// undefined, so only callers that drop it on a throw use this (replay, reading).
export function reduceInPlace(state, event) {
  if (state === null) {
    if (event.type !== "PROJECT_CREATED" || event.seq !== 1) {
      fail("И1", "первое событие проекта — его создание");
    }
    return initState(event);
  }
  if (event.type === "PROJECT_CREATED") fail("И1", "проект уже создан");
  if (event.project !== state.id) fail("И1", "событие другого проекта");
  if (event.seq !== state.last_seq + 1)
    fail("И1", "номер события не следующий");
  checkTime(state, event);
  if (
    FINAL_PROJECT_STATUS.includes(state.status) &&
    !AFTER_FINAL.has(event.type)
  ) {
    fail("И2", "проект завершён");
  }
  let task = null;
  if (event.task !== null && event.type !== "TASK_CREATED") {
    task = findTask(state, event.task);
    if (task === null) {
      throw new TeamError(
        "E_TASK_NOT_FOUND",
        "Задача не найдена в этом проекте",
        {
          rule: "И17",
        },
      );
    }
  }
  if (
    state.status === "paused" &&
    state.paused_by === "recovery" &&
    WORK_STARTERS.has(event.type)
  ) {
    fail("И13", "работа прервана аварией — сначала возобновите проект");
  }
  const handler = HANDLERS[event.type];
  if (handler === undefined) fail("И2", "неизвестный тип события");
  handler(state, event, task);
  state.last_seq = event.seq;
  state.last_ts = event.ts;
  state.updated_at = event.ts;
  return state;
}

// The state after the event; the input state is not changed.
export function reduce(state, event) {
  return reduceInPlace(state === null ? null : structuredClone(state), event);
}

// The state of a whole journal (events in order).
export function replay(events) {
  let state = initialState();
  for (const event of events) state = reduceInPlace(state, event);
  return state;
}

// Honest progress (criterion 8): null without tasks, otherwise two numbers.
export function progress(state) {
  if (state === null || state.tasks.length === 0) return null;
  return {
    done: state.tasks.filter((t) => t.status === "done").length,
    total: state.tasks.length,
  };
}
