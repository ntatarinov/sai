# 0129 — The owner's instruction of 2026-11-22: the strongest model, everything to the maximum; audit, fix, build what is not built

Status: **accepted** (the owner's words; the reading and the way of work are ORCH's, the owner can cancel each point by a
word).

## Question

On 2026-11-22, after the wording snapshot of REQ-113 was sent to GitHub, the owner stopped the work, switched the session to a
stronger model and gave a new instruction. What exactly does it start, in which order, and what changes in the way ORCH works?

## Owner's words (verbatim)

- «Стоп» (2026-11-22, chat; ORCH stopped its own waiting for the GitHub result and did nothing else).
- «Я переключился на Fable 5.2 надо по максимуму все сделать» (2026-11-22, chat).
- «Продолжаем работать по Sai 1. Сделай аудит 2. Выяви ошибки и исправь 3. Реализуй фичи которые не были реализованы»
  (2026-11-22, chat).

## Options

1. Read «аудит» as the project's own health audit (WF-05), with its roles, its report and its defects. **Chosen.**
2. Read it as a free review outside the workflows. Rejected: its findings would have no handoffs, no re-check by the compiler
   and no defects that WF-03 can take.

## Decision

1. **«Сделай аудит» = WF-05, audit AUD-002** (run AUD-002-20261122-01). The owner did not name the scope, so step 1
   (AUDIT-SCOUT) runs and decides by the trust passports; the dimension «Requirements» is in the plan (the owner asked about
   the project as a whole). Because he asked for the maximum, no row of the scope is postponed for lack of agents: the rows
   marked «можно перенести» are taken too.
2. **«Выяви ошибки и исправь» is the owner's decision of WF-05 step 8, given in advance.** The confirmed defects of the audit
   go into work under WF-03 without a second question, security and Critical first, then High, then the rest. Each fix still
   passes its own gates. ORCH gives the owner the list of defects before the fixes start and the result after them.
3. **«Реализуй фичи, которые не были реализованы» = the stages in the order of decisions/0127** (0b → 1 + 7a → 2 → 4a → 3 → 5 →
   4b → 7b → 6), each through WF-01 and WF-02. Nothing is built without its requirement, its design and its gates. REQ-113
   (already built, in its release checks) is finished first as the nearest feature.
4. **The way of work from this instruction on.**
   - The agents of the roles run on the model of the session (the owner switched it himself).
   - Independent steps run at the same time (docs/workflows/handoffs.md, «How ORCH writes the task»); a step that needs the
     PASS of another waits for it. This replaces «one agent at a time» of the autonomy mode for this instruction.
   - PLAN §4.6 («at most two agents at a time») is written for the owner's 16 GB MacBook. This Windows PC was measured on
     2026-11-22: 31.9 GB of memory, 12 logical processors. On it: at most ten agents at a time; **one browser at a time**
     stays (UAT, DESIGN-QA); no check command runs here at all (decisions/0110).
5. **What does not change.** A push to GitHub, a deploy and the deletion of data or branches happen only on the owner's «да»
   (asked each time, unless he gives a standing permission for the temporary `ci/*` branches); gate G21; gate G2 (real model
   runs and their cap are the owner's money, decisions/0127 В); the rule of the reference product; the commit author; the
   frozen PLAN.md and ARCHITECTURE.md (decisions/0091).

## Why

The project already has a workflow for each of the three things the owner asked: WF-05 for the audit, WF-03 for the defects,
WF-01 and WF-02 for what is not built. Using them keeps every finding re-checked and every fix proved by a test. The limit
of two agents protects a small laptop; on this PC it would only slow the work the owner asked to do to the maximum, while one
browser at a time still protects the measurements.

## Boundary

This record starts no real model run and spends none of the owner's money. It does not change the order of the stages or any
requirement. The machine reading of item 4 is listed as a row of «Plan amendments» in docs/program/public-v1/PROGRESS.md; the
plan itself is not edited.

## Basis

The owner's chat messages of 2026-11-22 quoted above; docs/workflows/WF-05-health-audit.md (steps 1 and 8);
docs/workflows/handoffs.md; docs/program/public-v1/PLAN.md §4.6; decisions/0091, 0110, 0127; quality-bar Q12.
