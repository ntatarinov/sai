# REQ-069 — code design: the tenant file format `sai-picker-tenant/3` with the `look` section, the check of the section, the fallback look for `/1` and `/2` files, the look given to the visitor

Run `LOOK069-20261026-01`, WF-02, step 1 (handoff `step-01-code-designer.json`). Author: CODE-DESIGNER, 2026-10-26 (by `date -u`: the handoff started 10:44:46Z, the design was written between 11:07Z and the closing time in the handoff). Checked by CODE-DESIGN-VALIDATOR. **Rework step 03** (gate pass 1 of 3 was FAIL: findings F1–F16 of `step-02-code-design-validator.json`; the design was first written before the micro-amendment of run `MA069-20261026-01` and before `decisions/0085`, and is now written against their current text). **Rework step 05** (gate pass 2 of 3 was FAIL: findings G1–G11 of `step-04-code-design-validator.json`; the next pass is the last). **Rework step 07** (gate pass 3 of 3 was FAIL: findings N1–N7 of `step-06-code-design-validator.json`; the one limited rework allowed by the owner, `decisions/0085` item 9): the range of `chips` returns to "only when both ends of the question are valid integers" (N1), and the six Low findings are taken with it. The ids F1–F23 of section 1 are *facts of this design*; the validator's findings are named in the handoffs of steps 03 and 05 only. Base tag `base/LOOK069-20261026-01` (= `HEAD` 0b4de42; the tree differs from the tag only by the folder of this run).
The requirement is the block `REQ-069` of `docs/requirements.yaml` in its current text, as amended by run `MA069-20261026-01` (nine criteria; all binding, including the page-test table of its description; the staff-name rule is now part of criterion 4, the colour cases of criterion 3, the file-count commands of criterion 9). Records read: `decisions/0085` (accepted; items 1–8), `0083`, `0084`, `0082`, `0066`, `0070`, `0071`, `0072`, `0076`, `0069`, `0002`. The approved sample `docs/design/samples/picker-v3-approved-2026-10-26/` was read for the shape of the look data (`data.js`) and the object catalogue (`office.js`). Style example: `docs/design/REQ-057-picker-page.md`.
This document holds modules, signatures, data shapes, tables and rules. It holds no implementation code and no test code. All example data is invented.

Not in this requirement (it is said so that nobody builds it here): the drawing of the office (REQ-071), the one-tap flow (REQ-074), the estimate with price and days and the `estimate` field (REQ-073), the lead server and the use of `max_per_hour`, `max_stored` and `whatsapp` (REQ-059, REQ-076), the tenant guide (REQ-060), the two new `/3` stand tenants (REQ-070), any change of `engine.js`, `server.js`, `tenants.js`, the page files and the demo tenants.

## 0. Summary

1. **A new file format `sai-picker-tenant/3`** = format `/2` plus the section `look` (required), two optional question fields (`desk`, `chips`), one optional option field (`object`), three optional `leads` fields (`whatsapp`, `max_per_hour`, `max_stored`) and `telegram` as a third value of `contact_fields`. In files `/1` and `/2` all of these stay what any foreign field is: `E_FIELD` (section 5.1). The wrong-schema line becomes «Допустимо только: sai-picker-tenant/1, sai-picker-tenant/2 или sai-picker-tenant/3. Исправьте значение.».
2. **No new error code, no new command, no new dependency.** The ten codes of REQ-054 are used (table in 6.2). Every message is Russian, in the form «вы», at most 18 words **in the whole message** (the shape check `lineProblems` of the tests counts the whole text, measured, section 1), and ends with a dot (catalogue in 6.4).
3. **Three new source files** (section 3): `tools/src/picker/public/tenant-look.js` (the one pure shared module: the closed catalogues, the colour rule, the fallback look, the desk rule), `tools/src/picker/shape.js` (four shape helpers moved out of `validate.js` without a change of behaviour), `tools/src/picker/v3-check.js` (everything that exists only in `/3`), and the new tests and samples. Changed: `limits.js`, `lang-check.js`, `view.js`, `validate.js`, `public-data.js`, `tools/README.md`. **Not changed: `engine.js`, `server.js`, `tenants.js`, `check.js`, `report.js`, `places.js`, `text-rules.js`, `load.js`, the page, the demo tenants** (verified on the sketch: the server serves a `/3` file and the answers for the two demo tenants stay byte-identical).
4. **Colours:** `#rrggbb` lower case; each of the four colours (light/dark × accent/accent2) must have a WCAG 2.x contrast of at least 3.0 : 1 with the sheet of **its own** theme. The two sheet colours are constants of the shared module: `#f3f5f9` (light) and `#161f2e` (dark), the values of `--page` (light) and `--surface` (dark) of the released page style sheet (`decisions/0085` item 4).
5. **Fallback look** for files `/1` and `/2`: one pure function `fallbackLook(name)` in `public/tenant-look.js`; it holds no text and no key of `texts.js`; the function `deskForQuestion(index, total)` gives `floor(index × 4 / total) + 1`. The server answers for `/1` and `/2` files do not change by a byte (sha256 of the six answers, measured on the tag, section 1).
6. **What the visitor gets** for a `/3` file: the questionnaire gets `look` (after `name`), `desk` and `chips` of the questions that have them, `object` of the options that have it, and `whatsapp` (string or `null`) in `leads`; `max_per_hour` and `max_stored` never leave the server. Two new public functions in `public-data.js` (`decisions/0085` items 7 and 8; item 8 gives the name): `lookOfView(view)` gives the look of **any** tenant view and is never `null` (the file's own look for `/3`, the fallback look for `/1` and `/2`) — it is the entry for the tenant's own public page and for the progress data and page (REQ-065 puts `look` into the progress data, REQ-066 draws it; REQ-064 is the stage storage and holds no look); `ownLookOfView(view)` gives the file's own look, or `null` for a `/1` or `/2` file — it is the entry for REQ-077 (`api/tenants` and the board data). The board page (REQ-078) builds the fallback look itself in the browser with `fallbackLook` of the shared module and does not call `lookOfView`. The registry record keeps its six keys (SU-9 stays true).
7. **Guard tests.** A sketch (a fresh clone of the tag with the real code of this design) turned exactly **seven** old tests red: PK-2a (through its expected line), PK-6e, PK-7c, PE-8d, LG-1c, LG-1c2, QS-1. The was→became table is in section 9 (A); the twelve rows of the page-test table of the requirement are in 9 (D) with the rows that act now: (1), (5), (7) (and (12), by `decisions/0085` item 5). Every ban stays; every number of tests and of `assert.` stays or grows.
8. **Questions О1–О5 of the first version are answered by `decisions/0085`** (accepted 2026-10-26; items 1–8): О1–О4 by items 2–5, О5 (a staff name that holds no letter or digit) and the name of the second public call by item 8. The defaults written here are the decisions (section 16.1). No open question remains.

## 1. Checked facts (commands run on a fresh clone of the tag, 2026-10-26)

All runs were made outside the project: `<scratch>/sketch/base` (a fresh `git clone -b base/LOOK069-20261026-01`), `<scratch>/sketch/fresh` (a second fresh clone with the sketch of this design), `<scratch>/sk` (arithmetic scripts). Nothing was changed in the project folders.

| # | Statement | Command and result |
|---|---|---|
| F1 | The tag exists and equals `HEAD`; the tree has only this run's folder as new | `git rev-parse HEAD base/LOOK069-20261026-01` → `0b4de42a59647f8fab00196fb136804fb5373ea6` twice; `git status --short` → `?? handoffs/LOOK069-20261026-01/` |
| F2 | The demo tenants are `/2` and give the numbers of the criterion | `node src/picker/cli.js check src/picker/demo-tenants/uchet-pro.json` → «Файл арендатора uchet-pro в порядке: вопросов 12, решений 5, правил 39.»; `svet-marketing` → «…вопросов 11, решений 5, правил 37.», both code 0. `grep '"schema"'` on `demo-tenants/` → `/2` twice; on `test/fixtures/picker-legacy/` → `/1` twice |
| F3 | The baseline of the picker tests | `node --test test/picker-*.test.js` on the tag: 18 files, `# tests 370`, `# pass 370`, `# fail 0`, `# skipped 0`, 39.0 s. `git grep -h '^test(' base/… -- 'tools/test/picker-*.test.js' \| wc -l` → 370. `ls tools/test/picker-*.js \| wc -l` → 25 files (tests and helpers). `tools/test/fixtures/picker/` holds 44 files |
| F4 | The six answers of the demo tenants (for criterion 6), sha256 of the body, from `serve --tenants src/picker/demo-tenants` on the tag | `uchet-pro` ru `ed7d65846b4885f0722b6428aab07080820c6cf597681a0ca462d6ebbdcc1e96`; kk `b7ed6ba4f73efa9842cead1006f0c9e6038397441f8345c8576f6d57b47b4081`; en `b74367ccc8716c3780275eef00ac3fc1171cc119166c07afdf788a845cf4d95e`; `svet-marketing` ru `952a99e23c9c060a1b182028aee1c3721220db4b8221745412ebef8ce0ceda60`; kk `53a706196b498567a1e23589339a6b468d0fff61d06defbe5332a54ae9f75024`; en `1a0b16d18ea49937ff863d6fe030728148ece5bd9fb7fa7ff9ab725a8fa3fc7c`. The same six values came out of the sketch with the new code. The test step must obtain them again on the tag (the criterion says so); these are the control values |
| F5 | Which old tests turn red from new files and from the new format | Sketch 1 (three empty modules standing for the new files: `src/picker/look-check.js` (the final name is `v3-check.js`), `src/picker/shape.js`, `src/picker/public/tenant-look.js`): `node --test test/picker-*.test.js test/traces-*.test.js` → 426 tests, 4 red: PK-6e, PK-7c, PE-8d, QS-1. Sketch 2 (the real code of this design, `shape.js`, `v3-check.js`, `tenant-look.js`, the changes of 3.2): 370 tests, **7 red**: PK-2a, PK-6e, PK-7c, PE-8d, LG-1c, LG-1c2, QS-1; `traces-*.test.js`: 56 of 56 green. Green and untouched: PK-7a, PK-8c, PK-8e, LG-10c, TR-4f, SV-*, SU-*, TT-* |
| F6 | The words of the page tests that the new public file must avoid | Read in `picker-page-static.test.js` (QS-3, QS-5, QS-6, QS-7, QS-9, QS-10), `picker-lang.test.js` (LG-10c), `traces-runtime.test.js` (TR-4f) and the criterion 6 search: section 13.2 |
| F7 | The shape check of the output lines | `picker-helpers.js:227`, `lineProblems`: each line `<name>: <place without spaces>: <code of the ten>: <text>`; the **whole text** has at most 18 words (`wordsIn`), ends with a dot, has no «ты…» and none of `Unexpected token undefined null NaN JSON position Expected`. All 149 lines of the first run of 78 error samples, and the 8 lines of the two `/2` samples added later, pass it (measured, no problem) |
| F8 | A file name that contains one of the words that `show()` hides is printed as «(скрыто)» | Sample named `e-desk-null.json` printed `(скрыто): questions[0].desk: E_FIELD: …`. Sample names must not contain `null`, `token`, `undefined`, `nan`, `unexpected` or a second-person word (section 13.4) |
| F9 | The contrast arithmetic | `<scratch>/sk/contrast.mjs`: channel→linear with 0.04045 and with 0.03928 give the **same** accept/reject on all 4913 grid colours for both sheets (0 disagreements; for 8-bit channels no value lies between the two constants). The closest colour of the 4913-grid to 3.0 : 1 is 0.00055 away (light) and 0.00061 (dark). Over **all** 16 777 216 colours the closest is 3.7e-7 away (light) and 3.4e-7 (dark), so double arithmetic cannot flip a verdict (`edge.mjs`) |
| F10 | Boundary colours (3.0 : 1) | Light sheet `#f3f5f9`: `#c67d42` = 3.0000006 (accepted), `#1999c6` = 2.9999996 (rejected). Dark sheet `#161f2e`: `#76691d` = 3.0000003 (accepted), `#c22c5c` = 2.9999994 (rejected). Accepted among all colours: 8 861 565 (light), 12 190 677 (dark) |
| F11 | The accents of the approved sample against these sheets (information for REQ-070) | `#e0731f` 2.90 on the light sheet (**fails**), 5.23 on the dark sheet; the text accent `#9a4306` 6.05 on light; `#1f7a8c` 4.56 light, 3.32 dark; second sample `#e0356f` 3.92 / 3.87; `#5b3fd6` 6.15 light, **2.46 dark (fails)**. So a `/3` file takes a darker light accent and a lighter dark accent; this is exactly why the file has two themes |
| F12 | The cost of the property test through the command | 500 variants of one `/3` file, each through `node src/picker/cli.js check`, sequentially: 36.8 s, 500 × code 1, stderr empty, every line passes `lineProblems`; the variants included a 100 000-sign string and nesting of 20 000 (one `E_JSON` line, place «строка N, знак M») |
| F13 | The fallback arithmetic | `markOf`: «Учёт-Про»→У, «ab»→A, «7 звёзд»→7, ««»»→#, «ßета»→ß, «ŉ-центр»→ŉ, «𐐨 лаб»→𐐀; `deskForQuestion` for N = 1, 5, 12 → `[1]`, `[1,1,2,3,4]`, `[1,1,1,2,2,2,3,3,3,4,4,4]` (the literals of the criterion) |
| F14 | The engine takes a `/3` view | `computeResult(tenantInLanguage(file, "en"), answers)` on a checked `/3` file returns the ordinary answer error `E_ANSWER` for a missing required answer: the engine ignores `look`, `desk`, `chips`, `object` (no change of `engine.js` is needed) |
| F15 | The picker public files are served by the directory | `assets.js` reads `public/` by name at each request, so a new file of `public/` is served at `/assets/<name>` with no change of the server (`SV-1f` stays green in sketch 2) |
| F16 | Options on a number question are `E_FIELD` on `/1` and on `/2` today (criterion 4: «на каждом из трёх форматов») | Two copies outside the project (scratch folder; id equal to the file name): the released `test/fixtures/picker/ok-minimal.json` (`/1`) and the demo `svet-marketing.json` (`/2`), each with `options` added to its number question; `node src/picker/cli.js check <copy>` → `questions[2].options: E_FIELD: Лишнее поле options. Удалите его.` and `questions[1].options: E_FIELD: Лишнее поле options. Удалите его.`, code 1 each (2026-10-26). The `/3` case is the sample `e-object-on-number-options` (10.2) |
| F17 | The callers of `ctx.line` (for D10, D15) | `grep -n 'line(' src/picker/validate.js src/picker/lang-check.js` → `validate.js:125` (`ctx.text`), `:396` and `:400` (the two `leads` strings), `lang-check.js:43` (`checkLanguageText`); the definition `validate.js:129`. `ctx.line` applies the «ты» rule when `language === FORMAL_LANGUAGE` (`ru`) and the 18-word rule otherwise (read in the source) |
| F18 | The surfaces of the released page style | `grep -n 'surface\|--page' src/picker/public/page.css` → light `--page #f3f5f9`, `--surface #ffffff`, `--surface-2 #eef2f8`; dark `--page #0f1520`, `--surface #161f2e`, `--surface-2 #1c2738` |
| F19 | The commands of the criteria that run now, on the tag tree (2026-10-26T11:59Z) | `ls tools/test/picker-*.js \| wc -l` → 25; `grep -n 'tests.length >= ' tools/test/picker-page-static.test.js` → line 678 `assert.ok(tests.length >= 5)`, so `grep -n 'tests.length >= 25' …` → 0 lines; the count command of criterion 9 → empty, values 370 and 370; `git diff --name-only base/LOOK069-20261026-01 -- tools/test/fixtures/picker/` → empty; the diffs of `demo-tenants`, `demo-answers`, `picker-legacy`, `tools/package.json`, `engine.js` → empty; the search of criterion 8 → empty; `tools/src/picker/public/tenant-look.js` does not exist. Section 11.1 says for each command whether it runs now or needs the work |
| F20 | The text of `ctx.line` for a lone half of a pair (it stands in no earlier row of 6.4) | In-process call of `validateTenant` from the tree of the tag, on a copy (outside the project) of `demo-tenants/svet-marketing.json` with `name.ru` = «Свет» followed by U+D800: one line, place `name.ru`, E_TEXT, «Непарная половина знака U+D800. Удалите её из текста.»; the test helper `wordsIn` counts **8 words** (2026-10-26). The same text came out of `check` on the sample `e-text-sign` of the sketch with a lone half in `look.team[1].says.kk` (third line of three, code 1) |
| F21 | The split of sub-step 69d (G10): the red set of the first part | Copy of the sketch (outside the project) with `v3-check.js` limited to the look check and the object check, and `validate.js` wiring only `look` (root field) and `object` (option field); no `desk`, `chips`, `whatsapp`, `max_per_hour`, `max_stored`, no `telegram`: `node --test test/picker-*.test.js test/traces-*.test.js` → 426 tests, 419 pass, **7 red**: PK-2a, PK-6e, PK-7c, PE-8d, LG-1c, LG-1c2, QS-1 (the same seven as the whole sketch) |
| F22 | `chips` when an end of the question's range is missing or is not a valid integer (the range is checked only when **both** ends are valid integers) | Pass 4, on a copy of the sketch code (outside the project, 2026-10-26), through the real check function: the `number` question with `min` in 7 values (absent, «x», JSON `null`, 2.5, –5, 0, 10) × `max` in 6 (absent, «y», `null`, 1000, 5, 3.5) × 12 `chips` lists = **504 combinations**, each compared with an independent model of the rule (the question's own lines unchanged; the chips lines by the rule of D8). With the rule of pass 3 (a valid end bounds alone) 24 combinations printed a line with the word `null`: «Число 1001 вне границ от null до 1000. Исправьте значение.» (the shared `ctx.int` with no lower end); the shape helper `lineProblems` marks each one 'parser' (the word is on its list; design 6.1). With the rule of this step (the range only with both ends) **0 of 504 differ from the model, 0 lines hold the word `null`, `lineProblems` finds nothing in any of the 504 outputs** (344 chips lines in all). The cases of LK-5b: `min` absent, `max` 1000, `chips` [-5, 1001] → exactly one line, the question's own `questions[2].min`: E_FIELD «Нет поля min. Добавьте его.», no line at `chips`; the same with `min` = «x» → the own line «Ожидается целое число. Исправьте значение.»; `min` 1 and `max` absent → the own line at `questions[2].max`, no chips line; `min` «x» and `max` «y» with [-5, 99999, 2.5] → the two own lines and one E_FIELD at `questions[2].chips[2]`; `min` 1 and `max` 1000 with [-5, 1001] → E_LIMIT at `chips[0]` and `chips[1]` («от 1 до 1000»). Four breakages that no named test saw after pass 3 (items of `team` skipped when the size is wrong; items of `chips` skipped when there are more than four; the missing-desk line at the last question without a desk; a desk with a wrong value not counting as "has its own desk") were applied on scratch copies of the sketch: each changes the lines of the new cases of LK-2f, LK-5a, LK-5b (MU67–MU70) |
| F23 | The class step of the staff name without the guard of D15 | Model of pass 3 (scratch copy of the sketch code, outside the project): the line `if (!ctx.line(...)) return;` of the staff-name check replaced by a bare call (the class step then runs after every failed step); the lines of **93 sample files of the sketch** (the rows of 10.2 under their first names, and probe files) are identical to the unmutated lines, and so are all cases of LK-2e and LK-2f of the model: `ctx.add` keeps the first line per place. With `ctx.line` returning `false` after a success the same run is red (`e-staff-name-url`, a probe file with a name of the forbidden kind) |

