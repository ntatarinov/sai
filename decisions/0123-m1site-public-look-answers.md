# 0123 — Answers to the open questions of R1.2 and R1.3 (REQ-111, REQ-112, the public look): the analysts' defaults, ORCH's readings for the low findings of the last gates, the departures from PLAN and ARCH, and the order of the next steps

Status: **accepted** (ORCH's role, held since 2026-11-19 by the session that leads the program, decisions/0122 О1; the
owner can cancel each point; the points marked «G21» go on the owner's list of the look and he sees them on the page
itself before the look release).

## Question

Run M1SITE-20261119-01 (WF-01 with WF-04 step 1) wrote REQ-111 (R1.2, the public landing), REQ-112 (R1.3, the office
renderer in stage mode) and docs/design/V1-public-look.md (the look from the approved v3 sample). Both gates passed at
their third and last pass: step 02c (REQ-VALIDATOR) with the low findings V1–V6, step 03f (CODE-DESIGN-VALIDATOR) with
the low findings J1–J7. The authors left open questions, each with a default that stands in the text until ORCH
answers: О1–О18 (handoffs/M1SITE-20261119-01/step-01-req-analyst.json), О17 changed and О19–О21 (step 01b), О3 widened
and О22 (step 01c), I1–I11 of the look (its section 16) and Q2–Q4 (step 03e). Which answers bind the code design of task
M1.4, where do the low findings go, and in which order do the next steps run?

## Options

(a) The analysts' defaults, with ORCH's readings for the low findings where a gate offered one, and the look points the
owner judges with his own eyes at G21. (b) Ask the owner every question now — he asked for a result, not for questions
(the owner's words of 2026-11-19 in decisions/0122), and he cannot answer a design question he has not seen on the page.
(c) Other answers than the defaults — none of the gates asked for one.

## Decision

Answers to REQ-111 and REQ-112 (the defaults as the blocks state them, unless a point says otherwise):

- **О1 «Описать идею» in the test mode.** It opens the part «Как описать идею» of how.html: how to describe an idea in
  plain words, and the line that only invited participants describe ideas. It sends nothing, makes no request beyond
  the page's own files, stores nothing and puts no answer in the address. From M2 it leads to «Новый проект».
- **О2 Browser storage.** Only `sai-lang` (ARCH §17) and `sai-theme`, each one word; no answer is stored and no cookie is
  set. These two are preferences of the reader's own browser, not data Sai receives («Без регистрации, заказов и
  данных» holds: nothing reaches the server). The same answer closes the look's I3.
