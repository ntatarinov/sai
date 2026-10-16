// Every Russian caption of the page and of the canvas in one place (design
// 4.7). The tests compare the page with these constants, so the values are
// part of the contract. Pure ES module: constants only, no imports.
//
// {n}, {N}, {m}, {k} and {tz} are replaced by numbers and the name of the
// time zone where the caption is used.

// ------------------------------------------------------------------ header

export const HEADER_BADGE = "Источник событий — Claude Code";
export const LIVE = "на связи";
export const NO_CONNECTION = "Нет связи с сервером Pixel Office";
export const NOW_PREFIX = "Сейчас: ";
export const NOW_EMPTY = "в работе ничего нет";
// The name of the list of the rows of "Сейчас" for a screen reader.
export const NOW_LIST_LABEL = "Сейчас — работающие агенты";
// The number of the items in progress and the button that shows all of them
// over the page (REQ-049, criterion 1).
export const NOW_COUNT = "в работе: {n}";
export const NOW_SHOW_ALL = "Показать всех ({n})";
export const NOW_HIDE = "Скрыть";
export const NOW_ALL_LABEL = "Сейчас — все работающие агенты";
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

// The navigation of the journal (REQ-046): search, filters, the mark of the
// filter "Задача", "Показать более ранние", the empty result.
export const SEARCH_LABEL = "Поиск в журнале";
export const FILTERS_BUTTON = "Фильтры";
export const FILTERS_CHOSEN = "Фильтры: выбраны";
export const FILTER_SESSION_LABEL = "Сессия";
export const FILTER_AGENT_LABEL = "Агент";
export const FILTER_TYPE_LABEL = "Тип события";
export const FILTER_ALL = Object.freeze({
  session: "все сессии",
  agent: "все агенты",
  type: "все типы",
});
export const FILTER_SESSION_OPTION = "Сессия {id} · с {time}";
// The variants of "Тип события": the cases 1-11 of EVENT_TABLE, the cases
// 7-10 without the role.
export const TYPE_OPTIONS = Object.freeze({
  session_start: "Открыт разговор с Claude Code",
  session_end: "Закрыт разговор с Claude Code",
  prompt_owner: "Владелец отправил запрос",
  prompt_service: "В сессию пришло служебное сообщение",
  prompt_unknown: "В сессию пришло сообщение",
  stop: "Основная сессия вернула ответ",
  agent_start: "Агент получил задание и начал работу",
  agent_resume: "Агент продолжил работу",
  agent_stop: "Агент закончил работу и вернул ответ",
  handoff: "Задание передано агенту",
  orch_note: "Оркестратор записал, как понял запрос",
});
export const TASK_MARK = "Задача: {role} {id}";
export const TASK_MARK_MAIN = "Задача: Основная сессия";
export const TASK_MARK_CLEAR = "Снять фильтр «Задача»";
export const FILTERS_EMPTY =
  "Под выбранные фильтры не подходит ни одно событие";
export const FILTERS_RESET = "Сбросить фильтры";
export const SHOW_EARLIER = "Показать более ранние";
// The transitions from an event, a card and an item of the panel (REQ-046,
// criterion 3; REQ-047, criteria 2, 3).
export const GO_PANEL = "к задаче в панели";
export const GO_TASK_EVENTS = "события этой задачи";
export const GO_CARD_EVENTS = "события в журнале";
export const GO_AGENT = "открыть агента";
export const GO_FROM = "кто передал";
export const GO_TO = "кому";
export const GO_ITEM_AGENT = "агент";
export const NOT_IN_PANEL =
  "задача не показана в панели: там последние {n} элементов";
export const NO_WINDOW =
  "запрос не определён: событие вне окна запроса владельца";
export const AGENT_NOT_FOUND =
  "агент не найден среди задач: его начало не записано";
