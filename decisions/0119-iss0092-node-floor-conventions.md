# 0119 — Conventions of the requirement R0.2 (REQ-110, the tools/ Node floor) for the defect ISS-0092: answers to the open questions О1–О11

Status: **accepted** (ORCH, 2026-11-18, inside the owner's answers to G1 of 2026-10-28 — part 1 «ты сам обнови», part 2 «Да (Рекомендую)» — and his words of 2026-11-17 «Продолжи работу, так чтобы я получил готовый продукт» with «Публичный сайт V1» (`decisions/0115`); `decisions/0101` accepted by its Addition of 2026-11-17; the owner can cancel each point).

## Question

REQ-ANALYST wrote REQ-110 (`handoffs/ISS-0092-20261117-01/step-02-req-analyst.json`) with the defaults of eleven open questions. They are closed before the gate REQ-VALIDATOR (Q12).

## Options

For each point the analyst names a default and the measurement behind it; no point is closed by a guess.

## Decision

- **О1.** Accepted: `engines` of `tools/package.json` is the one source of the floor value; every other place that states it (the lockfile root, the version rule, `hook.sh`, the README) is checked equal by a test; at each Node security release ORCH raises all of them in one run (WF-03 or WF-02 by the size).
- **О2.** Accepted: no `engine-strict` in `.npmrc`; npm only warns, so the refusal lives in the runtime guards of the entry points (measured: `--engine-strict` refuses `npm ci` but never `npm run`).
- **О3.** Accepted, with a named limit: the hook skips a candidate below the floor for the next one (node-path, then PATH, then the fallbacks); if none is left it exits 0 quietly (it never disturbs the Claude Code session) and the event is lost; README states this limit plainly where the hook is described, so a missing event has a known cause.
- **О4.** Accepted: `check.yml` binds Node with `check-latest: true` (keeps the 26 tests of `repo.test.js` green; a version range would turn CI-3 and CI-8 red), and the guards refuse a runner below the floor.
- **О5.** Accepted: `tools/src/pixel-office/public/office-report.js` is in scope (an entry point the diagnosis missed); `npm test`, lint and format themselves are not guarded (the steps before `npm run traces` write nothing, so `npm run check` stops there below the floor); the test stand-ins are out of scope.
- **О6.** Accepted: README lines 157 and 207 (the hook) join the write set beside line 9 (PLAN M0.9 "line 9 only" is amended in PROGRESS «Plan amendments»); line 176 stays byte-equal (DC-01). The "Node 22" lines of CLAUDE.md, the root README and two agent files go to one follow-up LOW defect opened at step 10.
- **О7.** Accepted: Pixel Office keeps its exit code 1; the other commands use one non-zero code chosen by the design; the refusal line is in Russian and names both the running and the needed version.
- **О8.** Accepted: `--help` works below the floor (it writes nothing).
- **О9.** Accepted: a malformed or pre-release version string is refused.
- **О10.** Accepted: the header canary RT-4 covers the Pixel Office, team web and picker servers, with the size bound the analyst measured (2 500 short lines, the whole head under 16 384 bytes; a 1 000-line twin answered normally).
- **О11.** Accepted: REQ-001 criterion 15 (the block is `blocked`) gets a WF-01 micro-amendment later so that its "Node 22" means "at or above the floor"; recorded as an item of the follow-up defect of О6, not done in this run.

## Addendum 2026-11-18 (ORCH, after the gate REQ-VALIDATOR pass 1 = FAIL, `handoffs/ISS-0092-20261117-01/step-02b-req-validator.json`)

- **О12 (F1-F3, Medium; F4-F8, Low; fixed now while passes are left).** The block carries what this record settles: a criterion that the README states the hook's named limit of О3; a criterion that `--help` works below the floor (О8); the refusal line in Russian naming both versions (О7), not "the design's language". Criterion 1's equality test covers every place that states the floor, the README hook lines 157 and 207 included. The bar paragraph names Q2 and Q3 (every fact and criterion rests on simulated versions, measured against a real-version control). The Low points: the size bound of criterion 7 is described as what Node counts (header names and values), not "the whole head is refused over 16 KiB"; the canary's twin row is stated so that a stricter header limit is allowed (B1 green) or the stricter result is named; criterion 6 names its exact comparison (whole-word options, the short forms included, eslint's `--fix-dry-run` not hit); the inexact texts join the write set (README line 36, `.githooks/pre-push` line 32) or, for REQ-104's sentence about the run record, go to DOC-UPDATER at step 10 as an outdated fact; the guard-test table lists the tests that stay green and read the same places (the hook tests that run `hook.sh` with `e2e/pixel-office.e2e.js`; E2K-60, E2K-61, ST-06; WEB-9d, CTL-5a, CTL-1c, WEB-14; PG-20's banned list for `office-report.js`).

## Addendum 2026-11-18 (ORCH, after the gate REQ-VALIDATOR pass 2 = PASS, `handoffs/ISS-0092-20261117-01/step-02d-req-validator.json`)

- **О13 (G1-G7, Low).** As after the passed second pass of other gates, the Low findings do not return the requirement. The design of the fix (step 3) settles: G1 (the hook's floor compared with `engines` however it is written, not only as a `22.x.y` text), G3 (the full list of eslint and prettier options that write — the gate measured `--suppress-all` and `--prune-suppressions` writing `eslint-suppressions.json`, and named `--suppress-rule`, `--suppressions-location`, `--init`; a gap of criterion 6 found by the design goes to a micro-amendment before the design gate), G4 (the `22.<n>.<n>` pattern with borders), G5 (a pinned `--help` row for each entry point whose help exists today, the Pixel Office command included), G6 (the exit-code lists in the help texts and the README with `picker-config.test.js:716-717`; `hook.sh` keeps code 0 by criterion 4, outside "every other entry point"), G7 (Node's size limit counts the request target too; the bound of criterion 7 stays). G2 (criterion 9 (c) says "name the floor" where pass 1 said "takes only a Node at or above the floor") goes to the first micro-amendment of REQ-110 or to DOC-UPDATER as a wording point. The stricter ban of criterion 1 on any other `22.x.y` text in `tools/src` and the READMEs (G4, issue I2) is accepted here as part of О1 (one source of the floor; an example version belongs in the tests).
- **О14 (issue I4).** The two trial copies of the gate outside the project that the permission check did not let it remove stay where they are; they hold no project file and are the owner's to delete.

## Why

Each answer is the analyst's measured default; the floor is enforced where it can be enforced (runtime guards), CI is bound to a patched Node, and the one place where enforcement would harm the owner's session (the hook) fails quiet but documented.

## Boundary

Only the run ISS-0092-20261117-01 and REQ-110. It does not touch `.claude/settings.json`, installs no Node, and the release of the run goes with the records release M0.13 (`decisions/0117` О33).

## Basis

`handoffs/ISS-0092-20261117-01/step-01-issue-fixer.json` (the diagnosis) and `step-02-req-analyst.json` (the block and its measurements); `docs/issues/ISS-0092-*.md`; decisions 0002, 0101 (with its Addition), 0115, 0117 О33.
