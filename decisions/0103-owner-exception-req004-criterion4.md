# 0103 — Owner exception: REQ-004 criterion 4 (run WF06-20260926-01 only)

Status: **accepted** (by the owner's word, 2026-10-28, in the session; recorded by ORCH). It is an exception for **one run**, not a general rule, and it lowers no item of the quality bar in force: the owner's written exception under quality bar §1 item 3 is exactly the way the bar allows a one-time exception.

## Question

AUD-001 (finding REQ-004-F1, defect ISS-0095): the output of the snapshot comparison after step 6 of run `WF06-20260926-01` required by criterion 4 of REQ-004 was not kept in the records, and the run has no RELEASE-VALIDATOR handoff; the output cannot be restored. REQ-004 was set to `in_progress` by the audit. What do we do?

## Options

- A. The owner accepts the missing evidence for this run only; REQ-004 returns to `done` with this record named in the comment (recommended).
- B. Leave REQ-004 `in_progress` with the true reason.

## Decision

The question put to the owner (session of 2026-10-28): «Две старые проверки аудита: выбор идеи (вывод проверки прогона 26.09 не сохранён, восстановить нельзя) и бизнес-план (прошёл с 6-й попытки при лимите 3, превышение разрешили сами агенты, запись 0010, а не вы). Записать ваше исключение?» His answer, quoted exactly: «Записать только для этих прогонов (Рекомендую)». Option A.

1. **Scope: exactly the run `WF06-20260926-01` and criterion 4 of REQ-004.** The missing output is not invented, re-created or back-dated; the records say that it does not exist.
2. **REQ-004 returns to `done`** by DOC-UPDATER with a comment that names this record and states honestly that criterion 4 for this run rests on the owner's exception and not on a kept output.
3. **Every later run** of the idea-selection workflow must keep that output; the criterion is unchanged.
4. **ISS-0095** is closed by DOC-UPDATER with the outcome "closed by the owner's exception (decisions/0103)", not as a fix.

## Why

The evidence cannot be restored; the behaviour was re-checked later (AUD-001 re-check by RELEASE-VALIDATOR); the owner prefers to record the gap honestly rather than leave the requirement open for a run of 2026-09-26.

## Boundary

Does not change the quality bar, the criterion text, or any other requirement; does not apply to any other run; does not allow a missing output in a next run. It does not touch `decisions/0010` or REQ-005 (see `decisions/0104`).

## Basis

The owner's words quoted above (2026-10-28); `docs/audits/AUD-001/report.json` (REQ-004-F1); `docs/issues/ISS-0095-*.md`; quality bar §1 item 3; the form of `decisions/0081`.
