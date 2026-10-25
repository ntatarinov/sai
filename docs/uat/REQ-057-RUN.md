# REQ-057 — acceptance run: the card and the questionnaire page of the solution picker site, in a real browser

WF-02, step 8 (UAT-RUNNER), run `PAGE057-20261021-01`, handoff `step-26-uat-runner.json`. The steps are PR-1 … PR-11 (in the design written as ПР-1 … ПР-11) of section 18 of `docs/design/REQ-057-picker-page.md`, taken as written; the expected results are the criteria 4, 5, 7, 9 and 11 of REQ-057 in `docs/requirements.yaml`. PR-12 (the readers of the keys) is not a step of this role and is not in this run. There is no `docs/uat/REQ-057.md` of BA-ANALYST: the design describes the steps (WF-02, step 8), so no scenario of my own was added. The run was made on 2026-10-25 (computer clock, `date -u`, from 19:38Z to 19:52Z). The code, the tests and the data of the stand were not changed; the only files written in the project are this file and the handoff. The reading and the signature of the result are BA-ANALYST's; the decision to release is the owner's.

## Result

**PASS: 11 of 11 steps (PR-1 … PR-11), 0 failures, 0 steps not carried out.** Every number below is a measured value; the measurements were repeated for the whole matrix, not for a sample.

What the matrix was: tenants `uchet-pro` and `svet-marketing`; languages `ru`, `kk`, `en`; windows 1470 × 784, 390 × 844 and 320 × 568; themes light and dark. Keyboard-only walks from the card to the temporary result screen: 36 (2 tenants × 3 languages × 3 windows × 2 themes), 324 question screens measured in all (180 of `uchet-pro`, 144 of `svet-marketing`). Besides them: 36 cards, 36 temporary screens, 6 contrast runs, 9 reload runs, 18 language switches, 27 connection-loss runs with a stopped stand (18 with a working storage, 9 with a storage that refuses), 56 real stops and starts of the stand on the same port.

Remarks (not failures, AP-117): R1–R6 at the end.

## The stand and the browser

- **Stand (PR-1).** `npm run -s picker -- serve --tenants src/picker/demo-tenants --home <new folder outside the project> --port 0`, my own server, new `--home` folder. It printed exactly five lines (the title, the links `/t/svet-marketing/` and `/t/uchet-pro/` with one port 64143, the line about the restart, the line about the stop); `stderr` was empty (0 bytes). The `--home` folder was not created (the command writes nothing, `tools/README.md`). The owner's stands on 4782 and 4790 were listening before the run and after it and were not touched. The stand is a separate server of the picker, not Pixel Office: there is no Pixel Office journal in this run, so R2 does not apply; no photo or personal data was used (R3); no secret or credential exists in the run (Q7).
- **Browser.** Google Chrome 155.0.8059.86, `--headless=new`, debugging protocol (`Page`, `Runtime`, `Log`, `Network`, `Input.dispatchKeyEvent`, `Emulation.setDeviceMetricsOverride` with `deviceScaleFactor` 1 and `mobile` false, `Emulation.setEmulatedMedia` with `prefers-color-scheme`). One Chrome (8 processes, 1044 MB of resident memory in total at the last reading before it was stopped), one page at a time, the page closed after every run; the cache was off. The computer keeps no other Chrome. Measurements are in-page expressions of the form of section 18.
- **Q8 for the page.** On every run the page read and wrote only the key `sai-picker:<id>` of the tenant it showed: the list of keys of the storage after each walk was exactly `["sai-picker:uchet-pro"]` or `["sai-picker:svet-marketing"]` (36 of 36). The first line of the card equals `name` of the server answer for the path and the language in all 36 cards..

## PR-1. Start

- **Action.** The command above; `cat serve.out`; `cat serve.err`; Chrome started with `--remote-debugging-port=9333`, a new empty profile.
- **Repeated request.** `GET /t/uchet-pro/api/questionnaire` answered 200 (checked after every restart of the stand); the debugging port listed the page targets.
- **Comparison.** Five lines; empty `serve.err`; not on 4782: PASS.
- **Evidence.** `serve.out` of 5 lines, `serve.err` 0 bytes, port 64143.

