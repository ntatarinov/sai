# REQ-057 — sign-off: the card and the questionnaire page of the solution picker site

WF-02, step 8 (BA-ANALYST), run `PAGE057-20261021-01`, handoff `step-27-ba-analyst.json`. Written 2026-10-25 (clock reading 19:56Z). This file has two parts: the reading of the page texts as a business reader (step PR-12, condition (g) of LANG061), and the sign-off of the 11 criteria of REQ-057. The decision to release is the owner's (R1); this file only says what has been shown.

## Verdict

**SIGNED.** All 11 criteria of REQ-057 are covered by evidence: the 11 acceptance steps PR-1 … PR-11 passed on the running stand in a real browser (11 of 11, 0 failures; `docs/uat/REQ-057-RUN.md`), and the full check passed three times in a row (1998 tests of 1998, skipped 0, todo 0; step 25). No failure of any severity is open, so no scenario goes to WF-03. There is no criterion that a visitor sees and that lacks a passed step.

Three limits stay attached to this signature, and they are not hidden by it:

1. **The end of the questionnaire is a temporary screen.** After the last question the visitor sees only "The result will appear on this page soon." with the buttons "Back" and "Start over". The real result page is REQ-058. Until then the site asks a visitor to answer up to twelve questions and gives nothing in return. The card even promises a result ("At the end you will see what you get…"). This is by design (decision 0078, item 3) and the criteria say so, but a real visitor would feel it. Do not show this page to real visitors before REQ-058.
2. **The page was never shown to a real visitor.** Everything below was measured by a browser robot and read by me from snapshots. Nobody who runs a small business has used the page. Safari and Firefox were not tried, and no real phone was used (the narrow windows are frames of a headless Chrome).
3. **Kazakh was not checked by a native speaker.** The owner said that a native review is not needed now (decision 0072, item 2); the open lines are listed in part 1.

## Part 1 — the texts of the page as a business reader (PR-12)

**What was done by the readers.** The 23 page keys (`card_*`, `progress_*`, `quiz_*`, `net_*`, `result_soon`) were checked in `kk` and `en` by fresh agents without code and documents, in two rounds. I did not read the reader files and I did not recount them: the numbers below are the results given to me in the handoff of this step, as facts of this run.

| Language | Round 1 | Fixes | Round 2 |
|---|---|---|---|
| Kazakh | 23 pairs: 21 "yes" | 2 fixed | all "yes" |
| English | 22 "yes" | 1 fixed | "yes" |

The agent readers' part is done. It is **not** a native speaker's opinion. Lines still awaiting a native Kazakh speaker (a reference, not a block; decision 0072):

- `progress_label` in Kazakh: the file now has "Сұрақ {current} / {total}"; a doubt was raised for "{total} ішінен {current}". The file was not changed by this step.
- Five lines of the demo tenants in the Kazakh tenant file (lines 105, 121, 139, 141, 160).

**What I did.** I checked that the final file has exactly 23 page keys, each with `ru`, `kk` and `en`, and that no phrase is longer than 18 words by a plain count of words. Then I read the final value of each key as a visitor who runs a small business and knows nothing about the project.

**My reading (understanding only; I am not a native Kazakh speaker and this is not a language review).**

- **Russian and English: every one of the 23 is clear.** The buttons say what they do ("Take the survey", "Next", "Back", "Skip", "Show the result", "Try again", "Start over"). The error lines say what is wrong and what to do ("Answer this question to continue.", "Enter a whole number from {min} to {max}."). The connection lines tell the visitor the one thing that matters: whether the answers are kept ("Your answers are saved" or "please don't close the page: your answers are only stored here for now").
- **Kazakh: I understand the meaning of all 23.** The two lines I would give to a native speaker first are the ones where a number stands in the sentence: "Сұрақтар: {min} бастап {max} дейін" (and the same wording in `quiz_number_hint`). The numbers cannot take Kazakh endings, so the line is understandable but may sound stiff; and the `progress_label` doubt above.

