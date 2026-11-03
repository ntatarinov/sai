# ISS-0104 — The source guard E2K-63 has known limits (false red on a shortened title, false green on a hidden assertion) and two mutants of E2K-62 survive

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGN-VALIDATOR (шаг 07c, находки о E2K-63 и мутанты M20, M21), RELEASE-VALIDATOR (шаг 09, находки LOW), прогон `ISS-0103-20261103-01`, 2026-11-03; заведено DOC-UPDATER (шаг 10), 2026-11-03T19:35:10Z. Пункт планки: Q5 (тест ловит поломку и не краснеет без причины), Q3 (честность проверки). Требования: REQ-104 (сделано), поломка в его тестах; связан с закрытым ISS-0103 (это его охранный тест). Решение: `docs/quality-bar.md`, раздел 6, п. 6 (найденное по пути выносится в отдельный дефект).

## Что не так

The guard test E2K-63 (`tools/test/e2e-kit.test.js`) reads the text of E2K-18 and E2K-38 and requires the bounded wait `waitGone` at the call sites that wait for a killed stand-in (ISS-0103). It catches the accidental regressions (the wait removed, a single check, a tiny limit, a renamed helper: red with the test and the line). The gates accepted it as a guard of a source text and named these limits, which are recorded here so that nobody reads E2K-63 as more than it is:

1. **False red on a harmless edit (body cut).** The body of a test is cut at the first line `^);`. When a title of E2K-18 or E2K-38 is shortened so that prettier writes `test("...", LIMIT, async () => {` on one line (the closing line is then `});`), or at print width 120, the body runs into the following tests and E2K-63 reports a long false failure (checked in a copy: title `E2K-18 no leftovers` plus `prettier --write` gives `E2K-18 line 1048: expected 1 ... found 1 of 8 calls`). Other harmless edits are red as well: a limit through a named constant, an extra `pidGone(` read in the two bodies, a trailing comment that mentions `waitGone(`. All are red in the safe direction; the message gives the test and the line but not the reason.
2. **False green on a hostile edit (comments).** Only whole-line `//` comments are blanked. A required assertion replaced by the same text in a trailing `//` comment, in a `/* */` comment, in a string or template literal, under `if (false)` or in an arrow that is never called keeps E2K-63 green (the gate's cases P1-P5); the test then no longer waits at all. The place of the assertion relative to the kill is not checked either.
3. **Two surviving mutants of E2K-62.** M20 (the assertion that the hold is still pending is removed) and M21 (the lower bound of the live case is removed) survive; other assertions of the same test cover them; the gate called them low and not equivalent-critical.

## Доказательство

`handoffs/ISS-0103-20261103-01/step-07c-test-design-validator.json` (summary, findings 1-4, 56 mutant runs, cases N1-N19 and P1-P13 around E2K-63); `handoffs/ISS-0103-20261103-01/step-09-release-validator.json` (`findings`, issues V1). To see item 1: shorten the title of E2K-18 by hand in a copy of the file, run `npx prettier --write` on the copy and `node --test --test-name-pattern "E2K-63" test/e2e-kit.test.js`.

## Как исправить

A later job for TEST-FIXER, not urgent (the accidental regression is caught today): (1) cut the body of a test at the next line that starts a `test(` (or at `^}?\);` of the same call), not at `^);`; (2) blank trailing `//` and `/* */` comments and the contents of strings and template literals (keep offsets and line numbers) and ask for the assertion at the statement level of the loop or scenario body; or accept both as the known limits of a source guard and keep this record; (3) add to the message of E2K-63 one sentence: the guard reads the source, and the allowed list in E2K-63 is updated when the change is intended; (4) for M20 and M21: either one assertion each in E2K-62 or a recorded reason that the other assertions cover them. A weaker guard, a skip or a deletion of E2K-63 is not a fix (Q6).

## Маршрут

A WF-03 job for TEST-FIXER (steps 6-9), best together with the next change of `tools/test/e2e-kit.test.js` (REQ-105), not on its own.
