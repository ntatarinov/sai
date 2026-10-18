# REQ-050, REQ-051, REQ-052, REQ-053 — проект кода: справка «Как пользоваться», разделы о команде, приглашение и тур, подсказки «?» и пустые состояния

Прогон `REQ050-20261017-01`, WF-02, шаг 1 (handoff `step-01b-code-designer.json`). Автор — CODE-DESIGNER, 2026-10-17
(по часам `date -u`: начало 13:38Z, запись 13:56Z). Проверяет — CODE-DESIGN-VALIDATOR. Метка базы —
`base/REQ050-20261017-01` (= `HEAD` 080862b; `git diff --stat base/REQ050-20261017-01 -- tools/` пусто). Описание
интерфейса — `docs/design/REQ-050-053-guide-ui.md` (дальше — «описание», «п. О-3.2»). Порядок постройки — REQ-050,
REQ-051, REQ-052, REQ-053 (`decisions/0061`, п. 1). Кода реализации нет: формы, сигнатуры, правила, таблицы.

Доработка r2 (handoff `step-01b-code-designer-r2.json`, 2026-10-17, по часам `date -u`: начало 18:18Z, запись 18:35Z) — по
правкам требований после приёмки и пяти читателей (`step-01e-req-analyst-r2.json`, `-r3.json`, ворота
`step-01f-req-validator-r3.json` PASS), диагнозу Ф2 (`step-08d-issue-fixer.json`) и находке 768 × 1024 — раздел 13;
затронутые места разделов 2, 3, 7–12 помечены «r2». Основа доработки — текущее рабочее дерево (код прогона), не метка.
Доработка r3 (handoff `step-01b-code-designer-r3.json`, 2026-10-17, начало 18:54Z) — по FAIL ворот
`step-01c-code-design-validator-r1.json`: F1 (D19, 13.3, раздел 8, 10, О7), F2 и N1 (D20, 13.4, ловушки 36а, 36б, 13.8),
N2 (О8, Q12), N3 (описание, п. О-5.5); места помечены «r3».

## 0. Кратко

1. **Новые модули страницы** (`tools/src/pixel-office/public/`): `guide-model.js` — чистый (разделы справки, проверка
   таблицы ролей, вид шага тура, порядок Escape, «внутри ли узел»); `guide.js` — справка (кнопка, полоса или лист,
   оглавление); `tour.js` — приглашение и тур, **единственный модуль, который трогает хранилище браузера**;
   `hints.js` — четыре подсказки «?». Пустые состояния — в `app.js`. Тексты — константы `texts.js`.
2. **Один порядок Escape** для всей страницы — чистая функция `escapeTarget`; её зовут и обработчик клавиш документа,
   и обработчик раскрытой строки журнала (D5).
3. **Справка ничего не перекрывает**: `aside#guide` без роли окна, `body[data-guide="open"]` сдвигает страницу правилом
   CSS; после открытия и закрытия холст пересчитывается (`fit`) — вопрос 4 описания (D7).
4. **Хранилище** — по `decisions/0061`, п. 3: `boot.js` передаёт `storageFn: () => window.localStorage` одной строкой,
   `tour.js` зовёт `storageFn`, `getItem`, `setItem` только с ключом `pixel-office-tour` и значением `closed`, каждый
   вызов — в `try`/`catch` (D9).
5. **Сервер, хук, `schema.js`, `model.js`, `panels.js` не меняются**; ни один экспорт не удаляется (`decisions/0059`,
   п. 1); новых зависимостей нет (`decisions/0002`).
6. Один FRONTEND-DEV, пять подшагов 2a–2e. Прототип на копии метки вне проекта: после 2a и 2b — **0** красных, после
   2c — **1** (PG-20), после 2d и 2e — **2** (PG-20, PN-09); с заменами раздела 8 — 0 красных, 399 тестов (раздел 6).
7. **r2** (раздел 13): описание роли под названием карточки, подписи «номер запуска» / «номер разговора», новые тексты
   Т1–Т4 и карточки, строка о туре после «Не сейчас» на 10 с, «×» тура 2,25 rem в узких окнах, подсказка не принимает
   касаний и открывается наведением только мыши, у края окна встаёт над кнопкой. Два подшага CODE-FIXER 2f, 2g; прототип —
   **17** красных после каждого (замены литералов, раздел 8, «Доработка r2»), с заменами — 433 из 433.

Файлы проекта и таблицы замен: этот файл — источник. Критерии 10 REQ-052 и 8 REQ-053 ищут таблицу замен в
`docs/design/REQ-052-*.md` и `docs/design/REQ-053-*.md`, а в `context.write_set` этого шага — только этот файл; копии раздела 8 —
`docs/design/REQ-052-guide-replacements.md` и `docs/design/REQ-053-guide-replacements.md` (`decisions/0061`, дополнение; О1 решён). Критерий 9 REQ-050 (`REQ-050-*.md`) и критерий 7 REQ-051 («или общий проект прогона»)
этот файл находят.

## 1. Проверенные факты о текущем коде

Все факты — на дереве метки (рабочее дерево `tools/` совпадает с меткой). Файлы — от `tools/`.

| № | Факт | Где | Чем проверено |
|---|---|---|---|
| ф1 | Гайда нет; хранилища нет; анимаций нет | `src/pixel-office/public/` | `grep -rn 'Как пользоваться\|localStorage\|scrollIntoView\|insertBefore' src/pixel-office/public/` — пусто; `grep -nE '(transition\|animation)[[:space:]]*:' src/pixel-office/public/style.css` — пусто |
| ф2 | Шапка: `h1`, `#link`, `#now` (`hidden` до первого ответа), `div.controls` с `#pause`, `#speed-1/2/4`; после `</header>` — `#now-all-catcher`, `#now-all` | `index.html` | чтение |
| ф3 | Окружение страницы — поля `env`: `document`, `fetchFn`, `nowFn`, таймеры, `requestFrameFn`, `AbortControllerCtor`, `viewportFn`, `addResizeListener`, `clipboardFn`; глобальные объекты окна читает только `boot.js` | `boot.js`; `app.js`, `createApp` 234–250 | чтение |
| ф4 | `setLink(state)` зовётся с `"live"` после первого согласованного ответа и с `"down"` при неудаче; начальное значение `link` — `"none"` | `app.js`, `setLink` 410, `requestCycle` 453 | чтение |
| ф5 | Клавиши: `onKey` — при окне истории Escape и круг Tab в окне; при карточке Escape и круг Tab в карточке; иначе Escape закрывает только список «Показать всех». Escape раскрытой строки — свой обработчик `keydown` на `li` строки: `preventDefault`, `stopPropagation`, сначала список «Показать всех», потом раскрытие | `app.js`, `onKey` 3108–3141, `journalPanelRow` 1024–1035 | чтение; тесты JR-03, VW-01 жмут Escape на `li` (`press(rowAt(...), "Escape")`), остальные — `doc.fire("keydown")` |
| ф6 | Холст пересчитывается (`fit`) после `rebuild`, при старте и на смену размера окна; открытие боковой полосы окно не меняет | `app.js`, `rebuild` 504, `start` 3305, `fit` 2991 | чтение (вопрос 4 описания) |
| ф7 | Пустой журнал — `li.journal-empty[data-reason="empty"]` со `span.empty-title` и `span.empty-hint`; фильтр без строк — `data-reason="filtered"`; до первого ответа при неудаче — `"no-connection"` | `app.js`, `journalNote` 1039 | чтение |
| ф8 | `p#office-note` показывается только при неподдержанном холсте (`CANVAS_UNSUPPORTED`), иначе скрыт и пуст | `app.js`, `decorate` 3228–3236 | чтение |
| ф9 | «Текущие» без элементов — `p.section-empty` с `NOW_EMPTY`; «История» и «Запуски сервера» — `NO_DATA`; `model.list` — задачи и строки основной сессии | `app.js`, `renderTasks` 1597; `model.js` 533–535 | чтение |
| ф10 | Поддельный DOM тестов: у `FakeElement` нет `contains`, `insertBefore`, `scrollIntoView`, `querySelector`; есть `appendChild`, `replaceChildren`, `parentNode`, `fire(type, event)` (без всплытия); `focus()` событий `focus` не шлёт; у `FakeDocument` — `getElementById`, `activeElement`, `addEventListener`, `fire`, тела `document.body` нет | `test/pixel-office-helpers.js` 698–1013 | чтение |
| ф11 | `makePage` не передаёт `storageFn` (только поля ф3) | `test/pixel-office-helpers.js`, `makePage` 1231 | чтение |
| ф12 | PG-20 запрещает во всех `.js`/`.html` `public/` `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` и др.; список «чистых» модулей — `texts.js`, `format.js`, `model.js`, `layout.js`, `office-model.js`, `office-sim.js`, `panels.js`, `office-view.js` | `test/pixel-office-page.test.js` 1063 | чтение |
| ф13 | SC-03: ровно 15 строк с `px` в `style.css`; SC-04: каждое `rem` кратно половине пикселя, `.now` `height` в широком `@media` — одна декларация; SC-05: ровно два `@media`; SC-06: `innerWidth`, `getComputedStyle`, `.style` — нигде, кроме `innerWidth` в `boot.js`; NM-07: у правил с селектором `.now…` `px` только в `border: 1px solid var(--…)`, высоты в `rem`; OF-41: `max-height` у `.legend` только в широком `@media` | `test/pixel-office-scale.test.js`, `test/pixel-office-office.test.js` 2602 | чтение |
| ф14 | Сервер отдаёт любой файл из корня `public/` с допустимым именем (`STATIC_NAME`), списка файлов нет — новые модули отдаются без правки сервера | `src/pixel-office/server.js` 65–121 | чтение |
| ф15 | Числа тестов на метке (`^test(` / `assert.`): docs 8/36, hook 44/244, layout 19/210, note 7/103, office 61/602, page 113/1199, panels 55/1016, scale 7/48, server 72/346, settings 7/25; `node --test "test/pixel-office-*.test.js"` на копии метки — `# tests 399 # pass 399` | — | `git show base/…:tools/test/<файл> \| grep -c …`; прогон на копии вне проекта |
| ф16 | Идентификаторы `GD-`, `GR-`, `TU-`, `HN-`, `DC-04` свободны; файлов `.claude/agents/` — 37, ключей `ROLE_NAMES` — 37 | — | `grep -rn '"GD-\|"GR-\|"TU-\|"HN-\|DC-04' tools/test/` — пусто; `ls .claude/agents \| wc -l` — 37 |
| ф17 | Фраз README критериев (`Как пользоваться`, `Роли команды`, `pixel-office-tour`, `Чтобы здесь появились события`) в разделе «## Pixel Office» нет | `tools/README.md` | `awk '/^## Pixel Office/{f=1;next} /^## /{f=0} f' README.md \| grep -c '…'` — 0 |
| ф18 | `#office-note` стоит между `#office-scroll` и `ul#legend`; `fit` вычитает из высоты холста всё между низом холста и верхом легенды | `index.html`; `app.js`, `fit` | чтение |

## 2. Решения проекта

| № | Решение | Почему |
|---|---|---|
| D1 | Четыре новых модуля (раздел 0, п. 1); всё, что можно посчитать без DOM, — в чистом `guide-model.js` (без DOM-вызовов, без часов, без Node) | тесты проверяют правила (порядок Escape, вид шага, таблицу ролей) без страницы; `app.js` уже 3346 строк |
| D2 | Все видимые тексты — константы `texts.js` (раздел 3.1); вложенные массивы и объекты заморожены на каждом уровне | критерии 4 REQ-050, 2 REQ-051, 2 REQ-052, 6 REQ-053 сравнивают с константами |
| D3 | Разметка в `index.html`: `button#guide-open` (с текстами), `div#tour-invite` (с текстом и двумя кнопками, `hidden`), `aside#guide` (пустой, `hidden`), `div#tour` (пустой, `hidden`), `div#office-hint` (пустой); содержимое справки строится при **первом** открытии и остаётся; подпись тура и кнопки «?» строятся один раз при старте | GD-01 разбирает `index.html`; ленивое содержимое справки не меняет текст страницы, который читают прежние тесты (прототип) |
| D4 | Кнопки «?» и их подсказки ставятся кодом: в `#now` — последним (после `.now-side`), в строке заголовка журнала — сразу после `h2#journal-title` (перестановкой детей строки через `replaceChildren`), в голове «Задач» — после `h2#tasks-title`, в `div#office-hint` | в поддельном DOM нет `insertBefore` (ф10); `.now-side` добавляется кодом, значит «?» после него — тоже кодом |
| D5 | Один порядок Escape — `escapeTarget(f)` (раздел 4.1); `onKey` (документ) и обработчик `keydown` раскрытой строки зовут одно `escapeStep(origin)`; обработчик строки по-прежнему делает `preventDefault` и `stopPropagation` | критерий 3 REQ-050; прежние тесты жмут Escape на `li` строки (ф5) — они проходят без правки (прототип) |
| D6 | «Фокус внутри X» — обход `parentNode` от `document.activeElement` (`within`), без `contains` | в поддельном DOM нет `contains` (ф10) |
| D7 | Открытая справка — атрибут `data-guide="open"` у `body` (элемент `pageBody()`, как `data-modal`) и `aria-expanded="true"` у `#guide-open`; после каждого открытия и закрытия — `guarded("холст", fit)` | раскладка — правилами CSS (D16 `decisions/0008`, PN-17); вопрос 4 описания |
| D8 | Откуда открыта справка — `{kind: "header"}` или `{kind: "empty"}`; элемент для возврата фокуса ищется в момент закрытия: `#guide-open` или текущая кнопка пустого журнала (если её уже нет — `#guide-open`) | журнал перестраивается (раз в 10 с и на событие): ссылка на старую кнопку теряет фокус |
| D9 | Хранилище — только в `tour.js`: `storageFn` вызывается при каждом обращении; ключ и значение — две константы модуля; плюс флаг в памяти «закрыто на этой странице» — без хранилища приглашение не возвращается до перезагрузки | `decisions/0061`, п. 3; критерий 1 REQ-052 |
| D10 | Приглашение предлагается **один раз за загрузку страницы** — когда `link` впервые уходит из `"none"` (первый ответ или первая неудача), если тур не открыт, на этой странице не закрывали и в хранилище не `closed` | критерий 1 REQ-052 («после первого ответа сервера или первой неудачной попытки связи»); ф4 |
| D11 | Вид шага тура — чистый `tourStepView(step, facts)`; подсветка — атрибут `data-tour-target` на постоянном элементе страницы (`#office-panel`, `#now`, родитель `ul#journal` — `section.panel-journal`, родитель `div#tasks` — `section.panel-tasks`, `#guide-open`); шаг пересчитывается при каждом `renderAll`; `scrollIntoView({block: "nearest"})` — только при показе шага и когда цель шага появилась, если функция есть | критерий 3 REQ-052; у секций журнала и «Задач» нет `id`, они — родители элементов с `id`; прокрутка при каждом опросе дёргала бы страницу (критерий 5 — тур не меняет прокрутку сам) |
| D12 | Кнопки тура — пять постоянных элементов (×, «Назад», «Пропустить», «Далее», «Закрыть тур»), видимость по шагу; место подписи — правила CSS по `#tour[data-step="N"]` | фокус «остаётся на нажатой кнопке» (критерий 4 REQ-052) — кнопка не пересоздаётся; без атрибута `style` |
| D13 | Подсказки: открыта не больше одной; события `mouseenter`, `mouseleave`, `focus`, `blur`, `click` на кнопке; нажатие вне закреплённой — слушатель `click` документа (цель вне кнопки и вне подсказки — закрыть, само нажатие идёт дальше); **r2:** `mouseenter`/`mouseleave` действуют только для мыши (D21), подсказка не принимает касаний и у края окна встаёт над кнопкой (D22, D23) | критерий 1 REQ-053; подсказка не модальна; Ф2 (раздел 13) |
| D14 | Пустые состояния — в `app.js`: шаги и кнопка в `journalNote("empty")`, `renderOfficeNote`, условие `TASKS_EMPTY` в `renderTasks` (`model.list.length === 0`) | критерии 3–5 REQ-053; `panels.js` не меняется |
| D15 | CSS: ни одной новой строки с `px`, ни одного нового `@media`, все `rem` кратны половине пикселя (линии — `0.0625rem`); переходов и анимаций нет (блока `prefers-reduced-motion` нет); правила полосы справки и мест подписи тура — внутри существующего широкого `@media`, лист и подпись у нижнего края — без `@media`; узкие поправки — внутри узкого `@media`; второй декларации `height` у `.now` в широком `@media` нет; `max-height` у `.legend` — только прежняя (широкий `@media`); правила `.legend-item`, `.card-link`, `.instance-id`, `.item`, `.item-head`, `.item-role`, `.item-state` не трогаются | ф13; описание, п. О-0.4 и О-11 (вопрос 7 описания); DQ-04, PN-23, OF-41 |
| D16 | `boot.js` — одна новая строка `storageFn: () => window.localStorage`; слово `localStorage` больше нигде, в том числе в комментариях | правило (а) TU-09 |
| D17 | Ни один экспорт не удаляется и не переименовывается; `panels.js`, `model.js`, `schema.js`, сервер, хук не меняются | `decisions/0059`, п. 1; задание шага |

