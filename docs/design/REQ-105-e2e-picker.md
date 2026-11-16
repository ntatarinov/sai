# REQ-105 — code design: end-to-end tests of the solution picker site in a real headless Chrome, and the starter of server processes `stand.js` that REQ-106 and REQ-107 reuse

Run `E2E105-20261105-01`, WF-02 step 1; reworked in step 01c after the first FAIL of the gate (remarks N1–N11) and in step 01e after the second FAIL (remarks N12–N17, and the sweep of section 19.2); each edit below carries its remark number. Base: the tag `base/E2E105-20261105-01` (commit 4f41032, the release of REQ-104 and ISS-0103). The block REQ-105 is in the tag (`git show base/…:docs/requirements.yaml | grep -c "id: REQ-105"` gives 1); the working tree differs from the tag in the status line of the block (`pending` → `in_progress`), in `docs/program/public-v1/PROGRESS.md`, and in the record `decisions/0109-e2e-stand-conventions.md` with its line in `decisions/README.md` (written by ORCH after the first gate; checked with `git diff --stat base/E2E105-20261105-01 -- . ':!docs/design' ':!handoffs'`).

This file holds shapes, signatures, tables and texts. It holds no implementation code. Sketches lie outside the project (sections 18 and 20); the words "the prototype" mean them.

**As built (DOC-UPDATER, step 10, 2026-11-15).** The design text is not rewritten: the places that the built work and the records `decisions/0109` О13–О23 changed carry a note «As built» (sections 0, 4.1, 4.3, 4.4, 5, 7, 8, 10, 11.1, 13, 16), and section 21 holds the counts read from the files, the differences and what is not proven.

**As built, later (DOC-UPDATER of run `E2E106-20261115-01`, step 10, 2026-11-16).** REQ-106 changed the starter `stand.js` as `decisions/0109` О15 asked (`decisions/0112` О1): `stateEnv` replaces `stateDirs`, every stand gets a private home, rule P checks every absolute path, and `stop()` has the code `STAND_HOME_WRITTEN`. The places of this design that describe the starter as REQ-105 left it carry a note «As built 2026-11-16» (sections 4.1, 4.2, 4.3, 6, 11.1) that points to `docs/design/REQ-106-e2e-pixel-office.md`; the text here is not rewritten.

---

## 0. Summary

- **What is built.** (1) `tools/test/e2e/kit/stand.js`: the starter of server processes (`startStand`, `withStand`) that REQ-104 left to this run (`decisions/0108`, О1); (2) `tools/test/e2e/picker.e2e.js`: nine tests (`matrix`, `pass`, `themes`, `keyboard`, `storage`, `isolation`, `not found`, `no connection`, `v3`) for the criteria 1–9 of REQ-105; criterion 10 is proved by commands and by the existing scans; (3) the stand-in server `tools/test/fixtures/e2e-stand/fake-stand.js` and the kit test file `tools/test/e2e-stand.test.js` (no Chrome, part of `npm test`); (4) small edits of three released tests (section 12) and of `tools/README.md`.
- **No source file in `tools/src/` changes**, no npm package, no change of `package.json` or `package-lock.json`: `run.js` finds `picker.e2e.js` by its name, so `npm run e2e` and `npm run check` run it with no edit of the script.
- **Findings of the prototype that the requirement does not state** and that the design builds in (all measured, section 1): (a) the page marks its parts with `data-part`, not with classes; (b) the questionnaire has `name`, not `title`; (c) after the first pass the origin holds the saved answers, so the next pass on the same origin sees «Продолжить» instead of the start button; (d) a failed `fetch` writes a console error line of the browser (`net::ERR_CONNECTION_REFUSED`) that the requirement does not declare; (e) at 320×568 in Russian and in Kazakh the start button lies below the lower edge of the window (594 > 568; in English it is inside) while nothing overflows sideways (N10); (f) the card has «Начать заново» only when something is saved, so the keyboard path to it needs a reload; (g) a timer left armed by a `stop()` kept the spec process alive 10 s after its last test (16.6 s → 26.6 s for the whole file); (h) the requirement block has ten criteria, not nine as the handoff says; (i) the stored `version` is a 64-hex hash that can hold a run of seven decimal digits, so a digit-run rule is applied to the visitor's parts of the stored value only (N1, F31); (j) on macOS every Node child gets `__CF_USER_TEXT_ENCODING` from the system whatever environment is passed (N2, F32); (k) a stand-in whose child has to ignore `SIGTERM` must tell the test that it is ready, or the group `SIGTERM` kills the child before its handler exists and the mutant S02 is not caught (N13, F38); (l) a test that is first counted at a sub-step may read only files made at that sub-step or before (N3, N12, table 14.1).
- **Time.** The prototype of the nine tests runs in 16.6 s on the developer machine (three runs: 16733, 16603, 16622 ms), limit 80000. Under a load of eight copies at once it ran in 43–45 s. The GitHub runner was not measured for this file (section 7). *As built:* the built file ran in 16.3–16.9 s here in the series of step 09 (18.2 s under four busy loops), and the runner was measured at steps 06 and 09: 20035 and 22050 ms (section 7).
- **Replacement table.** Measured on copies of the tag with the files of this work added step by step (no dummy file; F21, F37): after sub-step 2 of 2187 tests exactly one is red, `E2K-50` (section 12), and it stays red until sub-step 3; after sub-step 4a all 2207 are green. The edit that adds `picker.e2e.js` to its `SCANNED` list is made together with that file, in sub-step 4a (N3). The README table row and the budget words keep `E2K-41` and `E2K-60` green.
- **Sizes.** 10 criteria, 9 spec tests, 20 starter tests (`E2S-01…20`), 2 build sub-steps for BACKEND-DEV and 5 for TEST-DESIGNER, 55 mutants (section 16: P 25, S 22, R 8; 53 with a catcher, 2 survivors on record), 12 open questions for ORCH (section 19; how the remarks of the gate were closed is in 19.1 and 19.2), 42 checked facts. Every count has its command in F42 (AP-143). *As built (counted from the files at step 10, the commands in section 21):* `picker.e2e.js` has 1923 lines, 9 top-level tests (13 `test(` in all, with the `.test(` calls of regular expressions) and 159 `assert.`; `e2e-stand.test.js` 20 tests (`E2S-01…20`); `e2e-kit.test.js` 52 tests; `npm test` 2207 tests; the open questions grew to О1–О23 in `decisions/0109`; the mutants applied over the run are far more than the 55 of the list (section 16, «As built»).

---

## 1. Checked facts

Measured on 2026-11-04T19:24Z–20:20Z, and for the rework (F31–F37) from 2026-11-04T20:44Z on (clock `date -u`; the local date of the owner is 2026-11-05, UTC+5), macOS arm64, Node v22.23.4, Google Chrome 156.0.8078.80. "Clone" means `git clone -b base/E2E105-20261105-01` into `<scratch>/e2e105/clone`, then `npm ci` in `tools/`. Sketches lie in `<scratch>/e2e105/sk/` (section 20).

