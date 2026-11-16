# ISS-0108 — Older test files leave about 203 folders in the system temporary folder on every `npm run check`

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGNER (шаг 05, issue I11), TEST-DESIGN-VALIDATOR (шаг 05h, issue I8), TEST-RUNNER (шаг 06, issue I3), RELEASE-VALIDATOR (шаг 09, issue I3 (d)), прогон `E2E105-20261105-01`, 2026-11-08…2026-11-15; заведено DOC-UPDATER (шаг 10), 2026-11-15T16:39:45Z. Пункт планки: Q5 (тест не оставляет следов и не зависит от того, что осталось от другого), Q14 (найденное по пути не теряется). Требования: не этой работы — файлы тестов прежних требований (WF-06 и общие помощники тестов). Решение: `docs/quality-bar.md`, раздел 6, п. 6 (найденное по пути выносится в отдельный дефект).

## Что не так

One `cd tools && npm run check` leaves about 203 new folders in the temporary folder of the system (the root that `os.tmpdir()` gives), and none is removed: 195 `sai-wf06-*`, 5 `sai-outside-*`, 2 `sai-snap-*` and 1 `sai-flaky-*`. The same kinds and counts were measured at steps 05, 05h, 06 and 09 of the run (step 09: 6701 `sai-*` entries before its check, 6904 after). They come from released test files outside the change of REQ-105: `tools/test/helpers.js` (`sai-wf06-`, `sai-outside-`), `tools/test/cli.test.js` (`sai-outside-`, `sai-snap-`) and `tools/test/flaky-regression.test.js` (`sai-flaky-`). Read on 2026-11-15 at the start of step 10: 6630 `sai-wf06-*`, 170 `sai-outside-*`, 68 `sai-snap-*`, 34 `sai-flaky-*` in that root.

No folder lands in the project, the e2e kit leaves none (0 `sai-e2e-*` after every run, the check `LEFT` of the design of REQ-105) and the files of REQ-105 make their own root and remove it in `after` (0 `sai-stand-test-*`). The litter grows by about 200 folders with every check on the developer's computer; on the GitHub runner the machine is thrown away after the job.

Why LOW: disk litter, no wrong result. It can still confuse a later leftover count that reads the whole root, and the counts of a checker (AP-136, AP-137) are harder to read when thousands of old folders lie next to the new ones.

## Доказательство

- `handoffs/E2E105-20261105-01/step-05-test-designer.json` — issue I11 (the counts with `find -newer` against the start of the check, the three test files).
- `handoffs/E2E105-20261105-01/step-05h-test-design-validator.json` — issue I8; `handoffs/E2E105-20261105-01/step-06-test-runner.json` — issue I3; `handoffs/E2E105-20261105-01/step-09-release-validator.json` — issue I3 (d) and `self_check` «LEFTOVERS AND THE TREE AT THE END».
- To see it: `T="$(node -p "require('os').tmpdir()")"; ls "$T" | grep -c '^sai-wf06-'`, then `cd tools && npm test`, then the same count again: it is about 195 higher.

## Как исправить

Each of the three test files removes the folders it makes, in `after` or in a `finally` of the test that made them (`fs.rmSync(dir, { recursive: true, force: true })`), or makes them under one private root of the file that `after` removes (as `tools/test/e2e-stand.test.js` does); a test that counts on a folder outside the temporary root keeps its meaning. A guard test may count the new `sai-*` folders before and after the file. The folders already left are not part of the fix; the owner may delete them by hand.

## Маршрут

WF-03 for TEST-FIXER (tests only), not urgent; on ORCH's order.

## Обновление 2026-11-16 (DOC-UPDATER, прогон `E2E106-20261115-01`, шаг 10): снова 203 записи за проверку; старая папка со ссылкой на домашнюю папку

1. **Seen again.** TEST-RUNNER of run `E2E106-20261115-01` (`handoffs/E2E106-20261115-01/step-06-test-runner.json`, issue I3 and `self_check` «LEFTOVERS», 2026-11-16T00:18:56Z): one `npm run check` left 203 new `sai-*` entries in the system temporary root — 195 `sai-wf06-`, 5 `sai-outside-`, 2 `sai-snap-`, 1 `sai-flaky-` (9949 before, 10152 after; no old entry missing), the same kinds and counts as in run `E2E105-20261105-01`; the e2e kit left none (0 `sai-e2e-`).
2. **An old folder holds a link to the person's home folder.** BACKEND-DEV (`handoffs/E2E106-20261115-01/step-02-backend-dev.json`, issue I9; seen again by TEST-DESIGNER, `step-05-test-designer.json`, issue I8) found in the system temporary folder an old folder `sai-stand-test-…` of 2026-11-05 that holds a link `link-to-home` to the person's home folder and six `t-s*` folders. It is not of run `E2E106-20261115-01`: the `E2S` tests of today make their own root and remove it in `after`. It may be left by a run of `tools/test/e2e-stand.test.js` of 2026-11-05 (run `E2E105-20261105-01`, while that file was built) that ended before its `after`; whose run it was is not established. Nobody removed it. A link to the home folder that lies in a shared folder can be followed by any later tool that walks that folder, so the clean-up of this defect should also list the old `sai-stand-test-*` folders; the folders already left are removed by the owner or on his word, not by a test.

The defect stays `open`.
