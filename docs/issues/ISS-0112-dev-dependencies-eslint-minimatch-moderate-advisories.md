# ISS-0112 — `npm ci` and `npm audit` report three moderate advisories in the development dependencies (eslint → @eslint/config-array → minimatch)

Серьёзность: LOW. Статус: open. Найдено: TEST-RUNNER (шаг 06, issue I1), RELEASE-VALIDATOR (шаг 09, `self_check`, запуск GitHub), прогон `E2E106-20261115-01`, 2026-11-16; заведено DOC-UPDATER (шаг 10), 2026-11-16T01:08:10Z. Пункт планки: Q4 (одна команда проверки на чистой копии: `npm ci` её первый шаг), Q14 (найденное по пути не теряется). Требования: не этой работы — средства разработки `tools/` (`decisions/0002`); файлы пакетов этим прогоном не менялись. Решение: `docs/quality-bar.md`, раздел 6, п. 6; новые пакеты — только по `decisions/0107`.

## Что не так

On the GitHub runner `npm ci` in `tools/` prints `added 80 packages, and audited 81 packages` and `3 moderate severity vulnerabilities`, in both check.yml runs of the run (43778880910 at step 06, 43781322323 at step 09). A local `npm audit --json` in `tools/` gives the same (read again at step 10, 2026-11-16T01:07Z): moderate 3, high 0, critical 0 —

- `minimatch` 10.2.6 (indirect): the advisory «minimatch has potential denial of service via globparts amplification» (GHSA-g3hv-75wg-m249, CWE-405, the affected range `>=7.0.0 <11.0.1`);
- `@eslint/config-array` 0.23.5 (indirect) and `eslint` 10.11.0 (direct, `tools/package.json`), through `minimatch`.

`npm audit` names `eslint` 10.15.0 as the fix (not a major version). `tools/package.json` and `tools/package-lock.json` are unchanged by run `E2E106-20261115-01` (`git diff --quiet base/E2E106-20261115-01 -- tools/package.json tools/package-lock.json` → 0), so the advisories do not come from it, and the check does not fail on them. No file in `docs/issues/` named `minimatch` or `npm audit` before this one.

Why LOW: these are development tools (the linter), not code that Sai runs for the owner or a customer; the denial of service needs a hostile glob pattern given to the linter, and the patterns of `tools/` are Sai's own files. It is still a known advisory in the one check command of every machine.

## Доказательство

- `handoffs/E2E106-20261115-01/step-06-test-runner.json` — issue I1 (the line of `npm ci` on the runner; the local `npm audit --json`).
- `handoffs/E2E106-20261115-01/step-09-release-validator.json` — `self_check`, the GitHub run 43781322323 (`npm ci 'added 80 packages, and audited 81 packages in 2s', '3 moderate severity vulnerabilities'`).
- To see it, from `tools/`: `npm audit` (or `npm audit --json`), and `npm ls minimatch` shows `eslint@10.11.0` → `@eslint/config-array@0.23.5` → `minimatch@10.2.6`.

## Как исправить

A WF-03 run in the area of DEPENDENCY-AUDITOR: move `eslint` to a version whose `minimatch` is outside the affected range (`npm audit` names 10.15.0) through `tools/package.json` and a regenerated `tools/package-lock.json`, then the one check command here and on GitHub (`npm ci` without the advisory line, `npm run lint` with the same result); or, if the update is not wanted, a recorded decision that names the advisory and why it is accepted. Turning the audit off, hiding the line or skipping `npm ci` is not a fix (Q6). A version change of a package follows `decisions/0107` (no new package without the owner).

## Маршрут

WF-03 (DEPENDENCY-AUDITOR's area; BACKEND-DEV for the package files, REVIEWER and SECURITY-REVIEWER), or the next WF-05 audit; on ORCH's order.