| # | Statement | Command / sketch | Result |
|---|---|---|---|
| F1 | The tag holds the block REQ-105 with ten criteria; the handoff says nine | `git show base/…:docs/requirements.yaml` cut to the block; `grep -c "^      - >-"` over the lines of the block | 10 (matrix, pass, themes, keyboard, storage, isolation, not found, no connection, v3, time and independence) |
| F2 | `tools/test/e2e/` holds `kit/`, `run.js`, `smoke.e2e.js`; `listSpecs` picks every file `^[a-z0-9][a-z0-9-]*\.e2e\.js$`, so a new `picker.e2e.js` is run by `npm run e2e` with no change of the runner or the script | `ls tools/test/e2e`; read `kit/runner.js` | as stated; the prototype was run by `npm run -s e2e -- picker` |
| F3 | The picker server starts with `node src/picker/cli.js serve --tenants <dir> --port 0` from `tools/`; stdout has five lines: `Сайт подбора запущен. Откройте ссылки:`, one `http://127.0.0.1:<port>/t/<id>/` per tenant (alphabetical), two more lines; it writes nothing to disk and nothing to stderr; `SIGTERM` closes the port and the process ends with code 0 | sketches `s1`, `s4`, `s5`, `s8`: `{ code: 0, sig: null }` and `stderr ""` in every start | as stated; ready in 84 ms |
| F4 | The questionnaire answer has `version`, `lang`, `languages`, **`name`**, `intro`, `questions_min/max`, `questions[]`; it has no field `title`. The tenant file has `name` as an object per language (`{ru, kk, en}`), and for `uchet-pro` the Kazakh name equals the Russian one (`Учёт-Про`) | `curl …/api/questionnaire?lang=en`; `node -e` over `src/picker/demo-tenants/uchet-pro.json` | the oracle of the `<h1>` is `name` (O2) |
| F5 | The page marks its parts with `data-part="…"` and `data-screen="…"` and `data-action="…"`, not with classes. Selectors that work: `[data-part="option"]:has(input[value="<option id>"])`, `#q-title`, `#q-input` (number), `form [data-part="next"]`, `[data-part="intro"]`, `[data-part="progress-text"]`, `[data-kind="result"]` (the block of a lost net), `#live` | `outerHTML` of the question screen (sketch `s3`) | the first sketch used class selectors and failed with `ELEMENT_NOT_FOUND` |
| F6 | The card: 3 language buttons, then `[data-action="start"]`. With saved answers the card has `continue` and `restart` instead of `start`. The question screen has `back` (not on the first question), `skip` (only when the question is not required), and one button `data-part="next"` whose `data-action` is `next` or `show-result` | sketch `s7`, `s8` | as stated |
| F7 | 18 combinations (3 languages × 2 schemes × 3 windows) on one tab and one browser: `<h1>` equals the questionnaire `name`, `html lang` equals the language, `scrollWidth` equals `innerWidth`, one question after the press of start; 2307 ms for all 18 (about 125 ms each, 100 ms of it is the settle wait of the kit after the load event); the only console line is the favicon one, once | sketch `s1` | as stated |
| F8 | The start button at 320×568 in Russian **and in Kazakh** lies at 546…594 (bottom 594 > window height 568; in English at 495…543, inside; the gate measured the same for both tenants, N10); at 390 and 1470 it lies inside; its horizontal edges are inside the window in all 18 combinations (left ≥ 29, right ≤ 361 at 390) | sketch `s1`; the first prototype asserted «inside the window» both ways and failed at `matrix` | "inside the window" is read as horizontal containment and reachability by scroll (O3) |
| F9 | A pass of the 12-question questionnaire takes about 90 ms of page time; the answers sets `leader`, `close`, `none` give three different result bodies; the page's `POST …/api/result?lang=<l>` body (read through the kit: `network()`, `responseBody()`) is equal, character for character, to the answer of a direct `fetch` POST with the header `Origin: http://127.0.0.1:<port>` (Node's `fetch` lets the test set `Origin`); the request body is `{"answers": …}` with exactly the keys of the set (the hidden questions are not in it); the focus after the result is on an `H2` inside `[data-screen="result"]` | sketch `s2` | as stated |
| F10 | After one pass the origin's `localStorage` holds `sai-picker:uchet-pro`; a second pass on the same origin finds `continue` and `restart` and **no** start button (`ELEMENT_NOT_FOUND` for `[data-action="start"]`) | sketch `s2`, first run | every pass starts with `localStorage.clear()` and a reload |
| F11 | `/t/net-takogo/`, `/t/UCHET-PRO/`, `/t/uchet-pro/%00`, `/` give 404; the raw request `/t/%2e%2e/` (`node:http`, path kept) gives 404; Chrome turns `/t/%2e%2e/` into `/` (location `…/`). All five bodies are the same bytes: `{"error":"not_found","message":"Страница не найдена. / Бет табылмады. / Page not found."}` (118 bytes, sha256 prefix `1f0b844d8fc3` in all five). The page text (`document.body.innerText`) holds the JSON text, so the line is a substring of it. The kit's `network()` has the four `Document` records and `responseBody` returns their text | sketch `s4` | as stated |
| F12 | The console lines of those loads: one `Failed to load resource: the server responded with a status of 404 (Not Found)` (kind `browser-log`) per page load, with the `url` of the page, and the favicon one (`/favicon.ico`) once, after the first load | sketch `s4`: six entries for five Chrome loads | the four page lines are declared with their `path`, the favicon one with `expectOncePerStart` |
| F13 | A server that goes away: after `SIGTERM` and the end of the process, the press of `show-result` gives `[data-kind="result"]` with the text `Нет связи. Ваши ответы сохранены. Попробуйте ещё раз.` and a button `[data-action="retry"]` «Повторить», which holds the focus; a second press gives the same block; `localStorage` is byte for byte the same; **each failed `fetch` writes one console error of the browser:** kind `browser-log`, text `Failed to load resource: net::ERR_CONNECTION_REFUSED`, url `…/t/uchet-pro/api/result?lang=ru` (two entries for two presses); no exception | sketch `s5` | the lines are declared (O4) |
| F14 | Themes: light `body` background `rgb(243, 245, 249)`, text `rgb(23, 32, 51)`; dark `rgb(15, 21, 32)` and `rgb(232, 238, 247)`. `[data-part="intro"]` has a transparent background; its effective background is the panel (`rgb(255, 255, 255)` light, `rgb(22, 31, 46)` dark), found by walking up the parents. Ratios by the WCAG formula: body 14.90 / 15.68, intro 16.27 / 14.18 (light / dark) | sketch `s6` and the prototype | the contrast helper must use the effective background |
| F15 | Focus: computed `outlineWidth` is `3px` even when `outlineStyle` is `none` (checked on `body`: `3px` and `none`), so "non-zero outline width" alone is always true; the ring exists when `outlineStyle` is not `none` and the width is above 0, or when `boxShadow` is not `none`. A radio input in an option row: the input and its `[data-part="option"]` row both get `solid 3px`. Tab order: the card has 3 language buttons, then start (or continue, restart); the question screen has the radio group (one stop), then `next`; a number question has the field, then `back`, then `next`; after `next` a Tab leaves the page (`BODY`) and the next one reaches the language buttons | sketch `s6`, `s7` | the oracle for "visible ring" is style ≠ none and width > 0 (or a shadow), with `body` as the negative control |
| F16 | Keyboard path: Tab×4 → start, Enter → question 1 (focus on `H2#q-title`, `#live` reads `Вопрос 1 из 12`), Tab → radio, Space → checked and saved at once (`current: business`), Tab → next, Shift+Tab → radio, Tab, Enter → question 2 (`Вопрос 2 из 11`), Tab → number field, Tab → back, Enter → question 1 with the answer kept. The `#live` text on the card still reads `Загружаем анкету` (the loading line) | sketch `s7` | on question screens the test also compares `#live` with the visible progress line |
| F17 | The card with «Начать заново» exists only after a reload with something saved: Tab×5 → lang, lang, lang, continue, restart; Enter on restart → question 1 and `localStorage.length` 0. There is no keyboard route from a question back to the card without a reload | sketch `s7` | the keyboard test reloads with the kit (`reload`, a protocol call, not an input event) (O5) |
| F18 | Storage: after answers 1–3 and the press of next, the value is `{format:1, version:<64 hex>, lang:"ru", current:"tools", answers:{…3 keys…}}` (exactly five fields); after `reload` the card shows `continue`; `continue` opens question 4 (`Вопрос 4 из 12`); `back` ×3 shows the three answers selected; `sessionStorage.length` is 0 and `document.cookie` is the empty string | sketch `s7`, `s8` | as stated |
| F19 | Isolation: strings of `uchet-pro` (name, intro, titles, helps, units, option labels) that are not in `svet-marketing`: 49 in each language (45 the other way); `agency` not in `stock`: 23 (22). After a full pass of A the card of B shows none of them, no `continue`; `POST /t/B/api/result` with A's `leader` set answers 400 `{"error":"answers_invalid","message":"Ответы не подходят к этой анкете…","question":null}`. The solution names of a tenant are in its file: `solutions[].name.<lang>` | sketch `s8` | as stated |
| F20 | The server has no request log; its stderr gets only the lines of `warn` (a failing handler, a server error) | read `src/picker/server.js` | "request log" of criterion 6 is the stderr text of the stand |
| F21 | Full suite on copies of the tag with the files of this work added step by step (the first-pass figure, 2188 tests with dummy files, is retired). After sub-step 2 (`stand.js`, the two exports, `fake-stand.js`, the README; no test file of this work): `# tests 2187`, `# pass 2186`, `# fail 1`, `# skipped 0`, `# todo 0`, `# duration_ms 225509`; the one red is `E2K-50` (`test/e2e/kit/stand.js: reads TEMP`, a named variable that the guard did not know). After sub-step 4a (the six names, `80000`, the README tokens, `e2e-stand.test.js` with its 20 tests, `sleep-stand.e2e.js`, `picker.e2e.js`, the `SCANNED` entry): `# tests 2207`, `# pass 2207`, `# fail 0`, `# skipped 0`, `# todo 0`, `# duration_ms 238626`. With a `stand.js` that reads the whole environment, `E2K-50` is red with "the whole environment object" | the copies `c1s` (states S2, S4a, `sk/states.py`); `cd tools && npm test` | section 12, 14, F42 |
| F22 | The scans by name prefix (`handoffs-*.js`, `picker-*.js`, `team-web-*.test.js`) do not match `picker.e2e.js`, `e2e-stand.test.js`, `fake-stand.js`; `repo.test.js`, `listing.test.js` and the scans of `fixtures/picker` do not read `tools/test/e2e` | `grep -rn "readdirSync" tools/test`, each hit read | no other guard test is affected (section 12) |
| F23 | The independence loop of REQ-104 criterion 7 on the prototype: each of the nine names alone by `--test-name-pattern="^<name>$"` → exit 0, exactly one `ok ` line `ok 1 - <name>`, no `not ok` (the names with a space, `not found` and `no connection`, work) | the loop of criterion 7 in the clone | as stated |
| F24 | Order on two real files: `npm run -s e2e -- smoke picker` prints `e2e: file=smoke` then `e2e: file=picker`; `-- picker smoke` the reverse; both exit 0 (`duration_ms` 34335 / 34248); all names, last to first, are `smoke picker`, which differs from the alphabetical order — with one file the two orders were the same | clone, 2026-11-04T19:41Z | closes item 2 of ISS-0102 (section 13) |
| F25 | A starter in the sketch (spawn detached, link from stdout, `SIGTERM` to the group, exit code required, marker folder registered with the runner's registry) was driven through eleven modes of a stand-in: normal stop `{code:0}`; exit before the link → start error with code 3 and the last stderr line; no link → timeout and the process is gone; exit code 1 after `SIGTERM` → error; `SIGTERM` ignored → escalated by `SIGKILL`; noisy output (1 MB on each stream) → stop code 0, 65536 bytes kept per stream; a child in the group → gone; a state folder outside the temporary root → `PATH_REFUSED` with 0 spawns | sketch `s9`, `s11` | section 4.1 |
| F26 | A timer armed by `stop()` and not cleared kept the process alive for the time of the timer: the file ended 10 s after its last test (`# duration_ms 26204` against 16.2 s of tests). With the timer cleared: 16.6 s | prototype, first and second run | the stop timer is cleared (mutant S03) |
| F27 | The runner's registry covers a stand: a fixture spec starts a stand and sleeps (60 s); `runAll` with `fileTimeoutMs: 4000` ends it; with the event loop blocked (`Atomics.wait`) no handler of the spec runs, and still the stand process is gone and no `sai-e2e-*` folder is left. With the call that notes the stand for the runner removed, the stand stays alive and the marker folder `sai-e2e-profile-<random>` is left | sketch `s10` | section 4.1 (the marker) and mutant S08 |
| F28 | A reading from the GitHub runner for the same 13-test smoke file: `duration_ms=25539` (run 41678354227) and `duration_ms=34821` (the run on `main` after ISS-0103); on the developer machine `17462`. The ratio is 1.46…2.0 | `docs/releases/E2E104-20261103-01.md` (lines 46–50, 76–78) | the runner timing is a reading of another file, not of this one (section 7) |
| F29 | Mutants of the product applied to a copy of the clone, the prototype run on each: all twenty P01…P20 of section 16 were caught by the test named there; the first version of P20 (`markOf`) is not used by the page, changed nothing and survived, so P20 became `publicLook` | sketch `mut.py` | section 16 |
| F30 | Leftovers. **Corrected (N7):** the first version said that after every sketch `pgrep -f sai-e2e-` and the list of `sai-e2e-*` folders were empty. That command could not see a stand (its command line has no `sai-e2e-`), and the gate found two picker servers of the sketches still alive. Now the check is the one of section 16 (`LEFT`, by the program that was started); it was proven to see a stand (a picker server started by hand: count 1, after its `SIGTERM`: 0), and at the end of this rework it gives 0 and the list of `sai-e2e-*` folders is empty | `ps`, `ls` of the temporary root | section 16 |
| F31 | **N1.** The stored value of `sai-picker:uchet-pro` holds `version`, a 64-hex hash (`d4f0885b…55ee8`), and its text holds the run `3446901`: the rule «no run of 7 digits in the text of the value» is red on the correct page for `uchet-pro` in `ru`, `kk`, `en` (3 languages × the same hash) and green for `svet-marketing`. Applied to the other parts only — `JSON.stringify({ lang, current, answers })` — the rule is green for both tenants in all three languages (6 passes of answers 1–3, the `leader` set): no `@`, no run of 7 digits, five fields, `version` = 64 hex = the questionnaire `version` | sketch `s12` (real server, real Chrome, the kit) | criterion 5 row of section 8 |
| F32 | **N2.** A stand-in that logs `Object.keys(process.env)` started by `startStand` (given: `SAI_FAKE_STAND_LOG`, `SAI_FAKE_STAND_MODE`; the parent had `SAI_FAKE_LEAK`, `HOME`, `SAI_TEAM_REAL_RUNS`) got `LANG, PATH, SAI_FAKE_STAND_LOG, SAI_FAKE_STAND_MODE, TMPDIR, __CF_USER_TEXT_ENCODING`; the one name outside the base list and the given ones is `__CF_USER_TEXT_ENCODING`, added by macOS (the starter does not give it); none of the leak names is there | sketch `s13` (prototype starter, macOS arm64) | `E2S-05` has a named allowance |
| F33 | **N8.** `spawn` with a `cwd` that does not exist returns a child with `pid` `undefined`, emits `error` (`ENOENT`) after 2 ms and then `close`; no `exit` event | sketch `s14` | section 4.1 step 3 |
| F34 | **N5.** The page drops the answer of a question that became hidden in two places: `setAnswer` (flow.js: after each change) and `bodyAnswers` (for the request). Path: answer `business`, `items`, `places`, `tools`, `problems = slow-count`, `staff`, `recount = weekly`; back ×3 to `problems`; change it to `no-reports` (hides `recount`); next ×2, answer the rest. Unchanged page: the stored answers and the request body have no `recount`. Mutant (a) `setAnswer` keeps hidden answers: the stored value has `recount`, the body does not. Mutant (b) both places broken: the body has `recount: weekly`. Mutant (c) only `bodyAnswers` returns the raw answers: stored value and body have no `recount` — an equivalent mutant (defence in depth), no test can tell it | sketch `s17` on the copy of the clone | `pass` (sixth pass), mutants P21, P24 |
| F35 | **N9.** Over `uchet-pro` × `ru, kk, en` × `light, dark` × `1470, 390, 320`: `matchMedia('(prefers-color-scheme: dark)').matches` is `false` for every light and `true` for every dark combination; the `body` background is `rgb(243, 245, 249)` in all nine light and `rgb(15, 21, 32)` in all nine dark combinations. With the mutant «dark block only for windows of 400 px and wider» the dark rows at 390 and 320 show `rgb(243, 245, 249)` (6 of the 9 dark combinations) | sketch `s15` (clean page and mutant) | `matrix`, mutant P25 |
| F36 | **N4.** A `with-child` stand-in whose child ignores `SIGTERM`: with the starter as it is, after `stop()` the server and the child are both gone; with the mutant S02 (no `SIGKILL` to the group after the main process ended) `stop()` throws `CLEANUP_FAILED` (group still alive) and the child stays alive — red; with the default child (no handler) the group `SIGTERM` kills it and S02 stays green | sketch `s16` (it waited 300 ms before `stop()` and used an inline child; the text did not carry either — the run from the text alone is F38, and it superseded this one) | section 4.3, `E2S-13`, mutant S02 |
| F37 | **N3, N12, N14.** The kit files in four states with no dummy test file: S1 (`stand.js`, the two exports, `fake-stand.js`) and S2 (+ the README): `node --test test/e2e-kit.test.js` → 52 tests, 51 pass, 1 fail = `E2K-50` (a missing `test/e2e-stand.test.js` on the command line is ignored by Node 22: the same figures); S3 (+ the edits of rows 1 (the six names), 2, 3, `e2e-stand.test.js` with 20 tests, `sleep-stand.e2e.js`) → 72 / 72 / 0; S3 with the `SCANNED` entry and no `picker.e2e.js` → 72 tests, 71 pass, 1 fail = `E2K-50` with `ENOENT`; S4a (+ `picker.e2e.js` and the entry) → 72 / 72 / 0. In the first pass the stand-in lay in `fixtures/e2e/` and made the "unscanned fixtures" rule of `E2K-50` red; the final place is `fixtures/e2e-stand/` | sketch `c1s` (`sk/states.py`, `sk/edits2.py`) | sections 12 and 14 |
| F38 | **N13.** A starter written from 4.1, a stand-in from 4.3 and `e2e-stand.test.js` from 11.1, all from the text alone, in a fresh clone (`c1e`). The text before this rework (a child that writes no signal; the parent prints the link at once): S02 survived 6 of 6 for the gate, and 3 of 3 in this sketch with the readiness assertion taken out of the test. With the readiness (the parent prints the link after the child's line `ready`; the child has logged `child-ready`; `E2S-13` reads the log and has no sleep): the 20 tests green; S02 red in 8 of 8 runs (`CLEANUP_FAILED`, the child alive until the test's `finally`). The stand-in started by hand in `with-child`: the link is printed and the log holds `start`, `env`, `child-ready`, `child` in this order | sketch `c1e`, `mut_e.py`; the by-hand start | section 4.3, `E2S-13`, S02 |
| F39 | **N12, R01–R03.** (a) `E2S-19` as first worded (the four files and `picker.e2e.js`) run alone: at S3 red with `ENOENT … picker.e2e.js`, at S4a green. (b) The new form (four files): green at S3 and at S4a. (c) R02 at S4a: a skip word put into `picker.e2e.js` → red `E2K-50` only; a sandbox flag put there → red `E2K-25` only (so `E2K-25` does not scan skip words). (d) R01: the README row removed → `E2K-60` red. (e) R03: `stand.js` given the whole environment → red `E2K-50`, `E2S-05`, `E2S-19` | sketch `c1s` (`sk/states.py old3, old4a`; mutations by hand on the copy) | sections 11.1, 14.1, 16 |
| F40 | **The sweep of the catchers.** The 22 starter mutants run one by one against the stack built from the text (`mut_e.py`; the red tests read): every catcher of section 16 holds, with three corrections found by the run — S01 is **not** caught by `E2S-17` (the picker exits 0) but by `E2S-09`, `E2S-11` and `E2S-15`; S08 is caught by the blocked case of `E2S-18` only; S07 is red in `E2S-18` too. S19 and S22 survive (named, section 16). Two traps of 4.1 had no mutant: the start with no pid (S20: `E2S-04` red) and the start timer (S21: `E2S-14` red). The tests that leave a process under a mutant (S02, S07, S08, S09, S16) were cleaned by pid and checked by `LEFT` | sketch `c1e` | section 16 |
| F41 | **P22, P23.** A matrix oracle written from section 8 (the intro text of the card against `intro` of the same language; the start button's left ≥ 0 and right ≤ `innerWidth`; no overflow) on the real server and Chrome: clean page green in 18 combinations; P22 (`kk` asks for the Russian questionnaire) → 6 red, all `kk`; P23 (the start button 25 rem wide) → red in every combination at 390 and 320 (24 reports: containment and overflow) | sketch `s18` on `mutp/` | section 16 |
| F42 | **Counts (AP-143), with the commands.** Criteria: F1. Spec tests: `sed -n '/^\*\*The nine tests\*\*/,/^\*\*Declared console lines/p' docs/design/REQ-105-e2e-picker.md \| grep -c '^[0-9]\. \*\*'` → 9. Starter tests: `grep -c '^\| E2S-' docs/design/REQ-105-e2e-picker.md` → 20. Build sub-steps: `sed -n '/^## 14\./,/^### 14.1/p' docs/design/REQ-105-e2e-picker.md \| grep -cE '^\| (1\|2\|3\|4a\|4b\|4c\|4d) \|'` → 7 (2 for BACKEND-DEV, 5 for TEST-DESIGNER). Mutants: section 16, `grep -c '^| P'`, `'^| S'`, `'^| R'` → 25, 22, 8 = 55. Open questions: `grep -c '^| О'` → 12. Facts: `grep -c '^| F[0-9]'` → 42. Tests of the kit files: 52 + 20 = 72. Full suite: F21 | the design file; F21, F37 | section 0 |

Statements of the requirement that were **checked and held**: the three languages, the two colour schemes, the three windows, the tenant names `uchet-pro`, `svet-marketing`, `agency`, `stock`, the answer sets `leader`, `close`, `none` of `demo-answers/` and `leader` of `demo-answers-v3/`, the placeholder result screen with `[data-screen="result"]` and the focus on its heading, the server's reply to a wrong address, the words of the lost-net block, the five fields of the storage value, `SIGTERM` → exit code 0. **Corrected by measurement:** the number of criteria (F1), the field `title` (F4), "the start button lies inside the window" (F8), "the kit reports none" in criterion 8 (F13), "reaches `restart` of the card" with keys only (F17); and in the rework, the oracles of the first version of this design that were false on the real system: the digit rule on the whole stored value (F31) and the environment list of `E2S-05` (F32). Each is a question in section 19 with the default the design uses. **Not measured, not assumed:** the time on the GitHub runner for this file (F28); the Linux behaviour of the starter (the signal and group calls are those of the kit's Chrome code, which ran on the runner in REQ-104).

---

## 2. Design choices that could be disputed

| # | Choice | Default | Why | Question |
|---|---|---|---|---|
| C-1 | The starter spawns **only `process.execPath`** with an argument list; the child gets a **short list of environment variables** (`PATH`, `TMPDIR`, `TEMP`, `TMP`, `LANG`, `LC_ALL`, `TZ`, `SystemRoot`) plus what the caller gives, never the whole environment | yes | R2 and Q7: the stand of REQ-106 must not see `HOME`, `SAI_PIXEL_OFFICE_DIR`, `SAI_TEAM_REAL_RUNS` or tokens of the developer's shell; REQ-107 needs `SAI_TEAM_REAL_RUNS` to be unset. `NODE_TEST_CONTEXT` stays out for free | О8 |
| C-2 | The process is started **detached** (own process group), registered in the kit's registry at spawn, and noted for the runner's list of browsers through a marker folder made with `makeTempDir("profile")` | yes | the runner stops a spec by group; a detached child is not reached by that stop; the registry sweep (F27) is the net for a spec that cannot run its own handlers. The marker uses the existing folder shape `sai-e2e-profile-…`, so `cleanup.js` does not change | О7 |
| C-3 | `stop()` **requires** exit code 0 after `SIGTERM` and throws otherwise | yes | the requirement says so for the picker (criterion 7, README "The server"); the same rule is right for the other stands of the kit | — |
| C-4 | One browser per test, one stand per test (the isolation test: one stand and one browser per tenant pair) | yes | the independence loop; startup costs 0.1 s (stand) and about 0.5 s (browser) | — |
| C-5 | The spec tests are named exactly as the criteria name them (`matrix`, `pass`, …), with no id prefix | yes | the requirement names them, and the loop of REQ-104 criterion 7 uses the printed names | — |
| C-6 | The starter's own tests are listed as supporting tests under criteria 7, 8 and 10; REQ-105 has no criterion for the starter | yes | no test without a criterion was the rule of REQ-104 (C-2 there); the starter is what criteria 7 and 8 stand on | О6 |
| C-7 | The spec does not assert its own run time | yes | a timing assertion in a test makes a flaky test (AP-144); the limit is read by RELEASE-VALIDATOR from the record line, and the watchdog of the runner (120 s) bounds a hang | О11 |

---

## 3. Files, owners, order

Paths from the root of Sai. "New" = created by this work.

| File | Change | Owner | Sub-step |
|---|---|---|---|
| `tools/test/e2e/kit/stand.js` | new — `startStand`, `withStand`, the codes of 4.1 | BACKEND-DEV | 1 |
| `tools/test/e2e/kit/index.js` | two exports added: `startStand`, `withStand` | BACKEND-DEV | 1 |
| `tools/test/fixtures/e2e-stand/fake-stand.js` | new, mode 0755 — the stand-in server (4.3) | BACKEND-DEV (stand, as in О6 of 0108) | 1 |
| `tools/README.md` | the table row, the sentence, the budget words, the paragraph "Servers for the page specs" (section 14) | BACKEND-DEV | 2 |
| `tools/test/e2e-kit.test.js` | edits of `E2K-50` (the six names), `E2K-41`, `E2K-60` (section 12) | TEST-DESIGNER | 3 |
| `tools/test/e2e-kit.test.js` | one more edit of `E2K-50`: `picker.e2e.js` in `SCANNED` — made together with the file it names (N3) | TEST-DESIGNER | 4a |
| `tools/test/e2e-stand.test.js` | new — `E2S-01…E2S-20` (section 11.1) | TEST-DESIGNER | 3 |
| `tools/test/fixtures/e2e-stand/specs/sleep-stand.e2e.js` | new — a plain fixture spec for `E2S-18` | TEST-DESIGNER | 3 |
| `tools/test/e2e/picker.e2e.js` | new — the nine tests (section 4.4, 11.2) | TEST-DESIGNER | 4 |

No file is written by two roles (the two rows of `e2e-kit.test.js` are one role, TEST-DESIGNER, at two sub-steps). The fixtures of the starter lie in their own folder `tools/test/fixtures/e2e-stand/` so that the counts of `E2K-34` (5 TAP texts, 10 spec fixtures in `tools/test/fixtures/e2e/`) and the "unscanned" rule of `E2K-50` for `tools/test/fixtures/e2e/` are not touched. `tools/src/`, `tools/package.json`, `tools/package-lock.json`, `tools/test/e2e/run.js`, `tools/test/e2e/kit/runner.js`, `cleanup.js`, `browser.js`, `page.js`, `.github/`, `decisions/`, `docs/requirements.yaml` (other blocks) are not changed.

**Words in comments (as REQ-104, section 3).** The two sandbox flags and the skip words (`.skip(`, `.todo(`, `|| true`, `eslint-disable`, the options `{ skip`, `{ todo`) stand in **no** file under `tools/test/e2e`, in `e2e-stand.test.js`, in `fake-stand.js` and in `sleep-stand.e2e.js`, comments included (`E2K-25`, `E2K-50`, the grep of criterion 10 of REQ-105, `E2S-19`). A comment that must explain why writes it without the word.

Order: the shared contract first (the codes and the options of 4.1), then `stand.js` and the stand-in, then the README text, then the kit tests, then the spec.

---

## 4. Interfaces

All functions throw `E2eError` (`errors.js`) with a code from the table; text that a child process or a page controls goes through `safeText` before it reaches a message. No function of the stand prints.

### 4.1 `stand.js` — the starter of server processes

`startStand(options, deps?) → Promise<Stand>`

| Option | Type, default | Rule |
|---|---|---|
| `name` | string, required | `^[a-z0-9-]{1,24}$`; used in messages and as the label of nothing else |
| `args` | string[], required | at least one element; every element a string without NUL; the program is always `process.execPath`; `args[0]` is a script path relative to `cwd` (the picker: `src/picker/cli.js`, then `serve`, `--tenants`, the folder, `--port`, `0`) |
| `readyPattern` | RegExp, required | **exactly one capture group**, flags without `g` and `y`; matched against the collected stdout (the last 64 KB); the first match wins; group 1 is the address, e.g. for the picker `/(http:\/\/127\.0\.0\.1:\d+)\/t\//u` (the first link line) |
| `cwd` | string, default `<repoRoot()>/tools` | |
| `env` | object of string values, default `{}` | added over the base list (C-1); a value that is not a string → `USAGE` |
| `stateDirs` | string[], default `[]` | every entry is passed to `assertUnderTempRoot` **before anything is made or spawned**; the returned (real) paths are exposed as `stand.stateDirs`. The picker has none (it writes nothing); REQ-106 gives its two folders; REQ-107 its two |
| `startTimeoutMs` | 15000 | no link in this time → `STAND_START_TIMEOUT`, the group is killed |
| `stopTimeoutMs` | 10000 | `SIGTERM` to the end of the process; then `SIGKILL` |

`deps` (for the tests only): `{ spawn }`, default `child_process.spawn`. A test counts the calls to prove that a refused option spawned nothing.

The order inside `startStand` (nothing is "checked now, used later"):

1. Check `name`, `args`, `readyPattern`, `env` (`USAGE`); check every `stateDirs` entry (`PATH_REFUSED`). Nothing is spawned or made before this point.
2. Make the marker folder `makeTempDir("profile")` (the temporary root is checked against the repository inside that call).
3. `spawn(process.execPath, args, { cwd, env: <base list> + env, detached: true, stdio: ["ignore", "pipe", "pipe"] })`. A throw or an `error` event → `STAND_START_FAILED` (`could not start "<name>": <code>`), the marker removed. **A child that could not be started has no `pid` (F33):** then nothing is registered, noted for the runner, signalled or waited for (no group exists); the marker is removed and the error is thrown at once — in well under a second (the `error` event comes after about 2 ms; `E2S-04` bounds the call at 1000 ms). A guard that waits for the group of an undefined pid takes 3 s for nothing and is a defect (N8).
4. At once, in the same statement block: `registerGroup(pid)`, `noteBrowserForRunner(pid, marker)`, `installHandlers()` — the child is covered by the exit/signal handlers and by the runner's sweep before the first wait.
5. Read stdout and stderr **to the end for the life of the process** (a full pipe blocks the child, AP-078): each stream keeps its last 65536 characters. After each stdout chunk the pattern is tried on the kept text until it matches.
6. On a match: `url = assertLoopbackUrl(group 1)` (so a link that points elsewhere → `URL_REFUSED`, the group killed); `origin = new URL(url).origin`; resolve.
7. On the process ending before a match → `STAND_START_EXITED`: `<name> exited before it printed its link (exit code <n>|signal <s>). Last line of its stderr: "<line>"`; on the timer → `STAND_START_TIMEOUT`: `<name> did not print its link in <ms> ms; it was killed`. In every failure of steps 4–7 (the child has a `pid`): `SIGKILL` to the group, wait until it is gone (3 s), `unregisterGroup`, remove the marker; then throw. In a failure of step 3 with no `pid`: only the marker is removed, as above. Every timer is cleared on every path (F26).

`Stand`:

| Member | Contract |
|---|---|
| `name`, `pid`, `url`, `origin`, `port` (number), `stateDirs` | read only |
| `stdout()`, `stderr()` | the kept text (last 65536 characters) as it is now |
| `isRunning()`, `exitInfo()` | `exitInfo()` is `null` while running, then `{ code, signal }` |
| `stop() → Promise<{ code: 0, signal: null }>` | idempotent: every call returns the same promise, `SIGTERM` is sent once. If the process is running: `signalGroup(pid, "SIGTERM")` (the **group**), wait for the end of the process at most `stopTimeoutMs`; on timeout `SIGKILL` to the group, wait, clean up, throw `STAND_STOP_TIMEOUT`: `<name> did not stop in <ms> ms after SIGTERM; it was killed`. After the process has ended: `SIGKILL` to the group for anything it left behind, wait (3 s) for the group to be gone, `unregisterGroup`, remove the marker (the registration and the marker are removed also when the group is still alive). **Precedence (N11):** if the group is still there after the wait, `CLEANUP_FAILED` is thrown and it **wins** over `STAND_EXIT` (a process left alive is the graver fact); its message ends with the exit code or signal of the main process. Only when the group is gone: if the exit was not code 0 with no signal → `STAND_EXIT`: `<name> ended with exit code <n>|signal <s>` (+ ` after SIGTERM` or ` on its own`) + `. Last line of its stderr: "<line>"`. A process that ended by itself before `stop()` is cleaned up the same way and `stop()` then throws `STAND_EXIT` (a crashed server fails the test that used it). *As built (`decisions/0109`, О14):* a stand that ended by itself before `stop()` fails it with `STAND_EXIT` `… on its own` **whatever its exit code, `0` included**; the only good end is code `0` with no signal after the `SIGTERM` of `stop()` (`stand.js`: `!sentTerm \|\| code !== 0 \|\| signal`) |

`withStand(options, body) → Promise<value of body>`: `startStand`; `await body(stand)`; always `stop()` in a `finally`. A body error is rethrown **as it is**; if `stop()` also fails, its error is attached as `error.cleanupError`; if the body succeeded and `stop()` failed, that error is thrown. A test that stops the server itself (`no connection`, `not found`) calls `stand.stop()` in the body; the second call is the same promise and adds nothing.

New codes (the table of REQ-104 4.1 gets these rows; the codes `USAGE`, `PATH_REFUSED`, `URL_REFUSED`, `CLEANUP_FAILED` are reused): `STAND_START_FAILED`, `STAND_START_EXITED`, `STAND_START_TIMEOUT`, `STAND_EXIT`, `STAND_STOP_TIMEOUT`. The messages never hold the environment.

**What the starter does not do:** it does not start `sh` programs or wrappers (the hook of REQ-106 is run by the spec itself with its own two environment variables); it does not restart (REQ-106 "reconnect" stops, then calls `startStand` again with `--port <the old stand.port>` in `args`); it does not read the state folder.

*As built 2026-11-16 (REQ-106, `decisions/0112` О1; `docs/design/REQ-106-e2e-pixel-office.md`, section 4.1).* This section describes the starter as REQ-105 left it. Since REQ-106: the option `stateDirs` and the member `stand.stateDirs` (the rows above and step 1 of the order) are gone — an options object that has the key `stateDirs` at all fails with `USAGE`; a state folder is given through `stateEnv` (pairs "variable → folder", checked, and the child gets the real path), in a value of `env` or as an argument, and rule P checks every absolute path in them (under the temporary root, not the root itself, outside the repository; the script as the first argument may lie inside the repository); the child is no longer started without `HOME`: every stand gets a private home `<marker>/home`, given as `HOME` and `USERPROFILE`, set last, and `env` may not name them (`stand.homeDir`); `stop()` throws `STAND_HOME_WRITTEN` when the server left anything there, with the precedence `CLEANUP_FAILED` > `STAND_HOME_WRITTEN` > `STAND_STOP_TIMEOUT` > `STAND_EXIT`. The starter still does not start `sh` programs, does not restart and does not read the state folder.

### 4.2 How REQ-106 and REQ-107 use it (invented values)

| Requirement | Call |
|---|---|
| REQ-105 | `withStand({ name: "picker", args: ["src/picker/cli.js", "serve", "--tenants", "src/picker/demo-tenants", "--port", "0"], readyPattern: /(http:\/\/127\.0\.0\.1:\d+)\/t\//u }, …)` |
| REQ-106 (Pixel Office) | `name: "office"`, `args: ["src/pixel-office/main.js", "--port", "0"]`, `env: { SAI_PIXEL_OFFICE_DIR: <dirA>, HOME: <dirB> }`, `stateDirs: [<dirA>, <dirB>]`, `readyPattern: /^Pixel Office: (http:\/\/127\.0\.0\.1:\d+\/)/mu`. The criterion "the starter called with a state folder outside the temporary root throws before any process is started" is `E2S-03` for the starter, and one call with a fake `deps.spawn` in its spec |
| REQ-107 (team page) | `name: "team"`, `args: ["src/web/main.js", "--port", "0", "--executor", "scripted", "--scenario", <file>]`, `env: { SAI_TEAM_HOME: <dirA>, HOME: <dirB>, SAI_TEAM_CLAUDE_BIN: <trap> }`, `stateDirs: [<dirA>, <dirB>]`. `SAI_TEAM_REAL_RUNS` is unset without a line of code: the base list does not carry it |

If a later requirement needs the stdout line in another shape, it changes `readyPattern`, not the starter. If it needs a program other than Node, it is a change of the kit with its own design.

*As built 2026-11-16 (`docs/design/REQ-106-e2e-pixel-office.md`, section 4.3).* The rows of REQ-106 and REQ-107 above are the plan of REQ-105. REQ-106 calls `stateEnv: { SAI_PIXEL_OFFICE_DIR: <office> }` with no `env` and no `stateDirs`; `HOME` is the starter's private home, not a folder the spec gives (the hook gets a home folder of the test, `decisions/0112` О2). For REQ-107 `HOME` is the starter's too, and a trap program inside `tools/test/fixtures/` given in `env` is refused by rule P (О14, О22): its design settles it.

### 4.3 The stand-in server `tools/test/fixtures/e2e-stand/fake-stand.js`

Mode 0755, first line `#!/usr/bin/env node`, ES module, Node built-ins only, never reads stdin. Variables read: `SAI_FAKE_STAND_MODE` (default `ok`), `SAI_FAKE_STAND_LOG` (a file; every event is appended as one JSON line). Events: `{event:"start", pid, argv}` at the start (before anything else, so a test that never got a link can still read the pid); `{event:"env", keys:[…sorted names…]}` after the start; `{event:"term"}` on each `SIGTERM`, written first in the handler; `{event:"child", pid}` for a child, and `{event:"child-ready", pid}` written by the child itself (N13). Started with the argument `--child` the script is the child of `with-child`: it installs a `SIGTERM` handler that does nothing, **then** appends `{event:"child-ready", pid: <its own pid>}` to the log, **then** writes the line `ready` to its stdout, and then sleeps; it opens no port. Without that argument it listens on `127.0.0.1` port 0 (answers `ok` to any request) and then writes `Fake stand ready.` and the line `http://127.0.0.1:<port>/t/demo/` (the order in `with-child` is below). The `SIGTERM` handler of the normal modes does its work in steps that take time (it closes the server and exits when the close is done), so it is not a handler that ends the process in the same tick.

| Mode | Behaviour | Used by |
|---|---|---|
| `ok` | as above; on `SIGTERM` closes the server and exits 0 | E2S-01, 03, 04, 05, 06, 11, 14, 15, 16, 18 |
| `ok-late` | prints the link after 800 ms | E2S-01 (a late link is still read) |
| `exit-early` | writes `fake stand: cannot start, boom` to stderr, exits 3 | E2S-06 |
| `hang` | prints nothing, stays alive, exits 0 on `SIGTERM` | E2S-07 |
| `foreign-link` | prints `http://example.com:1/t/demo/` | E2S-08 (with a generic pattern) |
| `exit-one` | like `ok`, but exits 1 on `SIGTERM` | E2S-09, 15 |
| `ignore-term` | like `ok`, ignores `SIGTERM` | E2S-10 |
| `die-later` | like `ok`; exits 5 by itself 300 ms after the link | E2S-11 |
| `quit-later` | *as built (`decisions/0109`, О14; step 02b):* like `ok`; exits **0** by itself 300 ms after the link | E2S-11 |
| `noisy` | after the link writes 512 chunks of 4096 characters to each of stdout and stderr with `fs.writeSync`, retrying on `EAGAIN`, and **ends each of the two streams with the line `END`** (N11); then behaves like `ok` | E2S-12 |
| `with-child` | after it listens, the parent starts a child in the same group (the same script with `--child`, so its command line holds `fake-stand.js`, which the leftover check of section 16 sees; stdio `["ignore", "pipe", "ignore"]`) and **waits for the line `ready` on the child's stdout** (at most 5 s; if it does not come, the parent exits with code 4); then it appends `{event:"child", pid}` and **only then** prints `Fake stand ready.` and the link. So the link exists only when the child already ignores `SIGTERM` and has logged `child-ready` (N13, F38). On `SIGTERM` the parent closes the server and exits 0, leaving the child; only `SIGKILL` removes the child (N4, F36) | E2S-13 |
| `stack` | writes a line `Error: boom` and a line `    at fake (file.js:1:1)` to stderr after the link | E2S-20 |

TEST-DESIGNER may add modes; the modes above are the contract.

*As built.* The stand-in has the twelve modes of the table (`MODES` of `fake-stand.js`). The child of `with-child` also appends `{event:"child-term", pid}` in its `SIGTERM` handler (the handler still does nothing else), which `E2S-13` reads (section 11.1).

*As built 2026-11-16 (`docs/design/REQ-106-e2e-pixel-office.md`, section 4.2).* Since REQ-106 the `env` event is `{event:"env", keys:[…], home: <os.homedir() of the stand-in>}`, and the stand-in has three modes more, fifteen in all: `write-home` (after the link it makes the folder `.fake-stand-dir` and the file `.fake-stand-note` in its home, only when that home lies strictly under its real temporary root; otherwise it writes nothing and logs `home-refused`), `write-home-exit-one` and `write-home-ignore-term`.

### 4.4 `picker.e2e.js`

Top-level `test()` calls only, nine of them, in this order; each has `{ timeout: 30000 }`, starts its own stand (`withStand`) and its own browser (`withBrowser`), and shares nothing with another test. The console declaration `FAVICON = { kind: "browser-log", text: "Failed to load resource: the server responded with a status of 404 (Not Found)", path: "/favicon.ico" }` is made with `expectOncePerStart` in every test; the 404 line is a constant of the file.

**Helpers** (functions of the file, none exported; the page code they pass is strings):

| Helper | Does |
|---|---|
| `pickerStand(tenantsDir)` | the options of 4.2 for the folder `src/picker/demo-tenants` or `src/picker/demo-tenants-v3` |
| `readJson(relativePath)` | a file of `tools/` (answers sets, tenant files) parsed |
| `getJson(origin, path)` | `fetch` of a path of the stand, parsed |
| `directPost(origin, id, lang, set)` | `fetch` POST to `/t/<id>/api/result?lang=<lang>`, headers `content-type: application/json` and `origin: <origin>`, body `{"answers": set}` → `{ status, text }` |
| `rawGet(port, path)` | `node:http` request with `host: "127.0.0.1"`, the `path` exactly as written, `agent: false` → `{ status, body (Buffer) }` |
| `answerAll(page, questionnaire, set)` | until `[data-screen="result"]`: read `#q-title`, find the question by its title in the questionnaire (titles are unique, asserted), answer from `set` (single/multiple: click `[data-part="option"]:has(input[value="<id>"])`; number: `type("#q-input", String(value))`), skip it with `[data-action="skip"]` if the set has no answer and the question is not required (a required one without an answer is a failure of the test), press `form [data-part="next"]`, wait for the next title or the result. Returns the ids in the order met. A step bound of 40 |
| `startFresh(page, url)` | `goto(url)`, `evaluate("localStorage.clear()")`, `reload()` (F10) |
| `contrast(fgRgb, bgRgb)` | the WCAG formula below |
| `effectiveBackground(element)` (page code) | walks up from the element to the first parent whose `background-color` alpha is above 0; composites a partly transparent one over the next; ends with white |
| `focusInfo()` (page code) | `{ action, partName, type, screen, ring, live }` of `document.activeElement` |
| `tabTo(page, action, maxTabs)` | presses Tab (up to `maxTabs`), after each press reads `focusInfo()` and asserts `ring`; returns when `action` is met, fails after `maxTabs` |
| `exclusiveStrings(qA, qB)` | the strings (name, intro, titles, helps, units, option labels) of A that are not in B. *As built (`decisions/0109`, О17):* `exclusiveStrings(questionnaireA, tenantFileB)` — A's texts come from A's questionnaire as the server gives it, B's from **B's tenant file** in `ru`, not from B's answer of the server under test |
| `hasStack(text)` | `/^[ \t]+at /mu` — a line that starts with blanks and `at ` (not `\s`, which would cross lines). Controls, asserted at the start of `not found` before the page is touched (the three texts of `E2S-20`): true for `Error: boom` and a line `    at fake (file.js:1:1)`; false for `we arrive at the end`; false for `note`, an empty line, `at start` — so a `\s` in the spec's own definition is red there (mutant R07) |
| `sha256(buffer)` | hex |

*As built.* `effectiveBackground` is a function inside the page-code string `CARD_COLOURS`, and `focusInfo()` is the page-code string `FOCUS_INFO`; `horizontalOverflow` (section 8, row 1) is the method of the kit's page, not a helper of the file; `answerAll`, `tabTo` and most helpers below take a last argument `what`, the label they put into their messages, and `rawGet` also returns the path it sent (`sentPath`). The file has these helpers more (functions and page-code strings, none exported; read in `tools/test/e2e/picker.e2e.js` at step 10):

| Helper | Does |
|---|---|
| `query(selector)`, `textOf(selector)` | page code that finds one element by a CSS selector, and its text |
| `waitForCard(page, what)` | waits until the card with its start button is on the screen |
| `optionSelector(id)` | the selector of the option row that holds the input of the option `id` |
| `answer(page, question, value)` | answers one question on the screen: the option rows of a single or a multiple choice, or the number typed into the field |
| `byTitleOf(questionnaire, what)` | the questions of a questionnaire by their titles (asserted unique) |
| `questionOnScreen(page, byTitle, what)` | the question on the screen, found by its title |
| `screenAfter(page, question, what)` | after a press on a button of `question`: waits until another question or the result is on the screen |
| `answerUpToLast(page, questionnaire, set, what)` | answers up to the last question and that one too, without the press that asks for the result (`no connection`) |
| `resultRecord(page, what)` | the one `POST` of the page (the request of the result) with its body as the page got it |
| `atQuestion(page, question, what)` | waits until `question` is on the screen |
| `until(check, ms, what)` | polls a fact of this process (the network records, the console entries) until it is true, at most `ms` |
| `WCAG`, `luminance(rgb)` | the table of constants of the WCAG 2.x formula and the relative luminance of a colour |
| `CARD_COLOURS` | page code: the colours of the card, with `effectiveBackground` (a colour laid over the ones below it, white under all) |
| `FOCUS_INFO` | page code: what holds the focus and whether it shows a visible ring (style not `none` and width above 0, or a box shadow; a radio may have the ring on its option row) |
| `assertMoved(focus, screen, what)` | after a change of screen: the focus is inside the new screen, and on a question `#live` says what the progress line says |
| `CHECKED_VALUES` | page code: the values of the checked inputs of the question screen |
| `STORAGE_STATE` | page code: the whole storage of the origin read key by key, `sessionStorage` and the cookie |
| `noContactData(text)` | the rule «no `@`, no run of seven digits» on a stored text |
| `visitorTexts(questionnaire, textOf, who)`, `asServed`, `russianOf`, `textSet` | the texts a visitor reads (the name, the intro, and the title, help, unit and option labels of each question), from an answer of the server (`asServed`) or from a tenant file in `ru` (`russianOf`), and the different non-empty ones of them (`textSet`) |
| `placedStrings(value, place)`, `placedKeys(value, place)`, `stringValues(jsonText)` | every string value, every object key, with its place, at any depth of a JSON value |
| `solutionNames(tenantFile)` | the names of the solutions of a tenant file in every language |
| `hasBlank(text)`, `russianTexts(tenantFile)`, `commonWords(textsOfA, tenantFileB)` | a text of more than one word; the `ru` texts of a tenant file at any depth; the one-word texts of A that stand inside a `ru` text of B's file — the only ones compared with whole values (О17 as corrected) |
| `assertNothingOf(jsonText, textsOfA, common, namesOfA, what)` | an answer to B holds no text of A (as a part, except the `common` words: as whole values), no solution name of A, and no key that holds either |
| `assertTextsOfFile(questionnaireText, tenantFile, what)` | the visitor texts of B's questionnaire answer equal the `ru` texts of B's tenant file, field by field |
| `composedFields(fileBytes)`, `assertOwnStrings(jsonText, tenantFile, composed, what)` | every string of an answer to B is a string of B's tenant file, except the fields the server composes (`version`, `lang`, `languages` of the questionnaire answer, each asserted by value) |
| `ANSWER_FIELDS`, `assertOwnKeys(jsonText, keysOfB, fields, what)` | every key of an answer to B is a key of B's tenant file or one of the named fields of the answer, each with its reason (13 for B's two answers; 3 for the error answer) |
| `SCREEN_TEXTS`, `shownTexts(textsOfB, prefix)`, `assertScreenNothingOf(shown, itemsOfA, ownTexts, what)` | page code that reads what a visitor reads or hears on a screen (the text of the root element, the title, every attribute of every element, the decoded address, the whole text of every element, every text node); the texts of B's file that a screen shows; a screen of B shows no text or solution name of A, with a word of A inside a shown text of B allowed only inside that text (О19, О20) |
| `SHARED_PATHS`, `assertRequestsOfB(records, origin, a, b, what)` | the paths B's page may ask besides `/t/<B>/` (only `/assets/<name>`, with its reason); every request of B's page went there, none under `/t/<A>/`, and each has its answer |
| `answerAllLooking(page, questionnaire, set, look, what)` | `answerAll` for B's pass with `look(question)` run on every question screen when it is shown and again after its answer |
| `PAIRS` | the two pairs A, B of criterion 6 with what was measured for each: the common words and the one place where a word of A stands inside a text of B on a screen («человек» on question 11, team, of `svet-marketing`) |
| `lostNetBlock(page, failures, what)` | the block of a lost net after the failed request number `failures`: its text, its button and where the focus is |

