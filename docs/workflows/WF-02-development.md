# WF-02 — Development

How a checked requirement becomes a working, checked and recorded change. Every producing step
is checked by another agent (quality-bar Q2), and no step is skipped: where a step is not
needed, this is recorded with the reason.

All roles follow `docs/quality-bar.md`; handoffs follow `docs/workflows/handoffs.md`.
Before the work, every role reads `docs/anti-patterns.md`.

## When it starts

- The requirement has passed WF-01 (PASS of REQ-VALIDATOR), everything in its `depends_on` is
  `done`.
- **Product code** — only after the owner's decision to start, recorded in `STATE.md`, and after
  the decision on the stack with one check command (number 0001 in `decisions/README.md`,
  quality-bar Q4). **Service code** of the pipeline in `tools/` — by
  `decisions/0002-process-tooling-node.md`, the check command is `cd tools && npm run check`.
- It **does not start** for a defect of behavior that is already described — that is WF-03.
- If the requirement changes the interface by a sample or a screenshot, the interface
  description is made by WF-04 and is part of step 1.
- If the interface changes without a sample, this is the variant "Interface without a sample"
  (step 7): the description is written by GUI-DESIGN-ANALYST, there is no comparison with a
  sample (`decisions/0079`, item 13).

One run holds no more than **four** requirements: if something breaks, less has to be redone.

## Roles

| Role | What it does | Who checks |
|---|---|---|
| ORCH | Prepares the run, writes handoffs, keeps the route and the gates, checks the bookkeeping, writes the report to the owner. Does not write code — except an edit on the short path (AP-009) | — |
| CODE-DESIGNER | The design: interfaces, data, failure paths, "criterion → test" | CODE-DESIGN-VALIDATOR |
| GUI-DESIGN-ANALYST | The interface description from a sample (WF-04) | CODE-DESIGN-VALIDATOR |
| BACKEND-DEV, FRONTEND-DEV | Code by the checked design, in sub-steps; translations of data texts and page texts | SECURITY-REVIEWER (always; whether its area is touched is decided by it) and REVIEWER at the same time; translations are read by BA-ANALYST and by new launches without context (step 8) |
| CODE-FIXER | Fixes by the remarks of the checks | again SECURITY-REVIEWER and REVIEWER at the same time, then the check whose remarks it closed |
| TEST-DESIGNER | Tests and mutants | TEST-DESIGN-VALIDATOR |
| TEST-RUNNER | A run of one check command | RELEASE-VALIDATOR (runs it again itself) |
| TEST-FIXER | Analyzes a failed run, fixes the test or the code | a code fix — SECURITY-REVIEWER and REVIEWER, a test fix — TEST-DESIGN-VALIDATOR; then a new run of TEST-RUNNER |
| DESIGN-QA-VALIDATOR | Compares the finished interface with the approved sample (the interface only) | — (a checker itself) |
| BA-ANALYST, UAT-RUNNER | The user's scenarios and their run on the running system (pages — in a real Chrome); BA-ANALYST sums up the result of the readers of texts | BA-ANALYST signs the result, then RELEASE-VALIDATOR |
| RELEASE-VALIDATOR | The final check of all criteria and of the bar | — (a checker itself) |
| DOC-UPDATER | The status, `STATE.md`, documents, the log of errors | ORCH checks files and fields |
| RELEASE-FINALIZER | The commit of the run files, the push to `main` after the PASS of RELEASE-VALIDATOR, waiting for `check.yml`, the release report | ORCH checks the commit; a merge in any other way is confirmed by the owner (R1) |

## Route

```
0 ORCH
→ 1 CODE-DESIGNER (+ GUI-DESIGN-ANALYST by WF-04, if the interface changes by a sample;
     without a sample — by the variant of step 7)
→ 1a ORCH answers the questions of the design with a record in decisions/
→ 1b CODE-DESIGN-VALIDATOR                      gate
→ 2 BACKEND-DEV / FRONTEND-DEV — in sub-steps of the design
→ 3 SECURITY-REVIEWER ‖ 4 REVIEWER — at the same time, both only read      gate
     (SECURITY-REVIEWER always runs; outside its area — PASS "out of scope"
     with a reason, decided by it, not by ORCH)
     FAIL at 3 or 4 → CODE-FIXER → 3 and 4 again
→ 5 TEST-DESIGNER
→ 5b TEST-DESIGN-VALIDATOR                      gate
→ 6 TEST-RUNNER                                 gate
     FAIL → TEST-FIXER → code fix: 3 and 4 again; test fix: 5b → 6 again
→ 7 DESIGN-QA-VALIDATOR (only an interface by a sample)  gate
     FAIL → CODE-FIXER → 3 and 4 again → 6 → 7
→ 8 UAT-RUNNER (+ BA-ANALYST, if there are scenarios; readers of texts) — if there is a running system  gate
→ 9 RELEASE-VALIDATOR                           gate
→ 10 DOC-UPDATER, then the check by ORCH
→ 11 RELEASE-FINALIZER → commit, push to main, waiting for check.yml, a second commit with the handoff of the step
```

