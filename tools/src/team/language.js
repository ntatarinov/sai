// The module "language" (design REQ-009, section 9; criterion 11): an event, with the
// state rebuilt before it, becomes a phrase for a business owner. A pure module
// without Node API.
//
// A phrase takes only the public fields of a role (name, genitive) and numbers; the
// text of the user or of an agent never goes into a phrase.
import { reduceInPlace } from "./reducer.js";
import { roleByCode, publicRole } from "./roles.js";
import { EVENT_TYPES } from "./schema.js";

export const NEUTRAL_PHRASE = "В проекте произошли изменения";
export const SCRIPTED_SUFFIX = " — тестовый исполнитель";

// The constant texts of the reason of a failure (design REQ-010, sections 8.3 and
// 8.6): the executors and the runner take every `detail` only from here.
export const FAIL_DETAIL = Object.freeze({
  failed: "Исполнитель завершился с ошибкой",
  timeout: "Задача заняла слишком много времени",
  invalid_output: "Исполнитель прислал неверный вывод",
  schema: "Ответ исполнителя не соответствует схеме",
  too_big: "Ответ исполнителя слишком большой",
  network: "Нет доступа к сети",
  budget: "Потолок расходов исчерпан: повтор не начат",
  not_found: "Исполнитель не найден: проверьте SAI_TEAM_CLAUDE_BIN",
  result_file: "Файл результата не найден в рабочей папке или недопустим",
  result_disk: "Не удалось записать файл результата на диск",
  group: "Не удалось остановить процессы исполнителя",
});

const always = () => true;
const dataIs = (key, value) => (event) => event.data?.[key] === value;

function row(type, text, when = always, role = "*") {
  return Object.freeze({ type, role, when, text });
}

const STARTED_BY_ROLE = [
  ["business_analyst", "Аналитик изучает данные"],
  ["researcher", "Исследователь собирает информацию"],
  ["financial_analyst", "Финансовый аналитик считает показатели"],
  ["lawyer", "Юрист изучает правовые вопросы"],
  ["marketer", "Маркетолог готовит материалы"],
  ["designer", "Дизайнер работает над оформлением"],
  ["developer", "Разработчик работает над решением"],
  ["reviewer", "Проверяющий проверяет результат"],
  ["support", "Специалист поддержки готовит ответы"],
  ["project_manager", "Руководитель проекта работает над задачей"],
];