**Remarks on the texts (not failures).**

- **T1.** The page uses two words for the same thing. Russian: "опрос" on the button and "анкета" in "Анкета изменилась…" and "Загружаем анкету". English: "survey" on the button and in "Survey progress", but "questionnaire" in "The questionnaire has changed." and "Loading the questionnaire". A visitor can follow it, but one word would be calmer. Kazakh uses "сауалнама" throughout.
- **T2.** `result_soon` ("The result will appear on this page soon.") is true only after REQ-058. Until then the word "soon" is a promise the site cannot keep (see limit 1).
- **T3.** `card_gives` ("At the end you will see what you get: what is included, how it helps, and next steps.") is the longest line on the card, 18 words in English, exactly at the limit. It reads well, but there is no room to add anything.

## Part 2 — what the visitor sees (six snapshots)

I looked at six snapshots from the run. I did not walk the page myself (boundary with UAT-RUNNER).

1. **Card, Russian, phone 390 × 844, light.** The first thing is the site name in large type. Under it three language buttons, the current one filled in. Then a short description, a highlighted line about what the visitor will get at the end, a call to answer the questions, "Вопросов: от 8 до 12", and one large blue button "Пройти опрос". It is clear what to do: there is one button and it is the brightest thing on the screen. The whole card fits the phone without scrolling.
2. **Question 5 of 10, Russian, desktop 1470 × 784, light.** "Вопрос 5 из 10" with a bar that is half full, so I know where I am and how far it is. The question and a hint ("Отметьте всё, что относится к вашему делу"), five rows with check boxes, the chosen row coloured, the row with the keyboard focus has a clear dark frame. "Назад" on the left, "Далее" on the right. I can go back.
3. **Question 5 of 10, Kazakh, narrow phone 320 × 568, dark.** Same structure in the dark theme: "Сұрақ 5 / 10", the bar, the question in Kazakh, the rows with text wrapped onto two lines and not cut off, "Артқа" and "Әрі қарай" under them. Nothing runs out of the screen, text is easy to read on the dark background, and the long Kazakh lines fit.
4. **Temporary end screen, English, phone, light.** The site name, the language buttons, the line "The result will appear on this page soon." with a frame around it (the focus frame; it is there for keyboard users, but on a phone it looks like a box), and two buttons "Back" and "Start over". This is the honest end for now. A visitor learns that nothing more will happen and cannot do anything except go back or start over. It matches limit 1.
5. **No connection on the first screen, English, phone, light, with a browser that refuses to store answers.** A red-bordered block: "No connection. Please don't close the page: your answers are only stored here for now. Please try again." and a button "Try again". The text is calm and tells the visitor what to do. What is missing: the site name and the language buttons are not shown on this screen (the name is not known until the questionnaire arrives), so the visitor cannot see which site is failing and cannot switch the language (remark P2).
6. **No connection after the last question, Russian, phone, light, storage works.** Question 10 of 10, the chosen answer still marked, "Назад" and "Показать результат", and under them a red block: "Нет связи. Ваши ответы сохранены. Попробуйте ещё раз." with "Повторить". The answers did not disappear and the next step is a button. It is clear what happened and what to press.

**What the visitor can answer in plain words**

- *Is it clear what to do?* Yes: one main button on the card, then one question per screen with one main button ("Далее" / "Показать результат") and the plain "Назад"; I did not see a second main button on any screen I looked at.
- *Where am I?* Yes: the name of the site on every screen, "Вопрос K из N" with a bar.
- *Can I go back?* Yes, "Назад" (seen on a question screen and on the temporary end screen). I did not see the first question in the six snapshots; the absence of "Назад" there is covered by test QP-2 and not by a snapshot I looked at.
- *What happens at the end?* Today: a temporary screen that says the result will appear "soon", and nothing else. After REQ-058: the result page. This is the largest limit of the signature.

