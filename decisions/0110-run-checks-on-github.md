# 0110 — The check of a run is run on GitHub from a temporary branch, and the result is pushed to `main`

Status: **accepted** (by the owner's word, 2026-11-08; ORCH recorded it; the owner can cancel it).

## Question

Where the full check of a work run (`cd tools && npm run check`, six steps) is run as evidence, and what happens to the result of the run. Until now the evidence of TEST-RUNNER (WF-02 step 6) and RELEASE-VALIDATOR (step 9) was a run on the developer machine; a run on GitHub from a temporary branch was allowed by `decisions/0107` only to learn whether the runner has Chrome.

## Options

1. Keep the local run as the evidence and use GitHub only after the push to `main` (as before).
2. Run the check of every run on GitHub before the push, from a snapshot commit on a temporary branch, and push the result to `main` after PASS of RELEASE-VALIDATOR.

## Decision

Option 2. The owner's words of 2026-11-08, verbatim: «1. Да, продолжи работу свою и документируй все результаты 2. Выполни тесты, тесты должны проходить, если не проходят то фикси ошибки 3. Все работы которые можно выполнить выполняй на гитхабе 4. Результат затем пуш сделай в гитхаб».

- The full check of a run is run on GitHub (`check.yml`, ubuntu-24.04) from a snapshot commit pushed to a temporary branch `ci/<run id in lower case>-<n>`. The snapshot is built as in `decisions/0107` and AP-141: through a temporary index, with only the files of the run, with no handoff whose status is not `COMPLETED` or `FAILED`, and without the owner's own uncommitted files. The branch is deleted after its run is read. `main` is not touched by it.
- The evidence of TEST-RUNNER (step 6) and RELEASE-VALIDATOR (step 9) includes the GitHub run: its number, the commit, the conclusion, the counts of tests and the record line of `npm run e2e`. The local run stays allowed: the agents build, debug and measure on the developer machine.
- A red test is fixed by the route of the workflow (TEST-FIXER, CODE-FIXER), never skipped and never weakened (Q6, AP-068).
- After PASS of RELEASE-VALIDATOR, RELEASE-FINALIZER pushes the run's files to `main` and waits for `check.yml` there (`decisions/0048`, `decisions/0079`); item 4 of the owner's words confirms the push.

## Why

The owner asked for it directly. The runner, not the developer machine, is where `main` turns red (ISS-0103: a timing fact of the Mac was not a fact of the runner), so a GitHub run before the push catches that class of failure before `main` sees it.

## Boundary

It does not change `check.yml`, the branch protection, or the rule that `main` gets only a run that passed RELEASE-VALIDATOR. No force-push. Temporary branches only under `ci/`. One GitHub run costs about 15 minutes of runner time; a run is started only on a snapshot whose local `handoffs-check` is green.

## Basis

The owner's words of 2026-11-08 (above, verbatim); `decisions/0048`, `decisions/0079`, `decisions/0107`; AP-141; `docs/issues/ISS-0103-e2e-kit-e2k18-stand-in-alive-on-github-main-red.md`.
