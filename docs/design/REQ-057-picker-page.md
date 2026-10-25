# REQ-057 — проект кода: страница-карточка арендатора и анкета для посетителя (сайт подбора, часть 4)

Прогон `PAGE057-20261021-01`, WF-02, шаг 1b (handoff `step-01b-code-designer.json`). Автор — CODE-DESIGNER, 2026-10-21 (по часам `date -u`: handoff начат 12:58:41Z). Проверяет — CODE-DESIGN-VALIDATOR. Метка базы — `base/PAGE057-20261021-01` (= `HEAD` f40ef56; в дереве к моменту записи — файлы этого прогона: `decisions/0077`, `docs/design/REQ-057-picker-page-ui.md`, папка прогона — и две учётные правки соседних прогонов, Ф1).
Требование — блок `REQ-057` в `docs/requirements.yaml` (11 критериев); вид — `docs/design/REQ-057-picker-page-ui.md` (15 разделов, далее «описание»); записи — `decisions/0065`, `0069`–`0077`, `0061`, `0002`. Кода реализации здесь нет: модули, сигнатуры, формы данных, таблицы, правила, тесты. Примеры вымышлены.

Не входит: страница результата (REQ-058; здесь — только место стыка, п. 4.9), заявка (REQ-059), совет ИИ (REQ-063), ход работ заказчику (REQ-064…067), любые правки сервера и движка.

## 0. Кратко

1. **Страница — тринадцать файлов `tools/src/picker/public/`** (п. 3): `index.html`, `page.css`, `texts.js` (правится), `say.js`, `rules.js`, `flow.js`, `store.js`, `net.js`, `dom.js`, `screens.js`, `result.js`, `app.js`, `main.js`. ES-модули без сборки; в `index.html` нет встроенных скриптов и стилей (CSP); один вызов `fetch(` на всю страницу — в `request(path, init)` файла `net.js`; `stub.js` и ключ `page_stub_notice` удаляются.
2. **Правило видимости вопросов (главный выбор, п. 6).** `engine.js` на страницу не попадает и не меняется. Страница получает **собственную копию правила** в `rules.js` (≈60 строк: `checkAnswer`, `visibleIds`), а равенство с движком держит тест `QM-1`: на 1 000 000 и более наборов ответов (6 видов демо-файлов и 300 сгенерированных файлов, мусорные значения, `id` вопросов `constructor`, `toString`, `valueOf`) список видимых вопросов и причина отказа ответа те же, что у `engine.js`. На прототипе: 1 224 000 наборов, расхождений 0; из 14 мутантов правила 13 убиты, один равнозначный (п. 6.4). Вариант «API» отвергнут (новый маршрут, запрос на каждый ответ, п. 6.2).
3. **Чистые функции отдельно от документа** (п. 4): `rules.js`, `flow.js`, `say.js`, `store.js`, `net.js` не трогают `document` — их проверяют тесты Node напрямую; экраны (`screens.js`) и управление (`app.js`) — тесты на модели документа `picker-page-dom.js` с подменой `fetch`, `localStorage`, `location`, `history`.
4. **Прогресс.** `N` считается по правилу описания и решения `0077`, п. 4 («не дошёл» = «не выше текущего»). Измерено: на обоих демо-арендаторах по 200 путям вперёд `N` не растёт, в конце `K = N`; на маленьком файле из шести вопросов таблица `K`, `N` записана литералами (п. 5.3, тест `QP-3c`). **Найден случай, где буквальное правило даёт `K < N` в конце** (последний видимый вопрос не последний в файле, от него зависят скрытые ниже): вопрос О1 к ORCH с предложением (п. 5.3, п. 24).
5. **Хранилище** `sai-picker:<id>`: одно значение `{format, version, lang, current, answers}`; чтение проверяет каждое поле и не бросает; три операции — `getItem`, `setItem`, `removeItem` одного ключа; любое исключение выключает «сохранено» до конца жизни страницы, и текст связи меняется на «ответы пока только здесь» (п. 7).
6. **Охранные тесты прежних требований.** Прототип и поиск нашли **шестнадцать мест в семи файлах**, которые нужно менять (п. 13), и один охранный тест, которого нет в требовании: **`LG-10c`** (REQ-061) запрещает `fetch(` в любом файле `public/` — он краснеет от `net.js` (ловушка AP-068). Красных тестов после удаления заглушки и добавления сетевого файла — ровно 8: `LG-10c`, `TR-4b`, `TR-4e`, `SU-10`, `SU-11`, `SV-1f`, `SV-7e`, `SF-6c`; после таблицы — `npm run check` код 0, 1898 из 1898, число проверок то же.
7. **Блок `eslint` для `public/` уже есть** (его добавил REQ-056, подшаг 56b): `eslint.config.js` не меняется, а критерий 10 в части «`git diff` показывает добавленный блок» не выполним буквально (п. 1, Ф4; вопрос О4).
8. **Значок страницы** (`decisions/0077`, п. 9; ISS-0081, п. 5): объявленный значок невозможен без правки сервера — `data:` нарушает `img-src 'self'` (измерено в Chrome 155: строка `error` в консоли), а сервер отдаёт только `.html`, `.js`, `.css`. Выбран второй вариант решения: **исключение для `/favicon.ico` в шагах приёмки** (п. 12), вопрос О3.
9. **Результат до выпуска REQ-058.** Страница после «Показать результат» и ответа 200 открывает **временный экран** `result.js` (заголовок, «Назад», «Начать заново», новый ключ `result_soon`); REQ-058 заменяет файл целиком. Вопрос О2 (п. 4.9).
10. **Мутантов 92** (п. 20): 23 применены к прототипу и убиты, остальные привязаны к тестам. **Подшагов пять** (п. 21), красных между подшагами названо заранее.

## 1. Проверенные факты

Копии для запусков лежат в рабочей папке сессии вне проекта (`<scratch>/p057/base` — свежий `git clone --no-hardlinks` метки; `<scratch>/p057/work` — прототип; `tools/node_modules` — ссылка на установленную). Прототип — страница в объёме, достаточном для проверки тестов и браузера (карточка, один вопрос, правило, прогресс, сеть, тексты), и таблица замен п. 13; в проект он не входит.

| № | Утверждение | Команда | Вывод |
|---|---|---|---|
| Ф1 | Метка есть и равна `HEAD`; копия чистая | `git rev-parse HEAD; git rev-parse base/PAGE057-20261021-01; git status --short` (свежая копия) | оба хеша `f40ef5630661eb6ef17a02dd237e08bd6094786b`; список правок пуст. В проекте к моменту записи — `M decisions/README.md`, `M handoffs/PICKERTEXT-20261021-01/step-02c-req-validator.json`, `?? decisions/0077…`, `?? docs/design/REQ-057-picker-page-ui.md`, `?? handoffs/PAGE057-20261021-01/` — к метке они не относятся |
| Ф2 | Основа зелёная | `cd <scratch>/p057/base/tools && npm run check` | код 0; `# tests 1898`, `# pass 1898`, `# fail 0`, `# skipped 0`, `# todo 0`; `traces: файлов проверено 1948, следов 0, пропущено 60`; `handoffs-check: файлов проверено 1090, нарушений 0`; 2 мин 6 с (число файлов `traces` зависит от копии) |
| Ф3 | Что лежит в `public/` сейчас | `wc -l tools/src/picker/public/*; node -e` (импорт `texts.js`) | `index.html` 12 строк (`main#app`, скрипт `/assets/stub.js`), `stub.js` 13, `texts.js` 107; в `TEXTS` 13 ключей (`language_switcher_label`, 11 `server_*`, `page_stub_notice`); экспортов ровно пять: `DEFAULT_LANGUAGE`, `LANGUAGES`, `LANGUAGE_NAMES`, `TEXTS`, `chooseLanguage` (TX-6a держит этот список закрытым — вспомогательная функция подстановки живёт в другом файле, п. 4.2) |
| Ф4 | **Блок `eslint` для `public/` уже есть** | `sed -n 17,40p tools/eslint.config.js` | третий блок `{ files: ["src/picker/public/**/*.js"], languageOptions: { globals: { ...globals.browser } } }` (строки 30–35 файла в 36 строк); значит `git diff base/<RUN-ID> -- tools/eslint.config.js` в этой работе пуст, и критерий 10 («показывает только добавленный блок») в этой части не выполним буквально; браузерные глобальные имена, нужные странице (`document`, `location`, `history`, `localStorage`, `fetch`, `AbortSignal`, `URLSearchParams`, `scrollTo`), в `globals.browser` есть |
| Ф5 | Ветка `TR-4e` для страницы подбора уже есть | `sed -n 247,296p tools/test/traces-runtime.test.js` | функция `pickerPageProblems`: ровно один `fetch(` внутри `async function request(path, init) {` (конец — первый `\n}\n` после), константы `API_*` — относительные адреса без схемы и без «//», нет `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `new URL(`, `location.origin`, `importScripts`; самопроверка: одна верная страница и семь испорченных. `NETWORK_FILES` (строки 10–19) — 8 имён, из подбора только `picker/server.js` |
| Ф6 | Что ещё считает файлы `public/` (поиск `grep -n "public" tools/test/*.test.js`) | `grep -n 'PUBLIC_DIR\|"public"\|public/' tools/test/picker-*.js tools/test/traces-runtime.test.js` | `SV-1d`, `SV-1f` (имена, расширения, байты), `SV-7a` (счёт открытий файлов), `SV-7g` (разметка `index.html`: у каждого `<script>` есть `src`, нет `<style>`, `style=`, `on…=`, каждый `src`/`href` начинается с `/assets/`, хотя бы один `<script>`), `SV-7h` (в `.js`, `.html`, `.css` нет `http://` и `https://`, файлов не меньше трёх), `TR-4d` (адреса сетевых файлов), `TR-4f`, `TX-6a`…`TX-6f`, `LG-4c`, `LG-10d` (чистота `texts.js`) и **`LG-10c`** (`picker-lang.test.js:1608`): в **каждом** `.js` файле `public/` нет слов `http://`, `https://`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `child_process`, `Math.random` — **комментарии тоже**. `LG-10c` не назван в требовании: страница с одним `fetch(` его краснит (Ф8) |
| Ф7 | Где ссылаются на заглушку | `grep -rn "stub\|page_stub_notice" tools/src tools/test` (кроме `pixel-office-*`) | 22 строки в 7 файлах и сам `stub.js`: `picker-server-helpers.js:92`; `picker-server-units.test.js:3, 176, 618, 622–623, 631, 685–686, 714, 717`; `picker-server.test.js:310, 1621, 1871`; `picker-server-faults.test.js:273, 300, 887, 893`; `picker-server-property.test.js:49, 83`; `public/index.html:10`, `public/stub.js`, `public/texts.js:78`. Требование называет `SU-10`, `SU-11`, `SV-1f`, `SV-7a`, `SV-7e`, `SP-1`, `SP-2`, сбои чтения файла (`SF-6h`) и «`SF-*`»; поиск добавляет `SU-2` (строка 176), `SF-6c` (300), `SF-6o` (273), `SF-6g` (844: счёт ключей таблицы, станет красным после правки таблицы) и заголовок файла `picker-server-units.test.js` (строка 3) |
| Ф8 | Красные существующие тесты на прототипе (`node --test test/picker-*.test.js test/traces-runtime.test.js`, 276 тестов) | три запуска на свежих копиях метки | **(а)** только сетевой файл `net.js` добавлен (заглушка на месте): красных 3 — `LG-10c`, `TR-4b`, `TR-4e`; **(б)** страница (прототип: `main.js`, `net.js`, `rules.js`, `flow.js`, `page.css`) поставлена и заглушка удалена (`stub.js`, ключ `page_stub_notice`, скрипт в `index.html` заменён), таблица замен ещё не применена: красных 8 — `LG-10c`, `SF-6c`, `SU-10`, `SU-11`, `SV-1f`, `SV-7e`, `TR-4b`, `TR-4e`; **(в)** только удалена заглушка, новой страницы нет: красных 7 — `SF-6c`, `SU-10`, `SU-11`, `SV-1f`, `SV-7e` и ещё `SV-7g`, `SV-7h` (в `index.html` не осталось `<script>`, файлов меньше трёх) — поэтому заглушку удаляют **последним подшагом**, когда страница уже стоит (п. 21). `SV-7a`, `SU-2`, `SP-1`, `SP-2`, `SF-6o`, `SF-6h` от удаления не краснеют (`SV-7a`: отказ по `Host` приходит раньше поиска файла; `SU-2`, `SP-1`: чистая функция маршрутов; `SP-2`: допускает 404; `SF-6o`: папка пуста; `SF-6h`: сбой внедрён по пути, а не по существующему файлу — проверка остаётся зелёной, но проверяет уже не то) — их строки всё равно меняются: требование ищет ссылки на `stub.js` поиском (критерий 11) |
| Ф9 | Таблица замен п. 13 на прототипе | `cd <scratch>/p057/work/tools && node --test test/picker-*.test.js test/traces-runtime.test.js`; затем `npm run check` | 276 из 276; затем код 0, `# tests 1898`, `# pass 1898`, `# fail 0`, `# skipped 0`, `# todo 0`; `traces: файлов проверено 1953, следов 0`; `handoffs-check: нарушений 0`; число `test(` в каждом файле то же. Поиски критериев 10 и 11 на прототипе: `grep -rn 'stub.js' tools/src tools/test` — пусто (код 1); `grep -rn 'stub' tools/src/picker/public/*.html` — пусто; `grep -rnE 'alert[(]\|confirm[(]\|prompt[(]\|showModal\|beforeunload' tools/src/picker/public/` — пусто; `grep -rnE 'fetch[(]' tools/src/picker/public/` — одна строка (`net.js`); `grep -rnE 'https?://' tools/src/picker/public/` — пусто; `grep -rn page_stub_notice tools` (без `node_modules`) — пусто |
| Ф10 | Сеть из страницы | Chrome 155 на `serve --port 0`, `fetch` из страницы `/t/uchet-pro/` | `POST api/result?lang=en` без `mode` и `referrerPolicy`, с `signal: AbortSignal.timeout(20000)`: 200, ключи `clear_leader,recommended,no_match_text,hypotheses`; ответы `{"x":1}` — 400 `answers_invalid`; соединение отвергнуто — `TypeError: Failed to fetch`; адрес вне `'self'` — запрет CSP (`connect-src`); любой ответ 4xx браузер пишет в консоль строкой `error` (**нормально для проверки отказов, ошибкой страницы не считается**, AP-117) |
| Ф11 | Хранилище и адрес | та же проба | `localStorage.setItem/getItem/removeItem` работают (ключ `sai-picker:uchet-pro`); `history.replaceState(null, '', location.pathname + '?lang=kk')` меняет адрес без перезагрузки и без новой записи; `AbortSignal.timeout` — функция |
| Ф12 | Карточка и вопрос рисуются | Chrome 155, окно 390 × 844 (метрики устройства через DevTools), `serve --port 0`, прототип, `?lang=kk` | документ: `lang="kk"`, `title="Учёт-Про"`; текст карточки: название, вступление, `card_gives`, `card_ask`, «Сұрақтар: 8 бастап 12 дейін», кнопка; `scrollWidth` 390 = `clientWidth` 390; клик по `[data-action=start]` — на экране форма, `document.activeElement` = `H2` с текстом первого вопроса, переключателей 3; запросы: страница, `page.css`, `main.js`, `texts.js`, `net.js`, `rules.js`, `api/questionnaire?lang=kk`, `favicon.ico` (404) |
| Ф13 | Значок | та же проба, три варианта `<link rel="icon">` | без значка: консоль `error network: Failed to load resource … 404 … /favicon.ico`; `href="data:,"` и `href="data:image/svg+xml,…"`: консоль `error security: Loading the image 'data:,' violates … "img-src 'self'"` (хуже — нарушение политики); `href="/assets/page.css"`: консоль пуста, но файл стилей грузится дважды и «значком» не является (приём на грани) |
| Ф14 | Правило видимости: равенство с движком | `node <scratch>/p057/probes/rule-eq.mjs` (вне проекта): 6 видов демо-файлов (2 арендатора × ru, kk, en) и 300 сгенерированных файлов (3–10 вопросов, все три вида вопросов, условия `any_of`, `none_of`, `min`, `max`, до трёх условий, ссылки только на вопросы выше, ключи `constructor`, `toString`, `valueOf`), по 4000 наборов ответов на файл (верные, пропущенные, мусор: `null`, `true`, `""`, `1.5`, `1e21`, `2**53`, `[]`, `["a","a"]`, `{}`, `"__proto__"`, лишний ключ) и 400 одиночных ответов на вопрос | `{ sets: 1224000, diffs: 0, reasonsDiff: 0 }`, 2,2 с |
| Ф15 | Мутанты правила (`mutate-rules.mjs`) | 14 замен текста `rules.js` по одной | 13 убиты (расхождения от 2 347 до 936 995 наборов); живой один — `question.id in given` вместо `Object.hasOwn(given, question.id)`: равнозначный по видимости (унаследованное значение — функция — не проходит `checkAnswer`), в список мутантов не входит |
| Ф16 | Прогресс: свойства | `node <scratch>/p057/probes/progress.mjs` и `small.mjs` (вне проекта) | `uchet-pro`: 200 путей, длины 8…12, рост `N` между шагами 0, `K = N` в конце 200 из 200, смена `N` при ответе на текущем вопросе 0; `svet-marketing`: 200 путей, длины 9, 10, те же нули. Файл `S1` (п. 5.3): строки 1–7 таблицы получены на прототипе. Файл из трёх вопросов (`a`, `b`, `c` показан при `b = x`): на `b` при ответе `y` (`c` скрыт, `b` последний) «Вопрос 2 из 3» (`K = 2`, `N = 3`, `K ≠ N` на последнем вопросе) — случай О1 |
| Ф17 | Мутанты прогресса и хода (`mutate-flow.mjs`) | 8 замен текста `flow.js` | 8 из 8 убиты проверкой `flow-check.mjs` (7 строк `S1`, цепочка скрытия, `nextVisible` в конце) |
| Ф18 | Тексты страницы проходят правила | прототип: 23 ключа в `texts.js` (22 из описания + `result_soon`); `node --test test/picker-texts.test.js`; проба слов; `npm run traces` | 7 из 7; запрещённых слов нет, «ты…» на ru нет, самая длинная фраза 18 слов, подстановки одинаковы; `traces`: следов 0. (kk и en в прототипе — расчётные переводы автора проекта; английский `card_gives` пришлось сократить: первая редакция была в 19 слов и краснила `TX-6b`) |
| Ф19 | Состав демо-арендаторов для страницы | `node -e` по `demo-tenants/*.json` | `uchet-pro`: 12 вопросов, 8 без `show_if`; условия — на `problems`, `business`, `items` (`min 500`), `tools` (`none_of`); `svet-marketing`: 11 вопросов, 7 без `show_if`; все ссылки только на вопросы выше (`E_ORDER`, `validate.js`/`conditions.js`); последний вопрос в обоих файлах без условия (поэтому `K = N` в конце верно на них) |
| Ф20 | Проверки `index.html` и сервера, которые держат разметку | чтение `SV-7g`, `config.js` | `Content-Security-Policy` (девять частей) не меняется; `index.html` обслуживается как `text/html`; `.css` — `text/css; charset=utf-8`; других расширений сервер не отдаёт; регистр имён зависит от файловой системы (ISS-0081, п. 4) — страница ссылается на файлы строчными именами в точности |

Расхождения с заданием: **Ф4** (блок `eslint` уже есть — критерий 10 и задание говорят «добавленный блок»), **Ф6/Ф8** (`LG-10c` не назван, красный), **Ф7** (в задании названы не все места: поиск находит ещё `SU-2`, `SF-6c`, `SF-6o`, `SF-6g`, заголовок файла и таблицу `SERVER_TEXTS`), **Ф16** (буквальное правило `N` даёт `K < N` в конце для файлов с зависимыми скрытыми вопросами ниже последнего видимого). Остальные утверждения задания (11 критериев, пути файлов, ветка `TR-4e`, ключи страницы) подтверждены.

## 2. Решения проекта

