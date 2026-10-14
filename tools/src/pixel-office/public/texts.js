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
// The name of the list of the rows of "Сейчас" for a screen reader.
export const NOW_LIST_LABEL = "Сейчас — работающие агенты";
// The second part of the line when nothing is in progress but the journal does
// not confirm some items (REQ-042, criterion 13).
export const NOW_UNCONFIRMED = " · без свежих данных: {n}";
export const UNCONFIRMED_LEAD =
  "Журнал не подтверждает, что эти задачи и строки основной сессии идут. Это не конец работы и не ошибка.";
export const UNCONFIRMED_STALE = "Нет свежих данных: {n}.";
export const UNCONFIRMED_STALE_AGE =
  "У самого старого последнее событие было {age}.";
export const UNCONFIRMED_RESTART =
  "Сервер перезапускался, события не записывались: {n}. Последний запуск сервера: {time}.";
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

// The roles of Sai in plain words, by the code in the brackets of the name of
// the role ("Sai Security Reviewer (SECURITY-REVIEWER)"): one entry for every
// file of .claude/agents/ (REQ-036, criterion 1). A role in another form is
// shown as it came (decision 0055, item 1).
export const ROLE_NAMES = Object.freeze({
  "ARCHITECTURE-AUDITOR": "Аудит архитектуры",
  "AUDIT-COMPILER": "Сводка аудита",
  "AUDIT-PLANNER": "План аудита",
  "AUDIT-SCOUT": "Выбор объёма аудита",
  "AUDIT-TRIAGE": "Дефекты по итогам аудита",
  "BA-ANALYST": "Сценарии приёмки",
  "BACKEND-DEV": "Серверная часть",
  "CODE-DESIGN-VALIDATOR": "Проверка проекта кода",
  "CODE-DESIGNER": "Проект кода",
  "CODE-FIXER": "Исправление кода",
  "COVERAGE-AUDITOR": "Аудит покрытия тестами",
  "DEPENDENCY-AUDITOR": "Аудит сторонних пакетов",
  "DESIGN-QA-VALIDATOR": "Сверка экрана с образцом",
  "DOC-AUDITOR": "Аудит документации",
  "DOC-UPDATER": "Учёт и документы",
  "FRONTEND-DEV": "Страницы и интерфейс",
  "GUI-DESIGN-ANALYST": "Описание интерфейса",
  "IDEA-ANALYST": "Оценка идей",
  "IDEA-JUDGE": "Итоговый выбор идеи",
  "ISSUE-FIXER": "Поиск причины дефекта",
  "MARKET-RESEARCHER": "Исследование рынка",
  ORCH: "Оркестратор",
  "PLAN-VALIDATOR": "Проверка исследования и плана",
  "PLAN-WRITER": "Бизнес-план",
  "RELEASE-FINALIZER": "Коммит и отчёт о выпуске",
  "RELEASE-VALIDATOR": "Приёмка перед выпуском",
  "REQ-ANALYST": "Запись требований",
  "REQ-VALIDATOR": "Проверка требований",
  REVIEWER: "Ревью кода",
  "SECURITY-AUDITOR": "Аудит безопасности",
  "SECURITY-REVIEWER": "Проверка безопасности",
  "TEST-DESIGN-VALIDATOR": "Проверка тестов",
  "TEST-DESIGNER": "Написание тестов",
  "TEST-FIXER": "Исправление тестов",
  "TEST-RUNNER": "Запуск проверки",
  "UAT-RUNNER": "Приёмка на живой системе",
  "VERDICT-EXECUTOR": "Исполнение вердикта",
});

export const STATE_LABELS = Object.freeze({
  in_progress: "в работе",
  stale: "нет свежих данных",
  restarted: "сервер перезапускался, события не записывались",
  completed: "закончила работу, итог не записан",
  unrecorded: "окончание не записано",
});

