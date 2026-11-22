# 0120 — Conventions of the design of the fix of ISS-0092 (REQ-110, the tools/ Node floor): answers to the open questions О1–О9

Status: **accepted** (ORCH, 2026-11-18, inside the owner's answers to G1 of 2026-10-28 and his words of 2026-11-17 with `decisions/0115`; `decisions/0101` accepted; the owner can cancel each point).

## Question

The design `docs/design/REQ-110-tools-node-floor.md` (section 18; `handoffs/ISS-0092-20261117-01/step-03-code-designer.json`) leaves nine questions. One (О2) needs a WF-01 micro-amendment of REQ-110 before the design gate; the others are closed here.

## Options

For each point the design names a default and its measurement on a sketch with simulated Node versions.

## Decision

- **О1.** Accepted: the one refusal exit code of every entry point but Pixel Office (which keeps 1) and the hook (which keeps 0) is 2; it is documented once on `tools/README.md` line 9 and in the help of traces, handoffs-check and handoff, where 2 already means "an error of the call or the environment"; the other exit-code lists (the help of the other commands, `picker-config.test.js:716-717`) go to the follow-up LOW defect of `decisions/0119` О6.
- **О2.** Accepted, by a micro-amendment of criterion 6 of REQ-110 (run REQ110AMEND-20261118-01): the list of options that write gains the eight measured ones — eslint `--suppress-all`, `--suppress-rule`, `--suppressions-location`, `--prune-suppressions`, `--init`, `--mcp`, `--inspect-config`; prettier `--experimental-cli` — with the measured versions (prettier 3.9.9, eslint 10.11.0) named.
- **О3.** Accepted: "writes nothing" (`decisions/0119` О5) means no project file and no personal file of the person; the shared Node compile cache that prettier and eslint update under the temporary root is outside it and named as such.
- **О4.** Recorded as a named limit: no timer for a hook candidate whose `--version` hangs (Node's own `--version` does not hang; a stuck candidate would delay the hook); the README says so with the hook's limit.
- **О5.** Accepted: the guard stands right after the help branch, so `--help` works below the floor (criterion 11) and a wrong call is still answered by the usage line.
- **О6.** Accepted: test instruments are written into each test's own temporary folder; no new helper file.
- **О7.** Accepted: the rule lives in the new module `tools/src/node-floor.js` (a new module, so BACKEND-DEV writes it with CODE-FIXER's other edits, WF-03 step 4).
- **О8.** Accepted: the strict version shape (three whole numbers, no leading zeros, no part over nine digits; pre-release refused).
- **О9.** Accepted: no per-program prefix on the refusal line; the line is the same for every entry point.

## Addendum 2026-11-18 (ORCH, after the gate of the micro-amendment REQ110AMEND-20261118-01, PASS)

- **О10 (H1, Low).** The grep of criterion 9 (c) for README line 157 checks only «at or above 22.23.4», which is weaker than the sentence of the criterion (a line that keeps the old words and puts the floor in brackets passes it). The test of step 6 pins the whole sentence of the design for line 157 (and for line 207), so the line fails when its words change; the criterion's text is not changed.
- **О11 (REQ110AMEND issue I2).** The design's extra ban of signs inside the package scripts is stricter than criterion 6 (AP-159); the design gate judges whether it stays as a design check or is dropped.

## Addendum 2026-11-18 (ORCH, after gate pass 1 = FAIL, `handoffs/ISS-0092-20261117-01/step-03b-code-design-validator.json`)

- **О12 (F4).** О4 is met only by README words: the design writes the exact sentence that states the limit of a hook candidate whose `--version` hangs, next to the hook's limit, and runs it through the commands of criterion 9 and NF-01; no other way.
- **О13 (F5; the gate's judgment of О11).** The sign ban stays a design check: it is stricter than the words of criterion 6 but needed by its outcome («stops red at npm run traces … before any test runs») and by `decisions/0119` О5 («writes nothing»). The design gives it damaged copies that only it catches, benign twins it lets through, the forms it refuses although they write nothing (named as accepted strictness) and the mutant «ban removed».
- **О14 (F3 with О10).** The whole-sentence check of README lines 157 and 207 is a row of the design's test table under criterion 9, with the H1 form and a line 207 without «takes only» as red damaged copies — not only a promise for step 6.
- **О15 (the gate's issue I6).** Accepted as a process rule: when an ORCH answer at step 1a adds or changes design content (an exact text, a test row), ORCH returns that point to CODE-DESIGNER before the gate, or names it in the gate task as a known change. DOC-UPDATER records it in the error journal at step 10 (the next free number, AP-164).
- **О16 (the gate's issue I1).** The gate task's «0120 (О1-О10)» was ORCH's slip; the record (О1-О11) was the right source, as the validator worked.

## Addendum 2026-11-18 (ORCH, after gate pass 2 = PASS, `handoffs/ISS-0092-20261117-01/step-03d-code-design-validator.json`)

- **О17 (N1-N4, Low; the design is not reworked again, the points go to the next steps).** N1: TEST-DESIGNER at step 6 makes the second rows of `team` and `traces` in NF-05 commands that would write — `team new` with no arguments and `traces add` in a folder that is not a git tree (both measured by the gate to write nothing on the tag) — in place of, or beside, the read-only rows. N2: TEST-DESIGNER at step 6 adds a damaged copy with a line end inside a script to the sign ban's rows of 7.1 (npm runs the second line). N3: TEST-DESIGNER at step 6 makes the time limit of SV-39 end the test file, not only name the failure (for example, the in-process rows in a child process that is ended at the limit), or names it a limit with the reason. N4: the counts older than the text (F2 «12 rows», F4 and F7 «39 rows», «73/73» of the server file) go to the design's «As built» at step 10.

## Why

Each answer is the designer's measured default; the one change of the requirement (О2) adds measured writing options, so the criterion catches more.

## Boundary

Only the run ISS-0092-20261117-01. It installs no Node and touches no `.claude/settings.json`; the release goes with the records release M0.13 (`decisions/0117` О33).

## Basis

`docs/design/REQ-110-tools-node-floor.md` (sections 1, 2, 6, 9, 13, 18); `handoffs/ISS-0092-20261117-01/step-03-code-designer.json`; decisions 0101, 0117 О33, 0119.
