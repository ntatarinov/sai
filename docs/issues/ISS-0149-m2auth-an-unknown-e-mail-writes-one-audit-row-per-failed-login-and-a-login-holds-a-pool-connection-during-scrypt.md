# ISS-0149 — Anonymous login attempts cost the server more than they should: one audit row per failed login for an unknown e-mail, and a pool connection held during scrypt

Серьёзность: LOW. Статус: open. Найдено: SECURITY-REVIEWER (шаг 03, F4) и RELEASE-VALIDATOR (шаг 09, проба; шаг 09b, пункты 9 и 10 списка); заведено DOC-UPDATER, 2026-11-24T03:58:48Z, под номером, названным ORCH в задаче шага 10. Пункт планки: Q10 (one request does not break the work of others).
Требования: REQ-114 (c5, c9 rate limits), REQ-115 (c10 audit chain); none of these points fails a criterion.

## Что не так

- **(a) Audit rows for unknown e-mails are bounded only by the per-address limit.** Each failed login of an e-mail that has no account writes one row to `audit_log`; the only bound is the per-address rate limit. RELEASE-VALIDATOR probe of step 9: 30 failures from 30 different addresses gave 30 rows. A caller with many addresses can grow the table and, because the chain is read in order, the cost of `GET /api/admin/audit/verify`.
- **(b) A login holds one of the 3 pool connections of an instance for the whole scrypt** (SECURITY-REVIEWER F4; `app/server/db/pg.js` pool max 3, scrypt inside the request transaction, design 4.9.5). Anonymous attempts from a few addresses can keep the pool busy, so other requests of that instance wait and answer 503 at the 4 s deadline. The design names the CPU bound (about 7 parallel logins) but not the pool bound. A residual of the accepted design shape.

## Доказательство

`handoffs/M2AUTH-20261123-01/step-09-release-validator.json` (probe of the audit rows: 30 failures from 30 addresses, 30 rows), `step-03-security-reviewer.json` (F4), `step-09b-release-validator.json` (list for DOC-UPDATER, items 9 and 10).

## Как исправить

1. (a) Write one audit row per window for an unknown e-mail (a counter in the row), or key those rows by the address and the hour, or cap them; keep the hash chain contiguous; add a test at 30 addresses.
2. (b) Name the pool bound in the design residuals, or compute the scrypt outside the transaction, or raise `max` for the function and measure it in the post-deploy record (the timing probe of the deploy step already runs real scrypt).

## Маршрут

WF-03, before the first invitation of anyone but the owner (M2.3); the severity is LOW because only the owner's admin account exists until then.
