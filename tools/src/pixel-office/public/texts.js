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
export const FILTER_SESSION_OPTION = "Сессия номер {id} · с {time}";
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
export const TASK_MARK = "Задача: {role} номер {id}";
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
      "Агент может поручить часть работы другой роли. Эта строка — такое поручение: основная сессия или агент запустили агента этой роли. Описание написал тот, кто поручил (до 100 знаков). Если запустивший ждёт ответа, строка приходит после конца работы агента; если нет — сразу при запуске.",
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
export const CARD_INSTANCE = "номер запуска";
export const CARD_SESSION = "номер разговора";
// The description of a role under the title of its card (REQ-051, criterion
// 8): the description of the guide by its code, or this text.
export const ROLE_ABOUT_UNKNOWN =
  "Описания этой роли нет: так её назвал Claude Code.";
export const MAIN_ABOUT =
  "Ваш разговор с Claude Code. Он принимает ваши сообщения и запускает агентов.";
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
  "если событий нет дольше {m} минут, страница пишет «нет свежих данных»: работа могла идти, но подтверждений нет";
export const SERVER_STARTED =
  "сервер запущен {time} — после последнего начала этого агента";
export const AGENT_NOT_RECORDED =
  "Что агент делает внутри — читает файлы, запускает команды, вносит правки, — Claude Code не сообщает.";
export const WORKPLACE_WORKING = "работает — у этой роли задач «в работе»: {n}";
export const WORKPLACE_IDLE =
  "свободен — по журналу у этой роли нет задачи «в работе»; это вывод по событиям, а не событие";
export const WORKPLACE_DESK =
  "Стол в офисе — просто место роли на рисунке. Настоящих компьютеров страница не показывает.";
export const UNKNOWN_MESSAGES =
  "О сообщениях между агентами Claude Code не сообщает: известны только передачи задания и окончания работы";
export const UNKNOWN_ERRORS =
  "Об ошибках и о том, что агент ждёт человека, Claude Code сейчас не сообщает";
export const INSTANCES_COUNT = "запусков этой роли: {N}";
export const LAST_START = "последнее начало";
export const GIVEN_BY = "передал: ";
// The note of "Задание передано" in the card is the meaning of the row of the
// journal: one text, so the two never differ (design REQ-050-053 D19).
export const GIVEN_NOTE = EVENT_TABLE.handoff.meaning;
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
  desk: "Стол в офисе — просто место основной сессии на рисунке. Настоящих компьютеров страница не показывает.",
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

// ------------------------------------------------- the guide (REQ-050)

// The guide "Как пользоваться" (REQ-050, table T1): the button in the header,
// the panel next to the page and its sections. A block of a section is a
// paragraph {kind: "p", text} or a list {kind: "ul" | "ol", items}.
export const GUIDE_OPEN = "Как пользоваться";
export const GUIDE_MARK = "?";
export const GUIDE_TITLE = "Как пользоваться Pixel Office";
export const GUIDE_CLOSE_TEXT = "Закрыть";
export const GUIDE_CLOSE = "Закрыть справку";
export const GUIDE_LEAD =
  "Коротко: что видно на странице и как её читать. Нажмите на название раздела, чтобы перейти к нему.";
