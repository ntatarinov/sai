# ISS-0128 — Texts of requirements that the landing run left for a micro-amendment: REQ-108 criterion 2's count reference, the REQ-109 and REQ-108 literals, and the mutant list of REQ-112 criterion 2

Серьёзность: LOW. Статус: closed, 2026-11-22, все три пункта сделаны микроправкой `M1AMEND-20261122-01` (шлюз REQ-VALIDATOR PASS с первого прохода); остатка нет. Найдено: дизайн кода `M1CODE-20261119-01` (раздел 16, находка F10 шлюза), RELEASE-VALIDATOR (шаг 09, F6 и «what DOC-UPDATER must change»); заведено DOC-UPDATER (шаг 10), 2026-11-21. Пункт планки: Q1, Q14 (текст критерия соответствует дереву).
Требования: REQ-108 (критерии 2 и 11), REQ-109 (критерий 8), REQ-112 (критерий 2). Решение: `decisions/0123` «Order» (2), `decisions/0079` пункт 5 (смысл критерия меняет микроправка WF-01 с воротами REQ-VALIDATOR; DOC-UPDATER смысл не меняет).

## Что не так

1. **REQ-108 criterion 2** compares «# tests N» of each test step with «the test catalogue of the run — section 13 of docs/design/REQ-108-109-app-skeleton.md, with every test that a later step of the run names in its handoff as added or removed». That describes the tree of the skeleton run only: the fix round moved unit to 46 and run `M1CODE-20261119-01` to unit 120, int 47 and e2e 15, so read at a later commit it does not hold (AP-133, AP-170). Proposal of the design (section 16): the reference reads «the test catalogues of the runs whose changes the tree holds — section 13 of the skeleton design, the tests that the fix round of the skeleton named (NPM-6), and section 10 of `docs/design/REQ-111-112-public-landing.md` — with every test that a later step of those runs names as added or removed»; until it is amended, a re-check of REQ-108 criterion 2 reads the counts at the commit at which REQ-108 was released (d87b3d1: unit 46, int 36).
2. **The literals of `decisions/0123` «Order» (2)**: REQ-109 criterion 8's sentence and REQ-108 criterion 11's two literals (the micro-amendment that the decision names; RELEASE-VALIDATOR at step 9 leaves it to the amendment run, not to step 10).
3. **REQ-112 criterion 2**, the own mutant list («one step of the order of the BFS changed»): swapping only the right and left entries of `STEPS` in the BFS of `grid.js` changes no path on the 2 294 walkable cells and 37 940 paths measured (equal in effect); swapping any pair with up or down is red (20 451, 25 825, 5 307, 8 802 and 87 differing paths on the layouts of 1, 4, 21, 22 and 30 desks). [Corrected 2026-11-22 by DOC-UPDATER: this record first said 4 824 cells and 20 481 and 8 823 differences; the amendment run measured the numbers above, and `handoffs/M1AMEND-20261122-01/step-02-req-validator.json`, finding L5, confirms them.] The list should name a swap with up or down (RELEASE-VALIDATOR finding F6, Info).

DOC-UPDATER did not change these texts at step 10: each changes the meaning of a criterion or its mutant list, which is a WF-01 micro-amendment with the REQ-VALIDATOR gate.

## Доказательство

`docs/design/REQ-111-112-public-landing.md` section 16 and 20; `handoffs/M1CODE-20261119-01/step-09-release-validator.json` (F6, «what DOC-UPDATER must change», the requirement item); `decisions/0123` «Order»; GitHub run 44908361054 (unit 120, int 47, e2e 15).

## Как исправить

A WF-01 micro-amendment run (REQ-ANALYST writes the three edits by the proposals above, REQ-VALIDATOR gates them), and the re-check of REQ-108 and REQ-109 by RELEASE-VALIDATOR (an open row of `docs/program/public-v1/PROGRESS.md`, «Open problems») reads the amended texts. It can go with any amendment run that is open at the time.

## Маршрут

WF-01 (micro-amendment, `decisions/0079` item 5).

## Закрыто

Closed 2026-11-22T07:49:27Z (time from the clock), run `M1RECHECK-20261122-01` (WF-02 step 10, DOC-UPDATER, after the RELEASE-VALIDATOR PASS of `handoffs/M1RECHECK-20261122-01/step-09-release-validator.json`, which read the amended texts). What the amendment run `M1AMEND-20261122-01` did (WF-01 micro-amendment, `handoffs/M1AMEND-20261122-01/step-01-req-analyst.json`; REQ-VALIDATOR PASS at gate pass 1, `step-02-req-validator.json`), by the three items:

1. **REQ-108 criterion 2** now compares «# tests N» with the test catalogues of every run whose changes the tree holds: section 13 of the skeleton design, the tests that its fix round named (NPM-6), section 10 of `docs/design/REQ-111-112-public-landing.md`, and the catalogue of each later run that changed a file under `app/test` (`git log --oneline d87b3d1..<commit under check> -- app/test`; section 9 of `docs/design/REQ-113-visitor-status.md` for REQ-113; AP-143, AP-170). The re-check applied the rule at `e0a425b`: unit 120 = 46 + 74, int 47 = 36 + 11, pg 4, e2e 15, equal to the CI log of run 44919421105.
2. **The literals of `decisions/0123` «Order» (2)**: the amendment found that REQ-109 criterion 1 and REQ-108 criterion 11 already carried the forms of the 2026-11-19 amendment (`M1AMEND-20261119-01`), so criterion 1 needed no edit; REQ-109 criterion 8 now states the public set of REQ-111 criterion 9 itself, and REQ-108 criterion 11 gained the reading of `decisions/0123` Addition L4 (a tree holds the build of REQ-111 when it holds `app/public/office/grid.js`). Nothing real is left of this item.
3. **REQ-112 criterion 2** names the five swaps of two entries of `STEPS` of which one is down or up as the mutants, with the measured numbers above, and says that the right/left swap changes no path and is no mutant of the list.

Left, none a defect: the validator's Low points L1 (the step from a listed commit to its catalogue is a reading), L2 (one file, `grid.js`, tells which list binds), L3 (a rotation of `STEPS` is no longer named by the wording; the design's M44 and the test PO-3 still cover it) and L4 (the design file of the public-set rule is not named in criterion 8). The amendment is in the working tree of `docs/requirements.yaml` and was not committed at the time of this record; it reaches `main` with the next release of the records.
