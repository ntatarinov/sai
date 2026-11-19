# Sai plan — the current iteration

ORCH keeps this file (`CLAUDE.md`, the closed list of what ORCH writes): the current iteration, its rules and the requirements that ORCH adds to it after their check (WF-01, step 3). The iterations 1–9 and the queues up to the run M0DOCS-20261117-01 are in `docs/archive/PLAN-until-M0DOCS-20261117-01.md`, a byte copy of the file this one replaced.

Rules:

- One iteration — one result that the owner can see himself. After each iteration — a short report to the owner: what is done, how to check it himself, what is next. The next iteration starts after the report.
- Одновременно работают не больше двух агентов.
- The two lanes of the program and a running worker job share these two slots (`docs/program/public-v1/PLAN.md`, §4.7).

## Current iteration — PUBLIC-V1 milestone M0 «Clean start»

The work goes by the program PUBLIC-V1 (`decisions/0091`, `decisions/0115`): the plan `docs/program/public-v1/PLAN.md` (milestone M0 — its §5: tasks M0.1–M0.14, acceptance AC0.1–AC0.9), the architecture `docs/program/public-v1/ARCHITECTURE.md`, the checkpoint `docs/program/public-v1/PROGRESS.md` («Now» — what runs and the next step). The owner sees the result in report #M0 (task M0.14).

## Requirements of the iteration (ORCH adds each one after its check, WF-01 step 3)

The requirements of the program that are checked and not yet done, and REQ-102 (done in release 1 of M0, kept as the record of the iteration); the statuses are in `docs/requirements.yaml`.

| Requirement | P-code | Run of its WF-01 gate |
| --- | --- | --- |
| REQ-102 | R0.1 | ISS-0093-20261028-01 |
| REQ-103 | R0.3 | M0BACKLOG-20261028-01 |
| REQ-108 | R1.1 | M1SITE-20261117-01 |
| REQ-109 | R1.4 | M1SITE-20261117-01 |
| REQ-110 | R0.2 | ISS-0092-20261117-01 |
| REQ-111 | R1.2 | M1SITE-20261119-01 |
| REQ-112 | R1.3 | M1SITE-20261119-01 |
