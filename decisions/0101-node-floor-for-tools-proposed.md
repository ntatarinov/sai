# 0101 — Node floor for `tools/` (proposed; in force on G1 part 2 «а» and AC0.4 green)

Status: **proposed**, not in force. It takes effect only when the owner answers «а» to part 2 of G1 and AC0.4 is green (the Mac's `node -v` and the hook's `node-path` binary are both ≥ v22.23.4). Until then `tools/` keeps working on the Mac's current Node.

## Question

AUD-001 DEP-01 (Critical) and DEP-02 (High): the owner's Node 22 is below the patched release. Should the `tools/` floor be raised?

## Options

- A (proposed): raise the floor to 22.23.4; the owner's Pixel Office then refuses older Node.
- B: leave the floor (the default until he answers).

## Decision

If «а»: `tools/package.json` engines `>=22.23.4 <23`; test CI-3 changed in the same run; the Pixel Office refuses Node below 22.23.4; repeated at each Node security release. `app/` uses `engines: "22.x"` with the start-up floor of ARCH §3. Node 24 for `tools/` and `app/` before 2027-03-31 by a later decision (Node 22 ends life on 2027-04-30). The owner's answer and its date are appended as "Addition".

## Why

The audit found the unpatched Node a Critical and a High finding; the floor makes it checkable.

## Boundary

Only after the owner updates Node himself (program plan §3, G1; no separate Node copy, AP-021). Does not touch `.claude/settings.json`.

## Basis

AUD-001 DEP-01, DEP-02 (`docs/audits/AUD-001/report.md`); the owner's answer to G1; decision 0002.

## Addition 2026-11-17 (ORCH, session 3 of the program PUBLIC-V1) — in force

Status from this date: **accepted**. Both conditions of the first line are met: the owner answered part 2 of G1 «Да (Рекомендую)» (2026-10-28, session 1, chat question; `docs/program/public-v1/PROGRESS.md`, Owner gates, G1), which is the option «а» of this record; AC0.4 is green — measured by ORCH read only on 2026-11-17: `node -v` → v22.23.4 and the binary of the Pixel Office hook's recorded `node-path` → v22.23.4 (PROGRESS, Log). The boundary "only after the owner updates Node himself" was met by ORCH's `brew upgrade node@22` on the owner's word «ты сам обнови» (2026-10-28, G1 part 1), with no separate Node copy.

What the diagnosis of the run ISS-0092-20261117-01 (step 01) adds, for the design of the fix (Q12; each point is settled by the design and its ORCH record, not here): `engines` alone refuses nothing (npm only warns, also with the raised floor), so the refusal lives in runtime guards; every place that checks Node today checks the major only (`tools/package.json`, the lockfile, the guard of `tools/src/pixel-office/main.js`, `node_is_22` of the hook, and the hook runs the binary of `node-path` with no check at all); the other entry points of `tools/` have no guard (DEP-02); CI takes the runner's cached Node 22 (v22.23.3 on most runs up to 2026-10-27), so it must be bound to the floor. The scope follows ISS-0092 «Как исправить»: DEP-01 (Pixel Office server and hook) and DEP-02 (the other entry points) are closed together, as the defect says.