## 3. Формы данных и функции по файлам

Пути — `tools/src/pixel-office/public/`. «Чистый» — без DOM-вызовов, без Node и без чтения часов.

### 3.1 `texts.js` — новые константы

Значения — дословно таблицы Т1 (REQ-050), Т2 (REQ-051), Т3 (REQ-052), Т4 (REQ-053) из `docs/requirements.yaml`; внешние
кавычки «…» в значение не входят. Прототип вынул тексты из файла требований скриптом и сверил литералы — расхождений 0.

| Имя | Форма | Источник |
|---|---|---|
| `GUIDE_OPEN`, `GUIDE_MARK`, `GUIDE_TITLE`, `GUIDE_CLOSE_TEXT`, `GUIDE_CLOSE`, `GUIDE_LEAD`, `GUIDE_TOC` | строки | Т1 |
| `GUIDE_SECTIONS` | массив из 10 разделов в порядке Т1: `{ key, title, blocks }`, `key` — `page`, `office`, `now`, `journal`, `tasks`, `cards`, `history`, `states`, `keys`, `limits`; `blocks` — массив `Block` (ниже) в порядке Т1; в `keys` — `ul` из четырёх пунктов (Tab, Enter, Стрелки, Escape) и `p` «Своих клавиш-сокращений у страницы нет.» | Т1 |
| `GUIDE_TEAM` | `{ key: "team", title: "Как работать с командой агентов", blocks: [{ kind: "ol", items: [5 строк] }] }` | Т2 |
| `GUIDE_ROLES` | `{ key: "roles", title: "Роли команды", lead: строка, groups: [{ title, codes: string[] }] }` — 7 групп в порядке Т2, коды в порядке Т2 | Т2 |
| `GUIDE_ROLE_ABOUT` | объект «код → описание», 37 ключей — ровно ключи `ROLE_NAMES` | Т2 |
| `GUIDE_GLOSSARY` | `{ key: "glossary", title: "Словарь", pairs: [[термин, объяснение] × 18] }` (r2: было 16 — добавлены «Запрос» после «Задача» и «Номер запуска, номер разговора» после «Запуск») | Т2 |
| `GUIDE_TOUR_START`, `KEYS_TOUR` | строки | Т3 |
| `TOUR_INVITE_LABEL`, `TOUR_INVITE`, `TOUR_INVITE_SHOW`, `TOUR_INVITE_LATER`, `TOUR_STEP` («Шаг {n} из {N}»), `TOUR_NEXT`, `TOUR_BACK`, `TOUR_SKIP`, `TOUR_LAST`, `TOUR_CLOSE` | строки | Т3 |
| `TOUR_STEPS` | массив из 6 `{ title, text, fallback: string \| null }` в порядке Т3 (у шагов 1 и 6 `fallback` — null) | Т3 |
| `HINT_MARK`, `HINT_LABEL` («Подсказка: {name}»), `HINT_CLOSE`, `KEYS_HINT` | строки | Т4 |
| `HINT_NAMES` | `{ now: "Сейчас", journal: "Журнал", tasks: "Задачи", office: "Офис и доска" }` | Т4 |
| `HINTS` | `{ now, journal, tasks, office }` — тексты Т4 | Т4 |
| `EMPTY_STEPS_TITLE`, `OFFICE_EMPTY`, `TASKS_EMPTY` | строки | Т4 |
| `EMPTY_STEPS` | массив из 4 строк | Т4 |

`Block` = `{ kind: "p", text }` \| `{ kind: "ul" \| "ol", items: string[] }` \| `{ kind: "dl", pairs: [string, string][] }` \|
`{ kind: "groups", groups: Array<{ title, items: string[] }> }` (последний вид строит только `guideSections`).

Прежние константы (`EMPTY_JOURNAL`, `EMPTY_HINT`, `NOW_EMPTY`, `NO_DATA`, `CANVAS_UNSUPPORTED` и др.) не меняются. Ключ
и значение хранилища в `texts.js` не кладутся — это не подписи (D9).

### 3.2 `guide-model.js` — новый, чистый

Импортирует только `texts.js`.

| Сигнатура | Что возвращает, правила |
|---|---|
| `within(node, root) → boolean` | true, если `root` встречается на пути `node`, `node.parentNode`, … (сам `node` тоже); `node` или `root` — null/undefined → false; не бросает |
| `guideSections(roleNames = ROLE_NAMES) → Section[]` | `Section = { key, title, blocks: Block[] }`. После 2a — 10 разделов `GUIDE_SECTIONS`; после 2b — 13: `page`, `team`, `roles`, `office`, `now`, `journal`, `tasks`, `cards`, `history`, `states`, `keys`, `limits`, `glossary`. `roles`: `p` с `GUIDE_ROLES.lead`, затем `groups` — у группы `title` и `items` = для каждого кода группы, который есть и в `roleNames`, и в `GUIDE_ROLE_ABOUT`, строка `«<roleNames[код]> — <GUIDE_ROLE_ABOUT[код]>»` (между — пробел, тире U+2014, пробел); код без названия или описания пропускается (раздел не ломается; соответствие ловит `roleTableProblems`). `glossary` — `dl` из `GUIDE_GLOSSARY.pairs`. `keys`: к пунктам единственного `ul` раздела после пункта «Escape — …» (он последний в `ul`) добавляются `KEYS_TOUR` (с 2c) и `KEYS_HINT` (с 2d) |
| `roleTableProblems(roleNames, groups, about) → string[]` | пусто — таблица согласована. Иначе строки по каждому случаю: `no group: <код>` (код `roleNames` ни в одной группе), `no description: <код>` (нет в `about`), `repeated: <код>` (в группах больше одного раза), `not a role: <код>` (в группе, но не в `roleNames`), `extra description: <код>` (в `about`, но не в `roleNames`). Порядок — по порядку проверок; не бросает |
| `tourStepView(step, facts) → StepView \| null` | `step` — целое 1…6, иначе null. `facts = { characters: number, nowShown: boolean, rows: number, items: number }`. `StepView = { step, title, text, fallback: boolean, target: "office" \| "now" \| "journal" \| "tasks" \| "guide" \| null, buttons: Array<"close" \| "back" \| "skip" \| "next" \| "last"> }`. Шаг 1: цели нет. Шаг 2: `characters > 0` → цель `office`, иначе цели нет и `fallback`. Шаг 3: `nowShown` → цель `now`, иначе цели нет и `fallback`. Шаг 4: цель `journal`; `fallback` при `rows === 0`. Шаг 5: цель `tasks`; `fallback` при `items === 0`. Шаг 6: цель `guide`. `text` = `fallback ? TOUR_STEPS[i].fallback : TOUR_STEPS[i].text`. Кнопки: шаг 1 — `close`, `skip`, `next`; 2–5 — `close`, `back`, `skip`, `next`; 6 — `close`, `back`, `last` |
| `escapeTarget(f) → Target \| null` | `f = { history, card, hint, tour, nowAll, guide, focusInGuide, invite, focusInInvite, row, focusInRow }` (все boolean). Первое истинное по порядку: `history` → `"history"`; `card` → `"card"`; `hint` → `"hint"`; `tour` → `"tour"`; `nowAll` → `"nowAll"`; `guide && focusInGuide` → `"guide"`; `invite && focusInInvite` → `"invite"`; `row && focusInRow` → `"row"`; `guide` → `"guide"`; иначе null |

### 3.3 `guide.js` — новый (DOM)

Импортирует `texts.js` и `within` из `guide-model.js`. Элементы создаёт только через `document.createElement`, тексты —
`textContent` и атрибуты.

| Сигнатура | Правила |
|---|---|
| `renderGuideSections(document, sections, onToc) → { nav, sections: Element[], headings: Map<key, Element> }` | `nav` (`aria-label` = `GUIDE_TOC`): `h3` «Разделы», затем по кнопке на раздел (`button type="button"`, класс `guide-toc-btn`, `data-section` = `key`, текст = `title`), клик зовёт `onToc(key)`. Раздел — `section.guide-section` с `data-section`, `h3` (`tabindex="-1"`, текст = `title`), затем блоки: `p`, `ul`/`ol` с `li`, `dl` с парами `dt`/`dd`, `groups` — `h4` и `ul` на группу. Экспорт нужен GR-05 (подменённые `roleNames`) |
| `createGuide(deps) → GuideApi` | `deps = { document, sections: () => Section[], canOpen: () => boolean, beforeOpen: () => void, onLayout: () => void, onTourStart: () => void, openerElement: (opener) => Element \| null }` |
| `GuideApi.mount({ button, aside, page })` | `button` — `#guide-open`: тексты знака и подписи ставятся ещё раз из `texts.js`, `aria-label` = `GUIDE_OPEN`, `aria-expanded="false"`; клик — `toggle({kind: "header"})`. `aside` — `#guide`; `page` — элемент `pageBody()` |
| `GuideApi.open(opener) → boolean` | ничего не делает и возвращает false, если уже открыта или `canOpen()` ложно. Иначе: `beforeOpen()`; при первом открытии строит содержимое `aside` — голова `div.guide-head` (`h2#guide-title` `tabindex="-1"` с `GUIDE_TITLE`; кнопка «Закрыть» — текст `GUIDE_CLOSE_TEXT`, `aria-label` `GUIDE_CLOSE`), тело `div.guide-body` (`p.guide-lead` `GUIDE_LEAD`; с 2c — кнопка `GUIDE_TOUR_START`, клик — `onTourStart()`; затем `renderGuideSections`); `aside.hidden = false`; `scrollTop` тела = 0; `page` получает `data-guide="open"`; `aria-expanded="true"`; `onLayout()`; фокус — на `h2#guide-title` |
| `GuideApi.close()` | ничего, если закрыта. Иначе запоминает, был ли фокус внутри `aside` (`within`); `aside.hidden = true`; снимает `data-guide`; `aria-expanded="false"`; `onLayout()`; если фокус был внутри — фокус на `openerElement(opener)` (нет — `#guide-open`); иначе фокус не трогает |
| `GuideApi.toggle(opener)` | открыта — `close()`, иначе `open(opener)` |
| `GuideApi.isOpen() → boolean`, `GuideApi.holds(node) → boolean` | `holds` — открыта и `within(node, aside)` |
| оглавление | `onToc(key)` внутри модуля: у заголовка раздела `scrollIntoView({ block: "start" })`, если функция есть, затем `focus({ preventScroll: true })`; отступ 0,75 rem от верха тела — правило `scroll-margin-top` в CSS |

### 3.4 `tour.js` — новый (DOM и хранилище)

Импортирует `texts.js`, `tourStepView` и `within` из `guide-model.js`. Константы модуля: `TOUR_KEY = "pixel-office-tour"`,
`TOUR_CLOSED = "closed"`. В модуле ровно по одному вызову `storageFn(`, `.getItem(TOUR_KEY)`, `.setItem(TOUR_KEY,
TOUR_CLOSED)`, каждый — внутри `try` с `catch`; `removeItem`, другие ключи и значения — нет.

