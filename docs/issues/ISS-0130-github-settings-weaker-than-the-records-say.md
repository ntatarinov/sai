# ISS-0130 — The GitHub settings of the public repository are weaker than the records say: branch protection of main is off, secret scanning and push protection are off, check.yml floats Node 22

Серьёзность: HIGH. Статус: closed, 2026-11-22, по слову владельца («решай сам», решение 0132) ORCH включил защиту, проверку секретов и обновления безопасности. Найдено: AUD-002, SECURITY-AUDITOR (ci, docs, records), 2026-11-22 (находки SEC-CI-01 (High), SEC-CI-02, SEC-CI-03, SEC-DOCS-03, SEC-REC-05 (Low)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: Q7 (secrets), R1 (the owner approves a merge; decision 0048).
Требования: none (a repository setting); decisions/0048, 0110, 0111; ISS-0052 (open, Actions hardening) is the neighbour and does not cover the loss of the protection.

## Что не так

- `gh api repos/<owner>/<repo>/branches/main` returns `protected: false`, and `/protection` answers 404 «Branch not protected»; no rulesets exist. Decision 0048 and ISS-0052 record the protection as switched on on 2026-10-13, and decisions 0110 and 0111 rely on it. The token has admin rights, so this is a setting and not a rights error (ORCH re-checked it on 2026-11-22).
- Secret scanning, push protection and Dependabot security updates are disabled on the repository, which has been public since 2026-11-15 (SEC-CI-02, SEC-DOCS-03, SEC-REC-05).
- `.github/workflows/check.yml` takes `check-latest: true` for Node 22 (added after `e0a425b`) while `app.yml` pins 22.23.4 (SEC-CI-03, Low).

## Доказательство

docs/audits/AUD-002/ci/security.json (SEC-CI-01..03), docs/audits/AUD-002/docs/security.json (SEC-DOCS-03), docs/audits/AUD-002/records/security.json (SEC-REC-05); the gh calls are quoted there.

## Как исправить

1. THE OWNER'S WORD IS NEEDED (a change of the GitHub settings is his, R1, decision 0048): ask him whether the protection of `main` was removed on purpose; if not, switch it on again with the rules of decision 0048 (the checks `check` and `app` required, no force-push, no deletion) and switch on secret scanning, push protection and Dependabot security updates. ORCH proposes the exact `gh api` calls and runs them only after his «да».
2. check.yml: pin the Node version the way app.yml does (a code change, WF-03, together with ISS-0052).

## Маршрут

Owner decision first (a question in the report); the workflow-file edit goes by WF-03 with ISS-0052.

## Закрыто

2026-11-22T22:43:56Z: on the owner's delegation (decisions/0132) ORCH switched on, after the release of REQ-113: (1) the protection of `main` with the rules of ISS-0052 and decision 0048: the check `check` is required, force-push and deletion of the branch are forbidden, `enforce_admins` is off (the administrator can push directly, R1 unchanged), no pull request is required (read back with `gh api repos/<owner>/<repo>/branches/main/protection`: required check `check`, force false, delete false, enforce_admins false); (2) secret scanning, push protection and Dependabot security updates (read back: all three `enabled`; Dependabot opened its first pull request within minutes, #1 «Bump minimatch and eslint in /tools», which is left open, see ISS-0137). SEC-CI-03 (check.yml floats Node 22) is not a defect: `check-latest: true` is the rule of decision 0120 and criterion 8 of REQ-110 (the CI runs the newest 22.x so that a security release is taken at once; CI-3 pins it), while app.yml pins 22.23.4 by REQ-108.
