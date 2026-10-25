# WF-05 — Project health audit

How Sai checks itself as a whole, not one change: one agent decides what is time to check, a
second makes the plan, the auditors check each their own part, RELEASE-VALIDATOR checks again
the requirements in the status `done`, the compiler collects and re-checks the findings, the
triage agent creates defects for the most serious ones, and the bookkeeper records the result.
The owner gets a report in plain words and decides what to fix now.

The audit fixes nothing in the project. It writes only its own report (`docs/audits/`), new
defects (`docs/issues/`), handoffs and the bookkeeping of DOC-UPDATER (step 7a). The fixes come
later, by WF-03.

All roles follow `docs/quality-bar.md`; handoffs follow `docs/workflows/handoffs.md`.

## When it starts

- The owner asks to check the project ("what is up with the project", "check the security").
  If the owner asks to check the whole project, the plan always has the dimension
  "Requirements".
- There has been no audit for a long time, and there have been many changes since — ORCH may
  propose it in the report to the owner.
- **Re-checking the requirements in the status `done`** — at least once in 30 days. At the start
  of each iteration of `PLAN.md`, ORCH looks in `docs/audits/README.md` for the date of the last
  re-check and, if the term is over, starts WF-05 at least with the dimension "Requirements".
  Before the term, the re-check is included by AUDIT-SCOUT if the files on which the criteria
  of such requirements rely have changed.
- If the owner named what to check, step 1 (AUDIT-SCOUT) is skipped, and what was named goes
  straight into the plan.

## Parts and dimensions

The parts of Sai that the audit checks:

- `tools/src/` without Pixel Office — the idea selection tools (prepare-run, validate,
  apply-verdict, snapshot);
- `tools/src/pixel-office/` — the server, the hook, the page of Pixel Office;
- `.claude/` — the role files and the hook settings;
- documents and bookkeeping — `docs/`, `decisions/`, `STATE.md`, `PLAN.md`, `CLAUDE.md`;
- the product code — when it appears.

The dimensions and who checks them:

| Dimension | Who checks | What it checks |
|---|---|---|
| Security | SECURITY-AUDITOR | Secrets in code, config, page files, handoffs and reports (Q7). Pixel Office: the server listens only on the local address, writing events only with the secret of the source, the page only reads (`decisions/0005-pixel-office-design.md`, REQ-001), events are not written bypassing the hooks (R2). File paths do not leave their folder. Input from the network and from the hooks is validated (Q10). When the product appears — Q8, Q9, Q11, R3 |
| Dependencies | DEPENDENCY-AUDITOR | `npm ci` passes on a clean copy; versions are pinned, `package.json` and `package-lock.json` agree; there are no dependencies at run time (`decisions/0002-process-tooling-node.md`); the Node version in `engines` and in fact; outdated and vulnerable packages (`npm outdated`, `npm audit` — they need the network: no network — "not checked", not "clean"); licenses |
| Architecture | ARCHITECTURE-AUDITOR | The code matches the records of `decisions/`; protection in the same operation as the action; writing files "all or nothing" where this is promised (`decisions/0004-write-phase-rename-and-hardlink-rollback.md`); the boundaries of the parts (the page does not write, the hook does not take extra); one mechanism applied in all neighboring places, not in some of them (AP-014); dead code; files and functions that are too large — there is no threshold: the auditor compares with the neighboring code and writes in the finding the number of lines and how the size gets in the way |
| Test coverage | COVERAGE-AUDITOR | Itself runs `cd tools && npm run check` and attaches the output. Every criterion of the requirements in the statuses `done` and `in_progress` has a test; closed defects have a regression test; failure tests check that the state is unchanged; there are no tests without checks and no `skip` or `todo`; tests do not depend on the order and the clock. Not a gap, but a mark in the report with a reference to the record: a criterion for which TEST-DESIGNER wrote "nothing to test" in its handoff of step 5 (WF-02), and a criterion whose way of checking in the requirement itself is not a test (for example, the PLAN-VALIDATOR check in WF-07, `grep`, `jq`); such criteria of requirements in the status `done` are re-checked by the dimension "Requirements", and for requirements in the status `in_progress` they will be checked by RELEASE-VALIDATOR at step 9 of its run (in WF-07 — step 4) |
| Documentation | DOC-AUDITOR | `STATE.md` and `PLAN.md` match the files (statuses of requirements, open defects, decisions); requirements have all the fields and a way of checking for the criteria; links lead to existing files inside Sai; there are no links to other projects and no paths of this computer; `decisions/README.md` matches the decision files; in `docs/anti-patterns.md` the numbers go in a row and the fields are in place; runs have no abandoned `IN_PROGRESS` handoffs without a reason; `tools/README.md` describes the commands that are in `tools/package.json`; the descriptions of roles and workflows are checked against the latest runs — once in 30 days (`decisions/0079`, item 10) |
| Requirements | RELEASE-VALIDATOR | For every requirement in the status `done` (or those named by AUDIT-SCOUT) it carries out the way of checking of each criterion as it is written in the criterion — a command, a test or reading a named file — on the current files and attaches the output. A criterion about how a run went is checked by the records of that run (handoffs, run files): the records are in place and say the same thing. A check that spends the limit or the money of the owner (for example, a real Claude Code session) — only with the owner's consent, which ORCH gets in advance (as in WF-02, step 8, item 2); without consent the criterion is marked "not checked" with the reason — not "met" and not "not met". A check that writes files is done on a copy of the project outside its folder. A criterion that is not met is a **High** finding; **Critical** if it is about the items Q7–Q11, R2 or R3 |

