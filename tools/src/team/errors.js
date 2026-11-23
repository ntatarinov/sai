// Errors of the Sai Team core (design REQ-009, sections 10.3 and 11).
//
// Every refusal of the core is a TeamError with a code from the table of section
// 10.3, a Russian message without a stack and, where useful, details. Any other
// error is a bug of the program: the commands show it as E_INTERNAL (exit code 3).
// No Node API here, so the pure modules (schema, reducer) may import this file too.

export class TeamError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TeamError";
    this.code = code;
    this.details = details;
  }
}

// Exit codes of the commands (section 10.1).
export const EXIT = Object.freeze({ OK: 0, REFUSED: 1, USAGE: 2, INTERNAL: 3 });

export function exitCodeFor(err) {
  if (!(err instanceof TeamError)) return EXIT.INTERNAL;
  if (err.code === "E_USAGE" || err.code === "E_CONFIG") return EXIT.USAGE;
  if (err.code === "E_INTERNAL") return EXIT.INTERNAL;
  return EXIT.REFUSED;
}

// An error of the operating system (or of fs): it has a code like "EIO".
export function isOsError(err) {
  return (
    err instanceof Error &&
    typeof err.code === "string" &&
    /^E[A-Z0-9]+$/.test(err.code)
  );
}

export function diskWriteMessage(osCode, rollbackFailed = false) {
  return rollbackFailed
    ? `Не удалось записать на диск (${osCode}); откат не удался — откройте проект заново`
    : `Не удалось записать на диск (${osCode}); данные проекта не изменены`;
}

// An OS error as E_DISK with the OS code (action: "write" or "read"). A TeamError
// and an error that is not an OS error (a bug of the program) are returned
// unchanged, so that `throw fromOsError(err, ...)` rethrows them and a bug is shown
// as E_INTERNAL, not as a disk failure.
export function fromOsError(err, action) {
  if (err instanceof TeamError || !isOsError(err)) return err;
  const osCode = err.code;
  const message =
    action === "read"
      ? `Не удалось прочитать данные проекта (${osCode})`
      : diskWriteMessage(osCode);
  return new TeamError("E_DISK", message, { os_code: osCode });
}

