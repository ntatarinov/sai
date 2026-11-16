# REQ-104 — code design: a real-Chrome end-to-end kit in pure Node and the command `npm run e2e` inside `npm run check`

Run `E2E104-20261103-01`, WF-02 step 1. Base: the tag `base/E2E104-20261103-01` (commit f806d7d). The block REQ-104 and the record `decisions/0107-e2e-real-chrome-in-check.md` are in the working tree and are not in the tag (checked: `git show base/…:docs/requirements.yaml | grep -c "id: REQ-104"` gives 0, and `git cat-file -e base/…:decisions/0107-…` fails), so statements about the requirement are read from the working tree and statements about the system are measured on fresh clones of the tag.

This file holds shapes, signatures, tables and texts. It holds no implementation code.

Rework `01c` (by the remarks F1…F10 of the gate `handoffs/E2E104-20261103-01/step-01b-code-design-validator.json`) changed: section 1 (facts F29…F33 added, F6 corrected), 3, 4.4, 4.6, 5, 6, 7, 11, 15, 16, 17. The table "what was fixed, where" is in the handoff of step 01c, `result.changes`.

Rework `01e` (the last repeat; by the remarks F11…F16 of the second gate pass `handoffs/E2E104-20261103-01/step-01d-code-design-validator.json`) changed: section 1 (facts F34, F35 added), 3, 4.4, 4.6, 6 (signature, steps 1, 4, 5, the signal paragraph, exit codes), 7 (rows 12, 17, 18), 8, 10, 11 (words rule, E2K-18, 25, 32, 33, 34, 37, 38, new E2K-39, E2K-50, E2K-51, 11.3), 15, 16 (M59 reason, M62…M72), 17, 18, 19 (О9), 20. The table "what was fixed, where" is in the handoff of step 01e, `result.changes`.

Step 10 (DOC-UPDATER, 2026-11-03, after the PASS of step 9) changed only numbers and added rows and a section: the counts in sections 0, 3, 11.1 and 11.3 now are the built ones (50 + 13 = 63 tests, 10 spec fixtures); the row E2K-32 got the `exit-one` case; the row E2K-46 was added; section 21 "As built" lists what differs from this design. The rest of the text is the design as it was checked and is not rewritten.

Step 10 of the run `ISS-0103-20261103-01` (DOC-UPDATER, 2026-11-03T19:35:10Z, after the PASS of step 9 of WF-03) corrected fact F20, the rows E2K-18 and E2K-38 of 11.1 (a killed process is waited for with a limit, the helper `waitGone`), added the rows E2K-62 and E2K-63, set the counts to the built ones (52 + 13 = 65 tests) and added a part to section 21. Nothing else was rewritten.

---

## 0. Summary

- **What is built.** A kit of ten small modules in `tools/test/e2e/kit/` plus the runner `tools/test/e2e/run.js`; the command `cd tools && npm run e2e [-- <name> …]` that runs the spec files `tools/test/e2e/<name>.e2e.js` one after another and prints the run record; the sixth and last step `npm run e2e` of `scripts.check`; one smoke spec in a real Chrome; one test file `tools/test/e2e-kit.test.js` that needs no Chrome (a stand-in program speaks the protocol); a stand-in program `tools/test/fixtures/e2e/fake-chrome.js`; two README texts. No source file in `tools/src/`, no npm package, no change of `package-lock.json`.
- **How Chrome is driven.** `child_process.spawn` of Chrome as its own process group with `--headless=new --remote-debugging-port=0` and a fresh profile folder under the temporary root; the port is read from the `DevTools listening on` line of stderr; the global `WebSocket` of Node 22 talks to the browser endpoint; pages are separate targets reached through flat sessions (`Target.createTarget`, `Target.attachToTarget` with `flatten: true`), so several tabs work and no `/json/list` is needed.
- **Four things found by the sketches that the requirement does not state** and that the design builds in: (1) the default colour scheme of a headless Chrome follows the machine (it is dark on this Mac), so the kit sets the light scheme explicitly on every new page; (2) a launched Chrome survives a killed parent and sits in its own process group, so the kit cleans up by process group, also on `exit`, `SIGINT`, `SIGTERM`, `SIGHUP`, and the runner does the same for the process group of a running spec file; (3) a client that parses a protocol answer without a guard crashes the whole test process on a non-JSON answer; (4) without a resolver rule the browser reaches the network (an unrestricted trial that navigated to foreign addresses did not finish in 120 s), so the kit adds `--host-resolver-rules` that leaves only 127.0.0.1 reachable (the second layer of criterion 5; a question for ORCH, О5).
- **Sizes.** 13 criteria → 65 tests as built (52 `E2K-…` in `tools/test/e2e-kit.test.js`, 13 `SMK-…` in `tools/test/e2e/smoke.e2e.js`; the design planned 53: 40 + 13; see section 21; two of the 52 came with ISS-0103), 8 build sub-steps, 72 mutants, 9 open questions for ORCH (О1…О9).
- **Replacement table.** Measured on the tag: exactly six guard tests turn red when `check` gets a sixth step (HC-02, HC-03, HO-54, PK-7b, LP-3, CTL-13); a full `npm test` of a clone with every file of this work present gave `# tests 2136`, `# pass 2130`, `# fail 6`, `# skipped 0`, `# todo 0` in 235.8 s (section 12).

---

## 1. Checked facts

All measurements were made on 2026-11-02T21:14Z–21:45Z (clock `date -u`; the local date of the owner is 2026-11-03, UTC+5), on macOS arm64, Node v22.23.4, Google Chrome 156.0.8078.74. Sketches lie outside the project in `<scratch>/e2e104/` (section 20). "Clone" means `git clone -b base/E2E104-20261103-01` into `<scratch>/e2e104/clone` (and `clone2` for the stage without the `package.json` edit), then `npm ci` in `tools/`.

