# REQ-035 — проект кода: управление проектом на странице Sai Team («Пауза», «Продолжить», «Остановить»)

WF-02, шаг 1 (CODE-DESIGNER), прогон `PROD-20261011-01`, handoff `handoffs/PROD-20261011-01/step-01-code-designer.json`,
база — метка `base/PROD-20261011-01`. Требование — блок REQ-035 в `docs/requirements.yaml` (13 критериев; ворота
требований — `handoffs/REQ-20261011-01/step-08-req-validator.json`). Основа: код `tools/src/web/` и `tools/src/team/engine/`
на базе прогона, проекты `docs/design/REQ-011-team-web.md` («проект REQ-011»), `docs/design/REQ-013-team-engine.md`
(«проект движка», п. 12, 13.6, 13.9, 14), решения `0020`, `0024`, `0025` (W1, W2, W6, W7), `0026`, `0029`, `0030` (п. 1, 2)
и `decisions/0032-req035-web-control.md` (C1–C6; принято ORCH).

**Редакция r1** — доработка по замечаниям ворот `handoffs/PROD-20261011-01/step-02-code-design-validator.json` (F1, F2,
L1–L6) и решениям ORCH к ним; handoff доработки — `handoffs/PROD-20261011-01/step-03-code-designer.json`. Требование —
редакция коммита `4662844` (критерии 2, 6 и описание поправлены ORCH).

**Редакция r6** — исправление дефекта ISS-0020 (WF-03, шаг 3): текст паузы у проекта, ждавшего решения или имеющего открытый вопрос по задаче, не обещает того, чего не будет. Меняются п. 4 (`pause_text`), п. 5.1–5.2 (пояснения и строка «Пауза» у `paused`), п. 8 (тексты), п. 12 (общие места), п. 13 (README), п. 15 (критерии 1, 7, 9, 13; тесты CTL-14a…14f), п. 15.1 (M29–M36), п. 16 (Q3, Q10, Q12, Q13), п. 18 (ожидаемое падение), п. 20.2 (вопросы). Правила кнопок п. 5.1 и форма `ProjectPage` **не меняются**. Полный проект исправления, проверенные факты (Ф18–Ф23) и разбор всех мест того же рода — `docs/design/ISS-0020-pause-text-for-waiting.md`; handoff — `handoffs/PROD-20261011-01/step-27-code-designer.json`. Описание интерфейса — `docs/design/REQ-035-ui.md` r3.

**Редакция r5** — точечная правка по замечаниям REVIEWER `handoffs/PROD-20261011-01/step-17-reviewer.json`: F1 (п. 9.3, `closeConfirm`, CTL-4a — фокус при закрытии подтверждения как в коде и в описании интерфейса), F2 (п. 18 — два ожидаемых падения, WEB-4g и WEB-9d). Принятые Low: L1 (фокус теряется при уходе из проекта с открытым подтверждением, код не правится), L2 (при отказе `run()` движка resume с кодом вне таблицы п. 6.4 в `warn` две строки с разным контекстом; CTL-7c проверяет «ровно раз» на вызове `controlFailure` напрямую), L3 (литерал «Внутренняя ошибка ядра Sai Team (resume)» в `web/engines.js` — повтор шаблона ядра, не нарушение). Handoff — `handoffs/PROD-20261011-01/step-19-code-designer.json`.

**Редакция r4** — точечное согласование с описанием интерфейса `docs/design/REQ-035-ui.md` r2 (п. 4.3): недоступность кнопки — `aria-disabled="true"` с блокировкой в обработчике, не `disabled` (п. 9.3, 9.4, CTL-8f, CTL-8h, M21); handoff — `handoffs/PROD-20261011-01/step-13-code-designer.json`.

**Редакция r3** — точечная доработка по замечанию F5 и N3–N4 ворот `handoffs/PROD-20261011-01/step-06-code-design-validator.json`; handoff — `handoffs/PROD-20261011-01/step-07-code-designer.json`. F5: названы все три причины ожидания и правда о расходах (Ф16, п. 5.1, 5.2, 9.4, 13; `decisions/0032`, C4). N3: M24, N4: п. 5.1.

**Редакция r2** — доработка по замечаниям ворот круга 2 `handoffs/PROD-20261011-01/step-04-code-design-validator.json`
(F3, F4, N1, N2) и решениям ORCH к ним; handoff — `handoffs/PROD-20261011-01/step-05-code-designer.json`. F3 — ORCH выбрал
вариант 1: «Продолжить» у проекта на паузе делает то же, что движок; правило r1 «пауза во время ожидания не продолжается»
снято (п. 5.1, 5.2, 9.4, 13, 15, 15.1, 19, 20; `decisions/0032`, C4). F4 — момент первой проверки `resume(id)` (п. 7) и
поддельная фабрика CTL-3c. N2 — признак «идёт запрос» по проекту (п. 9.2, 9.3). N1 — дополнение C4 подтверждено ORCH и в r2
заменено (C4).

Вид экрана (место кнопок, подтверждения, строки итога, цвета, размеры) описывает GUI-DESIGN-ANALYST в
`docs/design/REQ-035-…-ui.md` (WF-04). Этот проект задаёт **имена и смысл полей ответов, адрес и тело запроса, тексты,
правила кнопок и идентификаторы элементов страницы**; описание интерфейса ссылается на строки таблицы п. 4 по имени
«Ответ.поле» и на идентификаторы п. 9.1.

Кода реализации здесь нет: только сигнатуры, формы, правила и таблицы. Все примеры вымышлены (идентификатор
`p-20990101-a1b2c3`, цель «Вымышленная цель»).

## 0. Проверенные факты (своими запусками, 2026-10-11)

Запуски — скриптами во временной папке сессии вне Sai (`<вне проекта>/req035/probe*.mjs`), которые импортируют настоящие
модули `tools/src/` и пишут только во временную `SAI_TEAM_HOME` там же; сценарий scripted — три независимые задачи
исследователя, предел параллельности 1. Команды и вывод — в `result.self_check` handoff-а.

| # | Утверждение | Чем проверено | Итог |
|---|---|---|---|
| Ф1 | Движок в процессе (как у сервера, W1) на паузе через `deliver` идёт по каналу и **не завершается**: замок тот же | `createEngine(id,{mode:"start",parallel:1}).run()`, задача идёт, `deliver(id,{kind:"pause",args:{}})` | `holder before pause: {"pid":50199} own pid 50199`; `deliver pause via: engine event: PROJECT_PAUSED USER`; через 1,5 с `status after pause: paused holder: {"pid":50199}` |
| Ф2 | Повторная пауза и пауза созданного проекта — отказ `E_PAUSE_STATE`; остановку созданного проекта ядро **принимает** (страница строже, п. 5) | тот же скрипт | `pause again: THROW E_PAUSE_STATE`; `created pause: THROW E_PAUSE_STATE`; `created stop: self stopped` |
| Ф3 | Сигнал движку сервера (`requestStop("signal")`, как Ctrl-C сервера) ставит проект на паузу и отдаёт замок | тот же скрипт | `after signal status: paused holder: null` |
| Ф4 | **`deliver` для `resume` без движка ничего не продолжает и не пишет `PROJECT_RESUMED`: бросает `E_INTERNAL`** — `deliver` передаёт `applyCommand` `config: null` (`channel.js`, строка `{ facts, config: null }`), а `resume` без `config` — внутренняя ошибка (`commands.js`, `absent(opts.config)`). Описание требования (редакция `4662844`) говорит то же; дефект `channel.js` заведён — `docs/issues/ISS-0018-deliver-resume-without-engine-internal-error.md`; на проект он не влияет: сервер для `resume` без движка `deliver` не вызывает (п. 6.3) | тот же скрипт | `deliver resume without engine: THROW E_INTERNAL: Внутренняя ошибка ядра Sai Team (resume)`; `status: paused` |
| Ф5 | Движок в режиме `resume` в процессе: пишет одно `PROJECT_RESUMED` USER, держит замок с pid процесса, доводит проект до «выполнен»; второй движок `resume` при живом первом — `E_ALREADY_RUNNING` без записи | `createEngine(id,{mode:"resume"}).run()` после Ф3 | `resume-mode status: running holder: {"pid":50199}`; `second resume engine: THROW E_ALREADY_RUNNING`; `final status: done`; `RESUMED: 1` |
| Ф6 | Задача, прерванная сигналом, после `resume` запускается ещё раз (попытка засчитана), «готово» у неё одно; задача, готовая до сигнала, и не начатая — по одному запуску | сигнал во время задачи 2, затем движок `resume` | `after signal: paused [["t-0001","done",1],["t-0002","interrupted",1],["t-0003","waiting",0]]`; `work runs: {"t-0001":1,"t-0002":2,"t-0003":1} done: {"t-0001":1,"t-0002":1,"t-0003":1}` |
| Ф7 | **Через 5 с после паузы, нажатой во время 3-секундной задачи, последняя фраза «Что происходит» — не «Проект на паузе»**: идущий запуск доводится до итога и пишет события после `PROJECT_PAUSED`; задача 1 остаётся «на проверке» (проверка на паузе не начинается) | сценарий с задачами по 3 с, пауза через 0,5 с после старта задачи, `projectPage(readProject(id))` через 5 с | `after pause events: PROJECT_PAUSED/USER RUN_FINISHED/ENGINE BUDGET_SPENT/ENGINE TASK_REVIEW/ENGINE`; `happening: [… "Проект на паузе", "Исследователь: попытка завершена — тестовый исполнитель", "Учтены расходы на работу команды", "Результат передан на проверку — тестовый исполнитель"]`; `tasks: [["t-0001","review"],…]` — критерий 2 поправлен ORCH под это поведение (редакция `4662844`: фразы идущего запуска после паузы допустимы, проверка — по порядку событий журнала); п. 15 (CTL-2) |
| Ф8 | Остановка через канал во время задачи: ack приходит после остановки запусков, `PROJECT_STOPPED` — последнее событие, задача «прервана», движок завершается | тот же сценарий, `deliver(id,{kind:"stop",args:{}})` | `stop via engine PROJECT_STOPPED ms 115`; `after … events: PROJECT_STOPPED/USER`; последняя фраза `"Проект остановлен"`; `tasks: [["t-0001","interrupted"],…]`; `engine ended` |
| Ф9 | Остановленный проект: движок `resume` — `E_STOPPED`; повторная остановка — `E_STOPPED` | Ф2, затем `createEngine(c,{mode:"resume"}).run()` и `deliver(c,{kind:"stop"})` | `stopped resume-mode engine: THROW E_STOPPED`; `stopped stop again: THROW E_STOPPED` |
| Ф10 | Код базы, на котором строится проект | `grep -n` по файлам | `engines.js:32 engine = createEngine(id, { home, env, mode: "start" });`; `config.js:11 export const BODY_MAX = 65_536;`; `server.js:331 function readBody(req, res, route)` с пределом `BODY_MAX` и ответом 413 `TEXT.tooBig`; `server.js:440-442` — ветка `GET` вызывает `route.get` без проверки, что он есть; `grep -rn 'командой resume' tools/src/web/` → `texts.js:15`; `grep -n 'resume' tools/src/web/engines.js` → пусто |
| Ф11 | Тесты, которые закрепляют прежнее поведение | `grep -n` по `tools/test/` | `team-web-project.test.js:806` — прежний текст `pause_text` (WEB-4g); `team-web-docs.test.js:53` — строка `npm run team -- resume` в разделе README (остаётся); `team-web-links.test.js:24-34` (`linksIn`) обходит GET-ом **каждый** объект с полями `to` и `api`; `team-web-page.test.js:48` (`projectBody`) — тело проекта без новых полей |
| Ф12 | Модель DOM тестов страницы (`tools/test/team-web-dom.js`) не знает `<dialog>`/`showModal`; есть элементы, атрибуты, `hidden`, `disabled`, события, фокус | `grep -n "showModal\|dispatch\|disabled" tools/test/team-web-dom.js` | `showModal` нет; `this.disabled = false` (144), `dispatchEvent` (270) — подтверждение делается обычным элементом (п. 9.1) |
| Ф14 | (r1) **Пауза при мёртвом замке зависит от того, есть ли что прерывать.** `deliver` открывает писателя ядра, тот восстанавливает проект по журналу (`store.js`, `recover`, шаги 8.4–8.6): есть открытый запуск или задача «в работе» → `RUN_FINISHED` interrupted, `TASK_INTERRUPTED`, `PROJECT_RECOVERED` (статус `paused`, `paused_by: "recovery"`), затем `applyCommand` pause → `E_PAUSE_STATE`, `PROJECT_PAUSED` **не** пишется; прерывать нечего (статус `running` без запусков и задач в работе, или `waiting_user`) → `LOCK_STALE_REMOVED` и одно `PROJECT_PAUSED` USER. Пауза из `waiting_user` сохраняет `state.waiting` (`reducer.js`: `PROJECT_PAUSED` его не обнуляет) | скрипт `<scratch>/r1/tools/test/zz-probe-r1.mjs` на копии `tools` вне Sai (помощники `team-web-helpers.js`, замок с `deadPid()` и держателем `engine`, писатель закрыт) | `A running-no-runs ok self`, `new LOCK_STALE_REMOVED/ENGINE PROJECT_PAUSED/USER status paused paused_by user`; `B running-task-in-work THROW E_PAUSE_STATE`, `new LOCK_STALE_REMOVED/ENGINE RUN_FINISHED/ENGINE TASK_INTERRUPTED/ENGINE PROJECT_RECOVERED/ENGINE status paused paused_by recovery`; второе нажатие `D2 again THROW E_PAUSE_STATE`, новых событий нет; `C waiting-budget-pause ok self`, `PROJECT_PAUSED/USER … waiting {"reason":"budget","task":null}`. Совпадает с probe C и K ворот (SIGKILL движка отдельного процесса) |
| Ф15 | (r1) Из `paused` проект выходит событиями `PROJECT_RESUMED` (→ `running`), `PROJECT_STOPPED` и `PROJECT_FAILED` (оба принимают `paused`, список `PROJECT_LIVE`); в `planning`, `running`, `waiting_user`, `done` из паузы ведёт только `PROJECT_RESUMED`. Движок `resume` открывает писателя до проверок (`engine.js`, `open`: `openRetrying`, затем `checkMode`, `preflight`, `applyCommand`), поэтому `engine.state()` не `null` и у движка, который потом откажет | `grep -n` по `reducer.js` (`PROJECT_LIVE`, обработчики `PROJECT_STOPPED`, `PROJECT_FAILED`, `PROJECT_RESUMED`) и `engine.js` (`open`, строка `state: () => (writer === null ? null : writer.state)`) | строки `reducer.js:189`, `294–299`, `320–325`, `258–276`; `engine.js:228–262`, `1044` |
| Ф16 | (r2, F3) **Пауза ждущего проекта (кнопкой или остановкой сервера) и затем движок `resume` без поднятого потолка: движок пишет `PROJECT_RESUMED` и сразу снова ставит проект в «ждёт решения» с тем же вопросом; запусков нет, расходов нет.** Отказа исполнителя (`E_NO_BUDGET`) здесь нет: `E_NO_BUDGET` — предпроверка исполнителя `claude` для проекта **без** потолка (`claude-cli.js`), а без потолка ожидания по потолку не бывает (`schedule.js`, `slotBudget` → `null`; запуск D: такой проект scripted доходит до «выполнен» без ожидания). Причин ожидания решения по проекту три (`answers.js`, `PROJECT_QUESTIONS`): `budget`, `plan_failed`, `goal_check_failed`. `budget` — см. выше (расходов нет). (r3, F5) `plan_failed` (план не составлен): пауза и `resume` — движок снова составляет план (новые запуски, расход растёт) и, если опять не вышло, снова ждёт решения. `goal_check_failed` (проверка цели не прошла): пауза и `resume` — новая платная проверка цели; после неё проект снова ждёт решения или работа идёт дальше. Расход ограничен потолком проекта; то же делает `resume` из терминала. Пауза проекта с вопросом по задаче: движок отказывает `E_OPEN_QUESTION` (`commands.js`, `checkResume`, до ветки `paused`) | скрипт `<scratch>/r2/tools/test/zz-probe-r2.mjs` на копии `tools` вне Sai (scripted, потолок 0,2, четыре запуска по 0,05; `createEngine` в процессе, `deliver`, `requestStop("signal")`) | A (сигнал = Ctrl-C сервера): `signal new PROJECT_PAUSED/USER`, `status paused paused_by user waiting {"reason":"budget","task":null} spent 0.2 budget 0.2`; движок `resume`: `err null state "waiting_user"`, `new PROJECT_RESUMED/USER:command PROJECT_WAITING/ENGINE:budget CHAT/ENGINE`, вопрос «Достигнут потолок расходов. Поднимите потолок, чтобы продолжить, или остановите проект», `spent 0.2`; B (пауза и продолжение каналом живого движка): `pause via engine new PROJECT_PAUSED/USER`, `resume via engine new PROJECT_RESUMED/USER:command PROJECT_WAITING/ENGINE:budget CHAT/ENGINE`; C (пауза кнопкой, затем сигнал, затем движок `resume`) — как A; D (потолок 0): `err null … PROJECT_DONE/ENGINE ; status done`; E (план не составлен): `new PROJECT_RESUMED/USER:command PLANNING_STARTED/ENGINE RUN_STARTED/ENGINE … PROJECT_WAITING/ENGINE:plan_failed CHAT/ENGINE`, `spent 0.02` → `0.04`; (r3, F5; запуск ворот `step-06`) `goal_check_failed`: `PROJECT_RESUMED/USER:command RUN_STARTED/ENGINE GOAL_CHECK_STARTED/ENGINE … GOAL_CHECK_RESULT/ENGINE PROJECT_WAITING/ENGINE:goal_check_failed`, `spent 0.12` → `0.13` |
| Ф17 | (r2, F4) `start(id)` в `engines.js` делает первую проверку **до первого `await`**: цикл начинается сразу после `run()`, `pause(START_POLL_MS)` — в конце шага; отказ `run()` попадает в `entry.error` только в обработчике обещания (микрозадача), поэтому на первой (синхронной) проверке `entry.error` всегда `null` | чтение `tools/src/web/engines.js` (`start`: `entry.done = run.then(…)`, затем `for (;;) { if (entry.error !== null) … await pause(START_POLL_MS); }`) | так в коде базы; модель ворот (`order.mjs`) с поддельным движком «`state()` сразу `running`, `run()` сразу отклоняется» дала `{"resumed":true,"error":null}` при обоих порядках — отсюда новая фабрика CTL-3c (п. 15) |
| Ф13 | Решения на месте (критерии 11, 13) | `grep -n 'tools/src/web/engines.js' decisions/0030-*.md`; `grep -c resume …`; `grep -c 0025 …`; `grep -n 0030 decisions/README.md`; `grep -n 'нельзя отменить' decisions/0030-*.md` | строка 8; 2; 2; строка 38 «Принято»; строка 7 |