| № | Вопрос | Решение | Почему |
|---|---|---|---|
| D1 | Состав модулей | Тринадцать файлов `public/` (п. 3). Одна забота — один файл; чистые функции (`rules`, `flow`, `say`, `store`, `net`) не обращаются к `document`; только `screens`, `dom`, `result`, `app`, `main` трогают документ; `localStorage` — только `store.js`, `fetch(` — только `net.js` | Тесты Node проверяют чистое напрямую, а модель документа нужна только экранам; охранные тесты (`TR-4b`, `LG-10c`) работают по файлам |
| D2 | Как страница узнаёт видимость вопросов | Своя копия правила (`rules.js`) + тест равенства с движком на миллионе наборов (п. 6) | `engine.js` не раздаётся и не меняется (`decisions/0071`, п. 7; `0077`, п. 10); API — новый маршрут и запрос на каждый ответ; побайтная копия всего движка — 256 строк, из них нужны около 60 |
| D3 | Правило `N` | Буквально по описанию и `decisions/0077`, п. 4: вопрос входит в `N`, если виден по данным ответам или у него есть условие на вопрос **не выше текущего**; `K` — номер текущего среди видимых. Следствие: `N` не зависит от ответа на текущем вопросе. Случай `K < N` в конце — вопрос О1 | Решено ORCH; проект не меняет решение молча, а измеряет и сообщает |
| D4 | Состояние страницы | Один объект `state`, создаётся внутри `start()`; в модулях нет изменяемых переменных уровня модуля (`let` вне функций) | Тест может запускать `start()` много раз за процесс, как отдельные «загрузки страницы» |
| D5 | Что значит «есть сохранённое» | В значении ключа есть хотя бы один ответ, либо текущий вопрос — не первый видимый (описание, п. 4.2); значение, где только язык, сохранённым не считается | Описание |
| D6 | Формат значения хранилища | `{"format":1,"version":"<64 hex>","lang":"ru","current":"<id>"|null,"answers":{…}}` — ровно пять ключей (п. 7) | Критерий 4 и 6; `format` позволяет позже сменить форму без угадывания |
| D7 | Когда пишется хранилище | При каждом изменении допустимого ответа, при каждом переходе между вопросами, при смене языка; карточка «Пройти опрос» и первая отрисовка не пишут (описание, п. 4.2) | Перезагрузка на вопросе без перехода не теряет выбор (описание, п. 15, о7) |
| D8 | Отказ хранилища | Первое же исключение при чтении или записи ставит `storageOk = false` до конца жизни страницы; дальше страница к хранилищу не обращается | Иначе после сбоя записи текст «Ваши ответы сохранены» был бы ложью |
| D9 | Сеть | Один файл `net.js`, функция `request(path, init)`, обёртки `getQuestionnaire(lang)` и `postResult(lang, answers)`; без `mode` и `referrerPolicy`; у каждого запроса `signal: AbortSignal.timeout(20000)`; результат обёртки — один из трёх видов (`ok`, `network`, `server`) | Критерии 7 и 10; Q10 — у запроса есть предел времени; `Origin` (Ф10) |
| D10 | Подстановка в тексты | `say(key, lang, values)` в `say.js`; замена функцией, не шаблоном (`$&` во вставляемом значении остаётся буквами) | `texts.js` держит ровно пять экспортов (TX-6a); подстановка — прежняя ловушка Л19 REQ-056 |
| D11 | Как строится документ | Только `createElement`, атрибуты, `append` строк и узлов, `textContent`; `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write` не используются; `style` задаётся только присвоением `style.width` у заливки полосы | CSP (`style-src 'self'`: атрибут `style` и `setAttribute("style")` запрещены, Ф10 описания); тексты арендатора только как текст |
| D12 | Что видят тесты и приёмка в документе | Атрибуты `data-part` и `data-action` на значимых элементах (п. 10) | Селекторы не зависят от имён классов и вёрстки |
| D13 | Экран результата до REQ-058 | `result.js`: временный экран (`h2` с `tabindex="-1"`, текст `result_soon`, «Назад», «Начать заново»); интерфейс стыка — п. 4.9; REQ-058 заменяет файл | Страница не может остановиться на вопросе после ответа 200; ключ нужен один — О2 |
| D14 | Значок | Исключение, не объявленный значок (п. 12) | Без правки сервера значок объявить нельзя (Ф13) |
| D15 | Тесты страницы | Модель документа `picker-page-dom.js` (как `team-web-dom.js` для Sai Team), подмены `fetch`, `localStorage`, `location`, `history`, `scrollTo`; вид, размеры, контраст, кольцо фокуса — шаги приёмки в настоящем браузере (п. 18); контраст пар токенов и ключевые правила стилей дополнительно проверяет тест по тексту `page.css` (п. 17) | AP-060, AP-065, AP-089, AP-099, AP-107: модель документа раскладки не видит |
| D16 | Идентификатор арендатора на странице | Из адреса: `/t/<отрезок>/`, без повторной записи правила `TENANT_ID` (оно в `limits.js`, который страница не получает); отрезок короче 1 и длиннее 64 знаков, а также любой иной путь — «адреса арендатора нет», хранилище не трогается | Одно правило `id` в `limits.js` (AP-014; `SV-4e` держит это для каталога подбора); сервер отдаёт страницу только по верному `id` (404 иначе), так что строгая проверка на странице ничего не добавила бы |
| D17 | Язык страницы | Правило REQ-061: `?lang=` → сохранённый → ru (`chooseLanguage`); до ответа сервера доступны «все три»; после — поле `lang` анкеты (описание, п. 4.1) | Описание, критерий 9 |
| D18 | Переключатель и результат | Нажатие языка на экране результата: анкета на новом языке, затем повторный `POST` тех же ответов на новом языке (результат на языке посетителя), экран результата перерисовывается; при сбое — блок связи под шапкой, прежний язык | Описание, п. 4.11: «результат на новом языке получает повторным запросом (решает REQ-058)»; REQ-058 может заменить |
| D19 | Языки при отправке (`decisions/0078`, п. 11–12) | Пока идёт запрос результата, нажатия кнопок языка игнорируются, а поля вопроса закрыты (`fieldset[disabled]`). The language is kept during the result request: the request, the page and the result stay on the language that the page had when «Показать результат» was pressed. A press on a language button is discarded (no request, no change of the page, of the address, of the document language or of the storage) in two more cases: (a) it was made before «Показать результат» and its answer has not yet come when the result is asked for; (b) it was made on the result screen and the visitor left that screen («Назад», «Начать заново») before the change was finished. The variant «the change waits and the request goes out in the new language» is rejected. The language changes as usual at the next press | Нет гонки между ответом результата на прежнем языке и сменой языка; результат показывается по снимку отправленных ответов и не открывается поверх экрана с более новыми ответами. Rules (a) and (b) are written so that the tests `QP-9` and `QP-7c` follow the project, not the code |
| D20 | Кто пишет что | `texts.js` (ключи, ru — контракт, kk и en — предложение п. 14), все модули, `index.html`, `page.css` — FRONTEND-DEV; тесты и таблица замен — TEST-DESIGNER; `README.md` tools — FRONTEND-DEV (подшаг 57e) | Двое не пишут один файл |

## 3. Состав изменений и кто какие файлы пишет

| Файл | Роль | Новый? | Кто пишет |
|---|---|---|---|
| `tools/src/picker/public/index.html` | страница: `link` на `page.css`, `main#app`, `#live`, `script type="module"` на `main.js` (п. 10.1) | нет (правится) | FRONTEND-DEV (57e) |
| `tools/src/picker/public/page.css` | стили: токены цвета, светлая и тёмная тема, размеры, кольцо фокуса (п. 11) | да | FRONTEND-DEV (57d) |
| `tools/src/picker/public/texts.js` | + 23 ключа; − `page_stub_notice`; первая строка комментария переписывается без номера требования (`0074`, п. 6; `0077`, п. 11) | нет | FRONTEND-DEV (57a, 57e) |
| `tools/src/picker/public/say.js` | `say(key, lang, values)` | да | FRONTEND-DEV (57a) |
| `tools/src/picker/public/rules.js` | правило видимости и допустимости ответа — копия правила движка (п. 6) | да | FRONTEND-DEV (57a) |
| `tools/src/picker/public/flow.js` | чистая модель: прогресс, соседние вопросы, ответы, число из текста | да | FRONTEND-DEV (57a) |
| `tools/src/picker/public/store.js` | хранилище браузера (п. 7) | да | FRONTEND-DEV (57a) |
| `tools/src/picker/public/net.js` | сеть: `request(path, init)`, `getQuestionnaire`, `postResult`, проверка формы ответов (п. 8) | да | FRONTEND-DEV (57a) |
| `tools/src/picker/public/dom.js` | помощники построения узлов (`el`, `part`) | да | FRONTEND-DEV (57b) |
| `tools/src/picker/public/screens.js` | экраны: шапка, загрузка, карточка, вопрос, блок связи | да | FRONTEND-DEV (57b, 57c) |
| `tools/src/picker/public/result.js` | временный экран результата, стык с REQ-058 (п. 4.9) | да | FRONTEND-DEV (57b) |
| `tools/src/picker/public/app.js` | управление: состояние, переходы, фокус, живая область (п. 5) | да | FRONTEND-DEV (57b, 57c) |
| `tools/src/picker/public/main.js` | вход: вызывает `start()` | да | FRONTEND-DEV (57b) |
| `tools/src/picker/public/stub.js` | заглушка REQ-056 | **удаляется** | FRONTEND-DEV (57e) |
| `tools/eslint.config.js` | не меняется (блок есть, Ф4) | нет | — |
| `tools/README.md` | раздел страницы и поправки (п. 23) | нет | FRONTEND-DEV (57e) |
| `tools/test/picker-page.test.js` | тесты критериев 1–9, 11 на модели документа (`QP-…`) | да | TEST-DESIGNER |
| `tools/test/picker-page-model.test.js` | чистые модули: правило и равенство с движком, прогресс, хранилище, сеть, подстановка (`QM-…`) | да | TEST-DESIGNER |
| `tools/test/picker-page-static.test.js` | тексты файлов: разметка, слова, комментарии, стили, перечень файлов (`QS-…`) | да | TEST-DESIGNER |
| `tools/test/picker-page-dom.js`, `picker-page-helpers.js` | модель документа; подмены сети и хранилища, загрузка страницы, оракулы | да | TEST-DESIGNER |
| `tools/test/picker-server-helpers.js`, `picker-server-units.test.js`, `picker-server.test.js`, `picker-server-faults.test.js`, `picker-server-property.test.js`, `picker-lang.test.js`, `traces-runtime.test.js` | таблица замен п. 13 | нет | TEST-DESIGNER |
| `docs/requirements.yaml`, `STATE.md`, `docs/design/REQ-056-picker-server.md` (пометка «стало»), `decisions/` | учёт | нет | DOC-UPDATER, ORCH |

Не меняются: `engine.js`, `server.js`, `config.js`, `assets.js`, `request.js`, `public-data.js`, `messages.js`, `limits.js`, `view.js` (верхнего уровня), `tools/package.json`, `demo-tenants/*`, `demo-answers/*`, `tools/eslint.config.js`. Порядок: сначала общий контракт (п. 4–10), затем подшаги 57a → 57e (п. 21).

## 4. Модули страницы: формы данных и сигнатуры

Все модули — ES-модули, адреса импорта относительные (`./rules.js`); у `rules.js`, `store.js`, `net.js`, `dom.js` импортов нет; граф без циклов: `main → app → {screens, flow, store, net, say, texts, result, dom}`, `screens → {dom, say, texts}` (`texts` — только `LANGUAGE_NAMES` для подписей кнопок языков), `result → {dom}` (подписи подаёт `app.js` через `ctx.say`), `flow → rules`, `say → texts`. Модуль не импортирует ничего выше своей папки (файл вне `public/` сервер не отдаёт). Изменяемых переменных уровня модуля нет (D4). Глобальные имена браузера читаются **в момент вызова**, а не при загрузке модуля (так тест подменяет `document`, `location`, `localStorage`, `fetch` и запускает `start()` снова).

### 4.1 Формы данных

**Questionnaire** — тело ответа 200 на `GET api/questionnaire` (REQ-056, п. 5.3). Страница принимает его, только если `net.js` проверил форму (иначе — «ошибка сервера», п. 8):

| Поле | Ограничения, которые проверяет страница (чтобы не упасть; верхние пределы длины и числа — по `decisions/0078`, п. 13, и абзац «Принятые расхождения» ниже) |
|---|---|
| `version` | строка из 64 знаков `0–9a–f` |
| `lang` | один из `ru`, `kk`, `en` |
| `languages` | список из 1…3 различных языков из `ru`, `kk`, `en`; содержит `lang` |
| `name`, `intro` | строки |
| `questions_min`, `questions_max` | целые от 0 до 30, `questions_min ≤ questions_max`; `questions_max` равно длине `questions`; `questions_min` равно числу вопросов без `show_if` |
| `questions` | список из 1…30 объектов; `id` — непустая строка, не повторяется; `title` — строка; `help` — строка, если есть; `type` — `single`, `multiple` или `number`; `required` — логическое; `options` (у `single`, `multiple`) — список из 2…8 объектов `{id: строка, label: строка}` с разными `id`; `min`, `max` (у `number`) — целые, `min < max`; `unit` — строка, если есть; `show_if` — непустой список условий `{question: строка, и ровно один вид: any_of (список строк) | none_of (список строк) | min и/или max (целые)}` |
| `ai`, `leads` | страница не читает (REQ-063, REQ-059) |

**Принятые расхождения проверки формы с проверкой сервера** (`decisions/0078`, п. 13; measured on the code of `net.js`: a body with an empty name, an empty title, an empty option label, an empty `any_of`, an id of 41 signs and an id `Bad Id!` is accepted, `kind: "ok"`; a name of 61 signs and `any_of` of 9 items give `kind: "server"`):

| Что | Страница | Сервер |
|---|---|---|
| верхние пределы: `name` 60, `intro` 400, `title` 200, `help` 300, `label` 100, `unit` 20 знаков; `show_if` до 3 условий; `any_of`/`none_of` до 8 | отвергает анкету (как «ошибка сервера», п. 8) | отвергает файл арендатора |
| нижние пределы: пустое `name`, `intro`, `title`, `label`; пустой `any_of`/`none_of` | accepted by the page — it does not check them | отвергает |
| шаблон идентификатора (`TENANT_ID`-подобный) и длина 1–40 знаков у `id` вопроса и варианта; чем отличаются от непустой строки | not checked by the page (`id` — непустая строка, у `single`/`multiple` — не повторяются) | проверяет |

The tests of the form (`QM-4a` and the tests of the limits) must not require the page to reject the second and the third row; they may require that the page does not fall on such a body. The server is the boundary; the page only does not fall (Q10).

**Answers** — объект без прототипа `id вопроса → Stored`; ключи только известных вопросов. **Stored**: `single` — строка (`id` варианта); `multiple` — список строк (`id` вариантов в порядке вариантов, без повторов, не пустой); `number` — целое число (`-0` записывается как `0`). Так же ответы уходят в теле запроса: `{"answers": …}` — ровно то, что принимает движок (REQ-056, п. 5.3).

**Saved** — прочитанное из хранилища: `{ version: строка | null, lang: "ru" | "kk" | "en" | null, current: строка | null, answers: Answers }`. Пустое значение — `{version: null, lang: null, current: null, answers: {}}`.

**NetResult** — результат обёртки сети: `{ kind: "ok", body }` | `{ kind: "network" }` | `{ kind: "server", status, code, message }` (`code` — поле `error` тела или `null`; `message` — поле `message` тела, если непустая строка, иначе `null`).

**Result** — тело ответа 200 на `POST api/result`: объект с ключами `clear_leader` (логическое или `null`), `recommended` (список), `no_match_text` (строка или `null`), `hypotheses` (список). Содержимое элементов списков эта страница не читает.

### 4.2 `say.js` (импортирует `texts.js`)

| Функция | Вход → выход |
|---|---|
| `say(key, lang, values = {})` | ключ `TEXTS`, язык, подстановки `{имя}` → строка. Подстановка **функцией** (`$&`, `$1` во вставляемом значении остаются буквами). Значения — строки или числа. Нет ключа или языка — ошибка программы (исключение), а не пустая строка. Подстановка, для которой значения нет, остаётся как есть (`{min}`) |

### 4.3 `rules.js` (без импортов) — правило движка на странице

| Функция | Вход → выход |
|---|---|
| `checkAnswer(question, raw)` | вопрос анкеты и **любое** значение → `{ ok: true, value }` или `{ ok: false, reason }`. `reason` — одна из `wrong_kind`, `not_integer`, `out_of_range`, `unknown_option`, `empty_list`, `duplicate_option` (те же слова и тот же порядок проверок, что у движка). `value` — как у движка: у `single` список из одного `id`, у `multiple` `id` в порядке вариантов, у `number` целое (`-0` → `0`). Не бросает |
| `visibleIds(questions, answers)` | список вопросов (в порядке анкеты) и **любое** значение вместо ответов → `id` видимых вопросов в порядке анкеты. Ответы, не объект, считаются пустыми; неверный ответ на видимый вопрос — как отсутствие. Не бросает |

Правила, которые обязаны совпасть с движком: условие `any_of`/`none_of` — только по ответам-спискам; `min`/`max` — только по числам; вопрос без допустимого ответа (скрытый, не отвеченный, неверный) делает **любое** условие на него ложным, и `none_of` тоже; ответ на скрытый вопрос в состояние не входит; чужие ключи ответов и ключи-наследие (`constructor`) не читаются (`Object.hasOwn`).

### 4.4 `flow.js` (импортирует `rules.js`) — модель без документа

| Функция | Вход → выход |
|---|---|
| `progress(questions, answers, currentId)` | → `{ k, n }`. `k` — место `currentId` среди видимых (с 1); `n` — правило п. 5.3. Неизвестный `currentId` — `k = 0` |
| `firstVisible(questions)` | → `id` первого вопроса (первый вопрос не имеет `show_if`: условия смотрят только выше) |
| `nextVisible(questions, answers, currentId)` | → `id` следующего видимого или `null`, если текущий последний или неизвестен |
| `previousVisible(questions, answers, currentId)` | → `id` предыдущего видимого или `null` |
| `setAnswer(questions, answers, id, raw)` | → **новый** объект ответов с ответом `raw` на `id` (`raw === undefined` — ответ стёрт); неверный `raw` (не проходит `checkAnswer`) считается стёртым ответом; `multiple` записывается в порядке вариантов; затем из результата удаляются ответы на вопросы, которые стали скрытыми (одним пересчётом видимости после изменения: скрытый вопрос в состояние не входит, поэтому цепочка «скрыл `b` → скрыт и `c`» учтена). Вход не меняется |
| `pruneAnswers(questions, answers)` | → новый объект: только собственные записи видимых вопросов с допустимым ответом (каноничным); неизвестные ключи, скрытые и неверные ответы отброшены. Для чтения хранилища и для тела запроса |
| `bodyAnswers(questions, answers)` | → то же, что `pruneAnswers`, для тела `POST` |
| `openQuestion(questions, answers)` | → `id` первого видимого **обязательного** вопроса без допустимого ответа или `null` |
| `entryQuestion(questions, answers, savedCurrent)` | → вопрос, с которого продолжать: `savedCurrent`, если он видим, иначе первый видимый без допустимого ответа, иначе первый видимый; затем не дальше, чем `openQuestion` (нельзя перескочить обязательный без ответа) |
| `isLastVisible(questions, answers, currentId)` | → `true`, если после текущего нет видимых |
| `readNumber(text, badInput)` | строка поля и признак `validity.badInput` → `{ state: "empty" }` (пустая строка, `badInput` ложь), `{ state: "invalid" }` (`badInput` истинно, либо строка не `^-?[0-9]+$`, либо число не безопасное целое), `{ state: "ok", value }` (`-0` → `0`) |
| `verdict(question, raw, numberState)` | → `{ ok: true }` или `{ ok: false, message: "required" | "range" }` для кнопки «Далее»: обязательный без допустимого ответа — `required`; у `number` недопустимый текст в поле (`invalid`, или `ok`, но вне `min…max`) — `range` (и у необязательного); пустое необязательное — `ok` |

### 4.5 `store.js` (без импортов) — см. п. 7

| Имя | Вход → выход |
|---|---|
| `STORAGE_PREFIX` | `"sai-picker:"` |
| `tenantIdOf(pathname)` | → отрезок между `/t/` и последним `/`, если путь ровно `/t/<отрезок>/`, отрезок без `/`, длиной 1…64; иначе `null` (D16) |
| `readSaved(id)` | → `{ ok, saved }`; `ok: false` — хранилище недоступно (исключение при обращении к `localStorage` или `getItem`); нет ключа — `ok: true` и пустое `Saved`; битое значение — `ok: true` и пустое `Saved` (не бросает) |
| `writeSaved(id, state)` | `state = { version, lang, current, answers }` → `true` или `false` (исключение при записи); пишет ровно пять ключей: `format`, `version`, `lang`, `current`, `answers` |
| `clearSaved(id)` | → `true` или `false`; удаляет только `sai-picker:<id>` |

### 4.6 `net.js` (без импортов) — см. п. 8

| Имя | Вход → выход |
|---|---|
| `getQuestionnaire(lang)` | → `Promise<NetResult>`; `GET api/questionnaire?lang=<lang>` |
| `postResult(lang, answers)` | → `Promise<NetResult>`; `POST api/result?lang=<lang>`, тело `{"answers": answers}`, `Content-Type: application/json` |
| (внутренняя) `request(path, init)` | `async function request(path, init) {` — единственный вызов `fetch(` на странице; добавляет `signal` с пределом `REQUEST_TIMEOUT_MS = 20000`; `mode`, `referrerPolicy`, `credentials` не задаёт |
| `API_QUESTIONNAIRE`, `API_RESULT` | `"api/questionnaire"`, `"api/result"` — относительные адреса (страница `/t/<id>/` заканчивается слэшем) |

Обёртки не бросают: исключение `fetch`, обрыв по времени, не JSON в теле или форма, не прошедшая проверку, дают `network` или `server` (п. 8).

### 4.7 `dom.js` и `screens.js`

`dom.js` (без импортов): `el(tag, attrs, …children) → узел` (значения атрибутов — строки; `null` и `undefined` пропускаются; дети — строки или узлы), `part(tag, name, attrs, …children)` — то же с `data-part="name"`; `setText(node, text)` — `textContent`. `screens.js` строит узлы по данным и возвращает узлы вместе со ссылками на части, которые `app.js` меняет на месте. Контракт, который видят тесты и приёмка, — разметка п. 10, а не имена внутренних функций; перечень обязанностей:

| Строитель | Что делает |
|---|---|
| заголовок страницы (`h1` + группа языков) | строится один раз; при смене языка меняется на месте (название, `aria-current`), кнопки языка не пересоздаются (фокус остаётся на нажатой) |
| экран загрузки | панель без шапки, строка `quiz_loading` |
| карточка | п. 10.2; кнопки по D5 |
| экран вопроса | п. 10.2; прогресс, поле ответа по виду, элемент ошибки (создаётся пустым вместе с экраном), кнопки |
| блок связи | текст, кнопка «Повторить» (и «Начать заново» при `answers_invalid`) |
| обновление на месте | подпись главной кнопки («Далее»/«Показать результат»), прогресс (`K`, `N`, ширина заливки `style.width`), сообщение об ошибке и `aria-describedby`/`aria-invalid`, подписи при смене языка |

### 4.8 `app.js` и `main.js`

`app.js` экспортирует одну функцию `start()` (без аргументов): читает глобальные `document`, `location`, `history`, `localStorage` (через `store.js`), `scrollTo`; создаёт `state` (п. 5.1); собирает страницу из строителей `screens.js`; подписывается на события элементов. `main.js` — две строки: импорт `start` и его вызов (комментарии без номеров требований). Больше ни один модуль при загрузке ничего не выполняет.

### 4.9 `result.js` — стык с REQ-058

| Имя | Вход → выход |
|---|---|
| `renderResult(ctx)` | `ctx = { lang, name, result, answers, questionnaire, say(key, values?), head, onEdit(), onRestart() }` → `{ node, focus }`: корневой узел экрана результата и элемент, которому `app.js` отдаёт фокус (`tabindex="-1"`). `answers` — `bodyAnswers` (то, что ушло в запросе); `head` — узел шапки страницы (`header[data-part="head"]`, п. 10.2), который экран результата ставит первым в свою панель и тем сохраняет название и кнопки языка; `questionnaire` — анкета на текущем языке; `onEdit` — вернуться к последнему показанному вопросу (то же, что «Продолжить»); `onRestart` — «Начать заново» (к первому вопросу без ответов) |

Временное содержимое (REQ-057): панель с `data-screen="result"` (п. 10.2), в ней `h2[tabindex="-1"][data-part="result-title"]` с текстом `result_soon`, кнопка `data-action="edit"` (подпись `quiz_back`) и кнопка `data-action="restart"` (подпись `card_restart`). REQ-058 заменяет **файл целиком** (и вправе менять `ctx`, если меняет и `app.js`); `app.js` вызывает `renderResult` и больше ничего о результате не знает. Результат в хранилище не пишется (описание, п. 4.11, [о4]).

## 5. Состояние страницы и переходы

### 5.1 Объект состояния (`state`, создаётся в `start()`)

