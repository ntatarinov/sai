# REQ-009 — проект кода: ядро Sai Team (журнал, состояние, хранение, писатель, восстановление, чтение, роли, язык)

WF-02, шаг 1 (CODE-DESIGNER), прогон `PROD-20261006-01`. Действующая редакция — **r12** (ниже «Что изменено в r12», «Что изменено в r11», «Что изменено в r10», «Что изменено в r9», «Что изменено в r8», «Что изменено в r7», «Что изменено в r6», «Что изменено в r5»).
Редакция r2 — доработка по FAIL повторных ворот
(`handoffs/PROD-20261006-01/step-04b-code-design-validator-r1.json`, замечания N1–N10) и решениям ORCH в
`handoffs/PROD-20261006-01/step-04-code-designer-r2.json`; редакция r1 — по замечаниям F1–F16
(`handoffs/PROD-20261006-01/step-04b-code-design-validator.json`, `handoffs/PROD-20261006-01/step-04-code-designer-r1.json`);
первая редакция (r0) — `handoffs/PROD-20261006-01/step-04-code-designer.json`. Требование — блок REQ-009 в `docs/requirements.yaml` (15
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

Что изменено в r3 (решения ORCH по I1–I3 из r2): I1 — новый тип `PLAN_RETRY` (каталог 37): `PLANNING_STARTED` один раз за этап и без `attempt`, перехода `planning → planning` нет — п. 4 (вступление), 4.1, 5.2 (И13, И20), 5.3, 9 (фразы), 11 (`EVENT_TYPES`), TM-38, TM-62, п. 19 (P3); I2 — подтверждено ORCH, текст не менялся; I3 — запись decisions/0017 пишет DOC-UPDATER.

Что изменено в r4 (правка CODE-DESIGNER REQ-010 r1 по решению ORCH, `handoffs/PROD-20261006-01/step-07-code-designer-r1.json`;
схема, каталог 37 типов, причины `TASK_FAILED`, редьюсер и места записи не меняются): новый метод писателя
`writer.importResultBytes` — п. 6.4 (таблица методов), новый п. 6.8, п. 11 (`Writer`), п. 13 (строка `files.js`), п. 14
(README), TM-63, п. 15.2 (мутант); фразы сбоя и `FAIL_DETAIL` (проект REQ-010 п. 8.6) — п. 9 (три строки, экспорт), п. 11
(`language.js`); перечень событий REQ-010 — п. 4.2 (столбец «Кто» у `TASK_REVIEW`), п. 17.

Что изменено в r2: N1 — п. 15.1 (вступление, TM-13, TM-14, TM-45, TM-47), п. 15.3 (режим библиотеки `fault-inject.js`:
`installFaults`, `withFaults`, восстановление); N2 — п. 4.1 (`PROJECT_PAUSED`, `PROJECT_RESUMED`, `PROJECT_RECOVERED`),
5.1 (`paused_by` вместо `recovered`), 5.2 (И13), 5.3, 6.3 (шаг 8.6, связь с REQ-013), 10.2 (`pause`), 12, TM-19, TM-54,
п. 17, P11; N3 — п. 4.1 (`MEMORY_ADDED.executor`), 5.2 (И12), 6.4 (`addMemory`), TM-53, п. 17; N4 — п. 4 (вступление),
4.1, 4.2, 6.4 (шаг 2), 11 (`EVENT_TYPES`), TM-08, п. 16 (R2); N5 — п. 6.7 (шаг 4), 14, TM-50, п. 19 (I5, I6, P8, P9);
N6 — TM-14, п. 12; N7 — п. 15.1 (абзац после таблицы), п. 19 (I2, I4 удалены), п. 16 (Q12); N8 — п. 4.2
(`TASK_WAITING_USER`), 5.2 (И19), TM-55; N9 — п. 6.5 (`scenario_bytes`), TM-59, п. 17; N10 — п. 2.1 (`PROJECT_ENTRIES`),
TM-03, п. 17.

Что изменено в r5 (конфликт, найденный TEST-DESIGNER, `handoffs/PROD-20261006-01/step-14-test-designer.json`,
`result.issues` №1; решения ORCH (1)–(4) в `handoffs/PROD-20261006-01/step-04-code-designer-r5.json`; схема, каталог 37
типов, поля событий и места записи не меняются): восстановление выполняется **только после аварии** — снят устаревший
замок или отброшена оборванная последняя строка; при штатно закрытом писателе его нет (решение (1)); прерываются только
задачи с открытым запуском и задачи `running`, задача `review` без открытого запуска остаётся `review` (решение (2));
`PROJECT_RECOVERED` — только если что-то прервано (решение (3)). Правки (решение (4)): п. 0 (F11), 4.1
(`PROJECT_RECOVERED`), 4.2 (`TASK_INTERRUPTED`), 5.2 (И13, новый И21), 6.3 (шаг 8, абзацы после него), 12, 14, 15.1
(вступление; TM-12, TM-17, TM-19, TM-38, TM-51, TM-54 — «до/после» в п. 15.1a; новые TM-64, TM-65), 15.2, 16 (Q13, R2),
17, 18, 19 (P11, I7, I8).

Что изменено в r6 (малая правка по вопросу №1 CODE-FIXER, `handoffs/PROD-20261006-01/step-15-code-fixer.json`,
`result.issues`; решение ORCH (1)–(3) в `handoffs/PROD-20261006-01/step-04-code-designer-r6.json`; схема, каталог 37
типов, поля событий, места записи и коды ошибок не меняются): (1) **сломанный** писатель (п. 6.4, шаг 8) при `close()`
замок **не снимает** — замок с pid остаётся, как после аварии, и следующий открывающий восстанавливает проект по r5
(п. 6.3, шаг 8); (2) закрытие всех открытых запусков на всех путях выхода — обязанность вызывающего (REQ-010, `runTask`,
п. 8.2 шаг 8 проекта REQ-010); для случая «записать закрытие нельзя» ядро даёт `writer.markBroken()`; (3) инвариант И22:
штатно закрытый писатель оставляет проект без открытых запусков (кроме I7). Правки: п. 0 (F12), 5.2 (И22), 6.2
(`releaseLock`), 6.3 (шаг 8 — причина «замок остался», абзацы после него), 6.4 (таблица методов: `markBroken`, `close`; новый
шаг 10), 11 (`Writer`), 12, 15.1 (вступление, TM-66), 15.1b (TM-13, TM-14, TM-47 — до/после), 15.2, 16 (Q10, Q13, R2), 17, 18,
19 (I7, новый I9, P11, P12).

Что изменено в r7 (по проекту REQ-010 r5 и FAIL приёмки `handoffs/PROD-20261006-01/step-20-release-validator.json`, F9 и F6;
решение ORCH `handoffs/PROD-20261006-01/step-07-code-designer-r5.json`; схема, каталог, поля событий и места записи не меняются;
список добавлен в r8 по замечанию L3 ворот `handoffs/PROD-20261006-01/step-24-code-design-validator.json`): F9 — п. 9 (суффикс
`SCRIPTED_SUFFIX` и у фраз `MEMORY_ADDED` проекта scripted), TM-38 («до/после» суффикса у `MEMORY_ADDED`); F6 — п. 15.1
(вступление: тесты исполнителей — `tools/test/exec-*.test.js`, граница файлов ядра и исполнителей).

Что изменено в r9 (малая правка по F2 ворот тестов `handoffs/PROD-20261006-01/step-32-test-design-validator.json` и замечаниям ревью и проверки безопасности; решения ORCH — `handoffs/PROD-20261006-01/step-34-code-designer.json`; схема, каталог 37 типов, поля событий, коды ошибок, места записи и правила кода **не меняются** — таблицы приведены к фактическим тестам): п. 6.4 (геттер `writer.broken`), 12 (S2 — остаточный риск, ссылка на README и P14; S6 — гонка `lock.js`), 14 (S2 уже назван в README-разделе — подтверждено), 15.1 (TM-19, TM-64 (B), TM-67 — фактические тесты), 15.1c (строки TM-19 ×2, TM-64 (B), TM-67), 19 (информация S6).

Что изменено в r10 (малая правка по находке TEST-DESIGNER `handoffs/PROD-20261006-01/step-33-test-designer.json`, `result.issues` №1 (BLOCKED); решение ORCH — `handoffs/PROD-20261006-01/step-35-code-designer.json`; схема, каталог 37 типов, поля событий, коды ошибок, `reduce` и условие восстановления (признаки «обрыв» / «незакрытая работа») **не меняются**): находка — писатель A при восстановлении закрывал запуск и прерывал задачу отдельными записями и мог потерять замок до `PROJECT_RECOVERED`; следующий держатель замка не видел ни открытых запусков, ни задач `running` и `PROJECT_RECOVERED` не писал — проект оставался «в работе» без работы. Решение: события шагов 8.4–8.6 пишутся **одним пакетом** (одна запись в файл, один `fsync`, один откат `ftruncate`; проверка замка до пакета; `seq` подряд); `LOCK_STALE_REMOVED` и `JOURNAL_RECOVERED` — отдельными записями до пакета. Правки: п. 1 (`journal.js`, TM-68), 5.2 (новый И23), 6.3 (шаг 8: вводная, пакет шагов 8.4–8.6, «ровно один раз»), 6.4 (шаг 7 и новый раздел «Пакет»), 11 (`journal.js`), 12 (две строки), 13 (`journal.js`), 15.1 (вступление; TM-67 — строгие итоговые утверждения; новый TM-68), новый 15.1d, 15.2 (мутанты), 16 (Q5, Q10, Q13), 18, 19 (P11, новый I10).

Что изменено в r12 (малая правка по итоговым воротам `handoffs/PROD-20261006-01/step-46-code-design-validator.json`; схема, каталог 37 типов, поля событий, коды ошибок, `reduce`, условие восстановления и правила кода **не меняются**): F1 — п. 15.1, строка TM-67: убрано «`LOCK_STALE_REMOVED` не больше одного» (уведомлений может быть несколько — гонка F6/S6; проверка — каждый `pid` не более одного раза и из этого раунда, как п. 15.1c, 15.1d и тест); L1 — шапка поднята до r12 (в перечень добавлены r11 и r12); L4 — п. 10.3 (тексты `E_USAGE`, правило «ошибка разбора не повторяет аргументы»), п. 11 (`errors.js`: `escapeUnsafe`, одна безопасная строка ошибки), п. 15.1 (новая строка: `team-security.test.js`, шесть тестов F2–F4 проверки безопасности).

Что изменено в r11 (малая правка по решению ORCH, `handoffs/PROD-20261006-01/step-42-code-designer.json`; схема, каталог 37 типов, поля событий, коды ошибок, `reduce`, условие восстановления и правила кода **не меняются**): строки TM-67 в п. 15.1, 15.1c и 15.1d приведены к принятому решению (снято «открыт ≥ 1» и «хотя бы один открывающий успешен»; допустимые исходы проигравшего — открыт / `E_PROJECT_BUSY` / `E_LOCK_LOST`; проверка `pid` уведомления `LOCK_STALE_REMOVED` сужена — упавший писатель или один из открывающих этого раунда, без повторов); F-1 безопасности (Low) — остаточный риск в п. 12, 14, 19 (I10, P15), возможное закрытие названо, не введено; TM-68 (п. 15.1, 15.1d) — «0 обращений к журналу при потере замка до пакета» (находка M03 ворот).

Что изменено в r8 (схема, каталог 37 типов, поля событий, коды ошибок и места записи не меняются): **S1** (проверка
безопасности `handoffs/PROD-20261006-01/step-25-security-reviewer.json`; решение ORCH в
`handoffs/PROD-20261006-01/step-26-code-designer.json`) — восстановление делает получивший замок, если журнал оборван или в нём
есть открытые запуски или задачи `running`; `stalePid` — только уведомление: п. 0 (F13), 4.1 (`PROJECT_RECOVERED`), 5.2 (И13,
И21, И22), 6.2 (шаг 5), 6.3 (шаг 8, абзацы после него), 6.4 (шаг 10), 12, 14, 15.1 (вступление; TM-17, TM-19, TM-54, TM-64,
TM-66; новый TM-67), новый 15.1c, 15.2, 16 (Q10, Q12, Q13, R2), 17, 18, 19 (I7 закрыт, P11, новый P13); **S2** — остаточный
риск учёта расхода: п. 12, 14, 16 (Q10), 19 (P14); **S3, S4** — п. 19 (информация); **L3** — шапка (r8, список r7); **L4** — п.
11 (`mask.js` импортирует и `runner.js` REQ-010); **L5** — п. 6.7 (отказ жёсткой ссылке, `nlink = 1`).

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
| F11 | (r5) Код r4 восстанавливает при каждом `openWriter`, даже после штатного `close()` | скрипт во временном `SAI_TEAM_HOME` `<вне проекта>` (`perl -e 'alarm 20; exec @ARGV' node …`): `createProject`, `PROJECT_STARTED`, `TASK_CREATED`, `TASK_STARTED`, `RUN_STARTED work`, `RUN_FINISHED ok`, `TASK_REVIEW`, `close()`; снова `openWriter` + `close()`; `readEvents` | типы по порядку: `… RUN_FINISHED TASK_REVIEW TASK_INTERRUPTED(cause:recovery) PROJECT_RECOVERED` — конфликт подтверждён; задача «на проверке» прерывается и проект встаёт на паузу без всякой аварии |
| F12 | (r6) Код до r6: `close()` снимает замок и у сломанного писателя | копия кода до правки `<вне проекта>/fix-recover-before/team/store.js`, метод `close` (чтение: `this.#closed = true; releaseLock(...)` без проверки `#broken`); проба во временном `SAI_TEAM_HOME` (`perl -e 'alarm 30; exec @ARGV' node …`): `createProject`, `openWriter`, сбой `writeSync` (`fault-inject.js`, EIO) → `E_DISK`, затем `E_WRITER_BROKEN`, `close()`, проверка `writer.lock` | на коде до правки замок после `close()` снят (так и читается в копии); на коде при пробе (CODE-FIXER уже привёл `close()` к правилу (1), шаг 16) — замок остался: проба «lock after close: true» у сломанного и «false» у здорового писателя. Значит, без правила r6 следующий открывающий не видит аварии, а открытый запуск не прерывается (И16 не даёт начать задачу снова) |
| F13 | (r8, S1) Код r7: признак аварии живёт только в процессе, снявшем устаревший замок; в гонке открывающих восстановления нет | чтение `tools/src/team/store.js` (`recover`: `const crashed = stalePid !== null \|\| journal.tail !== null; if (!crashed) return;`); проба G проверки безопасности (`handoffs/PROD-20261006-01/step-25-security-reviewer.json`), повторена своим запуском во временных `SAI_TEAM_HOME`/`HOME` `<вне проекта>` (`perl -e 'alarm 240; exec @ARGV' node parent.mjs G`; авария с открытым `r-00001` и задачей `running`, замок мёртвого pid, 6 одновременных `openWriter` + `say` + `close`, 20 раундов) | код r7: открытый запуск остался после гонки в 19 из 20 раундов и после ещё одного открытия — тоже 19; восстановлено 1; копия кода до r5: 0, 0, 20. Значит, условие восстановления должно не зависеть от снявшего замок (п. 6.3, шаг 8, r8) |

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
| `tools/src/team/journal.js` | чтение журнала, добавление строки или пакета строк (r10) с fsync, усечение | BACKEND-DEV |
| `tools/src/team/lock.js` | замок писателя | BACKEND-DEV |
| `tools/src/team/files.js` | файлы результатов, чтение файла из `work/` | BACKEND-DEV |
| `tools/src/team/store.js` | API ядра: создание, писатель, чтение | BACKEND-DEV |
| `tools/src/team/cli.js` | команды `projects`, `project`, `events`, `say`; обёртка `runGuarded` | BACKEND-DEV |
| `tools/package.json` | только скрипт `"team": "node src/team/cli.js"` | BACKEND-DEV |
| `tools/README.md` | раздел «## Sai Team — ядро» (п. 14) | BACKEND-DEV |
| `tools/test/team-*.test.js`, `tools/test/team-helpers.js` | тесты TM-01…TM-68 (п. 15; r8: TM-67; r10: TM-68) и помощник тестов | TEST-DESIGNER |
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

**(N10) Состав папки проекта — списком.** Допустимые записи папки проекта перечислены одним замороженным списком
`PROJECT_ENTRIES` в `home.js`: постоянные — `events.jsonl` (файл), `files/` (папка), `work/` (папка), `scenario.json`
(файл, только у scripted), `writer.lock` (файл, только пока право взято); временные (остатки аварий, их убирает писатель,
п. 6.3, шаг 7) — `writer.lock.<pid>.new`, `writer.lock.stale-<pid>` (шаблонами). Ядро и тест TM-03 берут состав из этого
списка, а не из своего перечня. Будущий канал приёма команд движком (REQ-013, I3), если он будет файлом или папкой в
папке проекта, добавляется в `PROJECT_ENTRIES` записью в проекте REQ-013 (имя, файл или папка, права 0600/0700, кто
пишет и кто читает); условие — запись лежит **вне** `work/` и не называется `events.jsonl`, `files`, `writer.lock*`,
`scenario.json`. Правка TM-03 тогда не нужна: тест сверяет папку со списком.

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
ядро»): их пишут внутренние пути `createProject`, `openWriter`, `writeResultFile`/`importWorkFile` (F8, F4). Таких типов
пять (N4): `PROJECT_CREATED`, `PROJECT_RECOVERED`, `RESULT_FILE`, `LOCK_STALE_REMOVED`, `JOURNAL_RECOVERED`. Кроме того,
два значения поля — только ядра (пишет только восстановление `openWriter`): `TASK_INTERRUPTED.cause = "recovery"` и
`RUN_FINISHED.outcome = "interrupted"`; через публичный `append` — `E_EVENT` «Значение … пишет только ядро». Новый тип в
будущем — только правкой этого проекта; тест TM-38 перечисляет типы из схемы и сам потребует фразу и фикстуру (F12).

Обозначения: «Задача» — поле `task`: `обяз.` / `нет` (`null`) / `можно`. Статус: проекта (П) или задачи (З). Действие на
поля состояния и условия — п. 5.3. Кто пишет: 009 — ядро; 010 — исполнители; 013 — движок. Всего типов — **37** (35 из
r0, `PROJECT_RECOVERED` — F4, и `PLAN_RETRY` — r3, I1).

### 4.1. Проект