- **О3 The G8 «б» / G9 split (widened by step 01c to REQ-108 criterion 11's two literals).** The split lives in the
  production build: vercel-build writes the public set (no examples.html, no `order_` key, no kk value, no link or
  button to them; every other file byte-equal; idempotent, because the platform runs it twice per build, decisions/0122
  О5 (4); refused inside a git tree), and the function entry answers both demo routes only in ru and en; each gate is
  one constant in the source. REQ-109 criterion 8's sentence «the output then equals app/public byte for byte» and
  REQ-108 criterion 11's two literals are replaced for the open build by REQ-111 criterion 9; the micro-amendment run
  (point «Order» below) writes the new text before the build (AP-133).
- **О4 Docker and the local server** serve the local set as it is; Docker is no public host in V1 (G15's default). A
  public deployment from the image (M9) gets the split by its own requirement.
- **О5 The demo's rate limit** (ARCH §13, §14.3) is not built in R1.2: it needs rate_limits rows and SECRET_PEPPER,
  which contradicts «Без … данных» and «row counts unchanged». It comes with M2 (a Plan amendments row).
- **О6 Word lists** binding Sai's public texts: Г, Б, В, П, Ц and С, with the forms of REQ-086 written into REQ-111; not
  Т, Р or Ч (Р would hit «тестирование» of the page title).
- **О7 Intake format:** `sai-picker-tenant/2`. Format /3 needs four named staff, and invented names are not carried
  over (ARCH §11.7).
- **О8 AI disclosure on the public pages, exact (ru):** «Работу в Sai выполняют ИИ-агенты (искусственный интеллект). Их
  ответы могут быть неточными.» The kk and en forms are written by the author of the texts and read by the text
  readers (WF-02 step 8).
- **О9 demo-parity** is an int test, app/test/int/demo-parity.test.js, because «row counts unchanged» needs the database
  of the int level (a Plan amendments row; PLAN M1.4 listed it among the unit tests).
- **О10 Browser tests in CI:** the job e2e of app.yml comes with REQ-111 and drives the runner's Chrome with
  playwright-core (decisions/0118 О1), pinned by an Addition to decisions/0001 at the build (a Plan amendments row).
- **О11** REQ-111 is one piece of work (the plan's R1.2). The build goes in the sub-steps of the code design.
- **О12 Status lines of the rescoped blocks:** REQ-085, REQ-086, REQ-087 and REQ-028 become `cancelled   # <UTC>
  replaced by REQ-111 (R1.2)`; REQ-071 stays `pending` with a pointer to REQ-112 until its office part is replaced in
  M4 or M6 (decisions/0099). Written by DOC-UPDATER in the micro-amendment run (point «Order»), not by ORCH.
- **О13** Pure office modules: grid.js, sim.js, stage-scene.js and draw.js; view.js and labels.js are the page modules.
- **О14 Role titles at the desks** (tools/src/team/roles.js): «Принято» — «Руководитель проекта», «Готовим документацию»
  — «Аналитик», «Готовим спецификацию» — «Разработчик», «Готово к просмотру» — «Проверяющий».
- **О15 Nothing in the stage scene moves by time:** no idle motion, no bubble by time, no blinking. Frames are drawn
  only during a walk that a tap started, after a change of theme, language or size — and, ORCH's reading of V1 (and of
  the look's J4), after a tap that changes the drawn state with no walk (the fifth answer or «<enough…>» on question
  5, a result chip of question 5): exactly one frame; a tap to the state already drawn draws none. The code design gives
  REQ-112 criterion 5 this row with the mutant «no frame on a state change with no walk»; the micro-amendment writes it
  into the block.
- **О16 «Вы»** starts at the door; a tap on a step of «how it works» or an answer of the demo walks it to the desk that
  the look's step table names (9.13); with reduced motion it is placed there at once.
- **О17 The parity oracle** (as step 01b changed it): each port header names the original's path, the commit it was
  ported from and the sha256 of the original's bytes; port-parity.test.js imports the two originals, compares the
  hashes and drives both with the same calls; the commit is checked in a full clone.
- **О18** For app/ the rule of decision 0097 for REQ-066 criterion 3 and REQ-071 reads «no import and no served copy of
  the owner's office», not «no such word».
- **О19** Every demo result shows the list «Чего Sai пока не делает», the no-match result included, on production in ru
  and en.
- **О20** In R1.2 the public languages are one constant of the source (not the setting public_langs of ARCH §19.3); the
  build leaves kk out of the public set and the function entry answers only ru and en (a Plan amendments row). kk
  reaches production only by a release after the owner's answer to G9.
- **О21** One row of PROGRESS «Plan amendments» for each departure of REQ-111's paragraph «Departures from PLAN and ARCH»,
  plus the seventh of V6 (below); written with this record.
- **О22 The canvas palette** of REQ-112 criterion 4: option (a), the look's palette — the 24 colour tokens of its 6.2,
  the page token `--ink` and the strength as the number `--sc-dim-alpha`; fillRect and fillStyle only, no text on the
  canvas.

Answers to the look (docs/design/V1-public-look.md section 16 and step 03e):

- **I1** The look stands aligned with both blocks as they passed (gates 02c and 03f). Any later change of a block that the
  look relies on is followed by an edit of the look with its own check.
- **I2 Team cards — G21.** The default: the sample's row of four with the role title at 13/400 in the place of the bold
  name, avatars 72×78. ORCH's answer to J2: from 760 to 1206 px the row stands under the intro with max-width 560 (the
  look's 760–999 rule, extended to 1206), so no title breaks inside a word; beside the intro only from 1207 px. The
  2×2 option stays on the owner's list.
- **I4** The theme button's name: «Тема» / «Тақырып» / «Theme».
- **I5** The step table of 9.13 as proposed: questions 1–5 at desks 1, 2, 3, 3, 4; «Вы» at the door until the first
  answer; on how.html step n sends «Вы» to desk n.
- **I6** Translucency with rgba fill styles from the closed lists of 6.2 and 9.11 (as О22).
- **I7** 404.html and examples.html have neither the scene nor the caption.
- **I8 Vertical budget — G21.** Accepted as measured (the demo's «<enough…>» button about 13 px below the fold at
  1470×784; 14–16 px of «Не знаю» under the phone bar at 390×844; the landing's big button 66–83 px below the fold at
  320×568); on the owner's list.
- **I9** No pixel icons on the answer cards (format /2); on the owner's list.
- **I10 The scene on a phone — G21.** The sample's framing: on a phone the landing shows the door, «Вы» and desks 1–2;
  desks 3–4 come into view after a tap on how.html or in the demo; the four stage words stay readable in the text below
  the scene. REQ-112 criterion 6 is read as «the stage fits the width». On the owner's list with a phone snapshot; if
  he wants all four desks on a phone, that is a change of the look after G21.
- **I11** The sample's focus ring; only the ring of the controls on the cream panels is chosen against the frame (6.3).
- **Q2** The `--ink` pixel frame of a button inside a cream area stays decoration, as in the sample; the button's fill is
  its boundary.
- **Q4** A no-match result shows only the no-match text in the receipt (no «<fits>» label, no accuracy row), with the
  list «Чего Sai пока не делает» right under it.

The low findings of the last gates:

- **V1** — the reading of О15 above. **V2** — ORCH's reading of REQ-111 criterion 12's overflow rule: for every visible
  text node that is not only white space, the rule reads its nearest ancestor whose computed display is not inline,
  leaving out the `.sr` elements and their descendants (the gate measured that this catches the three cut boxes it
  planted and leaves the stage out). **V3** — REQ-112 criterion 6's «no two labels overlap» is read when «Вы» stands (at
  load and after each walk). **V4** — the code design names the neutral constant colour and the alpha used for a bad
  value, with what the test asserts. **V5** — REQ-112 fact (10) reads 7 green twins, not 6 (a number only). **V6** — the
  seventh departure: draw.js draws no plates and no text (ARCH §11.4 lists plates among what draw.js draws; after N1
  the plates, the door sign and «Вы» are DOM labels). V1–V5 are written into the blocks by the micro-amendment run.
- **J1, J6, V4** — named by the M1.4 code design (the phone step row and the length budget of its sub; the blocks of
  the result while it loads or fails and their order; the look of the noscript block; the length budget of the
  tagline on the door sign).
- **J2** — the answer of I2 above. **J4** — the reading of О15 above.
- **J3, J5, J7** — an edit of the look by GUI-DESIGN-ANALYST with its own check before DESIGN-QA: 6.4 gives both forms
  of the team title and names the 1.2 line height of 7.7; the three citations of REQ-112 criterion 4 follow its final
  text; the current plate keeps the sample's light 1-px edge in the dark theme (the approved mockup, one to one; 3.07:1
  against `#ce6a1d`); the camera condition reads «whenever W < 350».

