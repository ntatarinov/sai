# WF-03 — Defect

How Sai fixes an error in what is already done: first the cause, not the symptom, then a
checked design of the fix, the fix itself and a test that proves the error is caught. The
closing of a defect says only what was really done.

All roles follow `docs/quality-bar.md`; handoffs follow `docs/workflows/handoffs.md`.
Before the work, every role reads `docs/anti-patterns.md`.

## When it starts

- There is an open defect in `docs/issues/` (`Статус: open` — Status: open).
- A test failed, or an agent, a checker or the owner found an error.
- **WF-03 or WF-01:** if the expected behavior is already written in a requirement or in a
  test — this is WF-03. If it is nowhere — first WF-01 adds a criterion (this is how
  criterion 11 appeared in REQ-002 for ISS-0002), then WF-03 continues in the same run.
- An error of the process, not of the code, is a record in `docs/anti-patterns.md` (Q13), not
  WF-03.

## What a defect looks like

The file `docs/issues/ISS-NNNN-<short>.md`. The number is the next free one; ORCH gives it so
that two runs do not take the same number. The first line is `# ISS-NNNN — <title>`, the
second is `Серьёзность: <LOW | MEDIUM | HIGH | CRITICAL>. Статус: open. Найдено: <кто>,
<когда>. Пункт планки: <Q/R>.` (Severity, Status, Found: who and when, Quality bar item). The
field names and section titles of the defect file stay in Russian, as in the existing files:
the sections «Что не так» (What is wrong), «Доказательство» (Evidence: how to reproduce and
what is seen), «Как исправить» (How to fix), «Маршрут» (Route); when closing — «Закрыто»
(Closed). The sample is the files in `docs/issues/`.

## Roles

| Role | What it does | Who checks |
|---|---|---|
| ORCH | Gives the number, leads the run, writes handoffs and the report to the owner | — |
| ISSUE-FIXER | Looks for similar closed defects, reproduces the error, finds the cause. Fixes nothing | the design of the fix — CODE-DESIGN-VALIDATOR; the failure of the test before the fix — TEST-DESIGN-VALIDATOR |
| REQ-ANALYST, REQ-VALIDATOR | Add a criterion if the expected behavior is nowhere (WF-01) | REQ-VALIDATOR |
| CODE-DESIGNER | The design of the fix | CODE-DESIGN-VALIDATOR |
| CODE-FIXER | The fix by the checked design. If the fix adds a new module or command, BACKEND-DEV or FRONTEND-DEV writes it, as in WF-02 | SECURITY-REVIEWER (always; whether its area is touched is decided by it) and REVIEWER at the same time |
| TEST-DESIGNER | The regression test that fails before the fix and passes after | TEST-DESIGN-VALIDATOR |
| TEST-RUNNER, TEST-FIXER | A run of one check command and the analysis of failures | RELEASE-VALIDATOR |
| RELEASE-VALIDATOR | The final check | — |
| DOC-UPDATER | Closes the defect, does the bookkeeping | ORCH |
| RELEASE-FINALIZER | The commit of the run files, the push to `main` after the PASS of RELEASE-VALIDATOR, waiting for `check.yml`, the release report (as in WF-02, step 11); a merge in any other way — with the owner's confirmation (R1) | ORCH |

## Steps

**Step 0 — ORCH.** Checks that the defect is recorded in `docs/issues/` (if not — gives a
number and tells DOC-UPDATER to write the file); creates `handoffs/ISS-NNNN-<YYYYMMDD>-NN/`;
sets the lightweight git tag `base/<RUN-ID>` before the first change (`context.base_tag`) —
"before" is taken from a fresh clone of the tag outside the project, and on it it is later
checked that the new test failed (`context.pre_fix_copy` — only if the copy is needed from
something other than the tag); declares the files of the run (`context.write_set`) and checks
them against the parallel runs.

**Step 1 — ISSUE-FIXER: the search for similar defects and the diagnosis.**

1. Looks in `docs/issues/` for closed defects with the same signs or files. If the same cause
   came back, the fix of the previous time did not remove it: the severity is not lower than
   MEDIUM, and this is recorded.
2. Reproduces the error itself: runs the scenario and reads the real output. A diagnosis from
   a retelling without reproduction is not made (Q3).
