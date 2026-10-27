# tools — service code of the Sai pipeline

This folder holds the service code of the pipeline, not product code. The stack is Node 22 without run-time dependencies; prettier, eslint, @eslint/js and globals are development dependencies only, and their versions are pinned in `package-lock.json` (`decisions/0002-process-tooling-node.md`). Pixel Office is a service tool for watching the work of the pipeline agents (`decisions/0003-pixel-office-as-pipeline-tooling.md`); the decisions of its design are in `decisions/0005-pixel-office-design.md`, the design itself is `docs/design/REQ-001-pixel-office.md`.

The WF-06 ("idea selection") commands: `npm run prepare-run`, `npm run validate`, `npm run apply-verdict`, `npm run snapshot` and `npm run snapshot-diff`. How they work is described in `docs/design/REQ-002-idea-verdict.md`. Pixel Office is started with `npm run pixel-office`; it is described below.

## Check

The one check command (quality-bar Q4) runs from the folder `tools/`; Node 22 is needed (`engines` in `package.json`: `>=22 <23`):

    cd tools
    npm ci
    npm run check

`npm run check` is, in a row, `npm run format:check` (prettier --check), `npm run lint` (eslint --max-warnings 0), `npm run traces` (the trace check), `npm run handoffs-check` (the check of the run records) and `npm run test` (node --test over `test/**/*.test.js`); it stops at the first error. The check is not bypassed: there is no `skip` and no `todo` in the tests, and there are no turned-off rules in the code or in the settings (quality-bar Q6).

## Pixel Office

Pixel Office shows live which tasks the Sai agents are doing. A task is one start of a subagent (the tool Agent): a role (`agent_type`), a short description, a start, an end and one of five states: «в работе» (working), «нет свежих данных» (no fresh data), «сервер перезапускался, события не записывались» (the server was restarted, events were not recorded), «закончила работу, итог не записан» (finished the work, the result is not recorded) or «окончание не записано» (the end is not recorded). The work of the main session is shown as a separate row. Next to it are the event journal and the office: characters of the roles at desks; a click on a character, on the label at its desk or on its desk opens the card of the agent run. Everything is built from one source — the events that the Claude Code hooks send themselves at the moment they fire, with that time. There are no events written in advance or after the fact (bar item R2).

The page writes «в работе» (working) only while the session of the task has a fresh hook event. If there were no trusted events of this session for more than 60 minutes (the constant `STALE_AFTER_MS`), the task and the row of the main session are shown as «нет свежих данных» (no fresh data), and the session is shown without the word «Идёт» (going): the journal stopped confirming the work; this is neither an end nor an error. The age of the last event («2 ч 34 мин назад», 2 h 34 min ago) grows by itself, without new events, and is counted by the page by the clock of the computer on which it is open. There is no progress bar and no task counter: the journal does not know how much work is left. «Сервер перезапускался, события не записывались» means only that after the task began the server was started again and in the pause events were not recorded; it is not a statement that the agent stopped. Trusted rows are only hook events (source `REAL`); an orchestrator record and a row marked «не подтверждена» (not confirmed) do not refresh the session. If the end event comes later, the task becomes «закончила работу, итог не записан»; the page says no word about success, because the journal does not know how the work ended. When nothing is «в работе», the row «Сейчас» (Now) names the number of elements «без свежих данных» (without fresh data) and the reason.

The page has: a header (the title; the connection block: «на связи» (connected) while the server answers, or «Нет связи с сервером Pixel Office» (no connection with the Pixel Office server), and under it the note «Источник событий — Claude Code» (the source of events is Claude Code); the block «Сейчас» — a row for each agent that is «в работе» right now, «в работе: N» (working: N) and «Показать всех (N)» (show all); the buttons «Пауза» (pause), «1×», «2×», «4×» — they control only the walking of the characters); on the left, the office with the legend of roles and the agent run card that opens on a click on a character, a label or a desk; on the right, the event journal with the filters «Всё» (all), «Работа» (work), «Офис» (office), a search and the filters «Сессия» (session), «Агент» (agent), «Тип события» (event type), and the panel «Задачи» (tasks) with the sections «Текущие» (current), «История» (history) and «Запуски сервера» (server starts). The time is shown by the clock of this computer, and the time zone is written in the header of the journal (in the journal file the time is UTC). The journal shows the last 200 rows that fit the filter (the new ones at the bottom) and the counter «N из M» (N of M); the task panel shows up to 300 elements, with the note «показано n из N» (shown n of N); the rules — tasks, states, office — read the whole journal. A row whose source is not `REAL`, or whose time does not agree with the order of the journal, is shown with the note «не подтверждена» and influences neither the tasks nor the office.

In the office a role character «works» while the role has a task that is «в работе» (not «нет свежих данных» and not «сервер перезапускался…»). Characters walk only on two events: when a task begins, the one who started it walks to the desk of the role of the started subagent and comes back; when it ends, the character of the subagent walks to the desk of the one who started it and comes back. The hooks give no meetings or questions between agents, so there are none in the office.

### Start

    cd tools
    npm run pixel-office

The command starts the server and prints one line with a link:

    Pixel Office: http://127.0.0.1:4780/

The default port is 4780. It is fixed, so the link does not change between starts. Another port: `npm run pixel-office -- --port <number>` (`--port 0` means any free port); another state folder: `--dir <absolute path>` (see "Where things are"). If Pixel Office is already running on the port, the same line is printed and the command ends with code 0; a second server is not started. If the port is taken by another process, the command writes about it in Russian to stderr and ends with code 1. Help: `npm run pixel-office -- --help`. Node 22 is needed: under another version the command prints a message with the version and ends with code 1.

Only the line with the link goes to stdout; warnings and errors go to stderr. If the reader of this output disappears (for example, the pipe closes after a start in the background), the server goes on working: what nobody can read is dropped.

The page updates itself, without reloading: a new event is visible within 5 seconds at most. If the server is unavailable, the page writes «Нет связи с сервером Pixel Office», goes on showing what was loaded, and after the connection is back loads the missed events.

### How to stop

Ctrl+C in the terminal where the command runs. If the server was started in the background — `kill <pid>`; the pid is shown by `lsof -nP -iTCP:4780 -sTCP:LISTEN`. Closing the page does not stop the server.

### How to watch the tasks

