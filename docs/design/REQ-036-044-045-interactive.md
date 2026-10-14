# REQ-036, REQ-045, REQ-044 — проект кода: строки «Сейчас», журнал понятными словами, карточка экземпляра агента

Прогон `REQ044-20261014-01`, WF-02, шаг 1. Автор — CODE-DESIGNER, 2026-10-14 (по часам `date -u`: начало
13:00Z, запись 13:14Z). Проверяет — CODE-DESIGN-VALIDATOR (шаг 1b). Метка базы — `base/REQ044-20261014-01`.
Описание интерфейса, на которое опирается проект, — `docs/design/REQ-036-044-045-ui.md` (GUI-DESIGN-ANALYST,
дальше — «описание», ссылки вида «описание п. 5.2»). Порядок постройки внутри прогона — REQ-036, REQ-045,
REQ-044 (`decisions/0054`, дополнение, п. 1).

Здесь нет кода реализации: только формы данных, сигнатуры, правила, таблицы. Имена классов и атрибутов
названы как контракт для тестов.

## 0. Кратко

1. **REQ-036.** `nowLine` возвращает строки по одной на каждый элемент «в работе»; блок «Сейчас» рисует
   их списком с прокруткой внутри; название роли простыми словами даёт одна функция `roleName` по
   таблице `ROLE_NAMES` в `texts.js`; подпись `.item-role` панели и «Вся роль» — тоже `roleName`;
   холст и легенда — как были (`roleLabel`, D13).
2. **REQ-045.** Одна таблица `EVENT_TABLE` (12 случаев) в `texts.js`; новый чистый модуль `words.js`
   определяет случай, «кто» и слова строки только по самой строке и строкам до неё; `journalRows`
   добавляет записи оркестратора строками; строка журнала — `button.row-toggle`, раскрытие под ней
   строит чистый модуль `event-details.js`; окно истории открывает отдельная кнопка.
3. **REQ-044.** Новый чистый модуль `instance-card.js` строит данные карточки одного экземпляра;
   `office-view.js` получает `hitOffice` (персонаж → подпись → клетка стола); `app.js` рисует карточку,
   держит раскрытия, фокус и прокрутку при пересборке, ведёт Tab по кругу и возвращает фокус на
   кнопку легенды.
4. **Сервер (кроме общей функции `protocol.js`), хук, схема журнала, `office-model.js` не меняются**
   (проверено пробой, раздел 1, ф9): записи оркестратора уже приходят странице в ответе `GET /api/events`.
   Дополнение r3 (D14, п. 3.13): `protocol.js` маскирует секреты в описании и ролях в хуке и на сервере.
5. Пишет весь код один FRONTEND-DEV четырьмя подшагами 2a–2d (REQ-036, REQ-045, REQ-044, README; п. 8.1);
   два устаревших экспорта удаляет CODE-FIXER на шаге 5c, после замены тестов;
   тесты — TEST-DESIGNER; BACKEND-DEV не нужен.

## 1. Проверенные факты о текущем коде (с командами)

Каждое утверждение повторено сейчас на файлах рабочего дерева (метка базы та же, `git diff --stat
base/REQ044-20261014-01 -- tools/` — пусто).

| № | Факт | Где (файл, функция, строка) | Чем проверено |
|---|---|---|---|
| ф1 | Блок «Сейчас» — один текст: первый элемент «в работе» + `NOW_MORE` « · и ещё {n} в работе»; роль — `roleLabel` | `public/panels.js`, `nowLine`, строки 97–130; `texts.js` 15 | чтение файла; `grep -rn 'NOW_MORE\|· и ещё' tools/src/pixel-office/` — `panels.js:14`, `panels.js:120`, `texts.js:15` |
| ф2 | `roleLabel` берёт текст скобок и режет до 15 знаков + «…» (`LABEL_MAX = 16`) | `public/office-model.js`, `roleLabel`, 53, 65–77 | чтение |
| ф3 | `.now-text`: `white-space: nowrap`, `text-overflow: ellipsis`; ≤ 599 px — `-webkit-line-clamp: 2`; `.now` высота 2,125 rem | `public/style.css` 156–180, 1183–1194 | чтение |
| ф4 | Подпись роли элемента панели и карточки — `roleLabel(item.role)` | `public/app.js`, `itemInto`, 699–741 (стр. 710) | чтение |
| ф5 | Слова журнала — `EVENT_LABELS` (7 старых слов); «кто» у `PostToolUse` — `subagent_type`; у пустой роли основной сессии — `MAIN_LABEL` | `texts.js` 66–74; `panels.js`, `journalRows`, 136–178 | чтение |
| ф6 | Журнал страницы строится из `model.journal`; `isLine` требует `hook_event_name` и `session_id`, поэтому запись оркестратора в журнал не попадает | `public/model.js`, `isLine` 52–59, `buildModel` 315–319 | чтение + проба ф9 |
| ф7 | Открывается только строка запроса владельца: у `li` `tabindex="0"`, клик и Enter/Space открывают окно истории | `app.js`, `journalPanelRow`, 574–594 | чтение |
| ф8 | Хронология окна истории берёт слова из `EVENT_LABELS`, служебное сообщение — `HISTORY_SERVICE` | `public/history.js`, `eventView` 61–88, 244–253 | чтение |
| ф9 | Запись оркестратора лежит в том же файле журнала, приходит странице в `GET /api/events` с `source: "ORCH"` и без `hook_event_name`, `parseLine` её принимает, `model.journal` её не содержит | `server.js`, `processNote` 333–392 (`appendOr500` в тот же журнал), `handleRead` 220–255; `schema.js`, `isNoteLine` 341–347, `parseLine` 353–356 | проба на стенде (ниже): 6 строк файла, 6 в ответе, `parseLine` — 6 не `null`, записей 1, `model.journal` — 5 |
| ф10 | Нажатие на холст: `hitTest` ищет только персонажа (0,9 × 1,1 клетки); стол не открывает карточку | `app.js`, `onCanvasClick` 1411–1415; `office-view.js`, `hitTest` 472–493 | чтение |
| ф11 | Подпись персонажа рисуется у самого персонажа: центр `X + 12`, базовая линия `Y + 31`, ширина `min(measureText, 130)`; плашка — те же края ± 2 | `office-view.js`, `drawOffice` 393–406, `labelPlate` 140–176 | чтение |
| ф12 | Стол роли d: блок 2 × 2 клетки от `block`, место `seat`, клетка подхода `approach` (не стол) | `layout.js`, `deskSpot` 132–152, `buildTables` 240–260 | чтение |
| ф13 | Карточка — карточка роли (`buildCard`), строка «в работе: N» (`CARD_WORKING`), пересобирается при каждом обновлении (`renderCard`, `replaceChildren`); фокус после закрытия возвращается только если открыла легенда (`openerKey`) | `office-model.js`, `buildCard` 334–384; `app.js`, `renderCard` 883–963, `openCard` 968–982, `closeCard` 990–997 | чтение; `grep -n 'CARD_WORKING' tools/src/pixel-office/public/app.js` — строки 51 и 922 |
| ф14 | Окно истории при открытии закрывает карточку агента (решение 0014, п. 6) | `app.js`, `openHistory` 1255–1273 | чтение |
| ф15 | Escape закрывает карточку, Tab в карточке не удерживается (круга нет) | `app.js`, `onKey` 1435–1454 | чтение; замер стенда в описании, п. 0.2 |
| ф16 | Страница трогает мир только через `env`; окна браузера читает один `boot.js` | `app.js`, `createApp` 172–185; `boot.js` | чтение; PG-20 запрещает `localStorage`, `.style`, `innerHTML` и т. п. во всех файлах `public/` |
| ф17 | Принятые тесты требуют: ровно 10 строк `border…: 1px`, 1 `outline: 2px`, 1 `outline-offset: 2px`, ровно два условия `@media` (1240×640 и 599) | `tools/test/pixel-office-scale.test.js`, SC-03 141–183, SC-05 209–226 | чтение |
| ф18 | Принятый тест PN-23 запрещает правилам, оканчивающимся на `.item-state`, задавать свойства раскладки кроме `flex` и `max-width` в базовом правиле | `pixel-office-panels.test.js`, `itemCssProblems` 2687–2749 | чтение |
| ф19 | Принятые тесты ищут `#now-text` (SPAN, класс `now-text`) и сравнивают его `textContent` с «Сейчас: …» | PN-02 164–215, PN-17 970, FS-08 1772, FS-14 2273/2323, FS-17 2427–2434 | `grep -n 'now-text' tools/test/pixel-office-*.js` |
| ф20 | Идентификаторы `AC-`, `JR-`, `NM-` свободны | — | `grep -rn '"AC-\|"JR-\|"NM-' tools/test/` — пусто |
| ф21 | Числа `^test(` / `assert.` по файлам на метке: docs 3/25, hook 41/205, layout 19/210, note 7/103, office 58/534, page 81/605, panels 37/640, scale 6/38, server 71/333, settings 7/25 | — | `git show base/REQ044-20261014-01:tools/test/<файл> \| grep -c '^test('` и `grep -c 'assert[.]'` |
| ф22 | Критерии 9, 15 REQ-007 уже переписаны (шаг WF-01 до прогона) | `docs/requirements.yaml`, блок REQ-007 | awk-команда критерия 9 (а) REQ-036: `и число остальных элементов` — 0, `по одной строке на каждый элемент` — 1, `простыми словами` — 3 |
| ф23 | В `docs/design/REQ-007-office-ui.md` прежняя форма есть: «· и ещё N в работе» (строки 334–336), «текст в одну строку … многоточием» (319–323), «короткая подпись роли» в строке «Сейчас» и панели (329–330, 339, 923), «в работе: N» в карточке (969), старые слова журнала (832, 850), «до двух строк, дальше многоточие» (1010) | — | `grep -n 'и ещё\|NOW_MORE\|в работе: \|субагент запущен' docs/design/REQ-007-office-ui.md` |
| ф24 | Сервер раздаёт любой файл из корня `public/` с допустимым именем — новые модули страницы не требуют правки сервера | `server.js`, `staticName` 116–123, `STATIC_NAME` 68 | чтение |
| ф25 | Хук и сервер маскируют только `prompt_text`: `description`, `subagent_type`, `agent_type` идут в журнал как есть; запись оркестратора маскируется | `tools/src/pixel-office/protocol.js`: `buildWriteBody` 129–181 (`agent_type` 144–146, `subagent_type` 162–164, `description` 165–168 — только `truncateDescription`), `addPromptFields` 83–94 (`prepareText` для `prompt_text`), `validateWriteBody` 191–211 (`maskSecrets` только для `prompt_text`, 200–208); `server.js`, `processEvent` 321–331 (вызывает `validateWriteBody`), `processNote` 351–355 (`maskSecrets` записи); `note.js` 108–112; `mask.js`, `maskSecrets` (M1–M10, метка не маскируется повторно) | проба (дополнение r3): `buildWriteBody` с ключом `sk-ant-…` и `password="…"` в описании и ролях → поля как есть; `validateWriteBody` → та же строка с `source: "REAL"`; `maskSecrets("password=ab")` → `password=[скрыто]` (+6 знаков); повторное маскирование ничего не меняет |

Проба ф9 (стенд вне проекта, свой каталог и порт, вымышленные данные `sample-`, журнал владельца не
читался): `SAI_PIXEL_OFFICE_DIR=<вне проекта>/cd044/stand node src/pixel-office/main.js --port 4795`
→ «Pixel Office: http://127.0.0.1:4795/»; пять событий через настоящий `hook.sh` (SessionStart,
UserPromptSubmit, SubagentStart, SubagentStop, PostToolUse — порядок переднего плана) и
`node src/pixel-office/note.js --text "Образец: …" --req REQ-044` → «записано; привязано к сообщению
владельца …»; `curl /api/events?after=0` → `lines 6 from 0 events 6`, последняя строка
`{"ev":null,"src":"ORCH","keys":["time","source","note_text","req_id","request_time","request_time_auto"]}`;
скрипт с модулями `public/` → `entries 6 parsed non-null 6 notes 1`, `model.journal 5`, задача
`sample-a1` `completed` с описанием по связи z, слова строк — старые («субагент запущен», «вызов
субагента»). Стенд остановлен. Вывод: **сервер менять не нужно**; запись оркестратора без `session_id`
(команда без `--session`) — обычный случай, «сессия не указана» нужна.

## 2. Решения проекта

| № | Решение | Почему | Связь с описанием интерфейса |
|---|---|---|---|
| D1 | `office-model.js`, `schema.js`, `server.js`, `hook.js`, `mask.js` не меняются; `protocol.js` меняется только по D14 (дополнение r3), `model.js` — только общей проверкой состояний на шаге 5c (п. 8.2, находка ревью F1); записи оркестратора в журнал страницы добавляет `journalRows` из `model.entries` | FS-01 и PG-26 (модель) проходят без правки; REQ-045 позволяет `model.js` только при нужде | — |
| D2 | `roleName` узнаёт роль Sai только в форме `Sai <слова> (<КОД>)` с кодом из `ROLE_NAMES`; любая другая строка — как пришла, целиком (`decisions/0055`, п. 1) | в окружении бывают роли с теми же кодами из других папок (например, «… (REVIEWER)» другого проекта); выдать чужую роль за роль Sai — неправда (R2). Все 37 `name:` Sai имеют эту форму (`grep -h '^name:' .claude/agents/*.md`) | совпадает (роль вне таблицы — как пришла) |
| D3 | «Повторное» начало — **одно правило для журнала и карточки** (`repeatedStarts`, п. 3.2): строка `SubagentStart` повторная, если в файле **раньше** есть строка `SubagentStart` с тем же `agent_id` и `source` = `REAL`; пометки правила чтения по времени (конфликт, время из будущего) не учитываются (`decisions/0055`, п. 2, решение ORCH по F2). Журнал (случаи 7, 8), карточка («Начала работы», строка «Агент», вторая линия строки «Задача» — п. 3.7) и хронология окна берут вид начала только из этого правила | слова строки не меняются при сдвиге часов и приходе новых строк (критерий 2 REQ-045); источник зависит только от содержания; поддельная строка чужого источника не делает настоящее начало «продолжением»; одно событие не называется в журнале и карточке по-разному (критерий 1 REQ-045). Следствие для критерия 5 REQ-044 — раздел 14, О13 | — |
| D4 | Строка журнала — `button.row-toggle` (родная кнопка: Enter и Space работают без своих обработчиков), раскрытие карточки — `details`/`summary` | одна активация, без двойного переключения; критерии разрешают оба вида | описание интерфейса обновлено (доработка r1 GUI-DESIGN-ANALYST): `button.row-toggle` |
| D5 | Карточка пересобирается целиком (как сейчас), а перед заменой снимаются: открытые раскрытия, элемент в фокусе (`data-focus`), прокрутка тела; после — восстанавливаются. Новое дерево строится полностью до `replaceChildren` | OF-37 требует замены узлов; ошибка построения оставляет прежнее содержимое (всё или ничего для экрана) | п. 6.4 |
| D6 | Две колонки карточки — сетка `repeat(auto-fit, minmax(min(100%, 24rem), 1fr))`, без нового `@media`; две колонки появляются при ширине тела от 49,5 rem (окно от ≈ 874 px при корне 16 px: 49,5 rem тела + отступы тела + рамка + поля затемнения — расчёт описания интерфейса, обновлённого после решения ORCH), а не ровно с 960 px | принятый SC-05 требует ровно два условия `@media`; SC-03 — без новых строк с px | описание интерфейса обновлено под этот порог (≈ 874 px); принято ORCH (О8) |
| D7 | Плашки состояний в карточке и раскрытии — новый класс `.state-badge` со своими правилами | PN-23 запрещает раскладочные свойства у правил на `.item-state` вне базового; панель «Задачи» и «Вся роль» не меняются (ISS-0063) | п. 8.7, цвета — как в описании |
| D8 | Ширина подписи для попадания измеряется в момент нажатия тем же шрифтом холста (`labelWidths`); подпись принадлежит своему персонажу и идёт с ним | подпись рисуется у персонажа (ф11): когда он сидит — она под столом (выбор ORCH (3)); когда идёт — под ним | описание интерфейса обновлено (доработка r1): подпись открывает карточку своего персонажа, старшинство персонаж → подпись → стол |
| D9 | «Задача» записи оркестратора — строка основной сессии её запроса, если запись привязана (правило 5, `docs/design/REQ-008-history.md`, п. 7.3), иначе «к задаче не относится» | так читает поле REQ-046 (абзац «Задача события»); иначе следующий прогон переделывал бы раскрытие | описание п. 5.2: «к задаче не относится» всегда; принято ORCH (О5) |
| D10 | «Задача» у `PostToolUse` — задача запущенного (`launched_agent_id`); нет такой задачи — «задача не найдена: её начало не записано» | уточнение ORCH (1) и текст REQ-046 | описание предлагало «… начало агента не записано» [о]; принято ORCH (О6) |
| D11 | Время запуска сервера в основании «сервер перезапускался…» — самая ранняя годная запись запуска с `journal_lines` больше номера строки последнего начала | это запуск, после которого события перестали записываться | п. 7.3 — без уточнения, какой |
| D12 | Подстановка текста в шаблоны с данными журнала (`{role}`, `{source}`) — разбиением по метке и склейкой, не `String.replace` со строкой | `replace` толкует `$&`, `$'` в подставляемом тексте; роль `$&` исказилась бы | — |
| D13 | `NOW_MORE` удаляется на шаге 2a (ни один тест его не импортирует). `EVENT_LABELS` и `CARD_WORKING` на шагах 2a–2c **остаются экспортами `texts.js` как устаревшие** (страница их больше не использует, у каждого — пометка «устарело, удаляется на шаге 5c»); TEST-DESIGNER на шаге 5 убирает их импорт из тестов; удаляет оба экспорта CODE-FIXER на шаге 5c (раздел 8) | `pixel-office-panels.test.js` (строка 16) и `pixel-office-office.test.js` (строка 50) импортируют их по имени: удаление на шаге 2 делает оба файла незагружаемыми — прототип: 243 теста из 336, 95 не выполняются (F1, раздел 8); критерий 1 REQ-045 (старых слов нет в `public/`) и критерий 7 REQ-044 (`CARD_WORKING` нет в `app.js`; проект проверяет всю `public/`) выполняются после шага 5c, до шага 6 | — |
| D14 | (дополнение r3) `description`, `subagent_type`, `agent_type` маскируются `maskSecrets` в хуке (`buildWriteBody`) и на сервере (`validateWriteBody`), как `prompt_text`; сначала маскирование, потом обрезка до предела схемы; идентификаторы не маскируются (п. 3.13) | критерий 6 REQ-036; ф25 — сейчас не маскируются; одна функция и две линии — как у `prompt_text` (проект REQ-008, раздел 3) | описание интерфейса этого не касается |