| Сигнатура | Правила |
|---|---|
| `createTour(deps) → TourApi` | `deps = { document, storageFn, facts: () => Facts, targets: () => { office, now, journal, tasks, guide }, focusAfter: () => Element \| null, beforeOpen: () => void }`; `Facts` — как в `tourStepView` |
| хранилище | «получить» — `storageFn` не функция → нет; вызов бросил или вернул null/undefined → нет. «Прочитать» — нет хранилища или `getItem` бросил → «не закрыто»; иначе закрыто ⇔ значение `=== "closed"`. «Записать» — флаг в памяти `dismissed = true`, затем `setItem` (ошибка проглатывается), затем приглашение убирается |
| `TourApi.mount({ invite, box })` | `invite` — `#tour-invite`: `role="region"`, `aria-label` `TOUR_INVITE_LABEL`, тексты `span.tour-invite-text` и двух кнопок ставятся ещё раз; «Показать» (`.ctl.ctl-primary`) — `open()`; «Не сейчас» — `dismissInvite()`. `box` — `#tour`: `role="dialog"`, `aria-modal="false"`, `aria-labelledby="tour-title"`, `aria-describedby="tour-text"`; дети по порядку: кнопка «×» (`aria-label` `TOUR_CLOSE`, класс `tour-x`), `div.tour-live` с `aria-live="polite"` (в нём `span.tour-count`, `h2#tour-title`, `p#tour-text`), `div.tour-buttons` — «Назад», «Пропустить», «Далее», «Закрыть тур» (`data-tour` = `back`, `skip`, `next`, `last`; главная кнопка шага — класс `ctl-primary`) |
| `TourApi.offer()` | только первый вызов что-то делает (D10): приглашение показывается (`hidden = false`), если `!dismissed`, тур закрыт и «прочитать» дало «не закрыто». Фокус не трогает |
| `TourApi.open()` | `beforeOpen()` (закрывает подсказку); `dismissed = true`; приглашение убирается (без записи); `box.hidden = false`; шаг 1; показ шага; фокус на «Далее». Открытие при открытом туре — снова шаг 1 |
| показ шага | `view = tourStepView(step, facts())`; `data-step` у `box`; счётчик — `TOUR_STEP` с `{n}` = шаг, `{N}` = 6; заголовок и текст — из `view`; кнопки — `hidden` у тех, которых нет в `view.buttons`; цель — `targets()[view.target]`: если она другая, чем помеченная, — снять `data-tour-target` с прежней, поставить `data-tour-target="true"` новой и вызвать у неё `scrollIntoView({ block: "nearest" })` (если функция есть); при «Далее», «Назад» и открытии прокрутка зовётся и для той же цели |
| «Далее», «Назад» | шаг ±1; показ; фокус — на нажатой кнопке, если она видна на новом шаге, иначе на «Далее», если видна, иначе на «Закрыть тур» |
| «Пропустить», «Закрыть тур», «×» | `close()` |
| `TourApi.close()` | ничего, если закрыт. Иначе: был ли фокус внутри `box`; шаг — нет; снять пометку; `box.hidden = true`; «записать» (D9); если фокус был внутри — `focusAfter()` (`#guide-open`) |
| `TourApi.dismissInvite()` | «записать» (D9); если фокус был внутри приглашения — на `focusAfter()`. **r2** (D20): если приглашение было видно — строка о туре на 10 с и фокус на `focusAfter()` |
| `TourApi.refresh()` | тур открыт — показ шага без прокрутки той же цели (D11) |
| `TourApi.isOpen()`, `step()`, `holds(node)`, `inviteShown()`, `inviteHolds(node)` | состояние; `holds`/`inviteHolds` — через `within` |

Убрать приглашение — `hidden = true`; если фокус был внутри него — на `focusAfter()`. Любая «запись» убирает видимое
приглашение (критерий 1 REQ-052, «запись «closed» любым путём»).

### 3.5 `hints.js` — новый (DOM)

Импортирует `texts.js` и `within`.

| Сигнатура | Правила |
|---|---|
| `HINT_KEYS` | `["now", "journal", "tasks", "office"]` |
| `createHints({ document }) → HintsApi` | — |
| `HintsApi.mount(places)` | `places` — объект «ключ → функция `(button, tip)`», которая ставит их в страницу (D4). На ключ: `button.hint-btn` `type="button"`, текст `HINT_MARK`, `aria-label` = `HINT_LABEL` с `{name}` = `HINT_NAMES[key]`, `aria-describedby="hint-<key>"`, `data-pinned="false"`; подсказка `div.hint-tip#hint-<key>` `role="tooltip"`, `hidden`, дети: `p.hint-text` (`HINTS[key]`) и последним `p.hint-close` (`HINT_CLOSE`). События кнопки: `mouseenter` (r2: только при последнем `pointerType` мыши или без него, D21), `focus` → `open(key, false)`; `mouseleave` (r2: так же), `blur` → закрыть, если открыта эта и не закреплена; `click` → открыта эта и закреплена — `close()`, иначе `open(key, true)`. Один слушатель `click` документа: есть закреплённая и `event.target` не внутри её кнопки и не внутри её подсказки → `close()` (нажатие идёт дальше как обычно) |
| `HintsApi.open(key, pin)` | другая открытая закрывается (и снимается её закрепление); открыть эту; `pin` — закрепить; `hidden` и `data-pinned` у всех по состоянию |
| `HintsApi.close()` | закрыть открытую, снять закрепление; фокус не трогает |
| `HintsApi.isOpen()`, `openKey()`, `button(key)` | состояние |

### 3.6 `app.js`

Новое в `createApp`: поле `env.storageFn` (передаётся в `createTour` как есть, `app.js` его не вызывает); объекты
`guide`, `tour`, `hints`; переменная `emptyGuideButton` (кнопка пустого журнала, нарисованная последней, или null).

| Место | Что меняется |
|---|---|
| создание | `createGuide({ document, sections: () => guideSections(), canOpen: card === null && historyKey === null, beforeOpen: closeNowAll(false) и tour.close(), onLayout: guarded("холст", fit), onTourStart: guide.close() затем tour.open(), openerElement: header → els.guideOpen, empty → emptyGuideButton, если он ещё в журнале, иначе els.guideOpen })`; `createTour({ document, storageFn, facts: { characters: office.characters.length, nowShown: els.now?.hidden === false, rows: rows.length, items: model.list.length }, targets: { office: els.officePanel, now: els.now, journal: els.journal?.parentNode, tasks: els.tasks?.parentNode, guide: els.guideOpen }, focusAfter: els.guideOpen, beforeOpen: hints.close() })`; `createHints({ document })` |
| `escapeStep(origin) → boolean` (новая) | `origin` — `"document"` или `"row"`; собирает `f` для `escapeTarget`: `focusInRow` = `origin === "row"` или фокус внутри `li` раскрытой строки (`within`). Действия: `history` — `closeHistory()`; `card` — `closeCard()`; `hint` — `hints.close()`; `tour` — `tour.close()`; `nowAll` — `closeNowAll(origin === "document")` (как прежде: из строки фокус остаётся на строке, из документа — на кнопке списка); `guide` — `guide.close()`; `invite` — `tour.dismissInvite()`; `row` — `closeEvent(true)`. Возвращает, было ли что закрыть |
| `onKey` | ветки окна истории и карточки — прежние (Escape и круг Tab); иначе Escape → `escapeStep("document")`, при true — `preventDefault`. Tab при открытой справке, туре, подсказке не перехватывается |
| `journalPanelRow` | обработчик `keydown` строки: не Escape или строка не раскрыта — выход; иначе `preventDefault`, `stopPropagation`, `escapeStep("row")` |
| `setLink(state)` | если прежнее значение `link` — `"none"`, после смены — `guarded("тур", tour.offer)` |
| `renderAll` | в конце — `guarded("офис", renderOfficeNote)`, `guarded("тур", tour.refresh)` |
| `renderOfficeNote` (новая) | нет `els.officeNote` или холст не поддержан (`ctx` — null) — ничего (остаётся `CANVAS_UNSUPPORTED` из `decorate`). Иначе пусто = `loaded && office.characters.length === 0`: `textContent` = `OFFICE_EMPTY` или "", `hidden` = !пусто |
| `journalNote("empty")` | после прежних `span.empty-title` и `span.empty-hint`: `p.empty-steps-title` (`EMPTY_STEPS_TITLE`), `ol.empty-steps` из 4 `li` (`EMPTY_STEPS`), кнопка `button.guide-open-empty` (`type="button"`, `aria-label` и текст `GUIDE_OPEN`, знак `span.guide-mark` с `aria-hidden="true"`), клик — `guide.open({kind: "empty"})`; кнопка запоминается в `emptyGuideButton`. Классы `empty-title`, `empty-hint` новым элементам не даются. `"filtered"` и `"no-connection"` — прежние |
| `renderJournal` | если фокус был на `emptyGuideButton`: после перерисовки — на новой кнопке пустого журнала, если журнал всё ещё пуст, иначе на `els.journal`; если пустого журнала больше нет — `emptyGuideButton = null` |
| `renderTasks` | «Текущие» без элементов: `model.list.length === 0` → `TASKS_EMPTY`, иначе прежний `NOW_EMPTY`; «История», «Запуски сервера» — прежние |
| `resolveEls` | `els.guideOpen` (`#guide-open`), `els.guide` (`#guide`), `els.tourInvite` (`#tour-invite`), `els.tour` (`#tour`), `els.officeHint` (`#office-hint`) |
| `decorate` | в конце, до `renderControls`: `guide.mount({ button: els.guideOpen, aside: els.guide, page: pageBody() })`, `tour.mount({ invite: els.tourInvite, box: els.tour })`, `hints.mount({ now, journal, tasks, office })` по D4 (после создания `.now-side`) |
| `openCard`, `openInstance`, `openMain`, `openHistory`, `closeCard`, `closeHistory`, `fit` | без изменений (карточка и окно открываются поверх справки и тура — слои CSS) |
| возвращаемый объект | без изменений |

### 3.7 `index.html`

- В `header.top` после `div.controls`: (r2) `div#tour-later.tour-later` (`aria-live="polite"`, пустой, D20), затем `div#tour-invite.tour-invite` (`role="region"`, `aria-label="Приглашение в тур"`,
  `hidden`; внутри `span.tour-invite-text` с текстом `TOUR_INVITE`, `button.ctl.ctl-primary` «Показать», `button.ctl`
  «Не сейчас», оба `type="button"`), затем последним — `button#guide-open.ctl.guide-open` (`type="button"`,
  `aria-label="Как пользоваться"`, `aria-controls="guide"`, `aria-expanded="false"`, без `aria-haspopup`; внутри
  `span.guide-mark` `aria-hidden="true"` «?» и `span.guide-open-text` «Как пользоваться»).
- Сразу после `</header>`: `aside#guide.guide` (`aria-labelledby="guide-title"`, `hidden`, пустой), затем
  `div#tour.tour` (`hidden`, пустой; атрибуты ставит `mount`), затем прежние `#now-all-catcher`, `#now-all`.
- В `div#office-inner` между `p#office-note` и `ul#legend` — `div#office-hint.office-hint` (пустой).

Порядок Tab: … «4×», «Показать», «Не сейчас» (если приглашение видно), «Как пользоваться», справка, подпись тура,
прежние элементы страницы (описание, п. О-1). Атрибута `style` нет.

### 3.8 `boot.js`

Одна строка в объекте `createApp`: `storageFn: () => window.localStorage,` (D16). Слово `localStorage` в комментарии не
пишется.

### 3.9 `style.css`

Вид — по описанию (разделы О-2…О-12) в пределах D15: `.guide-open`, `.guide-mark`, `.ctl-primary`, `.guide`,
`.guide-head`, `.guide-body`, `.guide-lead`, `.guide-toc`, `.guide-toc-btn`, `.guide-section` (у `h3` —
`scroll-margin-top: 0.75rem`), `body[data-guide="open"]` (нижнее поле листа; в широком `@media` — поле 0 и
`.layout` с правым полем 22 rem), `.tour-invite` (в узком `@media` — своя линия, правило `order`, вопрос 1 описания —
принят `decisions/0061`, дополнение), `.tour`, `.tour-x`, `.tour-live`, `.tour-count`, `.tour-buttons`,
`#tour[data-step="1"]`…`#tour[data-step="6"]` (места — в широком `@media`, якорь `--now` — у шага 3),
`[data-tour-target]` (рамка-тень 0,1875 rem `--warn`), `.hint-btn`, `.hint-btn[data-pinned="true"]`, `.hint-tip`,
`.hint-text`, `.hint-close`, `.office-hint` (**уточнено 2026-10-18, DOC-UPDATER, шаг 10**, по правкам `step-08g-code-fixer.json` и `step-08h-code-fixer.json` к провалу Ф3 приёмки, диагноз `step-08f-issue-fixer.json`: `align-self: flex-start` — блок шириной со свою кнопку, а не во всю панель, иначе с отрицательным нижним полем и `z-index: 1` он перекрывал кнопки легенды; `pointer-events: none` у блока и `pointer-events: auto` только у `.office-hint > .hint-btn` — нажатия получает только «?», подсказка остаётся `none`, как все подсказки, D22), поправки `.legend` (поле слева и сверху, `min-height`), `.empty-steps-title`,
`.empty-steps`, `.guide-open-empty`, `.office-note`. Слои: справка и тур — 7, подсказка — 9 (описание, п. О-1).

### 3.10 `tools/README.md`, раздел «## Pixel Office»

FRONTEND-DEV, подшаг 2e, только этот раздел: подраздел «### Справка «Как пользоваться»» (где кнопка, что в справке,
как закрыть, справка стоит рядом — у правого края или листом снизу, не перекрывает и ничего не меняет; общий порядок
Escape; разделы «Как работать с командой агентов», «Роли команды», «Словарь»; описания ролей идут по `ROLE_NAMES`, тест
краснеет при новой роли без описания); «### Тур первого открытия» (приглашение «Показать» / «Не сейчас» вместо самого
тура; тур не перекрывает и не запирает фокус; шесть шагов; память — ключ «pixel-office-tour» в хранилище браузера,
только на этом адресе; без хранилища приглашение каждый раз; повтор из справки); подсказки «?» (где, как открыть мышью,
клавиатурой и касанием, как закрыть) и пустые состояния журнала («Чтобы здесь появились события»), офиса и «Задач».
Прежние фразы DC-01, FS-16, NM-09, JR-07, AC-11, DC-03, MC-07 остаются.

## 4. Правила

### 4.1 Порядок Escape (критерий 3 REQ-050; критерий 4 REQ-052; критерий 1 REQ-053)

| № | Что открыто | Условие | Действие | Фокус |
|---|---|---|---|---|
| 1 | окно «Просмотр истории» | — | закрыть (прежнее) | на открывшем (прежнее) |
| 2 | карточка | — | закрыть (прежнее) | прежнее правило D13 прошлого проекта |
| 3 | подсказка «?» | — | закрыть | не переносится |
| 4 | тур | — | закрыть, записать `closed` | на `#guide-open`, если был в туре; иначе на месте |
| 5 | список «Показать всех (N)» | — | закрыть | прежнее (из строки — на строке, иначе на кнопке списка) |
| 6 | справка | фокус внутри неё | закрыть | на открывшем (D8) |
| 7 | приглашение | фокус внутри него | убрать, записать `closed` | на `#guide-open` |
| 8 | подробности строки журнала | фокус в этой строке | закрыть (прежнее) | на строке (прежнее) |
| 9 | справка | — | закрыть | на месте |

Одно нажатие — одно действие. Нет ничего — Escape ничего не делает и не отменяется.

### 4.2 Справка рядом со страницей

- Не открывается при открытой карточке или окне истории (`canOpen`). Открытие закрывает список «Показать всех» и тур
  (с записью `closed`). Подсказку не закрывает.
- Пока открыта: опрос, перерисовки, нажатия, фильтры, поиск, раскрытия, карточки — прежние; справка ничего в них не
  меняет и событий не добавляет; страница шлёт только GET.