The dimension "Requirements" is not divided into parts: one handoff is one requirement (or
several small ones), the report is `docs/audits/AUD-NNN/requirements/REQ-NNN.json`.

## Roles

| Role | What it does | Who checks |
|---|---|---|
| ORCH | The audit number, the run, handoffs, checking the summary, defects and bookkeeping, the report to the owner | — |
| AUDIT-SCOUT | Decides which parts and dimensions to check now and why | ORCH checks the passports of the parts against the files |
| AUDIT-PLANNER | The audit folder, the plan "part × dimension", additional checks for each part, the audit row in `docs/audits/README.md` | ORCH checks the plan against the chosen scope |
| Auditors (five) | Check one dimension in one part; only read the project | AUDIT-COMPILER re-checks every Critical and High finding |
| RELEASE-VALIDATOR | The dimension "Requirements": checks again the criteria of the requirements in the status `done`; only reads and runs checks | AUDIT-COMPILER re-checks every criterion that is not met |
| AUDIT-COMPILER | The summary report: re-check, merging repeats, scores, comparison with the last audit | ORCH checks the numbers and itself re-checks the withdrawn findings |
| AUDIT-TRIAGE | Creates defects by the causes of the Critical and High findings (and of Medium or Low that repeated since the last audit) | ORCH; each defect is reproduced by ISSUE-FIXER before the fix (WF-03) |
| DOC-UPDATER | Bookkeeping: `STATE.md`, the state of the audit in `docs/audits/README.md`, the status of a requirement that stopped being met, the log of process errors | ORCH checks files and fields |
| Owner | Reads the report, decides which defects to fix now | — |

## Steps

**Step 0 — ORCH.** Gives the audit number `AUD-NNN` — the next one by `docs/audits/README.md`
(no file — `AUD-001`); creates `handoffs/AUD-NNN-<YYYYMMDD>-01/`. While an audit is going on,
other runs do not create new defects: the defect numbers are given by ORCH in turn.

**Step 1 — AUDIT-SCOUT decides what to check** (only if the owner did not name the scope).
The key idea of the step is **trust in a part**: a part deserves trust while it was recently
checked independently and since then nothing has undermined what was checked. AUDIT-SCOUT looks
for where trust is lost and directs the audit only there.

1. **The trust passport of each part** (the parts are in the section "Parts and dimensions").
   Three facts, each with a source:
   - **the age of trust** — how many days have passed since the last independent check of the
     part and by which dimensions (`docs/audits/README.md`, the last report); if there was no
     check — there is no trust at all;
   - **what has changed since** — a list of files: Sai has its own repository since 2026-10-05
     (`PLAN.md`, step 2f), so — from the git history; for the changes before it and for the
     uncommitted ones — from the handoffs of the runs after the last audit
     (`context.write_set`, `result.changes`, `result.artifacts_out`) and by the time the files
     were changed. A file used by several parts (for example, `tools/package.json` by the idea
     selection tools and by Pixel Office) goes into the list of each of them;
   - **the open defects** of the part in `docs/issues/` — numbers and severity.
