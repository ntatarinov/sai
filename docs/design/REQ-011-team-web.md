# REQ-011 — проект кода: сервер бизнес-интерфейса Sai Team (проекты, цель одной фразой, чат, задачи, карточка исполнителя)

WF-02, шаг 1 (CODE-DESIGNER), прогон `PROD-20261010-01`, handoff `handoffs/PROD-20261010-01/step-01-code-designer.json`.
Требование — блок REQ-011 в `docs/requirements.yaml` (15 критериев). Основа: проекты `docs/design/REQ-009-team-core.md`
(«ядро»), `docs/design/REQ-010-agent-executors.md` («исполнители»), `docs/design/REQ-013-team-engine.md` («движок», п. 13.9 —
API канала для этого сервера), код `tools/src/team/`, решения `decisions/0015`, `0017`, `0018`, `0020`, `0023` (D2), `0024`
(место сервера) и предложенное этой работой `decisions/0025-team-web-server.md` (W1–W8; W7 — с r2, W8 — с r3).

Экраны, их порядок, подписи и вид описывает GUI-DESIGN-ANALYST в `docs/design/REQ-011-ui.md` (параллельно). Здесь их нет:
этот проект задаёт **имена и смысл полей ответов API** — источник правды для имён; описание интерфейса ссылается на них.

Кода реализации здесь нет: только сигнатуры, формы, правила и таблицы. Все примеры вымышлены (идентификаторы вида
`p-20990101-a1b2c3`, цели «Вымышленная цель …»).

Редакция **r2** (2026-10-10) — доработка после FAIL CODE-DESIGN-VALIDATOR
(`handoffs/PROD-20261010-01/step-03-code-design-validator.json`, замечания F-1…F-12 и 14 расхождений полей). Номер r2
выбран, чтобы совпасть с редакцией описания интерфейса r2, которая ссылается на этот проект; отдельной r1 не было.
Что изменено (номер замечания у каждой правки):

- F-1 — единый контракт API: формы п. 5.3 переписаны, добавлена таблица п. 5.5 «ответ → поле → тип → откуда берётся»;
  сведение 14 расхождений — п. 5.6;
- F-2 — `Content-Type: application/json; charset=utf-8` у всех ответов API и отказов (п. 4.2);
- F-3 — устаревший ключ страницы после перезапуска сервера: отдельный отказ `reload: true` (п. 4.1, 4.3, 10);
- F-4 — поле `waits.note_text` и его текст (п. 5.3, 5.5, 6.2);
- F-5 — поле `pause_text` с текстом решения 0025 (п. 5.5, 6.2, 8.4); п. 20 — вопросы закрыты решением 0025;
- F-6 — адреса страницы только из `Link.api` и номера роли (п. 5.2, 13);
- F-7 — состояния «проект создан, но не стартовал», «проект не читается», `tail_text`, `pause_text` (п. 5.5, 5.7);
- F-8 — TR-4b и TR-4e — ожидаемый провал между шагами 2 и 5 (п. 17);
- F-9 — правило сравнения `Content-Type` запроса (п. 4.1);
- F-10 — период опроса ровно 5 000 мс и отсчёт от начала прошлого опроса (п. 3, 9);
- F-11 — правило «не больше 6 знаков после запятой» как у ядра и строка `E_EVENT` при создании (п. 8.1, 10);
- F-12 — остаточный риск «любой процесс этого компьютера» — в `decisions/0025` (W2) и п. 16 (Q7).

Редакция **r3** (2026-10-10) — доработка после FAIL REVIEWER (`handoffs/PROD-20261010-01/step-08-reviewer.json`,
замечания F1…F11, I2) и замечания S-1 SECURITY-REVIEWER (`handoffs/PROD-20261010-01/step-07-security-reviewer.json`),
по решениям ORCH. Номер правила — у каждой правки:

- F1, I2 — в «Результат» идут только файлы с задачей (`state.files[].task !== null`); файлы без задачи (вход, который
  записал тестовый исполнитель: `r-…-plan-input.md`, `r-…-goal-input.md`) не отдаются; форма `ResultRef` не меняется
  (п. 0, 5.5, 7.1 (6), 15 WEB-4f, 15.1; `decisions/0025`, W8);
- F2 — метка ключа в форме `content="" />` (п. 4.3);
- F3 — адрес в README временно без ссылки, ST-06 сужается до раздела Pixel Office, потом ссылка возвращается (п. 1.2, 14);
- F4 — поле `ChatMessage.truncated` (п. 5.3, 5.5, 13, 15 WEB-5e);
- F5 — `m × k ≤ 0` → «срок пока не оценить» (п. 7.2; `decisions/0025`, W4 п. 3);
- F6 — строки `E_CHANNEL_STALE`, `E_USAGE`, `E_CORRUPT` чата (п. 8.2, 10, 15 WEB-10f);
- F7 — порядок запросов опроса страницы проекта (п. 9);
- F8 — потолок со страницы — число только для десятичной записи (п. 8.1, 13);
- F9 — поле `app.link` страницы: в проекте его не было и нет; п. 13 — «состояние связи только в разметке блока связи»;
- F10 — неожиданная ошибка опроса — блок связи «Нет связи с сервером Sai» (п. 9, 10);
- F11 — строка «Не удалось запустить сервер (<код>)» команды принята (п. 2, шаг 5);
- S-1 — простой чтения тела 15 с → 408 (п. 3, 4.1, 4.2, 10, 15 WEB-10e, 15.1).

## 0. Проверенные факты (своими запусками, 2026-10-10)

| Утверждение | Чем проверено | Итог |
|---|---|---|
| `deliver` из `channel.js` при живом движке в **том же процессе** идёт через канал, после остановки движка — пишет сам | скрипт во временной папке рабочей папки ORCH (вне Sai): `createProject` (scripted, критическая задача) → `createEngine(...).run()` → `deliver(id,{kind:"say",…})` → `requestStop("signal")` → снова `deliver` | вывод: `holder pid == own pid: true`, `deliver via: engine event type: CHAT`, `last types: PROJECT_WAITING/ENGINE CHAT/ENGINE CHAT/USER PROJECT_PAUSED/USER`, `after stop deliver via: self` |
| ядро принимает потолок 0 при создании (значит, «потолок 0 — отказ» — проверка сервера, как у команды `new`) | тот же скрипт | `budget 0 accepted by createProject: 0` |
| `child_process` в `tools/src/` разрешён только в `team/executors/claude-cli.js` и `traces/git-files.js` | `node --test --test-name-pattern="TR-4c\|TR-4b" test/traces-runtime.test.js` | `ok 1 - TR-4b …`, `ok 2 - TR-4c child_process only in claude-cli.js and git-files.js …`, `# pass 2`, `# fail 0` |
| `tools/src/web/` ещё нет; `jsdom` не установлен | `ls src/web`, `ls node_modules/jsdom` | `No such file or directory` (оба) |
| Node 22 | `node --version` | `v22.21.1` |
| запись `decisions/0024` содержит то, что ищет критерий 13 | `grep -n "tools/src/web/\|127.0.0.1\|0015\|REQ-013" decisions/0024-team-web-location.md` | строки 3, 7, 12, 17, 19, 21, 27 |
| движок пишет файлы результата без задачи (F1): на сценарии `engine-basic` 2 из 6 файлов — `task: null` | r3, временные `SAI_TEAM_HOME` и `HOME` в рабочей папке ORCH (вне Sai): `node src/team/cli.js new --goal "Вымышленная цель проверки" --budget 1 --executor scripted --scenario test/fixtures/team/engine-basic.json`, `node src/team/cli.js start <id>`, затем `readProject(...).state.files` | `r-00001-plan-input.md null result`, `t-0001-1-input.md t-0001 result`, `t-0001-1-report.md t-0001 result`, `t-0002-1-input.md t-0002 result`, `t-0002-1-report.md t-0002 result`, `r-00006-goal-input.md null result`, `status done`. Источник — `engine/single-run.js`, `importOutputs`: файлы запуска без задачи — вход, который записал тестовый исполнитель (`task: null`) |
| `deliver` бросает `E_CHANNEL_STALE` после срока ожидания и `E_USAGE` (F6) | r3: `grep -n "E_CHANNEL_STALE\" && Date.now() < deadline\|throw new TeamError(r.ack.code" src/team/engine/channel.js`; `grep -n "E_USAGE" src/team/engine/channel.js` | `532: if (r.ack.code === "E_CHANNEL_STALE" && Date.now() < deadline) {`, `536: throw new TeamError(r.ack.code, r.ack.message);`, `104: return new TeamError("E_USAGE", message);` |
| статусы словами и фразы — в ядре: `PROJECT_STATUS_TEXT`, `TASK_STATUS_TEXT` (`schema.js`), `phrasesForJournal` (`language.js`), `projectView`/`projectSummary` (`view.js`), открытые вопросы — `openQuestions`, `questionAsked` (`engine/answers.js`), факты — `scanFacts` (`engine/facts.js`) | `grep -n "^export" tools/src/team/*.js tools/src/team/engine/*.js` | экспорты на месте |

## 1. Состав изменений и кто какие файлы пишет

### 1.1. Новые файлы

| Файл | Кто | Что | Node API |
|---|---|---|---|
| `tools/src/web/config.js` | BACKEND-DEV | константы (п. 3); `HOST = "127.0.0.1"` | нет |
| `tools/src/web/texts.js` | BACKEND-DEV | все тексты «для показа», которые формирует сервер (п. 6) | нет |
| `tools/src/web/display.js` | BACKEND-DEV | чистые функции: ответы API из воспроизведённого состояния (п. 5, 7) | нет |
| `tools/src/web/engines.js` | BACKEND-DEV | движки в процессе сервера (п. 8.3, W1) | нет (импорт `engine.js`) |
| `tools/src/web/api.js` | BACKEND-DEV | обработчики маршрутов: чтение через ядро, запись через ядро и `deliver`; **единственный** файл с импортом `../team/engine/channel.js` | нет |
| `tools/src/web/server.js` | BACKEND-DEV | `node:http`, проверки Host/Origin/ключа, разбор пути, тело, файлы страницы, ответы; **единственный** файл с `node:http` | `node:http`, `node:crypto`, `node:fs` (только чтение `public/` при запуске) |
| `tools/src/web/main.js` | BACKEND-DEV | команда `npm run team-web`: параметры, запуск, ссылка, сигналы | `node:fs` (чтение сценария) |
| `tools/src/web/public/index.html`, `app.js`, `style.css` (и другие файлы страницы по `REQ-011-ui.md`) | FRONTEND-DEV | страница | браузер |
| `tools/test/team-web-*.test.js`, `tools/test/team-web-helpers.js` | TEST-DESIGNER (шаг 5) | тесты п. 15 | — |

### 1.2. Изменённые файлы

| Файл | Кто | Что |
|---|---|---|
| `tools/package.json` | BACKEND-DEV | скрипт `"team-web": "node src/web/main.js"`; зависимостей не добавляется |
| `tools/README.md` | BACKEND-DEV | раздел `## Sai Team — интерфейс` (п. 14) |
| `tools/eslint.config.js` | FRONTEND-DEV | блок `files: ["src/web/public/**/*.js"]` с `globals.browser` (как у Pixel Office) |
| `tools/test/traces-runtime.test.js` | TEST-DESIGNER | `NETWORK_FILES` += `web/server.js`, `web/public/app.js`; TR-4d: `listen(` сервера `web/server.js` получает `HOST`; TR-4e: правило одного `fetch(` для `web/public/app.js` (п. 12) |
| `tools/test/pixel-office-settings.test.js` (r3, F3) | TEST-DESIGNER | ST-06: проверка «каждая строка `http://127.0.0.1:<порт>` — с портом Pixel Office» ограничивается разделом `## Pixel Office` README (от заголовка до следующего заголовка `## `); остальные проверки ST-06 не меняются. Смысл теста сохраняется, проверка не слабеет: порт Pixel Office проверяется там же, где он написан (п. 14) |

Код `tools/src/team/` **не меняется**. `tools/src/pixel-office/` и `~/.sai-pixel-office` не затрагиваются.

### 1.3. Двое не пишут один файл

BACKEND-DEV — всё в `tools/src/web/`, кроме `public/`; FRONTEND-DEV — только `tools/src/web/public/` и `eslint.config.js`.
Общий контракт — п. 5 этого проекта (формы ответов) и п. 4.3 (ключ страницы); меняется только новой редакцией проекта через
ORCH.

## 2. Команда

```
npm run team-web [-- --port <0..65535>] [--executor claude-cli|scripted] [--scenario <файл>]
main(argv: string[], env, io: { out, err }) → Promise<exitCode>
```

