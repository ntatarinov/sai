# 0097 — Project office: data set, renderer, honesty

Status: **accepted** (ORCH, 2026-10-28, on the launch line of `docs/owner-requests/2026-10-27-public-launch-plan.md`; the owner may cancel any item). Item 6 takes effect only with the owner's «а» to G22.

## Question

What does a project's private office show, who sees it, and where do its events come from?

## Options

- A (chosen): a safe projection of the engine journal, one renderer in the approved v3 style, visible only to users with a `view` grant.
- B (rejected): mirror the owner's local Pixel Office or show task texts; it would leak customer data and the owner's machine.

## Decision

1. Public pages show an illustrative stage scene with the owner's stage words, Sai's role titles and an honest caption, never agent events (decision 0083 item 7 stays for public pages).
2. A project's private office shows only the safe projection of ARCH §11.2, never task texts, notes, chat, file names, code, paths, costs or internal ids.
3. Only a user with a `view` grant on that project sees it: in test mode the admin and the owner's own identities, customers after G11.
4. One renderer in `app/public/office/` in the approved v3 style; the grid and movement of the owner's office are ported (not imported; internal words removed; port-parity test). The owner's office in `tools/src/pixel-office/` stays local and untouched.
5. Every movement, bubble or mark carries its source event `seq`; idle stays idle; 60 minutes without events → «нет свежих данных».
6. This is the separate record decision 0015 requires for a second event source: the project office takes events only from the engine journal (append-only, real time, fsync per event) and the server's session transitions. Quality-bar R2 is read this way only after the owner's G22 «а» (his answer is quoted here when given); until then R4.3 and R6.1 wait.

## Why

R2 (only the truth) and Q8 (no mixing of customer data) both hold: events are real, and the safe set is decided by the server.

## Boundary

Narrows REQ-097's four-step set and single role (for the platform, within decision 0088's narrowing of 0083 item 7 for the cabinet); decision 0074 item 3 and decision 0084 §1 (the renderer for `app/`; the R1.3 block's "was → became" table covers REQ-066 criterion 3 and the REQ-071 import rule). Carries decision 0074 item 6's word ban over to every file under `app/public/`. The quality bar is unchanged.

## Basis

`docs/program/public-v1/ARCHITECTURE.md` §11; program plan §3 (G22); quality bar R2; decisions 0015, 0074, 0083, 0084, 0088.
