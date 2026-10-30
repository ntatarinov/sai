# ISS-0092 — Sai runs on Node 22.21.1, five security releases behind; the Pixel Office server and hook are affected now, and the `engines` floor lets any vulnerable 22.x pass
Серьёзность: CRITICAL. Статус: open. Найдено: AUD-001, DEPENDENCY-AUDITOR (находки DEP-01 и DEP-02, перепроверены AUDIT-COMPILER), 2026-10-27; заведено AUDIT-TRIAGE, 2026-10-28. Пункт планки: Q10 (через правило WF-05 об уязвимых зависимостях), Q12 (`decisions/0002-process-tooling-node.md`: Node 22). Требований нет.

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