## 1. Состав изменений и кто какие файлы пишет

| Файл | Что меняется | Кто |
|---|---|---|
| `tools/src/web/config.js` | константа `CONTROL_BODY_MAX` (п. 2) | BACKEND-DEV |
| `tools/src/web/texts.js` | новый `TEXT.paused`, тексты управления, `resumeFailed(why)` (п. 8); (r6, ISS-0020) тексты `pausedBudget`, `pausedPlan`, `pausedGoalCheck`, `pausedTaskQuestion` | BACKEND-DEV |
| `tools/src/web/display.js` | `controlsFor`, `controlRefusal`, поля `controls`, `stopped_text`, новый `pause_text` в `projectPage` (п. 4, 5); (r6, ISS-0020) функция `pauseText(state, events)` и правило «Пауза» у `paused` с вопросом по задаче (п. 4, 5.2) | BACKEND-DEV |
| `tools/src/web/engines.js` | `resume(id)`, `has(id)`, необязательный параметр `create` у `createEngines` (п. 7; решение 0030, п. 2) | BACKEND-DEV |
| `tools/src/web/api.js` | `postControl`, `controlFailure` (п. 6) | BACKEND-DEV |
| `tools/src/web/server.js` | маршрут `control`, предел тела маршрута в `readBody`, текст устаревшего ключа маршрута в `writeAllowed`, 405 для маршрута без GET, набор «идёт команда» (п. 3) | BACKEND-DEV |
| `tools/README.md`, раздел `## Sai Team — интерфейс` | кнопки, подтверждение, остановка необратима, продолжение после перезапуска (п. 13) | BACKEND-DEV |
| `tools/src/web/public/index.html`, `app.js`, `style.css` | кнопки, подтверждение, строка итога, состояние (п. 9) | FRONTEND-DEV |
| `docs/design/REQ-035-…-ui.md`, снимки `docs/design/samples/` | вид (WF-04) | GUI-DESIGN-ANALYST, DESIGN-QA-VALIDATOR |
| `tools/test/team-web-control.test.js`, `team-web-control-page.test.js`, `team-web-control-engine.test.js` (новые), `tools/test/fixtures/team/no-ack.js` (новый), правки `team-web-project.test.js` (WEB-4g), `team-web-words.test.js`, `team-web-page.test.js` (п. 15, 18) | тесты | TEST-DESIGNER (шаг 5) |

`main.js` не меняется: `createEngines({ home, env, warn })` и `stopAll` уже охватывают движки, запущенные `resume`.

**Порядок и «двое не пишут один файл».** Сначала общий контракт — п. 3 (адрес, тело, ответы), п. 4 (поля), п. 8 (тексты),
п. 9.1 (идентификаторы); он принят вместе с проектом (шаг 1b). Затем BACKEND-DEV и FRONTEND-DEV работают параллельно: их
файлы не пересекаются (сервер — всё в `tools/src/web/`, кроме `public/`, и README; страница — только `public/`). Поле,
которого нет в п. 4, страница не читает; нужно новое — вопрос через ORCH и новая редакция проекта.

## 2. Константы (`tools/src/web/config.js`)

| Имя | Значение | Смысл |
|---|---|---|
| `CONTROL_BODY_MAX` | `4_096` | наибольшее тело запроса управления в байтах (критерий 6); больше — 400 «Запрос не понят» |
| `ENGINE_START_WAIT_MS` (есть) | `5_000` | сколько ответ «Продолжить» ждёт, пока движок `resume` в процессе сервера запишет возобновление (п. 7) |
| `START_POLL_MS` (есть) | `50` | шаг этого ожидания |
| `BODY_MAX` (есть) | `65_536` | без изменений: чат и создание |

`ACK_WAIT_MS` (10 с) — константа движка (`channel.js`); сервер своей не заводит.

## 3. API управления (контракт; решение 0032, C1, C2, C6)

### 3.1. Маршрут

| Метод и путь | Обработчик | Успех |
|---|---|---|
| `POST /api/projects/<id>/control` | `postControl(ctx, id, body)` (`api.js`) | 200 `Controlled` |
| `GET` (и любой метод, кроме POST) того же пути | — | 405 `Failure` `TEXT.badRequest`, заголовок `Allow: POST`; ядро не вызывается |

Адрес страница берёт **только** из ответа проекта — `ProjectPage.controls.api` (п. 4). Это строка, а не `Link`: `Link` —
адреса экранов и GET-запросов, их обходит WEB-6 (Ф11); адрес управления по GET не открывается (решение 0032, C6).

### 3.2. Тело запроса — ровно одна из трёх форм

| Действие | Тело (байт в байт по ключам) | Пример (вымышленный проект не нужен — id в пути) |
|---|---|---|
| Пауза | `{ "action": "pause" }` | `{"action":"pause"}` — 18 байт |
| Продолжить | `{ "action": "resume" }` | `{"action":"resume"}` — 19 байт |
| Остановить | `{ "action": "stop", "confirmed": true }` | `{"action":"stop","confirmed":true}` — 34 байта |

Признак подтверждения — поле `confirmed`, значение строго `true` (критерий 4). Всё остальное — 400 `Failure`
`TEXT.badRequest` «Запрос не понят. Обновите страницу», `field: null`, журнал не трогается: лишний ключ (в том числе
`confirmed` у паузы и продолжения), нет ключа, `action` не из трёх строк, `confirmed` не `true` (`false`, `"true"`, `1`,
нет), корень не объект, не JSON, не UTF-8. Это и есть формулировка критерия 6 в редакции `4662844`: «одно действие из
трёх (pause, resume, stop) и признак подтверждения confirmed для stop».

### 3.3. Ответы

```
ControlBody = { action: "pause" | "resume" } | { action: "stop", confirmed: true }
Controlled  = { result_text (п) }                       // всегда TEXT.sent «Отправлено»
Failure     = { error_text (п), field: null, reload: bool }   // форма REQ-011; у управления field всегда null
postControl(ctx, id: string, body: object) → Promise<Reply>   // Reply = { status, body }; не бросает
controlFailure(ctx, id: string, action: "pause"|"resume"|"stop", err: unknown) → Reply   // экспортируется (тест CTL-7c)
```

Ответ на нажатие **не** несёт состояния проекта (R2): состояние страница берёт из ближайшего опроса `GET` проекта, который
она начинает сразу после ответа (п. 9.3).

### 3.4. Порядок проверок (`server.js`; дополняет п. 4.1 проекта REQ-011)

1. `Host` — как сейчас (403 «Запрос отклонён»).
2. Путь: `routeOf` получает ветку `["api","projects",<id>,"control"]` (id — `PATTERNS.project`, иначе «не найдено» до
   любого чтения). Маршрут управления: `{ post, field: null, bodyMax: CONTROL_BODY_MAX, overBody: 400 TEXT.badRequest,
   staleText: TEXT.staleKeyControl }` и **без** `get`.
3. Метод: `GET` при маршруте без `get` → 405 с `Allow: POST` (сейчас ветка `GET` вызывает `route.get` без проверки — Ф10;
   правка общая: `allowOf` даёт `"GET"`, `"GET, POST"` или `"POST"`). Не POST → 405 как сейчас.
4. `Origin`, `Content-Type`, вид ключа, сам ключ — `writeAllowed(req, route)` как сейчас (403 `TEXT.refused`); ключ
   правильного вида, но не этого запуска — 403, `reload: true`, текст `route.staleText ?? TEXT.staleKey` (у управления —
   `TEXT.staleKeyControl`, п. 8: в прежнем тексте есть «текст в поле пропадёт», а у кнопок поля нет).
5. Тело — `readBody(req, res, route)` с пределом `route.bodyMax ?? BODY_MAX` и ответом `route.overBody ?? 413
   TEXT.tooBig (field маршрута)`: объявленный `Content-Length` больше предела или прочитано больше предела — этот ответ,
   остаток тела отбрасывается (как сейчас, `refuse` → `discard`), обработчик не вызывается. Простой `bodyIdleMs` — как
   сейчас. У маршрутов создания и чата ничего не меняется (предел `BODY_MAX`, 413 «Сообщение слишком большое»).
   **Про «Сообщение слишком большое» (критерий 6, уточнение задания ORCH):** у маршрута управления этого ответа нет
   совсем — любое тело больше 4096 байт, хоть 8 КиБ, хоть больше 65 536, получает 400 «Запрос не понят. Обновите
   страницу». 413 «Сообщение слишком большое» остаётся только у создания и чата и только у тела больше `BODY_MAX`.
6. Разбор JSON — как сейчас (400 `TEXT.badRequest`), затем `postControl`.

Всё до шага 6 — без обращения к ядру; шаги 1–5 не читают и не пишут файлов `SAI_TEAM_HOME`.

## 4. Контракт полей: ответ → поле → тип → откуда берётся

Дополняет таблицу п. 5.5 проекта REQ-011; строки, которых здесь нет, не меняются. Описание интерфейса ссылается на эти
строки по имени «Ответ.поле». Поля с пометкой (п) — «для показа» (критерий 9). `read` = `readProject(id)` ядра.

| Ответ | Поле | Тип | Откуда берётся |
|---|---|---|---|
| ProjectPage | `pause_text` (п) | строка или `null` | (r6, ISS-0020) `pauseText(state, events)`, правила по порядку: `status !== "paused"` → `null`; открытый вопрос по задаче (`taskQuestionOpen`) → `TEXT.pausedTaskQuestion`; `state.waiting === null` → `TEXT.paused` «Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше»; `waiting.reason === "budget"` и потолок не поднят после ожидания (`budgetRaised(events) === false`) → `TEXT.pausedBudget`; `plan_failed` → `TEXT.pausedPlan`; `goal_check_failed` → `TEXT.pausedGoalCheck`; иначе (`budget` с поднятым потолком; `task_failed`, `review_failed`, `approval` без открытого вопроса) → `TEXT.paused`. Тексты — п. 8. Новых полей в ответе нет: причина ожидания читается из `state.waiting` и журнала, которые `projectPage` уже получает (Ф18, `docs/design/ISS-0020-pause-text-for-waiting.md`, п. 2). Было: `status === "paused"` → `TEXT.paused` на любую паузу |
| ProjectPage | `stopped_text` (п) | строка или `null` | **новое.** `status === "stopped"` → `TEXT.stoppedFinal` «Проект остановлен. Продолжить его нельзя»; иначе `null` |
| ProjectPage | `controls` | `ControlSet` | **новое.** Всегда есть |
| ControlSet | `pause` | логическое | `controlsFor(status).pause` (п. 5.1): `planning`, `running`, `waiting_user` |
| ControlSet | `resume` | логическое | `controlsFor(status).resume`: только `paused` |
| ControlSet | `stop` | логическое | `controlsFor(status).stop`: `planning`, `running`, `paused`, `waiting_user` |
| ControlSet | `api` | строка | `/api/projects/<id>/control` — адрес POST управления; не `Link` (п. 3.1) |
| Controlled | `result_text` (п) | строка | `TEXT.sent` «Отправлено» |
| Failure (управление) | `error_text` (п) | строка | таблицы п. 5.2 и 6.4 |
| Failure (управление) | `field` | `null` | у управления полей формы нет |
| Failure (управление) | `reload` | логическое | `true` только у устаревшего ключа (п. 3.4, шаг 4) |

