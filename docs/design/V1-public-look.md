# V1 public look — Sai's landing, "how it works", examples, the demo survey and 404 in the approved v3 look

- **What this is.** The interface description of the public pages of PUBLIC-V1 milestone M1 (PLAN M1.4, PUBLIC LOOK
  lane of PLAN §4.1): WF-04 step 1, run `M1SITE-20261119-01`, step 03, written by GUI-DESIGN-ANALYST on 2026-11-19.
  Its gate is step 03b (CODE-DESIGN-VALIDATOR); gate pass 1 gave FAIL with findings F1–F12, closed by the rework step
  03c (the places carry the finding number, «(F<n>)»); gate pass 2 (step 03d) gave FAIL with findings G1–G9, closed by
  the rework step 03e («(G<n>)»; «(finding G8)» and «(finding G9)», as G8 and G9 also name owner gates); gate pass 3
  (step 03f) gave PASS with the low findings J1–J7, and the edit step 03g carries in what decisions/0123 (J3, J5, J7
  and its answer to J2 under question I2) and decisions/0124 (О11) route to this file («(J<n>)», «(О11)»), with its own
  check. It is the yardstick of DESIGN-QA-VALIDATOR (WF-04 step 4); the sample is the map. No code is written here.
- **Requirements.** REQ-111 (R1.2: landing, how it works, examples, the demo survey, themes, texts) and REQ-112 (R1.3:
  the office renderer in stage mode), written at the same time in step 01 of this run. They were not in
  `docs/requirements.yaml` when this file was begun (the last id was REQ-110); step 01 closed at 2026-11-19T11:21:48Z,
  and this file was then aligned with both blocks as they stand before their gate 02; the rework 03e aligns it with their
  text after step 01b — REQ-111's list «Чего Sai пока не делает» (G2) and REQ-112 criterion 4's palette (G3), which the
  blocks' own rework step 01c (after gate 02b) moves to this file's palette (question I1). Where a block decides
  behaviour (what is stored, what moves, what the demo asks), this file follows it and cites it as [R REQ-111] or
  [R REQ-112]. Section 14 maps their criteria, the PLAN M1 seeds and the blocks they rescope (REQ-028, REQ-071,
  REQ-085, REQ-086, REQ-087).
- **Sample.** `docs/design/samples/picker-v3-approved-2026-10-26/` (README.md, index.html, styles.css, app.js,
  office.js, data.js and eight snapshots in `shots/`). Approved by the owner's «да» on 2026-10-26: decisions/0083
  (status line and "Decision"). The sample is a mockup with two invented tenants («Складеон», «Лидвейв»); Sai's own
  site keeps its look and leaves out what the records forbid (section 4).
- **Precedence.** A recorded decision, ARCH and PLAN win over this file; this file wins over the sample. Every place
  where the sample is changed says why.

## 0. How values are marked

| Mark | Meaning |
|---|---|
| [M file:line] | read in the sample file at that line |
| [M shot] | read in a sample snapshot (`shots/<name>.png`) |
| [M run] | measured on a byte copy of the sample (the five files, sha256 equal to the folder) rendered in headless Chrome 157 on macOS through Sai's kit `tools/test/e2e/kit/` (fresh profile under a temporary root outside the project, loopback server, `?still=1`), windows 1470×784, 390×844, 320×568; text widths by canvas `measureText` in the sample's font stack on the same machine. Another system draws other fonts: a width measured here is a fact of macOS Chrome 157, not of every system (AP-158) |
| [C] | computed from marked values; the formula is given (contrast: WCAG 2.x relative luminance) |
| [T] | measured on a trial page outside the project in the same Chrome as [M run]: the sample's own `styles.css` with only the changes this file names for that part (the extra rules are listed in the handoff of step 03c, `prototype`; for the places marked (J<n>), in that of step 03g); used for the sizes of parts this file changes |
| [M build] | measured on the built page (the code of tag `base/M1CODE-20261119-01-review5`, run from a fresh copy with `node server/node-main.js`, `PORT=0`; headless Chrome 157 on macOS, an own temporary profile, windows 390×844, 360×640, 379×640, 380×640 and 320×568, ru, kk and en where a place says so; step 03i of run `M1SITE-20261119-01`, `prototype` of its handoff). Where a value is of the built page with rules added in the trial (the bar forced to `position: fixed`; the below-380 speaker rule overridden), the place says so. A width measured here is a fact of macOS Chrome 157, not of every system (AP-158) |
| [R source] | required by a record: a decision, ARCH, PLAN or an existing requirement block |
| [P] | proposed by this description, with the reason; DESIGN-QA compares it like any other value, the gate may reject it |
| [Q In] | an open question (section 16); the value written is the default used until ORCH answers (decision 0123) |

- Sizes are CSS px unless the word **logical** is written: logical px of the stage canvas, multiplied by the scale `s`
  (section 9.1) to get CSS px.
- Every visible text is a key of `app/public/shared/i18n/texts.js` (ARCH §17; REQ-111). Russian words quoted with [R]
  are fixed by a record. A slot written «<…>» is a placeholder: its wording belongs to REQ-111, and this file only fixes
  its place, its font and its length budget. The source of truth of a text is `texts.js` (AP-118).

## 1. Frame of the public pages

**The owner's words that set this look**, verbatim:

- 2026-10-27, `docs/owner-requests/2026-10-27-request-list-to-development.md`: «А тем не менее, также еще раз,
  входная точка должен быть сайт HTML, который ты нарисовал мне. Пусть он будет, да, пиксельным, но с оттенками
  современного дизайна.»
- 2026-10-26, decisions/0083: «да» (the third mockup — this sample — is the direction).
- 2026-11-17, decisions/0115: «Продолжи работу, так чтобы я получил готовый продукт»; to «Что вы считаете «готовым
  продуктом» Sai?» — «Публичный сайт V1 (Recommended)». PROGRESS.md, gate row «M1.1 narrowing»: «Сначала каркас
  (Recommended)».
- 2026-10-28, G18: «Да, новые по-английски (Рекомендую)» (this file is in English; page texts stay ru/kk/en).
- 2026-11-18 – 19, `docs/owner-requests/2026-10-27-public-launch-plan.md` (appended section): «пуш, брат. Я хочу
  чтобы ты меня понял в корне и дал мне результат. Исходя нашей переписки и в целом»; to «Как я понял: тебе нужен
  видимый результат — ссылка на сайт Sai, которую можно открыть с телефона, а не записи и инструкции. Делать так?» —
  «Да, сайт по ссылке (Recommended)», whose text was «Беру на себя работу ORCH: довожу и пушу то, на чём он застрял,
  собираю первый выпуск сайта Sai по плану (страница «закрытое тестирование», потом главная с пиксельным офисом и
  демо-опросом) и выкладываю на Vercel в твой аккаунт новым проектом sai. Без регистрации, заказов и данных. Займёт
  несколько часов, ссылку дам в чат.»

**Pages** [R PLAN M1.4]: `index.html` (landing with the stage scene), `how.html` (how it works), `examples.html`,
`demo.html` (the one-tap demo survey and its result), `404.html`. `gate.html` keeps its plain look [P]: the closed
build's output is only `index.html` = the bytes of `gate.html` (`docs/design/REQ-108-109-app-skeleton.md`, N6), so a
stylesheet link from it would fail.

**Never on a public page** [R]: agent events (decision 0083 item 7, decision 0097 item 1); prices, sales and ads (G8
default «б»); a field or a form that stores anything («Без регистрации, заказов и данных»); the brand «Claude Code»
(PLAN §4.8 item 11); the words `REQ-`, `handoff`, `ORCH`, `decisions` in any file of `app/public` (decision 0074 item 6;
ARCH §11.4); an external address (`app/scripts/check-public.js`).

**On every public page** [R]: the test-mode line «Sai работает в тестовом режиме: вход по приглашению, заказы не
принимаются» (PLAN M1 «Owner sees»; G8 default «the test-mode banner»; PLAN §4.8 item 14); `<meta name="robots"
content="noindex">` [M `app/public/index.html`] with the `X-Robots-Tag: noindex` header (ARCH §14.1).

**Two variants of the same pages** [R G8, G9]:

| Part | Local (`cd app && PORT=0 node server/node-main.js`, tests, the protected preview shown for G21) | Production while G8 is «б» and G9 is not answered |
|---|---|---|
| the kk button and kk texts | shown | hidden: only «RU», «EN» |
| «what Sai builds and does not build» on the landing (8.1, block D) and on how (8.2, block H3) | shown | not served |
| `examples.html` and every link to it | shown | not served, no link |
| the demo survey and its result | shown | shown [R REQ-111 criterion 9] |
| the list «Чего Sai пока не делает» on every demo result (7.14) | shown | shown [R REQ-111: its keys are no order texts] (G2) |
| everything else | shown | shown |

The rule that drops the order parts from the production build is REQ-111's. A dropped part leaves no gap: the next
block takes its place with the normal spacing [P].

## 2. Where each visible part takes its data

| Part | Source | Notes |
|---|---|---|
| every interface text | `texts.js` key → `{ru, kk, en}` [R ARCH §17] | words fixed by records: section 13.1 |
| questions and options: five single-choice questions with 2 to 4 options each | `GET /api/demo/questionnaire?lang=` built from `app/content/sai-intake.json`, format `sai-picker-tenant/2` [R ARCH §13; REQ-111] | read once per load of `demo.html`; the format /2 has no `desk` of a question and no `object` of an option, so the cards carry no icon (7.10) and the desk that asks comes from the step table (9.13) |
| the result: the kind of product, its summary, what it includes, what Sai cannot build yet, close options or no match | `POST /api/demo/result` (deterministic engine, stores nothing) [R ARCH §13; REQ-111] | one request when the result opens [P] |
| the pressed card, the current question, where «Вы» stands | the visitor's own taps on this page, held only in the page's memory [R «Без … данных»; REQ-111] | lost on reload or on leaving the page |
| the date on the result receipt | the browser clock shown in Astana time, UTC+5 [R decision 0083 item 8; ARCH §17] | the scene itself shows no time [R REQ-112] |
| colours | the CSS tokens of section 6, read by the scene once per change of the theme [R ARCH §11.4; REQ-112] | |
| staff figures and role titles | four fixed appearances (9.6); titles «Руководитель проекта», «Аналитик», «Разработчик», «Проверяющий» desk by desk — the `name` of project_manager, business_analyst, developer, reviewer in `tools/src/team/roles.js` [R REQ-112, its question О14] | no personal names [R ARCH §11.7] |
| language and theme choice | `?lang=`, else the stored one-word choice `sai-lang`; the theme stored as one word under `sai-theme`; both in `localStorage` inside try/catch [R ARCH §17; REQ-111, its question О2] | the only things kept in the browser (issue I3) |

Nothing on a public page comes from the engine journal, a hook, a project, a user or another visitor.

## 3. Inventory of the sample

Marks: **C** «переносится» (carried over), **CC** «переносится с изменением» (carried over with a change; the change
is named), **N** «не переносится» (not carried over; the reason is named). Numbers are referred to as `S<n>`.

### 3.1 Shell (index.html, styles.css, app.js)

| # | Sample part | Where | Mark | In Sai |
|---|---|---|---|---|
| S1 | skip link «К основному содержимому» | index.html:11; styles.css:20-21; data.js:10 | C | 7.1 |
| S2 | header bar: letter tile, name, language switch RU/ҚАЗ/EN, theme button with icon and label | index.html:13-19; styles.css:37-48; app.js:83-93 | CC | 7.2: the name is «Sai», the tile «S», the brand is a link to `/` at least 48×48 (F2); theme labels changed by decision 0084 item 15; kk hidden on production (G9) |
| S3 | stage band with the canvas | index.html:21-23; styles.css:51-55 | CC | 7.4, 9: on the landing, how and the demo only [R REQ-112]; the scene's words are DOM labels over the canvas built with `textContent` (`labels.js`, ARCH §11.4), as the sample's HTML layer, never HTML from a string |
| S4 | main panel | index.html:25; styles.css:77-78 | C | 7, 8 |
| S5 | footer: «Работает на платформе Sai» with the two-colour square | app.js:98; styles.css:247-250; data.js:10 | CC | 7.19: Sai's own short AI disclosure line in the same place and look |
| S6 | footer demo switchers «Демо: компания» and «Демо: этап» | app.js:95-99; data.js:38; shot stock-1470-light-10-my-3 | N | ARCH §11.7 (section 4, item 11) |
| S7 | footer link «Оператор» | app.js:99; data.js:37 | N | the operator board is not a public page (S31) |
| S8 | footer kk draft note | app.js:100; styles.css:255; data.js:39, 80 | CC | 7.19: shown only when kk is the page language, which is only local (G9); the text is REQ-111's |
| S9 | live region `#live` | index.html:28; styles.css:19; app.js:149 | C | 7.21 |
| S10 | print document `#printdoc` | index.html:29; styles.css:257-263; app.js:310-314 | N | nothing to print: no estimate (G8 «б»; ARCH §11.7 prices) |
| S11 | `?tenant=`, `?theme=`, `?still=1`, `?lang=` | app.js:24-26; README «Открыть» | CC | `?lang=` kept [R ARCH §17]; `?theme=`, `?tenant=` and `?still=1` dropped (the theme is stored, section 2; one site; reduced motion comes from the system, 10) |

### 3.2 Start screen (app.js:172-186)