// The words of the journal (REQ-045, criterion 1): one table of 12 cases. For
// each: the words of the row, what it means and what it does not prove. {role}
// is the name of the role of the line itself (roleName); in the cases 7-9 the
// words are "Агент «{role}» " and act, the short words of the card of an agent.
// Case 12 (a line marked "not from hooks") keeps the words of its own kind and
// gives only its meaning, what it does not prove and the reasons of the mark.
export const EVENT_TABLE = Object.freeze({
  session_start: Object.freeze({
    words: "Сессия Claude Code открыта",
    meaning:
      "В Claude Code началась сессия или продолжена прежняя: при продолжении номер сессии тот же. Что именно произошло, хук сейчас не передаёт.",
    not_proved: "Не доказывает, что началась работа или пришёл запрос.",
  }),
  session_end: Object.freeze({
    words: "Сессия Claude Code закрыта",
    meaning:
      "Сессия закончилась: окно закрыли, сессию очистили или переключили. Причину хук сейчас не передаёт.",
    not_proved:
      "Не доказывает, что работа доведена до конца: агенты этой сессии могли не закончить.",
  }),
  prompt_owner: Object.freeze({
    words: "Владелец отправил запрос",
    meaning:
      "Человек отправил сообщение в основную сессию; с него начинается строка «Основная сессия — обрабатывает запрос». Текст — в окне «Просмотр истории», если хранение текста включено.",
    not_proved: "Не доказывает, что запрос понят или сделан.",
  }),
  prompt_service: Object.freeze({
    words: "В сессию пришло служебное сообщение",
    meaning:
      "Сообщение от системы, а не от человека: напоминание, уведомление о фоновой задаче, сообщение другой сессии Claude Code или пометка о продолжении прежнего разговора. Его текст не хранится.",
    not_proved: "Не доказывает, что его написал человек.",
  }),
  prompt_unknown: Object.freeze({
    words: "В сессию пришло сообщение",
    meaning:
      "Сообщение в основную сессию. Кто его написал — человек или система, — в этой строке не записано.",
    not_proved: "Не доказывает, что его написал человек.",
  }),
  stop: Object.freeze({
    words: "Основная сессия вернула ответ",
    meaning:
      "Основная сессия закончила очередной ответ и ждёт следующего сообщения.",
    not_proved:
      "Не доказывает, что вся работа закончена или удалась: агенты в фоне могут ещё работать, и сессия может продолжить сама, когда они вернутся. При прерывании человеком и при ошибке этого события нет.",
  }),
  agent_start: Object.freeze({
    words: "Агент «{role}» получил задание и начал работу",
    act: "получил задание и начал работу",
    meaning:
      "Claude Code запустил агента этой роли; его номер — в технических полях.",
    not_proved:
      "Не доказывает, какое задание и кто его дал: это видно только по связанной записи «Задание передано агенту».",
  }),
  agent_resume: Object.freeze({
    words: "Агент «{role}» продолжил работу",
    act: "продолжил работу",
    meaning:
      "Тот же агент, с тем же номером, снова начал работу над той же задачей.",
    not_proved:
      "Не доказывает, что прежняя работа удалась или что задание новое.",
  }),
  agent_stop: Object.freeze({
    words: "Агент «{role}» закончил работу и вернул ответ",
    act: "закончил работу и вернул ответ",
    meaning:
      "Агент закончил свой ход и вернул ответ тому, кто его запустил. Текст ответа Pixel Office не хранит: итог не записан. Такое событие приходит и от внутренних агентов Claude Code — у них начала в журнале нет, а роль совпадает с ролью сессии или пуста.",
    not_proved:
      "Не доказывает, что задание сделано, что проверки прошли и что ответ верен. Агента могут продолжить.",
  }),
  handoff: Object.freeze({
    words: "Задание передано агенту «{role}»",
    meaning:
      "Тот, кто передал задание (основная сессия или другой агент), запустил агента, и Claude Code вернул номер запущенного агента. Описание — то, что написал передавший (до 100 знаков). У фоновых агентов эта запись приходит сразу при запуске, у остальных — после окончания их работы.",
    not_proved:
      "Не доказывает, что агент закончил работу или что задание сделано. Время записи — не время начала работы агента.",
  }),
  orch_note: Object.freeze({
    words: "Оркестратор записал, как понял запрос",
    meaning:
      "Запись оркестратора, сделанная командой pixel-office-note; это не событие хука. К запросу она привязана по времени запроса, если оно записано.",
    not_proved:
      "Не доказывает, что работа идёт или сделана так, как записано: это слова оркестратора.",
  }),
  marked: Object.freeze({
    meaning:
      "Строка есть в журнале, но правило чтения не признало её событием хука.",
    not_proved:
      "Не доказывает, что событие было; на задачи, офис и состояния строка не влияет.",
    reasons: Object.freeze({
      source: "источник строки — не хук Claude Code: {source}",
      conflict:
        "время строки расходится с порядком строк в журнале больше чем на 2 минуты",
      future:
        "время последней строки позже часов этого компьютера больше чем на минуту",
    }),
  }),
});

// The row of the journal and its details (REQ-045, criteria 2-4).
export const TIME_UNKNOWN = "время не записано";
export const SESSION_UNKNOWN = "сессия не указана";
export const DETAIL_LABELS = Object.freeze({
  when: "Когда",
  source: "Источник",
  session: "Сессия",
  agent: "Агент",
  task: "Задача",
  note_text: "Текст записи",
  req: "Требование",
  request_time: "Время запроса",
  what: "Что произошло",
  not_proved: "Чего это не доказывает",
  mark: "Пометка",
  tech: "Технические поля",
});
export const SOURCE_WORDS = Object.freeze({
  REAL: "хук Claude Code",
  ORCH: "запись оркестратора",
  other: "другой источник: {source}",
});
export const SESSION_FULL = "полностью";
export const AGENT_MAIN = "основная сессия: у этого события агента нет";
export const AGENT_ORCH = "оркестратор";
export const TASK_NOW = "сейчас";
export const TASK_NOT_RELATED = "к задаче не относится";
export const TASK_NOT_FOUND = "задача не найдена: её начало не записано";
export const TASK_MAIN_NOT_FOUND =
  "строка основной сессии не найдена: запрос этой сессии не записан";