3. Finds the cause, not the symptom: which function, which rule is broken, why the existing
   tests did not catch it.
4. Searches for all places of the same kind — not only the one named in the defect — and
   lists them with the reproduction (AP-014).
5. Writes the diagnosis in `result`: the cause, the files concerned, what must change. Fixes
   nothing.

**Step 2 — criterion (if needed).** The expected behavior is neither in a requirement nor in a
test — REQ-ANALYST adds a criterion, REQ-VALIDATOR checks it (WF-01, steps 1–2).

**Step 3 — CODE-DESIGNER and CODE-DESIGN-VALIDATOR, gate.** The design of the fix is as in
WF-02, steps 1 and 1b: every place from the diagnosis, the failure paths, protection in the
same operation, the table "criterion → test", the section about the bar; the trials of the
design, the table of replacements of earlier guard tests and the list of mutants are as in
WF-02, step 1. The checker itself repeats the statements about the behavior of the code before
the fix on a fresh clone of the tag `base/<RUN-ID>` (WF-02, step 1b).

**Step 4 — CODE-FIXER writes the fix** only in the files from `context.write_set`. The
behavior changes — that is the point of the fix — but only as the design says. Then one check
command and its output. Only a test that checks the behavior intentionally changed by the
design of the fix may fail: each such test is named in `result.issues` with the section of the
design and the new expected behavior, and TEST-DESIGNER fixes it at step 6. Such a failure
"expected by the design" is allowed only between steps 4 and 6.

**Step 5 — SECURITY-REVIEWER and REVIEWER, gate** — as in WF-02, steps 3 and 4, at the same
time (both only read). SECURITY-REVIEWER always runs; whether its area is touched is decided
by it, not by ORCH. The main question: is the cause removed, or does the fix only hide the
symptom — silences a check, catches and swallows an error (Q6). Any edit of code that has
already passed this step (CODE-FIXER after findings, TEST-FIXER after a run) passes step 5
again before the tests are run.

*A fix only in tests.* If by the diagnosis the error is in the tests themselves
(`tools/test`), the design of the fix, CODE-FIXER and the security and code review gates are
skipped, and the reason is written in `route`: ISSUE-FIXER → TEST-DESIGNER →
TEST-DESIGN-VALIDATOR → TEST-RUNNER → RELEASE-VALIDATOR → DOC-UPDATER → RELEASE-FINALIZER.
The regression test fails before the edit and passes after; for races — series of runs before
and after; the check is not weakened (`decisions/0075`).

**Step 6 — TEST-DESIGNER writes the regression test.**

- The test reproduces the error: on the copy before the fix it **fails**, after the fix it
  **passes**. Both runs, with the commands and the output, are in `result`.
- If the needed code did not exist at all before the fix, the test fails just because the code
  is not there; that is not enough. Then mutants are added: the traps for which the fix was
  made are broken on purpose, and for each mutant it is recorded which tests fail.
- The tests named at step 4 as checking the intentionally changed behavior are fixed by
  TEST-DESIGNER here; the step is handed in with a passing check — only a failure that is
  proven not to be caused by this work is allowed (quality-bar §6, item 4).
- The other rules of tests are in WF-02, step 5.

**Step 7 — TEST-DESIGN-VALIDATOR, gate.** As in WF-02, step 5b, and also:

- itself runs the new tests on the copy before the fix and sees that they fail;
- itself applies at least one mutant from the list and sees that the tests catch it;
- a mutant is a temporary trial: it is applied in a temporary copy, the working tree does not
  change, and this is checked (the list of hashes before and after is the same), and the
  tests after the trial are green again. A mutant left in the tree is a FAIL of the step.

**Step 8 — TEST-RUNNER, gate; on FAIL — TEST-FIXER** — as in WF-02, step 6: PASS is code 0 or
every failure proven not to be caused by this work; there are no failures "expected by the
design" here any more.

**Step 9 — RELEASE-VALIDATOR, gate** — as in WF-02, step 9, and also: reproduces the original
error itself and sees that it is gone. If an audit (WF-05, step 7a) returned the requirement
to `in_progress` because of this defect, RELEASE-VALIDATOR confirms all the criteria of this
requirement again, not only the fixed one.

