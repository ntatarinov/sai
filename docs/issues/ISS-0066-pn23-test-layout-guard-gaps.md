# ISS-0066 — Тест PN-23 (раскладка шапки строки) не видит правил в @supports, @layer, @container и части раскладочных свойств

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGN-VALIDATOR (прогон `ISS-0062-20261013-01`, шаг 7, находки F1–F4); подтверждено RELEASE-VALIDATOR (шаг 9, F2, принял без изменения), заведено DOC-UPDATER (шаг 10), 2026-10-13. Пункты планки: Q5, Q6. Требования: REQ-042 (критерий 14, способ проверки 1 — тест PN-23).

## Что не так

Регрессионный тест `PN-23` (два `test()` в `tools/test/pixel-office-panels.test.js`) читает `tools/src/pixel-office/public/style.css` помощником `parseCss` (`tools/test/pixel-office-helpers.js`) и проверяет, что у `.item-head` стоит `flex-wrap: wrap`, у `.item-state` — `max-width: 100%`, и что никакое правило не возвращает перенос по буквам или запрет переноса. Он красный на `style.css` метки `base/ISS-0062-20261013-01` и зелёный на исправленном; обязательные мутанты и ещё девять падают. Но у способа проверки есть границы, найденные TEST-DESIGN-VALIDATOR своими мутантами на копии вне проекта (все они проходят `PN-23` зелёным):

1. **F1.** `parseCss` обходит только `@media`; правила внутри `@supports`, `@layer`, `@container` тест не видит (мутант P1: `@supports (display: flex) { .item-head { flex-wrap: nowrap } }`).
2. **F2.** Перечень раскладочных свойств `LAYOUT_PROPS` совпадает с перечнем критерия 14 плюс несколько лишних, но не содержит `inline-size`, `min-inline-size`, `max-inline-size`, `text-wrap-mode`, `white-space-collapse`, `flex-direction`, `order` (мутанты P2: `.item-state { min-inline-size: 20rem }` и P4: `.item-state { text-wrap-mode: nowrap }`).
3. **F3.** Правил самого `.item-role` тест не смотрит (мутант P5: `.item-role { flex: none; white-space: nowrap }` выпускает длинную роль за строку, критерий 14 (г), и проходит `PN-23`). Проект такого ограничения не ставил; такой случай ловит замер приёмки (длинная роль в 60 знаков без пробелов).
4. **F4.** Сравнение `flex-wrap` строгое: безвредное по смыслу `flex-wrap: wrap !important` краснит тест (мутант P3) — ложное срабатывание, безопасная сторона.

Сегодня в `style.css` нет ни блоков `@supports`, `@layer`, `@container`, ни перечисленных правил — критерий 14 не нарушен (RELEASE-VALIDATOR: «это дыры теста, но не нарушение критерия»). Риск — будущая правка CSS, которая вернёт дефект ISS-0062 в обход теста.

## Доказательство

`handoffs/ISS-0062-20261013-01/step-07-test-design-validator.json` (F1–F4 с мутантами P1–P5), `step-09-release-validator.json` (F2, I1 п. 2). Проверить: `grep -n "LAYOUT_PROPS" tools/test/pixel-office-panels.test.js`; `grep -n "function parseCss" tools/test/pixel-office-helpers.js`.

## Как исправить

WF-03 с шага 1 (по желанию, когда будут править `PN-23` или `style.css`). Предложения TEST-DESIGN-VALIDATOR: (а) добавить в `PN-23` проверку, что в `style.css` нет других at-правил с блоками, кроме `@media` (assert на список голов), либо научить `parseCss` обходить `@supports` и `@layer`; (б) добавить в `LAYOUT_PROPS` `min-inline-size`, `max-inline-size`, `inline-size`, `text-wrap-mode`, `white-space-collapse`, `flex-direction`; (в) F3 и F4 исправлений не требуют. Проверку не ослаблять (Q6): новые проверки только добавляются; мутанты P1, P2, P4 должны стать красными.

## Маршрут

TEST-DESIGNER (проект проверок) → TEST-DESIGN-VALIDATOR → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER → RELEASE-FINALIZER. Код страницы не меняется.