Departures from PLAN and ARCH (rows of PROGRESS «Plan amendments» of this date): (1) ARCH §19.3 — the public languages
are a constant of the source (О20); (2) ARCH §3, §18 «Chromium in CI» — the job e2e drives the runner's Chrome with
playwright-core (О10); (3) ARCH §18, the paths list of app.yml — it also holds tools/src/picker/**,
tools/src/node-floor.js and the two originals of the owner's office; (4) PLAN M1.4 — demo-parity is an int test (О9);
(5) ARCH §13, §14.3 — the demo's rate limit is not built in R1.2 (О5); (6) ARCH §2.1 — the port header also names the
sha256 of the original (О17); (7) ARCH §11.4 — draw.js draws no plates and no text (V6).

**Order.** The texts that cite each other run one after the other, the requirement first (the lesson of this run: twice
two reworks of texts that cite each other ran at the same time and each aligned to the other's older version — step
01c issue I9, a candidate AP for DOC-UPDATER). (1) The M1.4 code design (WF-02 step 1, run M1CODE-20261119-01) starts
now: this record binds it where it differs from the blocks' text. (2) The micro-amendment run M1AMEND-20261119-01
(WF-01: REQ-ANALYST, REQ-VALIDATOR, then DOC-UPDATER) writes into the blocks only what this record and decisions/0122
О6 say — REQ-109 criteria 1 and 8 (the S1 forms, the public set), REQ-108 criterion 11's two literals, REQ-111
criterion 12 (V2), REQ-112's frame sentence, criteria 5 and 6 and fact (10) (V1, V3, V4, V5) — and DOC-UPDATER sets the
status lines of О12; it runs beside the code design only when a place is free and cites this record, never a
half-amended block. (3) The build waits for both gates. (4) The look edit of J3, J5, J7 runs before DESIGN-QA.

## Why

The analysts measured each default on the tree or on the sample, and three gates in a row checked them; the owner asked
for a result and judges the look on the page (G21), not in a document. The points the owner can see — the team cards,
the vertical budget, the scene on a phone, the cards without icons — keep the approved mockup where it can be kept and
go on his list with snapshots.

## Boundary

Only REQ-111, REQ-112, docs/design/V1-public-look.md, the code design of task M1.4 and the micro-amendment of REQ-108,
REQ-109, REQ-111 and REQ-112 named above. No requirement status changes by this record. G8, G9 and G21 stand as
PROGRESS.md «Owner gates» says.

## Basis

The handoffs of run M1SITE-20261119-01: step-01, step-01b and step-01c (REQ-ANALYST), step-02, step-02b and step-02c
(REQ-VALIDATOR; 02c PASS with V1–V6), step-03, step-03c and step-03e (GUI-DESIGN-ANALYST), step-03b, step-03d and
step-03f (CODE-DESIGN-VALIDATOR; 03f PASS with J1–J7). The owner's words: «Да, сайт по ссылке (Recommended)» with its
text («… потом главная с пиксельным офисом и демо-опросом … Без регистрации, заказов и данных …»),
docs/owner-requests/2026-10-27-public-launch-plan.md, the section of 2026-11-18 – 2026-11-19; G8, G9 and G21 in
PROGRESS.md «Owner gates».

## Addition 2026-11-19T20:44Z (ORCH, after the micro-amendment M1AMEND-20261119-01)

The micro-amendment passed its gate at the first pass (handoffs/M1AMEND-20261119-01/step-02-req-validator.json, PASS
with the low findings L1–L5), and DOC-UPDATER set the status lines of О12 (step 03). ORCH's readings and routes:

- **L1** REQ-112's frame sentence lists the cases in which a frame is drawn; the clause of О15 added by the amendment is a
  third case of that list (V1), not an exception to it.
- **L3** In REQ-112 criterion 6 the moment «when «Вы» stands (at load and after each walk)» binds only «no two labels
  overlap» (V3); «no label is cut» holds at every moment, as the look says.
- **L4** In REQ-108 criterion 11 «from the build of REQ-111 (R1.2) on» is read on the tree under check: the first lists
  bind a tree without app/public/office/grid.js, the extended lists a tree with it; a checker of a sub-step of the build
  reads the list of the state that sub-step leaves.
- **Author I3** The replacements of REQ-108 criterion 11's literals come from REQ-111 guard row (8) and criterion 11, as
  step 01c of M1SITE-20261119-01 (issue I5) named them; О3's «by REQ-111 criterion 9» is read so. **I4** The old forms
  stay for the tree before the build (REQ-108 and REQ-109 are released on d87b3d1 and wait for a RELEASE-VALIDATOR
  re-check). **I6** REQ-112's «What the visitor gets» is a summary; the frame sentence and criterion 5 bind.
- To DOC-UPDATER at the release step of M1CODE-20261119-01 (decisions/0079 item 5: corrections that change no
  criterion): L2 and author I5 — REQ-109's title, description and criterion 4 still name the one rewrite and its
  `source` of before spike S1; L5 and author I9 — REQ-111 names the run «REQ109AMEND», which is M1AMEND-20261119-01;
  author I8 — the Q12 lines of REQ-108 and REQ-109 gain decisions/0122 О5–О6 and this record; author I7 — the line
  numbers and literals of the guard rows of REQ-111 and REQ-112 read on f78d09f are read again on
  base/M1CODE-20261119-01-build (the design measures them there, decisions/0124 О13); the error-journal candidates of
  «Order» above, of decisions/0124 and of DOC-UPDATER's issue I6 (next free AP-164).
- DOC-UPDATER's issue I4 (twelve pending blocks name the cancelled REQ-086 or REQ-087 in depends_on) stays as the M0
  backlog run left the same shape on 2026-10-28: each of those blocks is rescoped or deferred by decisions/0099 and gets
  its depends_on when it is replaced.