**WCAG formula** (written in the spec as a table of constants; `0.03928` is the number of WCAG 2.x, and no 8-bit channel value falls between it and the newer `0.04045`, checked for 0…255): for each channel `s = c / 255`; `lin = s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ^ 2.4`; `L = 0.2126·R + 0.7152·G + 0.0722·B`; `ratio = (Lmax + 0.05) / (Lmin + 0.05)`. Controls, asserted at the start of `themes` before the page is touched: black on white = 21 exactly; equal colours = 1 exactly; a third pin on the threshold: `#767676` on white ≥ 4.5 and `#777777` on white < 4.5 (the two sides of 4.5 differ).

**The nine tests** (what each does; the assertions are in section 8 by criterion):

1. **`matrix`** — one stand (`demo-tenants`), one browser, one tab. For `lang` in `ru, kk, en` × `scheme` in `light, dark` × `window` in `1470×784, 390×844, 320×568` (a counter, asserted equal to 18 after the loops, and the 18 tuples are collected and asserted pairwise different): `setViewport`, `setColorScheme`, `goto(…/t/uchet-pro/?lang=<lang>)`, wait for the card; read `html lang`, `<h1>`, `[data-part="intro"]`; `horizontalOverflow()` on the card; the start button rectangle; click start; wait for the question; count `[data-screen="question"]`; `horizontalOverflow()` again. Per combination it also reads `matchMedia('(prefers-color-scheme: dark)').matches` and the `body` `background-color` (N9, F35); after the loops the colours are grouped by scheme.
2. **`pass`** — one stand, one browser; five passes, each on a fresh tab with `startFresh`, each by `answerAll`, and a sixth, `hidden` (N5, F34), by its own steps. The plan (language, set, window, scheme): `ru leader 1470×784 light`, `ru close 390×844 dark`, `ru none 320×568 light`, `kk leader 320×568 dark`, `en leader 1470×784 dark`. **The coverage table** is built from what the page reports after each pass (`innerWidth`, `matchMedia`, `html lang`) and the set name, not from the plan constants; the test asserts that its windows are exactly `{1470, 390, 320}`, its schemes `{light, dark}`, its languages `{ru, kk, en}`, its sets `{leader, close, none}`. **The `hidden` pass** (`ru`, `1470×784`, light; not in the coverage table, which is about the five): steps of F34 — answer the first six questions with the `leader` set (`problems` = `slow-count`; the sixth is `staff`), answer `recount` (`weekly`) and press next (the question `migrate` shows), press back three times (`recount`, `staff`, `problems`), deselect `slow-count` and select `no-reports` (the question `recount` becomes hidden), press next twice (`staff`, then `migrate`), answer the rest as `leader` does. Expected request body: `{answers: X}` where `X` is the `leader` set with `problems` = `["no-reports"]` and without `recount` (computed in the spec from the set, not read from the page); the stored `answers` of the tenant key equal `X` too (no hidden key is kept).
3. **`themes`** — the contrast controls; then one stand, one browser, one tab: `light` then `dark`, `goto` the card, read the values of F14.
4. **`keyboard`** — one stand, one browser, one tab, no mouse event (the helper `click` is not called; the test imports none): the path of F16 and F17.
5. **`storage`** — one stand, one browser: the path of F18, with a decoy key for the restart.
6. **`isolation`** — for each pair `[demo-tenants, demo-answers, uchet-pro, svet-marketing]` and `[demo-tenants-v3, demo-answers-v3, agency, stock]`: one stand, one browser: the steps of criterion 6. *As built (`decisions/0109`, О17 as corrected, О19, О20):* after A's full pass B's page is read on its card, on every question screen of B's own `leader` pass (when it is shown and again after its answer, by `answerAllLooking`) and on the result screen; B's answers are read by the list of A's texts, by B's own strings and by their keys; B's requests and what they bring are read after B's result (section 8, row 6).
7. **`not found`** — one stand, one browser: the `hasStack` controls, the five requests, the declared lines, the stop.
8. **`no connection`** — one stand, one browser: the steps of criterion 8.
9. **`v3`** — one stand (`demo-tenants-v3`), one browser: `agency` and `stock` × (`1470×784 light`, `390×844 dark`), each a fresh tab with `startFresh`.