## Steps

**Step 0 — ORCH prepares the run.**

1. Checks the prerequisites from the section "When it starts" — by the files, not from memory.
2. Creates `handoffs/<RUN-ID>/` and moves the status of the requirement `pending` →
   `in_progress` (only this field).
   Sets the lightweight git tag `base/<RUN-ID>` on the commit from which the run starts (before
   the first change) and writes its name into `context.base_tag` of every handoff
   (`decisions/0031`): the checks "what changed in the run" take the base only from this tag.
   The tag is set in every workflow, not only in WF-02.
3. Decides which files the run may change and checks them against the runs that go in parallel:
   two runs do not write one file at the same time. A shared file — in turn
   (`context.file_lock`) or by blocks (`context.edit_scope`).
4. Writes `context.route`, `context.write_set` and `context.parallel_work_now` in every
   handoff.
5. The tag `base/<RUN-ID>` serves as the "before" copy: the agent takes "before" from a fresh
   clone of the tag outside the project (`git clone -b base/<RUN-ID>`), not from a copy made by
   hand. The rules for all roles are in `docs/workflows/handoffs.md`, "Common rules for all
   roles".

**Step 1 — CODE-DESIGNER writes the design** `docs/design/REQ-NNN-<short>.md`:

- interfaces, data shapes, commands and their exit codes, which files are read and written;
- every failure path: what the user sees and what stays unchanged;
- protection stands in the same operation as the action it protects: "check now, do later, in
  another call" is not allowed;
- the table "criterion → test" (Q5);
- the section about the bar: for each item Q1–Q14 and R1–R3 — "applicable: how it is met" or
  "not applicable: why". Silence about an item is a gap;
- open questions — as a list, not settled by a guess; a choice that could be disputed is a
  proposal of a record in `decisions/` (Q12);
- there is no implementation code: only shapes, signatures, tables;
- checked facts about the current system: the command, the output, the date of the measurement;
- a trial sketch outside the project on which the statements of the design were measured
  (`result.prototype`: where it lies and what is in it);
- the table of replacements of earlier tests: every guard test of released requirements that
  turns red because of new modules, paths, commands or addresses (a search in `tools/test/`) —
  the file, the line, "was → became"; the prohibition is not weakened by the replacement (AP-068,
  AP-112, AP-113);
- the build sub-steps in small parts and for each — which existing tests will turn red (checked
  with the sketch);
- the list of mutants — intentional breakages, one per trap, with the test that catches it;
- what becomes outdated outside the project (for DOC-UPDATER).

If the requirement changes the interface by a sample, GUI-DESIGN-ANALYST first writes the
interface description (WF-04, step 1), and the design relies on it.

**Step 1a — ORCH answers the questions of the design.** The open questions of the design (О1,
О2 …) are closed by ORCH with a record `decisions/NNNN-<short>-conventions.md` with the section
«Основание» (Basis) (Q12) before gate 1b; the answers go into the tasks of the gate and of the developers.

**Step 1b — CODE-DESIGN-VALIDATOR, gate.** Reads the design (and the interface description, if
there is one) itself, not from the `summary` of the author, and checks:

- every criterion leads to an element of the design and to a test; there are no "we will decide
  later";
- signatures, data and errors are described in full;
- the section about the bar is complete;
- protection is not separated from the action;
- no contradiction with `decisions/` without a proposal of a new record;
- there is no implementation code;
- the statements of the design about how the system works now are repeated by the checker
  itself, on a fresh clone of the tag `base/<RUN-ID>`, not on the working folder;
- it runs the earlier tests after the replacement table itself; it applies at least 10 mutants
  of the design itself; it assesses the size and the order of the sub-steps (a sub-step that
  cannot be checked separately is a remark).