## 3. Формы данных и функции по файлам

Пути — от корня Sai. «Чистый» модуль — без DOM, без Node, без чтения часов (как PG-20, FS-18).

### 3.1 `tools/src/pixel-office/public/texts.js` — константы (контракт для тестов)

Удаляются: `NOW_MORE` — на шаге 2a; `EVENT_LABELS` и `CARD_WORKING` — на шаге 5c (до того — устаревшие экспорты, не используемые страницей; D13). Остаются прежними: `NOW_PREFIX` («Сейчас: »,
с пробелом в конце — так `#now-text` сохраняет прежний `textContent` в пустом случае), `NOW_EMPTY`,
`NOW_UNCONFIRMED`, `MAIN_ROW`, `MAIN_LABEL`, `ROLE_UNKNOWN`, `STATE_LABELS`, `LEGEND_*`,
`CARD_SESSIONS`, `CARD_HEADINGS`, `CARD_EMPTY`, `CARD_CLOSE`, `SHOWN_NOTE`, `HISTORY_*`, `NOT_FROM_HOOKS`.

**`ROLE_NAMES`** — замороженный объект «код → название», ровно по одной записи на каждый код из
`grep -h '^name:' .claude/agents/*.md` (сейчас 37). Формулировки пишет FRONTEND-DEV по правилам: 1–40
знаков; без латинских букв (значит, без «agent», «prompt», «token», «JSON», «QA», «UAT», «BA»); названия
разных кодов различны; ни одно не совпадает с `MAIN_LABEL`, `ROLE_UNKNOWN`; без основ
`заверш|готов|выполнен|успешн` (критерий 8 REQ-042: например, «Подготовка …» нельзя) и `завис|остановлен|упал`
(FS-15). Обязательные значения (примеры требования): `SECURITY-REVIEWER` — «Проверка безопасности»,
`REVIEWER` — «Ревью кода», `TEST-RUNNER` — «Запуск проверки», `BACKEND-DEV` — «Серверная часть»,
`ORCH` — «Оркестратор».

**`EVENT_TABLE`** — замороженный объект ровно из 12 ключей; значения равны тексту таблицы описания
REQ-045 буквально (тест JR-01 держит литералы):

| Ключ (случай) | Поля |
|---|---|
| `session_start` (1) | `words`, `meaning`, `not_proved` |
| `session_end` (2) | то же |
| `prompt_owner` (3) | то же |
| `prompt_service` (4) | то же |
| `prompt_unknown` (5) | то же |
| `stop` (6) | то же |
| `agent_start` (7) | то же + `act` «получил задание и начал работу» |
| `agent_resume` (8) | то же + `act` «продолжил работу» |
| `agent_stop` (9) | то же + `act` «закончил работу и вернул ответ» |
| `handoff` (10) | то же |
| `orch_note` (11) | то же |
| `marked` (12) | `meaning`, `not_proved`, `reasons`: `source` «источник строки — не хук Claude Code: {source}», `conflict` «время строки расходится с порядком строк в журнале больше чем на 2 минуты», `future` «время последней строки позже часов этого компьютера больше чем на минуту» |

В `words` случаев 7–10 стоит метка `{role}`. Правило целостности (тест JR-01): у 7–9 `words` равно
«Агент «{role}» » + `act`; `act` — единственный источник коротких слов карточки (критерий 1 REQ-045:
одна таблица).

**Новые константы** (значения — из критериев [т] или из описания [о], раздел 12 описания):

| Имя | Значение |
|---|---|
| `NOW_LIST_LABEL` | «Сейчас — работающие агенты» [о] |
| `TIME_UNKNOWN` | «время не записано» |
| `SESSION_UNKNOWN` | «сессия не указана» |
| `DETAIL_LABELS` | `when` «Когда», `source` «Источник», `session` «Сессия», `agent` «Агент», `task` «Задача», `note_text` «Текст записи», `req` «Требование», `request_time` «Время запроса», `what` «Что произошло», `not_proved` «Чего это не доказывает», `mark` «Пометка», `tech` «Технические поля» |
| `SOURCE_WORDS` | `REAL` «хук Claude Code», `ORCH` «запись оркестратора», `other` «другой источник: {source}» |
| `SESSION_FULL` | «полностью» [о] |
| `AGENT_MAIN` | «основная сессия: у этого события агента нет» |
| `AGENT_ORCH` | «оркестратор» |
| `TASK_NOW` | «сейчас» |
| `TASK_NOT_RELATED` | «к задаче не относится» |
| `TASK_NOT_FOUND` | «задача не найдена: её начало не записано» |
| `TASK_MAIN_NOT_FOUND` | «строка основной сессии не найдена: запрос этой сессии не записан» [о] |
| `MARK_PREFIX` | «не из хуков: » |
| `DETAILS_CLOSE` | «Закрыть» |
| `CARD_INSTANCE`, `CARD_SESSION` | «экземпляр», «сессия» |
| `CARD_BLOCKS` | `ids` «Полные идентификаторы» [о], `task` «Текущая задача» [о], `state` «Состояние» [о], `launcher` «Кто запустил», `instances` «Экземпляры этой роли», `more` «Остальные экземпляры» [о], `given` «Задание передано», `starts` «Начала работы» [о], `returns` «Возвраты» [о], `launched` «Кого запустил», `role` «Вся роль» |
| `STATE_ROWS` | `task` «Задача», `agent` «Агент», `workplace` «Рабочее место» |
| `TASK_DESC_BY` | «описание написал передавший задание» [о] |
| `TASK_NO_LINK` | «описание не записано: записи о передаче задания нет» |
| `TASK_NO_DESC` | «описание не записано» |
| `TASK_SEVERAL` | «не установлено: записей о передаче задания несколько» |
| `LAUNCHER_NO_LINK` | «не установлено: записи о передаче задания нет» |
| `LAUNCHER_NOT_RECORDED` | «начало этого агента не записано» |
| `FRESH_LIMIT` | «порог свежести — {m} минут» ({m} = `STALE_AFTER_MS / 60000`, число в тексте не пишется: FS-04) |
| `SERVER_STARTED` | «сервер запущен {time} — после последнего начала этого агента» [о] |
| `AGENT_NOT_RECORDED` | «другие действия агента — чтение файлов, команды, правки — хук не записывает» |
| `WORKPLACE_WORKING` | «работает — у этой роли задач «в работе»: {n}» (начинается с `LEGEND_WORKING`) |
| `WORKPLACE_IDLE` | «свободен — по журналу у этой роли нет задачи «в работе»; это вывод по событиям, а не событие» (начинается с `LEGEND_IDLE`) |
| `WORKPLACE_DESK` | «Стол на холсте — изображение роли, общее для всех её экземпляров, а не компьютер. О компьютере и операционной системе Pixel Office ничего не знает.» |
| `UNKNOWN_MESSAGES` | «Сообщения между агентами хук не записывает: записаны только передачи задания и окончания работы» |
| `UNKNOWN_ERRORS` | «Ошибки и ожидание человека хук сейчас не сообщает» |
| `INSTANCES_COUNT` | «экземпляров роли: {N}» |
| `LAST_START` | «последнее начало» [о] |
| `GIVEN_BY` | «передал: » [о] |
| `GIVEN_NOTE` | «Эту запись пишет тот, кто передал задание. У агентов переднего плана она приходит после окончания их работы, у фоновых — сразу при запуске; это не действие самого агента» |
| `RETURN_NOTE` | «, итог не записан» (пункт «Возвратов» = `EVENT_TABLE.agent_stop.act` + `RETURN_NOTE`) |
| `COPY`, `COPY_OK`, `COPY_FAIL` | «Скопировать», «скопировано», «не удалось скопировать — выделите значение вручную» |
| `COPY_LABEL_AGENT`, `COPY_LABEL_SESSION` | «Скопировать номер экземпляра», «Скопировать номер сессии» [о] |

### 3.2 `tools/src/pixel-office/public/words.js` — новый, чистый

Импортирует только `texts.js` и `schema.js`.

| Сигнатура | Что возвращает | Правило |
|---|---|---|
| `roleName(role: unknown) → string` | название простыми словами | не строка или пусто → `ROLE_UNKNOWN`; совпадает с `^Sai [^()]+ \(([A-Z][A-Z0-9-]*)\)$` и код есть в `ROLE_NAMES` (`Object.hasOwn`) → название; иначе — `role` целиком, без обрезки (D2) |
| `repeatedStarts(entries: Array) → Set<number>` | номера строк — повторных начал | один проход по файлу; строка `i` входит, если она `SubagentStart` со строковым `agent_id`, и раньше в файле есть `SubagentStart` с тем же `agent_id` и `source === "REAL"` (D3); `null` и не-объекты пропускаются |
| `eventCase(entry, repeated: boolean) → CaseKey` | ключ `EVENT_TABLE` без учёта пометки | `isNoteLine` → `orch_note`; SessionStart → `session_start`; SessionEnd → `session_end`; UserPromptSubmit: `prompt_kind` owner → `prompt_owner`, service → `prompt_service`, иначе `prompt_unknown`; Stop → `stop`; SubagentStart → `repeated ? agent_resume : agent_start`; SubagentStop → `agent_stop`; PostToolUse → `handoff` |
| `lineRole(entry) → string` | сырая роль строки для `{role}` | SubagentStart/Stop — `agent_type`; PostToolUse — `subagent_type`; иначе `""` |
| `eventWords(caseKey, entry) → string` | слова строки | `EVENT_TABLE[caseKey].words` с `{role}` = `roleName(lineRole(entry))`; подстановка — разбиением и склейкой (D12) |
| `whoOf(entry) → string` | «кто» | SessionStart, SessionEnd, UserPromptSubmit, Stop → `MAIN_LABEL` (всегда); SubagentStart/Stop → `roleName(agent_type)`; PostToolUse → непустой `agent_id` ? `roleName(agent_type)` : `MAIN_LABEL`; запись оркестратора → `HISTORY_WHO_ORCH` |
| `markReason(reason, entry) → string` | текст причины пометки | `EVENT_TABLE.marked.reasons[reason]`, `{source}` = `entry.source` (D12) |
| `shortId(id) → string` | первые 8 кодовых точек строки, иначе `""` | перенос из `app.js` (одна функция на страницу) |

Инвариант (JR-02): `eventCase`, `eventWords`, `whoOf` строки `i` зависят только от строки `i` и строк
`0…i−1`, не от пометок и не от часов.

### 3.3 `tools/src/pixel-office/public/panels.js`

`roleLabel` больше не импортируется.

**`nowLine(model) → NowLine`** (форма меняется):

| Поле | Тип | Значение |
|---|---|---|
| `busy` | boolean | есть элементы «в работе» |
| `count` | number | их число |
| `unconfirmed` | number | как сейчас (только когда `busy` ложно) |
| `rows` | `NowRow[]` | по одной на элемент `model.list` с `state === "in_progress"`, в порядке списка (правило d) |
| `text` | string | `busy`: `NOW_PREFIX` + тексты строк подряд, без разделителя (ровно `textContent` `#now-text`); иначе — как сейчас: `NOW_PREFIX + NOW_EMPTY` [+ `NOW_UNCONFIRMED`] |
| `title` | string | `busy`: `NOW_PREFIX` + тексты строк через `\n`; иначе — как сейчас (`unconfirmedNote` или `text`) |

`NowRow = { key: string, kind: "task" | "main", role: string | null, description: string | null, text: string }`:
`main` → `role` null, `text` = `MAIN_ROW`; `task` → `role` = `roleName(item.role)`, `description` — непустое
описание или null, `text` = `role` или `role + " — " + description`. Ни запросов, ни записей оркестратора,
ни `req_id` в строках нет (критерий 5 REQ-036).

**`journalRows(model, office) → JournalRow[]`** (форма расширяется): строки в порядке файла — каждая
строка `model.journal` и каждая запись оркестратора из `model.entries` (`isNoteLine`), слиянием по номеру.
`repeatedStarts(model.entries)` считается один раз на вызов.

| Поле | Тип | Значение |
|---|---|---|
| `index` | number | номер строки файла |
| `kind` | `"hook" \| "note"` | вид строки |
| `event` | string \| null | `hook_event_name` или null у записи |
| `case` | CaseKey | `eventCase` (без пометки) |
| `time` | string | время строки как есть |
| `session_id` | string \| null | null у записи без сессии |
| `source` | string | `source` строки |
| `marked`, `reason` | boolean, `"source"\|"conflict"\|"future"\|null` | из `model.marks` (у записи — всегда `false`, `null`) |
| `tone` | string | `TONES[event]`, у записи — `"note"` |
| `who` | string | `whoOf` |
| `words` | string | `eventWords(case, entry)` |
| `description` | string | как сейчас: у PostToolUse — своё, у непомеченных SubagentStart/Stop — по связи z, у записи — `""` |
| `work`, `office` | boolean | как сейчас; у записи — `false`, `false` |
| `prompt_kind` | string \| null | как сейчас |

`filterJournal`, `taskPanel`, `unconfirmedNote`, `JOURNAL_LIMIT`, `LIST_LIMIT`, `FILTERS`, `WORK_EVENTS`,
`TONES` — без изменений (тон записи `"note"` задаёт `journalRows`; `TONES` читает и окно истории).

### 3.4 `tools/src/pixel-office/public/event-details.js` — новый, чистый

**`eventDetails(model, history, index) → EventDetails | null`** — данные раскрытия строки `index`
(null, если это не строка журнала и не запись). Импорты: `words.js`, `format.js` (`fmtDateTime`,
`tzLabel` — чтение пояса, не часов), `schema.js` (`LINE_KEYS`, `isNoteLine`), `texts.js`.