`ControlSet` — только «какие кнопки видны». Тексты отказов в ответ проекта **не** кладутся: правило «строже движка» и
тексты отказов применяются сервером к запросу (п. 5.2, 6), а страница показывает `error_text` ответа на нажатие. Так
страница не может разрешить то, чего не разрешит сервер, и ничего не решает сама. Полей прогресса кнопок, «нажато»,
«ожидается» нет: всё видимое — из журнала (R2).

`ProjectItem` (список) не меняется. `ChatPage`, `TaskPage`, `RoleCard`, `Created`, `Sent` не меняются.

## 5. Единая таблица: состояние проекта → кнопки → отказы (критерии 1, 7)

### 5.1. Кнопки (`controlsFor(status) → { pause, resume, stop }`, `display.js`, чистая функция)

| Статус (`state.status`) | Слово статуса | «Пауза» | «Продолжить» | «Остановить» | Текст состояния на странице |
|---|---|---|---|---|---|
| `created` | создан | — | — | — | (как сейчас: строки REQ-011) |
| `planning` | планирование | да | — | да | — |
| `running` | в работе | да | — | да | — |
| `waiting_user` | ждёт решения пользователя | да | — | да | (как сейчас: `waiting_text`) |
| `paused` | на паузе | — | да | да | `pause_text` |
| `stopped` | остановлен | — | — | — | `stopped_text` |
| `done` | выполнен | — | — | — | — |
| `failed` | не удалось | — | — | — | — |

Строже движка (описание требования): `created` — движок принял бы `stop` (Ф2), кнопок нет; `waiting_user` — движок принял
бы `resume` после поднятого потолка или решения, кнопки «Продолжить» нет. Шире движка — нигде.

(r2, F3) «Пауза» у `waiting_user` остаётся (описание и критерий 1). «Продолжить» у `paused` делает то же, что движок, —
и у паузы, поставленной во время ожидания решения (`state.waiting !== null`): кнопкой, командой `pause` из терминала или
остановкой сервера (Ctrl-C; Ф3, Ф16). Мест «строже движка» по критерию 7 два (`created`, `waiting_user` по потолку и по вопросу задачи); строк `paused` в таблице критерия 7 нет. (r3, N4) Есть и расхождение с критерием 7: строка `waiting_user` «прочее» (вопрос проекта: `plan_failed`, `goal_check_failed`) → `ctlDecision` строже движка — движок принимает `resume` у этих двух причин. Её покрывает правило кнопок описания требования («проект, ждущий решения, продолжается ответом на вопрос»); строки в таблице критерия 7 для этого случая нет — принятое расхождение с критерием 7, ORCH подтверждает (решение 0032, «принято»). Путь «Пауза» → «Продолжить» у ждущего проекта — известный и принятый
(решение 0032, C4): что делает движок, — Ф16 и п. 9.4. Так выполняется и описание требования «после перезапуска кнопка
«Продолжить» ведёт их дальше». (r6, ISS-0020) Правдив `pause_text` теперь не всегда одной строкой: «Нажмите «Продолжить», чтобы работа пошла дальше» стоит только там, где работа после «Продолжить» и вправду идёт (паузе без ожидания и без вопроса по задаче, ожидание по потолку с поднятым потолком); у ждавшего по потолку, по плану, по проверке цели и у проекта с открытым вопросом по задаче строка говорит, что будет на самом деле (п. 4, 8). Правила кнопок п. 5.1 это не меняет: «Продолжить» у `paused` видна всегда (критерий 1), в том числе при вопросе по задаче — отказ 409 остаётся, но строка паузы предупреждает о нём заранее.

### 5.2. Отказы до отправки (`controlRefusal(action, state, events) → string | null`, `display.js`, чистая функция)

`null` — страница разрешает действие, запрос идёт дальше (п. 6.2); строка — отказ 409 с этим `error_text`, ни `deliver`,
ни движок не вызываются, журнал и `inbox/` не меняются. Признаки: «вопрос по задаче» — `openQuestions(state,
scanFacts(events))` содержит вопрос с `task !== null` (то же правило, что `E_OPEN_QUESTION` движка, `commands.js`
`checkResume`); «потолок поднят» — в `events` есть `BUDGET_SET` с `seq` больше `seq` последнего `PROJECT_WAITING`.

| Статус | «Пауза» | «Продолжить» | «Остановить» |
|---|---|---|---|
| `created` | «Проект ещё не начал работу. Повторите через несколько секунд» | то же | то же |
| `planning`, `running` | `null` | «Проект уже работает» | `null` |
| `waiting_user`, `waiting.reason === "budget"`, потолок не поднят | `null` | «Продолжить нельзя: потолок расходов исчерпан. Как поднять потолок, написано в инструкции Sai Team» | `null` |
| `waiting_user`, `waiting.reason === "budget"`, потолок поднят | `null` | «Проект ждёт вашего решения. Продолжить его с этой страницы пока нельзя — это появится позже» | `null` |
| `waiting_user`, есть вопрос по задаче | `null` | «Проект ждёт вашего решения по задаче. Ответить на странице пока нельзя — это появится позже» | `null` |
| `waiting_user`, прочее (вопрос проекта) | `null` | «Проект ждёт вашего решения. Продолжить его с этой страницы пока нельзя — это появится позже» | `null` |
| `paused`, есть вопрос по задаче (как движок: `E_OPEN_QUESTION`, `checkResume`; не строже) | «Проект уже на паузе» (или текст после сбоя — строка ниже) | «Проект ждёт вашего решения по задаче. Ответить на странице пока нельзя — это появится позже» | `null` |
| `paused`, `paused_by === "recovery"` (ядро само поставило проект на паузу после сбоя, Ф14), вопроса по задаче **нет** | «Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше» | `null` | `null` |
| `paused`, прочее — в том числе `waiting !== null` (пауза во время ожидания решения, кнопкой, из терминала или остановкой сервера; r2, F3) | «Проект уже на паузе» | `null` (как движок: `checkResume` у `paused` без вопроса по задаче — `"command"`, потолок не проверяется; Ф16) | `null` |
| `stopped` | «Проект уже остановлен» | «Проект остановлен. Продолжить его нельзя» | «Проект уже остановлен» |
| `done`, `failed` | «Проект уже завершён» | то же | то же |

Порядок строк `waiting_user`: сначала причина `budget`, потом вопрос по задаче, потом прочее. У `paused` столбцы
независимы (r2): «Продолжить» — вопрос по задаче → `TEXT.ctlTaskDecision`, иначе `null` (ни `waiting`, ни потолок, ни
`paused_by` не проверяются — как у движка); «Пауза» — `paused_by === "recovery"` **и нет вопроса по задаче** → `TEXT.ctlPausedAfterFailure`
(r6, ISS-0020: при открытом вопросе по задаче «Продолжить» откажет, и звать его нажать нельзя), иначе `TEXT.ctlAlreadyPaused` (у паузы ядра после сбоя `waiting` всегда `null`: восстановление бывает только из
`planning` и `running`, `store.js`, шаг 8.6). Строка «на паузе, «Пауза» → «Проект уже на паузе»» критерия 7 — фикстура
с паузой по команде (`paused_by: "user"`); текст паузы после сбоя начинается теми же словами и говорит правду о причине.
Пауза остановленного проекта
в критерии 7 не названа; проект даёт ей «Проект уже остановлен» (правдиво и без технических слов).

**Что это не защищает и почему (решение 0032, C4).** Правила движка (что движок вообще разрешает) проверяются в той же
синхронной операции, что и запись (`applyCommand` под замком; Ф2, Ф9) — страница никогда не делает того, что движок
запрещает. Правила «строже движка» проверяются на чтении журнала прямо перед отправкой: передать движку условие «только из
паузы» нельзя без правки REQ-013 (вне области). Остаточный риск назван: если между этим чтением и записью команда из
терминала продолжит проект и он успеет перейти в «ждёт решения», запрос «Продолжить» со страницы движок примет как
обычный `resume` (это действие, которое движок разрешает). Окно — миллисекунды и только при одновременной команде из
терминала; в `decisions/0032` это записано как принятый остаточный риск с вариантом «условие в команде движка» на потом.
(r2, F3) Путь «Пауза» → «Продолжить» у проекта, ждущего решения, страница не закрывает — это принятый остаток (решение
0032, C4): правило (2) «строже движка» действует только у `waiting_user`, а у паузы «Продолжить» — правило движка, как
`pause` + `resume` из терминала. Что получается (Ф16): потолок не поднят — `PROJECT_RESUMED` и сразу снова «ждёт решения»
с вопросом о потолке, без запусков и расходов; потолок поднят — работа идёт дальше; (r3, F5) `plan_failed` и `goal_check_failed` —
движок делает новый платный запуск (планирование заново или новая проверка цели) в пределах потолка проекта, после него проект снова ждёт решения или
работа идёт дальше; вопрос по задаче — отказ (как движок). Отказ или предупреждение **кнопки** на странице не вводятся (решение ORCH: это третье место «строже движка» и правка требования; принятый остаток, владелец может отменить). (r6, ISS-0020) Меняется только **правда строки паузы** (`pause_text`, п. 4, 8): она называет причину и то, что сделает «Продолжить»; кнопка и её доступность не меняются, так что это не третье место «строже движка».

## 6. Обработчик `postControl` (`api.js`)

### 6.1. Шаги

1. Тело — п. 3.2; не та форма — 400 `TEXT.badRequest`.
2. «Одна команда на проект за раз» (решение 0032, C5): `ctx.controlling` — `Set` id проектов, по которым **этот сервер**
   сейчас выполняет команду управления (создаётся в `createWebServer`, живёт в памяти). Id уже в наборе — 409
   `TEXT.ctlBusy`, ничего не читается и не пишется. Иначе id добавляется синхронно, в той же части обработчика, где
   проверен, и удаляется в `finally` после ответа (при любом исходе).
3. `read = readProject(id, { home })`; ошибка чтения — `E_NOT_FOUND` → `notFoundReply()` (те же байты, что у всех «не
   найдено»), `E_CORRUPT` → 500 `TEXT.corrupt`, `E_DISK` → 500 `TEXT.readFailed`, прочее → 500 `TEXT.internal` и строка
   `formatError` в `ctx.warn`.
4. `text = controlRefusal(action, read.state, read.events)`; не `null` → 409 `Failure(text)`.
5. Отправка — п. 6.2 (пауза, остановка) или п. 6.3 (продолжение).
6. Успех → 200 `{ result_text: TEXT.sent }`; если `deliver` вернул `via:"self"` — его `notices` в `ctx.warn` (как чат).
   Ошибка → `controlFailure(ctx, id, action, err)` (п. 6.4).

### 6.2. Пауза и остановка — только `deliver`

`await deliver(id, { kind: action, args: {} }, { home: ctx.home })` — единственный вызов записи (решения 0020, 0024, 0025;
проект движка п. 13.9). Всё остальное решает `deliver` в той же операции, что и запись:

- живой движок (сервера или отдельный процесс) → канал, ack ≤ 10 с; пауза — событие пишет движок, замок тот же (Ф1);
  остановка — движок останавливает запуски, пишет `PROJECT_STOPPED` и только потом отвечает (Ф8);
- замка нет или он мёртвый → писатель ядра с восстановлением (`LOCK_STALE_REMOVED` и т. д.), `applyCommand`, `close()`;
- замок жив, держатель не движок → `E_PROJECT_BUSY`.

Сервер сам журнал не пишет, команду не повторяет, путь `inbox/` не собирает.

### 6.3. Продолжение — по решению 0030, п. 2 (решение 0032, C3)

1. `ctx.engines.has(id)` (движок этого сервера жив) **или** `engineHolder(id, { home })` из `channel.js` не `null`
   (замок жив и держатель `engine` — движок отдельного процесса) → `await deliver(id, { kind: "resume", args: {
   parallel: null } }, { home })` — канал к живому движку, как пауза.
2. Иначе → `r = await ctx.engines.resume(id)` (п. 7): движок проекта в процессе сервера в режиме `resume`; сам движок под
   замком проверяет состояние и пишет `PROJECT_RESUMED` USER (Ф5).
   - `r.resumed === true`, `r.error === null` → успех (200 «Отправлено»);
   - (r1, L6) `r.resumed === true`, `r.error !== null` (движок записал возобновление и сразу завершился с ошибкой — п. 7)
     → 500 `TEXT.ctlResumedBroken` «Проект продолжен, но работа сразу прервалась. Проверьте состояние проекта через
     несколько секунд»; строку в `ctx.warn` уже записал `engines.js` (`report`), `postControl` второй не пишет; журнал —
     только правда движка и ядра;
   - `r.resumed === false`, `r.error !== null` → `controlFailure(ctx, id, "resume", r.error)`;
   - `r.late === true` (движок не записал возобновления за `ENGINE_START_WAIT_MS` и не отказал) → 504
     `TEXT.ctlUnconfirmed`; движок продолжает открываться, страница увидит правду в журнале при опросе.

`deliver` для `resume` без живого движка сервер не вызывает: такой вызов не продолжает работу и бросает `E_INTERNAL` (Ф4).
Гонка «движок отдельного процесса завершился между шагом 1 и `deliver`» даёт именно этот `E_INTERNAL` → 500 общий текст
и строка в `err` (п. 6.4, последняя строка); журнал — только правда восстановления ядра, проект остаётся на паузе;
следующее нажатие идёт по шагу 2. Обратная гонка «движок появился между шагом 1 и `engines.resume`» — `E_ALREADY_RUNNING`
(Ф5) → п. 6.4, строка состояний → проект всё ещё на паузе → `TEXT.ctlBusy`; следующее нажатие идёт по шагу 1.

### 6.4. Перевод ошибок — `controlFailure(ctx, id, action, err) → Reply`

| Код `TeamError` (или исход) | HTTP | `error_text` |
|---|---|---|
| `E_NOT_FOUND` | 404 | `notFoundReply()` |
| `E_CORRUPT` | 500 | `TEXT.corrupt` «Данные проекта повреждены — проект нельзя показать» |
| `E_DISK` с `details.rollback === "failed"` | 500 | `TEXT.ctlDiskUnsure` |
| `E_DISK` | 500 | `TEXT.ctlDisk` |
| `E_PROJECT_BUSY`, `E_CHANNEL_FULL`, `E_CHANNEL_DROPPED` | 409 | `TEXT.ctlBusy` «Команда не выполнена, повторите через несколько секунд» |
| `E_ENGINE_STOPPING` | 409 | `TEXT.ctlStopping` «Проект сейчас останавливается, повторите через несколько секунд» |
| `E_CHANNEL_TIMEOUT` (обе формы, в том числе «движок завершился»), `E_CHANNEL_UNCONFIRMED`, `E_CHANNEL_STALE` | 504 | `TEXT.ctlUnconfirmed` «Команда не подтверждена, проверьте состояние проекта через несколько секунд» |
| `E_CHANNEL`, `E_CHANNEL_BAD` | 500 | `TEXT.chatLinkDown` «Связь с работающим проектом недоступна. Перезапустите Sai Team» (тот же текст, что у чата) |
| `E_USAGE` | 400 | `TEXT.badRequest` |
| **состояние:** `E_PAUSE_STATE`, `E_STOPPED`, `E_FINISHED`, `E_ALREADY_RUNNING`, `E_NOT_STARTED`, `E_OPEN_QUESTION`, `E_BUDGET_NEEDED`, `E_TRANSITION` | 409 | проект читается **заново** (`readProject`): `controlRefusal(action, state, events)`; `null` (состояние снова допускает действие) → `TEXT.ctlBusy`; ошибка чтения — по шагу 3 п. 6.1. Пауза при мёртвом замке и прерванной работе (Ф14): `deliver` восстановил проект и получил `E_PAUSE_STATE` → перечитанный `paused_by: "recovery"` → `TEXT.ctlPausedAfterFailure` |
| движок `resume` не открылся: `E_SCENARIO`, `E_CONFIG`, `E_WORK_DIR`, `E_NO_BUDGET`, `E_REAL_RUNS_OFF` и прочие коды предпроверки | 409 | `resumeFailed(why)` «Проект не продолжен: <why>»; `why` — `WHY_NOT_STARTED[code]` или `WHY_OTHER` (тексты REQ-011) |
| `E_INTERNAL`, неизвестный код, не `TeamError` | 500 | `TEXT.internal`; ровно одна строка `formatError(err)` в `ctx.warn` |

