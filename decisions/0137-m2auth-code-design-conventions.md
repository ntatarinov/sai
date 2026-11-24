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

## Addition — ORCH's answers to the design gate 1b (FAIL, B1-B7, N1-N6), 2026-11-23

CODE-DESIGN-VALIDATOR gave FAIL (`handoffs/M2AUTH-20261123-01/step-01b-code-design-validator.json`). B1-B6 are fixed by the designer as the validator asks. The places where the developer would have to choose (B7) and the security remarks (N2) are answered here:

- **B7a** A login of a disabled or deleted account answers exactly as a wrong password (the same code, body and timing path: scrypt runs against a fixed dummy hash), and changes no counter of that account.
- **B7b** `AUTH_CODES` includes `body_too_large` (413) and `site_closed` (503), and every code a route of M2.2 can answer.
- **B7c** A right password followed by a missing or wrong TOTP code counts as a failed attempt for the admin delay.
- **N2a** scrypt at the OWASP minimum: N = 2^17, r = 8, p = 1 (memory limit set to fit); the measured time on this PC and the Vercel function memory are recorded in the design.
- **N2b** ASVS 2.1.7: a new or changed password is refused when it is in a bundled list of common passwords (a data file in the repository, no network call; its source and licence named in the design); the check is a named criterion of the tests, not of the requirement text.
- **N2c** Lockout and enumeration: the answers for an unknown e-mail and for a locked account are the same as for a wrong password until the lock, and the lock answer is the same for an unknown e-mail (a counter keyed by the e-mail HMAC). That the growing delay names the admin's address is a residual risk accepted by ORCH (REQ-114 c5 and decisions/0137 О8 keep the delay for the admin only; the admin address is the owner's own).
- **N1, N3-N6** fixed in the design: N1 count rows without the namespace trap; N3 TRUNCATE on `audit_log` refused (revoke plus a trigger); N4 named as is (admin routes answer 503 while the database is down); N5 the runbook creates the roles of 0001 before a restore onto another server; N6 named.

## Addition 2 — the design rework 01c, О15 and О16, 2026-11-23

- **О15** REQ-114 criterion 1 names scrypt N = 2^15 and the form `scrypt$15$8$1$`; the Addition above sets N = 2^17. REQ-114 is amended by a micro-amendment (N = 2^17, `scrypt$17$8$1$`, the memory limit 160 MiB measured by the designer) before step 2; the meaning of the criterion (one fixed, recorded parameter set at or above the OWASP minimum) does not change.
- **О16** The common-password tests (PW-4, SU-5, RS-2) count under REQ-114 criterion 1 (the password rule), not as a criterion of their own.
- **N2b, form of the list (gate of the scrypt amendment, B-1)** The common-password list is data in a JavaScript module `app/server/auth/common-passwords.js` (a frozen set of strings, generated once from the named source, with the source and licence in its header comment), not a `.txt` file: the import-boundary rule of `app/test/unit/import-boundaries.test.js` refuses non-`.js` files under `server/`, and that guard stays unchanged.

## Addition 3 — divergences reported at step 2, 2026-11-24

- **I1** The closed label list of the pepper-derived keys (design 4.9.1) gets the label `acct` that 4.9.5 uses; accepted as written by BACKEND-DEV in `keys.js`.
- **I2** `AUTH_CODES` has 23 codes (design 4.8 rules over the count of 5.3); every code has a text key (FRONTEND-DEV wrote all 23).
- **Pages and the kk region** Each new page carries exactly one `sai:kk` region around its kk button, as the five existing pages do; the guard edit A6 of the design («no region») is read as «no kk outside the one region», and TEST-DESIGNER writes it so at step 5. The setup page's language select offers ru and en only (kk stays hidden, G9).
- **Turning TOTP off takes two codes** (the re-auth consumes one step) — accepted as designed; the page says so.

## Addition 4 — the review gates of step 3 and 4, 2026-11-24

SECURITY-REVIEWER gave PASS with five non-blocking findings and REVIEWER gave FAIL on one blocking finding (`handoffs/M2AUTH-20261123-01/step-03-security-reviewer.json`, `step-04-reviewer.json`). ORCH has them all fixed now, in one rework of BACKEND-DEV, before the tests are written:

- **REVIEWER F1** `.github/workflows/app.yml`, the step «Every table of B has a row»: the `do` block is quoted `$do$ … $do$`, one `psql -c` with `ON_ERROR_STOP`.
- **SEC F1** `appendAudit` refuses (a thrown program error, no write) unless `current_setting('app.role', true) = 'platform'`, before it takes the chain lock; a tenant caller of REQ-117 therefore audits before `switchToTenant` (the REQ-117 design names it).
- **SEC F2** an IPv6 client is keyed by its /64 prefix for the rate limits and the admin delay (IPv4 by the whole address).
- **SEC F3** `app/scripts/uat-login.js` opens the secret file with `O_NOFOLLOW`, checks the descriptor with `fstat` and reads from that descriptor.
- **SEC F5** a password change deletes the user's unused reset codes in the same transaction.
- **SEC F4** (the pool of three connections held through scrypt) is a named residual: the design and the post-deploy steps name the bound; it is measured after the deploy.
- The REVIEWER lows F2-F6 are accepted as they are (F5 and F6 were already decided in Addition 3).
- **I1 of rework 02b** `app/server/db/audit-store.js` gains `currentAppRole(q)` (the statement the SEC F1 check needs lives under `app/server/db/`, design 4.5.4); accepted.

## Addition 5 — a defect found by the tests of step 5, 2026-11-24

TEST-DESIGNER (lane auth) found with the new test ADD-4 that `app/server/db/pg.js` `transaction()` attaches no `error` listener to the client it checks out of the pool, so a connection that drops in the middle of a request emits an unhandled `error` and ends the process (REQ-114 c10, Q10). Fixed now by BACKEND-DEV (rework 02c): a listener on the checked-out client for the whole time it is held, which marks the transaction failed (answered 503 by the existing path) and releases the client as broken; then a narrow pass of SECURITY-REVIEWER and REVIEWER over that change.

## Addition 6 — the acceptance of step 8, 2026-11-24

UAT-RUNNER (`docs/uat/M2AUTH-20261123-01.md`) found every flow working and one major look defect F-1: at 390 px the TOTP enrolment note and the `otpauth://` address are cut at the right edge (hidden by the page's `overflow-x` clipping). Fixed now by FRONTEND-DEV (rework 02d): the note and the address wrap (`overflow-wrap: anywhere` on exactly those elements; `app/public/css/site.css` joins the write set for that one rule); and the prompt «enter the code» after a right password is shown as a prompt, not under the error label. Then a narrow REVIEWER pass and a UAT re-check at 390 and 320 in ru and en.
