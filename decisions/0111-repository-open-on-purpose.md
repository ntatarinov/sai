# 0111 — The Sai repository on GitHub is open on purpose (again)

Status: **accepted** (by the owner's word, 2026-11-15; ORCH recorded it; the owner can cancel it). Replaces the part of `0062` about a closed repository.

## Question

`0062` (2026-10-17) recorded that the owner closed the repository on purpose. A reading of GitHub on 2026-11-15 by RELEASE-VALIDATOR (`handoffs/E2E105-20261105-01/step-09-release-validator.json`, issue I1) and again by ORCH showed the repository open: `gh repo view ntatarinov/sai --json visibility` → `PUBLIC` (`updatedAt` 2026-11-05T19:16:51Z). Who changed it and when was not written in the Sai files. A push to `main` of an open repository shows the run's files to everyone, so ORCH asked the owner before step 11 of the run `E2E105-20261105-01`.

## Options

1. The repository is open on purpose: record it and push.
2. It was not meant: the owner closes it in the settings of GitHub, then the push.
3. Do not push yet.

## Decision

Option 1. ORCH's question of 2026-11-15, verbatim: «Репозиторий Sai на GitHub (ntatarinov/sai) сейчас ОТКРЫТ всем. 17 октября вы решили, что он закрытый (decisions/0062). По GitHub видимость менялась около 5 ноября. Тесты REQ-105 прошли все проверки, остался пуш в main, и в открытом репозитории его увидят все. Вы открыли репозиторий сами, специально?» The owner's answer of 2026-11-15, verbatim: «Да, открыл специально».

- The repository is open on purpose. The part of `0062` about a closed repository does not apply; the rest of `0062` and `0048` (the release order: the push to `main` after PASS of RELEASE-VALIDATOR; no force-push, tags, other branches, invitations or paid settings; ORCH does not change the visibility or the settings of GitHub) stays in force.
- Statements about the visibility in documents are made only after a reading of GitHub with its date (AP-102).
- Since the repository is open, the rules that keep machine paths, temporary paths and the names of the owner's other projects out of the Sai files (`npm run traces`, `decisions/0082`) protect what everyone can read; they are not loosened.

## Why

The owner answered the question directly.

## Boundary

It does not change `check.yml`, the branch protection, the release order, or any setting of GitHub. It says nothing about the owner's other repositories.

## Basis

The owner's answer of 2026-11-15 (above, verbatim); `decisions/0048`, `decisions/0062`; `docs/anti-patterns.md` (AP-102); `handoffs/E2E105-20261105-01/step-09-release-validator.json` (issue I1).
