# 0114 — The fix of ISS-0116 (the team page spec gaps): the route, the form of the window floor, and the places of the same kind

Status: **accepted** (ORCH, 2026-11-17, on the owner's word of 2026-11-17 «Продолжи работу» after the report of REQ-107 that named ISS-0116 as the next item, and `decisions/0113` О35; the owner can cancel each point).

## Question

The diagnosis of ISS-0116 (`handoffs/ISS-0116-20261117-01/step-01-issue-fixer.json`) confirms that the four gaps and the note are in `tools/test/e2e/team-web.e2e.js` only, finds that one fix written in the defect is wrong, and finds places of the same kind that the defect does not name (AP-014). ORCH settles the route and the scope before TEST-DESIGNER starts.

## Options

For each point the diagnosis names what it measured; no point is closed by a guess.

## Decision

- **Д1. The route.** The error is in the tests only (measured: every fix edits only the spec; with all fixes the file is 7 of 7 green on `tools/src` and the kit as tagged). By WF-03 "A fix only in tests" the design of the fix, CODE-FIXER and the security and code review gates are skipped: ISSUE-FIXER → TEST-DESIGNER (step 6) → TEST-DESIGN-VALIDATOR (step 7) → TEST-RUNNER (step 8, locally and on GitHub by `decisions/0110`) → RELEASE-VALIDATOR (step 9) → DOC-UPDATER (step 10) → RELEASE-FINALIZER (step 11). The write set of step 6 is `tools/test/e2e/team-web.e2e.js` only.
- **Д2. The form of the N1 fix.** The defect's form (after the existing wait, assert that the window lasted at least 3000 ms) is not built: it is also red on the benign page P13g0 (a page that refreshes the project at once on the cancel and sends nothing), which is stricter than criterion 4. Built instead: the wait after «Не останавливать» ends only when at least 3000 ms have passed since the click **and** the page's next poll of the project has come; then the assertions of `decisions/0113` О32. Measured by ISSUE-FIXER: red on P13g1 and on P13t, green on P13g0 and on today's page, no added time.
- **Д3. Places of the same kind in the same spec, fixed in this run (AP-014; same file, same kinds as the defect names).** (a) The second half of the end check of criterion 1 — "no project of the executor `claude-cli`" — is read again after the stop in both start helpers, as the trap marker is (L1); probe M01q must be red. (b) The empty-message proof of the chat (criterion 5) gets the same floor as Д2 (at least 3000 ms since the try and the page's next chat poll); probe P19g must be red, P19g0 and today's page green. (c) The note of item 5: a red message of the trap control names the check and the error code, not the path (probe M03f). The other system errors with the temporary path of the test's own folders (probe J01) are fixed here only if one helper covers them; otherwise TEST-DESIGNER names them in `result.issues` and they become a new defect.
- **Д4. The stack-frame shape of I3.** Accepted as measured: `/^[ \t]*at \S.*:\d+:\d+\)?[ \t]*$/mu` joins `BAD` and is applied to the unfolded `innerText` of each refusal and of the failed-task reason rows (no false red on the 91 plain texts the diagnosis read; red on D10e, green on D10e0).
- **Д5. Found on the way, not in this run.** The Pixel Office spec has the same kind as L1: the tests "journal" and "mask" of `tools/test/e2e/pixel-office.e2e.js` read `events.jsonl` before the stand stops, so a server that appends an invented event at its stop stays green (probe POj; reading again after the stop is red, POjf, and green today, POk). DOC-UPDATER opens it at step 10 as ISS-0117 (LOW, WF-03 later); this run does not widen to it (WF-03, "Findings on the way").
- **Д6.** The safety rule R2-T of `decisions/0113` (О2, О19, О30) holds for every trial of this run.

## Why

The run fixes the cause the defect names and the places of the same kind in the same file, so the same gap does not come back one line away (AP-014); a fix that is red on a benign page would lower the honesty of the test instead of raising it (Q5, Q6), so the measured floor form is taken. The Pixel Office case is another file and another requirement and goes to its own defect.

## Boundary

Only the run ISS-0116-20261117-01 and the spec `tools/test/e2e/team-web.e2e.js`. No product file, no kit file and no other spec is changed. It does not decide ISS-0114, ISS-0115 or ISS-0117.

## Basis

The defect `docs/issues/ISS-0116-team-page-spec-low-gaps.md`; the diagnosis `handoffs/ISS-0116-20261117-01/step-01-issue-fixer.json` (probes M01p, M01q, FIXp, FIXpf, M11b, M11c, M11k, P13g0, P13g0f, P13g1, P13t, P19g, P19g0, D10e, D10e0, D10ef, M03, M03f, J01, POj, POjf, POk); `decisions/0113` О32, О34, О35; WF-03, "A fix only in tests" and "Findings on the way".

## Addendum 2026-11-17 (ORCH, after gate 7 pass 1 = FAIL, `handoffs/ISS-0116-20261117-01/step-07-test-design-validator.json`)

- **Д7 (F1, Medium).** The error of `removeTempDir` in the `finally` of `inFolders` goes through `withoutPath` too, and it does not replace an error the body already raised (the gate's measured FX1; TV12 and TV13 red with no temporary path; today's file green).
- **Д8 (F2, Medium; a new form of the L2 fix).** "Inside the window" of criterion 7 is what the person can reach without any sideways scroll: the check reads the button's sideways position before any scroll (as `picker.e2e.js` does) and still requires `scrollX` equal to 0 after it; a scroll of an inner box that the person cannot scroll does not count (the gate's measured FX2: red on TV05, M11b and TV06b, green on today's page).
- **Д9 (F3 and F5, Low; fixed in the same step while gate passes are left, as `decisions/0112` О24).** (a) After the stop the reading also compares the executor of every project of the data folder with the one the end check saw, so a project rewritten to `claude-cli` at exit (TV03) is red. (b) The stack-frame shape also matches a frame with a line and no column (TV10), only if TEST-FIXER shows no false red on the plain texts the diagnosis read (the strings of `tools/src/web/texts.js`, the scenario strings, today's page readings); otherwise it is named and left.
- **Д10 (F4, Low).** Recorded as a named limit, the same as the limit of `decisions/0113` О32 at step 5d: a stop or a post sent after the window (at least 3000 ms and the page's next poll) is not seen by it (TV07, TV09); the floor is a minimum that holds below it (TV08, TV09b red). It goes into the closing of ISS-0116 and the as-built note of the design.
- **Д11 (gate issue I2, the sleep of the Mac).** The two bad runs of the gate's first load series are proven not caused by this work: the macOS power log shows a lid-close sleep at 10:33:01Z, the same second a `control` run lost its Chrome, and a `chat` run hung through the sleep until 10:39:07Z; the gate re-ran the whole series after the wake as its measurement (12 of 12 green) and reported both runs. `caffeinate -i` does not hold a closed lid. The owner is told; DOC-UPDATER records the lesson at step 10 (a long gate on this Mac needs the lid open).

## Addendum 2026-11-17 (ORCH, after step 7b TEST-FIXER, `handoffs/ISS-0116-20261117-01/step-07b-test-fixer.json`)

- **Д12 (TEST-FIXER's issue I2).** Recorded as a named limit beside Д10: a server that at exit rewrites only the run lines of a project to `claude-cli` and keeps its created line (probe TV03r) is not seen by the executor check of Д9 (a), which reads the executor from the created line; no real run happens in it (the scripted executor starts no program, `SAI_TEAM_REAL_RUNS` is never given). It goes into the closing of ISS-0116 with Д10.
- **Д13 (issue I6).** The power log of the Mac showed a lid-close sleep at 11:38:18Z and a "Thermal Emergency Sleep" at 11:38:31Z, with a wake by the lid at 11:43:16Z; no trial ran then. The owner is told (keep the lid open and the machine ventilated during long checks; one heavy job at a time stays the rule).

## Addendum 2026-11-17 (ORCH, after gate 7c pass 2 = FAIL, `handoffs/ISS-0116-20261117-01/step-07c-test-design-validator.json`)

- **Д14 (G1 Medium and G2 Low; the approach changes by the rework rule, because the same error — a button counted inside that the person cannot reach — came back).** "Inside the window" of criterion 7 is read as "the person can see and reach the button in that window": the check of test `windows` fails when its own scroll moved any box the person cannot scroll (computed overflow neither `auto` nor `scroll`), or when the element at the point of the button's centre is not the button or a node inside it, besides the sideways position before the scroll and `scrollX` equal to 0 of Д8. G2 (a button hidden while nothing scrolls: `overflow: clip`, a box drawn over it, `visibility: hidden`) is fixed in the same step, so the last gate pass is not spent on the next hole of the same check (AP-145). Built as the gate measured it (FX3): red on TV05, M11b, TV06b, TV16, TV17, TV19, TV20 and TV21; green on today's page and on the benign twins TV17a (a box the person can scroll) and TF2v (a scroll of the whole page). The text of criterion 7 is not changed.
- **Д15 (gate issue I3).** The change of `docs/program/public-v1/PROGRESS.md` at 13:47Z is ORCH's own record of the owner's answers and of session 3 of the program (decisions/0115); it is not a file of this run, and this run's release leaves it out.
- **Д16.** The next gate pass (step 7e) is the third and last of gate 7: a FAIL there stops the run and goes to the owner (`decisions/0079`, item 4).

## Addendum 2026-11-17 (ORCH, after step 7d TEST-FIXER, `handoffs/ISS-0116-20261117-01/step-07d-test-fixer.json`)

- **Д17 (TEST-FIXER's issue I2, the limits of a check inside the page).** Recorded as named limits of the window check of criterion 7 before the last gate pass, not as findings of this run: a button that is not painted (opacity 0, transparent colours; probe TF4), an opaque box over it with `pointer-events: none` (TF5), a button shrunk by a transform (TF6), anything that hides all of the button except its centre, "can be scrolled" read from the computed style only, one moment and the three named windows only, and a page that replaces the browser functions the check calls. They are questions of what the person sees, which a check inside the page cannot prove; closing them needs a check from outside the page (a screenshot comparison, as DESIGN-QA-VALIDATOR does, with thresholds) — a new requirement or a new defect, offered to the owner later, not this run. The gate of step 7e judges the check against Д8 and Д14 (position before the scroll, no sideways scroll, no scroll of a box the person cannot scroll, inside the window, the element at the centre), the earlier items, and anything else that is not one of these named limits.
- **Д18 (issue I1).** Accepted: the scan of boxes includes `body` and the window itself when its overflow is `hidden` or `clip` (probes TF3, TF3b, TF3c red), beyond the gate's FX3.

## Addendum 2026-11-17 (ORCH, after gate 7e pass 3 = PASS, `handoffs/ISS-0116-20261117-01/step-07e-test-design-validator.json`)

- **Д19 (finding H1, Low, and issues I1, I2).** Recorded beside the named limits of Д17: a create button that the page disables in a window stays green (mutant TV26: criterion 7 asks that the button is inside the window, not that it works; closing it needs a real click in each window); the button's own pseudo-element drawn over it (TV24, "what is painted"); a false red on a benign page with smooth scrolling and the button below the fold (TV23, the "one moment" limit; today's page has no smooth scrolling, and the tag's file does the same). Together with Д17 they go into one new LOW defect for a check from outside the page (a real click and a screenshot comparison of the window check), opened by DOC-UPDATER at step 10 as ISS-0118; this run does not change the spec for them.

## Addendum 2026-11-17 (ORCH, after step 9 RELEASE-VALIDATOR = PASS, `handoffs/ISS-0116-20261117-01/step-09-release-validator.json`)

- **Д20 (issue I2, the boundary RV07b).** A stack frame with no line and no column (`at new Promise (<anonymous>)`) is not matched by the stack-frame shape of Д4/Д9 (b); it is outside the letter of criteria 5 and 6 and is recorded as a named boundary in the closing of ISS-0116, with Д10, Д12, Д17 and Д19; no new defect (a proposal, like О21 of `decisions/0113`).
- **Д21 (issue I3).** M03 and J01 are red on both specs by their nature; their gap was the temporary path in the red message, and the validator measured that it is gone. Accepted as the regression proof of item 5 and of Д3 (c).
