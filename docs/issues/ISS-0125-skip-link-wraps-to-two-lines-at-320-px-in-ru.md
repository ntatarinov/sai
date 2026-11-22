# ISS-0125 — The skip link takes two lines at 320×568 in Russian (UAT L-19): a look matter for the owner's G21

Серьёзность: LOW. Статус: open. Найдено: UAT-RUNNER (шаг 08b, сценарий L-19), решение BA-ANALYST (шаг 08d, «L19_ruling»), прогон `M1CODE-20261119-01`; заведено DOC-UPDATER (шаг 10), 2026-11-21. Пункт планки: Q1 (требование с критерием), решение о внешнем виде принадлежит владельцу (G21).
Требования: REQ-111 (критерий 12, «ruling remark»; критерий 15, G21). Решение: `decisions/0124` О18 («one line or inside its own box until it gets the focus»), look 7.1.

## Что не так

At 320×568, light theme, Russian, on `/`, `/how.html`, `/examples.html` and `/nope` the text of the skip link «Перейти к основному содержанию» stands on two lines inside its own box (measured by the client rectangles of its text); the five other core cells show one line. Everything else of L-19 holds: the first Tab stop, Enter moves to the main part, the focus order of the demo.

BA-ANALYST ruled it a look matter and not a failure of a criterion: criterion 12 asks for no cut text and no control over another control, and the skip link is inside its box and lies over nothing; the wording of the scenario («on one line») is narrower than О18 and than the look 7.1 («however many lines its text takes»). UAT-RUNNER's recorded FAIL of the cell stays as it was recorded (the scenario file is not edited to turn a FAIL into a pass).

## Доказательство

- `handoffs/M1CODE-20261119-01/step-08b-uat-runner-req111.json` (L-19, 34 PASS and 1 FAIL), `step-08d-ba-analyst-signoff.json` (`L19_ruling`); `docs/uat/REQ-111.md` (L-19).
- To see it: open the local stand at a window of 320×568 in Russian and press Tab once on the landing.

## Как исправить

A question for the owner at G21: accept the wrapping (then the scenario L-19 is reworded «inside its own box» at the next edit of `docs/uat/REQ-111.md`, and nothing in the code changes) or shorten the Russian text of the skip link for 320 px in a later round (a text change in the texts module and its kk and en twins; a change of reviewed code restarts steps 3 and 4). Not a ready fix (AP-161): a shorter text is to be measured at 320 px in the three languages before it is proposed as ready.

## Маршрут

The owner's answer at G21 (`docs/program/public-v1/PROGRESS.md`, owner gates); then, if he asks to shorten it, a WF-02 round together with the other changes after G21.
