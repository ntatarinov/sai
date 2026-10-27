# 0090 — The first audit (AUD-001) in a compressed form: one auditor per dimension across all parts

Status: **accepted** (ORCH, 2026-10-27, by the owner's request «Сделай полный аудит проекта sai и сводку, чтобы я смог тебе направление дать … я должен отчет дать себе и коллегам»; the owner may cancel).

## Question

WF-05 gives one handoff per part and dimension. For the first audit of the whole project that is about 30 auditor runs plus 33 requirement re-checks — far over the agent and memory limits of the owner's computer (`PLAN.md`: at most two agents at a time).

## Decision

1. Step 1 (AUDIT-SCOUT) is skipped: the owner named the scope — the whole project.
2. ORCH writes the plan (`docs/audits/AUD-001/plan.json`) and the row in `docs/audits/README.md` itself instead of AUDIT-PLANNER (step 2); the content follows step 2.
3. One auditor per dimension checks all parts; every finding names its part, so AUDIT-COMPILER still scores by part (decisions/0009). Reports: `docs/audits/AUD-001/all/<dimension>.json`.
4. The dimension Requirements goes in two handoffs of RELEASE-VALIDATOR (16 and 17 requirements); reports are per requirement as WF-05 says.
5. At most two agents at a time. A check that spends the owner's limit or money is "not checked" (no real Claude Code runs in the audit).
6. Steps 4–7 (compiler, ORCH check, triage, bookkeeping) as WF-05 says.

## Why

The owner needs the whole picture for himself and his colleagues today; depth per part is traded for breadth, which is the aim of a first audit.

## Boundary

Fixes nothing; only the audit folder, defects by triage, handoffs and bookkeeping are written.
