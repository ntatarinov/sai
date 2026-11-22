# ISS-0140 — A wrong call of a program without a help, below the Node floor: README line 9 says it is answered as on any Node, the design puts the guard before the parse of the arguments

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGN-VALIDATOR (шаг 07, находка F2, прогон `ISS-0092-20261117-01`) и REVIEWER (шаг 05b, вопрос I3); заведено ORCH, 2026-11-22T20:50:00Z. Пункт планки: Q12 (документы и код согласованы).
Требования: REQ-110 (the Node floor of the tools); decisions/0120 О5.

## Что не так

- tools/README.md line 9 says that `--help` and a wrong call are answered as on any Node. That holds for the five programs that parse their arguments before their help. For the programs with no help (the team web server main.js, the team cli.js, the office report script: E1, E4, E5, E10, E11 of the design) the guard stands before the parse of the arguments by design section 3, so a wrong call below the floor is answered by the refusal line of the guard, not by the usage line.
- The tests of the fix use valid calls for these programs, so a guard moved behind the pure parse survives the mutants A-E5, W-E1 and W-E11 (the only effect: the usage line instead of the refusal line; nothing is written or exposed either way). The test designer did not add the rows because they would contradict README line 9.

## Доказательство

handoffs/ISS-0092-20261117-01/step-07-test-design-validator.json (finding F2), step-06b-test-designer.json (issue I1), step-05b-reviewer.json (issue I3); docs/design/REQ-110-tools-node-floor.md section 3.

## Как исправить

1. A dated addendum to decisions/0120 О5 (or a new decision) that names the five programs where a wrong call is answered as on any Node and the three where it is answered by the refusal; README line 9 reworded to say the same (the tests find the README lines of REQ-110 by anchor: read tools/test/node-floor.test.js before editing the README and keep the anchored lines).
2. Then three twin rows (one line each) in NF-05 with a wrong call under the old Node for A-E5, W-E1 and W-E11, each expecting the refusal line.

## Маршрут

DOC-UPDATER for the texts after the ISS-0092 run is released, then TEST-DESIGNER for the rows (WF-03, tests only). Low: nothing is written or exposed by the wrong ordering.