Перечитывание в строке «состояние» — чтение без замка; оно только выбирает текст и ничего не разрешает. Сообщение
`err.message` ядра и движка на страницу не идёт (в нём бывают pid, команды терминала, коды).

## 7. Движки сервера (`engines.js`; решение 0030, п. 2)

```
Engines = {
  start(id): Promise<{ started: bool, error: TeamError | null }>,                 // без изменений
  resume(id): Promise<{ resumed: bool, error: TeamError | null, late: bool }>,     // новое
  has(id): bool,                                                                   // новое: есть живая запись карты
  stopAll(waitMs): Promise<bool>,                                                  // без изменений
  size(): int                                                                      // без изменений
}
createEngines({ home, env, warn, create? }) → Engines   // r1: create — фабрика движка, по умолчанию createEngine
                                                         // (engine.js); main.js её не передаёт; тесты CTL-3c — поддельную
```

- `start` и `resume` — одна внутренняя запускалка с параметром режима (`createEngine(id, { home, env, mode })`, `run()`
  без ожидания конца, запись `Map id → { engine, done, settled, error }`, удаление записи по концу `done`, отказ — строка
  `formatError` в `warn`). Для `start` — `mode: "start"` (как сейчас), для `resume` — `mode: "resume"`, `parallel` не
  передаётся (остаётся предел проекта).
- `resume(id)`: запись в карте уже есть → `{ resumed: false, error: TeamError E_ALREADY_RUNNING, late: false }` без второго
  `createEngine` (обработчик сюда не попадает — п. 6.3, шаг 1; это защита от двойного движка). Иначе ожидание каждые
  `START_POLL_MS`, не дольше `ENGINE_START_WAIT_MS`. **(r2, F4) Момент первой проверки — как у `start` (Ф17): сразу после
  `run()` и записи в карту, синхронно, до первого `await`;** затем `await pause(START_POLL_MS)` и следующая проверка, и так
  до исхода. Значит, отказ `run()` (он попадает в `entry.error` в микрозадаче) первая проверка не видит никогда, а видит
  вторая и следующие. Срок `ENGINE_START_WAIT_MS` отсчитывается от вызова `resume(id)`. **(r1, L6) Порядок проверок на
  каждом шаге ожидания — сначала возобновление, потом отказ:**
  1. `s = engine.state()` не `null` и `s.status` — один из `planning`, `running`, `waiting_user`, `done` (из паузы туда
     ведёт только `PROJECT_RESUMED`, Ф15) → `{ resumed: true, error: entry.error, late: false }`; `entry.error` не `null`,
     только если к этому шагу движок уже завершился с ошибкой (записал возобновление и сразу упал) — ответ п. 6.3
     `TEXT.ctlResumedBroken`, а не «Проект не продолжен»;
  2. отказ `done` (`entry.error !== null`) → `{ resumed: false, error, late: false }` — в том числе когда статус
     `stopped` или `failed` (их даёт и не наше возобновление, Ф15) или всё ещё `paused`;
  3. запись закончилась без отказа и без признака п. 1 → `{ resumed: false, error: TeamError E_INTERNAL, late: false }`;
  4. время вышло → `{ resumed: false, error: null, late: true }`.

  Проверки 3 и 4 — после 1 и 2 на том же шаге; на первом (синхронном) шаге 3 и 4 не срабатывают (запись ещё не
  закончилась, срок не вышел), если `ENGINE_START_WAIT_MS > 0`.

  Если движок записал возобновление, ответ уже дан («Отправлено»), а движок упал позже — это видно только из журнала при
  опросе (R2); ответ на нажатие не исправляется задним числом.
- `has(id)` — `true`, если в карте есть запись этого проекта и её `done` ещё не завершился.
- `child_process` не появляется (W1); процесс тот же; замок движка — pid сервера (Ф5). `stopAll` останавливает и движки,
  запущенные `resume` (Ctrl-C сервера снова ставит их проекты на паузу — Ф3).
- Проверка критерия 11: `grep -n 'resume' tools/src/web/engines.js` находит вызов `createEngine` в режиме `resume`.

## 8. Тексты (`texts.js`; критерий 9)

| Ключ | Текст |
|---|---|
| `paused` (заменяется; r6 — остаётся для паузы без ожидания и без вопроса по задаче) | Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше |
| `pausedBudget` (r6, ISS-0020) | Проект на паузе. Он ждал вашего решения о потолке расходов — после «Продолжить» он сразу снова спросит об этом, пока потолок не поднят. Как поднять потолок, написано в инструкции Sai Team |
| `pausedPlan` (r6) | Проект на паузе. Он ждал вашего решения: план не составился. «Продолжить» запустит составление плана заново — это тратит деньги в пределах потолка проекта, а если снова не выйдет, проект опять спросит вас |
| `pausedGoalCheck` (r6) | Проект на паузе. Он ждал вашего решения: проверка цели не прошла. «Продолжить» запустит проверку заново — это тратит деньги в пределах потолка проекта; после неё проект снова спросит вас или продолжит работу |
| `pausedTaskQuestion` (r6) | Проект на паузе. У задачи есть вопрос к вам, и пока на него нет ответа, «Продолжить» не сработает. Ответить на странице пока нельзя — это появится позже |
| `stoppedFinal` | Проект остановлен. Продолжить его нельзя |
| `ctlAlreadyPaused` | Проект уже на паузе |
| `ctlPausedAfterFailure` (r1) | Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше |
| `ctlResumedBroken` (r1) | Проект продолжен, но работа сразу прервалась. Проверьте состояние проекта через несколько секунд |
| `ctlAlreadyRunning` | Проект уже работает |
| `ctlAlreadyStopped` | Проект уже остановлен |
| `ctlFinished` | Проект уже завершён |
| `ctlNotStarted` | Проект ещё не начал работу. Повторите через несколько секунд |
| `ctlTaskDecision` | Проект ждёт вашего решения по задаче. Ответить на странице пока нельзя — это появится позже |
| `ctlBudget` | Продолжить нельзя: потолок расходов исчерпан. Как поднять потолок, написано в инструкции Sai Team |
| `ctlDecision` | Проект ждёт вашего решения. Продолжить его с этой страницы пока нельзя — это появится позже |
| `ctlStopping` | Проект сейчас останавливается, повторите через несколько секунд |
| `ctlBusy` | Команда не выполнена, повторите через несколько секунд |
| `ctlUnconfirmed` | Команда не подтверждена, проверьте состояние проекта через несколько секунд |
| `ctlDisk` | Диск не принимает записи: команда не выполнена. Освободите место и повторите |
| `ctlDiskUnsure` | Диск не принимает записи: команда могла выполниться. Проверьте состояние проекта, прежде чем нажимать снова |
| `staleKeyControl` | Sai Team был перезапущен, и эта страница устарела. Обновите страницу и повторите |
| функция `resumeFailed(why)` | Проект не продолжен: `<why>` |

Повторно используются: `sent` «Отправлено», `badRequest`, `refused`, `hostRefused`, `notFound`, `corrupt`, `readFailed`,
`chatLinkDown`, `internal`, `WHY_NOT_STARTED`, `WHY_OTHER`. После работы `grep -rn 'командой resume' tools/src/web/` пуст.
Слов «ответьте в чате» в `pausedTaskQuestion` нет: ответ в чате вопрос по задаче не закрывает (`TEXT.decisionsLater`). Ни в одном тексте нет слов «resume», «pause», «stop», «движок», «канал», «очередь», «ack», «замок», «inbox», кодов, `%`.
Постоянные подписи страницы (названия кнопок, текст подтверждения, «Отправляется…», текст «нет связи») — в `index.html`
(п. 9.1); в `public/*.js` кириллицы по-прежнему нет.

## 9. Страница (`tools/src/web/public/`; вид — описание интерфейса)

### 9.1. Элементы (идентификаторы — контракт страницы, тестов и описания интерфейса)

| Идентификатор | Что это | Постоянный текст в `index.html` |
|---|---|---|
| `#controls` | блок управления в заголовке проекта (внутри `#project-head`, после `#project-pause`) | — |
| `#ctl-pause`, `#ctl-resume`, `#ctl-stop` | кнопки `type="button"` | «Пауза», «Продолжить», «Остановить» |
| `#stop-confirm` | подтверждение: обычный элемент `role="alertdialog"`, `aria-labelledby="stop-confirm-text"`, `hidden` по умолчанию (не `<dialog>` — Ф12) | — |
| `#stop-confirm-text` | текст подтверждения | «Остановить проект? Это нельзя отменить. Начатая работа прервётся, продолжить проект потом нельзя.» |
| `#stop-yes`, `#stop-no` | кнопки подтверждения | «Остановить», «Не останавливать» |
| `#control-result` | строка итога, `aria-live="assertive"`, `data-tone`, дети `data-msg="sending"` («Отправляется…»), `data-msg="server"` (текст сервера), `data-msg="offline"` («Нет связи с сервером Sai. Проверьте состояние проекта, когда связь вернётся.») | см. слева |
| `#control-reload` | кнопка «Обновить страницу» при `reload: true` | «Обновить страницу» |
| `#project-stopped` | строка `stopped_text` под заголовком (как `#project-pause`) | — |

### 9.2. Состояние страницы (`app.js`)

Новые поля `app`: `controlApi` (строка или `null` — из `ProjectPage.controls.api` последнего ответа), `controlSeq`
(целое, начинается с 0: номер последнего запроса управления этой страницы), `controlBusy` (**r2, N2:** `Map` «адрес
управления проекта → номер запроса управления, который по этому проекту сейчас идёт»; пустая, если запросов нет),
`confirming` (логическое). «Идёт запрос по этому проекту» — `controlBusy.has(controlApi)`. При смене проекта
(`resetProject`) — `controlApi = null`, `confirming = false`, строка итога и `#control-reload` скрыты; `controlBusy` не
трогается (запрос другого проекта продолжает идти, его запись снимет только его ответ).

**(r1, L3; r2, N2) Правило сброса.** Запись `controlBusy` по адресу `api` удаляет только ответ (или отсутствие ответа) того
запроса, который её поставил: запрос запоминает свои `api` и `n`; после ответа — удалить запись `api`, только если
`controlBusy.get(api) === n`. Ответ запроса проекта A не трогает запись проекта B, и наоборот: повторный щелчок в B до
ответа B ничего не шлёт, и щелчок в A после возврата в A, пока запрос A идёт, — тоже (CTL-8h). Одновременно идут не больше
одного запроса на проект; запросы разных проектов независимы (на сервере их тоже ничто не связывает — `ctx.controlling`
по id, решение 0032, C5).

### 9.3. Поведение (функции — по именам, без кода)

- `renderControls(p)` — в каждом `renderProject`: видимость кнопок — ровно `p.controls.pause|resume|stop` (`controls` не
  объект — кнопок нет); `#controls` скрыт, если не видно ни одной кнопки и строка итога пуста. (r4) Недоступность кнопки — **только**
  `aria-disabled="true"` и блокировка нажатия в обработчике (описание интерфейса `docs/design/REQ-035-ui.md` r2, п. 4.3); атрибута
  `disabled` нет ни у одной из трёх кнопок ни в каком состоянии. Недоступны все три кнопки, пока идёт запрос по этому проекту
  (п. 9.2); «Пауза» и «Продолжить» — пока `confirming`. Доступной кнопке `aria-disabled` снимается (атрибута нет или не `"true"`).
  Недоступная кнопка остаётся в порядке Tab и может держать фокус; щелчок, Enter и пробел на ней не действуют: обработчик
  выходит первой строкой, запроса и смены состояния нет. Фокус: нажатая кнопка остаётся в фокусе во время запроса и после
  ответа (`document.activeElement` не меняется перерисовкой); если после опроса она исчезла (`hidden`) — фокус на `#project-goal`. Если подтверждение
  открыто, а в свежем ответе `controls.stop === false` (проект остановили или он завершился, например из второй вкладки),
  подтверждение закрывается без запроса. `#project-stopped` — `stopped_text`, как `#project-pause` — `pause_text`.
  (r2, N2) Если идёт запрос по этому проекту, а строка итога пуста (человек вернулся в проект, пока его запрос идёт), —
  строка итога «Отправляется…».
- `openConfirm()` — щелчок `#ctl-stop`: если идёт запрос по этому проекту или `confirming` — ничего; иначе `confirming =
  true`, `#stop-confirm` видим, фокус на `#stop-no`. **Запроса нет.**
- `closeConfirm(moveFocus)` — (r5, F1) закрывает подтверждение: `#stop-confirm` скрыт, `confirming = false`, запроса нет.
  Закрытие кнопкой `#stop-no`, клавишей Escape (пока подтверждение открыто и карточка не открыта) и кнопкой `#stop-yes`
  внутри подтверждения — **всегда** с переносом фокуса: на `#ctl-stop`, если он виден, иначе на `#project-goal`.
  Закрытие **сменой адреса страницы** и **опросом с `controls.stop === false`** — без запроса, и фокус переносится
  **только если он был внутри `#stop-confirm`** и на экране тот же проект (по тому же правилу: `#ctl-stop`, иначе
  `#project-goal`); иначе фокус не трогают (не отбирать его у поля чата и карточки; на скрытую кнопку прежнего проекта
  фокус не ставят). Это совпадает с `docs/design/REQ-035-ui.md` п. 5.2 и 11 и с кодом (handoff
  `handoffs/PROD-20261011-01/step-15-frontend-dev.json`, I2). Принятое ограничение (L1, Low): если фокус был внутри
  подтверждения и адрес сменился на другой проект или список, фокус теряется (уходит на `body`); код не правится.
