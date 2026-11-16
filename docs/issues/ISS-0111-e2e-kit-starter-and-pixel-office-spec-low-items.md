# ISS-0111 — The server starter of the e2e kit and the Pixel Office spec: seven Low items left for the next change of the kit (the script exemption by a reason text, a `Map` taken as empty, a comment that says more than the code, a red output that prints `HOME`, links one level deep, no check against a reload, the hash of a throwaway secret)

Серьёзность: LOW. Статус: open. Найдено: REVIEWER (шаг 04, L1, L2, L5), TEST-DESIGN-VALIDATOR (шаг 05f, G1, G2, issue I2), RELEASE-VALIDATOR (шаг 09, F1, мутант RV10), прогон `E2E106-20261115-01`, 2026-11-15…2026-11-16; заведено DOC-UPDATER (шаг 10), 2026-11-16T01:08:00Z. Пункт планки: Q5 (тест держит правило и ловит поломку), Q7 (значение процесса не попадает в журнал красного прогона), R2 (папки стенда проверены). Требования: REQ-106 (сделано; `tools/test/e2e/kit/stand.js`, `tools/test/e2e/pixel-office.e2e.js`), REQ-105 (сделано; запускатель). Решение: `decisions/0112`, О20 и О25 (пункты отложены на следующее изменение набора); `docs/quality-bar.md`, раздел 6, п. 6.

## Что не так

The gates of run `E2E106-20261115-01` passed with Low findings that do not block; a fix of the code or the spec would have needed the gates again, so `decisions/0112` О20 and О25 moved them here. Each item is true of the files as released by this run.

