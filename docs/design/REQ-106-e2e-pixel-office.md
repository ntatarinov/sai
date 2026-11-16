# REQ-106 — code design: end-to-end tests of Pixel Office in a real headless Chrome, and the change of the server starter `stand.js` that `decisions/0109` О15 asks for first

Run `E2E106-20261115-01`, WF-02 step 1; reworked in step 01c after the FAIL of the gate, pass 1 (`handoffs/E2E106-20261115-01/step-01b-code-design-validator.json`, findings F1–F13, issue I1, and the kit trap of issue I3); each edit carries its finding number in brackets, and section 21 lists them. The open questions of section 19 are answered by `decisions/0112-e2e-pixel-office-conventions.md`. Base: the tag `base/E2E106-20261115-01` (commit 85e79b0, the releases of REQ-104 and REQ-105). The block REQ-106 is in the tag; the working tree differs from the tag only in the status line of the block (`pending` → `in_progress`) and in `docs/program/public-v1/PROGRESS.md` (checked with `git diff --stat base/E2E106-20261115-01 -- . ':!handoffs'` and a `diff` of the block taken from the tag and from the tree: one line).

This file holds shapes, signatures, tables and texts. It holds no implementation code. Sketches lie outside the project (section 18); the words "the prototype" mean them.

**As built (DOC-UPDATER, step 10, 2026-11-16).** The design text is not rewritten: the places that the built work and the addenda of `decisions/0112` (О18–О25) changed carry a note «As built» (sections 0, 4.1, 4.4, 7, 10, 11.1, 12, 13, 16), and section 22 holds the counts read from the files, the differences and what is not proven.

---

## 0. Summary

- **What is built.** (1) A change of the released starter `tools/test/e2e/kit/stand.js` (REQ-105) that settles `decisions/0109` О15 before anything else: every stand gets a home folder of its own (`HOME` and `USERPROFILE` point to `<marker folder>/home` under the temporary root), a state folder reaches a server only through the new option `stateEnv` (checked pairs "variable → folder") or as an argument, every absolute path in `stateEnv`, in a value of `env` and in an argument (also after `=`, as in `--dir=<path>`) must lie under the temporary root and outside the repository, else `PATH_REFUSED` before anything is made or started; the old option `stateDirs` is refused; a server that wrote into its home folder fails `stop()` with the new code `STAND_HOME_WRITTEN`. (2) The stand-in `tools/test/fixtures/e2e-stand/fake-stand.js` gets the home of its `env` event and a mode `write-home`. (3) `tools/test/e2e/pixel-office.e2e.js`: seven tests — `isolated start`, `live`, `journal`, `mask`, `untouched home`, `reconnect`, `windows` — for the criteria 1–7; criterion 8 is proved by commands. (4) Edits of five released starter tests and three kit tests (section 12), two new starter tests `E2S-21` and `E2S-22` (the second pins the step "outside the repository" of the path rule, [F2]), and `tools/README.md`. (5) [F1] **Every call that is given the owner's real home folder or the real state folder — a refusal of the starter, of the hook helper, in test 1, in BACKEND-DEV's own check, under any mutant — gets an injected spawn that records the call and throws**, so that no regression and no mutant can start a process on a real folder (section 6, rule R2-S).
- **No file in `tools/src/` changes**, no npm package, no change of `package.json`: `run.js` finds `pixel-office.e2e.js` by its name (F21).
- **Events reach the page only through the real hook program** `/bin/sh src/pixel-office/hook.sh`, run by a helper of the spec with exactly three variables (`PATH`, `SAI_PIXEL_OFFICE_DIR`, `HOME`), both folders checked under the temporary root in the same call. The spec never writes the journal and never reads or names the real state folder except as a refused value (section 6).
- **Facts re-checked** (section 1): every fact of the block marked "checked on 2026-11-03" holds on the tag, with one precision of place: `prepareText` is defined in `mask.js` and called by `protocol.js` (F4, О11). Found beyond the block: the favicon line of the browser (F15), the server's own answer to a port held by another Pixel Office (F11), and that `os.userInfo()` still names the real home folder whatever `HOME` is (F13).
- **Time.** The prototype of the seven tests runs in 22177, 22168 and 21991 ms (`duration_ms` of the record line, this Mac; 23196 ms under four busy loops) against the limit of 50000; about 14.3 s of it are eight waits for the page's own poll of 2000 ms, which no machine makes shorter or longer. The runner was not measured for this file; section 7 estimates it at about 25 s, at most about 37 s, from the measured runner ratios of REQ-105, and says why that is an estimate. *As built:* the built file ran here in 21.7–21.9 s (the TAP time of the file; the record lines 22088–22304 ms quiet, 22506 and 22632 ms under three busy loops, the series of step 09), and the runner was measured at steps 06 and 09: 21337 and 21582 ms, under the 30000 ms question line (section 7, «As built»).
- **Sizes.** 8 criteria, 7 spec tests, 22 starter tests after the change (`E2S-01…22`), 7 build sub-steps (2 for BACKEND-DEV, 5 for TEST-DESIGNER, section 14), 66 mutants in section 16 (S 26, P 31, R 9; 64 applied in a sketch: 60 caught by the tests of this work, 4 survivors of the spec caught by named unit tests; R08 and R09 on record, R09 never to be applied), 17 open questions (section 19, answered by `decisions/0112`), 33 checked facts. Every count has its command in F30 (AP-143). *As built (counted from the files at step 10, the commands in section 22):* `pixel-office.e2e.js` has 1022 lines, 7 top-level tests and 102 `assert.`; `e2e-stand.test.js` 22 tests (`E2S-01…22`) and 272 `assert.` (247 in the prototype of step 01c); `e2e-kit.test.js` 52 tests and 537 `assert.` (535 on the tag); `stand.js` 619 lines; `fake-stand.js` 213 lines with 15 modes; `npm test` 2209 tests; the mutant list of section 16 is unchanged (66 rows), and the gates applied far more of their own (section 16, «As built»).

---

## 1. Checked facts

Measured on 2026-11-15 from 18:09Z (clock `date -u`), macOS arm64, Node v22.23.4, Google Chrome 157.0.8103.78. "Clone" means `git clone -b base/E2E106-20261115-01` into `<outside the project>/e2e106-01/clone`, then `npm ci` in `tools/`; "proto" is a second fresh clone of the same tag in which the prototype was written; "c1s" a third, for the sub-step states. Sketches lie in `<outside the project>/e2e106-01/sk/` (section 18). [F1, corrected] Every Pixel Office server of every trial had `SAI_PIXEL_OFFICE_DIR` and `HOME` under the temporary root. **Every hook did too, except one run of step 01 under the mutant R02**: the hook program ran once with `SAI_PIXEL_OFFICE_DIR` = the owner's real state folder (F31); it wrote nothing, and the five files of that folder are unchanged (F29, F32). From step 01c on, every call that names a real folder goes only to a spawn that records and throws (section 6, rule R2-S), and the R02 mutant was applied again in that form (F32).