| # | Statement | Command / sketch | Result |
|---|---|---|---|
| F1 | The tag holds neither REQ-104 nor decision 0107 nor a script `e2e` | `git show base/…:docs/requirements.yaml \| grep -c "id: REQ-104"`; `git show base/…:tools/package.json \| grep -c '"e2e"'` | 0; 0; `git cat-file -e` of the decision: "exists on disk, but not in" the tag |
| F2 | Nothing like the kit exists on the tag | `grep -rlE 'remote-debugging-port\|Emulation\.\|Page\.navigate' tools/test tools/src` in the clone | no file (REQ text, repeated by the validator; the sketch folder holds the only users) |
| F3 | `check` has five steps; `scripts` has 18 keys; `test` is `node --test "test/**/*.test.js"` | `tools/package.json` of the clone | as the six guard tests assert |
| F4 | The six guard tests and their lines | `grep -rnE "scripts\.check\|pkg\.scripts\|Object\.keys\(.*scripts\|npm run test\|package\.json" tools/test` in the clone | HC-02 `handoffs-docs.test.js` 16–36; HC-03 same file 40–47 (assertion at 46); HO-54 `handoffs-cmd-docs.test.js` 141–161; PK-7b `picker-config.test.js` 779–795; LP-3 `picker-look-property.test.js` 292…466 (assertions 440–466); CTL-13 `team-web-control.test.js` 1702; other hits are `scripts.lint`, `scripts.picker`, `scripts.team`, `scripts["team-web"]`, `scripts.traces`, `scripts["pixel-office"]` (assert single keys, unchanged) |
| F5 | Stage A (only the new files, `package.json` and READMEs untouched): the 14 tests files that can be touched (the six + `traces-check`, `repo`, `team-docs`, `traces-readme`, `pixel-office-settings`, `exec-docs`, `exec-scripted-source`, `picker-page-static`, `team-web-docs`) | `node --test <14 files>` in `clone2/tools` | `# tests 187`, `# pass 187`, `# fail 0` |
| F6 | Stage C (after the `package.json` edit `e2e` after `test`, `npm run e2e` appended) with the READMEs edited | same files in `clone/tools` | `# tests 187`, `# pass 181`, `# fail 6`: HO-54, HC-02, HC-03, PK-7b, LP-3, CTL-13 (command: `cd tools && node --test test/handoffs-docs.test.js test/handoffs-cmd-docs.test.js test/picker-config.test.js test/picker-look-property.test.js test/team-web-control.test.js test/traces-check.test.js test/repo.test.js test/team-docs.test.js test/traces-readme.test.js test/pixel-office-settings.test.js test/exec-docs.test.js test/exec-scripted-source.test.js test/picker-page-static.test.js test/team-web-docs.test.js`; repeated by the gate with the same figures) |
| F7 | Full suite with every file of this work present (dummy kit files, a dummy `e2e-kit.test.js`, a `fake-chrome.js`, the `package.json` edit, both README edits) | `cd tools && npm test` in `clone` | `# tests 2136`, `# pass 2130`, `# fail 6` (the same six), `# skipped 0`, `# todo 0`; 235.8 s wall time |
| F8 | `lint`, `format:check`, `traces` accept the new files; the shebang file keeps mode 0755 | `npm run lint`, `format:check`, `traces` in `clone/tools` | exit 0; `traces: files 2377, traces 0` (the command lists untracked files too: `git ls-files --cached --others`) |
| F9 | ESLint knows the Node globals the kit needs (`WebSocket`, `fetch`, `performance`, `AbortSignal`, `structuredClone`, `URL`) and does NOT know `document` | a probe file in `tools/test/e2e/` | only `'document' is not defined (no-undef)` — so page code cannot be written as a function in a spec; it is passed as a string (О2) |
| F10 | The root `README.md` is not covered by `prettier --check` (the command runs in `tools/`); running prettier on it re-wrote 15 unrelated lines | `npx prettier --write ../README.md` in the clone | the edit of the root README must be made by hand and must not be passed through prettier |
| F11 | Node 22 `node --test` in a non-terminal gives TAP with `# tests`, `# pass`, `# fail`, `# skipped`, `# todo`; a file with no test registers itself as one test (`# tests 1`, the only `ok` line is the path of the file); `skip` and `todo` options are counted in `# skipped` / `# todo` while the exit code stays 0 | three small files in the clone | as stated |
| F12 | Start of Chrome: `--headless=new --remote-debugging-port=0 --user-data-dir=<temp> --no-first-run --disable-gpu about:blank`, detached; the stderr has an empty line, then `DevTools listening on ws://127.0.0.1:<port>/devtools/browser/<uuid>`; ready in 274 ms; the global `WebSocket` connects with no `Origin` header and no extra flag; `Browser.getVersion` gives `product: "Chrome/156.0.8078.74"` | sketch `s1`, `s8` | as stated |
| F13 | A headless window without an override is 756×469 inside (`outerWidth` 756). `Emulation.setDeviceMetricsOverride({width,height,deviceScaleFactor:1,mobile:false})` gives `innerWidth`/`innerHeight` equal to the request for 1470×784, 390×844, 320×568 and 200×300. With `mobile:true` a 320 window reports 980 | sketch `s1` | as stated; the kit uses `mobile:false` |
| F14 | Horizontal overflow: a page with a 700 px block at 320 gives `documentElement.scrollWidth` 708 > `innerWidth` 320; a fluid page gives 320 and 320 (equal, not overflowing) | sketch `s1` | the comparison must be `>` (an `>=` is a mutant) |
| F15 | The default `prefers-color-scheme` of this headless Chrome is **dark** (`matchMedia(...).matches` true, body `rgb(17, 17, 17)` on a page that styles itself). `Emulation.setEmulatedMedia({features:[{name:"prefers-color-scheme",value:"light"}]})` gives false and `rgb(255, 255, 255)`; `dark` gives true and the dark colour; `features: []` returns to the machine value | sketch `s1` | the kit sets `light` on every new page (the machine decides the default) |
| F16 | Click and keys: mouse press/release at the centre of `getBoundingClientRect()` after `scrollIntoView` changes the title; `elementFromPoint` at that point tells that a covered button is covered (`hit:false`, `top:"ov"`) and that a button far down the page is reached after scrolling (`hit:true`). `Input.dispatchKeyEvent` with `key`, `code`, `windowsVirtualKeyCode` (Tab 9, Enter 13 with text `\r`, Space 32 with text ` `, Shift = modifier 8) moves focus, toggles a checkbox with Space and activates a button with Enter; `Input.insertText` types `привет` into the focused field; the focus outline of a focused button is `1px auto` | sketches `s4`, `s12` | as stated |
| F17 | Network: `Network.requestWillBeSent` / `responseReceived` / `loadingFinished` give method, url, `postData`, status; `Network.getResponseBody` returns the body of a finished POST; `Page.reload` works; a second tab of the same profile sees the `localStorage` of the first | sketch `s4` | as stated |
| F18 | Console and errors: `console.error('x')` → `Runtime.consoleAPICalled` type `error` with args; a throw in a timer → `Runtime.exceptionThrown` text `Uncaught`, description `Error: timer boom`; a rejected promise → `Runtime.exceptionThrown` text `Uncaught (in promise)`, description `Error: rej boom`; a `fetch` answered 500 → `Log.entryAdded` level `error`, source `network`, text `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`, with the `url` field; a clean page gives no event | sketch `s1` | four distinct entries by (kind, text) |
| F19 | The favicon line: the first page load of a fresh profile gives one `Log.entryAdded` (`…404 (Not Found)`, `url` = `/favicon.ico`) 5 ms after `Page.loadEventFired`; the next loads in the same tab, in the same start, and in new tabs give none. A page that answers 404 gives the **same text** with its own `url` — text alone cannot tell the favicon line from a page 404 | sketches `s2`, `s3` | declarations must match on text and, optionally, the `pathname` of `url`; the final check must wait after the last load |
| F20 | Clean-up: `SIGTERM` to the process group, then polling `process.kill(-pgid, 0)` until `ESRCH`, took 17–54 ms in five trials; the profile folder then could be removed (`rmSync` with retries). `SIGKILL` of the group is sent at once, but the death is not instant for an observer: a killed process that its parent has not yet reaped still answers `kill(pid, 0)`, so a check right after the end of the parent can see it alive (corrected 2026-11-03 by ISS-0103: on GitHub E2K-18 failed once for this reason; the tests wait with a limit, the helper `waitGone`, section 11.1, E2K-62, E2K-63). A kill of the Chrome leader only also ended its children on macOS (the group kill is still needed on Linux, and is tested with a stand-in that starts a child, E2K-17). A `SIGKILL` of the **parent** left 9 Chrome processes alive (orphans) | sketches `s5`, `s6`, `s7` | the kit must clean up on `exit`, `SIGINT`, `SIGTERM`, `SIGHUP`; a `SIGKILL` of the runner itself cannot be covered (residual risk, О7) |
| F21 | The handlers work: a child that registered `exit`, `SIGINT`, `SIGTERM` handlers which kill the group and remove the profile left no Chrome and no folder after `SIGINT` (exit 130), `SIGTERM` (143), `process.exit(3)` and an uncaught throw (exit 1) | sketch `s11` | as stated |
| F22 | A killed browser mid-call: `Runtime.evaluate` of a never-resolving promise rejected 120 ms after the `SIGKILL` of the group with "browser closed during Runtime.evaluate"; a later call rejects at once | sketch `s1` | the 5 s limit of criterion 3 has a large margin |
| F23 | Confinement: with `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`, navigation to `http://example.com/`, to the literal address `http://192.0.2.1/`, to `localhost`, and a 302 from a 127.0.0.1 page to `http://example.com/` all fail at once (`net::ERR_NAME_NOT_RESOLVED`, 312–317 ms) and 127.0.0.1 loads. With `--proxy-server=http://127.0.0.1:9` the foreign addresses fail with `ERR_PROXY_CONNECTION_FAILED`, but `localhost` still loads. Without any rule, the same list of navigations did not finish in 120 s (the sketch was stopped) | sketch `s8` | the resolver rule is the exact "only 127.0.0.1" |
| F24 | The stand-in program: a 70-line Node program (HTTP `upgrade`, SHA-1 accept key, unmasked text frames, masked frames read) is enough for the global `WebSocket` of Node 22 to connect, call and receive answers. Seven modes measured: `ok` (call answered), `exit-early` (exit code 3 and a stderr line seen by the parent), `hang` (no port line; the process stayed alive after the start limit — the kit must kill it), `port-then-close` (call rejects "browser closed during …" in 100 ms), `bad-json` (a naive client **crashed the process** with an uncaught `SyntaxError` — the kit must guard the parse), `error-object` (rejection carries the browser's message), `no-answer` (no answer: needs a call limit) | sketch `s9` | as stated |
| F25 | The first run of sketch `s9` died on an uncaught JSON error of its own client; the stand-in it had started stayed alive as an orphan in its own group (found by `ps`, killed by its pid) | clean-up of sketch `s9` | the same orphan problem as F20, seen by accident: the kit must guard the parse (F24) and clean up by group |
| F26 | `navigator.language` is the machine's (`ru-RU` here); `Emulation.setLocaleOverride` + `Network.setUserAgentOverride({acceptLanguage})` change `navigator.language(s)` | sketch `s3` | available, **not** in the kit: REQ-104 says the Sai pages take the language from `?lang=` and their own buttons |
| F27 | The GitHub image `ubuntu-24.04`, version 20261026.354.1, lists `Google Chrome 156.0.8078.47` and `Chromium 156.0.8078.0` in its published software list; the log of an earlier run of `check.yml` has `Image: ubuntu-24.04` | `gh api repos/actions/runner-images/contents/images/ubuntu/Ubuntu2404-Readme.md` (read only); the REQ text | **documentation, not a run**: whether Chrome starts there with its sandbox on is NOT measured and cannot be from this Mac; criterion 10 settles it by a real run (branch A/B/C) |
| F28 | Cost of one browser start-use-stop cycle (start, one tab, one load, close, folder removed) | sketch `s10`, 12 cycles | 494–633 ms each, total 6.2 s |
| F29 | Inside a `node:test` test (so inside `npm test`, where E2K-32…E2K-38 run) the variable `NODE_TEST_CONTEXT` is `child-v8`; a nested `node --test --test-reporter=tap <file>` started with that environment exits 0 and prints **nothing** on stdout (stderr: "node:test run() is being called recursively within a test file. skipping running files."); with the variable removed from a copy of the environment it prints the TAP (`ok 1 - alpha`, `# tests 1`, …). Inside a test the keys that start with `NODE` or `TEST` are `NODE_TEST_CONTEXT` only when started by `node --test` directly, and `NODE` (the path of node, set by npm) and `NODE_TEST_CONTEXT` under `npm run`; the `npm_*` keys that npm adds are harmless to the nested run. So one variable is cleared. The repository already drops it in `tools/test/handoffs-cmd-docs.test.js`, function `nodeTest` | sketch on a fresh clone of the tag (2026-11-02T22:11Z–22:16Z): an outer test file spawning the nested run in both modes; `Object.keys(process.env)` filtered inside a test | as stated; `delete env.NODE_TEST_CONTEXT` on a copy is the fix |
| F30 | The path form of the spec argument, working folder `tools/`: `test/e2e/x.e2e.js` and `./test/e2e/x.e2e.js` both run, and TAP prints the **normalized relative** name (`ok 1 - test/e2e/x.e2e.js`, no `./`) for a file with no test; `tools/test/e2e/x.e2e.js` gives `Could not find 'tools/test/e2e/x.e2e.js'` (exit 1, no TAP); an absolute path runs and TAP prints the absolute path. A file with a skipped and a todo test prints `ok 2 - b # SKIP`, `ok 3 - c # TODO`, `# skipped 1`, `# todo 1` and exits 0 | sketch, the same clone, with an empty file and a three-test file | the runner passes the relative form without `./` and compares the single top-level `ok` line with that same string |
| F31 | Stopping a running spec file: `node --test <file>` is a parent that runs the file in a **child process**. `SIGTERM` to the parent is forwarded to the file child (its handler ran; both gone). `SIGKILL` to the parent only leaves the file child alone. With the spec started `detached` (own process group) and the signal sent to the **group**, the file child receives it either way. A runner that, on its own `SIGTERM`, sends `SIGTERM` to the spec group, waits until the group is gone and exits 143, leaves no spec process (the file child ran its `SIGTERM` handler) | sketches `runner-sim` (plain, detached) and `runner-sim2` (signal handlers), 2026-11-02T22:14Z–22:19Z | the spec process is started in its own group; the runner forwards its signals to that group and kills it by group after the grace time (sections 6, 7) |
| F32 | The stand-in mode `noisy` must write with `fs.writeSync(2, …)`: a child writing 1 MB in 4 KB chunks with `fs.writeSync(2, chunk)` to a pipe nobody reads is still running after 1.5 s and finishes at once after the pipe is read; with `process.stderr.write` the child finishes within 2 ms without any reader (buffered in the child), so the mutant "stderr not read after the port line" would survive | sketch `noisy-parent` / `noisy-child` | `noisy` uses `fs.writeSync` (section 5) |
| F33 | `eslint` and `prettier --check` accept a spec file with a `skip` option, a spec file with a `todo` option and a zero-byte `.e2e.js` file in `tools/test/fixtures/e2e/`; `node --test "test/**/*.test.js"` does not match `*.e2e.js` files there | sketch in the clone | the runner fixtures are plain files (section 11) |
| F34 | The TAP text of a failing spec holds the machine's absolute path. A fresh clone of the tag in the session scratch folder, a spec `fail.e2e.js` with one throwing test, captured by `env -u NODE_TEST_CONTEXT node --test --test-reporter=tap test/fixtures/e2e/specs/fail.e2e.js` (exit 1): line 7 `location: '<absolute path>/tools/test/fixtures/e2e/specs/fail.e2e.js:3:1'` and line 12 `TestContext.<anonymous> (file://<absolute path>/tools/test/fixtures/e2e/specs/fail.e2e.js:4:9)`; the passing spec's text holds no path (`ok`, `duration_ms`, `type`). `npm run traces` in that clone with the captured file untracked (it lists untracked files, F8): `tools/test/fixtures/e2e/tap/fail.txt:7` and `:12` "путь домашнего каталога" (the scratch path holds the encoded home form `-Users-<name>-`), `traces: … следов 2`; with the prefix replaced by a made-up path in the home-folder style of macOS (a user name and a project folder after the folder `Users`) the same two lines and `следов 2`; with one such line left in the file the command exits 1. After the rule "remove the absolute path of the `tools/` folder, in the form `file://<abs>/` and in the form `<abs>/`, from the captured text" the lines read `location: 'test/fixtures/e2e/specs/fail.e2e.js:3:1'` and `(test/fixtures/e2e/specs/fail.e2e.js:4:9)`, `traces` gives `следов 0`, exit 0, `npm run -s traces \| grep -c -E 'tools/test/e2e\|tools/test/fixtures/e2e'` gives 0, `prettier --check` accepts the folder, and `hasHomePath` (per line) and `hasTempPath` (whole text) of `tools/src/traces/rules.js` give false for both captured texts | sketch in `<scratch>/e2e104e/` (2026-11-03) | the committed tap texts are normalized by that rule and a test pins it (section 11.3, E2K-34) |
| F35 | A pid that no process can have gives `ESRCH` for `process.kill(-pid, 0)` on this Mac (2147483646, 4194305 and 99999 all: `ESRCH`) | one `node -e` call | the fake child of E2K-37 can carry the pid 2147483646: if the clean-up sent it a signal by mistake, nothing would be hit (Linux: not measured; the value is above the 22-bit pid limit) |

Statements of the requirement that were **checked and held**: the six red tests (F6, F7); the line numbers of the table (F4); `check.yml` with 4 name lines; a window narrower than about 500 px needs the override (F13). **Not confirmed and not assumed**: the Linux flags and the sandbox on the runner (F27), the behaviour of `--host-resolver-rules` on Linux (the same network code; it is read in the criterion-10 run through the smoke test SMK-13).

---

## 2. Design choices that could be disputed

Each one has a default that this design uses; ORCH confirms or changes it with the record proposed in section 19.

| # | Choice | Default | Why | Question |
|---|---|---|---|---|
| C-1 | Page code is passed to the page as a **string**; the helpers refuse a function | strings | F9: a function body with `document` fails `no-undef`; adding browser globals to `eslint.config.js` for `test/e2e/**` is a change of a file the requirement does not list | О2 |
| C-2 | A starter of server processes for the page specs (spawn, read a stdout line, SIGTERM and the exit code) | **not in this kit**; REQ-105 designs it when it needs it. *Since 2026-11-15 (REQ-105, run `E2E105-20261105-01`): built as `startStand` and `withStand` in `tools/test/e2e/kit/stand.js`, exported by `tools/test/e2e/kit/index.js`; design `docs/design/REQ-105-e2e-picker.md`, section 4.1; `decisions/0108` О1 is carried out* | no criterion of REQ-104 covers it; a test without a criterion is not allowed here | О1 |
| C-3 | The runner stops at the first spec file that fails, kills a hung file after 120 s, and fails a file that registered no test or has `skipped`/`todo` above 0 | yes | Q4 "stops at the first error", Q6; F11 shows that a file with no test passes silently | О3 |
| C-4 | `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1` in the Chrome arguments | yes | F23; makes "the browser can only visit this computer" true for redirects, sub-resources and literal addresses, not only for the first URL | О5 |
| C-5 | The stand-in program is written by BACKEND-DEV (a stand, as in the design of REQ-056), the tests by TEST-DESIGNER | yes | the fault paths of the kit cannot be checked in sub-steps 3–4 without it | О6 |
| C-6 | The preflight launches the browser once (to print `e2e: browser=` from `Browser.getVersion`), not `chrome --version` | launch | it proves that Chrome starts, before any spec; `e2e: browser=` absent then means "Chrome did not start", which is what branch C of criterion 10 reads | — |
| C-7 | The kit offers key presses, network records with response bodies, `reload` and a second tab, which the description of REQ-104 does not list among "the kit can" but REQ-105 (criteria 2, 4, 5, 6) and REQ-107 (criterion 4) need | yes, with tests SMK-09, SMK-11 under criterion 3 | a kit that lacks them blocks three requirements; an API that is added later by each of them would be written three times | О8 |

---

## 3. Files, owners, order

Paths from the root of Sai. "New" = created by this work.

| File | Change | Owner | Sub-step |
|---|---|---|---|
| `tools/test/e2e/kit/errors.js` | new — `E2eError`, the table of codes | BACKEND-DEV | 1 |
| `tools/test/e2e/kit/find-chrome.js` | new — the places and the lookup | BACKEND-DEV | 1 |
| `tools/test/e2e/kit/guards.js` | new — URL, path, repository and temporary-root checks | BACKEND-DEV | 2 |
| `tools/test/e2e/kit/cdp.js` | new — the protocol client | BACKEND-DEV | 3 |
| `tools/test/fixtures/e2e/fake-chrome.js` | new, mode 0755 — the stand-in program (section 5) | BACKEND-DEV (stand) | 3 |
| `tools/test/e2e/kit/cleanup.js` | new — the registry, `makeTempDir`, signal and exit handlers, signal hooks | BACKEND-DEV | 4 |
| `tools/test/e2e/kit/console.js` | new — the pure matcher of console entries and declarations (pure, depends on `errors.js` only; moved to sub-step 3, remark F10) | BACKEND-DEV | 3 |
| `tools/test/e2e/kit/browser.js` | new — `launchBrowser`, `withBrowser`, `Browser` | BACKEND-DEV | 4 |
| `tools/test/e2e/kit/page.js` | new — `Page` | BACKEND-DEV | 5 |
| `tools/test/e2e/kit/index.js` | new — the exports the specs use | BACKEND-DEV | 5 |
| `tools/test/e2e/kit/runner.js`, `tools/test/e2e/run.js` | new — selection, TAP analysis, record line, main | BACKEND-DEV | 6 |
| `tools/package.json` | script `e2e` between `test` and `check`; `check` gets the sixth step | BACKEND-DEV | 7 |
| `tools/README.md` | the section and the sentence of "Check" (section 14) | BACKEND-DEV | 8 |
| `README.md` (root) | the paragraph "You need" (section 14) — by hand, not through prettier (F10) | BACKEND-DEV | 8 |
| `tools/test/e2e/smoke.e2e.js` | new — SMK-01…SMK-13 | TEST-DESIGNER (step 5) | — |
| `tools/test/e2e-kit.test.js` | new — E2K-01…E2K-63 (52 tests as built; 40 were planned; E2K-62 and E2K-63 came with ISS-0103) | TEST-DESIGNER (step 5) | — |
| `tools/test/fixtures/e2e/specs/*.e2e.js` | new — the runner fixtures of section 11.3 (plain files; they hold the options that the tests and the greps forbid, and lie outside every scanned folder) | TEST-DESIGNER (step 5) | — |
| `tools/test/fixtures/e2e/tap/*.txt` | new — captured TAP texts for E2K-34, **normalized so that they hold no absolute path** (section 11.3, remark F11) | TEST-DESIGNER (step 5) | — |
| The six guard tests | replaced by section 12 | TEST-DESIGNER (step 5) | — |

No file is written by two roles. **Words in comments (remark F16).** The two sandbox flags (`--no-sandbox`, `--disable-setuid-sandbox`) and the skip words (`.skip(`, `.todo(`, `|| true`, `eslint-disable`, and the options `{ skip`, `{ todo`) do not stand in **any** file under `tools/test/e2e`, the file `tools/test/e2e-kit.test.js` and the stand-in, **comments included** (E2K-25, E2K-50 and the greps of criteria 10(d) and 11 read the comments too). A comment that must say it writes "the sandbox stays on" without the flag. The kit modules are written by BACKEND-DEV only; TEST-DESIGNER reads them and reports a divergence. `tools/src/`, `.githooks/pre-push`, `package-lock.json`, `decisions/`, other blocks of `docs/requirements.yaml` and `.github/` (branch A) are not changed. `eslint.config.js` is not changed (О2).

Order: the shared contract first — `errors.js` (the codes) and the shapes of section 4 — then the leaves (`find-chrome`, `guards`, `cdp`, `console`), then the process layer (`cleanup`, `browser`), then `page`, then the runner, last the script (the only step that turns old tests red).

Module dependencies (no cycles): `errors` ← `find-chrome`, `guards`, `cdp`, `cleanup`, `console`; `guards` ← `cleanup` (`makeTempDir`) and `page` (screenshot); `cdp`, `cleanup`, `find-chrome`, `console` ← `browser`; `browser`, `guards` ← `page`; `page`, `browser` ← `index`; `browser`, `find-chrome`, `cleanup`, `errors` ← `runner`.

---

## 4. Interfaces

Signatures are written as `name(args) → result`. `?` = optional. All functions of the kit throw `E2eError` (section 4.1) for every failure they define; a bug of the caller (a function instead of a string) throws `E2eError` with code `USAGE`. No function of the kit prints.

### 4.1 `errors.js`

`class E2eError extends Error` with fields `code: string` (from the table), `details: object` (default `{}`; never holds the environment), `cause?`.

| Code | Thrown by | When | Message (the parts that tests compare; `<…>` = value) |
|---|---|---|---|
| `CHROME_NOT_FOUND` | `findChrome` | the lookup of 4.2 fails | see 4.2 — always holds `SAI_CHROME` |
| `START_FAILED` | `launchBrowser` | `spawn` raised an error (`ENOENT`, `EACCES`) | `could not start "<path>": <error code>` |
| `START_EXITED` | `launchBrowser` | the process ended before the port line | `the browser exited before it was ready (exit code <n>\|signal <s>). Last line of its stderr: "<line>"`; if one of the last 20 stderr lines matches `/sandbox/i`, the sentence ` Chrome refused to start with its sandbox; the kit never turns the sandbox off (decisions/0107), so the machine has to be fixed.` is appended. `details = { pid, profileDir, exitCode, signal, stderrTail }` |
| `START_TIMEOUT` | `launchBrowser` | no port line in `startTimeoutMs` | `the browser did not start in <ms> ms (no "DevTools listening" line on its stderr); it was killed`. `details = { pid, profileDir }` |
| `BROWSER_CLOSED` | `Connection.send` and everything above it | the socket closed, the process ended, or a call is made after that | pending: `the browser closed during <method> (<exit info>)`; later calls: `the browser is closed (<exit info>)`; `<exit info>` = `exit code <n>`, `signal <s>`, or `connection lost` |
| `PROTOCOL_ERROR` | `Connection.send` | the answer has an `error` object | `<method>: <message of the browser> (code <n>)` |
| `PROTOCOL_BAD_ANSWER` | `Connection` | a text frame is not valid JSON | every pending call is rejected, each with `<its method>: the answer of the browser is not valid JSON; the connection was closed`; then the socket is closed and later calls reject as `BROWSER_CLOSED` |
| `CALL_TIMEOUT` | `Connection.send` | no answer in `callTimeoutMs` | `<method>: no answer in <ms> ms` |
| `URL_REFUSED` | `assertLoopbackUrl`, `Page.goto` | section 4.3 | `refused to open "<url cut at 200 characters>": only http://127.0.0.1:<port>/… is allowed` |
| `PATH_REFUSED` | `assertShotPath`, `makeTempDir`, `assertOutsideRepo`, `assertUnderTempRoot` | section 4.3 | `refused path "<path>": <not absolute \| not a .png file \| inside the repository \| outside the temporary root>` |
| `NAVIGATION_FAILED` | `Page.goto` | `Page.navigate` returned `errorText`, or no load event in `timeoutMs` | `<url>: <errorText>` or `<url>: no load event in <ms> ms` |
| `PAGE_EXCEPTION` | `Page.evaluate` | `exceptionDetails` present | `the page script threw: <first line of the description>` |
| `WAIT_TIMEOUT` | `Page.waitFor` | condition false until the limit | `waited <ms> ms for: <description or the first 120 characters of the source>; last value: <JSON, cut at 200>` |
| `ELEMENT_NOT_FOUND`, `ELEMENT_NOT_VISIBLE`, `CLICK_INTERCEPTED` | `Page.click`, `Page.type` | selector matches nothing; zero size; the point is covered | `…"<selector>"…`; for the last one also `covered by <id or tag name of the top element>` |
| `VIEWPORT_MISMATCH`, `SCHEME_MISMATCH` | `Page.setViewport`, `Page.setColorScheme` | the page reports other numbers/value after the command | both numbers, both values |
| `CONSOLE_ENTRIES` | `Browser.verifyConsole`, `withBrowser` | unexpected entries or unmet declarations | `<n> unexpected console entries: <kind: text (url)> … ; <m> declared entries did not happen: <kind: text> …` (one line per entry) |
| `CLEANUP_FAILED` | `Browser.close` | the group still has a process after `SIGKILL` + 3 s, or the folder cannot be removed after the retries | `could not clean up: pid <pid>, folder "<path>": <reason>` |
| `USAGE` | any | wrong argument type (for example a function given as page code), a call on a closed browser or page, `removeTempDir` of a folder the kit did not make | `<function>: <what is wrong>` |
| `NO_SPECS`, `SELECTION_UNKNOWN`, `SELECTION_DUPLICATE`, `SPEC_FAILED`, `SPEC_NO_TESTS`, `SPEC_SKIPPED`, `SPEC_TIMEOUT`, `INTERRUPTED` | `runner.js` | section 6 | section 6 |

Messages never hold an environment variable value except `SAI_CHROME` (a path chosen by the user, not a secret).

### 4.2 `find-chrome.js` (criterion 2)

- `CHROME_PLACES` — frozen array of exactly five strings, in this order: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser`. The first is a full path, the other four are names looked up in `PATH`.
- `findChrome({ env?, exists? }) → { path: string, from: "SAI_CHROME" \| "place", place?: string }`
  - `env` — default `process.env`; `exists(absolutePath) → boolean` — default: a regular file with execute permission (`fs.statSync().isFile()` and `fs.accessSync(…, X_OK)`). Both injected in the tests (no Chrome needed).
  - Rule 1: `Object.hasOwn(env, "SAI_CHROME")` and the value is not `undefined` → the variable is **set**. It must be a non-empty absolute path to an existing executable file, else `CHROME_NOT_FOUND`. **No other place is tried** (`exists` is not called for any place).
  - Rule 2: unset → the five places in order; for a name, each directory of `env.PATH` (split by the platform delimiter; **empty entries are skipped**, the current folder is never searched) is tried in order; the first existing place wins.
  - Rule 3: nothing found → `CHROME_NOT_FOUND`.
  - Messages (all hold the word `SAI_CHROME`):
    - set, missing: `SAI_CHROME is set to "<value>" but there is no executable file there. The other places are not tried when SAI_CHROME is set. Give the full path of a Chrome or Chromium program, or unset SAI_CHROME.`
    - set, empty: `SAI_CHROME is set but empty. …` (same ending)
    - set, relative: `SAI_CHROME must be a full path, got "<value>". …`
    - unset, nothing: `no Chrome or Chromium found. Set SAI_CHROME to the full path of one, or install one in a place that is searched. Places tried (5):` then five lines, each `  <n>) <place>` with ` (in PATH)` after a name. The number in the text is `CHROME_PLACES.length`.
  - Windows places are not in the list (REQ text); `SAI_CHROME` works there.

### 4.3 `guards.js` (criterion 5; protection stands inside the action)

- `repoRoot() → string` — the real path of the root of Sai, computed from `import.meta.url` of this file (four folders up from the folder `tools/test/e2e/kit`), not from the current folder.
- `tempRoot() → string` — `fs.realpathSync(os.tmpdir())` (honours `TMPDIR`; macOS `/var` vs `/private/var` is resolved).
- `assertLoopbackUrl(input) → string` — returns the **normalized** `href`, throws `URL_REFUSED`. Accepted only if all hold: `typeof input === "string"`; `new URL(input)` parses; `protocol === "http:"`; `hostname === "127.0.0.1"` (after the parser's normalization, so `http://127.1:5/` is accepted and becomes `http://127.0.0.1:5/`, and `http://127.0.0.1.example.com/`, `http://127.0.0.1@example.com/`, `http://localhost:5/`, `http://[::1]:5/`, `http://10.0.0.1/` are refused); `username === ""` and `password === ""`; `port` is a number from 1 to 65535 (an empty port, so the default 80, is refused: a stand always has its own port). Everything else — `https:`, `file:`, `data:`, `javascript:`, `about:`, `chrome:`, empty, non-string — is refused. The callers navigate to the **returned** `href`, never to the raw string.
- `assertOutsideRepo(path)` / `assertUnderTempRoot(path)` / `assertShotPath(path) → string` — `PATH_REFUSED`. A path is resolved by `realpath` of its deepest existing ancestor plus the rest (so a symbolic link inside the temporary root that points into the repository is refused). `assertShotPath`: absolute, extension `.png`, not inside `repoRoot()`, inside `tempRoot()`; the repository check comes first (a clone made under the temporary root is still "inside the repository"). `assertUnderTempRoot` is exported for REQ-106 (its starter refuses a state folder outside the temporary root).

### 4.4 `cleanup.js` (criteria 3, 11)

