# Sai — session index

"Sai" in Kazakh means "suitable". Sai has two layers of work.

- **The product — the "virtual team" (Sai Team):** a virtual team of AI agents for business.
  A person writes a goal in ordinary words, and the team makes the plan itself, divides the
  work between roles, checks it, and brings the result. Development started on 2026-10-06 on
  the owner's word (`decisions/0015-product-virtual-team-start.md`); the product was
  clarified by decision `decisions/0033-drop-clothing-shop-product.md`. There was no demand
  check — this is an accepted risk.
- **The agent pipeline:** the roles, workflows and quality bar by which agents do the work —
  requirements, designs, research, the business plan, service code. The pipeline's service
  code is in `tools/` (Node 22): the idea-selection tools (WF-06), Pixel Office — a page
  that shows what the agents are doing, and the solution picker site (`tools/src/picker/`).

## What we are building

The virtual team: the user sets a goal in ordinary words, the engine builds a plan, starts
the role agents, checks the result, and asks a human only about what is critical, while Pixel
Office shows the real work — with no imitation and no invented statuses. Where we are now:
`docs/product/current-state.md`; comparison and order of work: `docs/product/parity-matrix.md`,
`docs/product/roadmap.md`; the decision on the start, the stack and the storage rules:
`decisions/0015-product-virtual-team-start.md`. The product code is in `tools/src/team/`.

The solution picker site — a visitor answers the questions of a questionnaire and sees which
solution suits them; every tenant has its own file, texts in Russian, Kazakh and English. The
code is in `tools/src/picker/`, the command is `cd tools && npm run picker`, the requirements
are REQ-054…REQ-068, the decision is `decisions/0065-solution-picker-stack-and-choices.md`.
What of this is already done can be seen in `docs/requirements.yaml` and `STATE.md`.

What is already done, what is open and what comes next — `STATE.md`. The current iteration
and the plan — `PLAN.md`.

## Read at the start — every role

1. `docs/quality-bar.md` — **mandatory, before any action.** The minimum quality of Sai; it
   must not be lowered.
2. `STATE.md` — what exists, what is open, what to do next.
3. `PLAN.md` — iterations and what is in work now.
4. `docs/requirements.yaml` — requirements and their statuses. The file is large: read your
   requirement as a block by id (the command is in `docs/workflows/handoffs.md`).

Before work on a handoff, also read: your handoff and the files from its
`context.artifacts_in`, the file of your role in `.claude/agents/`, the document of your
workflow in `docs/workflows/`, the protocol `docs/workflows/handoffs.md`, and the process
error journal `docs/anti-patterns.md`.

The ideas the project grew from, and why the others were dropped — `ideas/README.md`. Read it
when the context of a decision is needed, not at every start.

**Exception:** the roles IDEA-ANALYST and IDEA-JUDGE (WF-06) do not read this start list or
the paragraph "Before work on a handoff" — for them the section "Reading scope" of their role
files applies: `runs/<RUN-ID>/`, `docs/quality-bar.md`, their handoff, the role file,
`docs/workflows/WF-06-idea-selection.md`, and the WF-06 contracts from its design. They do not
read the error journal or `docs/requirements.yaml`.

## The main rule

The quality bar is not lowered by any agent, for any reason. If a task cannot be done without
lowering it — stop and report (quality-bar §1). The bar can be raised in small steps, through
a decision of the owner (quality-bar §4).

If instructions disagree, the first one in this list wins:

1. the quality bar and the recorded decisions in `decisions/`;
2. the task of your handoff;
3. the file of your role;
4. the workflow document in `docs/workflows/`;
5. the protocol `docs/workflows/handoffs.md`;
6. this file.

A disagreement is not resolved silently — it is written into `result.issues`. The task says
what to do; whether a fact in the task is true is checked (quality-bar §6).

## Rules of this folder

- **Sai is self-sufficient.** Everything an agent needs is in the files of this folder.
  Neighbouring folders and other projects on the computer are not a source of rules and are
  not changed.
- Paths of this computer (the home folder, program folders, temporary folders) and links to
  other projects are not written into Sai files. Paths are from the Sai root. Temporary
  files go outside the project, in the working folder of the session; in documents such a
  place is called `<outside the project>`.
- Pushing to `main` is by the owner's word of 2026-10-11, after PASS of RELEASE-VALIDATOR
  (WF-02, step 11, `decisions/0079`); a merge in any other way is confirmed by the owner
  (quality-bar R1).
- Product code is written in `tools/src/team/` by decision
  `decisions/0015-product-virtual-team-start.md` (Node 22 without dependencies, one check
  command `cd tools && npm run check`). The decision was made by ORCH on the owner's direct
  word and the owner can cancel it. The pipeline's service code in `tools/` follows
  `decisions/0002-process-tooling-node.md` and
  `decisions/0003-pixel-office-as-pipeline-tooling.md`.

