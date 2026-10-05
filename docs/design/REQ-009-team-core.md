# REQ-009 — проект кода: ядро Sai Team (журнал, состояние, хранение, писатель, восстановление, чтение, роли, язык)

WF-02, шаг 1 (CODE-DESIGNER), прогон `PROD-20261006-01`. Редакция **r1** — доработка по FAIL ворот
(`handoffs/PROD-20261006-01/step-04b-code-design-validator.json`, замечания F1–F16) и решениям ORCH в
`handoffs/PROD-20261006-01/step-04-code-designer-r1.json`; первая редакция (r0) —
`handoffs/PROD-20261006-01/step-04-code-designer.json`. Требование — блок REQ-009 в `docs/requirements.yaml` (15
критериев). Решение — `decisions/0015-product-virtual-team-start.md` (D-A…D-F). Следующие требования, ради которых здесь
одним местом зафиксированы схема события, каталог типов, редьюсер, раскладка папки проекта и язык: REQ-010
(исполнители), REQ-013 (движок), зарезервированные REQ-011 (бизнес-интерфейс) и REQ-012 (Pixel Office как зеркало).

Кода реализации здесь нет: только формы данных, сигнатуры, правила и таблицы. Все примеры — вымышленные.

Что изменено в r1 (номер замечания у каждой правки): F1 — п. 6.4 (сбой записи всегда ломает писателя), TM-13, TM-14;
F2 — п. 4.1, 6.5 (потолок ≥ 0, 0 = нет потолка), TM-60; F3 — И12, TM-53; F4 — п. 4.1 (`PROJECT_RECOVERED`), 5.2 (И13,
И14), 6.3 (шаг 8), TM-54; F5 — п. 5.3 (таблица «тип → поля»), И15–И18, TM-55; F6 — п. 6.2 (шаг 4, проверка замка в
`append`, `E_LOCK_LOST`), TM-56, P1; F7 — п. 10.4, 12, TM-45, TM-47 (API ядра, без процесса-помощника); F8 — п. 3.4,
6.4 (`RESULT_FILE` только через ядро), P7; F9 — п. 2.1 (`work/`), 6.7 (`importWorkFile`), TM-03, TM-57; F10 — п. 6.6
(имя по шаблону, без маскирования), TM-58, P8; F11 — п. 6.3 (права после замка и проверки журнала), TM-61; F12 — ссылки
на тесты в п. 4, 8, 9; F13 — п. 6.4, 10.3, 12 (тексты `E_DISK`); F14 — п. 17, 19 (I3: `E_PROJECT_BUSY`); F15 — п. 6.5;
F16 — п. 19 (P10). Сценарий scripted — п. 4.1 (`scenario_file`), 6.5, TM-59 (решение ORCH по вопросу ворот).

## 0. Проверенные факты (до проекта, своими запусками)

Каждый запуск Node — с ограничением по времени (`perl -e 'alarm 20; exec @ARGV' …`: на macOS нет `timeout`), Node 22.21.1.

| # | Утверждение | Как проверено | Результат |
|---|---|---|---|
| F1 | Условия критерия 1 до WF-02 выполнены | `grep -n 'ДОВЕСТИ ПРОДУКТ ДО РАБОЧЕГО СОСТОЯНИЯ' STATE.md`; `ls decisions/0015-*.md`; `grep -n '0015' decisions/README.md`; `grep -c` по 0015 на `tools/src/team`, `Node 22`, `npm run check`, `D-A`, `SAI_TEAM_WEB`, `остаточн`; `grep -c 'виртуальная команда' CLAUDE.md`; `grep -c 'кода продукта нет' CLAUDE.md` | строка 247 STATE.md (2026-10-06); один файл 0015; строка 23 README «Принято (ORCH, по слову владельца…)»; счётчики 4, 2, 1, 3, 1, 1; CLAUDE.md — 1 и 0 |
| F2 | Папки `tools/src/team/` нет, свободен префикс тестов `TM-` | `ls tools/src/team`; `grep -rhoE '"TM-[0-9]+' tools/test/ \| wc -l` | «No such file or directory»; 0 — номера TM-01… свободны |
| F3 | `maskSecrets` — чистая функция `(text) → string`, метка `[скрыто]`, `prepareText(raw, scanMax, limit) → {text, truncated}` | чтение `tools/src/pixel-office/mask.js` и запуск на образцах | `sk-ant-…`, `ghp_…`, `AKIA…`, JWT → `[скрыто]`; `password=…` → `password=[скрыто]`; русский текст не меняется |
| F4 | Маскирование портит служебные значения и обычные имена файлов | `maskSecrets` на sha256, `p-20261006-a1b2c3`, `r-00001`, `v1.2.3`; r1: на `plan.v2.md`, `report.2026.md`, `report_v2.md`, `notes-final.md`, `scenario.json` | sha256 → `[скрыто]` (M10), `v1.2.3` → `[скрыто]` (M7); `plan.v2.md` и `report.2026.md` → `[скрыто]` (M7); `report_v2.md`, `notes-final.md`, `scenario.json`, id `p-…`, `r-…` не меняются. Поэтому маскируются только поля вида `text` (п. 3.4); имена файлов, коды, id, хеши проверяются шаблоном и не маскируются |
| F5 | `tools/test/fault-inject.js` перехватывает только `writeFileSync, renameSync, linkSync, unlinkSync, chmodSync, mkdirSync, rmSync, lstatSync` по точному пути | чтение файла | `writeSync`, `fsyncSync`, `ftruncateSync`, `openSync` не перехватываются — расширение п. 15.3 (I1 принят ORCH: TEST-DESIGNER) |
| F6 | Проверка жизни процесса | `process.kill(999999, 0)`; `process.kill(1, 0)` | `ESRCH`; `EPERM` — различимы |
| F7 | `linkSync` на существующее имя и `renameSync` папки на непустую | запуск во временной папке `<вне проекта>` | `EEXIST`; `ENOTEMPTY` (на пустую папку `rename` проходит и заменяет её — п. 6.5) |
| F8 | В `tools/package.json` нет `dependencies`; тесты — `node --test "test/**/*.test.js"` | `grep -c '"dependencies"' tools/package.json` | 0; `tools/test/team-*.test.js` попадут в прогон без правки шаблона |
| F9 | Образец добавления строки в журнал есть в Pixel Office | `tools/src/pixel-office/journal.js` (строки 36–98), `tools/src/util.js` (299–301) | `openSync(O_RDWR\|O_APPEND\|O_CREAT\|O_NOFOLLOW, 0o600)` + цикл `writeSync`; `writeFileSync(…, {flag:"wx", flush:true})` с данными-`Buffer` (со строкой и `encoding` Node 22.21.1 не вызывает fsync). Ядро опирается на приёмы, но импортирует из `tools/src/pixel-office/` только `mask.js` |
| F10 | Команды создания проекта и записи результата в REQ-009 нет | блоки REQ-009 и REQ-010 | REQ-009 даёт `projects`, `project`, `events`, `say`; `new`, `run-task` — REQ-010. Решение ORCH: EACCES/EIO критерия 13 проверяются на уровне API ядра (п. 10.4) |

## 1. Состав изменений и кто что пишет

| Файл (от корня Sai) | Что | Кто |
|---|---|---|
| `tools/src/team/errors.js` | класс ошибки ядра, коды, коды выхода, перевод ошибок ОС | BACKEND-DEV |
| `tools/src/team/schema.js` | единая схема события, каталог типов (п. 4), статусы, пределы, шаблоны, проверка формы | BACKEND-DEV |
| `tools/src/team/roles.js` | каталог десяти ролей (п. 8) | BACKEND-DEV |
| `tools/src/team/reducer.js` | состояние из событий, переходы, инварианты, прогресс (п. 5) | BACKEND-DEV |
| `tools/src/team/language.js` | событие → фраза (п. 9) | BACKEND-DEV |
| `tools/src/team/view.js` | формы вывода (п. 10.2) — без внутренних полей | BACKEND-DEV |
| `tools/src/team/home.js` | каталог данных, права, путь к проекту по id | BACKEND-DEV |
| `tools/src/team/journal.js` | чтение журнала, добавление строки с fsync, усечение | BACKEND-DEV |
| `tools/src/team/lock.js` | замок писателя | BACKEND-DEV |
| `tools/src/team/files.js` | файлы результатов, чтение файла из `work/` | BACKEND-DEV |
| `tools/src/team/store.js` | API ядра: создание, писатель, чтение | BACKEND-DEV |
| `tools/src/team/cli.js` | команды `projects`, `project`, `events`, `say`; обёртка `runGuarded` | BACKEND-DEV |
| `tools/package.json` | только скрипт `"team": "node src/team/cli.js"` | BACKEND-DEV |
| `tools/README.md` | раздел «## Sai Team — ядро» (п. 14) | BACKEND-DEV |
| `tools/test/team-*.test.js`, `tools/test/team-helpers.js` | тесты TM-01…TM-61 (п. 15) и помощник тестов | TEST-DESIGNER |
| `tools/test/fault-inject.js` | расширение (п. 15.3), обратно совместимое | TEST-DESIGNER (решение ORCH по I1) |

Не меняются: `tools/src/pixel-office/**` (только `import` из `mask.js`), `~/.sai-pixel-office`, `.claude/agents/`.
Все файлы `tools/src/team/` пишет один разработчик; двое один файл не пишут.

Модули `schema.js`, `roles.js`, `reducer.js`, `language.js`, `view.js` — чистые ES-модули **без Node API**: их без
переделки сможет импортировать страница REQ-011/REQ-012. Node API — только в `errors.js`, `home.js`, `journal.js`,
`lock.js`, `files.js`, `store.js`, `cli.js`. Все вызовы `fs` — через объект по умолчанию (`import fs from "node:fs"`,
`fs.writeSync(…)`), без деструктуризации: иначе их не перехватят ни `fault-inject.js`, ни `mock.method(fs, …)` в тестах.

## 2. Хранение

### 2.1. Где

| Путь | Что | Права |
|---|---|---|
| `<HOME>` | каталог данных: `SAI_TEAM_HOME`, если задана (только абсолютный путь), иначе `<домашняя папка>/.sai-team` | 0700 |
| `<HOME>/<project-id>/` | папка проекта | 0700 |
| `<HOME>/<project-id>/events.jsonl` | журнал — единственный источник правды | 0600 |
| `<HOME>/<project-id>/scenario.json` | копия сценария scripted (есть, только если `scenario_file` не `null`; п. 6.5) | 0600 |
| `<HOME>/<project-id>/files/` | файлы результатов (пишет только ядро) | 0700 |
| `<HOME>/<project-id>/files/<имя>` | файл результата | 0600 |
| `<HOME>/<project-id>/work/` | рабочая папка исполнителя (cwd процесса агента, REQ-010); ядро её создаёт и только читает (п. 6.7) | 0700 |
| `<HOME>/<project-id>/writer.lock` | замок писателя (есть, пока право записи взято) | 0600 |
| `<HOME>/<project-id>/writer.lock.<pid>.new` | временный файл замка (остаток аварии убирает следующий писатель) | 0600 |
| `<HOME>/<project-id>/writer.lock.stale-<pid>` | устаревший замок в момент снятия (п. 6.2) | 0600 |
| `<HOME>/<project-id>/files/.partial-<имя>` | файл результата до публикации (п. 6.6) | 0600 |
| `<HOME>/.creating-<id>/` | проект в момент создания (п. 6.5) | 0700 |

`work/` — единственная папка, куда пишет исполнитель. `events.jsonl`, `writer.lock`, `scenario.json`, `files/` лежат
**вне** `work/`: инструменты ролей (REQ-010) работают только внутри `work/` и не достают до журнала и замка. Файл из
`work/` становится файлом результата только через ядро (`writer.importWorkFile`, п. 6.7: маскирование, 0600, событие
`RESULT_FILE`). Содержимое `work/` ядро не маскирует и не меняет: это черновики агента внутри папки 0700 (остаточный
риск — в README и P9). Контекст проекта (память, результаты зависимостей) движок передаёт агенту в подсказке, а не
доступом к журналу (REQ-010/013).

Производного файла состояния **нет**: состояние собирается воспроизведением `events.jsonl` (P2). Удаление проекта —
вручную, папкой `<HOME>/<project-id>/` (команды удаления нет).

### 2.2. Правила каталога

- `SAI_TEAM_HOME` задана, но не абсолютный путь или пуста → `E_HOME`. Домашняя папка не находится → `E_HOME`.
- `<HOME>`, папка проекта, `files/`, `work/`: обычная папка (не ссылка, `lstat`), владелец — текущий пользователь, иначе
  `E_HOME` (для `<HOME>`) или «проект не найден» (для папки проекта; п. 7.1).
- Права шире ожидаемых (0700 папки, 0600 файлы ядра — `events.jsonl`, `scenario.json`, `writer.lock`, файлы `files/`):
  - **писатель** сужает их `chmod` — только **после** взятия замка и проверки журнала (п. 6.3, шаг 6; F11) — и кладёт в
    `writer.notices` строку «Права … сужены до 0700/0600»; не удалось сузить → отдать замок, `E_HOME`/`E_DISK`, ничего
    не записано. Содержимое `work/` (файлы агента) писатель не трогает, только саму папку `work/`;
  - **чтение** ничего не меняет и кладёт в вывод `warnings: ["Права папки данных шире 0700: …"]` и ту же строку в stderr.
- `<HOME>` нет: `createProject` создаёт (`mkdir` с `recursive`, 0700); `openWriter` и чтение не создают — `projects` даёт
  пустой список, `project`/`events`/`say` — «проект не найден».
- `<HOME>` с широкими правами при `createProject` сужается до создания проекта (замка ещё нет: проекта ещё нет).

## 3. Единая схема события

### 3.1. Строка журнала

Каждая строка `events.jsonl` — один JSON-объект в UTF-8 и `\n` в конце. Ключи ровно эти, в этом порядке:

| Поле | Тип | Правило |
|---|---|---|
| `seq` | целое ≥ 1 | номер события в проекте; строка №k файла имеет `seq = k` |
| `ts` | строка | время с часов, ISO 8601 UTC с миллисекундами ровно в форме `Date#toISOString()` |
| `project` | строка | id проекта `^p-[0-9]{8}-[0-9a-f]{6}$`; равен имени папки |
| `task` | строка или `null` | id задачи `^t-[0-9]{4}$` или `null`; обязателен/запрещён/необязателен — по типу (п. 4) |
| `source` | строка | `ENGINE`, `AGENT` или `USER`; допустимые для типа — п. 4 |
| `type` | строка | тип из каталога п. 4 |
| `data` | объект | поля по типу (п. 4); лишнее поле — отказ |

