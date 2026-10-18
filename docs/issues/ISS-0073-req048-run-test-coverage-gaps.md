# ISS-0073 — Pixel Office: пробелы покрытия тестами после прогона REQ-048 — проверка `mainChoiceOpens` в `openMain`, помощник CSS без специфичности и `!important`, правила F6/F7/`overscroll-behavior`, `nowrap` у предка в DQ-04

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGN-VALIDATOR (прогон `REQ048-20261015-01`, шаг 5b, повтор r2 — F-L1, F-L2, F-L3; повтор r3 — F-L1); ORCH принял их как Low без доработки (`orch_check` ворот r3: «в учёт дефектов Low на шаге 10»); заведено DOC-UPDATER (шаг 10), 2026-10-16. Пункты планки: Q5, Q6. Требования: REQ-047 (критерии 3, 4), REQ-049 (критерий 1), REQ-048 (критерий 4).

## Что не так

Все критерии прогона закрыты тестами, но ворота тестов нашли четыре места, где поломку не поймает ни один тест (вид в этих местах проверили DESIGN-QA и приёмка в браузере, это не нарушение критериев):

1. **Проверка `mainChoiceOpens` внутри `openMain` недостижима тестами** (r2, F-L1). В `tools/src/pixel-office/public/app.js`, `openMain`, стоит `if (!mainChoiceOpens(model, choice)) return;`. Мутант R3 (только проверка на `null` вместо `mainChoiceOpens`) не ловится: пути к этой проверке со страницы нет — выбор всегда строится из текущей модели, а у переходов журнала правило уже применено в `linksOf` (его ловит DQ-01).
2. **Помощник CSS не учитывает специфичность и `!important`** (r2, F-L2). `cssCascade` и `cssValue` (`tools/test/pixel-office-helpers.js`) считают только порядок правил с тем же селектором; специфичность разных селекторов, именованные цвета в `border` и `!important` не учитываются. Для проверок DQ-03 и DQ-04 этого хватает (мутанты помощника R8, R9 ловятся), но в других случаях помощник может ошибиться.
3. **Правила F6, F7 и `overscroll-behavior` без тестов** (r2, F-L3). Правки CODE-FIXER 07a — `left`/`right: anchor(--now …)` и `anchor-name` у `.top` и `.now` (F6), `.now-text { flex: 1 1 0 }` в узком окне (F7), `overscroll-behavior: contain` у `#now-all` — тестами не закреплены; F2 закреплён частично (пара `max-height` в DQ-03, N3).
4. **`white-space: nowrap` у предка не ловится DQ-04** (r3, F-L1). DQ-04 смотрит правила самих `.legend-item`, `.card-link`, `.instance-id` и их частей; мутанты T5 (`.instance-head { white-space: nowrap }`) и T6 (`.legend-entry { white-space: nowrap }`) — 0 красных из 398, хотя при `nowrap` у родителя `overflow-wrap: anywhere` у потомка перенос не даёт.

Тот же род, что ISS-0066 (границы теста правил CSS `PN-23`).

## Доказательство

`handoffs/REQ048-20261015-01/step-05b-test-design-validator-r2.json` (findings F-L1, F-L2, F-L3), `step-05b-test-design-validator-r3.json` (findings F-L1 и `orch_check`). Проверить: `grep -n "mainChoiceOpens" tools/src/pixel-office/public/app.js`; `grep -n "export function cssCascade\|export function cssValue" tools/test/pixel-office-helpers.js`; тест DQ-04 в `tools/test/pixel-office-page.test.js` (отбор правил `touches`).

## Как исправить

WF-03 с шага 1, когда будут править эти места (по желанию раньше). Предложения ворот: (1) вынести проверку в одно место (например, выход при `null` от `buildMainCard`) или проверить `openMain` через отсоединённую кнопку после замены журнала — решает ORCH/REVIEWER; (2) записать ограничение помощника в его комментарии или научить его специфичности и `!important`; (3) добавить строки в DQ-03 тем же помощником (F6, F7, `overscroll-behavior`) или оставить проверку вида DESIGN-QA — решает ORCH; (4) добавить в DQ-04 запрет `white-space: nowrap` у предков по разметке `app.js` — `.legend-entry`, `.legend` (`#legend`), `.instance-head`, `.instance`, `.card-launcher`, `.card-body`, `.card` — вне и внутри `@media`. Проверки только добавляются (Q6); мутанты R3, T5, T6 должны стать красными.

## Маршрут

TEST-DESIGNER (новые проверки; для п. 1 — сначала решение ORCH, нужна ли правка кода) → TEST-DESIGN-VALIDATOR → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER → RELEASE-FINALIZER.

## Обновление 2026-10-18 (DOC-UPDATER, прогон `REQ050-20261017-01`, шаг 10)

Дефект остаётся `open`: четыре пункта выше этот прогон не трогал. ORCH направил в этот дефект два новых Low-замечания ворот тестов прогона гайда (`handoffs/REQ050-20261017-01/step-05b-test-design-validator-r2.json`, F-L1 и F-L2; `orch_check`: «в учёт Low (ISS-0073) на шаге 10»), но оба **закрыты в том же прогоне** доработкой тестов r3 и подтверждены воротами r3 — открытыми пунктами сюда не добавляются:

- **F-L1 (r2) — закрыт.** GR-06 проверял описание роли в карточке только у роли с описанием из одной фразы (SECURITY-REVIEWER), поэтому мутант «в карточке только первая фраза» не ловился. Доработка r3 (`step-05-test-designer-r3.json`) добавила карточку «Sai Orchestrator (ORCH)» с описанием из двух фраз и сверку описания целиком (= `GUIDE_ROLE_ABOUT.ORCH`).
- **F-L2 (r2) — закрыт.** TU-07 сверял высоту «×» тура с правилом `#pause`, которого в `style.css` нет (`?? "2.25rem"` — проверка не могла упасть). Доработка r3 заменила её сравнением с правилом `.ctl` (класс кнопки «Пауза»): в узком окне высота `.ctl` 2,25 rem, и высота «×» тура и строки о туре равна ей.
- Ворота `step-05b-test-design-validator-r3.json`: «замечания F-L1 и F-L2 ворот r2 закрыты. Замечаний нет»; 7 из 7 своих мутантов пойманы.
