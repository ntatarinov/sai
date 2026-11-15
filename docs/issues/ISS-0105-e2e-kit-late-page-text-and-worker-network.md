# ISS-0105 — The e2e kit cannot show a spec what a page does later or outside its own records: a text added after a screen is read, and the requests of the page's workers and service workers

Серьёзность: LOW. Статус: open. Найдено: TEST-FIXER (шаг 05g, повторный запуск 2, issue I1, пробы T1–T3), TEST-DESIGN-VALIDATOR (шаг 05h, находка F8, мутант H3), RELEASE-VALIDATOR (шаг 09, критерий 6), прогон `E2E105-20261105-01`, 2026-11-15; заведено DOC-UPDATER (шаг 10), 2026-11-15T16:39:45Z. Пункт планки: Q5 (тест ловит поломку), Q8 (данные одного арендатора не видны другому), Q3 (честность проверки). Требования: REQ-105 (сделано; тест `isolation`), REQ-104 (сделано; набор e2e, в котором нужна правка). Решение: `decisions/0109`, О21 и О22 (класс принят и записан как S22; дефект набора открывает DOC-UPDATER на шаге 10).

## Что не так

The test `isolation` of `tools/test/e2e/picker.e2e.js` (criterion 6 of REQ-105) reads the page of tenant B after a full pass of tenant A. Two kinds of a leak stay unseen, and neither can be seen with what the kit gives a spec today:

1. **A text added later than the test reads a screen.** The test reads every screen of B's pass when it appears (waited for by a fact) and again after its answer, then moves on within tens of milliseconds. A text of A that B's page adds later is not read. The probes of TEST-FIXER put A's name on B's card (T1), on B's result screen (T2) and on each question screen (T3) 300 ms after the screen appears; all three stay green on the final file. To see them the page's time must pass, and a spec may not wait by time (no sleep: design `docs/design/REQ-105-e2e-picker.md`, section 11.1, the waiting rule; AP-144).
2. **The requests of the page's workers and service workers.** The kit records only the page's own network events (`tools/test/e2e/kit/page.js`). The test completes its request check with two controls: every record has its answer (a dedicated or shared worker shows as its script with no answer: mutants A8, A17 are red) and no service worker registration on B's origin (one reading at the end: A14 is red). Mutant H3 of step 05h passes both: B's page registers a service worker that asks A's questionnaire at its install and unregisters it once it is active; the server got `GET /t/uchet-pro/api/questionnaire` (and `/t/agency/…`) after B's open, the page records stayed the 15 of the correct page, the registrations were `[]` at the end, and `isolation` was green.

Why LOW: both need page code written to hide its own leak (a delayed text, a worker that removes itself); the correct page does neither (measured at step 05h: 15 records, all of B's address or `/assets/<name>`, all answered, no worker, no registration), and the visitor of the correct page sees nothing of A. The test meets the letter of criterion 6 on the correct system; these are the places where a broken page would pass it.

## Доказательство

- `handoffs/E2E105-20261105-01/step-05g-test-fixer-run2.json` — issue I1 (T1–T3 and the reason), `mutants` (A8, A14, A17 red; T1–T3 green on the final file and on the earlier forms), the probe of the worker class with a request log of the server in a copy.
- `handoffs/E2E105-20261105-01/step-05h-test-design-validator.json` — finding F8 (Low), mutant H3 with the probe lines of the server, the own measurement on the correct server.
- `handoffs/E2E105-20261105-01/step-09-release-validator.json` — criterion 6 («О21 — a text of A added after the test read a screen is not seen»).
- To repeat T1: in a copy outside the project make B's page append A's name (kept in `window.name` from A's pass) to its card 300 ms after the card appears, then run `cd tools && node --test --test-name-pattern='^isolation$' test/e2e/picker.e2e.js` in the copy: it stays green.

## Как исправить

A change of the kit (REQ-104), with its own design and a test gate; not done in the run `E2E105-20261105-01` (`decisions/0109`, О21, О22):

1. Let a spec run the page's own clock forward by the debugging protocol (`Emulation.setVirtualTimePolicy` with a budget, whose end comes as an event), so that the timers of the page run to a fact, not to a sleep; then `isolation` reads each screen of B again after such a budget. Mutants T1–T3 must turn red.
2. Record the network of the page's workers and service workers (attach to their targets through the protocol and keep their requests with the page's records); then `isolation` asserts on them as on the page's own records. Mutant H3 must turn red, and A8, A14, A17 must stay red.

A sleep in the spec, a skip or a weaker control is not a fix (Q6; the waiting rule of the design, section 11.1).

## Маршрут

WF-01 (a requirement for the kit, or an amendment of REQ-104) and then WF-02, or WF-03 with a design step; best together with ISS-0106 (the same test `isolation`), on ORCH's order and the owner's word.
