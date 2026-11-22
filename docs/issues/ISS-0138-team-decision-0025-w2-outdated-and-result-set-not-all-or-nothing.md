# ISS-0138 — Team engine: decision 0025 W2 still says that any local process can read the page key (the code now needs a cookie or a link), and a result set of several files is not all or nothing (decision 0105 item 7) while nothing tests a failure on the second file

Серьёзность: MEDIUM. Статус: open. Найдено: AUD-002, ARCHITECTURE-AUDITOR (team), 2026-11-22 (находки ARCH-TEAM-01, ARCH-TEAM-02 (Medium); ARCH-TEAM-03 … ARCH-TEAM-07 (Low)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: Q12 (decisions and code agree), Q10.
Требования: REQ-011 (the page), REQ-013 (the engine); decisions 0025, 0105.

## Что не так

- ARCH-TEAM-01: decision 0025 W2 names as an accepted risk that any local process can read the page key. The code (ISS-0122, commit 8d8b59b) now needs an access cookie or the `?k=` link for the page and every read. No decision amends W2, the REQ-011 design does not describe it, and the header comment of tools/src/web/server.js (lines 1-4) is wrong.
- ARCH-TEAM-02: nothing tests a disk failure or a name clash on the second or later file of a result set; the earlier files stay by decision 0105 item 7. Every E_DISK test uses a single-file plan. Whether a result set must be all or nothing is a question for the owner or ORCH.
- Low: the scripted executor reports `spawned: true` for a run cancelled before it started (ARCH-TEAM-03); two import cycles (04); copied helpers (05); 32 exported names with no user (06); `createEngine` 944 lines, `runTask` 586 lines, `createWebServer` 374 lines (07).

## Доказательство

docs/audits/AUD-002/team/architecture.json (ARCH-TEAM-01 … 07).

## Как исправить

1. A new decision that amends 0025 W2 with the ISS-0122 behaviour, the header comment and the REQ-011 design section updated (DOC-UPDATER); a test for a failure on the second file of a plan that proves the stated behaviour of 0105 item 7 (the first file stays, the journal says what happened), and the question «all or nothing?» goes to the owner in the report; the Low items go into one refactor pass in a later iteration (the engine lock of PLAN 4.1 for tools/src/team applies).

## Маршрут

DOC-UPDATER (the decision and the design text) and WF-03 for the test; the engine refactor waits for the R1.5 work on tools/src/team.
