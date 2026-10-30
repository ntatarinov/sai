# 0095 — Team core for builds: byte-exact results, engine time, worker hooks

Status: **accepted** (ORCH, 2026-10-28, on the launch line of `docs/owner-requests/2026-10-27-public-launch-plan.md`; the owner may cancel).

## Question

AUD-001 finding SEC-01: the team core masks result files, so generated code gets «[скрыто]» marks. How does the core change for builds without weakening secret protection?

## Options

- A (chosen): the changes CORE-0…CORE-9 of ARCH §10, nothing else in the core; result files are stored byte-exact and refused if they contain a real secret; `maskSecrets` stays for journal text.
- B (rejected): loosen the masking rules for everything; the journal and the owner's Pixel Office would lose their protection.

## Decision

The changes CORE-0…CORE-9 of ARCH §10, nothing else in the core. `maskSecrets` stays for journal text and the owner's Pixel Office (ISS-0058 stays open for that text). TM-57, TM-58, TM-63, RF-03, SF-13 and the TM-09 criterion change only through "was → became" tables; the REQ-009 and REQ-013 criteria about masked files are micro-amended (not weaker: secrets are still never stored).

## Why

AUD-001 SEC-01 (41 «[скрыто]» marks in one generated file, the only clean copy deleted), ISS-0065, ARCH §8.

## Boundary

Touches `tools/src/team/` only; no `app/` code; the guard tests named stay green unless a "was → became" table says otherwise.

## Basis

`docs/audits/AUD-001/report.md` (SEC-01); `docs/program/public-v1/ARCHITECTURE.md` §8, §10; decisions 0017, 0091.

Narrowed by decisions/0102 (2026-10-28): CORE-0 points 3 and 4 — accepted sources are still removed from `work/` (0018 P6, 0035 stay) and the guard-test table has eight tests, not five.