| Тип | Источник | Задача | `data` (поле: вид) | Статус | Кто |
|---|---|---|---|---|---|
| `PROJECT_CREATED` | ENGINE | нет | `goal: text≤GOAL_MAX`, `budget_usd: money 0..BUDGET_MAX` (0 — «потолка нет», F2), `executor: code ∈ EXECUTORS`, `scenario_file: code ∈ {"scenario.json"} или null` (не `null` — только при `executor = scripted`) | П → `created`; только `seq = 1` | 009, только ядро (`createProject`) |
| `PROJECT_STARTED` | USER | нет | `parallel: int 1..3` | П `created` → `running` | 013 |
| `PLANNING_STARTED` | ENGINE | нет | `round: int 0..2` | П `created`, `running` → `planning`; пишется **один раз** за этап «планирование»; из `planning` — отказ (И20, критерий 11 REQ-013) | 013 |
| `PLAN_REJECTED` | ENGINE | нет | `round`, `attempt: int 1..2` (номер отклонённой попытки), `reason: code ∈ {schema, cycle, too_many, unknown_role, bad_dependency}`, `detail: text≤DETAIL_MAX` | — (П `planning`) | 013 |
| `PLAN_RETRY` | ENGINE | нет | `round`, `attempt: int = 2` | — (П `planning`; статус не меняется); только после `PLAN_REJECTED` с `attempt = 1`; И20 (r3, I1) | 013 |
| `PLAN_RECEIVED` | ENGINE | нет | `round`, `tasks: list≤40 of {id: id, role: code, text: text≤TEXT_MAX, done_when: text≤DONE_WHEN_MAX, depends_on: list<id>, critical: bool}` | П `planning` → `running`; все задачи плана **одной строкой** | 013 |
| `PROJECT_WAITING` | ENGINE | можно | `reason: code ∈ {plan_failed, budget, task_failed, review_failed, approval, goal_check_failed}` | П `planning`, `running` → `waiting_user` | 013 |
| `PROJECT_PAUSED` | USER | нет | `{}` | П `planning`, `running`, `waiting_user` → `paused` (`paused_by = "user"`) | 013 |
| `PROJECT_RESUMED` | USER, ENGINE | нет | `parallel: int 1..3 или null`, `after: code ∈ {command, decision, budget, recovery}` | П `paused`, `waiting_user` → `running`; из `running`/`planning` — **никогда** (N2); `after` по И13 | 013 |
| `PROJECT_RECOVERED` | ENGINE | нет | `from_status: code ∈ {planning, running}`, `closed_runs: int ≥0`, `interrupted_tasks: int ≥0` | П `planning`, `running` → `paused` (`paused_by = "recovery"`, «прервано аварией»; N2, И13); (r5, r8) только в восстановлении `openWriter` (п. 6.3, шаг 8: оборванная строка или открытые запуски / задачи `running` в журнале нового держателя замка) и только если в нём закрыт хотя бы один запуск или прервана хотя бы одна задача (`closed_runs + interrupted_tasks ≥ 1`) | 009, только ядро (`openWriter`, восстановление) |
| `PROJECT_STOPPED` | USER | нет | `{}` | П любой неконечный → `stopped` | 013 |
| `PROJECT_DONE` | ENGINE | нет | `{}` | П `running` → `done`; И6 | 013 |
| `PROJECT_FAILED` | ENGINE | нет | `reason: code ∈ {user_rejected, unrecoverable}`, `detail: text≤DETAIL_MAX` | П любой неконечный → `failed` | 013 |
| `GOAL_CHECK_STARTED` | ENGINE | нет | `round: int 0..2`, `run_id: id` (открытый запуск `goal_check`) | — | 013 |
| `GOAL_CHECK_RESULT` | ENGINE | нет | `round`, `run_id`, `passed: bool`, `notes: text≤TEXT_MAX` | — | 013 |
| `BUDGET_SPENT` | ENGINE | можно | `run_id: id`, `cost_usd: money`, `accounted: code ∈ {reported, assumed}`, `total_usd: money` | — | 010 |
| `BUDGET_SET` | USER | нет | `budget_usd: money >0 ≤BUDGET_MAX` (и > `spent_usd`) | — | 013 |
| `CHAT` | USER, ENGINE | можно | `text: text≤TEXT_MAX`, `kind: code ∈ {message, question}` (`question` — только ENGINE), `truncated: bool` | — | 009 (`say`); 013 |
| `MEMORY_ADDED` | ENGINE, AGENT, USER | можно | `kind: code ∈ {fact, decision, note}`, `text: text≤TEXT_MAX`, `executor: code ∈ EXECUTORS` — **обязателен при `source = AGENT`**, при ENGINE/USER запрещён (N3, И12) | — | 009 (API), 010/013 |
| `RESULT_FILE` | ENGINE | можно | `name: name`, `bytes: int 0..FILE_BYTES_MAX`, `sha256: hash`, `kind: code ∈ {result, draft}`, `from_work: bool` | — | 009, только ядро (`writeResultFile`, `importWorkFile`) |
| `LOCK_STALE_REMOVED` | ENGINE | нет | `pid: int ≥1` | — | 009, только ядро (`openWriter`; N4) |
| `JOURNAL_RECOVERED` | ENGINE | нет | `line: int ≥2`, `dropped_bytes: int ≥1` | — | 009, только ядро (`openWriter`; N4) |

### 4.2. Задача и запуск

| Тип | Источник | Задача | `data` | Статус | Кто |
|---|---|---|---|---|---|
| `TASK_CREATED` | ENGINE, USER | обяз. (следующий `t-NNNN`) | `role: code ∈ ROLES`, `text: text≤TEXT_MAX`, `done_when: text≤DONE_WHEN_MAX`, `depends_on: list<id>≤40`, `critical: bool` | З → `waiting` | 009 (API), 010, 013 |
| `TASK_STARTED` | ENGINE | обяз. | `{}` | З `waiting`, `interrupted`, `failed`, `review`, `waiting_user` → `running`; И3 | 010, 013 |
| `RUN_STARTED` | ENGINE | обяз. для `work`, `review`; нет для `plan`, `goal_check` | `run_id: id` (следующий `r-NNNNN`), `purpose: code ∈ {work, review, plan, goal_check}`, `role: code ∈ ROLES`, `executor: code ∈ EXECUTORS`, `max_budget_usd: money или null` | — (И7, И12, И16) | 010 |
| `AGENT_ACTIVITY` | AGENT | как у его `RUN_STARTED` | `run_id: id` (открытый), `activity: code ∈ {reading, searching, writing, thinking, other}`, `executor: code ∈ EXECUTORS`, `text: text≤SUMMARY_MAX или null` | — (И12) | 010 |
| `RUN_FINISHED` | ENGINE | как у его `RUN_STARTED` | `run_id`, `outcome: code ∈ {ok, failed, timeout, cancelled, interrupted, invalid_output, not_found, network}`, `summary: text≤SUMMARY_MAX или null`, `cost_usd: money или null`, `files: list<name>≤RUN_FILES_MAX` | — (запуск закрыт; И15) | 010; 009 (восстановление; `outcome: interrupted` — только ядро, N4) |
| `RUN_REFUSED` | ENGINE | обяз. | `reason: code ∈ {budget_exhausted}`, `detail: text≤DETAIL_MAX` | — (И18) | 010 |
| `TASK_RETRY` | ENGINE | обяз. | `next_attempt: int ≥2`, `delay_ms: int ≥0`, `reason: code ∈ {failed, timeout, invalid_output, network}` | — (З `running`) | 010 |
| `TASK_REVIEW` | ENGINE | обяз. | `{}` | З `running` → `review` | 010 (r4), 013 |
| `REVIEW_RESULT` | ENGINE | обяз. | `run_id` (запуск `review` этой задачи), `passed: bool`, `notes: text≤TEXT_MAX` | — (З `review`) | 013 |
| `TASK_REASSIGNED` | ENGINE | обяз. | `from_role: code`, `to_role: code`, `reason: text≤DETAIL_MAX` | — (З `review`, `failed`, `interrupted`, `waiting`); меняет роль | 013 |
| `TASK_WAITING_USER` | ENGINE | обяз. | `reason: code ∈ {approval, review_failed}`, `draft: name или null` — правило И19 (N8): при `approval` задача `critical` и `draft` обязателен (файл `kind: draft` этой задачи) | З `running`, `review` → `waiting_user` | 013 |
| `DECISION_RECEIVED` | USER | обяз. | `decision: code ∈ {approve, change, reject}`, `text: text≤TEXT_MAX или null` (обязателен при `change`) | — (З `waiting_user` или `failed`; `approve` — только `waiting_user`) | 013 |
| `TASK_DONE` | ENGINE | обяз. | `via: code ∈ {review, approval}`, `external_action_done: bool` (при `approval` всегда `false`) | З → `done`; И4 | 013 |
| `TASK_FAILED` | ENGINE | обяз. | `reason: code ∈ {retries_exhausted, rejected_by_user, executor_not_found, invalid_output, result_file}`, `detail: text≤DETAIL_MAX` | З `running`, `review`, `waiting_user`, `interrupted`, `waiting` → `failed` | 010, 013 |
| `TASK_INTERRUPTED` | ENGINE | обяз. | `cause: code ∈ {recovery, stop, cancel}` | З `running`, `review` → `interrupted`; открытых запусков задачи быть не должно (И14); (r5) при `cause: recovery` задача `review` — только если её запуск `review` закрыт `interrupted` в этом восстановлении (И21): «на проверке» без открытого запуска не прерывается | 009 (восстановление; `cause: recovery` — только ядро, N4), 010, 013 |

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
  paused_by: "user" | "recovery" | null,     // кто поставил paused: PROJECT_PAUSED / PROJECT_RECOVERED; null вне paused (N2)
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
| И12 (F3, N3) | У **каждого** события с `source = AGENT` (это `AGENT_ACTIVITY` и `MEMORY_ADDED`; других типов с источником AGENT в каталоге нет) в `data` есть `executor`, равный `executor` проекта; `RUN_STARTED.executor` тоже равен `executor` проекта; у `AGENT_ACTIVITY` `executor` равен ещё и `executor` его запуска. Нет поля при AGENT (или есть при ENGINE/USER у `MEMORY_ADDED`) — `E_EVENT` (проверка формы) | `E_TRANSITION` (`details.rule = "И12"`) |
| И13 (F4, N2, r5) | `PROJECT_RECOVERED` — настоящая смена статуса: только из `planning`/`running`, без открытых запусков и без задач `running` (задачи `review` без открытого запуска допустимы и остаются `review`, r5), `closed_runs + interrupted_tasks ≥ 1` (r5: если ничего не прервано, события нет); ставит `paused`, `paused_by = "recovery"`. (r8, S1) Пишет его восстановление `openWriter` того процесса, который **получил** замок, по признаку п. 6.3, шаг 8 (оборванная строка или открытые запуски / задачи `running`), — не по тому, кто снял устаревший замок. Пока `status = paused` и `paused_by = "recovery"`, запрещены события, начинающие работу: `PLANNING_STARTED`, `PLAN_RETRY`, `PLAN_RECEIVED`, `TASK_STARTED`, `RUN_STARTED`, `TASK_REVIEW`, `GOAL_CHECK_STARTED` (`PROJECT_DONE` и `PROJECT_WAITING` из `paused` запрещены таблицей п. 4.1). `PROJECT_RESUMED` — только из `paused` или `waiting_user` (из `running`/`planning` — отказ: смены статуса нет); `after` строго по причине: `paused_by = "recovery"` → `recovery`; `paused_by = "user"` → `command`; `waiting_user` → `decision` или `budget`; иное — отказ. Событий «смена статуса» без смены в каталоге нет: каждый тип со столбцом «Статус» вида `A → B` имеет `A ≠ B` | `E_TRANSITION` |
| И14 (F4) | `TASK_INTERRUPTED` — только если у задачи нет открытых запусков (их закрывает `RUN_FINISHED` раньше) | `E_TRANSITION` |
| И15 (F5) | `RUN_FINISHED.files`: каждое имя — файл из `state.files` с той же `task`, что у запуска, записанный после `started_seq` запуска | `E_TRANSITION` |
| И16 (F5) | `RUN_STARTED`: `work` — задача `running`, роль запуска = роль задачи; `review` — задача `review`, роль `reviewer`; `plan` — `task` нет, проект `planning`, роль `project_manager`; `goal_check` — `task` нет, проект `running`, роль `reviewer`; у задачи не больше одного открытого запуска | `E_TRANSITION` |
| И17 (F5) | Событие с непустым `task` (кроме `TASK_CREATED`, где это новый id) ссылается на существующую задачу проекта | `E_TASK_NOT_FOUND` |
| И18 (F5) | `RUN_REFUSED` — задача в `waiting`, `running`, `interrupted` или `failed` и без открытого запуска | `E_TRANSITION` |
| И19 (N8) | `TASK_WAITING_USER`: при `reason = approval` задача `critical === true` и `draft` не `null` — имя из `state.files` с `kind = "draft"` и `task` этой задачи; при `reason = review_failed` `draft` — `null` или имя из `state.files` с `task` этой задачи. Иначе отказ | `E_TRANSITION` (`details.rule = "И19"`) |
| И20 (r3, I1) | План: `PLANNING_STARTED` — только из `created`/`running`, ставит `plan.attempt = 1` и `plan.last_rejection = null`; `PLAN_REJECTED` — только в `planning`, его `attempt` = `plan.attempt`; `PLAN_RETRY` — только в `planning`, при `plan.last_rejection ≠ null`, `plan.attempt = 1` и своём `round = plan.round`; ставит `plan.attempt = 2`; после `PLAN_REJECTED` с `attempt = 2` `PLAN_RETRY` — отказ. Перехода `planning → planning` нет: вторая попытка — это `PLAN_RETRY`, а не `PLANNING_STARTED` | `E_TRANSITION` |
| И21 (r5) | `TASK_INTERRUPTED {cause:"recovery"}`: задача `running` — всегда (при И14); задача `review` — только если последний закрытый запуск `review` этой задачи (`runs.closed`, `purpose = review`, `task` = задача) начат после `review_since_seq` и закрыт с `outcome = interrupted`; иначе (задача «на проверке» без прерванного запуска) — отказ. Пишется только восстановлением (r8: по признаку п. 6.3, шаг 8, у получившего замок), поэтому проверяется в `reduce` (внутренний `append` его вызывает) | `E_TRANSITION` (`details.rule = "И21"`) |
| И22 (r6) | **Штатно закрытый писатель оставляет проект без открытых запусков** (`runs.open` пуст после `writer.close()` несломанного писателя). Свойство вызывающих (REQ-010 `runTask`, REQ-013 движок), а не `reduce`: `reduce` не видит `close()`. Исключение — I7 (ручное удаление замка, ошибка программы вызывающего). Сломанный писатель этого не обязан: он оставляет замок, и запуски закрывает восстановление (п. 6.3, шаг 8.4). **(r8, S1)** Поэтому открытые запуски и задачи `running`, которые новый держатель замка видит в журнале, — признак аварии «незакрытая работа» (п. 6.3, шаг 8): прежнего держателя под новым замком нет, а штатно закрытый писатель их не оставляет; нарушение И22 (I7) тоже больше не оставляет проект «в работе» навсегда — следующий держатель замка его восстанавливает | — (проверяют TM-64, TM-66, TM-67, EX-52, EX-53) |
| И23 (r10) | **После записи пакета восстановления (п. 6.3, шаги 8.4–8.6) проект не содержит открытой работы** (`runs.open` пуст, задач `running` нет) **и** его статус `paused` с `paused_by = "recovery"`, **либо** проект до пакета не был `planning`/`running` (тогда статус прежний). Пакет записан весь или журнал как был (п. 6.4, «Пакет»), поэтому состояния журнала «запуски закрыты и задачи прерваны восстановлением, а `PROJECT_RECOVERED` нет» при статусе `planning`/`running` запись восстановления не оставляет — ни при сбое записи или `fsync` с удачным откатом, ни при потере замка до пакета. Свойство писателя, а не `reduce` (`reduce` применяет события пакета как обычную последовательность). Исключение — двойной сбой (сбой записи и неудавшийся откат) и обрыв внутри записи пакета (п. 12, I10) | — (проверяют TM-67, TM-68) |

Попытки задачи (`attempts`) = число `RUN_STARTED` `purpose: work` по задаче (прерванный запуск — тоже попытка).

### 5.3. Действие каждого типа на состояние (F5)

Общее для **каждого** события: `last_seq = seq`, `last_ts = updated_at = ts`. «Задача: `updated_at`» — у задачи из
`task` ставится `updated_at = ts`. «Меняет задачу» — событие ставит `tasks_changed_seq = seq` (это и есть «изменение
задачи» для И6). Ничего, кроме названного, событие не меняет.

| Тип | Поля состояния | Меняет задачу (И6) |
|---|---|---|
| `PROJECT_CREATED` | всё состояние: `id`, `goal`, `executor`, `budget_usd`, `scenario_file`, `status = created`, `created_at`, `spent_usd = 0`, `paused_by = null`, `parallel = null`, `plan = {round:0, attempt:0, last_rejection:null}`, `goal_check = {round:0, passed:null, seq:null}`, `tasks_changed_seq = null`, `waiting = null`, пустые `tasks`, `runs = {next:1, open:{}, closed:{}, charged:[]}`, `memory`, `files`, `chat` | нет |
| `PROJECT_STARTED` | `status = running`, `parallel` | нет |
| `PLANNING_STARTED` | `status = planning`, `plan.round`, `plan.attempt = 1`, `plan.last_rejection = null` | нет |
| `PLAN_REJECTED` | `plan.last_rejection = {reason, detail}` | нет |
| `PLAN_RETRY` | `plan.attempt = 2` (статус и `plan.round` не меняются) | нет |
| `PLAN_RECEIVED` | `status = running`; задачи плана добавлены (как `TASK_CREATED` каждая); `plan.last_rejection = null` | да |
| `PROJECT_WAITING` | `status = waiting_user`, `waiting = {reason, task}` | нет |
| `PROJECT_PAUSED` | `status = paused`, `paused_by = "user"`; `waiting` сохраняется (вопрос остаётся видимым) | нет |
| `PROJECT_RESUMED` | `status = running`, `waiting = null`, `paused_by = null`, `parallel` (если не `null`) | нет |
| `PROJECT_RECOVERED` | `status = paused`, `paused_by = "recovery"` (`waiting` и так `null`: в `planning`/`running` его нет) | нет |
| `PROJECT_STOPPED` / `PROJECT_FAILED` | `status = stopped` / `failed`, `waiting = null`, `paused_by = null` | нет |
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
`PROJECT_DONE`; `PROJECT_PAUSED` его сохраняет. `ProjectState.paused_by` ставят `PROJECT_PAUSED` (`user`) и
`PROJECT_RECOVERED` (`recovery`); очищают `PROJECT_RESUMED`, `PROJECT_STOPPED`, `PROJECT_FAILED`.

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
5. `LOCK_STALE_REMOVED {pid: stalePid}` пишет `openWriter` (п. 6.3), а не `acquireLock`. **(r8, S1)** `stalePid` — только
   уведомление о снятом замке, **не условие восстановления**: в гонке открывающих устаревший замок может снять один процесс
   (он получит `E_PROJECT_BUSY`, его уведомление теряется), а свободное имя `writer.lock` займёт другой (у него `stalePid =
   null`). Восстановление делает тот, кто получил замок, по журналу (п. 6.3, шаг 8), поэтому оно не теряется.

