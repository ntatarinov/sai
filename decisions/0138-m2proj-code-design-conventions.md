# 0138 — ORCH's answers to the open questions of the M2.3 code design (REQ-116, REQ-117; run M2PROJ-20261124-01); the audit append of a tenant action

Status: **accepted** (ORCH, 2026-11-24, WF-02 step 1a, under the owner's delegation of technical decisions, decisions/0134; the owner can cancel each answer by a word).

## Question

CODE-DESIGNER wrote `docs/design/M2PROJ-invites-projects.md` (step 01 of the run M2PROJ-20261124-01) and listed ten open questions О1–О10 in `handoffs/M2PROJ-20261124-01/step-01-code-designer.json` (result.issues). It also settled О11 of decisions/0137 (C1).

## Decision

- **C1 (О11 of 0137), the audit append of a tenant action.** A tenant route that writes gets a «plan» stored beside its route row (`app/server/http/plan.js`). The pipeline runs the plan on the platform part of the one request transaction, appends the audit row the plan returns (organisation, actor and address taken from the session and the request, never from the plan), and only then switches to tenant settings and runs the handler under row-level security. One transaction, no way back from tenant to platform; the audit row, the project and the idea version commit together and roll back together. This is the rule for every later tenant route.
- **О1** The statements of projects live in `app/server/db/project-store.js` (the rule DBC-1 stays); `services/projects.js` orchestrates. REQ-117 criteria 3 and 9 name `services/projects.js` for the statements: a micro-amendment (REQ-ANALYST, then REQ-VALIDATOR, the form of decisions/0079 item 5) changes only the file names before step 2.
- **О2** Invite creation consumes the `owner_identity` re-auth purpose on every invite; a new purpose `user_delete` is added for account deletion.
- **О3** The owner types the name of a new client organisation on the invite; the admin invite names an existing organisation by the key `organisation` (`org_id` and `orgId` stay refused by the isolation suite).
- **О4** A minimal stage-transition table (20 of the 121 pairs); every other pair is refused with a stable code and unchanged state.
- **О5** Consent is accepted only in languages whose five sentences the served texts hold: kk is refused on production (G9).
- **О6** The audit page audits the card read only, not the board list.
- **О7** Stale unused invites are cleaned after 30 days; the e-mail is scrubbed from used invites on deletion.
- **О8** The platform admin's own deletion request is refused with 403.
- **О9** The client pages are functional forms on the existing styles. G21 (the owner's «похоже / не похоже») is asked on the screens of the UAT record before the deploy of M2.3, not before the push to `main` (decisions/0137 О6 stays: G21 comes with the client-facing pages).
- **О10** A small idea-edit form on the client project page is included.

## Basis

`handoffs/M2PROJ-20261124-01/step-01-code-designer.json` (result.issues); `docs/design/M2PROJ-invites-projects.md`; decisions/0100, 0127, 0134, 0135, 0136, 0137; REQ-116, REQ-117.

## Addition 1 — the design gate 1b (FAIL, P1-P3, N1-N7), 2026-11-24

CODE-DESIGN-VALIDATOR gave FAIL on three small edits of the design (`handoffs/M2PROJ-20261124-01/step-01b-code-design-validator.json`): P1 the replacement table (G2) misses RA-5 of `auth-reauth.test.js` (the two new re-auth purposes need their CASES); P2 the red-test list of sub-step B2 misses RLS-2, RLS-3 and the fixture rows of the two new tables; P3 step 9a of the pipeline (§4.4) must build the audit entry from the session first, take exactly `action`, `targetKind`, `targetId` and `details` from the plan, and throw a `TypeError` on any other key (test TP-5). The designer fixes them and the notes below, then a short pass 2:

- **N1** the lazy cleanup of stale invites runs from a platform route only; the RL-5 case goes through it.
- **N2, N3, N6, N7** fixed in the design (the M44 test names; the consent sentences are linted as the exception names them, also in the page tests; B5 and F4 are split into sub-steps that can be checked alone; the two wording slips).
- **N4** deleting an `org_owner` of an organisation that keeps other members can leave it without an owner: accepted for V1 (one membership per user; the platform admin invites every member) and recorded as a LOW defect for M3, not a requirement change.
- **N5** the purge setting stays settable by a statement run as the app role; the residual is named in the design and the post-deploy record; a SECURITY DEFINER purge function is a LOW defect for later.

## Addition 2 — the review gates of step 3 and 4, 2026-11-24

SECURITY-REVIEWER gave PASS (one medium, three low) and REVIEWER gave PASS (five low) on the code at e656e6c. ORCH has these fixed before the tests are written (rework 02b of BACKEND-DEV):

- **SEC F1 (medium)** `deleteAccount` removes every unused invite for the deleted account's e-mail (by `email_norm`), not only the ones it used, and the acceptance of an invite deletes the e-mail's other unused invites after the claim: no address stays in clear after a deletion and no old invite can create the account again. This is fixed before the G7 gate is ever flipped to «б».
- **SEC F2 (low)** N13 returns a mark («the platform») instead of the platform admin's user id and name as an author.
- **SEC F4 (low)** the purge refuses an organisation of kind `owner` (a guard in the store, with its test).
- **SEC F3 (low)** N5 lists names and e-mails to the admin with no audit row, as decisions/0138 О6 chose (only the card read is audited); recorded as a LOW defect, not changed now.
- **REVIEWER F1-F5 (low)** `keysOf` copied three times and the role list twice (the gate constant sits in `services/orgs.js`); the design text `planCreate(ctx, req)`; the `site.css` form rules beyond the design's list (the forms look slightly different from login and setup: covered by G21 at the UAT screens); the duplicate and unordered imports; helpers with no product caller (interface for the tests): recorded as LOW defects, not changed now.