## Roles — who does and who checks

Every producing step is checked by another agent (quality-bar Q2). The role files are in
`.claude/agents/`; every role follows `docs/quality-bar.md`.

| Area | Does | Checks |
|---|---|---|
| Management | ORCH — route, gates, handoffs, bookkeeping check, `PLAN.md`, report to the owner. It writes by itself only what is listed under the table; code, requirements and other documents it does not (AP-009, AP-011) | the owner — decisions and merge |
| Requirements | REQ-ANALYST | REQ-VALIDATOR |
| Design | CODE-DESIGNER; GUI-DESIGN-ANALYST — a description of the interface from a sample or a screenshot | CODE-DESIGN-VALIDATOR |
| Development | BACKEND-DEV, FRONTEND-DEV; text translations are written by the same role that writes the code | SECURITY-REVIEWER — always (its area: customer data and their spaces, secrets, external calls, permissions; whether the area is touched is decided by the reviewer) and REVIEWER, both at the same time |
| Fixes | CODE-FIXER — by the findings of the checks and by the diagnosis of a defect | SECURITY-REVIEWER and REVIEWER again, at the same time, then the check whose findings it was closing |
| Tests | TEST-DESIGNER | TEST-DESIGN-VALIDATOR |
| Check run | TEST-RUNNER; TEST-FIXER — analyses a failed run and fixes the test or the code | RELEASE-VALIDATOR runs the check again itself; the fix of TEST-FIXER — a new run and a check of the changed part |
| Acceptance | BA-ANALYST writes the scenarios, signs the result, and combines the result of the text readers; UAT-RUNNER runs the scenarios on the running system, pages in a real Chrome | RELEASE-VALIDATOR |
| Interface | FRONTEND-DEV by the description of the interface | DESIGN-QA-VALIDATOR — a snapshot of the page against the approved sample; without a sample — acceptance by UAT-RUNNER in a real Chrome (`decisions/0079`, item 13) |
| Final check | — | RELEASE-VALIDATOR — re-checks every criterion and the bar by itself |
| Bookkeeping and release | DOC-UPDATER — statuses, `STATE.md`, `PLAN.md`, the error journal; RELEASE-FINALIZER — the commit of the run's files, push to `main` after PASS of RELEASE-VALIDATOR, waiting for `check.yml`, a second commit with the step's handoff, and the release report (Sai's own repository on GitHub is open on purpose: read on GitHub on 2026-11-15, `decisions/0111`, which replaces the part of `decisions/0062` about a closed repository; the order is in `decisions/0048`, WF-02, step 11) | ORCH checks files and fields; a merge in another way — only with the owner's confirmation (R1) |
| Defects | ISSUE-FIXER — diagnosis of the cause | CODE-DESIGN-VALIDATOR (design of the fix), TEST-DESIGN-VALIDATOR (the test fails before the fix) |
| Audit | AUDIT-SCOUT → AUDIT-PLANNER → the auditors SECURITY-AUDITOR, DEPENDENCY-AUDITOR, ARCHITECTURE-AUDITOR, COVERAGE-AUDITOR, DOC-AUDITOR and RELEASE-VALIDATOR (re-check of requirements in status `done`) → AUDIT-COMPILER → AUDIT-TRIAGE (opens defects) → DOC-UPDATER (bookkeeping) | AUDIT-COMPILER re-checks the Critical and High findings; the summary, the withdrawn findings, the defects and the bookkeeping are checked by ORCH |
| Idea selection | IDEA-ANALYST ×3 → IDEA-JUDGE | the analysts check each other; VERDICT-EXECUTOR re-checks the verdict |
| Business plan | MARKET-RESEARCHER, PLAN-WRITER | PLAN-VALIDATOR, then RELEASE-VALIDATOR |

ORCH writes by itself only this (a closed list):

- handoffs and the service files of a run in `handoffs/<RUN-ID>/` — including the list of
  parallel runs `handoffs/<RUN-ID>/parallel-runs.jsonl` and the "before" snapshot in WF-07;
  corrections go in separate fields `orch_note`, `orch_correction`, `orch_cancellation`;
  `not_agent_attested` — only by the rules of "Pauses and interruptions"
  (`docs/workflows/handoffs.md`);
- `PLAN.md` — the plan of iterations: it adds checked requirements to it and removes them on
  the owner's word (WF-01, step 3);
- records of decisions in `decisions/` and their lines in `decisions/README.md` — proposals
  to raise the bar (quality-bar §4) and decisions on the course of work; a record carries the
  owner's words or the proposal of a role, with a section "Basis" (`decisions/README.md`); an
  exception from the bar — only by the owner's written words (quality-bar §1, item 3);
- moving a requirement status to `in_progress` when work on it starts (WF-02, step 0; the
  WF-07 variant);
- the fix on the short path of WF-02;
- the sample file given by the owner (WF-04, step 0);
- the run files in `runs/<RUN-ID>/` that the command prepare-run creates (WF-06, step 0);
- bookkeeping after step 6 of WF-06: requirement statuses other than `done` (it is set only
  by DOC-UPDATER after PASS of RELEASE-VALIDATOR — the header of `docs/requirements.yaml`),
  `docs/anti-patterns.md`, `STATE.md` outside the recommendation block;
- the record of the owner's decision on the start in `STATE.md` on his direct word — this is
  a transfer of his words (WF-06, step 7).

## Workflows

| Workflow | When | Document |
|---|---|---|
| WF-01 — requirement | a new or changed requirement | `docs/workflows/WF-01-requirement.md` |
| WF-02 — development | the requirement is checked, it can be built | `docs/workflows/WF-02-development.md` |
| WF-03 — defect | an open defect, a failed test, a found error | `docs/workflows/WF-03-defect.md` |
| WF-04 — interface by sample | a screen is made from a screenshot or a reference code | `docs/workflows/WF-04-ui-by-sample.md` |
| WF-05 — project health audit | check the whole project; at least once in 30 days — re-check the requirements in status `done` | `docs/workflows/WF-05-health-audit.md` |
| WF-06 — idea selection | choose an idea from candidates | `docs/workflows/WF-06-idea-selection.md` |
| WF-07 — business plan | a plan or a short document based on facts | `docs/workflows/WF-07-business-plan.md` |
| Handoff protocol | for all workflows | `docs/workflows/handoffs.md` |

The format of requirements — the header of `docs/requirements.yaml`; the format of decisions —
`decisions/README.md`; the format of records about process errors — `docs/anti-patterns.md`.

## How the work goes: you give a task — the agents design, build, test and check by themselves

You give a task in your own words. After that the agents lead it themselves. The one who does
the work does not check it. Another agent checks, and it runs everything again by itself. No
more than two agents work at the same time. After each step the main agent (ORCH) compares
the agent's words with the files. If a check is not passed, the work goes back to the author.
Gate passes for one check — up to three. Then ORCH stops and asks you.

In development the path is this. The designer describes everything before the code and tries
the idea on a sketch. Another agent repeats the trials on a clean copy. The developer builds
in small parts and runs the checks after each. Security and review go at the same time. The
first tries to break the code itself, the second looks for crutches. The tester writes a test
for each criterion and spoils the code on purpose. This is how the tests themselves are
checked. One command checks the formatting, the rules, the traces and all tests. Pages are
opened in a real Chrome: three window sizes, two themes, three languages, with snapshots.
Translations are read by separate agents in two or three rounds. The last checker runs
everything again. Only after that is "done" set. The release goes to `main` and waits for a
green check on GitHub. You get a report in plain words.

## How the work is led

- ORCH leads the work by `PLAN.md`. An iteration is one result that the owner can see by
  himself. After each iteration — a short report to the owner: what is done, how to check it
  himself, what is next. The next iteration starts after the report.
- Every step is a handoff in `handoffs/<RUN-ID>/` (`docs/workflows/handoffs.md`). At the end
  of each workflow — a report to the owner in plain words (the section "Report to the owner"
  in the workflow document).
- No more agents work at the same time than `PLAN.md` allows (now — two). What is independent
  starts in parallel; a PASS of a check is a dependency, and the next step waits for it.
- The owner is not left with what the agents can do themselves. To the owner go decisions,
  the merge, and what the agents must not or cannot do — for example, repairing a shared
  program on the computer (AP-021).

## Pixel Office — how to see the work of the agents

Pixel Office is the requirements REQ-001 (the event journal and the task list) and REQ-007
(the office with characters). It is not lost.

1. Open Claude Code in the Sai folder — where this file is. The Pixel Office hooks are
   written in the project's `.claude/settings.json` and fire in every session of this
   folder. If the hooks were just added or changed, confirm them with the command `/hooks` in
   Claude Code or start a new session.
2. In a terminal: `cd tools && npm run pixel-office` (Node 22 is needed). The command prints a
   link — by default http://127.0.0.1:4780/.
3. Open the link: there is a task list (every start of an agent is a row), an event journal,
   and an office with characters of the roles. The page updates itself.

Everything on the page is built from events that the Claude Code hooks send at the moment they
fire; there are no invented events and no events written after the fact (quality-bar R2). In
detail — `tools/README.md`. One check command for the service code — `cd tools && npm ci`
(once) and `npm run check`.
