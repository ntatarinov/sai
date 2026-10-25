# WF-07 — Business plan

The agents make a business plan from facts: they research the market in parallel, a separate
agent checks each research, then one agent writes the plan only from the checked facts,
another checks it, and only after the final check is the requirement closed. The requirement
is REQ-005.

All roles follow `docs/quality-bar.md`. There are no invented numbers: every number comes with
a link and a date or with the mark «допущение» ("assumption"). Independent work is launched in
parallel, the PASS of a check is a dependency for the next step (the ORCH mandate).

## Roles

| Role | Mandate | What it does |
|---|---|---|
| ORCH | `.claude/agents/orchestrator.md` | Assigns topics and output files, launches the agents, writes handoffs and `context.agent_run_id` |
| MARKET-RESEARCHER ×N | `.claude/agents/market-researcher.md` | One product line — one researcher and one file; search on the internet |
| PLAN-VALIDATOR | `.claude/agents/plan-validator.md` | Step 1b — checks each research; step 3 — checks the plan |
| PLAN-WRITER | `.claude/agents/plan-writer.md` | Writes the plan only from the checked research and the project documents |
| RELEASE-VALIDATOR | `.claude/agents/release-validator.md` | Step 4 — itself re-checks all the criteria of REQ-005 |
| DOC-UPDATER | `.claude/agents/doc-updater.md` | Step 5 — sets the status, updates `STATE.md` |
| Owner | — | Reads the plan, makes the decisions from the section «Решения владельца» ("Owner's decisions") |

All roles are different launches of agents. A researcher does not check their own research,
the author of the plan does not check their own plan.

## Steps

**Step 0 — ORCH.** Creates `handoffs/<BP-ID>/` (`BP-YYYYMMDD-NN`), assigns each line a
researcher and a file `docs/business-plan/research/<line>.md`. The requirement must pass
REQ-VALIDATOR before step 1.

**Step 1 — research, in parallel.** All researchers at the same time, each writes only its own
file.

**Step 1b — check of the research, in parallel.** One launch of PLAN-VALIDATOR per file: checks
the REQ-005 criterion about research, itself opens at least 3 links from different sections.
PASS or FAIL with remarks.

**Step 2 — plan.** Only when all the research has passed step 1b. PLAN-WRITER writes
`docs/business-plan/README.md`.

**Step 3 — check of the plan.** PLAN-VALIDATOR (another launch, not the author) checks every
number and every REQ-005 criterion about the plan.

**Step 4 — final check.** RELEASE-VALIDATOR re-checks all the criteria of REQ-005.

**Step 5 — bookkeeping.** DOC-UPDATER sets REQ-005 to `done` and updates `STATE.md`; ORCH
checks its changes.

## Artifacts

| Step | Who | File |
|---|---|---|
| 1 | MARKET-RESEARCHER | `docs/business-plan/research/<line>.md` |
| 1b, 3 | PLAN-VALIDATOR | `result` in its own handoff |
| 2 | PLAN-WRITER | `docs/business-plan/README.md` |
| 4 | RELEASE-VALIDATOR | `result` in its own handoff |
| 5 | DOC-UPDATER | `docs/requirements.yaml` (status), `STATE.md` |
| 0–5 | ORCH | `handoffs/<BP-ID>/step-*.json` |

## Handoffs

