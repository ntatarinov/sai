# REQ-070 — code design: two made-up tenants of the form `/3` for the new office stand ("Складеон", id `stock`; "Лидвейв", id `agency`), their sets of answers and the tests of the data

Run `DEMO070-20261027-01`, WF-02, step 1 (handoff `step-01-code-designer.json`). Author: CODE-DESIGNER, 2026-10-27 (by `date -u`: the handoff started 05:01:47Z, the sketch runs were made between 05:03Z and 05:19Z; the handoff was closed at 05:20:13Z). Checked by CODE-DESIGN-VALIDATOR.
**Rework 1** (handoff `step-03-code-designer.json`, 2026-10-27, after the gate FAIL of step 02, pass 1 of 3; the remarks V1–V6 only): V1 → test DT-2d and mutant MU29 (6.1, 8.2, 12); V2 → the pin of `engine.js` dropped from DT-6b (8.2, 8.3, N4); V3 → attributions of the mutants re-read against the test texts (12); V4 → I1–I4 shown as answered (14.3); V5 → how an absent field and `name.en` are compared (6.1, DT-2c); V6 → the fold in DT-4b and mutant MU30 (8.2, 12). Counts after the rework: 21 tests, 30 mutants. Base tag `base/DEMO070-20261027-01` (= `HEAD` e3be325; the tree differs from the tag only by the folder of this run).
The requirement is the block `REQ-070` of `docs/requirements.yaml` (**seven** criteria, all binding; the first handoff said six: corrected by `decisions/0086` item 2). The block is as amended by run `MA070-20261027-01` (reason `SEP` allowed in criterion 2). Records read: `decisions/0083`, `0084`, `0085`, `0086`, `0066`, `0070`, `0071`, `0072`, `0076`, `0080`, `0002`; the design `docs/design/REQ-069-tenant-look-format.md` (what the check enforces: sections 5.3–5.7, 6.4, the colour rule); the approved sample `docs/design/samples/picker-v3-approved-2026-10-26/` (`data.js`, variables `STOCK` and `AGENCY`).
This document holds paths, tables and rules. It holds no implementation code. All example data is invented.

This work is **data plus one test file**. No file of `tools/src/picker/*.js` and no page file changes (section 3). The format and its check are REQ-069 (done); the estimate with price and days is REQ-073 (it will add fields to the same files); the pages, the server and the publishing are other requirements.

## 0. Summary

1. **Four data files and one test file** (section 3): `tools/src/picker/demo-tenants-v3/stock.json`, `agency.json`; `tools/src/picker/demo-answers-v3/stock.json`, `agency.json`; `tools/test/picker-demo-v3.test.js`. A paragraph in `tools/README.md`. Nothing else changes.
2. **The tenants are built from the sample by a path map** (section 4): questions, options, look and intro come from `data.js`. The sample has **no solutions, rules, hypotheses, result or lead texts**, so these are designed here as tables (section 5): 4 solutions, 15 rules, 2 hypotheses per tenant, `top` 3, `min_score` 5, `clear_lead_gap` 3. The sets `leader`, `close`, `none` give the three outcomes by the real engine (section 7).
3. **What the real check says about the sample** (measured, F4–F7): exactly **two** values fail, both colours (as REQ-070 says), and **one** value fails by form: the tag `?` of the option «Пока нигде». **No ru text of the sample fails any text rule** (18 words, forbidden signs, «ты»): the table of text edits for the check has **no text row**; the only check row is the `?` tag. One more kind of edit is forced by criterion 4 and is **not** a check error: the sample gives the same role text to a desk of both tenants (two roles × three languages, F5), and one option id (`none`) is used by both; the roles of the second tenant are rewritten (section 6, rows E2 and E3) and the two option ids are renamed (table 6.2). This was the question I1; it is answered by `decisions/0086` item 1 and the amendment of criterion 2 (reason `SEP`).
4. **The two replacement colours** by one stated method (section 6.3). Measured values for the executor to reproduce: `#d76e1e` (3.13 : 1) for `stock` `look.colors.light.accent` and `#6d54da` (3.10 : 1) for `agency` `look.colors.dark.accent2`. The test checks the rule, not the value.
5. **No old test turns red** (measured, F11): the full suite, 2044 tests, is green with the four data files in place (and added to the git index of the copy); `npm run traces` is 0. The replacement table of old guard tests is therefore empty, and section 9 says why.
6. **The test file has 21 tests** (section 8), every criterion has a row, the traps of the data have 30 mutants (section 12), the sub-steps are four for BACKEND-DEV and one (in parts) for TEST-DESIGNER (section 11).
7. **Questions for ORCH**: I1–I4 are **answered** by `decisions/0086` (items 1–4); no question stays open; the rest are notes (section 14).

## 1. Checked facts (commands run outside the project, 2026-10-27)

Copies: `<scratch>/d070/base` and `<scratch>/d070/fresh` — fresh `git clone -b base/DEMO070-20261027-01` of the project; `<scratch>/d070/sk` — the sketch scripts and the sketch tenant files. Nothing in the project folders was changed. The sketch generator reads `data.js` through `node:vm` with a substituted `window` (the same way the test will).

