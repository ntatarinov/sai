# ISS-0114 — The team page has no favicon: `/favicon.ico` answers 404 and every browser start prints a console line that the spec has to declare

Серьёзность: LOW. Статус: open. Найдено: CODE-DESIGNER (шаг 01, факт F31 проекта), прогон `E2E107-20261116-01`, 2026-11-16; решение ORCH `decisions/0113`, О10; заведено DOC-UPDATER (шаг 10), 2026-11-16T23:26:53Z. Пункт планки: Q10 (страница не печатает ошибок, которые человек не может понять), Q5 (тест не прячет поведение продукта). Требования: REQ-011 (страница команды, `tools/src/web/`), REQ-107 (сделано; спецификация объявляет эту строку). Решение: `decisions/0113`, О10 (у страницы нет значка — это факт продукта, не теста; починка — изменение `tools/src/web/`, вне прогона).

## Что не так

The page of the virtual team (`tools/src/web/public/`) has no icon: the folder holds `app.js`, `index.html` and `style.css` only, and `index.html` has no `<link rel="icon">` (its `<head>` links `style.css` only). So the browser asks for `/favicon.ico` by itself, the server answers 404 (a one-part path that is not one of its public files goes to `notFoundReply`, `tools/src/web/server.js`, lines 448–455), and Chrome writes one console line per start: «Failed to load resource: the server responded with a status of 404 (Not Found)» with the path `/favicon.ico` (design `docs/design/REQ-107-e2e-team-web.md`, F31: one line per browser start; with two tabs one line in each of the measured runs).

The spec `tools/test/e2e/team-web.e2e.js` declares that line exactly, with its path (the constant `FAVICON`): once per start in the one-tab tests (`expectOncePerStart`) and «at least one» in `control`, which opens two tabs (`expect`); no other line is allowed (`decisions/0113`, О10, as `decisions/0112` О3 did for Pixel Office). The test is right; the page makes a console line on every visit, and a person who opens the browser console sees an error that is not one.

Why LOW: nothing breaks and nothing of the page is wrong; it is a red line in the console and a missing icon on the tab, and every spec of this page has to carry the declaration.

## Доказательство

- `docs/design/REQ-107-e2e-team-web.md` — F31 (the probes and the prototype), C-10; `decisions/0113`, О10.
- Read as text at step 10: `ls tools/src/web/public/` → `app.js`, `index.html`, `style.css`; `grep -rn "favicon\|rel=\"icon\"" tools/src/web/` → no line.
- `tools/test/e2e/team-web.e2e.js`, lines 103–110 (`FAVICON`) and its eight declarations (lines 580, 612, 694, 776, 1012, 1159, 1247, 1323).
- By the kit's contract (REQ-104, criterion 6; `docs/design/REQ-104-e2e-chrome-kit.md`, 4.6, `verifyConsole`), a console line that no declaration claims fails `withBrowser` with `CONSOLE_ENTRIES`; this is why the spec must declare the line. Not repeated at step 10 (no browser was started by this step).

## Как исправить

A WF-03 run of FRONTEND-DEV (the page) with the usual gates: a small icon in `tools/src/web/public/` served by the server, or an inline icon in `index.html` (`<link rel="icon" href="data:,">` makes the browser ask for nothing), so that `/favicon.ico` is no longer requested or no longer answers 404. In the same run TEST-DESIGNER removes the `FAVICON` declarations of `team-web.e2e.js` (then any such line is red by the kit's own console check) and adds a test that the page asks for no missing icon. The server's 404 for an unknown path stays as it is. A declaration kept after the fix, or a weaker console check, is not a fix (Q6).

## Маршрут

WF-03 for FRONTEND-DEV (page) and TEST-DESIGNER (spec), with SECURITY-REVIEWER and REVIEWER, then TEST-DESIGN-VALIDATOR; small, not urgent; on ORCH's order. Can go together with ISS-0115 (the same page).