## PR-2. The card (criterion 11)

- **Action.** For both tenants × `ru`, `kk`, `en` × the three windows × both themes: opened `/t/<id>/?lang=<language>` with an empty storage and measured `scrollWidth`/`clientWidth`, the rectangle of `[data-action=start]`, the count of `dialog,[role=dialog],[aria-modal]`, the count of elements with `position: fixed`, the first line of `main`, the whole text of `main`, the tab title, `html lang`, and whether the emulated theme was in force (`matchMedia`). A snapshot of every card.
- **Repeated request.** Every value above was read from the page after it had loaded and the questionnaire had arrived (the server answer for the same path and language was asked separately for the comparison).
- **Comparison and numbers.**

| Window | scrollWidth / clientWidth | «Пройти опрос» (width × height, bottom) | the page height of the card |
|---|---|---|---|
| 1470 × 784 | 1470 / 1470 | 155.25 … 191.19 × 48; bottom 446 … 473 (innerHeight 784) | 784 |
| 390 × 844 | 390 / 390 | 332 × 48; bottom 516 … 543, not more than innerHeight 844 (the margin is not less than 301) | 844 |
| 320 × 568 | 320 / 320 | 262 × 48; bottom 543 … 594 | 592 … 643 (higher than the window: vertical scroll only) |

  The right edge of the furthest element of the card was 1039 (1470 window), 378 (390) and 308 (320); the left edge not less than 12 in the narrow windows; no element had its content wider than itself (the list of such elements was empty in 36 of 36 cards). Blocking windows: `dialog,[role=dialog],[aria-modal]` 0 and `position: fixed` 0 in 36 of 36. The first line of text equals the tenant name of the server in that language in 36 of 36. The whole text of `main` equals, line by line, `name`, the three language buttons, `intro`, `card_gives`, `card_ask`, «Вопросов: от 8 до 12» / «от 7 до 11» in the language of the page, and the one button — nothing else (36 of 36). `html lang` equals the language (36 of 36); the tab title is the tenant name (36 of 36); the emulated theme was in force (36 of 36, the page background `rgb(243, 245, 249)` in light). The text equality above shows exactly one button «Пройти опрос» on every card. 18 pairs «tenant × language × window» per theme (6 per window): all passed.
- **Result.** PASS.
- **Evidence.** 36 snapshots of cards (`card_*`): 18 of `uchet-pro`, 18 of `svet-marketing`, light and dark, three languages, three windows.

## PR-3. Questions and sizes (criterion 5)

- **Action.** `uchet-pro` with the set `leader` of `demo-answers/uchet-pro.json` (10 visible questions) and `svet-marketing` with its `leader` (8 visible, one optional question skipped by the button), in the three windows, three languages and both themes (the keys, see PR-4). On every question screen: `scrollWidth <= clientWidth`; the sizes of all `button`, `[data-part=option]` and `input`; a snapshot of the longest question of each tenant (`problems` of `uchet-pro`, `channels` of `svet-marketing`, chosen by the text length of the title, help and options; the full page for the narrow windows).
- **Repeated request.** Each screen was measured after the transition had finished and the question had been asked of the page again (title, progress, checked values).
- **Numbers (324 question screens).**

| Window | scrollWidth / clientWidth | rows `[data-part=option]` | inputs (radio, checkbox, number) | buttons (language, Back, Skip, Next) |
|---|---|---|---|---|
| 1470 × 784 | 1470 / 1470 in all | 550 × 48 | radio, checkbox 546 × 44; number 192 × 48 | language 72.22 … 89.89 × 44; Back 81.45 … 93 × 48; Skip 77.2 … 159.23 × 48; Next 79.34 … 200.52 × 48 |
| 390 × 844 | 390 / 390 in all | 332 × 48 … 72 | radio, checkbox 328 × 44 … 68; number 192 × 48 | language 72.22 … 89.89 × 44; others 332 × 48 |
| 320 × 568 | 320 / 320 in all | 262 × 48 … 96 | radio, checkbox 258 × 44 … 92; number 192 × 48 | language 72.22 … 89.89 × 44; others 262 × 48 |

  The least width and the least height of every measured target on all 324 question screens, 36 cards and 36 temporary screens: **44** (the height of the language buttons and of the transparent inputs; every other value is larger). The furthest right edge on question screens: 1039, 378, 308; the lists of elements with overflowing content were empty. kk and en did not go over the edge in any window. The page height of the longest question in the 320 window: 870 (`ru`), 870 (`kk`), 894 (`en`); the highest question page in the 390 window is 846 (2 px above the window, vertical scroll only); scroll is vertical in all cases.
