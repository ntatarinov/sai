# ISS-0095 — REQ-004, criterion 4: the snapshot-diff output after step 6 of the run WF06-20260926-01 is not in the records
Серьёзность: HIGH. Статус: closed, 2026-10-28, закрыт исключением владельца (decisions/0103), не исправлением. Найдено: AUD-001, RELEASE-VALIDATOR (находка REQ-004-F1, перепроверена AUDIT-COMPILER), 2026-10-27; заведено AUDIT-TRIAGE, 2026-10-28. Пункт планки: Q3, Q14. Требования: REQ-004 (критерий 4). Родственный: ISS-0094 (тот же прогон, другое требование).

## Что не так

REQ-004 is `done`, but criterion 4 (`docs/requirements.yaml:407`) is not met as written. It asks for the output of `snapshot-diff` between the snapshot before step 0 and the snapshot right after step 6 (before the status updates of the requirements and `docs/anti-patterns.md`), with changes only in `runs/<RUN-ID>/`, `handoffs/<RUN-ID>/` and `STATE.md`, «вывод приложен». The records of the run `WF06-20260926-01` hold only the note about the before-snapshot (`step-00-orch.json`: «127 files, stored outside the project») and a line on the protocol page «snapshot-diff — код 0 (менялись только папка прогона, его handoff-ы и STATE.md)» without the output. The run has no RELEASE-VALIDATOR step; the later PASS (`handoffs/ISS-0002-20261011-01/step-09-release-validator.json`) checked the code of that defect, not this output. The proof that the run touched nothing else (R2) rests on one summary statement. The other three criteria of REQ-004 are met.

## Доказательство

- `ls handoffs/WF06-20260926-01/` — steps 00 to 12, no RELEASE-VALIDATOR file; `ls runs/WF06-20260926-01/`.
- `grep -l snapshot-diff` over the handoffs of the run finds `step-00-orch.json` only (the before-snapshot).
- `reports/WF06-20260926-01-protocol.html` states «snapshot-diff — код 0» without the output.
- Details: `docs/audits/AUD-001/requirements/REQ-004.json` (criterion 4, status «not met») and `docs/audits/AUD-001/report.json`, REQ-004-F1, field `recheck`.

## Как исправить

One item (High, no Critical). Two ways; ORCH decides, with the owner where a criterion text changes:

1. Restore the evidence: if the after-step-6 snapshot or the output of `snapshot-diff` exists anywhere (the stored before-snapshot, a copy of the run, a terminal log), add it to the records of the run; or
2. Record honestly in REQ-004 (through WF-01: REQ-ANALYST, REQ-VALIDATOR) that criterion 4 for this run is met only by a summary statement, and DOC-UPDATER notes it in the status line of REQ-004. The old evidence cannot be made up after the fact (R2, Q3): nothing is written into the run records that did not exist.

Files: `docs/requirements.yaml` (REQ-004, criterion 4 and the status comment), the run folder `handoffs/WF06-20260926-01/` only if real evidence is found.

Regression check: for each later run that has a `snapshot-diff` criterion, the output is in a handoff (`grep -l snapshot-diff handoffs/<RUN-ID>/*.json`); the criterion of REQ-006 (criterion 14) names the same check, and its run is looked at in the same pass (AP-014).

## Маршрут

WF-03. Step 1 — reproduction by ISSUE-FIXER (the commands above; a search for the stored before-snapshot and any after-snapshot). Then the route that WF-03 sets for a bookkeeping fix (REQ-ANALYST and REQ-VALIDATOR if the criterion text changes), RELEASE-VALIDATOR re-checks REQ-004 as a whole (steps 9-10), DOC-UPDATER, ORCH. Do it together with ISS-0094.

## Закрыто

Закрыто 2026-10-28 (2026-10-28T12:16:42Z, время с часов), прогон `M0EXC-20261028-01` (WF-01, запись исключения владельца, DOC-UPDATER). Итог: **закрыт исключением владельца (`decisions/0103`), а не исправлением**. Причина не устранена и устранена быть не может: вывод `snapshot-diff` после шага 6 прогона `WF06-20260926-01` не сохранён, восстановить его нельзя.

- **Что сделано:** владелец (его слова записаны в `decisions/0103-owner-exception-req004-criterion4.md`, ответ «Записать только для этих прогонов (Рекомендую)», вариант A) принял отсутствие этого вывода для одного прогона `WF06-20260926-01` и одного критерия — критерия 4 REQ-004. В `docs/requirements.yaml` изменена только строка `status` блока REQ-004: `in_progress` -> `done`, комментарий называет `decisions/0103`, критерий, прогон и прямо говорит, что критерий 4 для этого прогона держится на исключении, а не на сохранённом выводе; прежний комментарий оставлен после «прежде:». Текст критериев не менялся.
- **Что не сделано (честно):** вывод не восстановлен и не создан заново, в записи прогона ничего не добавлено (R2, Q3: задним числом не пишется); нового PASS RELEASE-VALIDATOR по критерию 4 нет — остальные три критерия REQ-004 аудит нашёл выполненными (`docs/audits/AUD-001/requirements/REQ-004.json`). Исправления кода или процесса нет, регрессионного теста нет и не добавлялся.
- **Что остаётся в силе:** исключение действует только для прогона `WF06-20260926-01`. Каждый следующий прогон WF-06 обязан сохранить вывод `snapshot-diff` в записях; проверка для него — `grep -l snapshot-diff handoffs/<RUN-ID>/*.json` (раздел «Как исправить»). Если вывод где-то найдётся, его можно добавить в записи как найденный, с честной датой находки.
