# 0001 — Product stack and one check command (PUBLIC-V1)

Status: **accepted** (ORCH, 2026-10-28, on the owner's words of 2026-10-27 in `docs/owner-requests/2026-10-27-public-launch-plan.md` «…готовый сайт продукт был публичным на vercel а потом мы переедем на другой хостинг и домен…» and the launch line appended to that file as the start word; the owner may cancel). Fills the row reserved since the start of the project.

## Question

Which stack and which one check command does product code outside `tools/` use (quality bar Q4)?

## Options

- A (chosen): a new top-level folder `app/`, one npm package, Node 22 and plain JavaScript with JSDoc checked by `tsc`, few pinned dependencies, host-specific code behind adapters.
- B (rejected): grow the product inside `tools/src/team/` and `tools/src/web/`; those are the owner's local tools (decision 0003, 0015, 0024) and are never deployed (decision 0092 item 8).

## Decision

1. All product code lives in the top-level folder `app/`, one npm package (ARCH §2).
2. The stack, the pinning rule and the one check command are those of ARCH §3: Node 22.x ≥ 22.23.4, JavaScript with JSDoc, `hono`, `@hono/node-server`, `pg`, PGlite, `zod`, `fflate`, `@anthropic-ai/sdk` in the worker only, `playwright-core`; dev: `typescript` for `tsc`, `eslint`, `prettier`. Each dependency is listed in the first `app/` requirement's design with licence and reason. `ignore-scripts=true`; any exception is named in that design and added here as an "Addition". CI `app.yml` is green before any deploy.
3. Host-specific code sits only behind the adapters of ARCH §3.
4. The results of spikes S1–S3 are appended here as "Addition".

## Why

Portability (the owner's words above), a small auditable surface, and Q4: product code cannot become `done` without one check command.

## Boundary

`tools/` keeps decision 0002; `check.yml` is unchanged; no done requirement changes. Narrows decision 0015 for product code of the public site (it no longer lives in `tools/src/team/`; the team core there remains the engine the worker runs).

## Basis

`docs/owner-requests/2026-10-27-public-launch-plan.md` (quoted above, with the launch line); quality bar Q4; decisions 0002, 0015; `docs/program/public-v1/ARCHITECTURE.md` §2, §3.
