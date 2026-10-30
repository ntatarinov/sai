# ISS-0094 — REQ-003 is `done` with a status line that cites a RELEASE-VALIDATOR PASS that has no record
Серьёзность: HIGH. Статус: closed, 2026-10-28. Найдено: AUD-001, DOC-AUDITOR (находка DOC-01, перепроверена AUDIT-COMPILER), 2026-10-27; заведено AUDIT-TRIAGE, 2026-10-28. Пункт планки: Q14 (а также Q2, Q3: `done` только после независимого PASS). Требования: REQ-003. Родственный: ISS-0095 (тот же прогон, другое требование).

## Что не так

`docs/requirements.yaml:361` (REQ-003) reads `status: done   # RELEASE-VALIDATOR PASS 2026-09-28; прогон WF06-20260926-01`. The run folder `handoffs/WF06-20260926-01/` has no RELEASE-VALIDATOR step, and no handoff of any run names REQ-003 as checked by RELEASE-VALIDATOR. The PASS that the status line cites has no record, so the status `done` stands on a statement only (Q2: who makes it does not check it).

The behaviour is not the problem: this audit's own re-check by RELEASE-VALIDATOR found all 3 criteria of REQ-003 met (`docs/audits/AUD-001/requirements/REQ-003.json`, 2026-10-27). What is left is the record.

## Доказательство

- `sed -n 361p docs/requirements.yaml` — the status line above.
- `ls handoffs/WF06-20260926-01/` — steps 00 (ORCH), 01-03 (IDEA-ANALYST), 04 (IDEA-JUDGE, `-v2`), 05 (VERDICT-EXECUTOR, `-v2`), 10 (ORCH), 11 (REQ-ANALYST), 12 (BA-ANALYST): no `release-validator` file.
- A script over all handoffs (`to_agent` RELEASE-VALIDATOR, `result.verdict` PASS, `context.requirement_ids` containing REQ-003) finds 0. `grep -l REQ-003 handoffs/*/*release-validator*.json` finds only `handoffs/ISS-0002-20261011-01/step-09-release-validator.json` (its requirements are REQ-002 and REQ-004) and the pending AUD-001 step. The other 32 requirements in `done` each have at least one RELEASE-VALIDATOR PASS and one DOC-UPDATER handoff.
- Details: `docs/audits/AUD-001/report.json`, DOC-01, field `recheck`.

## Как исправить

One item (High, no Critical). Choose one of two ways; the choice is ORCH's and is recorded in the handoff of the fix:

1. DOC-UPDATER writes into the status comment of REQ-003 in `docs/requirements.yaml` the real basis of `done`: the re-check of AUD-001 (RELEASE-VALIDATOR, `docs/audits/AUD-001/requirements/REQ-003.json`, 2026-10-27, 3 of 3 criteria met), and says honestly that the PASS of 2026-09-28 has no record; the false reference is removed. Or
2. DOC-UPDATER returns REQ-003 to `in_progress` until a RELEASE-VALIDATOR PASS with a handoff exists, and RELEASE-VALIDATOR gives it (WF-03, steps 9-10).

Regression check (a command, not a new product test): the jq loop above finds a RELEASE-VALIDATOR PASS handoff for REQ-003, or the status line of REQ-003 cites only a record that exists (`ls` of the file named). Look at the other `done` requirements whose status comments cite a PASS and run (AP-014): the audit found 32 with a record, but the check of the comment against the file is not repeated here.

## Маршрут

WF-03. Step 1 — reproduction by ISSUE-FIXER (the commands above, and the same check for every requirement whose status line names a RELEASE-VALIDATOR PASS). Then the route that WF-03 sets for a bookkeeping fix: DOC-UPDATER and RELEASE-VALIDATOR, ORCH checks the fields. Do it together with ISS-0095: both come from the run `WF06-20260926-01`.

## Закрыто

Закрыто 2026-10-28T04:37:35Z (время с часов), прогон `ISS-0094-20261028-01` (WF-03, шаг 10, DOC-UPDATER после PASS RELEASE-VALIDATOR). Итог: причина устранена исправлением записи; новая запись независимой проверки есть; нового автоматического теста нет.

- **Что сделано:** выбран путь 1 из раздела «Как исправить» (выбор дал ORCH в задании шага 02). В `docs/requirements.yaml` изменён только комментарий строки `status` блока REQ-003 (статус остаётся `done`): он ссылается на запись, которая есть, — `handoffs/ISS-0094-20261028-01/step-01-release-validator.json` (RELEASE-VALIDATOR, PASS, 2026-10-28T04:35:03Z, три критерия из трёх выполнены) и на перепроверку AUD-001 (`docs/audits/AUD-001/requirements/REQ-003.json`, 2026-10-27, три из трёх); сказано прямо, что PASS 2026-09-28 из прежнего комментария записи не имеет, и прежний текст оставлен после «прежде:». Остальной текст файла не менялся: sha256 файла без строк `status` одинаков до и после (`0b6ca032…360fcc`), diff — одна строка 361.
- **Чем проверено:** RELEASE-VALIDATOR выполнил каждый критерий REQ-003 сам: поиски по заголовкам и строкам Step 0…7, по трём файлам ролей и `orchestrator.md`, чтение разделов «Reading scope» и строки-исключения в `CLAUDE.md`, `test/repo.test.js` на копии — 26 из 26, красных 0, пропущено 0 (тесты REQ-003 AC1, AC2, AC3 — ok); восемь порч файлов на копии тест поймал. Скрипт по 1223 записям: PASS RELEASE-VALIDATOR с REQ-003 в `requirement_ids` было 0, в датах 2026-09-28 записей RELEASE-VALIDATOR нет, в прогоне `WF06-20260926-01` шага RELEASE-VALIDATOR нет.
- **Сверка «каждое готовое требование со ссылкой на PASS имеет запись»** (скрипт RELEASE-VALIDATOR, `result.self_check.scripts` в его записи, я прогнал его тем же текстом после правки): из 30 требований в статусе `done` запись PASS RELEASE-VALIDATOR была у 29 (без неё только REQ-003), теперь у 30 из 30; ссылок на несуществующие записи в комментариях статуса `done` — 0.
- **Регрессионная проверка:** это команда, не тест в `npm run check` — тот же скрипт (`rv-status.mjs`) должен печатать «done without any RV PASS handoff naming them: []». Автоматического теста на это нет, и дефект закрыт без него; предложение RELEASE-VALIDATOR (I3) добавить такую сверку в проверку ORCH перед DONE не принято и не оформлено — решает владелец.
- **Честно об оговорках:** (1) PASS 2026-09-28 записи так и не получил и не получит — его нельзя восстановить, поэтому `done` теперь стоит на PASS 2026-10-28, а не на нём. (2) RELEASE-VALIDATOR по заданию не запускал `npm run check` (Q4), а прогнал только `test/repo.test.js`; последний полный прогон — аудит AUD-001, 2026-10-27, 2065 из 2065 (не его проверка). (3) Рабочее дерево в момент проверки содержало чужие правки (REQ-004, REQ-005, REQ-061 возвращены в `in_progress` по аудиту); блок REQ-003 они не затрагивают.
