# REQ-110 — code design: one Node floor 22.23.4 for `tools/`, a refusal at every entry point, the hook rule and CI bound to the floor (fix of ISS-0092)

Run `ISS-0092-20261117-01`, WF-03 step 3 (the design of the fix, as WF-02 step 1). Base: the tag `base/ISS-0092-20261117-01` (commit 6c756cd). The block REQ-110 (eleven criteria) is not in the tag: it lies in the working tree of `docs/requirements.yaml` after its gate (`handoffs/ISS-0092-20261117-01/step-02d-req-validator.json`, PASS). Inputs read: the block REQ-110; the diagnosis `step-01-issue-fixer.json`; the gate passes `step-02b` (F1–F8) and `step-02d` (G1–G7); `decisions/0101` with its Addition, `decisions/0002`, `decisions/0119` (О1–О14); `docs/issues/ISS-0092-node-22-21-1-behind-security-releases.md`.

This file holds shapes, signatures, tables, exact texts and command lines. It holds no implementation code. Every statement about how the code behaves today or after the fix was measured on fresh clones of the tag outside the project, with simulated Node versions only (section 1); the sketch is named in the handoff (`result.prototype`). The open questions of the first pass (О1–О9) are answered by `decisions/0120` (section 18).

**Rework of step 03c** (rework for FAIL `handoffs/ISS-0092-20261117-01/step-03b-code-design-validator.json`, gate pass 1 of 3: findings F1–F5 Medium, L1–L5 Low; `decisions/0120` О10–О16). Every finding is closed in place; section 19 lists each finding with the changed places and its measurement on a new sketch (a fresh clone of the tag, 2026-11-18, 06:49–07:05 UTC). The block REQ-110 read is the amended one (criterion 6 by `decisions/0120` О2).

---

## 0. Summary

- **One rule, one module.** A new pure module `tools/src/node-floor.js` holds the only JavaScript copy of the floor (`NODE_FLOOR = "22.23.4"`), the rule `meetsNodeFloor(version)`, the refusal line `nodeFloorRefusal(version)`, the guard `refuseBelowNodeFloor(stderr, version)` and the shared exit code `NODE_REFUSAL_EXIT = 2`. Versions are three whole numbers compared as numbers; malformed and pre-release texts are refused.
- **Every entry point calls the guard first.** Eleven Node programs (the ten files of the `node <file>` scripts and `office-report.js`): the guard is the first statement of the program's work, right after the help branch where the program has a help (criterion 11), before any read of the environment, the disk or the network. Pixel Office ends with code 1, every other entry point with code 2. `prettier`, `eslint` and `node --test` are not guarded (`decisions/0119` О5); `npm run check` meets its first guard at `npm run traces` (section 7).
- **The refusal line** (one line on stderr, the same for every entry point): «Нужен Node 22 не ниже 22.23.4, а запущен 22.21.1: команда остановлена, ничего не записано. Подробности — tools/README.md, раздел «Check».» (the running version in place of 22.21.1).
- **The hook** (`hook.sh`) holds the floor as one line `node_floor=22.23.4`, asks every candidate its `--version` with stdin closed, takes only a version at or above the floor with the floor's major, and skips any other for the next candidate in the order node-path, `PATH`, `SAI_NODE_FALLBACKS`; with none left it ends quietly with code 0 and the event is lost. It has no timer of its own for a `--version` that does not answer; README line 207 says so next to the hook's limit (`decisions/0120` О4, О12).
- **One source, one equality test.** `engines` of `tools/package.json` is the source; `tools/test/node-floor.test.js` checks that the lockfile root, the module, the hook line and every bordered `22.<n>.<n>` text of the walked files state the same floor (two named history mentions of 22.21.1 excepted) and that the named README and pre-push lines name it.
- **CI.** `check.yml` gets `check-latest: true` under `node-version: "22"`; CI-3 asserts it and the exact engines of both files; the runtime guards make a stale runner red at `npm run traces`.
- **Tests.** One new file (`node-floor.test.js`, NF-01…NF-09; NF-05 starts every one of the 14 `node <file>` scripts and 6 second commands, 21 rows), new rows in `pixel-office-server.test.js` (SV-39 renamed and widened, its in-process rows with a stdout trap and a time limit; SV-68 new), `pixel-office-hook.test.js` (HK-32…HK-37 new) and `repo.test.js` (CI-3 renamed with a new rule, CI-8 with seven new damaged copies). No test is removed; two titles are renamed (section 11).
- **Size.** Code: 1 new module (54 lines on the sketch), 11 entry files (2–13 lines each), `hook.sh` (+about 40 lines), 2 engines lines, 1 line of `check.yml`; documents: 4 lines of `tools/README.md`, 1 line of `.githooks/pre-push`. Measured on the sketch: 17 changed files and 1 new module for the fix (`git diff --stat -- . ':!tools/test'`: 16 files, 89 insertions, 29 deletions, plus `tools/test/e2e/run.js`).

## 1. Checked facts (2026-11-18, 04:48–05:37 UTC, fresh clones of the tag outside the project)

Every start of a program of `tools/` ran as a child with a private `HOME`, `TMPDIR`, Pixel Office state folder (`SAI_PIXEL_OFFICE_DIR`) and team home (`SAI_TEAM_HOME`) inside the work folder; servers on 127.0.0.1 port 0 only; the hook only with stub nodes; the Node version simulated by a preload (`node --import <preload>`) that replaces `process.versions.node` and `process.version` with the value of a variable; no old Node installed. The five files of the real Pixel Office state folder had the same sha256 before the first trial and after the last (the handoff, `self_check`).

| # | Fact | Command (shape) | Output |
|---|---|---|---|
| F1 | The preload takes effect, also for an ESM entry, by `--import` and by `NODE_OPTIONS`; both properties are `configurable: true`, `writable: false` | `node -e` descriptors; `SIM_NODE_VERSION=<v> node --import <preload> -e 'console.log([process.versions.node, process.version])'` for 22.21.1, 22.23.3, 21.7.0, `x`, empty; an ESM probe file | `["22.21.1","v22.21.1"]` … `["","v"]`; without the variable `22.23.4 v22.23.4`; «esm entry sees 22.21.1» both ways |
| F2 | On the tag no entry point refuses a simulated 22.21.1 or 22.23.3; Pixel Office writes its state | harness `entries.mjs <tag tools> run 22.21.1 22.23.3 real` (12 rows: section 9.2) | every row as under the real Node: `validate` 2 E_USAGE; pixel-office 0 (link, state written); note 1 «сервер не запущен»; team 0; team-web 0 (link); traces, handoffs-check, handoff 2 E_TRACE_NOT_GIT; picker check 2; picker serve 0 (link); e2e 1 SELECTION_UNKNOWN; office-report 1; refusal rule false in all 36 |
| F3 | On the tag `--help` ends with code 0 under 22.21.1 and 22.23.3 with the same stdout as under the real Node, writes nothing; `cli.js`, `team/cli.js`, `web/main.js`, `office-report.js` answer `--help` with code 2, the e2e runner with code 1 | `entries.mjs … help real 22.21.1 22.23.3`; the five others with `--help` | stdout sha256 equal per file (`d80a1247…`, `fddcaf2e…`, `a59afba5…`, `6d545028…`, `f05b9bdb…`, `22d9ef4c…`) |
| F4 | On the tag the hook runs hook.js on any node-path version, on a PATH or fallback v22.x below the floor, and node-path v22.21.1 wins over PATH v22.23.4 | harness `hook.mjs <tag hook.sh>`, 39 rows (section 9.4) | every row of criterion 4 (a) «RAN»; `np v22.21.1 + PATH v22.23.4` → np RAN; rule rows: every `v22.*` ran (also `v22.23`, `v22.23.4.1`, `v22.24.0-pre`, `v22.023.4`) |
| F5 | On the sketch every entry point refuses 22.21.1 and 22.23.3: code 2 (Pixel Office 1), empty stdout, exactly the refusal line, nothing written (home, TMPDIR, state, team home, working folder by sha256); under a simulated 22.23.4 and the real Node every row is as on the tag | `entries.mjs <sketch tools> run 22.21.1 22.23.3 22.23.4 real` | 24 refused rows `rule=true wr=false`, 54–85 ms; 24 others as F2 |
| F6 | On the sketch `--help` rows are byte-equal to the tag's | `entries.mjs … help real 22.21.1 22.23.3`; diff with F3 | «help: tag and trial identical» |
| F7 | On the sketch the hook rows of criteria 2 and 4 hold under `/bin/sh` (macOS) and `/bin/dash` | `hook.mjs <sketch hook.sh>`; `TRIAL_SH=/bin/dash` | 39 rows, 0 differences sh vs dash; all code 0, quiet, state unchanged; hook.js started only by v22.23.4, v22.23.10, v22.24.0, v22.100.0 candidates; slowest row 745 ms (two new stub scripts; a real `node --version` takes 0.01 s) |
| F8 | A copy of the sketch hook with `node_floor=22.23.5` skips a v22.23.4 candidate and takes v22.23.10 | `hook.mjs <copy>` | `r "v22.23.4" path:-`, `r "v22.23.10" path:RAN` |
| F9 | The header canary on the sketch (Node 22.23.4): 2 500 lines in all (a head of 12 550 bytes with target `/`) → 431 and closed; 1 000 → as a normal request; 1 001 → 431; the normal `GET /` after the probe → the status before it; the state folder listing unchanged | `headers.mjs <sketch tools>` (pixel, web, picker as children on port 0) | pixel 200/431/200/431/200; web 200/431/200/431/200; picker 404/431/404/431/404; state same; stop code 0 |
| F10 | Header mutants set at listen time: `maxHeadersCount = 0` and `= 6000` let 2 500 lines in on all three servers; `= 200` (B1) answers the 1 000-line twin 431 | `header-mutants.sh <mutant copy>` | 0: 200/200; 6000: 200/200; 200: 431/431 (picker 404/404, 404/404, 431/431); files restored, sha256 equal |
| F11 | The guard tests of earlier requirements on the sketch with the code edits only: `repo.test.js` 24/26 (CI-3, CI-8 red); green: server 72/72, hook 50/50, page 114/114, picker-config 35/35, team-deps 2/2, traces-runtime 6/6, handoffs-runtime 9/9, docs 9/9, settings 7/7, traces-readme 7/7, office 61/61, note 7/7, team-web-guard 7/7, team-web-docs 3/3, handoffs-cli 19/19, handoffs-cmd-docs 9/9, handoffs-docs 5/5, cli 13/13, team-docs 5/5, traces-check 29/29, team-faults 15/15, team-security 6/6, team-web-server 10/10, team-engine-budget 4/4, picker-server 47/47, handoffs-cmd-new 10/10, handoffs-cmd-close 8/8, e2e-stand 22/22; `e2e-kit.test.js` E2K-01/02/03/09/40/50/60/61 8/8; `team-web-control.test.js` CTL-1c, CTL-5a 2/2 | `node --test <file>` one at a time, private HOME and TMPDIR | as listed, `# fail 0` except repo |
| F12 | The sketch of the CI-3/CI-8 replacement: 26/26; the sketch of NF-01, NF-02, NF-03, NF-06: green on the sketch, red on the tag's files (7 findings, section 5.5) | `node --test test/repo.test.js`, `test/node-floor.test.js` | 26/26; 4/4; tag: 2 of 4 red |
| F13 | An in-process `main()` of Pixel Office that is not refused never returns (it waits for a signal): the tag's in-process row 22.21.1 hung until a 30 s hard limit killed it | `limited.mjs 30000 … node --test --test-name-pattern 'SV-39 hang probe'` | `{"signal":"SIGKILL","killed_by_limit":true,"ms":30006}`; no server left |
| F14 | prettier 3.9.9 and eslint 10.11.0 both call `module.enableCompileCache()` (read: `prettier/bin/prettier.cjs:61-62`, `eslint/bin/eslint.js:15`) and write Node's compile cache under `TMPDIR` on every run, also `prettier --check` | scratch package, private HOME and TMPDIR | legacy `--check`: 5 files under `<TMPDIR>/node-compile-cache/`; eslint: 211 |
| F15 | Writing options measured: prettier `--cache` → `node_modules/.cache/prettier/.prettier-cache` in the folder; prettier `--experimental-cli` → `<TMPDIR>/prettier/.prettier-caches/<hash>.json` (its cache is on by default); eslint `--suppress-all` and `--prune-suppressions` → `eslint-suppressions.json`; eslint `-o r.txt` → `r.txt` | scratch package | as listed |
| F16 | Read in the option tables (not run: they download and start programs): eslint `--init` runs `npm init @eslint/config@latest` (`bin/eslint.js:168-175`), `--mcp` runs `npx @eslint/mcp@latest` (`:179-185`), `--inspect-config` runs `npx @eslint/config-inspector@latest` (`lib/cli.js`); `--fix-type` needs `--fix` or `--fix-dry-run` (`lib/cli.js:301`); prettier `--cache-strategy` needs `--cache` (`legacy-cli.mjs:7017`) | `grep` and `sed` of the files | as listed |
| F17 | The literal commands of criteria 1 and 9: tag — engines 0 and 0; (a) no line, 1; (b) 2 and 0; (c) 0 and 0; (d) 0; (e) 0; (g) 0. Sketch — 1 and 1; (a) line 9, 0; (b) 0, 1, «4780» 1; (c) 1 and 1; (d) 1; (e) 4; (g) 1; (f) the M7 line sha256 `822cd4d1…` on the tag, the sketch and `git show base/…` | `crit9.sh <clone>` | as listed |
| F18 | The trace check on the sketch | `node src/traces/cli.js` in the sketch | «файлов проверено 2563, следов 0, пропущено 67», exit 0 |
| F19 | The sub-steps of section 12 one after another on a fresh clone: only S4 (engines) turns CI-3 and CI-8 red; S1, S2, S3, S5, S6 turn nothing red | `steps.sh` | section 12 |
| F20 | `note.js` with `SAI_PIXEL_OFFICE_STORE_TEXT=0` under a simulated 22.21.1: the tag ends 0 «хранение текста отключено»; the sketch refuses with 2; the sketch with its guard moved after the storage switch (M35) ends 0 | one child per copy, private folders | as listed; the state folder stays empty |