| # | Statement | Command / sketch | Result |
|---|---|---|---|
| F1 | The tag holds the block REQ-106 with eight criteria, status `pending`; the tree differs in the status line only | `git show base/E2E106-20261115-01:docs/requirements.yaml`, the block cut by its id, `grep -c '^      - >-'`; `diff` against the block of the tree | 8; one line differs (`status: in_progress`) |
| F2 | "Checked on 2026-11-03": `POLL_MS` = 2000, `POLL_TIMEOUT_MS` = 3000, `MASK_LABEL` = `[скрыто]` in `tools/src/pixel-office/public/schema.js` | `grep -n 'export const POLL_MS\|export const POLL_TIMEOUT_MS\|export const MASK_LABEL' tools/src/pixel-office/public/schema.js` | `54:… MASK_LABEL = "[скрыто]"`, `83:… POLL_MS = 2000`, `84:… POLL_TIMEOUT_MS = 3000` — holds |
| F3 | "Checked on 2026-11-03": the connection words `LIVE` = «на связи», `NO_CONNECTION` = «Нет связи с сервером Pixel Office» in `public/texts.js` | `grep -n 'export const LIVE\|export const NO_CONNECTION' …/texts.js` | lines 11 and 12, as stated — holds |
| F4 | "Checked on 2026-11-03": the text of a task description is masked by the write protocol that the hook and the server share, before it is stored (`protocol.js`, `prepareText`) | `grep -n prepareText tools/src/pixel-office/{protocol,mask,hook,server}.js`; `git log -S'export function prepareText' -- tools/src/pixel-office/` | the meaning holds; the place is more precise: `prepareText` is **defined** in `mask.js:294` (since 596abbf, 2026-10-06) and **called** in `protocol.js:97` and `:176` (`buildWriteBody`, the hook side); the server masks again in `validateWriteBody` through `maskField` (`protocol.js:75`). О11 |
| F5 | "Checked on 2026-11-03": the plain names of roles are the table `ROLE_NAMES` (decision 0055) | `node -e` import of `public/texts.js` | 37 entries; `CODE-DESIGNER` → «Проект кода», `TEST-RUNNER` → «Запуск проверки»; `roleName` (`public/words.js:25`) translates only the form `Sai … (CODE)` (decision 0055, item 1). The table lives in `texts.js`; decision 0055 gives the rule of the form — holds |
| F6 | "Checked on 2026-11-03": the words of the rows are the README table "The journal in plain words" | `grep -n 'Агент «{роль}»\|Задание передано' tools/README.md`; `EVENT_TABLE` of `texts.js` | README lines 84–87: «Агент «{роль}» получил задание и начал работу», «… продолжил работу», «… закончил работу и вернул ответ», «Задание передано агенту «{роль}»»; the code holds the same words with `{role}` — holds |
| F7 | "Checked on 2026-11-03": the five files of "Where things are" | the README table; `STATE_FILES` of `tools/src/pixel-office/config.js:17` | `events.jsonl`, `server-starts.jsonl`, `write-secret`, `port`, `node-path` in both — holds |
| F8 | Pixel Office on a private state folder and a private home: the link line `Pixel Office: http://127.0.0.1:<port>/` in 71 ms; after the start the folder holds four files (`node-path`, `port`, `server-starts.jsonl`, `write-secret`; `events.jsonl` is made at the first event), modes 0600, the folder 0700; `server-starts.jsonl` has one row `{time, journal_lines: 0}`; the home holds nothing | sketch `s3-office.mjs` | as stated |
| F9 | The real hook with the two variables: exit 0, no stdout, no stderr, 76 ms; the line is `{time, source: "REAL", hook_event_name, session_id, agent_id, agent_type}`; `time` matches ISO 8601 UTC with milliseconds and lies between `Date.now()` read before the spawn and at its close; the server appends the line and then answers 204, and the hook waits for the answer (`server.js:329–330`, `hook.js` `post`), so when the hook has ended the line is in the file | `s3-office.mjs`; reading `server.js`, `hook.js` | as stated |
| F10 | `SIGTERM` ends the server with code 0 in 2 ms; a hook while it is down: exit 0, no output, 71 ms, the sha256 of `events.jsonl` unchanged | `s3-office.mjs` | as stated |
| F11 | A restart with `--port <the same port>` and the same folder works at once (a second start row); a start on a port held by **another Pixel Office** prints the same link line and ends with code 0 **without** writing a start row into its own folder (README "Start"; `main.js` `isPixelOffice`); a start on a port held by a **foreign** process ends with code 1 and the stderr line «Порт <n> занят другим процессом, это не Pixel Office. …» | `s3-office.mjs` (start 3 and start 4) | as stated; the restart test tells the three cases apart by facts (section 4.4, `reconnect`) |
| F12 | A relative folder is refused by Pixel Office itself: `--dir rel-folder` → exit 2 «ключ --dir требует абсолютный путь»; `SAI_PIXEL_OFFICE_DIR=rel-folder` → exit 1 «Переменная SAI_PIXEL_OFFICE_DIR должна содержать абсолютный путь»; no folder is made in `tools/` | `s3-office.mjs` | as stated; the starter's path rule covers absolute paths only (section 4.1) |
| F13 | Node's home lookup: a child started with no `HOME` gets the real home folder from `os.homedir()`; with `HOME=<a folder under the temporary root>` it gets that folder; `os.userInfo().homedir` gives the real home folder in both cases. `tools/src` asks the home folder only through `HOME` and `os.homedir()` (`pixel-office/main.js:93–95`, `hook.js:86`, `note.js:339`, `team/home.js:121`), never through `os.userInfo` | a `node -e` that spawns a child with and without `HOME`; `grep -rn 'userInfo\|homedir\|env.HOME' tools/src` | as stated: the private `HOME` covers every home lookup of Sai's servers; a server that asked `os.userInfo()` would still find the real folder (named in 4.1, "what the starter does not do") |
| F14 | The О15 premise on the tag: the starter gives no `HOME` (`E2S-05` asserts `HOME` absent from the child's variables), so a Pixel Office stand without `SAI_PIXEL_OFFICE_DIR` would resolve the real folder; and `stateDirs` is checked (`stand.js:284`) but not bound to the variables or arguments given to the child (`stand.js:289–291`) | reading `stand.js`, `e2e-stand.test.js:787` | holds (the dangerous start itself was not run, F29) |
| F15 | The page in a real Chrome (sketch `s4-dom.mjs`, the prototype starter): `#link-status` holds «на связи» after the first poll; a task is `#tasks .item[data-kind="task"]` with `.item-role` (the plain name) and `.item-state` («в работе», later «закончила работу, итог не записан»), keyed by `data-key` = the agent id; a journal row is `#journal > li` and its words are `.event` (the new rows at the bottom); `#journal-meta` ends with ` · <n> из <N>` (`JOURNAL_COUNT`); `#now` is shown and starts with «Сейчас»; `document.visibilityState` is `visible`; **the browser writes one console line `Failed to load resource: the server responded with a status of 404 (Not Found)` for `/favicon.ico` per start** (the server serves no icon); a hook event was on the page 1855 ms and 1755 ms after the hook ended | `s4-dom.mjs` | as stated; the favicon line is declared (О3) |
| F16 | The prototype of the seven tests, by the real command `npm run -s e2e -- pixel-office`, three runs: `duration_ms` 22177, 22168, 21991; per test (ms): `isolated start` 935/917/921, `live` 4837/4942/4838, `journal` 2829/2869/2834, `mask` 2826/2834/2824, `untouched home` 148/152/155, `reconnect` 8903/8827/8836, `windows` 1162/1163/1156. The eight waits for the page's poll, timed in two more runs (22288 and 22169 ms): `live` 1858+1863 and 1863+1861, `journal` 1702 and 1652, `mask` 1437 and 1436, `reconnect` the three rows 1695 and 1657, «Нет связи» 1977 and 2037, «на связи» 1889 and 1899, the new row 1963 and 1871 — 14384 and 14276 ms in all | `proto`, `sk/run1.txt`…`run3.txt`, `sk/waits1.txt`, `sk/waits2.txt` | section 7 |
| F17 | The independence loop of REQ-104 criterion 7 on the prototype: each of the seven names alone by `--test-name-pattern="^<name>$"` → exit 0, exactly one `ok ` line `ok 1 - <name>`, no `not ok` (the names with a space work) | the loop in `proto` | as stated; `LEFT` (section 16) 0 and 0 after it |
| F18 | The prototype of the starter change (section 4.1) with the edited starter tests (section 11.1): `node --test test/e2e-stand.test.js` → 21 tests, 21 pass; with the change and the **old** tests: `node --test test/e2e-stand.test.js test/e2e-kit.test.js` → 72 tests, 69 pass, 3 fail: `E2S-01` (`stand.stateDirs` is gone), `E2S-03` (`stateDirs` is refused with `USAGE`), `E2S-05` (the child's variables hold `HOME` and `USERPROFILE`) | `proto`, `sk/s1-stand-kit.txt`, `sk/s2-stand.txt` | section 12 |
| F19 | The 18 starter mutants of section 16 (S01…S18), each alone against the prototype and its tests: all 18 red, each in the test named there | `sk/mut_starter.py`, `sk/mut_starter.out` | section 16 |
| F20 | The product and spec mutants of section 16, each alone with the named tests run alone: 34 applied by the harness, 30 red (R06 red after the shape control of `keyShaped` was added; without it R06 survived, because the rule of long strings masks the 36 characters too); R03, R04, R07 applied by hand, red; the four that the spec does not catch are red in named unit tests: P07 (the server stores its own time) in `SV-04b`, P06a (the server does not mask again) in `MK-02`, P06b (the hook does not mask) in `HK-22`, `MK-01`, `MK-03`, P32 (the rule of `gh?_` keys removed; the rule of long strings still masks the text) in `HK-21` | `sk/mut_product.py`, `sk/mut_product.out`; `node --test test/pixel-office-server.test.js test/pixel-office-hook.test.js` on each | section 16 |
| F21 | `listSpecs` picks every file `^[a-z0-9][a-z0-9-]*\.e2e\.js$`, so `pixel-office.e2e.js` is run by `npm run e2e` and by `npm run e2e -- pixel-office` with no change of the runner or of `package.json` | `tools/test/e2e/kit/runner.js:24–37`; the prototype run | as stated |
| F22 | The guard search: the tests that read `tools/test/e2e`, the README section "End-to-end tests in a real browser" or the starter are `E2K-25`, `E2K-41`, `E2K-50`, `E2K-60` (`e2e-kit.test.js`) and `E2S-01…20` (`e2e-stand.test.js`); the scans of `tools/test` by name (`handoffs-*.js` in `handoffs-docs.test.js:101`, `picker-*.js` in `picker-config.test.js:881` and `picker-page-static.test.js:700`, `team-web-control*.test.js` in `team-web-control.test.js:1704`, `team-web-*.test.js` in `team-web-docs.test.js:69`) read its top level only and select by prefix [F9]; `E2K-01` (`e2e-kit.test.js:350`) walks the whole `tools/test` for the debugging-port word and allows it under `test/` (the new spec does not name it); `pixel-office-*.test.js` read `src/pixel-office/` and the README sections of Pixel Office; the check-script tests (`HO-54`, `PK-7b`, the two `scripts.check` matches) are not touched | `grep -rln e2e tools/test/*.test.js`, each hit read; `grep -rn readdirSync` of the Pixel Office tests | section 12 |
| F23 | Full suite in the state after BACKEND-DEV (the starter, the stand-in and the README changed; the tests as on the tag), clone `c1s`: `# tests 2207`, `# pass 2204`, `# fail 3`, `# skipped 0`, `# todo 0`, `# duration_ms 216559`; the three red are `E2S-01`, `E2S-03`, `E2S-05`; `E2S-02`, `E2S-19`, `E2K-41`, `E2K-60` stay green with the new README | `cd tools && npm test` in `c1s`, `sk/full_s1.txt` | sections 12, 14 |
| F24 | Full suite in the final prototype state (the starter, the stand-in, the README, the edited and the new starter test, the three kit-test edits, the spec and its `SCANNED` entry): `# tests 2208`, `# pass 2208`, `# fail 0`, `# skipped 0`, `# todo 0`, `# duration_ms 215761` (step 01: 2207 on the tag, + `E2S-21`); after the rework of step 01c (+ `E2S-22` and the edits of F1–F10): `# tests 2209`, `# pass 2209`, `# fail 0`, `# skipped 0`, `# todo 0`, `# duration_ms 249598`; the seven spec tests are not in `npm test` | `proto`, `sk/full_final.txt`, `sk/full_final_01c.txt` | section 14 |
| F25 | `npm run -s e2e -- pixel-office` under four busy loops (`node -e` endless loops, killed by their pids after the run) on this Mac: exit 0, `duration_ms` 23196; per test 1062, 4967, 2971, 2978, 250, 9055, 1313 ms; the waits for the poll the same as when quiet (1849, 1846; 2006, 1862, 1951) | `proto`, `sk/load1.txt` | section 7 |
| F26 | The order check on three real files (`proto`, the changed starter): `npm run -s e2e -- smoke pixel-office picker` → exit 0, the files in that order, `e2e: browser=` once, `duration_ms=55971` (`smoke` 13 of 13 in 16802 ms, `pixel-office` 7 of 7 in 21843 ms, `picker` 9 of 9 in 16387 ms — the picker spec is green on the changed starter); `npm run -s e2e -- pixel-office pixel-office` → exit 1, `SELECTION_DUPLICATE` | `sk/order1.txt`, `sk/order2.txt` | section 13 |
| F27 | Runner readings of REQ-105 for the picker file: 20035 ms (check.yml run 43723864463, step 06) and 22050 ms (run 43727151996, step 09) against 16.3–16.9 s on this Mac: ratios 1.21 and 1.35; for the smoke file 25539 and 34821 against 17462 (1.46 and 2.0) | `docs/design/REQ-105-e2e-picker.md`, section 7 «As built»; the handoffs named there | a reading of other files on other days (AP-144): section 7 uses it as a ratio, not as a fact of this file |
| F28 | The tag's counts: `e2e-stand.test.js` 20 tests (`grep -c '^test(' tools/test/e2e-stand.test.js`), 211 `assert.` (`grep -o 'assert\.' … \| wc -l`); `e2e-kit.test.js` 52 tests (`grep -c '^test($'`), 535 `assert.`; in the prototype: 21 tests, 234 `assert.` (step 01), 22 tests, 247 `assert.` (step 01c); 52 tests, 536 `assert.` | the clone and `proto` | the counts of section 12 do not fall |
| F29 | **The real state folder was not changed.** [F1, corrected] The files `events.jsonl` and `server-starts.jsonl` of the default state folder of this computer (README "Where things are"), measured with `shasum -a 256` and `stat` before the first trial of step 01 (2026-11-15T18:09:06Z) and after its last: the same hash and size each time (the values are in `result.self_check` of the handoff of step 01). This is a proof that nothing was written there, not that nothing reached the folder: one hook run of step 01 read it (F31) | `shasum -a 256`, `stat -f %z` | as stated |
| F31 | [F1, issue I1 of the gate] **What the mutant R02 of step 01 did.** The prototype's refusal call of the hook helper (`proto/tools/test/e2e/pixel-office.e2e.js`, the line `runHook(start("x", ROLE_A), { office: real, home: tempRoot() })`) passed the real state folder **with no injected spawn**, against this design's own words. R02 (`sk/mut_product.py`, the row `R02`) removed the two folder checks of `runHook`; the harness ran `isolated start` alone once, about 2026-11-15T18:35Z (`sk/mut_product.out`, line 29: `R02 RED … 0.2s … 'Missing expected rejection.'`). So `/bin/sh src/pixel-office/hook.sh` ran with `SAI_PIXEL_OFFICE_DIR` = the real state folder and `HOME` = the temporary root, and with the payload `SubagentStart` of the invented session `e2e106-sess-0001` and agent `x`. By the code of `hook.sh` and `hook.js` it read the real `node-path` and started that Node, read the real `write-secret` and `port` (4780), signed the body and posted it to `127.0.0.1:4780`; the connection was refused (no server listened: no Pixel Office of the owner was running then, and none is now — `lsof -nP -iTCP:4780 -sTCP:LISTEN` → no line), and the hook ended with code 0. It writes no file. Evidence that nothing changed: the five files have the same sha256, size and time of last change as before step 01 (F32; `events.jsonl` last changed on 2026-10-29). Had the owner's server been running, the invented event would have been signed with the real secret and appended to the owner's journal — the very thing R2 forbids. No other call of step 01 gave a real folder to a real spawn: the refusals of `startStand` in the prototype used a spawn that throws; `E2S-03` uses `countingSpawn(refusingSpawn)`, which throws; the starter mutants S01, S02 made the stand-in's home lookup the person's home folder, and the stand-in wrote nothing there (no `.fake-stand-note` or `.fake-stand-dir` in that folder, checked at step 01c before 2026-11-15T19:48Z) | the files of the sketch named; `shasum`, `stat`, `lsof` | the breach is recorded; rule R2-S (section 6) closes it |
| F32 | [F1] **Step 01c, the five files of the real state folder** (`events.jsonl`, `server-starts.jsonl`, `write-secret`, `port`, `node-path`), sha256, size and time of last change, before the first trial of step 01c (2026-11-15T19:46:10Z) and after its last: the same values (they are in `result.self_check` of the handoff of step 01c); the folder holds only these five. The mutant R02 applied again with the throwing spawn in the refusal call (a search of the spec for the refusal call with `{ spawn: throwingSpawn }` gave 1 before the run): `isolated start` red with `Error: a real folder reached the spawn` — the call was recorded and no process started (`sk/mut_r02_seam.out`) | `shasum -a 256`, `stat -f %z`, `stat -f %Sm`; `sk/mut_product.py R02` | as stated |
| F33 | [F2–F8, F10] The edited starter tests of section 11.1 (`E2S-01`, `02`, `03`, `05`, `19`, `21`) and the new `E2S-22`, against the prototype starter and the stand-in of 4.1–4.2: `node --test test/e2e-stand.test.js` → 22 tests, 22 pass (247 `assert.`); the 26 starter mutants S01–S26 each alone: 26 red, each in the test named in section 16 (`sk/mut_starter2.py`, `sk/mut_starter2.out`); P35 red in `reconnect` (`sk/mut_p35.out`); the spec with the throwing seam and the honest message of outcome (iii): `npm run -s e2e -- pixel-office` exit 0, `duration_ms=22053`; `isolated start` and `reconnect` alone exit 0, one `ok` line each; the full suite 2209 of 2209 (F24) | `proto`, the files named | sections 11.1, 16 |
| F30 | **Counts (AP-143), with the commands.** Criteria: F1. Spec tests: `sed -n '/^\*\*The seven tests\*\*/,/^## 5\./p' docs/design/REQ-106-e2e-pixel-office.md \| grep -cE '^[1-7]\. '` → 7. Starter tests after the change: section 11.1, 22. Mutants: `sed -n '/^## 16\./,/^## 17\./p' docs/design/REQ-106-e2e-pixel-office.md \| grep -cE '^\| [SPR][0-9]{2}[ab]? '` and the same with `^\| S`, `^\| P`, `^\| R`. Open questions: `sed -n '/^## 19\./,/^## 20\./p' docs/design/REQ-106-e2e-pixel-office.md \| grep -c '^| О'` → 17. Facts: `sed -n '/^## 1\. Checked facts/,/^## 2\./p' docs/design/REQ-106-e2e-pixel-office.md \| grep -c '^| F[0-9]'` → 33 (the table of section 21 also starts its rows with the names of the findings, so the count is taken over section 1 only) | this file | section 0 |

Statements of the requirement that were **checked and held**: the command and the link line of the server, the two variables of the stand and of the hook, the hook program `sh src/pixel-office/hook.sh` and the shape of its input, the time set by the hook, the five files, the words of the connection, of the rows and of the states, the mask label, the poll and its limit, the plain role names, `SIGTERM` → exit code 0, a hook while the server is down → exit 0 and no output. **More precise than the block** (each an open question, none settled silently): the place of `prepareText` (F4, О11); the favicon console line (F15, О3); the refused-connection lines while the server is down (О4); the server's answer to a port held by another process (F11, О5); the guard-test sentence "none" (section 12, О12). **Not measured, not assumed:** the time on the GitHub runner for this file (F27, section 7); the Linux behaviour of the private home (Node reads `HOME` first on Linux as on macOS by its documentation; the first GitHub run of the check is the measurement, section 7).

---

## 2. Design choices that could be disputed

| # | Choice | Default | Why | Question |
|---|---|---|---|---|
| C-1 | The private home is `<marker folder>/home`, not a second `makeTempDir` folder | yes | the marker `sai-e2e-profile-…` is already made, registered, removed at `stop()`, by the exit handler and by the runner's sweep (REQ-105 F27): the home inherits all three nets with no new code in `cleanup.js`; the count of `sai-e2e-*` folders the released tests read stays 1 per stand | О13 |
| C-2 | `stateDirs` is replaced by `stateEnv`, and a call that still names `stateDirs` fails with `USAGE` | yes | a folder that is checked but not given to the server proves nothing (О15); a silent alias would keep that hole open; the only caller is `e2e-stand.test.js` (the picker passes none) | О1 |
| C-3 | Every absolute path a caller gives — in `stateEnv`, in a value of `env`, in an argument, also after the first `=` — must lie under the temporary root, not be the root itself, and lie outside the repository; the first argument (the script) may instead lie inside the repository | yes | "check folder arguments the same way" (О15): a `--dir <real folder>` or `--dir=<real folder>` given by mistake is refused generically, without the kit knowing Pixel Office; the exemption is as narrow as its reason (a script is run, not written) and pinned by `E2S-03` | О1, О14 |
| C-4 | `stop()` fails with `STAND_HOME_WRITTEN` when the server left anything in its home folder | yes | the home is private and empty at the start, so anything in it is a write the server made through its home lookup — the very path that would reach the real folder without the private home; one rule for every stand (picker, Pixel Office, the team page) | О1 |
| C-5 | The hook is run by a helper of the spec, not by the kit; its home is a folder of the test (`makeTempDir("hook-home")`), not the home of the stand | yes | the starter does not start `sh` programs (REQ-105 4.1); in `reconnect` the hook must run while no stand exists; the helper checks its two folders in the same call as the spawn (section 6) and is itself checked by `isolated start` (an injected spawn records the command and the three variables) | О2 |
| C-6 | Seven tests: one per criterion 1–7, criterion 5 included (`untouched home`: what the spec can assert — the event lands in the temporary folder and both home folders stay empty); the hash of the real folder is RELEASE-VALIDATOR's, and the spec never reads the real folder | yes | the criterion names the measurement of RELEASE-VALIDATOR; a hash read inside the spec would turn red whenever a real Claude Code session writes during a check (agents run `npm run check` inside sessions whose hooks feed the real server) — a flaky test by construction | О6 |
| C-7 | The spec does not assert its own run time | yes | as REQ-105 C-7 (`decisions/0109` О11): a time assertion in a test is a flaky test (AP-144); the limit is read from the record line; the runner's watchdog (120 s) bounds a hang | О10 |
| C-8 | The role names are read from `ROLE_NAMES` of `src/pixel-office/public/texts.js` (an import of a data table), the words of the rows from the README table, the connection, state and mask words from the text of the requirement | yes | the requirement names the two sources so that the oracles are different; `ROLE_NAMES` is data, not a rule of the page; the words of the rows are not imported from `texts.js` | — |
| C-9 | The mask test reads more places than criterion 4 names: every attribute, `document.title`, the address, the storage of the origin, the answers of `/api/events` that the page got, the stdout and stderr of the server — besides `document.body.textContent` and `events.jsonl` | yes | AP-145 (1): list every place a leak can take and read each; the criterion's own places stay as it says | О8 |

---

## 3. Files, owners, order

Paths from the root of Sai. "New" = created by this work.

| File | Change | Owner | Sub-step |
|---|---|---|---|
| `tools/test/e2e/kit/stand.js` | changed — 4.1 (the private home, `stateEnv`, the path rule, `STAND_HOME_WRITTEN`) | BACKEND-DEV | 1 |
| `tools/test/fixtures/e2e-stand/fake-stand.js` | changed — 4.2 (the home of the `env` event, the mode `write-home`) | BACKEND-DEV (a stand, as in О6 of 0108) | 1 |
| `tools/README.md` | the section "End-to-end tests in a real browser": the budgets sentence, the paragraph "Servers for the page specs", the table row, the line after the table (section 10) | BACKEND-DEV | 2 |
| `tools/test/e2e-stand.test.js` | edits of `E2S-01`, `E2S-02`, `E2S-03`, `E2S-05`, `E2S-19`; new `E2S-21`, `E2S-22` (section 11.1) | TEST-DESIGNER | 3 |
| `tools/test/e2e-kit.test.js` | edits of `E2K-41`, `E2K-60` (section 12, rows 6, 7) | TEST-DESIGNER | 3 |
| `tools/test/e2e-kit.test.js` | `E2K-50`: `pixel-office.e2e.js` in `SCANNED` — made together with the file it names | TEST-DESIGNER | 4a |
| `tools/test/e2e/pixel-office.e2e.js` | new — the seven tests (4.4, 11.2) | TEST-DESIGNER | 4a–4c |

No file is written by two roles. `tools/src/`, `tools/package.json`, `tools/package-lock.json`, `tools/test/e2e/run.js`, `kit/runner.js`, `kit/cleanup.js`, `kit/guards.js`, `kit/browser.js`, `kit/page.js`, `kit/errors.js`, `kit/index.js` (the exports stay: `startStand`, `withStand`, `makeTempDir`, `removeTempDir`, `assertUnderTempRoot`, `tempRoot` are exported already), `.github/`, `decisions/`, the other blocks of `docs/requirements.yaml` are not changed.

**Words in comments (as REQ-104 and REQ-105, section 3).** The two sandbox flags and the skip words (`.skip(`, `.todo(`, `|| true`, `eslint-disable`, the options `{ skip`, `{ todo`) stand in no new or changed file, comments included (`E2K-25`, `E2K-50`, `E2S-19`, the grep of criterion 8). The key-shaped text of the mask test is built from parts at run time, so no file holds the shape `ghp_` + 16 or more letters and digits (`E2K-50` `SECRET_SHAPES`, the grep of criterion 4).

Order: the shared contract first (4.1, 4.2), then `stand.js` and the stand-in, then the README, then the starter and kit tests, then the spec.

---

## 4. Interfaces

All functions throw `E2eError` (`errors.js`) with a code from the table of REQ-104 4.1; text that a child process, a page or a file name controls goes through `safeText` before it reaches a message. No function of the stand prints.

### 4.1 `stand.js` — the change of the starter (О15)

`startStand(options, deps?) → Promise<Stand>`; `withStand(options, body)` is unchanged (it passes the options through).

| Option | Before (tag) | After |
|---|---|---|
| `name`, `readyPattern`, `cwd`, `startTimeoutMs`, `stopTimeoutMs` | REQ-105 4.1 | unchanged (`cwd` is not under the path rule: it is the folder the program runs in, default `<repoRoot()>/tools`) |
| `args` | strings without NUL, at least one | the same, and **the path rule P** on every element (below); the first element may instead be an absolute path inside the repository (the script; the stand-in of the starter tests is given so) |
| `env` | object of string values | the same, and: a name `HOME` or `USERPROFILE` → `USAGE` `startStand: env may not give <NAME>: the stand gets a home folder of its own`; **rule P** on every value |
| `stateEnv` | — | **new**, object `NAME → folder`, default `{}`. [F10] Not a plain object → `USAGE` `startStand: stateEnv must be an object`; a `NAME` that does not match `^[A-Za-z_][A-Za-z0-9_]*$` → `USAGE` `startStand: stateEnv name "<NAME through safeText, 40>" is not a variable name`; a `NAME` that is `HOME`, `USERPROFILE`, one of the eight base names or a name of `env` → `USAGE` `startStand: stateEnv may not give <NAME>`; a value that is not a string or holds NUL → `USAGE` `startStand: stateEnv value of <NAME> must be a string without NUL`; the folder must be **absolute** (`PATH_REFUSED` `not absolute`) and pass rule P. The child gets `NAME = <the real path>` |
| `stateDirs` | list of folders, checked, not given to the child | **removed**: an option object that has the key at all (also `[]`) → `USAGE` `startStand: stateDirs is replaced by stateEnv, pairs of a variable and a folder` |

**Rule P (a path of a stand).** A value is a path when it is an absolute path as a whole (`path.isAbsolute`), or when the part after its first `=` is (the form `--dir=<path>`). The path is then (1) passed through `assertUnderTempRoot` (absolute; the real path, links followed segment by segment), (2) refused when **the real path returned by (1)** equals `tempRoot()`, whatever the spelling of the value — a trailing separator, a trailing `.`, a `..`, a link to the root [F6] (`refused path "<value>": the temporary root itself`), (3) passed through `assertOutsideRepo` (`refused path "<value>": inside the repository`; on the machines of the runs the repository lies outside the temporary root, so this step decides only when a clone lies under it — pinned by `E2S-22` [F2]); every refusal is `PATH_REFUSED` with the reason of `guards.js`. The value the child gets is rebuilt from the **returned** real path (`<prefix>=<real>` for the second form). The exemption of the first argument: when it is an absolute path as a whole and lies inside the repository, it is kept as it is. A relative value is not a path for this rule (Pixel Office refuses a relative folder itself, F12).

The order inside `startStand` (nothing is "checked now, used later"):

1. `USAGE` checks of every option, `stateDirs` included; nothing is touched.
2. Rule P on `stateEnv`, then on the values of `env`, then on `args`; the checked values are kept in three new objects that the later steps use. Nothing is made or spawned before this point (criterion 1: 0 spawns).
3. The marker `makeTempDir("profile")`, then the home folder `<marker>/home` made with mode 0700 (it must be a new, empty folder). A failure of that `mkdir` → the marker removed, `STAND_START_FAILED` `could not make the home folder of "<name>": <code>`.
4. `spawn(process.execPath, <checked args>, { cwd, env: <base list> + <checked env> + <checked stateEnv> + { HOME: <home>, USERPROFILE: <home> }, detached: true, stdio: ["ignore", "pipe", "pipe"] })` — the two home names last, so nothing given can replace them.
5. Steps 4–7 of REQ-105 4.1 as they are (registration in the same block, both pipes read for the life of the process, the link through `assertLoopbackUrl`, the failure paths with the marker — and the home inside it — removed).

`Stand`:

| Member | Before | After |
|---|---|---|
| `name`, `pid`, `url`, `origin`, `port`, `stdout()`, `stderr()`, `isRunning()`, `exitInfo()` | REQ-105 4.1 | unchanged |
| `stateDirs` | frozen list of real paths | **removed** |
| `stateEnv` | — | frozen object `NAME → real path`, the values the child got |
| `homeDir` | — | the real path of the private home folder, `<marker>/home` |
| `stop()` | REQ-105 4.1 (+ `decisions/0109` О14) | the same, with one step more: after the wait for the group and `unregisterGroup`, **before** the marker is removed, the entries of `homeDir` are read (sorted; a read error gives the one entry `(not readable: <code>)`); then the marker with the home is removed. Precedence of the throws: `CLEANUP_FAILED` (a group alive or a marker left) > **`STAND_HOME_WRITTEN`** `<name> wrote into its own home folder: <the first five entries, ", " between them, through safeText, 200>` > `STAND_STOP_TIMEOUT` > `STAND_EXIT`. Only when none applies: `{ code: 0, signal: null }` |

New code: `STAND_HOME_WRITTEN` (the table of REQ-104 4.1 gets the row). Reused: `USAGE`, `PATH_REFUSED`, `STAND_START_FAILED`. The messages never hold the environment.

**What the starter still does not do:** it does not start `sh` programs; it does not restart; it does not read the state folders; it does not check `cwd`; it does not hide `os.userInfo()` (F13: no server of Sai asks it; a later one that did would be a new change of the kit); it does not judge relative values (F12); it does not change the group-registration shape of `docs/issues/ISS-0107` (section 20).

*As built (`tools/test/e2e/kit/stand.js` read at step 10; the gates of steps 03 and 04; `decisions/0112` О20).* (1) Rule P step (3) is given **the real path** returned by step (1), so its refusal names the real path, not the value as given: `refused path "<the real path>": inside the repository`; steps (1) and (2) name the value as given (BACKEND-DEV issue I4 of step 02, REVIEWER L3). (2) The exemption of the first argument is recognised by the reason text of `guards.js` (the message ends with `: inside the repository`, `REPO_REASON`), not by a code or an exported predicate; it fails closed (REVIEWER L1). (3) `stateEnv` (and `env`) is checked as "an object that is not a list", so a `Map` is taken as an empty object instead of `USAGE` (REVIEWER L2; against the row `stateEnv` above). (4) The header comment of `stand.js` says that every absolute path it is given is checked; `cwd` is not (REVIEWER L5). (5) Known limits recorded, not changed: only the part after the **first** `=` is a path for rule P; a relative value is never one; `cwd` is not checked (BACKEND-DEV issue I6, SECURITY-REVIEWER F3). Items (2)–(4) wait for the next change of the kit: `docs/issues/ISS-0111`.

### 4.2 The stand-in `tools/test/fixtures/e2e-stand/fake-stand.js`

- The `env` event becomes `{event: "env", keys: [...sorted names...], home: <os.homedir() of the stand-in>}`.
- New mode `write-home`: like `ok`; after the link it makes the folder `.fake-stand-dir` and the file `.fake-stand-note` in `os.homedir()` [F5: a folder, as Pixel Office would make `.sai-pixel-office`, and a file] **only when** that folder lies strictly under the real temporary root of the stand-in process (`fs.realpathSync(os.tmpdir())`, which the base list gives it), and appends `{event: "home-written"}`; otherwise it writes nothing and appends `{event: "home-refused"}`. So a starter mutant that gives no private home (S01, S02) makes the mode write nothing into the home folder of the person who runs the test; [F7] the guard itself is pinned by a direct run of the stand-in in `E2S-21` (mutant S25).
- [F4] Two more modes for the precedence of `stop()`: `write-home-exit-one` (as `write-home`, exits 1 on `SIGTERM`) and `write-home-ignore-term` (as `write-home`, ignores `SIGTERM`).
- The twelve modes of REQ-105 4.3 are unchanged (fifteen modes in all). TEST-DESIGNER may add modes; the ones above are the contract.

### 4.3 How the specs use it (invented values)

| Requirement | Call |
|---|---|
| REQ-105 | unchanged: `withStand({ name: "picker", args: ["src/picker/cli.js", "serve", "--tenants", "src/picker/demo-tenants", "--port", "0"], readyPattern: /(http:\/\/127\.0\.0\.1:\d+)\/t\//u }, …)` — no absolute path, no state folder; the picker writes nothing, so its home stays empty (measured: the picker spec 9 of 9 on the changed starter, F26) |
| REQ-106 | `{ name: "office", args: ["src/pixel-office/main.js", "--port", "<0 or the old port>"], readyPattern: /^Pixel Office: (http:\/\/127\.0\.0\.1:\d+\/)$/mu, stateEnv: { SAI_PIXEL_OFFICE_DIR: <office> } }`. The hook: 4.4 `runHook` |
| REQ-107 | `stateEnv: { SAI_TEAM_HOME: <folder> }`; `HOME` is the starter's; `SAI_TEAM_REAL_RUNS` is not in the base list. `SAI_TEAM_CLAUDE_BIN` pointing at a trap program inside `tools/test/fixtures/` (the words of its block) is an absolute path inside the repository in `env` and is **refused** by rule P: the design of REQ-107 copies the trap under the temporary root or asks for a pinned exemption (О14) |

*As built for REQ-107 (DOC-UPDATER, step 10 of run `E2E107-20261116-01`, 2026-11-16; the row above is not rewritten).* The design of REQ-107 took the first way and asked for no exemption: each test copies the trap and its scenario into its own folder under the temporary root (`decisions/0113` О3), `SAI_TEAM_CLAUDE_BIN` names the copy and is merged last into `env` by the spec's `teamOptions`, the scenario argument is the copy, `HOME` is the starter's, `PATH` comes from the base list and is never given in `env` (`decisions/0112` О22 holds). The starter did not change. Details: `docs/design/REQ-107-e2e-team-web.md`, sections 4.1 and 22.

### 4.4 `tools/test/e2e/pixel-office.e2e.js`

Top-level `test()` calls only, seven of them, in this order; each has `{ timeout: 30000 }`, makes its own two folders (`makeTempDir("office")` for the state folder, `makeTempDir("hook-home")` for the home of the hook), starts its own server (`startStand`/`withStand` with the options of 4.3) and, where it opens the page, its own browser (`withBrowser`); it shares nothing with another test and removes its folders in a `finally`. The session and agent ids are invented and start with `e2e106-` (RELEASE-VALIDATOR's search of the real journal, criterion 5 in section 8).

**Constants (the oracles of the words are the requirement's text, not `src`).** `LIVE` «на связи», `DOWN` «Нет связи с сервером Pixel Office», `WORKING` «в работе», `FINISHED` «закончила работу, итог не записан», `MASK` `[скрыто]`, `COUNT` (the text ` · 3 из 3` at the end of the meta line), the two roles `Sai Code Designer (CODE-DESIGNER)` and `Sai Test Runner (TEST-RUNNER)`. Console declarations: `FAVICON = { kind: "browser-log", text: "Failed to load resource: the server responded with a status of 404 (Not Found)", path: "/favicon.ico" }` with `expectOncePerStart` in every test that opens the page (F15, О3); `REFUSED = { kind: "browser-log", text: "Failed to load resource: net::ERR_CONNECTION_REFUSED", path: "/api/events" }` with `expect` in `reconnect` only (О4).

**Helpers** (functions and page-code strings of the file, none exported):

| Helper | Does |
|---|---|
| `officeOptions(office, port = 0)` | the options of 4.3 |
| `testFolders()`, `dropFolders(folders)` | the two folders of a test; `dropFolders` reads the entries of the home of the hook, removes both folders with `removeTempDir`, and then asserts that those entries were `[]` (so a red run leaves no folder) |
| `runHook(payload, folders, deps?)` → `{ code, signal, stdout, stderr, before, after }` | `async`; **in the same call, before the spawn:** each of `folders.office` and `folders.home` through `assertUnderTempRoot` and "not `tempRoot()`" (a refusal rejects with `PATH_REFUSED`, no process); then `spawn("/bin/sh", ["src/pixel-office/hook.sh"], { cwd: <tools>, env: { PATH: process.env.PATH, SAI_PIXEL_OFFICE_DIR: <the real path returned for folders.office>, HOME: <the real path returned for folders.home> }, stdio: ["pipe", "pipe", "pipe"] })` (`deps.spawn`: in `isolated start` only — the recorder of the good folders and the throwing spawn of rule R2-S for the refusal); writes `JSON.stringify(payload)` and ends stdin; `before` = `Date.now()` just before the spawn, `after` = `Date.now()` at the `close` event; waits for `close` at most 10000 ms (the hook ends itself after 1500 ms, `HOOK_HARD_EXIT_MS`), then kills the pid and rejects |
| `start(agent, role)`, `stop(agent, role)`, `handover(agent, role, description, n)` | the payloads of README "What of the hook input is stored": `SubagentStart`/`SubagentStop` with `session_id`, `agent_id`, `agent_type`; `PostToolUse` with `tool_name: "Agent"`, `tool_use_id`, `tool_input: { description, subagent_type }`, `tool_response: { agentId }`. No payload has a time field |
| `plainName(role)` | `ROLE_NAMES[<the code in the brackets>]` of `src/pixel-office/public/texts.js` (C-8) |
| `readmeWords(event)`, `readmeStateFiles()` | from `tools/README.md`: the Russian words of a row of the table of "The journal in plain words" (the second column before ` (the `), `{роль}` replaced by the plain name; the five file names of the table of "Where things are" (asserted 5) |
| `openPage(browser, stand)` | `expectOncePerStart(FAVICON)`, `newPage()`, `goto(stand.url)` → status 200, then `waitFor` until `#link-status` reads `LIVE` (10000 ms) |
| `TASKS` (page code, args `name`, `state`) | the number of `#tasks .item[data-kind="task"]` whose `.item-role` text **equals** `name` and `.item-state` text **equals** `state` |
| `WORKING_ROWS` | the number of task rows whose state equals `WORKING` |
| `EVENTS` | the texts of `#journal > li .event`, in order |
| `META`, `LINK_TEXT` | the text of `#journal-meta`; of `#link-status` |
| `NOW_SHOWN` | `#now` exists, is not `hidden`, has a rectangle of width and height above 0, `visibility` is not `hidden`, and its text starts with «Сейчас» (О9) |
| `SEEN` | page code: `document.body.textContent`, `document.title`, the decoded address, the value of every attribute of every element, and every key and value of `localStorage` and `sessionStorage` of the origin |
| `keyShaped()` | `["gh", "p", "_"].join("")` followed by 36 characters: the bytes 0…35 of the sha512 of a fixed made-up phrase, each taken modulo 62 into `A–Z a–z 0–9` (deterministic, pinned); controls: length 40, an upper and a lower letter and a digit, and the whole matches the shape `^ghp_[A-Za-z0-9]{36}$` written as a regular expression built from parts; `middle(key)` = its characters 14…25 |
| `lines(file)`, `sha256(file)` | the non-empty lines of a file (none for a missing one); the hex hash of its bytes |

**A trap of the kit for TEST-DESIGNER (gate issue I3).** `page.waitFor(source)` with no `args` evaluates `source` as an expression; a function written as the source with no `args` is itself a truthy value, so the wait ends at once and waits for nothing. Every page code of this file given to `waitFor` (and to `evaluate`) is either an expression (as `LINK_TEXT`, `EVENTS`) or a function **with** its `args` (as `TASKS`); a function without `args` is written as a called expression `(() => …)()`. The gate's own sketch fell into it in two waits (`mask`, `reconnect`) and still passed: in `mask` only the later assertions (mutant P05) and in `reconnect` only the next wait would have shown it.

**The seven tests** (what each does; the assertions are in section 8 by criterion):

1. `isolated start` — (a) **refusals, nothing started.** [F1] Rule R2-S of section 6 holds for every call of this part: each call that names the person's home folder or the real state folder gets a `deps.spawn` that **records its arguments and throws** — never `child_process.spawn` and never a counting wrapper of it — so that a regression or a mutant of rule P or of `runHook` makes the test red with the recorded call and starts no process. `startStand` with that spawn and, in turn, `stateEnv: { SAI_PIXEL_OFFICE_DIR: os.homedir() }`, the same with `<home>/.sai-pixel-office`, `env: { SAI_PIXEL_OFFICE_DIR: <home>/.sai-pixel-office }`, the arguments `--dir <home>/.sai-pixel-office` and `--dir=<home>/.sai-pixel-office` → each `PATH_REFUSED`; `env: { HOME: <a folder of the test> }` → `USAGE`; the throwing spawn called 0 times, and the `sai-e2e-*` folders of the temporary root the same before and after; `runHook` with `office` = `<home>/.sai-pixel-office` and the throwing spawn → `PATH_REFUSED`, the throwing spawn not called (under the mutant R02 the call is recorded and the rejection is the spawn's own error, so the test is red and nothing starts: F32); `runHook` with the folders of the test and a recording `deps.spawn` → the call is `/bin/sh`, `["src/pixel-office/hook.sh"]`, the tools folder, and `env` deep-equal to the three variables with the real paths. (b) **the stand:** `withStand`; `stand.homeDir` holds nothing; the state folder holds only names of `readmeStateFiles()`; `events.jsonl` has no line (missing or empty); `server-starts.jsonl` has 1 line; then `withBrowser` and `openPage`: «на связи», `WORKING_ROWS` 0.
   *As built (steps 05, 05c–05e; `decisions/0112` О18, О24; `tools/test/e2e/pixel-office.e2e.js`, lines 410–593).* (a) Six `startStand` refusals with the spawn that records and throws: the home folder in `stateEnv`, the real state folder in `stateEnv`, in `env`, after `--dir` and in `--dir=` → `PATH_REFUSED`; `HOME` in `env` → `USAGE`. Five `runHook` refusals with the same spawn: the real state folder as the office; a link to it as the office (made in a **third** folder of the test, `makeTempDir("links")`, which no server and no hook ever gets and which is removed in a `finally` before part (b); step 05c, issue I3); the person's home folder as the hook's home; the temporary root as the office and as the home (О18) → each `PATH_REFUSED`; then the spawn was called 0 times and the `sai-e2e-*` folders are the same. The recorded call is made with a recorder that also throws (no process), and with spellings that are not real paths — the state folder through a link in `links`, the home with a `..` (two controls assert that they differ from the real paths): it is `/bin/sh`, `["src/pixel-office/hook.sh"]`, the tools folder, and the environment is compared **by its shape first** (`envShape`: a plain prototype, no symbol keys, the names as `spawn` hands them over, also the inherited ones, exactly `HOME`, `PATH`, `SAI_PIXEL_OFFICE_DIR`, every other name only counted), then the three values one by one — `PATH` by a strict equality that does not print it, the two folders equal to their real paths (О24 F1 and F3; steps 05c, 05d, 05e). So a red run prints no other variable of the test process; one exception is on record (G1 of step 05f: under a mutant that hands the hook the `HOME` of the test process, the folder comparison prints that value; `docs/issues/ISS-0111`). The link cases are one link deep (G2, same defect). (b) As written above. Besides, `untouched home` and `reconnect` end with the names of the state folder inside `readmeStateFiles()`, and `reconnect` compares the whole listing of the state folder (names and sha256) before and after the hook run while the server is down (О24 F2).
2. `live` — one stand, one browser: `openPage`; set `window.__e2eMarker`; `performance.getEntriesByType("navigation")` has length 1 and its entry has `type` `navigate`; control: `WORKING_ROWS` 0; `runHook(start(A, role))` → code 0; from its `after`, `waitFor(TASKS, [name, WORKING], { pollMs: 100, timeoutMs: 5000 })`, and the elapsed time ≤ 5000 ms; `runHook(stop(A, role))`; the same for `[name, FINISHED]`; at the end the marker is still set and the navigation entries are still one, of type `navigate`.
3. `journal` — one stand, one browser: `openPage`; three hook runs for one agent — `start`, `start`, `stop` — back to back, each code 0; then `waitFor` until `EVENTS` has 3 texts (10000 ms); `EVENTS` equals, in this order, `readmeWords("SubagentStart (first)")`, `readmeWords("SubagentStart (repeated)")`, `readmeWords("SubagentStop")`; `META` ends with `COUNT`; `events.jsonl`: 3 lines, each valid JSON, kinds `SubagentStart`, `SubagentStart`, `SubagentStop`, `source` `REAL`, the one session and agent id, `time` matching `^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$` and lying in `[before, after]` of its own hook run.
4. `mask` — the key controls first; one stand, one browser: `openPage`; `SEEN` before: the control text is not there; six hook runs: agent A `start`, `handover(A, …, "Check <key> now")`, `stop`; agent B `start`, `handover(B, …, "Check the stock list now")`, `stop`; then `waitFor` until `EVENTS` has 6 texts and `document.body.textContent` holds both `MASK` and the control text (10000 ms); then the places of C-9 (section 8, row 4).
5. `untouched home` — one stand, no browser: one hook run of a start → code 0; `events.jsonl` of the test's folder has 1 line with the agent id sent (the event went to the temporary folder); `stand.homeDir` and the home of the hook hold nothing; `stop()` → `{ code: 0, signal: null }` (so `STAND_HOME_WRITTEN` did not fire); `stand.homeDir` is gone after it.
6. `reconnect` — one browser, declared `REFUSED`; the first stand (port 0): `openPage`; three hook runs (`start`, `start`, `stop`) and the wait for 3 rows; `first.stop()` → `{ code: 0, signal: null }`; `waitFor` `LINK_TEXT` = `DOWN` (10000 ms), then `EVENTS` still 3; the sha256 of `events.jsonl`; a hook run → code 0, stdout and stderr empty; the sha256 the same. The restart: `startStand(officeOptions(office, first.port))`, and **at once, before the page is read**, the identity of the server (below); then `waitFor` `LINK_TEXT` = `LIVE` and `EVENTS` = 3 (10000 ms); `server-starts.jsonl` has 2 lines; one more hook run (`stop` of the agent) and `waitFor` `EVENTS` = 4 with `pollMs` 100 and `timeoutMs` 5000; the second stand stopped with code 0.
   **The identity and a port taken in between (no wait by time, no retry).** Between the end of the first server and the bind of the second (about 2.1 s: the wait for «Нет связи» and the hook run) another process may take the port. The restart tells the three outcomes apart by facts it reads once: (i) our server bound the port — `startStand` resolved and `server-starts.jsonl` has 2 lines (the start row is written before the link line is printed, `server.js` `listen`, F11) → go on. [F8] The start-row count is the identity fact; the `port` file is not one (the first server wrote the same port) and the running state is not one either (the gate saw a second Pixel Office still running right after it printed the link); (ii) a foreign process holds it — `startStand` throws `STAND_START_EXITED` whose message holds the server's line «Порт <n> занят другим процессом» → the test fails with `the port <n> was taken by another process between the stop and the restart: <the message>`; (iii) `startStand` resolved (the link line is printed) but `server-starts.jsonl` still has 1 line → the test fails at once with `the restart printed its link but wrote no start row into this folder: either another Pixel Office holds port <n>, or this server did not record its start` [F8: both causes named, since a server of ours that fails to record its start looks the same — mutant P35], and the stand is stopped in the `finally` (its `STAND_EXIT` or its result is attached, not thrown over the first error). In none of them is the page of a foreign server read as if it were ours, and no case waits for a time or starts again on another port (О5).
7. `windows` — one stand, one browser, `expectOncePerStart(FAVICON)`, one tab: for `1470×784`, `390×844`, `320×568`: `setViewport`, `goto(stand.url)`, `waitFor` `LIVE`, `NOW_SHOWN` true, `browser.unexpectedEntries()` empty (no console error, no exception, the favicon line claimed); at the end `stop()` → `{ code: 0, signal: null }`, and `withBrowser`'s own check of the console.

---

## 5. Failure paths — what the user sees, what stays

| # | Situation | The user sees | State afterwards |
|---|---|---|---|
| 1 | `startStand` with `stateDirs`, with `HOME` or `USERPROFILE` in `env`, a bad `stateEnv` name or value | `USAGE` naming the option | 0 spawns, no folder |
| 2 | a folder or path outside the temporary root, the root itself, inside the repository, relative in `stateEnv`, or a link that points out — in `stateEnv`, in a value of `env`, in an argument (whole or after `=`) | `PATH_REFUSED` with the reason, before the marker | 0 spawns, no folder (criterion 1) |
| 3 | the home folder cannot be made | `STAND_START_FAILED` `could not make the home folder of "<name>": <code>` | the marker removed, nothing registered |
| 4 | the server wrote into its home folder | `stop()` throws `STAND_HOME_WRITTEN` with the first entries | the process group gone, the marker with the home removed, nothing registered |
| 5 | every failure path of REQ-105 section 5 (rows 3–15) | as there | as there; the home goes with the marker in each |
| 6 | the hook helper is given a folder outside the temporary root | `PATH_REFUSED` | no hook process |
| 7 | a hook does not end in 10000 ms | the test fails naming the hook | the hook is killed by its pid |
| 8 | the page does not show an event in 5000 ms | `WAIT_TIMEOUT` naming the awaited row and the last value | browser closed, server stopped, folders removed |
| 9 | the port is taken between the stop and the restart, or our server records no start on the restart | the messages of outcomes (ii) and (iii) of 4.4, test 6; (iii) names both causes [F8] | the first stand is gone; the second, if any, is stopped; folders removed |
| 10 | the server does not stop with code 0 | `STAND_EXIT` (REQ-105) | cleaned up |
| 11 | a console line that no declaration claims (a page error, an exception, a refused request outside `reconnect`) | `CONSOLE_ENTRIES` of the kit | cleaned up |
| 12 | the home of the hook holds something at the end | the assertion of `dropFolders` | the folders are removed after the message |

---

## 6. Protection in the same operation as the action

| Protection | Where it stands |
|---|---|
| A state folder, a path in `env`, a folder argument lies under the temporary root, not the root, outside the repository | `startStand`, step 2, before the marker and the spawn; the value the child gets is the returned real path |
| The server cannot reach the real home folder through its home lookup | `startStand`, steps 3–4: the home is made and given in the same call as the spawn, last in the environment |
| A write into the home is seen | `stop()`, after the group is gone and before the home is removed, in the same function |
| The hook writes only to the test's folder | `runHook`: the check of both folders and the spawn are one call; the environment is built there, from three named values |
| The restart talks to our server | `reconnect`: the identity facts are read right after `startStand` resolved, before the page is read |
| No orphan stand, no folder left | REQ-105 section 6 as it is; the home is inside the marker |

There is no "check now, act later in another call".

**Rule R2-S — a real folder never reaches a real spawn [F1].** Every call of this work that is given the person's real home folder or the real Pixel Office state folder of the computer — a refusal case of `startStand`, of `runHook`, of test 1, of `E2S-03` (it names the home folder and a link to it), of BACKEND-DEV's own check (b), and every run of a mutant of rule P (S05–S11, S19, S20, S24) or of `runHook`'s checks (R02) — passes a `deps.spawn` that records its arguments and throws, never `child_process.spawn` and never a counting wrapper of it. The reason: such a call is correct only while the check it tests holds; a regression or a mutant that removes the check must turn the test red with the recorded call, not start Pixel Office or its hook on the owner's folder (on 2026-11-15 R02 did start the hook on it, F31). A test that needs a real process (`E2S-05`, `E2S-21`, the spec's stands and hooks) gives the starter only folders of the test; `E2S-05` sets the `HOME` of its own process to a decoy folder of the test, not to the person's home. The starter mutants that change the home itself (S01, S02) can still make the stand-in's home lookup the person's home folder; the stand-in then writes into its home only under its guard (4.2), and the guard is pinned by `E2S-21` (S25).

---

## 7. Time budget (criterion 8: 50000 ms for `npm run -s e2e -- pixel-office`)

**What was measured (this Mac, macOS arm64, 10 cores).** The prototype of the seven tests, by the real command (F16):

| Run | `duration_ms` |
|---|---|
| 1 | 22177 |
| 2 | 22168 |
| 3 | 21991 |

Per test (ms, three runs): `isolated start` 917–935, `live` 4837–4942, `journal` 2829–2869, `mask` 2824–2834, `untouched home` 148–155, `reconnect` 8827–8903, `windows` 1156–1163 (sum about 21.6 s; the rest is the preflight browser and the start of Node).

**Where the time goes.** The page polls every `POLL_MS` = 2000 ms (F2); a new event is seen at the next poll. Eight waits of the file are waits for that poll: `live` 2, `journal` 1, `mask` 1, `reconnect` 4 (the three rows, «Нет связи», «на связи», the new row); `openPage` waits for the first poll, which the page makes at its load. Timed one by one (F16) they add up to 14384 and 14276 ms, and they are at most 8 × (2000 + the request and the 50 ms poll of the kit) ≈ 17 s. **This part is the product's own clock**: no machine makes it shorter or longer. The rest — about 7.9 s: six browser starts of the tests and the one of the runner's preflight (about 0.5 s each), the servers (about 0.1 s each), 17 hook runs (about 75 ms each, F9, F10), the reads — is work of the machine and grows on a slower one; under four busy loops on this Mac it grew to about 8.8 s (F25).

**The runner (an estimate, not a fact; AP-144).** This file was not run on the GitHub runner and cannot be from here without a push. The runner was 1.21 and 1.35 times slower than this Mac for the picker file and 1.46–2.0 times for the smoke file (F27): other files, other days. Applied to the part that grows: 14.3 + 7.9 × 1.35 ≈ 25 s (as the picker); 17 + 7.9 × 2.0 ≈ 33 s (the longest poll waits and the worst ratio); under the load factor 2.6 that eight copies of the picker file showed on this Mac (REQ-105 section 7) 17 + 7.9 × 2.6 ≈ 37 s. All are under 50 s; the lowest margin is 1.34 times.

| Where | Run | `pixel-office` |
|---|---|---|
| this Mac, quiet | 3 runs | 21991–22177 ms |
| this Mac, under four busy loops | 1 run (F25) | 23196 ms |
| this Mac, in the order check of three files | 1 run (F26) | 21843 ms (the TAP of the file) |
| GitHub runner | not run (no push from this step) | estimate 25 s, at most about 37 s |

**How the design keeps the file under the limit.** (1) A test waits for the poll only where the criterion asks to watch an event appear: `live` twice (two events, each timed); `journal` and `mask` run all their hooks first and wait once; `reconnect` four times (the criterion's four facts); `isolated start` and `windows` read the first poll, which the page makes at its load. (2) One browser per test, one tab, no second window. (3) `untouched home` needs no browser (0.15 s). (4) Every wait is `waitFor` with a condition; no sleep. (5) No timer of the starter or of the hook helper outlives its call (the hook helper clears its 10000 ms limit at `close`). Tests are not run in parallel inside the file (the independence loop reads top-level lines; a shared browser would couple the tests).

**The line.** [F13] TEST-RUNNER (step 6) and RELEASE-VALIDATOR (step 9) read the `duration_ms` of the `pixel-office` file in the `check.yml` run of the snapshot on the temporary branch `ci/…` (`decisions/0110`), before the push to `main` (the TAP of the file is in the job log, and the record line of the whole step), and write it; so a question comes before `main` gets the run. Above 30000 (60 % of the limit, the rule of `decisions/0109` О11) — a question to ORCH; above 50000 — the criterion is not met (О10). The spec does not assert its own time (C-7). The bound of a hang: 30000 ms per test, 120000 ms per file (`SPEC_TIMEOUT`).

**As built (measured; the estimate above stays as it was written).**

| Where | Run | `pixel-office` | Whole `e2e` step | Source |
|---|---|---|---|---|
| GitHub runner, `ubuntu-24.04` (image version 20261111.127.1), Chrome 157.0.8103.50 | check.yml run 43778880910 (step 06) | 21337 ms | `duration_ms=70688` | `handoffs/E2E106-20261115-01/step-06-test-runner.json` |
| GitHub runner, the same image and Chrome | check.yml run 43781322323 (step 09) | 21582 ms | `duration_ms=68869` | `handoffs/E2E106-20261115-01/step-09-release-validator.json` |
| This Mac, Chrome 157.0.8103.78, the series of step 09 | 4 quiet runs; 2 under three busy loops | records 22088–22304 ms (TAP 21682–21879 ms); 22506 and 22632 ms | — | the same |
| This Mac, in `npm run check` | steps 06 and 09 | 21782 ms; 21797 ms | `duration_ms=55905`; `56237` | the two handoffs |
| This Mac, the run around the measurement of criterion 5 | step 09 | record 22281 ms | — | step 09 |

Both runner readings are under the line of 30000 ms (21582 ms is 72 % of it and 43 % of the limit 50000), so there was no question to the owner (О10). The runner was about as fast as this Mac for this file (21337 against 21782 ms in the same kind of run, step 06), not 1.35–2.0 times slower as the estimate above assumed: the poll waits, which no machine shortens, are most of the file's time. Each runner reading is one sample of one image (AP-144); Windows was not run. On the runner `npm run e2e` spent about 14–17 s before its first file (step 06 issue I2, step 09 issue I8 item 3), outside the time of this file; the cause is not established.

---

## 8. Criterion → test

"RV" = a command that RELEASE-VALIDATOR runs itself. The names in the third column are the tests of `pixel-office.e2e.js`; `E2S-…` are in `e2e-stand.test.js`.

| Criterion | Element of the design | Test(s) | What it asserts (oracle) | Also by command |
|---|---|---|---|---|
| 1 The stand is isolated before any event (R2) | 4.1 (rule P, the private home, `stateEnv`), 4.4 (`isolated start`, `runHook`) | `isolated start`; supporting `E2S-01`, `E2S-02`, `E2S-03`, `E2S-05`, `E2S-21`, `E2S-22` | (a) the refusals of 4.4 test 1 each `PATH_REFUSED` (`USAGE` for `HOME`), every one through the recording, throwing spawn of rule R2-S [F1], which was called 0 times, no new `sai-e2e-*` folder; the hook helper refuses the real folder with no spawn; the recorded hook call has exactly the three variables with the real paths; (b) the server's link answers (`goto` status 200), «на связи» on the page, `WORKING_ROWS` 0, the state folder's names ⊆ the five of README (`readmeStateFiles`), `events.jsonl` with no line (missing or empty), `server-starts.jsonl` 1 line, `stand.homeDir` empty (it is the `HOME` of the server: `E2S-05` pins that the child's `HOME` and its `os.homedir()` are that folder) | RV: `ls tools/test/e2e/pixel-office.e2e.js` fails on the tag, passes now |
| 2 An event on the page in ≤ 5 s without reload | 4.4 (`live`) | `live` | the marker and one navigation entry of type `navigate` before and after; control: no task «в работе» before the hook; the row with the plain name (`ROLE_NAMES`) and «в работе» within 5000 ms of the hook's end, polled every 100 ms; then «закончила работу, итог не записан» within 5000 ms; each hook code 0 | — |
| 3 The journal says the right words, holds the right rows | 4.4 (`journal`), `readmeWords` | `journal` | `EVENTS` equal the three README words with the plain name, in order (the new rows at the bottom); `META` ends with ` · 3 из 3`; the file: 3 lines of valid JSON, kinds in order, `source` `REAL`, the sent session and agent id, `time` ISO 8601 UTC with milliseconds inside `[before, after]` of its own hook run (the payload has no time; that the server keeps the sent time byte for byte is `SV-04b`, F20, О7) | — |
| 4 A secret is masked on the page and in the file (Q7) | 4.4 (`mask`, `keyShaped`) | `mask` | the key controls (length 40, mixed, the shape); after the update: `document.body.textContent` holds `[скрыто]` and the control text verbatim, and holds neither the key nor its 12 middle characters; **the places of C-9** — `SEEN` (every attribute, `document.title`, the address, the storage of the origin), the bodies of every `/api/events` answer the page got (`network()`, `responseBody`), `stand.stdout()` and `stand.stderr()` — hold neither; `events.jsonl`: the count of the key and of the middle is 0, the control text and `Check [скрыто] now` are there | RV: `grep -nE 'ghp_[A-Za-z0-9]{16,}' tools/test/e2e/pixel-office.e2e.js` → no line |
| 5 The owner's real folder is not touched (R2) | 4.1 (the private home, `STAND_HOME_WRITTEN`), 4.4 (`untouched home`, `dropFolders`) | `untouched home`; every test (`dropFolders`; every `stop()` of the file passes the home check); supporting `E2S-21` | the event of the test lands in the temporary folder (1 line, the sent id); both home folders hold nothing at the end; `stop()` gives code 0, which it cannot while the server's home holds anything (C-4). [F12] **A reading:** "the `HOME` folder of the spec" is read as the `HOME` folders the spec gives — the private home of each stand and the home of the hook — not as the `HOME` of the spec process itself: that is the person's home folder, which holds the owner's real `.sai-pixel-office` by the design of Pixel Office, so a literal reading would fail on every machine where Pixel Office is used | RV: before and after `cd tools && npm run -s e2e -- pixel-office`, `shasum -a 256` and `stat -f %z` (Linux `stat -c %s`) of `events.jsonl` and `server-starts.jsonl` of the real state folder (or the fact that they do not exist) — equal. If they differ, a real Claude Code session wrote during the run: RV shows that none of the new lines holds `e2e106-` (`grep -c`) and names the session; the measurement is best made with no other session running. A search of the spec for words like «write» is not used (AP-120) |
| 6 A server that goes away and comes back (Q10, state unchanged) | 4.4 (`reconnect`) | `reconnect` | `stop()` code 0; «Нет связи…» within 10000 ms with the three rows kept; the hook while down: code 0, no stdout, no stderr, the sha256 of `events.jsonl` unchanged; the restart on the same port and folder, its identity (2 start lines; [F8] outcome (iii) names both causes), «на связи» and the three rows within 10000 ms, 2 start lines, a new event on the page within 5000 ms; the refused lines declared with their path (О4) | — |
| 7 Windows and errors | 4.4 (`windows`) | `windows` | in each of the three windows: «на связи», `NOW_SHOWN`, no unexpected console entry and no exception (the favicon line declared, О3); at the end `stop()` → `{ code: 0, signal: null }` | — |
| 8 Time and independence | 7, 13, 12 | none inside the spec (C-7); the scans `E2K-50` (`SCANNED` gets the file), `E2K-25` (walks the folder), `E2K-41`, `E2K-60` | RV: `cd tools && npm run -s e2e -- pixel-office \| tail -n 1` → `exit=0`, `duration_ms` ≤ 50000, and the GitHub reading of section 7; the loop of REQ-104 criterion 7 over the seven names; `grep -nE '\.skip\(\|\.todo\(\|\|\| true' tools/test/e2e/pixel-office.e2e.js` → no line; `cd tools && npm run -s traces \| grep -c 'tools/test/e2e/pixel-office'` → 0; the order check of section 13; `LEFT` (section 16) the same before and after | — |
| (supporting) 1, 5: the starter | 4.1, 4.2 | `E2S-01…E2S-22` | section 11.1 | RV: `cd tools && node --test test/e2e-stand.test.js` → exit 0 |

Every test above appears in a row, every criterion has a row (Q5). Controls (the check can see something): `WORKING_ROWS` 0 before the hook in `live`; the control text absent before the hook runs in `mask` and present after; the key shape controls; the counted spawns of the refusals and the recorded hook call; the identity facts of the restart.

---

## 9. Order of work and the shared contract

- The coupling between BACKEND-DEV and TEST-DESIGNER is 4.1 (options, members, codes, messages, the precedence) and 4.2 (the `env` event, the mode). TEST-DESIGNER reads `stand.js` and reports a divergence; it does not edit the kit.
- `stand.js` and the stand-in first; the README second; then the starter and kit tests; the spec last, because it stands on the changed starter (`stateEnv`, `homeDir`).
- The code and the page of Pixel Office are not changed (the requirement). A defect the spec finds is a WF-03 job on ORCH's order; the criterion is not weakened.

---

## 10. README texts (agreed with `E2K-41`, `E2K-60` and `E2S-19`; AP-077)

`tools/README.md`, section `## End-to-end tests in a real browser`; the heading and the other paragraphs stay:

1. The budgets sentence becomes: "The budgets of `duration_ms` (REQ-104, criterion 9; REQ-105, criterion 10; REQ-106, criterion 8): `smoke` 30000, `picker` 80000, `pixel-office` 50000, all files 240000."
2. The paragraph "Servers for the page specs" becomes (one paragraph): "Servers for the page specs: a spec starts the server it needs with `startStand` or `withStand` from `test/e2e/kit/index.js`. The server is a Node program started with an argument list; it gets a short list of environment variables (`PATH`, `TMPDIR`, `TEMP`, `TMP`, `LANG`, `LC_ALL`, `TZ`, `SystemRoot`), a home folder of its own (`HOME` and `USERPROFILE` point to a new folder under the temporary root, so Node's `os.homedir()` in the server gives that folder, never the home folder of the person; the spec cannot give these two) and what the spec gives, nothing else; the system and Node may add variables of their own, none of them given by the starter (`__CF_USER_TEXT_ENCODING` on macOS, and `NODE_V8_COVERAGE` when the spec process has it). A state folder reaches the server only through `stateEnv` (pairs of a variable and a folder) or as an argument; every folder of `stateEnv`, every value of `env` and every argument that is an absolute path, or holds one after `=`, must lie under the temporary root (not the root itself) and outside the repository, else nothing is started (`PATH_REFUSED`); the first argument, the script, may also be a path inside the repository. The link is read from its stdout and must be an address of `127.0.0.1`. `stop()` sends `SIGTERM` to the process group and requires the exit code 0 after that signal; if the server ended by itself before `stop()`, `stop()` fails whatever the exit code; a server that wrote into its home folder fails `stop()` with `STAND_HOME_WRITTEN` (decisions/0109). The server and its home folder are removed on a failure, on a signal, and when the runner stops a hung file."
3. The table becomes (the widths are what `prettier` writes; checked with `npx prettier --check README.md` in `proto`):

   | Spec file           | Requirement |
   | ------------------- | ----------- |
   | picker.e2e.js       | REQ-105     |
   | pixel-office.e2e.js | REQ-106     |
   | smoke.e2e.js        | REQ-104     |

   and the line after it becomes: "REQ-107 adds its row."

   *As built for REQ-107 (DOC-UPDATER, step 10 of run `E2E107-20261116-01`, 2026-11-16).* That line is gone: the table holds the row `team-web.e2e.js` | `REQ-107` after `smoke.e2e.js`, `E2K-60` asserts the absence of the words «adds its row» (`decisions/0113` О28), and the budgets sentence names `REQ-107, criterion 8` and `team-web` 70000 (`docs/design/REQ-107-e2e-team-web.md`, section 10).

Measured in `proto`: the edit passes `prettier --check`; with the kit-test edits of section 12 `E2K-41`, `E2K-60` and `E2S-19` are green; without them they are green too (the old tokens stay in the text; `REQ-106` is found in the row).

*As built (DOC-UPDATER, step 10, 2026-11-16; `decisions/0112` О20: REVIEWER L4 of step 04, SECURITY-REVIEWER F2 of step 03).* The paragraph of item 2 was built word for word at step 02 and then made more precise in `tools/README.md` in three places, the tokens of `E2K-41`, `E2K-60` and `E2S-19` kept: (a) `STAND_HOME_WRITTEN` is credited to `decisions/0112` (О1), and `decisions/0109` keeps the clause before it (a server that ended by itself, О14); (b) a state folder may also reach the server in a value of `env`, checked by the same rule P, besides `stateEnv` and an argument; (c) the limit of О16 is named: Node's `os.userInfo()` in the server still names the home folder of the person, whatever `HOME` is, and no server of Sai asks it. The text of item 2 above is not rewritten.

---

## 11. The tests

Every test is a top-level `test()`; no suites. Every test passes alone. Explicit `timeout`: 30000 ms.

### 11.1 `tools/test/e2e-stand.test.js` (runs in `npm test`; no Chrome)

The waiting rule of REQ-105 11.1 stays (a fact with a limit, never a stretch of time). The tests not listed are unchanged. "Was → became" for each changed one; the prohibition each guards is kept or made stronger.

| Id | Was (tag) | Becomes | Mutants |
|---|---|---|---|
| E2S-01 | line 471: `stand.stateDirs` deep-equals `[]` | `{ ...stand.stateEnv }` deep-equals `{}` and `stand.stateEnv` is frozen; `stand.homeDir` is `<the marker>/home` (its name `home`, its parent `sai-e2e-profile-…` directly under the temporary root of the file), mode 0700, empty while the stand runs; after `stop()` the folder count is 0 as before (the home went with the marker) | S14, S15 |
| E2S-02 | line 580: "stateDirs that are a string" → `USAGE` matching `/stateDirs/` | "stateDirs that are a string" and "stateDirs that are a list (`[]`)" → `USAGE` with the message `startStand: stateDirs is replaced by stateEnv…`; new rows: `env` with `HOME`, with `USERPROFILE`; `stateEnv` that is a list; `stateEnv` with `HOME`, with `TMPDIR`, with a name that `env` gives too, with a NUL in a value, with a number as a value, [F10] with a name that is not a variable name (`1BAD`), and a `stateEnv` that is a string — each `USAGE` with its exact message of 4.1; the spawn count 0 after all of them (as now) | S04, S16, S17, S18, S26 |
| E2S-03 | lines 650–700: the five refused cases as `stateDirs` (`PATH_REFUSED`, 0 spawns, no folder); a link and a `..` accepted, exposed as real paths in `stand.stateDirs` | the same five cases as values of `stateEnv` (relative included); the four absolute ones also as values of `env`, as an argument after `--dir`, and as `--dir=<path>` (12 more); the temporary root itself in `env`, and [F6] in `stateEnv` in five spellings — its real path, with a trailing separator, with a trailing `.`, as `<a folder of the test>/..`, and as a link to it — each with the reason `the temporary root itself`; [F3] the home folder after `=` in a value of `env` (`opt=<home>`); a first argument outside the repository and outside the root — each `PATH_REFUSED`, 0 spawns, no folder; accepted: `stateEnv` with the link, `env` with the `..` path and [F3] with `opt=<..path>`, the arguments `--state <link>` and `--state=<..path>` and a plain word — the recorded spawn has the real path in each place (`opt=<real>` in the `env` value), `stand.stateEnv` holds it (frozen), and the `start` event of the stand-in lists the real paths in its `argv`. [F1] Every refused case keeps the spawn `countingSpawn(refusingSpawn)`, which records and throws (rule R2-S) | S05, S06, S07, S08, S09, S10, S11, S20, S24 |
| E2S-05 | line 787: the leak names `SAI_FAKE_LEAK`, `HOME`, `SAI_TEAM_REAL_RUNS` must not reach the child; the given env deep-equals base + given | the leak names `SAI_FAKE_LEAK`, `SAI_TEAM_REAL_RUNS` (and `NODE_TEST_CONTEXT`) must not reach the child; [F1] the parent sets its own `HOME` to **a decoy folder of the test** (was: the person's home folder — rule R2-S: a starter that leaked it would hand the stand a folder of the test only), and the child's `HOME` and `USERPROFILE` (in the recorded spawn) equal `stand.homeDir`, which is not the decoy; the child's `os.homedir()` (the `home` of its `env` event) equals `stand.homeDir` and is not the decoy; the rest as it is | S01, S02, S03 |
| E2S-19 | line 1649: the README section holds `startStand`, `withStand`, `80000` | the same and `stateEnv`, `STAND_HOME_WRITTEN`, `50000`; it still reads only its four files and the README; the rule "`stand.js` reads only the named base variables" is unchanged (the change reads no new variable: `fs`, `path` and the checked options only) | — |
| E2S-21 | — | **new.** Two stands at once have two different `homeDir`; each is gone after its `stop()`. A stand-in in mode `write-home`: the test waits for `home-written` in its log (5000 ms), sees [F5] the folder `.fake-stand-dir` and the file `.fake-stand-note` in `homeDir`; `stop()` throws `STAND_HOME_WRITTEN` with exactly `fake wrote into its own home folder: .fake-stand-dir, .fake-stand-note`; `homeDir` is gone, the pid and group are gone (`waitGone`). [F4] The precedence: `write-home-exit-one` → `stop()` throws `STAND_HOME_WRITTEN`, not `STAND_EXIT`; `write-home-ignore-term` with `stopTimeoutMs` 1500 → `STAND_HOME_WRITTEN`, not `STAND_STOP_TIMEOUT`. [F7] The guard of the stand-in, by a direct run of it (not through the starter) with `TMPDIR` = a folder A of the test: with `HOME` = a folder of the test outside A → `home-refused` in its log and that folder still empty; with `HOME` = a folder inside A → `home-written` and the two entries (the positive control); each child killed by its pid and waited for. A start that fails (`exit-early`) leaves no `sai-e2e-*` folder and nothing registered | S12, S13, S14, S21, S22, S23, S25 |
| E2S-22 | — | **new** [F2]. The step "outside the repository" of rule P where it decides: the test copies `stand.js`, `cleanup.js`, `errors.js` and `guards.js` into `<a folder of the test>/tools/test/e2e/kit/` (with a `tools/package.json` of `"type": "module"`), so that the copied kit takes that folder for the repository and the repository lies under the temporary root of the file. A child `node --input-type=module -e` (`startChild`, the file's `TMPDIR`) imports the copied starter and calls it with a spawn that records and throws (rule R2-S) and, in turn, a folder inside the copy given in `stateEnv`, in `env`, in `env` after `=`, after `--dir` and as `--dir=…`, and the copy's own script as the first argument; it prints the codes, the messages, `repoRoot()` of the copied kit and the number of spawn calls. Asserted: `repoRoot()` is the copy (control: the test cannot pass on the real repository); the five folder cases are `PATH_REFUSED` with a message that names the folder and ends with `: inside the repository`; the script case passes rule P and reaches the spawn (`STAND_START_FAILED … EACCES`, so the exemption is the first argument only); spawn calls 1; the child ends with code 0; no `sai-e2e-*` folder left | S19, S20 |

Counts: 20 → 22 tests; 211 → 247 `assert.` in the prototype of step 01c (F28, F33); the final file may have more, never fewer.

*As built (`tools/test/e2e-stand.test.js` read at step 10; `decisions/0112` О21, О24).* 22 tests, 272 `assert.`. Beyond the rows above: `E2S-02` has the row `{ stateDirs: undefined }` (mutant M16 of REVIEWER) and more cases of the same class (every base name, `USERPROFILE`, a `null` or a number as `stateEnv`, the names `A-B`, empty and `A B`, a list as a value; step 05, issue I4); `E2S-21` has the case that removes `stand.homeDir` while the stand runs and expects `(not readable: <code>)` (M20) and a third direct run of the stand-in with `HOME` equal to its temporary root, expecting `home-refused` (M22); `E2S-19` reads `stateEnv`, `STAND_HOME_WRITTEN` and `50000` too (M25); `E2S-05` compares the child's environment by its shape first (a plain prototype, no symbols, the expected names, every other name counted), then the values one by one, so a red run prints no value of the test process (step 05d, О24 F3 carried over to the starter test).

### 11.2 `tools/test/e2e/pixel-office.e2e.js`

The seven tests of 4.4, their assertions in section 8. A red test names the window, the event or the place in its message.

---

## 12. Replacement table of earlier guard tests

Measured on copies of the tag with the files of this work (F18, F22, F24). The prohibition is not weakened in any row (AP-068, AP-112, AP-113).

| # | File, test | Line (tag) | Was → became | What the test counts | Evidence |
|---|---|---|---|---|---|
| 1 | `e2e-stand.test.js`, `E2S-01` | 471 | section 11.1 | a member of the stand | red after sub-step 1 (`undefined !== []`), green after the edit (F18) |
| 2 | `E2S-02` | 580 | section 11.1 | a list of refused options | green after sub-step 1 (the old regular expression still matches the new message); the edit makes it exact |
| 3 | `E2S-03` | 650–700 | section 11.1 | refused folders, spawn count, folders | red after sub-step 1 (`USAGE` instead of `PATH_REFUSED`), green after the edit |
| 4 | `E2S-05` | 787–850 | section 11.1 | names of the child's environment | red after sub-step 1 (`HOME`, `USERPROFILE` in the env), green after the edit |
| 5 | `E2S-19` | 1649 | three README tokens → six | tokens of a section | green before and after |
| 6 | `e2e-kit.test.js`, `E2K-41` | 3397 | the words `duration_ms`, `30000`, `80000`, `240000` → and `50000` | words in a section | green after the README edit |
| 7 | `E2K-60` | 3915 (tokens), 3920 (the picker row) | the tokens get `50000`, `stateEnv`, `STAND_HOME_WRITTEN`; one more row expression for `pixel-office.e2e.js` / `REQ-106`; `REQ-106` is still found (in the row; the sentence "REQ-106 and REQ-107 add their rows" is gone) | tokens and rows of the section | green after the README edit |
| 8 | `E2K-50` | 3768–3775 (`SCANNED`) | `SCANNED` gets `tools/test/e2e/pixel-office.e2e.js` — **in sub-step 4a, in the same change as the file** (before the file exists it fails with `ENOENT`, REQ-105 N3). `ENV_NAMES` and the allowlist of whole-environment reads do not change: the spec reads `process.env.PATH` only (in the list), and no file of the change reads a new variable | a list of names the scanned files may read and a list of files | green in the final state (F24) |
| 9 | `E2K-01`, `E2K-25`, `E2K-34`, `E2K-51`, `HO-54`, `PK-7b`, the two `scripts.check` matches, the prefix scans of `handoffs-docs.test.js:101`, `picker-config.test.js:881`, `picker-page-static.test.js:700`, `team-web-control.test.js:1704`, `team-web-docs.test.js:69` [F9], the `readdirSync` scans of `pixel-office-*.test.js` | — | none: `E2K-25` walks `tools/test/e2e` for the sandbox flags and covers the new file with no edit; `E2K-01` walks the whole `tools/test` and allows its word under `test/`; the prefix scans read the top level of `tools/test` and select `handoffs-`, `picker-`, `team-web-` names; the others read other folders or `package.json` (unchanged) | — | F22, F24 |

The requirement says "Guard tests of earlier requirements, «was → became»: none … no existing assertion counts files of tools/test". The measurement says: four starter tests change by the starter change that `decisions/0109` О15 asks for, and four tests get words, a row and a scan entry (rows 1–8): a difference from the block, recorded as О12.

*As built (counted against the tag at step 10).* Changed against the tag: `E2S-01`, `E2S-02`, `E2S-03`, `E2S-05`, `E2S-19` (edited), `E2S-21`, `E2S-22` (new); `E2K-41`, `E2K-60` (words and a row), the `SCANNED` list of `E2K-50` (the entry of the spec); and one more than the rows above: **`E2K-37`**, whose comparison of the environment of the spec process was rewritten at step 05d to the names-first form (the two own names, the passed and the added names counted, the symbols counted, then each value by a strict equality), so that a red run prints no variable of this process (`decisions/0112` О24, Q7; equal in strength by TEST-DESIGN-VALIDATOR, step 05f). No prohibition was weakened. The sentence of the block was corrected at step 10 with `before_copy` (О12).

---

## 13. The order check on three real files (ISS-0102, item 2, continued)

With `picker.e2e.js`, `pixel-office.e2e.js` and `smoke.e2e.js` the validator runs, from `tools/`:

1. `ls test/e2e/*.e2e.js | sed 's#test/e2e/##; s#\.e2e\.js##' | sort -r` → `smoke`, `pixel-office`, `picker`.
2. `npm run -s e2e -- smoke pixel-office picker > out1.txt; echo "exit=$?"` → `exit=0`; `grep '^e2e: file=' out1.txt | sed 's/^e2e: file=//'` prints the three names in that order; `e2e: browser=` once; the last line `e2e: command=npm run e2e -- smoke pixel-office picker selection=smoke,pixel-office,picker exit=0 duration_ms=<n>`.
3. `npm run -s e2e -- pixel-office pixel-office; echo "exit=$?"` → `exit=1` with `SELECTION_DUPLICATE`.

Measured on the prototype (F26): (1) `smoke pixel-office picker`; (2) exit 0, that order, `e2e: browser=` once, `duration_ms=55971`; (3) exit 1, `SELECTION_DUPLICATE`. The unit test `E2K-32` stays the pin of the order on fixture files; RELEASE-VALIDATOR writes its own reading next to `docs/issues/ISS-0102`.

*As built (RELEASE-VALIDATOR, step 09, on the built files; `handoffs/E2E106-20261115-01/step-09-release-validator.json`, criterion 8):* `npm run -s e2e -- smoke pixel-office picker` → exit 0, the files in that order, `e2e: browser=` once, `duration_ms=55237`; `npm run -s e2e -- pixel-office pixel-office` → exit 1, `SELECTION_DUPLICATE`. The reading is added to `docs/issues/ISS-0102` (its update of 2026-11-16).

---

## 14. Build sub-steps

"Red after it" is the list of tests of `npm test` and of the two kit files that fail when the sub-step is done and the later ones are not. The figures were measured on copies of the tag (F18, F23, F24); the check of the kit files is `cd tools && node --test test/e2e-kit.test.js test/e2e-stand.test.js`.

**BACKEND-DEV**

| # | Work | Red after it | Own check (no test file of this work exists yet) |
|---|---|---|---|
| 1 | `stand.js` (4.1) and the stand-in (4.2) | `E2S-01`, `E2S-03`, `E2S-05` only (section 12 rows 1, 3, 4). Measured: the kit files → `# tests 72`, `# pass 69`, `# fail 3`. TEST-DESIGNER fixes them at sub-step 3; BACKEND-DEV leaves them red and names them in `result.issues` (`EXPECTED_RED`) | (a) **Pixel Office through the starter** (a one-line command from `tools/`, a state folder made under the temporary root first): `startStand` with the options of 4.3 and `stateEnv` → the link; `stand.homeDir` empty; the state folder holds four files; `stop()` → `{"code":0,"signal":null}`. (b) **a refusal:** [F1, rule R2-S] the same call with `stateEnv: { SAI_PIXEL_OFFICE_DIR: <the home folder>/.sai-pixel-office }` and a `deps.spawn` that records its arguments and throws (never the real spawn and never a counting wrapper of it) → `PATH_REFUSED`, nothing recorded. (c) **the stand-in in `write-home`:** started by the starter, its log shows `home-written` and `stop()` throws `STAND_HOME_WRITTEN`. After each, `LEFT` of section 16 |
| 2 | `tools/README.md` (section 10), then `npx prettier --write README.md` in `tools/` | the same three; `E2K-41`, `E2K-60`, `E2S-19` stay green; full suite 2207 / 2204 / 3 (F23) | `cd tools && npx prettier --check README.md` |

**TEST-DESIGNER**

| # | Work | Red after it |
|---|---|---|
| 3 | the edits of 11.1 (`E2S-01`, `02`, `03`, `05`, `19`), `E2S-21`, `E2S-22`, the edits of `E2K-41` and `E2K-60` (section 12 rows 5–7). The `SCANNED` entry is **not** made here | none; the kit files → `# tests 74`, `# pass 74` (52 + 22) |
| 4a | `pixel-office.e2e.js` with its helpers and `isolated start`, `live`, `journal` (a helper is written with the first test that uses it, so `npm run lint` stays clean), **and in the same change the `SCANNED` entry** of section 12 row 8 | none; each spec test runs alone |
| 4b | `mask`, `untouched home` | none |
| 4c | `reconnect`, `windows` | none |
| 4d | the independence loop, the mutant series (section 16), the order check (section 13), `npm run check` | — |

Full suite: `cd tools && npm test` after sub-step 2 is `# tests 2207`, `# pass 2204`, `# fail 3` (`E2S-01`, `E2S-03`, `E2S-05`; F23), and after sub-step 4a and later `# tests 2209`, `# pass 2209`, `# fail 0` (2207 + `E2S-21` + `E2S-22`; F24).

Each sub-step can be checked alone: 1 and 2 by the checks above; 4a–4c by `npm run -s e2e -- pixel-office` (the file runs with the tests written so far). After every check that starts stands or browsers, `LEFT` gives the same number as before it.

### 14.1 Test × the first sub-step at which it can run

| Test | Reads (made by this work, with its sub-step) | Made at | First runs at | State there |
|---|---|---|---|---|
| `E2S-01`, `E2S-03`, `E2S-05` (old form) | `stand.js` (1) | released | 1 | red at 1 and 2, green from 3 (new form) |
| `E2S-02`, `E2S-19` (old form) | `stand.js` (1), README (2) | released | 1 | green at 1 and 2 |
| `E2S-21`, `E2S-22` | `stand.js`, the stand-in (1); `E2S-22` also copies `cleanup.js`, `errors.js`, `guards.js` (released) | 3 | 3 | green |
| `E2K-41`, `E2K-60` (edited) | README (2) | 3 | 3 | green |
| `E2K-50` (the `SCANNED` entry) | `pixel-office.e2e.js` (4a) | 4a | 4a | green; made at 3 it would be red with `ENOENT` |
| `isolated start`, `live`, `journal` | `stand.js` (1), the released Pixel Office, README tables (released) | 4a | 4a | green |
| `mask`, `untouched home` | the same | 4b | 4b | green |
| `reconnect`, `windows` | the same | 4c | 4c | green |
| the loop, the order check, the criterion 8 commands | `pixel-office.e2e.js` complete (4c) | — | 4d | — |

---

## 15. Quality bar

| Item | Status | How it is met |
|---|---|---|
| Q1 | applicable | the change is REQ-106 (status `in_progress`); every criterion names its check (section 8) |
| Q2 | applicable | BACKEND-DEV and TEST-DESIGNER are checked by SECURITY-REVIEWER, REVIEWER, TEST-DESIGN-VALIDATOR, RELEASE-VALIDATOR, each by its own run; this design by CODE-DESIGN-VALIDATOR on a fresh clone of the tag |
| Q3 | applicable | every statement about the system is a measured fact (section 1) with its sketch; the runner time is marked an estimate (section 7); the Linux home lookup is named as not measured |
| Q4 | applicable | `pixel-office.e2e.js` is found by `run.js` and so is part of `npm run e2e`, the last step of `npm run check`; the starter tests are in `npm test`; no step is added or removed |
| Q5 | applicable | a test for every criterion (section 8); the failure tests assert the state did not change (0 spawns and no folder for a refusal, the hash of `events.jsonl` while the server is down, the three rows kept, the home folders empty); the tests are independent (own server, folders and browser; the loop, F17) |
| Q6 | applicable | no skip, no todo, no `|| true`, no turned-off rule; `E2K-50` (the file in `SCANNED` from 4a), `E2K-25` (the folder) and `E2S-19` scan the changed files, comments included; a missing Chrome fails (REQ-104); a red test caused by a port taken in between fails with its cause and is not retried (О5) |
| Q7 | applicable | criterion 4: the key-shaped text is built from parts at run time, no file holds the shape; it is masked on the page, in every place of C-9, in the answers and in the file; the stand and the hook get no variable of the developer's shell but named ones |
| Q8 | not applicable | Pixel Office has one local owner and no space of a customer; nothing of a business is read or written |
| Q9 | not applicable | no query of any kind |
| Q10 | applicable | criterion 6 (the server goes away and comes back; the hook stays quiet and the file unchanged); the failure paths of the starter (section 5); every wait has a limit; a port taken in between gives an understandable failure (О5) |
| Q11 | not applicable | no address is supplied to a server by a client; the kit opens only `http://127.0.0.1:<port>/…` and the starter's link passes `assertLoopbackUrl` |
| Q12 | applicable | the choices of section 2 and the change of the starter are proposals for one record (О1); the design relies on `decisions/0107`, `0108`, `0109` (О15 is settled here, О11 gives the line), `0110` (the check on GitHub), `0055` (the role names); it does not silently differ from them |
| Q13 | applicable | traps found here for `docs/anti-patterns.md` (DOC-UPDATER, from `result.issues`): a starter that checks a folder but does not hand that same value to the child proves nothing (О15, F14); `os.userInfo()` names the real home folder whatever `HOME` is (F13); a mutant of a kit test that writes into "the home folder" must be built so that a broken starter makes it write nothing (4.2); a page of a foreign server on the same port looks exactly like ours, so the identity is read from our own folder before the page (F11); a hash of a shared real file inside a test is flaky when real sessions write to it (C-6); [F1, gate issue I1] a refusal case is safe only while the check it tests holds, so a call that names a real folder must go to a spawn that records and throws — the prototype of step 01 left one such call on the real spawn, and its own mutant R02 ran the hook on the owner's folder (F31); a series rule written for product and starter mutants missed the mutants of the spec's own checks; [gate issue I3] `page.waitFor` with a function source and no `args` ends at once (4.4) |
| Q14 | applicable | the status, `STATE.md`, the handoffs, `docs/issues/ISS-0102` (item 2 continued) and `ISS-0110` (one more caller) are DOC-UPDATER's and ORCH's, in the same run; the list in section 17 |
| R1 | applicable | the release is pushed to `main` by RELEASE-FINALIZER only after PASS (`decisions/0048`, `0079`, `0110`); nothing is merged by this design |
| R2 | applicable — central | (1) every server of the spec has a private home, so its home lookup cannot reach the real folder; (2) a state folder reaches it only through checked `stateEnv` or checked arguments, and every absolute path in `env` is checked; (3) the hook runs only through `runHook`, whose two folders are checked in the same call; (4) the events of the spec are composed for the test and live only in throwaway folders under the temporary root; the server marks each `REAL` there, and the owner's journal never gets them; (5) `STAND_HOME_WRITTEN` and the empty hook home catch a write through the home lookup; (6) RELEASE-VALIDATOR measures the real folder by hash before and after the command, and this design measured it before and after every trial (F29); (7) the stand-in's `write-home` writes only under the temporary root, and that guard is pinned (`E2S-21`, S25); (8) [F1] rule R2-S (section 6): every call that names a real folder — in the starter's and the hook helper's refusals, in test 1, in `E2S-03`, in BACKEND-DEV's check (b), under every mutant of rule P or of `runHook` — gets a spawn that records and throws, so no regression and no mutant can start a process there; `E2S-05` uses a decoy `HOME`. The spec never reads the real folder; it names it only as a value that must be refused. The one breach of step 01 (R02, F31) is recorded with its evidence |
| R3 | not applicable | the product with photos was dropped (`decisions/0033`) |

---

## 16. Mutants

**What "applied" means.** The mutant was put into a copy outside the project, the named tests were run alone, and the red ones were read. The starter mutants (S) were applied to the prototype starter with the edited starter tests (`sk/mut_starter.py` at step 01, `sk/mut_starter2.py` at step 01c with the tests of 01c; S25 to the stand-in); the product mutants (P) to `tools/src/pixel-office` of `proto` and the spec mutants R01, R02, R05, R06 to the prototype spec, with the named spec tests run alone (`sk/mut_product.py`); R03, R04, R07 by hand on `proto` with `E2K-50` or `E2K-60` run alone; the hashes of `proto`'s `src` and spec files were the same before and after each series. TEST-DESIGN-VALIDATOR applies its own on the final files (WF-02, step 5b). Expected cost: a starter mutant 0.1–6 s; a product mutant 0.2–15 s (the waits of the poll); none needs a hang limit beyond the 30 s of a test.

**R2 rule for every series.** A product mutant that makes the server or the hook write into "the home folder" is run only with the correct starter (the private home) and the hook helper (its own home), so it writes under the temporary root; starter mutants run only with the stand-in, whose `write-home` refuses any home outside the temporary root (pinned by S25). No mutant of any series is run with both a broken home and a server that writes there. [F1] **A mutant that removes or weakens a check of rule P (S05–S11, S19, S20, S24) or of `runHook` (R02) is run only where every call that names a real folder has the spawn that records and throws of rule R2-S**: `E2S-03` and `E2S-22` have it by construction (`countingSpawn(refusingSpawn)`, the child's throwing spawn), and `isolated start` has it in both of its refusal calls; a harness checks, before each such run, that the refusal calls of the file under test pass that spawn (step 01c did it with a search of the file before R02, F32). R09 (the throwing spawn of a refusal replaced by the real one) is never applied, because applying it together with R02 is exactly the breach of F31.

**The leftover check `LEFT`.**

- `ps -axo pid=,command= | grep -E 'src/pixel-office/main\.js|src/picker/cli\.js serve|fake-stand\.js|sai-e2e-' | grep -v grep | wc -l`
- `ls "$(node -p "require('os').tmpdir()")" | grep -c '^sai-e2e-'`

Both gave 0 after every series of this design. The first gives 0 on a machine with no Pixel Office or picker server of the owner running; otherwise the same number before and after (the pids are compared).

**Mutants of the starter (copy of `stand.js`), caught by `e2e-stand.test.js`**

| # | Breakage | Caught by | Status |
|---|---|---|---|
| S01 | the private home is made, but `HOME` is not given | E2S-05, E2S-21 | applied: red |
| S02 | `HOME` is the `HOME` of the spec process | E2S-05, E2S-21 | applied: red |
| S03 | `USERPROFILE` is not given | E2S-05 | applied: red |
| S04 | `env` may give `HOME`, and it wins over the private home | E2S-02 | applied: red |
| S05 | the folders of `stateEnv` are passed without the check | E2S-03 | applied: red |
| S06 | the values of `env` that are paths are not checked | E2S-03 | applied: red |
| S07 | the arguments are not checked | E2S-03 | applied: red |
| S08 | the form `--name=<absolute path>` is not checked | E2S-03 | applied: red |
| S09 | the checked real path is used for the check only; the raw value goes to the child | E2S-03 | applied: red |
| S10 | the temporary root itself is taken | E2S-03 | applied: red |
| S11 | the first argument may be any absolute path | E2S-03 | applied: red |
| S12 | `stop()` does not look into the home | E2S-21 | applied: red |
| S13 | the home is read after it was removed, and a read error counts as empty | E2S-21 | applied: red |
| S14 | one home folder shared by every stand of the process, beside the markers (so it is not removed with a marker) | E2S-01, E2S-21 | applied: red |
| S15 | the home is made with the default mode | E2S-01 | applied: red |
| S16 | `stateEnv` may give a name of the base list (`TMPDIR`) | E2S-02 | applied: red |
| S17 | `stateDirs` is still taken and ignored | E2S-02 | applied: red |
| S18 | a `stateEnv` name may also stand in `env`, and `env` wins | E2S-02 | applied: red |
| S19 | [F2] rule P without step (3), "outside the repository" | E2S-22 | applied (step 01c): red |
| S20 | [F3] the form `<name>=<path>` is not checked in the values of `env` (only in arguments) | E2S-03, E2S-22 | applied: red |
| S21 | [F4] the home is looked at only when the exit was code 0 (a bad exit wins over `STAND_HOME_WRITTEN`) | E2S-21 (`write-home-exit-one`) | applied: red |
| S22 | [F4] the home is looked at only when the stop did not time out | E2S-21 (`write-home-ignore-term`) | applied: red |
| S23 | [F5] only files count in the home (a folder made there is not seen) | E2S-21 (the exact message with `.fake-stand-dir`) | applied: red |
| S24 | [F6] the temporary root is compared as it was given, not as its real path | E2S-03 (the four other spellings) | applied: red |
| S25 | [F7] the stand-in writes into any home (its guard removed) | E2S-21 (the direct run with a home outside its root) | applied: red; the write went into a folder of the test only |
| S26 | [F10] a `stateEnv` name that is not a variable name is taken | E2S-02 | applied: red |

**Mutants of Pixel Office (copy of `tools/src/pixel-office`), caught by the spec**

| # | Breakage | Caught by | Status |
|---|---|---|---|
| P01 | the page polls every 9 s | `live` | applied: red (`WAIT_TIMEOUT` 5000 ms) |
| P02 | the page reloads itself when new events come | `live` (the marker) | applied: red |
| P03 | the word of the link is another | `isolated start`, `windows` | applied: red |
| P04 | the word of a lost link is another | `reconnect` | applied: red |
| P05 | no masking in the hook and none in the server | `mask` | applied: red |
| P06a | the server does not mask again (the hook does) | — (the spec is green: defence in depth) | applied: survives the spec, **red in `MK-02`** (`pixel-office-hook.test.js`) |
| P06b | the hook does not mask (the server does) | — | applied: survives the spec, **red in `HK-22`, `HK-23`, `MK-01`, `MK-03`, `MK-02`** |
| P07 | the server stores its own time, not the hook's | — (the time still lies inside the window of the hook run) | applied: survives the spec, **red in `SV-04b`** «the time that was sent is stored byte for byte» (`pixel-office-server.test.js`); О7 |
| P08 | the hook ends with code 1 when the server is down | `reconnect` | applied: red |
| P09 | the hook prints a line when the server is down | `reconnect` | applied: red |
| P10 | the server empties the journal at its start | `reconnect` | applied: red |
| P11 | the server writes a sixth file into its folder | `isolated start` | applied: red |
| P12 | the server writes a row into the journal at its start | `isolated start` | applied: red |
| P13 | the server makes its default folder in its home folder as well (R2) | `isolated start`, `untouched home` (and `STAND_HOME_WRITTEN` in every test) | applied: red |
| P14 | the words of a repeated start are other | `journal` | applied: red |
| P15 | the new rows of the journal go on top | `journal` | applied: red |
| P16 | the counter shows one row more | `journal` | applied: red |
| P17 | the role is shown by its code, not by its plain name | `live`, `journal` | applied: red |
| P18 | the word of a finished task is another | `live` | applied: red |
| P19 | the page stops polling after a failed request | `reconnect` | applied: red |
| P20 | the page forgets the rows when the link is lost | `reconnect` | applied: red |
| P21 | the server ends with code 1 after `SIGTERM` | `windows` (and every `stop()`) | applied: red |
| P22 | the page writes a console error at its start | `windows` (and every `withBrowser`) | applied: red |
| P23 | the page throws in a narrow window | `windows` | applied: red |
| P24 | the block «Сейчас» is not shown in a narrow window (`display: none`) | `windows` (`NOW_SHOWN`; a test that only asked "is it in the DOM" would be green, О9) | applied: red |
| P29 | the hook takes its folder from the home folder only (the variable ignored) | `live` (the event is lost: the hook's home has no secret) | applied: red |
| P31 | the server prefers the home folder to the variable (R2) | `isolated start`, `untouched home` | applied: red |
| P32 | the rule of keys `gh?_` is gone (the rule of long strings stays and masks the text) | — (the text is still masked) | applied: survives the spec, **red in `HK-21`** «every rule M1-M10 (exact result)» |
| P33 | the rule of keys `gh?_` and the rule of long strings are gone | `mask` | applied: red |
| P34 | the hook does not mask, and the server writes the body it received to stderr before masking | `mask` (the place "server output" of C-9; the page and the file are masked by the server) | applied: red («server output») |
| P35 | [F8] our own server writes no start row on a restart | `reconnect` (outcome (iii), whose message names this cause and a foreign Pixel Office) | applied (step 01c): red |

**Mutants of the spec itself and of the shared places**

| # | Breakage | Caught by | Status |
|---|---|---|---|
| R01 | the spec gives the hook the whole environment | `isolated start` (the recorded variables); `E2K-50` (a whole-environment read in the file) | applied: `isolated start` red |
| R02 | the spec runs the hook without the folder check | `isolated start` (the refusal of the real folder, through the throwing spawn) | [F1] step 01: applied **without** the throwing spawn — the hook ran on the real state folder (F31); step 01c: applied again with it — red, `Error: a real folder reached the spawn`, no process (F32) |
| R03 | the key-shaped text is written as a literal | the grep of criterion 4 (1 line); `E2K-50` (`SECRET_SHAPES`) | applied: both red |
| R04 | a skip word is put into a comment of the spec | `E2K-50` with the `SCANNED` entry (without the entry it is green: the reason for row 8 of section 12); the grep of criterion 8 (1 line); `E2K-25` does not scan skip words | applied: `E2K-50` red with the entry, green without it |
| R05 | the spec gives the hook no `HOME` | `isolated start` (the recorded variables) | applied: red |
| R06 | the key-shaped text has a dash in place of the underscore | `mask` (the shape control) | applied: red (without the control it survived, because the rule of long strings masks it: F20) |
| R07 | the README row of `pixel-office.e2e.js` is removed | `E2K-60` (edited) | applied: red |
| R08 | `live` measures from the spawn of the hook instead of from its end (about 75 ms more, so the claim is still met) | — (a weakening of the spec's own oracle that no run can tell; read by TEST-DESIGN-VALIDATOR against section 8 row 2) | on record, not applied |
| R09 | [F1] a refusal call of `isolated start` gets the real spawn (or a counting wrapper of it) in place of the one that records and throws | — (green while the checks hold; read by TEST-DESIGN-VALIDATOR and REVIEWER against rule R2-S) | on record, **never applied** (with R02 it is the breach of F31) |

**Counts (AP-143).** `sed -n '/^## 16\./,/^## 17\./p' docs/design/REQ-106-e2e-pixel-office.md | grep -cE '^\| [SPR][0-9]{2}[ab]? '` gives 66 rows: S 26, P 31, R 9 (the same command with `^\| S`, `^\| P`, `^\| R`). 64 are applied in a sketch: 60 are caught by the tests of this work (S01…S26; P01–P05, P08–P24, P29, P31, P33, P34, P35; R01–R07), 4 are survivors of the spec caught by named unit tests (P06a, P06b, P07, P32), and R08 and R09 are on record (R09 never to be applied). The harness ids of `sk/mut_starter.py` are T01…T21 (S01=T01 … S05=T05, S06=T07, S07=T08, S08=T09, S09=T10, S10=T11, S11=T12, S12=T13, S13=T14, S14=T16, S15=T15, S16=T20, S17=T18, S18=T21; step 01c, `sk/mut_starter2.py`: S19=T22, S20=T23, S21=T24, S22=T25, S23=T26, S24=T27, S26=T28, S25=T29, and the 18 earlier ones again against the edited tests, all red).

**Not a mutant (equivalent by defence in depth).** P06a and P06b alone: the hook and the server both mask, so one of them suffices for the page and the file; each place has its own unit tests (above). P32: the long-string rule masks the 36 characters too; the key rules have `HK-21`.

**As built — the mutant series of the run** (each applied on copies outside the project by the step named, with the seams of rule R2-S checked in the copy before each mutant of a check; the lists and the results are in its handoff, `handoffs/E2E106-20261115-01/`). The table above is not rewritten; its count stays 66 rows.

- **How many each step applied.** Step 01: 18 starter and 34 product and spec mutants, step 01c: the 26 starter ones again, P35 and R02 again (F19, F20, F33). Gates and later steps, their own lists: step 01b — 34 (23 of its own, `V-S01…V-S11`, `V-P01…V-P12`, and 6 of the list again); step 01d — the new rows of the list in its own form and two of its own (finding N1); step 04 — 25 (`M01…M25`, 22 red, 3 survivors that became remarks T1–T3); step 05 — 81 (the list of section 16 with the new rows below and its own `S09b`, `R02o`, `R07b`, `X01…X07`; `R04x` a demonstration); step 05b — 40; steps 05c, 05d, 05e — 5, 6 and 6; step 05f — 23; step 09 — 14 (`RV01…RV14`) and one probe.
- **New rows, red.** `R02h` (the hook helper does not check its home folder) and `R02r` (it takes the temporary root itself), the two cases of `decisions/0112` О18: red in `isolated start` with `Error: a real folder reached the spawn` (the throwing spawn was reached, no process; step 05). REVIEWER's `M16` (`stateDirs: undefined` is taken) red in `E2S-02`; `M20` (a home that cannot be read counts as empty — the same breakage as `V-S11` of step 01b) and `M22` (the stand-in writes into a home equal to its temporary root) red in `E2S-21`; `M25` (the README clause on `STAND_HOME_WRITTEN` removed) red in `E2S-19` and `E2K-60` (О21; step 05).
- **P06b as built is narrower.** The mutant of step 05 removes only the hook's masking of the task description (`buildWriteBody` of `protocol.js`): red in `MK-01`, `MK-03`, `MK-02`; `HK-22` and `HK-23` stay green (they check other fields or the prompt text); the spec is green, as the row says (step 05, issue I2).
- **Found by the gates and closed in the run.** Step 01b: `V-S01`, `V-S02`, `V-S04`, `V-S05`, `V-S06`, `V-S10` became `S19`, `S20`, `S21`/`S22`, `S23`, `S24`, `S25` (F2–F7); step 01d: the two cases of N1 became `R02h`, `R02r`; step 04: `M16`, `M20`, `M22` became rows of `E2S-02` and `E2S-21` (T1–T3); step 05b: `H01`, `H02` (the hook helper's real paths, F1), `N07`, `N12` (a sixth file in the state folder, F2) red after step 05c — `N12` still green in `isolated start` and `journal`, red in `untouched home` and `reconnect` (step 05c, issue I5); `R01` red in `isolated start` and `E2K-50`; the probe `SP1` of step 05d (three right names on an object whose prototype is the whole environment) green in `isolated start` after step 05c and red there after step 05e, red in `E2K-50` throughout; `W1`, `W2` red in `E2S-05`; `K1…K3` red in `E2K-37`. Step 05f: `A11` (the hook gets the `HOME` of the test process) red, but its red output printed that value (finding G1).
- **Survivors on record.** `V-P05` of step 01b (the hook takes its time stamp after reading the input, not as its first action): green in the spec and in the 50 tests of `pixel-office-hook.test.js` — outside REQ-106, `docs/issues/ISS-0113`. `A2` (a getter right on the first read only) and `A3` (a non-enumerable foreign name) of step 05f: equivalent — `spawn` reads each value once and ignores non-enumerable names, so the hook gets exactly the three right values. `A4` of step 05f (the helper follows one level of link, then checks the spelling): finding G2, `docs/issues/ISS-0111`. `RV10` of step 09 (the page reloads itself when the link comes back): `reconnect` stays green, finding F1; a probe in a copy (one assertion of the navigation type after the restart) is green without it and red with it — `docs/issues/ISS-0111`. `V-P07` and `V-P12` of step 01b: equivalent for the criteria (the control text is also shown in the journal row; exit code 0 is the contract). And the four survivors of the spec that named unit tests catch: `P06a` (`MK-02`), `P06b` (`MK-01`, `MK-03`, `MK-02`), `P07` (`SV-04b`), `P32` (`HK-21`).

---

## 17. What becomes outdated outside the project (for DOC-UPDATER)

- `tools/README.md`, the section "End-to-end tests in a real browser": section 10 (made by this run).
- `docs/design/REQ-105-e2e-picker.md`: 4.1 (`stateDirs`, "no `HOME`"), 4.2 (the REQ-106 row: `env: { SAI_PIXEL_OFFICE_DIR, HOME }`, `stateDirs`), 4.3 (the `env` event, the mode `write-home`), 6 (the row "the spec reads no real home folder"), 11.1 (`E2S-01`, `02`, `03`, `05`, `19`; `E2S-21`) — an «As built» note pointing here.
- `decisions/0109`, О15: carried out by this run (ORCH writes the addendum or the new record of О1).
- `docs/requirements.yaml`, block REQ-106: «(tools/src/pixel-office/protocol.js, `prepareText`)» (О11), "Guard tests … none" (О12), «sets `HOME` to another new folder» (now the starter's private home, О1) — corrected at step 10 with `before_copy`, without a change of meaning; the status after PASS of RELEASE-VALIDATOR.
- `docs/requirements.yaml`, block REQ-107: «`HOME` is another new folder» (now the starter's) and «`SAI_TEAM_CLAUDE_BIN` points to a trap program (a script in tools/test/fixtures/e2e/)» (refused by rule P, О14) — a note for its design, not an edit of its criteria in this run.
  *As built 2026-11-16 (step 10 of run `E2E107-20261116-01`): both sentences corrected there without a change of meaning, with `before_copy` (the starter's private home, О1; the trap copy under the temporary root, `decisions/0113` О3).*
- `docs/issues/ISS-0102`: item 2 continued with three real files (section 13). `docs/issues/ISS-0110`: one more caller of `safeText` (`STAND_HOME_WRITTEN`, the entry names of a home folder).
- `STATE.md`, `PLAN.md`, the mistakes journal (Q13 items of section 15).

---

## 18. Sketch notes (for `result.prototype`)

Outside the project, in `<outside the project>/e2e106-01/` (no path of this computer is written here): `clone/` (a fresh clone of the tag with `npm ci`, the "before" copy, never changed), `proto/` (a fresh clone in which the prototype was written: `tools/test/e2e/kit/stand.js`, `tools/test/fixtures/e2e-stand/fake-stand.js`, `tools/test/e2e-stand.test.js` with the edits of 11.1 and `E2S-21`, `tools/test/e2e-kit.test.js` with the edits of section 12, `tools/README.md` with section 10, and the prototype spec `tools/test/e2e/pixel-office.e2e.js`), `c1s/` (a fresh clone in the state after BACKEND-DEV: the starter, the stand-in and the README of `proto` only), `sk/` (`s3-office.mjs` — Pixel Office and the hook without a browser; `s4-dom.mjs` — the page in Chrome; `mut_starter.py`, `mut_product.py` and their outputs; the runs `run1.txt`…`run3.txt`; the suites `s1-stand-kit.txt`, `s2-stand.txt`, `full_s1.txt`, `full_final.txt`). Step 01c, in the same folders: `proto` with the throwing spawn in the hook refusal and the message of outcome (iii) in the spec, the stand-in's three home modes, and the edited `E2S-02`, `03`, `05`, `21` and the new `E2S-22`; `sk/mut_starter2.py` and `mut_starter2.out` (26 starter mutants), `mut_r02_seam.out`, `mut_p35.out`, `s3-stand-01c.txt`, `run-01c.txt`, `full_final_01c.txt`, and `design-before-01c.md` (this file before the rework). The facts the later steps need are in this design and in the handoff, not only there (AP-149).

---

## 19. Open questions (for ORCH; proposal: one record `decisions/0112-e2e-pixel-office-conventions.md` with the section "Basis", Q12)

| # | Question | Default used by the design | Cost of the other choice |
|---|---|---|---|
| О1 | The change of the released starter for О15: `stateEnv` replaces `stateDirs` (refused with `USAGE`), rule P on `stateEnv`, `env` and `args` (one pinned exemption: an absolute script inside the repository as the first argument), the private home `<marker>/home` with `HOME` and `USERPROFILE`, the code `STAND_HOME_WRITTEN` and its place in the precedence | as section 4.1; a record of these choices (C-1…C-4) | keeping `stateDirs` as an alias leaves a checked folder unbound (О15); without `STAND_HOME_WRITTEN` a write through the home lookup is seen only by the spec's own reads |
| О2 | The hook's `HOME` is a folder of the test (`makeTempDir("hook-home")`), not the stand's home: it must exist while no stand runs (`reconnect`), and "the same two variables" is read as the same two names, the state folder being the same value | as stated | the stand's home would vanish with the first stand in `reconnect` |
| О3 | Criterion 7 says "the kit reports no console error"; the browser writes one favicon 404 line per start (F15; the server serves no icon) | declare it exactly with its path, once per start (as REQ-105, `decisions/0109` О4); the criterion read as "the kit reports none" | an icon in the page would be a change of Pixel Office, outside this requirement |
| О4 | Criterion 6: while the server is down every failed poll writes `net::ERR_CONNECTION_REFUSED` for `/api/events`; their number depends on the polls (about one per 2 s) | declared with `expect` (at least one, no upper bound), with the path; no other line is allowed — a request in flight at the stop is impossible by the order (the stop comes right after a poll answer, the next poll is 2 s later) | a count-exact declaration would be a wait by time in disguise |
| О5 | A port taken by another process between the stop and the restart (about 2.1 s; on Linux even a self-connection of the browser's poll to a free port in the ephemeral range can hold it) | the three outcomes of 4.4 test 6 told apart by facts; a taken port fails the test with its cause named; no retry, no other port, no wait | a retry on another port is a new page (a reload) and would hide a server that cannot bind its own old port; a fixed port outside the ephemeral ranges would leave `--port 0` of the block (a WF-01 micro-amendment) |
| О6 | Criterion 5 gets the spec test `untouched home`; the hash of the real folder is RELEASE-VALIDATOR's; the spec never reads the real folder | as stated (C-6) | a hash inside the spec turns red when a real session writes during a check |
| О7 | "The time came from the hook": the spec proves "inside the window of its own hook run, and the payload has none"; that the server keeps the sent time is `SV-04b` (P07 survives the spec) | accepted and recorded | a proof inside the spec would need a gap between the hook's stamp and the server's receipt that only a wait by time could make |
| О8 | The mask test reads every place of C-9, more than the criterion names | as stated (AP-145); P34 is the mutant of the place "server output"; the answers to the page and the storage have no mutant of their own because the raw text cannot reach them without passing a server that masks — written so | reading only the two places of the criterion |
| О9 | Criterion 7 "the block «Сейчас» exists" read as "is shown and starts with «Сейчас»" (P24 is red only so) | as stated | the letter ("in the DOM") lets P24 pass |
| О10 | The line for a question on the runner: 30000 ms (60 % of 50000, the rule of `decisions/0109` О11) | 30000 | 40000 (80 %), since about 15 s of the file are the product's poll and do not grow on a slower machine |
| О11 | The block names `protocol.js` for `prepareText`; the function is defined in `mask.js` and called by `protocol.js` (F4) | DOC-UPDATER corrects the words at step 10 without a change of meaning | — |
| О12 | The block says "Guard tests …: none"; the measurement finds four starter tests changed by О15 and four scans that get words, a row or an entry (section 12) | the edits of section 12; DOC-UPDATER corrects the sentence at step 10 with `before_copy` (as `decisions/0109` О9) | the starter change cannot be made without them |
| О13 | The private home inside the marker folder | as stated (C-1) | a separate `makeTempDir("home")` needs its own clean-up on the runner's sweep (a change of `cleanup.js`) and changes the folder counts of the released tests |
| О14 | Rule P refuses an absolute path inside the repository in `env` (REQ-107's `SAI_TEAM_CLAUDE_BIN` trap in `tools/test/fixtures/`) | no exemption now; the design of REQ-107 copies the trap under the temporary root or asks for a pinned exemption with a record | an exemption for the repository in `env` would let `--dir`-like values write into the repository |
| О15 | The spec imports `ROLE_NAMES` from `src/pixel-office/public/texts.js` (the requirement's own words), while WF-02 step 5 says a test does not import rules from `src` | the table is data named by the requirement; the words of the rows come from the README, so the two oracles stay different | parsing `texts.js` as text gives the same table with more code |
| О16 | `os.userInfo()` still names the real home folder (F13) | recorded; no server of Sai asks it; a later one would be a change of the kit (for example a check of the sources of the stand) | — |
| О17 | The mutants and the anti-pattern candidates of section 15 (Q13) are recorded by DOC-UPDATER at step 10 from `result.issues` | as stated | — |

---

## 20. The open defects of the kit (`docs/issues/ISS-0105`, `ISS-0107`, `ISS-0108`, `ISS-0110`)

| Defect | Touched by this design? | What it means here |
|---|---|---|
| ISS-0105 (a text added after a screen is read; the network of workers) | no | the mask test reads after the page shows the six rows; the page gets only masked data (the hook and the server both mask, P06a/P06b), and Pixel Office has no worker; not fixed here |
| ISS-0107 (a group stays registered after its leader ended) | no | `stop()` keeps the order of REQ-105 for the group; the home read is added after `unregisterGroup` and does not change that shape; not fixed here |
| ISS-0108 (older tests leave folders in the system temporary folder) | no | the spec's folders are made by `makeTempDir` and removed in a `finally`; the home goes with the marker; not fixed here |
| ISS-0110 (`safeText` lets bidirectional controls through) | yes, one more caller | `STAND_HOME_WRITTEN` puts the entry names of a home folder through `safeText`, so a name with such a control would be shown unescaped like the stderr line of `STAND_EXIT`; DOC-UPDATER adds the caller to the defect; not fixed here |

---

## 21. Closed in the rework of step 01c (the findings of the gate, pass 1; not for the owner)

| Finding | How it is closed | Where |
|---|---|---|
| F1 (High) | Rule R2-S: every call that names the person's home folder or the real state folder gets a spawn that records its arguments and throws — the refusals of `startStand` and `runHook` in test 1, `E2S-03`, BACKEND-DEV's check (b), every mutant of rule P or of `runHook`; `E2S-05` uses a decoy `HOME`; the series rule of section 16 extended to the mutants of rule P and of the hook helper; R09 on record, never applied. The breach of step 01 is described with its evidence (F31); the five real files are unchanged (F32); R02 applied again with the throwing spawn: red, no process | 0, 1 (lead-in, F29, F31, F32), 4.4 (helper, test 1), 6 (rule R2-S), 8 row 1, 11.1 (`E2S-03`, `E2S-05`), 14 (b), 15 (R2, Q13), 16 |
| F2 (Medium) | `E2S-22`: a copy of the four kit files under the temporary root, so that the copied kit takes the copy for the repository; a folder inside it in `stateEnv`, `env`, `env` after `=`, after `--dir` and as `--dir=…` → `PATH_REFUSED … inside the repository`, 0 spawns; the script of the copy passes; mutant S19 red | 4.1 (rule P step 3), 11.1, 14, 14.1, 16 |
| F3 | `E2S-03` has `opt=<home>` refused and `opt=<..path>` accepted as a value of `env`; mutant S20 | 11.1, 16 |
| F4 | modes `write-home-exit-one` and `write-home-ignore-term`; `E2S-21` asserts `STAND_HOME_WRITTEN` over `STAND_EXIT` and over `STAND_STOP_TIMEOUT`; mutants S21, S22 | 4.2, 11.1, 16 |
| F5 | `write-home` makes the folder `.fake-stand-dir` as well as the file; `E2S-21` asserts the exact message with both; mutant S23 | 4.2, 11.1, 16 |
| F6 | rule P step (2) compares the real path; `E2S-03` refuses the root in five spellings; mutant S24 | 4.1, 11.1, 16 |
| F7 | `E2S-21` runs the stand-in directly with a home outside and inside its temporary root; mutant S25 | 4.2, 11.1, 16 |
| F8 | the identity of the restart is the start-row count only; outcome (iii) names both causes; mutant P35 | 4.4 test 6, 5 row 9, 8 row 6, 16 |
| F9 | the four more scans of `tools/test` named | 1 (F22), 12 row 9 |
| F10 | the exact `USAGE` messages of `stateEnv`; `E2S-02` asserts them; mutant S26 | 4.1, 11.1, 16 |
| F11 | `runHook`'s variables named as the real paths returned for `folders.office` and `folders.home` | 4.4 |
| F12 | the reading of "the `HOME` folder of the spec" named | 8 row 5 |
| F13 | the line is read from the `check.yml` run of the `ci/…` snapshot at steps 6 and 9, before the push | 7 |
| issue I1 | F31 | 1 |
| issue I3 | the kit trap of `waitFor` written for TEST-DESIGNER | 4.4 |

Found beyond the list of findings and not changed here (AP-019): none.

---

## 22. As built (DOC-UPDATER, step 10, 2026-11-16; the design text above is not rewritten)

**Counts (read from the files at step 10; the commands from the root of Sai).**

- `tools/test/e2e/pixel-office.e2e.js`: 1022 lines (`wc -l`); 7 top-level tests (`grep -c '^test(' tools/test/e2e/pixel-office.e2e.js` → 7: `isolated start`, `live`, `journal`, `mask`, `untouched home`, `reconnect`, `windows`); 102 `assert.` (`grep -o 'assert\.' tools/test/e2e/pixel-office.e2e.js | wc -l`).
- `tools/test/e2e-stand.test.js`: 22 tests, `E2S-01…E2S-22` (`grep -c '^test(' tools/test/e2e-stand.test.js` → 22), 272 `assert.` (the tag: 20 and 211).
- `tools/test/e2e-kit.test.js`: 52 tests (`grep -c '^test($' tools/test/e2e-kit.test.js` → 52, as on the tag), 537 `assert.` (the tag: 535); four places changed: `E2K-37`, `E2K-41`, `E2K-60` and the `SCANNED` list of `E2K-50` (section 12, «As built»).
- The starter and its stand-in: `tools/test/e2e/kit/stand.js` 619 lines; `tools/test/fixtures/e2e-stand/fake-stand.js` 213 lines with 15 modes (`sed -n '/^const MODES = new Set(\[/,/^\]);/p' tools/test/fixtures/e2e-stand/fake-stand.js | grep -c '^  "'` → 15).
- `npm test`: 2209 tests (2207 on the tag, and `E2S-21`, `E2S-22`); `npm run e2e`: 29 tests (`picker` 9, `pixel-office` 7, `smoke` 13). Read from the full checks of steps 06 and 09, here and on GitHub.
- Mutants: section 16, «As built — the mutant series of the run».

**Differences between the design and the built work** (the records: `decisions/0112` О18–О25 and the handoffs of the run).

1. Test `isolated start`: five refusals of the hook helper instead of one (О18; О24 F1), a third folder of the test (`links`), the recorded call made with a recorder that throws and with a link and a `..` spelling, and the environment of the hook compared by its shape first (О24 F3) — section 4.4, «As built». `untouched home` and `reconnect` read the names of the state folder at their end, and `reconnect` the whole listing around the hook run while the server is down (О24 F2).
2. The starter as built: the refusal of rule P step (3) names the real path (L3); the exemption of the script is recognised by the reason text of `guards.js` (L1); a `Map` given as `stateEnv` or `env` is taken as empty, against the row of `stateEnv` in 4.1 (L2); the header comment says more than the code (L5) — section 4.1, «As built».
3. The starter and kit tests have more than section 11.1 lists (`E2S-02` M16, `E2S-21` M20 and M22, `E2S-19` M25, `E2S-05` by its shape first; О21, О24), and `E2K-37` changed too (section 12, «As built»).
4. `tools/README.md`, the paragraph «Servers for the page specs», is more precise than section 10 item 2: the credit of `STAND_HOME_WRITTEN` to `decisions/0112`, a value of `env` named, the limit of О16 (section 10, «As built»).
5. `P06b` as built is narrower than its row (section 16, «As built»).
6. The open questions grew from О1–О17 to О1–О25 (the addenda of `decisions/0112`). О19 — a preload that refuses any process start naming the person's home folder or the real state folder, as a raise of the bar — is a question to the owner and open.

**Recorded outside this design.** The Low findings of the gates for the next change of the kit and the spec (L1, L2, L5, G1, G2, F1 of step 09, the hash of the throwaway `write-secret` in a red listing output): `docs/issues/ISS-0111`. The three moderate advisories of the development dependencies that `npm ci` reports: `docs/issues/ISS-0112`. The hook's time stamp as its first action, pinned by no test (`V-P05`): `docs/issues/ISS-0113`. One more caller of `safeText`: `docs/issues/ISS-0110`. The order check on three real files: `docs/issues/ISS-0102`. The folders that older test files leave: `docs/issues/ISS-0108`.

**What is not proven (honest limits).**

- The runner: two samples of the same image (21337 and 21582 ms, section 7; AP-144). Every other run was on one Mac (macOS arm64, Node 22.23.4, Chrome 157.0.8103.78); Linux only through the GitHub runner, where the private home and the tests were green twice; Windows never.
- Criterion 5: the real state folder was measured by RELEASE-VALIDATOR on this one Mac (the five files the same by sha256, size and time of last change from 00:27:05Z to 00:49:47Z on 2026-11-16, around its check, the real command, the series and the mutants); "the `HOME` folder of the spec" is read as the homes the spec gives (section 8, row 5, F12). The runner has no real folder to compare.
- Rule R2-S rests on the authors writing the throwing seam and on the gates searching for it before every mutant; a mechanical net is the open question О19.
- `reconnect` does not pin that the page is not reloaded when the link comes back (`RV10` survives; criterion 6 does not forbid it); a red run under `A11` prints the value of `HOME` of the test process (G1) — both in `docs/issues/ISS-0111`.
- The starter does not hide `os.userInfo()` (О16); no server of Sai asks it today.
