# ISS-0128 — Texts of requirements that the landing run left for a micro-amendment: REQ-108 criterion 2's count reference, the REQ-109 and REQ-108 literals, and the mutant list of REQ-112 criterion 2

Серьёзность: LOW. Статус: open. Найдено: дизайн кода `M1CODE-20261119-01` (раздел 16, находка F10 шлюза), RELEASE-VALIDATOR (шаг 09, F6 и «what DOC-UPDATER must change»); заведено DOC-UPDATER (шаг 10), 2026-11-21. Пункт планки: Q1, Q14 (текст критерия соответствует дереву).
Требования: REQ-108 (критерии 2 и 11), REQ-109 (критерий 8), REQ-112 (критерий 2). Решение: `decisions/0123` «Order» (2), `decisions/0079` пункт 5 (смысл критерия меняет микроправка WF-01 с воротами REQ-VALIDATOR; DOC-UPDATER смысл не меняет).

## Что не так

1. **REQ-108 criterion 2** compares «# tests N» of each test step with «the test catalogue of the run — section 13 of docs/design/REQ-108-109-app-skeleton.md, with every test that a later step of the run names in its handoff as added or removed». That describes the tree of the skeleton run only: the fix round moved unit to 46 and run `M1CODE-20261119-01` to unit 120, int 47 and e2e 15, so read at a later commit it does not hold (AP-133, AP-170). Proposal of the design (section 16): the reference reads «the test catalogues of the runs whose changes the tree holds — section 13 of the skeleton design, the tests that the fix round of the skeleton named (NPM-6), and section 10 of `docs/design/REQ-111-112-public-landing.md` — with every test that a later step of those runs names as added or removed»; until it is amended, a re-check of REQ-108 criterion 2 reads the counts at the commit at which REQ-108 was released (d87b3d1: unit 46, int 36).
2. **The literals of `decisions/0123` «Order» (2)**: REQ-109 criterion 8's sentence and REQ-108 criterion 11's two literals (the micro-amendment that the decision names; RELEASE-VALIDATOR at step 9 leaves it to the amendment run, not to step 10).
3. **REQ-112 criterion 2**, the own mutant list («one step of the order of the BFS changed»): swapping only the right and left entries of `STEPS` in the BFS of `grid.js` changes no path on the 4 824 cells and 37 940 paths measured (equal in effect); swapping any pair with up or down is red (20 481 and 8 823 differences). The list should name a swap with up or down (RELEASE-VALIDATOR finding F6, Info).

DOC-UPDATER did not change these texts at step 10: each changes the meaning of a criterion or its mutant list, which is a WF-01 micro-amendment with the REQ-VALIDATOR gate.

## Доказательство

`docs/design/REQ-111-112-public-landing.md` section 16 and 20; `handoffs/M1CODE-20261119-01/step-09-release-validator.json` (F6, «what DOC-UPDATER must change», the requirement item); `decisions/0123` «Order»; GitHub run 44908361054 (unit 120, int 47, e2e 15).

## Как исправить

A WF-01 micro-amendment run (REQ-ANALYST writes the three edits by the proposals above, REQ-VALIDATOR gates them), and the re-check of REQ-108 and REQ-109 by RELEASE-VALIDATOR (an open row of `docs/program/public-v1/PROGRESS.md`, «Open problems») reads the amended texts. It can go with any amendment run that is open at the time.

## Маршрут

WF-01 (micro-amendment, `decisions/0079` item 5).