- `submitControl(action)` — щелчок `#ctl-pause` («pause»), `#ctl-resume` («resume»), `#stop-yes` (сначала
  `closeConfirm()`, затем «stop»). **Первым делом и синхронно:** если `controlApi === null` или идёт запрос по этому
  проекту — выход без запроса (защита от двойного щелчка — эта проверка, а не вид кнопки: `aria-disabled` лишь показывает
  состояние, второй щелчок может прийти до перерисовки; (r4) то же для Enter и пробела на недоступной кнопке); иначе `controlSeq += 1`, `api = controlApi`, `n = controlSeq`, в `controlBusy`
  запись `api → n`, перерисовка кнопок, строка итога «Отправляется…». Тело — п. 3.2 (у «stop» — `confirmed: true`). Запрос —
  единственная функция `post` страницы (тот же `fetch`, `Content-Type: application/json`, `X-Sai-Page`). После ответа
  или обрыва: запись `api` удаляется, только если `controlBusy.get(api) === n` (п. 9.2); если `controlApi !== api`
  (страница сейчас показывает другой проект) — ничего не показывать; иначе 2xx — `result_text`, тон «ok»; отказ с текстом — `error_text`, тон «warn» у
  504, «err» у остальных, `reload: true` → видна `#control-reload`; нет ответа — `data-msg="offline"`, тон «err». Затем
  сразу `poll()` — состояние и кнопки берутся из журнала (R2), не из ответа на нажатие.
- Строка итога остаётся до следующего нажатия или смены проекта; ввод в чате её не трогает.
- `#control-reload` — `window.location.reload()`, как у чата.

### 9.4. Гонки и спорные места — решения по коду

| Случай | Что происходит | Почему так |
|---|---|---|
| «Пауза», пока сообщение чата ждёт подтверждения (до 10 с) | Кнопки управления не зависят от `app.sending`; на сервере идут два независимых `deliver`, у каждого своё сообщение канала со своим номером; движок берёт их по порядку номеров и отвечает на каждое. Пауза не мешает чату (сообщение на паузе принимается); если первым пришло «Остановить» — сообщение чата получает `E_ENGINE_STOPPING` → «Проект останавливается — сообщение не принято» (`engine.js`, `receive`: после остановки всё отклоняется) | у движка одна очередь и одна запись в одном потоке (п. 13 движка); сервер ничего не упорядочивает сам |
| Двойной щелчок по «Пауза»/«Продолжить» до ответа | Второй щелчок выходит на первой строке `submitControl` (идёт запрос по этому проекту, п. 9.2) — один запрос, одно событие | флаг ставится синхронно до первого `await` |
| (r1, L3; r2, N2) Запрос в проекте A не ответил, человек перешёл в проект B и нажал там, потом вернулся в A | Запрос B добавляет запись `B → n`; запись A остаётся. Повторный щелчок в B до ответа B — без запроса; после возврата в A, пока запрос A идёт, кнопки A с `aria-disabled="true"`, строка итога «Отправляется…», щелчок в A — без запроса. Ответ A удаляет только запись A и, если страница показывает A, — его текст; запись и строку B не трогает | признак — по проекту, сброс — только ответом своего запроса (п. 9.2) |
| Двойной щелчок по «Остановить» | Первый открывает подтверждение, второй — ничего (`confirming`); «Остановить» в подтверждении закрывает его до запроса — повторный щелчок по нему невозможен | — |
| Две вкладки, «Пауза» из первой, затем из второй | Вторая: чтение журнала показывает `paused` → 409 «Проект уже на паузе» до отправки; если обе прочли `running` одновременно — один ответ «Отправлено», второй либо 409 `ctlBusy` (тот же сервер, `ctx.controlling`), либо отказ движка `E_PAUSE_STATE` → перечитывание → «Проект уже на паузе». В журнале одно `PROJECT_PAUSED` | правило движка в одной операции с записью (Ф2) |
| Две вкладки, подтверждение остановки открыто во второй, первая остановила проект | Опрос второй вкладки получает `controls.stop === false` → подтверждение закрывается; если «Остановить» нажата раньше опроса — 409 «Проект уже остановлен» | п. 9.3 |
| Ошибка движка при паузе | Отказ в ack → его код → п. 6.4; движок завершается (`fatal` или остановка) → «Проект сейчас останавливается…»; движок завис → через 10 с «Команда не подтверждена…»; движок убит (SIGKILL) до отправки — `deliver` открывает писателя ядра, и исход зависит от журнала (Ф14): (1) **была идущая работа** (открытый запуск или задача «в работе») — ядро само восстанавливает проект (`LOCK_STALE_REMOVED`, `RUN_FINISHED` interrupted, `TASK_INTERRUPTED`, `PROJECT_RECOVERED` → «на паузе»), пауза получает `E_PAUSE_STATE`, `PROJECT_PAUSED` **не** пишется → п. 6.4, строка «состояние» → 409 «Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше»; (2) **прерывать нечего** (проект «ждёт решения», или «в работе» без запусков и задач в работе) — `LOCK_STALE_REMOVED` и одно `PROJECT_PAUSED` USER → 200 «Отправлено» (критерий 8 (в), критерий 5); умер во время ожидания → «Команда не подтверждена…» (отозванное сообщение не исполнится, п. 13.6 движка). Сервер команду не повторяет и журнал сам не пишет | критерий 8 |
| Опрос раз в 5 с и кнопки | Кнопки перерисовываются каждым опросом из `controls`; после ответа на нажатие — опрос сразу (`poll()` начинает новое поколение, старые ответы отбрасываются по `gen`). Пока идёт запрос — кнопки недоступны (`aria-disabled="true"`, фокус остаётся на нажатой); после ответа и до прихода опроса видны прежние кнопки: повторное нажатие даст правдивый отказ сервера («уже на паузе»), а не второе событие | состояние — только из журнала (R2) |
| «Продолжить» из двух вкладок одновременно после перезапуска сервера | Первая — `engines.resume`; вторая — 409 `ctlBusy` (`ctx.controlling`) или, если первая уже ответила, `has(id)` → `deliver` → движок: проект уже идёт → `E_ALREADY_RUNNING` → перечитывание → «Проект уже работает». Второго движка нет (`resume` при записи в карте не создаёт движок) | п. 7 |
| (r2, F3) Проект ждал решения и встал на паузу — кнопкой «Пауза», командой из терминала или остановкой сервера (Ctrl-C), — затем «Продолжить» (в том числе после перезапуска сервера) | Видна «Продолжить» и `pause_text` (r6: текст по причине ожидания, п. 4, 8); `controlRefusal` даёт `null` (нет вопроса по задаче) → движок (`deliver` к живому или `engines.resume`) пишет `PROJECT_RESUMED` → 200 «Отправлено». Дальше — правило движка (Ф16): потолок не поднят — сразу снова «ждёт решения» и вопрос о потолке, запусков и расходов нет, опрос показывает «ждёт решения пользователя», «Пауза» и «Остановить»; потолок поднят — работа идёт; (r3, F5) `plan_failed` — планирование заново, `goal_check_failed` — новая проверка цели: новый платный запуск в пределах потолка проекта, затем снова ожидание или работа дальше. С вопросом по задаче — 409 `ctlTaskDecision` (как движок) | ORCH, F3 вариант 1: «Продолжить» у паузы — как движок; обход «Пауза» → «Продолжить» принят (решение 0032, C4); описание требования о перезапуске сервера |
| Страница открыта до перезапуска сервера | POST с прежним ключом → 403 `reload: true`, `TEXT.staleKeyControl`, кнопка «Обновить страницу»; GET работают | W2 |
| Проект «в работе», но его никто не ведёт (сервер вышел без паузы, код 1 по п. 8.4 проекта REQ-011) | Видны «Пауза» и «Остановить»; «Пауза» → `deliver` сам: ядро восстанавливает проект (запуски прерваны, `PROJECT_RECOVERED` → «на паузе») и отказывает в паузе `E_PAUSE_STATE` → перечитывание → «Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше»; если прерывать нечего — пишется `PROJECT_PAUSED` (Ф14). Дальше «Продолжить» запускает движок `resume` | правда журнала; README говорит, как продолжить (п. 13) |

## 10. Пути отказа (что видит человек и что неизменно; Q10)

Каждый отказ — `Failure` с `Content-Type: application/json; charset=utf-8`, без стека, кода, пути, pid и ключа; `field:
null`. Следующий запрос сервер обслуживает как обычно (каждый обработчик в своём `try`, `run` → `internalError`).

| Случай | HTTP | `error_text` | Что неизменно |
|---|---|---|---|
| чужой `Host` | 403 | «Запрос отклонён» | всё; ядро не вызывается |
| чужой `Origin`, нет `Origin`, `text/plain`, нет ключа, ключ не 64 hex | 403 | `TEXT.refused` | журнал (хеш), замок (pid), `inbox/` (список файлов) |
| ключ правильного вида не этого запуска | 403, `reload: true` | `TEXT.staleKeyControl` | то же |
| тело > 4096 байт (по `Content-Length` или по факту) | 400 | `TEXT.badRequest` | то же; обработчик не вызывается |
| тело не JSON / не объект / не та форма п. 3.2 (лишний ключ, неизвестное действие, нет `confirmed: true` у остановки) | 400 | `TEXT.badRequest` | то же |
| тело не дочитано за `bodyIdleMs` | 408 | `TEXT.internal` | то же (как REQ-011) |
| `GET` и другие методы на адрес управления | 405, `Allow: POST` | `TEXT.badRequest` | то же |
| id не по шаблону (`../x`, абсолютный путь), несуществующий проект | 404 | «Не найдено» (байт в байт как у всех «не найдено») | то же |
| отказ «строже движка» и по состоянию (таблица п. 5.2) | 409 | текст строки | журнал (хеш), `inbox/` пуст |
| ещё идёт команда по этому проекту в этом сервере | 409 | `TEXT.ctlBusy` | то же |
| (r1) «Продолжить»: движок записал возобновление и сразу завершился с ошибкой (п. 6.3, 7) | 500 | `TEXT.ctlResumedBroken` | журнал — только события движка и ядра (`PROJECT_RESUMED` и правда сбоя); сервер ничего не дописывает |
| п. 6.4, все строки | см. п. 6.4 | см. п. 6.4 | журнал не изменён, кроме: событий восстановления ядра (правда), события, записанного до потери ack (`E_CHANNEL_UNCONFIRMED`, тогда страница покажет его при опросе), и `ctlDiskUnsure` (запись не гарантирована) |
| нет связи с сервером (страница) | — | постоянный текст `data-msg="offline"` | страница не повторяет запрос сама |

## 11. Места записи и сеть (критерий 5)

| Действие | Через что | Что пишет |
|---|---|---|
| пауза, остановка | `deliver` (`api.js`) | файл сообщения канала (живой движок; событие пишет движок) или журнал через писателя ядра |
| продолжение при живом движке | `deliver` (`api.js`) | файл сообщения канала; событие пишет движок |
| продолжение без движка | `ctx.engines.resume` → `createEngine(…, { mode: "resume" }).run()` (`engines.js`) | журнал — писатель ядра движка; `inbox/` — `openInbox` движка |

Проверки на файлах после работы (те же, что в критерии 5): `grep -rnE 'appendFile|writeFile|createWriteStream|openSync|rename'
tools/src/web/` пусто; `grep -rn 'inbox' tools/src/web/` пусто (`engineHolder` и `deliver` — функции `channel.js`, путь
папки в сервер не попадает); `grep -rn 'deliver' tools/src/web/` находит `api.js` (импорт и вызовы в `postChat`,
`postControl`); `grep -rlE 'node:(https|net|tls|dgram)' tools/src/web/` пусто; `grep -rnE
'node:(http|https|net|tls|dgram)|fetch[(]' tools/src/team/` пусто. Новой сети нет: запрос управления — тот же `post`
страницы на свой сервер.

## 12. Изменение общих функций — где используются и что с каждым будет

| Функция / значение | Где используется | Что будет |
|---|---|---|
| `readBody(req, res, route)` (`server.js`) | маршруты создания и чата; новый маршрут управления | создание и чат: `route.bodyMax` и `route.overBody` не заданы → прежний `BODY_MAX` и прежний 413 `TEXT.tooBig` с `route.field` (WEB-15 (в), WEB-9e не меняются); управление — 4096 и 400 |
| `writeAllowed(req, route)` (`server.js`) | все POST | создание и чат: `route.staleText` не задан → прежний `TEXT.staleKey` (WEB-9g не меняется) |
| ветка `GET` и `allowOf` (`server.js`) | все маршруты API | у маршрутов с `get` — как было; у маршрута без `get` — 405 `Allow: POST` вместо исключения |
| `routeOf` (`server.js`) | все пути API | добавлена ветка `control`; прочие пути и их «не найдено» не меняются |
| `projectPage` (`display.js`) | `getProject` | новые поля `controls`, `stopped_text`; текст `pause_text` другой (WEB-4g и README — п. 13, 15); (r6) `pause_text` вычисляет `pauseText(state, events)`, у паузы без ожидания и без вопроса значение то же, что было |
| `TEXT.paused` (`texts.js`) | `projectPage`; тесты WEB-4g (`team-web-project.test.js:806`), WEB-7a (все тексты) | текст другой; WEB-4g правит TEST-DESIGNER (ожидаемый провал между шагами 2 и 5, п. 18); (r6) значение `paused` не меняется, но поле `pause_text` у ждавшего проекта и при вопросе по задаче — другие ключи (п. 8); прежний тест CTL-3d меняет ожидание на `pausedBudget` |
| `controlRefusal("pause", …)` у `paused` (`display.js`) (r6) | `postControl` (`api.js`); CTL-5b′, CTL-7a, CTL-8c′ | только строка `recovery` + вопрос по задаче: вместо `ctlPausedAfterFailure` — `ctlAlreadyPaused`; без вопроса — как раньше |
| `createEngines` (`engines.js`) | `main.js`, тесты `fakeEngines` (`team-web-helpers.js:59`) | `start`, `stopAll`, `size` не меняются; (r1) новый необязательный параметр `create` (фабрика движка, по умолчанию `createEngine`) — `main.js` его не передаёт, поведение сервера прежнее; поддельные движки тестов дополняются `resume` и `has` (TEST-DESIGNER) |
| `controlRefusal` (`display.js`, новая) | `postControl` (шаг 4), `controlFailure` (строка «состояние») | строки `paused` (вопрос по задаче, пауза после сбоя; r2 — без строк ожидания, п. 5.2) действуют в обоих местах одинаково |
| `deliver`, `engineHolder` (`channel.js`) | только вызываются | не меняются |
| `createEngine` (`engine.js`) | только вызывается с `mode: "resume"` | не меняется (вне области REQ-035) |

## 13. README (`tools/README.md`, раздел `## Sai Team — интерфейс`; критерий 12)

