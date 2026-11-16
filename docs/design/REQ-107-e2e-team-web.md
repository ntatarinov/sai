# REQ-107 — code design: end-to-end tests of the team page in a real headless Chrome, with the scripted test executor only

Run `E2E107-20261116-01`, WF-02 step 1; reworked in step 01c after the FAIL of the gate, pass 1 (`handoffs/E2E107-20261116-01/step-01b-code-design-validator.json`, findings F1–F8), and by the addendum О19–О22 of `decisions/0113`; each edit carries its finding in brackets, and section 21 lists them. Base: the tag `base/E2E107-20261116-01` (commit 4cfe57e, the release of REQ-106). The block REQ-107 is in the tag with eight criteria; the working tree differs from the tag only in the status line of the block (`pending` → `in_progress`) and in `docs/program/public-v1/PROGRESS.md` (checked with `git diff --stat base/E2E107-20261116-01 -- . ':!handoffs'` and a `diff` of the block taken from the tag and from the tree: one line, F1).

This file holds shapes, signatures, tables and texts. It holds no implementation code. The sketches lie outside the project (section 18); the words "the prototype" mean them. The open questions of section 19 (О1…О18) were answered by `decisions/0113` (every default accepted, О18 recorded); its addendum О19–О22 came after gate 1b.

**As built (DOC-UPDATER, step 10, 2026-11-16, after the PASS of step 9, `handoffs/E2E107-20261116-01/step-09-release-validator.json`).** The design text is not rewritten (AP-143): the places that the built work, the rework steps 05c and 05d and the addenda О23–О36 of `decisions/0113` changed carry a note «As built» (sections 0, 4.1, 4.4, 7, 12, 13, 16, 21), and section 22 holds the counts read from the files, the differences, what is recorded outside this design and what is not proven.

---

## 0. Summary

- **What is built.** (1) The spec `tools/test/e2e/team-web.e2e.js`: seven tests `stand`, `create`, `finish`, `control`, `chat`, `failure`, `windows` for the criteria 1–7; criterion 8 is proved by commands. (2) Three new fixtures in `tools/test/fixtures/e2e/`: `team-slow.json` and `team-fail.json` (two scenarios of the scripted executor, checked by the real `parseScenario` at the start of the server) and `claude-trap.js` (the trap program, mode 0755). (3) **О1 (accepted, `decisions/0113`):** one more Chrome argument of the kit, `--use-mock-keychain` (`tools/test/e2e/kit/browser.js`): without it Chrome on macOS does not answer its first navigation when the spec process runs with a home folder under the temporary root, which rule R2-T of this run demands of every trial (F32). (4) Edits of four released kit tests (`E2K-25`, `E2K-41`, `E2K-50`, `E2K-60`, section 12). (5) `tools/README.md`, the section "End-to-end tests in a real browser": the budgets sentence, the keychain sentence, the table row (section 10).
- **No file in `tools/src/` changes**, no npm package, no change of `package.json`, of the starter `stand.js`, of `run.js` or of `runner.js` (`listSpecs` finds the new spec by its name, as for REQ-106). The scenario `tools/test/fixtures/team/engine-basic.json` is not changed.
- **The stand** is the released starter as it is (`decisions/0112`, О1). Each test makes one folder of its own under the temporary root and puts in it **a copy of the trap** and **a copy of the scenario**: rule P refuses an absolute path inside the repository in `env` (О14 of `decisions/0112`) and in an argument, and `SAI_TEAM_CLAUDE_BIN` must be absolute (F14), so the copies are the only way with no exemption (C-1, О3). `SAI_TEAM_HOME` is given through `stateEnv`; the home is the starter's private `<marker>/home`; `PATH` comes from the starter's base list and is never given in `env` (a `PATH`-like list is refused by rule P, О22 of `decisions/0112`; measured, F15); `SAI_TEAM_REAL_RUNS` is never given, and the environment the child would get is read from a start with a spawn that records and throws (rule R2-S of `docs/design/REQ-106-e2e-pixel-office.md`, section 6). The positive control of the trap runs the copy by its path, as the executor would start it, and sees its marker (C-2).
- **Facts re-checked on the tag** (section 1): every fact of the block "checked on 2026-11-03" holds, with three differences: the stop phrase «Проект остановлен. Продолжить его нельзя» is not in the README (it is the requirement's own text and `src/web/texts.js:24`, F6, О6); the sentence "no existing assertion counts files of tools/test/fixtures" is false (`E2K-50` asserts that every file of `tools/test/fixtures/e2e` is scanned, F34, О7); and the runner ratio "about 1.2–1.35" of the task holds for the picker readings of run `E2E105-20261105-01` only (F45). Found beyond the block: the page polls every 5000 ms (F19); a `goto` to an address that differs only by its `#` part fires no load event (F24); `textContent` reads hidden alternative sentences (F25); Chrome under a fresh home on macOS (F32); the failure costs 20 s more with the default retry pause (F26, О5); the page of an unwritable data folder (F27, О11); and, under rule R2-T, the released Pixel Office test `isolated start` and 146 released tests of `npm test` (among them three of criterion 8's command) cannot pass or cannot be run (F37, О2).
- **Time.** The prototype of the seven tests, by the real command `npm run -s e2e -- team-web`, in its final form: 35193 and 33577 ms (`duration_ms` of the record line, this Mac), 35209 ms under four busy loops; earlier forms 33703–39842 ms (F38); in the form of step 01c (after the findings of gate 1b): 34842, 34834 and 33885 ms. About 23 s of it are the product's own clock (two scenario delays of 5000 ms and three waits for the page's poll of 5000 ms), which no machine shortens or lengthens. Section 7 estimates the runner from the measured ratios of earlier files and says why it is an estimate.
- **Sizes** (each with its command in F46, AP-143). 8 criteria, 7 spec tests, 3 new fixtures, 4 released tests edited, 7 build sub-steps (1 for BACKEND-DEV, 6 for TEST-DESIGNER, section 14), 58 mutants in section 16 (56 applied in a sketch at step 01c: 55 red in the named test, 1 green on purpose because the criterion allows it; 2 on record, never applied), 18 open questions, 46 checked facts.
- **As built (step 10).** The counts above are those of the prototype at step 01c and stay as the design was checked. The built files (section 22): the spec 1369 lines, 7 tests, 108 `assert.`; 3 new fixtures; 4 released kit tests edited (`E2K-25`, `E2K-41`, `E2K-50`, `E2K-60`); the open questions grew to О1–О36 in the addenda of `decisions/0113`. The time of the built file: section 7, «As built».

---

## 1. Checked facts

Measured on 2026-11-16 from 15:39Z to 16:45Z, and at step 01c from 17:44Z to 17:57Z (clock `date -u`), macOS 27.2 arm64, 10 cores, Node v22.23.4, Google Chrome 157.0.8103.78. "Clone" means `git clone -b base/E2E107-20261116-01` into `<outside the project>/e2e107-01/clone`, then `npm ci` in `tools/`; "kitx" is a second fresh clone of the tag whose `browser.js` has the one argument of О1 and nothing else; "proto" is a third fresh clone in which the prototype was written (section 18). **Every Node process started from the shell of the trials ran with `HOME` and `SAI_TEAM_HOME` set to new folders under the temporary root, `SAI_TEAM_CLAUDE_BIN` set to a recording trap under it, no `SAI_TEAM_REAL_RUNS`, and two preloaded nets** (the tripwire of run `E2E106-20261115-01` and a net of this design that refuses any start of a program named `claude`, any start whose environment names `SAI_TEAM_REAL_RUNS`, and any start of the team server or the team command whose data folder, home or trap is not under the temporary root); both nets were tried on positive controls before they were relied on (F44). The children inherit them only where they inherit the environment: every team server of the probes and of the product mutants got the nets through its `env`; the team servers of the prototype runs got the starter's environment only (the private home, the data folder and the trap copy under the temporary root, no net); the stand-ins of the released kit tests are started by those tests with a short list and no `HOME` (by the design of REQ-104 and REQ-105) and read and write no home folder. [О19] The scope of rule R2-T (a) is that of `decisions/0113` О19: its words "or without `SAI_TEAM_HOME`" bind the programs of `tools/src/` (the team server, the engine, the team commands, Pixel Office); the kit's stand-ins (`fake-chrome.js`, `fake-stand.js`) and the trap copy read no team data folder and may start without it, as released; they never get the person's real home as `HOME`. No program file was imported to read it; files were read as text (`grep`, `sed`); one import of `src/team/executors/scripted.js` was made on purpose to call the real `parseScenario` on the two drafts (under the same environment and nets); its module and its imports were read as text right after it and hold definitions only, no top-level statement (F11).