Вымышленный пример строки: `{"seq":7,"ts":"2026-10-06T09:15:00.123Z","project":"p-20261006-a1b2c3","task":null,"source":"USER","type":"CHAT","data":{"text":"Добавьте сравнение цен","kind":"message","truncated":false}}`.

### 3.2. Время (критерий 3, R2)

- `ENGINE`: `ts` ставит писатель **сам** по своим часам (`now()`), поле `ts` во входе запрещено (`E_EVENT`). Отказ, если
  `ts` раньше `ts` предыдущей строки хотя бы на 1 мс (равное — можно).
- `USER`, `AGENT`: `ts` из входа или, если не дано, `now()`. Отказ, если раньше предыдущего больше чем на 2000 мс (ровно
  2000 — можно), и отказ, если позже `now()` писателя.
- При воспроизведении правила «не раньше предыдущего» проверяются снова; «не позже `now()`» — только при записи.
- Часы ушли назад так, что событие ENGINE раньше предыдущего, — `E_TIME` «Часы компьютера показывают время раньше
  последней записи проекта» (ничего не пишется).
- `now` подменяется только параметром `openWriter`/`createProject` (тесты); другого источника времени нет.

### 3.3. Пределы (константы `LIMITS` в `schema.js`)

| Константа | Значение | Что |
|---|---|---|
| `GOAL_MAX` | 2000 | кодовых точек в цели |
| `TEXT_MAX` | 4000 | текст CHAT, задачи, памяти, замечаний, решения пользователя |
| `DONE_WHEN_MAX` | 2000 | критерий готовности |
| `SUMMARY_MAX` | 2000 | краткий итог запуска |
| `DETAIL_MAX` | 500 | причина, пояснение |
| `FILE_NAME_MAX` | 80 | знаков в имени файла результата (F10) |
| `WORK_PATH_MAX` | 255 | знаков в пути внутри `work/`; не больше 8 частей |
| `FILE_BYTES_MAX` | 5 MiB | файл результата (и исходный файл в `work/`) |
| `SCENARIO_BYTES_MAX` | 1 MiB | файл сценария scripted |
| `LINE_BYTES_MAX` | 1 MiB | строка журнала в байтах вместе с `\n` |
| `PLAN_TASKS_MAX` | 40 | задач в одном плане (D-C) |
| `PROJECT_TASKS_MAX` | 200 | задач в проекте всего |
| `RUN_FILES_MAX` | 50 | имён в `RUN_FINISHED.files` |
| `PAGE_DEFAULT` / `PAGE_MAX` | 50 / 200 | `events --limit` |
| `TIME_SKEW_MS` | 2000 | допуск USER/AGENT |
| `BUDGET_MAX` | 100000 | долларов в потолке |

Длина текста считается в кодовых точках **после** маскирования; пустая строка или только пробелы там, где текст
обязателен, — отказ.

### 3.4. Виды полей `data` и маскирование (критерий 12, Q7)

| Вид | Значение | Маскируется | Проверка |
|---|---|---|---|
| `text` | строка | да, `maskSecrets` | длина по пределу после маскирования |
| `name` | имя файла результата | **нет** (F10: маскирование портит обычные имена вида `plan.v2.md`) | шаблон `NAME_PATTERN` (п. 6.6) |
| `code` | значение из перечня | нет | входит в перечень |
| `id` | `t-NNNN`, `r-NNNNN` | нет | шаблон |
| `hash` | sha256, 64 шестнадцатеричных знака | **нет** (F4: маскирование превращает хеш в `[скрыто]`, M10) | `^[0-9a-f]{64}$`; значение считает само ядро (п. 6.6) |
| `int`, `money`, `bool` | числа, логическое | нет | диапазон; `money` — конечное число ≥ 0, не больше 6 знаков после точки |
| `list<…>` | массив | по виду элемента | длина массива |

Порядок в одной операции добавления (п. 6.4): проверка формы → маскирование полей `text` → проверка пределов и шаблонов
→ редьюсер → запись. Конверт не маскируется: его значения строго по шаблонам. Функция маскирования одна — `maskSecrets`
из `tools/src/pixel-office/mask.js` (импорт в `store.js`, не копия). Отступления от «все строки данных маскируются»
(0015, описание REQ-009) — только виды `name` и `hash`; они вынесены в предложение записи (P7, P8).

## 4. Каталог типов событий

Каталог фиксируется здесь целиком: ядро REQ-009 **принимает, проверяет, воспроизводит и переводит в фразу каждый тип**,
хотя само пишет только отмеченные «009». Остальные типы пишут REQ-010 и REQ-013 через тот же `writer.append` — новых мест
записи журнала у них нет. Типы с пометкой «только ядро» `writer.append` отклоняет (`E_EVENT` «Тип … пишет только
ядро»): их пишут внутренние пути `createProject`, `openWriter`, `writeResultFile`/`importWorkFile` (F8, F4). Новый тип в
будущем — только правкой этого проекта; тест TM-38 перечисляет типы из схемы и сам потребует фразу и фикстуру (F12).

Обозначения: «Задача» — поле `task`: `обяз.` / `нет` (`null`) / `можно`. Статус: проекта (П) или задачи (З). Действие на
поля состояния и условия — п. 5.3. Кто пишет: 009 — ядро; 010 — исполнители; 013 — движок. Всего типов — **36** (35 из
r0 и `PROJECT_RECOVERED`, F4).

### 4.1. Проект

| Тип | Источник | Задача | `data` (поле: вид) | Статус | Кто |
|---|---|---|---|---|---|
| `PROJECT_CREATED` | ENGINE | нет | `goal: text≤GOAL_MAX`, `budget_usd: money 0..BUDGET_MAX` (0 — «потолка нет», F2), `executor: code ∈ EXECUTORS`, `scenario_file: code ∈ {"scenario.json"} или null` (не `null` — только при `executor = scripted`) | П → `created`; только `seq = 1` | 009, только ядро (`createProject`) |
| `PROJECT_STARTED` | USER | нет | `parallel: int 1..3` | П `created` → `running` | 013 |
| `PLANNING_STARTED` | ENGINE | нет | `round: int 0..2`, `attempt: int 1..2` | П `created`, `running` → `planning` | 013 |
| `PLAN_REJECTED` | ENGINE | нет | `round`, `attempt`, `reason: code ∈ {schema, cycle, too_many, unknown_role, bad_dependency}`, `detail: text≤DETAIL_MAX` | — (П `planning`) | 013 |
| `PLAN_RECEIVED` | ENGINE | нет | `round`, `tasks: list≤40 of {id: id, role: code, text: text≤TEXT_MAX, done_when: text≤DONE_WHEN_MAX, depends_on: list<id>, critical: bool}` | П `planning` → `running`; все задачи плана **одной строкой** | 013 |
| `PROJECT_WAITING` | ENGINE | можно | `reason: code ∈ {plan_failed, budget, task_failed, review_failed, approval, goal_check_failed}` | П `planning`, `running` → `waiting_user` | 013 |
| `PROJECT_PAUSED` | USER | нет | `{}` | П `planning`, `running`, `waiting_user` → `paused` | 013 |
| `PROJECT_RESUMED` | USER, ENGINE | нет | `parallel: int 1..3 или null`, `after: code ∈ {command, decision, budget, recovery}` | П `paused`, `waiting_user` → `running`; П `running`, `planning` → `running` **только при `recovered = true`** и с `after: recovery` (И13, F4) | 013 |
| `PROJECT_RECOVERED` | ENGINE | нет | `from_status: code ∈ {planning, running}`, `closed_runs: int ≥0`, `interrupted_tasks: int ≥0` | — (статус прежний), `recovered = true` (И13) | 009, только ядро (`openWriter`, восстановление) |
| `PROJECT_STOPPED` | USER | нет | `{}` | П любой неконечный → `stopped` | 013 |
| `PROJECT_DONE` | ENGINE | нет | `{}` | П `running` → `done`; И6 | 013 |
| `PROJECT_FAILED` | ENGINE | нет | `reason: code ∈ {user_rejected, unrecoverable}`, `detail: text≤DETAIL_MAX` | П любой неконечный → `failed` | 013 |
| `GOAL_CHECK_STARTED` | ENGINE | нет | `round: int 0..2`, `run_id: id` (открытый запуск `goal_check`) | — | 013 |
| `GOAL_CHECK_RESULT` | ENGINE | нет | `round`, `run_id`, `passed: bool`, `notes: text≤TEXT_MAX` | — | 013 |
| `BUDGET_SPENT` | ENGINE | можно | `run_id: id`, `cost_usd: money`, `accounted: code ∈ {reported, assumed}`, `total_usd: money` | — | 010 |
| `BUDGET_SET` | USER | нет | `budget_usd: money >0 ≤BUDGET_MAX` (и > `spent_usd`) | — | 013 |
| `CHAT` | USER, ENGINE | можно | `text: text≤TEXT_MAX`, `kind: code ∈ {message, question}` (`question` — только ENGINE), `truncated: bool` | — | 009 (`say`); 013 |
| `MEMORY_ADDED` | ENGINE, AGENT, USER | можно | `kind: code ∈ {fact, decision, note}`, `text: text≤TEXT_MAX` | — | 009 (API), 010/013 |
| `RESULT_FILE` | ENGINE | можно | `name: name`, `bytes: int 0..FILE_BYTES_MAX`, `sha256: hash`, `kind: code ∈ {result, draft}`, `from_work: bool` | — | 009, только ядро (`writeResultFile`, `importWorkFile`) |
| `LOCK_STALE_REMOVED` | ENGINE | нет | `pid: int ≥1` | — | 009 (`openWriter`) |
| `JOURNAL_RECOVERED` | ENGINE | нет | `line: int ≥2`, `dropped_bytes: int ≥1` | — | 009 (`openWriter`) |

### 4.2. Задача и запуск

| Тип | Источник | Задача | `data` | Статус | Кто |
|---|---|---|---|---|---|
| `TASK_CREATED` | ENGINE, USER | обяз. (следующий `t-NNNN`) | `role: code ∈ ROLES`, `text: text≤TEXT_MAX`, `done_when: text≤DONE_WHEN_MAX`, `depends_on: list<id>≤40`, `critical: bool` | З → `waiting` | 009 (API), 010, 013 |
| `TASK_STARTED` | ENGINE | обяз. | `{}` | З `waiting`, `interrupted`, `failed`, `review`, `waiting_user` → `running`; И3 | 010, 013 |
| `RUN_STARTED` | ENGINE | обяз. для `work`, `review`; нет для `plan`, `goal_check` | `run_id: id` (следующий `r-NNNNN`), `purpose: code ∈ {work, review, plan, goal_check}`, `role: code ∈ ROLES`, `executor: code ∈ EXECUTORS`, `max_budget_usd: money или null` | — (И7, И12, И16) | 010 |
| `AGENT_ACTIVITY` | AGENT | как у его `RUN_STARTED` | `run_id: id` (открытый), `activity: code ∈ {reading, searching, writing, thinking, other}`, `executor: code ∈ EXECUTORS`, `text: text≤SUMMARY_MAX или null` | — (И12) | 010 |
| `RUN_FINISHED` | ENGINE | как у его `RUN_STARTED` | `run_id`, `outcome: code ∈ {ok, failed, timeout, cancelled, interrupted, invalid_output, not_found, network}`, `summary: text≤SUMMARY_MAX или null`, `cost_usd: money или null`, `files: list<name>≤RUN_FILES_MAX` | — (запуск закрыт; И15) | 010; 009 (восстановление, `interrupted`) |
| `RUN_REFUSED` | ENGINE | обяз. | `reason: code ∈ {budget_exhausted}`, `detail: text≤DETAIL_MAX` | — (И18) | 010 |
| `TASK_RETRY` | ENGINE | обяз. | `next_attempt: int ≥2`, `delay_ms: int ≥0`, `reason: code ∈ {failed, timeout, invalid_output, network}` | — (З `running`) | 010 |
| `TASK_REVIEW` | ENGINE | обяз. | `{}` | З `running` → `review` | 013 |
| `REVIEW_RESULT` | ENGINE | обяз. | `run_id` (запуск `review` этой задачи), `passed: bool`, `notes: text≤TEXT_MAX` | — (З `review`) | 013 |
| `TASK_REASSIGNED` | ENGINE | обяз. | `from_role: code`, `to_role: code`, `reason: text≤DETAIL_MAX` | — (З `review`, `failed`, `interrupted`, `waiting`); меняет роль | 013 |
| `TASK_WAITING_USER` | ENGINE | обяз. | `reason: code ∈ {approval, review_failed}`, `draft: name или null` (для `approval` — имя из `RESULT_FILE` `kind: draft` этой задачи) | З `running`, `review` → `waiting_user` | 013 |
| `DECISION_RECEIVED` | USER | обяз. | `decision: code ∈ {approve, change, reject}`, `text: text≤TEXT_MAX или null` (обязателен при `change`) | — (З `waiting_user` или `failed`; `approve` — только `waiting_user`) | 013 |
| `TASK_DONE` | ENGINE | обяз. | `via: code ∈ {review, approval}`, `external_action_done: bool` (при `approval` всегда `false`) | З → `done`; И4 | 013 |
| `TASK_FAILED` | ENGINE | обяз. | `reason: code ∈ {retries_exhausted, rejected_by_user, executor_not_found, invalid_output, result_file}`, `detail: text≤DETAIL_MAX` | З `running`, `review`, `waiting_user`, `interrupted`, `waiting` → `failed` | 010, 013 |
| `TASK_INTERRUPTED` | ENGINE | обяз. | `cause: code ∈ {recovery, stop, cancel}` | З `running`, `review` → `interrupted`; открытых запусков задачи быть не должно (И14) | 009 (восстановление), 010, 013 |

Перечни: `EXECUTORS = ["claude-cli", "scripted"]` (D-B). `ROLES` — коды п. 8. `TASK_FAILED.reason = result_file` — новый
код r1 для отказа ядра по файлу результата (критерий 16 REQ-010, п. 6.7).