Добавить (BACKEND-DEV): у проекта три кнопки — «Пауза» (планирование, в работе, ждёт решения), «Продолжить» (на паузе),
«Остановить» (планирование, в работе, на паузе, ждёт решения), у остальных кнопок нет; «Остановить» спрашивает
подтверждение; **остановка необратима** — остановленный проект продолжить нельзя ни кнопкой, ни из терминала; проект,
ждущий решения, продолжается ответом на вопрос, а не кнопкой (потолок расходов — командой `budget` из терминала); после
перезапуска сервера проект на паузе продолжается кнопкой «Продолжить» (сервер сам запускает работу проекта), (r2, F3) и
если он ждал решения, когда его поставили на паузу, — при ожидании из-за потолка расходов без поднятого потолка он сразу снова будет ждать решения, а при ожидании из-за плана или проверки цели «Продолжить» может сделать новый платный запуск в пределах потолка проекта; из терминала —
по-прежнему `npm run team -- resume <id>` (строка с вымышленным id остаётся); страница пишет только через движок проекта —
сама она ничего не записывает. (r6, ISS-0020) Строка про перезапуск сервера остаётся для проекта, который ничего не ждал; дописать: «если проект до паузы ждал вашего решения или у задачи есть вопрос, строка скажет об этом прямо и объяснит, что сделает «Продолжить»»; в абзаце про паузу ждавшего проекта согласовать слова с п. 8 (потолок не поднят — «сразу снова спросит об этом»; план или проверка цели — «новый платный запуск в пределах потолка проекта») и добавить: «если у задачи открыт вопрос, «Продолжить» не сработает, пока вопрос без ответа; ответ в чате вопрос не закрывает». Прежнюю фразу «страница проекта покажет «Проект приостановлен, продолжите его командой
resume»» заменить новым текстом `pause_text`. Проверка — команды критерия 12 (`awk … | grep -c` со словами
`Продолжить`, `необратима`, `Пауза`, `Остановить` — не меньше 1; `resume` — не меньше 2).

## 14. Проверка в настоящем браузере (AP-060, критерии 1 и 10)

DESIGN-QA-VALIDATOR (WF-02, шаг 7) запускает `cd tools && npm run team-web -- --port 0 --executor scripted --scenario
<файл сценария вне проекта>` на временной `SAI_TEAM_HOME`, открывает настоящие `index.html` и `app.js` в браузере и
снимает страницу проекта в окнах 1470 × 784 и 375 × 812 (снимки — `docs/design/samples/`, имена — по описанию интерфейса):

| Состояние | Как получить на сервере |
|---|---|
| в работе: «Пауза», «Остановить» | сценарий с задачами по 20–30 с, проект создан со страницы |
| на паузе: `pause_text`, «Продолжить», «Остановить» | «Пауза» в том же проекте |
| подтверждение остановки | щелчок «Остановить» |
| остановлен: `stopped_text`, кнопок нет | «Остановить» в подтверждении |
| ошибка «Команда не подтверждена…» | движок отдельным процессом (`npm run team -- start <id>` с тем же `SAI_TEAM_HOME`), `kill -STOP <pid>`, «Пауза», ждать ответа (10–12 с), затем `kill -CONT` |
| ждёт решения: «Пауза», «Остановить», без «Продолжить» | сценарий с исчерпанием потолка (малый потолок) |
| создан / выполнен / не удалось — без кнопок | проект без движка (созданный при остановленном сервере), сценарий до конца, сценарий с провалом |

В обоих окнах: нет горизонтальной прокрутки, кнопки и тексты не обрезаны и не налезают, подтверждение целиком видно,
фокус после открытия подтверждения — на «Не останавливать». Сценарий BA-ANALYST и запуск UAT-RUNNER (критерий 10) — на
таком же сервере. Тесты на модели DOM (п. 15) проверяют логику, а не вид; вид доказывают только эти снимки (AP-060).

## 15. Критерий → тест

Файлы: `tools/test/team-web-control.test.js` (сервер в процессе теста, фикстуры через API ядра — помощники
`team-web-helpers.js`, `team-web-fixtures.js`; (r1, L4) здесь же CTL-1b — настоящие `index.html` и `app.js` на модели
`team-web-dom.js`, как называет критерий 1), `tools/test/team-web-control-page.test.js` (остальные тесты страницы:
настоящие `index.html` и `app.js` на модели `team-web-dom.js`, поддельный `fetch` со счётчиком запросов записи), `tools/test/team-web-control-engine.test.js`
(scripted, движок — отдельный процесс `spawnEngine` из `team-engine-helpers.js` или движок сервера; сервер командой —
`spawnWeb`). Каждый тест отказа сверяет неизменность: хеш журнала, pid в замке, список файлов `inbox/` проекта, а где
сказано — рекурсивный список путей и хешей `SAI_TEAM_HOME`. Ожидание — по событию журнала (`until`), не паузой, кроме
окон времени, которые задаёт критерий. «Счётчик запусков scripted» по задаче — число событий `RUN_STARTED` с
`data.purpose === "work"` и этой задачей (Ф6). Ключ страницы тест берёт как страница (`GET /`, `meta[name="sai-page"]`).

| Критерий | Элемент проекта | Тест (файл, id) | Что упадёт при нарушении |
|---|---|---|---|
| 1. Какие кнопки когда | п. 4, 5.1, 9.1, 9.3 | CTL-1a (`team-web-control.test.js`): `projectsInEveryStatus` — у `GET` проекта каждого статуса `controls` = строке таблицы п. 5.1, `controls.api` = `/api/projects/<id>/control`; `pause_text` = «Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше» только у `paused` (фикстура `projectsInEveryStatus` — пауза без ожидания и без вопроса по задаче; (r6, ISS-0020) у пауз с ожиданием и вопросом по задаче — тексты п. 8, CTL-14a), `stopped_text` = «Проект остановлен. Продолжить его нельзя» только у `stopped`; CTL-1b (`team-web-control.test.js`, модель DOM `team-web-dom.js` — по словам критерия 1): тела из CTL-1a в модели DOM — видимы ровно эти кнопки, тексты строк `#project-pause`, `#project-stopped`; CTL-1c: `grep -rn 'командой resume' tools/src/web/` пусто (чтение файлов теста); вид — п. 14 (критерий 10); (r6) CTL-14a…14c — тексты пауз по причине, свойство правдивости, строка и кнопка в модели DOM (п. 15.2) | кнопка не в том статусе, «Продолжить» у «ждёт решения», кнопки у «создан», прежний текст. (r6) Дефект ISS-0020 закрывают CTL-14a…14f ниже |
| 2. Пауза | п. 6.2, Ф1, Ф7 | CTL-2 (`team-web-control-engine.test.js`): scripted, три независимые задачи по 3 с, предел 1, движок — `spawnEngine(start)`; сервер в процессе теста; во время задачи 1 — POST «pause» → 200 «Отправлено»; одно `PROJECT_PAUSED` USER; замок — тот же pid и держатель `engine` до и после; проверка — по порядку событий журнала (критерий 2, редакция `4662844`): после `PROJECT_PAUSED` нет ни одного `TASK_STARTED` (счёт `TASK_STARTED` через 5 с равен счёту на `seq` события `PROJECT_PAUSED`); запуск задачи 1 доходит до итога — после `PROJECT_PAUSED` есть `RUN_FINISHED` этого запуска (`data.purpose === "work"`, задача `t-0001`), его фразы после паузы допустимы; `GET` через 5 с: `status_text` «на паузе», `controls` = `{pause:false, resume:true, stop:true}`, фраза «Проект на паузе» есть в `happening` | второе событие, старт задачи на паузе, обрыв идущего запуска, смена держателя замка, нет фразы «Проект на паузе», нет кнопки «Продолжить» |
| 3. Продолжить | п. 6.3, 7, Ф5, Ф6 | CTL-3a: тот же проект (движок процесса жив) — POST «resume» → одно `PROJECT_RESUMED` USER, проект доходит до «выполнен», `GET` сразу после события — «в работе» и фраза «Работа над проектом продолжается»; CTL-3b: сервер командой `spawnWeb` на scripted, проект создан через POST, во время задачи 2 — `SIGINT` серверу, выход; второй `spawnWeb` на той же `SAI_TEAM_HOME`; `GET` — «на паузе», `controls.resume`; POST «resume» → `writer.lock` держатель `engine` с pid **нового** сервера, одно `PROJECT_RESUMED`, «выполнен»; запуски: не начатая к сигналу — 1, готовая до паузы — 1, прерванная — не больше 2, у неё одно `TASK_DONE`; CTL-3c (r1, L6; `team-web-control.test.js`): (i) (r2, F4) `createEngines({ home, env, warn, create })` с поддельной фабрикой «открывается на следующем макрошаге»: `create(id, opts)` возвращает движок с признаком `opened = false`; `state()` — `null`, пока `opened` ложно, затем `{ status: S }`; `run()` возвращает обещание и ставит `setTimeout(…, 0)`, в котором сначала `opened = true`, затем обещание отклоняется `TeamError` `E_DISK` (как настоящий движок: писатель открывается не сразу, отказ — после открытия; Ф15, Ф17). По п. 7 первая (синхронная) проверка видит `state() === null` и `entry.error === null` → ожидание `START_POLL_MS`; к второй проверке таймер 0 уже сработал (он раньше таймера `START_POLL_MS`), `entry.error` записан, запись закончена, `state()` — S. Ожидание: S = `running` → ровно `{ resumed: true, error: E_DISK, late: false }` (порядок M26 даёт `resumed: false`); S = `paused` → `{ resumed: false, error: E_DISK, late: false }`; S = `stopped` → `{ resumed: false, error: E_DISK, late: false }`; в каждом случае фабрика вызвана ровно раз с `mode: "resume"`; (iii) (r2, F4) поддельная фабрика, у которой `state()` сразу `{ status: "running" }`, а `run()` не завершается: тест вызывает `resume(id)`, сразу после вызова ставит `setTimeout(…, 0)` с отметкой, и к исполнению обещания `resume` отметки нет (ответ дан на первой, синхронной проверке, до первого ожидания), ответ `{ resumed: true, error: null, late: false }`; после теста движок останавливается (`requestStop` поддельного движка завершает `run()`); (ii) сервер с поддельными движками, у которых `resume` даёт `{ resumed: true, error: TeamError E_DISK, late: false }`, проект на паузе без движка — POST resume → 500 «Проект продолжен, но работа сразу прервалась. Проверьте состояние проекта через несколько секунд», `ctx.warn` не вызывается обработчиком, хеш журнала тот же; CTL-3d (r2, F3; `team-web-control-engine.test.js`; описание требования «после перезапуска кнопка «Продолжить» ведёт их дальше»): сервер командой `spawnWeb` на scripted с потолком, который исчерпывается (как EN-40: потолок 0,2, запуски по 0,05), проект создан через POST; ждать (`until`) `PROJECT_WAITING` reason `budget`; `SIGINT` серверу, выход; в журнале `PROJECT_PAUSED` USER, `state.waiting` — `{reason:"budget"}`; второй `spawnWeb` на той же `SAI_TEAM_HOME`; `GET` — «на паузе», `pause_text` критерия 1, `controls` = `{pause:false, resume:true, stop:true}`; POST resume → 200 «Отправлено»; новые события — ровно одно `PROJECT_RESUMED` USER (`data.after === "command"`), затем `PROJECT_WAITING` ENGINE reason `budget` и вопрос (`CHAT` kind `question`) о потолке; ни одного `RUN_STARTED` после `PROJECT_RESUMED`, `spent_usd` тот же; `GET` после события — «ждёт решения пользователя», `controls` = `{pause:true, resume:false, stop:true}`; вариант (тот же файл): пауза кнопкой (POST pause у ждущего проекта, движок сервера жив) → POST resume → те же новые события через канал | `deliver` вместо движка (`E_INTERNAL`), режим `start` (`E_NOT_STARTABLE`), повторный запуск готовой задачи, «Проект не продолжен» при записанном возобновлении, отказ «Продолжить» проекту, поставленному на паузу остановкой сервера во время ожидания |
| 4. Остановить и подтверждение | п. 3.2, 6.2, 9.3, Ф8, Ф9 | CTL-4a (страница): щелчок `#ctl-stop` — 0 запросов записи, виден `#stop-confirm` с текстом критерия, кнопки «Остановить» и «Не останавливать»; `#stop-no` и Escape — 0 запросов, подтверждение скрыто, `document.activeElement` — `#ctl-stop` (если виден, иначе `#project-goal`); (r5, F1) `#stop-yes` — фокус по тому же правилу; смена адреса на другой проект при открытом подтверждении и фокусе в поле чата (или карточке) — подтверждение скрыто, 0 запросов, `document.activeElement` не изменился; опрос с `controls.stop === false` при открытом подтверждении: фокус был внутри `#stop-confirm` — перенесён по правилу, фокус был вне — не изменился; `#stop-yes` — ровно 1 запрос, тело `{"action":"stop","confirmed":true}`; хеш журнала до и после «Не останавливать» и Escape (сервер на фикстуре за поддельным `fetch`) равен; CTL-4b (движок): scripted с идущей задачей, POST stop — одно `PROJECT_STOPPED` USER, `RUN_FINISHED` отменён, задача «прервана», через 5 с `GET` — «остановлен», фраза «Проект остановлен», `controls` все `false`; CTL-4c: прямой POST `{"action":"stop"}` и `{"action":"stop","confirmed":false}` с верными заголовками → 400 «Запрос не понят. Обновите страницу», хеш журнала тот же; CTL-4d: остановленный проект, POST resume → 409 «Проект остановлен. Продолжить его нельзя», хеш тот же, статус «остановлен» | запрос без подтверждения, остановка без `confirmed`, продолжение остановленного |
| 5. Запись только через движок и канал | п. 6.2, 11 | CTL-5a: команды п. 11 (чтение файлов теста, как TR-4b); CTL-5b (r1, F1): фикстура через API ядра — проект `running` с планом (`withPlan`), **без открытых запусков и без задач «в работе»**, писатель закрыт, `writer.lock` с pid завершённого процесса (`deadPid()`) и держателем `engine`; сервер без движка — POST pause → 200 «Отправлено», новые события ровно `LOCK_STALE_REMOVED` ENGINE и одно `PROJECT_PAUSED` USER, статус «на паузе» (Ф14, случай A); вариант CTL-5b′: та же фикстура, но задача «в работе» с открытым запуском — POST pause → 409 «Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше», `PROJECT_PAUSED` нет, есть `PROJECT_RECOVERED`, `GET` — «на паузе», `controls.resume` (Ф14, случай B); CTL-5c: «право записи держит процесс, не движок» — замок держит писатель ядра без держателя `engine`, открытый в процессе теста вызовом `openWriter(id, { home })`, тем же, что делает короткая команда `say` (`cli.js`, `say` → `openWriter(id, { env })`); (r1, L4) настоящий процесс `say` держит замок миллисекунды, и тест с ним зависел бы от гонки — механизм тот же (держатель — писатель ядра, не движок), поэтому тест берёт его напрямую; POST pause → 409 «Команда не выполнена, повторите через несколько секунд», хеш тот же | запись в обход `deliver`, путь `inbox/` в сервере, сеть, неправдивый ответ на паузу после сбоя |
| 6. Защита записи | п. 3.2, 3.4, 10 | CTL-6a: шесть запросов (чужой Host, чужой Origin, без Origin, `text/plain`, без ключа, ключ другого запуска) на проект `running` с движком процесса → отказ; хеш журнала, pid замка, список `inbox/` до и после равны; CTL-6b: ключ прежнего запуска — 403 `reload: true`, `TEXT.staleKeyControl`, в теле нет цели и id проекта; CTL-6c: лишний ключ, неизвестное действие, не JSON, 8192 байта (**верное тело** `{"action":"pause"}`, дополненное пробелами до 8192 байт, на проекте `running`), 4097 байт (то же) → 400 «Запрос не понят»; ровно 4096 байт (то же) → 200 и одно `PROJECT_PAUSED` (граница); CTL-6d: `../x`, абсолютный путь (`%2F…`), несуществующий `p-20990101-a1b2c3` — один код и тело байт в байт; CTL-6e: ни один ответ всех тестов файла и ни одна строка журнала не содержат ключа; CTL-6f: все GET (в том числе GET адреса управления → 405 `Allow: POST`) — рекурсивный список путей и хешей `SAI_TEAM_HOME` до и после равен | обход проверки, нет предела маршрута, «Сообщение слишком большое» вместо «не понят», различимое «не найдено», запись при GET |
| 7. Тексты отказов | п. 5.2, 6.4, 8 | CTL-7a: таблица «состояние, действие → текст» на фикстурах (каждая строка п. 5.2 и строки критерия 7), хеш журнала после каждого отказа тот же; у «ждёт решения» (поднятый потолок — фикстурное `BUDGET_SET` после `PROJECT_WAITING`) и «создан» — `inbox/` пуст; CTL-7b: сбои — движок завершается (движок сервера после `requestStop("signal")` с долгой задачей → «Проект сейчас останавливается…»), замок у не-движка, EIO на запись (`withFaults` из `fault-inject.js`) → `ctlDisk`, сбой отката → `ctlDiskUnsure`, испорченная строка в середине журнала → `TEXT.corrupt`, нет проекта → «Не найдено»; следующий `GET /api/projects` — 200; CTL-7c: `controlFailure(ctx, id, action, err)` для каждого кода п. 6.4 даёт статус и текст строки, у строки «состояние» — перечитанный текст (фикстура `stopped` + `E_PAUSE_STATE` → «Проект уже остановлен»), `ctx.warn` вызывается только у последней строки, ровно раз; во всех ответах нет стека, `E_…`, путей; (r2) в таблице CTL-7a строка «на паузе с вопросом по задаче, «Продолжить»» → «Проект ждёт вашего решения по задаче…» (как движок, п. 5.2) и строка «на паузе, поставленной во время ожидания по потолку (фикстурное `PROJECT_WAITING` reason `budget`, затем `PROJECT_PAUSED`), «Пауза»» → «Проект уже на паузе»; (r6) CTL-14d — «Пауза» у `recovery` с вопросом по задаче и «Продолжить» при вопросе (п. 15.2) | неверный текст, `err.message` на странице, падение сервера |
| 8. Нет подтверждения и обрывы | п. 6.2, 6.4, 9.3, 9.4 | CTL-8a (движок): `kill -STOP` движка процесса, POST pause → ответ через 10–12 с, «Команда не подтверждена, проверьте состояние проекта через несколько секунд»; после `SIGCONT` и 2 с — `PROJECT_PAUSED` от этого нажатия нет; следующий POST pause — 200 (кнопки снова доступны: CTL-8f); CTL-8b: движок процесса с предзагрузкой `tools/test/fixtures/team/no-ack.js` (новый: первая запись в `ack/` падает EIO) — ответ тот же, `PROJECT_PAUSED` в журнале одно, `GET` после — «на паузе»; CTL-8c (r1, F1; критерий 8 (в)): движок — отдельный процесс `spawnEngine(start)` на scripted с малым потолком; ждать (`until`) `PROJECT_WAITING` reason `budget` — состояние фикстуры: «ждёт решения», **открытых запусков и задач «в работе» нет**, движок жив и держит замок; `SIGKILL` движка, дождаться его выхода; POST pause → 200 «Отправлено»; новые события ровно `LOCK_STALE_REMOVED` ENGINE и одно `PROJECT_PAUSED` USER; `GET` — «на паузе» (Ф14, probe K ворот); CTL-8c′ (второй случай, не слова критерия 8 (в), а правда о нём): сценарий CTL-8 (задачи по 3 с), `SIGKILL` движка **во время задачи** — POST pause → 409 «Проект уже на паузе: работа прервалась из-за сбоя. Нажмите «Продолжить», чтобы работа пошла дальше»; `PROJECT_PAUSED` в журнале нет; новые события — `LOCK_STALE_REMOVED`, `RUN_FINISHED` (interrupted), `TASK_INTERRUPTED`, `PROJECT_RECOVERED` (все ENGINE); `GET` — «на паузе», `controls.resume`; сервер команду не повторяет (второго `deliver` нет: повторный POST pause → 409 тот же текст, новых событий нет); CTL-8d (страница): два щелчка `#ctl-pause` подряд до ответа (поддельный `fetch` держит ответ) — 1 запрос; на сервере одно событие (сервер за `fetch`); CTL-8e: две «вкладки» — POST pause, затем второй POST pause → 409 «Проект уже на паузе», одно `PROJECT_PAUSED`; CTL-8f (r4; страница): до ответа у нажатой «Пауза» `getAttribute("aria-disabled")` равен `"true"`, атрибута `disabled` нет ни у одной из трёх кнопок (`hasAttribute("disabled")` ложь), `document.activeElement` — нажатая кнопка (после `focus()` перед щелчком); щелчок, `click()` и события клавиатуры Enter и пробел на ней — запросов по-прежнему 1; после ответа 504 `aria-disabled` у всех трёх снят (не `"true"`), `disabled` по-прежнему нет, `document.activeElement` — та же кнопка, строка итога — текст ответа, сразу новый опрос; если опрос вернул `controls` без этой кнопки (она `hidden`) — `document.activeElement` это `#project-goal`; CTL-8g (r1, L2; `team-web-control.test.js`): сервер с поддельными движками (`fakeEngines`), у которых `has` → `false`, а `resume` → `{ resumed: false, error: null, late: true }`; проект на паузе, замка нет — POST resume → 504 «Команда не подтверждена, проверьте состояние проекта через несколько секунд», хеш журнала тот же, `resume` поддельных движков вызван ровно раз; CTL-8h (r1, L3; r2, N2; страница): поддельный `fetch` держит ответы на POST; щелчок `#ctl-pause` в проекте A — 1 запрос; смена адреса на проект B, щелчок `#ctl-pause` в B — 2 запроса; смена адреса обратно на A (опрос A отдаёт те же `controls`) — кнопки A с `aria-disabled="true"`, строка итога «Отправляется…»; щелчок `#ctl-pause` в A — запросов по-прежнему 2; смена адреса на B, отпустить ответ A — кнопки B остаются с `aria-disabled="true"`, строка итога B — «Отправляется…»; ещё щелчок `#ctl-pause` в B — запросов по-прежнему 2; отпустить ответ B — `aria-disabled` у кнопок B не `"true"`, строка итога — текст ответа B; смена адреса на A — `aria-disabled` у кнопок A не `"true"` | повтор команды сервером, запись при зависшем движке, два запроса, кнопки заблокированы навсегда, истечение ожидания движка как успех, чужой ответ снимает защиту, второй запрос по проекту, пока идёт первый |
| 9. Простые слова | п. 8, 9.1 | CTL-9 (`team-web-control.test.js`, помощник `technical` и список WEB-7a): все строки `TEXT` п. 8, `resumeFailed` на каждом `WHY_*`, все `error_text`/`result_text`/`pause_text`/`stopped_text` из CTL-1a и CTL-7, видимый текст `public/*.html` — нет слов списка критерия 7 REQ-011, кодов, `%`, «процент» и слов «resume», «pause», «stop», «движок», «канал», «очередь», «ack», «замок», «inbox»; названия кнопок в `index.html` — ровно «Пауза», «Продолжить», «Остановить», «Не останавливать»; `team-web-words.test.js` — `DISPLAY_KEYS` дополнен `stopped_text` (не сокращён), WEB-7a…7d проходят; (r6) CTL-14e — новые тексты `pausedBudget`, `pausedPlan`, `pausedGoalCheck`, `pausedTaskQuestion` и все `pause_text` п. 15.2 проходят `technical`, без `%` | технический текст, другое название кнопки |
| 10. Приёмка глазами | п. 14 | не автотест: CODE-DESIGN-VALIDATOR (описание интерфейса), DESIGN-QA-VALIDATOR (снимки п. 14), BA-ANALYST + UAT-RUNNER — доказательства в их handoff-ах | — |
| 11. Решение до кода | `decisions/0030` п. 2, п. 7 | CTL-11: команды критерия 11 (Ф13) и `grep -n 'resume' tools/src/web/engines.js` не пусто; CTL-3b проходит | режим `start` |
| 12. Открытых вопросов нет | `decisions/0030` п. 1 | CTL-12: `grep -n 'нельзя отменить' decisions/0030-*.md` не пусто; CTL-4a (текст подтверждения со словами «Это нельзя отменить»), CTL-4d | другой текст подтверждения |
| 13. Документация и проверка | п. 13, Q4 | CTL-13 (`team-web-control.test.js`): в разделе README команды критерия 12 дают «Продолжить», «необратима», «Пауза», «Остановить» — не меньше 1, `resume` — не меньше 2; RELEASE-VALIDATOR: копия без `node_modules`, `cd tools && npm ci && npm run check` — код 0, файлы `team-web-control*.test.js` в выводе; `cd tools && npm run traces` — код 0; (r6) CTL-14f — README согласован с п. 8 (п. 15.2) | нет раздела, тесты не входят в прогон |