**Declared console lines.** Every test: `expectOncePerStart(FAVICON)` (the first load of a fresh profile writes it, the others in the start do not, F12). `not found` also declares, with `expect` and a `path` each, the 404 line of `/t/net-takogo/`, `/t/UCHET-PRO/`, `/t/uchet-pro/%00` and `/`. `no connection` declares `{ kind: "browser-log", text: "Failed to load resource: net::ERR_CONNECTION_REFUSED", path: "/t/uchet-pro/api/result" }` with `expect` and asserts the count of such entries is exactly 2 (one per press). The kit fails a declaration that did not happen and every entry that no declaration claims.

---

## 5. Failure paths — what the user sees, what stays

| # | Situation | The user sees | State afterwards |
|---|---|---|---|
| 1 | `startStand` with a bad option (name, args, pattern, env value) | `USAGE` naming the option, 0 processes spawned | nothing made |
| 2 | a state folder outside the temporary root, relative, inside the repository, or a link inside the root that points out | `PATH_REFUSED` before the marker is made | 0 spawns, no folder |
| 3 | the program cannot be started (bad `cwd`): the child has no `pid` | `STAND_START_FAILED`, thrown at once (the `error` event, 2 ms; no wait for a group, N8) | marker removed; nothing was registered, so nothing is unregistered |
| 4 | the child ends before the link | `STAND_START_EXITED` with the code and its last stderr line (escaped) | group gone, marker removed, registry empty; a second start works |
| 5 | no link in `startTimeoutMs` | `STAND_START_TIMEOUT` | the group is killed (`ESRCH` within 3 s), marker removed |
| 6 | the link points outside 127.0.0.1 | `URL_REFUSED` (the kit's text, cut) | the group is killed, marker removed |
| 7 | the server ends with a code other than 0, or by a signal, after `SIGTERM` | `STAND_EXIT` with the code and the last stderr line (and, if its group is still alive after `SIGKILL` and the wait, `CLEANUP_FAILED` instead — it wins, N11) | group gone, marker removed |
| 8 | the server ignores `SIGTERM` | `STAND_STOP_TIMEOUT` after `stopTimeoutMs` | `SIGKILL` to the group; group gone; marker removed |
| 9 | the server dies by itself during a test | the page calls fail as for any dead server; `stop()` throws `STAND_EXIT` (its code). *As built (`decisions/0109`, О14):* whatever its code, `0` included, with ` on its own` in the message (`E2S-11`, modes `die-later` and `quit-later`) | cleaned up |
| 10 | the body of a test throws | the same error object; the stand is stopped | `cleanupError` attached if the stop failed too |
| 11 | the spec process gets `SIGTERM`/`SIGINT`/`SIGHUP`, `process.exit`, an uncaught throw | exit code 143/130/129/as given/1 | the group is killed by the exit handler of `cleanup.js`, the marker removed (E2S-16) |
| 12 | the runner stops a hung spec, even one with a blocked event loop | `SPEC_TIMEOUT` (the runner's text) | the runner's sweep of the list of browsers kills the stand's group and removes the marker (F27, E2S-18) |
| 13 | the runner itself is killed with `SIGKILL` | nothing can run | the stand and Chrome stay (the residual risk О7(a) of REQ-104); not widened |
| 14 | a page test fails (a wrong text, an overflow) | the assertion text of the test; the kit's `CONSOLE_ENTRIES` if there are also stray console lines | browser closed, stand stopped, folders removed |
| 15 | the stand's stderr holds a stack | `not found` and `isolation` fail with the first 3 lines of it (escaped) | — |

---

## 6. Protection in the same operation as the action

| Protection | Where it stands |
|---|---|
| A state folder is under the temporary root | inside `startStand`, step 1, before the marker and before `spawn`; the returned real path is what is exposed |
| The link is a loopback address | inside `startStand`, step 6: `assertLoopbackUrl` returns the href that is used; the spec opens only `stand.origin`-based addresses |
| The child sees no foreign variable | inside `startStand`, step 3: the environment is built there, in one place, from the named list plus `env` |
| No orphan stand | registered at spawn, in the same block (step 4), before the first wait; the handlers are installed in the same call; the runner's list is written in the same block |
| No timer outlives the call | every timer of `startStand` and `stop()` is cleared in the code path that ends its wait (mutant S03) |
| The stand's exit code is checked | inside `stop()`, after the cleanup, in one function (mutant S01) |
| The raw request for `/t/%2e%2e/` is sent as written | `rawGet` passes `path` to `node:http` untouched and the test asserts the sent path (`req.path`) equals the string |
| The spec reads no real home folder | the picker writes nothing; the stand has no `HOME` in its environment (C-1) |

There is no "check now, act later in another call".

*As built 2026-11-16 (`docs/design/REQ-106-e2e-pixel-office.md`, section 6).* The first and the last rows describe the starter as REQ-105 left it. Since REQ-106 the stand has a `HOME` in its environment — its private home under the temporary root, made and given in the same call as the spawn — so its home lookup cannot reach the person's home folder; every absolute path in `stateEnv`, in `env` and in the arguments is checked before anything is made; a write into the home fails `stop()` with `STAND_HOME_WRITTEN`. The picker spec is green on the changed starter (9 of 9 at steps 06 and 09 of run `E2E106-20261115-01`).

---

## 7. Time budget (criterion 10: 80000 ms for `npm run -s e2e -- picker`)

**What was measured (developer machine, macOS arm64, 10 cores).** The prototype of the nine tests, run by the real command `npm run -s e2e -- picker`:

| Run | `duration_ms` of the record |
|---|---|
| 1 | 16733 |
| 2 | 16603 |
| 3 | 16622 |

Per test (one run, ms): `matrix` 3183, `pass` 2563, `themes` 1092, `keyboard` 1098, `storage` 1085, `isolation` 2362, `not found` 1420, `no connection` 1118, `v3` 2215 (sum 16136); the rest is the preflight browser and the start of Node. Where the time goes: one browser start-and-stop costs about 0.5 s, nine of them are about 5 s; the kit waits 100 ms after each page load (`LOAD_SETTLE_MS`, needed for the favicon line), and the 18 loads of `matrix` plus the other loads are about 5 s; the passes cost about 90 ms each of page time; the sixth pass of `pass` (`hidden`, N5) is one pass more (about 0.3–0.5 s with the tab and the clicks), so the figures below grow by that and are still far under the limit. The first prototype took 26.6 s because `stop()` left an armed timer (F26); with the timer cleared 16.6 s. Both files together (`npm run e2e`): `picker` 16266 + `smoke` 17473 = `duration_ms=34202`, well inside the 240000 of the whole run.

**Stress, not a prediction.** Four copies of the file at once: 24.6–25.7 s each; eight copies at once on the 10 cores: 42.8–44.7 s each (2.6 times). It shows how the time grows when the machine is busy; it does not say what the runner does.

**The runner.** The GitHub runner was not run for this file and cannot be from here without a push (the task forbids it). The only runner readings are for the other file: the same 13-test smoke file took 25539 ms and 34821 ms in two runs, against 17462 ms here (ratio 1.46 and 2.0; F28). This is a reading of another file on another day, so the figure for `picker` is an **estimate, not a fact**: 16.6 s × 2.0 = about 33 s, with the real spec's extra assertions (the prototype has fewer) perhaps 20 s × 2.0 = 40 s, and the load factor 2.6 gives about 52 s. All of these are under 80 s; the lowest margin is 1.5 times.

**How the design keeps the file under the limit without parallel work.** (1) Nine tests, each with one stand (0.1 s) and one browser (0.5 s): no test pays for a second browser except `isolation`, which runs two tenant pairs one after the other (+0.6 s). (2) One tab for all 18 combinations of `matrix`, one tab per pass in `pass`; the passes are the page's 90 ms. (3) No waiting by fixed sleeps in the spec: every wait is `waitFor` with a condition (the kit polls every 50 ms). (4) No timer of the starter outlives its call. (5) Tests are not run in parallel inside the file: the independence loop reads top-level lines, and a suite would add a name level; a shared browser would couple the tests. These two levers are therefore **not** used; if the runner shows a time above the line below, they are a change of the kit with a design of its own.

**The line.** RELEASE-VALIDATOR reads the `duration_ms` of the record line of the `e2e` step in the GitHub run of the release (it is printed in the job log) and writes it. If it is above 48000 (60 % of the limit), the validator stops with a question to ORCH (the levers: the settle wait of the kit, a faster tab reuse, a kit change for parallel tests); if it is above 80000, the criterion is not met. The spec does not assert its own run time (C-7): a slow runner turns the criterion red in the validator's table, not the check on `main`, whose own limit is `decisions/0106`.

**The bound of a hang.** Every test has a 30000 ms limit; the runner stops a file at 120000 ms (`SPEC_TIMEOUT`).

**As built (measured; the estimate above stays as it was written).**

| Where | Run | `picker` | Whole `e2e` step | Source |
|---|---|---|---|---|
| GitHub runner, `ubuntu-24.04` (image 20261111.370.1), Chrome 157.0.8103.50 | check.yml run 43723864463 (step 06) | 20035 ms | `duration_ms=44930` | `handoffs/E2E105-20261105-01/step-06-test-runner.json` |
| GitHub runner, `ubuntu-24.04` (image 20261111.370.1), Chrome 157.0.8103.50 | check.yml run 43727151996 (step 09) | 22050 ms | `duration_ms=53773` | `handoffs/E2E105-20261105-01/step-09-release-validator.json` |
| This Mac, Chrome 157.0.8103.78, the series of step 09 | 6 quiet runs; 3 under four busy loops | 16785–16904 ms; 18201–18257 ms | — | the same |
| This Mac, in `npm run check` | steps 06 and 09 | 16547 ms; 16294 ms | `duration_ms=34124`; `33558` | the two handoffs |

Both runner readings are under the line of 48000 ms (22050 ms is 45.9 % of it and 27.6 % of the limit 80000), so there was no question to the owner (`decisions/0109`, О11). The runner was 1.21 and 1.35 times slower than this Mac, against the estimate of about 2 above. Each runner reading is one sample of one run (AP-144); Windows was not run.

---

## 8. Criterion → test

"RV" = a command that RELEASE-VALIDATOR runs itself. The names in the second column are the tests of `picker.e2e.js`; `E2S-…` are in `e2e-stand.test.js` (supporting, C-6); `E2K-…` are the released kit tests that are edited (section 12).

| Criterion | Element of the design | Test(s) | What it asserts (oracle) | Also by command |
|---|---|---|---|---|
| 1 The card and the first question in every combination | 4.4 (`matrix`), helpers `getJson`, `horizontalOverflow` | `matrix` | counter 18 and 18 distinct tuples; `html lang` = language; `<h1>` text = `name` of `GET …/api/questionnaire?lang=<l>` and = the tenant file's `name[<l>]`; `[data-part="intro"]` text = `intro` of the same answer (it tells `kk` from `ru`, whose `name` is the same); on the card and on the question `horizontalOverflow().overflowing` is false (`scrollWidth` ≤ `innerWidth`); the start button's left ≥ 0 and right ≤ `innerWidth`, and after `scrollIntoView` the whole rectangle is inside the window (F8); exactly one `[data-screen="question"]`, its title = the title of the first question of the questionnaire; **colour scheme per combination (N9):** `matchMedia` dark equals the scheme that was set, and the `body` colours grouped by scheme hold exactly one value per scheme (over all 9 windows×languages of the scheme) and the two values differ — so a scheme that works in one window only is red (mutant P25); the kit reports no console entry but the one declared favicon line | RV: `ls tools/test/e2e/picker.e2e.js` fails on the tag, passes now |
| 2 A full pass; answers checked against the server | 4.4 (`pass`), `answerAll`, `directPost`, coverage table | `pass` | per pass: `[data-screen="result"]` present; the focus is on a heading (`:is(h1,h2,h3)`) inside it; exactly one `POST` record; its URL query `lang` = the language; its `requestBody` parsed deep-equals `{answers: set}` (no answer for a hidden question, none missing); `responseBody` = `directPost(...).text` character for character and status 200; over the three Russian passes the three bodies are pairwise different; the coverage table is complete (windows, schemes, languages, sets); **the `hidden` pass (N5):** exactly one `POST`, its parsed `requestBody` deep-equals `{answers: X}` (no `recount`, `problems` = `["no-reports"]`), the stored `answers` of the tenant key deep-equal `X`, `responseBody` = `directPost` of `X` (mutants P21, P24) | — |
| 3 The two colour schemes are different and readable | 4.4 (`themes`), WCAG table | `themes` | controls first (21, 1, the 4.5 pair); `matchMedia('(prefers-color-scheme: dark)').matches` false then true; `body` `background-color` differs; contrast of `body` text on `body` background ≥ 4.5 and of `[data-part="intro"]` text on its effective background ≥ 4.5, in both schemes | — |
| 4 The keyboard alone works | 4.4 (`keyboard`), `tabTo`, `focusInfo` | `keyboard` | only `press` calls (Tab, Shift+Tab, Enter, Space) after the load, one `reload` and no mouse call; the path of F16/F17 ends on `[data-action="restart"]` and (extra) Enter on it opens question 1 and leaves `localStorage` empty; after every change of screen `document.activeElement` is inside the new `[data-screen]`; on question screens `#live` text equals the visible progress line, on the card it is non-empty; every control reached by Tab (the language buttons, start, continue, restart, the radio or the field, back, next) has a ring (style ≠ none and width > 0, or a shadow; for a radio the row counts); the control: before the first Tab `body` has no ring | — |
| 5 Answers are kept, and only for their tenant | 4.4 (`storage`) | `storage` | after answers 1–3 and next, `reload` shows `continue`; `continue` opens question 4 (progress `Вопрос 4 из 12`); `localStorage` keys are exactly `["sai-picker:uchet-pro"]` (loop over `length` and `key(i)`), the value has exactly the five fields `format`, `version`, `lang`, `current`, `answers`: `format` 1, `version` a string of 64 hex digits equal to the questionnaire `version` (**not** searched for digit runs — the hash can hold seven digits in a row, F31, N1), `lang` "ru", `current` a question id of the questionnaire, `answers` ids and values from the questionnaire (option ids, a number inside `min`…`max`); **the «no free text, no contact data» check** is applied to the text `JSON.stringify({ lang, current, answers })` — the three parts the visitor can influence — and says: no `@` and no run of 7 digits (it was proven green on the real page for both tenants and three languages, F31); and to the whole stored text: no `@`. Controls, run before the page is touched: the same predicate is red for the invented strings `contact 87010000000` and `a@b.example` and green for the invented `{"lang":"ru","current":"tools","answers":{"items":120}}`; `sessionStorage.length` 0 and `document.cookie` empty; `back` ×3 shows the three answers selected; with a decoy key set, `restart` removes the tenant key and leaves the decoy (the keys are `["decoy"]`) | — |
| 6 Tenants are kept apart (Q8) | 4.4 (`isolation`), `exclusiveStrings` | `isolation` | per pair: the exclusive set of A has ≥ 10 members (control); after A's full pass the card of B has none of them in `textContent`, no `continue`, and the storage keys are `["sai-picker:<A>"]`; B's questionnaire answer (network record) and B's result answer after B's own `leader` pass hold none of them and none of A's solution names (read from A's file); `POST /t/B/api/result` with A's `leader` → status 400 and a body with no solution name of A; the stand's stderr has no `hasStack` line; `stop()` gives code 0. **As built — the reading of `decisions/0109` О17 as corrected, О19 and О20 (this row read «the card of B» before; pass 3 judged by that reading):** (a) the set of A's texts is built from A's questionnaire answer against **B's tenant file** in `ru`, ≥ 10 (control); (b) B's page is read on **every screen of B's pass** — the card, each question screen when it is shown and again after its answer, the result screen — in the text of the root element, `document.title`, **every attribute** of every element (`aria-valuetext` of the progress bar among them), the decoded address, the whole text of each element and each text node: a text or a solution name of A is looked for as a part, except a word of A that stands inside a text of B's file shown on that screen, which may stand only inside that text (today one, pinned: «человек» in «Есть отдельный человек», question 11, team, of `svet-marketing`); (c) B's two answers: every text of A as a part of every string value, except the one-word texts of A that stand inside a `ru` text of B's file («человек», «Средний» for `uchet-pro` → `svet-marketing`; «Обучение» for `agency` → `stock`; computed and asserted equal), which are compared with whole values; no solution name of A; the visitor texts of B's questionnaire answer equal B's file field by field; every string of B's answers is a string of B's file except the composed `version`, `lang`, `languages` (asserted by value); every key is a key of B's file or one of the 13 named fields, and no key holds a text or a name of A; (d) the error answer to A's set: 400, no solution name of A, the list rule, its 3 named keys; (e) **the requests of B's page** from the open of B's address to B's result: each goes to `/t/<B>/` or `/assets/<name>`, none under `/t/<A>/`, each record has its answer, the origin has no service worker registration, and what the page and its shared files got holds nothing of A (the search skips every answer under `/t/<B>/api/`, not only the two checked in (c): F7, `docs/issues/ISS-0106`); (f) the storage keys at B's card, no `continue`; stop code 0 and no stack line. Measured clean on the correct server in both pairs (steps 05g re-run 2, 05h, 09) | — |
| 7 A bad address | 4.4 (`not found`), `rawGet`, `sha256` | `not found` | four Chrome loads each status 404 and the line `Страница не найдена. / Бет табылмады. / Page not found.` in the page text; the raw `/t/%2e%2e/` status 404 and the line in the body; the five sha256 (the four `responseBody` texts re-encoded as UTF-8 and the raw bytes) are equal, and differ from the sha256 of the card document (control); the declared lines happen (four with their path, the favicon once); `/t/uchet-pro/` still opens a card; `stop()` gives `{code: 0}`; the `hasStack` controls (true for a stack text, false for the two negative texts of `E2S-20`) and then `hasStack(stand.stderr())` false | — |
| 8 A server that goes away (Q10) | 4.4 (`no connection`) | `no connection` | after the last answer, `stop()` gives code 0; the press of `show-result` shows `[data-kind="result"]` with the line `Нет связи. Ваши ответы сохранены. Попробуйте ещё раз.` and the button `[data-action="retry"]` «Повторить»; the focus is on that button; the press of it (the server still down) shows the same block; `localStorage` value equals the one read before the stop, byte for byte; exactly two entries of the declared refused-connection line; no other console entry (the kit's check) | — |
| 9 The new office stand opens | 4.4 (`v3`) | `v3` | for `agency` and `stock`, in `1470×784` light and `390×844` dark: the card opens (`[data-screen="card"]`, `<h1>` = `name`), a full pass with `leader` of `demo-answers-v3/<id>.json` reaches `[data-screen="result"]`, and the page's answer equals `directPost` | — |
| 10 Time and independence | 7, 13, 12 | none inside the spec (C-7); the scans `E2K-50` (extended to `picker.e2e.js`), `E2K-41` and `E2K-60` (extended: the budget 80000 and the table row) | RV: `cd tools && npm run -s e2e -- picker \| tail -n 1` → `exit=0`, `duration_ms` ≤ 80000, and the GitHub reading of section 7; the loop of REQ-104 criterion 7 over the nine names; `grep -nE '\.skip\(\|\.todo\(\|\|\| true' tools/test/e2e/picker.e2e.js` → no line; `cd tools && npm run -s traces \| grep -c 'tools/test/e2e/picker'` → 0; the order check of section 13; after every run of the series the leftover check `LEFT` of section 16 gives the number it gave before (0 on a clean machine) | — |
| (supporting) 7, 8, 10: the starter | 4.1, 4.3 | `E2S-01…E2S-20` | section 11.1 | RV: `cd tools && node --test test/e2e-stand.test.js` → exit 0 |

Every test above appears in a row, every criterion has a row (Q5). Controls (the check can see something): the 18 and the pairwise different tuples; the coverage completeness; the three result bodies pairwise different; the WCAG pins; `body` with no ring; the ≥ 10 exclusive strings; the card's hash differing from the 404 hash.

**As built — outside criterion 6, recorded (not read by `isolation`; `decisions/0109`, О19 «Not part of criterion 6», «Outside criterion 6» after О21, О22).** The response headers (the kit records only bodies; the server sets its headers from fixed values; mutant G04) and the number values of A (the set of criterion 6 is A's strings; G03b); text drawn by CSS generated content (`::before`, `::after`), into a canvas or by SVG images; text inside a shadow root and the document of an iframe of B's page (H6); the `value` property of a field; a second window or a dialog of B's page; A's `kk` and `en` texts (the set is built from A's questionnaire in `ru`, and B's pass runs in `ru`); what B's page sends in its requests (H8); B's own stored value after B's pass (H7) and the error answer pinned to its measured body (H5) — these two are the readings measured as possible and moved to `docs/issues/ISS-0106` (H5 carries a summary, not a solution name, so it is outside the letter of the criterion until that defect is closed). Known survivors of the test inside criterion 6, also moved to defects: a text of A that B's page adds later than the test reads a screen (probes T1–T3, О21) and a service worker that removes itself before the one reading at the end (H3, F8) — `docs/issues/ISS-0105`; the body search above (H1, H1b, F7) and a word of A split over two elements (H4, F9) — `docs/issues/ISS-0106`.

---

## 9. Order of work and the shared contract

- The only coupling between BACKEND-DEV and TEST-DESIGNER is 4.1 (options, members, codes, messages) and 4.3 (modes). TEST-DESIGNER reads `stand.js` and reports a divergence; it does not edit the kit.
- `stand.js` is written first; the README text second (it can be written at the same time, it is words); then the kit tests; the spec last, because it stands on the starter.
- The data the spec reads (`src/picker/demo-*`) is not changed; the server code, the page code, the tenant files are not changed (the requirement). A defect the spec finds is a WF-03 job on ORCH's order, and the criterion is not weakened.

---

## 10. README texts (agreed with `E2K-41`, `E2K-60` and `E2S-19`; AP-077)

`tools/README.md`, section `## End-to-end tests in a real browser` (the heading and the other items stay as REQ-104 made them):

1. The table becomes (the column widths are what `prettier` writes; run `npx prettier --write README.md` in `tools/`):

   | Spec file     | Requirement |
   | ------------- | ----------- |
   | picker.e2e.js | REQ-105     |
   | smoke.e2e.js  | REQ-104     |

   (alphabetical, as `listSpecs`), and the line after it becomes: `REQ-106 and REQ-107 add their rows.` The regular expression of `E2K-60` for the smoke row still matches; the token `REQ-105` stays in the section through the new row.
2. The sentence of the budgets becomes: "The budgets of `duration_ms` (REQ-104, criterion 9; REQ-105, criterion 10): `smoke` 30000, `picker` 80000, all files 240000."
3. A new paragraph before "How to write a spec": "Servers for the page specs: a spec starts the server it needs with `startStand` or `withStand` from `test/e2e/kit/index.js`. The server is a Node program started with an argument list; it gets a short list of environment variables (`PATH`, `TMPDIR`, `TEMP`, `TMP`, `LANG`, `LC_ALL`, `TZ`, `SystemRoot`) and what the spec gives, nothing else; the link is read from its stdout and must be an address of `127.0.0.1`; a state folder given to it must lie under the temporary root. `stop()` sends `SIGTERM` to the process group and requires the exit code 0. The server is stopped and removed on a failure, on a signal, and when the runner stops a hung file."

   *As built:* the paragraph in `tools/README.md` also says that the starter gives no `HOME` and does not hide the home folder (`decisions/0109`, О15), that the system and Node may add variables of their own (`__CF_USER_TEXT_ENCODING` on macOS, `NODE_V8_COVERAGE` when the spec process has it), and that `stop()` requires the exit code 0 **after that signal** and fails whatever the exit code when the server ended by itself before it (О14; L4 of REVIEWER, step 04).

Measured: the README edit of 1 passes `prettier --check` and leaves `E2K-60` and `E2K-41` green (F21). The new tokens (`startStand`, `withStand`, `80000`, the row regular expression for `picker.e2e.js`) are added to `E2K-60` by TEST-DESIGNER (section 12).

---

## 11. The tests

Every test is a top-level `test()`; no suites. Every test passes alone. Explicit `timeout`: 30000 ms.

### 11.1 `tools/test/e2e-stand.test.js` (runs in `npm test`; no Chrome; the stand-in speaks the link)

The file makes its own temporary root (`TMPDIR` set to a private folder before the first call, as `e2e-kit.test.js` does, so the `sai-e2e-*` lists of that file are not disturbed by this file running at the same time) and removes it in `after`. After a killed child it waits with a limit for `ESRCH` of the pid **and** of the group (the helper `waitGone` pattern of `e2e-kit.test.js`; never one immediate check, AP-144). "No process registered" is the helper `assertNothingRegistered` of the same file (`liveRegistrations()`: `groups` and `dirs` empty, `hooks` 0).

**The waiting rule (N13, AP-144, ISS-0103).** A test of this file never waits for a stretch of time and then looks; it waits, with a limit, for a **fact it can read**: (a) a pid and its group gone (`waitGone`, 5 s); (b) `isRunning()` false (5 s); (c) an event of the stand-in in its log, which the stand-in writes **before** the fact it announces (`start` before the link or the exit, `child-ready` before the link in `with-child`, `term` at the signal); (d) the `close` of a child process the test started (limit 20 s, then the test kills that child by pid and fails). The only elapsed-time assertions are three: `E2S-04` (under 1000 ms, against the 3000 ms the defect costs), `E2S-10` (1.4 s to 6 s around the configured 1500 ms; the lower bound proves the wait was the configured one) and `E2S-14` (under 3000 ms after `stopped`, against the 10000 ms the defect costs). Every test that starts a stand-in process kills the pids it learned from the log, in a `finally`, if they are still alive, so a red run leaves no process. The table's last column lists the mutants the test is the catcher of; a mutant is called "applied" only after a run of a test, a starter and a stand-in written from this text alone (section 16).

| Id | Test | Mutants |
|---|---|---|
| E2S-01 | normal start and stop with `ok` and `ok-late`: `url` is a loopback href (the address with the path cut: `http://127.0.0.1:<port>/`, since `readyPattern` captures the part before `/t/`), `origin`, `port` agree, `pid` set; `stop()` → `{code:0, signal:null}`; the group is gone (`waitGone`); the marker folder is gone; nothing is registered; `isRunning()` false | S15 |
| E2S-02 | option checks: a non-RegExp, a pattern with 0 or 2 groups, with `g` or `y`, a bad `name`, an empty or non-string `args`, a non-string `env` value → `USAGE`; the injected `spawn` was called 0 times | S14 |
| E2S-03 | state folders: the home folder, a relative path, a folder inside the repository, and a link inside the temporary root that points at the home folder → `PATH_REFUSED`, `spawn` called 0 times, no `sai-e2e-*` folder; a real folder under the root is accepted and exposed as its real path | S06 |
| E2S-04 | the program cannot start (a `cwd` that does not exist) → `STAND_START_FAILED` **within 1000 ms** (no wait for a group of an undefined pid, N8, F33); nothing is registered (a registered undefined pid would show as an entry of `groups`), no marker folder, `spawn` called once; a second start works | S20 |
| E2S-05 | the environment: the test sets `SAI_FAKE_LEAK`, `HOME`, `SAI_TEAM_REAL_RUNS` and (under `node --test`) `NODE_TEST_CONTEXT` in its own environment and gives `SAI_FAKE_STAND_LOG` and `SAI_FAKE_STAND_MODE`; the `env` event of the stand-in lists no name outside: the base list, the given names and **one named allowance, `__CF_USER_TEXT_ENCODING`** — a variable that macOS adds to every process by itself whatever the parent passes (F32); the starter does not give it, so it is a platform variable, not a leak; the allowance is that one name in a constant of the test with this reason in a comment, and no other name is allowed; none of the four leak names is in the list; a given `env` value reaches the child; a given value for a base name overrides | S10 |
| E2S-06 | `exit-early` → `STAND_START_EXITED`, the message holds `exit code 3` and `fake stand: cannot start, boom`; the pid is read from the `start` event of the log; pid and group gone (`waitGone`), marker gone, nothing registered; a second start works | S17 |
| E2S-07 | `hang` with `startTimeoutMs: 1500` → `STAND_START_TIMEOUT`; the pid is read from the `start` event of the log; pid and group gone within 5 s (`waitGone`); marker gone | S09 |
| E2S-08 | `foreign-link` with a generic pattern `/^(http:\/\/\S+?)\/t\//mu` → `URL_REFUSED`; the pid is read from the `start` event of the log; pid and group gone (`waitGone`) | S05 |
| E2S-09 | `exit-one`: `stop()` → `STAND_EXIT`, message holds `exit code 1`; not running; group and marker gone. (Also red under S01: `E2S-11` and `E2S-15`, which use `exit-one` and `die-later`.) | S01 |
| E2S-10 | `ignore-term` with `stopTimeoutMs: 1500` → `STAND_STOP_TIMEOUT` after about 1.5 s (between 1.4 s and 6 s); the log has exactly one `term`; the process is gone | S16 |
| E2S-11 | `stop()` called twice without an `await` between: the two return values are the same object (`===`), and after the stop the log holds exactly one `term`; for `die-later` the test first **waits for the fact** that the stand has ended by itself (`isRunning()` false, limit 5 s; the stand-in exits 300 ms after the link, and a `stop()` called before that would send `SIGTERM` and get code 0), then `stop()` throws `STAND_EXIT` with `exit code 5` and `on its own`, and the log has no `term`; group gone. *As built (`decisions/0109`, О14):* the same case with `quit-later`, which ends by itself with code **0**: `stop()` throws `STAND_EXIT` with the message `fake ended with exit code 0 on its own. …`, no `term` in the log; each stopped stand-in leaves no marker folder and nothing registered (mutant T09 of step 05 is red here) | S12 |
| E2S-12 | `noisy`: `stop()` → code 0 (the child was never blocked); `stdout()` and `stderr()` each ≤ 65536 characters and **each** ends with `END` (both streams, N11) | S04, S11, S18 |
| E2S-13 | `with-child` (4.3, N4, N13). The link is printed only after the child is ready, so the test needs no sleep and no extra wait: when `startStand` has resolved, the test reads the log and **holds**: a `child` event and a `child-ready` event with the same pid, and that pid is alive (`kill(pid, 0)`); only then `stop()`. It resolves `{code:0}`; then (`waitGone`, 5 s) the server pid and group and the child pid are gone. A `finally` kills the child pid with `SIGKILL` if it is still alive. Under the mutant S02 `stop()` throws `CLEANUP_FAILED` and the child is alive until the `finally` (F36, F38). *As built:* (1) (step 05, I2) the starter gets, through `deps.spawn`, the real child whose `exit` event is passed on only when the child has logged `child-term` (or after 5000 ms), so the final `SIGKILL` can come only after the child saw `SIGTERM`; the test asserts `child-term` with the child's pid (red under S19, which is therefore caught here); (2) (`decisions/0109`, О18 corrected, step 05e) a second stand in mode `ignore-term`, whose `deps.spawn` hands the starter `exit` (code 0) and `close` as soon as the log shows `term`: at the final `SIGKILL` the group still holds the stand-in, so one check right after `stop()` resolves that the group is gone, then the bounded `waitGone`; red under V12 without luck | S02, S19, V12 |
| E2S-14 | no timer outlives: a child `node` process (`--input-type=module -e`, a short inline module that imports the kit by its file URL) starts a stand with the default timeouts (`startTimeoutMs` 15000, `stopTimeoutMs` 10000), stops it, prints `stopped` and leaves its main code. The test reads the child's stdout; from the line `stopped` it waits for the child's `close` for at most 3000 ms (the fact), and if there is none it kills the child by pid and fails | S03, S21 |
| E2S-15 | `withStand`: the value of the body is returned; a body error is rethrown as the same object and the stand is stopped; with `exit-one` and a throwing body the stop error is `error.cleanupError`; with `exit-one` and a good body `STAND_EXIT` is thrown | S13 |
| E2S-16 | clean-up on the exits of a spec process: for each of five ways (`SIGTERM` to itself, `SIGINT`, `SIGHUP`, `process.exit(3)`, an uncaught throw) the test starts a child `node` process (inline module as in `E2S-14`) that starts a stand, **writes the stand pid to a file, and only then** ends in that way by its own act, so the handlers of `startStand` (step 4) are in place before it acts and the test has no race with the child. The test waits for the child's `close` (limit 20 s); the file is read after it; then the stand pid and group are gone (`waitGone`) and no `sai-e2e-*` folder is left | S07 |
| E2S-17 | the stand is the real picker: `startStand` with the arguments of 4.2 and `src/picker/demo-tenants`; `GET /t/uchet-pro/api/questionnaire?lang=ru` gives 200 and `name` `Учёт-Про`; `stop()` gives code 0; `stderr()` is empty. (It is not a catcher of S01: the picker exits 0, so a starter that does not check the code passes it; F40.) | — |
| E2S-18 | the runner's net: the fixture spec `sleep-stand.e2e.js` starts a stand, **writes the spec pid and the stand pid to the file named by `SAI_FIXTURE_PIDFILE`**, and sleeps; `runAll` with `fileTimeoutMs: 4000`, `killGraceMs: 500` and the stand-in Chrome for its preflight (as `E2K-43`), in two cases: the event loop free, and blocked with `Atomics.wait` (as `E2K-45`); both → `SPEC_TIMEOUT`; the file exists and holds both pids (the start of a stand, 0.1 s, against the 4000 ms limit: the same margin as the released `E2K-43`; a missing file fails with a message that names this cause); then the stand pid and the spec pid and their groups are gone (`waitGone`) and no `sai-e2e-*` folder is left | S08 |
| E2S-19 | the words and the files: `stand.js`, `fake-stand.js`, `sleep-stand.e2e.js` and this file — **these four, all of which exist from sub-step 3; the test reads no other file of the spec side (N12)** — hold none of the skip words, options, secret shapes or sandbox flags (assembled from parts, comments included); `stand.js` has no whole-environment read, reads only the named base variables, and does not name `NODE_TEST_CONTEXT`; imports are `node:` or relative; the two exports are in `index.js`; the README holds `startStand`, `withStand`, `80000`. `picker.e2e.js` is not read here: its skip words, options, secret shapes and environment reads are scanned by `E2K-50` (the `SCANNED` entry, made in 4a, F39), and its sandbox flags by `E2K-25` (it walks `tools/test/e2e`, so the file is covered from the day it exists, with no edit; it scans for the flags only) | R03 |
| E2S-20 | the stand-in's `stack` mode: `stderr()` holds the two lines, and the expression of `hasStack` (`/^[ \t]+at /mu`, written in this file as a pure function; **this file reads no other file**, N12) is true for them and false for two negative texts: `we arrive at the end` (`at ` inside a line) and **`note`, an empty line, `at start`** (an empty line followed by a line that starts with `at `, no blanks before it) — the second is the one that tells the right expression from the mutant with `\s` (N6; checked in node: right false, mutant true). The spec carries the same three texts as controls of its own `hasStack` (section 4.4), so the definition in the spec is tested where it lives | R07 (in this file) |

*As built 2026-11-16 (`docs/design/REQ-106-e2e-pixel-office.md`, sections 11.1 and 22).* The rows above are the tests as REQ-105 left them. REQ-106 edited `E2S-01` (`stand.stateEnv` and `stand.homeDir` in place of `stand.stateDirs`), `E2S-02` (`stateDirs` refused with `USAGE`, the rows of `stateEnv` and of `HOME` and `USERPROFILE` in `env`), `E2S-03` (the refused cases as values of `stateEnv`, `env`, `--dir` and `--dir=`, the temporary root in five spellings, through the spawn that records and throws), `E2S-05` (the parent's `HOME` is a decoy folder of the test; the child's `HOME`, `USERPROFILE` and `os.homedir()` are `stand.homeDir`; the environment compared by its shape first) and `E2S-19` (the README tokens `stateEnv`, `STAND_HOME_WRITTEN`, `50000` too), and added `E2S-21` (a private home per stand, `STAND_HOME_WRITTEN` and its precedence, the guard of the stand-in) and `E2S-22` (the step «outside the repository» of rule P): 22 tests in the file.

### 11.2 `tools/test/e2e/picker.e2e.js`

The nine tests of 4.4, their assertions in section 8. A test that is red names the combination or the pass in its message (language, scheme, window; set).

---

## 12. Replacement table of earlier guard tests

Measured on the clone of the tag with every new file present (F21, F22). The prohibition is not weakened in any row (AP-068, AP-112, AP-113).

| # | File, test | Line (tag) | Was → became | What the test counts | Evidence |
|---|---|---|---|---|---|
| 1 | `tools/test/e2e-kit.test.js`, `E2K-50` | 3767 (`SCANNED`), 3781 (`ENV_NAMES`), 3805 (`bareAllowed`) | `ENV_NAMES` gets `LANG`, `LC_ALL`, `TZ`, `TEMP`, `TMP`, `SystemRoot` (the base list of 4.1; `PATH` and `TMPDIR` are in it already); `SCANNED` gets `tools/test/e2e/picker.e2e.js` — **in sub-step 4a, in the same change as the file** (before the file exists the test fails with `ENOENT`: N3). `stand.js` is scanned already (`walk(KIT)`) | a list of names the kit may read and a list of files; the rule "no whole-environment read outside `find-chrome.js`, `browser.js`, `runner.js`" stays; "no computed key outside `cleanup.js`" stays; "`NODE_TEST_CONTEXT` only in `runner.js`" stays | red before the edit of the names with "`stand.js: reads TEMP`" (literal reads) or "the whole environment object" (a bare read); green after it (F21). With the `SCANNED` edit and no `picker.e2e.js`: red with `ENOENT` (F37); with both: green |
| 2 | `E2K-41` | 3368 | the words searched in the README section become `duration_ms`, `30000`, `80000`, `240000` | words in a README section | green in the full run (F21); after the edit it needs `80000` in the README (section 10) |
| 3 | `E2K-60` | 3865 | the tokens get `startStand`, `withStand`, `80000`; a second regular expression for the row `picker.e2e.js` / `REQ-105`; the sentence "REQ-105, REQ-106 and REQ-107 add their rows" is no longer there, so the three tokens `REQ-105`, `REQ-106`, `REQ-107` are found in the table row and the sentence | tokens and rows of the section | green before and after the README edit (F21) |
| 4 | `HC-02`, `HC-03`, `HO-54`, `PK-7b`, `LP-3`, `CTL-13` | — | none: `package.json` does not change | the steps of `scripts.check` | not touched |
| 5 | `E2K-34` (5 TAP texts, 10 spec fixtures), `E2K-50`'s "unscanned" rule for `tools/test/fixtures/e2e/` | 2599, 3852 | none: the new fixtures lie in `tools/test/fixtures/e2e-stand/` | counts of files in `tools/test/fixtures/e2e/` | green with the new folder present (F21) |
| 6 | `PK-8d` and the lint scan of `picker-page-static.test.js`, `handoffs-docs.test.js` `ownFiles`, `team-web-*` scans | 700, 101, 69 | none: they select by the prefix `picker-`, `handoffs-`, `team-web-`; the new names are `picker.e2e.js`, `e2e-stand.test.js`, `fake-stand.js` | files by prefix | `grep` of every `readdirSync` of `tools/test` (F22) |
| 7 | `repo.test.js`, `listing.test.js`, `picker-look.test.js` (`fixtures/picker`), `traces` tests | — | none | other folders | F22 |
| 8 | `E2K-02`, `E2K-25`, `E2K-01`, `E2K-09` | — | none: they pass with the new files present (the new files import only `node:` and relative modules; `E2K-25` already scans `walk(E2E)` for the two sandbox flags — and only for them: the skip words and secret shapes are `E2K-50`'s, over its `SCANNED` list, F39) | — | F21 |

The line numbers are those of the tag and are re-read by the developer. The requirement said "none"; the measurement says one red test and two words added, in `e2e-kit.test.js` only (rows 1–3): this is a difference from the block, recorded in section 19 (О9).

---

## 13. The order check on two real files (ISS-0102, item 2)

REQ-104 criterion 7 left it open: with one spec file the check "all names, last to first" shows one name. With `picker.e2e.js` and `smoke.e2e.js` the validator runs, from `tools/`:

1. `ls test/e2e/*.e2e.js | sed 's#test/e2e/##; s#\.e2e\.js##' | sort -r` → `smoke`, `picker` (last to first; **not** the alphabetical order, which is `picker`, `smoke`).
2. `npm run -s e2e -- smoke picker > out1.txt; echo "exit=$?"` → `exit=0`; `grep '^e2e: file=' out1.txt | sed 's/^e2e: file=//'` prints `smoke` then `picker`, line for line equal to step 1; `e2e: browser=` appears once; the last line is `e2e: command=npm run e2e -- smoke picker selection=smoke,picker exit=0 duration_ms=<n>`.
3. The reverse `npm run -s e2e -- picker smoke` prints `picker`, `smoke`.
4. `npm run -s e2e -- picker picker; echo "exit=$?"` → `exit=1` with `SELECTION_DUPLICATE` (unchanged).

Measured on the prototype (F24). The unit test `E2K-32` stays the pin of the order on fixture files; this adds the real-file reading. RELEASE-VALIDATOR writes the result next to ISS-0102 so that DOC-UPDATER closes item 2.

*As built (RELEASE-VALIDATOR, step 09, on the built files; `handoffs/E2E105-20261105-01/step-09-release-validator.json`, `self_check` «ORDER CHECK ON TWO REAL FILES»):* (1) `smoke picker`; (2) exit 0, `smoke` then `picker`, `e2e: browser=` once, `e2e: command=npm run e2e -- smoke picker selection=smoke,picker exit=0 duration_ms=33717`; (3) exit 0, `picker` then `smoke`, `duration_ms=33755`; (4) exit 1, `SELECTION_DUPLICATE`, `selection=picker,picker exit=1`. Item 2 of `docs/issues/ISS-0102` is met (its update of 2026-11-15); item 1 stays open.

---

## 14. Build sub-steps

"Red after it" is the list of tests of `npm test` and of the two kit files below that fail when the sub-step is done and the later ones are not. Every figure was measured on copies of the tag with the files of this work added step by step (the states S1, S2, S3, S4a; F37, F42); the check of the kit files is `cd tools && node --test test/e2e-kit.test.js test/e2e-stand.test.js` (before sub-step 3 `test/e2e-stand.test.js` does not exist and Node 22 ignores the missing path, so the figure is that of `test/e2e-kit.test.js` alone: 52 tests).

**BACKEND-DEV**

| # | Work | Red after it | BACKEND-DEV's own check (no test file of this work exists yet) |
|---|---|---|---|
| 1 | `stand.js`, the two exports in `index.js`, `fake-stand.js` | `E2K-50` only (names of variables; section 12 row 1). Measured: `cd tools && node --test test/e2e-kit.test.js` → `# tests 52`, `# pass 51`, `# fail 1`. Fixed by TEST-DESIGNER at sub-step 3. BACKEND-DEV leaves it red and says so in its handoff, as REQ-104 did for the guard tests of `check` | (a) **the real picker through the starter** (a one-line command, from `tools/`): `node --input-type=module -e 'import { startStand } from "./test/e2e/kit/index.js"; const s = await startStand({ name: "picker", args: ["src/picker/cli.js", "serve", "--tenants", "src/picker/demo-tenants", "--port", "0"], readyPattern: /(http:\/\/127\.0\.0\.1:\d+)\/t\// }); const r = await fetch(s.origin + "/t/uchet-pro/api/questionnaire?lang=ru"); console.log(r.status, (await r.json()).name, JSON.stringify(await s.stop()), JSON.stringify(s.stderr()));'` prints `200 Учёт-Про {"code":0,"signal":null} ""` and exits 0 (this is what `E2S-17` will be). (b) **the stand-in's order of events:** `SAI_FAKE_STAND_MODE=with-child SAI_FAKE_STAND_LOG=<a file under the temporary root> node test/fixtures/e2e-stand/fake-stand.js` prints the link, and the file holds the events `start`, `env`, `child-ready`, `child` in this order (the contract of `E2S-13`); stop it by the pid of `start`, then the child by the pid of `child`. After (a) and (b) the leftover check `LEFT` of section 16 |
| 2 | `tools/README.md` (section 10), then `npx prettier --write README.md` in `tools/` | `E2K-50` only, the same one (the README does not touch it): the same figures, 52 / 51 / 1; `E2K-41` and `E2K-60` stay green | `cd tools && npx prettier --check README.md` |

**TEST-DESIGNER**

| # | Work | Red after it |
|---|---|---|
| 3 | the edits of section 12 **rows 1 (the six names only), 2 and 3**, `e2e-stand.test.js` (`E2S-01…20`), `sleep-stand.e2e.js`. The `SCANNED` entry of `picker.e2e.js` is **not** made here (the file does not exist yet, N3) and no test of this work reads that file (N12) | none; `node --test test/e2e-kit.test.js test/e2e-stand.test.js` → `# tests 72`, `# pass 72`, `# fail 0` (52 + 20). With the `SCANNED` entry made too early: `# pass 71`, `# fail 1`, `E2K-50` with `ENOENT` |
| 4a | `picker.e2e.js`: the helpers that `matrix`, `pass` and `themes` use (a helper is written with the first test that uses it, so that no helper stands unused and `npm run lint` stays clean at every sub-step; `hasStack` and its controls come with `not found` in 4c), `matrix`, `pass`, `themes`; **and in the same change the `SCANNED` entry of section 12 row 1** | none; the same command → `# tests 72`, `# pass 72`; each spec test runs alone; `E2K-50` green with the file and the entry |
| 4b | `keyboard`, `storage` | none |
| 4c | `isolation`, `not found` (with the `hasStack` controls), `no connection`, `v3` | none |
| 4d | the independence loop, the mutant series (section 16), the order check (section 13), `npm run check` | — |

Full suite: `cd tools && npm test` is `# tests 2187` with `# pass 2186`, `# fail 1` after sub-step 2 (the red one is `E2K-50`), and `# tests 2207`, `# pass 2207`, `# fail 0` after sub-step 4a (2187 + the 20 tests of `E2S-01…20`; the nine spec tests are not in `npm test`, they are `npm run e2e`) (F42).

Each sub-step can be checked alone: sub-steps 1 and 2 by the check above; sub-steps 4a–4c by `npm run -s e2e -- picker` (the file runs with only the tests written so far). After every check that starts stands or browsers the leftover check `LEFT` of section 16 is run and must give the same number as before the check (N7).

### 14.1 Test × the first sub-step at which it can run (N12)

One row per test, built by reading every file each test opens (`reads`) and putting the file next to the sub-step that makes it. The rule that the table holds: **a test is first counted at the sub-step that makes the last file it reads.** "Released" files exist in the tag. The rows were checked by running the states S1, S2, S3, S4a (F37, F42); the only test that was wrong in the first form of this design was `E2S-19` (it listed `picker.e2e.js`), and `E2S-20` (it compared sources with the spec).

| Test | Reads (made by this work, with its sub-step) | Made at | First runs at | State there |
|---|---|---|---|---|
| `E2K-50` (the six names) | `stand.js` (1) | edit at 3 | 1 | red at 1 and 2 ("`stand.js`: reads TEMP"), green from 3 |
| `E2K-50` (the `SCANNED` entry) | `picker.e2e.js` (4a) | edit at 4a | 4a | green from 4a; made at 3: red, `ENOENT` |
| `E2K-41`, `E2K-60` (edited) | README section (2) | edit at 3 | 1 (unedited) | green at 1 and 2 with the old words, green from 3 with the new |
| `E2S-01`…`E2S-16` | `stand.js`, `index.js`, `fake-stand.js` (1) | 3 | 3 | green |
| `E2S-17` | `stand.js`, `index.js` (1); the released picker | 3 | 3 | green |
| `E2S-18` | `stand.js`, `index.js`, `fake-stand.js` (1), `sleep-stand.e2e.js` (3); released `runner.js`, `fake-chrome.js` | 3 | 3 | green |
| `E2S-19` | `stand.js`, `fake-stand.js` (1), `index.js` (1), README (2), `sleep-stand.e2e.js` and its own file (3) — **not** `picker.e2e.js` | 3 | 3 | green (the first form, with `picker.e2e.js`: red at 3, `ENOENT`, green at 4a) |
| `E2S-20` | `fake-stand.js` (1) — **no other file** | 3 | 3 | green |
| `matrix`, `pass`, `themes` | `stand.js` (1), the released picker and its demo data | 4a | 4a | green |
| `keyboard`, `storage` | the same | 4b | 4b | green |
| `isolation`, `not found`, `no connection`, `v3` | the same | 4c | 4c | green |
| the independence loop, the order check, the criterion 10 commands | `picker.e2e.js` complete (4c), `smoke.e2e.js` (released) | — (commands of RELEASE-VALIDATOR) | 4d | — |

---

## 15. Quality bar

| Item | Status | How it is met |
|---|---|---|
| Q1 | applicable | the change is REQ-105 (status `in_progress`); every criterion names its check (section 8) |
| Q2 | applicable | the producers (BACKEND-DEV, TEST-DESIGNER) are checked by SECURITY-REVIEWER, REVIEWER, TEST-DESIGN-VALIDATOR, RELEASE-VALIDATOR, each by its own run; this design is checked by CODE-DESIGN-VALIDATOR on a fresh clone |
| Q3 | applicable | every statement about the system is a measured fact (section 1) with its sketch; the runner time is marked an estimate (section 7) |
| Q4 | applicable | `picker.e2e.js` is found by `run.js` and is therefore a part of `npm run e2e`, the last step of `npm run check`; the starter's tests are in `npm test`; no step is added or removed |
| Q5 | applicable | a test for every criterion (section 8); the failure tests (`not found`, `no connection`, `E2S-03…11`) assert that the state did not change (storage value, groups, folders, spawn count); the tests do not depend on each other (one stand and one browser per test; the independence loop, F23) |
| Q6 | applicable | no skip, no todo, no `|| true`, no turned-off rule; `E2K-50` (the starter, and `picker.e2e.js` from sub-step 4a), `E2K-25` (the sandbox flags, over the whole folder) and `E2S-19` (the stand files and its own file) scan the new files, comments included; a missing Chrome fails (REQ-104) |
| Q7 | applicable | no key in any new file (secret shapes scanned); the stand gets no variable of the developer's shell but a named list; the spec writes no key into a page or a file; the answers, the language and the current question of the storage value are asserted to hold no `@` and no run of 7 digits (the version hash is not searched, F31), with controls that show the predicate sees a made-up phone number and address |
| Q8 | applicable | criterion 6: tenant B's page, network answers and storage show nothing of A, a foreign set is refused with an error answer, in both stands (`isolation`) |
| Q9 | not applicable | no query of any kind is written or changed |
| Q10 | applicable | criteria 7 and 8 (a bad address, a server that goes away), the starter's failure paths (section 5, `E2S-04…13`); every wait has a limit |
| Q11 | not applicable | the visitor supplies no address that the server visits; the kit opens only `http://127.0.0.1:<port>/…` (REQ-104 criterion 5); the starter's link is also passed through `assertLoopbackUrl` |
| Q12 | applicable | the departure points and the choices of section 2 are proposals for one record (О8); the design relies on `decisions/0107`, `0108` (О1: this run designs `stand.js`), `0023` D2 (lifted for these tests by 0107); it does not silently differ from them |
| Q13 | applicable | traps found here for `docs/anti-patterns.md` (DOC-UPDATER, from `result.issues`): an armed stop timer kept the file alive 10 s (F26); a criterion read as "inside the window" fails where the page is right (F8); a console line that a failing request writes is part of the failure (F13); a state kept by the page makes the second pass on one origin start from «Продолжить» (F10); and the four of the first gate (N1–N3, N7): an oracle written in a design and not run on the real data can be false (a hex hash holds digit runs), a test of a child's environment must allow the names the operating system adds, a path put into a scan list one step before its file exists leaves a red test, and a leak check by a name the leaked process does not carry sees nothing; and the three of the second gate (N12, N13, F40): the same mistake repeats in the neighbouring test that reads the same file (look for every reader of a file, not for the one named: table 14.1), a mutant that needs a second process to have done something is not caught until that process says it has (a readiness signal, not a sleep), and a "caught by" claim that was not run on a stack written from the text is a guess (S01 was given a test that is green under it) |
| Q14 | applicable | the statuses, `STATE.md`, `docs/issues/ISS-0102` (item 2), the handoffs are DOC-UPDATER's and ORCH's, in the same run; the list in section 17 |
| R1 | applicable | the release is pushed to `main` by RELEASE-FINALIZER only after PASS and with the owner's permission (`decisions/0048`); nothing is merged by this design |
| R2 | not applicable | no Pixel Office event is written or invented; the starter is built so that REQ-106's stand has no real home folder (C-1, `stateDirs`) |
| R3 | not applicable | the product with photos was dropped (`decisions/0033`) |

---

## 16. Mutants

**What "applied" means.** The mutant was put into a copy outside the project, the tests named in the table were run, and the red ones were read; a mutant is "applied" only for the form that the text of this design carries. For the **starter** (S) the step 01e sketch is a starter written from 4.1, a stand-in written from 4.3 and a test file written from 11.1, **each from the text of this design alone** — no wait, no helper and no form that the text does not state (F38, F40); the gate's own survivor S02 was found by exactly such a build. For the **product** (P) the prototype of the spec is used (it has fewer assertions than the final spec; a mutant caught there is caught by the final spec); P22 and P23 were applied with a matrix oracle written from section 8 (sketch `s18`). The **shared** mutants R04, R05, R06 and R08 change the spec itself; TEST-DESIGN-VALIDATOR applies them to the final spec ("to apply"). Expected cost: a mutant of the product takes one run of the spec (about 17–25 s); a mutant of the starter takes one run of `e2e-stand.test.js` (15–35 s); a mutant that makes a test hang is bounded by the 110 s limit of the harness (AP-140).

**The leftover check `LEFT` (N7).** A stand that leaks is a plain `node src/picker/cli.js serve …` or `node …/fake-stand.js`, with no `sai-e2e-` in its command line, so a check by that word sees only Chrome. The check sees the programs that were started and the folder of Chrome:

- `ps -axo pid=,command= | grep -E 'src/picker/cli\.js serve|fake-stand\.js|sai-e2e-' | grep -v grep | wc -l`
- `ls "$(node -p "require('os').tmpdir()")" | grep -c '^sai-e2e-'`

The second command gives 0 always; the first gives 0 on a machine with no picker server of the owner, and otherwise the same number before and after (take the list before the series and compare the pids). The child of the `with-child` stand-in is the same script with `--child`, so it is seen too. Proven (F30): a picker server started by hand → 1, after its `SIGTERM` → 0. The later requirements add the program of their own stand to the first pattern (`src/pixel-office/main.js`, `src/web/main.js`). `LEFT` is run after every mutant run and after the series, and a mutant that leaks (S02, S07, S08, S09, S16) is killed by the pids the check prints, after reading their command line.

**Mutants of the product (copy of `tools/src/picker`), caught by the spec**

| # | Breakage | Caught by | Status |
|---|---|---|---|
| P01 | the page does not set `document.documentElement.lang` | `matrix` (`html lang` of `kk`, `en`) | applied: red `matrix` |
| P02 | the dark block of `page.css` is switched off | `themes` | applied |
| P03 | a panel with a minimum width of 420 px | `matrix` (overflow at 390 and 320) | applied |
| P04 | dark text colour set to a dark value | `themes` (contrast) | applied |
| P05 | the focus ring of buttons and fields removed | `keyboard` | applied |
| P06 | a tenant id is looked up in lower case and accepts capitals | `not found` (`/t/UCHET-PRO/`) | applied |
| P07 | the 404 body repeats the path | `not found` (the five sha256) | applied |
| P08 | the stored value gets a sixth field (`phone`) | `storage` | applied |
| P09 | «Начать заново» clears the whole storage | `storage` (the decoy key) | applied |
| P10 | the answers are wiped when the network fails | `no connection` (byte equality) | applied |
| P11 | the page asks for the result in Russian whatever the language | `pass` (URL query, body equality) | applied |
| P12 | the focus is not moved to the result heading | `pass` | applied |
| P13 | every tenant address returns the first tenant | `isolation` (B's card shows A's strings) and, by the answer sets, `pass`, `keyboard`, `storage`, `no connection`, `v3`, `not found` | applied: 7 red; `matrix` and `themes` stay green because their oracles are read from the same server (a reason to keep `isolation` as the test for Q8) |
| P14 | the server answers the favicon with 204 | all nine (the declaration did not happen) | applied: 9 red |
| P15 | the server exits with code 1 after `SIGTERM` | all nine (`stop()`) | applied: 9 red |
| P16 | the server writes a stack to stderr on a 404 | `isolation`, `not found` | applied |
| P17 | the live region is never written | `keyboard` | applied |
| P18 | the focus is not moved to the question title | `keyboard` | applied |
| P19 | the lost-net text changed | `no connection` | applied |
| P20 | the public look of a tenant of format /3 throws | `v3`, `isolation` (second pair) | applied: red `isolation`, `v3` |
| P21 | the page sends an answer of a hidden question: both places that drop it are broken (`setAnswer` keeps hidden answers **and** `bodyAnswers` returns the raw answers) | `pass`, the `hidden` pass (request body deep-equal) | applied (F34 (b)): the body has `recount: weekly`, red |
| P22 | the card of the Kazakh page shows the Russian intro (the page asks for the Russian questionnaire when the language is `kk`; the name is the same in both, so only the intro tells) | `matrix` (`intro` oracle) | applied (F41, sketch `s18`): 6 combinations red (`kk` × 2 schemes × 3 windows), `ru` and `en` green |
| P23 | the start button wider than the window at 320 and at 390 | `matrix` (horizontal containment of the button; the overflow check is red too) | applied (F41): red in every `ru`, `kk`, `en` combination of 390 and 320 (24 of 36 checks) |
| P24 | `setAnswer` keeps the answer of a hidden question (the page prunes it only for the request) | `pass`, the `hidden` pass (the stored `answers` equal `X`) | applied (F34 (a)): the stored value has `recount`, the body does not; red on the storage assertion |
| P25 | the dark block of `page.css` applies only to windows of 400 px and wider | `matrix` (the colours grouped by scheme, N9) | applied (F35): 6 of the 9 dark combinations show the light colour, so the dark group has two values, red |

**Mutants of the starter (copy of `stand.js`), caught by `e2e-stand.test.js`.** Each row was run against the stack built from the text (F38, F40); "also red" lists tests that fail as a consequence and are not the catcher.

| # | Breakage | Caught by | Status |
|---|---|---|---|
| S01 | the exit code of `stop()` is not checked | E2S-09 (also red: E2S-11, E2S-15) | applied. **Not** E2S-17: the picker exits 0, so that test is green under S01 (F40) |
| S02 | no `SIGKILL` to the group after the main process ended | E2S-13 (the child ignores `SIGTERM` and is ready before the link) | applied (F36, F38): `stop()` throws `CLEANUP_FAILED`, the child stays alive until the test's `finally`; red in 8 of 8 runs. Without the readiness (the text before N13) green in 3 of 3 |
| S03 | the stop timer is not cleared | E2S-14 | applied: the child ended 10 s after `stopped` (F26) |
| S04 | stderr is not read after the link | E2S-12 | applied: `STAND_STOP_TIMEOUT` |
| S05 | the link is not passed through `assertLoopbackUrl` | E2S-08 | applied |
| S06 | the state folders are checked after the spawn | E2S-03 (spawn count) | applied |
| S07 | the group is not registered with `registerGroup` | E2S-16 (also red: E2S-18) | applied: the stand is left alive (killed by pid) |
| S08 | the call that notes the stand for the runner is omitted | E2S-18, the case with the blocked event loop | applied: the stand stays alive and the marker is left (killed by pid); the free-loop case stays green |
| S09 | a start timeout does not kill the process | E2S-07 | applied: the process stays alive (killed by pid) |
| S10 | the child gets the whole environment | E2S-05 | applied |
| S11 | the kept text is not cut | E2S-12 | applied |
| S12 | `stop()` is not idempotent (signals twice) | E2S-11 (the two returned values are not the same object) | applied |
| S13 | `withStand` throws the stop error over the body error | E2S-15 | applied |
| S14 | a pattern with the `g` flag is accepted | E2S-02 | applied |
| S15 | the marker folder is not removed | E2S-01 (the later tests that look at the folders are red too) | applied |
| S16 | no `SIGKILL` after the stop timeout | E2S-10 | applied: the process stays alive (killed by pid) |
| S17 | an exit before the link is reported as a timeout | E2S-06 | applied |
| S18 | stdout is not read after the link | E2S-12 | applied |
| S19 | `SIGTERM` to the leader only, then the final `SIGKILL` to the group | — | applied, **survives, equivalent** (N17): the main process ends, the final `SIGKILL` takes the group; the effect is the same. On record, not a gap. *As built:* **caught by `E2S-13`** (step 05, I2: the child's `exit` is held until it logged `child-term`, and the test asserts that `child-term`); red at steps 05, 05b and 05d |
| S20 | a start that has no `pid` waits for the group of that pid (3 s) or registers it | E2S-04 (under 1000 ms; nothing registered) | applied (N8 has its mutant, found by the sweep, F40) |
| S21 | the start timer is not cleared after the link | E2S-14 | applied (the stop timer has S03; the start timer of 15000 ms had no mutant) |
| S22 | `STAND_EXIT` is checked before `CLEANUP_FAILED` in `stop()` | — | applied, **survives: not testable** (N15). A process that survives the `SIGKILL` of its group cannot be made on a healthy system, and the design does not add an injected group-signal dependency to `deps` (a wider interface for one rule; the choice is put to ORCH in the handoff, with this reading by REVIEWER as the default). **REVIEWER reads `stand.js` against the precedence of 4.1 and 19.1 N11.** On record |

**Mutants of the shared places and of the spec itself**

| # | Breakage | Caught by | Status |
|---|---|---|---|
| R01 | the README row of `picker.e2e.js` is removed | `E2K-60` (edited) | applied (F39): `E2K-60` red |
| R02 | a skip word is put into `picker.e2e.js` | `E2K-50` (the `SCANNED` entry of 4a), the grep of criterion 10; a sandbox flag is caught by `E2K-25` (it walks `tools/test/e2e`). **Not** `E2S-19`, which does not read that file (N12) | applied (F39): `E2K-50` red; `E2K-25` red for the flag |
| R03 | `stand.js` reads the whole environment | `E2K-50`, `E2S-19` | applied: `E2K-50` red (F21); `E2S-19` red (F39) |
| R04 | `matrix` runs 17 combinations | its own counter (18) | to apply |
| R05 | `pass` drops the Kazakh pass | its coverage table | to apply |
| R06 | the contrast function uses 0.5 in place of 0.05 | the controls (21, 1, the 4.5 pair) | to apply |
| R07 | `hasStack` uses `\s` (crosses lines) | in the spec: the three controls of `not found` (4.4); in `e2e-stand.test.js`: `E2S-20` (the negative text with an empty line, then `at start`) | applied in node: right expression false, mutant true (both places use the same expression and the same three texts) |
| R08 | the raw request goes through `fetch` (so Chrome-style normalisation) | `not found` (the sent path equals the string) | to apply |

**Counts (AP-143).** `grep -c '^| [PSR][0-9][0-9] '` over this section gives 55 rows: P 25, S 22, R 8 (`grep -c '^| P'`, `'^| S'`, `'^| R'` over the section). Of them 53 have a catcher and 2 are survivors on record (S19, S22). 51 are applied in a sketch (P01…P25, S01…S22, R01, R02, R03, R07) and 4 are "to apply" (R04, R05, R06, R08). *As built:* all 55 were applied on the built files at step 05 (R04, R05, R06, R08 among them); 54 are caught (S19 by `E2S-13`, P06 in its two-place form) and 1 survives on record (S22).

**Survivors and informational cases on record.** (1) S19, equivalent (N17) — *as built: caught by `E2S-13`, see the row S19 and the table «As built» below*. (2) S22, not testable, read by REVIEWER (N15). (3) The equivalent mutant of the page below. (4) Q15 of the gate: changing the **English** text of the lost-net block survives, because criterion 8 is about the Russian text; it is informational and is not a mutant of this design (N17). (5) Q01c of the gate is the equivalent mutant below.

**Not a mutant (equivalent).** `bodyAnswers` returning the raw answers while `setAnswer` still prunes (F34 (c)) changes nothing the page can show: the stored value and the body are the same, so no test can see it. The page drops hidden answers in two places on purpose; the single-place breakages are P24 and, with both, P21. The unit tests of REQ-057 guard `bodyAnswers` by itself.

**As built — the mutant series of the run (each applied on copies outside the project by the step named; the lists and the results are in its handoff, `handoffs/E2E105-20261105-01/`).**

| Step (role) | Series | Applied | Result | Survivors and where they are recorded |
|---|---|---|---|---|
| 05 (TEST-DESIGNER) | the design list P, S, R; own T01–T11; variants S20b, R02b, R07b | 55 + 11 + 3, and P06a | all caught except S22; P06 caught in its two-place form | S22 — not testable, `decisions/0109` О13 (as corrected); P06a — a no-op (the route refuses capitals before the lookup, I4), not a survivor; S19 caught by `E2S-13` (I2) |
| 05b (TEST-DESIGN-VALIDATOR, pass 1, FAIL) | 53 rows of the design list; own V01–V17 and V20 (the code changed since the design); own W01–W06 (the product and the spec's oracles) | 53 + 18 + 6, and P06a | 52 + 16 + 4 red | S22 (recorded); W02 (F1, High), W01 (F2, Medium), V12, V13 (F3, Low) — fixed at step 05c; P06a a no-op |
| 05d (TEST-DESIGN-VALIDATOR, pass 2, FAIL) | 20 of the earlier lists; own W01-v3, W02-v3, P13-v3 and N01–N09 | 32 | 30 red | N05, N09 (F4) — fixed at step 05e; V12 red only in whole-file runs (F5) — made red without luck in `E2S-13` at step 05e (О18 corrected) |
| 05e (TEST-FIXER) | own O1, O1-v3, O2, O2-v3, O3, O3-v3, O4-v3, O5-v3, O6, O6-v3, O7 (each red only by the new checks of B's own strings) | 11 | 11 red, green on the file before the step | — |
| 05f (TEST-DESIGN-VALIDATOR, pass 3, PASS) | 10 named + V12; 5 of step 05e; own G01, G01-v3, G02, G03, G03b, G04, G05, G06, G08, G09 | 26, and a probe form of V12 | 18 red | G01, G01-v3, G02, G08 (F6, Low) and G05, G06 (I1, the reading О19) — red after the edit of step 05g; G04 (response headers) and G03b (number values of A) — outside criterion 6, О19 |
| 05g re-run 2 (TEST-FIXER) | 29 of the earlier lists; own A1, A2, A2b, A2c, A2d, A2f, A3–A5, A6, A6-v3, A6q, A7–A19; timing probes T1–T3 | 29 + 25 | 54 red (24 of the own ones green on the file without the new checks) | T1–T3 (a text added 300 ms after a screen appears) — green; `decisions/0109` О21, `docs/issues/ISS-0105` |
| 05h (TEST-DESIGN-VALIDATOR, the check of the edit, PASS) | 6 named of pass 3, 20 earlier, 8 of the A series, 14 of pass 1; own H1, H1b, H2–H8 | 48 + 9 | 48 + 1 red (H2) | H1, H1b (F7), H4 (F9), H5 (I1), H7 (I3) — `docs/issues/ISS-0106`; H3 (F8) — `docs/issues/ISS-0105`; H6 (an iframe, I2) and H8 (what B sends, I4) — outside criterion 6, О22 |
| 09 (RELEASE-VALIDATOR) | own RV01–RV21 (criteria 1–5, 7–10 and the starter) | 21 | 21 red (RV21 red only alone, by the independence loop) | none |

Survivors on record at the end of the run: S22 (not testable with Node alone, О13); T1–T3 and H3 (`ISS-0105`); H1, H1b, H4, H5, H7 (`ISS-0106`); G04, G03b, H6, H8 (outside criterion 6, О19, О22). V12 is caught (`E2S-13`, О18 corrected); S19 is caught (`E2S-13`).

---

## 17. What becomes outdated outside the project (for DOC-UPDATER)

- `tools/README.md`, the section "End-to-end tests in a real browser": the table row, the sentence "REQ-105, REQ-106 and REQ-107 add their rows", the budgets sentence (section 10).
- `docs/design/REQ-104-e2e-chrome-kit.md`: section 2 C-2 ("a starter … not in this kit; REQ-105 designs it") and the "As built" section 21 (the line about the second real file): a line pointing to this design; `decisions/0108` О1 is carried out.
- `docs/issues/ISS-0102-…`: item 2 (the order of two real files) is met by section 13; the item 1 survivors are unchanged.
- `docs/requirements.yaml`, block REQ-105: the words «title» (criterion 1), «inside the window» (criterion 1), «the kit reports none» (criterion 8), «Guard tests … none» (the paragraph on guard tests), after ORCH's answers to О2, О3, О4, О9; the status by DOC-UPDATER after PASS of RELEASE-VALIDATOR.
- `STATE.md`, `PLAN.md`, `docs/program/public-v1/PROGRESS.md` (not by this run), the list of defects, the mistakes journal (Q13 items), `docs/design/README` index if any.
- The root README sentence "about 2 minutes" for the check (ISS-0101) is older than this work and is not changed by it.
- The statements of REQ-106 and REQ-107 that "the starter of the spec" exists: they now point at `startStand` of this work.

---

## 18. Sketch notes (for `result.prototype`)

Outside the project, in `<scratch>/e2e105/` (the scratch folder of the session; no path of this computer is written here). **First pass:** `clone/` (a clone of the tag with `npm ci`; in it the prototype `tools/test/e2e/kit/stand.js`, `tools/test/e2e/picker.e2e.js`, the dummy `tools/test/e2e-stand.test.js`, the README edit and the `E2K-50` edit; the prototype's stand-in lay in the old folder `tools/test/fixtures/e2e/fake-stand.js` — **the final place is `tools/test/fixtures/e2e-stand/fake-stand.js`**, F37), `sk/` (the sketches `s1`…`s11`, the helper `lib.mjs` and `solver.mjs`, the mutant harness `mut.py`), `mut/` (the copy for mutants), `fulltest.txt` (the full `npm test` output of the first pass), `order1.txt`, `order2.txt`, `mut.out`. **First rework:** `sk/s12`…`s17`, `c1c/`. **Second rework (step 01e):** `c1e/` (a fresh clone of the tag in which the starter, the stand-in and `e2e-stand.test.js` were written **from the text of this design alone**, in the final folders), `c1s/` (a fresh clone in which the states S1, S2, S3, S4a are set up by `sk/states.py` and `sk/edits2.py`), `mutp/` (a copy of `tools/` for the product mutants P22, P23 with `sk/s18.mjs`), `mut_e.py` (the harness of the starter mutants, it restores `stand.js` after each), `full_s4a.txt`, `full_s2.txt` (the full `npm test` of the states S4a and S2). They are not part of the project and carry no state.

---

## 19. Open questions (for ORCH; proposal: one record `decisions/0109-e2e-stand-conventions.md` with the section "Basis", Q12)

| # | Question | Default used by the design | Cost of the other choice |
|---|---|---|---|
| О1 | The block REQ-105 has **ten** criteria, the handoff says nine (and "eight tests"): nine tests for criteria 1–9, criterion 10 by command | nine tests, as the criteria name them | none; only the numbers in the handoff text |
| О2 | Criterion 1 says the `<h1>` equals the tenant «title» of `GET …/api/questionnaire`; the field is `name` (F4). The tenant file has `name[<lang>]` | the oracle is `name`, and the tenant file's `name[<lang>]` as a second source | a micro-amendment of WF-01 to write `name`; the test is the same |
| О3 | Criterion 1 says «the start button lies inside the window»; at 320×568 in Russian and in Kazakh its bottom is 594 > 568 (in English it is inside) while the page does not overflow sideways (F8, N10) | horizontal containment plus "the whole rectangle is inside the window after it is scrolled into view"; the vertical reading is not asserted | to assert the vertical reading the page must change (a defect or a new requirement), which the requirement forbids in this run |
| О4 | Criterion 8 says «the kit reports none»; every failed request writes one console error (F13), and the kit fails an undeclared one | declare that exact line with `path`, assert exactly two entries | a change of the kit to ignore network errors (a weaker kit, no) or a micro-amendment of the wording |
| О5 | Criterion 4 «reaches `restart` of the card» by keys only: the card has it only after a reload with something saved (F17) | one `reload` through the kit (a protocol call, not an input event), then keys | none; a different path does not exist |
| О6 | The starter has no criterion in REQ-105; its 20 tests are supporting | listed under criteria 7, 8, 10 | a new criterion 11 by a WF-01 micro-amendment with the gate of REQ-VALIDATOR |
| О7 | The runner's list is fed with a marker folder made by `makeTempDir("profile")` (the name `sai-e2e-profile-…` is what `cleanup.js` trusts) | reuse, no change of `cleanup.js` | a rename to a shared name `sai-e2e-marker-…` is a change of a released file with its own tests (3 lines and 2 tests) |
| О8 | Record `decisions/0109-e2e-stand-conventions.md`: C-1 (the short environment list), C-2 (detached, registered, marker), C-3 (exit code 0 required), the five new codes, the starter's place, the fixtures folder `e2e-stand`, the base list names | proposed; ORCH writes it before gate 1b | without it the choices are disputable in review (Q12) |
| О9 | The block says "Guard tests of earlier requirements, «was → became»: none"; the measurement finds one red test (`E2K-50`) and two words to add (`E2K-41`, `E2K-60`) — all in `e2e-kit.test.js` (section 12) | the design edits those three tests as listed; the prohibitions stay | a stand with no whole-environment read and no new variable name is not possible without ignoring the environment, which breaks C-1 |
| О10 | `E2K-50`: the base list is read by named properties (six names added to `ENV_NAMES`) or by one whole-environment read in `stand.js` (the allowlist of files that read the whole object grows from three to four) | named properties | one bare read: fewer lines, a wider allowlist |
| О11 | The time limit is not asserted inside the spec (C-7); the line of 48000 ms on the runner (section 7) is the validator's | as stated | a self-timing `after` hook turns a slow runner into a red check on `main` |
| О12 | Mutants and AP candidates of section 15 (Q13) are recorded by DOC-UPDATER from `result.issues`; this run's write set is the design only | as stated | — |

### 19.1 Closed in the rework (the gate remarks N1–N11; not for the owner)

| Remark | How it is closed | Where |
|---|---|---|
| N1 (Medium) | the digit rule is applied to `lang`, `current`, `answers` only, not to the version hash; proven on the real page for both tenants in three languages; controls added | section 8 criterion 5, F31, Q7 |
| N2 (Medium) | `E2S-05` has the named allowance `__CF_USER_TEXT_ENCODING` with its reason, and still names the four leak names that must be absent | 11.1 `E2S-05`, F32 |
| N3 (Medium) | the `SCANNED` entry moves to sub-step 4a; the table of sub-steps states the red tests after each one; measured in four states (re-measured without a dummy test file in the second rework, F37) | sections 12, 14, F37 |
| N4 | the child of `with-child` ignores `SIGTERM`; S02 applied and red — **this closing did not hold** (the child gave no sign that it was ready; N13) and is replaced by the closing of N13 in 19.2 | 4.3, `E2S-13`, F36, F38 |
| N5 | a sixth pass `hidden`; P21 redefined (both places broken), P24 added (one place); the single-place `bodyAnswers` change is equivalent and named so | 4.4, section 8, F34, section 16 |
| N6 | `E2S-20` names the negative text with an empty line, then `at start` | 11.1 |
| N7 | the check `LEFT` by the program that was started; F30 corrected; used in sub-step checks, mutant runs and the criterion 10 row | sections 16, 14, 8 |
| N8 | with no pid nothing is registered, signalled or waited for; thrown at once; `E2S-04` bounds it at 1000 ms (and, from the second rework, has its mutant S20) | 4.1, section 5, F33 |
| N9 | `matrix` groups `body` colours by scheme over all windows and languages; mutant P25 applied and red | 4.4, section 8, F35 |
| N10 | «Russian and Kazakh» in section 0, F8 and О3 | — |
| N11 | `CLEANUP_FAILED` wins over `STAND_EXIT`; `noisy` ends both streams with `END`. The precedence cannot be forced with a real process (nothing survives `SIGKILL` of its group on a healthy system), so it is not a stand-in test: REVIEWER reads it in `stand.js` against 4.1, and the message rule (the exit code is in the text of `CLEANUP_FAILED`) is read the same way | 4.1, 4.3, section 5 |

---

### 19.2 Closed in the second rework (the gate remarks N12–N17 and the sweep; not for the owner)

| Remark | How it is closed | Where |
|---|---|---|
| N12 (Medium) | `E2S-19` lists four files that exist from sub-step 3 and reads no file of the spec side; `picker.e2e.js` is covered by `E2K-50` (the `SCANNED` entry, 4a) and for sandbox flags by `E2K-25` (it walks the folder). The table 14.1 lists every test with the files it reads and the sub-step that makes them; the sweep found a second test of the same kind, `E2S-20` (it compared sources with the spec), and it now reads no other file. Proven: the first form of `E2S-19` is red with `ENOENT` at S3 and green at S4a; the new form is green at S3 and S4a | 11.1, 14, 14.1, F39 |
| N13 (Medium) | the child tells that it ignores `SIGTERM` (`child-ready` in the log, the line `ready` to the parent); the parent prints the link only after that; `E2S-13` holds the two events and the live pid before `stop()` and has no sleep; the waiting rule of 11.1 states what each test waits for. Proven with a starter, a stand-in and a test written from the text: S02 red 8 of 8; the text before this rework (link without the child's signal): S02 green 3 of 3 | 4.3, 11.1, F38 |
| N14 | the figures of sub-steps 1 and 2 are 52 tests, 51 pass, 1 fail; of 3 and 4a, 72 / 72; full suite 2187 / 2186 / 1 and 2207 / 2207 / 0; BACKEND-DEV gets two checks of its own (the real picker through the starter; the order of events of the stand-in) | 14, F42 |
| N15 | row S22 in section 16: survives, not testable, read by REVIEWER | 16 |
| N16 | section 18 names the old and the final place of the stand-in and lists the sketches of the reworks | 18 |
| N17 | S19 named as equivalent; Q15 named as informational | 16 |
| sweep (a) | a claim of a catcher that is false: `S01` was given `E2S-17`, which is green under S01 (the picker exits 0); `R02` was given `E2S-19`, which no longer reads the spec, and `E2K-25` does not scan skip words | 16, F39, F40 |
| sweep (b) | traps of the starter with no mutant: a start without a pid (N8) and the start timer; they are S20 and S21 and are caught by `E2S-04` and `E2S-14` | 16, F40 |
| sweep (c) | waits that the text did not state: `E2S-11` (`die-later` needs the fact that the stand has ended before `stop()`), `E2S-06`, `E2S-07`, `E2S-08` (the pid comes from the log), `E2S-14` and `E2S-16` (the child's `close`, with a limit), `E2S-18` (the margin of the pid file) | 11.1 (the waiting rule) |
| sweep (d) | the product mutants P22 and P23 were marked "to apply" and are applied | 16, F41 |
| sweep (e) | every number recounted with a command | 0, F42 |

---

## 20. As to the sketches: what each shows

`s1` 18 combinations and their time; `s2` five passes and the equality with the direct POST; `s3` the markup of the question screen; `s4` the five bad addresses; `s5` the lost net; `s6` the themes and the focus ring; `s7` the keyboard path and the storage; `s8` isolation of both pairs; `s9` the starter through eleven modes of the stand-in; `s10` the runner's net for a blocked spec; `s11` noisy output and the unread-stream mutant; `mut.py` the product mutants; the prototype spec for the time and the independence loop. Rework (all in the same scratch folder, none in the project): `s12` the stored value of both tenants in three languages and the digit rule (F31); `s13` the environment of a started stand on macOS (F32); `s14` a spawn with a missing `cwd` (F33); `s15` the colour of the page per scheme and window, clean and with the mutant P25 (F35); `s16` the stand-in whose child ignores `SIGTERM`, with and without the mutant S02 (F36); `s17` the hidden-answer path and the mutants P21, P24 (F34); `c1c/` a copy of the clone for the four states of sub-steps 3–4a (F37), with `edits.py`. Second rework: `c1e/` the starter, the stand-in and `e2e-stand.test.js` written from the text alone, with the harness `mut_e.py` (F38, F40); `c1s/` with `sk/states.py` the states S1, S2, S3, S4a and the full `npm test` of two of them (F37, F39, F42); `s18` the matrix oracle of criterion 1 with P22 and P23 (F41).

---

## 21. As built (DOC-UPDATER, step 10, 2026-11-15; the design text above is not rewritten)

**Counts (read from the files at step 10; the commands from the root of Sai).**

- `tools/test/e2e/picker.e2e.js`: 1923 lines (`wc -l`); 9 top-level tests (`grep -c '^test(' tools/test/e2e/picker.e2e.js` → 9: `matrix`, `pass`, `themes`, `keyboard`, `storage`, `isolation`, `not found`, `no connection`, `v3`); 13 `test(` in all (`grep -o 'test(' tools/test/e2e/picker.e2e.js | wc -l`; the other four are `.test(` calls of regular expressions in `noContactData`, `hasBlank`, `assertRequestsOfB` and `hasStack`); 159 `assert.` (`grep -o 'assert\.' tools/test/e2e/picker.e2e.js | wc -l`).
- `tools/test/e2e-stand.test.js`: 20 tests, `E2S-01…E2S-20` (`grep -c '^test(' tools/test/e2e-stand.test.js` → 20), 211 `assert.`.
- `tools/test/e2e-kit.test.js`: 52 tests (`grep -c '^test($' tools/test/e2e-kit.test.js` → 52), the same number as on the tag; three of them edited (`E2K-50`, `E2K-41`, `E2K-60`, section 12).
- The starter and its fixtures: `tools/test/e2e/kit/stand.js` 456 lines, its two exports in `tools/test/e2e/kit/index.js`; `tools/test/fixtures/e2e-stand/fake-stand.js` 165 lines with 12 modes; `tools/test/fixtures/e2e-stand/specs/sleep-stand.e2e.js` 34 lines.
- `npm test`: 2207 tests (2187 on the tag and the 20 `E2S` tests); `npm run e2e`: 22 tests (`picker` 9, `smoke` 13). Read from the full checks of steps 06 and 09, here and on GitHub.
- Mutants: section 16, «As built — the mutant series of the run».

**Differences between the design and the built work** (the records: `decisions/0109` О13–О23 and the handoffs of the run).

1. Criterion 1: the oracle of the `<h1>` is the field `name` (О2; the word «title» of the criterion was corrected at step 10 as an outdated word); the start button is asserted inside the window horizontally and wholly inside once scrolled into view (О3: at 320×568 in `ru` and `kk` it lies below the first screen). Criterion 8: exactly the two declared refused-connection lines (О4). Criterion 4: one `reload` through the kit (О5). The words of criteria 1 (О3) and 8 (О4) in the requirement were not changed: that would change their meaning (a WF-01 micro-amendment).
2. The starter (`stand.js`) as built, beyond section 4.1: the outcome of a start is an explicit field, and a match whose capture group took no part is refused with `URL_REFUSED` (M1 of REVIEWER, step 04b); the child's `error` listener is attached before the pipes are touched (L1); `withStand` attaches no error to itself and protects the assignment of `cleanupError`, and rethrows a thrown `null` as it is (L2, I4); the two timeouts take whole milliseconds from 1 to 2147483647 (L5, step 04e); a child that sends `close` with no `exit` gives `STAND_START_EXITED` with code `null` (F5); a stand that ended by itself fails `stop()` whatever its code (О14). The same shapes of the released `browser.js` were not changed: `docs/issues/ISS-0109`.
3. The stand-in has the mode `quit-later` and the event `child-term` (section 4.3); `E2S-11` covers О14 and `E2S-13` holds the child's end until `child-term` (S19 caught) and has the case of О18 as corrected (V12 caught), section 11.1.
4. The test `isolation` reads criterion 6 by О17 as corrected, О19 and О20 (section 8, row 6; section 4.4, the helpers). The text of criterion 6 is not changed in this run (О23); the status note of REQ-105 points at those records.
5. `tools/README.md`, the paragraph «Servers for the page specs», says more than section 10 item 3 (section 10, «As built»).
6. The open questions grew from О1–О12 to О1–О23 (the addenda of `decisions/0109`).

**Outside criterion 6, and the known survivors of the test:** section 8, after the table («As built — outside criterion 6, recorded»).

**What is not proven (honest limits).**

- The runner: two samples of the same image (20035 and 22050 ms, section 7; AP-144). Every other run was on one Mac (macOS, Node 22.23.4, Chrome 157.0.8103.78); Linux only through the GitHub runner; Windows never.
- Criterion 6: on the correct system the test meets its letter and the readings of О17–О22; where it reads less than its letter while the system meets it (F7: a third answer under `/t/<B>/api/` would not be read; RELEASE-VALIDATOR's probe found exactly two there) and the classes it cannot see (T1–T3, H3) are in `docs/issues/ISS-0105` and `ISS-0106`.
- S22 (`CLEANUP_FAILED` before `STAND_EXIT`) cannot be forced with Node alone; REVIEWER read it in the code (О13 as corrected).
- The findings outside the change of the shared kit (the group registration of a leader that ended, the error shapes of `browser.js`) are in `docs/issues/ISS-0107` and `docs/issues/ISS-0109`; the folders that older test files leave in the system temporary folder in `docs/issues/ISS-0108`.
