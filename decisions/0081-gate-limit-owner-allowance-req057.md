# 0081 — One extra test after the third FAIL of the test gate of REQ-057 (the owner's allowance, this run only)

Status: **accepted** (by the owner's word, 2026-10-25, in the session; recorded by DOC-UPDATER on the request of ORCH and of finding RV-1 of `handoffs/PAGE057-20261021-01/step-28-release-validator.json`). It is a one-time allowance for run `PAGE057-20261021-01`, not a general rule.

## Question

The test-design gate (TEST-DESIGN-VALIDATOR) of REQ-057 returned FAIL three times: at steps 16, 18 and 23 of run `PAGE057-20261021-01`. By `decisions/0079`, item 4, "up to three gate passes per step: the first and two repeats; the third FAIL is a stop and a report to the owner". ORCH stopped and asked the owner. The third FAIL had one blocking finding, F1 (Medium): the button "Start over" on the temporary screen of the result had no test (mutant R06, the page hands `onStart` instead of `onRestart` to the screen of the result and the old answers come back); the other ten findings F2-F11 were Low and did not block. What do we do?

## Options

- **A. Write one more test (recommended by ORCH).** TEST-DESIGNER adds one test case for F1 to the existing test `QP-1b`; no test is removed and no code changes; the validator does not run a fourth pass, RELEASE-VALIDATOR checks the case itself with mutant R06.
- **B. Accept F1 as a Low item** and go on to the runner and the acceptance: the gap would stay open.
- **C. Stop the run** and rework the tests as a whole: a large rework against a one-line gap.

## Decision

The owner chose A on 2026-10-25 (system time of the session). The question put to him was «Проверяющий тестов в третий раз вернул FAIL ... Что делаем?» ("The test checker returned FAIL for the third time ... What do we do?") and his answer, quoted exactly: «Дописать один тест (Рекомендую)» ("Write one more test (Recommended)").

1. **Scope: exactly one test case**, for finding F1 (the button "Start over" on the screen of the result, mutant R06), done at step 24 (`handoffs/PAGE057-20261021-01/step-24-test-designer.json`). The case was added to `QP-1b` of `tools/test/picker-page.test.js`; the counts stayed 65 / 23 / 12 / 100 tests; nothing in `tools/src` was changed.
2. **The findings F2-F11 of step 23 were not part of the allowance** and were not touched. They are recorded as defect ISS-0086.
3. **No fourth pass of the gate was made.** The check of the added case was done by RELEASE-VALIDATOR (step 28) with its own run: mutant R06 on a copy outside the project fails `QP-1b` (99 of 100 pass), the project is unchanged.
4. **It is not a general rule.** The limit of three passes (`decisions/0079`, item 4) stays in force; a next FAIL of the third pass is again a stop and a report to the owner.

## Why

The gap was a rule of the design (C3) with a visible effect for the visitor and was closed by one added case without changing code, so a fourth pass of the whole gate would only repeat what the validator had already shown with a probe. The owner took the smaller, safer way.

## Boundary

Does not change the quality bar (`docs/quality-bar.md`, section 1: the allowance lowers nothing, because a test is only added), the limit of three passes, the requirement REQ-057 or its criteria. It does not allow a fourth pass for any other step or run, and it does not allow to skip a finding that blocks. A note on the date: ORCH gave 2026-10-25 (the system time of the session, UTC); RELEASE-VALIDATOR quoted the allowance as "2026-10-26", which can be the date in the owner's own time zone. This record uses the date from ORCH and does not decide between them.

## Basis

The owner's words of 2026-10-25 quoted in the Decision above (the question and the answer of the session); `decisions/0079`, item 4; `handoffs/PAGE057-20261021-01/step-16-test-design-validator.json`, `step-18-test-design-validator.json`, `step-23-test-design-validator.json` (F1 and issue I1 of the stop); `step-24-test-designer.json`; `step-28-release-validator.json` (RV-1, criteria 5 and the mutant R06 run); `docs/design/REQ-057-picker-page.md`, section 17.7.
