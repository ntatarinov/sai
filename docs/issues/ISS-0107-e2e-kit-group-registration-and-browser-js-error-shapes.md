# ISS-0107 — The e2e kit, found outside the change of REQ-105: a process group stays registered after its leader ended, so a reused group number could get SIGKILL

Серьёзность: LOW. Статус: open. Найдено: SECURITY-REVIEWER (шаг 03, находка F4, issue I2), прогон `E2E105-20261105-01`, 2026-11-08; заведено DOC-UPDATER (шаг 10), 2026-11-15T16:39:45Z; разделено по `decisions/0109`, О16 (одна причина — один дефект) DOC-UPDATER на шаге 10b, 2026-11-15T17:03:00Z: формы ошибок `browser.js` вынесены в **ISS-0109**. Пункт планки: Q10 (отказ не роняет процесс и оставляет чистое состояние), Q5 (тест держит поведение). Требования: REQ-104 (сделано; общий механизм набора `cleanup.js` и `browser.js`), REQ-105 (сделано; `stand.js`). Решение: `decisions/0109`, О16 (F4 открывается дефектом на шаге 10 и не исправляется в `stand.js` в этом прогоне). Имя файла сохранено с шага 10 (его называет закрытый handoff шага 10); вторая причина теперь в ISS-0109.

## Что не так

When a stand ends by itself and its process group is already empty, its group number stays registered, with its runner record and its marker folder, until `stop()`, the exit handler or the runner's sweep. If the number were reused by a new process-group leader in that window, that group would get `SIGKILL`. The places: `tools/test/e2e/kit/stand.js` (`stop()`: the final `SIGKILL` to the group also when the leader ended long before, and `unregisterGroup` only there), and the same shape in the released shared code `tools/test/e2e/kit/cleanup.js` (the exit handler of `installHandlers`, and the runner sweep `sweepBrowserRegistry`, which kills any well-formed record whose marker exists) and `tools/test/e2e/kit/browser.js` (the groups of Chrome). Simulated, not reproduced by a real reuse: SECURITY-REVIEWER gave `stop()` the number of another group through `deps.spawn` and that group was killed (trial 5 D), and a well-formed record with an existing marker made the sweep kill the group it names (trial 5 E). Process numbers are sequential on this macOS (8 starts: 48843–48850), so a reuse needs a wrap of the number space inside the window.

Why LOW: a reuse needs a wrap of the process numbers inside a short window on the developer's own computer; no spec of Sai has shown it.

The other finding of the same review area — the error shapes of `browser.js` and `withBrowser` that `stand.js` fixed at step 04b — is another cause and lives in **ISS-0109**.

## Доказательство

- `handoffs/E2E105-20261105-01/step-03-security-reviewer.json` — finding F4 (Low; `place`, `what`, `fix`), issue I2 (one defect for the three places, AP-014); `decisions/0109`, О16.

## Как исправить

On the end of the leader, when `kill(-pid, 0)` already gives `ESRCH`, unregister the group, drop its runner record and skip the later group signals — in `stand.js`, `browser.js` and `cleanup.js` together, as one change of the shared mechanism (AP-014), with a test that hands the starter the number of a foreign group through `deps.spawn` and asserts that group is not signalled. A weaker test, a skip or a removed check is not a fix (Q6).

## Маршрут

WF-03 for BACKEND-DEV (the kit is REQ-104 code) with SECURITY-REVIEWER and REVIEWER, then TEST-DESIGNER for the test; it can ride with ISS-0109 and ISS-0110 (the same kit). On ORCH's order.
