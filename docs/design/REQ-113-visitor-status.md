# REQ-113 — code design: the visitor status block of the public site

Run `M1STATUS-20261122-02`, WF-02 step 1 (CODE-DESIGNER, handoff `handoffs/M1STATUS-20261122-02/step-01c-code-designer.json`),
requirement REQ-113 (13 acceptance criteria, `docs/requirements.yaml`; it is the contract). Base of this run: the tag
`base/M1STATUS-20261122-02` (commit 4e9ef1e); the `app/` of that tag is byte for byte the `app/` of main e0a425b (the
production commit of REQ-111 and REQ-112; F1). The measure of the look is `docs/design/V1-public-look.md`, section 7.22 and
the edits of 7.15, 8.2 and 8.4 (the working-tree file written by GUI-DESIGN-ANALYST in this run, sha256
`840f880eb66c82b19f5ec5c34a2066599fe8375a182a359e0e2f707f724b3cb4`; not yet committed); this design changes no value of it. The
design that this one extends is `docs/design/REQ-111-112-public-landing.md` (the released public landing). Decisions that
bind it: `decisions/0125` (items 1 to 7), `decisions/0123` and `0124` (the landing), `decisions/0079` (items 6, 7, 13),
`decisions/0110` (the check runs on GitHub from a temporary `ci/*` branch).

This file holds shapes, signatures, tables, closed lists and exact markup. It holds no implementation code. Every value is
marked: **[M]** measured on the sketch of section 17 or read from a command (with the fact number), **[R]** required by the
requirement, a decision or the look, **[C]** computed from marked values, **[P]** proposed here with its reason. The sketch
lies outside the project; nothing under `app/`, `tools/` or `docs/` but this file and the handoff was written.

