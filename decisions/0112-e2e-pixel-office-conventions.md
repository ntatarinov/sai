# 0112 — Conventions of the Pixel Office e2e spec and the change of the server starter for О15 (answers to the open questions О1–О17 of the design of REQ-106)

Status: **accepted** (ORCH, 2026-11-16, inside the owner's words of 2026-11-15 «продолжи» after the release of REQ-105, and of 2026-11-08 in `decisions/0110`; the owner can cancel each point).

## Question

The design `docs/design/REQ-106-e2e-pixel-office.md` (section 19) leaves seventeen questions for ORCH (WF-02, step 1a). They must be closed before the gate CODE-DESIGN-VALIDATOR. The design also proposes choices C-1…C-9 (section 2) that could be disputed and are recorded here (Q12). The first of them settles the precondition О15 of `decisions/0109`.

## Options

For each point the design names a default and what the other choice costs (section 19). No point is closed by a guess outside that table.

## Decision

- **О1.** Accepted, as section 4.1 and choices C-1…C-4 of the design: `stateEnv` (checked pairs "variable → folder") replaces `stateDirs`, and a call that still names `stateDirs` fails with `USAGE`; rule P applies to every absolute path in `stateEnv`, in a value of `env` and in an argument, also after the first `=` (under the temporary root, not the root itself, outside the repository), with one pinned exemption: the first argument (the script) may be an absolute path inside the repository; every stand gets the private home `<marker>/home`, given as `HOME` and `USERPROFILE`, set last, and `env` may not name them; `stop()` fails with `STAND_HOME_WRITTEN` when the server left anything in its home, with the precedence CLEANUP_FAILED > STAND_HOME_WRITTEN > STAND_STOP_TIMEOUT > STAND_EXIT. This closes the precondition О15 of `decisions/0109`.
- **О2.** Accepted: the hook's `HOME` is a folder of the test (`makeTempDir("hook-home")`), not the stand's home; "the same two variables" means the same two names, the state folder being the same value.
- **О3.** Accepted: the favicon line of the browser is declared exactly, with its path, once per start; criterion 7 "the kit reports no console error" is read as "the kit reports none besides the declared lines", as `decisions/0109` О4.
- **О4.** Accepted: while the server is down the refused-connection lines of `/api/events` are declared with `expect` (at least one, no upper bound), with the path; no other line is allowed.
- **О5.** Accepted with a condition: a port taken by another process between the stop and the restart fails the test with its cause named, by the three outcomes of section 4.4, test 6; no retry, no other port, no wait. The cause is recorded because it is rare but possible (the browser's own poll can hold the port on Linux). If it ever happens on any machine, it is a defect opened with the run's facts (WF-03), not a rerun until green (`docs/workflows/WF-02-development.md`, step 6), and the fix then is a WF-01 micro-amendment of the `--port 0` wording.
- **О6.** Accepted (C-6): criterion 5 gets the spec test `untouched home`; the hash of the real state folder is measured by RELEASE-VALIDATOR; the spec never reads the real folder.
- **О7.** Accepted: the spec proves that the time of an event lies inside the window of its own hook run and that the payload has none; that the server keeps the sent time is pinned by the unit test `SV-04b`. Mutant P07 is a survivor of the spec caught by that test.
- **О8.** Accepted (C-9): the mask test reads every place of C-9 (AP-145), more than criterion 4 names; the criterion's own places stay as it says.
- **О9.** Accepted: criterion 7 "the block «Сейчас» exists" is read as "is shown and starts with «Сейчас»".
- **О10.** Accepted: the line for a question to the owner on the runner is 30000 ms (60 % of the limit, the rule of `decisions/0109` О11). A value above it is a question, not a silent pass.
- **О11.** Accepted: DOC-UPDATER corrects at step 10 the place of `prepareText` (defined in `mask.js`, called by `protocol.js`) as an outdated fact without a change of meaning.
- **О12.** Accepted: the run edits the released tests as section 12 of the design lists (the starter tests `E2S-01`, `E2S-02`, `E2S-03`, `E2S-05`, `E2S-19`, the new `E2S-21`; the words or rows of `E2K-41`, `E2K-60`; the list of `E2K-50`); no prohibition is weakened. The sentence «guard tests: none» in the block of REQ-106 is an outdated fact, corrected by DOC-UPDATER at step 10 with `before_copy`.
- **О13.** Accepted (C-1): the private home lives inside the marker folder; `cleanup.js` is not changed.
- **О14.** Accepted: rule P refuses an absolute path inside the repository in `env`; no exemption now. The design of REQ-107 copies its trap under the temporary root or asks for a pinned exemption with a record.
- **О15.** Accepted (C-8): the spec imports `ROLE_NAMES` from `src/pixel-office/public/texts.js`, the data table that the requirement itself names; the words of the rows come from the README table, so the two oracles stay different sources.
- **О16.** Recorded as a limit: `os.userInfo()` still names the real home folder whatever `HOME` is; no server of Sai asks it today. A later change of the kit may check it.
- **О17.** Accepted: the mutants and the anti-pattern candidates are recorded by DOC-UPDATER at step 10 from `result.issues`.

## Why

Each answer is the default of the designer where the default keeps the work inside the criteria of REQ-106 (Q5) and inside the bar (Q4, Q6, Q7, R2); the starter change makes the private home and the checked folders a rule of every stand, so no stand of the kit can reach the owner's real Pixel Office folder through its home or a folder argument. Nothing here changes Pixel Office, and no rule is weakened to make a test pass. О5 keeps the honest "fail with the cause" and adds what to do if the rare cause is ever seen.

## Boundary

Only the run E2E106-20261115-01, the starter `stand.js` (its interface for every later stand) and the spec `pixel-office.e2e.js`. It does not decide REQ-107 beyond О14, and it does not fix the open defects ISS-0105, ISS-0107, ISS-0108 and ISS-0110 (ISS-0110 gets one more caller, written there by DOC-UPDATER).

## Basis

The owner's words of 2026-11-15 «продолжи» and of 2026-11-08 (`decisions/0110`); `decisions/0107`, `decisions/0108`, `decisions/0109` (О4, О11, О15); the design `docs/design/REQ-106-e2e-pixel-office.md`, sections 2, 4, 12 and 19; `handoffs/E2E106-20261115-01/step-01-code-designer.json`.

## Addendum 2026-11-16 (ORCH, WF-02 step 1b, after the second pass of the design gate, verdict PASS)

- **О18 (finding N1 of CODE-DESIGN-VALIDATOR, step 01d, Low).** The hook helper's check of its home folder and its check "not the temporary root itself" have no refusal case in test 1 (a); two mutants of them survive. TEST-DESIGNER adds at step 5 the two refusal calls the gate proposes (a home equal to the person's home folder; an office equal to the temporary root), each with the spawn that records and throws (rule R2-S of the design, section 6), each expecting `PATH_REFUSED` with the spawn not called, and the two mutants with the test that catches them. The design is not reworked for a Low finding; DOC-UPDATER carries the two cases into its sections 4.4 and 16 at step 10.
- **О19 (issue I3 of step 01d).** A preload that refuses, by throwing, any process start naming the person's home folder or the real state folder would make rule R2-S a mechanical check of every test process. It is a raise of the bar and needs the owner (quality-bar §4); ORCH asks the owner and does not add it in this run without his word.
- **Bookkeeping (issue I4 of step 01d).** `context.rework_of` is written only for old runs with the suffix `-rN` (`docs/workflows/handoffs.md`); ORCH wrote it on rework steps by letter in this run and in run `E2E105-20261105-01`. It is not removed from closed handoffs (bookkeeping files are only appended to) and is not written on later steps.
- **Basis:** `handoffs/E2E106-20261115-01/step-01d-code-design-validator.json` (N1, I3, I4).

## Addendum 2026-11-16 (ORCH, WF-02 steps 3 and 4, both gates PASS)

- **О20 (Low findings of the gates on the change of step 2).** SECURITY-REVIEWER (step 03) and REVIEWER (step 04) gave PASS with Low findings only, so the run goes on to step 5 without a rework of the code: a code fix would need both gates again for findings that do not block. DOC-UPDATER opens at step 10 one defect of the starter for the next kit change (WF-03) with REVIEWER's L1 (the script exemption is recognised by the reason text of `guards.js`; a reason code or an exported predicate there), L2 (`stateEnv` given as a `Map` is taken as an empty object instead of `USAGE`, against design 4.1; the home net catches a Pixel Office that then falls back to its home) and L5 (the header comment says every path is checked, while the working folder is not). The text points — L3 (the message names the real path), L4 and SECURITY-REVIEWER's F2 (the README credits `STAND_HOME_WRITTEN` to 0109 instead of 0112, names only `stateEnv` and arguments while `env` values are checked too, and dropped the limit of О16) — are corrected by DOC-UPDATER at step 10 in the design and the README together, keeping `E2K-41`, `E2K-60` and `E2S-19` green (AP-077). SECURITY-REVIEWER's F1 and REVIEWER's I3 are one more caller of ISS-0110; F3 is the known limit of rule P (BACKEND-DEV I6).
- **О21 (REVIEWER's remarks T1–T4 for the tests).** TEST-DESIGNER covers them at step 5 together with О18: a row of `E2S-02` for `{ stateDirs: undefined }` (M16), a case that removes `stand.homeDir` while the stand runs and expects the entry `(not readable: <code>)` (M20), a direct run of the stand-in with `HOME` equal to its temporary root expecting `home-refused` (M22), and `E2S-19` reading `stateEnv`, `STAND_HOME_WRITTEN` and 50000 as design 11.1 says (M25). The test of L2 is not written in this run: it would be red against the code as built and goes with the defect of О20.
- **О22 (REVIEWER's issue I4, for the design of REQ-107).** Rule P treats an `env` value that starts with an absolute path as one path, so a `PATH`-like list given in `env` is refused; the designer of REQ-107 settles it with О14.
- **О23 (REVIEWER's issue I5).** `docs/workflows/handoffs.md`, "Common rules for all roles", item 3 (a fresh clone, never `git archive`, for copies and trials) stands above the anti-pattern journal; the words of AP-136 item (1) that say the opposite are read by it. DOC-UPDATER appends a dated note to AP-136 at step 10 (the journal is only appended to).
- **Basis:** `handoffs/E2E106-20261115-01/step-03-security-reviewer.json` (F1–F3), `handoffs/E2E106-20261115-01/step-04-reviewer.json` (L1–L5, T1–T4, I2–I5, I7).

## Addendum 2026-11-16 (ORCH, WF-02 step 5b, after the first pass of the test gate, verdict PASS)

- **О24 (findings F1, F2, F3 of TEST-DESIGN-VALIDATOR, step 05b, all Low).** The gate passed on its first pass, so two passes remain, and the three findings touch only the spec. They are fixed in this run by TEST-FIXER (step 05c) with a new check of the changed part (step 05d), not moved to a defect: F3 is a matter of Q7, because a red `isolated start` prints the whole environment of the test process, and the GitHub logs of the open repository (`decisions/0111`) can be read by anyone. The fixes are the gate's smallest ones: F1 — one refusal of the hook helper whose office is a link to the real state folder (through the spawn that records and throws), and the recorded call made with link and `..` spellings of the test's own folders, asserting the real paths; F2 — at the end of `untouched home` and `reconnect` the state folder holds only the names of the README list, and in `reconnect` the whole listing (names and sha256) is the same around the hook run while the server is down; F3 — the sorted key names of the recorded environment are compared first, then the three values one by one, so that a red test prints no foreign variable. A FAIL of 05d sends the work back once more (pass 3 is the last).
- **Basis:** `handoffs/E2E106-20261115-01/step-05b-test-design-validator.json` (F1–F3).

## Addendum 2026-11-16 (ORCH, WF-02 step 5b, after the second pass of the test gate, verdict PASS)

- **О25 (findings G1 and G2 of TEST-DESIGN-VALIDATOR, step 05f, both Low).** The gate passed on pass 2. A further edit of the spec would need pass 3, the last one, whose FAIL stops the run, for two findings that do not block, so they are not fixed in this run. DOC-UPDATER adds them at step 10 to the defect of the kit and the spec opened by О20: G1 — under the gate's mutant A11 (the hook gets the test process's `HOME`) the red output of `isolated start` prints that value, the path of the person's home folder, against the letter of О24; it is not a secret, the regression is caught, and the fix is to compare the two folder values like `PATH` (`assert.ok` of a strict equality); G2 — the link cases of the hook helper are one link deep, so a helper that follows only one level passes them (mutant A4); there is no live gap, because the helper calls `assertUnderTempRoot`, which follows a whole chain, and the fix is a chain of two links in both cases.
- **Basis:** `handoffs/E2E106-20261115-01/step-05f-test-design-validator.json` (G1, G2).