- `makeTempDir(label) → string` — creates `<tempRoot>/sai-e2e-<label>-XXXXXX` with `fs.mkdtempSync`; refuses (`PATH_REFUSED`) **before creating anything** if `tempRoot()` is inside `repoRoot()`; registers the folder; `label` must match `^[a-z0-9-]{1,24}$`.
- `removeTempDir(dir)` — removes a registered folder (`rmSync` recursive, force, `maxRetries: 10`, `retryDelay: 50`) and unregisters it; refuses a folder that was not made by `makeTempDir` (`USAGE`).
- `registerGroup(pgid, profileDir?)` / `unregisterGroup(pgid)` — the live process groups: a Chrome group (with its profile folder) or, for the runner, the group of a running spec file (`profileDir` omitted).
- `cleanupAllSync()` — for every registered group: `process.kill(-pgid, "SIGKILL")` (an `ESRCH` is ignored); then removes every registered folder; never throws.
- `addSignalHook(hook) → remove` — `hook(signal) → Promise | void`. Hooks run **before** the clean-up of a signal and are awaited (F31; used by the runner to stop its spec process group in an orderly way). `remove()` is idempotent and takes the hook out of the list at once; a removed hook is never called. The caller that added a hook removes it when its work ends, in a `finally` (the runner: section 6, step 1) — a process that calls `runAll` six times (E2K-32) must hold no stale hook.
- `installHandlers({ hookLimitMs = 10000 }?)` — idempotent, called by `launchBrowser`, `makeTempDir` and `runAll`; the option is read by the **first call in the process only**. `process.on("exit")` → `cleanupAllSync()`. `SIGINT`, `SIGTERM`, `SIGHUP` → the handler keeps the number of the **first** signal and works in this order, every step inside a `try` so that a failure of one never skips the next: (1) call **all** registered hooks at once, in the order they were added, with the signal name; (2) wait for all of them together (`Promise.allSettled` semantics) but at most `hookLimitMs` in total (one limit for the whole wait; there is no separate limit per hook); (3) a hook that throws or rejects is caught and its error is kept (`hookErrors()`), it is not rethrown, no message is printed by the kit, the other hooks and the next steps go on; (4) `cleanupAllSync()`; (5) `process.exit(128 + the number of the first signal)` (130, 143, 129). **A second (or later) signal while the wait runs** skips the wait: `cleanupAllSync()` and `process.exit` at once, with the code of the **first** signal. A signal that arrives after step (4) began is ignored. F21.
- `liveRegistrations() → { groups: number[], dirs: string[], hooks: number }` — for the tests (E2K-32, E2K-33, E2K-51); `hookErrors() → Error[]` — for the test E2K-39.

### 4.5 `cdp.js` (criteria 3, 4)

`connect(wsUrl, { callTimeoutMs = 20000 }?) → Promise<Connection>`; rejects `BROWSER_CLOSED` (`connection lost`) if the socket errors or closes before opening.

`Connection`:

| Member | Contract |
|---|---|
| `send(method, params?, sessionId?) → Promise<result>` | the request `{id, method, params, sessionId}`; ids grow by one; at most one answer per id; `error` → `PROTOCOL_ERROR`; no answer in `callTimeoutMs` → `CALL_TIMEOUT` (the entry is removed); a call on a closed connection rejects at once with `BROWSER_CLOSED` |
| `subscribe(handler(message)) → unsubscribe` | gets every message without an `id` (events) with `method`, `params`, `sessionId?`; a throwing handler is caught and stored (`internalErrors`), it never stops the reading |
| `fail(error)` | rejects every pending call with `error` and marks the connection closed (called by `Browser` when the process exits) |
| `close()` | closes the socket (no throw if closed) |
| `isClosed() → boolean`, `internalErrors: Error[]` | — |

The parse of an incoming text frame is inside a guard: a frame that is not JSON → `PROTOCOL_BAD_ANSWER` as in 4.1 (F24). A binary frame is treated as a bad answer too.

### 4.6 `browser.js` (criteria 2–4, 6)

`launchBrowser(options?) → Promise<Browser>`; `options`:

| Option | Default | Meaning |
|---|---|---|
| `env` | `process.env` | passed to `findChrome` **and** as the environment of the Chrome process (the tests give the stand-in its mode through it) |
| `startTimeoutMs` | 20000 | no port line in this time → `START_TIMEOUT`, the process group is killed |
| `callTimeoutMs` | 20000 | for the connection |
| `closeGraceMs` | 3000 | time between `SIGTERM` and `SIGKILL` of the group; also the wait for the group to disappear after `SIGKILL` |

Steps of `launchBrowser` (all inside one function; a failure at any step runs the clean-up of the steps before it):

1. `findChrome({ env })`.
2. `makeTempDir("profile")`.
3. `spawn(path, args, { detached: true, stdio: ["ignore", "ignore", "pipe"], env })`; register the group at once (`registerGroup(pid, profileDir)`); `installHandlers()`. `args` (a frozen list, exposed as `browser.args`): `--headless=new`, `--remote-debugging-port=0`, `--user-data-dir=<profileDir>`, `--no-first-run`, `--disable-gpu`, `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`, `about:blank`. **No other flag; never `--no-sandbox` or `--disable-setuid-sandbox`** (criterion 10(d)), and neither flag is written in a comment of `browser.js` or of any other file under `tools/test/e2e` (section 3, "Words in comments").
4. Read stderr until the regular expression `DevTools listening on (ws://127\.0\.0\.1:\d+/devtools/browser/\S+)` matches the collected text (the buffer is cut to the last 64 KB). After the match, **the pipe keeps being read** and only the last 4 KB and the last non-empty line are kept (a full pipe would block Chrome: AP-078; mode `noisy` of the stand-in). Events: `error` → `START_FAILED`; `exit` before the match → `START_EXITED`; the timer → `START_TIMEOUT`.
5. `connect(ws)`; `Browser.getVersion` → `browser.product`.
6. On the `exit` event of the process after the start: `connection.fail(BROWSER_CLOSED with the exit info and the last stderr line)`.

