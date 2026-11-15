# ISS-0106 — The test `isolation` of the picker e2e spec has four measured gaps: a body search that skips a whole address prefix, a word read in single nodes, an error answer not pinned, B's own stored value not read

Серьёзность: LOW. Статус: open. Найдено: TEST-DESIGN-VALIDATOR (шаг 05h, находки F7 и F9, issues I1 и I3, мутанты H1, H1b, H4, H5, H7), RELEASE-VALIDATOR (шаг 09, критерий 6), прогон `E2E105-20261105-01`, 2026-11-15; заведено DOC-UPDATER (шаг 10), 2026-11-15T16:39:45Z. Пункт планки: Q5 (тест ловит поломку), Q8 (данные одного арендатора не видны другому). Требования: REQ-105 (сделано; критерий 6 и тест `isolation`). Решение: `decisions/0109`, О22 (находки Low, в этом прогоне тест больше не правится: шаг 05h был последним проходом ворот) и О23 (текст критерия 6 не меняется в этом прогоне).

## Что не так

The test `isolation` of `tools/test/e2e/picker.e2e.js` passed its last gate (step 05h, PASS) with these gaps. Each was measured on copies outside the project with a mutant that survives, and each has a measured smallest fix (below):

1. **F7 — the body search skips every answer under `/t/<B>/api/`.** After `assertRequestsOfB` the test searches what B's page got for texts and solution names of A, and skips every record whose path starts with `/t/<B>/api/`, with the reason that B's two answers have their own checks above. Only two records have them: the questionnaire record counted at B's card and the one `POST` of the result. A second answer under B's own api address is read by nothing: mutants H1 (a second request of `/t/<B>/api/questionnaire?of=<A>` answered with A's questionnaire) and H1b (a new route `/t/<B>/api/peek`) survive, 9 of 9 green, while B's page got A's name, intro, titles and options in those answers. This is the one place where RELEASE-VALIDATOR found the test below the letter of criterion 6 («B's network answers … hold none of them»); its own probe on the correct server shows the system meets the letter (B's page made 15 requests in each pair, exactly 2 under `/t/<B>/api/`).
2. **F9 — an exception word is read in single text nodes and whole element texts.** The one measured exception word of A on B's screens («человек», inside B's option «Есть отдельный человек» on question 11, team) must stand only inside that text of B's file (`decisions/0109`, О20). Mutant H4 puts «человек» inside the option «Я сам» as two spans «чело» and «век»: the visitor reads «Я сам человек», no element's whole text equals «человек» and no text node holds it, so `isolation` is green (A2d, the same word as one text node, is red).
3. **I1 of step 05h — the error answer is not pinned to its measured body.** Criterion 6 asks the error answer of B to A's `leader` set for no solution name of A; mutant H5 (the message carries the summary of A's first solution, status 400 kept) survives. By `decisions/0109`, О22, H5 is outside the letter of the criterion until this item is closed.
4. **I3 of step 05h — B's own stored value after B's pass is not read.** Criterion 6 reads the storage when B's card opens («the storage still holds only A's key»); mutant H7 (B's page writes A's name, kept in `window.name`, into B's own stored value during B's pass) survives: `sai-picker:svet-marketing` ends with `seen «Учёт-Про»`, `sai-picker:stock` with `seen «Лидвейв»`.

Why LOW: every item needs new server or page code that serves or keeps A's data under B (the correct server takes the tenant from the path only; the correct page asks two api addresses only), the visitor of the correct page sees nothing of A, and every other way of B's page to A's data that the gates tried is red.

## Доказательство

- `handoffs/E2E105-20261105-01/step-05h-test-design-validator.json` — findings F7 and F9 with `place`, `what` and `how_to_fix`; issues I1 and I3; `summary.mutants` (H1, H1b, H4, H5, H7 with the probe lines of the server and the measured bodies); the own measurement on the correct server (`summary.own_measurement_O19_O20`).
- `handoffs/E2E105-20261105-01/step-09-release-validator.json` — `summary.criteria`, criterion 6 (the probe of B's 15 records; «О22/F7 … the only place where the TEST is below the letter while the SYSTEM meets it»).
- `decisions/0109`, О22.

## Как исправить

A later edit of the test `isolation` only, with the fixes the gate measured (each: the correct code green 3 of 3, the mutant red):

1. F7: skip by the two checked records, not by the address prefix — a set of the two request ids (`asked[0].requestId`, `post.requestId`) before the loop and `if (checkedAnswers.has(record.requestId)) continue;` in it. H1 and H1b must turn red.
2. F9: add to `SCREEN_TEXTS` the text of every element with the texts of its children, and require that every innermost element whose text holds such a word (no child holds it) has a whole text that is one of B's own texts on the screen. H4 must turn red and A2d must stay red.
3. I1: pin the error answer to its measured body, the same in both pairs: `{"error": "answers_invalid", "message": "Ответы не подходят к этой анкете. Пройдите анкету ещё раз.", "question": null}` (this also turns the earlier mutants O7 and G08 red without the list rule). H5 must turn red.
4. I3: after B's pass, B's stored value has the five fields of criterion 5 and holds no text or solution name of A. H7 must turn red.

The edit is checked by TEST-DESIGN-VALIDATOR (WF-02 step 5b) like any edit of an already checked test. A wider exception, a skip or a removed check is not a fix (Q6). Items 3 and 4 read more than the letter of criterion 6; a WF-01 micro-amendment may write that reading into the criterion together with this defect (`decisions/0109`, О23).

## Маршрут

WF-03 for TEST-FIXER (an edit of `isolation`) with the test gate, best together with ISS-0105 (the same test), on ORCH's order.
