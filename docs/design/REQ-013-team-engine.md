# REQ-013 — проект кода: движок Sai Team (планировщик, расписание и параллельность, контекст, проверка, согласования, потолок проекта, завершение, пауза и восстановление, канал команд)

WF-02, шаг 1 (CODE-DESIGNER), прогон `PROD-20261006-02`, handoff `handoffs/PROD-20261006-02/step-03-code-designer.json`.
Требование — блок REQ-013 в `docs/requirements.yaml` (13 критериев; критерий 9 уточнён: движок сам принимает чат и команды
через свой канал). Основа — принятые проекты `docs/design/REQ-009-team-core.md` (r12, дальше «ядро», «п. ядра N») и
`docs/design/REQ-010-agent-executors.md` (r8, «исполнители», «п. исп. N»), код `tools/src/team/`, решения
`decisions/0015-product-virtual-team-start.md`, `decisions/0017-team-core-storage.md`, `decisions/0018-team-executors.md`.
Решение ORCH о канале (сообщение ORCH в ходе шага 03): **файл-очередь `inbox/` в папке проекта**, не сокет; `node:net` и
`node:http` в движке не используются; канал — пятое разрешённое место записи (`tools/src/team/engine/channel.js`).
Требования после правки WF-01 прошли проверку (`handoffs/PROD-20261006-02/step-05-req-validator.json`, PASS): критерий 9
REQ-013 (файл-очередь, пределы 64 КиБ и 10 с, тест `tools/test/team-channel.test.js`), критерий 11 REQ-013 и критерий 2
REQ-009 (пять мест записи), критерий 15 REQ-011 (сервер — только через `channel.js`). Проект приведён к правленым блокам;
поправка к решению 0017 (I3) — `decisions/0020-team-engine-channel.md`.

Кода реализации здесь нет: только формы данных, сигнатуры, правила и таблицы. Все примеры — вымышленные.

Редакция **r0** — первая. Редакция **r1** — доработка по FAIL ворот проекта
(`handoffs/PROD-20261006-02/step-06-code-design-validator.json`) и решениям ORCH; номер замечания у каждой правки:
1 — имя сообщения только по номеру `m-<n12>.json`, номер = максимум в `inbox/` и `taken/` + 1, порядок чтения, метка `.done`
вместо файла `last`, правило «номер ≤ исполненного» (п. 13.2–13.6, 3, 18, 21, 22, 0020); 2 — проверка числа ссылок убрана,
проверка ack отправителем и путь для негодного ack (п. 13.5, 13.6); 3 — точные формулировки для требований (новый п. 27);
4 — завершение при закрытых задачах названо следствием C1 (п. 11, 27); 5 — отказ по И6' сообщает правило «И6» (REQ-009,
разд. 20.1); 6 — учёт (`artifacts_out`); 7 — ожидание ack проверяет pid, прочитанный из замка при отправке (п. 13.6).
Редакция **r2** — по FAIL `handoffs/PROD-20261006-02/step-09-code-design-validator.json` и решениям ORCH:
1 — взятие без замены (`taken/.taking-…` + `linkSync`), устаревание по наибольшему **взятому** номеру, приём во время
остановки — отказ `E_ENGINE_STOPPING` (п. 13.2, 13.5, 13.6, 13.7, 15.3, 17, 18, EN-57 (5)–(6), мутанты); 2 — метка `.done` —
«служебная метка исполненного номера (содержимое не используется)» (п. 13.2, 13.5, 27, 0020); 3 — `REQ-009-team-core.md`
восстановлен (один раздел 20); 4 — одно правило уборки и числа `N` (п. 13.4, 17, EN-57 (7)); 5 — 0020 приведён к п. 13.5.
Редакция **r3** — по FAIL `handoffs/PROD-20261006-02/step-12-code-design-validator.json` и решениям ORCH: 1 — любое
взятое сообщение с наибольшим номером остаётся в `taken/` (отклонённое тоже, как `.done`; удаляется только дубль «устарел»),
`.done` — признак «обработано» для уборки (п. 13.2, 13.5, 13.6 (б), 13.7, 18, 27, EN-57 (8)); 2 — уборка считает сообщения по
`(dev, ino)`, падение между `linkSync` и `unlinkSync`, оборванный дубль «устарел», судьба `top` (п. 13.4, EN-57 (9), мутанты);
3 — 0020: «наибольшего взятого»; 4 — шапка REQ-009 — r13.
Редакция **r4** — малый вариант по FAIL `handoffs/PROD-20261006-02/step-15-code-design-validator.json`
и решению ORCH: наибольший взятый номер хранит только движок в `inbox/taken/high` (пишется до исполнения); отправитель —
`1 + max(номера в inbox/, high)`, пустой канал — `high = 0`; номер ≤ `high` — «устарел»; меток `.done` и правила «top» нет,
обработанные сообщения удаляются (исполненное — после события, отклонённое — после ack); уборка — жёсткий порядок «прочитать —
разделить — `high` — одно событие со списком `dropped` — удалить», повторяемый без двойного счёта (C7 в REQ-009 разд. 20.4);
одна сигнатура `openInbox(projectDir, writer)`; п. 13.2, 13.4–13.7, 18, 21, 22, 27, 0020.
Редакция **r5** (действующая; единственная действующая; **r5.1 — малая правка после PASS** ворот
`handoffs/PROD-20261006-02/step-21-code-design-validator.json`, замечания 1–4: повторы `nonce` схлопываются (п. 13.4, шаг 2.2,
EN-57 (9и)); негодный `high` переписывается и при `h = 0` (шаг 2.3, EN-57 (9з)); EN-61 и п. 17 — достижимый путь ack
`E_CHANNEL_DROPPED`; формулировки п. 13.5, 22, 23 R2; схема не менялась; **r5.2 — правка по построенному коду** (ревью
`handoffs/PROD-20261006-02/step-25-reviewer.json`, BACKEND-DEV `step-22/23/26`, решения ORCH; схемы не менялись): п. 1.2, 2.2,
4.1, 4.2, 4.5, 6.1, 9.2, 9.4, 12.1, 13.5, 13.7, 15.2, 15.3, 17, 21 (EN-76), 22 и новый п. 28 — перечень; **r5.3 — малая правка** по повторному ревью `handoffs/PROD-20261006-02/step-29-reviewer.json`
(R-1…R-5) и проверке безопасности `step-30`: `stop` во время остановки по сигналу — отказ (п. 12.3, 12.4, 13.5), упоминания
`cancelCause` заменены на `abort(reason)`/`signal.reason` (п. 0, 1.2, 4.4, 12.3, 12.4), правило номера отправителя — общая
с движком функция (п. 13.6), требования к коду R-3…R-5 и одинаковая работа без `facts` (п. 28); **r5.4 — последняя малая правка, только текст** (после PASS ревью step-32 и
безопасности step-33): одна формулировка предела номера (п. 13.4, 13.6, 13.7), честное описание EN-76 (п. 21), выбор (г)
принят ORCH (п. 28), пояснение R3-2 (п. 28), причина `cancel` при сигнале (п. 4.4, 12.4); **r5.5 — только текст**, по FAIL ворот тестов
`handoffs/PROD-20261006-02/step-35-test-design-validator.json`: F1 — уборка не трогает временные файлы живых отправителей,
отправитель переживает исчезновение своего временного файла (п. 13.4, шаг 2.6; п. 13.6, шаги 5, 8; EN-67, EN-57 (9м); мутанты);
F4 — мутант EN-60 не эквивалентен, его убивает EN-60 (exit) (п. 22, 28); F2, F3, F5 — указания TEST-DESIGNER (п. 22)) — по FAIL `handoffs/PROD-20261006-02/step-18-code-design-validator.json`
и решениям ORCH: 1 — события уборки порциями по 100 одним пакетом (`writer.recordDropped`, C7), уборка не зависит от числа
файлов, предел отправителя — мягкая защита, `taken/high` не мешает открыться (п. 3, 13.4, 2.3, EN-57 (9ж), мутанты); 2 —
сообщение опознаётся по `nonce`, а не по имени: дубль с именем из журнала не скрывается, `dropped` и И24 — по `nonce`, ack
`E_CHANNEL_DROPPED` ждущему отправителю (C6, C7, п. 13.4, 13.5, 15.3, 15.5, EN-57 (9а), EN-61; REQ-009 разд. 20.4, TM-72); 3 —
два `.taking` во время `stop` (п. 13.2, 13.5); 4 — мутант «taken/ раньше inbox/» удалён как эквивалентный, (9а) заменён
достижимым случаем (п. 22); 5 — «число сообщений» вместо «числа удалённых» (п. 13.4); п. 27, 0020.

## 0. Проверенные факты (своими запусками)

Каждый запуск — с ограничением времени (`perl -e 'alarm 20; exec @ARGV' …`; на macOS нет `timeout`). Настоящий Claude Code не
запускался. Папки данных — временные, `<вне проекта>`.

| # | Утверждение | Как проверено | Результат |
|---|---|---|---|
| F1 | Node 22 | `node --version` | `v22.21.1` |
| F2 | Сетевых модулей в `tools/src/team/` нет | `grep -rnE 'node:(http\|https\|net\|tls\|dgram)\|fetch[(]' src/team/` | пусто, код 1 — значит, сокет (`node:net`) нарушил бы критерий 6 REQ-013 (подтверждает решение ORCH о файл-очереди) |
| F3 | Места `writeFile*` сейчас ровно три модуля ядра | `grep -rnE 'appendFile\|createWriteStream\|writeFile' src/team/` | `files.js:100`, `store.js:563`, `store.js:569`, `lock.js:113` — те, что в п. 13 ядра |
| F4 | Команд движка ещё нет | `node src/team/cli.js start p-20261006-abcdef` | `E_USAGE: Неизвестная команда: нужна projects, project, events, say, new, add-task или run-task`, код 2 |
| F5 | `say` сейчас — только с `--text` | `node src/team/cli.js say p-20261006-abcdef --text x` (пустой `SAI_TEAM_HOME`) и чтение `cli.js:171` | `E_NOT_FOUND: Проект не найден`, код 1; разбор требует `--text` («Нужен --text»). Критерий 9 пишет `say <id> "…"` — позиционная форма добавляется (п. 15.1) |
| F6 | `PLAN_RECEIVED` требует хотя бы одну задачу | `schema.js:183` — `list(L.PLAN_TASKS_MAX, PLAN_TASK, 1)` | раунд дозадач с пустым планом — порок «схема» (п. 5) |
| F7 | `runTask` запускает только задачи `waiting`, `interrupted`, `failed` и пишет `TASK_INTERRUPTED {cause:"cancel"}` при отмене | `runner.js:36` (`STARTABLE`), `runner.js:538` | движку нужны опции `startFrom` и причина отмены (r5.3: `abort(reason)` и `signal.reason`, п. 2.2, C5) |
| F8 | Свободный префикс тестов | `grep -rn 'EN-[0-9]' tools/test docs` | пусто; заняты `TM-`, `EX-`, `PO-` — берём `EN-` |
| F9 | В журнале ошибок процесса есть AP-046…AP-050; AP-051 нет | `grep -n 'AP-04[6-9]\|AP-05[0-1]' docs/anti-patterns.md` | задание называет AP-046…AP-051 — уроки учтены по AP-046…AP-050 (п. 26, I-9) |
| F10 | Фраза `TASK_DONE {via:"approval"}` уже говорит «действие вовне не выполнено» | `language.js:241` | «Черновик принят, действие вовне не выполнено» |
| F11 | Роли каталога: `project_manager` (Руководитель проекта), `reviewer` (Проверяющий (QA)) и ещё 8 | `roles.js` | коды для планировщика и проверки |
| F12 | Замок допускает лишние поля JSON | `lock.js:52-84` (`readLockPid` проверяет только целое `pid ≥ 1`) | поле `holder` в замке движка (C4) старые читатели не ломает |
| F13 | Схема ядра умеет необязательные поля | `schema.js:241` (`code(EXECUTORS, { optional: true })`) | поле `msg` (C6) — необязательное, старые журналы воспроизводятся |
| F14 | `renameSync` заменяет существующий файл, «создать, если нет» в ядре делает `linkSync` | `lock.js` (п. ядра 6.2, шаг 1), документация Node `fs.rename` | публикация сообщения — `linkSync` временного файла той же папки (п. 13.6, I-10) |

## 1. Состав изменений

### 1.1. Новые файлы (BACKEND-DEV)

| Файл | Что |
|---|---|
| `tools/src/team/engine/engine.js` | жизненный цикл движка, цикл решений, выполнение действий |
| `tools/src/team/engine/schedule.js` | чистые функции: какие действия начать (`nextActions`), резерв потолка, открытые вопросы |
| `tools/src/team/engine/plan.js` | схема ответа плана, проверка плана, порядок задач |
| `tools/src/team/engine/review.js` | схемы ответов проверки, сверки цели и выбора роли; тексты для них |
| `tools/src/team/engine/answers.js` | проверка ответов пользователя и ожидающих решений |
| `tools/src/team/engine/facts.js` | разбор журнала при открытии: счётчики запусков задач, применённые решения, закрытые задачи |
| `tools/src/team/engine/single-run.js` | один запуск без задачи-работы (план, проверка, сверка цели, выбор роли) с закрытием на всех путях |
| `tools/src/team/engine/channel.js` | канал: сторона команды и сторона движка (единственное новое место записи) |
| `tools/src/team/engine/commands.js` | команды `start`, `resume`, `pause`, `stop`, `budget`, `answer`, маршрут `say` |
| `tools/test/team-planner.test.js`, `tools/test/team-engine.test.js`, `tools/test/team-engine-*.test.js`, `tools/test/team-channel.test.js` | тесты (п. 21) |
| `tools/test/team-engine-helpers.js` | помощник тестов движка (вызывает `assertSafeEnv` из `exec-helpers.js`) |
| `tools/test/fixtures/team/engine-*.json` | сценарии scripted движка; **в каждой записи `runs` задан `cost_usd`** (правило п. исп. 8.4) |

### 1.2. Изменённые файлы

| Файл | Изменение | Где используется и что с каждым |
|---|---|---|
| `tools/src/team/cli.js` | команды `start`, `resume`, `pause`, `stop`, `budget`, `answer` (через `engine/commands.js`); `say` — позиционный текст и маршрут через канал; текст `E_USAGE` «Неизвестная команда…» с новым списком | все команды по-прежнему через `runGuarded`; `projects`, `project`, `events`, `new`, `add-task`, `run-task` не меняются; тест `cli.test.js`, проверяющий текст «Неизвестная команда», обновляется на новый список (проверка не ослабляется) |
| `tools/src/team/errors.js` | новые коды п. 15.3 в `ENGINE_MESSAGES` | прежние коды и тексты не меняются |
| `tools/src/team/home.js` | `PROJECT_ENTRIES` + `inbox/` (папка 0700, `when: "engine"`; внутри — `taken/`, `ack/` 0700, их файлы проверяет `channel.js`, п. 13) | `modeProblems`/`ensureModes` сужают и `inbox/`; `TM-03` (`team-state.test.js`) сравнивает папку проекта с `PROJECT_ENTRIES` — проходит, так как запись добавлена в список; чтение (`inspectHome`, `listProjects`) лишнюю папку не считает порчей |
| `tools/src/team/runner.js` | C5 (п. 2.2): опции `startFrom`, `budgetFor`; причина отмены — `signal.reason` (r5.3); экспорт `defaultContext`, `depsOf` | `run-task` (CLI) опций не передаёт — поведение REQ-010 прежнее (EX-01…EX-54 не меняются) |
| ядро и исполнители | C1, C2 (п. 2.1) — **только после решения ORCH** (I-1, I-2); C4, C6 (п. 2.3) — нужны критерию 9 | перечислено в п. 2.1, 2.3 |
| `tools/src/team/cli.js` (`add-task`, `run-task`) | при живом движке — отказ `E_ENGINE_RUNNING` до открытия (M2, п. 15.2) | прежние отказы и выводы не меняются |
| `tools/package.json` | скриптов не добавляется (`team` уже есть); `test` уже берёт `test/**/*.test.js` | — |
| `tools/README.md` | раздел «## Sai Team — движок» (п. 20) | — |
| `tools/test/team-recovery.test.js` | **добавляются** тесты EN-65…EN-68 (критерий 10 называет этот файл); прежние TM-тесты не меняются | — |

Не затрагиваются: `tools/src/pixel-office/` (кроме импорта `mask.js`), `.claude/agents/`. (r5.2) `tools/src/team/executors/claude-cli.js`
**изменён** по решению ORCH (step-23): `summary` и `files` итога берутся из ответа, только если они есть (иначе `null` и `[]`) —
иначе ответы плана, проверки, сверки цели и выбора роли (без `files`) давали `TypeError`; тест — `tools/test/exec-engine.test.js`.

### 1.3. Кто какие файлы пишет (двое не пишут один файл)

Работу ведёт один BACKEND-DEV по раундам п. 24. Если ORCH даст двух: разработчик А — `engine/plan.js`, `schedule.js`,
`review.js`, `answers.js`, `facts.js`, `single-run.js`, `engine.js`, `runner.js`, ядро (C1, C2); разработчик Б — `channel.js`,
`commands.js`, `cli.js`, `errors.js`, `home.js`, README. Общий контракт между ними — п. 13 (формы сообщений) и п. 19 (экспорты)
этого проекта; Б начинает после того, как А закрыл раунд 1.

## 2. Изменения ядра и исполнителей

### 2.1. Предложения, без которых часть критериев невыполнима (решение ORCH до кода; I-1, I-2)

**C1. Закрытые пользователем задачи и завершение проекта.** Критерии 3 и 6: `reject` оставляет задачу «не удалось», а
Руководитель проекта получает это при следующем раунде. Инвариант ядра И6 требует для `PROJECT_DONE` «все задачи `done`» —
значит, после любого `reject` проект **никогда** не сможет стать «выполнен» (критерий 8), а задачи, зависящие от
отклонённой, навсегда остаются «ждёт» (И3). Предложение (правка проекта ядра, r13):

- новый код причины `TASK_FAILED.reason = "dependency_closed"` (пишет движок, ENGINE) — для задачи `waiting`, у которой
  среди `depends_on` есть закрытая задача; `detail` — «Задача зависит от отклонённой» (`FAIL_DETAIL.dependency_closed`);
- «закрытая» задача: `status = failed` и (`reason ∈ {rejected_by_user, dependency_closed}` или
  `last_decision.decision = "reject"`);
- И6': `PROJECT_DONE` — только если задач ≥ 1, хотя бы одна `done`, каждая `done` или закрытая, `goal_check.passed === true`
  и `goal_check.seq > tasks_changed_seq`;
- фраза `TASK_FAILED {reason:"dependency_closed"}`: «{name}: задача не нужна — она зависела от отклонённой».