- Справка и тур вместе не открыты: открытие справки закрывает тур; «Показать тур по странице» закрывает справку.

### 4.3 Приглашение и память

D9, D10. «Показать» — `open()`; «Не сейчас», Escape в приглашении, любое закрытие тура, открытие справки при открытом
туре — запись. После записи в этом браузере на этом адресе ни приглашение, ни тур сами не появляются. Без хранилища —
приглашение при каждой загрузке страницы, тур работает так же.

### 4.4 Тур

D11, D12. Пока тур открыт, каждое `renderAll` пересчитывает вид шага: появился первый персонаж на шаге 2 — основной
текст и подсветка сразу; журнал заменён на пустой на шаге 4 — запасной текст. Тур не меняет фильтры, поиск, пометку
«Задача», раскрытую строку, выбранного персонажа и прокрутку списков; прокрутку окна меняет только `scrollIntoView`
по D11 и после закрытия её не возвращает. Нажатия на страницу тур не закрывают.

### 4.5 Подсказки

D13. Открытие тура закрывает подсказку, в том числе закреплённую; во время тура подсказку открыть можно.

### 4.6 Пустые состояния

| Состояние | Условие | Что видно |
|---|---|---|
| пустой журнал | ответ получен, `rows.length === 0` | `EMPTY_JOURNAL`, `EMPTY_HINT`, `EMPTY_STEPS_TITLE`, `ol` из `EMPTY_STEPS`, кнопка «Как пользоваться» |
| фильтры без строк | строки есть, выбор пуст | прежнее `FILTERS_EMPTY` и «Сбросить фильтры», без шагов |
| нет связи до первого ответа | — | прежнее `NO_CONNECTION`, без шагов |
| пустой офис | ответ получен, холст поддержан, персонажей нет | `#office-note` виден, `OFFICE_EMPTY` |
| холст не поддержан | — | прежнее `CANVAS_UNSUPPORTED` |
| пустые «Задачи» | ответ получен, `model.list.length === 0` | «Текущие» — `TASKS_EMPTY`; «История», «Запуски сервера» — `NO_DATA` |
| «Текущие» пусты, задачи есть | `model.list.length > 0`, «в работе» нет | прежнее `NOW_EMPTY` |

## 5. Пути отказа

| Случай | Что видит человек | Что не меняется |
|---|---|---|
| `storageFn` нет в `env`, бросает, возвращает null; `getItem` или `setItem` бросает | приглашение при каждой загрузке; тур открывается и закрывается; после «Не сейчас» приглашение не возвращается до перезагрузки | исключений наружу нет, `reportOnce` не вызван |
| связь потеряна при открытой справке, туре, закреплённой подсказке | всё прежнее; в шапке «Нет связи с сервером Pixel Office» | шаг тура, текст справки и подсказки |
| ответа сервера ещё не было | справка открывается с полным текстом; тур из справки — шаг 3 с запасным текстом без подсветки; приглашения нет до первого результата связи | — |
| журнал заменён на пустой | три пустых состояния; тур на шаге 4 — запасной текст | открытые справка и тур |
| 20 открытий и закрытий справки, тура, подсказки | один `#guide`, одно окно тура, не больше одной пометки `data-tour-target`, у каждой кнопки «?» одна подсказка | — |
| журнал из 450 строк | справка и тур открываются как обычно | — |
| цели шага нет (персонажей нет, `#now` скрыт) | запасной текст без подсветки | — |
| `scrollIntoView` нет у элемента | прокрутки нет, остальное как обычно | — |
| роль вне таблиц описаний | в разделе «Роли команды» её нет (вводный абзац это говорит); на странице она показана, как пришла (`decisions/0055`, п. 1) | — |
| код `ROLE_NAMES` без описания или группы | раздел без него; `roleTableProblems` — непусто, GR-02 краснеет | страница работает |
| название роли с разметкой (`<img …>`) | текстом | элементов не создано |
| ошибка в одной части отрисовки | прежнее нарисованное, одна строка в консоли (`guarded`, `reportOnce`) | остальные части |