| Шаг | Что | Отказ (одна строка в `err`, без трассировки стека) | Код |
|---|---|---|---|
| 1 | разбор параметров: `--port` — целое 0…65535 (по умолчанию `DEFAULT_PORT`), `--executor` — `claude-cli` (по умолчанию) или `scripted`, `--scenario` — только вместе с `scripted` и обязателен с ним; повтор параметра, неизвестный параметр, параметр без значения | «Использование: npm run team-web [-- --port N] [--executor claude-cli\|scripted --scenario <файл>]» | 2 |
| 2 | `resolveHome(env)` и `readConfig(env)` ядра (`E_HOME`, `E_CONFIG`) | `formatError(err)` ядра | 2 |
| 3 | `scripted`: файл сценария читается (`readFileSync`, не больше `LIMITS.SCENARIO_BYTES_MAX`) и проверяется `parseScenario` из `team/executors/scripted.js` | «Файл сценария не найден или неверен» | 1 |
| 4 | чтение файлов `public/` в память (W6) | «Файлы страницы не найдены» | 3 |
| 5 | `createWebServer(...)`, `listen()` на `HOST` | порт занят (`EADDRINUSE`): «Порт N занят. Запустите с другим: npm run team-web -- --port <номер>»; другая ошибка ОС при `listen` (у ошибки строковый `code` вида `E[A-Z]+`, например `EACCES`; r3, F11): «Не удалось запустить сервер (<code>)» — только код ОС, без пути, без `message`, без стека; прочее — ошибка `main` (`formatError`) | 1 |
| 6 | печать **одной строки** в `out`: `Sai Team: http://127.0.0.1:<порт>/` | — | — |
| 7 | работа до SIGINT/SIGTERM → п. 8.4 | — | 0 (или 1, если движки не остановились за `SHUTDOWN_WAIT_MS`) |

Создание папки данных при запуске не происходит (её создаёт `createProject` ядра при первом проекте): запуск и чтение ничего не
пишут. Предупреждения ядра (`warnings` у `listProjects`/`readProject`, права папок) сервер печатает в `err` — каждый
отличный текст один раз за запуск — и на страницу не отдаёт (в них пути и режимы файлов).

## 3. Константы (`tools/src/web/config.js`)

| Имя | Значение | Что |
|---|---|---|
| `HOST` | `"127.0.0.1"` | единственный адрес сервера (критерий 1; TR-4d) |
| `DEFAULT_PORT` | 4781 | постоянная ссылка (Pixel Office — 4780) |
| `BODY_MAX` | 65 536 | наибольшее тело запроса записи в байтах; равно `MSG_BYTES_MAX` канала (тест сверяет) — сообщение больше предела отклоняется до любой записи (критерий 15 (в)) |
| `BODY_IDLE_MS` | 15 000 | (r3, S-1) наибольший простой при чтении тела POST: от начала чтения тела и от каждой следующей части тела; истёк — 408 (п. 4.1, шаг 4) |
| `KEY_HEADER` | `"x-sai-page"` | заголовок ключа страницы (W2) |
| `KEY_BYTES` | 32 | случайных байтов ключа (64 hex) |
| `JSON_TYPE` | `"application/json; charset=utf-8"` | `Content-Type` каждого ответа API и каждого отказа (п. 4.2; F-2) |
| `ENGINE_START_WAIT_MS` | 5 000 | сколько запрос создания ждёт первой записи движка (п. 8.3) |
| `START_POLL_MS` | 50 | шаг этого ожидания |
| `SHUTDOWN_WAIT_MS` | 15 000 | ожидание остановки движков при выходе (= `CANCEL_WAIT_MS` движка) |
| `LAST_PHRASES` | 5 | фраз «что происходит» (критерий 4 (1)) |
| `STATIC_NAME` | `/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/` | имя файла страницы |
| `STATIC_TYPES` | `.html` → `text/html; charset=utf-8`, `.js` → `text/javascript; charset=utf-8`, `.css` → `text/css; charset=utf-8`, `.svg` → `image/svg+xml` | допустимые файлы страницы |

В коде страницы (`public/app.js`): `REFRESH_MS` — период опроса, **ровно 5 000** (F-10; то же число — в описании
интерфейса и в надписи «обновление раз в 5 секунд»); тест читает строку `const REFRESH_MS = <число>;` и требует число
≤ 5 000 (критерий 8). Как отсчитывается период — п. 9.

## 4. Защита (W2; критерии 1, 9)

### 4.1. Порядок проверок в каждом запросе (`server.js`, одна синхронная часть обработчика, до любого чтения данных)

1. **Host** ровно `127.0.0.1:<порт>` или `localhost:<порт>` (порт — фактический после `listen`). Иначе — 403, тело
   `Failure` с `error_text` «Запрос отклонён», ни одного обращения к ядру (тело не содержит данных проекта).
2. **Метод и путь** — п. 5.1. Путь разбирается вручную: строка запроса до `?`, части между `/`, каждая часть
   `decodeURIComponent` один раз (ошибка декодирования — «не найдено»). URL-объект и нормализация пути не применяются.
3. **Только для POST** (до чтения тела), в этом порядке:
   1. `Origin` есть и равен `http://127.0.0.1:<порт>` или `http://localhost:<порт>`;
   2. `Content-Type` (F-9): значение заголовка до первого `;`, без пробелов и табуляций по краям, в нижнем регистре, равно
      ровно `application/json`. Параметры после `;` допустимы и не проверяются (`application/json; charset=UTF-8`,
      `Application/JSON ;charset=utf-8` проходят; `text/plain`, `application/json-patch+json`, `application/jsonx`, пустое
      значение и отсутствие заголовка — нет). Тело всё равно читается только как UTF-8 (шаг 4). Страница шлёт ровно
      `application/json`;
   3. `X-Sai-Page` есть и состоит ровно из 64 знаков `0-9a-f`;
   4. `X-Sai-Page` совпадает с ключом запуска (`timingSafeEqual`).
   Нарушение 1–3 — 403 `Failure` с `TEXT.refused`, `reload: false`. Нарушение только 4 (ключ правильного вида, но не
   этого запуска — так бывает у страницы, открытой до перезапуска сервера; F-3) — 403 `Failure` с `TEXT.staleKey`,
   `reload: true`. В обоих случаях тело не читается, журнал и папки не меняются. Различие 403 не открывает ничего
   чужой странице: её ответ без `Access-Control-*` ей не виден, а ключ правильного вида она всё равно не знает.
4. **Тело** (POST): не больше `BODY_MAX` байт (по `Content-Length` и по факту чтения) — иначе 413 `Failure` с
   `TEXT.tooBig`, остаток тела отбрасывается (как Pixel Office: не больше 8 МиБ, простой 5 с) или соединение закрывается;
   UTF-8 без ошибок (`TextDecoder` с `fatal`), `JSON.parse`, корень — объект ровно с допустимыми ключами (п. 5.4) — иначе
   400 `Failure` с `TEXT.badRequest`.
   **Простой при чтении тела (r3, S-1).** Чтение тела ограничено простоем `BODY_IDLE_MS` (15 с): отсчёт начинается, когда
   проверки шага 3 пройдены и начато чтение тела, и начинается заново с каждой пришедшей частью тела. Конец тела или
   отказ 413 отменяют отсчёт в том же обработчике, где они случились. Отсчёт истёк, а тело не дочитано — ответ 408
   `Failure { error_text: TEXT.internal «Что-то пошло не так. Повторите позже», field: null, reload: false }` (общий
   текст п. 10) с заголовком `Connection: close`; дальше тело не читается, соединение закрывается после отправки ответа;
   обработчик записи (`postProject`/`postChat`) **не вызывается** — ядро, движок и канал не трогаются, журнал и папки не
   меняются; строки в `err` нет (это не сбой сервера). Части тела, пришедшие после ответа, отбрасываются. Срок простоя
   задаёт `opts.bodyIdleMs` у `createWebServer` (по умолчанию `BODY_IDLE_MS`; команда `main.js` его не передаёт — только
   тест, чтобы не ждать 15 с). Таймауты Node (`requestTimeout`, `headersTimeout`) не меняются.

### 4.2. Заголовки ответов

Все ответы: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. Все ответы
API и все отказы (200, 201, 400, 403, 404, 405, 408, 409, 413, 500, 504) — `Content-Type: application/json; charset=utf-8`
(`JSON_TYPE`, F-2): вместе с `nosniff` чужая страница не может подключить ответ API как скрипт или стиль
(`<script src="http://127.0.0.1:<порт>/api/projects">` браузер отвергнет по типу). Файлы страницы — по `STATIC_TYPES`. HTML — ещё
`Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self';
base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'` (как Pixel Office). Заголовков
`Access-Control-*` нет никогда. `OPTIONS` и прочие методы — 405 `{"error_text": TEXT.badRequest}` с `Allow`.

### 4.3. Ключ страницы (общий контракт сервера и страницы)

- Создаётся в `createWebServer` (`crypto.randomBytes(KEY_BYTES)` → hex), живёт в замыкании; не пишется в файлы, не
  печатается, не попадает в ответы API и сообщения об ошибках.
- `public/index.html` содержит ровно одну строку-метку в форме, которую оставляет форматтер репозитория (prettier):
  `<meta name="sai-page" content="" />` (r3, F2). Сервер принимает метку `<meta name="sai-page" content=""`, за которой
  до `>` стоят необязательный пробел и необязательный `/` (то есть и форму `content="">`), — но в файле должно быть **ровно
  одно** вхождение метки в любой из форм. На `GET /` (и `GET /index.html`) сервер отдаёт
  файл, где в метке пустое `content=""` заменено на `content="<64 hex>"` (остальная запись метки не меняется). Нет метки или
  их больше одной — запуск отказывает (шаг 4 п. 2).
- Страница читает ключ из `meta[name="sai-page"]` и ставит его в заголовок `X-Sai-Page` каждого POST.
- В HTML нет слова «token» (п. 6.3); имя метки — `sai-page`.
- **Перезапуск сервера (F-3).** Новый запуск — новый ключ. Открытая до перезапуска страница продолжает читать (GET ключа
  не требует, блок связи снова «На связи»), но её POST получает 403 `{ error_text: TEXT.staleKey, field: null,
  reload: true }`. Страница по `reload === true` показывает `error_text` и кнопку «Обновить страницу» (подпись — в
  `index.html`, в `public/*.js` кириллицы нет); текст в поле ввода остаётся, пока человек не нажмёт кнопку. Нажатие
  перезагружает страницу (`location.reload()`); новый `GET /` даёт новый ключ. Сама страница ничего не повторяет.

### 4.4. «Не найдено» одинаково (критерий 9; принцип Q8 для проектов)

Одна функция `notFound(res)`: 404, тело ровно `{"error_text":"Не найдено","field":null,"reload":false}` (байт в байт),
те же заголовки. Её дают:
путь не из таблицы п. 5.1; часть пути, которая не проходит шаблон (`PATTERNS.project`, `PATTERNS.task`, номер роли
`1…ROLES.length` без ведущих нулей); ошибка декодирования; `E_NOT_FOUND` ядра (нет папки, ссылка, чужой владелец, нет
журнала); задача, которой нет **в этом** проекте. Так `../x`, `%2F…` (абсолютный путь), `..%2Fx` и несуществующий id
неотличимы. Проверка шаблона — до обращения к файлам (как `resolveProjectDir`).

## 5. API (контракт; имена полей — источник правды для `REQ-011-ui.md`)

### 5.1. Маршруты

| Метод и путь | Обработчик (`api.js`) | Успех |
|---|---|---|
| `GET /` , `GET /<имя файла public/>` | `server.js` | файл из памяти (W6) |
| `GET /api/projects` | `getProjects(ctx)` | 200 `ProjectList` |
| `POST /api/projects` | `postProject(ctx, body)` | 201 `Created` |
| `GET /api/projects/<id>` | `getProject(ctx, id)` | 200 `ProjectPage` |
| `GET /api/projects/<id>/chat` | `getChat(ctx, id)` | 200 `ChatPage` |
| `POST /api/projects/<id>/chat` | `postChat(ctx, id, body)` | 200 `Sent` |
| `GET /api/projects/<id>/tasks/<task>` | `getTask(ctx, id, task)` | 200 `TaskPage` |
| `GET /api/projects/<id>/roles/<n>` | `getRole(ctx, id, n)` | 200 `RoleCard` |

```
ctx = { home, env, config, executor: "claude-cli"|"scripted", scenarioBytes: Buffer|null, engines: Engines, warn }
Reply = { status: int, body: object }        // все обработчики api.js возвращают Reply (или Promise<Reply>), не бросают
createWebServer(opts: { home, env, config, executor, scenarioBytes, port, publicFiles: Map<name, Buffer>, engines, warn })
  → { listen(): Promise<{ port }>, close(): Promise<void>, port(): int | null }
```

Ошибка любого обработчика — `Reply` с телом `Failure` (п. 5.3, 10). Ни одно тело не содержит трассировки стека, кода
ошибки ядра, пути файла, pid.

### 5.2. Ссылки и адреса страницы (F-6)

`Link = { to: "project" | "chat" | "task" | "role", api: string }`, где `api` — путь этого сервера:
`/api/projects/<id>`, `/api/projects/<id>/chat`, `/api/projects/<id>/tasks/<task>`, `/api/projects/<id>/roles/<n>`
(`<n>` — **номер** роли 1…10, W5; кода роли в адресах нет). Каждая ссылка ведёт на объект **того же** проекта
(критерий 6).

Адрес страницы (часть после `#`) и путь API связаны двумя правилами, других нет:

- ссылка → адрес: `"#" + link.api.slice(4)` (например `#/projects/p-20990101-a1b2c3/tasks/t-0002`);
- адрес → запрос: `"/api" + location.hash.slice(1)`, только если адрес начинается с `#/projects/`; иначе — экран списка.

