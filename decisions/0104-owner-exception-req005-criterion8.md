# 0104 — Owner exception: REQ-005 criterion 8 (run BP-20261003-01 only)

Status: **accepted** (by the owner's word, 2026-10-28, in the session; recorded by ORCH). One run only; the quality bar §1 item 3 way of a one-time written exception.

## Question

AUD-001 (finding REQ-005-F1, defect ISS-0096): step 3 of run `BP-20261003-01` passed the plan gate only on the 6th run (5 FAILs) although criterion 8 of REQ-005 blocks after the 2nd FAIL. The excess was allowed by ORCH in `decisions/0010`, not by the owner. REQ-005 was set to `in_progress` by the audit. What do we do?

## Options

- A. The owner records his own exception for this run only; REQ-005 returns to `done` (recommended).
- B. Leave REQ-005 `in_progress` with the true reason.

## Decision

The question and the answer are those of `decisions/0103` (one question for both runs): his answer, quoted exactly: «Записать только для этих прогонов (Рекомендую)». Option A.

1. **Scope: exactly the run `BP-20261003-01` and criterion 8 of REQ-005.** `decisions/0010` stays as written (it was ORCH's decision); this record is the owner's own exception that the audit asked for.
2. **REQ-005 returns to `done`** by DOC-UPDATER with a comment that names this record and states that criterion 8 for this run rests on the owner's exception.
3. **Every later run** keeps the limit of criterion 8; the criterion is unchanged.
4. **ISS-0096** is closed by DOC-UPDATER with the outcome "closed by the owner's exception (decisions/0104)", not as a fix.

## Why

The run's result was accepted after the sixth pass and re-checked by AUD-001; the missing piece was the owner's own word, which he has now given.

## Boundary

Does not change the quality bar, the criterion text or any other requirement; does not apply to another run; `decisions/0010` is not edited.

## Basis

The owner's words quoted above (2026-10-28); `docs/audits/AUD-001/report.json` (REQ-005-F1); `docs/issues/ISS-0096-*.md`; `decisions/0010`, `decisions/0079` item 4; the form of `decisions/0081`.