2. **The trust that is lost is what gets checked.** By the passport AUDIT-SCOUT answers for each
   dimension whether it has a reason:
   - **security** — something that accepts someone else's input or writes files changed: the Pixel
     Office server and hook, `.claude/settings.json`, writing files in the tools; such a change
     always includes security;
   - **dependencies** — the set of packages (`package.json`, `package-lock.json`) or the Node
     version changed;
   - **coverage** — the code changed or grew, and the tests in `tools/test/` next to it did not;
   - **architecture** — a decision appeared in `decisions/` or a part was rebuilt;
   - **documentation** — documents and bookkeeping changed, or the code they describe (for
     example, the commands of `tools/` while `tools/README.md` is unchanged);
   - **the dimension of an open defect** — while the defect is open.

   Three cases override this breakdown. A part that was never checked independently, a part with
   an open CRITICAL or HIGH defect and a part where something that accepts someone else's input or
   writes files changed are checked by all dimensions: there is no trust in them at all. A part
   without changes and without defects whose trust is older than 45 days is checked by
   documentation and coverage — this shows whether the records have drifted from the files. A
   part without changes, without defects and younger than 45 days is not checked, and its
   passport is the reason.
3. **Requirements in the status `done`** — separately from the parts. Those go into the re-check
   whose criteria name changed files, commands or tests. If there has been no re-check yet or
   more than 30 days have passed since the last — all the requirements in the status `done`.
4. **The result is a list "part → dimensions → why"** in `docs/audits/scope-<YYYYMMDD>.json`:
   for each part its passport (days, files, defects), the chosen dimensions and the reason for
   each; separately — the requirements for re-check with the reasons. The rows whose only
   reason is the age of trust are marked «можно перенести» ("can be postponed"): if there are
   not enough agents, ORCH postpones exactly those and names them in the report to the owner.
   A hint of ORCH from the task adds what was named, but the passports are still collected.

If no part has dimensions to check and the term for re-checking the requirements is not over,
the outcome is "no audit needed" (section "Stop conditions").

**Step 2 — AUDIT-PLANNER makes the plan.** Creates `docs/audits/AUD-NNN/`, writes
`docs/audits/AUD-NNN/plan.json`: the parts, the dimensions for each part, the requirements for
re-check, the additional checks by part (for example, for Pixel Office — R2 and the write
permissions; for the idea selection tools — writing "all or nothing"). To the parts and
dimensions it gives short Latin names in the plan for the paths (for example, `pixel-office`,
`security`): the auditors name their reports by them. Adds a row to `docs/audits/README.md`:
the number, the date, the scope, the state «идёт» (in progress); if the file does not exist yet (the
first audit), creates it with a table of audits — the number, the date, the scope, the state,
the date of the re-check of the requirements.

**Step 3 — the auditors and RELEASE-VALIDATOR check.**

- One handoff is one part and one dimension (for "Requirements" — one requirement or several
  small ones). The agents work in parallel within the number of agents from `PLAN.md`, each
  writes only its own file: `docs/audits/AUD-NNN/<part>/<dimension>.json` or
  `docs/audits/AUD-NNN/requirements/REQ-NNN.json`.
- The project is only read and the checks are only run: not a single edit of code, documents or
  settings. A check that writes files is done on a copy of the project outside its folder; a
  check that spends the limit or the money of the owner — only with the owner's consent,
  otherwise — "not checked" with the reason.
- The agent carries out each check itself (Q3) and records: what was checked and how, what was
  not checked and why.
- A finding has the fields: `id`, `check` (what was checked; for requirements — the number of
  the requirement and the criterion), `severity`, `title`, `where` (file and line), `evidence`
  (the command and output or a quote), `item` (the item of the bar), `recommendation`.
- Severity: **Critical** — a violation of a bar item that harms already now (a secret in files,
  invented events in Pixel Office, mixing of customer data, writing outside the own folder);
  **High** — a bar item is not met (a criterion without a test, a criterion of a requirement in
  the status `done` is no longer met, a failure without handling, a divergence from a recorded
  decision); **Medium** — a document diverges from the files, a weak test, an outdated
  dependency without a known vulnerability; **Low** — names, dead code, formatting. A dependency
  with a known vulnerability is **High**, and if the vulnerability is reachable in what works
  now (the Pixel Office server or hook) — **Critical**.

**Step 4 — AUDIT-COMPILER collects the summary.** The summary must be such that the owner can
trust it without reading the reports of step 3: every serious statement is re-checked, nothing
is counted twice and nothing disappears silently.

1. **Completeness.** All reports of step 3 are read and checked against the plan: every pair
   "part × dimension" and every requirement of the plan is either checked or named "not
   checked" with the reason.