| Адрес страницы | Экран | Запросы опроса |
|---|---|---|
| `#/` (и пустой, и любой не с `#/projects/`) | список проектов и форма «Новый проект» | `GET /api/projects` |
| `#/projects/<id>` | страница проекта | `GET /api/projects/<id>` и `GET <ProjectPage.links.chat.api>` |
| `#/projects/<id>/chat` | страница проекта, фокус в поле сообщения чата | те же |
| `#/projects/<id>/tasks/<task>` | страница проекта и поверх неё карточка задачи | те же и `GET` этого адреса |
| `#/projects/<id>/roles/<n>` | страница проекта и поверх неё карточка исполнителя | те же и `GET` этого адреса |

Для карточки путь проекта — первые три части пути (`/api/projects/<id>`); закрытие карточки ведёт на
`"#" + <ответ карточки>.project.link.api.slice(4)`. Страница не проверяет вид `id`, задачи и номера сама и не собирает
адрес из полей (`id`, `n`, кодов): переходы — только по `link` из ответов. Ответ 404 на любой запрос экрана — экран
«не найдено» описания интерфейса. Формы «Новый проект» отдельного адреса нет (`#/new` убран: она на экране списка).

### 5.3. Формы (F-1, F-4, F-5, F-7)

Поля с пометкой **(п)** — «для показа»: их проверяет критерий 7 (п. 6). Остальные — данные (цель, текст задачи, чат,
имена файлов — показываются как есть) или служебные (идентификаторы, числа, признаки, ссылки, время). Имена полей —
ровно эти; поле, которого здесь нет, страница не читает (п. 17, «Сведение»). Откуда берётся каждое поле — таблица п. 5.5.

```
Link        = { to: "project" | "chat" | "task" | "role", api: string }
RoleRef     = { n: int, title (п), link: Link }
TaskBrief   = { id, text, status, status_text (п), reason_text (п) | null, role: RoleRef, link: Link }
Phrase      = { at: string, text (п) }
WaitRef     = { task: string | null, chat_n: int | null, link: Link }
ResultRef   = { name, task: string, task_text, role: RoleRef, link: Link }   // только файлы с задачей (п. 7.1 (6), r3)
Failure     = { error_text (п), field: "goal" | "budget_usd" | "text" | null, reload: bool }

ProjectList = { projects: ProjectItem[] }
ProjectItem = { id, goal, created_at, status, status_text (п),
                progress: { done, total } | null, progress_text (п),
                needs_decision: bool, needs_decision_text (п) | null,
                test_executor: bool, test_executor_text (п) | null,
                broken: false, link: Link }
            | { id, broken: true, problem_text (п), link: null }

ProjectPage = { id, goal, created_at, status, status_text (п),
                pause_text (п) | null, tail_text (п) | null,
                progress: { done, total } | null, progress_text (п),
                needs_decision: bool, needs_decision_text (п) | null,
                test_executor: bool, test_executor_text (п) | null,
                happening: Phrase[],                                         // (1)
                busy: RoleRef[],                                             // (2)
                due_text (п),                                                // (3)
                problems: { failed: TaskBrief[], waiting_text (п) | null },  // (4)
                waits: { count: int, count_text (п), note_text (п) | null,
                         questions: WaitRef[] },                             // (5)
                results: ResultRef[],                                        // (6)
                tasks: TaskBrief[], tasks_empty_text (п) | null,
                links: { chat: Link } }

ChatPage    = { project: { id, goal, status_text (п), test_executor_text (п) | null, link: Link },
                messages: ChatMessage[] }
ChatMessage = { n: int, at: string, from: "user" | "team", author_text (п),
                question: bool, open: bool, truncated: bool, labels_text: string[] (п), text,
                task: { text, role_title (п), link: Link } | null }

TaskPage    = { project: { id, goal, link: Link },
                task: TaskBrief & { done_when, files: string[] } }
RoleCard    = { project: { id, goal, link: Link },
                role: { n: int, title (п), description (п) },
                tasks: TaskBrief[] }

Created     = { project: { id, link: Link }, started: bool, result_text (п) }
Sent        = { result_text (п), message: ChatMessage | null }
```

Убрано по сравнению с r0: `ProjectPage.final`, `busy.text` (пустой список — постоянная надпись страницы),
`TaskBrief.phrase` (заменён на `reason_text`), `ChatMessage.label_text` и `task_link` (заменены на `question`, `open`,
`labels_text`, `task`), `TaskPage.task.depends_on` и `TaskPage.chat` (критериям не нужны, описание их не показывает).

В ответах **нет**: кода роли, полей `internal` каталога (промт, инструменты), исполнителя по имени, `scenario_file`, путей
`work/`, расходов и потолка, `run_id`, `seq` как поля, `msg`/`nonce`/`dropped` событий (REQ-022 — режим специалиста).

### 5.4. Тела запросов

- `POST /api/projects`: ровно `{ "goal": string, "budget_usd": number }`.
- `POST /api/projects/<id>/chat`: ровно `{ "text": string }`.

Лишний ключ, нет ключа, не тот тип — 400 `Failure` с `TEXT.badRequest`, `field: null` (кроме случаев п. 8.1, у которых
свой текст и своё `field`).

### 5.5. Контракт полей: ответ → поле → тип → откуда берётся

Это единственный перечень полей для описания интерфейса `docs/design/REQ-011-ui.md`: оно ссылается на строки этой
таблицы по имени «Ответ.поле». `read` = `readProject(id)` ядра (`state`, `tail`, `events`), `summary` — элемент
`listProjects` ядра, `view` = `projectView(state, tail, events)` ядра. Время — строка ISO из журнала (`…Z`); страница
показывает его по часам компьютера.

**Общие формы**

| Ответ | Поле | Тип | Откуда берётся |
|---|---|---|---|
| Link | `to` | `"project"`/`"chat"`/`"task"`/`"role"` | вид объекта |
| Link | `api` | строка | путь п. 5.2 этого проекта; адрес страницы — по правилу п. 5.2 |
| RoleRef | `n` | целое 1…10 | индекс роли в `ROLES` + 1 (`roleNo`, W5) |
| RoleRef | `title` (п) | строка | `publicRole(role).title` |
| RoleRef | `link` | Link `role` | `/api/projects/<id>/roles/<n>` |
| TaskBrief | `id` | строка `t-NNNN` | `state.tasks[].id` |
| TaskBrief | `text` | строка (текст человека) | `state.tasks[].text` |
| TaskBrief | `status` | код статуса задачи | `state.tasks[].status`; только для цвета, не показывается |
| TaskBrief | `status_text` (п) | строка | `TASK_STATUS_TEXT[status]` |
| TaskBrief | `reason_text` (п) | строка или `null` | только у статусов `failed`, `waiting_user`, `interrupted`: фраза модуля «язык» (`phrasesForJournal(events)[i]`) последнего события этой задачи вида `TASK_FAILED`, `TASK_WAITING_USER`, `TASK_INTERRUPTED` соответственно; у остальных статусов и если события нет — `null`. Подробность сбоя исполнителя (`FAIL_DETAIL`) не берётся (в ней бывают технические слова) |
| TaskBrief | `role` | RoleRef | роль задачи |
| TaskBrief | `link` | Link `task` | `/api/projects/<id>/tasks/<task>` |
| Phrase | `at` | время ISO | `events[i].ts` |
| Phrase | `text` (п) | строка | `phrasesForJournal(events)[i]` |
| WaitRef | `task` | `t-NNNN` или `null` | п. 7.3 (`null` — вопрос проекта) |
| WaitRef | `chat_n` | целое или `null` | номер `CHAT` вопроса (п. 7.3) = `ChatMessage.n` этого вопроса |
| WaitRef | `link` | Link | вопрос задачи — на задачу; вопрос проекта — на чат |
| ResultRef | `name` | строка (текст человека) | `state.files[].name` — только файла **с задачей** (`state.files[].task !== null`; r3, F1, п. 7.1 (6)); файл без задачи ResultRef не получает |
| ResultRef | `task` | `t-NNNN` (никогда не `null`) | `state.files[].task` |
| ResultRef | `task_text` | строка (текст человека) | текст этой задачи |
| ResultRef | `role` | RoleRef | роль этой задачи |
| ResultRef | `link` | Link `task` | на задачу файла |
| Failure | `error_text` (п) | строка | текст п. 10 по коду отказа |
| Failure | `field` | `"goal"`/`"budget_usd"`/`"text"`/`null` | поле формы, к которому относится отказ (п. 10, столбец «field») |
| Failure | `reload` | логическое | `true` только у отказа «устаревший ключ» (п. 4.1, 4.3) |

**Список — `GET /api/projects` → ProjectList**

| Ответ | Поле | Тип | Откуда берётся |
|---|---|---|---|
| ProjectList | `projects` | ProjectItem[] | порядок `listProjects` ядра: по времени создания, затем по `id`; страница не сортирует |
| ProjectItem | `id` | `p-…` | `summary.id` |
| ProjectItem | `goal` | строка (текст человека) | `summary.goal` без изменений |
| ProjectItem | `created_at` | время ISO | `summary.created_at` (время события создания) |
| ProjectItem | `status` | код статуса проекта | `summary.status`; только для цвета |
| ProjectItem | `status_text` (п) | строка | `PROJECT_STATUS_TEXT[status]` |
| ProjectItem | `progress` | `{done, total}` или `null` | `summary.progress` (`reducer.progress`); `null` — задач нет |
| ProjectItem | `progress_text` (п) | строка | `progressOf(done, total)` — «N из M задач»; при `progress = null` — «Задач пока нет». Это же — имя полосы хода |
| ProjectItem | `needs_decision` | логическое | `status === "waiting_user"` (критерий 2; решение 0025) |
| ProjectItem | `needs_decision_text` (п) | строка или `null` | `TEXT.needsDecision` при `needs_decision`, иначе `null` |
| ProjectItem | `test_executor` | логическое | `summary.executor === "scripted"` |
| ProjectItem | `test_executor_text` (п) | строка или `null` | `TEXT.testExecutor` при `test_executor`, иначе `null` |
| ProjectItem | `broken` | `false` | признак обычной карточки |
| ProjectItem | `link` | Link `project` | `/api/projects/<id>` |
| ProjectItem (не читается) | `id` | `p-…` | имя папки из `listProjects` (элемент `{id, error}`) |
| ProjectItem (не читается) | `broken` | `true` | ядро не прочитало проект (`E_CORRUPT`, `E_DISK`) — F-7 |
| ProjectItem (не читается) | `problem_text` (п) | строка | `E_CORRUPT` → `TEXT.corrupt`, иначе `TEXT.readFailed` (п. 10) |
| ProjectItem (не читается) | `link` | `null` | открыть нечего; карточка не ссылка |

**Проект — `GET /api/projects/<id>` → ProjectPage**

| Ответ | Поле | Тип | Откуда берётся |
|---|---|---|---|
| ProjectPage | `id`, `goal`, `created_at`, `status`, `status_text`, `progress`, `progress_text`, `needs_decision`, `needs_decision_text`, `test_executor`, `test_executor_text` | как у ProjectItem | `view` и те же правила |
| ProjectPage | `pause_text` (п) | строка или `null` | `status === "paused"` (после Ctrl-C сервера, команды `pause` или восстановления после сбоя) → `TEXT.paused` «Проект приостановлен, продолжите его командой resume» (решение 0025); иначе `null` — F-5, F-7 |
| ProjectPage | `tail_text` (п) | строка или `null` | `read.tail` есть → `TEXT.tail`; иначе `null` — F-7 |
| ProjectPage | `happening` | Phrase[] (0…5) | (1) последние `LAST_PHRASES` событий: `at` — их `ts`, `text` — их фразы; в порядке журнала, последняя — последней |
| ProjectPage | `busy` | RoleRef[] | (2) роли задач `running` и `review`, без повторов, по номеру первой такой задачи; пусто — `[]` |
| ProjectPage | `due_text` (п) | строка | (3) п. 7.2 |
| ProjectPage | `problems.failed` | TaskBrief[] | (4) задачи `failed`, по номеру; причина — их `reason_text` |
| ProjectPage | `problems.waiting_text` (п) | строка или `null` | (4) `view.waiting.reason_text` (проект ждёт решения) или `null` |
| ProjectPage | `waits.count` | целое ≥ 0 | (5) п. 7.3 |
| ProjectPage | `waits.count_text` (п) | строка | `count = 0` → `TEXT.waitsNone` «Ничего не нужно»; иначе `waitsCount(count)` «Вопросов, ждущих ответа: N» |
| ProjectPage | `waits.note_text` (п) | строка или `null` | `count > 0` → `TEXT.decisionsLater` (п. 6.2; временно до REQ-017, убирается вместе с полем); иначе `null` — F-4 |
| ProjectPage | `waits.questions` | WaitRef[] | (5) п. 7.3, по возрастанию `chat_n` |
| ProjectPage | `results` | ResultRef[] | (6) `state.files`, у которых `task !== null`, в порядке состояния (r3, F1); файлы без задачи (вход, который записал тестовый исполнитель, — `r-…-plan-input.md`, `r-…-goal-input.md`, п. 0) не входят ни в список, ни в его длину; пусто — `[]`, даже если файлы без задачи есть |
| ProjectPage | `tasks` | TaskBrief[] | все задачи плана, по номеру |
| ProjectPage | `tasks_empty_text` (п) | строка или `null` | задач нет: статус `created` или `planning` → `TEXT.planPending` «Плана пока нет — команда его составляет», иначе `TEXT.noTasksAtAll` «Задач нет»; задачи есть → `null` |
| ProjectPage | `links.chat` | Link `chat` | `/api/projects/<id>/chat` — путь для опроса и отправки чата |