Any item not passed is a FAIL. There is no partial credit.

**Step 2 — BACKEND-DEV and FRONTEND-DEV write the code.**

- Only by the design that has passed step 1b, and only in their own files
  (`context.write_set`).
- Goes by the sub-steps of the design: after each one runs the checks and names the red tests.
  Only a test from the list of the design for this sub-step may be red; a red test not from the
  list is a stop and a report to ORCH.
- Two work in parallel in different files. A shared contract (for example, a schema file) is
  written by one, the other only reads it and reports divergences.
- Every saved file is consistent with the others: a parallel run may start a check at any
  moment.
- While others write their files, only one's own can be checked; at the end — the whole check
  command (Q4) and its real output. Errors of others are named with evidence (quality-bar §6,
  item 4).
- Only a test that checks the behavior intentionally changed by the design may fail: each such
  test is named in `result.issues` with the section of the design and the new expected behavior,
  and TEST-DESIGNER fixes it at step 5. Such a failure "expected by the design" is allowed only
  between steps 2 and 5; from step 5b there is none.
- Self-check by the bar: Q7 (no secrets, the client holds no keys), Q8, Q9, Q10 (timeouts,
  understandable errors), Q11, R2 (Pixel Office events — only from the hooks), R3.
- If a shared type or function changes — find by search all the places where they are used.
- If it is necessary to depart from the design — stop and return the question to CODE-DESIGNER
  through ORCH. Do not depart silently.

**Steps 3 and 4 go at the same time:** SECURITY-REVIEWER and REVIEWER both only read and do not
disturb each other. A FAIL of either — CODE-FIXER, then both checks again.

**Step 3 — SECURITY-REVIEWER, gate.** Always runs; whether its area is touched is decided by
SECURITY-REVIEWER itself, not by ORCH. Its area is customer data, secrets, photos of people,
external calls, access rights and writing into the system from outside (for example, the
acceptance of hook events by the Pixel Office server).

- First decides whether its area is touched. If not — PASS "out of scope" with a reason.
- Otherwise for each item Q7–Q11 and R3 (for Pixel Office also R2): applicable and met (what
  confirms it — its own command) or not applicable (why). The details of the items are in
  quality-bar §2.1.
- Looks for secrets in the change and in the files that the browser receives.
- For input from the network, from a file and from a server response, tries hostile inputs with
  its own oracle, not with the same expression as the code: enumeration, fuzzing, ReDoS, length.
  For a page, replaces the server response and the storage in a real browser. The numbers of
  trials go in `summary`.
- Any applicable item not met — FAIL. All such findings are blocking.
- Its PASS is not final: a merge in any way other than the push to `main` by step 11 is
  confirmed by the owner (R1).

**Step 4 — REVIEWER, gate.**

- Is it a real solution or a crutch that hides the symptom.
- The idioms of the stack (for `tools/` — `decisions/0002-process-tooling-node.md`).
- Work that the requirement did not ask for is a finding.
- A divergence from `decisions/` without a new record is a finding.
- Erosion of the bar is a FAIL even if the code works: a skipped or deleted test, a disabled
  rule, a hidden exit code, a TODO instead of a check, a "temporary" secret (Q6, Q7).
- A check against `docs/anti-patterns.md`.
- The severity of findings is by the common scale of `docs/workflows/handoffs.md` (section
  "result"): Critical, High and Medium — FAIL; Low is recorded and not lost.

**CODE-FIXER — after a FAIL at steps 3 or 4.**

- Fixes only the listed findings; does not touch or "improve" other code.
- Changes behavior only if the finding is exactly about wrong behavior.
- Runs one check command; in `result.changes` — every edit with the number of the finding. A
  test that checks behavior changed by a finding is named in `result.issues`, as at step 2: after
  steps 3–4 it is fixed by TEST-DESIGNER at step 5, after step 7 (the route 3 → 4 → 6) — by
  TEST-FIXER from the failed run.
- What cannot be fixed without changing the design — in `result.issues`; ORCH will return it to
  CODE-DESIGNER.
- Then steps 3 and 4 again, and only after that — the tests: an edit of code that has already
  passed review does not go further without a new review.

**Step 5 — TEST-DESIGNER writes the tests.**