Отдача права (`releaseLock`): прочитать `writer.lock`; свой `pid` — `unlinkSync`; иначе ничего не трогать. **(r6)** Вызывается
только из `close()` несломанного писателя (п. 6.4, шаг 10); сломанный писатель замок не отдаёт.

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
8. Восстановление. **(r8, S1; решение ORCH, `handoffs/PROD-20261006-01/step-26-code-designer.json`)** Писатель, **получивший
   замок** (шаг 4), восстанавливает проект, если в журнале шага 5: **признак «обрыв»** — оборвана последняя строка, **или признак «незакрытая работа»** — есть открытые
   запуски (`runs.open` не пуст) или задачи `running`. Признак не зависит от того, кто снял устаревший замок (`stalePid` — только
   уведомление, шаг 8.2; п. 6.2, шаг 5): под новым замком прежнего держателя уже нет, а штатно закрытый несломанный писатель
   открытых запусков и задач `running` не оставляет (И22); в долгоживущем движке REQ-013 замок держит сам этот писатель и
   открывает проект один раз. Было (r5–r7): `crashed = (stalePid !== null) || (обрыв)` — признак жил только в процессе, снявшем
   замок, и в гонке открывающих терялся вместе с восстановлением (F13). Замок сломанного писателя (r6, п. 6.4, шаг 10) после
   смерти его процесса снимается как устаревший, а его открытые запуски дают признак «незакрытая работа». Задача `review` без открытого
   запуска признаком не является и остаётся `review` (r5). Нет ни одного признака — шаги 8.1, 8.3–8.6 **ничего не пишут и ничего не
   прерывают** (в том числе после штатного `close()`: TM-64); шаг 8.2 пишется при `stalePid ≠ null` в любом случае. По порядку,
   все события — от ENGINE; **(r10)** шаги 8.2 и 8.3 — каждое событие отдельным внутренним `append` (п. 6.4), шаги 8.4–8.6 —
   **один внутренний пакет** (п. 6.4, «Пакет»):
   1. последняя строка оборвана (нет `\n` в конце или не JSON) — `ftruncateSync` до начала оборванной строки,
      `fsyncSync`;
   2. `LOCK_STALE_REMOVED {pid}` — если замок был устаревшим;
   3. `JOURNAL_RECOVERED {line, dropped_bytes}` — если усекали;
   4. **(F4)** `RUN_FINISHED {run_id, outcome:"interrupted", summary:null, cost_usd:null,
      files:[]}` — для каждого открытого запуска (`runs.open`: `work`, `review`, `plan`, `goal_check`) по порядку
      `run_id`, с `task` запуска;
   5. `TASK_INTERRUPTED {cause:"recovery"}` по порядку id — для каждой задачи `running` и для
      каждой задачи `review`, чей запуск `review` закрыт на шаге 8.4 (r5, решение ORCH (2), И21). Задача `review` без
      открытого запуска (ждёт проверки REQ-013 после удачного `run-task` REQ-010) остаётся `review`; задачи `waiting`,
      `waiting_user`, `failed`, `done`, `interrupted` не трогаются. (Задача `running` прерывается и без открытого
      запуска — авария между `TASK_STARTED` и `RUN_STARTED` или в паузе перед повтором: без писателя ей некому
      продолжить, а И13 не допускает `running` при `PROJECT_RECOVERED`; I8);
   6. **(F4, N2)** `PROJECT_RECOVERED {from_status, closed_runs, interrupted_tasks}` — если
      статус проекта `planning` или `running` **и** в пакете на шагах 8.4–8.5 есть хотя бы одно событие (r5, решение ORCH
      (3)); (r10) `closed_runs` и `interrupted_tasks` — число событий шагов 8.4 и 8.5 **в этом же пакете**; проект переходит
      в `paused` с `paused_by = "recovery"` («прервано аварией»). Иначе статус проекта не
      меняется; если ничего не прервано, восстановление — только технические `LOCK_STALE_REMOVED`/`JOURNAL_RECOVERED`.

   **(r10, решение ORCH) Шаги 8.4–8.6 — один пакет.** Писатель составляет события шагов 8.4, 8.5, 8.6 по порядку на копии
   состояния после шагов 8.1–8.3 (каждое — на состоянии после предыдущего события пакета; статус для шага 8.6 — статус проекта
   до пакета) и пишет их **вместе** (п. 6.4, «Пакет»): проверка замка — **до** пакета; одна запись в файл (конкатенация целых
   строк); один `fsync`; при сбое — один откат `ftruncate` к длине журнала до пакета; `seq` событий пакета идут подряд; `reduce`
   применяет пакет как обычную последовательность событий. Итог: пакет записан **весь** или журнал **как был до пакета**
   (строки шагов 8.2–8.3, записанные раньше отдельными записями, остаются — это уведомления, состояния работы они не меняют).
   Пустой пакет (нет открытых запусков и прерываемых задач) не пишется. Сбой пакета (`E_LOCK_LOST`, `E_CONFLICT`, `E_DISK`)
   ломает писателя (п. 6.4, шаг 8); `openWriter` бросает эту ошибку, `close()` сломанного писателя замок не снимает (шаг 10) —
   незакрытая работа остаётся в журнале целиком, и её восстанавливает следующий держатель замка (И23). Было (r8–r9): каждое
   событие шагов 8.4–8.6 — отдельным `append`; писатель, потерявший замок между ними (п. 6.2, шаг 4, F6), оставлял закрытые
   запуски и прерванные задачи без `PROJECT_RECOVERED`, а следующий держатель не видел признака и проект оставался «в работе»
   без работы (step-33).

   Причина: у открытого запуска или задачи `running`, которые видит новый держатель замка, нет живого писателя — работа,
   которую вёл прежний процесс, оборвалась; оборванная строка — тоже след оборванной записи. Задача `review` без открытого
   запуска — не работа процесса, а ожидание проверки, её восстановление не прерывает. **Ровно один раз:** восстановление
   идёт под замком, и после него в журнале нет ни открытых запусков, ни задач `running`, ни оборванной строки — следующий
   держатель замка признака не видит (TM-19, TM-67); (r10) пакет не оставляет промежуточного состояния, поэтому признак
   исчезает вместе с `PROJECT_RECOVERED`, а не раньше него (И23, TM-68). Остаточный риск гонки трёх процессов на устаревшем замке (п. 6.2, шаг 4,
   F6): писатель Б, потерявший замок, может быть жив с открытым запуском — держатель В его восстановит (`RUN_FINISHED
   interrupted`), а Б узнает о потере при следующем `append` (`E_LOCK_LOST`) и больше не пишет; так было и до r8 (проба C
   step-25).
9. Вернуть `Writer`; `writer.notices` — строки о снятом замке, восстановлении, закрытых запусках, прерванных задачах,
   «Работа проекта прервалась — продолжите её командой возобновления» (при `PROJECT_RECOVERED`), сужении прав.

(r5, r8) Повторный захват после штатного `close()` несломанного писателя, закрывшего свои запуски (И22; замок снят чисто,
последняя строка целая), ничего не дописывает — при любом статусе проекта, в том числе с задачей `review` после `run-task`
REQ-010 (критерий 5г, TM-19, TM-64). Повторный захват после восстановления — тоже: восстановивший писатель закрывается штатно,
признака больше нет. **(r8)** Открытые запуски и задачи `running` при штатном `close()` несломанного писателя — ошибка
вызывающего (REQ-010/013 закрывают свои запуски на всех путях выхода до `close()`, п. 17, И22); прежде (r5–r7) ядро их не
трогало и проект оставался «в работе» навсегда (I7), теперь следующий держатель замка восстанавливает их по признаку «незакрытая работа»
(TM-64 (B)). **(r6)** Сломанный писатель — не штатное закрытие: замок остаётся, запуски закрывает восстановление после смерти
процесса (TM-66).

Связь с REQ-013 (критерии 10 и 11 REQ-013, N2): после восстановления проект `paused` с `paused_by = "recovery"`;
`resume` пишет `PROJECT_RESUMED {after:"recovery"}` — настоящий переход `paused → running` (И13), затем снова начинает
задачи `interrupted` (`TASK_STARTED` из `interrupted` разрешён), новая попытка засчитывается. Каждое событие смены
статуса в этой цепочке (`TASK_INTERRUPTED`, `PROJECT_RECOVERED`, `PROJECT_RESUMED`, `TASK_STARTED`) меняет статус —
событий смены статуса без смены нет (критерий 11 REQ-013).

### 6.4. Добавление (`writer.append(input)` → `Event`)

Вход: `{ source, type, task?, data, ts? }`. Всё — в одном синхронном вызове, под взятым замком:

1. Писатель сломан → `E_WRITER_BROKEN` «Запись прервана сбоем; откройте проект заново».
2. Тип из «только ядро» (`PROJECT_CREATED`, `PROJECT_RECOVERED`, `RESULT_FILE`, `LOCK_STALE_REMOVED`,
   `JOURNAL_RECOVERED`) или значение «только ядро» (`TASK_INTERRUPTED.cause = "recovery"`,
   `RUN_FINISHED.outcome = "interrupted"`) через публичный `append` → `E_EVENT` (F8, F4, N4); внутренний `append`
   восстановления и путей файлов их пропускает. Проверка формы по каталогу (в том числе `executor` при `source = AGENT`,
   N3) → иначе `E_EVENT` с полем.
3. Маскирование полей `text` (п. 3.4), проверка пределов и шаблонов на маскированном.
4. Конверт: `seq = last_seq + 1`, `ts` по п. 3.2, `project = id`; проверка времени → `E_TIME`.
5. `reduce(state, event)` на копии → `E_TRANSITION` / `E_TASK_NOT_FOUND` с правилом.
6. Строка = `JSON.stringify(event) + "\n"`; длина > `LINE_BYTES_MAX` → `E_EVENT_TOO_BIG`.
7. Запись (`journal.appendLine`; r10: одна строка — частный случай пакета, `appendLine` и `appendBatch` пишут одним внутренним помощником `journal.js` — путь записи один):
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
10. **(r6, решение ORCH (1)) Закрытие `writer.close()`** — всё в одном вызове, не бросает ошибок, повторный вызов ничего не
    делает:
    - писатель помечается закрытым (дальше любой метод записи — `E_WRITER_BROKEN`);
    - **несломанный** писатель — `releaseLock` (п. 6.2): замок снят, проект свободен;
    - **сломанный** писатель (шаг 8: любой сбой записи, `fsync`, `ftruncate`, `E_LOCK_LOST`, `E_CONFLICT`; а также вызов
      `markBroken()`) — замок **не снимается**: `writer.lock` с pid процесса остаётся, как после аварии. Записей в журнал,
      удалений и переименований `close()` сломанного писателя не делает.
    Следствия для следующего открывающего (`openWriter`, п. 6.3): (а) процесс-писатель завершился, его pid мёртв — замок
    устаревший и снимается (`LOCK_STALE_REMOVED` — уведомление у снявшего), а восстановление (r8: по признаку п. 6.3, шаг 8 —
    открытые запуски / задачи `running` или обрыв строки — у того, кто получил замок; шаг 8.4–8.6 одним пакетом (r10): `RUN_FINISHED interrupted`
    на каждый открытый запуск, `TASK_INTERRUPTED`, `PROJECT_RECOVERED`) — штатный путь; (б) процесс жив — замок «прижизненный»:
    `E_PROJECT_BUSY` «Проект занят другим процессом (pid N)» до его завершения, в том числе для нового писателя **того же**
    процесса. Это принято: процесс-писатель команды — короткоживущий CLI (после ошибки он завершается). Долгоживущий
    процесс (движок REQ-013) со сломанным писателем обязан завершить процесс или закрыть писателя с сохранением замка (то есть
    вызвать `close()`) и не открывать этот проект снова в этом процессе (п. 17). Замок чужого процесса (`E_LOCK_LOST`)
    `close()` и раньше не трогал (`releaseLock` снимает только свой pid) — не меняется.
    Остаточный риск: pid мёртвого писателя переиспользован живым процессом — проект «занят» (п. 6.2, ложное «занят»).

Защита в той же операции: проверка формы, маскирование, переходы, время, проверка замка и запись — один вызов. **(r6)** Решение,
снимать ли замок при закрытии, принимается внутри `close()` по состоянию писателя (шаг 10), а не вызывающим: «проверить
состояние сейчас, снять замок потом» вызывающему не доверено.

**Пакет (r10, решение ORCH; внутренний `#appendBatch(inputs)` писателя → `Event[]`).** Только для восстановления (п. 6.3,
шаги 8.4–8.6); публичного метода, экспорта и обёртки нет — вызывающие ядро пакетов не пишут. Вход — непустой массив входов
вида шага 2 (тип и значения «только ядро» допустимы, как у внутреннего `append`). Всё в одном синхронном вызове, под взятым
замком:

1. Писатель сломан или закрыт → `E_WRITER_BROKEN` (как шаг 1).
2. Для каждого входа по порядку — шаги 2–6 на состоянии после предыдущего события пакета (копия): `seq` = `last_seq + 1`,
   `+ 2`, … подряд; `ts` — п. 3.2, «не раньше предыдущего» — и относительно предыдущего события пакета; `reduce` — как для
   отдельной записи (И13, И14, И21 проверяются на своём месте последовательности; особых правил «пакета» в `reduce` нет).
   Любой отказ → ошибка, **ничего не записано**, `state` и `bytes` прежние; писатель не сломан (записи не было).
3. Буфер — конкатенация строк пакета (каждая — целая строка с `\n`, каждая ≤ `LINE_BYTES_MAX`; отдельного предела пакета нет:
   строк не больше, чем открытых запусков и задач, плюс одна).
4. Запись `journal.appendBatch(file, bytes, lines, lockCheck)` — шаг 7 для всего буфера: проверка замка **один раз, до
   записи** (`E_LOCK_LOST` — ничего не записано); `openSync`; `fstatSync` — размер равен `bytes`, иначе `E_CONFLICT`; цикл
   `writeSync` до конца буфера; **один** `fsyncSync`; `closeSync`.
5. Сбой шага 4 — как шаг 8: писатель сломан всегда; при сбое `writeSync`/`fsyncSync` — **один** откат `ftruncateSync(fd,
   bytes)` + `fsyncSync` к длине до пакета, `E_DISK`, `details = { os_code, rollback }`. Откат удался — в журнале ни одной
   строки пакета (журнал байт-в-байт как до пакета). Откат не удался — двойной сбой (п. 12): после сбоя `fsync` в файле
   весь пакет; после сбоя записи — часть пакета (I10).
6. Только после успешного `fsyncSync`: `state` = состояние после последнего события пакета, `bytes +=` длина буфера; вернуть
   события по порядку.

Защита в той же операции: проверка замка, проверка размера, запись всех строк пакета и `fsync` — один вызов `appendBatch`;
«проверить замок, записать часть, проверить снова» нет.

Удобные методы — обёртки над внутренним `append` (своих мест записи журнала нет):

| Метод | Событие |
|---|---|
| `writer.say(text)` | `CHAT {text, kind:"message", truncated:false}`, USER |
| `writer.addTask({role, text, done_when, depends_on = [], critical = false}, source = "ENGINE")` | `TASK_CREATED` |
| `writer.addMemory({kind, text, task = null, executor = null}, source = "ENGINE")` | `MEMORY_ADDED`; при `source = "AGENT"` `executor` обязателен и равен исполнителю проекта, иначе не передаётся (N3, И12) |
| `writer.writeResultFile({task = null, name, content, kind = "result"})` | файл (п. 6.6) + `RESULT_FILE {from_work:false}` |
| `writer.importWorkFile({task = null, path, name?, kind = "result"})` | файл из `work/` (п. 6.7) + `RESULT_FILE {from_work:true}` |
| `writer.importResultBytes({task = null, name, bytes, kind = "result"})` (r4) | файл из байтов в памяти (п. 6.8) + `RESULT_FILE {from_work:false}` |
| `writer.markBroken()` (r6) | ничего не пишет; помечает писателя сломанным (как после сбоя шага 8: дальше `E_WRITER_BROKEN`, `close()` замок не снимает). Для вызывающего, который не смог записать закрытие запуска (REQ-010, п. 8.2 шаг 8); повторный вызов и вызов у закрытого писателя ничего не делают; не бросает |
| `writer.broken` (r9) | геттер только для чтения: `true`, если запись журнала сорвалась (сбой `writeSync`, `fsync`, `ftruncate`, проверки замка или размера — шаг 8) или вызван `markBroken()`; иначе `false`. Ничего не пишет и не бросает; не меняет поведения писателя — им пользуются тесты (TM-13, TM-14, TM-47, TM-66), чтобы проверить «писатель сломан» без попытки записи. Закрытый, но не сломанный писатель даёт `false` |
| `writer.close()` (r6) | шаг 10: несломанный — снимает замок; сломанный — замок остаётся; не бросает |
| `writer.nextTaskId()`, `writer.nextRunId()` | id, ничего не пишут |
| `writer.workDir` | абсолютный путь `<HOME>/<id>/work` — cwd исполнителя REQ-010 |
| `writer.scenarioPath` | абсолютный путь копии сценария или `null` — для scripted REQ-010 |

### 6.5. Создание проекта (`createProject(input, opts)` → `{ id, state }`)

Вход: `{ goal: string, budget_usd: number, executor: string, scenario_bytes?: Buffer | null }`. Всё или ничего:

1. Проверка входа (как `PROJECT_CREATED`, п. 4.1, после маскирования цели) → `E_EVENT`. `budget_usd` — 0..`BUDGET_MAX`
   (**0 разрешён**, F2: «потолка нет»; запрет настоящих запусков без потолка — в исполнителе claude-cli REQ-010, отказ
   команды `new` на 0 — REQ-010). `scenario_bytes` — только при `executor = scripted` (иначе `E_EVENT`
   «Сценарий допустим только для тестового исполнителя»). **(N9)** Это `Buffer` (не строка: строка → `E_EVENT`) длиной
   ≤ `SCENARIO_BYTES_MAX`; проверка — строгое декодирование `TextDecoder("utf-8", {fatal:true})` (не UTF-8 → `E_EVENT`) и
   `JSON.parse` декодированной строки даёт объект (иначе `E_EVENT`). Проверка не меняет сами байты: на диск идёт тот же
   `Buffer` (шаг 4). Файл сценария читает вызывающий — `fs.readFileSync(путь)` **без кодировки** (получается `Buffer`;
   `new --scenario` REQ-010); ядро не открывает путей вне `<HOME>`. Поэтому sha256 копии равен sha256 исходного файла
   (критерий 16(г) REQ-010) при любых байтах, в том числе с BOM (декодер его пропускает при проверке, байты остаются).
2. `<HOME>` — п. 2.2 (создать или сузить).
3. id = `p-<YYYYMMDD по UTC из now()>-<6 шестнадцатеричных знаков>` из `opts.randomId()` (по умолчанию
   `crypto.randomBytes(3)`); никогда не из текста пользователя. `<HOME>/<id>` уже есть (`lstat`) — новый id, до 5 раз,
   затем `E_DISK`.
4. `mkdirSync(<HOME>/.creating-<id>, 0o700)`; в ней `files/` и `work/` (0700); `scenario.json`, если сценарий дан
   (`writeFileSync`, `{flag:"wx", mode:0o600, flush:true}`, данные — **тот же входной `Buffer` `scenario_bytes`**, без
   перевода в строку и обратно, без маскирования — P9, N9);
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
   (`lstat`, не ссылка) **с одной жёсткой ссылкой** (r8, L5: `nlink = 1` и у `lstat`, и у `fstat` — иначе это может быть
   жёсткая ссылка на файл вне `work/`); открыть `O_RDONLY|O_NOFOLLOW`, `fstatSync` — обычный файл, `nlink = 1`, тот же
   `dev`/`ino`, что у `lstat`, размер ≤ `FILE_BYTES_MAX`. Иначе (нет файла, ссылка, жёсткая ссылка, папка, слишком большой,
   файл подменён) → `E_WORK_FILE`.
4. Прочитать байты; декодировать UTF-8 строго (`TextDecoder("utf-8", {fatal:true})`) → иначе `E_WORK_FILE`
   («не текст»). **Принято ORCH (I5, N5):** из `work/` принимаются только текстовые файлы UTF-8, двоичные отклоняются
   `E_WORK_FILE`; названо в README (п. 14) и в P9.
5. Дальше — п. 6.6, шаги 3–7 (маскирование, `.partial`, `linkSync`, 0600, `RESULT_FILE {from_work:true}`).
6. Файл в `work/` не меняется и не удаляется.

Исполнитель REQ-010 при отказе `E_WORK_FILE`/`E_FILE_NAME`/`E_FILE_EXISTS` пишет `TASK_FAILED {reason:"result_file"}` —
это его логика; ядро только отказывает, ничего не записав.

### 6.8. Файл результата из байтов (`writer.importResultBytes`, r4)

Как файлы результата, которые исполнитель держит в памяти (тестовый исполнитель scripted REQ-010 ничего не пишет на диск),
становятся файлами результата. Вход: `{ task = null, name, bytes, kind = "result" }` (у проекта — тот писатель, на
котором вызван метод; чужой проект недостижим). Всё в одном вызове, отказ — ничего не записано:

1. Писатель сломан или закрыт → `E_WRITER_BROKEN` (как у других методов).
2. `name` — проверка п. 6.6.1 → `E_FILE_NAME`.
3. `bytes` — `Buffer` (иначе `E_EVENT` «Файл результата должен быть текстом UTF-8»), длина ≤ `FILE_BYTES_MAX` (иначе
   `E_EVENT` «Файл результата слишком большой»); строгое декодирование `TextDecoder("utf-8", {fatal:true})` (не UTF-8 →
   `E_EVENT` «Файл результата должен быть текстом UTF-8») — то же правило, что у `work/` (только текст, I5/N5).
4. Дальше — п. 6.6, шаги 3–7 (маскирование, `.partial` через `publishResultFile`, `linkSync`, 0600,
   `RESULT_FILE {from_work:false}`).

Новой точки записи нет: файл пишет то же первое место п. 13 (`files.js`, `publishResultFile`), событие — внутренний
`append`. TM-04 остаётся «ровно четыре места»; критерий 2 выполнен. Проверка — TM-63.

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
| `PLAN_RETRY` | — | Руководитель проекта составляет план заново |
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
| `RUN_FINISHED` | `network` | Нет доступа к сети (r4) |
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
| `TASK_FAILED` | `retries_exhausted` и `detail = FAIL_DETAIL.network` (r4) | {name}: нет доступа к сети, задача не получилась |
| `TASK_FAILED` | `retries_exhausted` и `detail = FAIL_DETAIL.budget` (r4) | {name}: потолок расходов исчерпан, задача остановлена |
| `TASK_FAILED` | прочее | {name}: задача не получилась |
| `TASK_INTERRUPTED` | — | Работа над задачей прервана |
| неизвестный тип | — | В проекте произошли изменения (`NEUTRAL_PHRASE`; кода типа нет) |