## 2. Decisions of the design (all accepted as written by `decisions/0085` item 1; the answers to О1–О4 are its items 2–5)

- **D1. One rule tells the form.** `lang-check.js` keeps `isFormatV2` as it is (LG-1h pins its meaning: true only for `/2`) and adds `isFormatV3(doc)`, `isLanguageFormat(doc)` (true for `/2` and `/3`) and `formatOf(doc)` → `"/1"`, `"/2"` or `"/3"` (an unknown schema gives `"/1"`, as decision 0070 item 3 says). `validate.js` and `view.js` use `formatOf` and `isLanguageFormat`; the form of a file is told by this one rule, and only the check of the value of `schema` itself compares strings.
- **D2. The shared module is the only source of the catalogues.** The 15 object ids, their parameter rules, the 4 glyphs, 12 figures, 3 shirts, the sheet colours, the neutral colours, the colour test, the contrast function, the mark rule, the desk rule and the fallback look live in `public/tenant-look.js` and nowhere else (AP-014). The core takes the names through `limits.js` (`export … from "./public/tenant-look.js"`), the same way it takes `LANGUAGES` from `texts.js` today (REQ-061, 5.1): `limits.js` stays the one place where the core depends on a file of `public/`.
- **D3. Two new core modules, no circle.** `validate.js` is 526 lines; the `/3` rules are about 150 more. `v3-check.js` holds them; it needs `checkObject`, `field`, `checkItems`, `isObject`, which sit in `validate.js` today and would make a circular import. They move **unchanged** into `shape.js` (a pure move; all 370 tests stay green after it, measured). `validate.js` keeps the wiring (which field list for which format) and all `/1` and `/2` rules.
- **D4. The public look has one fixed shape.** Keys are always the six of the look; `tagline` and `industry` are strings or `null`; for a staff member `name`, `role`, `says` are strings or `null`. A file `/3` gives `null` only for an absent `tagline` (all other values are strings); the fallback gives `null` for `tagline`, `industry`, and `name`, `role`, `says` of the four. One shape means the page reads one object whatever the format of the file.
- **D5. Other new public fields follow the existing convention:** `desk`, `chips`, `object` appear only where the file has them (the builder copies field by field); `whatsapp` is always present in the `leads` of a `/3` file (a string or `null`) because the criterion says so; `look` is always present in the questionnaire of a `/3` file and never in the questionnaire of `/1` or `/2`. Order of keys: 7.1.
- **D6. The registry record does not change.** `lookOfView(view)` reads the language view (`entry.views.get(lang)`); `look` is part of that view. No `looks` field is added (SU-9 pins the six keys).
- **D7. Desk rules:** an integer 1–4; "all or none" means: if at least one question object has its own `desk` — **its own desk is the key `desk` being present, whatever its value** (a wrong value or JSON `null` counts as present and has its own line from the field rule) — every question object has it; the line for a missing one stands at the **first** question without the key, and only there (a second and a third question without it get no line); order is compared with the **previous question that has a valid desk** (equal is allowed); one line per place, the first found wins (type and range first, then the cross rules).
- **D8. Chips rules:** only for `number` questions; a list of at most 4; each item an integer; **the range `min…max` of the question is checked only when both ends of the question are valid integers**; otherwise (an end is missing or is not an integer) only the integer form of each item is checked and the question's own line for that end stands alone — a half range would print the word `null` through the shared `ctx.int` (measured, F22); more than four items: the count line, and the items are still checked; repeat → `E_DUP` (the later item), else descending → `E_ORDER`. Precedence at one place: type → range → repeat → order (decision 0066 item 7 order).
- **D9. The closed ids.** For `object.id`, `figure`, `shirt` any value that is not a string of the catalogue is `E_REF` with the list of the catalogue in the text (also a number, `null`, an object) — the criterion demands `E_REF` for a number id and one rule is better than three. The glyph is a closed list too, but the criterion asks `E_FIELD` for «star», so it follows the pattern of `type` («Допустимо только: …» with `E_FIELD`). While the object id is not a catalogue id, its parameters are checked only for form (`level`: integer 1–4, `tag`: signs, `glyph`: the list) and none is reported as not allowed.
- **D10. Staff name** is one string for all languages: type → forbidden sign (`E_TEXT`, REQ-068) → length 1–30 after trimming (`E_LIMIT`) → the characters (`E_FIELD`): letters, combining marks, decimal digits, space (U+0020), hyphen-minus, apostrophe (U+0027 and U+2019), dot. The first three steps are one call `ctx.line(path, value, 1, 30, language)` with `language` = `"en"` (any value except `ru`: the «ты» rule is for `ru` only and a name is not an address; passing `ru` or the default language would add that rule). The 18-word step of `ctx.line` cannot fire for a name (30 signs hold at most 15 words), so message M10 is never produced for a name. The characters step runs only when `ctx.line` returned `true` (what the value is for: D15). The character class is the **only** rule of the characters: a name needs no letter or digit, so a name of dots, hyphens, apostrophes and spaces (for example `.`) with 1–30 signs after trimming is accepted — this is what the requirement text says (criterion 4, `decisions/0085` item 2); whether it should be refused was question О5, and `decisions/0085` item 8 answers it: accepted; a requirement of a letter or digit would be a later micro-amendment, not now. The accepted names that the tests pin are in LK-2f.
- **D11. Sign classes.** A "letter or digit of any alphabet" is a Unicode letter (`L`) or a decimal digit (`Nd`); superscripts and Roman numerals are not digits here. Counting is by code points (a lone half of a pair counts as one and is not a letter). The same predicate `isMarkSign` serves the file check (mark, tag) and the fallback mark, so a fallback mark (except `#`) always passes the file rule.
- **D12. Sheet constants and neutral colours** (`decisions/0085` item 4): sheets `#f3f5f9` / `#161f2e`; neutral colours light `#35607f` and `#7a5c2e`, dark `#8fb4d8` and `#c9b48c` (contrast 6.14, 5.66, 7.63, 8.18, all above the rule).
- **D13. Fallback team:** four staff, `name`, `role`, `says` are `null`, `figure` is `f01`…`f04` by order, `shirt` is `accent`, `accent2`, `ink`, `accent` by order. The fallback look is never run through the file check (its mark may be `#`).
- **D14. `deskForQuestion` never throws:** a non-integer index or total, `total < 1` gives 1; an index outside `0…total−1` is clamped. The page passes the number of questions of the questionnaire (`questions_max`) — the choice belongs to REQ-071; this function takes any total.
- **D15. Two small changes of shared helpers in `validate.js`,** both additive: `ctx.line(...)` returns `true` when the text passed all its rules and `false` otherwise (four callers, all ignore the result and are not affected: `ctx.text` (`validate.js:125` on the tag), the two `leads` strings (`validate.js:396` and `:400`) and `checkLanguageText` in `lang-check.js` (`:43`); the only new caller is the staff name of D10). **What the value is for:** the staff name (D10) runs its character class only for a text that passed the earlier steps, so the order forbidden sign → length → characters stands in the code and not only in the drop of a second line. The value is **not needed for the result**: `ctx.add` keeps one line per place and the first found wins (D7, 6.1), so a character line added after a failed step would be dropped (modelled, F23: the same lines on 93 sample files and on every case of LK-2e and LK-2f with the guard removed). For this reason the breakage "the class step also runs after an error" is an **equivalent** mutant (section 14), and the killable breakage is the opposite one: the value is `false` after a success, so the class step never runs (MU54); `ctx.list(...)` writes «Элементов: N, нужно ровно K. Исправьте список.» when `min === max` (no earlier call of `ctx.list` has `min === max`, checked by reading every call). **`ctx.int` is not changed, and the new code calls it only the way the released code does:** with both ends (`desk` 1–4, the parameters of an office object, the range of `chips`), with a lower end only, or with no end (the integer form only). The released calls are of these three kinds (read in `validate.js` and `conditions.js`, 2026-10-26); none passes an upper end alone, because for a lower end that is `null` the helper's second text prints «от null до N», which breaks the shape rule of 6.1 (F22). So `checkChips` passes `min` and `max` to `ctx.int` only when both are integers, and `null`, `null` otherwise (D8).
- **D16. Property test through the command** (500 variants, ~37 s): the criterion says "команда check"; it is run as written. In-process checks cover the same variants only in the grid and matrix tests.
- **D17. Messages that carry a list cannot carry an instruction:** the object-id message is 17 words with the 15 ids; adding «Исправьте значение.» would make 19 (limit 18). It is «Допустимо только: shelf, …, chart.» and nothing else (the others add «Исправьте значение.»).

## 3. Files, owners, order

### 3.1 Created

| File | Owner | What it is |
|---|---|---|
| `tools/src/picker/public/tenant-look.js` | BACKEND-DEV | The shared pure module (section 8). No `import`, no `export … from`, no Node, no document, no clock, no random |
| `tools/src/picker/shape.js` | BACKEND-DEV | `isObject`, `field`, `checkObject`, `checkItems` moved from `validate.js` (4.1) |
| `tools/src/picker/v3-check.js` | BACKEND-DEV | The checks that exist only in `/3` (4.2) |
| `tools/test/picker-look.test.js` | TEST-DESIGNER | Tests LK-1…LK-7 (section 11) |
| `tools/test/picker-look-property.test.js` | TEST-DESIGNER | Tests LP-1…LP-3 with a pinned seed |
| `tools/test/picker-look-helpers.js` | TEST-DESIGNER | Independent oracles: the contrast, the sign classes, the expected look and questionnaire, the sample table (not a test file) |
| `tools/test/fixtures/picker-look/` | TEST-DESIGNER | The 89 samples of section 10 (**not** `tools/test/fixtures/picker/`: PK-8e keeps its 44 files) |

### 3.2 Changed

| File | Owner | Change |
|---|---|---|
| `tools/src/picker/limits.js` | BACKEND-DEV | `FORMAT_V3`; `CONTACT_FIELDS_V3` (`phone`, `telegram`, `email`); re-export of the names of `public/tenant-look.js` that the core uses (D2) |
| `tools/src/picker/lang-check.js` | BACKEND-DEV | `isFormatV3`, `isLanguageFormat`, `formatOf` (D1); `isFormatV2` and `checkLanguageText` unchanged |
| `tools/src/picker/view.js` | BACKEND-DEV | `fileLanguages` and `tenantInLanguage` use `isLanguageFormat` (a `/3` file has three languages) |
| `tools/src/picker/validate.js` | BACKEND-DEV | Imports `shape.js` and `v3-check.js`; the mode is `formatOf(doc)`; per-format field lists (5.2); the schema line (6.4 M33); D15 |
| `tools/src/picker/public-data.js` | BACKEND-DEV | `publicLook`, `lookOfView`, `ownLookOfView`, the new fields of questions, options and leads (section 7) |
| `tools/README.md` | BACKEND-DEV | Section 15 |

### 3.3 Not changed (and why a reader may ask)

`engine.js` (F14), `server.js`, `tenants.js` (it calls `fileLanguages`, `tenantInLanguage`, `publicQuestionnaire`; all three now do the right thing for `/3`), `serve.js`, `assets.js`, `config.js`, `check.js`, `report.js` (its ordering works for any path), `places.js`, `text-rules.js`, `load.js`, `messages.js`, `request.js`, `json.js`, `conditions.js`, the files of the page, `texts.js` (no new key), `demo-tenants/`, `demo-answers/`, `fixtures/picker-legacy/`, `package.json`, `eslint.config.js`.

### 3.4 Order of work

First the shared contract, then the sides (section 12): `tenant-look.js` → `shape.js` → format plumbing → `v3-check.js` and the wiring (the look and the objects first, then desks, chips and leads) → `public-data.js` → README. TEST-DESIGNER works after the code (WF-02 step 5) on the files of 3.1 and on the old tests of section 9. Two people never write one file: `validate.js` is written by one developer only.

## 4. The core modules

### 4.1 `shape.js` (imports nothing)

| Function | Signature | Meaning |
|---|---|---|
| `isObject` | `(v) → boolean` | A non-null, non-array object |
| `field` | `(name, required, check) → { name, required, check }` | One row of a field table; `check(path, value)` |
| `checkObject` | `(ctx, path, value, fields) → void` | Exactly the former function of `validate.js`: not an object → `ctx.wrong(path, "object")`; extra keys first (E_FIELD «Лишнее поле …»), then each field in table order; a missing required one → E_FIELD «Нет поля …» |
| `checkItems` | `(ctx, path, value, min, max, each) → void` | Exactly the former function: `ctx.list(...)`, then `each(path, item, index)` for every item |

`ctx` is the context of `validate.js` (`add(code, path, text)`, `wrong(path, kind)`, `int(path, v, min, max)`, `list(path, v, min, max)`, `bool`, `text(path, v, min, max)`, `line(path, v, min, max, language)`; D15). The text of the `shape.js` file contains none of the words that the guard tests of `src/picker/` scan for (13.1).

### 4.2 `v3-check.js` (imports `shape.js` and, through `limits.js`, the shared module)

| Function | Signature | Checks |
|---|---|---|
| `checkLook` | `(ctx, path, value) → void` | The whole `look` section (5.3) |
| `checkOfficeObject` | `(ctx, path, value) → void` | One office object `{id, level, tag, glyph}` (5.5). **Exported on purpose:** REQ-073 reuses it for the ranges of number questions ("the same kind of object") |
| `checkChips` | `(ctx, path, value, min, max) → void` | `chips` of one number question; `min`, `max` are integers or `null`; the range of the items is checked only when **both** are integers, else only the integer form of each item (5.6, D8, D15) |
| `checkDesks` | `(ctx, questions) → void` | The cross-question rules of `desk` (5.6); does nothing when `questions` is not a list; the entries that are not objects are skipped (the question check has its own line for each); proved by LK-5e |
| `checkWhatsapp` | `(ctx, path, value) → void` | The number for the WhatsApp button (5.7) |

All five are pure, never throw on any JSON value, and never change their input.

### 4.3 `validate.js` after the change (wiring only)

`validateTenant(doc, { fileName })` keeps its signature and result. Inside: `mode = formatOf(doc)`; the context knows the mode (`"/1"` reads texts as strings, `"/2"` and `"/3"` read them as three-language objects); root fields: the former list, plus `look` (required) in `/3`; `checkQuestion(..., mode)` and `checkOption(..., mode)` and `checkLeads(..., mode)` take the extra fields of 5.2 for `/3`; after the root fields `checkDesks(ctx, doc.questions)` runs for `/3`; `checkReachable` is unchanged.

## 5. The format `/3` and the rules

### 5.1 What changes against `/2`

| Where | `/1`, `/2` | `/3` |
|---|---|---|
| `schema` | `/1` or `/2` | `sai-picker-tenant/3` |
| root | no `look` (a foreign field: E_FIELD «Лишнее поле look. Удалите его.») | `look` required |
| question | no `desk`, no `chips` (E_FIELD) | `desk` optional (any type), `chips` optional (only `number`) |
| option | no `object` (E_FIELD) | `object` optional (options exist on `single` and `multiple` questions only) |
| `leads.contact_fields` | 1–2 items of `phone`, `email` | 1–3 items of `phone`, `telegram`, `email` |
| `leads` | no more fields | `whatsapp`, `max_per_hour`, `max_stored` optional |
| texts for the visitor | `/1`: strings; `/2`: `{ru, kk, en}` | `{ru, kk, en}` as `/2` |
| everything else | as it was | as `/2` |

A value of `schema` that is none of the three is the existing single schema line, and the rest of the file is read as `/1` (decision 0070 item 3; the sample `e-field-schema.json` keeps giving exactly one line because its body is a `/1` body).

### 5.2 Field tables of `/3` (fields not listed are as in `/2`)

**Question:** `desk` (integer 1–4), `chips` (list of 0–4 integers). **Option:** `object`. **Leads:** `contact_fields`, `whatsapp`, `max_per_hour`, `max_stored`. Extra-key detection for a question uses a `/3` key set (`QUESTION_KEYS` plus `desk`, `chips`); `chips` is bound to `number` through the same "only for" table as `options`, `min`, `max`, `unit` (a `chips` on a `single` question is E_FIELD «Лишнее поле chips. Удалите его.»; while the type is unknown it is checked only for form).

### 5.3 The `look` section — exactly these fields

