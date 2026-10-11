# REQ-010 — проект кода: исполнители агентов Sai Team (интерфейс run, claude-cli, scripted, инструменты ролей, потолок на запуск)

WF-02, шаг 1 (CODE-DESIGNER), прогон `PROD-20261006-01`, handoff `handoffs/PROD-20261006-01/step-07-code-designer.json`.
Требование — блок REQ-010 в `docs/requirements.yaml` (16 критериев). Решения — `decisions/0015-product-virtual-team-start.md`
(D-B, Q11 Исследователя) и `decisions/0017-team-core-storage.md`. Ядро — `docs/design/REQ-009-team-core.md` (дальше «ядро»,
«п. ядра N»): схема события, каталог 37 типов, редьюсер, каталог ролей, `writer`, `work/`, `scenario_file`, `runGuarded`.
Формы ядра здесь **не меняются**; где требованию REQ-010 их не хватает, это вынесено в открытые вопросы (п. 18, I1–I3).
(r1) Правка проекта ядра r4 по решению ORCH — только `writer.importResultBytes` (TM-63), таблица фраз (п. 8.6) и перечень
событий REQ-010 в п. 17 ядра; схема, каталог 37 типов и причины `TASK_FAILED` не меняются.
REQ-013 (движок) вызывает исполнителей этого проекта сам — интерфейс п. 3 рассчитан на него.

Кода реализации здесь нет: только формы данных, сигнатуры, правила и таблицы. Все примеры — вымышленные.

Редакция **r1** — доработка по FAIL ворот (`handoffs/PROD-20261006-01/step-07b-code-design-validator.json`, замечания 1–8) и
решениям ORCH в `handoffs/PROD-20261006-01/step-07-code-designer-r1.json`. Что изменено (номер замечания у каждой правки):
1 — п. 2 (`SAI_TEAM_RUN_CAP_USD`, `RUN_CAP_SHARE`), 8.2 (шаг 6.2), 8.4 (потолок запуска, «расход не пришёл» — потолок
этого запуска), EX-26, EX-28, EX-31, EX-33, EX-47, новый EX-50; 2 — п. 3.1 (правило 1), 3.2 (`checkBudget`), 4, 5.1, 6.1,
8.2 (шаги 3–4, 6.1, кто пишет `RUN_REFUSED`), 9.4, EX-32; 3 — п. 4, 8.2 (шаг 6.5), 8.3, 10.3, новый п. 8.6 (фразы, правка
`language.js`), EX-29, EX-47, п. 18 (I2); 4 — п. 1, 3.1 (`outputs`), 6, 8.5, 14, новый EX-51, п. 18 (I3), правка проекта
ядра (`writer.importResultBytes`, TM-63); 5 — новый EX-49, п. 15.5; 6 — п. 15.2, EX-15, EX-38; 7 — п. 17 ядра и столбец
«Кто» (`TASK_REVIEW`); 8 — п. 0, F7.

Редакция **r2** — малая правка по замечанию 1 ворот r1 (`handoffs/PROD-20261006-01/step-07b-code-design-validator-r1.json`)
и его Low-замечаниям 2–5 (номер замечания у каждой правки): 1 — п. 6.1, 6.2, EX-51 (один способ чтения сценария
scripted: `fs.readFileSync(путь, {flag: O_RDONLY|O_NOFOLLOW})`, без `openSync`); 2 — п. 5.1 (условие 3а), 5.3, 8.2
(шаг 3); 3 — п. 8.3 (приоритет `group`); 4 — п. 15.2 (`runTeam(argv, env, nodeArgs)`); 5 — п. 2
(`SAI_TEAM_RUN_CAP_USD` ≥ 0.01), EX-50, п. 9.4 (строка `E_CONFIG` не меняется); вопрос ворот о `cost_usd` — п. 8.4 (правило
для REQ-013) и п. 18 (I6). Больше ничего не менялось.

Редакция **r3** — малая правка по вопросу №1 CODE-FIXER (`handoffs/PROD-20261006-01/step-15-code-fixer.json`, `result.issues`) и
решению ORCH (1)–(3) (`handoffs/PROD-20261006-01/step-04-code-designer-r6.json`; проект ядра — r6): `runTask` закрывает открытый
запуск **на всех путях выхода**, в том числе при исключении исполнителя не типа `TeamError` и при ошибке приёма результата
(`acceptResult`); запуск закрывается **до** проброса ошибки; если запись закрытия невозможна — писатель считается сломанным
(`writer.markBroken()`, замок при `close()` остаётся, проект восстановит следующий открывающий). Правки: п. 0 (F13), 1
(`store.js`), 8.2 (шаги 6.3, 7, новый шаг 8), 8.5, 9.4, 15.1 (новые EX-52, EX-53), 15.5, 16 (Q10, Q13, R2), 17, 18 (I7, I8).
Формы ядра, события, причины и тексты `FAIL_DETAIL` не меняются; прежние тесты EX-01…EX-51 не меняются.

Редакция **r4** — малая правка по замечанию ворот тестов (`handoffs/PROD-20261006-01/step-17b-test-design-validator.json`) и решению ORCH (`handoffs/PROD-20261006-01/step-07-code-designer-r4.json`): EX-52 (б) — выброс не `TeamError` при приёме (`lstat` `EIO` — штатный `E_WORK_FILE`, не выброс); новый EX-54 (`E_DISK` при записи результата, по `runner.js`); п. 18, I9; перечень EX-01…EX-54 и мутантов. Формы, события, тексты не менялись; в п. 8.2 (шаг 8), 8.5 (шаг 6) и п. 9.4 заменён только пример ошибки приёма на достижимый.

Редакция **r5** — малая правка по FAIL приёмки (`handoffs/PROD-20261006-01/step-20-release-validator.json`, F6, F5, F9) и решению ORCH (`handoffs/PROD-20261006-01/step-07-code-designer-r5.json`): F6 — имена тестовых файлов на фактические `tools/test/exec-*.test.js` и `exec-helpers.js` (п. 0 F8, п. 3, 15.1, 15.2, 16; EX-39/40 — `exec-faults`, EX-52…54 — `exec-closure`, новая строка `exec-findings`); F5 — EX-13: шаблон `child_process|execFile|execSync|[^.\w]exec[(]`, `RegExp#exec` (`lock.js:199`) не нарушение; F9 — п. 6.3, EX-04: суффикс «тестовый исполнитель» и у `MEMORY_ADDED` (правка ядра для BACKEND-DEV); итоговое состояние тестов: EX-01…EX-54, 776 тестов, `npm run check` — код 0 (выписка RELEASE-VALIDATOR). Формы, события, тексты не менялись.

Редакция **r6** — доработка по FAIL итоговых ворот (`handoffs/PROD-20261006-01/step-24-code-design-validator.json`, M1, M2, L1–L7) и решениям ORCH в `handoffs/PROD-20261006-01/step-26-code-designer.json`; проект приведён к коду, правила кода не менялись. Что изменено (номер замечания у каждой правки): M1 — п. 0 (F14, F15), 2 (константы `CLOSE_GRACE_MS`, `COST_REPORTED_MAX`), 5.4 (строка «вывод больше предела», поправка «группа не ушла», правило `cost_usd`), 5.6 (ограниченное ожидание закрытия потоков, остановка оставшейся группы после выхода, `CLOSE_GRACE_MS`), 8.4 (`recordableCost`, `COST_REPORTED_MAX`), 15.1 (строка `exec-findings` — тесты по названиям, столбец критериев), 15.5, п. 18 (I11, P10); M2 — п. 1 (граница файлов тестов — запись 0018), 16 (Q12), 18 (P9, предложение записи — 0018); L1 — п. 8.2 (шаги 7, 8.1, 8.3), 8.5 (шаг 6), 18 (I9 закрыт); L2 — п. 18 (I1 закрыт); L4 — п. 1 (`runner.js` импортирует `maskSecrets`, `prepareText`); L5 — п. 1 (`common.js`), 8.1 (сигнатуры, поле `run` в `RunTaskResult`), 8.2, 8.4, 10.1 (`maxBudgetFor(state, config)`; `floor6`/`ceil6`/`round6` — в `executor.js`); L6 — п. 1, 15.4 (образцы `stream-lies`, `stream-result-string`, `stream-result-text`, `fake-claude-probe.js`); L7 — п. 6.3, 18 (I10 решён ORCH: пометки у `BUDGET_SPENT` нет).

Редакция **r7** — малая правка по F2 ворот тестов (`handoffs/PROD-20261006-01/step-32-test-design-validator.json`), замечаниям ревью (F2, F3) и решениям ORCH в `handoffs/PROD-20261006-01/step-34-code-designer.json`; формы, события, тексты, правила и код не меняются — таблицы приведены к фактическим тестам. Что изменено: новый файл тестов `exec-group.test.js` (5 тестов I11 (б)) — п. 5.4 и 5.6 (ссылки на тесты), 15.1 (строка), 15.5 (мутант), п. 18 (I11 (б) закрыт); устаревшие строки «теста нет — I11» удалены; F2/F3 ревью (Low) — п. 18 (одна строка о комментарии шага 7 `runner.js`).

Редакция **r8** (действующая) — малая правка документа по итоговым воротам (`handoffs/PROD-20261006-01/step-46-code-design-validator.json`, L2, L3; правка — `handoffs/PROD-20261006-01/step-48-code-designer.json`, повторная проверка — `handoffs/PROD-20261006-01/step-50-code-design-validator.json`, PASS); формы, события, тексты, правила и код не менялись. Что изменено: п. 1 — в перечне файлов тестов указана группа `exec-group` (16 файлов `exec-*.test.js`); п. 5.4 — удалено устаревшее предложение о расхождении кода (I11 закрыт).

## 0. Проверенные факты (своими запусками)

Каждый запуск — с ограничением времени (`perl -e 'alarm N; exec @ARGV' …`; на macOS нет `timeout`). Настоящий Claude Code
**не запускался**: выполнены только `--version` и `--help` установленного файла и поиск строк в нём (`grep -c`, без запуска).

