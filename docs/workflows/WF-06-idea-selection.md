# WF-06 — Idea selection

Several agents analyze the candidate ideas together; one agent gives the final verdict; a
second agent receives the verdict, checks it and applies it in the business logic of the
project. Requirements — REQ-002…REQ-004, design — `docs/design/REQ-002-idea-verdict.md` (the
file contracts are there, §4; here is the order of work).

All commands are run from `tools/`. Time is from the clock: `date -u +"%Y-%m-%dT%H:%M:%SZ"`.

## Roles

| Role | Mandate | What it does in WF-06 |
|---|---|---|
| ORCH | `.claude/agents/orchestrator.md` | Steps 0 and 6: prepares the run, launches the agents, writes all handoffs, checks the result |
| IDEA-ANALYST ×3 | `.claude/agents/idea-analyst.md` | Steps 1–3, each with its own point of view: `market`, `execution`, `owner_fit`. One launch per point of view for all three rounds |
| IDEA-JUDGE | `.claude/agents/idea-judge.md` | Step 4: the final verdict — **the first agent of the owner's request** |
| VERDICT-EXECUTOR | `.claude/agents/verdict-executor.md` | Step 5: receives the verdict, re-checks it, applies it — **the second agent of the owner's request** |
| Owner | — | Step 7: makes the decision. The agents do not make it |

All roles are different launches of agents. The judge and the executor are never analysts.

## Steps