- **Result.** PASS.
- **Evidence.** 36 snapshots of the longest question (`question_*`, 18 per tenant).

## PR-4. Keyboard (criterion 5)

- **Action.** Every walk above was made only with `Input.dispatchKeyEvent`: Tab to «Пройти опрос» and Enter; on a single question Tab to the group, Space, then ArrowDown to the wanted option; on multiple questions Tab and Space on each wanted box; on a number question the digits; Enter in the field; Tab and Enter on «Пропустить» for the optional question; on the first question Shift+Tab to the language button, Tab to the field and to «Далее», Enter on the button. Done in all three windows (the step requires two) and all languages, in both themes.
- **Repeated request.** After every transition `document.activeElement` was read, and the checked values and the progress were read again.
- **Comparison and numbers.** The active element after each transition was `H2` with the text of the new question: 324 of 324; at the end `H2` «Результат скоро появится на этой странице.» / its kk and en text (36 of 36). The checked values after the keys equal the answers of the set (every walk). The ring on the first stop: language button, field row (the label around the transparent input), «Далее», number field, «Пропустить», «Пройти опрос» — all `solid`, `3px`, offset `2px`, colour `rgb(29, 78, 216)` (light) and `rgb(140, 196, 255)` (dark) = `--focus`; the focus ring of the question title in the contrast run is the same. The ring is visible on the snapshots.
- **Result.** PASS.
- **Evidence.** 18 snapshots each of `ring-lang_*`, `ring-field_*`, `ring-number_*`, `ring-button_*`, `card-focus_*` (the ring on «Пройти опрос»). The progress of `uchet-pro` read `1/12 2/11 3/10 4/10 … 10/10`, of `svet-marketing` `1/11 2/10 3/9 4/8 5/8 6/8 7/8 8/8`, identical in the three languages.

## PR-5. Contrast (criterion 5)

- **Action.** For both themes and all three windows: the values of the 18 tokens (`getComputedStyle(documentElement).getPropertyValue`) and, in nine states (card, card with the notice «Анкета изменилась…», card with «Продолжить» and «Начать заново», single question with a selected row, the error text, multiple, number, number with the error), the colour of the text of every visible text element against the first opaque background upwards, the colour of every border, the fill of the mark and of the progress bar, and the ring of the focused element; also the states under the mouse: hover on «Пройти опрос», on a language button, on «Начать заново», on «Назад» and on an option row (`:hover` read as true). The net block was measured in PR-8. The formula is WCAG 2.x: `(L1 + 0,05) / (L2 + 0,05)`, `L = 0,2126 R + 0,7152 G + 0,0722 B` of the linearised channels.
- **Repeated request.** The tokens were read again in each of the 6 runs (the window × theme).
- **Comparison and numbers.** The 18 tokens equal the table 8.1 in all 6 runs (108 of 108). The ratios computed from the tokens for the 25 pairs of table 8.2 (light and dark = 50) equal the table within 0,011 (50 of 50). On the page: 104 text elements per run; **the least ratio of a text is 5.72 in light** (`--error` on `--error-bg` and `--accent-ink` on `--accent-soft` under hover) **and 6.74 in dark** (`--accent-ink` on `--accent-soft`); every other text pair measured: 16.27, 14.48, 15.08, 13.88, 8.01, 7.50, 6.70 in light and 14.18, 12.89, 11.29, 10.60, 10.30, 9.02, 8.45, 7.88, 7.54 in dark; the same numbers as the table. Not text: borders of buttons, rows and the number field `--control` on `--surface` 5.40 (light) and 5.30 (dark); the selected row border `--accent` on `--surface` 6.70 / 7.32; mark border on the selected row 5.72 / 5.47; the fill of the progress bar on the track 4.77 / 5.07; the left bar of the notice against the panel 5.87 / 8.63 (against its own background the table gives 5.44 / 6.87); the ring `--focus` on `--surface` 6.70 / 9.02. The border `--line` of the panel (1.34 / 1.60) and of an option row (1.46 / 1.44) is decoration; the choice is carried by the mark. Net block texts: 5.72, 5.86, 7.54, 8.41 (27 runs). No text pair was under 4,5 : 1 and no pair of a control, a mark or the ring under 3 : 1 (the decorative `--line` borders are the only ones lower, as the description says).
- **Result.** PASS.
- **Evidence.** The numbers above; no snapshot is needed.

