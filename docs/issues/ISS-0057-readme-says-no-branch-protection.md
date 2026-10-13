# ISS-0057 — Раздел README «Проверка на GitHub и перед отправкой» говорит «защиты ветки нет», а защита main включена

Серьёзность: MEDIUM. Статус: open. Найдено: DOC-UPDATER (прогон `REQ030-20261012-01`, шаг 13, `result.issues` I1), 2026-10-13. Пункты планки: Q3, Q14. Требования: REQ-030 (критерий 5).

## Что не так

Раздел `README.md` «Проверка на GitHub и перед отправкой» содержит слова «защиты ветки нет». Это неверно: владелец открыл репозиторий намеренно, и 2026-10-13 ORCH включил защиту `main` на GitHub (обязательна проверка `check`, force-push и удаление ветки запрещены, `enforce_admins` = false) — `decisions/0048`, поправка внутри `decisions/0023`.

Слова закреплены критерием 5 REQ-030 (`docs/requirements.yaml`) и тестами `RD-2` (точные слова раздела) и `RD-4` (запрещены «защита включена», «обязательная проверка», «приватн», «публичн», «403») в `tools/test/repo.test.js`. Поэтому в шаге 13 раздел не правили: правка сделала бы тесты красными.

README публичный, и пока раздел не исправлен, он вводит в заблуждение любого, кто его читает: он говорит, что защиты нет, а она есть. Урок — AP-079.

## Доказательство

`handoffs/REQ030-20261012-01/step-13-doc-updater.json` (`result.issues`, I1, I4); `decisions/0048-owner-delegates-open-points-repo-public.md`; `grep -n 'защиты ветки нет' README.md docs/requirements.yaml tools/test/repo.test.js`.

## Как исправить

Отдельная работа по WF-03, по порядку: ISSUE-FIXER (диагноз) → поправка критерия 5 REQ-030 (WF-01: критерий не закрепляет слова о состоянии защиты, а проверяет ссылку на решение `0048` и отсутствие противоречия ему) → проект → код и текст раздела README → тесты `RD-2` и `RD-4` по новым словам (красные до правки, зелёные после) → RELEASE-VALIDATOR → DOC-UPDATER. Что делать со статусом REQ-030 при поправке критерия, решает ORCH по WF-01.

## Маршрут

ISSUE-FIXER → REQ-ANALYST/REQ-VALIDATOR (поправка критерия 5) → CODE-DESIGNER → CODE-DESIGN-VALIDATOR → CODE-FIXER → TEST-DESIGNER → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER → RELEASE-FINALIZER.
