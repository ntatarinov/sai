# ISS-0033 — Мелкие недочёты кода handoffs-check

Серьёзность: LOW. Статус: open. Найдено: REVIEWER (`handoffs/REQ038-20261011-01/step-04-reviewer.json`), SECURITY-REVIEWER (`step-03-security-reviewer.json` и `step-03-security-reviewer-r1.json`, F2 и F3), TEST-DESIGN-VALIDATOR (`step-05b-test-design-validator-r1.json`), RELEASE-VALIDATOR (`step-09-release-validator.json`). Пункт планки: Q10 (пределы входа), Q3 (лишнее). Требования: REQ-038.

## Что не так

1. Четыре лишних `export`: `BASE_REL`, `EMIT_REASON`, `readDecisionCommit` (`tools/src/handoffs/exceptions.js`) и `REQUIRED_FIELDS` (`rules.js`) используются только внутри файла (REVIEWER).
2. Каждый handoff читается дважды (`readHandoff` и `readText` из traces) ради правила H10 (REVIEWER; на 626 файлах 0,7 с, не мешает).
3. Порции `readBlobs` делятся по 1000 спеков, а не по размеру ответа: при очень больших blob-ах суммарный ответ может превысить предел, тогда команда безопасно отказывает (код 2; предел 256 МиБ).
4. Комментарий в `git-history.js` обещает тест, который сравнивает тексты ошибок с `traces/git-files.js`; такого теста нет (REVIEWER; HC-RT-1 проверяет другое).
5. У `COMPLETED`/`FAILED` с `completed_at: null` одно поле считается нарушением и по H4, и по H5 (двойной подсчёт; решение проекта, на текущих данных не встречается; RELEASE-VALIDATOR, остаточный риск 1).
6. У ключей JSON вне грамматики путь поля печатается как «?» (SECURITY-REVIEWER, F2, Low).
7. Файл базы и файлы `decisions/` читаются без предела размера и без проверки ссылки (`exceptions.js`, `readBase`, `readDecisionCommit`; SECURITY-REVIEWER, F3, Low).

## Как исправить

WF-03 с шага 1 (или одним проходом CODE-FIXER): убрать лишние `export`; читать handoff один раз; делить порции `readBlobs` по размеру; убрать комментарий или написать обещанный тест; считать одно поле одним нарушением; для ключей вне грамматики печатать понятный признак; ограничить размер файла базы и `decisions/` как `MAX_FILE_BYTES` в traces.

## Доказательство

`handoffs/REQ038-20261011-01/step-04-reviewer.json` (замечания Low), `step-03-security-reviewer-r1.json` (F2, F3 остаются Low), `step-09-release-validator.json` (остаточные риски).