export const GUIDE_TOC = "Разделы";
export const GUIDE_SECTIONS = Object.freeze([
  Object.freeze({
    key: "page",
    title: "Что это за страница",
    blocks: Object.freeze([
      Object.freeze({
        kind: "p",
        text: "Pixel Office показывает, что делает команда ИИ-агентов Sai. Здесь видно, кто сейчас работает, над какой задачей и что уже произошло.",
      }),
      Object.freeze({
        kind: "p",
        text: "Страница только показывает. Она ничего не запускает, не останавливает и не меняет. Цель команде вы пишете в разговоре с Claude Code, открытом в папке sai/.",
      }),
      Object.freeze({
        kind: "p",
        text: "Всё на странице строится из событий, которые присылает Claude Code. Страница не придумывает событий. Сомнительная строка помечена словами «не подтверждена» и ни на что не влияет.",
      }),
      Object.freeze({
        kind: "p",
        text: "Новое событие появляется в течение 5 секунд, обновлять страницу не нужно. Видны только разговоры, открытые в папке sai/. Страница открывается только на этом компьютере.",
      }),
    ]),
  }),
  Object.freeze({
    key: "office",
    title: "Офис",
    blocks: Object.freeze([
      Object.freeze({
        kind: "p",
        text: "Офис — комнаты со столами и персонажами. У каждой роли, которой дали задачу, есть свой стол и персонаж. Стол «Основная сессия» — это ваш разговор с Claude Code.",
      }),
      Object.freeze({
        kind: "p",
        text: "Цвет — это роль, а не состояние. Стол и персонаж одной роли — одного цвета. Экран ноутбука светится, пока у роли есть задача «в работе».",
      }),
      Object.freeze({
        kind: "p",
        text: "Персонаж идёт к чужому столу в двух случаях. Первый: он передаёт задание другому агенту. Второй: агент закончил работу и несёт ответ тому, кто его запустил.",
      }),
      Object.freeze({
        kind: "p",
        text: "О других встречах агентов Claude Code не сообщает, поэтому в офисе их нет.",
      }),
      Object.freeze({
        kind: "p",
        text: "Облачко над персонажем называет последнее событие, например «Только что получил задачу» или «Вернул ответ».",
      }),
      Object.freeze({
        kind: "p",
        text: "На доске в переговорной — до трёх ролей с задачами в открытых сейчас разговорах. Остальные роли собраны в метку +N.",
      }),
      Object.freeze({
        kind: "p",
        text: "У каждой роли на доске четыре числа задач: жёлтое — «в работе», зелёное — «закончила работу, итог не записан». Красное — «окончание не записано», серое — «сервер перезапускался, события не записывались». Кухня и серверная — только обстановка.",
      }),
      Object.freeze({
        kind: "p",
        text: "Под офисом — легенда: кнопка на каждую роль со словом «работает» или «свободен». У основной сессии — «свободна». Нажмите на кнопку легенды, персонажа, стол или подпись — откроется карточка роли.",
      }),
      Object.freeze({
        kind: "p",
        text: "Кнопки «Пауза», «1×», «2×» и «4×» в шапке управляют только ходьбой персонажей. Журнал и «Задачи» при паузе обновляются как обычно.",
      }),
    ]),
  }),
  Object.freeze({
    key: "now",
    title: "Сейчас",
    blocks: Object.freeze([
      Object.freeze({
        kind: "p",
        text: "Блок «Сейчас» в шапке — строка на каждого, кто сейчас «в работе»: название роли и задача. Строка «Основная сессия — обрабатывает запрос» значит: разговор с Claude Code отвечает на сообщение.",
      }),
      Object.freeze({
        kind: "p",
        text: "Рядом — «в работе: N». Если строки не помещаются, нажмите «Показать всех (N)». Закрыть список — «Скрыть» или Escape.",
      }),
      Object.freeze({
        kind: "p",
        text: "Когда работы нет, блок пишет «в работе ничего нет». Слова «без свежих данных: N» значат: о части задач давно нет событий. Это не конец работы и не ошибка.",
      }),
    ]),
  }),
  Object.freeze({
    key: "journal",
    title: "Журнал",
    blocks: Object.freeze([
      Object.freeze({
        kind: "p",
        text: "Журнал — все события от Claude Code, по строке на событие. Новые строки — внизу. Время — по часам этого компьютера.",
      }),
      Object.freeze({
        kind: "p",
        text: "Нажмите на строку — откроются подробности. С клавиатуры: выберите строку клавишей Tab и нажмите Enter. Главное в подробностях — «Что произошло» и «Чего это не доказывает».",
      }),
      Object.freeze({
        kind: "p",
        text: "«Чего это не доказывает» — о чём событие молчит. Например, «Агент закончил работу и вернул ответ» не значит, что задание сделано верно.",
      }),
      Object.freeze({
        kind: "p",
        text: "Пометка «не подтверждена» значит: Pixel Office не признал строку настоящим событием. На работу она не влияет.",
      }),
      Object.freeze({
        kind: "p",
        text: "Кнопки «Всё», «Работа» и «Офис» сужают список. «Работа» — сообщения, ответы и работа агентов. «Офис» — события, от которых персонажи пошли по офису.",
      }),
      Object.freeze({
        kind: "p",
        text: "Поле «Поиск в журнале» ищет по словам строк, названиям ролей и описаниям задач. Кнопка «Фильтры» открывает выбор «Сессия», «Агент» и «Тип события». Кнопка «Сбросить фильтры» снимает всё, что вы выбрали.",
      }),
      Object.freeze({
        kind: "p",
        text: "Над строками — «N из M»: показано N строк из M подходящих. Сначала видны последние 200; кнопка «Показать более ранние» добавляет ещё.",
      }),
      Object.freeze({
        kind: "p",
        text: "Чтобы увидеть все события одной задачи, откройте её строку и нажмите «события этой задачи». Другие переходы в подробностях — «открыть агента», «к задаче в панели» и «открыть историю запроса».",
      }),
    ]),
  }),
  Object.freeze({
    key: "tasks",
    title: "Задачи",
    blocks: Object.freeze([
      Object.freeze({
        kind: "p",
        text: "Панель «Задачи» — список работы. Элемент — одна задача: работа одного агента или один ваш запрос к основной сессии. Разделы панели — «Текущие», «История» и «Запуски сервера».",
      }),
      Object.freeze({
        kind: "p",
        text: "У элемента — название роли, описание задачи, время и слово состояния. Описание пишет тот, кто передал задание.",
      }),
      Object.freeze({
        kind: "p",
        text: "В «Запуски сервера» видно, когда запускался сервер Pixel Office. Пока он не работал, события не записывались.",
      }),
      Object.freeze({
        kind: "p",
        text: "Кнопка «агент» открывает карточку. Кнопка «открыть историю запроса» показывает весь ваш запрос и всю работу по нему. В панели — последние 300 элементов.",
      }),
      Object.freeze({
        kind: "p",
        text: "События одной задачи: нажмите «агент», а в карточке — «события в журнале».",
      }),
    ]),
  }),
  Object.freeze({
    key: "cards",
    title: "Карточки агентов",
    blocks: Object.freeze([
      Object.freeze({
        kind: "p",
        text: "Карточка роли открывается нажатием на персонажа, его стол, подпись или кнопку легенды. Сразу видно, кто это, и строки «Задача», «Агент» и «Рабочее место»: состояние и на чём оно основано.",
      }),
      Object.freeze({
        kind: "p",
        text: "Ниже — раскрытия с подробностями: «Кто запустил», «Кого запустил», «Все запуски этой роли». Кнопки «к задаче в панели» и «события в журнале» закрывают карточку и ведут к задаче и её событиям.",
      }),
      Object.freeze({
        kind: "p",
        text: "Карточка «Основная сессия» показывает один запрос: когда он пришёл и в каком он состоянии. В ней же видно, кого основная сессия запустила в этом запросе. Закрыть карточку — кнопкой × или Escape.",
      }),
    ]),
  }),
  Object.freeze({
    key: "history",
    title: "Окно «Просмотр истории»",
    blocks: Object.freeze([
      Object.freeze({
        kind: "p",
        text: "Окно «Просмотр истории» собирает всё об одном вашем запросе. В нём разделы «Исходный запрос», «Как оркестратор понял», «Кто работал и что сделал» и «Хронология».",
      }),
      Object.freeze({
        kind: "p",
        text: "Текст запроса виден, только если его хранение включено. Иначе в окне — «текст не сохраняется». Ответов агентов в окне нет: их текст Pixel Office не хранит.",
      }),
      Object.freeze({
        kind: "p",
        text: "Окно открывается кнопкой «открыть историю запроса» в журнале или в панели «Задачи». Закрыть — «Закрыть» или Escape.",
      }),
    ]),
  }),
  Object.freeze({
    key: "states",
    title: "Цвета и состояния",
    blocks: Object.freeze([
      Object.freeze({ kind: "p", text: "У задачи одно из пяти состояний:" }),
      Object.freeze({
        kind: "ul",
        items: Object.freeze([
          "«в работе» (жёлтое) — по задаче приходят свежие события.",
          "«нет свежих данных» (серое) — событий нет дольше 60 минут. Это не конец и не ошибка.",
          "«закончила работу, итог не записан» (зелёное) — агент вернул ответ. Текст ответа страница не хранит, поэтому итог не записан. Удалась ли работа, страница не знает.",
          "«окончание не записано» (красноватое) — разговор закрылся или пришёл новый запрос, а сообщения о конце работы не было.",
          "«сервер перезапускался, события не записывались» (серое) — после начала задачи сервер Pixel Office запускали заново. Агент при этом мог работать дальше.",
        ]),
      }),
      Object.freeze({
        kind: "p",
        text: "Точка в шапке зелёная — «на связи»: страница получает события. Красная — «Нет связи с сервером Pixel Office». Страница показывает загруженное и догрузит пропущенное, когда связь вернётся. Серая — ответа сервера ещё не было.",
      }),
      Object.freeze({
        kind: "p",
        text: "Цвет стола, персонажа и квадрата в легенде — это роль. Квадрат серый, когда роль свободна.",
      }),
    ]),
  }),
  Object.freeze({
    key: "keys",
    title: "Клавиши",
    blocks: Object.freeze([
      Object.freeze({
        kind: "ul",
        items: Object.freeze([
          "Tab и Shift+Tab — перейти к следующей или предыдущей кнопке, полю или строке. Выбранный клавишей Tab элемент обведён рамкой.",
          "Enter или пробел — нажать кнопку, открыть строку журнала или карточку роли.",
          "Стрелки — выбрать вариант в списках «Сессия», «Агент», «Тип события» и листать списки.",
          "Escape — закрыть то, что открыто: окно истории, карточку, список «Показать всех (N)», справку или подробности строки. Одно нажатие закрывает одно.",
        ]),
      }),
      Object.freeze({
        kind: "p",
        text: "Своих клавиш-сокращений у страницы нет.",
      }),
    ]),
  }),
  Object.freeze({
    key: "limits",
    title: "Чего страница не показывает",
    blocks: Object.freeze([
      Object.freeze({
        kind: "ul",
        items: Object.freeze([
          "Что агент написал в ответе: текст ответа не хранится.",
          "Что агент делает внутри: чтение файлов, команды, правки. Claude Code об этом не сообщает.",
          "Разговоры агентов между собой. Известны только передачи задания и окончания работы.",
          "Ошибки и то, что агент ждёт человека. Claude Code сейчас об этом не сообщает. Если команде нужно ваше решение, оркестратор спросит вас в разговоре с Claude Code.",
          "Разговоры из других папок и всё, что было, пока сервер Pixel Office не работал.",
          "Сколько работы осталось. Полоски хода нет: журнал этого не знает.",
        ]),
      }),
    ]),
  }),
]);