Ни в одном тексте нет «undefined», «null», «NaN», «[object». Страница только читает (GET).

## 6. Подшаги разработки и ожидаемые красные тесты (проверено прототипом)

Один FRONTEND-DEV, по handoff-у на подшаг; двух писателей одного файла нет. Сервер, хук, `schema.js`, `model.js`,
`panels.js`, `layout.js`, `office-model.js`, `office-view.js`, `office-sim.js`, `format.js`, `office-report.js`,
`words.js`, `history.js`, `event-details.js`, `instance-card.js`, `main-card.js` не трогаются. Тестов разработчик не
пишет и не правит.

Проверка каждого подшага: `cd tools && npm run format:check && npm run lint && npm run traces && npm run
handoffs-check` — код 0; затем `node --test "test/pixel-office-*.test.js"` — все файлы загружаются, **399** тестов,
красные — ровно названные. `npm run check` целиком зелёный — после шага 5 (замены раздела 8).

| Подшаг | Требование | Файлы | Что (разделы) | Красные после подшага (накопительно) |
|---|---|---|---|---|
| 2a | REQ-050 | `texts.js` (`GUIDE_*` без `GUIDE_TOUR_START`, `GUIDE_SECTIONS`), `guide-model.js` (новый: `within`, `guideSections` из 10 разделов, `escapeTarget`), `guide.js` (новый), `index.html` (`#guide-open`, `#guide`), `app.js` (создание `guide`, `escapeStep`, `onKey`, строка журнала, `resolveEls`, `decorate`), `style.css` | D1–D8, D15, 3.1–3.3, 3.6, 3.7, 4.1, 4.2 | **0** |
| 2b | REQ-051 | `texts.js` (`GUIDE_TEAM`, `GUIDE_ROLES`, `GUIDE_ROLE_ABOUT`, `GUIDE_GLOSSARY`), `guide-model.js` (`guideSections` из 13, `roleTableProblems`), `style.css` | 3.1, 3.2 | **0** |
| 2c | REQ-052 | `texts.js` (`TOUR_*`, `GUIDE_TOUR_START`, `KEYS_TOUR`), `guide-model.js` (`tourStepView`, `KEYS_TOUR` в «Клавиши»), `tour.js` (новый), `guide.js` (кнопка тура), `index.html` (`#tour-invite`, `#tour`), `boot.js`, `app.js` (создание `tour`, `setLink`, `renderAll`, `escapeStep`), `style.css` | D9–D12, D16, 3.4, 3.8, 4.3, 4.4 | **1**: PG-20 (`pixel-office-page.test.js` 1063, `boot.js: /localStorage/`) |
| 2d | REQ-053 | `texts.js` (`HINT*`, `KEYS_HINT`, `EMPTY_STEPS*`, `OFFICE_EMPTY`, `TASKS_EMPTY`), `guide-model.js` (`KEYS_HINT`), `hints.js` (новый), `index.html` (`#office-hint`), `app.js` (создание `hints`, `escapeStep`, `journalNote`, `renderJournal`, `renderOfficeNote`, `renderTasks`, `decorate`), `style.css` | D13, D14, 3.5, 4.5, 4.6 | **2**: PG-20; PN-09 (`pixel-office-panels.test.js` 556, часть «empty sections»: в «Текущих» журнала из одного SessionStart теперь `TASKS_EMPTY`) |
| 2e | все | `tools/README.md` (только «## Pixel Office») | 3.10 | те же 2; DC-01, FS-16, NM-09, JR-07, AC-11, DC-03, MC-07 зелёные |

Прототип — копия дерева метки вне проекта (`git archive base/REQ050-20261017-01`), во временном каталоге; рабочее
дерево не менялось. В прототипе: все тексты Т1–Т4 в `texts.js` (вынуты из `docs/requirements.yaml` скриптом, литералы
сверены — расхождений 0), четыре модуля по разделу 3, правки `app.js`, `index.html`, `boot.js` и короткие правила CSS
(полоса в широком `@media`, лист, подсветка, подсказки — без `px` и новых `@media`). Прогоны
`node --test test/pixel-office-*.test.js`: метка — `# tests 399 # pass 399`; после 2a — 399/0; после 2b — 399/0; после 2c
— 399/1 (PG-20); после 2d — 399/2 (PG-20, PN-09). Проверочный тест прототипа (вне проекта, удалён) подтвердил на
поддельном DOM: открытие справки и фокус на `#guide-title`; фильтр и карточка при открытой справке; Escape — карточка,
затем справка; справка не открывается при карточке; 20 нажатий — один `#guide`, 13 разделов, в «Клавишах» 6 пунктов;
без хранилища — приглашение; «Показать» — шаг 1, фокус на «Далее»; шаг 2 пустого офиса — без пометки, шаг 4 — пометка
и «Это журнал.…»; подсказка «Задачи» во время тура — первый Escape её, второй — тур; нажатие вне закреплённой
подсказки (`doc.fire("click", {target})`) — закрыта; пустой офис и шаги журнала исчезают с первым событием. Команды
критериев на прототипе (`grep` слов успеха, прежних слов REQ-048, `innerHTML…`, `https?://`) — пусто; правило правды и
правила понятности (длина фраз, «вы», список непонятных слов, слова сторон экрана) на всех текстах — нарушений 0.

**С применёнными заменами раздела 8** (PG-20 без `/localStorage/`, PN-09 по строке таблицы): после 2d — `# tests 399
# pass 399 # fail 0`; на коде после 2a, 2b, 2c — красный только PN-09 (ждёт 2d). Числа после замен: page 113/1199,
panels 55/1017 — не меньше метки (ф15).

Полный код может дать провал, которого прототип не видел (прототип проверял видимый тестам контракт, не вид и не
браузер). Разработчик называет такой тест в `result.issues` подшага с причиной; если его нет в разделе 8 — вопрос
CODE-DESIGNER через ORCH, а не тихая правка теста.

После кода: шаг 5 — TEST-DESIGNER (замены раздела 8; новые GD-01…GD-07, GR-01…GR-05, TU-01…TU-09, HN-01…HN-06,
DC-04; в `test/pixel-office-helpers.js` — параметр `makePage` `storageFn` (передаётся в `env` как есть, как
`clipboardFn`) и поддельное хранилище со счётчиком вызовов; поведение по умолчанию прежнее — без `storageFn`, прототип
показал, что прежние тесты с видимым приглашением проходят); 5b — TEST-DESIGN-VALIDATOR; 6 — TEST-RUNNER. Отдельного
шага удаления экспортов нет (D17).

Протокол поддельного DOM для новых тестов (ф10): фокус-события — `button.fire("focus")`/`fire("blur")` вручную;
нажатие вне подсказки — нажатие на элемент и затем `doc.fire("click", { target: элемент })`; Tab — `doc.fire("keydown",
{ key: "Tab", preventDefault })` и проверка, что `preventDefault` не вызван при открытых справке, туре, подсказке;
прокрутка — своя функция `scrollIntoView` на элементе-цели до шага.

## 7. Таблица «критерий → элемент проекта → тест» (Q5)

Файлы тестов — `tools/test/`; новые тесты справки, тура, подсказок — `pixel-office-guide.test.js` (новый), TU-09 — в
`pixel-office-page.test.js` рядом с PG-20, DC-04 — в `pixel-office-docs.test.js`. Критерии, изменённые в r2, и новый
критерий 8 REQ-051 — таблица 13.8 (дополняет строки ниже).

### 7.1 REQ-050

| Кр. | Что | Элемент | Тест | Падает, если |
|---|---|---|---|---|
| 1 | `button#guide-open` — последний ребёнок `header.top`, после `div.controls` и вне его; `type`, `aria-label`, `aria-controls`, `aria-expanded`, **нет** `aria-haspopup`; знак с `aria-hidden`; тексты = константам; порядок видимых управляющих шапки — «Пауза», «1×», «2×», «4×», «Как пользоваться»; высоты и кольцо фокуса — шаги 1, 2, 6 приёмки | 3.7, 3.3 (`mount`) | GD-01 (разбор `index.html` и страницы после старта); тест критерия 18 REQ-007 и тесты критериев 4, 7 REQ-036 — без правки (прототип) | кнопка не последняя, есть `aria-haspopup`, текст не константа |
| 2 | открытие мышью и Enter; нет `role="dialog"`, `aria-modal`, подложки; фокус на `h2#guide-title`; состав и порядок детей (голова, вводная, оглавление, разделы); Tab с последнего элемента не перехватывается; кнопка оглавления «Журнал» — фокус на заголовке раздела; фильтр и карточка при открытой справке; «Закрыть» — скрыта, фокус на `#guide-open`, `aria-expanded="false"`; повторное нажатие закрывает; фокус вне справки — закрытие его не переносит; открытие закрывает «Показать всех»; при карточке не открывается | 3.3, 4.2, D7, D8 | GD-02 | модальность, фокус не там, открылась поверх карточки |
| 3 | поддельные fetch и часы: фильтр «Агент», поиск, раскрытие, прокрутка; новое событие при открытой справке — строк +1, текст справки прежний; карточка поверх, Escape — карточка, справка открыта; фокус в раскрытой строке — Escape раскрытие, затем справку; фокус в справке — Escape справку; «Показать всех» и справка (фокус вне) — Escape список; после закрытия фильтры, поиск, раскрытие, выбор, `scrollTop` прежние; без событий числа строк, элементов, персонажей прежние; только GET; `escapeTarget` — таблица 4.1 на всех сочетаниях; `fit` после открытия и закрытия (меняются прямоугольники панели — меняется холст) | 4.1, 4.2, D5, D7 | GD-03 | порядок Escape, справка меняет состояние, нет пересчёта холста |
| 4 | литералы Т1; порядок 10 разделов (с REQ-051 — 13); `textContent` заголовков, `p`, `li`; правило правды по всем текстам справки против всех строк `texts.js`; длина фраз ≤ 18, «вы», список непонятных слов, пример «…» в каждом разделе, кроме `limits`; нет «слева», «справа», «вверху» и выражения запрещённых слов; команды `grep` критерия | 3.1, 3.2 | GD-04 + команды | текст не Т1, нарушено правило |
| 5 | контраст каждой пары токенов правил справки ≥ 4,5; у правил справки нет `transition`, `animation`; раскладка — шаги 2, 6 приёмки | 3.9, D15 | GD-05 | пара ниже 4,5, есть переход |
| 6 | связь потеряна при открытой справке; до ответа; пустой журнал; 20 открытий — один `#guide`, Escape закрывает один раз; 450 строк; `reportOnce` не вызван; нет «undefined|null|NaN|[object» | раздел 5 | GD-06 | исключение, два `#guide` |
| 7 | только GET, ни одной новой строки от действий со справкой; команды `innerHTML…`, `https?://`, `git diff` сервера и `package*.json`; PN-17 без правки | 3.6, D17 | GD-07 + команды | запрос не GET |
| 8 | стенд, шаги 1–7, читатель без контекста | разделы 2–4, описание | `docs/uat/REQ-050.md`, `-RUN.md` (шаг 8); RELEASE-VALIDATOR — 1, 2, 3, 6 | — |
| 9 | README «Как пользоваться»; `node --test test/pixel-office-docs.test.js`; замены — раздел 8; числа тестов не меньше метки; `npm run check` — 0, `skipped 0`, `todo 0` | 3.10, раздел 8 | DC-04 (новый: фразы «Как пользоваться», «Роли команды», «pixel-office-tour», «Чтобы здесь появились события» в разделе, как `awk … \| grep -c`) + команды | фразы нет |

### 7.2 REQ-051

| Кр. | Что | Элемент | Тест | Падает, если |
|---|---|---|---|---|
| 1 | раздел `team` сразу после `page`, кнопка оглавления там же; `ol` из 5 `li`, литералы Т2 | 3.1, 3.2 | GR-01 | место, число пунктов |
| 2 | `roles` после `team`; вводный абзац; 7 групп `h4` + `ul`; объединение кодов групп = `Object.keys(ROLE_NAMES)`, повторов нет; ключи `GUIDE_ROLE_ABOUT` = ключи `ROLE_NAMES`; пункт = название + « — » + описание; файлов `.claude/agents/*.md` = ключей (37); `roleTableProblems` с копией `ROLE_NAMES` и лишним кодом — непусто | 3.2 | GR-02 | роль без описания или группы проходит |
| 3 | `glossary` последний, кнопка последняя; `dl` из 18 пар (r2; было 16), литералы | 3.1, 3.2 | GR-03 | — |
| 4 | правило правды по Т2 (с названиями групп и терминами словаря); понятность; все 16 терминов в словаре; команды | 3.1 | GR-04 + команды | цитата не константа |
| 5 | уровни `h2` → `h3` → `h4`; `ol`, `dl`; `renderGuideSections` с копией `ROLE_NAMES`, где `ORCH` = `<img src=x onerror=alert(1)>`: пункт буквально, элементов `img` не создано; у элементов трёх разделов нет цветов вне правил справки; команда `innerHTML…` | 3.3, 3.9 | GR-05 + команда | элемент создан |
| 6 | стенд, шаги 1–6 | — | `docs/uat/REQ-051.md`, `-RUN.md`; RELEASE-VALIDATOR — 1, 3, 4 | — |
| 7 | README «Роли команды»; замен нет; числа; `npm run check` | 3.10 | DC-04 + команды | — |

### 7.3 REQ-052

| Кр. | Что | Элемент | Тест | Падает, если |
|---|---|---|---|---|
| 1 | пустое хранилище — после первого ответа и после первой неудачи приглашение видно, тура нет, фокус не изменился; «Не сейчас» — записано `closed`, приглашения нет; новый запуск с тем же хранилищем — ничего; «Показать» — шаг 1; закрытие тура — `closed`; Escape в приглашении — `closed`; тур из справки при видимом приглашении — после закрытия приглашения нет; `closed` до запуска — ничего; без `storageFn`, `storageFn` бросает, возвращает null, `getItem`/`setItem` бросают — приглашение при каждом запуске, тур работает, исключений нет. TU-09: (а) `localStorage` — одна строка в `boot.js`, поле `storageFn`, без вызова методов; (б) `getItem(` и `setItem(` — только в `tour.js`, с `TOUR_KEY`, у `setItem` — `TOUR_CLOSED`, константы `"pixel-office-tour"` и `"closed"`, каждый вызов и вызов `storageFn(` — внутри `try` с `catch`; (в) `sessionStorage`, `indexedDB`, `document.cookie`, `removeItem(` — нигде; PG-20 без `/localStorage/`, остальной список прежний | 3.4, 3.8, D9, D10, D16 | TU-01 (`pixel-office-guide.test.js`), TU-09 (`pixel-office-page.test.js`) | приглашение при `closed`, нет записи, исключение, хранилище вне модуля тура |
| 2 | литералы Т3; «Далее» 1→6 и «Назад» 6→1: счётчик, заголовок, набор видимых кнопок; правило правды по Т3; `tourStepView` по таблице 3.2 | 3.2, 3.4 | TU-02 | набор кнопок, текст |
| 3 | пустой журнал до первого ответа: шаги 2, 3 без пометки с запасным текстом, 4, 5 с пометкой и запасным; пустой журнал после первого ответа (`#now` виден, «в работе ничего нет»): шаг 2 без пометки с запасным текстом, шаг 3 — помечен `#now` и основной текст, 4, 5 с пометкой и запасным (уточнено 2026-10-18, DOC-UPDATER, шаг 10, по критерию 3 REQ-052 и `step-01f-req-validator.json`, I1; прежде — «пустой журнал до и после ответа: шаги 2, 3 без пометки»); журнал с основной сессией и двумя ролями — у шагов 2–6 своя пометка и основной текст; после «Далее» прежняя пометка снята; после закрытия пометок нет; первое событие при шаге 2 пустого офиса — основной текст и пометка; `scrollIntoView` с `{block: "nearest"}` у цели | 3.2, 3.4, D11 | TU-03 | пометка не снята, условие запасного текста не то |
| 4 | фокус при открытии на «Далее»; Tab с последней кнопки не перехватывается, тур открыт; «Далее» с шага 5 — фокус на «Закрыть тур»; Escape на шагах 1, 4, 6 при фокусе в туре — закрыт, фокус на `#guide-open`; Escape при фокусе на фильтре «Работа» — закрыт, фокус там же; `role`, `aria-modal="false"`, `aria-live` | 3.4, 4.1 | TU-04 | ловушка фокуса, фокус не туда |
| 5 | фильтр «Агент», раскрытие, тур, новое событие — строк +1, шаг прежний; фильтр «Работа» при туре — сменился, тур на том же шаге; карточка поверх, Escape — тур на том же шаге; «Как пользоваться» — справка, тура нет, `closed`; без нажатий значения и `scrollTop` прежние, `scrollIntoView` при `refresh` той же цели не зовётся; подложки нет; только GET | 4.2, 4.4, D11 | TU-05 | тур закрылся от нажатия, прокрутка при опросе |
| 6 | `KEYS_TOUR` сразу после «Escape — …»; при `closed`: справка → «Показать тур по странице» — справка закрыта, шаг 1; Escape — закрыт, `closed`, фокус на `#guide-open`; кнопка — после `GUIDE_LEAD`, до `nav` | 3.2, 3.3 | TU-06 | место кнопки или пункта |
| 7 | контраст текста ≥ 4,5, рамки подсветки ≥ 3; рамка подсветки не тоньше 2 px (0,1875 rem); переходов нет; команды; геометрия — шаги 2, 6 приёмки | 3.9, D15 | TU-07 + команды | — |
| 8 | связь потеряна во время тура; журнал заменён на пустой на шаге 4; `setItem` бросает при закрытии; 20 открытий из справки — одно окно, ≤ 1 пометки; закреплённая подсказка «Журнал» + «Показать» — подсказка скрыта; подсказка «Задачи» во время тура — Escape её, затем тур; Escape при туре не закрывает раскрытие строки | раздел 5, 4.1, 4.5 | TU-08 | исключение, две пометки |
| 9 | стенды А и Б, шаги 1–9 | — | `docs/uat/REQ-052.md`, `-RUN.md`; RELEASE-VALIDATOR — 1, 2, 3, 4, 6, 7 | — |
| 10 | README «pixel-office-tour»; замена PG-20 → TU-09 (раздел 8); числа; `npm run check` | 3.10, раздел 8 | DC-04, TU-09 + команды | — |

### 7.4 REQ-053

| Кр. | Что | Элемент | Тест | Падает, если |
|---|---|---|---|---|
| 1 | для каждой из четырёх: `aria-label`, `aria-describedby` → `role="tooltip"`; `mouseenter`/`mouseleave`; `focus`/`blur`; `click` — закреплена и после `mouseleave`; второй `click` — скрыта; Escape — скрыта, фокус на кнопке, раскрытая строка не закрылась; закреплена, фокус на поиске, Escape — скрыта, фокус на поиске, строка раскрыта; закреплена, нажатие на строку журнала — скрыта, строка раскрыта; вторая закрывает первую; «Показать» закрывает закреплённую; во время тура — Escape подсказку, тур открыт; последняя строка — `HINT_CLOSE`; `KEYS_HINT` после `KEYS_TOUR`; литералы Т4 | 3.5, 4.1, 4.5 | HN-01 | закреплённая закрылась от ухода мыши, Escape закрыл строку |
| 2 | родители кнопок: `#now`, строка заголовка журнала, голова «Задач», `div.office-hint`; у `div.office-hint` родитель `#office-inner`, следующий — `ul#legend`; число `li` в `#legend` прежнее; размеры и высота шапки — шаги 1, 5 приёмки; тесты критерия 18 REQ-007 и 4, 7 REQ-036 — без правки | 3.5, 3.7, D4 | HN-02 | кнопка внутри легенды |
| 3 | пустой журнал: порядок текстов, `ol` из 4 `li`, кнопка открывает `#guide`, Escape — фокус на этой кнопке; фильтр без совпадений — шагов нет; нет связи до ответа — шагов нет; первая строка — шагов нет | 3.6, 4.6, D8 | HN-03 | шаги при фильтре |
| 4 | пустой журнал после ответа — `#office-note` виден, `OFFICE_EMPTY`; SessionStart — скрыт; холст не поддержан — `CANVAS_UNSUPPORTED`; до ответа — скрыт | 3.6, 4.6 | HN-04 | текст до ответа |
| 5 | пустой журнал — `TASKS_EMPTY`, нет `NOW_EMPTY`, «История», «Запуски» — `NO_DATA`; одна закончившая задача — `NOW_EMPTY` | 3.6, 4.6 | HN-05 | `TASKS_EMPTY` при непустом списке |
| 6 | понятность Т4, цитата в каждой подсказке; правило правды; контраст; разбор CSS; связь потеряна при закреплённой; журнал заменён на пустой — три пустых состояния; 20 открытий — один `tooltip` у кнопки; только GET; команды | раздел 5, 3.9 | HN-06 + команды | исключение |
| 7 | стенды А и Б, шаги 1–7 (итоговые пять вопросов) | — | `docs/uat/REQ-053.md`, `-RUN.md`; RELEASE-VALIDATOR — 1, 2, 4, 5 | — |
| 8 | README «Чтобы здесь появились события»; замена PN-09 (раздел 8); числа; `npm run check` | 3.10, раздел 8 | DC-04 + команды | — |

## 8. Прежняя проверка → новая (критерии 9 REQ-050, 7 REQ-051, 10 REQ-052, 8 REQ-053; AP-005)

Прежние тесты не удаляются и не слабеют: ожидание меняется на не менее строгое, идентификатор и заголовок `test(`
прежние. Список — по прототипу (раздел 6); остальные принятые тесты на коде прототипа проходят без правки.

| Прежний тест (файл, строка) | Требование | Что было | Новая проверка (не слабее) |
|---|---|---|---|
| PG-20 (`pixel-office-page.test.js` 1063) | REQ-052, кр. 1, 10 | в списке запретов для всех `.js`/`.html` `public/` — `/localStorage/` | тот же тест без `/localStorage/` в списке; остальной список запретов, список «чистых» модулей, проверки Node, импортов и CSS — прежние; правило хранилища целиком проверяет новый TU-09 (рядом, раздел 7.3) |
| PN-09 (`pixel-office-panels.test.js` 556, часть «empty sections», строки 643–649) | REQ-053, кр. 5 | журнал из одного SessionStart: первые два `p.section-empty` — `[NOW_EMPTY, NO_DATA]` | тот же журнал: `["Задач пока нет. Элемент появится, когда основная сессия получит запрос или агенту передадут задание.", NO_DATA]` (литерал); и журнал SessionStart, UserPromptSubmit, Stop той же сессии (строка основной сессии закончила работу): первый `p.section-empty` — `NOW_EMPTY`. Прототип: `^test(` 55, `assert.` 1017 (метка — 1016) |

Проверено и не меняется (прототип, без правки): тесты состава и порядка шапки, тест критерия 18 REQ-007, тесты
критериев 4 и 7 REQ-036 — с видимым приглашением (`makePage` без `storageFn`) и с кнопками «?»; PG-12g, PN-08, JR-06
(части пустого журнала по классам `empty-title`, `empty-hint`); тесты Escape строки и списка «Показать всех» (JR-03,
VW-01 и др.); PN-17; SC-01…SC-06, NM-07, OF-41, DQ-03, DQ-04 при CSS по D15. В первой редакции REQ-050 и REQ-051 замен не
давали; замены доработки r2 — ниже.

#### Доработка r2 — тексты гайда и карточки, подписи номеров (REQ-050…REQ-053; правленные критерии REQ-044, REQ-045, REQ-046, REQ-047, REQ-048)

Прежние тесты — принятые тесты рабочего дерева прогона (не метки): файлы `tools/test/pixel-office-guide.test.js`,
`pixel-office-page.test.js`, `pixel-office-panels.test.js` на 2026-10-17 18:35Z, строки — по ним. Меняются только
литералы на новые значения требований (раздел 13, 13.3) — ожидание не слабеет: сравнение по-прежнему буквальное, те же
элементы, то же число проверок. Прототип: после 2f и 2g краснеют ровно эти 17 тестов; с заменами — `# tests 433 # pass
433`; числа `^test(` / `assert.`: guide 32/519, page 114/1215, panels 55/1017 — как до доработки.

| Прежний тест (файл, строки) | Требование | Что было | Новая проверка (не слабее) |
|---|---|---|---|
| GD-04 (`pixel-office-guide.test.js` 1342; таблица `T1`, строки 37–289) | REQ-050, кр. 4 | `T1.GUIDE_SECTIONS`, раздел `journal` — 7 абзацев (строки 143, 147, 151, 155, 159: «Второе важно. Например, …», «Кнопки «Всё»…», «Поле «Поиск в журнале»…», «Над строками…», «Чтобы увидеть все события одной задачи…»); раздел `tasks` — 4 абзаца, строка 169 «… Элемент — это один запуск агента или один запрос, который обрабатывала основная сессия. …», строка 181 «… Кнопка «открыть историю запроса» открывает окно «Просмотр истории». …»; раздел `states`, строки 234, 235 — прежние пункты «закончила работу…» и «окончание не записано…» | `T1.GUIDE_SECTIONS` = Т1 текущей редакции: `journal` — 8 абзацев (третий — ««Чего это не доказывает» — о чём событие молчит. Например, …», четвёртый — новый «Пометка «не подтверждена» значит: …», дальше прежние четыре); `tasks` — 5 абзацев (первый и четвёртый — новые слова Т1, пятый — «События одной задачи: нажмите «агент», а в карточке — «события в журнале».»); `states` — пункты 3 и 4 по Т1. Остальные проверки GD-04 прежние |
| GR-01 (1594; `T2.GUIDE_TEAM`, строки 300, 301) | REQ-051, кр. 1 | пункт 3 «… Без согласия проверяющего работа дальше не идёт — это ворота проверок.»; пункт 4 «… подтвердить объединение изменений или разрешить исключение из планки качества. …» | пункт 3 «… Без согласия проверяющего работа дальше не идёт.»; пункт 4 «… разрешить выпуск сделанных изменений или отступить от обязательных правил проверки. …» (Т2) |
| GR-02 (1625; `T2.GUIDE_ROLE_ABOUT`, строка 422) | REQ-051, кр. 2 | `RELEASE-FINALIZER` — «… Изменения попадают в основную версию только после вашего подтверждения.» | «Сохраняет изменения и пишет отчёт о выпуске. Изменения выпускаются только после вашего подтверждения.» |
| GR-03 (1700; `T2.GUIDE_GLOSSARY`, строки 454–517; `assert.equal(pairs.length, 16)` строка 1726) | REQ-051, кр. 3 | 16 пар; заголовок «… one dl of sixteen pairs …» | 18 пар Т2 («Запрос» после «Задача», «Номер запуска, номер разговора» после «Запуск»); `pairs.length` — 18; заголовок `test(` — «… one dl of eighteen pairs …» |
| TU-02 (2027; `T3.TOUR_STEPS`, строки 538, 555, 561) | REQ-052, кр. 2 | тексты шагов 1, 4, 5: «… Цель вы пишете в разговоре с Claude Code. …», «… покажет, что произошло и чего это не доказывает. …», «Список работы: элемент на каждый запуск агента и на каждый запрос основной сессии. …» | «… Что нужно сделать, вы пишете в Claude Code. …», «… покажет, что произошло и о чём событие молчит. …», «Список работы: по элементу на каждую задачу агента и на каждый ваш запрос. …» (Т3) |
| TU-03 (2121; та же `T3`) | REQ-052, кр. 3 | основной текст шагов 1, 4, 5 — прежний (через `T3`) | новый (та же правка `T3`); других правок нет |
| HN-01 (2524; `T4`, строки 585, 589, 591, 593) | REQ-053, кр. 1 | `HINT_CLOSE` «… нажмите мимо неё или Escape.»; `HINTS.journal`, `HINTS.tasks`, `HINTS.office` прежними словами | `HINT_CLOSE` «Закрыть подсказку: нажмите «?» ещё раз, нажмите в другом месте страницы или Escape.»; три подсказки — Т4 |
| JN-03 (`pixel-office-page.test.js` 5136; строки 5162, 5198) | REQ-046, кр. 1, 3 | ``Задача: ${name} a1-00001``; «Задача: Explore b1-00001» | ``Задача: ${name} номер a1-00001``; «Задача: Explore номер b1-00001» |
| JN-04 (5238; строки 5248, 5259) | REQ-046, кр. 4 | «Сессия <img src · с »; ``Задача: ${IMG} <img src`` | «Сессия номер <img src · с »; ``Задача: ${IMG} номер <img src`` |
| JN-05 (5281; строки 5323, 5331) | REQ-046, кр. 5 | ``Сессия ${longS.slice(0, 8)} · с ``; ``Задача: Explore ${longA.slice(0, 8)}`` | ``Сессия номер ${longS.slice(0, 8)} · с ``; ``Задача: Explore номер ${longA.slice(0, 8)}`` |
| MC-03 (5462; строка 5480) | REQ-047, кр. 2 | ``Задача: ${roleName(DES_ROLE)} a1-00001`` | ``Задача: ${roleName(DES_ROLE)} номер a1-00001`` |
| JR-01 (`pixel-office-panels.test.js` 3567; `EVENT_TABLE_LITERAL.handoff.meaning`, строка 3467) | REQ-045, таблица, случай 10 | «Тот, кто передал задание (основная сессия или другой агент), запустил агента, и Claude Code вернул номер запущенного агента. …» | «Агент может поручить часть работы другой роли. Эта строка — такое поручение: основная сессия или агент запустили агента этой роли. Описание написал тот, кто поручил (до 100 знаков). Если запустивший ждёт ответа, строка приходит после конца работы агента; если нет — сразу при запуске.» |
| AC-05 (4083; строки 4103, 4111, 4118, 4126, 4138) | REQ-044, кр. 4 | «… если событий нет дольше 60 минут, пишется «нет свежих данных»» (4103, 4126); «о других действиях агента — чтении файлов, командах, правках — Claude Code не сообщает» (4111); «Стол на холсте — изображение роли, общее для всех её запусков, а не компьютер. …» (4118); шаблон «если событий нет дольше {m} минут, пишется «нет свежих данных»» (4138) | «… если событий нет дольше 60 минут, страница пишет «нет свежих данных»: работа могла идти, но подтверждений нет»; «Что агент делает внутри — читает файлы, запускает команды, вносит правки, — Claude Code не сообщает.»; «Стол в офисе — просто место роли на рисунке. Настоящих компьютеров страница не показывает.»; шаблон с `{m}` тем же новым текстом |
| AC-06 (4229; строки 4321–4325) | REQ-051, кр. 8 (д); REQ-044, кр. 4 | `entry-note` раздела «Задание передано» карточки — значение `GIVEN_NOTE` «Эту запись пишет тот, кто передал задание. …» | `entry-note` — новое значение `GIVEN_NOTE` (= `EVENT_TABLE.handoff.meaning`) литералом, как в строке JR-01; проверка конца строки «Задание передано» и порядок — прежние (D19, r3) |
| JN-01 (4647; строки 4656, 4657, 4758) | REQ-046, кр. 1 | варианты ``Сессия S1 · с …``, ``Сессия S2 · с …``; пометка ``Задача: ${roleName(DESIGNER)} a1`` | ``Сессия номер S1 · с …``, ``Сессия номер S2 · с …``; ``Задача: ${roleName(DESIGNER)} номер a1`` |
| MC-01 (4959; строки 4981, 5094, 5095) | REQ-047, кр. 1 | «если событий нет дольше 60 минут, пишется «нет свежих данных»»; ``Сессия S2 · с …``, ``Сессия S3 · с …`` (другие сессии карточки) | «если событий нет дольше 60 минут, страница пишет «нет свежих данных»: работа могла идти, но подтверждений нет»; ``Сессия номер S2 · с …``, ``Сессия номер S3 · с …`` |
| LW-04 (5154; строки 5193, 5204, 5212, 5216, 5220, 5231–5232) | REQ-048, строки 13, 17, 20, 21, 22, 25 таблицы | `EVENT_TABLE.handoff.meaning` прежний (5193); `[TX.CARD_INSTANCE, "запуск"]` (5204); `WORKPLACE_DESK` «Стол на холсте…» (5212); `FRESH_LIMIT` «… пишется «нет свежих данных»» (5216); `AGENT_NOT_RECORDED` «о других действиях агента…» (5220); `GIVEN_NOTE` «Эту запись пишет тот, кто передал задание. …» (5231–5232) | новые значения тех же строк (как в строках JR-01 и AC-05 выше); `[TX.CARD_INSTANCE, "номер запуска"]`; `GIVEN_NOTE` — литерал «Агент может поручить часть работы другой роли. …» целиком, как в строке JR-01 (строка 25 REQ-048 после правки r4; D19, r3) |

Новыми тестами и дополнениями (не заменами) r2 проверяют TEST-DESIGNER: GR-06 (новый, кр. 8 REQ-051), TU-01 (строка о
туре, кр. 1 REQ-052), HN-01 (касание: `pointerenter` с `pointerType: "touch"` не открывает, фокус и нажатие закрепляют;
мышь — как прежде), HN-02 или HN-06 (правила `.hint-tip`: `pointer-events: none`, `position-try-fallbacks: flip-block`,
в узком `@media` — `none`; `.hint-close` без своих `font-size` и `color`), TU-07 (`.tour-x` в узком `@media` — 2,25 rem) —
раздел 13.8.

## 9. Ловушки для TEST-DESIGNER (мутанты, шаг 5; проверяет TEST-DESIGN-VALIDATOR)

1. В `escapeTarget` раскрытие строки раньше тура или подсказки — HN-01 (строка не закрылась), TU-08.
2. Справка «при фокусе внутри» после «Показать всех» перепутана — GD-03.
3. Справка или тур с `role="dialog"`/`aria-modal="true"` у справки, подложка — GD-02, TU-05.
4. `onKey` перехватывает Tab при открытой справке или туре — GD-02, TU-04.
5. Возврат фокуса при закрытии, когда фокус был вне справки или тура — GD-02, TU-04.
6. Справка открывается поверх карточки — GD-02.
7. Нет `fit` после открытия или закрытия — GD-03 (прямоугольники `#office-inner` меняются, ширина холста — нет).
8. Содержимое справки строится при каждом открытии (дубли разделов) — GD-06.
9. `getItem` с другим ключом, `setItem` со значением не `closed`, `removeItem`, вызов вне `try` — TU-09.
10. Исключение хранилища выходит наружу или убирает приглашение без записи — TU-01.
11. Приглашение при `closed`; нет приглашения после первой неудачи связи — TU-01.
12. Закрытие тура Escape или открытием справки не пишет `closed` — TU-05, TU-06.
13. Пометка не снимается при смене шага; две пометки — TU-03, TU-08.
14. Запасной текст шага 3 по числу строк, а не по `#now` — TU-03.
15. Шаг 5 считает только задачи (без строк основной сессии) — TU-03 (журнал с одной строкой основной сессии — основной текст).
16. `scrollIntoView` при каждом `refresh` — TU-05.
17. Фокус после «Далее» не по правилу — TU-04.
18. Закреплённая подсказка закрывается от `mouseleave`; нажатие внутри подсказки её закрывает; Escape переносит фокус — HN-01.
19. Тур не закрывает закреплённую подсказку — HN-01, TU-08.
20. `TASKS_EMPTY` при непустом списке и пустых «Текущих» — HN-05, PN-09 (заменённый).
21. `#office-note` до первого ответа или поверх `CANVAS_UNSUPPORTED` — HN-04.
22. Шаги пустого журнала при фильтре или без связи — HN-03.
23. Код `ROLE_NAMES` без группы молча пропущен — GR-02 (`roleTableProblems`).
24. `KEYS_TOUR`/`KEYS_HINT` не на своём месте — TU-06, HN-01.
25. Текст через разметку — GR-05, GD-07, команды.
26. `aria-expanded` не меняется — GD-02.
27. Новая строка с `px` или новый `@media` — SC-03, SC-05 (прежние).
28. `localStorage` в комментарии `boot.js` или второй строкой — TU-09 (а).

Ловушки 29–40 доработки r2 — раздел 13.7.

## 10. Что устаревает вне этого проекта (для DOC-UPDATER, до шага 9)

| Файл | Места | Новый смысл |
|---|---|---|
| `docs/design/REQ-048-049-046-047-interactive.md` | 3.10, строка `onKey` («Escape: окно истории → карточка → список «Показать всех» → раскрытие строки») | общий порядок Escape — раздел 4.1 этого проекта |
| `docs/design/REQ-036-044-045-interactive.md` | ф16 и строка 660 («PG-20 запрещает `localStorage`», «не пишет … хранилища браузера») | хранилище — только ключ тура по `decisions/0061`, п. 3 (TU-09) |
| `docs/design/REQ-001-pixel-office.md` | строка 203 («хранилища … у него нет») | то же |
| `docs/design/REQ-048-049-046-047-ui.md` | состав шапки, пустой журнал, `#office-note`, «Текущие» пустой панели | описание `docs/design/REQ-050-053-guide-ui.md` |
| `docs/design/REQ-048-049-046-047-ui.md`, `docs/design/REQ-048-049-046-047-interactive.md` (3.1) (r2) | голова карточки без описания роли; подписи «запуск», «сессия»; значения `FRESH_LIMIT`, `AGENT_NOT_RECORDED`, `WORKPLACE_DESK`, `MAIN_CARD.desk`, `TASK_MARK` («Задача: {role} {id}»), `FILTER_SESSION_OPTION` («Сессия {id} · с {time}»), `EVENT_TABLE.handoff.meaning` | раздел 13.3–13.4 этого проекта |
| `docs/design/REQ-036-044-045-interactive.md` (r2) | пояснение раздела «Задание передано» карточки — `GIVEN_NOTE` прежним текстом | `GIVEN_NOTE` = `EVENT_TABLE.handoff.meaning` (D19, r3) |

Файлы прогонов требований в статусе `done` — история, не правятся.

## 11. Раздел о планке (Q1–Q14, R1–R3)

| Пункт | Применим? | Как выполняется |
|---|---|---|
| Q1 | применим | работа привязана к REQ-050…REQ-053; у каждого критерия способ проверки — раздел 7 |
| Q2 | применим | проект проверяет CODE-DESIGN-VALIDATOR, код — SECURITY-REVIEWER и REVIEWER, тесты — TEST-DESIGN-VALIDATOR, приёмку — UAT-RUNNER, читатель без контекста и RELEASE-VALIDATOR своими запусками; факты раздела 1 — с командами для повтора |
| Q3 | применим | факты и числа прототипа — с командами и выводом (`self_check` handoff-а); о новом коде «работает» не утверждается; вид в браузере прототип не мерил (раздел 12, О4) |
| Q4 | применим | одна команда `cd tools && npm run check`; новые модули попадают в `format:check`, `lint`, `test` без правки команды |
| Q5 | применим | r2 — таблица 13.8 и замены раздела 8 «Доработка r2»; раздел 7: у каждого критерия тест или шаг приёмки, у каждого теста — критерий; тесты отказа проверяют неизменность (GD-03, GD-06, TU-05, TU-08, HN-06) |
| Q6 | применим | два теста заменяются по разделу 8, не удаляются, числа не меньше метки; SC-03, SC-05, PN-17, NM-07, OF-41, DQ-04 проходят без правки — проект подстроен под них (D15); экспорты не удаляются (D17); `skip` нет |
| Q7 | применим | тексты — `textContent` и атрибуты; в хранилище — только слово `closed`, без данных журнала; секретов в страницах нет; адресов нет |
| Q8 | неприменим | данных клиентов нет, Pixel Office — служебный инструмент (`decisions/0003`) |
| Q9 | неприменим | SQL нет |
| Q10 | применим | r2: касание у края окна, браузер без якорей или без `position-try-fallbacks`, окружение без таймера — 13.5;  внешних сервисов нет (страница ходит только на свой сервер); плохие условия — раздел 5: хранилище недоступно или бросает, связь потеряна, журнал заменён, 20 открытий, нет `scrollIntoView` — тесты GD-06, TU-01, TU-08, HN-06 |
| Q11 | неприменим | адресов от пользователя, по которым ходит сервер, нет; сервер не меняется |
| Q12 | применим | r2: D18–D26 записаны здесь; D18 — по `decisions/0061`, дополнение, последний пункт; с записью 0061 и требованиями после r4 расхождений нет (О7, О8 решены);  выборы требований — `decisions/0061` (п. 1–3 и дополнение); выборы проекта — раздел 2; спорные (фокус после «Не сейчас», приглашение раз за загрузку, прокрутка при появлении цели, `mouseleave` закрывает незакреплённую подсказку и при переходе мыши на неё) — раздел 12, О2, предложение записи; с `decisions/0002`, `0008` (D16), `0013`, `0014`, `0055`, `0059`, `0060` проект не расходится |
| Q13 | применим | находки о процессе — в `result.issues` (О1 — файлы замен по шаблонам критериев) |
| Q14 | применим | handoff закрывается в той же работе; статусы и `STATE.md` — DOC-UPDATER, шаг 10 |
| R1 | применим | мерж — только с подтверждения владельца (шаг 11) |
| R2 | применим | гайд ничего не добавляет в журнал, «Сейчас», панель, офис; тур и пустые состояния не рисуют примерных персонажей, строк, элементов — запасные тексты называют то, что видно; тексты сверены с кодом в требованиях; приёмка — только на стендах с вымышленными данными; событий Pixel Office проект не пишет |
| R3 | неприменим | продукт с фото снят (`decisions/0033`) |

## 12. Открытые вопросы и предложения записей

1. **О1 — файлы таблиц замен.** Критерий 10 REQ-052 ищет таблицу в `docs/design/REQ-052-*.md`, критерий 8 REQ-053 — в
   `docs/design/REQ-053-*.md`; `write_set` шага — только этот файл. Варианты: (а) ORCH разрешает дословные копии
   раздела 8 — `docs/design/REQ-052-guide-replacements.md` и `docs/design/REQ-053-guide-replacements.md` (как О1
   прошлого прогона); (б) ORCH решает, что общий проект прогона достаточен (как критерий 7 REQ-051), и уточняет текст
   критериев в WF-01. Решено: копии созданы по `decisions/0061`, дополнение (доработка r1).
2. **О2 — выборы проекта, которые можно оспорить** (предложение одной записи в `decisions/`): после «Не сейчас» и
   Escape в приглашении фокус — на «Как пользоваться» (требование не говорит); приглашение предлагается один раз за
   загрузку страницы (D10); при появлении цели шага во время тура страница прокручивается к ней (D11); незакреплённая
   подсказка закрывается и тогда, когда мышь уходит с «?» на саму подсказку (критерий 1 REQ-053 буквально).
3. **О3 — подсказка «Сейчас» и атрибут `title` блока.** У `#now` есть `title` (строка «Сейчас: …», REQ-042); браузер
   может показать его и при наведении на «?» внутри блока — рядом с подсказкой. Проект `title` не трогает; вид —
   DESIGN-QA (шаг 7) и, если мешает, вопрос GUI-DESIGN-ANALYST.
4. **О4 — прототип проверял контракт, видимый тестам, на поддельном DOM.** Вид, места подписи тура, прокрутка
   `scrollIntoView` внутри листа и полосы (элементы с `position: fixed`) и высоты в окнах — мерят DESIGN-QA и приёмка.
5. **О5 — вопросы описания:** 1 (порядок в узкой шапке) — принят `decisions/0061`, дополнение; 4 (пересчёт холста) —
   D7; 5 (порядок Tab при приглашении) — замен не нужно: GD-01 проверяет порядок без приглашения (разметка, `hidden`),
   TU-01 — с приглашением («4×», «Показать», «Не сейчас», «Как пользоваться»); 7 (SC-03, SC-05) — D15, замен нет.
6. **О6 — `makePage` по умолчанию без хранилища.** Требование предлагало «например» поддельное хранилище со значением
   `closed` по умолчанию; прототип показал, что прежние тесты проходят и с видимым приглашением, поэтому умолчание не
   меняется (больше проверки поведения без хранилища); новые тесты передают `storageFn` явно.
7. **О7 (r2) — решено (r3).** Строка 25 таблицы REQ-048 правлена (r4, ворота PASS): `GIVEN_NOTE` — то же пояснение, что
   `EVENT_TABLE.handoff.meaning`; проект — D19 (одна константа, вторая ссылается), LW-04 и AC-06 — новые литералы (раздел 8).
8. **О8 (r2) — решено (r3).** Дополнение `decisions/0061` (последний пункт) уточнено ORCH: слово «номер» — в карточках и
   в фильтрах журнала; проект с ним согласован.
9. **О9 (r2) — запас линии переходов карточки.** Проба ф28 при описании из 118 знаков и трёх запусках: запас 18,75 px
   (+61 мин). Описание задачи до 100 знаков или длинное название могут съесть запас; правило «первая фраза» (D18)
   включается, только если шаг 5а приёмки найдёт линию ниже края.
10. **О10 (r2) — строка о туре в узкой шапке.** `#tour-later` стоит на месте приглашения (то же правило `order`, своя
    линия) и короче его; рост шапки не больше прежних 4,6875 rem — мерит DESIGN-QA (описание, п. О-5.5).

## 13. Доработка r2 — понятность по пяти читателям, Ф2 (касание), 768 × 1024

### 13.1 Проверенные факты о текущем коде (рабочее дерево прогона, 18:35Z)

| № | Факт | Где | Чем проверено |
|---|---|---|---|
| ф19 | Копия рабочего дерева вне проекта: `node --test "test/pixel-office-*.test.js"` — `# tests 433 # pass 433`; числа `^test(` / `assert.`: docs 9/38, guide 32/519, hook 44/244, layout 19/210, note 7/103, office 61/602, page 114/1215, panels 55/1017, scale 7/48, server 72/346, settings 7/25 | `tools/test/` | прогон на копии; `grep -c` по файлам |
| ф20 | Подсказка открывается `mouseenter` и `focus`, закрывается `mouseleave` и `blur`, если не закреплена; у `.hint-tip` нет `pointer-events`; в узком `@media` подсказка у низа окна во всю ширину | `public/hints.js` (`mount`, слушатели); `public/style.css` (`.hint-tip`, узкое правило `#hint-now, #hint-journal, #hint-tasks, #hint-office`) | чтение; диагноз Ф2 (`step-08d-issue-fixer.json`): на касании браузер шлёт `mouseenter` до `click`, подсказка ложится на свою кнопку, `click` уходит общему предку |
| ф21 | Вне узкого `@media` подсказки «Сейчас», «Журнал», «Задачи» стоят под кнопкой (`top: calc(anchor(--hint-… bottom) + 0.375rem)`), «Офис и доска» — над ней; в 768 × 1024 «Журнал» и «Задачи» у низа выходят за окно | `style.css`, `#hint-now`…`#hint-office` | чтение; находка I3 диагноза |
| ф22 | Голова карточки запуска: `span.card-swatch`, `h3.card-title`, `p.card-ids` («`CARD_INSTANCE` <8 знаков> · `CARD_SESSION` <8 знаков>»); у карточки основной сессии — то же, `p.card-ids` с `CARD_SESSION` | `app.js`, `cardHead`, `mainCardTree` | чтение |
| ф23 | В разделе карточки «Задание передано» (`CARD_BLOCKS.given`) у каждой записи — `span.entry-note` с `GIVEN_NOTE`; `EVENT_TABLE.handoff.meaning` — в раскрытии строки журнала | `app.js`, `instanceParts`; `event-details.js` | чтение |
| ф24 | `TASK_MARK` — пометка фильтра «Задача» (`app.js`, `taskMarkText`); `FILTER_SESSION_OPTION` — варианты «Сессия» (`panels.js`, `journalOptions`) и подписи других сессий в карточке основной сессии (`main-card.js`, `sessionLabel`) | — | `grep -n` |
| ф25 | `tour.dismissInvite()` только пишет `closed`; разметка приглашения статична; `.tour-x` — 2 rem во всех окнах (приёмка: 32 px в узких) | `tour.js`; `index.html`; `style.css` | чтение; `step-08b-uat-runner.json` Ф1 |
| ф26 | `.hint-close` — свои `color: var(--muted)` и `font-size: 0.6875rem` | `style.css` | чтение |
| ф27 | Chrome 155 без окна, страница-проба вне проекта, окно 768 × 937: элемент `position: fixed` с `top: calc(anchor(--a bottom) + 0.375rem)` и `position-try-fallbacks: flip-block` у кнопки внизу встаёт над ней (767…897 при верхе кнопки 903), у кнопки вверху — под ней (130…260); при `pointer-events: none` `elementFromPoint` в точке кнопки — кнопка | — | `--dump-dom` пробы, вывод в `self_check` |
| ф28 | Проба на стенде вне проекта (пустой каталог, события только через `hook.sh`, номера `sample-`), 1470 × 784, код прототипа r2 с описанием роли: линия «к задаче в панели» / «события в журнале» у «Аудит сторонних пакетов» (самое длинное описание, 118 знаков, две строки, 39 px) и у «Проверка исследования и плана» (три запуска) целиком видна при прокрутке 0 — низ 715,75 и 716,75 px (+5 с), 735,25 и 736,25 px (+61 мин, `Date.now` подменён только в странице) при низе области прокрутки 755 px; без описания — 671 и 705,5 px | — | CDP-проба, вывод в `self_check`; журнал владельца не читался (число строк до и после — то же) |

### 13.2 Решения r2

| № | Решение | Почему |
|---|---|---|
| D18 | Описание роли — `p.card-about` сразу после `h3.card-title` в голове карточки запуска (текст `buildInstanceCard(...).about` = `roleAbout(role)`) и карточки основной сессии (`MAIN_ABOUT`); полное описание. Если приёмка (кр. 6, шаг 5а REQ-051) найдёт линию переходов ниже края в 1470 × 784, описание в карточке — первая фраза (до первой «.», за которой пробел или конец), полное — в справке (`decisions/0061`, дополнение, последний пункт) | кр. 8 (а) REQ-051; проба ф28 — линия видна, запас не меньше 18,75 px |
| D19 | (r3) Одна константа для «Задание передано»: `GIVEN_NOTE` в `texts.js` ссылается на `EVENT_TABLE.handoff.meaning` (тот же объект `texts.js`, объявлен выше) — значения равны всегда; карточка по-прежнему показывает `GIVEN_NOTE` (`app.js`, `instanceParts`, без правки); литерал LW-04 для `GIVEN_NOTE` — новый | кр. 8 (д) REQ-051; строка 25 таблицы REQ-048 после правки r4 (`step-01e`, комментарий 2026-10-17T18:42:01Z) |
| D20 | Строка о туре — статичный `div#tour-later.tour-later` (`aria-live="polite"`, пустой; пустой скрыт правилом `:empty` **только визуально**: вынесен из линии шапки `position: absolute`, нулевые `width` и `height`, без полей, рамки и фона, `overflow: hidden`; `display: none` и `visibility: hidden` не применяются, поэтому живая область есть в дереве доступности до появления текста — уточнено 2026-10-18, DOC-UPDATER, шаг 10, по правке `handoffs/REQ050-20261017-01/step-04a-code-fixer.json` к L1 ревью `step-04-reviewer-r1.json`; прежде — «пустой скрыт правилом `:empty`», что код делал через `display: none`) **перед** `#tour-invite`: приглашение остаётся непосредственно перед `#guide-open` (кр. 1 REQ-052, TU-01). `dismissInvite()` при видимом приглашении наполняет строку: `span.tour-later-text` (`TOUR_LATER_NOTE`) и кнопка «×» (`button.tour-later-x`, `aria-label` `TOUR_LATER_CLOSE`); через 10 000 мс (`env.setTimeoutFn`) или по «×» строка пустеет; фокус после «Не сейчас» и Escape в приглашении — на `#guide-open`; «×» — фокус на `#guide-open`; (r3) при очистке по таймеру фокус, бывший внутри строки (на её «×»), — на `#guide-open`, иначе на месте. Новое `dismissInvite` гасит прежний таймер и наполняет строку заново; (r3) `open()` (тур — из приглашения или справки) очищает строку вместе с таймером: тур и строка о нём вместе не видны. В порядке Escape строки нет (кр. 3 REQ-050 не менялся). Текст строки — `span.tour-later-text` шириной до 17 rem: в окнах от 600 px он идёт в две строки с полями внутри блока 2,75 rem (при 12 rem шёл в три — DESIGN-QA r1, M1; правка `step-08g-code-fixer.json`; уточнено 2026-10-18, DOC-UPDATER, шаг 10); в 320 × 568 — три строки | кр. 1 REQ-052, Т3; живая область существует до наполнения — читалка озвучивает текст |
| D21 | Наведение открывает и закрывает подсказку только мышью: кнопка запоминает `pointerType` последних `pointerenter`/`pointerdown`; `mouseenter`/`mouseleave` действуют, если запомненного нет или он `"mouse"`. `focus`, `blur`, `click` — прежние | Ф2; кр. 1 REQ-053 называет `mouseenter` — слушатель остаётся, поддельный DOM без `pointerType` ведёт себя как мышь |
| D22 | `.hint-tip { pointer-events: none }` во всех окнах | Ф2: касание приходит на кнопку, закрепление работает; закреплённая подсказка у низа больше не перекрывает касания (I1 (г) диагноза); в подсказке нет нажимаемого |
| D23 | `.hint-tip { position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }`: в окнах вне узкого `@media` подсказка, которой не хватает места под кнопкой, встаёт над ней («Офис и доска» — наоборот); если не хватает места справа — кончается у правого края своей кнопки (`flip-inline`; в 768 × 1024 подсказка «Сейчас» иначе выходила за правый край окна: 508–796 при ширине 768, с `flip-inline` — 244–532); `flip-inline` добавил FRONTEND-DEV на подшаге 2g (`step-02g-frontend-dev.json`, I1), отступление принято ORCH (`orch_check` 2g и ревью r1; уточнено 2026-10-18, DOC-UPDATER, шаг 10; прежде здесь стоял только `flip-block`); в узком `@media` — `position-try-fallbacks: none` (там подсказка у низа окна). Места без якорей — прежние постоянные | находка 768 × 1024; проба ф27; HN-02 (якорь и «сначала простое значение») не меняется |
| D24 | `.hint-close` без своих `color` и `font-size` — наследует текст подсказки (`--text`, 0,75 rem); отступ сверху прежний | кр. 1, 6 REQ-053 (тот же размер и цвет, контраст 11,72 : 1) |
| D25 | `.tour-x` в узком `@media` — 2,25 × 2,25 rem | кр. 7 REQ-052, Ф1 приёмки |
| D26 | Новые значения констант — раздел 13.3; имена прежние, экспорт не удаляется (`decisions/0059`, п. 1) | — |

### 13.3 `texts.js` — значения r2 (дословно по требованиям; литералы прототипа сверены с `docs/requirements.yaml`)

| Константа | Было | Стало |
|---|---|---|
| `GUIDE_SECTIONS` | `journal` 7 абзацев, `tasks` 4, `states` пункты 3, 4 прежние | Т1 текущей редакции: `journal` 8, `tasks` 5, `states` пункты 3, 4 новые (раздел 8, строка GD-04) |
| `GUIDE_TEAM` | пункты 3, 4 с «ворота проверок», «объединение изменений», «планки качества» | Т2 (раздел 8, строка GR-01) |
| `GUIDE_ROLE_ABOUT["RELEASE-FINALIZER"]` | «… попадают в основную версию …» | «… Изменения выпускаются только после вашего подтверждения.» |
| `GUIDE_GLOSSARY.pairs` | 16 | 18 (Т2) |
| `TOUR_STEPS[0].text`, `[3].text`, `[4].text` | прежние | Т3 (раздел 8, строка TU-02) |
| `TOUR_LATER_NOTE`, `TOUR_LATER_CLOSE` | — | «Тур можно открыть позже: «Как пользоваться» → «Показать тур по странице».», «Скрыть подсказку о туре» |
| `HINT_CLOSE`, `HINTS.journal`, `HINTS.tasks`, `HINTS.office` | прежние | Т4 |
| `ROLE_ABOUT_UNKNOWN`, `MAIN_ABOUT` | — | «Описания этой роли нет: так её назвал Claude Code.», «Ваш разговор с Claude Code. Он принимает ваши сообщения и запускает агентов.» |
| `CARD_INSTANCE`, `CARD_SESSION` | «запуск», «сессия» | «номер запуска», «номер разговора» |
| `WORKPLACE_DESK`, `MAIN_CARD.desk` | «Стол на холсте — изображение …» | «Стол в офисе — просто место роли на рисунке. Настоящих компьютеров страница не показывает.»; «Стол в офисе — просто место основной сессии на рисунке. Настоящих компьютеров страница не показывает.» |
| `AGENT_NOT_RECORDED` | «о других действиях агента — …» | «Что агент делает внутри — читает файлы, запускает команды, вносит правки, — Claude Code не сообщает.» |
| `FRESH_LIMIT` | «если событий нет дольше {m} минут, пишется «нет свежих данных»» | «если событий нет дольше {m} минут, страница пишет «нет свежих данных»: работа могла идти, но подтверждений нет» |
| `EVENT_TABLE.handoff.meaning` | «Тот, кто передал задание …» | «Агент может поручить часть работы другой роли. …» (раздел 8, строка JR-01) |
| `TASK_MARK`, `FILTER_SESSION_OPTION` | «Задача: {role} {id}», «Сессия {id} · с {time}» | «Задача: {role} номер {id}», «Сессия номер {id} · с {time}» |
| `GIVEN_NOTE` | «Эту запись пишет тот, кто передал задание. …» | ссылка на `EVENT_TABLE.handoff.meaning` — то же значение (D19, r3) |

### 13.4 Функции по файлам (r2)

| Файл | Сигнатура / место | Правило |
|---|---|---|
| `words.js` | `roleAbout(role) → string` (новая, чистая) | роль вида «Sai … (КОД)» (то же выражение, что у `roleName`), код есть в `ROLE_NAMES` и в `GUIDE_ROLE_ABOUT` → `GUIDE_ROLE_ABOUT[код]`; иначе (другая роль, пустая, не строка) → `ROLE_ABOUT_UNKNOWN`; не бросает |
| `instance-card.js` | `buildInstanceCard` — новое поле `about: string` | `roleAbout(task.role)` |
| `app.js` | `cardHead(data)` | после `h3.card-title` — `p.card-about` с `data.about` (D18); остальное прежнее |
| `app.js` | `mainCardTree` | после `h3.card-title` — `p.card-about` с `MAIN_ABOUT` |
| `app.js` | создание `tour` | в `deps` — `setTimeoutFn`, `clearTimeoutFn` из `env`; `tour.mount({ invite, box, later: byId("tour-later") })` |
| `tour.js` | `createTour` — `deps.setTimeoutFn`, `deps.clearTimeoutFn`; `mount({ invite, box, later })`; `dismissInvite()`; `open()` — очистка строки и таймера (r3) | D20; константа модуля `TOUR_LATER_MS = 10000`; без функции таймера строка остаётся до «×» (тесты дают поддельные часы) |
| `hints.js` | слушатели `pointerenter`, `pointerdown` на кнопке; условие у `mouseenter`, `mouseleave` | D21 |
| `index.html` | в шапке после `div.controls` — `div#tour-later.tour-later` с `aria-live="polite"`, затем `#tour-invite`, `#guide-open` | D20 |
| `style.css` | `.card-about` (0,8125 rem / 1,5, `--text`, отступ сверху 0,25 rem), `.tour-later` (`:empty` — скрыта визуально, без `display: none`, D20; вид — описание, п. О-5.5), `.tour-later-x`, `.hint-tip` (`pointer-events: none`, `position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline` — D23; уточнено 2026-10-18, DOC-UPDATER, шаг 10, прежде здесь стояло «`:empty` — `display: none`» и только `flip-block`), узкое правило подсказок (`position-try-fallbacks: none`), `.hint-close` (без `color`, `font-size`), `.tour-x` в узком `@media` (2,25 rem) | D15 по-прежнему: ни одной строки с `px`, ни одного нового `@media` |
| `tools/README.md` | раздел «## Pixel Office», подраздел о справке | описание роли под названием в карточке, подписи «номер запуска», «номер разговора» (кр. 7 REQ-051); строка о туре после «Не сейчас»; подсказка на касании (кр. 8 REQ-053 — «как открыть … касанием») |

Сервер, хук, `schema.js`, `model.js`, `panels.js`, `main-card.js`, `event-details.js`, `guide-model.js`, `guide.js` в r2
не меняются (новые значения констант они берут из `texts.js`).

### 13.5 Пути отказа r2

| Случай | Что видит человек | Что не меняется |
|---|---|---|
| роль вне таблицы, пустая, `<img …>` | под названием карточки — `ROLE_ABOUT_UNKNOWN` текстом | элементов не создано |
| касание «?» у нижнего края (390, 320) | подсказка открыта и закреплена; второе касание закрывает; касание в другом месте закрывает | нажатое под подсказкой получает касание (подсказка их не принимает) |
| устройство без `pointerType` (поддельный DOM, старый браузер) | наведение — как мышь (прежнее поведение) | — |
| браузер без якорей или без `position-try-fallbacks` | подсказка на прежнем постоянном месте или под кнопкой | — |
| нет `setTimeoutFn` в окружении | строка о туре остаётся до «×» | — |
| «Не сейчас» без хранилища | строка о туре, приглашение не вернётся до перезагрузки | — |
| линия переходов карточки ниже края в 1470 × 784 на приёмке | описание — первая фраза (D18) | кнопки видны без прокрутки (`0060`) |

### 13.6 Подшаги доработки (CODE-FIXER) и ожидаемые красные (проверено прототипом)

Прототип — копия рабочего дерева вне проекта (кроме `node_modules`), правки по 13.2–13.4, во временном каталоге;
рабочее дерево не менялось. Проверка каждого подшага — как в разделе 6; всего **433** теста.

| Подшаг | Что | Файлы | Красные после подшага (накопительно) |
|---|---|---|---|
| 2f | тексты, карточка, строка о туре, «×» тура, вид строки закрытия подсказки | `texts.js` (13.3), `words.js`, `instance-card.js`, `app.js`, `tour.js`, `index.html`, `style.css` (`.card-about`, `.tour-later`, `.tour-later-x`, `.tour-x` в узком, `.hint-close`), `tools/README.md` | **17**: GD-04, GR-01, GR-02, GR-03, TU-02, TU-03, HN-01 (`pixel-office-guide.test.js`); JN-03, JN-04, JN-05, MC-03 (`pixel-office-page.test.js`); JR-01, AC-05, AC-06, JN-01, MC-01, LW-04 (`pixel-office-panels.test.js`) — все по литералам (раздел 8, «Доработка r2») |
| 2g | Ф2 и 768 × 1024 | `hints.js` (D21), `style.css` (`.hint-tip` — D22, D23; узкое правило — `none`) | те же **17** (новых нет) |

Прототип: после 2f — `# tests 433 # pass 416 # fail 17`; после 2f+2g — тот же список; с заменами раздела 8 — `# tests
433 # pass 433`. Проверочный тест прототипа (вне проекта, удалён) на поддельном DOM: касание (`pointerenter` с `pointerType:
"touch"`, `mouseenter`, `pointerdown`, `mousedown`) подсказку не открывает, `focus` и `click` открывают и закрепляют,
`mouseleave` не закрывает, второй `click` закрывает, `pointerenter` мыши + `mouseenter` открывает, `mouseleave` закрывает;
«Не сейчас» и Escape в приглашении — строка `TOUR_LATER_NOTE` с `aria-live="polite"`, фокус на `#guide-open`, через 9 с
строка есть, через 11 с — пуста; карточка «Проверка безопасности» — после заголовка `GUIDE_ROLE_ABOUT["SECURITY-REVIEWER"]`,
строка номеров начинается с «номер запуска ». Все тексты r2 — правило правды и понятности (ворота r3 и сверка
литералов).

После кода: шаг 5 — TEST-DESIGNER (замены раздела 8 «Доработка r2»; новый GR-06; дополнения TU-01, HN-01, HN-02/HN-06,
TU-07 — 13.8), 5b, 6 — как в разделе 6; затем DESIGN-QA (касание, 768 × 1024, «×» тура, строка о туре, карточка) и новые
читатели.

### 13.7 Ловушки r2 (дополняют раздел 9)

29. `.hint-tip` без `pointer-events: none` или с `auto` в узком `@media` — правило CSS (HN-02/HN-06, дополнение); в браузере — повтор сценария 26 (DESIGN-QA, приёмка).
30. `mouseenter` открывает подсказку при касании (`pointerType: "touch"`) — HN-01 (дополнение).
31. Наведение мыши перестало открывать (условие D21 перевёрнуто) — HN-01 (прежние проверки `mouseenter`).
32. Подсказка у низа окна 768 × 1024 выходит за край (`position-try-fallbacks` нет или `none` вне узкого) — правило CSS; замер DESIGN-QA.
33. Описание роли не сразу после заголовка, в раскрытии или код роли вместо описания — GR-06.
34. Роль вне таблицы получает чужое описание или пустую строку — GR-06 (`Explore`, пустая роль, `<img>`).
35. Строка о туре не появляется после Escape в приглашении, без `aria-live`, не уходит через 10 с, фокус не на `#guide-open` — TU-01 (дополнение).
36. Строка о туре появляется после закрытия тура (а не только после приглашения) — TU-01 (дополнение).
36а. (r3) «Не сейчас», затем до 10 с тур из справки («Как пользоваться» → «Показать тур по странице»): строка остаётся до «×» — TU-01 (дополнение: сразу после открытия тура строки нет и через 10 с нет).
36б. (r3) Строка уходит по таймеру при фокусе на её «×», фокус теряется — TU-01 (дополнение: фокус на `#guide-open`).
37. `#tour-later` между `#tour-invite` и `#guide-open` — TU-01 (прежняя проверка «непосредственно перед»).
38. `GIVEN_NOTE` прежним значением или своей копией текста, разошедшейся с `EVENT_TABLE.handoff.meaning` — AC-06, LW-04 (заменённые), GR-06.
39. «номер» в пометке «Задача» или вариантах «Сессия» пропал — JN-01, JN-03 (заменённые), GR-06.
40. `.hint-close` со своим бледным цветом или мелким шрифтом — правило CSS (HN-06, дополнение).

### 13.8 Критерии r2 → элемент → тест

| Требование, критерий | Что | Элемент | Тест | Падает, если |
|---|---|---|---|---|
| REQ-050, кр. 4 (Т1 r2) | литералы Т1, правило правды, понятность | 13.3 | GD-04 (заменённый) | текст не Т1 |
| REQ-051, кр. 1–4 (Т2 r2) | пункты 3, 4, `RELEASE-FINALIZER`, 18 пар словаря | 13.3 | GR-01, GR-02, GR-03 (заменённые), GR-04 (без правки) | — |
| REQ-051, кр. 6, шаг 5а | описание и линия переходов в 1470 × 784, оба момента | D18 | приёмка (`docs/uat/REQ-051*`), проба ф28 | линия ниже края |
| REQ-051, кр. 7 | README — описание роли, «номер запуска», «номер разговора» | 13.4 | DC-04 (прежний, фраза «Роли команды») + чтение README приёмкой | — |
| REQ-051, кр. 8 (новый) | (а) описание под заголовком, `ROLE_ABOUT_UNKNOWN`, `MAIN_ABOUT`; (б) «номер запуска … · номер разговора …»; (в) фразы о столе; (д) три фразы; (е) «номер» в журнале; (г) — шаг 5а | D18, D19, 13.3, 13.4 | GR-06 (новый) | описание не там, прежняя фраза |
| REQ-052, кр. 1 | строка о туре после «Не сейчас» и Escape, `aria-live`, 10 с, «×», фокус; (r3) `open()` убирает строку, фокус после очистки по таймеру | D20 | TU-01 (дополнение) | строки нет, фокус не там |
| REQ-052, кр. 2, 3 (Т3 r2) | тексты шагов 1, 4, 5 | 13.3 | TU-02, TU-03 (заменённые) | — |
| REQ-052, кр. 7 | «×» не ниже «Пауза», в узких ≥ 2,25 rem | D25 | TU-07 (дополнение, правило CSS) + шаг 6 приёмки | «×» 2 rem |
| REQ-053, кр. 1 | Т4 r2; касание открывает и закрепляет; наведение — мышь | D21, D22 | HN-01 (заменённый и дополненный) | касание не закрепляет |
| REQ-053, кр. 2 | подсказка целиком в окне, в том числе 768 × 1024 у края | D23 | HN-02 (дополнение: `position-try-fallbacks`) + замер DESIGN-QA | выходит за окно |
| REQ-053, кр. 6 | `HINT_CLOSE` того же размера и цвета, контраст ≥ 4,5 | D24 | HN-06 (дополнение) | бледная строка |
| REQ-044, кр. 3, 4, 10; REQ-045, случай 10; REQ-046, кр. 1, 6; REQ-047, кр. 1; REQ-048, строки 13, 17, 20–22, кр. 7 | новые значения констант в карточках, журнале и фильтрах | 13.3, 13.4 | AC-05, AC-06, JR-01, JN-01, JN-03, JN-04, JN-05, MC-01, MC-03, LW-04 (заменённые); GR-06 | прежний литерал |