**Step 10 — DOC-UPDATER closes the defect.**

- In the status line of the defect — the outcome that was really obtained (the time is from the
  clock):
  - `closed, <дата>` — the cause is removed, there is a regression test;
  - `closed, <дата>, дефекта нет` (no defect) — analyzed and measured, there is no error,
    nothing was changed;
  - `closed, <дата>, причина не устранена, продолжение — ISS-NNNN` (cause not removed,
    continuation — ISS-NNNN) — the work is done, but the cause remained, and a new defect is
    created for it.
- The section «Закрыто» (Closed): the time from the clock, the run, what was done, where the regression
  test is (for «дефекта нет» — where the diagnosis is). The closing does not promise what was
  not there: the fix and the test are mentioned only if they exist.
- The status of the requirement — if the defect added or changed its criterion; `STATE.md`;
  process errors — in `docs/anti-patterns.md` (Q13).
- A requirement that an audit (WF-05, step 7a) returned to `in_progress` because of this
  defect is moved back to `done` by DOC-UPDATER with a comment (the run, the defect) — only
  after the PASS of step 9, in which RELEASE-VALIDATOR confirmed all its criteria again; ORCH
  checks it.
- ORCH checks the bookkeeping with its own commands (`context.orch_check`) and, before writing
  DONE, itself goes through the applicable Q and R items by files and fields; a missed item is
  a rework step, not a note for later.

**Step 11 — RELEASE-FINALIZER** — as in WF-02, step 11.

## Findings on the way

What prevents fixing this defect is removed in this run (through ORCH and the role whose file
it is). What does not prevent it but was found on the way is a new defect with a new number;
this run is not widened for it (quality-bar §6, item 6).

## Gates

Steps 2 (if any), 3, 5, 7, 8 and 9; any edit of code after step 5 passes step 5 again before
the tests are run; after every step — the `orch_check` of ORCH; after step 10 — the
bookkeeping check; after step 11 — the result of `check.yml`.

## Artifacts

| Step | Who | What |
|---|---|---|
| 0 | ORCH | the defect number, handoffs |
| 0 | DOC-UPDATER (at ORCH's instruction) | `docs/issues/ISS-NNNN-*.md`, if it does not exist yet |
| 1 | ISSUE-FIXER | the diagnosis — in `result` |
| 3 | CODE-DESIGNER | the design of the fix in `docs/design/` |
| 4 | CODE-FIXER | the fixed code |
| 6 | TEST-DESIGNER | the regression test, the list of mutants |
| 10 | DOC-UPDATER | the closed `docs/issues/ISS-NNNN-*.md`, the status of the requirement, `STATE.md` |
| 11 | RELEASE-FINALIZER | the commit, `docs/releases/<RUN-ID>.md` |

## Handoffs

- `workflow_id`: `"WF-03"`; the folder is `handoffs/ISS-NNNN-<YYYYMMDD>-NN/`; in `context` —
  `issue_id`.
- File names, serial numbers of steps and the form of rework steps — see
  `docs/workflows/handoffs.md`; the step of this workflow is named in the first words of
  `task.description`.

## Rework loop

As in WF-02: at each gate no more than **three passes** — the first and two repeats after a
FAIL (`decisions/0079`, item 4), the third FAIL is a stop and a report to the owner; if the
same error came back, the approach changes; an edit of a checked file is a new handoff and a
new check (a rework step gets the next letter of the step); a new launch after an
interruption does not count as a rework step.

## Stop conditions

- **Done:** PASS of step 9, the defect is closed with the outcome that was really obtained,
  the bookkeeping is checked by ORCH, the release is made as in WF-02, step 11 (a push to
  `main`, a green `check.yml`, a second commit with the handoff of the step); a merge in any
  other way waits for the owner (R1).
- **Stopped:** the limit of gate passes is used up; the fix demands lowering the bar or going
  against a record in `decisions/`; the error cannot be reproduced — then the defect is not
  closed "just in case", and ORCH writes to the owner what was tried and what is seen.
- **Stopped, environment:** as in WF-02.

## Report to the owner

In plain words: what was broken and how it got in the way; what the cause is; what was fixed
and how to check it yourself; which test now catches this error; what was found on the way
(the numbers of the new defects); what the owner has to decide.
