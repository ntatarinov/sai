# ISS-0117 — The Pixel Office spec: the tests «journal» and «mask» read `events.jsonl` before the stand stops, so a server that appends an invented event at its stop stays green

Серьёзность: LOW. Статус: open. Найдено: ISSUE-FIXER (шаг 01, issue I5, пробы POj, POjf, POk), прогон `ISS-0116-20261117-01`, 2026-11-17; решение ORCH `decisions/0114`, Д5; заведено DOC-UPDATER (шаг 10), 2026-11-17T15:45:37Z. Пункт планки: Q5 (тест держит критерий и ловит поломку), R2 (в журнале только настоящие события, без записанных задним числом). Требования: REQ-106 (сделано; `tools/test/e2e/pixel-office.e2e.js`, критерии 3 и 4). Решение: `decisions/0114`, Д5 (найдено по пути; этот прогон не расширяется, WF-03, «Findings on the way»).

## Что не так

The same end-before-stop kind as L1 of `docs/issues/ISS-0116-team-page-spec-low-gaps.md`, in another spec. In `tools/test/e2e/pixel-office.e2e.js` two tests read the journal file of their own temporary state folder only inside the body of `withStand`, that is, before the stand stops:

1. **«journal» (criterion 3 of REQ-106).** It reads `events.jsonl` at line 673 (`const stored = lines(path.join(folders.office, "events.jsonl"))`) and asserts 3 lines with their kinds, source, session, agent and time. No reading follows the stop. ISSUE-FIXER's probe POj (the Pixel Office server's stop handler appends one invented line to `events.jsonl` of its own test folder) leaves «journal» green. An event written after the fact is exactly what R2 forbids.
2. **«mask» (criterion 4 of REQ-106).** It reads the server's stdout and stderr (lines 760–761) and `events.jsonl` (lines 767–778) inside its stand, so a key written at shutdown is not seen. This place was read, not run.

Not of this kind (ISSUE-FIXER, step 01, issue I5): «isolated start» (its criterion is the state before any event), «untouched home» (it reads after the stop, line 795), «reconnect» (the second server reads after the first stops).

Why LOW: the hook and the server write nothing at shutdown today. It is a detection gap: a breakage of the product that the spec would not see. No test of this spec reaches the owner's real Pixel Office folder.

## Доказательство

- `handoffs/ISS-0116-20261117-01/step-01-issue-fixer.json`: issue I5 and `self_check` (`node bin/mut.mjs POj POjf POk`): «POj journal green; POjf (the journal read again after withStand) red: 'the lines of the journal file, after the stop' (4 !== 3); POk (the same reading on today's server) green».
- `decisions/0114`, Д5.
- `tools/test/e2e/pixel-office.e2e.js` (sha256 `d91b7fc4…`, unchanged against the tag `base/ISS-0116-20261117-01`), read as text at step 10: test «journal» lines 641–697, the reading at line 673; test «mask» lines 701–782, the readings at lines 760–761 and 767–778; «untouched home», line 795.
- To repeat, only in a fresh clone outside the project and under the safety rules of the e2e runs: a temporary home, the state folder under the temporary root, the owner's real Pixel Office folder never named. Make the server's stop handler append one line to `events.jsonl` of its own state folder when that folder lies under the temporary root, then run test «journal» alone; it stays green.

## Как исправить

A WF-03 run of TEST-DESIGNER (the spec only; Pixel Office itself is not changed):

1. «journal»: after `withStand` returns, read `events.jsonl` of the test's folder again and assert the same 3 lines as inside the body. POjf measured this as red on POj and green on today's server (POk).
2. «mask»: read `events.jsonl` again after the stop and assert again that the key and its middle are not in it. Read the server's stdout and stderr after the stop too, if the stand keeps them after its stop; the fixer measures that.
3. Each new reading is red on its probe first (POj, and one for «mask» that writes the key at shutdown) and green on today's server (Q5). A weaker check, a skip or a removed assertion is not a fix (Q6).

## Маршрут

WF-03 for TEST-DESIGNER (tests only), with TEST-DESIGN-VALIDATOR; small, not urgent; on ORCH's order. It can go together with ISS-0111 or ISS-0113 (the same spec and the same requirement).
