# ISS-0056 — Комментарий в начале git-history.js говорит «five calls», а вызовов git шесть

Серьёзность: LOW. Статус: open. Найдено: CODE-DESIGN-VALIDATOR (`step-03b-code-design-validator-r1.json`, V4), прогон `ISS-0053-20261013-01`, 2026-10-13; SECURITY-REVIEWER (I4), RELEASE-VALIDATOR (F2). Пункт планки: Q12 (код не расходится с записанным решением молча). Требования: REQ-038.

## Что не так

Заголовочный комментарий `tools/src/handoffs/git-history.js` (строки 1–5) говорит: «five calls with fixed arguments». Вызовов `execFileSync` в файле шесть: шестой (`tagExists`, поиск метки `base/<RUN-ID>`) добавлен прогоном REQ-039 по решению `0040`, а проект REQ-038, п. 7, уже говорит «шесть». Комментарий отстал от кода и от проекта. Поведение не затронуто.

Расхождение было до работы над ISS-0053 и в её границы (решение `0047`) не входит.

## Доказательство

`grep -c 'execFileSync(' tools/src/handoffs/git-history.js` → 6 (`step-09-release-validator.json`, F2); `sed -n 2p tools/src/handoffs/git-history.js` → «…five calls with fixed arguments…»; `docs/design/REQ-038-handoffs-check.md`, п. 7 — «шесть».

## Как исправить

Заменить «five calls» на «six calls» в комментарии (одно слово). Тест `HC-RT-1b` запрещает в тексте файла слова `shell`, `exec(`, `execSync`, `spawn`, `fork`, `execFile(`, `require(`: поправка их не вносит. Можно делать вместе с ISS-0054 (тот же файл) одним прогоном WF-03.

## Маршрут

ISSUE-FIXER → CODE-FIXER → SECURITY-REVIEWER → REVIEWER → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER → RELEASE-FINALIZER (малая правка комментария; тест не нужен — поведение не меняется, ворота тестов решает ORCH).
