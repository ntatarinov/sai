# 0098 — Development sessions and rights; who starts in test mode

Status: **accepted** (ORCH, 2026-10-28, on the owner's words in `docs/owner-requests/2026-10-27-request-list-to-development.md` and decision 0088; the owner may cancel any item).

## Question

Who may start, pause and resume agent work on a project, and under what conditions?

## Options

- A (chosen): a server-side development session created by the platform admin's password re-entry plus a one-time confirm token; only the admin starts or resumes.
- B (rejected): the file-based launch password of REQ-089 on a local server; it does not fit a deployed product with accounts.

## Decision

1. Agents work on a project only inside a server-side development session (ARCH §7), created by the platform admin's password re-entry plus a one-time confirm token and bound to the project and the approved ТЗ version.
2. Timers and limits as ARCH §7.1 (settings only within the brackets).
3. On a lapse no new task starts, running attempts may finish within the drain, then a hard pause; the journal keeps the state. Resume needs re-auth and continues from the last checkpoint.
4. Only the platform admin starts or resumes. Other users get only `view` or `stop` through one-time codes, and in V1 only the owner's own identities (`users.is_owner_identity`) may hold `stop`. Customer self-start only by the owner's word.
5. 3 sessions per project, 5 per day (failed starts count), one build at a time, the kill switch.
6. The account password replaces the file-based launch password of REQ-089 (decision 0089 C6/C7 in this point).
7. Builds use the engine (planner, developer, reviewer, goal check) with parallel 1 and deliver a static multi-file tree, replacing decision 0089 C2–C4.
8. The core's irreversible stop is never used by sessions.

## Why

The owner's words (quoted in decision 0088): start only behind a password and by his button, no automatic pick-up, no wasted tokens.

## Boundary

Does not start any work by itself. Decision 0088 items 1–3 stay in force.

## Basis

`docs/owner-requests/2026-10-27-request-list-to-development.md` (quoted in decision 0088); decision 0088 items 2–3; `docs/program/public-v1/ARCHITECTURE.md` §7; the colleague's brief §9 as advice.