**Чат — `GET /api/projects/<id>/chat` → ChatPage; ответ отправки — Sent**

| Ответ | Поле | Тип | Откуда берётся |
|---|---|---|---|
| ChatPage | `project.id`, `project.goal`, `project.status_text`, `project.test_executor_text`, `project.link` | как у ProjectPage | те же правила |
| ChatPage | `messages` | ChatMessage[] | **все** `state.chat` в порядке журнала (старые первыми); сервер не сокращает список, поэтому «показано N из M» нет |
| ChatMessage | `n` | целое | `state.chat[].seq` (служебное: только чтобы связать с `WaitRef.chat_n`; не показывается) |
| ChatMessage | `at` | время ISO | `state.chat[].ts` |
| ChatMessage | `from` | `"user"`/`"team"` | `source === "USER"` → `user`, иначе `team`; только для цвета |
| ChatMessage | `author_text` (п) | строка | `user` → `TEXT.authorUser` «Вы»; `team` → `TEXT.authorTeam` «Команда Sai» |
| ChatMessage | `question` | логическое | `state.chat[].kind === "question"` |
| ChatMessage | `open` | логическое | `n` есть среди `chat_n` открытых вопросов п. 7.3 (тот же расчёт, что `waits`) |
| ChatMessage | `truncated` | логическое | (r3, F4) `state.chat[].truncated === true`; у `Sent.message` — `event.data.truncated === true`; иначе `false`. Служебное: само не показывается; страница по нему выбирает вид метки «сообщение сокращено» (п. 13) |
| ChatMessage | `labels_text` (п) | строки, 0…3, в этом порядке | `question` → `TEXT.labelQuestion` «вопрос»; `open` → `TEXT.labelOpen` «ждёт ответа»; `truncated` → `TEXT.labelTruncated` «сообщение сокращено». Метка «сообщение сокращено» есть ровно тогда, когда `truncated: true`, и тогда она последняя |
| ChatMessage | `text` | строка (текст человека) | `state.chat[].text` как в журнале |
| ChatMessage | `task` | объект или `null` | `state.chat[].task` есть и такая задача есть в этом проекте → `{ text: текст задачи, role_title (п): publicRole(...).title, link: Link task }`; иначе `null`. Подпись «Задача:» и тире — постоянная надпись страницы |
| Sent | `result_text` (п) | строка | `TEXT.sent` «Отправлено» |
| Sent | `message` | ChatMessage или `null` | событие `CHAT`, записанное этой отправкой (`ack.event` движка или `event` ядра), теми же правилами; `null`, если события нет в ответе — тогда сообщение придёт со следующим опросом |

**Задача, исполнитель, создание**

| Ответ | Поле | Тип | Откуда берётся |
|---|---|---|---|
| TaskPage | `project.id`, `project.goal`, `project.link` | как у ProjectPage | — |
| TaskPage | `task` | TaskBrief | задача с этим `id` в **этом** проекте; нет — 404 |
| TaskPage | `task.done_when` | строка (текст человека) | `state.tasks[].done_when` |
| TaskPage | `task.files` | строки | `state.tasks[].files` (имена файлов результата этой задачи; те же, что `results` с этим `task`; файлов без задачи здесь нет по определению) |
| RoleCard | `project.*` | как у TaskPage | — |
| RoleCard | `role.n` | целое 1…10 | номер из адреса |
| RoleCard | `role.title`, `role.description` (п) | строки | `publicRole(ROLES[n-1])` |
| RoleCard | `tasks` | TaskBrief[] | задачи этой роли в этом проекте, по номеру; может быть `[]` |
| Created | `project.id`, `project.link` | `p-…`, Link | новый проект |
| Created | `started` | логическое | п. 8.3: движок начал работу |
| Created | `result_text` (п) | строка | `started` → `TEXT.created` «Проект создан, команда начала работу»; иначе `createdNotStarted(why)` «Проект создан, но работа не началась: …» (п. 10) |

### 5.6. Сведение с описанием интерфейса r1 (14 расхождений F-1)

| Описание r1 | Контракт r2 | Решение |
|---|---|---|
| `progress.text`, «N из M задач» | `progress_text`, текст «N из M задач» | имя — проекта, текст — описания (он же в требовании) |
| `created_at` в карточке списка | `ProjectItem.created_at`, `ProjectPage.created_at` | поле добавлено |
| пометки — постоянные надписи страницы | `needs_decision_text`, `test_executor_text` с сервера, строчными: «нужно ваше решение», «тестовый исполнитель» | текст — сервера; страница показывает поле |
| карточки повреждённого проекта нет | `broken`, `problem_text`, `link: null` | описанию — добавить вид (F-7) |
| адреса `#/p/…`, `/r/<код роли>`, свой разбор | п. 5.2: `#/projects/<id>…`, номер роли, только `Link.api`; формы на `#/` | адреса — проекта; `#/new` убран |
| `now.phrases[] {ts, text}` | `happening: Phrase[] {at, text}` | время фразы добавлено |
| `who[] {role, name}` | `busy: RoleRef[] {n, title, link}` | поле проекта; кода роли нет |
| `eta_text` | `due_text` | имя проекта |
| `problems.waiting_reason_text`, `failed_tasks[]` с `reason_text` | `problems.waiting_text`, `problems.failed: TaskBrief[]` с `reason_text` | `reason_text` добавлен в TaskBrief |
| `questions.count`, «Вопросов, ждущих ответа: N», `questions.note_text` | `waits.count`, `waits.count_text` с текстом описания, `waits.note_text` | имена — проекта, тексты — описания |
| `results[] {name, task_id, role, role_name}` | `ResultRef {name, task, task_text, role: RoleRef, link}` | имена — проекта |
| «Все задачи»: `role_name`, `reason_text`, `tasks_empty_text` | `role.title`, `reason_text`, `tasks_empty_text` | `reason_text` и `tasks_empty_text` добавлены; `depends_on` и чат задачи убраны из TaskPage |
| чат: `from` (user/sai), «Команда Sai», `ts`, `kind`+`open`, `task_id`+`task_label`, `messages_shown/total` | `from` (user/team), `author_text` «Вы»/«Команда Sai», `at`, `question`, `open`, `labels_text`, `task {text, role_title, link}`; список полный | поля добавлены; «показано N из M» описанию убрать |
| ответы записи: `id`, `message`, `field` | `Created.project.link`, `started`, `result_text`; `Failure {error_text, field, reload}`; `Sent.message` — сообщение чата, не текст ошибки | `field` добавлен; текст отказа — всегда `error_text`; описанию — показать `pause_text`, `tail_text`, `result_text` при `started = false`, `reload` |

### 5.7. Что страница делает с полями состояний (F-7; вид — описание интерфейса)

| Состояние | Признак в ответе | Что должно быть на странице (место и вид — `REQ-011-ui.md`) |
|---|---|---|
| проект создан, работа не началась | 201 `Created` с `started: false` | страница **не** уходит молча на проект: остаётся на форме, показывает `result_text` в строке итога (цвет предупреждения) и ссылку на проект по `project.link`; поля формы очищены (проект создан) |
| проект создан и начал работу | 201 `Created` с `started: true` | переход на `"#" + project.link.api.slice(4)` |
| проект не читается (в списке) | `ProjectItem.broken: true` | карточка без ссылки: `problem_text` вместо статуса и прогресса; вместо цели — `id` |
| проект не читается (своя страница) | 500 `Failure` (`TEXT.corrupt` или `TEXT.readFailed`) | полоса ошибки с `error_text` |
| проект на паузе | `pause_text` не `null` | строка под заголовком проекта |
| недописанная запись журнала | `tail_text` не `null` | строка под заголовком проекта, тише `pause_text` |
| страница устарела после перезапуска | 403 `Failure` с `reload: true` | `error_text` в строке итога формы или чата и кнопка «Обновить страницу»; текст в поле остаётся |

## 6. Тексты «для показа» (`texts.js`; критерий 7)

### 6.1. Правило

Все поля (п) из п. 5.3 и все `error_text` формирует только сервер — из `texts.js`, из `PROJECT_STATUS_TEXT`/
`TASK_STATUS_TEXT` ядра, из фраз `language.js`/`view.js` ядра и из `publicRole`. В них нет: «токен», «контекст», «промт»,
«prompt», «token», «context», «JSON», «stderr», «stdout», «exit», «executor», «run_id», «seq» (без учёта регистра, латиница —
как отдельное слово), кодов статусов (`created`, `planning`, `running`, `paused`, `waiting_user`, `stopped`, `done`,
`failed`, `waiting`, `review`, `interrupted`), кодов ролей (`ROLE_CODES`), кодов ошибок (`E_…`) и знака «%». Числа — только
целыми словами («2 из 5 задач», «примерно через 12 мин»), без процентов.

Текст пользователя и агентов (`goal`, `text` задачи и чата, `done_when`, имена файлов) в проверку не входит и отдаётся без
изменений (только маскирование ядра при записи).

### 6.2. Постоянные тексты сервера

| Имя | Текст |
|---|---|
| `progressOf(d,t)` / `noTasks` | `${d} из ${t} задач` / «Задач пока нет» |
| `needsDecision` | «нужно ваше решение» |
| `testExecutor` | «тестовый исполнитель» |
| `dueUnknown` / `dueIn(x)` | «срок пока не оценить» / `примерно через ${x} мин` |
| `waitsNone` / `waitsCount(n)` | «Ничего не нужно» / `Вопросов, ждущих ответа: ${n}` |
| `decisionsLater` (F-4; временно до REQ-017, убирается вместе с полем `waits.note_text`) | «Ответить на вопрос можно будет в окне решений — оно появится позже. Сообщение в чате вопрос не закрывает.» |
| `paused` (F-5; решение 0025) | «Проект приостановлен, продолжите его командой resume» |
| `tail` | «Последняя запись проекта не дописана — она будет убрана при следующем действии» |
| `planPending` / `noTasksAtAll` | «Плана пока нет — команда его составляет» / «Задач нет» |
| `authorUser` / `authorTeam` | «Вы» / «Команда Sai» |
| `labelQuestion` / `labelOpen` / `labelTruncated` | «вопрос» / «ждёт ответа» / «сообщение сокращено» |
| `sent` | «Отправлено» |
| `created` / `createdNotStarted(why)` | «Проект создан, команда начала работу» / `Проект создан, но работа не началась: ${why}` |
| тексты ошибок | п. 10 |

### 6.3. Страница

- Все постоянные подписи страницы — в `public/*.html` (разметка и `<template>`). В `public/*.js` нет ни одной кириллической
  буквы (тест), поэтому вне проверки критерия 7 текстов не остаётся.
- «Видимый текст HTML» для критерия 7 — текст между тегами (без `<script>`, `<style>`, комментариев) и значения атрибутов
  `title`, `alt`, `placeholder`, `aria-label`, `label`, `value`. В HTML нет встроенных стилей и `%` вообще.