### 4.3. Статусы

| Проект: код | Текст | Конечный |
|---|---|---|
| `created` | создан | нет |
| `planning` | планирование | нет |
| `running` | в работе | нет |
| `paused` | на паузе | нет |
| `waiting_user` | ждёт решения пользователя | нет |
| `stopped` | остановлен | да |
| `done` | выполнен | да |
| `failed` | не удалось | да |

| Задача: код | Текст |
|---|---|
| `waiting` | ждёт |
| `running` | в работе |
| `review` | на проверке |
| `done` | готово |
| `failed` | не удалось |
| `waiting_user` | ждёт решения пользователя |
| `interrupted` | прервана |

Тексты статусов — в `schema.js` (`PROJECT_STATUS_TEXT`, `TASK_STATUS_TEXT`).

## 5. Состояние и редьюсер

### 5.1. Форма состояния (только JSON-значения)

```
ProjectState = {
  id: string, goal: string, status: ProjectStatus, executor: string,
  budget_usd: number,                       // 0 — потолка нет
  spent_usd: number, scenario_file: "scenario.json" | null,
  created_at: ts, updated_at: ts, last_seq: int, last_ts: ts,
  parallel: 1 | 2 | 3 | null,
  recovered: boolean,                       // true после PROJECT_RECOVERED до RESUMED/PAUSED/STOPPED/FAILED
  plan: { round: int, attempt: int, last_rejection: { reason, detail } | null },
  goal_check: { round: int, passed: boolean | null, seq: int | null },   // seq последнего GOAL_CHECK_RESULT
  tasks_changed_seq: int | null,            // seq последнего события, изменившего задачу (п. 5.3, «меняет задачу»)
  waiting: { reason: string, task: string | null } | null,
  tasks: Task[],
  runs: { next: int,
          open:   { [run_id]: { purpose, role, task | null, executor, started_seq } },
          closed: { [run_id]: { purpose, task | null, outcome, started_seq } },
          charged: string[] },              // run_id, по которым уже есть BUDGET_SPENT
  memory: { seq, kind, text, task | null, source }[],
  files: { seq, name, task | null, bytes, sha256, kind, from_work }[],
  chat: { seq, ts, source, kind, text, task | null, truncated }[],
}
Task = {
  id, role, text, done_when, depends_on: string[], critical: boolean,
  status: TaskStatus, attempts: int, files: string[],
  last_review: { run_id, passed, notes, seq } | null,
  last_decision: { decision, text | null, seq } | null,
  waiting_since_seq: int | null,            // seq последнего TASK_WAITING_USER
  review_since_seq: int | null,             // seq последнего TASK_REVIEW
  reason: string | null,
  created_at: ts, updated_at: ts,
}
```

`reduce(state, event)` — чистая функция: не меняет `state`, не читает часы и окружение. Поэтому состояние писателя
глубоко равно состоянию, собранному другим процессом из файла (критерий 2).

### 5.2. Инварианты (нарушение → код из столбца при записи; `E_CORRUPT` с номером строки при чтении)

| № | Правило | Код |
|---|---|---|
| И1 | Первое событие — `PROJECT_CREATED` с `seq = 1`; второго нет; `project` каждой строки равен id проекта | `E_TRANSITION` |
| И2 | Переходы статусов — только из таблиц п. 4; после конечного статуса проекта допустимы только `CHAT`, `MEMORY_ADDED`, `RUN_FINISHED`, `BUDGET_SPENT`, `TASK_INTERRUPTED`, `LOCK_STALE_REMOVED`, `JOURNAL_RECOVERED` | `E_TRANSITION` |
| И3 | `TASK_STARTED` — только если все `depends_on` задачи в `done` | `E_TRANSITION` |
| И4 | `TASK_DONE` `via: review` — только из `review`, `last_review.passed === true` и `last_review.seq > review_since_seq`; `via: approval` — только из `waiting_user`, задача `critical`, `last_decision.decision === "approve"` и `last_decision.seq > waiting_since_seq`, `external_action_done === false` | `E_TRANSITION` |
| И5 | id в `TASK_CREATED` — следующий; в `PLAN_RECEIVED` id идут подряд со следующего; `depends_on` — только на задачи с меньшим номером; роль из каталога; задач ≤ 200 | `E_TRANSITION` (роль вне каталога — `E_EVENT`) |
| И6 | `PROJECT_DONE` — только если задач ≥ 1, все `done`, `goal_check.passed === true` и `goal_check.seq > tasks_changed_seq` | `E_TRANSITION` |
| И7 | `RUN_STARTED.run_id` — следующий; `AGENT_ACTIVITY`, `RUN_FINISHED` — на открытый запуск; `REVIEW_RESULT` — на запуск `review` этой задачи (открытый или закрытый после `review_since_seq`); `GOAL_CHECK_STARTED` — на открытый `goal_check`, `GOAL_CHECK_RESULT` — на `goal_check` (открытый или закрытый); поле `task` события равно `task` запуска | `E_TRANSITION` |
| И8 | `BUDGET_SPENT`: `run_id` — запуск, который был начат (открыт или закрыт); по нему ещё нет `BUDGET_SPENT` (`runs.charged`); `task` события равна `task` запуска; `total_usd` = `spent_usd` + `cost_usd` (точность 1e-6). `BUDGET_SET.budget_usd` > 0 и > `spent_usd` | `E_TRANSITION` |
| И9 | `TASK_REASSIGNED.from_role` равна роли задачи, `to_role` другая, из каталога | `E_TRANSITION` |
| И10 | `DECISION_RECEIVED` `change` — непустой `text`; `approve` — только `waiting_user` | `E_TRANSITION` |
| И11 | Время — п. 3.2 | `E_TIME` |
| И12 (F3) | `RUN_STARTED.executor` и `AGENT_ACTIVITY.executor` равны `executor` проекта; у `AGENT_ACTIVITY` — ещё и `executor` его запуска | `E_TRANSITION` (`details.rule = "И12"`) |
| И13 (F4) | Пока `recovered = true`, запрещены события, начинающие работу: `PLANNING_STARTED`, `PLAN_RECEIVED`, `TASK_STARTED`, `RUN_STARTED`, `TASK_REVIEW`, `GOAL_CHECK_STARTED`, `PROJECT_DONE`, `PROJECT_WAITING`. `PROJECT_RESUMED` из `running`/`planning` — только при `recovered = true` и с `after: "recovery"`; `after: "recovery"` при `recovered = false` — отказ. `PROJECT_RECOVERED` — только при статусе `planning`/`running`, `recovered = false`, без открытых запусков и без задач `running`/`review` | `E_TRANSITION` |
| И14 (F4) | `TASK_INTERRUPTED` — только если у задачи нет открытых запусков (их закрывает `RUN_FINISHED` раньше) | `E_TRANSITION` |
| И15 (F5) | `RUN_FINISHED.files`: каждое имя — файл из `state.files` с той же `task`, что у запуска, записанный после `started_seq` запуска | `E_TRANSITION` |
| И16 (F5) | `RUN_STARTED`: `work` — задача `running`, роль запуска = роль задачи; `review` — задача `review`, роль `reviewer`; `plan` — `task` нет, проект `planning`, роль `project_manager`; `goal_check` — `task` нет, проект `running`, роль `reviewer`; у задачи не больше одного открытого запуска | `E_TRANSITION` |
| И17 (F5) | Событие с непустым `task` (кроме `TASK_CREATED`, где это новый id) ссылается на существующую задачу проекта | `E_TASK_NOT_FOUND` |
| И18 (F5) | `RUN_REFUSED` — задача в `waiting`, `running`, `interrupted` или `failed` и без открытого запуска | `E_TRANSITION` |

Попытки задачи (`attempts`) = число `RUN_STARTED` `purpose: work` по задаче (прерванный запуск — тоже попытка).

### 5.3. Действие каждого типа на состояние (F5)

Общее для **каждого** события: `last_seq = seq`, `last_ts = updated_at = ts`. «Задача: `updated_at`» — у задачи из
`task` ставится `updated_at = ts`. «Меняет задачу» — событие ставит `tasks_changed_seq = seq` (это и есть «изменение
задачи» для И6). Ничего, кроме названного, событие не меняет.

| Тип | Поля состояния | Меняет задачу (И6) |
|---|---|---|
| `PROJECT_CREATED` | всё состояние: `id`, `goal`, `executor`, `budget_usd`, `scenario_file`, `status = created`, `created_at`, `spent_usd = 0`, `recovered = false`, `parallel = null`, `plan = {round:0, attempt:0, last_rejection:null}`, `goal_check = {round:0, passed:null, seq:null}`, `tasks_changed_seq = null`, `waiting = null`, пустые `tasks`, `runs = {next:1, open:{}, closed:{}, charged:[]}`, `memory`, `files`, `chat` | нет |
| `PROJECT_STARTED` | `status = running`, `parallel` | нет |
| `PLANNING_STARTED` | `status = planning`, `plan.round`, `plan.attempt` | нет |
| `PLAN_REJECTED` | `plan.last_rejection = {reason, detail}` | нет |
| `PLAN_RECEIVED` | `status = running`; задачи плана добавлены (как `TASK_CREATED` каждая); `plan.last_rejection = null` | да |
| `PROJECT_WAITING` | `status = waiting_user`, `waiting = {reason, task}` | нет |
| `PROJECT_PAUSED` | `status = paused`, `recovered = false`; `waiting` сохраняется (вопрос остаётся видимым) | нет |
| `PROJECT_RESUMED` | `status = running`, `waiting = null`, `recovered = false`, `parallel` (если не `null`) | нет |
| `PROJECT_RECOVERED` | `recovered = true` | нет |
| `PROJECT_STOPPED` / `PROJECT_FAILED` | `status = stopped` / `failed`, `waiting = null`, `recovered = false` | нет |
| `PROJECT_DONE` | `status = done`, `waiting = null` | нет |
| `GOAL_CHECK_STARTED` | `goal_check.round = round`, `goal_check.passed = null` | нет |
| `GOAL_CHECK_RESULT` | `goal_check = {round, passed, seq}` | нет |
| `BUDGET_SPENT` | `spent_usd = total_usd`; `run_id` в `runs.charged` | нет |
| `BUDGET_SET` | `budget_usd` | нет |
| `CHAT` | строка в `chat` | нет |
| `MEMORY_ADDED` | строка в `memory` | нет |
| `RESULT_FILE` | строка в `files`; если `task` — имя в `Task.files` (это единственный источник `Task.files`), задача: `updated_at` | да, если `task` не `null` |
| `LOCK_STALE_REMOVED` / `JOURNAL_RECOVERED` | — | нет |
| `TASK_CREATED` | новая задача: `status = waiting`, `attempts = 0`, `files = []`, `reason = null`, `last_review = last_decision = null`, `waiting_since_seq = review_since_seq = null` | да |
| `TASK_STARTED` | задача: `status = running`, `reason = null` | да |
| `RUN_STARTED` | `runs.open[run_id]` с `started_seq = seq`, `runs.next += 1`; для `work` — задача: `attempts += 1` | да, если `work` |
| `AGENT_ACTIVITY` | — | нет |
| `RUN_FINISHED` | запуск переносится из `runs.open` в `runs.closed` с `outcome`; `files` только проверяются (И15), `Task.files` не меняют | нет |
| `RUN_REFUSED` | — (процесс не запускался) | нет |
| `TASK_RETRY` | — | нет |
| `TASK_REVIEW` | задача: `status = review`, `review_since_seq = seq` | да |
| `REVIEW_RESULT` | задача: `last_review = {run_id, passed, notes, seq}` | да |
| `TASK_REASSIGNED` | задача: `role = to_role` | да |
| `TASK_WAITING_USER` | задача: `status = waiting_user`, `reason`, `waiting_since_seq = seq` | да |
| `DECISION_RECEIVED` | задача: `last_decision = {decision, text, seq}` | да |
| `TASK_DONE` | задача: `status = done`, `reason = null` | да |
| `TASK_FAILED` | задача: `status = failed`, `reason` | да |
| `TASK_INTERRUPTED` | задача: `status = interrupted`, `reason = cause` | да |

Очистка: `Task.reason` ставят `TASK_FAILED`, `TASK_WAITING_USER`, `TASK_INTERRUPTED`; очищают `TASK_STARTED`, `TASK_DONE`.
`ProjectState.waiting` ставит `PROJECT_WAITING`; очищают `PROJECT_RESUMED`, `PROJECT_STOPPED`, `PROJECT_FAILED`,
`PROJECT_DONE`; `PROJECT_PAUSED` его сохраняет.

### 5.4. Прогресс (критерий 8)

`progress(state)` → `null`, если задач нет; иначе `{ done: <число задач в done>, total: <число всех задач> }`. Процентов
нет. В выводе без задач ключа `progress` **нет**.

## 6. Писатель

### 6.1. Кто пишет

Писатель — процесс, который вызвал `openWriter` (или `createProject`) и ещё не вызвал `writer.close()`. Все записи в
проект — только методами `Writer`. Команды чтения `openWriter` не вызывают, ничего не создают, не усекают, не меняют прав.

### 6.2. Замок (`lock.js`)

Содержимое `writer.lock`: одна строка JSON `{"pid":<int>,"since":"<ts>"}` и `\n`.

Взятие права (`acquireLock(projectDir, pid)` → `{ stalePid: int | null }`), всё в одном вызове:

1. Записать `writer.lock.<pid>.new` (`writeFileSync`, `{flag:"wx", mode:0o600, flush:true}`, данные — `Buffer`), затем
   `linkSync(временный, writer.lock)` — атомарное «создать, если нет»; временный — `unlinkSync`.
2. `EEXIST` → прочитать `writer.lock` (`lstat`: обычный файл; ≤ 4 KiB; JSON с целым `pid ≥ 1`). Кривой замок →
   `E_LOCK_BAD` «Файл-замок проекта повреждён: удалите <имя> вручную, если проект никто не использует».
3. `process.kill(pid, 0)` без ошибки или `EPERM` — жив → `E_PROJECT_BUSY` «Проект занят другим процессом (pid N)»;
   временный файл удалён, остальное не меняется.