## PR-6. Reload (criterion 4)

- **Action.** `uchet-pro`, three windows × three languages (9 runs): answered four questions by clicks (business, items, places, tools), pressed «Далее» (the fifth question «problems» open), `Page.reload`, «Продолжить»; then went Back four times to read the earlier answers; then reload and «Начать заново».
- **Repeated request.** `localStorage.getItem('sai-picker:uchet-pro')` before the reload and right after it; the card text after the reload; the checked values read again on each question.
- **Comparison and numbers.** The value before and right after the reload is the same string (9 of 9): the five keys `format`, `version`, `lang`, `current`, `answers`, with `current` = `problems`, `lang` = the language of the run and four answers `{business: retail, items: 120, places: one-place, tools: [sheets]}`; no contact field. After the reload the card showed «Продолжить» and «Начать заново» and no «Пройти опрос»; after «Продолжить» the fifth question with the progress «Вопрос 5 из 10» (the same in kk and en: «Сұрақ 5 / 10», «Question 5 of 10») and the focus on its title; Back showed the answers `sheets`, `one-place`, `120`, `retail` selected. The list of keys of the storage: only `sai-picker:uchet-pro`. After «Начать заново»: the key is `null`, the first question «Вопрос 1 из 12» opened with 0 checked inputs. Console entries: 0.
- **Result.** PASS.

## PR-7. Language (criterion 9)

- **Action, part 1.** `uchet-pro` to the temporary screen in `ru`, `kk` and `en` (the walks of PR-3).
- **Comparison, part 1.** The order of the questions is the same: `business, items, places, tools, problems, staff, recount, migrate, budget, goal` (36 walks); the values of the options chosen by the same keys are the same: `retail, 120, one-place, sheets, slow-count, 2, weekly, start-clean, budget-low, goal-speed`; the progress `K/N` is the same; the titles of all 10 questions differ in the three languages (0 equal). Example, the first question: «Чем вы занимаетесь?» / «Сіз немен айналысасыз?» / «What do you do?».
- **Action, part 2.** For each of the 6 ordered pairs of languages in each window (18 runs): answered the first three questions, `window.__mark = 1`, switched the language on the third question by the button (windows 1470: by keyboard — Shift+Tab to the button, Enter or Space; windows 390 and 320: by a click).
- **Repeated request.** `window.__mark`, the address, `html lang`, the title and the checked value of the question, the progress, the active element, `aria-current`, the value of the storage, the list of keys, the requests of the page (the count of requests of the document and the requests to the server).
- **Comparison and numbers.** In 18 of 18: `window.__mark === 1` (no reload); the number of requests of the document before and after: 1 and 1; one new request `GET …/api/questionnaire?lang=<new>` with 200; the address `/t/uchet-pro/?lang=<new>`; `html lang` = the new language; the same third question and the same selected option `one-place` (the label in the new language); the progress K and N equal («Вопрос 3 из 10» ↔ «Сұрақ 3 / 10» ↔ «Question 3 of 10»); `aria-current` only on the new button; the focus stays on the pressed language button (`BUTTON|<code>|<label>`); the storage value changed only in `lang`, `current` and the answers are the same; the key list is only `sai-picker:uchet-pro`; console entries 0.
- **Result.** PASS.
- **Evidence.** 4 snapshots `lang/switch_ru-kk_*` (1470 and 390) and the question snapshots of PR-3 on three languages.

## PR-8. No connection (criterion 7)