| # | Statement | Command / sketch | Result |
|---|---|---|---|
| F1 | The tag holds the block REQ-107 with eight criteria, status `pending`; the tree differs in the status line only | `git show base/E2E107-20261116-01:docs/requirements.yaml`, the block cut by its id, `grep -c '^      - >-'`; `diff` against the block of the tree; `git diff --stat base/E2E107-20261116-01 -- . ':!handoffs'` | 8; one line differs (`status: in_progress`); the tree differs in `docs/requirements.yaml` (1 line) and `docs/program/public-v1/PROGRESS.md` |
| F2 | "Checked on 2026-11-03": `npm run team-web` takes `--port`, `--executor scripted` and `--scenario` | `grep -n 'const OPTIONS' tools/src/web/main.js`; `grep -n '"team-web"' tools/package.json` | `main.js:30` `["--port", "--executor", "--scenario"]`; `:53` the two executors; `:57` the scenario is required exactly with `scripted`; `package.json:19` `"node src/web/main.js"` — holds |
| F3 | The printed link line `Sai Team: http://127.0.0.1:<port>/` | `grep -n 'Sai Team: http' tools/src/web/main.js`; `HOST` in `src/web/config.js:5`; the probe through the starter | `main.js:185`; the starter's pattern `^Sai Team: (http://127\.0\.0\.1:\d+/)$` (multiline) matched in every start of every trial (stand up in 83–86 ms) — holds |
| F4 | The mark «тестовый исполнитель» | `grep -n testExecutor tools/src/web/texts.js`; `grep -n mark-test tools/src/web/public/index.html`; README line 506; the probe | `texts.js:8`; `index.html:165` (project page) and `:512` (list row); shown on the list row and the project page of a scripted project — holds |
| F5 | The six headings of the README | `grep -n '<h3 id="q[1-6]">' …/index.html`; README lines 516–521; the probe | `index.html:253…323` in the README order; all six shown on the project page — holds |
| F6 | The button names and the pause and stop phrases of the README; the confirmation «Не останавливать» | `index.html` (`ctl-pause`, `ctl-resume`, `ctl-stop`, `stop-no` at `:219`); README lines 542–544; `grep -n 'paused:\|stoppedFinal:' …/texts.js`; `grep -c` of each phrase in `tools/README.md` | «Пауза», «Продолжить», «Остановить», «Не останавливать» — hold; the pause phrase «Проект на паузе. Нажмите «Продолжить», чтобы работа пошла дальше» is `texts.js:15` and is in the README (count 1); **the stop phrase «Проект остановлен. Продолжить его нельзя» is `texts.js:24` and is not in the README (count 0)**: its oracle is the requirement's own text (О6) |
| F7 | The journal event names of pause, stop and message | `grep -n '"PROJECT_PAUSED",\|"PROJECT_STOPPED",\|^  CHAT: type' tools/src/team/schema.js`; the probes | `schema.js:154`, `:156`, `:223`, `:239` (`PROJECT_PAUSED`, `PROJECT_STOPPED`, source `USER`), `:265` (`CHAT`, `data.text`, `data.kind`); measured: `PROJECT_PAUSED`, `PROJECT_RESUMED` (`after: "command"`), `PROJECT_STOPPED`, `CHAT` from `USER` with the sent text — holds |
| F8 | «N из M задач» | `texts.js:113–115` (`progressOf`); README line 523; the probe | the finished project of `engine-basic.json` reads «2 из 2 задач»; the plan run of that scenario has 2 tasks — holds |
| F9 | «Попытка не удалась» | `grep -n 'Попытка не удалась' tools/src/team/language.js`; `SCRIPTED_SUFFIX` at `language.js:13`; the probe | `language.js:256` (`RUN_FINISHED`, outcome `failed`); on the page the phrase is «Попытка не удалась — тестовый исполнитель», the first (oldest) of the five phrases of «Что происходит» once the task failed — holds, with the suffix |
| F10 | The write key and the `Origin` check | `tools/src/web/server.js:326–347`; `config.js:20` (`x-sai-page`); README "Security" | a write needs `Origin` = `http://127.0.0.1:<port>` or `http://localhost:<port>`, the JSON type and the page's key (compared with `timingSafeEqual`); the key lives in memory only — holds; the spec drives the page and never posts by hand |
| F11 | `parseScenario` at the start; a wrong scenario stops the start | `main.js:63–74`, `:104–111`; the two drafts given to the real `parseScenario` (an import of `src/team/executors/scripted.js`, whose module and imports hold no top-level statement: `grep -cE` of top-level calls → 0 in each of the fourteen files); mutant S02 | both drafts → OK (4 runs, 2 runs), `engine-basic.json` → OK; S02 (`delay_ms` 60001): the server ends with code 1 before its link, stderr «Файл сценария не найден или неверен», the starter throws `STAND_START_EXITED` — holds |
| F12 | A delay step in the scenario format | `scripted.js:25` (`DELAY_MS_MAX` 60000), `:87–94`, `:259–262` | `{ "delay_ms": <whole number 0…60000> }`, the only key of its step; the delay is aborted by the run's signal (a stop or the server's `SIGTERM`); measured: `SIGTERM` during a delay ends the server with code 0 in 19 ms, the journal ends with `TASK_INTERRUPTED`, `PROJECT_PAUSED` — holds |
| F13 | The words of the empty list | `index.html:59–62`; the probe | «Проектов пока нет. Опишите цель одной фразой — и команда возьмётся за работу.» shown, no row; the README does not quote these words (О6) — holds |
| F14 | `SAI_TEAM_CLAUDE_BIN` must be absolute | `tools/src/team/config.js:69–77` | unset → `"claude"` looked up in `PATH`; given and not absolute → `E_CONFIG`, exit 2 at the start; so the trap is given as an absolute path, which rule P judges |
| F15 | The team server needs no `PATH` in `env`; `PATH` in `env` is refused | `stand.js` `namedBase` (the base list holds `PATH`); `src/web/engines.js:1–4` ("the server starts no process"); mutant T05 | the stand runs with the base list only; `env: { PATH: <the spec's PATH> }` → `PATH_REFUSED` (rule P takes the list as one absolute path, О22) |
| F16 | Rule P on the stand of this design | the probe; the test `stand` of the prototype | accepted: `stateEnv SAI_TEAM_HOME = <root>/data`, `env SAI_TEAM_CLAUDE_BIN = <root>/trap/claude-trap.js`, the argument `--scenario <root>/scenario.json`; refused (`PATH_REFUSED`, the recording spawn not called, no `sai-e2e-*` folder left): the repository trap in `env`, the repository scenario as the argument, a data folder inside the repository; the recorded child environment: the base names present in the spec process, `SAI_TEAM_HOME`, `SAI_TEAM_CLAUDE_BIN`, `HOME`, `USERPROFILE`, no other name |
| F17 | The start writes nothing; the first project makes the data folder | the probe | after the link the data folder does not exist; after the first create it holds one project folder `p-<date>-<hex>` with `events.jsonl`, `files`, `inbox`, `scenario.json`, `work` |
| F18 | A copied file keeps the mode of its source; the copied trap runs by its path | the probe | `copyFileSync` of a 0644 file gives 0644 (so the spec sets the copy's mode itself, 0700); the copy (module syntax, no `package.json` near it) started by its path through its first line `#!/usr/bin/env node`: exit 1, the marker written, no stderr |
| F19 | The page polls every 5000 ms | `tools/src/web/public/app.js:16` (`REFRESH_MS`), `:271–284`; `index.html` «обновление раз в 5 секунд» | a new screen polls at once, a control press polls at once after its answer (`submitControl` calls `poll()`); every other change is seen at the next poll, at most 5000 ms plus the request |
| F20 | `engine-basic.json` runs to the end quickly | the probe | `PROJECT_DONE` 261 ms after `PROJECT_CREATED`; the project page, opened by the create, shows «выполнен», «2 из 2 задач», four result files, no button and no control block 316 ms after the click |
| F21 | Pause, continue and stop on `team-slow.json` | the probe `p2` | from the create: «в работе» with «Пауза» and «Остановить» at 0.7 s; after «Пауза» at 0.84 s the status «на паузе», the pause phrase, «Продолжить» and «Остановить»; after «Продолжить» at 0.95 s «в работе» again; a second project: the confirmation with «Не останавливать» and «Остановить», «Не останавливать» leaves no stop event; the stop at 1.3 s: «остановлен», the stop phrase, no button; a new tab the same; the first project «выполнен» at 13.05 s (its `PROJECT_DONE` 10.24 s after its create) |
| F22 | A pause does not stop a run in progress | the journal of `p2` | `PROJECT_PAUSED` at +129 ms and `PROJECT_RESUMED` at +246 ms, while the first work run went on to its `RESULT_FILE` at +5073 ms (README: "those in progress are brought to the result") |
| F23 | After a stop the same tab keeps the control block | the probe | the block stays shown with «Отправлено» and no button; a tab opened anew shows no control block |
| F24 | **A kit trap:** `page.goto` to an address that differs only by its `#` part fires no load event | the probes `p2`, `p6` | `NAVIGATION_FAILED … no load event in 15000 ms`; a full navigation from a project address to the bare link works, a `goto` of a project address in a new tab (from `about:blank`) works, and a project is opened from the list by a click of its row |
| F25 | **A kit trap:** `textContent` reads hidden alternative sentences | the probe | the control result line reads «Отправляется… Отправлено Нет связи с сервером Sai. …» by `textContent` and «Отправлено» by `innerText`; the offline sentences of the page are always in the document, hidden |
| F26 | The failing task (`team-fail.json`) | the probe `p3`, twice | with `SAI_TEAM_RETRY_DELAY_MS` = `0`: three failed attempts, `TASK_FAILED` (`retries_exhausted`) at +130 ms, `PROJECT_WAITING` (`task_failed`), a question in the chat; the failed row on the page 5176 ms after the click (the next poll); with the default 10000 ms: 25134 ms; the page: «Есть ли проблема» names the role, the task text of the plan and the reason «Исследователь: задача не получилась — тестовый исполнитель», the waiting text «Задача не получилась — нужно ваше решение»; no `^\s+at `, `undefined`, `[object`, `Error:` in `innerText` or `textContent` of the body; the status «ждёт решения пользователя» with «Пауза» and «Остановить»; the list loads, a second project is created; `SIGTERM` → code 0 in 15 ms |
| F27 | A data folder under a regular file | the probes `p4a`, `p5` | the starter accepts `SAI_TEAM_HOME = <root>/f/home` (`f` a file); the page answers 200; the error bar and the create result both read «Что-то пошло не так. Повторите позже» (tone `err`, no navigation), the list stays «Загрузка…» with no row; the folder `<root>` lists the same names before and after, `f` keeps its bytes, `<root>/f/home` gives `ENOTDIR`; the next request answers 200 and the process runs; the server's stderr holds one line `Sai Team: E_HOME: Папка данных Sai Team недоступна: ENOTDIR`; every answer 500 of `/api/projects` writes the browser line «Failed to load resource: the server responded with a status of 500 (Internal Server Error)» with the path `/api/projects` |
| F28 | The chat | the probe `p4b` | `<b>привет</b> & «тест»` appears in the list 56 ms after the click as that text, with no element made from it; the journal holds one `CHAT` from `USER` with the same text; with an empty field and with blanks the send button is `disabled`; a click and Ctrl+Enter then leave the journal the same size and sha256 |
| F29 | `SIGTERM` while a delay runs | the probe `p4c` | code 0 in 19 ms (the delay is aborted, F12) |
| F30 | The three windows | the probe `p6` | in 1470×784, 390×844 and 320×568 the create button is inside the window before and after it is scrolled into view, no unexpected console entry on the list page and the project page; no horizontal overflow on either page (`horizontalOverflow`, measured for the question of the block, not asserted) |
| F31 | The favicon line | the probes and the prototype | one «Failed to load resource: the server responded with a status of 404 (Not Found)» for `/favicon.ico` per browser start; with two tabs one line in each of the 2 probes (read from the entries) and in the 3 prototype runs of `control` that declared it once per start (runs 1–3) |
| F32 | **Chrome under a home below the temporary root on macOS** | the probe `p0b` with the released kit and with kitx; `npm run -s e2e -- smoke` with the released kit | released kit: `CALL_TIMEOUT Page.navigate: no answer in 8000 ms`; the released smoke spec: `SPEC_TIMEOUT` after 120 s; kitx (`--use-mock-keychain`): `goto` answered in 789 ms; Chrome wrote nothing into that home. A trial with the person's home for Chrome was not made (rule R2-T) |
| F33 | `E2K-25` pins the exact Chrome argument list | `tools/test/e2e-kit.test.js:1697–1715`; proto after sub-step 1 | with the one argument added: the two kit files → `# tests 74`, `# pass 73`, `# fail 1` (`E2K-25` only) |
| F34 | **`E2K-50` asserts that every file of `tools/test/fixtures/e2e` is scanned** (or lies under `specs/` or `tap/`) | `e2e-kit.test.js:3796–3803` (`SCANNED`), `:3891–3898`; proto with the three fixtures and no `SCANNED` entry | red with `claude-trap.js,…,team-fail.json,team-slow.json`; green with the three entries; so the block's "no existing assertion counts files of tools/test/fixtures" is not true (О7) |
| F35 | `E2K-41`, `E2K-60` read the README section | `e2e-kit.test.js:3395`, `:3425`; `:3904–3970` | `E2K-60` needs the token `REQ-107` (today in «REQ-107 adds its row.»; after the edit in the row) and the three rows; `E2K-41` the budget words; both green after the README edit of section 10, before and after their own edits |
| F36 | The guard search | `grep -ln 'End-to-end tests in a real browser'`, `grep -lnE 'fixtures/e2e\|test/e2e'` over `tools/test/*.js`; `grep -nF 'readdirSync(FIXTURES'`; the top-level scans named in REQ-106 F22 | readers of the README section and of the two folders: `e2e-kit.test.js`, `e2e-stand.test.js` only; `EX-07` reads `scenario-*.json` of `fixtures/team` and `EX-21` `stream-*.jsonl` there (the new files are not there); `E2K-30` runs the runner on `fixtures/e2e` and expects `NO_SPECS` (`:2290–2298`; the new files are not `*.e2e.js`); the prefix scans read the top level of `tools/test` only |
| F37 | **Under rule R2-T** (the spec process's home under the temporary root, the nets) | the tag clone, kitx and proto | (a) the released Pixel Office test `isolated start` is red on kitx too (its first refusal row is the home folder of the spec process, which is then under the temporary root, so it reaches the throwing spawn: `STAND_START_FAILED` instead of `PATH_REFUSED`; nothing started); (b) `npm test`: 2209 tests, 146 red on the tag and 146 on proto, the two lists of red names identical (`diff` empty); the red tests start the team command or the server with `SAI_TEAM_REAL_RUNS=1` and a fake Claude program of `tools/test/fixtures/team/`, which the net refused (over all trials its log holds 284 refused starts naming `SAI_TEAM_REAL_RUNS`, 8 naming only that program's repository path and 2 starts of a team command with no data folder under the temporary root, all from released tests, besides its 3 control lines); among them the three `EX-51` tests of `exec-scripted-source.test.js`, part of criterion 8's last command (the file's other three tests, `EX-07` among them, and the three of `exec-docs.test.js` pass) |
| F38 | The prototype of the seven tests by the real command | proto, `<outside the project>/e2e107-01/sk/run1.txt` … `run8.txt`, `load1.txt` | first form (two chat polls): 39652, 38911, 39842 ms; one chat poll: 34958, 33703, 33819 ms; under four busy loops 35209 ms; final form: 35193, 33577 ms. Per test of the final form (ms): `stand` 1612/1226, `create` 1599/1578, `finish` 1371/1335, `control` 14148/13242, `chat` 6351/6342, `failure` 7631/7597, `windows` 1893/1762. Step 01c form (`run11.txt` … `run13.txt`): 34842, 34834, 33885 ms; per test (ms) `stand` 1206–1581, `create` 1604–1614, `finish` 1355–1379, `control` 13314–14266, `chat` 6376–6410, `failure` 7609–7638, `windows` 1888–1941; the kit and starter files 74 of 74 |
| F39 | The independence loop of REQ-104 criterion 7 | proto, the loop over the seven names | each name alone: exit 0, exactly one `ok ` line `ok 1 - <name>`, no `not ok` |
| F40 | The order check | proto | `ls test/e2e/*.e2e.js \| … \| sort -r` → `team-web smoke pixel-office picker`; `npm run -s e2e -- team-web smoke picker` → exit 0, the files in that order, `e2e: browser=` once, `duration_ms=67504` (team-web 7/7 in 33627 ms, smoke 13/13, picker 9/9); with `pixel-office` in the list the run stops at its red `isolated start` (F37 a); `npm run -s e2e -- team-web team-web` → exit 1, `SELECTION_DUPLICATE` |
| F41 | Traces and the greps of criterion 8 | proto with the new files staged (no commit) | `node src/traces/cli.js` → exit 0, 2523 files, 0 traces; its output holds no `tools/test/e2e/team-web` or `tools/test/fixtures/e2e` (0); `grep -nE '\.skip\(\|\.todo\(\|\|\| true'` → no line; `grep -n SAI_TEAM_REAL_RUNS` → one line, which only reads it (`!(… in opts.env)`) |
| F42 | Format and rules | proto | `npx prettier --check .` and `npx eslint . --max-warnings 0` → clean with the new and changed files |
| F43 | The mutants | `<outside the project>/e2e107-01/mut/harness.py`, `batch1.jsonl` … `batch4.jsonl` (step 01), `batch5.jsonl` … `batch8.jsonl` (step 01c) | section 16: at step 01 50 applied, 49 red, 1 green on purpose (P19); at step 01c, on the changed files, the 50 again and 6 new (V03, V06, V06j, V15, V18, V21): 55 red in the named test, P19 green on purpose; the controls C01–C03 green; every run left no process and no `sai-e2e-*` folder |
| F44 | **The owner's real folders were not touched** | before the first trial (2026-11-16T15:39:19Z) and after the last (16:45:17Z): `.sai-team` in the person's home folder, and `shasum -a 256` of the five files of the default Pixel Office state folder (read only) | `.sai-team`: absent before and after; the five sha256, sizes and times of last change the same (the values are in `result.self_check` of the handoff); the nets' positive controls refused a start of `claude`, a start with `SAI_TEAM_REAL_RUNS`, a team server without a data folder under the temporary root, and a start naming the real Pixel Office folder, and let a clean start through |
| F45 | Runner readings of earlier files (other files, other days) | the handoffs of runs `E2E105-20261105-01` (steps 06, 09) and `E2E106-20261115-01` (steps 06, 09) | picker: 20035 and 22050 ms on the runner against 16547 and 16294 here (1.21, 1.35), then 17347 and 17770 against 16498 and 16509 (1.05, 1.08); pixel-office: 21337 and 21582 against 21782 and 21797 (0.98, 0.99); smoke: 1.46 and 2.0 in run `E2E104-20261103-01`, 0.90 and 0.93 in run `E2E106-20261115-01` (14969 and 15435 ms against 16697 and 16645); before its first file `npm run e2e` spent about 14–17 s on the runner (step 06 issue I2, step 09 issue I8 of `E2E106-20261115-01`) |
| F46 | **Counts (AP-143), with the commands** | this file and proto | criteria: F1; spec tests: `grep -c '^test(' tools/test/e2e/team-web.e2e.js` → 7 in proto (819 lines, 86 `assert.` at step 01; 870 lines, 94 `assert.` at step 01c); kit tests: `grep -c '^test($' tools/test/e2e-kit.test.js` → 52 before and after, 537 `assert.` on the tag; mutants: `sed -n '/^## 16\./,/^## 17\./p' docs/design/REQ-107-e2e-team-web.md \| grep -cE '^\| [TPSKGV][0-9]{2}[a-z]? '` → 58; open questions: `sed -n '/^## 19\./,/^## 20\./p' … \| grep -c '^\| О'` → 18; facts: `sed -n '/^## 1\. Checked facts/,/^## 2\./p' … \| grep -c '^\| F[0-9]'` → 46 | section 0 |

Statements of the requirement that were **checked and held**: the command and its options, the link line, the mark, the six headings, the three buttons and «Не останавливать», the pause phrase of the README, the journal event names, «N из M задач», «Попытка не удалась» (with the suffix of the scripted executor), the write key and the `Origin` check, `parseScenario` at the start, the delay step, the words of the empty list, `engine-basic.json` (a plan of two tasks, work, check and goal check). **Different from the block** (each an open question, none settled silently): the stop phrase is not in the README (О6); the guard-test sentence (О7); "`HOME` is another new folder" is now the starter's private home and "`SAI_TEAM_CLAUDE_BIN` points to a trap program (a script in tools/test/fixtures/e2e/)" is a copy of that script under the temporary root (О3). **Not measured, not assumed:** the time of this file on the GitHub runner (section 7); the behaviour of `--use-mock-keychain` on Linux (the first GitHub run is the measurement, О1); a run of this spec with the person's home as the spec process's home (rule R2-T).

---

## 2. Design choices that could be disputed

