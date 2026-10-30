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