Facts of the rework 03c (2026-11-18, 06:49–07:05 UTC; a new sketch on a fresh clone of the tag with the final texts of section 8, and a mutant copy of it):

| # | Fact | Command (shape) | Output |
|---|---|---|---|
| F21 | The 21 rows of NF-05 (9.2) on the tag under a simulated 22.21.1: none refuses, only `pixel-office` writes (into its test state folder); `prepare-run`, `validate`, `apply-verdict`, `snapshot` with `--root <working folder>` and `snapshot-diff` with no argument end 2 E_USAGE; `team project 01-alpha` ends 1 E_NOT_FOUND; `traces hash-line`, `handoffs-check --emit-exceptions` and `handoff new` (all keys, invented values) end 2 E_TRACE_NOT_GIT; nothing written. On the sketch every row refuses under 22.21.1 and 22.23.3 (21 of 21 each: code 2, Pixel Office 1, stdout empty, the refusal line, nothing written); under 22.23.4 and the real Node the codes are the tag's | `entries.mjs <tag or sketch tools> run …` | as listed |
| F22 | The hook rows with another major at or above the floor's minor and patch (`v23.24.0`, `v24.23.4`, `v21.24.0`, `v23.23.4`, `v21.23.4`): refused on the sketch and on the tag (the tag takes `v22.*` only); 44 hook rows on the sketch, all code 0, quiet, state unchanged, slowest 515 ms | `hook.mjs` | as listed |
| F23 | SV-39 with the stdout trap (an `out` whose `write` throws) and a 10 s limit: the sketch's five in-process rows and three child rows green; the mutant C05 (the guard ignores the seam) makes the in-process row 21.7.0 red at once with «stderr is not the refusal line» and `main` returns (its server is closed by its own catch of the failed link write), where the validator's run of the first form hung 45 s | `node --test --test-name-pattern 'SV-39 sketch' test/pixel-office-server.test.js` on the sketch and with C05 | twin 1/1 in 358 ms; C05 1 fail, no hang |
| F24 | NF-09 (README lines 157 and 207 equal to the texts of section 8): green on the sketch; red for the H1 form of 157, a 207 with «finds Node 22 (floor 22.23.4)» in place of «takes only…», a 207 without the hang sentence | sketch `NF-09` and mutants D01–D03 | as listed |
| F25 | The sign ban: five forms that only it catches (section 7) are red with it and green without it (mutant N01); its three twins green; its three forms of accepted strictness red | sketch `NF-06` | as listed |
| F26 | The guard with a writer that throws returns true and does not throw; at the floor it never calls the writer; the mutant V06 (no try/catch) throws | sketch `NF-04` | «Got unwanted exception: row throwing writer: the guard throws» under V06 |
| F27 | The picker's own header limit is `MAX_HEADER_BYTES = 16384` (`tools/src/picker/config.js:20`, used as `maxHeaderSize` at `tools/src/picker/server.js:432`); the 2 500-line probe head (12 550 bytes) is under it; with the constant lowered to 8 192 (mutant P01) the head check of NF-07 is red, while the status alone (431 by size) would not tell | `headers.mjs` (the constant read as text) | `head_under_limits` true; P01 false |
| F28 | 49 mutants applied one at a time on the mutant copy, all caught, every file restored by sha256: M01–M34, the validator's V06, V07, K04, N01, C01, C02, C05, and the new C03, C04, C06, C07, D01–D03, P01 (M35 and M38 were measured in the first pass, F20); the earlier guard tests after the replacement table green on the sketch (section 11) | `mutants.mjs` with `MUT_DIR` the mutant copy; `named.py` for the named rows and their twins | section 13 |

Not measured by this design, and why: `npm run check` end to end under a simulated 22.21.1 (the command was denied by the permission check of the session at about 05:13Z in step 03 and was not tried another way; handoff of step 03, issue I1). The gate measured it at step 03b (its `self_check` and issue I5): with sentinel scripts for `test` and `e2e`, under simulated 22.21.1 and 22.23.3 the chain runs `format:check` and `lint` and stops at `npm run traces` with the refusal line, exit 2, no sentinel reached; the real-Node twin passes `traces` and `handoffs-check` and reaches the test sentinel. Also not measured: the e2e spec `pixel-office.e2e.js` (needs a real Chrome; it gives the hook the running Node as node-path, which meets the floor, and its limit `HOOK_LIMIT_MS` is 10 000 ms, `tools/test/e2e/pixel-office.e2e.js:39`); the behaviour of `check-latest: true` on GitHub (no push at this step); eslint `--cache` (its file was not written in the scratch package, whose flat config matched no file; the option table says «Only check changed files»).

## 2. The version rule — `tools/src/node-floor.js` (new, BACKEND-DEV)

A pure ES module: no import, no read of the disk or the environment; the guard reads `process.versions.node` only as the default of its second argument. It holds no word `child_process`, `node:`, no network word and no word of the bans of `tools/src/web/`, `tools/src/team/`, `tools/src/picker/` and `public/` (WEB-9d, CTL-1c, CTL-5a, WEB-14, TM-49, PK-6e, PK-7a, PK-7c, PG-20, TR-4b, TR-4c; F11).

| Export | Shape | Contract |
|---|---|---|
| `NODE_FLOOR` | string `"22.23.4"` | the only JavaScript text of the floor; equal to the floor of `engines` (NF-01) |
| `NODE_REFUSAL_EXIT` | number `2` | the exit code of a refusal of every entry point but the Pixel Office server (which keeps 1, `decisions/0119` О7) |
| `meetsNodeFloor(version)` | `(unknown) → boolean` | true only for a string of three parts joined by dots, each `0` or 1–9 digits with no leading zero (`(0\|[1-9][0-9]{0,8})`, the whole text anchored), whose major equals the floor's major and whose (minor, patch) is at or above the floor's, compared as numbers; everything else false: another major, a lower 22.x, two or four parts, a letter, a sign, a space, a pre-release suffix, a leading zero, a part of ten digits or more, an empty text, a non-string. If `NODE_FLOOR` itself were malformed, every version is false (fail closed) |
| `nodeFloorRefusal(version)` | `(unknown) → string` | the refusal line without the line end (below); the version is shown as given when it matches `^[0-9A-Za-z.+-]{1,64}$`, else as «неизвестная версия», so the line is always one line and holds no control character |
| `refuseBelowNodeFloor(stderr, version = process.versions.node)` | `({ write(text) }, unknown) → boolean` | false when `meetsNodeFloor(version)`, and then `stderr` is not touched; else writes the refusal line and `"\n"` to `stderr` in one `write` (a throwing `write` is swallowed: the guard returns true and does not throw, the exit code still says it; NF-04, L2) and returns true. The caller stops at once with its exit code |