| Поле | Тип | Смысл |
|---|---|---|
| `id` | строка или `null` | отрезок адреса (`tenantIdOf(location.pathname)`); `null` — хранилище не используется |
| `lang` | `ru` / `kk` / `en` | язык страницы (после ответа сервера — поле `lang` анкеты) |
| `q` | Questionnaire или `null` | анкета на текущем языке |
| `screen` | `loading` / `card` / `question` / `result` / `failure` | что показано |
| `answers` | Answers | ответы посетителя |
| `current` | `id` или `null` | последняя позиция: показанный вопрос; на карточке — сохранённая позиция |
| `notice` | логическое | показывается `card_changed` (п. 4.10 описания) |
| `storageOk` | логическое | хранилище отвечает (D8); изначально результат первого чтения |
| `sending` | логическое | идёт запрос результата |
| `ticket` | число | номер последнего нажатия языка (последнее нажатие побеждает) |
| `draft` | `{id, text}` или `null` | сырой текст поля числа текущего вопроса, пока он не допустим |
| `net` | `null` или `{kind: "load" / "lang" / "result", reason: "network" / "server", message, code}` | блок связи, который сейчас показан |

«Есть сохранённое» (D5) вычисляется: `hasSaved = answers не пусты ИЛИ (current ≠ null И current ≠ firstVisible)`.

### 5.2 События, действия, фокус и запись

«Пишет» — `writeSaved` со всем состоянием `{version: q.version, lang, current, answers}` (D7). «Живая область» — запись в `#live` (п. 5.4). Если `storageOk` ложно, строки «пишет» и «стирает» не выполняются.

| Событие | Условие | Что делает страница | Фокус | Живая область | Хранилище |
|---|---|---|---|---|---|
| **B0. `start()`** | всегда | `id` из адреса; `readSaved(id)` (`storageOk` = его `ok`); язык = `chooseLanguage({query: ?lang=, stored: saved.lang, available: LANGUAGES})`; `document.documentElement.lang` = язык; экран загрузки; `getQuestionnaire(язык)` | не двигается | `quiz_loading` | читает |
| **B1. Анкета получена** | `kind: "ok"` | `lang` = `q.lang` (у файла `/1` — `ru`, если спросили `kk`; язык документа обновляется); `document.title` = `name`. Если `saved.version` не `null` и не равна `q.version`: `hadAny` = у сохранённого были ответы или позиция не первая; ответы и позиция стираются, `notice = hadAny`, при `hadAny` пишет `{version: q.version, lang, current: null, answers: {}}` (язык остаётся). Иначе `answers = pruneAnswers(q, saved.answers)`, `current = saved.current` (если видим). Экран «карточка» | если пришли из блока (повтор): заголовок `h1`; иначе не двигается | нет | при `hadAny` пишет |
| **B2. Анкета не получена** | `network` / `server` | экран `failure` (панель без шапки), блок связи `net.kind = "load"`; текст — п. 8 | кнопка блока | нет | нет |
| **C1. «Пройти опрос»** | нет сохранённого | `notice = false`, `answers = {}`, `current = firstVisible`, экран «вопрос» (п. 5.4 про прокрутку) | заголовок вопроса | прогресс | не пишет |
| **C2. «Продолжить»** | есть сохранённое | `current = entryQuestion(q, answers, current)`, экран «вопрос» | заголовок вопроса | прогресс | пишет (позиция могла сдвинуться) |
| **C3. «Начать заново»** (карточка или временный экран результата) | всегда | `clearSaved(id)`; `answers = {}`, `current = firstVisible`, `notice = false`, экран «вопрос» | заголовок вопроса | прогресс | стирает ключ |
| **Q1. Изменён ответ** | `change` у переключателя или флажка, `input` у числа | число: `readNumber(text, validity.badInput)`; `setAnswer(...)` (`ok` и в границах — значение, иначе стёрт); `draft` = текст, пока не допустим; сообщение об ошибке стёрто; подпись главной кнопки пересчитана (`isLastVisible`); прогресс пересчитан | остаётся | при смене `K` или `N` — прогресс | пишет |
| **Q2. «Далее»** (отправка формы) | `sending` ложно | `verdict`; если `ok: false` — сообщение `quiz_required` или `quiz_number_range` в элементе ошибки, у поля `aria-describedby`/`aria-invalid`; если `ok` и есть `nextVisible` — переход `go(id)`; если следующего нет — `send()` (Q6) | при отказе: первый `input` вопроса; при переходе: заголовок нового вопроса | прогресс нового вопроса | при отказе не пишет; при переходе пишет |
| **Q3. «Назад»** | не первый видимый | `go(previousVisible)`; ответ текущего вопроса не меняется | заголовок вопроса | прогресс | пишет |
| **Q4. «Пропустить»** | `required = false` | ответ стёрт (`setAnswer(…, undefined)`), `draft = null`; затем как Q2 без проверки | как в Q2 | как в Q2 | пишет |
| **Q5. `go(id)`** | — | `current = id`, экран «вопрос» заново, `draft = null`, прокрутка `scrollTo({top: 0, left: 0, behavior: "instant"})`, затем `focus({preventScroll: true})` | заголовок | прогресс | пишет |
| **Q6. `send()`** | `sending` ложно | `openQuestion` не `null` (не должно быть) → `go` к нему и сообщение `quiz_required`, запрос не уходит. Иначе ответы берутся один раз в снимок `sent = bodyAnswers(...)`; `sending = true`, `ticket += 1` (the change of language that is still on its way is dropped, rule L3), `fieldset` вопроса закрыт (`disabled`, D19: поля не принимают ввод, ответы не меняются), `aria-disabled="true"` у главной кнопки, `postResult(lang, sent)` — the language is the one that the page had at this moment and does not change until the answer comes. `ok` → `sending = false`, поля открыты, экран «результат» по снимку `sent` (`renderResult`), прокрутка, фокус на `focus` из `renderResult`; `network` / `server` → `sending = false`, поля открыты, главная кнопка снова без `aria-disabled`, блок связи `net.kind = "result"` под кнопками; `answers_invalid` — с кнопкой «Начать заново» вместо «Повторить» (описание, п. 4.8) | при ошибке: кнопка блока; при успехе: заголовок результата | `quiz_sending` в начале | не пишет |
| **L1. Кнопка языка** | `sending` ложно (при истинном — как L3: ничего); не текущий язык | `ticket += 1`; `getQuestionnaire(новый)`; пока ответа нет, вид прежний. Ответ (если `ticket` тот же): версия та же — `q` заменён, язык страницы, `document.documentElement.lang`, адрес `?lang=` (`history.replaceState(null, "", путь + "?" + параметры)`, остальные параметры сохранены, записи в истории не добавляются), `aria-current`; текущий экран перерисован на новом языке (экран «вопрос»: ответы, позиция, `draft` остаются; `K`, `N` те же); на экране «результат» — повторный `postResult(новый язык, ответы)` и перерисовка, but only while the visitor is still on the result screen (rule L4). Версия другая — как B1 (стирание, карточка, уведомление). Сбой — блок `net.kind = "lang"` под шапкой, язык прежний. When a change began on the result screen and the visitor left it, leaving the screen wins over a new version and over a failure. | остаётся на нажатой кнопке | нет | пишет (язык, в том же значении) |
| **L2. Кнопка текущего языка** | — | ничего | — | — | — |
| **L3. Кнопка языка и «Показать результат»** (D19, `decisions/0078`, п. 11–12) | (a) `sending` истинно: запрос результата идёт; (b) кнопка нажата до «Показать результат», ответ на её запрос анкеты ещё не пришёл, когда ушёл запрос результата | (a) ничего: ни запроса, ни изменения страницы, адреса, языка документа, хранилища; поля вопроса закрыты, запрос идёт на прежнем языке. (b) `send()` увеличил `ticket`, поэтому ответ на запрос анкеты, пришедший позже, отбрасывается: язык страницы, адрес, хранилище не меняются, результат показывается на прежнем языке; the request of the questionnaire that was already sent is not cancelled, only its answer is dropped. Следующее нажатие языка (после ответа результата) работает как обычно (L1) | не двигается | нет | не пишет |
| **L4. Кнопка языка на экране «результат» и уход с экрана** (D19, `decisions/0078`, п. 11) | после нажатия (L1) посетитель нажал «Назад» (E1) или «Начать заново» (C3) раньше, чем смена закончилась (до ответа анкеты или до ответа повторного `POST`) | если ответ анкеты пришёл уже после ухода — повторный `POST` не отправляется; если `POST` уже ушёл — он не отменяется, а его ответ отбрасывается: нет перерисовки результата, нет изменения языка страницы, адреса, языка документа, хранилища; экран вопроса или карточка остаются, как их открыл «Назад» или «Начать заново», на прежнем языке. When a change began on the result screen and the visitor left it, leaving the screen wins over a new version and over a failure. Следующее нажатие языка работает как обычно (L1) | остаётся там, куда его привёл «Назад» или «Начать заново» (focus is not taken back by the dropped change) | нет | не пишет |
| **R1. «Повторить»** | в блоке | `load` — как B0 с языком страницы; `lang` — как L1 с тем же языком; `result` — как Q6 с теми же ответами. Блок убран, пока идёт запрос | при успехе: заголовок открывшегося экрана (`h1` карточки или `h2` вопроса) | как у события | как у события |
| **R2. «Начать заново»** в блоке `answers_invalid` | блок `net.kind` = `result` или `lang` (ответ сервера `answers_invalid` на `POST`); in the block of the load failure (`net.kind = "load"`, B2) the button «Начать заново» does not exist — only «Повторить» (rule of `netBlock`: the button «Начать заново» is made only for kinds other than `load`) | `clearSaved(id)`, ответы стёрты, экран «карточка» без «Продолжить» | `h1` | нет | стирает ключ |
| **E1. «Назад» на временном экране результата** (`onEdit`) | — | `go(current ?? последний видимый)` | заголовок вопроса | прогресс | пишет |

Пока `sending` истинно, повторные нажатия на «Показать результат» и Enter в форме игнорируются, поля вопроса закрыты (`fieldset[disabled]`), а нажатия кнопок языка игнорируются (D19, L3). `setBusy(refs, busy)` — export of `screens.js`: sets and removes the attribute `disabled` of the `fieldset` of the question; it is called by `send()` before the request and after the answer on every path.

### 5.3 Прогресс «Вопрос K из N»

`K` — место текущего вопроса среди видимых (с 1). `N` — число вопросов анкеты `q`, для которых верно **одно из двух**: (а) вопрос входит в `visibleIds(questions, answers)`; (б) у вопроса есть `show_if`, в котором хотя бы одно условие ссылается на вопрос с номером в анкете **не меньше номера текущего** (текущий ещё не пройден, `decisions/0077`, п. 4). Условие на неизвестный `id` не считается ссылкой. Из этого: `N` не зависит от ответа на текущем вопросе (его ответ открывает вопросы, которые уже входят в (б)); при переходе вперёд `N` не растёт (доказано рассуждением: вопросы, ставшие видимыми из-за ответа на текущий, ссылаются на текущий или на вопросы ниже; после шага вперёд множество (б) только сужается); при «Назад» и смене ответа `N` пересчитывается.

Эталонный файл `S1` — шесть вопросов `single` с вариантами `p` и `q`, все обязательные: `a`; `b` (показан при `a = p`); `c` (показан при `a = q`); `d`; `e` (показан при `d = p`); `f`. Таблица литералов (тест `QP-3c` записывает их в тексте теста; получены на прототипе, Ф16, и пересчитаны рассуждением):

| № | Ответы | Текущий | Видимые | K | N | Почему N |
|---|---|---|---|---|---|---|
| 1 | нет | `a` | `a d f` | 1 | 6 | 3 видимых + `b`, `c` (условия на `a`, а `a` — текущий) + `e` (условие на `d` ниже текущего) |
| 2 | `a=p` | `b` | `a b d f` | 2 | 5 | 4 видимых + `e`; `c` скрыт и ссылается на `a`, выше текущего — не считается |
| 3 | `a=p b=p` | `d` | `a b d f` | 3 | 5 | 4 + `e` (ссылка на `d`, текущий) |
| 4 | `a=p b=p d=p` | `e` | `a b d e f` | 4 | 5 | 5 видимых |
| 5 | `a=p b=p d=p e=q` | `f` | `a b d e f` | 5 | 5 | 5; в конце `K = N` |
| 6 | `a=q d=p e=q` (ответ `b` стёрт при смене `a`) | `a` | `a c d e f` | 1 | 6 | 5 видимых + `b` (условие на `a`, текущий) |
| 7 | `a=q d=p e=q` | `c` | `a c d e f` | 2 | 5 | 5 видимых; `b` скрыт и ссылается на `a`, выше текущего |

Строки 1–5 — путь вперёд (`N`: 6, 5, 5, 5, 5 — не растёт); строки 6–7 — «Назад» к `a` и смена ответа с `p` на `q`: открывает `c`, скрывает `b`, ответ на `b` из сохранённого удалён.

**Случай О1 (не решён догадкой).** Файл из трёх вопросов `a`, `b`, `c`, где `c` показан при `b = x`: при ответе `y` на `b` (`c` скрыт, `b` — последний видимый) страница показывает «Вопрос 2 из 3» и «Показать результат» — `K = 2`, `N = 3`, потому что `c` ссылается на `b`, а `b` текущий. Описание (п. 4.5) и критерий 3 говорят «на последнем вопросе `K = N`». На обоих демо-файлах и в тесте критерия 3 этого нет (последний вопрос в них без условия, Ф19). Исправление, которое держит и «`N` при ответах вперёд не растёт», и «в конце `K = N`»: текущий вопрос с допустимым ответом считается пройденным. Тогда `N` убывает при ответе на текущем вопросе (ни разу не растёт по сравнению с приходом на вопрос), но меняется, пока человек остаётся на вопросе, — это расходится с фразой описания «ответ на текущем вопросе не меняет `N`». Выбор за ORCH (п. 24, О1); до ответа действует буквальное правило `0077`, п. 4; в тест критерия 3 случай не входит, а запись «известное расхождение» стоит в `QP-3d` (маленький файл, ожидаемое значение — литерал `2 из 3`, помечено).

### 5.4 Фокус, прокрутка, живая область