- First decides whether there is anything to test. If the change is only documents or settings
  without executable logic, writes "nothing to test" with the list of files and the reason;
  steps 5b and 6 are skipped, and RELEASE-VALIDATOR checks the criteria by reading and commands.
  A test that looks for a word in a document just for show is a deception of the check (Q6).
- Otherwise, for each criterion — at least one runnable test, named by the criterion, that would
  fail if the criterion were violated (Q5).
- A failure test checks that the state did not change.
- The oracles are its own: a test does not import rules from `src`. Property tests go with a
  pinned seed; cases are built by the class of inputs, not by the example of the criterion.
- Earlier tests by the replacement table of the design are fixed first, without weakening: the
  number of `test(` and `assert.` in the old files is not lower than at the tag `base/<RUN-ID>`.
- Where the change concerns them: the business space A does not see and does not change the data
  of B (Q8); every external call with a failure (Q10); an internal address is rejected (Q11).
- Tests are independent, each has its own data; there is no dependence on the clock or on
  randomness without a seed; there are no secrets.
- For new logic — mutants: intentional breakages by the list of the design and for each — which
  tests fail (in `self_check`: what is broken → which tests failed → how many). A test for new
  code, before the code appears, fails simply because there is no code — this says nothing about
  whether it catches an error.
- The tests that developers or CODE-FIXER named in `result.issues` as checking intentionally
  changed behavior are fixed by TEST-DESIGNER at this step. The step is handed in with a passing
  check: only a failure that is proven not to be caused by this work is allowed (quality-bar §6,
  item 4).
- It runs the tests itself for self-check; the final run is step 6.
- TEST-DESIGNER does not change code. If a test needs a change of a code file that has already
  passed step 4, it writes about it in `result.issues`; the edit is made by CODE-FIXER, and
  steps 3 and 4 go again before step 5b.

**Step 5b — TEST-DESIGN-VALIDATOR, gate.**

- Reads the tests itself.
- Every criterion has at least one runnable test; there is no `skip`, `todo`, "we will add it
  later".
- Failure tests check that the state is unchanged.
- Each test has its own data; tests do not depend on the order; there are no secrets.
- The tests of Q8, Q10, Q11 are there where the change concerns them.
- Runs the tests itself: three runs in a row, each new test separately; for stability tests — a
  series of dozens of runs under load (AP-115).
- For new logic, itself applies at least 20 mutants from the list of the design and several of
  its own around the changed places (the numbers go in `summary`) and makes sure the tests fail;
  a surviving mutant is a finding. A mutant "the failure did not trigger" must not hang the run
  (AP-116). A mutant is applied in a temporary copy; the working tree does not change, and this
  is checked (the list of hashes before and after is the same), and the tests are green again.
- The replacement of earlier tests weakened nothing: every row of the replacement table is
  checked against the file, the number of `test(` and `assert.` in the old files is not lower
  than at the tag.
- A run is acceptable if the code is 0 or every failure is proven not to be caused by this work;
  there is no category of a failure "expected by the design" here.
- Any item not passed — FAIL.

**Step 6 — TEST-RUNNER, gate.**

- Runs one check command in full, not a selection, and waits for it within its own turn;
  attaches the real output: how many tests, which failed, the exit code.
- Analyzes each failure: caused by this work or not — only with evidence (quality-bar §6, item
  4). Without evidence it is an unanalyzed failure, and on ORCH's instruction an ISS is created.
- A test that sometimes passes and sometimes fails is a defect: an ISS is created. A restart
  until green is not a PASS. A red test is not repeated until it is green; a flaky test is a
  defect, and ORCH tells the owner (`decisions/0079`, item 2).
- PASS is code 0 or every failure proven not to be caused by this work; anything else is a FAIL,
  and then TEST-FIXER. There is no category of a failure "expected by the design" here.

**TEST-FIXER — after a FAIL at step 6.**

- Decides what is wrong — the code or the test — by the requirement: the requirement is the
  source of truth.
- The code gives a result that is wrong by the requirement — fixes the code. The test expects
  something other than the requirement demands, or is prepared wrongly — fixes the test.
- Does not delete or skip a test; does not fit the test's expectation to wrong code.
- Repeats the failed command, then the whole check; in `result.changes` — every edit and why the
  code or the test is to blame.
- Before the new run, a code fix is checked again by steps 3 and 4, a test fix by step 5b; then
  step 6 again.

