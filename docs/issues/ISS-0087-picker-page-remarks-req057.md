# ISS-0087 — Questionnaire page (REQ-057): remarks of the acceptance run, the sign-off and the gates — small things of the page, the design text and the code that no criterion asked for

Серьёзность: LOW. Статус: open. Найдено: UAT-RUNNER (прогон `PAGE057-20261021-01`, шаг 26, замечания R1-R6, `docs/uat/REQ-057-RUN.md`), BA-ANALYST (шаг 27, замечания P2, P3, P5-P8, `docs/uat/REQ-057-SIGNOFF.md`), TEST-DESIGN-VALIDATOR (шаг 23, I3), REVIEWER (шаги 15 и 22: N1, L2, L4), SECURITY-REVIEWER (шаги 5, 10, 14, 21: F1/K1), 2026-10-25; заведено DOC-UPDATER (шаг 29), 2026-10-25. Пункты планки: Q3 (честный текст проекта и шагов приёмки), Q10, Q11 (п. 11). Требования: REQ-057 (done 2026-10-25; ничто здесь не блокировало выпуск, критерии выполнены), REQ-058 и ISS-0081 (пп. 1, 11).

## Что не так

None of these is a failure of a criterion of REQ-057: the criteria were met (`handoffs/PAGE057-20261021-01/step-28-release-validator.json`). They are left over from the run and recorded so that nothing is lost.

Page and wording (need a WF-01 question or a text change):

1. **The screen of a failed load has no site name, no heading `h1` and no language buttons** (R2 of the run file, P2 of the sign-off). Before the questionnaire arrives the page does not know the name of the tenant; the criteria do not ask for these elements. A question for the owner (WF-01): should that screen show at least the language buttons and a fixed heading?
2. **Two words for one thing: "survey" and "questionnaire"** (P3; in Russian «опрос» and «анкета»). The card says «Пройти опрос», the rest of the page and the documents say «анкета». A text change in `tools/src/picker/public/texts.js` for three languages plus a new round of readers (`decisions/0070`, item 10; the Kazakh part also waits for a knowledgeable person, ISS-0082).
3. **Layout at the edge sizes.** (a) At 320 × 568 the card is taller than the window and the button is partly under the fold (R4, P7); the criterion asks for the no-scroll view only at 390 × 844. (b) At 390 × 844 the highest question page (the longest question) is 2 px above the window height, vertical scroll only (R4, P7). Not required by a criterion; decide whether to tighten the spacing in `page.css`.
4. **The focus frame around the heading of the temporary end screen looks like a box on a phone** (P8). The frame is required by criterion 5 (the focus must be visible); the form of it can be softened (for example, a ring with an offset, as on the buttons) without losing the contrast of 3:1.

Design text and acceptance steps (`docs/design/REQ-057-picker-page.md` and `docs/design/REQ-057-picker-page-ui.md`):

5. **Step PR-8 (a) cannot be done literally** (R1 of the run file, P5). Section 18 of `docs/design/REQ-057-picker-page.md` (the step is written there as «ПР-8») says "stop the stand, open the page — the block of the connection". With the stand down the page cannot be opened at all (the browser shows its own error page, `net::ERR_CONNECTION_REFUSED`); the run reached the block by holding the questionnaire request at the browser until the stand was stopped. Correct the step text to say that (AP-125).
6. **Sizes of the interface description are off by one** (R3, P6): `docs/design/REQ-057-picker-page-ui.md` (section 9 and the lines near 61, 253 and 631) says option rows 49 and number inputs 45, the page has 48 and 44. Both meet the criterion (44 × 44); correct the numbers.
7. **Row Q4 ("Skip") of section 5.2 is incomplete** (L2 of step 22): it lists "answer erased, draft = null" and "as Q2 without the check" but does not say that the validation message and `aria-invalid` are cleared (the behaviour of F10, now in the code and pinned by `QP-2e`). Add: "the error message is erased (as in Q1)". And the sentence "The page code was not touched" near line 741 (section 17.6) is true for step 20 only; two lines of `app.js` changed at step 19. Write: "The page code was not touched in this step (F10 needed two lines of app.js in step 19)".

Code (small, no behaviour change except item 9):

8. **`net.js:157` accepts `questions_min = 0`** (I3 of step 23, read not run). A body whose questions all carry `show_if` would leave the page with no first question at "Take the survey". The server validator never produces such a body, so this is a defensive check only (mutant H06 is equivalent for every body the server sends). Make `net.js` refuse `questions_min < 1` as a bad shape.
9. **A redundant check at `app.js:522`** (N1 of step 15; AP-014 class): `if (state.screen !== "result") return;` at the start of the `from === "result"` branch is dead since the guard at `:516` runs earlier and nothing awaits between them. Remove it with the tests green.
10. **The pair `state.message = null; clearMessage(refs)` is written in two places** (L4 of step 22: `onAnswer` and the Skip branch). Acceptable now; if a third place appears, move the pair into one function (`clearValidation(refs)`).
11. **Low K1 (security F1, carried since step 05): `fetch` in `net.js:34` follows redirects** (`redirect` mode is the default). A redirect of the questionnaire (302) or the result (307) to an outside address is blocked by the CSP `connect-src` (the console shows the violation and the page shows the block "no connection"), so nothing leaves; setting `redirect: "error"` would make this explicit. Recorded as not done by `decisions/0078`, item 14; also see ISS-0081 (before publication to the internet).

## Доказательство

`docs/uat/REQ-057-RUN.md` (R1-R6; steps PR-2, PR-3, PR-8); `docs/uat/REQ-057-SIGNOFF.md` (P1-P11); `handoffs/PAGE057-20261021-01/step-26-uat-runner.json` (I1, I2), `step-27-ba-analyst.json` (remarks), `step-23-test-design-validator.json` (I3), `step-15-reviewer.json` (N1), `step-22-reviewer.json` (L2, L4), `step-05-security-reviewer.json`, `step-21-security-reviewer.json` (K1). Quick checks: item 5 — in a browser with the stand stopped, the address of the page gives the browser's error page; item 6 — `grep -n "49" docs/design/REQ-057-picker-page-ui.md` against the measured 48 and 44 of `docs/uat/REQ-057-RUN.md` (PR-3, R3); item 8 — `sed -n 150,165p tools/src/picker/public/net.js`; item 9 — `sed -n 514,526p tools/src/picker/public/app.js`.

## Как исправить

Group by owner of the change: items 1-4 — a WF-01 question to the owner (items 1 and 3 are choices, not bugs), then FRONTEND-DEV with the texts of item 2 going to readers again; items 5-7 — CODE-DESIGNER or DOC-UPDATER-level edits of the design text, no code; items 8-11 — one small WF-03 run for CODE-FIXER (net.js and app.js) with a test for item 8 (a body with `questions_min = 0` is refused) and the existing tests staying green; item 11 can wait for the publication to the internet together with ISS-0081. REQ-058 will replace `result.js` and the temporary end screen, so item 4 may disappear by itself.

## Маршрут

ORCH: items 1-4 — a question to the owner at the next report (nothing blocks); items 5-7 — with the next job that touches the design file or with the run of REQ-058 (its design lists them); items 8-11 — a small WF-03 run between requirements, or inside the run of REQ-058 when `net.js` and `app.js` are touched anyway. The page must not go to real visitors before REQ-058 (the end screen is temporary), whatever happens to this defect.
