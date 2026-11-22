# ISS-0135 — app/ database layer: a long migration is killed by the 12 s guard, a broken connection is reported as db «ok», the production connection string need not require TLS, and the design shows another self-check SQL than the code

Серьёзность: MEDIUM. Статус: open. Найдено: AUD-002, ARCHITECTURE-AUDITOR (app), SECURITY-AUDITOR (app), 2026-11-22 (находки ARCH-APP-01, ARCH-APP-02, ARCH-APP-04, SEC-APP-02 (Low), SEC-APP-03 (Low)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: Q10 (every failure handled), Q12 (design and code agree).
Требования: REQ-108, REQ-109 (done); docs/design/REQ-108-109-app-skeleton.md; decision 0116.

## Что не так

- ARCH-APP-01: the 12 s guard in app/server/db/migrate.js (lines 149-152, cleared only at line 189) also covers the migration itself; a migration longer than about 12 s is killed with «no answer from the database»; Docker (migrate before start) would crash-loop on it.
- ARCH-APP-02: `toDbError` (app/server/db/index.js line 48) treats any 5-character upper-case code as an SQLSTATE, so the Node codes EPIPE and EBUSY become E_DB_QUERY and /api/health says `db: "ok"` for a broken connection (the regex was run under Node 22).
- ARCH-APP-04: the design (line 384) gives a different SELFCHECK_SQL than the code (the code folds role memberships); no document mentions the change.
- SEC-APP-03 (Low): the code does not require `sslmode` in the production DATABASE_URL. SEC-APP-02 (Low): /api/health runs one database statement per call, with `no-store` and no rate limit.

## Доказательство

docs/audits/AUD-002/app/architecture.json (ARCH-APP-01, -02, -04), docs/audits/AUD-002/app/security.json (SEC-APP-02, -03).

## Как исправить

1. migrate.js: start the guard after the connection and the lock, and give the statement of a migration its own longer limit (the value is a constant with a test); toDbError: classify by the shape the `pg` driver gives (a `severity` field or a 5-character code that is a valid class) and map Node system codes to the connection-lost error; the selfcheck design section is updated by DOC-UPDATER; a production DATABASE_URL without `sslmode=require` makes the boot report a configuration warning (not an error, the local Docker database has no TLS); the health statement stays one per call (the Vercel function limit is the cap), say so in the design.
2. Tests: a migration that takes 15 s on a fake clock is not killed; EPIPE is a connection error and /api/health answers db «down»; the TLS warning for a production URL.

## Маршрут

WF-03 (the app has its own checks on GitHub; the fix goes through a ci/* snapshot).
