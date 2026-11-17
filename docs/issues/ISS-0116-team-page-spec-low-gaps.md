# ISS-0116 — The spec of the team page: four Low gaps left after the gates (the trap marker read before the stand stops, the window check that scrolls sideways, the window after «Не останавливать» of no asserted length, a stack line in its own block not seen)

Серьёзность: LOW. Статус: closed, 2026-11-17. Найдено: RELEASE-VALIDATOR (шаг 09, находки L1, L2, пробы M01p, M11b), TEST-DESIGN-VALIDATOR (шаг 05e, находка N1, мутант P13g1; issue I3, мутант D10e), прогон `E2E107-20261116-01`, 2026-11-16; решения ORCH `decisions/0113`, О34 и О35; заведено DOC-UPDATER (шаг 10), 2026-11-16T23:28:07Z. Пункт планки: Q5 (тест держит критерий и ловит поломку), Q10 (простые слова отказа). Требования: REQ-107 (сделано; критерий 1 — с пределом О35 (a), критерий 7 — с пределом О35 (b), критерий 4, критерии 5 и 6). Решение: `decisions/0113`, О34 (нижние находки второго прохода ворот — в дефект), О35 (названные пределы статуса REQ-107; этот дефект — первый WF-03, который предлагается владельцу после выпуска).

## Что не так

The gates of run `E2E107-20261116-01` passed the spec `tools/test/e2e/team-web.e2e.js` with four Low gaps. None lets a test start a real Claude program or spend anything, and none is a breach of a criterion as `decisions/0113` reads it; each is a breakage of the product that the spec would not see. In the order that О35 sets:

1. **L1 (step 9) — the trap marker is read before the stand stops.** `endChecks` (lines 461–480) asserts that the marker of the trap copy does not exist, but it runs inside the body of `withTeam` (lines 254–256) or `untilStopped` (lines 273–288), before the stand is stopped; only `stand` reads the marker again after its stop (line 601), and `stand` has no project. So a server that starts its Claude program while it shuts down holding a project is seen by no test. RELEASE-VALIDATOR's probe M01p (the server starts the trap copy in its `SIGTERM` handler when its data folder holds a project) left `create` and `failure` green, while its effect log showed the copy started with its marker present (`trap started at shutdown with a project; marker present: true`, once per server with a project); M01ps on `stand` is green too. This is the limit О35 (a) of criterion 1 («at the end of the whole file the trap marker file does not exist»): the property — no real run, no spending — holds by construction, its detection at shutdown does not.
2. **L2 (step 9) — the window check scrolls sideways.** `INSIDE` of test `windows` (line 1308) calls `scrollIntoView({ block: "nearest", inline: "nearest" })`, so a create button pushed past the right edge of the 320 px window counts as inside after a sideways scroll. Probe M11b (the button moved 400 px to the right, up to 330 px wide) left `windows` green; M11c, the same page with an `INSIDE` that also needs `scrollX === 0`, is red at «320x568: the create button is inside the window», which shows the sideways scroll happened. The limit О35 (b) of criterion 7 («the form button is inside the window»). Today's page has no sideways overflow on either page in the three windows (measured by RELEASE-VALIDATOR, О36; no test asserts it).
3. **N1 (step 05e) — the window after «Не останавливать» has no asserted length.** In `control` the proof that «Не останавливать» changes nothing is a window from its click to the page's next poll of project B (`decisions/0113` О32; lines 885–923). Its length is not a checked fact; it is about 5 s today only because the cancel lands just after B's first poll (4935–5003 ms at steps 05d and 05e). A page that refreshes B at once on the cancel (benign alone: P13g0 green) and sends the stop 1000 ms later (mutant P13g1) leaves `control` green 3 of 3: the wait ends on that refresh after about 3 ms, and the late stop is then dropped by the test's own navigation.
4. **I3 (step 05e) — a stack line in its own block element is not seen.** A page that shows each line of a refusal in its own block element (D10e0, green, benign) with a stack line in the refusal (D10e) stays green: CSS drops the leading blanks of the frame and `textContent` joins the lines with no line break, so no reading of the literal mark `^\s+at ` can match. Beyond the letter of criteria 5 and 6 (as О21 added the `E_` code shape), so a proposal, not a finding against them.

One more note for the same spec (step 9, issue I7 (c)): the red output of mutant M03 (the trap copy made 0600, so it cannot start) holds the temporary path of the copy through Node's spawn error (`EACCES`). It is not a value of the person's environment (`decisions/0112` О24 is about the environment of the spec process), but the message need not hold it.

Why LOW: each gap needs a product change that no test of today expects; the properties of the criteria hold on today's page and server (RELEASE-VALIDATOR's own runs, step 9: all 8 criteria met); the fixes of items 1–3 are measured and small.

## Доказательство

