# ISS-0109 — The e2e kit, found outside the change of REQ-105: `browser.js` and `withBrowser` keep the error shapes that `stand.js` fixed (pipes touched before the error listener, an error attached to itself, an unprotected assignment, a thrown `null` taken for success)

Серьёзность: LOW. Статус: open. Найдено: REVIEWER (шаг 04, issue I2; находки L1 и L2 о тех же формах в `stand.js`), CODE-FIXER (шаг 04b, issue I2), прогон `E2E105-20261105-01`, 2026-11-08; заведено DOC-UPDATER (шаг 10 как пункт 2 ISS-0107), выделено в отдельный дефект по `decisions/0109`, О16 (одна причина — один дефект) на шаге 10b, 2026-11-15T17:03:00Z. Пункт планки: Q10 (отказ не роняет процесс и оставляет чистое состояние), Q5 (тест держит поведение). Требования: REQ-104 (сделано; `tools/test/e2e/kit/browser.js`). Решение: `decisions/0109`, О16 (формы REVIEWER I2 исправлены в новом `stand.js` в этом прогоне; формы шага 04b, I2, идут в тот же дефект, что и прочие формы `browser.js`). Связан с ISS-0107 (другая причина того же набора: номер группы остаётся записанным после конца лидера).

## Что не так

In `tools/test/e2e/kit/browser.js`, the released launcher of Chrome (REQ-104), four shapes stay that the new starter `stand.js` fixed at step 04b:

1. **The pipes are touched before the child's `error` listener exists** (lines 224–252 at step 04: `child.stderr.setEncoding` at 224, `child.on("error", …)` at 242). When the spawn fails with `EMFILE`, Node returns a child without pipes and emits `error` on the next tick, so the start throws a `TypeError` instead of the kit's error and the `error` event has no listener. Measured for `stand.js` under `ulimit -n 64` (L1 of step 04); `browser.js` itself was not run so, it needs Chrome.
2. **`withBrowser` attaches the error to itself** as `cleanupError` when the body awaited a failing close (`error.cleanupError === error`).
3. **`withBrowser` assigns `failure.cleanupError` without protection** (line 355): a frozen body error together with a failing close is replaced by a `TypeError` (reproduced by CODE-FIXER in a copy).
4. **`withBrowser` uses `failure === null` as the mark of «no failure»** (lines 344 and 354), so a body that throws `null` passes as a success (reproduced: it resolves with `undefined`).

`withStand` of `stand.js` keeps a separate flag and rethrows `null`, attaches no error to itself and protects the assignment (test `E2S-15`; the mutants T06 and T07 of step 05 are red there).

Why LOW: each shape needs a failing spawn (`EMFILE`), a failing close after a failed body, a frozen error object or a thrown `null` — none happens in the specs of Sai today, and every path still ends the browser.

## Доказательство

- `handoffs/E2E105-20261105-01/step-04-reviewer.json` — findings L1 and L2 (the same shapes in `stand.js`, fixed at step 04b) and issue I2 (`browser.js`, Low).
- `handoffs/E2E105-20261105-01/step-04b-code-fixer.json` — issue I2 (a) and (b) with the trials; `handoffs/E2E105-20261105-01/step-05-test-designer.json` — mutants T06, T07 (red in `E2S-15`).
- `decisions/0109`, О16.
- To see item 4 in a copy outside the project: call `withBrowser` with a body that throws `null` and look at the result: the promise resolves.

## Как исправить

In `browser.js`: listen for the child's `error` before the pipes are touched (as `stand.js` does), and in `withBrowser` keep a separate flag for «the body failed», rethrow the body's error as it is (also `null`), attach `cleanupError` only when it is not the body's error itself and only when the assignment can be made (as `withStand`). Each with a kit test that is red before the change. A weaker test, a skip or a removed check is not a fix (Q6).

## Маршрут

WF-03 for BACKEND-DEV with SECURITY-REVIEWER and REVIEWER, then TEST-DESIGNER for the tests; can ride with ISS-0100 (the same file `browser.js`), ISS-0107 and ISS-0110. On ORCH's order.
