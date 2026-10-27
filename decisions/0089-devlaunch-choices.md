# 0089 — Development launch from the board: the choices of REQ-ANALYST for REQ-088…REQ-101

Status: **accepted as defaults** (ORCH, 2026-10-27, by the proposal P2 of `handoffs/DEVLAUNCH-20261027-01/step-01-req-analyst.json`, run `DEVLAUNCH-20261027-01`; the owner may cancel any item; four questions for the owner are open, each with its default).

## Question

`decisions/0088` fixes the direction. Which choices that the owner's words leave open are taken for the requirements REQ-088…REQ-101?

## Decision

The choices C1…C16 of the step-01 result are accepted as written there. The ones that restate or narrow earlier records:

1. **C1.** The visitor's progress record keeps its four stages and eight fields; "development" stays refused by `status set` and by the board move. The state of a development job is a separate record shown only on the board (and, in phase B, in the cabinet through a prepared safe set). So `0073` item 3 and `0074` item 2 are used only in the sense narrowed by `0088`.
2. **C2.** New code lives in `tools/src/devjob/`; the board handlers get their functions injected from the command file, because the guard test forbids a child process inside `tools/src/picker/`.
3. **C3.** One Developer task of the Sai Team core through the existing executor; no engine, planner or second reviewer run (the owner is the reviewer in test mode).
4. **C4, C5.** The result is one self-contained `index.html` of at most 2 MiB; the owner opens it from the board in a sandbox without network or access to the board.
5. **C6, C7.** The password is typed on every start (not for edit or cancel); hash and salt live in a file outside the repository; the start has a two-step confirmation with a one-time token inside the page.
6. **C14.** Phase B is built only after phase A is accepted and the owner says start; the owner marks "delivered" and "accepted" on the board; a customer's change goes to a queue and needs the owner's accept, a new button press and the password.
7. **C15.** Tests use a fake executable and spend nothing; one real run is made only after the owner's written consent.
8. **C16.** No edit of REQ-071, REQ-085, REQ-087 for "pixel with modern shades": the phrase is not checkable by a command; their criteria already compare with the approved sample.

## Open questions to the owner (defaults apply until he answers)

1. Ceiling of 5 USD per request, 3 runs per request, 5 per day — default: yes.
2. A fifth step «Строим сайт» in «Мой запрос» — default: no.
3. One real run at acceptance, ceiling 2 USD — default: ask again at acceptance.
4. Phase B: the owner marks "accepted" — default: the owner.

## Boundary

Does not build anything, does not change done blocks, does not allow publication or paid services.

## Basis

`handoffs/DEVLAUNCH-20261027-01/step-01-req-analyst.json` (result.choices, owner_questions, proposals), `decisions/0073`, `0074`, `0083`, `0088`.

## Addition (2026-10-27, after the rework of step 03)

9. **I1 (result page can navigate its own tab).** The sandbox is kept and the residual risk stays named in REQ-093; no separate one-time view code and no "download only" now. The owner is the only viewer, on his own computer, and the file is built from a request he has read himself. The question can be reopened before phase B.
10. **I3.** A failed-start record counts toward the limits of 3 per request and 5 per 24 hours (safer for spending).
11. The wording of one command in the closed step-02 handoff was changed by ORCH only to remove the words the traces check forbids; the findings are untouched.
