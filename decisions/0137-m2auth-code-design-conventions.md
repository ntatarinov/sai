# 0137 — ORCH's answers to the open questions of the M2.2 code design (REQ-114, REQ-115, REQ-120; run M2AUTH-20261123-01)

Status: **accepted** (ORCH, 2026-11-23, WF-02 step 1a, under the owner's delegation of technical decisions, decisions/0134; the owner can cancel each answer by a word).

## Question

CODE-DESIGNER wrote `docs/design/M2AUTH-accounts-tenancy-backup.md` (step 01 of the run M2AUTH-20261123-01) and listed fourteen open questions О1–О14 in `handoffs/M2AUTH-20261123-01/step-01-code-designer.json` (result.issues).

## Decision

Every recommended answer is taken.

- **О1** A new `app/db/grants.sql` holds every GRANT of the app roles; `migrate.js` applies it after the migration files on every run (idempotent), so a copy restored from `pg_dump --no-acl` gets its grants back by the same migrate step (test MG-6). The two file lists of REQ-115 and REQ-120 get the file by a micro-amendment of this run (REQ-ANALYST, then REQ-VALIDATOR) before the design gate. Changing the dump flags was rejected: the dump of a production database should not carry the roles of the source.
- **О2** No zod: an own strict body validator `app/server/http/schema.js` (no new dependency, ARCH §1.1); ARCH §3 diverges by a row of «Plan amendments».
- **О3** The tables `password_resets` and `login_delays` beyond ARCH §4, the columns of `users` of design 4.2.1, and `auth_sessions` without `idle_expires_at` (idle read from `last_seen_at`); a row of «Plan amendments».
- **О4** `app/scripts/uat-login.js` refuses on Windows (fail closed) rather than skipping its mode check.
- **О5** The pages are served by their `.html` names (`/setup.html`, `/login.html`, `/reset.html`, `/admin-totp.html`); `vercel.json` unchanged.
- **О6** The four pages are functional forms on the existing styles: no WF-04 look description and no G21 now; G21 comes with the client-facing pages of REQ-116 and REQ-117.
- **О7** On Vercel the client address comes from `x-forwarded-for` only when it is exactly one IP literal; otherwise the shared bucket `unknown`; probed after the deploy (design §14).
- **О8** The growing delay applies only when the target account is the platform admin (REQ-114 c5).
- **О9** Whether the Neon owner role has BYPASSRLS is checked in spike S3 before the first dump; the runbook names the refusal when it lacks it.
- **О10** The use of a reset link is limited to 10 per 15 minutes per address.
- **О11** How the audit rows of tenant actions commit with the action (a tenant transaction cannot read the previous hash) is a question for the REQ-117 design, named there.
- **О12** A wrong current password on a password change counts as a re-auth failure.
- **О13** Re-auth tokens are issued to ordinary users too.
- **О14** The rehearsal job binds ports 5433 and 18080 on the GitHub runner only.

## Basis

`handoffs/M2AUTH-20261123-01/step-01-code-designer.json` (result.issues); `docs/design/M2AUTH-accounts-tenancy-backup.md`; decisions/0134, 0135, 0136; ARCHITECTURE §1.1, §3, §4, §14, §20.4.
