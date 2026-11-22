# 0127 — The owner's answers to the architecture audit of stage 0 (docs/audits/SAI-ARCHITECTURE-AUDIT.md, chapter 12)

Status: **accepted** (the owner's choice, 2026-11-22, session 4 on the Windows PC, recorded by ORCH).

## Question

The audit of stage 0 (written 2026-11-22 from the facts of the repository; the reference product is only called «референсный
продукт» in Sai files) put ten questions to the owner (chapter 12, А–М) and recommended an answer to each. The owner was asked
to take the recommendations and have ORCH record them and open the next stage.

## Owner's words (verbatim)

«Начни с того что считаешь рациональным сам. Ты мой технический директор и советник.» (2026-11-22, after the audit was
delivered); and, offered the choice «Берём рекомендации аудита» (ORCH records the five decisions of chapter 12 as decisions
and opens the next stage): «Затем преступай к 2 пункту - «Берём рекомендации аудита» оформит пять решений из главы 12 как
записи и откроет следующий этап.»

## Decision

The recommendations of the audit are taken, point by point, with one exception named in В:

- **А. Process engine.** decisions/0099 stays (no business process templates; REQ-020 and REQ-034 stay `cancelled`). The words
  «process engine» of the owner's brief are read as the **state machine of a development session** (audit R-7): fixed graph
  of one chain (interview → ТЗ → development → result), with pause, resume, return to an earlier stage, human confirmation,
  step timeouts and a «stuck» signal. Variant 2 («versions of the fixed chain as data») waits for a second chain.
- **Б. Scope of V1.** PLAN §2 stays: agents build static sites only. A public API and webhooks are stage 6, after V1, with their
  own decision; a read-only API (status, result, event subscription) becomes a candidate right after M4 only when a first
  external integrator appears.
- **В. Real model runs.** **G2 stays as it is** (ask before every real run; no written «да» and no cap, no run). The audit
  recommended a package permission with a small cap after stage 4a; **ORCH does not set the numbers**: the cap (the number of
  runs and the sum per week) is the owner's money and limit, so the question comes back to him in writing at the end of stage
  4a, before the first real run of stage 4b. All of stage 4a runs on the test executor.
- **Г. Where the executor lives.** The Windows PC stays a thin client (documents and site code; the checks run on GitHub in Linux);
  the agent executor stays on the Mac for now; a Linux container (gate G15) is taken to stage 7b with the worker container of M7.
  Porting the team core to Windows is not planned.
- **Д. Numbers in STATE.md.** A mechanical comparison (a test that compares the count of `- id: REQ-` blocks in
  `docs/requirements.yaml` with the number in STATE.md, the idea of REQ-040) becomes a requirement of stage 0b.
- **Е. Bookkeeping behind the code.** Closed in the usual order, through the gates (RELEASE-VALIDATOR, then DOC-UPDATER): done
  on 2026-11-22 for REQ-108, REQ-109, ISS-0037 and ISS-0119 … ISS-0123 (run M1RECHECK-20261122-01). ISS-0092 stays open (its
  code part is REQ-110).
- **Ж. Test executor.** In the owner's own organisation the test executor may run, always marked «тест» in the interface and in
  the data (ARCH §8 demo rule); in client organisations it is forbidden in production (it stays in tests and for the owner).
- **З. «Show the basis» from any state.** The full view (from a state to the event, the task and the result) is only for the
  platform administrator and is written to the audit; clients keep the projection of decisions/0097 (no task texts, paths or
  comments in the office).
- **И. Roles.** Four organisation roles `org_owner`, `org_admin`, `member`, `viewer` from migration 0002 (a row in the Plan
  amendments table of PROGRESS.md; the platform administrator stays a separate attribute of the user).
- **К. Frozen plan.** PLAN.md and ARCHITECTURE.md are still not edited (decisions/0091); each change is a row of the table «Plan
  amendments» in PROGRESS.md. The owner's approval covers items А–З one by one as written here; the clean-up of the records and
  the backup rehearsal (stage 7a) are taken as one package.
- **Л. Two lines of history.** First finish the disputed handoff `M0DOCS-20261117-01 step-05c` (the only violation of
  `handoffs-check`), then the release of the records to `main` (M0.13). The push to `main` waits for the owner's «да».
- **М. `platform_settings`.** The keys `kill_switch` and `caps` exist in the production database and no code reads them: noted
  as «not built yet», not as a function.

**The order of stages** (audit chapter 9.2): 0 → **0b** (records in order and cheap gates) → 1 + **7a** (backup and its rehearsal
from the moment of migration 0002) → 2 → **4a** (queue, worker, provider registry on the test executor) → 3 (stages as data)
→ 5 → **4b** (real runs under G2) → 7b → 6. The M-numbers of the plan do not change; dependencies: 2 needs 1; 4a needs 2; 3 needs
4a; 5 needs 3; 6 needs 2 and 3; 7a needs the first data migration.

**The next stage is 0b** (audit chapter 10, «Этап 0б»): `handoffs-check` prints zero violations, `main` and `m0-records` are
one line, the count of requirements in STATE.md is compared with the file by a test, the closed defects name the commit and the
re-check run, the Milestones table has no «not started» for M0 and M1, and the cheap gates of audit R-11 come one per stage.

## Why

Each recommendation rests on the facts of the audit (measured in the repository, marked MEASURED) and on the decisions the owner
already took (0091, 0097, 0099, 0110, 0115, G2). Only В touches the owner's money; ORCH does not decide it for him.

## Consequences

- PROGRESS.md gets amendment rows for the roles, the order of stages, the process-engine reading, the provider registry, the test
  executor rule and the admin-only «show the basis» view.
- Stage 0b is opened with requirements through WF-01 (a requirement of the comparison test of the numbers and the other points of
  stage 0b that are not yet done).
- Nothing of stages 1–7 is implemented before its own requirement, design and gates.