- Текст из ответов вставляется только как текст (`textContent`, `createTextNode`); `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `document.write` в `public/` нет (критерий 5).

## 7. Вычисления (`display.js`, чистые функции)

```
listItem(summary | { id, error }) → ProjectItem
projectPage(read: { state, tail, events }) → ProjectPage
chatPage(read) → ChatPage
taskPage(read, taskId) → TaskPage | null            // null → «не найдено»
roleCard(read, n) → RoleCard | null                 // n вне 1..ROLES.length → null
dueText(state, events) → string
openWaits(state, events) → { count, questions: WaitRef[] }
busyRoles(state) → RoleRef[]
roleNo(code) → int;  roleOfNo(n) → Role | null      // номер = индекс в ROLES + 1 (W5)
```

Каждый ответ строится заново из `readProject`/`listProjects` ядра на каждый запрос (воспроизведение журнала); кеша нет
(критерий 8: событие видно в следующем ответе).

### 7.1. Шесть вопросов (критерий 4)

1. `happening` — последние `LAST_PHRASES` элементов `phrasesForJournal(events)` вместе с `ts` своих событий:
   `{ at: events[i].ts, text: phrases[i] }`, в порядке журнала (последняя — последней).
2. `busy` — роли задач в статусах `running` и `review`, без повторов, по номеру первой такой задачи; только они.
3. `due_text` — п. 7.2.
4. `problems.failed` — задачи `failed` (по номеру), с `reason_text` (п. 5.5); `problems.waiting_text` — `projectView(...).waiting.reason_text` или
   `null`.
5. `waits` — п. 7.3.
6. `results` (r3, F1, I2) — файлы результата **с задачей**: `state.files.filter(f => f.task !== null)` в порядке
   состояния, у каждого — имя, задача, текст задачи и её роль. Имена — ровно те же, что у файлов с задачей в состоянии
   (это же множество — объединение `state.tasks[].files`). Файл без задачи (`task: null`) — вход, который записал
   тестовый исполнитель для запуска без задачи (план, проверка цели; `engine/single-run.js`, `importOutputs`; п. 0), — для
   владельца не результат: в `results` его нет, `ResultRef` у него нет, а в счёт «и ещё N» он не входит.
   - **Сверка с критерием 4 (6)** («имена файлов результата с задачей и ролью — те же, что в состоянии») и описанием
     требования («(6) результат — список файлов результата с задачей и ролью»): критерий говорит о файлах результата,
     показанных с задачей и ролью; у файла без задачи нет ни задачи, ни роли, и показать его так нельзя. Сравнение
     «те же, что в состоянии» выполняется на том же множестве — файлах состояния с задачей; тест вычисляет его из
     `replay(events)` сам (WEB-4f). Противоречия нет, поэтому запасной вариант ORCH (все четыре поля `null` вместе)
     не выбран. Если REQ-VALIDATOR или RELEASE-VALIDATOR прочтут критерий как «все `state.files`», — вопрос через ORCH
     (WF-01), а не обход.
   - **Счётчик «и ещё N»** у списка (описание интерфейса, п. 5.8: показывается не больше 10 строк): N =
     `results.length − 10`, где `results` — уже отобранный сервером список; строка «и ещё N» есть только при N > 0.
     Надпись «Файлов результата пока нет» — при `results.length === 0`, в том числе когда в состоянии есть только файлы
     без задачи. Страница сама ничего не отбирает и не пересчитывает — берёт длину `results`.
   - Входные файлы **задач** (`t-NNNN-<попытка>-input.md`, у них `task` есть) остаются в `results`: правило — по задаче
     файла, а не по имени или `kind` (различать вход и итог задачи — дело ядра; вопрос — `result.issues` handoff-а r3).

### 7.2. Срок (правило требования и W4)

1. Проект в `FINAL_PROJECT_STATUS` → `due_text = status_text`.
2. Длительность задачи `done` = `ts(TASK_DONE) − ts(первого TASK_STARTED этой задачи)` в мс (по событиям журнала). Задача
   `done` без `TASK_STARTED` в медиану не входит.
3. Измеримых длительностей меньше 2 → `dueUnknown`.
4. `m` = медиана (чётное число — среднее двух средних); `u` = число задач плана в статусах `waiting`, `running`, `review`,
   `interrupted`, `waiting_user`; `p` = `state.parallel ?? PARALLEL_DEFAULT`; `k = ⌈u / p⌉`.
5. `m × k ≤ 0` → `dueUnknown` (r3, F5: `= 0` — незавершённых задач нет; `< 0` — медиана меньше нуля, это бывает только
   при часах, переведённых назад между событиями, и «примерно через −N мин» было бы неправдой, R2); иначе
   `X = ⌈m × k / 60 000⌉`, `due_text = dueIn(X)`.

Пример из критерия (вымышленные длительности 2, 4 и 9 мин, `u = 5`, `p = 2`): `m = 4 мин`, `k = 3`, «примерно через 12 мин».

### 7.3. Открытые ожидания решения (критерий 4 (5); «одно ожидание — один вопрос»)

`facts = scanFacts(events)`; `qs = openQuestions(state, facts)` (`engine/answers.js`: задача, ждущая решения, не
закрытая и без непримененного ответа, считается один раз; вопрос проекта добавляется только для `budget`, `plan_failed`,
`goal_check_failed`, поэтому ожидание, где «ждёт решения пользователя» и задача, и проект, — один вопрос). Из `qs`
считаются только **открытые движком** вопросом `CHAT {source: ENGINE, kind: "question"}`:

- вопрос задачи — `questionAsked(state, facts, q.task)`; `chat_n` — `facts.askedSeq[q.task]`;
- вопрос проекта — есть `CHAT` ENGINE `question` с `task = null` и номером больше номера последнего `PROJECT_WAITING`;
  `chat_n` — номер этого `CHAT`.

`count = questions.length`; `count_text` — `waitsNone` при 0, иначе `waitsCount(count)`; `note_text` — `decisionsLater`
при `count > 0`, иначе `null`. То же число покажет окно REQ-017 (оно должно брать `openWaits` из этого модуля).
`ChatMessage.open` — `n` входит в множество `chat_n` этого же расчёта (вопрос, закрытый ответом или новым статусом,
перестаёт быть открытым в том же ответе).

## 8. Запись

### 8.1. Новый проект (`postProject`; критерий 3)

Всё в одном синхронном участке до `createProject`, затем запуск движка:

1. Тело — ровно `{goal, budget_usd}` (п. 5.4).
2. `goal`: строка; `goal.trim() === ""` → 400 «Напишите цель одной фразой»; длиннее `LIMITS.GOAL_MAX` (2000) кодовых точек
   → 400 «Цель длиннее 2000 знаков — сократите её»; оба — `field: "goal"` (после маскирования ядро проверит предел ещё
   раз; его отказ `E_EVENT` — строка п. 10).
3. `budget_usd`: `typeof === "number"`, `Number.isFinite`, `> 0`, `≤ LIMITS.BUDGET_MAX` и **не больше 6 знаков после
   запятой** по правилу ядра: `Number(x.toFixed(6)) === x` (то же условие, что у вида `money` в `schema.js` и в
   `engine/channel.js`; F-11). Иначе (0, отрицательное, `0.0000001`, строка, `null`) → 400 «Потолок расходов — число
   больше 0 и не больше 100000, не больше 6 знаков после запятой», `field: "budget_usd"`.
4. `ctx.executor === "claude-cli"` и `!ctx.config.realRuns` → 400 «Настоящие запуски на этом компьютере выключены — проект не
   создан. Как включить, написано в инструкции Sai Team», `field: null` (папка не создаётся; запусков 0). Защита внутри `run()`
   исполнителя (0018) остаётся.
5. `createProject({goal, budget_usd, executor: ctx.executor, scenario_bytes?}, {home})` ядра — маскирование, проверка
   полей, атомарное создание папки (п. ядра). Отказ → п. 10.
6. `engines.start(id)` (п. 8.3) → `Created { started, result_text }`: `started` — `created`; иначе
   `createdNotStarted(why)`, где `why` — текст п. 10 по коду отказа движка. Код 201 в обоих случаях (проект создан).

Проверки шагов 2–3 повторяют правила команды `new` (`cli.js`, `parseNew`) для числа вместо строки; тест сверяет оба пути на
одних и тех же значениях (п. 15, WEB-3c).

**Потолок на странице (r3, F8).** Страница берёт текст поля потолка, убирает пробелы по краям и заменяет одну запятую на
точку; полученная строка совпадает с `/^[0-9]+(\.[0-9]+)?$/` → `budget_usd: Number(строка)`, иначе → `budget_usd: null`
(тогда сервер отвечает 400 с текстом потолка и `field: "budget_usd"`, шаг 3). Так «0x10», «0b11», «1e2», «+5», «.5»,
«5.» не превращаются в число, которого человек не писал. Остальные правила (0, больше 6 знаков, предел) проверяет только
сервер.

### 8.2. Сообщение чата (`postChat`; критерии 5, 15)

1. Тело — ровно `{text}`, `text` — строка (иначе 400 `badRequest`).
2. `await deliver(id, { kind: "say", args: { text } }, { home })` — **единственный** вызов записи чата. Всё остальное
   решает `deliver` (п. 13.9 движка), в той же операции, что и запись:
   - замок жив, держатель `engine` (движок этого сервера или из терминала) → канал, ожидание ack ≤ `ACK_WAIT_MS` (10 с);
     `via:"engine"` → 200 `{result_text: "Отправлено", message: из ack.event}`;
   - замка нет или pid мёртв → писатель ядра (с восстановлением, если нужно: `LOCK_STALE_REMOVED` и т. д.), `CHAT` USER,
     `close()` → 200 `{result_text: "Отправлено", message: из event}`;
   - замок жив, держатель не движок → `E_PROJECT_BUSY` → 409 «Сообщение не отправлено, повторите через несколько секунд»;
   - пустой текст (`E_EVENT`), длиннее 4000 (`E_TOO_LONG`), больше 64 КиБ (`E_MSG_TOO_BIG`), нет ack (`E_CHANNEL_TIMEOUT`,
     `E_CHANNEL_UNCONFIRMED`), ack «устарело» после срока ожидания (`E_CHANNEL_STALE`: `deliver` повторяет отправку только
     до срока ack, дальше бросает), ack с отказом (`E_ENGINE_STOPPING`, `E_CHANNEL_DROPPED`, `E_CHANNEL_FULL`, …), неверный
     вызов (`E_USAGE`), испорченный журнал (`E_CORRUPT`) → п. 10.
   - Перевод кода в ответ — одна функция `chatFailure(ctx, err) → Reply` (`api.js`, **экспортируется** — r3, F6, для
     теста WEB-10f): `E_NOT_FOUND` → `notFound`; код из строк «чат» п. 10 → их статус, текст и `field`; прочее —
     общий текст 500 и строка `formatError` в `err` (через `ctx.warn`).
3. Сервер сам журнал не пишет, сообщение повторно не шлёт, путь к папке сообщений не собирает. Маскирование — в `deliver`
   (до записи файла канала и до события).

### 8.3. Движки в процессе сервера (`engines.js`; W1)

```
createEngines({ home, env }) → Engines
Engines = { start(id): Promise<{ started: bool, error: TeamError | null }>,
            stopAll(waitMs): Promise<bool>,       // true — все run() завершились за waitMs
            size(): int }