export const MARK_PREFIX = "не из хуков: ";
export const DETAILS_CLOSE = "Закрыть";
export const SECTION_CURRENT = "Текущие";
export const SECTION_HISTORY = "История";
export const SECTION_STARTS = "Запуски сервера";
export const SHOWN_NOTE = "показано {n} из {N}";
export const SESSION_WORD = "Сессия";
export const SESSION_RUNNING = "• Идёт";
export const SESSION_STALE = STATE_LABELS.stale;

// Small captions next to the times of an item of the task list.
export const LABEL_STARTED = "начало";
export const LABEL_FIRST_EVENT = "первое событие";
export const LABEL_LAST_EVENT = "последнее событие сессии";
export const LABEL_ENDED = "конец";

// The age of the last event: {n}, {h}, {m} and {d} are whole numbers.
export const AGE_LESS_THAN_MINUTE = "меньше минуты назад";
export const AGE_MINUTES = "{n} мин назад";
export const AGE_HOURS_MINUTES = "{h} ч {m} мин назад";
export const AGE_HOURS = "{h} ч назад";
export const AGE_DAYS_HOURS = "{d} сут {h} ч назад";
export const AGE_DAYS = "{d} сут назад";

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

export const CARD_SESSIONS = "идущих сессий: ";

export const CARD_HEADINGS = Object.freeze({
  in_progress: "Сейчас в работе",
  unconfirmed: "Нет подтверждения работы",
  recent_completed: "Недавно закончили работу",
  unrecorded: "Окончание не записано",
  recent_events: "Последние события",
});

export const CARD_EMPTY = "Нет данных";
export const CARD_CLOSE = "Закрыть карточку";

// The card of one instance of an agent (REQ-044). {n}, {N}, {m} are numbers,
// {time} a date and time.
export const CARD_INSTANCE = "экземпляр";
export const CARD_SESSION = "сессия";
export const CARD_BLOCKS = Object.freeze({
  ids: "Полные идентификаторы",
  task: "Текущая задача",
  state: "Состояние",
  launcher: "Кто запустил",
  instances: "Экземпляры этой роли",
  more: "Остальные экземпляры",
  given: "Задание передано",
  starts: "Начала работы",
  returns: "Возвраты",
  launched: "Кого запустил",
  role: "Вся роль",
});
export const STATE_ROWS = Object.freeze({
  task: "Задача",
  agent: "Агент",
  workplace: "Рабочее место",
});
export const TASK_DESC_BY = "описание написал передавший задание";
export const TASK_NO_LINK =
  "описание не записано: записи о передаче задания нет";
export const TASK_NO_DESC = "описание не записано";
export const TASK_SEVERAL =
  "не установлено: записей о передаче задания несколько";
export const LAUNCHER_NO_LINK = "не установлено: записи о передаче задания нет";
export const LAUNCHER_NOT_RECORDED = "начало этого агента не записано";
export const FRESH_LIMIT = "порог свежести — {m} минут";
export const SERVER_STARTED =
  "сервер запущен {time} — после последнего начала этого агента";
export const AGENT_NOT_RECORDED =
  "другие действия агента — чтение файлов, команды, правки — хук не записывает";
export const WORKPLACE_WORKING = "работает — у этой роли задач «в работе»: {n}";
export const WORKPLACE_IDLE =
  "свободен — по журналу у этой роли нет задачи «в работе»; это вывод по событиям, а не событие";
export const WORKPLACE_DESK =
  "Стол на холсте — изображение роли, общее для всех её экземпляров, а не компьютер. О компьютере и операционной системе Pixel Office ничего не знает.";
export const UNKNOWN_MESSAGES =
  "Сообщения между агентами хук не записывает: записаны только передачи задания и окончания работы";
export const UNKNOWN_ERRORS =
  "Ошибки и ожидание человека хук сейчас не сообщает";
export const INSTANCES_COUNT = "экземпляров роли: {N}";
export const LAST_START = "последнее начало";
export const GIVEN_BY = "передал: ";
export const GIVEN_NOTE =
  "Эту запись пишет тот, кто передал задание. У агентов переднего плана она приходит после окончания их работы, у фоновых — сразу при запуске; это не действие самого агента";
export const RETURN_NOTE = ", итог не записан";
export const COPY = "Скопировать";
export const COPY_OK = "скопировано";
export const COPY_FAIL = "не удалось скопировать — выделите значение вручную";
export const COPY_LABEL_AGENT = "Скопировать номер экземпляра";
export const COPY_LABEL_SESSION = "Скопировать номер сессии";

// ----------------------------------------------------------------- canvas

// The only phrases of the bubbles: each is tied to one kind of event.
export const BUBBLE_TEXTS = Object.freeze({
  got_task: "Только что получил задачу",
  done: "Закончил работу",
  got_request: "Получил запрос",
  answer_ready: "Вернул ответ",
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