1. **L1 — the exemption of the script is decided by the reason text of another module.** `checkedScript` of `tools/test/e2e/kit/stand.js` (lines 213–225) keeps an absolute first argument inside the repository when `assertOutsideRepo` of `guards.js` throws an error whose message ends with `: inside the repository` (the constant `REPO_REASON`, line 38). If that reason is ever reworded in `guards.js`, the exemption silently stops applying. It fails closed (every such script is then refused) and loudly (REVIEWER's mutant M05 turned `E2S-01`, `E2S-03`, `E2S-22` red), but the coupling is hidden.
2. **L2 — a `Map` given as `stateEnv` or `env` is taken as an empty object.** `isPlainObject` (`stand.js`, lines 77–79) accepts any object that is not a list, so `stateEnv: new Map([["SAI_X", <folder>]])` reaches the spawn with no state variable and no word, against design 4.1 (`docs/design/REQ-106-e2e-pixel-office.md`, the row `stateEnv`: «Not a plain object → `USAGE`»). For Pixel Office the home net catches the fallback at `stop()` (`STAND_HOME_WRITTEN`); for another server it would not. The test of it was not written in the run because it would be red against the code as built (`decisions/0112` О21).
3. **L5 — the header comment says more than the code.** `stand.js`, lines 25–28: «every absolute path it is given is checked»; `cwd` is not checked (by choice, design 4.1).
4. **G1 — a red `isolated start` can print the `HOME` value of the test process.** `tools/test/e2e/pixel-office.e2e.js`, lines 542–551: the two folder values of the recorded hook call are compared with `assert.equal`, which prints the actual value on a red run. Under the gate's mutant A11 (the hook helper gives the hook the `HOME` of the test process) the red output held the path of the person's home folder. Not a secret, and the regression is caught; but it is against the letter of `decisions/0112` О24 (a red run prints no value of the test process), and the GitHub logs of the open repository can be read by anyone (`decisions/0111`).
5. **G2 — the link cases of the hook helper are one link deep.** The refusal «a link to the real state folder» and the recorded call through `office-link` each use one link. A helper that follows one level of link and then checks the spelling (mutant A4 of step 05f) passes both; there is no live gap, because the helper calls `assertUnderTempRoot`, which follows the whole chain.
6. **F1 of step 09 — `reconnect` does not check against a reload.** After the restart the test reads «на связи», the three rows and the new row, but not that the page was not reloaded. RELEASE-VALIDATOR's mutant RV10 (`src/pixel-office/public/app.js`, `requestCycle`: after a successful answer while the link is down, `location.reload()`) leaves `reconnect` green. Criterion 6 of REQ-106 does not say «without reload» (criterion 2 does, and `live` pins it), so it is not a breach of the criterion.
7. **Issue I2 of step 05f — a red listing check prints the sha256 of the throwaway `write-secret`.** The red outputs of the listing comparison in `reconnect` (mutants N07, A10) print the hashes of the files of the test's own state folder. A hash of a random throwaway secret does not reveal it and nothing of the real folder is read; still the message need not hold it.

Why LOW: none of the items lets a test reach the owner's real folder or start a process on it (rule R2-S holds: every call that names a real folder goes to a spawn that records and throws), and none hides a breach of a criterion of REQ-105 or REQ-106; items 4 and 7 concern what a red run prints, items 1–3 a fail-closed coupling, a fallback the home net catches and a comment, items 5 and 6 two shapes the tests do not see.

## Доказательство

- Items 1–3: `handoffs/E2E106-20261115-01/step-04-reviewer.json` — findings L1, L2, L5, issues I2 and I7 (trial t1, case «stateEnv Map with a folder»: the spawn was reached with `HOME` and `USERPROFILE` only). Read in `tools/test/e2e/kit/stand.js` at step 10 (lines 25–28, 38, 77–79, 213–225).
- Items 4, 5, 7: `handoffs/E2E106-20261115-01/step-05f-test-design-validator.json` — findings G1, G2, issue I2, mutants A4, A10, A11; `decisions/0112`, О25.
- Item 6: `handoffs/E2E106-20261115-01/step-09-release-validator.json` — finding F1, issue I1, `self_check` (the mutants RV10 and its probe: one assertion of the navigation type after the restart, green without RV10 and red with it, `reload` instead of `navigate`).
- To repeat item 2 in a copy outside the project (never with a real folder, rule R2-S): call `startStand` with `stateEnv: new Map([["SAI_X", <a folder of the test>]])` and a `deps.spawn` that records and throws; the recorded environment holds no `SAI_X`, and no `USAGE` is thrown.

## Как исправить

One WF-03 run with the next change of the kit (BACKEND-DEV for `stand.js`, TEST-DESIGNER for the tests, the gates as usual):

1. L1 — an exported predicate in `guards.js` (for example «is inside the repository», built on the same real-path test) or a reason code in the error details, used by `checkedScript` instead of the text.
2. L2 — require `Object.getPrototypeOf(value)` to be `Object.prototype` or `null` for `stateEnv` and `env`, with the message of design 4.1; a row «`stateEnv` that is a `Map`» in `E2S-02`, red on the code of today.
3. L5 — the comment: «every absolute path in `stateEnv`, in `env` and in the arguments is checked».
4. G1 — compare both folder values like `PATH`: `assert.ok(options.env.SAI_PIXEL_OFFICE_DIR === fs.realpathSync(folders.office), "…")` and the same for `HOME`; A11 then prints only true or false.
5. G2 — make the refused link and the recorded office spelling chains of two links; A4 then goes red.
6. F1 — in `reconnect`, set a marker after `openPage` and assert at the end that it is still set and the navigation entries are `["navigate"]`, as `live` does; RV10 then goes red.
7. Issue I2 of 05f — leave the hash of `write-secret` out of the message of the listing comparison, as the values are left out.

A weaker test, a skip or a removed assertion is not a fix (Q6).

## Маршрут

WF-03 for BACKEND-DEV (items 1–3) and TEST-DESIGNER (items 2, 4–7), with SECURITY-REVIEWER and REVIEWER, then TEST-DESIGN-VALIDATOR; best together with the next change of `tools/test/e2e/kit/stand.js` (REQ-107) or with ISS-0110 (the same kit). On ORCH's order.