## Coverage of the 11 criteria

"PR-n" are the acceptance steps run in the browser (`docs/uat/REQ-057-RUN.md`). The test ids are those of section 16 of `docs/design/REQ-057-picker-page.md`; all of them passed in the full check run three times (step 25: 1998 of 1998; the three page test files alone: 100 of 100). Criteria 1–3 and 8 are things a visitor sees and have a browser step in addition to tests; criteria 4, 5, 7, 9 and 11 are the ones the criteria themselves send to the stand; 6 and 10 are not visible to a visitor.

| # | Criterion (short) | Test evidence | Browser evidence (running stand) | Covered |
|---|---|---|---|---|
| 1 | Start screen: name, intro, count of questions, "Пройти опрос"; "Продолжить" and "Начать заново" when answers are saved | QP-1a … QP-1e | PR-2 (the card, 36 of 36); PR-6 (after reload the card shows "Продолжить" and "Начать заново"; "Начать заново" erases the key and opens question 1 with nothing selected) | yes |
| 2 | One question per screen; "Далее", "Назад", "Пропустить" only for optional; required question without answer stays and says why | QP-2a … QP-2j, QM-2c … QM-2e | PR-3 (324 question screens); PR-4 (the keyboard walk uses radio, check boxes, the number field and "Пропустить"); PR-5 (the error text is in the measured states); PR-6 ("Назад" shows earlier answers) | yes |
| 3 | Honest progress "Вопрос K из N", progress bar, N never grows going forward | QP-3a … QP-3e, QM-2a (300 generated files) | PR-4 (progress read on every step: 1/12 2/11 … 10/10 and 1/11 … 8/8, the same in three languages); PR-6 ("Вопрос 5 из 10") | yes |
| 4 | Answers saved; same question and answers after reload; changed questionnaire clears; storage that throws does not break it | QP-4a … QP-4g, QM-3a … QM-3d | PR-6 (9 of 9 reloads: same question, same answers); PR-9 (storage refuses: the questionnaire still goes through) | yes |
| 5 | Keyboard, focus, no horizontal scroll, targets 44 × 44, contrast 4.5 : 1, three windows, three languages | QP-5a, QP-5a2, QP-5b, QP-5c, QS-8 | PR-3 (324 screens, least target 44 × 44, no horizontal scroll); PR-4 (keyboard-only to the end, focus on the question text 324 of 324, focus frame seen on snapshots); PR-5 (least text ratio 5.72 light, 6.74 dark) | yes |
| 6 | Storage: only the key of its own tenant; no contacts; language in the value | QP-6a … QP-6d, QM-3d, QM-3e | PR-2, PR-6, PR-7 (the list of keys after every walk was only the page's own key, 36 of 36); the stored value has five fields and no contact field | yes (not visible to a visitor) |
| 7 | No connection: "Повторить" and the right text for saved / not saved; answers kept; no exceptions in the console | QP-7a … QP-7g, QM-4a … QM-4d | PR-8 (27 runs with the stand really stopped); PR-9 (9 runs with a refusing storage); PR-10 (exceptions 0 in 96 runs) | yes |
| 8 | Clear texts: every constant on three languages, phrases up to 18 words, no forbidden words; the page text is made of the table and of the questionnaire | QP-8a, QP-8b, QP-8c, QM-5a, TX-6b, SU-10, the full check | PR-2 (the text of the card equals the expected lines, 36 of 36); the readers of the 23 keys (part 1); part 1 of this file | yes, with the limit: Kazakh by agent readers only |
| 9 | Language: three buttons, rule of choice, switch without reload, same question and answers, same K and N | QP-9a … QP-9l | PR-7 (same 10 questions in the same order on ru, kk, en; 18 of 18 switches without reload, same question and answer) | yes |
| 10 | Guard tests and lint: one `fetch(` in `request`, no addresses with a scheme, `npm run lint` code 0, config of lint unchanged | TR-4b, TR-4d, TR-4e, TR-4f, LG-10c, QS-4, QS-5, QS-12; the full check 3 times in a row (lint clean); the search commands and the empty difference of the lint config (step 16) | PR-10 and the side search of the run (one `fetch(` in `net.js`; no `https?://`; no `alert(`, `confirm(`, `prompt(`, `showModal`, `beforeunload`) | yes (not visible to a visitor) |
| 11 | The card: name first, the "what you get" line and the call, count, one button; no blocking window; no stub; 44 × 44; button visible without scroll at 390 × 844; three windows × three languages; 23 keys to readers | QP-11a … QP-11d, QS-1, QS-3, QS-11, SU-10, SU-11 | PR-2 (36 of 36: no dialogs, no fixed elements, button 262–332 wide × 48, bottom 543 of 844 at 390 × 844); PR-10 (no console errors besides the allowed `/favicon.ico` line) | yes; the readers' part is in part 1 |

## Remarks (follow-up list; none is a failure, AP-117)

- **P1. End of the questionnaire is a placeholder** (limit 1). Follow-up: REQ-058. Until then the page should not go to real visitors.
- **P2. The screen of a failed load** shows only the error block: no site name, no language buttons, no heading (UAT remark R2). The criteria do not ask for them. A visitor with a bad connection on the first screen cannot tell which site it is or change the language. Proposal: raise it in WF-01 if the owner wants it.
- **P3. The words "survey" and "questionnaire"** are mixed (T1). Proposal: one word per language, a text change in `texts.js` with the readers run again.
- **P4. Kazakh lines for a native speaker:** `progress_label` and the five lines of the demo tenants (see part 1); the lines with numbers in a sentence ("Сұрақтар: {min} бастап {max} дейін"). Marked as `FOR_NATIVE_SPEAKER` in the handoff; the release does not wait for them (decision 0072).
- **P5. The wording of step PR-8 (a)** says "stop the stand, open the page", but with the stand down the browser cannot open the page at all (UAT remark R1). The step was done by holding the questionnaire request, which tests the same page code. CODE-DESIGNER or BA-ANALYST can fix the wording of the step in the design.
- **P6. Sizes in the description** are given as 49 and 45 where the page measures 48 and 44; both meet the criterion (not less than 44 × 44) (UAT remark R3). The description can say "not less than".
- **P7. Small phone.** At 320 × 568 the card is higher than the window and the button is partly under the fold (bottom 543 … 594 of 568); at 390 × 844 the highest question page is 2 px above the window (UAT remark R4). The criterion asks to see the button without scroll only at 390 × 844, so this is not a failure; a visitor on a very small phone scrolls a little.
- **P8. The focus frame around the heading** on the temporary screen looks like a box on a phone (snapshot 4). It is the keyboard focus and is required by criterion 5; a visitor with a finger sees a frame that does nothing. Not a failure.
- **P9. The switch of the language with the stand down** (not in a criterion) shows a block under the header and works like the load block (UAT remark R5).
- **P10. `/favicon.ico` answers 404** and leaves one line in the console of a new browser profile. The criterion allows it (decisions 0077 and 0078); ISS-0081 stays open for the publication to the internet.
- **P11. Not tried:** Safari, Firefox, a real phone, a real visitor, a screen reader. Q3: no statement about them.

## Language check of this file

Every phrase is checkable from the page (what a visitor sees and presses) or from the named run file and the named test ids; the lines about numbers refer to the run file. No scenario here is run by me: the signature rests on the results of the run on the running stand (`REQ-057-RUN.md`, step 26) and on the full check (step 25). The quality bar items applicable to the change: Q3 (browsers not tried, said so), Q8 (storage of its own tenant only, criterion 6), Q10 (no connection, criterion 7); Q11 and R3 do not apply (no address given by the user, no personal data; decision 0033).
