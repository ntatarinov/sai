# REQ-111, REQ-112 — code design: the public landing of Sai (R1.2) and the office renderer in stage mode (R1.3)

Run `M1CODE-20261119-01`, WF-02 step 1 (task M1.4 of the program PUBLIC-V1, milestone M1 «Public URL», releases R1.2
and R1.3), reworked at step 01c for the FAIL of gate pass 1
(`handoffs/M1CODE-20261119-01/step-01b-code-design-validator.json`, findings F1–F10) and at step 01e for the FAIL of
gate pass 2 (`handoffs/M1CODE-20261119-01/step-01d-code-design-validator.json`, findings G1–G7; section 1.2, F45–F51).
Base of the design steps: the tag
`base/M1CODE-20261119-01` (commit f8b8973). **Base of the build: the tag `base/M1CODE-20261119-01-build`** (commit
2144f2a, the merge of main d87b3d1 — the fix round of the app skeleton — into this tree; decisions/0124 О13): every
command of the blocks and of this design that names `base/<RUN-ID>` reads that tag for this run, and the replacement
table, the guard facts and the counts are measured there (sections 1.1 and 1.2, F34–F51). The blocks REQ-111 (16
criteria) and REQ-112 (10 criteria) are read by id from `docs/requirements.yaml`. **`decisions/0123` binds this design
wherever it differs from the blocks' text** (its О1–О22, the look points I1–I11, Q2, Q4, V1–V6 and J1–J7, and the
readings L1, L3 and L4 of its Addition of 2026-11-19T20:44Z; the micro-amendment run M1AMEND-20261119-01 wrote its
readings into the blocks, PASS at its gate step 02), and `decisions/0124` holds ORCH's answers to the
questions of this design (О1–О14, section 18). The measure of the look is
`docs/design/V1-public-look.md` (sha256 `3dea234002153ff0a70f1dda61bf8cb587f025a2debab01f9a58e6c1ef3f9347`, «the look»
below, cited as «look 9.11» and so on). The model of form is `docs/design/REQ-108-109-app-skeleton.md` («the skeleton
design»); `app/` at the build tag (2144f2a, the app of main d87b3d1) is what this design extends.

