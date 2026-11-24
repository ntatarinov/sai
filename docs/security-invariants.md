# Security invariants of the app

The invariants of accounts and tenancy that a change must keep (REQ-115 criterion 11; the audit
docs/audits/SAI-ARCHITECTURE-AUDIT.md, chapter 10, stage 2; the code design
`docs/design/M2AUTH-accounts-tenancy-backup.md`, 4.14; rows 14-19: `docs/design/M2PROJ-invites-projects.md`, 4.10). Each row names the test file and the test
that proves it: that pair is the row's check command (the CI jobs of `.github/workflows/app.yml` run the file; the name is the test).

| # | Invariant | Test file | Test name |
| --- | --- | --- | --- |
| 1 | A foreign object answers exactly like a missing one (uniform 404) | app/test/int/isolation.test.js | IS-1 |
| 2 | Row-level security is enabled and forced on every table with org_id | app/test/pg/rls.test.js | RLS-1 |
| 3 | The organisation never comes from the request (body, query or header) | app/test/int/isolation.test.js | IS-4 |
| 4 | The runtime role is no superuser, does not bypass row security and owns no table | app/test/int/selfcheck.test.js | SC-7 |
| 5 | Every state-changing session request needs Origin, JSON and the CSRF token | app/test/int/auth-csrf.test.js | CS-1 |
| 6 | The session cookie is `__Host-`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain | app/test/int/auth-session.test.js | SS-1 |
| 7 | Ordinary accounts lock after 5 failures; the platform admin gets the delay, never the lock | app/test/int/auth-lockout.test.js | LO-1 |
| 8 | The audit log is append-only and its hash chain shows any later change | app/test/pg/audit-chain.test.js | AC-2 |
| 9 | No SQL text is built from strings | app/test/unit/no-string-sql.test.js | SQL-1 |
| 10 | No secret or personal data in the logs | app/test/int/logging.test.js | LG-2 |
| 11 | Admin routes answer the uniform 404 to everyone but the platform admin | app/test/unit/route-table.test.js | RT-3 |
| 12 | Database calls stand only under app/server/db/ | app/test/unit/db-calls.test.js | DBC-1 |
| 13 | The app roles have exactly the least grants of the code design | app/test/pg/rls.test.js | RLS-5 |
| 14 | The audit row of a tenant action is written before the switch to tenant settings and commits with the action | app/test/int/tenant-plan.test.js | TP-1 |
| 15 | An invite is spent once: two accepts of one code give one account | app/test/int/invites.test.js | INV-6 |
| 16 | The idea versions are insert-only; only the purge helper deletes them | app/test/pg/rls.test.js | RLS-6 |
| 17 | The consent record holds the digest of the exact sentence shown | app/test/int/invites.test.js | INV-11 |
| 18 | A member of the owner organisation is an owner identity, on both sides of the rule | app/test/pg/owner-org.test.js | OO-1 |
| 19 | The admin read of a project is audited once per call | app/test/int/admin-board.test.js | BRD-3 |