| Поле | Значение |
|---|---|
| `when` | `fmtDateTime(time) + " · " + tzLabel()`; пусто → `TIME_UNKNOWN` |
| `source` | `SOURCE_WORDS.REAL` / `.ORCH` / `.other` с `{source}` |
| `session` | `{ short, full }` или null (нет сессии → в тексте `SESSION_UNKNOWN`) |
| `agent` | SubagentStart/Stop: `roleName(agent_type) + " · " + shortId(agent_id)`; PostToolUse с `agent_id`: то же для передавшего, без — `AGENT_MAIN`; события основной сессии — `AGENT_MAIN`; запись — `AGENT_ORCH` |
| `task` | `{ text: string, state: StateKey \| null }` по таблице 4.2 |
| `words`, `meaning`, `not_proved` | `eventWords`; `meaning`/`not_proved` — своего случая, у помеченной строки — случая 12 |
| `mark` | `MARK_PREFIX + markReason(...)` или null |
| `note` | у записи: `{ text, req_id: string\|null, request_time: string\|null, auto: boolean }`; иначе null |
| `tech` | `Array<[ключ, значение-строкой]>` — каждое поле строки в порядке `LINE_KEYS`, **кроме `prompt_text`** |

### 3.5 `tools/src/pixel-office/public/history.js`

`eventView` и первая строка хронологии берут `what` из `eventWords(eventCase(e, repeated.has(k)), e)`
(`repeatedStarts` — один раз в `buildHistory`); служебное сообщение — слова случая 4 вместо
`HISTORY_SERVICE`. `who`, записи оркестратора (`HISTORY_NOTE_BY`), таблица «Кто работал», правила окон —
без изменений. Сигнатура `buildHistory(model)` прежняя.

### 3.6 `tools/src/pixel-office/public/office-view.js`

`hitTest`, `canvasPoint`, `drawOffice`, `labelPlate` — без изменений. Новые:

| Сигнатура | Правило |
|---|---|
| `labelWidths(ctx, office) → Map<key, number>` | `ctx.font = LABEL_FONT`; для каждого персонажа `min(measureText(label).width, LABEL_MAX_WIDTH)`; нечисло, ≤ 0 или исключение `measureText` → персонажа в карте нет (его подпись не попадает), функция не бросает |
| `hitOffice(office, positions, px, py, widths) → key \| null` | 1) `hitTest(positions, px, py)` не null → он (персонаж старше всего, L1); 2) подпись: для позиции `p` с шириной `w` из `widths` — прямоугольник `[X + 12 − w/2 − LABEL_PLATE_PAD, X + 12 + w/2 + LABEL_PLATE_PAD) × [Y + 31 − LABEL_ASCENT, Y + 31 + LABEL_DESCENT)`, где `X = round(p.x · CELL)`, `Y = round(p.y · CELL)` (как рисует `drawOffice`); из нескольких — последняя в порядке `positions` (нарисована сверху); 3) стол: клетка `(floor(px / CELL), floor(py / CELL))` равна клетке блока 2 × 2 (`block`) или месту (`seat`) стола `d` из `office.desks` → ключ персонажа этого стола; 4) иначе null. `px` или `py` не число → null |

Клетка подхода (`approach`) столом не считается (описание п. 6.2).

### 3.7 `tools/src/pixel-office/public/instance-card.js` — новый, чистый

Импорты: `model.js` (`ageOf`, `UNCONFIRMED_STATES`), `office-model.js` (`roleKey`, `buildCard`),
`words.js` (`repeatedStarts` — единственный источник вида начала, D3), `texts.js`.

| Сигнатура | Правило |
|---|---|
| `roleInstances(model, role) → Item[]` | элементы `model.list` с `kind === "task"` и `role === role`, в порядке списка (правило d) |
| `defaultInstance(model, characterKey) → string \| null` | ключ первого из `roleInstances` той роли, чей `roleKey` равен `characterKey`; у `main` и неизвестного ключа — null |
| `buildInstanceCard(model, office, taskKey) → InstanceCard \| null` | null, если задачи с ключом нет |

`InstanceCard`:

| Поле | Значение и источник |
|---|---|
| `key`, `role` | ключ задачи (`agent_id`), сырая роль задачи |
| `character_key`, `color` | `roleKey(role)`, цвет персонажа этой роли (0, если персонажа нет) |
| `title` | `roleName(role)` |
| `code` | `role`, если `role !== title` и `role !== ROLE_UNKNOWN`; иначе null |
| `agent` | `{ short, full }` из ключа |
| `session` | `{ short, full }` из `task.session_id` |
| `current_task` | по строкам «передачи» (ниже): одна строка с непустым описанием → `{ kind: "described", text }`; одна без описания → `{ kind: "no_description" }`; ни одной → `{ kind: "no_link" }`; больше одной разных `tool_use_id` → `{ kind: "several" }` |
| `task_state` | `{ state, session_last_event_at, age_ms, last_start: {kind: "start"\|"resume", at}, server_start_at, stop_at, session_end_at }` — `last_start` — последняя доверенная `SubagentStart` экземпляра, её вид — по `repeatedStarts` (D3); `server_start_at` по D11 (только у `restarted`), `stop_at` — время последнего `SubagentStop` (у `completed`), `session_end_at` — время последнего доверенного `SessionEnd` этой сессии после последнего начала (у `unrecorded`) |
| `agent_event` | самая поздняя по файлу доверенная строка `SubagentStart`/`SubagentStop` с этим `agent_id`: `{ kind: "start"\|"resume"\|"stop", at, age_ms }`; вид начала — по `repeatedStarts` (D3): `resume`, если номер строки в этом множестве; строки «передачи» сюда не входят |
| `workplace` | `{ working: boolean, count }` — по персонажу роли (`working`, `working_count`) |
| `launcher` | по `task.launched_by` и числу строк «передачи»: `{kind: "main"}`; `{kind: "subagent", key, name: roleName(...), short, has_task, state}` (имя — по задаче с этим ключом, если она есть, иначе по `agent_type` строки); `{kind: "none", reason: "no_link" \| "several"}` |
| `given` | строки «передачи»: `{ index, at, by: {kind:"main"} \| {kind:"subagent", name, short}, description \| null }`, по порядку файла |
| `starts` | каждая доверенная `SubagentStart` с этим `agent_id`: `{ index, at, kind: "start"\|"resume" }`; вид — по `repeatedStarts` (D3), то есть те же слова, что у этой строки в журнале. Обычно первая — `start`; если первая строка начала `REAL` помечена по времени (конфликт), она в список не входит (недоверенная), а следующая доверенная — `resume`, как в журнале (раздел 14, О13) |
| `returns` | каждая доверенная `SubagentStop` с этим `agent_id`: `{ index, at }` |
| `launched` | доверенные `PostToolUse` с `agent_id` = ключу (дубли одного `tool_use_id` — первая): `{ index, key: launched_agent_id, short, name, state \| null, has_task }`; имя — `roleName` роли задачи, иначе `subagent_type`, иначе `ROLE_UNKNOWN` |
| `instances` | `{ total, shown: InstanceItem[] (первые 5), rest: InstanceItem[] }` из `roleInstances`; `InstanceItem = { key, short, state, last_start_at, session_last_event_at \| null, age_ms \| null, description \| null, current }`; время сессии и возраст — только у `in_progress` и `stale`, у `restarted` — время без возраста (как панель) |
| `role_card` | `buildCard(model, office, roleKey(role))` — данные раскрытия «Вся роль» без изменений |

«Строки передачи» экземпляра — доверенные (`model.trusted`) `PostToolUse` с `launched_agent_id` = ключу;
дубли одного `tool_use_id` — первая. Это то же правило z, что `linkOf` в `model.js`; тест AC-06 сверяет
итог с `task.description` и `task.launched_by` на случайных журналах, чтобы два места не разошлись.
Помеченные строки ни в один список и ни в одно основание не входят. Связи — только по равенству
идентификаторов: ни время, ни порядок, ни сессия связи не создают.

### 3.8 `tools/src/pixel-office/public/app.js`

Состояние (новое и изменённое):

| Имя | Форма | Смысл |
|---|---|---|
| `selectedKey` | string \| null | персонаж (рамка на холсте, `aria-pressed` легенды) — как сейчас |
| `card` | `null \| {kind: "main"} \| {kind: "instance", key}` | что открыто вместо `cardOpen` |
| `cardReturnKey` | string \| null | ключ кнопки легенды, куда вернуть фокус (роль последней показанной карточки); заменяет `openerKey` |
| `copied` | `null \| {key, target: "agent"\|"session", ok: boolean}` | надпись после «Скопировать» |
| `journalOpen` | number \| null | номер строки с открытым раскрытием |

Функции (сигнатуры; поведение — разделы 4–6):

| Функция | Что меняется |
|---|---|
| `renderNow()` | строит в `#now-text`: `span.now-label` (`NOW_PREFIX`) и либо `span#now-list.now-list` (`role="list"`, `tabindex="0"`, `aria-label` = `NOW_LIST_LABEL`) со `span.now-row` (`role="listitem"`, `data-key`, `data-kind`) → `span.now-role`, у задачи с описанием ещё `span.now-sep` « — » и `span.now-desc`; либо `span.now-empty` (`NOW_EMPTY` [+ `NOW_UNCONFIRMED`]). `#now` — `title`, `data-busy`, `data-unconfirmed` как сейчас. Сохраняет `scrollTop` и фокус списка между пересборками |
| `itemInto(el, item)` | подпись `.item-role` задачи — `roleName(item.role)` |
| `journalRow(view)` / `journalPanelRow(view)` | строка — раздел 5.1–5.2; строка без раскрытия (для «Вся роль») — та же разметка без кнопки и обработчиков. Вид события страница читает из `view.event` (`hook_event_name`), а не из `view.kind`: у `JournalRow` поле `kind` теперь `"hook"`/`"note"` (п. 3.3). Прототип показал ловушку: старая проверка `view.kind !== "UserPromptSubmit"` молча убирает кнопку «открыть историю запроса» у всех строк |
| `renderJournal(toBottom)` | раскрытие, якорь прокрутки и фокус — раздел 5.3 |
| `openEvent(index)`, `closeEvent(focusRow)` | открыть/закрыть раскрытие |
| `openCard(characterKey, opener)` | `main` → `{kind:"main"}`; роль → `{kind:"instance", key: defaultInstance(...)}`; ключ без персонажа или без экземпляра → закрыть и снять выбор (как сейчас). `cardReturnKey = characterKey` всегда (и для холста) |
| `openInstance(taskKey, how: "switch" \| "link")` | переключение (п. 6.4 описания): `switch` закрывает раскрытия экземпляра, оставляет раскрытия роли, фокус на нажатом пункте, прокрутка тела — 0; `link` — как новое открытие: всё закрыто, фокус на «×». `selectedKey` и `cardReturnKey` = `roleKey` роли задачи |
| `renderCard()` | раздел 6 |
| `copyId(target)` | раздел 6.4 |
| `closeCard()` | фокус: кнопка легенды `cardReturnKey`, её нет — `#office-scroll` |
| `onCanvasClick(event)` | `hitOffice(office, sim.positions(), px, py, labelWidths(ctx, office))` → `openCard(key, null)` |
| `onKey(event)` | окно истории — как сейчас; иначе карточка открыта: Escape — закрыть, Tab/Shift+Tab — круг по управляющим элементам карточки (п. 6.3) |
| `shortId` | переносится в `words.js` |

`openHistory` по-прежнему закрывает открытую карточку без возврата фокуса (решение 0014, п. 6, 5: из
карточки окно не открывается). `historyOpenerElement` для `{kind:"journal", index}` возвращает кнопку
`.history-open` этой строки, если она показана, иначе список журнала.

`env` получает необязательное поле **`clipboardFn: () → {writeText(text): Promise} | null`**. Его нет
или он вернул не объект с функцией `writeText` — копирование считается отказом.

### 3.9 `tools/src/pixel-office/public/boot.js`

Добавляет в `env` поле `clipboardFn`, читающее `window.navigator.clipboard` (или null). Остальное
прежнее; это единственный файл, который читает окно (ф16).

### 3.10 `tools/src/pixel-office/public/index.html`

Не меняется: `#now` и `#now-text` (SPAN, класс `now-text`) остаются, содержимое строит `renderNow`;
`#card-overlay`, `#card` — прежние, содержимое строит `renderCard`. PN-17 проходит без правки.

### 3.11 `tools/src/pixel-office/public/style.css` — правила (что, без текста CSS)

Общие ограничения (принятые тесты, ф17, ф18): **ни одной новой строки с `px`** (рамки 1 px — новыми
селекторами в существующей сгруппированной строке `.card, .history, .history-table tr, .history-timeline`
или через `border-color`); **ни одного нового `@media`** (правки — внутри двух существующих); все размеры
в rem кратны 1/32 rem; новые правила не оканчиваются на `.item-state` и не задают `.item-head` свойств,
отменяющих перенос (PN-23).

| Селекторы | Что задают (по описанию) |
|---|---|
| `button:focus-visible, [tabindex]:focus-visible` (строки 72–75, единственная строка `outline: 2px` и `outline-offset: 2px`) | в эту группу добавляется селектор `summary:focus-visible` (кольцо раскрытий карточки и раскрытия события); новой строки `outline: 2px` нет (SC-03: ровно одна) (F7). Смещение кольца внутрь — отдельными правилами с одним свойством `outline-offset: -0.125rem` (rem, не px) для `.now-list`, `.row-toggle`, `.instance`, `.card-more > summary`, `.detail-more > summary` и `.card-close` в `@media (max-width: 599px)` |
| `.now` | `flex: 1 1 auto`, `min-width: 10rem`; в широкой раскладке высота 2,75 rem, отступы 0,25 / 0,875 / 0,25 / 0,75 rem (шапка остаётся 3,75 rem); вне её высота по содержимому; `align-items: flex-start` (точка напротив первой строки); `overflow: hidden` остаётся — кольцо списка рисуется внутрь |
| `.now-text` | контейнер подписи и списка: `display: flex`, без `white-space: nowrap`, без `text-overflow`, без `overflow: hidden`; в ≤ 599 px — столбец |
| `.now-label` | 0,8125 rem, 600, `--text`, `flex: none` |
| `.now-list` | `white-space: normal`, `overflow-y: auto`, `overflow-x: hidden`; `max-height` — 5,5 rem в общем правиле (пять линий), 2,125 rem внутри `@media` широкой раскладки (две линии по 1,3 × 0,8125 rem); тени прокрутки — только фоном (`background-attachment: local` и градиенты) из токенов; `.now-list:focus-visible` — `outline-offset: -0.125rem` |
| `.now-row` | `display: block`, 0,8125 rem / 1,3, `overflow-wrap: break-word`; `.now-role` 650; `.now-desc`, `.now-sep` 400 |
| `.now, .now-label, .now-text, .now-list, .now-row, .now-role, .now-sep, .now-desc` | **нет** `text-overflow`, `-webkit-line-clamp`, `white-space: nowrap` — ни в общих правилах, ни в `@media (max-width: 599px)` (старое правило `.now-text` с `-webkit-line-clamp` удаляется) |
| `.item`, `.item-head`, `.item-role`, `.item-state` | **не меняются**: у `.item` остаётся `overflow-wrap: anywhere` (перенос неизвестной роли, ISS-0062), раскладка `decisions/0053` и PN-23 прежние; название роли простыми словами меняет только текст `.item-role` |
| `.row-toggle` | кнопка во всю ширину, без рамки и фона, текст слева, `cursor: pointer`, шрифт наследуется; `[aria-expanded="true"]` — фон `--panel-2`; `:focus-visible` — `outline-offset: -0.125rem` |
| `.row-meta .who` | 650, `--text`, тот же разделитель « · », что у `.session` |
| `.row[data-tone="note"]` | `border-left-color: var(--violet)` |
| `.event-details`, `.detail`, `.detail-label`, `.detail-value`, `.detail-more`, `.details-close` | сетка 6,5 rem + 1fr, отступы описания п. 5.2; ≤ 599 px — подпись над значением; `overflow-wrap: anywhere` только у значений идентификаторов и технических полей; `summary:focus-visible` и кнопки — кольцо внутрь |
| `.overlay` | `overflow: hidden` (прокручивается тело карточки) |
| `.card` | `width: 40rem` (SC-04), `max-width: 100%`, `max-height: calc(100vh - 3.5rem)`, `display: flex`, `flex-direction: column`, `overflow: hidden`, `padding: 0`; `.card[data-columns="2"]` — `width: min(55rem, 100%)`; в ≤ 599 px — высота 100 %, `max-height: none` (правило ширины 100 % уже есть) |
| `.card-body` | `overflow-y: auto`, `overflow-x: hidden`, `min-height: 0`, `flex: 1 1 auto`, отступ 1,5 rem (≤ 599 px — 1 rem) |
| `.card-columns` | `display: grid`, `grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr))`, `gap: 1.5rem` (D6) |
| `.card-close` | ≤ 599 px — 2,75 × 2,75 rem в углу, кольцо внутрь |
| `.state-badge` + `[data-state=…]` | вид плашки описания п. 8.7: `display: inline-block`, `max-width: 100%`, 0,65625 rem, 700; цвета: `in_progress` — текст `--warn` на `--warn` 0,16; `completed` — `--ok` на `--ok` 0,16; `stale`, `restarted` — `--text` на `--muted` 0,16; `unrecorded` — `--text` на `--err` 0,16 (не `--err`: 4,01–4,41 : 1) |
| `.instance` | кнопка во всю ширину колонки; рамка 1 px — селектором в сгруппированной строке; `[aria-current="true"]` — `border-color: var(--accent)` и полоса слева 0,1875 rem; `:focus-visible` — кольцо внутрь |
| `.card-link` | вид `.history-open` (акцент, без рамки, подчёркивание при наведении) |
| `.card-more > summary` | высота ≥ 1,75 rem (≤ 599 px — 2,75 rem), прописные синие как заголовок блока; `:focus-visible` — кольцо внутрь |