The owner's words that set the work, verbatim: «пуш, брат. Я хочу чтобы ты меня понял в корне и дал мне результат.
Исходя нашей переписки и в целом»; his answer «Да, сайт по ссылке (Recommended)» to the option «… собираю первый
выпуск сайта Sai по плану (страница «закрытое тестирование», потом главная с пиксельным офисом и демо-опросом) и
выкладываю на Vercel … Без регистрации, заказов и данных …»; and the approved mockup matched one to one, no blended
redesign (the look is that mockup's description; this design never changes a value the look names).

This file holds shapes, signatures, tables, closed lists and exact command lines. It holds no implementation code.
Every value is marked: **[M]** measured on the sketch of section 17 (with the fact number), **[R]** required by a
record (the block, a decision, ARCH, PLAN or the look), **[C]** computed from marked values (the formula is given),
**[P]** proposed here with its reason. A value of a table without its own mark takes the mark of its row's source
column; the facts F1–F51 are all [M]. The open questions for
ORCH are in section 18, each with a default: О1–О12 of step 01, answered by decisions/0124 before gate 1b (WF-02 step
1a); О13 and О14, ORCH's answers to finding F1 of gate pass 1 (decisions/0124, Addition); О15, new at step 01c.

---

## 0. Summary

- **What is built.** Five pages (`index`, `how`, `examples`, `demo`, `404`) in the look of the approved v3 sample, a
  texts module key → `{ru, kk, en}`, two style sheets of tokens and components and one for the page without script,
  four page modules, six office modules (two of them ports of the owner's office with a parity test), two demo routes
  on the byte copy of the picker engine over Sai's own intake, the forbidden-words lint, two new steps of the check
  (`vendored`, `content`), the public set of the production build, a browser-test level `app/test/e2e` with
  `playwright-core` 1.64.1 and a job `e2e` in `app.yml`. FRONTEND-DEV writes the pages, styles, page scripts, texts,
  office files and the intake; BACKEND-DEV the server, the vendored copy, the scripts, the package files, the Docker
  line and `app.yml`; TEST-DESIGNER every test file at step 5 (section 3, 12).
- **Nothing outside `app/` and `.github/workflows/app.yml` changes.** `tools/**` (the originals of the port, the picker,
  the team catalogue) is only read; `check.yml`, the root files and every earlier design stay byte for byte (F1, F31).
- **The production split is a rule of the build** (decisions/0123 О3, G8 «б», G9): the open build writes the public set
  in place — `examples.html` removed, the regions marked `<!-- sai:order -->` and `<!-- sai:kk -->` cut from every page,
  the texts module rewritten without the `order_` keys and without kk — and refuses inside a git working tree. A second
  run on its own output changes nothing (the platform runs the build twice, decisions/0122 О5 (4)). Measured on the
  sketch: two runs byte-equal, the refusal leaves the tree as it was, six filter mutants red (F17–F20). The tests
  also prove what the public set keeps: each page that differs is its source minus exactly the lines of its regions,
  the test-mode line, the AI disclosure and every address hold on the output, and no region holds a kept text or an id
  (PB-2, PB-6, PP-7, LD-9); a greedy cut and a region opened around the disclosure, which every check of what is left
  out lets through, are red (F41). The build reads the markers of every page as one sequence before its first write
  and cuts exactly the regions it read: a region left open before a later one, a nested, crossing or stray marker, a
  region never closed and a marker not alone on its line or in another form stop it with the file and the line, the
  upload folder as it was (gate finding G2; measured on ten planted shapes of the markers, F46).
- **The two gates are one constant each:** G9 is `PUBLIC_LANGS` in `app/public/shared/i18n/lang.js` (read by the build
  and by the function entry, so both answer the same languages), G8 is `ORDER_TEXTS_PUBLIC` in
  `app/scripts/public-set.js` (section 4.11).
- **The demo stores nothing.** `GET /api/demo/questionnaire` and `POST /api/demo/result` read the intake once at the
  start of the app, answer from the byte copy of `tools/src/picker/engine.js`, read and write no database, set no
  cookie and log no answer (measured through `createApp` and through the function entry: F13).
- **The port** keeps the code of the originals with one rename (`handoff` → `deliver`) and JSDoc types added for the
  strict `tsc` of `app/` (the raw ports give 68 `tsc` errors, F23); it adds one function to each file for the side
  view of the stage. Parity measured: 76 585 equal answers, 0 different; every port mutant kind of REQ-112 criterion 2
  (the BFS order, the wait of `after`, the tie of the two kinds, PAUSE, SPEED) is red, and one variant of the BFS
  order — the swap of the steps right and left — is equivalent on the original's layouts (F24, F25).
- **The CSP holds under a real Chrome** (F26): module scripts, `textContent`, single CSSOM property writes,
  `scrollLeft`, data attributes and the canvas raise no violation; `setAttribute("style", …)` and a style attribute
  through `innerHTML` raise `style-src-attr`. `style.cssText` does **not** raise one in Chrome 157 — the ban of
  criterion 10 is a rule of the code, not a CSP fact (issue for the look's 5.1 item 3, section 18 О11).
- **The build starts from the fix round of the app skeleton** (main d87b3d1, merged as 2144f2a, the tag
  `base/M1CODE-20261119-01-build`; decisions/0124 О13; F34–F36): unit 46 — its NPM-6 is the skip/todo/only grep, so
  this design's guard of the e2e folder is NPM-7 — and int 36; its IB-1 refuses every file that is not .js under
  `app/server`, `app/api` and `app/worker`, and the engine's declaration stands there by the one narrow row of
  decisions/0124 О14 (section 11 row 5; measured together with criterion 6: F37, F38); the closed branch of
  `vercel-build.js` (the bytes of the gate page, the second run) is the fix round's and is not changed.
- **Sizes.** 26 criteria; 15 new test files and 6 changed ones; 96 new named tests (71 unit, 10 int, 15 e2e) in the
  catalogue (section 10); 21 build sub-steps (F1–F7 with the four translation launches F1k, F1e, F2k, F2e, B1–B6,
  T1–T4); 93 mutants (12 applied on the sketch at the design tag; at step 01c 8 on the sketch at the build tag and 1 on
  a trial page; at step 01e 4 on the sketch at the build tag and 2 on trial pages); 15 open questions (О1–О14
  answered by decisions/0124, О15 new); 51 checked facts.

---

## 1. Checked facts

At the design tag (step 01). Measured on 2026-11-19 from 16:24Z to 16:49Z (clock `date -u`), macOS arm64, Node v22.23.4, npm 10.9.9, Google
Chrome 157.0.8103.79, git 2.54.0. «Clone» is `git clone -b base/M1CODE-20261119-01 <the project>
<outside the project>/m1code-02/clone`; «the sketch» is the set of files of section 17 written in that clone, never in
the project. Registry reads are `npm view`; GitHub is read with `gh` (read only: this step pushes nothing).

| # | Statement | Command / sketch | Result |
|---|---|---|---|
| F1 | The tag and the working tree hold the same commit; the tree was clean at the start | `git rev-parse base/M1CODE-20261119-01 HEAD`; `git status --short` | both f8b8973; status empty at 16:24Z (at 16:48Z `docs/program/public-v1/PROGRESS.md` showed one line changed by ORCH — its «Agents running» line; not this step's file) |
| F2 | `app/public` at the tag holds only `index.html`, `404.html`, `gate.html`; no `content/`, `vendored.json`, `server/vendor/`, `test/e2e/` | `ls` on the clone | holds |
| F3 | The app check at the tag | `cd app && npm ci && npm run check` on the clone | exit 0 in 61 s; unit «# tests 45», int «# tests 36», fail, skipped, todo 0 |
| F4 | The engine and the originals | `shasum -a 256`; `git log -1 --format='%H %cs' -- <file>` | `tools/src/picker/engine.js` a82637570dde86848ed440d7eee4fbdf4ed2f9b6de943c119b3d9579081ef1fe; `layout.js` f23b9fe29b24bf37df8781f995e9f4eb33e9e73de7836bd33d6d4d1dd9c58c5f at b5df4a808243a1f669ad3697374c265c720a7c31 (2026-10-06); `office-sim.js` 2b8f90c4b9210e27ce35e7a65780dbe7687892668ed045b58d3e03ffa9403842 at 7591fc064505dc030edf26df43889bcd52a852bf (2026-10-05) |
| F5 | The byte copy and `tsc` | the copy at `app/server/vendor/picker-engine.js` with a declaration file beside it; `npx tsc --noEmit -p jsconfig.json` three ways | `exclude` `["node_modules"]`: exit 2, 50 errors (44 TS7006, 5 TS2339, 1 TS7053); `exclude` `["node_modules", "server/vendor/picker-engine.js"]`: exit 0; `["node_modules", "server/vendor/**"]`: exit 0; the copy passes `prettier --check` and `eslint --max-warnings 0`; `check-public` on the folder → «REQ- before a digit» |
| F6 | The export names of the copy and of the declaration | import of the copy; a match of `export declare (const|function) <name>` in the declaration | both `ANSWER_REASONS, computeResult, resolveAnswers, visibleQuestions` |
| F7 | `picker check` on a sketch intake of format /2 (five single questions, `required` false, 2–4 options, six solutions, 32 rules, no `leads`, no `price_text`) | `cd app && node ../tools/src/picker/cli.js check content/sai-intake.json`; the same with the file twice | exit 0 «Файл арендатора sai-intake в порядке: вопросов 5, решений 6, правил 32.»; two arguments → exit 2 «picker: Лишний аргумент …» |
| F8 | Every combination of the sketch intake through the copy, in each language | `(4+1)(2+1)(4+1)(2+1)(3+1)` = 900 combinations × ru, kk, en with `tenantInLanguage` of `tools/src/picker/view.js` | 900 each, 0 without a result, 227 no-match, every one of the six solutions first in some (landing 152, calculator 146, catalog 125, single-page-app 104, card-site 74, dashboard 72); the empty answer set → no match |
| F9 | The seven sketch fixtures | `resolveAnswers` and `computeResult` per file | all resolve; each of the six solution fixtures makes its solution first; `server-needed` (an answer «on a server») → no match through six rules of −10 points |
| F10 | `null` and bad answers | `resolveAnswers(t, {goal: null})`, `{goal: "x"}`, `{zzz: "x"}` | `wrong_kind`, `unknown_option`, `unknown_question` |
| F11 | The lint of the lists (a sketch module under `app/scripts/`) | every one of the 118 forms of Г, Б, В, Ц, С × lower, upper and capital × the borders space, `.`, `,`, `(`/`)`, `-`, U+00A0 × two text shapes; every form in the other two languages | 0 missed; 0 found across languages except «минут», the one form of ru and kk (В); П finds «100%», «100 %», «100 %» (U+00A0), «100 %» (U+202F), «100 процентов», «100 percent»; none of the 17 twins of criterion 3 is found in any language; non-string → TypeError, unknown language and unknown list → RangeError; `""` → no finding; «₸» is found in any language |
| F12 | The lint over the texts fixed by records and over the sketch intake | the 29 fixed ru texts (test-mode line, AI disclosure, theme words, «Описать идею», the heading and ten items, the stage words, role titles, «Вы», caption, «Sai — закрытое тестирование», «Страница не найдена»); the 255 language texts of the sketch intake | no finding |
| F13 | The demo routes (a sketch of 4.7) through `createApp` with the languages ru, kk, en and through the function entry `createEntry` with ru, en | `GET …/questionnaire?lang=<l>` for ru, kk, en, de, RU, empty, 1 000 × «x», none; `POST …/result` with good and bad bodies; wrong methods; a missing intake | local ru/kk/en in their language, the rest ru; entry kk → ru; answer keys `lang, questions` → `id, title, options` → `id, label`; result keys `lang, clear_leader, recommended, no_match_text` → `id, name, summary, includes, not_suitable_when`; refusals `bad_json`, `bad_body` (twice), `bad_answers`, `unknown_question`, `unknown_option`, `wrong_kind`, 413 `body_too_large`; `GET …/result` and `POST …/questionnaire` → 404 `not_found`; a missing intake → 503 `demo_unavailable` on both, health still answers; `Cache-Control: no-store`, no `Set-Cookie`; log keys `ts, level, req_id, route, status, ms, code`, no answer value in any line |
| F14 | The function bundle traces the intake | `@vercel/nft` 1.10.0 (the version `@vercel/node` depends on, 2026-05-27) `nodeFileTrace(["api/index.js"])` on the sketch, where a server module reads `fs.readFileSync(new URL("../../content/sai-intake.json", import.meta.url))` | the trace holds `content/sai-intake.json` and `db/migrations/0001_init.sql` (the migrations were found the same way on production, decisions/0122 О5 (8)); no `includeFiles` is needed, VC-1 unchanged |
| F15 | The planned `app.yml` path list is enough | a copy of the clone with every path outside the list of 4.13 removed (`.git` kept): the content step, the vendored hash, imports of `text-rules.js`, `view.js`, `roles.js`, the parity driver, unit and int | content exit 0; hashes readable and equal; imports work; parity 0 different; unit and int as in the full sketch |
| F16 | `playwright-core` 1.64.1 | `npm view playwright-core@1.64.1 license time.1.64.1`; `npm install --before=2026-11-05T00:00:00Z --save-dev --save-exact` in the sketch `app/`; `node --test test/unit/npmrc.test.js` | Apache-2.0, published 2026-10-14T11:54:58Z, 13 MB, no dependency, no install script; the lockfile grows to 102 entries; NPM-1…NPM-5 and ENV-1 green (6 of 6; `ALLOWED_DEV` already lists it); its channel `chrome` opens `/opt/google/chrome/chrome` on Linux and `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS (read in `lib/coreBundle.js`) |
| F17 | The public set built twice in place | the sketch `runBuild` (4.11) on a copy of the sketch `app/public` outside any git tree, `outDir` = `publicDir`, twice | both exit 0 with migrate then check-public; the output after run 2 byte-equal to run 1; removed `examples.html`; differ exactly `index.html` and `shared/i18n/texts.js` (the sketch's only pages with regions); texts module of the output: `LANGS` `["ru","en"]`, 0 `order_` keys, 0 kk values; no file holds `examples.html`, an `order_` value or a kk value that differs from ru and en |
| F18 | The open build inside a git working tree | the same `runBuild` on the clone's `app/public` | exit 2 «vercel-build: refused: the open build writes the public set into the output folder and runs only in the uploaded copy, not in a git working tree», no step called, names and bytes unchanged |
| F19 | The closed branch run twice (a sketch of the fix round's behaviour) | `SITE_GATE=closed`, twice in place | 0 and 0, the second «the output is already the gate page», the folder holds only `index.html` |
| F20 | Filter mutants on the sketch | one at a time, the file restored from its saved text | one `order_` key left → 1 `order_` key; one kk value left → 6 kk values; `examples.html` left → an order value found in it; a region not cut → the build's own guard exit 1; a rewrite of the texts module on every run → **equivalent** (the rendering is a fixed point); the output naming its input's hash → run 2 differs; the git-tree refusal removed → exit 0, the clone's `app/public` rewritten in place (the mutant destroyed the sketch's source files; they were written again from a saved script) |
| F21 | An async `runBuild` against today's tests | the sketch's `vercel-build.js` (async) with today's `vercel-build.test.js` | VB-1, VB-3, VB-4 red; **VB-2 green although nothing was awaited** (`Promise !== 0` is true): VB-2 must await too (section 11, row 7) |
| F22 | Today's tests with the sketch files present (ports, texts, lang, demo route, CSS, regions) | `node --test` of unit and int on the clone | unit 42 of 45 (the three of F21), int 36 of 36; IB-1 green (the new files keep the import rules); NM-1 and NM-3 green (`/css/` still 404 with `app/public/css/` present); `check-public` clean on the sketch `app/public` |
| F23 | The raw ports and the strict `tsc` of `app/` | `layout.js` and `office-sim.js` copied with the header and the rename into `app/public/office/` | 68 errors (grid 44, sim 24: TS7006 implicit any, TS2322 `number \| undefined`, TS18047 possibly null); `eslint` and `check-public` clean |
| F24 | Port parity | a driver importing the originals and the ports: every constant, `deskSpot` and `officeSize` on 12 and 8 inputs, `buildLayout`, `cellKind`, `walkable`, `canStep` (six moves) on every cell and border cell of the layouts for 1, 4, 21, 22, 30 desks, `findPath` from every seat to every walkable cell, ten fixture scripts of `createSim` × 200 ticks of 0.05 s | 76 585 comparisons, 0 different, 1.9 s |
| F25 | Port mutants | the driver of F24 against each | BFS steps «down before right» 20 458 different; «up before down» 87; «left and down swapped» 5 310; the wait of `after` dropped 1; the two kinds swapped on a tie 1; PAUSE 0.7 → 8; SPEED 3.5 → 8; **«left before right» 0 different (equivalent on these layouts)** |
| F26 | A page under the app's CSP in headless Chrome 157 (`playwright-core`, channel chrome, `--use-mock-keychain`), served by the sketch `node server/node-main.js` | a module script that makes an element with `textContent`, writes `style.height` and `style.setProperty("--tx", …)`, `scrollLeft`, a `data-` attribute, fills a canvas, reads `--px`, `matchMedia`, writes `localStorage`, calls `history.replaceState`; probes `setAttribute("style", …)`, `style.cssText = …`, `innerHTML` with a `style=` attribute; the same page with JavaScript off | no violation and no console line for the first set; `setAttribute("style")` → `style-src-attr` and one console error, the style not applied; `innerHTML` with `style=` → `style-src-attr`; **`style.cssText` → no violation, applied**; `fillStyle = "rgba(58, 42, 24, 0.1094)"` reads back `rgba(58, 42, 24, 0.11)` (8-bit alpha), `#ffffffaa` → `rgba(255, 255, 255, 0.667)`; with JavaScript off the `<noscript>` style sheet loads (requests: the page, `site.css`, `noscript.css`) and `@media (scripting: none)` matches |
| F27 | Console lines and emulation under `playwright-core` | `/nope`, `/a/b/c.html`, `/x/y/` and `/` of a page without an icon link | one «Failed to load resource: the server responded with a status of 404 (Not Found)» per 404 load, its `location().url` the page itself (the line of decisions/0118 О2); a page without `<link rel="icon" href="data:,">` adds the same line for `/favicon.ico`; `reducedMotion: "reduce"` and `colorScheme` emulate |
| F28 | Browser time | launch, then 54 loads (3 windows × 2 themes × 3 languages × 3 paths) of the small sketch pages, a URL guard by `context.route` | launch 551 ms, 23 ms a load, 0 requests outside the local server |
| F29 | Widths in the sample's font stack (canvas `measureText`, Chrome 157 on macOS) | the tagline at 10/400 and the step sub at 13/400 | «команда ИИ-агентов» 105, «ИИ-команда для бизнеса» 127.7, «AI agent team» 66.8, «ЖИ-агенттер командасы» 126.5; «Идея и короткий опрос» 147.6, «Техническое задание по шагам» 199.6, «Вы проверяете и принимаете работу» 233.7, «Сіз жұмысты тексеріп, қабылдайсыз» 232.3 (a fact of macOS Chrome 157, AP-158) |
| F30 | The team catalogue | import of `tools/src/team/roles.js` | `name` of project_manager «Руководитель проекта», business_analyst «Аналитик», developer «Разработчик», reviewer «Проверяющий» (the `title`s of two differ: «Бизнес-аналитик», «Проверяющий (QA)»; the test reads `name`) |
| F31 | The runner's Chrome | `gh run view 44483031561` (check.yml, success on 0d8fa78) | the tools e2e step ran 7 tests, 7 passed on ubuntu-24.04 (the own kit found a Chrome); the log does not name the path, so whether `/opt/google/chrome/chrome` exists there is **not measured** (this step may not push a branch; section 18 О7) |
| F32 | Local uses of `vercel-build` | `grep -n vercel-build docs/runbooks/*.md app/README.md` | none: a local open build that now refuses inside the tree breaks no documented step |
| F33 | Who calls `createApp` without the demo | `grep -rn 'createApp(' app/test` | `test/fixtures/db.js` `appWith` (used by many int tests) calls it without the new field, so the field is optional (4.7) |

### 1.1 Measured again at the build tag (rework 01c)

Measured on 2026-11-19 from 19:45Z to 20:01Z (clock `date -u`), on the same machine with the same versions as above.
«Build clone» is `git clone -b base/M1CODE-20261119-01-build <the project> <outside the project>/m1c/clone`; «the
sketch» there is the sketch of section 17 carried onto it — every file of it but `app/scripts/vercel-build.js`, which
is the build tag's file with the open branch of 4.11 added — plus `app/vendored.json` as 4.8 writes it. The fix round
changed 8 files (F34). No file that F2, F4–F17, F20, F23–F31 and F33 read is among them, so those facts hold at the
build tag as measured above; F3, F18, F19, F21, F22 and F32 are replaced by F35–F40 and F44.

| # | Statement | Command / sketch | Result |
|---|---|---|---|
| F34 | The build tag and what the fix round changed | `git rev-parse base/M1CODE-20261119-01-build`; `git diff --stat base/M1CODE-20261119-01 base/M1CODE-20261119-01-build` | 2144f2a; 8 files: `app/README.md`, `app/scripts/vercel-build.js`, `app/test/unit/ci-workflow.test.js`, `import-boundaries.test.js`, `npmrc.test.js`, `runbooks.test.js`, `vercel-build.test.js`, `docs/runbooks/incident.md` |
| F35 | The app check at the build tag | `cd app && npm ci && npm run check` on the build clone; `grep -c '^test('` per file | exit 0 in 61 s; unit «# tests 46», int «# tests 36», fail, skipped, todo 0; unit: 46 named tests in 14 files (npmrc.test.js 7, with the fix round's NPM-6, the grep of the skip, todo and only selectors); int: 34 named tests, SC-2 a loop of two |
| F36 | The two bases of the diff (decisions/0124 О13) | on the build clone `git diff --stat base/M1CODE-20261119-01 -- app/test tools/test`, the same with `-- tools/src`, and `git diff --stat base/M1CODE-20261119-01-build -- app/test tools/test tools/src`; in the project `git diff --stat base/M1CODE-20261119-01-build -- app tools .github` and `git status --short -- app tools .github` at 20:00:50Z | the design tag lists the five test files of F34 (2 278 lines added) and no file of `tools/src`; the build tag lists nothing; the project equals the build tag in `app/`, `tools/` and `.github/` |
| F37 | The fix round's IB-1 and the engine's declaration (decisions/0124 О14) | `node --test test/unit/import-boundaries.test.js` on the sketch as the build tag holds the test; again with the row of section 11 row 5 (the trial `ib-row.py`), and with each of four mutants of the row | as it is: exit 1, 3 of 4, the one line «a file that is not .js: server/vendor/picker-engine.d.ts» (every other new file of the sketch keeps the rules); with the row: 4 of 4; each mutant of the row red in IB-2 at its own damaged copy — every `.d.ts` allowed (`server/vendor/extra.d.ts`), a twin that app/vendored.json does not list allowed (`server/lib/util.d.ts`), the row read before the link rule (the declaration as a link), the twin only listed, not in the tree; `RED.length` stays 161; lines with `assert.` 35 → 38 |
| F38 | Criterion 6 at the build tag | a second build clone with only the byte copy, its declaration, `app/vendored.json`, the `exclude` of 4.8 and one server file that imports the copy; `npx tsc --noEmit -p jsconfig.json` with and without the declaration; then `npm run check` with the row of F37 | with the declaration: exit 0; without it: exit 2, the 50 errors of the copy (as F5) and 3 in the importer; with the row: `npm run check` exit 0 in 60 s, unit 46, int 36 (prettier passes the copy and the declaration, eslint the copy, and ENV-1 reads the copy) |
| F39 | The async open branch against the fix round's tests | the sketch's `vercel-build.js` with the fix round's `vercel-build.test.js`, unit and int; then with replacement row 8 (the trial `vb-row8.py`) | unit 43 of 46: VB-1, VB-3, VB-4 red, **VB-2 green although nothing was awaited** (as F21); int 36 of 36; with row 8: VB 4 of 4, lines with `assert.` 37 → 38 — measured with the VB file alone: under NPM-6 on the same tree that sketch's comment «… is read only: it stands …» was hit; the row with its comment reworded, under NPM-6 and every other test of the tree, is F49 (gate finding G5) |
| F40 | The refusals tested on a copy inside a temporary git working tree (gate finding F8) | PB-4's form of section 10 as a sketch test and VB-4 of row 8: `git init -q` in a temporary root, a copy of `app/public` at `<root>/app/public`, the build in place; then the open refusal removed, then the closed refusal removed (each from a saved copy); a hash of every file of the sketch's own `app/public` before and after | both tests and VB-1…VB-3 green (5 of 5); each refusal removed → its test red (PB-4, VB-4), and the sketch's own `app/public` byte-equal before and after — at the design tag the same mutant rewrote it (F20); the same two tests under NPM-6 and the whole unit folder, with row 8's comment reworded: F49 |
| F41 | What the public set keeps (gate finding F2) | pages shaped as 4.3 — `index.html` with block D and the footer link in two `order` regions and the AI disclosure and the nav between them, `how.html` with the second H3 panel in an `order` region before `#describe-idea`, `demo.html`, `404.html`, `gate.html`, `examples.html` and a texts module — through the sketch's `writePublicSet` and the trial `ps-positive.mjs` (its own line oracle): the lazy cut of 4.11 as step 01c wrote it (the cut by the regions read of rework 01e gives the same bytes on these pages, F46), the greedy cut (M78, the gate's V01) and a region opened before `#ai-disclosure` (M79) | lazy: every check clean; greedy: every negative check green (no `order_` key, the languages ru and en, no `examples.html`, no marker, no banned value, a second run equal), the strict comparison of PB-2 red on `index.html` and `how.html`, PP-7 red (`#ai-disclosure` gone on both pages, and `/how.html#describe-idea` names no element); M79: the negative checks and the strict comparison green, PP-7 red (`#ai-disclosure`), the region rule of PB-6 red (`ai_disclosure`, `nav_landing`, `nav_how`, `nav_demo` inside an `order` region; an id inside a region) |
| F42 | A request that fails at once, the time limit, and a canvas redrawn after a change of theme (gate findings F4, F5) | Chrome 157.0.8103.79 through `playwright-core` 1.64.1 (channel chrome, `--use-mock-keychain`), HOME and TMPDIR under the scratch folder, a trial server with the app's CSP (`f4f5-trial.mjs`) | `route.abort("internetdisconnected")`: `fetch` rejects with `TypeError: Failed to fetch`, one console error «Failed to load resource: net::ERR_INTERNET_DISCONNECTED» at the request's address; `abort("failed")`: the same rejection, «net::ERR_FAILED»; a request held with `AbortSignal.timeout(400)`: `TimeoutError: signal timed out`, no console line; a 24 × 26 canvas filled with `--sc-chair`: `getImageData` reads 65,142,157,255 (`#418e9d`) in light, 60,75,106,255 (`#3c4b6a`) after `data-theme="dark"` and a redraw, the light value again after the switch back; with no redraw the dark read keeps the light value; a second `getImageData` of one canvas prints a console warning, and a read through a copy into a canvas made with `{ willReadFrequently: true }` prints none and gives the same values (F48, rework 01e; gate finding G4) |
| F43 | The Chrome step under GitHub's shell (gate finding F6) | a script of the one line of 4.13 with a stand-in program at the path, run by `bash --noprofile --norc -eo pipefail`; the same with the path missing; `gh run view 44483031561 --log` (read only) | present: exit 0, `ls -l` prints the path, then the version line; missing: exit 1 (macOS `ls`; GNU `ls` gives 2) and the version is not run; the log heads each step with its command line («##[group]Run npm ci») |
| F44 | Local uses of `vercel-build` (F32 again) and the counts the README names | `grep -n vercel-build docs/runbooks/*.md app/README.md`; `grep -n` of «The check» of `app/README.md`, on the build clone | none; «The check» names the counts as section 13 of the skeleton design with the tests added after it (VC-3, NPM-6, AE-5, HD-3, SC-5, SC-6) |

### 1.2 Measured at the build tag for rework 01e (gate pass 2, findings G1–G7)

Measured on 2026-11-19 from 21:00Z to 21:14Z (clock `date -u`), on the same machine with the same versions (Node
v22.23.4, npm 10.9.9, git 2.54.0, Google Chrome 157.0.8103.79 through `playwright-core` 1.64.1, channel chrome,
`--use-mock-keychain`, HOME and TMPDIR under the scratch folder). «Clone» is `git clone -b
base/M1CODE-20261119-01-build <the project> <outside the project>/m1e/clone` with the sketch of step 01c carried onto
it (its 32 files but the two test files of rows 5 and 8, which the trials apply to the build tag's files) and its
`scripts/public-set.js` rewritten by 4.11 of this rework (section 17). The trial pages of the browser facts are served
with the app's CSP.

| # | Statement | Command / sketch | Result |
|---|---|---|---|
| F45 | A text that a page script writes after a tap (gate finding G1) | `g147-trial.mjs`: a page whose module script writes, on a tap, into a result element and into a live region with the sample's `.sr` rule (styles.css:19); the lint of the sketch's `scripts/word-lists.js` over `document.body.innerText` and the values of `alt`, `title`, `aria-label`, at load and after the tap, in four variants; `checkText` of the build tag's `check-public.js` on such a script | at load no finding in every variant; after the tap none for the plain page, and the form found where the script wrote it — «бесплатно» (list Б) into the result, «бесплатно» into the live region only, «минут» (list В) into a failure message; the visually hidden live line is part of `innerText`; no console line; `checkText("js/pages/demo.js", <a script that writes «… Это бесплатно.»>)` → `[]` (the served-file rules hold the word ban and the phrases, not the lists) |
| F46 | The markers read as one sequence before any write (gate finding G2) | the clone's `public-set.js` by 4.11 (`readRegions`, `stripRegions` by the regions read, the two refusals of step (1), step (2) before the first write) against the cut of step 01c (`public-set-nopair.js`, M89) and the mutants `-m90` and `-m91`, each on a fresh copy of the pages of F41 outside any git tree with 13 planted shapes (`ps-pairing.mjs`); `ps-equal.mjs`; `ps-positive.mjs`; `runBuild` with injected steps on a planted copy (`vb-pairing.mjs`); eslint, prettier, `tsc` | well-formed pages: the same bytes as the cut of step 01c, a second run and the gates-open run byte-equal, the oracle of F41 clean and M79 red as F41. Each of the ten planted shapes of the markers — block D's end marker dropped («index.html: line 35: an opening marker while the order region of line 23 is open»), an opening marker before the footer's home link, one nested in block D, a stray end marker before block D («an end marker with no region of its kind open»), an opening marker after the last region («a region never closed»), block D's end marker sharing its line («a marker that is not alone on its line or not one of the four forms»), block D's and the how panel's markers written with no spaces, a kk region crossing block D, the how panel's end marker dropped — and the texts module with a third export or one that cannot be imported reject naming the file (and the line), the copy byte-equal; a link to `examples.html` outside a region rejects by the guard of the output, after the cut. `runBuild` → exit 1, «vercel-build: refused: index.html: line 35: an opening marker while the order region of line 23 is open», the copy byte-equal. The cut of step 01c (M89) refuses none of block D left open (the home link, `</main>` and `#ai-disclosure` cut), the opening marker before the home link (the home link cut), the nested one, block D's end marker sharing its line (as block D left open), the how panel left open (`#describe-idea`, `#ai-disclosure`, the home link cut) and the how panel's other form (its order text kept), and the stray, the never-closed and the crossing marker only after the first write. M90 refuses every marker plant only after the first write (the copy changed). M91 refuses not the how panel's other form (its order text kept). The rethrow of a failed import carries `cause` (eslint 10's `preserve-caught-error` is red without it); with it eslint 0, prettier clean, no `tsc` error in the file |
| F47 | The IB-1 row and the same file name in another folder (gate finding G3) | the build tag's `import-boundaries.test.js` on the clone with each of six forms of the row (`ib-row.py`): the row, the four mutants of F37 and the twin matched by its file name in any folder, each with and without the damaged copy `server/lib/picker-engine.d.ts` beside a plain `server/lib/picker-engine.js` under the list `[server/vendor/picker-engine.js]` | as built 3 of 4 (IB-1 «a file that is not .js: server/vendor/picker-engine.d.ts»); the row 4 of 4 with and without the copy; the four mutants of F37 red at their own copies either way; the file-name mutant 4 of 4 green without the copy and red with it («a file that is not .js: server/lib/picker-engine.d.ts»); lines with `assert.` 35 → 38 either way (the copy is one more row of the same list), `RED.length` 161 |
| F48 | Reading the pixels of a canvas twice (gate finding G4) | `g147-trial.mjs`: four 24 × 26 canvases filled with `--sc-chair` at load; three rounds of `getImageData` on each, in one context; three rounds through a copy in another — for each read a new canvas of the same size with `getContext("2d", { willReadFrequently: true })`, the avatar drawn into it by `drawImage`, `getImageData` of the copy | directly: four console warnings «Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true», each followed by the address of the HTML standard, one per canvas; through the copy: no console line; 65,142,157,255 in every read of both ways |
| F49 | NPM-6 on the tree of rows 5 and 8 (gate finding G5) | on the clone, step 01c's row 8 (`vb-row8.py`), then `node --test test/unit/npmrc.test.js test/unit/vercel-build.test.js`; the same with its comment reworded (`vb-row8-g5.py`); then row 5 with the copy of F47 (`ib-row.py none g3`) and the reworded row 8, both files through `prettier --write`, then `npm run test:unit`, `npm run test:int`, eslint and `prettier --check` on both | step 01c's row 8: 10 of 11, NPM-6 red with the one line `vercel-build.test.js:337: // The real app/ is read only: it stands in a git working tree …` (`only:` then a word that is not `false`); reworded («The build never runs on the real app/, which stands in a git working tree; it runs on a copy of …»): 11 of 11; with both rows: unit 47 of 47 (the build tag's 46 and the sketch's PB-4 form), int 36 of 36, eslint 0, prettier clean; lines with `assert.` 37 → 38 (VB) and 35 → 38 (IB) |
| F50 | The red tests after B3 (gate finding G6) | a fresh clone of the build tag (`<outside the project>/m1e/b3`) with B1's files (the copy, the declaration, `vendored.json`, `jsconfig.json`), B2's `Math.random` rule (refused in any folder) and B3's chain and `test:e2e` in `package.json` with the lockfile of `playwright-core`; `npm ci`; `npm run test:unit` | 43 of 46, red exactly CP-2 (its line `checkText("js/a.js", "Math.random()")`, line 62), IB-1 (the declaration) and NPM-3 (the chain) |
| F51 | Labels read on every frame of a walk (gate finding G7, decisions/0123 L3) | `g147-trial.mjs` at 390 × 844: a 320 px stage that clips a 700 px layer, a «Вы» label placed by `--you` and two plates; a tap walks `--you` from 24 to 260 at 72 px a second, at most one frame per 40 ms, `data-frames` counted; the test's own `requestAnimationFrame` loop reads every label's `scrollWidth` and `clientWidth` and the stage's `--you` until the place line names the target and `data-frames` has not changed for 300 ms; the same with a rule that narrows the «Вы» label only while it walks | plain: 220 samples, 67 distinct values of `--you` (every one of the 66 frames drawn, and the unset value before the walk), 0 samples with a cut label, none at load or after the walk; narrowed while walking: 199 of 224 samples with «Вы» cut, none at load or after the walk; no console line |

---

## 2. Choices that could be disputed

Each is a proposal for ORCH's record (section 18) or a reading of a record; the design is written with the default.

| # | Choice | Default | Why | О |
|---|---|---|---|---|
| C1 | The page without script | a third style sheet `app/public/css/noscript.css`, linked only inside `<noscript>` in the `<head>` of `index`, `how`, `demo` | the look's 9.16 names this mechanism; `@media (scripting: none)` in `site.css` also works (F26) and needs no file, but departs from the measure | О1 |
| C2 | `runBuild` becomes `async` (it imports the texts module of the upload) | as written; VB-1…VB-4 and any test the fix round adds await it | a synchronous parse of a JS module is fragile; the import with a content-hash query is exact and fresh in one process (F17) | О2 |
| C3 | List П (one hundred percent) | the sign `%` and the five words процент, процента, процентов, пайыз, percent in every language | the block lists П as one rule, not per language (like `₸`); stricter; the 118-form cross-language rule of criterion 3 concerns Г, Б, В, Ц, С only | О3 |
| C4 | The `order_` keys | the three example requests and the two lists **with their own headings, labels and the links to them** (a closed list of 45 keys, 4.1) | every text that exists only for the order parts must leave production; a heading outside `order_` would stay in the public texts module | О4 |
| C5 | The CSSOM writes | a closed list of custom properties written by `setProperty` on two elements, checked by a unit test (PP-6) | the look's 5.2 (d) asks for a closed list; a test makes it checkable | О5 |
| C6 | The ports and `tsc` | JSDoc types and casts in comments only, no expression changed; the parity test is the proof | the raw ports give 68 errors under the strict `tsc` (F23); excluding them would leave product code unchecked | О6 |
| C7 | The e2e job's Chrome | channel `chrome` (`/opt/google/chrome/chrome` on the runner); the first step of the job prints that path and the version (4.13, decisions/0124 О7) | the own kit found a Chrome on the runner (F31); the path is read from `playwright-core` (F16), not run there; the step's form is measured with a stand-in (F43) | О7 |
| C8 | The stage movement | the ported `findPath` on a one-row map added to `grid.js`, and a walker added to `sim.js` | «a function the port adds for the small map of the stage scene» (REQ-112); the original `createSim` walks there and back at 3.4 cells a second, which the stage cannot use | О8 |
| C9 | A stored theme other than Auto | applied when the deferred module script runs (as the sample, app.js:70); a moment of the system theme before it is a named limit | a blocking classic script would add a file the block does not list | О9 |
| C10 | `demo` in `createApp` | optional: absent → no demo rows in the route table (the paths answer the uniform 404); `node-main` and `createFunctionApp` always pass it | today's fixture calls `createApp` without it (F33) | — |
| C11 | The demo answer projection | the fields of 4.7 only, `lang` included | the look shows name, summary, includes, not-a-fit; `lang` tells the page which language the server answered (ru for kk on production) | — |
| C12 | A seventh fixture `server-needed.json` (no match) | as written | it shows the result «Sai cannot build it yet» from an answer, not only from five «Не знаю» | — |
| C13 | The page's time limit for the demo requests | 8 000 ms [P] | above a cold start of the function (seconds), short enough for the e2e of «never answers» | — |
| C14 | A helper file `app/test/fixtures/browser.js` | as written (no test in it) | the two e2e files share the launch, the URL guard and the recorders, as decisions/0118 О13 allowed the helpers | О10 |
| C15 | The intake loaded once at the start | `node-main` and `createFunctionApp` read it with `loadIntake()`; a missing or broken file is a 503 of the two routes and one stderr line in `node-main` | criterion 7 «at the start of the app» |
| C16 | `cssText` | banned by `check-public` (criterion 10) although the CSP does not refuse it (F26) | the criterion is a rule of the code; the look's sentence «the CSP refuses both» is a false fact | О11 |
| C17 | The engine's declaration under the fix round's IB-1 (gate finding F1) | beside the copy, `server/vendor/picker-engine.d.ts`, with the one narrow row of IB-1 (4.8, section 11 row 5) | a move to another folder with `rootDirs` leaves `tsc` at the 50 errors (gate 01b: the import pulls the copy back); the row lets exactly this file stand and keeps every other file that is not .js red, with its damaged copies (F37, F38) | О14 |

---

## 3. Files, roles, owners, order

New unless said. ★ = REQ-112. «F» = FRONTEND-DEV, «B» = BACKEND-DEV, «T» = TEST-DESIGNER (step 5). No file has two
writers; a shared file goes in the order of section 12.

```
app/
  public/
    index.html (changed)  how.html  examples.html  demo.html  404.html (changed)  gate.html (unchanged)        F
    css/tokens.css  css/site.css  css/noscript.css (C1)                                                          F
    js/dom.js  js/theme.js  js/pages/landing.js  js/pages/demo.js                                               F
    shared/text-rules.js  shared/i18n/texts.js  shared/i18n/lang.js                                              F
    office/grid.js★ sim.js★ (ports)  draw.js★  stage-scene.js★  view.js★  labels.js★                           F
  content/sai-intake.json  content/sai-intake.answers/<solution id>.json ×6, server-needed.json                  F
  server/routes/demo.js  server/routes/index.js (changed)  server/app.js (changed)  server/node-main.js (changed)
  server/http/errors.js (changed)                                                                                B
  server/vendor/picker-engine.js (byte copy)  server/vendor/picker-engine.d.ts                                   B
  vendored.json  scripts/vendored.js  scripts/word-lists.js  scripts/public-set.js                               B
  scripts/check-public.js (changed)  scripts/vercel-build.js (changed, on top of the fix round)                  B
  package.json  package-lock.json  jsconfig.json  Dockerfile  README.md   (changed)                              B
  test/unit/  public-pages texts forbidden-words theme-contrast intake vendored public-build
              port-parity★ office-pure★ office-stage★ office-view★  (.test.js, new)                              T
              npmrc check-public vercel-build ci-workflow import-boundaries  (.test.js, changed by section 11)   T
  test/int/   demo  demo-parity  (.test.js, new);  node-main.test.js (changed)                                   T
  test/e2e/   landing  stage★  (.test.js, new)                                                                    T
  test/fixtures/browser.js (C14)                                                                                  T
.github/workflows/app.yml (changed)                                                                               B
```

Not created: `app/public/img/` — the look needs no image file (the icon is `data:,`, the avatars and the scene are
drawn on canvases; look 5.1 item 4, 9.15) [R]. Not changed: `vercel.json`, `.vercelignore` (it keeps `content`),
`compose.yaml`, `.npmrc`, `eslint.config.js` (its `public/**/*.js` block already gives the browser globals),
`.prettierignore`, `.env.example` (no new variable), every file of `app/test` not named above, `tools/**`, `check.yml`.

Order of work: the shared contract first — `lang.js` and the shape of `texts.js` (F1), the JSON shapes of the demo API
(this design, 4.7) and the error codes (B4) — then the sides. The translations are written by the coding role one
language per launch (WF-02 step 8 item 6): F1 ru, F1k kk, F1e en; F2 ru, F2k kk, F2e en (section 12).

---

## 4. Interfaces

### 4.1 The texts module and the language module — `app/public/shared/i18n/`

**`lang.js`** (pure; imports nothing; F) [R REQ-111 criterion 2, decisions/0123 О20]:

| Export | Value or signature | Rule |
|---|---|---|
| `SOURCE_LANGS` | `Object.freeze(["ru", "kk", "en"])` | the languages of the local set; read by `texts.js`, `node-main` and the tests |
| `PUBLIC_LANGS` | `Object.freeze(["ru", "en"])` | **the G9 constant**: read by `scripts/public-set.js` (the build) and `server/app.js` (the function entry); changed only by a release after the owner's answer to G9 |
| `pickLang(query, stored, langs) → string` | `query` and `stored` are `string \| null`, `langs` the languages of the build | `query` when it is one of `langs` exactly; else `stored` when it is one of `langs` exactly; else `"ru"`. No fourth parameter, no header, no `document`, `window` or storage (`pickLang.length === 3`) |

**`texts.js`** (data only; imports `SOURCE_LANGS` from `./lang.js`; F; its kk and en values by F1k and F1e):
`export const LANGS = SOURCE_LANGS;` and `export const TEXTS = Object.freeze({ <key>: Object.freeze({ ru, kk, en }), … })`.
It exports exactly these two names (the build rewrites the file from them, 4.11; TX-1). A key matches
`^[a-z][a-z0-9_]*$`; every value is a non-empty string; the placeholders `{name}` (letters and `_`) are the same set in
the three values; the rules of 4.2 and the lint of 4.10 hold for every value in its language.

Keys with values fixed by a record — exact ru (and kk, en where a record fixes them) [R]:

| Key | ru | Source |
|---|---|---|
| `test_mode` | Sai работает в тестовом режиме: вход по приглашению, заказы не принимаются. | REQ-111; PLAN M1 |
| `ai_disclosure` | Работу в Sai выполняют ИИ-агенты (искусственный интеллект). Их ответы могут быть неточными. | REQ-111; 0123 О8 |
| `theme_auto`, `theme_light`, `theme_dark` | Авто, Светлая, Тёмная (kk Авто, Ашық, Қараңғы; en Auto, Light, Dark) | decisions/0084 §3 item 15 |
| `theme_name` | Тема (kk Тақырып, en Theme) | 0123 I4 |
| `describe_idea` | Описать идею | PLAN M1; REQ-111 |
| `nobuild_title` | Чего Sai пока не делает | REQ-111 |
| `nobuild_1` … `nobuild_10` | Серверы, API и базы данных; Вход по логину и паролю; Приём оплаты; Настоящая отправка писем и сообщений в мессенджеры; Связь с внешними системами учёта и CRM; Сбор данных с чужих сайтов; Расширения для браузера; Мобильные приложения; То, что требует секретных ключей или паролей; То, что нарушает правила использования ИИ | REQ-111 (the ten, in this order) |
| `closed_test` | Sai — закрытое тестирование | REQ-111 criterion 1; the landing's eyebrow and `<title>` (look 8.1, 8.6) |
| `stage_1` … `stage_4` | Принято; Готовим документацию; Готовим спецификацию; Готово к просмотру | decisions/0084 §3 item 8 |
| `role_1` … `role_4` | Руководитель проекта; Аналитик; Разработчик; Проверяющий | REQ-112; 0123 О14; `name` in `tools/src/team/roles.js` (F30) |
| `you` | Вы | ARCH §11.6 |
| `scene_caption` | Картинка показывает этапы работы, а не движения людей. | ARCH §11.6; decisions/0084 §3 item 13 |
| `notfound_title` | Страница не найдена | `app/public/404.html` today |
| `title_404` | Страница не найдена — Sai | `app/public/404.html` today (look 8.6) |
| `demo_unsure`, `demo_back`, `demo_retry` | Не знаю; Назад; Повторить | REQ-111 (its description and criterion 12) |

Keys whose wording FRONTEND-DEV writes, within the rules of 4.2 and 4.10, the readers' rounds and the look's budgets
(look 13.3; the slots «<…>» of the look) [P names, R slots]:

| Group | Keys | Look slot | Budget (each language) |
|---|---|---|---|
| shell | `skip_link`; `brand_name` («Sai»), `brand_tile` («S»); `lang_group`; `lang_ru` «RU», `lang_kk` «ҚАЗ», `lang_en` «EN» (the same in the three languages); `nav_landing`, `nav_how`, `nav_demo`; `to_landing`; `kk_note` | 7.1, 7.2, 7.19 | the look's |
| titles | `title_how`, `title_demo` («<page> — Sai») | 8.6 | one line of the tab |
| scene ★ | `scene_alt`; `door_tagline`; `you_at_door`; `you_at_desk` (`{n}`, `{stage}`); `desk_line` (`{n}`, `{stage}`, `{role}`); `live_answer` (`{option}`), `live_back` (`{i}`), `live_result` (`{kind}`), `live_desk` (`{n}`, `{stage}`) | 7.4, 7.21, 9.7, 9.16 | `door_tagline`: one line in 98 px at 10/400 (section 14) |
| landing | `landing_h1`, `landing_pitch`, `cta_demo`, `cta_how`, `stages_title`, `stage_1_sub` … `stage_4_sub` | 8.1 A, B; 7.8 | 13.3; a step sub one line in 245 px at 13/400 (section 14) |
| how | `how_eyebrow`, `how_h1`, `how_pitch`, `how_stage_1_text` … `how_stage_4_text`; the topic panels `how_what_title`/`_text` (what Sai is), `how_ai_title`/`_text` (what the AI agents can and cannot do), `idea_title`, `idea_text`, `idea_example`, `idea_invited` (how to describe an idea; 0123 О1), `how_interview_title`/`_text`, `how_spec_title`/`_text`, `how_fix_title`/`_text`, `how_approve_title`/`_text`, `how_start_title`/`_text` (only the owner starts the development in the test mode), `how_office_title`/`_text` (a private office of a project, real events only, never on this page), `how_result_title`/`_text` | 8.2 H1–H4 | 18 words a phrase |
| demo | `demo_loading`, `demo_failed`, `demo_offline`, `demo_what_now`, `demo_error`, `demo_question_of` (`{i}`, `{n}`), `demo_your_answers`, `demo_k_of_n` (`{k}`, `{n}`), `demo_start_hint`, `demo_enough`, `demo_not_sure`, `demo_close`, `demo_result_title`, `demo_result_sub`, `demo_receipt_head`, `demo_fits`, `demo_accuracy`, `demo_also_fits` (`{names}`), `demo_putting`, `demo_includes`, `demo_not_fit`, `idea_panel_title`, `idea_panel_lead`, `idea_panel_fine`, `demo_needs_js`, `demo_needs_js_text` | 7.9–7.15, 7.18, 8.4, 11 | 13.3 («<enough…>» two lines in 150 px; `demo_k_of_n` 42 px at 13/800) |
| 404 | `notfound_pitch` | 8.5 | two lines at 320 |

**The `order_` keys — a closed list of 45 (C4, О4)** [P names; R that they are the order texts of G8 «б»]: the landing
block D and the how panel `order_landing_title`, `order_examples_link`, `order_how_title`, `order_how_text`; the footer
link `order_nav_examples`; the examples page `order_title_examples`, `order_examples_h1`, `order_examples_pitch`,
`order_example_label`, `order_gets_label`, `order_not_label`; the list of what can be ordered `order_can_title`,
`order_can_1` … `order_can_6` (the six kinds of PLAN §2 «What agents build in V1», in its order: landing pages;
business-card and portfolio sites; small catalogues with built-in data; calculators, quizzes and forms whose result
stays on the screen or in the browser; simple dashboards with sample data; small single-page apps); the list of what
cannot be ordered yet `order_cannot_title`, `order_cannot_1` … `order_cannot_5` (servers and databases; sign-in and
payments; real e-mail and messenger sending; mobile apps; links to outside accounting or CRM systems — PLAN §2 «What
they do not build», in five plain items [P]); the three example requests, for N = 1, 2, 3:
`order_example_N_kind` (a solution name of the intake), `order_example_N_request` (the request in the visitor's
words), `order_example_N_gets_1` … `_3`, `order_example_N_not_1` … `_2` [P topics: a landing of a small shop, a
catalogue with search, a calculator whose result stays on the screen]. No other key starts with `order_`; none of
`nobuild_*` does (criterion 2). An `order_` value may equal a kept value (the build keeps such a value, criterion 9 (c)).

### 4.2 The text rules — `app/public/shared/text-rules.js` (F)

The functions of `tools/src/picker/text-rules.js` with the same names, parameters and answers — `forbiddenSign`,
`trimmedLength`, `phrasesOf`, `wordCount`, `wordsOf`, `hasSecondPerson`, `wordsProblem`, `textProblem` — and the
constants `MAX_WORDS = 18` and `SECOND_PERSON_WORDS` (ты, тебя, тебе, тобой, твой, твоя, твоё, твои) written in the
file (it imports nothing: `public/shared` imports only `public/shared`, ARCH §2.2). Its comments hold no `REQ-` before
a digit (check-public). Parity on a corpus of at least 200 texts built by the test (TX-6) [R REQ-111 criterion 2].

### 4.3 The pages — `app/public/*.html` (F)

Every page but `gate.html` (which stays byte for byte, look 1) has this head, in this order [R REQ-111 criterion 1;
look 5.1, 8.6]: `<!doctype html>`; `<html lang="ru">` **with no other attribute** (NM-1 reads the bytes
`<html lang="ru">`); `<meta charset="utf-8" />`; `<meta name="viewport" content="width=device-width, initial-scale=1" />`;
`<meta name="color-scheme" content="light dark" />`; `<meta name="robots" content="noindex" />`; one
`<title data-t="<key>">` with the Russian value; `<link rel="icon" href="data:," />` (no `/favicon.ico` request, F27);
`<link rel="stylesheet" href="/css/tokens.css" />`; `<link rel="stylesheet" href="/css/site.css" />`; on `index`, `how`,
`demo` also `<noscript><link rel="stylesheet" href="/css/noscript.css" /></noscript>`; `<script type="module"
src="/js/pages/demo.js"></script>` on `demo.html`, `src="/js/pages/landing.js"` on the other four. `<body
data-page="landing|how|examples|demo|notfound">`.

The body in the common order of the look's 8 (skip link, header, test-mode strip, stage, caption, `<main id="main">`,
footer) with these elements that scripts and tests rely on [P ids and attributes; R places]:

| Element | Markup | Who fills it |
|---|---|---|
| skip link | `<a class="skip" href="#main" data-t="skip_link">` | texts |
| brand | `<a class="brand" href="/">` with `<span class="tile" aria-hidden="true" data-t="brand_tile">` and `<span data-t="brand_name">` | texts |
| language group | `<div class="langs" role="group" aria-label="…" data-t-aria="lang_group">` with one `<button type="button" data-lang="<l>" lang="<l>">` per language: RU, then `<!-- sai:kk -->`, the ҚАЗ button, `<!-- /sai:kk -->`, then EN | `dom.js` (pressed state, change) |
| theme button | `<button type="button" class="theme" id="theme" aria-label="Тема: Авто">` with `<span class="theme-icon" aria-hidden="true"></span><span class="theme-label" id="theme-label">Авто</span>` | `theme.js` |
| test-mode strip | `<p class="testmode" id="test-mode"><span class="sq" aria-hidden="true"></span><span data-t="test_mode">…</span></p>` | texts |
| stage ★ (index, how, demo) | `<div class="stage" id="stage" role="img" aria-label="…" data-t-aria="scene_alt"><div class="stage-inner" id="stage-inner"><canvas id="stage-canvas" width="350" height="84"></canvas><div class="stage-labels" id="stage-labels" aria-hidden="true"></div></div></div>` | `view.js`, `labels.js` |
| text list ★ | `<div class="stage-text sr" id="stage-text"><ol id="stage-desks">` (visually hidden by `.sr` while the canvas draws; shown by `noscript.css` and by `.stage.text-view + .stage-text`) four `<li>` with the static ru lines «1 · Принято — Руководитель проекта» … `</ol><p id="stage-you">` the ru «at the door» line `</p></div>`, right after the stage | `labels.js` |
| caption ★ | `<p class="caption" id="scene-caption" data-t="scene_caption">` | texts |
| live region | `<div id="live" class="sr" role="status" aria-live="polite"></div>` | page scripts |
| footer | `<footer>`: `<p class="disclosure"><span class="sq2" aria-hidden="true"></span><span id="ai-disclosure" data-t="ai_disclosure">…</span></p>` and `<nav>` with the links `/`, `/how.html`, `/demo.html`, and `<!-- sai:order -->` the link `/examples.html` (`data-t="order_nav_examples"`) `<!-- /sai:order -->` | texts |

Rules of the markup: every visible text stands in an element with `data-t="<key>"` whose static content is the ru value
of the key; an accessible name stands in `data-t-aria="<key>"` with the ru value in `aria-label`; no `alt` and no
`title` attribute is needed (no image). The two «places» of criterion 1 are `#test-mode` and `#ai-disclosure`.
**Regions:** a marker stands alone on its line (prettier keeps it so, F17), is closed by its own end marker, regions
do not nest, and their kinds are exactly `order` and `kk` — the build reads the markers of every page as one sequence
before it writes anything and refuses any other shape with the file and the line (4.11 `readRegions`; gate finding
G2, F46); every `examples.html` reference of a page and every
`data-lang="kk"` element stands inside a region of its kind (PB-6). Region contents: `kk` — the ҚАЗ button of every
page; `order` — the footer link of every page, the landing block D (look 8.1 D) whole, the how panel «which products
can be ordered» (look 8.2 H3, its second panel) whole. A region holds nothing else (PB-6, gate finding F2): every
`data-t` and `data-t-aria` inside an `order` region names an `order_` key, and outside the regions none does (but on
`examples.html`, which the public set leaves out whole); a `kk` region holds exactly the one button `data-lang="kk"`;
no element inside a region has an `id`. So the test-mode line, the AI disclosure, the nav, the stage, the caption and
`#describe-idea` stand outside every region, and the cut of 4.11 can take none of them (F41).

Per page (the blocks and their look are the look's; this table names what each holds) [R look 8.1–8.5]:

| Page | `<main>` blocks (look) | Scene ★ | Regions |
|---|---|---|---|
| `index.html` | A hero (eyebrow `<p class="eyebrow" data-t="closed_test">Sai — закрытое тестирование</p>`, h1, pitch, CTA row: `/demo.html`, `/how.html`, the meta line = the AI disclosure, the team row of four with `<canvas data-avatar="n">` 24×26), B the four stages as links `/how.html#stage-1` … `#stage-4`, D (order) | start state | kk, order (footer, D) |
| `how.html` | H1 intro, H2 the step row as `<button type="button" data-step="n" aria-pressed="false">` and four `<section id="stage-n">`, H3 the topic panels (the second one in an order region; the idea panel carries `id="describe-idea"`), H4 CTA `/demo.html` | start state; a step tap walks «Вы» to desk n | kk, order (footer, H3 panel 2) |
| `examples.html` | E1 h1 and pitch, E2 the two lists, E3 the three example cards, E4 CTA `/demo.html` (every text an `order_` key but the shell's and `cta_demo`) | none (0123 I7) | kk, order (footer); the whole file is left out of the public set |
| `demo.html` | the question panel and its states, the live strip / phone bar, the result (look 8.4); `<noscript>` block «<the demo needs JavaScript>» (section 14) | the demo states of 9.13 | kk, order (footer) |
| `404.html` | h1 `notfound_title`, pitch, the big link `/` (`to_landing`) | none | kk, order (footer) |

### 4.4 The style sheets — `app/public/css/` (F)

- `tokens.css` [R look 6.1, 6.2, 9.1]: `:root { … }` with every page token of 6.1 and every scene token of 6.2 at
  their light values, `--sc-dim-alpha: .15`, the fonts of 6.4 and `--px: 2px`; `@media (min-width: 1000px) and
  (min-height: 640px) { :root { --px: 3px } }`; `@media (min-width: 1300px) and (min-height: 700px) { :root { --px:
  4px } }`; the dark values twice, with the same declarations: `@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }` («Авто» = no `data-theme`, look 6.1).
  Every colour as `#rrggbb` (lower case), `--shadow` as the look writes it. Read by the theme-contrast test (TC-2).
- `site.css` [R look 6.3–6.6, 7, 8, 9.7, 9.8, 10, 12]: the components and states of the look; the stage height and the
  labels placed by `calc()` from the custom properties of 4.6 (`--H`, `--rw`, `--dt`, `--wh`, `--cx1` … `--cx4`,
  `--you`) times `--px`; `.sr` the visually hidden rule (never `display: none`, AP-107); `.stage.text-view` (the class
  `view.js` sets when the canvas cannot draw) shows the text view of 9.16 and hides the canvas; the motions of the
  look's 10 with `prefers-reduced-motion` as it says; the landing's team row (look 7.7, the default row of four)
  stands under the intro with `max-width: 560px` from 760 to 1206 px and beside it only from 1207 px [R decisions/0123
  J2, which extends the look's 760–999 rule].
- `noscript.css` [R look 9.16, C1]: only the rules that hide `.stage` and show `#stage-text` as the text view (the same
  look as `.stage.text-view`) and show the demo's `<noscript>` block in the place of the question panel.

### 4.5 The page modules — `app/public/js/` (F)

Every module imports only `app/public/**` (IB, ARCH §2.2) and builds elements with `document.createElement` and texts
with `textContent` (4.10 lists what is refused).

**`dom.js`:** `el(tag, { cls?, id?, attrs?, text? }, children?) → HTMLElement` (an attribute name whose ASCII lower
case is `style` or begins with `on` is refused with an exception before anything is set on the element, so a computed
name never reaches `setAttribute`, where check-public, which reads literal forms only, would not see it; CP-3);
`fill(template, values) → string` (the `{name}` placeholders); `applyTexts(root, texts,
lang) → void` (every `[data-t]` → `textContent`, every `[data-t-aria]` → `aria-label`, `<html>.lang`);
`pref.read(key) → string | null` and `pref.write(key, value) → boolean` — the keys are exactly `"sai-lang"` and
`"sai-theme"`, the value one word `^[a-z]{2,5}$`, every storage access inside `try`/`catch` (a throwing storage gives
`null` and `false`, never an exception); `currentLang(langs) → string` = `pickLang(?lang=, pref.read("sai-lang"),
langs)`; `mountLangSwitch(doc, { langs, current, onChange })` — the `[data-lang]` buttons of `langs` get
`aria-pressed`, a click sets `?lang=` by `history.replaceState` (no reload), stores `sai-lang`, calls `onChange`. The
module touches `document`, `window`, `history` and `localStorage` only inside its functions, so it loads in Node
(CP-3).

**`theme.js`** — the pure part (loads in Node with no `document` or `window`; TC-1, TC-5) and the page part:
`CHOICES = ["auto", "light", "dark"]`; `readChoice(raw) → "auto" | "light" | "dark"` (exactly `"light"` or `"dark"`,
anything else `"auto"`); `themeFor(choice, systemDark) → "light" | "dark"`; `nextChoice(choice)` auto → light → dark →
auto; `mountTheme(doc, { texts, lang, onChange }) → { setLang(lang) }` — reads `sai-theme`, sets or removes
`data-theme` on `<html>` (an attribute, not a style), writes the label and `aria-label` «<Тема>: <position>», a click
(and Enter, Space — a native button) goes on and stores the choice, a `matchMedia("(prefers-color-scheme: dark)")`
change calls `onChange` while the choice is Auto.

**`pages/landing.js`** (index, how, examples, 404): `LANGS`, `TEXTS` from the texts module; `lang =
currentLang(LANGS)`; `applyTexts`; `mountLangSwitch`; `mountTheme`; on a page with `#stage`, `mountStage` (4.6) with the
words of the language and the page kind; on how, the step buttons call `stage.tap({ kind: "step", n })`, set
`aria-pressed` and say `live_desk`; the team cards' avatars by `drawAvatar` (4.6) on every `canvas[data-avatar]`, at
load and again after each change of the theme (the `onChange` of `mountTheme`, the same call that redraws the stage),
with the palette read once per change by `readPalette` from the computed tokens of the theme drawn, never per avatar
(LD-4; the chair of the person is `--sc-chair`, `#418e9d` in light and `#3c4b6a` in dark, look 6.2, so an avatar not
redrawn keeps the old theme's value, F42); when the language is kk, the footer gets the `kk_note` row.

**`pages/demo.js`** (demo): the same start; then the survey of look 8.4 and 11 — `GET
/api/demo/questionnaire?lang=<lang>` once per load, `POST /api/demo/result?lang=<lang>` with `{"answers": {…}}` when
the result opens (the fifth answer or «<enough…>»), each with `AbortSignal.timeout(DEMO_TIMEOUT_MS)`,
`DEMO_TIMEOUT_MS = 8000` [P, C13]; answers only in the page's memory (a «Не знаю» is a missing key, never `null`);
«Назад», the chips, the keyboard of look 12; the scene taps of the step table (4.6); the question panel's tail by
`panel.style.setProperty("--tx", "<n>px")` (4.10, PP-6); the receipt date `astanaDate(ms) → "dd.mm.yyyy"` (UTC+5, no
`Intl`) [R decision 0083 item 8]; the message blocks of look 7.18 for every failure of section 5 — a request whose
`fetch` rejects (a `TypeError`: no connection, the address unreachable, F42; or the `TimeoutError` of
`DEMO_TIMEOUT_MS`) shows `demo_offline`, an answer whose status is not 200 or whose body is not the questionnaire (or
the result) shows `demo_failed` (look §11; E1–E3).

### 4.6 The office renderer — `app/public/office/` ★ (F)

The pure modules — `grid.js`, `sim.js`, `stage-scene.js`, `draw.js` — import only each other, read no DOM, clock or
`Math.random`, and leave their inputs unchanged [R REQ-112 criterion 3; 0123 О13]. The page modules `view.js` and
`labels.js` hold every DOM and clock use.

**`grid.js` — the port of `tools/src/pixel-office/public/layout.js`.** Its first comment is exactly two lines:

```
// ported from tools/src/pixel-office/public/layout.js at b5df4a808243a1f669ad3697374c265c720a7c31
// sha256 f23b9fe29b24bf37df8781f995e9f4eb33e9e73de7836bd33d6d4d1dd9c58c5f; no import of tools/
```

then the original's code with every export kept under its name and value (`CELL`, `MAIN_COLUMNS`, `COLUMN_ROWS`,
`MAIN_PLACES`, `COLUMN_PITCH`, `ROW_PITCH`, `GAP_ROW`, `OFFICE_HEIGHT`, `ROOM_LEFT`, `RIGHT_WALL`, `ROOM_BOTTOM`,
`ROOM_MAP`, `DECOR`, `FIXED_CELLS`, `WALKABLE_KINDS`, `deskSpot`, `officeSize`, `buildLayout`, `cellKind`, `walkable`,
`canStep`, `findPath`); comments rewritten in plain words; JSDoc types and casts added for `tsc`, no expression changed
(C6). Added: `stageMap(width) → StageMap | null` — for an integer 1 ≤ width ≤ 2000 a frozen object of the layout's shape
(`min_x` 0, `max_x` width − 1, `width`, `height` 1, `desk_count` 0, `extra_columns` 0, `columns` 0, `desks` [],
`partitions` []) whose every cell is `floor`, registered in the module's table store so that `cellKind`, `walkable`,
`canStep` and `findPath` read it; else `null`. [R REQ-112 criterion 1; ARCH §2.1 with the hash of 0123 О17; P the added
function, C8]

**`sim.js` — the port of `office-sim.js`.** First comment:

```
// ported from tools/src/pixel-office/public/office-sim.js at 7591fc064505dc030edf26df43889bcd52a852bf
// sha256 2b8f90c4b9210e27ce35e7a65780dbe7687892668ed045b58d3e03ffa9403842; no import of tools/
```

then the original's code importing `canStep` and `findPath` from `./grid.js`, `SPEED` 3.4, `PAUSE` 0.6, `SPEEDS` [1, 2,
4] and `createSim` kept; the route kind `handoff` is `deliver` (the one rename; the comment of the tie says «a
delivery»), the deterministic BFS, the route queue and the `after` dependency as in the original. Added:
`createWalker({ map, x, speed = 72, frameMs = 160 }) → Walker` with `place(x)` (stand there, no walk), `walkTo(x) →
boolean` (true when a walk starts: a path by `findPath(map, [cur, 0], [x, 0])`; false when `x` is where the walker
stands or goes already, or unreachable), `tick(dtSeconds) → boolean` (moves `speed` cells a second along the path; true
while walking), `position() → { x: integer, walking: boolean, frame: 0 | 1 }` (the rounded cell; `frame` =
floor(walked ms / `frameMs`) mod 2 while walking, 0 standing). A `walkTo` during a walk starts from the cell where the
walker is (no jump) [P]. [R look 9.8: 72 logical px a second, step frames of 160 ms]

**`stage-scene.js`** (pure; imports `grid.js` and `sim.js` only for their types) [R look 9.1, 9.13, 9.14; REQ-112
criterion 4]:

| Export | Shape | Rule |
|---|---|---|
| `QUESTION_DESKS` | `Object.freeze([1, 2, 3, 3, 4])` | the step table's desks of questions 1–5 (0123 I5) |
| `geometry({ s, clientWidth, innerHeight, narrow }) → Geometry \| null` | `{ s, H, W, Rw, wallH, deskTop, lane, sp, cx: [4 integers] }` | the formulas of look 9.1: `H = max(innerHeight < 600 ? 84 : (s === 4 ? 88 : 92), min(150, round(innerHeight × (narrow ? .25 : .44) / s)))`, `W = floor(clientWidth / s)`, `Rw = max(W, 350)`, `wallH = round(.40·H)`, `deskTop = wallH + 20`, `lane = H − (deskTop + 14)`, `sp = (Rw − 62)/4`, `cx[i] = round(46 + sp·(i + .5))`; `null` when `s` is not 2, 3 or 4 or a size is not a positive integer |
| `stateFor(page, moment) → SceneState` | page `"landing" \| "how" \| "demo"`; moment `{kind:"load"}`, `{kind:"step", n}`, `{kind:"question", i}`, `{kind:"result"}` | `{ light: [L1..L4], now, attend, you: "door" \| n, focus: "start" \| n }` by the table of look 9.13 and the levels of 9.11 (start .75 ×4; a question or a step 1 at its desk, 0 elsewhere; the result 1 at desk 4, .25 elsewhere) |
| `youX(geom, you) → integer` | | 24 at the door, `cx[n] − 37` at desk n |
| `cameraOffset(geom, focus) → integer` | | 0 when `Rw ≤ W`; else `clamp(round(f − W/2), 0, Rw − W)` with f = 70 for `"start"`, `cx[n]` for a desk (halves up, look 9.14) |
| `cameraAt(from, to, elapsedMs, durationMs) → integer` | | the camera during a walk: `cubic-bezier(.3, .7, .2, 1)` over `durationMs` = min(700, the walk's own time) (look 9.14), rounded to an integer, `to` from the end on; at once (no easing) on the first frame, on a state change with no walk and with reduced motion |
| `buildScene({ words, state, geom }) → Scene` | `words = { stages: [4], roles: [4], you, doorName, doorTagline }` (strings only) | `{ desks: [{ n, cx, stage, role, light, now, attend }], youTarget, focus, words }`; every word of the scene comes from `words` (no texts import) |
| `sameDrawn(a, b) → boolean` | two `SceneState`s | equal light, `now`, `attend` and target: a tap to the drawn state draws no frame (0123 О15) |

**`draw.js`** (pure) [R look 6.2, 9.1–9.11, 9.15; REQ-112 criterion 4; 0123 О22, V4, V6]:

| Export | Shape | Rule |
|---|---|---|
| `PALETTE_TOKENS` | the 24 colour tokens of look 6.2 (`--sc-wall` … `--sc-dim`), `--ink`, `--sc-dim-alpha` | the palette and nothing else |
| `CONSTANTS` | the closed list of look 6.2 «Scene constants» | the only other `fillStyle` values |
| `NEUTRAL_COLOUR`, `NEUTRAL_STRENGTH` | `"#808080"`, `0` | V4 (section 14) |
| `readPalette(get, theme) → Palette` | `get(name) → string` (the computed value of a token), theme `"light" \| "dark"` | a colour that is not `#rrggbb` (either case, normalised to lower) → `NEUTRAL_COLOUR`; a strength that is not a decimal number 0 ≤ x ≤ 1 → `NEUTRAL_STRENGTH`; never throws |
| `lightAlpha(strength, keep) → string` | `strength` ≤ 2 decimals, `keep` a product of the band factors of look 9.11 | exact decimal arithmetic (integers scaled by powers of ten, BigInt), rounded half up to 4 decimals, written without trailing zeros: `.15 × .729` → `0.1094` (never the float `0.1093`) |
| `lightRects(geom, light) → Array<{ x, y, w, h, keep }>` | | the light layer as rectangles in rows of 2 whose set of covering bands is constant (look 9.11); `keep` 1 where no band lies |
| `drawScene(ctx, scene, palette, geom, you, scale = 1) → number` | `you = { x, frame, walking }` | the parts in the order of look 9.2, at an integer `scale` ≥ 1 on the canvas bitmap of `Rw × H`; every call `ctx.fillRect(x, y, w, h)` with integers after `ctx.fillStyle = <a palette colour, a constant, or the light layer's rgba of --sc-dim with lightAlpha>`; no other property or method of `ctx`; no text; at most 4 000 calls (look 9.1); returns the number of calls |
| `drawAvatar(ctx, desk, palette, scale) → void` | desk 1–4 | the person of look 9.6 in the pose `attend`, frame 1, 24 × 26 logical (look 9.15) |

**`labels.js`** (page module): `createLabels({ layer, list, youLine, live, doc }) → { render(scene, geom), moveYou(x),
say(text) }` — makes the door sign, the «Вы» label and the four plates (in this DOM order, look 9.7) with `textContent`
(a plate holds one child element per line: line 1 `«<n> · <first word>»`, line 2 the rest of the stage word, look
9.7); writes the text list (`#stage-desks` four `desk_line` items, `#stage-you` `you_at_door` or `you_at_desk`); places
every label only through the custom properties of the stage element (below); `say` writes the live region.

**`view.js`** (page module): `createStageView(deps) → StageView` and `mountStage(doc, { words, page }) → StageView`
(the second wires the real browser into the first). `deps = { canvas, stage, labels, words, page, now(), raf(fn) → id,
caf(id), matchMedia(query) → MediaQueryList-like, hidden() → boolean, onVisibility(fn), onResize(fn), token(name) →
string, px() → integer, viewport() → { clientWidth, innerHeight }, theme() → "light" | "dark" }`. `StageView = {
tap(moment) → void, setWords(words) → void, refresh(reason) → void }`. Its rules [R look 10; REQ-112 criterion 5;
0123 О15]:

- the first frame at once, in the page's load state (it waits for visibility when the page loads hidden); then a
  frame only (a) during a walk that a tap started, at most one per 40 ms of `now()` (so at most 25 a second), the last
  with «Вы» at the target and the camera at its offset; (b) once after a tap that changes the drawn state with no walk;
  (c) once after a change of the theme, the language or the size — on a size change the geometry is computed again
  and «Вы» is placed at the target of the drawn state at once (no walk); (d) never after a tap to the state already
  drawn (`sameDrawn`), never while `hidden()`; on visibility back, a walk goes on from where it stood (its time step is
  `min(now − last, 100)` ms) [P];
- the walker of the scene is `createWalker({ map: stageMap(geom.Rw), x: youX(geom, "door") })` of the port; a tap
  calls `walkTo(youX(geom, state.you))`;
- `prefers-reduced-motion: reduce` (read by `matchMedia`, followed on change): a tap places «Вы» at the target in one
  frame, the camera at once;
- the palette by `readPalette(token, theme())` once per theme change, never per frame; `s` by `px()`;
- `getContext("2d")` null, or an exception of `drawScene` → `stage` gets the class `text-view`, the frame loop stops,
  the text list stays (no exception leaves `view.js`);
- the closed list of CSSOM writes of the stage (C5, PP-6): `stage.style.setProperty(name, value)` for `name` in
  `--H`, `--rw`, `--dt`, `--wh`, `--cx1`, `--cx2`, `--cx3`, `--cx4` (on a geometry change) and `--you` (per frame of a
  walk); the canvas `width` and `height` attributes; `stage.scrollLeft` for the camera (look 5.2 (b), (c));
- the hooks (REQ-112 criteria 6 and 7): the stage element's `data-frames` (frames drawn since the load, an integer) and
  `data-figure` (the figure's CSS height, 22 · s) — attributes, read by the e2e test and by UAT-RUNNER.

The words passed to the scene: `stages` = `stage_1` … `stage_4`, `roles` = `role_1` … `role_4`, `you`, `doorName` =
`brand_name`, `doorTagline` = `door_tagline`, in the page's language.

### 4.7 The demo routes — `app/server/` (B)

**`routes/demo.js`** [R REQ-111 criteria 7, 8; ARCH §13; decisions/0123 О5, О20]:

| Export | Signature | Rule |
|---|---|---|
| `INTAKE_FILE` | `new URL("../../content/sai-intake.json", import.meta.url)` | the literal form the function's tracer follows (F14) |
| `loadIntake(file = INTAKE_FILE) → { ok: true, tenant } \| { ok: false }` | | read, parse; ok only for an object with `schema` `sai-picker-tenant/2`, `id` `sai-intake`, five questions each `type` `single` with an `options` array, arrays `solutions` and `rules`, an object `result`; never throws |
| `inLanguage(tenant, lang) → tenant` | | a new copy in which every object with exactly the keys `ru`, `kk`, `en` is its value in `lang`; the input unchanged — the rule of `tools/src/picker/view.js` `tenantInLanguage`, written again here because the server imports nothing of `tools/` (DP-1 proves the equality) |
| `demoRoutes({ intake, langs }) → Route[]` | `langs` a frozen list | two rows of the route table: `GET /api/demo/questionnaire` and `POST /api/demo/result`, `meta { tenant: false }`; their handlers take `{ query: URLSearchParams, body: Uint8Array }` and return `{ status, body }` or throw `HttpError` |

The handlers:

1. `intake.ok` false → `HttpError("demo_unavailable")` (503).
2. `lang = pickLang(query.get("lang"), null, langs)` (`public/shared/i18n/lang.js`; no header is read).
3. Questionnaire: `{ "lang": lang, "questions": [ { "id", "title", "options": [ { "id", "label" } ] } ] }` — built field
   by field from `inLanguage(intake, lang)`, nothing else (no `help`,
   rule, point, condition or solution text; a field planted into the intake does not reach the answer).
4. Result: the body decoded as strict UTF-8 and parsed as JSON — else `bad_json`; it must be an object with exactly one
   key `answers` — else `bad_body`; `answers` an object — else `bad_answers`; `computeResult(inLanguage(intake, lang), answers)`
   of the byte copy inside `try` (an exception → `demo_unavailable`); a refusal → `HttpError(<reason>)` for
   `unknown_question`, `unknown_option`, `wrong_kind`, and `bad_answers` for any other reason (none can come from five
   single questions with `required` false: `missing_required`, `duplicate_option`, `empty_list`, `not_integer` and
   `out_of_range` cannot happen, and `not_object` is caught before); the answer `{ "lang", "clear_leader", "recommended": [ { "id", "name", "summary",
   "includes", "not_suitable_when" } ], "no_match_text" }` — never `ranking`, `score`, `rules`, `points`, `price_text`,
   `duration_text`, `needs_from_you`, `next_steps`, `hypotheses` (C11).
5. No database, no cookie, no log of the body: the log line is the one of the app's middleware (REQ-108 criterion 10),
   its `code` the error code only.

**`http/errors.js`** gains the codes (body `{"error":"<code>"}`): `bad_json` 400, `bad_body` 400, `bad_answers` 400,
`unknown_question` 400, `unknown_option` 400, `wrong_kind` 400, `demo_unavailable` 503 [P names; R «stable codes the
design names»].

**`routes/index.js`**: `routeTable(deps)` returns, frozen, the demo rows first when `deps.demo` is given (C10), then the
health row; the rows' `meta` stay `{ tenant: false }`.

**`app.js`**: `AppDeps` gains `demo?: { intake, langs }`; the route loop passes `{ query: new
URL(c.req.url).searchParams, body: c.get("body") }` to the handler, answers its `{status, body}` as JSON, and turns an
`HttpError` thrown by a handler into its status with `errorBody(code)` and `tag.code = code` (as the body middleware
does); any other exception goes to `onError` (500). The order of the middlewares (gate, body limit, preview host,
routes, fallback) is unchanged, so the gate answers first and a body over 65 536 bytes is a 413. Other methods on the
demo paths fall through to the uniform 404. `createFunctionApp(config, inject)` passes `demo: { intake: inject.intake
?? loadIntake(), langs: PUBLIC_LANGS }` — **the function answers only the public languages** (criterion 9 (g)).

**`node-main.js`**: `demo: { intake: loadIntake(), langs: SOURCE_LANGS }`; when `intake.ok` is false one stderr line
`sai: the demo intake is missing or broken; /api/demo answers 503` and the server starts (C15).

### 4.8 The byte copy of the engine (B)

- `app/server/vendor/picker-engine.js` — the bytes of `tools/src/picker/engine.js` (sha256 a8263…81fe, F4); imported
  only by `server/routes/demo.js`; never under `app/public` (its `REQ-` comments, F5).
- `app/server/vendor/picker-engine.d.ts` — the declarations of the four exports (`ANSWER_REASONS`, `visibleQuestions`,
  `resolveAnswers`, `computeResult`) with the shapes of the engine's answers; prettier-formatted. It is the one file
  that is not .js under `app/server`, `app/api` and `app/worker` that the fix round's IB-1 lets stand, by the narrow
  row of decisions/0124 О14 (section 11 row 5): a `.d.ts` that is no link, whose `.js` twin beside it (the same path
  with `.d.ts` replaced by `.js`) is a plain file of the tree and the `file` of an entry of `app/vendored.json`; every
  other file that is not .js there stays red (F37). No file imports the declaration — IB refuses a server import that
  is not a plain relative path of a `.js` file — so Node never loads it; `tsc` reads it for the import of the copy by
  the rule of the sibling declaration (F38). The place is the measured one: under `app/types` with `rootDirs` the import
  pulls the copy back and `tsc` gives the 50 errors (gate 01b; C17).
- `app/jsconfig.json` — `exclude` `["node_modules", "server/vendor/picker-engine.js"]` (only the copy: a second file
  of the folder would be checked, F5) [R REQ-111 criterion 6].
- `app/vendored.json` — `{ "entries": [ { "file": "server/vendor/picker-engine.js", "source":
  "tools/src/picker/engine.js", "sha256": "a82637570dde86848ed440d7eee4fbdf4ed2f9b6de943c119b3d9579081ef1fe" } ] }`
  (`file` from `app/`, `source` from the repository root).
- `app/scripts/vendored.js` — exports `checkVendored({ appDir, rootDir }) → string[]` (findings) and runs as the step
  `vendored`: for each entry the sha256 of the copy, of the source and the record are equal; `server/vendor/` holds no
  `.js` file outside the entries; a missing file or an unreadable `vendored.json` is a finding. Output: one line
  `vendored: <file>: <rule>` per finding and exit 1, or `vendored: 1 file matches its source` and exit 0.

### 4.9 The intake — `app/content/` (F)

`sai-intake.json` of format `sai-picker-tenant/2` [R REQ-111 criterion 5; 0123 О7]: `id` `sai-intake`; exactly five
questions, each `single`, no `show_if`, `required` false, 2–4 options; the six solutions with the ids, in this order,
`landing`, `card-site`, `catalog`, `calculator`, `dashboard`, `single-page-app` — the closed list of the test, one per
kind of PLAN §2 «What agents build in V1» [P ids]; each solution at least one `not_suitable_when` text; no
`price_text`, no `duration_text`, no `leads`, no `hypotheses`; `result` with `top` 3, `min_score` ≥ 1, `clear_lead_gap`
2 and a `no_match_text` that says Sai cannot build it yet; every rule one to three conditions on answers (so five «Не
знаю» give no match, F8). The sketch's draft (F7–F9) is a working proposal of the questions [P]: what the page should
do (4 options), who will use it (2), what matters most in it (4), how many sections (2), whether data is kept between
visits (none, in the browser, on a server — «on a server» gives no match by −10 rules, the honest «cannot build it
yet»). FRONTEND-DEV writes the final wording, ru in F2, kk in F2k, en in F2e.

`sai-intake.answers/` — one file per solution named `<id>.json` whose answers make that solution the first, and
`server-needed.json` (no match) (C12); each file is the answers object itself (`{"<question id>": "<option id>"}`),
which `resolveAnswers` accepts.

The step `content` of the check: `node ../tools/src/picker/cli.js check content/sai-intake.json` from `app/` → exit 0 and
the one line «Файл арендатора sai-intake в порядке: вопросов 5, решений 6, правил M.» [R criterion 5; M measured 32 on
the sketch].

### 4.10 The forbidden-words lint and `check-public` (B)

**`app/scripts/word-lists.js`** [R REQ-111 criterion 3; ARCH §17; AP-014, AP-093, AP-120]: `LISTS` — `{ Г, Б, В, Ц, С
}`, each `{ ru: [...], kk: [...], en: [...] }` frozen, exactly the forms of the block (counts Г 14/7/6, Б 10/2/2, В
9/5/2, Ц 23/11/8, С 10/7/2; 118 forms); `LANGS`; `lintText(text, lang, lists?) → Array<{ list, form }>` — a word is a
run of `[\p{L}\p{N}]`, compared whole and without letter case (lower case by `toLocaleLowerCase("ru")`); each list of
a language applies to texts of that language; П is the rule of the number 100 taken whole (no digit before it, nor a
digit with `.` or `,`; no digit, `.digit` or `,digit` after it), then nothing, a space, U+00A0 or U+202F, then `%` or one
of процент, процента, процентов, пайыз, percent as a whole word, in every language (C3); `₸` anywhere is a finding of
Ц; a text that is not a string → `TypeError`, an unknown language or list → `RangeError`; `""` → no finding. This is
the one file of `app/` outside `app/test` that holds the forms (criterion 3's grep for «кепілдейді»); `app/README.md`
names the file and quotes no form.

**`app/scripts/check-public.js`** (changed; the CLI is `node scripts/check-public.js [<public dir>]`, the intake beside
it at `<public dir>/../content/sai-intake.json`; default `app/public`):

1. Kept: every rule of REQ-109 criterion 7 (4.13 of the skeleton design), for every served text file of the folder.
2. Widened: `Math.random` in **any** served file (was: under `office/`) [R REQ-111 criterion 10].
3. Added, criterion 10's closed list, each with the identifier border of the file (no `A-Za-z0-9_$` before or after;
   for `srcdoc` also no `-`) and spaces allowed around each `.` and before each `(`: `outerHTML`; `insertAdjacentHTML`;
   `document` `.write` / `.writeln`; `createContextualFragment`; `parseFromString`; `setHTML`; `setHTMLUnsafe`;
   `parseHTMLUnsafe`; `srcdoc`; `setAttribute(` with `style` in `'`, `"` or `` ` ``; `.style.cssText`; `eval` `(`;
   `new` `Function`; `file://` after a sign that is no letter or digit, any case; the phrases «Демо: компания», «Демо:
   этап», «Demo: company», «Demo: stage» between word borders, any case, any white space after the colon. One finding
   label per form.
4. Added, the lint (criterion 3): (a) the texts module of the folder, imported by its file URL with its sha256 as the
   query, every value of every key in its language (`LANGS` of the module) — the lists, the word ban and the phrases;
   (b) every `.html` file: the visible text (the text outside tags, with comments and the content of `<script>`
   elements left out; the content of `<noscript>` is read as text) and the values of `alt`, `title`, `aria-label` and
   `content`, in ru; (c) the intake: every
   `{ru, kk, en}` text in its language, every other string with the word ban, the phrases and the ru lists. A missing
   or unreadable texts module or intake is a finding. It does not read the string literals of the page scripts (the
   served-file rules of item 1 hold the word ban and the phrases there, not the lists, F45): a text that a script
   writes is linted where it is shown, by the e2e after every state an LD test reaches (criterion 12; section 10,
   gate finding G1).
5. Output: `check-public: <file>: <item>` per finding — for the lint `<file>: <place>: <lang>: list <Г|Б|В|П|Ц|С>
   «<form>»` (place = `key <key>`, `text`, `attribute <name>`, or the intake path such as
   `questions[0].options[1].label`) — exit 1; else `check-public: app/public is clean`, exit 0.

**The CSSOM closed list** (C5; look 5.2 (d)), checked by PP-6 over the served `.js` files: every `.style` member use is
`<x>.style.setProperty("<name>", …)` with `<name>` one of `--H`, `--rw`, `--dt`, `--wh`, `--cx1`, `--cx2`, `--cx3`,
`--cx4`, `--you` (in `office/view.js`) or `--tx` (in `js/pages/demo.js`); nothing else of `.style` anywhere.

### 4.11 The public set of the build — `app/scripts/public-set.js` and `vercel-build.js` (B)

**`public-set.js`** [R REQ-111 criterion 9; decisions/0123 О3, О20; G8 «б», G9]:

| Export | Shape | Rule |
|---|---|---|
| `ORDER_TEXTS_PUBLIC` | `false` | **the G8 constant** («б»: the order texts are local only) |
| `GATES` | `Object.freeze({ langs: PUBLIC_LANGS, orderTexts: ORDER_TEXTS_PUBLIC })` | `PUBLIC_LANGS` imported from `../public/shared/i18n/lang.js` |
| `readRegions(html, file) → Array<{ kind, from, to }>` | | **the markers of one file read as one sequence, before anything is cut** (gate finding G2; F46): the text split into lines at `\n`; a marker line is exactly `^[ \t]*<!-- (\/?)sai:(order\|kk) -->[ \t]*$`; any other line that holds a marker-like comment — `<!--`, any white space or none, an optional `/`, any white space or none, `sai` in any letter case, any white space or none, `:` — is refused; an opening marker opens a region of its kind only while no region is open, and the next marker line must be the end marker of that kind, which closes it (`from` and `to` the indexes of its two marker lines); the lines between are never read. Every other shape throws an `Error` naming the file and the line, one of four: `<file>: line <n>: a marker that is not alone on its line or not one of the four forms`; `<file>: line <n>: an opening marker while the <kind> region of line <m> is open` (a region left open before a later one, a nested or a crossing marker); `<file>: line <n>: an end marker with no region of its kind open` (a stray one); `<file>: line <m>: a region never closed` |
| `stripRegions(html, kinds, file) → string` | | removes, for every region that `readRegions(html, file)` gives whose kind is in `kinds`, its lines `from` … `to` (both marker lines included); every other line byte for byte. So a region ends at its own end marker, never at a later one — `index.html` and `how.html` hold two `order` regions each, and a cut to the last end marker takes `</main>`, the footer's AI disclosure and the nav between them (M78, F41) — and a file that cannot be read as regions is never cut: it throws first (F46) |
| `renderTexts(langs, texts) → string` | | the module text: one comment line, `export const LANGS = Object.freeze([…]);`, `export const TEXTS = Object.freeze({` one line per key `"<key>": Object.freeze({"<l>":"<value>",…}),` in the source order, values by `JSON.stringify`, `});` — a fixed point: rendering what it imports again gives the same bytes |
| `writePublicSet(dir, gates = GATES) → Promise<{ changed: string[], removed: string[] }>` | | in this order: (1) import `<dir>/shared/i18n/texts.js` by its file URL with `?sha256=<hash of its bytes>` — an import that fails is thrown again as `Error("shared/i18n/texts.js: the texts module cannot be imported: <its message>", { cause })` (eslint's `preserve-caught-error` asks for the `cause`, F46); its export names must be exactly `LANGS` and `TEXTS`, else `Error("shared/i18n/texts.js: the texts module exports <the names>, not exactly LANGS and TEXTS")`; (2) **`readRegions` of every `.html` file of `dir`**, every kind, whatever the gates: the first refusal throws, and nothing has been written yet, so a refused upload stays byte for byte as it was (F46); (3) `langs` = the module's `LANGS` ∩ `gates.langs` in the module's order, keys = all keys, without `order_` ones unless `gates.orderTexts`; when this drops a language or a key, write `renderTexts(langs, …)` (else the file stays byte for byte — the second run); (4) unless `gates.orderTexts`, remove `<dir>/examples.html`; (5) in every `.html` file cut by `stripRegions` the regions of the kinds the gates close (`order` unless `gates.orderTexts`, `kk` unless `gates.langs` holds kk); (6) guards of the output, failing closed with an `Error` naming the file: a marker of a kind the gates close left (markers of an open kind stay, so the gates-open output is byte-equal); `examples.html` in an `.html` file while orders are closed; an element `data-lang="kk"` left while kk is closed |

The files that differ in the public set from the local set, exactly [R criterion 9 (d)]: `index.html`, `how.html`,
`demo.html`, `404.html`, `shared/i18n/texts.js`; removed: `examples.html`. Every other file (`gate.html`, the style
sheets, the scripts, the office files, `lang.js`, `text-rules.js`) is byte-equal.

**`vercel-build.js`** — the closed branch as the build tag holds it (the fix round: `GATE_SHA256`, `closedOutput`, the
second run of one build; not changed here); the open branch:

| # | Step | Success | Failure → what stays |
|---|---|---|---|
| 1 | `outDir` is `publicDir` and inside a git working tree | — | exit 2, `vercel-build: refused: the open build writes the public set into the output folder and runs only in the uploaded copy, not in a git working tree`; no step runs, nothing changes (F18) |
| 2 | `MIGRATE_ON_BUILD=1` → migrate | 0 | as today: exit 1, `…the migration step ended with code <n>`; the output unchanged |
| 3 | check-public (on the upload as it is) | 0 | as today: exit 1 |
| 4 | `outDir` ≠ `publicDir` → copy `publicDir` into `outDir` | — | — |
| 5 | `await writePublicSet(outDir)` | the public set; `vercel-build: done` | an `Error` → exit 1, `vercel-build: refused: <its message>` (a marker it cannot pair: `vercel-build: refused: <file>: line <n>: <the rule of readRegions>` — on a planted page «… index.html: line 35: an opening marker while the order region of line 23 is open» — and the output folder byte for byte as it was, F46); on Vercel the build fails and the previous deployment stays live |

`runBuild(deps)` returns a `Promise` of the exit code (C2); the CLI awaits it (`process.exitCode = await runBuild(…)`).
A second run on the output: step 2 finds nothing to apply, step 3 passes on the public set, step 5 changes nothing
(the texts module already has the public languages and no `order_` key; no region, no `examples.html`) — byte-equal
(F17). With the gates open (`{ langs: SOURCE_LANGS, orderTexts: true }`) the output is byte-equal to the source (PB-7).

### 4.12 Package files, Docker, README (B)

- `app/package.json`: `scripts.check` exactly `prettier --check . && eslint . --max-warnings 0 && tsc --noEmit -p
  jsconfig.json && node scripts/check-public.js && node scripts/vendored.js && node ../tools/src/picker/cli.js check
  content/sai-intake.json && npm run test:unit && npm run test:int` [R REQ-111 criterion 11; ARCH §3]; `scripts.test:e2e`
  `node --test --test-concurrency=1 "test/e2e/**/*.test.js"`; `devDependencies` gains `playwright-core` `1.64.1`
  (exact; Apache-2.0; 2026-10-14, F16), with an Addition to decisions/0001 by ORCH at the build (0118 О1, 0123 О10).
- `app/package-lock.json`: `npm install --save-dev --save-exact --before=<the install date minus 14 days>
  playwright-core@1.64.1`, then `npm ci` only (F16: 102 entries, one added).
- `app/Dockerfile`: one line `COPY content ./content` after `COPY db ./db` (the image serves the local set, 0123 О4).
- `app/README.md`: «The check» (the eight steps; the counts of each test step are those of the catalogue of the
  skeleton design with the tests added after it, as the section says at the build tag (F44), and of section 10 of this
  design with every test a later step of this run names — section 16, О15), «Local start» (the five pages, the local
  set with kk and the examples, the demo), «Test levels» (+ `npm run test:e2e`: `playwright-core`, the installed
  Chrome, one browser at a time), «Deploy» (the public set: what production leaves out, the constants of G8 and G9 and
  that changing one is a release). RB-1 of `runbooks.test.js` (the fix round's file; line 206 reads this README) makes
  every word `vercel` in lower case red unless it stands as `npx vercel@64.1.0 …` with the options RB-1 allows: the
  product is written «Vercel», and `vercel-build`, `vercel.json` and `.vercelignore` are no command for RB-1 (gate
  finding F7; B3).

### 4.13 The CI workflow — `.github/workflows/app.yml` (B)

- `paths`, exactly and in this order: `app/**`, `docs/runbooks/**`, `tools/package.json`, `tools/src/team/**`,
  `tools/src/pixel-office/mask.js`, `tools/src/pixel-office/public/layout.js`,
  `tools/src/pixel-office/public/office-sim.js`, `tools/src/picker/**`, `tools/src/node-floor.js`,
  `.github/workflows/app.yml` [R REQ-111 guard row (8); F15].
- Jobs exactly `check`, `pg`, `docker`, `e2e`, in this order. `docker` gains, after the preview step, one step: `run:
  test "$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:8080/api/demo/questionnaire?lang=ru')" = "200"`.
- `e2e`: `runs-on: ubuntu-24.04`, `timeout-minutes: 20`; its first step `name: Chrome path and version`, `run: ls -l
  /opt/google/chrome/chrome && /opt/google/chrome/chrome --version` (C7; decisions/0124 О7 «the first step of the e2e
  job prints the Chrome version and the path it uses»: the path is the one `playwright-core`'s channel `chrome` opens
  on Linux, F16; `ls -l` prints it, and a link's target with it, then the version line; the step is this one line, so
  a missing file ends it non-zero before the version, F43, and the job log heads the step with the same command line);
  then the three common steps (checkout with `persist-credentials: false`, setup-node 22.23.4 with
  `package-manager-cache: false`, `run: node -v`), then `working-directory: app` `run: npm ci`, then `working-directory:
  app` `run: npm run test:e2e`. No `||`, no `continue-on-error`, no `set +e`, no negated command, no secret (the rules
  of the fix round's `ciFindings` hold for this job as they stand).

---

## 5. Failure paths — what the visitor sees, what stays unchanged

| # | Failure | What is seen | What stays unchanged | Test |
|---|---|---|---|---|
| E1 | The questionnaire answers 500, a body that is not the questionnaire, or 4xx | the message block of look 7.18 on `--paper` in the question panel: `demo_error`, `demo_failed`, `demo_what_now`, «Повторить», «<to the landing>»; the scene stays in its load state | nothing stored; the page keeps working; a retry asks again | LD-7 |
| E2 | The questionnaire never answers, or its request fails at once with no answer (no connection: the `fetch` rejects with a `TypeError`, F42) | after `DEMO_TIMEOUT_MS`, or at once, the same block with `demo_offline` in the place of `demo_failed` (look §11: «no connection, or no answer within the page's time limit») | as E1 | LD-7 (a held request and a request the route aborts) |
| E3 | The result request fails (any of E1, E2) | the receipt's body shows the on-cream message (look 7.12, 7.18); «Повторить» sends the same answers | the answers in the page; the scene in the result state | LD-7 |
| E4 | `localStorage` throws on read and on write | the language from `?lang=` or ru, the theme from the system; both buttons work until a reload | no exception; nothing written | LD-4, TC-1 (the pure part) |
| E5 | `getContext("2d")` returns null | the text view of look 9.16 in place of the stage (class `text-view`) | the page, the demo and the text list work; no exception | ST-5 |
| E6 | `drawScene` throws | the same text view; the frame loop stops | as E5 | ST-5 |
| E7 | No script | the static Russian page; on index, how, demo the text view by `noscript.css`; on demo the `<noscript>` block | nothing is requested beyond the files | DESIGN-QA-VALIDATOR (criterion 15): the state «no script» of look §11 and 9.16 stands in its map of states, against the look; the mechanism is measured (`javaScriptEnabled: false`, F26). Not UAT: criterion 13 does not name it |
| E8 | The intake missing or broken at the start | both demo routes 503 `{"error":"demo_unavailable"}`; `node-main` one stderr line; the page shows E1 | every other route answers as before | DM-6 |
| E9 | A bad result body (not JSON, not an object, another key, `answers` not an object, an unknown question or option, a value of the wrong kind) | 400 with its code | nothing stored; the next request answered | DM-4 |
| E10 | A body over 65 536 bytes | 413 `body_too_large` | as E9 | DM-4 |
| E11 | `SITE_GATE` set | the gate answer of REQ-108 criterion 9 | no route runs | DM-7 |
| E12 | The engine throws on a request | 503 `demo_unavailable`, the code in the log line | the app answers the next request | DM-6 (a planted throwing intake) |
| E13 | The open build in a git working tree | exit 2 and its line | names and bytes of `app/public` | PB-4 |
| E14 | A marker the build cannot pair — an opening marker while a region is open (a region left open before a later one of its kind, a nested or a crossing marker), an end marker with no region of its kind open, a region never closed, a marker not alone on its line or not one of the four forms — or, after the cut, a marker of a closed kind, an `examples.html` reference or a `data-lang="kk"` element left | exit 1, `vercel-build: refused: <file>: line <n>: <rule>` for the pairing (4.11 `readRegions`), `vercel-build: refused: <file>: …` for the guards of the output; on Vercel the build fails, the previous deployment stays | the source; for the pairing the upload folder byte for byte (refused before the first write, F46); on Vercel the live site | PB-6, mutants M04, M89–M91 |
| E15 | The texts module of the upload cannot be imported, or exports other names | exit 1, `vercel-build: refused: shared/i18n/texts.js: …` (step (1) of `writePublicSet`) | the upload folder byte for byte (before the first write, F46); on Vercel the live site | PB-6 (i) |
| E16 | The copy, the record or the source of the engine differ; a second file in `server/vendor` | the step `vendored` exit 1 with a line naming the file and the rule; the check stops | nothing | VD-3 |
| E17 | `picker check` finds an error in the intake | the step `content` exit 1 with its lines | nothing | IN-6 |
| E18 | A forbidden form in a text | `check-public` exit 1, a line with the file, the key or place, the language and the form | nothing | FW-7 |
| E19 | A palette token is not `#rrggbb`, or the strength not a number 0–1 | the scene drawn with `#808080` for that colour, or with no light layer (alpha 0) | no exception | OS-6 |
| E20 | A tap during a walk | the walk turns to the new target from where «Вы» is | no jump | OS-7 |
| E21 | The page hidden during a walk | no frame; shown again, the walk goes on | the position | OV-3 |

---

## 6. CSP and markup rules (one list for the developers, the review and the tests)

The policy of REQ-109 stays (`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
font-src 'self'; connect-src 'self'; …`). [R REQ-111 criteria 1, 10, 12; look 5]

1. No `<script>` without `src`, no `<style>`, no `style=` or `on…=` attribute (check-public, REQ-109). Every script is
   `<script type="module" src="/js/pages/<page>.js">`.
2. Elements by `document.createElement`, texts by `textContent`; never the forms of 4.10 item 3 (check-public).
3. Style changes only by classes, by the canvas attributes, by `scrollLeft`, and by the closed list of
   `style.setProperty` of 4.10 (PP-6). A theme is the `data-theme` attribute of `<html>`.
4. Every `href` and `src` root-relative, an anchor of the page, or the icon's `data:,` (PP-3).
5. The pages call only their own origin (`connect-src 'self'`): the two demo routes; no outside address in any file
   (check-public), no request outside the local server in the e2e (the URL guard).
6. Measured: these forms raise no violation and these raise one (F26) — the e2e records every
   `securitypolicyviolation` and every console line, and allows only the declared 404 line (F27).

---

## 7. Protection in the same operation as the action

- The open build refuses inside a git tree in the same call that would rewrite the folder, before any step (F18).
- `writePublicSet` reads the markers of every page as one sequence before its first write and cuts exactly the
  regions it read, so a page it cannot read as regions is refused before anything is written and is never cut (gate
  finding G2, F46); then it checks its own output (no marker of a closed kind left, no order reference, no kk button)
  before it returns, and `runBuild` turns either refusal into exit 1 in the same call; nothing reaches the platform's
  output unchecked.
- The function's languages are fixed when its app is built (`PUBLIC_LANGS`); a request can only pick among them.
- The demo answer is built field by field from named fields in the expression that writes the body; no spread of the
  engine's output, so a new engine field never reaches the visitor.
- `pref.write` checks the key and the one-word value in the same call that writes.
- The step `vendored` reads the three hashes in one call; the step `content` checks the file the server reads.

---

## 8. Time budget

Measured: the app check at the design tag and at the build tag 61 s on the Mac (F3, F35); the parity driver 1.9 s (F24); browser launch 551 ms and
23 ms a small page (F28). Budget [P]: `npm run check` ≤ 120 s on the Mac (unit + int ≈ 61 s + about 20 s for the new
files: the parity 2 s, the 900 × 3 combinations under 1 s, the drawing of every state at three sizes and two themes a
few seconds, demo-parity's 100 requests on PGlite a few seconds); `npm run test:e2e` ≤ 6 min on the Mac (126 page
loads of the matrix with in-page checks, the demo flows of 7 fixtures + five «Не знаю» in three languages, four
failure cases in ru of up to 8 s each, the public set, and ST-2's walks — the door to desk 4 on how (four walks) and
on demo (three), 237 to 252 logical px each page at 72 a second, about 7 s of walking and 2.1 s of quiet waits per
window and language, so about 1.5 min [C from 9.1, 9.8 and 9.13 of the look]); the `e2e` job limit 20 minutes, the
other job limits as today. Every waiting test has its own deadline and closes its browser, server and context in
`t.after` (AP-116, AP-140); one browser at a time (`--test-concurrency=1`, PLAN §4.6).

---

## 9. Criterion → test

The red-without-fix plan of every rule is its damaged copies and mutants (column 4); a test that is red only because
the code does not exist yet proves nothing and is not counted (WF-02 step 5).

| Requirement / criterion | Design element | Test or command (fails when the criterion is violated) | Damaged copies / mutants (the red-without-fix plan) |
|---|---|---|---|
| REQ-111 / 1 Pages | 4.3 | `unit/public-pages.test.js` PP-1…PP-5, and PP-7 (the same rules on the public set, so the places of the test-mode line and of the AI disclosure hold on production too) | the nine damaged copies of the criterion and the three built forms (PP-5); M62–M64; M78, M79 (PP-7, measured F41) |
| REQ-111 / 2 Texts, the language rule | 4.1, 4.2 | `unit/texts.test.js` TX-1…TX-8; the readers of step 8 (handoffs of the run) | the seven damaged copies of the criterion (TX-8); M36–M39 |
| REQ-111 / 3 The lint | 4.10 | `unit/forbidden-words.test.js` FW-1…FW-8 | the planted copies of FW-7; M26–M32 |
| REQ-111 / 4 Themes and contrast | 4.4, 4.5 | `unit/theme-contrast.test.js` TC-1…TC-5; the page part `e2e/landing.test.js` LD-4 | the three damaged `tokens.css` (TC-4); M40–M43 |
| REQ-111 / 5 The intake, the step content | 4.9 | the step `content` of `npm run check`; `unit/intake.test.js` IN-1…IN-6 | the eight damaged copies of IN-5 |
| REQ-111 / 6 The byte copy | 4.8 | the step `vendored`; `unit/vendored.test.js` VD-1…VD-4 | the four damaged copies of VD-3; M20–M25 |
| REQ-111 / 7 The demo routes | 4.7 | `int/demo.test.js` DM-1…DM-7 | M11–M19 |
| REQ-111 / 8 Demo parity, nothing stored | 4.7 | `int/demo-parity.test.js` DP-1, DP-2 | M18 (a row written, the adapter called once) |
| REQ-111 / 9 The public set | 4.11 | `unit/public-build.test.js` PB-1…PB-7 (what it leaves out, and in PB-2 and PB-6 what it keeps); `unit/public-pages.test.js` PP-7 (the pages of the output); `e2e/landing.test.js` LD-9 (the public set in a browser); `int/node-main.test.js` NM-6 | M01–M10 (six measured, F20); M78, M79 (measured, F41); PB-6's planted shapes (a)–(j) with M89–M91 (measured, F46) |
| REQ-111 / 10 No inline code, not carried over | 4.10 item 3, 6 | `unit/check-public.test.js` CP-1, CP-2 (rows of section 11) and CP-3 (`el()` of `dom.js` refuses a computed `style` or `on…` name); the e2e's CSP records (LD-1, ST-6); RELEASE-VALIDATOR's commands of the criterion (the grep of 29 names, the phone-number script, the sha256 comparison with the sample, the kk-draft script) | the 22 planted forms and 16 twins (CP-2); M33–M35; M81 (CP-3) |
| REQ-111 / 11 The check chain and CI | 4.12, 4.13 | `unit/npmrc.test.js` NPM-3, NPM-5, NPM-7 (the fix round's NPM-6, the selector grep, stays as it is); `unit/ci-workflow.test.js` CIW-1, CIW-2 (with the first step of the e2e job, 4.13); RELEASE-VALIDATOR: the clone of depth 1, `git rev-parse --is-shallow-repository`, `git rev-list --count HEAD`, the paths removed, `cd app && npm ci && npm run check`; `gh run list --workflow app.yml --branch <ci branch> --limit 1 --json conclusion,headSha`; the e2e log's counts; `npm view playwright-core time --json` | the rows of section 11 for both files; M71–M77 |
| REQ-111 / 12 The landing in a browser | 4.3–4.7, 4.11 | `e2e/landing.test.js` LD-1…LD-9; the lint of the shown text (`shownTextFindings` of `test/fixtures/browser.js`: the lists of the page's language, the word ban and the phrases of REQ-109 criterion 7) after every state each of them reaches, not only at load — each question, «Назад», «Не знаю», each result and the no-match result in each language, each failure message, each language switch and theme change, the public set's pages and result in ru and en (gate finding G1) | M65–M69; M78–M80, M82; M88 (a page script that writes a list form only after a tap: red in LD-5, LD-6 or LD-7 by the state that shows it, green in LD-1, check-public and FW-7; measured on a trial page, F45) |
| REQ-111 / 13 Browser step | 4.3, look | UAT-RUNNER (step 8), real Chrome, the matrix, snapshots outside the project | — |
| REQ-111 / 14 Reader without context | 4.1 (the how panels) | BA-ANALYST's key and score, a fresh agent (step 8) | — |
| REQ-111 / 15 Look and the owner | the look | DESIGN-QA-VALIDATOR (step 7); G21 in PROGRESS | — |
| REQ-111 / 16 Guard tests and both checks | section 11 | `git diff --stat base/M1CODE-20261119-01-build -- app/test tools/test` (decisions/0124 О13: it lists only this run's files, F36); `cd app && npm ci && npm run check` (counts of section 10); the skip/todo/only grep of REQ-108 criterion 2 (the fix round's NPM-6 runs it inside the check too); `cd tools && npm run check`; `cd tools && npm run traces` | — |
| REQ-112 / 1 Files and port headers | 4.6 | `unit/port-parity.test.js` PO-1, PO-2; IB-1 (with the row of section 11 row 5); RELEASE-VALIDATOR: `git show <commit>:<path> \| shasum -a 256` per port, `git diff --stat base/M1CODE-20261119-01-build -- tools/src/pixel-office` | a header hex digit changed, a copy of an original with one byte changed (PO-1); M48, M49 |
| REQ-112 / 2 Port parity | 4.6 | PO-3, PO-4 | M44–M47 (measured, F25) |
| REQ-112 / 3 Pure modules | 4.6 | `unit/office-pure.test.js` OP-1…OP-5 | the nine planted twins and three green ones (OP-5); M50, M61 |
| REQ-112 / 4 The scene and the drawing | 4.6 | `unit/office-stage.test.js` OS-1…OS-6 | the eight planted context uses (OS-2); M51–M54 |
| REQ-112 / 5 Motion only on taps | 4.6 `view.js` | `unit/office-view.test.js` OV-1…OV-7 | M55–M59 |
| REQ-112 / 6 The scene on the pages | 4.3, 4.6 | `e2e/stage.test.js` ST-1…ST-6 (ST-2 by decisions/0123 L3: «no label cut» at load, on every frame of each walk and after it; «no two labels overlap» when «Вы» stands) | M70; M93 (a label cut only while «Вы» walks: red on the frames of a walk, green at load and after it; measured on a trial page, F51) |
| REQ-112 / 7 Browser step | 4.6 hooks | UAT-RUNNER (step 8): the scene, labels, taps, reduced motion, `data-frames` not growing while the tab is hidden | — |
| REQ-112 / 8 Look and the owner | the look | DESIGN-QA-VALIDATOR; G21 | — |
| REQ-112 / 9 No agent event | 4.6 | `unit/office-pure.test.js` OP-6; the parameters of the scene (OS-1); the caption on every page with the scene (ST-1) | the ten planted forms (six calls, three strings, one template literal) red, the seven twins green (OP-6); M60 |
| REQ-112 / 10 Guard tests and both checks | section 11 | the commands of REQ-111 / 16 and `git diff --stat base/M1CODE-20261119-01-build -- tools/src` → no line | — |

Every test of section 10 maps to a row here, and the file names are the criteria's (AP-123); `office-stage.test.js` OS-7
(the functions the port adds) is REQ-112's «own test» of the added functions (its description). The commands that name
`base/<RUN-ID>` (REQ-111 criterion 16, REQ-112 criteria 1 and 10) read `base/M1CODE-20261119-01-build` for this run
(decisions/0124 О13): its diff holds no file of the fix round, while the diff from `base/M1CODE-20261119-01` lists the
fix round's five test files (F36).

---

## 10. Test catalogue

No test is made in a loop and no subtest is used, so «# tests» of a folder equals its number of named tests (decisions
0118 О17, О20). Every damaged copy and planted case is made in the test from parts where a literal would hit a search
(AP-093); a copy of a source file is written into a temporary folder outside the project and imported from there.
Counts at the build tag (decisions/0124 О13): unit 46, int 36, e2e 0 (F35); the counts below add to these. The fix
round's NPM-6 runs the grep of the skip, todo and only selectors of REQ-108 criterion 2 (its `SELECTOR_GREP`) over
every line of every file under `app/test`, inside the check: every new file and **every changed file** (rows 1, 5–12
of section 11), the helper included, **comments and strings included**. Its two forms are a dot, one of the three
names and a parenthesis (`.only(`), and one of the three names after a sign that is no letter, digit, `_`, `$` or
`.`, then a colon and anything but the word `false` (`only:`) — so a prose comment «… is read only: it stands …» is
hit (gate finding G5: the sketch of row 8 was, F49). No new or changed file under `app/test` holds either form, in
code or in prose, and a planted selector form is built from parts (AP-093).

**`unit/public-pages.test.js`** (REQ-111 c1) — PP-1 the `.html` files are exactly the six; `gate.html` keeps its
sha256 (the value written in the test). PP-2 every page but gate: doctype, `html lang="ru"`, charset, viewport,
color-scheme `light dark`, robots `noindex`, one `title`, the icon link (`data:` or a file), every `script src` and every
style sheet a file of `app/public`. PP-3 every `href` and `src` an anchor of the page, the icon's `data:`, or one `/`
first (never `//`, `./`, `../`, a scheme), read without query and anchor, naming an existing file (`/` = `index.html`),
an anchor after a path naming an element of that file. PP-4 `index.html` holds «Sai — закрытое тестирование»; every page
but gate has `#test-mode` and `#ai-disclosure` holding `test_mode` and `ai_disclosure` with their ru values. PP-5 the
nine damaged copies of the criterion red, `<meta charset="utf-8" />`, `href="/"` and `/how.html?lang=en` green. PP-6 the
CSSOM closed list of 4.10 over every served `.js` file; planted `el.style.color = 1`, `el.style["height"] = 1` and
`stage.style.setProperty("--x", 1)` red, the eleven allowed writes green. PP-7 the rules of PP-1…PP-4 on the public
set (c1, c9; gate finding F2): the open build with injected steps, awaited, in place on a copy of `app/public` and
`app/content` outside any git tree; the output's `.html` files are exactly `index`, `how`, `demo`, `404` and `gate`;
PP-2's head and PP-3's addresses on every output page, an address naming a file of the output (a left link to
`/examples.html` or to an anchor that the cut took, such as `/how.html#describe-idea`, is red); every page but gate
has `#test-mode` and `#ai-disclosure` holding the ru values of `test_mode` and `ai_disclosure` of the output's texts
module (imported); the greedy cut (M78) and a region opened before `#ai-disclosure` (M79) red (F41).

**`unit/check-public.test.js`** (changed, section 11 rows 6–7; c10) — CP-1 and CP-2 by rows 6 and 7. CP-3 (new) `el()`
of `public/js/dom.js`, imported in Node with `globalThis.document` replaced by a recording fake (its descriptor saved
first and restored after) whose `createElement` gives an element that records every `setAttribute`: the names
`style`, `STYLE`, `Style`, `onclick`, `onClick` and `ONLOAD` each throw and leave no recorded call; `data-x`,
`aria-label` and `lang` are set as given (gate finding F9; M81).

**`unit/texts.test.js`** (c2) — TX-1 exactly the exports `LANGS` (= `SOURCE_LANGS`) and `TEXTS`, frozen, every entry
frozen, keys `^[a-z][a-z0-9_]*$`. TX-2 three non-empty strings and the same placeholders per key. TX-3 no control or
invisible character (the class of the picker's rule), no phrase over 18 words, no ты-form in ru, no «Claude Code».
TX-4 the exact values of 4.1's first table, kk and en of the theme words; no `nobuild_*` key starts with `order_`. TX-5
the `order_` keys are exactly the 45 of 4.1; `examples.html`'s `data-t` keys of E2 and E3 are the `order_can_*`,
`order_cannot_*` and `order_example_*` keys. TX-6 the text rules of `public/shared/text-rules.js` give the picker's
answers on at least 200 texts built by the test (a seeded generator: lengths, signs, ты-forms, phrase breaks). TX-7
`lang.js`: no `document`, `window`, `localStorage` after blanking (the `blank` of `import-boundaries.test.js`);
`pickLang.length` 3; the table of the criterion (`de`, `RU`, `""`, `<script>`, 1 000 characters, and `kk` with
`PUBLIC_LANGS`, go to the next rule). TX-8 the seven damaged copies of the criterion red (a key without kk, a placeholder
missing in en, a phrase of 19 words, «ты», U+200B, a text rule that differs, a `pickLang` that takes a header).

**`unit/forbidden-words.test.js`** (c3) — FW-1 the lists equal the literal table of the test (forms and counts), no
repeat. FW-2 every form of every list, in its language, in lower case, upper case and with a capital, with the six
borders, found with its list's name. FW-3 every form that only another language's list has is not found in this
language; «минут» found in ru and kk. FW-4 П: the six found forms, «1100 %», «100,5 %», «0,100 %» not found. FW-5 the
17 twins not found in any language. FW-6 non-string, unknown language, unknown list throw; `""` gives no finding. FW-7
`node scripts/check-public.js <copy>` on planted copies of `app/public` and `app/content` — a texts value «бесплатно», an
intake option «гарантия», a page «5 минут», an en value «100%», a kk value «теңге», a value with «₸», an intake string
«REQ-1» and «handoff» — each exit ≠ 0 with the line of 4.10 item 5; on the real files exit 0. FW-8 a walk equal to
`grep -rl 'кепілдейді' app --exclude-dir=node_modules --exclude-dir=test` names exactly `scripts/word-lists.js`.

**`unit/theme-contrast.test.js`** (c4) — TC-1 `themeFor` by the table; `readChoice` gives auto for null, «sepia»,
«Dark», `""`, a number, 1 000 characters; `nextChoice` goes round from each position. TC-2 `tokens.css` defines every
token of look 6.1 and 6.2 in the light set and in both dark blocks, the two dark blocks equal. TC-3 every text pair of
look 6.3 ≥ 4.5:1, every accent pair ≥ 3:1, both themes, by a WCAG 2.x function written in the test (the pressed card by
its mix rule). TC-4 damaged copies — one text colour at 4.4:1, one accent at 2.9:1, a token missing in the dark set —
red. TC-5 `theme.js` imports in Node with no `document` or `window`.

**`unit/intake.test.js`** (c5) — IN-1 schema, id, five single questions, no `show_if`, `required` false, 2–4 options.
IN-2 no `price_text`, `duration_text`, `leads`; every solution ≥ 1 `not_suitable_when`; the ids exactly the six of 4.9.
IN-3 every combination (≤ 3 125) through the byte copy: ok and a recommended solution or the `no_match_text`. IN-4 every
fixture accepted by `resolveAnswers`, their number ≥ the solutions, every solution first in at least one. IN-5 eight
damaged copies red (a sixth question, `multiple`, `show_if`, `price_text`, `leads`, no `not_suitable_when`, an id outside
the list, a fixture with an unknown option). IN-6 the step's command exits 0 with its one line, N from 1 to 6.

**`unit/vendored.test.js`** (c6) — VD-1 one entry; the three sha256 equal. VD-2 `server/vendor` holds no other `.js`;
the copy is imported only by `server/routes/demo.js` (every `.js` of `app/` but `test/` and `node_modules`), by no file of
`public`, `api`, `scripts`. VD-3 the step on temporary copies — one byte of the copy changed, a stale record, a second
file in the folder, a changed source — each exit 1 with its line. VD-4 the declaration's export names equal the copy's;
`jsconfig.json` excludes exactly the copy.

**`unit/public-build.test.js`** (c9) — PB-1 the open build in place on a copy of the real `app/public` and
`app/content` outside any git tree, with injected steps: no `examples.html`, no file holding `examples.html` or
`data-lang="kk"`; the output's texts module (imported) has no `order_` key, `LANGS` ru and en, no kk value; no file
holds, between word borders, an `order_` value of any language or a source kk value that differs from its key's ru and
en, unless a kept key has that value. PB-2 every other file byte-equal; the files that differ exactly the list of 4.11;
each page that differs equals its source with exactly the lines of its regions of the closed kinds removed, by the
test's own line oracle (from a line that is only an opening marker to the nearest line that is only the end marker of
its kind, both included), so a cut that takes more (the greedy cut, M78) or less is red (F41); it reads the real
pages, which PB-6 proves well-formed — a page that is not is the build's refusal, PB-6's planted shapes. PB-3 a
second run: exit 0 and a byte-equal tree. PB-4 a git working tree: the real `app/public` is only read (`insideGitTree` true for it);
the open build runs in place on a copy of `app/public` and `app/content` inside a temporary git working tree that the
test makes (`git init -q` with no global or system git settings, as IB-2 does; the copy at `<root>/app/public`): exit
2, its line, no step called, the copy's names and bytes as before — so a broken refusal can rewrite only that copy,
never the project's uncommitted pages (gate finding F8; F40). PB-5 `PUBLIC_LANGS` is defined once (in `lang.js`) and
imported by `scripts/public-set.js` and `server/app.js`; the output's `LANGS` equal it. PB-6 the source regions and
the build's refusals (gate findings F2, G2). On the real pages, by the test's own reader of the markers: every marker
alone on its line and one of the four forms, closed, not nested, kinds `order`/`kk`; every `examples.html` and
`data-lang="kk"` of the source pages inside its region; the content of every region is what 4.3 names — every `data-t`
and `data-t-aria` inside an `order` region names an `order_` key and, on every page but `examples.html` (left out
whole), none outside a region does; a `kk` region holds exactly one element, the button `data-lang="kk"` (`data-t`
`lang_kk`); no element inside a region has an `id` (so no kept place stands in one); a planted region opened before
`#ai-disclosure` (M79) breaks the content rule (F41). The planted shapes, each on a fresh copy of `app/public` and
`app/content` outside any git tree, `writePublicSet` awaited: (a) `index.html` with block D's end marker dropped (a
region left open before the footer's region of its kind); (b) an opening marker before the footer's home link; (c) an
opening marker nested inside block D; (d) a stray end marker before block D; (e) an opening marker after the last
region, never closed; (f) block D's end marker on one line with the element before it; (g) the how panel's two
markers written with no spaces (`<!--sai:order-->`; no other guard sees them, the panel holds no `examples.html`);
(h) a `kk` region crossing block D; (i) the texts module with a third export, and one that cannot be imported — each
rejects with an `Error` naming the file, and for (a)–(h) the line and the rule of 4.11 (asserted by the file, the
line number and the rule, never by the whole message), and the copy's names and bytes are as before (refused before
the first write); (j) a link to `examples.html` outside a region rejects with its file named (the guard of the
output, after the cut). M89 is red at (a)–(c), (f), (g) by no refusal and at (d), (e), (h) by a refusal after the
first write; M90 at (a)–(h), the copy changed; M91 at (g) (F46). PB-7 with the gates open the output is byte-equal to
the source.

**`unit/port-parity.test.js`** (REQ-112 c1, c2) — PO-1 the two headers (the path, 40 hex, 64 hex, «no import of
tools/»); the sha256 of each original, computed with no git command, equals its header's; one header digit changed and
an original copy with one byte changed are red in the same comparison. PO-2 the kind is `deliver` in `sim.js`, no whole
word `handoff` in `app/public`. PO-3 `grid.js` against `layout.js`: constants, `deskSpot`, `officeSize`, `buildLayout`
for 1, 4, 21, 22, 30 desks, `cellKind`, `walkable`, `canStep` on every cell, `findPath` from every seat to every walkable
cell. PO-4 `sim.js` against `office-sim.js`: the fixture scripts of the criterion (one walker, several, `after`, unknown
walker, repeated id, the two kinds on one event index, `seen: true`, a pause, the speeds 1, 2, 4) × 200 ticks of 0.05 s.

**`unit/office-pure.test.js`** (REQ-112 c3, c9) — OP-1 the four pure files import only each other. OP-2 after blanking,
none of the names of criterion 3 as a whole identifier, nor `Math.random`. OP-3 the traps of criterion 3 (descriptors
saved first, restored after), each module freshly imported and run: no read recorded. OP-4 two runs deeply equal,
inputs unchanged. OP-5 the nine planted twins red, `dateText`, `opts.window`, a comment «Date» green. OP-6 no file of
`app/public/office` names `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` as a whole identifier
after blanking, or holds `/api` by the raw-text borders; the ten planted forms — six calls, three strings and one
template literal — red, the seven twins green.

**`unit/office-stage.test.js`** (REQ-112 c4 and the added functions) — OS-1 the scene: four desks in order with the
stage words and the role titles (ru values from the texts module, `name` from `tools/src/team/roles.js`), the door,
«Вы» at the door at the start, the caption key; markers passed as words are found in the scene and nothing else is;
`geometry()` at the three windows equals the table of look 9.1 (s, H, W, Rw, wallH, deskTop, lane, sp, cx) and
`cameraOffset()` the offsets of look 9.14's table (390: 0, 0, 57, 129, 155; 320: 0, 2, 74, 146, 190), `cameraAt()`
reaching its target at the end.
OS-2 a recording context: only `fillRect` called and only `fillStyle` set; the eight planted uses red. OS-3 every
coordinate and size an integer, the scale an integer ≥ 1, at most 4 000 calls a frame. OS-4 25 colour markers and a
strength marker m (two decimals, not .15 or .5), every state of the step table × light and dark × the three logical
sizes: every fill a given colour at alpha 1, the light layer of the `--sc-dim` marker with the test's exact alpha from
m and the state's «What the bands keep» list, or a constant of look 6.2; every marker found back; alpha m where no band
lies. OS-5 with .15 and .5 the light layer's alphas are exactly the closed lists of look 9.11 per state row (9, 4, 21
values), the half-way products .1094, .0515, .3281, .1201 included, and the test's own rounding gives them. OS-6 a
colour not `#rrggbb` → `#808080`, a strength not a number 0–1 → the light layer at alpha 0, no exception. OS-7 the added
functions: `stageMap` (one row, every cell walkable, `findPath` straight, `null` for bad widths), `createWalker` (72 cells
a second, the step frames of 160 ms, `frame` 0 standing, a redirect from the current cell, `place` at once, `walkTo` of
the current place false).

**`unit/office-view.test.js`** (REQ-112 c5) — with an injected clock, `requestAnimationFrame`, `matchMedia`, visibility
and a recording canvas: OV-1 after the first frame, 10 000 clock ticks without a tap: no frame, no position change.
OV-2 a tap walks «Вы» to the step table's desk, frames only during the walk, ≤ 25 per 1 000 ms with a request every
16 ms, none after it. OV-3 hidden: no frame requested or drawn; visible: the walk goes on. OV-4 reduced motion: the
target in one frame, no place between; a change of the setting is followed. OV-5 the tokens read once per theme change,
counted over 100 frames. OV-6 a tap that changes the drawn state with no walk draws exactly one frame; a tap to the
drawn state draws none (0123 О15). OV-7 one frame after a theme, a language and a size change each.

**`unit/npmrc.test.js`** (changed, section 11 rows 1–2) — NPM-3 the eight-step chain; the damaged copies without
`vendored` and without `content` red; `test:e2e` exactly the command of 4.12, no selector. NPM-5 the 12 int files. NPM-7
(new) `app/test/e2e` holds `landing` and `stage`; a copy without one is red. NPM-6 is the fix round's grep of the
selectors and stays as it is.

**`int/demo.test.js`** (c7; through `createApp` with `SOURCE_LANGS` and through the function entry `createEntry(() =>
createFunctionApp(…, { intake }))`) — DM-1 the questionnaire in ru: 200, JSON type, `no-store`, the fields of 4.7 field
by field, a field planted into a copy of the intake absent. DM-2 the language rule through both (ru, en; kk → kk
locally and ru through the entry; `de`, `RU`, `""`, 1 000 characters, none → ru; an `Accept-Language: en` header changes
nothing). DM-3 the result field by field in the language through both, never the fields 4.7 excludes. DM-4 the seven
400 cases with their codes and the 413; after each, the next request answered. DM-5 `GET …/result`, `POST
…/questionnaire` → the uniform 404. DM-6 a missing and a broken intake (and one whose engine call throws) → 503
`demo_unavailable` on both, health and the pages as before. DM-7 `SITE_GATE` → the gate answer; no `Set-Cookie`; one log
line per request with the keys of REQ-108 criterion 10, a marker planted in an answer value in no line.

**`int/demo-parity.test.js`** (c8; PGlite after the migration, a counting adapter) — DP-1 every fixture × ru, en, kk:
the local answer equals the original `tools/src/picker/engine.js` on `tenantInLanguage(intake, lang)` with the test's
projection. DP-2 100 requests to both routes, valid and refused: the adapter called 0 times, the row count of every table
(`information_schema`) and the sha256 of the `schema_migrations` rows equal before and after.

**`int/node-main.test.js`** (changed, row 3) — NM-5 the 25 unit files. NM-6 (new) on the local server `GET
/examples.html` → 200 with its bytes; `GET /shared/i18n/texts.js` → the source bytes (kk and `order_` keys included).

**`e2e/landing.test.js`** (c12; `playwright-core`, one browser, the local server on port 0; `test/fixtures/browser.js`).
**The lint of the shown text, in every state** (criterion 12: «on every page and in every state of the demo that the
test reaches, in each language … so a text that a page script writes is linted as well»; gate finding G1):
`shownTextFindings(page, lang)` of the helper reads, in the page, `document.body.innerText` and the values of `alt`,
`title` and `aria-label` of every element, and gives the findings of `lintText(<text>, lang)` of
`app/scripts/word-lists.js` (imported: the lists Г, Б, В, П, Ц, С of the page's language) and of the word ban and the
three phrases of REQ-109 criterion 7 (`REQ-` before a digit; `handoff`, `handoffs`, `orch`, `decisions` as whole words
in any letter case; «Claude Code», «Около 2 минут», «типовой вариант» in any letter case with any white space between
their words — the helper's own table, built from parts, AP-093). Every LD test asserts it empty, in the page's
language, **after each state it reaches**, not only at load: there the page scripts write the questions and options
of the API, the chips, `demo_question_of` and `demo_k_of_n` filled, the receipt, `demo_also_fits` with `{names}`, the
live line, the text list of the scene and the messages, while check-public lints only the texts module, the `.html`
files and the intake (4.10 item 4), never a literal of a page script (F45). The live line and the text list of the
scene, visually hidden by the `.sr` rule, are part of `innerText` (measured for an element with that rule, F45). The
states, per test: LD-1 each page of the matrix at load; LD-3 after each switch, in the new language; LD-4 after each
change of the theme (the label and the name «Тема: …»); LD-5
each question as it shows, after «Назад», after «Не знаю» and at the result, by taps and by the keyboard; LD-6 each
question on the way and each result and the no-match result, in each language; LD-7 each failure message, of the
questionnaire and of the result, and the state after «Повторить»; LD-8 after each step of its pass; LD-9 each page of
the public set at load and the result in ru and en. A page script that writes a list form only after a tap (M88) is
red in the test whose state shows it — into the result LD-6, into a failure message LD-7, into the live line only
LD-5 and LD-6 — and green in LD-1, check-public and FW-7 (measured on a trial page, F45).

The tests — LD-1 every page (index, how, examples, demo, 404, and 404 at `/a/b/c.html` and `/x/y/`) × the three
windows × light and dark × ru, kk, en: no horizontal scroll; no cut text by 0123 V2's reading; every button and link
of the navigation and the demo ≥ 44 × 44; `#test-mode` and `#ai-disclosure` visible with the module's texts; `lang` and the title in the
language; every visible text ≥ 4.5:1 against its background up the tree; no request outside the server; no CSP
violation; no console line but the 404 line (F27); `shownTextFindings` empty at load. LD-2 `examples.html` shows the
three requests and the two lists in each language. LD-3 the language switch: the build's languages, `lang` on each,
the current one pressed, no reload, `?lang=` set, `sai-lang` stored; the lint after each switch. LD-4 the theme button
by criterion 4's page part (one button, its text and name, click, Enter, Space, `sai-theme` one word, Auto follows an
emulated system change without a reload and the others do not, a storage that throws on read and write leaves the
theme to the system and the button works); the lint after each change; after each change of the theme (Светлая →
Тёмная → Авто with the system light emulated) every avatar canvas of the landing holds among its pixels the value of
`--sc-chair` of the theme drawn (the computed token, read in the page) and not the other theme's (gate finding F5; the
read is exact, and an avatar not redrawn keeps the old value, F42; M80). The pixels are read through a copy, never
from the avatar canvas twice (gate finding G4): for each read a new canvas of the avatar's bitmap size, its context
made with `getContext("2d", { willReadFrequently: true })`, the avatar drawn into it by `drawImage`, and
`getImageData` of the copy — a second `getImageData` of one canvas prints the console warning «Canvas2D: Multiple
readback operations using getImageData are faster with the willReadFrequently attribute set to true», which the
console rule of LD-1 does not allow, and the copy prints none and reads the same values (F48). LD-5 the survey: the
first question at load, five taps to the result, «Назад» keeps the answer, «Не знаю» goes on, the whole survey by
keyboard; the lint after each of these states. LD-6 every fixture and five «Не знаю» in each language: the solution's
name and `not_suitable_when` or the no-match text, the heading and the ten items, «Описать идею» opening
`/how.html#describe-idea` with no request beyond the page's files; the lint at each question on the way and at each
result. LD-7 in ru the API answering 500, a body that is not JSON, never answering (held until `DEMO_TIMEOUT_MS`),
failing at once with no answer (the route aborts the request with `internetdisconnected`: no connection, F42),
refused, for the questionnaire and the result: the message of section 5 — `demo_failed` for an answer that is not
right, `demo_offline` for no answer and for no connection — with «Повторить», the answers kept, no exception; the lint
at each message and after «Повторить»; the console holds, once each, only the browser's line of the failed request —
«Failed to load resource: the server responded with a status of <status> …» for an answer, «Failed to load resource:
net::ERR_INTERNET_DISCONNECTED» for the aborted one, none for the held one (F27, F42; gate finding F4; M82). LD-8
after a whole pass with theme and language changes: `localStorage` only `sai-lang` and `sai-theme`, one word each;
`sessionStorage` and cookies empty; no answer in the address; the lint after each step of the pass. LD-9 the public set
(the open build on a temporary copy, served by `createApp` with `loadStaticSite(<output>)` and `PUBLIC_LANGS`): no link
to `examples.html`, `/examples.html` → the 404 page, RU and EN only, `?lang=kk` in Russian; on index, how and demo the
scene (the canvas inside `role="img"` with its name, and the text list) with the caption under it; on every page
`#test-mode` and `#ai-disclosure` visible with the output module's texts in ru and en; the demo result with the fixed
list in ru and en, and its «Описать идею» opening `/how.html#describe-idea` with that part on the screen (gate finding
F2; M78, M79); the lint at each page and at the result in ru and en; no console line but the 404 line.

**`e2e/stage.test.js`** (REQ-112 c6, c9) — ST-1 on index, how, demo: the canvas of non-zero size inside `role="img"`
with a name, the text list with the four stage words, four role titles and where «Вы» stands, the caption under the
scene. ST-2 every window: no page scroll; the stage inside the window; its `overflow-x` `hidden` or `clip`;
`data-figure` ≥ 20. In each language, the labels — the door sign, «Вы» and the four plates with each line element of a
plate — by decisions/0123 L3 (gate finding G7): **no label cut** (its `scrollWidth` not above its `clientWidth`) at
every moment the test reaches — at load on index, how and demo, on every animation frame of each walk, and after it —
and **no two labels overlap** (their boxes) when «Вы» stands: at load and after each walk (0123 V3; look 9.7: during a
walk at 390 «Вы» passes under each plate it crosses). The walks: on how the taps on the steps 1, 2, 3 and 4 in turn
(the door to desk 4), on demo the five answers of one pass (by look 9.13: the door to desk 2, to desk 3, no walk, to
desk 4, no walk at the result), each tap after the walk before it has ended. A walk is read in the page by the
test's own `requestAnimationFrame` loop, started before the tap: on each frame every label's `scrollWidth` and
`clientWidth` and the stage's `--you`, until the text list names the target and `data-frames` has not changed for
300 ms, with a deadline of 10 s that is red; a tap that starts a walk whose loop saw fewer than three values of
`--you` is red (the loop saw no walk). Measured on a trial page (F51): such a loop sees every frame of a walk, and a
label cut only while «Вы» walks (M93) is red on the frames and green at load and after the walk. ST-3 a step on how
and an answer on demo move «Вы» to the step table's desk (the text list says so after the walk), nothing else
moves it (`data-frames` still while nothing is tapped). ST-4 reduced motion emulated: «Вы» at the target at once. ST-5
`getContext` returning null and a drawing that throws (an init script): the text view, the page and the demo work, no
exception. ST-6 every request a file of `app/public` or a demo route; no console error and no CSP violation.

**`test/fixtures/browser.js`** (no test): `openBrowser(t)` (`chromium.launch({ channel: "chrome", args:
["--use-mock-keychain"] })`, closed in `t.after`), `newPage(browser, t, { port, viewport, colorScheme, reducedMotion })`
(a fresh context; a route that aborts and records every request outside `http://127.0.0.1:<port>/`; records every
console line with its level and location and every `securitypolicyviolation` by an init script, measured F26),
`serveLocal(t)` (node-main on port 0), `servePublicSet(t)` (the open build into a temporary folder, `createApp` on
`127.0.0.1:0`) and `shownTextFindings(page, lang) → Promise<string[]>` (the lint of the shown text of the LD tests,
above; one place, AP-014; gate finding G1).

Counts [P, from this catalogue]: new — unit 71 (PP 7, TX 8, FW 8, TC 5, IN 6, VD 4, PB 7, PO 4, OP 6, OS 7, OV 7,
NPM-7 1, CP-3 1), int 10 (DM 7, DP 2, NM-6 1), e2e 15 (LD 9, ST 6); with the build tag's 46 and 36 (F35): unit 117,
int 46, e2e 15. Test files: unit 25 (14 + 11), int 12 (10 + 2), pg 2, e2e 2, and the helper `fixtures/browser.js`.
The new tests have no loop and no subtest, so each file adds its number of `^test(` lines to «# tests» of its folder
(at the build tag `grep -c '^test('` gives unit 46 and int 34, and SC-2 of int is a loop of two: F35).

---

## 11. Replacement table of earlier guard tests

Measured, not inherited (AP-094, AP-112, AP-113), at the build tag `base/M1CODE-20261119-01-build`, the tree the build
starts from (decisions/0124 О13; gate finding F1): the guard tables of both blocks re-read against the files there,
the sketch's run of those tests (F37–F40), and a search of `tools/test` (no test reads `app/`, REQ-111 guard row (12)).
The fix round changed five of these files (F34): `npmrc.test.js` (its lines moved; its NPM-6 is the grep of the
selectors), `import-boundaries.test.js` (the file rule of IB-1), `vercel-build.test.js` (the closed second run and its
twins in VB-3), `ci-workflow.test.js` (its lines moved; new rules for every job) and `runbooks.test.js` (RB-1 reads
`app/README.md`). The line numbers below are those of the build tag. No prohibition is weakened: every changed rule
keeps or widens what it refused, and no changed file has fewer lines with `test(` or `assert.` than at the build tag.

| # | Guard test (file, place) | What it counts | Was → became |
|---|---|---|---|
| 1 | `app/test/unit/npmrc.test.js` `checkScriptFindings` (lines 122–152), the list `want` (lines 126–133, compared exactly at line 134), NPM-3 (line 292) | the check chain, split by ` && ` | six steps → the eight of 4.12 (`node scripts/vendored.js` and `node ../tools/src/picker/cli.js check content/sai-intake.json` after check-public); «check-public place» and «no \|\| or ;» stay; added: `test:e2e` exactly `node --test --test-concurrency=1 "test/e2e/**/*.test.js"` and in the selector loop; damaged copies without `vendored` and without `content` red (rows of NPM-3) |
| 2 | the same file, `INT_FILES` (lines 34–45), `PG_FILES` (line 46), NPM-5 (line 327); NPM-6 (line 351, the fix round's grep of the selectors over `app/test`) | a subset guard through `missingTestFiles`; the selector forms in every file under `app/test` | `INT_FILES` + `demo`, `demo-parity` (12; the title «10» → «12»); `PG_FILES` stays; a new list `E2E_FILES` `landing`, `stage` with the new NPM-7 in the same form (the name NPM-6 is the fix round's); NPM-6 no edit: it reads the new test files and helpers and the changed files of rows 1 and 5–12 too, comments and strings included, which hold no selector form (section 10; F49) |
| 3 | `app/test/int/node-main.test.js` `UNIT_FILES` (lines 18–33), NM-5 (line 168); not changed by the fix round | a subset guard | + `public-pages`, `texts`, `forbidden-words`, `theme-contrast`, `intake`, `vendored`, `public-build`, `port-parity`, `office-pure`, `office-stage`, `office-view` (25; the title «14» → «25»); NM-1 stays as it is (the new `index.html` keeps `<html lang="ru">` and the text, 4.3; measured on the sketch, F22, and at the build tag, F39); a new NM-6 (criterion 9) |
| 4 | the same file, NM-3, the escape `/css/` (line 137) | the 404 page for a folder path | no edit: `static.js` looks up exact files, `/css/` stays the 404 page with `app/public/css/` present (F22, F39) |
| 5 | `app/test/unit/import-boundaries.test.js` (the fix round's file) `fileFindings` (lines 924–931), IB-1 (lines 933–951), IB-2 (line 1658; `RED.length, 161` at line 1659) | the entries git tracks or would track under `app/` but `node_modules/` and `test/` (`gitEntries`): every link red, and under `app/server`, `app/api`, `app/worker` every file that is not .js red; every `.js` file by the import rules | was: every file that is not .js there red, so `server/vendor/picker-engine.d.ts` is red (F37: «a file that is not .js: server/vendor/picker-engine.d.ts», the one line over the whole sketch) → became the one narrow row of decisions/0124 О14: `fileFindings(entries, vendored)`, where a `.d.ts` that is no link, whose `.js` twin (the same path with `.d.ts` replaced by `.js`) is a plain file among the entries and the `file` of an entry of `app/vendored.json`, is no finding; IB-1 passes the `file` values of `app/vendored.json` (an empty list while the file is absent; an unreadable file throws, red); IB-2 gains the damaged copies of the row, each red with its finding — a second `.d.ts` without a vendored twin, a `.ts`, a `.d.ts` beside a `.js` that `app/vendored.json` does not list, the declaration as a link, the declaration whose listed twin is not in the tree, the declaration beside a twin that is a link, the suffix in another letter case (`.D.TS`), `.d.mts`, a `.d.ts` in `api/` with no twin there, the right pair with an empty list, and the same file name in another folder — `server/lib/picker-engine.d.ts` beside a plain `server/lib/picker-engine.js` under the list `[server/vendor/picker-engine.js]`, red with «a file that is not .js: server/lib/picker-engine.d.ts», which pins «the same path» (gate finding G3: a row that matches the twin by its file name in any folder is green against the other ten, M92, F47); `RED.length` stays 161 and the lines with `assert.` go 35 → 38 (F37; the eleventh copy is one more row of the same list, F47); nothing else of the file changes, and the import rules hold for every new `.js` file (F37). The pure-module rules live in `office-pure.test.js` |
| 6 | `app/test/unit/check-public.test.js` CP-2, the line `assert.deepEqual(checkText("js/a.js", "Math.random()"), [])` (line 62); not changed by the fix round | `Math.random` outside `office/` green | → red (`notDeepEqual`): `Math.random` is refused in any folder (criterion 10; REQ-112 guard row (2)); the `office/` line stays red |
| 7 | the same file, CP-2's lists `RED` (lines 22–42) and `GREEN` (lines 43–56) | planted items and twins | rows added: the 22 forms of criterion 10 to `RED` (each asserting its own label), the 16 twins to `GREEN`; CP-1 no edit (the real `app/public` clean; measured on the sketch, F22, F39); the CLI case keeps `a.html: word «handoff»` (its temporary folder, which has no texts module and no intake beside it, now also gives findings for those two; the test asserts exit ≠ 0 and its line, and both still hold); a new CP-3 (`el()`, section 10) |
| 8 | `app/test/unit/vercel-build.test.js` (the fix round's file) `build()` (lines 20–40), `closedRun()` (lines 59–79), VB-1 (line 81; the comparison of lines 95–104), VB-2 (line 112), VB-3 (line 119: the closed build, its second run and the twins of the fix round), VB-4 (line 320) | `runBuild`'s exit code and output | `build` and `closedRun` become `async` and `await runBuild(…)`, and the four tests are `async` and await them (C2; without it VB-1, VB-3, VB-4 are red and **VB-2 passes without proving**, F39); VB-1's «the output equals app/public byte for byte» → the output tree is `app/public` without `examples.html`, every file outside 4.11's list byte-equal (criterion 9, which replaces REQ-109 criterion 8's sentence by decisions/0123 О3); VB-4 → the real `app/public` is only read (`insideGitTree(PUBLIC)` stays true), and the closed build runs in place on a copy of `app/public` inside a temporary git working tree made by `git init -q` (IB-2's environment: no global or system git settings): exit 2, its line, the copy unchanged — so a broken closed refusal can replace only that copy (gate finding F8, the same shape as PB-4; F40); VB-2 and VB-3 keep their assertions; measured 4 of 4, lines with `assert.` 37 → 38 (F39); no comment or string of the changed file holds a selector form of NPM-6 (section 10): the sketch's «The real app/ is read only: it stands …» was hit, the reworded comment is not, and with this row and row 5 the whole unit folder is 47 of 47 and int 36 of 36 on the sketch (gate finding G5, F49) |
| 9 | `app/test/unit/ci-workflow.test.js` (the fix round's file) `PATHS` (lines 17–24, compared exactly at line 200) | the path list | the ten entries of 4.13 in their order |
| 10 | the same file, the jobs (line 268 `'["check","pg","docker"]'`) and the damaged copy «jobs» (lines 607–608: an added `e2e` is red) | the job names | `["check","pg","docker","e2e"]`; the damaged copy adds a job `extra` instead, still red |
| 11 | the same file, `DOCKER_STEPS` (lines 28–78, ordered pairs of a label and an exact line) | the docker job | one pair after «docker preview 307»: «docker demo questionnaire» and the line of 4.13 |
| 12 | the same file, `ciFindings` (line 157) | the rules of every job | added: the `e2e` job's first step is the line `run: ls -l /opt/google/chrome/chrome && /opt/google/chrome/chrome --version` (4.13, decisions/0124 О7), and the job has `working-directory: app` with `run: npm ci` and with `run: npm run test:e2e`; damaged copies without each red (rows of CIW-2); the per-job rules (timeout, exact node-version, `node -v`) and the fix round's rules («a hidden exit code»: `\|\|`, `continue-on-error`, `set +e`; «a negated command»; the image rules) already loop over every job and hold for the e2e job, which has `&&` only (no edit to them) |
| 13 | `app/test/unit/docker-files.test.js` DF-1, DF-2 | the Dockerfile and compose rules | no edit: the `COPY` lines are not pinned; the docker step of row 11 proves the intake in the image |
| 14 | `app/test/unit/vercel-config.test.js` VC-1…VC-3 | `vercel.json`, `.vercelignore` | no edit: one function, the routes table, `!content` kept; the tracer bundles the intake without `includeFiles` (F14) |
| 15 | `int/headers`, `logging`, `site-gate`, `api-entry`, `health`, `selfcheck`, `db-down`, `smoke-local`, `migrate`; `unit/smoke`, `headers-parity`, `body`, `db-config`, `node-floor`, `no-string-sql`; `unit/runbooks` (the fix round's file: RB-1 reads `app/README.md` at line 206) | the skeleton's rules; RB-1 the command forms of the runbooks and of `app/README.md` | no edit: the demo routes go through the same middlewares; `createApp` without `demo` keeps its routes (C10, F33); the README text of B3 keeps every lowercase `vercel` as `npx vercel@64.1.0 …` (4.12; gate finding F7) |
| 16 | `tools/test` (TR-4a…TR-4f, QS-*, the picker page tests, `pixel-office-layout`, `-office`, `-panels`, `-page` line 1071, CI-1…CI-8, E2K-*) | `tools/src`, `check.yml` | no edit: `tools/src` does not change (REQ-112 criterion 10; the fix round changed no file of `tools/`, F34); `npm run traces` scans the new files |

Decision 0097's boundary for REQ-066 criterion 3 and REQ-071 reads, for `app/`, «no import and no served copy of the
owner's office» (0123 О18): IB-1 refuses an import outside `app/public`, VD-2 and PO-1 prove the files are ports, and
the two headers are the only places that name the originals' paths. The picker rule (`grep -rniE 'pixel-office|pixel
office' tools/src/picker/public/` empty) stays for `tools/src/picker/public`, which does not change.

---

## 12. Build sub-steps

FRONTEND-DEV writes F1–F7 (with the translation launches F1k, F1e, F2k, F2e), BACKEND-DEV B1–B6, TEST-DESIGNER T1–T4 at
step 5. Two developers work at the same time in different files (WF-02 step 2); the order below keeps every saved
file consistent. Until T1 the new tests do not exist, so each sub-step's own check is the static part — `npx prettier
--check . && npx eslint . --max-warnings 0 && npx tsc --noEmit -p jsconfig.json && node scripts/check-public.js` (and
the new steps once they exist) — plus a driver outside the project that imports the new modules by absolute path, and
`cd tools && npm run traces`. «Red after it» lists the tests of today that may be red, each named `EXPECTED_RED` in the
developer's `result.issues` with this row (WF-02 step 2) until TEST-DESIGNER's sub-step that changes it.

| # | Who | Files | Own check | Red after it |
|---|---|---|---|---|
| F1 | F | `public/shared/i18n/lang.js`, `public/shared/i18n/texts.js` (every key of 4.1, ru values), `public/shared/text-rules.js` | static part; a driver: the key list of 4.1, the exact values, placeholders, the picker's text rules on the ru values | none (check-public reads only today's rules) |
| F1k, F1e | F (one launch each) | the kk values, then the en values of `texts.js` | as F1 per language | none |
| B1 | B | `server/vendor/picker-engine.js`, `picker-engine.d.ts`, `vendored.json`, `scripts/vendored.js`, `jsconfig.json` | `node scripts/vendored.js` → 0 and its line; `tsc` exit 0 (F5, F38); `node --test test/unit/import-boundaries.test.js` → only IB-1 red, with exactly the one line «a file that is not .js: server/vendor/picker-engine.d.ts» (F37) | IB-1 (row 5): `EXPECTED_RED` until T1 lands the row of decisions/0124 О14 |
| F2, F2k, F2e | F | `content/sai-intake.json` (ru, then kk, then en) and `content/sai-intake.answers/*.json` | `node ../tools/src/picker/cli.js check content/sai-intake.json` → 0 (after F2e); a driver of the combinations (F8) | none |
| B2 | B | `scripts/word-lists.js`, `scripts/check-public.js` (4.10) — after F1e and F2e, since it reads the texts module and the intake | `node scripts/check-public.js` → 0 on the real files and ≠ 0 on the planted copies of FW-7 (a driver) | CP-2's `js/` line (row 6): `EXPECTED_RED` until T1 |
| B3 | B | `package.json` (the chain, `test:e2e`, `playwright-core`), the lockfile, `README.md` | `npm ci`; the static part; `node --test test/unit/runbooks.test.js` → RB-1 and RB-2 green on the new README (4.12: every lowercase `vercel` as `npx vercel@64.1.0 …`; gate finding F7); `npm run test:unit` → red exactly NPM-3 (this sub-step), IB-1 (from B1) and CP-2's `js/` line (from B2), each `EXPECTED_RED` until T1 (gate finding G6; measured 43 of 46 with B1's files, B2's `Math.random` rule and this chain, F50) | NPM-3 (row 1) until T1 |
| F3 | F | `css/tokens.css`, `css/site.css`, `css/noscript.css`, `js/dom.js`, `js/theme.js` | static part; a driver: the contrast pairs of look 6.3 from `tokens.css`; the pure `theme.js` in Node | none |
| B4 | B | `server/routes/demo.js`, `routes/index.js`, `http/errors.js`, `app.js`, `node-main.js`, `Dockerfile` | `PORT=0 node server/node-main.js`; `curl` of the rows of F13 on the app host; a driver of `createFunctionApp` with `PUBLIC_LANGS` | none (F22: int 36 of 36 with the sketch route) |
| F4 | F | `office/grid.js`, `office/sim.js` (ports with headers, the rename, JSDoc), `office/stage-scene.js`, `office/draw.js` | static part (the 68 `tsc` errors of F23 gone); the parity driver of F24 (0 different); a recording-context driver of `drawScene` at the three sizes | none |
| B5 | B | `scripts/public-set.js`, `scripts/vercel-build.js` (open branch, `async`) — on the build tag's file, whose closed branch is the fix round's | a driver of `runBuild` twice in place on a temporary copy outside any git tree (F17), and once in place on a copy inside a temporary git working tree made by `git init -q`, open and closed (F40) — never on the tree's own `app/public`, so a broken refusal cannot rewrite this run's uncommitted pages and texts (gate finding F8); the planted shapes of PB-6 through the same driver on temporary copies — (a)–(i) refused with the file (and for (a)–(h) the line) and the copy byte-equal, (j) refused with its file (gate finding G2, F46); **every filter mutant in a throwaway clone only** (F20) | VB-1, VB-2 (passes without proving), VB-3, VB-4 (row 8) until T1 |
| F5 | F | `office/labels.js`, `office/view.js` | a driver of `createStageView` with fakes (frames per walk, hidden, reduced motion) | none |
| B6 | B | `.github/workflows/app.yml` (4.13) | `node -e` reading the YAML lines against 4.13 | CIW-1 (rows 9–12) until T1 |
| F6 | F | `index.html`, `how.html`, `examples.html`, `404.html`, `js/pages/landing.js` | `PORT=0 node server/node-main.js`; the pages in a real Chrome without a window at the three windows (WF-04 step 2); `node scripts/check-public.js` → 0 | none (NM-1 keeps its bytes rule, 4.3) |
| F7 | F | `demo.html`, `js/pages/demo.js` | the demo in a real Chrome: five taps, «Назад», «Не знаю», the failures of E1–E3 with a stopped server | none |
| T1 | T | the changed files of section 11, rows 1, 5 and 6–12 (the chain and `test:e2e` of NPM-3, the row of decisions/0124 О14 in `import-boundaries.test.js`, check-public's rows and CP-3, the `await` of the VB tests and VB-4 on a temporary git tree, the ci-workflow rows); `fixtures/browser.js` | `npm run check` green, NPM-6 included: no selector form in a changed or new file, comments included (section 10; gate finding G5, F49) | — |
| T2 | T | the unit files of REQ-111 (public-pages, texts, forbidden-words, theme-contrast, intake, vendored, public-build), and their names in `UNIT_FILES` (row 3) in the same sub-step | `npm run check` green | — |
| T3 | T | the unit files of REQ-112 (port-parity, office-pure, office-stage, office-view) with their `UNIT_FILES` names; the int files (demo, demo-parity) with their `INT_FILES` names (row 2) and NM-6 | `npm run check` green | — |
| T4 | T | `e2e/landing.test.js`, `e2e/stage.test.js` with `E2E_FILES` and NPM-7 (row 2); the mutant series (section 13) in a fresh clone; the commands of criteria 11 and 16 (the diff from `base/M1CODE-20261119-01-build`) | `npm run check` green; `npm run test:e2e` green three times | — |

The look is built as its edit of decisions/0123 J3, J5 and J7 (before DESIGN-QA) leaves it: F3, F4 and F6 take the
edited look when it is there; an edit that lands after them is applied by a separate handoff with its own checks
(WF-02, CODE-FIXER), never folded silently into another sub-step. Each sub-step can be checked alone; a presence guard gains a file's name in the sub-step that writes the file, so no guard is red between T1 and T4. The translation launches and the readers' rounds of step 8 follow WF-02 step 8
item 6; a kk line whose edits differ after two rounds goes `FOR_NATIVE_SPEAKER` (AP-114), kk stays off production.

---

## 13. Mutants

«Measured» = applied on the sketch of section 17 (one at a time, the file restored from its saved text, never `git
checkout`); the others are designed for the gates (CODE-DESIGN-VALIDATOR ≥ 10, TEST-DESIGN-VALIDATOR ≥ 20, ARCH §18).
A mutant that removes the git-tree refusal rewrites the `app/public` of the tree it runs in when a driver or a test
runs the build on that tree's own folder (F20); PB-4 and VB-4 now run the build on a copy inside a temporary git tree,
so under such a mutant they turn red and the tree's `app/public` stays byte-equal (F40). Such a mutant is still
applied only in a throwaway clone, never in the project or in the clone that holds the other mutants' sources.
«Measured» for M06, M78, M79 and M83–M87 means applied on the sketch at the build tag (section 1.1); for M89–M92
applied on the sketch of rework 01e at the build tag (section 1.2: F46, F47), and for M88 and M93 on trial pages in
Chrome (F45, F51).

| # | Mutant | Caught by | Status |
|---|---|---|---|
| M01 | one `order_` key left in the output texts | PB-1 | measured: 1 key found |
| M02 | one kk value left | PB-1 | measured: 6 values found |
| M03 | `examples.html` left | PB-1 | measured: an order value found in it |
| M04 | the footer region not cut | the build's own guard (exit 1), PB-1, PB-6 | measured: exit 1 |
| M05 | the output texts module names its input's hash (a second run differs) | PB-3 | measured: run 2 differs (the plain «rewrite every run» is equivalent: the rendering is a fixed point, F20) |
| M06 | the git-tree refusal of the open build removed | PB-4 | measured at the design tag (F20): exit 0 and the tree's `app/public` rewritten; measured again at the build tag with PB-4's form of section 10 (F40): PB-4 red, the tree's `app/public` byte-equal |
| M07 | the kk button region kept while kk is closed | PB-1 (`data-lang="kk"`), LD-9 | designed |
| M08 | `PUBLIC_LANGS` holds kk | PB-1, PB-5, DM-2 | designed |
| M09 | `createFunctionApp` passes `SOURCE_LANGS` | DM-2 | designed |
| M10 | the gates-open build rewrites the texts module anyway | PB-7 | designed |
| M11 | the questionnaire passes the whole question object | DM-1 (the planted field) | designed |
| M12 | the result keeps `score` or `ranking` | DM-3 | designed |
| M13 | a body with a second key accepted | DM-4 | designed |
| M14 | `null` read as «Не знаю» | DM-4 (`wrong_kind`) | designed |
| M15 | the language read from `Accept-Language` | DM-2 | designed |
| M16 | an engine exception not caught | DM-6 | designed |
| M17 | the route writes the body into the log line | DM-7 | designed |
| M18 | the route calls the database adapter once or writes a row | DP-2 | designed |
| M19 | `GET /api/demo/result` answered | DM-5 | designed |
| M20 | the demo imports the engine from `tools/` | IB-1, VD-2 | designed |
| M21 | one byte of the copy changed | the step `vendored`, VD-3 | designed |
| M22 | a stale recorded hash | VD-3 | designed |
| M23 | a second `.js` file in `server/vendor` | VD-2, VD-3 | designed |
| M24 | `jsconfig.json` excludes `server/vendor/**` | VD-4 | designed |
| M25 | the declaration names an export the copy lacks | VD-4 | designed |
| M26 | the lint compares substrings | FW-5 («ценность», «дневник», «holiday» …) | designed |
| M27 | П matches «1100 %» | FW-4 | designed |
| M28 | one form dropped from a list | FW-1, FW-2 | designed |
| M29 | the lists applied across languages | FW-3 | designed |
| M30 | check-public skips the intake | FW-7 («гарантия» in an option) | designed |
| M31 | check-public skips the kk values | FW-7 («теңге») | designed |
| M32 | the `₸` rule dropped | FW-7 | designed |
| M33 | `Math.random` refused only under `office/` | CP-2 (row 6) | designed |
| M34 | the `setAttribute("style"` form dropped | CP-2 | designed |
| M35 | a CSSOM write outside the closed list (`stage.style.left = …`) | PP-6 | designed |
| M36 | `pickLang` accepts «RU» | TX-7 | designed |
| M37 | `pickLang` prefers the stored value to `?lang=` | TX-7 | designed |
| M38 | a key without kk | TX-2, check-public | designed |
| M39 | `MAX_WORDS` 19 in the shared text rules | TX-6 | designed |
| M40 | «Dark» (capitalised) read as dark | TC-1 | designed |
| M41 | the cycle auto → dark | TC-1, LD-4 | designed |
| M42 | the light `--btn` back to `#e0731f` | TC-3 | designed |
| M43 | `theme.js` touches `document` at load | TC-5 | designed |
| M44 | the BFS steps «down before right» | PO-3 | measured: 20 458 different («left before right» is equivalent here, F25) |
| M45 | the wait of `after` dropped | PO-4 | measured: 1 different |
| M46 | the two kinds swapped on a tie | PO-4 | measured: 1 different |
| M47 | `PAUSE` 0.7 or `SPEED` 3.5 | PO-4 | measured: 8 different each |
| M48 | one hex digit of a header's sha256 changed | PO-1 | designed |
| M49 | `sim.js` keeps the kind `handoff` | PO-2, CP-1 | designed |
| M50 | `stage-scene.js` reads `Date.now()` | OP-2, OP-3 | designed |
| M51 | `draw.js` sets `globalAlpha` | OS-2 | designed |
| M52 | `draw.js` draws a plate's text by `fillText` | OS-2 | designed |
| M53 | the light alpha by `toFixed(4)` of a float | OS-5 (0.1093 ≠ .1094) | designed |
| M54 | a bad colour token throws | OS-6 | designed |
| M55 | a frame on every clock tick | OV-1 | designed |
| M56 | no hidden check | OV-3 | designed |
| M57 | a walk with reduced motion | OV-4 | designed |
| M58 | the tokens read on every frame | OV-5 | designed |
| M59 | no frame on a state change with no walk | OV-6 (0123 О15) | designed |
| M60 | `view.js` calls `fetch` | OP-6 | designed |
| M61 | `stage-scene.js` imports `view.js` | OP-1, OP-5 | designed |
| M62 | a page without the robots `meta` | PP-2 | designed |
| M63 | the relative address `css/site.css` | PP-3 | designed |
| M64 | `how.html` without `#test-mode` | PP-4, LD-1 | designed |
| M65 | a link to `examples.html` outside a region | PB-6, the build's guard | designed |
| M66 | the answers kept in `localStorage` | LD-8 | designed |
| M67 | «Описать идею» sends a request | LD-6 | designed |
| M68 | the demo requests with no time limit | LD-7 (the test's own deadline ends it; it never hangs the run, AP-116) | designed |
| M69 | the language switch reloads the page | LD-3 | designed |
| M70 | the stage does not clip its canvas | ST-2 | designed |
| M71 | the `e2e` job without `npm run test:e2e` | CIW-2 | designed |
| M72 | the `e2e` job without `timeout-minutes` | CIW-2 | designed |
| M73 | `tools/src/picker/**` dropped from the paths | CIW-2; RELEASE-VALIDATOR's removal check | designed |
| M74 | the docker demo step dropped | CIW-2 | designed |
| M75 | the chain without the step `content` | NPM-3 | designed |
| M76 | `test:e2e` with `--test-only` | NPM-3 | designed |
| M77 | the e2e folder emptied («# tests 0» passes) | NPM-7 | designed |
| M78 | the region cut greedy, from its opening marker to the last end marker of its kind in the file (the gate's V01; on the sketch of step 01c `[\s\S]*?` → `[\s\S]*`) | PB-2 (strict comparison), PP-7, LD-9 | measured (F41): every negative check green; PB-2 red on `index.html` and `how.html`, PP-7 red |
| M79 | an `order` region opened before `#ai-disclosure` in the footer of `index.html` | PP-7, PB-6 (content rule), LD-9 | measured (F41): the negative checks and PB-2 green; PP-7 and the content rule red |
| M80 | the avatars drawn only at load (no redraw after a change of theme) | LD-4 | measured on a trial page (F42): with no redraw the dark read keeps the light value |
| M81 | `el()` sets an attribute named `style` (or `onclick`) when it is asked to | CP-3 | designed |
| M82 | a `fetch` that rejects shows the server-error message (`demo_failed`), or no message | LD-7 (the aborted request) | designed (the browser's behaviour measured, F42) |
| M83 | the IB-1 row allows every `.d.ts` | IB-2 (a second `.d.ts` without a vendored twin) | measured (F37) |
| M84 | the IB-1 row allows a `.d.ts` beside any `.js`, listed in `app/vendored.json` or not | IB-2 (`server/lib/util.d.ts`) | measured (F37) |
| M85 | the IB-1 row read before the link rule | IB-2 (the declaration as a link) | measured (F37) |
| M86 | the IB-1 row asks only that `app/vendored.json` lists the twin, not that it is in the tree | IB-2 (the declaration alone) | measured (F37) |
| M87 | the git-tree refusal of the closed build removed | VB-4 (on its temporary git tree) | measured (F40): VB-4 red, the tree's `app/public` byte-equal |
| M88 | a page script writes a list form only after a tap: (a) «бесплатно» into the result, (b) «минут» into a failure message, (c) a form into the live line only | (a) LD-6, (b) LD-7, (c) LD-5 and LD-6 — the lint of the shown text after each state (gate finding G1); LD-1, check-public and FW-7 do not see it | measured on a trial page (F45): no finding at load, the form found after the tap in each of (a)–(c); `checkText` of the served-file rules finds nothing in the script |
| M89 | the cut with no pairing check: each opening marker to the nearest end marker of its kind, the markers read only by the guard of the output (the cut of step 01c) | PB-6 (a)–(c), (f), (g) by no refusal, (d), (e), (h) by a refusal after the first write | measured (F46): no refusal at (a), (b), (c), (f), (g) — the home link, `</main>` and `#ai-disclosure` cut at (a) and (f), the home link at (b), the how panel's order text kept at (g); the refusals of (d), (e), (h) after the copy changed |
| M90 | the markers read only during the cut, after the texts module is rewritten and `examples.html` removed (the protection after the action) | PB-6 (a)–(h): the copy's names and bytes changed | measured (F46): every marker plant refused, each after the first write |
| M91 | a marker-like comment that is not one of the four forms read as text | PB-6 (g) | measured (F46): (g) not refused, the how panel's order text kept in the output |
| M92 | the IB-1 row matches the `.js` twin by its file name in any folder | IB-2 (`server/lib/picker-engine.d.ts` beside `server/lib/picker-engine.js`, gate finding G3) | measured (F47): green against the other ten copies, red at this one |
| M93 | a label cut only while «Вы» walks (a rule that narrows the label during a walk) | ST-2 (the frames of a walk; decisions/0123 L3) | measured on a trial page (F51): 199 of 224 samples cut during the walk, none at load or after it |

---

## 14. The low findings of decisions/0123 that this design names (J1, J6, V4)

- **The phone step row and the length budget of its sub (J1).** Below 760 px each step of look 7.8 is a row: the
  `1.5·--px` left bar, `padding-left` 10, the 28 × 28 number square, gap 10, then a column of the stage word (14/800)
  over the sub (13/400). At 320 × 568 (gutter 12, `--px` 2) the column is 296 − 3 − 10 − 28 − 10 = **245 px** [C];
  each `stage_n_sub` is one line in 245 px at 13/400 in each language, the word one line at 14/800 [P]. Measured
  candidates fit: «Вы проверяете и принимаете работу» 233.7, kk «Сіз жұмысты тексеріп, қабылдайсыз» 232.3 (F29).
- **The blocks of the result while it loads or fails, and their order (J6).** In reading order: h2
  `demo_result_title`, sub `demo_result_sub`, the receipt (its header row and, in its body, the on-cream message of look
  7.18: `demo_putting` while loading; `demo_error`, `demo_failed` or `demo_offline`, `demo_what_now`, «Повторить», «<to
  the landing>» on a failure), then the «Описать идею» panel, then the answer chips. No list is shown until a result
  arrives; then a recommended kind appends its two lists and the fixed list after the chips, and a no-match result puts
  the fixed list right under the receipt (look 8.4 state 4) [P]. The scene stays in the result state throughout (look
  9.13).
- **The look of the noscript block of `demo.html` (J6).** The message block of look 7.18 on `--paper` inside the
  question panel's frame, in the place of the question panel: line 1 `demo_needs_js` (18/800 `--ink`), line 2
  `demo_needs_js_text` (16 `--ink2`), and the link «<to the landing>» (`lnk`, `--acct`, → `/`); no «Повторить» (nothing
  to retry) [P]. Its static text is Russian.
- **The length budget of the tagline on the door sign (J1).** The sign is `34·s` wide with 2 px padding (styles.css:63
  of the sample), the tagline 10/400 and hidden at `s = 2` (look 9.7): one line in **98 px** at `s = 3` (132 px at `s =
  4`) in each language, never cut or shrunk [C from the sample's sign]. Measured: «команда ИИ-агентов» 105 and kk
  «ЖИ-агенттер командасы» 126.5 would not fit at `s = 3`; «AI agent team» 66.8 would (F29). The matrix windows have no
  `s = 3`, so DESIGN-QA measures the longest tagline of each language against 98 px (AP-089).
- **The neutral constant for a bad palette value (V4).** A colour token that is not `#rrggbb` is drawn as
  `NEUTRAL_COLOUR` `#808080`; a strength that is not a number 0–1 becomes `NEUTRAL_STRENGTH` 0, so every fill of the light
  layer has alpha 0. OS-6 asserts: no exception; every fill that would have used the bad colour uses `#808080`; with a
  bad strength every light-layer `fillStyle` is `rgba(<dim>, 0)` [P].

---

## 15. Quality bar

| Item | Applicable? | How it is met |
|---|---|---|
| Q1 | yes | every change belongs to REQ-111 or REQ-112; every criterion has its test or command (section 9) |
| Q2 | yes | the gates of WF-02 and WF-04; the facts of section 1 and the trials of section 17 are for CODE-DESIGN-VALIDATOR to repeat on a fresh clone of the tag |
| Q3 | yes | every fact has its command and output; what was not measured is named (F31, the platform's builder, the runner's Chrome) |
| Q4 | yes | one check command `cd app && npm run check` with the steps `vendored` and `content` (ARCH §3); `test:e2e` in the job `e2e`; the tools check as it is |
| Q5 | yes | 96 new named tests; failure tests compare the state before and after (PB-4, PB-6's refusals of the markers and of the texts module, VB-4, DP-2, DM-4, VD-3); the public set is tested for what it keeps as well as for what it leaves out (PB-2, PB-6, PP-7, LD-9); the shown text is linted in every state an LD test reaches (G1), the labels on every frame of a walk (ST-2, G7) |
| Q6 | yes | no skip, todo or only (the fix round's NPM-6 greps every line of every file under `app/test`, comments included, F49); no `\|\| true` in the chain or the jobs (NPM-3, CIW-1); no rule weakened (section 11; the one IB-1 row of decisions/0124 О14 lets exactly the vendored declaration stand, with its damaged copies); the presence guards and «# tests» per folder (NPM-5, NPM-7, NM-5) |
| Q7 | yes | no secret in a page, a text, the intake or a test; REQ-108 criterion 13's grep reads all of `app/` |
| Q8 | not applicable | no tenant, account or customer data; the demo stores nothing (DP-2, LD-8) |
| Q9 | yes | the demo makes no database call (DP-2); no SQL is added |
| Q10 | yes | E1–E21: the page's time limit and a request that fails at once (no connection), the 503 of a broken intake, the 400s, the storage that throws, the canvas that fails, the build that fails closed — before its first write when it cannot pair the markers or import the texts module (E14, E15, F46) |
| Q11 | not applicable | the server calls no outside address; the pages call only their own origin (`connect-src 'self'`, the e2e URL guard) |
| Q12 | yes | the choices of section 2 go to ORCH's record (section 18); nothing departs silently from 0123, 0118, 0097, 0084, 0083 |
| Q13 | yes | the process errors of this step are named for the error journal (section 16): the mutant that rewrites its own tree, the async change that leaves a test passing without proving, the CSP fact of the look; and those of gate pass 1: a design measured on its base tag while a parallel fix round that lands first changes its guard files, a filter tested only for what it leaves out; and those of gate pass 2: a guard of a cut that looks only at its output, a sketch test measured alone and not under the check's other guards, a test read that prints a console line under a console-silence rule, a criterion's «every state the test reaches» mapped to one test of the load |
| Q14 | yes | the handoff is closed by the command; the statuses are ORCH's and DOC-UPDATER's |
| R1 | yes | no merge, push or tag; the look release waits for the owner's «похоже» (G21) |
| R2 | yes | the scene is an illustration: no event, time, count or status; nothing moves but «Вы» after a tap (OP-6, OV-1, ST-3) |
| R3 | not applicable | decision 0033; no photos of people |

---

## 16. Documents that change, and what becomes outdated outside the project

Written by this run: `app/README.md` (4.12). Not changed: the root `README.md`, `CLAUDE.md`, `tools/README.md`,
`STATE.md`, `PLAN.md`, the runbooks.

For ORCH and DOC-UPDATER (outside the files of this run):

- `docs/program/public-v1/PROGRESS.md` «Plan amendments» — rows for: the third style sheet `noscript.css` (О1); the
  `async` `runBuild` (О2); the closed CSSOM list as a test (О5); the e2e job's Chrome path (О7); ARCH §11.4 «`fillRect`/
  `fillText`» — the stage uses `fillRect` only (already 0123 V6).
- decisions/0001 — the Addition for `playwright-core` 1.64.1 (Apache-2.0, 2026-10-14) at the build (0118 О1, 0123 О10).
- REQ-109 criterion 8's sentence and REQ-108 criterion 11's two literals — the micro-amendment of 0123 «Order» (2).
- REQ-108 criterion 2's count reference (gate finding F10; question О15). The criterion compares «# tests N» of each
  test step with «the test catalogue of the run — section 13 of docs/design/REQ-108-109-app-skeleton.md, with every
  test that a later step of the run names in its handoff as added or removed». That literal describes the tree of the
  skeleton run only: the fix round already moved unit to 46 (its NPM-6, F35), and this run moves unit to 117, int to
  46 and adds e2e 15 (section 10), so read at a later commit it would not hold (AP-133). Proposed for ORCH, for the
  micro-amendment that follows this run (or M1AMEND-20261119-01 if ORCH widens it): the reference reads «the test
  catalogues of the runs whose changes the tree holds — section 13 of the skeleton design, the tests that the fix round
  of the skeleton named (NPM-6), and section 10 of docs/design/REQ-111-112-public-landing.md — with every test that a
  later step of those runs names as added or removed»; until it is amended, a re-check of REQ-108 criterion 2 reads
  the counts at the commit at which REQ-108 was released (d87b3d1: unit 46, int 36, F35). The README sentence of 4.12
  follows the same reading.
- `docs/design/V1-public-look.md` 5.1 item 3 — «the CSP refuses both»: `style.cssText` is not refused by Chrome 157's CSP
  (F26); the ban is a rule of the code (О11; for the look edit of J3, J5, J7).
- The error journal (Q13), candidates: a mutant that removes a guard of the real working tree destroys the tree it runs
  in, so such a mutant runs only in a throwaway clone (F20); a function that becomes `async` leaves a test that asserts
  only «≠ 0» passing without proving (F21, AP-153's kind); a sketch file was moved to the system temporary folder by a
  shell fallback and moved back at once (section 17; AP-156's kind). From gate pass 1 (its issue I5): a design
  measured on its base tag while a parallel fix round that lands first changes the same guard files — its replacement
  table, its test names and its counts are measured again on the tree the build starts from (AP-068 and AP-112, with
  a parallel run; this rework, F34–F40); a filter tested only for what it leaves out lets an over-cut through — its
  test also proves what the output keeps (V01, F41). From gate pass 2 (its issue I5, next free number AP-164 by
  decisions/0123's Addition): the over-cut of gate pass 1 was fixed against its own probe, the greedy cut, and the
  build's guard was not tried against the other ways to over-cut — a guard of a cut reads the pairing of its input
  before it cuts, not only what its output leaves (AP-162's kind; G2, F46); a sketch test was measured alone, not
  under the check's other guards, and a comment of it was hit by the selector grep (G5, F49); a read of the test
  (`getImageData` twice) prints a console line under a rule that allows only declared lines (AP-159's kind; G4, F48);
  a criterion that names a scope («every state … that the test reaches») was mapped to one test that covers the load
  only (AP-126's kind; G1, F45).

---

## 17. The sketch (for `result.prototype`) and the trials

`<outside the project>/m1code-02/` holds: `clone/` — a fresh clone of the tag with the sketch: `app/server/vendor/`
(the copy and a declaration), `app/content/` (the draft intake and seven fixtures), `app/public/shared/i18n/{lang,texts}.js`
(a small texts module with `order_` keys), `app/public/{index,examples}.html` (regions), `app/public/office/{grid,sim}.js`
(the raw ports), `app/public/css/noscript.css`, `app/server/routes/demo.js` with its wiring, `app/scripts/{word-lists,
public-set}.js` and an `async` `vercel-build.js`; `rmcheck/` (the clone with every unlisted path removed, F15); `pw/`
(`playwright-core` 1.64.1); `nft/` (`@vercel/nft` 1.10.0); `trials/` — the scripts below and the saved sources of the
mutants; logs of the runs. The sketch is a measuring tool, not the build: the developers write the files from this
design. Where it differs (the design wins): the texts module has 8 keys, the ports have no JSDoc, the demo route has
no `INTAKE_FILE` type, the sketch's `createFunctionApp` reads the intake through a probe module.

The trials, each repeatable on a fresh clone of the tag (scripts of `trials/`; outputs in section 1):

| Trial | Steps | Output |
|---|---|---|
| T-01 baseline | `cd app && npm ci && npm run check` | F3 |
| T-02 vendored and tsc | copy the engine, add a declaration, run `tsc` with three `exclude` forms, `prettier`, `eslint`, `check-public` on the folder | F5, F6 |
| T-03 intake | `make-intake.mjs <clone>/app`; `node ../tools/src/picker/cli.js check content/sai-intake.json` (and with two arguments); `combos.mjs` | F7–F10 |
| T-04 lint | `lint-trial.mjs <clone>/app` over `scripts/word-lists.js` | F11, F12 |
| T-05 public set | `make-public-sketch.sh <clone>/app`; `public-build.mjs <clone>/app <work>` (two runs in place on a copy, the git-tree run, the closed branch twice) | F17–F19 |
| T-06 filter mutants | the six mutants of F20 on saved copies of `public-set.js` and `vercel-build.js`, each restored by `cp` | F20 |
| T-07 today's tests on the sketch | `node --test "test/unit/**/*.test.js"`, `node --test --test-concurrency=1 "test/int/**/*.test.js"` | F21, F22 |
| T-08 ports | copy the originals with the header and the rename (`sed`), `tsc`, `eslint`, `check-public` | F23 |
| T-09 parity | `parity.mjs <clone>`; the port mutants on saved copies | F24, F25 |
| T-10 CSP page | a trial page and script under `app/public`, `csp-trial.mjs <clone>/app <pw>` (five contexts) | F26 |
| T-11 console and timing | `console-404.mjs`, `e2e-timing.mjs`, `measure.mjs` | F27–F29 |
| T-12 demo routes | `demo-trial.mjs <clone>/app` | F13 |
| T-13 tracer | `nft.mjs <clone>/app <nft>` | F14 |
| T-14 path list | `rmcheck/`: remove every path outside 4.13 (`.git` kept), run the content step, the hashes, the imports, `parity.mjs`, unit and int | F15 |
| T-15 package | `npm install --save-dev --save-exact --before=2026-11-05T00:00:00Z playwright-core@1.64.1`; `node --test test/unit/npmrc.test.js` | F16 |

Two slips of the trials, named (Q13): the mutant of F20 without the git-tree refusal rewrote the sketch's own
`app/public` (written again from `make-public-sketch.sh`, then measured again with the same results); a shell fallback
moved the sketch's declaration file into the system temporary folder for a moment (an `mv` whose first target was that folder), moved back at once,
nothing of the project involved.

**The rework's sketch (step 01c).** `<outside the project>/m1c/` holds: `clone/` — a fresh clone of
`base/M1CODE-20261119-01-build` with the sketch above carried onto it (section 1.1), `app/vendored.json`, the open
branch added to the build tag's `vercel-build.js`, the mutant copy `scripts/public-set-greedy.js` and the sketch test
`test/unit/pb4-sketch.test.js`; `cloneb/` — a second fresh clone with only the byte copy, its declaration,
`app/vendored.json`, the `exclude` and one importer (F38); `f2pages/` and `f2pages-m79/` — the pages of F41;
`trials/` — `ib-row.py` (the IB-1 row of section 11 row 5 and its four mutants), `vb-row8.py` (row 8),
`ps-positive.mjs` (the oracle of F41), `f4f5-trial.mjs` (F42); `f6/` — the stand-in and the two one-line scripts of
F43; the saved copies of every file a trial changed, and the logs. Every trial is repeatable on a fresh clone of the
build tag:

| Trial | Steps | Output |
|---|---|---|
| T-16 baseline at the build tag | `cd app && npm ci && npm run check`; the two diffs of F36 | F34–F36 |
| T-17 declaration and IB-1 | carry the sketch, add `app/vendored.json`; `node --test test/unit/import-boundaries.test.js` as it is, then `python3 ib-row.py <app> <none\|any-dts\|any-twin\|link-late\|no-tree>` on a saved copy each time; on `cloneb/` `tsc` with and without the declaration, then `npm run check` with the row | F37, F38 |
| T-18 the fix round's tests on the sketch | `node --test "test/unit/**/*.test.js"`, `node --test --test-concurrency=1 "test/int/**/*.test.js"`; `python3 vb-row8.py <app>` on a saved copy, then `node --test test/unit/vercel-build.test.js` | F39 |
| T-19 the refusals on a temporary git tree | `node --test test/unit/pb4-sketch.test.js test/unit/vercel-build.test.js`; each refusal removed from a saved copy of `vercel-build.js`, the test run again, the hash of every file of the clone's `app/public` before and after | F40 |
| T-20 what the public set keeps | `node ps-positive.mjs <public-set.js> <pages> <work>` with `scripts/public-set.js` and `f2pages/`, `scripts/public-set-greedy.js` and `f2pages/`, `scripts/public-set.js` and `f2pages-m79/` | F41 |
| T-21 the browser facts | `env -i PATH=… HOME=<scratch>/home TMPDIR=<scratch>/tmp node f4f5-trial.mjs <playwright-core dir>` | F42 |
| T-22 the Chrome step | `bash --noprofile --norc -eo pipefail step.sh` and `step2.sh` (the one line of 4.13 with a stand-in path and a missing path); `gh run view 44483031561 --log` (read only) | F43 |

**The rework's sketch (step 01e).** `<outside the project>/m1e/` holds: `clone/` — a fresh clone of
`base/M1CODE-20261119-01-build` with the 32 sketch files of step 01c carried onto it (not its two changed test files:
the trials apply rows 5 and 8 to the build tag's files), its `app/scripts/public-set.js` rewritten by 4.11 of this
rework (`readRegions`, `stripRegions` by the regions read, the two refusals of step (1), step (2) before the first
write), and the mutant copies `public-set-nopair.js` (M89, the sketch of step 01c), `public-set-m90.js` and
`public-set-m91.js`; `b3/` — a second fresh clone with B1's files, B2's `Math.random` rule and B3's chain (F50);
`f2pages/` and `f2pages-m79/` — copies of the pages of F41; `trials/` — `ps-pairing.mjs` (the thirteen planted
shapes on every variant), `ps-equal.mjs`, `vb-pairing.mjs`, `ps-positive.mjs` (of step 01c), `ib-row.py` (of step
01c, with the damaged copy of G3 and the file-name mutant), `vb-row8.py` (of step 01c) and `vb-row8-g5.py` (its
comment reworded), `g147-trial.mjs` (F45, F48, F51); the saved copies of every file a trial changed (each restored and
compared with `cmp`), and the logs. Every trial is repeatable on a fresh clone of the build tag:

| Trial | Steps | Output |
|---|---|---|
| T-23 the shown text after a tap | `env -i PATH=… HOME=<scratch>/m1e/home TMPDIR=<scratch>/m1e/tmp node g147-trial.mjs <clone>/app` (its G1 part: four variants of the trial page); `checkText` of the clone's `scripts/check-public.js` on such a script | F45 |
| T-24 the markers as one sequence | `node ps-pairing.mjs <clone>/app/scripts <f2pages> <work>`; `node ps-equal.mjs <clone>/app/scripts <f2pages> <work>`; `node ps-positive.mjs <clone>/app/scripts/public-set.js <f2pages> <work>` and with `<f2pages-m79>`; `node vb-pairing.mjs <clone>/app <f2pages> <work>`; `npx eslint`, `npx prettier --check` and `npx tsc --noEmit -p jsconfig.json` on the clone | F46 |
| T-25 the IB-1 row and the same file name elsewhere | `python3 ib-row.py <app> <none\|any-dts\|any-twin\|link-late\|no-tree\|basename> [g3]` on a saved copy of the build tag's file each time; `node --test test/unit/import-boundaries.test.js`; `grep -c 'assert\.'` | F47 |
| T-26 the avatar read | `g147-trial.mjs` (its G4 part: three rounds directly, three through a `willReadFrequently` copy, each in its own context) | F48 |
| T-27 NPM-6 on the same tree | `python3 vb-row8.py <app>`, then `node --test test/unit/npmrc.test.js test/unit/vercel-build.test.js`; the same from a saved copy with `vb-row8-g5.py`; then `ib-row.py <app> none g3`, `npx prettier --write` on both files, `npm run test:unit`, `npm run test:int`, eslint and `prettier --check` on both | F49 |
| T-28 the reds after B3 | in `b3/`: B1's files, B2's `Math.random` rule (any folder), B3's chain and `test:e2e`; `npm ci`; `npm run test:unit` | F50 |
| T-29 the labels on the frames of a walk | `g147-trial.mjs` (its G7 part, 390 × 844: plain and with the label narrowed while walking) | F51 |

---

## 18. Open questions for ORCH (answered by a record before the gate)

- **О1 — the page without script (C1).** The look's 9.16 links a style sheet inside `<noscript>`; REQ-111's file list
  names `css/tokens.css` and `css/site.css` only. Default: add `app/public/css/noscript.css` (the look's mechanism, the
  measure); alternative: `@media (scripting: none)` in `site.css` (measured working, F26), then the look's sentence
  changes in its edit.
- **О2 — `runBuild` async (C2).** Default: yes; VB-1…VB-4 and the fix round's test await it (section 11, row 8).
- **О3 — the words of List П (C3).** Default: the sign `%` and the five words in every language (stricter); alternative:
  each word only in its language.
- **О4 — the `order_` keys (C4).** Default: the 45 keys of 4.1 — the three requests and the two lists with their
  headings, labels and the links to them — read as «the order_ keys hold exactly three example requests and the two
  lists» of criterion 2.
- **О5 — the closed list of CSSOM writes as a test (C5, PP-6).** Default: yes.
- **О6 — the ports' JSDoc for `tsc` (C6).** Default: types and casts in comments only, parity as the proof; alternative:
  declaration files and an `exclude` of the ports (they would leave `tsc`).
- **О7 — the runner's Chrome for the e2e job (C7, F31).** Not measured in this step (no push allowed). Default:
  channel `chrome` with the first step `/opt/google/chrome/chrome --version`; TEST-RUNNER measures it on the snapshot
  branch at step 6; a missing Chrome is a WF-03 defect of the job, not a reason to skip a test. Alternative: ORCH pushes
  a sketch branch before gate 1b.
- **О8 — the stage movement on the port (C8).** Default: `stageMap` added to `grid.js` and `createWalker` to `sim.js`,
  with their own test (OS-7), outside the parity.
- **О9 — a stored non-Auto theme before the module script (C9).** Default: a named limit, as the sample; alternative: a
  classic blocking script file in the `<head>` (a file the block does not list).
- **О10 — the helper `app/test/fixtures/browser.js` (C14).** Default: allowed, as decisions/0118 О13 allowed the others.
- **О11 — `style.cssText` and the CSP (C16).** Default: the ban stays (criterion 10); the look's 5.1 item 3 is corrected
  in its edit to «a rule of the code» (F26).
- **О12 — the Addition to decisions/0001 for `playwright-core`.** Default: ORCH writes it at the build with the pin of
  4.12 and the measured facts of F16.

О1–О12 are answered by decisions/0124 with the defaults above. After gate pass 1 its Addition answered two more:

- **О13 — the base of the build (gate finding F1 (c)).** Answered: the build starts from
  `base/M1CODE-20261119-01-build` (2144f2a), and every command that names `base/<RUN-ID>` reads it for this run (the
  header, section 9, section 11; F36).
- **О14 — the declaration of the vendored engine (gate finding F1 (a)).** Answered: one narrow IB-1 row for a `.d.ts`
  whose `.js` twin beside it is an entry of `app/vendored.json`, with its damaged copies (4.8, section 11 row 5;
  measured with criterion 6, F37, F38).

New at step 01c:

- **О15 — REQ-108 criterion 2's count reference (gate finding F10).** The criterion names the catalogue of the skeleton
  run only (section 16). Default: the micro-amendment that follows this run (or M1AMEND-20261119-01, if ORCH widens
  it) writes the reference «the test catalogues of the runs whose changes the tree holds — section 13 of the skeleton
  design, the tests the skeleton's fix round named (NPM-6) and section 10 of this design — with every test that a later
  step of those runs names as added or removed»; until then a re-check of REQ-108 criterion 2 reads the counts at the
  commit at which REQ-108 was released (d87b3d1: unit 46, int 36). Alternative: ORCH names another reference in a
  record.

---

## 19. Counts and their commands

- Criteria: 16 + 10 (`awk` by id, then `grep -c '^      - >-'` in each block).
- Checked facts 51 (section 1: F1–F33 at the design tag, F34–F44 at the build tag for rework 01c, F45–F51 at the build
  tag for rework 01e); disputable choices 17 (section 2);
  open questions 15 (section 18: О1–О14 answered by decisions/0124, О15 new).
- New test files 15 (unit 11, int 2, e2e 2) and one helper; changed test files 6 (`npmrc`, `check-public`,
  `vercel-build`, `ci-workflow`, `import-boundaries`, `node-main`).
- Named tests added 96: unit 71, int 10, e2e 15 (section 10); with the build tag's counts (unit 46, int 36, F35) unit
  117, int 46, e2e 15.
- Build sub-steps 21: FRONTEND-DEV 11 (F1, F1k, F1e, F2, F2k, F2e, F3, F4, F5, F6, F7), BACKEND-DEV 6 (B1–B6),
  TEST-DESIGNER 4 (T1–T4); section 12 shows F1k with F1e and F2 with F2k, F2e in one row each.
- Mutants 93 (section 13), applied with the result named: 12 on the sketch at the design tag (M01–M06, M44–M47 and
  the two equivalent variants of F20 and F25); at step 01c 8 on the sketch at the build tag (M06 again, M78, M79,
  M83–M87) and 1 on a trial page (M80); at step 01e 4 on the sketch at the build tag (M89–M92) and 2 on trial pages
  (M88, M93).
- The look: sha256 `3dea234002153ff0a70f1dda61bf8cb587f025a2debab01f9a58e6c1ef3f9347` (unchanged during steps 01, 01c
  and 01e).
