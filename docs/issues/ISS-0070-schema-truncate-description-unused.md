# ISS-0070 — Pixel Office: `truncateDescription` в `schema.js` больше не вызывается кодом, его держит только тест PG-22

Серьёзность: LOW. Статус: open. Найдено: REVIEWER (прогон `REQ044-20261014-01`, шаг 4, повтор, N2, I2); заведено DOC-UPDATER (шаг 10), 2026-10-14. Пункт планки: Q6 (тест держит мёртвый код). Требования: REQ-001.

## Что не так

После шага 5c протокол записи перешёл на `prepareText` и `maskField` (`tools/src/pixel-office/protocol.js`); функция `truncateDescription` (`tools/src/pixel-office/public/schema.js`, строка 169) больше нигде в коде не вызывается. Её импортирует и проверяет только тест `PG-22` (`tools/test/pixel-office-page.test.js`). Это мёртвый экспорт схемы, который тест делает похожим на рабочий.

## Доказательство

`handoffs/REQ044-20261014-01/step-04-reviewer-r1.json` (N2), `step-09-release-validator.json` (F3). Проверить: `grep -rn "truncateDescription" tools/src tools/test` — определение в `schema.js` и использования только в `pixel-office-page.test.js`.

## Как исправить

Решение ORCH (вопрос REVIEWER I2): удалить функцию вместе с заменой проверки `PG-22` (TEST-DESIGNER, без ослабления: пределы и отказы, которые проверял `PG-22`, проверяются там, где они теперь живут) или оставить как утилиту схемы с пометкой.

## Маршрут

Решение ORCH → (если удалять) CODE-FIXER → REVIEWER → TEST-DESIGNER → TEST-DESIGN-VALIDATOR → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER → RELEASE-FINALIZER.