**Step 7 — DESIGN-QA-VALIDATOR, gate** (only if an interface by an approved sample was made).
The order is in `docs/workflows/WF-04-ui-by-sample.md`, step 4. FAIL → CODE-FIXER → steps 3 and
4 again → step 6 → step 7 again.

*Interface without a sample (`decisions/0079`, item 13).* The owner did not approve a sample:
the interface description is written by GUI-DESIGN-ANALYST, it serves as the measure, and
`summary` records «образца нет, мерило — описание» ("no sample, the measure is the
description"). DESIGN-QA-VALIDATOR does not run; instead, the page is accepted by UAT-RUNNER in
a real Chrome by the matrix of windows, themes and languages with snapshots (step 8).

**Step 8 — acceptance on the running system, gate.** The tests of step 6 show that the code does
what is written; the acceptance shows that the person for whom the work is done gets what is
needed on the live system. The step is needed if the change has a running system and someone who
uses it: the Pixel Office page (used by the owner), the page of the virtual team Sai Team (used
by the business owner), the solution picker site `tools/src/picker/` (used by a visitor of the
site).

*Acceptance without BA-ANALYST scenarios.* It is allowed when the criterion and the design
themselves describe the steps of the acceptance (commands and windows): then UAT-RUNNER follows
them and writes `docs/uat/<REQ-ID>-RUN.md` (`decisions/0079`, item 6). The signature of
BA-ANALYST is needed when there is a scenario file `docs/uat/<REQ-ID>.md`.

1. **Scenarios — BA-ANALYST.** The document `docs/uat/<REQ-ID>.md`; it stays in the project and
   is run again as a regression at the next changes. A scenario is written in the words of the
   one who acts — in the language of the owner and the business: who, what they do, what they
   must see. The document must contain:
   - the main path;
   - a scenario for every failure path from the criteria of the requirement;
   - scenarios for the applicable Q8, Q10, Q11, R3;
   - for the page of the virtual team — bad conditions: the executor does not answer, the
     spending ceiling is used up, the server is restarted in the middle of the work, the
     internet is slow; for service pages like Pixel Office — the server does not answer, there
     are no events yet, there are very many events.

   In the `result` of the handoff `step-08-ba-analyst.json` — the path to the document and, for
   each scenario, which criteria it covers.
2. **The owner's spending — ORCH, before the launch.** If the run spends the limit or the money
   of the owner (for example, a real Claude Code session that writes Pixel Office events), ORCH
   gets their consent in advance. Without consent such a scenario is not run and is recorded as
   «не выполнен: нет согласия владельца» ("not run: no consent of the owner"); the other
   scenarios go as usual.
3. **The stand — ORCH, before the launch.** ORCH itself checks that the system is running and
   answers, and passes its address. If it does not answer — the acceptance does not start, the
   reason is recorded. For Pixel Office the stand is a separate server with a new empty state
   directory outside the project (`--dir`): events made up for the check go only there. The
   server marks every accepted event as real, so what is made up never gets into the owner's
   working log — only events of real sessions (R2).
4. **The run — UAT-RUNNER.** Every scenario on the real system: real requests, files and data,
   without substitutes. **Pages** — in a real Chrome without a window, by the debugging protocol:
   windows 1470 × 784, 390 × 844 and 320 × 568, light and dark themes, languages ru, kk, en;
   the snapshots lie outside the project. No Chrome — a stop, `curl` does not replace the step.
   The expectation of a scenario is taken from the criterion verbatim; if a scenario is wider
   than the criterion, the extra is a "remark, not a failure", and it gets into the criterion
   only through WF-01 (AP-117). The result of a scenario is the **observable state of the
   system** that UAT-RUNNER itself asked for again after the action and compared with the
   expected one in the scenario; silence in the logs and on the screen is never a result. An
   example for Pixel Office: the hook sent an event of the start of work of a role — it is
   checked that the log of the separate server received a record with this role and that the
   page, opened anew, shows the character of this role at the desk; the snapshot and the server
   response are attached. A scenario that cannot be run is "not run" with a reason, not a skip.
   Photos and data are only taken and made up for tests, not of real people (AP-004). The
   results go in the `result` of the handoff `step-08-uat-runner.json`.
5. **The signature — BA-ANALYST.** In a separate signature handoff, BA-ANALYST confirms which
   scenarios passed on the running system. If there is a scenario file, the gate of step 8 stays
   closed (not passed) without the signature.
6. **Translations and texts — the readers.** Translations are written by the role that writes
   the code (BACKEND-DEV or FRONTEND-DEV), one language per launch; there is no separate role of
   a translator (`decisions/0079`, item 7). They are read by separate new launches without
   context: they are given only the lines "number — key — Russian — translation". Round 1 — all
   lines, round 2 — the corrected ones, round 3 — the ones corrected again; 2–3 rounds in all.
   Disputed lines after two rounds are not given to a reader: they go to a person who knows the
   language (`FOR_NATIVE_SPEAKER`, AP-114). Step 8 may consist of the readers only; then
   BA-ANALYST sums up the result without a running system, and the criterion is considered met
   only in the part of the reader agents.
7. **A scenario did not pass.** ISSUE-FIXER analyzes the cause, the fix goes with the checks of
   WF-03 in the same run, after which the acceptance is repeated.

**Step 9 — RELEASE-VALIDATOR, gate.**

- Itself runs one check command and attaches the output. The number of failures may differ from
  step 6 — in itself this is neither a confirmation nor a breakage; every "not because of this
  work" is derived anew (quality-bar §6, item 4).
- Checks each criterion on the system and in the files, not by the reports of previous steps. If
  a criterion names a test file, does `ls` on that file (AP-123).
- For the server and the pages — its own series of stability runs and its own mutants; a probe
  that it started itself it stops by the process identifier, not by a name pattern (AP-119).
- Goes through the bar as a list: every item Q and R is PASS or "not applicable" with a reason.
  One unexplained hole is a FAIL.
- Checks that the statuses and documents have not fallen behind what was done.
- On a FAIL — names to which step and to which role to return.

**Step 10 — DOC-UPDATER, bookkeeping.**

- The status of the requirement → `done` — only after the PASS of step 9, as the last action of
  the step.
- `STATE.md` and `PLAN.md`: what works (how it is checked), what is decided, what is next.
- Defects for findings on the way are created and supplemented by the numbers of ORCH. If a
  criterion is met only in part, this is recorded as it is: which part, which not.
- In the requirement block DOC-UPDATER changes the status and the comment on it. A name, a
  reference, a number and an outdated fact in the text of the block it corrects without changing
  the meaning, with `before_copy` in `result`; any change of the meaning of a criterion is a
  micro-amendment of WF-01 with the REQ-VALIDATOR gate (`decisions/0079`, item 5).
- The documents that describe the changed behavior (for example, `tools/README.md`).
- The process errors of this run — in `docs/anti-patterns.md` (Q13); the raises of the bar
  accepted by the owner — in quality-bar §3.
- In `result.artifacts_out` — every changed file by name.
- Before writing DONE, ORCH checks each named file and field with its own commands and writes
  the output in `context.orch_check`.
- There ORCH itself goes through the applicable items Q and R by files and fields, not by
  reports. A missed item is a rework step, not a note for later.

**Step 11 — RELEASE-FINALIZER, release.**

- Before the commit, takes the fresh state of `main`; a conflict is a stop and a question to the
  owner, nothing is overwritten by force.
- Commits only the files of the run, each by name, except the handoff of its own step (AP-091):
  "add everything" is not allowed; secrets, temporary files and `node_modules` are not
  committed. The commit message names the requirement.
- Sends the commit to `main` with an ordinary push after the PASS of RELEASE-VALIDATOR, on the
  owner's word of 2026-10-11 (`decisions/0048`, `0062`, `0079`, item 1). A force-push, tags,
  other branches and `--no-verify` — only on the owner's word.
- Waits for the result of `check.yml` (`gh run list --workflow check.yml`). It does not fix a
  red result: a stop and a report to ORCH. A red test is not repeated until it is green; a
  flaky test is a defect, and ORCH tells the owner (`decisions/0079`, item 2).
- Writes the release report `docs/releases/<RUN-ID>.md`: what was done, which checks passed
  (with references to the handoffs), which commits, what was not done and why.
- Closes its handoff and hands it in as a second commit.
- A merge in any other way and a change of GitHub settings — only after the owner's confirmation
  (R1).
- ORCH checks: the first commit holds exactly the files of the run, and the report matches the
  handoffs.

## Short path

A small edit may be made by ORCH itself or given to one role without the full route — only if
**all** of this is true:

1. exactly one file changes;
2. no new function, module, command or data field appears;
3. the format of stored data and files does not change;
4. customer data, secrets, photos of people, external calls, access rights and Pixel Office
   events are not touched;
5. the behavior that an existing test checks does not change: the expectations of the tests are
   the same;
6. for code — this piece is already checked by an existing test, and one check command passes
   after the edit (the output is attached).

Any "no" means the full route; a doubt is also a "no". Even on the short path the edit is
checked by someone other than the author (Q2), and the bookkeeping is done in the same work
(Q14). An example: a typo in a document, a comment, one value of a setting.

## Gates

Steps 1b, 3 and 4 (at the same time), 5b, 6, 7 (an interface by a sample), 8 (if there is a
running system) and 9. Until a gate gives a PASS, the next step does not start. Any edit of code
that has already passed steps 3 and 4 passes both steps again before the tests are run. After
every step — the `orch_check` of ORCH; after step 10 — the bookkeeping check, after step 11 — the
result of `check.yml`.

## Artifacts

| Step | Who | What |
|---|---|---|
| 1 | CODE-DESIGNER | `docs/design/REQ-NNN-<short>.md` (with sketches outside the project in `result.prototype`) |
| 1a | ORCH | `decisions/NNNN-<short>-conventions.md`, if the design had open questions |
| 2 | BACKEND-DEV, FRONTEND-DEV | code in their own files; the output of the check command — in `result` |
| 3, 4, 1b, 5b, 7, 9 | checking roles | the `result` of their handoff: PASS or FAIL with findings |
| 5 | TEST-DESIGNER | tests, the list of mutants |
| 6 | TEST-RUNNER | the output of the check command — in `result` |
| 8 | BA-ANALYST, UAT-RUNNER | scenarios — `docs/uat/<REQ-ID>.md`; without scenarios — `docs/uat/<REQ-ID>-RUN.md`; snapshots — outside the project; the results of the run and the signature — in the `result` of the handoffs of step 8 |
| 10 | DOC-UPDATER | the status in `docs/requirements.yaml`, `STATE.md`, `PLAN.md`, documents, `docs/anti-patterns.md` |
| 11 | RELEASE-FINALIZER | two commits (the run files; then the handoff of the step), the push to `main`, `docs/releases/<RUN-ID>.md` |
| 0–11 | ORCH | handoffs in `handoffs/<RUN-ID>/` |

## Handoffs

- `workflow_id`: `"WF-02"`.
- File names are `<serial number of the step>-<role>`, by `docs/workflows/handoffs.md`; the
  number in the name is the serial one in the run, and the workflow step is named in the first
  words of `task.description`. If the requirement was written in the same run, `step-00a` and
  `step-00b` (WF-01) go first.
- Rework steps (the next letter of the step) and re-runs — by `docs/workflows/handoffs.md`.

## Rework loop

- At each gate — no more than **three passes**: the first and two repeats after a FAIL
  (`decisions/0079`, item 4). The third FAIL is a stop and a report to the owner.
- If the same error came back after a rework step, the next attempt changes the approach and
  does not repeat the previous one.
- An edit of an already checked file is a separate handoff and a new check; if it gives a FAIL,
  that is a pass counted in the limit.
- A new launch after an interruption (`-runN`) does not count as a rework step.

## Stop conditions

- **Done:** PASS of step 9, the bookkeeping of step 10 is checked by ORCH, RELEASE-FINALIZER
  made the push to `main`, `check.yml` is green, the second commit with the handoff of the step
  is handed in. A merge in any other way waits for the owner's confirmation (R1).
- **Stopped, limit:** the third gate pass gave a FAIL again. The requirement is `blocked`; ORCH
  writes to the owner what was tried, what did not pass and why, and what options there are.
- **Stopped, bar:** the task cannot be done without lowering the bar (quality-bar §1) or against
  a record in `decisions/` — a question to the owner.
- **Stopped, prerequisites:** for product code there is no decision to start or no single check
  command — product code cannot become `done` (Q4).
- **Stopped, environment:** something outside the project broke (Node, file rights, disk). ORCH
  writes to the owner at once: what broke, what confirms it, the exact command to fix it, what
  stands still because of it. A workaround by own means — only with the explicit permission of
  the owner (AP-021).

## Report to the owner

In plain words, without internal terms: what was done; how to check it yourself (a command or a
link); which checks passed and by whom; what was not done and why; how much of the owner's
limits was spent, if any was; what the owner has to decide.