| # | Statement | Command and result |
|---|---|---|
| F1 | The tag equals `HEAD`; the tree has only this run's folder as new | `git rev-parse HEAD` → `e3be325a452422e8ca91d72a0cd4a51c7c19eba7`; `git tag -l 'base/DEMO070*'` → the tag; `git status --short` → `?? handoffs/DEMO070-20261027-01/` |
| F2 | The sample: `STOCK` and `AGENCY` have 5 questions each; kinds `choice, choice, number, choice, choice`; `st` (the desk, from 0) = 0, 1, 2, 2, 3 in both; four team members, four `say` lines; no solutions, rules, hypotheses, `result`, `leads` texts or operator data; `pkg` (the base package name), `rate`, `wa`, `lines` (modules), `demo` (sample requests) exist | `data.js` loaded with `vm.runInNewContext(text, { window })`; `Object.keys` of both objects |
| F3 | Contrast of the sample accents (the formula and sheets of REQ-069 5.4) | `#e0731f`: 2.897 on `#f3f5f9` (fails), 5.231 on `#161f2e`; `#1f7a8c`: 4.558 / 3.325; `#e0356f`: 3.920 / 3.866; `#5b3fd6`: 6.153 / 2.463 (fails). The text of REQ-070 is right on all eight numbers |
| F4 | The real check on the sketch built from the sample **with the sample colours** | `cd tools && node src/picker/cli.js check <sketch>/stock.json` → code 1, one line: `look.colors.light.accent: E_LIMIT: Контраст цвета с листом светлой темы меньше 3,0 : 1. Возьмите цвет темнее.`; `agency.json` → code 1, one line: `look.colors.dark.accent2: E_LIMIT: … Возьмите цвет светлее.` Nothing else in either file |
| F5 | **Texts shared by the two sample tenants** (criterion 4 forbids them) | `dups.mjs` over the two sketch files, all strings: `look.team[0].role` («приём заявок» / «өтінімдерді қабылдау» / «reception») and `look.team[3].role` («выдача результата» / «нәтижені беру» / «handover») are equal in the two tenants on all three languages; the option id `none` stands in `stock` question `sys` and in `agency` question `intake`. No other equal id or visitor text. The check does not see it (each file passes alone) |
| F6 | The tag `?` of «Пока нигде» | the sketch file with `object: { id: "monitor", tag: "?" }` at `questions[1].options[3]` → code 1, `questions[1].options[3].object.tag: E_FIELD: Допустимы только буквы и цифры, без пробелов. Исправьте значение.`; without the `tag` → accepted. Other tags of the sample (`1С`, `SAP`, `XLS`, `IG`, `GIS`, `TT`, `ALL`, `WA`, `CRM`) pass |
| F7 | All other sample texts pass | the sketch files with the sample colours replaced (F9) and the `?` tag removed: `stock` → `Файл арендатора stock в порядке: вопросов 5, решений 4, правил 15.`, `agency` → `… вопросов 5, решений 4, правил 15.` (both code 0). Every text that comes from the sample fits every limit (title ≤ 200, label ≤ 100, role and says ≤ 40, tagline ≤ 40, industry ≤ 60, headline ≤ 120, unit ≤ 20, intro ≤ 400) and the 18-word rule, «ты» and the forbidden signs. The numbers of ru, kk and en are equal in every sample text (helper `numbersOf` of `tools/test/picker-lang-helpers.js`); no sample en text holds a Cyrillic letter; the intro number is 5 in ru («5 вопросов»), kk («5 сұраққа»), en («5 questions») in both tenants |
| F8 | The engine on the sketch (`computeResult(tenantInLanguage(file, lang), answers)`, ru, kk, en identical) | table 7.1. For `half` (answers to the first two questions only) the engine returns `{ code: "E_ANSWER", question: "sku", reason: "missing_required" }` (stock) and the same for `budget` (agency): REQ-055 refuses a missing required answer; the use of `half` is REQ-072's |
| F9 | The replacement colours | `colour.mjs`: HSL of `#e0731f` = (26.1°, 0.757, 0.500); lightness − 0.01 per step, hue and saturation kept, rounded to 8-bit: step 1 `#dc711e` = 2.995 (fails), step 2 `#d76e1e` = 3.134 (passes). `#5b3fd6` = (251.1°, 0.648, 0.543); lightness + 0.01 per step: step 4 `#6950da` = 2.962 (fails), step 5 `#6d54da` = 3.096 (passes). Hue of the results 25.9° and 251.2°, saturation 0.755 and 0.644 |
| F10 | The data files must be written in the form of `prettier` (`npm run check` runs `prettier --check .` over `.json` too) | the sketch files as `JSON.stringify(…, null, 2)` → `prettier --check` lists both files (lists such as `chips` and `any_of` are printed on one line by prettier); after `prettier --write` → "All matched files use Prettier code style!". The released demo tenants pass |
| F11 | **Old tests with the new files placed** (fresh clone, the four files copied in and `git add`-ed) | `cd tools && node --test test/picker-*.test.js test/traces-*.test.js` → 472 tests, 472 pass; the whole suite `node --test "test/**/*.test.js"` → **2044 tests, 2044 pass, 0 fail, 0 skipped, 0 todo**; `node src/traces/cli.js` → code 0 (`файлов проверено 2185, следов 0`). No test counts the files of `demo-tenants`; the tests that read the picker folder with `readdirSync` (`picker-config.test.js:751`, `picker-engine.test.js:1366`, `picker-look-property.test.js:468`, `picker-server-units.test.js:659`, `picker-server-faults.test.js:1193`, `picker-server.test.js:1548`, `:1555`, `:2282`) read the files `*.js` of `src/picker/`, and the new folders hold only `.json` |
| F12 | The stand | `serve --tenants src/picker/demo-tenants-v3 --port 0` on the sketch prints five lines: `Сайт подбора запущен. Откройте ссылки:`, `http://127.0.0.1:<port>/t/agency/`, `http://127.0.0.1:<port>/t/stock/` (**sorted by id: agency first**), `Изменения файлов арендаторов применяются после перезапуска.`, `Остановить сайт: Ctrl+C.`. `GET /t/<id>/api/questionnaire?lang=ru, kk or en` → keys `version, lang, languages, name, look, intro, questions_min, questions_max, questions, ai, leads`; `desk` of the questions `1,2,3,3,4`; every option has `object`; `chips` on the number question; `leads.whatsapp` = the number of the file. The old stand: five lines as before (`svet-marketing`, `uchet-pro`); the six sha256 of its questionnaires are the control values of REQ-069 F4 and were obtained again today (equal); sha256 of the four old data files in 8.3 (the sha256 of `engine.js` was measured too and is equal, but it is **not pinned** by a test: V2, N4) |
| F13 | A broken neighbour does not stop `check` | folder with the sketch `stock.json` and a broken `agency.json` (`{`): `check <folder>/stock.json` → `Файл арендатора stock в порядке: вопросов 5, решений 4, правил 15.`, code 0. `serve --tenants <that folder>` starts, prints `Арендатор agency.json не обслуживается:` and the `E_JSON` line, and serves `stock` (existing behaviour of REQ-056) |
| F14 | The criterion greps | `grep -rnE 'https?://\|@[a-z]+[.][a-z]+' src/picker/demo-tenants-v3/ src/picker/demo-answers-v3/` on the sketch → empty, code 1; `grep -rnoE '[0-9]{10,}'` → only `77010000000` and `77020000000` |
| F15 | Names in the task against the files (AP-111) | the folders `tools/src/picker/demo-tenants` and `demo-answers` exist with two files each. **Files `picker-demo*.test.js` do not exist** (the handoff names them): the demo tenants are read by `picker-config`, `picker-engine`, `picker-lang`, `picker-text`, `picker-look`, `picker-server` tests through the helpers `DEMO_TENANTS`, `DEMO_ANSWERS`, `LEGACY_TENANTS` of `picker-helpers.js` and `demoTenant`, `DEMO_IDS` of `picker-engine-helpers.js`. The new test file `picker-demo-v3.test.js` does not exist yet (this work creates it) |
| F16 | The engine on the six old answer sets (rework, 2026-10-27 05:39Z) | `computeResult(tenantInLanguage(file, lang), set)` for `demo-tenants/<id>.json` with `demo-answers/<id>.json`, ru, kk, en identical for each set: table 8.3 |
| F17 | Mutants MU29 and MU30 on the sketch (rework) | MU29 (`agency` `look.team[1].role` rewritten, a text that is not shared) and MU30 (`agency` desk 1 role = the `stock` role in capitals with a leading space, a double inner space and a trailing space): `check` of both files → code 0 with the ok line each. So only the tests can see them |

## 2. Decisions of the design

- **D1. Fixed by this design, not left to the executor:** the ids of questions, options, solutions, rules and hypotheses, the points and the conditions of the rules, `result`, the lead settings, `figure` and `shirt`, the objects of the options. The executor writes **texts** (and only the texts named in section 6.4). Reason: the sets of answers and their engine outcomes (criterion 3) depend on the rules, and the tests need literals that do not come from the data under test.
- **D2. The second tenant is the one edited** when the sample shares a text (E2, E3). The first tenant keeps the sample text.
- **D3. The folders hold exactly the two files.** A third file in a folder would be served (`serve` takes the folder whole); DT-6a lists the folder.
- **D4. The number question has no options in `/3`.** The four threshold options of the sample (`b1`…`b4`, with `max`, icon and lines) are dropped; their thresholds live on in the rules as `min`/`max` conditions (5000/5001 and 10001 for `sku`; 700000/700001 and 2000001 for `budget`).
- **D5. Not carried from the sample** (belong to other requirements): `pal.btn`, `onBtn`, `accT`, `accTN` (derived by REQ-087), `pal.day`, `pal.night` (the page), `ref`, `rate`, `base`, `lines` (the estimate, REQ-073), `def`, `icon` (REQ-074), `demo` (sample requests), `pkg` (used only as the ru name of the base solution).
- **D6. `half`** = the answers of the `leader` set to the first two questions in file order. The engine is not run on it here (F8).
- **D7. No phone in `privacy_contact`**: the only digit runs of ten or more in the files are the two `whatsapp` numbers (criterion 7 then needs no third item).
- **D8. Tests do not copy the data.** They use independent oracles: their own contrast function with literal sheets, literal tables of this design, the sample module loaded with a substituted `window`, the helper `numbersOf` of REQ-061, the real `check` command, the real engine with literal expected outcomes.

## 3. Files, owners, order

| File | Created / changed | Owner | Notes |
|---|---|---|---|
| `tools/src/picker/demo-tenants-v3/stock.json` | created | BACKEND-DEV | format `/3`, prettier form |
| `tools/src/picker/demo-tenants-v3/agency.json` | created | BACKEND-DEV | same |
| `tools/src/picker/demo-answers-v3/stock.json` | created | BACKEND-DEV | table 7.2, prettier form |
| `tools/src/picker/demo-answers-v3/agency.json` | created | BACKEND-DEV | same |
| `tools/README.md` | changed | BACKEND-DEV | one paragraph in the section "A stand of two made-up tenants" (14.1) |
| `tools/test/picker-demo-v3.test.js` | created | TEST-DESIGNER (step 5) | no helper file; shared helpers are only imported |

Not changed (and why a reader may ask): `engine.js`, `server.js`, `view.js`, `public-data.js`, `tenants.js`, `check.js` and every other `src/picker/*.js` (no code change is needed: F11, F12); `public/` (the page); `demo-tenants/` and `demo-answers/` (criterion 6; their sha256 are pinned in DT-6b); `tools/test/picker-helpers.js` and the other helpers (imported only; a new constant in a shared helper would be a second writer of one file); `tools/package.json`, `eslint.config.js`, `.prettierignore`.
Order: the data files (the tests read them), then the answers, then README, then the test file.