**Parallelism (the owner's requirement: «Агенты должны многопоточно работать» — "The agents
must work multi-threaded").** Everything that does not depend on each other is launched at the
same time — in one message with several agent launches:
- the three analysts in **each** round (steps 1, 2, 3) work at the same time;
- the tasks from `proposed-actions.json` that do not depend on each other (for example, two
  competitor checks) are sent at the same time;
- only real dependencies are sequential: round 2 waits for all the assessments of round 1,
  round 3 for all the checks of round 2, the judge for all the responses, the executor for the
  verdict;
- **the PASS of a check is also a dependency:** the next step does not start until `validate`
  on the previous stage has given OK;
- parallel agents **never write into the same file**: each has its own output file, and ORCH
  assigns them so that they do not overlap. Another's file that is still being written may be
  incomplete — an agent judges its own self-check only by its own file, and ORCH checks the
  whole stage when all are ready (AP-008).

**Step 0 — ORCH prepares the run.**
1. The "before" snapshot is the **first action of the step**, before any edit:
   `npm run snapshot -- <outside the project>/wf06-<RUN-ID>-before.txt`. If something had to
   be fixed after the snapshot, the run starts again with a new RUN-ID (AP-007).
2. Check that the conclusions in the idea files are marked `<!-- conclusion:start -->` …
   `<!-- conclusion:end -->` (design §4.2).
3. `npm run prepare-run -- <RUN-ID> --candidates <ids> --context <paths> --analyst market=analyst-market --analyst execution=analyst-execution --analyst owner_fit=analyst-owner-fit --judge judge --executor executor`.
4. Write the printed `seal` into `context.run_seal` of the handoff of step 0 and into the
   report to the owner.

**Step 1 — round 1, assessments.** ORCH writes three handoffs and launches the three analysts
in parallel. Each writes `assessment-<lens>.json` and checks it:
`npm run validate -- ../runs/<RUN-ID> --stage assessments` (after all three are ready — ORCH
does this).

**Step 2 — round 2, cross-review.** ORCH continues the same three analysts. Each reads the
assessments of the other two and writes `crossreview-<lens>.json`: for **each** other
assessment — `agree` or `disagree` with a proposed score and a quote.
`npm run validate -- ../runs/<RUN-ID> --stage crossreviews`.

**Step 3 — round 3, responses.** ORCH continues the same analysts. Each answers **every**
disagreement with its assessments in `response-<lens>.json`: `revise` (a new score) or `hold`
(holds, with a quote). `npm run validate -- ../runs/<RUN-ID> --stage responses`.

**Step 4 — verdict.** ORCH launches the judge. The judge writes `verdict-N.json` and
`verdict-N.md` (N = 1 or the number of the rework step) and checks itself:
`npm run validate -- ../runs/<RUN-ID> --stage verdict`.

**Step 5 — executor.** ORCH launches the executor. The executor:
1. itself checks the verdict (design §4.9, five mandatory checks) and writes
   `verdict-review-N.json` with `ACCEPT` or `REJECT`;
2. `npm run validate -- ../runs/<RUN-ID>`;
3. on `ACCEPT` or on the third `REJECT`: `npm run apply-verdict -- ../runs/<RUN-ID>`.

**Step 6 — ORCH checks and passes on.**
1. Check the executor's artifacts_out: the block in STATE.md, `proposed-actions.json`,
   `apply-report.json` (the hashes match the files).
2. For each action from `proposed-actions.json`, create a handoff for the next role
   (`handoffs/<RUN-ID>/step-<step>-<role>.json`, `status: PENDING`); if an action depends on
   another — `context.depends_on`.
3. The "after" snapshot — right after the handoffs, before any bookkeeping:
   `npm run snapshot -- <outside the project>/wf06-<RUN-ID>-after.txt`.
4. `npm run snapshot-diff -- <before> <after> --allow runs/<RUN-ID>/ --allow handoffs/<RUN-ID>/ --allow STATE.md`.
5. `npm run validate -- ../runs/<RUN-ID> --seal <seal>`.
6. Only after that — the bookkeeping: the statuses of requirements, `docs/anti-patterns.md`,
   STATE.md outside the block.

**Step 7 — owner.** Reads the block «Рекомендация агентов (WF-06)» ("Recommendation of the
agents (WF-06)") in STATE.md and `verdict-N.md`, makes the decision. The decision to start is
written into STATE.md only by the owner (or by ORCH on the owner's direct word).

## Artifacts

| Step | Who | File in `runs/<RUN-ID>/` |
|---|---|---|
| 0 | ORCH (prepare-run) | `run.json`, `sources/…` (cleaned copies) |
| 1 | IDEA-ANALYST | `assessment-<lens>.json` |
| 2 | IDEA-ANALYST | `crossreview-<lens>.json` |
| 3 | IDEA-ANALYST | `response-<lens>.json` |
| 4 | IDEA-JUDGE | `verdict-N.json`, `verdict-N.md` |
| 5 | VERDICT-EXECUTOR | `verdict-review-N.json`; through apply-verdict — `proposed-actions.json`, `apply-report.json`, the block in `STATE.md` |
| 6 | ORCH | handoffs to the next roles in `handoffs/<RUN-ID>/` |

## Handoffs

The format and the field rules are in `docs/workflows/handoffs.md`. **Only ORCH** writes them;
the recipient changes only `status`, `completed_at` and `result`.

- `workflow_id`: `"WF-06"`; `from_agent`: `"ORCH"`.
- Files: `handoffs/<RUN-ID>/step-00-orch.json`, `step-01-idea-analyst-<lens>.json`,
  `step-02-idea-analyst-<lens>.json`, `step-03-idea-analyst-<lens>.json`,
  `step-04-idea-judge[-vN].json`, `step-05-verdict-executor[-vN].json`, then `step-10…`,
  `step-11…` from `proposed-actions.json`.
- `created_at` and `started_at` — one reading of the clock at sending.
- `context.agent_run_id` — the identifier of the agent's launch; ORCH writes it right after the
  launch. For an analyst it is the same in rounds 1–3.
- `context.run_seal` — only in the handoff of step 0.

## Rework loop

- The executor returned `REJECT` in `verdict-review-N.json` and N < 3 → ORCH launches the judge
  again (a new handoff of step 4 with `-v<N+1>`). The judge writes `verdict-(N+1).json`
  taking `issues` into account, the executor checks it again.
- No more than **3** checks of the verdict. The third `REJECT` → apply-verdict writes an
  escalation block into STATE.md; the run is **ESCALATED**, the decision is the owner's.
- A contract violation found by `validate` at steps 1–3 is fixed by the **author** of the file;
  ORCH continues the same agent with the validate output.

## Stop conditions

- The run is finished: `apply-verdict` printed `applied recommend` or `applied escalate`,
  step 6 is done.
- The run is stopped and escalated to the owner if: `E_SOURCE_CHANGED` or `E_SEAL` (someone
  changed the copies — start a new run); the author cannot fix the contract violation in two
  attempts; snapshot-diff showed changes outside the allowed places.
- A run is never finished "by hand": it is not allowed to write a block in STATE.md, handoffs
  or Pixel Office events bypassing the tools and these steps.
