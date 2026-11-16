# ISS-0115 — The team page, a data folder that cannot be made: the create refusal «Что-то пошло не так. Повторите позже» names no cause and advises a repeat that will not help, and the list stays «Загрузка…»

Серьёзность: LOW. Статус: open. Найдено: CODE-DESIGNER (шаг 01, факт F27 проекта), прогон `E2E107-20261116-01`, 2026-11-16; решение ORCH `decisions/0113`, О11 (и О14); заведено DOC-UPDATER (шаг 10), 2026-11-16T23:27:36Z. Пункт планки: Q10 (при реальном сбое человек видит понятное сообщение, процесс не падает). Требования: REQ-011 (страница команды, `tools/src/web/`); REQ-107 (сделано; критерий 6 выполнен этой фразой — она простая, без следа стека и запретных меток). Решение: `decisions/0113`, О11 (слова записаны, не изменены: более точная фраза — изменение страницы, вне прогона).

## Что не так

When the data folder of Sai Team cannot be made — the spec's case is `SAI_TEAM_HOME` under a regular file, `<root>/f/home`, so that even the superuser cannot make it — the page opens (200) and the process stays alive, but what the person sees does not help (design `docs/design/REQ-107-e2e-team-web.md`, F27, measured at step 01 and read again by the spec at every run):

1. pressing the create button shows «Что-то пошло не так. Повторите позже» in the create result (tone `err`), and the error bar says the same;
2. the list of projects stays at «Загрузка…» with no row, because every request of `/api/projects` answers 500;
3. the server knows the cause and writes it only to its own stderr: `Sai Team: E_HOME: Папка данных Sai Team недоступна: ENOTDIR` (`tools/src/team/home.js`, `homeError`; `tools/src/web/api.js`, `internal()` gives the page the general text `TEXT.internal` of `tools/src/web/texts.js`, line 98, with the answer 500).

The words name no cause and advise a repeat («Повторите позже») that cannot help while the folder stays unusable; the list that never leaves «Загрузка…» looks like a page that is still loading. Criterion 6 of REQ-107 asks only a plain sentence, so the criterion is met (`decisions/0113` О11); the page is weaker than the plain words of Q10 ask. The page already has sentences that name a cause for other disk troubles (`ctlDisk`, `readFailed` in `texts.js`).

Why LOW: nothing is lost or written, the process keeps answering, and the case needs a data folder that is broken from outside; but the person is told to wait for something that will not change.

## Доказательство

- `docs/design/REQ-107-e2e-team-web.md` — F27 (the probes `p4a`, `p5`), section 5 (failure paths), section 19 О11 and О14; `decisions/0113`, О11, О14.
- `tools/test/e2e/team-web.e2e.js`, test `failure` (b) (lines 1236–1298): the refusal is read folded and as its source text and passes `assertPlain`; the listing of the test folder, the bytes of `f` and `lstat` `ENOTDIR` show that nothing was made; `LIST_500` (lines 110–116) declares the browser's 500 line of `/api/projects`.
- Read as text at step 10: `tools/src/web/texts.js` line 98 (`internal: "Что-то пошло не так. Повторите позже"`), `tools/src/web/api.js` lines 56–60 (`internal`), `tools/src/team/home.js` lines 86–88 (`homeError`).
- To see it, only under the rules of the e2e kit (a data folder under the temporary root, never the person's own): run test `failure` of the spec; its second server shows the words above.

## Как исправить

First ORCH decides whether a new sentence is a fix of this defect or a new behaviour of the page (`decisions/0113` О11 calls it «a change of the page, a new requirement»); in the second case a WF-01 item comes first. Then FRONTEND-DEV (with BACKEND-DEV for the answer of the server): for an `E_HOME` refusal the page gets a plain sentence that names the cause and what to do (for example, that the data folder of Sai Team cannot be used and the setting `SAI_TEAM_HOME` or the folder needs to be checked), without a path, a code or a stack; the list shows that sentence in place of «Загрузка…» when its request is refused. TEST-DESIGNER pins the new words in test `failure` (b) of `team-web.e2e.js` and in the page tests. The refusal stays plain (criterion 6), the process stays alive, nothing is made. A weaker check of the words is not a fix (Q6).

## Маршрут

WF-01 (if ORCH so decides) → WF-03 or WF-02 for FRONTEND-DEV and BACKEND-DEV, with SECURITY-REVIEWER and REVIEWER, then TEST-DESIGNER and TEST-DESIGN-VALIDATOR; not urgent; on ORCH's order. Can go together with ISS-0114 (the same page).
