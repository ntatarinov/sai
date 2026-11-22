# ISS-0092 — Sai runs on Node 22.21.1, five security releases behind; the Pixel Office server and hook are affected now, and the `engines` floor lets any vulnerable 22.x pass
Серьёзность: CRITICAL. Статус: closed, 2026-11-22, исправлено прогоном `ISS-0092-20261117-01` (требование REQ-110), проверено RELEASE-VALIDATOR (PASS, 11 критериев из 11) и записью GitHub; исправление лежит в ветке `m0-records` и попадёт в `main` с выпуском записей M0.13. Найдено: AUD-001, DEPENDENCY-AUDITOR (находки DEP-01 и DEP-02, перепроверены AUDIT-COMPILER), 2026-10-27; заведено AUDIT-TRIAGE, 2026-10-28. Пункт планки: Q10 (через правило WF-05 об уязвимых зависимостях), Q12 (`decisions/0002-process-tooling-node.md`: Node 22). Требование: REQ-110 (написано этим же прогоном, шаг 02; до того требований не было).

## Что не так

The Node build on this computer is v22.21.1 (2025-10-28). After it Node published five security releases of 22.x: 22.22.0, 22.22.2, 22.23.0, 22.23.2 and 22.23.4 (the last on 2026-10-20). Even the Homebrew `node@22` stable build (22.23.3) lacks the 22.23.4 fixes. Everything that runs Sai runs on this build:

- the Pixel Office server (`tools/src/pixel-office/server.js`, a `node:http` server) and the Pixel Office hook (`tools/src/pixel-office/hook.sh` takes node 22 from `PATH` or the Homebrew `node@22` folder);
- the check command, the team commands (`tools/src/team/`, `tools/src/web/server.js`) and the picker server (`tools/src/picker/server.js`).

`tools/package.json` has `"node": ">=22 <23"` in `engines`, so any vulnerable 22.x passes the Node guards. The CI (`.github/workflows/check.yml`, `node-version: "22"`) takes the newest 22.x and is not affected; only the local build is.

By the WF-05 scale a known vulnerability reachable in the Pixel Office server or hook is Critical (DEP-01); the same cause in the other parts is High (DEP-02, shared by tools-core, team and picker). One cause: the local Node build and the open `engines` floor.

## Доказательство

From `docs/audits/AUD-001/all/dependencies.json` and the re-check in `docs/audits/AUD-001/report.json` (DEP-01, DEP-02, field `recheck`):

- `node -v` gives `v22.21.1`; the working Pixel Office server (`node src/pixel-office/main.js --port 4790`, started 2026-10-18) runs the `node@22/22.21.1_4` binary (`ps`, `lsof`, read only); the working picker server runs the same binary.
- `curl https://nodejs.org/dist/index.json` (v22 lines) lists the five releases above with `security=true`.
- Reachable now: the fix CVE-2026-58044 «http: reject requests exceeding max header count» (22.23.2, rated Low by Node). On a separate server started from the project code on port 0 with a temporary state folder outside the project, a request with 2 500 short headers (above the default limit of 2 000) was accepted with `200 OK` instead of being refused; the server stayed up. `grep -rn maxHeadersCount tools/src` finds nothing.
- Not reachable: CVE-2026-21710 (`headersDistinct` / `trailersDistinct` are not read in `tools/src`) and CVE-2025-59466 (no `async_hooks` / `AsyncLocalStorage` in `tools/src`).
- Reach is limited to a program on this computer: the server listens on the loopback address only. The observed effect is a refused request that was not refused, not a crash.

## Как исправить

Two items, one per finding, each with its own regression test. Both rest on the same fix, so they can be closed only together.

1. **DEP-01 (Critical): the Pixel Office server and hook.**
   - Update the local Node 22 to v22.23.4 or newer (the official installer or a manager: Homebrew `node@22` is at 22.23.3, which is not enough) and restart the Pixel Office server on the new build. The restart of the working instance is the owner's call (R2: nothing is written into its journal by hand).
   - Raise the `engines` floor in `tools/package.json` to the last security release (for example `>=22.23.4 <23`) and make the Node guards of the commands and the hook refuse a vulnerable build. This is a choice, so it is recorded in `decisions/NNNN-*.md` by the owner's decision (Q12). Where `tools/src/pixel-office/hook.sh:30-45` picks the Node binary must be looked at together with the floor.
   - Regression test for this item: a test that goes red while the declared floor and the guard of the Pixel Office entry points (server and hook) accept 22.21.1 and goes green when they refuse it, with a simulated version below the floor and a permitted version (state unchanged on refusal). Operational check, not a test: `ps` / `lsof` of the running Pixel Office server shows a binary not older than the floor.
2. **DEP-02 (High): the check command, the team commands and the picker server.**
   - The same update and the same floor (one cause). The picker server on its own port is also restarted on the new build.
   - Regression test for this item: the same refusal checked separately at the entry points of the other parts (the check command, the team commands, the picker server): a build below the floor is refused with an understandable message and nothing is written; a permitted build runs.
   - Repeat the check at every Node security release (a note for the owner in the report; the form of a recurring check is for CODE-DESIGNER).

