# 0135 — ORCH's answers to the open questions of the M2 lane A requirements (REQ-114 … REQ-117, run M2ACCT-20261123-01)

Status: **accepted** (ORCH, 2026-11-23, under the owner's delegation of technical decisions, decisions/0134; the owner can cancel each answer by a word). Questions that are the owner's (G7, the consent wording) are named as his and not answered here.

## Question

REQ-ANALYST wrote REQ-114 (R2.1 accounts), REQ-115 (R2.3 tenancy), REQ-116 (R2.2 organisations and invitations) and REQ-117 (R2.4 projects) at step 01 lane-a of the run M2ACCT-20261123-01 and listed sixteen open questions О1–О16 and notes I17–I21 in `handoffs/M2ACCT-20261123-01/step-01-req-analyst-lane-a.json` (result.issues). The blocks are written on the recommended answers.

## Decision

Every recommended answer is taken; the notes below are ORCH's additions.

- **О1** The worker container changes nothing in lane A.
- **О2** The UAT identity is a secret file outside the repository named by `SAI_UAT_IDENTITY_FILE`, read in-process by `app/scripts/uat-login.js` (refuses a path inside the repository, a symbolic link, a missing file and, on POSIX, a mode readable by others); the same on Windows and macOS. The setup token is printed once and stored nowhere.
- **О3** While G7 is «а» a non-owner person can do nothing (no non-owner invite can be created; the owner accepts his own invites at once). **Addition:** the first real client needs G7 «б» (the owner's gate), and «б» needs the released consent sentence and the legal pages marked «черновик». The legal draft pages become their own small requirement right after M2 (before M3 is released), not at the end of M7; a row of «Plan amendments» records the move.
- **О4** The state of G7 is one constant in the source, changed only by a release through the gates after the owner's «б».
- **О5** The single audit writer, the hash chain, the advisory lock and `GET /api/admin/audit/verify` belong to REQ-115 (M2.2); the audit page and `GET /api/admin/audit` to REQ-117 (M2.3).
- **О6** REQ-115 proves the isolation suite on a planted pair of test-only routes; REQ-117 requires the real count of tenant routes (at least 2).
- **О7** The byte equality of AC2.1 excludes `Date` and `X-Request-Id` (REQ-108 criterion 10 gives every answer its own id); a row of «Plan amendments».
- **О8** The four roles on the M2 routes as recommended: `org_owner`, `org_admin` and `member` create projects and edit ideas of their own organisation; `viewer` reads only; `org_owner` alone approves a ТЗ and requests development when M3 and M4 add those routes; every invite of V1 is the platform admin's; an invite into a new client organisation gives `org_owner`.
- **О9** TOTP recovery: ten one-time recovery codes shown once at enrolment, stored as HMAC.
- **О10** The demo carry-over stays out of REQ-117; it comes with the first public-look release after G7 «б» (it changes released public texts and needs G21).
- **О11** Backup and its rehearsal get their own requirement, written in this run by the lane B step, and built before the first deploy of migration 0002.
- **О12** The deletion of an account as recommended (fixed placeholders, sessions and membership removed; an organisation without members loses its projects through one purge helper; audit rows keep ids only).
- **О13** (1) The consent wording stays a draft until the owner approves it (decisions/0100 item 6) before G7 «б»: it is the owner's, with his lawyer. (2) The conflict with the public word lists: one named exception for the consent keys only, by a micro-amendment of REQ-111 criterion 3 in this WF-01 run (the lane B step writes it), because the deletion term is a legal duty, not a product promise.
- **О14** DOC-UPDATER sets the rescoped old blocks after the REQ-VALIDATOR PASS of this run, by result.rescoped, each with a pointer; REQ-101 is narrowed, not cancelled.
- **О15** One membership per user in V1.
- **О16** The test names of the blocks are used (`rls.test.js` with the completeness check, `isolation.test.js` with the uniform 404); the existing files of REQ-108 get new cases.
- **I17** Migrations: `0002_identity.sql` (M2.2), `0003_projects.sql` (M2.3), `0004_jobs.sql` (lane B, M2.4); recorded in PROGRESS.md.
- **I18** Before the M2 deploy the owner sets `SECRET_PEPPER` and `SETUP_TOKEN_HASH` in Vercel; ORCH asks for it at that moment with exact steps (a deploy is the owner's, decisions/0134 item 2).
- **I19** STATE.md counts are updated by DOC-UPDATER at the end of this run.

## Why

The recommended answers keep the scope to the path of the first invited client (decisions/0133), close the two real conflicts (О7, О13) without weakening a check, and move the two things the client path needs earlier (the legal draft pages, the backup).

## Basis

`handoffs/M2ACCT-20261123-01/step-01-req-analyst-lane-a.json` (result.issues); decisions/0100, 0127, 0133, 0134; PLAN §3 G7, §4.2, §4.7, §5 M2; ARCHITECTURE §5, §14, §20.4.