// The rows "type -> phrase"; the first row that fits gives the phrase.
export const PHRASES = Object.freeze([
  row("PROJECT_CREATED", "Создан новый проект"),
  row("PROJECT_STARTED", "Команда приступила к работе"),
  row(
    "PLANNING_STARTED",
    "Руководитель проекта составляет план",
    dataIs("round", 0),
  ),
  row("PLANNING_STARTED", "Руководитель проекта добавляет задачи к плану"),
  row("PLAN_REJECTED", "Руководитель проекта уточняет план"),
  row("PLAN_RETRY", "Руководитель проекта составляет план заново"),
  row("PLAN_RECEIVED", "План готов, задач в плане: {count}"),
  row(
    "PROJECT_WAITING",
    "Не удалось составить план — нужен ваш ответ",
    dataIs("reason", "plan_failed"),
  ),
  row(
    "PROJECT_WAITING",
    "Достигнут потолок расходов — нужно ваше решение",
    dataIs("reason", "budget"),
  ),
  row(
    "PROJECT_WAITING",
    "Задача не получилась — нужно ваше решение",
    dataIs("reason", "task_failed"),
  ),
  row(
    "PROJECT_WAITING",
    "Результат не прошёл проверку — нужно ваше решение",
    dataIs("reason", "review_failed"),
  ),
  row(
    "PROJECT_WAITING",
    "От вас требуется решение",
    dataIs("reason", "approval"),
  ),
  row(
    "PROJECT_WAITING",
    "Цель пока не достигнута — нужно ваше решение",
    dataIs("reason", "goal_check_failed"),
  ),
  row("PROJECT_PAUSED", "Проект на паузе"),
  row("PROJECT_RESUMED", "Работа над проектом продолжается"),
  row(
    "PROJECT_RECOVERED",
    "Работа команды прервалась — чтобы продолжить, возобновите проект",
  ),
  row("PROJECT_STOPPED", "Проект остановлен"),
  row("PROJECT_DONE", "Проект выполнен"),
  row("PROJECT_FAILED", "Проект завершён без результата"),
  row("GOAL_CHECK_STARTED", "Проверяющий сверяет результаты с целью"),
  row("GOAL_CHECK_RESULT", "Цель проекта достигнута", dataIs("passed", true)),
  row("GOAL_CHECK_RESULT", "Цель пока не достигнута"),
  row("BUDGET_SPENT", "Учтены расходы на работу команды"),
  row("BUDGET_SET", "Потолок расходов изменён"),
  row("CHAT", "Новое сообщение от вас", (e) => e.source === "USER"),
  row(
    "CHAT",
    "Команда задала вам вопрос",
    (e) => e.source === "ENGINE" && e.data?.kind === "question",
  ),
  row(
    "CHAT",
    "Сообщение от команды",
    (e) => e.source === "ENGINE" && e.data?.kind === "message",
  ),
  row("MEMORY_ADDED", "В память проекта добавлен факт", dataIs("kind", "fact")),
  row("MEMORY_ADDED", "Записано решение", dataIs("kind", "decision")),
  row("MEMORY_ADDED", "Добавлена заметка", dataIs("kind", "note")),
  row(
    "RESULT_FILE",
    "Готов новый файл с результатом",
    dataIs("kind", "result"),
  ),
  row("RESULT_FILE", "Готов черновик", dataIs("kind", "draft")),
  row(
    "LOCK_STALE_REMOVED",
    "Проект снова доступен после неожиданной остановки",
  ),
  row("JOURNAL_RECOVERED", "После сбоя отброшена недописанная запись"),
  row(
    "TASK_CREATED",
    "Ожидает результат от {dep_genitive}",
    (e, ctx) => ctx.unfinishedDeps.length === 1,
  ),
  row(
    "TASK_CREATED",
    "Ожидает результаты других задач",
    (e, ctx) => ctx.unfinishedDeps.length > 1,
  ),
  row("TASK_CREATED", "{name}: новая задача"),
  ...STARTED_BY_ROLE.map(([code, text]) =>
    row("TASK_STARTED", text, always, code),
  ),
  row(
    "RUN_STARTED",
    "{name} приступает к задаче",
    (e, ctx) => e.data?.purpose === "work" && ctx.attempt === 1,
  ),
  row(
    "RUN_STARTED",
    "{name} пробует ещё раз, попытка {attempt}",
    (e, ctx) => e.data?.purpose === "work" && ctx.attempt >= 2,
  ),
  row(
    "RUN_STARTED",
    "Проверяющий проверяет результат",
    dataIs("purpose", "review"),
  ),
  row(
    "RUN_STARTED",
    "Руководитель проекта составляет план",
    dataIs("purpose", "plan"),
  ),
  row(
    "RUN_STARTED",
    "Проверяющий сверяет результаты с целью",
    dataIs("purpose", "goal_check"),
  ),
  row(
    "AGENT_ACTIVITY",
    "{name} изучает материалы",
    dataIs("activity", "reading"),
  ),
  row("AGENT_ACTIVITY", "Собирает информацию", dataIs("activity", "searching")),
  row(
    "AGENT_ACTIVITY",
    "{name} готовит документ",
    dataIs("activity", "writing"),
  ),
  row(
    "AGENT_ACTIVITY",
    "{name} обдумывает задачу",
    dataIs("activity", "thinking"),
  ),
  row(
    "AGENT_ACTIVITY",
    "{name} работает над задачей",
    dataIs("activity", "other"),
  ),
  row("RUN_FINISHED", "{name}: попытка завершена", dataIs("outcome", "ok")),
  row("RUN_FINISHED", "Нет доступа к сети", dataIs("outcome", "network")),
  row(
    "RUN_FINISHED",
    "Задача заняла слишком много времени",
    dataIs("outcome", "timeout"),
  ),
  row("RUN_FINISHED", "Исполнитель недоступен", dataIs("outcome", "not_found")),
  row(
    "RUN_FINISHED",
    "Результат пришёл в неверном виде",
    dataIs("outcome", "invalid_output"),
  ),
  row("RUN_FINISHED", "Попытка не удалась", dataIs("outcome", "failed")),
  row("RUN_FINISHED", "Работа остановлена", dataIs("outcome", "cancelled")),
  row("RUN_FINISHED", "Работа прервана", dataIs("outcome", "interrupted")),
  row("RUN_REFUSED", "Потолок расходов исчерпан, работа не начата"),
  row("TASK_RETRY", "{name} попробует ещё раз"),
  row("TASK_REVIEW", "Результат передан на проверку"),
  row("REVIEW_RESULT", "Проверка пройдена", dataIs("passed", true)),
  row("REVIEW_RESULT", "Проверяющий вернул задачу на доработку"),
  row("TASK_REASSIGNED", "К проекту подключён дополнительный специалист"),
  row(
    "TASK_WAITING_USER",
    "Черновик готов — от вас требуется решение",
    dataIs("reason", "approval"),
  ),
  row(
    "TASK_WAITING_USER",
    "Результат не удаётся довести — нужно ваше решение",
    dataIs("reason", "review_failed"),
  ),
  row(
    "DECISION_RECEIVED",
    "Вы одобрили черновик",
    dataIs("decision", "approve"),
  ),
  row(
    "DECISION_RECEIVED",
    "Вы попросили изменить результат",
    dataIs("decision", "change"),
  ),
  row(
    "DECISION_RECEIVED",
    "Вы отклонили черновик",
    dataIs("decision", "reject"),
  ),
  row("TASK_DONE", "{name}: задача готова", dataIs("via", "review")),
  row(
    "TASK_DONE",
    "Черновик принят, действие вовне не выполнено",
    dataIs("via", "approval"),
  ),
  row(
    "TASK_FAILED",
    "Задача отклонена вами",
    dataIs("reason", "rejected_by_user"),
  ),
  row(
    "TASK_FAILED",
    "{name}: файл с результатом не удалось принять",
    dataIs("reason", "result_file"),
  ),
  row(
    "TASK_FAILED",
    "{name}: нет доступа к сети, задача не получилась",
    (e) =>
      e.data?.reason === "retries_exhausted" &&
      e.data?.detail === FAIL_DETAIL.network,
  ),
  row(
    "TASK_FAILED",
    "{name}: потолок расходов исчерпан, задача остановлена",
    (e) =>
      e.data?.reason === "retries_exhausted" &&
      e.data?.detail === FAIL_DETAIL.budget,
  ),
  row("TASK_FAILED", "{name}: задача не получилась"),
  row("TASK_INTERRUPTED", "Работа над задачей прервана"),
]);

