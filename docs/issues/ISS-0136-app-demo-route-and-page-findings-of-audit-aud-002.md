# ISS-0136 — app/ demo route and page: POST /api/demo/result checks neither Content-Type nor Origin, the date helper astanaDate has no test, dead code and repeated constants

Серьёзность: MEDIUM. Статус: open. Найдено: AUD-002, COVERAGE-AUDITOR (app), SECURITY-AUDITOR (app), ARCHITECTURE-AUDITOR (app), 2026-11-22 (находки COV-APP-01 (Medium), SEC-APP-01 (Low), ARCH-APP-05 (Low), ARCH-APP-06 (Low), ARCH-APP-03 (Low)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: Q5/Q6 (a test for each part), Q10.
Требования: REQ-111 (the demo), REQ-108; REQ-113 criterion 13 names the two test files this round may touch.

## Что не так

- COV-APP-01 (Medium): `astanaDate` (the demo receipt date, a fixed UTC+5 shift) in app/public/js/pages/demo.js has no test; the comment at line 1313 says a test imports it, and no test under app/test mentions it or imports demo.js.
- SEC-APP-01 (Low): POST /api/demo/result checks neither Content-Type nor Origin; no impact today (the route stores nothing and sets no cookie).
- ARCH-APP-05/06 (Low): dead code (`withPlatform` in server/db/tx.js has no caller or test; `readText` and the error codes `bad_request` and `bad_encoding` have no runtime caller); the 4000 ms deadline stands in four places, the language list is repeated in routes/demo.js, the 503 `server_config` body is built by hand in api/index.js.
- ARCH-APP-03 (Low): `mountSurvey` in demo.js is one function of 886 lines (the next is 44); WF-05 has no size row.

## Доказательство

docs/audits/AUD-002/app/coverage.json (COV-APP-01), docs/audits/AUD-002/app/security.json (SEC-APP-01), docs/audits/AUD-002/app/architecture.json (ARCH-APP-03, -05, -06).

## Как исправить

1. After REQ-113 is released (it edits demo.js and the two test files): a unit test of `astanaDate` (export the helper from a module the test can import; the cases: the UTC date line, 19:00 UTC and 18:59 UTC, a leap day); the POST route requires `Content-Type: application/json` (415) and the same-origin check of the other routes; remove the dead code or give it a caller and a test; one constant for the deadline and the language list; the split of `mountSurvey` into named functions is a refactor with the whole e2e suite as the guard and is done last.

## Маршрут

WF-03 after REQ-113 is released.