| # | Sample part | Where | Mark | In Sai |
|---|---|---|---|---|
| S12 | eyebrow (tenant industry) | app.js:175; styles.css:83 | CC | 8.1 A: the fixed text «Sai — закрытое тестирование» [R REQ-111 criterion 1; REQ-108 criterion 4] in place of the industry (F3) |
| S13 | h1 headline | app.js:175; styles.css:79 | C | 8.1 A: «<landing h1>» |
| S14 | pitch | app.js:175; styles.css:84 | C | 8.1 A: «<landing pitch>» |
| S15 | big button «Начать — {n} вопросов» | app.js:176; data.js:12 | CC | opens `/demo.html` (the first question; G4); wording REQ-111 |
| S16 | «Продолжить с вопроса {i}» and «Сначала» | app.js:177; data.js:13 | N | answers are not kept between page loads («Без … данных») |
| S17 | meta line «Около 2 минут · без регистрации · цена сразу на экране» | app.js:178; data.js:12 | N | ARCH §11.7 «Около 2 минут» and prices; its place holds the AI disclosure line (8.1 A) |
| S18 | team list: four cards with avatar, name, role | app.js:179; styles.css:106-111 | CC | 7.7: role title and the desk's stage word instead of a name and a role (ARCH §11.6, §11.7); avatars at an integer scale (S55); by default the sample's row of four column cards with 72×78 avatars stays, its title line at 13/400 instead of the 16/900 name (finding G9), under the intro up to 1206 px and beside it from 1207, where the sample has it beside the intro from 1001 (J2); the option, a 2×2 grid of row cards with 48×52 avatars, is in 7.7 (F8; question I2; on the owner's list, section 17) |

### 3.3 Question screen (app.js:189-251)

| # | Sample part | Where | Mark | In Sai |
|---|---|---|---|---|
| S19 | question panel with the pixel tail that points at the asking desk | styles.css:115-118; app.js:165-169 | C | 7.9 |
| S20 | speaker: avatar, name, role | app.js:202; styles.css:120-124 | CC | role title and stage word, no name (7.9) |
| S21 | question title h2 | app.js:203 | C | from the questionnaire |
| S22 | progress pips and «Вопрос {i} из {n}» | app.js:204; styles.css:125-130; data.js:14 | C | 7.9 |
| S23 | «‹ Назад» | app.js:205; data.js:15 | C | 7.9 |
| S24 | one-tap answer cards: key hint, icon canvas, label, pressed mark | app.js:194-198; styles.css:132-141 | C | 7.10 |
| S25 | number question: four number chips and «Своё число» with a field and «ОК» | app.js:196, 199, 212; styles.css:144-147 | N | public pages have no typed input; the demo questions are single choice [R REQ-111 criterion 5] |
| S26 | «Не знаю» card with the sub-line «возьмём типовой вариант» | app.js:200; data.js:14 | CC | the card stays, the sub-line goes (ARCH §11.7; section 4, item 7) |
| S27 | live ticket: price range with a band, effort, fit %, precision pips, item lines, hint, «Хватит, покажите результат»; on a phone a fixed bottom bar with a sheet | app.js:216-228; styles.css:150-175, 311-323 | CC | 7.11: no price, band, effort or fit (ARCH §11.7); it shows the answers so far and «K из N»; the button stays; the phone toggle is 48 high, not the sample's 40 (styles.css:315), for REQ-111 criterion 12 (F2) |
| S28 | answer reaction: busy pose, bubble, courier sheet, prop on the desk, next question after 480 ms | app.js:229-246 | CC | 9.13: only the walk of «Вы» by the step table and the next question after 480 ms; no busy pose, bubble, courier or prop [R REQ-112: only «Вы» moves] |

### 3.4 Result screen (app.js:254-283)

| # | Sample part | Where | Mark | In Sai |
|---|---|---|---|---|
| S29 | h2 «Готово — вот что мы собрали» and the sub-line | app.js:261; data.js:22 | C | wording REQ-111 |
| S30 | receipt: header (tenant · package, date), price, effort, fit, precision | app.js:262; styles.css:181-184 | CC | 7.12: header «SAI · <…>» and the date; the main value is the kind of product; no price, effort, fit |
| S31 | request form: title, lead, contact field, error, «Отправить», «Написать в WhatsApp», «+ Добавить имя», fine print | app.js:263-269, 284-307 | N | no orders and no data (owner's words; G8; ARCH §11.7 leads and the WhatsApp number); its place and look hold the «Описать идею» panel (7.15) |
| S32 | answer chips: tap to change that answer | app.js:257-260, 275 | C | 7.13 |
| S33 | «Что входит» with a days column and the note «Ориентир, не оферта…» | app.js:160-164, 271; data.js:20 | CC | 7.14: no days column, no note; two more lists in the same look — «<not a fit if>» (`not_suitable_when`) and the fixed list «Чего Sai пока не делает» on every result [R PLAN M1; REQ-111] (G2) |
| S34 | actions «Печать», «Excel (CSV)», «PDF» | app.js:272, 281-282, 315-321 | N | nothing to export (S10) |

### 3.5 «Мой запрос» and the operator board

| # | Sample part | Where | Mark | In Sai |
|---|---|---|---|---|
| S35 | «Мой запрос»: request number, stage title, description, four steps done/now/wait, private link, copy button, sent time | app.js:323-341; styles.css:209-222; shot stock-1470-light-10-my-3 | N | no requests in V1 public pages; numbers and tokens are ARCH §11.7 items; the look of the four steps is reused on `how.html` (7.8) |
| S36 | «Мой запрос» not found: h1, «404», big button | app.js:328 | CC | the 404 page (8.5), without the scene [R REQ-112: the scene stands on the landing, how and the demo] |
| S37 | operator board: counters on the desks, tabs, four columns of request cards | app.js:343-374; styles.css:224-244; shots agency-1470-dark-12-board, agency-320-dark-12-board | N | owner's tool with invented leads; the admin board is M2 |

### 3.6 The office scene (office.js)

| # | Sample part | Where | Mark | In Sai |
|---|---|---|---|---|
| S38 | wall, wall base, trim lines | office.js:235 | C | 9.4 |
| S39 | checkered floor | office.js:237 | C | 9.4 |
| S40 | rug lane with dashes | office.js:239-243 | C | 9.4 |
| S41 | two windows: day sky, clouds, sun; night moon and stars; day light beams | office.js:245-257 | C | 9.4 |
| S42 | door with the sign (name, tagline) and the doormat | office.js:259-264, 397, 449; styles.css:63-66 | CC | 9.4, 9.7: «Sai» and a tagline in a DOM label |
| S43 | wall clock in Astana time | office.js:306-311 | N | the scene shows no time [R REQ-112]; its place stays plain wall |
| S44 | default wall decor per desk: pin board, binders, blueprint, certificate | office.js:303-304, 143-157 | C | 9.5 |
| S45 | plant at the right edge | office.js:268, 164-166 | C | 9.4 |
| S46 | desks, chairs, four people, hands, monitors, lamps, mugs, paper stacks, bell, red box, desk shadows | office.js:173-205, 266, 318-346 | CC | 9.5, 9.6: the four people keep the sample's appearances without names, in still poses (no idle motion [R REQ-112]) |
| S47 | printer at desk 4 whose paper grows with the answers | office.js:158-162, 316 | CC | 9.5: still, with a fixed sheet (the scene shows no count [R REQ-112]) |
| S48 | props from answers (15 object ids) with a drop-in and a sparkle | office.js:56-170, 272-291, 490-500 | N | the intake /2 has no objects [R REQ-111], and the scene takes only its words and the step of a tap [R REQ-112] |
| S49 | desk plates «N · ПРИЁМ»… with states now, done, wait | office.js:400, 450, 468-472; styles.css:56-62 | CC | 9.7: the owner's stage words in two lines, DOM labels as in the sample; done and wait are not used |
| S50 | «Вы» label over the visitor with a bob | office.js:406, 451; styles.css:67-68, 272 | CC | 9.8: a DOM label, no idle bob [R ARCH §11.6; REQ-112] |
| S51 | speech bubbles | office.js:404-414, 501-508; styles.css:69-70; data.js:157 | N | no bubble that comes and goes by time [R REQ-112, its question О15] |
| S52 | courier sheet flying between desks | office.js:358-363, 504-507 | N | only «Вы» moves [R REQ-112] |
| S53 | light layer: dimming with light cones over lit desks; warm lamp glow at night | office.js:364-381 | CC | 9.11: the sample's light levels and its overlapping bands (F5); switched at once by a tap; drawn with filled rectangles whose `fillStyle` carries the alpha, no off-screen layer, no `destination-out` |
| S54 | stamp «ГОТОВО» with a slam | office.js:415, 510; styles.css:73-74, 268, 274 | N | no status in the scene [R REQ-112]; its translucent background also gave 2.24:1 on the dark wall [C] |
| S55 | avatars: a 24×23 canvas shown at 72×78 (team) and 48×52 (speaker) | app.js:147; styles.css:110-111, 121 | CC | 9.15: 24×26 logical at an integer scale of 2 (the sample's vertical scale is 3.39) |
| S56 | card icons: a small canvas per option | app.js:144-146, 197; office.js:511-520; styles.css:139 | N | the intake /2 has no objects [R REQ-111]; an option card takes the look of the sample's «Не знаю» card with the card fill (7.10) |
| S57 | result extras: folder and stamp tool at desk 4 | office.js:349, 357 | N | [R REQ-112: only words and the tap step] |
| S58 | «Мой запрос» marks: green flags, the folder marker | office.js:348, 352-356 | N | S35 |
| S59 | board strip: counters, clickable plates | office.js:325, 401, 453-456, 509 | N | S37 |
| S60 | camera pan on narrow windows | office.js:476-486 | CC | 9.14: the sample's framing and offsets, with the visible range per page and window (F7); eased by the frames of the walk with the sample's curve and time, not by a CSS transition (10, F9) |

### 3.7 Data, texts and hooks (data.js, app.js)

| # | Sample part | Where | Mark | In Sai |
|---|---|---|---|---|
| S61 | two tenants: names, colours, staff names, phrases, questions, item lines, rates, demo leads | data.js:134-316 | N | invented content; Sai's content is REQ-111's and `sai-intake.json` |
| S62 | interface texts ru/kk/en | data.js:8-131 | N | texts are written new by REQ-111; the kk draft is ARCH §11.7 (section 4, item 13) |
| S63 | theme labels «Авто», «День», «Ночь» and the button name «Свет» | data.js:10-11 | CC | «Авто / Светлая / Тёмная» [R decision 0084 item 15]; the name «Тема» [Q I4] |
| S64 | keyboard: digits, 0, Backspace, arrows, Shift+Enter, Escape | app.js:391-403; README «Клавиатура» | C | 12 |
| S65 | browser storage `sai3.*` (answers, theme, language, tenant, requests) | app.js:24-32, 81, 288-306, 380, 383 | CC | only `sai-lang` and `sai-theme`, one word each [R REQ-111]; no answers, tenant or requests |
| S66 | `window.__taps`, `window.__sai` | app.js:379, 415 | N | test hooks of the mockup |
| S67 | `wa.me` links and the CSV download | app.js:303, 319-320, 370 | N | external address; no export |
| S68 | sequential request numbers and `Math.random` tokens | app.js:291, 294, 298 | N | ARCH §11.7 |
| S69 | snapshot with a local file path | shots/stock-1470-light-10-my-3.png | N | ARCH §11.7 |

## 4. Not carried over: ARCH §11.7 item by item

| # | ARCH §11.7 item | Where the sample has it | What Sai does |
|---|---|---|---|
| 1 | `innerHTML` | app.js:86, 98, 175, 202, 261, 312, 328, 333, 355; `outerHTML` app.js:240; office.js:449 | every element is made with `document.createElement`, every text set with `textContent` (section 5) |
| 2 | inline `style=` | app.js:152 (`<i style="left:…;width:…">` in the price band); property writes app.js:71-75, 110-111, 168; office.js:397-415, 443-444, 484-485, 516 | no `style=` in any file; dynamic geometry only by the means of section 5.2 |
| 3 | leads in `localStorage` | app.js:288-306 (`sai3.reqs.<tenant>`, `sai3.my.<tenant>`), answers app.js:31-32 | no request exists; answers live only in the page's memory |
| 4 | sequential request numbers and `Math.random` tokens | app.js:291 (1040 + 7·i), 294, 298; shown in shots stock-1470-light-10-my-3 («СК-2026-1090»), agency-1470-dark-12-board | none; `Math.random` is also banned in `office/` by `check-public.js` |
| 5 | accents below 3:1 | styles.css:6 and data.js:145: `--btn`/`--acc` `#e0731f` is 2.72:1 on `--bg` `#f6eddc` and 2.91:1 on `--paper` [C]; the focus ring `--acct` `#ffb06b` is 1.74:1 on the cream `--rc` in dark [C] | light UI accent `#ce6a1d`, 3.17:1 on `--bg`; the ring of the controls on `--rc` is `--ring-rc` (section 6.3, F1). The canvas keeps the sample's `#e0731f`: an illustration colour, not a UI accent (6.2, 6.3, F9) |
| 6 | «Около 2 минут» | data.js:12 (ru), 53 (kk), 94 (en) | not written; `check-public.js` refuses the phrase |
| 7 | «возьмём типовой вариант» | data.js:14 (ru), 55 (kk), 96 (en); shots stock-1470-light-05-ask5, agency-1470-dark-05-ask5 | «Не знаю» has no sub-line; `check-public.js` refuses «типовой вариант» |
| 8 | a fit percentage | app.js:57, 157, 219, 312, 371; data.js:18; shots *-05-ask5, stock-1470-light-06-result, agency-1470-dark-12-board | none |
| 9 | prices | app.js:55-56, 62, 155, 318, 371; data.js:143, 233; the same shots | none (also G8 «б»; the forbidden-words lint, ARCH §17) |
| 10 | the demo WhatsApp number | data.js:143, 233; app.js:303, 370; shot stock-1470-light-06-result | none; no external address |
| 11 | demo switchers | app.js:94-99, 380-382; shot stock-1470-light-10-my-3 | none |
| 12 | invented staff names | data.js:152-155, 242-245; shots *-01-start, *-05-ask5 | role titles only (7.7, 7.9) |
| 13 | the kk draft texts | data.js:50-90 and the kk fields of both tenants; README «Оговорки» | kk texts written new by REQ-111, built and tested, hidden on production until G9 |
| 14 | the snapshot that shows a local file path | shots/stock-1470-light-10-my-3.png, the field «Личная ссылка — сохраните её» | the snapshot is no reference for any area of Sai; DESIGN-QA does not compare against that field |

## 5. CSP and markup rules

**5.1 Rules** [R ARCH §14.1: `script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src
'self'`; PLAN AC1.6]:

1. No `style=` attribute in any file of `app/public`; no `<style>` element; no `<script>` without `src` (every script is
   `<script type="module" src="/js/…">`); no `on…=` attribute.
2. No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`. Elements are made with
   `document.createElement`; every text, also a text from the server, is set with `textContent`.
3. No `setAttribute("style", …)` and no `.style.cssText`. The CSP refuses the first (measured in
   `handoffs/PAGE057-20261021-01/step-01-gui-design-analyst.json`, `self_check`: «setAttribute style запрещён», while a
   single property write worked). The ban of `.style.cssText` is a rule of the code [R REQ-111 criterion 10], not of
   the CSP: the CSP of Chrome 157 does not refuse it (О11; measured in the handoff of step 03g, `self_check`: on a
   trial page under the app's CSP header in headless Chrome 157 on macOS, `cssText` was applied with no violation,
   while `setAttribute("style", …)` was not applied and raised one `style-src-attr` violation; the same as fact F26 of
   `docs/design/REQ-111-112-public-landing.md`).
4. No external address anywhere (no font, image, script or link to another host); fonts are system stacks (6.4);
   the only image source is the canvas; the icon is `<link rel="icon" href="data:,">` [M `app/public/index.html`].
5. Every `href` and `src` is root-relative — one `/` first, never `//`, `./`, `../` or a scheme — or an anchor `#<id>` of
   the same page, or the icon's `data:` address [R REQ-111 criterion 1] (G4): asset paths `/css/…`, `/js/…`, `/office/…`,
   `/shared/…`; page links `/`, `/how.html`, `/how.html#stage-1` … `/how.html#stage-4`, `/how.html#describe-idea` (the
   part «Как описать идею», 8.2 H3; the id is [P]), `/demo.html`, `/examples.html` (local only); the skip link `#main`.
   `404.html` is served for any unknown path at any depth (`app/vercel.json`, the last route), where a relative address
   would point elsewhere.

**5.2 Dynamic geometry.** The sizes that depend on the window — the unit `--px` (= `s` px), the stage height, the canvas
size, the camera offset, the places of the scene's DOM labels (9.7, 9.8) and the tail of the question panel — are set
only by these means, in this order of preference [P]: (a) CSS classes and media queries (the scale `s` and the narrow
rule are media-query facts that the script reads, one source for both: 9.1, G7); (b) the canvas `width` and `height`
attributes; (c) `scrollLeft` of the stage for the camera; (d) single CSSOM property writes
(`element.style.height = …`, `element.style.setProperty("--tx", …)`), only on the elements and properties the code design
lists in a closed list, from `app/public/office/view.js` and `app/public/js/pages/demo.js`. Which of them each size uses is
the code design's choice; the values are fixed here.

## 6. Tokens

### 6.1 Page colour tokens (`app/public/css/tokens.css`)

The sample sets its palette per tenant at run time (app.js:66-77). Sai's site has one palette: the sample's default
(the tokens of styles.css:3-7, which are the «Складеон» palette, data.js:144-149) [P: the only palette the stylesheet
itself sets], with two changes for the 3:1 of accents (ARCH §11.7, §17): the light `--btn` and the new `--ring-rc` (F1).
It also names as tokens the colours the sample writes as literals in its rules, so that every pair of 6.3 is a pair of
tokens of this file (G6): `--rcerr`, `--rcpip` and the plate tokens.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#f6eddc` [M styles.css:5] | `#0d1b1e` [M data.js:148] | page, header, footer |
| `--paper` | `#fbf5e8` [M styles.css:5] | `#13282c` [M data.js:148] | main panel, caption band |
| `--card` | `#fdfbf5` [C app.js:71: `--paper` mixed with white by .55; the `#fffaf0` of styles.css:5 is overwritten at run time] | `#24373b` [C app.js:71, .07] | cards, team cards, panels, the test-mode strip |
| `--ink` | `#17343a` [M styles.css:5] | `#f2ead8` [M data.js:148] | text, pixel frames, outlines |
| `--ink2` | `#4a5d60` [M styles.css:5] | `#a9bcbf` [M data.js:148] | secondary text, control borders |
| `--btn` | `#ce6a1d` [P: the sample's `#e0731f` (styles.css:6) is 2.72:1 on `--bg`; same hue, HSL lightness .50 → .46] | `#e0731f` [M data.js:145] | the UI accent: button fill, the selected step, pips, the «Вы» label and the door sign's band (DOM labels that use `--btn` in the sample, styles.css:63, 67); not the canvas, which keeps the sample's `#e0731f` (6.2, F9) |
| `--onbtn` | `#1b1208` [M styles.css:6] | `#1b1208` [M data.js:145] | text on `--btn` |
| `--acct` | `#9a4306` [M styles.css:6] | `#ffb06b` [M data.js:145] | eyebrow, links, the focus ring on `--bg`, `--paper` and `--card`, the pressed-card border, the active language underline |
| `--ring-rc` | `#ce6a1d` [P] | `#9a4306` [P] | the focus ring of the controls that stand on the cream `--rc` (7.20): `--acct` there would be 1.74:1 in dark; the values are ≥ 3:1 against `--rc` and against the `--ink` frame next to the ring in each theme (6.3, F1) |
| `--acc2` | `#1f7a8c` [M styles.css:6] | `#1f7a8c` [M data.js:145] | half of the footer square; never on `--card` in dark (2.51:1). The canvas uses the same value as its constant «accent 2» (6.2) |
| `--shadow` | `rgba(40, 30, 20, .28)` [M styles.css:6] | `rgba(0, 0, 0, .55)` [M app.js:75] | the hard drop of the pixel frame |
| `--rc` | `#fffbf0` [M styles.css:7] | `#fffbf0` [M: no dark value in the sample; shot agency-1470-dark-05-ask5 shows a cream ticket] | the cream areas: the live strip, the phone bar and its sheet, the receipt, the example cards; what stands inside them takes the on-cream values of 6.6 (G1) |
| `--rcink` | `#241c12` [M styles.css:7] | same | text on `--rc`; the hover colour of a link on `--rc` (6.6) |
| `--rc2` | `#62564a` [M styles.css:7] | same | secondary text on `--rc` |
| `--rcline` | `#cfc2a8` [M styles.css:7] | same | dashed rule on `--rc` |
| `--rclink` | `#7a3606` [M styles.css:157, 324] | same | a link or a toggle on `--rc` |
| `--chip` | `#efe6d2` [M styles.css:171] | same | answer chips inside the live strip |
| `--rcerr` | `#a3261d` [P: the sample's light error colour, styles.css:199] | same | the error label on `--rc` (the receipt's failure state, 7.18): 7.12:1 in both themes; the sample's dark `#ff9b90` (styles.css:200) would be 1.96:1 there [C] (G1) |
| `--rcpip` | `#8f8372` [M styles.css:165] | same | the 2 px edge of an empty pip on `--rc` (7.11, 7.12) (G6) |
| `--err` | `#a3261d` [M styles.css:199] | `#ff9b90` [M styles.css:200] | the error label on `--paper` and `--card` (on `--rc`: `--rcerr`) |
| `--plate` | `#f4efe3` [M styles.css:56, 63] | same [M shot agency-1470-dark-05-ask5: light plates in the dark theme] | the desk plates, the door sign and the plates of the text view (9.7, 9.16) (G6) |
| `--plate-ink` | `#2a2118` [M styles.css:56, 63] | same | text on a plate; «Sai» on the door sign |
| `--plate-ink2` | `#5d5140` [M styles.css:66] | same | the door sign's tagline |
| `--plate-edge` | `#8a7a60` [M styles.css:56, 63] | same | the 1 px inset edge of a plate and of the door sign |
| `--plate-now` | `#ce6a1d` [P: the sample's current plate is `--btn`, styles.css:59; 9.7] | same | the fill of the current plate; its text is `--onbtn` |
| `--plate-now-edge` | `#17343a` [M styles.css:5, 59: the sample's `--ink`] | `#f2ead8` [M styles.css:59, data.js:148: the sample's `--ink` of the dark theme, a light edge, as shot agency-1470-dark-05-ask5 shows it in that tenant's `#f6e9f1`, data.js:238] (J7) | the 1 px inset edge of the current plate |

Theme: the dark values apply under `@media (prefers-color-scheme: dark)` to `:root` without `data-theme="light"`, and to
`:root[data-theme="dark"]` in any case; «Авто» means no `data-theme` attribute, so a page without scripts follows the
system too [P; the sample sets `data-th="day|night"` by script, app.js:70]. `<meta name="color-scheme" content="light
dark">` stays [M index.html:7].

The dark reference for DESIGN-QA (F12): the approved snapshots show the dark theme only for the other tenant
(«Лидвейв», shots agency-1470-dark-05-ask5 and agency-*-12-board), while the dark palette here is «Складеон»'s night
palette (data.js:148-149). The reference for the dark theme is therefore the sample itself rendered as
`index.html?tenant=stock&theme=dark&still=1` at the three windows in a fresh browser profile (the sample keeps the
answers and the theme in `sai3.*` keys of `localStorage`, app.js:24-32, so an old profile shows other states). Rendered
so in this rework [M run, step 03c]: the computed tokens are `--bg #0d1b1e`, `--paper #13282c`, `--card #24373b`, `--ink
#f2ead8`, `--ink2 #a9bcbf`, `--btn #e0731f`, `--acct #ffb06b`, `--rc #fffbf0` and the stage `#1b363c`, equal to the
dark column above; this file adds only `--ring-rc` to it (D7, section 17).

### 6.2 Scene tokens and scene constants

The palette that `draw.js` gets, read by `view.js` from `tokens.css` once per change of the theme [R ARCH §11.4; REQ-112
criteria 4 and 5] (G3), is exactly this: the 24 colour tokens of the table below (`--sc-wall` … `--sc-dim`, each of the
form `#rrggbb`), the number `--sc-dim-alpha` (its last row) and the page token `--ink`; nothing else. Light and dark
values are the sample's «Складеон» scene palette [M data.js:145-149; office.js:27-37]. Where the sample derives a colour
while it draws, with `shade()` or `mix()` (office.js:21-23: each channel `Math.round(a + (b − a)·t)`; `shade(c, t)` mixes
with black for t < 0 and with white for t > 0), the result is written here as a value computed by that rule [C];
nothing is shaded or mixed while drawing (F6), and the one value computed while drawing is the light layer's alpha
(9.11, G3).

| Token | Light | Dark | Source |
|---|---|---|---|
| `--sc-wall` | `#eadcc2` | `#1b363c` | data.js:147/149 (also the stage background, styles.css:51) |
| `--sc-wall-top` | `#d3c6af` | `#13262a` | [C office.js:235: `shade(wall, −.1)` / `shade(wall, −.3)`] |
| `--sc-wall-b` | `#dcc8a6` | `#142a2f` | data.js:147/149 |
| `--sc-trim` | `#b99a6a` | `#2c5059` | data.js:147/149 |
| `--sc-floor-a` | `#e6d4b4` | `#13252a` | data.js:147/149 |
| `--sc-floor-b` | `#dec9a5` | `#112024` | data.js:147/149 |
| `--sc-sky` | `#bfe3ee` | `#0b1626` | data.js:147/149 |
| `--sc-wood-d`, `--sc-wood-m`, `--sc-wood-l` | `#a97646`, `#c28f5a`, `#d9ab74` | `#4a3626`, `#6b4f37`, `#805e42` | data.js:147/149 |
| `--sc-desk-hi` | `#e3c097` | `#a08671` | [C office.js:331: `shade(wood-l, .25)`, the desk top's highlight row] |
| `--sc-metal` | `#9aa6bb` | `#8a97ad` | office.js:33 |
| `--sc-paper` | `#fbf8ef` | `#d9d4c6` | office.js:33 |
| `--sc-chair` | `#418e9d` | `#3c4b6a` | [C office.js:34: `mix(#1f7a8c, #ffffff, .15)`] / office.js:34 |
| `--sc-chair-hi` | `#71aab6` | `#6d788f` | [C office.js:178: `shade(chair, .25)`, the chair's top 2 rows] |
| `--sc-chair-lo` | `#316b76` | `#2d3850` | [C office.js:178: `shade(chair, −.25)`, the chair's bottom 2 rows] |
| `--sc-rug` | `#9ab2a5` | `#11434d` | [C office.js:32: `mix(#1f7a8c, floor-a, .62)` / `shade(#1f7a8c, −.45)`] |
| `--sc-rug-edge` | `#e0731f` | `#924b14` | [M office.js:32: the accent / C: `shade(#e0731f, −.35)`]; the light value is the sample's accent, not the UI `--btn` (F9) |
| `--sc-jacket` | `#1d7485` | `#2a8192` | [C office.js:208: `shade(#1f7a8c, −.05)` / `shade(#1f7a8c, .05)`] |
| `--sc-jacket-hi` | `#4a909d` | `#559aa8` | [C office.js:213: `shade(jacket, .2)`, the jacket's top 2 rows] |
| `--sc-jacket-lo` | `#165764` | `#20616e` | [C office.js:208, 213-214: `shade(jacket, −.25)`, the jacket's bottom 2 rows and the arms] |
| `--sc-pack` | `#1a6675` | `#257280` | [C office.js:215: `shade(jacket, −.12)`, the backpack] |
| `--sc-pack-hi` | `#348291` | `#3f8e9d` | [C office.js:215: `shade(jacket, .1)`, the backpack's top row] |
| `--sc-dim` | `#3a2a18` | `#050a14` | office.js:368: the colour of the light layer (9.11) |
| `--sc-dim-alpha` | `.15` | `.5` | office.js:366: the strength of the light layer — a plain number in `tokens.css`, not a colour (9.11) (G3) |

Not drawn (F6): the sample's switched-off screen (`#2a3b52` / `#18283b`, office.js:34, 80, 82) is no part of Sai's scene
and no token. The strength of the light layer reaches `draw.js` as the number `--sc-dim-alpha` of the palette, the form
REQ-112 criterion 4 asks [R] (G3): .15 (light) and .5 (dark) [M office.js:366]. The one rule that derives fills from it
is written in 9.11 (an rgba of `--sc-dim` whose alpha is the strength times a product of the closed list of band factors,
rounded half up to 4 decimals), and its results for .15 and .5 are the closed alpha lists there. The one page token the
canvas reads is `--ink`: the certificate's top line (office.js:156, `K.ink`, the page ink of the theme). The canvas reads
no `--btn`, `--onbtn` or `--acc2` (G3): the sample's canvas takes its two accents from the tenant palette's `accent` and
`accent2` (office.js:31), which also feed the sample's CSS `--acc` and `--acc2`, not `--btn` (data.js:145 holds `accent`
and `btn` as two keys; app.js:73-74; styles.css:6), and it draws nothing in `--onbtn`; Sai keeps the two accents as the
constants below (F9). REQ-112 criterion 4 as step 01b wrote it named «(`--btn`, `--onbtn`, `--ink`, `--acc2`)»; its
rework step 01c names this palette (question I1).

Scene constants, the same in both themes [M office.js and data.js at the lines named; C where a shade is computed by the
rule above] (F6):

- accents: `#e0731f`, the sample's accent (its CSS `--acc`, styles.css:6) — monitor code lines, binders 1 and 5, the
  certificate's mark, desk 1's shirt (office.js:85, 148, 156; data.js:145, 152); `#1f7a8c`, accent 2 — the door, binder
  2, desk 2's shirt (office.js:148, 261; data.js:145, 153). The canvas does not use the UI token `--btn` (F9);
- door: top highlight `#579ba9` [C `shade(#1f7a8c, .25)`], panel `#196270` [C `shade(#1f7a8c, −.2)`], knob `#e8b64c`
  (office.js:261-262);
- windows: clouds and stars `#ffffff`, sun `#ffe9a0`, moon `#f4ecc8` (office.js:251-253); light theme only, the light
  beams `rgba(255, 242, 184, .16)` (office.js:256);
- shadows: the desk shadows and the visitor's shadow `rgba(0, 0, 0, .22)` (office.js:210, 266);
- plant `#8a5a3c`, `#a8723f`, `#2e9a55`, `#41a15f` (office.js:165);
- pin board `#c9a073`, `#f4d777`, the red pin `#d8473f`, the green pin `#3fae6a` (office.js:144-145);
- binders `#6aa3b5` and gold `#e8b64c`, with the light edges `#e99d62`, `#62a2af`, `#97bfcb`, `#efcc82` [C `shade(c, .3)`
  of `#e0731f`, `#1f7a8c`, `#6aa3b5`, `#e8b64c`] (office.js:148-149);
- blueprint `#2f6fa6`, `#3b86c4`, `#cfe6f7` (office.js:152-153);
- the certificate's second line and the printer's paper lines `#8a97ad` (office.js:156, 160);
- printer `#cdd3de`, `#eef1f6`, `#9aa6bb`, `#2c3547`, its light `#3fae6a` (office.js:161);
- monitor frame `#0d1420`, screen `#10283a`, code lines `#9fd0e6` and the accent (office.js:80, 85);
- mug `#f2f2f2`, coffee `#6a4a2c`, the steam pixel `#ffffffaa` (office.js:163; drawn, as frame 1 has it, 9.5);
- lamp bulb on `#ffd98a`, off `#7a8499` (office.js:340); dark theme only, the lamp glow `rgba(255, 217, 138, .16)` and
  `rgba(255, 217, 138, .12)` (office.js:381; 9.11);
- desk items: the paper stacks `#e8e3d4` (office.js:343-344); the bell `#e8b64c` with its light `#f1d394` [C
  `shade(#e8b64c, .4)`] (office.js:107); the red box `#d8473f` with its top row `#e47e79` [C `shade(#d8473f, .3)`]
  (office.js:346);
- people (9.6): skins `#f0cfae`, `#e7bd96` and their shade `#ceb296`, `#c7a381` [C `shade(skin, −.14)`, office.js:175: the
  neck, the chin row and the closed mouth]; hair `#2b1d17`, `#1f1a17`, `#6a4a2c`, `#241915`; shirts `#e0731f`, `#1f7a8c`,
  `#c99a2e`, `#2f5560` (data.js:152-155) with their top rows `#e68c47`, `#4792a1`, `#d3ac54`, `#54747d` [C
  `shade(shirt, .18)`] and their bottom rows, arms and the cap `#af5a18`, `#185f6d`, `#9d7824`, `#25424b` [C
  `shade(shirt, −.22)`] (office.js:175, 180-184, 194); eyes `#1d1712`, cheeks `#e8a08c`, the open mouth `#8a3a30`, hands
  `#e9c4a0` (office.js:197-202);
- the visitor (9.8): legs `#2d3446`, shoes `#161b26`, hair `#3a2c22`, neck `#d9b08a`, hair top `#2a1f18`
  (office.js:211-217);
- the light layer (9.11) is no constant: an rgba of the token `--sc-dim` — `rgba(58, 42, 24, a)` in light,
  `rgba(5, 10, 20, a)` in dark — whose alpha a comes from `--sc-dim-alpha` by the rule of 9.11 (G3).

Every `fillStyle` the canvas uses is a colour token of the table, the page token `--ink`, a constant of this list, or the
light layer's rgba of `--sc-dim` with the alpha of 9.11 [R REQ-112 criterion 4]; the shades the sample computes while
drawing are values here (F6). The labels over the canvas are CSS in the plate tokens of 6.1 — `--plate`, `--plate-ink`,
`--plate-ink2`, `--plate-edge`, `--plate-now`, `--plate-now-edge`, with `--onbtn` on the current plate and `--btn` in the
door sign's band [M styles.css:56, 59, 63, 66] (G6).

### 6.3 Contrast (computed)

[C] WCAG 2.x relative luminance, (L1 + 0.05) / (L2 + 0.05), on the hex values above; the script and its output are in the
handoff `self_check`. Text pairs need 4.5:1, accents, focus rings and control borders 3:1 [R ARCH §17; PLAN AC1.5].

| Text pair | Light | Dark |
|---|---|---|
| `--ink` on `--bg` / `--paper` / `--card` | 11.37 / 12.17 / 12.77 | 14.70 / 12.82 / 10.41 |
| `--ink2` on `--bg` / `--paper` / `--card` | 5.97 / 6.39 / 6.71 | 8.92 / 7.77 / 6.31 |
| `--acct` on `--bg` / `--paper` / `--card` | 5.68 / 6.08 / 6.38 | 9.79 / 8.54 / 6.93 |
| `--onbtn` on `--btn` (buttons, also those on `--rc`; «Вы») | 5.02 | 5.84 |
| `--onbtn` on `--plate-now` (the current plate, 9.7) (G6) | 5.02 | same |
| `--ink` / `--acct` on the pressed card (`--btn` 16 % into `--card`: `#f5e4d2` light, `#424137` dark) | 10.64 / 5.32 | 8.58 / 5.71 |
| `--rcink` / `--rc2` / `--rclink` on `--rc` (6.6: text, secondary text, links; a link's hover is `--rcink`) | 16.25 / 6.89 / 8.61 | same |
| `--rcerr` on `--rc` (the error label of the receipt's failure state, 6.6) (G1) | 7.12 | same |
| `--rcink` on `--chip` | 13.54 | same |
| `--err` on `--paper` / `--card` | 6.78 / 7.11 | 7.56 / 6.14 |
| `--plate-ink` on `--plate` (plates, «Sai» on the door sign, the text view) (G6) | 13.77 | same |
| `--plate-ink2` on `--plate` (the door sign's tagline) (G6) | 6.74 | same |
| `--ink` on `--sc-wall` (the «Вы» line of the text view, 9.16) (G1, G6) | 9.77 | 10.70 |

| Accent, ring or border | Light | Dark |
|---|---|---|
| `--btn` against `--bg` / `--paper` / `--card` / `--rc` (on `--rc`: the boundary of a button and the fill of a full pip, 6.6) | 3.17 / 3.39 / 3.56 / 3.56 | 5.57 / 4.86 / 3.94 / 3.06 |
| `--acct` (focus ring, underline) against `--bg` / `--paper` / `--card` | 5.68 / 6.08 / 6.38 | 9.79 / 8.54 / 6.93 |
| `--ring-rc` (the focus ring of the controls on `--rc`, 7.20) against `--rc` | 3.56 | 6.39 |
| `--ring-rc` against the `--ink` frame next to the ring (`#17343a` light, `#f2ead8` dark; the frame of «<enough…>», which the ring touches at s = 4) | 3.59 | 5.52 |
| `--ink2` (pips off, «Не знаю» frame, the 2 px edge of the step number square, 7.8) against `--paper` / `--card` | 6.39 / 6.71 | 7.77 / 6.31 |
| `--rcpip` against `--rc` (the edge of an empty pip, 6.6) [M styles.css:165] (G6) | 3.59 | same |
| `--acc2` (footer square) against `--bg` | 4.28 | 3.54 |
| `--ink` (pixel frames) against `--bg` | 11.37 | 14.70 |
| `--plate-now` against `--plate` (the current plate beside the others, 9.7) (G6) | 3.21 | same (the dark `--btn` `#e0731f` would give 2.76) |

The scene's illustration colours carry no meaning alone: the meaning is in its labels (plates, the door sign, «Вы»; all
above 4.5:1) and in the text list for screen readers (9.16) [P].

What the two tables are (F1, G6): every row is a pair of tokens of `tokens.css` (6.1, 6.2) that the theme-contrast test
of REQ-111 criterion 4 reads from that file, in both themes; the one computed colour is the pressed card,
`color-mix(in srgb, var(--btn) 16%, var(--card))`, which the test computes from those two tokens by the same rule (each
channel `round(.16·btn + .84·card)`: `#f5e4d2`, `#424137`). The notes below are not pairs. A ring is read against the
surface it is drawn on, which is the background of the ring (ARCH §17; REQ-111 criterion 4). The controls that stand on
the cream `--rc` are listed in 7.20; `--rc` keeps `#fffbf0` in the dark theme, where `--acct` would give 1.74:1, so they
take `--ring-rc`, chosen so that it is also at least 3:1 against the `--ink` frame next to the ring in each theme [C, the
rows above]. Around the link controls among them (the toggle, «<close>», «<to the landing>» of the receipt's failure
state, the example card's link; they have no frame of their own) the nearest frame is the edge of their `--rc` area,
3 px or more away from the ring [C from the paddings of 7.11, 7.12 and 7.16]. That the common ring also touches the own
frame of a framed control at s = 4, as in the sample, is question I11 (section 16).

Lines that are decoration, not pairs (G1) [C]: the dashed rules — `--rcline` on `--rc` 1.70:1 in both themes (the
sample's receipt and sheet rule, styles.css:182, 323), the list rule `--ink2` 35 % over `--paper` 1.70:1 in light and
2.17:1 in dark (over `--card` 1.71 / 2.06); the pixel frame of a button on `--rc`, which stays `--ink` as in the sample
(styles.css:28-32, 150): 12.78:1 against `--rc` in light and 1.16:1 in dark, where the button's boundary is its `--btn`
fill (the `--btn` row: 3.56 / 3.06), as the sample's dark ticket shows it (shot agency-1470-dark-05-ask5); the 1 px edges
of the plates (`--plate-edge` 3.64:1 against `--plate`, `--plate-now-edge` 3.59:1 in light and 3.07:1 in dark against
`--plate-now`, J7); and the step bar below.

Step buttons (F1): the default top bar of a step (left bar on phones), `--ink2` at 40 % over `--paper`, is `#b4b8b2`
(1.85:1) in light and `#4f6367` (2.42:1) in dark [C]: it is decoration, not the border of the control. The boundary of
a step button is the 2 px `--ink2` edge of its number square (the `--ink2` row above), with its word and its sub-line as
text (7.8).

### 6.4 Typography

Stacks [M styles.css:8-9]: `--font: ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto,
"Helvetica Neue", Arial, sans-serif`; `--mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation
Mono", monospace`. No font file.

| Element | Size | Weight | Line height, other | Source |
|---|---|---|---|---|
| body | 16 | 400 | 1.45 | styles.css:13 |
| h1 | clamp(27px, 4vw, 46px); 26 at ≤ 360 | 900 | 1.04, −.025em, balanced | styles.css:79, 347 |
| h2 | clamp(22px, 2.6vw, 32px) | 900 | 1.15, −.015em | styles.css:80 |
| question h2 | clamp(22px, 2.2vw, 30px); 20 below 760 | 900 | 1.15 | styles.css:131, 302 |
| h3 | 18 | 900 | | styles.css:81 |
| eyebrow | 13 | 800 | .08em, uppercase, `--acct`, margin-bottom 10 | styles.css:83 |
| pitch | 18; 16 below 760 | 400 | `--ink2`, max 54ch, margin-top 12 (8) | styles.css:84, 295 |
| meta, fine | 14 | 400 | `--ink2` | styles.css:85 |
| label (`lbl`) | 12 | 800 | .06em, uppercase, `--ink2` (`--rc2` on `--rc`) | styles.css:86, 154 |
| link (`lnk`) | inherit | 800 | underline 2px, offset 4px, `--acct` (`--rclink` on `--rc`, 6.6), min-height 48 | styles.css:88-90, 324 |
| button / big / small | 16 / 20 / 15 | 900 | 1.15 | styles.css:91, 94-95 |
| language and theme buttons | 14 (13 at ≤ 360) | 800 | .02em | styles.css:43, 346 |
| theme label | 13 | 800 | hidden below 760 | styles.css:48, 293 |
| brand name / tile letter | 18 / 17 (15 / 14 below 760; 14 / hidden at ≤ 360) | 900 | | styles.css:39-40, 292, 345 |
| card label | 17 (15 below 760; 14 at ≤ 360) | 900 | 1.15, balanced | styles.css:140, 307, 348 |
| card key hint | 12 mono | 800 | hidden below 760 | styles.css:138, 310 |
| speaker title / sub | 17 / 13 | 900 / 400 | `--ink2` sub | styles.css:123-124 |
| progress text | 13 | 800 | `--ink2` | styles.css:130 |
| team title / sub, the default row of four (7.7) | 13 / 13 | 400 / 400 | 1.2 / 1.2; title `--ink`, sub `--ink2` (J3) | styles.css:108-109; the title [P] (7.7) |
| team title / sub, the 2×2 option (7.7) | 16 / 13 | 900 / 400 | sub 1.2 `--ink2` | styles.css:108-109 |
| receipt header | 12 mono | 800 | .1em, uppercase, `--rc2` | styles.css:182 |
| receipt main value | clamp(26px, 3.4vw, 44px); 23 below 760; 20 at ≤ 360 | 900 | 1.1, −.02em | styles.css:162, 183, 328, 343 |
| list row title / sub | 16 / 14 | 900 / 400 | sub 1.3 `--ink2` (on `--rc`: title `--rcink`, sub `--rc2`, 6.6) | styles.css:186-189, 323 |
| chip | 15 | 900 | 1.2 | styles.css:205 |
| step title / tag / number | 14 / 12 / 14 mono | 800 / 800 / 900 | tag uppercase .06em | styles.css:212, 215, 218 |
| footer | 14 | 400 (line 700) | `--ink2` | styles.css:247, 249 |
| test-mode strip | 13; 12 below 760 | 400 | 1.35, `--ink` | [P] |
| scene caption | 13; 12 below 760 | 400 | 1.35, `--ink2` | [P] |
| scene labels | section 9.7, 9.8 | | | |

### 6.5 Spacing, sizes and the pixel frame

- Gutter `--gut` 20; 14 below 760; 12 at ≤ 360 [M styles.css:4, 290, 344]. `.wrap` max 1240 with the gutter on both
  sides [M styles.css:25].
- Pixel frame [M styles.css:28-34]: four hard `box-shadow` edges of `--px` in `--ink` (or `--bd` when the state changes
  it), one drop `(--px, 2·--px)` in `--shadow`, `margin: var(--px)`. Pressed: the drop goes away and the element moves
  down by `--px` [M styles.css:93]. `--px` = `s` (4, 3 or 2), set by the media queries of `tokens.css` (9.1, G7) [the
  values: M app.js:106, 110; M run].
- Paddings and gaps [M styles.css]: header `0 var(--gut)` (`0 8px 0 12px` below 760; `0 4px 0 10px` at ≤ 360; :37, 291,
  345); main panel `12px 0 36px` (`16px 0 24px` below 760; :77, 294) with 26 on top for the landing, the result and
  404 at 760 and wider (:78; below 760 the 16 of :294 wins, as measured [M run]); landing grid gap 36 (:102); CTA row gap `6px 14px`, margin-top 22 (16) (:104, 298); team gap 16, card padding
  `12px 6px` (:106-107); question panel padding `12px 20px 16px` (`12px 12px 14px`), margin-top `5·--px` (:115, 300);
  question head gap `4px 20px`, margin-bottom 12 (`2px 10px`, 8) (:119, 301); cards gap 16 (12) (:132, 305); card
  padding `8px 10px 10px` (`4px 6px 8px`), min-height 104 (94; 88 when the window is under 760 wide and up to 640 high)
  (:134, 306, 351); live strip padding `10px 22px 12px`, gap `8px 26px`, margin-top 18 (:150); result grid gap `22px 40px`
  (:178); receipt padding `16px 20px 20px` (`14px 14px 16px`), margin-top 22 (:181, 327); side panel padding `20px 22px`
  (`16px 14px`) (:194, 326); chips gap `14px 12px` (:202); steps gap 10, margin-top 22 (:211); footer padding `10px 0 12px`
  (:247).
- Targets (F2): every button, link and switch has a box of at least 48×48 — `min-height: 48px` and `min-width: 48px`
  [M styles.css:43, 88, 91 for the language and theme buttons, `lnk` and `btn`; P for `min-width` on `lnk`]; REQ-111
  criterion 12 asks 44×44. Three places of the sample are lower and change [P]: the phone toggle of the live strip (40
  high, styles.css:315; 7.11), the skip link (261.7×47.2 [M run], 7.1) and the brand, which is no link in the sample
  (34 / 30 / 20.3 high at the three windows [M run], 7.2).

### 6.6 Inside the cream `--rc` areas (G1)

`--rc` keeps `#fffbf0` in the dark theme [M styles.css:7; shot agency-1470-dark-05-ask5], where the page tokens of text,
links, rings and errors are light: against it the dark `--ink` gives 1.16:1, `--ink2` 1.91:1, `--acct` 1.74:1 and `--err`
1.96:1 [C]. So no part inside an `--rc` area takes them. The `--rc` areas, a closed list: the live strip (7.11, at 760
and wider), the phone bar and its sheet (7.11, below 760), the receipt in each of its states — the result, the loading
message «<putting your result together…>» and the failure of the result request (7.12, 7.18) — and the example card
(7.16). Inside them, in both themes [M styles.css:150, 154, 165-167, 171, 173, 181-182, 323-324 where the sample sets
the value; P where it does not]:

| Part inside an `--rc` area | Value | In place of | Pair (6.3) |
|---|---|---|---|
| text: the kind of product, the summary, the no-match text, the request of an example, the first line of a message, the sheet's header, list row titles, the chips' text and «+N» | `--rcink` | `--ink` | 16.25 |
| secondary text: labels (`lbl`), «<K of N>», the hint, the header rows of the receipt and the example card with the date and the kind, list row subs, «<also fits>…», the second line of a message | `--rc2` | `--ink2` | 6.89 |
| rules: the dashed rule under a header row and between list rows | `--rcline`, 2 px dashed | `--ink2` 35 % | decoration, 1.70 (6.3 note) |
| links and link buttons (`lnk`): the phone toggle, «<close>», «<to the landing>», «<take the demo survey>» | `--rclink`; hover `--rcink` [P: the sample's `lnk` hover `--ink` (styles.css:89) is 1.16:1 here in dark; its sheet link keeps `#7a3606` on hover, styles.css:324] | `--acct`; hover `--ink` | 8.61; 16.25 |
| the focus ring of every control (the closed list of 7.20) | `--ring-rc` | `--acct` | 3.56 / 6.39; against the frame 3.59 / 5.52 |
| the error label «<error>» | `--rcerr` | `--err` | 7.12 |
| the chips of the strip | `--rcink` on `--chip` | — | 13.54 |
| pips, full and half | `--btn` (the half pip on its left half) with a 2 px inset `--rcink` [M styles.css:166-167] | `--btn` with a 2 px inset `--ink` | `--btn` against `--rc`: 3.56 / 3.06 |
| pips, empty | a 2 px inset `--rcpip` [M styles.css:165] | a 2 px inset `--ink2` | 3.59 |
| buttons (`btn`): «<enough…>», «<retry>» | `--btn` fill, `--onbtn` text, hover and press as 7.5, the pixel frame in `--ink` as in the sample [M styles.css:28-32, 150] | the same | 5.02 / 5.84; the button's boundary is its fill (`--btn` against `--rc`); its frame is decoration on `--rc` in dark (6.3 note) |

So the only page tokens inside an `--rc` area are `--btn` and `--onbtn` (buttons, full and half pips) and the `--ink` of a
button's pixel frame. A part that a later change puts into an `--rc` area takes a value of this table, never `--ink`,
`--ink2`, `--acct` or `--err`.

## 7. Components and states

States named for each part: default, hover (mouse only), focus-visible, pressed (`aria-pressed="true"` or
`aria-current`), active (while pressed). There is no disabled state anywhere: a control that cannot act is not shown
[P, as the sample: app.js:201, 221].

**7.1 Skip link** [M styles.css:20-21; data.js:10]: first element of `<body>`; off-screen at top −60px; on focus at
8px/8px, `--btn` fill, `--onbtn` text, 800, padding `12px 16px`, `min-height: 48px` [P: the sample's is 47.2 high, M
run] (F2); target `#main`. Text «<skip>».

**7.2 Header bar** [M styles.css:37-48; app.js:83-93; shots]: height 52 (min) with a `--px` bottom border in `--ink`,
background `--bg`; brand left, controls right, gap 8.
- Brand: a link to `/` [P] with the tile (30×30; 26×26 below 760; hidden at ≤ 360; `--btn` fill, `--onbtn` letter «S»
  [P: the initial of «Sai», as the sample uses the tenant's initial, data.js:136], 2px `--ink` edges) and the name «Sai»
  (18/15/14 px, 900). The link's focus ring is the common one (7.20). Size (F2) [P]: the link is a flex row (gap 10,
  centred), `min-height: 48px` and `min-width: 48px`, so the 52-px bar holds it; measured [T] 71.2×48 at 1470, 63.1×48
  at 390 and 48×48 at 320. At ≤ 360 the tile is hidden and the name alone is 21.8 px wide at 14/900 [T], so the
  `min-width` keeps the box at 48×48 with the name at its left; the whole box is the link.
- Language switch: a group named «<language>» of buttons «RU», «ҚАЗ», «EN» [M app.js:86] — on production «RU» and «EN»
  only [R G9]. Each 48×48 min, padding `0 10px` (`0 4px` at ≤ 360), text `--ink2`; hover `--ink`; pressed
  (`aria-pressed="true"`): `--ink` with a `--px` inset underline in `--acct` [M styles.css:44]. A button of another
  language carries that `lang` attribute [M app.js:86]. Measured widths 48, 50.8, 48 [M run].
- Theme switch: one button [R decision 0084 item 15; REQ-087] that cycles «Авто» → «Светлая» → «Тёмная» → «Авто» [M
  app.js:383 cycle; R labels]; its text is the current position, hidden below 760 (icon only); accessible name
  «<theme name>: <position>» [M app.js:89]. Icon [M styles.css:47]: 16×16 square half `--ink` half empty with a 2px
  `--ink` edge, gap 8 to the label. Label widths at 13px/800 with the button's letter spacing (`.02em` of the 14-px
  button, inherited by the 13-px label as 0.28 px, styles.css:43, 48) [T, the sample's own classes] (F10): Авто 33.7,
  Светлая 58.0, Тёмная 52.7, Ашық 42.2, Қараңғы 62.9, Auto 32.3, Light 35.3, Dark 32.3; the button is 44 px plus the
  label (padding 10 + icon 16 + gap 8 + padding 10): 77.7 to 106.9 px at ≥ 760.
- Order in the bar: brand, then the language group, then the theme button [M index.html:14-17].

**7.3 Test-mode strip** [P: new element; R its words and its presence on every page]: directly under the header bar,
full width, background `--card`, text `--ink` (12.77:1 light, 10.41:1 dark), 13px/1.35 (12px below 760), padding `6px
var(--gut)`, a `--px` bottom border in `--ink`; at the left a 12×12 square in `--btn` with a 2px `--ink` edge
(`aria-hidden`), gap 8. Text: «Sai работает в тестовом режиме: вход по приглашению, заказы не принимаются.» [R PLAN M1;
REQ-111 writes the final dot].
It wraps at spaces, never cut. Measured widths [M run]: 512.3 px at 13/400 (one line at 1470), 478.1 px at 12/400 (two
lines at 390 and at 320: the text room is 342 and 276 px; three at 320 if the wrap falls badly). Height with padding
and border [C]: 34 at s 4 (one line), 46 at s 2 (two lines), 63 (three lines). Not sticky; no `role` (static text).

**7.4 Stage and caption** [M styles.css:51-55; P caption]:
- Stage: on `index.html`, `how.html` and `demo.html` only [R REQ-112]; full width, height `H·s` (section 9.1: 352 / 212
  / 168 at the three windows [M run]), background `--sc-wall`, `overflow: hidden`, a `--px` bottom border in `--ink`,
  `role="img"` with the name «<office alt>» [M index.html:21; app.js:90]. It holds the canvas and the layer of DOM labels
  over it (9.7, 9.8), nothing else. The text list of 9.16 stands beside it, right after the stage and before the caption,
  not inside the `role="img"` element (F12): visually hidden while the canvas draws, shown in place of the stage when the
  canvas cannot draw.
- Caption band [R ARCH §11.6; decision 0084 item 13]: right under the stage on every page that shows it; background
  `--paper`; text «Картинка показывает этапы работы, а не движения людей.» [R ARCH §11.6], 13px/1.35 (12px below 760),
  `--ink2` (6.39:1 / 7.77:1), padding `5px var(--gut)` (`4px var(--gut)` below 760), aligned with `.wrap`. Measured
  widths [M run]: 374.2 px at 13/400 (one line), 349.2 px at 12/400 (one line at 390, whose room is 362; two lines at
  320). Height 28 / 24 / 40 [C].

**7.5 Buttons** [M styles.css:88-97]:
- `btn` (primary): `--btn` fill, `--onbtn` text, min-height 48, padding `0 22px`, 16/900, pixel frame; hover: brightness
  1.06; active: pressed frame. `big`: min-height 64 (60 below 760, full width), padding `0 32px`, 20px. `small`: 48,
  `0 16px`, 15px. `ghost`: `--card` fill, `--ink` text.
- `lnk`: no fill, `--acct`, 800, underline 2px offset 4px, min-height 48, padding `0 6px`; hover `--ink`. In the footer
  the link colour is `--ink` [M styles.css:254]. Inside an `--rc` area: `--rclink`, hover `--rcink`, ring `--ring-rc`
  (6.6, G1).
- The press keeps the sample's motion (F9): `transform .08s` on `btn` and `card` [M styles.css:91, 134], and `background
  .2s` added while the system allows motion [M styles.css:266] (section 10).

**7.6 Pixel frame**: as 6.5. Hover on a card or chip: the edge colour `--acct` and the card moves up by `--px` [M
styles.css:135, 204]. Pressed card: edge `--acct`, fill `--btn` 16 % into `--card`, a 14×14 square in `--btn` with a 2px
`--ink` edge at top 6 / right 6 [M styles.css:136-137].

**7.7 Team card** (landing, ≥ 760 only) [M styles.css:106-111; app.js:179; shot stock-1470-light-01-start; CC]: the
sample's card — `--card` with the pixel frame, avatar, title 16/900, sub 13/400/1.2 `--ink2` — with Sai's words: title
«<role title of desk n>» (9.6), sub the desk's stage word [R REQ-112: no personal names]. The sample puts four cards in
one row (grid of 4, gap 16; card 109.3 wide with 97.3 of content at 1470 [M run]); Sai's titles do not fit that content
at the title's 16/900 (at 16/900 [M run]: «Руководитель» 119.4, «Проверяющий» 123.7, «Разработчик» 109.1; «Аналитик»
81.9). So one thing of the sample's card changes (S18, F8), in one of two forms; decision 0123 chooses (question I2), and
the chosen form goes on the owner's list (section 17). The default is the form that changes less of the approved mockup,
which the owner wants matched one to one (finding G9):

- **Default — the sample's row of four** [P] (finding G9): the sample's card unchanged in size and form (a column,
  centred, padding `12px 6px`, 109.3 × 156.8 at 1470 [T]) with the avatar 72×78 (24×26 logical at scale 3, 9.15); line
  1 the role title at 13/400/1.2 in `--ink`, in the place of the sample's 16/900 name (J3: the line height 1.2, 15.6 px,
  is named for the title as for the sub; the body's 1.45 that the sample's `.team b` inherits, styles.css:13, would make
  the cards 163.3 high [T]); line 2 the stage word at 13/400/1.2 in `--ink2`,
  the sample's role line. Widths at 13/400 [T]: «Руководитель» 87.8, «Проверяющий» 91.3, «Разработчик» 81.1, «Аналитик»
  60.2, «документацию» 94.0, «спецификацию» 95.6, «к просмотру» 79.6 — every word fits the 97.3 px of content;
  «Руководитель проекта», «Готовим документацию», «Готовим спецификацию» and «Готово к просмотру» take two lines. Every
  card is 156.8 high [T] (avatar 78, gap 2, the title's margin 4, two lines and one line of 15.6 in either order, gap 2,
  padding 24), the row 164.8 with the frame margins, lower than the intro, so the hero keeps its height. It keeps the
  sample's row, card width and avatar size and loses only the bold title line; at 13/800 «Проверяющий» (100.3 [T])
  would not fit.
- **Option — a 2×2 grid of row cards** [P]: gap 16, each card a row: avatar 48×52 (9.15) left, then the title and the
  sub in a column with gap 2 (the sample's card gap, styles.css:107) and no top margin on the title (the sample's 4 px,
  styles.css:108, sits under an avatar the row card does not have), padding `12px 14px`, gap 12. At 1470 a card is
  242.7 wide with 154.7 for the text [T]: the title keeps 16/900; «Руководитель проекта» takes two lines, every stage
  word one line (at 13/400 [M run]: «Готовим спецификацию» 151.2, «Готовим документацию» 149.6). Heights [T] (F8): the
  card of desk 1 is 88 high (the title in two lines of 23.2, the gap 2 and the sub 15.6 make 64, above the avatar's 52,
  plus the padding 24), the other three 76 (the avatar 52 plus 24); the grid is 196 high with the frame margins, lower
  than the intro, so the hero keeps its height. It keeps the bold title and changes the layout and the avatar size.

Both forms: 760 – 1206 under the intro, max-width 560, and beside the intro only from 1207 px [R decision 0123 I2, its
answer to J2: the narrow hero's rule of styles.css:281-283, extended to 1206] (J2); below 760 hidden [M styles.css:296].
Beside the intro the content of a card is 95.7 px at its narrowest, at 1207 [C: the team column (1207 − 2·20 − 36) /
2.25, less 3 gaps of 16, divided by 4, less the frame margins 2·3 and the padding 2·6], so every word above fits; from
1001 to 1206 the sample's two-column hero would leave 72.8 to 95.56 px [C], and «спецификацию» (95.61 [T]) and up to
four more words would break inside the word [T: the sample's hero with Sai's words at 13/400/1.2 and the guard below on
both lines; no word broken at 1207 – 1470]. Under the intro the content is 112 px at s 2 and 110 at s 3 [T]. A title
breaks only at spaces; `overflow-wrap: anywhere` is the guard for a longer word in another language [P, AP-099].

**7.8 Stage step** (`how.html`, and the overview row on the landing) [M styles.css:211-218, 329-332; shot
stock-1470-light-10-my-3; CC]: four steps in a row (grid of 4, gap 10, margin-top 22); below 760 one column, each step a
row (min-height 48, a `1.5·--px` left bar, padding-left 10, gap 10, margin-bottom 6). Each step: a top bar of
`1.5·--px`; the number square 28×28 (mono 14/900); the stage word 14/800/1.2; a one-line sub 13/400 `--ink2` [P: the
sample's «СДЕЛАНО / СЕЙЧАС / ВПЕРЕДИ» tag is not used]. States:
- default: bar `--ink2` 40 % (`color-mix(in srgb, var(--ink2) 40%, transparent)`) [M styles.css:212], square with a 2px
  inset `--ink2` edge, word `--ink2`;
- selected (`aria-pressed="true"`, `how.html` only): bar `--btn`, square `--btn` fill with `--onbtn` digit and a 2px inset
  `--ink` edge, word `--ink` [M styles.css:214, 217];
- on `how.html` each step is a `<button>` (tap = scene reaction 9.13, no scroll); on the landing each step is a link to
  `/how.html#stage-n` [P], root-relative (5.1, G4).
- The control's boundary (F1): a step button or link has no border of its own; its boundary is the 2 px `--ink2` edge of
  its number square (6.39:1 light, 7.77:1 dark against `--paper`, 6.3) with the stage word and the sub as its text. The
  default bar (and the left bar on phones) is decoration, not a control border: `#b4b8b2` 1.85:1 in light and `#4f6367`
  2.42:1 in dark [C, 6.3 note], as in the sample. The selected state is shown by the square's `--btn` fill and the `--btn`
  bar (3.39:1 / 4.86:1 against `--paper`, the `--btn` row of 6.3) and by the word turning `--ink`.

**7.9 Question panel** [M styles.css:114-131, 300-304; app.js:202-207; shots *-05-ask5]:
- Panel: background `--paper` with the pixel frame, padding as 6.5. The tail: a stepped pixel triangle `10·--px` wide
  and `5·--px` high on the top edge, its centre at `--tx` = the asking desk's x on the screen, clamped to 30 px from both
  panel edges [M app.js:165-169; styles.css:116-118].
- Head (grid `auto 1fr auto auto`): speaker (avatar 48×52 + title 17/900 + sub 13 `--ink2`), the question h2, the
  progress (pips + «<question i of n>»), «‹ <back>» (ghost button, 111.6×48 measured [M run]). Below 760 [M
  styles.css:301-304]: row 1 speaker and back, row 2 the h2 (20px), row 3 the progress spread over the width (this holds
  from 380 px; below it the next item changes it, О36).
- **Below 380 px (`max-width: 379px`) the speaker takes its own row** (О19, О32, О36 [R decision 0124]; the owner's list
  D25, G21): row 1 the speaker over the full width of the panel (avatar 48×52, the role title 17/900, the stage word 13
  `--ink2`), row 2 the h2, row 3 the progress at the left and «‹ <back>» at the right, centred on each other; the
  sample's row 1 pair (speaker at the left, back at the right) is split, and «‹ <back>» moves to the progress row. From
  380 px the layout of the sample stays, and 390 px, the sample's phone, stays side by side. Why (a place where the
  sample is changed): beside the question the speaker's column is the window's width less 181.6 px (198.4 at 380, 208.4
  at 390), the longest Russian title «Проверяющий» is 130.4 px at 17/900 and with the avatar and its gap of 12 needs
  190.4 px, so it fits from 372 px, where its right edge is the column's; below that it passes the column (by 1.0 px at
  371, 11.0 at 361) and at 361 stands 1.0 px from «‹ Назад» (finding N1 of DESIGN-QA's first pass) [M build, the own-row
  rule overridden in the trial: 380, 372, 371, 361, 360 px]. At 320 the first word «Руководитель» alone does not fit
  beside it [R О19]. The threshold 380 is an 8-px slack over the measured 372, because the widths are those of macOS
  Chrome in the system font stack, with none to spare at 372 (О36, a correction of О32, whose 372 corrected О19's 360).
  Measured below 380 [M build, ru, kk, en, 379, 360 and 320 px]: the title keeps one line at every width (the longest,
  «Руководитель проекта», is 201.4 px in 208 of room at 320), it breaks only at spaces, nothing is cut and nothing
  leaves the panel; «‹ <back>» is 48 high and 111.6 (ru), 109.8 (kk) or 99.1 (en) wide, as beside the question; the pips
  (76 px) and the count «<question i of n>» (71.6 to 100 px) stand on one line at 379 and 360 px, and at 320 the count
  goes under the pips in all three languages (the row 40.8 high instead of 18.8); the head is 31.2 px higher than at 380
  px on a question with one title line (99.8 at 380, 131.0 at 379; 122.8 and 154.0 on question 5), as the 48-px back
  stands in the progress row. Beside the question, at 380 and 390 px, «Руководитель проекта» takes two lines of at most
  125.7 px (39.1 high), and kk «Жоба жетекшісі» two lines at 380 [M build]. The place of «‹ <back>» at the first scroll
  position at 320×568 is partly under the live strip: D24.
- Speaker title = the role title of the asking desk, sub = that desk's stage word; the asking desk of each question
  is the step table's (9.13) [P]. Back on question 1 opens the landing [M app.js:249].
- Pips [M styles.css:126-129; app.js:204]: n squares 12×12, gap 4; questions 1 … i (the current one included) are
  `--btn` with a 2px inset `--ink`; the rest a 2px inset `--ink2`.

**7.10 Answer card (one tap)** [M styles.css:132-143, 305-310; app.js:194-200]:
- Grid `repeat(auto-fit, minmax(150px, 1fr))`, gap 16; below 760 two columns, gap 12 [M]. At most four option cards plus
  «Не знаю» per question [R REQ-111 criterion 5: 2 to 4 options].
- Card: `<button>`, `--card` with the pixel frame, min-height 104 (94 below 760), padding as 6.5, a column centred
  both ways, gap 4: key hint «1»…«4» at top-left (12 mono, hidden below 760) and the label 17/900 (15 below 760) —
  wrapped at spaces, balanced, never cut. No icon: the intake has no objects [R REQ-111], so an option card has the
  sample's «Не знаю» card shape (centred label, styles.css:142) with the card fill and the `--ink` edge [CC].
- States: default; hover (edge `--acct`, up by `--px`); focus-visible (ring 7.20); pressed (`aria-pressed="true"`, 7.6:
  the answer already given to this question); active (pressed frame for the tap).
- «Не знаю» card: last, key hint «0», transparent fill, edge `--ink2`, label 16/900 centred, no sub-line [CC, section 4
  item 7]; below 760 it spans both columns, min-height 48, a row [M styles.css:308].
- A tap: the card shows pressed at once, the page answers within the same frame, the next question opens after 480 ms
  (60 ms with reduced motion) [M app.js:241-245]; a second tap during that time does nothing [M app.js:230].
- Measured at 390 (question 5 of the sample, with its icons): cards 157×104.5, 157×94, «Не знаю» 330×48 [M run]; without
  icons both rows of option cards are 157×94 [T] (8.4).

**7.11 Live strip** (the sample's ticket, changed) [M styles.css:150-175, 311-323; CC]:
- Wide windows: under the question panel, `--rc` fill, `--rcink` text, the pixel frame, two side notches of `4·--px`
  [M styles.css:151-153]; grid `1fr auto`, gap `8px 26px`, padding `10px 22px 12px`. Left, row 1: label «<your answers>»
  (`lbl`, `--rc2`) and the pips of the answers given with «<K of N answers>» (13/800 `--rc2`); left, row 2: the chips of
  the answers given (13/700 `--rcink` on `--chip`, padding `3px 9px`, one row of 30 px, the newest first, at most 7 and
  «+N» in the mono font, `--rcink` on `--rc` [M styles.css:150, 170-172; app.js:218] (G1)); before the first answer, row
  2 is the hint «<answer a question…>» (14 `--rc2`) [M styles.css:173]. Right: the button «<enough, show the result>»
  (`btn`, min-height 56) from the first answer on [M app.js:201, 221]. Not shown: price, band, effort, fit (section 4,
  items 8-9).
- The pips and K, one rule (F10) [M app.js:43-52 (`compute` without fill), 150 (`pips`), 158 (`Math.floor(known)`);
  styles.css:164-167]: a question answered with an option counts 1, a question answered «Не знаю» counts .5, a question
  not reached yet counts 0; S is the sum. The strip shows floor(S) full pips (`--btn` with a 2 px inset `--rcink`),
  then one half pip (`--btn` on its left half, the same inset) when S has a half, then empty pips (a 2 px inset
  `--rcpip`, G6) up to N; K = floor(S). Example: two options and one «Не знаю» give S 2.5: two full pips, one half pip,
  «2 из 5».
- 760 – 1000: two rows, the button on its own row [M styles.css:350].
- Below 760 [M styles.css:311-323, changed in one place: sticky, not fixed, О24]: sticky to the bottom of the question
  wrap (`position: sticky; bottom: 0`, in the flow after the question panel), full width, padding `8px 12px` plus the
  safe area, a `--px` top edge in `--ink`, no notches. Left, row 1: the pips with «<K of N>», gap 10 [P: the sample's `0 14px` (styles.css:316)
  would wrap the pair in the 128-px column at 320; with 10 the pair is 126 px in ru: pips 76 + 10 + «3 из 5» 40.0 [T]];
  left, row 2: the toggle «<your answers> ▴» (`lnk`, `--rclink`, padding 0, `min-height: 48px` [P: the sample's 40,
  styles.css:315, is below REQ-111 criterion 12's 44] (F2); 118.7 × 48 in ru at 16/800 [T]). Right, over both rows: the
  button (max-width 150, min-height 56, padding `0 10px`, 14px, margin 4 [M styles.css:319]), centred. The toggle opens a
  sheet above the bar (`--rc`, a `--px` top edge in `--ink`, padding `10px 14px 6px`, max-height 58 vh, scrolls [M
  styles.css:320]); Escape closes it [M app.js:402]. The sheet (G1): a header row, space between and centred [M
  styles.css:322], with «<your answers>» (16/700 `--rcink`, the sample's `<b>` of app.js:220) and «<close>» (`lnk` in
  `--rclink`, hover `--rcink`, 48 high, ring `--ring-rc`); under it one row per answer given, in the order of the
  questions, in the list look of 7.14 on `--rc` [M styles.css:323]: the title is the chosen option, 16/900 `--rcink`
  (a «Не знаю» answer shows «<not sure>», as its chip in 7.13), the sub is the question, 14/1.3 `--rc2`, a 2 px dashed
  `--rcline` rule under each row, padding `12px 0`, no right column [P: the sample's sheet lists the estimate's lines
  with their days, app.js:220].
- **Sticky, not fixed** (a place where the sample is changed; О24 and О26 (b) [R decision 0124]; the owner's list D23):
  the bar stands at the bottom of the window, as the sample's fixed bar does, while the end of the question wrap lies
  below the window's bottom edge; when that end comes into view the bar moves up with the page and rests at the end of
  the wrap, 24 px above the footer (the panel's bottom padding). Why: a fixed bar lies over the footer links at the end
  of the page and nothing can scroll them out from under it (found by the e2e row LD-1, fix round 02c,
  `handoffs/M1CODE-20261119-01/step-02c-code-fixer.json`: with the bar forced to fixed, and the sample's 96-px bottom
  padding added, the centres of all four footer links lie under the bar at 759.2 – 844 on 390×844 (the links at 736 –
  784 and 784 – 832) and answer with the bar); with the sticky bar the centre of every footer link answers with the link
  at the end of the page, in 35 states (390×844, 360×640, 379×640 and 380×640 in ru, 320×568 in ru, kk and en, each of
  the five questions) [M build]. The bar's height is reserved by its place in the flow: the page is 85 px longer (the
  bar's 84.8) than with a fixed bar and no reserved room, and 13 px longer than with the fixed bar and the sample's
  96-px bottom padding [M build, the bar forced to fixed in the trial; `scrollHeight` at 390×844 on questions 1 and 2:
  1083 and 948 against 998 and 863, and against 1070 and 935]. At the first scroll position the bar is where the fixed
  bar is (759.2 – 844 at 390×844, 555.2 – 640 at 360×640, 379×640 and 380×640, 483.2 – 568 at 320×568; 84.8 high)
  wherever the page is long enough; the exception is a window where the end of the wrap lies above the window's bottom
  edge: at 390×844 on questions 2 and 4 (6 of the 15 states of ru, kk and en) the bar rests at 658.4 – 743.3 and 76.7 px
  of the footer show under it, its links free [M build]. A control that takes the focus is scrolled above the bar (the
  page's scroll padding is 90 px plus the safe area), and the sheet stands right above the bar wherever it rests (at
  390×844 on question 2: the sheet 527.0 – 658.4, the bar's top 658.4) [M build]. If the owner reads this as «not like
  the mockup», the alternative is the fixed bar with a measured bottom padding under the footer [R О24].
- Height of the bar (F2): 84.8 px at 390 and at 320 [T] — padding 8 + row 1 18.8 + gap 2 + the toggle 48 + padding 8;
  the button with its margins (64) is centred in the 68.8 of the rows — plus the safe area. A «<K of N>» text wider than
  42 px at 13/800 would wrap row 1 at 320 and make the bar 100.8 [T] (13.3). The sample's 96 px of bottom padding of the
  question screen [M styles.css:299] is not used: the bar is in the flow, so at the end of the page every card has been
  scrolled above it (О24).
- Focus ring: «<enough…>», the toggle and «<close>» stand on `--rc` and take `--ring-rc` (7.20, F1). Every text, rule,
  link and pip of the strip, the bar and the sheet takes the on-cream value of 6.6 (G1).

**7.12 Result receipt** [M styles.css:181-184; app.js:262; shot stock-1470-light-06-result; CC]: `--rc` with the pixel
frame, padding as 6.5, margin-top 22. Every text, rule and control in it, in each of its states, takes the on-cream value
of 6.6 (G1).
- Header row: «SAI · <demo>» left and the date `dd.mm.yyyy` in Astana time right [M app.js:19, 262; R decision 0083 item
  8], mono 12/800 uppercase `--rc2`, a 2px dashed `--rcline` rule under it, padding-bottom 12, margin-bottom 14.
- Body: label «<fits>» (`lbl`, `--rc2`) [P, after decision 0084 §3 item 1 «Подходит: <решение>»]; the kind of product
  (`recommended[0].name`) as the main value in `--rcink` (6.4, wraps at spaces, balanced, no `nowrap` [P: the sample's
  price is `nowrap`, styles.css:162]); the summary (16/1.45 `--rcink`); the label «<accuracy>» (`lbl`, `--rc2`) with pips
  and «<K of N answers>» (13/800 `--rc2`) [M styles.css:164-167; data.js:19] by the rule of 7.11, with the one
  difference of the sample's result: a question not reached (the visitor pressed «<enough…>») also counts .5 there, like
  «Не знаю» [M app.js:47, 51, 256: `compute` with fill] (F10).
- Close options (`clear_leader` false): one more line «<also fits>: <name 2>, <name 3>» (14 `--rc2`) [P].
- No match (`no_match_text`) (G2): the body holds only the text, 18/800 `--rcink`, in place of the label «<fits>», the
  name and the summary, and no accuracy row [P: the accuracy says how surely the answers point at the kind shown, and no
  kind is shown]. Right under the receipt, with nothing between, stands the fixed list «Чего Sai пока не делает» (7.14);
  the solution's own lists («<what it includes>», «<not a fit if>») are not shown, as there is no solution [P].
- Loading and failure (8.4 state 3; §11 «result request fails»): the header row stays; the body holds the message block
  of 7.18 in its on-cream form (`--rcink`, `--rc2`, `--rcerr`, `--rclink`, rings `--ring-rc`), never 7.18's page
  tokens (G1).

**7.13 Answer chips** [M styles.css:202-206; app.js:257-260, 275]: `<button>` chips in a wrapping row (gap `14px 12px`),
`--card` with the pixel frame, min-height 48, padding `6px 14px`, 15/900; hover edge `--acct`; a tap opens that question
and, after the answer, returns to the result [M app.js:243]. «Не знаю» answers show as a chip «<not sure>» [P].

**7.14 Lists** [M styles.css:185-191]: h3 (18/900, margin `6px 0 8px`); rows with a 2px dashed rule, padding `12px 0`:
title 16/900 and an optional sub 14/1.3. On `--paper` and `--card` (the result, the info panels of 7.17): h3 and title
`--ink`, sub `--ink2`, the rule `--ink2` 35 % into transparent [M styles.css:186-189]; inside an `--rc` area (the example
card, the phone sheet): title `--rcink`, sub `--rc2`, the rule `--rcline` [M styles.css:323] (6.6, G1). No right column
(the sample's days, section 4 item 9). A row wraps at spaces, never cut, no inner scroll. The lists of the result, all
on `--paper`, titles only, in this order (G2):
- «<what it includes>» — the `includes` texts of the recommended solution [P: field names of `tools/src/picker/engine.js`
  lines 163-186];
- «<not a fit if>» — its `not_suitable_when` texts. The heading speaks of the kind of product shown (for example in the
  sense «Не подойдёт, если»; the wording is the texts module's, REQ-111) and holds no word of the fixed heading below, so
  the two lists are not taken for one [P];
- **the fixed list** [R REQ-111: its paragraph «What Sai cannot build yet», criteria 2 and 12]: the h3 «Чего Sai пока
  не делает» and ten rows, titles only, in this order: «Серверы, API и базы данных»; «Вход по логину и паролю»; «Приём
  оплаты»; «Настоящая отправка писем и сообщений в мессенджеры»; «Связь с внешними системами учёта и CRM»; «Сбор данных
  с чужих сайтов»; «Расширения для браузера»; «Мобильные приложения»; «То, что требует секретных ключей или паролей»;
  «То, что нарушает правила использования ИИ» (each a key of the texts module, no `order_` prefix). It stands on every
  result: after «<not a fit if>» when a kind is recommended, right under the receipt on no match (7.12, 8.4 state 4), and
  on production too (section 1). Its look is the 7.14 list on `--paper`: h3 and titles `--ink` (12.17:1 in light,
  12.82:1 in dark), the rule decoration (6.3 note). Sizes [T, ru, the sample's font on the trial page]: the heading
  218.8 px at 18/900, one line at every window; at 1470 the column is 730 px and every row one line (the longest,
  «Настоящая отправка писем и сообщений в мессенджеры», 485.3 px), the list 532 px high with its h3; at 390 (362 px)
  three rows take two lines (that one, «То, что требует секретных ключей или паролей» 401.0, «То, что нарушает правила
  использования ИИ» 380.7), 601.5 px; at 320 (296 px) also «Связь с внешними системами учёта и CRM» (360.5), four rows
  in two lines, 624.7 px. A row is 49.2 px high with one line and 72.4 with two.

**7.15 «Описать идею» panel** (the place of the sample's request form; CC) [M styles.css:194-198]: `--card` with the
pixel frame, padding `20px 22px` (`16px 14px`), column gap 6: h3 «<describe your idea title>», sub «<lead>» (`--ink2`),
the big button «Описать идею» [R PLAN M1] full width — a link to `/how.html#describe-idea`, the part «Как описать
идею» of `how.html` (8.2 H3; G4), which sends and keeps nothing [R REQ-111, its question О1] — and a fine line (14
`--ink2`) with the test-mode explanation «<only invited participants describe ideas>». No field [R owner's words].

**7.16 Example card** (`examples.html`) [P, built from the receipt look 7.12 and lists 7.14]: `--rc` with the pixel
frame, padding as the receipt (`16px 20px 20px`, `14px 14px 16px` below 760; 6.5); header row (mono 12/800 uppercase
`--rc2`, a 2 px dashed `--rcline` rule under it, as the receipt's): «<example> 1» left, the kind of product right; the
request in the visitor's words 17/800 `--rcink` in «…» quotes; label «<what you get>» (`lbl`, `--rc2`) and a list; label
«<not included>» (`lbl`, `--rc2`) and a list — both lists in the look of 7.14 with its on-cream values: titles 16/900
`--rcink`, subs 14/1.3 `--rc2`, 2 px dashed `--rcline` rules (6.6, G1); the link «<take the demo survey>» →
`/demo.html` (`lnk` in `--rclink`, hover `--rcink`), whose focus ring is `--ring-rc` because it stands on `--rc` (7.20,
F1).

**7.17 Info panel** (`how.html` sections, landing block D, the two lists of `examples.html`) [P from 7.15]: `--card`
with the pixel frame, padding `20px 22px` (`16px 14px`); h3; paragraphs 16/1.45; lists as 7.14.

**7.18 Message block** (loading, error, no connection, refused; 11) [P]: a line 18/800 («<loading…>» or the error
title), a line 16 with what to do, and for errors two controls, «<retry>» (`btn`) and «<to the landing>» (`lnk` → `/`);
an error message starts with the label «<error>» (`lbl`), and its title line keeps the text colour of its surface, not
the error colour [P]. It stands on one of two surfaces, and its colours are those of the surface (G1):
- on `--paper`, inside the question panel frame, padding as the panel (the questionnaire: 8.4 state 1 and §11): the
  lines `--ink` and `--ink2`, the label `--err`, the link `--acct`, both rings `--acct` (6.3: 12.17 / 12.82, 6.39 / 7.77,
  6.78 / 7.56, 6.08 / 8.54);
- inside the receipt, in its body under the header row (the result: 8.4 state 3 and the failure of the result request,
  §11): the on-cream values of 6.6 — the lines `--rcink` and `--rc2`, the label `--rcerr`, «<retry>» a `btn` (`--btn`,
  `--onbtn`, its frame as 6.6), «<to the landing>» in `--rclink` with the hover `--rcink`, both rings `--ring-rc` (6.3:
  16.25, 6.89, 7.12, 8.61; rings 3.56 / 6.39). No page token of the first form stands in the receipt.

**7.19 Footer** [M styles.css:247-255; CC]: background `--bg`, `--px` top edge in `--ink`, padding `10px 0 12px`, 14px
`--ink2`; one `.wrap` row, wrapping, space between, gap `2px 24px` (`0 12px` below 760). Left: the two-colour square
12×12 (`--btn` | `--acc2`, 2px `--ink` edge) [M styles.css:250] and the AI disclosure «Работу в Sai выполняют
ИИ-агенты (искусственный интеллект). Их ответы могут быть неточными.» (700) [R REQ-111: on every page]. Right: links
(`lnk`, `--ink`): «<landing>» `/`, «<how it works>» `/how.html`, «<demo>» `/demo.html`, «<examples>» `/examples.html`
(local only) (G4). When the page language is kk, a full row under them with the kk draft note (13px) [M styles.css:255;
app.js:100].

**7.20 Focus ring** [M styles.css:22-23]: `outline: 3px solid var(--acct); outline-offset: 4px` on `:focus-visible`;
none on mouse focus; headings focused by script have no ring [M styles.css:82]. On the canvas nothing is focusable.
- On the cream `--rc` (F1): the controls that stand on `--rc` take `outline-color: var(--ring-rc)` (`#ce6a1d` light,
  `#9a4306` dark; 6.1, 6.3) with the same width and offset [P: the sample's `--acct` there is `#ffb06b` in dark, 1.74:1].
  The closed list of those controls (G1): «<enough…>» in the wide live strip and in the phone bar (7.11), the toggle
  «<your answers> ▴» of the phone bar and «<close>» of its sheet (7.11), «<retry>» and «<to the landing>» of the
  receipt's failure state (7.12, 7.18), and the link «<take the demo survey>» of each example card (7.16). No other
  control stands on `--rc`: the receipt holds controls only in its failure state, the chips of the strip are not
  controls, and the answer chips of the result (7.13) stand on `--paper`.

**7.21 Live region** [M index.html:28; styles.css:19]: `role="status" aria-live="polite"`, visually hidden by the `.sr`
rule (never `display: none`, AP-107). It says what changed: «<accepted: option>», «<back to question i>», «<result
ready: kind>», on `how.html` «<desk n: stage>» [M app.js:238, 250, 274; P for how].

## 8. Pages

Common order on every page: skip link, header bar (52), test-mode strip, stage, caption band, `<main id="main">`,
footer. Heights of the top block [M run; C]:

| Block | 1470×784 | 390×844 | 320×568 |
|---|---|---|---|
| header | 52 | 52 | 52 |
| test-mode strip | 34 | 46 | 46 (63 with three lines) |
| stage | 352 (s 4, H 88) | 212 (s 2, H 106) | 168 (s 2, H 84) |
| caption band | 28 | 24 | 40 |
| `<main>` starts at | 466 | 334 | 306 (323) |

The sample's `<main>` started at 404 / 264 / 220 [M run]; Sai adds 62 / 70 / 86–103 px for the two required lines.
`examples.html` and `404.html` have no stage and no caption [R REQ-112]: their `<main>` starts at 86 / 98 / 98 (115).

Arrangement of `<main>` per window (details in 8.1 – 8.5) [M styles.css:102, 106, 132, 178, 281-340; M run; P where the
block is new]:

| Page, block | 1470×784 | 390×844 | 320×568 |
|---|---|---|---|
| landing hero | two columns: intro 646.7, team 517.3, gap 36 | one column, no team, big button 358 wide | one column, no team, big button 292 wide |
| landing stage overview | four steps in a row | four rows of ≥ 48 | four rows of ≥ 48 |
| landing «what Sai builds» (local) | two panels side by side, gap 22 | stacked | stacked |
| how: steps / topic panels | four in a row / two columns | rows / one column | rows / one column |
| examples | the two lists side by side (gap 22), then three cards of 377.3 | the lists stacked, then the cards in one column | the same |
| demo question | cards in one row of n + 1 (268 each with three options and «Не знаю» [M run]) | two columns, «Не знаю» full width, fixed bar 84.8 [T] | two columns (124 each [M run]), «Не знаю» full width, fixed bar 84.8 [T] |
| demo result | two columns: 730 and the 430 panel (8.4) | one column: receipt, panel, chips, lists; on no match receipt, the fixed list, panel, chips (G2) | the same |
| 404 | one column, h1 46 | one column, h1 27 | one column, h1 26 |

### 8.1 `index.html` — landing

The scene in its start state (9.13); the landing has no tap, so its camera stays at 0 and a phone shows the door, «Вы»
and desks 1–2 (all four at 1470; 9.14, F7). Blocks in order:

- **A. Hero** [M styles.css:102-111; app.js:175-179; shot stock-1470-light-01-start]: ≥ 1207 (J2): grid `1.25fr 1fr`,
  gap 36, vertically centred; left the intro: eyebrow «Sai — закрытое тестирование» (F3), h1 «<landing h1>», pitch
  «<landing pitch>», the CTA row (big `btn` «<take the demo survey>» → `/demo.html`; ghost `btn` «<how it works>» →
  `/how.html`; G4)
  [P: the sample's second button «Продолжить» is gone, S16], the meta line = the AI disclosure of 7.19 (14 `--ink2`,
  margin-top 12), so it is read before the first tap; it stands in the footer too [P].
  Right: the team row (7.7). 760 – 1206: one column, team under the intro (max-width 560; 7.7, J2). Below 760: one
  column, no team, the big button full width.
  The eyebrow carries the closed-test text that index.html must hold (F3) [R REQ-111 criterion 1; REQ-108 criterion 4;
  guard NM-1; the post-deploy check «/ holds «Sai — закрытое тестирование»»]: a `<p>` in the static HTML of
  `index.html` whose text is exactly «Sai — закрытое тестирование», with the look of the sample's eyebrow (13/800,
  `.08em`, uppercase by CSS only — the text in the file and in the DOM stays as written —, `--acct`, margin-bottom 10;
  styles.css:83). Its width is 262.5 px [T], one line at the three windows (the intro is 646.7, 362 and 296 px wide). It
  is a key of the texts module (ru exactly this text; kk and en are REQ-111's, for example en «Sai — closed testing»,
  177.6 px [T]); on a language switch the page script sets the eyebrow's `textContent` to the value of the new language,
  and the file itself keeps the Russian text, which is what the static checks read. The `<title>` of `index.html`
  carries the same text (8.6).
- **B. Four stages** [P]: h2 «<four stages>», then the step row of 7.8 as links to `/how.html#stage-1` …
  `/how.html#stage-4` (G4) (the owner's four stage words with a one-line sub each).
- **C. (none)** — the test-mode line is the strip of 7.3; it is not repeated in the body [P].
- **D. What Sai builds and does not build** — local only under G8 «б» [R]: h2 and two info panels side by side at
  ≥ 1000 (gap 22), stacked below: «<builds>» list and «<does not build>» list (ARCH/PLAN §2 «What agents build in V1»),
  and the link «<examples of requests>» → `/examples.html` (G4).

Fold arithmetic [C from M run; 6.5]: at 1470×784 the CTA bottom is 466 + 26 + 4 + 18.8 + 10 + 2·47.84 + 12 + 2·26.1 + 22
+ 4 + 64 = 774.7 ≤ 784, so the big button is fully visible without scrolling when the h1 takes at most two lines (the
intro column is 646.7 px wide at 46 px [M run]) and the pitch at most two lines (611.2 px at 18 px). A three-line h1 puts
the button 48 px lower, below the fold: then the text is too long, not the layout. At 390×844: 334 + 16 + 4 + 18.8 + 10 +
3·28.08 + 8 + 3·23.2 + 16 + 2 + 60 = 622.6 ≤ 844 (h1 and pitch up to three lines each). At 320×568: 633.6 – 650.6, below
the fold by 66 – 83 px: the page scrolls (the sample's button ended at 547.5 [M run]; REQ-085 named 390×844 as the window
where the button is visible without scrolling).

Production (G8 «б»): block D absent; nothing else changes.

### 8.2 `how.html` — how it works

The scene in its start state at load («Вы» at the door); a tap on step n sends «Вы» to desk n (9.13). Blocks:

- **H1. Intro**: eyebrow «<how it works>», h1 «<…>», pitch «<…>» (one column, max 54ch).
- **H2. The four stages**: the step row of 7.8 as buttons (the scene reacts to a tap: the figure moves only on the
  visitor's taps here and in the demo [R ARCH §11.6]); then four sections `#stage-1` … `#stage-4`, each an h2 «<n · stage
  word>» with paragraphs and lists, always visible (no hidden content) [P].
- **H3. Topic panels** (info panels 7.17, two columns ≥ 1000, one below): the answers to the twelve questions of the
  colleague's brief §4 (D2; PLAN AC1.9), in this order [P]: what Sai is; which products can be ordered and which services
  the platform gives (local only under G8 «б»); what the AI agents can and cannot do (the long AI disclosure); how to
  describe an idea (its panel or section carries the id `describe-idea`, the target of «Описать идею», 7.15; G4); how the
  interview goes; how the ТЗ is made; how to check and fix the ТЗ; how to approve it; how the
  development starts (only the owner, in test mode); what Pixel Office is for (a private office of a project, real events
  only — never on this public page); how to get, check and accept the result. Several questions may share a stage section
  of H2 instead of a panel; each of the twelve has a heading the reader can find [P].
- **H4. CTA**: the big button «<take the demo survey>» → `/demo.html` (G4).

Heights: free (the page scrolls); the step row at 1470: four columns of 292.5 px [C: (1200 − 3·10)/4; the steps have no
pixel frame, so no `--px` margin is taken] (F11); below 760 four rows of ≥ 48.

### 8.3 `examples.html` — local only under G8 «б»

No scene [R REQ-112]. Blocks in order (F4) [R REQ-111: «examples.html shows what can and cannot be ordered and three
example requests»; criteria 2 and 12]:

- **E1.** h1 «<examples>», pitch «<…>» (one column, max 54ch).
- **E2. The two lists**: two info panels (7.17), each an h3 and a list in the look of 7.14 (rows with a title and an
  optional sub; no right column): «<what can be ordered>» with the six kinds of product of PLAN §2 «What agents build in
  V1», and «<what cannot be ordered yet>». Their texts are `order_` keys of the texts module (REQ-111 names them), the
  same keys as block D of the landing (8.1). ≥ 1000: side by side, gap 22, 581 px each at 1470 [C: (1200 − 22)/2 −
  2·4, the margins of the pixel frame]; 760 – 999: stacked, max-width 640; below 760: stacked, full width.
- **E3. Three example requests**: the example cards (7.16): grid of 3 at ≥ 1000 (gap 22; 377.3 px each at 1470 [C:
  (1200 − 44)/3 − 2·4, the margins of the pixel frame; the earlier 385 left them out]), one column of max 640 between
  760 and 999, one column below 760.
- **E4.** the big button «<take the demo survey>» → `/demo.html` (G4).

On production the whole page is absent (section 1; G8 «б»).

### 8.4 `demo.html` — the one-tap demo survey and its result

States in order (section 11 for the failure states):

1. **Loading the questionnaire**: the scene in the demo's load state of 9.13 — the question-1 state: «Вы» at the door,
   desk 1 lit, its plate `now`, its person attending — from the first frame, so the arrival of the questionnaire changes
   nothing in the scene (G5); the question panel frame with the message block (7.18, on `--paper`) «<loading…>». Shown
   only when the answer takes over 300 ms [P].
2. **Question i of n** (n = 5 [R PLAN M1; REQ-111]): the scene by the step table (9.13) — «Вы» at the door on question
   1, at the asking desk after each answer; the question panel (7.9) with the option cards (7.10) and the live strip
   (7.11). The heading h2 gets focus without scrolling on each new question [M app.js:135].
3. **Result loading**: after the fifth answer or «<enough…>», «Вы» goes to desk 4 — a walk, or one frame when it stands
   there already (9.13, §10; G5); the result layout with the receipt showing the message «<putting your result
   together…>» in its body, in the on-cream form of 7.18 (G1) [P].
4. **Result**: «Вы» at desk 4. The blocks in reading order, which is the order of the page's DOM (G2):
   - a kind recommended: h2 «<result title>», sub «<answers can be changed with one tap>», the receipt (7.12); the
     «Описать идею» panel (7.15); the chips (7.13); the lists (7.14) — «<what it includes>», «<not a fit if>», then the
     fixed list «Чего Sai пока не делает»;
   - no match: h2, sub, the receipt with the no-match text (7.12); right under it, with nothing between, the fixed list
     «Чего Sai пока не делает» (7.14); the panel (7.15); the chips (7.13).

   ≥ 1000 [M styles.css:178-179]: grid `1fr 430px`, gap `22px 40px`, the panel on the right over all rows; areas «sum |
   panel», «answers | panel», «lists | panel» when a kind is recommended [M], and «sum | panel», «lists | panel»,
   «answers | panel» on no match [P]. ≤ 1000: one column, sum, panel, answers, lists [M styles.css:284]; on no match sum,
   lists, panel, answers [P]. The fixed list's sizes at the three windows are in 7.14.

Fold arithmetic of state 2 (F2), recomputed on a trial page [T]: the sample's styles with Sai's test-mode strip and
caption band, option cards without icons (7.10), the phone toggle at 48 (7.11), the sample's question 5 as the text (two
lines at 390), three options and «Не знаю», the speaker «Проверяющий».

- 1470×784: `<main>` at 465.1, the question panel at 497.1, the option cards 581.1 – 685.1 (fully visible); the live
  strip 727.1 – 813.1 (86 high) with its button at 741.1 – 797.1, so the button's last 13.1 px lie below the fold until a
  short scroll. A longer speaker title takes width from the question: with «Руководитель проекта» (desk 1) the same
  question takes two lines and everything below moves 13 px down (the button to 754.1 – 810.1). The sample's button,
  with answers given, spanned 697.6 – 753.6 [M run].
- 390×844: `<main>` at 334.6, the panel at 360.6; the option cards 505.4 – 599.4 and 615.4 – 709.4 (without icons both
  rows keep the min-height 94 for one- and two-line labels), fully visible; «Не знаю» 725.4 – 773.4; the bar (84.8 high,
  7.11) starts at 759.2, so the last 14.2 px of «Не знаю» lie under the bar until a scroll, and its label (738.2 – 756.6)
  stays visible. With the two-line speaker title of desk 1 everything is 2 px lower (the label ends at 758.6, still
  above the bar). In the sample «Не знаю» spanned 665.3 – 713.3 and stayed above its bar (767.3 without answers) [M run].
- 320×568: the bar starts at 483.2 and the option cards at 477.6: the panel needs scrolling, as in the sample (its cards
  started at 390.8, its bar at 491.3 [M run]).

Where the numbers differ from the sample, the reason is the two required lines (61.1 / 70.6 px at 1470 / 390 [T]) and
the 48-px toggle; the list for the owner is section 17 (question I8).

### 8.5 `404.html`

No scene [R REQ-112]; `<main>` as the sample's «not found» view [M app.js:328]: h1 «Страница не
найдена» [M `app/public/404.html`], pitch «<…>», the big button «<to the landing>» → `/`. Title «Страница не найдена —
Sai» [M `app/public/404.html`]. Status 404 (unchanged).

### 8.6 Page titles

`<title>` = «<page name> — Sai» [P, following `app/public/404.html`]; the landing's title is exactly «Sai — закрытое
тестирование» [R REQ-111 criterion 1; REQ-108 criterion 4; M `app/public/index.html`] (F3), as the eyebrow of 8.1. The
static HTML of each page holds its Russian title; on a language switch the page script sets `document.title` to the
value of the new language (for the landing a key of the texts module, for example en «Sai — closed testing»)
[M app.js:80 pattern]. The checks of the bytes (REQ-111 criterion 1, NM-1, the post-deploy check) read the Russian text
of the file.

## 9. The stage scene

The scene stands at the top of `index.html`, `how.html` and `demo.html` [R REQ-112]. It is an illustration of the four
stages: nothing in it moves or changes by itself; the only thing that moves is «Вы», and only after the visitor's own tap
[R ARCH §11.6; REQ-112].

### 9.1 Canvas, scale and resolution

- Scale `s`, one source for the CSS and the script (G7) [P; the thresholds are the sample's, app.js:106]: `tokens.css`
  sets `--px` to `4px` under the media query `(min-width: 1300px) and (min-height: 700px)`, else `3px` under
  `(min-width: 1000px) and (min-height: 640px)`, else `2px`; the script takes `s` as the integer of the computed `--px`
  of the root element and never computes it from a width. The narrow rule of H below is
  `matchMedia("(max-width: 759px)").matches`, the query of the CSS phone block (styles.css:289). The sample computes `s`
  and its narrow rule from `documentElement.clientWidth` (app.js:105-106), which leaves out a classic scrollbar while
  the CSS media queries count it; with a classic scrollbar of b px, windows 1300 to 1300 + b − 1 px wide would get `--px`
  4 from the CSS and `s` 3 on the canvas (likewise above 1000 and 760; the gate's example in step 03d: 1300–1316), which
  breaks «Пиксель интерфейса = пиксель офиса» (styles.css:2). The matrix windows (macOS, overlay scrollbars) do not
  show the difference.
- Logical size [M app.js:107-109; office.js:221-229]: `H = max(innerHeight < 600 ? 84 : (s == 4 ? 88 : 92), min(150,
  round(innerHeight × (narrow ? .25 : .44) / s)))`; `W = floor(clientWidth / s)`, with `clientWidth` of
  `documentElement`, the stage's own width; `Rw = max(W, 350)`.
- The canvas has the attributes `width = Rw`, `height = H` and the CSS size `Rw·s × H·s` with `image-rendering:
  pixelated`, so every logical pixel is an exact `s × s` block [M office.js:442-443; styles.css:53-54]. The stage is
  `H·s` high and as wide as the window. No text is drawn on the canvas: the scene's words are DOM labels over it (9.7,
  9.8), as in the sample's HTML layer [M office.js:392-416; R ARCH §11.4 `labels.js`].
- Drawing means [R ARCH §11.4; REQ-112 criterion 4]: `fillRect` with `fillStyle` only; integer coordinates and sizes; no
  `drawImage`, paths, arcs, gradients, images, composite modes or `globalAlpha` [P: the sample's static copy, its
  `destination-out` light layer and its `globalAlpha` (office.js:256, 266, 290, 297, 367-381) become filled rectangles
  whose `fillStyle` carries the alpha, from the closed list of 6.2 and 9.11]. At most 4000 draw calls per frame [R REQ-071
  criterion 5].
- Colours (G3): read once per change of the theme, the palette of 6.2 and nothing else — its 24 colour tokens
  (`--sc-wall` … `--sc-dim`), the number `--sc-dim-alpha` and the page token `--ink` [R ARCH §11.4; REQ-112 criteria 4
  and 5]; every other colour of the canvas is a constant of the list of 6.2, and the one colour computed while drawing
  is the light layer's rgba of `--sc-dim` with the alpha of 9.11 (F6). The canvas reads no `--btn`, `--onbtn` or
  `--acc2`: it keeps the sample's accents `#e0731f` and `#1f7a8c` as constants (F9; 6.2).

| Window | s | H | W | Rw | wallH | deskTop | lane | sp | cx (desks 1–4) | stage CSS | canvas CSS width | camera range |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1470×784 | 4 | 88 | 367 | 367 | 35 | 55 | 19 | 76.25 | 84, 160, 237, 313 | 352 | 1468 | 0 |
| 390×844 | 2 | 106 | 195 | 350 | 42 | 62 | 30 | 72 | 82, 154, 226, 298 | 212 | 700 | 0 – 155 |
| 320×568 | 2 | 84 | 160 | 350 | 34 | 54 | 16 | 72 | 82, 154, 226, 298 | 168 | 700 | 0 – 190 |

[M run: `Office.geom()` at each window.] Formulas [M office.js:222-228]: `wallH = round(.40·H)`, `deskTop = wallH + 20`,
`lane = H − (deskTop + 14)`, `doorW = 46`, `sp = (Rw − 46 − 16)/4`, `cx[i] = round(46 + sp·(i + .5))`.

### 9.2 Drawing order [M office.js:232-389]

1. wall, floor, rug, windows, door, desk shadows, plant (9.4); 2. wall decor (9.5); 3. the printer at desk 4; 4. per desk:
person, desk, monitor, mug, hands, lamp, default desk items (9.5, 9.6); 5. the light layer and, in the dark theme, the
lamp glow (9.11); 6. the visitor (9.8). Above the canvas, in a layer that moves with it: the door sign, the four plates
and the «Вы» label (9.7, 9.8) [M office.js:423-431].

### 9.3 Coordinates

All coordinates below are logical px; `cx[n]` is the centre of desk n (n = 1 … 4; the sample's `G.cx[n − 1]`), `cx`
alone the centre of the desk being drawn, `dt` = `deskTop`, `wh` = `wallH` [M office.js].

### 9.4 Static parts [M office.js:232-269]

- Wall: `--sc-wall` from 0 to `wh`; rows 0–1 `--sc-wall-top`; the base band `--sc-wall-b` 7 rows at `wh − 7`; trim lines
  `--sc-trim` at `wh − 8` and `wh`.
- Floor: checks 8×8 from `wh + 1`, alternating `--sc-floor-a` / `--sc-floor-b` by `(i + j) % 2`.
- Rug: from `H − 17`, 14 high, `--sc-rug`; edges `--sc-rug-edge` at its first and last row; dashes 3×1 every 6 at row 3 and
  at row 10 shifted by 3.
- Windows at `round(46 + sp·k) − 11` for k = 1, 3; top 5; size 22 × `max(14, wh − 17)`; frame `--sc-trim`; sky `--sc-sky`;
  light theme: two clouds `#ffffff` and a sun `#ffe9a0`; dark theme: a moon `#f4ecc8` and five stars `#ffffff` (by the
  theme, never by the time); mullions `--sc-trim`; light theme only: four light beams `rgba(255, 242, 184, .16)` on the
  floor.
- Door [M office.js:260-263]: frame `--sc-trim` from (5, 4), 38 × (`wh` − 3); door `#1f7a8c` from (7, 5), 34 × (`wh` −
  5), top highlight 2 rows `#579ba9`, a panel `#196270` (the values of 6.2, F6); knob gold `#e8b64c` 2×3 at mid-height; a
  `--sc-trim` sill under it; doormat `--sc-rug-edge` with a `--sc-rug` inner part.
- Desk shadows: `rgba(0, 0, 0, .22)`, 54×3 at `dt + 14` under each desk.
- Plant at `Rw − 14`, `wh − 10`, in `#8a5a3c`, `#a8723f`, `#2e9a55`, `#41a15f` [M office.js:164-166, 268].

### 9.5 Furniture and desk items [M office.js:302-346]

- Wall decor [M office.js:303-304]: desk 1 pin board, desk 2 binders, desk 3 blueprint, desk 4 certificate (shifted +6),
  drawn as office.js:143-157 at `cx − w/2`, `max(5, wh − h − 8)`, in the colours of 6.2 (the binders' light edges and
  the certificate's `--ink` line included, F6). No clock: its place between desks 2 and 3 stays plain wall (S43).
- Printer at `cx[4] + 30`, `dt − 1` with the sheet of `n = 0` (2 rows of paper) [M office.js:158-162, 316; R REQ-112: no
  count].
- Desk [M office.js:331-332]: top 52×5 `--sc-wood-l` with its first row `--sc-desk-hi` (F6), front 52×9 `--sc-wood-m`,
  bottom row and legs `--sc-wood-d`, from `cx − 26`.
- Monitor [M office.js:79-86, 335]: at `cx + 4`, `dt − 15`; 17×12 frame `#0d1420`, screen `#10283a`; stand `--sc-metal`;
  four still code lines of lengths 5, 10, 7, 12 (office.js:85 with no busy frame), alternating `#e0731f` and `#9fd0e6`
  [M office.js:85: the sample's accent, F9].
- Mugs on desks 1–2 (`#f2f2f2`, coffee `#6a4a2c`) with their steam pixel `#ffffffaa`, drawn as in the sample's frame 1
  [M office.js:163, 336]; paper stacks on desks 2 and 3 (`--sc-paper`, `#e8e3d4`), the bell on desk 1 (`--sc-wood-d`,
  `#e8b64c`, its light `#f1d394`, `--sc-metal`), a red box on desk 4 (`#d8473f`, top row `#e47e79`) [M office.js:106-108,
  343-346; values 6.2, F6]; lamp (`--sc-metal`) at `cx + 16…23` with the bulb `#ffd98a` when the desk light is .75 or 1,
  else `#7a8499` [M office.js:340].

### 9.6 People [M office.js:173-205; data.js:152-155]

| Desk | Role title (ru) [R REQ-112] | Skin | Hair | Style | Shirt | Sample figure |
|---|---|---|---|---|---|---|
| 1 «Принято» | Руководитель проекта | `#f0cfae` | `#2b1d17` | long | `#e0731f` | f01 |
| 2 «Готовим документацию» | Аналитик | `#e7bd96` | `#1f1a17` | short | `#1f7a8c` | f02 |
| 3 «Готовим спецификацию» | Разработчик | `#f0cfae` | `#6a4a2c` | cap | `#c99a2e` | f03 |
| 4 «Готово к просмотру» | Проверяющий | `#e7bd96` | `#241915` | bun | `#2f5560` | f04 |

[M data.js:152-155: the four «Складеон» staff without their names, their shirts as the sample has them (F9).] Each
person [M office.js:173-205; the derived values of 6.2, F6]: chair 18×16 `--sc-chair`, its top 2 rows `--sc-chair-hi` and
its bottom 2 rows `--sc-chair-lo`; torso 12×9 in the shirt, its top 2 rows the shirt's light value and its bottom 3 rows
the shirt's dark value; arms 2×8 in the shirt's dark value; neck 2×3 and the chin row in the skin's shade; head 8×9 in the
skin; hair by style (the cap of desk 3 in the shirt's dark value); eyes 1×2 `#1d1712`; cheeks `#e8a08c`; mouth 2×1; hands
2×2 `#e9c4a0`. Still poses, drawn as office.js with frame 1 (eyes open; frame 0 of the sample is a blink,
office.js:196) [P; R REQ-112: no idle motion]: the person of the desk that faces «Вы» (9.13) in the pose `attend` (leaning
1 px, mouth `#8a3a30`); the others in the pose `type` (mouth in the skin's shade). No `wave`, `busy` or `present` pose.

### 9.7 Labels: the plates and the door sign [M styles.css:55-66; office.js:397-400, 449-450; CC]

- A layer over the canvas inside the element the camera moves (9.14) [M office.js:423, 485]; `pointer-events: none` [M
  styles.css:55-56]; built by `labels.js` with `textContent` [R ARCH §11.4]. Every label is placed by the positions of 9.1
  in CSS px (logical × `s`) through the means of 5.2.
- Plates, one per desk: left `(cx[n] − 25)·s`, top `(dt + 6)·s`, width `50·s` [M office.js:400]; height `8·s` for one line
  [M], `13·s` for two lines, the same height for all four plates of a page language [P]; fill `--plate`, a 1 px inset
  edge `--plate-edge`; text `--plate-ink` (6.1, G6), 900, uppercase, letter spacing .03em, size `3.9·s` px (15.6 / 11.7 /
  7.8 [M run]),
  centred, line height 1 for one line and 1.1 for two [M styles.css:56; P]; `overflow: hidden`, no ellipsis.
- Plate words [R decisions/0084 §3 item 8; ARCH §11.6]: «1 · ПРИНЯТО»; «2 · ГОТОВИМ» / «ДОКУМЕНТАЦИЮ»; «3 · ГОТОВИМ» /
  «СПЕЦИФИКАЦИЮ»; «4 · ГОТОВО» / «К ПРОСМОТРУ» — line 1 is the number, « · » and the first word, line 2 the rest [P: the
  sample's plates held short words, «1 · ПРИЁМ» etc., data.js:31]. The break is explicit (F11): a plate holds one child
  element per line, each set with `textContent` and kept on one line (`white-space: nowrap`); a plate never wraps by
  itself, because natural wrapping in the 50-logical plate gives «4 · ГОТОВО К» / «ПРОСМОТРУ» [T]. A one-word stage word
  («1 · ПРИНЯТО») has one line, centred in the plate's height. Widths at 15.6 px 900 with .03em [M run]:
  СПЕЦИФИКАЦИЮ 158.5, ДОКУМЕНТАЦИЮ 152.9, К ПРОСМОТРУ 125.5, 3 · ГОТОВИМ 109.7, DOCUMENTATION 148.5, SPECIFICATION
  129.8 — all within 46 logical (184 px at s 4), and the ratio holds at every `s` because the font and the plate scale
  together. A line wider than 46 logical is a text problem for REQ-111 (a shorter word): a label is never cut or shrunk
  [P; R REQ-112 criterion 6: no label cut].
- Plate states [M styles.css:59; office.js:469]: default; `now` (9.13): fill `--plate-now` (`#ce6a1d`), text `--onbtn`
  (`#1b1208`, 5.02:1), the same in both themes (G6) [P: the plates keep their light colours in the dark theme (shot
  agency-1470-dark-05-ask5), and the dark `--btn` `#e0731f` would give 2.76:1 against a default plate, 6.3]; a 1 px
  inset edge `--plate-now-edge`, the sample's `--ink` of each theme [M styles.css:59]: `#17343a` in light and the light
  `#f2ead8` in dark, the approved mockup kept one to one (3.59:1 in light and 3.07:1 in dark against the fill;
  decoration, 6.3) (J7). The sample's `done` and `wait` are not used (S49).
- At `H = 88` a two-line plate reaches `dt + 19` = 74 and covers the rug's top 3 rows under each desk [C].
- «Вы» and the plates (F11): the layer keeps the sample's order — the door sign, the «Вы» label, then the four plates
  (office.js:424-427) — so where a plate and the «Вы» label meet, the plate paints over the label. At rest they never meet
  [C]: the visitor stands at `cx − 37` (its body ends at `cx − 32`, office.js:207-215, 465) and its 31.6-px label ends
  at `(cx − 37)·s + 15.8`: 32.2 px left of its desk's plate at s = 4 and 8.2 px at s = 2; its left end is 40.2 px or
  more (s = 4) and 4.2 px (s = 2) right of the plate of the desk before. Vertically, the label (`(H − 36)·s` to 22 px
  lower) stays above the plates at 1470 (208 – 230 against 244) and at 320 (96 – 118 against 120), so it never crosses
  them there. At 390 the label (140 – 162) and the plates (136 – 152, two lines to 162) share a band, so during a walk the
  label passes under each plate it crosses, as in the sample (shot stock-390-light-05-ask5); REQ-112 criterion 6 («no two
  labels overlap») is read when «Вы» stands, not during a walk.
- Door sign [M office.js:397; styles.css:63-66]: left `7·s`, top `max(7, wh − 27)·s`, width `34·s`, height `17·s`; fill
  `--plate`, a 1 px inset edge `--plate-edge` and a `1.4·s` bottom band in `--btn`; line 1 «Sai» `3.9·s` px 900, −.01em,
  `--plate-ink`; line 2 «<tagline>» 10 px `--plate-ink2`, hidden at `s = 2` [M styles.css:66] (REQ-111's text) (G6).

### 9.8 The visitor and «Вы» [M office.js:207-218, 383-388, 406; styles.css:67-68]

- Figure 12×22 logical on the canvas, feet on `H − 3` [M office.js:207-218; the values of 6.2, F6]: shadow
  `rgba(0, 0, 0, .22)`; legs `#2d3446`, shoes `#161b26`; jacket 10×9 `--sc-jacket`, its top 2 rows `--sc-jacket-hi`, its
  bottom 2 rows and the arms `--sc-jacket-lo`; the backpack 6×6 `--sc-pack` with its top row `--sc-pack-hi`; hair
  `#3a2c22`, neck `#d9b08a`, hair top `#2a1f18`. Walk speed 72 logical px per second, step frames of 160 ms, a 1 px bob
  while walking [M office.js:386-387, 209]; standing: step frame 0, no bob.
- Label «Вы» [R ARCH §11.6], a DOM label of 9.7's layer: 12 px, 900, line 16, padding `1px 6px`, fill `--btn`, text
  `--onbtn`, a 2 px `--ink` edge, a 6×4 px `--ink` pointer under its centre; centred on the visitor's `x·s`; top
  `(H − 36)·s` from the stage top [M run: 208 at 1470, 140 at 390]; measured 31.6×18 at 1470 [M run]. It moves only with
  the figure; no idle bob [P: the sample bobs it every .6 s, styles.css:272, 278; R REQ-112].
- The figure is at least 20 CSS px tall at every window: 22 logical × `s` = 44 px at `s = 2` [C; R REQ-112 criterion 6].

### 9.9 Bubbles — not drawn

The sample's speech bubbles (S51) come and go by time; the scene has none [R REQ-112, its question О15].

### 9.10 Couriers, props, clock, stamp — not drawn

Only «Вы» moves and the scene shows no time, count or status [R REQ-112]: no courier sheet (S52), no prop from an answer
(S48), no wall clock (S43), no printer count (S47), no stamp, folder or stamp tool (S54, S57), no idle staff motion.

### 9.11 Light [M office.js:364-381; CC]

- Each desk has a light level L, the sample's levels (F5) [M office.js:459-463]: .75 at every desk in the start state —
  the landing, and `how.html` before a tap (`start`); during a question 1 at the asking desk and 0 at the others (`ask`)
  — the demo from its load on, question 1 lighting desk 1; on the result 1 at desk 4 and .25 at the others (`result`).
  After a tap on step n of `how.html`: 1 at desk n and 0 at the others [P: the sample has no state for a step of «how it
  works»; this is its question state with desk n asking]. L changes at once with the tap; the sample eases it over about
  1 s (office.js:365), which would draw frames after a walk ends [R REQ-112 criterion 5; on the owner's list, section 17].
- Overlay, as the sample draws it (F5): the dim colour `--sc-dim` over the whole scene; for each desk with L > 0, three
  nested bands with half-widths 56, 46 and 36 at the bottom row, narrowing upwards as `round(half·(.55 + .45·y/H))`,
  plus 6 on each side, in rows of 2 [M office.js:370-376]; each band keeps `1 − .4·L`, `1 − .4·L` and `1 − .5·L` of the
  overlay [M office.js:374]. Bands of neighbouring desks overlap where they meet and a point under both keeps the product
  (the sample's `destination-out` multiplies, office.js:369) — in the start state and on the result, from row 6 down at
  1470 and from row 0 at 390 and 320 [C]. The alpha of a point is the strength (.15 light, .5 dark [M office.js:366])
  times the product of what the bands over it keep.
- The rule (G3) [R REQ-112 criterion 4 (J5): the light layer carries the channels of `--sc-dim` with an alpha computed
  from the strength `--sc-dim-alpha` and the closed list «What the bands keep» of the state drawn, the exact product
  rounded half up to 4 decimals]:
  a fill of the light layer is `--sc-dim` with the alpha `--sc-dim-alpha` × k, where k is what the bands over the point
  keep, a value of the closed list of its state (the second column below), rounded half up to 4 decimals in exact
  decimal arithmetic — never a rounded binary floating-point product: four values are exactly half-way (.10935, .05145
  in light; .32805, .12005 in dark), and a float product may round them down. For the strengths of `tokens.css` the rule
  gives the closed lists of alpha values below [C: the bands of office.js:370-376 run over every row and column of the
  scene at the three windows; the same sets come out at each window]:

| State (L per desk) | What the bands keep | Light alpha, `rgba(58, 42, 24, a)` | Dark alpha, `rgba(5, 10, 20, a)` |
|---|---|---|---|
| start: .75 at all four | 1, .7, .49, .343, .30625, .2401, .214375, .1500625, .0937890625 | .15, .105, .0735, .0515, .0459, .036, .0322, .0225, .0141 | .5, .35, .245, .1715, .1531, .1201, .1072, .075, .0469 |
| a question, or a step of how: 1 at one desk, 0 at the others | 1, .6, .36, .18 | .15, .09, .054, .027 | .5, .3, .18, .09 |
| the result: 1 at desk 4, .25 at desks 1–3 | 1, .9, .81, .729, .70875, .6561, .637875, .6, .5740875, .54, .5023265625, .486, .42525, .36, .324, .2916, .25515, .18, .162, .1458, .127575 | .15, .135, .1215, .1094, .1063, .0984, .0957, .09, .0861, .081, .0753, .0729, .0638, .054, .0486, .0437, .0383, .027, .0243, .0219, .0191 | .5, .45, .405, .3645, .3544, .3281, .3189, .3, .287, .27, .2512, .243, .2126, .18, .162, .1458, .1276, .09, .081, .0729, .0638 |

  All in all 29 values per theme. Example (the gate's own check, step 03b): at 1470, dark, question 5, row 86, x 263 –
  268 lie under the outer two bands of desk 4 only, so the alpha is .5 × .6 × .6 = .18, as in the sample.
- Dark theme: a warm glow `rgba(255, 217, 138, a)` under each desk with L ≥ .75 (a = .16·L: .12 or .16), 40×6 at `dt − 2`
  and 56×4 at `dt + 14` [M office.js:381]; the glows of neighbouring desks do not meet [C: 56 wide, desks 72 or more
  apart].

### 9.12 Stamp — not drawn

See 9.10 (S54).

### 9.13 States and the step table [P; R REQ-112: «the step table … named by the look description»]

The demo's five questions are asked at the desks `d = [1, 2, 3, 3, 4]` (question 1 … 5) [M data.js:178-206, the `st` of
each question 0, 1, 2, 2, 3; `tools/src/picker/demo-tenants-v3/stock.json` and `agency.json`, `desk` 1, 2, 3, 3, 4]: the
intake of format /2 has no desk of its own [R REQ-111].

| Page, moment | «Вы» (a tap starts one walk) | Light (9.11) | Plate `now` | `attend` pose |
|---|---|---|---|---|
| the landing and `how.html`, at load | at the door, x 24 [M office.js:464; R REQ-112] | .75 each [M office.js:461 `start`] | none | none |
| `demo.html`, at load (question 1), also while the questionnaire loads and when it fails (8.4 state 1, §11; G5) | at the door, x 24 [R REQ-112: no walk without a tap] | desk 1 1, others 0 [M office.js:461 `ask`, the sample's question 1] (F5) | desk 1 | desk 1 |
| `how.html`, tap on step n | walks to `cx[n] − 37` | desk n 1, others 0 [P: the question state with desk n asking] (F5) | desk n | desk n |
| `demo.html`, tap on an answer to question i < 5 | walks to `cx[d(i + 1)] − 37`; after question 3 it is already there (no walk) | desk `d(i + 1)` 1, others 0 [M office.js:461 `ask`] (F5) | desk `d(i + 1)` | desk `d(i + 1)` |
| `demo.html`, tap on the fifth answer or on «<enough…>» | walks to `cx[4] − 37`; from question 5 it stands there already (no walk: one frame, §10; G5) | desk 4 1, others .25 [M office.js:461 `result`] | desk 4 | desk 4 |
| `demo.html`, «Назад» from question i | walks to `cx[d(i − 1)] − 37`, to the door for question 1 | as the target question | desk `d(i − 1)` | desk `d(i − 1)` |
| `demo.html`, a chip of the result (change question i) | walks to `cx[d(i)] − 37` (the door for question 1); after the answer back to desk 4; for question 5 no walk either way (one frame each, §10; G5) | as the target | desk `d(i)` | desk `d(i)` |

The question panel's tail points at `(cx[d(i)] − 8)·s` minus the camera offset [M app.js:167; office.js:488]. A tap on the
step or the answer that is already current starts no walk; when the state it leads to equals the drawn one (also
question 4 after question 3, both at desk 3), it draws no frame (§10, G5). The result request and its failure change
nothing in the scene: it stays in the result state.

### 9.14 Camera [M office.js:476-486; CC]

When `Rw > W`, that is whenever `W < 350` (under 700 px at `s = 2`, 1000–1049 px at `s = 3`, 1300–1399 px at `s = 4`;
J7): offset = `clamp(round(focus − W/2), 0, Rw − W)` logical (rounding
halves up, as `Math.round`), where focus is 70 in the start state — the landing, and `how.html` before a tap — [M
office.js:480], the asking desk's `cx` during a question (desk 1 from the demo's load on, also while the questionnaire
loads), `cx[4]` on the result, and the `cx` of desk n after a tap on step n of `how.html`. Measured offsets on question
5: 155 at 390, 190 at 320 [M run]. The offset eases on `cubic-bezier(.3, .7, .2, 1)` over 700 ms [M office.js:484], or
over the walk's own time when the walk is shorter — the walk door → desk 1 is 21 logical px at 390 and 320, .29 s at 72
px/s, and moves the camera 0 → 2 at 320 —, drawn by the frames of the walk, so the camera stands at its new offset in
the walk's last frame and no frame follows (G5) [P]; at once on the first frame of the page, on a state change with no
walk (§10) and with reduced motion [P: the sample moves it by a CSS transition of the same time and curve; section 10,
F9].

Visible range of the scene (F7) [C from the formula and the geometry of 9.1; logical x; desk n spans `cx[n] ± 26`, the
door 5 – 43, «Вы» at the door at x 24 and at desk n at `cx[n] − 37`, the printer 328 – 344, the plant 336 – 346]:

| Window | Focus: page and moment | Offset | Visible x | In view |
|---|---|---|---|---|
| 1470×784 | any | 0 | 0 – 367 | the whole scene: the door, «Вы», desks 1 – 4, the printer, the plant |
| 390×844 | 70: the landing (always), `how.html` before a tap | 0 | 0 – 195 | the door, «Вы», desks 1 and 2; desk 3 starts at 200 |
| 390×844 | desk 1: the demo at load and on question 1; step 1 | 0 | 0 – 195 | the same |
| 390×844 | desk 2: question 2; step 2 | 57 | 57 – 252 | desk 1 from 57, desks 2 and 3 |
| 390×844 | desk 3: questions 3 and 4; step 3 | 129 | 129 – 324 | desk 2 from 129, desks 3 and 4 |
| 390×844 | desk 4: question 5, the result; step 4 | 155 | 155 – 350 | desk 2 from 155, desks 3 and 4, the printer, the plant |
| 320×568 | 70: the landing, `how.html` before a tap | 0 | 0 – 160 | the door, «Вы», desk 1, desk 2 to 160 (its plate cut by the stage's edge) |
| 320×568 | desk 1 | 2 | 2 – 162 | the same |
| 320×568 | desk 2 | 74 | 74 – 234 | desk 1 from 74, desk 2, desk 3 to 234 |
| 320×568 | desk 3 | 146 | 146 – 306 | desk 2 from 146, desk 3, desk 4 to 306 |
| 320×568 | desk 4 | 190 | 190 – 350 | desks 3 and 4, the printer, the plant |

«Вы» is in view at every row: at the door (24) while the offset is 0 or 2, and at its desk (`cx[n] − 37`: 45, 117, 189,
261) after a tap. So on a phone the landing shows the door, «Вы» and desks 1 – 2 (at 320 desk 1 and the left part of desk
2); desks 3 and 4 come into view on `how.html` after a tap on step 3 or 4 and in the demo from question 3 on. The four
stage words are readable on the phone landing all the same: in block B (8.1) and in the text list (9.16). Keeping the
sample's framing on the phone landing is on the owner's list (section 17) and is question I10 (PLAN M1 «Owner sees» names
the scene with four desks «on phone and laptop»).

REQ-112 criterion 6 («at 320×568 the canvas fits the width with no horizontal scroll») is read here as: the stage — the
`role="img"` element — is as wide as the window and the page has no horizontal scroll; the canvas inside it is 700 CSS
px wide at 320 and at 390 and the stage clips it (`overflow: hidden`), as the sample does [M run: `scrollWidth` =
`clientWidth` at every window]. The wording of the criterion is raised to ORCH (issue I2 of step 03c; the same point is
REQ-VALIDATOR's F6 in step 02).

### 9.15 Avatars

24×26 logical (the sample's 24×23 canvas shown at 72×78 stretched it by 3.39 vertically, app.js:147 and styles.css:110),
drawn with the person of 9.6 in the pose `attend`, frame 1 [M office.js:521-524; CC]; 3 CSS px per logical px (72×78,
the sample's size) in the team card of the default row of four (7.7, finding G9); 2 CSS px per logical px (48×52) in
the speaker (7.9) and in the team card of the 2×2 option (7.7, F8). The sample's card icons are not drawn (S56).

### 9.16 Accessibility and failure

- The stage is `role="img"` with the name «<office alt>» and holds only the canvas and the label layer (7.4). The text
  list stands right after it, outside the `role="img"` element, before the caption (F12) [P: ARIA 1.2 makes the children
  of an `img` presentational, so a list inside it may be hidden from a screen reader; Chrome 157 still exposes it, as the
  gate measured in step 03b, but that is not a promise of every reader]: an `<ol>` of the four desks, «<n> · <stage
  word> — <role title>», and one line where «Вы» stands («<at the door>» or «<at desk n: stage word>»). While the canvas
  draws, the list and the line are visually hidden by the `.sr` rule, and the live region (7.21) says the new place
  after a walk [R ARCH §11.4 `labels.js`; REQ-112 criterion 6].
- The text view — no script, `getContext` returns `null`, or drawing throws (F12) [P]: the stage element is not shown and
  the list stands in its place. With no script this comes from a style sheet that only a `<noscript>` element in the
  `<head>` of the three pages links (`<link rel="stylesheet">` of a file of `app/public`; no inline style); when the
  canvas cannot draw, `view.js` sets the same view by a class. The look: background `--sc-wall`, the stage's `--px`
  bottom border in `--ink`, padding `12px var(--gut)`; the four items as plates in a centred wrapping row, gap 8 — fill
  `--plate`, a 1 px inset edge `--plate-edge`, text `--plate-ink` (13.77:1; G6), 13px/800, line height 1.2, padding
  `4px 8px`, centred, wrapping at spaces —; under them, margin-top 8, the «Вы» line, 13px/1.35, centred, in `--ink`:
  9.77:1 on `--sc-wall` in light and 10.70:1 in dark [C]. Its height is that of its content, never a value set by
  script (5.2 (d) sets the stage's height only in the canvas view): 77.1 px at 1470 (one row of plates), 169.9 at 390
  (four rows), 185.5 at 320 (four rows, the third in two lines) [T, ru]. No error reaches the console [R REQ-112
  criterion 6].
- Before its first frame the canvas view keeps the height the CSS gives the stage for the window's scale, the lower bound
  of H in 9.1 times `s` [P]: 352 at s 4, 276 at s 3, 184 at s 2 (168 when the window is under 600 high); `view.js` sets
  the exact `H·s` with the first frame, so the stage can only grow by then.
- Pure modules (`grid.js`, `sim.js`, `stage-scene.js`, `draw.js`) have no DOM, clock or `Math.random` [R ARCH §11.4;
  REQ-112 criterion 3]. The scene is a side view: one walkable row (the rug) with five stops, the door and the four desk
  approaches; the walk is the straight run along the rug. The small map the port adds for it is REQ-112's.

## 10. Motion and reduced motion

- What moves: only «Вы» walking to the target of a tap, and the camera on narrow windows during that walk [R ARCH §11.6;
  REQ-112]. Nothing else moves, blinks or changes by time (9.9, 9.10).
- Frames, one rule (G5) [M office.js:535-536, 540 for the 40 ms and the hidden page; R ARCH §11.4; REQ-112 criterion 5]:
  one at load, in the page's load state (9.13); after it a frame is drawn only for these events, and none after them:
  - a tap that starts a walk: frames during the walk, at most 25 a second (a frame when 40 ms passed), the last one with
    «Вы» at its target and the camera at its new offset (9.14); the light, the plate `now` and the poses take the new
    state with the walk's first frame;
  - a tap that changes the state with no walk — «Вы» stands where the step table sends it (the fifth answer or
    «<enough…>» on question 5, a result chip of question 5 and the return from it to the result): one frame with the new
    state, the camera at its new offset at once;
  - a tap whose state equals the drawn one (9.13): no frame;
  - a change of the theme, the language or the window size: one frame.
  The questionnaire's arrival or failure and the result request's answer or failure are no state change of the scene:
  `demo.html` draws the question-1 state from its first frame (8.4 state 1). No frame while the page is hidden; a walk
  goes on when it is shown again [R REQ-112].
- `prefers-reduced-motion: reduce` [R ARCH §11.4; M app.js:407]: a tap puts «Вы» at its target in one frame with no place
  between, and the camera there at once; a change of the setting while the page is open is followed [R REQ-112 criterion
  5]. The next demo question opens after 60 ms instead of 480 ms [M app.js:245].
- CSS motion of the page, kept from the sample as feedback of the interface (F9); REQ-112's «nothing moves by itself» is
  about the scene, and each of these follows a tap or a pointer:
  - the press of `btn` and `card`: `transform .08s` [M styles.css:91, 134], with `background .2s` added while the system
    allows motion [M styles.css:266; the sample's `still` flag is the system setting here];
  - the hover of a card: up by `--px` with the same `.08s` [M styles.css:134-135];
  - the tail of the question panel: `left .6s cubic-bezier(.3, .7, .2, 1)` when the asking desk changes [M
    styles.css:116];
  - the phone sheet: `opacity`, `transform` and `visibility` in `.15s` [M styles.css:320];
  - the plates: `background .3s, color .3s` when a plate becomes or stops being `now` [M styles.css:56];
  - only while the system allows motion (`prefers-reduced-motion: no-preference`): `rise`, the content of the panel fading
    in on each new view in `.35s steps(5)` [M styles.css:271, 277], and `newline`, the newest chip of the live strip
    going from `--btn` to `--chip` in 1.4 s [M styles.css:270, 276].
- Not carried, each for its reason (F9): `stamp` (no stamp, S54; styles.css:268, 274); `bob` of «Вы» (no idle motion,
  REQ-112; styles.css:272, 278); `tick`, the pulse of the strip's price numbers in `--acct` (styles.css:269, 275): the
  strip has no price, and `--acct` on `--rc` is 1.74:1 in dark [C]; the band's `.5s` (styles.css:169): no band (S27); the
  camera's CSS transition (office.js:484): the camera moves with the frames of the walk, with the same curve and time, or
  the walk's own time when it is shorter (9.14, G5) [P: the scene keeps one clock, the frames of the walk, which REQ-112
  criterion 5 counts (at most 25 a second);
  the sample's camera runs at the screen's rate; on the owner's list, section 17].
- With `prefers-reduced-motion: reduce` the page keeps what the sample keeps under its `still` flag: the `.08s` press, the
  `.6s` tail, the `.15s` sheet and the `.3s` plates are unconditional in the sample and stay so; the `background .2s`,
  `rise` and `newline` stop [M styles.css:56, 91, 116, 134, 266-273, 320].

## 11. States of the system

| Area | State | What is seen |
|---|---|---|
| any page | no script | the HTML texts in Russian; in place of the stage, the text view of 9.16 (the four plates and the «Вы» line in `--ink`; 77.1 / 169.9 / 185.5 px high at the three windows [T]) (F12); the language and theme buttons do nothing visible; `demo.html` shows «<the demo needs JavaScript>» in a `<noscript>` block [P] |
| any page | language other than ru | after the scripts run every text is in that language; no page mixes two languages [P] |
| any page | `localStorage` throws on read or write | the language from `?lang=` or ru, the theme from the system; the buttons still work until a reload [R REQ-111 criterion 4] |
| `demo.html` | loading the questionnaire | 8.4 state 1 |
| `demo.html` | server error (5xx, or a body that is not the questionnaire) | message block on `--paper` (7.18): «<the survey did not load>», «<retry>», «<to the landing>»; the scene stays in its load state, the question-1 state of 9.13, and nothing in it shows the failure (G5) [P; R REQ-111 criterion 12] |
| `demo.html` | no connection, or no answer within the page's time limit | message block on `--paper` «<no connection…>» with «<retry>»; the scene as for a server error [P; R REQ-111 criterion 12] |
| `demo.html` | refused (4xx) | the same message block as a server error [P]; the demo has no rate limit in M1 [R REQ-111, its question О5] |
| `demo.html` | result request fails | the receipt body shows the same messages in the on-cream form of 7.18 (`--rcink`, `--rc2`, `--rcerr`, `--rclink`, rings `--ring-rc`; G1); the answers stay in the page and «<retry>» sends them again; the scene stays in the result state (G5) [P; R REQ-111 criterion 12] |
| `demo.html` | reload, or a direct link to a later question or to the result | question 1 with no answers (nothing is stored) [P] |
| result | no match | 7.12 «No match» |
| result | close options | 7.12 «Close options» |
| result | a lot of data | lists grow with no cut and no inner scroll [P] |
| landing, how, footer | production (G8 «б», G9) | the order blocks, the examples link and the kk button absent (section 1) |
| any page | dark theme, three windows, three languages | the same layout; only tokens change |

## 12. Keyboard, focus order, touch

- Tab order: skip link → brand → language buttons → theme button → `<main>` in reading order → footer links [M
  index.html]. In `<main>`: landing — big button, ghost button, step links, (local) examples link; how — the step buttons,
  then the links of the sections; question — back, cards 1…n, «Не знаю», the toggle (narrow), «<enough…>»; result — the
  «Описать идею» link, chips in order, links. On `demo.html` the question heading already holds the focus at load
  (`demo.js` announces the first question, as the sample's `app.js:135` does after each step; О30 [R decision 0124]), so
  the first Tab goes to «‹ Назад», the second to card 1, and the skip link is the sixth stop of Shift+Tab (after the theme
  button, «EN», «ҚАЗ», «RU» and the brand link; on production, which has no «ҚАЗ» (G9), the fifth [C], not run here); on the other pages
  (`index.html`, `how.html`, `404.html` and the local `examples.html`) the skip link is the first stop of Tab [M build,
  local set; `examples.html` at 1470×784 only, the others also at 390×844 and 320×568].
- Keys on a question [M app.js:391-403; README «Клавиатура»]: 1–4 press the cards, 0 «Не знаю»; Backspace goes back
  wherever the focus is (the demo has no text field), and ArrowLeft goes back when the focus is on no button at all
  (app.js:397: `k === 'ArrowLeft' && tag !== 'button'`) (F10); on a card, ArrowLeft and ArrowRight move to the card before
  or after, and on another button (such as «‹ Назад» or the toggle) they do nothing; Shift+Enter «<enough…>», Escape
  closes the sheet. Enter and Space press the focused button [R REQ-111 criterion 12: the whole survey by keyboard].
- Focus after a step: the new h2 (no ring) [M app.js:135]; after the result opens: its h2.
- Touch: every target has a box of at least 48×48 (6.5, F2): the buttons, links and switches, also the brand link (7.2),
  the skip link (7.1) and the phone toggle (7.11) [R REQ-111 criterion 12: ≥ 44×44]. Nothing lies over a control that
  cannot be scrolled from under it: the fixed bar of 7.11 (84.8 px [T]) may cover the bottom of the page until the visitor
  scrolls, and the 96 px bottom padding lets every card scroll above it [P; AP-105].
- No horizontal scroll at the three windows [M run: `scrollWidth` = `clientWidth` = 1470 / 390 / 320 on every screen]; the
  stage clips the wider canvas (`overflow: hidden`).

## 13. Languages and texts

### 13.1 Words fixed by records

| Text | Where | Source |
|---|---|---|
| «Принято», «Готовим документацию», «Готовим спецификацию», «Готово к просмотру» | plates, steps, team cards, speaker, text list | decisions/0084 §3 item 8; ARCH §11.6 |
| «Руководитель проекта», «Аналитик», «Разработчик», «Проверяющий» (desks 1–4) | team cards, speaker, text list | REQ-112 (`tools/src/team/roles.js`) |
| «Вы» | the visitor's label | ARCH §11.6 |
| «Картинка показывает этапы работы, а не движения людей.» | caption band | ARCH §11.6 |
| «Sai работает в тестовом режиме: вход по приглашению, заказы не принимаются.» | test-mode strip | PLAN M1; REQ-111 |
| «Sai — закрытое тестирование» | the landing's eyebrow and `<title>` (8.1, 8.6; F3) | REQ-111 criterion 1; REQ-108 criterion 4 |
| «Работу в Sai выполняют ИИ-агенты (искусственный интеллект). Их ответы могут быть неточными.» | footer of every page; landing meta line | REQ-111 |
| «Авто», «Светлая», «Тёмная»; kk «Авто», «Ашық», «Қараңғы»; en «Auto», «Light», «Dark» | theme button | decisions/0084 §3 item 15; REQ-111 |
| «Описать идею» | result panel button | PLAN M1; REQ-111 |
| «Чего Sai пока не делает» | the heading of the fixed list on every demo result (7.14) | REQ-111 (its paragraph «What Sai cannot build yet»; criteria 2, 12) (G2) |
| «Серверы, API и базы данных»; «Вход по логину и паролю»; «Приём оплаты»; «Настоящая отправка писем и сообщений в мессенджеры»; «Связь с внешними системами учёта и CRM»; «Сбор данных с чужих сайтов»; «Расширения для браузера»; «Мобильные приложения»; «То, что требует секретных ключей или паролей»; «То, что нарушает правила использования ИИ» | the ten items of the fixed list, in this order (7.14) | REQ-111 (the same paragraph and criteria) (G2) |
| «Страница не найдена» | 404 h1 | `app/public/404.html` |

kk and en of these words are REQ-111's (texts module, reader rounds).

### 13.2 Rules [R ARCH §17; REQ-111]

At most 18 words per phrase; the polite «вы»; no control or invisible characters; the forbidden-words lint over every
public text (lists Г, Б, В, П, Ц, С of REQ-111); the word ban of section 1. kk is built and tested and hidden on
production until G9; on production `?lang=kk` shows the Russian page with «RU» pressed [R REQ-111 criteria 2, 9]; locally
the kk draft note shows in the footer (7.19).

### 13.3 Length budgets [P, from the measured widths]

| Slot | Budget (each language) |
|---|---|
| landing h1 | two lines at 1470 (646.7 px at 46/900), three at 390 |
| landing pitch | two lines at 1470 (611.2 px at 18), three at 390 |
| big button label | one line at 390 (294 px at 20/900; «Пройти демо-опрос» measures 206.3) |
| plate line | 46 logical at 3.9 logical (9.7) |
| team card title | two lines in 95.7 px at 13/400 (the default row of four at its narrowest beside the intro, 1207 px; 97.3 at 1470; J2) or in 154.7 px at 16/900 (the 2×2 option); no word wider (7.7, F8, finding G9) |
| an item of the fixed list (7.14) | one line at 1470 (730 px at 16/900), two lines at 320 (296 px); ru: one line at 1470, four items in two lines at 320 (G2) |
| question h2 | two lines at 390 (334 px at 20/900) |
| option label | two lines in the card (145 px at 15/900 at 390; 248 px at 17/900 at 1470) |
| «<enough…>» | two lines in 150 px at 14/900 below 760 (238.5 px at 16 in one line at 1470) |
| «<your answers> ▴» (the phone toggle) | one line in 128 px at 16/800 (the left column at 320; ru 118.7 [T]) (F2) |
| «<K of N>» of the phone bar | 42 px at 13/800, so that it stays on the pips' row at 320 (ru «3 из 5» 40.0 [T]) (F2) |
| test line, caption | as 7.3, 7.4 |

DESIGN-QA measures the longest word of each language in each slot (AP-089).

## 14. Criteria → description

REQ-111 and REQ-112 as they stand in the tree during their rework step 01c, after gate 02b (step 02b, FAIL); the
criterion numbers are those of step 01b, which 01c keeps (question I1).

| Criterion | Where met |
|---|---|
| REQ-111 c1 Pages (the set, the head lines, the places of the test-mode line and the AI disclosure; index.html holds «Sai — закрытое тестирование»; every href and src root-relative or an anchor) | 1, 5.1, 7.3, 7.19, 8; the closed-test text: the landing's eyebrow and `<title>` (8.1 A, 8.6, 13.1) (F3); the addresses: 5.1 item 5 and the links of 7.8, 7.15, 7.16, 7.18, 7.19, 8.1 – 8.3 (G4) |
| REQ-111 c2 Texts and the language rule (with «examples.html shows those three and those lists»; the heading and the ten items of «Чего Sai пока не делает») | 2, 7.2, 13; the two lists and the three example requests of `examples.html`: 8.3 E2, E3 (F4); the heading and the ten items: 13.1 and the fixed list of 7.14 (G2) |
| REQ-111 c3 The forbidden-words lint | 13.2 |
| REQ-111 c4 Themes and contrast («the pairs the look description lists») | 6.1, 6.3 (the list of pairs, each a pair of tokens of `tokens.css`, G6), 6.6 (which part inside the cream areas takes which pair, G1), 7.2, 11 |
| REQ-111 c5 Sai's intake (five single questions, 2 to 4 options) | 2, 7.10, 8.4 |
| REQ-111 c6, c7, c8, c11, c16 (engine copy, routes, parity, check chain, guard tests) | not look criteria; the result fields shown: 7.12, 7.14 |
| REQ-111 c9 The public set (no examples, no order texts, no kk) | 1, 7.2, 7.19, 13.2 |
| REQ-111 c10 No inline code; ARCH §11.7 | 4, 5 |
| REQ-111 c12 The landing in a browser (no horizontal scroll, no cut text, targets ≥ 44, contrast, examples.html with the three requests and the two lists, storage, demo flow, the result with «Чего Sai пока не делает» for every fixture and for five «Не знаю», failures, the public set) | 8, 8.3 E2 – E3 (F4), 6.3 and 6.6 (every text inside the cream areas, G1), 6.5 and 7.1, 7.2, 7.11 (targets, F2), 7.5, 7.10 – 7.15, 7.18, 11, 12, 13.3; the fixed list on every result and right under the no-match receipt: 7.12, 7.14, 8.4 state 4, and on production section 1 (G2) |
| REQ-111 c13 Browser step (parts in the order of this file) | 8, 7 |
| REQ-111 c14 Reader without context | 8.2 H3 |
| REQ-111 c15 Look and the owner | the whole file |
| REQ-112 c1, c2, c10 (files and port headers, port parity, guard tests) | not look criteria; 9.16 (the side view) |
| REQ-112 c3 Pure modules | 2, 9.16 |
| REQ-112 c4 The stage scene and the drawing (four desks, words, role titles, door, «Вы», fillRect and fillStyle only, no font or text on the canvas (J5), palette and constants) | 6.2: the palette `draw.js` gets — the 24 colour tokens `--sc-wall` … `--sc-dim`, the number `--sc-dim-alpha` and the page token `--ink`, nothing else (G3) — and the closed list of constants (F6); 9.1 – 9.8; 9.11 (the alpha rule from `--sc-dim-alpha` and its closed lists, F5, G3); 9.13. Step 01b's parenthesis «(`--btn`, `--onbtn`, `--ink`, `--acc2`)» named three page tokens the canvas never draws (6.2); step 01c's criterion names this palette (question I1) |
| REQ-112 c5 Motion only on taps | 9.13, 10 |
| REQ-112 c6 The scene on the pages (role img, text list, 320×568, figure ≥ 20 px, no cut or overlapping label, taps, reduced motion, canvas failure) | 7.4, 9.7 (labels at rest, F11), 9.8, 9.14 (the visible range and how «the canvas fits the width» is read, F7), 9.16 (the list beside the img, the text view, F12), 10, 12 |
| REQ-112 c7 Browser step | 8, 9, 10 |
| REQ-112 c8 Look and the owner | the whole file |
| REQ-112 c9 No agent event | 1, 2, 9.9, 9.10, 9.13 |
| PLAN M1 «Owner sees» (scene, how, order texts locally, demo, AI disclosure, test-mode line, RU/EN, theme) | 9, 8.1 – 8.4, 1, 7.3, 7.19, 7.2; on a phone the scene's framing is the sample's (9.14, question I10, section 17) |
| PLAN AC1.5, AC1.6, AC1.8, AC1.9; D28 | 8, 6.3, 12, 10; 4, 5; the whole file; 8.2 H3; 3, 4, 6 |
| Rescoped REQ-085, REQ-086, REQ-087, REQ-071 (scene part), REQ-028 (texts) | through REQ-111 and REQ-112 above |

## 15. The bar on the screen

- Q7: no secret, key or token on a page or in a label; the pages hold no address of a service.
- Q8: the public pages show no customer data; the demo answers stay in the page.
- Q10: a failed request shows a message and a retry (11); a failed canvas shows the text view (9.16).
- R2: nothing comes from agent events; the scene is an illustration with the caption and nothing in it moves by itself
  (decision 0083 item 7; REQ-112).
- R3: not applicable (decision 0033); no photos of people.

## 16. Open questions

The design questions of `result.issues` of `handoffs/M1SITE-20261119-01/step-03-gui-design-analyst.json` (I1–I9 there)
and of the rework step `step-03c-gui-design-analyst.json`, numbered here on their own; the default is what this file
describes.

- **I1** — This file follows REQ-111 and REQ-112 as they stand in the tree while their rework step 01c runs (gate 02b,
  step 02b, gave FAIL with N1–N8): REQ-111's list «Чего Sai пока не делает» (G2) and REQ-112 criterion 6 (F7) are
  aligned. REQ-112 criterion 4 as step 01b wrote it named the canvas's page tokens «(`--btn`, `--onbtn`, `--ink`,
  `--acc2`)», which the canvas of this file never draws (it keeps the sample's two accents as constants, F9; the
  sample's canvas reads `accent` and `accent2` of its palette, never `--btn` or `--onbtn`, 6.2); step 01c rewrites the
  criterion to this file's palette — the 24 colour tokens of 6.2, the page token `--ink`, and `--sc-dim-alpha` with the
  alpha rule of 9.11 (G3, gate 02b's N1). Its fact (9) quotes this file as it stood before this rework (sha256 2e3e2dbd…):
  two quoted sentences changed here (6.2 now names `--sc-dim-alpha` as the form; 9.1 names `--btn`, `--onbtn` and
  `--acc2`), and what they state still holds. The texts agree when 01c passes its gate. If a later rework of a block
  changes what this file relies on (storage, the intake format, the step table, what may move, REQ-112 criteria 4 and
  6, the fixed list), a rework step aligns this file.
- **I2** — Team cards (F8, finding G9): the sample's row of four (97.3 px of text at 1470) cannot hold «Руководитель»,
  «Проверяющий» or «Разработчик» at the title's 16/900. Default: the sample's row of four with the role title at 13/400
  in the place of the name (7.7: every word fits, the cards keep the sample's size and the 72×78 avatars, only the bold
  title line goes) — the smaller change to the approved mockup, which the owner wants matched one to one. Option: a 2×2
  grid of row cards with 48×52 avatars and the 16/900 title (7.7). Decision 0123 chooses; the chosen form is on the
  owner's list (section 17).
- **I3** — Storage: the task says nothing a visitor taps is stored; REQ-111 keeps two one-word preferences, `sai-lang` and
  `sai-theme` (its question О2, ARCH §17). This file follows REQ-111.
- **I4** — The theme button's name: the sample's «Свет» / «Light» reads «Light: Light» in English. Default «Тема» /
  «Тақырып» / «Theme».
- **I5** — The step table of 9.13 is this file's proposal (REQ-112 asks the look description to name it): the questions
  asked at desks 1, 2, 3, 3, 4 as in the sample, «Вы» at the door until the first answer.
- **I6** — REQ-112 criterion 4 lets the drawing call only `fillRect` and set only `fillStyle`, no font or text on the
  canvas (J5), so the sample's translucency (light layer, desk shadows, window beams, glow) is drawn with `rgba` fill
  styles from the closed lists of 6.2 and 9.11. The light bands overlap as in the sample, and the lists hold the
  products (F5). If the gate prefers `globalAlpha`, the criterion changes, not the look.
- **I7** — REQ-112 shows the scene on the landing, how and the demo only; the sample's not-found view had it. Default: 404
  and examples without the scene.
- **I8** — Vertical budget: the two required lines (test-mode strip, caption) and the 48-px phone toggle put the demo's
  «<enough…>» button 13.1 px below the fold at 1470×784 (26.1 px when a long speaker title pushes the question to two
  lines), 14.2 – 16.2 px of «Не знаю» under the 84.8-px phone bar at 390×844 with its label visible, and the landing's big
  button 66–83 px below the fold at 320×568 (8.1, 8.4) [T; C]. Default: accepted as measured; on the owner's list
  (section 17).
- **I9** — No icons on the answer cards: REQ-111's intake is format /2 (no objects), chosen because /3 needs named staff.
  If the owner wants the sample's pixel icons on the cards, the intake or the page needs an object per option.
- **I10** — The scene on a phone (F7): with the sample's framing the landing on a phone shows the door, «Вы» and desks 1 –
  2, and desks 3 – 4 come into view only after a tap on `how.html` or in the demo (9.14); PLAN M1 «Owner sees» names the
  scene with four desks «on phone and laptop». At s = 2 the four desks need 268 logical px (x 56 – 324) and a phone shows
  160 or 195, and at s = 1 the plates' text would be 3.9 px high, so no framing of the sample's look shows all four desks
  at once on a phone [C]. Default: the sample's framing (the four stage words stay readable in block B and the text list).
  Else, a choice for ORCH or the owner at G21: for example a stage on the landing that the visitor can scroll sideways on
  a phone (not in the sample). REQ-112 criterion 6 is read as «the stage fits the width» (9.14); its wording goes to ORCH.
- **I11** — The common focus ring (F1, the same kind of pair): `--acct` touches the own `--ink` frame of a framed control
  at s = 4 (outline-offset 4 px = the frame's 4 px), at 2.00:1 in light and 1.50:1 in dark, as in the sample
  (styles.css:22, 32); this file reads a ring against its background (ARCH §17; REQ-111 criterion 4), and only the ring
  of the controls on `--rc` is also chosen against the frame (6.3). If ORCH wants the frame pair for every ring, one ring
  colour `#ce6a1d` in both themes would give 3.17 / 3.39 / 3.56 / 3.56 and 3.59 against `--bg`, `--paper`, `--card`,
  `--rc` and the frame in light, and 4.78 / 4.17 / 3.39 / 3.56 and 3.07 in dark [C]. Default: the sample's ring.

## 17. Known differences from the sample (the owner's list, WF-04 step 6 and G21)

What the owner will see differ when he puts the page beside the approved sample — the parts of the sample that change,
and the new blocks and pages built from its parts (finding G8 of step 03d) — each with its reason and its place.
DESIGN-QA compares with this file, not with these items; ORCH shows the list with the snapshots (WF-04 step 6).

| # | Difference | Why | Where |
|---|---|---|---|
| D1 | Sai's own words: «Sai» on the door and in the header, role titles instead of staff names, the owner's stage words on the plates (two lines), «Sai — закрытое тестирование» as the landing's eyebrow | records: ARCH §11.6, §11.7; decision 0084 item 8; REQ-111 criterion 1 | 3, 7.2, 7.7, 8.1, 9.7 |
| D2 | two more lines on every page with the scene: the test-mode strip under the header and the caption under the scene; everything below is 61 – 71 px lower at 1470 and 390, 86 – 103 px at 320 | PLAN M1; ARCH §11.6; REQ-111 | 7.3, 7.4, 8, 8.4 (I8) |
| D3 | no price, effort, fit, request form, WhatsApp, print, «Мой запрос», operator board or demo switchers | ARCH §11.7; G8 «б»; «Без регистрации, заказов и данных» | 3, 4 |
| D4 | nothing in the scene moves by itself: no bubbles, couriers, props, wall clock, stamp, staff motion or bob of «Вы»; the staff stand still in their poses | REQ-112; decision 0083 item 7 | 9.6, 9.9, 9.10 |
| D5 | no pixel icons on the answer cards; a card is the shape of the sample's «Не знаю» card | the intake of format /2 has no objects (REQ-111) | 7.10 (I9) |
| D6 | the UI accent in light is `#ce6a1d` (buttons, pips, «Вы», the selected step), the current plate `#ce6a1d` in both themes; the canvas keeps the sample's `#e0731f` | ARCH §11.7: accents 3:1 | 6.1, 6.3, 9.7 |
| D7 | on the cream panels the focus ring is `#ce6a1d` (light) / `#9a4306` (dark), not `--acct`, and a link turns `--rcink` on hover, not `--ink` | ARCH §17 (F1, G1) | 6.3, 6.6, 7.20 |
| D8 | the team cards on the landing: the sample's row of four with the role title at 13/400 in place of the bold 16/900 name (default), or a 2×2 grid of row cards with 48×52 avatars (option); from 1001 to 1206 px the team stands under the intro (max-width 560), where the sample puts it beside the intro (J2) | the role titles do not fit the sample's card at 16/900 (F8, finding G9); in the sample's narrower team column at 1001 – 1206 px Sai's words would break inside a word (decision 0123 I2, J2) | 7.7, 8.1 A (I2) |
| D9 | the phone bar of the demo is 84.8 px high with a 48-px toggle; at 390×844 the bottom 14 – 16 px of «Не знаю» lie under it until a scroll; at 1470×784 the «<enough…>» button ends 13 px below the fold | REQ-111 criterion 12 (44×44 targets) and D2 (F2) | 7.11, 8.4 (I8) |
| D10 | on a phone the landing's scene shows the door, «Вы» and desks 1 – 2, as the sample's framing does; desks 3 – 4 come into view after a tap on «how it works» or in the demo | the sample's look at s = 2 (F7); against PLAN M1 «Owner sees … on phone» | 9.14 (I10) |
| D11 | the light of the desks switches at once on a tap; the sample eases it over about 1 s | REQ-112: no frames after a walk (F5) | 9.11 |
| D12 | the camera on a phone moves with the frames of the walk (at most 25 a second), with the sample's time and curve (the walk's own time when the walk is shorter, G5), not by a CSS transition | REQ-112 criterion 5 counts the frames of the scene (F9) | 9.14, 10 |
| D13 | the price pulse `tick` of the live strip is gone | the strip has no price; `--acct` on `--rc` is 1.74:1 in dark (F9) | 10 |
| D14 | the demo opens on question 1 with «Вы» at the door (the sample walks it to desk 1 after «Начать») | REQ-112: «Вы» at the door at the start, moving only on a tap | 9.13 |
| D15 | the avatars are drawn at an integer scale (24×26 logical) instead of the sample's stretched 24×23 | the integer pixel scale (ARCH §11.4) | 9.15 |
| D16 | the 404 page and `examples.html` have no scene; the theme labels read «Авто / Светлая / Тёмная»; kk is not offered on production; `examples.html` and the order texts are local only | REQ-112; decision 0084 item 15; G9; G8 «б» | 1, 7.2, 8.3, 8.5 |
| D17 | the landing has two new blocks under the hero — B, the four stages as links to «how it works», and D, what Sai builds and does not build (local only) — and its CTA row a ghost button «<how it works>» in place of «Продолжить» | PLAN M1 «Owner sees»; G8 «б» (finding G8) | 8.1 A, B, D |
| D18 | the meta line under the CTA row is the AI disclosure, not «Около 2 минут · без регистрации · цена сразу на экране» | ARCH §11.7; REQ-111 (finding G8) | 8.1 A; S17 |
| D19 | the footer: the AI disclosure in place of «Работает на платформе Sai», links to the pages in place of the demo switchers and «Оператор» | REQ-111; ARCH §11.7 (finding G8) | 7.19; S5 – S7 |
| D20 | the result's right panel is «Описать идею» (a title, a lead, the big button, a fine line; no field) in the place and look of the request form | «Без регистрации, заказов и данных»; G8 «б» (finding G8) | 7.15; S31 |
| D21 | two new pages built from sample parts: «how it works» (`how.html`: the step row of «Мой запрос» as buttons, info panels) and the examples (`examples.html`, local only: info panels and example cards in the receipt's look) | PLAN M1.4 (finding G8) | 8.2, 8.3, 7.8, 7.16, 7.17 |
| D22 | under the result's «<what it includes>» stand «<not a fit if>» and the fixed list «Чего Sai пока не делает» with ten items; on no match the receipt holds only the no-match text and that list follows it | REQ-111 (G2) | 7.12, 7.14, 8.4 |
| D23 | the phone bar of the demo (below 760) is sticky to the bottom of the question wrap, not fixed: it stands at the bottom of the window while the end of the wrap lies below it, then moves up with the page and rests 24 px above the footer; the page is 85 px longer; at 390×844 on questions 2 and 4 (6 of 15 states) it rests at 658.4 – 743.3 of 844 at the first scroll position with 76.7 px of the footer showing under it, where the sample's bar stands at 759.2 – 844; at 320×568 and 360×640 it is at the window's bottom as the sample's | a fixed bar lies over the footer links at the end of the page and they cannot be tapped (decisions/0124 О24, О26 (b)); if the owner reads it as «not like the mockup», the change is the fixed bar with a measured padding under the footer (О24) | 7.11, 12 (D9) |
| D24 | below 380 px «‹ Назад» is on the progress row (D25); at 320×568, at the first scroll position, it lies partly under the live strip by 6.7 – 36.6 px in 11 of the 15 states (five questions in ru, kk and en), and at 360×640, 379×640 and 380×640 it is free; a scroll or a Tab brings it above the strip (the Tab scrolled the page 19 – 35 px) | the speaker's own row (D25) moves it down to the row that the strip then covers at the first scroll position; the page may be scrolled, as section 12 allows for the bar (decisions/0124 О19, О26 (a)) | 7.9, 7.11, 12 |
| D25 | below 380 px (`max-width: 379px`) the speaker of the question (avatar, role title, stage word) takes its own full row above the question, «‹ Назад» moves to the progress row and the head is 31.2 px higher; at 320 the question's count goes under its pips; from 380 px, and at 390 px, the sample's phone, the speaker is beside the question as in the sample | the longest Russian title «Проверяющий» needs a speaker column of 190.4 px, which exists from 372 px; 380 keeps 8 px of slack (decisions/0124 О19, О32, О36; N1 of DESIGN-QA's first pass) | 7.9, 12 |
| D26 | each answer chip of the result keeps its visible text, the answer, and is named «<question>: <answer>» for a screen reader (no tooltip); nothing changes on the screen | five answers «Не знаю» would be five equal chips with no name of the question they open (decisions/0124 О33, О37; N2 of DESIGN-QA's first pass) | 7.13 |
