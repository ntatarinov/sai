# 0093 — AI providers, Anthropic terms, `--bare`, models and caps

Status: **accepted** (ORCH, 2026-10-28, on the launch line of `docs/owner-requests/2026-10-27-public-launch-plan.md`; the owner may cancel any item; real runs need his written consent, G2).

## Question

Which AI credentials may serve which work, and how is Claude Code run on generated workspaces?

## Options

- A (chosen): AI work only in the worker; the owner's subscription only for his own identities, an API key for everyone else; `--bare` on every generated workspace.
- B (rejected): the web app calls a model with a Sai key directly; a key in the web tier is a Q7 risk and long jobs do not fit a function.

## Decision

1. The web app never holds AI credentials; all AI work runs in the worker through the queue.
2. `owner-local`: the owner's subscription on his Mac, only for jobs created by his own identities in the owner organisation, while he runs the worker or Sonnet runs it for a consented check under G5 «а» (whose wording names risk R2), never for anyone else. Text jobs run with a clean worker `HOME`/`CLAUDE_CONFIG_DIR` if probe P1(c) shows the login still works, otherwise G19 decides.
3. `api`: a Console key paid by the owner (G6) with a workspace spend limit and the app caps, required for any AI work for another organisation.
4. Every Claude Code run on a generated workspace uses `--bare`. Owner-local builds exist only if probe P1 passes, otherwise builds run in api mode after G6. Text jobs without a workspace may skip `--bare` only as ARCH §9.1 says.
5. The model is the owner's answer to G6 (Sonnet 5.5 until then); effort is explicit; `stop_reason` is checked.
6. No "Claude Code" branding in the product; the AI interviewer and the possible inaccuracy of AI output are disclosed (ARCH §9.7).
7. Caps: ARCH §15.
8. Builds for other organisations wait for Anthropic's written confirmation (G17) and the M7 container.
9. The results of P1, P2 and S4 and the owner's G19 answer are appended here as "Addition". ORCH never accepts a residual risk on the Mac by itself.

## Why

The vendor terms and docs quoted in ARCH §9 and program plan §7 (R1–R3): no routing of Free/Pro/Max credentials on behalf of users; bare mode never reads OAuth credentials; no intermediating of Claude usage for end users; AI disclosure; limits "assume ordinary, individual usage".

## Boundary

Spends nothing by itself. Narrows decision 0068 item 4 (the subscription never serves visitors; it may serve the owner's own projects), decision 0069 item 8 and REQ-062.

## Basis

`docs/program/public-v1/ARCHITECTURE.md` §9, §15; program plan §3 (G2, G5, G5b, G6, G17, G19), §4.5, §7; decisions 0048, 0091.
