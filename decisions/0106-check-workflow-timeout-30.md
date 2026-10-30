# 0106 — The time limit of the workflow `check` is raised from 15 to 30 minutes

Status: **accepted** (ORCH, 2026-10-29, inside the owner's word of the same day: «делай до тех пор пока check зеленый не будет, 3 попытки»; the owner can cancel).

## Question

The first full check of run ISS-0093-20261028-01 on GitHub (step 09, a temporary branch, attempt 1) was cancelled by the limit `timeout-minutes: 15` of `.github/workflows/check.yml` while the tests were still running: format, lint, traces and handoffs-check were green, 2030 tests had passed, none was red. The earlier green runs on `main` took 10 to 14.7 minutes (2026-10-26/27), so the suite was already at the limit; the tests of REQ-102 (the bytes file about 140 s and the timing file about 95 s on the developer's machine, the timing family alone 85 s on the runner) push it over.

## Options

- A: raise the limit to 30 minutes. The tests and the checks stay as they are.
- B: shorten the tests of REQ-102 (fewer repeats, smaller sweeps). Rejected: it lowers the quality bar the gate has just passed; the requirement allows fewer repeats only down to the stated floor, and it does not fix the real cause (the whole suite grew).
- C: split the suite into parallel jobs. Rejected for now: a bigger change of the workflow than the problem needs.

## Decision

A. In `.github/workflows/check.yml` `timeout-minutes` goes from 15 to 30. The reason of the limit (design REQ-030, Q10: a hang does not eat the default 360 minutes) holds: 30 minutes still stops a hang. Nothing else in the file changes. The text «запуск ≈ 3–5 минут» in `docs/design/REQ-030-github-check.md` is out of date; DOC-UPDATER notes it, and the time of the suite is watched at each audit (if it nears 25 minutes, option C is opened).

## Why

The failure was the limit, not a test; a longer limit is the smallest change that lets the full check finish and keeps its power to fail.

## Boundary

Only the number of minutes. The change goes into the release commit of this run with the rest of the files and is judged by RELEASE-VALIDATOR like them. It does not allow a longer limit later without a new record.
