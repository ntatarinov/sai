# ISS-0096 — REQ-005, criterion 8: step 3 of the run BP-20261003-01 passed on the sixth run, past the rework limit, by an ORCH decision and not an owner exception
Серьёзность: HIGH. Статус: closed, 2026-10-28, закрыт исключением владельца (decisions/0104), не исправлением. Найдено: AUD-001, RELEASE-VALIDATOR (находка REQ-005-F1, перепроверена AUDIT-COMPILER), 2026-10-27; заведено AUDIT-TRIAGE, 2026-10-28. Пункт планки: Q14 (`docs/quality-bar.md` §1, п. 3: исключение даёт только владелец, письменно). Требования: REQ-005 (критерий 8).

## Что не так

REQ-005 is `done`, but criterion 8 (`docs/requirements.yaml:464`) is not met as written: «эскалация не засчитывается: после второй доработки с FAIL статус — blocked». Step 3 (PLAN-VALIDATOR) of the run `BP-20261003-01` returned FAIL five times (the first run and rework r1 to r4) and passed only on the sixth run; after the second FAIL the status should have become `blocked`. The limit was passed by `decisions/0010-bp-rework-limit-exceeded.md`, which reads «Статус: принято (2026-10-05, ORCH). Владелец может отменить.» It cites words of the owner, but it is a decision of ORCH, not a separate record of the owner with a reason and a time limit (quality bar §1, item 3). The other eight criteria of REQ-005 are met.

## Доказательство

- `jq .status,.result.verdict handoffs/BP-20261003-01/step-03-plan-validator*.json`: FAIL, r1 FAIL, r2 FAIL, r3 FAIL, r4 FAIL, r5 PASS, r6 PASS.
- `head -4 decisions/0010-bp-rework-limit-exceeded.md` — the status line above.
- Details: `docs/audits/AUD-001/requirements/REQ-005.json` (criterion 8, status «not met», 8 of 9 met) and `docs/audits/AUD-001/report.json`, REQ-005-F1, field `recheck`.

## Как исправить

One item (High, no Critical). This needs a decision of the owner; the fixer does not take it:

1. The owner confirms `decisions/0010` as an owner exception in writing (a record in `decisions/` with the reason and the time limit), and DOC-UPDATER names that record in the status comment of REQ-005 in `docs/requirements.yaml` and notes that criterion 8 is met only through `decisions/0010`; or
2. REQ-005 returns to `in_progress` (the criterion is not met), and the criterion is brought in line with what the owner decides.

Files: `docs/requirements.yaml` (REQ-005, status comment and, if the owner decides so, criterion 8), `decisions/0010-bp-rework-limit-exceeded.md` or a new record next to it. No code.

Regression check (a command): `jq -r '.result.verdict' handoffs/<RUN-ID>/step-NN-<role>*.json` for any run with a rework limit never shows more reworks than the criterion allows without a record of the owner named in the requirement; for `BP-20261003-01` the status line of REQ-005 names the record.

## Маршрут

WF-03. Step 1 — reproduction by ISSUE-FIXER (the jq command above, and the other runs that use a limit of two reworks, AP-014). The owner decides between the two ways; then DOC-UPDATER, RELEASE-VALIDATOR re-checks REQ-005 as a whole (steps 9-10), ORCH checks the fields.

## Закрыто

Закрыто 2026-10-28 (2026-10-28T12:16:42Z, время с часов), прогон `M0EXC-20261028-01` (WF-01, запись исключения владельца, DOC-UPDATER). Итог: **закрыт исключением владельца (`decisions/0104`), а не исправлением**. Лимит критерия 8 в прогоне `BP-20261003-01` был превышен (шаг 3 прошёл с шестого запуска при лимите «blocked после второй доработки»), и это не исправлено — прошлое не переделывается.

- **Что сделано:** владелец (его слова записаны в `decisions/0104-owner-exception-req005-criterion8.md`, ответ «Записать только для этих прогонов (Рекомендую)», вариант A) своим письменным исключением принял превышение для одного прогона `BP-20261003-01` и одного критерия — критерия 8 REQ-005. `decisions/0010` не менялась (это было решение ORCH; владелец дал исключение сам, как требует п. 3 раздела 1 планки). В `docs/requirements.yaml` изменена только строка `status` блока REQ-005: `in_progress` -> `done`, комментарий называет `decisions/0104`, критерий, прогон и прямо говорит, что критерий 8 для этого прогона держится на исключении владельца, а не на соблюдённом лимите; прежний комментарий оставлен после «прежде:». Текст критериев не менялся.
- **Что не сделано (честно):** лимит в этом прогоне не соблюдён и задним числом не «соблюдён»; нового PASS RELEASE-VALIDATOR по критерию 8 нет — остальные восемь критериев REQ-005 аудит нашёл выполненными (`docs/audits/AUD-001/requirements/REQ-005.json`). Кода и теста исправления нет.
- **Что остаётся в силе:** исключение действует только для прогона `BP-20261003-01`. Каждый следующий прогон держит лимит критерия 8 (после второй доработки с FAIL статус `blocked`); проверка — команда из раздела «Как исправить»: `jq -r '.result.verdict' handoffs/<RUN-ID>/step-NN-<role>*.json` не показывает больше доработок, чем разрешает критерий, без записи владельца.