export const TASKS_TITLE = "Задачи";
export const EMPTY_JOURNAL = "Событий от Claude Code пока нет";
export const EMPTY_HINT =
  "Видны только разговоры с Claude Code, запущенные в папке sai/: там Claude Code настроен присылать события Pixel Office. Разговоры из другой папки видны, только если в её настройках есть такая же настройка.";
export const NO_DATA = "Нет данных";
export const MAIN_ROW = "Основная сессия — обрабатывает запрос";
export const MAIN_LABEL = "Основная сессия";
export const NOT_FROM_HOOKS = "не подтверждена";
export const ROLE_UNKNOWN = "(роль не указана)";
// The code of a role in the tooltip of its name, when the code differs from
// the name (REQ-048, criterion 1).
export const ROLE_CODE_TITLE = "код роли: {code}";

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
    words: "Открыт разговор с Claude Code",
    meaning:
      "В Claude Code начат новый разговор (сессия) или продолжен прежний: при продолжении номер сессии тот же. Что именно произошло, Claude Code сейчас не сообщает.",
    not_proved: "Не доказывает, что началась работа или пришёл запрос.",
  }),
  session_end: Object.freeze({
    words: "Закрыт разговор с Claude Code",
    meaning:
      "Разговор (сессия) закончился: окно закрыли, разговор очистили или переключили. Причину Claude Code сейчас не сообщает.",
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
      "Сообщение от системы, а не от человека: напоминание, уведомление о задаче, которая шла параллельно, сообщение из другого разговора с Claude Code или пометка о продолжении прежнего разговора. Его текст не хранится.",
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
      "Не доказывает, что вся работа закончена или удалась: агенты, запущенные параллельно, могут ещё работать, и сессия может продолжить сама, когда они вернутся. При прерывании человеком и при ошибке этого события нет.",
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
      "Агент закончил свой ход и вернул ответ тому, кто его запустил. Текст ответа Pixel Office не хранит: итог не записан. Такое событие присылают и служебные помощники самого Claude Code — их начала в журнале нет, а роль совпадает с ролью разговора или пуста.",
    not_proved:
      "Не доказывает, что задание сделано, что проверки прошли и что ответ верен. Агента могут продолжить.",
  }),
  handoff: Object.freeze({
    words: "Задание передано агенту «{role}»",
    meaning:
      "Тот, кто передал задание (основная сессия или другой агент), запустил агента, и Claude Code вернул номер запущенного агента. Описание — то, что написал передавший (до 100 знаков). Если агент работает параллельно с тем, кто его запустил, эта запись приходит сразу при запуске; если запустивший ждёт его ответа — после окончания работы агента.",
    not_proved:
      "Не доказывает, что агент закончил работу или что задание сделано. Время записи — не время начала работы агента.",
  }),
  orch_note: Object.freeze({
    words: "Оркестратор записал, как понял запрос",
    meaning:
      "Запись, которую оркестратор сделал сам; это не событие от Claude Code. К запросу она привязана по времени запроса, если оно записано.",
    not_proved:
      "Не доказывает, что работа идёт или сделана так, как записано: это слова оркестратора.",
  }),
  marked: Object.freeze({
    meaning:
      "Строка есть в журнале, но Pixel Office не признал её настоящим событием от Claude Code.",
    not_proved:
      "Не доказывает, что событие было; на задачи, офис и состояния строка не влияет.",
    reasons: Object.freeze({
      source: "строку записал не Claude Code",
      conflict:
        "время строки расходится с порядком строк в журнале больше чем на 2 минуты",
      future:
        "время последней строки позже часов этого компьютера больше чем на минуту",
    }),
  }),
});