*As built 2026-11-16 (DOC-UPDATER, step 10 of run `E2E107-20261116-01`; the list of step 3 above is not rewritten).* The frozen list has two arguments more than step 3 names: `--no-proxy-server` between `--disable-gpu` and the resolver rule (section 21, item 3) and, since REQ-107, `--use-mock-keychain` right after `--no-first-run` (`decisions/0113` О1 as corrected by О25: Chromium's switch for a mock keychain on macOS, for tests; measured on macOS that with it Chrome answers its first navigation under a home folder below the temporary root, and without it it does not). `E2K-25` compares the exact list. The rule of criterion 10 (d) — never `--no-sandbox` or `--disable-setuid-sandbox` — is unchanged. Details: `docs/design/REQ-107-e2e-team-web.md`, sections 4.5 and 22.

`Browser`:

| Member | Contract |
|---|---|
| `pid`, `profileDir`, `product`, `args` | read only |
| `newPage() → Promise<Page>` | `Target.createTarget({url:"about:blank"})`, `Target.attachToTarget({targetId, flatten:true})`, enables `Page`, `Runtime`, `Log`, `Network`; applies the defaults **without checking**: window 1470×784 (`mobile:false`, scale 1), colour scheme `light` (F15); registers the page's entries in the browser list |
| `send(method, params?) → Promise<result>` | a raw call on the browser endpoint (for the tests of the faults; not used by the specs) |
| `expect(decl)`, `expectOncePerStart(decl)` | declarations (4.7); `USAGE` if the browser is closed |
| `consoleEntries() → Entry[]`, `unexpectedEntries() → Entry[]` | all entries of all pages; the entries not claimed by a declaration |
| `verifyConsole({ settleMs = 300 }?) → Promise<void>` | waits `settleMs` (F19: the favicon line comes 5 ms after load), then `evaluateConsole`; throws `CONSOLE_ENTRIES` if there is an unexpected entry or an unmet declaration |
| `close() → Promise<void>` | idempotent (the same promise); closes the socket, `SIGTERM` to the **group**, waits until `process.kill(-pgid, 0)` gives `ESRCH` for at most `closeGraceMs`, then `SIGKILL` to the group and waits at most 3000 ms more (`CLEANUP_FAILED` if the group is still alive), removes the profile folder (`removeTempDir`), unregisters the group |
| `isClosed()` | — |

`withBrowser(options?, body) → Promise<value of body>` (`options` may be left out: `withBrowser(body)`): `launchBrowser`; `await body(browser)`; if the body returned, `verifyConsole()`; always `close()` in a `finally`. Error rules: a body error is rethrown **as it is** (the same object); if `close()` also fails, its error is attached as `error.cleanupError` and not thrown over the body error; if the body succeeded and `verifyConsole` failed, the console error is thrown after `close()`; if only `close()` failed, `CLEANUP_FAILED` is thrown. A body that leaves a request of the page pending, or a page that never finishes loading, does not delay `close()` (the group is killed).

### 4.7 `console.js` — the pure matcher (criterion 6)

`Entry = { kind: "console" \| "exception" \| "rejection" \| "browser-log", text: string, url?: string, source?: string, page: number, at: number }`.

| Source event | Entry |
|---|---|
| `Runtime.consoleAPICalled` with `type` `error` or `assert` | `kind:"console"`, text = the arguments (`value` or `description`) joined by one space |
| `Runtime.exceptionThrown`, `exceptionDetails.text` not `Uncaught (in promise)` | `kind:"exception"`, text = first line of `exception.description`, else `exceptionDetails.text` |
| `Runtime.exceptionThrown`, text `Uncaught (in promise)` | `kind:"rejection"`, text = first line of `exception.description` |
| `Log.entryAdded` with `level` `error` | `kind:"browser-log"`, `text`, `url`, `source` |

Warnings, info and debug are not entries. Text is cut at 500 characters.

`Declaration = { kind, text, path? }` — `text` is compared **exactly** (not "contains", not a pattern); `path`, if given, must equal the `pathname` of the entry's `url`.

- `expect(decl)` → the declaration needs **at least one** matching entry and has no upper limit.
- `expectOncePerStart(decl)` → at least one **and at most one** per browser start; further matching entries become unexpected.
- A declaration belongs to the browser it was made on; it is checked once, by `verifyConsole`.
- `evaluateConsole(entries, declarations) → { unexpected: Entry[], unmet: Declaration[] }`: entries are taken in order; each entry is claimed by the **first declaration, in the order of declaring, that matches it** and still has room; an entry claimed by none is unexpected; a declaration with no claimed entry is unmet. (So a specific declaration with `path` is declared before a general one with the same text.)

### 4.8 `page.js` (criteria 3, 5, 6; the API the three page requirements need)

Every method rejects with `BROWSER_CLOSED` if the browser is gone.

| Method | Contract |
|---|---|
| `goto(url, { timeoutMs = 15000 }?) → Promise<{ url, status }>` | `href = assertLoopbackUrl(url)` **first, before any protocol call**; registers the load listener, then `Page.navigate(href)`; `errorText` → `NAVIGATION_FAILED`; waits for `Page.loadEventFired`; `status` = the status of the main `Document` response with the `loaderId` of the navigation (`null` if none was seen) |
| `reload()` | `Page.reload`, waits for the load event |
| `evaluate(source, args?) → Promise<value>` | `source` must be a **string** (`USAGE` otherwise). Without `args` it is an expression; with `args` (a JSON-serializable array) it must be a function expression and is called with them. `returnByValue`, `awaitPromise`; an exception → `PAGE_EXCEPTION` |
| `waitFor(source, { args?, timeoutMs = 5000, pollMs = 50, description? }?) → Promise<value>` | evaluates every `pollMs` until the value is truthy; returns it; `WAIT_TIMEOUT` otherwise |
| `click(selector)` | in the page: scroll the element to the centre, read its rectangle, ask `elementFromPoint` at the centre: not found → `ELEMENT_NOT_FOUND`, zero size → `ELEMENT_NOT_VISIBLE`, the top element is not the target or inside it → `CLICK_INTERCEPTED`; then `Input.dispatchMouseEvent` pressed and released at that point (F16) |
| `type(selector, text)` | focuses the element (same errors as `click`, no hit test), then `Input.insertText` |
| `press(key, { shift?, ctrl?, alt? }?)` | `key` ∈ `Tab`, `Enter`, `Space`, `Escape`, `Backspace`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`; sends `keyDown` then `keyUp` with `key`, `code`, `windowsVirtualKeyCode` (F16); modifiers as bits 1 alt, 2 ctrl, 8 shift |
| `setViewport(width, height) → Promise<{ innerWidth, innerHeight }>` | `Emulation.setDeviceMetricsOverride({width,height,deviceScaleFactor:1,mobile:false})`, then **reads** the page numbers; a difference → `VIEWPORT_MISMATCH` |
| `setColorScheme("light" \| "dark") → Promise<boolean>` | `Emulation.setEmulatedMedia`; reads `matchMedia('(prefers-color-scheme: dark)').matches`; a wrong value → `SCHEME_MISMATCH`; returns that value |
| `horizontalOverflow() → Promise<{ overflowing, scrollWidth, innerWidth }>` | `scrollWidth` = the larger of `documentElement.scrollWidth` and `body.scrollWidth`; `overflowing = scrollWidth > innerWidth` (strictly) |
| `consoleEntries()`, `unexpectedEntries()` | the entries of this page |
| `network() → NetworkRecord[]`, `responseBody(requestId) → Promise<string>`, `clearNetwork()` | `NetworkRecord = { requestId, method, url, status\|null, type, requestBody\|null, finished, failed\|null }` (F17) |
| `screenshot(path) → Promise<{ path, bytes }>` | `assertShotPath(path)` first; `Page.captureScreenshot` (PNG); writes the file; the first 8 bytes must be the PNG signature, else `PROTOCOL_ERROR` (`screenshot is not a PNG`) |
| `close()` | `Target.closeTarget` |

Examples in this document use invented data: a page titled `Demo`, a button `Go` that sets the title `Done`, a block `#wide` of 700 px.

### 4.9 `index.js`

Exports for the specs: `withBrowser`, `launchBrowser`, `findChrome`, `CHROME_PLACES`, `E2eError`, `assertLoopbackUrl`, `assertUnderTempRoot`, `assertOutsideRepo`, `makeTempDir`, `removeTempDir`, `tempRoot`, `repoRoot`. The runner and the tests import `runner.js`, `console.js`, `cleanup.js` directly.

---

## 5. The stand-in program `tools/test/fixtures/e2e/fake-chrome.js`

Mode 0755, first line `#!/usr/bin/env node`, ES module (the nearest `package.json` has `"type": "module"`). Node built-ins only. Reads two variables: `SAI_FAKE_CHROME_MODE` (default `ok`) and `SAI_FAKE_CHROME_LOG` (a file; if set, every event is appended as one JSON line).

- Log events: `{event:"start", pid, argv}` at the very start (so the test sees the exact argument list); `{event:"call", method, params, sessionId}` for every protocol call.
- With the argument `--version` it prints `Fake Chrome 1.2.3` and exits 0.
- It never reads stdin (AP-078: nothing it must read is left unread). It accepts the protocol on an HTTP server on 127.0.0.1 port 0 (`upgrade` → the accept key from SHA-1 of the key and the fixed GUID; masked client frames are read, unmasked text frames written), and after the server listens writes to stderr an empty line and `DevTools listening on ws://127.0.0.1:<port>/devtools/browser/fake`.
- Answers (mode `ok`): `Browser.getVersion` → `{product:"FakeChrome/1.2.3"}`; `Target.createTarget` → `{targetId}`; `Target.attachToTarget` → `{sessionId}`; `Page.navigate` → `{frameId, loaderId}` followed by the event `Page.loadEventFired` on the same session; `Page.captureScreenshot` → `{data}` with a base64 1×1 PNG; `Runtime.evaluate` → `{result:{type:"undefined"}}`; `Target.closeTarget` → `{success:true}`; any other method → `{}`.

| Mode | Behaviour | Used by |
|---|---|---|
| `ok` | as above | E2K-10…E2K-25, E2K-32 |
| `exit-early` | writes `first line` and `fake: cannot start, boom` to stderr, exits with code 3 | E2K-10 |
| `hang` | prints nothing, stays alive; `SIGTERM` ends it | E2K-11 |
| `hang-ignore-term` | like `hang` but ignores `SIGTERM` (only `SIGKILL` ends it) | E2K-17 |
| `close-on-connect` | reports the port, destroys every socket at once | E2K-12 |
| `port-then-close` | answers nothing, destroys the socket on the first call | E2K-12 |
| `no-answer` | accepts, logs calls, never answers | E2K-12, E2K-15 |
| `bad-json` | answers every call with the text `this is not json` | E2K-13 |
| `error-object` | answers every call with `{id, error:{code:-32000, message:"boom from fake"}}` | E2K-14 |
| `noisy` | after the port line and before the first answer writes 1 MB to stderr in 4 KB chunks with `fs.writeSync(2, chunk)`; **not** `process.stderr.write`, which buffers inside the child and never blocks, so a client that stops reading would not be caught (F32, remark F9) | E2K-16 |
| `with-child` | starts a sleeping child process of its own (same group) and logs its pid | E2K-17 |

TEST-DESIGNER may add modes in the same file; the modes above are the contract.

---

## 6. The command

`tools/package.json`, `scripts` (in this key order): …, `test` (unchanged: `node --test "test/**/*.test.js"`), **`e2e`**: `node test/e2e/run.js`, `check`: `npm run format:check && npm run lint && npm run traces && npm run handoffs-check && npm run test && npm run e2e` (exactly six steps, no `||`). No other key changes.

`tools/test/e2e/run.js` is the thin main; `kit/runner.js` holds the functions (all injectable for the tests): `listSpecs(dir) → string[]` (names without `.e2e.js`, alphabetical; only files matching `^[a-z0-9][a-z0-9-]*\.e2e\.js$`), `parseSelection(argv, available) → { selection, names }`, `analyseTap(text, specPath) → { tests, pass, fail, cancelled, skipped, todo, noTests }`, `formatRecord({ command, selection, exit, durationMs }) → string`, `specEnv(env) → object` (a copy of `env` without the key `NODE_TEST_CONTEXT`, and nothing else removed or added; pure), `specArgument(specDir, name) → string` (section 6, step 5), `runAll({ specDir, argv, env = process.env, now, out, err, spawnSpec, launch = launchBrowser, fileTimeoutMs = 120000, killGraceMs = 5000 }) → Promise<exitCode>`; `spawnSpec({ args, cwd, env, detached }) → child` is injectable: the runner **always passes `detached: true`** in that one argument object (so a recorder sees it), and the default implementation is `child_process.spawn(process.execPath, args, { cwd, env, detached, stdio: ["ignore", "pipe", "inherit"] })`. The runner uses only this of the child: `pid` (a number, or not a number when the start failed), `stdout` (a readable stream), and the events `close` (`code`, `signal`) and `error`; a fake child of the tests has exactly these members (an `EventEmitter` with `pid`, `stdout`; E2K-37). `launch({ env }) → Promise<Browser>` is the option of the preflight (flow, step 4); `specDir` must lie inside the `tools/` folder that holds `runner.js` (else `USAGE`), so the argument of a spec never starts with `..`.

Flow of `runAll`:

1. Start the clock (`performance.now()`); `installHandlers()` of `cleanup.js` and, as the very next statement, `remove = addSignalHook(onSignal)` — so the runner's signals and exit are handled **from its first statement**, before `listSpecs` and before the preflight (remark F12). `try { … } finally { remove(); }` wraps all the following steps, so the hook is taken out on every path (success, error, return after a signal); `liveRegistrations().hooks` is 0 after each `runAll` (E2K-32). The only window without the hook is the loading of the modules before `runAll` is called (~100 ms, nothing runs then, the default action of the signal applies: the process ends by the signal, no record line). `onSignal(signal)` is the signal paragraph below.
2. `listSpecs`; none → `NO_SPECS` (`no spec files *.e2e.js in tools/test/e2e`).
3. `parseSelection`: no argument → `selection = "all"`, `names` = all, alphabetical; arguments → `names` in the order given, `selection` = names joined by `,`. An unknown name → `SELECTION_UNKNOWN` (`no spec file "<name>"; the spec files are: <a, b, c>`); a name given twice → `SELECTION_DUPLICATE`. A name is compared by exact string with the list (so `../x`, `smoke.e2e.js`, an empty string and path parts are unknown).
4. Preflight: `browser = await launch({ env })`, where `launch` is the option of `runAll` (default `launchBrowser`) and `env` is the `env` option of `runAll` **as it is** (the runner's environment, not the `specEnv` copy; `SAI_CHROME` and `PATH` reach `findChrome` through it); print `e2e: browser=<browser.product>`; `close()`. The runner never calls `launchBrowser` by another way. E2K-32 injects a `launch` that calls `launchBrowser` with `SAI_CHROME` pointing at the stand-in (so no real Chrome is started) and asserts the printed line `e2e: browser=FakeChrome/1.2.3`. Any failure here is an error with its own code (`CHROME_NOT_FOUND`, `START_*`); nothing of the specs has run.
5. For each name in order: print `e2e: file=<name>`; then
   - **The argument.** `specArg = specArgument(specDir, name)` = the path of the spec file **relative to the `tools/` folder, with `/` separators and no leading `./`** (for the real tree `test/e2e/<name>.e2e.js`). It is never written from the root of Sai (`tools/test/e2e/…` gives "Could not find", F30). Node prints a file that holds no test as `ok 1 - <that same string>` (F30), and the `noTests` rule compares with `specArg` exactly (both sides with `\` turned into `/`; Windows is not measured).
   - **The environment.** `env = specEnv(<env of the runner>)`: the runner's environment **without `NODE_TEST_CONTEXT`**, nothing else changed (`SAI_CHROME`, `PATH`, `TMPDIR` and the rest pass through). Without this, a runner started inside `npm test` (E2K-32…E2K-38) or inside any `node:test` test gets an empty stdout from the nested run (F29). A runner started by `npm run e2e` does not have the variable; the rule is the same there.
   - **The process.** `spawnSpec({ args: ["--test", "--test-reporter=tap", specArg], cwd: <tools folder>, env, detached: true })`, in its **own process group**, stdout piped and forwarded unchanged to `out` (and collected), stderr inherited. If the child has no numeric `pid` or emits `error`: `SPEC_FAILED` (`<name>.e2e.js could not be started: <reason>`), nothing registered, the run stops. Otherwise the group is registered with `registerGroup(pid)` in the same statement that receives the child, and unregistered when the group is gone (the process ended normally, or *Stop* saw `ESRCH`), so an `exit` of the runner kills a live one by `SIGKILL` and never signals a gone one (a pid may be reused).
   - **Stopping it.** A watchdog of `fileTimeoutMs` (120000) → stop (below) → `SPEC_TIMEOUT`. The signal hook `onSignal` of the runner does the same stop when the runner gets `SIGINT`/`SIGTERM`/`SIGHUP`, and the exit code then is 130/143/129 (F31). *Stop* = `SIGTERM` to the **group**; wait until `process.kill(-pgid, 0)` gives `ESRCH` for at most `killGraceMs` (5000); then `SIGKILL` to the group and wait for it (at most 3000 ms more); at the end `unregisterGroup(pgid)`. A stop takes at most 8 s, which is inside the 10 s `hookLimitMs`. (`node --test` forwards `SIGTERM` to its file child and the kit handlers of that child kill its Chrome; the group `SIGKILL` also reaches the file child, which a `SIGKILL` of the leader alone would not, F31.)
   - **After it ends.** Exit code ≠ 0 → `SPEC_FAILED` (`<name>.e2e.js failed (exit code <n>)`); then `analyseTap(text, specArg)`: `noTests` → `SPEC_NO_TESTS`; `skipped > 0` or `todo > 0` → `SPEC_SKIPPED`. The first failing file stops the run.
6. Print the record line as the **last stdout line**, also after a failure: `e2e: command=<text> selection=<all\|names> exit=<0\|1> duration_ms=<integer>`. `<text>` is `npm run e2e` followed by ` -- <names given>` when names were given. Error lines go to stderr as `e2e: error=<CODE>: <message>`, never a stack (the message of a non-`E2eError` is printed with `error=INTERNAL` and only its first line).

**The signal paragraph (`onSignal`, remark F12).** `onSignal(signal)` is what the hook does, and it does it **at whatever moment of `runAll` the signal comes** (while `listSpecs` or `parseSelection` run they are synchronous, so the hook runs just before or just after them; during the preflight, which may take up to 20 s; during a spec; between two specs): (1) if no record line was printed yet, **first** write `e2e: error=INTERRUPTED: <signal>` to `err` and the record line (`exit=1`, the clock read now) to `out`, both synchronously, and set the flag `interrupted` (so even a second signal that cuts the wait later finds them already written; a signal that comes after the normal end has printed the record line prints nothing a second time); (2) stop the spec group if one is running (*Stop* above); (3) return. A browser of the preflight is a registered group of `launchBrowser`, so it is killed by the clean-up that follows the hooks (the hook does not need to close it). After `interrupted` is set the main flow of `runAll` prints nothing more (no `SPEC_FAILED` for the file that was stopped, no second record line) and returns 1; `run.js` then does not end the process itself, the handler of `cleanup.js` ends it with `128 + the number of the first signal` (4.4). A second signal while the stop still waits skips the wait (4.4): the group is then killed by the registry (`SIGKILL`) and the exit code is still the one of the first signal.

Exit codes: `0` all selected files passed; `1` anything else (a usage error, a missing Chrome, a failed/hung/empty file); after a signal to the runner itself the process ends with `128 + signal number` of the first signal (130, 143, 129), after it has printed `e2e: error=INTERRUPTED: <signal>` to stderr and the record line with `exit=1`. The record line is printed in all cases. Lines printed by the runner, in order: `e2e: browser=…` (once), `e2e: file=…` (one per file), the TAP of each file, the record.

`analyseTap(text, specArg)`: counts come from the `# tests`, `# pass`, `# fail`, `# cancelled`, `# skipped`, `# todo` lines (a missing line counts 0); the top-level `ok`/`not ok` lines are those that start in column 0. `noTests` is true when `tests` is 0 (also for an empty text: the nested run printed nothing, F29) **or** when `tests` is 1 and the only top-level line is `ok 1 - <specArg>` (F11, F30). It does not read the names of subtests.

Reading of the CI log (for RELEASE-VALIDATOR, criterion 10; remark M2 of the gate): **branch B** = a line `e2e: error=CHROME_NOT_FOUND:` and no `e2e: browser=` line; **branch C** = a line `e2e: error=START_EXITED:`, `e2e: error=START_TIMEOUT:` or `e2e: error=START_FAILED:` (the binary exists, `CHROME_NOT_FOUND` is absent) and no `e2e: browser=` line, as criterion 10 reads it ("the step is red and `e2e: browser=` is absent while the binary exists"). Only `START_EXITED` can hold the word `sandbox` (the sentence of 4.1, added when one of the last 20 stderr lines says so); that word is the clear case. Without it the validator still stops as BLOCKED and puts the quoted stderr line of the message into the question to the owner (a missing library or a hang is not a sandbox decision, but it is not branch A or B either, and the step is never skipped); **branch A** = `e2e: browser=` present and the step green; **any other red** (an earlier step of `check` failed, no `e2e:` line at all; or `SPEC_FAILED`) is a plain FAIL back to the developer role, not branch C. ORCH puts this table into the task of step 9.

---

## 7. Failure paths — what the user sees, what stays

| # | Situation | The user sees | State afterwards |
|---|---|---|---|
| 1 | `SAI_CHROME` set, file missing | exit 1, stderr `e2e: error=CHROME_NOT_FOUND: SAI_CHROME is set to "/no/such/chrome" but …`, stdout last line the record with `exit=1`, no `e2e: browser=`, no stack | no process started, no folder made (the lookup is before the folder); `git status` unchanged |
| 2 | nothing found | same, the five places numbered | same |
| 3 | `chrome` exits at once | `START_EXITED` with its exit code and last stderr line (+ sandbox sentence when the line says so) in ≤5 s | group gone, profile folder removed, registration removed; a second start works |
| 4 | `chrome` hangs before the port line | `START_TIMEOUT` after `startTimeoutMs` | the group killed (`ESRCH` for the pid), folder removed |
| 5 | the browser dies or the socket closes during a call | the call rejects `BROWSER_CLOSED` in ≤5 s (F22: ~120 ms); later calls reject the same way | `close()` still removes the folder; no process left |
| 6 | the browser answers with non-JSON / an error object / nothing | `PROTOCOL_BAD_ANSWER` (all pending calls, each with its method) / `PROTOCOL_ERROR` with the method / `CALL_TIMEOUT` | the connection closed in the first case; the process is not poisoned (a new start works) |
| 7 | a non-loopback URL, a wrong scheme, a user part | `URL_REFUSED` before any protocol call | no `Page.navigate` was sent |
| 8 | a screenshot path in the repository or outside the temporary root | `PATH_REFUSED` before any protocol call | no file written |
| 9 | the temporary root is inside the repository (`TMPDIR` set badly) | `PATH_REFUSED` from `makeTempDir` | nothing created |
| 10 | the body of a test throws | the same error object is rethrown | Chrome stopped, folder removed (`cleanupError` attached if that failed) |
| 11 | unexpected console entry / unmet declaration | `CONSOLE_ENTRIES` listing both | browser closed, folder removed |
| 12 | `SIGINT`/`SIGTERM`/`SIGHUP`/`process.exit`/uncaught throw in the test process | exit code 130/143/129/as given/1 | every registered group killed, folders removed (F21); a hook that throws or never answers does not stop this (row 18) |
| 13 | a spec file hangs | `SPEC_TIMEOUT` after 120 s | the spec process **group** gets `SIGTERM`, after `killGraceMs` (5 s) `SIGKILL`; the file child, which `node --test` runs, is gone too (F31); the handlers of the file child kill its Chrome (on `SIGTERM`) |
| 14 | a spec file with no test / with `skipped` or `todo` | `SPEC_NO_TESTS` / `SPEC_SKIPPED`, exit 1 | — |
| 15 | `nosuch` | `SELECTION_UNKNOWN` listing the existing names, record `exit=1`, no `# pass` line | no browser started |
| 16 | the runner process itself is killed with `SIGKILL` | nothing can run | **Chrome processes stay, and a running spec group keeps running until its file ends (the 120 s watchdog lived in the runner)** (F20, F31): residual risk, О7 (a) |
| 17 | the runner gets `SIGINT`/`SIGTERM`/`SIGHUP` while a spec runs (a job ended by the user or by CI) | stderr `e2e: error=INTERRUPTED: SIGTERM` (once), the record line with `exit=1` (once, last stdout line), process exit 143 (130, 129); no `SPEC_FAILED` line for the stopped file | the signal hook sends `SIGTERM` to the spec group and waits for it (≤ 5 s), then `SIGKILL` to the group, and unregisters the group; the file child ran its handlers, so its Chrome groups and profile folders are gone; no spec process stays (F31); the hook itself is removed when `runAll` ends |
| 18 | the runner gets a signal **before any spec runs** (during the preflight, up to 20 s), or a **second signal** while the first is being handled, or a hook **throws** or **never answers** | the same stderr line and record line as in row 17 (written first, by the hook, whatever the moment); exit code 128 + the number of the **first** signal; a second signal does not change the code and ends the wait at once; a throwing hook changes nothing visible; a hook that never answers delays the exit by `hookLimitMs` (10 s) at most | the preflight browser (a registered group of `launchBrowser`) is killed and its profile folder removed by the clean-up that follows the hooks; a throwing hook is caught and kept (`hookErrors()`), the other hooks and the clean-up still run; no group is signalled twice (a stopped group was unregistered); nothing of the project changes |

---

## 8. Protection in the same operation as the action

| Protection | Where it stands |
|---|---|
| Only `http://127.0.0.1:<port>` is opened | inside `Page.goto`, as its first statement, and the navigation uses the returned `href`; plus the resolver rule in the browser itself (F23) |
| `SAI_CHROME` set → no fallback | inside `findChrome`, one function, one decision |
| The profile folder is outside the repository | inside `makeTempDir`: the temporary root is checked against the repository before the folder is created, in the same call |
| A screenshot goes outside the project | inside `Page.screenshot`, before `Page.captureScreenshot` |
| The sandbox is never turned off | the argument list is built in one place (`launchBrowser` step 3) and is exposed; the test compares every argument (E2K-25) |
| Clean-up | registered **at spawn**, before the first wait; the handlers are installed in the same call; the spec process group of the runner is registered in the call that spawns it (`registerGroup` right after `spawnSpec`), and the runner's own signal hook is installed in step 1 of `runAll`, together with `installHandlers()`, before `listSpecs` and the preflight, and removed in a `finally` (section 6) |
| A parse error cannot crash the process | the parse is inside the `onmessage` handler of the connection |

There is no "check now, act later in another call" in the kit.

---

## 9. Links and the order of work

- Sub-steps follow the module order of section 3; the only coupling between BACKEND-DEV and TEST-DESIGNER is the list of codes (4.1), the argument list (4.6), the record line (6) and the stand-in modes (5).
- REQ-105/106/107 use: `withBrowser`, `Page` (`goto`, `evaluate`, `waitFor`, `click`, `type`, `press`, `setViewport`, `setColorScheme`, `horizontalOverflow`, `consoleEntries`, `network`, `responseBody`, `reload`, `screenshot`), `Browser.expect`/`expectOncePerStart` (the favicon line, the page 404 lines: declared with `path`), `Browser.newPage` (a second tab), `makeTempDir`/`removeTempDir`/`assertUnderTempRoot` (state folders, throwaway `HOME`), and the runner's lines `e2e: browser=` / `e2e: file=` / the record. They need a starter of server processes of their own (О1).
- Languages: not a kit feature (F26).
- Windows sizes: `setViewport`; default 1470×784 per new page.

---

## 10. Criterion → test

The tests are listed in section 11. "RV" = a command that RELEASE-VALIDATOR runs itself (the criterion names it). Every test appears in this table, every criterion has at least one test (Q5).

| Criterion | Element of the design | Test(s) | Also by command |
|---|---|---|---|
| 1 Nothing like it exists, nothing else changes | 3, 6 | E2K-01 (no `remote-debugging-port` in `tools/src`, hits only under `tools/test/`, at least one in `tools/test/e2e/kit`), E2K-02 (imports are `node:` or relative), E2K-03 (`package.json` has no `dependencies`, the four development ones; the root entry of the lock equals them) | RV: the base count 0 / exit 1; `git diff --quiet "$B" -- tools/package-lock.json`; the `node -e` deep-equal of `package.json` without `scripts.e2e` and `scripts.check` |
| 2 Chrome found by a fixed rule; absence fails | 4.2, 6 | E2K-04 (a), E2K-05 (b), E2K-06 (c, exhaustive over the 5 places), E2K-07 (d), E2K-08 (empty, relative, a directory, not executable, empty `PATH` entry), E2K-09 (the command with `SAI_CHROME=/no/such/chrome`) | RV: the command; `pgrep -f '[s]ai-e2e-' \| wc -l` → 0 |
| 3 Start, real protocol, stop, clean-up on failure | 4.4–4.6, 4.8 | SMK-01, SMK-02, SMK-03, SMK-04 (real Chrome); E2K-17 (group kill, `SIGTERM` ignored), E2K-18 (`SIGTERM`, `SIGINT`, `SIGHUP`, `exit`, a throw), E2K-39 (signal hooks: awaited, removed, a limit, a throwing hook, a second signal) | — |
| 4 Faults with the stand-in | 4.5, 4.6, 5 | E2K-10 (a), E2K-11 (b), E2K-12 (c), E2K-13 (d, not JSON), E2K-14 (d, error object), E2K-15 (no answer), E2K-16 (stderr drained); (e) and "a second start works" are asserted inside E2K-10…E2K-14 | — |
| 5 Only this computer; files outside the project | 4.3, 4.6 (arg), 8 | E2K-20 (URL table, pure), E2K-21 (URL table through the stand-in: `Page.navigate` count 0 / 1), E2K-22 (screenshot path table), E2K-23 (temporary root inside the repository), E2K-24 (profile folder and screenshot folder are under the temporary root, not in the repository), SMK-13 (real Chrome cannot reach a foreign address) | — |
| 6 Windows, themes, overflow, console errors | 4.7, 4.8 | SMK-05 (sizes + overflow with positive and negative controls), SMK-06 (themes, default light), SMK-07 (four distinct entries, a clean page, a declared entry, an unmet declaration), SMK-08 (favicon once per start: two loads → one entry; a start with no page fails; a declaration does not pass to another start); E2K-35 (the pure matcher on synthetic entries); E2K-36 (the defaults of a new page recorded by the stand-in: window and explicit light scheme, whatever the machine's default is) | — |
| 7 The command and its record; independence | 6 | E2K-30 (selection table), E2K-31 (record line), E2K-32 (a run with the stand-in and fixture specs: order of `e2e: file=`, one `e2e: browser=`, last line, stop at the first failure), E2K-33 (a hung file, ended by group), E2K-34 (`analyseTap` on captured outputs), E2K-37 (the exact argument, working folder and environment of a spec process), E2K-38 (`SIGTERM`, `SIGINT`, `SIGHUP` to the runner while a spec runs, and `SIGTERM` during the preflight: the spec group and the browsers are gone, one `INTERRUPTED` line, one record line), E2K-39, E2K-40 (`scripts.e2e`, `scripts.test` unchanged) | RV: `npm run -s e2e -- smoke \| tail -n 1`; `-- nosuch`; the loop over `--test-name-pattern`; the reversed order |
| 8 `npm run check` runs it last | 6, 12 | HC-02 (replaced: the six steps), HC-03, HO-54, PK-7b, LP-3, CTL-13 (replaced), E2K-40 | RV: `node -e` on `scripts.check`; `npm run check` on a machine with Chrome; the same with `SAI_CHROME=/no/such/chrome`; the six guard files + `traces-check` → exit 0; mutant "remove `npm run e2e` from `check`" → HC-02 red |
| 9 Time stays inside the limit | 4.8 (nothing waits needlessly), 6 (`duration_ms`) | E2K-41 (`formatRecord`/`runAll` measure `duration_ms` with an injected clock and print an integer; the README section holds the two budgets 30000 and 240000) | RV: `duration_ms` of the record ≤ 30000 for `smoke`, ≤ 240000 for all; the 25-minute job time is read in criterion 10 |
| 10 Chrome exists and starts on the CI runner | 4.6 args, 6 (log reading table) | E2K-25 (the sandbox flags are absent from the list recorded by the stand-in, a pass over every argument; no file under `tools/test/e2e` names them) | RV: the whole procedure of the criterion (temporary branch, `gh run view`, branches A/B/C). **Branch B only**: the replacement table of `repo.test.js` (CI-4, CI-8) is written then, by a new design step (section 12, "Branch B") |
| 11 Clean tree, no traces, no secrets | 3, 4.4, 11 (words rule) | E2K-34 (the committed tap texts and spec fixtures hold no home-folder path, no temporary-root path, no `file:` address, no absolute path: the rules of `traces` run on them), E2K-50 (no `.skip(`, `.todo(`, `\|\| true`, `eslint-disable`, no `{ skip` / `{ todo` option in the scanned files (comments included, remark F16), no secret shape, no `process.env` read outside the named list, no `://` outside the `http://127.0.0.1` forms; its search words are built from parts; no name of another project is checked by `traces`), E2K-51 (every folder and group registered by the test file is gone at the end) | RV: `npm run -s e2e; echo "exit=$?"` → 0; `git status --short` before = after; `ls "$(node -p "require('os').tmpdir()")" \| grep -c '^sai-e2e-'` → 0; `pgrep`; `npm run -s traces \| grep -c -E 'tools/test/e2e\|tools/test/fixtures/e2e'` → 0 |
| 12 The README tells how to run it | 14 | E2K-60 | RV: the `grep -c` commands; `node --test test/repo.test.js test/team-docs.test.js test/traces-readme.test.js test/pixel-office-settings.test.js` → exit 0 |
| 13 The departure from 0023 D2 is on record and in the instructions | 14 | E2K-61 (the paragraph "You need" cut by the `awk`/`sed` of the criterion; the section "Check"; the precondition `decisions/0107…` exists, `Status: **accepted**`, names REQ-104) | RV: the precondition commands; the `shasum` of the REQ-014 and REQ-033 blocks against the tag (remark M3: question О4) |

---

## 11. The tests

Every test is a top-level `test()` (no suites: the independence loop reads top-level `ok N - <name>` lines), its name starts with its id, and the name holds no regular-expression character except hyphen and comma. Every test passes alone. Every test sets an explicit `timeout` (node:test option) so that a hung wait fails instead of hanging the run: 30000 ms in `e2e-kit.test.js`, 20000 ms in `smoke.e2e.js`.

**Forbidden words in the tests (remark F3; AP-077).** The grep of criterion 11 (`\.skip\(|\.todo\(|\|\| true|eslint-disable` over `tools/test/e2e` and `tools/test/e2e-kit.test.js`), the secret grep, the flag grep of criterion 10(d) and E2K-50 forbid words that some tests must name or feed to the runner. One rule settles every place:
- A **fixture that must contain a forbidden word is a plain file** under `tools/test/fixtures/e2e/specs/` or `…/tap/` (11.3). Neither the criterion-11 skip grep nor E2K-50 scans those two folders (the criterion greps name `tools/test/e2e` and the test file; the secret grep does scan the fixtures folder, and the fixtures hold no secret shape). `e2e-kit.test.js` never writes spec text itself.
- A **word that a test must search for or compare with** (E2K-01 `remote-debugging-port`, E2K-25 the two sandbox flags, E2K-50 the tokens `.skip(`, `.todo(`, `|| true`, `eslint-disable`, the options `{ skip` / `{ todo`, the secret shapes) is **assembled from parts at run time** (for example an array of fragments joined by `join("")`), so that no contiguous forbidden string stands in the file; E2K-50 scans its own file, and the file must pass.
- The fixtures-folder exclusion is exact: E2K-50 scans the files named in its row, and asserts that the only files under `tools/test/fixtures/e2e/` that it does not scan are the ones in `specs/` and `tap/`; `fake-chrome.js` is scanned.
- **Comments are text too (remark F16).** The searches read the whole file, so the two sandbox flags and the four skip words (and the options `{ skip` / `{ todo`) are absent from the **comments** of the kit, the runner, the specs, the stand-in and the test file as well. A developer who wants to explain in a comment why the sandbox stays on writes "the sandbox is never turned off (decisions/0107)" and does not write the flag. E2K-25 and E2K-50 turn red on such a comment; so does the grep of criterion 10(d).
- Check of the design text against the criterion grep (done on this document): the four grep tokens occur in no test row of 11.1 or 11.2 except as the **names of E2K-50's search words**, which are assembled from parts; the option words of E2K-32 and E2K-34 live in the fixture files of 11.3.

### 11.1 `tools/test/e2e-kit.test.js` (runs in `npm test`; no real Chrome; the stand-in speaks the protocol)

| Id | What it proves | Criterion |
|---|---|---|
| E2K-01 | the word `remote-debugging-port` (built from parts in the test) occurs in no file of `tools/src`, in at least one file of `tools/test/e2e/kit`, and every hit is under `tools/test/` | 1 |
| E2K-02 | every `import` of the kit, the runner, the specs, the stand-in and this test file is `node:…` or a relative path; no `require(`; no dynamic `import(` of a bare name | 1 |
| E2K-03 | `package.json` has no `dependencies`; `devDependencies` are exactly the four with their versions; `package-lock.json` root `packages[""].devDependencies` equals them | 1 |
| E2K-04 | `SAI_CHROME` = an existing file wins although all five places exist | 2(a) |
| E2K-05 | `SAI_CHROME` = a missing file → `CHROME_NOT_FOUND`; the injected `exists` was **never** called for a place | 2(b) |
| E2K-06 | unset; the test holds **its own literal list** of the five places (an oracle independent of `CHROME_PLACES`): for every k from 1 to 5, with only the places k…5 existing, place k wins (order, exhaustive); each of the five alone is chosen; a name found in the second `PATH` directory is chosen when the first has none | 2(c) |
| E2K-07 | nothing exists: the message holds `SAI_CHROME` and all five places, in the order of the test's own literal list; the count of lines `^\s+\d+\) ` equals `CHROME_PLACES.length` (5) and the text "(5)"; no line matches `^\s+at ` | 2(d) |
| E2K-08 | `SAI_CHROME=""`, a relative value, a directory, a non-executable file → `CHROME_NOT_FOUND` with `SAI_CHROME` in the text and no fallback; an empty `PATH` entry (`":/x"`) does not search the current folder | 2 |
| E2K-09 | `node test/e2e/run.js` as a child with `SAI_CHROME=/no/such/chrome`: exit 1; stderr holds one `e2e: error=CHROME_NOT_FOUND:` message with `SAI_CHROME` and `/no/such/chrome`; no line `^\s+at `; stdout has no `e2e: browser=`; its last line is the record with `exit=1`; the folder list of the temporary root is the same before and after (the real tree must hold `smoke.e2e.js`, written by the same step: `listSpecs` is the first step of `runAll`, so without it the message would be `NO_SPECS`) | 2, 7 |
| E2K-10 | stand-in `exit-early`: `launchBrowser` rejects in ≤5 s, `START_EXITED`, the message holds the exit code 3 and the line `fake: cannot start, boom`; `details.pid` gone (`ESRCH`), `details.profileDir` gone, `liveRegistrations()` empty; a start with the `ok` stand-in then succeeds in the same process | 4(a, e) |
| E2K-11 | `hang` with `startTimeoutMs: 1000`: `START_TIMEOUT` (message holds "did not start" and `1000`); `details.pid` gone, folder gone; the next start succeeds | 4(b, e) |
| E2K-12 | `close-on-connect`, `port-then-close`, and a `no-answer` stand-in killed with `SIGKILL` while a call is pending: the pending call rejects in ≤5 s with `BROWSER_CLOSED`; a later call rejects the same; `close()` removes the folder; the next start succeeds | 4(c, e) |
| E2K-13 | `bad-json`: the call rejects with `PROTOCOL_BAD_ANSWER` and **names its method**; two pending calls both reject, each naming its own method; the test process is alive; folder gone; next start succeeds | 4(d, e) |
| E2K-14 | `error-object`: the rejection is `PROTOCOL_ERROR`, holds the method and `boom from fake`; folder gone; next start succeeds | 4(d, e) |
| E2K-15 | `no-answer` with `callTimeoutMs: 500`: `CALL_TIMEOUT` naming the method in ≥500 ms and ≤5 s; the connection still usable for the next call | 4 |
| E2K-16 | `noisy` (1 MB on stderr written with `fs.writeSync` after the port line, F32): the start and a call succeed within 10 s (the pipe is drained); the test first checks the premise on a plain child that writes the same 1 MB with `fs.writeSync` to a pipe that nobody reads: it is still running after 500 ms (so the test can fail) | 4 |
| E2K-17 | `with-child`: after `close()` the pid of the stand-in **and** of its child are gone; `hang-ignore-term` with `closeGraceMs: 500`: `close()` ends the process by `SIGKILL` within 5 s; `liveRegistrations()` empty | 3 |
| E2K-18 | a child process (a script the test writes into a folder made by `makeTempDir`) starts the stand-in through the kit and prints its pid and folder; the test sends it `SIGTERM` (exit 143), `SIGINT` (130), `SIGHUP` (129) and, in other runs, the child calls `process.exit(3)` and throws: in all five cases the stand-in pid and its group are gone and the profile folder does not exist. «Gone» means gone within a bounded wait: the test waits with the helper `waitGone(pid, what, ms = 5000)` until both the pid and its group answer `ESRCH`, because a killed process that is not yet reaped still answers `kill(pid, 0)`; one check right after the end of the child is not allowed (ISS-0103, E2K-62, E2K-63) | 3, 11 |
| E2K-20 | `assertLoopbackUrl` table (the 28 rows below). Refused: `http://example.com/`, `https://127.0.0.1:1/`, `http://localhost:1/`, `http://10.0.0.1/`, `file:///etc/hosts`, `http://127.0.0.1@example.com/`, `http://127.0.0.1:1@example.com/`, `http://user:pw@127.0.0.1:1/`, `http://127.0.0.1.example.com:1/`, `http://example.com:1/http://127.0.0.1:1/`, `http://[::1]:1/`, `http://[::ffff:127.0.0.1]:1/`, `http://127.0.0.1/` (no port), `http://127.0.0.1:0/`, `http://127.0.0.1:65536/`, `javascript:1`, `data:text/html,x`, `about:blank`, `chrome://version`, `//127.0.0.1:1/`, ``, `null`, `5`, `{}`. Accepted and normalized: `http://127.0.0.1:1234/x` → itself; `HTTP://127.0.0.1:1234/x?a=1#b`; ` http://127.0.0.1:1234/ ` (spaces trimmed); `http://127.1:1234/` → `http://127.0.0.1:1234/` | 5 |
| E2K-21 | with the `ok` stand-in recording calls: for each refused row of E2K-20, `page.goto` rejects `URL_REFUSED` and the recorded count of `Page.navigate` is **0**; for an accepted row the count is 1 and the recorded `url` equals `new URL(input).href` (a tab and a line feed inside the input are gone) | 5 |
| E2K-22 | `assertShotPath`: refused — a path in `tools/`, the repository root, a `..` path that returns into the repository, a symbolic link inside the temporary root that points into the repository, a relative path, a `.jpg` path, a path under the file-system root outside the temporary root; accepted — a `.png` path under the temporary root; a screenshot through the stand-in writes a file that starts with the PNG signature and the test removes it | 5 |
| E2K-23 | with `TMPDIR` set to a folder inside the repository (a child process, so the real variable stays), `makeTempDir` and `launchBrowser` reject `PATH_REFUSED` and create nothing | 5 |
| E2K-24 | `browser.profileDir` of a started stand-in is under `tempRoot()`, outside `repoRoot()`, and its name holds `sai-e2e-`; `makeTempDir("probe")` likewise; the stand-in file has the execute bit (mode 0755) | 3, 5 |
| E2K-25 | the stand-in records its argument list; every argument is compared with the two forbidden flags (built from parts) — none equals either; the list holds `--headless=new`, `--remote-debugging-port=0`, `--user-data-dir=<browser.profileDir>`, `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`; and no file under `tools/test/e2e` contains either flag, **in code or in a comment** | 10(d) |
| E2K-30 | `listSpecs`/`parseSelection` table (on the fixtures folder `specs/` of 11.3, whose ten names (11.3; nine were planned, `exit-one` was added at step 5c) are known to the test, and on injected lists): none given = all alphabetical; `b a` keeps `b, a`; unknown name lists the existing names; no spec files; duplicate name; `../smoke`, `smoke.e2e.js`, ``, `smoke/x` unknown; no text in the failures that looks like a pass count | 7 |
| E2K-31 | `formatRecord` against the regular expression of the criterion (`^e2e: command=.+ selection=smoke exit=0 duration_ms=[0-9]+$`), for `all`, one name, two names (`selection=a,b`), `exit=1` | 7 |
| E2K-32 | `runAll` with the stand-in for the preflight and the fixture files of 11.3, called with `env = { …process.env, NODE_TEST_CONTEXT: "child-v8" }` so that the test holds under `npm test`, under `node --test` and when the file is run alone (F1, F29): names `pass-a pass-b` run in that order: the lines come as `e2e: browser=` (once), `e2e: file=pass-a`, its TAP (a line `# pass 1` is forwarded, so the TAP is not empty), `e2e: file=pass-b`, its TAP, the record `exit=0`; names `pass-b pass-a` keep that order; after each of the six `runAll` calls of this test `liveRegistrations()` holds no group, no folder and **no hook** (the runner removed its hook, section 6 step 1); the preflight `launch` is the injected one and the printed line is exactly `e2e: browser=FakeChrome/1.2.3`; `pass-a fail pass-b`: the failing file stops the run (no `e2e: file=pass-b` line), `SPEC_FAILED`, the last stdout line is the record with `exit=1`; `empty` → `SPEC_NO_TESTS`; `skipped` → `SPEC_SKIPPED`; `todo` → `SPEC_SKIPPED`; **added at step 5c:** `exit-one` (a spec that passes every test and still ends with exit code 1, so it cannot be told by its TAP text) is run through a `spawnSpec` stand-in that prints the committed passing TAP and exits 1 → `SPEC_FAILED` naming exit code 1 (a real run of the fixture would stop at the TAP count first; the fixture file is used only by its name in `listSpecs`) | 7 |
| E2K-33 | `runAll` with `fileTimeoutMs: 1000`, `killGraceMs: 500` and the fixtures `sleep` and `sleep-stubborn` (they write their own pid into the file named by `SAI_FIXTURE_PIDFILE`, passed in `env`; `sleep-stubborn` ignores `SIGTERM`): `SPEC_TIMEOUT` for both; within 8 s the pid of the leader, the pid of the file child written by the fixture (a different pid) and the whole group are gone (`kill(-pgid, 0)` gives `ESRCH`); the stubborn one needs the `SIGKILL` of the group; afterwards `liveRegistrations().groups` is empty (the stopped group was unregistered) | 7 |
| E2K-34 | `analyseTap(text, specArg)` on the captured texts of 11.3 (`normal`, `empty`, `skipped`, `todo`, `failing`) and on the empty string (the nested run printed nothing): the counts and `noTests` are right; the text `empty` with another `specArg` (another form of the path, for example with `tools/` in front) is **not** `noTests` by the single-line rule, which pins the rule to the exact string. **The same test also reads every file of `tools/test/fixtures/e2e/tap/` and `…/specs/` and asserts, line by line, that none holds a path of a machine** (remark F11): `hasHomePath(line)` is false for every line and `hasTempPath(text)` is false for every file (both imported from `../src/traces/rules.js`, the rules that `npm run traces` itself applies, so the test cannot drift from the check), no line holds `file:`, and no line has an absolute path (a slash or a drive letter with a colon after a space, a quote or an opening bracket); the text of `failing` holds the line `location: 'test/fixtures/e2e/specs/fail.e2e.js:3:1'` shape (a relative `location`) | 7, 11 |
| E2K-35 | `evaluateConsole` on synthetic entries: exact text (a longer text is not claimed by a shorter declaration), the first matching declaration claims, `path` narrows, `expectOncePerStart` leaves the second entry unexpected, an unmet declaration is reported, a declaration of another `kind` does not claim | 6 |
| E2K-36 | `newPage()` through the `ok` stand-in, which records calls: the record holds exactly one `Emulation.setEmulatedMedia` with `features: [{name: "prefers-color-scheme", value: "light"}]` and exactly one `Emulation.setDeviceMetricsOverride` with `width 1470`, `height 784`, `deviceScaleFactor 1`, `mobile false`, both **before** the first `Page.navigate` of the test; a second `newPage()` gets the same two calls. Machine independent (the stand-in has no scheme of its own), so it catches a missing light scheme on any machine (remark F8) | 6 |
| E2K-37 | `runAll` with an injected `spawnSpec` that records its argument: `args` equals exactly `["--test", "--test-reporter=tap", "test/fixtures/e2e/specs/pass-a.e2e.js"]` for the fixture folder (the relative form, no `./`, no leading `tools/`; for `specDir` = the real `tools/test/e2e` the pure `specArgument` gives `test/e2e/smoke.e2e.js`); `cwd` equals the `tools` folder; `env` has no `NODE_TEST_CONTEXT` although the `env` given to `runAll` has it, and every other key and value is equal to the given `env` (key for key); the argument object holds `detached: true` (the recorder sees it, remark F13) and nothing but `args`, `cwd`, `env`, `detached`; the recorder returns a **fake child** (an `EventEmitter` with `pid` 2147483646, which no process has, F35, and a `stdout` stream that carries the text of `tap/normal.txt` and then ends, and emits `close` with code 0), so the run goes on and ends `exit=0`, and `liveRegistrations().groups` is empty after it; a fake without a numeric `pid` that emits `error` → `SPEC_FAILED` (`could not be started`), nothing registered, the run stops; a `specDir` outside the `tools` folder → `USAGE` and nothing spawned. `specEnv` on an object without the key returns an equal copy and does not change the original | 7 |
| E2K-38 | a child process (a script the test writes into a folder made by `makeTempDir`) runs `runAll` on the fixture `sleep-chrome` (11.3: it starts a stand-in browser through the kit with `SAI_CHROME` = the stand-in in mode `with-child`, writes the pids it knows to `SAI_FIXTURE_PIDFILE`, and sleeps); when the pid file shows the browser is up the test sends `SIGTERM` to the runner: exit 143 within 8 s, stderr holds `e2e: error=INTERRUPTED: SIGTERM` **once**, the last stdout line is the record with `exit=1` and there is exactly **one** record line and no `SPEC_FAILED` line; the pids of the spec leader, the file child, the stand-in and its child are gone, the profile folder does not exist. The same with `SIGINT` → 130 and with `SIGHUP` → 129 (remark F14). A fourth run: the preflight stand-in is in mode `no-answer` (so the runner waits in the preflight, no spec has started); the test waits until the stand-in has logged its first call, sends `SIGTERM`: exit 143 within 8 s, the same two lines (once each), no `e2e: file=` line, the stand-in pid gone, its profile folder gone (remark F12 b). «Gone» for the pids is the bounded wait `waitGone` of E2K-18 (up to 5000 ms for the pid and its group), not one check right after the exit of the runner (ISS-0103; the signal loop and the preflight loop use it, E2K-63 pins both). Four runs, typically 1–2 s each; the test keeps its 30000 ms timeout | 7, 3 |
| E2K-39 | the signal hooks of `cleanup.js` in a child process (a script the test writes into a folder made by `makeTempDir`; each case is its own child; it calls `installHandlers({ hookLimitMs: 1000 })` first (30000 in case d), registers a throwaway process group of its own (a `detached` `node` that sleeps) with `registerGroup`, adds hooks that write marker files, and writes `hookErrors().length` and the group pid into a result file that the test reads): (a) one hook that writes its marker after 200 ms, `SIGHUP` → exit **129**, the marker exists (the hook was awaited), the group is gone; (b) a hook that never answers, `SIGTERM` → exit 143 not earlier than 1000 ms and not later than 5000 ms after the signal (the limit works), the group is gone; (c) a hook that throws and a second hook that writes a marker, `SIGTERM` → exit 143, the second marker exists, the group is gone, `hookErrors().length` was 1; (d) a hook that never answers with `hookLimitMs: 30000`, `SIGTERM` and, 300 ms later, `SIGINT` → exit **143** (the code of the first signal) within 3 s, the group is gone (the second signal skips the wait); (e) a hook added and then removed with `remove()` before the signal, `SIGTERM` → exit 143 and **no** marker. Five runs, each ≤ 5 s | 3, 7 |
| E2K-40 | `scripts.e2e` equals `node test/e2e/run.js`; `scripts.test` equals `node --test "test/**/*.test.js"`; the key `e2e` stands right after `test` and before `check` | 7, 8 |
| E2K-41 | `runAll` with an injected clock: `duration_ms` is the integer difference of the clock; the section of `tools/README.md` holds `duration_ms`, `30000`, `240000` | 9 |
| E2K-46 | **added at step 5c (found by the gate at 5b, mutant R15):** a child `node` calls `runAll` with the stand-in browser and the fixture `pass-a` and must end by itself: exit 0, not killed by its own 15 000 ms limit, and no later than 4 000 ms after the record line (the bound is wide on purpose against the 120 000 ms timer it guards); with the timer of a finished file left armed the child lingers and the test is red | 7, 9 |
| E2K-50 | the scanned files — every file of `tools/test/e2e/kit`, `tools/test/e2e/run.js`, `smoke.e2e.js`, `tools/test/e2e-kit.test.js` itself and `tools/test/fixtures/e2e/fake-chrome.js` — hold, **comments included**: none of the tokens `.skip(`, `.todo(`, `\|\| true`, `eslint-disable`; no `{ skip` / `{ todo` option (pattern: `{`, optional spaces, `skip` or `todo`, then `:`); no secret shape (`ghp_…`, `sk-…`, `BEGIN … PRIVATE KEY`); **the environment rule, by two patterns:** (i) every property read `process.env.<NAME>` or `process.env["<NAME>"]` has `<NAME>` in {`SAI_CHROME`, `PATH`, `TMPDIR`, `SAI_FAKE_CHROME_MODE`, `SAI_FAKE_CHROME_LOG`, `SAI_FIXTURE_PIDFILE`}; (ii) the bare object `process.env` (not followed by `.` or `[`) occurs exactly once in `find-chrome.js` (the default of the parameter `env`), exactly once in `browser.js` (the default of the option `env`), exactly once in `runner.js` (the default of the option `env`), and anywhere in `e2e-kit.test.js` (to build the environment of a child); in every other scanned file zero times. `NODE_TEST_CONTEXT` is named in `runner.js` and `e2e-kit.test.js` only. The search words are assembled from parts (11, "Forbidden words"); the folders `specs/` and `tap/` of the fixtures are the only unscanned files and the test asserts that | 11 |
| E2K-51 | in an `after` hook: `liveRegistrations()` is empty (no group, no folder, **no hook**) and every folder this test file made is gone | 3, 11 |
| E2K-60 | `tools/README.md` has one line `## End-to-end tests in a real browser`; its section holds the tokens of section 14; the "spec file → requirement" table has the row `smoke.e2e.js` → `REQ-104`; the sentence of "Check" names six steps in order ending with `npm run e2e` | 12 |
| E2K-61 | the paragraph "You need" (cut as in the criterion) holds `Chrome`, `SAI_CHROME`, `fails`, no `://`; "Check" of `tools/README.md` holds `Chrome` and `SAI_CHROME`; `decisions/0107-e2e-real-chrome-in-check.md` exists, one line `Status: **accepted**`, names `REQ-104` | 13 |
| E2K-62 | **added by ISS-0103:** the helper `waitGone` is pinned with a deterministic hold. A child script starts a victim (`node -e setInterval`, its own group), kills it with `SIGKILL` (once the group, once the pid) and stays alive without reaping it, so the victim is a zombie; the test shows that the old single check `pidGone(pid) && groupGone(pid)` is false at that moment and that `waitGone` does not settle while the hold lasts (still pending after 300 ms), then releases the child and `waitGone` ends true; a live process makes `waitGone` fail within its short limit with a message that names what was waited for, and the live process is left alone; the group of a live member is not gone; a live member that is no group leader does not count as gone | 3, 11 |
| E2K-63 | **added by ISS-0103:** a source guard of the three places that wait for a killed stand-in: the test reads its own file (whole-line `//` comments blanked) and requires, in E2K-18, one `assert.ok(await waitGone(...))`, and in E2K-38 two (the signal loop and the preflight), each with the pid, a name and a limit of at least 1000 ms or the default, no `pidGone(` at all in the two bodies, and no `groupGone(...)` of a killed process outside `waitGone` except the allowed asks of the leader and the browser group after the loop in E2K-38; a failure message names the test and the line. Known limits (a body cut at `^);`, comments in other forms, two surviving mutants of E2K-62): `docs/issues/ISS-0104` | 3, 11 |

(Forty tests were planned; fifty were built by step 10 of the run `E2E104-20261103-01`, and the two rows above, E2K-62 and E2K-63, came with ISS-0103: fifty-two. The gaps in the numbers are intentional: the tens group the tests by criterion. The nine that have no row in the table above — E2K-19, 26, 27, 28, 29, 42, 43, 44, 45 — are listed in section 21; E2K-46 has its row above.)

### 11.2 `tools/test/e2e/smoke.e2e.js` (real Chrome; a tiny page server on 127.0.0.1 port 0 inside each test)

| Id (name starts with) | What it proves | Criterion |
|---|---|---|
| SMK-01 start click title | the kit opens page `Demo`, clicks `Go`, `document.title` becomes `Done`; `goto` returned status 200; `browser.product` matches `/Chrome\/\d+\.\d+/`; `profileDir` is under the temporary root, outside the repository; after `withBrowser` ends `process.kill(pid, 0)` throws `ESRCH` and the folder does not exist | 3 |
| SMK-02 clean-up after a throwing body | a body that throws: the same error object comes back; the same two facts | 3 |
| SMK-03 clean-up with a pending request | the page asks the server for a path that never answers; the body ends; the same two facts; the test server closes all connections | 3 |
| SMK-04 browser killed mid-call | `Runtime.evaluate` of a never-resolving promise is pending, the test sends `SIGKILL` to the group: the call rejects within 5 s with `BROWSER_CLOSED` ("closed"); a later call rejects the same way; `close()` removes the folder | 3 |
| SMK-05 sizes and overflow | for 1470×784, 390×844, 320×568 `innerWidth`/`innerHeight` equal the request (`setViewport` reports them too); `#wide` (700 px) reports `overflowing:true` at 320 and the fluid page `false` at all three sizes (positive and negative control) | 6 |
| SMK-06 themes | a fresh page is light (`matches` false) — the machine default is not used; `dark` → true and the computed `background-color` differs; back to `light` → the first value again | 6 |
| SMK-07 console entries | a page with `console.error('x')`, a throw in a timer, a rejected promise and a `fetch` answered 500 → four entries, distinct by (kind, text): `console`, `exception`, `rejection`, `browser-log`; a clean page → none; one entry declared with `expect` is not counted; a declared entry that never happened makes `withBrowser` reject with `CONSOLE_ENTRIES` | 6 |
| SMK-08 favicon once per start | page without a favicon, the server answers 404 for `/favicon.ico`, two loads in one start, `expectOncePerStart({kind:"browser-log", text:<404 text>, path:"/favicon.ico"})` → exactly one entry, the test passes; the same declaration in a start that loads no page → `CONSOLE_ENTRIES`; a third start with the same page and **no** declaration → `CONSOLE_ENTRIES` (a declaration does not carry over) | 6 |
| SMK-09 keyboard and typing | `press` Tab moves focus through a button, a text field, a checkbox; Space toggles the checkbox; Enter activates a button; Shift+Tab moves back; `type` puts `привет` into the field | 3 (kit abilities of the description; needs of REQ-105, О8) |
| SMK-10 click is checked and waits | `click` on a button covered by an overlay rejects `CLICK_INTERCEPTED`; on a button far down the page it scrolls and works; `click` on a missing selector → `ELEMENT_NOT_FOUND`; `waitFor` returns after a condition becomes true 300 ms later and rejects `WAIT_TIMEOUT` with a 200 ms limit | 3 |
| SMK-11 network, reload, second tab | `network()` shows the POST with its body and status; `responseBody` returns the answer; `goto` of a missing route returns status 404 (its two 404 entries declared); `reload` keeps the page; a second `newPage()` sees the `localStorage` the first wrote | 3 (needs of REQ-105 and REQ-107, О8) |
| SMK-12 screenshot | `screenshot` into a folder made by `makeTempDir` writes a file with the PNG signature and size > 0; the folder is removed by the test | 5 |
| SMK-13 only this computer | with the page server redirecting a path to `http://example.com/`, and a direct evaluate of `location.href = "http://192.0.2.1/"`, the browser ends on an error page (`chrome-error`) for both, fast (≤ 10 s each); a loopback page still loads | 5 |

Thirteen real-Chrome tests, each with its own browser (F28: ~0.5 s each) → about 10 s plus the preflight, inside the 30000 ms budget.

### 11.3 Fixtures of the runner tests (plain files, written by TEST-DESIGNER at step 5)

Folder `tools/test/fixtures/e2e/specs/` — each file is an ES module that imports `node:` modules only, has top-level `test()` calls and passes lint and `prettier --check` (F33). `listSpecs` of this folder gives these ten names, alphabetical (nine were planned; `exit-one` was added at step 5c, section 21): `empty`, `exit-one`, `fail`, `pass-a`, `pass-b`, `skipped`, `sleep`, `sleep-chrome`, `sleep-stubborn`, `todo`.

| File | Content | Used by |
|---|---|---|
| `pass-a.e2e.js`, `pass-b.e2e.js` | one test each, passes at once | E2K-32, E2K-37 |
| `fail.e2e.js` | one test that throws | E2K-32 |
| `empty.e2e.js` | zero bytes (F11) | E2K-32 |
| `skipped.e2e.js` | one passing test and one test with the skip option | E2K-32 |
| `todo.e2e.js` | one passing test and one test with the todo option | E2K-32 |
| `sleep.e2e.js` | one test: writes `process.pid` into the file named by `SAI_FIXTURE_PIDFILE`, then waits 60 s | E2K-33 |
| `sleep-stubborn.e2e.js` | like `sleep`, and ignores `SIGTERM` | E2K-33 |
| `sleep-chrome.e2e.js` | one test: `launchBrowser()` through the kit (`SAI_CHROME` is the stand-in), writes `{file: process.pid, browser: browser.pid, profileDir}` as JSON into `SAI_FIXTURE_PIDFILE`, then waits 60 s | E2K-38 |

Folder `tools/test/fixtures/e2e/tap/` — texts captured once and then **normalized**, so that no committed file holds the path or the name of any machine (remark F11; measured, F34). Procedure for each of `normal` (from `pass-a`), `empty` (from `empty`; its only top-level line is `ok 1 - test/fixtures/e2e/specs/empty.e2e.js`), `skipped`, `todo`, `failing` (from `fail`):

1. Capture (Node 22; the figures are the ones of F11, F30): `cd tools && env -u NODE_TEST_CONTEXT node --test --test-reporter=tap test/fixtures/e2e/specs/<name>.e2e.js > <scratch outside the project>/<name>.txt` — the capture goes to a folder **outside the project**, not into `tap/` (a file with a machine path must never stand in the working tree, not even for a moment, because `npm run traces` lists untracked files too).
2. Normalize: from the text remove every occurrence of the absolute path of the `tools/` folder with its trailing separator, in the form `file://<abs>/` and in the form `<abs>/` (on a machine with another path syntax the same: whatever absolute prefix the text holds). What is left are paths relative to `tools/`, for example `location: 'test/fixtures/e2e/specs/fail.e2e.js:3:1'` and `(test/fixtures/e2e/specs/fail.e2e.js:4:9)`. Nothing else is changed: the `not ok` line, the diagnostic blocks, the `# tests … # duration_ms` lines stay (their numbers are whatever the capture gave; no test reads them).
3. Check by hand before the file goes into `tap/`: `grep -c -E 'file:|/Users/|/home/|/tmp/|/var/'` on it gives 0, then copy it into `tools/test/fixtures/e2e/tap/`.
4. Only `failing.txt` holds any path (the `location:` and `stack:` lines of a failed test); the other four hold none, and step 2 changes nothing in them. The same rule is used if a text is captured again on another machine (the Windows PC of the owner, a CI log).

Measured (F34): without step 2 the file `failing.txt` makes `npm run traces` report two lines "путь домашнего каталога" and exit 1, so `npm run check` and criterion 11 would be red; with step 2 `traces` reports 0 traces and exit 0. **Test:** E2K-34 reads the five texts and the ten spec fixtures and applies to them the rules of `traces` (`hasHomePath` per line, `hasTempPath` per text) plus the plain checks listed in its row, so a text captured again and committed without step 2 turns `npm test` red at once, before `npm run traces` of the same `check`; criterion 11 is also read by RELEASE-VALIDATOR with `npm run -s traces | grep -c -E 'tools/test/e2e|tools/test/fixtures/e2e'` (0).

---

## 12. Replacement table of earlier guard tests

Measured on the tag with the trials F5–F7. The rule for every row: the comparison stays **exact** (list equality or `assert.equal` / `deepEqual`, never `includes` or a prefix) — stricter or equal, never weaker (Q6, AP-068, AP-112, AP-113). The earlier requirement whose criterion carries each test is named (AP-133).

| # | Test | File, line | Was | Became | What it counts | Earlier criterion |
|---|---|---|---|---|---|---|
| 1 | HC-02 | `tools/test/handoffs-docs.test.js` 16–36 (the `deepEqual` at 25–31) | the list of `check` steps equals five: `format:check`, `lint`, `traces`, `handoffs-check`, `test` | the same five and `npm run e2e` as the sixth; `!includes("||")`, the two index checks and the `raw.match` count are unchanged | the whole list (a list, exact) | REQ-038 criteria 1, 10, 11 (`docs/requirements.yaml` 5313: "`handoffs-check` before `npm run test`, no `\|\|`" stays true) |
| 2 | HC-03 | same file 40–47 (line 46) | `assert.match(scripts.check, /npm run test$/u)` | `/npm run test && npm run e2e$/u`; the line before (`scripts.test` equals `node --test "test/**/*.test.js"`) is unchanged and guards that the browser suite stays out of `npm test` | the end of the string | REQ-038 criterion at `docs/requirements.yaml` 5313 and description 5266–5268: "the check `check ends with npm run test` … passes **without edit**" — **becomes false** (AP-133, О9) |
| 3 | HO-54 | `tools/test/handoffs-cmd-docs.test.js` 141–161 (`deepEqual` 146–155) | the five steps; the title says "the same five" | the six steps (title text updated); `!raw.includes("||")` and "`handoff` stands right after `handoffs-check`" unchanged | the whole list | REQ-039 criteria 7 and 8 (no text there states the five steps) |
| 4 | PK-7b | `tools/test/picker-config.test.js` 779–795 (`equal` at 784–787) | `check` equals the five-step string | the string + ` && npm run e2e`; the lines about `picker` after `handoff`, no `dependencies`, the four development dependencies are unchanged | one string, exact | REQ-054 (test header: "the criteria of REQ-054"; no criterion text states the string) |
| 5 | LP-3 | `tools/test/picker-look-property.test.js` test at 292, assertions 440–466 | `Object.keys(pkg.scripts)` equals 18 names ending `…, "test", "check"` and `check` equals the five-step string | the list with `"e2e"` between `"test"` and `"check"` (19 names) and the six-step string; `scripts.picker` and the `dependencies` checks unchanged | the whole key list, exact | REQ-069 ("nothing extra is added"; no criterion text states the list) |
| 6 | CTL-13 | `tools/test/team-web-control.test.js` 1702 | `assert.match(pkg.scripts.check, /npm run test$/)` | `/npm run test && npm run e2e$/`; `scripts.test` equality at 1701 unchanged | the end of the string | REQ-035 criterion 13; and REQ-038 5313 as in row 2 |
| 7 | none, unchanged | `traces-check.test.js` TC-20 (both indexes stay: `traces` < `test`); PK-4 scans by prefix `picker-`, `handoffs-`, `team-web-` (`picker-config.test.js` 881, `picker-page-static.test.js` 700, `handoffs-docs.test.js` 99, `team-web-docs.test.js` 69, `team-web-control.test.js` 1704) do not read `e2e-kit.test.js` or the folder `e2e`; `picker-look.test.js` 266 counts `fixtures/picker` only; the scans of `tools/src` do not see `tools/test`; REQ-030 tests (`repo.test.js` CI-1…CI-8, PH-2, RD-1…RD-4) read the workflow, the hook and the root README by section headings; this work edits a paragraph in the section "How to open on another computer" and the section "Check" of `tools/README.md`, not those headings, and the tests stay green with the edits (F6, F7; remark M1 of the gate); `exec-docs`, `exec-scripted-source` read `fixtures/team` | — | — | classified by what they count (F4, F5, F7) | — |

The README sentence "about 2 minutes" of the root README section "Check on GitHub and before a push" is pinned by RD-2 (`repo.test.js` 1124) and is not changed by this work (section 18).

**Branch B only** (the runner has no Chrome, criterion 10): the guard tests of REQ-030 that compare `.github/workflows/check.yml` turn red — measured by the requirement author and the gate: CI-4 and CI-8 of `tools/test/repo.test.js` (and CI-5 if a third-party action is used). Their "was → became" table cannot be written before the log of the real run says which install step is needed; it is a new design step of this requirement (a rework step `01c` of this designer through ORCH) and the measurement is repeated then. This design does not guess it.

---

## 13. Shared places that change, and what happens to each

| Shared thing | Where it is used | What happens |
|---|---|---|
| `scripts.check` of `tools/package.json` | the six tests of section 12; `traces-check` TC-20 (indexes only); `.githooks/pre-push` (runs `npm run check`, text unchanged); `.github/workflows/check.yml` (runs `npm run check`, unchanged in branch A); the sentence of "Check" in `tools/README.md`; `.claude/agents/test-runner.md` item 3 (stages; says the composition is not copied there) | the six tests are replaced; the hook and the workflow need no edit; the README sentence is edited; the role file is listed for ORCH (section 18) |
| `Object.keys(scripts)` | LP-3 | replaced (row 5) |
| `tools/README.md` section list | `team-web-docs`, `pixel-office-docs`, `traces-readme`, `repo.test.js` RD-*, `team-docs` read named sections only (measured: F5, F7, no red) | one section appended at the end of the file |
| the root `README.md` paragraph "You need" | `traces-readme.test.js` (heading `## How to open on another computer`), `repo.test.js` RD-1 (`README_PREVIOUS`) | the heading stays; the words added hold no `://`, no path of a home folder (F5/F7: no red) |

---

## 14. README texts (agreed with the greps of criteria 12, 13 and with E2K-60/61; AP-077)

**Root `README.md`, paragraph "You need"** (the text between the heading `## How to open on another computer` and the line that starts `1. `; written by hand, not through prettier, F10):

> You need: git; Node 22 with npm (`tools/package.json`, field `engines`); Google Chrome or Chromium: the last step of `npm run check` opens the Sai pages in a real headless browser. The check looks for Chrome in the standard place of macOS and then for `google-chrome`, `google-chrome-stable`, `chromium` and `chromium-browser` in `PATH`; if it is somewhere else, set the variable `SAI_CHROME` to its full path. Without a browser `npm run check` fails with a clear message and is not skipped. Claude Code is needed only for the Pixel Office hooks and for real runs of the Sai Team executor; for the rest it is not needed.

Greps: `Chrome` ≥ 1, `SAI_CHROME` ≥ 1, `fails` ≥ 1 (the word is in "`npm run check` fails"), no `://`. Measured on the clone: no test went red with this text (F6, F7).

**`tools/README.md`, section "Check"**: the sentence that lists the steps (line 15) becomes: `npm run check` is, in a row, `npm run format:check` (prettier --check), `npm run lint` (eslint --max-warnings 0), `npm run traces` (the trace check), `npm run handoffs-check` (the check of the run records), `npm run test` (node --test over `test/**/*.test.js`) and `npm run e2e` (the end-to-end tests in a real headless Chrome); it stops at the first error. Then, in the same section: "Chrome is needed for the last step: the variable `SAI_CHROME` (a full path) is read first, then the standard places; without a browser the step fails with a clear message and is never skipped (decisions/0107)." The sentences that follow ("The check is not bypassed …") stay.

**`tools/README.md`, new last section** `## End-to-end tests in a real browser` (one line, exactly) with these contents; every item is a token of E2K-60:

1. What it is: the spec files `tools/test/e2e/<name>.e2e.js` open the Sai pages in a real headless Chrome; the command `cd tools && npm run e2e`; one file: `npm run e2e -- smoke` (several names run in the given order); the script `test` never starts a browser.
2. Where Chrome is searched: `SAI_CHROME` first (a full path; if it is set and the file is missing the run fails and no other place is tried), then the five places in order (the macOS place, then `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser` in `PATH`); a missing Chrome **fails** the run with a message that names `SAI_CHROME` and the places; it is never skipped.
3. The output: `e2e: browser=<product and version>` once, `e2e: file=<name>` before each file, and the last line `e2e: command=… selection=… exit=… duration_ms=…` (`selection=` is `all` or the names); the budgets: `smoke` 30000 ms, all files 240000 ms (REQ-104 criterion 9).
4. Where files go: the profile folder of each browser (`sai-e2e-profile-…`) and any screenshot lie under the temporary root of the system (`TMPDIR` is honoured), never in the project; they are removed at the end, on failure, and on `SIGINT`/`SIGTERM`/`SIGHUP`; the browser can open only `http://127.0.0.1:<port>/…`; the sandbox of Chrome is never turned off.
5. How to write a spec: a file named `<name>.e2e.js` with top-level `test()` calls only, each test starts its own browser with `withBrowser`, names are unique, each test passes alone; page code is given to `evaluate` as a string.
6. The table "spec file → requirement": a header row and the row `smoke.e2e.js` | `REQ-104`; REQ-105, REQ-106 and REQ-107 add their rows.

*As built 2026-11-16 (DOC-UPDATER, step 10 of run `E2E107-20261116-01`; the items above are not rewritten).* The table of `tools/README.md` now holds the rows `picker.e2e.js` | `REQ-105`, `pixel-office.e2e.js` | `REQ-106`, `smoke.e2e.js` | `REQ-104` and `team-web.e2e.js` | `REQ-107`, and no line promises a row any more (`E2K-60`; `decisions/0113` О28). The budgets of item 3 grew with the page specs: `picker` 80000, `pixel-office` 50000, `team-web` 70000 (`E2K-41`). Item 4 has one more sentence, about `--use-mock-keychain` (`decisions/0113` О1, О27: «measured for REQ-107 on macOS: …»).

Run on the CI runner: a short note that the GitHub image is `ubuntu-24.04` and the result is read as REQ-104 criterion 10 says. (No address in the section.)

---

## 15. Build sub-steps (BACKEND-DEV)

After each sub-step: `cd tools && npm run lint && npm run format:check` and a scratch driver outside the project (importing the new modules by absolute path) for the checks below. `npm run traces` is run on a copy where the new files are present (it reads untracked files too, F8). A sub-step is delivered with the expected red tests stated; a red test not in the list is a stop and a report to ORCH.

| # | Files | Check of the sub-step | Existing tests that turn red (measured: F5 for 1–6, F6/F7 for 7 and 8) |
|---|---|---|---|
| 1 | `errors.js`, `find-chrome.js` | driver: the lookup table of E2K-04…08 with injected `env`/`exists`; messages carry `SAI_CHROME` and five numbered places | none |
| 2 | `guards.js` | driver: the tables of E2K-20 and E2K-22 | none |
| 3 | `cdp.js`, `console.js`, `fixtures/e2e/fake-chrome.js` (mode 0755; E2K-24 asserts the execute bit) | driver: the seven modes of F24 plus `close-on-connect`, `noisy` (written with `fs.writeSync`, F32), `with-child`, `hang-ignore-term`: a call per mode; `bad-json` must not crash the driver; `evaluateConsole` on the synthetic cases of E2K-35 (`console.js` is pure and stands alone, remark F10) | none |
| 4 | `cleanup.js`, `browser.js` | driver with the stand-in: the five fault cases of criterion 4, the group kill with a child, the signals (F21), a signal hook that is awaited before the exit (a hook that takes 1 s delays the exit by about 1 s), a hook that never answers (the exit comes after `hookLimitMs`), a hook that throws, a removed hook, a second signal, `SIGHUP` (the cases of E2K-39), the real Chrome start/stop 20 times with `ps` before and after (no process left, no folder left) | none |
| 5 | `page.js`, `index.js` | driver with the real Chrome: every number of F13–F19 (sizes, overflow, scheme default light, click with the hit test, keys, typing, network, tabs, console entries, favicon once, screenshot, confinement F23) | none |
| 6 | `kit/runner.js`, `run.js` | **On the real tree** every command of the runner says `NO_SPECS` (exit 1, record line `exit=1`) until `smoke.e2e.js` exists at step 5: `listSpecs` is the first step of `runAll`, so `node test/e2e/run.js nosuch` and `SAI_CHROME=/no/such/chrome node test/e2e/run.js` print `NO_SPECS`, not `SELECTION_UNKNOWN` / `CHROME_NOT_FOUND` (remark F5). The messages, exit codes and last lines are therefore checked **on a scratch copy** (outside the project, `TMPDIR` pointing outside the copy): `mkdir -p <scratch>/tools/test/e2e && cp -R tools/test/e2e/kit tools/test/e2e/run.js <scratch>/tools/test/e2e/ && cp tools/package.json <scratch>/tools/` (the copy computes its `tools` folder from its own location), then fixture spec files of the BACKEND-DEV's own (a passing, a failing, an empty, one with a skip option) are written beside `run.js` and the driver runs `node <scratch>/tools/test/e2e/run.js [nosuch]`, `SAI_CHROME=/no/such/chrome node …`, and with the stand-in as `SAI_CHROME`; also `kill -TERM` of a runner with a sleeping fixture (exit 143, no spec process left, F31), the same during the preflight with the stand-in in mode `no-answer` (exit 143, the two lines once each, no stand-in left), and `kill -HUP` and a run started with `NODE_TEST_CONTEXT=child-v8` in the environment (TAP still forwarded, F29). On the real tree from step 5 the same two commands show the real messages (E2K-09) | none |
| 7 | `tools/package.json` | `node -e` on `scripts.check` and the key order | **six, expected (`EXPECTED_RED`): HC-02, HC-03, HO-54, PK-7b, LP-3, CTL-13** (named in `result.issues` with the section 12 row) |
| 8 | `tools/README.md`, root `README.md` | the greps of criteria 12 and 13 by hand; `format:check`, `traces` | none beyond the six already red (measured: F6 with both READMEs: still exactly six) |

Between steps 2 and 5 of WF-02 the six may stay red; from step 5b there is none. The sub-steps are small enough to be checked alone: the first six add files nothing reads; sub-step 7 is one edit.

---

## 16. Mutants

One per trap. Each is a one-place breakage that TEST-DESIGN-VALIDATOR applies to the finished code; the test named must turn red (with the stated reason). "Real" tests are run by the runner; the others by `npm test`.

| # | Breakage | Caught by |
|---|---|---|
| M01 | `findChrome`: with `SAI_CHROME` set but missing, fall back to the places | E2K-05 (`exists` called) |
| M02 | `findChrome`: ignore `SAI_CHROME` when a place exists | E2K-04 |
| M03 | swap `chromium` and `google-chrome` in `CHROME_PLACES` | E2K-06 (suffix loop: the first existing place of the test's own list must win), E2K-07 (order of the lines) |
| M04 | drop `chromium-browser` from `CHROME_PLACES` | E2K-06 (each place alone) and E2K-07 (count 5) |
| M05 | the not-found message omits `SAI_CHROME`, or lists only the first place | E2K-07 |
| M06 | `SAI_CHROME=""` treated as unset | E2K-08 |
| M07 | a relative `SAI_CHROME` accepted | E2K-08 |
| M08 | an empty `PATH` entry searched as the current folder | E2K-08 |
| M09 | the runner returns 0 and prints "skipped" when Chrome is missing | E2K-09 (exit 1) |
| M10 | the main prints `err.stack` | E2K-09 (`^\s+at ` line) |
| M11 | `assertLoopbackUrl` accepts `localhost` | E2K-20, E2K-21 |
| M12 | `assertLoopbackUrl` accepts `https:` | E2K-20 |
| M13 | the host check is a prefix test (`startsWith("http://127.0.0.1")`) | E2K-20 (`127.0.0.1.example.com`, `127.0.0.1@example.com`) |
| M14 | the URL check moved after `Page.navigate` | E2K-21 (count of `Page.navigate` > 0) |
| M15 | `goto` navigates to the raw input, not the normalized `href` | E2K-21 (recorded `url` differs) |
| M16 | `assertShotPath` accepts a path inside the repository | E2K-22 |
| M17 | `assertShotPath` compares strings without `realpath` | E2K-22 (the symbolic link row) |
| M18 | the profile folder made in the current folder (or the check of the repository dropped) | E2K-23, E2K-24, SMK-01 |
| M19 | `withBrowser` closes only on success (no `finally`) | SMK-02, E2K-10 (`liveRegistrations()`) |
| M20 | `close()` kills only the leader pid, not the group | E2K-17 (the child of the stand-in survives) |
| M21 | `close()` never escalates to `SIGKILL` | E2K-17 (`hang-ignore-term`) |
| M22 | the profile folder is not removed on a start failure | E2K-10, E2K-11 |
| M23 | pending calls are not rejected when the socket closes | E2K-12, SMK-04 (timeout of the test) |
| M24 | a call after the close hangs instead of rejecting | E2K-12, SMK-04 |
| M25 | the JSON parse of an incoming frame is not guarded | E2K-13 (the test process dies / uncaught) |
| M26 | an `error` object resolves, or the rejection drops the method name | E2K-14 |
| M27 | a start timeout rejects but does not kill the process | E2K-11 (`ESRCH`) |
| M28 | an early exit is noticed only by the start timer | E2K-10 (≤ 5 s) |
| M29 | stderr is not read after the port line | E2K-16 (the stand-in writes with `fs.writeSync`; the premise check of E2K-16 proves that such a writer blocks on an unread pipe, F32) |
| M30 | a module-level "started" flag makes a second start fail | the "second start succeeds" assertion in E2K-10…E2K-14 |
| M31 | `SIGINT`/`SIGTERM` handlers not installed | E2K-18 |
| M32 | `Runtime.exceptionThrown` events are not collected | SMK-07 (three entries instead of four) |
| M33 | `Log.entryAdded` entries are not collected | SMK-07, SMK-08 |
| M34 | a declaration matches by "contains" | E2K-35 |
| M35 | `path` ignored, so a declaration for the favicon line also claims a page 404 | E2K-35 (`path` narrows) |
| M36 | `expectOncePerStart` allows two entries | E2K-35 |
| M37 | an unmet declaration does not fail | E2K-35, SMK-07, SMK-08 |
| M38 | the colour scheme is left to the machine (no explicit `light`) | E2K-36 (the recorded `Emulation.setEmulatedMedia` call is absent: any machine), SMK-06 (also on a machine whose default is dark, as this Mac) |
| M39 | `mobile:true` in the viewport override | E2K-36 (the recorded call), SMK-05 (320 reports 980) |
| M40 | the overflow test uses `>=` | SMK-05 (the fluid page at 320) |
| M41 | the hit test of `click` removed | SMK-10 (`CLICK_INTERCEPTED` expected) |
| M42 | `waitFor` never times out / returns on the first poll | SMK-10 |
| M43 | `--no-sandbox` added to the arguments | E2K-25 |
| M44 | `--host-resolver-rules` dropped | SMK-13, E2K-25 |
| M45 | `nosuch` selection exits 0 | E2K-30, E2K-32 |
| M46 | the selection is sorted instead of kept in the given order | E2K-30, E2K-32 |
| M47 | `e2e: browser=` printed per file or not at all | E2K-32 |
| M48 | the record always says `exit=0` | E2K-31, E2K-32 (failing fixture) |
| M49 | a spec with no test passes | E2K-32, E2K-34 |
| M50 | the run continues after a failing file | E2K-32 |
| M51 | `npm run e2e` removed from `check` | HC-02 (replaced), E2K-40 |
| M52 | the `test` glob widened to `test/**/*.js` | HC-03 (replaced: `scripts.test` equality), E2K-40 |
| M53 | the kit imports an npm package | E2K-02 |
| M54 | the README section heading renamed / `SAI_CHROME` removed from the paragraph "You need" | E2K-60, E2K-61 |
| M55 | the spec process gets the environment unchanged (`NODE_TEST_CONTEXT` kept; F1, F29) | E2K-32 (run with the variable in `env`: the forwarded TAP has no `# pass 1` line, so `pass-a` is `SPEC_NO_TESTS`), E2K-37 (`env` still holds the key) |
| M56 | the spec argument written from the root of Sai (`tools/test/e2e/<name>.e2e.js`; F2, F30) | E2K-37 (the exact `args`), E2K-32 ("Could not find", `SPEC_FAILED` for `pass-a`) |
| M57 | `noTests` compares the `ok` line with another form of the path (absolute, or with `./`), or ignores the single-line rule | E2K-34 (`empty` with the exact string is `noTests`; with another string it is not), E2K-32 (`empty` → `SPEC_NO_TESTS`) |
| M58 | the watchdog sends its `SIGKILL` to the leader pid, not to the group | E2K-33 (`sleep-stubborn`: the file child pid stays alive) |
| M59 | the runner does not stop the spec group on its own `SIGTERM` (no hook, or a hook that does nothing) | E2K-38. Reason, measured by the gate on a prototype of the flow: the spec group is registered, so at the exit the clean-up `SIGKILL`s it and the spec leader and the file child die — but the file child dies before it ran its `SIGTERM` handler, so the **browser group** (the stand-in and its child, a group of its own) stays alive and its profile folder stays; E2K-38 turns red through the stand-in pids, the profile folder and the missing `INTERRUPTED` line (not because the spec leader survives) |
| M60 | the signal handler of `cleanup.js` does not await the hooks (exits first) | E2K-38 and E2K-39(a) (same effect as M59 for the browser group; in E2K-39 the marker of the hook is missing) |
| M61 | a kit file reads another variable (`process.env.HOME`) or a second bare `process.env` appears | E2K-50 (patterns (i) and (ii)) |
| M62 | `runAll` does not remove its hook at the end (`remove()` not called, or not in a `finally`) | E2K-32 (`liveRegistrations().hooks` is 0 after each run), E2K-51 |
| M63 | the hook is added just before the first spec (a signal during the preflight prints no `INTERRUPTED` and no record line) | E2K-38 (the fourth run, preflight) |
| M64 | `SIGHUP` is not handled, or ends with 143 | E2K-18, E2K-38, E2K-39(a) |
| M65 | a second signal still waits for the hooks | E2K-39(d) |
| M66 | the wait for the hooks has no limit | E2K-39(b) |
| M67 | a hook that throws stops the other hooks or the clean-up (or becomes an unhandled rejection) | E2K-39(c) |
| M68 | `remove()` does nothing | E2K-39(e) |
| M69 | the stopped spec group is not unregistered (the exit clean-up signals a gone group) | E2K-33 and E2K-37 (`liveRegistrations().groups` is empty afterwards), E2K-51 |
| M70 | the preflight calls `launchBrowser` and ignores the injected `launch` | E2K-32 (the printed `e2e: browser=` line is not `FakeChrome/1.2.3`, or a real Chrome starts) |
| M71 | `spawnSpec` is called without `detached: true` | E2K-37 (the recorded argument object), E2K-33 (the group `SIGKILL` does not reach the file child) |
| M72 | a comment in a file under `tools/test/e2e` names a sandbox flag or a skip word (rule F16) | E2K-25, E2K-50, and the greps of criteria 10(d) and 11 |

Seventy-two breakages (the requirement asks for at least 20). M38 and M39 are the two that depend on the machine in SMK-05/SMK-06 and no longer do in E2K-36.

---

## 17. Quality bar

| Item | Status | How |
|---|---|---|
| Q1 | applicable | the change is REQ-104; every criterion names its check (section 10) |
| Q2 | applicable | the producer (BACKEND-DEV, TEST-DESIGNER) is checked by SECURITY-REVIEWER, REVIEWER, TEST-DESIGN-VALIDATOR, TEST-RUNNER, RELEASE-VALIDATOR, who repeat the commands (criteria 7–13 are written as commands the validator runs); this design is repeated by CODE-DESIGN-VALIDATOR on a clone of the tag |
| Q3 | applicable | every statement about the system is a measured fact (section 1) with its sketch; what could not be measured (Linux flags, the sandbox on the runner, the Linux behaviour of the resolver rule, the path form node prints on Windows) is named as not measured; the facts F29…F35 of the reworks (the nested `node --test` environment, the path form, the stop of a spec group, the blocking writer, the fixtures, the machine path in a captured TAP text and what `npm run traces` reports about it, a pid that no process has) were measured on a fresh clone of the tag, and criterion 10 settles it by a real run before the push |
| Q4 | applicable | `npm run e2e` is the sixth, last step of `npm run check`, no `||`; it also runs alone with names (section 6); `npm ci && npm run check` needs Chrome or `SAI_CHROME` (0107; README, section 14) |
| Q5 | applicable | a test for every criterion (section 10); failure tests assert that the state did not change (folder gone, group gone, `Page.navigate` count 0, no file written, next start works) |
| Q6 | applicable | a missing Chrome fails (E2K-09), never skips; a spec with no test or with `skip`/`todo` fails (E2K-32); no `skip`, `todo`, `|| true`, disabled lint (E2K-50; the forbidden words reach the tests only as fixture files or as strings assembled from parts, section 11); the six replaced guard assertions stay exact (section 12); the sandbox is not turned off (E2K-25); the forbidden words are absent from comments too (section 3, E2K-25, E2K-50); the committed fixture texts hold no machine path (E2K-34 with the rules of `traces`, section 11.3) |
| Q7 | applicable | no secret in the kit; the environment is never printed or put into an error; the message holds `SAI_CHROME` (a path) only; E2K-50 searches secret shapes; `traces` runs on the new files |
| Q8 | not applicable | the kit handles no data of customers or spaces; it opens only pages of the test stands on 127.0.0.1; the isolation of tenants is tested by REQ-105 |
| Q9 | not applicable | no query of any kind |
| Q10 | applicable | Chrome missing, exiting, hanging, killed, answering with garbage, with an error, or not answering — each gives a named error and a clean state (section 7, E2K-09…E2K-16, SMK-04); every call has a time limit; a stderr pipe is drained; the runner stops its spec process group on a timeout and on its own signals — `SIGTERM`, `SIGINT`, `SIGHUP`, also during the preflight (E2K-33, E2K-38); the signal hooks are awaited with one limit, a throwing hook and a second signal do not stop the clean-up, a hook is removed when the run ends (4.4, E2K-39, E2K-32) |
| Q11 | applicable | `assertLoopbackUrl` inside `goto` (E2K-20/21) and the browser-level resolver rule (SMK-13); the check is made right before the navigation, not when a URL is saved; redirects out of 127.0.0.1 fail in the browser (F23) |
| Q12 | applicable | the departure from 0023 D2 is the record 0107 (read, not edited); the choices of section 2 are proposed for a record (О1–О9); no new dependency; no silent divergence from 0002 (Node 22, no runtime dependency, no development dependency added), 0004 (no file of the product is written by the kit) |
| Q13 | applicable | the traps found here (default dark scheme, orphan Chrome after a killed parent, unguarded protocol parse, the lone `prettier` on the root README, the unreachable address hang) are listed for DOC-UPDATER / ORCH in section 18 as candidates for `docs/anti-patterns.md` |
| Q14 | applicable | the statuses, `STATE.md`, the handoffs are DOC-UPDATER's and ORCH's, in the same run; the list of what becomes outdated is in section 18 |
| R1 | applicable | the push to `main` is not changed (0048, 0079); the temporary branch of criterion 10 is allowed by 0107 and is never `main`; this design pushed nothing |
| R2 | not applicable | the kit writes no Pixel Office event and starts no hook; the specs of REQ-106 own R2 |
| R3 | not applicable | the product with photos of people was dropped by decision 0033 |

---

## 18. What becomes outdated outside the project (for DOC-UPDATER and ORCH)

- `STATE.md` / `PLAN.md`: the check has six steps; the test-suite count and run time; the new files.
- `README.md` (root), the bullet **Checks** (about line 190): "formatting, linter, a trace check …, a check of the handoff records, and all tests" does not say that pages are opened in a real Chrome; and "(about 2 minutes)" in "Check on GitHub and before a push" was already not true on the tag (a full `npm test` alone took 235.8 s in F7) and is pinned by RD-2 (`repo.test.js` 1124), so a text change there needs a table row in the same step — a defect candidate for ORCH (О7 note), not a part of this design.
- `.claude/agents/test-runner.md`, item 3 "Stages" lists five stages; `CLAUDE.md` and `README.md` (line 170 / 53) already say "Pages are opened in a real Chrome" and need no edit.
- `docs/requirements.yaml`, **the pending REQ-040** (remark F15; found by `grep -n "npm run test" docs/requirements.yaml` on the working tree): the description (lines near 5500–5503) says the command `npm run facts` enters `npm run check` "before `npm run test` (like traces and handoffs-check: TC-20 and the check «check кончается на npm run test» pass without edit)", and its criterion 2 (line near 5566) says "в scripts.check tools/package.json шаг `npm run facts` перед `npm run test`, «||» нет; TC-20 и проверка «check кончается на npm run test» проходят без правки". After this work the end of `check` is `npm run test && npm run e2e`, so that sentence — "the check «check ends with npm run test» passes without edit" — is **false when REQ-040 is built** (the test HC-03 and CTL-13 no longer have that check; their new form is the end `npm run test && npm run e2e`). The same correction as for REQ-038 is needed (decisions/0108 О9, extended): DOC-UPDATER at step 10, or REQ-ANALYST by a micro-amendment of WF-01 because REQ-040 is `pending`; ORCH chooses. No change of REQ-104 code. Until it is corrected, the first design of REQ-040 must read its own criterion 2 against `scripts.check` of the tag it is built on.
- `docs/requirements.yaml`: the done REQ-038 states at line 5313 (criterion) and 5266–5268 (description) that "the check `check` ends with `npm run test`" passes **without edit**; this work edits that assertion (CTL-13, row 6) and the statement becomes false (AP-133; the check by `grep -n` of the old literal finds exactly these two places). REQ-014 criterion 3 ("a clean machine") and the pending REQ-033 criteria 1 and 2 conflict with the new step; both are left to the owner (the block, the gate and 0107 say so).
- Candidates for `docs/anti-patterns.md` (Q13): (1) a headless browser's colour scheme and window size follow the machine; (2) a spawned browser outlives its parent and leaves its own process group; (3) a protocol client must guard the parse of every incoming frame; (4) `prettier` is not run on files outside `tools/`; (5) a browser without a resolver rule can reach the network from a "local" test; (6) `AP-136`: this designer wrote Chrome profile folders and stand-in log folders into the system temporary folder during sketches (see `result.issues`).
- A list for CODE-DESIGN-VALIDATOR: when the validator repeats the sketches, run them with `TMPDIR` set to a folder of its scratch space so that the kit's `sai-e2e-*` folders stay out of the system temporary folder (AP-136); the kit honours `TMPDIR` (4.3).

---

## 19. Open questions (for ORCH; proposal: one record `decisions/0108-e2e-kit-conventions.md` with the section "Basis")

| # | Question | Default used by this design | Why it is a question |
|---|---|---|---|
| О1 | Who writes the starter of server processes (spawn `node …`, read the link from a stdout line, stop with `SIGTERM` and read the exit code, refuse a state folder outside the temporary root) that REQ-105, 106 and 107 each need? | Not in this kit. REQ-105 designs the first one in `tools/test/e2e/kit/stand.js` and the other two reuse it; REQ-104 provides `makeTempDir`, `removeTempDir`, `assertUnderTempRoot`. | A starter in REQ-104 would be code with no criterion and no test here (Q5); three copies would be waste. |
| О2 | Page code as strings only, or add `globals.browser` for `test/e2e/**` in `eslint.config.js` and accept functions? | Strings only (F9); `eslint.config.js` untouched. | It touches a file the requirement does not list and changes how the three page requirements write their specs. |
| О3 | Confirm the runner rules: stop at the first failing file; a hung file is ended after 120 s; a file with no test, or with `skipped`/`todo` above 0, fails. | As written in section 6. | They are beyond the letter of criteria 7 and 11 but follow Q4 and Q6; F11 shows the silent pass. |
| О4 | Remark M3 of the gate: the hash comparison of the blocks REQ-014 and REQ-033 against the tag `B` in criterion 13 turns red if the owner's answers about those two requirements land inside this run. | Keep their WF-01 runs after the release of this run. | A later amendment of those blocks would make RELEASE-VALIDATOR's command fail for a change that is not this work's. |
| О5 | Accept the extra flag `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1` (F23) as part of the argument list? | Yes. | It is beyond the ORCH sketch list of flags; it makes criterion 5 true for redirects, sub-resources and literal addresses; its Linux behaviour is read by the criterion-10 run. |
| О6 | The stand-in program `fake-chrome.js` is written by BACKEND-DEV (a stand), not by TEST-DESIGNER. | BACKEND-DEV, sub-step 3. | The REQ owner line gives the fault tests to TEST-DESIGNER; the kit's fault paths cannot be checked in sub-steps 3–4 without the stand-in. |
| О7 | (a) Accept the residual risk of section 7 row 16: a `SIGKILL` of the runner (for example the kill of a CI job at its time limit) leaves Chrome processes; no sweeper of old `sai-e2e-*` folders is added. (b) Branch C pre-decision: if the log of criterion 10 shows that Chrome on `ubuntu-24.04` does not start with its sandbox because the system restricts unprivileged user namespaces, may the fix be one step in `check.yml` that changes that system setting (a runner setting, not a Chrome flag)? Today branch C says BLOCKED with an owner question. (c) FYI, not for this run: the root README says "(about 2 minutes)" and RD-2 pins it. | (a) accept; (b) no default — this design pushed nothing and could not measure the runner, so only the owner can decide it in advance; (c) a defect candidate. | (a), (b): a decision for the owner and a record (Q12, quality-bar §1); (c): quality-bar §6 item 6. |
| О8 | Scope of the kit API: key presses (`press`), network records and response bodies, `reload`, a second tab (`newPage`) are not in the list "the kit can" of the description of REQ-104. Keep them? | Keep (C-7); tests SMK-09 and SMK-11. | REQ-105 criteria 2, 4, 5 and REQ-107 criterion 4 cannot be built without them; the REVIEWER may read them as work beyond the requirement. |
| О9 | AP-133: the done REQ-038 (criterion at line 5313, description at 5266–5268) says that the check of `team-web-control.test.js` "check ends with `npm run test`" passes without edit; this work edits it. The same sentence stands in the pending REQ-040 (lines near 5502 and 5566; remark F15; section 18). Micro-amendment by WF-01 in this run, or a defect? **Answered by `decisions/0108` О9 (extended): DOC-UPDATER at step 10 for REQ-038, and for REQ-040 DOC-UPDATER or a micro-amendment by REQ-ANALYST, ORCH chooses.** | Neither is in the write set of this design (`docs/requirements.yaml` is not mine); ORCH decides. | The status `done` of REQ-038 would claim more than the code does (AP-133); the proposed amendment: the words "and the end of `check` is `npm run test && npm run e2e`" (REQ-104). |

---

## 20. Sketch notes (for `result.prototype`)

Outside the project, in `<scratch>/e2e104/`: `clone/` and `clone2/` (fresh clones of the tag; `clone` holds the dummy kit files, `fake-chrome.js`, the `package.json` edit and the two README edits of F6/F7; `clone2` holds the new files only, F5); `sketch/lib.mjs` (a minimal launcher and protocol client written only to measure), `sketch/fake-chrome.mjs` (the 70-line stand-in), and the sketches `s1` (start, sizes, overflow, themes, click, console, SIGKILL mid-call), `s2`, `s3` (favicon and 404 lines, locale), `s4` (keys, typing, network, reload, tabs), `s5`, `s6`, `s7`, `s10`, `s11` (clean-up by group, orphans, handlers, cost per cycle), `s8` (confinement), `s9` (seven stand-in modes), `s12` (click with hit test). The Chrome processes of the sketches were stopped by their pids; the sketch folders `sai-e2e-*` and `fk-*` that were left in the system temporary folder (mine, 5 + 12 folders) and one stand-in process (pid noted by `ps`) were removed by name/pid at the end; `ps` and the folder list were empty afterwards.

Rework `01e`: one sketch in `<scratch>/e2e104e/` (a fresh clone of the tag; two spec files `fail.e2e.js` and `pass-a.e2e.js`, their captured TAP texts, the command `npm run -s traces` before and after the normalization of F34; one `node -e` call for F35). No Chrome was started; no process was left; the clone is removed at the end.

Rework `01c`: sketches in `<scratch>/e2e104c/` (a fresh clone of the tag; `sk/` holds the outer test for F1/F2, `runner-sim` and `runner-sim2` for F31, `noisy-parent` and `noisy-child` for F32; the fixture probes of F33 lie in the clone). Every process they started ended by itself or was checked with `pgrep` for the spec fixture names (none left); no Chrome was started in this rework; the clone is removed at the end.

---

## 21. As built (DOC-UPDATER, step 10, 2026-11-03; the design text above is not rewritten)

**Counts (read from the files and the runs of the run `E2E104-20261103-01`).**

- `tools/test/e2e-kit.test.js`: 52 tests (`grep -c '^test($' tools/test/e2e-kit.test.js` gives 52; it gave 50 at the end of the run `E2E104-20261103-01`): E2K-01…E2K-46 without a gap, then E2K-50, 51, 60, 61, and E2K-62, 63 (ISS-0103). The design listed 40.
- `tools/test/e2e/smoke.e2e.js`: 13 tests (SMK-01…SMK-13). Together 65 (63 before ISS-0103); the design said 53.
- `npm test` runs 2187 tests (the base tag had 2135: +50 kit tests with the run `E2E104-20261103-01` made 2185, +2 with ISS-0103; the six replaced guard tests keep their counts). `npm run e2e` runs 13.
- Fixtures: `tools/test/fixtures/e2e/` holds 10 spec fixtures (`specs/`: the nine of 11.3 and `exit-one.e2e.js`), 5 TAP texts (`tap/`) and `fake-chrome.js`.
- Mutants: the design listed 72 (M01…M72); TEST-DESIGNER applied 87 in its own harness (86 caught, 1 equivalent); the first gate of tests applied 82 of its own (9 survived, 2 of them real: R14, R15; fixed at step 5c); the repeat gate saw R14, R15 and K10 killed, found no change in the 36 others it re-ran, and called the 2 survivors left equivalent; RELEASE-VALIDATOR applied 23 of its own, 16 caught and 7 survived, none breaking a criterion (`docs/issues/ISS-0102`).
- Run: the whole `npm run check` takes 262 s on the main computer and 836 s on GitHub (Chrome 156 with the sandbox on; branch A of criterion 10; `.github` unchanged). The `e2e` step is about 17.5 s locally and 25.5 s on GitHub.

**Tests that the design does not list (added while building).**

| Id | What it proves | Why it appeared |
|---|---|---|
| E2K-19 | a peer that never answers the upgrade of the connection: `CALL_TIMEOUT` of `connect`, nothing left | R-F2 of the first review (the connect had no time limit); stand-in mode `no-upgrade` |
| E2K-26 | text that a page or the operator controls goes through `safeText` before it reaches a message | S-F2 of the first security review |
| E2K-27 | a path with a NUL, a too long name or a link loop is refused as `PATH_REFUSED`, not as a raw system error | S-F4 |
| E2K-28 | the page methods fail with named errors and change nothing they were not asked to (including `SCREENSHOT_FAILED`) | R-F5, R-F7 |
| E2K-29 | a group id that could hit more than one group (0, 1, negative, fractional, not a number) is refused by `signalGroup`; true for a live group | L1 and F3 of the second review |
| E2K-42 | what the runner prints is whole, on the right lines and safe to put in a log (argv, selection and `SAI_CHROME` text through `safeText`; the places-tried list stays whole) | F2 of the second security review |
| E2K-43 | a file that hangs after it started a browser leaves no process and no folder | S-F1, the registry of browsers |
| E2K-44 | the registry of browsers of the runner: written from the spec's own environment, swept after a spec, strict about what it trusts (shape of a record, a live folder directly under the temporary root; a nested folder is refused: T3 of the gate) | S-F1, F1 of the second security review |
| E2K-45 | a file that blocks its own event loop after it started a browser leaves no process and no folder | S-F1 |
| E2K-46 | see the row of 11.1 | gate 5b, T1 |

**Differences between the design and the built code** (the records: `decisions/0108` Addendum, `handoffs/E2E104-20261103-01/step-02-backend-dev.json`, `step-04b-code-fixer.json` I1, `step-04e-code-fixer.json` I3, `step-05-test-designer.json` I2).

1. After the load event `goto` and `reload` wait 100 ms (`LOAD_SETTLE_MS`); without it Chrome drops the favicon console line when a second navigation starts at once (lost in 1 of 8 starts; 20 of 20 with the wait). `decisions/0108` Addendum.
2. Stand-in program: new mode `ok-ignore-term` (for E2K-17, because `hang-ignore-term` prints no port line and no `Browser` can be built on it; E2K-11 uses `hang-ignore-term` for the start timeout), and `no-upgrade`; the modes `bad-json`, `error-object`, `no-answer` make `launchBrowser` itself reject, so E2K-13/14/15 use `cdp.connect` on the port line of the stand-in. Addendum; `step-04b` I1(b).
3. The argument list of Chrome has one more argument, `--no-proxy-server` (between `--disable-gpu` and the resolver rule), found by SECURITY-REVIEWER (F3): with a proxy on a loopback address foreign names get out although the resolver rule alone should confine the browser. E2K-25 compares the exact list. Section 4.6 step 3 and criterion 5 stay true; fact F23 should be read with it. Not shown in a real Chrome (see below).
4. Text from a page or the browser that goes into an error or a log line is escaped (control characters, a line start `::` of workflow commands) and bounded by `safeText`; `CONSOLE_ENTRIES` lists at most 20 + 20 entries and then `... and N more`. So the `E2eError.message` of `CONSOLE_ENTRIES` is shorter than in section 4.1. Addendum; `step-04b` I1(d).
5. The registry of browsers (sections 4.4 and 6 do not describe it): the runner puts the variable `SAI_E2E_REGISTRY` into the environment of every spec; `launchBrowser` writes a record `<pgid>.json` into that folder; the runner sweeps the registry after each spec, at stop and at exit, so that no process and no profile folder remain after a hung or blocked spec. The folder is read from the process environment of the spec, not from the `env` option (`step-04e` F1). A record is trusted only with a group id above 1, a file name of the form `<pgid>.json` and a profile folder directly under the temporary root that still exists. The residual risk O7 (a `SIGKILL` of the runner itself) is unchanged. `step-04b` I1(e); `step-04e` I3.
6. `signalGroup(pgid, signal)` of `cleanup.js` refuses a group id that is not an integer above 1 and returns whether it sent the signal; both raw group kills use it (`step-04e` L1, F3). The module `errors.js` no longer exports `ERROR_CODES` and `usage`.
7. `connect` of `cdp.js` also rejects with `CALL_TIMEOUT` (`connect: no answer in <ms> ms`) when the upgrade is not answered in `callTimeoutMs`; the `WAIT_TIMEOUT` text of `waitFor` may end with `; last protocol error: <message>`; a new code `SCREENSHOT_FAILED` (thrown when the file cannot be written); `PATH_REFUSED` has the new reason `not a usable path` (NUL, over-long name, link loop).
8. From the designer's list of differences (`step-05` I2): (a) `sleep-chrome.e2e.js` also reads `SAI_FIXTURE_BLOCK` (1 = block the event loop with `Atomics.wait`; used by E2K-45) and writes a mark `<pidfile>.term` in a `SIGTERM` handler (used by E2K-38 to tell an orderly stop from a kill); its key for the pid is `spec`, not `file`, because E2K-34 forbids the text `file:` in fixtures; (b) `hang-ignore-term` is used by E2K-11, not E2K-17 (see item 2); (c) SMK-13 has no proxy trial (Chrome on macOS takes proxies from the system, not from the environment, so no positive control can be made) — the flag is pinned by the exact list of E2K-25 only; (d) the text of E2K-50 in section 10 mentions a rule `://` that the row in 11.1 does not have: the test follows 11.1; (e) SMK-09 to SMK-12 sit under criteria 3 and 5.
9. `tools/test/e2e/kit/browser.js` still prints the raw path of the program from `SAI_CHROME` in `START_FAILED` (two places): `docs/issues/ISS-0100`.

**What is not proven (honest limits).**

- The effect of `--no-proxy-server` in a real Chrome is not shown; only the argument list is pinned (T5 of the gate, accepted).
- The order of several spec files (criterion 7) was checked on the real command with one spec file only (`smoke`); `E2K-32` pins the order with fixture files. The second real file comes with REQ-105 (`docs/issues/ISS-0102`, item 2). *Checked on two real files on 2026-11-15 by RELEASE-VALIDATOR of REQ-105 (`handoffs/E2E105-20261105-01/step-09-release-validator.json`, `self_check` «ORDER CHECK ON TWO REAL FILES»): `smoke picker` and `picker smoke` each exit 0 with the files in the given order and `e2e: browser=` once, `picker picker` exit 1 with `SELECTION_DUPLICATE`; item 2 of `ISS-0102` is met.*
- Seven mutants of the runner and the registry survive (equivalent or defence in depth): `docs/issues/ISS-0102`, item 1.
- The kit was run in a real Chrome 156 on the main computer and on the GitHub runner (Ubuntu 24.04, Chrome 156 with its sandbox on). It was not run on Windows (the full check never runs there, `docs/issues/ISS-0099`).

**Added by ISS-0103 (2026-11-03, run `ISS-0103-20261103-01`).** After the push of the first release the check on `main` was red once: E2K-18 saw the killed stand-in alive (GitHub run 41685488320, 2184 of 2185). The design said `SIGKILL` of the group is instant (fact F20); the call is, the death seen from another process is not, because a killed process stays a zombie until its parent reaps it and still answers `kill(pid, 0)`. The three places that checked once right after the end of the child (E2K-18, and the signal loop and the preflight loop of E2K-38) now wait with `waitGone` (limit 5000 ms); the kit code did not change. Tests E2K-62 (the helper, with a deterministic hold) and E2K-63 (the call sites) were added; the record is `docs/issues/ISS-0103-e2e-kit-e2k18-stand-in-alive-on-github-main-red.md` and `decisions/0108`, Addendum 2026-11-03 (ISS-0103). Not proved: the Linux state at the failure («zombie or just slow») was not measured on the runner; one green GitHub run (41701454358) is one sample.

**Added by REQ-107 (DOC-UPDATER, step 10 of run `E2E107-20261116-01`, 2026-11-16).** The kit got one more Chrome argument, `--use-mock-keychain`, right after `--no-first-run` (`tools/test/e2e/kit/browser.js`, one line; `decisions/0113` О1, О25), and `E2K-25` its exact list; nothing else of the kit changed (`git diff base/E2E107-20261116-01 -- tools/test/e2e/kit` shows only that line). The fourth real spec file, `tools/test/e2e/team-web.e2e.js`, made `E2K-41`, `E2K-50` and `E2K-60` read its budget, its files and its row; the kit file has 52 tests and 544 `assert.`. Not proven: the effect of the switch on Linux beyond the green files of two GitHub runs (43968701242, 43972314919). Details: `docs/design/REQ-107-e2e-team-web.md`, sections 4.5, 12 and 22.
