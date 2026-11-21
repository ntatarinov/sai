# ISS-0124 — The Low findings of the speaker row of the demo (tests T13–T16, review L2–L5, a comment line break) are accepted and open

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGN-VALIDATOR (шаг 05m), REVIEWER (шаги 04f, 04g), прогон `M1CODE-20261119-01`; заведено DOC-UPDATER (шаг 10), 2026-11-21. Пункт планки: Q5 (тест доказывает то, что называет), Q6 (проверка не подделана).
Требования: REQ-111 (критерий 12 «Landing in a browser»), REQ-112. Решение: `decisions/0124` О45, О46, О47 (все Low приняты письменно и едут со следующей правкой этих файлов: правка проверенного кода заново запускает шаги 3 и 4, поэтому комментарий или строку теста отдельно не правят).

## Что не так

The speaker of the demo question takes its own row by content (`fitSpeaker` in `app/public/js/pages/demo.js`, the class `own`, the rows LD-5 F, G, H of `app/test/e2e/landing.test.js` and the helpers `speakerRow`, `stressSpeakerLine`, `clearSpeakerStress` of `app/test/fixtures/e2e-kit.js`). Steps 3, 4 and 5b passed; these findings stay open, none fails a criterion and none blocks:

- **T13** (`step-05m-test-design-validator-speaker-rows.json`): row G does not pin the 4 px gap between the speaker column and «‹ Назад» apart from the layout's own gap: a change that narrows the gap by 1 px is not red; a change that widens it is (mutant M16b is red only by a coincidence).
- **T14**: the 0.5 px tolerance of row F is not backed against a larger slack (mutant A2, slack 1.5 px, survives; A1, slack 0.5 px, is by design).
- **T15**: `flex-wrap` of the own progress row (`.ask-h.own .prog`) is pinned by no row (mutant A12 survives).
- **T16**: the own-row pin of H at 320 px for all five questions has about 2.5 px of margin on a Windows font (question 2, the stage line «Готовим документацию»: 174.8 px against a column of 172.3 px); on the runner's font it has about 15 px, proved by the green GitHub run 44908361054, and not proved on a Windows PC, where the e2e rows are never run.
- **T17** (Info): the survivors M16 (equal in effect) and A1 (by design).
- **L2** (`step-04f-reviewer-speaker.json`): one check of `speakerRow` has no tolerance, while the others have 0.5 px.
- **L3**: the comment of section G says 6 px where the test uses 5 px.
- **L4**: the stress style sheet of `stressSpeakerLine` is not tried under the CSP on the runner by a step of the run; the GitHub e2e is green, so it works there.
- **L5**: `fitSpeaker` is not measured again for a text-size change of the visitor or for a web font that arrives late (the page uses the system font stack; it re-measures at a new question, a language switch and a resize).
- **L1 of step 04g** (`step-04g-reviewer-comments.json`): a ragged comment line break in `app/public/css/site.css` (about line 1938) and in the markup comment of `demo.js`: formatting only.
- The L2 of step 04g (the look still named the old threshold) is closed at step 10: sections 7.9, 12, D24, D25 of `docs/design/V1-public-look.md` now state the content rule of О45.

## Доказательство

- `handoffs/M1CODE-20261119-01/step-05m-test-design-validator-speaker-rows.json` (36 mutants measured, 32 red; the survivors and the numbers above), `step-04f-reviewer-speaker.json`, `step-04g-reviewer-comments.json`, `decisions/0124` О46, О47.
- GitHub: `app.yml` run 44908361054 on the commit f4ac340 (job `e2e`: «# tests 15», «# pass 15», «# fail 0»).

## Как исправить

Not ready fixes (AP-161: each is measured on the mutant, on today's page and on the benign twins before it is written as ready). Proposals for the next edit of these files: T13 add a row that narrows the gap by 1 px and expect red; T14 back the 0.5 px tolerance with the row at a speaker font scale where a 1 px overrun is real; T15 pin the wrap of the own progress row at 320 px; L2 give the check the same 0.5 px; L3 fix the comment to 5 px; L1 re-wrap the two comments; L5 decide with the owner whether a late font or a text-size change is a real case for this page. A fix to code or tests restarts steps 3, 4 and 5b of the WF-02 run that carries it.

## Маршрут

Not a run of its own: it travels with the next edit of `app/public/js/pages/demo.js`, `app/public/css/site.css`, `app/test/e2e/landing.test.js` or `app/test/fixtures/e2e-kit.js` (for example the round that follows the owner's G21 if it asks for a change of the speaker row). WF-03 only if the owner asks for a separate fix.
