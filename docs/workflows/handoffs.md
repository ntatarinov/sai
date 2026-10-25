# Handoff protocol

A handoff is a JSON file. ORCH uses it to give a task to one agent, and the agent writes its
report into it. Handoffs show who did what, when and on what basis: without them there is no
independent check (quality-bar Q2) and no bookkeeping (Q14). This file is binding for ORCH
and for every agent that receives a handoff — except the roles whose role file has a
"Reading scope" section: what they read is decided only by that section (details in "How the
recipient works").

## Where handoffs are stored and how they are named

- **Run folder:** `handoffs/<RUN-ID>/`. A run is one piece of work under one workflow: idea
  selection, a business plan, a requirement with its development, the fix of a defect, an
  audit.
- **RUN-ID:** `<LABEL>-<YYYYMMDD>-<NN>`. The label names the work: `WF06` — idea selection,
  `BP` — business plan, `PO` — Pixel Office, `ISS-0002` — the defect with that number,
  `AUD-001` — the audit with that number, `SA` — Sai's autonomy (iteration 2). The date is the
  day the run started; `NN` is the number of the run with this label on this day, starting
  from `01`.
- **File:** `step-<STEP>-<role>[-<detail>][-<suffix>].json`:
  - `<STEP>` — the serial number of the step in the run: `00`, `01`, `01c`, `02a` …; ORCH
    writes the workflow step the agent works on as the first words of `task.description`
    ("WF-02, step 3 — …");
  - `<role>` — the role name in lower case with hyphens: `code-designer`, `req-validator`;
  - `<detail>` — if several agents of one role work on the step: the point of view, the topic
    or the requirement (`-market`, `-session-review-tools`, `-req001`);
  - `<suffix>` — a re-run after an interruption `-runN`, the version of a verdict in WF-06
    `-vN`; a rework step gets no suffix — it gets the next letter of the step (`05c`), and
    `-rN` is the form of old runs (section "Rework steps and re-runs").
- **handoff_id:** `step<STEP>`, then the detail and the suffix, then the RUN-ID — for example,
  `step06-r2-ISS-0002-20260930-01`. It is not repeated anywhere in `handoffs/`.
- Handoffs are not deleted or renamed: other files refer to them by name.

## Fields

An example (the values are made up):

```json
{
  "handoff_id": "step02-DEMO-20990101-01",
  "run_id": "DEMO-20990101-01",
  "workflow_id": "WF-02",
  "step": "02",
  "from_agent": "ORCH",
  "to_agent": "BACKEND-DEV",
  "file": "handoffs/DEMO-20990101-01/step-02-backend-dev.json",
  "status": "PENDING",
  "priority": "NORMAL",
  "context": {
    "requirement_ids": ["REQ-999"],
    "agent_run_id": null,
    "artifacts_in": ["docs/design/REQ-999-demo.md"],
    "route": "CODE-DESIGNER -> CODE-DESIGN-VALIDATOR -> BACKEND-DEV (this) -> SECURITY-REVIEWER -> REVIEWER",
    "write_set": "tools/src/demo.js only"
  },
  "task": {
    "description": "What to do — in full, in plain words.",
    "acceptance_criteria": ["Checkable item 1", "Checkable item 2"]
  },
  "created_at": "2099-01-01T10:00:00Z",
  "started_at": "2099-01-01T10:00:00Z",
  "completed_at": null,
  "result": null
}
```

| Field | What it is | Who writes it |
|---|---|---|
| `handoff_id` | the unique name of the handoff | ORCH |
| `run_id` | the RUN-ID, also the name of the run folder | ORCH |
| `workflow_id` | the workflow: `WF-01` … `WF-07`; work outside the workflows — the iteration label (`ITER-2`). Old runs contain `ISSUE` — that was the name of a defect before WF-03 | ORCH |
| `step` | the serial number of the step in the run, as in the file name | ORCH |
| `from_agent` | always `ORCH`: only ORCH creates handoffs | ORCH |
| `to_agent` | the role of the recipient, for example `CODE-DESIGNER` | ORCH |
| `file` | the path of this file from the root of Sai | ORCH |
| `status` | `PENDING` → `IN_PROGRESS` → `COMPLETED` or `FAILED`; `CANCELLED` — cancelled | ORCH sets `PENDING` and `CANCELLED`; the recipient sets `IN_PROGRESS`, `COMPLETED`, `FAILED` |
| `priority` | `HIGH`, `NORMAL` or `LOW` | ORCH |
| `context` | everything that must be known about the run (below) | ORCH |
| `task` | `description` — what to do; `acceptance_criteria` — the items by which the work will be checked | ORCH; the recipient never changes it |
| `created_at`, `started_at` | the time of creation and of sending | ORCH, one reading of the clock (section "Time") |
| `completed_at` | the time of hand-in | the recipient |
| `result` | the report of the agent (below) | the recipient — and only the recipient |

Optional top-level fields:

- `round` — the same `N` as in the suffix `-rN` of a rework step; only in old runs, it is not
  written in new ones;
- `not_agent_attested` — a mark that ORCH, not the agent, wrote some of the fields (section
  "Pauses and interruptions");
- `orch_note`, `orch_correction`, `orch_cancellation` — corrections by ORCH: separate fields,
  with the time and the reason; the report of the agent (`result`) is not rewritten by them.

### context

Required fields:

- `requirement_ids` — the requirements the step is for (an empty list if there are none);
- `agent_run_id` — the identifier of the agent's launch. ORCH writes it right after the
  launch; before the launch it is `null`. The continuation of the same agent (the rounds of
  WF-06, a rework step by the same agent) goes with the same identifier;
- `artifacts_in` — the files the agent must read.

Common optional fields (ORCH writes them when they are needed):

- `route` — the route of the run: who was before this step and who will be after it;
- `write_set` — the files the agent may change; everything else it may not;
- `edit_scope` — which part of a file may be changed (for example, one requirement block) and
  how to show that the rest did not change (a hash before and after);
- `protected` — what must stay byte for byte the same;
- `parallel_work_now` — who else is working now and with which files;
- `file_lock` — another agent is writing the file now: prepare the edit and wait for the
  message from ORCH;
- `rework_of` — the path of the handoff that is being reworked; only in old runs with the
  suffix `-rN`, it is not written for a rework step by step letter;
- `orch_rulings` — the rulings of ORCH on the questions of agents;
- `base_tag` — the git tag `base/<RUN-ID>` that ORCH sets before the first change of the run;
  the command `new` writes it itself if the tag exists (in WF-02, without the tag it
  refuses). The tag replaces the "before" copy outside the project: the agent takes "before"
  from a fresh clone of the tag (`git clone -b <tag>`);
- `before_copy`, `pre_fix_copy` — the "before" copy outside the project, when there is no tag
  or the copy is needed from something other than the tag: the changes are compared with it,
  and it is used to check that the new test failed before the fix;
- `interruptions` — the interruptions in the work of the agent (section "Pauses and
  interruptions");
- `task_check`, `orch_check` — ORCH's own check: when, with which commands, what came out, the
  verdict. ORCH writes `orch_check` after every step, on PASS and on FAIL (on FAIL the verdict
  is «FAIL принят» ("FAIL accepted")), before the next step;
- workflow fields: `lens`, `run_seal` (WF-06), `issue_id` (WF-03) and others — the workflow
  document names them.

### result

The recipient writes:

- `status` — `COMPLETED`, `FAILED` or `IN_PROGRESS` (the work is not finished, and the agent
  says so directly — for example, when there is nothing to check with, quality-bar Q3);
- `verdict` — for checking roles: `PASS` or `FAIL` (in WF-07 at step 2b also
  `SOURCE_UNAVAILABLE`);
- `findings` — for checking roles: the remarks, each with a place, a severity and a fix; the
  severity scale is common: Critical, High and Medium block (FAIL), Low does not block and
  goes to the next step or into the report; a workflow sets its own threshold only
  explicitly — one exception: in WF-04, step 4 (comparison with the sample), only Critical
  and High block; the WF-05 exception: the findings of the auditors lie in their report file
  (`docs/audits/AUD-NNN/<part>/<dimension>.json`), and `result.findings` holds the path to it,
  not a copy of the findings;
- `summary` — what was done and how it ended, in plain words;
- `changes` — every edit: the file and the place, what was changed; for a rework step — which
  remark it relates to;
- `self_check` — the commands of the own check and their real output;
- `issues` — questions, doubts, findings outside the task, proposals to raise the bar; each
  item has an `id` (`I1`, `I2` …), a kind or a severity and a text. The kinds that have a
  rule: `BLOCKED` — a stop; `EXPECTED_RED` — a test that is red by the design (allowed only
  until the tests step); `FOR_NATIVE_SPEAKER` — a translation line for a person who knows the
  language (AP-114); `DISCREPANCY` — a name or a fact in the task, the criteria or the design
  did not match the file (AP-111, AP-123);
- `before_copy` — the "before" lines of every edit of a shared file (for example,
  `docs/requirements.yaml`), taken from the tag: `git show base/<RUN-ID>:<path>`; `prototype` —
  where a trial sketch outside the project lies and what is in it; `table` — a table
  "was → became → source" for text edits;
- `artifacts_out` — all created and changed files, by name; the handoff itself is not
  included;
- other fields, if the workflow requires them (for example, `urls_opened` for the checker of
  research).

An agent that stopped leaves `status` and `result.status` at `IN_PROGRESS` and
`completed_at` at `null`; its first `result.issues` item is of the kind (`kind`) "BLOCKED",
with the time of the stop in the field `at` (from the clock): what is in the way, what
confirms it, what is needed to continue.

## Who writes what

- **Only ORCH creates handoffs.** An agent that needs the work of another role writes about
  it in `result.issues` and does not create a file itself.
- **The recipient changes only `status`, `completed_at` and `result`.** Not `task`, not
  `context`, not the time of creation and sending. If the task seems wrong, impossible or out
  of date, the agent writes about it in `result.issues` and does not touch the task: only ORCH
  can give another task, with a new handoff.
- **Creating and closing — by a command.** ORCH creates a handoff with the command
  `cd tools && npm run handoff -- new …` (the keys and the rules are in `tools/README.md`,
  section "The handoff command"). After filling `result`, the recipient closes its handoff with
  the command `cd tools && npm run handoff -- close <path> --status COMPLETED|FAILED`: it
  changes only `status` and `completed_at` and, before writing, checks the file with the
  rules of `handoffs-check`. `close` does not do the stop by the rule of a role
  (`IN_PROGRESS` and "BLOCKED"). The command `new` writes `context.write_set` as a list; a
  string is allowed in old files.
- **ORCH does not rewrite the `result` of an agent.** A correction goes in a separate field
  (`orch_note`, `orch_correction`) with the time and the reason. There is one exception —
  the agent could not report (section "Pauses and interruptions"), and this is marked
  `not_agent_attested`.

## Time

- Only from the clock: `date -u +%Y-%m-%dT%H:%M:%SZ`. Not from memory and not "about".
- ORCH writes `created_at` and `started_at` from **one** reading of the clock, when it creates
  the handoff and launches the agent: the handoff is created with the command
  `cd tools && npm run handoff -- new …` at the moment the agent is launched, and the time is
  taken from the clock once; a handoff is not created in advance (`PENDING` without a
  launch). If a handoff was created in advance (`PENDING`) and the agent is launched later,
  at the launch ORCH reads the clock again and rewrites only `started_at` (this is how steps
  11 and 12 of the run `WF06-20260925-01` went). The recipient does not set `started_at`.
- `completed_at` — at hand-in, from the clock; not earlier than `started_at`; it is set by
  the command `cd tools && npm run handoff -- close <path> --status COMPLETED|FAILED`.
- If the time is unknown (for example, a limit stopped the agent), «неизвестно» ("unknown") is
  written, with what is known (for example, the last change of the agent's file) — not an invented time.
- All times in `at_note` are checked like `at`: a time in the text is not later than the
  clock and not later than the commit in which this record appeared; this also applies to
  quoted times. The previous value of a time is quoted only in the fields `was` and
  `previous` of the same correction — the command does not check them.

## How ORCH writes the task

- The task is complete: the agent must not guess what to do, what it may change and how to
  hand in the work. Everything needed is in the handoff and in the Sai files from
  `artifacts_in`. Whole files are not copied into the task — they are listed.
- The task holds only facts from the project files, with a reference to the file; the rest is
  written as a question or an assumption (AP-012).
- Each agent has its own output files (`write_set`); two agents do not write into one file at
  the same time. If a shared file cannot be avoided — one after the other (`file_lock`) or by
  blocks (`edit_scope`) with the hashes of the other blocks before and after.
- A rework step goes only by the list of remarks (AP-019). The common rules that are the same
  for all roles (the tag, the clone, the checks before `close`, the commit, the traces) are
  written once below; in the task ORCH reminds of them in one line with a reference to the
  section "Common rules for all roles", without retelling them.
- Independent work is sent at the same time, within the number of agents that `PLAN.md`
  allows; the PASS of a check is a dependency: the next step waits for it (AP-010).

## How the recipient works

**Exception — the roles with a "Reading scope" section in the role file** (now IDEA-ANALYST
and IDEA-JUDGE, WF-06). What to read is decided for them only by that section; steps 1 and 2
below do not apply to them. They do not read `docs/anti-patterns.md`,
`docs/requirements.yaml` and other files that are not in their list, even if the handoff has
`requirement_ids`: otherwise the idea selection becomes circular. The field rules they need
for the report are repeated in `docs/workflows/WF-06-idea-selection.md` (section
"Handoffs").

1. Reads its handoff, the files from `artifacts_in`, the file of its role in
   `.claude/agents/`, `docs/quality-bar.md`, the workflow document in `docs/workflows/` and
   `docs/anti-patterns.md`.
2. Reads a requirement as its own block by id, not the whole `docs/requirements.yaml` — the
   file is large:
   `awk '/^  - id: REQ-007$/{f=1} f&&/^  - id: /&&!/REQ-007$/{exit} f' docs/requirements.yaml`.
3. Checks the facts of the task on which it builds the work (quality-bar §6, item 2).
4. Sets `status: "IN_PROGRESS"`.
5. Changes only what is allowed (`write_set`, `edit_scope`). What it finds beyond the task
   goes into `result.issues`, not into an edit.
6. Runs long commands (the full check, tests, mutants) and waits for them within its own
   turn. Running them in the background and ending the turn "until the notification" is not
   allowed: after the agent's turn ends, nobody wakes it, and the handoff hangs.
7. Keeps temporary files outside the project (in the working folder of the session); in the
   documents such a place is called `<outside the project>`. No extra files remain in the Sai
   folder after the work. Copies and trials are made only in a fresh `git clone` outside the
   project (section "Common rules for all roles").
8. Before hand-in, runs its own check: the commands and their output go into `self_check`.
   Before `close` — `handoffs-check` and `traces` (section "Common rules for all roles").
9. Fills `result`, `completed_at` and `status` (`COMPLETED` or `FAILED`; on a stop — as said
   in the section "result"); changes nothing else in the handoff.

A checking role gives its verdict itself — from the artifact and its own runs, not from the
`summary` of the author (quality-bar Q2).

## Common rules for all roles

The rules below are the same for every role and every workflow. They are written here once
(AP-014): the role files and workflow files refer to them and do not retell them.

1. **The tag `base/<RUN-ID>`.** ORCH sets a lightweight git tag before the first change of the
   run, in any workflow; `handoff new` writes it into `context.base_tag`. The agent takes
   "before" from the tag, not from a copy made by hand.
2. **`orch_check` at every step.** After every step, on PASS and on FAIL, ORCH checks the
   report against the files with its own commands and writes `context.orch_check` before it
   starts the next step.
3. **Copies and trials — a fresh clone.** The "before" copy, a trial of the design, a mutant,
   a repeat of a failure are made in a fresh `git clone` outside the project; the needed tag
   is `git clone -b <tag>`. The commands `git checkout`, `git reset`, `git stash`,
   `git clean` are forbidden both in the project and in any copies; if another revision is
   needed, a new clone is made (AP-086, AP-109). The "before" copy is not taken with
   `git archive`: it has no `.git` and no `handoffs/` (AP-074).
4. **Before `close`.** The author of the step runs
   `cd tools && npm run handoffs-check && npm run traces` and closes the handoff when both
   commands return code 0.
5. **Traces.** The Sai files contain no paths of this computer and no names of other
   projects. In `self_check` the command that searches for the forbidden names and paths is
   not written out in words: write "search for the names of other projects and computer paths
   → empty" or the output of `npm run traces` (AP-095, AP-103). The path of a temporary
   folder is `<scratch>/…` or `<outside the project>/…` (AP-050, AP-062, AP-069).
6. **The working folder of the session.** ORCH tells the agent its real path in the message at
   launch, but writes it neither in a handoff nor in any other Sai file. The agent keeps
   temporary files, clones and snapshots there and names them in the report as rule 5 says.
7. **The commit of the run.** The files of the run go into the commit, each by name, without a
   handoff that is not yet closed (AP-091). The handoff of the release step is closed after
   the push and after waiting for `check.yml`, and goes in a second commit.
8. **Rework steps.** A rework step gets the next letter of the step (`05c`); its
   `task.description` starts with "rework for FAIL <path of the handoff with the FAIL>, gate
   pass N of 3"; `result.changes` holds a table "what was fixed, where": the number of the
   remark, the file and the place, what it was and what it became (section "Rework steps and
   re-runs").
9. **Three gate passes per step.** At one gate there is the first pass and no more than two
   repeats after a FAIL (`decisions/0079`, item 4). The third FAIL is a stop: ORCH reports to
   the owner what was tried, what did not pass and why.
10. **Repeating a failure.** A red test is not repeated until it is green: a repeat does not
    replace the evidence from quality-bar §6, item 4. A flaky test is a defect, and ORCH
    tells the owner (`decisions/0079`, item 2).

## Pauses and interruptions

There is one rule: **the report is written by the one who worked, and when that one could
not, the files speak for it, not guesses.** An interruption is any end of an agent's work
without a filled `result`: an API limit, a service error, a session restart, the agent's turn
ended while the handoff is still `IN_PROGRESS`. This happened, for example, with
VERDICT-EXECUTOR in the run WF06-20260925-01 (AP-006).

**First — an inventory.** Before any decision, ORCH itself looks at what the agent managed to
do: it compares the files from `write_set` with the "before" copy, looks at the time they
were changed and at whether the output files of the step exist. Every interruption is a
separate record in `context.interruptions`:

```json
{
  "at": "<time from the clock, or «неизвестно» and what is known>",
  "cause": "<cause: the API limit with the code and the reset time, an error>",
  "checked_by_orch_at": "<when ORCH checked the files>",
  "resumed_at": "<when the work was continued>",
  "how": "same agent run resumed via SendMessage"
}
```

(«неизвестно» — "unknown".)

**Then — one of three outcomes.** The first one that fits, from the top, is chosen:

| What is seen | What ORCH does | Rework limit |
|---|---|---|
| The same launch can be continued (the limit is reset, `agent_run_id` is known), and it was not yet continued after this interruption | Continues it in the same handoff; the agent reports itself | not spent |
| It cannot be continued, or the continuation was also interrupted, and the files do **not prove** that all the work is done | Closes the handoff `FAILED` with the mark `not_agent_attested` and launches the same role again from a clean sheet — a new file with the suffix `-runN`; the new agent reports for its own work itself and has no mark | not spent |
| It cannot be continued, and the files **prove** that all the work is done — only the report is missing | Writes the report itself, only from what is visible in the files, with the mark `not_agent_attested` | not spent |

A doubt between the second and the third row is resolved in favour of the second: nobody will
re-check a report written for an agent with a wrong PASS, and a new launch costs only time.

**The mark `not_agent_attested`.** Whoever opens such a handoff later — a checker,
RELEASE-VALIDATOR, a documentation auditor — must understand without questions where the
words of the agent end and the words of ORCH begin. So the mark is a top-level field of the
handoff, and each of its fields answers one question of the reader:

```json
{
  "written_by": "ORCH",
  "at": "<time from the clock when ORCH wrote this>",
  "reason": "<what happened to the agent and why it did not report>",
  "fields_written": ["status", "completed_at", "result"],
  "evidence": ["<command> -> <what it showed>"],
  "unverifiable": ["<what cannot be established from the files>"]
}
```

| Question of the reader | Field | How to answer |
|---|---|---|
| What here is not from the agent? | `fields_written` | every field of the handoff that ORCH wrote; what is not in the list was written by the agent |
| Who wrote this and when? | `written_by`, `at` | always ORCH; the time is from the clock. `completed_at` of such a handoff equals this same time: nobody knows when the agent would have finished |
| Why is the agent silent? | `reason` | what happened to it: a limit, an error, the end of the turn |
| How does ORCH know this? | `evidence` | commands and their output — one for each statement of the report |
| What does ORCH not know? | `unverifiable` | what cannot be established from the files (for example, whether the agent checked its work before the interruption) |

The answer "nothing" to the last question has to be earned: an empty `unverifiable` is allowed
only if `evidence` has a command for every field from `fields_written`. Otherwise an empty
list is a bookkeeping error.

Marks written before this edition hold only the first four fields; they are not extended.

## Rework steps and re-runs

- **A rework step** is an edit after the verdict of a checking role. The single form is the
  next free letter of the step: after the FAIL of check `05b` the rework step is `05c`, its
  repeated check is `05d` (`step-05c-code-fixer.json`,
  `step-05d-test-design-validator.json`). The start of `task.description` is "rework for FAIL
  <path of the handoff with the FAIL>, gate pass N of 3". The fields `round` and `rework_of`
  are not written in new runs. The task holds only the list of remarks; `result.changes`
  holds a table "what was fixed, where": the number of the remark, the file and the place,
  what it was and what it became; for a text edit — the table "was → became → source" in
  `result.table`. An edit of a file that has already passed a check also goes in a separate
  handoff and is checked again: without a new check such a file is not edited.
- **A re-run after an interruption** — the suffix `-runN`, where `N` is the number of the
  launch: the second launch is `-run2`. It is not a rework step.
- **The version of a verdict in WF-06** — the suffix `-vN`
  (`docs/workflows/WF-06-idea-selection.md`).
- **Old runs.** Before 2026-10-19 a rework step got the suffix `-rN`; such files stay as they
  are. In the handoffs written before this document the count differs: in some steps the `N`
  in `-rN` is the number of the round (the first rework is `-r2`), and one re-run after an
  interruption is named `-r2`
  (`handoffs/WF06-20260925-01/step-05-verdict-executor-r2.json`). The number of the round is
  in the field `round`, the source of the rework is in `context.rework_of`. When you read the
  suffix of an old file, first look at these fields. Old files are not renamed. A step of a
  run that was started with the count by rounds is finished with the same count: otherwise
  the name of the new rework step would coincide with an already written file.
- How many gate passes are allowed: up to three per step — the first and two repeats; the
  third FAIL is a stop and a report to the owner (`decisions/0079`, item 4). What to do at the
  stop is said by the workflow document.

## Bookkeeping check

- After every step and before the next one, ORCH checks the report against the files: what
  the agent called done really exists (quality-bar Q2, Q14). ORCH checks the work of the
  bookkeeper (DOC-UPDATER) with its own commands, for every named file and field. The output
  goes into `context.orch_check`: `at`, `by`, `verdict` and what was checked; it is written on
  PASS and on FAIL.
- A cancelled handoff is not deleted: it has `status: "CANCELLED"` and `orch_cancellation` —
  when and why.
- Bookkeeping files are only appended to (quality-bar §6, item 8).
- The bookkeeping check is done by a command: before handing in a handoff, the author of the
  step runs `cd tools && npm run handoffs-check` and hands in the step at code 0 (the same is
  part of `cd tools && npm run check`). The command does not read the meaning of `task` and
  `result`.
- Only finished handoffs lie in a commit: `COMPLETED`, `FAILED`, `CANCELLED` (with
  `orch_cancellation`) and a stop `IN_PROGRESS` with the first `issues` item of the kind
  "BLOCKED". `PENDING` and `IN_PROGRESS` are allowed while the file is not in a commit or has
  been changed. The handoff of the release step is closed after the push and goes in a second
  commit.
- A correction by ORCH (`orch_correction`, `orch_note`) is an object or a list of objects
  with `by` (a non-empty string) and `at` (a time from the clock), or `at: null` with a
  non-empty `at_note`.
- The paths of the machine's temporary folder are not written in a handoff: write
  `<scratch>/…` or `<outside the project>/…` instead.