// ------------------------------------------ the guide: the team (REQ-051)

// The sections about the team (REQ-051, table T2): how to work with the team,
// the roles of the team by groups (the names are those of ROLE_NAMES, the
// descriptions are GUIDE_ROLE_ABOUT by code) and the glossary.
export const GUIDE_TEAM = Object.freeze({
  key: "team",
  title: "Как работать с командой агентов",
  blocks: Object.freeze([
    Object.freeze({
      kind: "ol",
      items: Object.freeze([
        "Цель — словами. Откройте Claude Code в папке sai/ и напишите, что нужно, как коллеге. Pixel Office для этого не нужен.",
        "Оркестратор разбивает цель на шаги. Он выбирает, как идти к цели, и раздаёт шаги ролям. На странице это строки «Задание передано агенту».",
        "Роли делают и проверяют друг друга. У каждой работы есть проверяющая роль. Например, код проверяют «Проверка безопасности» и «Ревью кода». Без согласия проверяющего работа дальше не идёт.",
        "Где нужно ваше решение. Некоторые решения может принять только владелец. Например, разрешить выпуск сделанных изменений или отступить от обязательных правил проверки. Тогда оркестратор спрашивает вас в разговоре с Claude Code. Pixel Office этих вопросов не показывает.",
        "Как следить. «Сейчас» — кто занят. Журнал — что произошло. «Задачи» — список работы. Итог работы оркестратор пишет в разговоре с Claude Code.",
      ]),
    }),
  ]),
});
export const GUIDE_ROLES = Object.freeze({
  key: "roles",
  title: "Роли команды",
  lead: "Ниже — все роли команды Sai: название, как на странице, и что роль делает. Роль появляется в офисе, когда ей дали задачу. Роль не из этого списка страница показывает так, как её назвал Claude Code.",
  groups: Object.freeze([
    Object.freeze({
      title: "Ведение работы",
      codes: Object.freeze(["ORCH", "DOC-UPDATER"]),
    }),
    Object.freeze({
      title: "Требования",
      codes: Object.freeze(["REQ-ANALYST", "REQ-VALIDATOR"]),
    }),
    Object.freeze({
      title: "Проект и интерфейс",
      codes: Object.freeze([
        "CODE-DESIGNER",
        "CODE-DESIGN-VALIDATOR",
        "GUI-DESIGN-ANALYST",
        "DESIGN-QA-VALIDATOR",
      ]),
    }),
    Object.freeze({
      title: "Код",
      codes: Object.freeze([
        "BACKEND-DEV",
        "FRONTEND-DEV",
        "CODE-FIXER",
        "SECURITY-REVIEWER",
        "REVIEWER",
        "ISSUE-FIXER",
      ]),
    }),
    Object.freeze({
      title: "Тесты и приёмка",
      codes: Object.freeze([
        "TEST-DESIGNER",
        "TEST-DESIGN-VALIDATOR",
        "TEST-RUNNER",
        "TEST-FIXER",
        "BA-ANALYST",
        "UAT-RUNNER",
        "RELEASE-VALIDATOR",
        "RELEASE-FINALIZER",
      ]),
    }),
    Object.freeze({
      title: "Аудит",
      codes: Object.freeze([
        "AUDIT-SCOUT",
        "AUDIT-PLANNER",
        "ARCHITECTURE-AUDITOR",
        "COVERAGE-AUDITOR",
        "DEPENDENCY-AUDITOR",
        "DOC-AUDITOR",
        "SECURITY-AUDITOR",
        "AUDIT-COMPILER",
        "AUDIT-TRIAGE",
      ]),
    }),
    Object.freeze({
      title: "Идеи и бизнес-план",
      codes: Object.freeze([
        "IDEA-ANALYST",
        "IDEA-JUDGE",
        "VERDICT-EXECUTOR",
        "MARKET-RESEARCHER",
        "PLAN-WRITER",
        "PLAN-VALIDATOR",
      ]),
    }),
  ]),
});
export const GUIDE_ROLE_ABOUT = Object.freeze({
  ORCH: "Принимает вашу цель и раздаёт шаги ролям. Следит за проверками и отчитывается вам.",
  "DOC-UPDATER":
    "Ведёт учёт: отмечает, что сделано, обновляет документы и записывает ошибки в работе команды.",
  "REQ-ANALYST":
    "Записывает вашу просьбу как требование: что должно получиться и как это проверить.",
  "REQ-VALIDATOR":
    "Проверяет требование: можно ли проверить каждое условие. Без его согласия работа не начинается.",
  "CODE-DESIGNER":
    "До начала программирования описывает, как будет устроен код и чем его проверят.",
  "CODE-DESIGN-VALIDATOR":
    "Проверяет этот план до начала программирования: всё ли учтено и понятно ли, что строить.",
  "GUI-DESIGN-ANALYST":
    "Подробно описывает экран: что где стоит, какие тексты и что происходит при нажатиях.",
  "DESIGN-QA-VALIDATOR":
    "Открывает собранную страницу и сравнивает её с утверждённым описанием экрана.",
  "BACKEND-DEV": "Пишет код, который работает на сервере, и служебные команды.",
  "FRONTEND-DEV":
    "Строит страницы, в том числе эту, по проверенному плану и описанию экрана.",
  "CODE-FIXER":
    "Исправляет код по замечаниям проверяющих и исправляет найденные ошибки.",
  "SECURITY-REVIEWER":
    "Проверяет новый код: нет ли в нём паролей и ключей, утечек данных и опасного ввода.",
  REVIEWER:
    "Смотрит, настоящее ли это решение и нет ли лишней работы. Ревью — это проверка кода другим участником.",
  "ISSUE-FIXER":
    "Повторяет ошибку и находит её причину. Сам ничего не исправляет.",
  "TEST-DESIGNER": "Пишет тесты: на каждое условие требования — своя проверка.",
  "TEST-DESIGN-VALIDATOR":
    "Проверяет, что тесты настоящие и действительно ловят ошибки.",
  "TEST-RUNNER": "Запускает все проверки и разбирает каждую неудачу.",
  "TEST-FIXER":
    "Разбирает неудачную проверку и исправляет то, что неверно, ничего не удаляя.",
  "BA-ANALYST":
    "Описывает языком владельца, как проверить работу на деле, и подписывает итог такой проверки.",
  "UAT-RUNNER":
    "Проверяет работу на запущенной системе по этим описаниям и записывает, что получилось.",
  "RELEASE-VALIDATOR":
    "Последняя проверка перед выпуском: сам заново проверяет каждое условие, не доверяя чужим отчётам.",
  "RELEASE-FINALIZER":
    "Сохраняет изменения и пишет отчёт о выпуске. Изменения выпускаются только после вашего подтверждения.",
  "AUDIT-SCOUT":
    "Решает, какие части проекта проверить в очередном аудите и на что смотреть.",
  "AUDIT-PLANNER":
    "Составляет план аудита: какую часть с какой стороны проверять.",
  "ARCHITECTURE-AUDITOR":
    "Проверяет, как устроен код: соблюдены ли принятые решения и нет ли лишнего кода.",
  "COVERAGE-AUDITOR":
    "Ищет условия требований и исправленные ошибки, которые не проверены тестами.",
  "DEPENDENCY-AUDITOR":
    "Проверяет чужие программные части, которые использует проект: версии, известные дыры в защите и условия использования.",
  "DOC-AUDITOR":
    "Проверяет, что документы совпадают с тем, что сделано на самом деле.",
  "SECURITY-AUDITOR":
    "Ищет в проекте пароли и ключи, опасный ввод и выдуманные события.",
  "AUDIT-COMPILER":
    "Собирает находки аудита, сам перепроверяет важные и пишет итог для владельца.",
  "AUDIT-TRIAGE":
    "Заводит записи об ошибках по подтверждённым находкам аудита, без повторов.",
  "IDEA-ANALYST":
    "Оценивает идеи с одной стороны: рынок, исполнение или подходит ли идея владельцу.",
  "IDEA-JUDGE":
    "Выбирает идею по оценкам аналитиков. Это совет: решает владелец.",
  "VERDICT-EXECUTOR":
    "Перепроверяет итоговый выбор идеи и записывает его как совет или возвращает на пересмотр.",
  "MARKET-RESEARCHER":
    "Ищет в интернете факты о рынке, ценах и конкурентах. У каждого факта — ссылка и дата.",
  "PLAN-WRITER":
    "Пишет бизнес-план только по проверенным фактам. У каждого числа — источник или пометка, что это допущение.",
  "PLAN-VALIDATOR":
    "Сам открывает источники и проверяет каждое число исследования или плана.",
});
export const GUIDE_GLOSSARY = Object.freeze({
  key: "glossary",
  title: "Словарь",
  pairs: Object.freeze([
    Object.freeze([
      "Агент",
      "Программа с искусственным интеллектом (ИИ), которая делает одну часть работы. У каждого агента есть роль.",
    ]),
    Object.freeze([
      "Роль",
      "Чем занимается агент, например «Проверка безопасности». Название роли одно на всей странице.",
    ]),
    Object.freeze([
      "Задача",
      "Одна часть работы: один запуск агента или один запрос основной сессии. В панели «Задачи» — по элементу на каждую.",
    ]),
    Object.freeze([
      "Запрос",
      "Ваше сообщение в разговоре с Claude Code. По одному запросу может быть много задач.",
    ]),
    Object.freeze([
      "Запуск",
      "Один запуск агента со своим номером. У одной роли может быть много запусков.",
    ]),
    Object.freeze([
      "Номер запуска, номер разговора",
      "Первые 8 знаков длинного номера. В карточке это выглядит так: номер запуска 3f2a9c1b. Номер отличает один запуск или разговор от другого.",
    ]),
    Object.freeze([
      "Разговор (сессия)",
      "Один разговор с Claude Code. «Основная сессия» — разговор, в котором вы пишете цель.",
    ]),
    Object.freeze([
      "Оркестратор",
      "Главная роль команды. Принимает цель, раздаёт шаги ролям и следит за проверками.",
    ]),
    Object.freeze([
      "Журнал",
      "Список событий от Claude Code по порядку, с настоящим временем.",
    ]),
    Object.freeze([
      "Событие",
      "Одно сообщение от Claude Code о том, что произошло. Например, агент вернул ответ.",
    ]),
    Object.freeze([
      "Ворота проверок",
      "Шаг, на котором проверяющая роль решает, может ли работа идти дальше.",
    ]),
    Object.freeze([
      "Планка качества",
      "Минимум качества, ниже которого работа не опускается. Исключение может дать только владелец.",
    ]),
    Object.freeze([
      "Claude Code",
      "Программа, в которой работают агенты Sai. Pixel Office получает события от неё.",
    ]),
    Object.freeze([
      "Сервер Pixel Office",
      "Программа на этом компьютере. Она собирает события и показывает эту страницу.",
    ]),
    Object.freeze([
      "Требование",
      "Запись того, что должно получиться, и условий, по которым это проверяют.",
    ]),
    Object.freeze([
      "Код",
      "Текст программы. Из него собраны Sai и эта страница.",
    ]),
    Object.freeze([
      "Тест",
      "Программа-проверка: она сама проверяет, что код делает то, что нужно.",
    ]),
    Object.freeze(["Аудит", "Плановая проверка всего проекта по частям."]),
  ]),
});

