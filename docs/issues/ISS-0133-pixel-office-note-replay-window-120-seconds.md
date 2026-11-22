# ISS-0133 — A signed Pixel Office note body has no time of its own, so the replay guard of ISS-0123 holds for 120 seconds only; the busy-port probe sends the read key to whatever holds the port

Серьёзность: HIGH. Статус: open. Найдено: AUD-002, SECURITY-AUDITOR (pixel-office), 2026-11-22 (находки SEC-PO-01 (High), SEC-PO-03 (Low)); заведено ORCH, 2026-11-22T19:32:14Z. Пункт планки: R2 (only real events reach the office), Q10.
Требования: REQ-005, REQ-001 (Pixel Office); ISS-0123 (closed: «a signed body once; a replay gets 409» fixed for hook events).

## Что не так

- POST /api/note: the signed body has no time field, so the guard remembers the signature for 120 s. Measured on a test server on port 0 with an injected clock: the same body gave 200, then 409 at +10 s, then 200 at +210 s and 200 at +30 days; the journal ended with three ORCH records with the same text (`server.js` lines 192-206 and 372-395, `protocol.js` line 322). The attacker needs a captured signed request, so the reach is narrow, but ISS-0123 named this place and was closed as fixed.
- Low (SEC-PO-03): the busy-port probe in `main.js` sends the read key to whatever process holds the port; the cookie is `Path=/` and not tied to the port.

## Доказательство

docs/audits/AUD-002/pixel-office/security.json (SEC-PO-01, SEC-PO-03) with the probe output.

## Как исправить

1. Put a time into the signed note body, check it against the same skew window as the hook events (`time_skew` → 400), and keep the seen signatures for the whole window plus the skew, so a body replayed at any later time is refused (a signed body is accepted once). The writer `note.js` adds the time. Keep ISS-0123 closed and name this defect in it as the follow-up.
2. Tests: the same body twice inside the window (409), after the window (400 for time), with a future time (400); the table of the signed-field tests extended. Low: the probe must not send the key (it asks the health route without it).

## Маршрут

WF-03 (ISSUE-FIXER reproduces on a test server on port 0 with an injected clock).
