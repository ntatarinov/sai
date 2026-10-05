// Every Russian caption of the page and of the canvas in one place (design
// 4.7). The tests compare the page with these constants, so the values are
// part of the contract. Pure ES module: constants only, no imports.
//
// {n}, {N}, {m}, {k} and {tz} are replaced by numbers and the name of the
// time zone where the caption is used.

// ------------------------------------------------------------------ header

export const HEADER_BADGE = "REAL — события хуков Claude Code";
export const LIVE = "LIVE";
export const NO_CONNECTION = "Нет связи с сервером Pixel Office";
export const NOW_PREFIX = "Сейчас: ";
export const NOW_EMPTY = "в работе ничего нет";
export const NOW_MORE = " · и ещё {n} в работе";
export const PAUSE = "Пауза";
export const RESUME = "Продолжить";

export const SPEED_LABELS = Object.freeze({
  1: "1×",
  2: "2×",
  4: "4×",
});

// ----------------------------------------------------------------- panels

export const OFFICE_NAME = "Офис";
export const JOURNAL_TITLE = "Журнал";

export const FILTER_LABELS = Object.freeze({
  all: "Всё",
  work: "Работа",
  office: "Офис",
});

export const JOURNAL_ZONE = "время — {tz}";
export const JOURNAL_COUNT = " · {n} из {N}";
export const TASKS_TITLE = "Задачи";
export const EMPTY_JOURNAL = "Событий от хуков пока нет";
export const EMPTY_HINT =
  "Видны только сессии Claude Code, в настройках которых есть обработчики Pixel Office: запущенные в папке sai/, а сессии другой папки — только если в её настройках проекта есть копия обработчиков.";
export const NO_DATA = "Нет данных";
export const MAIN_ROW = "Основная сессия — обрабатывает запрос";
export const MAIN_LABEL = "Основная сессия";
export const NOT_FROM_HOOKS = "не из хуков";
export const ROLE_UNKNOWN = "(роль не указана)";

export const STATE_LABELS = Object.freeze({
  in_progress: "в работе",
  completed: "завершена",
  unrecorded: "окончание не записано",
});

export const EVENT_LABELS = Object.freeze({
  SessionStart: "сессия началась",
  SessionEnd: "сессия закончилась",
  UserPromptSubmit: "запрос отправлен",
  Stop: "ответ закончен",
  SubagentStart: "субагент запущен",
  SubagentStop: "субагент закончил",
  PostToolUse: "вызов субагента",
});

export const SECTION_CURRENT = "Текущие";
export const SECTION_HISTORY = "История";
export const SECTION_STARTS = "Запуски сервера";
export const SHOWN_NOTE = "показано {n} из {N}";
export const SESSION_WORD = "Сессия";
export const SESSION_RUNNING = "• Идёт";
export const SESSION_STATS = "задач {n}/{m} · ролей {k}";

// Small captions next to the times of an item of the task list.
export const LABEL_STARTED = "начало";
export const LABEL_LAST_EVENT = "последнее событие сессии";
export const LABEL_ENDED = "конец";

// ------------------------------------------------------ office and legend

export const LEGEND_WORKING = "работает";
export const LEGEND_IDLE = "свободен";
export const LEGEND_IDLE_MAIN = "свободна";
// The name of the area that scrolls the canvas when it does not fit.
export const OFFICE_SCROLL_LABEL = "Офис — прокрутка";
export const CANVAS_UNSUPPORTED = "Холст не поддерживается: офис не показан";
// The text of the noscript element of the markup; the page never sets it.
export const NOSCRIPT = "Для страницы нужен JavaScript.";

// ------------------------------------------------------------------- card

export const CARD_WORKING = "в работе: ";
export const CARD_SESSIONS = "идущих сессий: ";

export const CARD_HEADINGS = Object.freeze({
  in_progress: "Сейчас в работе",
  recent_completed: "Недавно завершены",
  recent_events: "Последние события",
});

export const CARD_EMPTY = "Нет данных";
export const CARD_CLOSE = "Закрыть карточку";

// ----------------------------------------------------------------- canvas

// The only phrases of the bubbles: each is tied to one kind of event.
export const BUBBLE_TEXTS = Object.freeze({
  got_task: "Только что получил задачу",
  done: "Готово",
  got_request: "Получил запрос",
  answer_ready: "Ответ готов",
});

export const ROOM_LABELS = Object.freeze({
  meeting: "ПЕРЕГОВОРНАЯ",
  server: "СЕРВЕРНАЯ",
  kitchen: "КУХНЯ",
});

// ------------------------------------------------- the window of history

// The window "Просмотр истории" of one request of the owner (REQ-008,
// description of the window section 7). {time} is a date and time, {n} a
// number; the separator " · " and the time of a record of the orchestrator
// are added by the code.
export const HISTORY_BADGE = "Просмотр истории";
export const HISTORY_CLOSE = "Закрыть";
export const HISTORY_OPEN = "открыть историю запроса";
export const HISTORY_SERVICE = "служебное сообщение";
export const HISTORY_TITLE_NO_TEXT = "Запрос владельца · {time}";
export const HISTORY_SECTION_REQUEST = "Исходный запрос";
export const HISTORY_SECTION_UNDERSTOOD = "Как оркестратор понял";
export const HISTORY_SECTION_WORK = "Кто работал и что сделал";
export const HISTORY_SECTION_TIMELINE = "Хронология";
export const HISTORY_TRUNCATED = "обрезано: показаны первые {n} знаков";
export const HISTORY_TEXT_DISABLED = "текст не сохраняется";
export const HISTORY_NOTE_BY = "Оркестратор записал";
export const HISTORY_NOTE_AUTO = "привязано автоматически";
export const HISTORY_NOTE_MISSING = "оркестратор не записал, как понял";
export const HISTORY_COL_TASK = "Задача";
export const HISTORY_COL_AGENT = "Агент";
export const HISTORY_COL_DOES = "Что делал";
export const HISTORY_COL_RESULT = "Итог";
export const HISTORY_TASK_N = "Задача {n}";
export const HISTORY_EMPTY_CELL = "—";
export const HISTORY_NO_TASKS = "в этом запросе задач не было";
export const HISTORY_WHO_ORCH = "Оркестратор";
export const HISTORY_LOADING = "Загрузка…";
export const HISTORY_ERROR = "Не удалось показать историю запроса";
export const HISTORY_META_STARTED = "начат";
export const HISTORY_META_FINISHED = "завершён";