// ------------------------------------------ the tour of the page (REQ-052)

// The invitation in the header and the tour of six steps (REQ-052, table
// T3). {n} is the number of the step, {N} the number of steps.
export const TOUR_INVITE_LABEL = "Приглашение в тур";
export const TOUR_INVITE = "Впервые здесь? Покажу за минуту, что где.";
export const TOUR_INVITE_SHOW = "Показать";
export const TOUR_INVITE_LATER = "Не сейчас";
export const TOUR_LATER_NOTE =
  "Тур можно открыть позже: «Как пользоваться» → «Показать тур по странице».";
export const TOUR_LATER_CLOSE = "Скрыть подсказку о туре";
export const TOUR_STEP = "Шаг {n} из {N}";
export const TOUR_NEXT = "Далее";
export const TOUR_BACK = "Назад";
export const TOUR_SKIP = "Пропустить";
export const TOUR_LAST = "Закрыть тур";
export const TOUR_CLOSE = "Закрыть тур";
export const GUIDE_TOUR_START = "Показать тур по странице";
export const KEYS_TOUR = "Escape закрывает и тур по странице — на любом шаге.";
// A step: its title, its text and the text shown instead when its target
// is missing or empty (null: the step has none).
export const TOUR_STEPS = Object.freeze([
  Object.freeze({
    title: "Это Pixel Office",
    text: "Здесь видно, что делает команда ИИ-агентов Sai. Страница только показывает и ничего не запускает. Что нужно сделать, вы пишете в Claude Code. Подробнее — в справке «Как пользоваться».",
    fallback: null,
  }),
  Object.freeze({
    title: "Офис",
    text: "У каждой роли с задачей — стол и персонаж своего цвета. Стол «Основная сессия» — ваш разговор с Claude Code. Нажмите на персонажа — откроется карточка роли.",
    fallback:
      "Это офис. Сейчас в нём никого. Стол «Основная сессия» появится, когда откроется разговор с Claude Code в папке sai/. Столы ролей появятся, когда ролям дадут задачи.",
  }),
  Object.freeze({
    title: "Сейчас",
    text: "Здесь — кто занят прямо сейчас: строка на каждого, кто «в работе». Если строк много, нажмите «Показать всех (N)».",
    fallback:
      "В шапке будет блок «Сейчас» — кто занят прямо сейчас. Он появится после первого ответа сервера Pixel Office.",
  }),
  Object.freeze({
    title: "Журнал",
    text: "Каждое событие от Claude Code — отдельная строка, новые внизу. Нажмите на строку: «подробнее» покажет, что произошло и о чём событие молчит. Поиск и «Фильтры» помогают найти нужное.",
    fallback:
      "Это журнал. Событий пока нет. Откройте Claude Code в папке sai/ и напишите цель. Первые строки появятся здесь в течение 5 секунд.",
  }),
  Object.freeze({
    title: "Задачи",
    text: "Список работы: по элементу на каждую задачу агента и на каждый ваш запрос. Отсюда открывается окно «Просмотр истории» запроса.",
    fallback:
      "Это список работы. Пока он пуст: элементы появятся с первыми событиями от Claude Code.",
  }),
  Object.freeze({
    title: "Справка — здесь",
    text: "Кнопка «Как пользоваться» открывает справку: о странице, о команде и словарь. Там же можно снова запустить этот тур. Escape закрывает тур в любой момент.",
    fallback: null,
  }),
]);