// The row of the journal and its details (REQ-045, criteria 2-4).
// The word at the right of a row of the journal: closed and open details
// (REQ-049, criterion 2).
export const ROW_MORE = "подробнее";
export const ROW_LESS = "свернуть";
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
  REAL: "Claude Code",
  ORCH: "запись оркестратора",
  other: "не Claude Code",
});
export const SESSION_FULL = "полностью";
export const AGENT_MAIN = "основная сессия: у этого события агента нет";
export const AGENT_ORCH = "оркестратор";
export const TASK_NOW = "сейчас";
export const TASK_NOT_RELATED = "к задаче не относится";
export const TASK_NOT_FOUND = "задача не найдена: её начало не записано";
export const TASK_MAIN_NOT_FOUND =
  "строка основной сессии не найдена: запрос этой сессии не записан";
export const MARK_PREFIX = "не подтверждена: ";
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

export const CARD_SESSIONS = "разговоров идёт: ";

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
export const CARD_INSTANCE = "запуск";
export const CARD_SESSION = "сессия";
export const CARD_BLOCKS = Object.freeze({
  ids: "Полные номера и код роли",
  task: "Текущая задача",
  state: "Состояние",
  launcher: "Кто запустил",
  instances: "Все запуски этой роли",
  more: "Остальные запуски",
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
export const FRESH_LIMIT =
  "если событий нет дольше {m} минут, пишется «нет свежих данных»";
export const SERVER_STARTED =
  "сервер запущен {time} — после последнего начала этого агента";
export const AGENT_NOT_RECORDED =
  "о других действиях агента — чтении файлов, командах, правках — Claude Code не сообщает";
export const WORKPLACE_WORKING = "работает — у этой роли задач «в работе»: {n}";
export const WORKPLACE_IDLE =
  "свободен — по журналу у этой роли нет задачи «в работе»; это вывод по событиям, а не событие";
export const WORKPLACE_DESK =
  "Стол на холсте — изображение роли, общее для всех её запусков, а не компьютер. О компьютере и операционной системе Pixel Office ничего не знает.";
export const UNKNOWN_MESSAGES =
  "О сообщениях между агентами Claude Code не сообщает: известны только передачи задания и окончания работы";
export const UNKNOWN_ERRORS =
  "Об ошибках и о том, что агент ждёт человека, Claude Code сейчас не сообщает";
export const INSTANCES_COUNT = "запусков этой роли: {N}";
export const LAST_START = "последнее начало";
export const GIVEN_BY = "передал: ";
export const GIVEN_NOTE =
  "Эту запись пишет тот, кто передал задание. Если он ждёт ответа агента, запись приходит после окончания работы агента; если агент работает параллельно — сразу при запуске. Это не действие самого агента";
export const RETURN_NOTE = ", итог не записан";
export const COPY = "Скопировать";
export const COPY_OK = "скопировано";
export const COPY_FAIL = "не удалось скопировать — выделите значение вручную";
export const COPY_LABEL_AGENT = "Скопировать номер запуска";
export const COPY_LABEL_SESSION = "Скопировать номер сессии";

// The card of the main session (REQ-047, criterion 1): {time} is a date and
// time, {n} a number.
export const MAIN_CARD = Object.freeze({
  full_session: "Полный номер сессии",
  has_window:
    "историю запроса открывает её строка в панели «Задачи» или в журнале",
  no_window: "у этой строки нет окна запроса владельца",
  no_requests: "запросов в этой сессии не записано",
  launched: "кого запустила в этом запросе",
  other_rows: "Другие запросы этой сессии",
  other_sessions: "Другие сессии",
  all: "Вся основная сессия",
  server_started: "сервер запущен {time} — после начала этого запроса",
  workplace_working: "работает — у основной сессии строк «в работе»: {n}",
  workplace_idle:
    "свободна — по журналу у основной сессии нет строки «в работе»; это вывод по событиям, а не событие",
  desk: "Стол на холсте — изображение основной сессии, а не компьютер. О компьютере и операционной системе Pixel Office ничего не знает.",
});

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
export const HISTORY_NOTE_AUTO =
  "оркестратор не указал запрос — запись отнесена к последнему запросу владельца";
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