The rule table (the rows of criterion 2 and the design rows; all measured in NF-03's sketch, F12, and in the rework sketch, F28):

| Refused | Why |
|---|---|
| `21.7.0`, `23.0.0`, `24.11.0`, `25.2.1` | another major (the upper bound is the next major) |
| `23.24.0`, `24.23.4`, `23.23.4`, `21.24.0`, `21.23.4` | another major above or below 22 whose (minor, patch) is at or above the floor's (F2): only the rule «the major equals the floor's» refuses them; a rule that asks only «the major is at least the floor's» (mutant V07) or compares the major with `-ge` in the hook (K04) takes `23.24.0` and `24.23.4` |
| `22.0.0`, `22.3.0`, `22.21.1`, `22.22.0`, `22.23.0`, `22.23.3` | below the floor, compared as numbers (`22.3.0` is below although `"22.3.0" >= "22.23.4"` as text) |
| `22.23`, `22.23.4.1`, `22.23.x`, `22.24.0-pre`, `x`, `""` | not three whole numbers (criterion 2) |
| `022.23.4`, `22.023.4`, `" 22.23.4"`, `"22.23.4\n"`, `2222222222.0.0`, `undefined`, `null`, the number `22.234` | design rows: a leading zero (semver forbids it), a space or a line end, a part over nine digits (the limit of the hook's shell numbers, kept equal in both rules), not a string |

| Accepted | |
|---|---|
| `22.23.4`, `22.23.10`, `22.24.0`, `22.100.0` | at or above the floor, below 23; `22.100.0` proves numeric comparison |

**The refusal line** (exact words; the version in place of `<версия>`):

    Нужен Node 22 не ниже 22.23.4, а запущен <версия>: команда остановлена, ничего не записано. Подробности — tools/README.md, раздел «Check».

The `22` and `22.23.4` of the line come from `NODE_FLOOR` (no second literal). It is Russian (Cyrillic letters), one line, holds the running version and the floor, no stack line (`^\s+at `), and no value but versions (Q7). «раздел «Check»» names the heading `## Check` of `tools/README.md` (ST-06 pins it).

## 3. Entry points — where the guard is called

Rule: the guard is the first statement of the program's work — in the function the program part calls (`main`, `run`, `runReport`), after the help branch where the program has a help (criterion 11: `--help` writes nothing and is answered on any Node), before any read of the environment, the disk, git or the network, and before any server, child or browser is started. Argument parsing that comes before the help branch today (pure, writes nothing) stays before it (`decisions/0120` О5). The list of files equals the `node <file>` scripts of `tools/package.json` (14 scripts, 10 files; F2) and `office-report.js` (`decisions/0119` О5).

**What is a `node <file>` script (L5).** A script of `tools/package.json` whose whole text matches `^node ([^\s-][^\s]*)(?: (.*))?$`: the word `node`, one space, a path that does not begin with `-`, and optionally a space and arguments; the file is the first group, the arguments the second. `node --test "test/**/*.test.js"` (the script `test`) is not one (its second word begins with `-`). NF-05 also asserts that every script whose first word is `node` is either a `node <file>` script or exactly the `test` script above, so a script with a key before the file (`node --import x src/a.js`) is red instead of silently uncounted. Today: 14 scripts, 10 files (F2).

**One guard covers every command of a file.** In E1, E4, E6, E7, E8 and E9 one program serves several commands (the five WF-06 scripts of E1; the team commands of E4; `check`, `add` and `hash-line` of E6; the plain run and `--emit-exceptions` of E7; `new` and `close` of E8; `check` and `serve` of E9). The guard stands before the dispatch to a command, never inside one command; NF-05 starts every script and a second command of each such program (9.2), so a guard put inside one command is red (mutants C01–C04, C06, C07, M33; F1).

| # | File | Scripts | Place of the call | Code | Help before the guard |
|---|---|---|---|---|---|
| E1 | `tools/src/cli.js` | prepare-run, validate, apply-verdict, snapshot, snapshot-diff | first statement of `main(argv)`, before the command lookup (so before every one of the five commands) | 2 | no help (F3) |
| E2 | `tools/src/pixel-office/main.js` | pixel-office | in `run()`, in place of today's check at lines 182–188 (after the help branch at 177–180, before `resolveStateDir`); the seam `io.nodeVersion` stays: `version = io.nodeVersion ?? process.versions.node` | 1 | yes |
| E3 | `tools/src/pixel-office/note.js` | pixel-office-note | in `main(argv, io)`, right after the help branch (before `storeTextEnabled`, `resolveStateDir`, the read of `port` and `write-secret` and the request) | 2 | yes |
| E4 | `tools/src/team/cli.js` | team | first statement of `main(argv, env, io)`, before `runGuarded` and `parseArgs` | 2 | no help |
| E5 | `tools/src/web/main.js` | team-web | first statement of `run(argv, env, io)`, before `parseArgs`, `resolveHome`, `readConfig` | 2 | no help |
| E6 | `tools/src/traces/cli.js` | traces | in `main(argv)`, right after the help branch, before `repoRoot` | 2 | yes |
| E7 | `tools/src/handoffs/cli.js` | handoffs-check | in `main(argv)`, right after the help branch, before `checkHandoffs` | 2 | yes |
| E8 | `tools/src/handoffs/handoff.js` | handoff | in `main(argv)`, right after the help branch, before the choice between `newHandoff` and `closeHandoff` (so before both) | 2 | yes |
| E9 | `tools/src/picker/cli.js` | picker (check, serve) | in `run(argv)`, right after the `--help` line, before the usage checks and the dispatch; the picker returns `{ exitCode: NODE_REFUSAL_EXIT, stdout: [], stderr: [nodeFloorRefusal(version)] }` through its `emit` (it uses `meetsNodeFloor` and `nodeFloorRefusal`, so `tools/src/picker/cli.js` gains no `node:` word and no module: PK-7c, PK-6e) | 2 | yes |
| E10 | `tools/test/e2e/run.js` | e2e | before `runAll`: the exit code is the refusal code when the guard refuses, else the code of `runAll`; the kit is loaded by the static import before the guard and writes nothing at load (F5: TMPDIR unchanged) | 2 | no help (its `--help` is a spec name, F3) |
| E11 | `tools/src/pixel-office/public/office-report.js` | (none; the UAT report of REQ-001, design 3.8) | first statement of `runReport(argv, io, nowFn)`, before `parseArgs`; it imports `../../node-floor.js` (PG-20 accepts a relative import that exists; F11) | 2 | no help |

Imports (relative only, E2K-02 and TM-49): E1 `./node-floor.js`; E2–E8 `../node-floor.js`; E9 `../node-floor.js`; E10 `../../src/node-floor.js`; E11 `../../node-floor.js`. In-process callers of E3, E4, E5, E11 and E2 (tests) run under the real Node, which meets the floor while CI does (criterion 8); measured green (F11).

The protection stands in the same process and the same function as the action it protects, as its first statement: there is no separate check run before the command and no state kept between a check and the act. Shared contract changes and their users: the new module (users E1–E11); the seam `io.nodeVersion` of `main.js` keeps its contract (users: SV-39); `ciFindings` of `repo.test.js` gains a third argument (users: `ciOwn`, CI-8); the exit code of `test/e2e/run.js` gains the value 2 (users: `npm run e2e`, the last step of `npm run check`, which stops on any non-zero code).

`hook.sh` (section 4) keeps code 0 by criterion 4 and is not one of «every other entry point» of the code 2 (G6). `tools/src/pixel-office/hook.js` gets no check of its own: `hook.sh` decides, and a second check would cost the hook a second start of nothing (REQ-001 criterion 15: quick and quiet).

**The refusal code and the documented exit-code lists (G6).** Code 2 is the documented code of «an error of the call or of the environment, or an incomplete check» where the lists name one: `traces` (USAGE line «2 — ошибка или неполная проверка», `cli.js:3-4`), `handoffs-check` (the same, `cli.js:3-4`, README line 568), `handoff` («2 — ошибка вызова или окружения», `args.js:56`, `handoff.js:3-4`, README line 608). Code 1 would read «a trace / a violation was found» there. The lists whose words do not cover a refused Node are named in section 16 with their places and go to the follow-up LOW defect (`decisions/0120` О1); README line 9 states the rule once for every command (section 8).

## 4. The hook rule — `tools/src/pixel-office/hook.sh` (CODE-FIXER)

Shape of the changed script (no code here; the sketch measured it, F4, F7, F8):

| Element | Contract |
|---|---|
| The floor line | exactly one line `node_floor=22.23.4` at the top level, before the candidates; the only text of the floor in the script's logic; read by NF-01 as text and proved effective by HK-37 |
| `split3 <text>` | sets `n1 n2 n3` to the three parts of `<major>.<minor>.<patch>` and returns 0, or returns 1 for any other text: an empty text, a character other than digits and dots, fewer or more than three parts, an empty part, a part with a leading zero, a part of ten characters or more — the same shape as `meetsNodeFloor` |
| `node_ok <binary>` | runs `<binary> --version` once with stdin from `/dev/null` and stderr to `/dev/null`; returns 1 when it ends with a code other than 0, when its output does not start with `v`, when `split3` of the floor or of the output without `v` fails, when the major differs from the floor's, or when (minor, patch) is below the floor's, compared with `-eq`, `-gt`, `-ge` of `[` (numbers, not text); else 0. It prints nothing |
| Candidate 1 — node-path | the first line of `$dir/node-path`: used when it is non-empty, a regular executable file and `node_ok` passes; else the next candidate (today it is executed with no check, F4) |
| Candidate 2 — PATH | `command -v node`: used when executable and `node_ok` passes |
| Candidate 3 — fallbacks | each folder of `SAI_NODE_FALLBACKS` (default unchanged: the two Homebrew node@22 folders), `<folder>/node` executable and `node_ok` |
| None left | `exit 0` with no output: the event is lost and never written later (R2) |
| Comments | lines 2–5, 30 and 51 of the tag name the floor and the skip rule instead of «Node 22» (they are walked by NF-01: any `22.<n>.<n>` in them equals the floor) |

Why stdin is closed for `--version`: Claude Code gives the event on the hook's stdin, and a candidate's `--version` that read stdin would take the event from the candidate that runs `hook.js` after it (measured: the mutant without `</dev/null` gives the PATH candidate an empty stdin, F-mutant M22, section 13). The limit of a candidate whose `--version` hangs is named in section 17 and stated in README line 207 next to the hook's limit, in the exact words of section 8 (`decisions/0120` О4, О12; F4).

The major is compared for equality (`-eq`), not «at least» (`-ge`): `v23.24.0` and `v24.23.4` are refused by that alone (HK-35 rows of F2; mutant K04).

Timing: one more `--version` per event (node-path is now asked too); a real `node --version` takes about 0.01 s (F7); the stub rows take 0.3–0.75 s each because every stub is a new shell script; criterion 4 asks 2 s per row.

## 5. The single source of the floor and the equality test (criterion 1)

### 5.1 Sources

`engines.node` of `tools/package.json` is the one source (`decisions/0119` О1). Every other place that states the floor is checked equal to it by NF-01:

| Place | How NF-01 reads it |
|---|---|
| `tools/package-lock.json` `packages[""].engines.node` | equal to `engines.node` byte for byte |
| `engines.node` itself | matches `^>=(\d+)\.(\d+)\.(\d+) <(\d+)$`; its floor equals `NODE_FLOOR` imported from `tools/src/node-floor.js` (read from the rule, not a copy in the test); the upper bound is the floor's major + 1 |
| `hook.sh` | exactly one line matching `^node_floor=` and it is `node_floor=<NODE_FLOOR>` (G1: a floor written in another form — two numbers, a second line — is red, measured row «hook floor in two numbers»); HK-37 proves this line is what the rule uses |
| the walked files | every bordered `22.<n>.<n>` text equals `NODE_FLOOR` (5.2) |
| the named lines | each holds the floor (5.3) |

### 5.2 The walk

Files: every file under `tools/src` (code, comments, data, `hook.sh`, `public/`), `tools/README.md`, `.githooks/pre-push`, `.github/workflows/check.yml`. Read as UTF-8 text, line by line.

Pattern with borders (G4): `22.<digits>.<digits>` not preceded by a digit or by «a digit and a dot», and not followed by a digit or by «a dot and a digit» — the exact pattern `/(?<!\d)(?<!\d\.)22\.(\d+)\.(\d+)(?!\d)(?!\.\d)/gu`. So `v22.23.4`, `(22.23.4,`, `22.23.4.` at the end of a sentence and `22.23.4-pre` are hits; `122.23.3`, `1.22.23.3` and `22.23.3.9` are not (measured, F12).

The two history mentions of 22.21.1 (each must be found exactly once, so neither the list nor the lines can drift silently):

| File | The line starts with (after leading spaces) | Value |
|---|---|---|
| `tools/README.md` | `**A consequence of the rule M7.**` (line 176 of the tag, DC-01) | 22.21.1 |
| `tools/src/util.js` | ``// No `encoding` in these options, on purpose`` (line 299 of the tag) | 22.21.1 |

Every other hit must equal `NODE_FLOOR`. On the sketch 9 floor texts are seen (README 9 twice, 36, 157, 207, pre-push, the hook comment, the hook line, the module).

### 5.3 The named lines (presence; they make criterion 9's lines a test as well)

| File | The one line that holds | Must also hold |
|---|---|---|
| `tools/README.md` | `The one check command (quality-bar Q4)` (line 9) | the floor and the engines text in backticks, `` `>=22.23.4 <23` `` |
| `tools/README.md` | `The default port is` (line 36) | the floor |
| `tools/README.md` | ``The second variable is `SAI_NODE_FALLBACKS` `` (line 157) | the floor |
| `tools/README.md` | ``The command starts `tools/src/pixel-office/hook.sh` `` (line 207) | the floor |
| `.githooks/pre-push` | `не найден npm` (line 32) | the floor |

Each anchor must stand on exactly one line. Presence alone lets a line keep its old words and put the floor in brackets (the gate's H1 form, `decisions/0120` О10), so lines 157 and 207 are pinned whole by NF-09 (9.1, section 8, criterion 9 (c) and (d); `decisions/0120` О14).

### 5.4 Shape of the check

A pure function `floorFindings({ texts: Map<path, text>, floor, engines, lock }) → { out: string[], seen: number }` inside `node-floor.test.js`: NF-01 runs it over the real files (`out` empty); NF-02 runs it over the same map with one place changed and expects a finding (section 9.1). A finding names the file, the line number and the value only.

### 5.5 Measured

Sketch: green, 9 seen. Tag files: red with seven findings — «engines >=22 <23 is not >=X.Y.Z <N», «hook floor lines []», the four README anchors and the pre-push anchor «does not name the floor» (F12). The damaged copies of NF-02 (each red on the sketch): README 157 at 22.23.3; README 207 at 22.23.3; pre-push at 22.23.3; a stray `22.23.5` in a comment of `tools/src/web/main.js`; `node-version: "22.23.3"` in `check.yml`; the lockfile root `>=22.23.3 <23`; engines `>=22 <23` (the tag); the hook line `node_floor=22.23.3`; the hook floor as two numbers; README line 9 with `` `>=22 <23` `` while it still names 22.23.4 elsewhere in the line (this row found a gap of the first sketch, closed by the «must also hold» column of 5.3); a third `22.21.1` in a comment; the history `22.21.1` moved off its README line to another README line (mutant M38); `22.23.3.` at a sentence end; `v22.23.3`. Green twins: `122.23.3`, `22.23.3.9`, `1.22.23.3`.

## 6. CI — `.github/workflows/check.yml` (CODE-FIXER) and CI-3/CI-8 (TEST-DESIGNER)

### 6.1 The workflow

One line is added in the setup-node step, right under `node-version: "22"`: `          check-latest: true` (10 spaces). Nothing else changes: the step name «Install Node 22» stays (CI-8's row «setup-node step removed» finds the step by it), four steps, the two run lines, `package-manager-cache: false` the only line with «cache» (`check-latest` holds no «cache»), no `env:`, `if:` or address (CI-1, CI-2, CI-4…CI-7 green, F11, F12). With `check-latest: true` setup-node asks the action's version manifest for the newest 22.x on every run instead of the runner's cache (`decisions/0119` О4; the diagnosis read `check-latest: false` and «Found in cache» in run 44124259440). Not measured on GitHub (no push at this step).

### 6.2 The guard on the runner

If the runner still gets a Node below the floor (a stale cache, a manifest that cannot be read), `npm ci` only warns (EBADENGINE; fact 6 of the block), `format:check` and `lint` run and write nothing of the project (section 7), and `npm run traces` refuses with code 2 and the refusal line: the check is red. RELEASE-VALIDATOR and RELEASE-FINALIZER read the setup line `node: v…` of the run log by the command of criterion 8.

### 6.3 The rule CI-3 (replaces the rule of `tools/test/repo.test.js:212-223`)

`ciFindings(buf, engines, lockEngines = engines)` — a third argument; `ciOwn` and CI-8 pass the lockfile root (`lockEnginesNode()` reads `packages[""].engines.node` of `tools/package-lock.json`). The CI-3 part asserts:

1. the `node-version:` lines are exactly `node-version: "22"` (kept);
2. `engines` equals `">=22.23.4 <23"` (a constant `CI_ENGINES` of the test, the literal of criterion 1; it moves only with a run that raises every place, `decisions/0119` О1);
3. `lockEngines` equals `engines`;
4. the major of `engines` is `22`, in step with `node-version`;
5. the lines that hold `check-latest` are exactly `check-latest: true`, and it stands in the setup-node step (`steps[1]`).

The title becomes «REQ-030 AC1 CI-3: node-version is 22 with check-latest: true, and engines.node of tools/package.json and of the lockfile root is the floor >=22.23.4 <23 (REQ-110)» (a rename, section 11).

### 6.4 New damaged copies of CI-8 (each must give a CI-3 finding; measured 26/26)

`engines` of the tag `>=22 <23`; one patch below `>=22.23.3 <23`; another upper bound `>=22.23.4 <24`; the lockfile root out of step (`>=22.23.3 <23` with engines right); `check-latest` removed; `check-latest: false`; `check-latest` moved to the checkout step. The row «engines changed» `>=22 <24` stays. The loop of CI-8 reads a fifth element of a row (the lockfile text; default the engines text).

## 7. The check command (criterion 6) — what the steps before `npm run traces` may hold

The rule (NF-06), over `scripts` of `tools/package.json` read when the test runs:

1. `check` is steps joined by ` && ` only: no step holds `&`, `|` or `;` (so `||`, a single `|` or `&`, `;` are red);
2. the first step equal to `npm run traces` exists (the first guarded step; `traces` is E6 of section 3);
3. every step before it is `npm run <name>`, and the script `<name>`:
   - is one command: its first token is exactly `prettier` or `eslint` (no environment assignment, no `npx`, no path) and it holds none of the signs `& | ; < > ` `` ` `` `$ ( )` or a line end (the sign ban, a design check: `decisions/0120` О11, О13; section 7.1), and no token `tee`;
   - holds no option that writes, compared as whole tokens: the script split on white space, an `=value` suffix dropped, a short group such as `-lw` read as each of its letters.

The options that write, for the pinned versions (G3; F15, F16):

| Tool | Option | Writes | Source | In criterion 6 (as amended) |
|---|---|---|---|---|
| prettier 3.9.9 | `--write`, `-w` (also inside a group) | the source files | option table, alias `w` | yes |
| prettier | `--cache` | `node_modules/.cache/prettier/.prettier-cache` | measured | yes |
| prettier | `--cache-location` | the named file | option table | yes |
| prettier | `--experimental-cli` | `<TMPDIR>/prettier/.prettier-caches/<hash>.json` (its cache is on unless `--no-cache`) | measured | yes, by the micro-amendment (`decisions/0120` О2) |
| eslint 10.11.0 | `--fix` | the source files | option table | yes |
| eslint | `--cache` | `.eslintcache` | option table («Only check changed files») | yes |
| eslint | `--cache-location`, `--cache-file` | the named cache file | option table | yes |
| eslint | `--output-file`, `-o` (also inside a group) | the report file | measured (`-o r.txt`) | yes |
| eslint | `--suppress-all`, `--prune-suppressions` | `eslint-suppressions.json` | measured | yes, by the micro-amendment (`decisions/0120` О2) |
| eslint | `--suppress-rule` | the suppressions file | option table («Suppress specific rules») | yes, by the micro-amendment (`decisions/0120` О2) |
| eslint | `--suppressions-location` | names the suppressions file (as `--cache-location` names the cache) | option table | yes, by the micro-amendment (`decisions/0120` О2) |
| eslint | `--init` | runs `npm init @eslint/config@latest` (downloads, writes a config) | read, `bin/eslint.js:168-175` | yes, by the micro-amendment (`decisions/0120` О2) |
| eslint | `--mcp` | runs `npx @eslint/mcp@latest` (downloads, starts a server) | read, `bin/eslint.js:179-185` | yes, by the micro-amendment (`decisions/0120` О2) |
| eslint | `--inspect-config` | runs `npx @eslint/config-inspector@latest` (downloads, starts a server) | read, `lib/cli.js` | yes, by the micro-amendment (`decisions/0120` О2) |

Not writing alone (allowed): eslint `--fix-dry-run`, `--fix-type` (needs `--fix` or `--fix-dry-run`), `--cache-strategy`, `--format`/`-f`, `--max-warnings`, `--quiet`, `--print-config`, `--env-info`, `--debug`, `--stats`, `--color`; prettier `--check`/`-c`, `--list-different`/`-l`, `--log-level`, `--no-cache`, `--cache-strategy` (needs `--cache`), the format options. The eight options that the first text of criterion 6 lacked were added by the micro-amendment of run REQ110AMEND-20261118-01 (`decisions/0120` О2), so the table and the criterion now name the same list.

Damaged copies, each red (the eleven of criterion 6 and the design rows): `prettier --write .`, `prettier --check . -w`, `prettier -lw .`, `prettier --check --cache .`, `prettier --check --cache-location=x .`, `eslint . --fix`, `eslint . --cache`, `eslint . -o report.txt`, `eslint . --output-file=r.txt`, `eslint . --max-warnings 0 > lint.txt`, a `||` between the steps; `eslint . --suppress-all`, `eslint . --prune-suppressions`, `eslint . --suppress-rule no-undef`, `eslint . --suppressions-location x.json`, `eslint --init`, `eslint --mcp`, `eslint . --inspect-config`, `prettier --check . --experimental-cli`, `eslint . --cache-file x`, `eslint . | tee x`, `X=1 eslint .`, `npm run test &&` put before the steps. Green twins: `eslint . --fix-dry-run --max-warnings 0`, `prettier --check . --log-level warn`, `eslint . --max-warnings 0 --format stylish`, `prettier -c .`, `prettier --check . --no-cache`, `eslint . --cache-strategy content --max-warnings 0`. Today `prettier --check .` and `eslint . --max-warnings 0`: green (F12).

What the steps before `npm run traces` still write (F14): both tools enable Node's compile cache and write it under `TMPDIR` on every run, at or above the floor alike, and npm keeps its own log folder. None of it is a file of Sai or of the person: «writes nothing» means no project file and no personal file (`decisions/0120` О3); the shared cache is named limit 3 (section 17).

### 7.1 The sign ban — a design check (`decisions/0120` О11, О13; F5)

The ban of the signs `& | ; < > ` `` ` `` `$ ( )` and a line end inside the scripts of the steps before `npm run traces` is stricter than the word list of criterion 6, but needed by its outcome («stops red at `npm run traces` … before any test runs») and by `decisions/0119` О5 («writes nothing»): without it a lint script can chain a write or a test after the lint while the word rule is satisfied. It has rows that only it catches, twins it must let through, and forms it refuses although they write nothing (F25):

| Kind | Script of `lint` or `format:check` | NF-06 expects | Caught by |
|---|---|---|---|
| sign only | `eslint . --max-warnings 0 ; touch x` | red | the ban only |
| sign only | `eslint . --max-warnings 0 && npm test` | red | the ban only |
| sign only | `eslint . $(touch x)` | red | the ban only |
| sign only | ``eslint . `touch x` `` | red | the ban only |
| sign only | `eslint . \| dd of=x` | red | the ban only |
| twin | `prettier --check "src/**/*.js"` | green | — (quotes, `*` and `/` are not signs) |
| twin | `eslint . --rule "no-console: error" --max-warnings 0` | green | — (a colon, quotes) |
| twin | `eslint . --ext .js,.mjs --max-warnings 0` | green | — (a comma) |
| accepted strictness | `eslint . < /dev/null` | red | the ban (an input redirect writes nothing) |
| accepted strictness | `prettier --check "src/**/*.(js\|mjs)"` | red | the ban (`(`, `\|` and `)` inside a quoted glob) |
| accepted strictness | `eslint . --ignore-pattern "$X"` | red | the ban (`$` inside quotes) |

The three forms of accepted strictness are refused on purpose: the rule reads the script as text and does not parse shell quoting; a script of this kind is written without them. The mutant «ban removed» (N01, section 13) turns the five sign-only rows green and NF-06 red.

## 8. The documents — exact texts (CODE-FIXER; agreed with the tests, AP-077)

| File, line of the tag | New text (the whole line) |
|---|---|
| `tools/README.md` 9 | The one check command (quality-bar Q4) runs from the folder `tools/`; it needs a Node 22 at or above 22.23.4 (`engines` in `package.json`: `>=22.23.4 <23`); on another Node a `node <file>` script of `package.json` that is started to do its work stops at once, before it writes anything, with one line in Russian that names both versions and code 2 (`pixel-office` with code 1), while `--help` and a wrong call are answered as on any Node: |
| `tools/README.md` 36 | the line of the tag with its last sentence «Node 22 is needed: under another version the command prints a message with the version and ends with code 1.» replaced by «It needs a Node 22 at or above 22.23.4: under another version the command prints one line in Russian with both versions, starts nothing and ends with code 1.» («The default port is 4780» stays: SV-12, ST-06) |
| `tools/README.md` 157 | the line of the tag with «where `hook.sh` looks for Node 22 (for example» replaced by «where `hook.sh` looks for a Node 22 at or above 22.23.4 (for example» |
| `tools/README.md` 207 | - The command starts `tools/src/pixel-office/hook.sh`, and that takes only a Node 22 at or above 22.23.4, by the `--version` of each candidate: first the path from the file `node-path`, then `node` from `PATH`, then the folders from `SAI_NODE_FALLBACKS`; a candidate below the floor, of another major or that cannot start is skipped for the next one. If none is left, the hook ends quietly with code 0 and the event is lost: it is not written later. The hook has no timer of its own: a candidate whose `--version` does not answer holds the hook until the time-out of its handler in `.claude/settings.json` ends it, and that event is lost too. |
| `.githooks/pre-push` 32 | `  echo "pre-push: не найден npm (нужен Node 22 не ниже 22.23.4)" >&2` (keeps «pre-push: не найден npm»: PH-6, PH-7, the table REFUSALS) |

Line 176 («A consequence of the rule M7») is not touched (DC-01; F17 (f)). Line 207 says in words that only a Node at or above the floor is taken (G2), holds the exact words of criterion 9 (d), and, right after the hook's limit, states the limit of a candidate whose `--version` does not answer (`decisions/0120` О4, О12; F4). Line 9 speaks of the `node <file>` scripts only, because `prettier`, `eslint` and `node --test` themselves are not guarded (`decisions/0119` О5), and of a start that would do its work, naming the two answers that do not refuse — `--help` (criterion 11) and a wrong call (`decisions/0120` О5) (L3); it names no step of `npm run check`, so the order check of E2K-60 reads the list of line 14 as before. Lines 157 and 207 are pinned whole by NF-09 (9.1). With these final texts (the rework sketch, 2026-11-18 06:50–07:05Z) every command of criterion 9 gives the expected value (engines 1 and 1; (a) line 9 and 0; (b) 0, 1 and «4780» 1; (c) 1 and 1; (d) 1; (e) 4; (f) the M7 sha256 `822cd4d1…` of the tag; (g) 1), NF-01 finds the same 9 floor texts and no other, NF-09 is green, and every test that reads these files is green (docs 9/9, settings 7/7, traces-readme 7/7, handoffs-docs 5/5, team-docs 5/5, E2K-60 and E2K-61 within the filtered 8/8; prettier clean on README).

## 9. The tests (TEST-DESIGNER, step 6)

Common rules for every new test:

- **Safety (R2, AP-150, AP-154).** Every start of a program of `tools/`, of `hook.sh` or of a server gets a `HOME`, `TMPDIR`, `SAI_PIXEL_OFFICE_DIR` and `SAI_TEAM_HOME` under the test's own temporary folder, checked to lie under the real temporary root before the start (as `assertSafeEnv`); servers only with `--port 0` (as `assertSafeArgs`); the child environment is built from named variables only (`PATH` and the folders above, plus `SAI_TEST_NODE_VERSION`), never from the whole `process.env`; `SAI_TEAM_REAL_RUNS` is never set; no test names the real state folder.
- **Values in red messages (AP-152).** A red message names a file, a row, a code, a version or a path of the test's temporary folder; never an environment.
- **Time limits (AP-045, AP-116).** Every child has a limit (15 s; the link line of a server ends the wait at once) and a `SIGKILL` in `t.after`; a server row that sees the link line where a refusal is expected fails at once and the child is killed. An in-process start of `main()` that is not refused never returns by itself (F13), so every in-process refused row of SV-39 gives `main` an `out` whose `write` throws (a refused start writes nothing to stdout; a start that goes on writes its link line there, the write throws, and `main` closes its own server and returns 1 «внутренняя ошибка») and races `main` against a 10 s limit with a named failure; a lost seam or a removed guard is then a red row with a message, never a hang (L1; F23).
- **The version preload.** Written by the test into its temporary folder (no new fixture file, `decisions/0120` О6): a module given with `node --import <file>` that, when `SAI_TEST_NODE_VERSION` is set, replaces `process.versions.node` with it and `process.version` with `v` and it (both properties are configurable, F1). Positive control in each file that uses it: a child `node --import <file> -p process.versions.node` prints the simulated value; the twin of every simulated start is the same start under the real Node (AP-160).
- **Stub nodes** (in `pixel-office-hook.test.js` only): shell scripts written by the test with mode 755 — `--version` prints a fixed text and ends with a fixed code (optionally after reading all of stdin); any other start appends `start <args>` and the lines of its stdin to its own record file. Never a link to a real binary (AP-020). `PATH` and `SAI_NODE_FALLBACKS` name only stub folders or an empty folder, so no real `node` is reachable; `hook.sh` is run directly as `/bin/sh <hook.sh>` (the command of `settings.json` hides the script's own output), with the event JSON on stdin.

### 9.1 `tools/test/node-floor.test.js` (new; created by this work)

| Id | Criterion | What it runs and asserts |
|---|---|---|
| NF-01 | 1 | `floorFindings` over the real files: no finding (5.1–5.3); prints nothing else |
| NF-02 | 1 | the damaged copies of 5.5, each with at least one finding; the three border twins with none |
| NF-03 | 2 | the rule table of section 2: every refused row false (the other-major rows `23.24.0`, `24.23.4`, `23.23.4`, `21.24.0`, `21.23.4` among them, F2), every accepted row true; and read from the rule: `meetsNodeFloor(NODE_FLOOR)` true, the floor with its patch minus one false, the next major `.0.0` false, the next major with the floor's minor plus one false, the previous major with the floor's minor plus one false |
| NF-04 | 2, 3, 5 | `nodeFloorRefusal(v)` for 22.21.1, 22.23.3, 21.7.0, 25.2.1: one line, Cyrillic, holds `v` and `NODE_FLOOR`, no `^\s+at `; for a text with a line end, a control character, 65 characters: one line with «неизвестная версия» and without the text; `refuseBelowNodeFloor` with a recording writer under 22.21.1: true and exactly one write of the line and `"\n"`; with a writer that throws: returns true and does not throw (L2); at the floor with a writer that throws: false and the writer is never called |
| NF-05 | 5 | the 21 entry rows of 9.2: each started as a child under simulated 22.21.1 and 22.23.3 ends with its code (2; the Pixel Office row 1), stdout empty, stderr exactly the refusal line of that version and `"\n"`, the listing with sha256 of the home, TMPDIR, state folder, team home and working folder unchanged, no server listening (the child ended by itself); under a simulated 22.23.4 the same start prints no refusal line (a server row is stopped after its link line by `SIGTERM`). The comparison with `package.json` (L5, section 3): every `node <file>` script has its row, keyed by the script name; every row's script exists; the second commands are the six named rows of 9.2; every script whose first word is `node` is a `node <file>` script or exactly `test`; `office-report.js` is the one row with no script. A script added later with no row, a row with no script, or a script with a key before its file is red (F1) |
| NF-06 | 6 | section 7 over the real scripts (no finding), every damaged copy (a finding), every twin (none); the sign-only rows, the twins and the rows of accepted strictness of 7.1 (F5) |
| NF-07 | 7 | the header canary of 9.3 for the team web server (`src/web/main.js --port 0`) and the picker server (`src/picker/cli.js serve --tenants <a folder with a copy of src/picker/demo-tenants/uchet-pro.json> --home <home> --port 0`), each a child; before the probes it asserts that the 2 500-line head is under 16 384 bytes and under the picker's own `MAX_HEADER_BYTES`, imported from `tools/src/picker/config.js` (a module of constants; L4) |
| NF-08 | 11 | the help rows: the six fixed rows `pixel-office`, `pixel-office-note`, `traces`, `handoffs-check`, `handoff`, `picker` (G5) and every other `node <file>` script file whose `--help` ends with code 0 under the running Node (found when the test runs); each started with `--help` under the running Node (must end 0 — a fixed row whose help breaks on every Node is red) and under simulated 22.21.1 and 22.23.3: code 0, stdout byte-equal to the running Node's, no refusal line in stderr, nothing written |
| NF-09 | 9 (c), (d) | README lines 157 and 207 (found by the anchors of 5.3, each on exactly one line) equal the exact texts of section 8, with `NODE_FLOOR` in place of the floor; damaged copies, each red: the H1 form of 157 (the old words «looks for Node 22» kept, the floor in brackets: «looks for Node 22 (the floor: at or above 22.23.4; for example»), a 207 with «finds Node 22 (floor 22.23.4)» in place of «takes only a Node 22 at or above 22.23.4», a 207 without the sentence of the hang limit (`decisions/0120` О10, О12, О14; F3, F4). A later edit of either line changes this test in the same run (AP-077) |

### 9.2 The entry rows of NF-05 (every `node <file>` script and a second command of each program that serves several; arguments that write nothing outside the test's folders even when not refused — on the tag, F21)

Every row runs in the test's working folder (not a git tree), with the test's home, TMPDIR, state folder and team home; the values in the arguments are invented.

| Row (key) | File | Arguments | On the tag (F21) | On the fix (F21) |
|---|---|---|---|---|
| `prepare-run` | `src/cli.js` | `prepare-run --root <working folder>` | 2 E_USAGE (no RUN-ID) | 2, refusal |
| `validate` | `src/cli.js` | `validate --root <working folder>` | 2 E_USAGE | 2, refusal |
| `apply-verdict` | `src/cli.js` | `apply-verdict --root <working folder>` | 2 E_USAGE | 2, refusal |
| `snapshot` | `src/cli.js` | `snapshot --root <working folder>` | 2 E_USAGE (no output file) | 2, refusal |
| `snapshot-diff` | `src/cli.js` | `snapshot-diff` | 2 E_USAGE | 2, refusal |
| `pixel-office` | `src/pixel-office/main.js` | `--port 0` | 0, server, its test state written | 1, refusal, no state folder |
| `pixel-office-note` | `src/pixel-office/note.js` | `--text x` (an empty state folder) | 1 «сервер не запущен» | 2, refusal |
| `pixel-office-note`, second form | `src/pixel-office/note.js` | `--text x` with `SAI_PIXEL_OFFICE_STORE_TEXT=0` (mutant M35) | 0 «хранение текста отключено» | 2, refusal |
| `team` | `src/team/cli.js` | `projects` (the team home absent) | 0 | 2, refusal |
| `team`, second command | `src/team/cli.js` | `project 01-alpha` | 1 E_NOT_FOUND | 2, refusal |
| `team-web` | `src/web/main.js` | `--port 0` | 0, server | 2, refusal |
| `traces` | `src/traces/cli.js` | `check --root <working folder>` | 2 E_TRACE_NOT_GIT | 2, refusal |
| `traces`, second command | `src/traces/cli.js` | `hash-line --file a.txt --line 1 --root <working folder>` | 2 E_TRACE_NOT_GIT | 2, refusal |
| `handoffs-check` | `src/handoffs/cli.js` | `--root <working folder>` | 2 E_TRACE_NOT_GIT | 2, refusal |
| `handoffs-check`, second mode | `src/handoffs/cli.js` | `--root <working folder> --emit-exceptions` | 2 E_TRACE_NOT_GIT | 2, refusal |
| `handoff` | `src/handoffs/handoff.js` | `close handoffs/X-20990101-01/step-01-x.json --status COMPLETED` | 2 E_TRACE_NOT_GIT | 2, refusal |
| `handoff`, second command | `src/handoffs/handoff.js` | `new --run X-20990101-01 --step 01 --role BACKEND-DEV --workflow WF-02 --task x` | 2 E_TRACE_NOT_GIT | 2, refusal |
| `picker` | `src/picker/cli.js` | `check <working folder>/absent.json` | 2 «Файл не найден» | 2, refusal |
| `picker`, second command | `src/picker/cli.js` | `serve --tenants <folder with one demo tenant copy> --home <home> --port 0` | 0, server | 2, refusal |
| `e2e` | `test/e2e/run.js` | `no-such-spec` (no browser: the selection is refused before the launch) | 1 SELECTION_UNKNOWN, a record line | 2, refusal, stdout empty |
| `office-report` (no script) | `src/pixel-office/public/office-report.js` | `--journal <working folder>/absent.jsonl` | 1 «Журнал не найден» | 2, refusal |

The four WF-06 scripts get `--root <working folder>` so that even a start that were not refused could write only into the test's folder. The second commands are the six rows marked «second»; a later program that serves several commands under one script adds its own second row in the same run.

### 9.3 The header canary (SV-68 and NF-07; criterion 7, G7)

The server, started from the project code on 127.0.0.1 port 0 with a private home and a temporary state folder (SV-68: `startServer(t)` of `pixel-office-helpers.js`; NF-07: children), gets raw requests over `node:net`, each with the request line `GET / HTTP/1.1`, `Host: 127.0.0.1:<port>`, `Connection: close` and short filler lines `a:b`, counted «in all» (Host and Connection included): (1) 2 lines — the status before; (2) 2 500 lines — 431, and the connection ends; (3) 1 000 lines — the status of (1); (4) 2 lines — the status of (1). The listing with sha256 of the folder the server writes (Pixel Office: its state folder; team web: the team home, absent before and after; picker: none) is the same after (4) as before (1). Size facts (G7, F9): the whole head of the 2 500-line request is 12 550 bytes with the 1-byte target `/`, under 16 384, and Node's size limit counts the target and the header names and values, which are all inside the whole head, so only the count can refuse it. The picker server sets its own size limit, `maxHeaderSize: MAX_HEADER_BYTES` (`tools/src/picker/server.js:432`; `MAX_HEADER_BYTES = 16384` at `tools/src/picker/config.js:20`); NF-07 asserts the probe's head under both 16 384 and that constant before it sends, so a lowered constant is a red row with its cause (mutant P01) instead of a 431 by size that would hide a count mutant (L4; F27). A stricter count on a server turns (3) red (F10) — such a server changes this test by its own table.

### 9.4 `tools/test/pixel-office-hook.test.js` (new rows; the tests of the tag unchanged, 50 reported by `node --test` on the tag)

Every row: code 0, stdout and stderr empty, at most 2 000 ms, the state folder listing unchanged, and the named stub records (or does not record) a start whose last argument ends with `/hook.js`.

| Id | Criterion | Rows |
|---|---|---|
| HK-32 | 4 (a) | one candidate below the floor, no other: node-path → stub v22.21.1, v22.23.3, v21.7.0, v25.2.1; PATH stub v22.21.1, v22.23.3; fallback stub v22.21.1 — no start recorded |
| HK-33 | 4 (b) | PATH stub v22.23.4 → it starts; node-path stub v22.21.1 with PATH stub v22.23.4 → the PATH stub starts, the node-path stub does not; PATH stub v25.2.1 with fallback stub v22.23.4 → the fallback starts |
| HK-34 | 4 (c) | a PATH stub whose `--version` ends with code 1 (no other) → no start; a node-path stub whose `--version` ends with code 1 with a PATH stub v22.23.4 → the PATH stub starts |
| HK-35 | 2 | a PATH stub answering each text of the rule table as `v<text>` (and `v` for the empty text): the refused texts record no start (`v23.24.0`, `v24.23.4`, `v23.23.4`, `v21.24.0`, `v21.23.4` among them, F2), the accepted ones do; design rows `22.23.4` without `v`, `v022.23.4`, `v22.023.4`, `"v22.23.4 "`, two lines, `v2222222222.0.0` refused |
| HK-36 | design (Q10, R2) | a node-path stub v22.21.1 whose `--version` first reads all of stdin, with a PATH stub v22.23.4: the PATH stub records a start and the event bytes whole |
| HK-37 | 1 (G1) | a copy of `hook.sh` in the test's folder with its `node_floor=` line raised by one patch: a PATH stub at the old floor records no start, a PATH stub at the raised floor does (the line is what the rule uses) |

On the tag every row of HK-32, the node-path rows of HK-33, HK-34 and HK-36, and the refused `v22.*` rows of HK-35 are red (F4); HK-37 is red on the tag because the tag's hook has no floor line (the copy cannot be made). The other-major rows of HK-35 are green on the tag too (it takes `v22.*` only, F22): they stand against the mutant K04, not against the tag.

### 9.5 `tools/test/pixel-office-server.test.js`

| Id | Criterion | Change |
|---|---|---|
| SV-39 (renamed, section 11) | 3 | in-process rows through the seam `io.nodeVersion`, each with the stdout trap and the 10 s limit of the common rules: the two rows of the tag (21.7.0, 25.2.1) kept, and 22.21.1, 22.23.3, 23.0.0 added → code 1, stderr exactly the refusal line of that version, the state folder does not exist; child rows of `main.js --port 0` with the preload: 22.21.1 (the twin of the seam: refused the same way), 22.23.4 and 22.24.0 → the line «Pixel Office: http://127.0.0.1:<port>/», stopped by `SIGTERM`, code 0, no refusal line; the positive control of the preload. A lost seam (mutant C05) or a removed guard (M12) makes an in-process row red at once with its message; nothing hangs (L1; F23; sketch 73/73) |
| SV-68 (new) | 7 | the canary of 9.3 for the Pixel Office server |

## 10. Criterion → test

| Criterion | Design element | Test (red when it is violated) |
|---|---|---|
| 1 The declared floor, one value | 5.1–5.5; engines and lockfile lines; the hook line | `repo.test.js` CI-3 and CI-8 (6.3, 6.4); NF-01, NF-02; HK-37 |
| 2 The version rule | section 2 (the other-major rows of F2 among the rows); the hook rule (4) | NF-03 (rows `23.24.0`, `24.23.4` against V07), NF-04 (the throwing-writer row against V06); HK-35 (rows `v23.24.0`, `v24.23.4`, `v23.23.4` against K04) |
| 3 The Pixel Office server | E2; the refusal line | SV-39 (9.5: in-process seam rows with the stdout trap and the limit, child rows; the in-process row 21.7.0 against C05); NF-05 (its `pixel-office` row) |
| 4 The Pixel Office hook | section 4 | HK-32, HK-33, HK-34, HK-36; HK-09, HK-10, HK-11g, HK-12b, HK-31 stay green |
| 5 Every entry point of the npm scripts | section 3, E1–E11; the rule of a `node <file>` script (L5); one guard before the dispatch | NF-05 (the 21 rows of 9.2: `prepare-run`, `apply-verdict`, `snapshot`, `snapshot-diff` against C01; `handoff` second command against C02; `team` second command against C03; `traces` second command against C04; `handoffs-check` second mode against C06; `picker` against C07; the comparison with the script list) |
| 6 The check command | section 7 and 7.1 | NF-06 (the option rows; the sign-only rows `; touch x`, `&& npm test`, `$(touch x)`, a backtick, `\| dd of=x` against N01; the twins; the rows of accepted strictness) |
| 7 The header-count canary | 9.3 | SV-68 (Pixel Office), NF-07 (team web, picker; the head under the picker's `MAX_HEADER_BYTES` against P01) |
| 8 CI at or above the floor | 6.1–6.4 | CI-3, CI-8; on GitHub the two runs and the log line (RELEASE-VALIDATOR, RELEASE-FINALIZER) |
| 9 The documents | section 8 | the commands of criterion 9 (F17, repeated with the final texts); NF-01 (5.3 presence, 5.2 equality); NF-09 (README lines 157 and 207 equal the exact texts of section 8; red copies: the H1 form against D01, a 207 without «takes only» against D02, a 207 without the hang sentence against D03); DC-01; `npm run traces` |
| 10 The checks | the whole work | `npm ci && npm run check` on a fresh clone; `traces`, `handoffs-check`; the `git diff` of `tools/test` with no `D` line; the tag's titles of the three files still present except the two renamed in section 11 |
| 11 Help below the floor | the place of the guard after the help branch (section 3) | NF-08 |

Every new test above carries a criterion; HK-36 is a design row for Q10 and R2 (the event is not taken by a skipped candidate).

## 11. Replacement table of earlier guard tests (measured on the sketch, F11, F12, F19; repeated on the rework sketch, F28)

Repeated at the rework (2026-11-18, 07:04–07:05Z, the rework sketch with its CI-3/CI-8 table and SV-39 sketch, one file at a time, private HOME and TMPDIR): repo 26/26, pixel-office-server 73/73, pixel-office-hook 50/50, docs 9/9, settings 7/7, traces-readme 7/7, page 114/114, picker-config 35/35, team-deps 2/2, traces-runtime 6/6, handoffs-runtime 9/9, office 61/61, note 7/7, team-web-guard 7/7, team-web-docs 3/3, handoffs-cli 19/19, handoffs-cmd-docs 9/9, handoffs-docs 5/5, cli 13/13, team-docs 5/5, traces-check 29/29, e2e-kit E2K-01/02/03/09/40/50/60/61 8/8, team-web-control CTL-1c and CTL-5a 2/2; the `--help` rows byte-equal to the tag; the canary of 9.3 on the three servers as F9 with the head under the limits.

| Test | File:line (tag) | What it counts | Was → became | Earlier criterion | Measured |
|---|---|---|---|---|---|
| CI-3 | `repo.test.js` rule 212–223, test 337 | the `node-version` lines; `engines` `/^>=(\d+) <(\d+)$/` with 22 and 23 | → the rule of 6.3; **title renamed** from «REQ-030 AC1 CI-3: node-version is 22 and the major version equals engines.node of tools/package.json» to the title of 6.3; the prohibition is wider (exact floor, lockfile, check-latest), not weaker | REQ-030 AC1 («задаёт Node 22» — stays true) | red with S4 (24/26), green with the table (26/26) |
| CI-8 | `repo.test.js` 357, the row «engines changed» 411 | damaged copies of `check.yml` and engines | → `ciFindings` with the lockfile argument; the seven rows of 6.4 added; no row removed | REQ-030 AC1 | 26/26 |
| SV-39 | `pixel-office-server.test.js` 808 | rows 21.7.0, 25.2.1 | → 9.5; **title renamed** from «SV-39: not Node 22 - a refusal with the version, code 1, nothing created» to «SV-39: a Node below the floor 22.23.4 or not 22 - the refusal line with both versions, code 1, nothing created; at or above the floor the start goes on» | REQ-001 criterion 7 / design E17 (blocked block; its «not Node 22» now means «below the floor or not 22», 0119 О11) | 73/73 |
| SV-43 and every in-process `main()` without `io.nodeVersion`, every test that spawns a server | `pixel-office-server.test.js` 879 … | read the running Node | no change; green while the runner meets the floor (criterion 8) | REQ-001 | 72/72 |
| HK-09, HK-10, HK-11g, HK-12b, HK-31 and the other hook tests | `pixel-office-hook.test.js` 309, 320, 449, 525, 853 | the running Node as node-path or a link as fallback; silence | no change (titles kept: «Node 22» in them is still true of a Node at the floor) | REQ-001 | 50/50 |
| DC-01 | `pixel-office-docs.test.js` 22 | the phrase 22.21.1 of README 176 | no change; line 176 untouched | REQ-008 | 9/9 |
| RD, TM-01 | `repo.test.js` 1117, `team-docs.test.js` 62 | «Node 22» in the root README and in `decisions/0015` | no change | REQ-030 (RD), REQ-009 (TM-01) | green |
| PK-6d | `picker-config.test.js` 710–728 (help lines 716–717) | the picker help word for word | no change (`decisions/0120` О1 keeps the help) | REQ-054 | 35/35 |
| PK-6e, PK-7a, PK-7c | `picker-config.test.js` 755, 772, 797 | closed module list, writing words, `node:` words of `tools/src/picker/` | no change: no module in `picker/`, no `node:` word in `picker/cli.js` (E9) | REQ-054 | 35/35 |
| TM-49 | `team-deps.test.js` 32 | imports of `tools/src/team/` | no change: `../node-floor.js` is relative and outside `pixel-office/` | REQ-009 | 2/2 |
| TR-4b, TR-4c | `traces-runtime.test.js` 74, 133 | network imports and `child_process` in `tools/src` | no change: the module has neither | REQ-014 | 6/6 |
| E2K-02, E2K-50 | `e2e-kit.test.js` 376, 3821 | imports and variables of `run.js` | no change: a relative import, no variable read | REQ-104 | 8/8 (filtered) |
| PG-20 | `pixel-office-page.test.js` 1063 | banned words in `public/`, relative imports exist | no change: `office-report.js` imports `../../node-floor.js`, which exists | REQ-001, REQ-007 | 114/114 |
| WEB-9d, CTL-1c, CTL-5a, WEB-14 | `team-web-guard.test.js` 252, `team-web-control.test.js` 372, 661, `team-web-docs.test.js` 90 | banned words in `tools/src/web/` and `tools/src/team/` | no change: E4 and E5 add only the import and the call | REQ-011, REQ-035 | 7/7, 2/2, 3/3 |
| E2K-60, E2K-61, ST-06, SV-12, PH-2, PH-5, PH-6, PH-7 | as in the block | README and pre-push words | no change: none of their words is on an edited line, or the words are kept (section 8) | REQ-104, REQ-001, REQ-030 | green |
| the exact `check` script pins (PK-7b, `picker-config.test.js:785`, `picker-look-property.test.js:463`, `e2e-kit.test.js:3382`, `traces-check.test.js:486`, `handoffs-cmd-docs.test.js:147`, `handoffs-docs.test.js:20`, `:48`, `team-web-control.test.js:1702`) | — | the `check` script | no change: `check` is not edited | various | green where run |
| TT-1a | `picker-text.test.js` 69–73 | `process.versions.unicode` 17.0 | no change; with `check-latest: true` a later 22.x with another Unicode reaches GitHub sooner and turns it red by its design (`decisions/0076`) — named risk | REQ-068 | not run (reads only the running Node's Unicode) |

No test is deleted, skipped or weakened; the two renamed titles are the only ones of the tag that change (criterion 10).

## 12. Build sub-steps, owners and the order (measured one after another, F19)

First the shared contract (the module), then the sides. No two roles write one file.

| Step | Who | Files | Tests red after it |
|---|---|---|---|
| S1 | BACKEND-DEV (a new module, WF-03 «Roles») | `tools/src/node-floor.js` (new) | none (repo 26/26, traces-runtime, team-deps, picker-config, traces-check green) |
| S2 | CODE-FIXER | E1–E11 (section 3) | none (server 72/72, note, office, page, cli, handoffs-cli, team-web-guard, team-web-docs, picker-config, traces-runtime, team-deps green) |
| S3 | CODE-FIXER | `tools/src/pixel-office/hook.sh` (section 4) | none (hook 50/50, settings 7/7) |
| S4 | CODE-FIXER | `tools/package.json` line 8, `tools/package-lock.json` line 17: `">=22.23.4 <23"` | CI-3, CI-8 — **EXPECTED_RED** by this design until step 6 (WF-03 step 4) |
| S5 | CODE-FIXER | `.github/workflows/check.yml`: the line of 6.1 | no new red (CI-3, CI-8 still red from S4) |
| S6 | CODE-FIXER | `tools/README.md` lines 9, 36, 157, 207; `.githooks/pre-push` line 32 (section 8) | no new red (docs 9/9, settings 7/7, traces-readme 7/7, handoffs-docs, handoffs-cmd-docs, team-docs, E2K filtered 8/8) |
| T (step 6) | TEST-DESIGNER | `tools/test/node-floor.test.js` (new), `tools/test/repo.test.js` (CI-3, CI-8), `tools/test/pixel-office-server.test.js` (SV-39, SV-68), `tools/test/pixel-office-hook.test.js` (HK-32…HK-37) | none after; on a clone of the tag every new row named red in sections 9 and 10 is red |

After each step: `npm run -s format:check`, `npm run -s lint`, `npm run -s traces` and the named test files; the full `npm run check` once at the end of step 4 and of step 6 (one heavy job at a time). The rework changed no code of S1–S5; S6 carries the final texts of lines 9 and 207, measured with the tests of its row on the rework sketch (F28; section 8).

## 13. Mutants (each applied in a copy; measured on the sketch with the probes of the sketch, `restored` checked by sha256)

| Id | Breakage | Caught by | Measured |
|---|---|---|---|
| M01 | the rule checks the major only | NF-03 (22.21.1 row) | caught |
| M02 | `NODE_FLOOR = "22.23.3"` | NF-01, NF-02, NF-03 | caught |
| M03 | versions compared as text | NF-03 (22.3.0, 22.100.0) | caught |
| M04 | the patch ignored | NF-03 (22.23.0) | caught |
| M05 | the upper bound dropped | NF-03 (23.0.0, 24.11.0, 25.2.1) | caught |
| M06 | the version pattern not anchored at the end | NF-03 (22.23.4.1, 22.24.0-pre) | caught |
| M07 | leading zeros accepted | NF-03 (022.23.4, 22.023.4) | caught |
| M08 | the refusal line without the running version | NF-05 (and SV-39, NF-04) | caught |
| M09 | the refusal line in English | NF-05 (Cyrillic) | caught |
| M10 | a second line after the refusal | NF-05 (exactly one line) | caught |
| M11 | Pixel Office writes the refusal to stdout | NF-05, SV-39 (stdout empty) | caught |
| M12 | Pixel Office guard removed | NF-05 (row `pixel-office`), SV-39 (an in-process row, red at once by the stdout trap, no hang) | caught |
| M13 | the guard of `team/cli.js` removed | NF-05 | caught |
| M14 | the guard of `traces/cli.js` removed | NF-05 | caught |
| M15 | the guard of `traces/cli.js` put before the help | NF-08 | caught |
| M16 | Pixel Office refuses with 2 | NF-05, SV-39 | caught |
| M17 | the e2e runner refuses with 1 | NF-05 (one and the same code) | caught |
| M18 | the Pixel Office guard put before the help | NF-08 | caught |
| M19 | node-path executed with no check (the tag's hook) | HK-32, HK-33, HK-34, HK-36 | caught |
| M20 | the hook checks the major only (`v22.*` again) | HK-32, HK-35 | caught |
| M21 | the hook ends after a refused node-path (no fall-through) | HK-33, HK-34, HK-36 | caught |
| M22 | `--version` run with the hook's stdin | HK-36 | caught (after the fix of the trial's own row, handoff of step 03, issue I2) |
| M23 | the patch compared by its first digit | HK-35 (v22.23.10) | caught |
| M24 | `node_floor=22.23.3` | HK-35, NF-01 | caught |
| M25 | the hook prints a word when it skips | HK-32 (silence) | caught |
| M26 | `check-latest: true` removed | CI-3, CI-8 | caught |
| M27 | CI-3 without the lockfile comparison | CI-8 (row «the lockfile root out of step») | caught |
| M28 | engines `>=22.23.3 <23` | CI-3, CI-8, NF-01 | caught |
| M29 | README 157 at 22.23.3 | NF-01 | caught |
| M30 | the walk pattern without borders | NF-02 (twin `122.23.3`) | caught |
| M31 | criterion 6's rule reads one-letter short options only | NF-06 (`-lw`) | caught |
| M32 | criterion 6's rule by prefix (substring) | NF-06 (twin `--fix-dry-run`) | caught |
| M33 | the picker does not refuse `serve` | NF-05 (picker serve row) | caught |
| M34 | the guard of `office-report.js` removed | NF-05 | caught |
| H1–H3 | `maxHeadersCount = 0` on the Pixel Office, team web, picker server | SV-68, NF-07 | caught (F10) |
| H4–H6 | `maxHeadersCount = 6000` on each server | SV-68, NF-07 | caught (F10) |
| H7–H9 | `maxHeadersCount = 200` (B1, a stricter count) on each server | SV-68, NF-07 (the 1 000-line twin) | red (F10): by criterion 7 the canary pins Node's default both ways |
| M35 | the guard of `note.js` moved after `storeTextEnabled` | NF-05 (the storage-off row of 9.2) | caught (storage-off start under 22.21.1: code 0 with the mutant, 2 on the sketch) |
| M36 | NF-08's fixed rows replaced by the runtime-found set only | a help broken on every Node would pass — the six fixed rows of G5 catch it | not measured, by construction |
| M37 | the hook floor line duplicated with another value | NF-01 («exactly one line») | not measured, by construction |
| M38 | the history exception matched by file and value only (any line) | NF-02 (row «the history 22.21.1 moved off its README line»; a row with a third 22.21.1 did not catch it, because the «exactly once» count still fires) | caught after the row was added |

Added at the rework 03c — the gate's mutants that survived (V07, K04, N01) or were caught only by its own rows, a hang or a probe (C01, C02, C05, V06), each now red under the named row of the design, and new mutants of the same kinds (F28; the named rows read from the assertion messages, each with its twin green):

| Id | Breakage | Kind | Red under the row | Measured |
|---|---|---|---|---|
| V06 | the guard's `try`/`catch` around the write removed | a throwing write | NF-04 row «throwing writer: the guard throws» | caught (message «Got unwanted exception: row throwing writer: the guard throws») |
| V07 | the rule refuses only a lower major (`v[0] < floor` in place of `!==`) | another major above the floor's minor | NF-03 row `23.24.0` | caught («row "23.24.0" accepted») |
| K04 | the hook compares the major with `-ge` in place of `-eq` | the same, in the hook | HK-35 rows `v23.24.0`, `v24.23.4`, `v23.23.4` | caught |
| N01 | the sign ban removed | ban removed | NF-06 row «sign ; touch x» (and the four other sign-only rows) | caught |
| C01 | the guard of `cli.js` only in the `validate` command | guard inside one command | NF-05 rows `prepare-run`, `apply-verdict`, `snapshot`, `snapshot-diff` | caught |
| C02 | the guard of `handoff.js` skipped for `new` | guard inside one command | NF-05 row `handoff`, second command (`new`) | caught |
| C03 | the guard of `team/cli.js` only for `projects` | guard inside one command | NF-05 row `team`, second command (`project 01-alpha`) | caught |
| C04 | the guard of `traces/cli.js` only for `check` | guard inside one command | NF-05 row `traces`, second command (`hash-line`) | caught |
| C05 | the Pixel Office guard ignores the seam `io.nodeVersion` | a lost seam | SV-39 in-process row `21.7.0` («stderr is not the refusal line»; `main` returns, no hang) | caught |
| C06 | the guard of `handoffs/cli.js` skipped for `--emit-exceptions` | guard inside one mode | NF-05 row `handoffs-check`, second mode | caught |
| C07 | the picker does not refuse `check` | guard inside one command | NF-05 row `picker` (`check`) | caught (with M33 for `serve`) |
| D01 | README 157 in the H1 form (old words, the floor in brackets) | a text with the floor but old meaning | NF-09 | caught |
| D02 | README 207 with «finds Node 22 (floor 22.23.4)» | the same | NF-09 | caught |
| D03 | README 207 without the hang sentence | the limit of `decisions/0120` О4 dropped | NF-09 | caught |
| P01 | the picker's `MAX_HEADER_BYTES` lowered to 8 192 | a size limit that would hide the count | NF-07 (the head check before the probes) | caught (the probe's status alone, 431 by size, would not tell) |

Measured: 36 M-mutants (M01–M35, M38), 9 header mutants and 15 mutants of the rework, all caught (F10, F20, F28; the mutant runs: the handoffs' `self_check`); M36 and M37 by construction. Never applied (unsafe): a mutant that gives a test the real home or the real state folder; a mutant that starts the real `claude`.

## 14. Failure paths — what the person sees, what stays unchanged

| Situation | What the person sees | What stays unchanged |
|---|---|---|
| Any entry point of section 3, any of its commands, on a Node below the floor or of another major | one line on stderr (section 2), code 2 (`pixel-office` 1); stdout empty | everything: no folder, no file, no server, no child, no browser (F5, F21: home, TMPDIR, state, team home, working folder by sha256) |
| `--help` on such a Node | the help, code 0 (README line 9 says so) | everything (F6) |
| A wrong call on such a Node, for the five commands whose parsing comes before the help (`decisions/0120` О5) | the usage line of the command, code 2 (README line 9 says so) | everything (parsing writes nothing) |
| `npm run check` on such a Node | `format:check` and `lint` run, then the refusal line at `npm run traces`, npm's error summary, a non-zero code; no test runs (the rule of NF-06 and F5; measured end to end by the gate at step 03b with sentinel scripts: exit 2 at `npm run traces`, section 1) | the project and the person's files; the tools' shared caches are written (section 17) |
| `npm ci` on such a Node | an EBADENGINE warning, the install goes on (fact 6 of the block) | — |
| The pre-push hook on such a Node | «pre-push: запускаю…», the refusal line, «pre-push: проверка не прошла (код <N>) …» with the code npm returns, the push stops (not measured) | the push |
| The hook with no candidate at or above the floor | nothing; Claude Code goes on | the state folder and the journal; the event is lost and never written later (R2) |
| A candidate that cannot start (its `--version` fails) | nothing | the next candidate is asked |
| A candidate whose `--version` does not answer | nothing; the handler's time-out of `.claude/settings.json` ends the hook (README line 207 says so) | the state folder; that event is lost (named limit 2) |
| The stderr of a refused command is closed (its write throws) | nothing; the guard returns true without throwing and the exit code still says it (NF-04) | everything |
| GitHub runner below the floor | a red check at `npm run traces` | — |
| A request of 2 500 header lines to a server | 431, the connection ends | the server answers the next request; its state files (F9) |

## 15. Quality bar

| Item | Applicable | How it is met |
|---|---|---|
| Q1 | yes | REQ-110 (amended criterion 6) with eleven criteria, each mapped in section 10 to a design element and a test |
| Q2 | yes | CODE-DESIGN-VALIDATOR repeats the facts of section 1 on a fresh clone of the tag and applies at least ten mutants of section 13 (pass 1 did, step 03b); later SECURITY-REVIEWER, REVIEWER, TEST-DESIGN-VALIDATOR (runs the new tests red on the tag), RELEASE-VALIDATOR |
| Q3 | yes | every fact of section 1 has its command and output; no fact rests on a real old Node (simulation with a positive control, F1); what this design did not measure is named (end of section 1), with the gate's measurement of the chain |
| Q4 | yes | the one check command is unchanged; below the floor it stops at its first guarded step (NF-06, the sign ban of 7.1); CI is bound (section 6) |
| Q5 | yes | section 10 — every criterion has its test and every mutant of section 13 its named red row; every failure row checks that nothing changed (listings by sha256 in NF-05, NF-08, SV-39, HK-32…HK-37, SV-68, NF-07); the throwing-writer path has its row (NF-04); tests do not depend on each other (each builds its own folders) |
| Q6 | yes | no test removed or skipped, no rule turned off; CI rules widened; two titles renamed and named (section 11); the refusal is a non-zero code, never hidden; the sign ban is kept and given its own rows, not dropped |
| Q7 | yes | the refusal line holds only versions (a strange version text is not printed, section 2); children get named variables only; red messages carry no environment (AP-152); `npm run traces` 0 on both sketches (F18, F28) |
| Q8 | no | no customer data and no business space: the guards read only the Node version |
| Q9 | no | no query |
| Q10 | yes | a refused start is one plain line with nothing written; a candidate that cannot start is skipped; a stdin-reading candidate cannot take the event (HK-36); a hanging candidate is a stated limit (README line 207); a refused request does not bring a server down (SV-68, NF-07); a failing stderr write is swallowed with the code kept (NF-04) |
| Q11 | no | no address that a client or a user sets is called; `check-latest` reads the action's own manifest |
| Q12 | yes | `decisions/0101` (accepted), `0119` О1–О14, `0120` О1–О16 and `0002` followed; the first pass's open questions are answered by `0120` (section 18); this rework adds no disputable choice |
| Q13 | yes | the process points of step 03 (the denied command, a trial row that tested nothing) and of this rework (handoff of step 03c: an old test form in the sketch that hung under a mutant; an anchor of an instrument that went stale) are in the handoffs; `decisions/0120` О15 records the gate's proposal for AP-164 (DOC-UPDATER at step 10) |
| Q14 | yes | the handoff is closed with its result; the status, `STATE.md` and the defect by DOC-UPDATER at step 10 (section 16) |
| R1 | yes | no push here; the release goes with the records release M0.13 after the PASS of RELEASE-VALIDATOR (`decisions/0117` О33) |
| R2 | yes | the hook never writes a lost event later; a refused Pixel Office writes no start row (no state folder at all); no test and no trial touches the real state folder (section 9, safety; the five real files equal before and after each step of this design) |
| R3 | no | decision 0033 |

## 16. What becomes outdated outside the files of this work (for DOC-UPDATER and ORCH)

- REQ-104 (done), description: «Its last stdout line is the run record `e2e: command=<text> …`» — a refused runner prints nothing on stdout; corrected at step 10 (`decisions/0119` О12). The same sentence stands in `tools/README.md` line 840 (the e2e section); it joins the follow-up LOW defect with the lists below (`decisions/0120` О1).
- The per-command exit-code lists that do not name the refusal code (`decisions/0120` О1, to the follow-up LOW defect of `0119` О6): `tools/src/picker/cli.js` lines 17–18 with `tools/README.md` lines 623, 671–686 (the copy 684–685, pinned by PK-6d `picker-config.test.js:716-717`); `tools/README.md` lines 307, 409, 484 (team); `tools/test/e2e/kit/runner.js` line 161 (comment «0 … 1: anything else»); the header comments of `note.js` (253–254) and `office-report.js` (11–13).
- `CLAUDE.md` line 199, root `README.md` line 233, `.claude/agents/test-runner.md` line 41, `.claude/agents/release-validator.md` line 62 («Node 22»): the follow-up LOW defect of `0119` О6; REQ-001 criterion 15 (`0119` О11).
- `docs/design/REQ-030-github-check.md` line 108 («check-latest не задан»): history, not changed.
- Outside the project: the owner's running Pixel Office and picker restart on a Node at the floor is his (R2; AC0.4 was green on 2026-11-17); the old 22.21.1 build still installed on his computer is refused by every guard and skipped by the hook.

## 17. Named limits

1. **The module graph loads before the guard.** An ES module's imports are evaluated before its body, so a Node too old to load the modules fails with its own error before the refusal line. Only a simulated version was tried (the engine stays 22.23.4); on the sketch no import writes anything (F5, F21).
2. **A candidate whose `--version` does not answer** (`decisions/0120` О4). `hook.sh` has no timer (POSIX `sh` has none); the handler time-out of `.claude/settings.json` (4 s today; ST-05 allows 3–5 s) ends the hook and that event is lost. Node's own `--version` answers at once (about 0.01 s, F7). README line 207 states the limit in the words of section 8, next to the hook's limit, and NF-09 pins them (`decisions/0120` О12).
3. **Tool caches before the guard.** `prettier` and `eslint` write Node's shared compile cache under `TMPDIR` on every run (F14); npm keeps its log folder. Nothing of Sai or of the person's files (`decisions/0120` О3).
4. **`check-latest: true`** depends on the action's manifest being readable and brings a later 22.x sooner (TT-1a, section 11); not measured on GitHub.
5. **The hook asks `--version` of every candidate it tries**, so a slow binary costs each event its start time (a real Node: about 0.01 s, F7).
6. **The sign ban reads text, not shell.** It refuses three forms that write nothing — an input redirect, `(`, `|` or `)` inside a quoted glob, `$` inside quotes (7.1) — as accepted strictness (`decisions/0120` О13).
7. **The whole-line pin of README lines 157 and 207** (NF-09) makes any later edit of those two lines change the test in the same run; this is the purpose of `decisions/0120` О10 and О14.

## 18. Open questions

The nine questions of the first pass (О1–О9) are answered by `decisions/0120` (accepted, 2026-11-18): О1 the refusal code 2, documented on README line 9 and in the help of traces, handoffs-check and handoff, the other lists to the follow-up LOW defect; О2 the micro-amendment of criterion 6 (done, REQ110AMEND-20261118-01); О3 «writes nothing» means no project or personal file; О4 a named limit stated in the README (with О12: the exact sentence, now in section 8); О5 the guard right after the help branch; О6 the test instruments in each test's temporary folder; О7 the new module `tools/src/node-floor.js`; О8 the strict version shape; О9 no per-program prefix. The gate's points: О10 and О14 (NF-09), О11 and О13 (the sign ban kept as a design check, 7.1), О15 (a process rule, AP-164 at step 10), О16 (the gate task's slip). This rework leaves no new open question.

## 19. Closed in the rework of step 03c

Gate pass 1 (`handoffs/ISS-0092-20261117-01/step-03b-code-design-validator.json`, FAIL) and `decisions/0120` О10–О16. Each finding → the places changed → the measurement on the rework sketch (a fresh clone of the tag, 2026-11-18 06:49–07:05 UTC; F21–F28).

| Finding | Was | Became (places) | Measured |
|---|---|---|---|
| F1 (Medium) | NF-05 had one row per file; a guard inside one dispatched command stayed green (the gate's C01, C02) | 9.2: 21 rows — every one of the 14 `node <file>` scripts, keyed by the script, and six second commands (`pixel-office-note` storage off, `team project`, `traces hash-line`, `handoffs-check --emit-exceptions`, `handoff new`, `picker serve`) and `office-report`; 9.1 NF-05: the comparison with the script list; section 3: «one guard covers every command of a file»; section 13: the kind «guard inside one command» (C01–C04, C06, C07, M33); section 10 row 5 | F21 (tag: no refusal, nothing written but the test state of `pixel-office`; fix: 21 of 21 refused at 22.21.1 and 22.23.3); C01 red under rows `prepare-run`, `apply-verdict`, `snapshot`, `snapshot-diff`; C02 under `handoff` second command; C03, C04, C06, C07 under their rows |
| F2 (Medium) | no other-major row had (minor, patch) at or above the floor's (V07, K04 survived) | section 2: rows `23.24.0`, `24.23.4`, `23.23.4`, `21.24.0`, `21.23.4`; 9.1 NF-03 (and two read-from-the-rule rows: the next and the previous major above the floor's minor); 9.4 HK-35 as `v`-texts; section 4: the major compared with `-eq`; section 13: V07, K04 | V07 red under NF-03 row `23.24.0`; K04 red under HK-35 rows `v23.24.0`, `v24.23.4`, `v23.23.4`; the rows refused on the sketch and on the tag (F22) |
| F3 (Medium) | lines 157 and 207 were checked for presence only; the H1 form passed (`decisions/0120` О10) | 9.1 NF-09: both lines equal the exact texts of section 8; red copies: the H1 form of 157, a 207 without «takes only», a 207 without the hang sentence; 5.3 points to it; section 10 row 9 (`decisions/0120` О14) | F24: NF-09 green on the sketch; D01, D02, D03 red under NF-09 |
| F4 (Medium) | the README did not state the limit of a hanging candidate (`decisions/0120` О4) | section 8: line 207 gains «The hook has no timer of its own: a candidate whose `--version` does not answer holds the hook until the time-out of its handler in `.claude/settings.json` ends it, and that event is lost too.»; sections 0, 4, 14, 17 item 2 (`decisions/0120` О12) | the commands of criterion 9 and NF-01 with the final text (section 8: engines 1 and 1; (c) 1 and 1; (d) 1; (e) 4; NF-01 9 floor texts, no other); NF-09 green; D03 red |
| F5 (Medium) | the sign ban had no row that only it catches (N01 survived) | 7.1: five sign-only rows, three twins, three rows of accepted strictness, the record «stricter than the words of criterion 6, needed by its outcome and `0119` О5» (`decisions/0120` О11, О13); section 7 item 3; 9.1 NF-06; section 13 N01; section 17 item 6 | F25: N01 red under NF-06 row «sign ; touch x» (and the other four); the twins green, the strict rows red |
| L1 (Low) | the in-process rows of SV-39 had no limit; C05 and M12 hung | section 9 common rules: the stdout trap and a 10 s limit for every in-process refused row; 9.5 SV-39: the in-process rows 21.7.0, 22.21.1, 22.23.3, 23.0.0, 25.2.1 with the trap, children for the preload twin and the accepted rows | F23: C05 red at once under SV-39 in-process row `21.7.0`, no hang; the twin 1/1 in 358 ms; SV-39 sketch in the server file 73/73 |
| L2 (Low) | the swallowed throwing write had no row (V06) | section 2 (the guard's contract); 9.1 NF-04: a recording writer, a throwing writer (true, no throw), the floor with a throwing writer (never called); section 14 row | F26: V06 red under NF-04 row «throwing writer: the guard throws» |
| L3 (Low) | README line 9 said every script stops, while `--help` and a wrong call are answered | section 8: line 9 speaks of «a `node <file>` script … that is started to do its work» and names «`--help` and a wrong call are answered as on any Node» | the commands of criterion 9 ((a) line 9 and 0; (b) 0); E2K-60 and E2K-61 green; prettier clean |
| L4 (Low) | the picker's own header limit was not named | 9.3: `MAX_HEADER_BYTES = 16384` (`tools/src/picker/config.js:20`, `server.js:432`); NF-07 asserts the head under 16 384 and under that constant before the probes; section 13 P01 | F27: the head 12 550 bytes under both; P01 (the constant 8 192) red under NF-07's head check |
| L5 (Low) | the rule of a `node <file>` script was not stated | section 3: the pattern `^node ([^\s-][^\s]*)(?: (.*))?$`, the `test` script as the one other `node` script, a key before the file red; 9.1 NF-05 | 14 scripts in 10 files counted on the sketch and the tag (F2, F21) |

Also kept current (no statement older than the text, AP-143): the column «In criterion 6» of section 7 (the amended criterion now names all the options); section 18 (the answers of `decisions/0120`); sections 0, 1 (F21–F28, the gate's measurement of the chain), 10, 11 (the repeat of the earlier tests), 12, 13, 14, 15, 16 and 17.