* После каждого перехода между экранами и вопросами: сначала `scrollTo({top: 0, left: 0, behavior: "instant"})`, затем `focus({preventScroll: true})` у заголовка (`h2` вопроса, `h1` карточки после повтора, заголовок результата). Заголовок — `tabindex="-1"`. После перехода `document.activeElement` — заголовок нового экрана (критерий 5).
* Первая отрисовка карточки фокус не двигает. Кнопка языка сохраняет фокус при смене языка. При отказе «Далее» — фокус на первый `input` (не на текст сообщения). Блок связи при появлении — фокус на его кнопку.
* Accepted difference (loss of focus while the fields are closed, `decisions/0078`, п. 12): when the `fieldset` becomes `disabled`, the browser takes the focus away from the field that had it, so during the result request `document.activeElement` is not a field of the question. After the answer the focus goes by the rule of Q6: on failure to the button of the block of the connection (the fields are open again), on success to the heading of the result. The focus is not put back on the field in between; the tests check only the two final places.
* `#live` (`index.html`, `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, в дереве доступности с загрузки) получает текст: `quiz_loading` и `quiz_sending` в начале запроса; текст прогресса «Вопрос K из N» при каждом переходе и при каждой смене `K` или `N`. Запись — `textContent` целиком.
* Страница не вызывает `alert`, `confirm`, `prompt`, `showModal`, не использует `dialog`, `beforeunload` (критерий 11; поиск п. 17).

## 6. Правило видимости вопросов на странице: один источник правды

### 6.1 Задача

Критерий 3 и описание требуют «одно правило на сервере и в странице». Сервер считает видимость в `engine.js` (`visibleQuestions`, внутри — `holds`, `checkAnswer`). Страница должна знать её сама: показывать вопросы по уже данным ответам, считать `N`, убирать ответы на скрытые вопросы, не посылать серверу то, что он отвергнет. `engine.js` страница не получает (`/assets/` отдаёт только `.html`, `.js`, `.css` из `public/`, REQ-056, п. 5.10) и не меняется (`decisions/0071`, п. 7; `0077`, п. 10).

### 6.2 Варианты

| Вариант | Что нужно изменить | Плюсы | Минусы | Итог |
|---|---|---|---|---|
| А. Свой модуль `public/rules.js` с тем же правилом и тест равенства с движком на миллионе наборов | ничего вне `public/` | сервер, движок и их 1898 тестов не трогаются; видимость считается без сети (работает при «Нет связи»); модуль маленький (≈60 строк) и чистый; расхождение ловит тест | два места с одним правилом: изменение движка требует изменения `rules.js` — тест `QM-1` красный, пока этого нет | **выбран** |
| Б. Правило через API (новый маршрут «какие вопросы видны при этих ответах») | новый маршрут в закрытом списке (`routeOf`, `server.js`, `SV-3a`, `SU-2`, `SF-6c`, `SP-1`, `SP-2`, `SV-7a`…), правка REQ-056 (`done`) | одно правило на сервере | запрос на каждый ответ; без сети страница не может ни показать следующий вопрос, ни посчитать `N` (описание, п. 4.8: «ответы не теряются», но вперёд идти нельзя); задержка на каждом шаге; больше поверхности защиты (Q10) | отвергнут |
| В. Побайтная копия `engine.js` в `public/` (как копия `layout.js` у офиса, `decisions/0074`, п. 3) и тест на равенство байт | копия 256 строк | один и тот же текст | в страницу попадает подсчёт баллов и описание решений, которые ей не нужны; любой правке движка (даже без смысла для видимости) нужна новая копия; `LG-10c`, `TR-4*` пришлось бы проверять на лишних 200 строках; страница получает функцию, которая принимает файл арендатора целиком, — а файла арендатора у неё нет | отвергнут |
| Г. Сервер раздаёт сам `engine.js` (расширение списка `/assets/`) | правка `assets.js`, `config.js`, `SV-1f`, `SU-12`, `SU-13` и `engine.js` вне `public/` | один текст | правка REQ-056 (`done`) и границы «файлы страницы — только `public/`» (Q8: расширение того, что отдаёт сервер); `engine.js` без изменений, но выходит в сеть | отвергнут |

### 6.3 Выбор и границы

Выбран А. Правило копируется только в той части, которая нужна странице: `checkAnswer` (допустимость одного ответа и его каноничный вид) и `visibleIds` (список видимых по ответам). Подсчёт баллов, гипотезы и объяснения страница не повторяет. Расхождение невозможно «тихо»: тест `QM-1` сравнивает результат модуля с `engine.js` на тех же входах; `rules.js` не импортирует `engine.js` и не может (файл вне `public/`; `QS-9` ищет такой импорт). Записать выбор — предложение записи `0078`, п. 1 (п. 24): его могут оспорить.

### 6.4 Тест «одно правило» (файл `tools/test/picker-page-model.test.js`, идентификаторы `QM-1…`)

Оракул — `engine.js` (`visibleQuestions`, `resolveAnswers`) и настоящие демо-файлы через `checkBytes` → `tenantInLanguage` → `publicQuestionnaire` (то, что страница получит от сервера), а не руки теста.

| Тест | Что проверяет |
|---|---|
| **QM-1a** | Для 6 видов демо-файлов (`uchet-pro`, `svet-marketing` × ru, kk, en) и 300 сгенерированных файлов (3–10 вопросов; `single`, `multiple`, `number`; `any_of`, `none_of`, `min`, `max`; до трёх условий; ссылки только на вопросы выше; `id` вопросов в числе прочих `constructor`, `toString`, `valueOf`): на каждом файле 4000 наборов ответов (зерно закреплено) — `visibleIds(questions, answers)` равен `visibleQuestions(вид, answers)` (глубокое равенство списков). Всего не меньше 1 000 000 наборов, время теста не больше 10 с (на прототипе 1 224 000 за 2,2 с) |
| **QM-1b** | Наборы собраны из: верных ответов, пропусков, мусора (`null`, `true`, `""`, `0`, `-1`, `1.5`, `1e21`, `2**53`, `[]`, `[1]`, `["a","a"]`, `{}`, `"__proto__"`, `[null]`), ответов вне границ, повторов в списке, лишнего ключа вне анкеты, ответов не-объектов (`null`, число, список) вместо всего набора |
| **QM-1c** | Допустимость одного ответа: для каждого вопроса каждого файла по 400 значений — `checkAnswer(q, raw)` и `resolveAnswers({questions: [q без show_if и required = false]}, {[q.id]: raw})` согласны: `ok` равно `ok`; при отказе `reason` равна `error.reason`; при согласии `value` равно нормализованному значению движка (у `single` — список из одного `id`) |
| **QM-1d** | «Страница не шлёт того, что сервер отвергнет»: 5000 случайных проходов вперёд по модели `flow.js` (ответы подобраны допустимые; необязательные иногда пропускаются; иногда «Назад» и смена ответа) по обоим демо-арендаторам: `bodyAnswers(...)` в конце каждого прохода принимает `computeResult` (`ok: true`), и ключи тела — ровно видимые вопросы с ответом |
| **QM-1e** | `readNumber` and `verdict` agree with the engine, as reinterpreted (deviation 2, section 17.4): for the numbers `-3…3` and a list of strings (`""`, `"-"`, `"1e3"`, `"2.5"`, `"+5"`, `"0x10"`, `"007"`, `"-0"`, `"9007199254740993"`, spaces at the edges, other digits, `"1_0"`, `"--1"`, `".5"`, `"5."`) a text the page accepts gives the same number as `Number(text)` and the engine takes that number; the texts that the page refuses (among them `"1e3"`) never reach the engine |
| **QM-1f** | В `rules.js` нет `import`, нет слов `engine`, нет неименованных обращений к `process`; у `rules.js` ровно два экспорта (`checkAnswer`, `visibleIds`) |

Если меняется правило видимости или допустимости в движке (`holds`, `checkAnswer`, порядок проверок), в том же изменении меняется `rules.js`; иначе красным станет `QM-1a`/`QM-1c`.

## 7. Хранилище браузера

Одна запись на арендатора: ключ `sai-picker:<id>`, значение — строка JSON с ровно пятью ключами:

| Ключ | Значение |
|---|---|
| `format` | число `1` |
| `version` | `q.version` (64 знака `0–9a–f`) |
| `lang` | `ru`, `kk` или `en` — язык страницы |
| `current` | `id` вопроса или `null` |
| `answers` | объект `id вопроса → Stored` только видимых вопросов |

Контактов (имени, телефона, почты) и других полей нет никогда (критерий 6): `store.js` собирает значение сам из этих пяти полей, а не копирует объект целиком.

### 7.1 Чтение (`readSaved`) — каждое поле проверяется, ничего не бросает

| Что в хранилище | Что видит страница |
|---|---|
| исключение при обращении к `localStorage` или `getItem` | `ok: false` → `storageOk = false`; пустое `Saved` |
| ключа нет | `ok: true`, пустое `Saved` |
| значение длиннее 32 768 знаков | `ok: true`, пустое `Saved` (значение не стирается) |
| не JSON, не объект, список, `null`, `format` не `1` | `ok: true`, пустое `Saved` |
| `version` не 64 знака hex | считается, что сохранённых ответов и позиции нет; язык берётся, если верный |
| `lang` не из трёх | `null` |
| `current` не строка длиной 1…64 | `null` |
| `answers` не объект | пустые ответы; каждая запись: ключ 1…64 знака; значение — строка до 200 знаков, или список из 1…8 строк до 200 знаков, или безопасное целое; больше 30 записей — лишние отброшены; остальные записи отброшены; записи копируются в объект без прототипа (ключ `__proto__` — обычный ключ, который потом отсеет `pruneAnswers`) |

После чтения `app.js` отдаёт ответы в `pruneAnswers(q, answers)`: остаются собственные записи видимых вопросов с допустимым каноничным ответом.

### 7.2 Запись и стирание

* `writeSaved(id, state)` — один `setItem` с полной строкой (всё или ничего: запись целиком или исключение). `false` — исключение (квота, запрет): `storageOk = false`, страница дальше к хранилищу не обращается (D8), остальная работа продолжается без сохранения.
* `clearSaved(id)` — один `removeItem` того же ключа. Обращения `clear()`, `key(n)`, `length` и к другим ключам нет (критерий 6; тест записывает каждое обращение и красен на любом другом).
* Что пишется и когда — таблица п. 5.2, столбец «Хранилище». После «Начать заново» ключа нет до первого ответа или смены языка (описание, п. 4.2); перезагрузка в этот момент начинается с `?lang=` или русского.

### 7.3 Чужие данные (Q8)

Страница не знает других арендаторов: `id` берётся из адреса (D16) и только он входит в ключ; чужие ключи в хранилище страница не читает, не перечисляет и не меняет; адреса запросов относительные, и арендатор в них тот же путь `/t/<id>/`.

## 8. Сеть и ошибки (Q10)

`net.js` — единственный файл с обращением к сети. Все запросы идут через `request(path, init)`, внутри — единственный `fetch(`; адреса — только `api/questionnaire?lang=<lang>` и `api/result?lang=<lang>` (относительные, без схемы, без «//»; `<lang>` — одно из трёх значений `LANGUAGES`). `Content-Type: application/json` у `POST`; тело — `JSON.stringify({ answers })`, других ключей нет (сервер отвергает лишние, REQ-056, п. 5.6). Опции `mode`, `referrerPolicy`, `credentials`, `redirect`, `cache` не задаются (Ф10: `Origin` приходит, пока `mode` и политика источника по умолчанию). Предел времени `REQUEST_TIMEOUT_MS = 20000` (`AbortSignal.timeout`) есть у каждого запроса; истечение — тот же исход, что обрыв сети.

### 8.1 Классификация исходов (`NetResult`)

| Что произошло | Исход |
|---|---|
| `fetch` отклонён (сеть, запрет CSP, обрыв по времени) | `{kind: "network"}` |
| ответ с кодом не 200 | `{kind: "server", status, code, message}`: тело разобрано, если JSON-объект; `code` — `error`, если строка; `message` — `message`, если непустая строка до 300 знаков; иначе `null` |
| ответ 200, но тело не JSON, не объект или не прошло проверку формы (п. 4.1) | `{kind: "server", status: 200, code: null, message: null}` |
| ответ 200 с верным телом | `{kind: "ok", body}` |

Исключение в обёртке невозможно по построению: всё тело — внутри `try`.

### 8.2 Что показывает страница

| Исход | Текст блока | Кнопка |
|---|---|---|
| `network` | `net_lost_saved`, если `storageOk`; иначе `net_lost_unsaved` | «Повторить» (`net_retry`) |
| `server`, `code` не `answers_invalid` | `message`, если есть; иначе `server_internal` на языке страницы | «Повторить» |
| `server`, `code = answers_invalid` (only in the blocks `result` and `lang`; in the block `load` the code gives «Повторить», R2) | `message`, если есть; иначе `server_answers_invalid` | «Начать заново» (`card_restart`) вместо «Повторить» |

Блок ставится там, где был запрос (п. 5.2: вместо экрана — при загрузке; под шапкой — при смене языка; под кнопками — при результате). Текст блока — `textContent`. Исключений в консоль страница не пишет: `console` не вызывается; ни одно отклонение обещания не остаётся без обработки (тест слушает `unhandledRejection`). Строки, которые Chrome пишет сам о сетевых отказах и кодах 4xx/5xx, ошибкой страницы не считаются (Ф10, AP-117).

## 9. Язык (критерий 9)

Выбор — правило REQ-061: `chooseLanguage({ query, stored, available })`; `?lang=` читается как `new URLSearchParams(location.search).get("lang")`. Заголовок `Accept-Language` не читается (и ни один модуль страницы не содержит этого слова).

| `?lang=` | Сохранённый | Файл арендатора | Язык страницы |
|---|---|---|---|
| `kk` | нет | `/2` (три языка) | `kk`; запрос ушёл с `lang=kk` |
| нет | нет | `/2` | `ru` |
| нет | `en` | `/2` | `en` |
| `de` | `kk` | `/2` | `kk` (значение вне списка — как отсутствие) |
| `KK` | нет | `/2` | `ru` (регистр важен) |
| `kk` | `en` | `/2` | `kk` (адрес сильнее сохранённого) |
| `kk` | нет | `/1` (только ru) | `ru`: сервер ответил `lang: "ru"`, `languages: ["ru"]`; повторного запроса нет; переключателя нет; в адресе `?lang=kk` остаётся (страница адрес без нажатия не меняет) |

Сохранённый язык берётся из ключа `sai-picker:<id>` (поле `lang`); другого ключа нет. До ответа сервера доступными считаются все три языка (первое обращение). Переключатель — по `languages` анкеты: три кнопки при `["ru","kk","en"]`, нет группы при `["ru"]`. Смена языка — п. 5.2, строки L1, L2. Тексты страницы — `say(key, lang, …)`; страница сама ничего не переводит (критерий 9): каждая строка — ключ `TEXTS` или текст из анкеты.

## 10. Разметка и подписи (контракт для тестов и приёмки)

Вид, размеры, цвета — `docs/design/REQ-057-picker-page-ui.md` (далее «описание»); здесь — какие элементы и атрибуты должны быть, чтобы тест на модели документа и шаг приёмки находили их без догадок. Селекторы тестов — по `data-part`, `data-action`, `role`, тегам и `id`, не по именам классов; классы вёрстки (если нужны для стилей) выбирает разработчик.

### 10.1 `index.html`

Тело: `<main id="app"></main>`, затем `<div id="live" role="status" aria-live="polite" aria-atomic="true"></div>` (в дереве доступности с загрузки; скрыт приёмом «читаемый только программой» — описание, п. 7: `position: absolute`, 1 × 1 px, `overflow: hidden`, `clip`; не `display: none`, не `hidden`, не `visibility: hidden`, AP-107), затем `<script type="module" src="/assets/main.js"></script>`. В `head`: `meta charset`, `meta viewport` (`width=device-width, initial-scale=1`, без запрета масштаба), `<title>Sai</title>`, `<link rel="stylesheet" href="/assets/page.css" />`. Остальное запрещено `SV-7g`: встроенного скрипта и стиля, атрибутов `style` и `on…`, ссылок вне `/assets/`, адресов `http://` и `https://` нет. Без скрипта страница пуста (описание, о15); `noscript` нет.

### 10.2 Дерево документа

`main#app` содержит ровно один элемент `div[data-part="panel"]` с `data-screen` = `loading`, `card`, `question`, `result` или `failure`. Его содержимое по экранам:

| Экран | Содержимое панели (сверху вниз) |
|---|---|
| `loading` | `p[data-part="loading"]` — `quiz_loading`. Шапки нет |
| `failure` | блок связи (ниже). Шапки нет |
| все остальные | `header[data-part="head"]`: `h1[data-part="title"][tabindex="-1"]` — `name`; `div[data-part="languages"][role="group"][aria-label=<language_switcher_label>]` — только если в `languages` больше одного языка — с кнопками `button[type="button"][data-part="lang"][data-action="lang"][lang=<язык>]` (подпись — `LANGUAGE_NAMES[язык]`; у текущей `aria-current="true"`, у остальных атрибута нет); затем служебный контейнер `div[data-part="head-net-slot"]` (есть всегда, пустой, пока блока нет), в нём при блоке `lang` — `div[data-part="net"]`; затем содержимое экрана |
| `card` | `p[data-part="notice"]` — `card_changed` (только когда `notice`); `p[data-part="intro"]` — `intro`; `p[data-part="gives"]` — `card_gives`; `p[data-part="ask"]` — `card_ask`; `p[data-part="count"]` — `card_count` с `{min}`, `{max}` из анкеты, а при `questions_min = questions_max` — `card_count_same` с `{count}`; `div[data-part="actions"]` с кнопками `button[type="button"][data-part="start"][data-action="start"]` (`card_start`, когда нет сохранённого) **или** `[data-part="continue"][data-action="continue"]` (`card_continue`) и `[data-part="restart"][data-action="restart"]` (`card_restart`) (когда есть) |
| `question` | `p[data-part="progress-text"]` — `progress_label`; `div[data-part="bar"][role="progressbar"][aria-valuemin="0"][aria-valuenow=K][aria-valuemax=N][aria-valuetext=<текст прогресса>][aria-label=<progress_name>]` с вложенным `div[data-part="bar-fill"]` (ширина — присвоением `style.width`, `K/N` в процентах с одним знаком); `form[novalidate][data-part="form"]`: `h2#q-title[data-part="q-title"][tabindex="-1"]` — `title`; `fieldset[data-part="fieldset"][aria-labelledby="q-title"]`: `p#q-help[data-part="q-help"]` (только при `help`), поле ответа (ниже), `div#q-error[data-part="q-error"][role="alert"][aria-live="assertive"][aria-atomic="true"]` — **создаётся пустым вместе с экраном и остаётся в дереве**; `div[data-part="actions"]` с кнопками в порядке «Назад» (`[data-action="back"]`, нет на первом видимом), «Пропустить» (`[data-action="skip"]`, только при `required = false`), «Далее» (`button[type="submit"][data-part="next"][data-action="next"]`; когда после этого вопроса нет видимых — `data-action="show-result"` и подпись `quiz_show_result`); затем служебный контейнер `div[data-part="net-slot"]` (есть всегда, пустой, пока блока нет), в нём блок связи `result`, если он есть |
| `result` | `h2[data-part="result-title"][tabindex="-1"]` — `result_soon`; `div[data-part="actions"]` с кнопками `[data-action="edit"]` (`quiz_back`) и `[data-action="restart"]` (`card_restart`) |

Поле ответа:

| Вид | Разметка |
|---|---|
| `single` | `div[data-part="options"]`; на каждый вариант `label[data-part="option"]` с `input[type="radio"][name="answer"][value=<id варианта>]`, `span[data-part="mark"][aria-hidden="true"]` и `span[data-part="option-text"]` — `label` варианта; выбранный ранее ответ — `checked` |
| `multiple` | то же с `input[type="checkbox"][name="answer"]` |
| `number` | `div[data-part="number"]` с `input#q-input[type="number"][inputmode="numeric"][step="1"][min=<min>][max=<max>]` и `label[for="q-input"][data-part="q-unit"]` (текст — `unit`; если `unit` нет — текст заголовка вопроса, подпись скрыта визуально приёмом «читаемая только программой» и помечена `data-hidden="true"`); `p#q-hint[data-part="q-hint"]` — `quiz_number_hint` с `{min}`, `{max}`; `aria-describedby` поля: `q-help` (если есть), `q-hint` и, пока есть ошибка, `q-error`; при неверном числе `aria-invalid="true"` |

* У каждого `input` есть `label` (вариант — оборачивающий `label`, число — `label[for]`) — критерий 2.
* `aria-describedby` у `fieldset` (для `single` и `multiple`): `q-help` (если есть) и, пока есть ошибка, `q-error`.
* Блок связи: `div[data-part="net"][data-kind="load"|"lang"|"result"]` с `p#net-text[data-part="net-text"]` и `button[type="button"][data-part="net-action"][data-action="retry"|"restart"][aria-describedby="net-text"]`; `role="alert"` на блок не ставится (текст не должен прозвучать дважды, описание, п. 4.8).
* В документе нет `dialog`, `[role="dialog"]`, `[aria-modal]`, нет элемента с `position: fixed`, закрывающего страницу (критерий 11).
* Один `main`, один `h1`; `html lang` — язык страницы (`document.documentElement.lang`).
* Тексты арендатора и ответы сервера попадают в документ только через `textContent` или `append(строка)`.

### 10.3 Какие свойства документа использует код (поверхность модели документа)

Код страницы обращается только к: `document.getElementById`, `document.createElement`, `document.documentElement.lang`, `document.title`; у элемента — `setAttribute`, `getAttribute`, `removeAttribute`, `append(...)`, `replaceChildren(...)`, `textContent`, `addEventListener`, `focus({ preventScroll: true })`, `querySelector` (простые селекторы `[data-part="…"]`, `[data-action="…"]`, `#id`, тег), `checked`, `value`, `validity.badInput`, `style.width`; у события — `preventDefault()`, `target`; у окна — `location.search`, `location.pathname`, `history.replaceState`, `scrollTo({…})`, `localStorage.getItem/setItem/removeItem`, `fetch`, `AbortSignal.timeout`, `URLSearchParams`. Таймеров (`setTimeout`, `setInterval`), `requestAnimationFrame`, `matchMedia`, `console` нет. Модель документа в тестах реализует ровно этот перечень (и сверх него `document.activeElement` для проверок фокуса); всё остальное в ней — `TypeError`, и тест краснеет (так же, как `team-web-dom.js`).

## 11. Стили (`page.css`) и CSP

Значения (токены цвета для светлой и тёмной темы, размеры, отступы, скругления, кольцо фокуса, кнопки, полоса) — описание, разделы 8 и 9. Здесь — то, что выполняет разработчик и что проверяет тест по тексту файла (п. 17, `QS-8`).

* Цвета — только через переменные `--page`, `--surface`, `--surface-2`, `--text`, `--muted`, `--line`, `--control`, `--accent`, `--accent-hover`, `--on-accent`, `--accent-soft`, `--accent-ink`, `--focus`, `--error`, `--error-bg`, `--notice-bg`, `--notice-border`, `--track`; значения заданы на `:root` и повторены в `@media (prefers-color-scheme: dark)`; `color-scheme: light dark`. Вне двух блоков с токенами в файле нет шестнадцатеричных цветов, `rgb(`, `hsl(`, названий цветов.
* Нет `@import`, `url(`, `@font-face`, `position: fixed`, `white-space: nowrap`, `text-transform`, `transition`, `animation`, `!important`; шрифты — системные; нет значений `font-size` меньше `1rem` (все — в `rem`); `overflow-wrap: anywhere` у текстов; у кнопок, строк вариантов и поля числа `min-height: 3rem`, у кнопок языка `min-height: 2.75rem` и `min-width: 2.75rem`; кольцо фокуса `outline: 3px solid var(--focus)` со смещением `2px` у `:focus-visible` и у `[tabindex="-1"]:focus`.
* Ширина полосы задаётся только присвоением `style.width` из `screens.js` (CSP не допускает атрибут `style`, Ф10 описания); в файле стилей у заливки ширины нет.
* Контраст: тест по тексту файла считает отношение яркости по формуле WCAG 2.x для пар описания (8.2) в обеих темах и сверяет числа таблицы (в пределах 0,01); пары текста не меньше 4,5 : 1, не текст не меньше 3 : 1. Применение токенов к элементам и размеры 44 × 44 в раскладке проверяет шаг приёмки в браузере (п. 18) — тест Node раскладки не видит.

## 12. Значок страницы (`decisions/0077`, п. 9; ISS-0081, п. 5)

Измерено в Chrome 155 (Ф13): без объявления браузер просит `/favicon.ico`, сервер отвечает закрытым 404 и Chrome пишет в консоль `error network … 404 … favicon.ico`; объявление `data:` нарушает `img-src 'self'` и добавляет вторую строку `error security`; объявление через файл `/assets/…` возможно только для `.html`, `.js`, `.css` — значком они не являются (приём с `page.css` молчит, но это обман: файл стилей грузится дважды). Объявить настоящий значок можно только после правки сервера (тип `.svg` или `.ico` в `STATIC_TYPES`, `config.js`, и их тестов — REQ-056 `done`).

**Решение: исключение, как позволяет `0077`, п. 9.** `index.html` значок не объявляет; в шагах приёмки (п. 18) строка о `/favicon.ico` (код 404, консоль и сеть) **не считается** ошибкой страницы (AP-117); все остальные записи уровня `error` и `warning` в консоли — считаются. Если ORCH хочет настоящий значок, нужна отдельная малая работа над сервером (допустить один тип файла, значок в `public/`, правка нескольких тестов REQ-056) — вопрос О3.

## 13. Удаление заглушки и таблица замен «было → стало»

Правило одно (REQ-056, REQ-057): запрет не исчезает и проверка не слабеет (Q6, AP-068); там, где странице нужно право, тест заменяется проверкой «право только у названного файла, у остальных запрет прежний», а число `test(` в файле не уменьшается. Все правки тестов делает TEST-DESIGNER на шаге 5; FRONTEND-DEV между шагами 2 и 5 называет красные тесты в `result.issues` со строкой этой таблицы (п. 21). Пути и строки — на метке `base/PAGE057-20261021-01`. Прототип: все 16 строк применены (замены без добавленных проверок из строк З5, З6, З15 — добавления это усиление, их держат мутанты п. 20), 276 тестов `picker-*` и `traces-runtime` и вся проверка зелёные (Ф9).

### 13.1 Что удаляется

`tools/src/picker/public/stub.js`; ключ `page_stub_notice` в `texts.js`; строка `<script … src="/assets/stub.js">` в `index.html` (заменена на `main.js`); запись `page_stub_notice` в таблице оракула `SERVER_TEXTS`. Страница не показывает текст `page_stub_notice` и не подключает `stub.js` (критерий 11); `grep -rn 'stub.js' tools/src tools/test` — пусто (код 1), `grep -rn 'stub' tools/src/picker/public/*.html` — пусто. В комментариях `public/` нет номеров требований и слов `handoff`, `ORCH`, `decisions` (`0074`, п. 6); первая строка `texts.js` («design REQ-061, 7 and 8») переписывается строителем при правке файла (`0077`, п. 11).

### 13.2 Таблица замен

| № | Файл:строка (метка) | Тест | Было | Стало | Зачем |
|---|---|---|---|---|---|
| З1 | `tools/test/picker-server-helpers.js:92–96` | таблица оракула `SERVER_TEXTS` | 12 записей: 11 `server_*` и `page_stub_notice` (три перевода) | 11 записей; `page_stub_notice` удалена | ключ удалён из `texts.js` (критерий 11) |
| З2 | `picker-server-faults.test.js:844` | `SF-6g` | `assert.equal(Object.keys(SERVER_TEXTS).length, 12)` | `…, 11)` | следует из З1; краснеет сразу после З1, если не поправить |
| З3 | `picker-server-units.test.js:3` | заголовок файла | слово «stub» в перечне | «the main file of the page» | поиск `stub` не находит ссылок; проверки не затрагивает |
| З4 | `picker-server-units.test.js:176` | `SU-2` (таблица `routeOf`, 60 путей) | строка `["/assets/stub.js", { kind: "asset", name: "stub.js" }]` | `["/assets/main.js", { kind: "asset", name: "main.js" }]` | файл удалён; число строк 60 то же |
| З5 | `picker-server-units.test.js:612–631` | `SU-10` (`SOURCE_KEYS` и тело) | выражение `"(server_[a-z_]+\|page_stub_notice)"` по `src/picker/*.js`, второй цикл по `public/stub.js` (`TEXTS\.(page_stub_notice)`); название «11 ключей `server_*` и `page_stub_notice`» | выражение `"(server_[a-z_]+)"`, второго цикла нет; название «11 ключей `server_*`»; **добавлено** `assert.equal(Object.hasOwn(TEXTS, "page_stub_notice"), false)`; остальное (тексты равны таблице оракула, одинаковые подстановки, слова-запреты ru/kk/en, слова о цене, «каждый ключ используется») то же | критерий 11; без ослабления, проверка удаления даже строже |
| З6 | `picker-server-units.test.js:683–722` | `SU-11` | `stub.js` загружается в Node с подменёнными `location` (`search`) и `document` (объект с `documentElement.lang`, `getElementById`); 5 случаев (пусто, `?lang=kk`, `?lang=en`, `?lang=de`, `?lang=KK`): язык документа и текст `#app` равны `TEXTS.page_stub_notice[язык]` и таблице оракула | `main.js` загружается в Node так же, с подменой `location` (`search`, `pathname` = `/t/uchet-pro/`), `document` (модель `picker-page-dom.js`, п. 10.3) и `fetch` (ответ собран настоящим `publicQuestionnaire(tenantInLanguage(…))` для языка из запроса); те же 5 случаев: язык документа = ожидаемый, текст карточки содержит `TEXTS.card_gives[язык]` и `TEXTS.card_ask[язык]` и название арендатора на этом языке; **добавлено**: запрос ушёл с `lang=<язык>` (счётчик подмены) | критерий 11: «те же пять случаев для главного файла страницы» |
| З7 | `picker-server.test.js:310` | `SV-1f` | `names.includes("stub.js")` | `names.includes("main.js")`; проверка каждого файла (тип, байты) та же | файл удалён |
| З8 | `picker-server.test.js:1621` | `SV-7a` | запрос `["GET", "/assets/stub.js"]` среди шести видов запросов | `["GET", "/assets/main.js"]` | файл удалён; отказ по `Host` и «ничего не читается» те же |
| З9 | `picker-server.test.js:1871` | `SV-7e` | `got.set("asset", … "/assets/stub.js")` (вид ответа «файл страницы») | `… "/assets/main.js"`; 14 видов ответа те же | файл удалён: без замены вид «asset» отвечал 404 |
| З10 | `picker-server-property.test.js:49` | `SP-1` | кусок пути `"stub.js"` среди кусков генератора | `"main.js"` | поиск ссылок; зерно 56001 и число строк те же |
| З11 | `picker-server-property.test.js:83` | `SP-2` | основа пути `"/assets/stub.js"` | `"/assets/main.js"` | то же; без замены часть путей стала бы 404 вместо 200 |
| З12 | `picker-server-faults.test.js:273` | `SF-6o` | `unknown("/assets/stub.js")` в пустой папке страницы | `unknown("/assets/main.js")` | поиск ссылок |
| З13 | `picker-server-faults.test.js:300` | `SF-6c` (`ALLOW`) | `["asset", "/assets/stub.js", "GET"]` | `["asset", "/assets/main.js", "GET"]` | файл удалён: 405 на неверный метод требует существующего файла (порядок проверок: файл, потом метод) |
| З14 | `picker-server-faults.test.js:887, 893` | `SF-6h` | сбой `openSync` на пути `PUBLIC_DIR/stub.js` и запрос `/assets/stub.js` | пути `main.js`; ожидаемое то же (500 `internal`, одна строка журнала) | после удаления файла проверка оставалась зелёной, но внедряла сбой на несуществующий файл |
| З15 | `picker-lang.test.js:1608–1629` | `LG-10c` | в **каждом** `.js` файле `public/` нет слов `http://`, `https://`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `child_process`, `Math.random` (комментарии тоже) | то же для каждого файла, **кроме** слова `fetch(` в файле `net.js`; все остальные слова в `net.js` и `fetch(` во всех прочих файлах по-прежнему запрещены; **добавлено**: `net.js` есть в `public/` и число `fetch(` в нём ровно 1; заголовок теста дополнен «except the one in net.js» | `LG-10c` не назван в требовании (AP-068: сосед нашёл прототип, Ф6, Ф8); без исключения страница с `net.js` невозможна |
| З16 | `traces-runtime.test.js:10–19` | `TR-4b` (`NETWORK_FILES`) | 8 имён, из подбора `picker/server.js` | + `"picker/public/net.js"`; сравнение «найденное = перечень» прежнее | критерий 10: файл с `request(path, init)` входит в перечень |

### 13.3 Что не меняется и почему запрет цел

| Тест | Запрет | Что с ним |
|---|---|---|
| `TR-4e` | в страницах подбора из `NETWORK_FILES` ровно один `fetch(` внутри `async function request(path, init) {`; адреса `API_*` без схемы и «//»; нет `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `new URL(`, `location.origin`, `importScripts`; в остальных `public/*.js` — ноль `fetch(` | ветка уже есть (REQ-056, З13 того проекта, Ф5); `net.js` в `NETWORK_FILES` (З16) проходит её, остальные файлы — ветку «ноль `fetch(`»; текста теста не меняю |
| `TR-4d` | в файлах `NETWORK_FILES` нет `://` и `host:` кроме разрешённых | распространяется на `net.js` автоматически: в нём нет `://`, слова `host:` и строки `host,` (ловушка Л4) |
| `TR-4f` | в `public/` нет `http://` и `https://` кроме `127.0.0.1`, `localhost` | не меняется; комментарии тоже; SVG с `xmlns` не используется |
| `SV-7g` | разметка `index.html` (п. 10.1) | не меняется; новая разметка ей удовлетворяет (Ф9) |
| `SV-7h` | в `.js`, `.html`, `.css` нет `http://`, `https://`; файлов не меньше трёх | не меняется |
| `TX-6a`…`TX-6f`, `LG-4c`, `LG-10d` | закрытый перечень экспортов `texts.js` (5), правила ключей, чистота файла | не меняются; новые ключи проверяет `TX-6b` сама (Ф18); `say.js` — отдельный файл, поэтому экспортов у `texts.js` не прибавляется |
| `PK-7a`, `PK-7c`, `PK-6e`, `PK-8c`, `PE-8d` | запреты, перечни модулей `src/picker/*.js` | страница лежит в `public/`, перебор верхнего уровня её не видит; ни одного нового файла в `src/picker/` нет |
| `SV-1d` | `GET` страницы отдаёт байты `public/index.html` | байты берутся из файла — новый `index.html` подходит |
| `lint`, `format:check` | `--max-warnings 0`; prettier | блок `globals.browser` для `public/` есть (Ф4); перед сдачей — `cd tools && npx prettier --write src/picker/public test` |
| `eslint.config.js` | — | **не меняется**; критерий 10: `git diff base/PAGE057-20261021-01 -- tools/eslint.config.js` пуст (вопрос О4) |

Проверка «число проверок не уменьшилось» (команда TEST-RUNNER, взята из REQ-056):

    for f in $(git ls-tree --name-only base/PAGE057-20261021-01 tools/test/ | grep 'picker-.*[.]test[.]js$\|traces-runtime[.]test[.]js$'); do a=$(git show base/PAGE057-20261021-01:$f | grep -c '^test('); b=$(grep -c '^test(' $f); [ $b -ge $a ] || echo "меньше: $f"; done

Ожидается пусто.

## 14. Тексты страницы (`texts.js`)

Ключи — из описания (раздел 12) и один добавленный проектом (`result_soon`). **Русский текст — контракт** (описание); kk и en — **предложение проекта**, проверенное механически на прототипе (Ф18: правила `TX-6b`, запрет слов ru/kk и en, 18 слов, подстановки, `traces`); перевод поручается FRONTEND-DEV (подшаг 57a), затем читатель по условию (г) LANG061 (BA-ANALYST, новый запуск без кода и документов Sai, только пары «ключ — русский — перевод»; `decisions/0070`, п. 10; ORCH вписывает в задание ворот). Проверка казахских строк знающим человеком выпуск не ждёт (`0072`, п. 2). В последней колонке — слов в самой длинной фразе (ru/kk/en).

| Ключ | Где | ru (контракт) | kk (предложение) | en (предложение) | слов |
|---|---|---|---|---|---|
| `card_gives` | карточка, «что вы получите» | В конце вы увидите, что вы получите: что входит, чем это поможет и что делать дальше. | Соңында нені алатыныңызды көресіз: не кіретінін, қалай көмектесетінін және әрі қарай не істеу керегін. | At the end you will see what you get: what is included, how it helps, and next steps. | 16/14/18 |
| `card_ask` | карточка, призыв | Ответьте на вопросы, и сайт подберёт вам решение. | Сұрақтарға жауап беріңіз, сайт сізге шешім таңдап береді. | Answer the questions, and the site will pick a solution for you. | 8/8/12 |
| `card_count` | число вопросов; `{min}`, `{max}` | Вопросов: от {min} до {max} | Сұрақтар: {min} бастап {max} дейін | Questions: from {min} to {max} | 5/5/5 |
| `card_count_same` | то же при равных числах; `{count}` | Вопросов: {count} | Сұрақтар: {count} | Questions: {count} | 2/2/2 |
| `card_start` | главная кнопка карточки | Пройти опрос | Сауалнамадан өту | Take the survey | 2/2/3 |
| `card_continue` | кнопка при сохранённом | Продолжить | Жалғастыру | Continue | 1/1/1 |
| `card_restart` | кнопка карточки, блока ошибки и временного экрана результата | Начать заново | Қайтадан бастау | Start over | 2/2/2 |
| `card_changed` | уведомление об изменении анкеты | Анкета изменилась. Начните, пожалуйста, заново. | Сауалнама өзгерді. Қайтадан бастаңыз. | The questionnaire has changed. Please start again. | 3/2/4 |
| `progress_label` | «Вопрос K из N»; `{current}`, `{total}` | Вопрос {current} из {total} | {total} сұрақтың {current}-і | Question {current} of {total} | 4/4/4 |
| `progress_name` | подпись полосы для программы чтения | Ход опроса | Сауалнама барысы | Survey progress | 2/2/2 |
| `quiz_next` | кнопка | Далее | Әрі қарай | Next | 1/2/1 |
| `quiz_back` | кнопка; на временном экране результата — «изменить ответы» | Назад | Артқа | Back | 1/1/1 |
| `quiz_skip` | кнопка | Пропустить | Өткізіп жіберу | Skip | 1/2/1 |
| `quiz_show_result` | кнопка | Показать результат | Нәтижені көрсету | Show the result | 2/2/3 |
| `quiz_required` | обязательный вопрос без ответа | Ответьте на этот вопрос, чтобы продолжить. | Жалғастыру үшін осы сұраққа жауап беріңіз. | Answer this question to continue. | 6/6/5 |
| `quiz_number_range` | неверное число; `{min}`, `{max}` | Введите целое число от {min} до {max}. | {min} мен {max} арасындағы бүтін санды енгізіңіз. | Enter a whole number from {min} to {max}. | 7/7/8 |
| `quiz_number_hint` | подсказка под полем числа; `{min}`, `{max}` | От {min} до {max} | {min} бастап {max} дейін | From {min} to {max} | 4/4/4 |
| `quiz_loading` | загрузка анкеты | Загружаем анкету | Сауалнама жүктелуде | Loading the questionnaire | 2/2/3 |
| `quiz_sending` | запрос результата | Подбираем решение | Шешім таңдалуда | Picking a solution | 2/2/3 |
| `net_lost_saved` | нет связи, хранилище работает | Нет связи. Ваши ответы сохранены. Попробуйте ещё раз. | Байланыс жоқ. Жауаптарыңыз сақталды. Қайталап көріңіз. | No connection. Your answers are saved. Please try again. | 3/2/4 |
| `net_lost_unsaved` | нет связи, хранилище недоступно | Нет связи. Не закрывайте страницу, ответы пока только здесь. Попробуйте ещё раз. | Байланыс жоқ. Бетті жаппаңыз, жауаптар әзірге тек осында. Қайталап көріңіз. | No connection. Do not close the page, the answers are only here for now. Please try again. | 7/6/12 |
| `net_retry` | кнопка блока связи | Повторить | Қайталау | Try again | 1/1/2 |
| `result_soon` | временный экран результата | Результат скоро появится на этой странице. | Нәтиже осы бетте жақында шығады. | The result will appear on this page soon. | 6/5/8 |

Правила: ключи строчными латинскими буквами, цифрами и «_»; подстановки `{min}`, `{max}`, `{count}`, `{current}`, `{total}` одинаковы во всех языках; в ключах страницы нет слов `арендатор`, `конфигурац`, `JSON`, `API`, `сервер`, `tenant`, `id` (en — `tenant`, `configur`, `JSON`, `API`, `server`, `id`); на ru нет «ты, тебя, тебе, тобой, твой, твоя, твоё, твои»; нет слов `гарант…`, `100 %`, `кепіл`, `guarant` (REQ-058, критерий 6). Новый экспорт в `texts.js` не заводится (TX-6a): подстановку делает `say.js`. Уже есть и используются: `language_switcher_label` (подпись группы языков), `server_internal` и `server_answers_invalid` (запасные тексты блока связи, п. 8.2); остальные `server_*` страница по ключам не вызывает (текст приходит от сервера в поле `message`). Кнопки языка — `LANGUAGE_NAMES`.

## 15. Пути отказа (Q10, Q5): что видит человек и что остаётся неизменным

Во всех строках: страница не падает, в консоль не уходят исключения (`console` не вызывается, нет необработанных отклонений), ответы посетителя не теряются, пока страница открыта; хранилище меняется только так, как сказано; сервер не получает лишних запросов.

| Случай | Что видит человек | Что неизменно |
|---|---|---|
| сеть недоступна при загрузке анкеты | панель без шапки: `net_lost_saved` (или `net_lost_unsaved`, если хранилище недоступно) и «Повторить»; фокус на кнопке | хранилище не пишется; повтор ждёт нажатия, сам не идёт |
| сервер ответил кодом не 200 на анкету | `message` сервера или `server_internal`; «Повторить» | то же |
| 200, но анкета не прошла проверку формы (п. 4.1) | как «ошибка сервера» | то же |
| хранилище бросает при чтении и записи | анкета проходится без сохранения; карточка без «Продолжить»; при потере связи `net_lost_unsaved` | ответы в памяти страницы; ни одного обращения после первого сбоя |
| значение в хранилище битое, чужого вида, огромное, с `__proto__` | как первый визит (пустое), язык берётся, если верный; ничего не бросается | значение не стирается, пока человек не ответит |
| версия анкеты изменилась | карточка и `card_changed`; ответы и позиция стёрты, язык сохранён | перезагрузка после этого — обычная карточка |
| сохранённая позиция ведёт мимо обязательного без ответа | «Продолжить» открывает не дальше первого такого вопроса | запрос результата не уйдёт с неполными ответами |
| «Далее» без ответа на обязательный; неверное число | сообщение в элементе `q-error` рядом с вопросом, фокус на первом поле; `aria-invalid` у числа | ответы и позиция не меняются, запросов и записей нет |
| сеть пропала при «Показать результат» | под кнопками: текст связи и «Повторить» | экран вопроса и ответы на месте; повтор шлёт те же ответы |
| `answers_invalid` | текст сервера и «Начать заново» | хранилище не трогается, пока человек не нажмёт кнопку |
| сеть пропала при смене языка | блок под шапкой, язык прежний; «Повторить» повторяет смену | ответы, позиция, `K`, `N` прежние; в хранилище язык не меняется |
| нажатие языка во время запроса результата | ничего; поля вопроса закрыты (`fieldset[disabled]`) | запрос идёт как шёл на прежнем языке; страница, адрес, язык документа, хранилище и результат — на прежнем языке; ответы не меняются (D19, L3) |
| нажатие языка до «Показать результат», ответ на его запрос анкеты приходит после того, как ушёл запрос результата | результат на прежнем языке | язык страницы, адрес, язык документа и хранилище не изменены; ответ отброшен (D19, L3 (b)) |
| нажатие языка на экране результата, затем «Назад» или «Начать заново» раньше конца смены | экран вопроса или карточка, как открыл «Назад» или «Начать заново» | новых запросов нет (если ответ анкеты ещё не пришёл); ответ отброшен: язык, адрес, хранилище, результат не изменены; следующее нажатие языка работает как обычно (D19, L4) |
| блок ошибки загрузки анкеты (`net.kind = "load"`) | текст ошибки и только «Повторить»; кнопки «Начать заново» нет | хранилище не тронуто (R2, `netBlock`) |
| потеря фокуса, пока поля закрыты | фокус не на поле во время запроса; после ответа — на кнопке блока связи (сбой) или на заголовке результата (успех) | ответы и позиция не меняются (п. 5.4) |
| два нажатия языка подряд | действует последнее; ответ на первое отбрасывается | состояние соответствует последнему нажатию |
| запрос не отвечает 20 с | как «сеть недоступна» | то же |
| ответ на `POST` 200, но не по форме | как «ошибка сервера» | ответы на месте |
| путь страницы не `/t/<id>/` (например, `/assets/index.html`) | анкета запрашивается относительным адресом, сервер отвечает 404 — блок с его текстом | хранилище не используется (нет `id`) |
| значение `?lang=` вне списка | как отсутствие (п. 9) | — |
| тексты арендатора с разметкой (`<b>`, `&amp;`) | показаны буквами | ни `innerHTML`, ни разбора |

## 16. Таблица «критерий → элемент проекта → тест» (Q5)

Тесты пишет TEST-DESIGNER (шаг 5). Критерии 1–9 и 11 называют файл `tools/test/picker-page.test.js` — тесты критериев лежат в нём (идентификаторы `QP-<критерий><буква>`); чистые модули — `picker-page-model.test.js` (`QM-…`); тексты файлов — `picker-page-static.test.js` (`QS-…`); шаги в браузере — `ПР-…` (п. 18, проходит UAT-RUNNER по сценарию BA-ANALYST). Подробности каждого теста — п. 17.

| Критерий | Элемент проекта | Тест | Что краснеет при нарушении |
|---|---|---|---|
| **1. Стартовый экран** | п. 5.2 (B1, C1–C3), п. 10.2 (карточка), D5 | `QP-1a` (состав), `QP-1b` («Продолжить», «Начать заново» стирает ключ), `QP-1c` (ключ только с языком), `QP-1d` («Пройти опрос» ничего не пишет и не просит), `QP-1e` (`card_count_same`) | пропавшее поле карточки; «Начать заново» не стирает ключ или стирает чужой; сохранённое без ответов считается сохранённым |
| **2. Один вопрос, «Далее», «Назад», «Пропустить»** | п. 5.2 (Q1–Q4), п. 10.2 (поле ответа, кнопки), `flow.js` (`verdict`, `readNumber`, `nextVisible`, `previousVisible`) | `QP-2a`…`QP-2j`; `QM-2c`, `QM-2d`, `QM-2e` | два вопроса на экране; нет `label`; общий `name` потерян; «Назад» на первом; «Пропустить» у обязательного; переход без ответа; сообщение вне `aria-live`; элемент ошибки создаётся лишь при ошибке (AP-107); «Показать результат» не на последнем |
| **3. Прогресс честный** | п. 5.3, `flow.js` (`progress`), п. 10.2 (`progressbar`) | `QP-3a`…`QP-3e`; `QM-2a` (таблица `S1` и свойство «не растёт» на 300 сгенерированных файлах) | рост `N` вперёд; `K` по месту в файле; скрытый с условием на выше стоящий вопрос посчитан; цепочка скрытия не стёрта; нет атрибутов полосы |
| **4. Ответы сохраняются** | п. 7, п. 5.2 (B0, B1, Q1, Q5), `store.js`, `flow.js` (`pruneAnswers`, `entryQuestion`) | `QP-4a`…`QP-4g`; `QM-3a`…`QM-3d`; шаг `ПР-6` (перезагрузка в браузере) | потеря ответа при перезагрузке; сохранённое при другой версии; исключение хранилища роняет страницу; ответ на скрытый остался |
| **5. Клавиатура и доступность на стенде** | п. 5.4, п. 10.2–10.3, п. 11, описание (6, 7, 8.2, 8.5, 9, 10) | модель документа: `QP-5a`, `QP-5a2` (фокус), `QP-5b` (подписи), `QP-5c` (порядок обхода); по тексту стилей: `QS-8` (токены, пары контраста, минимальные размеры, кольцо); в браузере: **`ПР-3`, `ПР-4`, `ПР-5`** — окна 1470 × 784, 390 × 844, 320 × 568 на ru, kk, en: только клавиатура до результата, `document.activeElement`, кольцо фокуса (снимок), `scrollWidth ≤ clientWidth`, `getBoundingClientRect` ≥ 44 × 44, контраст по `getComputedStyle` | фокус не на заголовке; нет `label`; горизонтальная прокрутка; цель меньше 44 × 44; контраст ниже 4,5 : 1 |
| **6. Хранилище — только своего арендатора** | п. 7, `store.js`, D16 | `QP-6a`…`QP-6d`; `QM-3d`, `QM-3e` | чужой ключ прочитан или записан; перечисление хранилища; контакты в значении; нет `lang` в значении |
| **7. Нет связи** | п. 8, п. 15, `net.js`, п. 5.2 (B2, Q6, L1, R1) | `QP-7a`…`QP-7g`; `QM-4a`…`QM-4d`; шаг `ПР-8` | не тот текст для своего случая; «Повторить» теряет ответы; исключение в консоль; запрос без предела времени |
| **8. Понятные тексты** | п. 14, `texts.js`, `say.js` | `QP-8a`, `QP-8b`, `QP-8c`; `QM-5a`; общие `TX-6b` (REQ-061), `SU-10`; команды `cd tools && npm run check` (код 0, «skipped 0», «todo 0») и `npm run traces` (код 0) | фраза длиннее 18 слов; слово-запрет; «ты» на ru; посторонний текст на экране |
| **9. Язык** | п. 9, п. 5.2 (L1, L2), `chooseLanguage` (REQ-061) | `QP-9a`…`QP-9l` (`QP-9f2`, `QP-9i`…`QP-9l` добавлены при сборке); шаг `ПР-7` (три языка до результата в браузере) | язык не по правилу; перезагрузка при смене; ответы или позиция потеряны; запись не в тот ключ; `aria-current`, `lang` кнопок |
| **10. Охранные тесты и lint** | п. 8, п. 4.6, таблица замен З15, З16, Ф4–Ф5 | `TR-4b`, `TR-4d`, `TR-4e`, `TR-4f` (прежние, с З16), `LG-10c` (с З15), `QS-4`, `QS-5`; команды TEST-RUNNER: `grep -rnE 'fetch[(]' tools/src/picker/public/` — одна строка в `net.js` внутри `request`; `grep -rnE 'https?://' tools/src/picker/public/` — пусто (код 1); `cd tools && npm run lint` — код 0; `git diff base/PAGE057-20261021-01 -- tools/eslint.config.js` — пусто (О4) | второй `fetch(`; `fetch(` вне `request`; файл не в `NETWORK_FILES`; адрес со схемой; блок `globals.browser` исчез |
| **11. Карточка сайта** | п. 5.2 (B1, C1), п. 10.2 (карточка), п. 12, п. 13.1 | `QP-11a`…`QP-11d`; `QS-1`, `QS-3`, `QS-11`; таблица замен З1–З14 (SU-10, SU-11 и тесты с `/assets/stub.js`); команды: `grep -rn 'stub.js' tools/src tools/test` — пусто (код 1); `grep -rn 'stub' tools/src/picker/public/*.html` — пусто; `grep -rnE 'alert[(]\|confirm[(]\|prompt[(]\|showModal\|beforeunload' tools/src/picker/public/` — пусто; шаг `ПР-2` (окна и языки, кнопка ≥ 44 × 44 и видна в 390 × 844); читатель ключей `card_*` по условию (г) LANG061 | состав карточки; `name` не первым; блокирующее окно; заглушка осталась; кнопка за краем окна |
| **Планка** Q7–Q12, R2, R3 | п. 22 | `TR-4f`, `SV-7h` (адресов нет), `QP-6b` (контактов нет, Q7), `QP-6a` (Q8), `QP-7a`…`QP-7g` (Q10), записи п. 24 (Q12) | — |

## 17. Каталог тестов

Общие договорённости: страница запускается функцией `loadPage(t, options)` (помощник `picker-page-helpers.js`): подменяет `globalThis.document` (модель `picker-page-dom.js`), `location`, `history`, `localStorage`, `fetch`, `scrollTo`, импортирует `app.js` и вызывает `start()`, затем даёт `await settle()` (несколько оборотов `setImmediate`, пока подмены `fetch` не ответили); в `t.after` подмены возвращаются. Подмена `fetch` строит анкету настоящей цепочкой `checkBytes → tenantInLanguage → publicQuestionnaire` (то, что отдаст сервер), считает запросы и записывает адреса, методы, тела и `signal`; подмена хранилища записывает каждое обращение (`getItem`, `setItem`, `removeItem`, и любое другое имя — ошибка теста) и умеет бросать исключение на чтении, записи или обоих. Оракулы (ожидаемый текст, ожидаемые числа) тест строит сам из файла арендатора и таблиц этого проекта, а не из модулей страницы. Тесты отказа проверяют, что **состояние не изменилось**: ответы, позиция, значение в хранилище, число запросов. Время не измеряется, таймеров нет. Зерно генераторов закреплено (`57001` и далее). Файлы и помощники называются `picker-page*` и подпадают под `PK-8d` (нет `skip`, `todo`, путей этого компьютера).

### 17.1 `picker-page.test.js` — критерии на модели документа

| Тест | Что проверяет |
|---|---|
| **QP-0a** | The model of the document holds the page to its surface: `innerHTML`, `insertAdjacentHTML`, a parent node, a body, `document.write` and a style other than the width are errors in the model, so a page that reaches for them turns its test red |
| **QP-0b** | The model acts as a browser where the tests rely on it: a control in a shut fieldset gets no click, no change and no focus; a number field gives `''` and `badInput` for a text that is not a number; removing the node with the focus moves the focus to the body; a radio button turns the others of its name off |
| **QP-0c** | A node of the model prints short: a failed check with a node, a text, the document or the node as the page sees it shows the tag, the id and the classes and never the tree, in `util.inspect` and in the message of `assert` (the fields that lead to the tree are not enumerable, because `assert` prints without custom inspection and at depth 1000), so one failure cannot take gigabytes (rework 20, F3) |
| **QP-1a** | Первая страница `/t/uchet-pro/` без сохранённого на ru: текст панели состоит из названия, вступления, `card_gives`, `card_ask`, «Вопросов: от 8 до 12» (числа — из анкеты), одной кнопки «Пройти опрос»; нет «Продолжить», «Начать заново», уведомления |
| **QP-1b** | Хранилище с ответами (позиция — третий вопрос): кнопки «Продолжить» и «Начать заново», «Пройти опрос» нет; «Начать заново» вызывает ровно один `removeItem("sai-picker:uchet-pro")`, открывает первый вопрос, ни один вариант не выбран, чужие ключи не тронуты; следующая запись (ответ) содержит один ответ; (rework 24, F1: the same on the temporary screen of the result, rule C3 — one `removeItem`, the key gone, no request, the first question with nothing chosen, the next answer writes one answer, a reload gives the card with 'Take the survey' and no 'Continue') |
| **QP-1c** | Ключ, где только `lang` (и пустые `answers`, `current: null`): карточка с «Пройти опрос» (rework 20, F1: also a place that is no question of the file, a place of 64 signs, and a place that is a question hidden by the answers: no 'Continue') |
| **QP-1d** | «Пройти опрос»: записей в хранилище 0, запросов к серверу после загрузки анкеты 0; открыт первый вопрос |
| **QP-1e** | Файл из трёх вопросов без условий (`questions_min = questions_max = 3`): «Вопросов: 3»; у `uchet-pro` «от 8 до 12» (`card_count_same` и `card_count`) |
| **QP-2a** | `single`: на экране один `h2`, одна `form`; радиокнопки с общим `name`; значение — `id` варианта; у каждого `input` есть оборачивающий `label`; подписи — `label` варианта |
| **QP-2b** | `multiple`: флажки; выбор нескольких; запись в порядке вариантов; снятие последнего флажка стирает ответ |
| **QP-2c** | `number`: `type=number`, `min`, `max` из анкеты, `label[for]` с `unit`; без `unit` подпись — заголовок вопроса (`data-hidden`); подсказка «От {min} до {max}»; `aria-describedby` поля |
| **QP-2d** | «Назад»: нет на первом видимом; на втором ведёт к первому с выбранным ответом; открыт предыдущий **видимый** (случай со скрытым между ними — на `S1`); ответ текущего вопроса сохранён; ход без нового ответа пишет позицию: после «Далее», после «Назад» и после «Назад» с экрана результата в хранилище новая позиция (запись в журнале у «Назад» с результата), новая загрузка и «Продолжить» открывают этот вопрос (rework 17, F2) (rework 20: a value oracle for 'Back' from the result - the stored place is overwritten, 'Back' stores the last question again) |
| **QP-2e** | «Пропустить»: только при `required = false` (на `uchet-pro` — `budget`); стирает ответ и ведёт дальше; на последнем необязательном запрашивает результат без этого ответа (тело запроса проверено); при отказе сети после «Пропустить» на последнем необязательном (выбор и число) поле пусто, в хранилище нет ответа, «Повторить» шлёт тело без него (rework 17, F4) (rework 20: F10 - a number outside the limits refused by the main button, then 'Skip' with the net refused: field, message, `aria-invalid` and the mention in `aria-describedby` are gone, the block of kind result stands, no stored answer; F4 - the skipped text and the message do not come back at a change of the language; F9 - a text outside the limits does not move to the next or the earlier number question) |
| **QP-2f** | «Далее» без ответа на обязательный: экран и позиция те же, в `#q-error` текст `quiz_required`; элемент `role=alert`, `aria-live=assertive` существовал до ошибки (был в дереве пустым); фокус на первом `input`; записей и запросов нет; изменение ответа очищает сообщение |
| **QP-2g** | Число: `""` у обязательного — `quiz_required`; `badInput`, `"1e3"`, `"2.5"`, `"+5"`, ниже `min`, выше `max` — `quiz_number_range` с границами; необязательное с неверным текстом — то же, и для числа вне границ (`"11"`, `"0"`), и для текста, который не число (`"abc"`, `badInput`): вопрос и хранилище не меняются, запрос не уходит (rework 17, F5); «Пропустить» стирает поле; `"007"` — ответ 7; `"-0"` — 0; `aria-invalid` ставится и снимается |
| **QP-2h** | На последнем видимом вместо «Далее» — `data-action="show-result"`, подпись `quiz_show_result`; ответ, открывший вопросы ниже, возвращает «Далее»; это пересчитывается при каждом изменении |
| **QP-2i** | Порядок кнопок в дереве: «Назад», «Пропустить», «Далее»; отправка формы (событие `submit`) = «Далее»; `preventDefault` вызван; при `sending` отправка игнорируется |
| **QP-2j** | Enter in the field of a number works as 'Next': with a right number it goes on, with a wrong one or an empty one of a required question it stays and says why; Enter on a choice of radio buttons likewise |
| **QP-3a** | «Вопрос K из N» и `role=progressbar`: `aria-valuemin=0`, `aria-valuenow=K`, `aria-valuemax=N`, `aria-valuetext` — тот же текст, `aria-label=progress_name`; `style.width` заливки — `K/N` в процентах с одним знаком; `#live` получает текст прогресса при переходе |
| **QP-3b** | 200 путей ответов вперёд на каждом из двух демо-арендаторов (зерно 57001): число `N` на каждом шаге не больше, чем на предыдущем; в конце `K = N` |
| **QP-3c** | Маленький файл `S1` (п. 5.3): строки 1–7 таблицы — текст «Вопрос K из N» буквально на каждом шаге и после «Назад» со сменой ответа; ответ на `b` удалён из значения хранилища |
| **QP-3d** | Файл из трёх вопросов (случай О1): при ответе `y` на `b` страница показывает литерал, выбранный ORCH (по умолчанию «Вопрос 2 из 3»); тест помечен «зависит от ответа на О1» |
| **QP-3e** | Смена ответа на более раннем вопросе, которая скрывает вопрос с ответом и открывает другой: `N`, `K`, ответы и значение в хранилище — по таблице (случай на `uchet-pro`: `business` с `retail` на `wholesale` открывает `documents`) |
| **QP-4a** | Ответ на третий вопрос; новая загрузка с тем же хранилищем: «Продолжить»; после него открыт третий вопрос и три ответа выбраны (rework 20, F1: the first question is optional, 'Next' with no answer, a new load - 'Continue' is offered and opens the second question) |
| **QP-4b** | Хранилище с другой версией: ответы и позиция стёрты, показан `card_changed`, в значении остался `lang`; следующая загрузка — обычная карточка без уведомления; версия без ответов — без уведомления; каждое условие «есть что терять» отдельно (rework 17, F1): ответы при позиции на первом вопросе и позиция не на первом вопросе без ответов дают уведомление, значение очищено, язык остался |
| **QP-4c** | Хранилище бросает при чтении; при записи; при обоих: анкета проходится до запроса результата, исключений нет, «Продолжить» нет; после первого сбоя обращений к хранилищу нет |
| **QP-4d** | Ответ на `business` меняется так, что `documents` скрыт: ответа на `documents` в значении нет (и в теле запроса результата) |
| **QP-4e** | 12 видов битых значений (не JSON, `null`, список, число, `format: 2`, `version` не hex, `answers` — список, значение 40 000 знаков, `__proto__` в ответах…): первая загрузка как чистая, исключений нет, значение не стёрто до первого ответа; после загрузки `({}).polluted === undefined` |
| **QP-4f** | Значение с неизвестным `id`, ответом не того вида, ответом на скрытый вопрос: «Продолжить» открывает вопрос, ответы допустимые остаются, остальные отброшены |
| **QP-4g** | Позиция в значении дальше первого обязательного без ответа: «Продолжить» открывает этот вопрос |
| **QP-5a** | После каждого перехода (`Пройти опрос`, `Продолжить`, `Далее`, `Назад`, `Пропустить`, повтор после сбоя) `document.activeElement` — заголовок нового экрана с `tabindex=-1`; после ответа 200 — заголовок временного экрана; при отказе «Далее» — первый `input`; при блоке связи — его кнопка; после смены языка — кнопка языка; первая отрисовка карточки фокус не двигает; перед `focus` вызван `scrollTo({top: 0, left: 0, behavior: "instant"})` |
| **QP-5a2** | After a failure of the net the focus is on the button of the block; 'Try again' after a failed load puts it on the heading of the card; a new load with saved answers and 'Continue' put it on the heading of the question |
| **QP-5b** | Подписи: `fieldset[aria-labelledby=q-title]`; `aria-describedby` содержит `q-help`, а при ошибке и `q-error`; `aria-invalid` у числа; у кнопки блока связи `aria-describedby=net-text` и нет `role=alert` у блока; `#live` в `index.html` с тремя атрибутами; кнопки языка с `lang` |
| **QP-5c** | Порядок элементов в дереве: кнопки языка → поле ответа → «Назад» → «Пропустить» → «Далее» |
| **QP-6a** | Хранилище заранее с `sai-picker:svet-marketing` и `foreign`; полный проход `uchet-pro` с сменой языка: все обращения — `getItem`/`setItem`/`removeItem` и только с ключом `sai-picker:uchet-pro`; чужие значения те же; нет вызовов `length`, `key`, `clear` |
| **QP-6b** | Каждое записанное значение разбирается: ровно ключи `format`, `version`, `lang`, `current`, `answers`; в `answers` только `id` вопросов; нет `name`, `phone`, `email`, `contact`; `lang` есть |
| **QP-6c** | Смена языка пишет только `sai-picker:<id>` и меняет в нём только `lang` (и не стирает ответы) |
| **QP-6d** | Страница по пути не `/t/<id>/` (`/assets/index.html`, `/t//`, отрезок в 65 знаков): обращений к хранилищу нет |
| **QP-7a** | Сеть отклонена при загрузке: блок с `net_lost_saved` и «Повторить» (хранилище работает) / `net_lost_unsaved` (бросает); после включения сети «Повторить» открывает карточку и фокус на `h1`; запросов — по одному на нажатие |
| **QP-7b** | Сеть отклонена на «Показать результат»: под кнопками блок, экран вопроса на месте, ответы те же; «Повторить» шлёт то же тело (сравнение побайтно), после 200 — временный экран результата (rework 20, F5: while 'Try again' is on its way no block of the net is on the screen) |
| **QP-7c** | Ответ 500 с `message` — текст сервера; 500 без тела и 502 с HTML — `server_internal`; 400 `answers_invalid` — кнопка «Начать заново» вместо «Повторить», хранилище не тронуто до нажатия; «Начать заново» стирает ключ и открывает карточку |
| **QP-7d** | Каждый запрос имеет `signal`; `signal`, прерванный подменой, даёт «нет связи»; `mode`, `referrerPolicy`, `credentials` в `init` нет |
| **QP-7e** | Весь сценарий `QP-7a`…`QP-7d`: вызовов `console.*` 0, `unhandledRejection` 0 |
| **QP-7f** | Сеть отклонена при смене языка: блок `lang` под шапкой, язык, адрес, значение хранилища прежние; «Повторить» повторяет смену (rework 20, F5: while 'Try again' is on its way no block is under the header; a failed change followed by a failed result leaves one block, that of the result) |
| **QP-7g** | While the result is asked for, the fields of the question are shut (a shut fieldset, the main button marked), the answers cannot change, the live region says so, a double click and a form sent again make one request; on a failure the fields open again (rework 20, F2: 'Skip' and 'Back' pressed during the request do nothing - question, answer, storage and request count stay) |
| **QP-8a** | Для 23 ключей страницы на трёх языках: фраза не длиннее 18 слов (правило REQ-054), на ru нет «ты, тебя, тебе, тобой, твой, твоя, твоё, твои», нет слов-запретов описания (ru, kk: `арендатор`, `конфигурац`, `JSON`, `API`, `сервер`, `tenant`, `id`; en: `tenant`, `configur`, `JSON`, `API`, `server`, `id`), нет слов `гарант`, `кепіл`, `guarant`, «100 %» |
| **QP-8b** | Для каждого экрана (загрузка, карточка, карточка с уведомлением, вопрос каждого вида, ошибка, блок связи, временный экран) × 3 языка × 2 арендатора: каждый текстовый узел `#app` — строка из множества «константы `texts.js` после подстановки, `LANGUAGE_NAMES`, `name`, `intro`, `title`, `help`, `label`, `unit` арендатора на этом языке, числа»; посторонних строк нет |
| **QP-8c** | В тексте карточки нет прежней подписи «Начать» (ключа `card_start` — «Пройти опрос») |
| **QP-9a** | Выбор языка: 7 строк п. 9 |
| **QP-9b** | Три кнопки «Русский», «Қазақша», «English» (`LANGUAGE_NAMES`), `type=button`, `lang` своего языка, `aria-current=true` только у текущей; для файла `/1` группы нет, а `?lang=kk` даёт `ru` |
| **QP-9c** | Смена языка на третьем вопросе: открыт тот же вопрос, ответы те же, `K` и `N` те же; перезагрузок нет (счётчик загрузок страницы, `location.reload`/`assign` не вызваны); `history.replaceState` вызван с `?lang=<язык>` (остальные параметры адреса сохранены), записей в истории не добавлено; запрос анкеты один; значение хранилища обновило `lang` |
| **QP-9d** | Ответ, данный на ru, после смены на kk выбран; в поле числа недопустимый текст остался (rework 20, F6: a message that is gone does not come back at a change of the language - after a corrected answer, and after 'Back') |
| **QP-9e** | Два нажатия подряд, ответы приходят в обратном порядке: страница на языке последнего нажатия |
| **QP-9f** | При смене языка пришла другая версия анкеты: как B1 (стирание, карточка, уведомление); каждое условие «есть что терять» отдельно — ответы при позиции на первом вопросе, позиция не на первом вопросе без ответов (необязательный первый вопрос, «Далее» без ответа); при нечем терять уведомления нет (rework 17, F1) (rework 20, F7: the first question is that of the old file - a visitor on it with no answers sees no notice) |
| **QP-9f2** | After a change of the language that brings another version of the questionnaire, the new language is the current one in the header: `aria-current` on its button and the group named in that language |
| **QP-9g** | Нажатие текущего языка — запросов нет; нажатие во время запроса результата — запросов нет |
| **QP-9h** | Смена языка на временном экране результата: повторный `POST` тех же ответов с новым `lang`; при сбое — блок под шапкой; два нажатия подряд (kk, затем en) на экране результата, ответы на повторные `POST` в обоих порядках: страница остаётся на en — результат, язык, `aria-current`, адрес (одна замена), хранилище, заголовок документа (rework 17, F3) (rework 20, F7: the focus is on the pressed language button after the result is drawn again) |
| **QP-9i** | A press of a language before 'Show the result' whose answer has not come when the result is asked for is dropped: the request, the page and the result stay in the old language; the late answer changes nothing (page, address, document, storage); the next press works |
| **QP-9j** | A press of a language on the result screen followed by 'Back' or 'Start over' before the change is finished is dropped: no request of the result goes if the questionnaire has not come; a request that is out is dropped on return; page, address, document, storage and screen stay; a stale result does not open over newer answers; the next press works. Same version of the questionnaire in the late answer |
| **QP-9k** | Rule L4, late answer with another version: after 'Back' or 'Start over' (both tried) the screen, language, address, document language and title, storage value and its write log, the number of requests and the marked button of the header are as they were when the visitor left; no card, no notice; the next press brings the new version as usual |
| **QP-9l** | Rule L4, late answer is a failure (status 500 and a network error, each after 'Back' and after 'Start over'): the same unchanged state as in QP-9k and no block of the net anywhere, in particular none under the header; the next press works |
| **QP-11a** | Для обоих арендаторов × 3 языков: первая страница — панель, текст которой состоит только из названия, вступления, `card_gives`, `card_ask`, числа вопросов, подписей кнопок языка и одной кнопки «Пройти опрос»; название — первый текстовый узел в порядке чтения; кнопок `start` ровно одна |
| **QP-11b** | Нажатие «Пройти опрос» не делает запросов, кроме загрузки анкеты (счётчик подмены сети) |
| **QP-11c** | Блокирующих окон нет: в документе на всех экранах нет `dialog`, `[role=dialog]`, `[aria-modal]`; `alert`, `confirm`, `prompt` подменённого окна не вызывались |
| **QP-11d** | Two cards, not one (deviation 1, section 17.4): the card with the notice (parts in order: notice, introduction, what you get, call, number, then the one button 'Take the survey') and the card with saved answers (the same without the notice, then 'Continue' and 'Start over') |

### 17.2 `picker-page-model.test.js` — чистые модули

| Тест | Что проверяет |
|---|---|
| **QM-1a…QM-1f** | «Одно правило» — п. 6.4 |
| **QM-2a** | `progress`: таблица `S1` (7 строк литералами) и свойство «`N` не растёт между приходами на вопросы» на 300 сгенерированных файлах × 20 путей вперёд (зерно 57002) |
| **QM-2b** | `setAnswer`: цепочка скрытия (`a → b → c`), стирание ответа, неверное значение = стирание, вход не меняется (заморожен), порядок `multiple` в порядке вариантов |
| **QM-2e** | `pruneAnswers` and `bodyAnswers`: only the own answers of the visible questions that are right, each in its normal form (a single choice as the id, a list in the order of the options, a number); unknown keys, hidden and wrong answers dropped; the input is not changed; the result is a new object without a prototype |
| **QM-2c** | `nextVisible`, `previousVisible`, `isLastVisible`, `openQuestion`, `entryQuestion`, `firstVisible`: таблица не меньше 25 строк (в том числе: неизвестный `currentId`, скрытая сохранённая позиция, обязательный без ответа выше позиции) |
| **QM-2d** | `readNumber` и `verdict`: таблица не меньше 30 строк (пустое, `badInput`, знаки, ведущие нули, `-0`, границы, 16 цифр, безопасное целое) |
| **QM-3a** | `readSaved`: все строки п. 7.1; ничего не бросает на 1000 случайных значений (числа, `null`, списки, объекты с прототипом, строки) — по образцу `TX-R1` (rework 20, F8: a value of exactly 32 767, 32 768 and 32 769 signs - the first two are read, the third is not) |
| **QM-3b** | `writeSaved`: ровно пять ключей; контакты не попадают, даже если переданы в состоянии; исключение `setItem` → `false` |
| **QM-3c** | `clearSaved`: один `removeItem` своего ключа; исключение → `false` |
| **QM-3d** | Все обращения модуля к хранилищу записаны: только три метода и только ключ `sai-picker:<id>` |
| **QM-3e** | `tenantIdOf`: таблица не меньше 15 путей (`/t/uchet-pro/`, без слэша, `/t//`, вложенные, 64 и 65 знаков, `/assets/index.html`, пустая строка) |
| **QM-4a** | `getQuestionnaire`/`postResult` на подменах `fetch`: таблица исходов п. 8.1 (не меньше 14 строк: сеть, обрыв по времени, 400/404/500 с телом и без, 200 не JSON, 200 не объект, 200 с неверной формой анкеты, верная анкета, верный результат) (rework 20, F8: only status 200 is an answer - 201, 204 and 299 are outcomes of kind server) |
| **QM-4b** | Запрос: адрес относителен, содержит `lang=<значение из трёх>`; `POST` — `Content-Type: application/json`, тело ровно `{"answers": …}`; `signal` есть; опций `mode`, `referrerPolicy`, `credentials`, `redirect`, `cache` нет |
| **QM-4c** | Проверка формы анкеты: 20 порч (пропавшее поле, не тот тип, повтор `id`, `questions_max` не равно длине, меньше двух вариантов…) — все отвергнуты; верная принята |
| **QM-4d** | The limits of the page against the validator of the tenant files, on both sides of each bound: the page takes what the validator takes and refuses what it refuses, for lengths counted in whole signs after the spaces at both ends are cut (emoji and spaces at the edges included) |
| **QM-5a** | `say`: подстановки, `$&` и `$1` в значении остаются буквами, неизвестный ключ — исключение, неизвестная подстановка остаётся |
| **QM-6a** | `dom.js`: a node is made with attributes (numbers as text, `null` and `undefined` left out) and children (texts and nodes, `null` and `undefined` left out); `part()` adds `data-part`; the text of a node is replaced as a whole and is never taken for markup |
| **QM-6b** | `result.js` (the screen of the result for now): a panel for the result screen with the header of the page first, a heading that can take the focus and says that the result will come, and two buttons that call back what the page gave |

### 17.3 `picker-page-static.test.js` — тексты файлов

| Тест | Что проверяет |
|---|---|
| **QS-1** | Список файлов `public/` — ровно 13 имён п. 3 (`stub.js` нет; подпапок нет; расширения `.js`, `.css`, `.html`; имена по `STATIC_NAME`) |
| **QS-2** | `index.html`: ровно `main#app`, `#live` с тремя атрибутами, один `script type=module src=/assets/main.js`, один `link rel=stylesheet href=/assets/page.css`; нет `noscript`, `rel=icon`; нет слова `stub` |
| **QS-3** | В `public/*.js` (комментарии тоже) нет слов: `alert(`, `confirm(`, `prompt(`, `showModal`, `beforeunload`, `dialog`, `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `console.`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `matchMedia`, `Accept-Language` (без учёта регистра), `XMLHttpRequest`, `eval(`, `new Function`, `import(`, `localStorage.clear`, `.key(`; нет `setAttribute("style"` и других присвоений `style`, кроме `style.width` |
| **QS-4** | Ровно один `fetch(` во всех файлах `public/` — в `net.js` внутри `async function request(path, init) {`; в `init` нет `mode`, `referrerPolicy`, `credentials`; константы `API_*` относительные |
| **QS-5** | `localStorage` встречается только в `store.js`; `fetch(` и `AbortSignal` — только в `net.js`; `history.` и `scrollTo` — только в `app.js` |
| **QS-6** | В комментариях и коде `public/` нет `REQ-` с цифрами, `handoff`, `ORCH`, `decisions` (`0074`, п. 6; регистр у `ORCH` важен) |
| **QS-7** | Импорты: только `./имя.js` существующих файлов, без `node:`, без `../`, без циклов; у `rules.js`, `store.js`, `net.js`, `dom.js` импортов нет; граф — п. 4 |
| **QS-8** | `page.css`: правила п. 11; токены светлой и тёмной темы равны таблице описания (8.1) — литералы в тесте; отношения контраста пар описания (8.2) считаются по формуле WCAG 2.x и равны таблице в пределах 0,01; пары текста ≥ 4,5, не текст ≥ 3; нет цветов вне блоков токенов; нет `url(`, `@import`, `position: fixed`, `nowrap`, `transition`, `animation`; `font-size` не меньше `1rem`; есть `outline: 3px`, `min-height: 3rem` у кнопок, строк вариантов, поля числа; `min-height: 2.75rem` и `min-width: 2.75rem` у кнопок языка |
| **QS-9** | В `public/` нет импорта `engine.js` и слов `computeResult`, `resolveAnswers`, `visibleQuestions` |
| **QS-10** | Нет изменяемых переменных уровня модуля: строк `let` и `var` в начале строки в `public/*.js` (D4) |
| **QS-11** | В `texts.js`: ключа `page_stub_notice` нет; 35 ключей (13 прежних − 1 + 23 новых); экспортов ровно пять; первая строка комментария без номера требования |
| **QS-12** | Блок `src/picker/public/**/*.js` с `globals.browser` в `eslint.config.js` есть; `--max-warnings 0` в скрипте `lint` |

In total the catalogue holds 65 `QP` tests in `picker-page.test.js`, 23 `QM` tests in `picker-page-model.test.js` (six of them are `QM-1a…QM-1f` of section 6.4) and 12 `QS` tests in `picker-page-static.test.js`; no test is named `QP-11e`. Команды проверки (TEST-RUNNER): `cd tools && npm run check` — код 0, `# skipped 0`, `# todo 0`, число тестов не меньше 1898 плюс новые; `npm run traces` — код 0; цикл «число `test(` не уменьшилось» (п. 13.3); `git diff --name-only base/PAGE057-20261021-01 -- tools/src/picker/engine.js tools/src/picker/server.js tools/src/picker/config.js tools/src/picker/demo-tenants tools/src/picker/demo-answers tools/test/fixtures tools/package.json tools/eslint.config.js` — пусто.

### 17.4 Tests added at the build, and two deviations

Added to the first catalogue: `QP-0a`, `QP-0b`, `QP-2j`, `QP-5a2`, `QP-7g`, `QP-9f2`, `QP-9i`, `QP-9j`, `QP-9k`, `QP-9l`, `QM-2e`, `QM-4d`, `QM-6a`, `QM-6b`. `QP-9k` and `QP-9l` pin rule L4 for a late answer that carries another version and for a late failure. Each was shown to fail on a copy of the page without the guard line of `changeLanguage()` (all six cases: two exits times three late answers).

Deviations from the catalogue as first written:

1. `QP-11d` is tested as two cards. A notice never appears together with 'Continue' (a notice means the saved answers were cleared), so the card of the first line of the old row cannot exist.
2. `QM-1e` is reinterpreted. The text `"1e3"` is refused by the page by design (mutant M25), so the old wording, that the page and the engine agree on `"1e3"`, cannot hold. The test now checks that a text the page accepts gives the same number as the engine takes, and that a refused text never reaches the engine.

### 17.5 Rework after the test-design check, gate pass 1 (step 17)

No test was added or removed: the counts above stay (64 `QP`, 23 `QM`, 12 `QS`, 99 in all at that time; section 17.6 adds one); the five remarks of the validator are new cases inside existing tests. F1 - `QP-4b`, `QP-9f`; F2 - `QP-2d`; F3 - `QP-9h`; F4 - `QP-2e`; F5 - `QP-2g` and the rows `M24`, `M29` of section 20. Mutants of the rework (applied one at a time on a copy outside the project; the tests that fail on each):

| № | Mutant | Killed by |
|---|---|---|
| N3 | 'Back' does not write the place | `QP-2d` |
| N37 | 'Next' does not write the place | `QP-2d`, `QP-9f` |
| N35 | 'Back' from the result screen does not write the place | `QP-2d` |
| N4 | 'Skip' does not clear the field | `QP-2e` |
| N5 | on load, the clause 'answers present' of `hadAny` removed | `QP-4b` |
| N5c | on load, the clause 'place is not the first question' of `hadAny` removed | `QP-4b` |
| N5b | at a change of language, the clause 'answers present' removed | `QP-9f` |
| N5d | at a change of language, the clause 'place is not the first question' removed | `QP-9f` |
| G2 | the ticket check after the second request (re-`POST`) of a change of language removed | `QP-9h` |
| M24 | `bodyAnswers` returns the answers unpruned | `QM-2e` |
| M29a / M29b | `verdict` lets a text that is not a number / a number outside the limits pass for an optional question | `QM-2d`, `QP-2g` (each) |

N35 is invisible with one tab: the place stored when the result screen was reached is already the last question, so 'Back' writes the same value. It is pinned by the write log (design 5.2, E1 says the page writes), not by a changed value.

### 17.6 Rework after the test-design check, gate pass 2 (step 20)

One test was added, `QP-0c` (the model of the document prints short); the other findings are new cases inside existing tests. Counts now: 65 `QP`, 23 `QM`, 12 `QS`, 100 in all. The page code was not touched.

| Finding | Closed in | Mutant killed |
|---|---|---|
| F3 (a node compared with `null` printed the tree: one run took 6.7 GB) | the two places of `QP-9k` compare the count of the notices; `picker-page-dom.js`: every field of a node, a text and the document except `tag` is not enumerable (`assert` prints without custom inspection at depth 1000, so the custom inspection alone does not help), and the custom inspection prints the tag, the id and the classes; pinned by `QP-0c` | V12 (by name in 0.3 s, 65 MB), I1, I2, I3, I4 |
| F1 (a place beyond the first question with no answers is 'saved') | `QP-4a` (optional first question, 'Next', reload, 'Continue' opens question 2), `QP-1c` (a place that is no question, a hidden question) | V04, V05 |
| F2 ('Skip' and 'Back' during the request) | `QP-7g` | X05, X06 |
| F4 (the draft is cleared at 'Skip') | `QP-2e` (a language change after 'Skip') | V31 |
| F5 (the block of the net is removed while 'Try again' is on its way) | `QP-7b`, `QP-7f` | V28, X03, X13 |
| F6 (a stale message is not drawn again) | `QP-9d` | Y14, Y20 |
| F7 (focus on the result screen, the first question of the old file) | `QP-9h`, `QP-9f` | T12a, V11 |
| F8 (status 200 only; the limit of the stored value) | `QM-4a`, `QM-3a` | W07, Z01, Z02 |
| F9 (both guards against a leaked draft) | `QP-2e` ('Back' with a text outside the limits in the field of the other number question) | D18_19 (and D19a alone) |
| F10 (stale message and `aria-invalid` after 'Skip' with a refused net) | `QP-2e` | F10 (both lines removed), F10a, F10b |
| N35 (value oracle) | `QP-2d` | N35 |

D18a (only the guard in `screens.js` removed) stays equivalent: the clearing in `showQuestion` covers it. Skip itself clears the draft, so the leak reaches the next field only by 'Back' (the 'Skip' route named in the finding is covered by `QP-2e`, but it is not the route that leaks).

### 17.7 Rework after the test-design check, gate pass 3 (step 24)

One limited case, allowed by the owner (finding F1 of step 23): 'Start over' on the temporary screen of the result (rule C3). No test was added or removed: the case is a new part of `QP-1b`, so the counts stay 65 `QP`, 23 `QM`, 12 `QS`, 100 in all. The page code was not touched. The case walks to the result with the default server and presses 'Start over': exactly one `removeItem` of the key of the tenant, no new write, the key is gone, the keys of the other tenant and of a stranger stay, no request goes, the first question is shown with nothing chosen, the next answer writes exactly one answer; and in a second pass a reload after the press gives the card with 'Take the survey' and no 'Continue', no 'Start over', no notice.

| Mutant | Killed by |
|---|---|
| R06 (`showResult` hands `onStart` instead of `onRestart` to `renderResult`) | `QP-1b` (1 test; the three page files: 99 of 100 pass on the copy, the removeItem list is `[]`, expected one) |

## 18. Шаги приёмки в браузере (критерии 4, 5, 7, 9, 11; сценарий BA-ANALYST, проходит UAT-RUNNER)

Тесты на модели документа не видят раскладку, фокус и цвета (AP-060, AP-065, AP-089, AP-099, AP-107): они проверяются на настоящей странице в настоящем браузере на стенде REQ-056. Доказательство — вывод измерений, числа и снимки в handoff-е UAT-RUNNER. Команды опробованы на прототипе в объёме, который он закрывает (Ф12, Ф13); измерения 44 × 44, контраста и кольца UAT-RUNNER снимает по формулам ниже. Браузер — Chrome (на компьютере 155) без окна; Safari и Firefox не проверялись (Q3: утверждений о них нет). Окна: 1470 × 784, 390 × 844 и 320 × 568; узкие окна — рамка нужного размера (`Emulation.setDeviceMetricsOverride`, `deviceScaleFactor` 1, `mobile` ложь): у самого окна браузера нижняя граница ширины 500 px (описание, п. 0.3). Шрифт — системный: на другой ОС высоты отличаются на единицы процентов, поэтому цифры описания — не эталон, а проверка идёт заново.

`<папка вывода>` — любая папка вне проекта. Выражения ниже выполняются в странице (`Runtime.evaluate`), каждое — одна строка.

| Шаг | Команда или действие | Ожидается |
|---|---|---|
| **ПР-1. Запуск** | `cd tools; OUT=<папка вывода>; mkdir -p "$OUT"; npm run -s picker -- serve --tenants src/picker/demo-tenants --home "$OUT/home" --port 0 > "$OUT/serve.out" 2> "$OUT/serve.err" &`; `cat "$OUT/serve.out"` — порт `<порт>`; Chrome: `"<путь к Chrome>" --headless=new --remote-debugging-port=9333 --user-data-dir="$OUT/profile" about:blank` | пять строк п. 4.2 REQ-056; `serve.err` пуст; стенд на 4782 не трогать — запуск на `--port 0` |
| **ПР-2. Карточка** (критерий 11) | для `uchet-pro` и `svet-marketing` × `ru`, `kk`, `en` × три окна: открыть `http://127.0.0.1:<порт>/t/<id>/?lang=<язык>`; измерить: `document.documentElement.scrollWidth <= document.documentElement.clientWidth`; `JSON.stringify(document.querySelector('[data-action=start]').getBoundingClientRect())`; `document.querySelectorAll('dialog,[role=dialog],[aria-modal]').length`; `document.querySelector('main').innerText.split('\n')[0]`; снимок `Page.captureScreenshot` | 18 пар «арендатор × язык × окно» (6 на окно): горизонтальной прокрутки нет; кнопка «Пройти опрос» не меньше 44 × 44; в окне 390 × 844 `bottom` не больше `innerHeight`; блокирующих окон 0; первая строка текста — название арендатора на этом языке; 18 снимков |
| **ПР-3. Вопросы и размеры** (критерий 5) | пройти `uchet-pro` наборами `leader` из `demo-answers/uchet-pro.json` (щелчками или клавишами) в трёх окнах на трёх языках; на **каждом** экране вопроса: `scrollWidth <= clientWidth`; размеры всех `button`, `[data-part=option]`, `input[type=number]` и `input` вариантов: `[...document.querySelectorAll('button,[data-part=option],input')].map(e=>{const r=e.getBoundingClientRect();return [e.tagName,r.width,r.height]})`; снимок самого длинного вопроса | везде ширина и высота не меньше 44; горизонтальной прокрутки нет ни на одном экране; kk и en (длиннее ru) не вылезают за край |
| **ПР-4. Клавиатура** (критерий 5) | в окнах 1470 × 784 и 390 × 844, на каждом языке: `uchet-pro` от карточки до временного экрана результата **только** событиями клавиатуры (`Input.dispatchKeyEvent`: Tab, Shift+Tab, пробел, стрелки, цифры, Enter); после каждого перехода записать `document.activeElement.tagName + ':' + document.activeElement.textContent`; на первой остановке Tab у кнопки языка, у поля и у кнопки — `getComputedStyle(document.activeElement).outlineStyle + outlineWidth`; снимок с кольцом | путь проходится без мыши; после каждого перехода активный элемент — `H2` с текстом вопроса (на последнем — заголовок временного экрана); кольцо `solid`, `3px`; на снимке видно |
| **ПР-5. Контраст** (критерий 5) | для темы светлой и тёмной (`Emulation.setEmulatedMedia` с `prefers-color-scheme`): значения токенов `getComputedStyle(document.documentElement).getPropertyValue('--text')` и остальных 17; для каждого видимого текстового элемента карточки, вопроса и блока связи — цвет текста и первый непрозрачный фон вверх по предкам; отношение яркостей по формуле WCAG 2.x (`(L1 + 0,05) / (L2 + 0,05)`, `L` — взвешенная сумма линеаризованных каналов `0,2126 R + 0,7152 G + 0,0722 B`); для рамок кнопок, отметок и поля числа — то же | токены равны таблице описания (8.1); числа пар совпадают с таблицей 8.2 в пределах округления; текст не меньше 4,5 : 1, не текст не меньше 3 : 1; числа — в handoff-е |
| **ПР-6. Перезагрузка** (критерий 4) | `uchet-pro`: ответить на четыре вопроса, `Page.reload`; «Продолжить»; `localStorage.getItem('sai-picker:uchet-pro')` | тот же вопрос, выбранные ответы те же; значение — пять ключей; других ключей хранилища на странице нет |
| **ПР-7. Язык** (критерий 9) | пройти `uchet-pro` до временного экрана на `ru`, `kk`, `en`: записать список вопросов и значения вариантов; затем на третьем вопросе переключить язык, предварительно `window.__mark = 1` | число вопросов и их порядок те же, тексты разные; после переключения `window.__mark === 1` (нет перезагрузки), адрес получил `?lang=`, вопрос и ответы те же; снимки |
| **ПР-8. Нет связи** (критерий 7) | (а) остановить стенд (`kill <pid>` сервера из ПР-1), открыть страницу — блок связи; запустить стенд на том же порту (`--port <порт>`), «Повторить»; (б) дойти до последнего вопроса, остановить стенд, «Показать результат» — блок под кнопками; запустить, «Повторить» | тексты `net_lost_saved`; «Повторить» продолжает с теми же ответами; `Runtime.exceptionThrown` — 0; строки консоли о недоступном сервере пишет сам Chrome — не ошибка страницы |
| **ПР-9. Хранилище недоступно** (критерии 4, 7) | `Page.addScriptToEvaluateOnNewDocument` с `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } })` до открытия страницы; пройти `uchet-pro` до результата; перезагрузить; повторить ПР-8 (а) | анкета проходится; после перезагрузки карточка без «Продолжить»; при потере связи текст `net_lost_unsaved`; исключений 0 |
| **ПР-10. Консоль** | на всех шагах собирать `Log.entryAdded` и `Runtime.exceptionThrown` | записей уровня `error` и `warning` нет, кроме: `/favicon.ico` 404 (п. 12), строк о сервере, остановленном намеренно (ПР-8, ПР-9), и кодов 4xx от намеренно неверных запросов; всё прочее — ошибка |
| **ПР-11. Остановка** | `kill <pid>` | код 0; порт закрыт |
| **ПР-12. Читатель ключей** (условие (г) LANG061) | BA-ANALYST, новый запуск без кода и документов Sai: пары «ключ — русский — перевод» для 23 ключей п. 14 на kk и на en | замечания применяет FRONTEND-DEV; kk, по которым нет согласия, помечаются для знающего человека (выпуск не ждёт, `0072`, п. 2) |

## 19. Ловушки (что краснеет, если сделать иначе)

| № | Ловушка | Что видно |
|---|---|---|
| Л1 | Слово `fetch(` в комментарии любого файла `public/`, кроме `request` в `net.js` | `LG-10c`, `TR-4e` (проба Т4: `LG-10c`, `TR-4b`, `TR-4e`), счёт критерия 10 |
| Л2 | `http://`, `https://` в комментарии (даже «см. https://…») | `LG-10c`, `SV-7h`, `TR-4f` (проба Т5) |
| Л3 | Слова `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `Math.random` в комментарии `public/*.js` | `LG-10c` (проба Т7); в `net.js` ещё `TR-4e` |
| Л4 | В `net.js` слово `host:` или строка `host,`, любой `://` | `TR-4d` (файл входит в `NETWORK_FILES`) |
| Л5 | Второй `fetch(` в `net.js` или `fetch(` вне `async function request(path, init) {` | `TR-4e` (проба Т3) |
| Л6 | Абсолютный адрес в `API_*` (`https://x.example/api`) | `LG-10c`, `SV-7h`, `TR-4d`, `TR-4e`, `TR-4f` (проба Т6) |
| Л7 | `getJson(` или `fetchFn(` в файле `public/` | `TR-4e` (запрет этих имён в чужих файлах) |
| Л8 | Файл `net.js` забыт в `NETWORK_FILES` | `TR-4b` |
| Л9 | Заглушку удалили раньше, чем поставили страницу | `SV-7g` и `SV-7h` краснеют (Ф8, в) — удаление последним подшагом |
| Л10 | Новый экспорт в `texts.js` (например, `fill`) | `TX-6a` (закрытый список из пяти); подстановка живёт в `say.js` |
| Л11 | В `texts.js` слово перевода, совпавшее с хеш-списком названий | `npm run traces`; перефразировать, исключения на названия не действуют |
| Л12 | Фраза длиннее 18 слов в любом языке (первая редакция английского `card_gives` была в 19) | `TX-6b`, `QP-8a` |
| Л13 | `data-part` без `data-action` на кнопке или наоборот | тест `QP-*` не найдёт кнопку по селектору |
| Л14 | Элемент ошибки (`#q-error`) создаётся только при ошибке или скрыт `display: none`/`hidden` | экранная читалка не озвучит сообщение (AP-107); `QP-2f` |
| Л15 | `setAttribute("style", …)` или атрибут `style` в разметке | CSP: `style-src-attr` (Ф10 описания); `QS-3`; ширину полосы задаёт только `style.width` |
| Л16 | `fetch` с `mode: "same-origin"` или `referrerPolicy: "no-referrer"` | браузер шлёт `Origin: null`, сервер отвечает 403 (REQ-056, п. 5.7); `QP-7d` |
| Л17 | `<link rel="icon" href="data:…">` | консоль `error security` (Ф13); `QS-2` |
| Л18 | `pushState` или присвоение `location.search` при смене языка | перезагрузка/запись в истории; `QP-9c` |
| Л19 | Чтение ключа хранилища «по префиксу» (перебор `localStorage`) | `QP-6a`: любое обращение, кроме трёх методов с одним ключом |
| Л20 | Модуль с `let` вне функции (состояние между «загрузками» страницы) | `QS-10`; тесты запускают `start()` много раз |
| Л21 | `console.log` в отладочных целях | `QS-3`, `QP-7e` |
| Л22 | Файл не отформатирован prettier (`index.html`, `page.css` тоже) | `format:check`; `cd tools && npx prettier --write src/picker/public test` |
| Л23 | Подстановка `{min}` через `replace(строка, значение)` | `$&` в значении превращается в часть шаблона; `QM-5a` |
| Л24 | Регистр имени файла в ссылке (`Main.js`) | на macOS файл найдётся, на Linux нет (ISS-0081, п. 4); `QS-2` проверяет точное имя |
| Л25 | Сообщение об ошибке ответа вынесено в блок связи | оно не требует сервера (описание, п. 4.6); `QP-2f` |
| Л26 | Радиокнопки с разными `name` | стрелки не переключают группу; `QP-2a` |
| Л27 | `input` варианта без собственной ширины/высоты (прозрачный, но не растянутый) | цель меньше 44 × 44; `ПР-3` |

## 20. Мутанты (применяет TEST-DESIGN-VALIDATOR; «П» — применён к прототипу вне проекта и убит; остальные привязаны к тестам и структуре)

Правило и модель (проверены пробами вне проекта: `rule-eq` на 1 224 000 наборов, `flow-check` на таблице `S1`):

| № | Мутант | Убит | П |
|---|---|---|---|
| М1 | `none_of` действует как `any_of` | `QM-1a` | да |
| М2 | `any_of` требует все варианты (`every`) | `QM-1a` | да |
| М3 | `min` строгий (`<=`) | `QM-1a` | да |
| М4 | `max` строгий (`>=`) | `QM-1a` | да |
| М5 | условие на вопрос без ответа истинно | `QM-1a` | да |
| М6 | неверный ответ входит в состояние | `QM-1a`, `QM-1b` | да |
| М7 | `show_if` как «хотя бы одно» (`some`) | `QM-1a` | да |
| М8 | ответ на скрытый вопрос входит в состояние | `QM-1a` | да |
| М9 | число принимает нецелое | `QM-1c` | да |
| М10 | граница числа с ошибкой на единицу | `QM-1c` | да |
| М11 | `single` принимает неизвестный вариант | `QM-1c` | да |
| М12 | `multiple` допускает повтор | `QM-1c` | да |
| М13 | `multiple` допускает пустой список | `QM-1c` | да |
| М14 | `N` считает только видимые | `QM-2a`, `QP-3c` | да |
| М15 | «не дошёл» = строго ниже текущего (текущий считается пройденным) | `QM-2a`, `QP-3c` | да |
| М16 | `K` — номер в файле, а не среди видимых | `QM-2a`, `QP-3c` | да |
| М17 | `N` считает все скрытые с условием | `QM-2a`, `QP-3c` | да |
| М18 | `setAnswer` оставляет ответы на скрытые | `QM-2b`, `QP-4d` | да |
| М19 | `setAnswer` стирает по прежней видимости (одна ступень цепочки) | `QM-2b` | да |
| М20 | `nextVisible` берёт следующий в файле | `QM-2c`, `QP-2d` | да |
| М21 | `nextVisible` не кончается (по кругу) | `QM-2c`, `QP-2h` | да |
| М22 | `previousVisible` берёт предыдущий в файле | `QM-2c`, `QP-2d` | нет |
| М23 | `entryQuestion` не ограничивает обязательным без ответа | `QM-2c`, `QP-4g` | нет |
| М24 | `bodyAnswers` включает ответы на скрытые вопросы | `QM-2e` (на уровне страницы не виден: состояние `answers` уже очищено в `setAnswer`/`pruneAnswers`, поэтому `QP-2e` его не убивает; прогон шага 17) | нет |
| М25 | `readNumber` принимает `"1e3"` | `QM-2d`, `QP-2g` | нет |
| М26 | `readNumber` не учитывает `badInput` | `QM-2d`, `QP-2g` | нет |
| М27 | `-0` записывается как `-0` | `QM-2d` | нет |
| М28 | `verdict` не требует ответа на обязательный | `QM-2d`, `QP-2f` | нет |
| М29 | `verdict` пропускает неверное число у необязательного (в двух видах: M29a — текст не число, M29b — число вне границ) | `QM-2d`, `QP-2g` (оба вида; текст `"abc"` у необязательного добавлен в rework 17, F5) | нет |
| М30 | `card_count` — числа поменяны местами | `QP-1a`, `QP-11a` | нет |
| М31 | при A = B показано «от A до B» | `QP-1e` | нет |

Хранилище, сеть, язык:

| № | Мутант | Убит | П |
|---|---|---|---|
| М32 | ключ другого арендатора читается или пишется | `QP-6a` | нет |
| М33 | в значение пишутся лишние поля (контакты) | `QP-6b`, `QM-3b` | нет |
| М34 | вместо `removeItem(ключ)` вызывается `clear()` | `QP-6a`, `QM-3c` | нет |
| М35 | исключение чтения не поймано | `QP-4c`, `QM-3a` | нет |
| М36 | исключение записи не поймано | `QP-4c` | нет |
| М37 | после сбоя записи текст остаётся «ответы сохранены» | `QP-7a` | нет |
| М38 | после первого сбоя страница продолжает обращаться к хранилищу | `QP-4c` | нет |
| М39 | другая версия анкеты не стирает сохранённое | `QP-4b` | нет |
| М40 | другая версия стирает ещё и язык | `QP-4b` | нет |
| М41 | значение с `answers` в виде списка принято как есть | `QP-4e`, `QM-3a` | нет |
| М42 | ключ `__proto__` в ответах загрязняет объект | `QP-4e` | нет |
| М43 | значение в 40 000 знаков разбирается | `QP-4e`, `QM-3a` | нет |
| М44 | «Пройти опрос» пишет в хранилище | `QP-1d` | нет |
| М45 | ключ только с языком считается сохранённым | `QP-1c` | нет |
| М46 | `mode: "same-origin"` в `fetch` | `QP-7d`, `QM-4b` | нет |
| М47 | запрос без `signal` | `QP-7d`, `QM-4b` | нет |
| М48 | абсолютный адрес запроса | `QM-4b`, `TR-4e` | да (Т6) |
| М49 | тело запроса с лишним полем (`tenant`) | `QM-4b`, `QP-7b` | нет |
| М50 | ответ 500 без тела роняет страницу | `QP-7c`, `QM-4a` | нет |
| М51 | ответ 200 не по форме принят | `QM-4a`, `QM-4c` | нет |
| М52 | `answers_invalid` показывает «Повторить» | `QP-7c` | нет |
| М53 | повтор шлёт ответы, собранные заново, не те же | `QP-7b` | нет |
| М54 | автоповтор запроса без нажатия | `QP-7a` (счётчик запросов) | нет |
| М55 | `console.error` при сбое | `QP-7e`, `QS-3` | нет |
| М56 | сохранённый язык не читается | `QP-9a` | нет |
| М57 | `?lang=de` принят | `QP-9a` | нет |
| М58 | `?lang=KK` принят без регистра | `QP-9a` | нет |
| М59 | у файла `/1` показан переключатель | `QP-9b` | нет |
| М60 | смена языка перезагружает страницу | `QP-9c` | нет |
| М61 | смена языка сбрасывает ответы или позицию | `QP-9c` | нет |
| М62 | смена языка делает `pushState` | `QP-9c` | нет |
| М63 | `aria-current` остаётся на прежней кнопке | `QP-9b` | нет |
| М64 | у кнопки языка нет атрибута `lang` | `QP-9b` | нет |
| М65 | поздний ответ на первое нажатие применён | `QP-9e` | нет |
| М66 | язык пишется в другой ключ | `QP-6c` | нет |

Разметка, фокус, доступность, файлы:

| № | Мутант | Убит | П |
|---|---|---|---|
| М67 | у варианта нет оборачивающего `label` | `QP-2a` | нет |
| М68 | у радиокнопок разные `name` | `QP-2a` | нет |
| М69 | «Назад» показана на первом вопросе | `QP-2d` | нет |
| М70 | «Пропустить» показана у обязательного | `QP-2e` | нет |
| М71 | элемент ошибки создаётся только при ошибке | `QP-2f` | нет |
| М72 | у элемента ошибки нет `aria-live` | `QP-2f`, `QP-5b` | нет |
| М73 | после перехода фокус не двигается | `QP-5a` | нет |
| М74 | фокус на форме, а не на заголовке | `QP-5a` | нет |
| М75 | у заголовка вопроса нет `tabindex="-1"` | `QP-5a` | нет |
| М76 | у полосы нет `aria-valuemax` | `QP-3a` | нет |
| М77 | `innerHTML` для текста арендатора | `QS-3`, `QP-8b` (разметка в тексте показана буквами) | нет |
| М78 | `setAttribute("style", …)` для полосы | `QS-3` | нет |
| М79 | `#live` скрыт через `hidden` или `display: none` | `QS-2`, `QS-8` | нет |
| М80 | `dialog` или `alert()` для «Начать заново» | `QP-11c`, `QS-3` | нет |
| М81 | «Продолжить» показано при пустом сохранённом | `QP-1a`, `QP-1c` | нет |
| М82 | «Начать заново» не стирает ключ | `QP-1b` | нет |
| R06 | «Начать заново» на экране результата получает `onStart` вместо `onRestart` (rework 24) | `QP-1b` | нет |
| М83 | ошибка обязательного уводит на следующий вопрос | `QP-2f` | нет |
| М84 | порядок кнопок «Далее», «Назад» | `QP-2i`, `QP-5c` | нет |
| М85 | `stub.js` остался в `public/` | `QS-1`, `QS-2`, `SV-1f` | нет |
| М86 | ключ `page_stub_notice` остался | `QS-11`, `SU-10` (З5) | нет |
| М87 | в `public/` комментарий с `REQ-057` | `QS-6` | нет |
| М88 | `rules.js` импортирует `../engine.js` | `QS-7`, `QS-9`, `QM-1f` | нет |
| М89 | второй `fetch(` в файле, не входящем в сеть | `TR-4e`, `LG-10c`, `QS-4` | да (Т4) |
| М90 | в `page.css` цвет вне токенов | `QS-8` | нет |
| М91 | шрифт меньше `1rem` или `position: fixed` | `QS-8` | нет |
| М92 | в `page.css` исчез `outline: 3px` или `min-height` | `QS-8` | нет |

Применено к прототипу и убито: М1–М13 (проба `mutate-rules`: 13 из 13 не равнозначных мутантов, Ф15), М14–М21 (проба `mutate-flow`: 8 из 8, Ф17; М15 — «`>` вместо `>=`»), М48, М89 — всего 23; к ним проба таблицы замен: `SU-11` краснеет без языка документа и без `card_gives` (Т1, Т2), `TR-4e` — на втором `fetch(` (Т3), `LG-10c`, `SV-7h`, `TR-4f` — на `https://` в комментарии (Т5), `LG-10c` — на слове `XMLHttpRequest` в комментарии (Т7). Остальные 69 привязаны к тестам и должны быть применены TEST-DESIGN-VALIDATOR; живой мутант без привязки — замечание.

## 21. Подшаги разработки и ожидаемые красные тесты

Один FRONTEND-DEV, по handoff-у на подшаг; двух писателей одного файла нет. Тестов (кроме собственных проб) разработчик не пишет: их пишет TEST-DESIGNER на шаге 5 (таблица замен — он же). Проверка каждого подшага: `cd tools && npx prettier --write src/picker/public && npm run format:check && npm run lint && npm run traces && npm run handoffs-check`, затем `node --test test/picker-*.test.js test/traces-runtime.test.js` (276 тестов; полный `npm test` — на шаге 6). Порядок — по риску: чистая модель и хранилище (ошибка здесь тихо портит ответы) → экраны и управление → смена языка → стили → удаление заглушки. Красные существующие тесты между шагами 2 и 5 — **только названные ниже**; с шага 5b красных нет (WF-02). Красный, которого нет в таблице, — вопрос CODE-DESIGNER через ORCH, а не тихая правка. Условие красных 3: слова-ловушки п. 19 (Л1–Л3, Л6) не попали в комментарии `public/`; иначе красных больше — это находка.

| Подшаг | Файлы | Разделы | Риск | Контрольный запуск разработчика (не тест) | Красные существующие |
|---|---|---|---|---|---|
| 57a | `texts.js` (23 ключа, `page_stub_notice` пока остаётся), `say.js`, `rules.js`, `flow.js`, `store.js`, `net.js` | 2 (D2–D10, D16), 4.1–4.6, 5.3, 6, 7, 8, 14 | средний: правило видимости (копия) и хранилище; ошибка здесь тихо портит ответы | `node --input-type=module -e` с импортами: `visibleIds` на `uchet-pro` (из `checkBytes` → `publicQuestionnaire`), `progress` на файле `S1` (таблица 5.3), `readSaved` на подмене; проба равенства с движком на двух файлах и тысяче наборов; `npm run traces` (тексты) | **3**: `LG-10c`, `TR-4b`, `TR-4e` (появился `net.js`, Ф8 а) |
| 57b | `dom.js`, `screens.js` (загрузка, карточка, вопрос, блок связи), `result.js`, `app.js` (события B0–B2, C1–C3, Q1–Q6, R1, R2, E1), `main.js`, `index.html` (`main.js`, `#live`) | 4.7–4.9, 5.1–5.4, 10, 15 | высокий: управление, фокус, сеть, хранилище вместе | запуск стенда `serve --port 0`, открыть `/t/uchet-pro/?lang=kk` в Chrome: карточка, первый вопрос, `document.activeElement`; пройти до временного экрана; остановить стенд на вопросе — блок связи | **3** (те же) |
| 57c | `screens.js`, `app.js` (кнопки языка, события L1, L2, D18, D19, обновление адреса) | 5.2 (L1, L2), 9 | средний: гонки ответов, перерисовка без потери фокуса и ответов | на третьем вопросе переключить язык: тот же вопрос, ответы, адрес с `?lang=`, перезагрузки нет; файл `/1` (копия `fixtures/picker-legacy/` в временной папке) — группы нет | **3** |
| 57d | `page.css`, `index.html` (`link` на `page.css`) | 10.1, 11 | средний: вёрстка, контраст, 44 × 44 | `ПР-2`…`ПР-5` по окнам 1470 × 784, 390 × 844, 320 × 568 (первый просмотр самим разработчиком) | **3** |
| 57e | `stub.js` (**удаляется**), `texts.js` (ключ `page_stub_notice` и первая строка комментария), `tools/README.md` | 13.1, 23 | низкий по коду, высокий по охранным тестам: сразу 5 новых красных | `grep -rn 'stub.js' tools/src` — пусто; `grep -rn page_stub_notice tools/src` — пусто; полная карточка и анкета в Chrome | **8**: `LG-10c`, `TR-4b`, `TR-4e` + `SU-10`, `SU-11`, `SV-1f`, `SV-7e`, `SF-6c` (Ф8 б) |

Эти 8 красных — «поведение, намеренно изменённое проектом»: FRONTEND-DEV называет их в `result.issues` со строками таблицы 13.2; чинит их TEST-DESIGNER (З1–З16, 16 мест: из них 8 сразу красных, `SF-6g` краснеет после З1, остальные зелёные, но ссылаются на удалённый файл). После таблицы — 276 из 276 (Ф9), `npm run check` — код 0. Прототип проверял видимый тестам контракт; полный код может дать провал, которого он не видел.

## 22. Планка (`docs/quality-bar.md`)

| Пункт | Применим? | Как выполняется |
|---|---|---|
| Q1. Сначала требование | применим | Проект привязан к REQ-057; у каждого критерия — строка «критерий → элемент → тест» (п. 16) и способ проверки командой или файлом |
| Q2. Кто делает — не проверяет | применим | Проект проверяет CODE-DESIGN-VALIDATOR (сам запускает команды п. 1: `npm run check`, поиски); код — SECURITY-REVIEWER и REVIEWER; тесты — TEST-DESIGN-VALIDATOR (сам применяет мутанты п. 20); приёмка в браузере — UAT-RUNNER по сценарию BA-ANALYST и DESIGN-QA-VALIDATOR; автор проекта и автор тестов — разные роли |
| Q3. Без домыслов | применим | Каждое утверждение о текущем поведении — с командой и выводом (Ф1–Ф20); Chrome 155 проверен, Safari и Firefox — нет, и в проекте о них ничего не утверждается; расхождения с заданием названы (Ф4, Ф6–Ф8, Ф16) |
| Q4. Одна команда проверки | применим | `cd tools && npm run check` (format:check → lint → traces → handoffs-check → test); новые файлы `public/` и `test/` входят в prettier и eslint (`--max-warnings 0`); прототип с таблицей замен — код 0 (Ф9) |
| Q5. Тест на каждый критерий | применим | П. 16–17; тесты отказа (п. 15) проверяют неизменность ответов, позиции, хранилища и числа запросов; тесты независимы (каждый вызывает `loadPage` и возвращает подмены в `t.after`) |
| Q6. Проверку не обманывают | применим | Таблица замен п. 13 не ослабляет ни одного запрета (исключение для `fetch(` в `LG-10c` — одно слово в одном файле и добавленная проверка «ровно один»); `skip`, `todo`, отключённых правил, `|| true` нет; число `test(` не уменьшается (цикл п. 13.3); блок `eslint` не трогается |
| Q7. Секреты только по ссылке | применим | Секретов нет ни в коде, ни в тестах, ни в документе; в хранилище нет контактов (`QP-6b`); примеры вымышлены (`uchet-pro`, `svet-marketing`, фирмы стенда); путей этого компьютера в файлах нет (`traces`) |
| Q8. Данные клиентов не смешиваются | применим | Страница читает и пишет только ключ `sai-picker:<id>` (`QP-6a`, `QM-3d`), `id` берётся из адреса; чужие ключи не перечисляются; запросы относительные под тем же `/t/<id>/`; страница арендатора не знает других. Граница доступа — сервер (REQ-056), страница не граница (клиент никогда не граница доступа) |
| Q9. Никакой склейки SQL | неприменим | SQL на странице нет |
| Q10. Сбои не роняют | применим | П. 8, п. 15: нет связи, ошибка сервера, предел 20 с, хранилище недоступно или бросает, битое значение, недопустимый ответ сервера — понятный текст и «Повторить»; страница не падает, в консоль не пишет; ошибка одного посетителя другого не касается (страница не имеет общего состояния) |
| Q11. Внешние адреса проверяются | неприменим | Страница не ходит по адресам, которые задаёт клиент: два адреса — константы `API_*`, значение `lang` ограничено тремя; `TR-4e`, `QS-4` держат это |
| Q12. Решения записываются | применим | Выборы D2 (копия правила), D13 (временный экран), D14 (значок), D16, D18, D19 — предложение записи `0078` (п. 24); вопросы О1–О4 — ORCH |
| Q13. Ошибки процесса записываются | применим | Предложение записи в `docs/anti-patterns.md` (номер даст DOC-UPDATER, следующий — AP-124): критерий назвал охранные тесты, но не `LG-10c`, и блок `eslint`, который уже есть, назван «добавленным» — найдено прототипом и поиском (повтор AP-068) |
| Q14. Учёт не откладывается | применим | Этот шаг: файл проекта и handoff. Статус требования, `STATE.md`, пометки в `REQ-056` — DOC-UPDATER после PASS RELEASE-VALIDATOR |
| R1. Мерж подтверждает человек | неприменим к проекту | Проект ничего не мержит; мерж готовит RELEASE-FINALIZER и останавливается |
| R2. Pixel Office — правда | неприменим | Страница не пишет событий, не читает журнал и не показывает выдуманных данных; Pixel Office не затронут |
| R3. Фото покупателей | неприменим | Решение `0033`: продукт снят; ни фото, ни персональных данных, ни контактов даже в хранилище |

## 23. Что меняется в `tools/README.md`

Правит FRONTEND-DEV (подшаг 57e); строки — на метке.

| Место | Было | Станет |
|---|---|---|
| таблица «Адреса» (строка `/t/<id>/`, ~683) | «страница сайта (пока заглушка)» | «страница сайта: карточка арендатора и анкета» |
| таблица «Что открыть» (~721–722) | «Заглушка: одна фраза…», «Такая же заглушка» | карточка арендатора (название, вступление, число вопросов, «Пройти опрос»); с `?lang=kk` и `?lang=en` — на этом языке; то же для `svet-marketing` |
| абзац под таблицей (~729) | «Страницы анкеты и результата ещё нет, на месте страницы стоит заглушка. Пройти анкету в браузере пока нельзя…» | анкета проходится в браузере; после «Показать результат» стоит временный экран (страница результата — следующее требование); результат можно получить и запросом POST |
| новый раздел «Сайт подбора решения: страница» (перед разделом «три языка», ~743) | — | какие файлы лежат в `public/` и зачем (13 имён); как открыть; что хранится в браузере (ключ `sai-picker:<id>`, пять полей, контактов нет) и как стереть («Начать заново»); что правило видимости — копия правила движка в `rules.js`, а тест сверяет её с движком; как проверить страницу (`npm run check`; шаги в браузере); без JavaScript страница пуста; запрос `/favicon.ico` получает 404 — это не ошибка страницы |
| раздел «три языка» (~751) | перечень, где лежат тексты и как добавить ключ | + абзац: подстановку `{имя}` делает `say.js` (в `texts.js` новых экспортов нет); ключи страницы (`card_*`, `quiz_*`, `net_*`, `progress_*`, `result_soon`) |
| раздел «движок» (~767) | «У движка нет команды: его вызывают сервер и страницы подбора (REQ-056…REQ-058).» | «…его вызывает сервер; страница подбора движок не получает: она повторяет только правило видимости вопросов (`public/rules.js`), равенство проверено тестом» |
| раздел `serve`: справка | — | не меняется (команда та же) |

## 24. Открытые вопросы к ORCH и предложение записи

### 24.1 Вопросы (до ответа действует написанное; ни один не решён догадкой)

| № | Вопрос | Значение до ответа | Чем грозит и что нужно |
|---|---|---|---|
| **О1** | **Правило `N` и «`K = N` на последнем вопросе».** Буквальное правило `0077`, п. 4 даёт `K < N` на последнем видимом вопросе, если от него зависят скрытые ниже (п. 5.3, пример из трёх вопросов; на обоих демо-файлах и в тесте критерия 3 этого нет). Исправление: текущий вопрос с допустимым ответом считается пройденным — `K = N` всегда, `N` не растёт ни разу, но меняется (убывает) при ответе на текущем вопросе; расходится с фразой описания «ответ на текущем вопросе не меняет `N`». Принять буквальное правило с известным краем или исправление? | буквальное правило | Меняются `flow.progress` (одно условие), `QM-2a`, `QP-3c`, `QP-3d`; нужен ответ до шага 2 (иначе доработка) |
| **О2** | **Что видит посетитель после «Показать результат» до REQ-058.** Проект вводит временный экран `result.js` (ключ `result_soon`, кнопки «Назад», «Начать заново»); REQ-058 заменяет файл. Принять, или другой текст/без экрана (тогда страница остаётся на вопросе, что нарушает «страница переходит к результату») | временный экран | новый ключ: перевод и читатель (г) LANG061 |
| **О3** | **Значок.** Исключение для `/favicon.ico` в приёмке (п. 12) или отдельная малая работа над сервером (тип файла `.svg`/`.ico` в `STATIC_TYPES`, значок в `public/`, правка нескольких тестов REQ-056) | исключение | Без ответа ISS-0081, п. 5 закрывается исключением |
| **О4** | **Критерий 10 и охранные тесты.** Блок `eslint` для `public/` уже есть (Ф4): `git diff … eslint.config.js` пуст, и фраза «показывает только добавленный блок» невыполнима буквально; `LG-10c` в критерии не назван (Ф6, Ф8), а краснеет. Поправить текст критериев 10 и 11 микроправкой WF-01 (блок «есть» вместо «добавлен»; в перечень — `LG-10c`) или принять проект как есть | проект выполняет критерий по сути: `QS-12` проверяет наличие блока, З15 меняет `LG-10c` | ворота RV сверяют текст критерия буквально (AP-117, AP-123); лучше поправить до шага 8 |
| **О5** | **Переводы kk и en 23 ключей.** Предложение проекта (п. 14) — расчётное; нужен читатель (г) LANG061 для ключей `card_*` по критерию 11 и для остальных новых ключей по `0070`, п. 10 | предложение п. 14 | ORCH добавляет шаг читателя (BA-ANALYST, новый запуск) в задание ворот |

Выборы проекта, вопросов не требующие (сведения для ворот и тестов): имена файлов `main.js` (главный файл страницы для замен З4, З6–З14) и `screens.js` (имя `view.js` занято файлом верхнего уровня); D16 (идентификатор из адреса без второй записи правила); D18 (смена языка на экране результата — повторный `POST`, REQ-058 вправе заменить); D19 (нажатия языка во время запроса результата игнорируются); предел запроса 20 с; `console` не вызывается; значение хранилища с `format: 1`.

Выбор описания [о1]…[о8] приняты `0077`; проект выполняет их: [о1] — `card_count_same` (`QP-1e`), [о2] — `QP-2e`, [о3] — п. 5.3 (с краем О1), [о4] — п. 4.9, [о5] — п. 5.2 (B1: ничего не пишется), [о6] — `QP-1b`, [о8] — `QP-7c`.

### 24.2 Предложение записи `decisions/0078-picker-page-conventions.md` (Q12; оформляет ORCH)

**Вопрос.** Как устроена страница сайта подбора и что в ней может оспорить владелец.

**Варианты и выбор.**
1. Правило видимости вопросов на странице — собственная копия `public/rules.js` и тест равенства с движком (вариант А п. 6.2); отвергнуты API, побайтная копия движка и раздача `engine.js` сервером.
2. Идентификатор арендатора на странице — отрезок адреса `/t/<id>/` без второй записи правила `TENANT_ID` (правило остаётся в `limits.js`).
3. До REQ-058 — временный экран результата с одним новым ключом; REQ-058 заменяет `result.js`.
4. Значок страницы — исключение в приёмке (если принято О3).
5. Хранилище: после первого сбоя страница больше не обращается к нему; значение с `format: 1` и пятью полями; запись при каждом допустимом ответе, переходе и смене языка.
6. У каждого запроса страницы предел 20 с; `console` страница не вызывает.
7. Охранный тест `LG-10c` (REQ-061) разрешает `fetch(` в файле `net.js` и требует ровно одного (таблица замен З15).
8. Правило `N` — по `0077`, п. 4; край О1 — по ответу ORCH.

**Причина.** Каждый выбор даёт наименьшее изменение выпущенного: сервер, движок и 1898 тестов не меняются, из REQ-056 правятся только ссылки на удалённую заглушку и один охранный тест соседнего требования.

**Граница.** Не разрешает публикации в интернет, платных подключений и ИИ; не меняет `0065`–`0077`.

**Основание.** Этот файл; `docs/design/REQ-057-picker-page-ui.md`; `handoffs/PAGE057-20261021-01/step-01b-code-designer.json`.

### 24.3 Предложение записи в `docs/anti-patterns.md` (Q13; номер даст DOC-UPDATER)

*Критерий назвал охранные тесты соседнего требования не полностью и описал уже сделанное как будущее.* Что случилось: REQ-057 (критерий 10) перечисляет `TR-4b`, `TR-4e`, `TR-4f` и «добавленный блок» `eslint`; в основе блок уже есть (REQ-056, подшаг 56b), а охранный тест другого требования `LG-10c` (REQ-061) запрещает `fetch(` в любом файле `public/` и краснеет от единственного разрешённого `fetch(`; нашли поиском `grep -n 'public'` по тестам и прототипом (красных 3 сразу после добавления `net.js`). Как правильно: перед записью критерия REQ-ANALYST ищет в тестах всех соседних требований слова, которые критерий разрешает (`grep` по `fetch(`, `public/`), и сверяет «добавлено» с основой; CODE-DESIGNER повторяет поиск на прототипе (повтор AP-068, AP-113).