function isObject(v) {
  return v !== null && typeof v === "object";
}

function publicOf(code) {
  const r = roleByCode(code);
  return r === null ? null : publicRole(r);
}

function taskOf(state, id) {
  if (!isObject(state) || !Array.isArray(state.tasks)) return null;
  return state.tasks.find((t) => t.id === id) ?? null;
}

function runOf(state, runId) {
  if (!isObject(state) || !isObject(state.runs)) return null;
  return state.runs.open?.[runId] ?? state.runs.closed?.[runId] ?? null;
}

// The role an event is about and the numbers a phrase may use.
function contextOf(event, state) {
  const data = isObject(event.data) ? event.data : {};
  const ctx = {
    roleCode: null,
    unfinishedDeps: [],
    attempt: null,
    count: null,
  };
  const task =
    typeof event.task === "string" ? taskOf(state, event.task) : null;
  switch (event.type) {
    case "TASK_CREATED": {
      ctx.roleCode = data.role ?? null;
      const deps = Array.isArray(data.depends_on) ? data.depends_on : [];
      ctx.unfinishedDeps = deps
        .map((id) => taskOf(state, id))
        .filter((t) => t === null || t.status !== "done");
      break;
    }
    case "RUN_STARTED":
      ctx.roleCode = data.role ?? null;
      if (task !== null) ctx.attempt = task.attempts + 1;
      break;
    case "AGENT_ACTIVITY":
    case "RUN_FINISHED":
      ctx.roleCode = runOf(state, data.run_id)?.role ?? null;
      break;
    case "PLAN_RECEIVED":
      ctx.count = Array.isArray(data.tasks) ? data.tasks.length : null;
      break;
    default:
      ctx.roleCode = task?.role ?? null;
  }
  return ctx;
}

// Fills the placeholders; null when a value is missing.
function fill(text, ctx) {
  let missing = false;
  const out = text.replace(
    /\{(name|dep_genitive|count|attempt)\}/g,
    (_, key) => {
      let value = null;
      if (key === "name") value = publicOf(ctx.roleCode)?.name ?? null;
      if (key === "dep_genitive") {
        const dep = ctx.unfinishedDeps[0];
        value = dep ? (publicOf(dep.role)?.genitive ?? null) : null;
      }
      if (key === "count") value = ctx.count;
      if (key === "attempt") value = ctx.attempt;
      if (value === null || value === undefined) missing = true;
      return String(value);
    },
  );
  return missing ? null : out;
}

function hasScriptedSuffix(type, state) {
  return (
    isObject(state) &&
    state.executor === "scripted" &&
    (type.startsWith("TASK_") ||
      type.startsWith("RUN_") ||
      type === "AGENT_ACTIVITY" ||
      type === "MEMORY_ADDED")
  );
}

// The phrase of an event; stateBefore is the state rebuilt before it (null before
// the first event). An unknown type gives NEUTRAL_PHRASE, without the type code.
export function phrase(event, stateBefore) {
  if (
    !isObject(event) ||
    typeof event.type !== "string" ||
    !Object.prototype.hasOwnProperty.call(EVENT_TYPES, event.type)
  ) {
    return NEUTRAL_PHRASE;
  }
  const ctx = contextOf(event, stateBefore);
  for (const r of PHRASES) {
    if (r.type !== event.type) continue;
    if (r.role !== "*" && r.role !== ctx.roleCode) continue;
    if (!r.when(event, ctx)) continue;
    const text = fill(r.text, ctx);
    if (text === null) return NEUTRAL_PHRASE;
    return hasScriptedSuffix(event.type, stateBefore)
      ? `${text}${SCRIPTED_SUFFIX}`
      : text;
  }
  return NEUTRAL_PHRASE;
}

// The phrases of a whole journal, in order (each with the state before its event).
export function phrasesForJournal(events) {
  const out = [];
  let state = null;
  for (const event of events) {
    out.push(phrase(event, state));
    state = reduceInPlace(state, event);
  }
  return out;
}
