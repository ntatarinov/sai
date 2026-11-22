# ISS-0142 — The test id SV-68 names two tests, and the refusal line for an unprintable Node version is ungrammatical Russian

Серьёзность: LOW. Статус: open. Найдено: RELEASE-VALIDATOR (шаг 09, находки F2 и F3, прогон `ISS-0092-20261117-01`); заведено DOC-UPDATER, 2026-11-22T21:27:22Z. Пункт планки: Q5 (тест находится по номеру) и Q12 (текст читаем).
Требования: REQ-110 (the Node floor of the tools); no criterion depends on either point.

## Что не так

1. **A duplicate test id.** `grep -rn 'SV-68' tools/test` finds two different tests: the header-count canary of the ISS-0092 work, `tools/test/pixel-office-server.test.js` line 2289, and the silent-server test of REQ-008, `tools/test/pixel-office-note.test.js` line 293. Both pass; a grep by the id finds two tests. The ids SV-69 and SV-70 are taken too; the next free one is read by grep when the rename is made (SV-71 on 2026-11-22). The design `docs/design/REQ-110-tools-node-floor.md` names the canary «SV-68» in its sections 9.3, 10 and 13 and its rows, and `tools/test/node-floor.test.js` may refer to it.
2. **An ungrammatical Russian line.** `tools/src/node-floor.js`, `nodeFloorRefusal`, for a version text that Node never gives (one that does not match `^[0-9A-Za-z.+-]{1,64}$`, for example a text with a line end) shows the constant `UNKNOWN_VERSION` = «неизвестная версия» after «а запущен», so the line reads «… а запущен неизвестная версия: …» (the right form is «а запущена неизвестная версия» or «а версия неизвестна»). The line is one line and holds no foreign value, so Q7 is met; this is a wording nit. The tests NF-04 (`tools/test/node-floor.test.js` lines 513 and 523) look for the text «неизвестная версия» in it, so the same edit goes to them.

## Доказательство

`handoffs/ISS-0092-20261117-01/step-09-release-validator.json` (findings F2 and F3, with the own call of the module on `"22.21.1\nSECRET=abc"`).

## Как исправить

1. Rename the canary to the next free SV id (and the references in the design's rows of this work) in a test-only run; the REQ-008 test keeps SV-68 (it is older).
2. Fix the words in `tools/src/node-floor.js` and in the two assertions of NF-04 in the same change (a CODE-FIXER edit with the TEST-DESIGNER rows; the guard itself is unchanged).

## Маршрут

TEST-DESIGNER (test-only, WF-03 route for tests) for item 1; CODE-FIXER with TEST-DESIGNER for item 2, if the owner wants the wording changed. Low: both tests pass and the refusal is one plain line.