| # | Утверждение | Как проверено | Результат |
|---|---|---|---|
| F1 | Установленная версия Claude Code | `<бинарь расширения редактора, самая новая папка>/resources/native-binary/claude --version` | `2.1.289 (Claude Code)`, код 0. В `docs/product/current-state.md` записана 2.1.284 — версия с тех пор обновилась (расширение обновляется само; путь к файлу меняется с версией — п. 12, README) |
| F2 | `claude` в PATH нет | `which claude` | «claude not found» — значит, по умолчанию (`claude` из PATH) настоящий запуск даёт «исполнитель не найден»; владелец задаёт `SAI_TEAM_CLAUDE_BIN` абсолютным путём |
| F3 | Флаги из `--help` 2.1.289 | `claude --help` (310 строк, сохранён `<вне проекта>`) | есть: `-p/--print`; `--output-format text\|json\|stream-json` (только с `--print`); `--verbose`; `--max-budget-usd <amount>` (только с `--print`); `--json-schema <schema>`; `--tools <tools...>` («список доступных инструментов из встроенного набора», пример `"Bash,Edit,Read"`); `--allowedTools`/`--disallowedTools <tools...>` («через запятую или пробел»); `--append-system-prompt <prompt>`; `--restricted` («убирает Bash и другие инструменты запуска кода и WebFetch, если `--tools` их не называет; игнорирует файлы настроек user/project/local; **ограничивает файловые инструменты рабочими папками**; отказывает в bypassPermissions»); `--safe-mode` (отключает CLAUDE.md, skills, plugins, hooks, MCP, свои агенты; вход и встроенные инструменты работают); `--strict-mcp-config`; `--no-session-persistence` (только с `--print`); `--permission-prompts host\|none` («none: всё, что спросило бы разрешение, отклоняется автоматически»); `--permission-mode` (выборы `acceptEdits, auto, bypassPermissions, manual, dontAsk, plan`); `--add-dir`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions` (их мы не передаём) |
| F4 | Форма запрещающего правила WebFetch | `claude-code-settings.schema.json` установленного расширения: поиск `WebFetch` | текст схемы называет правила вида «`WebFetch(domain:…)` allow rules» и «`WebFetch(domain:…)` deny rule»; `permissions.deny` — массив строк-правил. Значит, форма правила — `WebFetch(domain:<хост>)` |
| F5 | Ввод задачи через stdin допустим; `stream-json` с `-p` требует `--verbose` | `grep -c -a -F` по установленному файлу (поиск строк, без запуска) | «Input must be provided either through stdin or as a prompt argument» — 2; «stream-json requires --verbose» — 2 |
| F6 | Имена полей потока `stream-json` есть в установленной версии | `grep -c -a -F` по установленному файлу | `"assistant"` 254, `"result"` 104, `subtype` 290, `"tool_use"` 186, `"tool_result"` 290, `tool_use_id` 367, `is_error` 120, `session_id` 195, `total_cost_usd` 15, `structured_output` 38, `num_turns` 19, `duration_ms` 157, `permission_denials` 13, `parent_tool_use_id` 42, `"init"` 45, `error_max_budget_usd` 5, `error_during_execution` 31, `error_max_turns` 5, `error_max_structured_output_retries` 6, `web_search_tool_result` 10; общие имена (`"type"` вложений) — `"message"` 178,
`"content"` 108, `"text"` 695, `"input"` 75, `"name"` 268, `"id"` 89, `"system"` 290, `"success"` 197, `"user"` 485. Этот
список (вместе с `type`) — и есть `KNOWN_FIELDS` для EX-21. **Документации формата `stream-json` в установленном пакете нет** (`README.md` расширения — 0 упоминаний `stream-json`); вложенность полей по файлу установить нельзя без запуска (п. 5.4, I4) |
| F7 | Префикс тестов `EX-` свободен; ядро уже в коде (r1) | `grep -rhoE '"EX-[0-9]+' tools/test/ \| wc -l`; `ls tools/src/team \| wc -l`; `grep -rnE 'writeFile\|appendFile\|createWriteStream' tools/src/team/` | 0; 12 файлов ядра (BACKEND-DEV, REQ-009); мест записи 4 (`files.js`, два в `store.js`, `lock.js`) — TM-04 |
| F11 | Каталог причин `TASK_FAILED` ядра (r1) | `tools/src/team/schema.js` (тип `TASK_FAILED`), п. 4.2 ядра | `retries_exhausted`, `rejected_by_user`, `executor_not_found`, `invalid_output`, `result_file`; `detail` — текст ≤ `DETAIL_MAX`. Причины `executor_error`, `network`, `budget_exhausted` **нет** |
| F12 | Фразы ядра для сбоя (r1) | `tools/src/team/language.js` | `RUN_FINISHED network` — «Нет доступа к сети, попробуем ещё раз»; `TASK_FAILED` прочее — «{name}: задача не получилась»; `TASK_RETRY` — «{name} попробует ещё раз»; строки фраз выбираются по полям `data` |
| F8 | В `tools/package.json` нет `dependencies`; шаблон тестов `test/**/*.test.js` | чтение файла | новые `tools/test/exec-*.test.js` войдут в прогон без правки |
| F9 | `fault-inject.js` сравнивает путь только точным равенством | чтение `tools/test/fault-inject.js` и п. 15.3 ядра | id проекта случаен — для EACCES на уровне команды `new` нужен фильтр по папке и префиксу имени (п. 15.3, расширение) |
| F10 | `tools/test/helpers.js` уже использует `execFileSync`/`spawnSync` | `grep -n spawn tools/test/helpers.js` | это тестовый код; запрет форм запуска процесса критерия 4 (шаблон EX-13, r5) касается только `tools/src/team/` |
| F13 | (r3) `runTask` не закрывает открытый запуск при исключении и при ошибке приёма; `close()` писателя до правки снимает замок и у сломанного | `grep -c finally` по копиям кода до правки `<вне проекта>/fix-runner-before/team/runner.js` и `fix-recover-before/team/runner.js`; чтение `runTask` (шаги 6.3–6.4 и `acceptResult`); `close()` — F12 ядра | `finally` в `runner.js` до правки: 0 и 0; на пути «`executor.run` бросил не `TeamError`» (`throw err`) и «`acceptResult` бросила не отказ файла» (`throw err` без `RUN_FINISHED`) запуск остаётся открытым, а `writer.close()` в `cli.js` (`finally`) снимал замок — по r5 следующий открывающий не восстанавливает (не авария), и задачу нельзя начать снова (И16; п. 8.2 шаг 1: `running` не запускается) |
| F14 | (r6, M1) Сообщённый расход больше 1e9, отрицательный или не число — «не пришёл» | чтение `runner.js` (`recordableCost`, `COST_REPORTED_MAX = 1e9`), `executors/stream.js` (`total_cost_usd` — только конечное число ≥ 0); `node --input-type=module` (с ограничением времени): `recordableCost` от `2e9`, `5e8`, `0.1234561`, `-1`, `NaN`, `1e9` | `null`, `500000000`, `0.123457`, `null`, `null`, `1000000000` (то же у ворот step-24); тесты `exec-findings` (п. 15.1) |
| F15 | (r6, M1) Группа процессов после выхода процесса | чтение `executors/claude-cli.js` (`CLOSE_GRACE_MS = 500`, `forceClose`, `groupStuck`, обработчик `exit`); проба во временной папке `<вне проекта>` (`perl -e 'alarm 60; exec @ARGV' node …`): `run` claude-cli с подменённым `io.spawn` (процесс-заглушка Node печатает `stream-ok.jsonl`, запускает потомка и выходит кодом 0; настоящий claude не запускался) | потомок **в группе**: `outcome: ok`, `detail: null`, после возврата `run` потомка нет (`kill(pid, 0)` → `ESRCH`) — оставшаяся группа остановлена; потомок **вне группы** держит stdout: `run` вернулся через ≈ 5,0 с (`GROUP_GONE_WAIT_MS`), `outcome: failed` (по потоку был бы `ok`), `transient: false`, `detail` = «Не удалось остановить процессы исполнителя», `cost_usd` 0.05; потомок жив (остаточный риск п. 5.6). То же с `stream-out-of-schema.jsonl`: `invalid_output`, `transient: true`, `detail` «Ответ исполнителя не соответствует схеме» — расхождение, I11 |

## 1. Состав изменений и кто что пишет

| Файл (от корня Sai) | Что | Кто |
|---|---|---|
| `tools/src/team/errors.js` | **добавить** коды п. 10.3 (существующие не меняются) | BACKEND-DEV |
| `tools/src/team/config.js` | новый: чтение переменных окружения REQ-010 (п. 2) | BACKEND-DEV |
| `tools/src/team/role-internal.js` | новый: файл данных — промт и инструменты каждой из 10 ролей (п. 7) | BACKEND-DEV |
| `tools/src/team/roles.js` | заполнить `internal` из `role-internal.js` (остальное ядра не меняется) | BACKEND-DEV |
| `tools/src/team/store.js` | **добавить** `writer.importResultBytes` — по правке проекта ядра r4 (п. 6.8 ядра; r1, замечание 4); (r3) `writer.markBroken()` и `close()` сломанного писателя без снятия замка — по правке проекта ядра r6 (п. 6.4, шаг 10 ядра) | BACKEND-DEV |
| `tools/src/team/language.js` | **поправить** фразы по п. 8.6 (правка п. 9 ядра r4; r1, замечание 3) | BACKEND-DEV |
| `tools/src/team/executor.js` | новый: интерфейс, схема ответа, проверка ответа, текст подсказки, выбор исполнителя (п. 3) | BACKEND-DEV |
| `tools/src/team/executors/stream.js` | новый: разбор `stream-json` (п. 5.4) | BACKEND-DEV |
| `tools/src/team/executors/claude-cli.js` | новый: условия, аргументы, окружение, процесс (п. 5) | BACKEND-DEV |
| `tools/src/team/executors/proc.js` | новый: группа процессов, убийство дерева, ожидание (п. 5.6) | BACKEND-DEV |
| `tools/src/team/executors/scripted.js` | новый: тестовый исполнитель (п. 6) | BACKEND-DEV |
| `tools/src/team/common.js` | (r6, L5) новый: общие чистые помощники без Node API — `has(obj, key)`, `isPlainObject(v)`, `abortablePause(ms, signal) → Promise<boolean>` (пауза между попытками, прерываемая сигналом); импортируют `executor.js`, `executors/scripted.js`, `runner.js` | BACKEND-DEV |
| `tools/src/team/runner.js` | новый: одна задача — повторы, потолок, журнал, файлы (п. 8); (r6, L4) импортирует `maskSecrets` и `prepareText` из `tools/src/pixel-office/mask.js` (импорт, не копия): маскирует содержимое файлов `deps` при чтении для подсказки и обрезает тексты агента по п. 3.1, правило 5 | BACKEND-DEV |
| `tools/src/team/cli.js` | **добавить** команды `new`, `add-task`, `run-task` (п. 9) через `runGuarded` | BACKEND-DEV |
| `tools/README.md` | раздел «## Sai Team — исполнители» (п. 13) | BACKEND-DEV |
| `tools/test/exec-*.test.js` (п. 15; r5: фактические имена — `exec-executor`, `exec-roles-tools`, `exec-stream`, `exec-process`, `exec-retry`, `exec-budget`, `exec-secrets`, `exec-workdir`, `exec-commands`, `exec-faults`, `exec-scripted-source`, `exec-docs`, `exec-guard`, `exec-findings`, `exec-group`, `exec-closure`; всего 16 файлов) | тесты EX-01…EX-54 и тесты `exec-findings` (п. 15.1) — (r6, M2) в границе записи 0018 | TEST-DESIGNER |
| `tools/test/exec-helpers.js` | **создать** (r5: фактическое имя; не тест-файл) помощники п. 15.2 (запрет настоящего claude, урок AP-025) — (r6, M2) в границе записи 0018 | TEST-DESIGNER |
| `tools/test/fault-inject.js` | расширение п. 15.3 (фильтр по папке и префиксу), обратно совместимое | TEST-DESIGNER |
| `tools/test/fixtures/team/fake-claude.js`, (r6, L6) `fake-claude-probe.js` | поддельные исполняемые файлы (п. 15.4), права 0755 — (r6, M2) `tools/test/fixtures/team/**` в границе записи 0018 | TEST-DESIGNER |
| `tools/test/fixtures/team/stream-*.jsonl`, `scenario-*.json`, `README.md` | образцы `stream-json` с источником (п. 5.4), сценарии scripted (п. 6) | TEST-DESIGNER |

Не меняются: `tools/package.json` (скрипт `team` уже добавляет ядро), `tools/src/pixel-office/**` (из него только импорт
`mask.js` — в `store.js` ядра и, r6 L4, в `runner.js`), формы ядра (схема, каталог
37 типов, причины `TASK_FAILED`, редьюсер, `PROJECT_ENTRIES`), места записи ядра (TM-04 — четыре), `.claude/agents/`. Все файлы `tools/src/team/` пишет один BACKEND-DEV, все файлы
`tools/test/` — один TEST-DESIGNER; двое один файл не пишут. Работа начинается после ворот REQ-009 (ядро в коде и
проверено), потому что изменяемые `errors.js`, `roles.js`, `cli.js` — файлы ядра.

Чистые модули (без Node API, их сможет импортировать страница REQ-011/012): `role-internal.js`, `common.js` (r6), `executor.js` (кроме
`getExecutor`, который импортирует исполнителей — п. 3.5), `executors/stream.js`. Node API — в `config.js`,
`executors/claude-cli.js`, `executors/proc.js`, `executors/scripted.js`, `runner.js`, `cli.js`. Все вызовы `fs` и
`child_process` — через объект модуля по умолчанию (`fs.writeFileSync`, `cp.spawn`), без деструктуризации (иначе их не
перехватят `fault-inject.js` и `mock.method`).

## 2. Настройки из окружения (`config.js`)

`readConfig(env) → Config` — вызывается один раз в начале команды; значения **никогда** не печатаются и не пишутся (Q7):
в ошибке называется только имя переменной.

| Переменная | Значение | По умолчанию | Неверное значение |
|---|---|---|---|
| `SAI_TEAM_REAL_RUNS` | только строка `1` включает настоящие запуски; любое другое (`true`, `yes`, `0`, пусто) — выключено | выключено | — (не ошибка: просто выключено) |
| `SAI_TEAM_CLAUDE_BIN` | абсолютный путь к исполняемому файлу Claude Code | `claude` (поиск в PATH делает `spawn`) | задана, но не абсолютный путь или пустая — `E_CONFIG` |
| `SAI_TEAM_WEB` | `0` — у Исследователя нет WebSearch и WebFetch; иное или не задана — есть | есть | — |
| `SAI_TEAM_TASK_TIMEOUT_MS` | целое из цифр, 1000…86 400 000 | `1200000` (20 мин) | `E_CONFIG` |
| `SAI_TEAM_RETRY_DELAY_MS` | целое из цифр, 0…600 000 | `10000` | `E_CONFIG` |
| `SAI_TEAM_RUN_CAP_USD` (r1, замечание 1; r2, замечание 5) | потолок одного запуска в долларах: строка `^[0-9]+(\.[0-9]{1,6})?$`, **≥ 0.01** и ≤ 100000 (меньше цента запуск всё равно не начать: порог `checkBudget` 1e-6 и расход настоящего запуска больше) | не задана — четверть потолка проекта (`RUN_CAP_SHARE`, п. 8.4) | `E_CONFIG: Неверная настройка SAI_TEAM_RUN_CAP_USD` (0, `0.009999`, `0.000001`, `-1`, `x`, `1e3`, пусто) |

```
Config = { realRuns: boolean, claudeBin: string, web: boolean, taskTimeoutMs: int, retryDelayMs: int,
           runCapUsd: number | null }                      // null — не задана
Константы: TASK_TIMEOUT_MS_DEFAULT = 1_200_000, RETRY_DELAY_MS_DEFAULT = 10_000, RETRIES_MAX = 2 (попыток 3),
KILL_GRACE_MS = 3000, GROUP_GONE_WAIT_MS = 5000, RUN_CAP_SHARE = 0.25
(r6, M1) в модулях, не в config.js: CLOSE_GRACE_MS = 500 (executors/claude-cli.js, п. 5.6),
COST_REPORTED_MAX = 1e9 (runner.js, п. 8.4)
```

`SAI_TEAM_HOME` читает ядро (`resolveHome`). Тесты задают таймаут и паузу малыми через эти же переменные.

## 3. Интерфейс исполнителя (`executor.js`)

### 3.1. Вход и выход

```
run(request: RunRequest, io: RunIO) → Promise<RunResult>       // одна попытка, один процесс; без повторов

RunRequest = {
  project:  { id, executor: "claude-cli" | "scripted", budget_usd: number, spent_usd: number },   // из writer.state
  run_id:   "r-NNNNN",                     // уже записан вызывающим в RUN_STARTED
  purpose:  "work" | "review" | "plan" | "goal_check",
  role:     Role,                          // запись каталога ROLES с заполненным internal (п. 7)
  task:     { id, text, done_when } | null,   // null для plan и goal_check (REQ-013)
  attempt:  int ≥ 1,
  context:  { goal: string, memory: { kind, text }[], deps: { task, name, content }[], note: string | null },
  limits:   { max_budget_usd: number | null, timeout_ms: int, work_dir: string },   // work_dir = writer.workDir
  answer_schema: Schema,                   // по умолчанию WORK_ANSWER_SCHEMA (п. 3.3); REQ-013 даёт свои для plan/review/goal_check
  scenario_path: string | null,            // writer.scenarioPath — только scripted
}

RunIO = {
  onEvent: (e: ExecutorEvent) => void,     // вызывается в момент наблюдения, синхронно; вызывающий сразу пишет событие
  signal:  AbortSignal,                    // отмена (SIGTERM run-task, stop движка)
  env:     object,                         // окружение команды; по умолчанию process.env
  config:  Config,                         // п. 2
  spawn?:  typeof child_process.spawn,     // подмена только в тестах (EX-12)
}

ExecutorEvent = { kind: "activity", activity: "reading" | "searching" | "writing" | "thinking" | "other", text: string | null }

RunResult = {
  executor: "claude-cli" | "scripted",
  outcome:  "ok" | "failed" | "timeout" | "cancelled" | "invalid_output" | "not_found" | "network",  // = RUN_FINISHED.outcome ядра без "interrupted"
  transient: boolean,                      // повторять ли (п. 8.3)
  spawned:  boolean,                       // процесс был запущен (для учёта расхода)
  answer:   object | null,                 // только при ok: прошёл answer_schema
  summary:  string | null,                 // answer.summary при ok
  files:    { path: string, kind: "result" | "draft" }[],   // claude-cli: при ok — из answer.files (файлы в work/); иначе []; scripted — всегда []
  outputs:  { name: string, bytes: Buffer, kind: "result" | "draft" }[],   // scripted (r1): файлы результата в памяти; claude-cli — всегда []
  memory:   { kind: "fact" | "decision" | "note", text: string }[],
  cost_usd: number | null,                 // из итога исполнителя; null — не пришёл
  detail:   string | null,                 // постоянный русский текст причины (п. 10.4); без вывода процесса
  stats:    { lines: int, skipped: int, activities: int, dropped_activities: int },
}
```

Правила, общие для обоих исполнителей:

1. **Отказ до запуска** — `run` бросает `TeamError` (коды п. 10.2) до любого действия: процесс не запускается,
   `onEvent` не вызывается. Сам `run` (и `check`) журнал **никогда** не пишет — журнал пишет только вызывающий
   (`runner.js`, движок REQ-013) через `writer.append`; поэтому прямой вызов `run` с отказом журнал не меняет (критерий 3).
   **Кто пишет `RUN_REFUSED` (r1, замечание 2):** только вызывающий и только при отказе `E_BUDGET_EXHAUSTED` (условие
   остатка, `checkBudget`, п. 3.2) — он сразу дописывает одну строку `RUN_REFUSED {reason:"budget_exhausted", detail}`
   через `writer.append`, до любого `RUN_STARTED`. Отказы условий 1–3 (п. 5.1) и прочие отказы `check` — без события.
   Если вызывающий вызвал `run` напрямую (движок REQ-013) и получил `E_BUDGET_EXHAUSTED`, правило то же: `RUN_REFUSED`
   пишет он; поэтому движок проверяет `check` **до** `RUN_STARTED` (как `runner`, п. 8.2), а `run` повторяет проверку
   внутри (защита в той же операции).
2. `run` не бросает после старта: любой сбой процесса, вывода или ответа — `RunResult` с `outcome ≠ ok` и понятным
   `detail`. Исключение — ошибка программы (`E_INTERNAL` через `runGuarded`).
3. Ответ вне `answer_schema` — `outcome: "invalid_output"`, `detail` «Ответ исполнителя не соответствует схеме», `files` и
   `memory` пусты: результат не принимается (критерий 1).
4. `RunResult.executor` равен `request.project.executor` и коду исполнителя; иначе отказ до запуска (п. 3.5).
5. Тексты `ExecutorEvent.text`, `summary`, `memory[].text` — сырые; маскирует и проверяет длину ядро при записи
   (`writer.append`, п. 3.4 ядра). Вызывающий только обрезает их `prepareText` до пределов ядра (P4 записи 0017).

### 3.2. Сигнатуры модуля

| Экспорт | Сигнатура | Что |
|---|---|---|
| `WORK_ANSWER_SCHEMA` | `Schema` (замороженный объект) | схема ответа задачи (п. 3.3) |
| `checkAnswer` | `(schema, value) → { ok: true } \| { ok: false, path: string }` | проверка подмножества JSON Schema п. 3.3; чистая |
| `buildPrompt` | `(request) → string` | текст задачи для stdin (п. 3.4); чистая |
| `toolsForRole` | `(role, config) → string[]` | набор инструментов роли с учётом `SAI_TEAM_WEB` (п. 7) |
| `getExecutor` | `(code) → { code, check(request, io), run(request, io) }` | только из `{claude-cli, scripted}`; иной код — `E_EXECUTOR`; **запасного варианта нет** |
| `runCapFor` (r1) | `(project, config) → number \| null` | потолок одного запуска по п. 8.4; `null` при `budget_usd = 0`; чистая |
| `checkBudget` (r1) | `(request) → void`, бросает `E_BUDGET_EXHAUSTED` | условие остатка: при `project.budget_usd > 0` — `limits.max_budget_usd` число > 1e-6 и ≤ `budget_usd − spent_usd` + 1e-6; при `budget_usd = 0` — `max_budget_usd = null`. Одна функция для `check` обоих исполнителей и для `runner` (п. 8.2) |

### 3.3. Схема ответа и проверка

Поддерживаемое подмножество JSON Schema (`checkAnswer` и схемы REQ-013 обязаны в нём оставаться): `type` (`object`,
`array`, `string`, `integer`, `number`, `boolean`), `properties`, `required`, `additionalProperties: false`, `items`,
`minLength`/`maxLength` (кодовые точки), `minItems`/`maxItems`, `enum`, `minimum`/`maximum`. Неизвестное ключевое слово в
схеме — ошибка программы (`E_INTERNAL`), не молчаливый пропуск.

`WORK_ANSWER_SCHEMA` (передаётся в `--json-schema` строкой JSON и проверяется у нас ещё раз — модели не доверяем):

| Поле | Тип и ограничения | Обяз. |
|---|---|---|
| `summary` | строка 1…2000 | да |
| `files` | массив ≤ 50 из `{ path: строка 1…255, kind?: "result" \| "draft" }` (лишние поля запрещены) | да (может быть пустым) |
| `memory` | массив ≤ 10 из `{ kind: "fact" \| "decision" \| "note", text: строка 1…4000 }` | нет |

Лишние поля верхнего уровня запрещены. Поэтому строки вида «executor=scripted», «budget_usd=1000» в ответе остаются
текстом `summary`/`memory` и ни на что не влияют (критерий 12): из ответа берутся только эти три поля, и они меняют только
`RUN_FINISHED.summary`, файлы результата и записи памяти.

### 3.4. Текст задачи (`buildPrompt`)

Текст идёт процессу **через stdin**, а не аргументом (F5): так текст пользователя не может стать ни флагом, ни командой,
не виден в списке процессов и не ограничен длиной argv. Разделы — по порядку, заголовки — постоянные строки модуля:

| Раздел | Содержимое |
|---|---|
| «Роль» | `role.name` и `role.description` (публичные поля) |
| «Цель проекта» | `context.goal` (уже маскирована ядром) |
| «Задача» / «Критерий готовности» | `task.text`, `task.done_when` (для `plan`/`goal_check` — раздел опускается) |
| «Память проекта» | `context.memory` построчно «— <вид>: <текст>»; пусто — «нет» |
| «Результаты задач, от которых зависит эта» | для каждой `deps[i]`: имя файла и содержимое (файлы `files/`, маскированные); общий предел текста подсказки 200 000 знаков — содержимое обрезается с пометкой «[обрезано]» |
| «Замечания» | `context.note` (замечания проверяющего или текст пользователя, REQ-013), если не `null` |
| «Правила» | постоянный текст: работай только с файлами текущей папки; результат — файлы в текущей папке; ничего не отправляй и не публикуй вовне; ответ — по заданной схеме: `summary`, `files` (пути относительно текущей папки), `memory` |

Текст пользователя вставляется как есть, без интерпретации; защита от подмены роли — не текст подсказки, а то, что
инструменты, папка и поля проекта задаются кодом (п. 5, 7, 8).

Пояснение и соответствие имён — `docs/design/ISS-0023-reviewer-sees-result-file.md`, п. 4.

### 3.5. Выбор исполнителя и «не подставляется тихо»

- Исполнитель берётся **только** из `project.executor` (поле `PROJECT_CREATED`, ядро не даёт его менять: события смены
  исполнителя в каталоге нет). `getExecutor` не имеет значения по умолчанию и ветки «если claude-cli не вышел — scripted».
- Каждый исполнитель в `check` проверяет `request.project.executor === <свой код>`, иначе `E_EXECUTOR` «Исполнитель
  задачи не совпадает с исполнителем проекта».
- `new` без `--executor` создаёт `claude-cli` (п. 9.1).

## 4. События журнала, которые пишет REQ-010 (через `writer.append`, формы ядра п. 4)

| Момент | Событие (`source`) | `data` |
|---|---|---|
| `add-task` | `TASK_CREATED` (USER) | `{role, text, done_when, depends_on: [], critical: false}` |
| старт задачи в `run-task` | `TASK_STARTED` (ENGINE) | `{}` |
| перед каждой попыткой | `RUN_STARTED` (ENGINE) | `{run_id, purpose:"work", role, executor, max_budget_usd}` |
| каждое `ExecutorEvent` | `AGENT_ACTIVITY` (AGENT) | `{run_id, activity, executor, text}`; `ts` не передаётся — время писателя |
| итог ok: каждый файл | `RESULT_FILE` (пишет ядро внутри `writer.importWorkFile` — claude-cli, или `writer.importResultBytes` — scripted, r1) | — |
| итог ok: каждая запись памяти | `MEMORY_ADDED` (AGENT) через `writer.addMemory({kind, text, task, executor}, "AGENT")` | — |
| конец попытки | `RUN_FINISHED` (ENGINE) | `{run_id, outcome, summary, cost_usd, files: [имена принятых файлов]}` |
| после `RUN_FINISHED`, если процесс был запущен | `BUDGET_SPENT` (ENGINE) | `{run_id, cost_usd, accounted, total_usd}` (п. 8.4) |
| перед повтором — только когда повтор решён окончательно (п. 8.2, шаг 6.5) | `TASK_RETRY` (ENGINE) | `{next_attempt, delay_ms, reason}` |
| `check`/`checkBudget` отказал `E_BUDGET_EXHAUSTED` (до задачи или между попытками) | `RUN_REFUSED` (ENGINE) — пишет вызывающий | `{reason:"budget_exhausted", detail:"Потолок расходов исчерпан"}` |
| итог ok | `TASK_REVIEW` (ENGINE) | `{}` — задача «на проверке» (решение ORCH I1) |
| неудача | `TASK_FAILED` (ENGINE) | `{reason, detail}` — `reason` только из каталога ядра (F11), `detail` — постоянный текст `FAIL_DETAIL` (п. 8.3, 8.6) |
| отмена | `TASK_INTERRUPTED` (ENGINE) | `{cause:"cancel"}` |

Других типов REQ-010 не пишет; `PROJECT_*`, `PLAN_*`, `REVIEW_RESULT`, `TASK_DONE` — REQ-013. События пишутся в момент
наблюдения (R2): `AGENT_ACTIVITY` — когда строка потока разобрана, а не после конца процесса. У каждого события AGENT есть
`executor` проекта (И12 ядра).

## 5. Исполнитель `claude-cli` (`executors/claude-cli.js`)

### 5.1. Условия настоящего запуска (`check`, вызывается первым шагом `run`)

`check(request, io)` — одна функция; её вызывают и `run` (первым действием, до создания процесса), и `runner` до
`TASK_STARTED` (чтобы статусы не менялись). Порядок проверок и отказы (`check` ничего не пишет, процесс не создаётся;
условия 1–3 и 3а — отказ без события; условие 4 — вызывающий пишет одну строку `RUN_REFUSED`, п. 3.1, правило 1):

| # | Условие | Отказ |
|---|---|---|
| 1 | `request.project.executor === "claude-cli"` | `E_EXECUTOR` |
| 2 | `io.config.realRuns === true` (переменная ровно `1`) | `E_REAL_RUNS_OFF` «Настоящие запуски выключены: нужна переменная SAI_TEAM_REAL_RUNS=1» |
| 3 | `request.project.budget_usd > 0` | `E_NO_BUDGET` «У проекта нет потолка стоимости: настоящий запуск без потолка запрещён» |
| 3а | (r2, замечание 2) `lstat(request.limits.work_dir)`: обычная папка, не ссылка; проверяет сам `check`, **до** условия 4 | `E_WORK_DIR` «Рабочая папка проекта недоступна» |
| 4 | `checkBudget(request)` (п. 3.2): `limits.max_budget_usd` — число > 1e-6 и ≤ `budget_usd − spent_usd` (с точностью 1e-6) | `E_BUDGET_EXHAUSTED` «Потолок расходов проекта исчерпан: запуск не начат» |

Защита в той же операции: `run` сам вызывает `check` и только затем `spawn` — обойти условия, вызвав `run` напрямую
(движок REQ-013, тест EX-09), нельзя.

### 5.2. Аргументы процесса

`buildArgs(request, config) → string[]` — чистая функция; порядок фиксирован:

| # | Аргумент | Значение | Зачем |
|---|---|---|---|
| 1 | `-p` | — | без диалога, печать и выход |
| 2 | `--output-format` `stream-json` | — | поток событий |
| 3 | `--verbose` | — | обязателен для `stream-json` с `-p` (F5) |
| 4 | `--max-budget-usd` | `formatUsd(limits.max_budget_usd)` — до 6 знаков после точки, округление вниз, без экспоненты | потолок запуска ≤ остатка |
| 5 | `--json-schema` | `JSON.stringify(answer_schema)` | схема ответа |
| 6 | `--tools` | `toolsForRole(role, config).join(",")` | набор **доступных** инструментов |
| 7 | `--allowedTools` | та же строка | те же инструменты без вопроса разрешения |
| 8 | `--disallowedTools` | только при WebFetch в наборе: `WebFetch(domain:localhost),WebFetch(domain:127.0.0.1),WebFetch(domain:[::1]),WebFetch(domain:0.0.0.0),WebFetch(domain:169.254.169.254)` | запрещающие правила Q11 (форма — F4) |
| 9 | `--permission-prompts` `none` | — | всё, что потребовало бы разрешения, отклоняется (F3) |
| 10 | `--restricted` | — | файловые инструменты — только в рабочей папке; без Bash; без чужих настроек (F3) |
| 11 | `--safe-mode` | — | без CLAUDE.md, hooks, skills, plugins, MCP, своих агентов владельца (F3) |
| 12 | `--strict-mcp-config` | — | MCP-серверы только из `--mcp-config` (его нет — значит, ни одного) |
| 13 | `--no-session-persistence` | — | сессия не сохраняется на диск (текст задачи не остаётся в файлах Claude Code) |
| 14 | `--append-system-prompt` | `role.internal.prompt` | промт роли (п. 7) |

Значения-списки передаются **одним** аргументом через запятую: переменные опции `<tools...>` не могут «съесть» следующий
аргумент, а позиционного аргумента-подсказки нет (текст — stdin). Не передаются никогда: `--add-dir`,
`--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, `--permission-mode` (любой), `--bare` (ломает вход
по подписке: F3 «auth is strictly ANTHROPIC_API_KEY»), `--agents`, `--agent`, `--mcp-config`, `--plugin-dir`, `--plugin-url`,
`--settings`, `--worktree`, `--bg`, `--resume`, `--continue`, `--model`, `--file`, `--cloud`. Совместимость флагов 9–13 между
собой без настоящего запуска не проверить — I4, UAT (критерий 14).

### 5.3. Процесс, окружение, ввод

- `spawn(config.claudeBin, args, { cwd: limits.work_dir, env: childEnv, stdio: ["pipe", "pipe", "pipe"], shell: false,
  detached: true, windowsHide: true })`. `shell: false` пишется явно (критерий 4); `detached: true` даёт процессу свою группу
  — по ней убивается дерево (п. 5.6). Никаких `exec`, `execSync`, `execFileSync`, `spawnSync` в `tools/src/team/`.
- `cwd` — ровно `writer.workDir` своего проекта (`<HOME>/<id>/work`); перед `spawn` — `lstat`: обычная папка, не ссылка,
  иначе `E_WORK_DIR` «Рабочая папка проекта недоступна». Проверка — условие 3а `check` (п. 5.1; r2, замечание 2), до `RUN_STARTED`,
  ничего не записано; `run` повторяет её сам непосредственно перед `spawn` (защита в той же операции): если папка пропала
  между `check` и `spawn`, это путь шага 6.3 п. 8.2 (`RUN_FINISHED failed`, `TASK_FAILED`). У `scripted` условия 3а нет (процесса и `cwd` нет).
- `childEnv` — **только** имена из списка `CHILD_ENV_ALLOW = ["PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL",
  "LC_CTYPE", "TMPDIR", "TZ", "CLAUDE_CONFIG_DIR"]`, взятые из `io.env`, если заданы. Не передаются: `ANTHROPIC_API_KEY`
  и любые другие ключи и токены, все `SAI_TEAM_*`, `SAI_TEST_*`. Значения не пишутся никуда. Вход Claude Code — по
  подписке владельца (его папка настроек по `HOME`/`CLAUDE_CONFIG_DIR`); запасной вариант по ключу API — отдельное
  требование (D-B).
- stdin: `buildPrompt(request)` записывается целиком в UTF-8 и закрывается (`end`). Ошибка записи в stdin (`EPIPE`, процесс
  умер) — не исключение, а сбой попытки (итог по выходу процесса).
- stdout читается построчно (`\n`) в разборщик п. 5.4; одна строка ≤ 8 MiB, весь вывод ≤ 64 MiB — больше: убить дерево,
  `invalid_output` «Ответ исполнителя слишком большой». stderr: хранятся только последние 4 KiB в памяти, **не пишутся** ни в
  журнал, ни в вывод (там могут быть пути и служебное); `detail` — только постоянные тексты.
- `spawn` даёт `error` с `ENOENT`/`EACCES`/`ENOTDIR` — `outcome: "not_found"`, `transient: false`, `spawned: false`,
  `detail` «Исполнитель не найден: проверьте SAI_TEAM_CLAUDE_BIN».

### 5.4. Разбор `stream-json` (`executors/stream.js`) — «по форме с запасом»

Формат установлен по справке 2.1.289 и по наличию имён полей в установленном файле (F3, F5, F6). Документации вложенности в
пакете нет; поэтому разборщик проверяет только то, без чего нельзя, а всё прочее пропускает и считает (I4). Каждое поле,
которое читает код и которое встречается в образцах, — из списка F6.

`createStreamParser() → { push(line: string): ParsedLine, finish(): StreamSummary }` — чистая, без Node API.

| Строка | Как распознаётся | Что делает |
|---|---|---|
| не JSON или не объект | `JSON.parse` бросает / не объект | `broken += 1`; итог попытки — `invalid_output` «Исполнитель прислал неверный вывод» (временный сбой); разбор продолжается до конца процесса |
| без строкового `type` | — | то же, что не JSON |
| `type: "system"` | любое `subtype` (в том числе `"init"`) | пропускается (служебное), `skipped += 1` |
| `type: "assistant"` | `message.content` — массив; иначе пропуск и счёт | для каждого элемента: `type: "tool_use"` с `name` — запомнить `id → name`, событие активности по таблице п. 5.5, `text: null`; `type: "text"` с `text` — `thinking` с этим текстом (обрезка `prepareText` до 2000); прочее — пропуск |
| `type: "user"` | `message.content` — массив | элемент `type: "tool_result"` с `is_error === true` и `tool_use_id`, чей `name` — `WebFetch` или `WebSearch`, — `webError = true`; элемент `type: "web_search_tool_result"`, у которого `content` не массив, — `webError = true`; прочее — пропуск |
| `type: "result"` | обязательны: `subtype` — строка, `is_error` — логическое; второе `result` — `broken` | запомнить итог: `subtype`, `is_error`, `cost` = `total_cost_usd`, если конечное число ≥ 0 (иначе `null`), `answer` = `structured_output`, если объект; иначе `JSON.parse(result)`, если `result` — строка с JSON-объектом; иначе `null` |
| любой другой `type` | — | пропуск, `skipped += 1`, задача не падает (критерий 6) |

`StreamSummary = { lines, skipped, broken, webError, result: { subtype, is_error, cost, answer } | null }`.

Итог попытки (`claude-cli.js`, после выхода процесса и закрытия stdout):

| Условие (по порядку) | `outcome` | `transient` |
|---|---|---|
| отмена (`signal`) | `cancelled` | нет |
| таймаут | `timeout` | да |
| (r6, M1) вывод больше предела (п. 5.3: строка > 8 MiB или весь вывод > 64 MiB) | `invalid_output` (`detail` `too_big`) | да |
| `broken > 0` или `result = null` | `invalid_output` (если `webError` — `network`) | да |
| код выхода ≠ 0, или `result.is_error`, или `result.subtype ≠ "success"` | `network`, если `webError`, иначе `failed` | да |
| `answer = null` или `checkAnswer` не прошёл | `invalid_output` | да |
| иначе | `ok` | — |

**Поправка «группа не ушла» (r6, M1; по коду `claude-cli.js`).** Если процессы попытки не удалось остановить (`groupStuck`,
п. 5.6: `stopGroup` вернул `false` или потоки закрыты принудительно по ограниченному ожиданию), то после таблицы:
`detail = FAIL_DETAIL.group`, `transient = false` (повтора нет — процессы прежней попытки могут быть живы; п. 8.3), `outcome`
из таблицы сохраняется; **итог `ok` превращается в `failed`** (ответ прошёл схему, но результат попытки, процессы которой не
остановлены, не принимается: ни файлов, ни памяти, ни `TASK_REVIEW`). Тесты поправки — п. 15.1, строки `exec-findings` (тесты «a descendant outside the group…», «the same
with a long timeout…», «the task with such a descendant…») и `exec-group` (r7: «`ok` → `failed`», ответ вне схемы и битый поток при неостановленной группе, контроль).

`cost_usd` = `result.cost` при любом `outcome`, если итоговая строка пришла; иначе `null`. `result.cost` разборщик берёт
только как конечное число ≥ 0 (иначе `null`, строка `result` таблицы выше; тест «the parser takes a cost only when it is a
finite number >= 0…» `exec-findings`). Сколько из него записать в журнал, решает `runner` (`recordableCost`, п. 8.4; r6, M1):
слишком большое число — тоже «не пришёл».
Правило сбоя сети не зависит от текста ошибки (его форма в справке не описана): достаточно ошибки результата инструмента
WebFetch/WebSearch и неуспеха попытки (критерий 9).

### 5.5. Поток → активность

| Наблюдение | `activity` | `text` |
|---|---|---|
| `tool_use` `Read`, `Glob`, `Grep` | `reading` | `null` |
| `tool_use` `WebSearch`, `WebFetch` | `searching` | `null` (адреса и запросы не пишутся: они из текста модели) |
| `tool_use` `Write`, `Edit` | `writing` | `null` |
| `tool_use` другое имя | `other` | `null` |
| `text` ассистента | `thinking` | текст, обрезанный до 2000 (ядро маскирует — критерий 12) |

Не больше `ACTIVITY_MAX = 300` событий на попытку; дальше `dropped_activities += 1`, событие не пишется (защита журнала от
разрастания; число видно в `stats`, в журнал не идёт — поля нет).

### 5.6. Таймаут, отмена, дерево процессов (`executors/proc.js`)

| Функция | Что |
|---|---|
| `signalGroup(pid, sig) → void` | `process.kill(-pid, sig)`; `ESRCH` — тихо (группа уже ушла) |
| `groupAlive(pid) → boolean` | `process.kill(-pid, 0)`: нет ошибки или `EPERM` — жива; `ESRCH` — нет |
| `stopGroup(pid, { graceMs, waitMs }) → Promise<boolean>` | `SIGTERM` группе; через `graceMs` — `SIGKILL` группе; ждать `groupAlive = false` не дольше `waitMs` (опрос 50 мс); `false` — группа не ушла |

- Таймер `limits.timeout_ms` с момента `spawn`; срабатывание, `signal.abort` или слишком большой вывод (п. 5.3) → `stopGroup`
  (один раз за попытку); `run` разрешается **только после** закрытия потоков процесса (событие `close` или принудительное
  закрытие ниже) и завершения `stopGroup` (если он вызывался). Поэтому у задачи никогда нет двух процессов **в группе**:
  следующая попытка начинается после разрешения `run` (п. 8.2).
- (r6, M1) **Оставшаяся группа после штатного выхода.** Процесс вышел (событие `exit`), а в его группе ещё есть процессы
  (`groupAlive(pid)`) — `stopGroup` вызывается и для них (F15: потомок в группе после возврата `run` не жив); итог попытки
  по-прежнему по таблице п. 5.4, если группа ушла.
- (r6, M1) **Ограниченное ожидание закрытия потоков.** После `exit` `run` ждёт события `close` не дольше `GROUP_GONE_WAIT_MS`;
  если вызывался `stopGroup`, то после его завершения — ещё не дольше `CLOSE_GRACE_MS` = 500 мс (остаток вывода). Не дождался
  (stdout держит открытым потомок, вышедший из группы, или группа не ушла) — **принудительное закрытие**: потоки stdin,
  stdout, stderr процесса закрываются (`destroy`), `groupStuck = true`, `run` возвращается без ожидания этого потомка.
  `groupStuck` даёт поправку «группа не ушла» п. 5.4: `detail` `group`, `transient: false`, `ok` → `failed`.
- Группа не ушла за `GROUP_GONE_WAIT_MS` (после `SIGKILL`) — то же: `groupStuck`, `RunResult.detail` «Не удалось остановить
  процессы исполнителя», `outcome` тот же (`timeout`/`cancelled`/…, `ok` → `failed`); `runner` дальше **не** повторяет задачу
  (`transient: false`), чтобы не было двух процессов (п. 8.3: `TASK_FAILED {retries_exhausted, detail: group}`).
- Тесты (r6, M1; `exec-findings.test.js`, поддельный файл `fake-claude-probe.js`, режим `orphan-stdout`: потомок в **другой**
  группе держит stdout, процесс сразу выходит): «a descendant outside the group that keeps stdout: run() returns at the
  timeout, with the detail 'group'…» (таймаут 1,5 с: `run` < 5 с, `timeout`, `group`, `transient: false`); «the same with a long
  timeout: run() returns after the bounded wait…» (таймаут 60 с: `run` < 10 с, `group`, `transient: false`, не `ok`); «the task
  with such a descendant: one run, no retry, TASK_FAILED with the text of the group…» (`run-task`: один `RUN_STARTED`, `TASK_RETRY`
  нет, `TASK_FAILED {retries_exhausted, FAIL_DETAIL.group}`, stderr `E_TASK_FAILED: … Не удалось остановить процессы
  исполнителя`). Остановка оставшейся группы при таймауте — EX-22, EX-23. Остановка оставшейся группы после **штатного**
  выхода и «`ok` → `failed`» — тесты `exec-group.test.js` (r7, п. 15.1; проверены также пробой F15).
- Остаточный риск (README, P-предложение): потомок, вышедший из группы (`setsid`), не убивается (после принудительного
  закрытия потоков он живёт до своего конца — F15); при `kill -9` самого
  `run-task` процесс Claude Code продолжает работу до своего конца (его ограничивает `--max-budget-usd`), а следующий писатель
  закрывает запуск как `interrupted` (восстановление ядра п. 6.3).

## 6. Тестовый исполнитель `scripted` (`executors/scripted.js`)

Только для тестов. Сценарий — **только** из копии в папке проекта (`writer.scenarioPath`, `scenario.json`); исходные файлы
лежат в `tools/test/fixtures/team/scenario-*.json`. В `tools/src/team/` нет ни одного сценария, имени файла сценария и пути
`fixtures/team` (критерий 2).

### 6.1. Проверки до запуска (`check`)

`project.executor === "scripted"` (иначе `E_EXECUTOR`); `scenario_path` не `null`, файл читается **ровно одним способом (r2,
замечание 1)**: `fs.lstatSync(путь)` — обычный файл (не ссылка, не папка), размер ≤ `SCENARIO_BYTES_MAX`; затем
`fs.readFileSync(путь, { flag: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW })` без кодировки → `Buffer` (на Node 22
ссылка даёт `ELOOP`; проверено воротами r1 на 22.21.1), длина `Buffer` ≤ `SCENARIO_BYTES_MAX`; любая ошибка чтения
(`ENOENT`, `ELOOP`, `EACCES`, папка) — отказ ниже; `openSync`/`open` в `scripted.js` не используются, строгий UTF-8, JSON по форме п. 6.2 — иначе `E_SCENARIO` «Сценарий тестового исполнителя не
найден или неверен». Условий настоящих запусков (`SAI_TEAM_REAL_RUNS`, потолок > 0) у scripted нет (он не ходит вовне и
ничего не тратит); последним шагом — `checkBudget(request)` (п. 3.2; r1, замечание 2): у проекта с потолком > 0 остаток
учитывается так же, как у claude-cli, и отказ `E_BUDGET_EXHAUSTED` даёт ту же строку `RUN_REFUSED` у вызывающего.

### 6.2. Форма сценария

```
Scenario = { version: 1, runs: ScenarioRun[] (1…200) }
ScenarioRun = {
  match:  { role?: <код роли>, purpose?: "work"|"review"|"plan"|"goal_check", task?: "t-NNNN", attempt?: int ≥1 },
  steps:  Step[] (0…100),
  result: { outcome: "ok"|"failed"|"timeout"|"network"|"invalid_output", answer?: object, cost_usd?: number ≥0,
            files?: { name: <имя по NAME_PATTERN ядра>, content: string ≤ 1 MiB, kind?: "result"|"draft" }[] (0…50) },
}
Step = { activity: <код активности>, text?: string|null }
     | { delay_ms: int 0…60000 }
     | { record_input: <имя по NAME_PATTERN ядра> }      // файл результата в памяти с текстом buildPrompt(request) (для REQ-013)
```

Выбор: первая запись `runs`, у которой все заданные поля `match` равны запросу. Нет подходящей — `outcome: "failed"`,
`detail` «В сценарии нет шага для этой задачи», `transient: true`. Шаги выполняются по порядку: `activity` — `onEvent`;
`delay_ms` — пауза, прерываемая `signal` (тогда `cancelled`).

**scripted ничего не пишет на диск (r1, замечание 4; решение ORCH).** Ни `work/`, ни других файлов: в
`executors/scripted.js` нет ни одного вызова записи `fs` (`writeFile*`, `mkdir*`, `open*` на запись, `rename*`, `unlink*`,
`link*`, `copyFile*`) и нет ни `openSync`, ни `open` вообще — единственное обращение к диску за сценарием — `readFileSync`
с флагом `O_RDONLY|O_NOFOLLOW` (п. 6.1; r2, замечание 1). Файлы результата scripted — **в памяти**: `RunResult.outputs` при `ok` =
`record_input` (имя, байты `buildPrompt(request)` в UTF-8, `kind: "result"`) по порядку шагов, затем `result.files` (имя,
байты `content` в UTF-8, `kind` или `"result"`). Имена в `outputs` не повторяются (повтор — `parseScenario` отказывает
`E_SCENARIO`; повтор с `record_input` — `invalid_output` «Ответ исполнителя не соответствует схеме»). `RunResult.files` у
scripted всегда `[]`, а `answer.files` сценария обязан быть `[]` (иначе `invalid_output` — scripted не называет файлов в
`work/`). Принимает файлы движок/`runner` ядерной функцией `writer.importResultBytes` (п. 8.5) — единственное место
записи файла результата в ядре (п. 6.8 ядра). При `outcome ≠ ok` `outputs = []`.

`result.answer` проверяется `checkAnswer` так же, как у claude-cli (ответ вне схемы — `invalid_output`). `result.outcome:
"timeout"` — без настоящего ожидания. `cost_usd` задан — он и есть расход (`reported`); нет — `null` (правило п. 8.4).
`spawned` — всегда `true` (попытка выполнена), `executor: "scripted"`.

### 6.3. Честная пометка

- `PROJECT_CREATED.executor = "scripted"`, `RUN_STARTED.executor`, `AGENT_ACTIVITY.executor`, `MEMORY_ADDED.executor` — все
  `scripted` (И12 ядра).
- Фразы: ядро добавляет `SCRIPTED_SUFFIX` « — тестовый исполнитель» ко всем фразам `TASK_*`, `RUN_*`, `AGENT_ACTIVITY` и (r5, F9)
  `MEMORY_ADDED` проекта scripted. Это правка ядра для BACKEND-DEV, не этого проекта: `hasScriptedSuffix` в `tools/src/team/language.js`
  получает ещё `type === "MEMORY_ADDED"`; вместе с ней меняются `tools/test/team-language.test.js` (`SUFFIXED` и проверка «остальные без
  суффикса», TM-38), `docs/design/REQ-009-team-core.md` п. 8.6 («Правила таблицы») и EX-04. `BUDGET_SPENT` — без пометки (r6, L7: решение ORCH, I10 —
  событие числовое, пометка «тестовый исполнитель» стоит у фраз задач, запусков, активности и памяти; EX-04 не меняется). Первое событие ENGINE после `run-task` — `TASK_STARTED`, его фраза оканчивается суффиксом (критерий 2).
- Вывод `new` у scripted: `executor: "scripted"` и `executor_note: "тестовый исполнитель — только для тестов"`.
- Слова-признаки «scripted назван настоящим» (проверка EX-04, EX-06, без учёта регистра): «настоящий», «реальный»,
  «Claude», «ИИ», «AI», «демо», «demo», «демонстрац».

## 7. Внутреннее соответствие ролей (`role-internal.js`)

Один файл данных: `ROLE_INTERNAL = { [code]: { prompt: string, tools: string[] } }`, заморожен, ровно 10 ключей — коды
каталога ядра. `roles.js` заполняет `Role.internal` из него (у каждой роли `prompt` и `tools` не пустые). Секретов, путей и
адресов в промтах нет. Пользователю не показывается: `view.js` и `language.js` берут роль только через `publicRole` (ядро).

`toolsForRole(role, config)`: `role.internal.tools`, а у `researcher` при `config.web === false` — без `WebSearch` и
`WebFetch`. Других изменений набора нет.

| Код | Инструменты | Промт (дописывается к системному, `--append-system-prompt`) |
|---|---|---|
| `project_manager` | Read, Write, Edit, Glob, Grep | Ты — руководитель проекта в небольшой команде. Разбивай цель на понятные задачи, следи за зависимостями и сроками, пиши кратко и по делу. Работай только с файлами в текущей папке и ничего не отправляй вовне. |
| `business_analyst` | Read, Write, Edit, Glob, Grep | Ты — бизнес-аналитик. Изучи данные и процессы, опиши, что нужно сделать и почему, с проверяемыми критериями. Работай только с файлами в текущей папке. |
| `researcher` | Read, Write, Edit, Glob, Grep, WebSearch, WebFetch | Ты — исследователь. Собирай сведения из открытых источников, у каждого факта указывай источник и дату проверки, отделяй факты от выводов. Сеть — только для чтения; не открывай адреса локальной сети. Результат сохраняй файлами в текущей папке. |
| `financial_analyst` | Read, Write, Edit, Glob, Grep | Ты — финансовый аналитик. Считай расходы, доходы, цены и окупаемость, показывай формулы и допущения. Работай только с файлами в текущей папке. |
| `lawyer` | Read, Write, Edit, Glob, Grep | Ты — юрист. Проверяй условия и правовые риски, называй, что требует проверки специалистом. Ничего не подписывай и не отправляй. Работай только с файлами в текущей папке. |
| `marketer` | Read, Write, Edit, Glob, Grep | Ты — маркетолог. Готовь позиционирование, тексты и план продвижения для указанной аудитории. Ничего не публикуй — только черновики в текущей папке. |
| `designer` | Read, Write, Edit, Glob, Grep | Ты — дизайнер. Предлагай оформление и структуру материалов текстом (описания макетов, разметка). Работай только с текстовыми файлами в текущей папке. |
| `developer` | Read, Write, Edit, Glob, Grep | Ты — разработчик. Готовь технические решения и их описания текстом, без запуска команд. Работай только с файлами в текущей папке. |
| `reviewer` | Read, Write, Edit, Glob, Grep | Ты — проверяющий. Сверяй результат с критерием готовности строго и по пунктам, называй каждое расхождение. Работай только с файлами в текущей папке. |
| `support` | Read, Write, Edit, Glob, Grep | Ты — специалист поддержки. Готовь вежливые понятные ответы клиентам и инструкции. Ничего не отправляй — только черновики в текущей папке. |

(Тексты — данные для BACKEND-DEV, переносятся дословно. Ни одного слова из списка п. 6.3 «демо/demo/демонстрац» в них нет.)
Ограничение «только текущая папка» обеспечивает не текст промта, а `--restricted` (F3) и `cwd = work/`; текст — подсказка
модели. Дизайнер работает текстом: из `work/` принимаются только UTF-8 файлы (0017, P9).

## 8. Одна задача: `runTask` (`runner.js`)

### 8.1. Сигнатура

```
runTask(writer: Writer, taskId: string, opts: { env, config, signal, spawn?, sleep?, context? }) → Promise<RunTaskResult>
RunTaskResult = { status: "review" | "failed" | "interrupted" | "refused", task: TaskView, last_outcome, attempts,
                  spent_usd, budget_usd, run, error: TeamError | null }
maxBudgetFor(state, config) → number | null          // (r6, L5) п. 8.4
recordableCost(raw) → number | null                   // (r6, M1) п. 8.4
failDetailFor(runResult) → ключ FAIL_DETAIL           // п. 8.3
```

`sleep` по умолчанию — `abortablePause` из `common.js` (r6, L5).

`context` по умолчанию: `goal` проекта, вся `state.memory` (последние 50 записей), `deps` — файлы результатов задач из
`depends_on` (в REQ-010 у задач `add-task` зависимостей нет; движок REQ-013 подаёт свои), `note: null`.

### 8.2. Шаги (всё под одним писателем; ни одной записи, пока не прошли проверки 1–4)

1. Задача есть (`E_TASK_NOT_FOUND`); её статус — `waiting`, `interrupted` или `failed` (иначе `E_TASK_STATE` «Задачу сейчас
   нельзя запустить: <текст статуса>»); все `depends_on` в `done` (иначе `E_TASK_STATE` «…ждёт результат других задач»).
2. Статус проекта — `created`, `running` или `waiting_user` (иначе `E_PROJECT_STATE` «Проект на паузе или завершён»).
3. Исполнитель `getExecutor(state.executor)`; `request` первой попытки: `limits.max_budget_usd = maxBudgetFor(state, config)`
   (п. 8.4); `executor.check(request, io)` — все условия по порядку: п. 5.1 (claude-cli: 1 `E_EXECUTOR`, 2
   `E_REAL_RUNS_OFF`, 3 `E_NO_BUDGET`, 3а `E_WORK_DIR`, 4 `E_BUDGET_EXHAUSTED`) или п. 6.1 (scripted: `E_EXECUTOR`, `E_SCENARIO`,
   `E_BUDGET_EXHAUSTED`) — `E_WORK_DIR` проверяет `check` (3а, до бюджета; r2, замечание 2), `runner` её не дублирует. Любой отказ, **кроме** `E_BUDGET_EXHAUSTED`, — ничего не записано,
   процесс не создан, ошибка наверх (код 1).
4. Отказ `E_BUDGET_EXHAUSTED` на шаге 3 (r1, замечание 2) — `runner` пишет **одну** строку `RUN_REFUSED {reason:
   "budget_exhausted", detail:"Потолок расходов исчерпан"}` (задача в `waiting`/`interrupted`/`failed` — И18) и отдаёт
   ошибку наверх: `E_BUDGET_EXHAUSTED`, код 1. Журнал получает **только** это событие (критерий 11, EX-32). Порядок
   условий даёт однозначность: при выключенных запусках, потолке 0 или недоступной рабочей папке отказ случается раньше (условия 2–3, 3а, без события),
   до условия 4 выполнение не доходит; при включённых запусках и потолке > 0 с остатком ≤ 1e-6 `maxBudgetFor` даёт 0 и
   отказывает условие 4.
5. `TASK_STARTED`.
6. Попытка `n = 1, 2, 3` (для `n ≥ 2` попытка начинается только после решения шага 6.5 «повтор будет»):
   1. `request.limits.max_budget_usd = maxBudgetFor(state, config)` (п. 8.4) — для `n = 1` уже проверено на шаге 3, для `n ≥ 2` —
      на шаге 6.5 до `TASK_RETRY`;
   2. `RUN_STARTED {…, max_budget_usd}`;
   3. `await executor.run(request, io)` — `onEvent` пишет `AGENT_ACTIVITY` сразу. Если `run` всё же бросил `TeamError` до
      старта (условие изменилось между шагом 3 и вызовом — в одном писателе не бывает, но защита внутри `run` есть) —
      `RUN_FINISHED {failed, summary:null, cost_usd:null, files:[]}` (без `BUDGET_SPENT`: процесса не было), при
      `E_BUDGET_EXHAUSTED` — `RUN_REFUSED`, затем `TASK_FAILED {retries_exhausted, detail: FAIL_DETAIL.budget}`, иначе
      `TASK_FAILED {retries_exhausted, detail: FAIL_DETAIL.failed}`; ошибка наверх, код 1;
   4. итог `ok` → п. 8.5 (файлы, память), затем `RUN_FINISHED {ok, summary, cost_usd, files}`, `BUDGET_SPENT`, `TASK_REVIEW`
      → `status: "review"`, код 0;
   5. иначе `RUN_FINISHED {outcome, summary:null, cost_usd, files:[]}`; `BUDGET_SPENT`, если `spawned` (п. 8.4); затем
      **решение о повторе — до любой записи о нём** (r1, замечание 3):
      - `not_found` → `TASK_FAILED {executor_not_found, detail: FAIL_DETAIL.not_found}`, код 1 (`E_EXECUTOR_NOT_FOUND`),
        без повторов;
      - `cancelled` → `TASK_INTERRUPTED {cause:"cancel"}`, код 1 (`E_TASK_CANCELLED`);
      - `transient`, `n < 3` и `checkBudget` для следующей попытки проходит (запрос с `max_budget_usd = maxBudgetFor(state, config)`
        **после** `BUDGET_SPENT` этой попытки) → **повтор будет**: `TASK_RETRY {next_attempt: n+1, delay_ms:
        config.retryDelayMs, reason}` (`reason` = `outcome`: `failed` / `timeout` / `invalid_output` / `network`), пауза
        `delay_ms` (прерываемая `signal`: тогда `TASK_INTERRUPTED {cancel}`, код 1), следующая попытка;
      - `transient`, `n < 3`, но `checkBudget` отказал → **повтора не будет**, `TASK_RETRY` не пишется: `RUN_REFUSED
        {budget_exhausted, detail:"Потолок расходов исчерпан"}`, затем `TASK_FAILED {retries_exhausted, detail:
        FAIL_DETAIL.budget}`, код 1 (`E_TASK_FAILED`), процесса больше нет;
      - иначе (`n = 3` или не `transient`) → **повтора не будет**: `TASK_FAILED {reason, detail}` по таблице п. 8.3, код 1
        (`E_TASK_FAILED`).

   Так событие, обещающее повтор (`TASK_RETRY`, фраза «{name} попробует ещё раз»), пишется только когда следующая попытка
   действительно начнётся (если её не прервёт отмена пользователя); фраза `RUN_FINISHED` о сбое повтора не обещает (п. 8.6).
7. Любой `TeamError` записи (`E_DISK`, `E_WRITER_BROKEN`, `E_LOCK_LOST`) — остановка: (r6, L1) если запись не удалась во время
   попытки (`AGENT_ACTIVITY`), `runner` прерывает попытку её сигналом (`abort`), и `run` сам останавливает группу (п. 5.6) и
   возвращается только после этого; `runner` сам `stopGroup` не вызывает. Ошибка наверх (`runGuarded` → код 1) — после шага 8
   (r3: прежнее «больше ничего не пишется» относится только к сломанному писателю; у несломанного шаг 8 закрывает запуск).
8. **(r3, решения ORCH (2), (3); И22 ядра) Закрытие запуска на всех путях выхода.** `runTask` помнит один «открытый запуск»
   `{run_id, max_budget_usd, result | null}`: он появляется после успешной записи `RUN_STARTED` и исчезает после успешной записи
   `RUN_FINISHED` (`result` — итог `executor.run`, пока он не вернулся — `null`). Любой выход `runTask` **с ошибкой** (`throw`):
   исключение `executor.run` **не типа `TeamError`** (в шаге 6.3 прежде пробрасывалось без записи); ошибка приёма результата п. 8.5
   (`acceptResult`), не являющаяся отказом файла п. 8.5 (например выброс `TypeError` при записи `.partial`; `E_DISK` при записи файла несломанного писателя сюда не относится — это отказ `result_disk` п. 8.5, шаг 3); ошибка записи
   `AGENT_ACTIVITY` (`writeError`); `TeamError` записи шага 7; любая другая — обрабатывается блоком `finally` **до** проброса
   (функция `closeAfterError` в `runner.js`, не бросает):
   1. (r6, L1) процессов исполнителя к этому моменту нет: `finally` срабатывает после того, как `run` вернулся или отказал
      до старта, а `run` возвращается только после ухода группы (п. 5.6; при сбое записи — по сигналу, шаг 7); `stopGroup` в
      `finally` не вызывается;
   2. если открытый запуск есть и писатель не сломан — `RUN_FINISHED {run_id, outcome:"failed", summary:null, cost_usd:
      recordableCost(result.cost_usd) | null, files:[]}`; если `executor.run` вернулся (`result ≠ null`), то далее `BUDGET_SPENT`
      по п. 8.4 (`spawned`; расход не теряется), если нет — `BUDGET_SPENT` нет (итога и расхода нет). Исход `failed`, а не
      `interrupted`: `interrupted` пишет только ядро (N4);
   3. если задача после этого `running` — `TASK_FAILED`: при ошибке приёма результата (`acceptResult`) `{result_file,
      FAIL_DETAIL.result_file}` (r6, L1: ветки `E_DISK` → `result_disk` здесь нет — она была недостижима и удалена решением ORCH,
      I9; `E_DISK` несломанного писателя при приёме — отказ п. 8.5, шаг 3, а `E_DISK` сломанного — запись закрытия невозможна,
      шаг 8.4); при остальных ошибках `{retries_exhausted, FAIL_DETAIL.failed}` (иначе задача `running` без запуска осталась
      бы навсегда: `run-task` её не запускает — шаг 1; I7);
   4. **запись шагов 2–3 не удалась** (любая причина, в том числе `E_WRITER_BROKEN` у уже сломанного писателя) — остальное не
      пишется, вызывается `writer.markBroken()` (проект ядра r6, п. 6.4): писатель считается сломанным, `close()` оставляет замок, проект
      восстановит следующий открывающий (ядро п. 6.3, шаг 8: `RUN_FINISHED interrupted`, `TASK_INTERRUPTED`, `PROJECT_RECOVERED`);
   5. **исходная ошибка** летит наверх без изменения (ошибка закрытия её не заменяет и не скрывает); текст и код выхода те же,
      что были бы без шага 8 (`runGuarded`: `TeamError` → код 1, иное → `E_INTERNAL`, код 3).
   Пути с `return` (шаги 4, 6.4, 6.5: `ok`, `failed`, `refused`, `interrupted`) запуск закрывают сами и шага 8 не касаются.
   Итог: после `runTask` и `writer.close()` несломанного писателя открытых запусков нет (И22 ядра); сломанного — замок остался.

### 8.3. Временные и постоянные сбои

Причины `TASK_FAILED` — **только** из каталога ядра (F11): `retries_exhausted`, `executor_not_found`, `invalid_output`,
`result_file` (`rejected_by_user` — REQ-013). Новых причин нет; различие (сеть, потолок, таймаут, …) — в `detail`, который
берётся **только** из замороженной таблицы `FAIL_DETAIL` (экспорт `language.js`, п. 8.6; r1, замечание 3). `detail` идёт
в `TASK_FAILED.detail` и в stderr `E_TASK_FAILED: Задача не получилась: <detail>`.

| Последний `outcome` (или случай) | Повтор | `TASK_FAILED.reason` | `detail` (`FAIL_DETAIL.<ключ>` = текст) |
|---|---|---|---|
| `failed` (выход с ошибкой, ошибка в итоге) | да | `retries_exhausted` | `failed` = «Исполнитель завершился с ошибкой» |
| `timeout` | да | `retries_exhausted` | `timeout` = «Задача заняла слишком много времени» |
| `invalid_output` (не JSON, нет итога, ответ вне схемы, слишком большой вывод) | да | `invalid_output` | `RunResult.detail` последней попытки — один из `invalid_output` = «Исполнитель прислал неверный вывод», `schema` = «Ответ исполнителя не соответствует схеме», `too_big` = «Ответ исполнителя слишком большой» |
| `network` (ошибка WebFetch/WebSearch + неуспех) | да | `retries_exhausted` | `network` = «Нет доступа к сети» |
| потолок кончился между попытками (шаг 6.5) | — (не начат) | `retries_exhausted` | `budget` = «Потолок расходов исчерпан: повтор не начат» |
| `not_found` | нет | `executor_not_found` | `not_found` = «Исполнитель не найден: проверьте SAI_TEAM_CLAUDE_BIN» |
| `cancelled` | нет | — (`TASK_INTERRUPTED cancel`) | — |
| файл результата отклонён ядром | нет | `result_file` | `result_file` = «Файл результата не найден в рабочей папке или недопустим» / `result_disk` = «Не удалось записать файл результата на диск» |
| группа процессов не остановилась | нет | `retries_exhausted` | `group` = «Не удалось остановить процессы исполнителя» |

`detail` выбирается по `outcome` **последней** попытки (пример: сеть, сеть, таймаут — `timeout`). **Исключение с приоритетом
(r2, замечание 3):** если у последней попытки `RunResult.detail = FAIL_DETAIL.group` (группа процессов не ушла за
`GROUP_GONE_WAIT_MS`, в том числе после таймаута), `TASK_FAILED.detail = FAIL_DETAIL.group` — для любого `outcome`; сам `outcome`
при этом сохраняется в `RUN_FINISHED`, а `reason` остаётся `retries_exhausted`. Повтора после такой попытки нет
(процессы прежней попытки могут быть живы). Выбор — чистая функция `failDetailFor(runResult) → FAIL_DETAIL-ключ` в `runner.js` (сначала `group`, затем по `outcome`
по таблице выше). Проверка — EX-22. Попыток всегда не больше
3 (1 + `RETRIES_MAX`), событий `RUN_STARTED` на задачу за один `run-task` — не больше 3.

### 8.4. Учёт расхода

**Потолок одного запуска (r1, замечание 1; решение ORCH).** Прежнее правило «потолок попытки = весь остаток» вместе с
учётом «по худшему случаю» исключало повтор после таймаута claude-cli (критерий 8) — заменено:

```
runCapFor(project, config) = null,                                   если project.budget_usd = 0
                           = config.runCapUsd,                        если задана SAI_TEAM_RUN_CAP_USD
                           = floor6(project.budget_usd × RUN_CAP_SHARE), иначе (четверть потолка проекта)
remaining(state)           = budget_usd − spent_usd
maxBudgetFor(state, config) = null,                                   если budget_usd = 0 (только scripted; claude-cli отказал условием 3)
                           = 0,                                       если remaining ≤ 1e-6
                           = floor6(min(remaining, runCapFor(...))), иначе
```

Запуск (первый или повтор) начинается, только если `checkBudget` проходит, то есть `maxBudgetFor > 1e-6`; по построению
потолок запуска никогда не больше остатка («повтор возможен, пока остаток ≥ потолка запуска» — потолок запуска сам
уменьшается до остатка). Выбор «четверть» записан как P4 (п. 18). Пример (вымышленный): потолок проекта 1, переменная не
задана — потолок запуска 0.25; три таймаута подряд без отчёта о расходе спишут 0.75, третья попытка получит 0.25.

- **(r6, M1) Записываемый расход** — `recordableCost(RunResult.cost_usd)`: если значение — конечное число ≥ 0 и
  `ceil6(значение)` конечно и ≤ `COST_REPORTED_MAX = 1e9`, то `ceil6(значение)`; иначе (не число, `NaN`, бесконечность,
  отрицательное, округление > 1e9) — `null`, то есть «расход не пришёл» (правило ниже). Граница 1e9: до неё суммы с шестью
  знаками после точки остаются точными (`total_usd` = `spent_usd` + `cost_usd`, И8 ядра), а один запуск ограничен
  `--max-budget-usd` (≤ `BUDGET_MAX`) — большее число расходом не является. Это же значение идёт в `RUN_FINISHED.cost_usd`
  (на всех путях, в том числе в закрытии шага 8.2 п. 8). Пример (вымышленный): сообщено `5e8` — записано `500000000`
  (`reported`), следующий запуск отказан `E_BUDGET_EXHAUSTED`; сообщено `2e9` или `-1` — `RUN_FINISHED.cost_usd: null`,
  `BUDGET_SPENT {cost_usd: потолок этого запуска, accounted:"assumed"}`.
- `BUDGET_SPENT` пишется после **каждой** попытки, где процесс был запущен (`spawned`): при записываемом расходе ≠ `null` —
  `cost_usd` = он, `accounted: "reported"`.
- **Правило «расход не пришёл»** (критерий 11): если записываемый расход `null` (r6, M1: `RunResult.cost_usd = null` — нет
  итоговой строки, процесс убит по таймауту или отмене, строка без `total_cost_usd` — **или** сообщённое значение не прошло
  `recordableCost`), попытка учитывается как **потолок этого запуска** — `cost_usd =
  max_budget_usd` этой попытки (не весь остаток), `accounted: "assumed"`; если `max_budget_usd = null` (scripted без
  потолка) — `0` с `accounted: "assumed"` (видно, что расход не известен, а не «0 молча»). Правило названо в README.
- **Правило для сценариев scripted (r2; вопрос ворот r1 о REQ-013).** Запись сценария без `cost_usd` даёт `cost_usd = null` и
  по правилу выше `assumed` = потолок запуска (при `max_budget_usd = null` — `0`). Поэтому **сценарии движка REQ-013 обязаны
  задавать `cost_usd` в каждой записи `runs`** (допустимо `0`): иначе при потолке проекта > 0 четыре запуска (план, работа,
  проверка, сверка цели) спишут потолок проекта «по умолчанию». Проект REQ-013 записывает это правило в свои сценарии
  и тест; `parseScenario` REQ-010 запись без `cost_usd` принимает (для тестов REQ-010 она нужна, EX-33), не отказывает.
- `total_usd = round6(spent_usd + cost_usd)` (И8 ядра).
- `not_found` (процесс не запустился) — `BUDGET_SPENT` нет.
- Каждый следующий запуск получает `--max-budget-usd` = `maxBudgetFor` ≤ нового остатка (шаг 6.1).
- (r6, M1) Тесты записываемого расхода — `exec-findings.test.js` (п. 15.1): «a reported cost that is huge, negative or not a
  number is not a cost…» (`1e303`, `1e21`, `1e10`, `-1`, `1e999`, `-1e999`: `RUN_FINISHED.cost_usd` `null`, `BUDGET_SPENT
  {cost_usd:0.25, accounted:"assumed"}`, сумма растёт, второй запуск с `--max-budget-usd 0.25`); «a reported cost of 5e8 is
  written as it is and the next run is refused»; «recordableCost: only a finite number >= 0 whose rounding is at most 1e9»
  (граница `1e9` принята, `1e9 + 1` — `null`; нечисла, строки, `NaN`, ±бесконечность, отрицательные — `null`); «the parser
  takes a cost only when it is a finite number >= 0…» (п. 5.4).

### 8.5. Файлы результата и память при `ok`

1. Для каждого `files[i]`: `checkWorkPath(path)` ядра и `files.readWorkFile(workDir, path)` ядра (только чтение) — **все до
   первой записи**. Любой отказ (`E_WORK_FILE`: нет файла, `../x`, абсолютный путь, ссылка наружу, не UTF-8, > 5 MiB) →
   `RUN_FINISHED {failed, files: []}`, `BUDGET_SPENT`, `TASK_FAILED {result_file, «Файл результата не найден в рабочей папке
   или недопустим»}`, код 1; в `files/` ничего не записано.
2. Имя результата — `<task>-<attempt>-<последняя часть path>` (пример: `t-0001-1-report.md`); проверка `NAME_PATTERN` ядра
   (`E_FILE_NAME` → `result_file`, как выше).
3. `writer.importWorkFile({task, path, name, kind})` по очереди. Отказ ядра (`E_FILE_EXISTS`, `E_WORK_FILE`) → как в п. 1
   (`files` в `RUN_FINISHED` — уже принятые имена). Сбой диска (`E_DISK`, например EIO) → `RUN_FINISHED {failed, files:
   [принятые ранее]}`, `BUDGET_SPENT`, `TASK_FAILED {result_file, «Не удалось записать файл результата на диск»}`; команда —
   код 1 с текстом `E_DISK` ядра (критерий 15б). Если сломался писатель — п. 8.2, шаги 7–8.
4. После того как **все** файлы приняты: исходные файлы этих путей в `work/` удаляются (`fs.unlinkSync`, только проверенный
   обычный файл внутри `work/`, место записи №6) — немаскированная копия с возможным секретом не остаётся в `<HOME>`
   (критерий 16б, I3). Не названные в итоге файлы `work/` не трогаются и в `files/` не попадают.
5. `memory[i]` → `writer.addMemory({kind, text: prepareText(text, …, 4000), task, executor}, "AGENT")`.
6. **(r3)** Любая другая ошибка приёма (не отказ файла и не сбой записи файла `E_DISK` несломанного писателя из п. 3: например
   выброс не типа `TeamError` при записи `.partial`; ошибка чтения в `work/` — это `E_WORK_FILE`, отказ файла) не превращается в `result_file` молча: она
   пробрасывается, а п. 8.2, шаг 8 закрывает запуск (`RUN_FINISHED failed` с расходом, `BUDGET_SPENT`, `TASK_FAILED {result_file,
   FAIL_DETAIL.result_file}` — r6, L1); ничего из принятого не откатывается (остаточный риск ниже).

**scripted (`RunResult.outputs`, r1, замечание 4).** Шаги 1 и 4 не выполняются (в `work/` ничего нет). Для каждого
`outputs[i]` по порядку: имя результата `<task>-<attempt>-<name>` (проверка `NAME_PATTERN`; `E_FILE_NAME` → как в п. 1);
`writer.importResultBytes({task, name, bytes, kind})` ядра (п. 6.8 ядра: строгий UTF-8, маскирование, ≤ `FILE_BYTES_MAX`,
`.partial` + `linkSync`, 0600, `RESULT_FILE {from_work:false}`). Отказ ядра (`E_EVENT` «не текст» / слишком большой,
`E_FILE_NAME`, `E_FILE_EXISTS`) → `RUN_FINISHED {failed, files: [принятые ранее]}`, `BUDGET_SPENT`, `TASK_FAILED
{result_file, FAIL_DETAIL.result_file}`, код 1; `E_DISK` → как в п. 3 (`FAIL_DETAIL.result_disk`). Затем шаг 5. Код
`tools/src/team/` ни при каком исполнителе не создаёт и не меняет файлы в `work/` (единственное действие там — удаление
исходников принятых файлов claude-cli, п. 4): туда пишет только дочерний процесс claude-cli.

Остаточный риск: при сбое диска на втором из нескольких файлов первый остаётся принятым (с настоящим `RESULT_FILE`); задача
«не удалась». В тесте критерия 15 файл один.

### 8.6. Фразы сбоя и повтора (r1, замечание 3; правка `language.js`, п. 9 ядра r4)

Каталог типов и причины ядра не меняются; меняется только таблица фраз (`language.js`, чистый модуль ядра) — строки
выбираются по полям `data`, как и прежде (F12):

| Событие | Условие | Фраза (было → стало) |
|---|---|---|
| `RUN_FINISHED` | `outcome = network` | «Нет доступа к сети, попробуем ещё раз» → «Нет доступа к сети» (повтор не обещается: его объявляет только `TASK_RETRY`) |
| `TASK_RETRY` | — | без изменений: «{name} попробует ещё раз» — пишется только когда повтор решён (п. 8.2, шаг 6.5) |
| `TASK_FAILED` | `reason = retries_exhausted` и `detail = FAIL_DETAIL.network` | новая строка: «{name}: нет доступа к сети, задача не получилась» |
| `TASK_FAILED` | `reason = retries_exhausted` и `detail = FAIL_DETAIL.budget` | новая строка: «{name}: потолок расходов исчерпан, задача остановлена» |
| `TASK_FAILED` | прочее | без изменений: «{name}: задача не получилась» |

`FAIL_DETAIL` — новый экспорт `language.js`: замороженный объект ключ → текст из п. 8.3 (`failed`, `timeout`,
`invalid_output`, `schema`, `too_big`, `network`, `budget`, `not_found`, `result_file`, `result_disk`, `group`);
`runner.js` и исполнители берут тексты `detail` только из него, поэтому равенство строки — не совпадение, а один
источник. Тексты проходят маскирование ядра без изменений (в них нет признаков секрета). Новые фразы не содержат
запрещённых слов п. 9 ядра; у проекта scripted к ним добавляется `SCRIPTED_SUFFIX`. Итоговая фраза о сбое сети (критерий 9)
— фраза `TASK_FAILED` выше; EX-29 сравнивает с ней строку теста.

## 9. Команды (`npm run team -- …`, `cli.js`, все через `runGuarded` ядра)

Коды выхода — `EXIT` ядра: **0** успех; **1** отказ по существу; **2** `E_USAGE`/`E_CONFIG`; **3** `E_INTERNAL`. При ошибке
stdout пуст, stderr — одна строка `<КОД>: <сообщение>`, без стека. Все три — команды записи по правилу писателя ядра
(`E_PROJECT_BUSY`, восстановление при открытии — как у `say`).

### 9.1. `new --goal "<цель>" --budget <usd> [--executor claude-cli|scripted] [--scenario <файл>]`

| Проверка (до любой записи) | Отказ |
|---|---|
| `--goal` есть, 1…2000 кодовых точек, не только пробелы | `E_USAGE` «Нужна цель: --goal "<текст>"» / «Цель длиннее 2000 знаков» |
| `--budget` — строка `^[0-9]+(\.[0-9]{1,6})?$`, значение > 0 и ≤ 100000 | `E_USAGE` «--budget: число больше 0 и не больше 100000, до 6 знаков после точки» (0, `-1`, `x`, пусто — этот отказ) |
| `--executor` ∈ {`claude-cli`, `scripted`}; нет — `claude-cli` | `E_USAGE` «--executor: claude-cli или scripted» |
| `scripted` ⇒ `--scenario` обязателен; `claude-cli` ⇒ `--scenario` запрещён | `E_SCENARIO` «Для тестового исполнителя нужен файл сценария: --scenario <файл>» / `E_USAGE` «--scenario допустим только с --executor scripted» |
| файл сценария: путь относительно текущей папки команды (у `npm run` — `tools/`); `fs.readFileSync(путь)` без кодировки → `Buffer`; нет файла, папка, нет прав | `E_SCENARIO` «Файл сценария не найден или не читается» (код 1; путь в сообщение не выводится) |

Затем `createProject({goal, budget_usd, executor, scenario_bytes})` ядра (всё или ничего, п. 6.5 ядра; проверка JSON и UTF-8
сценария — там же, `E_EVENT`). Успех, stdout:
`{"ok":true,"project":{"id","goal","status","status_text","executor","budget_usd"[,"executor_note"]},"notices":[]}`.

### 9.2. `add-task <id> --role <код> --text "<описание>" --done-when "<критерий>"`

`--role` — код из `ROLE_CODES` (иначе `E_USAGE` «Неизвестная роль; допустимые: …» со списком **названий и кодов**). Пишет
`writer.addTask({role, text, done_when}, "USER")`. Успех: `{"ok":true,"task":{"id","role_title","text","done_when","status",
"status_text","phrase"},"notices":[…]}` — без кода роли и `internal`.

### 9.3. `run-task <id> <задача>`

`readConfig` → `openWriter` → `runTask` (п. 8) → `writer.close()` в `finally`. Обработчики `SIGTERM` и `SIGINT` на время
команды: первый сигнал — `abort()` контроллера (отмена, п. 5.6, 8.2); повторный — игнорируется; если отмена не завершилась
за 15 с — выход кодом 1 без записи (восстановление сделает следующий писатель).

Успех (код 0): `{"ok":true,"task":{"id","role_title","status":"review","status_text":"на проверке","attempts","files"},
"run":{"outcome":"ok","cost_usd","accounted"},"spent_usd","budget_usd","notices":[…]}`. Отказ (код 1): stderr по п. 10.3;
события, уже записанные до отказа, остаются (это правда о попытках).

### 9.4. Пути отказа команд

| Случай | stderr | Код | Что неизменно |
|---|---|---|---|
| `run-task` без `SAI_TEAM_REAL_RUNS=1` (claude-cli) | `E_REAL_RUNS_OFF: Настоящие запуски выключены: нужна переменная SAI_TEAM_REAL_RUNS=1` | 1 | журнал байт-в-байт; процесс не создан |
| `run-task`, проект claude-cli с потолком 0 (создан API ядра) | `E_NO_BUDGET: У проекта нет потолка стоимости: …` | 1 | то же |
| остаток ≤ 0 при `SAI_TEAM_REAL_RUNS=1` и потолке > 0 (условие 4) | `E_BUDGET_EXHAUSTED: Потолок расходов проекта исчерпан: запуск не начат` | 1 | всё, кроме одной строки `RUN_REFUSED` (её пишет `runner`); статусы |
| потолок кончился между попытками | `E_TASK_FAILED: Задача не получилась: Потолок расходов исчерпан: повтор не начат` | 1 | события попыток, `RUN_REFUSED`, `TASK_FAILED`; `TASK_RETRY` для несостоявшегося повтора нет |
| `SAI_TEAM_CLAUDE_BIN` не абсолютный / неверный таймаут, пауза или `SAI_TEAM_RUN_CAP_USD` | `E_CONFIG: Неверная настройка <ИМЯ_ПЕРЕМЕННОЙ>` | 2 | всё (до `openWriter`) |
| исполняемого файла нет | `E_EXECUTOR_NOT_FOUND: Исполнитель не найден: проверьте SAI_TEAM_CLAUDE_BIN` | 1 | записаны `TASK_STARTED`, `RUN_STARTED`, `RUN_FINISHED not_found`, `TASK_FAILED executor_not_found`; executor проекта тот же |
| 3 неудачи | `E_TASK_FAILED: Задача не получилась: <detail>` | 1 | события попыток записаны; executor тот же |
| отмена | `E_TASK_CANCELLED: Задача прервана` | 1 | процессов исполнителя нет |
| EIO на файле результата | `E_DISK: Не удалось записать на диск (EIO); данные проекта не изменены` | 1 | `files/` без файла и `.partial-*`; `RESULT_FILE` нет; прежние байты журнала те же |
| EACCES при `new` | `E_DISK: Не удалось записать на диск (EACCES); данные проекта не изменены` | 1 | `<HOME>` — пути и хеши те же; `.creating-*` нет |
| задача `done`/`running`/`review` | `E_TASK_STATE: Задачу сейчас нельзя запустить: <статус>` | 1 | всё |
| проект `paused`/конечный | `E_PROJECT_STATE: Проект на паузе или завершён` | 1 | всё |
| проект занят | `E_PROJECT_BUSY: …` (ядро) | 1 | всё |
| (r3) исключение исполнителя не `TeamError`, выброс при приёме результата (не `TeamError`), сбой записи `AGENT_ACTIVITY` | текст исходной ошибки (`E_INTERNAL` код 3 или `E_DISK` код 1), без стека | 3 / 1 | открытых запусков нет: `RUN_FINISHED failed` и `TASK_FAILED` записаны до выхода (шаг 8); если писатель сломан — замок остался, следующий `say`/`run-task` восстанавливает проект («Работа проекта прервалась — продолжите её командой возобновления»); executor проекта тот же |
| ошибка программы | `E_INTERNAL: …` | 3 | — |

## 10. Модули, экспорты, ошибки

### 10.1. Экспорты

| Файл | Экспорт |
|---|---|
| `config.js` | `readConfig(env) → Config`; `CHILD_ENV_ALLOW`; константы п. 2 |
| `role-internal.js` | `ROLE_INTERNAL` |
| `common.js` (r6, L5) | `has(obj, key)`, `isPlainObject(v)`, `abortablePause(ms, signal) → Promise<boolean>` |
| `executor.js` | `WORK_ANSWER_SCHEMA`, `checkAnswer`, `buildPrompt`, `toolsForRole`, `getExecutor`, `runCapFor`, `checkBudget`, `ACTIVITY_MAX`, `OUTCOMES`, (r6, L5) `floor6`, `ceil6`, `round6` (определены здесь) |
| `executors/stream.js` | `createStreamParser()`, `KNOWN_FIELDS` (список имён полей, которые читает разборщик, — для EX-21) |
| `executors/claude-cli.js` | `code = "claude-cli"`, `check`, `run`, `buildArgs(request, config)`, `buildChildEnv(env)`, `WEB_DENY_RULES`, `formatUsd` |
| `executors/proc.js` | `signalGroup`, `groupAlive`, `stopGroup` |
| `executors/scripted.js` | `code = "scripted"`, `check`, `run`, `parseScenario(bytes) → Scenario` |
| `runner.js` | `runTask`, `maxBudgetFor(state, config)`, (r6) `recordableCost(raw)`, `failDetailFor(runResult)`; `floor6`, `ceil6`, `round6` — только реэкспорт из `executor.js` (r6, L5) |
| `language.js` (ядро, правка r1) | + `FAIL_DETAIL` (п. 8.6) |
| `cli.js` | прежние `main`, `runGuarded` + разбор `new`, `add-task`, `run-task` |

### 10.2. Новые коды (добавляются в `errors.js`; прежние не меняются)

| Код | Выход | Сообщение |
|---|---|---|
| `E_CONFIG` | 2 | Неверная настройка <ИМЯ> |
| `E_REAL_RUNS_OFF` | 1 | Настоящие запуски выключены: нужна переменная SAI_TEAM_REAL_RUNS=1 |
| `E_NO_BUDGET` | 1 | У проекта нет потолка стоимости: настоящий запуск без потолка запрещён |
| `E_BUDGET_EXHAUSTED` | 1 | Потолок расходов проекта исчерпан: запуск не начат |
| `E_EXECUTOR` | 1 | Исполнитель задачи не совпадает с исполнителем проекта |
| `E_SCENARIO` | 1 | Сценарий тестового исполнителя не найден или неверен (у `new` — тексты п. 9.1) |
| `E_EXECUTOR_NOT_FOUND` | 1 | Исполнитель не найден: проверьте SAI_TEAM_CLAUDE_BIN |
| `E_WORK_DIR` | 1 | Рабочая папка проекта недоступна |
| `E_TASK_STATE` | 1 | Задачу сейчас нельзя запустить: <статус> |
| `E_PROJECT_STATE` | 1 | Проект на паузе или завершён |
| `E_TASK_FAILED` | 1 | Задача не получилась: <detail> |
| `E_TASK_CANCELLED` | 1 | Задача прервана |

### 10.3. Постоянные тексты `detail`

«Исполнитель завершился с ошибкой», «Задача заняла слишком много времени», «Исполнитель прислал неверный вывод», «Ответ
исполнителя не соответствует схеме», «Ответ исполнителя слишком большой», «Нет доступа к сети», «Исполнитель не найден:
проверьте SAI_TEAM_CLAUDE_BIN», «В сценарии нет шага для этой задачи», «Не удалось остановить процессы исполнителя»,
«Потолок расходов исчерпан: повтор не начат», «Файл результата не найден в рабочей папке или недопустим», «Не удалось
записать файл результата на диск». В `detail` никогда нет stderr, путей, значений окружения. (r1) Все тексты, кроме «В
сценарии нет шага для этой задачи» (только `RunResult.detail` scripted; в `TASK_FAILED` при этом идёт
`FAIL_DETAIL.failed`), — значения `FAIL_DETAIL` (п. 8.6); `TASK_FAILED.detail` — только из `FAIL_DETAIL`.

## 11. Безопасность (Q7–Q11, R2, R3)

| Пункт | Как |
|---|---|
| Q7 | ключей в коде нет; дочернему процессу — только `CHILD_ENV_ALLOW` (без `ANTHROPIC_API_KEY`, токенов, `SAI_TEAM_*`); значения окружения не пишутся ни в журнал, ни в вывод, ни в сообщения (`E_CONFIG` — только имя); текст агента маскирует ядро (`AGENT_ACTIVITY.text`, `summary`, память, файлы); stderr процесса не сохраняется; сессия Claude Code не сохраняется (`--no-session-persistence`); исходники файлов результата удаляются из `work/` после маскированного импорта; текст задачи — stdin, не argv. Текст пользователя и агента — данные: из ответа берутся только поля схемы п. 3.3, они не меняют проект, роль, исполнителя, флаги и потолок (EX-36) |
| Q8 (принцип: проекты не смешиваются) | `cwd` — `work/` своего проекта; `--restricted` ограничивает файловые инструменты рабочей папкой; `--add-dir` не передаётся; файлы принимаются только через `importWorkFile` своего проекта (ядро запрещает `..`, абсолютные пути, ссылки) |
| Q9 | неприменим: базы и SQL нет |
| Q10 | каждый сбой исполнителя — понятное событие (`RUN_FINISHED` с `outcome`, `TASK_RETRY`, `TASK_FAILED` с причиной; (r3) и при исключении, и при ошибке приёма — запуск закрыт до выхода) и код выхода без стека; таймаут задачи 20 мин; повторы до 2 с паузой; группа процессов убивается; сбой сети Исследователя — временный сбой |
| Q11 | сам код Sai Team по сети не ходит (`grep` критерия 11, EX-34). Исходящие запросы Исследователя (WebSearch, WebFetch) делает Claude Code по адресам, которые выбирает модель; проверить каждый адрес до запроса Sai не может. Защита: только чтение (инструментов записи вовне нет), запрещающие правила `WebFetch(domain:…)` для `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`, `169.254.169.254`, потолок `--max-budget-usd`, таймаут, выключатель `SAI_TEAM_WEB=0`, без `SAI_TEAM_REAL_RUNS=1` сети нет вообще. Остаток — частные сети (10/8, 172.16/12, 192.168/16), имена, указывающие на внутренние адреса, утечка контекста через адрес GET — назван в README и в 0015 |
| R2 | события пишутся в момент наблюдения: активность — по строкам потока, итог — после выхода процесса, время — часы писателя; у событий scripted `executor: "scripted"` и суффикс фраз; выдуманных событий, процентов и «активности для вида» нет; (r3) запуск, который не удалось закрыть, не закрывается задним числом — его закрывает восстановление ядра после смерти процесса; Pixel Office не меняется |
| R3 | неприменим: фото покупателей нет |

Q11-разбор форм адреса: `[::1]` в правиле — по аналогии с F4, сама форма для IPv6 в схеме не показана (I4).

## 12. Где лежит Claude Code у владельца

`claude` в PATH нет (F2); файл — внутри расширения редактора, папка меняется с каждой версией (F1). README говорит: задать
`SAI_TEAM_CLAUDE_BIN` абсолютным путём к файлу (`… --version` должен отвечать), после обновления расширения — обновить путь.
Код путь не угадывает и папки расширений не перебирает.

## 13. README: раздел «## Sai Team — исполнители» (`tools/README.md`)

Подразделы (критерий 13): интерфейс `run` (вход, выход, отказ до запуска); исполнители: `claude-cli` — единственный
настоящий; `scripted` — **только для тестов**, сценарии из `tools/test/fixtures/team/`, копия в проекте, честная пометка
«тестовый исполнитель»; условия настоящих запусков: `SAI_TEAM_REAL_RUNS=1`, потолок проекта больше 0, `SAI_TEAM_CLAUDE_BIN`
(абсолютный путь, п. 12); выключатель сети Исследователя: строка «`SAI_TEAM_WEB=0` отключает WebSearch и WebFetch у
Исследователя»; `SAI_TEAM_TASK_TIMEOUT_MS`, `SAI_TEAM_RETRY_DELAY_MS`; аргументы запуска (п. 5.2) и что не передаётся;
окружение процесса (п. 5.3); инструменты каждой роли (таблица п. 7, без промтов); сеть Исследователя, её защита и
остаточный риск Q11 (п. 11); повторы (временные сбои, не больше 2, пауза, таймаут 20 мин, дерево процессов, остаток
`kill -9`); потолок на запуск (r1: меньшее из остатка и `SAI_TEAM_RUN_CAP_USD`, по умолчанию — четверть потолка проекта)
и **правило учёта запуска без расхода** («по худшему случаю: весь потолок этого запуска, не весь остаток,
`accounted: assumed`»); фразы сбоя сети (п. 8.6); файлы результата (`t-NNNN-N-<имя>`, исходник в `work/` удаляется после приёма); команды `new`,
`add-task`, `run-task` с примерами (вымышленные id) и кодами 0/1/2/3. Запрещено в разделе: слова «демо», «demo»,
«демонстрац» рядом со scripted (`grep` критерия 2).

## 14. Места записи REQ-010 (дополнение к п. 13 ядра)

| № | Файл | Вызов | Что |
|---|---|---|---|
| 6 | `runner.js` | `fs.unlinkSync(work/<путь>)` | исходник принятого файла результата claude-cli (п. 8.5.4); в `grep` TM-04 не входит (не запись) |

(r1, замечание 4) Прежнего места №5 (`scripted.js` писал файлы в `work/`) больше нет: scripted ничего не пишет на диск
(п. 6.2), его файлы принимает `writer.importResultBytes` ядра, который пишет через то же первое место ядра
(`files.js`, `publishResultFile`). Новых мест `writeFile|appendFile|createWriteStream` REQ-010 не добавляет: TM-04 ядра
остаётся «ровно четыре места», критерий 2 REQ-009 выполнен без правки формулировки; в `work/` пишет только дочерний
процесс claude-cli — не код `tools/src/team/` (п. 13 ядра). Журнал REQ-010 пишет только через
`writer.append`/`addTask`/`addMemory`/`importWorkFile`/`importResultBytes`. Проверка — EX-51 и TM-04.

## 15. Критерий → тест

### 15.1. Таблица

Файлы — `tools/test/exec-*.test.js` (r5: фактические имена; у ядра REQ-009 свои `team-*.test.js`). Каждый тест: свой временный `SAI_TEAM_HOME` и свой временный `HOME` `<вне проекта>`
(у поддельного файла там план и журнал запусков — п. 15.4); каждый дочерний процесс — с ограничением времени; команда
`run-task` в тестах запускается как `node src/team/cli.js run-task …` (сигнал доходит до неё, а не до npm). Тесты не зависят
друг от друга. «Хеш журнала» — sha256 `events.jsonl`; «хеши `<HOME>`» — список путей с sha256 и правами.

| Крит. | Тест | Файл | Что проверяет |
|---|---|---|---|
| 1 | EX-01 | `exec-executor.test.js` | один набор проверок для `scripted` и для `claude-cli` (поддельный файл): `run` даёт `ExecutorEvent` и `RunResult` с полями `outcome`, `files`, `summary`, `cost_usd`; `run-task` пишет `RUN_STARTED`, `AGENT_ACTIVITY`, `RUN_FINISHED`, `BUDGET_SPENT`; ответ вне схемы (лишнее поле, нет `summary`) — `invalid_output`, «не соответствует схеме», файлы не приняты, `TASK_REVIEW` нет |
| 1 | EX-02 | `exec-executor.test.js` | `checkAnswer` на `WORK_ANSWER_SCHEMA`: границы 2000/2001, 50/51 файлов, `kind` вне перечня, лишнее поле; неизвестное ключевое слово схемы — ошибка |
| 2 | EX-03 | `exec-executor.test.js` | `new --goal x --budget 1` — `executor: "claude-cli"`; `--executor scripted` без `--scenario` и с несуществующим файлом — код ≠ 0, хеши `<HOME>` те же, проектов 0 |
| 2 | EX-04 | `exec-executor.test.js` | проект scripted: первое событие ENGINE после `run-task` — `TASK_STARTED`, фраза содержит «тестовый исполнитель»; у каждого события AGENT `data.executor = "scripted"`; тест перебирает все строки `PHRASES` для типов `TASK_*`, `RUN_*`, `AGENT_ACTIVITY`, `MEMORY_ADDED` (r5, F9) на проекте scripted: есть «тестовый исполнитель», нет слов-признаков п. 6.3 (без учёта регистра); `new` даёт `executor_note` |
| 2 | EX-05 | `exec-executor.test.js` | проект claude-cli: нет исполняемого файла, отказ условий — во всём журнале `executor` каждого события = `claude-cli`; `project` показывает `claude-cli`; файлов сценария в папке проекта нет |
| 2 | EX-06 | `exec-executor.test.js` | `grep -rniE 'демо\|demo\|демонстрац' tools/src/team/` пусто; `grep` README по критерию 2 (пусто; строка `scripted` со словами «только для тестов»); `grep -rn 'fixtures/team' tools/src/team/` пусто; `find tools/src/team -iname '*scenario*' -o -iname '*сценари*' -o -iname '*demo*'` пусто |
| 2 | EX-07 | `exec-scripted-source.test.js` | все строковые значения длиннее 20 знаков из каждого `tools/test/fixtures/team/scenario-*.json` — 0 совпадений в файлах `tools/src/team/**` |
| 3 | EX-08 | `exec-executor.test.js` | `run-task` проекта claude-cli: (а) без `SAI_TEAM_REAL_RUNS`, (б) `=true`, (в) `=0`, (г) `=1` и проект с потолком 0 через API ядра — код ≠ 0, stderr называет условие (`SAI_TEAM_REAL_RUNS=1` / «нет потолка»), счётчик запусков поддельного файла 0, статусы задачи и проекта до и после равны, хеш журнала тот же; (д) оба условия — счётчик 1 |
| 3 | EX-09 | `exec-executor.test.js` | `run` claude-cli напрямую (без команды): без `SAI_TEAM_REAL_RUNS=1` и отдельно на проекте с потолком 0 — `TeamError` (`E_REAL_RUNS_OFF` / `E_NO_BUDGET`), `onEvent` не вызван, счётчик 0, хеш `events.jsonl` тот же |
| 3 | EX-10 | `exec-executor.test.js` | `new --budget 0`, `-1`, `x`, `1e3`, `1.1234567` — `E_USAGE`, код 2, проектов 0; `createProject` API с `budget_usd: 0` — создан (ядро) |
| 4 | EX-11 | `exec-executor.test.js` | поддельный файл пишет argv, cwd, имена окружения: есть `-p`, `--output-format stream-json`, `--verbose`, `--max-budget-usd` ≤ остатка, `--json-schema`; нет `--add-dir`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, `--permission-mode`; позиционного аргумента нет; cwd = `<HOME>/<id>/work` (realpath); имена окружения ⊆ `CHILD_ENV_ALLOW` |
| 4 | EX-12 | `exec-executor.test.js` | `run` с подменённым `io.spawn`: опции вызова `shell === false`, `detached === true`, первый аргумент — `SAI_TEAM_CLAUDE_BIN`, второй — массив |
| 4 | EX-13 | `exec-executor.test.js` | (r5, F5) `grep -rn 'shell:' tools/src/team/` — только `shell: false`; в файлах `tools/src/team/**` нет совпадений с `child_process\|execFile\|execSync\|[^.\w]exec[(]` — **кроме** строки `import cp from "node:child_process"` в `executors/claude-cli.js` (единственное место запуска процесса; используется только `spawn`; импорт `exec`, `execFile*`, `execSync`, `fork`, `spawnSync` — нарушение). Вызов `RegExp#exec` с точкой впереди (`NEW_PATTERN.exec(name)`, `tools/src/team/lock.js:199`) — **не нарушение**: шаблон `[^.\w]exec[(]` его не находит. Тест проверяет именно это: форму `exec(` без точки перед ней — во **всех** файлах `tools/src/team/**` (а не только в файлах с `child_process`) — и запрещённые имена по всему коду |
| 4 | EX-14 | `exec-executor.test.js` | текст задачи с `"`, `'`, `;`, `$(touch <приманка>)`, `` `…` ``, `\n` — stdin поддельного файла содержит его байт-в-байт (в составе `buildPrompt`); argv его не содержит; файл-приманка не появился |
| 4 | EX-15 | `exec-executor.test.js` | (r1, форма для защиты п. 15.2) (а) `SAI_TEAM_CLAUDE_BIN` = `<realpath fixtures/team>/missing-claude` (абсолютный, файла нет): `RUN_FINISHED {not_found}` (фраза «Исполнитель недоступен»), `TASK_FAILED {executor_not_found}`, код ≠ 0, stderr без `    at `; (б) `SAI_TEAM_CLAUDE_BIN = missing-claude-relative` (относительный) при `PATH` = пустая временная папка — `E_CONFIG`, код 2, журнал тот же; в обоих случаях журнал поддельного файла не создан (запусков 0) |
| 5 | EX-16 | `exec-roles-tools.test.js` | все 10 ролей каталога, `run-task` на поддельном файле: множество `--tools` и множество `--allowedTools` = {Read, Write, Edit, Glob, Grep, WebSearch, WebFetch} у `researcher` и {Read, Write, Edit, Glob, Grep} у остальных девяти (в том числе `developer`); `Bash`, `Task`, `Agent` и любых других имён нет; у Исследователя `--disallowedTools` = ровно пять правил `WEB_DENY_RULES` |
| 5 | EX-17 | `exec-roles-tools.test.js` | `SAI_TEAM_WEB`: (1) `REAL_RUNS=1`, `WEB=0` — в argv нет `WebSearch`/`WebFetch` ни в списках, ни в правилах (`--disallowedTools` нет), пять инструментов есть; (2) `REAL_RUNS` ≠ 1 при `WEB` не задана, `0`, `1` — отказ, код ≠ 0, счётчик 0; (3) `REAL_RUNS=1`, `WEB` не задана и `WEB=1` — оба инструмента и правила есть |
| 6 | EX-18 | `exec-stream.test.js` | `stream-ok.jsonl`: задача «на проверке», `RUN_FINISHED.summary`, `BUDGET_SPENT {cost_usd = total_cost_usd образца, accounted:"reported"}`; активности по таблице п. 5.5 |
| 6 | EX-19 | `exec-stream.test.js` | `stream-unknown-type.jsonl` (строка неизвестного `type`) — задача «на проверке», `stats.skipped ≥ 1` (через `run` напрямую) |
| 6 | EX-20 | `exec-stream.test.js` | `stream-not-json.jsonl` и `stream-no-result.jsonl` — `RUN_FINISHED {invalid_output}`, `TASK_RETRY {reason:"invalid_output"}`, процесс `run-task` не упал (код 1 после трёх попыток, stderr без стека) |
| 6 | EX-21 | `exec-stream.test.js` | у каждого `stream-*.jsonl` есть строка в `tools/test/fixtures/team/README.md` с источником; все ключи всех объектов образцов ⊆ списку имён F6 этого проекта (тест держит список с источником «claude 2.1.289, поиск строк») — придуманных полей нет |
| 7 | EX-22 | `exec-process.test.js` | поддельный файл запускает потомка и молчит; `SAI_TEAM_TASK_TIMEOUT_MS=1000`: `RUN_FINISHED {timeout}`; pid процесса и потомка из журнала поддельного файла — `process.kill(pid, 0)` даёт `ESRCH`; (r2, замечание 3) `failDetailFor({outcome:"timeout", detail: FAIL_DETAIL.group})` = `group`, `failDetailFor({outcome:"timeout"})` = `timeout`, `failDetailFor({outcome:"failed", detail: FAIL_DETAIL.group})` = `group` |
| 7 | EX-23 | `exec-process.test.js` | то же без таймаута, тест шлёт `SIGTERM` процессу `run-task`: процессов нет (`ESRCH`), задача «прервана» (`TASK_INTERRUPTED {cancel}`), код ≠ 0 |
| 7 | EX-24 | `exec-process.test.js` | три попытки (сбой, сбой, успех): по журналу поддельного файла (`start`/`end` с временем) интервалы попыток не пересекаются — одновременно не больше одного процесса |
| 7 | EX-25 | `exec-process.test.js` | `readConfig({}).taskTimeoutMs === 1_200_000`; `SAI_TEAM_TASK_TIMEOUT_MS=999`, `x`, `86400001` — `E_CONFIG` |
| 8 | EX-26 | `exec-retry.test.js` | (r1) исполнитель **claude-cli** (поддельный файл), потолок проекта 1, `SAI_TEAM_RUN_CAP_USD` не задана, `SAI_TEAM_RETRY_DELAY_MS=200`. Вариант (а) **с отчётом о расходе**: план `runs` = `stream-error.jsonl` + `set_cost 0.05` + `exit 1`, то же, затем `stream-ok.jsonl` + `set_cost 0.05`: три `RUN_STARTED` (`max_budget_usd` 0.25, 0.25, 0.25), два `TASK_RETRY {reason:"failed", delay_ms:200}`, `BUDGET_SPENT {accounted:"reported"}` ×3, `attempts = 3`, между `RUN_FINISHED` и следующим `RUN_STARTED` ≥ 200 мс по `ts`; задача «на проверке». Вариант (б) **без отчёта**: первые два запуска — `stream-no-result.jsonl` + `exit 1` (строки `result` нет): `BUDGET_SPENT {cost_usd:0.25, accounted:"assumed"}` ×2, третий запуск состоялся с `--max-budget-usd 0.25`, итог «на проверке». Тот же набор на **scripted** (`scenario-flaky.json`: `failed`, `failed`, `ok`) — три `RUN_STARTED`, два `TASK_RETRY` |
| 8 | EX-27 | `exec-retry.test.js` | всегда выход 1: ровно 3 `RUN_STARTED`, `TASK_FAILED {retries_exhausted}`, код 1 |
| 8 | EX-28 | `exec-retry.test.js` | (r1) исполнитель **claude-cli** (поддельный файл), потолок 1, `SAI_TEAM_TASK_TIMEOUT_MS=1000`: план — `hang` (без строки `result`, **без отчёта о расходе**), `hang`, затем `stream-ok.jsonl` + `set_cost 0.1`: `RUN_FINISHED {timeout}` ×2, `BUDGET_SPENT {cost_usd:0.25, accounted:"assumed"}` ×2, `TASK_RETRY {reason:"timeout"}` ×2, третий `RUN_STARTED {max_budget_usd:0.25}`, итог «на проверке», `spent_usd = 0.6` (критерий 8: повтор после таймаута на claude-cli есть) |
| 9 | EX-29 | `exec-retry.test.js` | (r1) claude-cli (поддельный файл), потолок 1, роль `researcher`, `SAI_TEAM_REAL_RUNS=1`; план ×3: `stream-web-error.jsonl` + `exit 1` (без строки `result`, расход не пришёл — `assumed` 0.25 за запуск, на три попытки хватает): `RUN_FINISHED {network}` ×3, фраза каждого — ровно «Нет доступа к сети» (в фразах журнала нет «попробуем ещё раз»); `TASK_RETRY {reason:"network"}` ×2 (фраза «<название роли> попробует ещё раз»), третьего `TASK_RETRY` нет; `TASK_FAILED {reason:"retries_exhausted", detail:"Нет доступа к сети"}`; фраза `TASK_FAILED` равна строке теста «<название роли Исследователь из каталога>: нет доступа к сети, задача не получилась»; код 1, stderr `E_TASK_FAILED: Задача не получилась: Нет доступа к сети`, без `    at ` |
| 10 | EX-30 | `exec-roles-tools.test.js` | у каждой из 10 ролей `internal.prompt` непуст, `internal.tools` непуст; проект с задачами всех ролей (после `run-task` каждой): вывод `project <id>`, `events <id>` и все фразы — 0 вхождений текста каждого промта и каждого имени инструмента каталога (поиск целого слова с учётом регистра) |
| 11 | EX-31 | `exec-budget.test.js` | потолок 1.0, `SAI_TEAM_RUN_CAP_USD=1` (r1: потолок запуска = остаток), поддельный файл сообщает 0.3 за запуск (выход 1 дважды, затем успех): после каждого запуска `BUDGET_SPENT {total_usd}` 0.3, 0.6, 0.9; `--max-budget-usd` запусков 1, 0.7, 0.4 |
| 11 | EX-32 | `exec-budget.test.js` | (r1) claude-cli, `SAI_TEAM_REAL_RUNS=1`, потолок 1, остаток 0 (предыдущая задача списала 1 при `SAI_TEAM_RUN_CAP_USD=1`): `run-task` новой задачи — `E_BUDGET_EXHAUSTED`, код 1, счётчик не вырос, журнал = прежний + ровно одна строка `RUN_REFUSED {budget_exhausted}`, статусы те же; то же при остатке 0 и **без** `SAI_TEAM_REAL_RUNS` — `E_REAL_RUNS_OFF`, журнал байт-в-байт (условие 2 раньше условия 4); прямой `run` при остатке 0 — `E_BUDGET_EXHAUSTED`, журнал тот же (`run` не пишет) |
| 11 | EX-33 | `exec-budget.test.js` | потолок проекта 1, `SAI_TEAM_RUN_CAP_USD` не задана: (а) `stream-no-cost.jsonl` (итог без `total_cost_usd`) и (б) таймаут (`hang`) — `BUDGET_SPENT {cost_usd = max_budget_usd этого запуска = 0.25, accounted:"assumed", total_usd = 0.25}` (не весь остаток 1); README содержит правило (строка «по худшему случаю») |
| 11 | EX-34 | `exec-budget.test.js` | `grep -rnE 'node:(http\|https\|net\|tls\|dgram)\|fetch[(]' tools/src/team/` пусто |
| 12 | EX-35 | `exec-secrets.test.js` | окружение команды: `ANTHROPIC_API_KEY` и `SAI_DECOY_TOKEN` с вымышленными значениями-приманками; после `run-task`: поиск значений по всем файлам `SAI_TEAM_HOME`, stdout, stderr — 0; имён в окружении процесса нет; поток с вымышленным `ghp_…` в тексте ассистента — в журнале `AGENT_ACTIVITY.text` содержит `[скрыто]`, значения нет |
| 12 | EX-36 | `exec-secrets.test.js` | текст задачи и ответ агента (`summary`, `memory`) со строками «executor=scripted», «budget_usd=1000», «статус: выполнен», «роль: Руководитель проекта»: поля проекта (`executor`, `budget_usd`, `status`) и задачи (`role`, `status`) — как ожидается по ходу, а не по тексту (сравнение состояния) |
| 13 | EX-37 | `exec-docs.test.js` | раздел «## Sai Team — исполнители»: `run`, `claude-cli`, `scripted` и «только для тестов», `tools/test/fixtures/team/`, `SAI_TEAM_REAL_RUNS=1`, `SAI_TEAM_CLAUDE_BIN`, строка с `SAI_TEAM_WEB` и «отключает WebSearch и WebFetch» — внутри раздела; десять названий ролей; «остаточный риск»; повторы; «по худшему случаю»; `new`, `add-task`, `run-task` |
| 13 | EX-38 | `exec-guard.test.js` | помощник п. 15.2 бросает сразу: `SAI_TEAM_CLAUDE_BIN` не задан; указывает на файл вне `tools/test/fixtures/team/` (в том числе через ссылку и `..`); `HOME` не временный; (r1) `missing-*` в fixtures, но файл есть; `missing-*` вне fixtures; относительное значение со `/` или равное `claude`; относительное значение при `PATH` ≠ пустая временная папка; пропускает ровно формы EX-15 |
| 13 | — | TEST-RUNNER / RELEASE-VALIDATOR | копия Sai без `node_modules` во временной папке: `cd tools && npm ci && npm run check` — код 0; тесты `exec-*` в выводе |
| 14 | — | UAT-RUNNER, только после письменного согласия владельца | один настоящий `run-task` роли Исследователь с потолком владельца; журнал, файлы, `project <id>`, расход ≤ потолка; запись вне папки проекта не выполнена; расхождения формата `stream-json` с образцами — записаны, образцы исправлены (I4) |
| 15 | EX-39 | `exec-faults.test.js` | `node --import fault-inject.js src/team/cli.js new --goal x --budget 1` с `{fn:"mkdirSync", dir:<HOME>, prefix:".creating-", effect:"throw", code:"EACCES"}` (п. 15.3): код ≠ 0, stderr `E_DISK … (EACCES)` на русском без `    at ` и без «Uncaught»; хеши `<HOME>` до и после те же; `.creating-*` нет |
| 15 | EX-40 | `exec-faults.test.js` | `run-task` (поддельный файл называет `report.md`) с `{fn:"writeFileSync", paths:[<files>/.partial-t-0001-1-report.md], effect:"throw", code:"EIO"}`: код ≠ 0, `E_DISK … (EIO)` без стека; в `files/` нет ни `t-0001-1-report.md`, ни `.partial-*`; `RESULT_FILE` нет; задача не «на проверке» и не «готово» (`failed`, `result_file`); первые N байт журнала — прежний хеш, после них только целые строки |
| 16 | EX-41 | `exec-workdir.test.js` | (а) cwd поддельного файла = `work/` своего проекта (не папка проекта, не чужой проект — два проекта в тесте); (б) поддельный файл пишет `report.md` с вымышленным `ghp_…` и `extra.md`, называет только `report.md`: в `files/` — `t-0001-1-report.md` с `[скрыто]`, 0600 (папки 0700), `RESULT_FILE {name}` в журнале; `extra.md` в `files/` нет; поиск значения по `SAI_TEAM_HOME` — 0 (исходник удалён, п. 8.5.4) |
| 16 | EX-42 | `exec-workdir.test.js` | (в) итог называет `missing.md`, `../x`, абсолютный путь, ссылку наружу — `TASK_FAILED {result_file}`, «недопустим», в `files/` ничего; файл вне папки проекта не создан и не изменён (хеш приманки) |
| 16 | EX-43 | `exec-workdir.test.js` | (г) `new --executor scripted --scenario <фикстура>`: sha256 `scenario.json` = sha256 фикстуры, `scenario_file = "scenario.json"`; копия фикстуры во временной папке меняется, затем удаляется — `run-task` выполняет шаги исходного сценария (активности и `summary` по событиям) |
| 2, 10 | EX-44 | `exec-commands.test.js` | `add-task` с ролью-кодом — `TASK_CREATED` USER, вывод с `role_title`, без кода роли; неизвестная роль, нет `--text`/`--done-when` — `E_USAGE`, код 2, хеш тот же |
| 3, 11 | EX-45 | `exec-commands.test.js` | `run-task` для задачи `review`, неизвестной задачи, проекта `paused` — свой код ошибки, код 1, хеш журнала тот же, счётчик 0 |
| 7 | EX-46 | `exec-process.test.js` | отмена во время паузы между попытками: `TASK_INTERRUPTED {cancel}`, открытых запусков нет, новых процессов нет |
| 8, 11 | EX-47 | `exec-budget.test.js` | (r1) claude-cli, потолок 1, `SAI_TEAM_RUN_CAP_USD=0.6`: запуск 1 — `stream-error.jsonl` + `set_cost 0.6` + `exit 1` (`max_budget_usd` 0.6, остаток 0.4), запуск 2 — `hang` до таймаута (`max_budget_usd` 0.4, `assumed` 0.4, остаток 0): `TASK_RETRY` ровно один (после первого запуска); после `BUDGET_SPENT` второго запуска — `TASK_RETRY` **нет**, `RUN_REFUSED {budget_exhausted}`, `TASK_FAILED {retries_exhausted, detail:"Потолок расходов исчерпан: повтор не начат"}`, фраза «<название роли>: потолок расходов исчерпан, задача остановлена»; запусков поддельного файла 2; код 1 |
| 1, 16 | EX-48 | `exec-executor.test.js` | `stream-ok.jsonl` с `structured_output` и тот же без него, но с `result` — строкой JSON: оба приняты; `result` не JSON и нет `structured_output` — `invalid_output` |
| 4, 7 | EX-49 | `exec-executor.test.js` | (r1, замечание 5) поддельный файл пишет argv: argv **равен** `buildArgs(request, config)` по позициям п. 5.2 (14 позиций + `--disallowedTools` у Исследователя); отдельно — каждый флаг изоляции ровно один раз: `--restricted`, `--safe-mode`, `--strict-mcp-config`, `--no-session-persistence`, пара `--permission-prompts` `none` (соседние элементы), `--append-system-prompt` со значением `role.internal.prompt`; тест держит список шести флагов своей строкой (не берёт из кода). Мутанты «убрали `--restricted`», «убрали `--safe-mode`», «`--permission-prompts host`» — тест падает |
| 11, 8 | EX-50 | `exec-budget.test.js` | (r1, замечание 1) `runCapFor`/`maxBudgetFor` и argv: потолок 1, переменная не задана — `--max-budget-usd 0.25`; `SAI_TEAM_RUN_CAP_USD=0.4` — `0.4`; остаток 0.1 при переменной 0.4 — `0.1`; потолок 0.000003 — `floor6(0.00000075) = 0` → отказ `E_BUDGET_EXHAUSTED` + `RUN_REFUSED`; `readConfig`: `SAI_TEAM_RUN_CAP_USD` = `0`, `0.009999`, `0.000001`, `-1`, `x`, `1e3`, `1.1234567`, пусто — `E_CONFIG`, код 2, stderr `E_CONFIG: Неверная настройка SAI_TEAM_RUN_CAP_USD` (r2, замечание 5); `0.01` и `100000` принимаются |
| 2, 16 | EX-51 | `exec-scripted-source.test.js` | (r1, замечание 4) scripted не пишет на диск: проект scripted, сценарий с `record_input: "input.md"` и `result.files: [{name:"note.md", content:<вымышленный ghp_…>}]`; после `run-task`: дерево `work/` (пути, sha256) до и после равно (пустое); в `files/` — `t-0001-1-input.md` и `t-0001-1-note.md` с `[скрыто]`, 0600; `RESULT_FILE {from_work:false}` ×2; поиск значения по `SAI_TEAM_HOME` — 0; `grep -nE 'writeFile|mkdir|rename|unlink|copyFile|appendFile|createWriteStream|openSync|[.]open[(]|O_WRONLY|O_RDWR|O_CREAT|O_APPEND|O_TRUNC' tools/src/team/executors/scripted.js` — пусто (r2, замечание 1: `openSync` и любой `open` запрещены вообще); `grep -c 'readFileSync' …/scripted.js` ≥ 1 и каждая строка с `readFileSync` содержит `O_NOFOLLOW`; сценарий в папке проекта заменён ссылкой на обычный файл — `check` отказывает `E_SCENARIO`, журнал и `work/` неизменны; TM-04 ядра (ровно 4 места) проходит |
| 15 | EX-52 | `exec-closure.test.js` | (r3, решения ORCH (2), (3); И22 ядра; п. 8.2 шаг 8) «запуск закрыт на всех путях при несломанном писателе»: проект claude-cli (`SAI_TEAM_REAL_RUNS=1`, потолок 1, `SAI_TEAM_CLAUDE_BIN` — поддельный файл), `runTask` вызывается из теста на своём писателе (API). (а) `opts.context` с геттером `goal`, который бросает `new Error("boom")` (исключение не `TeamError` внутри `executor.run`, после `RUN_STARTED`): `runTask` отклоняется **тем же** `Error` (то же сообщение, не `TeamError`); в журнале после прежних строк ровно: `TASK_STARTED`, `RUN_STARTED`, `RUN_FINISHED {outcome:"failed", summary:null, cost_usd:null, files:[]}`, `TASK_FAILED {reason:"retries_exhausted", detail: FAIL_DETAIL.failed}`; `BUDGET_SPENT` нет; процесс поддельного файла не запускался (счётчик 0); `state.runs.open` пуст, задача `failed`. (б) поддельный файл отдаёт итог `ok` с сообщённым расходом и файлом `report.md`, `withFaults([{fn:"writeFileSync", paths:[<files>/.partial-t-0001-1-report.md], effect:"bug"}])` (выброс **не `TeamError`** — например `TypeError` — при приёме результата, на записи `.partial`; `lstat` с `EIO` сюда не годится: `readWorkFile` превращает его в `E_WORK_FILE`, это штатный отказ файла п. 8.5 → `result_file`, задача падает штатно): `runTask` отклоняется **тем же** `TypeError` (не `TeamError`); в журнале: `RUN_FINISHED {outcome:"failed", cost_usd = сообщённый расход, files:[]}`, `BUDGET_SPENT {accounted:"reported"}`, `TASK_FAILED {reason:"result_file", detail: FAIL_DETAIL.result_file}`; `runs.open` пуст; `files/` без `report.md` и `.partial`, `RESULT_FILE` нет. (в) в обоих случаях после `writer.close()`: `writer.lock` **нет**; `openWriter` в том же процессе — успех, `notices` пуст, журнал байт-в-байт прежний (восстановлению нечего прерывать), затем `say` — одна `CHAT`; `RUN_FINISHED` на запуск ровно один; в (а) и (б) исходная ошибка не заменена ошибкой закрытия |
| 15 | EX-53 | `exec-closure.test.js` | (r3, решение ORCH (1), (2); п. 8.2 шаг 8, шаг 7; ядро п. 6.4, шаг 10) «сломанный писатель: замок остался, следующий открывающий восстанавливает»; `run-task` — настоящая команда (`node --import fault-inject.js src/team/cli.js run-task …`, поддельный файл с потоком, где есть активность). (а) `{fn:"writeSync", paths:[<events.jsonl>], effect:"throw", code:"EIO", nth: N}`, где N — номер записи первого `AGENT_ACTIVITY` среди записей журнала команды (`TASK_STARTED` — 1, `RUN_STARTED` — 2, `AGENT_ACTIVITY` — 3): код ≠ 0, stderr `E_DISK … (EIO)` без `    at ` и без «Uncaught»; после выхода `writer.lock` **есть**, его `pid` — pid завершившегося процесса команды (`process.kill(pid, 0)` → `ESRCH`); в журнале после прежних строк только целые `TASK_STARTED`, `RUN_STARTED` (закрытие записать нельзя — писатель сломан; ничего сверх); процессов поддельного файла не осталось. Следующая команда `say`: код 0, `notices` называют снятый замок и прерванную работу; события по порядку `LOCK_STALE_REMOVED`, `RUN_FINISHED {run_id, outcome:"interrupted"}`, `TASK_INTERRUPTED {cause:"recovery"}`, `PROJECT_RECOVERED {from_status:"running", closed_runs:1, interrupted_tasks:1}`, `CHAT`; `runs.open` пуст, задача `interrupted`, проект `paused` (`paused_by = recovery`). (б) закрытие невозможно: выброс при приёме как в EX-52 (б) **и** `{fn:"writeSync", paths:[<events.jsonl>], effect:"throw", code:"EIO", nth: M}`, где M — номер записи `RUN_FINISHED` в журнале команды: код ≠ 0, stderr — текст **исходной** ошибки (выброс при приёме; не текст сбоя записи закрытия); `writer.lock` есть (писатель сломан сбоем закрытия), `RUN_FINISHED` в журнале нет; `say` — как в (а): `LOCK_STALE_REMOVED`, `RUN_FINISHED interrupted`, `TASK_INTERRUPTED`, `PROJECT_RECOVERED`, `CHAT`. (в) `markBroken` у `runTask`: в процессе теста `mock.method(writer, "append", …)` бросает `TeamError("E_TRANSITION")` только на тип `RUN_FINISHED` (сбоя ОС нет — подмена поведения, п. 15.1 ядра), остальные вызовы проходят; выброс при приёме как в EX-52 (б): `runTask` отклоняется **исходной** ошибкой; после этого метод записи писателя — `E_WRITER_BROKEN`, а `writer.close()` оставляет `writer.lock` (содержимое прежнее) |
| 15 | EX-54 | `exec-closure.test.js` | (r4; п. 8.2 шаги 7–8, п. 8.5 шаг 3; `closeAfterError` в `runner.js`) «`E_DISK` при записи результата»: проект claude-cli как в EX-52, поддельный файл отдаёт `ok` с расходом и файлом `report.md`; `runTask` на своём писателе. (а) сбой записи **файла**: `withFaults([{fn:"writeFileSync", paths:[<files>/.partial-t-0001-1-report.md], effect:"throw", code:"ENOSPC"}])` — `E_DISK` без `details.rollback` (писатель цел): `runTask` **не бросает**, возвращает отказ с `E_DISK`; в журнале: `RUN_FINISHED {outcome:"failed", cost_usd = сообщённый расход, files:[]}`, `BUDGET_SPENT {accounted:"reported"}`, `TASK_FAILED {reason:"result_file", detail: FAIL_DETAIL.result_disk}`; `RESULT_FILE` нет; `files/` без `report.md` и `.partial`; `writer.broken` ложь; после `writer.close()` — `writer.lock` нет, `openWriter` без `notices`. (б) сбой записи **события** `RESULT_FILE`: `{fn:"writeSync", paths:[<events.jsonl>], effect:"throw", code:"ENOSPC", nth: K}`, где K — номер записи `RESULT_FILE` в журнале команды (после `TASK_STARTED`, `RUN_STARTED` и всех `AGENT_ACTIVITY`): `E_DISK` с `details.rollback` — писатель сломан, `runTask` отклоняется этим `TeamError`; закрытие (`closeAfterError`) писать не может: в журнале после прежних строк только целые `TASK_STARTED`, `RUN_STARTED`, `AGENT_ACTIVITY`, **нет** `RUN_FINISHED`, `BUDGET_SPENT`, `TASK_FAILED`, `RESULT_FILE`; `files/` без `report.md`; `writer.broken` истина; после `writer.close()` `writer.lock` **остался** (содержимое прежнее); следующее `openWriter`: `notices` называют снятый замок и прерванную работу; события `LOCK_STALE_REMOVED`, `RUN_FINISHED {outcome:"interrupted"}`, `TASK_INTERRUPTED {cause:"recovery"}`, `PROJECT_RECOVERED`; `runs.open` пуст, задача `interrupted`. Формула «`TASK_FAILED result_disk` + `RUN_FINISHED` + `BUDGET_SPENT` **и** писатель сломан, замок остался» в одном запуске невозможна: запись `TASK_FAILED` требует целого писателя; поэтому (а) — первая часть, (б) — вторая (п. 18, I9) |
| 3, 4, 6, 7, 11, 16 | — | `exec-findings.test.js` | (r5) тесты находок шагов 12–13 прогона — проверки к критериям 3, 4, 6, 7, 11, 16 (r6: столбец уточнён по названиям тестов); не новые критерии; номеров EX нет, ниже — по названиям (r6, M1). **Расход (критерий 11, п. 8.4, 5.4):** «a reported cost that is huge, negative or not a number is not a cost…», «a reported cost of 5e8 is written as it is and the next run is refused», «recordableCost: only a finite number >= 0 whose rounding is at most 1e9», «the parser takes a cost only when it is a finite number >= 0…». **Остаток (критерии 3, 11, п. 3.2):** «checkBudget refuses a rest that is not a finite number…», «run() of claude-cli with such a rest throws before spawn…». **Удаление исходника (критерий 16, п. 8.5.4):** три теста «removeSource: …» (подмена папки или файла ссылкой — внешний файл не тронут; без подмены — удалён). **Вывод (критерии 6, 7, п. 5.3):** «a line of 9 MiB without a line break is refused as too big…», «a stream cut into pieces of 1-3 bytes…». **Группа и потоки (критерий 7, п. 5.4 поправка, 5.6):** «a descendant outside the group that keeps stdout…», «the same with a long timeout…», «the task with such a descendant…» (`fake-claude-probe.js`, `orphan-stdout`) |
| 7 | — | `exec-group.test.js` | (r7; поправка «группа не ушла», п. 5.4, остановка оставшейся группы после штатного выхода, п. 5.6; I11 (б)) вместо `claude` — подставной процесс Node из самого файла тестов, который печатает образец потока `fixtures/team/` и оставляет потомка вне группы (держит stdout, группа «не ушла») или внутри группы; настоящий `claude` не запускается; потомков тест убивает сам, каждый вызов с ограничением времени; номеров EX нет, пять тестов по названиям: «I11 (b): a result 'ok' while the group is not gone is not accepted…» (итог `ok` → `failed`, `detail` `group`, `transient: false`, ответа нет, `spawned: true`); «…an answer outside the schema while the group is not gone…» (`invalid_output`, `detail` `group`, не текст схемы, `transient: false`); «…a broken stream (not JSON) while the group is not gone…» (`detail` `group`, `transient: false`); «…control: the same streams with the group gone keep their usual outcomes…» (`ok`; `invalid_output` с текстом схемы и `transient: true`; битый поток — не `group`); «5.6: what a normal exit leaves in the group is stopped before run() returns…» (потомок в группе после выхода 0 убит до возврата `run`, итог — по потоку `ok`) |

Каждый критерий 1–16 имеет тест (14 — UAT по согласию владельца, 13 — ещё прогон на чистой копии); каждый тест EX-01…EX-54 —
с критерием.

### 15.2. Помощники тестов (`tools/test/exec-helpers.js`, урок AP-025)

- `fakeClaudePath()` — абсолютный путь `tools/test/fixtures/team/fake-claude.js`.
- `teamEnv(over)` → окружение для команды/`run`: временные `SAI_TEAM_HOME` и `HOME`, `SAI_TEAM_CLAUDE_BIN = fakeClaudePath()`,
  малые таймаут и пауза. **Проверка до любого запуска** (`assertSafeEnv(env)`): `SAI_TEAM_CLAUDE_BIN` задан и имеет одну
  из трёх форм, иначе `throw` сразу (громко, тест падает):
  1. **рабочая** — `realpath` значения — существующий файл внутри `realpath(tools/test/fixtures/team/)`;
  2. **(r1, замечание 6) «нет файла» для отказа** — абсолютный путь, у которого `realpath(dirname)` равен
     `realpath(tools/test/fixtures/team/)`, имя начинается с `missing-`, а `lstat` даёт `ENOENT` (файла нет и не ссылка):
     запускать нечего, `spawn` получит `ENOENT`;
  3. **(r1) относительное значение для отказа `E_CONFIG`** — без `/`, начинается с `missing-` (не `claude`), и тогда
     `PATH` окружения теста **обязан** быть пустой временной папкой, созданной помощником: даже если код по ошибке не
     откажет `E_CONFIG` и вызовет `spawn` с поиском по `PATH`, найти нечего — ни настоящий claude, ни что-либо ещё.
  Формы 2 и 3 разрешены только помощником `runTeamExpectRefusal(argv, env)`, который после команды дополнительно
  проверяет: журнал поддельного файла (`$HOME/fake-claude/log.jsonl`) не создан — запусков 0. `HOME` и `SAI_TEAM_HOME` —
  внутри временной папки ОС и не равны домашней папке пользователя. Каждый вызов `run-task`, `new`, `run`
  claude-cli в тестах идёт только через `runTeam(argv, env, nodeArgs = [])` / `runExecutor(request, env)`, которые вызывают `assertSafeEnv`.
  (r2, замечание 4) `nodeArgs` — аргументы самого `node` перед путём `cli.js` (для EX-39/EX-40: `["--import",
  <абсолютный путь fixtures/team/fault-inject.js>]`); тот же `runTeam` вызывает `assertSafeEnv(env)` независимо от `nodeArgs`,
  а сам допускает в `nodeArgs` только пару `--import` + путь, у которого `realpath` — файл внутри
  `realpath(tools/test/fixtures/team/)`; любое другое значение — `throw`. `runTeamExpectRefusal(argv, env)` `nodeArgs` не принимает.
- Даже при ошибке проверки настоящий claude не получит входа: `HOME` теста пуст (нет настроек и входа Claude Code).
- Поддельный файл исполняемый (0755); помощник проверяет `fs.accessSync(…, X_OK)` и падает с понятной ошибкой, если права
  потерялись при копировании.

### 15.3. Расширение `tools/test/fault-inject.js` (обратно совместимое)

Новое необязательное поле сбоя для методов с путём: `dir` (абсолютный путь) и `prefix` (строка) — вызов совпадает, если
`path.dirname(arg0) === dir` и `path.basename(arg0).startsWith(prefix)`. Вместе с `paths` не задаётся (иначе ошибка
спецификации «fault-inject: fault N: …»). Нужно для EX-39: id проекта случаен, точного пути заранее нет. Прежние поля и оба
режима (п. 15.3 ядра) не меняются.

### 15.4. Поддельный исполняемый файл и образцы (`tools/test/fixtures/team/`)

`fake-claude.js` (`#!/usr/bin/env node`, 0755). Читает план из `$HOME/fake-claude/plan.json` (окружение у него только из
`CHILD_ENV_ALLOW`, поэтому план — через `HOME` теста). На каждый запуск n (счётчик — по своему журналу):

1. дописывает в `$HOME/fake-claude/log.jsonl` строку `{event:"start", n, pid, ppid, t, argv, cwd, env_names}`; stdin
   целиком — в `$HOME/fake-claude/stdin-<n>.bin`;
2. выполняет шаг плана `runs[n-1]` (или `default`): `stream` — имя образца `stream-*.jsonl` рядом с собой, строки выводятся
   как есть; `set_cost` / `omit_cost` — заменить или убрать `total_cost_usd` в строке `result` (значение задаёт тест);
   `work_files` — `[{path, content}]` записать в cwd; `answer_files` — подставить имена в `structured_output.files`;
   `spawn_child` — запустить потомка (`node -e` с бесконечным таймером) и записать его pid в журнал; `hang` — после вывода не
   выходить; `exit` — код выхода;
3. при выходе — `{event:"end", n, t, code}`.

(r6, L6) `fake-claude-probe.js` (`#!/usr/bin/env node`, 0755) — второй поддельный файл для тестов `exec-findings`: модель не
вызывает, в сеть не ходит; читает весь stdin, план — `$HOME/fake-claude/probe.json`, журнал — `$HOME/fake-claude/probe-log.jsonl`.
Режимы: `orphan-stdout` — запускает потомка в **другой** группе процессов, который держит stdout открытым (живёт до 60 с), пишет
его pid в `$HOME/fake-claude/orphan.pid` и сразу выходит кодом 0 (п. 5.6); `big-line` — `bytes` байт без перевода строки
кусками по 64 KiB, затем ждёт (п. 5.3); `split` — образец `stream-*.jsonl` кусками по 1…`max_chunk` байт без последнего
перевода строки, затем выход 0. Тест, использующий его, после себя убивает потомка (`orphan.pid`) и проверяет, что процессов
не осталось.

Образцы (источник записывается в `tools/test/fixtures/team/README.md` построчно; на сегодня у всех один источник —
«форма по `claude --help` 2.1.289 и именам полей, найденным в установленном файле (`grep -c`), вложенность — допущение до
записанного настоящего запуска (критерий 14)»):

| Файл | Строки (только поля из F6) |
|---|---|
| `stream-ok.jsonl` | `system/init`; `assistant` с `tool_use` `Read`, `Write` и `text`; `user` с `tool_result`; `result` `success`, `is_error:false`, `total_cost_usd`, `structured_output` (`summary`, `files`, `memory`), `session_id`, `num_turns`, `duration_ms` |
| `stream-unknown-type.jsonl` | как `stream-ok`, плюс строка с `type`, которого разборщик не знает |
| `stream-not-json.jsonl` | строка не JSON посреди потока, итог есть |
| `stream-no-result.jsonl` | без строки `result` |
| `stream-no-cost.jsonl` | `result` без `total_cost_usd` |
| `stream-error.jsonl` | `result` с `is_error:true`, `subtype:"error_during_execution"` |
| `stream-web-error.jsonl` | `assistant` с `tool_use` `WebFetch`; `user` с `tool_result` `is_error:true` по этому `tool_use_id` |
| `stream-secret.jsonl` | `text` ассистента с вымышленным `ghp_…` |
| `stream-out-of-schema.jsonl` | `structured_output` с лишним полем |
| `stream-result-string.jsonl` (r6, L6) | итог без `structured_output`, ответ — строка JSON в поле `result` (EX-48) |
| `stream-result-text.jsonl` (r6, L6) | итог без `structured_output`, в `result` — текст не JSON (EX-48) |
| `stream-lies.jsonl` (r6, L6) | текст ассистента, `summary` и `memory` со строками «executor=scripted», «budget_usd=1000», «статус: выполнен» (EX-36) |
| `scenario-basic.json`, `scenario-flaky.json`, `scenario-bom.json`, `scenario-files.json` (r1) | сценарии п. 6.2 (вымышленные тексты; `scenario-bom.json` — с BOM для ядра TM-59; `scenario-files.json` — `record_input` и `result.files` для EX-51); шагов `write_work_file` нет |

### 15.5. Мутанты

| Мутант | Ловит |
|---|---|
| `run` не вызывает `check` (только `runner`) | EX-09 |
| `REAL_RUNS` сравнивается как «не пусто» вместо «ровно `1`» | EX-08 (б), EX-17 |
| потолок 0 разрешён для claude-cli | EX-08 (г), EX-09 |
| `TASK_STARTED` до `check` | EX-08 (статусы) |
| `shell: true` / позиционный аргумент с текстом задачи | EX-12, EX-14 |
| `--add-dir work` добавлен | EX-11 |
| `Bash` в наборе разработчика | EX-16 |
| `SAI_TEAM_WEB=0` не убирает правила | EX-17 (1) |
| неизвестная строка потока роняет задачу | EX-19 |
| не JSON — принят как успех | EX-20 |
| убить только процесс, не группу | EX-22, EX-23 |
| повторов 3 вместо 2 / без паузы | EX-26, EX-27 |
| таймаут не временный | EX-28 |
| сбой сети не распознан (`failed`) | EX-29 |
| промт роли в выводе `project` | EX-30 |
| нет расхода = 0 молча | EX-33 |
| `--max-budget-usd` = потолок, а не остаток | EX-31 |
| (r1) потолок запуска = весь остаток (повтор после таймаута невозможен) / «нет расхода» = весь остаток | EX-28, EX-33, EX-50 |
| (r2) нижняя граница `SAI_TEAM_RUN_CAP_USD` снята (0.000001 принимается) | EX-50 |
| (r2) `detail` по `outcome`, а не `group` у не ушедшей группы | EX-22 |
| (r2) `openSync` или чтение без `O_NOFOLLOW` в `scripted.js` | EX-51 |
| (r1) `RUN_REFUSED` пишет `run`/`check` или не пишет никто | EX-32, EX-09 |
| (r1) `TASK_RETRY` пишется до проверки остатка следующей попытки | EX-47 |
| (r1) фраза `RUN_FINISHED network` обещает повтор / `TASK_FAILED` при сети без слов о сети | EX-29 |
| (r1) убран `--restricted` / `--safe-mode` / `--permission-prompts none` | EX-49 |
| (r1) scripted пишет файлы в `work/` | EX-51, TM-04 |
| (r1) помощник пропускает относительный путь при непустом `PATH` | EX-38 |
| `ANTHROPIC_API_KEY` передан процессу | EX-35 |
| из ответа берутся поля кроме схемы | EX-36, EX-01 |
| при сбое claude-cli — scripted | EX-05 |
| исходник в `work/` не удалён | EX-41 |
| файлы импортируются по одному без предварительной проверки всех | EX-42 |
| сценарий читается из исходного пути, не из копии | EX-43 |
| (r3) нет `finally`: запуск остаётся открытым при исключении исполнителя не типа `TeamError` | EX-52 (а) |
| (r3) при ошибке приёма результата запуск не закрывается / закрывается без `BUDGET_SPENT` при `spawned` | EX-52 (б) |
| (r3) закрытие пишется после проброса ошибки или исходная ошибка заменена ошибкой закрытия | EX-52 (а), (б), EX-53 (б), (в) |
| (r4) выброс не `TeamError` при приёме результата (`.partial`) закрывает запуск не так: нет `BUDGET_SPENT` или detail не `result_file` | EX-52 (б) |
| (r4) ветка `E_DISK` → `result_disk` (отказ приёма при несломанном писателе) заменена на `result_file` | EX-54 (а) |
| (r4) при сломанном писателе (`E_DISK` с `rollback` на `RESULT_FILE`) закрытие пишет события или снимает замок | EX-54 (б) |
| (r3) задача `running` остаётся без запуска (нет `TASK_FAILED`) | EX-52 (а), (б) |
| (r3) закрытие пишет `outcome: "interrupted"` (публичный `append` отклонит) | EX-52 (а) |
| (r3) `close()` сломанного писателя снимает замок (ядро, шаг 10) | EX-53 (а), (б), (в) |
| (r3) не удалась запись закрытия — писатель не объявлен сломанным (`markBroken` не вызван) | EX-53 (в) |
| (r3) после сбоя записи `AGENT_ACTIVITY` runner пытается писать дальше по сломанному писателю | EX-53 (а) |
| (r6, M1) `recordableCost` без верхней границы или пропускает отрицательное / не конечное (`2e9`, `-1` записаны как `reported`) | `exec-findings`: «a reported cost that is huge, negative or not a number…», «recordableCost: …» |
| (r6, M1) граница `1e9` строже (`5e8` или `1e9` считаются «не пришёл») | `exec-findings`: «a reported cost of 5e8…», «recordableCost: …» (`1e9` принят) |
| (r6, M1) ожидание `close` после выхода без ограничения (`run` ждёт потомка вне группы) | `exec-findings`: «the same with a long timeout…» (`run` < 10 с) |
| (r6, M1) принудительное закрытие потоков без `groupStuck` (нет `detail` `group`, повтор есть) | `exec-findings`: «a descendant outside the group…», «the task with such a descendant…» |
| (r6, M1; r7) итог `ok` при `groupStuck` принимается | `exec-group`: «a result 'ok' while the group is not gone…» |
| (r7, I11 (б)) ответ вне схемы или битый поток при `groupStuck` даёт `detail` схемы / повтор (`transient: true`) вместо `group` | `exec-group`: «an answer outside the schema…», «a broken stream…»; контроль «the same streams with the group gone…» ловит обратную ошибку (`group` без причины) |
| (r6, M1; r7) оставшаяся группа после штатного выхода не останавливается | `exec-group`: «5.6: what a normal exit leaves in the group is stopped…» |

## 16. Планка

| Пункт | Применим? | Как выполняется |
|---|---|---|
| Q1 | применим | изменение привязано к REQ-010; у всех 16 критериев способ проверки — тесты EX и команды п. 15 (14 — UAT по согласию) |
| Q2 | применим | проект проверяет CODE-DESIGN-VALIDATOR (шаг 1b); код — SECURITY-REVIEWER и REVIEWER; тесты — TEST-DESIGN-VALIDATOR; итог — RELEASE-VALIDATOR своим запуском |
| Q3 | применим | факты п. 0 — своими запусками (`--help`, `--version`, `grep -c`); чего нельзя установить без запуска — названо (I4), а не выдумано; «работает» — только после `npm run check` с выводом |
| Q4 | применим | одна команда `cd tools && npm run check`; тесты `exec-*` входят в шаблон; прогон на чистой копии — критерий 13 |
| Q5 | применим | таблица п. 15.1: каждый критерий → тест; тесты отказа сравнивают хеши журнала/`<HOME>` и счётчик запусков; свои временные `SAI_TEAM_HOME` и `HOME` |
| Q6 | применим | `skip`, отключённых правил линтера, `\|\| true` нет; `fault-inject.js` только расширяется |
| Q7 | применим | п. 11: окружение по списку, значения не пишутся, маскирование ядром, stderr не сохраняется, сессия не сохраняется, исходники результатов удаляются, текст — stdin; EX-35, EX-36, EX-41 |
| Q8 | применим как принцип для проектов | `cwd` = `work/` своего проекта, `--restricted`, без `--add-dir`, приём только через ядро; EX-11, EX-41, EX-42 |
| Q9 | неприменим | базы и SQL нет |
| Q10 | применим | каждый сбой — событие с причиной, код без стека; таймаут, повторы с паузой, убийство группы; (r3) на всех путях выхода запуск закрыт до проброса ошибки, а при невозможности записи — замок остаётся и проект восстанавливается (п. 8.2 шаг 8); EX-15, EX-20, EX-22…EX-29, EX-39, EX-40, EX-52, EX-53, EX-54 |
| Q11 | применим (частично, остаток назван) | своих сетевых вызовов нет (EX-34); у Исследователя — защита и остаточный риск п. 11 (0015, README) |
| Q12 | применим | опирается на 0002, 0013, 0015, 0017, (r6) 0018; оспоримые выборы — предложение записи P1–P8 (п. 18), записанное ORCH/DOC-UPDATER в `decisions/0018-team-executors.md`; расхождения с ядром — вопросы I1–I3, не молча; (r1) правка проекта ядра r4 (`importResultBytes`, фразы п. 8.6, п. 17 ядра) — по решению ORCH и названа в обоих проектах; выбор потолка запуска — P4; (r6, M2) граница файлов тестов исполнителей (`tools/test/exec-*.test.js`, `tools/test/exec-helpers.js`, `tools/test/fixtures/team/**`) — в границе записи 0018 (а не P10 записи 0017, как ошибочно стояло до r6) |
| Q13 | применим | урок AP-025 — помощник п. 15.2 и EX-38; AP-012 — факт версии 2.1.284 из `current-state.md` перепроверен (F1: 2.1.289); (r3) AP-005 — ссылки на прежнюю редакцию проверены поиском («больше ничего не пишется», «EX-01…EX-51»); AP-014 — правило «закрыть запуск на всех путях» применено ко всем местам выхода `runTask` с ошибкой (6.3, приём 8.5, `writeError`, шаг 7); новых ошибок процесса нет |
| Q14 | применим | handoff заполняется в этой работе; статус REQ-010 — DOC-UPDATER после PASS RELEASE-VALIDATOR; `done` не раньше UAT (критерий 14) и `done` REQ-009 |
| R1 | применим | мерж — только с подтверждения владельца; проект его не касается |
| R2 | применим | события — в момент наблюдения, время с часов писателя; scripted помечен в данных и фразах; процентов и придуманной активности нет; (r3) закрытие запуска при ошибке пишется в момент ошибки (`RUN_FINISHED failed`, без выдуманного итога: `summary:null`, расход — только сообщённый), а невозможное закрытие не пишется вовсе; Pixel Office не меняется |
| R3 | неприменим | фото покупателей нет |

## 17. План раундов BACKEND-DEV

Начало — после ворот REQ-009 (ядро в коде, проверено). Каждый раунд — ворота самого разработчика с выводом в отчёте; все
запуски — во временных `SAI_TEAM_HOME` и `HOME` `<вне проекта>`, только с поддельным исполняемым файлом во временной папке
(настоящий claude не запускается никогда — ни в раундах, ни в тестах).

| Раунд | Файлы | Ворота |
|---|---|---|
| 1 — контракт | `errors.js` (коды), `config.js`, `role-internal.js`, `roles.js`, `executor.js`, `language.js` (`FAIL_DETAIL`, фразы п. 8.6) | `npm run check`; `node --input-type=module -e` (с ограничением времени): `checkAnswer`, `buildPrompt`, `toolsForRole` при `SAI_TEAM_WEB=0` |
| 2 — разбор и scripted | `executors/stream.js`, `executors/scripted.js`, `store.js` (`importResultBytes`, п. 6.8 ядра) | `npm run check`; разбор временных образцов; scripted на временном сценарии |
| 3 — claude-cli | `executors/proc.js`, `executors/claude-cli.js` | `npm run check`; временный поддельный файл: argv, cwd, окружение, таймаут с потомком, отказ условий |
| 4 — задача | `runner.js` | `npm run check`; повторы, потолок, файлы результата, отмена; (r3) исключение исполнителя, ошибка приёма результата и сбой записи — запуск закрыт до проброса ошибки (п. 8.2 шаг 8) |
| 5 — команды и README | `cli.js`, раздел README | `npm run check`; `npm run team -- new/add-task/run-task` на scripted и на временном поддельном файле; хеши `tools/src/pixel-office/**` до и после |

Ворота WF-02 дальше: SECURITY-REVIEWER → REVIEWER → TEST-DESIGNER (EX-01…EX-54, помощники, `fake-claude.js`, образцы,
расширение `fault-inject.js`) → TEST-DESIGN-VALIDATOR → TEST-RUNNER → (UAT по согласию владельца) → RELEASE-VALIDATOR →
DOC-UPDATER.

## 18. Открытые вопросы и предложения записи

Вопросы (не решены догадкой; в проекте выбран вариант, указанный «пока»):

- **I1. Закрыт требованием (r6, L2).** Критерий 14 (редакция r5 требований) уже говорит «на проверке» по итогу исполнителя;
  после удачного `run-task` задача — `TASK_REVIEW` («на проверке»), «готово» — только REQ-013 (P5).
- **I2. Решено (r1, решение ORCH).** Причины `TASK_FAILED` — только из каталога ядра (F11; `executor_error` нет): сеть и
  потолок между попытками — `retries_exhausted` с `detail` из `FAIL_DETAIL` (п. 8.3); фраза `RUN_FINISHED network` больше не
  обещает повтор, повтор объявляет только `TASK_RETRY`, который пишется после окончательного решения о повторе (п. 8.2,
  шаг 6.5); итоговые фразы о сети и потолке — новые строки таблицы фраз по `detail` (п. 8.6, правка п. 9 ядра r4); EX-29,
  EX-47 определены.
- **I3. Два расхождения с ядром о `work/`.** (а) Критерий 16б требует, чтобы поиск по `SAI_TEAM_HOME` не находил секрет, а
  ядро (P9) держит `work/` без маскирования. Пока: исходники **принятых** файлов удаляются из `work/` (п. 8.5.4); не названные
  файлы остаются (остаточный риск P9). (б) **Решено (r1, решение ORCH):** scripted ничего не пишет на диск, его файлы
  результата — в памяти и принимаются `writer.importResultBytes` ядра (п. 6.2, 8.5; п. 6.8 ядра, TM-63); TM-04 остаётся
  «ровно четыре места», критерий 2 REQ-009 не меняется.
- **I4. Чего нельзя установить без настоящего запуска** (только UAT, критерий 14): точная вложенность строк `stream-json`
  (где лежат `content`, `structured_output`, форма ошибки WebSearch); совместимость `--restricted`, `--safe-mode`,
  `--permission-prompts none`, `--strict-mcp-config` в одном запуске и работа входа по подписке с ними; принимается ли
  правило `WebFetch(domain:[::1])` в такой форме; действие `--max-budget-usd` на подписке (`current-state.md`, раздел 4);
  создаёт ли Claude Code служебные файлы в `cwd`. Разбор сделан «по форме с запасом» (п. 5.4); образцы помечены источником;
  расхождение UAT записывает и исправляет образцы.
- **I5.** `docs/product/current-state.md` называет версию 2.1.284, установлена 2.1.289 (F1) — обновить при следующей правке
  документа (DOC-UPDATER).
- **I6.** (r2) Для проекта REQ-013: сценарии движка обязаны задавать `cost_usd` в каждой записи `runs` (п. 8.4); решение о
  форме сценариев и тесте — за проектом REQ-013, здесь только правило.
- **I7. (r3) Закрытие задачи при ошибке.** Решение ORCH (2) требует закрыть открытый **запуск**. Шаг 8.3 проекта сверх этого пишет
  `TASK_FAILED` для задачи `running` — иначе она остаётся `running` без запуска и без писателя навсегда (`run-task` запускает
  только `waiting`/`interrupted`/`failed`, шаг 1; восстановление при штатном `close()` не работает, ядро п. 6.3 r5–r7; r6 этого проекта: по ядру r8 такую задачу восстановит следующий держатель замка — шаг 8.3 всё равно нужен, чтобы задача закрывалась сразу, с понятной причиной, а не прерыванием при следующем открытии). Это толкование
  «и т. д.» в решении ORCH, не записанное им прямо; если ORCH понимает его уже (только запуск) — шаг 8.3, EX-52 (а), (б),
  EX-53 (б) и фраза «`running` без запуска» меняются, а вопрос «как вывести задачу из `running` после ошибки» уходит
  REQ-013. Пока в проекте — `TASK_FAILED`.
- **I8. (r3) Исход закрытия.** В каталоге ядра у `RUN_FINISHED` нет исхода «error»; `interrupted` пишет только ядро (N4).
  Runner пишет `failed` с `summary:null`; различие «исключение» и «сбой исполнителя» видно по `TASK_FAILED.detail` и по тому,
  что `BUDGET_SPENT` у исключения без результата нет. Новый исход потребовал бы правки каталога ядра — не делается.
- **I9. Решено (r6, L1; решение ORCH, ветка удалена на шаге step-19).** `TASK_FAILED result_disk` и сломанный писатель — два разных пути (EX-54 (а) и (б)). Ветка `E_DISK → result_disk` внутри `closeAfterError` была недостижима (`E_DISK` без `rollback` при приёме возвращается отказом п. 8.5, шаг 3; `E_DISK` с `rollback` — сломанный писатель, запись закрытия невозможна) и удалена: закрытие при ошибке приёма пишет только `{result_file, FAIL_DETAIL.result_file}` (п. 8.2, шаг 8.3; п. 8.5, шаг 6). Ветка `result_disk` отказа приёма (п. 8.5, шаг 3) остаётся — EX-54 (а).
- **I10. Решено (r6, L7; решение ORCH).** У `BUDGET_SPENT` проекта scripted пометки «тестовый исполнитель» **нет**: событие числовое (расход), пометка стоит у фраз `TASK_*`, `RUN_*`, `AGENT_ACTIVITY`, `MEMORY_ADDED` (п. 6.3); EX-04 не меняется. Принято как решение (запись 0018).
- **I11. Закрыт (r7; был: (r6, M1) поправка «группа не ушла» — расхождение кода и пробелы тестов).** (а) Расхождение кода (ответ вне схемы при `groupStuck` давал `transient: true` и текст схемы, проба F15) в коде исправлено; правило п. 5.4 и 5.6 не менялось и теперь проверено тестами `exec-group.test.js` («an answer outside the schema…», «a broken stream…»: `detail` `group`, `transient: false`). (б) Правила «`ok` при `groupStuck` → `failed`» и «оставшаяся группа после штатного выхода останавливается» имеют тесты `exec-group.test.js` (пять тестов, п. 15.1; мутанты п. 15.5).
- **F2/F3 ревью (Low, r7).** Комментарий шага 7 в `tools/src/team/runner.js` («write nothing more») неточен: после сбоя записи у несломанного писателя шаг 8 закрывает запуск (п. 8.2, шаг 7 и конец абзаца); комментарий исправляет будущий ремонт кода (CODE-FIXER), проект не меняется.

Предложение записи (Q12) — `decisions/0018-team-executors.md` (пишет ORCH/DOC-UPDATER по решению ORCH; r6: запись
пишется в этом прогоне вместе с границей файлов тестов P9):

- **P1.** Текст задачи — через stdin; списки инструментов — одним аргументом через запятую; позиционной подсказки нет.
- **P2.** Дополнительные флаги изоляции `--restricted`, `--safe-mode`, `--strict-mcp-config`, `--no-session-persistence`,
  `--permission-prompts none`; `--bare` не используется (ломает вход по подписке).
- **P3.** Окружение процесса — список `CHILD_ENV_ALLOW`; `ANTHROPIC_API_KEY` не передаётся (вход — подписка; ключ — запасной
  вариант отдельным требованием).
- **P4.** (r1) Потолок одного запуска — меньшее из остатка и `SAI_TEAM_RUN_CAP_USD`, по умолчанию четверть потолка проекта
  (`RUN_CAP_SHARE = 0.25`: при любом потолке остаются деньги минимум на 3 попытки одной задачи, если первые не сообщили
  расход); расход без итога — потолок этого запуска (`max_budget_usd`, `accounted: assumed`), не весь остаток.
- **P5.** После удачной попытки задача — «на проверке» (`TASK_REVIEW`), «готово» — только REQ-013 (I1).
- **P6.** Имена результатов `t-NNNN-N-<имя>`; исходники принятых файлов удаляются из `work/` (I3).
- **P7.** Группа процессов (`detached`) и убийство группы; остаточные риски: потомок с `setsid`, `kill -9` самого `run-task`.
- **P8.** Сбой сети Исследователя распознаётся по ошибке результата WebFetch/WebSearch и неуспеху попытки, без разбора текста
  ошибки.
- **P9.** (r6, M2) Граница файлов тестов исполнителей: `tools/test/exec-*.test.js`, помощник `tools/test/exec-helpers.js`,
  фикстуры `tools/test/fixtures/team/**` (поддельные `fake-claude.js`, `fake-claude-probe.js`, образцы `stream-*.jsonl`,
  сценарии `scenario-*.json`) — в границе записи 0018 (расширяет 0015 и P10 записи 0017, которые называют только
  `team-*.test.js`, `team-helpers.js` и `fault-inject.js`).
- **P10.** (r6, M1) Записываемый расход запуска — конечное число ≥ 0 с округлением вверх до 6 знаков, не больше 1e9; иное —
  «расход не пришёл» (потолок этого запуска, `assumed`). Процессы попытки, которые не удалось остановить (группа не ушла или
  потоки закрыты принудительно после ограниченного ожидания), — итог без повтора с `detail` `group`, удачный итог такой
  попытки не принимается.
