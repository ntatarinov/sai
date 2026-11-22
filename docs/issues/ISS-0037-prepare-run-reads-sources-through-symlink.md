# ISS-0037 — prepare-run читает источники по символической ссылке и копирует внешний файл в sources

Серьёзность: LOW. Статус: closed, 2026-11-22, проверено перепроверкой `M1RECHECK-20261122-01` (шаги WF-03 исправление не проходило). Найдено: SECURITY-REVIEWER (`handoffs/ISS-0002-20261011-01/step-05-security-reviewer-security.json`, F1) и REVIEWER (`handoffs/ISS-0002-20261011-01/step-05-reviewer.json`, R1). Пункты планки: Q10, Q11. Требования: REQ-002 (команда `prepare-run`).

## Что не так

`prepare-run` читает `ideas/<id>.md` и файл из `--context` через `readTextFile` (`tools/src/util.js`, проверка размера идёт через `statSync`, то есть по ссылке; места в `tools/src/prepare.js` — чтение источников). Если такой путь — символическая ссылка на файл вне проекта, текст внешнего файла копируется в `runs/<RUN-ID>/sources/` и дальше попадает в очищенные копии и в вердикт. Запись за пределы корня при этом не происходит, а ссылку кладёт сам владелец в свой проект. Решение `decisions/0004` принимает чтение по ссылке только для папки прогона; источники в нём не названы, а решение `decisions/0042` говорит, что для этого случая нужен отдельный дефект.

## Доказательство

Проба SECURITY-REVIEWER: ссылка `ideas/01-kviz-zayavki.md` на внешний файл — `prepare-run` вышел с кодом 0, текст внешнего файла найден в `sources/`. REVIEWER повторил пробу тем же результатом (ссылка на внешний файл, код 0, текст скопирован).

## Как исправить

WF-03 с шага 1: отказывать на ссылке в источниках через `lstat` с кодом `E_SOURCE_PATH` и тестом (внешняя ссылка, ссылка внутри проекта, битая ссылка); либо одной строкой записать в `decisions/0004`, что чтение источников по ссылке принято. Предпочтение REVIEWER — отказ, потому что содержимое источников попадает в копии и в вердикт. К фазе записи ISS-0002 не относится.

## Закрыто

Closed 2026-11-22T07:48:21Z (time from the clock), run `M1RECHECK-20261122-01` (WF-02 step 10, DOC-UPDATER, after the RELEASE-VALIDATOR PASS of `handoffs/M1RECHECK-20261122-01/step-09-release-validator.json`, ORCH accepted it). The cause is removed: the same cause as ISS-0120 and the same fix, commit d22ceec (2026-11-18, an ancestor of e0a425b; `decisions/0121`: ISS-0120 closes ISS-0037): `leadsOutside()` with `realpath` in `tools/src/prepare.js`, tests in `tools/test/prepare.test.js` (outside link refused, inner link kept, dangling link). The choice between `lstat` with `E_SOURCE_PATH` and the real-path rule was made in that fix: a link that stays inside the project is read, one that leaves it is refused. The fix did not pass the WF-03 steps (it was made in a separate session and went to `main` on the owner's word, `decisions/0122` О2 and О3, row of 2026-11-19T08:30:00Z of `docs/program/public-v1/PROGRESS.md`); the re-check of this run read the code of `e0a425b` and the CI record, it did not run the tests on this Windows PC. check.yml run 44919421116 on `e0a425b` is green (tools tests 2226 of 2226). Not read by the re-check: the decision records and requirement amendments that the section «Как исправить» names as steps before the design (the RELEASE-VALIDATOR of this run did not look for them); if one is missing, it is a new defect, not a reason to reopen this one.
