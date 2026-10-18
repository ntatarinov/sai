# ISS-0075 — Тест EN-62 (`team-channel.test.js`) нестабилен под нагрузкой полного прогона: гонка `readdir`/`lstat` во вспомогательной функции `inboxNames`

Серьёзность: LOW. Статус: open. Найдено: TEST-RUNNER (прогон `REQ050-20261017-01`, шаг 6, F1, I1); повторы r1–r3 зелёные, нестабильность ими не снята; ORCH назначил дефект в `orch_check` шага 6; заведено DOC-UPDATER (шаг 10), 2026-10-18. Пункты планки: Q4, Q5 (тесты не зависят друг от друга и от нагрузки). Требования: каналы команд Sai Team (тест EN-62). Работа прогона `REQ050-20261017-01` тест не задела.

## Что не так

Полный прогон `cd tools && caffeinate -i npm run check` на шаге 6 закончился с кодом 1: из 1615 тестов упал один — EN-62 «inbox/ as a link or with mode 0755: the sender refuses E_CHANNEL and writes nothing; a planted ack that is not trusted is neither taken nor removed» (`tools/test/team-channel.test.js:984`). Ошибка — `ENOENT: no such file or directory, lstat '<вне проекта>/sai-exec-test-…/team/p-…/inbox/.tmp-…'` в `walk` вспомогательной функции теста `inboxNames` (`tools/test/team-channel.test.js:81`), вызванной из `:1028` через `waitUntil` (`tools/test/exec-helpers.js:584`).

Механизм (по отчёту TEST-RUNNER): `inboxNames` читает список файлов `inbox/` (`readdirSync`), затем для каждого делает `lstatSync`. Отправитель пишет сообщение во временный файл `inbox/.tmp-…` и переименовывает его; если переименование случается между `readdir` и `lstat`, `lstat` бросает `ENOENT`, и тест падает, хотя код канала ведёт себя верно. Отдельно тест проходит: 6 из 6 запусков EN-62 и весь `team-channel.test.js` — 31 из 31; падает под нагрузкой полного прогона. Повторы шага 6 (r1, r2, r3 — 1615, 1621, 1622 теста) и запуск RELEASE-VALIDATOR (1622) были зелёными.

## Доказательство

`handoffs/REQ050-20261017-01/step-06-test-runner.json` (F1 — вывод падения и свидетельство «работа не задела тест»: ни файл теста, ни 36 файлов его импортов не пересекаются с файлами работы; I1), `step-06-test-runner-r1.json`, `-r2.json`, `-r3.json` (I1: «нестабильность не снята»). Проверить: `sed -n 70,90p tools/test/team-channel.test.js` (функция `inboxNames`); повторять полный `npm run check` до падения EN-62.

## Как исправить

WF-03 с шага 1 (ISSUE-FIXER подтверждает причину). Вероятное исправление — в самом тесте, без изменения кода канала: `inboxNames` пропускает имя, исчезнувшее между `readdir` и `lstat` (ловит `ENOENT` у `lstatSync` и идёт дальше), или использует `readdirSync(dir, { withFileTypes: true })`. Проверку не ослаблять (Q6): тест по-прежнему ждёт файл сообщения и проверяет, что отправитель отказал и ничего не записал. Регрессионно — запустить EN-62 многократно под нагрузкой (например, параллельно с полным прогоном).

## Маршрут

ISSUE-FIXER → TEST-DESIGNER (правка вспомогательной функции) → TEST-DESIGN-VALIDATOR → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER → RELEASE-FINALIZER.