Правила таблицы:

- (r4, проект REQ-010 п. 8.6) Строка `RUN_FINISHED` `network` больше не обещает повтор (его объявляет только
  `TASK_RETRY`); две строки `TASK_FAILED` по `detail` стоят перед строкой «прочее». `FAIL_DETAIL` — замороженная таблица
  постоянных текстов `detail` (ключи и тексты — проект REQ-010 п. 8.3), экспорт этого модуля.
- Проект с `executor = scripted`: к каждой фразе событий `TASK_*`, `RUN_*`, `AGENT_ACTIVITY` и (r7, по проекту REQ-010 r5
  п. 6.3 и EX-04) `MEMORY_ADDED` добавляется « — тестовый исполнитель» (`SCRIPTED_SUFFIX`); подготовка для критерия 2 REQ-010, проверяется TM-38 (вторая фикстура на проекте
  scripted; F12).
- Ни одна фраза таблицы не содержит: «токен», «контекст», «промт», «prompt», «token», «context», «JSON», «stderr», «exit»,
  «%», «процент», «percent», «настоящий», «реальный», «Claude», «ИИ», «AI», «демо», «demo», «демонстрац» (без учёта
  регистра).
- Три образца владельца (критерий 11): `TASK_STARTED` `business_analyst` → «Аналитик изучает данные»; `TASK_CREATED`
  `marketer` с `depends_on` = [задача `financial_analyst` не в `done`] → «Ожидает результат от финансового аналитика»;
  `TASK_REASSIGNED` → «К проекту подключён дополнительный специалист».

Экспорт: `PHRASES`, `NEUTRAL_PHRASE`, `SCRIPTED_SUFFIX`, `FAIL_DETAIL` (r4), `phrase(event, stateBefore)`, `phrasesForJournal(events)`.

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
ProjectSummary = { id, goal, status, status_text, executor, created_at, updated_at, pause?: { by, text },
                   progress?: { done, total }, tail?: { line, bytes }, error?: { code, message } }
ProjectView = { id, goal, status, status_text, executor, budget_usd, spent_usd, created_at, updated_at,
                pause?: { by: "user" | "recovery", text },
                progress?: { done, total }, waiting?: { reason_text, task },
                tasks: [{ id, role_title, text, done_when, depends_on, critical, status, status_text,
                          attempts, files, phrase }],
                memory: [{ kind, text, task }], files: [{ name, task, bytes, kind }],
                chat: [{ seq, ts, source, kind, text, task }],
                tail?: { line, bytes, text: "Последняя строка журнала не дописана" } }
