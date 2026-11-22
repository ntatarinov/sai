# REQ-113 - acceptance run: the visitor status block of the public site

WF-02, step 8, item 4 (UAT-RUNNER), run `M1STATUS-20261122-02`, handoff `step-08b-uat-runner-req113.json`, 2026-11-22. The
scenarios are those of `docs/uat/REQ-113.md` (V-01 to V-20, K-01, R-01); the way of the run is that of `docs/uat/REQ-111.md`
(a fresh clone, a real Chrome driven through the debugging protocol, one isolated browser context per cell). The reading and the
signature of the result are BA-ANALYST's; the decision to release is the owner's. No scenario spent the owner's limit or money
(no real AI run, G2); the people and the data are invented (AP-004); no credential exists in this run (Q7).

## Result

**Verdict: V-01 to V-20 PASS, 0 failures; K-01 not run (kk hidden, G9, by design); R-01 not run by this role (the reader test is
a separate launch, the reader pack is made, see the end).** Scenario groups: the block on the result and on `how.html`
(V-01 to V-04) PASS; the lead, the label and the sentence (V-05, V-06) PASS; the stage marks and the old controls (V-07, V-08)
PASS; the language switch (V-09, V-10) PASS; layout and contrast (V-11, V-12) PASS; the failure and condition scenarios
(V-13 to V-19) PASS; the public set (V-20) PASS. Remarks that are not failures (AP-117) are at the end; two of them ask
BA-ANALYST to correct the scenario file.

## The stand

- Commit `b25c11e` (the head of the working branch). Two fresh clones of the project folder were made into the session
  scratchpad, outside the project, with `core.autocrlf=false` (LF, as on Linux), checked out at `b25c11e`, `npm ci` in `app/` of
  each. `app/` of the clone equals `app/` of the working tree of the project (`diff -rq`, `node_modules` left out: no
  difference), so the code run is the code that passed GitHub run 45001073839.
- `<APP>`: `node server/node-main.js` of the first clone on a free port (in-memory data); `GET /` answered 200 and
  `GET /api/health` answered `{"ok":true,"db":"ok",...}`. `<APP-PUBLIC>`: the second clone, the output of the open build
  (`vercel-build` run through `runBuild` into an output folder, exit 0, "vercel-build: done"), served through `createApp` with the
  output folder the way the integration test serves it, on another free port; `GET /examples.html` answered 404 there and 200 on
  `<APP>`, so the two stands are the local set and the public set. Both servers were stopped by their exact process ids at the end.
- Real Chrome 157 (the installed program, `--headless=new`, a fresh temporary profile), driven by my own client of the debugging
  protocol (Node 22.23.4). Every cell is a fresh isolated browser context (own storage); the language and the theme are set through the
  real buttons «EN»/«RU» and the theme button; clicks and keys are real input events. Failures are made at the browser itself
  (`Fetch.fulfillRequest`, `Fetch.failRequest`, a delay of the answer), JavaScript off by the browser setting, a storage that throws by a
  script injected at the start of the page, the system "reduce motion" and theme by `Emulation.setEmulatedMedia`, the network by
  `Network.emulateNetworkConditions`. Headless only: a visible Chrome was not started.
- The expected words were copied from `docs/uat/REQ-113.md` and compared with the page text, whitespace folded and without letter
  case (the style shows the labels in capitals); they were not read back from the product's texts file.