4. `ESRCH` — замок устаревший: `renameSync(writer.lock, writer.lock.stale-<свой pid>)`; `ENOENT` — его уже снял другой,
   к шагу 1 (не больше 3 кругов, затем `E_PROJECT_BUSY`). Прочитать переименованный:
   - тот же `pid`, что на шаге 2, — `unlinkSync(stale)`, к шагу 1, запомнив `stalePid`;
   - другой `pid` (за это время замок снял и взял процесс Б) — вернуть его: `linkSync(stale, writer.lock)`, затем
     `unlinkSync(stale)`, `E_PROJECT_BUSY`;
   - **(F6)** возврат дал `EEXIST` (свободное имя успел занять процесс В): `unlinkSync(stale)`, `E_PROJECT_BUSY`. Замок Б
     потерян: Б и В оба считают себя писателями. Б это обнаружит при следующем `append` (проверка замка, п. 6.4, шаг 7:
     в `writer.lock` не его pid → `E_LOCK_LOST`, Б сломан и больше не пишет); строку, которую Б пишет в промежутке между
     этой проверкой и своей записью, ловит проверка размера (`E_CONFLICT`) у того, кто пишет вторым, — частично.
     **Остаточный риск** (README, P1, запись 0017): гонка трёх процессов на устаревшем замке может дать одну строку
     журнала от потерявшего замок писателя; окно — между `renameSync` и возвратом, доли миллисекунды, нужны три
     процесса одновременно на одном проекте, у которого замок уже устарел.
5. `LOCK_STALE_REMOVED {pid: stalePid}` пишет `openWriter` (п. 6.3), а не `acquireLock`.

Отдача права (`releaseLock`): прочитать `writer.lock`; свой `pid` — `unlinkSync`; иначе ничего не трогать.

Остаточный риск повторного pid: pid умершего писателя может достаться живому процессу — проект считается занятым, пока
тот жив (ложное «занят», не две записи).

### 6.3. Открытие на запись (`openWriter(id, opts)`)

Шаги в одном вызове, по порядку:

1. Проверка id и папки проекта (п. 7.1) → иначе `E_NOT_FOUND`.
2. Если `writer.lock` есть и его `pid` жив → `E_PROJECT_BUSY` (до любого чтения и изменения).
3. Прочитать журнал (п. 7.2) **без изменений**. Испорченная строка не последней (или последняя — целый JSON, но не
   проходит схему/инварианты) → `E_CORRUPT` «Журнал проекта повреждён в строке N: …», ничего не меняется.
4. `acquireLock` (п. 6.2).
5. Прочитать журнал **ещё раз** и повторить классификацию; `E_CORRUPT` → отдать замок, ошибка.
6. **(F11)** Права (п. 2.2): сузить, записать в `notices`. Сбой → отдать замок, ошибка, ничего не записано.
7. Убрать остатки аварий: `writer.lock.*.new` и `writer.lock.stale-*` с мёртвыми pid, `files/.partial-*`.
8. Восстановление, по порядку, каждое событие — внутренним `append` (п. 6.4) от ENGINE:
   1. последняя строка оборвана (нет `\n` в конце или не JSON) — `ftruncateSync` до начала оборванной строки,
      `fsyncSync`;
   2. `LOCK_STALE_REMOVED {pid}` — если замок был устаревшим;
   3. `JOURNAL_RECOVERED {line, dropped_bytes}` — если усекали;
   4. **(F4)** `RUN_FINISHED {run_id, outcome:"interrupted", summary:null, cost_usd:null, files:[]}` — для каждого
      открытого запуска (`work`, `review`, `plan`, `goal_check`) по порядку `run_id`, с `task` запуска;
   5. `TASK_INTERRUPTED {cause:"recovery"}` — для каждой задачи в `running` или `review` (F4) по порядку id;
   6. **(F4)** `PROJECT_RECOVERED {from_status, closed_runs, interrupted_tasks}` — если статус проекта `planning` или
      `running` и `recovered = false`.
   Причина: живого писателя, который ведёт работу, нет (замок взят нами) — значит, работа оборвалась.
9. Вернуть `Writer`; `writer.notices` — строки о снятом замке, восстановлении, закрытых запусках, прерванных задачах,
   «Работа проекта прервалась — продолжите её командой возобновления» (при `PROJECT_RECOVERED`), сужении прав.

Повторный захват на целом журнале без открытых запусков, без задач `running`/`review`, без устаревшего замка и с
`recovered = true` или статусом не `planning`/`running` ничего не дописывает (критерий 5г).

Связь с REQ-013 (критерий 10 REQ-013): после восстановления `resume` пишет `PROJECT_RESUMED {after:"recovery"}` из
`running`/`planning` (И13), затем снова начинает задачи `interrupted` (`TASK_STARTED` из `interrupted` разрешён), новая
попытка засчитывается.

### 6.4. Добавление (`writer.append(input)` → `Event`)

Вход: `{ source, type, task?, data, ts? }`. Всё — в одном синхронном вызове, под взятым замком:

1. Писатель сломан → `E_WRITER_BROKEN` «Запись прервана сбоем; откройте проект заново».
2. Тип из «только ядро» (`PROJECT_CREATED`, `PROJECT_RECOVERED`, `RESULT_FILE`) через публичный `append` → `E_EVENT`
   (F8, F4). Проверка формы по каталогу → иначе `E_EVENT` с полем.
3. Маскирование полей `text` (п. 3.4), проверка пределов и шаблонов на маскированном.
4. Конверт: `seq = last_seq + 1`, `ts` по п. 3.2, `project = id`; проверка времени → `E_TIME`.
5. `reduce(state, event)` на копии → `E_TRANSITION` / `E_TASK_NOT_FOUND` с правилом.
6. Строка = `JSON.stringify(event) + "\n"`; длина > `LINE_BYTES_MAX` → `E_EVENT_TOO_BIG`.
7. Запись (`journal.appendLine`):
   - **(F6)** проверка замка: `writer.lock` — обычный файл с собственным `pid` → иначе `E_LOCK_LOST` «Право записи на
     проект потеряно; откройте проект заново», ничего не записано;
   - `openSync(events.jsonl, O_WRONLY|O_APPEND|O_NOFOLLOW)` (без `O_CREAT`); `fstatSync` — размер равен известному
     писателю (`bytes`), иначе `E_CONFLICT`;
   - цикл `writeSync` до конца буфера; `fsyncSync(fd)`; `closeSync`.
8. **(F1)** Любой сбой шага 7 (`E_LOCK_LOST`, `E_CONFLICT`, ошибка `writeSync`, короткая запись, ошибка `fsyncSync`)
   делает писателя **сломанным всегда** — и при удачном откате: после сбоя fsync состояние страниц файла не определено,
   продолжать запись тем же писателем нельзя. При сбое `writeSync`/`fsyncSync`: `ftruncateSync(fd, bytes)` + `fsyncSync` —
   откат к прежнему размеру; ошибка `E_DISK` (текст — п. 10.3), `details = { os_code, rollback: "ok" | "failed" }`.
   Состояние в памяти **не** содержит события. Если откат не удался, в файле может остаться часть строки или целая
   строка; следующий `openWriter` отбросит часть (п. 6.3, шаг 8.1), а целая строка останется — событие записано, хотя
   `append` сообщил об ошибке (так и говорит текст `rollback: "failed"`).
9. Только после успешного `fsyncSync`: `state = новое`, `bytes += длина строки`; вернуть событие.

Защита в той же операции: проверка формы, маскирование, переходы, время, проверка замка и запись — один вызов.

Удобные методы — обёртки над внутренним `append` (своих мест записи журнала нет):

| Метод | Событие |
|---|---|
| `writer.say(text)` | `CHAT {text, kind:"message", truncated:false}`, USER |
| `writer.addTask({role, text, done_when, depends_on = [], critical = false}, source = "ENGINE")` | `TASK_CREATED` |
| `writer.addMemory({kind, text, task = null}, source = "ENGINE")` | `MEMORY_ADDED` |
| `writer.writeResultFile({task = null, name, content, kind = "result"})` | файл (п. 6.6) + `RESULT_FILE {from_work:false}` |
| `writer.importWorkFile({task = null, path, name?, kind = "result"})` | файл из `work/` (п. 6.7) + `RESULT_FILE {from_work:true}` |
| `writer.nextTaskId()`, `writer.nextRunId()` | id, ничего не пишут |
| `writer.workDir` | абсолютный путь `<HOME>/<id>/work` — cwd исполнителя REQ-010 |
| `writer.scenarioPath` | абсолютный путь копии сценария или `null` — для scripted REQ-010 |

### 6.5. Создание проекта (`createProject(input, opts)` → `{ id, state }`)

Вход: `{ goal: string, budget_usd: number, executor: string, scenario_json?: string | null }`. Всё или ничего:

1. Проверка входа (как `PROJECT_CREATED`, п. 4.1, после маскирования цели) → `E_EVENT`. `budget_usd` — 0..`BUDGET_MAX`
   (**0 разрешён**, F2: «потолка нет»; запрет настоящих запусков без потолка — в исполнителе claude-cli REQ-010, отказ
   команды `new` на 0 — REQ-010). `scenario_json` — только при `executor = scripted` (иначе `E_EVENT`
   «Сценарий допустим только для тестового исполнителя»); строка ≤ `SCENARIO_BYTES_MAX` байт, `JSON.parse` даёт объект,
   иначе `E_EVENT`. Файл сценария читает вызывающий (`new --scenario` REQ-010), ядро не открывает путей вне `<HOME>`.
2. `<HOME>` — п. 2.2 (создать или сузить).
3. id = `p-<YYYYMMDD по UTC из now()>-<6 шестнадцатеричных знаков>` из `opts.randomId()` (по умолчанию
   `crypto.randomBytes(3)`); никогда не из текста пользователя. `<HOME>/<id>` уже есть (`lstat`) — новый id, до 5 раз,
   затем `E_DISK`.
4. `mkdirSync(<HOME>/.creating-<id>, 0o700)`; в ней `files/` и `work/` (0700); `scenario.json`, если сценарий дан
   (`writeFileSync`, `{flag:"wx", mode:0o600, flush:true}`, `Buffer` строки **байт-в-байт**, без маскирования — P9);
   `events.jsonl` (то же, строка `PROJECT_CREATED` с `seq 1`, `scenario_file = "scenario.json"` или `null`).
5. `lstat(<HOME>/<id>)` ещё раз → нет; `renameSync(.creating-<id>, <id>)`.
6. Любой сбой шагов 4–5 → `rmSync(.creating-<id>, recursive)`, `E_DISK` с кодом ОС; `<HOME>` и другие проекты не
   изменены. Остаток аварии `.creating-*` чтение пропускает.

(F15) Остаточный риск: если между `lstat` шага 5 и `renameSync` кто-то создаст **пустую** папку с тем же случайным id,
`rename` молча заменит её (на непустую — `ENOTEMPTY` → `E_DISK`). Потерять так нечего (папка пуста), вероятность ничтожна
(24 бита случайности, одна секунда); названо в README.

Замок при создании не берётся: до шага 5 папки проекта нет.

### 6.6. Файл результата (`writer.writeResultFile`, `files.js`)