### 3.12 `tools/README.md`, раздел «## Pixel Office»

Пишет FRONTEND-DEV (как в прогоне REQ-042). Содержание — по критериям 10 REQ-036, 9 REQ-045, 11
REQ-044: «строка на агента» (буквально), название роли простыми словами из таблицы `texts.js`, роль вне
таблицы — как пришла, холст и легенда — кратко (D13); таблица 12 случаев журнала с колонками «что
значит» и «Чего это не доказывает» (буквально), раскрытие события, записи оркестратора строками
(«Оркестратор записал, как понял запрос»), какие поля строки меняются задним числом (описание по связи z,
пометка «не из хуков» с текстами случая 12); карточка экземпляра (слово «экземпляр»), открытие нажатием на
персонажа, стол (с подписью), Enter на легенде, старшинство персонажа, три строки состояния, стол —
изображение роли, а не компьютер, «задание передано» — не действие агента, чего карточка не знает.
Строки 19 и 23 README («у каждого своя карточка по щелчку», «строка «Сейчас: …»», «карточкой агента по
щелчку») переписываются под новое поведение. Фразы DC-01 и FS-16 остаются.

### 3.13 Маскирование секретов в описании и ролях (дополнение r3, критерий 6 REQ-036)

**Пробел проекта.** Критерий 6 REQ-036 требует: вымышленный ключ вида `sk-…` и пара `password=…` в описании
и роли, пройдя настоящий путь хук → сервер → страница, не должны быть ни в файле журнала, ни в ответе
сервера, ни в `textContent` страницы — на их месте «[скрыто]». Описание требования утверждает, что это уже
так («уже заменён «[скрыто]» при записи (hook.js, mask.js)»), а проект (D1) считал хук и сервер
неизменными. Это неверно (ф25): маскируется только `prompt_text`. Пробел нашёл TEST-DESIGNER на шаге 5
(`handoffs/REQ044-20261014-01/step-05-test-designer.json`, BLOCKED); сейчас повторено мной.

**Решение (D14).** Поля `description`, `subagent_type` и `agent_type` маскируются той же функцией
`maskSecrets` (`tools/src/pixel-office/mask.js`, правила M1–M10), что `prompt_text` и запись оркестратора, —
**в двух местах, как `prompt_text`**: в хуке перед отправкой (`buildWriteBody`, первая линия) и на сервере
перед записью (`validateWriteBody`, вторая линия: сервер не доверяет телу запроса, хотя запрос подписан, —
так уже устроен путь `prompt_text`, проект REQ-008, раздел 3). Обе функции — в
`tools/src/pixel-office/protocol.js`; `server.js`, `hook.js`, `mask.js`, `schema.js` не меняются.

| Поле | Хук, `buildWriteBody` | Сервер, `validateWriteBody` |
|---|---|---|
| `description` (только `PostToolUse`) | вместо `truncateDescription(input.description)` — `prepareText(input.description, PROMPT_SCAN_MAX, DESCRIPTION_MAX)`: срез входа по `PROMPT_SCAN_MAX` без половины слова, маскирование, затем обрезка до 100 кодовых точек; пусто или одни пробелы → ключа нет | `maskField(value, DESCRIPTION_MAX)` |
| `subagent_type` (только `PostToolUse`) | прежняя проверка `takeString(…, 1)` на **исходном** значении (длиннее 128 — событие отбрасывается, как сейчас), затем `maskField(value, ID_MAX)` | `maskField(value, ID_MAX)` |
| `agent_type` (любое событие) | прежняя проверка `takeString(…, 0)` на исходном значении, затем `maskField(value, ID_MAX)` | `maskField(value, ID_MAX)` |
| `session_id`, `agent_id`, `tool_use_id`, `launched_agent_id` | **не маскируются** | **не маскируются** |
| `prompt_text` | без изменений | без изменений |

Новая функция в `protocol.js`: **`maskField(value: string, limit: number) → string`** —
`firstCodePoints(maskSecrets(value), limit)`; одна на хук и сервер для ролей и для описания на сервере.

Почему так:

1. **Порядок «маскировать, потом резать»** — как в `prepareText`: обрезка до маскирования могла бы
   оставить кусок секрета на краю, который правило уже не узнаёт.
