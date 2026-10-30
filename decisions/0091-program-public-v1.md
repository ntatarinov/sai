# 0091 — Program PUBLIC-V1

Status: **accepted** (ORCH, 2026-10-28, on the owner's words of 2026-10-27 in `docs/owner-requests/2026-10-27-public-launch-plan.md` and the launch line appended to that file as the start word; the owner may cancel any item).

## Question

How is the work on a public Sai product organised, who writes which files, and which earlier decisions does it change?

## Options

- A (chosen): one program `PUBLIC-V1` with a fixed plan, an architecture, a checkpoint file and a start prompt, led by ORCH inside owner-started sessions; ORCH's closed write list gains the program folder.
- B (rejected): continue the picker build queue and add the public product as ordinary iterations of the root `PLAN.md`; the public goal, the gates and the owner's order would be spread over many small plans with no single checkpoint.

## Decision

1. Target: one public product site on Vercel, later on the owner's hosting and domain.
2. The colleague's mechanisms (§1 of the program plan) are adopted where they do not contradict the owner's words in `docs/owner-requests/2026-10-27-request-list-to-development.md` and decision 0088: test mode, customers receive nothing, no automatic pick-up, a request list, edits, «В разработку» behind a password, only the owner's console starts development.
3. The work order is `docs/program/public-v1/PLAN.md` with `ARCHITECTURE.md`, the checkpoint `PROGRESS.md` and the prompts `KICKOFF.md`.
4. ORCH's closed write list gains `docs/program/public-v1/**` (bookkeeping and owner instructions, no code) and appending the owner's verbatim words to `docs/owner-requests/`. DOC-UPDATER mirrors it into `CLAUDE.md` in M0 (task M0.10). Until then this record is the source of the extension. ORCH's files are committed only inside RELEASE-FINALIZER's release commits.
5. New requirement blocks from REQ-102 use the language of the owner's answer to G18; until he answers, their free text is Russian like the rest of `docs/requirements.yaml` (decision 0080 keeps that file as it is). Old blocks are never translated.
6. `STATE.md` and the root `PLAN.md` become short current files (M0.10); the old files are kept as full byte copies in `docs/archive/`; sections read by tests stay. The root `PLAN.md` stays the iteration plan of the role files and workflows.
7. The picker build queue stops; the backlog follows decision 0099.
8. The program's `PLAN.md` and `ARCHITECTURE.md` are not edited. A change is a dated row in the "Plan amendments" table of `PROGRESS.md`, each citing a decision.
9. WF-05 step 8 for AUD-001: the owner's words «Разработай план по результату аудита…» and his launch of PUBLIC-V1 are his decision to fix the Critical and High findings of AUD-001 now. Message #1 to the owner states it so that he can object.

## Why

One checkpoint and one order of work let the owner open a result at the end of every milestone and let a session resume after any break without relying on memory. The write-list extension is the smallest change that lets ORCH keep the checkpoint, which is bookkeeping and not product code (AP-009 stays in force).

## Boundary

No publication beyond decision 0092; no money beyond the owner gates; the quality bar is unchanged; no done requirement changes; ORCH still writes no product code.

## Basis

`docs/owner-requests/2026-10-27-request-list-to-development.md`; `docs/owner-requests/2026-10-27-public-launch-plan.md` (with the launch line); owner's words there: «Разработай план по результату аудита и сводки, чтобы это передать sonnet,  так чтобы готовый сайт продукт был публичным на vercel а потом мы переедем на другой хостинг и домен. Как будет готово дай мне отмашку и я запушу все на sonnet»; decisions 0080, 0088, 0089; `docs/audits/AUD-001/report.md`.