```

- `start(id)`: `engine = createEngine(id, { home, env, mode: "start" })`; `done = engine.run()` (не ждать конца);
  запись в `Map id → { engine, done }`; `done` в любом исходе удаляет запись, а отказ печатается в `err` строкой
  `formatError(err)` ядра (без текста пользователя, без стека).
- Ожидание старта: каждые `START_POLL_MS`, не дольше `ENGINE_START_WAIT_MS` — `engine.state()` не `null` и его статус не
  `created` (записан `PROJECT_STARTED`) → `started: true`; `done` отклонён раньше → `started: false, error`. Время вышло, а
  движок ещё открывается — `started: true` (движок продолжает; страница увидит правду в журнале при опросе).
- Один движок на проект: в карте `id` уже есть → `started: true` без второго `createEngine` (замок ядра всё равно не дал бы
  второго писателя — `E_ENGINE_RUNNING`).
- Исполнитель и его проверки — внутри движка (п. 4.2, шаг 3 движка; 0018). Сервер не запускает процессов сам.

### 8.4. Остановка сервера (`main.js`)

SIGINT/SIGTERM (первый): `server.close()` (новые запросы не принимаются), `requestStop("signal")` каждому движку,
`engines.stopAll(SHUTDOWN_WAIT_MS)`; все завершились — код 0; нет — код 1 (следующее открытие восстановит проект, п. 14
движка). Второй сигнал — немедленный выход с кодом 1. Проекты после выхода — «на паузе» (п. 12.4 движка); продолжить —
`npm run team -- resume <id>`. Кнопки на странице нет (решение 0025: возобновление кнопкой — REQ-035); страница
проекта показывает `pause_text` «Проект приостановлен, продолжите его командой resume» (п. 5.5). Сами проекты после
перезапуска сервера не возобновляются (0025).

## 9. Живое обновление (критерий 8)

- Страница опрашивает запросы текущего экрана (таблица п. 5.2: список; проект и чат; карточка) с периодом
  `REFRESH_MS = 5000`, пока страница открыта (F-10). Период отсчитывается **от начала** прошлого опроса: опрос — все
  запросы экрана сразу; следующий начинается через `REFRESH_MS` после начала прошлого, но не раньше, чем пришли все его
  ответы (запросы не копятся). Так при ответах быстрее 5 с данные обновляются ровно раз в 5 с (критерий 8: «не реже раза в
  5 секунд»), а при медленном сервере — сразу после ответа.
- **Порядок запросов страницы проекта (r3, F7).** Адрес чата страница берёт только из ответа проекта
  (`ProjectPage.links.chat.api`, п. 5.2: адреса — только по `Link.api`), поэтому:
  - **первый** опрос экрана проекта (адрес чата этого экрана ещё не известен): `GET` проекта и, если есть, `GET`
    карточки — сразу и вместе; `GET` чата — после ответа проекта, только если ответ проекта 200 (у 404 и отказа чат не
    запрашивается);
  - **каждый следующий** опрос того же экрана (адрес чата уже известен из прошлого ответа): `GET` проекта, `GET` чата и
    `GET` карточки — сразу и вместе (все запросы экрана сразу). Если в этом опросе проект ответил 404, ответ чата
    отбрасывается и экран — «не найдено». Новый `links.chat.api` из ответа проекта действует со следующего опроса.
  Смена экрана (другой проект или список) забывает адрес чата: следующий экран начинает с «первого» опроса. Это
  единственное исключение из «все запросы экрана сразу», и оно бывает один раз на экран.
- **Итог опроса и блок связи (r3, F10).** Блок связи показывает итог последнего опроса: «На связи» — все ответы пришли и
  прочитаны; «Нет связи с сервером Sai» — хотя бы один запрос без ответа, ответ, который страница не может прочитать,
  **или любое неожиданное исключение внутри опроса** (оно не проглатывается: блок связи ставится в «Нет связи с сервером
  Sai» для этого же поколения опроса, данные на экране остаются прежними). Опрос после этого продолжается по расписанию.
  Страница не показывает «На связи», если экран в этом опросе не обновился.
- Смена экрана (переход по ссылке) начинает новый опрос сразу.
- GET ничего не пишет: обработчики чтения вызывают только `listProjects`, `readProject` ядра (они не берут замок и не
  пишут) и чистые функции `display.js`.

## 10. Пути отказа (что видит пользователь и что неизменно; Q10)

Сервер переводит **код** ошибки в свой текст (`texts.js`); `message` ошибок ядра на страницу не идёт (в них бывают коды
ОС, pid и команды терминала). Неизвестный код — общий текст и строка `formatError` в `err` сервера.

Тело каждого отказа — `Failure` (п. 5.3) с `Content-Type: application/json; charset=utf-8`. `field` — `"goal"` у отказов
цели, `"budget_usd"` у отказа потолка, `"text"` у отказов чата «пустой текст», «длиннее 4000», `E_MSG_TOO_BIG` и 413 тела
чата; у остальных — `null`. `reload` — `true` только у строки «ключ не этого запуска».

| Случай | HTTP | `error_text` (п) | Что неизменно |
|---|---|---|---|
| Host чужой | 403 | «Запрос отклонён» | всё; ядро не вызывается |
| POST без `Origin` или с чужим, не тот `Content-Type` (п. 4.1, 3.2), без ключа или ключ не из 64 знаков `0-9a-f` | 403 | `TEXT.refused` «Запрос отклонён: действие доступно только со страницы Sai Team» | журнал, список папок |
| POST с ключом правильного вида, но не этого запуска (страница открыта до перезапуска сервера; F-3) | 403, `reload: true` | `TEXT.staleKey` «Sai Team был перезапущен, и эта страница устарела. Обновите страницу и повторите — текст в поле пропадёт, скопируйте его, если он нужен» | журнал, список папок |
| тело больше `BODY_MAX` | 413 | «Сообщение слишком большое» | журнал, папка сообщений канала (файла нет) |
| тело POST не дочитано за `BODY_IDLE_MS` простоя (r3, S-1; п. 4.1, шаг 4) | 408, `Connection: close` | общий текст «Что-то пошло не так. Повторите позже» | всё: обработчик записи не вызывается, журнал, папки и канал не меняются; строки в `err` нет; следующий запрос отвечает как обычно |
| тело не JSON / не те ключи / не те типы | 400 | «Запрос не понят. Обновите страницу» | всё |
| путь/id/задача/роль не найдены (п. 4.4) | 404 | «Не найдено» | всё |
| метод не тот | 405 | «Запрос не понят. Обновите страницу» | всё |
| цель пустая / длинная, потолок неверный | 400 | п. 8.1 | нет новой папки в `SAI_TEAM_HOME` |
| `claude-cli` без настоящих запусков | 400 | п. 8.1, шаг 4 | нет новой папки; запусков исполнителя 0 |
| `E_EVENT` от `createProject` (цель после скрытия секретов стала длиннее 2000 знаков или иное поле не прошло проверку ядра; F-11) | 400, `field: "goal"` | «Проект не создан: проверьте цель — после скрытия секретов она не проходит проверку» | нет новой папки (ядро проверяет до создания) |
| `E_DISK` при создании | 500 | «Не удалось записать на диск — проект не создан» | нет новой папки (`.creating-*` удаляет ядро) |
| движок не стартовал (предпроверка движка, п. 4.2 шаг 3 движка: `E_SCENARIO`, `E_CONFIG`, `E_WORK_DIR`, `E_NO_BUDGET`, `E_REAL_RUNS_OFF`; `E_DISK`, прочее) | 201 | `result_text` = `createdNotStarted(why)`; `why`: «сценарий тестового исполнителя неверен» / «неверная настройка Sai Team» / «рабочая папка проекта недоступна» / «у проекта нет потолка расходов» / «настоящие запуски на этом компьютере выключены» / «не удалось записать на диск» / «внутренняя ошибка» | проект создан (событие создания), движка нет; сервер работает |
| программы claude нет (`SAI_TEAM_CLAUDE_BIN` указывает в пустоту) | — | движок стартует (предпроверка не ищет программу, п. исп. 5.1); запуск плана кончается `not_found`, движок пишет ожидание и вопрос — на странице проекта `waiting_text` и фраза модуля «язык» | сервер работает; журнал — только правда движка |
| чат: пустой текст (`E_EVENT`) | 400 | «Напишите сообщение» | журнал (хеш) |
| чат: длиннее 4000 (`E_TOO_LONG`) | 400 | «Сообщение длиннее 4000 знаков — сократите его» | журнал (хеш) |
| чат: `E_MSG_TOO_BIG` | 413 | «Сообщение слишком большое» | журнал, нет файла в канале |
| чат: `E_PROJECT_BUSY` (держатель не движок) | 409 | «Сообщение не отправлено, повторите через несколько секунд» | журнал (хеш) |
| чат: `E_CHANNEL_TIMEOUT`, `E_CHANNEL_UNCONFIRMED` | 504 | «Сообщение не подтверждено, проверьте чат через несколько секунд» | сервер журнал не пишет и не повторяет; отозванное сообщение не исполнится (п. 13.6 движка) |
| чат: `E_CHANNEL_STALE` (ack «устарело» пришёл после срока ожидания; r3, F6) | 504 | «Сообщение не подтверждено, проверьте чат через несколько секунд» | то же, что строкой выше: сервер журнал не пишет и не повторяет; строки в `err` нет (это не внутренняя ошибка) |
| чат: `E_USAGE` (неверный вызов `deliver`; r3, F6) | 400 | «Запрос не понят. Обновите страницу» | журнал (хеш) |
| чат: `E_CORRUPT` (журнал проекта повреждён; r3, F6) | 500 | `TEXT.corrupt` «Данные проекта повреждены — проект нельзя показать» | всё |
| чат: ack `E_ENGINE_STOPPING` | 409 | «Проект останавливается — сообщение не принято» | журнал |
| чат: ack `E_CHANNEL_DROPPED` | 409 | «Сообщение не выполнено: проект перезапускался. Отправьте его ещё раз» | журнал (кроме события уборки движка) |
| чат: `E_CHANNEL_FULL` | 409 | «Проект не успевает принимать сообщения — повторите через несколько секунд» | журнал |
| чат: `E_CHANNEL`, `E_CHANNEL_BAD` | 500 | «Связь с работающим проектом недоступна. Перезапустите Sai Team» | журнал |
| чат: `E_DISK` (запись) | 500 | `TEXT.chatDisk` «Диск не принимает записи: сообщение не сохранено…» (поправка `0026`, ISS-0010); следующее сообщение после снятия сбоя — 200, не 409 | журнал (откат ядра) |
| чат: `E_DISK` с `details.rollback:"failed"` (откат не удался; поправка `0026`) | 500 | `TEXT.chatDiskUnsure` — сообщение «могло сохраниться» | журнал не гарантирован; тесты WEB-10a, WEB-10g, WEB-10h |
| чтение: `E_CORRUPT` (испорченная строка в середине журнала) | 500 на странице проекта; в списке — `broken: true` | `TEXT.corrupt` «Данные проекта повреждены — проект нельзя показать» (в списке — `problem_text`) | всё; другие проекты показываются |
| чтение: `E_DISK` (чтение) | 500; в списке — `broken: true` | `TEXT.readFailed` «Не удалось прочитать данные проекта. Повторите позже» (в списке — `problem_text`) | всё |
| любое другое исключение обработчика | 500 | «Что-то пошло не так. Повторите позже» | ответ без стека; строка в `err`; следующий запрос отвечает как обычно |

Страница (FRONTEND-DEV, `REQ-011-ui.md`) при любом отказе отправки оставляет текст в поле ввода; нет связи с сервером
или неожиданная ошибка опроса (r3, F10, п. 9) — блок связи «Нет связи с сервером Sai», опрос продолжается. Сбой одного запроса не ломает другие (каждый обработчик в своём
`try`; `req`/`res` с обработчиками `error`).

## 11. Места записи (критерии 9, 15; решение 0024)

Сервер **сам файлов не пишет**. Записи идут только так:

| Действие | Через что | Место записи ядра/канала |
|---|---|---|
| новый проект | `createProject` (`store.js`) | создание папки проекта |
| события движка | `createEngine(...).run()` → писатель ядра; приём сообщений — `openInbox` | журнал; папка сообщений канала |
| чат без движка | `deliver` → `openWriter` + `applyCommand` + `close()` | журнал (и восстановление открытия) |
| чат при движке | `deliver` → `sendToEngine` | файл сообщения канала; событие пишет движок |

Проверки по коду (тест WEB-13, п. 15):

- `grep -rnE 'appendFile|writeFile|createWriteStream|openSync|rename' tools/src/web/` — пусто (в том числе в комментариях и
  именах: слова `rename`, `openSync` в `tools/src/web/` не встречаются);
- `grep -rn 'inbox' tools/src/web/` — пусто (и в комментариях);
- `grep -rn 'channel' tools/src/web/` — только `tools/src/web/api.js` (строка импорта `from "../team/engine/channel.js"` и
  вызов `deliver`);
- `grep -rl 'node:http' tools/src/web/` — только `tools/src/web/server.js`;
- `grep -rlE 'node:(https|net|tls|dgram)' tools/src/web/` — пусто;
- `grep -rnE 'node:(http|https|net|tls|dgram)|fetch[(]' tools/src/team/` — пусто;
- `grep -rn 'innerHTML\|outerHTML\|insertAdjacentHTML\|document.write' tools/src/web/public/` — пусто;
- `child_process` в `tools/src/web/` нет (TR-4c не меняется).

## 12. Сеть (критерий 14; REQ-014, критерий 4)

- `server.js`: `import http from "node:http"`; `listen(port, HOST)` с `HOST` из `./config.js` (TR-4d (3)); в файле нет
  `://`, кроме `http://${HOST}` (если нужен для `Origin`) — тогда `import { HOST } from "./config.js"` и без переобъявления
  (TR-4d (1)).
- `main.js` печатает ссылку, но сети не открывает; `node:http` и `fetch(` в нём нет.
- `public/app.js`: ровно один `fetch(` — внутри функции `request(path, init)`; все пути — константы `API_… = "/api/…"`
  (относительные); других `fetch(` в `public/` нет; адресов `http://`/`https://` в `public/` нет (TR-4f).
- TEST-DESIGNER вносит `web/server.js` и `web/public/app.js` в `NETWORK_FILES` и правило `fetch(` в TR-4e
  (п. 1.2); `npm run traces` проходит.

## 13. Страница (для FRONTEND-DEV; вид — `REQ-011-ui.md`)

- Одна страница `index.html` с адресами вида `#/`, `#/projects/<id>`, `#/projects/<id>/chat`,
  `#/projects/<id>/tasks/<task>`, `#/projects/<id>/roles/<n>` (`<n>` — номер роли); адреса и запросы — только по двум
  правилам п. 5.2 и `Link.api` из ответов (F-6). Форма «Новый проект» — на `#/`.
- Поля ответов — только по п. 5.3 и 5.5; состояния — п. 5.7.
- Ключ — п. 4.3 (и `reload` после перезапуска сервера); POST — с `Content-Type: application/json` ровно и `X-Sai-Page`.
- Опрос — п. 9 (`const REFRESH_MS = 5000;`), в том числе порядок запросов страницы проекта и блок связи при ошибке
  опроса (r3, F7, F10).
- Состояние связи хранится только в разметке блока связи (`data-state` и видимая подпись); отдельного поля состояния
  связи у страницы нет (r3, F9: поле, которое пишется и не читается, не заводится).
- Потолок при создании — по правилу п. 8.1 «Потолок на странице» (r3, F8).
- Метка «сообщение сокращено» в чате — свой (приглушённый) вид **только** при `ChatMessage.truncated === true` и только у
  последней метки `labels_text`; остальные метки — обычный вид. Порядок меток страница не угадывает (r3, F4).
- Ничего, чего нет в ответе сервера: ни своих процентов, ни выдуманного движения (R2).
- Правила п. 6.3 и п. 12.

## 14. README: раздел `## Sai Team — интерфейс` (`tools/README.md`; критерий 12)

Как запустить (`cd tools && npm run team-web`, параметры п. 2, тестовый исполнитель только для тестов), адрес
`http://127.0.0.1:4781/` (r3, F3: **временно** адрес пишется без строки-ссылки — «`127.0.0.1:4781` (`Sai Team: http://` и
этот адрес)», потому что ST-06 пока требует порт Pixel Office у каждой строки `http://127.0.0.1:<порт>` во всём README;
после того как TEST-DESIGNER ограничит ST-06 разделом `## Pixel Office` (п. 1.2), CODE-FIXER возвращает строку
`http://127.0.0.1:4781/`; критерий 12 — «адрес» — выполнен в обоих видах, WEB-12 ищет `127.0.0.1`), что сервер слушает только этот компьютер и отвечает только своей странице, шесть вопросов страницы
проекта (п. 7.1), правило срока (п. 7.2 с краями W4), как включить настоящие запуски (`SAI_TEAM_REAL_RUNS=1`), что делает
Ctrl-C (проекты встают на паузу, продолжение — `npm run team -- resume <id>`). Пример ссылки — без путей этого компьютера.

## 15. Критерий → тест

