# ISS-0116 — The spec of the team page: four Low gaps left after the gates (the trap marker read before the stand stops, the window check that scrolls sideways, the window after «Не останавливать» of no asserted length, a stack line in its own block not seen)

Серьёзность: LOW. Статус: open. Найдено: RELEASE-VALIDATOR (шаг 09, находки L1, L2, пробы M01p, M11b), TEST-DESIGN-VALIDATOR (шаг 05e, находка N1, мутант P13g1; issue I3, мутант D10e), прогон `E2E107-20261116-01`, 2026-11-16; решения ORCH `decisions/0113`, О34 и О35; заведено DOC-UPDATER (шаг 10), 2026-11-16T23:28:07Z. Пункт планки: Q5 (тест держит критерий и ловит поломку), Q10 (простые слова отказа). Требования: REQ-107 (сделано; критерий 1 — с пределом О35 (a), критерий 7 — с пределом О35 (b), критерий 4, критерии 5 и 6). Решение: `decisions/0113`, О34 (нижние находки второго прохода ворот — в дефект), О35 (названные пределы статуса REQ-107; этот дефект — первый WF-03, который предлагается владельцу после выпуска).

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
