# 0099 — Backlog re-scope and the supersede method

Status: **accepted** (ORCH, 2026-10-28, on the owner's words of 2026-10-27 in `docs/owner-requests/2026-10-27-public-launch-plan.md`; the owner may cancel).

## Question

68 requirements are not `done`. Which of them does the public product need, and how is history kept while priorities change?

## Options

- A (chosen): classify every requirement not done as KEEP, RESCOPE, DEFER or SUPERSEDE (program plan §6); never delete history.
- B (rejected): delete or rewrite old requirement blocks; history of what was decided and why would be lost.

## Decision

Program plan §6 classifies every requirement not done. History is never deleted. SUPERSEDE: the status line becomes `status: cancelled   # <UTC> superseded by decisions/0099 (PUBLIC-V1): <one line>` and the block text stays. RESCOPE: the block stays `pending` until its replacement passes WF-01; in that run it becomes `cancelled   # <UTC> replaced by REQ-1NN (<P-code>)`. KEEP and DEFER stay `pending`; DEFER gets `# deferred by decisions/0099 (PUBLIC-V1)`. An old decision gets one appended line `Narrowed by decisions/NNNN (<date>): <scope>` and a note in the status column of `decisions/README.md`; nothing else changes. Open defects of superseded areas stay open with a comment pointing to the requirement that covers them. The picker build queue stops; its useful parts continue from REQ-102.

## Why

The owner's request to build the public product, while keeping the history of earlier decisions (the colleague's brief §2 «Сохраняй историю прежних решений, но явно фиксируй изменение приоритетов», as advice).

## Boundary

Applied by the M0 backlog run (WF-01), not by this record; changes no requirement block by itself.

## Basis

`docs/owner-requests/2026-10-27-public-launch-plan.md`; program plan §6; decision 0091 item 7.
