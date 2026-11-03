# 0107 — Real-Chrome end-to-end tests belong to `npm run check`; the "no browser binary" clause of 0023 D2 is lifted for them

Status: **accepted** (ORCH, 2026-11-03, on the owner's answers of the same day; the owner can cancel).

## Question

The owner asked for end-to-end tests of the whole Sai project. The gate REQ-VALIDATOR (WF-01, run E2E-20261103-01, step 02) found that the requirement REQ-104 collides with `decisions/0023` D2, which says that the page tests run "without a browser binary: installed by `npm ci`, works on the clean machine of REQ-014" and are all part of `npm run check` (Q4, no exceptions). A real end-to-end test needs a Chrome binary. The gate also asked whether a temporary branch may be pushed to learn if the GitHub runner has Chrome.

## Options

- A: Chrome is needed; the end-to-end tests are part of `npm run check`. The clause "without a browser binary" of D2 is lifted for the new tests only.
- B: the end-to-end tests are a separate command outside `npm run check`. Rejected by the owner's answer: it would break Q4 ("all tests by one command").

## Decision

A, by the owner's answers of 2026-11-03 to ORCH (the questions were put in the session through the question dialog):

- «Chrome нужен, e2e входят в проверку» — the new end-to-end tests (REQ-104…REQ-107) run inside `npm run check`; if no Chrome is found the test FAILS with an understandable message and is never skipped (Q6).
- «Да, можно» — to learn whether the GitHub runner has Chrome, a temporary branch `ci/<name>` may be pushed and deleted after the run; `main` is not touched by it (the way of building the snapshot commit is the one already used in the runs of ISS-0093).

D2 stays in force for everything else: the existing page tests stay on the hand-made DOM, with no browser. The requirement REQ-033 (page tests through jsdom) is NOT decided here: it stays pending until the owner says what happens to it.

## Why

The owner asked for real end-to-end tests; the hand-made DOM cannot show a layout, a focus, a real click or a real network failure. Q4 asks for one check command, so the new tests go into it.

## Boundary

Only the end-to-end tests of REQ-104…REQ-107 may need a browser. No new npm package is allowed by this record (the kit is pure Node 22). It does not change the time limit of `check.yml` (0106): the added time is watched by a criterion of REQ-104, and if the whole suite nears 25 minutes, the option of parallel jobs of 0106 is opened. It does not allow pushing to `main` in a new way (0048, 0079 stay).

## Basis

The owner's words of 2026-11-03 (Claude Code session, message to ORCH): «по проекту sai используй инструкции [другого проекта владельца] и sai. Чтобы убрать ошибки и покрыть тестами проект, а именно e2e тесты»; his answers of the same day quoted above; the gate result in `handoffs/E2E-20261103-01/step-02-req-validator.json`.
