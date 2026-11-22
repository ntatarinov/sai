# ISS-0132 — The team engine and Pixel Office run on Windows without a guard: the group stop does nothing, the 0700/0600 modes and the owner check do nothing

Серьёзность: HIGH. Статус: open. Найдено: AUD-002, SECURITY-AUDITOR (team, pixel-office), 2026-11-22 (находки SEC-TEAM-01 (High), SEC-TEAM-02 (Medium), SEC-PO-02 (Medium)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: Q7, Q10 (a stop that does not stop; trust built on modes that do nothing); gate G2 (a real run costs the owner's money).
Требования: REQ-013, REQ-035 (the engine and the real executor), REQ-011 (the page), REQ-001/REQ-005 (Pixel Office); decisions/0127 Г (Windows is a thin client, the executor stays on the Mac, porting is not planned).

## Что не так

- `tools/src/team/executors/proc.js` uses `process.kill(-pid)` (`signalGroup`, `stopGroup`), which does not work on Windows. A probe on this PC with a child it started returned «group gone» after 0 ms while the process kept running: a timeout or a cancel does not end a real run, and it could keep spending the owner's money. The code has no `win32` branch (ORCH re-read `signalGroup`).
- On Windows the modes 0700/0600, the owner check (`getuid`) and `O_NOFOLLOW` do nothing: the state folder reads back as mode 666 after chmod 700. tools/README.md builds trust on 0700 and says nothing about Windows (the team part and Pixel Office, SEC-TEAM-02, SEC-PO-02).

## Доказательство

docs/audits/AUD-002/team/security.json (SEC-TEAM-01, SEC-TEAM-02), docs/audits/AUD-002/pixel-office/security.json (SEC-PO-02); decisions/0127 Г.

## Как исправить

1. Fail closed, in one change: on `process.platform === 'win32'` the real executor (`executors/claude-cli.js`) refuses to start a run with an error that says the engine runs on Linux and macOS only; the team web server and the Pixel Office server print the same warning at start and refuse to write the state folder when the modes cannot be set (the check is a function with an injectable platform so that a test on Linux proves the refusal). tools/README.md names the supported platforms (Linux, macOS) and says that Windows is a client only (decisions/0127 Г).
2. Tests: unit tests with the platform injected (a win32 start is refused, a linux start is not); nothing runs a real process on Windows.

## Маршрут

WF-03 (ISSUE-FIXER reproduces by reading and by the injectable-platform test, CODE-FIXER, REVIEWER, SECURITY-REVIEWER, TEST-DESIGNER, TEST-RUNNER on GitHub).
