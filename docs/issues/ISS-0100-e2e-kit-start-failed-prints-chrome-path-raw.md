# ISS-0100 — The e2e kit: the message START_FAILED prints the path of the program from SAI_CHROME as it is, without the cut and the escape that other operator text gets

Серьёзность: LOW. Статус: open. Найдено: SECURITY-REVIEWER (шаг 04c, I1), CODE-FIXER (шаг 04e, I2, оставлено по приказу), TEST-DESIGNER (шаг 05, I4), RELEASE-VALIDATOR (шаг 09, L1), прогон `E2E104-20261103-01`, 2026-11-03; заведено DOC-UPDATER (шаг 10), 2026-11-03. Пункт планки: Q10 (понятное сообщение об ошибке и чистое состояние), Q7 (в журнал и в вывод не идёт неочищенный текст). Требования: REQ-104 (сделано).

## Что не так

In `tools/test/e2e/kit/browser.js` the message of the error `START_FAILED` is built in two places (lines 194 and 247):

```
could not start "${found.path}": ${err.code ?? "error"}
```

`found.path` is the text of the variable `SAI_CHROME` (or a path found in one of the five places). All other text that comes from the operator or from a page goes through `safeText(text, limit)` of `tools/test/e2e/kit/errors.js` (control characters escaped, a line start `::` of the workflow commands neutralised, the length cut): the argument list, the selection, the lookup messages of `findChrome`, the last stderr line of Chrome (line 272). These two places were left out. The path must be an absolute path of an existing executable file (`findChrome` refuses anything else), so a line break or a leading `::` can stand only in a file name made by the person who runs the check on his own computer, and the effect is a broken log line, not a leak. It is a gap in the rule "one mechanism in all neighbouring places", not an exploitable hole. Nobody can fix it inside the closed run: the gates accepted it as Low.

## Доказательство

- `grep -n 'could not start' tools/test/e2e/kit/browser.js` gives lines 194 and 247; `grep -n 'safeText' tools/test/e2e/kit/browser.js` has no hit on those lines.
- Not run with a control character in the path (the validator read the source). To reproduce: make an executable file whose name holds a line break, set `SAI_CHROME` to it so that the program starts and ends at once, run `cd tools && npm run -s e2e`, and look at the message of `START_FAILED`: the name is printed raw.
- Where the test goes: `tools/test/e2e-kit.test.js`, next to `E2K-42` (it pins the runner output) and `E2K-26` (it pins `safeText` for the other places).

## Как исправить

Pass `found.path` through `safeText(found.path, 300)` in both places and add a row to `E2K-26` (or `E2K-42`) with a stand-in file whose name holds a line break and a leading `::`; the row must fail on the old code. A WF-03 run (ISSUE-FIXER is not needed: the cause is known; CODE-DESIGNER can be a short note, BACKEND-DEV or CODE-FIXER writes the two lines, TEST-DESIGNER the row).

Regression check: the new row fails on a copy of the tag `base/<RUN-ID>` of that run and passes after the fix.

## Маршрут

WF-03. Can ride with ISS-0102 (the same files: the kit and its test file).