| Field | Type | Req. | Rule | Breach |
|---|---|---|---|---|
| `mark` | string | yes | exactly one code point, a letter or a decimal digit of any alphabet (D11); case is free | not a string: E_FIELD (M36); 0 or ≥2 code points: E_LIMIT (M05); one code point that is no letter or digit (space, emoji, `-`, a lone half of a pair): E_FIELD (M06) |
| `tagline` | text in 3 languages | no | 1–40 signs per language | missing language E_FIELD (M08), not a three-language object E_FIELD (M09), length E_LIMIT (M07), phrase rules E_TEXT (M10, M11, M12; a lone half of a pair M37) |
| `industry` | text in 3 languages | yes | 1–60 | same |
| `headline` | text in 3 languages | yes | 1–120 | same |
| `colors` | object | yes | exactly `light` and `dark` | missing / extra key E_FIELD (M01, M02), not an object E_FIELD (M03) |
| `colors.<theme>` | object | yes | exactly `accent` and `accent2` | same |
| `colors.<theme>.<accent>` | string | yes | `#` and six lower-case hexadecimal digits; and contrast ≥ 3.0 : 1 with the sheet of this theme (5.4) | not the form (any type): E_FIELD (M17); contrast: E_LIMIT (M18 light, M19 dark) |
| `team` | list | yes | exactly 4 staff, in the order of the four desks: reception, documents, specification, handover | size E_LIMIT (M13); the items are still checked (LK-2f) |
| `team[i].name` | string | yes | D10; one string for all languages | not a string E_FIELD (M36); forbidden sign E_TEXT (M12; a lone half of a pair M37); length 1–30 E_LIMIT (M07); characters E_FIELD (M14); no word-count and no «ты» rule (D10) |
| `team[i].role` | text in 3 languages | yes | 1–40 | as `tagline` |
| `team[i].says` | text in 3 languages | yes | 1–40 | as `tagline` |
| `team[i].figure` | string | yes | one of `f01`…`f12` | E_REF (M15) |
| `team[i].shirt` | string | yes | one of `accent`, `accent2`, `ink` | E_REF (M16) |

A staff member is an object of exactly these five fields (the extra field is E_FIELD «Лишнее поле …»). The text rule of "no «ты»" is for `ru` only; the 18-word rule is for each language (existing behaviour of `ctx.line`); for the staff name neither fires (D10). The approved sample's mapping, for REQ-071 and REQ-070: `figure` stands for the hair and skin of a sample person (the catalogue of twelve is drawn by REQ-071; this requirement only fixes the twelve ids), `shirt` names which colour of the tenant the shirt takes.

### 5.4 Colour and contrast

Form: a string of seven signs, `#`, then six of `0-9a-f` (nothing else: not upper case, not three digits, not `rgb(...)`, not a name). Contrast: the WCAG 2.x relative-luminance contrast of the colour with the sheet of the same theme must be **at least** `MIN_CONTRAST = 3.0` (`>=`; no rounding before the comparison).

Formula (the oracle of the test is written independently from this text): each 8-bit channel `c` → `s = c / 255`; linear = `s / 12.92` if `s <= 0.04045`, else `((s + 0.055) / 1.055) ^ 2.4`; `L = 0.2126 R + 0.7152 G + 0.0722 B`; ratio = `(Lhigh + 0.05) / (Llow + 0.05)`. The sheets: `SHEET.light = #f3f5f9`, `SHEET.dark = #161f2e` (D12, `decisions/0085` item 4). Each theme is checked against its own sheet only: a light accent that would fail on the dark sheet is accepted in the light slot, and the other way round. Each of the four positions is checked on its own (`light.accent`, `light.accent2`, `dark.accent`, `dark.accent2`); `accent` and `accent2` are not compared with each other.

Why these two sheets: `decisions/0085` item 4 fixes them as the page background of the light theme (`--page`) and the card surface of the dark theme (`--surface`) of the released page style (measured, F18). The style has other surfaces as well — `--surface-2` (`#eef2f8` light, darker than the sheet; `#1c2738` dark, lighter than the sheet) and the dark page `#0f1520` (darker than the sheet) — so a colour just above 3.0 : 1 with the sheet can be slightly below 3.0 : 1 on `--surface-2`. Only the pair with the sheet constant is checked here; no other pair is.

The platform derives the colour of a button label and of a link from the accents so that their contrast is at least 4.5 : 1 (REQ-087). That is not checked here.

### 5.5 The office object

`object` is an object with exactly the fields `id` (required), `level`, `tag`, `glyph` (optional, and allowed only as the table says).

| id | `level` | `tag` | `glyph` |
|---|---|---|---|
| `shelf` | 1–3 | not allowed | not allowed |
| `boxes`, `coins`, `chart` | 1–4 | not allowed | not allowed |
| `monitor`, `laptop`, `cell` | not allowed | 1–3 signs | not allowed |
| `poster` | not allowed | not allowed | one of `tool`, `box`, `house`, `cap` |
| `shop`, `scanner`, `tsd`, `clip`, `bell`, `phone`, `headset` | not allowed | not allowed | not allowed |

The ids are, in this order, `shelf, shop, boxes, monitor, laptop, scanner, tsd, clip, bell, phone, cell, headset, poster, coins, chart` (15). Rules:

- `id`: any value that is not one of the 15 strings → E_REF with the list (M20). A missing `id` → E_FIELD «Нет поля id. Добавьте его.».
- `level`: an integer (not an integer → E_FIELD «Ожидается целое число.»); outside the range of the id → E_LIMIT «Число N вне границ от a до b.» (M21).
- `tag`: a string of 1–3 code points (the count first: 0 or >3 → E_LIMIT, M07), each a letter or decimal digit (a space or another sign → E_FIELD, M22). Not a string → E_FIELD «Ожидается строка.».
- `glyph`: a string of the four; any other value (any type) → E_FIELD (M23).
- A parameter that the id does not allow is the extra field: E_FIELD «Лишнее поле level. Удалите его.» (M02), place = the parameter.
- `object` that is not an object (string, list, number) → E_FIELD «Ожидается объект.» (M03).

The object is data of the option; the page draws it (REQ-071). It carries no address, style or code: every field is a number, a sign string of letters and digits, or a name from a list.

### 5.6 Desks and quick numbers

