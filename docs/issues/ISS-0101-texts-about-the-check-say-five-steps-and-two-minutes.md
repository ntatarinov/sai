# ISS-0101 — Texts about `npm run check` are behind: "about 2 minutes" in the root README and in the pre-push hook, five stages in the role file of TEST-RUNNER

Серьёзность: LOW. Статус: open. Найдено: CODE-DESIGNER (проект REQ-104, раздел 18 и вопрос О7(c)), RELEASE-VALIDATOR (шаг 09, I3), прогон `E2E104-20261103-01`, 2026-11-03; заведено DOC-UPDATER (шаг 10), 2026-11-03. Пункт планки: Q3 (честность текстов), Q4 (команда описана верно), Q14 (документы не отстают). Требования: REQ-030 (сделано; он держит эту фразу тестом), REQ-104 (сделано; добавил шестой шаг).

## Что не так

1. **The time.** The root `README.md` (section on the check on GitHub and before a push, line 306) says `cd tools && npm run check` takes "about 2 minutes", and the hook `.githooks/pre-push` prints «около 2 минут» (line 36). The measured time of the whole command is 262 s (4 min 22 s) on the main computer (TEST-RUNNER, `handoffs/E2E104-20261103-01/step-06-test-runner.json`) and 836 s (13 min 56 s) on GitHub (RELEASE-VALIDATOR, run on a temporary branch). The statement was already not true on the base tag: the full `npm test` alone took 235.8 s there. The sentence cannot be changed by one text edit: `tools/test/repo.test.js` (`README_WORDS`, line 1124; test `RD-2`) requires the exact words "about 2 minutes" in that README section, so a changed README turns the check red. That is why DOC-UPDATER of the run did not edit it (the instruction of the step asked for the correction by hand; the conflict was found while doing it).
2. **The number of stages in a role file.** `.claude/agents/test-runner.md`, item 3 "Stages", lists five stages of `npm run check` and ends at `test` (`node --test`). The command has six: `npm run e2e` (the real-Chrome tests) is the last one. The file was outside the write set of the run.

## Доказательство

- `grep -n 'about 2 minutes' README.md tools/test/repo.test.js` gives `README.md:306` and `tools/test/repo.test.js:1124`; `grep -n 'около 2 минут' .githooks/pre-push` gives line 36.
- The measured time: `handoffs/E2E104-20261103-01/step-06-test-runner.json` (`result.summary.step_durations_s`, total 262.2 s); `handoffs/E2E104-20261103-01/step-09-release-validator.json` (`self_check`, «GITHUB, second try»: job 836 s).
- `grep -n 'Stages' -A4 .claude/agents/test-runner.md` lists the five names; `node -p "require('./tools/package.json').scripts.check"` gives six steps.

## Как исправить

1. One WF-03 run that changes the three texts and the test row together: README and hook say a measured figure with its limits («about 5 minutes on the main computer and about 14 minutes on GitHub», or a sentence without a number that points to `gh run list --workflow check.yml`), `README_WORDS` of `repo.test.js` (RD-2) changes its 13th word with the same figure — a replaced word, never a removed one (Q6), the line of the hook is not pinned by a test (PH-2 does not read that word), it is changed in the same run. Whether a number stays in the text at all is a choice for the author of the fix: a figure goes stale again with the next requirement (REQ-105…107 add to the e2e part).
2. `.claude/agents/test-runner.md`, item 3: add `e2e` as the sixth stage (a role file; the owner of the role files is ORCH or the run that holds them in its write set).

Regression check: `grep -c 'about 2 minutes' README.md` gives 0 after the fix and `cd tools && node --test test/repo.test.js` exits 0.

## Маршрут

WF-03, small. Item 2 can ride with any run that holds `.claude/agents/` in its write set.