## 4. The path map: sample field → tenant file field

`T` is `SAI.TENANTS.stock` or `SAI.TENANTS.agency` of `data.js`. Both files: `"schema": "sai-picker-tenant/3"`.

| Sample | File | Rule |
|---|---|---|
| `T.id` | `id` | as is (`stock`, `agency`) |
| `T.name` (one string) | `name.ru`, `name.kk` | the string; `name.en` = the Latin spelling that the sample's own en intro uses: `Skladeon`, `Leadway` (no sample value: compared with a literal, 6.1) |
| `T.initial` | `look.mark` | as is (`С`, `Л`) |
| `T.tag` | `look.tagline` | the three-language object as is |
| `T.industry` | `look.industry` | as is |
| `T.headline` | `look.headline` | as is |
| `T.pitch` | `intro` | as is (the number 5 equals the number of questions) |
| `T.pal.accent` | `look.colors.light.accent` and `look.colors.dark.accent` | as is; **`stock` light is replaced** (6.3) |
| `T.pal.accent2` | `look.colors.light.accent2` and `look.colors.dark.accent2` | as is; **`agency` dark is replaced** (6.3) |
| `T.team[i].name` | `look.team[i].name` | as is |
| `T.team[i].role` | `look.team[i].role` | as is, except E2 and E3 of `agency` (6.1) |
| `T.say[i]` | `look.team[i].says` | as is (index to index) |
| `T.team[i].shirt` | `look.team[i].shirt` | the sample colour equals `pal.accent` → `accent`; equals `pal.accent2` → `accent2`; else `ink`. Result `stock`: `accent, accent2, ink, ink`; `agency`: `accent, accent2, ink, ink` |
| skin, hair, style of `T.team[i]` | `look.team[i].figure` | the sample's drawing has no id in the catalogue (REQ-071 draws `f01`…`f12`); fixed here: `stock` `f01, f02, f03, f04`; `agency` `f05, f06, f07, f08` (I4, accepted: `decisions/0086` item 4) |
| `T.questions[j].id`, `.title` | `questions[j].id`, `.title` | as is; every question `required: true`, none has `show_if` |
| `kind` `choice` / `number` | `type` `single` / `number` | |
| `st` | `desk` | `st + 1`: `1, 2, 3, 3, 4` |
| `opts[k].id`, `.label` | `options[k].id`, `.label` | as is, except the two id renames (6.2) |
| `opts[k].prop` | `options[k].object` | the table 5.1 |
| number question `unit`, `chips` | `unit`, `chips` | as is; add `min` 1 and `max` 1000000 (`sku`) / 100000000 (`budget`); the options `b1`…`b4` are dropped (D4) |
| `T.wa` | `leads.whatsapp` | as is (`77010000000`, `77020000000`) |
| `T.pkg` | `solutions[0].name.ru` | `Склад-Контроль`, `Лид-Поток`; kk and en by the executor |

## 5. The content that the sample does not hold (fixed here)

### 5.1 Questions, options, objects