2. **Re-check.** The compiler checks every Critical and High finding itself — repeats the
   command from the evidence or opens the place. If it was not confirmed, it stays in the
   summary with the mark «не подтверждено» ("not confirmed") and the reason, but does not go
   into the score.
3. **No double counting.** One check in one place by two agents is one finding. One check that
   worked in two or more parts is one common finding with a list of parts; the common findings
   go first in the report.
4. **The score** — by the confirmed findings, the scheme of `decisions/0009-audit-score.md`:
   - the penalty of a part: 30 for each Critical, 12 for High, 4 for Medium, 1 for Low;
   - the ceiling by the worst finding: there is a Critical — the score of the part is not higher
     than 40; there is a High — not higher than 70; otherwise — not higher than 100;
   - the score of a part = the smaller of "100 − penalty" and the ceiling, not below 0;
   - "Requirements" is a separate part with its own score;
   - the score of the project = the score of the weakest checked part, with its name; a part
     that is "not checked" gets no score and is named next to it.

   An example: in Pixel Office one High and two Medium — 100 − 12 − 8 = 80, the ceiling is 70,
   the score is 70; if the other parts are higher, the score of the project is "70, Pixel
   Office".
5. **Comparison with the last audit:** new findings, fixed, remaining and worsened (the severity
   grew); the same finding is the same check in the same place. Scores are compared by parts; by
   the lesson of AP-015 the score of the project is compared only if both audits have the same
   set of parts.
6. **The report.** `docs/audits/AUD-NNN/report.json` — all findings with the part, the
   dimension, the severity, the re-check mark, the scores and the comparison.
   `docs/audits/AUD-NNN/report.md` — in order: the result for the owner in plain words; the
   Critical and High findings withdrawn at the re-check, with the reasons; the table of scores
   with the ceilings; the findings by severity, the common ones first; the re-checked
   requirements — which are met, which stopped being met; what was not checked and why.

**Step 5 — ORCH checks the summary.** With its own commands: the number of findings of each
severity in the summary equals the number of confirmed findings in the reports of step 3; every
unconfirmed finding is named with the reason; not a single part and not a single requirement of
the plan has disappeared (what was not checked is named). Every Critical and High finding that
AUDIT-COMPILER marked "not confirmed" is checked by ORCH itself — repeats its evidence; if it was
confirmed, it returns to the count. If anything does not match — a rework step of
AUDIT-COMPILER.

**Step 6 — AUDIT-TRIAGE creates defects.** A defect is needed when there is someone to fix it
and something to fix: it has one cause, it is clear in which files to remove it, and one piece
of work under WF-03 closes it entirely. Hence the structure of the step — from the cause, not
from the list of findings.

1. **Collect the findings by causes.** The confirmed Critical and High findings (and the repeated
   Medium and Low — item 3) are sorted by causes: one cause is one mechanism, file or check that
   has to be fixed, however many parts and findings stand behind it (AP-014). For example, the
   absence of input validation in the Pixel Office server, found by security and by coverage, is
   one cause. The unmet criteria of one requirement are one cause: the requirement is fixed and
   re-checked as a whole (WF-03, steps 9–10).
2. **Check the causes against the open defects.** A cause that is already covered by an open
   defect in `docs/issues/` (the same place, the same mechanism) gets no new defect; the
   handoff says which defect covers it.
3. **Decide for each uncovered cause:**

   | What stands behind the cause | Decision |
   |---|---|
   | at least one Critical finding | a CRITICAL defect; each Critical finding in it is a separate «Как исправить» (How to fix) item with its own regression test, so that it cannot be closed together with its neighbors |
   | High findings, no Critical | a HIGH defect with a list of all places |
   | unmet criteria of a requirement | a defect per requirement, the severity as that of the heaviest finding |
   | only Medium or Low | no defect — a row in the summary of the report; but if the same finding was also in the last audit (in the comparison of the summary it is "remaining", step 4, item 5), it is created as a defect with its severity: it does not go away by itself |
   | only "not confirmed" | no defect |

4. **Write it up.** The numbers are given by ORCH. The file is like the other defects (WF-03,
   "What a defect looks like"), the line `Найдено: AUD-NNN, <роль>, <дата>` (Found); in «Как исправить» (How to fix) — what
   exactly to fix and in which files. The defect number is written into all its findings in
   `docs/audits/AUD-NNN/report.json`; the other fields of the summary do not change.

**Step 7 — ORCH checks the defects.** Every confirmed Critical and High finding and every
repeated Medium or Low (step 6, item 3) is included in a defect — a new one or a named already
open one; every Critical finding has its own «Как исправить» (How to fix) item in the defect; the merges by
cause and the duplicates are explained.

