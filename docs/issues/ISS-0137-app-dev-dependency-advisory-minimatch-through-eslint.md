# ISS-0137 — app/: a dev-only advisory (minimatch, GHSA-g3hv-75wg-m249) comes in through eslint 10.11.0

Серьёзность: MEDIUM. Статус: open. Найдено: AUD-002, SECURITY-AUDITOR (app), 2026-11-22 (находки SEC-APP-04 (Medium)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: Q7 and the dependency rule of WF-05 (a known vulnerability is High; set to Medium because the package is dev-only and unreachable from the internet).
Требования: REQ-108 criterion 1 (pins at least 14 days old, licences).

## Что не так

- `npm audit` reports the advisory through eslint 10.11.0 in the dev tree; `npm audit --omit=dev` reports 0 vulnerabilities, so production is not affected. The AUDIT-COMPILER may rescale it.

## Доказательство

docs/audits/AUD-002/app/security.json (SEC-APP-04).

## Как исправить

1. Update eslint (or its minimatch) to the first fixed version that is at least 14 days old (the pin rule of REQ-108 criterion 1), in app/package.json and the lock file; the CI check and the lint rows prove it. A dependency change goes through WF-03 and a ci/* snapshot.

## Маршрут

WF-03 (a small dependency change; RELEASE-VALIDATOR re-reads `npm audit` on GitHub).
