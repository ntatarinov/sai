# ISS-0132 — code design: the supported platforms Linux and macOS; every entry point that starts a real run or writes a state folder refuses another platform, the hook drops the event, the real executor refuses as the second layer, and the folder modes are read back (REQ-110 criteria 12-19)

Run `ISS-0132-20261123-01`, WF-03 step 3 (the design of the fix, in the form of WF-02 step 1). Base: the tag `base/ISS-0132-20261123-01` (commit d9104a3; `tools/src`, `tools/test` and `tools/README.md` of the working tree equal the tag). Inputs read: REQ-110 criteria 12-19 and the description paragraph «The supported platforms» (`docs/requirements.yaml`, committed in 9d39876, gate PASS `handoffs/ISS-0132-20261123-01/step-02d-req-validator.json`); the diagnosis `handoffs/ISS-0132-20261123-01/step-01-issue-fixer.json` (issues I1-I9); `decisions/0127` Г, `decisions/0134` item 4, `decisions/0136` О1-О8; the model `docs/design/REQ-110-tools-node-floor.md`; the code named in section 3.

This file holds shapes, signatures, tables and exact texts. It holds no implementation code. Every statement about how the code behaves today or after the fix was measured on fresh clones of the tag outside the project (section 1). Nothing is ported to Windows (`decisions/0127` Г, `decisions/0134` item 4): the fix only refuses.

---

## 0. Summary

- **One rule, one module.** A new pure module `tools/src/platform-guard.js` (beside `tools/src/node-floor.js`, in its pattern): the allow-list `SUPPORTED_PLATFORMS = ["linux", "darwin"]`, the rule `isSupportedPlatform(platform)`, the refusal line `platformRefusal(platform)` and the guard `refuseUnsupportedPlatform(stderr, platform = process.platform)`. Everything that is not exactly `linux` or `darwin` is refused (fail closed).
- **Five entry points refuse, each right after its floor guard:** `team` (`tools/src/team/cli.js`), `team-web` (`tools/src/web/main.js`), `pixel-office` (`tools/src/pixel-office/main.js`, after its help branch), `pixel-office-note` (`tools/src/pixel-office/note.js`, after its help branch) and `e2e` (`tools/test/e2e/run.js`). Codes: `pixel-office` 1, the others `NODE_REFUSAL_EXIT` (2). The floor guard stays first; `--help` of `pixel-office` and `pixel-office-note` is answered as before (`decisions/0136` О3).
- **The hook drops the event** (`tools/src/pixel-office/hook.js`): the first statement of `run()` asks the rule and returns; the hook ends with code 0, prints nothing, reads no state and sends nothing.
- **The second layer:** `check()` of `tools/src/team/executors/claude-cli.js` gets the first rule `E_PLATFORM` (`io.platform ?? process.platform`); `run()` calls `check()` before any spawn, so every path to a real process is covered. `E_PLATFORM` gets one row in `EXECUTOR_MESSAGES`, `PREFLIGHT_CODES` and `WHY_NOT_STARTED`.
- **The mode is read back:** `ensureHome(home, fsImpl = fs)` and `ensureStateDir(dir, fsImpl = fs)` read the mode again after `chmod` and refuse with `E_HOME` and `E_STATE_DIR` when it is still not 0700; the false notice «Права папки данных сужены до 0700 (были 0666)» is gone.
- **The thin client is not touched:** `tools/src/cli.js`, `tools/src/traces`, `tools/src/handoffs`, `tools/src/picker` and `tools/src/pixel-office/public` hold no word `platform-guard`.
- **README:** a new section `## Platforms` after `## Check`, and the two rights lines say «Linux and macOS».
- **Tests:** new `tools/test/platform-guard.test.js` (PLT-01 … PLT-15) and two tests in `tools/test/pixel-office-hook.test.js` (HK-41, HK-42). No earlier test changes (section 11). The prefix is `PLT`, not `PG`: `PG-01` … `PG-28` are taken by `tools/test/pixel-office-page.test.js` (measured, P13), and a shared id is the slip of ISS-0142.
- **Size (the sketch, P12):** 1 new module (27 lines), 12 changed code files (47 insertions, 15 deletions), README 8 insertions and 2 changed lines.

## 1. Checked facts (2026-11-23, 17:44-17:52 UTC, on the owner's Windows PC — a real win32, Node 22.23.4)

Two fresh clones of the tag outside the project (`git clone -c core.autocrlf=false --branch base/ISS-0132-20261123-01`, under `<scratch>`): «tag» unchanged, and «sketch» with the edits of sections 2-6 applied (the sketch, `result.prototype` of the handoff). Every start ran as a child with `HOME`, `USERPROFILE`, `TMPDIR`, `TEMP`, `TMP`, `SAI_TEAM_HOME` and `SAI_PIXEL_OFFICE_DIR` in its own box folder under `<scratch>`; servers on 127.0.0.1 port 0, stopped by their exact pid; `SAI_TEAM_REAL_RUNS` never set; no test file and no check command run. A preload (`node --import <preload>`) set `process.platform` from `SAI_TEST_PLATFORM` and the version from `SAI_TEST_NODE_VERSION` (as NF-05b). On this PC «real» means win32 itself; a `linux` or `darwin` preload here is only a control of the preload, the Linux behaviour is proved on GitHub (section 15).