Где используется И6: `reducer.js` (переход `PROJECT_DONE`), тесты ядра на И6 (`team-state.test.js`) — прежние проверки
остаются (все `done` по-прежнему достаточно), добавляются случаи с закрытыми задачами; `language.js` (фраза); `schema.js`
(перечень причин). Без C1 движок по п. 11 доводит проект с отклонённой задачей только до «ждёт решения пользователя».

**C2. Выбор другой роли Руководителем проекта.** Критерий 5: другую роль выбирает Руководитель проекта. И16 ядра разрешает
запуск роли `project_manager` только с `purpose: plan` и только в статусе проекта `planning` — во время работы его не
запустить. Предложение: новое значение `RUN_STARTED.purpose = "reassign"` — задача обязательна и в статусе `review`, роль
`project_manager`, проект `running`; фраза — «Руководитель проекта подбирает другого специалиста». Где используется перечень
`purpose`: `schema.js`, `reducer.js` (И16), `language.js`, `executor.js` (`RunRequest.purpose`), `executors/scripted.js`
(`PURPOSES` — `match.purpose`), `buildPrompt` (раздел «Задача» есть, как у `review`), тесты EX на перечень (`exec-scripted-*`)
и TM-38 (фикстура на каждый тип — тип не новый, новая строка фразы). Без C2 критерий 5 в части «выбирает Руководитель
проекта» невыполним — вопрос, а не обход (п. 26, I-2).

### 2.2. C5 — опции `runTask` (обратно совместимые)

```
runTask(writer, taskId, opts: { env, config, signal, spawn?, sleep?, context?,
        startFrom?: TaskStatus[],                       // по умолчанию ["waiting","interrupted","failed"]
        budgetFor?: (state) => number | null,           // по умолчанию (state) => maxBudgetFor(state, config)
        })                                              // (r5.2) cancelCause убран: причина — signal.reason
export defaultContext(writer, task) → { goal, memory, deps, note: null }
export depsOf(writer, task) → { task, name, content }[]
```

- `startFrom` движка: `["waiting","interrupted","failed","review","waiting_user"]` (все переходы `TASK_STARTED` ядра).
- `budgetFor` вызывается в каждой точке, где сейчас `maxBudgetFor` (шаги 3 и 6.1, 6.5 п. исп. 8.2), — защита в той же
  операции: потолок попытки и проверка `checkBudget` в одном месте, как прежде.
- (r5.2, F-10) Причина отмены известна только в момент отмены: движок вызывает `abort("stop")` при остановке и `abort("cancel")`
  при паузе-выходе и сигнале процесса; `runTask`/`runSingle` читают `signal.reason` и пишут её в `TASK_INTERRUPTED.cause`
  (иное значение — `cancel`). Опции `cancelCause` нет.
- (r5.2) Имя файла результата — `<task>-<task.attempts после RUN_STARTED>-<имя>` (номер попытки задачи, а не попытки внутри
  вызова `runTask`): повторный запуск той же задачи движком (повтор после «не прошла», `change`) иначе получил бы
  `E_FILE_EXISTS`. Для свежей задачи `run-task` имена прежние (EX-тесты не менялись).

### 2.3. Изменения ядра, нужные каналу (критерий 9)

**C4. Замок движка виден из файла-замка.** Критерий 9: «как это видно из файла-замка — проект CODE-DESIGNER». Замок
движка — `{"pid":<int>,"since":"<ts>","holder":"engine"}`; замок остальных писателей — прежний `{"pid","since"}` (F12).

```
acquireLock(projectDir, pid, since, holder: "engine" | null = null)        // lock.js; иное значение holder — ошибка программы
lockHolder(projectDir) → { pid, alive, holder: "engine" | null } | null    // lock.js; holder — только строка "engine", иначе null
openWriter(id, opts: { …, holder?: "engine" })                             // store.js; передаёт holder в acquireLock
```

Где используется: `store.openWriter` (единственный вызов `acquireLock`); `lockHolder` — ядро (`openWriter`, шаг 2) и
`channel.js`; тесты TM замка (`team-writer.test.js`, `team-recovery.test.js`) проверяют замок без `holder` — не меняются.
Ложный `holder` может записать только тот же пользователь (папка 0700, файл 0600) — граница доверия та же, что у замка.

**C6. Событие несёт имя файла и `nonce` сообщения** (критерий 9: «событие несёт имя файла сообщения, двух событий USER с одним
именем сообщения в журнале нет»). Необязательные поля `msg: name` (шаблон `MSG_NAME`, п. 13.2) и `nonce` (16 шестнадцатеричных
знаков из тела, п. 13.3) у событий USER шести команд: `CHAT` (только `source = USER`), `PROJECT_PAUSED`, `PROJECT_RESUMED`
(USER), `PROJECT_STOPPED`, `BUDGET_SET`, `DECISION_RECEIVED`; оба есть или обоих нет. Их ставит только движок для сообщения
канала; команда без движка полей не ставит. Состояние `ProjectState.msgs` и `ProjectState.nonces`; инвариант **И24**: ни `msg`,
ни `nonce` не повторяются в журнале → иначе `E_TRANSITION` **до записи** (писатель не ломается). Опознаёт сообщение `nonce`, а
не имя файла: одно имя может принадлежать исполненному сообщению и опоздавшему дублю «устарел» (r5). Где используется:
`schema.js`, `reducer.js`, `view.js` (как есть), `language.js` (фразы не меняются), TM-38, TM-72. Старые журналы без этих полей
воспроизводятся (F13).

**C7 (r5). Невыполненные сообщения в событии уборки.** Необязательное поле `dropped: list<code>` — `nonce` невыполненных
сообщений (от 1 до `DROPPED_MAX = 100`, без повторов) у `CHAT` только при `source = ENGINE`; И24 распространяется на них
(`nonces`). Запись — метод ядра `writer.recordDropped(ids, textFor)`: порции по 100, все порции **одним пакетом** (всё или
ничего), число порций не ограничено — уборка не зависит от числа файлов и не может помешать проекту открыться. Где
используется: `schema.js`, `reducer.js`, `store.js`, TM-72 (REQ-009 разд. 20.4, 20.6).

## 3. Константы (`engine/schedule.js`, `engine/channel.js`)

| Имя | Значение | Что |
|---|---|---|
| `PARALLEL_DEFAULT` / `PARALLEL_ALLOWED` | 2 / `[1,2,3]` | предел одновременных задач |
| `CYCLE_RUNS_MAX` | 3 | запусков работы одной роли на задачу до передачи (1 + 2 повтора) |
| `ROUNDS_MAX` | 2 | раундов дозадач (раунд 0 — исходный план) |
| `SINGLE_RUNS_MAX` | 3 | попыток запуска проверки / сверки цели при сбое исполнителя |
| `MIN_RUN_USD` | 0.01 | меньше этого резерва запуск не начинается (как нижняя граница `SAI_TEAM_RUN_CAP_USD`) |
| `INBOX_POLL_MS` | 100 | период чтения `inbox/` движком (критерий 9: ≤ 200) |
| `ACK_WAIT_MS` | 10 000 | ожидание подтверждения командой и сервером REQ-011 — для всех шести команд, в том числе `stop` (критерий 9) |
| `SEND_POLL_MS` | 50 | период проверки ack и жизни движка отправителем |
| `MSG_BYTES_MAX` | 65 536 | файл сообщения (критерий 9: 64 КиБ); и файл ack |
| `INBOX_ENTRIES_MAX` | 100 | **мягкая защита** от переполнения (r5): отправитель не публикует, если видит в `inbox/` 100 и больше сообщений (`E_CHANNEL_FULL`). Это чтение, а не замок: одновременные отправители могут превысить предел, поэтому на нём ничего не держится — уборка и приём работают при любом числе файлов |
| `DROPPED_MAX` | 100 | идентификаторов в одном событии уборки (C7); порций сколько угодно, все одним пакетом |
| `PUBLISH_TRIES_MAX` | 50 | попыток занять номер (`EEXIST` → следующий номер) |
| `ORPHAN_ACK_MS` | 60 000 | ack старше этого (отправитель ушёл) движок удаляет |
| `CHAT_CONTEXT_MAX` | 20 | последних сообщений пользователя в тексте для Руководителя проекта |

## 4. Движок: жизненный цикл и цикл решений (`engine/engine.js`)

### 4.1. Сигнатуры

```
createEngine(id: string, opts: EngineOpts) → Engine
EngineOpts = { home?, env, config, now?, parallel?: 1|2|3 | null, mode: "start" | "resume",
               spawn?, sleep?, pid?: int, poll?: { setTimer, clearTimer } }    // poll, now, spawn, sleep — подмена в тестах
Engine = { run(): Promise<EngineResult>, state(): ProjectState, requestStop(reason, ids?): void,
           command(message, ids?): Event | Promise<Event>,   // (r5.2) внутренняя точка входа: то же, что сообщение канала, без ack
           facts(): Facts }                                   // (r5.2) только чтение, для EN-66
// (r5.2, F-2) Engine.command и разбор взятого сообщения канала вызывают один обработчик receive(message, ids, draining):
// проверка «остановка / конечный статус / stop» → requestStop или applyCommand; канал лишь добавляет ack. Отказ «движок не
// открыт» — E_INTERNAL, а не текст «Проект завершил работу». command и facts — внутренние точки входа (тесты, канал), не CLI.
EngineResult = { status: ProjectStatus, status_text, notices: string[] }
```

`run()` — всё время работы движка; завершается, когда проект в конечном статусе (`done`, `stopped`, `failed`), по сигналу
процесса (п. 12.4) или по сбою писателя (п. 17). В `waiting_user` и `paused` движок **не выходит**: принимает сообщения и
ждёт (так `answer`, `resume`, `budget` действуют сразу, критерии 3, 6, 7, 9).

### 4.2. Открытие (шаги по порядку; до шага 4 — ни одной записи)

1. `readConfig(env)` (`E_CONFIG`); `readProject(id)` — только чтение (`E_NOT_FOUND`, `E_CORRUPT`).
2. Проверка статуса для режима (п. 15.2: `start` — только `created`; `resume` — `paused`, `waiting_user` или проект
   `planning`/`running` с мёртвым замком) — иначе отказ п. 15.3.
3. **Предпроверка исполнителя** (критерий 2): `getExecutor(state.executor).check(probe, io)`, где `probe` — запрос
   `purpose:"plan"`, роль `project_manager`, `limits.max_budget_usd = slotBudget(state, config, 0)` (п. 6.3). Отказы
   `E_EXECUTOR`, `E_REAL_RUNS_OFF`, `E_NO_BUDGET`, `E_WORK_DIR`, `E_SCENARIO`, `E_CONFIG` — ошибка наверх, код 1, журнал не
   тронут, процесс не создан. `E_BUDGET_EXHAUSTED` здесь отказом **не** является (движок перейдёт к ожиданию потолка, п. 10).
4. `openWriter(id, {holder:"engine"})` (ядро, C4; может записать восстановление — п. 14). `E_PROJECT_BUSY` → п. 15.2
   (живой движок — `resume` идёт через канал, `start` — отказ).
5. Повтор шагов 2–3 на `writer.state` (состояние могло измениться между чтением и замком) — отказ: `writer.close()`, ошибка.
6. `openInbox(projectDir, writer)` (п. 13.4): папки `inbox/`, уборка остатков аварии и событие о них. Отказ `E_CHANNEL` —
   `writer.close()`, ошибка.
7. `readJournal(eventsFile)` — один раз; `facts = scanFacts(events)` (п. 4.5).
8. Первая запись режима: `start` — `PROJECT_STARTED {parallel}` (USER); `resume` — `PROJECT_RESUMED {parallel, after}`
   (USER) по правилу И13 (`paused_by = recovery` → `recovery`; `user` → `command`; `waiting_user` → `budget` при
   `waiting.reason = budget`, иначе `decision`) — только если п. 15.2 разрешил (иначе отказ без записи). (r5.2, выбор (б))
   `resume` проекта `planning`/`running` после аварии, где восстановление не поставило паузу (работы не было), —
   `PROJECT_RESUMED` записать нельзя (И13: из `running`/`planning` перехода нет); движок продолжает без него, с заметкой в
   `notices`. `planning` без запуска плана продолжается тем же раундом и той же попыткой без нового `PLANNING_STARTED`.
9. Цикл (п. 4.3) до выхода.

### 4.3. Цикл

Один процесс, одна нить JavaScript: все записи журнала синхронны и идут по очереди. Цикл — функция `tick()`, вызываемая
(а) после каждой записи, сделанной по сообщению канала; (б) когда закончилось любое действие в работе (`settled`);
(в) таймером `INBOX_POLL_MS`. В одном `tick()`:

1. `inbox.take()` и исполнение (п. 13.5) — по порядку имён; каждое сообщение обрабатывается полностью (проверка + запись + подтверждение)
   до следующего.
2. `applyDecisions()` — применить ответы пользователя, ещё не применённые (п. 9.3).
3. `actions = nextActions(writer.state, view, config)` (п. 6.1) — чистая функция; выполнить каждое действие (запись событий
   синхронно, запуск исполнителя — `Promise` в `view.inFlight`).

`view` — то, чего нет в журнале и что живёт только пока жив процесс: `inFlight: Map<ключ, { kind, task|null, abort:
AbortController, reserve_usd }>` (ключ — id задачи, `"plan"`, `"goal"`); `stopping: bool`; `facts` (п. 4.5). Всё, что
нужно после перезапуска, выводится из журнала (`facts`), а не из памяти.

### 4.4. Действия (`Action`)