Rules of this PC that bind every run named here: no `npm run check`, no app check (`cd app && npm run …`), no tools test
script and no e2e test is run on this computer (the owner's rule); the checks run on GitHub on a temporary `ci/*` branch
(decisions/0110). So every statement below about the behaviour of a test that does not exist yet is **designed**, and every
statement about the page is **measured on a trial copy** (F11 – F16), never on the project's own tree.

---

## 0. Summary

One block, `section.info.now`, with the same markup and the same words in two places: on the demo result (inside a new
wrapper `div.r-side` that takes the grid area of the «Описать идею» panel, above that panel) and on `how.html` (between
the intro and the steps), built by `el()`/`textContent` in `demo.js` and written with `data-t` in `how.html`. Three rows, each
a mark (`span.stat`, `.on` for «Работает») and a title with its line; one closing paragraph (body text, no class). Beside
the block: the honest lead above the button (a changed value), no grey line under it (the key is removed), the label «Учтено
ответов» with one sentence inside `.rc-acc` (two keys: `demo_accuracy` changed, `demo_accuracy_note` new), and on `how.html`
the plan note, the stage marks (`p.stat-line` with `span.stat`, stage 1 with two `span.pair`) and the stage-1 note.

Product files (all FRONTEND-DEV, one owner, no backend, no server and no tool change): `app/public/shared/i18n/texts.js`
(13 keys added, 2 values changed, 1 key removed: 167 → 179 keys), `app/public/js/pages/demo.js`, `app/public/how.html`,
`app/public/css/site.css`. `landing.js`, `dom.js`, `theme.js`, `index.html`, `examples.html`, `gate.html`, `404.html`,
`office/`, `app/server/`, `app/content/`, `app/scripts/`, `app/vendored.json`, the package files, `.github/` and `tools/` are
not touched (4.6). Tests (TEST-DESIGNER, step 5): two files, `app/test/e2e/landing.test.js` (LD-3, LD-6, LD-9 and the helpers
of `readResult`; no new `test(`) and `app/test/unit/texts.test.js` (TX-4 rows and two new tests, TX-9 and TX-10). No fixture
file changes, so `git diff --stat base/… -- app/test tools/test` lists exactly those two files.

Build sub-steps: 9 (FRONTEND-DEV F1 – F5, TEST-DESIGNER T1 – T4; section 11). Existing tests that turn red from the product
change: none, by reading every assertion that touches these files and by the measurements of the trial (section 10); the
new tests are the ones that are red on the base (AP-071). Mutants: 52 (section 12), 10 of them applied on the trial.
Questions for ORCH: 11, plus the proposal of the record (section 15), each with a default.

---

## 1. Checked facts

All dates 2026-11-22. A fact is [M] unless marked otherwise. Commands that only read; nothing run in the project.

| # | Statement | How measured | Result |
|---|---|---|---|
| F1 | The tree the build starts from | `git rev-parse base/M1STATUS-20261122-02` → 4e9ef1e…; `git diff --stat e0a425b 4e9ef1e -- app` | no line: `app/` equals main e0a425b. The same command with `-- app tools .github` lists 20 files, all `tools/test/…`, `docs`, `handoffs` and one added line of `.github/workflows/check.yml`; `git diff --stat base/M1STATUS-20261122-01 base/M1STATUS-20261122-02 -- app tools .github` lists no line (so the commands of criteria 6, 9 and 13 that name the tag `…-01` give the same output as with `…-02`; question O9) |
| F2 | The base counts of the four test steps (the count rule of REQ-108 criterion 2) | `gh run list --workflow app.yml --limit 8 --json databaseId,conclusion,headSha,headBranch,event,createdAt`, then `gh run view 44919421105 --log` (read-only) | the last green `app.yml` run on main: 44919421105, push, sha e0a425b8a5574653ab694bbd92d4c6f298c4ed96, 2026-11-21T15:29:13Z, success, jobs e2e, pg, check, docker all success; `check.yml` run 44919421116 on the same sha: success. The log (lines of the whole-run log that `gh run view --log` prints) gives, per step: **unit `# tests 120`** (line 1602, the step `npm run test:unit` of the job `check`; `# pass 120`, `# fail 0`, `# skipped 0`, `# todo 0`), **int `# tests 47`** (line 1898, all 47 pass), **pg `# tests 4`** (line 631), **e2e `# tests 15`** (line 296; LD-1 … LD-9 and ST-1 … ST-6); cancelled 0 in every step. These agree with the as-built counts of section 19 of the landing design and with the copy in ISS-0128 (unit 120, int 47, e2e 15, pg 4), and are not taken from either. A count of the `test(` lines of the test folders at the tag by the pattern used here gives unit 120, int 46 (the runner counts 47: a loop in SC-2), pg 4, e2e 15; the runner's count is the one that holds |
| F3 | The texts module | read of `app/public/shared/i18n/texts.js`; a script that imports it | 167 keys, 45 with the prefix `order_`; `idea_panel_lead` line 528, `idea_panel_fine` 538, `demo_accuracy` 443, `demo_putting` 453; none of the 13 new keys exists; `demo_not_sure` en is «Not sure», `demo_k_of_n` ru «{k} из {n}» |
| F4 | The demo page script | read of `app/public/js/pages/demo.js` | `showResult` 947; the receipt row `.rc-acc` is built at 888 – 901 (label `demo_accuracy`, `div.prog` with `pips("pp", count, QUESTIONS)` and `span.pt` with `Math.floor(count)` at 896); `receiptCount` 447 – 451 (a string answer 1, anything else 0.5); the same `Math.floor(count)` also stands at 677 in the live strip, which stays; `section.idea` is built at 968 – 973 with `p.fine` (the key `idea_panel_fine`) at 972; the wrapper `div.wrap.res` at 989 holds `sum`, `idea`, `div.r-ans`; `fillReceipt` (832) removes every `.r-lines` of the wrapper and appends or inserts its own, and never touches another child; the language change rebuilds the whole result view (`setLang` → `show` → `showResult`) |
| F5 | `how.html` | read, with line numbers | intro `section.intro` 82 – 89; the steps section opens at 90 (a bare `<section>`), `ol.steps` is lines 91 – 134 (1788 bytes, sha256 `8a03a716ebbf3bda63ecc562747382cd1e9a8878fc647f9ab9dde20046941cb5`, taken from the tag's file with `git show base/M1STATUS-20261122-02:app/public/how.html` equal to the working file), `div.how-stages` 135 – 166 with `#stage-1` 136, `#stage-2` 143, `#stage-3` 151, `#stage-4` 159, `div.panels` 168 with order regions 177 – 190 and 296 – 300 |
| F6 | `landing.js` needs no change | read of `public/js/pages/landing.js` and `dom.js` 119 – 132 | `applyTexts` sets the text of every element that has `data-t` and is called at load and on every language change, so the static block, its marks and the notes follow the switch with no edit; `el()` (dom.js 36 – 60) takes `id` and `attrs`, refuses only `style` and `on…` names |
| F7 | The class name `now` is already used | `grep` of `app/public` and `app/test` | `site.css` 449 `.plate.now` (the current desk's label of the scene) and `office/labels.js` 217 toggles `now` on plates; no test and no rule selects a bare `.now`. The new rules are always scoped (`section.now`, `.info.now`, `.now .stat`); no new rule is written for `.now` alone (question O3) |
| F8 | The style sheet | read of `app/public/css/site.css` | `.idea { grid-area: panel }` 1353 – 1354; `.res` grid and its areas 1267 – 1283, one column at ≤ 1000 px 1610 – 1627; `.rl li` 1407, `.rn` 1415, `.rn small` 1425; `.how-stages p, .how-stages ul { margin-top: 8px }` 810; `.blocks > * + * { margin-top: 36px }` 767; phone: `.res { gap: 18px }` 1847, `.idea, .info { padding: 16px 14px }` 1851; no rule or class named `.stat`, `.stat-line`, `.pair` or `.r-side` exists |
| F9 | The engine's answer for the new pass | a read-only script that imports `app/server/vendor/picker-engine.js` and `app/content/sai-intake.json` | fixture `landing` whole: `landing` 9, `card-site` 6, clear leader; **without the answer `storage` (the question skipped): `landing` 8, `card-site` 5, clear leader, a recommended solution**; all five skipped: the no-match text. Each other fixture with one answer dropped still gives a recommended solution except where the dropped answer is the one that decides (`server-needed` with `goal` dropped gives none) |
| F10 | The values meet the rules | a script that imports `app/scripts/word-lists.js` (`lintText`, all six lists) and `app/public/shared/text-rules.js` (`textProblem`) | every one of the 45 values (15 keys × ru, kk, en) of section 4.1: no finding, no problem; longest phrase 15 words (the kk lead; the ru lead has 14); no digit in any value; none of the closed whole words of criterion 2 (ru контакт … регистрацию, en contact … waitlist; whole-word compare with borders of Unicode letters and digits); no value of ru or en equals an `order_` value of any language; the ru/en values of the 15 keys equal, character for character, the values written in `docs/requirements.yaml` (REQ-113) and in the look 7.22 (30 of 30 found, whitespace folded). The first kk draft of `now_closing` held «күні» (list Ц); the draft of 4.1 uses «датасы» |
| F11 | The design applied to a trial copy | a copy of `app/` in `<scratch>/design113/trial/app`; the four files changed by the scripts of the sketch; `prettier 3.9.9` (the version of `app/package.json`, found in `tools/node_modules`) run on the copy | texts.js has 179 keys (167 + 13 − 1) and no `idea_panel_fine`; the four trial files pass `prettier --check`; the exact `how.html` markup of 4.3 is prettier's own output |
| F12 | `how.html` in real Chrome on the trial copy | a no-dependency static server for the copy (the app's own server cannot start here, F17), Chrome headless in an iframe of the window's exact size, the project's own `layoutFindingsIn` function copied as text into the page (the oracle of `layoutFindings`: scroll, cut text, contrast 4.5:1, controls 44 px, overlap, covered), the data-theme set to light or dark | 5 windows (1470×784, 390×844, 320×568, 360×800, 380×800) × 2 themes × 3 languages = 30 loads: **0 findings in all 30**, no horizontal scroll, the block's top edge: **557 px at 390×844** (inside the first screen; the look estimated 560 – 600), 550 at 320×568, 543 – 566 at 360×800, 545 at 380×800, 662 – 688 at 1470×784; the block's width 640 px from 760 px up (358 at 390, 292 at 320); the closing paragraph and both notes 16 px with the computed colour of `body` in all 30 loads; the marks' `innerText` equals their text (no capitals) |
| F13 | The result in real Chrome on the trial copy | the same, answering the demo by script: a fixture (`landing`), one «Не знаю» on `storage`, and five «Не знаю» | 5 windows × 2 themes × 3 languages × 3 passes = 90 loads: **0 findings in all 90**; the block above the panel in all 90 (`bottom ≤ idea.top`); `.rc-acc` is 1 on the 60 recommended results and 0 on the 30 no-match ones; `p.fine` 0 in all 90; the block holds no `a`, `button`, `input`, `select`, `textarea`, `form` in all 90; `.r-sum + .r-lines` true on the 30 no-match results; the first link after the block is `/how.html#describe-idea`; the first-link and list facts of LD-6 hold. At 1470 the panel area `r-side` stands right of the receipt (left 905 ≥ the receipt's right 865) with the receipt's top (491 = 491), height **631 px** (ru) and 695 (kk; the look estimated about 700), the block 386 px high in a 422 px content width; the left column is about 1500 px, so the rows are not stretched. At 390 the block is 497 px high (516 at 320), on a recommended result it starts at 740 (receipt 351 – 720, panel at 1260), on no match at 1271, under the fixed list (650 – 1251). At ≤ 1000 px the order of the tops is receipt, `r-side`, answers, lists (recommended) and receipt, lists, `r-side`, answers (no match) in all 72 narrow loads |
| F14 | The count text and the pips | the same loads | five fixture answers: pips `on,on,on,on,on`, text «5 из 5» (en «5 of 5», kk «5 / 5»); four answers and one «Не знаю» (`storage`): **pips `on,on,on,on,half` and «4 из 5»** (en «4 of 5», kk «4 / 5») in all 30 loads; the label reads «Учтено ответов» / «Answers counted» / «Ескерілген жауаптар», the sentence is the one `p` in `.rc-acc`, 14 px, computed colour rgb(98, 86, 74) in the light theme (`--rc2`; the oracle's contrast finding is 0 in dark as well) |
| F15 | The same markup in the two places | the skeleton of `.now` (tag, `id`, `class`, `aria-labelledby`, children; text and `data-t` left out) read on `how.html` and on a result | the two strings are byte equal: `<section aria-labelledby=now-title,class=info now><h3 id=now-title></><ul class=rl><li><span class=stat on></><span class=rn><b></><small></></></><li><span class=stat></><span class=rn><b></><small></></></><li><span class=stat></><span class=rn><b></><small></></></></><p></></>` (the closer `</>` ends any element); this string is the constant `NOW_SKELETON` of 9 |
| F16 | The language switch on a result | on the trial, a click on `[data-lang]` after a result in ru → en, en → kk, kk → ru | the block, the lead, the label, the sentence, the marks and the count text are all in the new language, the pips unchanged (`on,on,on,on,half`), 0 findings |
| F17 | The app cannot start on this PC | `ls app/node_modules` → no such folder; `app/package.json` dependencies `@hono/node-server`, `hono`; `server/node-main.js` line 2 imports `@hono/node-server` | `node app/server/node-main.js` (decisions/0125 item 7) needs `npm ci` first; a fresh clone with `npm ci` (network) is the way for step 8; question O8 |
| F18 | `how.html` static text equals the module for every key at the base | a depth-aware read of every `<tag … data-t="key">…</tag>` in the five pages, compared with the ru value, whitespace folded | how.html 58 elements, index 52, demo 17, examples 62, 404 16: **0 mismatches** (a first, regex-only read gave a false mismatch for the skip link; a tolerant balanced-tag read is the oracle of TX-10) |
| F19 | The data-t keys of the trial `how.html` | the same read | 78 elements (58 + 20): `now_title` 1, `now_demo_t` 2, `now_demo_s` 1, `now_idea_t` 2, `now_idea_s` 1, `now_build_t` 1, `now_build_s` 1, `stat_on` 2, `stat_off` 6, `now_closing` 1, `how_plan_note` 1, `how_stage_1_note` 1, `demo_accuracy_note` 0 (the sentence lives on the result only) |
| F20 | No hunk inside `ol.steps` | `diff` of the trial `how.html` against the base file | the insertions come after base lines 89, 90 (before the `<ol>` at 91), 137, 144, 152 and 160 (all between `h2` and the stage text); no hunk touches lines 91 – 134; the sha256 of the `ol.steps` text of the trial equals F5's |
| F21 | The public-build rules on the new content | the leak rule of PB-1 replayed on the trial: the set of all `order_` values (3 languages) and all kk-only values of the module, minus the kept ru/en values, searched as whole words, case-insensitive, in the trial `how.html`, `demo.js`, `site.css` and in the 30 ru and en values | 240 leak values; the new ru and en values and the new code hold none; the only four hits are the order-region texts of `how.html` (lines 177 – 190, 296 – 300), which the open build cuts |
| F22 | Mutants applied on the trial (section 12) | one CSS or script edit at a time in the trial copy, the file restored from its saved text | M07 (the lint only), M14, M19 – M23, M28 – M30 measured; the result of each is in its row |
| F23 | The tests that read the changed files | `grep -rn` of `app/test` and `tools/test` for `idea_panel_fine`, `idea_panel_lead`, `demo_accuracy`, `Точность`, `accuracy`, `.idea`, `fine`, `r-lines`, `rc-acc`, `.info`, `how-stages`, `.panels`, `children`, `data-step`, `how.html`, `app/public` | the rows of section 10; no file of `tools/test` or `tools/src` reads `app/` |
| F24 | The statements of the requirement's guard table at the tag | read of each cited line | all current: `readResult` 942, LD-6 977 – 1262, LD-3 251 – 361, LD-9 1684 – 1913 with `if (win === WINDOWS[0])` at 1840 and the call at 1841, LD-1 89, TX-2 129, TX-3 138, TX-4 171, TX-5 283, `.rc-acc` count at 961, 1122 and 1148 |
| F25 | CI time of the tests that grow | the job log of run 44919421105 | LD-3 5.2 s (timeout 180 s), LD-6 21.6 s (480 s), LD-9 19.2 s (300 s), LD-1 64.8 s, whole e2e step about 478 s; the growth of section 9 (about 8 s, 35 s and 10 s [C]) stays far inside the timeouts, so no timeout is changed |

**Not measured, and why.** The new assertions themselves (no e2e test, no unit test is run on this PC); `tsc`, `eslint` and the whole check chain (the owner's rule; they run on GitHub); the real server's headers (the trial server sends none: the block holds no inline style and no inline script, so no CSP violation is expected, and LD-1, LD-3, LD-6 and ST-6 read the violations on the real server); a browser other than Chrome; the Kazakh text by a reader (FOR_NATIVE_SPEAKER).

---

## 2. Choices that could be disputed

| # | Choice | Options | Taken, and why |
|---|---|---|---|
| C1 | The rows of the block in `demo.js` | keys built from a part name (`now_${part}_t`) / a closed list of literal key names | a closed constant `NOW_ROWS` of three `{ title, line, on }` with the key names written in full (4.4): the key names then stand as quoted strings in `app/public/js`, which is what the validator's «used by a `t(` call or a `data-t`» script and the unit row of 9 read; the template form would hide them |
| C2 | The sentence of the receipt | a class `rc-note` / the bare `p` inside `.rc-acc` | the bare `p` (`.rc-acc p`): the look names no class for it, and the rule cannot reach another element (no other `p` stands in `.rc-acc`) |
| C3 | The marks of a stage on `how.html` | `p.stat-line` / `div.stat-line` | `p.stat-line`: it takes the 8 px of `.how-stages p` with no new rule, as the look says (7.22) |
| C4 | The label of the block | none / `aria-labelledby` with `id="now-title"` | `section` labelled by its `h3` (look 7.22); one block per page, so the id is unique (the live result view is replaced, never doubled: `put()` replaces the old wrapper) |
| C5 | The new tests | rows only in TX-4 / two new unit tests | TX-4 gains the exact values and the key facts (criterion 1); two new tests, TX-9 (the lint of the 45 values, criterion 2) and TX-10 (the static `how.html`, criterion 6), so that each criterion has a test of its own name and a mutant can be told apart; unit 120 → 122. No new e2e `test(`: LD-3, LD-6 and LD-9 are extended, the new pass of LD-6 is one more element of its `passes` list, so e2e stays 15 |
| C6 | Static equality in TX-10 | only the new keys (the criterion) / every `data-t` element of `how.html` | every element of `how.html`: it holds at the base for all of them (F18), and it is the stronger guard; the new keys are named separately so that the row is red on the base (they are absent there) |
| C7 | The pin of `ol.steps` | none (the validator's `git diff -U0` only) / the sha256 of the element's text in TX-10 | pinned (F5): a repo test, not only a release command, so a developer or a fixer cannot touch the buttons unseen; it must be updated by the requirement that changes the steps |
| C8 | Where the failure-path assertions of the demo go | LD-7 / a closing part of LD-6 | LD-6: the requirement keeps LD-7 «no edit» (its guard row 9); a closing part of LD-6 (held request, 500, refused connection, failed questionnaire) reads the block in those states |
| C9 | Helpers of the new assertions | `fixtures/e2e-kit.js`, `page-checks.js` / inside `landing.test.js` | inside `landing.test.js`: the guard `git diff --stat … -- app/test tools/test` then lists only the two files the requirement names |
| C10 | `.r-side` and the grid | explicit `grid-area: panel` / none | explicit: the wrapper stands in the area the panel stood in. Measured (F22, M23): without it auto-placement puts the wrapper into the same empty cell at every width, so the rule is for the reader of the CSS and cannot be caught by a geometry test |
| C11 | `how_plan_note` | a `p.fine` as the review proposed / a plain `p` | plain `p`, first element of the section that holds the steps, above `ol.steps` (look 8.2 H2; criterion 6 forbids `fine` and `meta` and asks 16 px in the colour of `body`) |
| C12 | The kk values | left to the coding role / proposed here | proposed here as measured drafts (4.1); the coding role may write others if they pass section 9's lint; none is fixed by this design (the requirement: drafts, ISS-0127) |

---

## 3. Files, owners, order

| File | Change | Who | Sub-step |
|---|---|---|---|
| `app/public/shared/i18n/texts.js` | +13 keys, 2 values changed, `idea_panel_fine` removed (4.1) | FRONTEND-DEV | F1, F4 |
| `app/public/css/site.css` | the rules of 4.5; `.idea` loses `grid-area` | FRONTEND-DEV | F2, F3 |
| `app/public/js/pages/demo.js` | `NOW_ROWS`, the block builder, the wrapper, the lead, the sentence, no fine line (4.4) | FRONTEND-DEV | F3 |
| `app/public/how.html` | the block, the plan note, the stage marks, the stage-1 note (4.3) | FRONTEND-DEV | F5 |
| `app/test/unit/texts.test.js` | TX-4 rows, TX-9, TX-10 | TEST-DESIGNER | T1 |
| `app/test/e2e/landing.test.js` | LD-3, LD-6, LD-9 and `readResult` (9) | TEST-DESIGNER | T2, T3, T4 |
| `docs/design/V1-public-look.md` | D20, the map row, the 7.12 label line (14) | per question O5 | — |

Order: first the shared contract (the texts, F1), then the rules the pages use (F2), then the two pages (F3, F5); the key
`idea_panel_fine` is removed only after no page uses it (F4). The file `landing.js` is read, not changed (F6). One developer
writes all four product files, so no file has two writers; TEST-DESIGNER writes the two test files after the product passes
steps 3 and 4 (WF-02).

---

## 4. Interfaces

### 4.1 The texts module — `app/public/shared/i18n/texts.js`

The shape of an entry is unchanged: `key: Object.freeze({ ru, kk, en })`, all three non-empty strings, the same placeholders
(none of these keys has one). The new keys go together in one group, after `idea_panel_fine`'s place and before
`demo_needs_js` [P; the module's groups are by topic, and the order of keys is free]. No new key starts with `order_`; the 45
order keys of TX-5 stay.

| Key | Status | ru [R] | en [R] | kk draft [P, measured F10] | Used by |
|---|---|---|---|---|---|
| `now_title` | new | Что работает сейчас | What works now | Қазір не жұмыс істейді | `h3` of the block (both places) |
| `now_demo_t` | new | Демо-опрос | Demo survey | Демо-сауалнама | row 1 title; stage-1 pair name |
| `now_demo_s` | new | Пять вопросов и подсказка, какой вид продукта вам подойдёт. | Five questions and a hint at which kind of product fits you. | Бес сұрақ және қандай өнім түрі сізге сәйкес келетіні туралы кеңес. | row 1 line |
| `now_idea_t` | new | Опрос по вашей идее и ТЗ | Interview and requirements | Идеяңыз бойынша сауалнама және ТТ | row 2 title; stage-1 pair name |
| `now_idea_s` | new | ИИ-аналитик задаёт вопросы и пишет ТЗ. | The AI analyst asks questions and writes the requirements. | ЖИ-талдаушы сұрақтар қояды және ТТ жазады. | row 2 line |
| `now_build_t` | new | Сборка и результат | Build and result | Құрастыру және нәтиже | row 3 title |
| `now_build_s` | new | Разработчик собирает продукт, вы принимаете работу. | The developer builds the product and you accept the work. | Әзірлеуші өнімді құрастырады, сіз жұмысты қабылдайсыз. | row 3 line |
| `stat_on` | new | Работает | Works | Жұмыс істейді | the mark of row 1; the mark before the first stage-1 name |
| `stat_off` | new | Пока нет | Not yet | Әзірге жоқ | the marks of rows 2, 3; the second stage-1 mark; the marks of stages 2 – 4 |
| `now_closing` | new | Даты запуска пока нет. Описать идею смогут только приглашённые участники. Готовый продукт посетителям пока не выдаётся. | No launch date is set yet. Only invited participants will be able to describe an idea. Finished products are not handed out to visitors yet. | Іске қосу датасы әзірге жоқ. Идеяны тек шақырылған қатысушылар сипаттай алады. Дайын өнім келушілерге әзірге берілмейді. | closing paragraph |
| `how_plan_note` | new | Ниже описано, как работа будет устроена, когда этапы запустятся. | Below is how the work will go once the stages start. | Төменде кезеңдер басталғанда жұмыс қалай өтетіні сипатталған. | `how.html` only |
| `how_stage_1_note` | new, name given by the look and confirmed here | Название этапа описывает будущий проект. Заказы сейчас не принимаются. | The stage name describes a future project. Orders are not accepted now. | Кезеңнің атауы болашақ жобаны сипаттайды. Тапсырыстар қазір қабылданбайды. | `how.html`, stage 1 |
| `demo_accuracy_note` | new, name given by the look and confirmed here | Чем больше ответов, тем надёжнее подсказка. «Не знаю» считается за половину. | The more answers, the surer the hint. “Not sure” counts as half. | Жауап неғұрлым көп болса, кеңес соғұрлым сенімді. «Білмеймін» жарты болып саналады. | the receipt's `.rc-acc` on a recommended result |
| `idea_panel_lead` | value changed | Сейчас идею описать в Sai нельзя: по кнопке откроется подсказка, как о ней рассказать. | You cannot send an idea yet. The button opens tips on how to describe it. | Қазір Sai-да идеяны сипаттау мүмкін емес: түймені басқанда оны қалай айту керегі туралы кеңес ашылады. | the panel's `p.sub` |
| `demo_accuracy` | value changed | Учтено ответов | Answers counted | Ескерілген жауаптар (was «Таңдау дәлдігі») | the receipt's `.lbl` |
| `idea_panel_fine` | **removed** | — | — | — | nothing after F3 |

The ru and en values equal the requirement's (F10). The kk values are drafts: each passes `lintText` (kk lists), has no
digit and at most 18 words per phrase; the word in `now_closing` is «датасы» because «күні» is in list Ц (a kk draft of
the first version failed on it; measured). The readers (WF-02 step 8 item 6, criterion 2) go through ru → en and ru → kk in
two rounds; a kk line that stays disputed is `FOR_NATIVE_SPEAKER` (AP-114) and kk stays hidden on production (G9).

Counts [M, F3, F11]: keys 167 → 179; `order_` keys 45 → 45; added keys **13** (11 + the two named here); changed values 2;
removed 1. The key `idea_panel_title` (the panel's h3) and `describe_idea` («Описать идею», kk «Идеяны сипаттау», en
«Describe your idea») are unchanged.

### 4.2 The block — one markup, two places

The tree (a shape; the same in both places; text comes from the key in the right column):

```
section.info.now  [aria-labelledby="now-title"]
  h3#now-title                       now_title
  ul.rl
    li                               (row 1)
      span.stat.on                   stat_on
      span.rn
        b                            now_demo_t
        small                        now_demo_s
    li                               (row 2)
      span.stat                      stat_off
      span.rn  >  b now_idea_t, small now_idea_s
    li                               (row 3)
      span.stat                      stat_off
      span.rn  >  b now_build_t, small now_build_s
  p                                  now_closing      (no class)
```

Rules [R look 7.22, REQ-113 criteria 3 and 6]: the block holds no `a`, `button`, `input`, `select`, `textarea` or `form`;
the DOM order of a row is the mark first, then the title and the line (a screen reader says the status first); the closing
paragraph has no class, so it is body text (16 px, `--ink`); the h3 labels the section. On `how.html` every text element has
`data-t` with its key and holds the ru value as its static text; in `demo.js` every text is set with `textContent` (through
`el()`'s `text`) from `t(key)`.

The skeleton constant `NOW_SKELETON` (F15) is the oracle of both places. Its function, written in the tests (not imported),
serializes an element as: `<`, the tag, then (if the element has attributes other than `data-t`) a space and the attributes
sorted by name as `name=value` joined by `,`, then `>`, then the serialization of the children in order, then `</>`; text
nodes and `data-t` are left out. The value is the string of F15. The same function is used on `how.html` (LD-3, TX-10, by a
source parse) and on the result (LD-6).

### 4.3 `app/public/how.html`

Four insertions; nothing else in the file changes, and `ol.steps` (base lines 91 – 134) stays byte for byte (F5, F20). The
markup below is prettier 3.9.9's own output (F11); the developer pastes it as it stands, because `prettier --check .` is a
step of the check chain and this PC cannot run it (F11).

1. **The block**, a direct child of `div.wrap.blocks`, after the closing `</section>` of `section.intro` (base line 89) and
   before the bare `<section>` that opens the steps (base line 90):

```html
        <section class="info now" aria-labelledby="now-title">
          <h3 id="now-title" data-t="now_title">Что работает сейчас</h3>
          <ul class="rl">
            <li>
              <span class="stat on" data-t="stat_on">Работает</span>
              <span class="rn"
                ><b data-t="now_demo_t">Демо-опрос</b
                ><small data-t="now_demo_s"
                  >Пять вопросов и подсказка, какой вид продукта вам
                  подойдёт.</small
                ></span
              >
            </li>
            <li>
              <span class="stat" data-t="stat_off">Пока нет</span>
              <span class="rn"
                ><b data-t="now_idea_t">Опрос по вашей идее и ТЗ</b
                ><small data-t="now_idea_s"
                  >ИИ-аналитик задаёт вопросы и пишет ТЗ.</small
                ></span
              >
            </li>
            <li>
              <span class="stat" data-t="stat_off">Пока нет</span>
              <span class="rn"
                ><b data-t="now_build_t">Сборка и результат</b
                ><small data-t="now_build_s"
                  >Разработчик собирает продукт, вы принимаете работу.</small
                ></span
              >
            </li>
          </ul>
          <p data-t="now_closing">
            Даты запуска пока нет. Описать идею смогут только приглашённые
            участники. Готовый продукт посетителям пока не выдаётся.
          </p>
        </section>
```

2. **The plan note**, the first element of the steps section, directly after its opening `<section>` (base line 90) and
   before `<ol class="steps">`:

```html
          <p data-t="how_plan_note">
            Ниже описано, как работа будет устроена, когда этапы запустятся.
          </p>
```

3. **The marks of stage 1**, between the `h2` of `#stage-1` and its text paragraph, then the note:

```html
              <p class="stat-line">
                <span class="pair"
                  ><span class="stat on" data-t="stat_on">Работает</span
                  ><span data-t="now_demo_t">Демо-опрос</span></span
                >
                <span class="pair"
                  ><span class="stat" data-t="stat_off">Пока нет</span
                  ><span data-t="now_idea_t"
                    >Опрос по вашей идее и ТЗ</span
                  ></span
                >
              </p>
              <p data-t="how_stage_1_note">
                Название этапа описывает будущий проект. Заказы сейчас не
                принимаются.
              </p>
```

4. **The mark of each of stages 2, 3 and 4**, between the `h2` and the text paragraph:

```html
              <p class="stat-line">
                <span class="stat" data-t="stat_off">Пока нет</span>
              </p>
```

Facts of the result [M, F12, F19, F20]: 78 `data-t` elements (was 58); the key counts of F19; the children of each `#stage-N`
in order are `h2`, `p.stat-line`, (stage 1 only `p` note), `p[data-t=how_stage_N_text]`; the block is outside `div.panels`
and outside both `<!-- sai:order -->` regions; no new element holds an `id` but `#now-title`; no new text sits inside a
`button`, `ol.steps` or the scene. The stage names beside the stage-1 marks are body text (16 px, `--ink`), not grey (look 7.22).
The elements `button[data-step]` carry no mark and no note.

### 4.4 `app/public/js/pages/demo.js`

No new export and no new module. Inside `mountSurvey` (where `t`, `el`, `lang` live):

| Name | Kind | Shape | Rule |
|---|---|---|---|
| `NOW_ROWS` | module constant, frozen | `ReadonlyArray<{ title: string, line: string, on: boolean }>` = `{ title: "now_demo_t", line: "now_demo_s", on: true }`, `{ "now_idea_t", "now_idea_s", false }`, `{ "now_build_t", "now_build_s", false }` | the key names are written in full (C1); three rows in this order |
| `statusBlock()` | function in `mountSurvey`, no parameter | returns the `HTMLElement` of 4.2, built with `el()`; the mark of a row has class `stat on` when `on`, `stat` otherwise, text `t("stat_on")` / `t("stat_off")` | reads no state but `lang` through `t`; no request, no storage, no timer; text only through `el`'s `text` (CSP rules, 6) |
| `showResult` | changed | builds `side = el("div", { cls: "r-side" }, [statusBlock(), idea])` and the wrapper `div.wrap.res` as `[sum, side, div.r-ans]` | the block is built with the view, from the first frame of the result view (before any answer of the result request); the block is not a child of `.r-lines` and is never touched by `fillReceipt` |
| the idea panel in `showResult` | changed | children: `h3` (`idea_panel_title`), `p.sub` (`idea_panel_lead`), `a.btn.big` (`describe_idea`, `href="/how.html#describe-idea"`); **no `p.fine`** | the label, the address and the class of the link are unchanged |
| the receipt row in `fillReceipt` | changed | `div.rc-acc` children in order: `span.lbl` (`demo_accuracy`), `div.prog` (pips, `span.pt` with `demo_k_of_n`), **`p` with `demo_accuracy_note`** | the pips, `Math.floor(count)` (line 896) and `receiptCount` are unchanged; on no match there is no `.rc-acc`, so no sentence |

Not changed in `demo.js`: `receiptCount`, `stripCount`, both `Math.floor(count)` (the receipt's 896 and the strip's 677),
`notBuilt`, `list`, `askResult`, `put`, `setLang`, the question screens. The block is built again with every `showResult`
(a language switch, a retry that rebuilds the view); a retry of the result request only calls `askResult` and `fillReceipt`
and does not rebuild the block. The receipt keeps showing «4 из 5» for 4.5 answers (decisions/0125 item 5; question O4).

### 4.5 `app/public/css/site.css`

Only tokens that exist (`--card`, `--ink`, `--ink2`, `--btn`, `--onbtn`, `--rc2`); no literal colour, no new token, so TC-3
and TC-4 are not touched. Rules to add or change [R look 7.22, 7.15; measured on the trial, F12 – F14]:

| Selector | Declarations | Note |
|---|---|---|
| `.stat` | `display: inline-flex; align-items: center; flex: none; min-height: 24px; padding: 3px 8px; font-size: 13px; font-weight: 800; line-height: 1.2; letter-spacing: 0.02em; white-space: nowrap; background: transparent; color: var(--ink2); box-shadow: inset 0 0 0 2px var(--ink2)` | no `text-transform` (the word the eye reads is the word a script reads); not a control: no hover, no 44 px rule |
| `.stat.on` | `background: var(--btn); color: var(--onbtn); box-shadow: inset 0 0 0 2px var(--ink)` | |
| `.now .stat` | `order: 2; align-self: flex-start; margin-top: 2px` | from 480 px up the mark stands right of the title (the DOM order is not changed) |
| `@media (max-width: 479px)` `.now .rl li` | `flex-direction: column; align-items: flex-start; gap: 8px` | below 480 px the mark is above the title |
| `@media (max-width: 479px)` `.now .stat` | `order: 0; margin-top: 0` | |
| `@media (min-width: 760px)` `body[data-page="how"] .now` | `max-width: 640px` | the block is the full width below 760 px |
| `.stat-line` | `display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px` | its top space is the 8 px of `.how-stages p` |
| `.pair` | `display: inline-flex; align-items: center; gap: 8px` | |
| `.r-side` | `grid-area: panel; display: flex; flex-direction: column; gap: 22px` (gap 18 below 760: added to the phone rule `.res`) | takes the grid area that `.idea` had |
| `.idea` | the declaration `grid-area: panel` is **removed**; the rest (flex column, gap 6, padding, `--card`) stays | |
| `.rc-acc p` | `margin-top: 6px; font-size: 14px; line-height: 1.3; color: var(--rc2)` | `--rc2` on the cream `--rc` (6.6); `--ink2` there is 1.91:1 in dark |

A comment in the sheet names the look as «the look 7.22», like the existing comments, and holds none of the words of the
check-public ban (6). Measured contrast of the pairs: `.stat` text on `--card` 6.71 / 6.31 and on `--paper` 6.39 / 7.77,
`.stat.on` text 5.02 / 5.84 [R look 6.3, 7.22]; the layout oracle gave 0 findings on all 120 loads (F12, F13).

### 4.6 What is not changed

`app/public/js/pages/landing.js`, `js/dom.js`, `js/theme.js`, `index.html`, `examples.html`, `gate.html`, `404.html`,
`demo.html`, `office/`, `shared/text-rules.js`, `shared/i18n/lang.js`, `app/server/`, `app/content/`, `app/scripts/`
(the word lists stay closed: no form is added), `app/vendored.json`, `app/package.json`, `app/package-lock.json`,
`.github/` and `tools/` [R REQ-113 «Files»]. `demo.html` is not in the requirement's «not changed» list but needs no change:
the result is built by the script and the page has no static copy of the block [F6].

---

## 5. Failure paths — what the visitor sees, what stays unchanged

| # | Situation | What the visitor sees | What stays unchanged | Test |
|---|---|---|---|---|
| 1 | The language is changed on `how.html` | the heading, the three rows, the marks, the closing paragraph, `how_plan_note`, the stage marks and names, `how_stage_1_note` in the new language, no Russian left in en; no reload | `?lang=` and `sai-lang` as before; the stage buttons and the scene; the page is not scrolled | LD-3 (new part) |
| 2 | The language is changed on a result | the questionnaire is asked in the new language; then the result view is built again: the block, the lead, the label, the sentence, the count text in the new language, the answers (pips, chips) kept; while the new questionnaire is loading the result view is not on screen (an empty place, after 300 ms the loading line), so no block of the old language stays | the answers, the scene, the stored language | LD-6 (new part) |
| 3 | The no-match result (five «Не знаю») | the same block; no accuracy row and no sentence (`.rc-acc` is 0); the receipt holds only the no-match text; right under it the fixed list; at ≥ 1000 px `r-side` at the right, at ≤ 1000 px the block stands **under the fixed list** and above the button (question O1) | `.r-sum + .r-lines`, the list's ten items, the idea link | LD-6 |
| 4 | The result request fails (500, a body that is not JSON, refused, no connection, never answering) | the receipt holds the failure block with «Повторить»; **the status block and the panel stand as they did**; «Повторить» asks again and fills the receipt, the block is not rebuilt | the answers, the chips, the console only with the declared lines | LD-6 closing part (500 and refused connection); LD-7 unchanged |
| 5 | The result request is still pending | the block stands from the first frame of the result view, the receipt holds the loading line | — | LD-6 closing part (a held request) |
| 6 | The questionnaire request fails (at load or after a language switch) | the question panel holds the failure block, as before; **no result view and no status block** (the block belongs to the result only) | the retry and the link to the landing | LD-6 closing part; LD-7 unchanged |
| 7 | `localStorage` throws on read and write | the block is static on `how.html` and built from the module on the result; the language is Russian (`currentLang` reads inside `try`); the language button works; nothing is written | `sai-lang`, `sai-theme` untouched | LD-3 (new part: a page whose `Storage.prototype.getItem` and `setItem` throw) |
| 8 | Script is off on `how.html` | the static Russian block, marks and notes are there and equal the module's ru values; the scene is replaced by its text view (`noscript.css` hides only `.stage` and `#demo`) | the stage buttons do nothing, as before | TX-10 (text), ST-5 (layout, contrast, no change), LD-3 (new part: a page with `javaScript: false`) |
| 9 | The canvas cannot draw | the text view of the scene; the block is unaffected | — | ST-5 (no edit) |
| 10 | The public build (G8 «б», G9) | ru and en only; the block, the marks, the notes and the sentence are shown; no `order_` key; `?lang=kk` shows Russian | the output's texts module without kk values | LD-9, PB-1 |
| 11 | The local server in kk | the kk drafts are shown with the footer's note; kk is not on production | — | LD-3, LD-6 (kk) |
| 12 | A very long text in a language (kk at 320) | rows wrap at spaces; the mark never shrinks (`flex: none`); no cut, no inner scroll | — | LD-6 layout pass; F12 (kk at 320 measured) |
| 13 | The engine's data change so that the pass «landing with Не знаю on storage» has no recommended solution | the pass fails with its message and is replaced by another recommended pass, never dropped (criterion 5) | — | LD-6 |
| 14 | 4.5 answers counted | «4 из 5» with four full pips and one half pip, and the sentence says why; the number understates, never overstates | decisions/0125 item 5 | LD-6 (k 4) |
| 15 | The marks as a status | the marks say which parts of the site exist; they are on no scene and take no scene parameter (REQ-112 criterion 9, decisions/0125 item 2) | `stage-scene.js` and `office/` untouched | `office-*` tests, ST-* (no edit) |

---

## 6. CSP and markup rules (one list for the developer, the reviewers and the tests)

- No `style` attribute, no `on…` attribute, no `<style>`, no `http://`, no `innerHTML`, `outerHTML`, `insertAdjacentHTML`
  anywhere in `app/public` (`check-public`, REQ-111 criterion 10). The block is built with `el()`; it sets only `class`, `id`,
  `aria-labelledby` and text, and `el()` throws on a `style` or `on…` name (CP-3, no change).
- No word of the ban in any file of `app/public`, comments included: `handoff`, `handoffs`, `orch`, `decisions` (whole words,
  any case), a requirement number (`REQ-` and a digit). The CSS comment of 4.5 and the comments of `demo.js` say «the look
  7.22», never a requirement or decision number.
- Visible text and attribute values of every page and every value of the texts module go through lists Г, Б, В, П, Ц, С in the
  value's own language and the bans of REQ-109 criterion 7 (`check-public`; the lint of the shown text in the browser tests,
  `shownTextFindings`, which reads the whole `innerText` of the page in its language). All 45 values pass (F10); the whole
  `how.html` text passes in ru.
- At most 18 words per phrase (`textProblem`), no ты-form, no digit in these values.
- `how.html` text elements carry `data-t`; the static Russian text is the ru value (TX-10).
- Nothing is stored: no `localStorage` key is added (LD-8, no edit, reads the keys after a whole pass).

---

## 7. The public set (G8 «б», G9)

The block, the marks, the notes, the sentence and the lead are no order texts: none of the 13 new keys starts with `order_`,
none stands in a `<!-- sai:order -->` or `<!-- sai:kk -->` region, and no `order_` key is used by them. Consequences,
each checked:

- The open build (`vercel-build.js` with `public-set.js`) keeps the block, so `how.html` of the output differs from its source
  by exactly the lines of its regions, as before: PB-2 (no edit). The new content holds no `id` inside a region and adds no
  marker: PB-6 (no edit). With the gates open the output is byte-equal: PB-7 (no edit).
- PB-1's leak rule on the new content: 0 hits (F21). The kk drafts are kk-only values; none of them occurs as a whole word
  in any ru or en value or any file of the output (replayed on the trial).
- The output's texts module keeps the 15 keys with their ru and en values and no kk value; `?lang=kk` shows Russian; the
  languages are exactly ru and en: LD-9 (new assertions, 9).
- `idea_panel_fine` is removed from the source module, so the output cannot hold it; before F4 it is an ordinary kept key.
- The source's `how.html` still holds order regions; `leakFindings` reads the built folder, not the source.

---

## 8. Criterion → test

The red-on-base plan of each row is in the last column: a new assertion that reads something absent on the base is red there
by itself (AP-071); where a row guards a thing that holds on the base, it is a guard and the mutants of section 12 are
its proof of life. Test names stay byte for byte (Q6). The count rule is in section 16.

| REQ-113 criterion | Design element | Test or command (fails when the criterion is violated) | Red on the base because / mutants |
|---|---|---|---|
| 1 Words and keys | 4.1 | `unit/texts.test.js` **TX-4** (rows: the 15 keys' exact ru and en; the kk of `demo_accuracy` ≠ «Таңдау дәлдігі»; `idea_panel_fine` absent from the module and from every text file of `app/public` and `app/test`; no new key with `order_`), TX-2 (reads every key: three non-empty strings, same placeholders), TX-5 (no edit: the 45 order keys) | the 13 keys are absent, the two values differ, the removed key is present: M01 – M06 |
| 2 Forbidden words, length | 4.1, 6 | `unit/texts.test.js` **TX-9** (45 values: `lintText` empty, `textProblem` null, no digit, none of the closed whole words in ru and en); `cd app && node scripts/check-public.js` (a step of the check chain; CP-1 asserts it on the real files); the lint of the shown text in LD-3, LD-6, LD-9; the readers of step 8 | the 13 values are absent on the base, so TX-9's loop over the 15 keys fails at the first missing key: M04, M07 – M10 |
| 3 The block on the result | 4.2, 4.4, 4.5 | `e2e/landing.test.js` **LD-6** (`readResult` extended; every fixture, the new pass, five «Не знаю»; ru, en, kk) | `#demo .now` is 0 on the base: M11 – M18, M25 |
| 4 The idea panel | 4.4 | LD-6 (the panel's children; `.fine` count 0); the grep of criterion 4 is TX-4's file scan | `.fine` is 1 and the lead differs on the base: M02, M30 – M32 |
| 5 The accuracy row | 4.4 | LD-6 (label, sentence inside `.rc-acc` after the pips, no «точность»/«accuracy», the pass «landing with Не знаю on storage», pips and `.pt`, `.rc-acc` 1 / 0) | the label and sentence differ, the pass does not exist: M26 – M29 |
| 6 The block and marks on `how.html` | 4.3 | `e2e/landing.test.js` **LD-3** (how.html part; the first-screen rule at 390×844; computed styles) and `unit/texts.test.js` **TX-10** (the static source: order, regions, skeleton, key counts, static ru, the `ol.steps` pin); `git diff -U0 base/… -- app/public/how.html` (RELEASE-VALIDATOR) | the elements are absent on the base: M33 – M45 |
| 7 Language switch | 4.3, 5 | LD-3 (switches on `how.html`: kk, en, ru, en; the lint after each); LD-6 (the lead, label, sentence after a language is chosen before the survey, in every pass; and the new switch on a result) | no such elements on the base: M45, M46 |
| 8 The public set | 7 | **LD-9** (block, lead, label and sentence, marks in ru and en on a recommended and the no-match result and on `how.html`; the output's keys and values; no `order_` key; no kk; `?lang=kk` Russian); PB-1, PB-2, PB-6, PB-7 (no edit) | the block is absent on the base: M35, M36, M49 |
| 9 What stays | 4.6 | a script of RELEASE-VALIDATOR (a comparison of the base module, read from a fresh clone of the tag, with the work's module: 4.1's table; section 16) and the commands of the criterion (`git diff --stat base/… -- <the listed paths>` → no line; `git diff --stat base/… -- app/test/e2e/stage.test.js` → no line); `e2e/stage.test.js` ST-1 … ST-6 (no edit) | — (a release check by design; its repo-side guards are TX-4's pinned values, TX-10's `ol.steps` pin and ST-*) |
| 10 Layout and contrast | 4.5 | LD-1 (no edit; its matrix reads `how.html`: measured 0 findings, F12); **LD-6** (new `layoutFindings` on the fixture `landing` and on the no-match result, 3 windows + 360 and 380 px, two themes, ru, en, kk); **LD-9** (the `if (win === WINDOWS[0])` removed: both windows, and a call on the result); `check-public` → 0 | LD-6 has no call on the result on the base: M20 – M22 |
| 11 Look and owner | the look, 14 | RELEASE-VALIDATOR's script (`grep -c` of each ru value in `V1-public-look.md` ≥ 1; no text that describes the removed line as part of the panel); DESIGN-QA-VALIDATOR on a separate instance on port 0 (WF-04 step 4); the owner's «похоже» in `docs/program/public-v1/PROGRESS.md` (G21) | question O5 and O6 |
| 12 Browser step and reader | 4, 5 | UAT-RUNNER (real Chrome, fresh temporary profile, the matrix, snapshots outside the project); BA-ANALYST's key before the reader, the fresh reader's three answers, the scores | question O8 (the stand) |
| 13 Guard tests and both checks | 10, 16 | `git diff --stat base/… -- app/test tools/test` (two files); the grep of REQ-108 criterion 2 over `app/test` (skip, todo, only: no line); `gh run list --workflow app.yml --branch <ci branch> --limit 1 --json conclusion,headSha`, `check.yml` green on the same sha, the four `# tests N` lines against section 16; on this PC `cd tools && npm run -s traces` and `npm run -s handoffs-check` | — |

Every test of section 9 maps to a row above, and the file names are the criteria's (AP-123): `texts.test.js`, `landing.test.js`,
`stage.test.js` (no edit), `public-build.test.js` (PB-1, PB-2, PB-6, PB-7, no edit).

---

## 9. Test catalogue — the new assertions and their messages

The messages begin with the `where` label the test already builds (`${where}` = `${lang} ${pass.name}` in LD-6, the window,
theme and language in LD-1/LD-9); the requirement's two fixed messages are kept word for word. All helpers are local to
`landing.test.js` (C9). The oracles are the test's own: the texts come from `say()` of the kit (the module) and, for the
exact values, from TX-4; the skeleton, the key counts and the closed word lists are written in the tests.

### 9.1 `app/test/unit/texts.test.js`

| Test | Assertion (own oracle) | Message |
|---|---|---|
| **TX-4** gains | for each of the 15 keys of 4.1: ru and en equal the literal values | `${key}: ru` / `${key}: en` |
| TX-4 | kk of `demo_accuracy` differs from the literal «Таңдау дәлдігі» | `demo_accuracy: kk still says accuracy` |
| TX-4 | the key whose name is built from the parts `idea_panel_` and `fine` is absent from `TEXTS`, and no text file of `app/public` (every extension) and no `.js` file of `app/test` holds that name (the test never writes it in one piece, AP-093) | `the removed key is still in the module` / `the removed key is still used: ${file}` |
| TX-4 | each of the 13 added keys exists and does not start with `order_` | `${key}: a new key must exist and be no order text` |
| **TX-9** (new) | for each of the 15 keys × ru, kk, en (45 values): `lintText(value, lang)` is `[]`; `textProblem(value)` is `null`; no `\p{N}`; for ru and en none of the closed whole words (the lists of criterion 2, written in the test, compared in lower case between borders of Unicode letters and digits); the rule's own cases: a planted «контакт» is found, «контактный» is not (AP-120), a 19-word phrase is found, a planted digit is found | `${key} ${lang}: ${finding}` ; `the rule finds «контакт» as a whole word` ; `the rule does not find a substring` |
| **TX-10** (new) | read `how.html` and the module; a tolerant element reader balanced by tag name (void elements and comments skipped) built in the test: (a) every element with `data-t` has a key of the module and its static text, whitespace folded, equals the ru value; (b) the multiset of the added keys equals F19's table (and `demo_accuracy_note` is 0); (c) in source order: `section.intro`, the block, `how_plan_note`, `ol.steps`, `div.how-stages`, `div.panels`; (d) the block is outside `div.panels` and outside every `<!-- sai:order -->` / `<!-- sai:kk -->` region and holds no `data-t` that starts with `order_`; (e) the block's skeleton equals `NOW_SKELETON`; (f) the children of `#stage-1` … `#stage-4` in order (`h2`, `p.stat-line`, the note in stage 1 only, the paragraph last) and the marks' keys (`stat_on`+`stat_off` in stage 1, `stat_off` alone in 2 – 4); (g) the notes carry no `class`; (h) the text of `ol.steps` (from `<ol class="steps">` to its `</ol>`) has sha256 `8a03a716ebbf3bda63ecc562747382cd1e9a8878fc647f9ab9dde20046941cb5` and holds four `button` with `data-step` 1 – 4 and no `stat` or note; (i) each of the 13 added keys is used: a `data-t` in a page of `app/public` or a quoted name in a file of `app/public/js` | `how.html: ${key} static text differs from its ru value` ; `how.html: ${key} stands ${n} times, not ${want}` ; `how.html: the status block follows the intro and precedes the steps` ; `how.html: the status block is inside the panels or an order region` ; `how.html: the status block has the markup of the design` ; `how.html: the stage ${n} holds ${got}, not ${want}` ; `how.html: a note carries a class` ; `how.html: ol.steps is not byte for byte as at the base` ; `${key} is used by no page` |

### 9.2 `app/test/e2e/landing.test.js`

Helpers added in the file: `STATUS_ROWS` (the three rows: parts and mark keys, the oracle), `NOW_SKELETON` and the in-page
`skeletonOf`, `readBlock(page, scope)` (the facts of one block: count, labelledby target, h3, rows with mark text, mark
`innerText` and class, title, line; the closing paragraph's text, class, computed font-size and colour; the controls count;
the skeleton; the document-order relations to named elements) and the extension of `readResult` with: `now` (= `readBlock`),
`lead`, `fineCount`, `accLabel`, `accPips` (the class of each `i`), `accPt`, `accNote` (count, text, whether it follows
`div.prog`), `resultText`, `linkAfterBlock`.

**LD-6** (same name, same timeout; the loop gains the pass and the parts below):

| # | Assertion | Message |
|---|---|---|
| 1 | on the screen of the last question (the fifth, before the tap): `#demo .now` count is 0 | `${where}: no status block on the last question` |
| 2 | on the result: `#demo .now` count is 1, in ru, en, kk | `${where}: exactly one status block on the result` |
| 3 | h3 text is `say("now_title")`; the section's `aria-labelledby` names that h3 | `${where}: the heading of the status block` |
| 4 | three rows; each title is `say("now_demo_t" / "now_idea_t" / "now_build_t")`, each line the `_s` key | `${where}: three rows with the title and the line of each part` |
| 5 | the marks' texts in order are `stat_on`, `stat_off`, `stat_off`; the class `on` only on the first; each mark's `innerText` equals its text | `${where}: the marks in order` / `${where}: a mark reads as its word` |
| 6 | the closing paragraph is the last child, text `now_closing`, no class, computed font-size ≥ 16 px and computed colour equal to that of `body` | `${where}: the closing paragraph is body text of at least 16 px` |
| 7 | the block holds no `a`, `button`, `input`, `select`, `textarea`, `form` | `${where}: the status block holds no link, button or field` |
| 8 | the block's skeleton equals `NOW_SKELETON` | `${where}: the status block has the markup of the design` |
| 9 | the block precedes `.idea` in document order and is not inside `.r-lines`; `lists.at(-1)` is still the fixed list with its ten items; the first link after the block is `.idea a` with the text of `describe_idea` and the address `/how.html#describe-idea` | `${where}: the block is outside the lists of the result` / `${where}: the link of the panel is the first link after the block` |
| 10 | `#demo .idea` holds exactly h3 (`idea_panel_title`), one `p` (`idea_panel_lead`), the link (`describe_idea`), in this order; `#demo .fine` count is 0 | `${where}: the idea panel holds its title, the honest lead and the button` / `${where}: the small grey line is gone` |
| 11 | **accuracy row** (recommended): `.rc-acc` is 1 (line 1122 stays); its label is `demo_accuracy`; the sentence is the one `p` of the row, after `div.prog`, text `demo_accuracy_note`; on the whole `#demo` text no whole word «точность» or «accuracy» (case-insensitive, Unicode borders) | `${where}: the label of the accuracy row` / `${where}: the sentence stands in the accuracy row after the pips` / `${where}: no word accuracy on the result` |
| 12 | **counts**: each of the seven fixtures: pips five `on`, none `half`, `.pt` = `filled(say("demo_k_of_n"), {k: 5, n: 5})`; the new pass: five pips, four `on`, one `half`, none empty, `.pt` = `{k: 4, n: 5}` | `${where}: five whole answers fill five pips` / `${where}: the pips of a skipped answer` / `${where}: the count text` |
| 13 | the new pass is `{ name: "landing with Не знаю on storage", answers: the fixture `landing` without the key `storage` }`; the loop taps «Не знаю» for any question that has no answer in the pass (`pass.answers?.[q.id] === undefined`); the server's answer to its four answers has `recommended.length > 0` | `${where}: the pass has a recommended solution` |
| 14 | no match (five «Не знаю»): `.rc-acc` 0 and the receipt body equals the no-match text (lines 1142, 1148 stay); the block is present (rows 2 – 10) | existing messages |
| 15 | **layout**: for the fixture `landing` and for `five Не знаю`, per language, on the same page: for each of the windows 1470×784, 390×844, 320×568, 360×800, 380×800 and each of light, dark (`setViewportSize`, `emulateMedia({ colorScheme })`, two frames): `layoutFindings(page)` is empty; the bottom of `.now` ≤ the top of `.idea`; the panel area follows 8.4 (at ≥ 1000 px `.r-side` is right of `.r-sum` with equal tops; at ≤ 1000 px the order of the tops is sum, side, answers, lists on a recommended result and sum, lists, side, answers on no match); the rows follow 7.22 (at 1470 each mark is right of its title block, below 480 px each mark is above it) | `result: the status block stands above Описать идею (${where}, ${win.name} ${scheme})` (the requirement's message, with the place appended) / `${where} ${win.name} ${scheme}: the parts of the result stand in the order of 8.4` / `${where} ${win.name} ${scheme}: the mark of a row stands ${side}` ; the findings of `layoutFindings` go to `problems` with `where` = `status block ${where} ${win.name} ${scheme}` |
| 16 | **a language switch on a result**, in pass index 1 of each language: click the button of another language (`en` for ru and kk, `ru` for en), wait for the result heading in it; the lead, the label, the sentence, the count text, the block (rows 3 – 6) are the other language's values and the pips unchanged | `${where}: after a switch to ${other} the ${what} is in ${other}` |
| 17 | **closing part** (ru, fresh page): (a) the result request held by a route until released: the block stands, the receipt holds the `demo_putting` line; (b) answered with 500 (`FAILURES[0]`) and with a refused connection (`FAILURES[3]`): the failure message of the receipt, the block and the panel still stand, the console holds only the declared line; (c) the questionnaire request answered with 500 at load: the failure block, `#demo .now` count 0 | `result held: the status block stands while the receipt waits` / `result ${name}: the status block stays` / `questionnaire failed: no status block` |

**LD-3** (same name; gains `how.html`; the landing assertions stay):

| # | Assertion | Message |
|---|---|---|
| 1 | on `how.html` in ru (a load, then the buttons kk, en, ru, en as the landing part does): `readBlock` — one block, heading, rows, marks, closing as in LD-6 rows 3 – 8, equal to the module's values of that language (en: no Cyrillic letter in these elements); the lint after each switch (`readState`) | `how.html ${lang}: the status block shows the values of the module` |
| 2 | document order: `section.intro`, the block, the note `how_plan_note`, `ol.steps`, `div.how-stages`; the block is outside `div.panels`; the note is outside the block, `ol.steps` and every button | `how.html ${lang}: the block follows the intro and precedes the steps` / `how.html ${lang}: the plan note stands after the block and before the stages` |
| 3 | `#stage-1` … `#stage-4`: the children in order `h2`, `p.stat-line`, (stage 1 only the note `p`), the paragraph `how_stage_N_text` last; stage 1 has the marks `stat_on`, `stat_off` beside `now_demo_t`, `now_idea_t`, then `how_stage_1_note`; stages 2 – 4 one mark `stat_off`; every `h2` and stage paragraph keeps its value | `how.html ${lang}: the stage ${n} holds its marks, its note and its text in order` |
| 4 | the two notes: no class `fine` or `meta`, computed font-size ≥ 16 px, computed colour equal to that of `body`, in each language and both themes | `how.html ${lang} ${scheme}: a note is body text` |
| 5 | `ol.steps` holds exactly four `button[data-step]` 1 – 4 with `aria-pressed` and the names `stage_N` / `stage_N_sub`; no `.stat` and no note inside a button | `how.html ${lang}: the stage buttons carry no mark and no note` |
| 6 | a page 390×844 (newPage with that viewport, both colour schemes, ru, en, kk, `?lang=`): at the top of the page `0 ≤ top < 844` for the block's bounding box | `how.html: the status block starts inside the first screen at 390x844` |
| 7 | a page with `Storage.prototype.getItem` and `setItem` throwing (as LD-4): `how.html` shows the block in ru; the button `en` works and the block turns English; a short pass to a result shows the block | `a throwing storage: the status block` |
| 8 | a page with `javaScript: false`: `how.html` shows the block, the marks and the notes with the ru values, visible (`checkVisibility`) | `no script: the status block holds the ru values` |

**LD-9** (same name):

| # | Assertion | Message |
|---|---|---|
| 1 | `if (win === WINDOWS[0])` before `layoutFindings` of the loop is removed: the call runs for every page of the loop in both windows | `${where}` (the findings go to `problems` as now) |
| 2 | after the recommended result of the fixture `landing` in each window and language: `layoutFindings(page)` is empty; a second pass with five «Не знаю» reads the no-match result | `${win.name} ${lang}: the status block, the lead, the label and the sentence on a recommended result` / `… on the no-match result` |
| 3 | on both results and on `how.html`: the block's heading, rows, marks and closing paragraph equal `out(key, lang)` (the output's own module); the lead, the label and the sentence on the result equal `out("idea_panel_lead")`, `out("demo_accuracy")`, `out("demo_accuracy_note")`; the stage marks and the two notes on `how.html` equal the output | `${where}: the output shows ${key}` |
| 4 | the output's module: no key with `order_` (at all, besides the page check `data-t^="order_"` that stays), no entry with a `kk` property, the 15 keys present, each with `out(key, "ru") === say(key, "ru")` and the same for en | `the output keeps ${key}` / `the output has a kk value or an order key` |
| 5 | `/how.html?lang=kk` shows the block in Russian (the heading and the marks are the ru values) | `kk asked: how.html shows Russian` |

---

## 10. Replacement table of earlier guard tests

Measured at the tag (F23, F24). No prohibition is weakened: every assertion that exists stays, with the same message; the
number of `test(` and `assert.` in the two changed files is not lower than at the tag (the base has 9 + 6 `test(` in the e2e
folder and 120 in unit; the work adds to them and removes none).

| # | Guard test (file, place) | What it counts or reads | Was → became |
|---|---|---|---|
| 1 | `e2e/landing.test.js` `readResult` (942 – 975) | the heading, the receipt, the lists by heading, the idea link, the chips; `.rc-acc` as a count only (961) | was: the count of `.rc-acc` and the idea link's text and address → became: the same fields plus those of 9.2 (`now`, `lead`, `fineCount`, `accLabel`, `accPips`, `accPt`, `accNote`, `resultText`, `linkAfterBlock`); the fields that exist keep their names and their reading |
| 2 | LD-6 (977 – 1262): `passes` (995 – 1001), the tap loop (1008 – 1032), the fixed list (1054 – 1064), `.rc-acc` 1 (1122) and 0 (1148), `lists.length` 3 and 1, `.r-sum + .r-lines` | the seven fixtures and five «Не знаю» per language | was: eight passes → became nine (the pass of 9.2 row 13 between the fixtures and `five Не знаю`); the loop's test `pass.answers !== null` becomes `pass.answers !== null && pass.answers[q.id] !== undefined` (a question without an answer is «Не знаю»); the assertions on the lists, the chips, `.rc-acc`, the idea link and the no-match text are unchanged; gains the rows of 9.2 (1 – 17); LD-6 calls no `layoutFindings` on the result at the tag and gains row 15 |
| 3 | LD-3 (251 – 361) | the landing's switch, the demo's switch (`#demo .back`, the kept answer) | the landing and demo assertions stay; gains the `how.html` part and rows 6 – 8 of 9.2 |
| 4 | LD-9 (1684 – 1913): `for (const win of [WINDOWS[0], WINDOWS[1]])` (1690), `if (win === WINDOWS[0])` (1840) before `layoutFindings` (1841), the result pass (1861 – 1900), `got.lists.at(-1)` (1876) | the public set in two windows | the guard of 1840 is removed (both windows); the result pass gains the layout call and a second pass on the no-match result; the output assertions of 9.2 are added; the existing assertions stay |
| 5 | LD-1 (89) | every page in the matrix, `layoutFindings` at 153 | no edit: its matrix reads `how.html` and meets the block (measured 0 findings, F12) |
| 6 | LD-2, LD-4, LD-5, LD-7, LD-8 | `section.info` on `examples.html` only (223); `#demo .idea a` at 1173 and 1893 are LD-6 and LD-9's; LD-7's failure messages; LD-8's storage keys | no edit |
| 7 | `unit/texts.test.js` TX-4 (171 – 257), TX-2 (129), TX-3 (138), TX-5 (283) | the pinned values; every key's shape and phrase length; the 45 order keys | TX-4 gains rows (9.1); TX-2 and TX-3 read every key and meet the new ones with no edit; TX-5 no edit; two tests are added (TX-9, TX-10) |
| 8 | `unit/public-build.test.js` PB-1, PB-2, PB-6, PB-7 | the open build: the leak rule, the files that differ, the regions, the byte-equal output | no edit; the block stands outside every region (F21, F20) |
| 9 | `unit/public-pages.test.js` PP-1 … PP-5, PP-7; `unit/forbidden-words.test.js`; `unit/check-public.test.js` CP-1 … CP-3 | the page rules, the lint, the real files | no edit; the real `app/public` passes (the values F10, the markup 6) |
| 10 | `e2e/stage.test.js` ST-1 … ST-6 | `button[data-step]`, the buttons' names, the text view, JS-off layout | no edit; `git diff --stat base/… -- app/test/e2e/stage.test.js` lists no line (criterion 9) |
| 11 | `tools/test` and `tools/src` | any read of `app/` | none (grep of F23): no edit |
| 12 | `unit/npmrc.test.js` NPM-5, NPM-6, NPM-7, `int/node-main.test.js` NM-5 (the lists of test files) | a subset guard of the file names; NPM-6 the grep of the skip, todo and only forms over `app/test` | no edit: no test file is added; the two changed test files carry none of those forms, comments included |

No test counts the children of `.res`, of `.r-side` (new), of `.panels` or of the steps section (grep of F23); the 20 new
`data-t` elements of `how.html` change no count that a test reads.

---

## 11. Build sub-steps

FRONTEND-DEV writes F1 – F5 in this order, TEST-DESIGNER T1 – T4 at step 5. On this PC no check runs; the own check of a
sub-step is the static reading plus, where named, a driver outside the project (the sketch of section 17 is the model: a copy
of `app/`, a no-dependency server, Chrome headless, `layoutFindingsIn` copied as text) and `cd tools && npm run -s traces`.
The real checks run on GitHub from a temporary `ci/*` branch at the end of F5 and of T4 (decisions/0110). «Red after it»: every
sub-step leaves the whole existing suite green (reading every assertion that touches the file, F23, and the measurements of
the trial). A red test not in this table is a stop.

| # | Who | Files | Own check | Red after it |
|---|---|---|---|---|
| F1 | FRONTEND-DEV | `texts.js`: the 13 keys (ru, en, kk), the changed `idea_panel_lead` and `demo_accuracy`; `idea_panel_fine` stays | a driver that imports the module: 180 keys, 45 `order_`, the 15 keys' exact values, `lintText` and `textProblem` on all 45 values, no digit, the closed words | none |
| F2 | FRONTEND-DEV | `site.css`: the rules of 4.5 added; `.idea` keeps `grid-area` for now | a driver in Chrome on the copy: the sheet parses, no existing page moves (nothing uses the new classes yet) | none |
| F3 | FRONTEND-DEV | `demo.js` (4.4), and in `site.css` the one line `.idea { grid-area: panel }` removed | the driver of the trial: the results of a fixture, of one «Не знаю» and of five, in ru, en, kk, at the five windows: 0 findings of `layoutFindingsIn`, the facts of F13 and F14 | none |
| F4 | FRONTEND-DEV | `texts.js`: `idea_panel_fine` removed | `grep -rn` for the key over `app/public` and `app/test` → no line; the driver of F1: 179 keys | none |
| F5 | FRONTEND-DEV | `how.html` (4.3, the markup pasted as it stands) | the driver: the 30 loads of F12, the static-ru read of F18 on every `data-t`, the key counts of F19, the diff of F20, the sha256 of `ol.steps`; then ORCH has the four files run on GitHub from a snapshot on a temporary `ci/*` branch (decisions/0110): `check.yml` and `app.yml` read (the new tests are not there yet, so the suite is the old one) | none |
| T1 | TEST-DESIGNER | `texts.test.js`: TX-4 rows, TX-9, TX-10 | the tests read (no unit run on this PC); on the CI branch the unit step prints `# tests 122` and `# fail 0` | none (the rows are red only on the base, which the mutants prove) |
| T2 | TEST-DESIGNER | `landing.test.js`: LD-3 | the CI branch: LD-3 green; its new parts red on a fresh clone of the base tag with the same test file (a run on GitHub) | none |
| T3 | TEST-DESIGNER | `landing.test.js`: `readResult`, LD-6 (rows 1 – 17) | the CI branch: LD-6 green, red on the base clone | none |
| T4 | TEST-DESIGNER | `landing.test.js`: LD-9; the mutant series of section 12 in a fresh clone | the CI branch: the four counts of section 16; the mutants red as named | none |

Each sub-step can be checked alone. F1 is first because `demo.js` and `how.html` need the keys; F3 before F4 because the
removed key must be unused first; the rule `.idea { grid-area }` goes in F3 together with the wrapper, so the panel never
stands in two places. A saved file is consistent with the others at every step: F2 alone changes nothing a page uses; between
F3 and F5 `how.html` simply lacks the block (it has none at the base).

---

## 12. Mutants

One per trap. «Measured» = applied on the trial of section 17 (F22) and the named oracle changed; «designed» = for the gates
(CODE-DESIGN-VALIDATOR at least 10, TEST-DESIGN-VALIDATOR at least 20). A mutant is applied only in a throwaway clone.

| # | Mutant | Caught by | Status |
|---|---|---|---|
| M01 | `idea_panel_fine` left in `texts.js` | TX-4 (the key must be absent) | designed |
| M02 | the fine line built again in `demo.js` | LD-6 row 10 (`.fine` count 1); TX-4 (the key used) | designed |
| M03 | a new key `order_now_title` (or any `order_` key) | TX-5 (exactly 45), TX-4 (the 13 keys), PB-1 | designed |
| M04 | `now_closing` ru gets a word of list С (a form «срок») | TX-4 (the literal), TX-9 (`lintText`), check-public | designed |
| M05 | en `stat_off` is «Soon» | TX-4 | designed |
| M06 | kk `demo_accuracy` left «Таңдау дәлдігі» | TX-4 (kk differs) | designed |
| M07 | kk `now_closing` with «күні» | TX-9 (`lintText` kk finds list Ц «күні»), check-public | **measured**: the first draft, `lintText` → `[{"list":"Ц","form":"күні"}]` |
| M08 | a value of 19 words in one phrase | TX-3, TX-9 (`textProblem`) | designed |
| M09 | a digit in a value | TX-9 | designed |
| M10 | the whole word «Контакты» in a ru value | TX-9 (closed words); a twin «контактный» stays green (AP-120) | designed |
| M11 | the block missing from the result | LD-6 row 2 | designed |
| M12 | the block built on the question screens (inside `put` for a question) | LD-6 row 1 | designed |
| M13 | the block appended into `div.r-lines` | LD-6 rows 9, 15 (`lists.length`, `lists.at(-1)`, inside the lists), and `.r-sum + .r-lines` on no match | designed |
| M14 | the panel above the block in `r-side` | LD-6 row 15 (`result: the status block stands above Описать идею`) | **measured**: `nowAboveIdea=false` |
| M15 | the closing paragraph carries class `fine` | LD-6 row 6 (class, 14 px, colour `--ink2`) | designed |
| M16 | a third mark «По приглашению» or «Скоро» (or mark 2 reads `stat_on`) | TX-4, LD-6 rows 4, 5 | designed |
| M17 | a link «Пройти опрос» (or a `button`) inside the block | LD-6 row 7, LD-3 row 1, TX-10 | designed |
| M18 | the marks' order swapped (`on` on row 2) | LD-6 row 5 | designed |
| M19 | `.stat { text-transform: uppercase }` | LD-6 row 5 (`innerText` ≠ text) and LD-3 row 1 | **measured**: `innerText` «РАБОТАЕТ»; `layoutFindingsIn` gives 0 findings, so only the `innerText` assertion sees it |
| M20 | `.stat` colour `#777` in dark | `layoutFindings` (LD-1 on `how.html`, LD-6 row 15, LD-9) | **measured**: 6 findings at 390 dark, 2.78:1 |
| M21 | `.rc-acc p` in `--ink2` | `layoutFindings` in LD-6 row 15 (a recommended result) | **measured**: 1 finding, 1.91:1 on the cream |
| M22 | the `max-width: 479px` stacking rule removed | LD-6 row 15 (rows by width) | **measured**: `layoutFindingsIn` gives 0 findings at 320 and 390 in ru, en, kk, so no existing oracle sees it; the new geometry assertion does (designed) |
| M23 | `.r-side` without `grid-area: panel` | no test | **measured: equivalent**: auto-placement puts the wrapper into the same empty cell at 1470 (905 / 491, the same as with the rule) and the DOM order gives the same order at ≤ 1000 px |
| M24 | `.r-side` loses its column flex (the block and the panel side by side in the 430 px area) | LD-6 row 15 (the block's bottom is not above the panel's top; layout findings of cut text) | designed |
| M25 | the sentence outside `.rc-acc` (in `.rc-body`) | LD-6 row 11 (inside the row after the pips) | designed |
| M26 | the sentence shown on a no-match result | LD-6 row 14 (the receipt body equals the no-match text, `.rc-acc` 0) | designed |
| M27 | the label reverted to «Точность подбора» | TX-4, LD-6 row 11 (label, and the whole word «точность») | designed |
| M28 | `Math.round` for `Math.floor` in the receipt's count text (line 896) | LD-6 row 12 (`.pt` must be 4 of 5 beside a half pip) | **measured**: «5 из 5» with pips `on,on,on,on,half` |
| M29 | `receiptCount` counts a skipped answer 0 | LD-6 row 12 (the half pip) | **measured**: pips `on,on,on,on,empty`, «4 из 5» |
| M30 | `receiptCount` counts a skipped answer 1 | LD-6 row 12 (the half pip; `k` 4) | **measured**: pips five `on`, «5 из 5» |
| M31 | `idea_panel_lead` keeps its old value | TX-4, LD-6 row 10 | designed |
| M32 | the idea link's label or address changed | LD-6 (lines 1065, 1066 stay), TX-4 (`describe_idea`) | designed (existing guards) |
| M33 | `how.html`: the block after the steps section | LD-3 row 2, TX-10 (c) | designed |
| M34 | `how.html`: the block inside `div.panels` | LD-3 row 2, TX-10 (d) | designed |
| M35 | `how.html`: the block inside an `<!-- sai:order -->` region | TX-10 (d), PB-6, LD-9 row 3 (the block is gone on the public set) | designed |
| M36 | `how.html`: a block text with `data-t="order_…"` | TX-10 (d), PB-6, LD-9 row 4 | designed |
| M37 | `how.html`: a static ru text with a typo | TX-10 (a) | designed |
| M38 | `how.html`: a mark inside a stage button | LD-3 row 5, TX-10 (h) | designed |
| M39 | `how.html`: `aria-pressed` removed from a step button | TX-10 (h: the pin), LD-3 row 5, ST-3 | designed |
| M40 | `how.html`: the stage-1 note after `how_stage_1_text` | LD-3 row 3, TX-10 (f) | designed |
| M41 | `how.html`: the plan note after `div.how-stages` | LD-3 row 2, TX-10 (c) | designed |
| M42 | `how.html`: the plan note with `class="fine"` | LD-3 row 4, TX-10 (g) | designed |
| M43 | `how.html`: stage 3 with `stat_on`, or stage 2 with two marks | LD-3 row 3, TX-10 (f) | designed |
| M44 | `how.html`: a spacer that pushes the block below the first screen | LD-3 row 6 (`top < 844`) | designed |
| M45 | `how.html`: the closing paragraph without `data-t` | LD-3 row 1 (it stays Russian after the switch; TX-10 (a) does not see an element with no key) | designed |
| M46 | `demo.js`: the block built in a fixed language | LD-6 rows 3 – 6 in en and kk, row 16 | designed |
| M47 | `demo.js`: the block built only after the result request returns | LD-6 row 17 (a) | designed |
| M48 | `demo.js`: `fillReceipt` removes the block on a failure | LD-6 row 17 (b) | designed |
| M49 | the output's module keeps a kk value or `order_` key for the new keys | PB-1, LD-9 row 4 | designed |
| M50 | an inline `style=` in the block's markup, or `innerHTML` in `statusBlock` | check-public (CP-1), CSP records in LD-3 and LD-6 (`readState`) | designed |
| M51 | `aria-labelledby` points to an id that is not the h3 | LD-6 row 3, LD-3 row 1 | designed |
| M52 | the questionnaire failure screen shows the block | LD-6 row 17 (c) | designed |

Count: 52; applied: M07, M14, M19, M20, M21, M22, M23, M28, M29, M30 (10; M07 only through the lint, the others on the
trial page). Of these M22 is seen by no existing oracle (the new geometry assertion is its test) and M23 is equivalent
(no test can see it); both are reported, neither is hidden.

---

## 13. Quality bar (Q1 – Q14, R1 – R3)

| Item | Applicable? | How it is met |
|---|---|---|
| Q1 | applicable | every change has REQ-113; each of its 13 criteria names its check (section 8) |
| Q2 | applicable | gates: 1b (CODE-DESIGN-VALIDATOR repeats the facts on a fresh clone of the tag), 3 ‖ 4, 5b, 6, 7 (DESIGN-QA-VALIDATOR, criterion 11; question O6), 8 (UAT-RUNNER and the reader, run by agents other than the author), 9; the author of this design does not check it |
| Q3 | applicable | statements about the page are measured (F11 – F16, F21); statements about tests that do not exist yet are marked designed; nothing is called «works» without a run; no test is run on this PC |
| Q4 | applicable | one check command `cd app && npm run check`, run on GitHub from a temporary branch (decisions/0110); on this PC `cd tools && npm run -s traces` and `npm run -s handoffs-check` only |
| Q5 | applicable | section 8: every criterion has a test or a named command; the failure paths of section 5 have tests; a failure test checks that the state is unchanged (LD-6 row 17: the block and the panel as before; TX-4: nothing else changed) |
| Q6 | applicable | no `skip`, `todo`, `only`; test names unchanged; no rule turned off; `.fine` is not reused for the notes; the closed word lists are not widened; the replacement table weakens nothing (section 10) |
| Q7 | applicable | no secret; the block holds no address, key or contact; check-public's bans hold |
| Q8 | not applicable | no tenant, no account, no stored data; nothing a visitor taps is stored (LD-8 stays) |
| Q9 | not applicable | no database call and no SQL |
| Q10 | applicable | the block is static text; a request that fails (the result, the questionnaire) leaves the page working with the block as before (section 5, rows 4 – 7); a storage that throws changes nothing (row 7) |
| Q11 | not applicable | no address is set by a visitor and none is called; the block holds no link |
| Q12 | applicable | the choices of section 2 and the questions of section 15; a proposal for a record is in O12; the design departs from no record (decisions/0125 items 1 – 7 are followed; item 5's «4 из 5» is kept) |
| Q13 | applicable | no new process error was found by this step beyond the two DISCREPANCY items of the handoff (the tag name `…-01` in three commands of the requirement, F1; the stand of decisions/0125 item 7 cannot start without `npm ci`, F17); DOC-UPDATER decides whether they go to `docs/anti-patterns.md` |
| Q14 | applicable | the bookkeeping list is section 14; ORCH checks the fields before DONE |
| R1 | applicable | the release order is unchanged: RELEASE-FINALIZER pushes after PASS of RELEASE-VALIDATOR and the owner's «похоже» (G21) |
| R2 | not applicable | no office event is written or shown; the marks are not on the scene and are no agent state (decisions/0125 item 2) |
| R3 | not applicable | decisions/0033 (the product with photos of people was dropped) |

---

## 14. What becomes outdated outside the project (for DOC-UPDATER)

| Where | What | Action |
|---|---|---|
| `docs/design/V1-public-look.md` section 17, item **D20** | «the result's right panel is «Описать идею» (a title, a lead, the big button, **a fine line**; no field)» — describes the removed line as part of the panel; REQ-113 criterion 11 forbids such text | edit D20 (and the 7.15 reference); see O5 for who and when |
| the same, section 14 (the map), first table | no row for REQ-113 | add a row «REQ-113 c1 – c13 → 7.22, 7.15, 8.2, 8.4, 13» |
| the same, 7.12 | the line that names the label «<accuracy>» (the look's own note says 7.22 overrides it) | state the label as `demo_accuracy` «Учтено ответов» and the sentence inside `.rc-acc` |
| the same, 13.1 and 13.2 | the table of fixed words | add the 15 keys of 4.1 if the section lists fixed words by key |
| `docs/design/REQ-111-112-public-landing.md` 4.1 (line 292 and the table of keys), 4.3 (the `how.html` row, line 366), 4.4 (`site.css`), 4.5 (`demo.js`), section 10 (the LD-3, LD-6, LD-9 text, TX-4), section 19 (the counts) | the key table lacks the 13 keys and holds `idea_panel_fine`; `how.html` and the result's structure gain the block; LD-3 / LD-6 / LD-9 gain assertions; the counts change (unit 120 → 122) | add a short «changed by REQ-113» note with a pointer to this file; do not rewrite released sections |
| `docs/uat/REQ-111.md` line 344 | a remark about «Точность подбора» with pips (a record of an earlier run) | history; leave, or add a pointer |
| `docs/requirements.yaml` REQ-113 | status and comment only (WF-02 step 10); a name or a number that is outdated may be corrected without changing the meaning, with `before_copy` | DOC-UPDATER; the commands that name `base/M1STATUS-20261122-01` read the same bytes as with `…-02` (F1) |
| `STATE.md`, `PLAN.md`, `docs/program/public-v1/PROGRESS.md` | the status of REQ-113, the gate table with the owner's «похоже» (criterion 11) | by the route |
| `docs/issues/ISS-0128-…` | the count rule | after this run the counts are in section 16; no edit by this design |
| `app/README.md` | nothing names the block or the keys | no edit |

---

## 15. Questions for ORCH (answers by a record in `decisions/` at step 1a)

Each has a default; the design follows the default until ORCH answers.

| # | Question | Default |
|---|---|---|
| O1 | On a no-match result at 1000 px and narrower the block stands under the fixed list (601 – 625 px high at 390 and 320; the block starts at y 1271 at 390 [M]), because REQ-111 criterion 12 keeps `.r-sum + .r-lines` with nothing between; it is still above the button. Accept, or change that criterion by a micro-amendment so the block stands between the receipt and the list? | **accepted** (no amendment) |
| O2 | The block's `h3` follows the `h1` on `how.html` and skips `h2` (the panels already follow `h2` with `h3`; one markup serves both pages). Keep `h3`? | **keep `h3`** |
| O3 | Confirm the key names `demo_accuracy_note` and `how_stage_1_note` and the CSS names `now`, `stat`, `stat-line`, `pair`, `r-side` and the breakpoint 479 px. Note: `.plate.now` already exists on the scene's labels (F7); every new rule is scoped (`.now .stat`, `.info.now`, `section.now`), none is the bare `.now`. | **confirmed**, with the scoping rule |
| O4 | The receipt shows «4 из 5» for 4.5 answers (decisions/0125 item 5). Any change would be a micro-amendment of criterion 5. | **unchanged**; LD-6 asserts k = 4 with a half pip |
| O5 | The look still has the stale lines of section 14 (D20 says «a fine line», no REQ-113 row, the 7.12 label line). Criterion 11 asks that no text of the file describes the removed line as part of the panel, «before the code». The step's write set excluded them. Who edits them, and when? | a short **GUI-DESIGN-ANALYST rework step before gate 1b closes**, so the gate and the later DESIGN-QA-VALIDATOR read one consistent measure; the alternative (DOC-UPDATER at step 10) leaves criterion 11 false until the end |
| O6 | WF-02 «interface without a sample» says DESIGN-QA-VALIDATOR does not run (UAT-RUNNER accepts), and the look 7.22 says the same; criterion 11 of the requirement asks DESIGN-QA-VALIDATOR for a PASS against the updated description. Which holds? | **the requirement** (criterion 11 is the contract): DESIGN-QA-VALIDATOR runs at step 7 against the look; UAT-RUNNER at step 8 as well |
| O7 | The new unit tests: two new tests TX-9 and TX-10 (unit 120 → 122), or only rows inside TX-4 (count unchanged)? | **two new tests** (each criterion has a test of its own; mutants can be told apart) |
| O8 | `decisions/0125` item 7 says a local server `node app/server/node-main.js` with real Chrome on this PC. `app/node_modules` is absent here and `server/node-main.js` imports `@hono/node-server` (F17), so it cannot start without `npm ci`. Who prepares the stand for step 8? | ORCH or UAT-RUNNER makes a **fresh clone outside the project, runs `npm ci` there (network), starts the server on a free port**; the trial of this step used a no-dependency scratch server and is no substitute for the stand |
| O9 | Criteria 6, 9 and 13 name the tag `base/M1STATUS-20261122-01` in their `git diff` commands; this run's base is `base/M1STATUS-20261122-02`. They print the same (F1: no change of `app`, `tools`, `.github` between the tags). Let validators use `-02` (the handoff's `base_tag`)? | **yes**, either tag; no amendment (a name in a command, no change of meaning; DOC-UPDATER may correct it with `before_copy`) |
| O10 | The kk values are drafts (4.1), measured against the lists; one word of the first draft was refused by list Ц. Take them as the coding role's starting point? | **yes**; readers' rounds at step 8; disputed lines `FOR_NATIVE_SPEAKER` |
| O11 | LD-6 changes the window and the colour scheme of a live result page (`setViewportSize`, `emulateMedia`) instead of loading a new page per cell. It adds about 60 `layoutFindings` calls (F25: no timeout changes). Accept? | **accepted**; if CI shows a flake caused by the resize, the cell is loaded anew instead (no weakening) |
| O12 | Proposal for the record of step 1a: `decisions/0126-m1status-code-design-conventions.md` with the answers O1 – O11, the section «Основание», and the rule that «4 из 5» stays. | as written |

---

## 16. Counts and their commands

**The base (the count rule of REQ-108 criterion 2, read from the CI log, not from ISS-0128; F2).**

```
gh run list --workflow app.yml --limit 8 --json databaseId,conclusion,headSha,headBranch,event,createdAt
gh run view 44919421105 --log        (read-only; main e0a425b, success, 2026-11-21T15:29:13Z)
```

| Step (log line) | `# tests` | pass | fail | skipped | todo |
|---|---|---|---|---|---|
| unit (`npm run test:unit`, job check, line 1602) | **120** | 120 | 0 | 0 | 0 |
| int (`npm run test:int`, line 1898) | **47** | 47 | 0 | 0 | 0 |
| pg (`npm run test:pg`, line 631) | **4** | 4 | 0 | 0 | 0 |
| e2e (`npm run test:e2e`, line 296) | **15** | 15 | 0 | 0 | 0 |

**Expected at the work's commit [C]** (the step handoffs' own lists prevail): unit 120 + 2 (TX-9, TX-10) − 0 = **122**; int
**47**; pg **4**; e2e **15** (no `test(` added: the new pass is one more element of LD-6's `passes`, a loop case counted once
by the runner); skipped 0, todo 0 everywhere. N is not below the base in any folder.

Other counts of this design: criteria 13; checked facts 25; disputable choices 12; open questions 11 (O1 – O11) and one record proposal (O12);
new keys 13, changed values 2, removed keys 1; new test files 0, changed test files 2; named tests added 2 (unit);
build sub-steps 9 (FRONTEND-DEV 5, TEST-DESIGNER 4); mutants 52 (10 applied on the trial).

**Commands of the criteria that name a tag** read `base/M1STATUS-20261122-01` in the requirement; they give the same lines
with `base/M1STATUS-20261122-02` (F1).

**RELEASE-VALIDATOR's script for criterion 9** (only reads; the base module from a fresh clone of the tag made outside the
project): prints, for every key of the base except `idea_panel_lead`, `demo_accuracy` and `idea_panel_fine`, whether ru, kk
and en are equal to the work's (the banner `test_mode`, `stage_1` … `stage_4` with their `_sub` lines, `how_stage_1_text` …
`how_stage_4_text`, the panel texts, `describe_idea`, the `nobuild_` keys and the 45 `order_` keys must all be equal); prints
the keys of the work that the base lacks (exactly the 13 of 4.1) and the count 13; for each, whether a `data-t` in a page of
`app/public` or a quoted name in `app/public/js` uses it; then the `git diff --stat` commands of the criterion.

---

## 17. The sketch (for `result.prototype`)

Outside the project, in the scratch folder of this session, subfolder `<scratch>/design113/` (the path is not written in any
Sai file):

- `texts-values.mjs`, `texts-check.mjs`, `kk-try.mjs`: the 15 keys' values (ru, kk draft, en) and the lint of F10, imported
  from `app/scripts/word-lists.js` and `app/public/shared/text-rules.js` by absolute file URL (read-only);
- `engine.mjs`: the engine's answers of F9 (read-only import of `app/server/vendor/picker-engine.js` and the intake);
- `static2.mjs`, `static3.mjs`, `leaks.mjs`, `htmlscan.mjs`, `verify-req.mjs`: the static-text read of F18 and F19, the
  PB-1 leak replay of F21, the forbidden-form scan of 6, and the comparison of the 30 ru and en values with the requirement
  and the look;
- `trial/app`: a copy of `app/` with the design applied (`make-trial.mjs`, `make-how.mjs`, `make-demo.mjs`, `make-css.mjs`),
  formatted by prettier 3.9.9; `server.mjs`: a no-dependency static server for it that serves the two demo routes through the
  copy's own `demoRoutes`; `build-measure.mjs` → `public/measure.js` (the project's `layoutFindingsIn` copied as text plus a
  driver that answers the demo, switches the language and writes the measurements), `host.html` (an iframe of the exact window
  size), `chrome-run.sh` (Chrome headless, `--dump-dom`), `matrix-how.sh` and `matrix-demo.sh` with their outputs (30 and 90
  loads, 0 findings), the mutant runs of F22 (each file restored from its saved text).

The sketch reads the project and writes only into its own folder; the server it started was stopped by its process
identifier; no test, no check chain and no `check-public` run was made on this PC.