- Cells: FULL = 12 cells, CORE = 6 cells, and +360 and 380 for V-11 and V-12, as each scenario says; kk was not run. No load: the
  scenarios ran one after another on one stand, with the requests the pages make themselves (the demo's two) and no loop.
  The scenario file gives no number of requests for the local stand; the only plain requests made outside a page are one
  `GET /api/health` and `GET /api/demo/questionnaire?lang=kk` on `<APP-PUBLIC>` (V-20, once).
- Evidence: 265 snapshots (full page where the page is long) in `<scratch>/uat113/snaps`, named `V<nn>-<window>-<theme>-<lang>-<what>.png`;
  the records of every step with the measured values are `<scratch>/uat113/res/*.json` (one record per cell and step: scenario,
  cell, step, pass or fail, the observation). `<scratch>` is the session scratchpad folder.

## Scenarios

For each scenario: the action, the state asked for again after it, the comparison, and the numbers. "Block" is `section.info.now`.

**V-01 PASS (12 cells, 48 checks).** Action: tapped the five answers of the set "landing" one tap per question. Asked again: the last
question holds no block (0 on the page); the result holds exactly one block in `#demo` (and one on the page); heading, three rows, marks
«Работает»/«Пока нет»/«Пока нет» (en «Works»/«Not yet»/«Not yet»), the three lines and the closing text equal the words of the
scenario in ru and en; the block has 0 controls (`a`, `button`, `input`, `select`, `textarea`, `form`); the closing paragraph is a `p`
with no class `fine`, 16 px; the block comes before `.idea` in the document order, is not inside `.r-lines`, and its bottom edge is
above the top edge of `.idea` in every cell (gap 30 px at 1470, 22 px at 390 and 320); the first link after the block is «Описать идею» /
`/how.html#describe-idea`; the last list is «Чего Sai пока не делает» with 10 items; no console line, no exception. A reread of the
state after one second gave the same block. Positions: at 1470 the block starts at y 495 at the right of the receipt (left edge to the
right of the receipt's right edge); at 390 it starts at y 763 (ru) or 740 (en), at 320 at y 799 or 781, between the receipt and the panel.

**V-02 PASS (6 cells x 6 sets = 36 results + 6 console checks).** For landing, card-site, catalog, calculator, dashboard and
single-page-app the result names the expected kind, shows the same one block above the panel, `.rc-acc` is 1 with five full dots,
0 half, the text «5 из 5» (en «5 of 5») and the label «Учтено ответов» (en «Answers counted»), and the last list is the fixed list
with 10 items. Snapshots of every set at 1470 light ru and 390 dark en.

**V-03 PASS (12 cells x 2 answer sets, 48 checks).** (a) five «Не знаю» and (b) the server set: no kind and no fit label, `.rc-acc` is
0, the receipt body holds the no-match text, one block with the same parts above the panel, `.r-sum + .r-lines` holds, 10 items.
At 1470 the block is at the right of the receipt. At 390 and 320 the fixed list stands right under the receipt (390 light ru: receipt
bottom 679, list top 699) and the block after it (block top 1344, panel top 1863). No console line.

**V-04 PASS (12 cells x 2 checks).** `how.html`: the block comes after `section.intro` and before `ol.steps`, outside `div.panels` and
outside the `<!-- sai:order -->` regions, with the words of V-01; the sentence «Ниже описано, как работа будет устроена, когда этапы
запустятся.» (en «Below is how the work will go once the stages start.») comes after the block, before `div.how-stages`, outside the
block, the steps and any button. The top of the block with the page at the top: 557 px at 390x844 (all four theme and language
cells), 550 px at 320x568 (the window is 568 high), 688 (ru) and 662 (en) at 1470x784 - all inside the window height. No
horizontal scroll, no console line.

**V-05 PASS (6 cells x recommended and no-match).** `#demo .idea` holds `h3`, one `p.sub` with the lead («Сейчас идею описать в Sai нельзя:
по кнопке откроется подсказка, как о ней рассказать.» / «You cannot send an idea yet. The button opens tips on how to describe it.») and the
link «Описать идею»; nothing under the button; the count of elements with class `fine` is 0 in `#demo` and 0 on the whole page; the line
«В тестовом режиме идеи описывают только приглашённые участники.» is not on the result.

**V-06 PASS (6 cells, 3 checks each).** (a) landing: label, 5 full dots, «5 из 5», one sentence in the row after the dots
(«Чем больше ответов, тем надёжнее подсказка. «Не знаю» считается за половину.» / the English one). (b) four answers and «Не знаю» on
storage: the request body of the page has the four answers; the result still shows «Лендинг» (en «Landing page»), 4 full dots and 1 half
dot (5 in all, none empty), «4 из 5» (en «4 of 5»), the same sentence. The words «точность» and «accuracy» are on neither result.

**V-07 PASS (12 cells).** Each stage section is `h2`, the marks `p.stat-line`, (stage 1 only) the note, the stage text last. Stage 1:
«Работает» «Демо-опрос» and «Пока нет» «Опрос по вашей идее и ТЗ» (en the English pairs), then the note, then the text; stages 2 to 4: exactly
one «Пока нет» (en «Not yet») each. The two notes (the sentence under the block and the note of stage 1) are 16 px, no class `fine` or
`meta`, and their computed colour equals that of `body` (`rgb(23, 52, 58)` light; the same equality in dark), the same as the other
paragraphs. `ol.steps` holds four `button[data-step]` with `aria-pressed`; no mark or note stands inside a button.

**V-08 PASS (6 cells, 7 checks each).** On `how.html` after each press of step 1, 2, 3, 4, 1 the last line of the text list is «Вы у стола n:
<этап>» (en «You are at desk n: <stage>») after the walk, the pressed button is the only one with `aria-pressed="true"`, and the block, the
marks and both notes are unchanged (compared as text before and after). «Описать идею» on a result opens `/how.html#describe-idea`; in ru
the part holds the example «Страница для моей студии йоги: расписание занятий, тренеры и запись по телефону»; there is no input, textarea or
select in `main`. (The example text was compared in ru only.)

**V-09 PASS (12 cells x 5 checks).** A new profile (Russian) on `how.html`; presses «EN», «RU», «EN»: after each the heading and rows of the
block, the marks, the closing text, the sentence, the five stage marks and the note of stage 1 equal the words of the language pressed, no
Cyrillic letter is left on the English state, a marker set in the page survived all three presses (no reload), the address holds
`?lang=en`/`?lang=ru`, `html lang` follows. After the last press a reload stays English. No console line.

**V-10 PASS (6 cells x 4 checks).** (a) «EN» before the survey, the five answers with «Not sure» on storage in English: lead, label, sentence,
count «4 of 5» and the block in English, no Cyrillic letter on the result. (b) with the result open «RU» and then «EN»: the block, the lead,
the label, the sentence and the count text are in the new language, and the dots stay four full and one half.

**V-11 PASS (20 cells).** `how.html` at 1470, 390, 360, 380 and 320, both themes, both languages: scrollWidth does not exceed the window; 0 cut
texts; 1 880 visible texts read, 0 below 4.5:1 (the lowest is 5.02:1: the skip link text on the orange, which is outside the block);
0 texts on an image or without a known background; every button and link of the navigation at least 48 px (smallest 48 px); the marks are
`span` elements with tab index -1; the frame of each mark (an inset 2 px shadow, the look's frame) is at least 6.31:1 against its panel, the
fill of the filled mark at least 3.39:1, the text of the marks at least 5.02:1; 0 Content-Security-Policy violations; 0 console lines.

**V-12 PASS (20 cells x recommended and no-match = 40 results).** The same measures on the result, with the sentence on the cream surface of
the receipt, the panel and the fixed list: 2 540 texts read, 0 below 4.5:1 (lowest 5.02:1), 0 cut, no horizontal scroll, controls at least
48 px, marks as in V-11, the block above the panel in every cell, 0 CSP violations, 0 console lines.

**V-13 PASS (6 cells x 3 cases).** `/api/demo/questionnaire` answers 500, then 200 `not json`, then held until the page gives up: the plain message
(ru «Ошибка», «Не удалось загрузить данные» or «Нет связи с сервером», «Попробуйте ещё раз или вернитесь на главную.», «Повторить», «На главную»; the
English words in en) after 41 to 64 ms in the first two cases and 8.04 to 8.09 s in the held case; 0 blocks on the page; the header, the test-mode
line and the footer work; with a good answer let through, «Повторить» shows the first question and the survey reaches the result with one block.
Console: only the browser's one line of the failed request (500 case), none for the 200 and the held cases; no exception.

**V-14 PASS (6 cells x 4 cases).** `/api/demo/result` answers 500, then 200 `not json`, then refused as with no connection, then is held 4 s before the
good answer: the block and the panel stand on the result in every state (1 block, 1 `.idea`); the receipt holds the plain message in the receipt with
«Повторить» (en «Try again») plus «На главную»; while the held answer waits the receipt body is «Собираем результат…» (en «Putting the result together…»);
after the good answer the receipt shows «Лендинг» (en «Landing page») with its `.rc-acc` row and the block is still one. Console: the browser's line of the
failed request once for 500 and for the refused request, 0 for the others; no exception.

**V-15 PASS (6 windows x themes, ru).** JavaScript off by the browser setting: `how.html` is Russian; the block with its three rows, marks and closing
text, the sentence, the stage marks and the note of stage 1 equal the words of V-01, V-04 and V-07; in place of the picture stands the list of the four desks
(«1 · Принято — Руководитель проекта» ... «Вы у двери»); no horizontal scroll; 4 requests, all GET of files of the stand, none to `/api/`.

**V-16 PASS (6 cells).** `localStorage` and `sessionStorage` throw on read and write (injected at the start of the page, confirmed by a read in the page): `how.html`
shows the block in Russian; «EN» turns the block, the marks and the notes English at once; the demo reaches a result with the block; after a reload the language is
Russian again. 0 console lines, no exception.

**V-17 PASS (6 cells x 2 checks).** 400 kbit/s, 400 ms latency, cache off: `how.html` shows its block with the words after 5.66 to 5.69 s; the demo questions
after 7.33 to 7.38 s; the five taps with the result request delayed 3 s ended with the result and the block above the panel 6.39 to 6.43 s after the first
tap; no exception, no console line.

**V-18 PASS (6 cells).** "Reduce motion" emulated and read back (`matchMedia` true): the five taps give the result with the block above the panel (about 1.0 s for the run
of the five taps, the result and the open of `how.html`); `how.html` shows the block and the five marks; no exception, no console line.

**V-19 PASS (6 cells).** Three answers, another tab opened and activated for 10 s (the first tab reported `visibilityState` hidden, then visible again): the demo is on the
same question with the same strip («3 из 5» / «3 of 5»), the last two answers give the result with the block above the panel; no exception, no console line.

**V-20 PASS (on `<APP-PUBLIC>`, 6 cells, 37 checks).** `how.html` and the three results (recommended, "landing" with «Не знаю» on storage, five «Не знаю») show the
block, the sentence, the stage marks and the note, the lead, the label «Учтено ответов» and its sentence in ru and en with the words of V-01 to V-07; the language buttons are `ru` and `en` only; no
order text on `how.html` («Что можно заказать», «Примеры запросов» not found) and no link to the examples page; `?lang=kk` on `how.html` and on `demo.html` with nothing
stored gives Russian (`html lang` `ru`) and no storage entry; `GET /api/demo/questionnaire?lang=kk` on the public stand answers 200 in Russian; 0 console lines.

**K-01 not run: kk hidden, G9.** The button «ҚАЗ» was not pressed and `?lang=kk` was not opened on `<APP>`. No kk finding is recorded.

**R-01 not run by this role.** The reader test is a separate launch; the reader pack was prepared (below). The answers of the reader were not read and R-01 is not scored here.

## Failures

None. Three of my own check scripts first recorded red; the cause was in the script, not in the product, and each was corrected and re-run with the result PASS (listed so that nothing is hidden):
(1) V-01 and V-02 checked `.r-sum + .r-lines` and "the block after the lists" on a recommended result, which the criterion and the test of the base commit
(LD-6) require only for the no-match result - see remark 1; (2) V-09 started the English cells from a stored English, where pressing the already
current «EN» leaves the address without `?lang=` - a new profile starts Russian, so V-09 was run again from a Russian start; (3) V-14 required exactly one button in the receipt message while
the message has «Повторить» and «На главную». The re-runs are in the same folder (`res/s1-V01.json`, `res/s3-V09.json`, `res/s4-V14.json`).

## Remarks (AP-117; none is a failure of a criterion)

1. `.r-sum + .r-lines` on a recommended result. On a recommended result the fixed lists are appended after the block, the panel and the answer chips, so `.r-sum + .r-lines`
   is false; it holds on the no-match result, and the guard test LD-6 (`listAfterReceipt`) asserts it only there, at the base commit as well. Criterion 3 says it "still holds" without
   saying for which result: BA-ANALYST may make the sentence say "on the no-match result". The last list is the fixed list on both results.
2. The order of the parts on a narrow recommended result. V-01 says "at the narrow windows the receipt and the lists come first and the block is above the panel". Observed at 390 and 320:
   receipt, block, panel, answer chips, then the lists «Что входит», «Лучше другое решение, если», «Чего Sai пока не делает». The criterion (the block above the panel, the fixed list last) is met; the
   scenario sentence is wider than the criterion and does not match what is built (look 8.4 says the block stands above the panel). BA-ANALYST: correct the scenario text.
3. V-09 says a new profile; a press on the language that is already current (English stored) does not add `?lang=` to the address. Not in criterion 7.
4. The block on a recommended result at 320x568 starts at y 799 and at 390x844 at y 763-740 of the page, that is below the first screen at 320x568 and just inside it at 390x844 (look 8.4 names it; `decisions/0126`).
5. The English example sentence of the part «Как описать идею» in V-08 was not compared (the scenario quotes the Russian one only); the English page has no input field.
6. A visible Chrome was not started; the full-page snapshots are from the headless one.

## Not run

K-01 (kk hidden, G9, by design), R-01 (a separate reader), a visible Chrome, any test script of the app or of the tools (the owner's rule for this PC), anything on Vercel or on the internet.
Criteria that no person sees are not part of this record (see `docs/uat/REQ-113.md`, the list after the table): 1 and 2 (texts, lint) are TX-4, TX-2, TX-9, `check-public.js`; 9 and 13 are the release script, `git diff --stat`, `check.yml` and `app.yml`; 11 is DESIGN-QA-VALIDATOR and the owner (G21).

## The reader pack (for R-01, made by this role; not scored here)

Folder `reader-pack` in the scratch folder of this run (`<scratch>/uat113/reader-pack`): a plain `README.txt` (the one line «This is a website of a service called Sai. Read it as a visitor and answer the three questions.», Part A of R-01 copied word for word, and one line saying what the folder holds), and, for the windows 390x844 and 1470x784 in light, ru: `1-demo-start`, `2-demo-result-landing`, `3-demo-result-no-match`, `4-how-it-works`, each as a `.txt` (the visible text of the page, `innerText`) and a full-page `.png`, taken from `<APP>`. The folder has no repository text, no file names, no requirement word and nothing of Part B (a search of the folder for `REQ-`, `handoff`, `decisions`, `Part B`, `key` found nothing).