**Step 7a — DOC-UPDATER, bookkeeping.**

- `STATE.md`: the result of the audit (number, score, the main points) and the new open defects
  (Q14).
- `docs/audits/README.md`: the audit row gets the state «готов» (ready); if requirements were re-checked
  — the date of the re-check.
- A requirement in the status `done` for which it is confirmed that a criterion is no longer
  met: the status → `in_progress` with a comment (the audit number, the criterion, the defect).
  It is moved back to `done` after the defect is fixed under WF-03 (steps 9–10).
- Process errors found in the audit go to `docs/anti-patterns.md` (Q13).
- ORCH checks the bookkeeping with its own commands (`context.orch_check`) and only after that
  sends the report to the owner.

**Step 8 — the owner decides** which defects to fix now (under WF-03). ORCH proposes first the
Critical findings on security and on R2. Without the owner's decision the defects do not go
into work.

## Gates

- Step 5: without ORCH's check the summary does not go to the owner.
- Step 7: without ORCH's check the defects are not considered created.
- Step 7a: without ORCH's check the bookkeeping is not considered done, and the report does not
  go to the owner.
- Each defect is reproduced by ISSUE-FIXER before the fix (WF-03, step 1): a finding of the
  audit is a reason to check, not a ready diagnosis.

## Artifacts

| Step | Who | What |
|---|---|---|
| 1 | AUDIT-SCOUT | `docs/audits/scope-<YYYYMMDD>.json` |
| 2 | AUDIT-PLANNER | `docs/audits/AUD-NNN/plan.json`, a row in `docs/audits/README.md` |
| 3 | auditors | `docs/audits/AUD-NNN/<part>/<dimension>.json` |
| 3 | RELEASE-VALIDATOR | `docs/audits/AUD-NNN/requirements/REQ-NNN.json` |
| 4 | AUDIT-COMPILER | `docs/audits/AUD-NNN/report.json`, `docs/audits/AUD-NNN/report.md` |
| 6 | AUDIT-TRIAGE | `docs/issues/ISS-NNNN-*.md`, the defect numbers in `docs/audits/AUD-NNN/report.json` |
| 7a | DOC-UPDATER | `STATE.md`, the state in `docs/audits/README.md`, the status in `docs/requirements.yaml` (if a requirement stopped being met), `docs/anti-patterns.md` |
| 0–8 | ORCH | handoffs in `handoffs/AUD-NNN-<YYYYMMDD>-01/` |

## Handoffs

- `workflow_id`: `"WF-05"`.
- Files: `step-01-audit-scout.json`, `step-02-audit-planner.json`,
  `step-03-<auditor>-<part>.json` (for example, `step-03-security-auditor-pixel-office.json`),
  `step-03-release-validator-<requirement>.json` (for example,
  `step-03-release-validator-req005.json`), `step-04-audit-compiler.json`,
  `step-06-audit-triage.json`, `step-07a-doc-updater.json`.

## Rework loop

- The agent of step 3 could not finish (a command failure, a limit) — no more than **two**
  re-launches. If it did not work out — the pair "part × dimension" or the requirement is marked
  "not checked" in the report with the reason, and the audit goes on.
- The check of ORCH at step 5, 7 or 7a did not match — no more than **two** rework steps of
  AUDIT-COMPILER, AUDIT-TRIAGE or DOC-UPDATER; if it does not match after the second one, the
  audit stops, and ORCH writes to the owner what does not match.

## Stop conditions

- **Done:** the report, the defects and the bookkeeping are checked by ORCH, the report is with
  the owner.
- **No audit needed:** no part has dimensions to check (step 1, item 2), and the term for
  re-checking the requirements is not over — ORCH writes this to the owner, with the passports
  of the parts by which it was decided.
- **Stopped:** there is nothing to run the check with (for example, there is no Node 22 for
  `npm run check`) — the dimension is marked "not checked", and the failure of the environment
  goes to the owner at once (WF-02, "Stopped, environment").

## Report to the owner

Five to ten lines in plain words: the general state of the project (the score by the weakest
part and what stands behind it); the main problems — first those that harm already now; the
findings that the compiler withdrew as unconfirmed — as a separate list; which requirements in
the status `done` were re-checked and which stopped being met; what became better or worse since
the last audit; what could not be checked and why; which defects were created and what is
proposed to fix first. Then — a link to `docs/audits/AUD-NNN/report.md`.