## Маршрут

WF-03. Step 1 — reproduction by ISSUE-FIXER (the version, the running binaries, the header-count probe on a separate server on port 0; all places where a Node version is chosen, AP-014). Then CODE-DESIGNER, CODE-DESIGN-VALIDATOR, CODE-FIXER, SECURITY-REVIEWER, REVIEWER, TEST-DESIGNER, TEST-DESIGN-VALIDATOR, TEST-RUNNER, RELEASE-VALIDATOR, DOC-UPDATER, RELEASE-FINALIZER. The floor in `engines` needs the owner's decision first.

## Закрыто

Закрыто 2026-11-22T21:26:55Z (время с часов), прогон `ISS-0092-20261117-01` (WF-03, шаг 10, DOC-UPDATER после PASS RELEASE-VALIDATOR, `handoffs/ISS-0092-20261117-01/step-09-release-validator.json`, 2026-11-22T21:24:16Z). Итог: причина устранена, регрессионные тесты есть. Требование REQ-110 переведено в `done` этим же шагом. Оба пункта (DEP-01 и DEP-02) закрыты вместе, как требуют это дефект и `decisions/0101`.

- **What was done (requirement REQ-110, the design `docs/design/REQ-110-tools-node-floor.md`, decisions 0101, 0119, 0120).** One rule for the floor, `tools/src/node-floor.js` (the floor 22.23.4; a version is three whole numbers; a Node below it, of another major or with an unreadable version is refused), called first by the entry points E1 to E11 of the design (the 14 `node <file>` scripts of `tools/package.json` in 10 files, the second commands and `office-report.js`), right after the help branch: one line in Russian that names both versions, code 2 (code 1 for the Pixel Office server), nothing written, no server started. `tools/src/pixel-office/hook.sh` now checks every Node candidate (the recorded `node-path`, `PATH`, the fallbacks), skips one below the floor, of another major or that cannot start, never evaluates the version text and ends with code 0 and no output. `engines` in `tools/package.json` and the root of `tools/package-lock.json` say `>=22.23.4 <23`. `.github/workflows/check.yml` keeps `node-version: "22"` and adds `check-latest: true`, so a stale runner cache shows up in the log. The README lines and the message of `.githooks/pre-push` name the floor.
- **Regression tests.** `tools/test/node-floor.test.js` (new: NF-01 to NF-09, with NF-05a to NF-05d for every entry point under a simulated old Node and its twin at the floor; nothing written below the floor), `tools/test/pixel-office-hook.test.js` (HK-32 to HK-40, stub nodes), `tools/test/pixel-office-server.test.js` (SV-39 and the header-count canary, `SV-68` there, see ISS-0142), `tools/test/repo.test.js` (CI-1 to CI-8; CI-3 and CI-8 now pin the floor), `tools/test/pixel-office-docs.test.js` (DC-01). The simulated version always has a positive control (AP-160).
- **How it was checked.** RELEASE-VALIDATOR reproduced the defect on the tag `base/ISS-0092-20261117-01` (6c756cd): `engines` `>=22 <23`, no guard, and under a simulated 22.21.1 all 20 entry-point rows started and the Pixel Office server wrote 4 files; at HEAD 76a6862 under simulated 21.7.0, 22.21.1, 22.23.3 and 23.0.0 all 20 rows are refused with nothing written, and under 22.23.4 and 22.24.0 none is. The tests ran on GitHub, not on this computer (`decisions/0110`): snapshot `ci/aud002-head-3` (c0c2019, the tree equal to HEAD): `check.yml` run 45069498041 success (2261 tests, fail 0, skipped 0, todo 0; 36 e2e tests; setup `node: v22.23.5` with `check-latest: true`) and `app.yml` run 45069497945 success. The earlier head run 45061034491 had CI-3 and CI-8 red (AP-173); both are ok now.
- **What is NOT done or not proved (do not read the closing as more).** (1) The check on the exact pushed commit (criterion 8 of REQ-110) belongs to the release of the records M0.13; the fix is on `m0-records` and reaches `main` with it. (2) The owner's own running Pixel Office server and picker are restarted on the new Node by him (R2; the audit's old 22.21.1 process is gone, `PROGRESS.md`, 2026-11-17: `node -v` and the recorded `node-path` read v22.23.4). (3) The repeat at every Node security release stays a duty of ORCH and the owner (`decisions/0101`), not a test. (4) Named limits: a hook candidate whose `--version` hangs is not stopped by a timer (no timer in POSIX sh); a real Node that cannot load ES modules fails with its own error before the guard. (5) Open follow-ups, all Low: ISS-0140 (a wrong call below the floor: README line 9 and the design disagree), ISS-0141 (the texts that still say "Node 22" without the floor and the exit-code lists), ISS-0142 (a test id used twice; one refusal line is ungrammatical).