- Items 1, 2 and the note: `handoffs/E2E107-20261116-01/step-09-release-validator.json` — `result.findings` L1 and L2, issues I2, I3 and I7 (c), `self_check` «MUTANTS» (M01p, M01pf, M01ps, M01c, FIXp, FIXk, M11b, M11c, M11k, O13m, O13p, M03).
- Items 3 and 4: `handoffs/E2E107-20261116-01/step-05e-test-design-validator.json` — `result.findings` N1, issue I3, the mutants P13g0, P13g1 (×3), P13g1p, P13g1f, K2w, D10e0, D10e.
- `decisions/0113`, О34, О35, О36; design `docs/design/REQ-107-e2e-team-web.md`, sections 4.4 and 16, «As built».
- The line numbers above are those of `tools/test/e2e/team-web.e2e.js` as released by the run (sha256 `f0cbc838…`), read at step 10.
- To repeat a gap, only in a fresh clone outside the project and under the safety rules of the run (a temporary home and `SAI_TEAM_HOME`, the trap copy as the only Claude program, `SAI_TEAM_REAL_RUNS` never set): apply the probe named above to the page or the server and run the named test alone; it stays green.

## Как исправить

One WF-03 run of TEST-DESIGNER (the spec only; the product is not changed), with TEST-DESIGN-VALIDATOR:

1. L1 — one assertion after the stop in the two helpers, as `stand` does at line 601: `withTeam` awaits `withStand` and then asserts that the marker of its folders does not exist (`trapStarted(MADE.get(options))` is false); `untilStopped` does the same after `stand.stop()`. Measured by RELEASE-VALIDATOR on a copy: with the fix and the M01p server `create` is red at «the trap was never started, after the stop» (FIXp); with the fix on today's page the whole file is 7 of 7 green (FIXk, 32867 ms).
2. L2 — `INSIDE` also requires `scrollX === 0` after the scroll: red on M11b (M11c), green on today's page (M11k). If the owner wants the overflow itself held, the measurement O13m (`document.documentElement.scrollWidth` and `document.body.scrollWidth` not above `innerWidth` after each window check) becomes an assertion — a raise beyond criterion 7, for the owner.
3. N1 — take the time at the click of «Не останавливать» and, after the wait, assert that the window lasted at least 3000 ms (`assert.ok(performance.now() - cancelAt >= 3000, "…")`): measured by TEST-DESIGN-VALIDATOR, red on P13g1 (P13g1f, in 1.5 s), green on today's page (K2w, 13.3 s); it adds no time.
4. I3 — a stack-frame shape in the plain-words patterns `BAD` (a line that starts with optional blanks and `at `, and ends with `:<line>:<column>` or `:<line>:<column>)`), applied to `innerText` not folded; red on D10e, green on D10e0 and on today's page — to be measured by the fixer.
5. The note — a red message of the trap control names the code of the spawn error, not its path.

Each new or changed assertion fails on its mutant first and passes on today's page (Q5); a weaker check, a skip or a removed assertion is not a fix (Q6). The safety rules of run `E2E107-20261116-01` apply to every trial.

## Маршрут

WF-03 for TEST-DESIGNER (tests only), with TEST-DESIGN-VALIDATOR; on ORCH's order. By `decisions/0113` О35 this is the first WF-03 to offer the owner after the release of REQ-107.

## Закрыто

Закрыто 2026-11-17T15:44:53Z (время с часов), прогон `ISS-0116-20261117-01` (WF-03, шаг 10, DOC-UPDATER после PASS RELEASE-VALIDATOR, `handoffs/ISS-0116-20261117-01/step-09-release-validator.json`, 2026-11-17T15:36:18Z). Итог: причина устранена в спецификации, регрессионное доказательство есть (пробы, зелёные со спецификацией тега и красные с новой); код страницы, сервера и набора не менялся. Названные пределы остаются (ниже). Решение: `decisions/0114` (Д1–Д21).