Тесты — `tools/test/team-web-*.test.js` (TEST-DESIGNER, шаг 5), помощник `tools/test/team-web-helpers.js`: временные
`SAI_TEAM_HOME` и `HOME` (`makeSandbox`/`execEnv`/`assertSafeEnv` из `exec-helpers.js` — помощник REQ-010, критерий 13),
сервер в процессе теста (`createWebServer`, порт 0) или командой (`node src/web/main.js --port 0`), фикстуры — только через
API ядра (`createProject`, `openWriter`), сценарии scripted — как `team-engine-helpers.js`. Ключ страницы тест берёт так же,
как страница: `GET /` и `meta[name="sai-page"]`. Ожидание — по событию журнала, не паузой. Каждый тест отказа сверяет
неизменность: хеш журнала, рекурсивный список путей и хешей `SAI_TEAM_HOME`.

| Критерий | Элемент проекта | Тест (файл, id) | Что упадёт при нарушении |
|---|---|---|---|
| 1. Запуск и адрес | п. 2, 3, 4.1 (1) | `team-web-server.test.js` WEB-1a: команда печатает ровно `Sai Team: http://127.0.0.1:<порт>/`; `server.address().address === "127.0.0.1"` (и подключение к другому адресу машины, если он есть, — отказ соединения); WEB-1b: `Host: example.test:<порт>`, `Host: 127.0.0.1:<другой>` → 403, тело без цели фикстуры | сервер на `0.0.0.0`; нет проверки Host; данные в отказе |
| 2. Список проектов | п. 5.3 `ProjectItem`, 6 | `team-web-list.test.js` WEB-2: три проекта (created; waiting_user через фикстурный журнал; scripted vs claude-cli) — `status_text` = `PROJECT_STATUS_TEXT` (= вывод `npm run team -- project <id>`), `progress` = подсчёт по `replay(events)`, `needs_decision` только у waiting_user, `test_executor_text` только у scripted, нет `%`/«процент» в (п), цель «рынок вырос на 12%» без изменений; `progress_text` = «N из M задач» по подсчёту теста; `created_at` = `ts` события создания; WEB-2b: испорченный проект — `broken: true`, `problem_text`, `link: null`, остальные на месте | неверный подсчёт, флаг у не того проекта, `%` в тексте, изменённая цель |
| 3. Новый проект | п. 8.1, 8.3 | `team-web-create.test.js` WEB-3a: цель 1 и 2000 знаков, потолок 0.5 (scripted-сервер) → 201, событие `PROJECT_CREATED` с той же целью (после `maskSecrets`), `PROJECT_STARTED` в журнале; WEB-3b: пустая, «   », 2001 знак, потолок 0, −1, `"5"`, `null` → 400, список папок до/после равен; WEB-3c: значения цели (пустая, «   », 2001 знак) и потолка (0, −1) через `npm run team -- new` дают отказ там же, где сервер (типы JSON — только у сервера); WEB-3d: сервер `claude-cli` без `SAI_TEAM_REAL_RUNS` → 400, папки нет, счётчик запусков поддельного claude 0; WEB-3e (F-11): потолок `0.0000001` → 400 `field: "budget_usd"`, `0.000001` → 201; отказы цели — `field: "goal"`; WEB-3g (r3, F8; `budget_usd: null` от страницы): POST создания с `budget_usd: null` → 400 `field: "budget_usd"`, папки нет — серверная половина правила; страничная половина (строки «0x10», «1e2», «.5» в поле потолка дают отказ потолка, а «12,5» — проект) — сценарий UAT критерия 11 и чтение REVIEWER-ом: автотеста кода страницы нет (`jsdom` не установлен, п. 0; новая зависимость не заводится); WEB-3f (F-7): `createWebServer` с подставленным `engines`, чей `start` возвращает `{ started: false, error: TeamError("E_WORK_DIR") }`, → 201 `started: false`, `result_text` = «Проект создан, но работа не началась: рабочая папка проекта недоступна», событие создания в журнале есть | создание при неверных данных, нет запуска движка, запуск claude |
| 4. Шесть вопросов | п. 7.1–7.3 | `team-web-project.test.js` WEB-4a…f на фикстурных журналах (события через `openWriter().append` с заданным временем `now`): (1) последние 5 фраз = `phrasesForJournal(events).slice(-5)`, у каждой `at` = `ts` своего события; (2) только роли running/review; (3) одна готовая — «срок пока не оценить», 2/4/9 мин + 5 незавершённых + предел 2 — «примерно через 12 мин», выполненный — `status_text`, произведение 0 — «срок пока не оценить» (W4), чётное число длительностей; (4) failed-задачи с `reason_text` = фразе последнего `TASK_FAILED` этой задачи, и `waiting_text`; (5) ожидание задачи+проекта — 1, закрытое ответом — 0, без вопроса `CHAT` — 0; `note_text` есть только при `count > 0`; у вопроса в чате `open` = `true` ровно пока он считается в `waits`; WEB-4g: `pause_text` у проекта на паузе (после остановки движка сигналом), `tail_text` у журнала с недописанной строкой, `tasks_empty_text` у проекта без плана; `null` у остальных; (6) WEB-4f (r3, F1): фикстура, где есть и файлы с задачей, и файлы без задачи (`openWriter().writeResultFile` с `task: null` и с задачей, или сценарий `engine-basic`, п. 0) — имена `results` = имена `state.files` с `task !== null` в порядке состояния (и как множество = объединение `state.tasks[].files`); ни одного имени файла без задачи в ответе проекта нет; у каждого `ResultRef` `task`, `task_text`, `role` (`n`, `title`), `link` — задачи этого файла; проект только с файлами без задачи даёт `results: []`; (3, r3, F5) медиана меньше нуля (фикстура с `TASK_DONE` раньше `TASK_STARTED` у двух задач) — «срок пока не оценить»; каждое ожидаемое значение тест вычисляет из `replay(events)` сам | неверная медиана/округление, двойной счёт ожидания, лишние роли, файл без задачи в «Результате», «примерно через −N мин» |
| 5. Чат | п. 8.2, 10 | `team-web-chat.test.js` WEB-5a (б): без движка — `CHAT` USER с тем же текстом (после маскирования), виден в `GET …/chat`; WEB-5b (а): движок сервера (scripted с задержками) ведёт проект — ответ 200 «Отправлено», событие пишет движок (`ack`), нет 409, проект доходит до конечного статуса; WEB-5c (а): движок — отдельный процесс `npm run team -- start` (`spawnEngine`) — то же; WEB-5d (в): замок держит писатель ядра без держателя `engine` → 409 с текстом, журнал (хеш) не изменён; WEB-5e: вопрос движка (`CHAT ENGINE question`) есть в чате с `question: true`, `labels_text` содержит «вопрос», а пока открыт — «ждёт ответа»; сообщение о задаче — `task.link` на эту задачу; (r3, F4) сообщение с `truncated: true` в состоянии (фикстура: событие `CHAT` с `data.truncated: true`, записанное через `openWriter().append`, как остальные фикстурные события) — `truncated: true` и последняя метка `labels_text` — «сообщение сокращено»; у обычного сообщения `truncated: false` и этой метки нет; `Sent.message.truncated` — из `event.data.truncated` (через `sentMessage` на событии с `truncated: true` и `false`); WEB-5f: 4001 знак → 400, хеш тот же; WEB-5g: «<script>alert(1)</script>» возвращается тем же текстом; grep `innerHTML…` по `public/` пуст | запись в обход движка, «проект занят» при движке, разметка вместо текста |
| 6. Связи | п. 5.2, 5.3, 7 | `team-web-links.test.js` WEB-6: обход всех `Link.api` из ответов фикстурного проекта (чат→задача, задача→роль и проект, карточка→задачи и проект, результаты→задача) — каждая 200 и того же `id`; карточка: `title`, `description` = `publicRole`, задачи только этой роли и этого проекта; значения `ROLES[*].internal.prompt`/`tools` и коды ролей не встречаются ни в одном ответе | чужие задачи в карточке, утечка промта, битая ссылка |
| 7. Без технических слов | п. 6 | `team-web-words.test.js` WEB-7a: все поля (п) и `error_text` всех ответов (в том числе отказов п. 10) на фикстурах во всех статусах проекта и задачи — без слов списка, кодов статусов/ролей и `%`; WEB-7b: видимый текст `public/*.html` (п. 6.3) — то же; WEB-7c: в `public/*.js` нет кириллицы; WEB-7d: фраза агента «рост на 12% по JSON-выгрузке» отдаётся без изменений | технический текст в подписи или ошибке |
| 8. Живое обновление | п. 9 | `team-web-live.test.js` WEB-8a: `say` через ядро → следующий `GET` содержит сообщение (без перезапуска); WEB-8b: в `public/app.js` строка `const REFRESH_MS = N;`, `N ≤ 5000` (проект задаёт ровно 5000); WEB-8c: все GET-маршруты подряд — рекурсивный список путей и хешей `SAI_TEAM_HOME` до и после равен | кеш, редкий опрос, запись при чтении |
| 9. Защита записи и путей | п. 4, 11 | `team-web-guard.test.js` WEB-9a: POST создания и чата с чужим `Origin`, без `Origin`, без ключа, с неверным ключом, с `text/plain` → 403, журнал и папки не изменены; WEB-9b: `/api/projects/..%2Fx`, `/api/projects/%2Fetc%2Fpasswd`, `/api/projects/../x`, несуществующий `p-20990101-a1b2c3`, задача `..%2Ft-0001`, `t-9999`, роль `0`, `11`, `01` — один и тот же код и тело байт в байт; WEB-9c: секрет-образец из тестов `maskSecrets` в чате → в журнале `[скрыто]`; WEB-9d: grep записи п. 11 пуст; WEB-9e (F-2): у каждого ответа API и каждого отказа (200, 201, 400, 403, 404, 405, 408, 413) `Content-Type: application/json; charset=utf-8` и `X-Content-Type-Options: nosniff`; WEB-9f (F-9): `application/json; charset=UTF-8` и `Application/JSON ;charset=utf-8` принимаются, `application/jsonx`, `application/json-patch+json`, пустое значение, без заголовка — 403; WEB-9g (F-3): POST с ключом правильного вида от другого запуска сервера → 403 `reload: true`, без ключа → 403 `reload: false`, журнал и папки не изменены в обоих | обход защиты, различимый ответ, секрет в журнале |
| 10. Сбои не роняют сервер | п. 10 | `team-web-faults.test.js` WEB-10a: EIO на запись ядра (`withFaults` из `fault-inject.js`) при создании и чате → понятный текст без стека, следующий GET 200; WEB-10b: держатель не движок → текст; WEB-10c: `SAI_TEAM_REAL_RUNS=1` и `SAI_TEAM_CLAUDE_BIN` — несуществующий абсолютный путь во временной папке (после `assertSafeEnv`) → проект создан, движок записал ожидание (ожидание по событию `PROJECT_WAITING`), `GET` проекта даёт `waiting_text` без стека и без технических слов, сервер отвечает дальше; WEB-10d: испорченная строка в середине журнала → текст «Данные проекта повреждены…», список работает; WEB-10e (r3, S-1): `createWebServer` с `bodyIdleMs: 200` — POST создания и POST чата с правильными Host, Origin, `Content-Type` и ключом, `Content-Length: 100`, отправлено 10 байт тела и больше ничего → ответ 408 с `Failure` (`error_text` — общий текст, `field: null`, `reload: false`), `Content-Type: application/json; charset=utf-8`, `Connection: close`; хеш журнала и рекурсивный список путей и хешей `SAI_TEAM_HOME` (с папкой сообщений канала) до и после равны; поддельные `engines.start` и счётчик вызовов не тронуты; тело, дописанное через 300 мс, ничего не меняет; следующий `GET /api/projects` — 200; отдельно — `BODY_IDLE_MS === 15000` в `config.js` и простой меньше `bodyIdleMs` между частями (две части с паузой 100 мс при `bodyIdleMs: 200`) не даёт 408; WEB-10f (r3, F6): экспортированная `chatFailure(ctx, err)` для `TeamError` с каждым кодом строк «чат» п. 10 (в том числе `E_CHANNEL_STALE` → 504 и текст «не подтверждено», `E_USAGE` → 400 `badRequest`, `E_CORRUPT` → 500 `TEXT.corrupt`) даёт статус, `error_text` и `field` этой строки и не вызывает `ctx.warn`; неизвестный код → 500 общий текст и ровно один вызов `ctx.warn` | падение процесса, стек в ответе, соединение, висящее до таймаута Node, код ack в 500 «Что-то пошло не так» |
| 11. Приёмка глазами | — (`REQ-011-ui.md`, шаги 7–8) | не автотест: CODE-DESIGN-VALIDATOR (описание интерфейса), DESIGN-QA-VALIDATOR (снимки 1470 × 784 и 375 × 812 в `docs/design/samples/`, нет горизонтальной прокрутки), BA-ANALYST + UAT-RUNNER (сценарий на сервере `--executor scripted`) — доказательства в их handoff-ах | — |
| 12. Документация и проверка | п. 14, Q4 | `team-web-docs.test.js` WEB-12: в `tools/README.md` раздел `## Sai Team — интерфейс` со строками `npm run team-web`, `127.0.0.1`, шесть вопросов, правило срока; скрипт `team-web` в `package.json`; RELEASE-VALIDATOR: копия без `node_modules`, `npm ci && npm run check` — код 0 | нет раздела или скрипта |
| 13. Решение до кода | `decisions/0024`, `0025` | `team-web-docs.test.js` WEB-13a: `0024` содержит `tools/src/web/`, `127.0.0.1`, `0015`, `REQ-013`; строка в `decisions/README.md` со статусом «Принято» (проверено до WF-02, п. 0) | нет записи |
| 14. Сеть только в сервере | п. 11, 12 | `team-web-docs.test.js` WEB-14: grep-проверки п. 11 по сети (через чтение файлов, как TR-4b); `traces-runtime.test.js` TR-4b/4d/4e с новыми файлами | сеть вне `server.js`/`app.js` |
| 15. Ответы движку через канал | п. 8.2, 3 (`BODY_MAX`) | `team-web-channel.test.js` (движок — отдельный процесс `spawnEngine`, scripted): (а) «Отправлено», ровно одно `CHAT` USER с этим текстом и именем файла сообщения (`msg`), замок тот же (держатель и pid), ack был; (б) SIGSTOP движка → ответ через 10–12 с, текст «не подтверждено», после SIGCONT события с этим текстом нет; (в) тело > 64 КиБ → 413, в папке сообщений канала файла нет (тест смотрит её как данные проекта); (г) SIGKILL движка → сообщение записано сервером ровно один раз, `LOCK_STALE_REMOVED` есть, нового файла в канале нет; (д) приманка-секрет: `grep -r` по папке проекта (с папкой канала) пуст; WEB-15e: `BODY_MAX === MSG_BYTES_MAX`; grep `channel`/`inbox` п. 11 | обход канала, повтор, ожидание дольше 12 с, секрет в файле |