2. **Длина после маскирования.** Метка «[скрыто]» — 8 знаков: короткое значение после маскирования
   длиннее исходного (проба: `password=ab` → `password=[скрыто]`, +6 знаков). Без обрезки строка не прошла
   бы `checkLine` (описание 0…100, роли 0…128 / 1…128), хук отбросил бы всё событие, а с ним — задачу и
   связь z (R2: потерянное событие хуже обрезанной метки). Поэтому после маскирования — обрезка до предела
   схемы, не отказ. Обрезка может разрезать метку в конце («[скр»): секрета в ней нет.
3. **Двойное маскирование безвредно.** `maskSecrets` не трогает значение, которое уже начинается с метки
   (заголовок `mask.js`; проба: `maskSecrets(maskSecrets("ключ sk-ant-…"))` = «ключ [скрыто]»). Сервер,
   получив маскированное хуком, ничего не меняет; маскирует только то, что пришло в обход хука.
4. **Идентификаторы не маскируются.** Связи задач (правило z, ключи задач, `launched_agent_id`)
   держатся на равенстве идентификаторов; M10 (длинные случайные строки) спрятал бы длинный `agent_id` и
   склеил разные задачи под одним ключом «[скрыто]». Критерий 6 говорит об описании и роли.
5. **Роль после маскирования детерминирована:** одна и та же роль в `SubagentStart`, `SubagentStop` и
   `subagent_type` маскируется одинаково, поэтому персонаж, стол и задачи роли не распадаются.
6. **Запись оркестратора уже маскируется** — команда (`note.js`, 108–112) и сервер (`server.js`,
   `processNote`, 351–355); не меняется.

**Что видит человек.** В строке «Сейчас», журнале, раскрытии и карточке — описание или роль с «[скрыто]»
на месте секрета, обычным текстом (`textContent`; страница не меняется). Роль «Sai Reviewer [скрыто]» не
подходит под форму `Sai … (КОД)` и показывается как пришла (D2).

**Следствие — ложные срабатывания (известный LOW, ISS-0058 и M10).** Правило M7 прячет любой отрезок из трёх
частей через точки, M10 — длинные строки из букв и цифр. Проба: «Шаг 5: тесты pixel-office-panels.test.js» →
«Шаг 5: тесты [скрыто]»; роль `my-very-long-agent-name-version2x` → «[скрыто]»; «проверка app.js и panels.js»,
«Sai Security Reviewer (SECURITY-REVIEWER)», `general-purpose` не меняются. Ошибка безопасная (секрет не
утекает), но описания с именами файлов из трёх частей станут менее понятны. Это расширяет действие
ISS-0058 на описания задач — вопрос О15 (поднять приоритет ISS-0058), здесь правила M7 и M10 не меняются.

**Чего маскирование не делает.** Уже записанные строки журнала не переписываются (журнал только
дописывается, quality-bar §6, п. 8): строка, записанная до шага 5c с секретом в описании, останется как
была и будет показана как есть — вопрос О16.

**Пути отказа** (дополнение к разделу 7):

| Случай | Итог | Что не меняется |
|---|---|---|
| маскирование удлинило поле сверх предела схемы | поле обрезано до 100 / 128 кодовых точек, событие записано | связь z, задача, остальные поля |
| описание из одних пробелов или пустое после подготовки | ключа `description` нет, как сейчас у пустого | событие записано |
| роль длиннее 128 до маскирования | событие отброшено хуком, как сейчас (проверка на исходном значении) | журнал |
| тело в обход хука (подписано, но не маскировано) | сервер маскирует сам и пишет; ответ 204 | — |
| `maskSecrets` получил не строку | `""` (контракт `mask.js`); до неё доходят только строки, прошедшие `checkLine` | — |

**Тесты** (новые идентификаторы MK-01…MK-05 свободны: `grep -rn '"MK-' tools/test/` — пусто):

| Тест (файл) | Что проверяет | Падает, если |
|---|---|---|
| MK-01 (`pixel-office-hook.test.js`) | `buildWriteBody`: `PostToolUse` с описанием «ключ sk-ant-<вымышленный> password="<вымышленный>"» и `subagent_type`/`agent_type` с тем же ключом → в теле все три поля с «[скрыто]», ни одной подстроки секрета; `agent_id`, `tool_use_id`, `launched_agent_id` из 40 букв и цифр — без изменений; `SubagentStart` с ролью-секретом → `agent_type` маскирован | маскирование убрано на хуке, применено не к тому полю, задело идентификатор |
| MK-02 (`pixel-office-server.test.js`) | `validateWriteBody` и `POST /api/events` с телом в обход хука (секреты в трёх полях) → в файле журнала и в ответе `GET /api/events` секретов нет, есть «[скрыто]»; тело, уже маскированное хуком, записывается без изменений (двойное маскирование безвредно) | маскирование убрано на сервере |
| MK-03 (`pixel-office-hook.test.js`) | длина: описание 98 знаков, оканчивающееся на `password=ab` → в теле 100 знаков, событие не отброшено; роль 127 знаков с `password=ab` → 128 знаков; описание 150 знаков с ключом на 95-й позиции → ни одной подстроки ключа (маскирование до обрезки); HK-05 (100 знаков без секрета — без изменений) проходит | обрезка до маскирования, отказ вместо обрезки |
| MK-04 (`pixel-office-panels.test.js`) | одна роль-секрет в `SubagentStart`, `SubagentStop` и `subagent_type` строки `PostToolUse` → одна задача, одна роль, связь z даёт описание; ловушка ISS-0058 записана литералами: «… pixel-office-panels.test.js» скрывается (известное поведение, тест фиксирует его, а не одобряет) | роль распалась на две |
| MK-05 (`pixel-office-hook.test.js`) | `agent_id` длинный случайный (40 знаков, буквы разного регистра и цифры) у `SubagentStart`, `SubagentStop` и `launched_agent_id` у `PostToolUse` — после хука и сервера равны исходному | маскирование задело идентификатор |
| NM-06 (`pixel-office-page.test.js`, дописывается) | полный путь: настоящий хук (`hook.sh`) → настоящий сервер → страница: секрет в описании и роли не в файле журнала, не в ответе сервера, не в `textContent` строки «Сейчас», журнала, раскрытия и карточки; на его месте «[скрыто]» | любое из звеньев не маскирует |

**Ловушки** — раздел 11, пп. 24–27.

**Кто и когда** — раздел 8.2: CODE-FIXER на шаге 5c (`tools/src/pixel-office/protocol.js`), затем повтор
шагов 3 и 4, затем TEST-DESIGNER дописывает NM-06 и MK-01…MK-05 (шаг 5 продолжается), затем 5b и 6.

## 4. Правила

### 4.1 Случай события, «кто», слова (REQ-045, критерии 1, 2)

Таблица `words.js` (3.2). Строка помеченная («не из хуков») — слова и «кто» её вида; в раскрытии
«что значит» и «чего не доказывает» — случая 12, пометка — с причиной. Записи оркестратора не бывают
помеченными (`readRule` их не помечает: ф6), их случай всегда 11. Слова строки не зависят от строк
после неё и от часов; задним числом меняются только описание у SubagentStart/Stop (связь z) и пометка
(с ней — тексты раскрытия между случаем 12 и своим).

### 4.2 Поле «Задача» раскрытия (REQ-045, критерий 3; REQ-046 «Задача события»)

Значение — текущее состояние (подпись `TASK_NOW` «сейчас»), поэтому оно может меняться.

| Строка | Задача | Текст поля |
|---|---|---|
| помеченная (любого вида) | — | `TASK_NOT_RELATED` |
| SessionStart, SessionEnd | — | `TASK_NOT_RELATED` |
| SubagentStart, SubagentStop | задача с ключом `agent_id` строки | «<roleName> · <8 знаков> · сейчас: <плашка>»; нет задачи (SubagentStop без начала) — `TASK_NOT_FOUND` |
| PostToolUse | задача с ключом `launched_agent_id` (D10) | как выше; нет — `TASK_NOT_FOUND` |
| UserPromptSubmit | строка основной сессии `main:<index>` | «Основная сессия · сейчас: <плашка>» (без ключа) |
| Stop | строка основной сессии с `end_index === index` | то же; нет — `TASK_MAIN_NOT_FOUND` |
| запись оркестратора | строка основной сессии запроса, к которому запись привязана правилом 5 окна истории (номер записи есть в `history.requests[].notes[].index`) — `main:<номер запроса>` | то же; не привязана — `TASK_NOT_RELATED` (D9) |

### 4.3 Карточка: три строки состояния (REQ-044, критерий 4)

| Строка | Значение | Основание (линии) |
|---|---|---|
| «Задача» | плашка `STATE_LABELS[state]` | `in_progress`, `stale`: «`LABEL_LAST_EVENT` <дата-время> · <возраст> · `FRESH_LIMIT`»; второй линией `act` последнего начала (`agent_start` или `agent_resume`) · <дата-время>. `restarted`: `SERVER_STARTED`, без возраста. `completed`: `agent_stop.act` · <дата-время последнего SubagentStop>. `unrecorded`: `session_end.words` · <дата-время SessionEnd> |
| «Агент» | `act` последнего события экземпляра · <дата-время> · <возраст> | постоянная линия `AGENT_NOT_RECORDED` |
| «Рабочее место» | `WORKPLACE_WORKING` с числом задач роли «в работе» или `WORKPLACE_IDLE` | постоянная линия `WORKPLACE_DESK` |

Дата-время — `fmtDateTime`; возраст — `ageText(ageOf(at, model.now_ms))` (часы страницы, решение 0052);
нечитаемое время — `TIME_UNKNOWN` вместо времени и возраста. Числа в карточке — только времена, возрасты,
8 знаков идентификаторов, «показано n из N», «экземпляров роли: N», число в «Рабочем месте».

## 5. Журнал на странице

### 5.1 Разметка строки

`li.row` (`data-index`, `data-tone`, `data-marked`, `data-kind`; у запроса владельца с окном — класс
`opens-history` и `data-request`, как сейчас, чтобы помощники тестов находили строку):

1. `button.row-toggle` (`type="button"`, `aria-expanded`, `aria-controls="event-<index>"`,
   `data-focus="toggle"`): `span.row-meta` (`span.time` ЧЧ:ММ:СС или `TIME_UNKNOWN`, `span.who`,
   `span.session` 8 знаков или `SESSION_UNKNOWN`; у помеченной — `span.source`, `span.mark`;
   `span.row-icon` «▸»/«▾» с `aria-hidden="true"`), `span.row-main` → `span.event` (слова), `span.row-desc`
   (если описание есть), `span.history-service` у служебного запроса.
2. `button.history-open` (`data-request`, `data-focus="history"`, текст `HISTORY_OPEN`) — только у
   запроса владельца с окном.
3. `div.event-details#event-<index>` — только у открытой строки: `div.detail[data-field]` по полям 3.4 в
   порядке описания п. 5.2 (`span.detail-label` + `span.detail-value`); у «Сессии» —
   `details.detail-more[data-part="session"]` с `summary` `SESSION_FULL` и полным значением; текст записи —
   метки «[скрыто]» отдельными `span.history-masked`; плашка состояния задачи — `span.state-badge`;
   `details.detail-more[data-part="tech"]` (закрыто) → список «ключ: значение»; `button.ctl.details-close`
   (`data-focus="close"`, `DETAILS_CLOSE`).

Всё — `textContent`; `prompt_text` нигде не выводится.

### 5.2 Поведение

| Действие | Итог |
|---|---|
| нажатие или Enter/Space на `.row-toggle` закрытой строки | `journalOpen = index` (прежнее раскрытие закрывается), фокус остаётся на `.row-toggle` |
| то же на открытой | закрыть, фокус на `.row-toggle` |
| «Закрыть» | закрыть, фокус на `.row-toggle` |
| Escape при фокусе внутри `li` открытой строки | закрыть, фокус на `.row-toggle` (обработчик `keydown` на `li`) |
| `.history-open` | `openHistory(key, {kind:"journal", index})`; после закрытия окна фокус на эту кнопку |

### 5.3 Пересборка журнала

- Перед заменой: открыт ли элемент `details` каждой части (`data-part`) в открытом раскрытии, какой
  элемент в фокусе (`index` строки + `data-focus`, у `summary` — `part`). После: открыть те же части,
  вернуть фокус тому же элементу той же строки.
- Якорь: пока `journalOpen` не null, список держит положение открытой строки (её `offsetTop − scrollTop`
  до и после одинаков) и не прыгает вниз к новым строкам; иначе — как сейчас (низ или первая видимая).
- При открытии: если `li` ниже видимой части — `scrollTop` так, чтобы низ `li` совпал с низом списка, но
  верх `li` не выше верха списка; если выше — верх `li` к верху списка.
- Строки `journalOpen` нет среди показанных (фильтр, предел 200, журнал заменён) → `journalOpen = null`;
  если фокус был внутри неё — фокус на `#journal`.

## 6. Карточка на странице

### 6.1 Разметка

`#card` (`data-kind="instance"|"main"`, `data-columns="1"|"2"` — 2, если у роли больше одного экземпляра):

1. `button.card-close` (`data-focus="close"`, «×», `aria-label` `CARD_CLOSE`).
2. `div.card-body`:
   - `div.card-head`: `span.card-swatch[data-color]`, `h3#card-title.card-title` (`title`),
     `span.card-code` (если `code`), `p.card-ids` («экземпляр » `b.card-id` « · сессия » `b.card-id`),
     `details.card-more[data-part="ids"]` → `summary[data-focus="ids"]` + две строки `div.copy-row`
     (`span.copy-label`, `span.full-id`, `button.ctl.copy[data-focus="copy-agent"|"copy-session"]`
     с `aria-label`, `span.copy-result[data-ok]` — после попытки); при `link === "down"` —
     `p.card-offline` `NO_CONNECTION`.
   - `div.card-columns`: `section.card-instance` (блоки «Текущая задача», «Состояние» —
     `div.state-row[data-row="task"|"agent"|"workplace"]`, «Кто запустил» — `button.card-link
     [data-focus="launcher"]` или текст, две фразы `p.card-unknown`) и, если экземпляров больше одного,
     `section.card-instances` (`h4` + `span.card-count` `INSTANCES_COUNT`; `ul` → `li` →
     `button.instance[data-key][data-focus="instance:<key>"]`, текущий — `aria-current="true"`; при больше 5 —
     `p.tasks-note` `SHOWN_NOTE` и `details.card-more[data-part="more"]` с остальными пунктами).
   - раскрытия `details.card-more[data-part=…]` по порядку: `given`, `starts`, `returns`, `launched`
     (пункты с задачей — `button.instance[data-focus="launched:<key>"]`), `role` (прежние
     `section.card-section[data-list]` с `h4` и элементами `.item`, строки «Последних событий» — строки
     журнала без кнопок). Пустое раскрытие — `CARD_EMPTY`, кроме «Возвратов» — там плашка состояния.
   - Все раскрытия при открытии карточки закрыты.

Карточка основной сессии: прежнее содержимое (заголовок «Основная сессия», `span.card-working`
`CARD_SESSIONS` + число, пять разделов) в той же рамке (`button.card-close` + `div.card-body`).

### 6.2 Пересборка (D5)

Перед построением: снять `open` каждого `details[data-part]`, `data-focus` элемента в фокусе (если он в
карточке), `scrollTop` тела. Построить новое дерево целиком; ошибка построения — `reportOnce`, на
экране остаётся прежнее. Заменить, восстановить раскрытия, фокус (элемента с тем же `data-focus` нет —
на «×»), прокрутку. Экземпляра больше нет в модели → карточка закрывается, выбор снимается; если фокус
был в карточке — фокус по правилу `closeCard`.

### 6.3 Клавиатура

Tab/Shift+Tab при открытой карточке (окна истории нет): `preventDefault`, переход к следующему/
предыдущему элементу из списка «управляющих» по кругу. Управляющие — все `button` и `summary` в `#card`
в порядке дерева, кроме лежащих внутри закрытого `details` (собственный `summary` закрытого `details`
входит) и скрытых. Фокус вне карточки → Tab на первый («×»), Shift+Tab — на последний. Escape — закрыть.
Enter/Space на `button` и `summary` — родная активация браузера.

### 6.4 Копирование

`copyId(target)`: значение — полный `agent_id` или `session_id` экземпляра. `clipboardFn` нет, вернул не
то, `writeText` бросил или обещание отклонено → `copied = {key, target, ok: false}`; удача → `ok: true`.
После любого итога — `renderCard`, если открыт тот же экземпляр. Надпись видна, пока не нажата другая
«Скопировать», не переключён экземпляр и не закрыта карточка; плановая пересборка её не стирает.
`writeText` вызывается ровно один раз на нажатие и получает только значение.

## 7. Пути отказа

| Случай | Что видит человек | Что не меняется |
|---|---|---|
| первая загрузка не удалась | как сейчас: «Нет связи с сервером Pixel Office» в журнале, блока «Сейчас» нет | — |
| связь потеряна | журнал, раскрытие, «Сейчас», карточка — последнее загруженное; в шапке карточки `NO_CONNECTION`; возраст растёт по часам | открытые раскрытия, фокус, экземпляр |
| ответ чужой формы, обрыв по пределу | то же | то же |
| нечитаемое время строки | `TIME_UNKNOWN` в строке, «Когда», в карточке вместо времени и возраста | страница работает, исключения нет |
| пустая роль, роль вне таблицы, 60 знаков, разметка | `ROLE_UNKNOWN` / роль как пришла, перенос, текст | — |
| идентификаторы по 128 знаков | 8 знаков; полностью — в раскрытиях, перенос; горизонтальной прокрутки нет | — |
| запись оркестратора без сессии, без времени запроса | `SESSION_UNKNOWN`; поля «Требование», «Время запроса» не выводятся | задачи, офис, «Сейчас» |
| SubagentStop без начала, PostToolUse без задачи, Stop без строки | тексты таблицы 4.2 | задач не прибавилось |
| буфер обмена нет / отказал / бросил | `COPY_FAIL`, значение видно | страница, карточка |
| экземпляр исчез (журнал заменён) | карточка закрыта, фокус — кнопка легенды или область офиса | — |
| открытая строка ушла из показа | раскрытие закрыто, фокус — список журнала, если был в раскрытии | фильтр |
| ошибка построения карточки, журнала, «Сейчас» | на экране последнее нарисованное; одна строка в консоли (`reportOnce`) | остальные части страницы (`guarded`) |
| `measureText` бросил, холст не поддерживается | подпись не попадает, персонаж и стол — попадают / нажатий на холст нет (как сейчас) | — |
| точка нажатия не число (холст без размера) | ничего не открыто, карточка закрыта | — |
| журнал пуст | «Событий от хуков пока нет», «0 из 0»; персонажей нет — карточку открыть не на чем | — |

Ни в одном тексте журнала, раскрытия, «Сейчас» и карточки нет «undefined», «null», «NaN», «[object».
Страница по-прежнему только читает (`GET`), не пишет ни файлов, ни хранилища браузера.

## 8. Связи и порядок работы, кто что пишет

Сервер, хук, схема журнала — не меняются (ф9, ф24); контракт между страницей и сервером прежний
(`GET /api/events`). Общий контракт внутри страницы — `texts.js` и `words.js`. Шаг 2 делится на четыре
подшага (решение ORCH по F5), каждый — отдельный handoff FRONTEND-DEV; писатель один, двух писателей
одного файла нет. `index.html`, `model.js`, `office-model.js`, `schema.js`, `layout.js`, `office-sim.js`,
`format.js`, `office-report.js` и всё вне `public/` в коде на шаге 2 не трогаются; `protocol.js` (D14) и одна функция `model.js` (находка ревью F1) меняются на шаге 5c (п. 8.2).

### 8.1 Подшаги и ожидаемые провалы

Проверка каждого подшага: `cd tools && npm run format:check && npm run lint && npm run traces && npm run
handoffs-check` — код 0; затем `cd tools && npm test` — всего 336 тестов (разработчик тестов не
добавляет), красные — **ровно** названные ниже (по заголовку), все файлы тестов загружаются (нет «not ok»
на уровне файла). `npm run check` целиком зелёным станет после шага 5 (он останавливается на первом
красном шаге). Ставшие ненужными импорты удаляются в том же подшаге (иначе `lint`): например, `roleLabel`
из `panels.js` и `app.js` в 2a.

| Подшаг | Требование | Файлы | Что | Красные после подшага (накопительно) |
|---|---|---|---|---|
| 2a | REQ-036 | `public/texts.js` (`ROLE_NAMES`, `NOW_LIST_LABEL`; удалить `NOW_MORE`), `public/words.js` (`roleName`, `shortId`), `public/panels.js` (`nowLine`), `public/app.js` (`renderNow`, `itemInto`), `public/style.css` (правила `.now*`) | 3.1, 3.2, 3.3, 3.8, 3.11 | 4: PN-02, PN-09, FS-08, FS-14 (`pixel-office-panels.test.js`, «the panels on the sample») |
| 2b | REQ-045 | `public/texts.js` (`EVENT_TABLE`, константы журнала; `EVENT_LABELS` остаётся устаревшим, страницей не используется), `public/words.js` (`repeatedStarts`, `eventCase`, `lineRole`, `eventWords`, `whoOf`, `markReason`), `public/panels.js` (`journalRows`), `public/event-details.js` (новый), `public/history.js`, `public/app.js` (журнал, раскрытие, кнопка окна), `public/style.css` (строка, раскрытие, группа кольца) | 3.1–3.5, 3.8, 3.11, 4.1, 4.2, 5 | 16: те же 4 и PN-06, PN-19, PN-20, PN-21, PN-22 (`pixel-office-panels.test.js`), FS-11 «the word in the meta of the window of history, opened from a row…» (`pixel-office-panels.test.js`), PG-24, PG-25, PG-26, PG-27, PG-27b, PG-28 (`pixel-office-page.test.js`) |
| 2c | REQ-044 | `public/texts.js` (константы карточки; `CARD_WORKING` остаётся устаревшим, страницей не используется), `public/office-view.js` (`labelWidths`, `hitOffice`), `public/instance-card.js` (новый), `public/app.js` (карточка, холст, клавиши, копирование), `public/boot.js`, `public/style.css` (карточка) | 3.6–3.9, 3.11, 4.3, 6 | 20: те же 16 и OF-10, OF-23, OF-40 (`pixel-office-office.test.js`), PN-14 (`pixel-office-panels.test.js`) |
| 2d | все три | `tools/README.md` (только раздел «## Pixel Office») | 3.12 | те же 20; DC-01 и FS-16 (`pixel-office-docs.test.js`) зелёные |

Почему краснеют именно они (F1): PN-02, FS-08, FS-14 — форма «Сейчас»; PN-09 — подпись «Оркестратор»; PN-06
— слова и «кто»; PN-19, PN-21, PN-22 — строка больше не открывает окно; PN-20, FS-11, PG-24, PG-25, PG-27b,
PG-28 — открывают окно щелчком по строке (помощник `openWindow`, `historyRowOf(...).click()`, `opener.click()`);
PG-26 — запись оркестратора стала строкой; PG-27 — слова хронологии; OF-10, OF-23, PN-14 — «в работе: N»;
OF-10, OF-40 — заголовок карточки. Пары «было → стало» — раздел 10.

Прототип (вне проекта, копия дерева на метке `base/REQ044-20261014-01`, только контрактные изменения
проекта, без полного кода карточки и раскрытий): метка — `# tests 336 # pass 336`; удаление трёх экспортов
сразу (прежний D13) — `# tests 243 # pass 240 # fail 3`, файлы `pixel-office-office.test.js` и
`pixel-office-panels.test.js` не загружаются (повтор находки F1); только `NOW_MORE` — `336 / 336`; 2a —
`336, fail 4` (список выше); 2a + 2b — `336, fail 16`; 2a + 2b + 2c — `336, fail 20`. Полный код может
дать провал, которого прототип не видел: такой тест разработчик называет в `result.issues` подшага с
причиной, а если его нет в разделе 10 — это вопрос CODE-DESIGNER через ORCH (отступление от проекта или
пропуск таблицы), а не тихая правка.

### 8.2 Шаги после кода

| Шаг | Кто | Файлы | Что | Проверка |
|---|---|---|---|---|
| 5 | TEST-DESIGNER | `tools/test/pixel-office-*.test.js`, `tools/test/pixel-office-helpers.js`, `tools/test/fixtures/pixel-office/` | замены раздела 10, новые тесты раздела 9 (часть NM-06 с секретом и MK-01…MK-05 — после шага 5c, п. 3.13); убирает из тестов импорт `EVENT_LABELS` (`pixel-office-panels.test.js`, строка 16), `CARD_WORKING` (`pixel-office-office.test.js`, строка 50) и обращения `TX.EVENT_LABELS` (`pixel-office-page.test.js` 1502–1508) — сравнения идут с литералами | `npm run check` — код 0 (устаревшие экспорты ещё на месте) |
| 5b | TEST-DESIGN-VALIDATOR | — | ворота тестов | — |
| 5c | CODE-FIXER | `public/texts.js`; `tools/src/pixel-office/protocol.js`; `public/model.js`, `public/app.js`, `public/instance-card.js`, `public/style.css` | (а) удалить экспорты `EVENT_LABELS` и `CARD_WORKING`; (б) D14 — маскирование `description`, `subagent_type`, `agent_type` в `buildWriteBody` и `validateWriteBody`, функция `maskField` (п. 3.13); (в) находка ревью F1: одна общая проверка состояний — в `model.js` рядом с `UNCONFIRMED_STATES` две чистые функции: `showsSessionEvent(state)` («в работе» или без подтверждения: `in_progress`, `stale`, `restarted`) и `showsAge(state)` (`in_progress`, `stale`); `app.js` (прежняя `hasSessionEvent` и литералы у строки 1386) и `instance-card.js` (строки 81–82) берут их, поведение не меняется; (г) F2: убрать лишний второй аргумент у всех вызовов `openCard` (`app.js`, сейчас строки 628 — `c.key`, 1848 и 2323 — `null`; ревью назвало два с `null`, третий того же рода, AP-014; сигнатура `openCard(key)`); (д) F3: в худшем случае окна 1470 × 784 (описание 100 знаков, «нет свежих данных», возраст в сутках) нижний край второй фразы «чего журнал не знает» не ниже нижнего края видимого тела карточки при прокрутке 0 — `margin-top` у `.card-unknown` 0,75 → 0,375 rem (две фразы: −12 px при замеренном недоборе 6 px), без смены шрифта; описание интерфейса п. 7.5 приводит GUI-DESIGN-ANALYST (вопрос О17) | `grep -rn 'EVENT_LABELS\|CARD_WORKING' tools/src/pixel-office/ tools/test/` — пусто; поиск семи старых слов (критерий 1 REQ-045) — пусто; проба п. 3.13 (секрет в трёх полях → «[скрыто]»); `grep -n 'hasSessionEvent\|=== "stale"' tools/src/pixel-office/public/app.js tools/src/pixel-office/public/instance-card.js` — только вызовы общих функций; `npm run check` — код 0 (принятые тесты зелёные: HK-05 и тесты маскирования `prompt_text` не меняются) |
| 3, 4 (повтор) | SECURITY-REVIEWER, REVIEWER | — | проверка изменения шага 5c; для SECURITY-REVIEWER — Q7 и R2 по D14 (п. 3.13) | своими командами |
| 5 (продолжение) | TEST-DESIGNER | файлы тестов (как выше) | часть NM-06 с секретом, MK-01…MK-05 (п. 3.13); если CODE-FIXER поменял строки, на которые ссылаются тесты, — без ослабления | `npm run check` — код 0 |
| 5b | TEST-DESIGN-VALIDATOR | — | ворота тестов, в том числе мутанты 24–27 раздела 11 | — |
| 6 | TEST-RUNNER | — | одна команда проверки | `npm run check` |
| до шага 9 | DOC-UPDATER (отдельный handoff, решение ORCH по О2) | документы раздела 12 | замена описаний удалённых констант и прежней формы | поиск раздела 12 |

### 8.3 Помощник тестов (шаг 5)

Поддельный DOM получает родную активацию — `keydown` Enter или Space, не отменённый `preventDefault`, на
`BUTTON` и `SUMMARY` вызывает `click`; `click` по `SUMMARY` переключает `open` родительского `DETAILS`;
свойство `open` у `DETAILS`; `makePage` принимает `clipboard` (поддельный объект, `null` или бросающий) и
передаёт его как `clipboardFn`.

## 9. Таблица «критерий → элемент проекта → тест» (Q5)

Файлы тестов — `tools/test/`. «Падает, если» — что именно краснеет.

### 9.1 REQ-036

| Кр. | Что | Элемент | Тест (файл) | Падает, если |
|---|---|---|---|---|
| 1 | таблица названий: каждый код из `.claude/agents/*.md` (тест сам читает `name:`), 1–40 знаков, без латиницы и запретных слов, различны; пример «Проверка безопасности»; строка «Сейчас» = «Проверка безопасности — <описание>»; `.item-role` в «Текущих» и после SubagentStop в «Истории» — «Проверка безопасности»; «SECURITY-REVIEW…» нигде в блоке и панели; подпись персонажа на холсте (`fillText`) — прежняя краткая; `Explore`, `general-purpose`, 60 знаков, вымышленная роль другого окружения с кодом Sai не в форме `Sai … (КОД)` (например, «Demo Reviewer (REVIEWER)») — как пришли | 3.1, 3.2 `roleName`, 3.3, 3.8 `itemInto` | NM-01 (`pixel-office-panels.test.js`) | код без названия, обрезка, разные тексты в двух разделах, чужая роль переведена |
| 2 | n строк: 1 → 1; 5 (три роли, две по два раза) → 5 со своими описаниями; без описания — только название; основная сессия + 2 → 3, первая — `MAIN_ROW` по порядку `taskPanel(...).current`; SubagentStop → строки нет после опроса; пусто → «Сейчас: в работе ничего нет»; поиск `NOW_MORE` и `· и ещё` по `tools/src/pixel-office/` — пусто | 3.3 `nowLine`, 3.8 `renderNow` | NM-02 (`pixel-office-panels.test.js`) + команда | строк меньше, порядок не как у «Текущих», «и ещё» осталось |
| 3 | описание 100 широких знаков, роль 60 знаков, слово без пробелов — `textContent` строки целиком, без «…»; разбор `style.css`: у восьми селекторов блока (3.11) нет `text-overflow`, `-webkit-line-clamp`, `white-space: nowrap`, в том числе в `@media (max-width: 599px)` | 3.11 | NM-03 (`pixel-office-panels.test.js`); браузер — DESIGN-QA-VALIDATOR (кр. 7) | правило обрезки вернулось в любом блоке |
| 4 | 12 агентов → 12 строк, нет «и ещё»; `.now-list` в CSS — `overflow-y: auto`; в браузере `scrollHeight > clientHeight` у `#now-list`, документ не шире и не выше окна на 1920 × 1080 и 1470 × 784 | 3.3, 3.11 | NM-04 (`pixel-office-panels.test.js`); замеры — DESIGN-QA-VALIDATOR | строка заменена словами, блок без прокрутки |
| 5 | строки только из `agent_type` и `description`; запрос владельца, запись оркестратора с `req_id` и `note_text` в журнале → в `#now` их текстов нет; поиск методов `POST\|PUT\|PATCH\|DELETE` по `public/` — пусто; связь потеряна — `#now` прежний | 3.3 | NM-05 (`pixel-office-panels.test.js`) + команда; PN-02 (изменённый) | текст записи или запроса попал в блок |
| 6 | образец секрета из `pixel-office-hook.test.js` (вымышленный `sk-…` и `password=…`) в описании и роли через настоящий путь хук → сервер (помощники запуска хука) → в файле журнала, ответе сервера и `textContent` страницы нет, есть «[скрыто]»; `<script>alert(1)</script>` в описании — текст, элемента нет; поиск `innerHTML\|outerHTML\|insertAdjacentHTML\|document.write` по `public/` — пусто | 3.8 (только `textContent`), 3.13 (D14) | NM-06 (`pixel-office-page.test.js`, путь хук → сервер → страница), MK-01…MK-05 (`pixel-office-hook.test.js`, `pixel-office-server.test.js`, `pixel-office-panels.test.js`) + команда | секрет в журнале, ответе сервера или на странице; элемент на странице |
| 7 | правила блока и строк — в rem, без высоты в px; число строк `px` и `@media` прежнее (SC-03, SC-05 без правки); снимки и замеры 1920 × 1080, 1920 × 950, 1470 × 784, 480 × 800, 390 × 844 в четырёх состояниях, шрифт строки ≥ шрифта строки журнала, под холст ≥ 594 px (тест критерия 18 REQ-007 без правки) | 3.11 | NM-07 (`pixel-office-scale.test.js`); DESIGN-QA-VALIDATOR (шаг 7) | px или новая высота; страница прокручивается на широких |
| 8 | описание интерфейса `docs/design/REQ-036-044-045-ui.md` (подходит под `REQ-036-*.md`) проверено; сценарий BA-ANALYST «что сейчас делает каждый агент» на настоящем журнале сессии прогона | — | CODE-DESIGN-VALIDATOR (шаг 1b); `docs/uat/REQ-036*.md` (шаг 8) | — |
| 9 | (а) выполнено до прогона (ф22); (б) числа `^test(`/`assert.` по каждому файлу не меньше метки (ф21); каждая удалённая или изменённая строка с `test(` — в указателе 10.0 с идентификатором (пара — раздел 10, 10.1–10.3); правки только в `tools/test/pixel-office-*` и `fixtures/pixel-office/`; (в) `grep -rn '· и ещё\|NOW_MORE' tools/test/ tools/src/pixel-office/ docs/design/REQ-007-office-ui.md` — пусто; `npm run check` — 0 | раздел 10, раздел 12 | команды критерия — RELEASE-VALIDATOR; NM-08 нет (проверка истории git — не юнит-тест, как в REQ-042) | число упало, строка теста без пары |
| 10 | README: `awk … \| grep -c 'строка на агента'` ≥ 1; `npm ci && npm run check` на копии без `node_modules`; `npm run traces` — 0 | 3.12 | NM-09 (`pixel-office-docs.test.js`) + команды TEST-RUNNER | фразы нет |

### 9.2 REQ-045

| Кр. | Что | Элемент | Тест (файл) | Падает, если |
|---|---|---|---|---|
| 1 | 12 литералов в тесте равны `EVENT_TABLE` (слова, «что значит», «не доказывает», причины); правило целостности `act`; на последовательности со всеми видами (повторное начало, три вида UserPromptSubmit, запись, три пометки) слово каждой строки = своему случаю с ролью этой строки; хронология окна — те же слова, у записи — `HISTORY_NOTE_BY`; поиск семи старых слов по `public/` — пусто | 3.1, 3.2, 3.3, 3.5 | JR-01 (`pixel-office-panels.test.js`) + команда | слово расходится, старое слово осталось |
| 2 | порядки (i) и (ii), часы до и после `STALE_AFTER_MS`: для каждого начала журнала время, «кто», слова, сессия, `agent_id`, источник равны полным; у PostToolUse слова те же до и после прихода SubagentStart; описание у SubagentStart в (ii) — только после PostToolUse; последняя строка из будущего → пометка `future` и тексты 12, после следующей строки — свои, слова те же; ни в одной строке нет значения `STATE_LABELS`; **дополнительно**: перед повторным началом — поддельная строка `SIMULATION` того же `agent_id` → настоящее первое начало остаётся «получил задание…» (D3); **общий случай с карточкой (F2)**: первая строка `SubagentStart` экземпляра — `REAL`, помечена конфликтом времени (правило (б)), за ней доверенная `SubagentStart` того же `agent_id` → слова второй строки в журнале «Агент «…» продолжил работу», и в карточке этого экземпляра пункт «Начала работы», строка «Агент» и вторая линия «Задачи» — те же слова (`agent_resume.act`), а не «получил задание…» | 3.2 инвариант, 3.7, 4.1, D3 | JR-02 (`pixel-office-panels.test.js`) | слова зависят от будущего, часов или поддельной строки |
| 3 | по строке каждого из 12 случаев — поля раскрытия по 3.4 и 4.2 (в том числе «Задача» PostToolUse — задача запущенного, без неё — `TASK_NOT_FOUND`; запись — строка основной сессии её запроса или «к задаче не относится»); Enter и Space (родная активация помощника) раскрывают, Escape закрывает, `document.activeElement` — `.row-toggle`; «Закрыть» — то же; `prompt_text` нет в тексте раскрытия и технических полей; `.history-open` открывает окно по нажатию и Enter, после закрытия фокус на ней; после новой строки и пересчёта раскрытие открыто, «Технические поля» открыты, фокус на том же элементе; `aria-expanded` и `aria-controls` | 3.4, 4.2, 5 | JR-03 (`pixel-office-page.test.js`) | поле не то, фокус ушёл, раскрытие закрылось |
| 4 | две записи (одна с `session_id`, `req_id`, `request_time`; другая без) → две строки «Оркестратор записал, как понял запрос» на своих местах, «кто» «Оркестратор», «сессия не указана» у второй; в тексте строк нет `note_text` и `req_id`, в раскрытии есть (метки «[скрыто]» — отдельными элементами); «Работа» и «Офис» — прежние строки; «N из M» во «Всё» считает записи; модель задач, строки основной сессии, офис и `#now` те же, что без записей (FS-01 без правки) | 3.3 | JR-04 (`pixel-office-panels.test.js`) | запись не строкой или меняет состояние |
| 5 | поиск `заверш\|готов\|выполнен\|успешн` по `public/` кроме `HISTORY_META_FINISHED` — пусто; «не доказывает» начинается с «Не доказывает»; значения целиком (JR-01) | 3.1 | JR-01 + команда | слово успеха; текст сокращён |
| 6 | `<img src=x onerror=alert(1)>` и `<script>window.__x=1</script>` в роли, описании, идентификаторах, тексте записи, технических полях — буквально в строке и раскрытии, `img`/`script` не созданы, `window.__x` не задан; роль `$&` и `$'` в `{role}` и источник `$&` в причине — буквально (D12); только GET | 3.2, 5.1 | JR-05 (`pixel-office-page.test.js`) + команды | создан элемент, шаблон исказил текст |
| 7 | пустой журнал (прежние тексты), строка основной сессии без `agent_type` — «Основная сессия», пустые `agent_type`/`subagent_type` — `ROLE_UNKNOWN`, нечитаемое время — `TIME_UNKNOWN` в строке и «Когда», агент без задачи, запись без сессии и времени запроса, идентификаторы по 128 знаков, связь потеряна при открытом раскрытии — без исключений (`reportOnce` не вызван), `textContent` журнала не совпадает с `undefined\|null\|NaN\|[[]object` | 3.3, 3.4, 7 | JR-06 (`pixel-office-page.test.js`) | исключение, служебное слово в тексте |
| 8 | стенд (как критерий 10 REQ-044, с записью оркестратора и строкой в конфликте времени): шаги 1–4 буквально; окна 1470 × 784 и 375 × 812; слова не рвутся по буквам (`Range.getClientRects()`), кольцо фокуса у строк; автоматическая часть — правила CSS `.row-toggle:focus-visible` (смещение внутрь), отсутствие `nowrap` у `.row-toggle` и `.event` | 3.11, 5 | JR-09 (`pixel-office-panels.test.js`, CSS); `docs/uat/REQ-045.md` и `-RUN.md` (BA-ANALYST, UAT-RUNNER, шаг 8); RELEASE-VALIDATOR повторяет 2–4 | кольцо обрезано, перенос по буквам |
| 9 | README: `grep -c 'Чего это не доказывает'` ≥ 1, `grep -c 'Оркестратор записал, как понял запрос'` ≥ 1; `node --test test/pixel-office-docs.test.js` — 0; числа тестов по файлам не меньше метки; `npm run check` — 0, `skipped 0`, `todo 0` | 3.12, `docs/design/REQ-045-journal-words.md` | JR-07 (`pixel-office-docs.test.js`) + команды | фразы нет |
| 1, 2, 6 | подстановка роли и источника — без особых шаблонов `replace`; `repeatedStarts` = прямое определение на 300 случайных журналах | 3.2, D3, D12 | JR-08 (`pixel-office-panels.test.js`) | мутант `replace` или учёт пометок в «повторном» |

### 9.3 REQ-044

| Кр. | Что | Элемент | Тест (файл) | Падает, если |
|---|---|---|---|---|
| 1 | для каждой клетки каждого стола (блок 2 × 2 и место) на журнале из трёх ролей и основной сессии `hitOffice` → ключ роли стола; клетка пола между столами и клетка подхода → null; персонаж роли в пути — клетка его стола всё равно его ключ; B на клетке подхода к столу A: точка в попадании B и в клетке стола A → B, точка в клетке стола A вне попадания B → A; подпись сидящего персонажа (ширина из `labelWidths` поддельного `measureText`) → его ключ, точка на 1 px правее края подписи и вне стола → null; подпись идущего B поверх клетки стола A → B; NaN → null | 3.6 | AC-01 (`pixel-office-office.test.js`) | стол не попадает, персонаж не старше, подпись не та |
| 1 | нажатие на середину стола роли с двумя экземплярами (A1 «в работе», начат раньше; A2 «закончила…», позже) → карточка A1 (его 8 знаков); нажатие на персонажа — та же; стол основной сессии → прежняя карточка «идущих сессий: N»; заголовок — `roleName` | 3.7 `defaultInstance`, 3.8 | AC-02 (`pixel-office-page.test.js`) | открыт не тот экземпляр |
| 2 | keydown Enter и Space на кнопке легенды (активация помощника) → карточка роли; Escape → `activeElement` — кнопка легенды этой роли; то же после открытия нажатием на холст; Tab и Shift+Tab ходят по кругу по списку 6.3 (из «×» назад — последний элемент; закрытый `details` пропускает содержимое); после перехода по связи к роли B и Escape — фокус на кнопке легенды B; у `summary`, `.instance`, `.copy` есть правило `:focus-visible` с `outline` (CSS); кнопки легенды нет — фокус на `#office-scroll` | 3.8, 6.3 | AC-03 (`pixel-office-page.test.js`); браузер — шаг 6 приёмки | фокус ушёл под затемнение или потерян |
| 3 | шапка: роль из таблицы, вне таблицы, без роли — тексты; `card-code` только при отличии; `agent_id` 128 знаков: в шапке 8, в раскрытии 128; поддельный буфер: удача — `writeText` ровно 1 раз с полным значением, `COPY_OK`; нет буфера, отказ, бросок — `COPY_FAIL`, значение видно, исключения нет; надпись держится после пересборки; роль с 7 экземплярами — 5 пунктов, `SHOWN_NOTE` «показано 5 из 7», остальные 2 в «Остальных экземплярах»; у пунктов «в работе» и «нет свежих данных» есть возраст, у закончившей — нет; выбор второго — шапка и строки второго, `aria-current` на нём | 3.7, 6.1, 6.4 | AC-04 (`pixel-office-page.test.js`) | не тот текст, лишний вызов `writeText`, исключение |
| 4 | поддельные часы; по экземпляру в каждом из пяти состояний — плашка = `STATE_LABELS`, основание по 4.3; экземпляр «в работе», начатый 3 ч назад, при доверенной строке сессии 5 мин назад — время этой строки и «5 мин назад»; повторное начало — «продолжил работу» со временем второго; «нет свежих данных» при другом экземпляре роли «в работе» — «Задача: нет свежих данных», «Рабочее место: работает» (строки разные); роль без задач «в работе» — `WORKPLACE_IDLE`; шаблоны — константы `texts.js`, `WORKPLACE_*` начинаются со слов легенды; `restarted` — время самого раннего запуска после последнего начала (D11) | 3.7, 4.3 | AC-05 (`pixel-office-panels.test.js`) | основание по началу, а не по сессии; строки совпали |
| 5 | порядок переднего плана (Start, Stop, PostToolUse) — последнее событие агента SubagentStop, «Задание передано» — 1 пункт с `GIVEN_NOTE`, «закончила…»; два Start и два Stop — «получил…» и «продолжил работу», два возврата; без PostToolUse, PostToolUse без описания, два PostToolUse разных `tool_use_id`, два одного `tool_use_id` (одна передача); помеченная строка с тем же `agent_id` ничего не меняет (кроме вида начала по правилу D3: случай «первое начало `REAL` помечено конфликтом» — слова как в журнале, общий с JR-02 сценарий); обе фразы незнания и пояснение — константы; на 300 случайных журналах итог «Текущей задачи» и «Кто запустил» совпадает с `task.description`/`task.launched_by` модели | 3.7 | AC-06 (`pixel-office-panels.test.js`) | список расходится с правилом z |
| 6 | цепочка «основная сессия → A → B»: у B «кто запустил» — A (кнопка), у A «кого запустил» — B, у A «кто запустил» — «Основная сессия» без кнопки; PostToolUse той же сессии в ту же секунду с другим `launched_agent_id` не связывает; `launched_agent_id` без задачи — пункт без кнопки; кнопка B в карточке A открывает карточку B (фокус «×») | 3.7, 3.8 `openInstance("link")` | AC-07 (`pixel-office-panels.test.js`); мутант «по ближайшему времени» — TEST-DESIGN-VALIDATOR | связь по времени |
| 7 | элементы «сразу» (шапка, три строки, «Текущая задача», «Кто запустил») не внутри закрытого `details`; все раскрытия закрыты при открытии; раскрытие открыто, фокус на кнопке в нём, плановый пересчёт с новой строкой → раскрытие открыто, экземпляр тот же, `activeElement` — элемент с тем же `data-focus`, прокрутка тела та же; в «Вся роль» у задачи «нет свежих данных» есть возраст; `grep -n 'CARD_WORKING' tools/src/pixel-office/public/app.js` — код 1 (и по всей `public/`); замеры 1470 × 784 и 375 × 812 — приёмка | 6.1, 6.2 | AC-08 (`pixel-office-page.test.js`) + команда; DESIGN-QA-VALIDATOR | раскрытие сброшено, фокус потерян |
| 8 | случаи критерия по сценарию на каждый: без описания, без передачи, запущен агентом без начала, без роли, 128 знаков, пустой журнал, связь потеряна при открытой карточке (содержимое прежнее, `NO_CONNECTION` в шапке), экземпляр исчез (карточка закрыта), нечитаемое время — без исключений (`reportOnce` не вызван), без `undefined\|null\|NaN\|[[]object`, ожидаемые тексты — константы | 3.7, 7 | AC-09 (`pixel-office-page.test.js`) | исключение, служебное слово |
| 9 | роль, описание, `agent_id` `<img src=x onerror=alert(1)>` — буквально, `img` нет; `writeText` получает только значение; команды поиска слов успеха, `innerHTML…`, методов — пусто; контраст `.state-badge` по пяти парам и подписи `--muted` на `--panel`/`--panel-2` ≥ 4,5 : 1 по формуле WCAG на токенах `style.css` (как FS-20) | 3.11, 6.4 | AC-10 (`pixel-office-page.test.js`) + команды | элемент создан, контраст ниже |
| 10 | стенд по критерию (A — два экземпляра, C — семь, B запущен A1, SubagentStop без начала, разметка), шаги 1–8 буквально | всё | `docs/uat/REQ-044.md`, `-RUN.md` (шаг 8); RELEASE-VALIDATOR повторяет 1, 3, 5, 6, 7 | — |
| 11 | README `grep -c 'экземпляр'` ≥ 1; `node --test test/pixel-office-docs.test.js` — 0; замены — в `docs/design/REQ-044-instance-card.md`; числа по файлам не меньше метки; `npm run check` — 0, `skipped 0`, `todo 0` | 3.12, `docs/design/REQ-044-instance-card.md` | AC-11 (`pixel-office-docs.test.js`) + команды | фразы нет, тест ослаблен |

У каждого теста есть критерий: NM-01…NM-07, NM-09 — REQ-036 (NM-08 не используется), JR-01…JR-09 —
REQ-045, AC-01…AC-11 — REQ-044.

## 10. Прежняя проверка → новая (критерии 9 REQ-036, 9 REQ-045, 11 REQ-044; AP-005)

Здесь — полные пары «было → стало» для всех трёх требований: критерий 9 (б) REQ-036 сверяет каждую
удалённую или изменённую строку с `test(` во всём прогоне именно с таблицей в `docs/design/REQ-036-*.md`
(решение ORCH по F6). Те же строки для REQ-045 и REQ-044 лежат и под шаблонами их критериев —
`docs/design/REQ-045-journal-words.md` и `docs/design/REQ-044-instance-card.md` — **дословно
одинаково** (10.2, 10.3 — копии; согласованность проверяют ворота; правка — сразу в обоих местах).
Прежние тесты не удаляются и не слабеют: ожидание меняется на не менее строгое. Строки с `test(`, которые
меняются (заголовок стал неверен), названы явно.

### 10.0 Указатель всех заменённых тестов прогона

| Прежний тест | Требование | Пара «было → стало» | Заголовок `test(` |
|---|---|---|---|
| PN-02, PN-09, FS-08, FS-14, FS-17 | REQ-036 | 10.1 | прежние |
| PN-06, PN-22, PG-27; помощник `openWindow` и щелчки по строке в PN-20, FS-11 (:2581), PG-24, PG-25, PG-27b, PG-28 | REQ-045 | 10.2 и `docs/design/REQ-045-journal-words.md` | прежние |
| PN-19, PN-21, PG-26 | REQ-045 | 10.2 и `docs/design/REQ-045-journal-words.md` | меняются (названо в строке) |
| PN-14, OF-40 | REQ-044 | 10.3 и `docs/design/REQ-044-instance-card.md` | прежние |
| OF-10, OF-23 | REQ-044 | 10.3 и `docs/design/REQ-044-instance-card.md` | меняются (названо в строке) |

Этот список совпадает с ожидаемыми провалами подшагов 2a–2c (п. 8.1): 20 тестов.

### 10.1 Замены по REQ-036

| Прежний тест (файл, строки) | Что было | Новая проверка (не слабее) | Заголовок `test(` |
|---|---|---|---|
| PN-02 (`pixel-office-panels.test.js` :186, :188) | «Сейчас: ORCH — check it», `title` тот же | «Сейчас: Оркестратор — check it»: одна `.now-row` с этим текстом без «Сейчас: », `title` = `#now-text` | прежний |
| PN-02 (:192) | «Сейчас: Explore · и ещё 1 в работе» | две `.now-row` в порядке «Текущих»: «Explore», «Оркестратор — check it»; «и ещё» нет | прежний |
| PN-02 (:200) | «Сейчас: Основная сессия — обрабатывает запрос» | то же значение `#now-text` и одна строка `data-kind="main"` | прежний |
| PN-02 (:205–206) | начинается с «Сейчас: Explore», кончается « · и ещё 2 в работе» | три строки по правилу d (новые сверху): «Explore», «Plan», `MAIN_ROW`; «и ещё» нет; при отказе связи строки и `#now-text` прежние | прежний |
| PN-09 (:548) | `.item-role` «ORCH» | «Оркестратор»; плюс у того же агента в «Текущих» до SubagentStop — тот же текст | прежний |
| FS-08 (:1772) | «Сейчас: Explore · и ещё 1 в работе» | две строки «Explore» и `MAIN_ROW` в порядке «Текущих» | прежний |
| FS-14 (:2273) | «Сейчас: general-purpose · и ещё 2 в работе» | три строки в порядке «Текущих» (`sample-a3`, `sample-a2`, `main:5`), «Explore» среди них нет | прежний |
| FS-17 (:2427, :2434) | начинается «Сейчас: Explore»; `title` = `#now-text` | то же при одной строке; если строк больше — `title` = `NOW_PREFIX` + строки через перевод строки | прежний |
| пробный набор `SAMPLE_CSS` PN-23 | — | без изменений: новые правила не трогают `.item-head`/`.item-state` | прежний |

### 10.2 Замены по REQ-045 (дословно как в `docs/design/REQ-045-journal-words.md`)

| Прежний тест (файл, строки) | Что было | Новая проверка (не слабее) | Заголовок `test(` |
|---|---|---|---|
| PN-06 (`pixel-office-panels.test.js` :396, :399, :402) | `EVENT_LABELS.SessionStart/PostToolUse/SubagentStart` | литералы «Сессия Claude Code открыта», «Задание передано агенту «Explore»», «Агент «Explore» получил задание и начал работу» | прежний |
| PN-06 (:398) | «кто» строки PostToolUse — «Explore» | «Основная сессия» (передавший); роль — в словах | прежний |
| PN-19 (:1172–1210, :1215–1222) | строка запроса — `tabindex`, последний ребёнок `SPAN.history-open`, нет управляющих внутри; простые строки без `tabindex`; щелчок по строке открывает окно | строка запроса: `BUTTON.row-toggle` и `BUTTON.history-open[data-request]`, ровно два управляющих; простые строки — ровно одна `.row-toggle`, без `.history-open`; щелчок `.row-toggle` окна не открывает (открывает раскрытие), `.history-open` — открывает своё окно; часть про карточку агента — прежняя (окна нет, `history-open` в карточке 0) | меняется: «from the button of a row of the journal …» |
| PN-21 (:1445–1483, :1566–1572) | Enter и Space на строке открывают окно, фокус возвращается на строку | Enter и Space на `.history-open` открывают окно (активация помощника), фокус возвращается на кнопку; на `.row-toggle` Enter окна не открывает; остальное прежнее | меняется: «… open from the button of the row …» |
| PN-22 (:1659, :1662) | `.row.opens-history:focus-visible` — смещение внутрь; `.row.opens-history` — `cursor: pointer` | `.row-toggle:focus-visible` — `outline-offset: -0.125rem`; `.row-toggle` — `cursor: pointer`; `.history-open:focus-visible` есть кольцо | прежний |
| PG-26 (`pixel-office-page.test.js` :1460–1478) | после записи страница та же, число строк журнала прежнее | задачи, легенда, `#now`, персонажи — те же; строк журнала на одну больше, новая — «Оркестратор записал, как понял запрос» на месте записи; проверки модели (`m2.journal.length`) — прежние | меняется: «… the panels and the characters stay as they were, the journal gets the row of the record» |
| PG-27 (:1502–1508) | хронология: `EVENT_LABELS.*`, служебное — `HISTORY_SERVICE` | литералы случаев 3, 10 («Задание передано агенту «Plan»»), 7, 9, 4; запись — `HISTORY_NOTE_BY` | прежний |
| `openWindow` (`pixel-office-page.test.js` ~:1236) и все щелчки по строке запроса: `historyRowOf(...).click()`, `opener.click()` — в PN-20 (`pixel-office-panels.test.js` :1334), FS-11 «… opened from a row of the main session …» (:2616–2617), PG-24 (`pixel-office-page.test.js` :1254), PG-25, PG-27b (:1687), PG-28 (:1795) | щелчок по строке открывает окно | щелчок по `.history-open` этой строки; остальные проверки этих тестов прежние | прежние (меняется помощник и строка вызова) |

### 10.3 Замены по REQ-044 (дословно как в `docs/design/REQ-044-instance-card.md`)

| Прежний тест (файл, строки) | Что было | Новая проверка (не слабее) | Заголовок `test(` |
|---|---|---|---|
| PN-14 (`pixel-office-panels.test.js` :872, :902) | `.card-working` «в работе: 1», «в работе: 0» | `div.state-row[data-row="workplace"]`: `WORKPLACE_WORKING` с 1, затем `WORKPLACE_IDLE`; `.card-working` в карточке экземпляра нет | прежний |
| OF-10 (`pixel-office-office.test.js` :661, :685, импорт `CARD_WORKING`) | заголовок — полное `agent_type`; «в работе: 2» | заголовок «Оркестратор», `.card-code` — «Sai Orchestrator (ORCH)»; строка «Рабочее место» — `WORKPLACE_WORKING` с 2; данные `buildCard` (первая часть теста) — прежние | меняется: «… the title is the name of the role in plain words, the code beside it …» |
| OF-23 (:1325–1341) | карточка роли — «в работе: M» | карточка основной сессии — `CARD_SESSIONS` 2 (прежнее); карточка роли — без `.card-working`, «Рабочее место» с числом 1 | меняется: «… the card of an instance has no 'в работе: M', its workplace row names the number» |
| OF-40 (:2547) | заголовок = `character.full` | заголовок = `roleName(character.full)`, `.card-code` = `character.full` при отличии | прежний |

Остальные тесты, читающие `#now-text`, карточку или журнал (PN-15, PN-16, PN-17, PN-18, FS-01, FS-11,
FS-13, OF-11, OF-20, OF-37, PG-21, PG-23), по разбору остаются верными без правки; если какой-то
покраснеет — это либо отступление кода от проекта, либо пропуск таблиц: TEST-DESIGNER добавляет
строку (в файл требования и в указатель 10.0) через вопрос к CODE-DESIGNER, а не правит тест молча.

## 11. Ловушки для TEST-DESIGNER (мутанты, шаг 5; проверяет TEST-DESIGN-VALIDATOR)

1. `roleName` берёт код из скобок у любой роли (без `Sai `) — NM-01 краснеет на «Demo Reviewer (REVIEWER)».
2. `roleName` режет до 16 знаков или возвращает `roleLabel` — NM-01, NM-03.
3. `nowLine` снова отдаёт только первый элемент или добавляет «и ещё» — NM-02.
4. Порядок строк «Сейчас» — по времени начала, а не по `model.list` — NM-02.
5. `-webkit-line-clamp` или `text-overflow` возвращены в `@media (max-width: 599px)` — NM-03.
6. «Повторное» начало считается по доверенным строкам (с пометками) или по любому источнику — JR-02.
6а. Карточка определяет вид начала по `model.trusted` / `first_start_index`, а не по `repeatedStarts` — JR-02 (общий случай), AC-06.
7. Роль `{role}` у PostToolUse берётся из задачи запущенного, а не из `subagent_type` строки — JR-02 (слова меняются после SubagentStart).
8. Подстановка через `String.replace` со строкой — JR-05/JR-08 (роль `$&`).
9. Запись оркестратора входит в «Работа» или меняет задачи — JR-04.
10. `prompt_text` попадает в «Технические поля» — JR-03.
11. «Задача» PostToolUse — задача передавшего — JR-03.
12. `hitOffice` проверяет стол раньше персонажа или считает клетку подхода столом — AC-01.
13. Подпись не входит в попадание или входит с шириной 130 всегда — AC-01.
14. Экземпляр по умолчанию — последний или по времени начала — AC-02.
15. Фокус после закрытия — `openerKey` (только легенда) — AC-03.
16. Tab не удерживается в карточке или заходит в закрытый `details` — AC-03.
17. `writeText` вызван дважды или с 8 знаками — AC-04.
18. Основание «в работе» — время начала, а не последнего события сессии — AC-05.
19. Строки «Задание передано» входят в последнее событие агента — AC-06.
20. Связь по ближайшему времени или по совпадению сессии — AC-07.
21. Плановая пересборка сбрасывает раскрытия, фокус или прокрутку тела — AC-08, JR-03.
22. `.state-badge` «окончание не записано» цветом `--err` — AC-10 (контраст < 4,5).
23. Новая строка с `px` или новый `@media` — SC-03, SC-05 (прежние, без правки).
24. Маскирование описания и ролей убрано в хуке (`buildWriteBody`) — MK-01, NM-06.
25. Маскирование убрано на сервере (`validateWriteBody`) — MK-02 (тело в обход хука).
26. Маскирование применено не к тому полю (например, к `agent_id` вместо `agent_type` или только к `description`) — MK-01, MK-05.
27. Обрезка до маскирования или отказ вместо обрезки после него — MK-03.

## 12. Что устаревает вне этого проекта (О2: пишет DOC-UPDATER до шага 9)

Перечень проверен поиском (доработка r2, F3): `grep -rn
"EVENT_LABELS\|NOW_MORE\|CARD_WORKING\|и ещё [N0-9{]\|субагент запущен\|субагент закончил\|вызов субагента\|сессия
началась\|сессия закончилась\|запрос отправлен\|ответ закончен\|в работе: N\|в работе: M" docs/design/ docs/uat/
tools/README.md`, а также `roleLabel` в описаниях строки «Сейчас» и панели и «многоточием» у «Сейчас». REQ-036
поручал правку `REQ-007-office-ui.md` CODE-DESIGNER «в составе проекта»; ORCH передал её DOC-UPDATER
отдельным handoff-ом до шага 9 (критерий 9 (в) REQ-036 требует, чтобы поиск `· и ещё\|NOW_MORE` по
`REQ-007-office-ui.md` был пуст к шагу 9).

### 12.1 Правятся (действующие описания требований, ещё не `done`)

| Файл, строки | Что сейчас | Новый текст (смысл) |
|---|---|---|
| `docs/design/REQ-007-office-ui.md` 319–323 | «текст в одну строку … обрезается многоточием» | блок «Сейчас» — подпись «Сейчас:» и список строк, по строке на каждый элемент «в работе», с переносом, без многоточия; лишние — прокруткой внутри блока; вид — `docs/design/REQ-036-044-045-ui.md`, п. 2 |
| там же, 327–331, 334–340 | таблица «короткая подпись роли», « · и ещё N в работе», `roleLabel` | строка «<название роли простыми словами> — <описание>», без описания — название, основная сессия — `MAIN_ROW`; пусто — «Сейчас: в работе ничего нет»; названия — `ROLE_NAMES` (`texts.js`), роль вне таблицы — как пришла |
| там же, 830–832, 850 | старые слова журнала (`EVENT_LABELS`) | слова — таблица `EVENT_TABLE` (REQ-045), ссылка на этот проект, п. 3.1; пример строки — новыми словами |
| там же, 923 | подпись роли элемента — «короткая подпись роли (как у персонажа)» | название простыми словами (REQ-036), не `roleLabel` |
| там же, 966–972 | карточка роли, «в работе: N», фокус возвращается «на то, чем открыли» | карточка экземпляра (REQ-044), разделы роли — раскрытие «Вся роль», «в работе: N» нет, фокус после закрытия — на кнопке легенды роли и после нажатия на холст |
| там же, 1000 | «Сейчас» обрезается многоточием, весь текст — в подсказке | «Сейчас» — строки с переносом и прокруткой внутри блока; в подсказке — все строки |
| там же, 1010 | «Сейчас» … до двух строк, дальше многоточие | во всю ширину, список строк с прокруткой, без многоточия |
| там же, 1174 | «Сейчас:» и первый элемент «Текущих» | «Сейчас:» и строки агентов |
| `docs/design/REQ-008-history.md` 529–530 | `what`: `EVENT_LABELS[вид]`, служебное — `HISTORY_SERVICE` | слова `EVENT_TABLE` (служебное — случай 4); запись ORCH — `HISTORY_NOTE_BY` (без изменений) |
| там же, 555 | строка запроса — сам `li` с `tabindex`, `span.history-open` «не кнопка», открывает щелчок и Enter по строке; служебное — `span` с `HISTORY_SERVICE` в строке | строка — `button.row-toggle` (раскрытие события), окно открывает отдельная `button.history-open[data-request]`; служебное — метка `HISTORY_SERVICE` внутри `.row-toggle` (п. 5.1 проекта) |
| `docs/design/REQ-008-history-view.md` 180–181 | <что> — старые слова (`EVENT_LABELS`) | слова `EVENT_TABLE` |
| там же, 252 | «существующие, используются как есть: … `EVENT_LABELS` …» | `EVENT_TABLE` вместо `EVENT_LABELS` |
| `docs/design/REQ-001-pixel-office.md` 1885 | `span.card-working` у роли — `CARD_WORKING` | у карточки экземпляра строки нет; у основной сессии — `CARD_SESSIONS` (прежнее) |
| там же, 1903 | `NOW_MORE` | константы нет (REQ-036) |
| там же, 1920 | `EVENT_LABELS` — старые слова | `EVENT_TABLE` (REQ-045) |
| там же, 1930 | `CARD_WORKING`, `CARD_SESSIONS` | только `CARD_SESSIONS` |
| там же, 1939 | « · и ещё N в работе» среди выбранных надписей | надпись снята REQ-036 |
| там же, 1994–1995, 1999–2000 | текст «Сейчас» через `roleLabel` и `NOW_MORE` | строки агентов, `roleName` (REQ-036) |
| там же, 2016–2020 | `who` строки — `subagent_type` у PostToolUse; `event` — `EVENT_LABELS` | `who` — передавший; слова — `EVENT_TABLE` (REQ-045) |
| там же, 3693, 3715, 3719 | описания принятых OF-23, PN-02, PN-06 | описания по разделу 10 (пары «было → стало») |

### 12.2 Не правятся (история законченных прогонов)

`docs/design/REQ-042-state-honesty.md` 379, 611–612 и `docs/uat/REQ-042-RUN.md` 93 описывают решения и
приёмку прогона REQ-042 (требование `done`) на его время; переписывание истории запрещено (quality-bar §6,
п. 8). Упоминания «и ещё N» в `docs/design/REQ-011-*.md`, `docs/uat/REQ-011.md` относятся к странице Sai Team
(другая страница), этой работы не касаются.

## 13. Раздел о планке (Q1–Q14, R1–R3)

| Пункт | Применим? | Как выполняется |
|---|---|---|
| Q1 | применим | изменение привязано к REQ-036, REQ-045, REQ-044; у каждого критерия способ проверки (раздел 9) |
| Q2 | применим | проект проверяет CODE-DESIGN-VALIDATOR; код — SECURITY-REVIEWER и REVIEWER; тесты — TEST-DESIGN-VALIDATOR; приёмка — UAT-RUNNER и RELEASE-VALIDATOR своими запусками; утверждения о коде этого проекта (раздел 1) даны с командами для повтора |
| Q3 | применим | факты раздела 1 — с командами и выводом пробы; «работает» о новом коде здесь не утверждается |
| Q4 | применим | одна команда `cd tools && npm run check`; новые модули попадают в `format:check`, `lint` (весь каталог) и `test` (`test/**/*.test.js`) без правки команды |
| Q5 | применим | раздел 9: у каждого критерия тест, у каждого теста критерий; тесты отказа проверяют неизменность (раздел 7, «что не меняется»; JR-04, AC-09) |
| Q6 | применим | между шагами 2 и 5 краснеют только 20 тестов изменённого поведения, все файлы тестов загружаются (устаревшие экспорты удаляются на шаге 5c, п. 8.1–8.2, прототип); прежние тесты заменяются по таблицам «прежняя → новая» (10.1, `docs/design/REQ-044-instance-card.md`, `docs/design/REQ-045-journal-words.md`), не удаляются; SC-03, SC-05, PN-23, FS-01, FS-04, PG-20 не меняются — проект подстроен под них (D6, D7); `skip` нет |
| Q7 | применим | секретов в странице нет; всё выводится `textContent`; маскирование «[скрыто]» при записи до r3 было только у `prompt_text` и записи оркестратора (ф25) — дополнение r3 (D14, п. 3.13) маскирует описание и роли в хуке и на сервере одной функцией `maskSecrets`; NM-06 и MK-01…MK-05 проверяют путь хук → сервер → страница; уже записанные строки не переписываются (О16); буфер обмена получает только идентификатор (не секрет); `prompt_text` не выводится в журнале и технических полях |
| Q8 | неприменим | данных клиентов и пространств бизнеса нет: Pixel Office — служебный инструмент (`decisions/0003`) |
| Q9 | неприменим | SQL нет |
| Q10 | применим | внешних сервисов нет (страница ходит только на свой сервер); реалистичные плохие условия — раздел 7 и тесты JR-06, AC-09, NM-05: страница не падает, текст понятный |
| Q11 | неприменим | адресов, которые задаёт пользователь и по которым ходит сервер, нет; сервер не меняется |
| Q12 | применим | выборы раздела 2 записаны здесь; спорные: D2, D3 — `decisions/0055` (уточнение формулировки п. 2 — раздел 14, О4), D6, D9, D10 — решения ORCH в `orch_check` шага 1b; D14 (маскирование описания и ролей в двух линиях, порядок «маскировать, потом резать», без маскирования идентификаторов) — выбор этого проекта по образцу `prompt_text` (`decisions/0013` — правила маскирования, не меняются); предложение записи — О18; с `decisions/0013`, `0014` (5, 6), `0053`, `0052`, `0051`, `0054`, `0011` (а) проект не расходится |
| Q13 | применим | найденное о процессе — в `result.issues` (устаревшие числа в критерии 9 (б) REQ-036, неточности REQ-044, имена файлов проекта, `write_set` без `REQ-007-office-ui.md`); запись в `docs/anti-patterns.md` — по решению ORCH |
| Q14 | применим | handoff этого шага закрывается в той же работе; статусы требований и `STATE.md` — DOC-UPDATER на шаге 10 |
| R1 | применим | мерж — только с подтверждения владельца (RELEASE-FINALIZER, шаг 11); проект мерж не трогает |
| R2 | применим | каждая строка «Сейчас», журнала, раскрытия и карточки выводится из строк журнала, записей запуска сервера, часов страницы и констант `texts.js`; связи — только по равенству идентификаторов; о компьютере, сообщениях между агентами, ошибках и ожидании — «не записывает», «не сообщает»; название роли — перевод кода по таблице, а не новое событие; чужая роль не выдаётся за роль Sai (D2); поддельная строка не меняет слов настоящей (D3); событий Pixel Office этот проект не пишет и не выдумывает; маскирование (D14) не отбрасывает событие — поле обрезается до предела схемы, идентификаторы не маскируются, поэтому задачи и связи остаются верными; «[скрыто]» — честная метка на месте секрета, а не выдуманный текст; приёмка — только на стенде с вымышленными данными |
| R3 | неприменим | продукт с фото снят решением `decisions/0033` |

## 14. Открытые вопросы и предложения записей

Состояние на доработку r2 (2026-10-14, 13:50Z): вопросы О1–О6, О8 решены ORCH; О13, О14 добавлены в r2 (решения ORCH по
F2 и по описанию интерфейса). Источники решений —
`context.orch_check` в `handoffs/REQ044-20261014-01/step-01b-code-designer.json` (13:23:31Z) и
`handoffs/REQ044-20261014-01/step-01c-code-design-validator.json` (13:38:21Z);
`decisions/0055-pixel-office-sai-role-and-repeat-start.md`. Ниже — что решено и что осталось.

1. **О1 — имена файлов проекта — решено (доработка r1).** Таблицы «прежняя → новая» вынесены под
   шаблоны критериев: REQ-044 — `docs/design/REQ-044-instance-card.md`, REQ-045 —
   `docs/design/REQ-045-journal-words.md`; по решению ORCH по F6 (доработка r2) полные пары всех трёх требований есть и здесь, в разделе 10 (10.1–10.3), дословно как в тех файлах.
2. **О2 — `docs/design/REQ-007-office-ui.md` и `REQ-008-history.md` — решено ORCH:** правка — отдельным
   handoff-ом DOC-UPDATER до шага 9 (раздел 8); тексты замены — раздел 12.
3. **О3 — решено, `decisions/0055`, п. 1:** `roleName` узнаёт только форму `Sai … (КОД)` (D2).
4. **О4 — решено, `decisions/0055`, п. 2, и решение ORCH по F2 (ворота шага 1b):** «повторное начало» — по
   более ранней строке начала того же агента с источником `REAL`; пометки по времени не учитываются; одно
   правило для журнала, карточки и хронологии (D3, `repeatedStarts`).
5. **О5 — решено ORCH (тексты из REQ-046 приняты):** «Задача» записи оркестратора — строка основной сессии
   её запроса, если запись привязана, иначе «к задаче не относится» (D9).
6. **О6 — решено ORCH:** у PostToolUse без задачи — `TASK_NOT_FOUND` «задача не найдена: её начало не
   записано» (D10).
7. **О7 — неточности REQ-044 для WF-01 после прогона (уточнение ORCH (2)):** «правило 3 REQ-008» — это
   `docs/design/REQ-008-history.md`, п. 7.3; проверка `CARD_WORKING` только по `app.js` — проект убирает
   имя из всей `public/`, проверять надо по папке.
8. **О8 — порог двух колонок — решено ORCH:** принят порог ≈ 874 px сетки `auto-fit` (D6, расчёт — в
   обновлённом описании интерфейса) вместо 960 px: принятый SC-05 требует ровно два условия `@media`.
9. **О9 — устаревшие числа критерия 9 (б) REQ-036** («23 теста, 390 проверок» в
   `pixel-office-panels.test.js`): на метке 37 и 640 (ф21). Проверка «не меньше метки» от этого не
   слабеет; текст критерия — WF-01 после прогона.
10. **О10 — «Оркестратор»** — и название роли `ORCH` (пример требования), и «кто» записи оркестратора;
    различаются словами второй линии. Если владелец хочет различать по «кто» — правка в WF-01.
11. **О11 — окно «Просмотр истории»**: столбец «Агент» и «кто» хронологии остаются сырым `agent_type`
    (REQ-036 их не называет); единообразие — кандидат в REQ-047.
12. **О12 — карточка основной сессии** меняет только рамку (тело с прокруткой) и возврат фокуса на кнопку
    легенды «Основная сессия» (описание, I5); содержание прежнее.
13. **О13 — критерий 5 REQ-044 для WF-01 после прогона (решение ORCH по F2).** Критерий буквально:
    «Начала: каждая строка SubagentStart с этим agent_id (первая — «получил задание и начал работу»,
    следующие — «продолжил работу»)» и «помеченная строка … не меняет ни последнего события, ни списков».
    По D3 и `decisions/0055`, п. 2, если первая строка начала `REAL` помечена конфликтом времени, в списке
    «Начала работы» её нет (недоверенная), а первая показанная — «продолжил работу» (как эта же строка в
    журнале). Текст критерия расходится в этом крайнем случае; проект держит одно правило, тесты JR-02 и
    AC-06 проверяют именно его. Предложение для WF-01: «первая — по правилу `decisions/0055`, п. 2».
14. **О14 — подсказка блока «Сейчас»** (`title`): верен проект (п. 3.3 — `NOW_PREFIX` + строки через
    перевод строки); описание интерфейса пока даёт её без «Сейчас: » — решение ORCH, здесь ничего не
    меняется.
15. **О15 — ISS-0058 шире, чем записано** (дополнение r3). После D14 правило M7 прячет и имена файлов из трёх
    частей в описаниях задач («pixel-office-panels.test.js» → «[скрыто]»), M10 — длинные роли из букв и цифр.
    Секрет не утекает, но описание теряет смысл. Предложение ORCH: дописать это в ISS-0058 и поднять его
    приоритет; правила M7 и M10 здесь не меняются.
16. **О16 — строки, записанные до шага 5c**, не переписываются (журнал только дописывается): описание с
    секретом, если такое уже есть в журнале владельца, будет показано как есть. Маскирование на странице
    невозможно без переноса `mask.js` в `public/` (третья линия) — не предлагается без решения ORCH;
    проверка журнала владельца — только командами счёта, без вывода текстов (`decisions/0054`, дополнение 2).
17. **О17 — фразы «чего журнал не знает»** (находка ревью F3): в перечень «сразу» критерия 7 REQ-044 они не
    входят, но проект на шаге 5c уменьшает промежуток над ними, чтобы в худшем случае они были видны;
    описание интерфейса п. 7.5 (промежуток 0,75 rem) приводит GUI-DESIGN-ANALYST — решение ORCH.
18. **О18 — предложение записи в `decisions/`:** секреты маскируются во всех текстовых полях строки журнала,
    кроме идентификаторов, в двух линиях (хук и сервер), «маскировать, потом резать до предела схемы».
19. **О19 — описание REQ-036 для WF-01 после прогона:** фраза «секрет, попавший в описание, уже заменён
    «[скрыто]» при записи (hook.js, mask.js)» была неверна до шага 5c (ф25); после него верна для новых строк.
