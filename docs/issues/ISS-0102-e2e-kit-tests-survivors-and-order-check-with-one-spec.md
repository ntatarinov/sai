# ISS-0102 — The e2e kit tests: six mutants of the runner and the registry survive, and the order of spec files was checked with one file only

Серьёзность: LOW. Статус: open. Найдено: RELEASE-VALIDATOR (шаг 09, L2, L3), TEST-DESIGNER (шаг 05, I3, мутант X13), прогон `E2E104-20261103-01`, 2026-11-03; заведено DOC-UPDATER (шаг 10), 2026-11-03. Пункт планки: Q5 (тест держит критерий и ловит поломку), Q3 (честность проверки). Требования: REQ-104 (сделано); пункт 2 касается REQ-105.

## Что не так

1. **Survivors.** RELEASE-VALIDATOR applied 23 mutants of its own around the close of the runner, the sweep of the registry, `safeText`, the guard of the process group, the selection and the spec names, outside the project. 16 were caught. 7 survived: N03 (the stop of the group after a timeout is not awaited), N04 (no sweep of the registry right after a file ends; the final sweep still runs), N06 (the exit-code test `!== 0` changed to `> 0`: a spec killed by a signal then fails through the empty TAP text, with another message), N07 (the count of cancelled tests dropped: node exits non-zero anyway, equivalent), N16 (the profile folder name pattern widened to dots and dashes), N17 (a record whose profile folder is already gone is still killed: the guard against a reused process number is not pinned), N23 (`Math.floor` instead of `Math.round` in `duration_ms`). TEST-DESIGNER of the run found one more: X13 is the same case as N04 (the sweep after each spec changes nothing a test can see, because a failed or stopped spec ends the run). Both validators called each survivor equivalent or a defence in depth; none breaks a criterion of REQ-104. Together they are the part of the runner that no test pins.
2. **The order of spec files.** There is one spec file (`smoke`), so the check «all names, last to first» of criterion 7 shows the order of one name and proves nothing yet. The unit test `E2K-32` pins the order with fixture files and the mutants around it were caught, so the code is covered; what is missing is the same check on the real command with two real files. A repeated name is refused (`SELECTION_DUPLICATE`), so there is no way round it today.

## Доказательство

- Item 1: `handoffs/E2E104-20261103-01/step-09-release-validator.json`, `result.findings` L2 and `self_check` «MUTANTS»; `handoffs/E2E104-20261103-01/step-05-test-designer.json`, `result.issues` I3. The mutants were applied on a copy outside the project; to repeat one, copy `tools/test/e2e/kit/runner.js`, make the change named above and run `cd tools && node --test test/e2e-kit.test.js` on the copy: it stays green.
- Item 2: `ls tools/test/e2e/*.e2e.js` lists one file; `cd tools && npm run -s e2e -- smoke smoke; echo $?` gives 1 (`SELECTION_DUPLICATE`).

## Как исправить

1. A WF-03 run of TEST-DESIGNER adds a row for N04/X13 (a spec fixture that passes and leaves a live browser), N06 (a spec killed by a signal gives the message of the exit code), N16 and N17 (a profile folder named with dots and dashes is refused; a record with a gone folder is not used to kill), N23 (the rounding of `duration_ms` at a half millisecond); N03 and N07 stay as named equivalents, if the author agrees. A row that is added must fail on its mutant (Q5).
2. When REQ-105 adds the second spec file, its RELEASE-VALIDATOR repeats the order check of criterion 7 on two real files (the loop of criterion 7 of REQ-104). No separate run is needed for it; this item is the reminder.

## Маршрут

WF-03 for item 1 (can ride with ISS-0100: the same test file). Item 2 — the step 9 of the REQ-105 run.

## Обновление 2026-11-15 (DOC-UPDATER, прогон `E2E105-20261105-01`, шаг 10): пункт 2 выполнен, пункт 1 открыт

Item 2 is met. REQ-105 added the second real spec file (`tools/test/e2e/picker.e2e.js`), and its RELEASE-VALIDATOR ran the order check of criterion 7 of REQ-104 on two real files (`handoffs/E2E105-20261105-01/step-09-release-validator.json`, `self_check` «ORDER CHECK ON TWO REAL FILES»; design `docs/design/REQ-105-e2e-picker.md`, section 13), from `tools/`: all names, last to first, are `smoke picker` (not the alphabetical order); `npm run -s e2e -- smoke picker` → exit 0, the lines `e2e: file=smoke` then `e2e: file=picker`, `e2e: browser=` once, the last line `e2e: command=npm run e2e -- smoke picker selection=smoke,picker exit=0 duration_ms=33717`; `npm run -s e2e -- picker smoke` → exit 0, `picker` then `smoke` (`duration_ms=33755`); `npm run -s e2e -- picker picker` → exit 1 with `SELECTION_DUPLICATE`. One Mac (Chrome 157), one run of each.

Item 1 (the seven surviving mutants of the runner and the registry, N03, N04/X13, N06, N07, N16, N17, N23) is unchanged and not touched by REQ-105; the defect stays `open` for it.