Обратная проверка: у каждого теста CTL-* — критерий в первом столбце; у каждого из 13 критериев — строка.

### 15.2. Тесты исправления ISS-0020 (r6; падают до исправления)

Файлы: `team-web-control.test.js` (CTL-14a, 14b, 14d, 14e, 14f), `team-web-control-page.test.js` (CTL-14c). Фикстуры через API ядра
(`project`, `withPlan`, `eng`, `usr`, `richProject`): помощник `waitingThenPaused(reason, { raised, taskQuestion })` собирает
TEST-DESIGNER (`PROJECT_WAITING` с причиной → `PROJECT_PAUSED`; поднятый потолок — `BUDGET_SET` после `PROJECT_WAITING`; вопрос по
задаче — `richProject` с последующей паузой). Ожидаемые тексты в тестах — литералы из п. 8, не импорт `TEXT`.

| Критерий | Тест | Что проверяет | До исправления |
|---|---|---|---|
| 1 | CTL-14a | `GET` проекта на паузе: ждал по потолку, потолок не поднят → `pausedBudget`; потолок поднят (`BUDGET_SET` после `PROJECT_WAITING`) → `paused`; `plan_failed` → `pausedPlan`; `goal_check_failed` → `pausedGoalCheck`; вопрос по задаче → `pausedTaskQuestion`; вопрос по задаче при ожидании по потолку → `pausedTaskQuestion`; без ожидания → `paused`; `approval` без вопроса → `paused`; `waiting_user` и `running` → `null`; хеш журнала до и после `GET` тот же | падает: везде `paused` |
| 1, 7 | CTL-14b (свойство) | на всех фикстурах CTL-14a и `projectsInEveryStatus`: если `controlRefusal("resume", …)` — строка, то `pause_text` не содержит «Нажмите «Продолжить»»; ждал по потолку без подъёма — содержит «снова спросит»; `pause_text === paused` только если ожидания нет, или потолок поднят, или причина не из `budget`, `plan_failed`, `goal_check_failed` | падает |
| 1 | CTL-14c (модель DOM) | настоящие `index.html` и `app.js` на телах CTL-14a: `#project-pause` виден с точным текстом; при вопросе по задаче `#ctl-resume` **виден**, без `aria-disabled` (критерий 1 не нарушен), `#ctl-stop` виден; опрос с `status: running` скрывает строку | падает |
| 7 | CTL-14d | вопрос по задаче: POST «resume» → 409 `ctlTaskDecision`, хеш журнала, pid замка, `inbox/` неизменны; `controlRefusal("pause", …)` на копии состояния с `paused_by: "recovery"` и вопросом по задаче → «Проект уже на паузе»; на `recovery` без вопроса → `ctlPausedAfterFailure` | падает (первое — `ctlPausedAfterFailure`) |
| 9 | CTL-14e | все `TEXT.paused*` и все `pause_text` из CTL-14a: `technical()` пуст, нет `%`, «процент» и слов «resume», «pause», «stop», «движок», «канал», «очередь», «ack», «замок», «inbox»; в `public/*.js` кириллицы нет; `DISPLAY_KEYS` не сокращён | не падает (охрана длинных текстов) |
| 13 | CTL-14f | раздел README: «снова спросит», «вопрос», «новый платный запуск» есть; проверки слов критерия 12 прежние | падает |

Прежний CTL-3d (`team-web-control-engine.test.js`, ожидаемый `pause_text` в строке ~157) меняет ожидание на `pausedBudget`:
проект остановлен сигналом во время ожидания по потолку.

### 15.1. Мутанты (TEST-DESIGN-VALIDATOR применяет сам)

