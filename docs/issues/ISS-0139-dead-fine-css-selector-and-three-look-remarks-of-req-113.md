# ISS-0139 — The dead CSS selector `.meta, .fine` in site.css, and three look remarks of REQ-113 that no criterion names (the owner's G21 list)

Серьёзность: LOW. Статус: open. Найдено: RELEASE-VALIDATOR (шаг 9 первой проверки, RV-6; шаг 11, F5), UAT-RUNNER (шаг 08, замечания R1, R2, R3), BA-ANALYST (шаг 10, W7), прогон `M1WORDS-20261122-02` (REQ-113); заведено DOC-UPDATER (шаг 12 по файлам прогона, WF-02 шаг 10), 2026-11-22T20:21:18Z, номер выдал ORCH. Пункт планки: Q1 (замечание без критерия), решение о внешнем виде принадлежит владельцу (G21).
Требования: REQ-113 (критерии 4, 6, 10, 11). Связано: `decisions/0126` О1, look 7.22 и 8.4.

## Что не так

1. **A dead selector (the cleanup).** `app/public/css/site.css` has the rule `.meta, .fine { font-size: 14px; color: var(--ink2); … }` (it starts at line 577). After REQ-113 no markup and no script uses the class `fine`: the lead of the idea panel lost its grey line (the key `idea_panel_fine` is removed from the texts module), and a grep of `app/public` finds no `fine` class. The class `meta` is still used. It is CSS only: no behaviour, no criterion and no test depends on it. The fix goes with the next change of `site.css` (remove `.fine` from the selector, keep `.meta`); a change of reviewed code of `app/public` restarts the review steps of a WF-02 round, so it is not worth a round of its own.

2. **Three remarks of the acceptance (the owner's G21 list), none of them named by a criterion.**
   - The sentence under the pips of the receipt («Чем больше ответов, тем надёжнее подсказка. …») is 14 px in the colour `rgb(98, 86, 74)`, smaller than the 16 px of the other body notes of the block. Criterion 10 asks 4.5:1 only and holds (the lowest text is 5.02:1). UAT-RUNNER R2, BA-ANALYST W7.
   - On a recommended result the block starts below the first screen at 320×568 and at 360×640, and at 390×844 only its top is inside the first screen (UAT-RUNNER read y 763 in ru and 740 in en; DESIGN-QA measured 740 in both, and the UAT file now says 740): the first row and the marks are below the fold. This is the cost that `decisions/0126` О1 and look 8.4 name. UAT-RUNNER R1, DESIGN-QA F4.
   - The English text of the part «Как описать идею» was not compared with the texts module in V-08 (the scenario quotes the Russian text only; the English page has no input field). UAT-RUNNER R3.

## Доказательство

- RELEASE-VALIDATOR: `handoffs/M1STATUS-20261122-02/step-09-release-validator.json` (RV-6) and `handoffs/M1WORDS-20261122-02/step-11-release-validator.json` (F5): no markup or script uses the class `fine`, the class `meta` is still used.
- UAT-RUNNER: `handoffs/M1WORDS-20261122-02/step-08-uat-runner.json` (R1, R2, R3), record `docs/uat/REQ-113-RUN.md` (section «Run of the wording round»); BA-ANALYST: `handoffs/M1WORDS-20261122-02/step-10-ba-analyst-signoff.json` (W7); DESIGN-QA: `handoffs/M1WORDS-20261122-02/step-06-design-qa-validator.json` (F4).
- To see item 1: `grep -rn "fine" app/public --include=*.html --include=*.js` finds no class use; `.fine` stands in the selector of `app/public/css/site.css` only.

## Как исправить

1. Remove `.fine` from the selector `.meta, .fine` together with the next change of `app/public/css/site.css` (CSS only; the guard tests of REQ-113 read the page, not this selector).
2. The three remarks are questions for the owner at G21 and need no fix unless he asks: accept them as they are, or ask for a 16 px sentence under the pips, a different spacing so that more of the block is inside the first screen on a phone, or the comparison of the English text of «Как описать идею» (a WF-01 amendment or a WF-02 round with its own steps; a change of words goes through WF-01).

## Маршрут

The owner's answer at G21 on the final screens of REQ-113 (`docs/program/public-v1/PROGRESS.md`, owner gates); item 1 with the next CSS change of the public site.
