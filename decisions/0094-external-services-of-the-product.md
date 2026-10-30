# 0094 — External services of the product; REQ-014 criteria 3–4

Status: **accepted** (ORCH, 2026-10-28, on the launch line of `docs/owner-requests/2026-10-27-public-launch-plan.md`; the owner may cancel).

## Question

REQ-014 forbids external network services for Sai's own code. A public product needs hosting, a database and an AI API. What is allowed?

## Options

- A (chosen): REQ-014 criteria 3–4 apply to `tools/` only (WF-01 micro-amendment); `app/` may use a closed list of services.
- B (rejected): keep REQ-014 as written for everything; the public product cannot exist.

## Decision

REQ-014 criteria 3–4 apply to `tools/` only. `app/` may use exactly: Vercel (hosting), Postgres (Neon now), GitHub (code and CI), the Anthropic API (worker, api mode, after G6), later an e-mail provider (G16) and a Kazakhstan host (G14). Each sits behind one module with an https constant address, a timeout and a Q10 failure test. The server fetches no user-supplied URL in V1 (Q11 holds by construction); a feature that adds one brings Q11 tests.

## Why

The owner's public Vercel goal needs these services; a closed list with one module each keeps the surface small and testable.

## Boundary

Does not change `tools/`. Does not buy or enable anything: every paid service waits for its owner gate.

## Basis

The pattern of decision 0069 item 8; REQ-014; `docs/program/public-v1/ARCHITECTURE.md` §3; decisions 0091, 0092.