// Control and bidirectional-control characters: C0, DEL, C1, U+061C, U+200E/U+200F,
// U+202A-U+202E, U+2066-U+2069.
function isUnsafe(code) {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x61c ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

function toEscape(ch) {
  return `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

// A text for a terminal: every unsafe character becomes \uXXXX.
export function escapeUnsafe(text) {
  let out = "";
  for (const ch of String(text)) {
    out += isUnsafe(ch.charCodeAt(0)) ? toEscape(ch) : ch;
  }
  return out;
}

// One line "<CODE>: <message>" for stderr; never a stack.
export function formatError(err) {
  if (err instanceof TeamError) {
    return `${err.code}: ${escapeUnsafe(String(err.message).replace(/[\r\n]+/g, " "))}`;
  }
  const name =
    err && typeof err.name === "string" && /^[A-Za-z]{1,40}$/.test(err.name)
      ? err.name
      : "Error";
  return `E_INTERNAL: Внутренняя ошибка ядра Sai Team (${name})`;
}

// Refusals used in several modules, with the texts of section 10.3.
export function eventError(field) {
  return new TeamError("E_EVENT", `Событие отклонено: ${field}`, { field });
}

export function transitionError(rule, what) {
  return new TeamError(
    "E_TRANSITION",
    `Действие недопустимо в текущем состоянии: ${rule} — ${what}`,
    { rule },
  );
}

export function notFoundError() {
  return new TeamError("E_NOT_FOUND", "Проект не найден");
}

// The codes of the executors (design REQ-010, section 10.2) with their messages.
// E_CONFIG, E_TASK_STATE and E_TASK_FAILED take a part of the message (the name
// of the variable, the status, the detail) from the caller.
export const EXECUTOR_MESSAGES = Object.freeze({
  E_CONFIG: "Неверная настройка",
  E_PLATFORM:
    "Настоящие запуски на этой системе запрещены: только Linux и macOS (Windows — только клиент)",
  E_REAL_RUNS_OFF:
    "Настоящие запуски выключены: нужна переменная SAI_TEAM_REAL_RUNS=1",
  E_NO_BUDGET:
    "У проекта нет потолка стоимости: настоящий запуск без потолка запрещён",
  E_BUDGET_EXHAUSTED: "Потолок расходов проекта исчерпан: запуск не начат",
  E_EXECUTOR: "Исполнитель задачи не совпадает с исполнителем проекта",
  E_SCENARIO: "Сценарий тестового исполнителя не найден или неверен",
  E_EXECUTOR_NOT_FOUND: "Исполнитель не найден: проверьте SAI_TEAM_CLAUDE_BIN",
  E_WORK_DIR: "Рабочая папка проекта недоступна",
  E_TASK_STATE: "Задачу сейчас нельзя запустить",
  E_PROJECT_STATE: "Проект на паузе или завершён",
  E_TASK_FAILED: "Задача не получилась",
  E_TASK_CANCELLED: "Задача прервана",
});

// A refusal of the executors; `part` is appended after ": " (E_CONFIG: after a
// space — "Неверная настройка <NAME>").
export function executorError(code, part = null, details = {}) {
  const base = EXECUTOR_MESSAGES[code];
  if (base === undefined) {
    return new TeamError(
      "E_INTERNAL",
      "Внутренняя ошибка ядра Sai Team (code)",
    );
  }
  let message = base;
  if (part !== null) {
    message = code === "E_CONFIG" ? `${base} ${part}` : `${base}: ${part}`;
  }
  return new TeamError(code, message, details);
}

// The codes of the engine (design REQ-013, section 15.3) with their messages. A
// placeholder {pid}, {id} or {task} is filled by engineError from its parameters
// (numbers and ids only, never a text of the user). E_CHANNEL_TIMEOUT has two
// forms: the engine did not take the message, or the engine has ended.
export const ENGINE_MESSAGES = Object.freeze({
  E_NOT_STARTABLE: "Проект уже запускался — продолжите его командой resume",
  // (r5.2, F-7) resume of a project that never started
  E_NOT_STARTED: "Проект ещё не запускался — запустите его командой start",
  E_ENGINE_RUNNING:
    "Проект сейчас ведёт запущенный процесс Sai Team (pid {pid}): эта команда доступна после его остановки",
  E_ALREADY_RUNNING: "Проект уже выполняется",
  E_STOPPED: "Проект остановлен — продолжить его нельзя",
  E_FINISHED: "Проект завершён — продолжить его нельзя",
  E_PAUSE_STATE:
    "Поставить на паузу можно только проект в работе или ждущий решения",
  E_OPEN_QUESTION:
    "Сначала ответьте на вопрос по задаче {task}: npm run team -- answer {id} {task} …",
  E_BUDGET_NEEDED:
    "Сначала поднимите потолок расходов: npm run team -- budget {id} <сумма>",
  E_BUDGET_LOW: "Новый потолок должен быть больше уже израсходованного",
  E_NOT_WAITING: "Задача не ждёт вашего решения",
  E_ANSWER_KIND:
    "Такой ответ здесь не подходит: можно change с текстом или reject",
  E_MSG_TOO_BIG: "Сообщение слишком большое",
  E_CHANNEL:
    "Связь с работающим проектом недоступна: папка сообщений повреждена или чужая",
  E_CHANNEL_BAD: "Сообщение не принято: повреждено или чужое",
  E_ENGINE_STOPPING: "Проект останавливается — сообщение не принято",
  E_CHANNEL_DROPPED:
    "Сообщение не выполнено: проект перезапускался. Повторите команду",
  E_CHANNEL_STALE: "Номер сообщения устарел",
  E_CHANNEL_FULL:
    "Проект не успевает принимать сообщения — повторите через несколько секунд",
  E_CHANNEL_TIMEOUT:
    "Сообщение не подтверждено: проект его не принял. Повторите команду",
  E_CHANNEL_TIMEOUT_GONE: "Проект завершил работу. Повторите команду",
  E_CHANNEL_UNCONFIRMED:
    "Сообщение передано, но подтверждение не пришло вовремя; проверьте журнал проекта: npm run team -- events {id}",
});

const ENGINE_PARAMS = Object.freeze({
  pid: /^[0-9]{1,10}$/,
  id: /^p-[0-9]{8}-[0-9a-f]{6}$/,
  task: /^t-[0-9]{4}$/,
});

// A refusal of the engine. `key` is a key of ENGINE_MESSAGES; the code of the
// error is the key without the suffix _GONE (E_CHANNEL_TIMEOUT_GONE is the second
// form of E_CHANNEL_TIMEOUT).
export function engineError(key, params = {}, details = {}) {
  const base = ENGINE_MESSAGES[key];
  if (base === undefined) {
    return new TeamError(
      "E_INTERNAL",
      "Внутренняя ошибка ядра Sai Team (code)",
    );
  }
  let bad = false;
  const message = base.replace(/\{(pid|id|task)\}/g, (_, name) => {
    const value = String(params[name] ?? "");
    if (!ENGINE_PARAMS[name].test(value)) bad = true;
    return value;
  });
  if (bad) {
    return new TeamError(
      "E_INTERNAL",
      "Внутренняя ошибка ядра Sai Team (params)",
    );
  }
  return new TeamError(key.replace(/_GONE$/, ""), message, details);
}
