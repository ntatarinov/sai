# ISS-0141 — Texts that say "Node 22" without the floor, exit-code lists that do not name the refusal code, REQ-001 criterion 15 and the e2e run-record sentence: the follow-up of the Node floor (REQ-110)

Серьёзность: LOW. Статус: open. Найдено: DOC-UPDATER (шаг 10, прогон `ISS-0092-20261117-01`), по `decisions/0119` О6 и О11 и `decisions/0120` О1; заведено DOC-UPDATER, 2026-11-22T21:27:22Z. Пункт планки: Q12 (документы и код согласованы).
Требования: REQ-110 (the Node floor of the tools; the places below are outside its write set by `decisions/0119` О6); REQ-001 (criterion 15, status `blocked`).

## Что не так

Since REQ-110 the floor of `tools/` is 22.23.4, and every command of `tools/` refuses an older Node with code 2 (the Pixel Office server with code 1). The places below were read on 2026-11-22 (the line numbers are of that day; the numbers that the design and the decisions name have moved in CLAUDE.md and README.md). None is wrong in what it does; each is now inexact.

1. **"Node 22" without the floor** (`decisions/0119` О6; the design names CLAUDE.md line 199 and README.md line 233, now lines 212 and 234):
   - `CLAUDE.md` line 212: «`cd tools && npm run pixel-office` (Node 22 is needed)»; lines 13 and 96 say «Node 22» of the stack and are true as they stand (a reader decides).
   - `README.md` (the root) line 234: «You need: git; Node 22 with npm (`tools/package.json`, field `engines`)»; line 297: «Node 22, then in `tools/` — `npm ci` and `npm run check`».
   - `.claude/agents/test-runner.md` line 41: «`node -v` — Node 22 (`engines` in `tools/package.json`)».
   - `.claude/agents/release-validator.md` line 62: «`node -v` (Node 22 is needed; any other version is an environment failure …)»; line 187: «no Node 22».
2. **Exit-code lists that do not name the refusal code** (`decisions/0120` О1: the code is 2, documented once on `tools/README.md` line 9 and in the help of traces, handoffs-check and handoff):
   - the picker: `tools/src/picker/cli.js` lines 22-23 (the help text) with the copy in `tools/README.md` lines 687-688 and the lists at lines 626 and 674-679; the copy is pinned by the test `tools/test/picker-config.test.js` lines 716-717 (read it before editing; the help text changes with the test);
   - the team commands: `tools/README.md` lines 309, 412 and 487 («Exit codes: 0 … 1 …»);
   - the comments: `tools/test/e2e/kit/runner.js` line 161 («0 … 1: anything else»), `tools/src/pixel-office/note.js` lines 255-257 and `tools/src/pixel-office/public/office-report.js` lines 11-14.
3. **REQ-001 criterion 15** (`docs/requirements.yaml`, the block REQ-001, status `blocked` by `decisions/0099`): the hook criterion says «когда в PATH нет node или node в PATH — не v22 … если Node 22 на компьютере есть» and «Node 22 не найден». After REQ-110 the hook takes only a Node at or above the floor, so «Node 22» in it means «Node 22 not below 22.23.4» (`decisions/0119` О11).
4. **The e2e run-record sentence** (`docs/design/REQ-110-tools-node-floor.md` section 16; `decisions/0120` О1): `tools/README.md` line 843 says that the last line of the e2e output is `e2e: command=… selection=… exit=… duration_ms=…`; the runner refused by the guard below the floor prints nothing on stdout. The same sentence in the description of REQ-104 was corrected at step 10 of the ISS-0092 run (`before_copy` in that handoff); the README line was not touched there, because the write set of that step allowed it only on a finding of the validator, and the validator made none.

## Доказательство

`handoffs/ISS-0092-20261117-01/step-03d-code-design-validator.json` and `docs/design/REQ-110-tools-node-floor.md` section 16 (the places); `decisions/0119` О6, О11, О12; `decisions/0120` О1; the lines above, read in the files on 2026-11-22.

## Как исправить

1. Item 1: a wording that names the floor (for example «Node 22 not below 22.23.4») in the places that tell a person or an agent what to install or check; the two agent files are written by their owner (ORCH), not by a worker role.
2. Item 2: one sentence per list that the refusal of an old Node is code 2 (code 1 for `pixel-office`), as `tools/README.md` line 9 says; for the picker the help text, the README copy and PK-6d change together.
3. Item 3: a WF-01 micro-amendment of REQ-001 criterion 15 with the REQ-VALIDATOR gate (`decisions/0079` item 5); the criterion's meaning changes, so DOC-UPDATER alone does not edit it.
4. Item 4: one short clause in `tools/README.md` line 843 («below the floor the runner is refused before it prints anything»); the README lines that the tests of REQ-110 find by anchor (lines 9, 36, 157/207 and the M7 line) stay as they are.

## Маршрут

DOC-UPDATER for items 1, 2 and 4 (WF-03, documents only, with the tests that read these lines run on GitHub), WF-01 for item 3. Low: nothing is written or exposed by the inexact words.