| # | Choice | Default | Why | Question |
|---|---|---|---|---|
| C-1 | The trap and the scenario are **copied** into the test's folder under the temporary root; no exemption of rule P | yes | rule P refuses an absolute repository path in `env` and in an argument (F16); `SAI_TEAM_CLAUDE_BIN` must be absolute (F14); a relative scenario path would pass only because rule P does not judge relative values (a known limit: `docs/design/REQ-106-e2e-pixel-office.md` 4.1, «As built» item 5), not because it is allowed; a copy needs no change of the kit; [F8] the sha256 of each copy, the trap and the scenario, is asserted equal to its source right after the copy | О3 |
| C-2 | The trap writes its marker **next to itself** (`<trap folder>/started`), reads no variable, ends with code 1; the control starts the copy **by its path** with a short environment (`PATH`, a `HOME` of the test) | yes | the executor `claude-cli` passes only its allowed names (`config.js` `CHILD_ENV_ALLOW`), so a marker path in a variable would not reach the trap; a start by its path proves the copy is executable, as `spawn(claudeBin, …)` would need; one reading `trapStarted(folders)` serves the control and the end check, so the control proves the check can see a start (lesson of AP-153); [О19] the copy reads no team data folder and starts without `SAI_TEAM_HOME`, never with the person's real home as `HOME` (`decisions/0113` О19) | — |
| C-3 | The data folder is `<root>/data` and is **not made** by the test | yes | the README says the start writes nothing; the test `stand` asserts the folder does not exist after the start (F17) | — |
| C-4 | "At the end of the whole file" is met by an **end check at the end of every test** with a server (the trap's marker absent; the rows with the mark equal the project folders), not by a file-level hook | yes | each test has its own server, folders and trap copy (the independence loop); a hook outside a `test()` is not part of the spec format of the README ("top-level `test()` calls only") | О4 |
| C-5 | `SAI_TEAM_REAL_RUNS` is checked in the environment the child **would** get, by a start with a spawn that records and throws (R2-S), shape only | yes | the real child's environment cannot be read without a change of the server; the recorded call is the same code path; the shape check prints names and counts, never a value (`decisions/0112`, О24) | — |
| C-6 | The failure stand gets `SAI_TEAM_RETRY_DELAY_MS` = `0` | yes | three failed attempts with the default 10000 ms pause cost 20 s more (F26); the setting is a value of the README "Other settings", not a path; criterion 6 does not name the pause | О5 |
| C-7 | The kit gets `--use-mock-keychain` | yes | rule R2-T of this run needs it for every local trial on macOS (F32); [F7] measured: with it Chrome answers its first navigation under such a home, without it it does not; what it does to the person's keychain was not measured — the switch is named in Chromium for a mock keychain on macOS, for tests, and its name stands in the Chrome binary of this machine (read as data: 2 hits) | О1 |
| C-8 | The page text is read as the visitor reads it: `innerText` of shown elements; `textContent` only as a stricter second reading in `failure` | yes | F25: `textContent` reads hidden alternatives (AP-145, item 4) | — |
| C-9 | Another project is opened by a click of its list row; the new tab opens a project address by `goto` from `about:blank` | yes | F24: a `goto` that changes only the `#` part fails after 15 s | — |
| C-10 | The favicon line is declared once per start in the one-tab tests and "at least one" in `control` | yes | F31; the second tab's request depends on the browser's cache, not on the page | О10 |
| C-11 | The words of the empty list are pinned in the spec as measured on the tag | yes | no README sentence quotes them (F13); "not a blank page" needs a positive reading | О6 |
| C-12 | The spec does not assert its own run time | yes | as REQ-105 C-7 and REQ-106 C-7 (`decisions/0109`, О11): the limit is read from the record line and the runner's job log | О9 |
| C-13 | No refusal row names the person's home folder or the real data folder | yes | under rule R2-T the spec process's home lies under the temporary root, so such a row is not refused there (F37 a shows the shape in the Pixel Office spec); rule P itself is pinned by `E2S-03`; the rows of `stand` name repository paths only | — |

---

## 3. Files, owners, order

Paths from the root of Sai. "New" = created by this work.

| File | Change | Owner | Sub-step |
|---|---|---|---|
| `tools/test/e2e/kit/browser.js` | one argument `--use-mock-keychain` right after `--no-first-run` in `buildArgs` (О1) | BACKEND-DEV | 1 |
| `tools/README.md` | the section "End-to-end tests in a real browser": the budgets sentence, the keychain sentence, the table row (section 10) | BACKEND-DEV | 1 |
| `tools/test/e2e-kit.test.js` | `E2K-25`: the expected list gets the argument (section 12, row 1) | TEST-DESIGNER | 2 |
| `tools/test/fixtures/e2e/claude-trap.js` | new, mode 0755 (4.3) | TEST-DESIGNER | 3 |
| `tools/test/fixtures/e2e/team-slow.json`, `team-fail.json` | new (4.2) | TEST-DESIGNER | 3 |
| `tools/test/e2e-kit.test.js` | `E2K-50`: `SCANNED` gets the three fixtures — **in the same change as the files** (section 12, row 2) | TEST-DESIGNER | 3 |
| `tools/test/e2e/team-web.e2e.js` | new, the seven tests (4.4) | TEST-DESIGNER | 4a–4c |
| `tools/test/e2e-kit.test.js` | `E2K-50`: `SCANNED` gets the spec, with the spec, and the assertion that every spec file is scanned [F3] (4a); `E2K-41`, `E2K-60`: the words and the row (section 12, rows 3, 4) | TEST-DESIGNER | 4a |

О1 was accepted (`decisions/0113`); had it been answered "no kit change", sub-step 1 holds only the README (without the keychain sentence) and is written by TEST-DESIGNER (the owner of the block), sub-step 2 does not exist, and `E2K-25` is not edited; BACKEND-DEV step 2 is then recorded as not needed.

No file is written by two roles. `tools/src/`, `tools/package.json`, `tools/package-lock.json`, `tools/test/e2e/run.js`, `kit/runner.js`, `kit/stand.js`, `kit/cleanup.js`, `kit/guards.js`, `kit/page.js`, `kit/errors.js`, `kit/index.js` (the exports stay: `startStand`, `withStand`, `withBrowser`, `makeTempDir`, `removeTempDir`, `tempRoot`, `E2eError`), `tools/test/fixtures/team/`, `tools/test/e2e-stand.test.js`, `.github/`, `decisions/` and the other blocks of `docs/requirements.yaml` are not changed.

**Words in files (as REQ-104…106, section 3).** The two sandbox flags and the skip words (`.skip(`, `.todo(`, `|| true`, `eslint-disable`, the options `{ skip`, `{ todo`) stand in no new or changed file, comments included (`E2K-25`, `E2K-50`, the grep of criterion 8). No file holds a secret shape (`E2K-50` `SECRET_SHAPES`). No line of the spec gives `SAI_TEAM_REAL_RUNS` a value; the spec reads the environment only as `process.env.PATH` (in `ENV_NAMES` of `E2K-50`; a computed `process.env[…]` read turns `E2K-50` red, measured in the first form of the prototype).

Order: the kit argument and the README first (sub-step 1), then the kit-test edit, then the fixtures with their `SCANNED` entries, then the spec with its entry and the two README guards.

---

## 4. Interfaces

All kit functions throw `E2eError` with a code of the table of REQ-104 4.1. The spec prints nothing; its red messages hold names, counts, `true`/`false` and the texts of the page and of the requirement, never a value of the environment of the spec process and never a listing of a folder it did not make (`decisions/0112`, О24; AP-152).

### 4.1 The stand of the team server (the released starter, invented values)

`teamOptions(folders, env = {})` → the options of `startStand` / `withStand`:

| Field | Value |
|---|---|
| `name` | `"team"` |
| `args` | `["src/web/main.js", "--port", "0", "--executor", "scripted", "--scenario", folders.scenario]` |
| `readyPattern` | `^Sai Team: (http://127\.0\.0\.1:\d+/)$` with the flags `m` and `u` |
| `stateEnv` | `{ SAI_TEAM_HOME: folders.data }` |
| `env` | `{ ...env, SAI_TEAM_CLAUDE_BIN: folders.trap }` — [F2] the trap **last**, so no given name can replace it; `teamOptions` first asserts that every name of `env` is in `EXTRA_NAMES` = `["SAI_TEAM_RETRY_DELAY_MS"]` (`teamOptions: <name> may not be given`), and only `failure` gives it, with `"0"` (C-6); so the server gets nothing else, never another trap, `PATH`, `HOME`, `USERPROFILE`, `NODE_OPTIONS` or `SAI_TEAM_REAL_RUNS` |
| `cwd`, `startTimeoutMs`, `stopTimeoutMs` | the starter's defaults (`<repo>/tools`, 15000, 10000; `SIGTERM` ends the server in 2–22 ms in every trial, F26, F29) |

`testFolders(scenario)` → `{ root, data, trap, marker, scenario }`:

| Field | Shape and rule |
|---|---|
| `root` | `makeTempDir("team-web")` — a new folder `sai-e2e-team-web-…` under the temporary root, removed by `removeTempDir` in a `finally` (`inFolders`) |
| `trap` | `<root>/trap/claude-trap.js`: the folder made with mode 0700; a byte copy of `tools/test/fixtures/e2e/claude-trap.js` (`copyFileSync`); [F8] its sha256 is asserted equal to the source's at once (`assert.ok(a === b, "the trap copy is exact")`); then mode 0700 set on the copy (F18) |
| `marker` | `<root>/trap/started` — the file the trap appends to; never made by the spec |
| `scenario` | `<root>/scenario.json`: a byte copy of the given scenario file; its sha256 is asserted equal to the source's at once (`assert.ok(a === b, "the scenario copy is exact")`, so a red message prints no hash) |
| `data` | `<root>/data` — not made (C-3) |

What the server gets (F16): `HOME` and `USERPROFILE` = the starter's `<marker>/home`; `SAI_TEAM_HOME` = the real path of `<root>/data`; `SAI_TEAM_CLAUDE_BIN` = the real path of the trap copy; `--scenario` = the real path of the scenario copy; the base names of the starter that the spec process has. What it does not get: the variables of the developer's shell, `SAI_TEAM_REAL_RUNS`, `NODE_OPTIONS`.

The second server of `failure` uses `{ ...teamOptions(folders), stateEnv: { SAI_TEAM_HOME: <root>/f/home } }`, where `<root>/f` is a regular file the test writes first (F27).

**As built (step 10).** The signature is `teamOptions(folders, { env = {}, data = folders.data } = {})`: `env` may name only `EXTRA_NAMES`, and `data` replaces the data folder, so the second server of `failure` is `teamOptions(folders, { data: <root>/f/home })` with no spread at the call site (`decisions/0113` О23; `handoffs/E2E107-20261116-01/step-05-test-designer.json`, issue I2 (a)). The options are frozen (the object, its `args`, `stateEnv` and `env`) and known by their object in a `WeakMap` (`MADE`, options → folders); the folders of each test are frozen and known in a `WeakSet` (`OWN_FOLDERS`). The refusal rows of `stand` (b) are made by `teamOptions` too, from a changed copy of the folders object (step 05, issue I2 (b)). The rest of the table holds as written.

### 4.2 The two scenarios (shape; the texts are invented, Russian, and appear in no code of `tools/src/team`)

Both have the form of `docs/design/REQ-010-agent-executors.md` 6.2 (`{ version: 1, runs: [{ match, steps, result }] }`) and are checked by the real `parseScenario` when the server starts (a wrong one stops the start, F11). Every `result` has `cost_usd` 0.01.

`team-slow.json` — the shape of `engine-basic.json` with a delay in each work run:

| Run | `match` | `steps` | `result` |
|---|---|---|---|
| plan | `{ purpose: "plan" }` | one `activity` | `ok`; `answer.tasks`: **two** tasks (`researcher`, then `marketer` depending on it), `critical: false` |
| work | `{ purpose: "work" }` | one `activity`, then `{ delay_ms: 5000 }` | `ok`; `answer` `{ summary, files: [] }`; one result file |
| review | `{ purpose: "review" }` | one `activity` | `ok`; `answer` `{ passed: true, notes }` |
| goal_check | `{ purpose: "goal_check" }` | one `activity` | `ok`; `answer` `{ passed: true, notes }` |

Rules kept by the test `control` [F1]. (1) From the file, before the stand: (sum of `delay_ms` of the work run) × (number of plan tasks) ≥ 10000, **and the plan tasks form a chain**: every task after the first has `depends_on` equal to `[<the key of the task before it>]`. The chain is needed because the engine runs independent tasks two at a time (`PARALLEL_DEFAULT` = 2, `tools/src/team/engine/schedule.js:9`): without it the two delays overlap, and the gate's mutant V06 (the dependency removed) was in work only 5232 ms. (2) From project A's journal, after its end: the time of `PROJECT_DONE` minus the time of the first `TASK_STARTED` is at least 10000 ms (`assert.ok`, "in work for 10 s at least (the journal)"; measured 10183 ms at step 01, F21, PROJECT_CREATED to PROJECT_DONE 10236 ms). Rule (1) catches V06 before any start; rule (2) catches the same breakage when rule (1) is removed (V06j).

`team-fail.json` — every attempt of the task fails:

| Run | `match` | `steps` | `result` |
|---|---|---|---|
| plan | `{ purpose: "plan" }` | one `activity` | `ok`; `answer.tasks`: **one** task (`researcher`, `critical: false`) |
| work | `{ purpose: "work" }` | one `activity` | `{ outcome: "failed", cost_usd: 0.01 }` |

There is no review or goal-check run: the plan's only task never reaches them (F26). The oracles the tests read from the files: the number of plan tasks (`finish`, `control`), the text of the plan task (`failure`), the delay rule (`control`). A file without a plan run fails the spec's own reading with a named assertion (`planTasks` asserts `the plan run of <file name>`; mutant S04 showed a bare `TypeError` without it).

### 4.3 The trap `tools/test/fixtures/e2e/claude-trap.js`

A Node program of the project, mode 0755, first line `#!/usr/bin/env node`, written as a module (`import`), with a header comment that says what it is (as `fake-chrome.js`). Contract:

- it never calls a model, never opens a connection and never reads a variable or stdin;
- when started, it appends one line (its pid) to the file `started` in **its own folder** (the folder of the running file, not the working folder: mutant T02), and ends with exit code 1, so a run of a project that started it fails at once;
- it writes nothing else.

It is not started in the repository by anything: the spec starts only its copy (4.1), and only in the positive control. `E2K-50` scans it (section 12, row 2).

### 4.4 `tools/test/e2e/team-web.e2e.js`

Top-level `test()` calls only, seven of them, in this order, each with `{ timeout: 90000 }`; each makes its own folders (`inFolders`), starts its own server (`withStand`, in `failure` `startStand` with a `finally` that stops it) and its own browser (`withBrowser`), and shares nothing with another test. The goals of the projects are invented phrases, one per project.

**Constants (the oracles are the requirement's text, the README and the measured words of the tag, not `src`).** `LINK` (the pattern of 4.1); `EMPTY_WORDS` (F13, О6); `MARK` «тестовый исполнитель»; `HEADINGS` (the six of the README); `IN_WORK` «в работе», `DONE` «выполнен» (README "Completion"); `PAUSE`, `RESUME`, `STOP`, `DONT_STOP` (the four button words); `PAUSED_WORDS` (README "Stop"); `STOPPED_WORDS` (the requirement, О6); `FAILED_WORDS` «Попытка не удалась»; `CHAT_TEXT` `<b>привет</b> & «тест»`; `BAD` = `^\s+at ` (multiline), `undefined`, `[object`, `Error:`, and [О21] beyond the letter of criterion 6 the shape of a code of `tools/src/team/errors.js`: `E_` followed by a capital and then capitals, digits or `_`, not preceded by a letter, a digit or `_`; `EXTRA_NAMES` (4.1) [F2]; `BASE_NAMES` (the eight names of the starter's base list, `tools/README.md` "Servers for the page specs"); `FAVICON` (F31); `LIST_500` (F27: the 500 line with the path `/api/projects`).

**Helpers** (functions and page-code strings of the file, none exported):

| Helper | Does |
|---|---|
| `testFolders`, `inFolders`, `teamOptions` | 4.1 (`teamOptions` asserts that its `env` names only `EXTRA_NAMES` and merges the trap last [F2]; `testFolders` asserts both copies exact [F8]) |
| `trapStarted(folders)` | `existsSync(folders.marker)` — the one reading used by the control and by the end check (C-2) |
| `runTrap(folders)` → exit code | starts the copy **by its path** with `env: { PATH: process.env.PATH, HOME: <root>/trap-home }` (made 0700), `cwd: <root>`, stdio ignored; waits for `close` at most 10000 ms, then kills its pid and rejects |
| `projectIds(folders)` | the names of `folders.data` that match `^p-[0-9]{8}-[0-9a-f]+$`, sorted; `[]` when the folder does not exist |
| `journal(folders, id)`, `typesOf(folders, id)` | the parsed lines of `<data>/<id>/events.jsonl`; their `type`s in order |
| `scenarioOf(file)`, `planTasks(file)` | the parsed scenario; the `tasks` of its plan run, asserted present |
| `envShape(env, wanted)` | as `tools/test/e2e/pixel-office.e2e.js`: `{ plain, symbols, names ∩ wanted (sorted), others (a count) }`, names read with `for…in` |
| `kitFolders()` | the `sai-e2e-*` names of the temporary root |
| `assertPlain(text, what)` | a non-empty text with none of `BAD` (the four marks of criterion 6 and the code shape [О21]); the message names `what` and the pattern, not the text |
| `shown(id)` (page code) | the element exists, is not `hidden` and has a client rectangle |
| `textOf(id)` (page code) | the `innerText` of a shown element, its white space folded, else `null` (C-8) |
| `STATUS`, `statusIs(word)`, `BUTTONS` | the shown text of `#project-status`; the words of the shown buttons among `#ctl-pause`, `#ctl-resume`, `#ctl-stop`, in that order |
| `HEADINGS_SHOWN`, `ROWS`, `ROW_GOALS`, `MARKED_ROWS`, `ON_PROJECT`, `PHRASES` | the shown `h3` of `#answers`; the count of `#projects > li`; their `.pcard-goal` texts; the rows whose `.mark-test` is shown and reads `MARK`; `location.hash` starts with `#/projects/`; the texts of `#happening .phrase-text` |
| `openList(page, stand)` | `goto(stand.url)` → status 200 |
| `createProject(page, goal)` | `type("#goal", goal)`, `type("#budget", "1")`, `click("#create")` (the person's main path; the ceiling of 1 dollar) |
| `openRow(page, goal)` | clicks the `a.pcard` of the row whose goal is `goal`, then waits for `ON_PROJECT` (C-9) |
| `endChecks(page, stand, folders)` | `trapStarted` is false; `openList`; waits until `ROWS` equals the number of project folders (or the empty words are shown when there are none); `MARKED_ROWS` equals that number (C-4) |

Every page code given to `waitFor` or `evaluate` is an expression or a function **with** its `args` (the kit trap of REQ-106 4.4).

**The seven tests** (the assertions by criterion are in section 8):

1. `stand` — (a) the positive control: `trapStarted` false; `runTrap` → 1; `trapStarted` true; the marker removed; `trapStarted` false. [О19] The copy starts by its path with `PATH` and a `HOME` of the test and without `SAI_TEAM_HOME`, which it does not read (`decisions/0113` О19). (b) refusals with a spawn that records and throws (R2-S): a data folder inside the repository in `stateEnv`, the repository trap in `env`, the repository scenario as the argument → each `PATH_REFUSED`; the recorder called 0 times; `kitFolders()` the same before and after. (c) the recorded start of `teamOptions(folders)` → `STAND_START_FAILED` (the recorder threw), the recorder called once: the program is `process.execPath`; the arguments are 4.1 with the real path of the scenario copy; the environment by its shape first — a plain object, no symbols, `others` 0 against `BASE_NAMES` and the four given names, the names outside the base list exactly `HOME`, `SAI_TEAM_CLAUDE_BIN`, `SAI_TEAM_HOME`, `USERPROFILE`, `PATH` among them — then the two values one by one with `assert.ok(a === b, "…")` (the trap copy's real path; `<real root>/data`), and `SAI_TEAM_REAL_RUNS` not in it. (d) `withStand`: the link matches `LINK`; the data folder does not exist; `withBrowser`, `expectOncePerStart(FAVICON)`, `openList`, wait for the empty words (10000 ms): `textOf("projects-empty")` equals `EMPTY_WORDS`, `ROWS` 0; `endChecks`; after the browser the stand's home holds nothing.
2. `create` — `engine-basic.json`; the empty list; `createProject`; wait `ON_PROJECT` (10000 ms); exactly one project folder; `location.hash` is `#/projects/<id>`; its `events.jsonl` exists; the six headings shown, equal to `HEADINGS` in order; `openList`, one row: `ROW_GOALS` is `[goal]` verbatim, `MARKED_ROWS` 1, the row link is `#/projects/<id>`; `page.reload()`; one row with the same goal; `endChecks`.
3. `finish` — `engine-basic.json`; `M = planTasks(file).length`; `createProject`; `ON_PROJECT`; wait `statusIs(DONE)` (60000 ms, poll 100 ms); `textOf("project-progress")` is `<M> из <M> задач`; `results-empty` not shown and `textOf("results")` not empty; `BUTTONS` `[]` and `controls` not shown; the last journal type is `PROJECT_DONE`; `endChecks`.
4. `control` — `team-slow.json`; rule (1) of 4.2 (the delays and the chain) [F1]; `expect(FAVICON)` (two tabs, C-10). Project A: create; `statusIs(IN_WORK)`; `BUTTONS` `[PAUSE, STOP]`; [О21] the progress reads `N из M задач` with `M` the number of plan tasks of the file and `N` smaller than `M` (criterion 3 beyond its letter: a line that always reads «M из M» is red); click «Пауза»; wait the pause line; its text `PAUSED_WORDS`; `BUTTONS` `[RESUME, STOP]`; the journal holds one `PROJECT_PAUSED`; click «Продолжить»; wait `IN_WORK` and the pause line gone; `BUTTONS` `[PAUSE, STOP]`. Project B (from the list): create; `IN_WORK`; click «Остановить»; the confirmation shown with `DONT_STOP` and `STOP`; click «Не останавливать»; the confirmation gone, no `PROJECT_STOPPED` in B's journal, the status still `IN_WORK`; click «Остановить», then the confirmation's «Остановить»; wait the stop line (15000 ms); its text `STOPPED_WORDS`; `BUTTONS` `[]`; B's journal holds `PROJECT_STOPPED`; a new tab: `goto(<link>#/projects/<B>)`, the stop line with `STOPPED_WORDS`, `BUTTONS` `[]`. Back to A by its row: wait `statusIs(DONE)` (60000 ms); in A's journal `PROJECT_PAUSED` before `PROJECT_RESUMED`, and the last type `PROJECT_DONE`; rule (2) of 4.2 on A's journal [F1]; `endChecks`.
5. `chat` — `engine-basic.json`; create; wait `DONE` (so nothing else writes the journal); the chat ready — [F4] the chat form is shown and either the chat's empty words (`#chat-empty`) are shown or the list holds a message row, that is, the page has its chat's answer; type `CHAT_TEXT`, click «Отправить»; wait the list to grow by one; the last `.msg-text` reads `CHAT_TEXT` exactly; no element inside any `.msg-text` and no `b` in the list; the journal holds exactly one `CHAT` from `USER` with `data.text` = `CHAT_TEXT`. Then **one snapshot** (the journal's size and sha256, the count of the page's `GET`s of its chat address, the count of its `POST`s) and two tries [F4]. First the field: the page empties it after the sent message, and its value is asserted `""`. Then the empty try and the blank try: for each, `type("#chat-text", <"" or three blanks>)` — the kit focuses the field, and for `""` it puts in nothing — read `disabled` of the send button, press Ctrl+Enter while the focus is in the field (its key handler sends on Ctrl+Enter, `src/web/public/app.js:1330–1335`), then click the send button; when it was disabled nothing more; when it was not, the browser's 400 line of the chat address is declared with `expect` **once for the test**, at the first try that was sent (an `expect` claims every matching line, so a second declaration would stay unmet: the gate's V22, V22b), then wait the result tone `err` (10000 ms), assert one more `POST` and `assertPlain` of the result line. So both branches that criterion 5 allows are green: the disabled control of today's page, and a refused send with a plain sentence (P19; the gate's V22c, V22d). Then wait until the page's own poll asked for its chat again (a `GET` after the tries, at most 8000 ms); then, when no try was enabled, the `POST` count is the snapshot's; and in every case the journal has the same size and sha256 (О12).
6. `failure` — (a) `team-fail.json` with `SAI_TEAM_RETRY_DELAY_MS` `0`; create; wait a row of `#failed` (20000 ms; measured 5.2 s, the next poll); `PHRASES` holds one that starts with `FAILED_WORDS`; `textOf("answer-problems")` starts with «Есть ли проблема» and holds the plan task's text; `assertPlain` (with the code shape [О21]) of the reason of the first failed row, of `document.body.innerText` and of `document.body.textContent`; `openList`, one row; a second project created, two project folders; `endChecks`; then `stop()` → `{ code: 0, signal: null }`. (b) the second server (4.1): `expect(LIST_500)`; `openList`; create; wait the create result tone `err` (10000 ms); `assertPlain` of it; `location.hash` empty, `ROWS` 0; the listing of `<root>` the same as before the start; `f` still a file with its bytes; `lstat(<root>/f/home)` throws `ENOTDIR`; `stand.isRunning()`; `openList` again → 200 (the next request); `trapStarted` false; the stop gives code 0.
7. `windows` — `engine-basic.json`; one project created and `DONE`; for `1470×784`, `390×844`, `320×568`: `setViewport`; `openList`; one row; the create button is inside the window after it is scrolled into view (a rectangle of width above 0 within `innerWidth` × `innerHeight`); `browser.unexpectedEntries()` empty; `openRow`; `DONE`; `unexpectedEntries()` empty; `endChecks`; `withBrowser`'s own check of the console at the end.

**As built (step 10; read in `tools/test/e2e/team-web.e2e.js` as RELEASE-VALIDATOR read it at step 9, criterion 1).**

- *The lead paragraph.* No test calls `withStand` or `startStand` itself. The starter is called in two helpers only, `teamStand(options, deps)` (`startStand`, line 251) and `withTeam(options, body)` (`withStand`, line 255), each through `checkedOptions(options, deps)`, which refuses options not made by `teamOptions` or changed after it (the `WeakMap` of 4.1, «As built») and refuses a real start, with no injected spawn, whose options are not made from the frozen folders of the test itself (the `WeakSet`; `handoffs/E2E107-20261116-01/step-05-test-designer.json`, issue I2 (c)). The recorded starts of `stand` (b), (c) go through `startCode(options, recorder)` — `teamStand` with a spawn that records and throws, giving back only the code of the error, since a message of the kit can hold the refused path. The two servers of `failure` start with `teamStand` and run inside `untilStopped(stand, body)`: the stand is stopped whatever the body did, and after a body that passed `SIGTERM` must end it with `{ code: 0, signal: null }`. The other six tests use `withTeam`. Every real start takes `teamOptions(folders…)`: `withTeam` at lines 572, 610, 692, 773, 1010 and 1321, `teamStand` at 1154 (`env` only `SAI_TEAM_RETRY_DELAY_MS`) and 1244 (`data` under a regular file).
- *Helpers not in the table.* `checkedOptions`, `teamStand`, `withTeam`, `startCode`, `untilStopped` (above); `until(fact, limitMs, what)` — a loop on a fact of the spec process every 50 ms with a limit, used for the page's own records of requests; the page-code helpers `sourceOf(id)` and `sourcesOf(selector)` — the `textContent` of an element, not folded, so the line mark `^\s+at ` of `BAD` can be read at all (step 05c, F1 of gate 5b, `decisions/0113` О31), applied beside the folded reading to the create refusal of `failure` (b), the chat refusal of `chat` and the reason rows of `failure` (a); and the small `sha256`, `sameList`, `cut`, `runOf`, `journalFile`. The row `projectIds(folders)` is `projectIds(data)` in the file: the data folder is given, so the second server of `failure` reads its own.
- *Test 1, (a).* Before the spawn, `runTrap` builds its options as one object and asserts that the `HOME` it passes is the test's own `<root>/trap-home` (step 05c, F3 of gate 5b; mutant A09 red). The part of F3 that only a reading can find — a change of both the folder and its literal, or a removed assertion — joins the by-nature gaps of section 16 (`decisions/0113` О33).
- *Test 4, project B.* After the click of «Не останавливать» the test waits, at most 8000 ms and with no sleep, until the page's own records of requests hold its next `GET` of `api/projects/<B>` (the poll of the page, every 5000 ms); only then it asserts that since the click the page sent no request but a `GET`, that B's journal has no `PROJECT_STOPPED`, that the status still reads «в работе» and that the buttons are still «Пауза» and «Остановить»; only then «Остановить» (step 05d, `decisions/0113` О32; probes P13t and P13t3 red). The window measured 4935–5003 ms at steps 05d and 05e; its length is not asserted (finding N1 of step 05e: a page that refreshes B at once on the cancel and sends the stop a second later stays green, mutant P13g1), recorded in `docs/issues/ISS-0116`. The margin of B (its planned 10000 ms of work minus the time from its first `TASK_STARTED` to its `PROJECT_STOPPED`) was at least 4759 ms in 12 runs at step 05d and 4766 ms in 12 runs at step 05e, both on this Mac, so `team-slow.json` was not changed (the rule of О32: under 3000 ms it would have been).
- *Test 7 and test 1, as RELEASE-VALIDATOR measured them at step 9.* The window check `INSIDE` scrolls the button into view with `inline: "nearest"`, so a button pushed past the right edge at 320 px still passes (probe M11b; `decisions/0113` О35 (b)); the end check of each test reads the trap marker before its stand stops, and only `stand` reads it again after the stop, where there is no project (probe M01p; О35 (a)). Both are named limits of the status note of REQ-107 and the first items of `docs/issues/ISS-0116`, with the validator's measured fixes.

### 4.5 The kit change (О1)

`buildArgs(profileDir)` of `tools/test/e2e/kit/browser.js` returns the same frozen list with `--use-mock-keychain` right after `--no-first-run`. Nothing else in the kit changes. The README sentence of section 10 says it.

---

## 5. Failure paths — what the user sees, what stays

| # | Situation | The user (the person running the check) sees | State afterwards |
|---|---|---|---|
| 1 | the trap or the scenario given from the repository (a regression of the spec) | `PATH_REFUSED` with the reason of `guards.js`, before anything is made | 0 spawns, no folder |
| 2 | the trap copy cannot run (mode, first line) | `stand` red at the control: `the trap ends with code 1` or `the trap leaves its marker` | the folder removed |
| 3 | a wrong scenario file | the stand fails with `STAND_START_EXITED … Last line of its stderr: "Файл сценария не найден или неверен"` | the stand and its home removed |
| 4 | the server prints another link line | `STAND_START_TIMEOUT` after 15000 ms | the stand killed and removed |
| 5 | a wait for the page ends without the fact | `WAIT_TIMEOUT` naming the awaited fact and its last value | the browser closed, the server stopped, the folder removed |
| 6 | the trap was started by the server | the end check: `the trap was never started` | the folder removed |
| 7 | a project without the mark (a project of `claude-cli`) | the end check: `rows with the mark = project folders` | the same |
| 8 | the data folder cannot be made | the page's plain sentence; the test asserts it, the unchanged folder and the next answer | nothing made |
| 9 | the server ends by itself or does not end with code 0 | `STAND_EXIT` (the starter) | cleaned up |
| 10 | a console line that no declaration claims | `CONSOLE_ENTRIES` of the kit | cleaned up |
| 11 | a hung test | the test's 90000 ms, then the runner's 120000 ms for the file | the runner stops the file, its browsers and stands |

---

## 6. Protection in the same operation as the action

| Protection | Where it stands |
|---|---|
| Every folder and path the server gets lies under the temporary root, not the root, outside the repository | `startStand`, rule P, before the marker and the spawn (released; F16) |
| The server's home lookup cannot reach the person's home | `startStand`: the private home is made and given in the same call as the spawn (released) |
| The trap copy and the scenario copy are exact, the trap copy executable | `testFolders`: [F8] the sha256 of each copy compared with its source right after the copy, then the mode of the trap copy set, before the folder is used |
| The server's Claude program is the trap copy | `teamOptions`: [F2] the trap merged last and every other given name refused in the same call that builds the options |
| The trap can be seen if started | `stand`: the control and the end check use the same `trapStarted` |
| No real run | three nets in the product (the API refuses a `claude-cli` project without `SAI_TEAM_REAL_RUNS`, `api.js:197`; the executor refuses before its spawn, `claude-cli.js:112`; `SAI_TEAM_CLAUDE_BIN` is the trap copy), and the spec never gives `SAI_TEAM_REAL_RUNS` |
| No folder left | `inFolders` removes `<root>` in a `finally`; the starter removes the stand and its home; `withBrowser` closes the browser |

There is no "check now, act later in another call".

**Rule R2-S of `docs/design/REQ-106-e2e-pixel-office.md`, section 6, applied here.** Every call of the spec that is refused on purpose (the three rows of `stand`) and the recorded start pass a spawn that records its arguments and throws, never the real spawn. No call of the spec names the person's home folder, the real data folder `.sai-team` or the real Pixel Office folder (C-13). A mutant that removes or weakens a refusal is run only after a search of its copy shows the recorder in each refused call (done before the series of section 16: 2 `startStand(…, { spawn: recorder })` calls, 3 rows; no mutant of the series changes those calls).

**Rule R2-T of this run, for the later steps (О2).** On macOS the browser needs О1 under a home below the temporary root (F32); the released Pixel Office `isolated start` is red under such a home (F37 a); 146 released tests of `npm test` give a child `SAI_TEAM_REAL_RUNS=1` with a fake Claude program (F37 b). `decisions/0113` О2 ruled how the later steps run their checks. [О19] The scope of R2-T (a) (`decisions/0113` О19): the words "or without `SAI_TEAM_HOME`" bind the programs of `tools/src/`; the kit's stand-ins and the trap copy may start without it, never with the person's real home as `HOME`; the trap control starts the copy by its path with a `HOME` of the test (C-2).

---

## 7. Time budget (criterion 8: 70000 ms for `npm run -s e2e -- team-web`)

**What was measured (this Mac, macOS arm64, 10 cores; the kit with the argument of О1).**

| Form | Runs | `duration_ms` |
|---|---|---|
| first (two waits for the chat poll) | 3 | 39652, 38911, 39842 |
| one wait for the chat poll | 3 | 34958, 33703, 33819 |
| the same, under four busy loops | 1 | 35209 |
| final (the chat check of 4.4) | 2 | 35193, 33577 |
| step 01c (the checks of F1, F2, F4, F8, О21) | 3 | 34842, 34834, 33885 |

Per test of the final form (ms): `stand` 1226–1612, `create` 1578–1599, `finish` 1335–1371, `control` 13242–14148, `chat` 6342–6351, `failure` 7597–7631, `windows` 1762–1893.

**Where the time goes.** The product's own clock: in `control` the two work delays of the scenario (10000 ms) and one wait for the page's poll (up to 5000 ms) before «выполнен»; in `chat` one wait for the page's poll of its chat (up to 5000 ms, the proof that nothing was sent after the empty tries); in `failure` one wait for the page's poll after the engine's failure (measured 5176 ms after the click). About 23 s in all, which no machine shortens or lengthens. The rest, about 11 s — eight browser starts (seven tests and the runner's preflight), eight server starts, the page loads, the probes of the page — is work of the machine; under four busy loops it grew by about 1 s.