- **Action.** The stand was really stopped with `kill <pid>` of the server (the pid from `lsof` on the port) and started again on the same port 64143 (`--port 64143`).
  (a) Opening the page itself with the stand down gives the browser's own error page (`Page.navigate` → `net::ERR_CONNECTION_REFUSED`, the address becomes `chrome-error://chromewebdata/`): the page cannot show its block without its own files. So the step was done so that the document and the scripts load from the working stand, the request of the questionnaire is held at the browser until the stand is stopped, then released: the request really goes to the stopped server and really fails. Then «Повторить» with the stand still down (the block stays), the stand started, «Повторить».
  (b) The last question answered, the stand stopped, «Показать результат», «Повторить» with the stand down, the stand started, «Повторить».
  Done in all 3 windows × 2 themes × 3 languages (18 runs), and with a storage that refuses (PR-9) in 9 runs. Extra observation, once: the switch of the language with the stand down.
- **Repeated request.** The text and kind of the block, the focus, the screen, the position of the block, the answers still checked, the requests of the page with their bodies, the console, the card or the screen after «Повторить».
- **Comparison and numbers (27 runs).** (a) The block `data-kind=load` shows the text of `net_lost_saved` in the language of the page («Нет связи. Ваши ответы сохранены. Попробуйте ещё раз.» / «Байланыс жоқ. Жауаптарыңыз сақталды. Қайталап көріңіз.» / «No connection. Your answers are saved. Please try again.»), the button «Повторить» / «Қайталау» / «Try again» (128.11 × 48), the focus on the button, `aria-describedby` on the text, not `role=alert`. «Повторить» with the stand down: the block stays with the same text (27 of 27). After the stand is started, «Повторить» opens the card with the tenant name and the focus on its title (`H1`); the block is gone. (b) The block `data-kind=result` stands after the buttons and outside the form (the block follows «Показать результат» in the document), the last question's selected option stays checked, the focus is on «Повторить»; down: the block stays; after the start, «Повторить» opens the temporary result screen with the focus on its `H2`. The body of the `POST …/api/result` is the same in the failed attempts and the successful one: `{"answers": <the set leader of uchet-pro>}` with the one key `answers` (27 of 27); the answer is 200 only after the start. The blocks fit: scrollWidth ≤ clientWidth in all; the button 48 high. `Runtime.exceptionThrown`: **0** in all 27 runs. Console: 109 entries, all of one kind, level error, `Failed to load resource: net::ERR_CONNECTION_REFUSED` for the questionnaire (55) and the result (54), made by Chrome for the stopped stand; nothing else. Extra (once, not a criterion): the switch of the language with the stand down shows a block of kind `lang` under the header with the same text; «Повторить» after the start changes the language to kk and removes the block.
- **Result.** PASS.
- **Evidence.** 27 snapshots `net/a_*` (the block on the load), 27 `net/b_*` (the block under the buttons), 1 `net/c_*`; the 9 with a refusing storage show the text of PR-9.

## PR-9. The storage is unavailable (criteria 4, 7)

- **Action.** Before opening the page `Page.addScriptToEvaluateOnNewDocument` with `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } })`; `uchet-pro` passed with the keyboard to the temporary screen in 3 windows × 3 languages (9 runs, light); reload; then PR-8 (a) and (b).
- **Repeated request.** The page after the reload; the keys of the storage (reading throws `SecurityError`); the block texts.
- **Comparison and numbers.** The 10 questions were passed to the temporary screen in 9 of 9 with the focus on the title after every transition. After the reload the card had «Пройти опрос» (or «Сауалнамадан өту», «Take the survey») and no «Продолжить» (9 of 9). With the stand down the blocks show `net_lost_unsaved` in the language of the page («Нет связи. Не закрывайте страницу, ответы пока только здесь. Попробуйте ещё раз.» and its kk and en text), in (a) and (b) (18 of 18); «Повторить» works as in PR-8; the `POST` body is the same. `Runtime.exceptionThrown` 0 in 9 of 9; console: only the lines of the stopped stand.
- **Result.** PASS.
- **Evidence.** The 9 snapshots `net/a_*_denied` and `net/b_*_denied`; 6 snapshots in `denied/` (a question and the temporary screen in the 390 window, three languages).