The format is in `docs/workflows/handoffs.md`: `workflow_id: "WF-07"`, `from_agent: "ORCH"`,
`created_at` and `started_at` — one reading of the clock. ORCH writes the
`context.agent_run_id` of each agent; the recipient changes only `status`, `completed_at`,
`result`. If a limit stopped the agent — ORCH checks the files, writes the pause into
`context.interruptions` (the time is from the clock or «неизвестно» ("unknown"), with the last
change of the agent's file) and continues the same agent after the reset. If the agent ended
again without a result — the handoff is closed as FAILED with the mark `not_agent_attested`
and a new launch is sent (AP-006). If the agent managed to write the file but not the report —
ORCH adds the report with the same mark.

## Rework loop

- Step 1b FAIL → the same researcher fixes their file, then 1b again. No more than two rework
  steps per file.
- Step 3 FAIL → the same PLAN-WRITER fixes the plan, then step 3 again (a new launch of the
  checker is allowed). No more than two rework steps.
- Step 4 FAIL → the remarks go to the executor of the corresponding step, then step 4 again.
  No more than two rework steps.

## Stop conditions

- **Done:** steps 3 and 4 are PASS, DOC-UPDATER closed REQ-005.
- **Blocked:** after the second rework step it is still FAIL — REQ-005 gets the status
  `blocked`, the remarks are passed to the owner. An escalation does not count as completion.
- If no sources are found for a line, this is recorded as a fact («не найдено» ("not found"),
  where they looked), and is not replaced by a guess.

## Variant: a short document with a value gate

The variant for REQ-006 (the run `BP-20260930-01`): a short document about one line only —
Pixel Office — in which the "value gate" is checked before everything else: one phrase about
what people pay for, and a table of competitors. The roles are the same. Where the main text
above names REQ-005 or its sections, the criteria of REQ-006 apply for the variant: "REQ-006
applies instead of REQ-005". The conditions of step 2b are set by the requirement of the
variant (for REQ-006 — criteria 4–6) and by this section; ORCH writes them into the task of
every handoff of step 2b, and the role file of PLAN-VALIDATOR refers here.

The order: 00a REQ-ANALYST (the requirement) → 00b REQ-VALIDATOR (PASS before step 1, AP-010)
→ ORCH: `in_progress`, `parallel-runs.jsonl`, the "before" snapshot → 1 two MARKET-RESEARCHERs
in parallel (one file each) → 1b PLAN-VALIDATOR on each file in parallel → 2a → 2b → 2c → 3 →
4 → 5.

Step 2a — PLAN-WRITER writes only the section «## Ценность одной фразой» ("Value in one
phrase"): the value line (one sentence of no more than 60 words) and under it the table of
competitors. It starts after the PASS of step 1b of both researches. Before handing in, the
author itself runs the mechanical form checks and attaches their output. There are no rework
steps.

Step 2b — PLAN-VALIDATOR (another launch, not the author) itself opens the links and gives the
verdict PASS, FAIL or SOURCE_UNAVAILABLE by six conditions; no rework step. FAIL if: (1) at
least one form-check command was not run; (2) the phrase does not name who pays, the result or
the elements, or does not say why the result cannot be obtained in the same way in Claude,
Copilot and Pretty Prompt; (3) some product in the coverage tables of the researches has "yes"
for all the elements that the phrase promises; (4) the phrase or the table says more about a
competitor than the research cell; (5) an opened link does not confirm the fact of the table, or
the fact is not in the named file outside the conclusion areas; (6) a required row of the table
is missing. SOURCE_UNAVAILABLE — only if for some row of the table not a single link opened,
and conditions 1–6 are not met.

Step 2c — PLAN-WRITER writes the rest of the document. On PASS at step 2b — the sections of the
outcome «проверка на 14 дней» ("a 14-day check") (for whom, the pain, what it does, the numbers
in the scenarios, the check in 14 days, what is not proven, the link with the big plan). On FAIL
— the document «рано» ("too early"): the outcome, an attempt to formulate the value with the
reasons for the refusal, what has to be learned first, the link with the big plan.

Step 3 — PLAN-VALIDATOR (not the author) checks the whole document by the criteria of REQ-006;
the checks of the mandate that are tied to REQ-005 (the required sections, the 30-day plan, the
numeric stop criteria) are replaced by the criteria of REQ-006. Step 4 — RELEASE-VALIDATOR
itself re-checks the criteria of REQ-006, except the criterion about bookkeeping, and derives
the verdict of gate 2b again from the coverage tables and the table of the author of step 2a.
Step 5 — DOC-UPDATER: process errors go to `docs/anti-patterns.md`, the state of affairs to
`STATE.md`, the status of the requirement is the last action; in the run `BP-20260930-01` this
section was also added at this step (until step 4 WF-07 is protected from edits by the
snapshot). ORCH itself checks the bookkeeping (criterion 19 of REQ-006) and writes the output
into `context.orch_check`.

### Gates and outcomes

- A FAIL at step 2b immediately gives the outcome «рано» ("too early"): there is no rework step,
  the gate is not opened a second time. A PASS at step 2b gives the outcome «проверка на 14
  дней» ("a 14-day check").
- The outcome «рано» is a lawful completion, not a failure: the run goes through steps 3–5, and
  the requirement can become `done`.
- The status `blocked` — only if: SOURCE_UNAVAILABLE repeated on the second launch of 2b
  («источник недоступен» — "source unavailable"); RELEASE-VALIDATOR at step 4 came to a verdict
  of the gate different from 2b, in either direction («вердикт ворот оспорен» — "the verdict of
  the gate is disputed": the owner decides both verdicts, there is no rework step of 2b); a FAIL
  remained after the second rework step at step 1b, 3, 4 or 5.

### The "before" snapshot and parallel runs

- ORCH takes the "before" snapshot once, before sending step 1: after the PASS of step 00b,
  after moving the requirement from `pending` to `in_progress` (this is the only change of the
  requirement block before step 5) and after creating `parallel-runs.jsonl`. The command is
  `npm run snapshot -- ../handoffs/<BP-ID>/snapshot-before.txt` from `tools/`. The snapshot does
  not contain the outputs of the variant and the handoffs of step 1.
- In the `context` of both handoffs of step 1, ORCH writes `snapshot_before_sha256` (the sha256
  of the snapshot file) and, for the blocks REQ-006 and REQ-005 of the file
  `docs/requirements.yaml`, the number of lines and the sha256: `req006_block_lines`,
  `req006_block_sha256`, `req005_block_lines`, `req005_block_sha256`. A block is selected by the
  identifier, not by line numbers: the command is in criterion 14 of REQ-006.
- The snapshot is not taken again after edits (AP-007). If after it something outside the
  outputs of the variant, `handoffs/<BP-ID>/`, `STATE.md` and the declared paths of other runs
  had to be changed, the run is redone with a new BP-ID, or there is a written exception of the
  owner. At step 4 RELEASE-VALIDATOR itself takes the "after" snapshot outside the project and
  compares it with the "before" snapshot.
- ORCH keeps `handoffs/<BP-ID>/parallel-runs.jsonl` only by appending: one JSON line per run;
  an addition of paths is a new line with the same `run_id`; the lines already written are not
  edited or deleted. The fields: `run_id` — the name of the handoff folder of the run;
  `declared_at` (UTC); `serves` — a non-empty list of what the run serves (`REQ-NNN`,
  `ISS-NNNN` or `decisions/NNNN`), without the requirement of the variant; `paths` — the paths
  that the run may change (a folder ends with `/`), among them always `handoffs/<run_id>/` —
  its own handoffs. A declared path does not coincide with the protected set and the outputs of
  the variant, does not contain them and does not lie inside them.
- The declaration comes before the first handoff of the run: a run that is going on at the
  moment of the "before" snapshot is declared before step 1 is sent; a new one — before its
  first handoff is sent. When sending step 1, ORCH writes `parallel_runs_lines` and
  `parallel_runs_sha256` into the `context` of both handoffs: with them, at step 4 it is visible
  that what was already declared was not rewritten.

### Rework limits and handoff names

- Step 1b — no more than two rework steps per research file.
- Step 3 — no more than two rework steps of the document.
- Step 4 — no more than two rework steps.
- Step 5 — no more than two rework steps (`step-05-doc-updater-rN.json`). The limit is given by
  criterion 19 of REQ-006; the main text of WF-07 has no limit for step 5. The final `done` only
  if `context.orch_check.verdict` of the last handoff of step 5 is "PASS".
- Steps 2a and 2b have no rework steps. If 2b gave SOURCE_UNAVAILABLE, ORCH sends one new
  launch (`…-runN.json`, this is not a rework step).
- The name of a rework step after a FAIL is the same name with `-rN`; a re-run after an
  interruption (AP-006) is `-runN`. In `-rN` for the new steps (2c, 3, 4, 5) N is the number of
  the rework step, counting from 1: the first rework step is `-r1`. For the steps 00a, 00b, 01
  and 01b N is the number of the round, the first pass is round 1: the first rework step is
  `-r2`. The handoffs of the run `BP-20260930-01` are named this way and are not renamed: their
  names are already given in other handoffs and in the requirement. When you read a suffix,
  first look at which step it is.
- A rework step after a PASS spends the rework limit in the same way as a rework step after a
  FAIL, and requires a new run of the same check on the changed file: after the PASS of step 1b
  — a new 1b, after the PASS of step 3 — a new step 3. This is how the second and last rework
  step of the research `session-review-platforms` (after a PASS with corrections) used up the
  reserve of rework steps without a new FAIL. A file that has passed a check is not edited
  without a new check.
