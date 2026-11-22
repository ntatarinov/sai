# ISS-0134 — The traces check does not see Windows paths, so paths of the owner's PC with his user name went into 26 handoffs and came back twice after the clean-up

Серьёзность: MEDIUM. Статус: open. Найдено: AUD-002, SECURITY-AUDITOR (records), AUDIT-SCOUT (I4), 2026-11-22 (находки SEC-REC-02 (Medium), SEC-REC-01 (Medium)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: Q7 (names and paths of a private computer in a public repository), REQ-014.
Требования: REQ-014 (the traces check; its text names macOS and Linux only: a micro-amendment of WF-01 comes first).

## Что не так

- `hasHomePath` in tools/src/traces/rules.js looks for `/Users/` and `/home/` only. A Windows path (`C:\Users\<name>\…`, also JSON-escaped as `C:\\Users\\<name>\\…`, and the Git Bash form `/c/Users/<name>/…`) is never seen. `npm run traces` printed 0 on 26 handoffs that carried the user name of the owner's PC; the pre-push hook would pass them. ORCH replaced them in commit 6cb68b1 and again before the push of 2026-11-22 (the rule and the agents' habit were not fixed). No open defect covered it; AP-050, AP-052, AP-062 and AP-069 are the earlier repeats of the same lesson.
- SEC-REC-01: 8 to 9 handoffs carried the name again at the time of the audit (this audit's own handoffs and the REQ-113 wording round); none was on an origin ref.

## Доказательство

docs/audits/AUD-002/records/security.json (SEC-REC-01, SEC-REC-02); the scout's issue I4 in handoffs/AUD-002-20261122-01/step-01-audit-scout.json.

## Как исправить

1. WF-01 micro-amendment of REQ-014 (the traces check also finds Windows home paths: a drive letter with `Users` and a name, in the plain, the JSON-escaped and the Git Bash forms, and the Windows temporary folder roots `AppData\Local\Temp`), then the rule in tools/src/traces/rules.js with tests (a path that names a user is found; a placeholder like `<home>` and a path inside the project folder are not; bounded time on long lines), and the same rule in the handoffs check H10 (home path in a handoff).
2. Put into docs/anti-patterns.md one entry: the launch message gives the real paths, handoffs and records carry placeholders; and the generator of ORCH's handoffs writes placeholders only (done for the audit handoffs).

## Маршрут

WF-01 micro-amendment (REQ-VALIDATOR gate), then WF-03 for the code and the tests.