1. **(F10)** Имя — **без маскирования**, только шаблон `NAME_PATTERN = ^[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}$` и
   дополнительно: нет `..`, не начинается с `.`. Значит: латиница, цифры, точка, дефис, подчёркивание; 1–80 знаков;
   `/`, `\`, NUL, пробел, кириллица невозможны. Нарушение → `E_FILE_NAME` «Недопустимое имя файла результата».
   Обычное имя вида `plan.v2.md` проходит без изменений (маскирование превратило бы его в `[скрыто]`, F4).
   Остаточный риск (P8): имя из 80 допустимых знаков может само быть похоже на ключ — ядро его не маскирует; имена
   выбирает исполнитель или тест.
2. `files/` — обычная папка 0700 (`lstat`, не ссылка) своего проекта.
3. `content` — строка UTF-8; маскируется `maskSecrets`; ≤ `FILE_BYTES_MAX` байт после маскирования. Не строка → `E_EVENT`.
4. Итоговое имя уже существует (в том числе ссылка, `lstat`) → `E_FILE_EXISTS`.
5. `writeFileSync(files/.partial-<имя>, Buffer, {flag:"wx", mode:0o600, flush:true})`; `linkSync(.partial, итоговое)`
   (`EEXIST` → `E_FILE_EXISTS`); `unlinkSync(.partial)`.
6. `sha256` считает ядро по записанным (маскированным) байтам; внутренний `append(RESULT_FILE {name, bytes, sha256, kind,
   from_work})`. Сбой → удалить итоговый файл; папка как была.
7. Сбой любого шага 5 → удалить `.partial-<имя>` (если создан), `E_DISK`; журнал и `files/` прежние; писатель **не**
   сломан (журнал не трогали).

### 6.7. Файл из рабочей папки (`writer.importWorkFile`, F9)

Как файлы агента становятся файлами результата (критерий 16 REQ-010). Всё в одном вызове:

1. `path` — относительный путь внутри `work/`: строка, части через `/`, 1–8 частей, каждая проходит `NAME_PATTERN` и
   правила п. 6.6.1, длина ≤ `WORK_PATH_MAX`; абсолютный путь, `..`, `.`, пустая часть, `\`, NUL → `E_WORK_FILE`
   «Файл результата не найден в рабочей папке или недопустим» **до обращения к файлам**.
2. `name` — по умолчанию последняя часть `path`; проверка п. 6.6.1.
3. Обход от `<id>/work` по частям: каждая промежуточная — обычная папка (`lstat`, не ссылка); последняя — обычный файл
   (`lstat`, не ссылка); открыть `O_RDONLY|O_NOFOLLOW`, `fstatSync` — тот же `dev`/`ino`, что у `lstat`, размер ≤
   `FILE_BYTES_MAX`. Иначе (нет файла, ссылка, папка, слишком большой) → `E_WORK_FILE`.
4. Прочитать байты; декодировать UTF-8 строго (`TextDecoder("utf-8", {fatal:true})`) → иначе `E_WORK_FILE`
   («не текст»; двоичные результаты в этом срезе не принимаются — вопрос I5).
5. Дальше — п. 6.6, шаги 3–7 (маскирование, `.partial`, `linkSync`, 0600, `RESULT_FILE {from_work:true}`).
6. Файл в `work/` не меняется и не удаляется.

Исполнитель REQ-010 при отказе `E_WORK_FILE`/`E_FILE_NAME`/`E_FILE_EXISTS` пишет `TASK_FAILED {reason:"result_file"}` —
это его логика; ядро только отказывает, ничего не записав.

## 7. Чтение

### 7.1. Путь к проекту по id (одинаковый отказ)

`resolveProjectDir(home, id)`: `id` не строка или не проходит `^p-[0-9]{8}-[0-9a-f]{6}$` → `E_NOT_FOUND` **до любого
обращения к файлам**. Иначе `path.join(home, id)`; `lstat` — нет, не папка, ссылка, чужой владелец, нет `events.jsonl`
(обычного файла, `O_NOFOLLOW`), пустой журнал, `project` первой строки не равен id → `E_NOT_FOUND`. Ответ один: код
выхода 1, stderr ровно `E_NOT_FOUND: Проект не найден`.

### 7.2. Разбор журнала (`journal.readJournal(file)` → `{ events, tail, bytes }`)

- Файл целиком через дескриптор (`O_RDONLY|O_NOFOLLOW|O_NONBLOCK`), ничего не пишет.
- Последний кусок без `\n` (непустой) или последняя строка с `\n`, но не JSON, — оборванный хвост.
- `tail = { line, bytes } | null`.
- Каждая целая строка: JSON → схема → `seq` = номер строки → `reduce`. Первая ошибка не в хвосте → `E_CORRUPT` с
  `details.line`.
- Пустой файл → `E_NOT_FOUND`.

### 7.3. API чтения

| Функция | Результат |
|---|---|
| `listProjects({ home })` | `{ projects: ProjectSummary[], warnings }`; папки `<HOME>` с именами по шаблону id (остальное пропускается); проект с `E_CORRUPT` — с полем `error`; порядок — `created_at`, затем id |
| `readProject(id, { home })` | `{ state, tail, warnings }` |
| `readEvents(id, { home, after = 0, limit = PAGE_DEFAULT })` | `{ events (seq > after, первые limit), next_after: seq последнего или null, tail, warnings }` |

Чтение не берёт замок; при обрыве хвоста показывает состояние по целым строкам и `tail`.

## 8. Каталог ролей (`roles.js`, критерий 10)

`ROLES` — замороженный массив ровно из десяти записей:

```
Role = {
  code: string, title: string, name: string, genitive: string, description: string,
  internal: { prompt: string | null, tools: string[] | null },  // заполняет REQ-010; в REQ-009 оба null
}
```

| `code` | `title` | `name` | `genitive` | `description` |
|---|---|---|---|---|
| `project_manager` | Руководитель проекта | Руководитель проекта | руководителя проекта | Составляет план, распределяет задачи и следит за ходом проекта |
| `business_analyst` | Бизнес-аналитик | Аналитик | бизнес-аналитика | Изучает данные и процессы бизнеса и формулирует, что нужно сделать |
| `researcher` | Исследователь | Исследователь | исследователя | Собирает и проверяет информацию из открытых источников |
| `financial_analyst` | Финансовый аналитик | Финансовый аналитик | финансового аналитика | Считает расходы, доходы, цены и окупаемость |
| `lawyer` | Юрист | Юрист | юриста | Проверяет договоры, условия и правовые риски |
| `marketer` | Маркетолог | Маркетолог | маркетолога | Готовит позиционирование, тексты и план продвижения |
| `designer` | Дизайнер | Дизайнер | дизайнера | Предлагает оформление материалов и макеты |
| `developer` | Разработчик | Разработчик | разработчика | Готовит технические решения и описания |
| `reviewer` | Проверяющий (QA) | Проверяющий | проверяющего | Сверяет результат с критерием готовности |
| `support` | Специалист поддержки | Специалист поддержки | специалиста поддержки | Готовит ответы клиентам и инструкции |

Экспорт: `ROLES`, `ROLE_CODES`, `roleByCode(code)`, `publicRole(role) → { title, name, genitive, description }` —
единственный путь, которым `view.js` и `language.js` берут роль. Тест TM-37 (F12) берёт из каталога коды и непустые
строковые значения `internal` (пустые и `null` пропускает).

## 9. Модуль «язык» (`language.js`, критерий 11, D-F)

`phrase(event, stateBefore) → string`. `PHRASES` — строки `{ type, role: <код> | "*", when, text }`; первая подходящая.
Подстановки — только из публичных полей роли и чисел: `{name}`, `{dep_genitive}`, `{count}`, `{attempt}`. Текст
пользователя и агента во фразу не подставляется.

| Тип | Роль / условие | Фраза |
|---|---|---|
| `PROJECT_CREATED` | — | Создан новый проект |
| `PROJECT_STARTED` | — | Команда приступила к работе |
| `PLANNING_STARTED` | `round = 0` | Руководитель проекта составляет план |
| `PLANNING_STARTED` | `round ≥ 1` | Руководитель проекта добавляет задачи к плану |
| `PLAN_REJECTED` | — | Руководитель проекта уточняет план |
| `PLAN_RECEIVED` | — | План готов, задач в плане: {count} |
| `PROJECT_WAITING` | `plan_failed` | Не удалось составить план — нужен ваш ответ |
| `PROJECT_WAITING` | `budget` | Достигнут потолок расходов — нужно ваше решение |
| `PROJECT_WAITING` | `task_failed` | Задача не получилась — нужно ваше решение |
| `PROJECT_WAITING` | `review_failed` | Результат не прошёл проверку — нужно ваше решение |
| `PROJECT_WAITING` | `approval` | От вас требуется решение |
| `PROJECT_WAITING` | `goal_check_failed` | Цель пока не достигнута — нужно ваше решение |
| `PROJECT_PAUSED` | — | Проект на паузе |
| `PROJECT_RESUMED` | — | Работа над проектом продолжается |
| `PROJECT_RECOVERED` | — | Работа команды прервалась — чтобы продолжить, возобновите проект |
| `PROJECT_STOPPED` | — | Проект остановлен |
| `PROJECT_DONE` | — | Проект выполнен |
| `PROJECT_FAILED` | — | Проект завершён без результата |
| `GOAL_CHECK_STARTED` | — | Проверяющий сверяет результаты с целью |
| `GOAL_CHECK_RESULT` | `passed` / нет | Цель проекта достигнута / Цель пока не достигнута |
| `BUDGET_SPENT` | — | Учтены расходы на работу команды |
| `BUDGET_SET` | — | Потолок расходов изменён |
| `CHAT` | USER | Новое сообщение от вас |
| `CHAT` | ENGINE, `question` | Команда задала вам вопрос |
| `CHAT` | ENGINE, `message` | Сообщение от команды |
| `MEMORY_ADDED` | `fact` / `decision` / `note` | В память проекта добавлен факт / Записано решение / Добавлена заметка |
| `RESULT_FILE` | `result` / `draft` | Готов новый файл с результатом / Готов черновик |
| `LOCK_STALE_REMOVED` | — | Проект снова доступен после неожиданной остановки |
| `JOURNAL_RECOVERED` | — | После сбоя отброшена недописанная запись |
| `TASK_CREATED` | ровно одна незавершённая зависимость | Ожидает результат от {dep_genitive} |
| `TASK_CREATED` | больше одной незавершённой | Ожидает результаты других задач |
| `TASK_CREATED` | нет незавершённых | {name}: новая задача |
| `TASK_STARTED` | `business_analyst` | Аналитик изучает данные |
| `TASK_STARTED` | `researcher` | Исследователь собирает информацию |
| `TASK_STARTED` | `financial_analyst` | Финансовый аналитик считает показатели |
| `TASK_STARTED` | `lawyer` | Юрист изучает правовые вопросы |
| `TASK_STARTED` | `marketer` | Маркетолог готовит материалы |
| `TASK_STARTED` | `designer` | Дизайнер работает над оформлением |
| `TASK_STARTED` | `developer` | Разработчик работает над решением |
| `TASK_STARTED` | `reviewer` | Проверяющий проверяет результат |
| `TASK_STARTED` | `support` | Специалист поддержки готовит ответы |
| `TASK_STARTED` | `project_manager` | Руководитель проекта работает над задачей |
| `RUN_STARTED` | `work`, `attempt = 1` | {name} приступает к задаче |
| `RUN_STARTED` | `work`, `attempt ≥ 2` | {name} пробует ещё раз, попытка {attempt} |
| `RUN_STARTED` | `review` | Проверяющий проверяет результат |
| `RUN_STARTED` | `plan` | Руководитель проекта составляет план |
| `RUN_STARTED` | `goal_check` | Проверяющий сверяет результаты с целью |
| `AGENT_ACTIVITY` | `reading` / `searching` / `writing` / `thinking` / `other` | {name} изучает материалы / Собирает информацию / {name} готовит документ / {name} обдумывает задачу / {name} работает над задачей |
| `RUN_FINISHED` | `ok` | {name}: попытка завершена |
| `RUN_FINISHED` | `network` | Нет доступа к сети, попробуем ещё раз |
| `RUN_FINISHED` | `timeout` | Задача заняла слишком много времени |
| `RUN_FINISHED` | `not_found` | Исполнитель недоступен |
| `RUN_FINISHED` | `invalid_output` | Результат пришёл в неверном виде |
| `RUN_FINISHED` | `failed` | Попытка не удалась |
| `RUN_FINISHED` | `cancelled` / `interrupted` | Работа остановлена / Работа прервана |
| `RUN_REFUSED` | — | Потолок расходов исчерпан, работа не начата |
| `TASK_RETRY` | — | {name} попробует ещё раз |
| `TASK_REVIEW` | — | Результат передан на проверку |
| `REVIEW_RESULT` | `passed` / нет | Проверка пройдена / Проверяющий вернул задачу на доработку |
| `TASK_REASSIGNED` | — | К проекту подключён дополнительный специалист |
| `TASK_WAITING_USER` | `approval` / `review_failed` | Черновик готов — от вас требуется решение / Результат не удаётся довести — нужно ваше решение |
| `DECISION_RECEIVED` | `approve` / `change` / `reject` | Вы одобрили черновик / Вы попросили изменить результат / Вы отклонили черновик |
| `TASK_DONE` | `review` | {name}: задача готова |
| `TASK_DONE` | `approval` | Черновик принят, действие вовне не выполнено |
| `TASK_FAILED` | `rejected_by_user` | Задача отклонена вами |
| `TASK_FAILED` | `result_file` | {name}: файл с результатом не удалось принять |
| `TASK_FAILED` | прочее | {name}: задача не получилась |
| `TASK_INTERRUPTED` | — | Работа над задачей прервана |
| неизвестный тип | — | В проекте произошли изменения (`NEUTRAL_PHRASE`; кода типа нет) |

Правила таблицы:

- Проект с `executor = scripted`: к каждой фразе событий `TASK_*`, `RUN_*`, `AGENT_ACTIVITY` добавляется « — тестовый
  исполнитель» (`SCRIPTED_SUFFIX`); подготовка для критерия 2 REQ-010, проверяется TM-38 (вторая фикстура на проекте
  scripted; F12).
- Ни одна фраза таблицы не содержит: «токен», «контекст», «промт», «prompt», «token», «context», «JSON», «stderr», «exit»,
  «%», «процент», «percent», «настоящий», «реальный», «Claude», «ИИ», «AI», «демо», «demo», «демонстрац» (без учёта
  регистра).
- Три образца владельца (критерий 11): `TASK_STARTED` `business_analyst` → «Аналитик изучает данные»; `TASK_CREATED`
  `marketer` с `depends_on` = [задача `financial_analyst` не в `done`] → «Ожидает результат от финансового аналитика»;
  `TASK_REASSIGNED` → «К проекту подключён дополнительный специалист».

Экспорт: `PHRASES`, `NEUTRAL_PHRASE`, `SCRIPTED_SUFFIX`, `phrase(event, stateBefore)`, `phrasesForJournal(events)`.

## 10. Команды (`npm run team -- …`, `tools/src/team/cli.js`)

### 10.1. Команды, вход, коды выхода

| Команда | Пишет | Вход | Успех (stdout, JSON одной строкой + `\n`) |
|---|---|---|---|
| `projects` | нет | — | `{"projects":[ProjectSummary…],"warnings":[…]}` |
| `project <id>` | нет | `id` | `{"project":ProjectView,"warnings":[…]}` |
| `events <id> [--after N] [--limit M]` | нет | `N`: целое ≥ 0 из цифр (0); `M`: целое 1..200 из цифр (50) | `{"events":[EventView…],"next_after":N\|null,"tail":{line,bytes,text}\|null,"warnings":[…]}` |
| `say <id> --text "<текст>"` | да | текст 1..4000 кодовых точек, не только пробелы | `{"ok":true,"event":EventView,"notices":["…"]}` |

Коды выхода (`EXIT`): **0** — успех; **1** — отказ по существу (п. 10.3); **2** — `E_USAGE`; **3** — `E_INTERNAL`
(любая не `TeamError`). При ошибке stdout пуст, stderr — одна строка `<КОД>: <сообщение>`, без стека. `main` работает
через `runGuarded` (п. 10.4); писатель в `say` закрывается в `finally`.

`say` при длине > 4000: `E_TOO_LONG` «Сообщение длиннее 4000 знаков — сократите его», журнал не меняется (P4).

### 10.2. Формы вывода (`view.js`)

```
ProjectSummary = { id, goal, status, status_text, executor, created_at, updated_at,
                   progress?: { done, total }, tail?: { line, bytes }, error?: { code, message } }
ProjectView = { id, goal, status, status_text, executor, budget_usd, spent_usd, created_at, updated_at,
                progress?: { done, total }, waiting?: { reason_text, task },
                tasks: [{ id, role_title, text, done_when, depends_on, critical, status, status_text,
                          attempts, files, phrase }],
                memory: [{ kind, text, task }], files: [{ name, task, bytes, kind }],
                chat: [{ seq, ts, source, kind, text, task }],
                tail?: { line, bytes, text: "Последняя строка журнала не дописана" } }