- **What was done.** Only the spec `tools/test/e2e/team-web.e2e.js` changed (sha256 `f0cbc838…` on the tag → `61d69de8…`; 1369 → 1584 lines; 7 tests as before; `assert.` 108 → 113, `assertPlain` 9 → 12, the patterns of `BAD` 5 → 6). No assertion was dropped: the one assertion of the window check became a loop over five parts, and every old condition is in one of them. No skip, todo or `|| true`. The route was "A fix only in tests" (`decisions/0114` Д1): ISSUE-FIXER (step 01) → TEST-DESIGNER (06) → TEST-DESIGN-VALIDATOR (07, FAIL) → TEST-FIXER (07b) → TEST-DESIGN-VALIDATOR (07c, FAIL) → TEST-FIXER (07d) → TEST-DESIGN-VALIDATOR (07e, PASS, the third and last pass) → TEST-RUNNER (08, PASS) → RELEASE-VALIDATOR (09, PASS). By item:
  1. L1: after their stand stops, both start helpers (`withTeam` and `untilStopped`) call `afterStop`. It reads three facts again: the trap marker; the project folders of the data folder the server got, against those the end check saw; and the executor of each project (`executorsOf`, from its first journal line), against the one the end check saw (Д3 (a), Д9 (a)).
  2. L2: the window check of test `windows` was rebuilt as `REACH`, with five parts asserted one by one. The button lies sideways inside the window before any scroll. It is reached with no sideways scroll of the window. It is reached with no scroll of a box the person cannot scroll (the boxes from its parent up to the body, and the window itself when its overflow is hidden or clip). It is inside the window. It is what the window shows at its centre (Д8, Д14, Д18).
  3. N1: after «Не останавливать» the wait ends only when at least `WINDOW_FLOOR_MS` (3000 ms) have passed since the click and the page's next poll of the project has come (Д2). The form written in item 3 of «Как исправить» was not built: it was also red on the benign page P13g0.
  4. I3: the stack-frame shape `/^[ \t]*at \S.*:\d+(?::\d+)?\)?[ \t]*$/mu` joined `BAD`. It is read on the unfolded `innerText` (`linesOf`, `linesOfAll`) of the create refusal, the chat refusal and every shown reason row of a failed task (Д4, Д9 (b)).
  5. The note: the red message of the trap control names the check and the code (`the trap control: the copy did not start (EACCES)`). `withoutPath` tells every Node system error of the test's own folders by its call, its code and its place, with no path, also at the removal of the folder (Д3 (c), Д7).

  Places of the same kind were fixed in the same run (AP-014): the project folders of the end check (probe M01q) and their executors (TV03); the same floor for the chat's proof that an empty message is not sent (Д3 (b), probe P19g); the system errors with a temporary path (J01, TV12, TV13). The window check was rebuilt twice. Gate passes 1 and 2 found the same error, a button counted inside that the person cannot reach (step 07, F2; step 07c, G1). So the approach changed by Д14 and Д18 (step 07d), and pass 3 (step 07e) passed.
- **Regression proof.** Step 06 (`handoffs/ISS-0116-20261117-01/step-06-test-designer.json`): every new or changed assertion is red on its probe with the new spec and green with the tag's spec. Step 07e (`step-07e-test-design-validator.json`, gate pass 3): the probes and the gate's own mutants are red at the part that names them, and the benign twins are green. Step 09 (`step-09-release-validator.json`, `self_check` «PART 1» and «PART 5»), each on fresh clones of the tag:
  - M01p, M11b, P13g1 and D10e (the four gaps) and M01q, P19g, TV16, TV17, TV19, TV20, TV21 are green with the tag's spec and red with the new one;
  - M03 and J01 are red on both specs by their nature; their gap was the temporary path in the red message, found once each with the tag's spec and 0 times with the new one (Д21);
  - the benign twins P13g0, P19g0, D10e0, TV17a and TF2v are green;
  - of the validator's 15 own mutants, every product mutant aimed at a check is red.

  The full check `cd tools && npm run check` gave exit 0 at step 08 (320.6 s) and at step 09 (333.2 s): 2209 of 2209 tests, team-web 7 of 7. On GitHub both runs succeeded: run 44106392711 (step 08, team-web 28575 ms) and run 44113639129 (step 09, team-web 26531 ms). The temporary branches were deleted, and `main` was not touched.
- **Named limits that stay (do not read the closing as more).**
  1. Д10: a stop or an empty message sent after the floor window (at least 3000 ms and the page's next poll) is not seen (TV07, TV09). The floor holds below it (TV08, TV09b red).
  2. Д12: a server that, at exit, rewrites only the run lines of a project to `claude-cli` and keeps its created line (TV03r) is not seen by the executor check, which reads the executor from the created line. No real run happens in it.
  3. Д17 and Д19, the limits of a check inside the page. A check from outside the page would be needed for each of these, opened as `docs/issues/ISS-0118-team-page-window-check-needs-a-check-from-outside-the-page.md`:
     - a button that is not painted (TF4);
     - an opaque box over it with `pointer-events: none` (TF5);
     - a transform that shrinks it (TF6);
     - anything that hides all of it but its centre;
     - "can be scrolled" read from the computed style only;
     - one moment and three windows;
     - a page that replaces the browser functions the check calls;
     - a disabled button (TV26, finding H1 of step 07e);
     - the button's own pseudo-element drawn over it (TV24);
     - a false red on a benign page with smooth scrolling and the button below the fold (TV23).
  4. Д20, a measured boundary: a stack frame with no line and no column (`at new Promise (<anonymous>)`, RV07b of step 09) is not matched by the stack-frame shape. It is outside the letter of criteria 5 and 6; no defect.
  5. No test asserts that the page itself has no sideways overflow (`decisions/0113` О13, О36): the check holds the button, not the width of the page.
  6. The runner time is four samples of two image versions (AP-144), and every local run was on one Mac.
  7. The fix is not yet on `main`. The commit, the push and `check.yml` on `main` are RELEASE-FINALIZER's step 11, after this closing; a red `main` then reopens this defect.
- **Found on the way.** The same end-before-stop kind in the Pixel Office spec (`decisions/0114` Д5): `docs/issues/ISS-0117-pixel-office-spec-journal-read-before-stop.md`.