| # | Fact | Command (shape) | Output |
|---|---|---|---|
| P1 | `process.platform` is a data property `configurable: true, writable: false`; the preload replaces it, also for `-p` | `node --import <preload> -p "process.platform + ' ' + require('node:path').sep"` with `SAI_TEST_PLATFORM` win32, linux, darwin | `win32 \`, `linux \`, `darwin \` (the separator stays the real one: `path` is chosen before the preload) |
| P2 | The module rule on the sketch | `isSupportedPlatform` over 15 rows | true only `linux`, `darwin`; false `win32`, `cygwin`, `freebsd`, `openbsd`, `aix`, `sunos`, `android`, `""`, undefined, `22`, 1 000 characters, `Linux`, `linux ` |
| P3 | The line and the guard on the sketch | `platformRefusal`, `refuseUnsupportedPlatform` with a recording and a throwing writer | the line of section 2 for `win32`; 1 000 characters, undefined → «неизвестная платформа»; `win32\n` gives no line end; win32 → true, one write equal to the line and `\n`; linux → false, no write; throwing writer → true, no throw; darwin with a throwing writer → false; no second argument on this PC → true |
| P4 | On the tag every entry starts on win32 and the two that write, write | `team new --goal <invented> --budget 1`; `team-web --port 0`; `pixel-office --port 0`; `pixel-office-note --text <invented>` with `SAI_PIXEL_OFFICE_STORE_TEXT=1`, a state folder with `port` and `write-secret` and a stub listener; `e2e no-such-spec` | team 0, a project created (5 entries in the box); team-web the link line; pixel-office the link line and its state written; note 1 «неожиданный ответ сервера 200» after a `POST /api/note` received by the stub (it read the secret, signed and sent); e2e 1 SELECTION_UNKNOWN |
| P5 | On the sketch every entry refuses on win32 | the same five starts | team 2, team-web 2, pixel-office 1, note 2 (the stub received nothing), e2e 2; stdout empty, stderr the refusal line, nothing written in the box; 92-391 ms, each child ended by itself |
| P6 | The floor guard stays first | the sketch under the preload `win32` and `22.21.1` | every entry: the floor's line «Нужен Node 22 не ниже 22.23.4, а запущен 22.21.1: …», codes 2 (pixel-office 1), nothing written |
| P7 | `--help` is unchanged | `pixel-office --help`, `pixel-office-note --help` on win32, tag and sketch | code 0 both; stdout sha256 `d80a1247…` and `fddcaf2e…` on both (equal to the REQ-110 facts F3); nothing written |
| P8 | The preload control on the sketch | the five starts under `linux` and `darwin` | team-web the link line; e2e 1 SELECTION_UNKNOWN; note 1 after a `POST /api/note`; team 1 `E_HOME … права 0700 не установились (сейчас 0666)` and pixel-office 1 «Права каталога состояния … не стали 0700 (сейчас 0666)» — the read-back of section 5 refuses them on this PC, where a mode cannot be set (the second protection works when the first is bypassed); the empty folder that `mkdir` created stays |
| P9 | The thin client is unchanged on win32 | `traces --help`, `handoffs-check --help`, `handoff --help`, `picker --help`, `picker check test/fixtures/picker/ok-minimal.json`, `prepare-run`, `validate`, `apply-verdict`, `snapshot` with `--root <box>`, `snapshot-diff`, `office-report.js --journal test/fixtures/pixel-office/events-fresh.jsonl` on tag and sketch | 11 of 11 the same code and stdout sha256 on both (help rows 0; picker check 0; the five WF-06 rows 2 E_USAGE; office-report 0), no refusal line, nothing written |
| P10 | The hook | `hook.js` with a valid state folder (port, write-secret) and a stub listener, the event JSON on stdin | tag: code 0, quiet, the stub received 1 request; sketch: code 0 in 70 ms, quiet, received 0, state folder unchanged; sketch under `linux`: received 1 |
| P11 | The executor | `check()` of the tag and the sketch with `io.platform` | tag: win32 with a valid request passes, win32 without budget `E_NO_BUDGET`; sketch: win32 `E_PLATFORM` with a valid request, without budget and with real runs off; linux valid passes, linux without budget `E_NO_BUDGET`; no `io.platform` on this PC `E_PLATFORM`; sketch `run()` under win32 rejects `E_PLATFORM`, the spawn spy is called 0 times (the tag's `run()` went past `check()`; with the probe's short request it then failed in `buildArgs`, so the test needs a full request, section 9) |
| P12 | The modes | `ensureHome`, `ensureStateDir` with the real fs of this PC and with an injected fs | tag real fs: `ensureHome` returns «Права папки данных сужены до 0700 (были 0666)» on the first and on the second call (false), `ensureStateDir` returns and the mode reads 666; sketch real fs: `E_HOME` «Папка данных Sai Team недоступна: права 0700 не установились (сейчас 0666)» and `E_STATE_DIR` «Права каталога состояния <dir> не стали 0700 (сейчас 0666): каталог не используется»; sketch with an fs whose chmod does nothing: the same two refusals; sketch with an fs that keeps what chmod sets: `ensureHome` returns «… сужены до 0700 (были 0755)», `ensureStateDir` returns; the tag ignores the injected fs |
| P13 | Test ids and README readers | `grep -ohE '^test\("PG-[0-9]+' tools/test/*.js`; the readers of the README sections | `PG-01` … `PG-28` in `pixel-office-page.test.js`; E2K-60 and E2K-61 read `## Check` up to the next `## ` (unchanged by a new section after it); ST-06, TM-50, SV-12, DC-01, NF-09 read words or anchors, not line numbers |
| P14 | README of the sketch (section 6) and the greps | `grep -c '^## Platforms$'`; `grep -n 'rights 0700'`; `grep -n 'folders 0700, files 0600'`; the `22.<n>.<n>` texts; `grep -c '>=22 <23'`; the grep of criterion 15; `node src/traces/cli.js` in the sketch | 1; one line each, holding «Linux and macOS»; only the floor and the M7 history 22.21.1 (as on the tag); 0; nothing printed (exit 1); «файлов проверено 2970, следов 0, пропущено 67», exit 0 |
| P15 | The new web text is plain words | a copy of `technical()` of `tools/test/team-web-helpers.js` with the codes of WEB-7a over `WHY_NOT_STARTED.E_PLATFORM`, `createdNotStarted(…)` and `resumeFailed(…)` | `[]` for all three |
| P16 | No child is left | the probes kill every child by its pid at the end | 54 + 7 children started, 0 alive at the end; no port 4780-4790 touched |

Not measured here, and why: every start on Linux and macOS under the `win32` preload (no Linux on this PC: WSL needs a virtualisation this PC does not have, and the checks run on GitHub, `decisions/0110`); the existing tests themselves (`node --test` is not run on this PC); `prettier` and `eslint` over the sketch (no `npm ci` on this PC). Section 15 says what GitHub must prove.

## 2. The rule — `tools/src/platform-guard.js` (new, BACKEND-DEV)

A pure ES module in the pattern of `tools/src/node-floor.js`: no `import`, no `process.env`, no `fs`, no `node:` word, no network word and no word of the bans of `tools/src/web/`, `tools/src/team/` and `tools/src/picker/` (WEB-9d, CTL-1c, CTL-5a, WEB-14, TM-49, TR-4b, TR-4c). `process.platform` stands exactly once, as the default of the second argument of the guard.

| Export | Shape | Contract |
|---|---|---|
| `SUPPORTED_PLATFORMS` | frozen array `["linux", "darwin"]` | the allow-list; the only place that names the run hosts in code |
| `isSupportedPlatform(platform)` | `(unknown) → boolean` | true only for a string equal to an element of the list (case and spaces count); everything else false: another name, `""`, undefined, null, a number, an object. No default: undefined is refused |
| `platformRefusal(platform)` | `(unknown) → string` | the refusal line without the line end (below); the platform is shown as given only when it is a string matching `^[0-9A-Za-z.+-]{1,64}$` (the shown shape of `node-floor.js`, a copy: the module imports nothing), else «неизвестная платформа», so the line is always one line with no control character |
| `refuseUnsupportedPlatform(stderr, platform = process.platform)` | `({ write(text) }, unknown) → boolean` | false when `isSupportedPlatform(platform)`, and then `stderr` is not touched; else writes the line and `"\n"` in one `write` (a `write` that throws is swallowed; the guard returns true and does not throw) and returns true. The caller stops at once with its exit code. An omitted or undefined second argument means the running platform (the language's default) |

**The refusal line** (exact words; the platform in place of `<платформа>`):

    Эта команда работает только на Linux и macOS, а запущена на <платформа>: команда остановлена, ничего не записано и не запущено. Windows — только клиент; подробности — tools/README.md, раздел «Platforms».

Russian only (`decisions/0136` О4), one line, holds Cyrillic letters, Linux, macOS and `tools/README.md`, no stack line (`^\s+at `), no value but the platform name (Q7). «раздел «Platforms»» names the heading `## Platforms` of section 6. It holds no `22.<n>.<n>` (the walk NF-01 stays green).

The module exports no exit code: the callers use `NODE_REFUSAL_EXIT` of `tools/src/node-floor.js` (criterion 13 names it) or 1 (Pixel Office).

## 3. The entry points

### 3.1 The places of the call

Rule: the platform guard is the next statement after the floor guard, in the same function; so it comes after the help branch where the program has one, and before any parsing of a command, any read of the environment, the disk or the network, and any server, child or browser. One guard per program, before the dispatch to a command (the `team` row `projects` of PLT-05 catches a guard put inside one command).

| # | File | Script | Function and place | Code | Help before it |
|---|---|---|---|---|---|
| G1 | `tools/src/team/cli.js` | `team` | `main(argv, env, io)`: right after `if (refuseBelowNodeFloor(io.stderr)) return NODE_REFUSAL_EXIT;` (line 453 of the tag), before `runGuarded`; writes to `io.stderr` | 2 | no help (`--help` is a wrong call; refused like the floor, the limit of ISS-0140) |
| G2 | `tools/src/web/main.js` | `team-web` | `run(argv, env, io)`: right after the floor guard (line 87), before `parseArgs`, `resolveHome`, `readConfig`; writes to `io.err` | 2 | no help (the same) |
| G3 | `tools/src/pixel-office/main.js` | `pixel-office` | `run(argv, env, io)`: right after `if (refuseBelowNodeFloor(io.err, version)) return 1;` (line 189), before `resolveStateDir`; writes to `io.err`; no seam of its own (the default reads `process.platform`) | 1 | yes (lines 181-184) |
| G4 | `tools/src/pixel-office/note.js` | `pixel-office-note` | `main(argv, io)`: right after the floor guard (line 277), before `storeTextEnabled`, `resolveStateDir`, the read of the secret and the request; writes to `io.stderr` | 2 | yes |
| G5 | `tools/test/e2e/run.js` | `e2e` | the one expression: the refusal code when the floor guard **or** the platform guard refuses (the floor first, so its line wins), else `runAll`; writes to `process.stderr` | 2 | no help (its `--help` is a spec name) |

Imports (relative only, TM-49, E2K-02): G1-G2 `../platform-guard.js` (the name `refuseUnsupportedPlatform`); G3-G4 `../platform-guard.js`; G5 `../../src/platform-guard.js`. G1 and G2 add only the import line and the call: no comment with a banned word of `tools/src/web/` (channel, inbox, child_process, …).

The protection stands in the same function and the same process as the work it protects, as the statement right after the floor guard; nothing is checked earlier and acted on later.

### 3.2 The hook — `tools/src/pixel-office/hook.js` (the silent drop)

The first statement of `run()` (line 70 of the tag), before the import of `config.js`, before stdin is read and before `resolveStateDir`: it imports `../platform-guard.js` (a dynamic import, as the hook's other modules) and returns when `isSupportedPlatform(process.platform)` is false. The hook then ends by its own `quit()`: code 0, nothing on stdout or stderr, no state read, no request (R2: the event is lost and never written later). A failed import ends the same way (the existing catch). The hook does not wait for stdin: `hook.sh` already ends without reading it when no Node is found (REQ-110 criterion 4).

### 3.3 The closed tables of the `node <file>` scripts (PLT-09)

The 14 `node <file>` scripts of `tools/package.json` (the rule of `docs/design/REQ-110-tools-node-floor.md` section 3, L5) stand each in exactly one table:

| Refused (criterion 13) | Thin client, not refused (criterion 15) |
|---|---|
| `team`, `team-web`, `pixel-office`, `pixel-office-note`, `e2e` | `prepare-run`, `validate`, `apply-verdict`, `snapshot`, `snapshot-diff`, `traces`, `handoffs-check`, `handoff`, `picker` |

and `tools/src/pixel-office/public/office-report.js` (no script) belongs to the thin client.

### 3.4 Every place of the diagnosis (I2) and what covers it

| Kind (I2) | Places | Covered by |
|---|---|---|
| A group stop | `team/executors/proc.js:16, :26`; `claude-cli.js:207-213, :231, :345` | reachable only through `claude-cli.js` `run()`: its `check()` refuses first (section 4), and the entries G1, G2 refuse before any engine; the code itself is not changed (no port) |
| B trust in 0700/0600 | `team/home.js` (ensureHome, inspectHome, project modes), `team/store.js:626-639`, `team/files.js:100`, `team/lock.js:184`, `team/engine/channel.js`, `pixel-office/state-dir.js`, `pixel-office/journal.js:69` | on win32 every writer is behind G1-G4; on Linux and macOS the two folder functions read the mode back (section 5); the files inside a refused folder are never written. The other places are named limit 2 (section 16) |
| C owner check | `team/home.js:90-96`, `team/engine/channel.js:111-117`, `pixel-office/state-dir.js:92` | behind G1-G4 on win32 (`getuid` exists on Linux and macOS) |
| D `O_NOFOLLOW` as 0 | team and Pixel Office places | behind G1-G4; the thin-client places are the LOW defect ISS-0144 (`decisions/0136` О7), not this fix |
| E `/bin/sh` | `pixel-office/hook.sh` | it starts `hook.js`, which drops the event (3.2) |
| F spawn detached | `claude-cli.js:207-213` | as A |

## 4. The second layer — the real executor

`check(request, io)` of `tools/src/team/executors/claude-cli.js` gets a new first rule, before `E_EXECUTOR`: when `isSupportedPlatform(io.platform ?? process.platform)` is false, it throws `executorError("E_PLATFORM")`. `io.platform` is a new optional field of the executor's io (a string; no production caller sets it; tests do). `run()` calls `check()` as its first statement (line 182 of the tag), so a refused platform throws before `buildArgs`, before `onEvent` and before `spawn`. The callers of `check()` — `run()`, `team/runner.js:254`, `team/engine/engine.js:177` (preflight, its io has no `platform`), `team/engine/single-run.js:191` — need no change; on Linux and macOS each behaves as today (P11: linux rows equal the tag).

The new rows (exact texts):

| File | Table | Row |
|---|---|---|
| `tools/src/team/errors.js` | `EXECUTOR_MESSAGES` | `E_PLATFORM: "Настоящие запуски на этой системе запрещены: только Linux и macOS (Windows — только клиент)"` |
| `tools/src/web/api.js` | `PREFLIGHT_CODES` (line 337) | `"E_PLATFORM"` at the end |
| `tools/src/web/texts.js` | `WHY_NOT_STARTED` (line 106) | `E_PLATFORM: "Sai Team работает только на Linux и macOS"` |

So the team CLI shows «E_PLATFORM: Настоящие запуски …» with code 1 (`exitCodeFor`: a refusal), a project created by the team web whose engine is refused answers «Проект создан, но работа не началась: Sai Team работает только на Linux и macOS», and a resume answers 409 «Проект не продолжен: Sai Team работает только на Linux и macOS» — never «внутренняя ошибка» (P15: plain words).

## 5. The mode read back

`tools/src/team/home.js`:

- `lstatOrNull(p, fsImpl = fs)` reads through `fsImpl.lstatSync`.
- `ensureHome(home, fsImpl = fs)`: `fsImpl` is an object with `lstatSync`, `mkdirSync` and `chmodSync` (the only three used; the result of `lstatSync` is read for `mode`, `uid`, `isDirectory()` and `isSymbolicLink()`). After a `chmodSync` it reads the mode again with `fsImpl.lstatSync`; when it is still wider than 0700 it throws `TeamError` `E_HOME` with the message «Папка данных Sai Team недоступна: права 0700 не установились (сейчас <mode>)» (`<mode>` four octal digits, as `modeText`). The notice «Права папки данных сужены до 0700 (были <mode>)» is pushed only after the read-back holds. An error of the read itself is `fromOsError(err, "write")`, as the `chmodSync` error today. The only caller `team/store.js:583` (`createProject`) is unchanged; `E_HOME` stops the creation before an id is chosen.

`tools/src/pixel-office/state-dir.js`:

- `lstatOrNull(target, fsImpl = fs)` reads through `fsImpl.lstatSync`.
- `ensureStateDir(dir, fsImpl = fs)`: the same three methods. After a `chmodSync` it reads the mode again; when it is absent or not exactly 0700 it throws `StateDirError` `E_STATE_DIR` (the code of «the directory or a file in it is unusable», state-dir.js line 9) with the message «Права каталога состояния <dir> не стали 0700 (сейчас <mode>): каталог не используется» (`<mode>` four octal digits, or «нет каталога»). The callers `pixel-office/main.js:211` and `test/pixel-office-helpers.js:144` are unchanged; `main.js` prints «Pixel Office: <message>» and ends with code 1 by its existing catch right after line 211, before `ensureSecret`, so no secret, port or start row is written.

On Linux and macOS with a normal file system `chmodSync` sets the mode and the read-back holds: the behaviour and the notices are those of the tag (P12, the obeying fs). The read-back is platform-independent: it also refuses a file system on Linux or macOS that keeps no modes.

## 6. The documents — exact texts (CODE-FIXER; agreed with PLT-15, AP-077)

**`tools/README.md`, new section** — inserted after the section `## Check` (after its last paragraph, before `## Pixel Office`), measured as lines 17-21 of the sketch:

    ## Platforms

    Sai Team (the core, the executors, the engine and the team web) and Pixel Office (the server, the hook and the note) run on Linux and macOS only: they stop a run by its process group and keep their folders private by the modes 0700 and 0600 and by the owner of a folder, and Windows gives none of these (defect ISS-0132; decisions/0127 and 0134). Nothing of them is ported to Windows. On any other platform these scripts stop at once, before they write or start anything, with one line in Russian «Эта команда работает только на Linux и macOS, а запущена на win32: команда остановлена, ничего не записано и не запущено. …» (this command runs on Linux and macOS only, and it was started on win32: the command is stopped, nothing is written or started): `npm run pixel-office` with code 1; `npm run team`, `npm run team-web`, `npm run pixel-office-note` and `npm run e2e` (it stops Chrome by a process group) with code 2. The help of `pixel-office` and `pixel-office-note` (`--help`) is answered as on Linux. The hook drops the event silently: code 0, no output, nothing is sent, and the event is lost (it is not written later). A real run of the executor `claude-cli` is refused there as well, with `E_PLATFORM`. If a folder still has wider rights than 0700 after they are narrowed (a file system that keeps no rights), the data folder of Sai Team is refused with `E_HOME` and the state folder of Pixel Office with the line «Права каталога состояния … не стали 0700», and nothing is written into it.

    Windows is a client: the documents, the site code, `npm run traces`, `npm run handoffs-check`, `npm run handoff`, the picker check (`npm run picker -- check`) and the commands of WF-06 (`prepare-run`, `validate`, `apply-verdict`, `snapshot`, `snapshot-diff`) work on it. The full check runs on GitHub (decisions/0110), and the worker of the site runs in a Linux container (decisions/0134, item 4).

(The section is a heading line, an empty line and two paragraphs, each one line in the file.) The section avoids the text `rights 0700`, so the grep of criterion 18 shows one line each.

**`tools/README.md`, the two rights lines** (only the words in the brackets are new):

| Line of the tag | Was | Becomes |
|---|---|---|
| 147 | «… in the folder `~/.sai-pixel-office/` (rights 0700). Not in `sai/`, …» | «… in the folder `~/.sai-pixel-office/` (rights 0700, which hold on Linux and macOS; on another platform Pixel Office does not start, section «Platforms»). Not in `sai/`, …» |
| 251 | «Rights: folders 0700, files 0600. If the rights are wider, …» | «Rights: folders 0700, files 0600 (these rights hold on Linux and macOS; on another platform the core does not start, section «Platforms»). If the rights are wider, …» |

Measured on the sketch (P14): `grep -c '^## Platforms$'` 1; each rights grep one line holding «Linux and macOS»; no `22.<n>.<n>` but the floor and the M7 history; no `>=22 <23`; the `## Check` section unchanged (E2K-60, E2K-61); the trace check 0.

## 7. Exit codes and what is printed

| Start on a refused platform | Code | stdout | stderr |
|---|---|---|---|
| `team …` | 2 | empty | the refusal line |
| `team-web …` | 2 | empty | the refusal line |
| `pixel-office …` | 1 | empty | the refusal line |
| `pixel-office-note …` | 2 | empty | the refusal line |
| `e2e …` | 2 | empty | the refusal line |
| `pixel-office --help`, `pixel-office-note --help` | 0 | the help | empty |
| any of these below the Node floor | the floor's code | empty | the floor's line only |
| the hook | 0 | empty | empty |
| `claude-cli` `check()`/`run()` (a seam or a missed entry) | the caller's: `team` 1, the team web 409/201 texts of section 4 | — | `E_PLATFORM: Настоящие запуски …` (CLI) |
| a folder whose mode does not hold (any platform) | `team` 1 (`E_HOME`), `pixel-office` 1 | empty | `E_HOME: …` / «Pixel Office: Права каталога состояния …» |

## 8. Failure paths — what the person sees, what stays unchanged

| Situation | What the person sees | What stays unchanged |
|---|---|---|
| A refused entry on Windows (or any other platform) | one line, the code of section 7 | everything: no folder, no file, no server, no child, no browser, no request (P5) |
| Below the floor on Windows | the floor's line (P6) | everything |
| `--help` of Pixel Office or the note on Windows | the help, code 0 (P7) | everything |
| A Claude Code session on Windows with the hook installed | nothing; the session goes on | the state folder and the journal; the event is lost, never written later (P10) |
| A real run reached through a seam or a future caller | `E_PLATFORM`, no process | the journal: `check()` writes nothing and throws before `onEvent` and `spawn` (P11) |
| The team web asked to start or resume an engine whose executor refuses with `E_PLATFORM` | 201 «Проект создан, но работа не началась: Sai Team работает только на Linux и macOS» / 409 «Проект не продолжен: …» | the project as created; no engine |
| A file system that keeps no mode, on any platform | `E_HOME` or the state folder line, code 1 | no project, no secret, no port, no start row; the empty folder a `mkdir` of this call created stays (P8; named limit 3) |
| The stderr of a refused command is closed | nothing; the code still says it | everything |

## 9. The tests (TEST-DESIGNER, step 6)

Common rules (as section 9 of the REQ-110 design):

- **Safety (R2).** Every child gets `HOME`, `TMPDIR`, `SAI_TEAM_HOME` and `SAI_PIXEL_OFFICE_DIR` inside the test's own fresh temporary folder, checked to lie under the real temporary root before the start; the environment is built from named variables only (`PATH`, those folders, `SAI_TEST_PLATFORM`, `SAI_TEST_NODE_VERSION`, and `SAI_PIXEL_OFFICE_STORE_TEXT=1` for the note row); `SAI_TEAM_REAL_RUNS` is never set; servers only with `--port 0`; every child has a 15 s limit and a `SIGKILL` in `t.after`; a server row that prints its link line where a refusal is expected fails at once.
- **The platform preload.** Written by the test into its temporary folder: with `SAI_TEST_PLATFORM` set it replaces `process.platform` by `Object.defineProperty` (P1); with `SAI_TEST_NODE_VERSION` set it replaces the version as NF-05b. Positive control in the file (PLT-08) and in the hook file (HK-42).
- **The module is imported inside the tests that need it** (a dynamic import), so that on the tag its absence makes those tests red while the rows that are green on the tag by construction stay readable.
- **Values in red messages** name a row, a code, a platform or a path of the test's temporary folder, never an environment (AP-152).

### 9.1 `tools/test/platform-guard.test.js` (new; created by this work)

| Id | Criterion | What it injects and asserts | On the tag |
|---|---|---|---|
| PLT-01 | 12 | `SUPPORTED_PLATFORMS` deep-equals `["linux", "darwin"]` and is frozen; `isSupportedPlatform` true for `linux`, `darwin`; false for `win32`, `cygwin`, `freebsd`, `openbsd`, `aix`, `sunos`, `android`, `""`, undefined, `22`, a text of 1 000 characters, and the design rows `Linux`, `linux `, `darwin\n` | red (no module) |
| PLT-02 | 12 | `platformRefusal` for `win32`, `cygwin`, `freebsd`: one line, Cyrillic, no `^\s+at `, no character U+0000-U+001F or U+007F-U+009F, holds `Linux`, `macOS`, `tools/README.md` and the platform; for `""`, undefined, `22`, 1 000 characters, `win32\n`, `a b`, `<x>`: «неизвестная платформа» and not the given text | red |
| PLT-03 | 12 | `refuseUnsupportedPlatform` with a recording writer: `win32` → true and exactly one write equal to `platformRefusal("win32") + "\n"`; `linux`, `darwin` → false and no write; a writer that throws: `win32` → true without a throw, `linux` → false and the writer never called | red |
| PLT-04 | 12 | the source text of `tools/src/platform-guard.js`: no `\bimport\b`, no `process.env`, no `\bfs\b`, no `node:`; `process.platform` exactly once, and that once is the default of the guard's second parameter (`platform = process.platform`) | red (no file) |
| PLT-05 | 13 | under the `win32` preload, each child on the running Node: `team new --goal <invented> --budget 1`, `team projects` (a second command: a guard inside one command is red), `team-web --port 0`, `pixel-office --port 0`, `pixel-office-note --text <invented>` with `SAI_PIXEL_OFFICE_STORE_TEXT=1`, a state folder with `port` and `write-secret` and a stub listener on 127.0.0.1 port 0, `e2e no-such-spec`: code 2 (pixel-office 1), stdout empty, stderr exactly `platformRefusal("win32") + "\n"` (read from the module), the listing with sha256 of the temporary folder the same before and after (state folder files included), no port file, the stub received nothing, the child ended by itself within the limit | red (P4: each starts; team and pixel-office write; note posts) |
| PLT-06 | 13 | the same rows under the preload `win32` with `SAI_TEST_NODE_VERSION=22.21.1`: stderr exactly the floor's line `nodeFloorRefusal("22.21.1") + "\n"`, the floor's code, nothing written | green by construction (the floor guard exists on the tag) |
| PLT-07 | 13 | `pixel-office --help` and `pixel-office-note --help` under `win32` and under the running Node: code 0 both, stdout byte-equal, stderr empty, nothing written | green by construction |
| PLT-08 | 13 | positive controls: a child `node --import <preload> -p process.platform` prints `win32`, `linux`, `darwin`; under `linux` and under `darwin` every row of PLT-05 goes on as under the running Node: the servers reach their link line (stopped by `SIGTERM`), `team new` creates its project in the temporary home, `team projects` lists, the note's stub receives its request, `e2e` ends 1 with SELECTION_UNKNOWN; no row prints the refusal line | green by construction |
| PLT-09 | 13, 15 | every `node <file>` script of `tools/package.json`, read when the test runs, stands in exactly one of the two closed tables of 3.3; every table entry is a script; a script in neither is red | green by construction |
| PLT-10 | 15 | under the `win32` and under the `linux` preload: `traces --help`, `handoffs-check --help`, `handoff --help`, `picker --help`, `picker check test/fixtures/picker/ok-minimal.json`, `prepare-run --root <tmp>`, `validate --root <tmp>`, `apply-verdict --root <tmp>`, `snapshot --root <tmp>`, `snapshot-diff`, `node src/pixel-office/public/office-report.js --journal test/fixtures/pixel-office/events-fresh.jsonl`: the same code and the same stdout byte for byte under both, no refusal line of criterion 12, nothing written in the temporary folder (P9 the values on win32) | green by construction |
| PLT-11 | 15 | no file under `tools/src/traces`, `tools/src/handoffs`, `tools/src/picker`, `tools/src/pixel-office/public` and `tools/src/cli.js` holds the text `platform-guard` (the grep of criterion 15 as a walk) | green by construction |
| PLT-12 | 16 | with the helpers of `tools/test/exec-executor.test.js` (a full request, a temporary work folder, an io whose `spawn` is a spy and whose config allows real runs; `claudeBin` a path that does not exist): `check()` with `io.platform = "win32"` throws `TeamError` `E_PLATFORM` for a valid request, for a project without budget, with real runs off and for a project of another executor; with `io.platform = "linux"` it goes on (a valid request passes, without budget `E_NO_BUDGET`); `run()` with `io.platform = "win32"` rejects `E_PLATFORM`, the spy is called 0 times, `onEvent` 0 times, the journal unchanged | red (P11: the tag passes) |
| PLT-13 | 16 | `EXECUTOR_MESSAGES.E_PLATFORM` and `WHY_NOT_STARTED.E_PLATFORM` are strings; the source of `tools/src/web/api.js` holds `"E_PLATFORM"` once, inside `PREFLIGHT_CODES`; `controlFailure(…, "resume", new TeamError("E_PLATFORM", <bait>))` answers 409 with `resumeFailed(WHY_NOT_STARTED.E_PLATFORM)`; a team web whose fake engines refuse a new project with `E_PLATFORM` answers 201 «Проект создан, но работа не началась: » + that text; neither holds `WHY_OTHER` or the bait | red |
| PLT-14 | 17 | `ensureHome` and `ensureStateDir` with an injected fs over the real one whose `chmodSync` does nothing and whose `lstatSync` reports the mode bits 0o666: for a folder that does not exist and for one that exists → `TeamError` `E_HOME` / `StateDirError` `E_STATE_DIR`, the message one line, Cyrillic, no stack, holding «0700» and «0666», no notice returned and no text «сужены»; with an injected fs that keeps what `chmodSync` sets (a folder reported 0o755) → the tag's notice and no throw; with the real fs on Linux: a new folder 0700 and no notice, a 0755 folder narrowed to 0700 with the notice (as today) | red (the tag ignores the injected fs) |
| PLT-15 | 18 | `tools/README.md`: exactly one line `## Platforms`, right after the `## Check` section; that section holds «Linux and macOS», «Windows is a client», each of `npm run pixel-office` with «code 1» and `npm run team`, `npm run team-web`, `npm run pixel-office-note`, `npm run e2e` with «code 2», «drops the event silently», `E_PLATFORM`, `decisions/0110` and `decisions/0134`; `rights 0700` on exactly one line, which holds «Linux and macOS»; `folders 0700, files 0600` on exactly one line, which holds «Linux and macOS». A later edit of these words changes this test in the same run (AP-077) | red |

### 9.2 `tools/test/pixel-office-hook.test.js` (two tests added; every test of the tag unchanged)

| Id | Criterion | What it injects and asserts | On the tag |
|---|---|---|---|
| HK-41 | 14 | `hook.js` started as `hook.sh` starts it (`node <hook.js>`, the event JSON on stdin) under the `win32` preload, with a valid state folder (`port` of a stub listener on 127.0.0.1 port 0 and a `write-secret` of 50 characters) and a private home: code 0 within 2 000 ms, stdout and stderr empty, the stub received no request, the listing with sha256 of the state folder unchanged | red (P10: the stub receives the event) |
| HK-42 | 14 | the positive control: a child under the preload reports `win32`; the same start under the `linux` preload: the stub receives one `POST /api/events`, code 0, quiet | green by construction |

## 10. Criterion → test

| Criterion | Design element | Test (red when it is violated) |
|---|---|---|
| 12 The platform rule | section 2 | PLT-01 (`cygwin` row against U1; `darwin`, `linux` rows against U2, U3), PLT-02 (the hostile rows against U4; the words against U6), PLT-03 (the throwing writer against U5; one write against U7), PLT-04 (purity against U8) |
| 13 The entry points refuse | 3.1 G1-G5, 3.3 | PLT-05 (each guard dropped E1-E5; the codes E8; `team projects` against E9), PLT-06 (the order against E6), PLT-07 (help against E7), PLT-08 (controls), PLT-09 (the closed tables against T2) |
| 14 The hook drops the event | 3.2 | HK-41 (H1-H3), HK-42 (control) |
| 15 The thin client keeps working | 3.3; no edit of those files | PLT-10 (T1), PLT-11 (the grep), PLT-09 |
| 16 The real executor refuses as the second layer | section 4 | PLT-12 (X1-X3), PLT-13 (X4, X5); the walks of `team-web-words.test.js` (WEB-7a and line 195), `team-web-control.test.js:1408` and `team-web-create.test.js` WEB-3f stay green with the new row |
| 17 The mode is read back | section 5 | PLT-14 (M1-M4) |
| 18 The documents name the platforms | section 6 | PLT-15 (D1, D2); the commands of criterion 18; NF-01 and the commands of criterion 9; E2K-60, E2K-61, ST-06, SV-12, TM-50, DC-01, NF-09 stay green; `npm run traces` |
| 19 The checks of the platform rule | the whole work | the GitHub run of section 15; PLT-05, PLT-12 (and PLT-13) red on a fresh clone of the tag with only the new tests; `git diff --name-status base/ISS-0132-20261123-01 -- tools/test` with no `D`; `traces` and `handoffs-check` 0 |

Every new test above carries a criterion.

## 11. Replacement table of earlier guard tests

**None changes («was → became»: none).** No earlier test counts the files of `tools/src` by a closed list that the new module would break, and none pins the edited lines. The tests that read the changed places and must stay green (by reading the code and the sketch; their runs are the GitHub run):

| Test | File:line (tag) | What it reads | Why it stays green |
|---|---|---|---|
| the order and texts of `check()` | `exec-executor.test.js:640-680`, `exec-budget.test.js:108`, `exec-roles-tools.test.js:111`, `team-engine.test.js:290, :376`, `team-engine-gaps.test.js:445` | `E_EXECUTOR`, `E_REAL_RUNS_OFF`, `E_NO_BUDGET` | on Linux the new first rule passes; the order after it is the tag's (P11) |
| the walks over `WHY_NOT_STARTED` | `team-web-control.test.js:1408` (resume answers 409 for every code but `E_DISK`), `team-web-create.test.js:291` (WEB-3f), `team-web-words.test.js:195, :203` (WEB-7a) | every row | `E_PLATFORM` is added to `PREFLIGHT_CODES` and `WHY_NOT_STARTED` together (section 4); the text is plain words (P15). A row added to only one of them turns `:1408` red |
| TM-49 | `team-deps.test.js:32` | imports of `tools/src/team` | `../platform-guard.js` and `../../platform-guard.js` are relative and outside `pixel-office/` |
| WEB-9d, CTL-1c, CTL-5a, WEB-14 | `team-web-guard.test.js:252`, `team-web-control.test.js:372, :661`, `team-web-docs.test.js:90` | banned words of `tools/src/web` and `tools/src/team` | G1, G2, section 4 add an import and a call only |
| TR-4b, TR-4c and the host rules | `traces-runtime.test.js:74, :133, :220-256` | network and `child_process` words; the hosts of `hook.js` | the module has neither; the hook gains no host and no `post(` |
| E2K-02, E2K-50 | `e2e-kit.test.js:376, :3821` | imports and variables of `run.js` | one more relative import, no variable read |
| HK-11h and the hook tests of the tag | `pixel-office-hook.test.js` | the real `hook.js` run on Linux | the guard passes on Linux; HK-11h replaces `hook.js` whole |
| SV-29, SV-30 and the mode tests | `pixel-office-server.test.js:602-625`, `team-store.test.js:100-125` | narrowing 0755 → 0700, notices, warnings | on Linux the read-back holds and the notices are the tag's (P12, the obeying fs) |
| NF-01, NF-05, NF-08, NF-09 | `node-floor.test.js` | the floor texts, the entries below the floor, `--help`, README lines 157 and 207 | the platform guard comes after the floor guard (P6, P7); the new texts hold no `22.<n>.<n>` (P14); lines 157 and 207 are not edited |
| E2K-60, E2K-61, ST-06, SV-12, TM-50, DC-01 | as in REQ-110 | README words and sections | `## Check` is unchanged; the new section ends it where `## Pixel Office` ended it; no anchored word is edited (P13, P14) |
| PG-20 | `pixel-office-page.test.js:1063` | `tools/src/pixel-office/public` | not touched |

No test is deleted, skipped, renamed or weakened.

## 12. Build sub-steps, owners, write sets

First the shared contract (the module), then the sides. No two roles write one file.

| Step | Who | Files | Tests red after it (by reading and the sketch) |
|---|---|---|---|
| S1 | BACKEND-DEV (a new module, WF-03 «Roles») | `tools/src/platform-guard.js` (new) | none |
| S2 | CODE-FIXER | `tools/src/team/cli.js`, `tools/src/web/main.js`, `tools/src/pixel-office/main.js`, `tools/src/pixel-office/note.js`, `tools/test/e2e/run.js` (3.1) and `tools/src/pixel-office/hook.js` (3.2) | none on Linux |
| S3 | CODE-FIXER | `tools/src/team/executors/claude-cli.js`, `tools/src/team/errors.js`, `tools/src/web/api.js`, `tools/src/web/texts.js` (section 4) — the two web rows in one step | none (the `:1408` walk needs both rows) |
| S4 | CODE-FIXER | `tools/src/team/home.js`, `tools/src/pixel-office/state-dir.js` (section 5) | none on Linux |
| S5 | CODE-FIXER | `tools/README.md` (section 6) | none |
| T (step 6) | TEST-DESIGNER | `tools/test/platform-guard.test.js` (new), `tools/test/pixel-office-hook.test.js` | none after; on a clone of the tag the rows of section 9 marked red are red |

**The write set of CODE-FIXER (step 04), exactly:** `tools/src/team/cli.js`, `tools/src/web/main.js`, `tools/src/pixel-office/main.js`, `tools/src/pixel-office/note.js`, `tools/test/e2e/run.js`, `tools/src/pixel-office/hook.js`, `tools/src/team/executors/claude-cli.js`, `tools/src/team/errors.js`, `tools/src/web/api.js`, `tools/src/web/texts.js`, `tools/src/team/home.js`, `tools/src/pixel-office/state-dir.js`, `tools/README.md` (13 files). The new module `tools/src/platform-guard.js` is BACKEND-DEV's by WF-03 «Roles»; if ORCH gives it to the same step, it is the fourteenth file. Not in any write set: `docs/requirements.yaml`, the thin-client files of 3.3, `tools/package.json`.

After each step on GitHub's runner (not on this PC): `npm run -s format:check`, `npm run -s lint`, `npm run -s traces` and the named test files; the full `npm run check` once at the end (section 15).

## 13. Mutants (each applied in a copy; the test that catches it)

The tag itself is the mutant «guard absent» of every place, measured on win32 (P4, P10, P11, P12: each entry starts, the hook sends, `check()` passes, the notice is false). The others are by construction, to be applied by CODE-DESIGN-VALIDATOR and TEST-DESIGN-VALIDATOR on Linux.

| Id | Breakage | Caught by |
|---|---|---|
| U1 | a deny-list `platform !== "win32"` in place of the allow-list | PLT-01 (`cygwin`, `freebsd` rows) |
| U2 | `darwin` dropped from the list | PLT-01, PLT-08 (darwin control) |
| U3 | `linux` dropped from the list | PLT-01, PLT-08, every test of the tag that starts an entry |
| U4 | the shown-shape check removed | PLT-02 (the 1 000-character and `win32\n` rows) |
| U5 | the `try`/`catch` around the write removed | PLT-03 (the throwing writer) |
| U6 | the line in English, or without `tools/README.md` | PLT-02 |
| U7 | two writes (the line and the line end apart), or a second line | PLT-03, PLT-05 (exactly the line) |
| U8 | the module reads `process.env` or imports `node-floor.js` | PLT-04 |
| E1-E5 | the guard dropped from `team`, `team-web`, `pixel-office`, `pixel-office-note`, `e2e` | PLT-05 (its row) — measured as the tag (P4) |
| E6 | the platform guard put before the floor guard (in any entry) | PLT-06 |
| E7 | the guard of `pixel-office` or of the note put before its help branch | PLT-07 |
| E8 | `pixel-office` refuses with 2, or another entry with 1 | PLT-05 (the codes) |
| E9 | the guard of `team/cli.js` only in the command `new` | PLT-05 (row `team projects`) |
| H1 | the hook's drop removed | HK-41 — measured as the tag (P10) |
| H2 | the drop placed after `post` | HK-41 (the stub receives) |
| H3 | the hook writes a word when it drops | HK-41 (quiet) |
| T1 | a platform guard added to `traces/cli.js`, `src/cli.js`, the picker or `office-report.js` | PLT-10 (that row), PLT-11 |
| T2 | a `node <file>` script added to `package.json` in neither table | PLT-09 |
| X1 | the `E_PLATFORM` rule dropped from `check()` | PLT-12 — measured as the tag (P11) |
| X2 | `E_PLATFORM` after `E_NO_BUDGET` (not the first rule) | PLT-12 (the row without budget, the row of another executor) |
| X3 | `io.platform` ignored (`process.platform` only) | PLT-12 (on the Linux runner the win32 rows pass) |
| X4 | `E_PLATFORM` missing from `PREFLIGHT_CODES` | PLT-13 (409 text), `team-web-control.test.js:1408` |
| X5 | `E_PLATFORM` missing from `WHY_NOT_STARTED` | PLT-13 (the 201 text) |
| M1 | the read-back of `ensureHome` removed | PLT-14 — measured as the tag (P12) |
| M2 | the read-back of `ensureStateDir` removed | PLT-14 |
| M3 | the read-back only after `mkdir`, not after the narrowing of an existing folder | PLT-14 (the existing-folder row) |
| M4 | the injected fs ignored (the module `fs` used for `chmodSync` or `lstatSync`) | PLT-14 (on Linux the real fs obeys, no throw) |
| D1 | the section `## Platforms` missing or under another heading | PLT-15, the command of criterion 18 |
| D2 | a rights line without «Linux and macOS» | PLT-15 |
| G1 | a test of the tag deleted or skipped | criterion 19 (`git diff … -- tools/test` with no `D`), Q6 |

Never applied (unsafe): a mutant that gives a test the real home or the real state folder, or that starts the real `claude`.

## 14. Quality bar

| Item | Applicable | How it is met |
|---|---|---|
| Q1 | yes | REQ-110 criteria 12-19, each mapped in section 10 to a design element and a test |
| Q2 | yes | CODE-DESIGN-VALIDATOR repeats the facts of section 1 on fresh clones and applies mutants of section 13; then SECURITY-REVIEWER, REVIEWER, TEST-DESIGN-VALIDATOR (the new tests red on the tag), RELEASE-VALIDATOR |
| Q3 | yes | every fact of section 1 has its command and output, on a real win32; what was not measured is named (end of section 1) and goes to GitHub (section 15) |
| Q4 | yes | the one check command is unchanged; the new tests run in it |
| Q5 | yes | section 10; every refusal row checks that nothing changed (the listings by sha256, the stub that receives nothing, the journal of PLT-12); the throwing writer has its row; each test builds its own folders |
| Q6 | yes | no test removed, skipped or weakened (section 11); a refusal is a non-zero code, never hidden; the hook's 0 is the rule of REQ-001 and of criterion 14 |
| Q7 | yes | the line shows only a platform name of a safe shape; the state-folder message names the folder as the tag's messages do; children get named variables only; `npm run traces` 0 on the sketch (P14) |
| Q8 | no | no customer data and no business space: the guard reads only the platform name |
| Q9 | no | no query |
| Q10 | yes | a refused start is one plain line with nothing written; a refused real run is a TeamError with a plain text in the CLI and the team web, never «внутренняя ошибка»; a stop that cannot stop (the win32 group stop) is never reached; a mode that does not hold is a refusal, not a false notice |
| Q11 | no | no address that a client or a user sets is called |
| Q12 | yes | `decisions/0127` Г and `0134` item 4 (fail closed, no port), `0136` О1-О8 (О2 e2e refuses, О3 help, О4 Russian only, О6 the read-back, О7 ISS-0144), `0002` (Node 22, no dependency), `0110` (GitHub); the choices left to the design (the line's words, `E_STATE_DIR`, the prefix PLT, the hook's place) are not disputable against a record |
| Q13 | yes | the process point of this step (a test-id prefix from a task example that collides with an existing file) is in the handoff; the anti-pattern of the defect is DOC-UPDATER's at step 10 (`0136` О8) |
| Q14 | yes | the handoff is filled with its result; REQ-110's status by ORCH and DOC-UPDATER (`0136` О1) |
| R1 | yes | no push here; ORCH pushes after the green checks and the RELEASE-VALIDATOR PASS (`decisions/0134` item 2) |
| R2 | yes | the hook never writes a lost event later; a refused Pixel Office writes no start row; no test touches the real state folder |
| R3 | no | decision 0033 |

## 15. What must be proved on GitHub (decisions/0110)

1. `check.yml` green on a temporary branch `ci/iss-0132-…` with the fix (ubuntu-24.04, Node 22 at or above the floor), read with `gh run view`; its log shows PLT-01 … PLT-15, HK-41 and HK-42 as `ok`, and every test of the tag still `ok` (section 11).
2. The red record: a fresh clone of the tag with only the new tests added, on a separate temporary branch (or a Linux container with the GitHub run as the evidence): PLT-05, PLT-12, PLT-13, PLT-14, PLT-15, PLT-01 … PLT-04 and HK-41 red; PLT-06 … PLT-11 and HK-42 green; recorded with the run id by TEST-DESIGN-VALIDATOR or TEST-RUNNER.
3. In the same green run, the Linux side that this PC could not measure: the `win32` preload takes effect on Linux (PLT-08, HK-42 controls); the thin client is the same under `win32` and `linux` (PLT-10); the existing group-stop, mode and floor tests stay green (the fix does not change Linux behaviour).

## 16. Named limits

1. **No port.** On Windows the team core, the team web, Pixel Office and the e2e runner do not run at all; the group stop, the modes and the owner check are not made to work there (`decisions/0127` Г, `decisions/0134` item 4).
2. **Other mode writers are not read back.** `ensureModes`, the project files of `team/store.js`, `team/files.js`, `team/lock.js`, `team/engine/channel.js`, the secret and the small files of `state-dir.js` and `journal.js` still `chmod` without a read; on Windows they are behind the entry refusal, and on Linux and macOS a file system that keeps no modes is refused earlier by the folder read-back of the same folder (section 5). A file system mounted later inside a checked folder is not covered (not a criterion; a follow-up LOW if ORCH wants it).
3. **The empty folder of a refused `mkdir` stays.** When the read-back refuses a folder that this call created, the empty folder stays (P8); nothing is written into it, and the next start refuses it the same way.
4. **`process.platform` can be lied to** by a preload in the same process; the guard protects against a wrong host, not against a hostile local user (out of the threat model of the owner's single-user computer).
5. **The thin client's `O_NOFOLLOW ?? 0`** stays: LOW defect ISS-0144 (`decisions/0136` О7).
6. **A wrong call of `team`, `team-web` and `e2e` on Windows** gets the refusal line, not the usage line (they have no help; the same as below the floor, ISS-0140).

## 17. What becomes outdated outside the files of this work (for DOC-UPDATER and ORCH)

- `docs/anti-patterns.md`: the entry «a protection that depends on the OS falls back silently to "pass"» (`decisions/0136` О8; diagnosis I8), at step 10.
- REQ-110 status line (the gate's P1 of step 02d: the dated line for the rework 02c), at step 10; ISS-0132 closed with the release.
- The per-command exit-code lists that do not name the platform refusal: the comment of `main` in `tools/src/pixel-office/note.js` (lines 255-257 of the tag) and `tools/README.md` lines 309, 412 and 487 (team, executors, engine) — they already miss the floor's code (ISS-0141); the platform refusal joins that LOW.
- Outside the project: the owner's Windows PC keeps the Pixel Office hook handlers only if he copies them; with this fix they drop every event silently there, which is the intended behaviour of criterion 14.

## 18. Open questions

None for ORCH. Two notes recorded in the handoff (`result.issues`): the test-id prefix `PLT` in place of the task's example `PG` (P13), and the owner of the new module by WF-03 «Roles» (section 12).