// ------------------------------------ the hints and empty states (REQ-053)

// The buttons "?" next to four parts of the page and their hints (REQ-053,
// table T4); {name} is the name of the part.
export const HINT_MARK = "?";
export const HINT_LABEL = "Подсказка: {name}";
export const HINT_CLOSE =
  "Закрыть подсказку: нажмите «?» ещё раз, нажмите в другом месте страницы или Escape.";
export const KEYS_HINT = "Escape закрывает и открытую подсказку «?».";
export const HINT_NAMES = Object.freeze({
  now: "Сейчас",
  journal: "Журнал",
  tasks: "Задачи",
  office: "Офис и доска",
});
export const HINTS = Object.freeze({
  now: "Строка на каждого, кто сейчас «в работе»: название роли и задача. «в работе: N» — сколько их. Строка исчезает, когда агент вернул ответ или о задаче давно нет событий.",
  journal:
    "Каждое событие от Claude Code — строка с настоящим временем. Нажмите на строку, чтобы увидеть подробности. «Фильтры» и поиск сужают список. Строка с пометкой «не подтверждена» ни на что не влияет.",
  tasks:
    "Элемент — одна задача: работа одного агента или один ваш запрос. Слово состояния, например «в работе», говорит, идёт ли задача. События одной задачи: нажмите «агент», а в карточке — «события в журнале».",
  office:
    "У каждой роли с задачей — стол и персонаж своего цвета. Экран ноутбука светится, пока роль работает. Числа на доске — сколько задач у роли. Жёлтое — «в работе», зелёное — агент вернул ответ, красное — конец работы не записан, серое — сервер перезапускали.",
});
// The empty journal, the empty office and the empty panel of tasks.
export const EMPTY_STEPS_TITLE = "Чтобы здесь появились события:";
export const OFFICE_EMPTY =
  "В офисе пока никого. Стол «Основная сессия» появится, когда откроется разговор с Claude Code в папке sai/. Столы ролей появятся, когда ролям дадут задачи.";
export const TASKS_EMPTY =
  "Задач пока нет. Элемент появится, когда основная сессия получит запрос или агенту передадут задание.";
export const EMPTY_STEPS = Object.freeze([
  "Откройте Claude Code в папке sai/.",
  "Если Claude Code спросит, доверять ли папке, — подтвердите.",
  "Напишите в разговоре цель обычными словами.",
  "Первые строки появятся здесь в течение 5 секунд. Обновлять страницу не нужно.",
]);
