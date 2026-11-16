# ISS-0110 — `safeText` of the e2e kit lets the bidirectional control characters through into error messages and log lines

Серьёзность: LOW. Статус: open. Найдено: SECURITY-REVIEWER (шаг 03, issue I5, проба 6), прогон `E2E105-20261105-01`, 2026-11-08; подтверждено чтением кода и вызовом функции и заведено DOC-UPDATER (шаг 10b), 2026-11-15T17:03:00Z. Пункт планки: Q10 (понятное сообщение: текст, которым управляет страница, браузер или запущенный процесс, попадает в сообщение и в журнал только очищенным), Q5 (тест держит правило). Требования: REQ-104 (сделано; `tools/test/e2e/kit/errors.js`), REQ-105 (сделано; `stand.js` выводит через него строку stderr стенда). Решение: `docs/quality-bar.md`, раздел 6, п. 6 (найденное по пути выносится в отдельный дефект); `decisions/0108`, дополнение о тексте, экранированном и ограниченном по длине. Связан с ISS-0100 (сырой текст в сообщении того же набора).

## Что не так

`safeText(value, max)` in `tools/test/e2e/kit/errors.js` makes text that a page, the browser or a started process controls safe to put into an error message or a log line: it cuts it, escapes every control character and neutralises a leading `::`. Its test of a control character (`isControl`) covers only C0 (below 32), DEL and C1 (127–159), U+2028 and U+2029. The bidirectional control characters pass unchanged: U+202A–U+202E (embeddings and overrides), U+2066–U+2069 (isolates), and also U+200E, U+200F (the marks) and U+061C. A terminal or a log viewer may show a line that holds them reordered, so a message of the kit (for example `STAND_EXIT … Last line of its stderr: "…"` of `stand.js`, a `CONSOLE_ENTRIES` line with a page's text, the runner's lines with the argument list) can read differently from its bytes.

Shown twice: SECURITY-REVIEWER, trial 6 of step 03 — a stand's stderr line with U+202E stood unchanged inside `STAND_EXIT`; and at step 10b, from `tools/`: `node --input-type=module -e` calling `safeText("a\u202Eb\u2066c\u2069d\u200Fe\u061Cf\u2028g")` returned the text with U+202E, U+2066, U+2069, U+200F and U+061C unchanged and only U+2028 escaped (`\u2028`).

Why LOW: the text reaches only the console of the person who runs the check and the job log; it changes how a line is shown, not what is run, and every such message still names its code and is bounded in length.

## Доказательство

- `handoffs/E2E105-20261105-01/step-03-security-reviewer.json` — issue I5 (trial 6; «a candidate for the shared helper, not for this run»).
- `tools/test/e2e/kit/errors.js` — `isControl` and `safeText` (read at step 10b).
- To repeat, from `tools/`: `node --input-type=module -e 'import { safeText } from "./test/e2e/kit/errors.js"; console.log(JSON.stringify(safeText("a\u202Eb")))'` prints the U+202E character itself, not an escape.

## Как исправить

Extend `isControl` (or the escape rule of `safeText`) to the bidirectional controls U+061C, U+200E, U+200F, U+202A–U+202E and U+2066–U+2069, written as `\uXXXX` like the other controls; add rows to `E2K-26` (the test that pins `safeText`) with each range, red on the old code; check that no caller relied on the old form (the runner lines of `E2K-42`, the messages of `E2S-06`, `E2S-09`, `E2S-20`). Whether other invisible format characters (Cf, the list of `decisions/0076` for the tenant texts) belong to the same rule is a choice for the design of the fix. A weaker test or a skip is not a fix (Q6).

## Маршрут

WF-03 for BACKEND-DEV with SECURITY-REVIEWER and REVIEWER, then TEST-DESIGNER for the rows; can ride with ISS-0100 (the same rule «text of the operator or a page through `safeText`»), ISS-0107 and ISS-0109. On ORCH's order.

## Обновление 2026-11-16 (DOC-UPDATER, прогон `E2E106-20261115-01`, шаг 10): ещё одно место вызова — `STAND_HOME_WRITTEN`

REQ-106 added one more caller of `safeText` to the starter (`decisions/0112` О1, О20): `stop()` of `tools/test/e2e/kit/stand.js` throws `STAND_HOME_WRITTEN` `<name> wrote into its own home folder: <the first five entries>`, the entry names of the stand's private home joined by `, ` and passed through `safeText(…, 200)` (lines 355–361, read as text at step 10). The names are made by the started server, so they are text that a started process controls. Confirmed twice in the run: SECURITY-REVIEWER (`handoffs/E2E106-20261115-01/step-03-security-reviewer.json`, finding F1) called `safeText` from a clone — a newline is escaped and a leading `::` neutralised, but U+202E and U+2066 pass unescaped; REVIEWER (`handoffs/E2E106-20261115-01/step-04-reviewer.json`, issue I3, trial t3, case 2) made a home entry whose name holds U+202E, and it reached the `STAND_HOME_WRITTEN` message unescaped (U+0007 was escaped). The fix described above covers this caller with no change of its own; the rows of the fix should include a home entry name with a bidirectional control (in `E2S-21`, or in `E2K-26` for `safeText` itself). The defect stays `open`.