Обратная проверка: у каждого теста WEB-* — критерий в первом столбце.

### 15.1. Мутанты (TEST-DESIGN-VALIDATOR применяет сам)

| Мутант | Кто убивает |
|---|---|
| `listen(port)` без `HOST` | WEB-1a, TR-4d |
| удалить проверку Host | WEB-1b |
| удалить сравнение ключа (или сравнить только длину) | WEB-9a |
| `needs_decision = waits.count > 0` | WEB-2 |
| медиана — среднее арифметическое всех | WEB-4c |
| `Math.floor` вместо `⌈u/p⌉` | WEB-4c |
| вопрос проекта считать всегда (без правила п. 7.3) | WEB-4e |
| в `postChat` вместо `deliver` — `openWriter().say` | WEB-5b, WEB-15 (а) |
| кешировать `readProject` между запросами | WEB-8a |
| 404 на шаблон с другим телом | WEB-9b |
| проверка потолка `> 0` заменена на `>= 0` | WEB-3b |
| отдать `e.message` ядра в `error_text` | WEB-7a, WEB-10a |
| ответ API без `Content-Type` или с `text/plain` | WEB-9e |
| сравнивать `Content-Type` строго целиком | WEB-9f |
| устаревший ключ — тот же отказ, что без ключа (`reload: false`) | WEB-9g |
| проверка потолка без `toFixed(6)` | WEB-3e |
| `open` = `question` (без расчёта п. 7.3) | WEB-4e, WEB-5e |
| (r3) `results` из всех `state.files` (без отбора по задаче) | WEB-4f |
| (r3) `m × k === 0` вместо `≤ 0` | WEB-4c (медиана меньше нуля) |
| (r3) `truncated` всегда `false` или метка «сообщение сокращено» без `truncated` | WEB-5e |
| (r3) убрать отсчёт простоя тела (или не сбрасывать его при новой части тела) | WEB-10e |
| (r3) убрать `E_CHANNEL_STALE` из перевода кодов чата | WEB-10f |

## 16. Планка (`docs/quality-bar.md`)

| # | Применим? | Как выполняется |
|---|---|---|
| Q1 | применим | REQ-011, 15 критериев, у каждого — способ проверки (п. 15) |
| Q2 | применим | проект проверяет CODE-DESIGN-VALIDATOR; код — SECURITY-REVIEWER, REVIEWER, TEST-DESIGN-VALIDATOR, RELEASE-VALIDATOR своими запусками |
| Q3 | применим | факты п. 0 — с выводом; «работает» — только после `npm run check` в отчётах ролей |
| Q4 | применим | `cd tools && npm run check`; новые тесты попадают в `test/**/*.test.js`; новых шагов нет |
| Q5 | применим | п. 15: тест на каждый критерий; тесты отказа сверяют хеш журнала и список путей; тесты независимы (своя временная папка, свой сервер на порту 0) |
| Q6 | применим | ни `skip`, ни отключённых правил; TR-4b/4c/4d/4e расширяются, а не ослабляются; `child_process` в сервер не добавляется (W1) |
| Q7 | применим | секретов нет; ключ страницы — в памяти одного запуска, не пишется и не печатается (W2); текст чата и цель маскирует ядро до записи; `error_text` не содержит путей и pid. Принятый остаточный риск (0025, W2; F-12): любой процесс этого компьютера, в том числе другого пользователя ОС, может открыть `GET /`, получить ключ и читать все проекты — граница доверия, как у Pixel Office |
| Q8 | применим как принцип для проектов (магазинов в Sai Team нет) | путь одного проекта не даёт данных другого (задача и роль ищутся только в его состоянии); несуществующий и чужой путь — один ответ «не найдено» (п. 4.4, WEB-9b) |
| Q9 | неприменим | SQL нет |
| Q10 | применим | п. 10: каждый отказ — понятный текст, сервер работает дальше (WEB-10); ожидание ack ограничено 10 с; простой чтения тела ограничен 15 с, отказ 408 (r3, S-1, WEB-10e); каждый код отказа `deliver` переведён в свой текст, в том числе `E_CHANNEL_STALE` (r3, F6, WEB-10f); ошибка опроса страницы не проглатывается — блок связи (r3, F10); каждый запрос в своём `try`; остаточный риск исключения движка в процессе сервера — W1 |
| Q11 | неприменим | сервер не ходит по адресам, которые задаёт пользователь; страница — только на свой сервер по относительному адресу |
| Q12 | применим | `decisions/0024` (место), `decisions/0025` (W1–W8) — до кода; в r3 дополнены W4 п. 3 (`≤ 0`, F5) и W8 (в «Результат» — только файлы с задачей, F1) |
| Q13 | применим | ошибок процесса в этой работе не найдено; найденное позже — `docs/anti-patterns.md` в той же работе |
| Q14 | применим | handoff обновлён в этой работе; статус требования и `STATE.md` — ORCH/DOC-UPDATER в шаге 10 |
| R1 | применим | мерж — только после подтверждения владельца (RELEASE-FINALIZER останавливается) |
| R2 | применим | все показанное — из журнала воспроизведением; срок — только из времени событий, без выдуманного (при `m × k ≤ 0` — «срок пока не оценить», r3); блок связи не говорит «На связи», если опрос сорвался (r3, F10); страница не рисует движения, которого нет в журнале; события пишут только ядро и движок |
| R3 | неприменим | фото покупателей нет |

## 17. Раунды разработки

1. **BACKEND-DEV, раунд 1** (после PASS шага 1b): `config.js`, `texts.js`, `display.js`, `engines.js`, `api.js`,
   `server.js`, `main.js`; скрипт в `package.json`; раздел README. Свой запуск: `npm run check` и ручной запуск сервера на
   scripted с выводом `curl` по каждому маршруту.
2. **FRONTEND-DEV, раунд 1** — параллельно с п. 1 (файлы не пересекаются), по контракту п. 4.3, 5, 6.3, 12, 13 и
   `REQ-011-ui.md` (r2, ссылается на п. 5.5): `public/`, блок `eslint.config.js`. Свой запуск — на сервере раунда 1, когда
   он готов.
3. **Сведение**: если странице нужно поле, которого нет в п. 5.3 и 5.5, — вопрос через ORCH, новая редакция проекта;
   самовольных полей нет.
4. **Ожидаемый провал между шагами 2 и 5 (F-8).** Как только появятся `tools/src/web/server.js` (с `node:http`) и
   `tools/src/web/public/app.js` (с `fetch(`), тесты `traces-runtime.test.js` **TR-4b** (список сетевых файлов) и
   **TR-4e** (правило `fetch(`) краснеют: эти файлы ещё не внесены в `NETWORK_FILES` и правило TR-4e (проба
   CODE-DESIGN-VALIDATOR на копии: `not ok TR-4b`, `not ok TR-4e`, `# fail 2`). Это названный ожидаемый провал шагов
   2–5 WF-02: разработчики в своём `npm run check` допускают **только** эти два падения и называют их в отчёте; любое
   другое падение — ошибка. Тесты правит TEST-DESIGNER на шаге 5 (п. 1.2); с шага 6 `npm run check` — код 0.
5. **Доработка по r3** (после PASS проекта r3 и описания интерфейса r3; файлы не пересекаются):
   - CODE-FIXER, сервер (`tools/src/web/`, кроме `public/`): `display.js` — `results` только из файлов с задачей,
     `resultRef` без ветки `null`, комментарий о файле без задачи — по п. 7.1 (6); `ChatMessage.truncated` (п. 5.5);
     `dueText` уже `≤ 0` — только комментарий-ссылка на п. 7.2; `api.js` — `E_CHANNEL_STALE` в перевод кодов чата,
     `chatFailure` экспортируется (п. 8.2); `config.js` — `BODY_IDLE_MS`; `server.js` — отсчёт простоя тела, 408,
     `opts.bodyIdleMs` (п. 4.1); `main.js` — ветка шага 5 п. 2 остаётся как есть.
   - CODE-FIXER, страница (`tools/src/web/public/`): порядок запросов опроса (п. 9), `catch` опроса → блок связи (п. 9),
     убрать неиспользуемое поле состояния связи (п. 13), потолок по правилу п. 8.1, вид метки по `truncated` (п. 13),
     комментарий о файле без задачи — ссылка на п. 7.1 (6) этого проекта вместо «решения ORCH для этого прогона».
   - TEST-DESIGNER, шаг 5: тесты п. 15 с пометкой r3 и сужение ST-06 (п. 1.2); затем CODE-FIXER возвращает ссылку в
     README (п. 14).

## 18. Решение (Q12)

`decisions/0025-team-web-server.md` (принято ORCH 2026-10-10 по 0015; в r2 дополнено: W2 — правило `Content-Type`,
отказ устаревшего ключа, принятый остаточный риск; W7 — тексты после перезапуска и до REQ-017): W1 — движок в процессе сервера; W2 — защита
записи и ключ страницы; W3 — исполнитель новых проектов задаёт команда сервера; W4 — край правила срока; W5 — номер роли в
адресах; W6 — файлы страницы в памяти. В r3 дополнено (решения ORCH 2026-10-10 по замечаниям REVIEWER): W4 п. 3 —
«произведение не больше 0» (F5); W8 — в «Результат» идут только файлы с задачей (F1, I2). Строка — в `decisions/README.md`.

## 19. Места использования общих функций (ничего не меняется)

Сервер **только вызывает** `createProject`, `listProjects`, `readProject` (`store.js`), `deliver` (`engine/channel.js`),
`createEngine` (`engine/engine.js`), `projectView`, `projectSummary` (`view.js`), `phrasesForJournal` (`language.js`),
`openQuestions`, `questionAsked` (`engine/answers.js`), `scanFacts` (`engine/facts.js`), `progress`, `replay`
(`reducer.js`), `ROLES`, `publicRole` (`roles.js`), `PROJECT_STATUS_TEXT`, `TASK_STATUS_TEXT`, `FINAL_PROJECT_STATUS`,
`LIMITS`, `PATTERNS` (`schema.js`), `PARALLEL_DEFAULT` (`engine/schedule.js`), `readConfig` (`config.js`), `resolveHome`
(`home.js`), `parseScenario` (`executors/scripted.js`), `formatError`, `TeamError` (`errors.js`). Ни сигнатура, ни формат
файлов не меняются — у других пользователей этих функций ничего не меняется.

## 20. Открытые вопросы

Вопросы r0 закрыты решением ORCH в `decisions/0025` (вводный абзац) и в проекте больше не открыты:

- кнопок «пауза / продолжить / остановить» в REQ-011 нет — отдельное требование REQ-035; до него остановленный проект
  продолжается командой `npm run team -- resume <id>`, страница показывает `pause_text` (п. 5.5, 8.4);
- признак `needs_decision` в списке следует статусу проекта, как в критерии 2 (п. 5.5);
- после перезапуска сервера проекты сами не возобновляются (п. 8.4).

Открытые вопросы r3 (не решены догадкой; на этот проект не влияют — ведут к другим требованиям):

- входные файлы **задач** (`t-NNNN-<попытка>-input.md`, вход исполнителя у задачи) остаются в «Результате», потому что у
  них есть задача; различать вход и итог задачи по имени или `kind` страница и сервер не должны — нужно правило в ядре
  (вид файла), это REQ-015 или новое требование (вопрос I2 REVIEWER в остальной части);
- фраза модуля «язык» «Готов новый файл с результатом» в «Что происходит» выходит и для файла без задачи, которого в
  «Результате» нет; фразы — ядро REQ-009, проект их не меняет;
- логика страницы (опрос, потолок, вид метки) автотестом не проверяется — `jsdom` нет, новая зависимость требует записи
  решения; сейчас — сценарии UAT и чтение REVIEWER-ом.

Для учёта (вне этого файла): в `decisions/README.md` строка 0025 — «Предложено», а в самой
записи — «принято»; сверить — ORCH или DOC-UPDATER (Q12, Q14).