EventView = { seq, ts, source, type, task, data, phrase }
```

Нет ни кода роли, ни `internal`, ни `scenario_file`, ни путей `work/` в `ProjectView`/`ProjectSummary`. `budget_usd: 0`
означает «потолка нет». В `say` строки `notices` называют восстановление, снятый замок, закрытые запуски, прерванные
задачи, прерванную работу проекта и сужение прав.

### 10.3. Ошибки

| Код | Выход | Сообщение | Когда | Что не меняется |
|---|---|---|---|---|
| `E_USAGE` | 2 | «Неизвестная команда …», «Нужен id проекта», «--limit: целое от 1 до 200», «--after: целое ≥ 0», «Нужен --text» | разбор аргументов | ничего не читается и не пишется |
| `E_NOT_FOUND` | 1 | Проект не найден | п. 7.1 | ничего |
| `E_HOME` | 1 | Папка данных Sai Team недоступна: … | п. 2.2 | ничего |
| `E_PROJECT_BUSY` | 1 | Проект занят другим процессом (pid N) | п. 6.2, 6.3 | все файлы проекта, права тоже (F11) |
| `E_LOCK_BAD` | 1 | Файл-замок проекта повреждён … | п. 6.2 | всё |
| `E_LOCK_LOST` | 1 | Право записи на проект потеряно; откройте проект заново | п. 6.4, шаг 7 (F6) | журнал |
| `E_CORRUPT` | 1 | Журнал проекта повреждён в строке N: <что не так> | п. 7.2, 6.3 | всё, права тоже (F11) |
| `E_EVENT` | 1 | Событие отклонено: <поле> | п. 6.4, 6.5 | журнал, состояние |
| `E_TIME` | 1 | Время события раньше допустимого … | п. 3.2 | то же |
| `E_TRANSITION` | 1 | Действие недопустимо в текущем состоянии: <правило> | п. 5.2 | то же |
| `E_TASK_NOT_FOUND` | 1 | Задача не найдена в этом проекте | И17 (F5) | то же |
| `E_EVENT_TOO_BIG` | 1 | Событие слишком большое | п. 6.4, шаг 6 | то же |
| `E_TOO_LONG` | 1 | Сообщение длиннее 4000 знаков — сократите его | `say` | то же |
| `E_FILE_NAME` / `E_FILE_EXISTS` | 1 | Недопустимое имя файла результата / Файл с таким именем уже есть | п. 6.6 | `files/`, журнал |
| `E_WORK_FILE` | 1 | Файл результата не найден в рабочей папке или недопустим | п. 6.7 (F9) | `files/`, `work/`, журнал |
| `E_DISK` | 1 | (F13) один текст: «Не удалось записать на диск (<код ОС>); данные проекта не изменены»; при `details.rollback = "failed"` — «Не удалось записать на диск (<код ОС>); откат не удался — откройте проект заново» | сбой ОС при записи | журнал и папки (откат); при неудавшемся откате — п. 6.4, шаг 8 |
| `E_DISK` (чтение) | 1 | «Не удалось прочитать данные проекта (<код ОС>)» | сбой ОС при чтении | всё |
| `E_CONFLICT` | 1 | Журнал изменён другим процессом; откройте проект заново | п. 6.4, шаг 7 | журнал |
| `E_WRITER_BROKEN` | 1 | Запись прервана сбоем; откройте проект заново | п. 6.4, шаг 1 | журнал |
| `E_INTERNAL` | 3 | Внутренняя ошибка ядра Sai Team (<имя>) | ошибка программы | — |

`TeamError { code, message, details }`; `fromOsError(err, action) → TeamError(E_DISK)` переводит каждый сбой ОС.

### 10.4. Отказы на уровне API (критерий 13, F7)

По решению ORCH два случая критерия 13 проверяются на уровне API ядра: EACCES при создании папки проекта
(`createProject`) и EIO при записи файла результата (`writer.writeResultFile`). Свойства: функция бросает `TeamError` с
кодом `E_DISK`, `details.os_code` (`EACCES`/`EIO`) и русским текстом п. 10.3; ни одна другая ошибка (не `TeamError`) не
выходит наружу; процесс, вызвавший функцию, продолжает работу (следующий вызов API того же процесса проходит); состояние
не меняется (`<HOME>` без новых папок; `files/` и журнал прежние, писатель не сломан). Командные отказы для этих случаев —
в REQ-010 (`new`, `run-task`), через ту же обёртку:

`runGuarded(fn: () => unknown, io: { stdout, stderr }) → exitCode` (экспорт `cli.js`): вызывает `fn`, печатает результат
одной строкой JSON; `TeamError` → stderr `formatError`, код по `exitCodeFor`; иное → `E_INTERNAL`, код 3; стека нет
никогда. `main` (REQ-009) и команды REQ-010/013 — только через `runGuarded`. ENOSPC при `say` — на уровне команды (TM-46).

## 11. Модули и экспорты

| Файл | Экспорт (сигнатуры) |
|---|---|
| `errors.js` | `class TeamError extends Error { code; details }`; `EXIT = { OK:0, REFUSED:1, USAGE:2, INTERNAL:3 }`; `exitCodeFor(err)`; `fromOsError(err, action: "write" \| "read")`; `formatError(err) → string` |
| `schema.js` | `SOURCES`, `EVENT_TYPES` (тип → `{ sources, task, fields, coreOnly }`), `EXECUTORS`, `PROJECT_STATUS`, `TASK_STATUS`, `PROJECT_STATUS_TEXT`, `TASK_STATUS_TEXT`, `FINAL_PROJECT_STATUS`, `LIMITS`, `PATTERNS` (`project`, `task`, `run`, `hash`, `ts`, `name`), `isCanonicalTs(s)`, `checkInput(input)`, `checkEnvelope(event)`, `textFields(type)`, `checkResultName(name) → { ok } \| { ok:false, reason }`, `checkWorkPath(path) → то же` |
| `roles.js` | `ROLES`, `ROLE_CODES`, `roleByCode`, `publicRole` |
| `reducer.js` | `initialState() → null`; `reduce(state, event) → ProjectState`; `replay(events)`; `progress(state)` |
| `language.js` | `PHRASES`, `NEUTRAL_PHRASE`, `SCRIPTED_SUFFIX`, `phrase(event, stateBefore)`, `phrasesForJournal(events)` |
| `view.js` | `projectSummary(state, tail)`, `projectView(state, tail, events)`, `eventView(event, stateBefore)` |
| `home.js` | `resolveHome(env)`; `ensureHome(home) → string[]`; `inspectHome(home)`; `resolveProjectDir(home, id)`; `ensureModes(projectDir) → string[]`; `modeWarnings(projectDir) → string[]` |
| `journal.js` | `readJournal(file)`; `appendLine(file, expectedBytes, line, lockCheck: () => void) → newBytes`; `truncateTo(file, bytes)` |
| `lock.js` | `LOCK_FILE`; `acquireLock(projectDir, pid)`; `releaseLock(projectDir, pid)`; `assertLockHeld(projectDir, pid)` (бросает `E_LOCK_LOST`); `isAlive(pid)`; `cleanLockLeftovers(projectDir)` |
| `files.js` | `publishResultFile(filesDir, name, content) → { bytes, sha256 }`; `readWorkFile(workDir, path) → string` (бросает `E_WORK_FILE`); `removeResultFile(filesDir, name)`; `cleanPartials(filesDir)` |
| `store.js` | `createProject(input, opts?)`; `openWriter(id, opts?) → Writer`; `listProjects(opts?)`; `readProject(id, opts?)`; `readEvents(id, opts?)`. `opts = { home?, env?, now?, randomId? }` |
| `store.js` (`Writer`) | поля `id`, `state`, `notices`, `workDir`, `scenarioPath`; методы `append`, `say`, `addTask`, `addMemory`, `writeResultFile`, `importWorkFile`, `nextTaskId`, `nextRunId`, `close` |
| `cli.js` | `main(argv, env) → exitCode`; `runGuarded(fn, io) → exitCode` |

`store.js` — единственный файл с `import { maskSecrets } from "../pixel-office/mask.js"`.

## 12. Пути отказа (что видит пользователь и что неизменно)

| Случай | Что видит | Код | Что неизменно |
|---|---|---|---|
| Проект держит живой процесс, `say` | `E_PROJECT_BUSY: Проект занят другим процессом (pid N)` | 1 | все файлы папки проекта и их права |
| То же, `project`/`events` | обычный вывод | 0 | всё |
| Устаревший замок, `say` | успех; `notices`; в журнале `LOCK_STALE_REMOVED`, затем `CHAT` | 0 | — |
| Оборванная последняя строка, чтение | вывод по целым строкам, `tail` | 0 | все файлы |
| То же, `say` | усечение, `JOURNAL_RECOVERED`, закрытие запусков, `TASK_INTERRUPTED`…, `PROJECT_RECOVERED` (если `planning`/`running`), `CHAT` | 0 | строки до оборванной |
| Испорченная строка не последней | `E_CORRUPT: … в строке N …` | 1 | все файлы и права |
| Несуществующий / кривой id | `E_NOT_FOUND: Проект не найден` | 1 | всё; к файлам вне `<HOME>` не обращались |
| Кривой `--limit`/`--after` | `E_USAGE` | 2 | всё |
| Длинный текст `say` | `E_TOO_LONG` | 1 | журнал |
| ENOSPC/EIO на `writeSync`, сбой `fsyncSync` | `E_DISK … (ENOSPC)` | 1 | (F13) журнал прежний байт-в-байт; если откат не удался — прежний плюс часть строки (её отбросит следующий писатель) или плюс одна целая строка (событие записано); состояние без события; писатель сломан (F1) |
| Замок отобран третьим процессом | `E_LOCK_LOST` | 1 | журнал |
| EACCES при создании папки проекта (API, п. 10.4) | `TeamError E_DISK … (EACCES)` | — (API) | `<HOME>` без новых папок |
| EIO при записи файла результата (API) | `TeamError E_DISK … (EIO)` | — (API) | `files/` и журнал; писатель работает дальше |
| Имя файла `../../x`, `.x`, кириллица, > 80 | `E_FILE_NAME` | — (API) | ничего не записано |
| Путь `work/` с `..`, абсолютный, ссылка, нет файла, не UTF-8 | `E_WORK_FILE` | — (API) | `files/`, `work/`, журнал |
| Широкие права у `<HOME>` | писатель: сужает (после замка) и говорит; чтение: `warnings` + stderr | 0 | чтение — права как были |
| Ошибка программы | `E_INTERNAL: …` без стека | 3 | — |

## 13. Места записи (критерий 2: разбор `grep -rnE 'writeFile|appendFile|createWriteStream' tools/src/team/`)

| Файл | Вызов | Что пишет | В `grep` |
|---|---|---|---|
| `store.js` (`createProject`) | `fs.writeFileSync(<.creating-id>/events.jsonl, …, {flag:"wx", mode:0o600, flush:true})` | первая строка журнала | да |
| `store.js` (`createProject`) | `fs.writeFileSync(<.creating-id>/scenario.json, …, {flag:"wx", mode:0o600, flush:true})` | копия сценария scripted | да |
| `lock.js` (`acquireLock`) | `fs.writeFileSync(writer.lock.<pid>.new, …)` | файл-замок (до `linkSync`) | да |
| `files.js` (`publishResultFile`) | `fs.writeFileSync(files/.partial-<имя>, …)` | файл результата (до `linkSync`); его же вызывает `importWorkFile` | да |
| `journal.js` (`appendLine`) | `fs.openSync` + `fs.writeSync` + `fs.fsyncSync` | строка журнала | нет — названа здесь |
| `journal.js` (`truncateTo`, откат) | `fs.ftruncateSync` | усечение / откат | нет — названа здесь |

Других мест записи нет; `appendFile` и `createWriteStream` не используются. REQ-010 и REQ-013 новых мест записи журнала
не добавляют (только `writer.append`); файлы в `work/` пишет процесс агента, не код `tools/src/team/`.

## 14. README: раздел «## Sai Team — ядро» (`tools/README.md`)

Подразделы (критерий 15): что это (ядро без интерфейса и без исполнителя); где данные (`~/.sai-team`, `SAI_TEAM_HOME` —
абсолютный путь), раскладка папки проекта (`events.jsonl`, `files/`, `work/` — рабочая папка исполнителя, её содержимое не
маскируется; `scenario.json` у тестовых проектов) и права (0700/0600; писатель сужает, чтение предупреждает); что
хранится (после маскирования `[скрыто]`, правила 0013; имена файлов и хеши проверяются шаблоном и не маскируются);
журнал — единственная правда; один писатель и «проект занят» (pid, снятие устаревшего замка, остаточные риски:
повторный pid и гонка трёх процессов на устаревшем замке); восстановление после аварии (обрыв строки, прерывание задач
и запусков, «работа прервалась — возобновите»; испорченная середина — проект не открывается на запись); каталог ролей;
как удалить проект (папка вручную; остатки `.creating-*`; пустая папка с тем же id при создании); команды `projects`,
`project`, `events`, `say` с примерами (вымышленные id) и кодами выхода 0/1/2/3; проверка — `cd tools && npm run check`.

## 15. Критерий → тест

### 15.1. Таблица

Файлы — `tools/test/team-*.test.js`. Каждый тест создаёт свой временный `SAI_TEAM_HOME` `<вне проекта>` через
`team-helpers.js`; каждый дочерний процесс — с ограничением времени (`spawnSync`/`spawn` с `timeout`); тесты не зависят
друг от друга. «Хеши» — список путей папки проекта (или `<HOME>`) с sha256 содержимого и правами, до и после. Тесты API
вызывают функции ядра в процессе теста; сбои ОС в процессе теста — `mock.method(fs, …)` (F7), в дочернем процессе
команды — `fault-inject.js`.

| Крит. | Тест | Файл | Что проверяет |
|---|---|---|---|
| 1 | TM-01 | `team-docs.test.js` | строки критерия 1 (а)–(г) в `STATE.md`, `decisions/0015-*.md`, `decisions/README.md`, `CLAUDE.md` |
| 2 | TM-02 | `team-state.test.js` | фикстура ≥ 30 событий всех видов через API; `writer.state` `deepStrictEqual` состоянию, которое дочерний процесс собирает `readProject` |
| 2 | TM-03 | `team-state.test.js` | (F9) в папке проекта только `events.jsonl`, `files/`, `work/` и (у scripted) `scenario.json`, пока писатель держит — ещё `writer.lock`: производного файла нет; удаление всего, кроме `events.jsonl`, `files/`, `work/`, `scenario.json`, состояния не меняет; `work/` существует, 0700, и не содержит файлов ядра |
| 2 | TM-04 | `team-state.test.js` | `grep -rnE 'writeFile\|appendFile\|createWriteStream' tools/src/team/` — ровно четыре места п. 13 (два в `store.js`, `lock.js`, `files.js`) |
| 2, 3 | TM-05 | `team-state.test.js` | инварианты И2–И10: по одному недопустимому событию на правило → `E_TRANSITION`, хеш журнала тот же |
| 3 | TM-06 | `team-journal.test.js` | каждая строка — JSON с ключами `seq, ts, project, task, source, type, data`; `source` ∈ {ENGINE, AGENT, USER}; `seq` = номер строки |
| 3 | TM-07 | `team-journal.test.js` | без каждого обязательного поля — отказ, хеш тот же |
| 3 | TM-08 | `team-journal.test.js` | источник `SYSTEM`, тип `NO_SUCH_TYPE`, лишнее поле — отказ; `PROJECT_RECOVERED` и `RESULT_FILE` через `append` — `E_EVENT`; хеш тот же |
| 3 | TM-09 | `team-journal.test.js` | ENGINE на 1 мс раньше — `E_TIME`, хеш тот же; с тем же временем — принято |
| 3 | TM-10 | `team-journal.test.js` | USER и AGENT на 2001 мс раньше — отказ; USER на 2000 мс раньше — принято; USER позже `now()` — отказ |
| 4 | TM-11 | `team-writer.test.js` | дочерний процесс теста держит право через API; `say` — код ≠ 0, stderr «занят» и pid; хеши те же; `project`, `events` — код 0 |
| 4 | TM-12 | `team-writer.test.js` | `kill -9` того процесса; `say` — 0; в журнале `LOCK_STALE_REMOVED {pid}` и затем `CHAT` |
| 4 | TM-13 | `team-writer.test.js` | (F1, F7) в процессе теста `mock.method(fs, "writeSync")`: `throw` EIO, `throw` ENOSPC, частичная запись (настоящая запись половины буфера, затем ENOSPC) — `append` бросает `E_DISK`; файл прежний байт-в-байт; `writer.state.last_seq` прежний; следующий `append` того же писателя — `E_WRITER_BROKEN`; новый `openWriter` после `close()` пишет нормально |
| 4 | TM-14 | `team-writer.test.js` | (F1) `mock.method(fs, "fsyncSync")` бросает EIO один раз — `E_DISK`, откат выполнен, файл прежний; следующий `append` того же писателя — `E_WRITER_BROKEN` (сломан и при удачном откате); отдельно — откат тоже не удался (`ftruncateSync` бросает): `details.rollback = "failed"`, файл — прежний плюс одна целая строка или её часть |
| 4 | TM-15 | `team-writer.test.js` | `mock.method` на `fsyncSync` и `writeSync`: на каждое успешное `append` ≥ 1 `fsyncSync` по дескриптору журнала после последнего `writeSync` и до возврата |
| 5 | TM-16 | `team-recovery.test.js` | (а) хвост без `\n` и отдельно хвост не JSON с `\n`; задача `running`: `project`, `events` — код 0, «не дописана», задача «в работе», хеши те же |
| 5 | TM-17 | `team-recovery.test.js` | (б) `say`: файл усечён; `JOURNAL_RECOVERED {line, dropped_bytes}` с верными числами; `TASK_INTERRUPTED {cause:"recovery"}`; `notices` называют восстановление |
| 5 | TM-18 | `team-recovery.test.js` | (в) испорченная строка не последней: `say` — код ≠ 0, номер строки, хеши те же; чтение — та же ошибка |
| 5 | TM-19 | `team-recovery.test.js` | (г) второй `say` на восстановленном журнале добавляет ровно одно событие `CHAT` (и при проекте `running` с `PROJECT_RECOVERED` — второго `PROJECT_RECOVERED` нет) |
| 6 | TM-20 | `team-store.test.js` | 0700 у `<HOME>`, папки проекта, `files/`, `work/`; 0600 у `events.jsonl`, `writer.lock`, файла результата, `scenario.json` |
| 6 | TM-21 | `team-store.test.js` | `<HOME>` 0755: `say` сужает до 0700 и называет; `projects` предупреждает и права оставляет |
| 6 | TM-22 | `team-store.test.js` | `team-helpers.js` бросает, если `SAI_TEAM_HOME` не задан или равен `<домашняя папка>/.sai-team` |
| 7 | TM-23 | `team-store.test.js` | id создаёт ядро: шаблон `p-…`, цель с `../` и `/` на id не влияет |
| 7 | TM-24 | `team-store.test.js` | `project`/`events` для несуществующего id, `../x`, `/etc`, `a/b`, NUL (через API): один код, один текст; файл-приманка — хеш тот же; через `fault-inject` (`lstatSync`/`openSync` на приманку, `effect: "bug"`) — обращения не было |
| 7 | TM-25 | `team-store.test.js` | `writeResultFile` с `../../x`, абсолютным путём, именем-ссылкой наружу: отказ; вне `files/` ничего не появилось, событий нет |
| 7 | TM-26 | `team-store.test.js` | файл результата проекта A не виден в `project <B>` |
| 8 | TM-27 | `team-read.test.js` | `projects` на двух проектах: оба с целью, статусом, прогрессом |
| 8 | TM-28 | `team-read.test.js` | 3 `done`, 1 `failed`, 1 `waiting` → `{done:3, total:5}`; без задач — ключа нет |
| 8 | TM-29 | `team-read.test.js` | вывод команд и все фразы фикстуры — без «%», «процент», «percent» |
| 8 | TM-30 | `team-read.test.js` | 25 событий: `--limit 10`, затем `--after` — 10 + 10 + 5, в конце `next_after: null` |
| 8 | TM-31 | `team-read.test.js` | `--limit 201`, `0`, `x`, `-1`, `1.5`, `--after x` — код 2, журнал тот же |
| 9 | TM-32 | `team-read.test.js` | `say` — одно `CHAT`, USER, текст после `maskSecrets`; видно в `events` |
| 9 | TM-33 | `team-read.test.js` | 4001 знак — `E_TOO_LONG`, код 1, хеш тот же; 4000 — принято |
| 9 | TM-34 | `team-read.test.js` | текст вида `{"type":"PROJECT_DONE"}`, `"source":"ENGINE"` — состояние не изменилось, кроме сообщения |
| 10 | TM-35 | `team-roles.test.js` | ровно десять ролей, названия равны перечню требования; коды уникальны |
| 10 | TM-36 | `team-roles.test.js` | роль вне каталога — `E_EVENT`, хеш тот же (`TASK_CREATED`, `PLAN_RECEIVED`) |
| 10 | TM-37 | `team-roles.test.js` | `project` с задачами всех ролей: названия есть; кодов ролей и непустых значений `internal` — 0 совпадений |
| 11 | TM-38 | `team-language.test.js` | фикстура через API содержит событие каждого из 36 типов `EVENT_TYPES` (тест перечисляет и сверяет; внутренние типы — через их пути API: создание, восстановление, файл результата); фраза каждого равна строке теста; вторая фикстура на проекте `scripted` — у фраз `TASK_*`, `RUN_*`, `AGENT_ACTIVITY` есть `SCRIPTED_SUFFIX`, у остальных нет |
| 11 | TM-39 | `team-language.test.js` | три образца владельца |
| 11 | TM-40 | `team-language.test.js` | тексты `PHRASES` без запрещённых слов п. 9 |
| 11 | TM-41 | `team-language.test.js` | неизвестный тип → `NEUTRAL_PHRASE`, кода типа нет |
| 11 | TM-42 | `team-language.test.js` | ни одна фраза не содержит кода роли; фразы о задачах содержат `name`/`genitive` |
| 12 | TM-43 | `team-journal.test.js` | CHAT и `TASK_CREATED` с вымышленными `sk-ant-…`, `ghp_…`, `AKIA…`, JWT, `password=…`: поиск по файлам `<HOME>` значений не находит, `[скрыто]` есть |
| 12 | TM-44 | `team-journal.test.js` | `grep -n 'pixel-office/mask.js' tools/src/team/*.js` находит импорт; своих правил M1–M10 нет |
| 13 | TM-45 | `team-faults.test.js` | (F7, API) `mock.method(fs, "mkdirSync")` бросает EACCES на `<HOME>/.creating-<id>`: `createProject` бросает `TeamError` `E_DISK`, `details.os_code = "EACCES"`, текст на русском без `    at `; хеши `<HOME>` прежние; следующий `createProject` без сбоя в том же процессе проходит |
| 13 | TM-46 | `team-faults.test.js` | ENOSPC на `writeSync` журнала при `say` (`node --import fault-inject.js src/team/cli.js`): код 1, `E_DISK … ENOSPC`, без стека, без «Uncaught»; хеши прежние |
| 13 | TM-47 | `team-faults.test.js` | (F7, API) `mock.method(fs, "writeFileSync")` бросает EIO на `files/.partial-<имя>`: `writeResultFile` бросает `TeamError` `E_DISK` (`EIO`); `files/` и журнал прежние; следующий `append` того же писателя проходит |
| 13 | TM-48 | `team-faults.test.js` | `effect: "bug"` на пути записи при `say` — код 3, «Внутренняя ошибка», без стека; журнал прежний; `runGuarded` с функцией, бросающей `TypeError`, — код 3 |
| 14 | TM-49 | `team-deps.test.js` | нет `dependencies`; импорты — `node:…` или относительные; `node:sqlite` нет |
| 14 | — | отчёт BACKEND-DEV | хеши `tools/src/pixel-office/**` до и после |
| 15 | TM-50 | `team-docs.test.js` | раздел «## Sai Team — ядро» и пункты п. 14 (`SAI_TEAM_HOME`, `0700`, `work/`, «занят», «восстановлен», десять названий, «вручную», четыре команды) |
| 15 | — | TEST-RUNNER / RELEASE-VALIDATOR | на копии Sai без `node_modules`: `cd tools && npm ci && npm run check` — код 0; тесты `team-*` > 0 |
| 5, 13 | TM-51 | `team-recovery.test.js` | `effect: "partial-kill"` на `writeSync` журнала во время `say`: следующий `say` восстанавливает, одна `CHAT` после `JOURNAL_RECOVERED` |
| 2, 3 | TM-52 | `team-state.test.js` | `PLAN_RECEIVED` с задачей вне каталога или `depends_on` вперёд — ни одной задачи не создано, хеш тот же |
| 3 | TM-53 | `team-state.test.js` | (F3, И12) проект `claude-cli`: `RUN_STARTED` и `AGENT_ACTIVITY` с `executor: "scripted"` — `E_TRANSITION`, `details.rule = "И12"`, хеш тот же; с `claude-cli` — принято |
| 3, 5 | TM-54 | `team-recovery.test.js` | (F4, И13, И14) журнал: проект `running`, задача A `running` с открытым `work`, задача B `review` с открытым `review`, открытый `goal_check`; `say`: дописаны `RUN_FINISHED {interrupted}` на три запуска по порядку `run_id`, `TASK_INTERRUPTED` A и B, `PROJECT_RECOVERED {from_status:"running", closed_runs:3, interrupted_tasks:2}`, затем `CHAT`; после этого `TASK_STARTED` — `E_TRANSITION`; `PROJECT_RESUMED {after:"recovery"}` — принято, затем `TASK_STARTED` и `RUN_STARTED work` A — приняты, `attempts` A = 2; на проекте без восстановления `PROJECT_RESUMED` из `running` — `E_TRANSITION`; `TASK_INTERRUPTED` при открытом запуске — `E_TRANSITION`; то же для `planning` с открытым `plan` |
| 2, 3 | TM-55 | `team-state.test.js` | (F5, п. 5.3, И15–И18) `RESULT_FILE` с задачей — имя в `Task.files`; `RUN_FINISHED.files` с именем, записанным до запуска или чужой задачей, — `E_TRANSITION`; `Task.reason` после `TASK_FAILED` и `null` после `TASK_STARTED`; `waiting` сохраняется после `PROJECT_PAUSED` и `null` после `PROJECT_RESUMED`; второй `BUDGET_SPENT` на тот же `run_id` — `E_TRANSITION`, на несуществующий — `E_TRANSITION`; событие с `task: "t-0099"` (нет такой) — `E_TASK_NOT_FOUND`; `RUN_STARTED work` с ролью не задачи — `E_TRANSITION`; `RUN_REFUSED` для задачи `done` — `E_TRANSITION`; `MEMORY_ADDED` с задачей не сдвигает `tasks_changed_seq` (И6: `PROJECT_DONE` после него проходит), `RESULT_FILE` с задачей — сдвигает (`PROJECT_DONE` — `E_TRANSITION`); хеш при каждом отказе тот же |
| 4 | TM-56 | `team-writer.test.js` | (F6) в процессе теста: замок с мёртвым pid; `mock.method(fs, "renameSync")` перед настоящим переименованием подменяет содержимое замка живым pid Б, а после — создаёт `writer.lock` с pid В: `openWriter` — `E_PROJECT_BUSY`, `writer.lock.stale-*` нет, `writer.lock` — от В, журнал тот же. Отдельно: открытый писатель, тест переписывает `writer.lock` чужим живым pid — `append` даёт `E_LOCK_LOST`, журнал тот же, следующий `append` — `E_WRITER_BROKEN` |
| 7, 12 | TM-57 | `team-store.test.js` | (F9) в `writer.workDir` тест кладёт `notes/report.md` с вымышленным `ghp_…`: `importWorkFile({path:"notes/report.md"})` — `files/report.md` 0600, значения нет, `[скрыто]` есть, `RESULT_FILE {from_work:true}` с sha256 записанных байт; `work/notes/report.md` не изменён. Отказы `E_WORK_FILE` без записи (хеши `files/`, журнала, `<HOME>`): `../x`, абсолютный путь, ссылка наружу (и папка-ссылка в середине пути), несуществующий файл, папка, не-UTF-8, > 5 MiB |
| 7, 12 | TM-58 | `team-store.test.js` | (F10, F8) имена `plan.v2.md`, `report.2026.md`, `report_v2.md` — приняты и сохранены без изменений; `отчёт.md`, `a b.md`, `.hidden`, `a..b`, 81 знак, пустое — `E_FILE_NAME`, ничего не записано; `RESULT_FILE` через `writer.append` — `E_EVENT`; `sha256` в журнале равен хешу файла и не маскирован |
| 2, 3 | TM-59 | `team-store.test.js` | сценарий: `createProject` scripted с `scenario_json` — `scenario.json` байт-в-байт равен входу, 0600, `PROJECT_CREATED.data.scenario_file = "scenario.json"`, `writer.scenarioPath` указывает на него; `claude-cli` со сценарием, не-JSON, > 1 MiB — `E_EVENT`, `<HOME>` без новых папок; scripted без сценария — `scenario_file: null` |
| 3 | TM-60 | `team-store.test.js` | (F2) `createProject` с `budget_usd: 0` — создан, `state.budget_usd = 0`; `-1`, `100001`, `"5"`, `null` — `E_EVENT`, ничего не создано; `BUDGET_SET 0` — `E_TRANSITION` |
| 4, 6 | TM-61 | `team-writer.test.js` | (F11) папка проекта 0755 + живой замок: `say` — `E_PROJECT_BUSY`, права остались 0755; то же с испорченной серединой журнала — `E_CORRUPT`, права 0755 |

Каждый тест — с критерием; у каждого критерия — тест (1 — TM-01 и проверка до WF-02; 14 — TM-49 и отчёт; 15 — TM-50
и прогон на чистой копии). Критерий 13 в текущем тексте говорит «команда team» для EACCES и EIO; по решению ORCH
REQ-ANALYST меняет формулировку на уровень API (I2 в п. 19).

### 15.2. Мутанты

| Мутант | Ловит |
|---|---|
| убрать `fsyncSync` в `appendLine` | TM-15 |
| допуск ENGINE 2000 мс вместо 0 | TM-09 |
| допуск USER `>` вместо `>=` на границе 2000 | TM-10 |
| не откатывать при сбое записи | TM-13 |
| не ломать писателя при удачном откате | TM-13, TM-14 |
| обновлять состояние до `fsyncSync` | TM-13, TM-14 |
| чтение усекает хвост | TM-16 |
| писатель пропускает испорченную середину | TM-18 |
| `isAlive` всегда `false` | TM-11 |
| не писать `LOCK_STALE_REMOVED` | TM-12 |
| считать `failed` в `done` | TM-28 |
| `progress: {done:0,total:0}` без задач | TM-28 |
| убрать проверку шаблона id до `fs` | TM-24 |
| не маскировать `text` | TM-43 |
| маскировать `name` | TM-58 |
| показывать `role` (код) в `project` | TM-37 |
| фраза из кода роли | TM-39, TM-42 |
| `TASK_STARTED` без проверки зависимостей | TM-05 |
| `PLAN_RECEIVED` по одной задаче | TM-52 |
| пропускать `throw` без `E_DISK` | TM-46 |
| убрать И12 | TM-53 |
| восстановление не закрывает открытые запуски / не прерывает `review` | TM-54 |
| не писать `PROJECT_RECOVERED` или писать его повторно | TM-54, TM-19 |
| разрешить `BUDGET_SPENT` дважды на `run_id` | TM-55 |
| не проверять существование задачи | TM-55 |
| не проверять замок в `append` | TM-56 |
| `importWorkFile` идёт по ссылке | TM-57 |
| запретить `budget_usd = 0` | TM-60 |
| сужать права до проверки «занят» | TM-61 |
| сценарий маскируется | TM-59 |

### 15.3. Расширение `tools/test/fault-inject.js`

Нужно для TM-46, TM-51, TM-24 (`openSync`, `writeSync`). Обратно совместимо: прежние поля и функции не меняются; новые
функции включаются, только если названы в `SAI_TEST_FAULTS`.

- Новые `fn`: `openSync` (по пути); `writeSync`, `fsyncSync`, `ftruncateSync` — по дескриптору: совпадение, если
  дескриптор открыт `openSync` с путём из `paths` (помощник запоминает `fd → путь`, забывает при `closeSync`).
- Действия: `throw`, `bug`, `kill` — для всех; `partial` и `partial-kill` — для `writeSync`.
- Загрузка через `--import`. Тесты API (TM-13, TM-14, TM-45, TM-47, TM-56) используют `mock.method(fs, …)` в процессе
  теста, без дочернего процесса (F7).

## 16. Планка

| Пункт | Применим? | Как выполняется |
|---|---|---|
| Q1 | применим | изменение привязано к REQ-009; у всех 15 критериев способ проверки — тесты TM и команды п. 15 |
| Q2 | применим | проект проверяет CODE-DESIGN-VALIDATOR (шаг 1b), код — SECURITY-REVIEWER и REVIEWER, тесты — TEST-DESIGN-VALIDATOR, итог — RELEASE-VALIDATOR своим запуском |
| Q3 | применим | факты п. 0 — своими запусками (r1: маскирование имён файлов); «работает» — только после `npm run check` с выводом |
| Q4 | применим | одна команда `cd tools && npm run check`; тесты `team-*` входят в шаблон без правки; прогон на чистой копии — критерий 15 |
| Q5 | применим | таблица п. 15.1: каждый критерий → тест; тесты отказа сравнивают хеши до и после; свой временный `SAI_TEAM_HOME` |
| Q6 | применим | `skip`, отключённых правил линтера, `\|\| true` нет; `fault-inject.js` только расширяется |
| Q7 | применим | поля `text` и содержимое файлов результатов маскируются `maskSecrets` до записи; `name` и `hash` — по шаблону без маскирования (P7, P8, остаточные риски названы); сценарий — копия тестового файла без маскирования (P9); `work/` — черновики агента без маскирования в папке 0700 (P9, README); ключей в ядре нет; окружение — только `SAI_TEAM_HOME`; TM-43, TM-44, TM-57, TM-58 |
| Q8 | применим как принцип для проектов | id создаёт ядро; шаблон id до `fs`; один ответ «проект не найден»; файлы результатов только в `files/` своего проекта; файл из `work/` — только внутри `work/` своего проекта, без ссылок; агент не достаёт до журнала и замка (`work/` отдельно); TM-23…TM-26, TM-57 |
| Q9 | неприменим | базы и SQL нет |
| Q10 | применим | каждый сбой ОС → `E_DISK` с понятным текстом и откатом; API бросает только `TeamError` (п. 10.4); команды через `runGuarded`, без стека; TM-13, TM-14, TM-45…TM-48; сетевых вызовов нет |
| Q11 | неприменим | ядро по сети не ходит (сеть Исследователя — REQ-010) |
| Q12 | применим | опирается на 0002, 0003, 0004, 0013, 0015; оспоримые выборы — предложение записи 0017 (п. 19, P1–P10) |
| Q13 | применим | урок AP-025 учтён (TM-22); AP-005 — ссылки на прежнюю редакцию проверены поиском (`E_BUSY`, «процесс-помощник», `FILE_NAME_MAX 100`); новых ошибок процесса нет |
| Q14 | применим | handoff заполняется в этой работе; статус требования — DOC-UPDATER после PASS RELEASE-VALIDATOR; REQ-009 не `done`, пока REQ-002 не `done` |
| R1 | применим | мерж — только с подтверждения владельца; проект его не касается |
| R2 | применим (правда событий ядра) | события ENGINE пишутся в момент настоящего изменения (снятие замка, восстановление, закрытие прерванных запусков, прерывание, `PROJECT_RECOVERED`), время — с часов писателя; события восстановления и создания пишет только ядро (`append` их отклоняет); выдуманных и задним числом нет; журнал только дописывается, усекается лишь оборванная последняя строка с `JOURNAL_RECOVERED`; Pixel Office не меняется |
| R3 | неприменим | фото покупателей нет |

## 17. Связи с будущими требованиями

- **REQ-010** пишет `RUN_STARTED`, `AGENT_ACTIVITY`, `RUN_FINISHED`, `RUN_REFUSED`, `TASK_RETRY`, `BUDGET_SPENT`,
  `TASK_FAILED`, `TASK_INTERRUPTED`, `TASK_CREATED` (USER) через `writer.append`; создаёт проект `createProject` (`new`;
  отказ команды на потолок 0 — в `new`, ядро 0 хранит, F2); `executor` запусков равен `executor` проекта (И12, F3);
  рабочая папка процесса — `writer.workDir`, файлы агента — через `writer.importWorkFile` (F9); сценарий scripted — из
  `writer.scenarioPath` (копия при `new`); команды `new` и `run-task` — через `runGuarded` с командными отказами EACCES/EIO.
- **REQ-013** пишет остальные типы; после восстановления `resume` пишет `PROJECT_RESUMED {after:"recovery"}` (И13, F4).
  Пока движок держит замок, **любая** команда записи из другого процесса — `say`, `answer`, `pause`, `stop`, `budget`,
  `resume`, `add-task`, `run-task` — получает от ядра `E_PROJECT_BUSY` (F14). Канал приёма команд работающим движком
  (критерий 9 REQ-013: `pause` действует на работающий движок) выбирает проект REQ-013 — I3.
- **REQ-011/REQ-012** импортируют чистые модули и читают через `readProject`/`readEvents`.

## 18. План раундов BACKEND-DEV и ворота

| Раунд | Файлы | Ворота раунда (сам разработчик, вывод в отчёте) |
|---|---|---|
| 1 — контракт | `errors.js`, `schema.js`, `roles.js` | `npm run check` — код 0 |
| 2 — чистая логика | `reducer.js`, `language.js`, `view.js` | `npm run check`; ручной прогон `node --input-type=module -e` (с ограничением времени) на фикстуре всех 36 типов |
| 3 — хранение | `home.js`, `journal.js`, `lock.js`, `files.js`, `store.js` | `npm run check`; ручные запуски во временном `SAI_TEAM_HOME` `<вне проекта>`: создание, два писателя, `kill -9`, обрыв строки, восстановление `running`, `importWorkFile` |
| 4 — команды и документы | `cli.js`, скрипт `team`, раздел README | `npm run check`; `npm run team -- projects/project/events/say`; хеши `tools/src/pixel-office/**` до и после |

Ворота WF-02 дальше: SECURITY-REVIEWER → REVIEWER → TEST-DESIGNER (TM-01…TM-61, расширение `fault-inject.js`) →
TEST-DESIGN-VALIDATOR → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER. Ни один запуск не трогает `~/.sai-team` и
`~/.sai-pixel-office`.

## 19. Открытые вопросы и предложения записи в `decisions/`

Вопросы:

- **I1.** Закрыт решением ORCH: расширение `fault-inject.js` (п. 15.3) — TEST-DESIGNER.
- **I2.** Решение ORCH: EACCES и EIO критерия 13 — на уровне API (п. 10.4, TM-45, TM-47); командные — в REQ-010. Текст
  критерия 13 REQ-009 в `docs/requirements.yaml` на момент r1 ещё говорит «команда team завершается кодом не 0» — правит
  REQ-ANALYST; до правки RELEASE-VALIDATOR увидит расхождение.
- **I3.** (F14) Пока движок REQ-013 держит замок, `say`, `answer`, `pause`, `stop`, `budget`, `resume`, `add-task`,
  `run-task` из другого процесса получают `E_PROJECT_BUSY`. Нужен ли движку канал приёма этих команд — решает проект
  REQ-013 (критерии 9 REQ-013).
- **I4.** REQ-010 (описание, списки инструментов ролей) на момент r1 говорит «Read, Write, Edit, Glob, Grep внутри папки
  проекта», а рабочая папка — `work/`; по указанию ORCH инструменты работают только внутри `work/`. Формулировку правит
  REQ-ANALYST.
- **I5.** `importWorkFile` принимает только текст UTF-8 (маскирование работает над текстом). Двоичные результаты (картинки
  дизайнера) в этом срезе отклоняются `E_WORK_FILE`; нужны ли они — вопрос владельцу/REQ-010.
- **I6.** Имена файлов результата не маскируются (решение ORCH, F10); имя, похожее на ключ, ядро сохранит как есть.
  Отклонять такие имена (сравнением с `maskSecrets(name)`) — возможно, но это снова отклонит `plan.v2.md`; оставлено
  остаточным риском P8.

Предложение записи (Q12), одной записью `decisions/0017-team-core-storage.md` (пишет ORCH):

- **P1.** Замок — временный файл + `linkSync`; снятие устаревшего — `renameSync` с проверкой содержимого; ложное «занят»
  при повторном pid — допустимая сторона. Остаточный риск (F6): гонка трёх процессов на устаревшем замке может оставить
  писателя без замка; он узнаёт об этом при следующем `append` (`E_LOCK_LOST`), одна строка в окне между проверкой и
  записью возможна, частично ловится `E_CONFLICT`.
- **P2.** Производного файла состояния нет.
- **P3.** Каталог 36 типов, редьюсер (таблица п. 5.3) и таблица языка фиксируются этим проектом; новые типы — только
  новой редакцией.
- **P4.** `say` отклоняет текст длиннее 4000 знаков; тексты агентов обрезает вызывающий (`prepareText`).
- **P5.** Права шире ожидаемых: писатель сужает (после замка и проверки журнала), чтение предупреждает.
- **P6.** Результаты не перезаписываются (`E_FILE_EXISTS`).
- **P7.** (F8) Поля вида `hash` не маскируются: маскирование превращает sha256 в `[скрыто]` (M10); проверка — шаблон
  `^[0-9a-f]{64}$`; хеш считает только ядро (`RESULT_FILE` пишется только путями ядра, `append` его отклоняет).
  Остаточный риск: 64-hex строку по шаблону не отличить от секрета — но значение всегда вычислено ядром.
- **P8.** (F10) Имена файлов результата не маскируются, проверяются шаблоном (латиница, цифры, `.`, `-`, `_`, ≤ 80, без
  `..`, не с точки). Остаточный риск — I6.
- **P9.** Не маскируются: копия сценария scripted (тестовый файл из `tools/test/fixtures/team/`, копируется байт-в-байт —
  критерий 16 REQ-010 сверяет хеш) и содержимое `work/` (черновики агента, папка 0700); в `files/` и журнал из них
  попадает только маскированное.
- **P10.** (F16) Помощники тестов `tools/test/team-helpers.js` и расширение `tools/test/fault-inject.js` — в границе
  0015 как тестовый код (буквально 0015 называет только `tools/test/team-*.test.js`).
- **P11.** (F4) Восстановление закрывает все открытые запуски (`RUN_FINISHED interrupted`), прерывает задачи `running` и
  `review`, а проект в `planning`/`running` помечает `PROJECT_RECOVERED`; работа продолжается только после
  `PROJECT_RESUMED {after:"recovery"}`.
