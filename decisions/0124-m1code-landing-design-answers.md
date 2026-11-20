# 0124 — Answers to the questions of the code design of M1.4 (REQ-111, REQ-112; run M1CODE-20261119-01, WF-02 step 1a)

Status: **accepted** (ORCH's role, held since 2026-11-19 by the session that leads the program, decisions/0122 О1; the
owner can cancel each point).

## Question

CODE-DESIGNER wrote docs/design/REQ-111-112-public-landing.md (handoffs/M1CODE-20261119-01/step-01-code-designer.json,
COMPLETED 2026-11-19T17:05:24Z) by REQ-111, REQ-112 and decisions/0123, and left twelve questions О1–О12 that only ORCH
can answer, each with a default. WF-02 step 1a: ORCH answers them in a record before the gate 1b.

## Options

(a) The designer's defaults: each rests on a trial of the design (T-01 – T-15, repeated on a clean copy by the gate).
(b) The alternatives the designer names. (c) Ask the owner — none of the twelve changes what he sees on the page, and
G21 stands.

## Decision

The designer's defaults, each as the design states it:

- **О1** The page without script shows the text view of the scene through app/public/css/noscript.css, linked only inside
  `<noscript>` in the head of index, how and demo (the look's 9.16). REQ-111's file list gains this file.
- **О2** runBuild of app/scripts/vercel-build.js becomes async (it imports the texts module of the upload). VB-1 to VB-4
  and every test of the closed-build fix round await it; a test that does not await a promise proves nothing
  (replacement row 8 of the design).
- **О3** List П applies in every language: the sign % and the words процент, процента, процентов, пайыз, percent (the
  stricter reading).
- **О4** The `order_` keys are the closed list of 45 keys of the design's 4.1: the three example requests and the two
  lists with their headings, labels and links.
- **О5** The closed list of CSSOM writes (the look's 5.2 (d)) is enforced by the unit test PP-6.
- **О6** The ports get JSDoc types and casts in comments only, so the strict `tsc` reads them; the parity test against
  the originals proves the behaviour unchanged (76 585 comparisons at T-09). Declaration files with an exclude would
  leave the ports unread by `tsc`.
- **О7** The Chrome of the GitHub runner for playwright-core is measured at step 6 by TEST-RUNNER on the snapshot branch
  `ci/<run>-<n>`; the first step of the e2e job prints the Chrome version and the path it uses, so a missing Chrome is
  red at once; a missing or different Chrome is a WF-03 defect, not a skip.
- **О8** The stage movement uses the port, through a `stageMap` added to grid.js and a walker added to sim.js, with
  their own test OS-7 outside the parity.
- **О9** A stored theme other than «Авто» is applied when the deferred module script runs, so the system theme may show
  for a moment first, as in the sample: a named limit of the design (the one-to-one rule of the look).
- **О10** app/test/fixtures/browser.js may be added as a helper with no tests in it (as decisions/0118 О13 allowed the
  other helpers).
- **О11** `style.cssText` is not refused by the CSP of Chrome 157 (measured, T-10); the ban stays as a rule of the code
  (REQ-111 criterion 10), and the look's 5.1 item 3 is corrected in its edit of J3, J5, J7 (decisions/0123) to say that
  it is a rule of the code, not of the CSP.
- **О12** ORCH writes the Addition of the playwright-core pin to decisions/0001 at the build, with the measured facts of
  the design's F16 (1.64.1, Apache-2.0, published 2026-10-14, no dependency).

Bookkeeping that follows from the step (not answers): the candidates for the error journal that the designer named —
mutants that remove the git-tree refusal must run only in a throwaway clone (one rewrote the sketch's own app/public);
an async runBuild lets a test that does not await it pass without proving anything; a shell fallback of a trial
briefly moved a sketch file into the system temporary folder — go to DOC-UPDATER with the candidate of decisions/0123
«Order» (texts that cite each other ran at the same time). The handoff of step 01 was created by the agent at
16:49:46Z on ORCH's order; the run was launched at 16:13Z (its orch_note).

## Why

Each default is measured on a sketch in a fresh clone, and none lowers a check of the blocks; the gate 1b repeats the
trials on a clean copy before any code is written.

## Boundary

Only the code design of task M1.4 (docs/design/REQ-111-112-public-landing.md) and the build that follows it. No
requirement status changes by this record.

## Basis

handoffs/M1CODE-20261119-01/step-01-code-designer.json (questions О1–О12, trials T-01 – T-15); decisions/0123;
REQ-111, REQ-112 in docs/requirements.yaml.

## Addition 2026-11-19T19:32Z (ORCH, after the gate 01b pass 1, FAIL: F1 high, F2 medium, F3–F10 low)

- **О13 (F1 c, the base of the build).** The fix round of the app skeleton landed on main as d87b3d1 (production since
  18:00Z) and was merged into this tree as 2144f2a (app check exit 0 there: unit 46, int 36). The build of this run
  starts from that merge, tagged `base/M1CODE-20261119-01-build`. Every command of REQ-111 and REQ-112 (and of the
  design) that names `base/<RUN-ID>` reads this tag for this run, so its diff lists only this run's changes; the tag
  `base/M1CODE-20261119-01` stays as the base of the design steps 01 and 01b. The replacement table, the guard facts and
  the counts of the design are measured on the build tag (unit 46 and int 36 there, NPM-6 taken by the skip grep).
- **О14 (F1 a, the declaration of the vendored engine).** The fix round's IB-1 makes every file that is not .js under
  app/server, app/api and app/worker red. One narrow row is allowed: a `.d.ts` file whose `.js` twin beside it is an
  entry of app/vendored.json (today exactly server/vendor/picker-engine.d.ts); every other file that is not .js stays
  red, with damaged copies in IB-2 (a second `.d.ts` without a vendored twin, a `.ts`, a `.d.ts` beside a `.js` that is
  not in app/vendored.json, a `.d.ts` as a link). The design may choose another place for the declaration only if it
  measures that both REQ-111 criterion 6 and IB-1 then pass; otherwise this row.
- The rework step 01c (CODE-DESIGNER) was launched at 2026-11-19T17:47Z and stopped on the account's five-hour usage
  limit before it wrote any file (no handoff of step 01c, the design unchanged: sha256 67da923e…); it is launched again
  from a clean sheet with the same step name.

## Addition 2026-11-20T03:07Z (ORCH, after the gate 01f pass 3, PASS with the low findings H1–H7)

The code design passed its gate at the third and last pass (handoffs/M1CODE-20261119-01/step-01f-code-design-validator.json;
design sha256 469b32af…). Its low findings go where the gate named them, as tasks of the build:

- **H1** (B5) every line of a page is read for the four marker forms and for marker-like comments, inside a region too;
  only the content between a region's markers is not interpreted, because it is cut whole (the sketch's reading, F46,
  PB-6).
- **H6** (B5) until F6 lands, B5's driver plants the PB-6 shapes into model pages shaped as in 4.3 (like F41's).
- **H2** (F7 and T4) the demo speaker's `canvas[data-avatar]` is drawn by drawAvatar for the asking desk of 9.13 at each
  question and after each theme change, with the palette read once per change; LD-4 or LD-5 reads its `--sc-chair`
  after a theme change on demo.html.
- **H3** (T2) each «next rule» row of TX-7 runs with a stored value that is a language of the build other than ru, with
  M36 named against it. **H4** (T4) mutants for ST-5 (the drawScene exception escapes; a null context gets no text-view
  class) and M57 named for ST-4, both carried into row REQ-112/6. **H5** (T2 mapping, DOC-UPDATER «As built») PP-6 joins
  the test column of row REQ-111/10. **H7** (T4, optional) shownTextFindings after each tap of ST-3.
- The look edit of decisions/0123 (J3, J5, J7) also carries the answer of I2/J2 (the team row under the intro from 760 to
  1206 px) into 7.7 and the answer of О11 above into 5.1 item 3; it runs before F3 (the design's section 12).