## PR-10. Console

- **Action and numbers.** `Log.entryAdded`, `Runtime.consoleAPICalled` and `Runtime.exceptionThrown` were collected on every run of every step above (36 walks, 6 contrast runs, 9 reload runs, 18 language runs, 27 connection runs: 96 runs).
- **Result.** Exceptions: **0**. Entries of level `error` or `warning`: 109, all `net::ERR_CONNECTION_REFUSED` of the stand stopped on purpose (PR-8, PR-9). In the 69 runs where the stand was not stopped (36 walks, 6 contrast, 9 reload, 18 language) there were 0 entries of any level. The line `/favicon.ico` 404 (`Failed to load resource: the server responded with a status of 404 (Not Found)`) was seen once, in the first page opened with a new profile (a test page before the walks); Chrome asks for the icon only once per profile, so later runs have no such line; it is not an error by criterion 11. Chrome's own process prints lines on its stderr about the display link; they are not the console of the page. PASS.

## PR-11. Stop

- **Action.** `kill <pid>` (SIGTERM) of the server, on a stand started in the same way (`npm run -s picker -- serve … --port 64143`) and on a stand started with `node src/picker/cli.js serve …`.
- **Repeated request.** The exit code of the starting process, `lsof` on the port, a request to the port.
- **Comparison.** Exit code **0**, signal none, in both; after the kill no process listened on 64143; `fetch` gives `ECONNREFUSED`; `stderr` of both was empty. After the run `ps` showed no Chrome (all browser processes stopped, the debugging port 9333 closed) and no stand of this run; the stands on 4782 and 4790 were still listening. PASS.

## Snapshots

Outside the project, in the scratch folder of the run (the paths are in the message to ORCH): 279 files, 10 MB. By kind: `card_*` 36, `card-focus_*` 36, `question_*` 36, `stub_*` 36 (the temporary result screen), `ring-*` 72 (`uchet-pro` only), `net/a_*` 27, `net/b_*` 27, `net/c_*` 1, `lang/` 2, `denied/` 6. The narrow-window snapshots of the longest question and of the blocks under the buttons are full-page. Not taken: the snapshots of the focus ring on question screens for `svet-marketing` (the same elements as in `uchet-pro`; the ring on its «Пропустить» was measured: `solid 3px`, offset 2px, 18 of 18), and the snapshots of the card with «Продолжить» and of the card with the notice (these states were measured, not photographed).

## Remarks (not failures)

- **R1.** Step PR-8 (a) says «stop the stand, open the page». Opening the page with the stand down cannot show the block of the page (measured: the browser's own error page, `net::ERR_CONNECTION_REFUSED`); the block of the load was reached by holding the request of the questionnaire while the stand was stopped (see PR-8). The wording of the step may be corrected by CODE-DESIGNER or BA-ANALYST.
- **R2.** The screen of a failed load has no `h1` (the name of the tenant is not known yet; `h1` count 0 on this screen, 1 on every other). The criteria do not ask for it.
- **R3.** Section 9 of the interface description gives the height of a row as 49 and of the transparent input as not less than 45; measured: rows 48, inputs 44. Both meet the criterion (not less than 44 × 44); the numbers of the description are only an example.
- **R4.** The card at 320 × 568 is higher than the window (592 … 643) and the button is partly under the fold (bottom 543 … 594); the criterion asks to see the button without scroll only in 390 × 844. The question page at 390 × 844 can be 846 high (2 px of vertical scroll).
- **R5.** The switch of the language with the stand down (not in a criterion) shows the block of kind `lang` under the header; it works as the load block.
- **R6.** The checks of the criteria 10 and 11 by `grep` are the job of the test step and were not part of this run; as a side observation, `alert(`, `confirm(`, `prompt(`, `showModal`, `beforeunload` and `https?://` give no match in `tools/src/picker/public/` (code 1), `stub` in the HTML gives no match, and `fetch(` stands once, in `net.js`.

## What this run does not prove

Safari and Firefox were not tried (Q3: no statement about them). The text of the kk translations is not checked here (it is PR-12 and the readers). The result page is REQ-058, not this run. A real device was not used; the narrow windows are frames of the headless Chrome of the given size.