`desk` — integer 1–4: `ctx.int(path, v, 1, 4)` (E_LIMIT M21 for 0 and 5; E_FIELD «Ожидается целое число.» for 2.5, `"1"` and JSON `null`).
Cross rules (`checkDesks`, run once after the questions): let Q be the question entries that are objects. (a) If no Q has the key `desk` (whatever the value of a key): nothing. (b) Otherwise the **first** Q without the key gets E_FIELD at `questions[i].desk` (M24), and no other Q without it gets a line; a Q whose `desk` is present with a wrong value counts as having its desk (its own line is the integer rule's). (c) Going through Q in order, with `previous` = the desk of the nearest earlier question whose desk is a valid integer 1–4: a valid desk smaller than `previous` → E_ORDER at its place (M25). The desks `1,2,1,2` give one E_ORDER at `questions[2].desk`; `1,1,2,4` is accepted.
`chips` — D8: `ctx.list(path, v, 0, 4)` (a non-list E_FIELD, more than four E_LIMIT M26); each item `ctx.int(item, min, max)` with the question's `min` and `max` **only when both are valid integers**; when one or both are missing or not integers each item goes through `ctx.int(item, null, null)` (the integer form only), so that no chips line is made from a half range and no line holds the word `null` (D8, D15, F22); the items are checked also when the list is too long; then a repeat E_DUP (M27), else smaller than the previous valid item E_ORDER (M28).

### 5.7 Leads

`contact_fields` in `/3`: a non-empty list of at most 3 without repeats, values `phone`, `telegram`, `email` (an unknown value E_FIELD M29; a repeat E_DUP M30; an empty list E_LIMIT M34). In `/1` and `/2` it is as before (M35 for an unknown value).
`whatsapp`: a string; every sign an ASCII digit (`0-9`), otherwise E_FIELD (M31); then 10–15 digits, otherwise E_LIMIT (M32). The empty string is 0 digits → E_LIMIT.
`max_per_hour`: integer 1–1000; `max_stored`: integer 1–10000 (`ctx.int`, E_LIMIT M21; non-integer E_FIELD). The defaults (30 and 1000 when absent) are applied by the lead server (REQ-059); this requirement checks only the form.

## 6. Errors

### 6.1 Order of checks for one value (the first found wins at a place)

Three-language text: type → forbidden sign → length → «ты» (ru) / 18 words (existing). Sign string (mark, tag): type → count → class. Staff name: D10. Colour: form → contrast. Closed id: member or E_REF. Integers: `ctx.int`. Whatsapp: type → class → count. Reported lines are ordered by their place in the file; a missing field is put at its parent; at most 100 lines, then «И ещё ошибок: N.» (all existing).

### 6.2 Code per case

| Code | Cases of this requirement |
|---|---|
| E_FIELD | `look` missing or not an object; extra field in `look`, `colors`, a theme, a staff member, an `object`, `leads` (also every `/3` field in a `/1`/`/2` file); a text not in three languages or without one; mark that is no letter/digit; tag with a space; colour not `#rrggbb` lower case; desk/level/max not an integer; desk missing at some questions; glyph not in the list; whatsapp with a sign other than a digit; unknown contact value; staff-name characters |
| E_LIMIT | mark of 0 or ≥2 code points; tagline/industry/headline/role/says/name length; team size; level or desk or max out of range; tag length; chips count and range; whatsapp length; contrast below 3.0 |
| E_DUP | repeat in `chips`; repeat in `contact_fields` |
| E_REF | `object.id`, `figure`, `shirt` not in the catalogue (with the list in the text) |
| E_ORDER | desks that decrease; chips that decrease |
| E_TEXT | 19 words in a phrase of any look text on any language; «ты» in a `ru` look text; a forbidden or invisible sign in any look text and in the staff name (REQ-068) |
| E_JSON, E_ID, E_COND, E_UNREACHABLE | unchanged and not used by the new rules |

### 6.3 Where the new rules do **not** look

`look` is not read by the engine; the colours are not compared with the question content; `figure`/`shirt` combinations are free; two staff may have the same figure; nothing links `desk` to the number of questions that are visible at once.

### 6.4 The message catalogue

Every text is Russian, uses «вы» or no address, has at most 18 words in the whole text, and ends with a dot. «existing» means the text is already produced by the released code and does not change. `<…>` is a value filled in.

| Id | Code | Text |
|---|---|---|
| M01 | E_FIELD | existing: «Нет поля <name>. Добавьте его.» |
| M02 | E_FIELD | existing: «Лишнее поле <name>. Удалите его.» |
| M03 | E_FIELD | existing: «Ожидается объект. Исправьте значение.» |
| M04 | E_FIELD | existing: «Ожидается целое число. Исправьте значение.» |
| M05 | E_LIMIT | new: «Знаков: <n>, нужен ровно 1. Оставьте одну букву или цифру.» |
| M06 | E_FIELD | new: «Нужна буква или цифра любого алфавита. Исправьте значение.» |
| M07 | E_LIMIT | existing: «Знаков: <n>, допустимо от <a> до <b>. Исправьте текст.» |
| M08 | E_FIELD | existing: «Нет перевода на <lang>. Добавьте текст на этом языке.» |
| M09 | E_FIELD | existing: «Нужен текст на трёх языках: ru, kk и en. Исправьте значение.» |
| M10 | E_TEXT | existing: «Фраза длиннее 18 слов (в ней <n>). Разбейте её точкой.» |
| M11 | E_TEXT | existing: «Обращение не на «вы». Перепишите текст в форме «вы».» |
| M12 | E_TEXT | existing: «Недопустимый знак U+<XXXX> (невидимый или управляющий). Удалите его из текста.» |
| M13 | E_LIMIT | new (D15): «Элементов: <n>, нужно ровно <k>. Исправьте список.» |
| M14 | E_FIELD | new: «Имя — только буквы, цифры, пробел, дефис, апостроф и точка. Исправьте значение.» |
| M15 | E_REF | new: «Допустимо только: f01, f02, f03, f04, f05, f06, f07, f08, f09, f10, f11, f12. Исправьте значение.» (the list is built from `FIGURES`) |
| M16 | E_REF | new: «Допустимо только: accent, accent2, ink. Исправьте значение.» |
| M17 | E_FIELD | new: «Цвет записывается как «#» и шесть строчных шестнадцатеричных цифр, например #1f7a8c. Исправьте значение.» (the example passes the contrast rule on both sheets: 4.56 : 1 on the light and 3.32 : 1 on the dark sheet; a tenant who copies it gets no second error) |
| M18 | E_LIMIT | new: «Контраст цвета с листом светлой темы меньше 3,0 : 1. Возьмите цвет темнее.» |
| M19 | E_LIMIT | new: «Контраст цвета с листом тёмной темы меньше 3,0 : 1. Возьмите цвет светлее.» |
| M20 | E_REF | new (D17): «Допустимо только: shelf, shop, boxes, monitor, laptop, scanner, tsd, clip, bell, phone, cell, headset, poster, coins, chart.» (built from `OBJECT_IDS`) |
| M21 | E_LIMIT | existing: «Число <n> вне границ от <a> до <b>. Исправьте значение.» |
| M22 | E_FIELD | new: «Допустимы только буквы и цифры, без пробелов. Исправьте значение.» |
| M23 | E_FIELD | new: «Допустимо только: tool, box, house, cap. Исправьте значение.» (built from `GLYPHS`) |
| M24 | E_FIELD | new: «Стол задан не у всех вопросов. Добавьте поле desk.» |
| M25 | E_ORDER | new: «Номер стола меньше, чем у предыдущего вопроса. Не уменьшайте его.» |
| M26 | E_LIMIT | existing form: «Элементов: <n>, допустимо от 0 до 4. Исправьте список.» |
| M27 | E_DUP | new: «Число <n> уже есть в chips. Оставьте одно.» |
| M28 | E_ORDER | new: «Числа должны идти по возрастанию. Поставьте это число правее.» |
| M29 | E_FIELD | new: «Допустимо только: phone, telegram, email. Исправьте значение.» (built from `CONTACT_FIELDS_V3`) |
| M30 | E_DUP | existing: «Способ связи <name> указан дважды. Оставьте один.» |
| M31 | E_FIELD | new: «Номер WhatsApp — только цифры, без плюса и пробелов. Исправьте значение.» |
| M32 | E_LIMIT | new: «Цифр: <n>, допустимо от 10 до 15. Исправьте номер.» |
| M33 | E_FIELD | changed: «Допустимо только: sai-picker-tenant/1, sai-picker-tenant/2 или sai-picker-tenant/3. Исправьте значение.» (built from the three constants) |
| M34 | E_LIMIT | existing form: «Элементов: 0, допустимо от 1 до 3. Исправьте список.» (the `/3` bound) |
| M35 | E_FIELD | existing, unchanged for `/1` and `/2`: «Допустимо только: phone, email. Исправьте значение.» |
| M36 | E_FIELD | existing: «Ожидается строка. Исправьте значение.» |
| M37 | E_TEXT | existing (the second text of `ctx.line`; produced for a lone half of a pair in any text it checks: the look texts, the staff name, and the texts of `/1` and `/2` files; M12 is the text of every other forbidden sign): «Непарная половина знака U+<XXXX>. Удалите её из текста.» — 8 words, measured (F20) |

Lists in M15, M16, M20, M23, M29 are built from the constants, never typed a second time. Every message that prints a value of the file prints it through `show()` (existing rule); the new ones above print no file value except numbers. The catalogue holds 37 messages (M01–M37); M01–M04, M07–M12, M21, M26, M30, M34–M37 are produced by the released code.

### 6.5 Failure paths: what the user sees and what stays unchanged (Q10, Q5)

| Situation | What the user sees | What stays unchanged | Test |
|---|---|---|---|
| A `/3` file has any error of the section `look`, a desk, a chips list, an object or a leads field | `check`: the lines of 6.4 (all errors at once, at most 100, then «И ещё ошибок: N.»), code 1, stderr empty | The file bytes; the folder (nothing is created, renamed or removed) | LK-2a…LK-5d, LK-7b |
| `schema` is none of the three | One schema line (M33) and then the reading as `/1`; code 1 | Same | LK-1c, LG-1c, LG-1c2 |
| A hostile value in a new field (number, `null`, list, empty object, language object inside a language, 100 000 signs, nesting of 20 000), also in `questions` itself or in one of its entries | Lines of the usual shape, or one `E_JSON` line for the nesting; code 0 or 1; no stack, stderr empty | Same | LP-1, LK-5e |
| The file cannot be read, is a link, is larger than 512 KB, is not UTF-8 | As before (code 2 with one `picker:` line, or `E_JSON`) | Same | the existing tests of `picker-config.test.js`, `picker-load.test.js` and `picker-parse.test.js` stay green (measured in the sketch) |
| The tenants folder of `serve` holds a bad `/3` file | At the start the existing block «Арендатор <file> не обслуживается:» with the lines of the check; the address of that tenant answers 404 as an unknown tenant (REQ-056) | The other tenants: their answers are the same bytes as without the bad file | LP-2, SV-9c |
| A shared function gets a wrong argument (`deskForQuestion("x", null)`, `markOf(5)`, `contrastRatio("red", "blue")`, `fallbackLook(undefined)`) | An integer 1…4 / `"#"` / `NaN` / a look with an empty headline; no exception | No module state exists to change | LK-6d, LK-6e |
| `lookOfView`, `ownLookOfView` or `publicLook` gets an unchecked file | A program error (a thrown error), as `publicQuestionnaire` does today. Not reachable: `tenants.js` builds a view only for a file with exit code 0, in the same call that checked it | — | by construction (see below) |
| The sheet constants or the neutral colours are changed by mistake | The literal test fails | The tenants that were accepted are not re-checked by themselves | LK-3e |

**Protection in the same operation as the action.** The check and the build of the answers are one call: `loadTenants` runs `checkBytes` on the bytes it read and builds the views and the questionnaire bytes from the object that passed that very check (`entryOf(fileName, bytes, checked.tenant)`); the version of the answer is the hash of those bytes. There is no "check now, act later in another call": a file that changes after the start is not read until the restart (existing rule of REQ-056).

## 7. What the server gives (public data)

### 7.1 The questionnaire of a `/3` file

`publicQuestionnaire(view, { version, lang, languages })` keeps its signature. It decides "this is a `/3` view" by the view having its own `look`. For `/1` and `/2` views nothing is added and the key order is the old one — the answers do not change by a byte (F4).

Key order of the questionnaire of a `/3` file (the oracle of SV-2a compares the text, so the order is part of the contract): `version, lang, languages, name, look, intro, questions_min, questions_max, questions, ai, leads`.
Order of keys of a question (each only where the file has it, in this order): `id, title, help, type, required, options, min, max, unit, chips, desk, show_if`. An option: `id, label, object`. An `object`: `id, level, tag, glyph` (only those in the file). `leads` (when enabled): `contact_fields, whatsapp, consent_text, operator_name, privacy_contact, retention_days`, where `whatsapp` is always present (the file's string or `null`). `max_per_hour` and `max_stored` are never copied.

### 7.2 The look object

`publicLook(look)` → a new plain object, built field by field, so a field of the file that is not named here does not leave the server (the extra fields of the tests of 11 are the proof):

| Key | Value |
|---|---|
| `mark` | the file's `mark` |
| `tagline` | the file's `tagline` in the language, or `null` when the file has none |
| `industry`, `headline` | the file's text in the language |
| `colors` | `{ light: { accent, accent2 }, dark: { accent, accent2 } }` |
| `team` | four objects `{ name, role, says, figure, shirt }` |

`lookOfView(view)` → `publicLook(view.look)` when the view has its own `look`, else `fallbackLook(view.name)`. `view` is a **checked** tenant in one language (the result of `tenantInLanguage`); handing it an unchecked file is a program error (the contract of `publicQuestionnaire` today; the loader never does it: `tenants.js` builds views only for files with exit code 0). Each call returns new objects.

`ownLookOfView(view)` → `publicLook(view.look)` when the view has its own `look`, else `null` (a `/1` or `/2` view). Same contract for the argument as `lookOfView`. So `lookOfView(view)` equals `ownLookOfView(view)` when that is not `null`, and `fallbackLook(view.name)` otherwise; the two never disagree about a `/3` file.

### 7.3 Users of the new data (so that the next requirements find the right entry)

REQ-071 reads the questionnaire. REQ-065 calls `lookOfView(entry.views.get(lang))` for the field `look` of the progress data (a look for a tenant of any format, never `null`; for a `/1` or `/2` tenant it equals the fallback), and REQ-066 draws that field. REQ-077 calls `ownLookOfView(entry.views.get(lang))` for `look` of `api/tenants` and of the board data: the file's own look, or `null` for a `/1` or `/2` file, as its criteria require. REQ-078 calls neither function: the board page takes `look` (or `null`) from the answer of REQ-077 and, for `null`, builds the look in the browser with `fallbackLook(name)` of `public/tenant-look.js` (`public-data.js` is server code and cannot be imported by a page). REQ-059 reads `max_per_hour`, `max_stored`, `whatsapp` and `contact_fields` from the **view** of the registry (`entry.views.get(lang).leads`), not from the public questionnaire (they are not there, except `contact_fields` and `whatsapp`).

## 8. The shared module `public/tenant-look.js`

Pure ES module: no import of any kind (the test looks for the words `import`, `require`, `node:`, `process` in the text, so they must not stand there even inside a word or a comment), no document, no clock, no random, no state between calls. Exports (names are the contract):

| Export | Kind | Value / signature |
|---|---|---|
| `OBJECT_IDS` | frozen list | the 15 ids of 5.5 in that order |
| `OBJECT_RULES` | frozen map id → `{ level: [min, max] \| null, tag: boolean, glyph: boolean }` | the table of 5.5 |
| `GLYPHS` | frozen list | `tool, box, house, cap` |
| `FIGURES` | frozen list | `f01`…`f12` |
| `SHIRTS` | frozen list | `accent, accent2, ink` |
| `TEAM_SIZE` | number | 4 (also the number of desks) |
| `SHEET` | frozen `{ light, dark }` | `#f3f5f9`, `#161f2e` |
| `MIN_CONTRAST` | number | 3 |
| `NEUTRAL_COLORS` | frozen `{ light: { accent, accent2 }, dark: { … } }` | D12 |
| `isMarkSign(ch)` | `(string) → boolean` | true for exactly one code point that is a letter or a decimal digit; false for anything else, any type |
| `isColor(v)` | `(any) → boolean` | the form of 5.4 |
| `contrastRatio(a, b)` | `(string, string) → number` | the ratio of 5.4; `NaN` when either is not a colour; never throws |
| `markOf(name)` | `(any) → string` | the fallback mark (below) |
| `deskForQuestion(index, total)` | `(any, any) → 1…4` | D14 |
| `fallbackLook(name)` | `(any) → Look` | the fallback look (below) |

**Fallback mark.** Go through `name` by code points; the first code point for which `isMarkSign` is true is taken; its upper case is the mark if the upper case is **one** code point (`«у»`→`У`, `«𐐨»`→`𐐀`), else the letter itself (`«ß»` upper-cases to two signs, `«ŉ»` to two) stays; no such sign, or `name` not a string → `"#"`. Locale-independent upper case.
**Desk rule.** `floor(index × 4 / total) + 1` for integers with `total ≥ 1` and `0 ≤ index < total`; the table N=1 → `[1]`, N=5 → `[1,1,2,3,4]`, N=12 → `[1,1,1,2,2,2,3,3,3,4,4,4]` (N=2 → `[1,3]`, N=3 → `[1,2,3]`, N=4 → `[1,2,3,4]`).
**Fallback look.** For `fallbackLook(name)`: `mark = markOf(name)`; `tagline = null`; `industry = null`; `headline = name` (or `""` when `name` is not a string); `colors` = a copy of `NEUTRAL_COLORS`; `team` = four objects with `name = null`, `role = null`, `says = null`, `figure = FIGURES[i]`, `shirt = ["accent", "accent2", "ink", "accent"][i]`. The staff number `i` stands at the desk `i + 1` by position. The module holds **no text of any language and no key of `texts.js`**: the page maps a `null` role at desk `n` to its own key `scene_desk_n` (decision 0084 item 17; the keys are REQ-071's). The module must pass the search of criterion 6 (13.3) — in particular no snake-case word starting with `lead_`, `flow_`, `receipt_`, `progress_`, `panel_`, `quiz_`, `scene_`, `shell_`, `start_`, `act_` (lower case).

Words that the page tests forbid in every file of `public/`, comments included, are listed in 13.2; the file must not contain them.

## 9. Guard tests of earlier requirements: the replacement tables (AP-068, AP-112, AP-113)

Found by reading `tools/test/` (greps over the schema values, the module lists, the key lists of the questionnaire, the page lists) and **confirmed by running** the sketch (F5). The prohibition of each test is kept; a number is changed only where the list it counts grew. After the replacement, `git grep -h '^test(' … | wc -l` per file and the count of lines with `assert.` do not fall below the tag (baselines: `picker-lang.test.js` 45 / 298, `picker-config.test.js` 35 / 131, `picker-engine.test.js` 27 / 199, `picker-page-static.test.js` 12 / 127, `picker-server.test.js` 40 / 298, `picker-server-units.test.js` 14 / 187; tests / lines with `assert.`).

### 9 (A). Tests that turn red (7, measured)

| # | Test and place | Why it turns red | Was → became |
|---|---|---|---|
| A1 | **PK-2a** (`picker-config.test.js`) through `EXPECTED["e-field-schema.json"]` at `picker-helpers.js:319-322`; sample `tools/test/fixtures/picker/e-field-schema.json:2` | The sample holds `"sai-picker-tenant/3"` as the wrong value; it is right now, and the line lists three formats | Sample line 2: `"sai-picker-tenant/3"` → `"sai-picker-tenant/4"`. `picker-helpers.js:322`: «…Допустимо только: sai-picker-tenant/1 или sai-picker-tenant/2. Исправьте значение.» → «…Допустимо только: sai-picker-tenant/1, sai-picker-tenant/2 или sai-picker-tenant/3. Исправьте значение.». Exit code (1), place (`schema`), code (E_FIELD), the one-line output and the count of 44 samples (PK-8e) are the same. The body of the sample is a `/1` body, so the output stays one line (measured). This is the only changed file of the folder (criterion 1 command) |
| A2 | **PK-6e** (`picker-config.test.js:755`) | It counts by a **list**: the listing of `src/picker/*.js` must equal `ALL_MODULES` (`picker-helpers.js:59`); the directory has two more files | `CORE_MODULES` (`picker-helpers.js:29-48`, 18 names) gets `shape.js` and `v3-check.js` (20 names). `READ_MODULES`, `ALL_MODULES` and `NODE_IMPORTS` are derived from it. The ban of the writing words in every module outside `WRITE_MODULES` (`[]`) is unchanged and now covers the two new files |
| A3 | **PK-7c** (`picker-config.test.js:797`; line 811) | It counts by the same **list** and by a **number** (`CORE_MODULES.length`); the keys of `NODE_IMPORTS` must equal the directory | `assert.equal(CORE_MODULES.length, 18)` → `20`. The two new rows are `[]` (no `node:` module, and the word `node:` nowhere in them): the ban is the same |
| A4 | **PE-8d** (`picker-engine.test.js:1363-1372`; line 1372) | It counts by the same **list** and a **number** (`ALL_MODULES.length`) | `assert.equal(ALL_MODULES.length, 23)` → `25`; the first `deepEqual` (listing = list) stays |
| A5 | **LG-1c** (`picker-lang.test.js:129`; `SCHEMA_LINE` at 126-127; `wrong` list at 132-141) | It lists literal wrong values (no count of files): `"sai-picker-tenant/3"` is no longer wrong; `SCHEMA_LINE` lists two formats | Line 133 `"sai-picker-tenant/3"` → `"sai-picker-tenant/4"` (the other wrong values stay: `…/`, `…/20`, `…/2 `, ` …/2`, `SAI-…/2`, `…/12`, `""`); `SCHEMA_LINE` → the new line of M33; the title says «neither /1 nor /2» → «none of /1, /2, /3». The acceptance of a right `/3` file is not in this test (it is LK-1a), and the loop of right values `[V1, V2]` stays |
| A6 | **LG-1c2** (`picker-lang.test.js:175`; values 180-190; 214-226) | Same | Line 181 `["sai-picker-tenant/3", SCHEMA_LINE]` → `["sai-picker-tenant/4", SCHEMA_LINE]`; lines 215 and 224 `schema: "sai-picker-tenant/3"` → `"sai-picker-tenant/4"`; `SCHEMA_LINE` as A5. The rest (the first line is about `schema`, the others are the reading as `/1`, `places.length`) is the same |
| A7 | **QS-1** (`picker-page-static.test.js:15-28`, title 48, line 60) | It counts by a **list** and a number: the directory of `public/` must equal the literal `FILES` (13 names); the directory holds a 14th file | `FILES` gets `"tenant-look.js"` (between `"store.js"` and `"texts.js"`); `assert.equal(FILES.length, 13)` → `14`; the title «exactly the 13 of the design» → «exactly the files of the design (14)». Unchanged: no folder, the pattern of the server's names, the extensions `.js .css .html`, no old placeholder file, and the set of the directory equals the list **exactly**. **A7, B1 and B2 are one change** (the red set after A7 alone is QS-7, measured: its file list is derived from `FILES`, and its `GRAPH` literal has no entry for the new file) |

### 9 (B). Tests that are green on the tag but must be edited to keep protecting (rows that act now)

B1 and B2 are green only as long as A7 is not applied: **A7, B1 and B2 are made in one change** (one sub-step of the tests step; QS-7 derives its file list from `FILES` and is red after A7 alone, measured; QS-5 needs the new name in its pure list at the same time). B3 is separate and is green with them (`picker-page-static.test.js`: 12 of 12, measured).

| # | Test and place | Was → became |
|---|---|---|
| B1 | **QS-5** (`picker-page-static.test.js:207-228`; the pure list at 213-221) | The list of files that must not touch `document` (`rules.js, flow.js, say.js, store.js, net.js, texts.js`) gets `tenant-look.js`. Unchanged: `localStorage`/`fetch(`/`AbortSignal`/`history.`/`scrollTo`/`location` each in its one file; `document` in `app.js` and `dom.js` only |
| B2 | **QS-7** (`picker-page-static.test.js:242-309`) | `GRAPH` gets `"tenant-look.js": []`; the list of the files that import nothing (`rules.js, store.js, net.js, dom.js`) gets `tenant-look.js`; the name pattern of an import `/^\.\/[a-z]+\.js$/` → `/^\.\/[a-z]+(-[a-z]+)*\.js$/` (row 7 of the requirement); a "the pattern bites" assertion on samples is added (`./progress-page.js` and `./tenant-look.js` pass; `./Look.js`, `./a_b.js`, `./-a.js`, `./a-.js`, `./a--b.js`, `../x.js` do not). No cycle, no `node:`, no `../`, `main.js` the only file that runs at load: the same |
| B3 | **QS-12** (`picker-page-static.test.js:651-687`; lines 676-678) — **row (12), acts now by `decisions/0085` item 5** | `readdirSync(test).filter(/^picker-page.*\.js$/)` and `assert.ok(tests.length >= 5)` → every `picker-*.js` of `tools/test` (tests and helpers), `assert.ok(tests.length >= 25)` (25 on the tag, F3), and the same no-rule-off / no-formatter-ignore ban on each; plus each file of `public/`. The new `picker-look*` files would otherwise escape the ban. The row of the requirement also names the folder `board-public/`: it does not exist yet, **its half of the row belongs to REQ-078**, not to this work. The assertion line is one line (`tests.length >= 25`; the command is in 11.1 row 9) |
| B4 | **LG-10d** (`picker-lang.test.js:1637`) | The pure-modules list `lang-check.js, view.js, public/texts.js` gets `shape.js`, `v3-check.js`, `public/tenant-look.js` (a strengthening: no clock, random or environment word in them) |
| B5 | **SV-2a** (`picker-server.test.js:454`) and its oracle `expectedQuestionnaire` (`picker-server-helpers.js:577-`) | The loop over the two demo ids stays; the two `/3` samples `ok-office-a`, `ok-office-b` are added through the oracle, which is extended by the `/3` form of 7.1 (written again from the requirement, key order included; the test compares the text). `expectedQuestionnaire` and `expectedResult` decide the form by `tenant.schema === "sai-picker-tenant/2"` (lines 580, 628): they must treat `/3` as a three-language form (the same in `picker-page-helpers.js:148`, which only the demo ids reach today) |
| B6 | **SV-2b** (`picker-server.test.js:505`) | For `/3`: the top keys are those of 7.1; the question keys may also be `chips`, `desk`; the option keys `id, label` or `id, label, object`; the keys at `$.look`, `$.look.colors`, `.light`, `.dark`, `$.look.team[]`, `$.questions[].options[].object` are those of 7.2/5.5; `$.leads` keys have `whatsapp`; the forbidden-name list (`NEVER`) is extended by `max_per_hour`, `max_stored`. For `/2` the expectations are the old ones |
| B7 | **SV-2g** (`picker-server.test.js:758`) | A second view with extra fields at every new level (look, colors, a theme, a staff member, a question's `desk`/`chips`, an option's `object`, `leads`) must give only the listed fields; the first view (the `/2`-like one) is unchanged and its key list is unchanged |
| B8 | **SU-9** (`picker-server-units.test.js:507`) | The `/2` and `/1` expectations stay (`Object.keys(entry)` = the six keys, `languages`, frozen views). A `/3` entry is added: the same six keys, `languages` `["ru","kk","en"]`, `views.get(lang).look` frozen, `questionnaires` three buffers |

### 9 (C). Tests that need no edit and that act on the new files (all green in the sketch)

PK-7a (`fetch(`, `http.request`, `node:net`, `node:dgram`, `child_process`, `Math.random`), PK-8c (`readdir`, `opendir`, `glob` — as a substring, so even «global» in a comment of a new core file would be red), PK-8d (no path of this computer in the new files), PK-8e (the 44 samples; **no new file in `fixtures/picker/`**), LG-10c (no address or network word in `public/`), TR-4f (no `http://`/`https://` in `public/`), TT-7a (the escaped sign patterns `\p{Cc}`, `\p{Cf}`, `\p{Cs}` and the escapes of U+2028, U+2029, U+200B, U+202E, U+FEFF, U+0085 stand in `text-rules.js` only: the new core files must not hold them), TT-10a (the README paragraph with both `E_TEXT` and `U+200B` is found by its first match: a new README paragraph must not hold both words), SV-1f, SV-7h, SV-8a, SU-10, QS-2, QS-3, QS-6, QS-8, QS-9, QS-10, QS-11 (these act on the new public file because `FILES` now lists it), and all of `traces-*.test.js`.

### 9 (D). The twelve rows of the page-test table of the requirement (the table "stands here")

The rule for all rows: the ban stays; an exception names its word and its files, and the test compares the set of files that hold the word with the table **by equality**; every exception has a mutant (the test puts the forbidden word into a file where it is not allowed and goes red). **At this release no row gets an exception.** The shape of a table of exceptions, for the requirements that add one: a literal `WORD_EXCEPTIONS` in `picker-page-static.test.js`, word → list of file names (sorted); the test for the word asserts that the list of files holding the word equals the list.

| Row | Test | Was | Became | Acts now |
|---|---|---|---|---|
| (1) | QS-1 | 13 names | the project's list: the 13 + `tenant-look.js` = 14 (A7); later requirements add their files to the same literal | **yes** |
| (2) | QS-2 | `index.html` rules | unchanged until REQ-071 decides on a canvas in the markup | no |
| (3) | QS-3 | the word list | no change at this release; `requestAnimationFrame`, `matchMedia`, `setTimeout`, `navigator.`, `window.open`, `location.assign`, `.style.setProperty(` exceptions are named by the requirements that own them (REQ-071, 087, 074, 075, 066, 076) in `WORD_EXCEPTIONS`; `setInterval`, `alert(`, `confirm(`, `prompt(`, `showModal`, `beforeunload`, `dialog`, `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `console.`, `XMLHttpRequest`, `eval(`, `new Function`, `import(`, `localStorage.clear`, `.key(`, `sessionStorage`, `indexedDB`, `document.cookie`, `postMessage`, `location.reload`, `location.replace`, `pushState`, `history.go`, `history.back`, `Accept-Language` have no exception ever | no (acts on the new file automatically after row 1) |
| (4) | QS-4 | `API_QUESTIONNAIRE`, `API_RESULT` | later (REQ-074 and the others) | no |
| (5) | QS-5 | pure list of six | seven (B1) | **yes** |
| (6) | QS-6 | no REQ numbers, `handoff`, `ORCH`, `decisions` in `public/` | no edit; acts on the new file after row 1 | automatic |
| (7) | QS-7 | graph of 13, name pattern `[a-z]+` | graph of 14, pattern `[a-z]+(-[a-z]+)*` (B2) | **yes** |
| (8) | QS-8 | tokens of REQ-057 | later (REQ-071 with REQ-087) | no |
| (9), (10) | QS-9, QS-10 | no `engine`, no `let`/`var` at line start | no edit; act on the new file after row 1 | automatic |
| (11) | QS-11 | 35 keys | later; this release adds no key | no |
| (12) | QS-12 | `picker-page*.js`, at least 5 | all `picker-*.js`, at least 25 (B3); the `board-public/` half: REQ-078 | **yes** (`decisions/0085` item 5) |

## 10. Samples and stand files

### 10.1 Principles

All samples of this requirement are in `tools/test/fixtures/picker-look/` (89 files; the folder is closed by a test with the exact list, like PK-8e). They are invented. Each file is a valid JSON written by `npm run format` (prettier checks the folder), ends with a newline, and its `id` equals its name without `.json`. `ok-minimal.json` is the `/3` form of `tools/test/fixtures/picker/ok-minimal.json` (the same ids, questions, solutions, rules and `result`; the texts get `kk` and `en` copies; the `leads` of the original has `enabled` false and stays so in `ok-minimal`). It carries **every `/3` section** (criterion 1): `look` with `tagline`, `desk` on all four questions (`1,2,3,4`), `chips` `[10, 50, 200]` on the number question (`min 1`, `max 1000`), `object` on four options (`shelf` level 2, `monitor` tag `1С`, `boxes` level 1, `poster` glyph `cap`), `leads` with `contact_fields` `["phone","telegram","email"]`, `whatsapp` `"77010000000"`, `max_per_hour` 30, `max_stored` 1000. Look colours: light `#9a4306` / `#1f7a8c`, dark `#e0731f` / `#6cc3d5` (all four pass the rule; checked). It must hold no address and no code: `grep -rnE 'https?://|url[(]|<script|javascript:'` over it is empty (code 1).
Every other sample is `ok-minimal.json` with **one** change (the two `/2` samples: see the end of 10.2), written below; the expected output is the code and the lines (place, code, message id of 6.4). Places in the files are the ones of the table; the lines of one sample are in the order of the file. The expected lines are written in the helper as literals (not computed from the code): place, code and the whole text (the message of 6.4 with the values of that sample filled in). **LK-1e runs every row** (11.2): this is the test that reads the table.

### 10.2 The 87 rows of the sample tables: `ok-minimal` and 86 samples that each differ from it by one change (the two `/2` samples differ by the `/2` body, below); 78 error samples and 9 accepted ones, `ok-minimal` among the 9 (verified on the sketch: every line passes `lineProblems`)

**Look: presence and form**

| Sample (`.json`) | Differs from `ok-minimal` | Expected output |
|---|---|---|
| `ok-minimal` | the /3 form of the released ok-minimal sample: same ids, questions, solutions and rules, every /3 section present (look with tagline, desk on all four questions, chips on the number question, objects on four options, leads with telegram, whatsapp, max_per_hour, max_stored) | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |
| `ok-no-tagline` | look.tagline removed | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |
| `e-look-missing` | look removed | code 1: look E_FIELD M01 |
| `e-look-string` | look is the string "office" | code 1: look E_FIELD M03 |
| `e-look-extra` | look.logo added (a string) | code 1: look.logo E_FIELD M02 |
| `e-look-staff-extra` | look.team[0].age added (a number) | code 1: look.team[0].age E_FIELD M02 |
| `e-v2-with-look` | a /2 body (schema /2, no /3 fields) plus look | code 1: look E_FIELD M02 |
| `e-v2-with-v3-fields` | a /2 body plus object, desk, chips, whatsapp, max_per_hour, max_stored and contact_fields ["phone","telegram"] | code 1: seven lines (below) |

**Mark and the length of the look texts**

| Sample (`.json`) | Differs from `ok-minimal` | Expected output |
|---|---|---|
| `e-mark-empty` | mark "" | code 1: look.mark E_LIMIT M05 |
| `e-mark-two` | mark "АБ" | code 1: look.mark E_LIMIT M05 |
| `e-mark-space` | mark " " | code 1: look.mark E_FIELD M06 |
| `e-mark-emoji` | mark "😀" | code 1: look.mark E_FIELD M06 |
| `e-mark-dash` | mark "-" | code 1: look.mark E_FIELD M06 |
| `e-mark-half` | mark "\ud800" (a single half of a pair, written as an escape) | code 1: look.mark E_FIELD M06 |
| `e-tagline-41` | tagline: 41 signs in ru, kk and en | code 1: look.tagline.ru E_LIMIT M07 · look.tagline.kk E_LIMIT M07 · look.tagline.en E_LIMIT M07 |
| `e-industry-61` | industry: 61 signs in each language | code 1: look.industry.ru E_LIMIT M07 · look.industry.kk E_LIMIT M07 · look.industry.en E_LIMIT M07 |
| `e-headline-121` | headline: 121 signs in each language | code 1: look.headline.ru E_LIMIT M07 · look.headline.kk E_LIMIT M07 · look.headline.en E_LIMIT M07 |
| `e-headline-no-kk` | headline without kk | code 1: look.headline.kk E_FIELD M08 |
| `e-headline-string` | headline is a string | code 1: look.headline E_FIELD M09 |

**Texts of the look**

| Sample (`.json`) | Differs from `ok-minimal` | Expected output |
|---|---|---|
| `e-words-19` | 19 one-letter words in look.headline.kk, look.industry.en and look.team[1].role.ru (37 signs, fits the limit 40) | code 1: look.industry.en E_TEXT M10 · look.headline.kk E_TEXT M10 · look.team[1].role.ru E_TEXT M10 |
| `e-text-ty` | look.team[0].says.ru "ты получишь" | code 1: look.team[0].says.ru E_TEXT M11 |
| `e-text-sign` | U+0007 in look.headline.en, U+200B in look.team[0].name and a lone half of a pair (the escape for U+D800, after the word «Есеп») in look.team[1].says.kk (all written as escapes) | code 1: look.headline.en E_TEXT M12 · look.team[0].name E_TEXT M12 · look.team[1].says.kk E_TEXT M37 |

**Team**

| Sample (`.json`) | Differs from `ok-minimal` | Expected output |
|---|---|---|
| `e-team-3` | three staff | code 1: look.team E_LIMIT M13 |
| `e-team-5` | five staff | code 1: look.team E_LIMIT M13 |
| `e-staff-no-figure` | team[2] without figure | code 1: look.team[2].figure E_FIELD M01 |
| `e-staff-name-31` | team[0].name of 31 signs | code 1: look.team[0].name E_LIMIT M07 |
| `e-staff-name-empty` | team[0].name "" | code 1: look.team[0].name E_LIMIT M07 |
| `e-staff-name-url` | team[0].name "url(http://x)" | code 1: look.team[0].name E_FIELD M14 |
| `e-figure-f00` | team[0].figure "f00" | code 1: look.team[0].figure E_REF M15 |
| `e-figure-f13` | team[1].figure "f13" | code 1: look.team[1].figure E_REF M15 |
| `e-figure-capital` | team[2].figure "F01" | code 1: look.team[2].figure E_REF M15 |
| `e-shirt-red` | team[3].shirt "red" | code 1: look.team[3].shirt E_REF M16 |

**Colours**

| Sample (`.json`) | Differs from `ok-minimal` | Expected output |
|---|---|---|
| `e-color-upper` | light.accent "#E0731F" | code 1: look.colors.light.accent E_FIELD M17 |
| `e-color-short` | light.accent "#fff" | code 1: look.colors.light.accent E_FIELD M17 |
| `e-color-url` | dark.accent2 "url(x)" | code 1: look.colors.dark.accent2 E_FIELD M17 |
| `e-color-number` | dark.accent 255 | code 1: look.colors.dark.accent E_FIELD M17 |
| `e-colors-no-dark` | colors.dark removed | code 1: look.colors.dark E_FIELD M01 |
| `e-colors-no-accent2` | colors.light.accent2 removed | code 1: look.colors.light.accent2 E_FIELD M01 |
| `e-colors-extra` | colors.sepia added (an object) | code 1: look.colors.sepia E_FIELD M02 |
| `e-contrast-light` | light.accent "#1999c6" (2.9999996 : 1 on the light sheet) | code 1: look.colors.light.accent E_LIMIT M18 |
| `e-contrast-dark` | dark.accent2 "#c22c5c" (2.9999994 : 1 on the dark sheet) | code 1: look.colors.dark.accent2 E_LIMIT M19 |

**Objects**

| Sample (`.json`) | Differs from `ok-minimal` | Expected output |
|---|---|---|
| `e-object-unknown` | object {id:"Shelf"} | code 1: questions[0].options[0].object.id E_REF M20 |
| `e-object-number` | object {id:5} | code 1: questions[0].options[0].object.id E_REF M20 |
| `e-object-string` | object "shelf" | code 1: questions[0].options[0].object E_FIELD M03 |
| `e-object-extra` | object.size added | code 1: questions[0].options[0].object.size E_FIELD M02 |
| `e-object-level-0` | shelf level 0 | code 1: questions[0].options[0].object.level E_LIMIT M21 |
| `e-object-level-4-shelf` | shelf level 4 | code 1: questions[0].options[0].object.level E_LIMIT M21 |
| `e-object-level-5-boxes` | boxes level 5 | code 1: questions[1].options[0].object.level E_LIMIT M21 |
| `e-object-level-phone` | phone with level 1 | code 1: questions[0].options[0].object.level E_FIELD M02 |
| `e-object-tag-4` | monitor tag "ABCD" | code 1: questions[0].options[1].object.tag E_LIMIT M07 |
| `e-object-tag-empty` | monitor tag "" | code 1: questions[0].options[1].object.tag E_LIMIT M07 |
| `e-object-tag-space` | monitor tag "A B" | code 1: questions[0].options[1].object.tag E_FIELD M22 |
| `e-object-tag-poster` | poster with tag "A" | code 1: questions[3].options[0].object.tag E_FIELD M02 |
| `e-object-glyph-star` | poster glyph "star" | code 1: questions[3].options[0].object.glyph E_FIELD M23 |
| `e-object-glyph-monitor` | monitor with glyph "tool" | code 1: questions[0].options[1].object.glyph E_FIELD M02 |
| `e-object-on-number-options` | the number question gets options (one with an object) | code 1: questions[2].options E_FIELD M02 |

**Desks and chips**

| Sample (`.json`) | Differs from `ok-minimal` | Expected output |
|---|---|---|
| `e-desk-0` | questions[0].desk 0 | code 1: questions[0].desk E_LIMIT M21 |
| `e-desk-5` | questions[0].desk 5 | code 1: questions[0].desk E_LIMIT M21 |
| `e-desk-fraction` | questions[0].desk 2.5 | code 1: questions[0].desk E_FIELD M04 |
| `e-desk-string` | questions[0].desk "1" | code 1: questions[0].desk E_FIELD M04 |
| `e-desk-empty-value` | questions[0].desk is JSON null (the file name avoids the word, see 13.4) | code 1: questions[0].desk E_FIELD M04 |
| `e-desk-partial` | questions[2].desk removed | code 1: questions[2].desk E_FIELD M24 |
| `e-desk-order` | desks 1,2,1,2 | code 1: questions[2].desk E_ORDER M25 |
| `ok-desk-flat` | desks 1,1,2,4 | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |
| `e-chips-single` | chips on a single question | code 1: questions[0].chips E_FIELD M02 |
| `e-chips-5` | five chips | code 1: questions[2].chips E_LIMIT M26 |
| `e-chips-range` | chips [5,1001] (max 1000) | code 1: questions[2].chips[1] E_LIMIT M21 |
| `e-chips-fraction` | chips [2.5] | code 1: questions[2].chips[0] E_FIELD M04 |
| `e-chips-dup` | chips [5,5] | code 1: questions[2].chips[1] E_DUP M27 |
| `e-chips-order` | chips [50,10] | code 1: questions[2].chips[1] E_ORDER M28 |
| `ok-chips-edges` | chips [1,2,999,1000] (min 1, max 1000) | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |
| `ok-chips-empty` | chips [] | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |

**Leads**

| Sample (`.json`) | Differs from `ok-minimal` | Expected output |
|---|---|---|
| `ok-contact-telegram` | contact_fields ["telegram"] | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |
| `e-contact-empty` | contact_fields [] | code 1: leads.contact_fields E_LIMIT M34 |
| `e-contact-sms` | contact_fields ["sms"] | code 1: leads.contact_fields[0] E_FIELD M29 |
| `e-contact-dup` | contact_fields ["phone","phone"] | code 1: leads.contact_fields[1] E_DUP M30 |
| `e-wa-plus` | whatsapp "+77010000000" | code 1: leads.whatsapp E_FIELD M31 |
| `e-wa-letters` | whatsapp "7701abc0000" | code 1: leads.whatsapp E_FIELD M31 |
| `e-wa-9` | whatsapp of 9 digits | code 1: leads.whatsapp E_LIMIT M32 |
| `e-wa-16` | whatsapp of 16 digits | code 1: leads.whatsapp E_LIMIT M32 |
| `ok-wa-10` | whatsapp of 10 digits | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |
| `ok-wa-15` | whatsapp of 15 digits | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |
| `e-rate-0` | max_per_hour 0 | code 1: leads.max_per_hour E_LIMIT M21 |
| `e-rate-1001` | max_per_hour 1001 | code 1: leads.max_per_hour E_LIMIT M21 |
| `e-stored-0` | max_stored 0 | code 1: leads.max_stored E_LIMIT M21 |
| `e-stored-10001` | max_stored 10001 | code 1: leads.max_stored E_LIMIT M21 |
| `ok-limits-edges` | max_per_hour 1, max_stored 10000 | code 0, the line «Файл арендатора <id> в порядке: вопросов 4, решений 2, правил 3.» |

`e-v2-with-v3-fields` gives seven lines, in the order of the places in the file: `questions[0].options[0].object` E_FIELD M02; `questions[0].desk` E_FIELD M02; `questions[2].chips` E_FIELD M02; `leads.contact_fields[1]` E_FIELD M35; `leads.whatsapp` E_FIELD M02; `leads.max_per_hour` E_FIELD M02; `leads.max_stored` E_FIELD M02. (The `contact_fields[1]` line is the old line, because `telegram` is no value of a `/2` file.)
**The `/2` body** (a function of `picker-look-helpers.js`, built in memory from `ok-minimal` and written by the test into a temporary folder outside the project) is `ok-minimal` with `schema` `sai-picker-tenant/2` and these eight `/3` items removed: `look`; `desk` of every question; `chips`; `object` of every option; `leads.whatsapp`; `leads.max_per_hour`; `leads.max_stored`; and `telegram` from `leads.contact_fields` (so `["phone","email"]`). The test first checks that this body alone is accepted (code 0, «…вопросов 4, решений 2, правил 3.»). The sample file `e-v2-with-look.json` is that body plus `look`; `e-v2-with-v3-fields.json` is that body plus the six fields and `telegram` of the line above.

### 10.3 The two tenants of the server tests

`ok-office-a.json` and `ok-office-b.json`: two `/3` files with different names, taglines, industries, headlines, staff names, roles, replies and colours in the three languages, different `desk` values, chips, objects and a `whatsapp` number each; no string of the look of B equals any string of A (the isolation test compares values). Each is a different small tenant (3–5 questions) with `leads.enabled` true (so `whatsapp` reaches the questionnaire); ids `ok-office-a` and `ok-office-b`; `max_per_hour` and `max_stored` set to values (for example 7 and 77) that appear nowhere else in the answer.

### 10.4 Stand files this run needs

**None in the product tree.** This run adds nothing to `tools/src/picker/demo-tenants/` or `demo-answers/` and does not start a stand tenant of `/3`: the two demo tenants stay `/2` and are the proof of the fallback look (their criteria in REQ-054, 056, 061 stay true: 12/5/39 and 11/5/37, two links of the stand, `/2`). The `/3` files of this run are test samples only. The two new fictitious `/3` tenants of the stand (REQ-070) go to their own folder; for them REQ-070 needs from this design: the format of section 5; the colour rule and the sheets (an accent that passes: F11 shows that the sample's light accent `#e0731f` fails and the sample's text accent `#9a4306` passes; the sample's second-agency accent `#5b3fd6` passes on the light sheet and fails on the dark one); the twelve figure ids, the 15 object ids and their parameters; the staff order by desk; `lookOfView` and `ownLookOfView` for tests. **Advice for REQ-070 (V3 of the gate of the micro-amendment):** a replacement colour is the nearest passing colour of the same hue — only the lightness changes, so the accent still reads as the colour of the sample; the value is chosen by the executor of REQ-070 and the rule is proved by its test, not by a list here.
A server test that needs a tenant folder copies the sample files into a temporary folder outside the project and removes it after the test (as the old server tests do).

## 11. The table "criterion → design element → test" (Q5) and the test catalogue

### 11.1 Criteria

The commands of the criteria are marked **runs now** (they give the shown output on the tag tree today and must give the same, or the shown value, after the work) or **needs the work** (they cannot run before the new code and the new files exist). Measured now: F19.

| Crit. | Design elements | Tests (file) |
|---|---|---|
| 1. `/3` accepted; `/1`, `/2` as before; the wrong schema | D1, 4.3, 5.1, M33, A1 | LK-1a, LK-1b, LK-1c, LK-1e (`picker-look.test.js`); PK-2a through `EXPECTED` (A1), PK-8e (`picker-config.test.js`); LG-1c, LG-1c2 (A5, A6). Commands at the release (run-relative): `git diff --name-only base/<RUN-ID> -- tools/test/fixtures/picker/` → **runs now**: empty; **needs the work**: exactly one line `…/e-field-schema.json`; `git diff --stat base/<RUN-ID> -- tools/src/picker/demo-tenants tools/src/picker/demo-answers tools/test/fixtures/picker-legacy` → **runs now**: empty, and must stay empty |
| 2. The `look` section: form and bounds | 5.3, D9–D11, 6.1, 6.2, M01–M16 | LK-2a…LK-2g, LK-1e (`picker-look.test.js`) |
| 3. Colours: the pinned cases (`#c67d42` accepted as `light.accent`; `#e0731f` in `light.accent` is E_LIMIT, not E_FIELD, at `look.colors.light.accent` with «3,0» in the text; `#e0731f` accepted as `dark.accent`), the forms, the boundary pairs, the grid | 5.4, D12, M17–M19, M18 | LK-3a…LK-3f (`picker-look.test.js`); the samples `e-contrast-light`, `e-contrast-dark`, `e-color-*` (10.2), run by LK-1e. The tests need the work |
| 4. Objects of the closed catalogue, the staff-name characters, the shape of the sample | 5.5, D9, D10, M14, M20–M23 | LK-4a…LK-4f, LK-1e, and LK-2f (staff names: the four accepted names of the criterion, `url(http://x)` refused at `look.team[i].name`) (`picker-look.test.js`); the samples `e-staff-name-url`, `e-object-on-number-options`. Command of the criterion: `grep -rnE 'https?://\|url[(]\|<script\|javascript:' tools/test/fixtures/picker-look/ok-minimal.json` → **needs the work** (the file does not exist): empty, code 1 |
| 5. Desks, quick numbers, leads | 5.6, 5.7, D7, D8, M24–M35 | LK-5a…LK-5e, LK-1e (`picker-look.test.js`) |
| 6. Fallback look; answers for `/1`, `/2` unchanged | 8, D4, D13, D14, 7.1 | LK-6a…LK-6e (`picker-look.test.js`); SV-9c (`picker-server.test.js`). Command of the criterion: `grep -nE '(^\|[^A-Za-z0-9_$])(lead_\|flow_\|receipt_\|progress_\|panel_\|quiz_\|scene_\|shell_\|start_\|act_)' tools/src/picker/public/tenant-look.js` → **needs the work** (13.3): empty, code 1 |
| 7. What the visitor gets from a `/3` file | 7, D5, D6 | SV-2a, SV-2b, SV-2g, SU-9 (B5–B8) and SV-9a, SV-9b, SV-9d (`picker-server.test.js`). Risk tests for the neighbours (no criterion of this requirement, Q5): SV-9e (`lookOfView`, REQ-065 and REQ-066) and SV-9f (`ownLookOfView`, REQ-077) |
| 8. Failures do not bring the system down; nothing extra | 4.2, 6.1, F12, section 13 | LP-1, LP-2, LP-3 (`picker-look-property.test.js`); LK-5e, LK-7a, LK-7b. Commands at the release, all **run now** and must stay as shown: `grep -rnE 'fetch[(]\|https?[.]request\|node:net\|node:dgram\|child_process\|Math[.]random' tools/src/picker/ --include='*.js' \| grep -v '/public/'` → empty (code 1; the same words are PK-7a); `git diff base/<RUN-ID> -- tools/package.json` → empty; `git diff --stat base/<RUN-ID> -- tools/src/picker/engine.js` → empty |
| 9. Guard tests not weakened | section 9, 12 | The tests of 9 (A)–(B) themselves; mutants MU45 (QS-1) and MU57 (QS-12, two variants). Commands: (a) the count command of the criterion (`a=$(git grep -h '^test(' base/<RUN-ID> -- 'tools/test/picker-*.test.js' \| wc -l); b=$(cat tools/test/picker-*.test.js \| grep -c '^test('); [ $b -ge $a ] \|\| echo меньше`) → **runs now**: empty (370 and 370); after the work: empty (`b` ≥ 370 + the new tests); (b) `ls tools/test/picker-*.js \| wc -l` → **runs now**: 25; **needs the work**: at least 28 — 28 = 25 + the three `picker-*.js` files of 3.1 (`picker-look.test.js`, `picker-look-property.test.js`, `picker-look-helpers.js`); the folder `fixtures/picker-look/` is a folder and is not counted; later requirements add more files, so the command says «not less than 28», not «28»; (c) `grep -n 'tests.length >= 25' tools/test/picker-page-static.test.js` → **runs now**: 0 lines (line 678 says `>= 5`); **needs the work**: exactly 1 line (B3); (d) `cd tools && npm run check` → **needs the work**: code 0, «skipped 0» and «todo 0»; `npm run traces` → **runs now** and after: code 0. The mutant of the requirement «a rule-off line in `picker-look.test.js` reddens QS-12» is MU57. The `board-public/` half of row (12) is met by REQ-078, not by this work (B3) |

### 11.2 Catalogue of the new tests

Oracles are independent: the helper `picker-look-helpers.js` has its own contrast function, its own sign-class test, its own expected look, its own expected questionnaire; nothing is imported from `src/picker/` except the functions under test (called as a black box) and the files read as text. Property tests use a pinned seed. Each failure test also checks that the state did not change (the sample file bytes, the folder listing; for the server: the other tenants' answers).

**`tools/test/picker-look.test.js`**

| Id | What it proves |
|---|---|
| LK-1a | `ok-minimal` through the command: code 0, stderr empty, exactly «Файл арендатора ok-minimal в порядке: вопросов 4, решений 2, правил 3.»; once through `npm run -s picker --` with the same result; the file bytes do not change; no file is created |
| LK-1b | The two demo files (`/2`) and the two files of `picker-legacy` (`/1`): code 0 and the numbers 12/5/39 and 11/5/37 (literals); the folder `picker-legacy` still holds exactly two files |
| LK-1c | The values `sai-picker-tenant/4`, `sai-picker-tenant/`, `sai-picker-tenant/30`, `SAI-PICKER-TENANT/3`, `sai-picker-tenant/3 ` on a `/3`-shaped body: code 1, the first line is M33 at `schema` (the rest is the reading as `/1`, as for `/2`) |
| LK-1d | The sample folder has exactly the 89 names of 10.2–10.3; `fixtures/picker/` still holds 44 files |
| LK-1e | **Every sample of the table, against the literal lines of the helper.** The 89 files of the folder (the 87 rows of 10.2 — `ok-minimal` and 86 more, among them the two `/2` samples — and `ok-office-a` and `ok-office-b`) go one by one through the real command `check`: exit code, stderr empty, and the output lines equal the literal lines of the helper table — place, code and the **whole text** (the message of 6.4 with the values of that sample filled in), compared as text, in the order of the file; an accepted sample gives its one line «Файл арендатора <id> в порядке: …» with its numbers. The helper table has exactly the 89 names (a name without a file, or a file without a name, is a failure). About 7 s (F12: 500 runs took 36.8 s). The groups are also read by LK-2a…LK-5d in memory; this test is the only one that reads all rows, so a wrong word of a message is caught wherever the sample is |
| LK-2a | The samples of "Look: presence and form" and the two `/2` samples: exact lines (look missing, a string, extra field in the section and in a staff member, `look` in a `/2` file, the `/3` fields in a `/2` file) |
| LK-2b | `mark`: the samples with the exact lines; and in memory: `«С»`, `«Ң»`, `«7»`, `«A»`, `«ß»`, `«𐐀»` (U+10400) are accepted; lowercase letters, the digit `٣` (Arabic-Indic three) are accepted; `«²»`, `«Ⅷ»`, `«_»`, a tab, a combining mark alone, a zero-width sign, `«A»` followed by U+0301 (two code points) are rejected with the codes of 5.3 |
| LK-2c | Length bounds: tagline 40/41, industry 60/61, headline 120/121 on each of ru, kk, en (place ends with the language); `kk` missing; a string instead of three languages; a two-language object; a 4-language object |
| LK-2d | The 18-word rule at `look.headline.kk`, `look.industry.en`, `look.team[1].role.ru`: 19 one-letter words give E_TEXT with a place that ends in the language, 18 give none; «ты получишь» at `look.team[0].says.ru` gives E_TEXT, the same words at `kk` and `en` give none; the staff name has no «ты» rule |
| LK-2e | `U+0007` and `U+200B` at `look.headline.en` and `look.team[0].name`: E_TEXT with the sign code (M12); the same signs in `tagline`, `industry`, `role`, `says` of each language; **a lone half of a pair** (U+D800 and U+DC00, written as escapes) in `look.team[2].name`, `look.headline.ru` and `look.team[1].says.kk`: E_TEXT with M37 («Непарная половина знака U+D800. Удалите её из текста.», 8 words, F20) and not M12 |
| LK-2f | Team: 3 and 5 staff (E_LIMIT at `look.team`); **five staff of which the fifth has the figure `f13`: exactly two lines — E_LIMIT at `look.team` (M13) and E_REF at `look.team[4].figure` (M15): the items are checked also when the size is wrong**; a staff member without each of its five fields; extra field; name 30/31/0 signs; names accepted: «Айгерим», «Жан-Пьер О'Нил», «Т. Ли 2», «О’Нил» (U+2019) — the four of criterion 4 — and «Мария-Анна», «Ә. Нұрлан», «Robot 2», and (class alone, `decisions/0085` item 8) «.», «-», «'»; names rejected: «url(http://x)» (E_FIELD at `look.team[i].name`, M14, in the sample `e-staff-name-url` and in memory), «a/b», «a\nb», «a\tb», «<b>», «a_b»; role and says 40/41; a name of 30 and 0 signs and a name of spaces only (0 after trimming) give E_LIMIT, not E_FIELD |
| LK-2g | All 12 figures and all 3 shirts are accepted in every staff position (enumeration); `f00`, `f13`, `F01`, `f1`, `""`, a number, `null`, an object give E_REF with M15 (resp. M16) |
| LK-3a | Colour forms: «#e0731f» passes the form; «#E0731F», «#fff», «e0731f», «#e0731g», «#e0731f1», «rgb(1,2,3)», «url(x)», «», a number, `null` → E_FIELD at the place of the position; missing `dark`, missing `accent2`, an extra key in `colors` and in a theme → E_FIELD |
| LK-3b | The contrast boundary, by the independent function of the helper, for each of the four positions: the pair found by enumeration with the ratio just above 3.0 passes, just below fails with E_LIMIT at that place and the text holds «3,0»; the literals of F10 are used as a cross-check of the enumeration (`#c67d42` / `#1999c6` on the light sheet, `#76691d` / `#c22c5c` on the dark sheet); the cases the criterion pins are asserted in LK-3f |
| LK-3c | A light accent that passes the light sheet but fails the dark one is accepted in `light`, and the other way round |
| LK-3d | The grid of 4913 colours (channels `00, 10, …, f0, ff`) on each of the four positions through `validateTenant` in memory: the verdict of each equals "ratio ≥ 3.0 by the independent function" (19 652 verdicts); the enumeration finds both outcomes; the closest grid ratio to 3.0 differs from it by more than 1e-4 (so a double cannot flip it) |
| LK-3e | The two sheet constants read from the module equal the literals `#f3f5f9` and `#161f2e`; `MIN_CONTRAST` is 3; the neutral colours equal the literals of D12 and each passes the rule on its own sheet |
| LK-3f | The cases that criterion 3 names, asserted one by one through `validateTenant` in memory on `ok-minimal` with one colour changed (code, place, theme written in the test as literals): (1) `#c67d42` (3.0000006 : 1) as `look.colors.light.accent` — no error; (2) `#e0731f` as `look.colors.light.accent` — exactly one line, code **E_LIMIT** (not E_FIELD: the form is right), place `look.colors.light.accent`, M18, the text holds «3,0»; (3) `#e0731f` as `look.colors.dark.accent` — no error (5.23 : 1); this is the value that `ok-minimal` already holds there, so the case is also covered by LK-1a; it is written here so that a later change of the sample cannot hide it, and the position is first set to the other passing colour `#8fb4d8` and then to `#e0731f`; (4) the same for the second accent: `#e0731f` as `look.colors.light.accent2` — E_LIMIT at `look.colors.light.accent2`; `#c67d42` as `light.accent2` — no error; for the dark theme `#c22c5c` (2.9999994 : 1) as `dark.accent` — E_LIMIT, M19 with «3,0» at `look.colors.dark.accent`, and `#76691d` (3.0000003 : 1) — no error; (5) `#1999c6` (2.9999996 : 1) as `look.colors.light.accent` — exactly one line, E_LIMIT, M18. Which case kills which threshold: `#c67d42` accepted (1) kills `>= 3.1`; `#c22c5c` refused (4) and `#1999c6` refused (5) kill `>= 2.9` (`#e0731f`, 2.8969 : 1 on the light sheet, is refused by both thresholds and kills neither) |
| LK-4a | Each of the 15 ids is accepted as the `object` of an option of a `single` and of a `multiple` question |
| LK-4b | The matrix 15 ids × `level` (0–5, 2.5, `"1"`), `tag` (`""`, `A`, `1С`, `ABCD`, `A B`), `glyph` (the four, `star`), written as a literal table in the test: an allowed parameter with a right value passes; out of range E_LIMIT; wrong form E_FIELD; a parameter not allowed for the id E_FIELD at the parameter |
| LK-4c | Unknown ids `Shelf`, `pc`, `""`, `../x`, `http://x`, `url(x)`, `<b>`, a number, `null`, an object, a list: E_REF at `….object.id`, the text of M20 holds all 15 ids |
| LK-4d | `object` as a string, a list, a number, with an extra field, empty (`{}`), without `id`: E_FIELD; `object` on options of `single` and `multiple` accepted; options on a `number` question: LK-4f |
| LK-4e | `grep`-equivalent over `ok-minimal.json` finds none of `https?://`, `url(`, `<script`, `javascript:`; the string «url(http://x)» in `mark`, a staff name, an object id and a colour is an error in each; the same string in `tagline`, `industry`, `headline`, `role`, `says` of all languages is accepted (and is shown by the page as text only — REQ-071) |
| LK-4f | Options on a number question are `E_FIELD` «Лишнее поле options» at `questions[<the number question>].options` on **each of the three formats** (criterion 4; F16): `/3` — the sample `e-object-on-number-options`; `/2` — the `/2` body of 10.2 with `options` (one option with an id and a three-language label) added to its number question; `/1` — the released `tools/test/fixtures/picker/ok-minimal.json` (a `/1` file; its number question is `questions[2]`) with `options` added; the two latter are written by the test into a temporary folder outside the project; code 1, one line each, the files unchanged |
| LK-5a | Desks: 0, 5, 2.5, `"1"`, `null` (place `questions[i].desk`); partial → E_FIELD at the first question without; orders `1,2,1,…` E_ORDER at the third; `1,1,2,4` accepted; `3,1,2` gives one line (D7); invalid values do not become `previous`; a `/3` file with no desk at all is accepted; **two questions without `desk`: `1,–,–,4` gives exactly one line, at the first of them (`questions[1].desk`), and `1,2,–,–` exactly one line at `questions[2].desk` (no line at the last one); the only `desk` of the file is a wrong value** (`"x"` or JSON `null` at `questions[1]`, no other question has the key): exactly two lines — E_FIELD at `questions[0].desk` (M24, the first without the key) and the integer rule's E_FIELD «Ожидается целое число.» at `questions[1].desk` (a wrong value is a present key, D7) |
| LK-5b | Chips: on `single` E_FIELD; five items E_LIMIT; item 0 and 1001 E_LIMIT, 2.5 E_FIELD, repeat E_DUP, descending E_ORDER, a repeat-and-descending item E_DUP (precedence); `[]`, one, four items, `[1,2,999,1000]` accepted; **the range is checked only when both ends of the question are valid integers** (D8, F22): `min` 1, `max` 1000 and `[-5, 1001]` give two E_LIMIT lines (`chips[0]`, `chips[1]`, «от 1 до 1000»); `min` **absent**, `max` 1000, `[-5, 1001]`: exactly one line, the question's own at `questions[2].min` (E_FIELD, «Нет поля min…»), and **no chips line**; the same with `min` = the string «x» (own line «Ожидается целое число…»); `min` 1 and `max` absent: exactly one line, the own one at `questions[2].max`; `min` «x», `max` «y» and `[-5, 99999, 2.5]`: the two own lines and one E_FIELD at `chips[2]`; **in each of these cases `lineProblems` finds nothing in the lines** (no line holds the word `null`; the helper is applied to the lines of every case of this row, not only to LK-7a's samples); **more than four items are still checked**: `[10, 20, 30, 40, 1001]` (`min` 1, `max` 1000) gives exactly two lines — E_LIMIT at `chips` (M26) and E_LIMIT at `chips[4]` — and `[10, 20, 30, 40, 40]` gives E_LIMIT at `chips` and E_DUP at `chips[4]` |
| LK-5c | `contact_fields` (`[telegram]`, the three accepted; `[]`, `[sms]`, `[phone, phone]` the old kind of error), `whatsapp` (10 and 15 digits accepted; 9, 16 digits E_LIMIT; `+7…`, `7701abc0000`, Arabic-Indic digits, a space inside, `""` rejected with the codes of 5.7), `max_per_hour` 0/1/1000/1001, `max_stored` 0/1/10000/10001 |
| LK-5d | The same fields in a `/2` file are E_FIELD: `whatsapp`, `max_per_hour`, `max_stored`, `telegram` as a value, `desk`, `chips`, `object` |
| LK-5e | **`checkDesks` on a `questions` that is not a list, and on entries that are not objects** (4.2, 5.6; hostile input to a new function, Q10). On `ok-minimal` with `questions` changed in memory, and the same through the command (code 1, stderr empty, no stack line): (a) `questions` is `5`, `"x"`, `null`, `{}`, `true`, or absent: exactly five lines — E_FIELD at `questions` («Ожидается список. Исправьте значение.», or «Нет поля questions. Добавьте его.» when absent) and the four E_REF lines of the old rules at `rules[0].when[0].question`, `rules[1].when[0].question`, `rules[2].when[0].question`, `hypotheses[0].when[0].question`; no line at a `desk`; no exception; (b) `[1, "a", null]`: E_FIELD «Ожидается объект» at `questions[0]`, `questions[1]`, `questions[2]` and the same four E_REF lines; (c) the second question replaced by the string `"x"`, desks 1, –, 3, 2: exactly two lines, E_FIELD at `questions[1]` and E_ORDER at `questions[3].desk` (the string is skipped and does not become `previous`); (d) the second replaced by `"x"`, the third without `desk`, desks 1, –, none, 4: exactly two lines, E_FIELD at `questions[1]` and E_FIELD at `questions[2].desk` (M24: the first **object** without `desk`); (e) no object has a `desk` and the second is `"x"`: exactly one line, at `questions[1]`. The file bytes and the folder do not change |
| LK-6a | The fallback mark for the names «Учёт-Про», «ab», «7 звёзд», ««»», «ßета», «ŉ-центр», «𐐨 лаб», «», «  », «Ⅷ Studio»: `У`, `A`, `7`, `#`, `ß`, `ŉ`, `𐐀`, `#`, `#`, `S`; plus a property over 2000 random names (pinned seed) built from letters, digits, signs and pairs: the mark is `#` or one code point that passes the independent sign test |
| LK-6b | `fallbackLook("Учёт-Про")`: the exact object of 8 (headline = the name; both colour themes equal the literals; four staff with `null` name, role and says; figures `f01…f04`; shirts by D13); the set of keys at each level equals the shape of 7.2 |
| LK-6c | The text of `public/tenant-look.js`: none of `import`, `require`, `node:`, `process` (not even inside a word); the search of criterion 6 for the prefixes of `texts.js` keys finds nothing (code 1) and the self-check holds (a line `role: "scene_desk_1"` is found, a line `role: null` is not); no string value of the result of `fallbackLook("Учёт-Про")` matches the search (a walk over the result); the module loads as a module with no help and has no side effect at load |
| LK-6d | `deskForQuestion`: N=1, 5, 12 literals of the criterion; N=2, 3, 4 (D14); for N from 1 to 40 the sequence is non-decreasing, starts at 1, ends at `floor((N−1)×4/N)+1`, never exceeds 4, and for N ≥ 4 uses all four desks; bad arguments (`-1`, `N`, `2.5`, `NaN`, `"1"`, `null`, total 0) give an integer 1…4 and no exception |
| LK-6e | Purity: two calls give equal but not identical objects; changing one result changes nothing in the next; the exported constants are frozen (an attempt to change them in strict mode throws or has no effect); `fallbackLook(non-string)` does not throw |
| LK-7a | Every output line of the 78 error samples passes `lineProblems` (shape, whole message ≤ 18 words, ends with a dot, no «ты…», no parser words); and each message of the catalogue 6.4 (M01–M37), rebuilt from the constants where it is built from them, equals the text there |
| LK-7b | The command only reads: for a sample of each kind, the file digest and the folder listing are equal before and after, and stderr is empty |

**`tools/test/picker-look-property.test.js`** (pinned seed)

| Id | What it proves |
|---|---|
| LP-1 | 500 variants of `ok-minimal.json`; in each one random field of the section `look` (or `desk`, `chips`, `object`, `whatsapp`, `max_per_hour`, `max_stored`) is replaced by a number, `null`, a list, an empty object, an object with three languages inside each language, a string of 100 000 signs, a nesting of 20 000 — or removed; **16 more variants are enumerated, not drawn** (they are among the 500: 484 drawn and 16 listed): `questions` itself and `questions[2]`, each replaced by each of eight values — `5`, `null`, `[]`, `{}`, `"x"`, a string of 1000 signs, `[1, "a", null, [], {}]`, `[{"desk": 1}, {"desk": "x"}, 7]` (a pinned seed alone would not promise that the draw reaches `questions`; G2). Each variant goes through the real command `check`: code 0 or 1 only, stderr empty, no line that starts with four spaces and «at», every line `<file>: <place>: <code>: <text>` with a code of the ten and `lineProblems` empty |
| LP-2 | A server started on a folder with one good `/3` file and 20 of the broken variants. Each variant is `ok-minimal` with one hostile change **and its `id` equal to its file name without `.json`** (otherwise every file fails with the id error, E_ID, and the test proves nothing about the look rules); the test first checks each variant through the command: code 1, at least one line at a place of the changed field, and **no E_ID line**. Then the server: it starts, the good tenant answers 200, each broken one answers 404 as an unknown tenant (the answer of REQ-056), the good answer is the same bytes as without the broken files |
| LP-3 | Source scans (comments count): the new core files hold none of the words of 13.1; `public/tenant-look.js` none of 13.2; `package.json` has the same `scripts` and no `dependencies` key; the scan of PK-7a's words over `src/picker` outside `public/` finds nothing |

**`tools/test/picker-server.test.js`** (new tests, next ids after SV-8b)

| Id | What it proves |
|---|---|
| SV-9a | Two `/3` samples (A, B) in a temporary folder: for ru, kk, en the questionnaire has `look`, `desk` on every question that has it, `chips` on the number question, `object` on the options that have it, `whatsapp` in `leads`; the set of keys at every level equals the list of 7.1/7.2 (compared level by level); the values equal the file in that language (colours and ids as in the file); `version` is one on all three languages; the text holds neither `max_per_hour` nor `max_stored` nor their values |
| SV-9b | Isolation (Q8): no string of the look of B (name, tagline, industry, headline, staff names, roles, replies, colours) is in any answer of A on any language, and the other way round; the values that are shared by design (object ids, `f01…f12`, `accent`, `ink`, key names) are not enumerated; **and the positive side, on the same two tenants A and B as SV-9a and on each language:** the answer of A holds A's own headline and A's own staff name at `look.team[0].name`, the answer of B holds B's own — so that a look cached in a module variable fails here also when the first look to fill the cache is that of a third tenant |
| SV-9c | The six answers for the two demo tenants have the sha256 of F4 (literals; obtained again on the tag) and hold none of the keys `look`, `desk`, `chips`, `object`, `whatsapp` |
| SV-9d | `publicQuestionnaire` and `publicLook` on views with extra fields at every level (the look, `colors`, a theme, a staff member, a question, a `chips` list, an option, an `object`, `leads`) give only the listed fields, in the order of 7.1; the input is frozen and is not changed; for a `/2`-shaped view the result has no `look` |
| SV-9e | `lookOfView` (for the tenant's own page and for the progress data and page, REQ-065 and REQ-066): a `/3` view gives its own look (equal to the file, per language); a `/2` view and a `/1` view give the fallback look with the tenant's name in that language — **never `null`** for any of the three kinds; every call returns a new object; the registry records of the three kinds have the same six keys |
| SV-9f | `ownLookOfView` (for REQ-077; `decisions/0085` items 7 and 8): a `/3` view gives its own look (equal to `publicLook(view.look)` and to the look inside the questionnaire of the same language); a `/2` view and a `/1` view give exactly `null` (not the fallback, not an empty look); every call returns a new object; the argument is not changed; the board's fallback is not built by the server (no function of `public-data.js` returns a fallback look for the board; the page uses `fallbackLook` of the shared module) |

All the old tests of 9 (A)–(B) are changed by the tables above and stay in their files.

## 12. Build sub-steps and the expected red tests (checked with the sketch)

The developer works in the order below; each sub-step is delivered with `cd tools && npm run lint` and `npm run format:check` green and with the **expected** red set named here (`EXPECTED_RED` in `result.issues` until the tests step; the old tests are repaired by TEST-DESIGNER at step 5, not by the developer; there A7, B1 and B2 of section 9 are made in one change). The final expected red set equals the seven tests of 9 (A) and no other (measured).

| Step | Work | Files | Red after the step (cumulative) |
|---|---|---|---|
| 69a | The shared contract: `public/tenant-look.js` and the re-exports in `limits.js` | `public/tenant-look.js`, `limits.js` | QS-1 |
| 69b | `shape.js` (pure move) and the two small changes of D15; `validate.js` imports `shape.js` | `shape.js`, `validate.js` | + PK-6e, PK-7c, PE-8d |
| 69c | The format plumbing: `FORMAT_V3`, `formatOf` and the rest of D1, `view.js`, the schema line M33 and the mode in `validate.js` | `limits.js`, `lang-check.js`, `view.js`, `validate.js` | + PK-2a, LG-1c, LG-1c2 (7 in all) |
| 69d1 | `v3-check.js` with `checkLook` and `checkOfficeObject`, and the wiring in `validate.js` of `look` (the root field) and `object` (the option field) — criteria 2, 3, 4. The file imports only what it uses (an unused import is a lint error) | `v3-check.js`, `validate.js` | none new (7 in all, measured on a sketch of this state, F21) |
| 69d2 | `checkChips`, `checkDesks`, `checkWhatsapp` added to `v3-check.js` and their wiring in `validate.js`: the question fields `desk` and `chips`, the `leads` fields `whatsapp`, `max_per_hour`, `max_stored`, the three values of `contact_fields` — criterion 5 | `v3-check.js`, `validate.js` | none new (7 in all: the whole sketch, F5) |
| 69e | `public-data.js`: `publicLook`, `lookOfView`, `ownLookOfView`, the new fields of questions, options, leads | `public-data.js` | none new (SV-2g, SU-9 stay green; the `/1`, `/2` answers keep the F4 hashes) |
| 69f | `tools/README.md` (section 15) | `tools/README.md` | none new (TT-10a stays green) |

After 69f: `cd tools && npm run check` runs; the seven red tests are exactly those of 9 (A). The sub-steps map to the groups that the requirement advises: (1) format, look, colours, objects = 69a–69d1 (criteria 1–4); (2) desks and leads = 69d2 (criterion 5), the fallback look = 69a (criterion 6), public data = 69e (criteria 7–8); (3) guard table and mutants = the tests step (9). The developer has no sample and no new test before the tests step, so each part is delivered with the checks it can run (`npm run lint`, `npm run format:check`, the old tests with the red set above) and a short hand check with the commands of 11.1.

## 13. Traps (what turns red if it is done another way)

### 13.1 Words that the guard tests look for in `src/picker/*.js` (new core files `shape.js`, `v3-check.js` and the changed ones; comments count)

- PK-6e: `writeFile appendFile mkdir rename unlink rmSync copyFile truncate chmod utimes createWriteStream O_WRONLY O_RDWR O_CREAT` at a word start (even «renamed» in a comment is red).
- PK-7a and SV-8a: `fetch(`, `http.request`, `https.request`, `http.get(`, `https.get(`, `node:net`, `node:dgram`, `child_process`, `Math.random`.
- PK-7c: the word `node:` must stand in no new core file (not even in a comment).
- PK-8c: the substrings `readdir`, `opendir`, `glob` (so not «global»).
- TT-7a: the escaped sign patterns of `text-rules.js` (9 (C)).
- LG-10d (after B4): `new Date`, `Date.now`, `Math.random`, `performance.now`, `process.env`.
- SU-tests on the id rule: the id pattern is written only in `limits.js`; `TENANT_ID =` only there.

### 13.2 Words that the page tests look for in **every** file of `public/` (the new `tenant-look.js` included; comments count unless "code only" is said)

- QS-3: `alert(`, `confirm(`, `prompt(`, `showModal`, `beforeunload`, `dialog`, `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `console.`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `matchMedia`, `XMLHttpRequest`, `eval(`, `new Function`, `import(`, `localStorage.clear`, `.key(`, `sessionStorage`, `indexedDB`, `document.cookie`, `postMessage`, `window.open`, `location.reload`, `location.assign`, `location.replace`, `pushState`, `history.go`, `history.back`, `navigator.`, `Accept-Language` (any case), `setAttribute("style"`, and (code only) `.style` other than `.style.width`.
- QS-5 (code only): `localStorage`, `fetch(`, `AbortSignal`, `history.`, `scrollTo`, `location`, and `document` (this file is in the list of pure files, so none).
- QS-6: `REQ-` followed by a digit, `handoff` (any case), `ORCH`, `decisions` (any case).
- QS-9: `engine` (any case — **even in a comment**), `computeResult`, `resolveAnswers`, `visibleQuestions`.
- QS-10: a line that starts with `let` or `var` (also `export let`); only `export const` and `function` at the top level.
- LG-10c and TR-4f: `http://`, `https://`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `child_process`, `Math.random`.
- QS-7: the file imports nothing; the load test of `main.js` forbids a line at column 0 that starts with a lower-case name and ends with `);` in every file but `main.js` (no top-level call statement).
- Criterion 6 search: 13.3.

### 13.3 The search of criterion 6 (also criterion 9 of REQ-077)

`grep -nE '(^|[^A-Za-z0-9_$])(lead_|flow_|receipt_|progress_|panel_|quiz_|scene_|shell_|start_|act_)' tools/src/picker/public/tenant-look.js` → empty, code 1. The words are lower case with the underscore; names such as `exact_x` are not matched (preceded by a letter); do not name a constant or a field with these prefixes.

### 13.4 Samples and helpers

- A sample file name must not contain a word that `show()` hides (`null`, `token`, `undefined`, `nan`, `unexpected`, a second-person word): the line would start with «(скрыто)» (F8). The desk sample with a JSON `null` is `e-desk-empty-value.json`.
- Prettier checks the folder: write each sample with `npm run format`; the lone half of a pair in `e-mark-half.json` and the signs in `e-text-sign.json` are written as JSON escapes, never as raw characters.
- The `/3` samples are read by `server` through `TENANT_ID`: the name stem is 3–32 signs of `a-z0-9-` with no dash at the ends.
- The role limit is 40 signs: the "19 words" sample uses one-letter words (37 signs).
- **The new test files are under the ban of QS-12 too** (after B3): `picker-look.test.js`, `picker-look-property.test.js` and `picker-look-helpers.js` may not hold, in any place — a string, a comment, a title of a test — the word «eslint» directly followed by «-disable», nor the word «prettier» directly followed by «-ignore» (the two patterns of QS-12; the test itself writes each as two parts joined by code). Where a test or a comment must speak of the ban, it says it in other words. The mutant MU57 puts those words into a scratch copy only; no committed file holds them (AP-077).
- **The new test files are under the ban of PK-8d too** (`picker-config.test.js`, which reads every `picker-*.js` file of `tools/test/` — the three new files among them): none of the three may hold, in any place (a string, a comment, a title), the call form of a skip (a dot, the word «skip», an opening bracket), the option form of a skip (an opening brace, an optional space, the word «skip»), nor the four lower-case letters of the word for an unwritten test in a row, even inside another word (the three patterns of PK-8d; as with QS-12, they are described here and not written out); and no line of them, of the files of `src/picker/` or of the picker samples may hold a path of this computer. No test or helper of this design needs those words; where one must be spoken of, it is said in other words (AP-077).

### 13.5 Other traps

- **T1.** SU-9 pins the six keys of the registry record: do not add `looks` or `look` to `entryOf`.
- **T2.** `view.js` recognises a three-language text by its form (an object with exactly the keys `ru`, `kk`, `en`). No new section may use an object of exactly those keys for anything else. Today none does (`look` has six keys, `colors` two, a theme two, a staff member five, an `object` up to four); SV-9a would show the mistake as a wrong value.
- **T3.** The test helpers `expectedQuestionnaire`, `expectedResult` and `picker-page-helpers.js:148` decide the form by `schema === /2`; a `/3` file passed to them would be read as `/1` (B5).
- **T4.** The order of the lines: `report.js` sorts by the place in the file; a missing field is put at its parent. A missing `desk` is therefore reported at its question (`questions[i].desk`).
- **T5.** `desk` and `chips` are not "optional per question" by themselves: the all-or-none rule is a cross rule and runs after the questions (so a bad value keeps its own, more specific line).
- **T6.** A word-limit trap: the E_REF message of the 15 object ids has 17 words; do not add words (D17).

## 14. Mutants (intentional breakages; each is applied by TEST-DESIGN-VALIDATOR and must fail the named test)

Mutant ids are `MU01`…`MU70`; message ids are `M01`…`M37` (6.4): the two series do not meet. None is applied to real tests yet: the tests do not exist at design time, so every mutant is bound to a test by reading the design and the sketch output (CODE-DESIGN-VALIDATOR applies at least ten of them, and TEST-DESIGN-VALIDATOR applies them to the written tests). **Model of pass 3:** on a scratch copy of the sketch code, 75 variants of the pure-rule and public-data mutants (MU01–MU44, MU48–MU55, MU58–MU64, MU66 and the variants of a row) were run against a model of the named tests written as this section 11.2 states them (independent contrast and sign oracles, the literal cases); the 73 killable ones are red in the test named in their row, the 2 equivalent ones stay green; MU65 was run in 11 message-text variants against the sample table (LK-1e: red in each). **Model of pass 4 (step 07):** MU66 in its new form (the 504 combinations of F22: the form of pass 3 is red in 66 of them, the new rule in none) and MU67–MU70 (four scratch copies of the sketch, each with one edit) were run against the new cases of LK-2f, LK-5a and LK-5b as the table states them: the lines of each mutant differ from the lines of the unmutated sketch in at least one new case, and the unmutated sketch matches all of them. Mutants bound by reading only: MU45, MU46, MU47, MU56 and MU57 (page-test guards and a command; MU57 and MU45–MU47 were run on a clone by the gate of pass 2).

| Id | Breakage | Caught by |
|---|---|---|
| MU01 | `formatOf` returns `"/1"` for `/3` | LK-1a, SV-9a |
| MU02 | `view.js` uses `isFormatV2` (a `/3` file gets one language) | SV-9a, SU-9 (`/3` entry) |
| MU03 | The schema line lists two formats | LK-1c, A1 (PK-2a), A5, A6 |
| MU04 | `look` accepted in a `/2` file | LK-2a |
| MU05 | `look` not required in `/3` | LK-2a |
| MU06 | `mark` accepts two code points | LK-2b |
| MU07 | `mark` counted in UTF-16 units (`𐐀` rejected) | LK-2b |
| MU08 | `mark` accepts a space or an emoji (class not checked) | LK-2b |
| MU09 | `mark` class uses `N` (Roman numerals, superscripts accepted) | LK-2b |
| MU10 | A lone half of a pair counted as a letter | LK-2b |
| MU11 | `tagline` required | LK-2a (`ok-no-tagline`) |
| MU12 | `tagline` bound 41, `industry` 61, `headline` 121 | LK-2c |
| MU13 | The «ты» rule applied to `kk` or `en` of the look | LK-2d |
| MU14 | The 18-word rule not applied to the look texts | LK-2d |
| MU15 | The sign rule not applied to the staff name | LK-2e |
| MU16 | `team` size 3–5 | LK-2f |
| MU17 | The staff-name characters not checked (`decisions/0085` item 2) | LK-2f, LK-4e |
| MU18 | `figure` list lacks `f12` or has `f00` | LK-2g |
| MU19 | `shirt` list lacks `ink` | LK-2g |
| MU20 | A non-string `figure` crashes or gives E_FIELD instead of E_REF | LK-2g, LP-1 |
| MU21 | Upper-case hex accepted | LK-3a |
| MU22 | Three-digit hex accepted | LK-3a |
| MU23 | Threshold `>= 3.1` or `>= 2.9` | LK-3f cases (1) and (4)/(5) and LK-3b: `#c67d42` (3.0000006 : 1) accepted kills `>= 3.1`; `#c22c5c` (2.9999994 : 1, dark) and `#1999c6` (2.9999996 : 1, light) refused kill `>= 2.9`; also LK-3d and the samples `e-contrast-light`, `e-contrast-dark` (LK-1e) |
| MU24 | Contrast rounded to two decimals before the comparison | LK-3b (`#1999c6` = 2.9999996 would pass) |
| MU25 | Light accent checked against the dark sheet (swapped) | LK-3b, LK-3c |
| MU26 | A light accent must pass both sheets | LK-3c |
| MU27 | `accent2` not checked | LK-3d |
| MU28 | Wrong luminance weights (red and blue swapped) | LK-3d |
| MU29 | `shelf` level up to 4, `boxes` up to 3 | LK-4b |
| MU30 | `tag` allowed on `poster` or `glyph` on `monitor` | LK-4b |
| MU31 | Unknown id gives E_FIELD instead of E_REF | LK-4c |
| MU32 | `tag` of 4 signs accepted, or a space accepted | LK-4b |
| MU33 | `glyph` free (any string) | LK-4b |
| MU34 | `options` accepted on a number question | LK-4f (the case is on each of the three formats; LK-4d does not hold it) |
| MU35 | `desk` 0 or 5 accepted; "all or none" not checked | LK-5a |
| MU36 | Equal desks rejected (`<=`) | LK-5a (`ok-desk-flat`) |
| MU37 | `chips` accepted on `single`; 5 chips accepted; range not enforced | LK-5b |
| MU38 | A repeated chip reported as E_ORDER | LK-5b |
| MU39 | `telegram` rejected in `/3` or accepted in `/2` | LK-5c, LK-5d |
| MU40 | `whatsapp` accepts `+` or 9 or 16 digits | LK-5c |
| MU41 | `markOf` takes the first sign without skipping non-letters (`«`) or lower-cases | LK-6a |
| MU42 | `markOf` upper-cases `ß` to `SS` | LK-6a |
| MU43 | `deskForQuestion` uses `round` | LK-6d |
| MU44 | The fallback role is a `texts.js` key | LK-6c |
| MU45 | A stray `.js` file in `public/` | QS-1 (A7) |
| MU46 | `document` or `fetch(` or `engine` in `tenant-look.js` | QS-5, QS-9 (and LG-10c) |
| MU47 | `tenant-look.js` imports `texts.js` | QS-7 (graph), LK-6c |
| MU48 | `process` in a comment of `tenant-look.js` | LK-6c |
| MU49 | `max_per_hour` or `max_stored` copied to the public leads | SV-9a, SV-2b |
| MU50 | `look` added to the answers of `/1` and `/2` | SV-9c |
| MU51 | `publicLook` copies the whole object (spread) | SV-9d |
| MU52 | The tenant look is cached in a module variable (B can see A) | SV-9a, SV-9b |
| MU53 | `fallbackLook` returns one shared object | LK-6e |
| MU54 | `ctx.line` returns `false` after a success (or always `false`): the guard of D10/D15 then stops the class step, which never runs, and `url(http://x)` as a staff name is accepted. (The opposite breakage, "the class step also runs after an error", is **equivalent**: see below) | LK-2f (names rejected by the class), LK-4e, LK-1e (`e-staff-name-url`) |
| MU55 | `checkDesks` throws on a `questions` that is not a list | LK-5e (a)–(e), LP-1 (the 16 enumerated variants of `questions` and `questions[2]`) |
| MU56 | `engine.js` touched | The command of criterion 8, `git diff --stat base/<RUN-ID> -- tools/src/picker/engine.js` (11.1 row 8): a **command**, run by the validators; no test file reads the bytes of `engine.js` (searched in `tools/test/`), so a change that keeps its behaviour is seen by the command only, and a change of behaviour also by the PE tests |
| MU57 | A rule-off line appended to `picker-look.test.js` (a test file); and, as a second variant, to `picker-look-helpers.js` (a helper that is not a test file) | QS-12 (B3) must be red in **each** variant |
| MU58 | A contrast failure reported as E_FIELD instead of E_LIMIT | LK-3f (2), LK-3b |
| MU59 | The text of M18 or M19 lacks the boundary figure «3,0» | LK-3f (2) for M18 and the dark case of (4) for M19 |
| MU60 | U+2019 dropped from the staff-name class (only U+0027 is accepted) | LK-2f («О’Нил») |
| MU61 | `options` of a number question accepted in a `/1` file only, or in a `/2` file only (the check decided by format) | LK-4f |
| MU62 | `ownLookOfView` returns the fallback look for a `/1` or `/2` view (the mistake of finding F4) | SV-9f |
| MU63 | `lookOfView` returns `null` for a `/1` or `/2` view | SV-9e |
| MU64 | A staff name must hold a letter or a digit (the name `.` refused; this contradicts `decisions/0085` item 8) | LK-2f (class alone: «.», «-», «'» accepted), LK-1e |
| MU65 | The text of one message of 6.4 changed by a word (any of M05, M06, M13, M14, M22, M24, M25, M27, M31, M32, M37) | LK-1e (the sample row that holds the line; modelled for these eleven: red), LK-7a |
| MU66 | `chips`: the range is applied from one valid end alone (the form of pass 3: the lower or the upper end bounds alone; the text then holds the word `null`), or the range is not applied when both ends are valid | LK-5b (the cases with a missing or non-integer end: a chips line appears and `lineProblems` marks it; the case with both ends: the lines are missing) |
| MU67 | The items of `team` are not checked when the size is not 4 | LK-2f (five staff, the fifth with a wrong figure) |
| MU68 | The items of `chips` are not checked when there are more than four | LK-5b (the two cases of five items) |
| MU69 | The line for a missing `desk` stands at the last question without it (or at every one) | LK-5a (the two cases with two questions without `desk`) |
| MU70 | "Has its own desk" counts only a valid integer (a wrong value or `null` does not count) | LK-5a (the only `desk` of the file is a wrong value) |

MU23 and MU24 target the arithmetic that cannot be told from a correct one by the 4913-grid alone (closest distance 5.5e-4); the literals of F10 (3.7e-7 away) are in the test for this reason. Three mutants are **equivalent and not counted** (no input tells them from the correct code, so no test can fail on them): (a) the threshold `> 3.0` instead of `>= 3.0` — over all 16 777 216 colours the closest ratio to 3.0 is 3.7e-7 (light sheet) and 3.4e-7 (dark sheet) away, so both comparisons give the same verdict for every colour; (b) `0.03928` instead of `0.04045` for the channel threshold — no 8-bit channel lies between the two constants (F9); (c) the character class of the staff name also runs after an earlier step failed (the guard of D15 dropped) — `ctx.add` keeps the first line per place, so the extra line is dropped; the lines are the same on every case (F23). They are listed so that nobody writes a test that cannot pass, and TEST-DESIGN-VALIDATOR does not count them as survivors.

## 15. `tools/README.md` and what becomes outdated outside the project

### 15.1 README (BACKEND-DEV, step 69f; the words may be refined, the facts may not)

In the section «The solution picker site: the check of a tenant file»: «A tenant file is of two kinds» → «of three kinds»; a third bullet for `sai-picker-tenant/3` (the format `/2` plus the section `look` and the optional fields; the closed catalogues); «The command `check` checks both kinds» → «all three kinds»; one paragraph that lists the `look` fields, the 15 object ids, the 12 figure ids, the 3 shirt colours, the colour form, the contrast rule «not less than 3.0 : 1 with the sheet of the theme» with the two sheet colours, and says that a staff name is letters, combining marks, digits, space, hyphen, apostrophe and dot (`decisions/0085` item 2); one sentence that `/1` and `/2` files are shown with a neutral look made by the platform. **TT-10a trap:** the first paragraph of that section that holds both `E_TEXT` and `U+200B` is the one TT-10a reads; the new paragraphs must not hold both words. The sentence «The template of a file, applications and the instruction for the tenant are in the next requirements» stays true. The sentence about the made-up tenants (`demo-tenants`, both `/2`) stays true. A short paragraph under the page section says that `public/tenant-look.js` is a shared pure module and which functions it exports (no more).

### 15.2 Outdated outside the project (DOC-UPDATER; not touched by this design)

1. The micro-amendment of `REQ-069` and `REQ-070` (run `MA069-20261026-01`) and `decisions/0085` are done; their text is the base of this design. Item 6 of `decisions/0085` (two entries for the mistakes log: a criterion that demands an error for input the description accepts; a sample file named with a word that `show()` hides) is recorded by DOC-UPDATER at the end of the run.
2. Criterion 1 of `REQ-061` and criterion 2 of `REQ-054` read «schema — not /1, not /2 and not /3» (already stated by the requirement itself, decision 0069 item 1 and 0084 item 1).
3. `docs/requirements.yaml` REQ-060 (the tenant guide) describes `/2`; it must get the `look` section after this requirement (the requirement says so).
4. `STATE.md` and `PLAN.md`: the status of REQ-069 only after RELEASE-VALIDATOR PASS (Q14).
5. `decisions/0085` exists and is accepted; no further record is proposed by this design (16.2).
6. `docs/anti-patterns.md`: two proposals for Q13 (16.3).
7. The requirements REQ-065, 066, 071, 073, 074, 076, 077, 078, 087 read the interfaces of sections 7 and 8 (names above); none of them is edited by this design.

## 16. Answers of ORCH, record, open questions

### 16.1 The questions of the first version: answered by `decisions/0085` (accepted 2026-10-26; items 1–8)

| Question | Answer (item of `decisions/0085`) | Where it stands in this design |
|---|---|---|
| О1. The characters of a staff name | Item 2: a staff name is letters, combining marks, digits, space, hyphen, apostrophe and dot, 1–30 signs; `E_FIELD` otherwise; criterion 4 of `REQ-069` says so | D10, M14, 5.3, LK-2f, the sample `e-staff-name-url` |
| О2. `object` on options | Item 3: accepted on options of `single` and `multiple` questions; a number question has no options in any format | 5.1, 5.5, LK-4d, LK-4f |
| О3. The sheet constants | Item 4: contrast of an accent against the sheet of its theme not less than 3.0 : 1; sheets `#f3f5f9` (light) and `#161f2e` (dark); the accents of the approved sample `#e0731f` (light) and `#5b3fd6` (dark) fail and are replaced in `REQ-070` | 5.4, D12, LK-3e, LK-3f, 10.4 |
| О4. QS-12 now | Item 5: QS-12 is widened now to all `picker-*.js` test files, at least 25 | B3, 9 (D) row (12), 11.1 row 9, MU57 |
| О5. A staff name that holds no letter or digit | Item 8: accepted (a name such as one dot); the criterion defines the name by a character class only; requiring a letter would be a later micro-amendment, not now | D10, LK-2f (class alone), MU64 |

Item 1 accepts D1–D17 as written. Item 7 answers the finding about the look for the board (0 item 6, 7.2, 7.3, SV-9f); item 8 gives the second public call its name, `ownLookOfView`, and answers О5.

### 16.2 Record

`decisions/0085-picker-look-format-conventions.md` exists (items 1–8) and is the basis of this design. This design proposes **no further record**. (The first version proposed the record; that proposal is closed.)

### 16.3 Proposals for `docs/anti-patterns.md` (Q13; numbers by DOC-UPDATER)

- A criterion demands an error for an input that the description accepts (the staff name «url(http://x)»; an option object on a question type that has no options): the author of the requirement must run each "must give an error" example against the rules of the description before writing it (a repeat of AP-123/AP-012 on criteria).
- A sample file whose name contains a word that `show()` hides prints «(скрыто)» instead of its name; name samples by the case, not by the JSON value (found in the sketch, F8).

### 16.4 Open questions for ORCH

None. О5 and the name `ownLookOfView` are answered by `decisions/0085` item 8 (16.1).

## 17. The quality bar (`docs/quality-bar.md`): every item

| Item | Applicable? How it is met |
|---|---|
| Q1 | Applicable. Tied to `REQ-069`; every criterion names its check (table 11.1) |
| Q2 | Applicable. The gate CODE-DESIGN-VALIDATOR repeats the sketch measurements (F1–F23) on a fresh clone of the tag; the later gates run the tests and mutants themselves. The commands of the criteria are run by RELEASE-VALIDATOR |
| Q3 | Applicable. Every statement about the current system and every number of this design that is marked F1–F23 or sits in a table of samples was measured on the sketch (the 87 sample rows of 10.2, the 500-variant run, the seven red tests, the contrast arithmetic, the commands of 11.1 marked «runs now»); what is derived by reading (the server tests SV-9, LP-2, the mutants MU01–MU66 other than the pass-3 model of section 14) says so, and the choices are accepted by `decisions/0085` (items 1–8). No «should work» |
| Q4 | Applicable. One command `cd tools && npm run check`; the new files are covered by `format:check`, `lint` (the browser block of `eslint.config.js` already covers `src/picker/public/**/*.js`), `traces` and the tests; no step is removed; `package.json` does not change |
| Q5 | Applicable. Every criterion has a row and a test (11.1); every test has a criterion or is named a risk test (LK-7a/7b, LP-2, LP-3, LK-1d, SV-9e, SV-9f); failure tests also check that the state did not change (file digests, folder listings, other tenants' answers) |
| Q6 | Applicable. No skip, no turned-off rule. The guard tests are re-pointed at the same fact, never weakened (section 9): bans stay, numbers of tests and of `assert.` do not fall, QS-12 gets stronger. The test for the contrast arithmetic and the literal sheets cannot be satisfied by a stub |
| Q7 | Applicable. No secret anywhere; the numbers in samples (`77010000000`) and the addresses of the leads are invented; nothing is read from the environment; the page and the server get no key |
| Q8 | Applicable. The look of a tenant reaches only the answers of that tenant: `lookOfView`, `ownLookOfView` and `publicLook` read the view of the tenant; no module variable holds a look; `fallbackLook` returns new objects; the shared constants are frozen. Test SV-9b (A does not see B's look, per language) and LK-6e |
| Q9 | Not applicable: no SQL and no database in this requirement |
| Q10 | Applicable. A bad `/3` file gives lines, not a crash (LP-1: 500 hostile variants through the command; code 0 or 1, stderr empty); the server does not serve a bad file and others go on (LP-2); the shared functions never throw on wrong arguments (LK-6d/6e). No external call exists |
| Q11 | Applicable. The server calls no address. The look cannot carry an image, address, style or code: every field is a number, a letter-digit string, a name from a closed list, a colour of fixed form or text shown as text (LK-4e proves the strings `url(…)` and `http://…` are errors where the field is not free text). `whatsapp` is digits only (the button address is built by REQ-076) |
| Q12 | Applicable. The choices D1–D17 and the answers to О1–О5 are `decisions/0085` (items 1–8, accepted); no open question remains (16.4); code does not silently differ from `0066`, `0069`, `0070`, `0071`, `0076`, `0083`, `0084`, `0085` (the design follows them: ten codes, `/1` and `/2` unchanged, `engine.js` unchanged, the fallback role `null` of 0084 item 17) |
| Q13 | Applicable. Two proposals in 16.3 |
| Q14 | Applicable. The status of REQ-069, `STATE.md`, `PLAN.md` and the handoff are updated by DOC-UPDATER after RELEASE-VALIDATOR PASS (15.2) |
| R1 | Applicable and unchanged: nothing is merged by the pipeline without the owner's confirmation; this design only describes code |
| R2 | Not applicable: nothing here writes or reads Pixel Office events. The "office" of the picker page is a picture of a tenant's stages, not a journal of agents' work; the look carries no event, log or task text (decisions 0073, 0074, 0083 item 7) |
| R3 | Not applicable: the product with photos of buyers was dropped (decision 0033); the look holds no photo |

## 18. The sketch (`result.prototype`)

`<scratch>/sketch/base` — a fresh clone of the tag (baseline runs: the picker tests, the six hashes, the demo checks). `<scratch>/sketch/fresh` — a second fresh clone with about 400 lines of the design applied: `public/tenant-look.js`, `shape.js`, `v3-check.js`, the changes of `limits.js`, `lang-check.js`, `view.js`, `validate.js`, `public-data.js` (outside the project; it is not saved into it and is not part of the work). In it: the 370 old tests run (363 green, 7 red = 9 (A)); `traces-*.test.js` 56/56; a `/3` file served by the real server (`/3` questionnaire of 7.1, the `/2` hashes of F4 unchanged); the 87 sample rows of 10.2 (78 error samples and 9 accepted ones, `ok-minimal` among them) run through the real command (lines in 10.2; the sample named `e-desk-empty-value` was run under its first name `e-desk-null`, which is why F8 exists); 500 hostile variants through the command (F12); the arithmetic scripts of F9, F10, F11 (`<scratch>/sk`). Scripts: `gen.mjs`, `cases.mjs`, `run.mjs`, `fuzz.mjs`, `demo*.mjs`, `mkmin.mjs`, `table.mjs` in the sketch folder.

Rework step 07 changed one rule of the sketch (`checkChips` takes the range only when both ends are valid integers) and ran the 504 combinations of F22 and the thirteen cases of the new rows of LK-2f, LK-5a, LK-5b on it, outside the project; the project tree is unchanged. Rework step 05 added four facts (F20–F23), all measured outside the project: one in-process call on the tree of the tag for the lone-half text, a copy of the sketch with the first part of sub-step 69d, the model of `chips` ends and of the guard of D15, and (reported in section 14) a model of the named tests and of 75 mutant variants on a scratch copy; the project tree is unchanged. Rework step 03 added no new sketch run to the project; its measurements are the facts F16–F19 of section 1 (outside the project, on copies of released files and on the tag tree). The sketch above is that of the first version; its numbers (7 red tests, 426 and 370 tests, the hashes) were repeated by the validator of gate pass 1 and found equal.