| Tenant | Question (`type`, `desk`) | Options `id` → `object` |
|---|---|---|
| stock | `sites` (single, 1) | `one` → `shelf` level 1; `few` → `shelf` level 2; `many` → `shelf` level 3; `shop` → `shop` (the sample's `prop` is a shelf with a shop flag, which `/3` cannot say; its `icon` is `shop`) |
| stock | `sys` (single, 2) | `s1c` → `monitor` tag `1С` (as in the sample: digit 1 and the Cyrillic С); `sap` → `monitor` tag `SAP`; `xls` → `monitor` tag `XLS`; `nowhere` → `monitor` **without tag** (E1) |
| stock | `sku` (number, 3) | `min` 1, `max` 1000000, `unit`, `chips` [500, 3000, 10000, 50000]; no options |
| stock | `count` (single, 3) | `scan` → `scanner`; `tsd` → `tsd`; `paper` → `clip` |
| stock | `support` (single, 4) | `self` → `bell`; `phone` → `phone`; `dedic` → `headset` |
| agency | `offer` (single, 1) | `srv` → `poster` glyph `tool`; `goods` → `poster` glyph `box`; `real` → `poster` glyph `house`; `edu` → `poster` glyph `cap` |
| agency | `chan` (single, 2) | `ig` → `monitor` tag `IG`; `g` → `monitor` tag `GIS`; `tt` → `monitor` tag `TT`; `all` → `monitor` tag `ALL` |
| agency | `budget` (number, 3) | `min` 1, `max` 100000000, `unit`, `chips` [200000, 500000, 1000000, 3000000]; no options |
| agency | `intake` (single, 3) | `wa` → `cell` tag `WA`; `call` → `phone`; `form` → `laptop` tag `CRM`; `nothing` → `clip` |
| agency | `report` (single, 4) | `m` → `chart` level 2; `w` → `chart` level 4; `pm` → `headset` |

### 5.2 Solutions, rules, hypotheses, result

Both tenants: `result` = `top` 3, `min_score` 5, `clear_lead_gap` 3, `no_match_text` (text by the executor). Solutions in this order (the order breaks ties). The solution **with `price_text` and `duration_text` is the first one only**; the other three have neither.

**stock** — solutions: `sk-base` «Склад-Контроль» (price and duration), `sk-exchange` «Обмен с 1С и SAP», `sk-terminal` «Склад с терминалами», `sk-network` «Сеть складов и магазинов».

| Rule | Solution | Points | Condition (all must hold) | Meaning for the text |
|---|---|---|---|---|
| sk-r01 | sk-base | +4 | `sites` is `one` | one warehouse: the base accounting is enough |
| sk-r02 | sk-base | +3 | `sku` ≤ 5000 | a small catalogue |
| sk-r03 | sk-base | +2 | `count` is `scan` or `paper` | simple counting |
| sk-r04 | sk-base | +2 | `support` is `self` | the staff manages alone |
| sk-r05 | sk-base | +2 | `sys` is `xls` or `nowhere` | no system to connect |
| sk-r06 | sk-base | −4 | `sites` is `many` or `shop` | the base package is too small for a network |
| sk-r07 | sk-exchange | +5 | `sys` is `s1c` or `sap` | the books are in 1C or SAP: exchange is needed |
| sk-r08 | sk-exchange | +2 | `sku` ≥ 5001 | a large catalogue needs exchange of catalogues |
| sk-r09 | sk-exchange | +1 | `support` is `dedic` | a dedicated specialist watches the exchange |
| sk-r10 | sk-terminal | +5 | `count` is `tsd` | a handheld terminal |
| sk-r11 | sk-terminal | +3 | `count` is `scan` | a barcode scanner |
| sk-r12 | sk-terminal | +3 | `sku` ≥ 10001 | many items: counting by hand does not work |
| sk-r13 | sk-network | +5 | `sites` is `many` or `shop` | many warehouses or shops |
| sk-r14 | sk-network | +2 | `sites` is `few` | two or three warehouses |
| sk-r15 | sk-network | +2 | `support` is `dedic` | a network needs one person on call |

Hypotheses: `sk-h1` when `sys` is `xls` or `nowhere` (the data live in tables); `sk-h2` when `count` is `paper` **and** `sku` ≥ 3000 (counting on paper on a large catalogue).

**agency** — solutions: `lw-start` «Лид-Поток» (price and duration), `lw-channels` «Каналы и реклама», `lw-intake` «Приём и учёт заявок», `lw-report` «Отчёты и личный менеджер».

| Rule | Solution | Points | Condition | Meaning for the text |
|---|---|---|---|---|
| lw-r01 | lw-start | +4 | `budget` ≤ 700000 | a modest budget |
| lw-r02 | lw-start | +3 | `chan` is `ig` or `g` | one channel to start |
| lw-r03 | lw-start | +2 | `offer` is `srv` | a service sells through one page |
| lw-r04 | lw-start | +2 | `report` is `m` | a monthly report is enough |
| lw-r05 | lw-start | −4 | `budget` ≥ 2000001 | the start package is too small |
| lw-r06 | lw-channels | +5 | `chan` is `all` | all channels at once |
| lw-r07 | lw-channels | +3 | `budget` ≥ 700001 | a larger budget needs account management |
| lw-r08 | lw-channels | +2 | `chan` is `tt` | video needs its own production |
| lw-r09 | lw-channels | +2 | `offer` is `goods` or `real` | a catalogue of goods or objects |
| lw-r10 | lw-intake | +4 | `intake` is `nothing` | no system for requests yet |
| lw-r11 | lw-intake | +3 | `intake` is `form` | a site form feeding a table |
| lw-r12 | lw-intake | +2 | `intake` is `wa` or `call` | quick replies and missed calls |
| lw-r13 | lw-report | +5 | `report` is `pm` | a personal manager |
| lw-r14 | lw-report | +3 | `report` is `w` | a weekly report |
| lw-r15 | lw-report | +2 | `budget` ≥ 2000001 | a large budget needs a closer watch |

Hypotheses: `lw-h1` when `intake` is `nothing` (requests are lost); `lw-h2` when `chan` is `all` **and** `budget` ≤ 700000 (too many channels for the money).

Every rule has a fixed id, solution, points and condition; each gets one `text` (ru, kk, en) saying its "meaning" in plain words. The `check` line of each file is `Файл арендатора <id> в порядке: вопросов 5, решений 4, правил 15.`

### 5.3 Leads

| Field | stock | agency |
|---|---|---|
| `enabled` | `true` | `true` |
| `contact_fields` | `["phone", "telegram"]` | `["phone"]` |
| `whatsapp` | `"77010000000"` | `"77020000000"` |
| `retention_days` | 90 | 60 |
| `operator_name` | one string naming the company (for example «ТОО Складеон»), executor | one string (for example «ТОО Лидвейв»), executor |
| `consent_text` | three languages, executor, **its own wording** | the same, **another wording** |
| `privacy_contact` | one string, a role or a place, **no digits run of ten or more, no `@`, no address** (D7) | another string |

`max_per_hour` and `max_stored` are not written (the defaults of REQ-059 apply).

## 6. Edits, renames, colours, and what the executor chooses

### 6.1 Table of edits (≤ 6 rows; `was → became → reason`)

The reason is a code of the check (`E_…`) or `SEP` (criterion 4; the amendment of criterion 2, `decisions/0086` item 1). Rows E2 and E3 give ru and en; the kk text is the same change in Kazakh, written by the executor and read by the reader of criterion 5 (the sample kk phrases are `өтінімдерді қабылдау` and `нәтижені беру`; the new ones keep the grammar and replace only the noun: `клиенттерді қабылдау`, `жоспарды беру`).

| Row | Path (file) | Was (sample) | Became | Reason |
|---|---|---|---|---|
| E1 | `stock` `questions[1].options[3].object.tag` | `?` (one plain string, sample field `prop.x` of `questions[1].opts[3]`; not a three-language object) | the field `tag` is absent (no own key) | `E_FIELD` (F6) |
| E2 | `agency` `look.team[0].role` | ru «приём заявок», kk «өтінімдерді қабылдау», en «reception» | ru «приём клиентов», kk «клиенттерді қабылдау», en «client reception» | `SEP` (F5) |
| E3 | `agency` `look.team[3].role` | ru «выдача результата», kk «нәтижені беру», en «handover» | ru «выдача плана», kk «жоспарды беру», en «plan handover» | `SEP` (F5) |

No ru text of the sample fails a text rule (F7), so there is no row for a phrase length, a forbidden sign or «ты». The test holds this table as data (path, was per language, became per language, reason) and checks (DT-2c): not more than 6 rows; the file value at each path equals `became` and the sample value equals `was`; every other mapped text equals the sample on each language. Two comparison rules that the table needs (V5):

- **An absent field (row E1).** The `became` of E1 is «absent», and absent means the object at `questions[1].options[3].object` has **no own key** `tag` (`Object.hasOwn(object, "tag") === false`). A `tag` that is an empty string, `null` or `undefined` does not count as absent. The sample side of E1 is the value read from the sample at `questions[1].opts[3].prop.x`, and it must be the string `?`. The other tags of the sample (`prop.x` of the other options) are plain strings compared with the literals of table 5.1 in DT-1b.
- **`name`.** The sample holds one string `T.name`, so `name.ru` and `name.kk` of the file equal it. `name.en` has no sample value; it is compared with the **literal** `Skladeon` (`stock`) or `Leadway` (`agency`) held in the test, and the test also checks that the en `pitch` of the sample begins with that literal (`Skladeon connects`, `Leadway brings`), so the literal is the sample's own spelling. These are not rows of the table of edits: `name.en` is a derived field of the path map, not an edit of a sample text.

**Rows with the reason `SEP` and DT-2d (V1).** For every row whose reason is `SEP`, the `was` text in each of ru, kk and en must stand **word for word** (no folding of case or spaces: the sample is compared as it is) at the same mapped path of **both** sample tenants: the sample value at that path in the tenant of the row equals `was` (DT-2c) and the sample value at the same path in the other tenant equals `was` too (DT-2d). For E2 these are `STOCK.team[0].role` and `AGENCY.team[0].role`; for E3 `STOCK.team[3].role` and `AGENCY.team[3].role`. A row with another reason (a code of the check, for example E1) is **not** asked for this: the `?` of E1 stands in `stock` only, and a test that demanded it would fail E1. Without DT-2d the word `SEP` would be a free label that excuses any rewrite of any text.

**Note after the run (`decisions/0087`).** The corrections of the independent readers (criterion 5) are not rows of this table. They are a **separate literal table** in the test (16 rows: path, the sample text, the corrected text, the number of the pair), which DT-2c reads next to this one; the file must equal the corrected text word for word. This table stays at **six rows at most**. One row of the reader table (pair 99) corrects a text that E2 already changed; it carries the link `after: E2`, and its sample text is the `became` of E2. The text above is the design as it was before the readers' pass and is left unchanged.

### 6.2 Id renames (not texts)

| Tenant | Question | Sample option id | File option id | Reason |
|---|---|---|---|---|
| stock | `sys` | `none` | `nowhere` | the id `none` is used by `agency` `intake` (criterion 4) |
| agency | `intake` | `none` | `nothing` | same |

The answers and the rules use the new ids. No other id of the sample is shared (F5).

### 6.3 The two replacement colours (the table of colours of the test; not counted in the six rows)

Method (stated so that the executor and the test agree): keep the **hue** and the **saturation** of the sample colour (HSL), change only the **lightness** in steps of 0.01, in the direction that raises the contrast with the sheet of the theme (`stock` light: darker; `agency` dark: lighter), round to 8-bit each step, and take **the first step whose contrast with the sheet is at least 3.0** (F9). Expected values: `stock` `look.colors.light.accent` **`#d76e1e`** (3.13 : 1), `agency` `look.colors.dark.accent2` **`#6d54da`** (3.10 : 1). The executor recomputes them and writes them with a different value only if its own computation differs.

| Where | Was | Contrast was | Became | Contrast became | Reason |
|---|---|---|---|---|---|
| `stock` `look.colors.light.accent` (sheet `#f3f5f9`) | `#e0731f` | 2.90 | the first step passing | ≥ 3.0 and < 3.4 | rule of REQ-069 (decision 0085 item 4); the values `#d76e1e` and `#6d54da` are chosen by `decisions/0086` item 6 |
| `agency` `look.colors.dark.accent2` (sheet `#161f2e`) | `#5b3fd6` | 2.46 | the first step passing | ≥ 3.0 and < 3.4 | same |

The other six colours stay as the sample: `stock` `dark.accent` `#e0731f`, `light.accent2` and `dark.accent2` `#1f7a8c`; `agency` `light.accent` and `dark.accent` `#e0356f`, `light.accent2` `#5b3fd6`. The test pins them as literals.

### 6.4 The choices left to the executor and the rule for each

| Choice | Rule (what the test checks) |
|---|---|
| Replacement colours | 6.3. The test checks: contrast ≥ 3.0 by its own function without rounding; lower relative luminance (stock) / higher (agency) than the sample colour; hue within 2° and saturation within 0.02 of the sample colour (own HSL function); contrast below 3.4 (not over-corrected); the value differs from the sample colour; the row of the colour table holds this value and its measured contrast to two decimals |
| Digits where the sample is silent | Only inside the new texts. `min`, `max`, `chips`, `desk`, points, `top`, `min_score`, `clear_lead_gap`, `retention_days`, `whatsapp` are fixed here. A number inside a text is written the same in ru, kk and en (the rule of REQ-061); a number of four or more digits is written in groups of three digits with a single space; no decimals. Suggested price and duration: `sk-base` «от 600 000 ₸» / «около 3 недель»; `lw-start` «от 250 000 ₸» / «запуск за 2 недели» (invented) |
| Invented phone numbers | The two `whatsapp` numbers are fixed by the requirement. No other phone is written (D7) |
| The texts of the solutions, rules, hypotheses, `no_match_text`, lead texts | In ru, kk, en: each text 1 to the limit of its field (`name` ≤ 80, `summary` ≤ 300, every `includes`, `needs_from_you`, `next_steps` and `not_suitable_when` item ≤ 150, `price_text` and `duration_text` ≤ 120, rule `text` ≤ 200, hypothesis `title` ≤ 100 and `explanation` ≤ 300, `no_match_text` ≤ 300, `consent_text` ≤ 600); every phrase ≤ 18 words; ru in the form «вы»; no forbidden sign; en without Cyrillic; same numbers in the three languages (watch the solution name «Обмен с 1С и SAP»: the en name carries the number 1); `includes` 2–4 items, `needs_from_you` 1–3, `next_steps` 2–3, `not_suitable_when` 1–2. **Each text is the tenant's own wording: no sentence (including `no_match_text` and `consent_text`) may be the same in the two files** (criterion 4). No address, no `@`, no digit run of ten or more |
| kk and en of the solution names (the sample gives only the ru package names) and of the rows E2, E3 | By the executor from the ru text; the reader (criterion 5) judges them |
| `figure`, `shirt` | Fixed in section 4 (I4, `decisions/0086` item 4) |

## 7. The answer sets and the engine result

### 7.1 Sets (the answer files, section 3), and the result of the real engine

Each file has the four keys `leader`, `close`, `none`, `half`, in this order. `computeResult(tenantInLanguage(file, lang), answers)` was run on the sketch for `ru`, `kk`, `en`: the three results are identical in ids, scores, labels.

| Tenant | Set | Answers | `clear_leader` | `recommended` (id : score) | `no_match_text` | `ranking` (all four) | `hypotheses` |
|---|---|---|---|---|---|---|---|
| stock | leader | `sites` one, `sys` xls, `sku` 1200, `count` paper, `support` self | true | sk-base : 13 | null | sk-base 13, sk-exchange 0, sk-terminal 0, sk-network 0 | sk-h1 |
| stock | close | few, s1c, 8000, tsd, phone | false | sk-exchange : 7, sk-terminal : 5 | null | sk-exchange 7, sk-terminal 5, sk-network 2, sk-base 0 | none |
| stock | none | few, xls, 8000, paper, phone | null | none | the file's text | sk-base 4, sk-exchange 2, sk-network 2, sk-terminal 0 | sk-h1, sk-h2 |
| stock | half | `sites` one, `sys` xls | — | the engine is not run (F8) | — | — | — |
| agency | leader | `offer` srv, `chan` ig, `budget` 500000, `intake` wa, `report` m | true | lw-start : 11 | null | lw-start 11, lw-intake 2, lw-channels 0, lw-report 0 | none |
| agency | close | goods, tt, 1500000, wa, pm | false | lw-channels : 7, lw-report : 5 | null | lw-channels 7, lw-report 5, lw-intake 2, lw-start 0 | none |
| agency | none | edu, tt, 250000, nothing, w | null | none | the file's text | lw-start 4, lw-intake 4, lw-report 3, lw-channels 2 | lw-h1 |
| agency | half | `offer` srv, `chan` ig | — | the engine is not run (F8) | — | — | — |

"Явный лидер" is `clear_leader === true`; "близкие варианты" is `clear_leader === false` with 2 or 3 recommended; "ничего не подошло" is an empty `recommended` and `no_match_text` equal to the file's text in that language. The sets are far from the edges except the close sets (gap 2 against the gap 3) and the none sets (best score 4 against `min_score` 5); a one-point change of a rule or of `min_score` or `clear_lead_gap` flips them (mutants MU11–MU13).

### 7.2 What each answer file is

A JSON object with the four keys; a value of a question is an option id (single) or a whole number inside `min…max` (number). `leader`, `close`, `none` answer all five questions; `half` answers `sites`, `sys` (stock) and `offer`, `chan` (agency). The numbers `1200`, `8000`, `500000`, `1500000`, `250000` lie inside the question's limits.

## 8. The criteria → tests (Q5)

### 8.1 Table

| Criterion (REQ-070) | Test (`tools/test/picker-demo-v3.test.js`) | Fails when |
|---|---|---|
| 1. Both files pass the check; the composition | DT-1a, DT-1b, DT-1c, DT-1d | a value of 5.x differs; a colour is below 3.0; a replacement breaks its rule; the check rejects a file |
| 2. Three languages; the intro tells the truth; ru texts = sample except the table; the reason of each row is a code of the check or `SEP` | DT-2a, DT-2b, DT-2c, DT-2d | a text is empty or lost in one language; numbers differ; Cyrillic in en; the intro number ≠ 5; a ru text differs from the sample outside the table; a row is marked `SEP` while its `was` text is not shared by the two sample tenants |
| 3. Outcomes of the sets | DT-3a, DT-3b, DT-3c | a set refers to a foreign id; a required answer is missing; `half` has not two answers; the label, the recommended ids or the scores differ |
| 4. The files are separate | DT-4a, DT-4b, DT-4c, DT-4d | an id or a visitor text of one file stands in the other, in any language; a colour is shared; `check` of one file reads the other |
| 5. The meaning of the translations was checked by a separate reader | the acceptance step of BA-ANALYST (WF-02 step 8) with the row counts; DT-5a pins the counts the reader's table must have | a `{ru,kk,en}` object is not a complete triple, or the `grep` count differs from the count of triples |
| 6. The new stand and the old stand | DT-6a, DT-6b, DT-6c | the output of `serve` differs; a questionnaire lacks `look`, `desk`, `object`; the old stand changes; the README lacks the command |
| 7. Made-up data; nothing extra | DT-7a, DT-7b; and the commands `npm run traces`, `npm run check`, the `grep -c '^test('` loop (run by RELEASE-VALIDATOR and TEST-RUNNER; they need no new test) | an address or a mail in a file; a digit run beyond the two numbers |

### 8.2 Catalogue of the tests (21)

Common to all: files are read once at the start; `check` runs through `runPicker` of `picker-helpers.js` (`viaNpm: true` for the first call of DT-1a, as the criterion writes `npm run picker --`); servers through `spawnCli`, `request` of `picker-server-helpers.js`. The test file defines its own constants for the new folders (no shared helper changes). The sample is loaded with `vm.runInNewContext(text, { window })`; the contrast and HSL functions are written in the test file. No `skip`, no `todo`, no turned-off rule.

| Id | What it checks |
|---|---|
| DT-1a | For `stock.json` and `agency.json`: `npm run picker -- check src/picker/demo-tenants-v3/<id>.json` → code 0, stderr empty, stdout exactly the line `Файл арендатора <id> в порядке: вопросов 5, решений M, правил K.` with M = 4 and K = 15 (the criterion needs M ≥ 3, K ≥ 12; the numbers are also compared with the counts of the parsed file); the file bytes are unchanged by the run (digest) |
| DT-1b | Literals of 5.x: schema; ids and order of the five questions; types; `required` true; no `show_if`; options and `object` of every option (table 5.1; `nowhere` has no `tag`); `desk` 1, 2, 3, 3, 4; `min`, `max`, `chips`, `unit` present; solutions (ids, order, names ru of the first); only the first solution has `price_text` and `duration_text` and the others have neither; rule ids with solutions and points (5.2); hypotheses ids; `result`; `leads` (5.3, `whatsapp` of 11 digits); `look`: mark, four staff with `figure` and `shirt` (section 4), tagline/industry/headline present |
| DT-1c | The eight colours: form `#rrggbb`; contrast with the literal sheets `#f3f5f9` (light) and `#161f2e` (dark) by the test's own formula (no rounding) ≥ 3.0; the six unchanged colours equal the literals of 6.3; the two replacements obey the rule of 6.4; each has a row of the colour table with the contrast was/became to two decimals (was 2.90 and 2.46) |
| DT-1d | A copy (in a temporary folder) of each file with the sample's colour put back (`#e0731f`, `#5b3fd6`): `check` → code 1 and exactly one line, at `look.colors.light.accent` / `look.colors.dark.accent2`, code `E_LIMIT`; the copy and the project files are unchanged (digests) — proof that the rule bites and that the replacement table is needed |
| DT-2a | Every `{ru,kk,en}` object of both files (found by walking) has three non-empty strings; `operator_name` and `privacy_contact` are non-empty strings; `numbersOf` of the three are equal; no Cyrillic letter in en |
| DT-2b | The number before «вопрос», «сұрақ» or «question» in `intro` of each language equals the number of the file's questions (5) |
| DT-2c | The table of edits (6.1): ≤ 6 rows; each reason is a code of the ten of the check or `SEP`; for the mapped paths of section 4 the ru, kk and en values equal the sample's (loaded with the substituted `window`), except the rows of the table, where the sample value equals `was` and the file equals `became`; an absent field (E1) is compared as «no own key `tag`» and the sample side must be `?`; `name.ru` and `name.kk` equal the sample string, `name.en` equals the literal `Skladeon` / `Leadway` and the sample en `pitch` begins with it (6.1); the id renames (6.2). Note after the run (`decisions/0087`): the corrections of the independent readers are a separate literal table of 16 rows in the test, read by DT-2c beside the table of edits (which stays at six rows at most); for those paths the kk and en file value equals the corrected text, and pair 99 carries the link `after: E2` |
| DT-2d | For every row of the table of edits whose reason is `SEP`: for each of ru, kk, en the `was` text equals, word for word (no folding), the sample value at the same mapped path in **both** sample tenants (6.1); rows with a check code are skipped; the test fails when a `SEP` row names a text that only one sample tenant holds (the table and the file may agree: DT-2c cannot see it) |
| DT-3a | The answer files: exactly the keys `leader, close, none, half`; every key is a question id of its own tenant and no other; single values are ids of that question's options; number values are whole numbers inside `min…max`; `leader`, `close`, `none` have all five; `half` has exactly the first two questions of the file |
| DT-3b | For each tenant, set, language: `computeResult(tenantInLanguage(file, lang), set)` is ok; `clear_leader`, the ids and scores of `recommended`, `ranking`, `hypotheses` equal the literals of 7.1; `no_match_text` is null or equals the file's text of that language; `leader` has 1 recommended, `close` 2 or 3, `none` 0; the three languages give the same ids and scores |
| DT-3c | The scoring is not read from the file: the test scores the sets again with its own small function from the literal rule table of 5.2 and compares the four totals per set with the ranking of DT-3b (a second computation, as in REQ-055) |
| DT-4a | The sets of ids (tenant, question, option, solution, rule, hypothesis) of the two files are disjoint |
| DT-4b | For each of ru, kk, en: the set of all visitor strings of `stock` (name, look texts, intro, question and option texts, unit, solution, rule, hypothesis, result, lead texts, `operator_name`, `privacy_contact`) and that of `agency` have no common element. **The fold (V6):** every string is first folded the same way on both sides — lower case (`toLowerCase`), leading and trailing spaces cut, every run of spaces and line breaks inside collapsed to one space — and the folded sets are compared; so «Приём  заявок » equals «приём заявок». Ids (DT-4a) are compared exactly |
| DT-4c | The four colours of one file and the four of the other have no common value |
| DT-4d | A temporary folder with the real `stock.json` and a broken `agency.json` (`{`): `check <folder>/stock.json` → code 0 and the ok line; the same for `agency.json` against a broken `stock.json`; the files are unchanged afterwards |
| DT-5a | For each file: the count of `"kk":` by a regular expression on the file text equals the count of `{ru,kk,en}` triples found by walking, which equals the count of `"en":`; each triple has exactly the keys `ru`, `kk`, `en` (this is the number of rows the reader's table must hold) |
| DT-6a | `serve --tenants src/picker/demo-tenants-v3 --port 0`: five lines (links `agency` then `stock`), stderr empty; the folder holds exactly `stock.json` and `agency.json`, the answers folder the same two names; `GET /t/<id>/api/questionnaire?lang=ru, kk or en` → 200 with `look`, `desk` on every question, `object` on every option, `chips` on the number question, `leads.whatsapp` equal to the file; SIGTERM → code 0 |
| DT-6b | The old stand: `serve --tenants src/picker/demo-tenants --port 0` prints the old five lines; the six sha256 of its questionnaires equal the literals of REQ-069 F4; sha256 of `demo-tenants/*.json` and `demo-answers/*.json` (four files) equal the literals of 8.3; the real engine on the six old answer sets (`leader`, `close`, `none` of both old tenants, ru, kk, en) gives the labels, ids and scores of the table in 8.3. **`engine.js` is not pinned** (V2): a later requirement changes it on purpose, and criterion 6 asks for the run-relative `git diff` (8.4), which is not a standing test |
| DT-6c | `tools/README.md` has the exact command `npm run picker -- serve --tenants src/picker/demo-tenants-v3 --home <folder outside the project>` and the names `stock` and `agency` in the section of the stand (AP-077: the text of 14.1 and the test are agreed) |
| DT-7a | `grep -rnE 'https?://\|@[a-z]+[.][a-z]+'` on the two data folders: process code 1 (spawn of `grep`) and no match by an own regular expression over the files |
| DT-7b | Every run of ten or more digits in the four folders' files, listed: exactly `77010000000` in `stock.json` and `77020000000` in `agency.json`; no other |

The ids above are 21: DT-1a…1d (4), DT-2a…2d (4), DT-3a…3c (3), DT-4a…4d (4), DT-5a (1), DT-6a…6c (3), DT-7a, 7b (2). The file holds 21 `test(` calls, one per id.

### 8.3 Literals the old-stand test pins (measured today)

| File | sha256 |
|---|---|
| `demo-tenants/svet-marketing.json` | `0deb80e04aee0a515223cee51b18b51bbdcb563dfeec61c6e1eb0c4659b5d9fd` |
| `demo-tenants/uchet-pro.json` | `d4f0885bf5b34469014bcd2e57258ddc04056c5bdf661363749a035ab5a55ee8` |
| `demo-answers/svet-marketing.json` | `8d3be981bde3dfcb49ff44570461c68a1272092f6b68cd09646d9474b9d95393` |
| `demo-answers/uchet-pro.json` | `c412d3987caa0524b223152fa465321e5de71f382444460d1d13b3ed4a2b068e` |

The six questionnaire hashes: `uchet-pro` ru `ed7d65846b4885f0722b6428aab07080820c6cf597681a0ca462d6ebbdcc1e96`, kk `b7ed6ba4f73efa9842cead1006f0c9e6038397441f8345c8576f6d57b47b4081`, en `b74367ccc8716c3780275eef00ac3fc1171cc119166c07afdf788a845cf4d95e`; `svet-marketing` ru `952a99e23c9c060a1b182028aee1c3721220db4b8221745412ebef8ce0ceda60`, kk `53a706196b498567a1e23589339a6b468d0fff61d06defbe5332a54ae9f75024`, en `1a0b16d18ea49937ff863d6fe030728148ece5bd9fb7fa7ff9ab725a8fa3fc7c`.

`src/picker/engine.js` has **no** pin (V2; `decisions/0084` item 1: a criterion that asks for a run-relative command is checked at its own release and is not re-run later). Its sha256 at the tag (`a82637570dde86848ed440d7eee4fbdf4ed2f9b6de943c119b3d9579081ef1fe`) is a measured fact for the release check only. The engine results of the old sets below stay true after a later requirement adds a function to the file.

Engine results for the six old answer sets (measured 2026-10-27, F16; `clear_leader`; `recommended` as id : score; `no_match_text` null or the file's text; ru, kk and en identical):

| Old tenant | Set | `clear_leader` | `recommended` | `no_match_text` |
|---|---|---|---|---|
| uchet-pro | leader | true | sheet-start : 15, shop-kit : 8 | null |
| uchet-pro | close | false | chain-control : 11, shop-kit : 9 | null |
| uchet-pro | none | null | none | the file's text |
| svet-marketing | leader | true | quick-start : 12, content-month : 8 | null |
| svet-marketing | close | false | content-month : 13, guest-return : 11 | null |
| svet-marketing | none | null | none | the file's text |

### 8.4 Commands of the criteria that are not tests

| Command | Runs now? | By |
|---|---|---|
| `git diff --stat base/<RUN-ID> -- tools/src/picker/demo-tenants tools/src/picker/demo-answers tools/src/picker/engine.js` (criterion 6) | yes, empty on the tag tree; run-relative (decision 0084 item 1), checked at the release only; no standing test pins `engine.js` (V2) | RELEASE-VALIDATOR |
| `grep -rnE …` (criterion 7) | yes on the sketch (F14); on the project after the work | DT-7a and RELEASE-VALIDATOR |
| `cd tools && npm run traces` | after the work; measured 0 with the files placed (F11) | RELEASE-VALIDATOR |
| `cd tools && npm run check` ("skipped 0", "todo 0") | after the work | TEST-RUNNER |
| the `for f in $(git ls-tree …)` loop of `test(` counts | after the work; nothing in this design removes a test | RELEASE-VALIDATOR |
| `grep -o '"kk":' …` counts of criterion 5 | after the data is written | BA-ANALYST |

## 9. Guard tests of earlier requirements: the replacement table (AP-068, AP-112, AP-113)

**Empty: no old test turns red** (F11). The full suite of 2044 tests passed with the four files in place. The tests that could be thought to count the files are listed so that nobody searches again:

| Test file (line) | What it reads | Why it stays green |
|---|---|---|
| `picker-helpers.js:19,26` `DEMO_TENANTS`, `DEMO_ANSWERS` | the old folders by constant | the new folders have other names |
| `picker-engine-helpers.js:173` `DEMO_IDS` | the two old ids | a fixed list |
| `picker-server.test.js:98,121` | `--tenants src/picker/demo-tenants` | a fixed path |
| `picker-config.test.js:751`, `picker-engine.test.js:1366`, `picker-look-property.test.js:468`, `picker-server-units.test.js:659`, `picker-server-faults.test.js:1193`, `picker-server.test.js:1548,1555,2282` | `readdirSync` of `src/picker` | they take the `.js` files; the new folders hold `.json` only |
| `picker-lang.test.js:90`, `picker-text.test.js:625,630,704,1038` | named old files | fixed names |
| `picker-page-static.test.js` QS-12 | every `picker-*.js` of `test/`, needs ≥ 25 | the new test file raises the count; it must hold neither `eslint-disable` nor `prettier-ignore` (a word the test file must not write) |

For the new test file: the guard of PK-6e, PK-7c, PE-8d (closed lists of modules) does not see it (it is in `test/`, not a module of `src/picker/`); the file must not contain the words `skip`/`todo` as test options.

## 10. Failure paths (what the user sees, what stays unchanged — Q10, Q5)

| Case | What happens | State |
|---|---|---|
| A data file breaks a rule of the format | `check` prints the lines of REQ-054/069 and ends with code 1 | the file is only read (DT-1a digest, DT-1d) |
| The neighbour file in the folder is broken | `check` of the good file is 0 (F13); `serve` starts, prints the "не обслуживается" line for the broken one and serves the other | no file written; DT-4d |
| An answer file refers to a foreign id or misses a required answer | DT-3a fails with the question id; the engine would answer `E_ANSWER` | no data written |
| A third file lies in a stand folder | `serve` would serve it | DT-6a lists the folder |
| `half` is passed to the engine of REQ-055 | `E_ANSWER` `missing_required` (F8) | nothing; the use is REQ-072's |
| The README command differs from the real one | DT-6c fails | |

The work calls no external service and no address (Q10, Q11): the data holds none (DT-7a).

## 11. Build sub-steps and the expected red tests (measured with the sketch)

| Step | Who | What | Red old tests after it |
|---|---|---|---|
| 70a | BACKEND-DEV | `demo-tenants-v3/stock.json`: from the path map and tables 5.x; then `npx prettier --write` on the file; then `check` (code 0) | none (F11) |
| 70b | BACKEND-DEV | `demo-tenants-v3/agency.json`, the same; `check` of both | none |
| 70c | BACKEND-DEV | `demo-answers-v3/stock.json`, `agency.json` (7.1, prettier form); run the engine on them for the three languages and compare with 7.1 | none |
| 70d | BACKEND-DEV | the README paragraph (14.1) | none (TT-10 reads another section) |
| 70e | TEST-DESIGNER (step 5) | `picker-demo-v3.test.js`: first DT-1*, DT-2*, then DT-3*, DT-4*, then DT-5a, DT-6*, DT-7* | none; the new tests are green when the data is right |

Between 70a and 70e no old test is red and no new test exists. The first three sub-steps of BACKEND-DEV may be done by a script outside the project that reads `data.js` (the sketch generator did this) as long as the committed files are the prettier-formatted output; the script is not kept in the project.
The translations of the new texts are written by the executor (WF-02 step 2) and read by BA-ANALYST at step 8 (criterion 5); the file never gets a text that the executor could not read.

## 12. Mutants (each is applied on a copy by TEST-DESIGN-VALIDATOR and must fail the named test)

Applied to the sketch and measured: MU1, MU2, MU3, MU6, MU28 — `check` code 1; MU4, MU5, MU7, MU9, MU10, MU17, MU20–MU23, MU26, MU27, MU29, MU30 — `check` accepts the changed file (code 0), so only the test can see them; MU11–MU13 — the engine labels turn as written; MU8, MU14–MU16, MU18, MU24, MU25 change files that `check` does not see or are derived by reading (an answer file, a third file, an old file) and are caught by the test named. The column «Seen by» lists every test that sees the mutant (re-read against the test texts in rework 1, V3).

| # | Breakage | Seen by |
|---|---|---|
| MU1 | `stock` `light.accent` back to `#e0731f` (2.90) | DT-1a (code 1), DT-1c |
| MU2 | `agency` `dark.accent2` back to `#5b3fd6` (2.46) | DT-1a, DT-1c |
| MU3 | `stock` `light.accent` = `#dc711e` (2.995; rounds to 3.00, below 3.0 — `check` code 1) | DT-1a, DT-1c (a test that rounds to two decimals would accept it) |
| MU4 | the replacement is far off: `stock` `light.accent` = `#8a3a00` (hue 25.2°, contrast 7.16; `check` accepts) | DT-1c (the bound 3.4) |
| MU5 | the replacement changes the hue: `agency` `dark.accent2` = `#3fd6b3` (contrast 9.04, hue 166°; `check` accepts) | DT-1c (the hue bound) |
| MU6 | the `?` tag restored (`check` code 1, `E_FIELD`) | DT-1a, DT-1b, DT-2c |
| MU7 | `stock` intro ru «5 вопросов» → «4 вопроса» (check accepts) | DT-2a, DT-2b, DT-2c |
| MU8 | `agency` intro en «5 questions» → «6 questions» | DT-2a, DT-2b, DT-2c |
| MU9 | the en intro with Cyrillic С in «1C» | DT-2a, DT-2c |
| MU10 | a kk text of a rule (a text the sample does not hold) with an extra number (a digit added in one language) | DT-2a |
| MU11 | `stock` rule `sk-r10` points 5 → 4 (close turns into leader: exchange alone) | DT-1b, DT-3b, DT-3c |
| MU12 | `stock` `min_score` 5 → 4 (none turns into a leader with `sk-base`) | DT-1b, DT-3b |
| MU13 | `stock` `clear_lead_gap` 3 → 1 (close turns into a clear leader) | DT-1b, DT-3b |
| MU14 | the answers `leader` of a tenant replaced by its `close` answers (leader turns into close) | DT-3b |
| MU15 | `half` of `agency` with three answers | DT-3a |
| MU16 | an answer file names an option id of the other tenant | DT-3a, DT-3b |
| MU17 | the role of `agency` desk 1 copied back from the sample (E2 undone) | DT-4b, DT-2c |
| MU18 | a headline copied from one tenant into the other (ru only) | DT-4b, DT-2c |
| MU19 | the option id `nowhere` back to `none` in `stock` only, at every place (option, rules, hypothesis, answers; a partial rename is refused by `check` with `E_REF`); `agency` keeps `nothing`, so the id sets stay disjoint and DT-4a does not see it. If both tenants are put back to `none`, DT-4a sees it as well | DT-1b, DT-2c (rename table) |
| MU20 | `agency` `contact_fields` = `["phone", "telegram"]` | DT-1b |
| MU21 | `stock` `whatsapp` of 10 digits (check accepts 10–15) | DT-1b, DT-7b |
| MU22 | `https://` in `operator_name`; a mail-like `a@b.kz` in `privacy_contact` | DT-7a |
| MU23 | a phone number of ten digits written in `privacy_contact` | DT-7b |
| MU24 | a third file in `demo-tenants-v3/` (a copy of `uchet-pro.json`) | DT-6a |
| MU25 | one byte changed in `demo-answers/uchet-pro.json` | DT-6b |
| MU26 | `stock` `desk` list `1, 2, 3, 4, 4` | DT-1b |
| MU27 | `sku` `max` 1000000000000 (the sample value; check accepts) | DT-1b |
| MU28 | `agency` `look.tagline` loses its `en` key (`check` code 1, `E_FIELD`, measured) | DT-1a, DT-2a, DT-5a |
| MU29 | a row marked `SEP` for a text that only one sample tenant holds: `agency` `look.team[1].role` rewritten in the file and added as a fourth row of the table with the reason `SEP` (table and file agree; `check` accepts, F17) | DT-2d (DT-2c and DT-4b stay green) |
| MU30 | the fold: `agency` desk 1 role = the `stock` role in capitals with a leading space, a double space inside and a trailing space (`check` accepts, F17); the mutant uses the same fold as DT-4b (lower case, trim, collapse spaces), so an exact comparison would accept it | DT-4b |

## 13. What becomes outdated outside the project (for DOC-UPDATER)

- `docs/requirements.yaml`: REQ-070 `status` → done after RELEASE-VALIDATOR PASS (with the honest note on criterion 5: the reader step, and the Kazakh draft per decision 0072).
- `STATE.md`, `PLAN.md`: the stand of the new office exists; the next ones are REQ-071…
- The requirement texts that say "file names `demo-answers-v3/<id>.json`" stay true.
- `tools/README.md` line about "two made-up tenants … both /2" stays true for the old stand; the new paragraph (14.1) is added.
- `docs/anti-patterns.md`: one proposal (15, Q13).

## 14. README, notes and questions

### 14.1 README (BACKEND-DEV, step 70d; the words may be refined, the facts may not)

In the section "A stand of two made-up tenants" add a paragraph "The stand of the new office": the folder `src/picker/demo-tenants-v3` holds `stock` («Складеон», stock control) and `agency` («Лидвейв», marketing), both in the format `/3` with the section `look`; the command `npm run picker -- serve --tenants src/picker/demo-tenants-v3 --home <folder outside the project>` prints two links (`/t/agency/`, `/t/stock/`); the sets of answers are in `src/picker/demo-answers-v3/` (`leader`, `close`, `none`, `half`; `half` has the first two answers only and is for the live result); the folders must not be mixed because `serve` takes the whole folder; the two tenants are invented, Kazakh is a draft. Every phrase ≤ 18 words; no «ты»/"you".

### 14.2 Notes (not questions)

- N1. The sample's `demo` requests, `lines` and `rate` are not carried (D5). REQ-073 will add `estimate` to these files; the ids of the rules here do not depend on it.
- N2. `half` cannot be run through the engine of REQ-055 (F8); REQ-072 defines its use. DT-3a pins its shape only.
- N3. The Kazakh and English texts of the new solutions, rules and leads are written by the executor; they are in the table of the reader (criterion 5) with all other pairs; the owner does not wait for a native check (decision 0072 item 2).

- N4. `engine.js` has no standing pin (V2). REQ-072 and REQ-073 may change the file by their own text without a row «was → became» in this design; criterion 6 of REQ-070 is checked by the run-relative `git diff` at the release of REQ-070 only (`decisions/0084` item 1).

### 14.3 Questions for ORCH: all four are ANSWERED by `decisions/0086` (V4)

No question stays open. Each line shows the answer the design now follows.

- **I1. Reason code of the edits forced by criterion 4. ANSWERED (`decisions/0086` item 1).** The two roles of `agency` (E2, E3) are rewritten and the reason of such a row is `SEP` (criterion 4). Criterion 2 is amended by run `MA070-20261027-01`: «a code of the check, or `SEP` when criterion 4 forces the edit». The design follows it (6.1, DT-2c, DT-2d); the record exists, so no proposal for a record remains here.
- **I2. The block has seven criteria, the handoff said six. ANSWERED (`decisions/0086` item 2).** Seven; the new test file is `tools/test/picker-demo-v3.test.js`.
- **I3. Who writes `picker-demo-v3.test.js`. ANSWERED (`decisions/0086` item 3).** TEST-DESIGNER at step 5 of WF-02; BACKEND-DEV writes the data and the README paragraph (70a–70d).
- **I4. `figure` ids. ANSWERED (`decisions/0086` item 4).** `f01`…`f04` for `stock` and `f05`…`f08` for `agency`; a later change is a one-line edit of the data and of DT-1b.

Also settled by the same record: the id renames `nowhere` / `nothing` (item 5, table 6.2) and the replacement colours with the rule of 2 degrees and 3.0–3.4 (item 6, 6.3).

## 15. Proposal for `docs/anti-patterns.md` (Q13; number by DOC-UPDATER)

"A requirement that forbids a text to stand in two files and also says the files copy the sample's text has a hidden conflict if the sample itself shares a text between the two tenants; the designer must run a duplicate search over the sample strings before the design (found in REQ-070: two roles and one option id)."

## 16. The quality bar (`docs/quality-bar.md`): every item

| Item | Applicable? How it is met |
|---|---|
| Q1 | Applicable. Tied to REQ-070; each of its seven criteria has a check (8.1) |
| Q2 | Applicable. CODE-DESIGN-VALIDATOR repeats F1–F14 on a fresh clone; the tests are checked by TEST-DESIGN-VALIDATOR with the mutants of section 12; the reader of criterion 5 is a new agent run that wrote neither the texts nor the code |
| Q3 | Applicable. Every statement about the current system and every number in tables 7.1, 6.3, F-table was measured on the sketch (dates in section 1); what is derived by reading (the list of the tests that read the folder) says so and is backed by the full run F11 |
| Q4 | Applicable. The one command `cd tools && npm run check`; the new JSON is covered by `format:check` (F10) and `traces`; the new test by `lint` and `test`; `package.json` does not change |
| Q5 | Applicable. Every criterion has a row and a test (8.1); the failure tests (DT-1d, DT-4d) also check that files stay unchanged; tests do not depend on each other (each reads the files itself, each temporary folder is its own) |
| Q6 | Applicable. No skip, no turned-off rule; no old test is edited (section 9 is empty); the test counts of the existing picker test files do not fall (this work adds a file and removes no test) |
| Q7 | Applicable. No secret anywhere; the two `whatsapp` numbers and all names are invented (criterion 7, DT-7a/7b) |
| Q8 | Applicable. The two tenants share no id and no visitor text in any language (DT-4a/4b/4c); one file is checked without reading the other (DT-4d) |
| Q9 | Not applicable: no SQL, no database |
| Q10 | Applicable in the small: a broken neighbour or a broken file gives lines or a skipped tenant, not a crash (F13, DT-4d); no external call exists |
| Q11 | Not applicable: no address is called; the data holds none (DT-7a) |
| Q12 | Applicable. The design follows `0066`, `0070`, `0072`, `0076`, `0080`, `0083`, `0084`, `0085`; the one choice that could be disputed (reason `SEP`, I1) is now recorded: `decisions/0086` item 1 and the amendment `MA070-20261027-01`; `0086` is also followed for I2–I4 and items 5–6 |
| Q13 | Applicable. One proposal in section 15 |
| Q14 | Applicable. The status of REQ-070, `STATE.md`, `PLAN.md` and the handoff are updated by DOC-UPDATER after RELEASE-VALIDATOR PASS (13) |
| R1 | Applicable and unchanged: nothing is merged without the owner's confirmation; this design describes data and tests only |
| R2 | Not applicable: nothing here writes or reads Pixel Office events; the staff of a tenant in the file are people of an invented company, not agents |
| R3 | Not applicable: the product with photos of buyers was dropped (decision 0033, as REQ-070 says) |

## 17. The sketch (`result.prototype`)

`<scratch>/d070/base` and `<scratch>/d070/fresh` are fresh clones of the tag (`fresh` holds the four data files from the sketch, added to its git index, for the full test run); `<scratch>/r3` holds the rework scratch (`old.mjs`: the engine on the six old sets, F16; `m.mjs`: MU29 and MU30, F17); `<scratch>/d070/sk` holds `gen.mjs` (builds the two tenant files from `data.js` and the tables of section 5), `mk-design.mjs` (the tables), `run-engine.mjs` (check + engine on answer sets), `colour.mjs` (contrast and HSL steps), `dups.mjs` (equal strings in the two files), `triples.mjs` (numbers and Cyrillic per language), `mut.mjs` (mutants, `check` result), and the outputs. The sketch texts of the solutions, rules and leads are placeholders: only the structure and scores are the design. Outside the project; not part of the work.