**How the design keeps the file under the limit.** (1) The project of `engine-basic.json` ends in about 0.3 s and the page shows it at once (F20): `finish`, `chat` and `windows` wait for no poll for it. (2) `control` does the whole stop path of project B during A's delays (F21) and waits once for A's end. (3) The failure stand has no retry pause (C-6; 20 s saved, F26). (4) The two empty chat tries share one snapshot and one poll. (5) Every wait is `waitFor` with a condition and a limit, or a loop on a fact with a limit (the chat poll); no sleep. (6) One browser and one server per test; tests do not run in parallel inside the file.

**The runner (an estimate, not a fact; AP-144).** This file was not run on the GitHub runner and cannot be from here without a push. The earlier files ran on the runner at 0.98–0.99 (pixel-office), 1.05–1.35 (picker) and 0.90–2.0 (smoke) times their time here (F45): other files, other days. Applied to the part that grows: 23 + 11 × 1.0 ≈ 34 s (as pixel-office); 23 + 11 × 1.35 ≈ 38 s (the picker's worst); 25 + 11 × 2.0 ≈ 47 s (the longest poll waits and the worst ratio). All are under 70 s (the lowest margin about 1.5 times), but [F6] **the worst one crosses the question line of 42000 ms**: the line is crossed when the machine part is more than about 1.73 times slower on the runner ((42000 − 23000) / 11000), and the smoke file was once 2.0 times slower (F45). A runner time above the line is then a question to the owner (`decisions/0113` О9, О22), not a silent pass and not a retry until it is under. The 14–17 s that `npm run e2e` spent on the runner before its first file (F45) lie outside the file's time; they are inside the record line of a command run there, which is not the reading of criterion 8 on the runner (below).

**The line.** TEST-RUNNER (step 6) and RELEASE-VALIDATOR (step 9) read the time of the `team-web` file in the `check.yml` run of the snapshot on the temporary branch (the TAP `duration_ms` of the file in the job log) and the local record line of `npm run -s e2e -- team-web`, and write both. Above 42000 ms on the runner (60 % of the limit, the rule of `decisions/0109` О11) — a question to the owner (`decisions/0113` О9, О22) [F6]; above 70000 — the criterion is not met. The bound of a hang: 90000 ms per test, 120000 ms per file (`SPEC_TIMEOUT`). The whole `npm run e2e` with four files: about 89 s here (67504 ms for three files, F40, and about 22 s of pixel-office), under 240000.

**As built — the measured times of the built file (step 10, read from the handoffs of steps 05–09).**

| Where | Step | `team-web` (ms) |
|---|---|---|
| this Mac (macOS arm64, Chrome 157.0.8103.78), the record line of `npm run -s e2e -- team-web` | 05 | 34312, 34796, 34518 |
| the same | 05c | 34564, 34693, 33729 |
| the same | 05d | 33357, 33818, 33647 |
| the same | 05e | 33224, 33654, 33964 |
| the same | 09 | 33776, 33443, 33688, 35057 (under four busy loops on 10 cores), 33778, 33746, and 33304 (the record of criterion 8) |
| this Mac, the TAP time of the file inside `npm run check` | 05, 06, 09 | 34347, 33534, 33275 |
| the GitHub runner (`ubuntu-24.04`, image version 20261111.127.1, Chrome 157.0.8103.50), the TAP time of the file in the `check.yml` log | 06 (run 43968701242) | 26239 |
| the same | 09 (run 43972314919) | 25954 |

Per test at step 9 (ms): here `stand` 1593, `create` 1601, `finish` 1368, `control` 12758, `chat` 6386, `failure` 7609, `windows` 1889; on the runner 1038, 1402, 1120, 12246, 6080, 2391, 1627. The runner was about 0.78 times the time here (26239 / 33534 and 25954 / 33275), below the estimate above (34–47 s): 62.5 and 61.8 percent of the 42000 ms question line and 37.5 and 37.1 percent of the 70000 ms limit, so no question to the owner (`decisions/0113` О9, О22). The whole `npm run e2e`, four files: 89506 and 89508 ms here (steps 06, 09), 92117 and 98571 ms on the runner, under 240000. On the runner the first cold start of Chrome, which prints `e2e: browser=` before the first file, took 12.3 s (step 06) and 16.7 s (step 09), here under 1 s; it lies outside the time of each file and inside the record line of the whole command (step 06, issue I2; step 09, issue I7 (e): not a defect). Not proven: the runner beyond these two samples of one image version (AP-144).

---

## 8. Criterion → test

"RV" = a command that RELEASE-VALIDATOR runs itself. The names are the tests of `team-web.e2e.js`; `E2K-…` are in `tools/test/e2e-kit.test.js`.

| Criterion | Element of the design | Test(s) | What it asserts (oracle) | Also by command |
|---|---|---|---|---|
| 1 No real run, no spending | 4.1, 4.3, 4.4 (`stand`, `endChecks`), C-1…C-5 | `stand`; the end check of every test | the control: the trap copy started by its path ends with 1 and leaves its marker, which is removed; the link is `Sai Team: http://127.0.0.1:<port>/`; the page answers 200 and shows the empty words with no row (not a blank page); the refused rows `PATH_REFUSED` with 0 spawns; the recorded environment of the child has no `SAI_TEAM_REAL_RUNS` and no name beyond the base list and the four given; at the end of each test the marker does not exist and the rows with the mark equal the project folders (the oracle: the data folder on disk) | RV: `grep -n 'SAI_TEAM_REAL_RUNS' tools/test/e2e/team-web.e2e.js` → no line that sets it to `1` (one line that reads it) |
| 2 Create, see, open | 4.4 (`create`) | `create` | the goal verbatim in the row, the mark on the row, one project folder whose id is in the address and in the row link, its `events.jsonl`, the six headings of the README in order; after `reload` the same row (the server's state) | — |
| 3 A project runs to the end | 4.2 (`engine-basic.json`), 4.4 (`finish`) | `finish`; supporting `control` [О21] | «выполнен» within 60 s; `<M> из <M> задач` with `M` read from the plan of the scenario file; «Результат» not empty; no button and no control block; the journal ends with `PROJECT_DONE`; beyond the letter [О21]: while a project is in work (`control`) the progress reads `N из M задач` with N < M (the gate's V18) | — |
| 4 Pause, continue, stop | 4.2 (`team-slow.json`), 4.4 (`control`) | `control` | the buttons by state (`[Пауза, Остановить]`, `[Продолжить, Остановить]`, `[]`); the pause phrase; `PROJECT_PAUSED` in the journal; in work again and «выполнен», `PROJECT_PAUSED` before `PROJECT_RESUMED`, the last `PROJECT_DONE`; in work for at least 10 s by construction — the chain of the file and A's journal time (rules (1) and (2) of 4.2) [F1]; the confirmation with «Не останавливать» and «Остановить»; «Не останавливать» leaves no `PROJECT_STOPPED`; the stop phrase, no button, `PROJECT_STOPPED`; a new tab the same | — |
| 5 The chat | 4.4 (`chat`) | `chat` | the exact text in the list, no element made from it, one `CHAT` from `USER` with the same text; an empty and a blank message: the control disabled (no `POST`) or a plain sentence (a refused `POST`), and the journal the same size and sha256 after the page's next poll | — |
| 6 A failure in plain words, the page lives (Q10) | 4.2 (`team-fail.json`), 4.1 (the second server), 4.4 (`failure`) | `failure` | «Попытка не удалась» among the phrases; «Есть ли проблема» names the plan task and a reason in words; no `^\s+at `, `undefined`, `[object`, `Error:` in the reason and in the page text (`innerText`, and `textContent` as well), and beyond the letter no technical code shape `E_…` [О21]; the list loads, a new project is created; `SIGTERM` → code 0; the second server: a plain sentence, no row, the folder unchanged, `ENOTDIR`, the process alive and answering | — |
| 7 Windows and errors | 4.4 (`windows`) | `windows` | in each window the create button inside after it is scrolled into view, no unexpected console entry and no exception on both pages (the favicon line declared); `withBrowser`'s check at the end | — |
| 8 Time and independence | 7, 13, 12 | none inside the spec (C-12); `E2K-50` (`SCANNED` has the spec and the fixtures), `E2K-25`, `E2K-41`, `E2K-60` | RV: `cd tools && npm run -s e2e -- team-web \| tail -n 1` → `exit=0`, `duration_ms` ≤ 70000, and the runner reading of section 7; the loop of REQ-104 criterion 7 over the seven names; `grep -nE '\.skip\(\|\.todo\(\|\|\| true' tools/test/e2e/team-web.e2e.js` → no line; `cd tools && npm run -s traces \| grep -c -E 'tools/test/e2e/team-web\|tools/test/fixtures/e2e'` → 0; `cd tools && node --test test/exec-docs.test.js test/exec-scripted-source.test.js` → exit 0 (how it is run under rule R2-T: О2); the order check of section 13 | — |

Every test above appears in a row, every criterion has a row (Q5). Controls (the check can see something): the trap control; the recorder called once for the recorded start; the empty words before the first project; «в работе» with its buttons before «Пауза»; the journal holding `PROJECT_STOPPED` after the real stop (the same reading that found none after «Не останавливать»); the chat message present after the send (the same list and journal readings that stay unchanged for the empty tries); the page's own chat poll after the empty tries.

---

## 9. Order of work and the shared contract

- The coupling between BACKEND-DEV and TEST-DESIGNER is 4.5 (one argument, its place) and section 10 (the README words that `E2K-41` and `E2K-60` will read).
- The kit argument and the README first; then the `E2K-25` edit; then the fixtures with their `SCANNED` entries; then the spec with its entry and the two README guards.
- The code and the page of the team server are not changed (the requirement). A defect the spec finds is a WF-03 job on ORCH's order; the criterion is not weakened.

---

## 10. README texts (agreed with `E2K-41`, `E2K-60` and `E2S-19`; AP-077)

`tools/README.md`, section `## End-to-end tests in a real browser`; the heading and the other paragraphs stay:

1. The budgets sentence becomes: "The budgets of `duration_ms` (REQ-104, criterion 9; REQ-105, criterion 10; REQ-106, criterion 8; REQ-107, criterion 8): `smoke` 30000, `picker` 80000, `pixel-office` 50000, `team-web` 70000, all files 240000." (О8)
2. After "the sandbox of Chrome is never turned off." the sentence [F7]: "Chrome is started with `--use-mock-keychain`, a switch that Chromium names for a mock keychain on macOS, for tests; measured for REQ-107: with it Chrome answers its first navigation also when the spec runs with a home folder under the temporary root, and without it it does not." (О1, accepted by `decisions/0113`). Only the measured part is said as a fact; what the switch does to the person's keychain was not measured.
3. The table gets the row `| team-web.e2e.js     | REQ-107     |` after the smoke row (the widths are what `prettier` writes), and the line "REQ-107 adds its row." is removed.

Measured in proto: the edit passes `npx prettier --check README.md`; `E2K-41`, `E2K-60` and `E2S-19` are green with the edit, before and after their own edits (F35).

---

## 11. The tests

Every test is a top-level `test()`; no suites; each passes alone (F39). The seven tests of 4.4, their assertions in section 8. A red test names the window, the project, the place or the button in its message.

---

## 12. Replacement table of earlier guard tests

Measured on proto against the tag (F33–F36, F42). The prohibition is not weakened in any row (AP-068, AP-112, AP-113).

| # | File, test | Line (tag) | Was → became | What the test counts | Evidence |
|---|---|---|---|---|---|
| 1 | `e2e-kit.test.js`, `E2K-25` | 1697–1715 | the exact expected argument list gets `--use-mock-keychain` after `--no-first-run` (only with О1) | an exact list; the sandbox checks stay | red after sub-step 1 (F33), green after the edit |
| 2 | `E2K-50` | 3796–3803 (`SCANNED`), 3891–3898 (the rule) | `SCANNED` gets `tools/test/e2e/team-web.e2e.js` and the three fixtures — each in the same change as its file (before the file exists the entry fails with `ENOENT`, REQ-105 N3); the rule "every file of `fixtures/e2e` is scanned or under `specs`/`tap`" is not changed, so the new files are scanned for the skip words, the secret shapes and the variables they read; `ENV_NAMES` and the allowlist of whole-environment reads do not change (the spec reads `process.env.PATH` only; the trap reads none); [F3] and **one more assertion**: every `*.e2e.js` directly in `tools/test/e2e` is in `SCANNED` (`<name> is scanned`), a strengthening, so a spec left out of the list is red | a list of files and of the names they may read | red with the fixtures and no entry (F34), green with the entries; the new assertion green for the four spec files, red under V21 (the spec left out) |
| 3 | `E2K-41` | 3395, 3425 | the words `duration_ms`, `30000`, `80000`, `50000`, `240000` → and `70000` | words in a section | green after the README edit; mutant G03 |
| 4 | `E2K-60` | 3904–3954 | the tokens get `70000` and `--use-mock-keychain` (the latter only with О1); one more row expression for `team-web.e2e.js` / `REQ-107`; `REQ-107` is still found (in the row; the sentence "REQ-107 adds its row." is gone) | tokens and rows of a section | green after the README edit; mutants G02, G04 |
| 5 | `E2K-01`, the file walk of `E2K-25`, `E2K-30`, `E2S-19`, `EX-07`, `EX-21`, the prefix scans of `handoffs-docs.test.js:101`, `picker-config.test.js:881`, `picker-page-static.test.js:700`, `team-web-control.test.js:1704`, `team-web-docs.test.js:69`, the `team-web-*` tests of the README section "Sai Team — the interface" | — | none: `E2K-01` allows its word under `tools/test` and the spec does not name it; `E2K-25` walks `tools/test/e2e` for the sandbox flags and covers the new spec; `E2K-30` expects `NO_SPECS` in `fixtures/e2e`, and no new file is `*.e2e.js`; `E2S-19` reads the four starter files and the README tokens, unchanged; `EX-07` and `EX-21` read `fixtures/team`, where nothing is added; the prefix scans read the top level of `tools/test`; the interface section of the README is not changed | — | F36; the full suite: the same 2209 tests and the same red set on the tag and on proto (F37 b) |

The requirement says "Guard tests of earlier requirements, «was → became»: none … no existing assertion counts files of tools/test/fixtures". The measurement says: `E2K-50` counts them (row 2), and three more tests get words, a row or an argument (rows 1, 3, 4): a difference from the block, recorded as О7.

**As built (step 10; `git diff base/E2E107-20261116-01 -- tools/test/e2e-kit.test.js`).** Rows 1–4 were built as listed: `E2K-25` (one argument in the exact list), `E2K-41` (the word `70000`), `E2K-50` (the spec and the three fixtures in `SCANNED`, and the assertion that every `*.e2e.js` of `tools/test/e2e` is scanned), `E2K-60` (the tokens `70000` and `--use-mock-keychain`, the row of `team-web.e2e.js`, and beyond the table two more checks: the words of the keychain sentence in order, read so that naming the system after «measured for REQ-107» keeps it green, `decisions/0113` О27, and the absence of the line «REQ-107 adds its row.», О28). No other test of the file changed; the file has 52 tests as on the tag and 544 `assert.` (537 on the tag). The sentence of the block was corrected at step 10 with `before_copy` (О7; `handoffs/E2E107-20261116-01/step-10-doc-updater.json`).

---

## 13. The order check on four real files (ISS-0102, item 2, continued)

With `picker.e2e.js`, `pixel-office.e2e.js`, `smoke.e2e.js` and `team-web.e2e.js` the validator runs, from `tools/`:

1. `ls test/e2e/*.e2e.js | sed 's#test/e2e/##; s#\.e2e\.js##' | sort -r` → `team-web`, `smoke`, `pixel-office`, `picker`.
2. `npm run -s e2e -- team-web smoke pixel-office picker > out1.txt; echo "exit=$?"` → `exit=0`; `grep '^e2e: file=' out1.txt | sed 's/^e2e: file=//'` prints the four names in that order; `e2e: browser=` once; the last line `e2e: command=npm run e2e -- team-web smoke pixel-office picker selection=team-web,smoke,pixel-office,picker exit=0 duration_ms=<n>`.
3. `npm run -s e2e -- team-web team-web; echo "exit=$?"` → `exit=1` with `SELECTION_DUPLICATE`.

Measured on proto (F40): (1) as stated; (2) with the three files `team-web smoke picker` exit 0, that order, one browser line, 67504 ms; with `pixel-office` in the list the run stopped at its `isolated start`, red only under rule R2-T (F37 a); (3) exit 1, `SELECTION_DUPLICATE`. RELEASE-VALIDATOR runs item 2 with the four files where О2 allows the Pixel Office spec to pass, and writes its reading next to `docs/issues/ISS-0102`.

**As built (step 10).** Read at step 05 under rule R2-T (`handoffs/E2E107-20261116-01/step-05-test-designer.json`, `self_check`, the order check): (1) as stated; (2) with the four files exit 1 — the lines `e2e: file=` for `team-web`, `smoke`, `pixel-office` in that order, `e2e: browser=` once, then `pixel-office` red at its `isolated start` only under R2-T (F37 a), `duration_ms=72420`; with the three files `team-web smoke picker` exit 0, that order, one browser line, `duration_ms=68187`; (3) exit 1, `SELECTION_DUPLICATE`. The run of item 2 with the four files and exit 0 in the normal environment, which this section gives to RELEASE-VALIDATOR, is not in the handoff of step 9: it was not read. In the normal environment the full check ran the four files in one browser (in the order of `selection=all`: `picker`, `pixel-office`, `smoke`, `team-web`), green at steps 06 and 09 here and on the runner. The same is written in `docs/issues/ISS-0102`.

---

## 14. Build sub-steps

"Red after it" is the list of tests of the two kit files and of the spec that fail when the sub-step is done and the later ones are not, measured on proto (F33, F34). The check of the kit files is `cd tools && node --test test/e2e-kit.test.js test/e2e-stand.test.js`.

**BACKEND-DEV** (only with О1)

| # | Work | Red after it | Own check (no test file of this work exists yet) |
|---|---|---|---|
| 1 | `browser.js` (4.5) and `tools/README.md` (section 10), then `npx prettier --write README.md` | `E2K-25` only: `# tests 74`, `# pass 73`, `# fail 1` (F33). TEST-DESIGNER fixes it at sub-step 2; BACKEND-DEV names it `EXPECTED_RED` in `result.issues` | `npx prettier --check README.md test/e2e/kit/browser.js`; under rule R2-T (the spec process's home under the temporary root): `npm run -s e2e -- smoke` → exit 0, 13 of 13 (measured in the order check, F40); the leftover check of section 16 |

**TEST-DESIGNER**

| # | Work | Red after it |
|---|---|---|
| 2 | the `E2K-25` edit (section 12, row 1) | none; the kit files 74 of 74 |
| 3 | the three fixtures (4.2, 4.3) **and in the same change** their three `SCANNED` entries (row 2); `npx prettier --write` on the two JSON files | none (without the entries `E2K-50` is red, F34) |
| 4a | `team-web.e2e.js` with its helpers and `stand`, `create`, `finish`, **and in the same change** its `SCANNED` entry and the assertion that every spec file is scanned (row 2) [F3]; the `E2K-41` and `E2K-60` edits (rows 3, 4) | none; each spec test alone exit 0; the kit files 74 of 74 (measured at step 01c) |
| 4b | `control`, `chat` | none |
| 4c | `failure`, `windows` | none |
| 4d | the independence loop, the mutant series (section 16), the order check (section 13), the commands of criterion 8, `npm run check` as О2 rules | — |

Full suite: `npm test` holds 2209 tests on the tag and after every sub-step (the spec is run by `npm run e2e`, not by `npm test`; the kit-test edits add no test); under rule R2-T 146 of them are red on the tag and on proto alike (F37 b). Each sub-step can be checked alone: 1 by its check; 2 and 3 by the kit files; 4a–4c by `npm run -s e2e -- team-web` with the tests written so far. After every check that starts stands or browsers, the leftover check gives the same numbers as before it.

### 14.1 Test × the first sub-step at which it can run

| Test | Reads (made by this work, with its sub-step) | Made at | First runs at | State there |
|---|---|---|---|---|
| `E2K-25` (old form) | `browser.js` (1) | released | 1 | red at 1, green from 2 (new form) |
| `E2K-41`, `E2K-60` (old form) | README (1) | released | 1 | green at 1 (the old tokens stay; `REQ-107` is found in the row) |
| `E2K-50` (entries of 3) | the three fixtures (3) | 3 | 3 | green; made before 3 it would be red with `ENOENT` |
| `E2K-50` (entry of 4a), `E2K-41`, `E2K-60` (new form) | the spec (4a), README (1) | 4a | 4a | green |
| `stand`, `create`, `finish` | the fixtures (3), the released starter and server | 4a | 4a | green |
| `control`, `chat` | the same | 4b | 4b | green |
| `failure`, `windows` | the same | 4c | 4c | green |
| the loop, the order check, the criterion 8 commands | the spec complete (4c) | — | 4d | — |

---

## 15. Quality bar

| Item | Status | How it is met |
|---|---|---|
| Q1 | applicable | the change is REQ-107 (status `in_progress`); every criterion names its check (section 8) |
| Q2 | applicable | BACKEND-DEV and TEST-DESIGNER are checked by SECURITY-REVIEWER, REVIEWER, TEST-DESIGN-VALIDATOR and RELEASE-VALIDATOR, each by its own run; this design by CODE-DESIGN-VALIDATOR on a fresh clone of the tag |
| Q3 | applicable | every statement about the system is a measured fact with its sketch (section 1); the runner time is an estimate (section 7); Linux and the person's home were not measured and are named so |
| Q4 | applicable | the spec is found by `run.js` and so is part of `npm run e2e`, the last step of `npm run check`; no step is added or removed; how the check is run under rule R2-T is О2 |
| Q5 | applicable | a test for every criterion (section 8); the failure tests assert that the state did not change (0 spawns and no folder for a refusal, the journal's size and sha256 for the empty chat tries, no `PROJECT_STOPPED` after «Не останавливать», the unchanged folder and `ENOTDIR` for the unwritable data folder); the tests are independent (own server, folders, browser; the loop, F39) |
| Q6 | applicable | no skip, no todo, no `|| true`, no turned-off rule; `E2K-50` scans the spec and the fixtures from the change that makes them, and asserts that every spec file of the folder is scanned [F3]; `E2K-25` walks the folder; a missing Chrome fails (REQ-104); a red caused by a slow runner is a question, not a retry (section 7) |
| Q7 | applicable | the spec reads only `PATH` by name; red messages print names and counts, never a value of the environment (the shape check of `stand`, `assert.ok(a === b, …)` for the two values and the hash); the trap and the scenarios hold no secret shape (`E2K-50`); the server gets no variable of the developer's shell but named ones |
| Q8 | not applicable | the page has one local owner and no space of another customer (the server listens on 127.0.0.1; the write key and the `Origin` check are the border, and are checked by the tests of REQ-011) |
| Q9 | not applicable | no query of any kind |
| Q10 | applicable | criterion 6: a failing task told in plain words, the page lives, a new project after it, `SIGTERM` → 0; the unwritable data folder gives a plain sentence and the process answers the next request; every wait has a limit |
| Q11 | not applicable | no address is supplied to a server by a client; the kit opens only `http://127.0.0.1:<port>/…` and the starter's link passes `assertLoopbackUrl` |
| Q12 | applicable | the choices of section 2 and the kit argument are proposals for one record (section 19); the design relies on `decisions/0107`, `0108`, `0109` (О11 gives the line), `0110` (the check on GitHub), `0111` (an open repository: Q7 of the red messages), `0112` (О1 the starter, О14 and О22 settled here, О24 the red messages); it does not silently differ from them |
| Q13 | applicable | traps found here for `docs/anti-patterns.md` (DOC-UPDATER, from `result.issues`): a fresh home blocks Chrome on macOS (F32); a net preloaded into every process that judges paths by `os.tmpdir()` of the child misreads the nested `TMPDIR` that the kit tests give their children (the designer's own net refused 32 stand-ins of the kit tests until its root was fixed by the shell); `goto` of a `#` change fires no load event (F24); `textContent` reads hidden sentences (F25); a check stricter than its criterion (the first form of the empty chat tries asserted "nothing sent" in both branches; mutant P19 showed it); a refusal row built from the spec process's home is refused only while that home is the person's (F37 a); a check of a killed process right after `kill` still sees it unreaped (the designer's busy loops, the AP-144 shape) |
| Q14 | applicable | the status, `STATE.md`, the handoffs, `docs/issues/ISS-0102` (item 2 continued) are DOC-UPDATER's and ORCH's, in the same run; the list in section 17 |
| R1 | applicable | the release is pushed to `main` by RELEASE-FINALIZER only after PASS (`decisions/0048`, `0079`, `0110`); nothing is merged by this design |
| R2 | applicable | the spec starts no Pixel Office and no hook and names no Pixel Office folder; every stand has the private home; the five files of the owner's real Pixel Office folder and the absence of `.sai-team` were measured before and after every trial of this design (F44); rule R2-S holds for the refused calls (section 6) |
| R3 | not applicable | the product with photos was dropped (`decisions/0033`) |

---

## 16. Mutants

**What "applied" means.** The mutant was put into a fresh clone of the tag outside the project with the files of the work copied from proto (`<outside the project>/e2e107-01/mut/harness.py`), the named test was run alone (`node --test --test-reporter=tap --test-name-pattern="^<name>$" test/e2e/team-web.e2e.js`, or the kit test by its id), its verdict and first red line were recorded, and the clone was removed. Controls: the harness with no breakage was green for `stand`, `control` and `E2K-50` (C01–C03), at step 01 and again at step 01c. [F1–F4, О21] At step 01c every mutant of the list was applied again on the changed files (`batch5.jsonl` … `batch8.jsonl`), with the six new ones V03, V06, V06j, V15, V18, V21 (the ids of the gate's own mutants, step 01b). The product mutants (P, S) ran with the two nets preloaded into the server as well (a harness-only `NODE_OPTIONS` in the stand's `env`; not in `stand`'s mutants, whose shape check would count it). The control mutants P10–P16 ran before the final form of the chat check (4.4), which touched only `chat`; P17–P19b ran after it.

**Rule for every series.** No mutant gives `SAI_TEAM_REAL_RUNS` or starts the real `claude`: T11 is never applied; the one mutant on the real-run path (P01) keeps the executor's own refusal and the trap copy as the program, and the nets refused nothing during it. Before the series a search of the spec shows the recorder in every refused call, and no mutant changes those calls (section 6).

**The leftover check `LEFT`.**

- `pgrep -f 'sai-e2e-|src/web/main\.js' | wc -l`
- `ls "$(node -p "require('os').tmpdir()")" | grep -c '^sai-e2e-'`

Both gave 0 before and after every mutant of this design.

| # | Breakage | Caught by | Status |
|---|---|---|---|
| T01 | the trap writes no marker | `stand` (the control) | applied: red |
| T02 | the trap writes its marker into the working folder | `stand` (the control) | applied: red |
| T03 | the spec gives the repository trap as `SAI_TEAM_CLAUDE_BIN` | `stand` (`PATH_REFUSED` at the real start) | applied: red |
| T04 | the spec gives no `SAI_TEAM_CLAUDE_BIN` | `stand` (the recorded shape) | applied: red |
| T05 | the spec gives `PATH` in `env` | `stand` (`PATH_REFUSED` instead of the recorded start; О22) | applied: red |
| T06 | the control does not remove the marker | `stand` | applied: red |
| T07 | the end check reads another marker path than the control | `stand` (the control) | applied: red |
| T08 | the scenario is given from the repository | `stand` (`PATH_REFUSED`) | applied: red |
| T09 | the scenario copy differs from its source | `stand` (`the scenario copy is exact`) | applied: red |
| T10 | the recorded start uses the real spawn | — | on record, never applied (rule R2-S) |
| T11 | the spec gives `SAI_TEAM_REAL_RUNS` | `stand` (the recorded shape, before any real start) | on record, never applied (rule R2-T b) |
| P01 | the server takes `claude-cli` whatever `--executor` says and the API does not refuse it without real runs | `create` (the page does not open the project: the wait for its address ends without it; the executor `claude-cli` refuses before its spawn, `claude-cli.js:112`) | applied: red; the nets refused nothing during it |
| P02 | no mark on a scripted project | `create` (`MARKED_ROWS`) | applied: red |
| P02f | the same, with `finish` named | `finish` (the end check: rows with the mark = project folders) | applied: red |
| P03 | the empty list shows no words | `stand` | applied: red |
| P04 | the link line reads `Sai Team at http://…` | `stand` (`STAND_START_TIMEOUT`) | applied: red |
| P05 | the list loses the project from its second answer with a project on | `create` (the wait after `reload`) | applied: red |
| P06 | the fifth heading reworded | `create` | applied: red |
| P07 | the progress reads `N/M задач` | `finish` | applied: red |
| P08 | a finished project keeps «Остановить» | `finish` (`BUTTONS`) | applied: red |
| P09 | «Результат» empty for a finished project | `finish` | applied: red |
| P10 | the pause phrase reworded | `control` | applied: red |
| P11 | «Продолжить» shown while the project is in work | `control` (`BUTTONS`) | applied: red |
| P12 | «Пауза» sends a continue | `control` (no pause line) | applied: red |
| P13 | «Не останавливать» stops the project | `control` (`PROJECT_STOPPED` after «Не останавливать») | applied: red |
| P14 | «Остановить» stops at once, no confirmation | `control` (no confirmation) | applied: red |
| P15 | the stop phrase reworded | `control` | applied: red |
| P16 | a stopped project shows «Продолжить» | `control` (`BUTTONS`) | applied: red |
| P17 | the chat message is put in as markup | `chat` | applied: red |
| P18 | the server stores another text than the one sent | `chat` (the journal) | applied: red |
| P19 | the page does not disable the send button for an empty or blank text | `chat` stays green: the server refuses each try with a plain sentence and the journal is unchanged — the second branch of criterion 5, with the 400 line declared once for the test [F4] | applied: green on purpose (the criterion allows it) |
| P19b | the same, and the server stores a blank text as a message | `chat` (no refusal; the journal changed) | applied: red |
| P20 | «Попытка не удалась» reworded | `failure` | applied: red |
| P21 | the reason of a failed task holds `undefined` | `failure` (`assertPlain`) | applied: red |
| P22 | «Есть ли проблема» lists no failed task | `failure` (the wait for a failed row) | applied: red |
| P23 | the refusal of an unwritable data folder shows the error with its stack | `failure` (the second server, `assertPlain`) | applied: red |
| P24 | the server ends when the list cannot be read | `failure` (the second server) | applied: red |
| P25 | the core makes a fallback folder beside an unwritable data folder | `failure` (the listing of `<root>`) | applied: red |
| P26 | the create button pushed out of the window | `windows` | applied: red |
| P27 | a console error in a narrow window | `windows` | applied: red |
| P28 | an exception after the project address is opened | `windows` | applied: red |
| S01 | `team-slow.json` without its delay | `control` (the delay rule of 4.2) | applied: red |
| S02 | `team-slow.json` with a delay above the limit | `control` (`STAND_START_EXITED`, «Файл сценария не найден или неверен») | applied: red |
| S03 | `team-fail.json` work run `ok` (with no answer) | `failure` (another phrase: «Результат пришёл в неверном виде») | applied: red |
| S04 | `team-fail.json` without a plan run | `failure` (the spec's reading of the plan; a named assertion in the built file, 4.2) | applied: red |
| S05 | `team-slow.json` delay 4999 (in work for less than 10 s) | `control` (the delay rule) | applied: red |
| K01 | the kit argument removed | `E2K-25` (and, under rule R2-T on macOS, every browser spec: F32) | applied: red (`E2K-25` alone) |
| K02 | the kit argument misspelled | `E2K-25` | applied: red |
| G01 | `SCANNED` without the trap | `E2K-50` | applied: red |
| G02 | the README row removed | `E2K-60` | applied: red |
| G03 | the budget `team-web 70000` removed from the README | `E2K-41` | applied: red |
| G04 | the README names the argument in other words | `E2K-60` | applied: red |
| V03 | [F2] `failure` gives another trap through the extra names | `failure` (`teamOptions: SAI_TEAM_CLAUDE_BIN may not be given`); with the trap merged last it could not replace the trap anyway | applied (step 01c): red |
| V06 | [F1] `team-slow.json`: the second task without its dependency | `control` (rule (1): the chain of the file) | applied (step 01c): red |
| V06j | [F1] the same, and rule (1) of the chain removed from the spec | `control` (rule (2): «in work for 10 s at least (the journal)») | applied (step 01c): red |
| V15 | [О21] the refusal of an unwritable data folder reads `E_HOME: ENOTDIR` | `failure` (the second server, the code shape of `assertPlain`) | applied (step 01c): red |
| V18 | [О21] the progress always reads «M из M задач» | `control` («N < M while in work») | applied (step 01c): red |
| V21 | [F3] `SCANNED` without the spec | `E2K-50` («team-web.e2e.js is scanned») | applied (step 01c): red |

Counts: 58 rows; 56 applied at step 01c (55 red, P19 green on purpose), 2 on record (T10, T11). Not caught by a test, by nature: the removal of the trap control or of the end check from the file — it removes their assertions together with them (a deleted check, Q6); REVIEWER and TEST-DESIGN-VALIDATOR read the file for them.

**As built — the mutant series of the run (step 10, counted from the handoffs; each mutant in a fresh clone of the tag with the work files, under rule R2-T, with the leftover check before and after; the counts above stay).**

| Step | Runs | What came out |
|---|---|---|
| 05 TEST-DESIGNER | 77 | all 56 applied rows of this section, V03d, V23, V24 of gate 01d, K03–K05 and G05–G08 of REVIEWER, own G01b, G01c, G03b, G09, V03e, P19r and two probes: 68 red in the named test, 9 green on purpose (3 controls, 2 probes, P19, P19r, V24, G09); T10 and T11 on record, never applied |
| 05b gate, pass 1 | 64 | 39 own mutants: 34 red, 2 green on purpose as valid inputs (C02, S10g), 3 survived — D10b, D10c (F1, Medium) and A09 (F3); 8 rows of this section in the gate's own form (V03d, V06j, V15, V18, T05, S02, P13 red; P19 green on purpose); FAIL |
| 05c TEST-FIXER | 41 | all as expected: D10b, D10c, P13 (6 of 6), A08, A09 red; P13t (a stop sent 1 s after the cancel) survived, named for the gate |
| 05d TEST-FIXER | 37 | all as expected: P13t, P13t3, P13, P13a red at «B: «Не останавливать» sends no request but a GET»; the other mutants of `control` red; the controls K2t, S10g, C02 green |
| 05e gate, pass 2 | 26 | D10b, D10c, P13, P13t, A08, A09, D10, V06j, P13t4 and the probe P13g1f red; the controls and the benign forms green; survived P13g1 (×3, finding N1) and D10e (issue I3, beyond the letter); PASS |
| 09 RELEASE-VALIDATOR | 26 | own M01–M12 red in the named test; the controls K9 and M11k green; the probes M01c, M01p, M01pf, M01ps green (finding L1), FIXp red and FIXk green for its fix; M11b green (finding L2), M11c red; O13m green and O13p red (the overflow measurement of `decisions/0113` О36); not applied, on record: a mutant that would set `SAI_TEAM_REAL_RUNS` or leave `SAI_TEAM_CLAUDE_BIN` unset; PASS |

Survivors on record at the end of the run, none fixed in it: P13g1 (N1), D10e (I3), M01p (L1), M11b (L2) — `docs/issues/ISS-0116` (`decisions/0113` О34, О35). Closed in the run: D10b, D10c and A09 at step 05c, P13t at step 05d. By-nature gaps (no test can see them; the gates read the file): the removal of the trap control or of the end checks; a start of the starter that bypasses `teamStand` and `withTeam`; the end check cannot tell which trap a server holds, because the scripted executor never starts its Claude program (step 05, issue I4); the part of F3 that only a reading finds (О33). The red output of M03 (the trap copy cannot start) holds the temporary path of the copy through Node's spawn error, not a value of the person's environment (step 09, issue I7 (c); `docs/issues/ISS-0116`).

---

## 17. What becomes outdated outside the project (for DOC-UPDATER)

- `tools/README.md`, the section "End-to-end tests in a real browser": section 10 (made by this run).
- `docs/requirements.yaml`, block REQ-107: "Guard tests … none … no existing assertion counts files of tools/test/fixtures" (О7), "`HOME` is another new folder" and "`SAI_TEAM_CLAUDE_BIN` points to a trap program (a script in tools/test/fixtures/e2e/)" (now a copy under the temporary root, О3) — corrected at step 10 with `before_copy`, without a change of meaning; the status after PASS of RELEASE-VALIDATOR.
- `docs/design/REQ-104-e2e-chrome-kit.md` (the argument list of the browser) and `docs/design/REQ-106-e2e-pixel-office.md` 4.3 (the row of REQ-107: "copies its trap under the temporary root or asks for a pinned exemption") — an «As built» note pointing here.
- `decisions/0112`, О14 and О22: settled by this design (ORCH writes the addendum or the new record).
- `docs/issues/ISS-0102`: item 2 continued with four real files (section 13).
- `STATE.md`, `PLAN.md`, the mistakes journal (the Q13 items of section 15).

---

## 18. Sketch notes (for `result.prototype`)

Outside the project, in `<outside the project>/e2e107-01/` (no path of this computer is written here): `clone/` (a fresh clone of the tag with `npm ci`, the "before" copy, never changed); `kitx/` (a fresh clone with the one argument of О1 in `browser.js`, used for the probes); `proto/` (a fresh clone with the prototype: `browser.js` and `tools/README.md` of sections 4.5 and 10, `e2e-kit.test.js` with the edits of section 12, the three fixtures and `tools/test/e2e/team-web.e2e.js`, 819 lines, 7 tests, 86 `assert.`; staged, never committed; sha256 of the spec `85feafb6…`, of the trap `89da48a1…`, of `team-slow.json` `4987df6c…`, of `team-fail.json` `6d786a88…`); `sk/` (the probes `p0b.mjs`, `p1.mjs`…`p6.mjs` with their outputs, the fact greps `facts.txt`, the runs `run1.txt`…`run8.txt`, `load1.txt`, `order1.txt`, `order2.txt`, the suites `full-tag.txt`, `full-proto.txt` and their red lists, the kit-file runs `s0`…`s6`); `mut/` (`harness.py`, `batch1.jsonl`…`batch4.jsonl`, the outputs of each mutant with the scratch path replaced); `guard/` (the net of this design, its positive control and the environment of every trial); `logs/` (the refusals of the two nets). Step 01c, in the same folders: `proto` changed by the findings (the spec 870 lines, 94 `assert.`, sha256 `29db1ca6…`; `e2e-kit.test.js` with the new assertion of section 12 row 2, `53289f73…`; the fixtures unchanged), the step-01 forms kept as `sk/team-web-01.e2e.js` and `sk/e2e-kit-01.test.js`; `sk/design-before-01c.md` (this file before the rework); `mut/harness.py` (its step-01 form `harness-01.py`) and `batch5.jsonl` … `batch8.jsonl`; the runs `run11.txt` … `run13.txt`. The facts the later steps need are in this design and in the handoff, not only there (AP-149).

---

## 19. Open questions (for ORCH; answered by `decisions/0113-e2e-team-web-conventions.md`: every default accepted, О18 recorded; its addendum О19–О22 came after gate 1b)

| # | Question | Default used by the design | Cost of the other choice |
|---|---|---|---|
| О1 | A change of the kit: Chrome gets `--use-mock-keychain` (F32) | yes: BACKEND-DEV sub-step 1, `E2K-25` edited, the README sentence | without it no local run of any browser spec can follow rule R2-T on macOS (the first navigation does not answer); trials then need a sketch kit with the argument, as this design used, and the evidence runs need the person's home for the spec process |
| О2 | How rule R2-T binds the later steps: under a home below the temporary root the released Pixel Office `isolated start` is red, and 146 released tests of `npm test` (among them the three `EX-51` tests of criterion 8's last command) give a child `SAI_TEAM_REAL_RUNS=1` with a fake Claude program inside the repository, which R2-T (b) forbids to run (F37) | R2-T binds what its words say — every sketch, trial and mutant of this run that starts the team server, the engine, a team command, a Pixel Office program or a Node program of the project for REQ-107; the full `npm run check` of steps 6 and 9 and criterion 8's last command are run as in REQ-106 (locally the spec process keeps the person's home, every stand gets its private home) and on GitHub, which is the evidence (`decisions/0110`); a stricter reading is the owner's raise of the bar (quality-bar §4) | the strict reading leaves the full check and criterion 8's last command provable only on GitHub, and a local `npm run check` red by construction |
| О3 | The trap and the scenario are copies under the temporary root; no exemption of rule P (C-1); the block's words about the trap and `HOME` are read so | as stated | a pinned exemption needs a change of the starter (with ISS-0111 open on the same lines) and a record; a relative scenario path rests on a known limit of rule P |
| О4 | "At the end of the whole file the trap marker file does not exist, and the data folder has no project of the executor `claude-cli`" is read as the end check of every test (C-4) | as stated | a file-level hook is outside the spec format of the README and would couple the tests |
| О5 | The failure stand gets `SAI_TEAM_RETRY_DELAY_MS` = `0` (C-6) | yes | about 20 s more per run of the file (F26) |
| О6 | The oracles without a README sentence: the stop phrase (the requirement's words) and the words of the empty list (pinned as measured on the tag, F13) | as stated | reading the page's own HTML as the oracle would be the output under test (AP-145, item 2) |
| О7 | The block says "Guard tests … none … no existing assertion counts files of tools/test/fixtures"; `E2K-50` does, and `E2K-25`, `E2K-41`, `E2K-60` get an argument, words or a row (section 12) | the edits of section 12; DOC-UPDATER corrects the sentence at step 10 with `before_copy` (as `decisions/0112` О12) | the new fixtures cannot be added without them |
| О8 | The README budgets sentence gets `team-web` 70000, though the block names only "a row" | yes, with `E2K-41` and `E2K-60` reading it (AP-077) | the budget of the file would be written nowhere but in the block |
| О9 | The line for a question on the runner: 42000 ms (60 % of 70000, `decisions/0109` О11) | 42000 | 56000 (80 %), since about 23 s of the file are the product's own clock |
| О10 | The favicon line: once per start in one-tab tests, at least one in `control` (two tabs) (C-10) | as stated | once per start in `control` held in the 5 measured runs with two tabs (F31), but it would rest on the browser's cache |
| О11 | The unwritable data folder: the page says «Что-то пошло не так. Повторите позже» and the list stays «Загрузка…» (F27); the criterion asks a plain sentence, which this is | the criterion is met; the general words are recorded, not changed (a more precise sentence is a change of the page, a new requirement) | — |
| О12 | "An empty message is not sent" is tried as the empty field and as blanks, with one snapshot and one wait for the page's own chat poll (up to 5 s) as the proof that nothing went after the tries | as stated | a reading of the page's records at once can miss a request still on its way |
| О13 | The block leaves horizontal overflow unasserted and asks a question; measured: no overflow on either page in the three windows (F30) | not asserted; the measurement goes to the owner as an answer | an assertion would be a new criterion |
| О14 | The list words of the second server are not asserted (it stays «Загрузка…» with the error bar); "no project appears in the list" is read as "no row" | as stated | asserting «Загрузка…» would pin a state the criterion does not name |
| О15 | "The state of a finished project" is read as the status «выполнен» (README "Completion") together with `PROJECT_DONE` last in the journal | as stated | — |
| О16 | The open kit defects ISS-0105, ISS-0107, ISS-0108, ISS-0109 [F5], ISS-0110, ISS-0111 are not touched (section 20) | as stated | — |
| О17 | The mutants and the anti-pattern candidates of section 15 (Q13) are recorded by DOC-UPDATER at step 10 from `result.issues` | as stated | — |
| О18 | The owner's question `decisions/0112` О19 (a preload that refuses any start naming the person's home or the real Pixel Office folder, as a raise of the bar) is still open; this design used such nets for its own trials only (F44) | recorded, not a rule of the run | — |

---

## 20. The open defects of the kit (`docs/issues/ISS-0105`, `ISS-0107`, `ISS-0108`, `ISS-0109`, `ISS-0110`, `ISS-0111`)

| Defect | Touched by this design? | What it means here |
|---|---|---|
| ISS-0105 (a text added after a screen is read; the network of workers) | no | the spec reads each screen after a fact and the page has no worker; not fixed here |
| ISS-0107 (a group stays registered after its leader ended) | no | the starter and `browser.js` keep their group shape; the one argument of О1 does not change it |
| ISS-0108 (older tests leave folders in the system temporary folder) | no | the spec's folders are made by `makeTempDir` and removed in a `finally`; not fixed here |
| ISS-0109 (`browser.js` and `withBrowser` keep four error shapes) [F5] | no | sub-step 1 changes only `buildArgs` (`tools/test/e2e/kit/browser.js`, lines 27–38 on the tag); the shapes of ISS-0109 stand in `launchBrowser` (the pipes at line 224 before the `error` listener at line 242) and in `withBrowser` (lines 354–355); not fixed here |
| ISS-0110 (`safeText` lets bidirectional controls through) | no new caller | the spec adds no message that puts foreign text through `safeText`; the starter's messages stay as they are |
| ISS-0111 (seven Low items of the starter and the Pixel Office spec) | no | the starter is not changed (C-1), so no line of ISS-0111 is touched; its items stay for the next change of the kit |

---

## 21. Closed in the rework of step 01c (the findings of the gate, pass 1, and `decisions/0113` О19–О22; not for the owner)

| Finding | How it is closed | Where |
|---|---|---|
| F1 (Medium) | the delay rule of `team-slow.json` also checks the chain of the plan tasks, read from the file (rule 1), and `control` reads project A's journal: the first `TASK_STARTED` to `PROJECT_DONE` at least 10000 ms (rule 2); V06 red by rule 1, V06j (rule 1 removed) red by rule 2 | 4.2, 4.4 test 4, 8 row 4, 16 |
| F2 | the trap merged last in the stand's `env`; `teamOptions` refuses every given name other than `SAI_TEAM_RETRY_DELAY_MS`; V03 red in `failure` | 4.1, 4.4 helpers, 6, 16 |
| F3 | `E2K-50` gets one more assertion: every `*.e2e.js` of `tools/test/e2e` is in `SCANNED`; V21 red | 3, 12 row 2, 14 (4a), 15 Q6, 16 |
| F4 | the chat test: the 400 line declared once for the test; the field emptied by the page and asserted `""`; each try typed (the kit focuses the field), Ctrl+Enter in the field, then the button; "the chat ready" defined; P19 green, P19b red | 4.4 test 5, 16 (P19) |
| F5 | ISS-0109 named: not touched; sub-step 1 changes only `buildArgs` | 19 (О16), 20 |
| F6 | the worst runner estimate crosses 42000 ms; a time above the line is a question to the owner (`decisions/0113` О9, О22) | 7 |
| F7 | the README sentence says only what was measured and what the switch is named for; C-7 the same | 2 (C-7), 10 item 2 |
| F8 | the sha256 of both copies, the trap and the scenario, asserted equal to their sources | 2 (C-1), 4.1, 4.4 helpers, 6 |
| О19 | the scope of R2-T (a) written where the trap control and the kit's stand-ins are described | 1 (lead-in), 2 (C-2), 4.4 test 1, 6 |
| О21 | `BAD` also refuses a technical code shape (`E_` and capitals); `control` reads the progress `N из M задач` with N < M while in work; V15 and V18 red | 4.4 (constants, helpers, tests 4 and 6), 8 rows 3 and 6, 16 |
| О20, О22 | О20 changes no text of this design; О22 is written into section 7 with F6 | 7 |

Found beyond the list and not changed here (AP-019): none. Three references to the open state of the questions were brought to `decisions/0113` (AP-005): section 0 item (3), the variant paragraph of section 3, the heading of section 19. The counts of section 0 and F46, the measurements of F38, F43 and section 7, and the sketch notes of section 18 were brought to the state of step 01c, since they count the changed tests and mutants (AP-143).

**As built (step 10).** This table covers the rework of step 01c only. The spec was reworked later in the run: step 05c closed F1 (Medium), the first part of F2 and F3 of gate 5b (`decisions/0113` О31); step 05d closed the rest of F2 with the window after «Не останавливать» (О32); О33 put the part of F3 that only a reading finds among the by-nature gaps of section 16; gate 5e passed on pass 2 of 3 with N1 and I3, which О34 sends to a defect; step 9 passed with L1 and L2 (О35). The records: `handoffs/E2E107-20261116-01/step-05c-test-fixer.json`, `step-05d-test-fixer.json`, `step-05e-test-design-validator.json`, `step-09-release-validator.json`.

---

## 22. As built (DOC-UPDATER, step 10, 2026-11-16; the design text above is not rewritten)

**Counts (read from the files at step 10; the commands from `tools/`).**

- `test/e2e/team-web.e2e.js`: 1369 lines (`wc -l`); 7 top-level tests (`grep -c '^test(' test/e2e/team-web.e2e.js` → 7: `stand`, `create`, `finish`, `control`, `chat`, `failure`, `windows`); 108 `assert.` (`grep -o 'assert\.' test/e2e/team-web.e2e.js | wc -l`). The prototype of F46: 819 lines and 86 at step 01, 870 and 94 at step 01c.
- Fixtures in `test/fixtures/e2e/`: `claude-trap.js` 18 lines, 1043 bytes, mode `-rwxr-xr-x`; `team-slow.json` 63 lines; `team-fail.json` 30 lines. `test/fixtures/team/engine-basic.json` unchanged against the tag.
- `test/e2e-kit.test.js`: 52 tests (`grep -c '^test($'` → 52 and `grep -c 'test('` → 59, both as on the tag), 544 `assert.` (537 on the tag); four tests changed, `E2K-25`, `E2K-41`, `E2K-50`, `E2K-60` (section 12, «As built»).
- `test/e2e/kit/browser.js`: one line added (`--use-mock-keychain`), 360 lines. Unchanged against the tag (`git diff --quiet` → 0): `test/e2e-stand.test.js` (22 tests), `test/e2e/kit/stand.js`, `test/e2e/kit/runner.js`, `src/`, `package.json`, `package-lock.json`.
- `npm test`: 2209 tests, as on the tag (the spec is an e2e file); `npm run e2e`: 36 tests (`picker` 9, `pixel-office` 7, `smoke` 13, `team-web` 7); read from the full checks of steps 06 and 09, here and on GitHub.
- `node --test test/e2e-kit.test.js test/e2e-stand.test.js` → 74 of 74 at step 10, after the README edit of О27.
- This design after the notes: 58 mutant rows in section 16, 18 open questions in section 19, 46 facts in section 1 (the commands of F46).

**Differences between the design and the built work** (the records: `decisions/0113` О23–О36 and the handoffs of the run).

1. `teamOptions(folders, { env, data })`, the options frozen and known by their object, the folders of each test known by a `WeakSet`; the two start helpers `teamStand` and `withTeam` through `checkedOptions`; `startCode` and `untilStopped` (sections 4.1 and 4.4, «As built»; О23, О29).
2. The plain-words check also reads the unfolded source text (`sourceOf`, `sourcesOf`; О31), and the `HOME` of the trap control is a checked fact (F3 of gate 5b) — section 4.4, «As built».
3. `control` proves «Не останавливать» over a window up to the page's next poll of B (О32); the length of the window is not asserted (N1).
4. `E2K-60` also reads the keychain sentence in order and the absence of the line «REQ-107 adds its row.» (О27, О28).
5. `tools/README.md`, the keychain sentence: «measured for REQ-107 on macOS: …» (О27; step 10).
6. The block REQ-107: three facts corrected at step 10 without a change of meaning (the starter's private home, `decisions/0112` О1; the trap copy under the temporary root, О3; the guard-test sentence, О7), and the status `done` with the limits of О35.

**Recorded outside this design.** The missing favicon of the team page (О10): `docs/issues/ISS-0114`. The words of the create refusal for a data folder that cannot be made, and the list left at «Загрузка…» (О11): `docs/issues/ISS-0115`. The Low gaps of the spec — L1 and L2 of step 9 first, then N1 and I3 of step 05e, with the red output of M03 (О34, О35): `docs/issues/ISS-0116`. The `com.google.Chrome.*` folders that every Chrome start of the kit leaves on macOS (О26) and the 203 `sai-*` entries of every check: `docs/issues/ISS-0108`. The order check: `docs/issues/ISS-0102`. The process errors of the run: `docs/anti-patterns.md`, AP-155 to AP-160. `decisions/0112` О14 and О22 are settled by this design (section 17); the addendum is ORCH's.

**What is not proven (honest limits).**

- The runner: two samples of one image version (26239 and 25954 ms, section 7; AP-144). Every other run was on one Mac (macOS arm64, Chrome 157.0.8103.78); Windows never.
- The keychain switch: «with it Chrome answers its first navigation under a home below the temporary root, and without it it does not» is measured on macOS only; on Linux it is shown only that the four spec files stay green with it and that no line of the log names the keychain (steps 06 and 09). О1 as corrected by О25: the browser of the normal check under the person's own home is not measured.
- Criterion 1 with the limit of О35 (a) and criterion 7 with the limit of О35 (b), section 4.4, «As built»; both are the first items of `docs/issues/ISS-0116`.
- No sideways overflow on either page in the three windows (О13, О36): measured by RELEASE-VALIDATOR on this Mac with a red positive control; no test asserts it.
- The margin of project B (at least 4759 ms) and the window after «Не останавливать» (4935–5003 ms) are measured on this Mac only.
