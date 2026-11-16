# ISS-0113 — No test pins that the Pixel Office hook takes its time stamp as its first action

Серьёзность: LOW. Статус: open. Найдено: CODE-DESIGN-VALIDATOR (шаг 01b, issue I4, мутант V-P05), прогон `E2E106-20261115-01`, 2026-11-15; заведено DOC-UPDATER (шаг 10), 2026-11-16T01:08:45Z. Пункт планки: Q5 (у каждого критерия есть тест, который ловит поломку), R2 (время события — момент срабатывания хука). Требования: REQ-001 (критерий 2: «время — момент срабатывания хука, без вычисленных смещений»; статус `blocked` по `decisions/0099`), вне REQ-106. Решение: `docs/quality-bar.md`, раздел 6, п. 6 (найденное по пути выносится в отдельный дефект).

## Что не так

`tools/src/pixel-office/hook.js` takes the time of the event as its first action: line 12, `const firedAt = new Date().toISOString();`, under the comment «First action: the moment the hook fired. The input has no time field; the time is never recalculated or shifted afterwards (REQ-001, criterion 2)»; the value goes into the signed body at line 81 (`buildWriteBody(…, firedAt, …)`). No test pins that order. The gate's mutant V-P05 (the stamp taken after the hook has read its input) survives the spec `tools/test/e2e/pixel-office.e2e.js` and the tests of `tools/test/pixel-office-hook.test.js` (the gate's run: 50 of 50 green). The spec cannot see it: test `journal` asserts that the time lies inside the window of its own hook run (`decisions/0112` О7), and a stamp taken a few milliseconds later still lies there.

Why LOW: the difference is the time the hook needs to read its input — milliseconds; the stamp still comes from the clock of the owner's computer at the run of the hook, never from the payload, and the server keeps it byte for byte (`SV-04b`). It is a criterion of the bar R2 that no test holds, not a wrong time on the page.

## Доказательство

- `handoffs/E2E106-20261115-01/step-01b-code-design-validator.json` — issue I4 («the hook stamps the time as its first action … but no test pins it: my V-P05 (the stamp taken after the input is read) survives the spec and all 50 tests of pixel-office-hook.test.js»), `self_check.mutants` (V-P05).
- `tools/src/pixel-office/hook.js`, lines 10–12 and 81 (read as text at step 10).
- To repeat, in a copy outside the project: move the line `const firedAt = …` of `hook.js` to after the read of the input and run `cd tools && node --test test/pixel-office-hook.test.js`: green.

## Как исправить

A WF-03 run of TEST-DESIGNER: a test of `pixel-office-hook.test.js` that holds the input of the hook back (the test writes the payload to the hook's stdin only after a delay it measures, for example 300 ms) and asserts that the stored `time` lies before the moment the test began to write the input; red under V-P05, green on today's code. The test waits for facts it can read, with a limit (AP-144). Pixel Office itself is not changed unless the test finds a real defect. A weaker test or a skip is not a fix (Q6).

## Маршрут

WF-03 for TEST-DESIGNER (tests only), with TEST-DESIGN-VALIDATOR; can ride with the acceptance of REQ-001 or with the next change of the Pixel Office tests; on ORCH's order.