| # | Мутант | Кто убивает |
|---|---|---|
| M1 | `controlsFor`: `resume` у `waiting_user` | CTL-1a, CTL-1b |
| M2 | `controlsFor`: `stop` у `created` | CTL-1a |
| M3 | `TEXT.paused` — прежний текст | CTL-1a, CTL-1c |
| M4 | продолжение без движка через `deliver` (без `engines.resume`) | CTL-3b |
| M5 | `engines.resume` с `mode: "start"` | CTL-3b, CTL-11 |
| M6 | остановка принимается без `confirmed: true` | CTL-4c |
| M7 | страница шлёт остановку первым щелчком (без подтверждения) | CTL-4a |
| M8 | «Не останавливать» или Escape шлют запрос | CTL-4a |
| M9 | маршрут управления без предела 4096 (общий `BODY_MAX`) | CTL-6c (8192 байта верного тела → 200 вместо 400) |
| M10 | предел `>= 4096` вместо `> 4096` | CTL-6c (ровно 4096) |
| M11 | `writeAllowed` пропущен для маршрута управления | CTL-6a |
| M12 | устаревший ключ — `reload: false` / `TEXT.refused` | CTL-6b |
| M13 | `GET` адреса управления вызывает `route.get` (500) | CTL-6f |
| M14 | `controlRefusal`: «создан» не отклоняется (идёт `deliver`) | CTL-7a (`PROJECT_STOPPED` в журнале, хеш другой) |
| M15 | признак «потолок поднят» не проверяется | CTL-7a |
| M16 | строка «состояние» п. 6.4 — постоянный текст без перечитывания | CTL-7c |
| M17 | `E_CHANNEL_TIMEOUT` → `ctlBusy` | CTL-8a |
| M18 | `E_DISK` без различия `rollback: "failed"` | CTL-7b |
| M19 | `submitControl` без синхронного флага `controlBusy` | CTL-8d |
| M20 | `postControl` (п. 6.3): исход `late: true` движка `resume` считается успехом | CTL-8g (поддельные движки `{resumed:false, error:null, late:true}` → 504, не 200) |
| M21 | (r4) после ответа 504 `aria-disabled="true"` остаётся; либо недоступность ставится атрибутом `disabled`; либо обработчик недоступной кнопки не выходит без запроса; либо перерисовка уводит фокус с нажатой кнопки | CTL-8f (признак `aria-disabled`, `hasAttribute("disabled")`, число запросов, `document.activeElement`) |
| M22 | подтверждение не закрывается при `controls.stop === false` | CTL-4a (вариант: второй опрос с `stop: false`) |
| M23 | (r1) `controlRefusal`: пауза после сбоя (`paused_by === "recovery"`) — прежний текст «Проект уже на паузе» | CTL-8c′, CTL-5b′ |
| M24 | (r1) `submitControl`: запись `controlBusy` удаляется после любого ответа, без сверки номера (или очищается вся) | CTL-8h ловит вариант «очищается вся». (r3, N3) Вариант «удаляется своя запись без сверки номера» — эквивалентный мутант: запись по адресу проекта ставится только при `!has(api)` и снимается только ответом своего запроса, номер при этом всегда тот же; теста не требуется |
| M25 | (r2, F3) `controlRefusal`: у `paused` с `waiting !== null` «Продолжить» отклоняется (правило r1 не снято) | CTL-3d (409 вместо 200, `PROJECT_RESUMED` нет) |
| M26 | (r1; r2, F4) `engines.resume`: отказ `done` проверяется раньше признака возобновления | CTL-3c (i) (S = `running`: `resumed: false` вместо `true`; детерминированно — фабрика п. 15) |
| M27 | (r2, F4) `engines.resume`: первая проверка после первого `await pause(START_POLL_MS)`, а не синхронно | CTL-3c (iii) (отметка таймера 0 стоит к ответу) |
| M28 | (r2, N2) `controlBusy` — одно значение на страницу (последний запрос), а не по проекту | CTL-8h (после возврата в A щелчок даёт 3-й запрос) |
| M29 | (r6) `pauseText` всегда `TEXT.paused` у `paused` | CTL-14a, CTL-14b, CTL-3d |
| M30 | (r6) правило «вопрос по задаче» убрано или стоит после правил по причине | CTL-14a (вопрос по задаче при ожидании по потолку), CTL-14b |
| M31 | (r6) `budgetRaised` не учитывается | CTL-14a (потолок поднят) |
| M32 | (r6) тексты `pausedPlan` и `pausedGoalCheck` перепутаны | CTL-14a |
| M33 | (r6) `pauseText` не проверяет `status === "paused"` | CTL-14a (`waiting_user` → `null`) |
| M34 | (r6) «Пауза» у `recovery` игнорирует вопрос по задаче | CTL-14d |
| M35 | (r6) вопрос по задаче скрывает «Продолжить» в `controlsFor` | CTL-14c, CTL-1a |
| M36 | (r6) `pausedTaskQuestion` зовёт «ответить в чате» | CTL-14a (точный текст) |

## 16. Планка (`docs/quality-bar.md`)

| # | Применим? | Как выполняется |
|---|---|---|
| Q1 | применим | REQ-035, 13 критериев с командами и тестами (п. 15); изменение привязано к требованию |
| Q2 | применим | проект проверяет CODE-DESIGN-VALIDATOR; код — SECURITY-REVIEWER, REVIEWER, TEST-DESIGN-VALIDATOR (мутанты п. 15.1), DESIGN-QA-VALIDATOR, RELEASE-VALIDATOR своими запусками |
| Q3 | применим | факты п. 0 — с выводом настоящих запусков; расхождения с требованием (Ф4, Ф7) были вынесены ORCH и закрыты правкой требования (коммит `4662844`); (r1) неверное утверждение прежней редакции о паузе при убитом движке исправлено по запуску (Ф14); (r2) что делает движок с паузой ждущего проекта после «Продолжить», проверено запуском (Ф16) — предположение задания об отказе `E_NO_BUDGET` не подтвердилось и в проект не вошло; (r6, ISS-0020) факты Ф18–Ф23 запущены на копии (`docs/design/ISS-0020-pause-text-for-waiting.md`, п. 2); предложенный заданием текст «ответьте в чате» не принят: чат вопрос не закрывает |
| Q4 | применим | `cd tools && npm run check`; новые `team-web-control*.test.js` попадают в `test/**/*.test.js`; шагов не убавляется |
| Q5 | применим | п. 15: тест на каждый критерий; каждый отказ сверяет хеш журнала, pid замка, список `inbox/`; тесты независимы (своя `SAI_TEAM_HOME`, свой сервер на порту 0) |
| Q6 | применим | ни `skip`, ни ослабления: WEB-4g меняет ожидаемый текст по требованию (не удаляется), `DISPLAY_KEYS` расширяется; `child_process` в сервер не добавляется |
| Q7 | применим | секретов нет; ключ страницы — в памяти, не в ответах, журнале и `err` (CTL-6e); у команд управления нет текста пользователя; `formatError` идёт только в `err` сервера |
| Q8 | применим как принцип для проектов | id проекта только из пути, в теле его нет; путь одного проекта не управляет другим; `../x`, абсолютный путь и несуществующий — один ответ «Не найдено» (CTL-6d) |
| Q9 | неприменим | SQL нет |
| Q10 | применим | п. 6.4, 10: каждый отказ — понятный текст, без стека и кодов; ожидание ack ≤ 10 с, ожидание движка `resume` ≤ 5 с; сервер отвечает на следующий запрос (CTL-7b); страница возвращает кнопки после любого ответа (CTL-8f); (r6, ISS-0020) строка паузы правдиво говорит, что сделает «Продолжить» (CTL-14a…14c) |
| Q11 | неприменим | сервер не ходит по адресам, которые задаёт пользователь; страница — только на свой сервер |
| Q12 | применим | 0030 п. 1, 2 (принято) — основа; выборы этого проекта — `decisions/0032` (принято ORCH; `decisions/README.md`, строка 0032): адрес и тело, предел маршрута, порядок «Продолжить», проверка «строже движка» до отправки как принятый остаточный риск и (r2) принятый обход «Пауза» → «Продолжить» у ждущего проекта, одна команда на проект; (r6) текст паузы по причине (ISS-0020) — предложение дополнить 0032 пунктом C7, `result.issues` шага 27 (I2); решение не противоречит 0032 C4 |
| Q13 | применим | ошибка процесса в этой работе: в описании требования непроверенное утверждение о поведении `deliver` (Ф4) и критерий, противоречащий поведению движка (Ф7) — предложение записи AP было в `result.issues` шага 1 (I1, I2); требование ORCH поправил (`4662844`); (r1) утверждение проекта о поведении `deliver` при убитом движке, не проверенное запуском (F1 ворот), — тот же род (AP-012), предложение записи — в `result.issues` шага 3; запись делает тот, кому ORCH поручит (`docs/anti-patterns.md` — не файл этого шага); (r6, ISS-0020) ещё одна ошибка: один текст паузы на все исходы «Продолжить», неправда у ждавшего проекта и при вопросе по задаче нашлась только в приёмке (UAT, сценарии 39, 23Б) — предложение записи в `result.issues` шага 27 (I3) |
| Q14 | применим | handoff заполнен в этой работе; статус требования и `STATE.md` — ORCH и DOC-UPDATER на шаге 10 |
| R1 | применим | мерж — только после подтверждения владельца (RELEASE-FINALIZER останавливается) |
| R2 | применим | состояние и кнопки — только из журнала при опросе, не из ответа на нажатие; на странице нет состояния «нажато/ожидается»; сервер не пишет событий сам, события пишут ядро и движок |
| R3 | неприменим | фото покупателей нет |

## 17. Безопасность (для SECURITY-REVIEWER)

Новый путь записи — один маршрут; защита та же, что у чата, и в том же месте (`server.js`, до чтения тела): Host,
Origin, `Content-Type`, ключ, предел тела, затем форма тела, затем `controlRefusal` и `deliver`/движок. Ответ на
несуществующий и «чужой» путь — `notFoundReply()`. Принятый остаточный риск W2 (любой процесс этого компьютера может
прочесть ключ) распространяется и на кнопки; новых рисков, кроме C4 решения 0032, нет.

## 18. Раунды разработки

1. **BACKEND-DEV** (после PASS шага 1b): `config.js`, `texts.js`, `display.js`, `engines.js`, `api.js`, `server.js`,
   README. Свой запуск: `npm run check` и ручной сервер на scripted с `curl` по каждой строке п. 10.
2. **FRONTEND-DEV** — параллельно с п. 1 (файлы не пересекаются), по п. 3, 4, 8, 9 и описанию интерфейса:
   `public/index.html`, `app.js`, `style.css`. Свой запуск — на сервере раунда 1, когда он готов.
3. **Ожидаемый провал между шагами 2 и 5.** После шага 2 краснеют **ровно два** теста (r5, F2): WEB-4g (`team-web-project.test.js:806`,
   прежний текст `pause_text`) и WEB-9d (`team-web-guard.test.js:252-275`: в `api.js` теперь импорт `{ deliver, engineHolder }` из
   `channel.js` и два вызова `deliver(` — в `postChat` и `postControl`). Других падений быть не должно: страница терпит тело без `controls` (п. 9.3), `controls.api`
   — не `Link` (WEB-6 не обходит его), `readBody`/`writeAllowed` у прежних маршрутов прежние (п. 12). Разработчики
   называют эти падения в отчёте; любое другое — ошибка. TEST-DESIGNER на шаге 5: (r5, F2) WEB-9d — прежние проверки не убирать (нет `appendFile|writeFile|createWriteStream|openSync|rename`, `inbox`, `child_process` ни в одном файле `tools/src/web/`; слово `channel` — только в `api.js`), новое ожидание: строки `api.js` со словом `channel` — ровно одна, `import { deliver, engineHolder } from "../team/engine/channel.js";`; вызовов `\bdeliver\(` в `api.js` ровно 2; `\bengineHolder\(` ровно 1; слова `engineHolder` в других файлах `tools/src/web/` нет; WEB-4g — новый текст `pause_text`; ожидание: `paused` — `stopped_text` равен `null`, `controls` = `{pause:false, resume:true, stop:true, api:"/api/projects/<id>/control"}`; `running` — `controls` = `{pause:true, resume:false, stop:true, api}`; `DISPLAY_KEYS`
   — `stopped_text`, `fakeEngines` — `resume`/`has`, тела `projectBody` страницы — `controls`; новые файлы п. 15 и
   `fixtures/team/no-ack.js`.
3a. **(r6, ISS-0020) Ожидаемое падение после правки кода (WF-03, шаг 4).** Краснеет ровно один прежний тест: CTL-3d
   (`team-web-control-engine.test.js`, ожидаемый `pause_text` — теперь `pausedBudget`); CTL-14a, 14b, 14c, 14d, 14f до правки кода падают
   и пишутся TEST-DESIGNER на шаге 6 (ISS-0020, п. 9). Других падений быть не должно; `public/` не меняется.
4. **Сведение**: нужно поле, которого нет в п. 4, — вопрос через ORCH, новая редакция проекта.

## 19. Решение (Q12)

`decisions/0032-req035-web-control.md` — **принято** (ORCH, 2026-10-11; строка в `decisions/README.md` есть; остаточный
риск C4 принят; дополнение C4 редакции r1 подтверждено ORCH и в r2 по его решению (F3, вариант 1) заменено: «Продолжить»
у паузы — как движок, обход «Пауза» → «Продолжить» у ждущего проекта — принятый остаток; статус не меняется):
C1 — адрес `POST /api/projects/<id>/control` и тело п. 3.2; C2 — предел тела маршрута 4096 → 400 «Запрос не понят», у чата
и создания прежнее; C3 — «Продолжить»: живой движок → `deliver`, иначе движок `resume` в процессе сервера (0030 п. 2);
C4 — правила «строже движка» на чтении перед отправкой, остаточный риск; C5 — одна команда управления на проект в
сервере; C6 — адрес управления — строка `controls.api`, не `Link`. Расхождений с записанными решениями нет: 0025 W7
(текст `pause_text`) уточняется этим требованием и 0030.

## 20. Вопросы

### 20.1. Закрыты

1. Критерий 2 «последняя фраза» (Ф7) — закрыт: ORCH поправил критерий 2 (коммит `4662844`: фраза «Проект на паузе» есть,
   после неё нет старта новой задачи, запуск задачи 1 доходит до итога, его фразы после паузы допустимы, проверка — по
   порядку событий журнала); CTL-2 написан под эту редакцию (п. 15).
2. `deliver` для `resume` без движка (Ф4) — закрыт: описание требования поправлено (`4662844`), дефект `channel.js`
   заведён — `docs/issues/ISS-0018-deliver-resume-without-engine-internal-error.md`; сервер такой вызов не делает (п. 6.3).
3. Гонка правил «строже движка» (п. 5.2, решение 0032 C4) — закрыт: остаточный риск принят ORCH (`decisions/0032`, строка
   статуса).
4. «Запрос из трёх полей» в критерии 6 — закрыт: критерий 6 поправлен (`4662844`: «одно действие из трёх и признак
   confirmed для stop»), п. 3.2.
5. (r2, F3) «Пауза» у ждущего проекта и «Продолжить» после неё — закрыт решением ORCH (вариант 1): «Пауза» у «ждёт
   решения» остаётся (критерий 1), «Продолжить» у паузы — как движок (по критерию 7 мест «строже движка» два; расхождение по строке «прочее» — п. 5.1, r3, N4); обход «Пауза» →
   «Продолжить» — принятый остаток (решение 0032, C4; п. 5.1, 9.4, CTL-3d; поведение движка — Ф16).

### 20.2. Открыты (не решены догадкой)

6. Проект «в работе» без ведущего движка после выхода сервера с кодом 1 продолжается только «Пауза» → «Продолжить»
   (п. 9.4, последняя строка): «Пауза» ответит «Проект уже на паузе: работа прервалась из-за сбоя…», если ядро что-то
   прервало; отдельной кнопки «восстановить» нет и требованием не просится.
7. (r1, F1) Критерий 8 (в) проект читает как «движок убит, когда прерывать нечего» (CTL-8c: «ждёт решения» по потолку):
   только тогда пауза записывается ровно один раз (Ф14). Если ORCH читает критерий как «убит во время задачи» — слова
   критерия расходятся с ядром (ядро само ставит проект на паузу восстановлением, `PROJECT_PAUSED` не пишется) и нужна
   правка WF-01; поведение для этого случая проект уже задаёт (CTL-8c′). `result.issues` шага 3.
8. (r6, ISS-0020) Требование REQ-035 (описание и критерий 1) называет одну строку паузы; исправление сохраняет её для паузы без
   ожидания и без вопроса, у остальных пауз текст по причине (п. 4, 8). Нужна ли правка формулировки критерия 1 и сценариев
   11, 39, 23Б (`docs/uat/REQ-035.md`) — вопрос ORCH (WF-01), `result.issues` шага 27 (I1). Скрывать или отключать
   «Продолжить» при вопросе по задаче проект не предлагает (нарушило бы критерий 1); если владелец захочет — это правка критерия.