EventView = { seq, ts, source, type, task, data, phrase }
```

(N2) `pause` есть только при `status = paused`: `by` — `paused_by` состояния, `text` — «по вашей команде» (`user`) или
«прервано аварией — возобновите проект» (`recovery`); так вывод честно показывает прерванную работу, а не «в работе».
Нет ни кода роли, ни `internal`, ни `scenario_file`, ни путей `work/` в `ProjectView`/`ProjectSummary`. `budget_usd: 0`
означает «потолка нет». В `say` строки `notices` называют восстановление, снятый замок, закрытые запуски, прерванные
задачи, прерванную работу проекта и сужение прав.

### 10.3. Ошибки

| Код | Выход | Сообщение | Когда | Что не меняется |
|---|---|---|---|---|
| `E_USAGE` | 2 | «Неизвестная команда …», «Нужен id проекта», «--limit: целое от 1 до 200», «--after: целое ≥ 0», «Нужен --text»; (r12, по коду `cli.js`) «Неизвестный параметр», «Лишний аргумент», «Параметр указан дважды», «Нужно значение параметра». Правило: ошибка разбора **не повторяет** ни аргументов, ни их значений (ни ключ, ни пароль, набранные по ошибке, в вывод не попадают) | разбор аргументов | ничего не читается и не пишется |
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
| `errors.js` | `class TeamError extends Error { code; details }`; `EXIT = { OK:0, REFUSED:1, USAGE:2, INTERNAL:3 }`; `exitCodeFor(err)`; `fromOsError(err, action: "write" \| "read")`; `escapeUnsafe(text) → string` (r12: каждый управляющий символ — C0, DEL, C1, U+061C, U+200E/U+200F, U+202A–U+202E, U+2066–U+2069 — заменяется на `\uXXXX`; применяется к строке ошибки и к тексту JSON на stdout); `formatError(err) → string` (одна строка `<КОД>: <сообщение>`, переводы строк заменены пробелом, символы экранированы, без стека) |
| `schema.js` | `SOURCES`, `EVENT_TYPES` (тип → `{ sources, task, fields, coreOnly, coreOnlyValues }`; `coreOnly: true` у пяти типов п. 4, `coreOnlyValues` — `{ cause: ["recovery"] }` у `TASK_INTERRUPTED`, `{ outcome: ["interrupted"] }` у `RUN_FINISHED`, иначе `{}`; N4), `EXECUTORS`, `PROJECT_STATUS`, `TASK_STATUS`, `PROJECT_STATUS_TEXT`, `TASK_STATUS_TEXT`, `FINAL_PROJECT_STATUS`, `LIMITS`, `PATTERNS` (`project`, `task`, `run`, `hash`, `ts`, `name`), `isCanonicalTs(s)`, `checkInput(input)`, `checkEnvelope(event)`, `textFields(type)`, `checkResultName(name) → { ok } \| { ok:false, reason }`, `checkWorkPath(path) → то же` |
| `roles.js` | `ROLES`, `ROLE_CODES`, `roleByCode`, `publicRole` |
| `reducer.js` | `initialState() → null`; `reduce(state, event) → ProjectState`; `replay(events)`; `progress(state)` |
| `language.js` | `PHRASES`, `NEUTRAL_PHRASE`, `SCRIPTED_SUFFIX`, `FAIL_DETAIL` (r4), `phrase(event, stateBefore)`, `phrasesForJournal(events)` |
| `view.js` | `projectSummary(state, tail)`, `projectView(state, tail, events)`, `eventView(event, stateBefore)` |
| `home.js` | `PROJECT_ENTRIES` (п. 2.1, N10); `resolveHome(env)`; `ensureHome(home) → string[]`; `inspectHome(home)`; `resolveProjectDir(home, id)`; `ensureModes(projectDir) → string[]`; `modeWarnings(projectDir) → string[]` |
| `journal.js` | `readJournal(file)`; `appendLine(file, expectedBytes, line, lockCheck: () => void) → newBytes` (r10: `appendLine` и `appendBatch` — обёртки над одним внутренним помощником записи, не экспортируется); (r10) `appendBatch(file, expectedBytes, lines: string[], lockCheck: () => void) → newBytes` (п. 6.4, «Пакет»: одна проверка замка до записи, одна запись, один `fsync`, один откат); `truncateTo(file, bytes)` |
| `lock.js` | `LOCK_FILE`; `acquireLock(projectDir, pid)`; `releaseLock(projectDir, pid)`; `assertLockHeld(projectDir, pid)` (бросает `E_LOCK_LOST`); `isAlive(pid)`; `cleanLockLeftovers(projectDir)` |
| `files.js` | `publishResultFile(filesDir, name, content) → { bytes, sha256 }`; `readWorkFile(workDir, path) → string` (бросает `E_WORK_FILE`); `removeResultFile(filesDir, name)`; `cleanPartials(filesDir)` |
| `store.js` | `createProject(input, opts?)`; `openWriter(id, opts?) → Writer`; `listProjects(opts?)`; `readProject(id, opts?)`; `readEvents(id, opts?)`. `opts = { home?, env?, now?, randomId? }` |
| `store.js` (`Writer`) | поля `id`, `state`, `notices`, `workDir`, `scenarioPath`; методы `append`, `say`, `addTask`, `addMemory`, `writeResultFile`, `importWorkFile`, `importResultBytes` (r4), `nextTaskId`, `nextRunId`, `markBroken` (r6), `close` |
| `cli.js` | `main(argv, env) → exitCode`; `runGuarded(fn, io) → exitCode` |

Из `tools/src/pixel-office/` ядро импортирует только `mask.js` (`store.js`: `maskSecrets`); (r8, L4) кроме ядра его
импортирует `runner.js` проекта REQ-010 (`maskSecrets`, `prepareText` — содержимое `deps` и обрезка текстов агента). Это
импорт, а не копия правил маскирования: правила одни (критерий 12); других импортирующих в `tools/src/team/` нет.

## 12. Пути отказа (что видит пользователь и что неизменно)

| Случай | Что видит | Код | Что неизменно |
|---|---|---|---|
| Проект держит живой процесс, `say` | `E_PROJECT_BUSY: Проект занят другим процессом (pid N)` | 1 | все файлы папки проекта и их права |
| То же, `project`/`events` | обычный вывод | 0 | всё |
| Устаревший замок, `say` | успех; `notices`; в журнале `LOCK_STALE_REMOVED`, затем (r5, r8) восстановление п. 6.3, шаг 8.4–8.6 (если есть открытые запуски или задачи `running` — признак «незакрытая работа»), затем `CHAT` | 0 | задачи `review` без открытого запуска, `waiting`, `waiting_user`, `failed`, `done`; статус проекта, если ничего не прервано |
| Оборванная последняя строка, чтение | вывод по целым строкам, `tail` | 0 | все файлы |
| То же, `say` | усечение, `JOURNAL_RECOVERED`, закрытие открытых запусков, `TASK_INTERRUPTED` (задачи `running` и `review` с прерванным запуском), `PROJECT_RECOVERED` (если `planning`/`running` и что-то прервано; проект → «на паузе», `pause.by = recovery`), `CHAT` | 0 | строки до оборванной; задачи `review` без открытого запуска |
| (r5) Писатель закрыт штатно (замка нет, строка целая), в журнале задача `review` после `run-task`, `say` | успех; только `CHAT` | 0 | все прежние строки; задача `review`, проект в прежнем статусе; событий восстановления нет |
| (r8, S1) Писатель закрыт штатно, но в журнале остались открытый запуск или задача `running` (ошибка вызывающего, I7), `say` | успех; `notices` о прерванной работе; в журнале `RUN_FINISHED {interrupted}` на каждый открытый запуск, `TASK_INTERRUPTED {cause:"recovery"}`, `PROJECT_RECOVERED` (если `planning`/`running`), затем `CHAT`; `LOCK_STALE_REMOVED` нет (замок не снимался) | 0 | задачи `review` без открытого запуска и прочие; все прежние строки. Было (r5–r7): ничего не писалось, проект оставался «в работе» навсегда |
| (r8, S1) После аварии (замок мёртвого pid, открытый запуск) проект открывают несколько процессов одновременно | каждый: успех или `E_PROJECT_BUSY: Проект занят другим процессом (pid N)`; уведомление о снятом замке может достаться процессу, который получил «занят» (тогда `LOCK_STALE_REMOVED` в журнале нет) | 0 / 1 | восстановление записано **ровно один раз** — тем, кто первым получил замок; после всех — открытых запусков и задач `running` нет, замка нет. Было (r5–r7): восстановления могло не быть вовсе (проба G step-25: 18–19 из 20 раундов) |
| (r8, S2) Процесс исполнителя был запущен, но `RUN_FINISHED` или `BUDGET_SPENT` не записались (писатель сломан или процесс умер между ними) | восстановление: `RUN_FINISHED {interrupted, cost_usd:null}` (или запуск уже закрыт), `TASK_INTERRUPTED`, `PROJECT_RECOVERED`; `BUDGET_SPENT` этого запуска нет | — | журнал без выдуманного расхода. **Остаточный риск:** расход такого запуска не учитывается (`spent_usd` не растёт; фактический расход может превысить учтённый на сумму не больше `max_budget_usd` такого запуска — её ограничивает `--max-budget-usd` исполнителя REQ-010); дублей `BUDGET_SPENT` нет (И8). Назван в README (п. 14: раздел «## Sai Team — ядро») и в P14 |
| (r9, S6, Info) Три и более процесса одновременно открывают проект на устаревшем замке: проигравший гонку `lock.js` теряет замок (п. 6.2, шаг 4, F6) | проигравший: `E_PROJECT_BUSY` (замок взял другой) или, если замок отобран уже после открытия, `E_LOCK_LOST` на его записи; победитель пишет как обычно | 1 | журнал остаётся согласованным: запуски такого писателя закроет следующий держатель замка как `interrupted` (п. 6.3, шаг 8; признак — открытая работа в журнале); дублей восстановления нет (TM-67). Записанный остаточный риск п. 6.2 (F6), не меняется |
| (r10) Сбой записи пакета восстановления: потеря замка до пакета (`E_LOCK_LOST`), `E_CONFLICT`, сбой `writeSync` или `fsyncSync` с удачным откатом (`E_DISK`) | открывающий: эта ошибка с её текстом (п. 10.3); писатель сломан, замок остаётся (свой — после выхода процесса снимается как устаревший; чужой — не тронут) | 1 | журнал байт-в-байт как до пакета (строки `LOCK_STALE_REMOVED`/`JOURNAL_RECOVERED`, записанные до пакета, остаются); ни одного события пакета; незакрытая работа видна следующему держателю замка, и он восстанавливает её одним пакетом ровно один раз (И23, TM-68) |
| (r10) Двойной сбой при записи пакета: сбой `writeSync` **и** неудавшийся откат, или обрыв внутри записи пакета (процесс убит или питание пропало посреди одной записи) | `E_DISK …; откат не удался …` (если процесс жив) | 1 | за пределами критерия 4 (там один сбой), как строка «Частичная запись `writeSync` и неудавшийся откат» ниже: в журнале может остаться начало пакета — целые строки и оборванная; оборванную отбросит следующий писатель (шаг 8.1). Если среди оставшихся целых строк уже все `RUN_FINISHED`/`TASK_INTERRUPTED`, а `PROJECT_RECOVERED` оборван, проект остаётся `planning`/`running` без работы — **остаточный риск**, вопрос I10. Сбой `fsync` с неудавшимся откатом оставляет пакет целиком — И23 выполнен. (r11, F-1 проверки безопасности, Low) **Остаточный риск:** смерть процесса или сбой питания в середине записи пакета — если цела только часть пакета, начало (например закрытие review-запуска) остаётся без `PROJECT_RECOVERED`: следующий держатель замка открытой работы не видит и восстановления не пишет; простое закрытие — возможная будущая правка (I10, P15), в r11 не введено |
| Испорченная строка не последней | `E_CORRUPT: … в строке N …` | 1 | все файлы и права |
| Несуществующий / кривой id | `E_NOT_FOUND: Проект не найден` | 1 | всё; к файлам вне `<HOME>` не обращались |
| Кривой `--limit`/`--after` | `E_USAGE` | 2 | всё |
| Длинный текст `say` | `E_TOO_LONG` | 1 | журнал |
| ENOSPC/EIO на `writeSync`, сбой `fsyncSync` | `E_DISK … (ENOSPC)` | 1 | (F13, N6) откат удался — журнал прежний байт-в-байт; сбой `fsyncSync` (строка уже записана целиком) и откат не удался — прежний плюс одна целая строка (событие записано, `rollback: "failed"`); состояние без события; писатель сломан (F1) — оба исхода в рамках критерия 4 |
| Частичная запись `writeSync` **и** неудавшийся откат | `E_DISK …; откат не удался …` | 1 | (N6) прежний плюс часть строки — двойной сбой, за пределами критерия 4 (там один сбой); часть отбросит следующий писатель (п. 6.3, шаг 8.1, `JOURNAL_RECOVERED`). В тесты критерия 4 не входит; состояние в памяти без события, писатель сломан |
| Замок отобран третьим процессом | `E_LOCK_LOST` | 1 | журнал |
| (r6) Сбой записи сломал писателя, процесс закрыл его `close()` и завершился; потом `say` | успех; `notices` о снятом замке; в журнале `LOCK_STALE_REMOVED`, восстановление п. 6.3, шаг 8.4–8.6 (открытые запуски закрыты, задачи `running` прерваны), `CHAT` | 0 | задачи `review` без открытого запуска, `waiting`, `waiting_user`, `failed`, `done`; все прежние строки журнала |
| (r6) Сбой записи сломал писателя; процесс жив и сразу открывает проект снова (или другой процесс при живом первом) | `E_PROJECT_BUSY: Проект занят другим процессом (pid N)` | 1 | все файлы папки проекта, права, `writer.lock` (замок сломанного писателя остаётся) |
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
| `files.js` (`publishResultFile`) | `fs.writeFileSync(files/.partial-<имя>, …)` | файл результата (до `linkSync`); его же вызывают `importWorkFile` и `importResultBytes` (r4) | да |
| `journal.js` (`appendLine`, r10: `appendBatch` — один внутренний помощник) | `fs.openSync` + `fs.writeSync` + `fs.fsyncSync` | строка журнала или пакет строк восстановления (r10) | нет — названа здесь |
| `journal.js` (`truncateTo`, откат строки или пакета) | `fs.ftruncateSync` | усечение / откат | нет — названа здесь |

Других мест записи нет; `appendFile` и `createWriteStream` не используются. REQ-010 и REQ-013 новых мест записи журнала
не добавляют (только `writer.append`); файлы в `work/` пишет процесс агента, не код `tools/src/team/`.

## 14. README: раздел «## Sai Team — ядро» (`tools/README.md`)

Подразделы (критерий 15): что это (ядро без интерфейса и без исполнителя); где данные (`~/.sai-team`, `SAI_TEAM_HOME` —
абсолютный путь), раскладка папки проекта (`events.jsonl`, `files/`, `work/` — рабочая папка исполнителя, её содержимое не
маскируется; `scenario.json` у тестовых проектов) и права (0700/0600; писатель сужает, чтение предупреждает); что
хранится (после маскирования `[скрыто]`, правила 0013; хеши проверяются шаблоном и не маскируются); **(N5)** файлы
результата: «имена файлов результата не маскируются, проверка шаблоном» (латиница, цифры, `.`, `-`, `_`, до 80 знаков)
и остаточный риск — имя, похожее на ключ, сохраняется как есть; из `work/` в результат принимаются **только текстовые
файлы UTF-8, двоичные отклоняются** (`E_WORK_FILE`); (r4) файлы результата из памяти исполнителя
(`importResultBytes`) — то же правило: только текст UTF-8, маскирование, 0600;
журнал — единственная правда; один писатель и «проект занят» (pid, снятие устаревшего замка, остаточные риски:
повторный pid и гонка трёх процессов на устаревшем замке); восстановление после аварии (обрыв строки, прерывание задач
и запусков, проект встаёт на паузу «прервано аварией» — возобновите; испорченная середина — проект не открывается на запись);
(r5, r8) восстановление делает тот, кто получил право записи, если журнал оборван или в нём есть незакрытые запуски или
задачи «в работе» (не важно, кто снял устаревший замок): обычное повторное открытие после штатного закрытия ничего не
прерывает, задача «на проверке» без идущей проверки остаётся «на проверке»; (r8, S2) остаточный риск: если запуск исполнителя
прервался до записи своего расхода (`BUDGET_SPENT`), этот расход не учитывается — фактические траты могут быть больше учтённых
не больше чем на потолок такого запуска; (r6) писатель, у которого сбой записи,
замок при закрытии не отдаёт — проект «занят», пока жив его процесс, потом восстанавливается как после аварии (одна строка
README; пишет DOC-UPDATER вместе со строкой о ручном удалении замка, I7; тест TM-50 не расширяется); (r11, F-1) остаточный риск: смерть процесса или сбой питания в середине записи пакета восстановления оставляет часть пакета — начало (например закрытие review-запуска) без `PROJECT_RECOVERED` (одна строка README; пишет DOC-UPDATER; TM-50 не расширяется); каталог ролей;
как удалить проект (папка вручную; остатки `.creating-*`; пустая папка с тем же id при создании); команды `projects`,
`project`, `events`, `say` с примерами (вымышленные id) и кодами выхода 0/1/2/3; проверка — `cd tools && npm run check`.

## 15. Критерий → тест

### 15.1. Таблица

Файлы — `tools/test/team-*.test.js` (ядро, этот проект); (r7) тесты исполнителей — `tools/test/exec-*.test.js` (проект REQ-010, другая граница файлов: ядро их не пишет и не правит, исполнители не правят `team-*`; общий случай — TM-38 и EX-04 проверяют одну правку `language.js` каждый в своём файле). Каждый тест создаёт свой временный `SAI_TEAM_HOME` `<вне проекта>` через
`team-helpers.js`; каждый дочерний процесс — с ограничением времени (`spawnSync`/`spawn` с `timeout`); тесты не зависят
друг от друга. «Хеши» — список путей папки проекта (или `<HOME>`) с sha256 содержимого и правами, до и после. Тесты API
вызывают функции ядра в процессе теста. **(N1)** Сбои ОС критериев 4 и 13 вносит только `tools/test/fault-inject.js`:
в процессе теста — его режим библиотеки (`withFaults`/`installFaults`, п. 15.3), в дочернем процессе команды — прежняя
загрузка `--import`. `mock.method(fs, …)` остаётся только там, где нужен не сбой, а счёт вызовов (TM-15: «тест подменяет
fsync и считает вызовы», критерий 4; r10: TM-68 (е)) или подмена поведения без ошибки ОС (TM-56; r10: TM-68 (г), (д) — потеря замка). **(r5)** «Авария» в тестах
восстановления создаётся только настоящими способами п. 6.3, шаг 8: (а) дочерний процесс теста открывает писателя через
API, пишет фикстуру и убивается `SIGKILL`, не вызвав `close()` (остаётся замок мёртвого pid); (б) тест дописывает в
конец журнала оборванную строку после штатного `close()`; **(r6)** (в) дочерний процесс теста ломает писателя настоящим сбоем
`fault-inject.js`, вызывает `close()` и выходит — замок остаётся от мёртвого pid (TM-66 (1)). Фикстура, собранная через API и закрытая
`close()` несломанного писателя, без (а), (б) или (в) — «штатное закрытие»: на ней восстановления быть не должно (TM-64), **если** в
ней нет открытых запусков и задач `running`. **(r8, S1)** Условие восстановления — признаки п. 6.3, шаг 8 («обрыв», «незакрытая
работа») у того, кто получил замок, а не способ аварии: штатно закрытая фикстура с открытым запуском восстанавливается
(TM-64 (B)), а авария (а) без открытой работы даёт только `LOCK_STALE_REMOVED` (TM-12, TM-65 (1)). Гонка открывающих после
аварии — (г) (r8): после аварии (а) тест запускает N дочерних процессов, которые одновременно открывают проект (TM-67). **(r10)** Сбой
записи пакета восстановления — настоящий сбой `fault-inject.js` в дочернем процессе или потеря замка подменой (TM-68).

| Крит. | Тест | Файл | Что проверяет |
|---|---|---|---|
| 1 | TM-01 | `team-docs.test.js` | строки критерия 1 (а)–(г) в `STATE.md`, `decisions/0015-*.md`, `decisions/README.md`, `CLAUDE.md` |
| 2 | TM-02 | `team-state.test.js` | фикстура ≥ 30 событий всех видов через API; `writer.state` `deepStrictEqual` состоянию, которое дочерний процесс собирает `readProject` |
| 2 | TM-03 | `team-state.test.js` | (F9, N10) каждая запись папки проекта есть в `PROJECT_ENTRIES` (тест берёт список из `home.js`, своего перечня не держит) и подходит по виду (файл/папка) и условию (`scenario.json` — только у scripted, `writer.lock` — только пока писатель держит); производного файла состояния в списке нет; удаление всего, кроме `events.jsonl`, `files/`, `work/`, `scenario.json`, состояния не меняет; `work/` существует, 0700, и не содержит файлов ядра |
| 2 | TM-04 | `team-state.test.js` | `grep -rnE 'writeFile\|appendFile\|createWriteStream' tools/src/team/` — ровно четыре места п. 13 (два в `store.js`, `lock.js`, `files.js`) |
| 2, 3 | TM-05 | `team-state.test.js` | инварианты И2–И10: по одному недопустимому событию на правило → `E_TRANSITION`, хеш журнала тот же |
| 3 | TM-06 | `team-journal.test.js` | каждая строка — JSON с ключами `seq, ts, project, task, source, type, data`; `source` ∈ {ENGINE, AGENT, USER}; `seq` = номер строки |
| 3 | TM-07 | `team-journal.test.js` | без каждого обязательного поля — отказ, хеш тот же |
| 3 | TM-08 | `team-journal.test.js` | источник `SYSTEM`, тип `NO_SUCH_TYPE`, лишнее поле — отказ; (N4) через публичный `append` — `E_EVENT`: `PROJECT_CREATED`, `PROJECT_RECOVERED`, `RESULT_FILE`, `LOCK_STALE_REMOVED`, `JOURNAL_RECOVERED`, `TASK_INTERRUPTED {cause:"recovery"}`, `RUN_FINISHED {outcome:"interrupted"}`; хеш тот же |
| 3 | TM-09 | `team-journal.test.js` | ENGINE на 1 мс раньше — `E_TIME`, хеш тот же; с тем же временем — принято |
| 3 | TM-10 | `team-journal.test.js` | USER и AGENT на 2001 мс раньше — отказ; USER на 2000 мс раньше — принято; USER позже `now()` — отказ |
| 4 | TM-11 | `team-writer.test.js` | дочерний процесс теста держит право через API; `say` — код ≠ 0, stderr «занят» и pid; хеши те же; `project`, `events` — код 0 |
| 4 | TM-12 | `team-writer.test.js` | `kill -9` того процесса (в проекте нет открытых запусков и задач `running`); `say` — 0; в журнале `LOCK_STALE_REMOVED {pid}` и затем `CHAT` — (r5) ровно эти два новых события, статус проекта прежний |
| 4 | TM-13 | `team-writer.test.js` | (F1, F7, N1) в процессе теста `withFaults` из `fault-inject.js` с `{fn:"writeSync", paths:[<events.jsonl>]}`: `effect:"throw"` `code:"EIO"`, то же `ENOSPC`, `effect:"partial"` `code:"ENOSPC"` (настоящая запись половины буфера, затем ENOSPC) — `append` бросает `E_DISK`; после `withFaults` сбой снят (`fs.writeSync` — исходная функция), сбой сработал (`fired`); файл прежний байт-в-байт; `writer.state.last_seq` прежний; следующий `append` того же писателя — `E_WRITER_BROKEN`; новый `openWriter` после `close()` пишет нормально |
| 4 | TM-14 | `team-writer.test.js` | (F1, N1, N6) `withFaults` с `{fn:"fsyncSync", paths:[<events.jsonl>], effect:"throw", code:"EIO"}` — `E_DISK`, `details.rollback = "ok"`, файл ровно прежний байт-в-байт («записи нет»); следующий `append` того же писателя — `E_WRITER_BROKEN` (сломан и при удачном откате). Отдельно: тот же сбой `fsyncSync` и `{fn:"ftruncateSync", paths:[<events.jsonl>], effect:"throw", code:"EIO"}` — `details.rollback = "failed"`, файл ровно прежний плюс одна целая строка этого события («целая строка записана»); других исходов тест не допускает; в обоих случаях `writer.state.last_seq` прежний |
| 4 | TM-15 | `team-writer.test.js` | `mock.method` на `fsyncSync` и `writeSync`: на каждое успешное `append` ≥ 1 `fsyncSync` по дескриптору журнала после последнего `writeSync` и до возврата |
| 5 | TM-16 | `team-recovery.test.js` | (а) хвост без `\n` и отдельно хвост не JSON с `\n`; задача `running`: `project`, `events` — код 0, «не дописана», задача «в работе», хеши те же |
| 5 | TM-17 | `team-recovery.test.js` | (б) фикстура: задача `running` с открытым `work`, писатель закрыт штатно, затем обрыв последней строки (r5: замка нет; r8: оба признака — «обрыв» и «незакрытая работа»); `say`: файл усечён; `JOURNAL_RECOVERED {line, dropped_bytes}` с верными числами; `RUN_FINISHED {interrupted}`, `TASK_INTERRUPTED {cause:"recovery"}`; `notices` называют восстановление |
| 5 | TM-18 | `team-recovery.test.js` | (в) испорченная строка не последней: `say` — код ≠ 0, номер строки, хеши те же; чтение — та же ошибка |
| 5 | TM-19 | `team-recovery.test.js` | (г) второй `say` на восстановленном журнале добавляет ровно одно событие `CHAT` (r8: после восстановления признаков нет — ни обрыва, ни открытых запусков, ни задач `running`) (и при проекте, бывшем `running`, после `PROJECT_RECOVERED` он `paused` — второго `PROJECT_RECOVERED` нет); (r9) в `team-recovery.test.js` четыре теста с именем TM-19: «a second say after a recovery…» (эта строка), «a whole journal gets nothing appended» (две задачи на проверке, штатное `close()` — ничего не добавлено, кроме `CHAT`), «(r8) a task in work with no open run after a normal close…» (п. 15.1c), «reopening a project that has nothing to recover appends nothing»; (r5) фикстура TM-17 дополнена задачей `review` без открытого запуска — после первого и второго `say` она `review`, `TASK_INTERRUPTED` по ней нет |
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
| 11 | TM-38 | `team-language.test.js` | фикстура через API содержит событие каждого из 37 типов `EVENT_TYPES` (тест перечисляет и сверяет; внутренние типы — через их пути API: создание, восстановление (r5: после аварии по вступлению п. 15.1 — замок мёртвого pid или обрыв строки), файл результата); фраза каждого равна строке теста; вторая фикстура на проекте `scripted` — у фраз `TASK_*`, `RUN_*`, `AGENT_ACTIVITY`, `MEMORY_ADDED` есть `SCRIPTED_SUFFIX`, у остальных нет; (r7) «до/после»: до правки `hasScriptedSuffix` фраза `MEMORY_ADDED` проекта scripted без суффикса — тест падает, после — проходит; на проекте с другим исполнителем суффикса у `MEMORY_ADDED` нет |
| 11 | TM-39 | `team-language.test.js` | три образца владельца |
| 11 | TM-40 | `team-language.test.js` | тексты `PHRASES` без запрещённых слов п. 9 |
| 11 | TM-41 | `team-language.test.js` | неизвестный тип → `NEUTRAL_PHRASE`, кода типа нет |
| 11 | TM-42 | `team-language.test.js` | ни одна фраза не содержит кода роли; фразы о задачах содержат `name`/`genitive` |
| 12 | TM-43 | `team-journal.test.js` | CHAT и `TASK_CREATED` с вымышленными `sk-ant-…`, `ghp_…`, `AKIA…`, JWT, `password=…`: поиск по файлам `<HOME>` значений не находит, `[скрыто]` есть |
| 12 | TM-44 | `team-journal.test.js` | `grep -n 'pixel-office/mask.js' tools/src/team/*.js` находит импорт; своих правил M1–M10 нет |
| 13 | TM-45 | `team-faults.test.js` | (F7, N1, API) `withFaults` из `fault-inject.js` с `{fn:"mkdirSync", paths:[<HOME>/.creating-<id>], effect:"throw", code:"EACCES"}` (id задан `opts.randomId` с вымышленным значением): `createProject` бросает `TeamError` `E_DISK`, `details.os_code = "EACCES"`, текст на русском без `    at `; хеши `<HOME>` прежние; следующий `createProject` без сбоя в том же процессе проходит |
| 13 | TM-46 | `team-faults.test.js` | ENOSPC на `writeSync` журнала при `say` (`node --import fault-inject.js src/team/cli.js`): код 1, `E_DISK … ENOSPC`, без стека, без «Uncaught»; хеши прежние |
| 13 | TM-47 | `team-faults.test.js` | (F7, N1, API) `withFaults` из `fault-inject.js` с `{fn:"writeFileSync", paths:[files/.partial-<имя>], effect:"throw", code:"EIO"}`: `writeResultFile` бросает `TeamError` `E_DISK` (`EIO`); `files/` и журнал прежние; следующий `append` того же писателя проходит |
| 13 | TM-48 | `team-faults.test.js` | `effect: "bug"` на пути записи при `say` — код 3, «Внутренняя ошибка», без стека; журнал прежний; `runGuarded` с функцией, бросающей `TypeError`, — код 3 |
| 14 | TM-49 | `team-deps.test.js` | нет `dependencies`; импорты — `node:…` или относительные; `node:sqlite` нет |
| 14 | — | отчёт BACKEND-DEV | хеши `tools/src/pixel-office/**` до и после |
| 15 | TM-50 | `team-docs.test.js` | раздел «## Sai Team — ядро» и пункты п. 14 (`SAI_TEAM_HOME`, `0700`, `work/`, «занят», «восстановлен», «прервано аварией», десять названий, «вручную», четыре команды; N5: «имена файлов результата не маскируются», «UTF-8», «двоичные отклоняются», «похожее на ключ») |
| 15 | — | TEST-RUNNER / RELEASE-VALIDATOR | на копии Sai без `node_modules`: `cd tools && npm ci && npm run check` — код 0; тесты `team-*` > 0 |
| 5, 13 | TM-51 | `team-recovery.test.js` | `effect: "partial-kill"` на `writeSync` журнала во время `say`: следующий `say` восстанавливает — (r5) `LOCK_STALE_REMOVED`, `JOURNAL_RECOVERED`, одна `CHAT`; других событий нет (открытого не было), статус проекта прежний |
| 2, 3 | TM-52 | `team-state.test.js` | `PLAN_RECEIVED` с задачей вне каталога или `depends_on` вперёд — ни одной задачи не создано, хеш тот же |
| 3 | TM-53 | `team-state.test.js` | (F3, N3, И12) проект `claude-cli`: `RUN_STARTED`, `AGENT_ACTIVITY` и `MEMORY_ADDED` (AGENT) с `executor: "scripted"` — `E_TRANSITION`, `details.rule = "И12"`, хеш тот же; с `claude-cli` — принято; `MEMORY_ADDED` AGENT без `executor` и `MEMORY_ADDED` ENGINE/USER с `executor` — `E_EVENT`; тест перечисляет типы `EVENT_TYPES`, где среди источников есть AGENT, и требует у каждого поле `executor` при AGENT |
| 3, 5 | TM-54 | `team-recovery.test.js` | (F4, И13, И14, r5, r8) журнал пишет дочерний процесс через API и убивается `SIGKILL` (авария (а) вступления; обрыва строки нет; r8: восстановление — по признаку «незакрытая работа», `LOCK_STALE_REMOVED` — уведомление снявшего замок; проверки те же): проект `running`, задача A `running` с открытым `work`, задача B `review` с открытым `review`, задача C `review` без открытого запуска (`TASK_REVIEW` после `RUN_FINISHED ok`), открытый `goal_check`; `say`: дописаны `LOCK_STALE_REMOVED`, `RUN_FINISHED {interrupted}` на три запуска по порядку `run_id`, `TASK_INTERRUPTED` A и B (C — нет, C остаётся `review`), `PROJECT_RECOVERED {from_status:"running", closed_runs:3, interrupted_tasks:2}`, затем `CHAT`; (N2) статус проекта `paused`, `paused_by = "recovery"`, `project` показывает `pause.by = "recovery"` и текст «прервано аварией»; после этого `TASK_STARTED` и `PROJECT_PAUSED` — `E_TRANSITION`; `PROJECT_RESUMED {after:"command"}` — `E_TRANSITION`; `PROJECT_RESUMED {after:"recovery"}` — принято, статус `running`, затем `TASK_STARTED` и `RUN_STARTED work` A — приняты, `attempts` A = 2; на проекте `paused` по `PROJECT_PAUSED` `after:"recovery"` — `E_TRANSITION`; `PROJECT_RESUMED` из `running` (с любым `after`) — `E_TRANSITION`; `TASK_INTERRUPTED` при открытом запуске — `E_TRANSITION`; то же для `planning` с открытым `plan` (`from_status:"planning"`, затем `paused`); воспроизведение журнала теста по шагам: у каждого события, тип которого меняет статус проекта или задачи, статус до ≠ статус после (критерий 11 REQ-013) |
| 2, 3 | TM-55 | `team-state.test.js` | (F5, N8, п. 5.3, И15–И19) `RESULT_FILE` с задачей — имя в `Task.files`; `RUN_FINISHED.files` с именем, записанным до запуска или чужой задачей, — `E_TRANSITION`; `Task.reason` после `TASK_FAILED` и `null` после `TASK_STARTED`; `waiting` сохраняется после `PROJECT_PAUSED` и `null` после `PROJECT_RESUMED`; второй `BUDGET_SPENT` на тот же `run_id` — `E_TRANSITION`, на несуществующий — `E_TRANSITION`; событие с `task: "t-0099"` (нет такой) — `E_TASK_NOT_FOUND`; `RUN_STARTED work` с ролью не задачи — `E_TRANSITION`; `RUN_REFUSED` для задачи `done` — `E_TRANSITION`; `MEMORY_ADDED` с задачей не сдвигает `tasks_changed_seq` (И6: `PROJECT_DONE` после него проходит), `RESULT_FILE` с задачей — сдвигает (`PROJECT_DONE` — `E_TRANSITION`); (И19) `TASK_WAITING_USER {reason:"approval"}` для задачи `critical` без `draft`, с `draft` — именем файла `kind:"result"` или файла другой задачи — `E_TRANSITION`, `details.rule = "И19"`; с `draft` — файлом `kind:"draft"` этой задачи — принято; `approval` для задачи не `critical` — `E_TRANSITION`; `review_failed` с `draft: null` — принято; хеш при каждом отказе тот же |
| 4 | TM-56 | `team-writer.test.js` | (F6) в процессе теста: замок с мёртвым pid; `mock.method(fs, "renameSync")` перед настоящим переименованием подменяет содержимое замка живым pid Б, а после — создаёт `writer.lock` с pid В: `openWriter` — `E_PROJECT_BUSY`, `writer.lock.stale-*` нет, `writer.lock` — от В, журнал тот же. Отдельно: открытый писатель, тест переписывает `writer.lock` чужим живым pid — `append` даёт `E_LOCK_LOST`, журнал тот же, следующий `append` — `E_WRITER_BROKEN` |
| 7, 12 | TM-57 | `team-store.test.js` | (F9) в `writer.workDir` тест кладёт `notes/report.md` с вымышленным `ghp_…`: `importWorkFile({path:"notes/report.md"})` — `files/report.md` 0600, значения нет, `[скрыто]` есть, `RESULT_FILE {from_work:true}` с sha256 записанных байт; `work/notes/report.md` не изменён. Отказы `E_WORK_FILE` без записи (хеши `files/`, журнала, `<HOME>`): `../x`, абсолютный путь, ссылка наружу (и папка-ссылка в середине пути), несуществующий файл, папка, не-UTF-8, > 5 MiB |
| 7, 12 | TM-58 | `team-store.test.js` | (F10, F8) имена `plan.v2.md`, `report.2026.md`, `report_v2.md` — приняты и сохранены без изменений; `отчёт.md`, `a b.md`, `.hidden`, `a..b`, 81 знак, пустое — `E_FILE_NAME`, ничего не записано; `RESULT_FILE` через `writer.append` — `E_EVENT`; `sha256` в журнале равен хешу файла и не маскирован |
| 2, 3 | TM-59 | `team-store.test.js` | сценарий (N9): тест читает фикстуру `fs.readFileSync` без кодировки; `createProject` scripted с `scenario_bytes` — sha256 `scenario.json` равен sha256 исходного файла (и для фикстуры с BOM), 0600, `PROJECT_CREATED.data.scenario_file = "scenario.json"`, `writer.scenarioPath` указывает на него; `claude-cli` со сценарием, не-JSON, не-UTF-8 (байт `0xff`), сценарий строкой вместо `Buffer`, > 1 MiB — `E_EVENT`, `<HOME>` без новых папок; scripted без сценария — `scenario_file: null` |
| 3 | TM-60 | `team-store.test.js` | (F2) `createProject` с `budget_usd: 0` — создан, `state.budget_usd = 0`; `-1`, `100001`, `"5"`, `null` — `E_EVENT`, ничего не создано; `BUDGET_SET 0` — `E_TRANSITION` |
| 4, 6 | TM-61 | `team-writer.test.js` | (F11) папка проекта 0755 + живой замок: `say` — `E_PROJECT_BUSY`, права остались 0755; то же с испорченной серединой журнала — `E_CORRUPT`, права 0755 |
| 2, 3 | TM-62 | `team-state.test.js` | (r3, I1, И20) `PLANNING_STARTED {round:0}` → `planning`, `plan.attempt = 1`; `PLANNING_STARTED` ещё раз — `E_TRANSITION`, хеш тот же; `PLAN_RETRY` без `PLAN_REJECTED` — `E_TRANSITION`; `PLAN_REJECTED {attempt:1}`, `PLAN_RETRY {attempt:2}` — приняты, статус остался `planning`, `plan.attempt = 2`, `project` показывает «составляет план заново»; `PLAN_RETRY` второй раз и после `PLAN_REJECTED {attempt:2}` — `E_TRANSITION`; `PLAN_RECEIVED` — `running`; воспроизведение: у каждого события, меняющего статус, статус до ≠ статус после (критерий 11 REQ-013); `PLAN_RETRY` через публичный `append` с `source = USER` — `E_EVENT` |
| 2, 7, 12 | TM-63 | `team-store.test.js` | (r4) `importResultBytes({task:null, name:"note.md", bytes: Buffer UTF-8 с вымышленным ghp_…})`: `files/note.md` 0600, значения нет, `[скрыто]` есть, `RESULT_FILE {from_work:false}` с sha256 записанных байт; `work/` до и после — те же пути и хеши (пусто); отказы без записи (хеши `files/`, журнала, `<HOME>`): строка вместо `Buffer`, не UTF-8 (`0xff`), > `FILE_BYTES_MAX`, имя `../x` (`E_FILE_NAME`), существующее имя (`E_FILE_EXISTS`); со сбоем `writeFileSync` (`fault-inject.js`, EIO) — `E_DISK`, `.partial-*` нет; `grep` TM-04 после добавления метода — ровно четыре места |
| 5 | TM-64 | `team-recovery.test.js` | (r5, решение ORCH (1); r8, S1) «чистое повторное открытие не пишет восстановления; незакрытую работу восстанавливает один раз»: (A) через API, писатель закрыт `close()` (замка нет, строка целая) — проект `running`, задача A `review` после `RUN_STARTED work` + `RUN_FINISHED ok` + `TASK_REVIEW` (как после `run-task` REQ-010), открытых запусков и задач `running` нет; на нём: `openWriter` + `close()` трижды подряд, затем `say` — журнал до `say` байт-в-байт прежний (хеш), после — ровно одна новая строка `CHAT`; событий `LOCK_STALE_REMOVED`, `JOURNAL_RECOVERED`, `RUN_FINISHED {interrupted}`, `TASK_INTERRUPTED {cause:"recovery"}`, `PROJECT_RECOVERED` — 0; задача A `review`, статус проекта прежний, `notices` не называют восстановление. (B) (r8, S1) отдельно проект `running` с задачей B `running` и её открытым `work`, закрытый `close()` несломанного писателя (ошибка вызывающего, I7): **первое** `openWriter` дописывает ровно `RUN_FINISHED {run_id, outcome:"interrupted"}`, `TASK_INTERRUPTED {cause:"recovery"}` B, `PROJECT_RECOVERED {from_status:"running", closed_runs:1, interrupted_tasks:1}` (без `LOCK_STALE_REMOVED` и `JOURNAL_RECOVERED`), `notices` называют прерванную работу; затем `close()`, ещё два `openWriter` + `close()` и `say` — журнал после первого восстановления байт-в-байт прежний, после `say` — ровно одна `CHAT`; `runs.open` пуст, B `interrupted`, проект `paused` (`paused_by = "recovery"`) |
| 5 | TM-65 | `team-recovery.test.js` | (r5, решения ORCH (2), (3), И13, И21) «задача на проверке без открытого запуска остаётся после аварии»: (1) авария (а): проект `running`, задача A `review` без открытого запуска, открытых запусков нет — `say` дописывает только `LOCK_STALE_REMOVED` и `CHAT`; A `review`, проект `running`, `PROJECT_RECOVERED` нет; (2) то же с аварией (б) (обрыв строки) — только `JOURNAL_RECOVERED` и `CHAT`, итог тот же; (3) авария (а) с задачей B `running` без открытого запуска (после `TASK_STARTED`) и A `review` без запуска — `TASK_INTERRUPTED` B, `PROJECT_RECOVERED {closed_runs:0, interrupted_tasks:1}`, A `review`, проект `paused`; (4) `reduce` напрямую (чистая функция, п. 5.1): `TASK_INTERRUPTED {cause:"recovery"}` для задачи `review` без прерванного запуска `review` — `E_TRANSITION`, `details.rule = "И21"`; `PROJECT_RECOVERED {closed_runs:0, interrupted_tasks:0}` — `E_TRANSITION` (И13); `PROJECT_RECOVERED` при задаче `review` без открытого запуска и прерванной `running` — принято |
| 4, 5 | TM-66 | `team-recovery.test.js` | (r6, решение ORCH (1), И22; r8: восстановление в (1) — по признаку «незакрытая работа» у получившего замок, проверки те же) «сломанный писатель оставляет замок, следующий открывающий восстанавливает»: (1) **процесс умер** — дочерний процесс теста (`spawnSync` с `timeout`, `--import fault-inject.js`, `SAI_TEST_FAULTS` — `{fn:"writeSync", paths:[<events.jsonl>], effect:"throw", code:"EIO"}`) открывает писателя через API, в проекте `running` задача A `running` с открытым запуском `work` (`TASK_STARTED`, `RUN_STARTED`), вызывает `say` — `E_DISK`, затем `say` — `E_WRITER_BROKEN`, `close()`, выходит с кодом 0 (не `SIGKILL`). Тест: `writer.lock` **есть**, его `pid` = pid дочернего процесса (уже мёртв), журнал байт-в-байт прежний (до `say` дочернего); `openWriter` в тесте — успех, `notices` называют снятый замок и прерванную работу; события по порядку после прежних: `LOCK_STALE_REMOVED {pid}`, `RUN_FINISHED {run_id, outcome:"interrupted"}`, `TASK_INTERRUPTED {cause:"recovery"}` A, `PROJECT_RECOVERED {from_status:"running", closed_runs:1, interrupted_tasks:1}`; затем `say` — одна `CHAT`; повторное открытие — только `CHAT` (второго восстановления нет); `runs.open` пуст; (2) **процесс жив** — в процессе теста: писатель ломается (`withFaults`, `writeSync` EIO), затем `close()`: `writer.lock` есть и его содержимое байт-в-байт прежнее (`pid` = `process.pid`), хеши папки проекта до и после `close()` те же; `openWriter` в том же процессе — `E_PROJECT_BUSY` с `details.pid = process.pid`, хеши папки те же; повторный `close()` — без эффекта и без ошибки; метод записи после `close()` — `E_WRITER_BROKEN`; (3) `writer.markBroken()` у здорового писателя: следующий `say` — `E_WRITER_BROKEN`, `close()` замок оставляет (тот же контроль, что в (2)), повторный `markBroken()` и вызов после `close()` — без ошибки; (4) контроль: здоровый писатель — `close()` снимает замок (`writer.lock` нет), повторное открытие того же процесса — успех без событий; писатель, потерявший замок (`E_LOCK_LOST`, TM-56) — чужой замок после `close()` не тронут |
| 4, 5 | TM-67 | `team-recovery.test.js` | (r8, S1; решение ORCH) «гонка открывающих после аварии: восстановление ровно один раз»: раунд — новый временный `SAI_TEAM_HOME`; дочерний процесс через API пишет фикстуру (проект `running`, задача A `running` с открытым запуском `work`, задача C `review` без открытого запуска) и убивается `SIGKILL` (авария (а), замок мёртвого pid); затем тест одновременно запускает N = 6 дочерних процессов (`spawn` с ограничением времени), каждый: `openWriter` → `say("<свой номер>")` → `close()`, итог — «открыт» или код ошибки. Проверки раунда: каждый дочерний — «открыт», `E_PROJECT_BUSY` или `E_LOCK_LOST` (допустимые исходы проигравшего; `E_LOCK_LOST` — записанный остаточный риск п. 6.2, F6, S6: проигравший гонку на устаревшем замке теряет замок и больше ничего не пишет; других ошибок нет, `E_CORRUPT` нет; (r11) утверждение «хотя бы один открывающий успешен» снято — число «открыт» может быть любым, в том числе 0); в журнале ровно один `RUN_FINISHED {run_id A, outcome:"interrupted"}`, ровно один `TASK_INTERRUPTED {cause:"recovery"}` (A), ровно один `PROJECT_RECOVERED {from_status:"running", closed_runs:1, interrupted_tasks:1}` — (r10) числа строгие, по настоящей работе фикстуры (один открытый запуск, одна задача `running`); допуск «0 или 1» (step-33) отменён; (r10) эти три события идут подряд (`seq` подряд — один пакет); (r12) уведомлений `LOCK_STALE_REMOVED` может быть несколько (гонка замка F6/S6, Info: проигравший с `E_CONFLICT` остаётся сломанным и держит свой замок; после его выхода следующий открывающий снимает и этот замок и пишет второе уведомление); тест проверяет: `pid` каждого уведомления — упавший писатель или один из открывающих этого раунда, и каждый `pid` не более одного раза (`data` — ровно поле `pid`); восстановление записано раньше любой `CHAT`; `CHAT` — ровно по числу «открыт»; `runs.open` пуст, задач `running` нет, C `review`, проект `paused` (`paused_by = "recovery"`); `writer.lock` нет; ещё одно `openWriter` + `close()` — журнал байт-в-байт прежний. Раундов R = 20, все должны пройти; дочерних процессов после раунда не осталось. «До/после»: на коде r5–r7 (`crashed` только по `stalePid` или обрыву) тест падает (проба G step-25 и своя: открытый запуск остался в 18–19 раундах из 20), на коде r8 — проходит |
| 4, 5 | TM-68 | `team-recovery.test.js` | (r10, решение ORCH; И23) «пакет восстановления записывается целиком или не записывается». Фикстура — своя в каждом случае, свой временный `SAI_TEAM_HOME`; через API: проект `running`, задача A `running` с открытым запуском `work`, задача C `review` без открытого запуска. **Сбой записи пакета** — в дочернем процессе (`spawnSync` с `timeout`, `--import fault-inject.js`, `SAI_TEST_FAULTS` с `paths:[<events.jsonl>]`); фикстура закрыта штатно `close()` (признак «незакрытая работа», замка нет — первая запись открытия и есть пакет): (а) `{fn:"writeSync", effect:"throw", code:"EIO"}`; (б) `{fn:"writeSync", effect:"partial", code:"ENOSPC"}` — настоящий вызов записывает половину буфера пакета (в ней не меньше одной целой строки), затем сбой; (в) `{fn:"fsyncSync", effect:"throw", code:"EIO"}` — пакет записан целиком, затем сбой. Дочерний: `openWriter` — `E_DISK`, `details.rollback = "ok"`, выходит с кодом 0 (не `SIGKILL`). Тест: журнал байт-в-байт как до открытия (хеш), `writer.lock` с pid дочернего (мёртв). **Потеря замка** — в процессе теста, подмена без ошибки ОС (как TM-56); фикстура — авария (а) (замок мёртвого pid), поэтому `LOCK_STALE_REMOVED` пишется отдельной записью до пакета; `mock.method(fs, "closeSync")` после закрытия дескриптора журнала K-й записи открытия переписывает `writer.lock` чужим живым pid (`process.ppid`): (г) K = 1 (после `LOCK_STALE_REMOVED`, до пакета) — `openWriter` — `E_LOCK_LOST`; журнал = прежний + ровно одна строка `LOCK_STALE_REMOVED`; (r11) 0 обращений к журналу после проверки замка (счёт вызовов `writeSync`/`fsyncSync`/`ftruncateSync` по дескриптору журнала с момента потери замка — ноль); `writer.lock` — чужой, байт-в-байт; (д) K = 2 (после пакета) — `openWriter` успешен, в журнале после `LOCK_STALE_REMOVED` весь пакет, следующий `say` — `E_LOCK_LOST`, журнал не изменился. **Во всех случаях (а)–(д):** события восстановления (`RUN_FINISHED {interrupted}`, `TASK_INTERRUPTED {cause:"recovery"}`, `PROJECT_RECOVERED`) в журнале — либо все три подряд (`seq` подряд), либо ни одного. **Затем** в (а)–(г) (в (г) тест сначала заменяет замок замком мёртвого pid завершённого дочернего процесса) тест открывает проект: дописан ровно один пакет — `RUN_FINISHED {run_id A, outcome:"interrupted"}`, `TASK_INTERRUPTED {cause:"recovery"}` A, `PROJECT_RECOVERED {from_status:"running", closed_runs:1, interrupted_tasks:1}`, `seq` подряд; C `review`; `runs.open` пуст, задач `running` нет; проект `paused`, `paused_by = "recovery"`; ещё одно `openWriter` + `close()` — журнал байт-в-байт прежний. (е) счёт вызовов (`mock.method`, как TM-15) на фикстуре (а) без сбоев: за `openWriter` по дескриптору журнала ровно один `fsyncSync` (единственная запись открытия — пакет из трёх событий) и ни одного `ftruncateSync`. «До/после»: на коде r8–r9 (отдельные `append`) падают (д) (в журнале `RUN_FINISHED` без `PROJECT_RECOVERED`) и (е) (три `fsyncSync`) |
| 3, 8, 12 | — (без номера TM; r12) | `team-security.test.js` | шесть тестов проверки безопасности (F2–F4), названия по файлу: (1) «F2 a usage error never repeats the arguments of the command» — ошибка разбора: `E_USAGE`, код 2, одна строка, `stdout` пуст, ни аргумент, ни значение не повторены, файлы неизменны; (2) «F3 an error line is one line: control and bidirectional characters are escaped» — `formatError` даёт одну строку, символы заменены на `\uXXXX`; (3) «F3 JSON on stdout has no raw control or bidirectional characters, and parses back to the same data»; (4) «F3 a message with such characters is shown safely by say, events and project»; (5) «F3 a damaged journal with control characters in a field name is shown as one safe line»; (6) «F4 an event with an unknown field of a very long name is refused with E_EVENT naming the field» — критерий 3 (отказ кривому событию), журнал неизменен |

Каждый тест — с критерием; у каждого критерия — тест (1 — TM-01 и проверка до WF-02; 14 — TM-49 и отчёт; 15 — TM-50
и прогон на чистой копии). Критерии 4 и 13 выполняются буквально: сбои вносит `tools/test/fault-inject.js` — на уровне
API в процессе теста (TM-13, TM-14, TM-45, TM-47), на уровне команды через `--import` (TM-46, TM-48, TM-51).

### 15.1a. Тесты, изменённые в r5 (до → после; ни одна проверка не ослаблена)

| Тест | До (r4) | После (r5) |
|---|---|---|
| TM-12 | после `kill -9` — `LOCK_STALE_REMOVED`, затем `CHAT` | то же; добавлено: ровно два новых события, статус проекта прежний (фикстура без открытого) |
| TM-17 | обрыв строки; `JOURNAL_RECOVERED`, `TASK_INTERRUPTED` | фикстура закрыта штатно и затем оборвана (авария только по обрыву); добавлено: `RUN_FINISHED {interrupted}` на открытый `work` |
| TM-19 | второй `say` — ровно одна `CHAT`, второго `PROJECT_RECOVERED` нет | то же; добавлено: задача `review` без открытого запуска не прерывается ни первым, ни вторым `say` |
| TM-38 | события восстановления «через пути API» | то же, путь API — авария по вступлению п. 15.1 (иначе восстановления нет) |
| TM-51 | одна `CHAT` после `JOURNAL_RECOVERED` | то же; добавлено: `LOCK_STALE_REMOVED`, других событий нет, статус прежний |
| TM-54 | фикстура без способа аварии; A и B прерваны | фикстура — настоящая авария `SIGKILL`; добавлены `LOCK_STALE_REMOVED` и задача C `review` без открытого запуска, которая **остаётся** `review`; числа `PROJECT_RECOVERED` прежние (3 и 2); все прежние проверки N2/И13/И14 сохранены |
| TM-64 | — | новый: чистое повторное открытие не пишет восстановления |
| TM-65 | — | новый: задача «на проверке» без открытого запуска остаётся после аварии; `PROJECT_RECOVERED` только если что-то прервано; И21 и И13 через `reduce` |

TM-16 (чтение не меняет файлов), TM-18 (испорченная середина), TM-08 (только ядро) не меняются.

### 15.1b. Тесты, изменённые в r6 (до → после; ни одна проверка не ослаблена)

Причина: после `close()` сломанного писателя замок остаётся (п. 6.4, шаг 10), а тест живёт в том же процессе — его pid жив, и
повторное открытие в том же процессе теперь `E_PROJECT_BUSY`. Прежние тесты, которые закрывали сломанного писателя и открывали
проект заново в процессе теста, меняются; список — по чтению `tools/test/team-writer.test.js` и `team-faults.test.js`, точный состав
подтверждает прогон (CODE-FIXER ожидает падения именно этих тестов).

| Тест | До (r5) | После (r6) |
|---|---|---|
| TM-13 (четыре режима сбоя `writeSync`) | после сбоя и `E_WRITER_BROKEN`: `w.close()`, `openTracked` в том же процессе, `again.say("Заново")` — последняя строка «Заново», строк `last_seq + 1` | все проверки до `close()` прежние; после `w.close()` — `writer.lock` есть, `openWriter` в том же процессе — `E_PROJECT_BUSY` (`details.pid = process.pid`), хеш папки прежний. Проверка «следующий писатель пишет дальше» переносится в TM-66 (1) (сбой в дочернем процессе, открытие после его завершения: `LOCK_STALE_REMOVED`, затем `CHAT`, строк `last_seq + 2`; фикстура без открытых запусков и задач `running`) |
| TM-14 (откат удался; откат не удался) | то же: после `close()` — `openTracked`; во втором — `again.state.last_seq === state.last_seq + 1` (событие записано) | то же до `close()`; «событие записано» проверяется чтением журнала (`journalOf`: последняя строка — `CHAT «Сбой отката»`, `seq = state.last_seq + 1`), без повторного открытия; после `close()` — `E_PROJECT_BUSY`, хеш прежний |
| TM-47 (сбой записи события после файла, писатель сломан) | после `close()` — `openTracked` и `writeResultFile({name:"b.md"})` — `files/` = `["b.md"]` | до `close()` прежнее; после — `E_PROJECT_BUSY`, хеш прежний; проверка «имя `b.md` свободно и файл пишется после восстановления» — на писателе, открытом после смерти дочернего процесса с тем же сбоем (как TM-66 (1)) |

TM-56 (замок отобран: чужой замок после `close()` не тронут; конфликт журнала без `close()`), TM-11 (здоровый писатель отдаёт
замок), TM-15, TM-45, TM-46, TM-48 — не меняются: в них нет закрытия сломанного писателя с последующим открытием.

### 15.1c. Тесты, изменённые в r8 (до → после; ни одна проверка не ослаблена)

Причина (S1, решение ORCH): условие восстановления — признаки «обрыв» и «незакрытая работа» у того, кто получил замок (п. 6.3,
шаг 8), а не `stalePid`. Точный состав затронутых тестов подтверждает прогон: на коде r8 ожидается падение только прежнего TM-64 (B) (его меняет
TEST-DESIGNER по таблице ниже); новые TM-64 (B) и TM-67 на коде r7 падают, на коде r8 проходят. Тест TM-64 (B) — **отдельный** тест (`team-recovery.test.js`, «TM-64 (B) (r8) …»), а не ветка таблицы случаев TM-64 (A): у (A) своя таблица (одна строка), у (B) — своя фикстура и свои проверки.

| Тест | До (r7) | После (r8) |
|---|---|---|
| TM-17 | фикстура закрыта штатно и оборвана; «авария только по обрыву»; `JOURNAL_RECOVERED`, `RUN_FINISHED {interrupted}`, `TASK_INTERRUPTED` | проверки те же; в описании — оба признака («обрыв» и «незакрытая работа») |
| TM-19 | второй `say` — ровно одна `CHAT`, второго `PROJECT_RECOVERED` нет; `review` без запуска не прерывается | то же; добавлено основание: после восстановления признаков нет |
| TM-19 («a whole journal gets nothing appended», `team-recovery.test.js`) | журнал без открытой работы после штатного `close()` ничего не получает | без изменений по проверкам; фикстура — **две задачи на проверке** (`review`, без открытых запусков и задач `running`), `close()`, затем `say`: уведомлений нет, прежние байты журнала не тронуты, добавлена только `CHAT`, обе задачи `review`, `runs.open` пуст |
| TM-19 (r8) («a task in work with no open run after a normal close…») | — | новый тест: задача `running` **без** открытого запуска после штатного закрытия — признак «незакрытая работа» (п. 6.3, шаг 8): **первое** открытие записывает `TASK_INTERRUPTED {recovery}` и `PROJECT_RECOVERED {running, closed_runs 0, interrupted_tasks 1}` (без `RUN_FINISHED`), второе — только `CHAT`; задача `review` остаётся `review` |
| TM-54 | `SIGKILL`; `LOCK_STALE_REMOVED`, три `RUN_FINISHED {interrupted}`, A и B прерваны, C `review`, `PROJECT_RECOVERED {3, 2}` | проверки те же; восстановление — по признаку «незакрытая работа», `LOCK_STALE_REMOVED` — уведомление |
| TM-64 (A) и TM-64 (B) — два отдельных теста | (A) `review` без запуска — три открытия, `say`: только `CHAT`; (B) задача `running` с открытым `work` после штатного `close()` — **остаётся** `running`, запуск открыт (I7) | (A) без изменений; (B) **первое** открытие восстанавливает: `RUN_FINISHED {interrupted}`, `TASK_INTERRUPTED {recovery}`, `PROJECT_RECOVERED {running, 1, 1}`, без `LOCK_STALE_REMOVED`/`JOURNAL_RECOVERED`; следующие открытия и `say` — только `CHAT`. Проверка «ничего не пишет» (A) и «второго восстановления нет» сохранены; прежнее ожидание (B) «запуск открыт навсегда» было фиксацией остаточного риска I7, а не свойством, — оно заменено более строгим |
| TM-66 | (1) после смерти процесса со сломанным писателем — `LOCK_STALE_REMOVED`, `RUN_FINISHED {interrupted}`, `TASK_INTERRUPTED`, `PROJECT_RECOVERED`, затем только `CHAT` | проверки те же; основание восстановления — «незакрытая работа» у получившего замок |
| TM-67 | — | новый: гонка N открывающих после аварии — восстановление ровно один раз, открытой работы не остаётся, R = 20 раундов; допустимые исходы проигравшего — «открыт», `E_PROJECT_BUSY`, `E_LOCK_LOST` (остаточный риск п. 6.2, F6, S6); (r11) итоговые утверждения: ровно один `PROJECT_RECOVERED {closed_runs:1, interrupted_tasks:1}` и три события восстановления подряд (`seq` подряд), `CHAT` по числу «открыт», открытой работы нет (`runs.open` пуст), проект `paused`, `paused_by = "recovery"`; допустимые исходы проигравшего — «открыт», `E_PROJECT_BUSY`, `E_LOCK_LOST`; «хотя бы один открывающий успешен» снято; `pid` в `LOCK_STALE_REMOVED` — упавший писатель или один из открывающих этого раунда, без повторов |

TM-12 (`kill -9` без открытой работы: только `LOCK_STALE_REMOVED` и `CHAT`), TM-65 (1)–(4) (задача `review` без запуска остаётся;
`PROJECT_RECOVERED` только если что-то прервано; И21, И13), TM-16, TM-18, TM-38, TM-51 — не меняются.

### 15.1d. Тесты, изменённые в r10 (до → после; ни одна проверка не ослаблена)

Причина (step-33, решение ORCH): события шагов 8.4–8.6 пишутся одним пакетом (п. 6.3, шаг 8; п. 6.4, «Пакет»; И23). Тесты, где
восстановление проходит без сбоя (TM-17, TM-19, TM-54, TM-64 (B), TM-65, TM-66), проверок не меняют: состав и порядок событий те же,
`seq` и раньше шли подряд.

| Тест | До (r9 и правка step-33) | После (r10) |
|---|---|---|
| TM-67 | исходы проигравшего — «открыт», `E_PROJECT_BUSY`, `E_LOCK_LOST`; «открыт» ≥ 1; в правке step-33 `closed_runs` и `interrupted_tasks` в `PROJECT_RECOVERED` допускались 0 или 1 | исходы проигравшего те же — «открыт», `E_PROJECT_BUSY`, `E_LOCK_LOST` (остаточный риск п. 6.2, F6, S6); (r11) «открыт» ≥ 1 снято — «хотя бы один открывающий успешен» не утверждается; итоговые утверждения строгие: ровно один `PROJECT_RECOVERED {from_status:"running", closed_runs:1, interrupted_tasks:1}` — по настоящей работе фикстуры; добавлено: три события восстановления идут подряд (`seq` подряд); открытой работы нет, проект `paused` с `paused_by = "recovery"`; (r11) проверка `pid` уведомления `LOCK_STALE_REMOVED` сужена: упавший писатель или один из открывающих этого раунда, без повторов (причина — гонка замка F6/S6, Info); остальное без изменений |
| TM-68 | — | новый: пакет восстановления записан целиком или не записан — сбой `writeSync` (EIO, частичная запись), сбой `fsyncSync`, потеря замка до пакета и после пакета; затем следующий держатель замка восстанавливает ровно один раз; один `fsyncSync` на пакет; (r11, находка M03 ворот) при потере замка до пакета — 0 обращений к журналу (`writeSync`, `fsyncSync`, `ftruncateSync` по дескриптору журнала) после проверки замка |

### 15.2. Мутанты

| Мутант | Ловит |
|---|---|
| убрать `fsyncSync` в `appendLine` (r10: во внутреннем помощнике записи `journal.js`) | TM-15, TM-68 (е) |
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
| вторая попытка плана пишется как `PLANNING_STARTED` (planning→planning) / `PLAN_RETRY` без отказа принимается (r3, I1) | TM-62 |
| пропускать `throw` без `E_DISK` | TM-46 |
| убрать И12 | TM-53 |
| восстановление не закрывает открытые запуски / не прерывает `review` с открытым запуском | TM-54 |
| не писать `PROJECT_RECOVERED` или писать его повторно | TM-54, TM-19 |
| (r5) восстанавливать при каждом `openWriter` без признака: прерывать задачу `review` без открытого запуска / писать `PROJECT_RECOVERED`, когда прерывать нечего (r8: уточнено) | TM-64 (A), TM-65 (1) |
| (r5, r8) признак «обрыв» не учитывается (хвост не усекается, `JOURNAL_RECOVERED` нет) | TM-17, TM-65 (2) |
| (r5, r8) признак «незакрытая работа» не учитывается (восстановление только по обрыву) | TM-54, TM-64 (B), TM-65 (3), TM-66 (1), TM-67 |
| (r8, S1) признак аварии только у снявшего устаревший замок (`stalePid`) или по обрыву — как r5–r7 | TM-67 (гонка: открытый запуск остаётся), TM-64 (B) (замок не снимался) |
| (r8) `LOCK_STALE_REMOVED` пишется без снятия замка или не пишется у снявшего | TM-64 (B) (его нет), TM-12, TM-54 (он есть) |
| (r5) прерывать каждую задачу `review` (как в r4) | TM-54 (C), TM-65 (1), TM-19 |
| (r5) не прерывать `running` без открытого запуска | TM-65 (3) |
| (r5) писать `PROJECT_RECOVERED`, когда ничего не прервано | TM-65 (1), (2) |
| (r5) убрать И21 / разрешить `closed_runs + interrupted_tasks = 0` в И13 | TM-65 (4) |
| (r6) `close()` сломанного писателя снимает замок (как до r6) | TM-66 (1), (2), (3), TM-13, TM-14, TM-47 (`E_PROJECT_BUSY` после `close()`) |
| (r6) `close()` здорового писателя замок не снимает | TM-66 (4), TM-11, TM-64 |
| (r6) `close()` сломанного писателя пишет в журнал (закрывает запуски сам) или удаляет замок «по-своему» | TM-66 (1) (журнал до восстановления прежний), (2) (хеш папки) |
| (r6) `markBroken()` не ломает писателя или ломает без сохранения замка при `close()` | TM-66 (3) |
| (r6) повторное открытие в том же процессе после `close()` сломанного писателя разрешено (проверка живого pid обходит свой pid) | TM-66 (2), TM-11 |
| (r10) события шагов 8.4–8.6 пишутся отдельными `append` (как r8–r9) | TM-68 (д), (е); TM-67 (под нагрузкой) |
| (r10) `PROJECT_RECOVERED` — отдельной записью после пакета `RUN_FINISHED` + `TASK_INTERRUPTED` | TM-68 (д), (е) |
| (r10) нет отката пакета при сбое записи / откат только последней строки, а не к длине до пакета | TM-68 (а), (б) |
| (r10) проверка замка после записи пакета, а не до | TM-68 (г) |
| (r10) `closed_runs`/`interrupted_tasks` в `PROJECT_RECOVERED` не равны числу событий шагов 8.4 и 8.5 этого пакета | TM-54, TM-64 (B), TM-67, TM-68 |
| разрешить `BUDGET_SPENT` дважды на `run_id` | TM-55 |
| не проверять существование задачи | TM-55 |
| не проверять замок в `append` | TM-56 |
| `importWorkFile` идёт по ссылке | TM-57 |
| (r4) `importResultBytes` без маскирования / принимает не UTF-8 / пишет своим `writeFileSync` | TM-63, TM-04 |
| запретить `budget_usd = 0` | TM-60 |
| сужать права до проверки «занят» | TM-61 |
| сценарий маскируется | TM-59 |
| `PROJECT_RECOVERED` не меняет статус / `PROJECT_RESUMED` из `running` разрешён (N2) | TM-54 |
| `MEMORY_ADDED` от AGENT без `executor` принимается (N3) | TM-53 |
| `LOCK_STALE_REMOVED` / `JOURNAL_RECOVERED` через публичный `append` принимаются (N4) | TM-08 |
| `approval` без `draft` принимается (N8) | TM-55 |
| сценарий через строку, а не `Buffer` (N9) | TM-59 (фикстура с BOM и не-ASCII) |

### 15.3. Расширение `tools/test/fault-inject.js`

Нужно для TM-13, TM-14, TM-45, TM-47 (уровень API, в процессе теста — N1) и TM-24, TM-46, TM-48, TM-51 (дочерний
процесс команды). Обратно совместимо: прежние поля спецификации сбоя, прежние действия и прежнее поведение при загрузке
через `--import` не меняются (существующие тесты `tools/test/helpers.js` работают без правки); новое включается, только
если названо.

**Спецификация сбоя** (`Fault`, одна и та же в обоих режимах; прежние поля без изменений):

| Поле | Тип | Правило |
|---|---|---|
| `fn` | строка | прежние: `writeFileSync`, `renameSync`, `linkSync`, `unlinkSync`, `chmodSync`, `mkdirSync`, `rmSync`, `lstatSync`; **новые**: `openSync` (по пути, как прежние с одним путём), `writeSync`, `fsyncSync`, `ftruncateSync` (по дескриптору) |
| `paths` | массив абсолютных путей | фильтр по пути: для методов с путём — первый аргумент равен одному из путей; для `writeSync`/`fsyncSync`/`ftruncateSync` — дескриптор первого аргумента был открыт `fs.openSync` с одним из этих путей (см. «учёт дескрипторов») |
| `from`, `to` | строки | как прежде, для `renameSync`, `linkSync` |
| `nth` | целое ≥ 1 (по умолчанию 1) | номер совпавшего вызова, на котором сбой срабатывает; каждый сбой срабатывает один раз |
| `effect` | строка | `throw` (ошибка ОС), `bug` (`TypeError`), `kill` — для всех `fn`; `partial` и `partial-kill` — для `writeFileSync` (как прежде, половина строки в знаках) и **для `writeSync`** (половина того, что вызов должен записать: при длине `n` байт настоящий `writeSync` с тем же дескриптором и тем же началом буфера записывает `floor(n/2)` байт, затем `throw` / SIGKILL); `preempt` — только `writeFileSync` |
| `code` | строка | код ОС для `throw` и `partial` (`EIO`, `ENOSPC`, `EACCES`, …): ошибка прежней формы — `Error` с `code`, `errno`, `syscall` (имя без `Sync`), `path` (для методов по дескриптору — путь, с которым дескриптор открыт) |

Неверная спецификация (неизвестное поле, `fn`, `effect`, `partial` не для записи, нет `code`, пустой `paths`, `nth` < 1)
— `Error` «fault-inject: fault N: …» сразу, до любой подмены.

**Учёт дескрипторов.** Если в списке есть сбой по дескриптору, на время установки подменяются ещё `openSync` (запомнить
`fd → путь`, если путь из `paths` какого-нибудь сбоя и вызов удался) и `closeSync` (забыть `fd`, затем настоящий
вызов). Дескриптор, открытый до установки, не совпадает ни с одним сбоем. Ядро открывает журнал заново на каждое
добавление (п. 6.4, шаг 7), поэтому установка после `openWriter` перехватывает следующее `append`.

**Режим `--import` (прежний).** Модуль загружен через `node --import <URL этого файла>` — в `process.execArgv` есть
`--import` со значением, равным `import.meta.url` модуля (или `--import=<URL>`). Тогда при загрузке, как прежде: читает
`SAI_TEST_FAULTS` (нет — ошибка загрузки), разбирает и ставит сбои до конца процесса, без восстановления.

**Режим библиотеки (новый, N1).** Модуль импортирован тестом (`import { withFaults, installFaults } from
"./fault-inject.js"`; в `execArgv` его нет) — при загрузке ничего не подменяет и `SAI_TEST_FAULTS` не читает. Экспорт:

| Функция | Вход | Выход | Правило |
|---|---|---|---|
| `installFaults(faults: Fault[])` | непустой массив `Fault` | `FaultHandle = { restore(): void, fired(): boolean[] }` | проверяет спецификацию (как выше), запоминает текущие `fs[fn]` для каждого `fn` списка (и `openSync`/`closeSync` при сбоях по дескриптору) и заменяет их на перехватчики; вторая установка, пока первая не снята, — `Error` «fault-inject: already installed» (до любой подмены). `fired()` — по сбою: сработал ли |
| `handle.restore()` | — | — | возвращает в `fs` ровно запомненные функции, забывает учёт дескрипторов; повторный вызов ничего не делает; если `fs[fn]` к этому моменту заменён кем-то другим (не перехватчиком этой установки) — `Error` «fault-inject: fs.<fn> changed by someone else», но остальные функции всё равно возвращены |
| `withFaults(faults, fn)` | `Fault[]`, функция без аргументов | `{ value, error, fired: boolean[] }` | `installFaults`, вызов `fn`, `restore()` в `finally` — сбой снимается и при исключении из `fn`. Исключение `fn` не пробрасывается, а возвращается в `error` (`value` тогда `undefined`; без исключения `error = null`): тест проверяет `error.code`, `error.details`. Ошибка самого `restore()` пробрасывается. Только синхронные `fn` (ядро синхронное) |

Правило для тестов: каждый `installFaults` — в паре с `restore()` в `t.after` или через `withFaults`; после `withFaults`
тест проверяет `fs.<fn> === исходная` и `fired` (сбой действительно сработал — иначе тест падает, а не проходит молча).
`team-helpers.js` не держит своего механизма сбоев.

## 16. Планка

| Пункт | Применим? | Как выполняется |
|---|---|---|
| Q1 | применим | изменение привязано к REQ-009; у всех 15 критериев способ проверки — тесты TM и команды п. 15 |
| Q2 | применим | проект проверяет CODE-DESIGN-VALIDATOR (шаг 1b), код — SECURITY-REVIEWER и REVIEWER, тесты — TEST-DESIGN-VALIDATOR, итог — RELEASE-VALIDATOR своим запуском |
| Q3 | применим | факты п. 0 — своими запусками (r1: маскирование имён файлов); «работает» — только после `npm run check` с выводом |
| Q4 | применим | одна команда `cd tools && npm run check`; тесты `team-*` входят в шаблон без правки; прогон на чистой копии — критерий 15 |
| Q5 | применим | таблица п. 15.1: каждый критерий → тест; тесты отказа сравнивают хеши до и после; свой временный `SAI_TEAM_HOME`; (r10) запись пакета восстановления «всё или ничего» доказывает TM-68 (журнал байт-в-байт до пакета при каждом сбое), итог гонки — TM-67 со строгими утверждениями |
| Q6 | применим | `skip`, отключённых правил линтера, `\|\| true` нет; `fault-inject.js` только расширяется |
| Q7 | применим | поля `text` и содержимое файлов результатов маскируются `maskSecrets` до записи; `name` и `hash` — по шаблону без маскирования (P7, P8, остаточные риски названы); сценарий — копия тестового файла без маскирования (P9); `work/` — черновики агента без маскирования в папке 0700 (P9, README); ключей в ядре нет; окружение — только `SAI_TEAM_HOME`; TM-43, TM-44, TM-57, TM-58 |
| Q8 | применим как принцип для проектов | id создаёт ядро; шаблон id до `fs`; один ответ «проект не найден»; файлы результатов только в `files/` своего проекта; файл из `work/` — только внутри `work/` своего проекта, без ссылок; агент не достаёт до журнала и замка (`work/` отдельно); TM-23…TM-26, TM-57 |
| Q9 | неприменим | базы и SQL нет |
| Q10 | применим | каждый сбой ОС → `E_DISK` с понятным текстом и откатом; API бросает только `TeamError` (п. 10.4); команды через `runGuarded`, без стека; (r6) сломанный писатель после `close()` оставляет замок, и проект восстанавливает следующий открывающий (или отвечает «занят», пока процесс жив) — пользователь видит понятный ответ, журнал не меняется; TM-13, TM-14, TM-45…TM-48, TM-66; (r8, S1) восстановление не теряется в гонке открывающих: его делает получивший замок по признакам журнала, ровно один раз (TM-67); остаточный риск S2 (расход запуска, не записанный до аварии, не учитывается) назван в п. 12, 14 и P14; (r10) восстановление не оставляет проект «в работе» без работы: события шагов 8.4–8.6 — один пакет, при сбое журнал как до пакета и следующий держатель замка восстанавливает (И23, TM-68); двойной сбой / обрыв внутри пакета — остаточный риск, п. 12, I10; сетевых вызовов нет |
| Q11 | неприменим | ядро по сети не ходит (сеть Исследователя — REQ-010) |
| Q12 | применим | опирается на 0002, 0003, 0004, 0013, 0015; оспоримые выборы — предложение записи 0017 (п. 19, P1–P12; r8: P13, P14) |
| Q13 | применим | урок AP-025 учтён (TM-22); AP-005 — ссылки на прежнюю редакцию проверены поиском (`E_BUSY`, «процесс-помощник», `FILE_NAME_MAX 100`; r5 — «для каждой задачи в `running` или `review`», «прерывает задачи `running` и `review`»); AP-014 (r5) — правило аварии применено во всех местах того же рода: п. 4.1, 4.2, 5.2, 6.3, 12, 14, тесты, мутанты, P11; новых ошибок процесса нет; (r6) AP-005 — ссылки на прежнюю редакцию проверены поиском («`close()` отдаёт замок», «TM-01…TM-65», «штатном `close()`» без уточнения «несломанного»); AP-014 — правило «сломанный писатель оставляет замок» применено во всех местах того же рода: п. 6.2, 6.3, 6.4, 11, 12, 17, 19, тесты TM-13, TM-14, TM-47, TM-66, мутанты; (r8) AP-005 — ссылки на прежнее условие проверены поиском (`crashed`, «только после аварии», «только при `crashed`», «не «чинит» без аварии», «TM-01…TM-66»); AP-014 — новое условие восстановления применено во всех местах того же рода: п. 4.1, 5.2 (И13, И21, И22), 6.2, 6.3, 6.4, 12, 14, 15.1, 15.1c, 15.2, 16, 17, 19 (I7, P11, P13); (r10) AP-005 — ссылки на прежнюю запись восстановления проверены поиском («каждое событие — внутренним `append`», «на шагах 8.4–8.5 записано», «TM-01…TM-67», допуск «0 или 1» в TM-67); AP-014 — запись пакетом применена во всех местах того же рода (каждое событие шагов 8.4–8.6, все пути сбоя записи: `E_LOCK_LOST`, `E_CONFLICT`, `writeSync`, `fsyncSync`): п. 5.2 (И23), 6.3, 6.4, 11, 12, 13, 15.1, 15.1d, 15.2, 19 |
| Q14 | применим | handoff заполняется в этой работе; статус требования — DOC-UPDATER после PASS RELEASE-VALIDATOR; REQ-009 не `done`, пока REQ-002 не `done` |
| R1 | применим | мерж — только с подтверждения владельца; проект его не касается |
| R2 | применим (правда событий ядра) | события ENGINE пишутся в момент настоящего изменения (снятие замка, восстановление, закрытие прерванных запусков, прерывание, `PROJECT_RECOVERED`), время — с часов писателя; события создания, восстановления и файла результата пишет только ядро: публичный `append` отклоняет (`E_EVENT`, N4, TM-08) типы `PROJECT_CREATED`, `PROJECT_RECOVERED`, `RESULT_FILE`, `LOCK_STALE_REMOVED`, `JOURNAL_RECOVERED` и значения `TASK_INTERRUPTED.cause = "recovery"`, `RUN_FINISHED.outcome = "interrupted"`; у каждого события AGENT есть `executor` проекта (И12, N3); `PROJECT_RECOVERED` — настоящая смена статуса `→ paused`, событий смены статуса без смены нет (И13, N2); (r5, r8) события восстановления пишутся только при настоящих признаках аварии (оборванная строка или незакрытая работа в журнале нового держателя замка) и только о том, что действительно прервано: штатное повторное открытие не пишет «прервано», задача «на проверке» без идущего запуска не объявляется прерванной (И21, TM-64, TM-65); (r8) восстановление пишет тот, кто получил замок, ровно один раз и только о том, что действительно прервано (незакрытая работа или обрыв), — не зависит от того, кто снял замок; уведомление `LOCK_STALE_REMOVED` пишет только тот, кто его действительно снял (TM-67); (r6) `close()` сломанного писателя не пишет ничего и не «закрывает» запуски задним числом — запуск, который не удалось закрыть, закрывает восстановление после смерти процесса событием с моментом настоящего восстановления (TM-66); выдуманных и задним числом нет; журнал только дописывается, усекается лишь оборванная последняя строка с `JOURNAL_RECOVERED`; Pixel Office не меняется |
| R3 | неприменим | фото покупателей нет |

## 17. Связи с будущими требованиями

- **REQ-010** пишет `TASK_STARTED`, `RUN_STARTED`, `AGENT_ACTIVITY`, `RUN_FINISHED`, `RUN_REFUSED`, `TASK_RETRY`,
  `BUDGET_SPENT`, `TASK_REVIEW` (r4: задача «на проверке» после удачной попытки), `TASK_FAILED`, `TASK_INTERRUPTED` (кроме
  `cause: recovery`, N4), `TASK_CREATED` (USER), `MEMORY_ADDED` (AGENT) через `writer.append`/`addTask`/`addMemory`;
  `RESULT_FILE` — только через `writer.importWorkFile` (claude-cli) и `writer.importResultBytes` (scripted, r4);
  у каждого события AGENT (`AGENT_ACTIVITY`, `MEMORY_ADDED` от агента) — `data.executor` проекта (И12, N3; критерий 2
  REQ-010); создаёт проект `createProject` (`new`;
  отказ команды на потолок 0 — в `new`, ядро 0 хранит, F2); `executor` запусков равен `executor` проекта (И12, F3);
  рабочая папка процесса — `writer.workDir`, файлы агента — через `writer.importWorkFile` (F9); сценарий scripted — из
  `writer.scenarioPath` (копия при `new`: `new --scenario` читает файл `fs.readFileSync` без кодировки и передаёт
  `Buffer` как `scenario_bytes`, N9); команды `new` и `run-task` — через `runGuarded` с командными отказами EACCES/EIO.
- **REQ-013** пишет остальные типы; после восстановления проект `paused` (`paused_by = "recovery"`), и `resume` пишет
  `PROJECT_RESUMED {after:"recovery"}` — переход `paused → running` (И13, F4, N2).
  (r5) Задача `review` после удачного `run-task` REQ-010 ждёт проверки REQ-013 и при повторных открытиях (без аварии и
  после аварии, если её запуск `review` не был открыт) остаётся `review`. REQ-010 и REQ-013 закрывают свои запуски
  (`RUN_FINISHED`) до `writer.close()` **на всех путях выхода** (в том числе при исключении исполнителя не типа `TeamError` и при
  ошибке приёма результата; REQ-010, п. 8.2 шаг 8; И22). (r8, S1) Если вызывающий всё же оставил открытый запуск при штатном
  `close()`, следующий держатель замка восстановит его (`RUN_FINISHED interrupted`, задача `interrupted`, проект на паузе), а не
  оставит навсегда (I7). Движок REQ-013 держит замок сам и открывает проект один раз: его собственные открытые запуски другой
  открывающий не видит (он получает `E_PROJECT_BUSY`). Если закрытие записать нельзя, вызывающий вызывает `writer.markBroken()` — `close()` оставит замок, и проект
  восстановит следующий открывающий. **(r6)** Движок REQ-013 (долгоживущий процесс): сломанный писатель (любой `E_DISK`,
  `E_LOCK_LOST`, `E_CONFLICT`, `E_WRITER_BROKEN` из записи журнала) — процесс завершается или писатель закрывается `close()`
  (замок остаётся) и проект в этом процессе заново не открывается: иначе `E_PROJECT_BUSY` от собственного pid до выхода (I9).
  Пока движок держит замок, **любая** команда записи из другого процесса — `say`, `answer`, `pause`, `stop`, `budget`,
  `resume`, `add-task`, `run-task` — получает от ядра `E_PROJECT_BUSY` (F14). Канал приёма команд работающим движком
  (критерий 9 REQ-013: `pause` действует на работающий движок) выбирает проект REQ-013 — I3; если это файл или папка в
  папке проекта, проект REQ-013 добавляет запись в `PROJECT_ENTRIES` (п. 2.1, N10), TM-03 правки не требует.
- **REQ-011/REQ-012** импортируют чистые модули и читают через `readProject`/`readEvents`.

## 18. План раундов BACKEND-DEV и ворота

| Раунд | Файлы | Ворота раунда (сам разработчик, вывод в отчёте) |
|---|---|---|
| 1 — контракт | `errors.js`, `schema.js`, `roles.js` | `npm run check` — код 0 |
| 2 — чистая логика | `reducer.js`, `language.js`, `view.js` | `npm run check`; ручной прогон `node --input-type=module -e` (с ограничением времени) на фикстуре всех 37 типов |
| 3 — хранение | `home.js`, `journal.js`, `lock.js`, `files.js`, `store.js` | `npm run check`; ручные запуски во временном `SAI_TEAM_HOME` `<вне проекта>`: создание, два писателя, `kill -9`, обрыв строки, восстановление `running`, (r5) штатное повторное открытие с задачей `review` — без событий восстановления, (r6) сбой записи → `close()` → замок остался → после смерти процесса восстановление, (r8) после аварии — несколько одновременных открывающих: восстановление ровно один раз, (r10) сбой записи пакета восстановления — журнал как до пакета, `importWorkFile` |
| 4 — команды и документы | `cli.js`, скрипт `team`, раздел README | `npm run check`; `npm run team -- projects/project/events/say`; хеши `tools/src/pixel-office/**` до и после |

Ворота WF-02 дальше: SECURITY-REVIEWER → REVIEWER → TEST-DESIGNER (TM-01…TM-68, расширение `fault-inject.js`) →
TEST-DESIGN-VALIDATOR → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER. Ни один запуск не трогает `~/.sai-team` и
`~/.sai-pixel-office`.

## 19. Открытые вопросы и предложения записи в `decisions/`

Вопросы:

- **I1.** Закрыт решением ORCH: расширение `fault-inject.js` (п. 15.3) — TEST-DESIGNER.
- **I3.** (F14) Пока движок REQ-013 держит замок, `say`, `answer`, `pause`, `stop`, `budget`, `resume`, `add-task`,
  `run-task` из другого процесса получают `E_PROJECT_BUSY`. Нужен ли движку канал приёма этих команд — решает проект
  REQ-013 (критерии 9 REQ-013).
- **I5.** Закрыт решением ORCH (N5): из `work/` принимаются только текстовые файлы UTF-8, двоичные (картинки дизайнера)
  отклоняются `E_WORK_FILE` (маскирование работает над текстом); названо в README (п. 14, TM-50) и в P9.
- **I6.** Закрыт решением ORCH (F10, N5): имена файлов результата не маскируются, проверка шаблоном; имя, похожее на
  ключ, ядро сохранит как есть (отклонять сравнением с `maskSecrets(name)` — значит снова отклонить `plan.v2.md`);
  остаточный риск назван в README (п. 14, TM-50) и в P8.
- **I7. Закрыт (r8, S1; решение ORCH).** Открытые запуски и задачи `running` при штатно закрытом писателе (ошибка REQ-010/013
  или ручное удаление `writer.lock` после `E_LOCK_BAD`) восстанавливает следующий держатель замка по признаку «незакрытая
  работа» (п. 6.3, шаг 8; TM-64 (B)). Прежняя редакция (r5–r7), оставленная для истории: по решению ORCH (1) не восстанавливаются: запуск остаётся открытым, задачу нельзя
  начать снова (И16: не больше одного открытого запуска). Остаточный риск; нужен ли путь «закрыть прерванное вручную»
  (например, команда REQ-013 или отказ `close()` при открытых запусках) — решает ORCH. Тест TM-64 фиксирует нынешнее
  правило (ядро их не трогает). (r6) Пути, на которых запуск оставался открытым при штатном `close()` у `runTask` (сбой записи
  `AGENT_ACTIVITY`, исключение не типа `TeamError`, ошибка приёма результата), закрыты правилом 8.2 шаг 8 REQ-010 и И22; остаётся
  ручное удаление `writer.lock` и ошибка программы вызывающего.
- **I9.** (r6) Сломанный писатель оставляет замок (решение ORCH (1)); пока процесс жив, проект «занят» и для него самого. Для
  короткоживущего CLI это приемлемо (процесс завершается после ошибки); для долгоживущего движка REQ-013 нужно правило
  «сломанный писатель — выход из процесса или `close()` без повторного открытия» (п. 17) — проект REQ-013 обязан его
  принять; нужен ли в ядре способ «отдать замок сломанного писателя после проверки журнала» — вопрос к ORCH (пока нет).
- **I8.** (r5) Толкование решения ORCH (2): задача `running` прерывается при аварии и без открытого запуска (авария
  между `TASK_STARTED` и `RUN_STARTED` или в паузе перед повтором `TASK_RETRY`); иначе она навсегда осталась бы
  `running` без писателя, а И13 не допускает `PROJECT_RECOVERED` при задаче `running`. `PROJECT_RECOVERED` пишется, если
  прервано что-либо (запуск или задача), а не только при открытых запусках. `RUN_REFUSED` запуск не закрывает (запуска
  не было, п. 4.2). Если ORCH понимает (2) буквально — изменятся шаг 8.5, И13, TM-65 (3).

- **I10.** (r10) Пакет защищает от одного сбоя (сбой записи или `fsync` с удачным откатом, потеря замка), но не от обрыва
  внутри самой записи пакета (процесс убит или питание пропало посреди записи; `fault-inject.js` `partial-kill`) и не от
  двойного сбоя (сбой записи и неудавшийся откат): в журнале может остаться начало пакета — все `RUN_FINISHED`/`TASK_INTERRUPTED`
  и оборванный `PROJECT_RECOVERED`; следующий держатель отбросит обрыв (шаг 8.1), открытой работы не увидит и `PROJECT_RECOVERED`
  не запишет. Закрывать ли этот случай (например, признак по состоянию: статус `planning`/`running`, после последнего
  `PROJECT_RESUMED` есть `TASK_INTERRUPTED {cause:"recovery"}` без `PROJECT_RECOVERED`, — как предлагал step-33) — решает ORCH;
  в r10 не введено (решение ORCH: «больше ничего не менять»), названо остаточным риском в п. 12.
  (r11, F-1 проверки безопасности, Low) Тот же риск в общем виде: смерть процесса или сбой питания в середине записи пакета — цела только часть пакета, и начало (например закрытие review-запуска) остаётся без `PROJECT_RECOVERED`. **Возможная будущая правка (не вводится; решение ORCH: пока остаточный риск):** в `recover`, шаг 8.5, прерывать и задачу `review`, чей последний запуск `review` закрыт как `interrupted` (условие И21, `reviewRunInterrupted`) — тогда следующий держатель увидит такую задачу как незакрытую работу и допишет `PROJECT_RECOVERED`; потребует новой редакции п. 6.3 (шаг 8.5), И13, TM-65 и TM-68.

Предложение записи (Q12), одной записью `decisions/0017-team-core-storage.md` (пишет DOC-UPDATER, решение ORCH по I3):

- **P1.** Замок — временный файл + `linkSync`; снятие устаревшего — `renameSync` с проверкой содержимого; ложное «занят»
  при повторном pid — допустимая сторона. Остаточный риск (F6): гонка трёх процессов на устаревшем замке может оставить
  писателя без замка; он узнаёт об этом при следующем `append` (`E_LOCK_LOST`), одна строка в окне между проверкой и
  записью возможна, частично ловится `E_CONFLICT`.
- **P2.** Производного файла состояния нет.
- **P3.** Каталог 37 типов, редьюсер (таблица п. 5.3) и таблица языка фиксируются этим проектом; новые типы — только
  новой редакцией.
- **P4.** `say` отклоняет текст длиннее 4000 знаков; тексты агентов обрезает вызывающий (`prepareText`).
- **P5.** Права шире ожидаемых: писатель сужает (после замка и проверки журнала), чтение предупреждает.
- **P6.** Результаты не перезаписываются (`E_FILE_EXISTS`).
- **P7.** (F8) Поля вида `hash` не маскируются: маскирование превращает sha256 в `[скрыто]` (M10); проверка — шаблон
  `^[0-9a-f]{64}$`; хеш считает только ядро (`RESULT_FILE` пишется только путями ядра, `append` его отклоняет).
  Остаточный риск: 64-hex строку по шаблону не отличить от секрета — но значение всегда вычислено ядром.
- **P8.** (F10, N5) «Имена файлов результата не маскируются, проверка шаблоном» (латиница, цифры, `.`, `-`, `_`, ≤ 80,
  без `..`, не с точки). Остаточный риск: имя, похожее на ключ, сохраняется как есть (I6).
- **P9.** Не маскируются: копия сценария scripted (тестовый файл из `tools/test/fixtures/team/`, копируется байт-в-байт —
  критерий 16 REQ-010 сверяет хеш; ядро получает `Buffer` и пишет его же, N9) и содержимое `work/` (черновики агента,
  папка 0700); в `files/` и журнал из них попадает только маскированное. (N5, I5) Из `work/` в результат принимаются
  только текстовые файлы UTF-8, двоичные отклоняются (`E_WORK_FILE`).
- **P10.** (F16) Помощники тестов `tools/test/team-helpers.js` и расширение `tools/test/fault-inject.js` — в границе
  0015 как тестовый код (буквально 0015 называет только `tools/test/team-*.test.js`).
- **P11.** (F4, N2, r5, r8) Восстановление выполняет тот, кто получил замок, если журнал оборван или в нём есть открытые
  запуски или задачи `running` (r8, S1: не зависит от того, кто снял устаревший замок; `LOCK_STALE_REMOVED` — уведомление снявшего);
  после штатного `close()`, закрывшего свои запуски, его нет. Оно закрывает все открытые запуски (`RUN_FINISHED interrupted`),
  прерывает задачи `running` и задачи `review`, чей запуск `review` оно закрыло (задача `review` без открытого запуска
  остаётся `review`), а проект в `planning`/`running`, если что-то прервано, переводит в `paused` событием
  `PROJECT_RECOVERED` (причина
  «прервано аварией», `paused_by = "recovery"`) — настоящая смена статуса; работа продолжается только после
  `PROJECT_RESUMED {after:"recovery"}` (`paused → running`). Записи восстановления (`LOCK_STALE_REMOVED`,
  `JOURNAL_RECOVERED`, `PROJECT_RECOVERED`, `TASK_INTERRUPTED {cause:"recovery"}`, `RUN_FINISHED {outcome:"interrupted"}`)
  пишет только ядро (N4). (r10) События закрытия запусков, прерывания задач и `PROJECT_RECOVERED` пишутся одним пакетом (одна
  запись, один `fsync`, один откат; проверка замка до пакета): пакет записан весь или журнал как был (И23).
- **P12.** (r6) Сломанный писатель при `close()` замок не снимает: сбой записи оставляет проект «как после аварии», и следующий
  открывающий восстанавливает его по P11 (мёртвый pid) либо получает «проект занят» (pid жив). Здоровый писатель замок снимает.
  Вызывающий обязан закрывать свои запуски на всех путях выхода (И22); если не может — `markBroken()`. Остаточный риск: ложное
  «занят» при повторном pid; «занят» для самого сломавшегося процесса до его выхода.
- **P13.** (r8, S1) Признак аварии не принадлежит процессу: восстановление делает получивший замок по журналу («обрыв» или
  «незакрытая работа»), ровно один раз; `stalePid` — только уведомление (`LOCK_STALE_REMOVED`), в гонке открывающих оно может
  потеряться, восстановление — нет. Отвергнутый вариант (маркер аварии на диске, `writer.lock.crashed-<pid>`): новый файл в
  папке проекта и новое место записи, а признак по журналу уже однозначен (И22).
- **P14.** (r8, S2) Остаточный риск учёта: если процесс исполнителя был запущен, а `RUN_FINISHED` или `BUDGET_SPENT` не
  записались (писатель сломан, процесс умер между ними), восстановление закрывает запуск `interrupted` без `BUDGET_SPENT` —
  расход этого запуска не учитывается (`spent_usd` не растёт; фактические траты больше учтённых не более чем на
  `max_budget_usd` такого запуска). Учёт «по худшему случаю» при восстановлении не вводится этим проектом (новое поведение
  ядра; решает ORCH). Для записи 0017 (пишут ORCH/DOC-UPDATER).

- **P15.** (r11, F-1 проверки безопасности, Low) Остаточный риск пакета восстановления: смерть процесса или сбой питания в середине записи пакета оставляет часть пакета — начало (например закрытие review-запуска) без `PROJECT_RECOVERED`; следующий держатель замка этого не восстанавливает. Простое закрытие — возможная будущая правка (в `recover`, шаг 8.5, прерывать и задачу `review`, чей последний запуск `review` закрыт как `interrupted`, И21; см. I10) — не введено, решение ORCH: пока остаточный риск. Для записи 0017 (пишут ORCH/DOC-UPDATER).

Информация (S3, S4 проверки безопасности step-25; S6 — r9; вопросов не ставят):

- **S3.** Журнал, записанный кодом до r5 с `PROJECT_RECOVERED {closed_runs:0, interrupted_tasks:0}`, код r5+ читает как
  `E_CORRUPT` (И13). Выпущенных данных нет (`~/.sai-team` не существует); если появятся — записать в 0017.
- **S4.** Процесс с правом записи в папку проекта (тот же владелец, 0700) может подменить `writer.lock` замком мёртвого pid и
  вызвать восстановление поверх живого писателя; живой писатель получит `E_LOCK_LOST` и больше не пишет. Тот же уровень
  доверия, что право записи в журнал; так было и до r8.
- **S6.** (r9, Info; замечание проверки безопасности) Редкая гонка `lock.js` (F6, п. 6.2, шаг 4): при трёх и более одновременных открывающих на устаревшем замке проигравший теряет замок; его запуски закроет следующий держатель замка как `interrupted` (признак «незакрытая работа», п. 6.3, шаг 8) — журнал остаётся согласованным. Остаточный риск записан в п. 6.2 и 12; вопросов не ставит; для 0017 (пишут ORCH/DOC-UPDATER).