1. Start the server (the command above) and open the link.
2. Start Claude Code from the folder `sai/` (in the VS Code extension — the working folder `sai/`). Only the Claude Code sessions whose settings have the Pixel Office handlers are seen: the sessions started in `sai/` — by `sai/.claude/settings.json` (<https://code.claude.com/docs/en/settings>), and the sessions of another folder — only if the handlers are copied into the project settings of that folder; a session started in another folder is not seen if the same handlers are not there (`decisions/0007`). Whether the VS Code extension reads the hooks of `sai/` without a trust dialog is still an open question: the step "ordinary session of the owner" checks it (`docs/design/REQ-001-pixel-office.md`, step U2).
3. An interactive session must accept the dialog of trust in the folder: until it is accepted, Claude Code does not start the hooks from the settings files (<https://code.claude.com/docs/en/hooks>, section "Workspace trust").

Events are recorded only while the server is running: what happened while the server was stopped is lost (see "Limits").

### The words of the screen and the single name of a role

The words on the page are clear to a person who does not know how Claude Code works, and they say the same as the earlier technical ones (the table "was → became" is REQ-048 in `docs/requirements.yaml`). In short:

| On the screen                    | What it means                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «на связи»                       | the Pixel Office server answers the page                                                                                                                                                    |
| «Источник событий — Claude Code» | the note of the header names where the page takes events from; it does not promise that every row of the journal is genuine                                                                 |
| «не подтверждена»                | the row is in the journal, but Pixel Office did not recognise it as a genuine event from Claude Code (a reading rule); it does not influence tasks or the office                            |
| «запуск»                         | one start of an agent with its number (`agent_id`) — what was earlier called «экземпляр» (instance)                                                                                         |
| «разговор»                       | a Claude Code session: «Открыт разговор с Claude Code» (a conversation with Claude Code is opened), «Закрыт разговор с Claude Code» (closed), «разговоров идёт: N» (conversations going: N) |

The name of a role is one everywhere — on the canvas, in the legend button, on the board in the meeting room, in the panel «Задачи», in the window «Просмотр истории» (history view) (the column «Агент» and the «кто» (who) of the timeline) and in the title of the card: a plain-words name by the table `ROLE_NAMES` (`texts.js`). On the canvas the label stands at the desk of the role, under the place, in one or two lines by words, without «…»; a walking character has no label of its own, so labels do not overlap. The board in the meeting room has three columns, the name in a column takes up to three lines; roles that did not fit are shown as «+N». The role code (for example, «Sai Security Reviewer (SECURITY-REVIEWER)») is not in plain view: it is in the hint «код роли: …» (role code) at the name in the legend and in the panel (if the code differs from the name) and in the line «код роли: …» in the fold «Полные номера и код роли» (full numbers and role code) of the agent run card.

### The block «Сейчас» (Now)

The block «Сейчас» has a row per agent: one row for each element «в работе», in the same order as the section «Текущие» of the panel «Задачи». There are no words «и ещё N» (and N more). The row of a task is «<role name> — <description>»; without a description — only the name; for the main session — «Основная сессия — обрабатывает запрос» (Main session — is handling a request). The role is taken from the `agent_type` of the start event, the description from the `description` of the task-handover record (the link is only by identifiers). The role name is the same plain-words one as everywhere (only a Sai role of the kind «Sai … (CODE)» with a code from the table is translated; any other role is shown as it came, in full). Neither the name nor the description is cut: the rows wrap, and if there are more rows than fit, the block scrolls inside itself (it gets focus with Tab and is scrolled with the arrows). On the right of the block is «в работе: N» and, when the rows do not fit, the button «Показать всех (N)»: it shows all rows as one list over the page and becomes «Скрыть» (hide); «Скрыть», Escape or a click outside the list close it, and the focus returns to the button; new events update an open list too. When nothing is «в работе» — «Сейчас: в работе ничего нет» (Now: nothing is working) and, if there are elements without confirmation, « · без свежих данных: N»; there is then no label and no button.

### The journal in plain words

Every row of the journal says what happened, in words of one table (`EVENT_TABLE` in `tools/src/pixel-office/public/texts.js`); «{роль}» ({role}) is the role name from the same row. A row is only an event: it has no words of states or age. The full texts «что значит» (what it means) and «чего не доказывает» (what it does not prove) are in the table and in the fold of the row; below, in short.

| Event                                  | Words of the row                                                                                | What it means                                                             | What it does not prove                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `SessionStart`                         | Открыт разговор с Claude Code                                                                   | a new conversation (session) was begun or an earlier one was continued    | that work began or a request came                                              |
| `SessionEnd`                           | Закрыт разговор с Claude Code                                                                   | the conversation ended; Claude Code does not give the reason              | that the work was brought to the end                                           |
| `UserPromptSubmit` (owner)             | Владелец отправил запрос (the owner sent a request)                                             | a person sent a message to the main session                               | that the request was understood or done                                        |
| `UserPromptSubmit` (service)           | В сессию пришло служебное сообщение (a service message came into the session)                   | a message from the system, not from a person                              | that a person wrote it                                                         |
| `UserPromptSubmit` (kind not recorded) | В сессию пришло сообщение (a message came into the session)                                     | who wrote it is not recorded in the row                                   | that a person wrote it                                                         |
| `Stop`                                 | Основная сессия вернула ответ (the main session returned an answer)                             | the main session finished its next answer                                 | that all work is finished or succeeded                                         |
| `SubagentStart` (first)                | Агент «{роль}» получил задание и начал работу (the agent «{role}» got a task and began work)    | Claude Code started an agent of this role                                 | what the task is and who gave it                                               |
| `SubagentStart` (repeated)             | Агент «{роль}» продолжил работу (the agent continued work)                                      | the same agent began work again                                           | that the earlier work succeeded                                                |
| `SubagentStop`                         | Агент «{роль}» закончил работу и вернул ответ (the agent finished work and returned an answer)  | the agent returned an answer; the result is not recorded                  | that the task is done and the answer is right                                  |
| `PostToolUse`                          | Задание передано агенту «{роль}» (the task was handed to the agent)                             | the one who handed over started the agent                                 | that the agent finished; the time of the record is not the time the work began |
| orchestrator record                    | Оркестратор записал, как понял запрос (the orchestrator recorded how it understood the request) | a record that the orchestrator made itself; not an event from Claude Code | that work is going on or is done as recorded                                   |
| row «не подтверждена»                  | the words of its kind and the note «не подтверждена»                                            | Pixel Office did not recognise the row as a genuine event                 | that the event took place                                                      |

A start is counted as repeated if earlier in the journal there is a start of the same agent with the source `REAL` (decision `0055`). Orchestrator records are rows of the journal with their own source («кто» — «Оркестратор»): they are in the filter «Всё» and in the count «N из M», they are not in «Работа» and «Офис», they do not change tasks, states, the office and the block «Сейчас»; the text of the record and the requirement number are not in the row — they are in the fold. In a row «не подтверждена» the value of the field `source` is visible only in the fold «Технические поля» (technical fields).

Each row has at its right the word «подробнее» (more) (for an open one — «свернуть», fold). A click on the row (or Enter and Space when the row is in focus by Tab) opens the event under it; a second click, the button «Закрыть» (close) or Escape close the fold, and the focus returns to the row. The fold begins with the main thing — «Что произошло» (what happened) and «Чего это не доказывает» (what this does not prove) — then «Когда» (when) (date, time with seconds and the time zone), «Источник» (source) («Claude Code», «запись оркестратора» (orchestrator record) or «не Claude Code»), «Сессия» (session) (8 characters and in full), «Агент», «Задача» (task) (its state now, with the label «сейчас»), for an orchestrator record — its text, the requirement number and the time of the request, for a marked row — the note «не подтверждена: …» with the reason, and the «Технические поля» closed by default (all fields of the row except the text of the owner's message). After the fold opens, the journal is scrolled so that the top of the fold stands at the top edge of the list. A new row and a page refresh do not close the fold.

Jumps from the fold are buttons under their own field: at «Агента» — «открыть агента» (open the agent) (for a task handover — «кто передал», who handed over), at «Задачи» — «кому» (to whom) (for a task handover), «к задаче в панели» (to the task in the panel) (the element of «Задач» is marked, scrolled into view and gets focus; if it is not among the last 300 elements of the panel — instead of the button the text «задача не показана в панели: там последние 300 элементов» (the task is not shown in the panel: it holds the last 300 elements)), «события этой задачи» (events of this task) (the filter «Задача») and «открыть историю запроса» (open the history of the request) (if the event is outside the window of the owner's request — the text «запрос не определён: событие вне окна запроса владельца» (the request is not determined: the event is outside the window of the owner's request)). The row of an owner's request has its own button «открыть историю запроса».

Only two fields in a row can change after the fact: the description at the start and the end of an agent (it appears when the task-handover record comes, and disappears if there become several such records) and the note «не подтверждена» (a time conflict, a time from the future) — together with it, in the fold the texts «что значит» and «чего не доказывает» pass between the case of the note and the case of the kind of the row. The words of the event, «кто», the time, the session and the source do not change.

### Search and filters of the journal

Above the journal are the field «Поиск в журнале» (search in the journal) and the button «Фильтры» (filters). The search works as you type, without regard to case, and goes through the words of the event, «кто» (the name and code of the role of the one in «кто»), the description of the task, the full numbers of the session and of the agents, and the text of the orchestrator record; the search does not go through the text of the owner's message. The button «Фильтры» opens the lists «Сессия», «Агент» and «Тип события» (the options come only from the journal; «Агент» is the one in «кто» of the row, not the receiver of the task). The filter «Задача» is set by the jumps «события этой задачи» and «события в журнале» (events in the journal); it is visible by the note «Задача: <название> номер <8 знаков>» (Task: <name> number <8 characters>) with a button to remove it. All filters, the search and the earlier «Всё / Работа / Офис» act together; the counter «N из M» counts the rows under them; what is chosen is not reset by new events. «Сбросить фильтры» (reset filters) removes everything and sets «Всё». If no row fits the choice — «Под выбранные фильтры не подходит ни одно событие» (no event fits the chosen filters) and the button «Сбросить фильтры». The journal shows the last 200 fitting rows; the button «Показать более ранние» (show earlier) above them adds 200 more, and a change of the filter or search returns the view to the last 200.

### The agent run card

The run card (an instance of an agent) is one start with its own number (`agent_id`); a role can have several. It is opened by a click on the character of the role, on the label at its desk or on the cell of the desk (the desk with a laptop and the place behind it — even when the character has walked away on a route), Enter or Space on the role button in the legend, the buttons «открыть агента», «кто передал», «кому» in the fold of an event and the button «агент» of an element of the panel «Задачи». If the point hit both a character and a desk, the card of the character opens. Which run opens: if the role has a run «в работе» — the first of them; otherwise a run that needs attention («нет свежих данных» or «сервер перезапускался, события не записывались»), with the latest own event (the start or the end of this agent); otherwise — the run with the latest own event.

The card shows at once: the role name; under it, what the role does (the description from the help, the section «Роли команды» (roles of the team); for a role outside the table — «Описания этой роли нет: так её назвал Claude Code.» (there is no description of this role: this is how Claude Code named it)); «номер запуска <8 знаков> · номер разговора <8 знаков>» (run number · conversation number) (the full numbers, «Скопировать» (copy) and the role code are in the fold «Полные номера и код роли»); the current task (the description written by the one who handed over the task); three state rows; «Кто запустил» (who started) and the jumps. The three rows differ: «Задача» — the state of the task and its basis (the time of the last event of the session and the age, the time of the server restart, of the end or of the closing of the session); «Агент» — the last event of the run itself (a start, a continuation or an end) with the time and the age; «Рабочее место» (workplace) — the word of the role legend («работает» (works) or «свободен» (free)). The desk on the canvas is an image of the role, common to all its runs, and not a computer. «Кто запустил: Основная сессия» is a button: it opens the card of the main session. The list «Все запуски этой роли» (all runs of this role) switches the card to another run. In the folds: «Задание передано» (the task was handed over) (the handover record is written by the one who handed over the task; it is not an action of the agent itself), «Начала работы» (starts of work), «Возвраты» (returns), «Кого запустил» (whom it started) and «Вся роль» (the whole role) (the earlier sections of the role card).

What the card does not know: other actions of the agent (reading files, commands, edits), messages between agents (only task handovers and ends of work are known), errors, and that the agent waits for a person — Claude Code does not report this.

### The main session card and the jumps

The main session card is opened by a click on the character, the label or the desk of the main session, by the legend button «Основная сессия» (main session), by the button «открыть агента» at the events of the main session in the journal, by the button «агент» of the main session row in the panel and by the button «Основная сессия» in «Кто запустил». It shows one row of the main session (one request): under the title — «Ваш разговор с Claude Code. Он принимает ваши сообщения и запускает агентов.» (Your conversation with Claude Code. It accepts your messages and starts agents.), «номер разговора <8 знаков>» (the full number and «Скопировать» are in a fold), «Задача» — the word of the state and the basis (the time of the last event of the session and the age, the words and time of the request, the time of the answer, the closing event or the time of the server restart), «Рабочее место», and the folds «кого запустила в этом запросе» (whom it started in this request), «Другие запросы этой сессии» (other requests of this session), «Другие сессии» (other sessions), «Вся основная сессия» (the whole main session) (in it, «разговоров идёт: N» and the earlier sections). A session without requests — «запросов в этой сессии не записано» (no requests are recorded in this session).

Both cards have the jumps «к задаче в панели» and «события в журнале»: both close the card; the first marks the element in the panel «Задачи» and puts focus on it (if the element is not among the last 300 — a text instead of the button), the second sets in the journal the filter «Задача» of this run or row, opens its last row and puts focus on it. The window «Просмотр истории» does not open from a card: it is opened by the buttons «открыть историю запроса» in the panel «Задачи» and in the journal; if a card is open at that moment, it is closed (decision `0014`, decisions 5 and 6); after the window is closed, the focus is on the button that opened it.

Keyboard: on opening, focus is on «×»; Tab and Shift+Tab go round inside the card; folds open with Enter and Space; Escape, «×» or a click outside the card close it, and the focus returns to the button that opened the first card of the chain (a legend button, a button in the fold of an event, or «агент» in the panel; after a click on the canvas — the legend button of the role; decision `0059`). A page refresh does not close the folds and does not move the focus.

### The help «Как пользоваться» (How to use)

The last button of the header is «Как пользоваться» with the sign «?» (in windows up to 599 px only the sign is visible). It opens a help in plain words: what this page is, how to work with the team of agents, the roles of the team, the office, «Сейчас», the journal, «Задачи», the cards, the window «Просмотр истории», the colours and states, the keys, what the page does not show, a glossary. At the top of the help is the table of contents «Разделы» (sections): the button of a section scrolls the help to it and puts focus on its heading. The same button opens from an empty journal.

The help stands next to the page and covers nothing: in grid windows (from 1240 × 640) it is a strip 22 rem wide at the right edge, the page narrows by this width, the canvas is recalculated; in other windows it is a sheet at the bottom edge with a height of half the window, the page above it scrolls and can be pressed. There is no backdrop, the focus is not locked; the help changes nothing on the page and adds no events, and the page still sends only GET. A card and the window «Просмотр истории» open over the help; while they are open, the help does not open. The help is closed with the button «Закрыть», with a second press of «Как пользоваться» or with Escape; the focus returns to the button that opened the help, if it was inside the help.

The common order of Escape on the page: one press closes one thing, the first open one from this list — the history window, a card, a «?» hint, the tour, the list «Показать всех (N)», the help (if focus is in it), the invitation to the tour (if focus is in it), the details of a journal row (if focus is in this row), the help.

The section «Роли команды» shows all roles by groups (the same description stands in the role card right under its name, and the number row of the card is «номер запуска <8 знаков> · номер разговора <8 знаков>»): the name is as on the page (`ROLE_NAMES`), the description is by code from the constant of descriptions in `texts.js`. The descriptions go by `ROLE_NAMES`: if a role without a description or without a group is added to `ROLE_NAMES`, the test of the help turns red. A role not from this list does not appear in the section, and on the page it is shown as Claude Code named it.

### The tour of the first opening

The tour does not open by itself. After the first answer of the server or the first failed attempt of connection, an invitation appears in the header before «Как пользоваться»: «Впервые здесь? Покажу за минуту, что где.» (First time here? I will show in a minute what is where.) with the buttons «Показать» (show) and «Не сейчас» (not now); it covers nothing and does not take focus. «Показать» opens a tour of six steps: the page, the office, «Сейчас», the journal, «Задачи», the help button. The caption of a step stands next to the highlighted element (a yellow frame) or at the bottom edge in narrow windows; there is no backdrop, the focus is not locked, clicks on the page work and do not close the tour. If the element is not there yet (no characters, «Сейчас» is hidden until the first answer) or it is empty, a fallback text is shown about what is visible now. The tour is closed by «Пропустить» (skip), «Закрыть тур» (close the tour), «×», Escape and the opening of the help. To repeat the tour — the button «Показать тур по странице» (show the tour of the page) in the help.

After «Не сейчас» or Escape in the invitation, in its place for 10 seconds appears the line «Тур можно открыть позже: «Как пользоваться» → «Показать тур по странице».» (The tour can be opened later: …) with the button «×» (a screen reader announces it); the focus moves to «Как пользоваться». The line goes away by itself, on «×», or when the tour opens.

The memory is one key «pixel-office-tour» in the storage of the browser (`localStorage`) with the value «closed»: it is written by «Не сейчас», by Escape in the invitation and by any closing of the tour; after that neither the invitation nor the tour appears by itself. The memory is only in this browser and at this address (127.0.0.1 with another port is another address). The storage is read and written only by the tour module `public/tour.js`; there is no journal data in it. If the storage is unavailable or fails, the page works as usual: the invitation is shown at every load, and the tour opens and closes.

### The «?» hints and the empty states

The block «Сейчас», the headings «Журнал» and «Задачи» and the legend of the office have a sign «?». A hint opens by mouse hover or by keyboard focus and closes when they go away; a press (by mouse, touch, Enter or space) pins it. On a phone and a tablet, a touch on «?» opens the hint: it is pinned at once, and a second touch on «?» or a touch in another place of the page closes it. A pinned one is closed by a second press on «?», a press beside it (which at the same time works on the page as usual) and Escape. No more than one hint is open; in narrow windows the hint stands at the bottom edge of the window.

Empty states: in an empty journal after the answer of the server — «Чтобы здесь появились события:» (so that events appear here:), four steps and the button «Как пользоваться»; in an empty office under the canvas — when the desks will appear; in «Задачи» without tasks and without rows of the main session — «Задач пока нет…» (no tasks yet…). With the first event they disappear.

### Where things are

The journal and the secret lie outside the repository — in the folder `~/.sai-pixel-office/` (rights 0700). Not in `sai/`, because `npm run snapshot` takes a snapshot of the whole `sai/`, and the journal would change with every session of any run. The server creates in it only these five files:

| File                  | Rights | What is in it                                                                                                      |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `events.jsonl`        | 0600   | the journal: one JSON line per event; only appended to, neither the server nor the page rewrites or cleans it      |
| `server-starts.jsonl` | 0600   | a line for each start of the server: the time and the number of journal rows at that moment; only appended to      |
| `write-secret`        | 0600   | the write secret (32 random bytes, 43 characters); created at the first start; the start command does not print it |
| `port`                | 0600   | the port on which the server works; written at every start, read by the hook                                       |
| `node-path`           | 0600   | the path to the Node under which the server works; written at every start, read by `hook.sh`                       |

The journal, the records of starts and the secret must be ordinary files: in their place the server does not read a link and does not write through it, so another's file will not change: at start the command prints an error and ends with code 1, and for a running server the journal answers with the error 500. The files `port` and `node-path` are replaced with new ones at start. If as the state folder one gives a folder where other files already lie (for example, the home folder), its rights will be narrowed to 0700.

The folder can be changed with the variable `SAI_PIXEL_OFFICE_DIR` (an absolute path), the same one for the server and for Claude Code; the key `--dir` alone is not enough (limit 12). The second variable is `SAI_NODE_FALLBACKS`: folders separated by a colon where `hook.sh` looks for Node 22 (for example, `<Node 22 folder>:<one more folder>`); if it is not set, `hook.sh` looks in the standard Homebrew folders for node@22 (they are written in `tools/src/pixel-office/hook.sh`).

### What of the hook input is stored and what is not

Only what is needed to see the tasks is stored: the time the hook fired (UTC, ISO 8601 with milliseconds), the source (`REAL` is set by the server at writing), the kind of event, `session_id` and, if they are in the hook input, `agent_id`, `agent_type`, `tool_use_id`, the identifier of the run from the Agent call (`tool_response.agentId`), `subagent_type` and the description of the task (`tool_input.description`, no longer than 100 characters; longer is cut). For the event `UserPromptSubmit` the kind of message is also stored (`prompt_kind`: an owner's message or a service one) and — only for an owner's message — its text after masking (`decisions/0011`; in detail — "Storing the text" below).

Not stored and not shown: the text of service messages, the text of the subagent's task, the answers of the model and results, inputs and outputs of tools, paths (`transcript_path`, `cwd` and others), the name of the session and everything else from the hook input. The journal lies on disk without encryption and is read without a login; in full texts there can be anything — pasted keys and passwords, personal data — so the stored text is masked, limited in length, and the storing can be turned off.

### Storing the text

By `decisions/0011` the journal stores two kinds of text and no more:

- **the text of the owner's message** (the event `UserPromptSubmit`) — after masking, up to 4 000 characters; longer is cut, and the row gets the note `prompt_truncated`;
- **the orchestrator's record "how I understood"** — up to 2 000 characters, after masking; it is written by the command `pixel-office-note` (below).

Not stored: the answers of the model, inputs and outputs of tools, messages of agents and service messages. A service message is recognised by the hook by a mark at the start of the text (`<system-reminder>`, `[SYSTEM NOTIFICATION`, `<task-notification`, `Another Claude session`, `This session is being continued`): such a row has only the kind `service`, and no text.

**Masking.** A found secret is replaced with the mark «[скрыто]» (hidden). Three places mask: the hook before sending, the command before sending, and the server before writing. The rules M1–M10: a PEM block (`-----BEGIN` … `-----END …-----`, without an end — to the end of the text); the value of the header `Authorization` to the end of the line; `user:password` in an address of the form `scheme://user:password@host`; keys `sk-…` (16 and more characters), `ghp_`, `gho_`, `ghs_`, `github_pat_` (20 and more characters), `AKIA…`/`ASIA…` (exactly 16 characters) — including right after `=`, `_`, `-` or `:` (`AWS_ACCESS_KEY_ID=AKIA…`, `K=ghp_…`), but not after a letter or a digit; three parts through a dot (like a JWT); the value after `Bearer`; the value after `token`, `secret`, `password`, `passwd`, `api_key`, `apikey`, `authorization` with `=` or `:` (without regard to case), including when the name is the end of a variable after `_` or `-` (`DB_PASSWORD=`, `GITHUB_TOKEN=`) and when the name is a JSON key in quotes (`"password": …`); a value in quotes (`'`, `"` or `` ` ``) after such a name and after `Bearer` is hidden together with the quotes — up to the same closing quote in the same line (a `\` before a quote escapes it) or, if there is none, to the end of the line: `password="primer 42"` → `password=[скрыто]`, an empty `password=""` does not change; a long random string — 32 and more characters of letters, digits and `_ + = -`, in which there is a lowercase letter and a digit, or an uppercase one, if it is not part of a path.

**A consequence of the rule M7.** Any piece of three parts through a dot is masked, not only a JWT. So in the stored text, instead of file names like `a.test.js` and version numbers like `22.21.1` (and names like `www.example.org`), «[скрыто]» can stand. Two parts (`panels.js`) and four (`127.0.0.1`) are not masked.

**Residual risk.** Masking is by patterns, so there is a residual risk. Not recognised: a secret in an arbitrary form with spaces; a secret in words («пароль — имя кота и год», password — the name of the cat and a year); a base64 secret with the sign «/» or «.»; a secret of only uppercase letters and digits; a secret shorter than 32 characters without a name from the rule M9 and without a prefix `sk-`, `ghp_`, `AKIA` and the like. A value in quotes after a name from M9 and after `Bearer` is now hidden. These stay not hidden:

- a name from M9 fused with another word without `_` or `-` before it (`mypassword=…`), and names outside the list of M9 (`SECRET_ACCESS_KEY=…`, `PRIVATE_KEY=…`, `pwd=…`, `api-key: …`) — their value is hidden only by the rule of the long string (32 and more characters, without «/» and «.»);
- a space before `=` or `:` (`password = …`) and a value after a space without a sign (`--password …`);
- in a value without quotes — the part after a quote inside (`password=ab"cd`: `cd` stays);
- a value in quotes continued on the next line — hidden only to the end of the first line;
- typographic quotes (« », “ ”) are not quotes for these rules;
- a value in escaped quotes (`curl -d "{\"password\":\"…\"}"` is not hidden at all, and in `password=\"…\"` it stays open);
- an assignment sign of two characters: in `password=>"x"` and `PASSWORD:="x"` only the sign after the first one is hidden, the value stays.

**A consequence of the rule M9.** A name at the end of a variable hides non-secrets too: `max_token=1000` → `max_token=[скрыто]`.

Do not paste secrets into messages; if you pasted one — erase the history (below).

**How to turn off.** `SAI_PIXEL_OFFICE_STORE_TEXT=0` — storing is turned off (any value except empty and `1` also turns it off). The hook then writes only the kind of the message, the command sends nothing and answers «хранение текста отключено» (storing of text is turned off), the server refuses a record with text. Important: set the variable SAI_PIXEL_OFFICE_STORE_TEXT both for the server and for Claude Code (in both places). If storing is turned off only for the server, and the Claude Code hook still sends `prompt_text`, the server answers 400 and the request event is lost entirely (a known risk).

**The orchestrator record.** A command from `tools/` (the example is made up):

    npm run pixel-office-note -- --text "сделать черновик раздела" --req REQ-NNN

The text is passed only through `--text`. Optional keys: `--req` (a requirement number of the form `REQ-NNN`), `--session` (the `session_id` of the session), `--request-time` (the time of the owner's message, ISO UTC with milliseconds). Without `--request-time` the server itself ties the record to the owner's message; without --session the tie goes to the last owner's message in the whole journal, and with two parallel sessions the record can land on another's message; ORCH does not pass `--session` (it does not see its own `session_id`), so this risk is accepted. The command goes only to `127.0.0.1` and to the port from the file `port`, waits for an answer no longer than 3 seconds and prints neither the secret nor the text of the record; code 0 — the record is accepted, or help, or storing is turned off; 1 — the server is not running or refused; 2 — an error in the parameters.

**The write paths.** There are two: `POST /api/events` (hook events) and `POST /api/note` (orchestrator records). Both are signed with one secret from `write-secret` and are accepted only on `127.0.0.1`. The source (`REAL` or `ORCH`) and the time of the orchestrator record are set by the server.

**How to erase the history.** Stop the server and delete `~/.sai-pixel-office/events.jsonl` (and with it `server-starts.jsonl`).

### How it is built

- In Sai the hooks are set only in `sai/.claude/settings.json` (a copy of the handlers in the project settings of the folder where the owner's sessions begin is only by `decisions/0007`, it is not part of Sai): one handler each for the events `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Stop`, `SubagentStart`, `SubagentStop` and `PostToolUse` (for the tool Agent). A handler is a command, synchronous, with a `timeout` of 4 seconds.
- The command starts `tools/src/pixel-office/hook.sh`, and that finds Node 22: first the path from the file `node-path`, then `node` from `PATH`, if it is Node 22, then the folders from `SAI_NODE_FALLBACKS`. If there is no Node 22, the hook ends silently.
- `hook.js` sets the time by the clock of the computer at the moment of firing, leaves only the allowed fields, signs the request with the secret from the file (HMAC-SHA256; the secret itself is not sent over the network) and sends it to `127.0.0.1`. At any failure — the server is not running, does not answer, refused, there is no secret — the hook ends with code 0, writes nothing to stdout and fits in 2 seconds: the event is lost, the session does not notice it.
- The server listens only on `127.0.0.1` and answers only requests with the header Host `127.0.0.1:<port>` or `localhost:<port>`. There are two write paths — `POST /api/events` (hook events) and `POST /api/note` (orchestrator records, "Storing the text") — and both require a signature; an event whose time differs from the server clock by more than 60 seconds is rejected. The page only reads (`GET`).
- How to tell the answers of the Pixel Office handlers in the stream `claude -p --output-format stream-json --verbose --include-hook-events`: the handler first of all writes the line `sai-pixel-office` to stderr, and it gets into the field `stderr` of the message `hook_response`. The selection: `jq 'select(.type=="system" and .subtype=="hook_response" and (.stderr|startswith("sai-pixel-office")))'`.

### Limits

1. A task cannot stay «в работе» for longer than 60 minutes without trusted events of its session: if the end event is lost, after 60 minutes it becomes «нет свежих данных» (not the end of work and not an error), and at a server start — «сервер перезапускался, события не записывались»; next to it are shown the time the task began, the time of the last event of its session and, while there is no data, its age.
2. Events are recorded only while the server is running.
3. The page can be read without a login by any **account** of this computer through `127.0.0.1`; that is why only what is needed is stored.
4. The reading rule is detection and not protection: **one written-in row** "from the future" is enough to mark as "not from hooks" the genuine rows that came after it with a time earlier than its time by more than 2 minutes; the mark is removed when there become one more such rows than written-in ones, and if they no longer come — it stays **forever**. A direct write into the journal file on behalf of the owner is not forbidden by technique — it is forbidden by the mandate (bar item R2).
5. A turn woken by background work is shown as «Основная сессия — обрабатывает запрос»; service messages differ from the owner's messages only by the mark at the start of the text ("Storing the text"), a message without such a mark is counted as the owner's message.
6. For a subagent started in the foreground the description appears after its end (background starts — by default — get it at once).
7. The event `Stop` does not come on an interruption by the user and on an API error: the row of the main session stays «обрабатывает запрос» until the next request, the end of the session or a server start; after the next request or the end of the session it is shown as «окончание не записано», after a server start — as «сервер перезапускался, события не записывались», and if there are no events of the session for more than 60 minutes — as «нет свежих данных». If the end of an answer still comes later than a server start or a pause (the turn went while the server was stopped), the row becomes «закончила работу, итог не записан»; later than the next request or the end of the session — it does not.
8. The hook runs code with the rights of the owner (a property of Claude Code hooks); a `-p` session counts the folder as trusted.
9. If the clock of the computer is set back by more than 2 minutes, the reading rule can mark as "not from hooks" genuine rows near the place of the change, and they will disappear from the tasks and the office. A trusted hook row with a time in the future (the clock went forward and came back) is counted as fresh: a negative age equals zero (criterion 1 of REQ-042), so the session stays «Идёт» and the task «в работе» until the clock reaches that time, while the genuine rows after it are marked "not from hooks"; only the holder of the write secret can write into the journal.
10. While the browser tab is hidden, the page may update less often (browsers slow timers); when the tab comes back the polling goes at once.
11. If you delete or cut `events.jsonl`, delete `server-starts.jsonl` together with it.
12. A state folder other than `~/.sai-pixel-office/` is set with the variable `SAI_PIXEL_OFFICE_DIR` — the same one for the server and for Claude Code; the key `--dir` alone is not enough: the hook does not see it, and events are lost (the command prints a warning).
13. A journal of hundreds of thousands of rows (about 700 000 and more) the page will not load: the first load, like any request of the page, is limited to 3 seconds (100 000 rows load in about 0.4 s). How to remove the journal — item 11.
14. The age of the last event and the transition to «нет свежих данных» are counted by the page by the clock of the computer on which it is open (decision `0052`). If the page is open through a port forward on another computer with a different clock, the age and the moment of the transition shift by the size of the difference.
15. The plain-words name of a role is shown only for Sai roles of the kind «Sai … (CODE)» with a code from the table `ROLE_NAMES` (decision `0055`); a role from another set of agents with a similar code is shown by its own name, without translation.
16. The journal and the card do not know the actions of an agent except the start, the end and the handover of a task: reading files, commands, edits, messages between agents, errors and waiting for a person are not reported by the hook.
17. With an open row of filters or with the note «Задача», the journal list is lower, and opening a long event may need scrolling to see «Чего это не доказывает» in full (decision `0058`, addition 2, item 3).
18. There is no hint on the canvas: if a role name outside the table `ROLE_NAMES` is very long, the label at the desk and the row of the board are squeezed (decision `0059`, item 3), and the full name is visible in the legend button, in the block «Сейчас», in the panel «Задачи» and in the title of the card.
19. The place and the height of the full list «Показать всех» are set by CSS anchors (at the edges of the block «Сейчас» and under the real height of the header). In browsers without CSS anchors (for example, Safari before version 26) the list stands by fallback values: across the whole page width with a 1 rem margin, and its height is counted from the usual height of the header (in a narrow window — from a header of about 17 rem); if the header is taller, the last rows of the list can go beyond the edge of the window.
20. The tour memory «pixel-office-tour» is separate for every address and browser: on another port, in another browser or after the site data is cleared, the invitation will be shown again; without the browser storage — at every page load.

## Sai Team — the core

The core of Sai Team is the first part of the product (`decisions/0015-product-virtual-team-start.md`, design `docs/design/REQ-009-team-core.md`): a project with a goal, tasks and memory, which lives in files on this computer, survives an emergency stop and is read by one truth — the event journal. This is a core **without an interface and without an executor**: it does not start agents (that is REQ-010) and does not manage tasks (that is the engine, REQ-013). The code is in `tools/src/team/`, Node 22 without run-time dependencies.

### Where the data is and the rights

The data folder is `~/.sai-team`; another folder is set by the variable `SAI_TEAM_HOME` (only an absolute path; an empty or relative one is refused with `E_HOME`). Tests and probes work only with a temporary `SAI_TEAM_HOME`. In the folder there is a separate folder per project with a name-id of the kind `p-20261006-a1b2c3` (the id is made by the core, not by the user's text):

- `events.jsonl` — the event journal, the only truth about the project;
- `files/` — result files (written only by the core);
- `work/` — the working folder of the executor: the agent writes into it, the core only reads it; its content is not masked (these are the agent's drafts in a 0700 folder), and a file from `work/` gets into a result only through the core and already masked;
- `scenario.json` — only in test projects (the executor `scripted`): a byte-for-byte copy of the scenario file;
- `writer.lock` — the lock of the writer, present while the right to write is taken.

Rights: folders 0700, files 0600. If the rights are wider, the writer (the write command) narrows them to 0700/0600 — only after it has taken the lock and checked the journal — and says so in `notices`; the read commands do not change rights but warn (`warnings` in the output and the same line in stderr).

### What is stored

The goal of the project, tasks, events, the conversation (messages `CHAT`), the project memory and result files. All text fields of events and the content of result files pass through `maskSecrets` from `tools/src/pixel-office/mask.js` before writing (the rules of `decisions/0013`): keys, tokens and passwords are replaced by the mark `[скрыто]` (hidden). Not masked are service values that are checked by a pattern: ids, codes, numbers and sha256 hashes (the hash is counted by the core itself). The names of result files are not masked, they are checked by a pattern: Latin letters, digits, `.`, `-`, `_`, up to 80 characters, without `..` and not starting with a dot (masking would spoil ordinary names like `plan.v2.md`). Residual risk: a file name that looks like a key is stored as it is. From `work/` only UTF-8 text files are accepted into a result, binary ones are rejected (`E_WORK_FILE`); links and paths with `..` too.

There is no derived state file: the state of a project is assembled by replaying `events.jsonl`. Results are not overwritten (`E_FILE_EXISTS`).

### One writer and "the project is busy"

Exactly one process can write into a project — the writer. The right to write is the lock file `writer.lock` with the pid of the writer, created atomically. While the right is held by another live process (not the engine — with a running engine, commands go through its channel, see "Sai Team — the engine"), any write command (`say` and the commands of REQ-010) is refused with `E_PROJECT_BUSY: Проект занят другим процессом (pid N)` (the project is busy with another process) and exit code 1, and the project files do not change. The read commands do not take the lock and always work. A lock whose process no longer exists (an emergency stop) is stale: the next writer removes it and records an event about it.

Residual risks: the pid of a dead writer can go to another live process — then the project is counted as busy while that process is alive (a false "busy", not two writes); a race of three processes on one stale lock can leave a writer without the lock — it learns about this at the next write (`E_LOCK_LOST`), but it can write one line to the journal in that window.

### Recovery after a crash

Recovery goes **by the state of the journal**, and not by who removed the lock: the writer, having taken the lock, recovers the project if the last line of the journal is cut **or** the journal has open runs or tasks «в работе». A project closed in the normal way (runs closed) gets nothing. Only the writer does it, right after taking the lock:

- a cut last line of the journal is dropped (the file is truncated to the last whole line), the journal is recovered — this is the event `JOURNAL_RECOVERED` with the line number and the number of dropped bytes, and a line in `notices`;
- unclosed agent runs are closed as interrupted; tasks «в работе» get the status «прервана» (interrupted), and a task «на проверке» (under review) only if the recovery closed its open run; a task «на проверке» without an open run stays «на проверке»;
- a project that was in work or in planning goes on a pause «прервано аварией — возобновите проект» (interrupted by a crash — resume the project) if something was interrupted: the work goes on only after a resume;
- the recovery package (closing the runs, interrupting the tasks, the pause) is written whole or not written: one record, one `fsync`, on a failure the journal returns to its earlier size;
- a spoiled line that is not the last one — the project is not opened for writing (`E_CORRUPT` with the line number); nothing is skipped silently.

A broken writer (a write failure) does not remove the lock at closing until the process exits: the project stays "as after a crash". The next opener either recovers it (the process is gone) or gets `E_PROJECT_BUSY` while that process is alive. A healthy writer removes the lock. The same process at the next opening of the project removes the lock of its own closed broken writer and recovers the project by the journal (decision 0026); other processes get `E_PROJECT_BUSY` ("busy") while that process is alive.

The read commands, with a cut last line, show the state by whole lines and write that the last line is not finished; the files do not change.

Residual risks (`decisions/0017-team-core-storage.md`):

- the spend of a run is lost if the process died before writing the result of the run and the spend (S2): the accounted is less than the actual by no more than the ceiling of such a run;
- the death of the process or of the power in the middle of writing a package leaves the start of the package without a pause of the project (F-1);
- in a race of three processes on a stale lock, the loser can for a short time consider itself the writer (`EEXIST` of the lock), it learns about this at the next write (`E_LOCK_LOST`);
- manual deletion of the lock: if `writer.lock` is deleted by hand (for example, after `E_LOCK_BAD`) or the writer closed in the normal way without closing its run, the core interrupts nothing — the unclosed run stays open, and the task cannot be started again.

### The catalog of roles

Ten roles (`tools/src/team/roles.js`): Руководитель проекта (project manager), Бизнес-аналитик (business analyst), Исследователь (researcher), Финансовый аналитик (financial analyst), Юрист (lawyer), Маркетолог (marketer), Дизайнер (designer), Разработчик (developer), Проверяющий (QA) (reviewer), Специалист поддержки (support specialist). The internal role codes and the internal fields of the catalog are not shown in the output of commands and in phrases; events are shown by phrases in human language (`tools/src/team/language.js`), for example «Аналитик изучает данные» (the analyst studies the data).

### How to delete a project

There is no delete command: a project is deleted by hand — the folder `~/.sai-team/<id>/` (or `$SAI_TEAM_HOME/<id>/`). The folders `.creating-*` are leftovers of an interrupted creation of a project; reading skips them, and they can also be deleted by hand. Residual risk of creation: if in the fraction of a second between the check and the rename someone creates an empty folder with the same random id, it will be replaced by the new project (there is nothing to lose in it).

### Commands

From the folder `tools/` (the ids in the examples are made up):

    npm run team -- projects
    npm run team -- project p-20261006-a1b2c3
    npm run team -- events p-20261006-a1b2c3 --limit 10
    npm run team -- events p-20261006-a1b2c3 --after 10 --limit 10
    npm run team -- say p-20261006-a1b2c3 --text "Добавьте сравнение цен"

- `projects` — the list of projects: the goal, the status, the progress "done out of all" (without percents; a project without tasks has no progress);
- `project <id>` — the project with tasks, statuses, progress, memory, files and the conversation;
- `events <id> [--after N] [--limit M]` — the journal by pages: `--limit` from 1 to 200 (50 by default), the next page is `--after <next_after>`; each event has a phrase;
- `say <id> --text "<text>"` — a message of the user into the conversation of the project (up to 4000 characters; longer is refused with `E_TOO_LONG`).

The output is one JSON line in stdout. Exit codes: 0 — success; 1 — a refusal on the merits (for example, `E_NOT_FOUND: Проект не найден` (project not found), `E_PROJECT_BUSY`, `E_CORRUPT`, `E_DISK`); 2 — wrong arguments (`E_USAGE`); 3 — an internal error (`E_INTERNAL`). On an error stdout is empty, and stderr has one line `<CODE>: <message>` without a stack trace.

The check is the same one command: `cd tools && npm run check`.

## Sai Team — executors

An executor performs one task of a Sai Team project on behalf of a role (design `docs/design/REQ-010-agent-executors.md`, decision `decisions/0015-product-virtual-team-start.md`). The code is `tools/src/team/executor.js`, `tools/src/team/runner.js` and the folder `tools/src/team/executors/`; Node 22 without run-time dependencies. The journal is written only by the core through the writer of the project: the executors write nothing into the journal themselves.

### The interface `run`

`run(request, io)` is one attempt at a task, one process, without repeats. Input: the project (the executor, the ceiling and the spend), the role, the task, the number of the attempt, the context (the goal, the memory, the results of the dependency tasks, remarks), the limits (the ceiling of this run, the timeout, the working folder `work/` of the project) and the schema of the answer. Output: the result of the attempt (`ok`, `failed`, `timeout`, `cancelled`, `invalid_output`, `not_found`, `network`), a short summary, result files, memory records, the spend (`cost_usd` or "did not come") and a constant text of the reason of a failure. In the course of work the executor reports the activity («изучает материалы» (studies the materials), «готовит документ» (prepares a document)…) at the moment it sees it.

A refusal before the start: if a condition is not met, `run` throws an error (`E_EXECUTOR`, `E_REAL_RUNS_OFF`, `E_NO_BUDGET`, `E_WORK_DIR`, `E_BUDGET_EXHAUSTED`, `E_SCENARIO`) before any action — no process is created, the journal does not change. The conditions are checked by `run` itself, so they cannot be bypassed by a direct call. The answer of the executor is checked against the schema once more on our side: an answer outside the schema is the result `invalid_output` («Ответ исполнителя не соответствует схеме», the answer of the executor does not match the schema), the result is not accepted. From the answer only the fields of the schema are taken (`summary`, `files`, `memory`): the agent's text changes neither the executor, nor the ceiling, nor the role, nor the statuses.

### Executors

- `claude-cli` — the only real executor: one attempt is one Claude Code process in print mode. The executor of a project is set at creation (`new`, `claude-cli` by default) and does not change afterwards; if `claude-cli` did not start, a test executor is not substituted for it.
- `scripted` — a test executor, **only for tests**: it does not call the model, spends nothing and writes nothing on disk, but plays a scenario. The scenarios are in `tools/test/fixtures/team/`; the command `new --executor scripted --scenario <file>` puts a byte-for-byte copy of the scenario into the project folder (`scenario.json`), and `run-task` reads only this copy. An honest note: in such a project the executor in the data is `scripted`, and to the phrases of tasks, runs and activity the words « — тестовый исполнитель» (a test executor) are added.

### Conditions of real runs

A real Claude Code run begins only if all conditions are met:

- the variable `SAI_TEAM_REAL_RUNS=1` (exactly `1`; `true`, `yes`, `0` or empty — the runs are turned off, a refusal `E_REAL_RUNS_OFF`);
- the project has a cost ceiling above 0 (otherwise `E_NO_BUDGET`; the command `new` does not create a project without a ceiling);
- the remainder of the project ceiling is above zero (otherwise `E_BUDGET_EXHAUSTED` and one line `RUN_REFUSED` in the journal);
- `SAI_TEAM_CLAUDE_BIN` — the absolute path to the executable file of Claude Code. In the PATH of this computer there is no `claude`: the file lies inside the editor extension, and the folder changes with every version. The path is set by hand (`<path> --version` must answer) and is updated after the extension is updated; the code does not guess the path. If it is not set — `claude` is looked up in PATH; if it is set as not an absolute path — `E_CONFIG`.

Other settings:

- `SAI_TEAM_WEB=0` turns off WebSearch and WebFetch for the Researcher (another value or not set — the Researcher has the network);
- `SAI_TEAM_TASK_TIMEOUT_MS` — the timeout of one attempt, an integer from 1000 to 86 400 000 ms, 1 200 000 by default (20 minutes);
- `SAI_TEAM_RETRY_DELAY_MS` — the pause before a repeat, an integer from 0 to 600 000 ms, 10 000 by default;
- `SAI_TEAM_RUN_CAP_USD` — the ceiling of one run in dollars, from 0.01 to 100000, up to 6 digits after the point (by default — a quarter of the project ceiling).

A wrong value is `E_CONFIG: Неверная настройка <VARIABLE_NAME>` (wrong setting) with code 2; the values of settings are never printed or written.

### How Claude Code is started

The text of the task is passed through stdin, not as an argument: it cannot become a flag or a command and is not visible in the process list. The process is started without a shell (`shell: false`), in its own process group, with the working folder `work/` of its project. The arguments are in a constant order:

    -p --output-format stream-json --verbose --max-budget-usd <потолок запуска>
    --json-schema <схема ответа> --tools <инструменты роли> --allowedTools <те же>
    [--disallowedTools <запреты WebFetch> — только когда у роли есть WebFetch]
    --permission-prompts none --restricted --safe-mode --strict-mcp-config
    --no-session-persistence --append-system-prompt <промт роли>

The lists are passed as one argument separated by commas. Never passed: `--add-dir`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, `--permission-mode`, `--bare`, `--agents`, `--agent`, `--mcp-config`, `--plugin-dir`, `--plugin-url`, `--settings`, `--worktree`, `--bg`, `--resume`, `--continue`, `--model`, `--file`, `--cloud`.

The environment of the process is only the variables `PATH`, `HOME`, `USER`, `LOGNAME`, `LANG`, `LC_ALL`, `LC_CTYPE`, `TMPDIR`, `TZ`, `CLAUDE_CONFIG_DIR` (if set). Not passed: `ANTHROPIC_API_KEY`, other keys and tokens, all `SAI_TEAM_*` and `SAI_TEST_*`: the login of Claude Code is by the owner's subscription. The error output of the process (stderr) is not saved or printed; the Claude Code session is not saved to disk.

The `stream-json` output is parsed "by shape with a margin": a line of an unknown kind is skipped and counted, the task does not fail because of it; a line that is not JSON, or the absence of the final line, is the result `invalid_output`. There is no documentation of the format in the installed package: the samples in `tools/test/fixtures/team/` are marked with their source and will be compared with the first recorded real run.

### Tools of the roles

| Role                                      | Tools                                              |
| ----------------------------------------- | -------------------------------------------------- |
| Руководитель проекта (project manager)    | Read, Write, Edit, Glob, Grep                      |
| Бизнес-аналитик (business analyst)        | Read, Write, Edit, Glob, Grep                      |
| Исследователь (researcher)                | Read, Write, Edit, Glob, Grep, WebSearch, WebFetch |
| Финансовый аналитик (financial analyst)   | Read, Write, Edit, Glob, Grep                      |
| Юрист (lawyer)                            | Read, Write, Edit, Glob, Grep                      |
| Маркетолог (marketer)                     | Read, Write, Edit, Glob, Grep                      |
| Дизайнер (designer)                       | Read, Write, Edit, Glob, Grep                      |
| Разработчик (developer)                   | Read, Write, Edit, Glob, Grep                      |
| Проверяющий (QA) (reviewer)               | Read, Write, Edit, Glob, Grep                      |
| Специалист поддержки (support specialist) | Read, Write, Edit, Glob, Grep                      |

No role has Bash or the running of commands. The prompt of each role is internal (`tools/src/team/role-internal.js`) and is not shown to the user.

### The network of the Researcher

The Sai Team code itself does not go to the network. Outgoing requests are made by Claude Code with the tools WebSearch and WebFetch, to addresses chosen by the model; Sai cannot check every address before the request. Protection: read only (there are no tools for sending outside); forbidding rules `WebFetch(domain:…)` for `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`, `169.254.169.254`; the ceiling `--max-budget-usd`; the timeout; the switch `SAI_TEAM_WEB=0`; without `SAI_TEAM_REAL_RUNS=1` there is no network at all. Residual risk: addresses of private networks (10/8, 172.16/12, 192.168/16), names that point to internal addresses, and a leak of the task context through the address of a request are not closed by the rules. A network failure is recognised by an error in the WebFetch/WebSearch result together with the failure of the attempt; the phrase of such a run is «Нет доступа к сети» (no access to the network), the result of the task after all attempts is «<роль>: нет доступа к сети, задача не получилась» (<role>: no access to the network, the task failed). A repeat is announced only by the phrase «<роль> попробует ещё раз» (<role> will try again), and it is written only when a repeat will really happen.

### Repeats, timeout and processes

Temporary failures (an executor error, a timeout, a wrong output, a network failure) are repeated no more than 2 times (3 attempts in all) with the pause `SAI_TEAM_RETRY_DELAY_MS`; a task has at most one process at a time — the next attempt begins only after the earlier process and its group are stopped. The timeout of an attempt is 20 minutes: on a timeout or a cancel (`SIGTERM`/`SIGINT` of the command `run-task`) SIGTERM is sent to the process group, and after 3 s — SIGKILL. If the group did not go away, there is no repeat («Не удалось остановить процессы исполнителя», the processes of the executor could not be stopped). «Исполнитель не найден» (the executor was not found) is not repeated. Residual risk: a descendant that left the group (`setsid`) is not stopped; on `kill -9` of the command `run-task` itself the Claude Code process works to its end (it is limited by `--max-budget-usd`), and the next writer closes the run as interrupted.

### The ceiling per run and the accounting of spend

Every run gets `--max-budget-usd` — the lesser of the remainder of the project ceiling and `SAI_TEAM_RUN_CAP_USD`; if the variable is not set — the lesser of the remainder and a quarter of the project ceiling (so with any ceiling there is enough for at least 3 attempts of one task). After every attempt in which a process was started, the spend is written to the journal (`BUDGET_SPENT`): the one reported by the executor (`accounted: reported`). The rule of accounting for a run without a spend: if the spend did not come (no final line, the process was stopped by a timeout or a cancel), the attempt is accounted for by the worst case: the whole ceiling of this run, not the whole remainder, `accounted: assumed`. A repeat begins only if the remainder allows the next run; otherwise there is no repeat, the journal has `RUN_REFUSED`, and the task is «<роль>: потолок расходов исчерпан, задача остановлена» (<role>: the spending ceiling is exhausted, the task is stopped).

### Result files

The files that the agent named in its answer are accepted by the core: the path only inside `work/` (without `..`, absolute paths and links), only UTF-8 text up to 5 MiB; first all files are checked, then they are written. The name of a result is `t-NNNN-N-<name>` (task, attempt, file name), the content is masked. The source of an accepted file in `work/` is deleted after the acceptance — an unmasked copy does not stay; the reviewer and the dependent tasks get in their task the correspondence "original name → accepted name", and the source is still deleted; files not named in the answer do not get into the result and stay in `work/`. A file is not accepted — the task is «не удалась» (failed) with the reason «файл с результатом не удалось принять» (the result file could not be accepted). After a successful attempt the task is «на проверке» (under review): «готово» (done) is set only by the check (the engine, REQ-013).

### Commands

From the folder `tools/` (the ids in the examples are made up):

    npm run team -- new --goal "Сравнить цены трёх поставщиков" --budget 2
    npm run team -- add-task p-20261006-a1b2c3 --role researcher --text "Собрать цены" --done-when "Таблица цен с источниками"
    SAI_TEAM_REAL_RUNS=1 SAI_TEAM_CLAUDE_BIN=/абсолютный/путь/claude npm run team -- run-task p-20261006-a1b2c3 t-0001

(The Russian example texts mean: "Compare the prices of three suppliers", "Collect the prices", "A table of prices with sources", "/absolute/path/claude".)

- `new --goal "<goal>" --budget <usd> [--executor claude-cli|scripted] [--scenario <file>]` — creates a project; the ceiling is above 0 and not above 100000, up to 6 digits after the point; `--scenario` is only with `--executor scripted` and is required for it;
- `add-task <id> --role <code> --text "<description>" --done-when "<criterion>"` — adds a task of a role; the role codes: `project_manager`, `business_analyst`, `researcher`, `financial_analyst`, `lawyer`, `marketer`, `designer`, `developer`, `reviewer`, `support`;
- `run-task <id> <task>` — performs the task with repeats; the first `SIGTERM`/`SIGINT` cancels it (the task is «прервана», interrupted).

The output is one JSON line in stdout. Exit codes: 0 — success; 1 — a refusal on the merits (for example, `E_REAL_RUNS_OFF`, `E_NO_BUDGET`, `E_BUDGET_EXHAUSTED`, `E_EXECUTOR_NOT_FOUND`, `E_TASK_FAILED: Задача не получилась: <причина>` (the task failed: <reason>), `E_TASK_CANCELLED`, `E_TASK_STATE`, `E_PROJECT_STATE`, `E_SCENARIO`, `E_DISK`, `E_PROJECT_BUSY`); 2 — wrong arguments or settings (`E_USAGE`, `E_CONFIG`); 3 — an internal error (`E_INTERNAL`). On an error stdout is empty, stderr has one line `<CODE>: <message>` without a stack trace; the events written before the refusal stay in the journal — this is the truth about the attempts.

## Sai Team — the engine

The engine leads a project from the goal to the result (design `docs/design/REQ-013-team-engine.md`, decision `decisions/0020-team-engine-channel.md`): the Project Manager makes a plan, the tasks are performed in parallel, the result of each is checked by a separate run of the Reviewer, important actions wait for the user's decision, the spending ceiling is kept, and at the end the goal is compared. The code is `tools/src/team/engine/`; Node 22 without run-time dependencies, without network modules. The engine is a long-living process of the command `start` or `resume`: while it works, it holds the right to write the project (the lock `writer.lock` with the field `"holder":"engine"`), and it writes the journal only through the writer of the core.

Checked by tests only with the test executor `scripted` and with a fake executable file of Claude Code; the real Claude Code has not yet been started by the engine (this is the UAT acceptance by the owner's consent).

### How a goal becomes a plan

The Project Manager gets the goal, the roles of the catalog, the tasks of the project and the last messages of the user, and answers with a list of tasks: a role from the catalog, a description, a criterion of readiness, dependencies, the sign «критическая» (critical). The engine checks the plan in order: the shape of the answer, no more than 40 tasks in the plan (and 200 in the project), roles only from the catalog, dependencies only on tasks of this plan or of the project, without cycles. A plan with a fault is rejected with a reason, and the Project Manager gets **one repeat attempt** with this reason in the input; a second failure — the project waits for the user's decision («Не удалось составить план», the plan could not be made), and there are no tasks from bad plans.

The planner sees the accepted files of the project (the original names and the tasks that handed them in). A task whose text or criterion of readiness names such a file gets it: if the planner did not give a dependency, the engine adds by itself a dependency on the task that handed in the file.

### Parallelism

No more than two tasks are performed at the same time; another limit is `--parallel 1`, `2` or `3` of `start` and `resume`. A task begins only after all its dependencies are «готово». The plan and the comparison of the goal go when no tasks are in work.

### The context of a task

The input of a task: the goal of the project, the memory of the project (the last records), the result files **only** of the tasks it depends on (the engine completes this dependency when it checks the plan, see "How a goal becomes a plan"), and remarks (the remarks of the Reviewer on a repeat, the text of a change from the user, for a critical task — the requirement to prepare only a draft). The agent does not get the paths of the core files (`events.jsonl`, `writer.lock`, `inbox/`).

### The check of a result

The result of a task is checked by **a separate run** of the Reviewer with its own run number; «готово» only after the check has «прошла» (passed). If it did not pass — the task is repeated with remarks (three runs of one role in all), then the Project Manager chooses another role from the catalog, and it too has three runs; if it also did not manage — the task waits for the user's decision. A failure of the task itself after the repeats of the executor is also a question to the user; the other tasks are brought to their result meanwhile.

### Approvals

A critical task (sending, publishing, paying and any action outside) prepares only a draft as a file and after the check waits for the user's decision:

    npm run team -- answer p-20261006-a1b2c3 t-0002 approve
    npm run team -- answer p-20261006-a1b2c3 t-0002 change --text "Сделайте тон дружелюбнее"
    npm run team -- answer p-20261006-a1b2c3 t-0002 reject

(The Russian example text means "Make the tone friendlier".)

`approve` marks the task «готово» — **the engine does not perform the action outside** (this is recorded in the journal). `change` starts the task again with the user's text in the input. `reject` closes the task; the tasks that depended on it are closed too, and the Project Manager learns about the refusal at the next round of the plan. To a task that «не получилась» (failed) one can answer `change` or `reject`, but not `approve`.

### The spending ceiling

Every run gets its own ceiling not above the remainder of the project, and parallel runs **reserve** the ceiling: the sum of the ceilings of open runs is not above the remainder. When the ceiling is not enough for the next run, the project waits for a decision («Достигнут потолок расходов», the spending ceiling is reached), there are no new runs. The ceiling is raised with the command `budget` (the new value is above what is already spent), and the continuation is `resume`; while the ceiling is still not enough, `resume` answers with a refusal.

### Completion

When all tasks are «готово» (or closed by the user, with at least one «готово»), the Reviewer compares the results with the goal. The comparison passed — the project is «выполнен» (finished). It did not pass — the Project Manager adds tasks (a round of extra tasks, no more than two rounds); after the second one the project waits for the user's decision. «Выполнен» without a passed comparison of the goal is impossible.

### Pause, resume, stop, Ctrl-C

`pause` — new tasks do not begin, those in progress are brought to the result; `resume` — the work goes on. `stop` — all runs are interrupted (their processes are stopped), the tasks are «прерваны», the project is «остановлен» (stopped) for good. Ctrl-C (`SIGINT`/`SIGTERM`) in the terminal of the engine — a pause and exit; one can continue with `resume`. On a pause and while waiting for a decision the engine does not exit and accepts commands.

### Recovery after a crash

If the engine process is killed, the next `resume` (or any command) removes the stale lock, the core interrupts the unclosed work, and the engine begins the interrupted tasks again (the attempt is counted). A task does not become «готово» twice. Messages that lay in the channel at the moment of the crash are not performed: the new engine deletes them and records an event with their number and identifiers, and to the waiting sender it answers «Сообщение не выполнено: проект перезапускался. Повторите команду» (the message was not performed: the project was restarted. Repeat the command). Two engines for one project cannot be: the second `start` gets «Проект сейчас ведёт запущенный процесс Sai Team (pid N)…» (the project is now led by a running Sai Team process).

### The channel of commands

While the engine works, the commands `say`, `answer`, `pause`, `resume`, `stop`, `budget` from another terminal are passed to it through the folder `inbox/` of the project: the command puts a message as a file (0600, no larger than 64 KiB, the texts are already masked) under the next number, the engine takes it within 100 ms, checks it, writes an event and answers with a confirmation. The command waits for the confirmation no longer than 10 s. No confirmation — the command reports «не подтверждено» (not confirmed) and **does not write or repeat by itself**: if the engine did not take the message, it is withdrawn and there are no events; if it took it, the event is written no more than once, check the journal (`events`). `add-task` and `run-task` with a running engine answer with a refusal without writing. Without the engine all these commands write into the journal themselves, as before.

### Engine commands

From the folder `tools/` (the ids in the examples are made up):

    npm run team -- start p-20261006-a1b2c3 --parallel 3
    npm run team -- say p-20261006-a1b2c3 "Сделайте упор на аренду"
    npm run team -- pause p-20261006-a1b2c3
    npm run team -- resume p-20261006-a1b2c3
    npm run team -- budget p-20261006-a1b2c3 5
    npm run team -- stop p-20261006-a1b2c3

(The Russian example text means "Put the stress on rent".)

- `start <id> [--parallel N]` — starts the engine of a project in the status «создан» (created) and works to the result; the output at exit is the project and its status;
- `resume <id> [--parallel N]` — continues a project on a pause or waiting for a decision (without an engine it becomes the engine itself, with a running engine — through the channel);
- `pause <id>`, `stop <id>`, `budget <id> <sum>`, `answer <id> <task> approve|change|reject [--text "…"]`, `say <id> "<text>"` (or `say <id> --text "<text>"`) — the output is the recorded event.

The exit codes are the same: 0 — success; 1 — a refusal (for example, `E_NOT_STARTABLE`, `E_ENGINE_RUNNING`, `E_ALREADY_RUNNING`, `E_STOPPED`, `E_OPEN_QUESTION`, `E_BUDGET_NEEDED`, `E_BUDGET_LOW`, `E_CHANNEL_TIMEOUT`, `E_CHANNEL_UNCONFIRMED`); 2 — wrong arguments (`E_USAGE`, for example `--parallel: число 1, 2 или 3` (the number 1, 2 or 3)); 3 — an internal error.

### Residual risks

- The engine took a message and crashed, or the confirmation was late (for example, during a long stop of the processes by `stop`) — the command reports «не подтверждено», the event is written zero or one time; a repeat is a new action of the user.
- The delay of accepting a message is up to 100 ms (the polling of the folder).
- A false `holder` in the lock or a file in `inbox/` can be planted only by the same user (the folders are 0700).
- The limit "no more than 100 messages in `inbox/`" at the sender is a soft protection and not a guarantee; the cleanup and the acceptance work with any number of files.

## Sai Team — the interface

A page for a person who does not program: the list of projects, a new project (the goal in one phrase and the spending ceiling), the project page, the chat, the cards of a task and of an executor (design `docs/design/REQ-011-team-web.md`, decisions `decisions/0024-team-web-location.md` and `decisions/0025-team-web-server.md`). The server code is `tools/src/web/`, the page is `tools/src/web/public/`; Node 22 without run-time dependencies. Everything shown the server derives from the journal of the project by replaying it on every request, it has no state file of its own; it writes only through the core and the engine.

### Start

From the folder `tools/`:

    npm run team-web

The command prints one line with a link to the page — by default `Sai Team: http://127.0.0.1:4781/` — and works until it is stopped. Parameters:

- `--port <number>` — another port (0 means any free one); if the port is taken, the command says so and offers another;
- `--executor scripted --scenario <file>` — the test executor by a scenario file, **only for tests and acceptance**; such projects are marked on the page «тестовый исполнитель» (test executor). Without parameters, new projects are led by Claude Code (`claude-cli`).

Real Claude Code runs on this computer are turned on by the variable `SAI_TEAM_REAL_RUNS=1` (as for `npm run team`); without it the server does not create a project on `claude-cli` and explains this on the page. The data folder is the same as for `npm run team` (`SAI_TEAM_HOME` or `~/.sai-team`).

### Security

The server listens only on `127.0.0.1` and answers only to the address `127.0.0.1:<port>` or `localhost:<port>`. Creating a project, writing into the chat and pressing the project buttons is possible only from its own page: a write request is checked by the source (`Origin`), the type of the body and the key of the page. The key is created anew at every start and lives only in the memory of the server; a page opened before a restart will ask to refresh. The border of trust is the users of this computer (as in Pixel Office).

### The project page: six questions

1. **Что происходит** (what is happening) — the last five phrases of the journal in plain words.
2. **Кто занимается** (who is working) — the roles that have a task in work or under review.
3. **Когда будет готово** (when it will be ready) — the rule of the term below.
4. **Есть ли проблема** (is there a problem) — the tasks «не удалось» with the reason, and the reason why the project waits for your decision.
5. **Нужно ли что-то от меня** (is anything needed from me) — the number of questions waiting for an answer, and a jump to each. A question can be answered in the window of decisions (a separate requirement); a message in the chat does not close a question.
6. **Результат** (the result) — the result files with the task and the role.

The progress is «N из M задач» (N of M tasks), without percents.

### The rule of the term

- The project is finished, stopped or failed — its status is shown in words.
- The duration of a done task is from its first run to the event «готово». While there are fewer than two measurable durations — «срок пока не оценить» (the term cannot be estimated yet).
- Otherwise X = the median of durations × the rounding up of (unfinished tasks / the parallelism limit of the project), rounded up to a minute: «примерно через X мин» (in about X min). The median of an even number is the average of the two middle ones; the parallelism limit is the one set at the start of the project, otherwise 2. Unfinished are the tasks «ждёт» (waits), «в работе», «на проверке», «прервана», «ждёт решения пользователя» (waits for the user's decision).
- If there is nothing to estimate (there are no unfinished tasks, and the project still goes on — for example, the goal is being compared), — «срок пока не оценить».

### Stop

Ctrl-C (or `SIGTERM`) — the server stops accepting requests, and the projects that it led go on a pause the same way as after Ctrl-C of `npm run team -- start`; everything within 15 s at most. The projects do not continue by themselves after a server restart: the project page will show «Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше» (the project is on a pause. Press «Continue» to make the work go on) (if the project was waiting for nothing). If before the pause the project waited for your decision or a task has a question, the line will say so directly and explain what «Продолжить» can do. The button «Продолжить» on the project page leads the work on — the server itself starts the work of the project. From the terminal, as before, a project on a pause is continued by the command `npm run team -- resume <id>` (the id in the example is made up):

    npm run team -- resume p-20261006-a1b2c3

### The project buttons

A project on the page has three buttons (design `docs/design/REQ-035-team-web-control.md`, decisions `decisions/0030-req035-037-open-points.md` and `decisions/0032-req035-web-control.md`):

- «Пауза» (pause) — visible while the project plans the work, is in work or waits for a decision; started runs are brought to the end, new tasks do not begin;
- «Продолжить» (continue) — visible for a project on a pause, including after a server restart;
- «Остановить» (stop) — visible while the project plans the work, is in work, on a pause or waits for a decision; first the page asks for a confirmation («Остановить» or «Не останавливать», do not stop).

A created, stopped, finished and failed project has no buttons. **A stop is irreversible**: a stopped project cannot be continued, neither by a button nor from the terminal. A project that waits for a decision is continued by an answer to the question and not by a button (the spending ceiling is raised by the command `budget` from the terminal). If a project was put on a pause while it waited for a decision (by the button «Пауза», from the terminal or by stopping the server), «Продолжить» does the same as `resume` from the terminal. When waiting because of the spending ceiling, «Продолжить» promises nothing: if the ceiling is still not enough, the project asks about it again, without runs and spend. When waiting because of the plan or the check of the goal, «Продолжить» can start making a plan, new work or a check — this is a new paid run within the ceiling of the project; if it does not work out or the ceiling is not enough, the project asks you again. If a task has an open question, «Продолжить» does not work while the question is without an answer; the pause line says so in advance, and an answer in the chat does not close the question.

The page itself writes nothing: every command goes through the engine of the project (as `pause`, `resume` and `stop` from the terminal), and what changed the page shows by the journal at the next refresh. The answer to a press is «Отправлено» (sent) or, in plain words, why the command was not performed.

## The check of the run records (handoffs-check)

The command `cd tools && npm run handoffs-check` checks every file `handoffs/**/*.json` that git tracks or that lies in the working tree as new (the same list of files as for `npm run traces`). It is part of `npm run check` before the tests and writes nothing. The design is `docs/design/REQ-038-handoffs-check.md`, the records are `decisions/0036-handoffs-check-base.md`, `decisions/0037-handoffs-check-design.md`, `decisions/0038-handoffs-git-history-child-process.md`. The code is `tools/src/handoffs/`; git calls (and the word `child_process`) are only in `tools/src/handoffs/git-history.js`.

What is checked (the code of the rule goes in the output and in the exceptions base):

- H1 — the file is read as JSON in UTF-8, the top level is an object (the field path `$`);
- H2 — all top-level fields from `docs/workflows/handoffs.md`, section "Fields", are present;
- H3 — `file` equals the path of the file, `run_id` the name of the run folder, `handoff_id` is not repeated;
- H4 — status: in a commit only finished handoffs (`COMPLETED`, `FAILED`, `CANCELLED` with `orch_cancellation`, a stop `IN_PROGRESS` with a first record of `issues` of the kind "BLOCKED"); `result.status` equals `status`; `PENDING` and `IN_PROGRESS` are allowed only for a file that is not yet in HEAD or that differs from it;
- H5 — the time of the form `YYYY-MM-DDThh:mm:ssZ`, `null`, or a string beginning with the word «неизвестно» (unknown) (`completed_at` is `null` only for `IN_PROGRESS`, `PENDING`, `CANCELLED`);
- H6 — the time is not later than the clock at the moment of the check;
- H7 — the time is not later than the committer time of the earliest commit in which the value appeared in this field;
- H8 — `completed_at` is not earlier than `started_at`;
- H9 — ORCH corrections (`orch_correction`, `orch_note`): an object or a list of objects with `by` and `at` (or `at: null` with `at_note`); the times inside `at_note` are checked as H6 and H7; the fields `was` and `previous` are not checked;
- H10 — a path of the home folder (the same function and the same file of exceptions as for `npm run traces`);
- H11 — a path of the temporary folder of the machine; a path after a stand-in in angle brackets (`<scratch>/…`) does not count.

The output is one line per violation: `<path>:<line> — <rule code>: <field path>: <what is wrong>`; the last line is the summary `handoffs-check: файлов проверено N, нарушений M, исключений использовано K из L` (files checked N, violations M, exceptions used K of L). A found computer path does not get into the output. Exit codes: 0 — no violations (those lifted by the base do not count); 1 — there is a violation; 2 — an error of the environment or the input (no git, a file cannot be read, the exceptions base is broken), one line `handoffs-check: <code>: <text>` in stderr, stdout is empty. To fix a violation, open the file at the given line and field: this field of its own handoff is fixed by its author; other people's committed handoffs are not rewritten (`docs/quality-bar.md`, §6, item 8).

The exceptions base `tools/handoffs/exceptions.tsv` holds old violations lifted once at the commit of the base. One record is one violation: the file path, the rule code (H1–H9 or H11), the field path, the sha256 of the value, the reason (separated by a tab). A record lifts only its own violation and only while the value of the field matches the hash. Every record is compared at every run with the file in the commit of the base: a record for a new handoff or a new value is impossible. The commit of the base is given in the header `# база: <40 hex>` and is fixed by the line «База handoffs-check: <40 hex>» in the record of `decisions/` with the largest number where it is present; the base can be moved only by a new record. A record that lifted nothing is printed as the line «исключение не использовано» (the exception was not used) and does not change the exit code.

Keys: `--root <folder>` (any folder inside the repository), `--emit-exceptions` (instead of the report prints the records of the base for the violations not lifted by the base; writes nothing; this is how the base was lifted in the run REQ-038), `--help`.

## The handoff command

The command creates a handoff and closes it. The design is `docs/design/REQ-039-handoff-command.md`, the records are `decisions/0039-handoff-command-design.md` and `decisions/0040-handoffs-git-tag-lookup.md`. The code is `tools/src/handoffs/handoff.js` and the neighbouring files; the command is not part of `npm run check` (it writes files). It writes only into `handoffs/<RUN-ID>/`.

Calls (from `tools/`; the paths in the keys and in the output are from the repository root):

    cd tools && npm run handoff -- new --run <RUN-ID> --step <ШАГ> --role <КОД РОЛИ> --workflow <WF-NN> --task "<текст>"
                                  [--criterion "<пункт>"]… [--requirement <REQ-NNN>]… [--artifact-in "<путь или пояснение>"]…
                                  [--write-set "<текст>"]… [--route "<текст>"] [--qualifier <уточнение>]
                                  [--suffix <rN|runN|vN>] [--priority HIGH|NORMAL|LOW] [--rework-of <путь handoff-а>]
    cd tools && npm run handoff -- close <путь handoff-а от корня> --status COMPLETED|FAILED
    cd tools && npm run handoff -- --help

(In the call, `<ШАГ>` is the step, `<КОД РОЛИ>` the role code, `<текст>` the text, `<пункт>` the item, `<путь или пояснение>` a path or a note, `<уточнение>` a qualifier, `<путь handoff-а>` the path of the handoff, `<путь handoff-а от корня>` the path of the handoff from the root.)

`npm run` prints two header lines before the output; the clean output is `npm run -s handoff -- …` or `node src/handoffs/handoff.js …` from `tools/`.

The keys of `new` (repeatable ones give lists in the order of input; at a violation of a rule — code 1, `E_HO_INPUT`):

- `--run` — required, `LABEL-YYYYMMDD-NN` (the label is capital Latin letters and digits; a defect and an audit also have a number of 3–4 digits): `PROD-20991231-01`, `ISS-0002-20260930-01`;
- `--step` — required, two digits and, if needed, a lowercase letter: `00`, `01`, `05b`;
- `--role` — required, a role code from the lines `name: Name (CODE)` in `.claude/agents/*.md` (the list is read from the files, it is not in the code);
- `--workflow` — required, `WF-01` … `WF-07`;
- `--task` — required, a non-empty text (written as it is);
- `--criterion`, `--artifact-in`, `--write-set` — repeatable, a non-empty text; `--write-set` is always written as a list;
- `--requirement` — repeatable, `REQ-NNN` (three digits);
- `--route` — one non-empty text; `--qualifier` — lowercase Latin letters and digits separated by hyphens, up to 40 characters; `--suffix` — `rN`, `runN` or `vN` (with `rN`, `round` is written); `--priority` — `HIGH`, `NORMAL` (the default) or `LOW`; `--rework-of` — a path from the root, begins with `handoffs/`, ends with `.json`, the existence is not checked.

The key of `close`: `--status COMPLETED|FAILED`, plus exactly one path. A key value that begins with `--` is counted as missing: the text of a task cannot begin with `--`.

`new` writes the file `handoffs/<RUN-ID>/step-<STEP>-<role in lowercase>[-<qualifier>][-<suffix>].json` with `status` `PENDING`; `created_at` and `started_at` are one reading of the clock; the new file is checked by the rules of `handoffs-check` before writing. The name is taken by a hard link: an existing file is not replaced, so the file system must support hard links. A leftover `.<name>.sai-tmp` of an interrupted write is not deleted by the command: the next `new` of the same name answers `E_HO_BUSY`, and the leftover is deleted by hand. The tag `base/<RUN-ID>` (`decisions/0031`): with `--workflow WF-02` without the tag — a refusal (`E_HO_BASE`); for the other workflows the file is created without the field `base_tag`; if the tag exists, `context.base_tag` is written for any workflow.

`close` changes in the text of the file only two top-level values — `status` and `completed_at` (the clock, one reading); the other bytes stay as they were. Closed are `PENDING` and `IN_PROGRESS` with a filled `result` whose `result.status` equals `--status`, and `completed_at` equal to `null`; a stop (`result.status` `IN_PROGRESS`) is not closed by the command. The new text is checked by the rules of `handoffs-check` before writing (at a violation — lines in stdout, the file stays as it was), and the write is "all or nothing" (`decisions/0004`).

Exit codes: 0 — done (stdout: two lines — the path and the `handoff_id` for `new`, the path and `status: …, completed_at: …` for `close`); 1 — a refusal by the rules (a value not accepted, no tag, the file or `handoff_id` already exists, a violation of the bookkeeping rules, the condition of closing is not met); 2 — an error of the call or the environment (no git, no list of roles, the disk). A refusal is one line `handoff: <code>: <text>` in stderr, without the values of arguments and without a stack.

A long text goes without a new key: a file outside the project and a substitution that the shell does not parse again:

    cd tools && npm run -s handoff -- new --run PROD-20991231-01 --step 02 --role BACKEND-DEV --workflow WF-02 \
      --task "$(cat <scratch>/task.txt)" --requirement REQ-999 --write-set "tools/src/demo.js"

The items of criteria — one `--criterion` each. The limit of length is set by the OS (`getconf ARG_MAX`).

## The solution picker site: the check of a tenant file

The command reads one tenant file and either answers «в порядке» (all right) or lists all errors found by their place in the file (no more than 100 lines, then «И ещё ошибок: N.», and N more errors):

    cd tools && npm run picker -- check <файл>

Exit codes: 0 — the file is all right, one line «Файл арендатора <id> в порядке: вопросов N, решений M, правил K.» (the tenant file <id> is all right: questions N, solutions M, rules K); 1 — errors found, lines «<файл>: <место>: <код>: <текст>» (<file>: <place>: <code>: <text>) in stdout; 2 — a wrong call or the file cannot be read, one line `picker: …` in stderr; 3 — a program error, a stack in stderr. Help: `npm run picker -- --help`. The file is only read: the command writes and creates nothing. `npm run` prints extra header lines before the output; the clean output is `npm run -s picker -- check <файл>`. (`<файл>` means "file".)

A tenant file is of three kinds. The kind is set by the field `schema`.

- `sai-picker-tenant/1` — a file in one language. Every text for the visitor in it is an ordinary string. The site shows such a file in Russian.
- `sai-picker-tenant/2` — a file in three languages. Every text for the visitor in it is an object of three fields: `ru`, `kk` and `en`. For example: `"title": { "ru": "…", "kk": "…", "en": "…" }`.
- `sai-picker-tenant/3` — a file in three languages like `/2`, plus the section `look` (how the tenant is shown: the mark, the colours, the four staff of the office). It also has optional fields: `desk` and `chips` of a question, `object` of an option, `whatsapp`, `max_per_hour` and `max_stored` of `leads`, and `telegram` as a third way of contact. In a `/1` or `/2` file these fields are extra fields: the command `check` rejects them with the code `E_FIELD`.

The command `check` checks all three kinds. If in a `/2` file a text has no translation or it does not fit, the line of the error has the language: `questions[2].title.kk`. Then you see at once which language to fix. A `/2` file is about twice as big as a `/1` file, and the limit of size is as before — 512 KB. `/1` files are still accepted. Their samples are in `test/fixtures/picker-legacy/`.

The section `look` of a `/3` file has these fields. `mark` is one letter or digit of any alphabet. `tagline` (optional, up to 40 signs), `industry` (up to 60) and `headline` (up to 120) are texts in three languages. `colors` has the two themes `light` and `dark`, each with `accent` and `accent2`; a colour is written as `#` and six lower-case hexadecimal digits, for example `#1f7a8c`. The contrast of a colour with the sheet of its own theme must be not less than 3.0 : 1; the sheets are `#f3f5f9` for the light theme and `#161f2e` for the dark one. `team` has exactly four staff in the order of the four desks (reception, documents, specification, handover); each has `name`, `role` and `says` (the role and the reply are texts in three languages of up to 40 signs), `figure` (one of `f01`…`f12`) and `shirt` (`accent`, `accent2` or `ink`). A staff name is one string for all languages, 1–30 signs: letters, combining marks, digits, space, hyphen, apostrophe and dot (`decisions/0085`). The `object` of an option is `id` from the closed list of 15 (`shelf`, `shop`, `boxes`, `monitor`, `laptop`, `scanner`, `tsd`, `clip`, `bell`, `phone`, `cell`, `headset`, `poster`, `coins`, `chart`) and, for some ids only, `level`, `tag` (1–3 letters or digits) or `glyph` (`tool`, `box`, `house` or `cap`). Nothing in the section is an address, a style or a code. A `/1` or `/2` file has no `look`: the site shows it with a neutral look that the platform makes from the name of the tenant.

The texts for the visitor must not contain control characters except five whitespace ones: `U+0009`–`U+000D`. Characters of the category Cf (invisible formatting characters) are also not allowed. The line separators `U+2028` and `U+2029` and unpaired halves of characters are also not allowed. The command `check` rejects such a text with a line with the code `E_TEXT`. The line has the place and the code of the character, for example `U+200B`. The character `U+200B` is invisible and glues words.
The character `U+202E` reverses the text after it. Such characters bypass the rule of the 18-word phrase and the ban of the second person. Remove the character from the text and check the file again. An unpaired half of a character (a single surrogate) is also rejected by the command.
Ordinary spaces are allowed, including non-breaking ones `U+00A0` and `U+202F`. They are needed for numbers like «50 000». Emoji are allowed: «😀» and «❤️». Emoji glued by the invisible character `U+200D` are rejected by the command. Some invisible characters the command does not yet reject; do not insert them into texts.

The made-up tenants for the stand are in `src/picker/demo-tenants/`, and both are written in the format `/2`. The sets of answers to them are in `src/picker/demo-answers/`. The answers do not depend on the language: they hold identifiers and numbers, for example an advertising budget of 20. The command `serve` starts the site; it is described in the next section. The template of a file, applications and the instruction for the tenant are in the next requirements. There are no commands for them yet.

## The solution picker site: the server

The server shows the picker site to visitors. It reads the folder with the tenant files once, at start. It listens only to this computer: the address `127.0.0.1`. To each tenant it gives only its questionnaire and counts only its result.

Start:

    cd tools && npm run picker -- serve --tenants <папка> [--home <папка>] [--port N]

| Key         | What it is                                                                         | Default  |
| ----------- | ---------------------------------------------------------------------------------- | -------- |
| `--tenants` | The folder with tenant files. A path from the current folder or a full one.        | Required |
| `--port`    | The port: an integer from 0 to 65535. The number 0 means any free port.            | 4782     |
| `--home`    | The folder for future applications. The server accepts it but does not use it yet. | None     |

(`<папка>` means "folder".)

A key is written as `--port 0` or as `--port=0`. Each key is given once. A value cannot be empty and cannot begin with `--`. So in `--port --tenants x` the port has no value. The port 4782 was chosen in advance: Pixel Office takes 4780, Sai Team — 4781.

At start the command prints five lines to stdout. There are as many links as there are healthy tenants. For two tenants there are five lines:

    Сайт подбора запущен. Откройте ссылки:
    http://127.0.0.1:<порт>/t/svet-marketing/
    http://127.0.0.1:<порт>/t/uchet-pro/
    Изменения файлов арендаторов применяются после перезапуска.
    Остановить сайт: Ctrl+C.

(The Russian lines mean: "The picker site is started. Open the links:", "<port>" for `<порт>`, "Changes of tenant files are applied after a restart.", "Stop the site: Ctrl+C.")

The site can be stopped with Ctrl+C or with the signal `SIGTERM`. Both ways close the port and all connections, exit code 0. If the reader of the output disappears (for example, the output is passed to the command `head`), the site goes on working.

Exit codes:

- 0 — the site is stopped or the help is shown.
- 1 — there is not one healthy file in the folder, or the port is taken, or it cannot be opened.
- 2 — a wrong call or the folder cannot be read. One line `picker: …` in stderr.
- 3 — a program error. A stack in stderr, there is no `picker:` line.

The command writes nothing to the disk. Help: `npm run picker -- --help`. It prints these lines:

    Использование: npm run picker -- <команда> [аргументы]
    Команды:
      check <файл>   проверить файл арендатора; файл только читается
      serve --tenants <папка> [--home <папка>] [--port N]   запустить сайт подбора на этом компьютере (127.0.0.1)
    Коды выхода check: 0 — в порядке; 1 — найдены ошибки; 2 — неверный вызов или файл нельзя прочитать.
    Коды выхода serve: 0 — остановлен; 1 — нет исправных арендаторов или порт занят; 2 — неверный вызов или папку нельзя прочитать.
    Ошибка программы: код 3, подробности в stderr.

(The help lines mean: "Usage: npm run picker -- <command> [arguments]", "Commands:", "check <file> — check a tenant file; the file is only read", "serve … — start the picker site on this computer (127.0.0.1)", "Exit codes of check: 0 — all right; 1 — errors found; 2 — a wrong call or the file cannot be read.", "Exit codes of serve: 0 — stopped; 1 — no healthy tenants or the port is taken; 2 — a wrong call or the folder cannot be read.", "A program error: code 3, details in stderr.")

### Which files the server takes

The server takes files with a name ending in `.json`. The name without `.json` must be equal to the field `id` inside the file. The file is checked by the same rules as the command `check`. A file with errors is not shown by the site. The server prints two parts to stderr: the line `Арендатор <имя> не обслуживается:` (the tenant <name> is not served:) and the lines of the check. The other tenants work. Links, folders and files larger than 512 KB are also not served. If there are more than 100 files `*.json`, the server does not start: code 2.

The files are read once. The site will see edits in them only after a restart.

### Addresses

The server takes the tenant only from the address: this is the first segment after `/t/`.

| Address                     | Method | Answer                                                           |
| --------------------------- | ------ | ---------------------------------------------------------------- |
| `/t/<id>/`                  | GET    | the page of the site: the tenant card and the questionnaire      |
| `/t/<id>`                   | GET    | a redirect to `/t/<id>/` (code 308), the query string is dropped |
| `/t/<id>/api/questionnaire` | GET    | the questionnaire of the tenant, JSON                            |
| `/t/<id>/api/result`        | POST   | the result of the picking, JSON                                  |
| `/assets/<name>`            | GET    | a page file: `.html`, `.js` or `.css`                            |

Everything else answers with code 404. This is both an unknown tenant, and a path with an error, and a tenant from a file with errors. The answer is everywhere the same, byte for byte. Its text is in three languages at once:

    Страница не найдена. / Бет табылмады. / Page not found.

(The Russian and Kazakh parts mean "Page not found".)

A wrong method on a known address gives 405 and the header `Allow`. The site does not show a list of tenants.

The questionnaire has only what the visitor needs: questions, options, the number of questions and the fields of the application. There are no rules, points or solutions in it. The result has no list `ranking`, that is, no points of the solutions that are not recommended.

The body of a request to the result is `{"answers": {…}}`. There must be no other keys in it. The tenant is not taken from the body, the query string or the headers.

### Protection

The server checks the header `Host`: it must be `127.0.0.1:<port>` or `localhost:<port>`. For POST requests it also checks `Origin` and the type `application/json`. The body is no larger than 16 KB. If a pause in the body is longer than 15 seconds, the answer is 408. So the command `curl` for the result is written with the key `-H "Origin: http://127.0.0.1:<port>"`. Without it the server answers 403: this is by design.

### Language

The language is set by the parameter `?lang=ru`, `?lang=kk` or `?lang=en`. The server does not read the header `Accept-Language`. If there is no parameter or the language is not found in the tenant file, the server chooses Russian. The texts of server errors are in `src/picker/public/texts.js`: these are the keys `server_*`. How to add your own key is told in the section "three languages".

### A stand of two made-up tenants

In the folder `src/picker/demo-tenants` there are `uchet-pro` and `svet-marketing`. Both are written in three languages. Start of the stand:

    cd tools
    npm run picker -- serve --tenants src/picker/demo-tenants --home <folder outside the project>

(`<folder outside the project>` means "a folder outside the project".)

If the port 4782 is taken, the command says so and ends with code 1. Then add `--port <number>` or `--port 0`. The real port is printed in the links.

What to open (port 4782):

| Address                                                            | What is seen                                                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `http://127.0.0.1:4782/t/uchet-pro/`                               | The card: the title, the introduction, the number of questions and the button «Пройти опрос» (take the survey) |
| the same with `?lang=kk` and `?lang=en`                            | The same card in Kazakh and in English                                                                         |
| `http://127.0.0.1:4782/t/svet-marketing/`                          | The card of another tenant                                                                                     |
| `http://127.0.0.1:4782/t/uchet-pro/api/questionnaire`              | The questionnaire of `uchet-pro`: 12 questions. With `?lang=kk` and `?lang=en` the texts are in this language  |
| `http://127.0.0.1:4782/t/svet-marketing/api/questionnaire?lang=en` | The questionnaire of another tenant, it has no words of the first                                              |
| `http://127.0.0.1:4782/t/uchet-pro`                                | The browser itself goes to `/t/uchet-pro/`                                                                     |
| `http://127.0.0.1:4782/t/net-takogo/` and `http://127.0.0.1:4782/` | The same answer «Страница не найдена…» (page not found…)                                                       |
| `http://127.0.0.1:4782/assets/texts.js`                            | The file with the texts of the site                                                                            |

The questionnaire is passed in the browser. After the button «Показать результат» (show the result) there is a temporary screen: the result page will be in the next requirement. The result can also be obtained with a POST request.

The command below takes the ready set of answers `leader` and sends it. Run it from the folder `tools` while the stand works on port 4782:

    node --input-type=module -e 'import fs from "node:fs"; const a = JSON.parse(fs.readFileSync("src/picker/demo-answers/uchet-pro.json", "utf8")); process.stdout.write(JSON.stringify({ answers: a.leader }));' \
      | curl -s -X POST -H "Origin: http://127.0.0.1:4782" -H "Content-Type: application/json" \
        --data @- "http://127.0.0.1:4782/t/uchet-pro/api/result"

The answer is JSON with the recommended solutions. Instead of `leader` take `close` or `none`. For `svet-marketing` replace the name of the tenant in two places. The language is set by `?lang=kk` at the end of the address. All sets are in `src/picker/demo-answers/`.

The stand of the new office. The folder `src/picker/demo-tenants-v3` holds `stock` («Складеон», stock control) and `agency` («Лидвейв», marketing). Both are written in the format `/3` with the section `look`. Start of this stand:

    cd tools
    npm run picker -- serve --tenants src/picker/demo-tenants-v3 --home <folder outside the project>

The command prints two links: `/t/agency/` and `/t/stock/`. The sets of answers are in `src/picker/demo-answers-v3/`: `leader`, `close`, `none` and `half`. The set `half` holds only the first two answers and is meant for the live result (REQ-072); the result command refuses it today, because the questions it leaves out are required. Do not mix the two stand folders, because `serve` takes the whole folder. Both tenants are invented, and the Kazakh text is a draft.

### What the server cannot do yet

The site has no applications, no AI advice, no publishing on the internet and no tenant login yet. The key `--home` is accepted but does nothing. They will come in the next requirements.

## The solution picker site: the page

The page of the site is in `src/picker/public/`. These are modules without a build and without external files. The server gives them at the address `/assets/<name>`. This is what is in the folder.

| File             | What it is for                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `index.html`     | The base of the page: one place for screens and a hidden line for reading aloud                        |
| `page.css`       | The look: the light and dark theme, sizes, the focus ring                                              |
| `main.js`        | The entry: starts the page                                                                             |
| `app.js`         | The control: jumps between screens, focus, saving                                                      |
| `screens.js`     | The screens: the card, a question, the connection block                                                |
| `result.js`      | The temporary screen after the button «Показать результат»                                             |
| `dom.js`         | Building the nodes of the page: texts are put only as text                                             |
| `flow.js`        | The progress «Вопрос K из N» (question K of N), neighbouring questions, answers, a number from a field |
| `rules.js`       | The rule of the visibility of questions                                                                |
| `store.js`       | The storage of the browser                                                                             |
| `net.js`         | The only connection with the server: two addresses and a limit of 20 seconds                           |
| `say.js`         | The substitution of `{имя}` into texts                                                                 |
| `tenant-look.js` | The look of a tenant: the closed lists, the colour rule, the neutral look (no texts)                   |
| `texts.js`       | The texts of the site in three languages                                                               |

`tenant-look.js` is a pure module shared by the page and the check of a file; it imports nothing. It exports the closed lists (`OBJECT_IDS`, `OBJECT_RULES`, `GLYPHS`, `FIGURES`, `SHIRTS`), the sheet colours and the contrast rule (`SHEET`, `MIN_CONTRAST`, `isColor`, `contrastRatio`), `isMarkSign`, and the functions `markOf`, `deskForQuestion` and `fallbackLook`.

How to open: start the stand (the section above) and open `/t/uchet-pro/`. The language is set by `?lang=` in the address or by the language button on the page. If the tenant file has one language, there are no language buttons.

The answers are stored only in your browser, under the key `sai-picker:<id>`. The value has five fields: `format`, `version`, `lang`, `current` and `answers`. There is no name, phone or mail in it. If you closed the page, the button «Продолжить» (continue) takes you back to the last question. The button «Начать заново» (start again) erases the key. If the storage is unavailable, the questionnaire can still be passed, but without saving.

The rule of the visibility of questions in `rules.js` is a copy of the rule of the engine. The page does not get the engine file. A test compares the copy with the engine on very many sets of answers. If you change the rule in the engine, change `rules.js` too.

Without JavaScript the page is empty: there are no texts in `index.html`. The browser itself asks for `/favicon.ico`, and the server answers 404. This is not an error of the page.

How to check: `cd tools && npm run check`. The look and the keyboard are checked by steps in a real browser. Windows: 1470 × 784, 390 × 844 and 320 × 568. Themes: light and dark.

## The solution picker site: three languages

The picker site speaks three languages: Russian (`ru`), Kazakh (`kk`) and English (`en`). The tenant texts are translated not by the site but by an agent. The translation is part of the tenant file, format `/2`.

How to check a file: run `cd tools && npm run picker -- check <файл>`. The command will show up to 100 translation errors by place. Its messages stay in Russian.

The language is chosen like this. First the site looks at the parameter `?lang=` in the address, for example `?lang=kk`. If there is none, the language that the visitor chose earlier is taken. If there is none either, the site shows Russian. The site does not read the header `Accept-Language`. If the needed language is not in the tenant file, the site shows Russian.

The texts of the site itself are in the table `src/picker/public/texts.js`. These are buttons, captions and hints, not tenant texts. To add a text, make a new key in `TEXTS`. A key is written with lowercase Latin letters, digits and the sign `_`. A key has three languages: `ru`, `kk` and `en`. A place for a substitution is written like this: `{имя}`. In all three languages the set of substitutions must be the same. A phrase is not longer than 18 words.

The substitution `{имя}` is done by `src/picker/public/say.js`: in `texts.js` there is no separate export for it. The texts of the page have keys with the prefixes `card_`, `quiz_`, `net_`, `progress_` and the key `result_soon`.

The table is guarded by the test `test/picker-texts.test.js`. It checks every key of `TEXTS`, including one added later. If a key has no language, a phrase is longer than 18 words or the substitutions differ, the test turns red. A new separate export in `texts.js` also turns the test red: make texts by keys of `TEXTS`.

For code there are two functions in `src/picker/view.js`. The function `fileLanguages` answers in which languages a file is written. The function `tenantInLanguage` gives a tenant in one language in the old, one-language form. Call it only for a file that has passed the check. The picking engine did not change: it still gets texts as strings.

The kk and en translations of the demo tenants are made by an agent. A separate reader checks the meaning of each pair. It is not a native speaker of Kazakh. So before publication the kk pairs must be looked at by a person who knows Kazakh (record `decisions/0069`, item 6).

## The solution picker site: the engine

The module `src/picker/engine.js` counts the picking of a solution. It finds the visible questions for given answers and counts the points of the solutions. It chooses the best solutions with the note «явный лидер» (a clear leader) and builds hypotheses. To each point it adds an explanation: which rule and which answer gave it.

The module reads and writes nothing: no files, no network, no clock, no random numbers. It has no state between calls. You pass it a checked tenant object (given by the file check) and the visitor's answers. It returns a result with an explanation or the answers error `E_ANSWER`: in it are the identifier of the question and a reason word.

The same answers always give the same result. The result has no words that are not in the tenant file. Numbers are only in three places: `score`, `points` and `because[].value`. In the last one lies the number that the visitor answered.

The engine has no command: it is called by the server. The picker page does not get the engine. It repeats only the rule of the visibility of questions (`public/rules.js`), and a test compares it with the engine.