| `kind` | Условие (кратко; полно — п. 5–11) | Что делает |
|---|---|---|
| `plan` | проект `running` без задач, или раунд дозадач (п. 11) | `PLANNING_STARTED` и запуск плана (п. 5) |
| `work` | задача готова к запуску (п. 6.1) | `runTask(writer, task, {startFrom, budgetFor, context, signal})` (причина отмены — `signal.reason`: `stop` при остановке, `cancel` при паузе-выходе и сигнале процесса) |
| `review` | задача `review` без запуска в работе | запуск Проверяющего (п. 8) |
| `reassign` | цикл роли исчерпан | запуск выбора роли (п. 8.3, C2) |
| `goal` | все задачи `done` (или закрыты, C1), запусков нет | сверка цели (п. 11) |
| `wait` | п. 9, 10, 3 | `PROJECT_WAITING` и/или `TASK_WAITING_USER`, затем `CHAT {kind:"question"}` |
| `close_dependents` | закрытая задача имеет зависимые в `waiting` (C1) | `TASK_FAILED {dependency_closed}` каждой |
| `done` | И6 (или И6' C1) | `PROJECT_DONE` |

### 4.5. Факты из журнала (`engine/facts.js`)

```
scanFacts(events: Event[]) → Facts
Facts = {
  launches: { [task]: int },          // TASK_STARTED задачи после её последнего TASK_REASSIGNED или DECISION_RECEIVED{change}
  applied:  Set<seq>,                 // seq DECISION_RECEIVED, после которого по задаче уже есть смена статуса
  closedSincePlan: string[],          // задачи, закрытые после последнего PLAN_RECEIVED (C1; r5.2: сброс на PLAN_RECEIVED,
                                      // а не на PLANNING_STARTED — план, прерванный паузой или plan_failed, перепланируется
                                      // тем же раундом и не теряет закрытые задачи в своём входе)
  lastPlanningSeq: int | null,
  // (r5.2) дополнительно, тем же noteEvent из журнала: reassigned, startedSeq, failedSeq, failDetail, budgetFailed,
  // askedSeq, reviewNotes, goalNotes, planOpen, pending
}
noteEvent(facts, event) → void       // то же правило для события, которое движок узнал после записи (обновление в памяти)
```

Движок обновляет `facts` для каждого события, которое возвращает `writer.append` в его коде, а для событий `runTask` — по
итогу `RunTaskResult` (`launches[task] += 1` при каждом вызове `runTask`, который прошёл шаг 5 п. исп. 8.2, то есть
`status ≠ refused`). Тест EN-66 проверяет, что `scanFacts` по журналу после перезапуска даёт те же значения, что движок
держал в памяти.

## 5. Планировщик (`engine/plan.js`, критерий 1)

### 5.1. Запуск плана

1. `PLANNING_STARTED {round}` (П `running` → `planning`; И20 ставит `attempt = 1`).
2. `runSingle` (п. 7.4) c `purpose:"plan"`, ролью `project_manager`, `answer_schema = PLAN_ANSWER_SCHEMA`, `context` п. 7.2.
3. Итог `ok` → `validatePlan(answer, state)` (п. 5.3). Итог не `ok` → п. 5.4.
4. План годен → `PLAN_RECEIVED {round, tasks}` (П → `running`; задачи одной строкой). Каждое задание плана получает id
   `t-NNNN` по порядку `orderPlan` (п. 5.3).
5. Порок, `attempt = 1` → `PLAN_REJECTED {round, attempt:1, reason, detail}`, затем `PLAN_RETRY {round, attempt:2}` (статус не
   меняется, И20), затем шаг 2 с `context.note`, где первым абзацем — «Предыдущий план отклонён: <detail>».
6. Порок, `attempt = 2` → `PLAN_REJECTED {round, attempt:2, reason, detail}`, `PROJECT_WAITING {reason:"plan_failed"}`,
   `CHAT {kind:"question", text: QUESTION.plan_failed}`. Ни одна задача из плохих планов не создана: задачи появляются
   только в `PLAN_RECEIVED`.

### 5.2. Схема ответа (`PLAN_ANSWER_SCHEMA`, подмножество п. исп. 3.3)

Схема намеренно **свободнее** правил движка: иначе 41 задача или чужая роль были бы «схемой», а критерий 1 требует видеть
каждый порок отдельно.

| Поле | Тип | Обяз. |
|---|---|---|
| `tasks` | массив (`minItems: 1`, без `maxItems`) из объектов ниже | да |
| `tasks[].key` | строка 1…20 | да |
| `tasks[].role` | строка 1…40 | да |
| `tasks[].text` | строка 1…4000 | да |
| `tasks[].done_when` | строка 1…2000 | да |
| `tasks[].depends_on` | массив строк 1…20, `maxItems: 40` | да |
| `tasks[].critical` | логическое | да |

Лишние поля запрещены на обоих уровнях. Значения — данные: ни одно поле ответа не меняет исполнителя, потолок, флаги или
поля проекта (Q7, как п. исп. 3.3).

### 5.3. Проверка плана (`validatePlan`)

```
validatePlan(answer: unknown, state: ProjectState) → { ok: true, tasks: PlanTask[] }
                                                 | { ok: false, reason: PlanRejectReason, detail: string }
PlanRejectReason = "schema" | "too_many" | "unknown_role" | "bad_dependency" | "cycle"
orderPlan(items) → items                                  // устойчивая топологическая сортировка
```

Порядок проверок и тексты `detail` (постоянные строки `PLAN_DETAIL`, без вставки текста агента, ≤ 500 знаков):

| # | Проверка | `reason` | `detail` |
|---|---|---|---|
| 1 | `checkAnswer(PLAN_ANSWER_SCHEMA, answer)`; `key` по `^[a-z0-9_-]{1,20}$`; ключи не повторяются | `schema` | «План не соответствует схеме: <путь поля>» (путь из `checkAnswer`, например `tasks.3.done_when`) |
| 2 | задач ≤ 40 и `state.tasks.length + n ≤ 200` | `too_many` | «В плане больше 40 задач» / «В проекте будет больше 200 задач» |
| 3 | каждая `role` ∈ `ROLE_CODES` | `unknown_role` | «Роль задачи <key> не из каталога» |
| 4 | каждая ссылка `depends_on` — `key` этого плана (не своя) или id существующей задачи проекта | `bad_dependency` | «Задача <key> ссылается на несуществующую задачу» |
| 5 | граф `depends_on` по ключам плана без циклов | `cycle` | «В зависимостях плана есть цикл» |

`key` и `role` в `detail` — только после проверки шаблоном (`key`) или каталогом; в `detail` п. 3 вставляется `key`, а не
роль из ответа. Годный план: `orderPlan` — топологический порядок, при равенстве — порядок в ответе; id назначаются подряд
(`nextTaskId`), `depends_on` переводятся из ключей в id (И5 ядра: только на меньшие номера — выполняется по построению).

### 5.4. Запуск плана не удался

`RunResult.outcome ≠ ok`: `invalid_output` (ответ вне схемы исполнителя) — это порок `schema` (п. 5.3, шаг 1; `detail`
«План не соответствует схеме»); `cancelled` — п. 12; остальные (`failed`, `timeout`, `network`, `not_found`) — плана нет, но
это не порок плана: `PROJECT_WAITING {plan_failed}` и вопрос со вставкой `FAIL_DETAIL` (п. исп. 8.3). Повторных попыток
сверх п. 5.1 нет. `E_BUDGET_EXHAUSTED` до запуска — п. 10.

## 6. Расписание и параллельность (`engine/schedule.js`, критерий 2)

### 6.1. `nextActions(state, view, config) → Action[]`

Чистая функция, без часов и диска. При `view.stopping` или статусе проекта ≠ `running` — пусто (кроме `wait`, `done`,
`close_dependents`, которые не начинают работу; в `paused` — совсем пусто). Иначе, по порядку:

1. `close_dependents` (C1), если есть.
2. (r5.2, выбор (в)) Открытый вопрос задачи пишется сразу, как появился, — и когда соседние задачи ещё в работе (`CHAT
   question`, и `TASK_WAITING_USER` где он нужен); `PROJECT_WAITING` — только если проект `running`/`planning`. На паузе вопросы
   не пишутся (`resume` отвечает `E_OPEN_QUESTION` с номером задачи). Ожидания проекта (`budget`, `plan_failed`,
   `goal_check_failed`) — когда действий в работе нет → `wait`.
3. Нет задач → `plan` (раунд 0).
4. Свободных мест `free = parallel − view.inFlight.size` (учитываются только действия `work`, `review`, `reassign`).
5. Кандидаты по возрастанию id: задача `review` без действия в работе → `review`; задача с исчерпанным циклом (п. 8.3) →
   `reassign`; задача `waiting`/`interrupted` с `depends_on` все `done` → `work`; задача `failed`/`waiting_user`/`review`
   с непримененным `change` (п. 9.3) → `work`. Берутся первые `free`; для `work` нужен резерв `slotBudget(...) ≥ MIN_RUN_USD`
   (п. 6.3), иначе кандидат пропускается.
6. Ничего не в работе, нет кандидатов и (все задачи `done`/закрыты) → `plan` (раунд дозадач, если есть закрытые с прошлого
   плана и раунд < 2, п. 11) или `goal`.
7. Ничего не в работе, нет кандидатов из-за потолка → `wait {budget}`.

Пока проект `waiting_user`, новые действия не начинаются; то, что уже в работе, доводится до итога (критерий 3).

### 6.2. Предел

`parallel` проекта — `state.parallel` (из `PROJECT_STARTED`/`PROJECT_RESUMED`), по умолчанию 2. Число одновременно
выполняемых задач — число задач, у которых между `TASK_STARTED` (или `TASK_REVIEW` → запуском проверки) и итогом есть
действие в `view.inFlight`; оно никогда не больше `parallel` — по построению шага 4. План и сверка цели идут, только когда
задач в работе нет.

### 6.3. Резерв потолка при параллельных запусках

`maxBudgetFor` исполнителей считает потолок попытки от остатка, не зная о соседях: два параллельных запуска могли бы вместе
получить больше остатка. Правило движка:

```
slotBudget(state, config, reservedByOthers) =
    null,                                  если budget_usd = 0 (только scripted; claude-cli отказал при предпроверке)
    floor6(min(maxBudgetFor(state, config), budget_usd − spent_usd − reservedByOthers)), иначе (не меньше 0)
```

`reservedByOthers` — сумма `reserve_usd` остальных действий в `view.inFlight`. `reserve_usd` действия = значение
`slotBudget` в момент старта; `budgetFor` в `runTask` (C5) пересчитывает его перед каждой попыткой с тем же правилом и
обновляет `reserve_usd`. Свойство: сумма `max_budget_usd` открытых запусков ≤ остатку в момент старта каждого (тест EN-43).

## 7. Контекст задачи (критерий 4)

### 7.1. Работа

`context = { ...defaultContext(writer, task), note }`: цель проекта; память проекта (последние 50 записей, как п. исп. 8.1);
`deps` — **только** файлы задач из `task.depends_on` (`depsOf`, файлы `files/` уже маскированы); `note` — по случаю:
замечания Проверяющего (`last_review.notes`) для повтора после «не прошла»; текст `change` пользователя; для критической
задачи — постоянная строка «Это действие нельзя выполнять: подготовьте черновик файлом и отметьте его видом draft». Агент
работает в `work/` проекта (ядро, `writer.workDir`); файлов ядра (`events.jsonl`, `writer.lock`, `inbox/`) у агента нет: путь
им не передаётся, а у claude-cli файловые инструменты ограничены рабочей папкой (`--restricted`, P2 записи 0018). Другой
проект недостижим: писатель и папки — только этого проекта (Q8 для проектов).

### 7.2. План, проверка, сверка цели, выбор роли (поле `note`; разделы — постоянные заголовки)

| Назначение | Что в `note` |
|---|---|
| `plan` | раунд; задачи проекта (id, роль — название, текст, статус словами, причина); закрытые после прошлого плана задачи с текстом решения пользователя (C1, критерии 3, 6); замечания последней сверки цели; последние `CHAT_CONTEXT_MAX` сообщений пользователя; при `PLAN_RETRY` — «Предыдущий план отклонён: <detail>» |
| `review` | `deps` = файлы этой задачи; `task.text`, `task.done_when` — в разделе «Задача» |
| `goal_check` | `deps` = файлы всех задач `done`; список задач и их итогов |
| `reassign` | задача, её роль, все замечания Проверяющего этого цикла, перечень ролей каталога (названия и коды) |

Текст пользователя и агентов — данные (вставляется как есть, после маскирования ядром).

## 8. Проверка результата и передача роли (`engine/review.js`, критерий 5)

### 8.1. Схемы ответов

| Схема | Поля |
|---|---|
| `REVIEW_ANSWER_SCHEMA` | `passed`: логическое; `notes`: строка 1…4000 |
| `GOAL_ANSWER_SCHEMA` | `passed`: логическое; `notes`: строка 1…4000 |
| `REASSIGN_ANSWER_SCHEMA` | `role`: строка 1…40; `reason`: строка 1…500 |

### 8.2. Последовательность для задачи

1. `runTask` вернул `status: "review"` (задача «на проверке», `TASK_REVIEW` записал `runTask`).
2. Критическая задача без своего файла `kind: draft` после последнего `TASK_STARTED` → считается «не прошла» без запуска
   проверки: повтор (шаг 5) с `note` «Нужен черновик файлом с видом draft» (событий проверки нет — проверки не было).
3. `runSingle` `purpose:"review"`, роль `reviewer` — **отдельный запуск** со своим `run_id` (не тот, что делал задачу).
4. `RUN_FINISHED` (в `runSingle`), затем `REVIEW_RESULT {run_id, passed, notes}`.
5. `passed = true`: обычная задача → `TASK_DONE {via:"review", external_action_done:false}`; критическая →
   `TASK_WAITING_USER {reason:"approval", draft}` (п. 9.1). `passed = false`: если `launches[task] < CYCLE_RUNS_MAX` —
   действие `work` (из `review`, `note` = замечания); иначе — п. 8.3.
6. Сбой запуска проверки (не `ok`): до `SINGLE_RUNS_MAX` запусков проверки подряд; затем `TASK_FAILED {retries_exhausted,
   detail: FAIL_DETAIL по последнему исходу}` и вопрос `task_failed` (п. 9).

### 8.3. Передача другой роли

Цикл исходной роли исчерпан (3 запуска работы, проверка каждый раз «не прошла»):

1. Если задача уже передавалась (в журнале есть `TASK_REASSIGNED` этой задачи) → `TASK_WAITING_USER {reason:"review_failed",
   draft: последний файл draft или null}`, затем `PROJECT_WAITING {review_failed, task}` (если проект `running`) и вопрос.
2. Иначе `runSingle` `purpose:"reassign"` (C2), роль `project_manager`, схема `REASSIGN_ANSWER_SCHEMA`.
3. Ответ: `role` ∈ `ROLE_CODES` и ≠ текущей роли → `TASK_REASSIGNED {from_role, to_role, reason}` (И9), `launches[task] = 0`,
   затем `work` новой ролью (из `review`). Ответ не годен или запуск не `ok` → шаг 1 (вопрос пользователю), без второй попытки.

Итог при «не прошла» всегда: 3 запуска `work` исходной роли (2-й и 3-й с замечаниями во входе), 3 запуска `review`, 1 запуск
`reassign`, `TASK_REASSIGNED`, 3 `work` + 3 `review` другой роли, `TASK_WAITING_USER {review_failed}`, `PROJECT_WAITING`,
`CHAT question` — ровно эти запуски (тест EN-31 считает `RUN_STARTED` по `purpose`).

## 9. Ответы пользователя и согласования (`engine/answers.js`, критерии 3, 6)

### 9.1. Критическая задача

Черновик — файл `kind: draft` задачи в `files/` (ядро). После проверки «прошла»: `TASK_WAITING_USER {approval, draft}` (И19:
черновик обязателен), если проект `running` — `PROJECT_WAITING {approval, task}`, затем `CHAT {question,
QUESTION.approval}` с `task`. Задачи, зависящие от неё, не начинаются (И3: зависимость не `done`). Движок не совершает
действий вовне: кода отправки, публикации, платежа в `tools/src/team/` нет (`grep` критерия 6), одобрение делает только
`TASK_DONE {via:"approval", external_action_done:false}`.

### 9.2. Проверка ответа (`checkDecision`) — до любой записи, в той же синхронной операции, что и запись

```
checkDecision(state, taskId, decision, text, facts) → { kind: QuestionKind }     // бросает TeamError; (r5.2, F-8) facts обязателен
QuestionKind = "approval" | "review_failed" | "task_failed"
```

| Задача | `approve` | `change --text` | `reject` |
|---|---|---|---|
| `waiting_user`, `approval` | да | да | да |
| `waiting_user`, `review_failed` | отказ `E_ANSWER_KIND` (И4: без проверки «готово» нельзя; I-3) | да | да |
| `failed`, не закрыта, проект ждёт `task_failed` по ней или вопрос по ней открыт | отказ `E_ANSWER_KIND` | да | да |
| (r5.2, F-8) `failed` **только по потолку** (`facts.budgetFailed`, `detail = FAIL_DETAIL.budget`): вопроса по задаче нет, ждёт потолок | `E_NOT_WAITING` | `E_NOT_WAITING` | `E_NOT_WAITING` |
| иначе (нет задачи — `E_TASK_NOT_FOUND`; другой статус) | `E_NOT_WAITING` | `E_NOT_WAITING` | `E_NOT_WAITING` |

`change` без `--text` и `--text` при `approve`/`reject` — `E_USAGE` (до чтения проекта). Задача другого проекта: id ищется
только в этом проекте — нет такой → `E_TASK_NOT_FOUND`; есть с тем же id, но не ждёт → `E_NOT_WAITING`. Отказ — журнал не
изменён.

### 9.3. Применение (`applyDecisions`, движок; ответ без движка лишь записывается)

Запись: `DECISION_RECEIVED {decision, text}` (USER). Применение — по `Facts.applied` (решение не применено, если после его
`seq` по задаче нет смены статуса):

| Решение | События движка |
|---|---|
| `approve` | `TASK_DONE {via:"approval", external_action_done:false}` |
| `change` | задача в действии `work` с `note` = текст пользователя; `launches[task] = 0` (новый цикл) |
| `reject` при `waiting_user` | `TASK_FAILED {reason:"rejected_by_user", detail:"Отклонено пользователем"}`; затем (C1) `close_dependents` |
| `reject` при `failed` | статус не меняется (событий смены статуса нет); затем (C1) `close_dependents` |

Затем, если проект `waiting_user` и открытых вопросов, требующих ожидания, не осталось (п. 9.4) — `PROJECT_RESUMED {after:
"decision"}` (ENGINE). Закрытые задачи передаются Руководителю проекта при следующем раунде (п. 7.2, п. 11).

### 9.4. Открытые вопросы (`openQuestions(state, facts) → Question[]`)

Шесть видов (как REQ-011/017): `approval` (задача `waiting_user`, `approval`), `review_failed` (задача `waiting_user`,
`review_failed`), `task_failed` (задача `failed`, не закрыта, без непримененного `change`), `budget`, `plan_failed`,
`goal_check_failed` (по `state.waiting.reason`). Вопрос открывает ровно одно событие `CHAT {source:"ENGINE", kind:"question",
task}` (тексты — `QUESTION` п. 15.4), которое движок пишет сразу после события, создавшего ожидание; закрывает — ответ или
новый статус задачи/проекта. Новый вопрос по той же задаче без нового ожидания не пишется.

## 10. Потолок проекта (критерий 7)

- Перед каждым запуском (`work`, `review`, `reassign`, `plan`, `goal`) — `slotBudget` (п. 6.3). Меньше `MIN_RUN_USD` при
  `budget_usd > 0` — запуск не начинается.
- `runTask` вернул `refused` или `TASK_FAILED` с `detail = FAIL_DETAIL.budget` — это не сбой задачи, а потолок: задача
  ждёт; вопрос не `task_failed`, а `budget`.
- Ничего не в работе и запускать нечего из-за потолка → `PROJECT_WAITING {reason:"budget"}` + `CHAT question`. Счётчик
  запусков поддельного claude после этого не растёт.
- `budget <id> <usd>` → `BUDGET_SET {budget_usd}` (USER). Отказы — до записи: формат (`E_USAGE`), ≤ израсходованного
  (`E_BUDGET_LOW`; И8 ядра тоже откажет — защита в той же операции записи).
- Продолжение — только `resume` (`PROJECT_RESUMED {after:"budget"}`); `resume`, пока потолка всё ещё не хватает на
  `MIN_RUN_USD`, — отказ `E_BUDGET_NEEDED` без записи. После `resume` каждый запуск получает `--max-budget-usd` = `slotBudget`
  ≤ нового остатка (исполнитель повторяет `checkBudget` внутри `run`).

## 11. Завершение (критерий 8)

1. Все задачи `done` (с C1 — `done` или закрыты, хотя бы одна `done`), ничего не в работе, нет непримененных решений.
2. Есть задачи, закрытые после последнего `PLANNING_STARTED`, и `plan.round < ROUNDS_MAX` → раунд дозадач (п. 5, `round + 1`).
3. Иначе сверка цели: `RUN_STARTED {goal_check}` и `GOAL_CHECK_STARTED {round, run_id}` (И7: на открытый запуск), запуск,
   `RUN_FINISHED`, `GOAL_CHECK_RESULT {round, run_id, passed, notes}`.
4. `passed` → `PROJECT_DONE` (И6 / И6'). Не `passed` и `round < 2` → `PLANNING_STARTED {round + 1}` (событие с числом раунда),
   `note` с замечаниями сверки → новые задачи (`PLAN_RECEIVED` добавляет) → снова п. 1. Не `passed` и `round = 2` →
   `PROJECT_WAITING {goal_check_failed}` + вопрос.
5. Сбой запуска сверки (не `ok`): до `SINGLE_RUNS_MAX`; затем `PROJECT_WAITING {goal_check_failed}` с вопросом, где сказано,
   что сверку не удалось выполнить (`FAIL_DETAIL`).
6. `resume` после `goal_check_failed` (например, пользователь добавил задачу `add-task` без движка) → снова п. 1 (новых
   раундов дозадач нет: `round` не больше 2 по схеме ядра).

`PROJECT_DONE` без предшествующего `GOAL_CHECK_RESULT {passed:true}` невозможен: и движок не пишет, и ядро отклоняет (И6).

(r1, замечание 4) **Принятое следствие C1:** проект может стать «выполнен», когда часть задач закрыта пользователем
(`reject`) или закрыта как зависящая от отклонённой (`dependency_closed`), — при условии, что хотя бы одна задача «готово» и
сверка цели «прошла». Описание REQ-013 («только когда все задачи «готово»») этому не соответствует — формулировка для
REQ-ANALYST в п. 27; критерий 8 проверяет сверку цели и не меняется.

## 12. Пауза, возобновление, остановка (критерий 9)

### 12.1. Пауза

`PROJECT_PAUSED` (USER) из `planning`, `running`, `waiting_user`. Новые действия не начинаются; `work`/`review`/`reassign` в
работе доводятся до итога (в том числе повторы внутри `runTask`). Запуск плана в работе — отменяется (`abort`): `PLAN_RECEIVED`
из `paused` ядро не примет; после `resume` планирование начинается заново (`PLANNING_STARTED` того же раунда). Сверка цели в
работе доводится до `GOAL_CHECK_RESULT`; `PROJECT_DONE` — после `resume`. (r5.2, F-1) Действие `goal` не запускает план:
после `GOAL_CHECK_RESULT {passed:false}` оно завершается, а план раунда `round + 1` ставит `nextActions` отдельным действием
`plan`. Пауза отменяет **любой** идущий запуск плана — раунда 0 и раунда дозадач. Пауза не на `planning/running/waiting_user` —
`E_PAUSE_STATE`, без записи.

### 12.2. Возобновление

Через канал (движок жив, проект `paused`/`waiting_user`): `PROJECT_RESUMED` (USER) по И13; без движка — команда сама
становится движком (п. 4.2). Отказы до записи: проект `running`/`planning` с живым движком — `E_ALREADY_RUNNING`; `stopped` —
`E_STOPPED`; `done`/`failed` — `E_FINISHED`; открытый вопрос `approval`/`review_failed`/`task_failed` без ответа —
`E_OPEN_QUESTION` (с id задачи); ожидание потолка без нового потолка — `E_BUDGET_NEEDED`.

### 12.3. Остановка

Через канал: `view.stopping = true` (ничего нового не начинается) → `abort("stop")` всех действий →
ожидание, пока все `Promise` в работе завершатся (каждый `runTask`/`runSingle` закрывает свой запуск `RUN_FINISHED
{cancelled}` и группу процессов, п. исп. 5.6; задачи → `TASK_INTERRUPTED {cause:"stop"}`) → `PROJECT_STOPPED {msg}` (USER) →
ack → выход движка (статус конечный). Порядок «сначала прервать, потом остановить» выбран потому, что после `PROJECT_STOPPED`
ядро не примет `TASK_FAILED`, `RESULT_FILE`, `AGENT_ACTIVITY` (И2), а отказ записи на закрытии запуска сломал бы писателя.
Время до ack — не больше `KILL_GRACE_MS + GROUP_GONE_WAIT_MS` = 8 с (группы останавливаются параллельно), то есть в пределах
`ACK_WAIT_MS`; если группа не ушла и ack опоздал — п. 13.6, шаг 8 (M3): событие записано один раз, отправитель получил «не
подтверждено» и не повторяет. Без движка: команда пишет `PROJECT_STOPPED` сама (после восстановления открытия, если было). (r5.3, R-1) Остановка
по сигналу (п. 12.4) — тоже остановка: команда `stop`, пришедшая, пока после Ctrl-C запуски ещё прерываются, отклоняется
`E_ENGINE_STOPPING` (как прочие сообщения, п. 13.5, шаг 6); проект станет «на паузе», а остановить его можно потом обычной
командой `stop`. Порядок «сначала прервать, потом остановить» не меняется.

### 12.4. Сигналы процесса движка

`SIGINT`/`SIGTERM`: как пауза с выходом — `abort("cancel")` всех действий (причина `cancel`, **не** `stop`: задачи
получают `TASK_INTERRUPTED {cause:"cancel"}`, проект не останавливается, а ставится на паузу), ожидание, `PROJECT_PAUSED` (USER: это
действие человека у терминала; без `msg`), затем выход по п. 13.8 (лежащие сообщения исполняются или отклоняются), код 0 и
вывод п. 15.1. (r5.3, R-1) С момента сигнала и до разбора по п. 13.8 движок отклоняет **все** сообщения, в том числе `stop`,
кодом `E_ENGINE_STOPPING`. `SIGKILL` не перехватывается — п. 14.

## 13. Канал: файл-очередь `inbox/` (`engine/channel.js`, критерий 9; решение ORCH)

### 13.1. Почему файл-очередь

Сокет требует `node:net` — нарушает критерий 6 (F2) и проверки «в движке нет сетевого кода» REQ-010/011. Файл-очередь
работает на тех же средствах, что ядро: права 0600/0700, `O_NOFOLLOW`, «создать, если нет» через `linkSync`, атомарное
переименование внутри одной папки. Путь к `inbox/` знает только `channel.js`: движок, команды и сервер REQ-011 вызывают его
функции по id проекта (п. 13.9), сами путей не собирают.

### 13.2. Устройство `inbox/` (папка проекта, всё создаёт движок, 0700; файлы — 0600)

| Путь | Кто создаёт | Что |
|---|---|---|
| `inbox/` | движок | сообщения `m-*.json` и временные файлы отправителей `.tmp-*`, `.cancel-*` |
| `inbox/m-<n12>.json` | команда / сервер | сообщение. `MSG_NAME = ^m-[0-9]{12}\.json$`: имя — **только номер** (12 цифр с нулями); pid и время отправки — в теле (п. 13.3) |
| `inbox/.tmp-<pid>-<rand16>` | команда / сервер | временный файл сообщения **в той же папке** до публикации |
| `inbox/.cancel-<имя сообщения>` | команда / сервер | отозванное сообщение (миг до удаления) |
| `inbox/taken/.taking-<имя сообщения>` | движок | сообщение, взятое в работу (переименовано из `inbox/`); **не больше двух одновременно** (r5): `stop` — до `PROJECT_STOPPED`, и текущее сообщение, которое во время остановки берётся и отклоняется (п. 13.5, шаг 6); удаляется после обработки |
| `inbox/taken/high` | движок | **наибольший взятый номер** (r4): ровно 12 цифр и `\n` (13 байт), 0600; пишет только движок — временный `taken/.tmp-high-<rand16>` и `renameSync` поверх (замена здесь нужна и безопасна: это файл движка, не сообщение). Нет файла — `high = 0` (пустой канал) |
| `inbox/ack/<nonce>.ack` | движок | подтверждение; имя — `nonce` из тела сообщения; временные — `ack/.tmp-<rand16>` |

Файлы с другими именами движок не читает и не удаляет (одно предупреждение в `notices` при открытии). Меток `.done`, правила
«top» и имён `taken/m-*.json` в r4 нет.

### 13.3. Формы

```
Message = { v: 1, project: <id проекта>, nonce: rand16, sender_pid: int, sent_at: ts,
            kind: "say" | "pause" | "resume" | "stop" | "budget" | "answer",
            args: { text } | {} | { parallel: 1|2|3|null } | {} | { budget_usd: number } | { task, decision, text: string|null } }
Ack = { v: 1, nonce, msg: <имя сообщения>, ok: true,  event: EventView, notices: string[] }
    | { v: 1, nonce, msg: <имя сообщения>, ok: false, code: <код ошибки>, message: string }
```

Ключи — ровно эти, по `kind` — ровно свои `args`; JSON одной строкой UTF-8; файл ≤ `MSG_BYTES_MAX` (64 КиБ, критерий 9).
Тексты (`say.text`, `answer.text`) — **после** `maskSecrets` и с проверкой длины тем же правилом, что без движка (1…4000
кодовых точек, `E_TOO_LONG`). `args` разбирает и проверяет одна функция `parseEngineArgs(kind, args)` — и для командной
строки, и для файла: сообщение не даёт движку ничего, чего не даёт командная строка.

### 13.4. Движок: открытие (`openInbox(projectDir, writer) → Inbox`)

Одна сигнатура: `writer` — писатель движка (нужны `writer.state.msgs`, `writer.state.nonces` и запись события уборки). Под
замком движка, до первого сообщения:

1. `inbox/`, `inbox/taken/`, `inbox/ack/`: нет — `mkdirSync(…, {mode:0o700})`; есть — `lstat`: папка, не ссылка, владелец
   `process.getuid()`; права сужаются до 0700 (`ensureModes`, `PROJECT_ENTRIES`). Иначе `E_CHANNEL` «Папка сообщений проекта
   повреждена или чужая» — это защита от подмены, а не от нагрузки; команды без движка и чтение работают, а движок откроется
   после того, как пользователь уберёт чужую папку. `taken/high` (r5): читается, если это обычный свой файл 0600 ровно
   `^[0-9]{12}\n$`; иначе (нет файла, порча, подмена) — считается 0 и будет переписан на шаге 2.3. Из-за `high` движок не
   отказывается открываться никогда.
2. **Уборка — жёсткий порядок, каждый шаг можно повторить (r4–r5).** Движок не исполняет ни одного найденного сообщения —
   ни остатков аварии, ни опубликованных между взятием замка и уборкой. Число файлов не ограничено.
   1. **Прочитать** `inbox/` (имена `m-*.json`), затем `taken/` (имена `.taking-m-*.json`; `high` и `.tmp-*` не сообщения).
      Каждому имени — `lstat`; `ENOENT` — отправитель как раз отозвал (п. 13.6, шаг 8): имя пропускается. Имена с одной парой
      `(dev, ino)` — один файл (защита от ссылок, подложенных вручную; обычной работой два имени у сообщения не возникают).
      **Сообщение — это файл**, его **идентификатор** — `nonce` из тела (чтение по правилам п. 13.5, шаг 5); файл без
      читаемого `nonce` (порча, подмена) получает идентификатор — первые 16 знаков шестнадцатеричного sha256 строки
      `bad:<dev>:<ino>:<size>:<mtimeMs>` (тот же файл после падения даёт тот же идентификатор).
   2. **Разделить** (r5; r5.1 — один `nonce`, одно сообщение): файлы с одинаковым идентификатором — **одно сообщение** (так
      бывает, если отправитель после ack «устарел» переопубликовал то же сообщение с новым номером, а движок упал до удаления
      первого файла); повторы идентификатора схлопываются — в счёт и в `dropped` он входит один раз, а удаляются на шаге 2.6
      все его файлы. Затем: идентификатор уже есть в `writer.state.nonces` (сообщение исполнено — событие записано, а файл не
      успели удалить; или уже учтено прошлой уборкой) — **известное**: только удалить, не считать. Иначе — **невыполненное**,
      даже если его **имя** есть в `state.msgs`: это опоздавший дубль «устарел» с тем же номером, другим файлом и другим `nonce`
      (проба ворот r4 F) — по имени его не прячем.
   3. **`high`:** **Правило номера (r5.4, одно для отправителя, приёма и уборки; `countsAsNumber(n, base)` в `channel.js`):** номер `n` —
      номер канала, только если `n ≤ base + NUMBER_JUMP_MAX`. Здесь `base = max(high, наибольший номер в `state.msgs`)`: номера, уже
      исполненные и записанные в журнал, — настоящие, даже если `taken/high` пропал или испорчен, поэтому предел отсчитывается и
      от них. `h = max(base, найденные номера, для которых countsAsNumber(n, base))`; если `h > high` **или файл `high` был негоден (шаг 1; r5.1 — в том числе при `h = 0`)** — записать `taken/high`
      (временный файл и переименование). Так новые номера больше любого найденного и любого записанного в журнал.
   4. **События:** если невыполненных ≥ 1 — `writer.recordDropped(их идентификаторы, textFor)` (C7): порции по 100, каждая —
      одно `CHAT {source:"ENGINE", kind:"message", text, dropped}`, все порции **одним пакетом**. Текст порции: «Сообщения,
      полученные до готовности проекта, не выполнены: k» (при нескольких порциях добавляется « (часть i из m)»); `k` — **число
      сообщений** в порции, сумма `k` всех порций — число всех невыполненных сообщений.
   5. **Ack** (r5): каждому невыполненному с читаемым `nonce` — ack `{ok:false, code:"E_CHANNEL_DROPPED", message:"Сообщение не
      выполнено: проект перезапускался. Повторите команду"}` (`linkSync` в `ack/<nonce>.ack`; `EEXIST` — уже есть, пропустить).
      Отправитель, который ещё ждёт, получает ответ о **своём** сообщении, а не совет искать в журнале чужое событие.
   6. **Удалить** все найденные имена (`unlinkSync`; `ENOENT` — пропустить), затем остатки. (r5.5, F1) Временные файлы
      отправителей в `inbox/` — имя `.tmp-<pid>-<rand16>` (pid отправителя — в имени уже сейчас, `channel.js`, `publishMessage`):
      удаляется только файл, **чей pid не жив** (`isAlive` ядра) — отправитель умер и сам его не уберёт; файл живого pid не
      трогается никогда: это публикация, идущая прямо сейчас (гонка EN-67 — отправитель начал публикацию, пока новый движок
      открывался). Имя `.tmp-…` не по шаблону `^\.tmp-[0-9]+-[0-9a-f]{16}$` — не отправителя, удаляется. Почему по pid, а не по
      времени: публикация длится миллисекунды, но процесс отправителя может быть приостановлен (SIGSTOP, нагрузка) сколь
      угодно долго, и предел по `mtime` снова дал бы гонку; по pid ошибка возможна только в сторону «оставить» (pid повторно
      занят чужим процессом) — лишний файл безвреден (не сообщение, в счёт и в предел не входит) и уберётся следующей уборкой.
      `.cancel-*` — удаляются (отправитель свою `unlinkSync(.cancel-…)` выполняет с пропуском `ENOENT`, п. 13.6, шаг 8).
      `taken/.tmp-high-*` и `ack/.tmp-*` — файлы самого движка (один движок под замком), удаляются; `ack/*`, кроме записанных на
      шаге 5, — удаляются.
   **Падение посреди уборки:** после 2.1–2.3 — событий нет, следующая уборка считает заново (`high` только вырос); после 2.4 —
   идентификаторы уже в `state.nonces` (пакет записан целиком или не записан вовсе), следующая уборка удаляет те же файлы,
   **не считая второй раз**, второго события нет; после 2.5–2.6 — то же. Число сообщений в событиях всегда равно числу разных
   невыполненных сообщений.
   **Отзыв отправителем во время уборки:** до шага 2.1 — сообщения нет в счёте, отправитель получает `E_CHANNEL_TIMEOUT`
   («событий нет»), верно; после 2.1 — сообщение в счёте (оно действительно не выполнено), `unlink` даёт `ENOENT` и
   пропускается, отправитель получает `E_CHANNEL_TIMEOUT` или ack `E_CHANNEL_DROPPED` — в обоих случаях событий USER по нему нет.
   Сообщение, опубликованное после чтения 2.1, — обычное: номер ≤ `high` даёт «устарел» и переотправку, больший — исполняется
   в первом приёме.

### 13.5. Движок: приём (каждые `INBOX_POLL_MS`, в том числе на паузе и в ожидании решения)

`high` — наибольший **взятый** номер (r4: хранит только движок, `taken/high`; в памяти — та же величина). Сообщения
обрабатываются строго по одному: следующее берётся только после того, как предыдущее удалено, — кроме `stop`, который ждёт
остановки действий, пока следующие берутся и отклоняются (шаг 6). Асинхронна одна команда —
`stop` (п. 12.3); на время остановки см. шаг 6.

1. Список `inbox/m-*.json` по возрастанию номера.
2. **Взять:** (r5.2, F-5) если `taken/.taking-<имя>` уже есть (во время остановки там лежит `stop` с этим номером), файл в
   `inbox/` — опоздавший дубль: ack «устарел», файл `stop` не трогается, `renameSync` не вызывается (он заменил бы `stop`).
   Иначе `renameSync(inbox/<имя>, taken/.taking-<имя>)`. После этого отправитель отозвать сообщение уже не может (его
   `renameSync(inbox/<имя>, …)` получит `ENOENT`). Имя `.taking-<имя>` создаёт только движок, по одному за раз, предыдущее к
   этому моменту удалено — переименование ничего не заменяет. `ENOENT` — отправитель отозвал, пропустить.
3. **Устарел: номер ≤ `high`** (опоздавший отправитель или повтор номера, п. 13.6, шаг 5) — не исполнять: прочитать `nonce`
   (проверки шага 5), ack `{ok:false, code:"E_CHANNEL_STALE", message:"Номер сообщения устарел"}`, удалить `.taking-<имя>`;
   событий нет; отправитель публикует заново со свежим номером.
4. **Записать `high = n`** (временный файл и переименование) — **до** исполнения. Сбой записи — ack `{ok:false,
   code:"E_DISK", message:<текст ядра>}`, удалить `.taking-<имя>`, событий нет. **Почему до исполнения и почему падение
   безопасно:** после шага 4 номер `n` навсегда занят — даже если движок упадёт до события, следующий номер будет больше `n`,
   и имя `m-<n>` в журнале не повторится; упавшее сообщение найдёт уборка (п. 13.4) и учтёт как невыполненное ровно один раз.
   Падение между шагами 2 и 4 (номер ещё не записан): сообщение лежит в `taken/.taking-…`, уборка учтёт его и поднимет `high`
   (п. 13.4, шаг 2.3). Записать `high` после исполнения нельзя: упав между событием и записью, движок оставил бы `high = n − 1`,
   отправитель взял бы `n`, и второе событие с `msg = m-<n>` отверг бы И24 (отказ до записи, писатель не ломается) — сообщение
   пользователя не было бы исполнено.
5. Проверить файл: `lstat` — обычный файл (`isFile`), не ссылка, владелец свой, права ровно 0600, размер ≤ `MSG_BYTES_MAX`;
   `openSync(O_RDONLY|O_NOFOLLOW)`, `fstat` — тот же `ino`; строгий UTF-8; `JSON.parse`; форма п. 13.3; `project` = id;
   `kind` известен; `parseEngineArgs`. Число жёстких ссылок не проверяется (r1). Нарушение → ack (если `nonce` прочитан)
   `{ok:false, code:"E_CHANNEL_BAD", message:"Сообщение не принято: повреждено или чужое"}`, событий нет.
6. Исполнить: `applyCommand(writer, message, {msg: имя, nonce})` (п. 15.5) — проверка и запись в одной синхронной операции. **Во
   время остановки** (после взятия `stop` **или после сигнала процесса**, п. 12.4 — r5.3, R-1; `view.stopping = true`, до
   выхода) — не исполнять, **в том числе второе `stop`**: ack `{ok:false,
   code:"E_ENGINE_STOPPING", message:"Проект останавливается — сообщение не принято"}`, событий нет; то `stop`,
   с которого началась остановка, исполняется (п. 12.3, ack после `PROJECT_STOPPED`). Отказ (`TeamError`) → ack `{ok:false, code, message}` с тем же текстом,
   что без движка; событий USER нет.
7. `writeAck(nonce, body)` (п. 13.7), затем **удалить** `taken/.taking-<имя>` — и для исполненного (после события и ack), и для
   отклонённого (после ack). Падение после события и до удаления — уборка найдёт его `nonce` в `state.nonces` и просто удалит (п. 13.4,
   шаг 2.2); отправитель получит `E_CHANNEL_UNCONFIRMED` и найдёт событие в журнале.
8. Удалить `ack/*.ack` старше `ORPHAN_ACK_MS` (по `mtime`): отправитель ушёл, ack никому не нужен.

Время события — время писателя (`ts` во входе не передаётся; `sent_at` в журнал не идёт). Поэтому событие не раньше
предыдущего, а порядок строк журнала — порядок номеров: исполняется только номер больше `high`, и `high` растёт. Ровно одно
событие на сообщение: взятие одно (шаг 2), событие несёт `msg`, а И24 не даёт второго события с тем же `msg` (C6). **Проба
ворот r1 (interleave):** A посчитал `n = 5`; `stop` B опубликован как `m-5`, взят, `high = 5`; A публикует `inbox/m-5.json` —
движок берёт его и отвечает «устарел» (`5 ≤ high`); A переотправляет и, раз остановка идёт, получает `E_ENGINE_STOPPING`.
**Пробы r2–r3 (`seq-refuse`, `crash-count*`):** отклонённое сообщение не влияет на `high` (он записан на шаге 4 до отказа),
поэтому следующая команда получает `n + 1`; меток и правила «top» больше нет — нечему пропасть при уборке.

### 13.6. Отправитель (`sendToEngine`)

1. `resolveProjectDir(home, id)` (одинаковый «не найден»).
2. `lockHolder(projectDir)` (C4): нет замка или pid мёртв → `{ fallback: true }` (вызывающий пишет сам через API ядра, как
   REQ-009; в `inbox/` ничего не пишется). Жив и `holder ≠ "engine"` → `E_PROJECT_BUSY` ядра, в `inbox/` ничего не
   создаётся. Жив и `holder = "engine"` → запомнить этот pid как `enginePid` (r1, замечание 7: дальше проверяется **только
   он**, замок заново не читается — после выхода движка замок может взять другой процесс).
3. `inbox/` есть, папка, не ссылка, своя, права 0700 — иначе подождать её до 1 с (движок только что взял замок), затем
   `E_CHANNEL`. Сообщений `m-*.json` в `inbox/` < `INBOX_ENTRIES_MAX` — иначе `E_CHANNEL_FULL` (мягкая защита, п. 3: гарантией не
   является). Ничего не записано.
4. Собрать `Message` (новый `nonce`, `sender_pid = process.pid`), тексты — `maskSecrets` и проверка длины; размер ≤ 64 КиБ —
   иначе `E_MSG_TOO_BIG` до записи.
5. Публикация (одна функция `publishMessage`): `writeFileSync(inbox/.tmp-<pid>-<rand16>, буфер, {flag:"wx", mode:0o600,
   flush:true})`; затем цикл не больше `PUBLISH_TRIES_MAX` = 50 попыток:
   - прочитать имена `inbox/m-*.json`, затем `taken/high` (нет файла — 0; есть, но не по форме п. 13.2 — `E_CHANNEL`);
     `n = nextNumber(номера в inbox/, high)` — **одна функция с движком** (r5.3, step-30). **Правило номера (r5.4, одно для отправителя, приёма и уборки; `countsAsNumber(n, base)` в `channel.js`):** номер `n` —
     номер канала, только если `n ≤ base + NUMBER_JUMP_MAX`. Здесь
     `base = high` (отправитель журнал не читает); номера, для которых `countsAsNumber` ложно, не учитываются (движок такие сообщения отклоняет `E_CHANNEL_BAD`, п. 13.7, и уборка ими `high` не поднимает), поэтому
     подложенный файл с далёким номером не уводит нумерацию отправителя; `n = 1 + max(high, учтённые номера)`; `n >
     NUMBER_MAX` — `E_CHANNEL_FULL`;
   - `linkSync(.tmp, inbox/m-<n12>.json)`: успех — опубликовано; `EEXIST` — номер занят другим отправителем, следующая попытка
     (новое чтение).
   (r5.5, F1) `linkSync` получил `ENOENT` на **своём** временном файле (его удалили — например, старая версия уборки или
   ручная чистка): отправитель пишет новый временный файл и повторяет публикацию; это попытка из того же предела
   `PUBLISH_TRIES_MAX`. Отдельного вида отказа нет. Исчерпаны попытки — `E_CHANNEL_FULL` («проект не успевает принимать
   сообщения — повторите через несколько секунд»). `unlinkSync(.tmp)` в любом исходе (`ENOENT` — пропустить). Существующий файл не заменяется никогда
   (`linkSync`, F14), а имя — только номер, поэтому в `inbox/` один номер занимает один отправитель.
   **Почему канал не «застревает» и порядок верен (r4).** (а) `high` только растёт и пишется движком до исполнения (п. 13.5,
   шаг 4). (б) Отправитель берёт номер больше прочитанного `high`; если между чтением и публикацией движок взял сообщение с
   тем же номером (оно ушло из `inbox/` в `taken/`, а `high` ещё не обновлён), отправитель опубликует дубль — движок ответит
   «устарел» (номер ≤ `high`), отправитель перечитает и возьмёт больший. Каждая переотправка видит `high` не меньше прежнего,
   поэтому за конечное число попыток номер становится больше `high`. (в) Отклонённое или обработанное сообщение удаляется,
   но `high` от этого не уменьшается — следующий номер не возвращается назад. (г) Исполняются только номера больше `high`,
   поэтому события идут по возрастанию номеров.
6. Ждать `ack/<nonce>.ack` (опрос `SEND_POLL_MS`) не дольше `ACK_WAIT_MS` от **первой** публикации; на каждом опросе — жив
   ли `enginePid`.
7. Ack есть: проверить файл — `lstat`: обычный файл, не ссылка, владелец свой, права 0600, размер ≤ `MSG_BYTES_MAX`
   (число ссылок не проверяется, как п. 13.5, шаг 4); строгий UTF-8, форма `Ack`, `nonce` свой. Годный — удалить, вернуть:
   `ok:true` — код 0; `ok:false`, `code = E_CHANNEL_STALE` — переопубликовать (шаг 5, новый номер; тот же `nonce`), ждать
   дальше в пределах того же `ACK_WAIT_MS`; иной `ok:false` (в том числе `E_CHANNEL_DROPPED` от уборки нового движка, п. 13.4, шаг 2.5) — код 1 и текст из ack. **Ack, не прошедший проверку** (ссылка,
   чужой владелец, права шире, слишком большой, не разбирается, чужой `nonce`): отправитель ему не доверяет, **не удаляет и
   не читает дальше**, считает, что подтверждения нет, и идёт к шагу 8 немедленно — итог `E_CHANNEL_UNCONFIRMED` (сообщение
   уже взято движком) или `E_CHANNEL_TIMEOUT` (не взято и отозвано); код 1. Такой файл подложить может только тот же
   пользователь (папки 0700); движок удалит его по `ORPHAN_ACK_MS`.
8. Ack нет (вышли 10 с) **или** `enginePid` умер, а ack нет: отозвать — `renameSync(inbox/<имя>, inbox/.cancel-<имя>)`:
   - удалось → движок сообщение не брал: `unlinkSync(.cancel-…)` (`ENOENT` — пропустить: уборка нового движка могла убрать его первой); ошибка `E_CHANNEL_TIMEOUT` «Сообщение не подтверждено:
     проект его не принял. Повторите команду» (умер — «Проект завершил работу. Повторите команду»), код 1; событий по нему нет и
     не будет;
   - `ENOENT` → движок уже взял (или удалил при уборке после аварии): ошибка `E_CHANNEL_UNCONFIRMED` «Сообщение передано, но
     подтверждение не пришло вовремя; проверьте журнал проекта: npm run team -- events <id>», код 1.
   В обоих случаях отправитель **сам журнал не пишет и сообщение повторно не шлёт** (критерий 9, п. 4). **M3 — ack позже 10 с
   при уже записанном событии:** событие в журнале одно (взятие переименованием — один раз, И24); поздний ack лежит в `ack/`,
   пока движок не удалит его по `ORPHAN_ACK_MS`; повторная команда пользователя — новое сообщение с новым номером.

### 13.7. Места записи канала (все в `channel.js`, только внутри `inbox/`)

`writeInboxFile(dir, buf) → tmpPath` — единственный `writeFileSync` канала (`{flag:"wx", mode:0o600, flush:true}`), для трёх
видов файлов: сообщение (в `inbox/`), ack (в `inbox/ack/`) и `taken/high`. `publishMessage` — `linkSync` в `inbox/`;
`writeAck` — `ack/.tmp-…` + `linkSync` в `ack/<nonce>.ack`; `writeHigh` — `taken/.tmp-high-…` + `renameSync` в `taken/high`;
`mkdirSync` трёх папок; `renameSync` — взять (`inbox/<имя>` → `taken/.taking-<имя>`), отозвать; `unlinkSync` — обработанные
сообщения и уборка. (r5.2, F-4, F-6) Ещё: `renameSync(taken/high, taken/.bad-<rand16>)` — негодный `high` в виде папки или иного
не файла убирается в сторону (после проверки, что папка `taken/` своя), `rmSync` не используется; `chmodSync(…, 0o700)` — только
на проверенных своих папках `inbox/`, `taken/`, `ack/` (сужение прав). Пределы номера: `NUMBER_MAX = 999999999999` (12 цифр) —
отправитель при `1 + max > NUMBER_MAX` получает `E_CHANNEL_FULL`; `NUMBER_JUMP_MAX = 1 000 000`.
**Правило номера (r5.4, одно для отправителя, приёма и уборки; `countsAsNumber(n, base)` в `channel.js`):** номер `n` —
номер канала, только если `n ≤ base + NUMBER_JUMP_MAX`. `base` — `high` при приёме и у отправителя, `max(high, наибольший номер в state.msgs)` при уборке
(п. 13.4, шаг 2.3). Взятое сообщение, для которого `countsAsNumber(n, high)` ложно, отклоняется `E_CHANNEL_BAD` (ack); уборка
такими номерами `high` не поднимает; отправитель их не учитывает. Подложенный файл с огромным номером не исчерпает нумерацию
и не уведёт номер отправителя. Вне `inbox/` канал ничего не создаёт и не меняет. Событий журнала канал не пишет — событие уборки и
события команд пишет движок через `writer.append`.

### 13.8. Выход движка (штатный: конечный статус, сигнал)

До снятия замка: повторять п. 13.5 (шаги 1–6), пока `inbox/m-*` пуст — каждое лежащее сообщение исполняется или
отклоняется ack-ом (выход после `stop` — все `E_ENGINE_STOPPING`, п. 13.5, шаг 6; выход после `done`/`failed` — `say`
пишется (ядро допускает `CHAT`), остальное — `E_FINISHED`; при выходе по
сигналу проект `paused`, `resume` — отказ «Проект завершает работу. Повторите команду»). Затем `writer.close()`. Сообщение,
опубликованное после последнего просмотра, отправитель отзовёт (шаг 8: pid умер) — код 1, событий 0. Итог (тест (д)):
код 0 ⇔ ровно одно событие; код ≠ 0 ⇔ ни одного. При аварии (SIGKILL) ack не будет — п. 13.4, шаг 2.

### 13.9. API `channel.js` для движка, команд и сервера REQ-011 (п. 2 запроса ORCH)

```
deliver(id: string, message: { kind, args }, opts: { home?, env?, now? }) → Promise<DeliverResult>
DeliverResult = { via: "engine", ack: Ack } | { via: "self", event: EventView, notices: string[] }
   // одна точка для «команды без движка» и «через движок»: замка нет/мёртв — открывает писателя ядра (openWriter),
   // applyCommand, close(); жив движок — sendToEngine; жив не движок — E_PROJECT_BUSY. Бросает TeamError.
sendToEngine(id, message, opts) → Promise<Ack | { fallback: true }>     // п. 13.6; без записи журнала
engineHolder(id, opts) → { pid } | null                                 // замок жив и holder = "engine"
openInbox(projectDir, writer) → Inbox                                   // только движок
Inbox = { take(): TakenMessage[], ack(name, body): void, close(): void, dropped: int }
parseEngineArgs(kind, args) → args                                      // общий разбор (бросает E_USAGE и др.)
Константы: MSG_NAME, MSG_BYTES_MAX, ACK_WAIT_MS, INBOX_POLL_MS, SEND_POLL_MS, INBOX_ENTRIES_MAX
```

Сервер REQ-011 вызывает только `deliver(id, {kind:"say", args:{text}}, {home})` (и при желании `engineHolder` для подписи);
путь `inbox` в коде сервера не появляется (`grep -rn 'inbox' tools/src/web/` пусто), записи файлов в сервере нет (M4).
Импорт — строка `from "../team/engine/channel.js"` в файлах сервера, названных проектом REQ-011; так `grep -rn 'channel'
tools/src/web/` находит ровно эти файлы. Случаи REQ-011: (а) движок жив — `via:"engine"`; (б) замка нет — `via:"self"`;
(в) замок у не-движка — `E_PROJECT_BUSY` (сервер показывает «сообщение не отправлено, повторите через несколько секунд»);
`E_CHANNEL_TIMEOUT`/`E_CHANNEL_UNCONFIRMED` — «сообщение не подтверждено, проверьте чат через несколько секунд».

## 14. Восстановление и один движок на проект (критерий 10)

- Решает ядро: открывая проект, `openWriter` нового движка (или команды) по признаку «незакрытая работа» или «обрыв» пишет
  пакет восстановления (п. ядра 6.3, шаг 8): `RUN_FINISHED interrupted`, `TASK_INTERRUPTED {recovery}`, `PROJECT_RECOVERED`
  → `paused` (`recovery`).
- Движок: `resume` → `PROJECT_RESUMED {after:"recovery"}` → `nextActions` берёт задачи `interrupted` (`work`, из
  `interrupted` — `TASK_STARTED` ядра) и задачи `review` без запуска (`review`); новая попытка засчитана (`RUN_STARTED work`
  → `attempts + 1`), запуск в цикле (`launches + 1`). Остатки `inbox/` — п. 13.4, шаг 2.
- «Готово» дважды невозможно: `TASK_DONE` только из `review`/`waiting_user` (И4).
- Один движок: право записи — замок ядра с `holder:"engine"` (C4). Второй `start` при живом движке — отказ
  `E_ENGINE_RUNNING` без записи; второй `resume` — сообщение через канал (движок отвечает «Проект уже выполняется», если проект
  не на паузе и не ждёт решения). Гонка двух открывающих: проигравший получает `E_PROJECT_BUSY` от `openWriter`, повторяет
  проверку `lockHolder` до 3 раз через 100 мс (замок движка уже с `holder`), затем — как выше или `E_PROJECT_BUSY`.
- Сломанный писатель (сбой записи): движок отменяет все действия (`abort`), ждёт их (`runTask` сам вызывает `markBroken`, п.
  исп. 8.2, шаг 8), лежащим сообщениям ack не пишет (событий по ним не будет — их уберёт следующий открывающий, п. 13.4),
  `writer.close()` (замок остаётся — п. ядра 6.4, шаг 10), выходит с кодом 1 и текстом ошибки. Отправители, ждущие ack, после
  10 с получают `E_CHANNEL_TIMEOUT`/`E_CHANNEL_UNCONFIRMED`. В том же процессе проект больше не открывается (п. ядра 17).

## 15. Команды (`npm run team -- …`, все через `runGuarded`)

### 15.1. Вход и вывод

| Команда | Пишет | Успех (stdout, одна строка JSON) |
|---|---|---|
| `start <id> [--parallel N]` | да (держит право записи, пока работает) | при выходе: `{"ok":true,"project":{"id","status","status_text"},"notices":[…]}` |
| `resume <id> [--parallel N]` | да | без движка — как `start`; через канал — `{"ok":true,"event":EventView,"notices":[]}` |
| `pause <id>` | да | `{"ok":true,"event":EventView,"notices":[…]}` |
| `stop <id>` | да | то же (`event` — `PROJECT_STOPPED`) |
| `budget <id> <usd>` | да | то же (`BUDGET_SET`) |
| `answer <id> <задача> approve\|change\|reject [--text "<текст>"]` | да | то же (`DECISION_RECEIVED`); без движка в `notices` — «Ответ записан; он будет выполнен, когда проект продолжит работу» |
| `say <id> "<текст>"` или `say <id> --text "<текст>"` | да | как прежде (REQ-009); через канал — то же поле `event` |

`--parallel` — ровно строка `1`, `2` или `3`; иначе `E_USAGE` «--parallel: число 1, 2 или 3» (код 2, до чтения проекта). Нет
— при `start` 2, при `resume` — прежний (`null` в событии). `<usd>` — как `--budget` команды `new` (п. исп. 9.1). Отдельной
команды `plan` нет: план строит `start`. Все шесть команд канала (`say`, `answer`, `pause`, `resume`, `stop`, `budget`)
исполняются через `deliver` (п. 13.9).

### 15.2. Где команда исполняется (`lockHolder`, C4)

| Команда | Замок жив, `holder = engine` | Замок жив, другой держатель | Замка нет или pid мёртв |
|---|---|---|---|
| `start` | `E_ENGINE_RUNNING`, ничего не записано, `inbox/` не тронут | `E_PROJECT_BUSY` | сама становится движком (только из `created`, иначе `E_NOT_STARTABLE`) |
| `resume` | канал | `E_PROJECT_BUSY` | сама становится движком (из `paused`, `waiting_user`; `planning`/`running` после аварии — восстановление открытия даёт `paused`) |
| `pause`, `stop`, `budget`, `answer`, `say` | канал | `E_PROJECT_BUSY` | пишет сама через `openWriter`, `applyCommand`, `close()` (без `msg`) |
| **M2:** `add-task`, `run-task` | `E_ENGINE_RUNNING` «Проект сейчас ведёт запущенный процесс Sai Team (pid N): эта команда доступна после его остановки», код 1; проверка — до `openWriter` (и повторно по `E_PROJECT_BUSY` от `openWriter`); журнал, замок, `inbox/` не изменены | `E_PROJECT_BUSY` (как REQ-009/010) | как REQ-010 |
| `projects`, `project`, `events`, `new` | как прежде (чтение замок не берёт; `new` создаёт новый проект) | — | — |

### 15.3. Новые коды и тексты (`errors.js`, `ENGINE_MESSAGES`; код выхода 1, кроме `E_USAGE` — 2)

| Код | Текст |
|---|---|
| `E_NOT_STARTABLE` | Проект уже запускался — продолжите его командой resume |
| `E_NOT_STARTED` (r5.2, F-7) | Проект ещё не запускался — запустите его командой start |
| `E_ENGINE_RUNNING` | Проект сейчас ведёт запущенный процесс Sai Team (pid N): эта команда доступна после его остановки |
| `E_ALREADY_RUNNING` | Проект уже выполняется |
| `E_STOPPED` | Проект остановлен — продолжить его нельзя |
| `E_FINISHED` | Проект завершён — продолжить его нельзя |
| `E_PAUSE_STATE` | Поставить на паузу можно только проект в работе или ждущий решения |
| `E_OPEN_QUESTION` | Сначала ответьте на вопрос по задаче t-NNNN: npm run team -- answer <id> t-NNNN … |
| `E_BUDGET_NEEDED` | Сначала поднимите потолок расходов: npm run team -- budget <id> <сумма> |
| `E_BUDGET_LOW` | Новый потолок должен быть больше уже израсходованного |
| `E_NOT_WAITING` | Задача не ждёт вашего решения |
| `E_ANSWER_KIND` | Такой ответ здесь не подходит: можно change с текстом или reject |
| `E_MSG_TOO_BIG` | Сообщение слишком большое |
| `E_CHANNEL` | Связь с работающим проектом недоступна: папка сообщений повреждена или чужая |
| `E_CHANNEL_BAD` | Сообщение не принято: повреждено или чужое |
| `E_ENGINE_STOPPING` | Проект останавливается — сообщение не принято |
| `E_CHANNEL_DROPPED` | Сообщение не выполнено: проект перезапускался. Повторите команду |
| `E_CHANNEL_STALE` | Номер сообщения устарел (только внутри канала: отправитель переотправляет сам, пользователь кода не видит) |
| `E_CHANNEL_FULL` | Проект не успевает принимать сообщения — повторите через несколько секунд |
| `E_CHANNEL_TIMEOUT` | Сообщение не подтверждено: проект его не принял. Повторите команду / Проект завершил работу. Повторите команду |
| `E_CHANNEL_UNCONFIRMED` | Сообщение передано, но подтверждение не пришло вовремя; проверьте журнал проекта: npm run team -- events <id> |

`E_USAGE` (новые): «--parallel: число 1, 2 или 3»; «Нужна сумма: budget <id> <сумма>»; «Сумма: число больше 0 и не больше
100000, до 6 знаков после точки»; «Нужен номер задачи»; «Решение: approve, change или reject»; «Для change нужен --text»;
«--text нужен только для change»; «Текст сообщения указан дважды». Правило ядра: ошибка разбора не повторяет значений
аргументов. Прежние коды исполнителей (`E_REAL_RUNS_OFF`, `E_NO_BUDGET`, …) — без изменений.

### 15.4. Тексты вопросов (`QUESTION`, `engine/answers.js`)

| Вид | Текст CHAT (без технических слов) |
|---|---|
| `approval` | «От вас требуется решение: черновик задачи «<описание до 200 знаков>» готов. Одобрить, изменить или отклонить?» |
| `review_failed` | «Результат задачи «…» не прошёл проверку и у другого специалиста. Изменить задачу или отклонить её?» |
| `task_failed` | «Задача «…» не получилась: <FAIL_DETAIL>. Изменить её или отклонить?» |
| `budget` | «Достигнут потолок расходов. Поднимите потолок, чтобы продолжить, или остановите проект» |
| `plan_failed` | «Не удалось составить план. Уточните цель сообщением и продолжите проект или остановите его» |
| `goal_check_failed` | «Цель пока не достигнута после дополнительных задач. Добавьте указания и продолжите проект или остановите его» |

### 15.5. Общая проверка и запись (`applyCommand(writer, message, opts: { msg?: string, nonce?: string }) → Event`)

Одна функция для движка (сообщение канала, `msg` = имя файла) и для команды без движка (`msg` нет): проверка по текущему
`writer.state` и запись — один синхронный вызов (защита в той же операции). Правила — п. 9.2, 10, 12 и таблица:

| `kind` | Проверка (отказ — `TeamError`, журнал не изменён) | Запись |
|---|---|---|
| `say` | текст 1…4000 после маскирования | `CHAT {text, kind:"message", truncated:false, msg?}` (USER) |
| `pause` | статус `planning`/`running`/`waiting_user` (`E_PAUSE_STATE`) | `PROJECT_PAUSED {msg?}` |
| `resume` | п. 12.2 (`running`/`planning` — `E_ALREADY_RUNNING`) | `PROJECT_RESUMED {parallel, after, msg?}` |
| `stop` | статус не конечный | `PROJECT_STOPPED {msg?}` (у движка — после остановки действий, п. 12.3) |
| `budget` | > 0, ≤ 100000, > `spent_usd` (`E_BUDGET_LOW`) | `BUDGET_SET {budget_usd, msg?}` |
| `answer` | `checkDecision` (п. 9.2) | `DECISION_RECEIVED {decision, text, msg?}`; движок затем `applyDecisions` в том же `tick` |

## 16. Правда событий (R2, критерий 11)

- Время каждого события ENGINE ставит писатель (`now()` ядра); движок `ts` не передаёт ни для одного события, в том числе
  USER из канала. Часы назад — `E_TIME` ядра (п. 17).
- Каждое событие пишется в момент настоящего изменения: смена статуса — одним событием (таблица ниже); событий смены статуса
  без смены нет — ядро отклоняет такие переходы (И13), а движок не вызывает их: перед записью статуса `nextActions`/обработка
  сообщений сверяют текущий статус.
- `AGENT_ACTIVITY` пишет только `runTask`/`runSingle` во время открытого запуска (И7) — после `RUN_STARTED` и до
  `RUN_FINISHED`, то есть после запуска задачи и до её итога.
- Заготовленных событий, сценариев и текстов агентов в `tools/src/team/` нет (проверки критерия 2 REQ-010 проходят).

| Смена | Событие | Кто |
|---|---|---|
| П `created → running` | `PROJECT_STARTED` | движок (`start`) |
| П `running → planning` | `PLANNING_STARTED` | движок |
| П `planning → running` | `PLAN_RECEIVED` | движок |
| П `→ waiting_user` | `PROJECT_WAITING` | движок |
| П `→ paused` | `PROJECT_PAUSED` / `PROJECT_RECOVERED` | команда через движок / ядро |
| П `→ running` из `paused`/`waiting_user` | `PROJECT_RESUMED` | движок или команда |
| П `→ stopped` / `done` | `PROJECT_STOPPED` / `PROJECT_DONE` | движок или команда / движок |
| З `waiting/interrupted/failed/review/waiting_user → running` | `TASK_STARTED` | `runTask` |
| З `running → review` | `TASK_REVIEW` | `runTask` |
| З `review → waiting_user` | `TASK_WAITING_USER` | движок |
| З `→ done` | `TASK_DONE` | движок |
| З `→ failed` | `TASK_FAILED` | `runTask` / движок |
| З `→ interrupted` | `TASK_INTERRUPTED` | `runTask`, `runSingle` (движок) / ядро |

## 17. Пути отказа (что видит пользователь и что неизменно)

| Случай | Что видит | Код | Что неизменно |
|---|---|---|---|
| `--parallel 0`, `4`, `x` | `E_USAGE: --parallel: число 1, 2 или 3` | 2 | всё; журнал не читался |
| `start` claude-cli без `SAI_TEAM_REAL_RUNS=1` | `E_REAL_RUNS_OFF: Настоящие запуски выключены: нужна переменная SAI_TEAM_REAL_RUNS=1` | 1 | журнал (хеш), запусков 0, замок не брался |
| `start`/`resume` проекта без потолка на claude-cli | `E_NO_BUDGET: …` | 1 | то же |
| `start` не из `created` | `E_NOT_STARTABLE` | 1 | журнал |
| `start`, `add-task`, `run-task` при живом движке (M2) | `E_ENGINE_RUNNING` | 1 | журнал, замок (тот же pid), `inbox/` |
| `resume` проекта в работе (через канал) | `E_ALREADY_RUNNING: Проект уже выполняется` | 1 | событий USER по сообщению нет |
| `resume` остановленного / завершённого | `E_STOPPED` / `E_FINISHED` | 1 | журнал |
| (r5.2, F-7) `resume` проекта, который не запускался (`created`) — без движка и через канал | `E_NOT_STARTED` | 1 | журнал (до любой записи; прежде — `E_TRANSITION` ядра) |
| (r5.2) Пустой текст `say`/`answer` через канал или `deliver` | `E_EVENT: Событие отклонено: text` (как у ядра без движка, TM-33) | 1 | событий нет |
| (r5.2, F-8) `answer` на задачу, упавшую только по потолку | `E_NOT_WAITING` | 1 | журнал |
| `resume` при открытом вопросе по задаче / без потолка | `E_OPEN_QUESTION` / `E_BUDGET_NEEDED` | 1 | журнал |
| Команда для несуществующего проекта | `E_NOT_FOUND: Проект не найден` | 1 | всё; файлов вне `<HOME>` не касались |
| `answer` на задачу не в ожидании / чужого проекта | `E_NOT_WAITING` / `E_TASK_NOT_FOUND` | 1 | журнал (хеш) |
| `answer approve` на задачу «не удалось» | `E_ANSWER_KIND` | 1 | журнал |
| `budget` 0, отрицательное, не число | `E_USAGE` | 2 | всё |
| `budget` ≤ израсходованного | `E_BUDGET_LOW` | 1 | журнал |
| Замок держит не движок (короткая команда, API ядра) | `E_PROJECT_BUSY: Проект занят другим процессом (pid N)` | 1 | всё; в `inbox/` ничего не создано |
| `inbox/` — ссылка, чужая, широкие права | `E_CHANNEL` | 1 | журнал, `inbox/` |
| `inbox/` переполнен | `E_CHANNEL_FULL` | 1 | журнал, `inbox/` |
| Сообщение > 64 КиБ | `E_MSG_TOO_BIG` | 1 | журнал; в `inbox/` файла нет (отказ до записи) |
| Файл сообщения — ссылка, не обычный, права шире 0600, чужой, > 64 КиБ, неразбираемый, чужой id, неизвестная команда | ack `E_CHANNEL_BAD` (если отправитель ждёт) | 1 | событий USER нет |
| Сообщение пришло во время остановки (после взятия `stop`) | `E_ENGINE_STOPPING` | 1 | событий по нему нет |
| Сообщение опубликовано между взятием замка новым движком и уборкой `inbox/` | ack `E_CHANNEL_DROPPED` «Сообщение не выполнено: проект перезапускался. Повторите команду» (если отправитель успел отозвать после чтения уборки — `E_CHANNEL_TIMEOUT`); в журнале событие уборки с его `nonce` в `dropped` | 1 | событий USER по нему нет |
| Опоздавший отправитель занял номер ≤ взятого | ничего: ack `E_CHANNEL_STALE`, отправитель сам переопубликовал с новым номером | 0 или как итог новой публикации | событий по старому номеру нет |
| Ack не прошёл проверку отправителя (ссылка, чужой, права, размер, разбор, чужой `nonce`) | `E_CHANNEL_UNCONFIRMED` или `E_CHANNEL_TIMEOUT` (п. 13.6, шаги 7–8) | 1 | ack не удалён и не прочитан; отправитель журнал не пишет |
| Движок не взял сообщение за 10 с (например, SIGSTOP) | `E_CHANNEL_TIMEOUT` | 1 | сообщение отозвано; событий нет и не будет |
| Движок взял, ack опоздал или движок умер (M3) | `E_CHANNEL_UNCONFIRMED` | 1 | событие записано 0 или 1 раз — не дважды; отправитель не повторяет |
| Движок завершил работу до взятия сообщения | `E_CHANNEL_TIMEOUT` «Проект завершил работу. Повторите команду» | 1 | событий нет |
| Сбой исполнителя одной задачи | вопрос `task_failed` | — | другие задачи идут дальше, движок жив (Q10) |
| Исключение не `TeamError` внутри `runTask`/`runSingle` | задача `failed` (`runTask` шаг 8 / `runSingle` то же правило) | — | запуск закрыт; движок жив |
| Сбой записи журнала (`E_DISK`, `E_LOCK_LOST`, `E_CONFLICT`) | stderr — текст ядра | 1 | писатель сломан, замок остаётся; восстановит следующий открывающий |
| Часы назад (`E_TIME`) | stderr `E_TIME: …`; движок: отмена действий, выход | 1 | журнал без события |
| Ошибка программы | `E_INTERNAL: …` без стека | 3 | движок выходит после отмены действий (`finally`) |

## 18. Места записи (критерий 11 REQ-013, критерий 2 REQ-009 — пять мест)

| Файл | Вызов | Что пишет | В `grep 'appendFile\|createWriteStream\|writeFile'` |
|---|---|---|---|
| ядро (п. ядра 13) | прежние четыре места | журнал, файлы результата, сценарий, замок (с `holder` у движка, C4) | как прежде |
| `engine/channel.js` (`writeInboxFile`) | `fs.writeFileSync(<папка>/.tmp-…, буфер, {flag:"wx", mode:0o600, flush:true})` | временный файл сообщения (в `inbox/`), ack (в `inbox/ack/`) и `taken/high` — три вида файлов канала | да — **пятое место** |
| `engine/channel.js` | `linkSync` (публикация сообщения и ack без замены), `renameSync` (взять в `.taking-…`, отозвать, `taken/high` поверх своего временного), `mkdirSync` (три папки 0700), `unlinkSync` (уборка) | имена внутри `inbox/` | нет — названы здесь |

Журнал движок пишет **только** через `writer.append` и удобные методы ядра (`runTask` — так же). Других мест записи нет;
`channel.js` пишет только внутри `inbox/` своего проекта.

## 19. Модули и экспорты

| Файл | Экспорт |
|---|---|
| `engine/engine.js` | `createEngine(id, opts) → Engine`; `runEngineCommand(mode, args, env, io) → Promise<object>` (для `cli.js`) |
| `engine/schedule.js` | `PARALLEL_DEFAULT`, `PARALLEL_ALLOWED`, `CYCLE_RUNS_MAX`, `ROUNDS_MAX`, `SINGLE_RUNS_MAX`, `MIN_RUN_USD`; `nextActions(state, view, config) → Action[]`; `slotBudget(state, config, reservedByOthers) → number \| null`; `readyTasks(state) → string[]` |
| `engine/plan.js` | `PLAN_ANSWER_SCHEMA`; `PLAN_DETAIL`; `validatePlan(answer, state)`; `orderPlan(items)`; `planNote(state, facts, rejection)` |
| `engine/review.js` | `REVIEW_ANSWER_SCHEMA`, `GOAL_ANSWER_SCHEMA`, `REASSIGN_ANSWER_SCHEMA`; `reviewContext(writer, task)`; `goalContext(writer)`; `reassignNote(state, task, facts)` |
| `engine/answers.js` | `QUESTION`; `checkDecision(state, taskId, decision, text)`; `openQuestions(state, facts)`; `pendingDecisions(state, facts)`; `closedTasks(state)` |
| `engine/facts.js` | `scanFacts(events) → Facts`; `noteEvent(facts, event)` |
| `engine/single-run.js` | `runSingle(writer, spec, opts) → Promise<{ result: RunResult \| null, run_id, error: TeamError \| null }>`; `spec = { purpose, role, task \| null, context, answer_schema, maxBudget }`; закрывает запуск на всех путях (как п. исп. 8.2, шаг 8; при невозможности — `markBroken()`) |
| `engine/channel.js` | п. 13.9: `deliver`, `sendToEngine`, `engineHolder`, `openInbox`, `parseEngineArgs`; константы п. 3 и `MSG_NAME` |
| `engine/commands.js` | `COMMANDS` (разбор аргументов новых команд); `applyCommand(writer, message, opts)` (п. 15.5) |

Импорт из `tools/src/pixel-office/`: `channel.js` импортирует `maskSecrets` из `mask.js` (третий импортирующий после
`store.js` и `runner.js`; правила маскирования одни — импорт, не копия).

## 20. README: раздел «## Sai Team — движок» (`tools/README.md`, критерий 12)

Подразделы: как цель становится планом и задачами (Руководитель проекта, проверка плана, одна повторная попытка); предел
параллельности (2 по умолчанию, 1–3, `--parallel`); контекст задачи (цель, память, результаты зависимостей); проверка
результата отдельным запуском Проверяющего, 2 повтора, передача другой роли, вопрос пользователю; согласования — критические
задачи только черновик, `answer approve|change|reject`, одобрение не совершает действий вовне; потолок проекта, `budget`,
`resume`, резерв при параллельных запусках; завершение — сверка цели, не больше 2 раундов дозадач; пауза, возобновление,
остановка, Ctrl-C; восстановление после падения; канал (`inbox/`, подтверждение, «не подтверждено» и почему без повтора);
команды `start`, `pause`, `resume`, `stop`, `answer`, `budget`, `say` с вымышленными примерами; остаточные риски п. 23.

## 21. Критерий → тест

Все тесты движка запускают исполнитель только через помощник `team-engine-helpers.js`, который вызывает `assertSafeEnv`
(`exec-helpers.js`, п. исп. 15.2) до любого запуска; у каждого теста, запускающего процессы, свой `{ timeout }`; ожидания — по
событию журнала (`waitUntil`), не по паузе. Тесты отказа проверяют хеш журнала **и** отсутствие обращений к журналу там, где
отказ раньше (`countJournalCalls` из `team-helpers.js`; AP-048).

| Критерий | Тест | Что проверяет (кратко) |
|---|---|---|
| 1 | EN-01 `team-planner` | годный план: задачи в журнале с ролью, описанием, критерием, `depends_on`, `critical`; одна строка `PLAN_RECEIVED` |
| 1 | EN-02 | по отдельному тесту на каждый порок (схема, цикл, 41 задача, роль вне каталога, ссылка в никуда): `PLAN_REJECTED` с этим `reason`, `PLAN_RETRY`, второй вход планировщика (`record_input`) содержит `detail`; второй с пороком — `PROJECT_WAITING {plan_failed}`, `CHAT question`, `TASK_CREATED`/`PLAN_RECEIVED` нет |
| 1 | EN-03 | план ровно из 40 задач принят |
| 1 | EN-04 | `validatePlan` (модуль): порядок проверок, `orderPlan` даёт зависимости только на меньшие номера |
| 1 | EN-05 | сбой запуска плана (`failed`) — `PROJECT_WAITING {plan_failed}` без `PLAN_REJECTED`; `invalid_output` — порок `schema` |
| 2 | EN-10 `team-engine` | 6 независимых задач, задержки: наибольшее число одновременно выполняемых по журналу — 2 без настройки, 1 при `--parallel 1`, 3 при `--parallel 3` |
| 2 | EN-11 | `start --parallel 0`, `4`, `x`: код 2, текст, хеш журнала до/после, 0 обращений к журналу |
| 2 | EN-12 | A → B → C и D: начало B не раньше `TASK_DONE` A, C — не раньше B, D идёт одновременно с A |
| 2 | EN-13 | `start` и `resume` на claude-cli (поддельный с счётчиком) без `SAI_TEAM_REAL_RUNS=1` и отдельно проект без потолка (API ядра): код ≠ 0, текст, запусков 0, хеш журнала, замок не создан |
| 2 | EN-14 | предпроверка внутри исполнителя действует и для плана, проверки и сверки цели: мутант «без предпроверки команды» всё равно отказывает (запусков 0) |
| 3 | EN-20 `team-engine-failure` | задача всегда падает: после повторов `TASK_FAILED`, `PROJECT_WAITING {task_failed}`, `CHAT question`; идущая независимая задача доведена до итога |
| 3 | EN-21 | `answer change --text`: задача снова запущена, вход содержит текст; `reject`: «не удалось» остаётся, вход следующего плана содержит отказ; `approve` — `E_ANSWER_KIND`, хеш журнала |
| 4 | EN-25 `team-engine-context` | вход задачи (`record_input`): цель, память, имена и содержимое файлов всех зависимостей; нет файлов независимых задач; нет ничего из второго проекта того же теста |
| 4 | EN-26 | агент не получает путей файлов ядра: во входе нет `events.jsonl`, `writer.lock`, `inbox` |
| 5 | EN-30 `team-engine-review` | «на проверке» → отдельный `RUN_STARTED review` (другой `run_id`) → `REVIEW_RESULT passed` → `TASK_DONE`; обход всего журнала: нет `TASK_DONE` без предшествующего `REVIEW_RESULT {passed:true}` по той же задаче |
| 5 | EN-31 | всегда «не прошла»: 3 `work` исходной роли (2-й и 3-й вход с замечаниями), `TASK_REASSIGNED` (роль другая, из каталога), 3 `work` другой роли, `TASK_WAITING_USER {review_failed}`, `CHAT question`; число запусков по `purpose` ровно эти |
| 5 | EN-32 | ответ выбора роли с той же ролью или ролью вне каталога — сразу вопрос пользователю, `TASK_REASSIGNED` нет (C2) |
| 6 | EN-35 `team-engine-approval` | критическая: черновик в `files/`, `TASK_WAITING_USER {approval, draft}`, `CHAT` «От вас требуется решение», зависимые не начинаются |
| 6 | EN-36 | `answer approve`: `DECISION_RECEIVED` (USER), `TASK_DONE {via:"approval", external_action_done:false}`, фраза «действие вовне не выполнено» |
| 6 | EN-37 | `change --text`: задача снова с текстом во входе; `reject`: `TASK_FAILED {rejected_by_user}`, вход следующего плана содержит отказ |
| 6 | EN-38 | ответ на задачу не в ожидании и на id другого проекта — отказ, хеш журнала |
| 6 | EN-39 | `grep -rnE 'node:(http\|https\|net\|tls\|dgram)\|fetch[(]' tools/src/team/` пусто |
| 7 | EN-40 `team-engine-budget` | поддельный claude с расходом: при достижении потолка счётчик запусков не растёт, `PROJECT_WAITING {budget}`, `CHAT question` |
| 7 | EN-41 | `budget` ≤ израсходованного, 0, отрицательное, `x` — код ≠ 0, хеш журнала |
| 7 | EN-42 | больший `budget` → `BUDGET_SET` (USER); `resume` → запуски снова; каждый `--max-budget-usd` ≤ нового остатка |
| 7 | EN-43 | два параллельных запуска: сумма `--max-budget-usd` открытых запусков ≤ остатка (резерв п. 6.3) |
| 8 | EN-45 `team-engine-finish` | сверка «прошла» → `PROJECT_DONE` |
| 8 | EN-46 | сверка «не прошла» → `PLANNING_STARTED {round:1}`, затем `{round:2}`, снова «не прошла» → `PROJECT_WAITING {goal_check_failed}`, `CHAT question` |
| 8 | EN-47 | во всех журналах тестов движка нет `PROJECT_DONE` без предшествующего `GOAL_CHECK_RESULT {passed:true}` (помощник обходит журналы каждого теста) |
| 9 | EN-50 `team-engine-control` | (1) `pause` (без движка и через канал): новые задачи не начинаются, идущие доведены; `resume` — работа продолжается |
| 9 | EN-51 | (1) `stop`: дерево процессов поддельного исполнителя мертво (`groupAliveOf`), задачи `interrupted` (`cause:"stop"`), `PROJECT_STOPPED`; `resume` — `E_STOPPED`, хеш журнала |
| 9 | EN-52 | (1) каждая новая команда для несуществующего проекта — «Проект не найден», код 1 |
| 9 | EN-53 | (2) `grep -rnE 'node:(http\|https\|net\|tls\|dgram)\|fetch[(]' tools/src/team/` пусто (то же, что EN-39 — повтор в файле канала); `grep -rlE 'writeFile\|linkSync\|renameSync\|mkdirSync' tools/src/team/engine/` находит только `channel.js` |
| 9 | EN-55 `team-channel` | (а) каждая из шести команд отдельно из другого процесса при работающем движке (отдельный процесс): код 0, ack есть, ровно одно ожидаемое событие USER с `msg` = имя файла (say — `CHAT` с текстом; pause — после него ни одного `TASK_STARTED`; resume на паузе; stop — «остановлен»; budget; answer approve критической — «готово»); замок тот же (`holder`, pid до и после); строки журнала разбираются |
| 9 | EN-56 | (а) отказы через канал: `resume` не на паузе («Проект уже выполняется»), `answer` на задачу не в ожидании, `budget` ≤ израсходованного — код ≠ 0, текст, событий USER с этим `msg` нет |
| 9 | EN-57 | (б) 20 одновременных `say` — 20 разных номеров (имена `m-<n12>.json` без повторов), 20 `CHAT`, порядок строк журнала = порядок номеров (`msg`), время каждого не раньше предыдущего (гонка; прогон в 4 параллельных процессах). Модульная часть (подмена `fs` и часов): (1) два отправителя с одним `n` — второй получает `EEXIST` и занимает `n + 1`; (2) пустой канал (`taken/high` нет) — первый номер 1; (3) опоздавший `inbox/m-<n>.json` при `high ≥ n` — ack `E_CHANNEL_STALE`, переотправка, ровно одно событие; (4) сообщение, взятое при двух жёстких ссылках (до удаления `.tmp`), исполнено; (5) проба r1 interleave — A получает «устарел», затем `E_ENGINE_STOPPING`; одно `PROJECT_STOPPED {msg:"m-000000000005.json"}`, писатель не сломан; (6) во время остановки новое сообщение — `E_ENGINE_STOPPING`, событий нет; (7) `high` записан до исполнения: подмена падения после шага 4 п. 13.5 (до события) — после `resume` сообщение в `dropped`, следующий номер `n + 1`, событий с `msg = m-<n>` USER нет; (8) проба r2 `seq-refuse`: отказ команды, затем порча — ack с причиной, файл удалён, `high = n`; следующая команда принята с номером `n + 1`; (9) уборка: (а) проба ворот r4 F — исполнено `m-7` (событие с `msg` и `nonce` A), движок упал до удаления; в `inbox/` дубль «устарел» `m-7.json` с другим файлом и `nonce` B; уборка: файл A — известный (только удалён), файл B — невыполненный, `dropped` = [B], число 1; отправитель B получает ack `E_CHANNEL_DROPPED`, а не «проверьте журнал»; (б) исполнено, файл не удалён — число 0, файл удалён; (в) отзыв отправителем между чтением и удалением — `unlink` `ENOENT` пропущен, сообщение в счёте; (г) падение после пакета событий, до удаления — повторная уборка: новых событий нет, файлы удалены; (д) падение до событий — повторная уборка пишет те же порции; (е) после уборки `high` ≥ всех найденных номеров и номеров `msgs`; (ж) проба ворот r4 G — 250 невыполненных файлов (создаёт тест): три события (100, 100, 50) одним пакетом, сумма 250, проект открыт, второй `resume` событий не пишет; сбой `fsync` пакета (fault-inject) — событий 0, файлы на месте, следующий `resume` пишет все порции; (з) порча или подмена `taken/high` — движок открывается, `high` пересчитан и переписан, в том числе при `h = 0` (проба K2: после уборки отправитель получает номер 1, а не `E_CHANNEL`); (и) проба H — два файла с одним `nonce` (`.taking-m-7` после ack «устарел» и `inbox/m-8`): одно событие, `k = 1`, `dropped` без повторов, оба файла удалены, второе открытие событий не пишет; (к) (r5.3) подложенный файл `inbox/m-<high + 2 000 000>.json` и настоящий отправитель — отправитель получает номер `high + 1`, код 0, событие есть; подложенный — ack `E_CHANNEL_BAD`, событий нет; (л) (r5.3, R-1) Ctrl-C (`SIGTERM`) при задачах в работе, затем `stop` до выхода движка — `stop` получает `E_ENGINE_STOPPING`, код ≠ 0, в журнале `PROJECT_PAUSED` и нет `PROJECT_STOPPED`, писатель не сломан (проба `rev-req013/r2/probe-signal-stop.test.mjs`); (м) (r5.5, F1) детерминированное окно уборки: обёртка `fs` в тесте — отправитель записал `inbox/.tmp-<свой pid>-…`, перед его `linkSync` выполняется `openInbox` (уборка) — временный файл на месте, публикация с первой попытки (вызов `writeInboxFile` один), код 0; второй случай — обёртка удаляет временный файл перед `linkSync` — отправитель пишет новый и публикует, код 0; временный файл мёртвого pid уборка удаляет |
| 9 | EN-58 | (в) от публикации файла (`mtime` файла сообщения по `stat` теста) до события — ≤ 1 с; движок под SIGSTOP — `say` код ≠ 0 через 10…12 с; после SIGCONT события с этим текстом нет, файла в `inbox/` нет |
| 9 | EN-59 | (г) на паузе `say` и `budget` приняты (события есть), `TASK_STARTED` после паузы нет |
| 9 | EN-60 | (д) 30 повторов `say` в момент завершения проекта: код 0 ⇔ ровно одно событие с текстом; код ≠ 0 ⇔ ноль |
| 9 | EN-61 | (е) после SIGKILL движка `say` пишет сама: код 0, одно `CHAT`, `LOCK_STALE_REMOVED`; файлы `inbox/` до SIGKILL после `resume` не исполнены; события уборки «…не выполнены: k» с `dropped` = их `nonce`, сумма `k` = числу разных невыполненных сообщений. Отправитель, ждавший убитый движок, видит смерть его pid и отзывает сообщение раньше уборки — получает `E_CHANNEL_TIMEOUT`, его сообщения нет в счёте. Ack `E_CHANNEL_DROPPED` проверяется на достижимом случае: тест задерживает уборку нового движка (fault-inject перед шагом 2.1 п. 13.4), отправитель пишет уже новому движку (замок с `holder: engine`) — после уборки получает ack `E_CHANNEL_DROPPED`, код 1, его `nonce` в `dropped`, событий USER нет |
| 9 | EN-62 | (ж) права: `inbox/`, `taken/`, `ack/` — 0700, сообщения и ack — 0600 (`stat`); по одному случаю: ссылка, права 0644, > 64 КиБ, неразбираемое, чужой id, неизвестная команда — событий USER нет; `inbox/` — ссылка или права 0755 — `E_CHANNEL`, ничего не записано; `say` с приманкой-секретом — `grep -r` по папке проекта, включая `inbox/`, приманку не находит; подложенный негодный ack (права 0644 или ссылка) — отправитель код 1, файл ack не удалён |
| 9 | EN-63 | (з) замок держит помощник теста через API ядра (без `holder`) — `say` отказ «проект занят», в `inbox/` ничего не создано; `say` без движка — одно `CHAT` USER (без `msg`) |
| 9 | EN-64 | M2: при живом движке `add-task`, `run-task`, `start` — `E_ENGINE_RUNNING`, хеш журнала, pid замка тот же, `inbox/` без новых файлов; ack, пришедший после 10 с (движок взял сообщение и задержан), — отправитель код ≠ 0 `E_CHANNEL_UNCONFIRMED`, в журнале ровно одно событие с этим `msg` (M3); И24: второе событие с тем же `msg` через `writer.append` — `E_TRANSITION` |
| 10 | EN-65 `team-recovery` | SIGKILL процесса движка с идущими задачами (и поддельного исполнителя): `resume` — устаревший замок снят, задачи `interrupted`, затем снова запущены, попытка засчитана; нет двух `TASK_DONE` одной задачи |
| 10 | EN-66 | SIGKILL посреди записи строки (fault-inject): оборванная строка отброшена; `deepStrictEqual(replay(журнал), engine.state())` после восстановления; `scanFacts` = факты движка |
| 10 | EN-67 | гонка: 4 процесса `start`/`resume` одновременно — один движок, остальные `E_ENGINE_RUNNING`/`E_ALREADY_RUNNING`/`E_PROJECT_BUSY`, одно `PROJECT_STARTED`/`PROJECT_RESUMED` (прогон в 4 параллельных процессах); (r5.5, F1) плюс в каждом раунде отправители `say` к открывающемуся движку: ни один не получает `E_DISK`/`ENOENT`, у каждого — код 0 с одним событием или понятный отказ; прогон в 4 параллельных процессах |
| 10 | EN-68 | сломанный писатель движка (EIO на записи) — выход с кодом 1, замок остаётся; следующий `resume` восстанавливает и убирает `inbox/` |
| 11 | EN-70 `team-engine-truth` | на журналах сценариев: `ts` каждого ENGINE не раньше предыдущего и не позже часов чтения; воспроизведение с проверкой каждого шага — на каждую смену статуса одно событие, нет событий смены без смены (`assertStatusChanges` из `team-helpers.js`) |
| 11 | EN-71 | каждое `AGENT_ACTIVITY` после `TASK_STARTED`/запуска своей задачи и до её итога |
| 11 | EN-72 | `grep -rnE 'appendFile\|createWriteStream\|writeFile' tools/src/team/` — ровно пять мест: четыре места п. ядра 13 (`store.js` ×2, `lock.js`, `files.js`) и `engine/channel.js` (`writeInboxFile`); проверки критерия 2 REQ-010 проходят |
| 12 | EN-75 `team-engine-docs` | `tools/README.md` содержит раздел и все подразделы п. 20 (по заголовкам и ключевым строкам) |
| 12 | EN-76 | (r5.2, F-3; r5.4 — что покрыто, R-6) `tools/test/team-engine-docs.test.js`: (1) в `exec-helpers.js` функции `runTeam`, `spawnTeam`, `runTeamExpectRefusal`, а в `team-engine-helpers.js` — `startEngine`, `runToEnd`, `spawnEngine`, `manualEngine` найдены как охраняемые: каждая функция помощника, где есть запуск (`spawnSync(`, `spawn(`, `runTeam(` / `createEngine(`, `spawnTeam(`), вызывает `assertSafeEnv` раньше; (2) в каждом `tools/test/team-*.test.js` (текст без комментариев), где нет вызова `assertSafeEnv(`, каждый найденный запуск идёт через охраняемую функцию, импортированную из этих помощников. «Найденный запуск» — вызов вида `<имя>(["start"|"resume"|"run-task", …` (**литерал** первым элементом массива) и вызовы `createEngine(`, `startEngine(`, `runToEnd(`, `spawnEngine(`, `manualEngine(`. **Не покрыто:** аргументы, собранные в переменной (`runTeam(args)` с `args = ["start", …]`), запуск через функцию под другим именем или из другого модуля, прямой `child_process` в файле теста; файл с хотя бы одним вызовом `assertSafeEnv(` проверяется целиком как охраняемый. Эти случаи ловит общая защита: `HOME` теста пуст, `SAI_TEAM_CLAUDE_BIN` указывает на подделку (п. исп. 15.2) |
| 12 | EN-77 | (команда, не тест) на копии без `node_modules` `<вне проекта>`: `cd tools && npm ci && npm run check` — код 0, вывод в handoff |
| 13 | UAT | не тест: UAT-RUNNER только после письменного согласия владельца и его потолка (п. 24, раунд 6) |
| C1 (для 3, 6, 8) | EN-80 `team-engine-approval` | после `reject` зависимые — `TASK_FAILED {dependency_closed}`; проект доходит до `PROJECT_DONE` при остальных `done` и сверке «прошла»; ядро: `PROJECT_DONE` без хотя бы одной `done` — `E_TRANSITION` |
| 2, 7 (C5) | EN-81 `team-engine` | `run-task` (CLI) по-прежнему отказывает задачам `review`/`waiting_user` (`E_TASK_STATE`), хеш |

Каждый тест закреплён за критерием; тестов без критерия нет (EN-04, EN-14, EN-26, EN-32, EN-43, EN-53, EN-64 — части
критериев 1, 2, 4, 5, 7, 9, 9 соответственно; C4 и C6 проверяются EN-55, EN-63, EN-64).

## 22. Мутанты (TEST-DESIGN-VALIDATOR применяет сам)

(r5.5, F4) Мутант «выход движка без последнего просмотра `inbox/`» **не эквивалентен** (запись r5.2 об эквивалентности
снята): его убивает EN-60 (exit) — сообщение, лежащее в `inbox/` в момент выхода, должно получить ack (исполнено или
отклонено) до снятия замка, а без разбора ack нет.

(r5.5) **Указания TEST-DESIGNER:** F2 — в EN-57 (3) добавить номер, **равный** `high` (поздний отправитель с номером `high`, не
только меньше): ack «устарел»; мутант «`<` вместо `≤`» (V04) падает детерминированно. F3 — в EN-57 (9ж) сбой `fsync` на
**втором** вызове (`nth: 2`): ни одной порции не записано (или, на исходном коде, все три одним пакетом); мутант «порции
отдельными записями» (V07) падает. F5 — для мутанта, который вместо падения даёт зависание (M25), тест запускает движок
отдельным процессом с собственным пределом времени (`spawnEngine` + `withLimit`), чтобы зависание давало красный тест, а не
ожидание общего таймаута.

(r5) Мутант «отправитель читает `taken/` раньше `inbox/`» удалён: в r4–r5 отправитель читает `inbox/` и `taken/high`, и при любом
порядке чтения худший исход — дубль «устарел», который движок отклоняет и отправитель переотправляет; итог не меняется, мутант
эквивалентен исходному. Прежний случай EN-57 (9а) «одно сообщение под двумя именами одного файла» в обычной работе r4–r5
возникнуть не может (взятие — переименование) и заменён достижимым случаем пробы F.

| Мутант | Убивает |
|---|---|
| `free = parallel + 1` | EN-10 |
| предпроверка `check` после `PROJECT_STARTED` (позже записи) | EN-13 (хеш и 0 обращений) |
| `validatePlan` без проверки цикла / без предела 40 / без каталога ролей | EN-02 |
| второй запрос без `detail` | EN-02 |
| `TASK_DONE` сразу после `TASK_REVIEW` (без запуска проверки) | EN-30 |
| проверка тем же `run_id` | EN-30 |
| `CYCLE_RUNS_MAX = 4` | EN-31 |
| `deps` из всех задач проекта | EN-25 |
| критическая задача → `TASK_DONE` без решения | EN-35 |
| `approve` на `failed` принят | EN-21 |
| без резерва (`reservedByOthers = 0`) | EN-43 |
| `budget` ≤ израсходованного не отказан командой | EN-41, EN-56 (текст `E_BUDGET_LOW`) |
| `ROUNDS_MAX = 3` | EN-46 |
| пауза не останавливает новые запуски | EN-50, EN-55 |
| `stop` без `abort` | EN-51 |
| движок пишет `ts` из `sent_at` | EN-57 |
| номер — время, а не «максимум + 1» | EN-57 (порядок строк = порядок номеров в 4 параллельных прогонах) |
| в имени сообщения pid или время (номер не исключителен) | EN-57 (1) |
| движок исполняет номер ≤ исполненного | EN-57 (3) (И24 / порядок) |
| проверка «одна жёсткая ссылка» у сообщения или ack | EN-57 (4) |
| взятие `renameSync(inbox/<имя>, taken/<имя>)` поверх существующего (замена) | EN-57 (5) |
| сравнение с наибольшим исполненным, а не с `high` | EN-57 (5) |
| движок исполняет сообщения во время остановки | EN-57 (6) |
| уборка считает по имени (`msg` в журнале), а не по `nonce` — скрытие дубля | EN-57 (9а) |
| события уборки одной порцией (без деления на 100) | EN-57 (9ж) (событие отвергнуто схемой, проект не открыть) |
| порции отдельными записями, не пакетом | EN-57 (9ж) (сбой посреди — часть порций, затем повторный счёт) |
| уборка не пишет ack невыполненным | EN-57 (9а), EN-61 |
| (r5.3) отправитель учитывает номера выше `high + NUMBER_JUMP_MAX` (своя копия правила вместо общей функции) | EN-57 (9к) |
| (r5.3) `stop` исполняется во время остановки по сигналу | EN-57 (9л) |
| (r5.5) уборка удаляет все `inbox/.tmp-*` (и живых отправителей) | EN-57 (9м) (файл исчез, вызовов записи два), EN-67 |
| (r5.5) отправитель не повторяет публикацию при `ENOENT` своего временного файла | EN-57 (9м), второй случай |
| `high` не обновлён до исполнения (пишется после события) | EN-57 (7) |
| уборка удаляет файлы до события | EN-57 (9д) (после падения между ними событие не пишется, N теряется) |
| уборка считает повторно (не смотрит `state.nonces`) | EN-57 (9г) (второе событие) |
| отправитель не читает `taken/high` | EN-57 (8), (5) (номера «устарел» до конца 10 с) |
| отклонённое сообщение не удаляется | EN-57 (8) (следующее взятие видит лишний `.taking`) |
| отправитель принимает негодный ack | EN-62 |
| публикация `renameSync` вместо `linkSync` (замена существующего) | EN-57 (20 разных номеров), EN-64 |
| сообщение берётся без переименования (чтение и удаление) | EN-57, EN-64 (И24 и счёт событий) |
| отправитель не смотрит `holder` (пишет в `inbox/` при чужом держателе) | EN-63 |
| отправитель не отзывает при таймауте | EN-58 |
| отправитель пишет сам после таймаута | EN-58, EN-60 |
| движок исполняет остатки после аварии | EN-61 |
| выход движка без последнего просмотра `inbox/` | EN-60 |
| `inbox/` без проверки владельца, ссылки, прав | EN-62 |
| `maskSecrets` в отправителе убран | EN-62 (приманка в `inbox/`) |
| проверка размера после записи | EN-62 (файла нет), счётчик обращений |
| `add-task` при живом движке без проверки `holder` | EN-64 |
| восстановленные задачи не перезапускаются | EN-65 |
| замок снимается при сломанном писателе | EN-68 |

## 23. Планка

| Пункт | Применим? | Как выполняется |
|---|---|---|
| Q1 | да | изменение привязано к REQ-013; у каждого критерия — тест или команда (п. 21) |
| Q2 | да | проект проверяет CODE-DESIGN-VALIDATOR; код — SECURITY-REVIEWER, REVIEWER; тесты — TEST-DESIGN-VALIDATOR |
| Q3 | да | факты п. 0 — своими запусками; поведение настоящего claude не утверждается (UAT, критерий 13) |
| Q4 | да | `cd tools && npm run check` — одна команда; новые тесты в `test/**/*.test.js` (EN-77) |
| Q5 | да | тест на каждый критерий; отказы — хеш журнала и 0 обращений (AP-048); тесты независимы (своя временная папка) |
| Q6 | да | `skip` нет; правка `cli.test.js` — только новый список команд в тексте, проверка не ослабляется |
| Q7 | да | значения окружения не пишутся; тексты маскируются до записи в `inbox/` (EN-62), журнал — ядром; план и ответы агентов — данные, не меняют полей проекта, роли, исполнителя, флагов, потолка (схемы п. 5.2, 8.1 без таких полей) |
| Q8 | да (принцип для проектов) | писатель, `inbox/`, `files/`, `work/` — только своего проекта; `project` сообщения = id; ответ на чужой id задачи — «не найдена»; EN-25, EN-38, EN-62 |
| Q9 | нет | SQL нет |
| Q10 | да | сбой исполнителя задачи → вопрос, движок и другие задачи живы; исключение не `TeamError` закрывает запуск; канал: таймаут, переполнение, мёртвый движок — понятный текст. **Остаточный риск:** движок взял сообщение и ack опоздал или движок умер — «не подтверждено», событие 0 или 1 раз, дубля нет (M3) |
| Q11 | нет для движка | у движка нет сетевых запросов (EN-39, EN-53); сеть Исследователя — REQ-010 |
| Q12 | да | `decisions/0020-team-engine-channel.md` (канал, поправка 0017 I3, граница тестов, C1/C2/C4/C6, резерв, «движок не выходит в ожидании») |
| Q13 | да | новых ошибок процесса этот шаг не нашёл; расхождения записаны в `result.issues` |
| Q14 | да | handoff заполняется в этом шаге; статус требования — не роль CODE-DESIGNER |
| R1 | да | мерж — только по подтверждению владельца; этот шаг ничего не коммитит |
| R2 | да | события ENGINE — в момент изменения, время писателя, одно событие на смену статуса, ничего задним числом (п. 16, EN-70…72); событие уборки — настоящее число невыполненных сообщений (по `nonce`, не по файлам); Pixel Office не затронут |
| R3 | нет | фото покупателей нет |

## 24. План раундов BACKEND-DEV

Каждый раунд — `npm run check` код 0; после любой правки конкурентности (раунды 4, 5) — тест гонки **в том же раунде** и
прогон файлов гонки в 4 параллельных процессах (четыре одновременных `node --test <файл>`), ожидания — по событию; ни одного
настоящего запуска Claude.

1. Ядро и исполнители: C1, C2 (после решения ORCH), C4, C6, C5 (`runner.js`), `home.js` (`inbox/`), `errors.js`. Тесты:
   EN-80, EN-81, И24 из EN-64; прежние TM/EX без изменений.
2. `plan.js`, `review.js`, `answers.js`, `facts.js`, `schedule.js` (чистые функции) + `single-run.js`. Тесты EN-04, модульные.
3. `engine.js` без канала (`start`/`resume` в процессе), команды без движка (`applyCommand`). Тесты EN-01…EN-47,
   EN-50…EN-52, EN-70…EN-72.
4. `channel.js`, маршрут в `cli.js`, M2. Тесты EN-53, EN-55…EN-64 (`team-channel.test.js`; гонки EN-57, EN-60 — в этом
   раунде).
5. Восстановление и один движок. Тесты EN-61, EN-65…EN-68 (гонка EN-67 — в этом раунде).
6. README, EN-75…EN-77. UAT (критерий 13) — только после письменного согласия владельца в сессии.

## 25. Запись решения

`decisions/0020-team-engine-channel.md` — поправка к решению 0017 (I3), канал, граница файлов тестов, правила движка и
предложения C1, C2 (статус — «предложено»; принимает ORCH; строку в `decisions/README.md` добавляет ORCH). Граница файлов
тестов (вместо `tools/test/engine-*.test.js` из задания — по именам критериев): `tools/test/team-planner.test.js`,
`tools/test/team-engine.test.js`, `tools/test/team-engine-*.test.js`, `tools/test/team-channel.test.js`,
`tools/test/team-engine-helpers.js`, новые тесты в `tools/test/team-recovery.test.js`, сценарии
`tools/test/fixtures/team/engine-*.json`.

## 26. Открытые вопросы (не решены догадкой)

**Решения ORCH (2026-10-06):** I-1 — C1 принят; I-2 — C2 принят; I-8 — C4 и C6 приняты (все четыре внесены в проект ядра,
`docs/design/REQ-009-team-core.md`, раздел 20 «Правки r13»; там же И25 — `dependency_closed` только из `waiting` с закрытой
зависимостью); I-10 — `linkSync`; I-3, I-7, I-11, I-12 — как предложено; I-4 — имена `team-*.test.js` по критериям (0020);
I-5 — обе формы `say`; I-6 — остаточный риск принят (п. 12.3, 23 Q10, 0020); I-9 — решение не нужно. Ниже — вопросы в
исходной формулировке.

- **I-1 (C1).** Критерии 3, 6 (`reject` → «не удалось», план продолжается) и 8 («выполнен» — все задачи «готово») с И6 ядра
  несовместимы: после любого `reject` проект не может стать «выполнен». Нужен выбор ORCH: C1 (правка ядра r13) или правка
  требования.
- **I-2 (C2).** «Другую роль выбирает Руководитель проекта» невозможно без правки И16 ядра (`purpose: reassign`). Выбор ORCH:
  C2 или правка требования (например, роль выбирает движок по таблице — тогда это меняет описание D-D).
- **I-3.** Для вопроса `review_failed` ответ `approve` («принять без проверки») запрещён И4 ядра; если REQ-017 захочет его —
  нужна правка ядра.
- **I-4.** Тестовые файлы: задание называет `tools/test/engine-*.test.js`, критерии 1, 2, 9, 10, 12 — `team-planner`,
  `team-engine`, `team-channel`, `team-recovery` и проверку по `team-*.test.js`. Проект следует критериям, граница — в 0020.
- **I-5.** Критерий 9 пишет `say <id> "…"`, ядро — `say <id> --text`. Проект принимает обе формы.
- **I-6.** `stop` через канал укладывается в 10 с только если группы процессов уходят за `KILL_GRACE_MS + GROUP_GONE_WAIT_MS`
  = 8 с; иначе — «не подтверждено» при записанном событии (M3, п. 13.6). Отдельного предела для `stop` нет (критерий 9: 10 с).
- **I-7.** Сбой запуска плана (не порок плана) в каталоге ядра нет причины `PLAN_REJECTED`; проект переходит сразу к вопросу
  `plan_failed` без второй попытки. Если нужна вторая попытка — правка каталога ядра (новая причина).
- **I-8.** C4 и C6 — правки ядра (поле `holder` в замке движка; поле `msg` и И24), без которых критерий 9 («видно из
  файла-замка», «событие несёт имя файла сообщения») невыполним; нужна правка проекта ядра r13 вместе с C1/C2.
- **I-9.** Задание ссылается на AP-051 — такой записи в `docs/anti-patterns.md` нет (F9).
- **I-10.** Критерий 9 и критерий 2 REQ-009 говорят «переименовывает (rename)» и «существующий файл не заменяется»;
  `rename` заменяет существующий (F14). Проект публикует сообщение `linkSync` временного файла той же папки (атомарно, без
  замены, как замок ядра) и удаляет временный; если ORCH требует буквально `renameSync`, «не заменяется» обеспечивает только
  уникальность номера (п. 13.6, шаг 5).
- **I-11.** «resume проекта, который не на паузе, — отказ «проект уже выполняется»»: проект прочитан так, что отказ — для
  `planning`/`running`; `resume` из «ждёт решения пользователя» разрешён (критерий 7: `budget`, затем `resume`).
- **I-12.** «Одно событие ENGINE с их числом» об остатках аварии — `CHAT {source:ENGINE, kind:"message"}` с постоянным
  текстом и числом, без нового типа события. Если нужен отдельный тип — правка каталога ядра.

## 27. Формулировки для требований (r4; правку вносит REQ-ANALYST через WF-01)

1. **REQ-013, критерий 9, п. (2)** — вместо «пишет сообщение во временный файл в папке inbox/ папки проекта и атомарно
   переименовывает его (rename) в имя из монотонного номера, времени и pid отправителя; существующий файл не заменяется»:
   «пишет сообщение во временный файл в папке inbox/ папки проекта и публикует его атомарно и без замены существующего
   (жёсткая ссылка linkSync на имя m-<номер>.json, затем временный файл удаляется); номер на единицу больше наибольшего из
   номеров сообщений в inbox/ и числа в файле движка inbox/taken/high (нет файла — 0); занятый номер — следующий номер;
   время отправки и pid отправителя — в теле сообщения».
2. **REQ-013, критерий 9, п. (2)** — вместо «Папку inbox/ и её подпапки создаёт движок с правами 0700, файлы сообщений и
   подтверждений — 0600»: «Папку inbox/ и её подпапки (taken/, ack/) создаёт движок с правами 0700; файлы сообщений,
   подтверждений (ack) и файл движка inbox/taken/high с наибольшим взятым номером — 0600; high пишет только движок —
   временным файлом и переименованием, до исполнения взятого сообщения».
3. **REQ-013, критерий 9, п. (3)** — после «исполняет сообщения по возрастанию номера» добавить: «сообщение с номером не больше
   числа в inbox/taken/high не исполняется: движок отвечает ack «номер устарел», команда публикует его заново со свежим
   номером в пределах тех же 10 с; обработанное сообщение движок удаляет — исполненное после события, отклонённое после ack;
   после начала остановки (stop) новые сообщения не исполняются — ack «проект останавливается»».
4. **REQ-013, критерий 9, п. (5)** — вместо «Сообщения, оставшиеся в inbox/ после аварийной остановки движка, при следующем
   resume не исполняются: движок удаляет их и пишет одно событие ENGINE с их числом, без текста» (r5): «Сообщения, найденные при
   уборке inbox/ на старте движка (остатки аварии и опубликованные до готовности движка), не исполняются; сообщение — это
   файл, а опознаётся оно по идентификатору (nonce) из тела, а не по имени файла; уже исполненное (его nonce есть в журнале)
   только удаляется; движок поднимает inbox/taken/high не ниже их номеров, затем пишет события ENGINE с их числом и
   идентификаторами (без текста) — по 100 сообщений в событии, все события одной записью; ждущему отправителю отвечает ack
   «не выполнено»; затем удаляет файлы; повторная уборка после падения не считает их второй раз; уборка не ограничена числом
   файлов».
5. **REQ-009, критерий 2** — вместо «создание временным файлом той же папки и rename»: «создание временным файлом той же
   папки и публикация без замены существующего (linkSync)»; перечень файлов канала: «сообщение, подтверждение ack и файл
   движка inbox/taken/high (наибольший взятый номер; временный файл и rename)»; события сообщений канала несут имя файла и
   идентификатор сообщения (nonce), событие уборки — идентификаторы невыполненных сообщений; взятие сообщения движком — переименованием в
   служебное имя taken/.taking-…».
6. **REQ-013, описание** — вместо «Завершение: проект «выполнен» только когда все задачи «готово» и итоговая проверка цели …
   прошла»: «Завершение: проект «выполнен» только когда каждая задача «готово» или закрыта пользователем (отклонена, или
   зависела от отклонённой), хотя бы одна задача «готово» и итоговая проверка цели (Проверяющий сверяет результаты с целью)
   прошла».

## 28. Правки r5.2 по построенному коду (перечень; схемы и формы не менялись)

| Что | Где в проекте | Источник |
|---|---|---|
| `claude-cli.js` изменён: `summary`/`files` из ответа, только если есть | п. 1.2 | step-23, решение ORCH 1 |
| причина отмены — `signal.reason`; имена файлов результата по `task.attempts` | п. 2.2 | F-10; step-22 |
| `Engine.command`, `Engine.facts` — внутренние точки входа; общий `receive()` для `command` и канала | п. 4.1 | F-2 |
| (б) `resume` после аварии без паузы — без `PROJECT_RESUMED`, с заметкой; `planning` продолжается тем же раундом и попыткой | п. 4.2, шаг 8 | step-22 (б) |
| дополнительные поля `facts`; `closedSincePlan` сбрасывается на `PLAN_RECEIVED` | п. 4.5 | step-22 |
| (в) вопросы задач пишутся сразу; `PROJECT_WAITING` только в `running`/`planning`; на паузе не пишутся | п. 6.1, шаг 2 | step-22 (в), ревью |
| (д) `planNote` содержит перечень ролей каталога и формат ответа плана; входы проверки, сверки и выбора роли — постоянные указания формата ответа | п. 7.2 (дополнение этой строкой) | step-22 (д) |
| (е) `QUESTION.plan_failed` и `goal_check_failed` при сбое запуска — со вставкой `FAIL_DETAIL` | п. 5.4, 11.5, 15.4 (дополнение этой строкой) | step-22 (е) |
| (ж) `runSingle` сохраняет вход scripted (`record_input`) файлом без задачи `r-NNNNN-<имя>` (нужно EN-02, EN-21, EN-26) | п. 19, `single-run.js` (дополнение этой строкой) | step-22 (ж) |
| F-8: `checkDecision` с `facts`; ответ на задачу, упавшую только по потолку, — `E_NOT_WAITING` | п. 9.2, 17 | ревью F-8 (правит BACKEND-DEV) |
| F-1: `goal` не запускает план; пауза отменяет любой запуск плана | п. 12.1 | ревью F-1 |
| F-5: дубль при идущей остановке не заменяет файл `stop` | п. 13.5, шаг 2 | ревью F-5 |
| F-4, F-6: `.bad-<rand>`, `chmodSync`, `NUMBER_MAX`, `NUMBER_JUMP_MAX` | п. 13.7 (константы — и здесь, п. 3 не переписывался) | ревью F-4, F-6 |
| F-7: `E_NOT_STARTED` для `resume` из `created` | п. 15.3, 17 | ревью F-7 (правит BACKEND-DEV) |
| пустой текст через канал — `E_EVENT` | п. 17 | step-23 |
| F-3: как проверяется EN-76 | п. 21 | ревью F-3 |
| мутант EN-60 не эквивалентен — убивается EN-60 (exit) (r5.5, F4; запись r5.2 снята) | п. 22 | step-35 F4 |
| F-9: фраза «Источник образцов `stream-json`» — дописать, что `structured_output` содержит и поля схем ответов движка REQ-013 (`PLAN_/REVIEW_/GOAL_/REASSIGN_ANSWER_SCHEMA`) | файл `tools/test/fixtures/team/README.md`, раздел «## Источник образцов `stream-json`», абзац под заголовком | ревью F-9 (правит BACKEND-DEV) |

| (r5.3) R-3: комментарий у `applyCommand` называет все шесть видов, включая `answer` | `engine/commands.js` | ревью R-3 (требование к коду) |
| (r5.3) R-4: `deliver` без движка читает журнал (`scanFacts`) только для `resume` и `answer`; поведение не меняется | `engine/channel.js` | ревью R-4 (требование к коду) |
| (r5.3) R-5: перечень причин отмены (`stop`, `cancel`) и выбор `cancelCauseOf(signal)` — в одном месте (`runner.js`), `single-run.js` импортирует | `runner.js`, `engine/single-run.js` | ревью R-5 (требование к коду) |
| (r5.3) Info: отсутствующие `facts` (`null` и `undefined`) обрабатываются одинаково во всех командах — как «фактов нет», без особых веток | `engine/commands.js`, `engine/answers.js` | ревью, Info |
| (r5.3) R-1, правило номера отправителя (`nextNumber`, общая с движком) | п. 12.3, 12.4, 13.5, 13.6 | ревью R-1, R-7, безопасность step-30 |

| (r5.4) Выбор (г) step-22 **принят ORCH**: повторы запуска проверки и сверки цели (`SINGLE_RUNS_MAX`) идут без паузы, повторы `runTask` — с паузой `SAI_TEAM_RETRY_DELAY_MS`, как реализовано | п. 8.2, шаг 6; п. 11, шаг 5 | решение ORCH (r5.4) |
| (r5.4) R3-2: в `receive()` (`engine.js`) проверка `stop.reason === "stop"` срабатывает только при разборе очереди перед выходом (`draining = true`): до разбора все сообщения отклоняет предыдущая проверка «остановка идёт и разбора ещё нет»; при разборе после `stop` отклоняется всё, а после сигнала (`reason = cancel`) разбор идёт по п. 13.8 | `engine/engine.js`, комментарий у проверки | ревью R3-2 (требование к комментарию) |
