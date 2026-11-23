# Anti-patterns — the journal of process errors

This file records process errors that Sai agents have already stumbled on or can stumble on
again, and how to work correctly. These are lessons about how to lead the work; code defects
live separately, in `docs/issues/`.

- Read the journal before any non-trivial work: many lessons fit any task.
- A record is added in the same work in which the error was found (quality-bar Q13). Whoever
  found it proposes it in `result.issues` of their handoff; the bookkeeper (DOC-UPDATER)
  writes it.
- The number is the next free one: the largest number in the file plus one. Numbers are not
  reused and records are not deleted; if a lesson is out of date, what changed and when is
  appended to the record.
- The lesson must be clear from the record itself. The "Where found" links lead only to Sai
  files.

## Record format

```
### AP-NNN — Короткое название

- Что случилось:
- Почему это плохо:
- Как правильно:
- Где найдено: (REQ / ISS / handoff)
```

The four field names stay in Russian, because other files and checks refer to them by these words. The meaning: «Короткое название» is the short title, «Что случилось» is what happened, «Почему это плохо» is why it is bad, «Как правильно» is how to do it right, «Где найдено» is where it was found. The text of a record is written in English.

## Records

### AP-001 — A secret in client code

- Что случилось: in one of the owner's earlier projects, a live Telegram bot token was built
  into the client bundle and copied into the documentation.
- Почему это плохо: the token goes to the browser of every visitor; fixing the code without
  revoking the token achieves nothing.
- Как правильно: secrets only on the server and only by reference (quality-bar Q7); the
  client calls its own server, not an external API with a key.
- Где найдено: a review of the owner's earlier projects before work on Sai began.

### AP-002 — A journal written after the fact

- Что случилось: in the Pixel Office reference, from which the look of the office is carried
  over (code in `reference/`), the events were written by hand in code, with artificial time
  squeezed into one day, although the description said "by actual events recorded by the
  runtime".
- Почему это плохо: the picture looks like telemetry but is not; the difference is not visible to
  the one who looks.
- Как правильно: events are written only by a real source (hooks) with the real time
  (quality-bar R2, REQ-001).
- Где найдено: the reference code of the owner's earlier project, file `AgentOfficeSeed.cs`.
  Addition of 2026-10-06: the folder `reference/` with this code was removed from Sai
  (decision 0019); the lesson stays in force, the sample is the snapshots in
  `docs/design/samples/`.

### AP-003 — A point of view without a source

- Что случилось: at step 0 of the first WF-06 run, the owner's goals were only in
  `ideas/README.md`, which by design cannot be a source. The `owner_fit` analyst would have had
  nothing to quote.
- Почему это плохо: the analyst would either rate "from memory" (Q3) or could not fulfil the
  contract.
- Как правильно: before prepare-run, check that every point of view has a source in
  `--context`; the owner's goals are in `docs/owner-goals.md`, verbatim.
- Где найдено: `handoffs/WF06-20260925-01/step-00-orch.json`; caught before sending to the
  agents, the run was prepared again.

### AP-004 — An example in a contract suggests the answer

- Что случилось: in the JSON examples in the WF-06 design there were real ideas, including
  `"chosen": "02-sai"` with rank 1. The analysts and the judge read this document.
- Почему это плохо: an example works as an anchor and makes the choice circular.
- Как правильно: examples in contracts contain only made-up data (`01-alpha`,
  `02-beta`…).
- Где найдено: `docs/design/REQ-002-idea-verdict.md`; fixed before sending to the agents.

### AP-005 — A link to a rejected version

- Что случилось: in `verdict-2.json` the task for ORCH still told it to hand `verdict-1.md` —
  the rejected version — to the owner. apply-verdict carries tasks over verbatim.
- Почему это плохо: the owner would have received a wrong document although everything else was
  fixed.
- Как правильно: at every rework, search the new version for all links to earlier
  versions; earlier ones are mentioned only as history. Caught by the executor in
  `verdict-review-2.json`.
- Где найдено: WF06-20260925-01, check 2.

### AP-006 — An agent broke off halfway

- Что случилось: the first run of VERDICT-EXECUTOR was stopped by an API limit; the resumed
  run also ended without a result. The handoff stayed IN_PROGRESS.
- Почему это плохо: without an explicit record it is unclear whether something was half done.
- Как правильно: ORCH checks the files (whether something was done), closes the handoff
  as FAILED with the mark `not_agent_attested` (`docs/workflows/handoffs.md`, section "Pauses
  and interruptions") and sends a new run from a clean sheet.
- Где найдено: `handoffs/WF06-20260925-01/step-05-verdict-executor.json`.

### AP-007 — The "before" snapshot taken after the changes

- Что случилось: to fix AP-003 and AP-004, ORCH corrected the design and the mandates after
  prepare-run and took the "before" snapshot again — after these edits. The report of step 0
  also described the order wrongly.
- Почему это плохо: the "before" snapshot must prove that during the run nothing changed outside
  the allowed places. Taken later, it hides exactly the changes it must catch. The check
  itself still "passes".
- Как правильно: the "before" snapshot is the first action of step 0. If something had to
  be fixed after it, start the run again with a new RUN-ID (or get a written exception from the
  owner) and do not take the snapshot again. The report of the step is written by the actual
  chronology.
- Где найдено: RELEASE-VALIDATOR, REQ-004 AC4; the correction is `orch_correction` in
  `handoffs/WF06-20260925-01/step-00-orch.json`. Closed by the repeated run
  `WF06-20260926-01`, where the "before" snapshot and prepare-run were done by one command.

### AP-008 — A parallel agent sees another's file that is not finished

- Что случилось: in the run `WF06-20260926-01` the owner_fit analyst started a self-check while
  the market analyst was still writing its file, and saw "errors" of the unfinished state in
  it.
- Почему это плохо: an agent can take another's unfinished work for a violation or, on the
  contrary, count a stage as checked on incomplete data.
- Как правильно: in parallel work a self-check rates only its own file; the stage as a
  whole is checked by ORCH when all participants have finished. Parallel agents do not write
  into the same file.
- Где найдено: `handoffs/WF06-20260926-01/step-01-idea-analyst-owner_fit.json`.

### AP-009 — ORCH writes code itself

- Что случилось: all the code of `tools/` (REQ-002) and all fixes for the findings of the
  validators were written by ORCH in the main session, not by a separate BACKEND-DEV run; the
  last fix touched 6 files — more than the "one file" exception allowed to ORCH.
- Почему это плохо: the mandate of ORCH forbids it to write application code. The independence of
  the check was kept (all checks were done by separate runs), but the pair "does → checks" at
  the development step was incomplete: there was no separate developer and reviewer.
- Как правильно: code is written by a separate BACKEND-DEV run by a handoff; ORCH only
  routes. Fixes for findings also go through BACKEND-DEV, then REVIEWER.
- Где найдено: RELEASE-VALIDATOR, 2026-09-28; the owner was told.

### AP-010 — A requirement check in parallel with the work on it

- Что случилось: in WF-07, ORCH started REQ-VALIDATOR at the same time as the researchers. The
  requirement got FAIL (3 blockers), and by then the research was already going on an unchecked
  statement.
- Почему это плохо: a PASS of a check is a dependency, not a formality. Work on an unchecked
  requirement can go the wrong way and will have to be redone.
- Как правильно: only independent things are started in parallel. The requirement check
  goes before the work on it; in parallel with it one can do only what does not depend on the
  requirement.
- Где найдено: `handoffs/BP-20260929-01/step-00-req-validator.json`.

### AP-011 — ORCH writes requirements itself

- Что случилось: REQ-005 was written by ORCH, not by REQ-ANALYST.
- Почему это плохо: the same problem as AP-009 — the producing step has no separate performer;
  only the checker is left.
- Как правильно: requirements are written by REQ-ANALYST by a handoff of ORCH.
- Где найдено: REQ-005, 2026-09-29. In the same place ORCH, in the middle of the run, widened
  the list of sources in `plan-writer.md` (added `ideas/README.md` and
  `ideas/05-drugie-idei.md`) — recorded only in the handoff `step-02-plan-writer-r2.json`;
  such changes of mandates must go through as a decision.

### AP-012 — ORCH writes unchecked facts into the tasks for agents

- Что случилось: in the tasks for the WF-07 researchers, ORCH wrote about the owner "a working
  prototype" and "real systems that were built" — this is not confirmed by the project
  documents.
- Почему это плохо: an agent takes the text of a task for a fact and carries it into its
  conclusions. Here it reached only the conclusions of the research, not the plan — but it
  could have reached it.
- Как правильно: a task holds only what is in the project files, with a link to the file;
  everything else — as a question or an assumption.
- Где найдено: RELEASE-VALIDATOR, `handoffs/BP-20260929-01/step-04-release-validator.json`.

### AP-013 — A rework step without its own handoff

- Что случилось: in WF-07 the researchers reworked their files after the FAIL of step 1b (last
  edits 2026-09-29, 16:56–16:58Z), but they have no rework handoffs: `completed_at` and
  `result` in `step-01-market-researcher-*.json` stayed from the first pass (08:01Z, 08:05Z,
  16:42Z). In steps 2 and 3 of the same run every round is recorded as a separate file
  `…-r2/r3/r4.json`.
- Почему это плохо: from the handoffs it is not visible who reworked what and when; the checker
  confirms a text that is in no record of the producer (Q2, Q14).
- Как правильно: every rework step after a FAIL is a separate handoff of the producing
  role `…-rN.json` with its own time, `agent_run_id` and list of edits, as in steps 2 and 3.
- Где найдено: RELEASE-VALIDATOR, `handoffs/BP-20260929-01/step-04-release-validator.json`,
  finding 2.

### AP-014 — The named places were fixed, the others of the same class stayed

- Что случилось: the helper `readTextFile` (`tools/src/util.js`) already protected some file
  reads from a stack trace, but not all. RELEASE-VALIDATOR found 3 more unprotected reads, and
  ISS-0001 was opened for exactly these 3 places; the fix was limited to them. During the fix
  BACKEND-DEV found 8 more cases of the same class (6 paths with a stack trace and 2 variants
  of a partial write in apply-verdict), and REVIEWER 4 more (2 paths and 2 variants of a
  partial write). The result is ISS-0002 (MEDIUM) and ISS-0003 (LOW).
- Почему это плохо: an issue is closed, not a class of defect. The other places wait for the next
  check, and the cycle "found → fixed the named → found more" repeats. Among the remaining ones
  there was a case more serious than the first: a partial write (ISS-0002, MEDIUM) while the
  first was LOW.
- Как правильно: both when opening an issue and when fixing a defect, find by search all
  places of the same kind (here — every `fs` call in `tools/src`), not only the named ones, and
  in the same work fix each one or list it in the issue with the place and the reproduction.
  The checker compares the handling of the common question in all neighbouring places with each
  other, not each place separately. This is a frequent error, not an accident: a ready
  mechanism gets into two neighbouring branches out of three; an approved design fixes the
  common function, while the neighbouring path that builds the same state itself stays; a third
  such place is found in another module. Search by the kind of error, not by the named places.
- Где найдено: ISS-0001, `handoffs/ISS-0001-20260930-01/step-01-backend-dev.json`
  (`result.issues`) and `step-02-reviewer.json` (decision I3); consequences — ISS-0002 and
  ISS-0003.
- Repeat on 2026-10-21 (`ISS-0075-20261021-01`, WF-03): the helper function that walks a folder
  (`readdirSync` + `lstatSync`) was copied into three test files (`inboxNames` in
  `team-channel.test.js`, `inboxFiles` in `team-web-channel.test.js` and
  `team-web-control.test.js`); fixing the named place (EN-62) would have left two copies without
  protection against a name that disappeared. Fixed with one common function `listFilesLive` in
  `tools/test/team-helpers.js`; three more walks of the project folder without protection stayed
  as a residual risk (ISS-0084, item 1). Found: `handoffs/ISS-0075-20261021-01/step-01-issue-fixer.json`
  (I2, I7), `step-05-release-validator.json` (F1).

### AP-015 — Shares with different denominators compared in a stop criterion

- Что случилось: in the big plan `docs/business-plan/README.md` the stop criterion of Pixel
  Office compared 3 prepayments out of 300 visitors of the page (1%) with a share of 2% paying
  among the active free users of the product (Д7, line 504); the comparison stands in lines
  594–595. The arithmetic is right (3 ÷ 300 = 1%; 82 ÷ 0.02 = 4 100), but the denominators are
  different: visitors of the page and active users of the product. The plan passed steps 3 and 4
  of the run BP-20260929-01 (PASS); in the handoffs of that run there is no "Д7", no "594", no
  "out of 300", no "denominator" (a search for these words is empty). The error was found by an
  external reviewer: `docs/business-plan/reviews/2026-09-30-external-review.md`, section 1 —
  the words of the reviewer, section 2 — the agreement of ORCH.
- Почему это плохо: "1%, half the model" looks like a reason to stop the line, but this is a
  comparison of things that cannot be compared: 2% of active users of a product and 1–2% of cold
  traffic of a page cannot be compared directly (reviewer, section 1). A stop criterion decides
  the fate of the line, so an error in it leads to a false stop or a false continuation. The
  check that recalculated the numbers and compared the links did not catch it: the numbers are
  right, the comparison is wrong.
- Как правильно: for every share in the plan, write the denominator at once (visitors of
  the page, active users, paying) and compare only shares with one denominator; the page has its
  own criterion with its own denominator, and the share "free → paid" is measured on a product
  already in use (reviewer, section 3). The plan checker writes out the denominator of every
  share and every threshold and checks that in the comparison they are the same, and does not
  only recalculate the arithmetic. In REQ-006 this is fixed by criteria 11 and 12 ("every share
  has its denominator named"; they belong to the branch "14-day check", in this run the result
  is «рано» ("too early")), and the document `docs/business-plan/pixel-office-brief.md` does
  not make such a comparison. `README.md` itself was not changed by this run: the fix is in the
  list of business plan reworks in `STATE.md`.
- Где найдено: the external reviewer, `docs/business-plan/reviews/2026-09-30-external-review.md`
  (section 1 — the reviewer, section 2 — the agreement of ORCH; clarification — finding F7,
  `handoffs/BP-20260930-01/step-04-release-validator.json`); `docs/business-plan/README.md`,
  lines 593–595 and Д7 (line 504); bookkeeping — step 5 of REQ-006,
  `handoffs/BP-20260930-01/step-05-doc-updater.json`.

### AP-016 — Criteria of one requirement that cannot be met together

- Что случилось: in REQ-006, criterion 4 requires in the competitor table a row for every
  product from the coverage tables of the new research that has «да» ("yes") or «частично»
  ("partly") for at least one promised element; criterion 7 keeps this table in the final
  document for the result "14-day check"; criterion 9 allows no more than 1 500 words in the
  whole file. The number of rows depended on the research, which is written later, and was not
  estimated in the requirement; ORCH noted the risk before step 2a (`orch-notes.md`, "Risk for
  step 2a"). The result was 122 rows (120 by the cells of the coverage tables and 2 mandatory by
  name); the file with the table is 2 736 words against a limit of 1 500, and the "|" signs
  alone are counted by `wc -w` as 610 words. The author of step 2a did not shorten the rows and
  recorded the conflict (`result.issues` I2 and I8). The result of the run is «рано» ("too
  early"): in the document «рано» there is no table (criterion 8), and the conflict did not show
  itself; it blocks the branch "14-day check" until the requirement is corrected (finding F1 of
  step 4).
- Почему это плохо: the requirement had a branch that cannot be fulfilled, and this became visible
  only at step 2a, when REQ-VALIDATOR had already given PASS and the research was ready. There
  are two ways out, and both lower the bar (Q6): break the limit or silently shorten the table.
  The author did not shorten and raised the question, but only the owner can decide it — by
  correcting the requirement.
- Как правильно: check the criteria of one requirement for compatibility with each other,
  and especially size limits against rules of the kind "for every X found": before the PASS of
  the requirement check, estimate how many X there will be and compare with the limit. If it
  cannot be estimated — set an upper bound for X in the requirement itself or take the table out
  of the count (an appendix outside the limit). Do not write into one requirement "a row for
  every one found" and a size limit without an estimate of the number of rows (proposal of the
  author of step 2a, I8; finding F1). The correction of the requirement is decided by the owner:
  either count the limit without the competitor table, or keep in the document only the rows on
  which the verdict depends and take the full table out of the word count (F1).
- Где найдено: `handoffs/BP-20260930-01/step-02a-plan-writer-value.json` (`result.issues` I2,
  I8); `handoffs/BP-20260930-01/orch-notes.md` ("Risk for step 2a");
  `handoffs/BP-20260930-01/step-04-release-validator.json`, finding F1. The proposal to raise
  the bar on this matter is `decisions/0006-proposals-to-raise-the-bar.md`.

### AP-017 — A criterion "every X found" without a border of the search

- Что случилось: criterion 2 of REQ-006 requires a row for every platform found and every
  product found. The classes of products are open: the researcher of tools showed that each of
  11 new queries by class returned new repositories, and the skills.rest catalog reports
  "754,000+ skills indexed" (`result.issues` I1 of rework r2). ORCH accepted a border in the
  middle of the run (`orch-notes.md`, "Decisions of ORCH"): "found" means found by the queries
  from the section "## Где искали" ("Where we searched") of each file plus
  `research/pixel-office.md` and the corrections of step 1b. But the border cannot be
  reproduced: the checker of step 1b repeated 9 queries and found 11 suitable products without
  rows, and in `session-review-platforms.md` an unnamed phrase stayed about platforms "met only
  in headings" (remark S3), which cannot be checked. The border was recorded only in the notes of
  ORCH, not in the requirement (it was entered into `STATE.md` at step 5); in the document
  «рано» ("too early") the reservation about the border is in Question 1, but about the 11
  products there is none (finding F3 of step 4). Connected with this is the researcher's
  proposal (I2): a list "found but not opened" contradicts the criterion "every one found".
- Почему это плохо: "every one found" without a border is either impossible (the search does not
  end), or the performer and the checker each get their own "found", and the completeness of the
  table is not checked. A border invented in the middle of a run does not follow from the
  requirement and is not visible to the owner (Q12). For the result «рано» this did not break
  the criterion (adding products could only strengthen the refusal, F3), but with a PASS an
  unchecked product outside the border could change the verdict: condition 3 of the gate asks
  whether there is a product with «да» on all promised elements.
- Как правильно: in a criterion with "every one found", write the border of the search in
  the requirement itself: "found" means named in the listed sources or in the output of the
  listed queries, saved in a file so that the checker can repeat it; everything beyond the
  border is directly called "not searched". A name that got into the file is opened and either
  included in the table or excluded with a reason from the opened page; a list "found but not
  opened" is not kept. The decision about the border is written where the owner sees it
  (`STATE.md`, Q12), and the final document repeats the reservation together with the known
  exclusions. The difference from AP-014: there the class is closed (every `fs` call in
  `tools/src` is a finite list), and "find all places of the same kind" can be done; here the
  class is open, and such a search does not end.
- Где найдено: `handoffs/BP-20260930-01/step-01-market-researcher-session-review-tools-r2.json`
  (`result.issues` I1 and I2); `handoffs/BP-20260930-01/orch-notes.md` ("Decisions of ORCH");
  `handoffs/BP-20260930-01/step-01b-plan-validator-session-review-tools-r2.json` (section 4);
  `handoffs/BP-20260930-01/step-04-release-validator.json`, finding F3.

### AP-018 — The independent checker was told the expected verdict

- Что случилось: ORCH wrote into the handoff of step 2b (PLAN-VALIDATOR), in
  `context.writer_expectation`: "The author's own check says condition 3 fails (14 products
  have «да» on both promised elements) and expects «рано»; do not rely on this: recompute". In
  the task of step 4 (RELEASE-VALIDATOR) the result of the run is named in advance ("The result
  of the run is «рано» (step 2b gave FAIL…)"), although step 4 had to derive the verdict of the
  gate again and independently. No harm is shown: both checkers recalculated by themselves (2b —
  the list of 14 products matched, and by condition 2 the rating came out different from the
  author's; step 4 — the verdict matched the verdict of 2b). But step 4 itself recorded that by
  the time of the recalculation it already knew the lists of 2a and 2b and the expected result,
  and its independence rests on the method (a script over the coverage tables, stability over
  63 sets of elements, a sample comparison of pages), not on ignorance (finding F9).
- Почему это плохо: a hint weakens the independence of the checker (Q2): from a matching verdict
  one cannot tell "found by itself" from "agreed". The reservation "do not rely on this" in
  `context.writer_expectation` does not change that.
- Как правильно: to an independent checker give only artifacts and criteria — without the
  author's expectation, an earlier verdict and the result of the run (F9). Which criteria apply,
  it determines itself from the artifacts: the document has a line "Result: …", and the
  handoffs of 2a and 2b are in `handoffs/`. If a hint did go out, the checker records this in its
  handoff (this is what step 4 did).
- Где найдено: `handoffs/BP-20260930-01/step-02b-plan-validator-value.json`
  (`context.writer_expectation`); `handoffs/BP-20260930-01/step-04-release-validator.json`
  (`task.description`, finding F9); `handoffs/BP-20260930-01/orch-notes.md` ("Step 4 REQ-006:
  PASS").

### AP-019 — The rework went beyond the list of findings

- Что случилось: after the FAIL of step 1b the researcher of tools was given a rework for five
  findings (rows for Sentry, New Relic and Grafana; products not opened; Torii; Jellyfish and
  Datadog Agent Console; the market label for `/insights`;
  `step-01-market-researcher-session-review-tools-r2.json`, `task.description`). In the
  researcher's record after a break caused by a limit: "11 more queries by class were done …
  47 rows added (subsections 12–16)". The coverage table grew from 54 to 127 rows, and 47 rows
  were added from new queries that the findings did not require. The checker received for the
  repeated check (1b, round 2) a file with these 47 rows; it found 11 more suitable products
  outside the border and ten small remarks N1–N10 (`orch-notes.md`; finding F3 of step 4).
- Почему это плохо: a rework by a list is checked by a comparison "is the named thing fixed".
  When 47 new rows come together with the fixes, the comparison becomes a new check of new
  content, and the limit of reworks (two) is spent on what had no findings. This did not close
  the completeness: an open class of products does not end (AP-017), and the checker still found
  products outside the border.
- Как правильно: the task of a rework holds only the listed findings; everything the
  performer finds beyond that it records as a question in `result.issues`, and not as an edit.
  `result.changes` relates every edit to a finding (AP-013), and ORCH, before sending to a new
  1b, compares the growth of the file (rows, tables) with the list of findings. A widening of
  the search is a separate decision of ORCH with a border (AP-017), not a side effect of a
  rework.
- Где найдено: `handoffs/BP-20260930-01/orch-notes.md` ("Candidates for the error journal",
  item 9); `handoffs/BP-20260930-01/step-01-market-researcher-session-review-tools-r2.json`
  (`result.changes`, item F2; `result.summary`).

### AP-020 — A recursive chmod through a symbolic link took the execute permission from the real Node

- Что случилось: on 2026-10-01 at 17:50 and 17:53 Almaty time (12:50:35Z and 12:53:29Z) a check
  script of BACKEND-DEV in the Pixel Office run (in the scratchpad, outside the repository)
  created in a temporary tree a symbolic link `node` to `process.execPath` — the same situation
  is described by the test HK-10 of the design — and the cleanup did `fs.chmodSync(…, 0o600)` on
  the whole tree. chmod follows the link, and the execute permission disappeared from two real
  files — the programs of Node 22 and Node 25 installed on the computer; both became
  `-rw-------` (by the count of BACKEND-DEV, of 145 executable files of the same installation
  only these two became so). `node`, `npm` and `npx` answered "permission denied: node" for all
  agents and for the owner. An attempt to return the permissions was rejected by the security
  system as a change of a shared resource; only the owner can repair it. At 2026-10-01T16:52Z
  both files are still `-rw-------` (`ls -l`, without running Node).
- Почему это плохо: the failure went beyond the project and stopped the work: the tests of
  ISS-0002, the security check of Pixel Office and all `npm run check` do not run until the
  owner returns the permissions. The trap was visible in advance: the test HK-10 of the design
  puts exactly such a link, and the same trap waited in the real tests (BACKEND-DEV, I8). A
  cleanup that has to return permissions to files made unreadable on purpose walks the tree
  recursively and does not tell a link from a file.
- Как правильно: tests and scripts do not change the permissions of anything outside their
  temporary folder. chmod only on named paths, through `lstat`, not through links; no `chmod -R`
  and no walks that follow links. In tests and scripts the link "node" leads not to
  `process.execPath` and not to a real binary, but to a stub script in a temporary folder (a hard
  rule of ORCH, `orch-notes.md`). The cleanup of the temporary folders of tests is safe (`lstat`,
  no chmod through links), with a regression test: inside the tree to be cleaned there is a link
  to a file with known permissions, and the permissions of the target did not change after the
  cleanup. A check from the proposal of BACKEND-DEV (I8): `stat` of `process.execPath`
  (permissions and ctime) is the same before and after `npm run check`; `grep chmodSync` over
  `tools/test` finds only named paths. As a proposal to raise the bar it was put to the owner in
  `decisions/0006-proposals-to-raise-the-bar.md`. Check commands that need Node begin with
  `node -v`: a refusal to start is visible at once (finding F11).
- Где найдено: `handoffs/PO-20260930-01/step-02-backend-dev.json` (`result.issues` I0, I8);
  `handoffs/BP-20260930-01/orch-notes.md` ("INCIDENT 2026-10-01 ~17:50 Almaty time");
  `handoffs/ISS-0002-20260930-01/step-07-test-design-validator.json` ("ENVIRONMENT");
  `handoffs/BP-20260930-01/step-04-release-validator.json`, finding F11.

### AP-021 — A workaround for an environment failure instead of taking it to the owner at once

- Что случилось: after AP-020 ORCH passed to the owner a request to repair the permissions
  (the command `chmod 555 …`), but did not stop the affected steps until the answer, and
  offered the agents a workaround — a personal copy of Node 22.21.1 in the scratchpad and
  `PATH=<scratchpad>/bd/nodebin:$PATH` (ORCH checked `node -v`; `orch-notes.md`, "INCIDENT
  2026-10-01"; in the task of TEST-DESIGNER ISS-0002 this rule stands as `orch_rulings.node`).
  The workaround did not work for everyone. The security system refused TEST-DESIGNER ISS-0002
  ("[Code from External]") on the very first command with such a PATH, and it ran nothing
  (tests, prettier, eslint and mutants did not run); when the coordinator repeated the
  instruction, it did not follow it, because an agent's message does not lift a refusal of the
  system. TEST-DESIGN-VALIDATOR got a refusal on the same command, then worked on its own copy
  of Node with the same bytes, and dropped the results of three commands in the window of the
  breakage, probably run on Node 25. For RELEASE-VALIDATOR of step 4 of REQ-006 the workaround
  worked (its finding F11). ORCH itself recorded the conclusion: the workaround is "unreliable
  and must not be used as a solution" (`orch-notes.md`, "BLOCK 2026-10-01 ~22:00").
- Почему это плохо: a failure of a shared tool outside the project is not a task for a workaround
  by the agents. An instruction to run another copy asks the agent to execute a file that the
  security system has not approved, and a message of ORCH is not the owner's consent and does
  not lift the refusal of the system. The result differs between runs: some worked on the
  copy, another stopped, and the results of several commands had to be dropped because it is
  unclear on which Node they ran.
- Как правильно: ORCH takes an environment failure outside the project (file permissions,
  a shared tool, the disk) to the owner at once — what broke, how it is confirmed (`ls -l`,
  time), the exact repair command, what stands because of it — and stops the affected steps
  until the answer, and does not look for a workaround. A refusal of the security system is not
  repeated and not forwarded to the agents again. Agents may work on a personal copy of Node
  only with the owner's explicit permission (`orch-notes.md`: "explicit permission of the owner
  for the rule with a copy of Node"); until then such steps stand blocked with the named
  command for the owner.
- Где найдено: `handoffs/BP-20260930-01/orch-notes.md` ("INCIDENT 2026-10-01 ~17:50 Almaty
  time", "BLOCK 2026-10-01 ~22:00 Almaty time");
  `handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json` (`context.orch_rulings.node`,
  `result.issues` I1); `handoffs/ISS-0002-20260930-01/step-07-test-design-validator.json`
  ("ENVIRONMENT"); `handoffs/BP-20260930-01/step-04-release-validator.json`, finding F11.

### AP-022 — The project stands on files outside its folder

- Что случилось: the role files, the quality bar and the handoff protocol referred to files
  outside the Sai folder, and the working documents had paths of this computer (the home
  folder, folders of installed programs, temporary folders of the session).
- Почему это плохо: on another computer an agent does not find its rules and works by guess (Q3);
  commands and checks with paths of this computer break there.
- Как правильно: everything an agent needs is in the Sai files; paths are from the Sai
  root, temporary places are called `<outside the project>`. Portability is
  checked by a copy of the Sai folder in a clean place: `cd tools && npm ci && npm run check`
  passes, and a search for paths of this computer over Sai gives 0.
- Где найдено: `PLAN.md`, iteration 2.

### AP-023 — An edit of a block of a shared file without a "before" copy outside the project

- Что случилось: in the run `PO-20261002-01` ORCH told REQ-ANALYST to edit one block at a time
  of the shared file `docs/requirements.yaml`: at step 00a — the block REQ-007
  (`context.edit_scope`: "only the block REQ-007; hashes of the other blocks before and after —
  in result"), at step 00c — the block REQ-001. ORCH did not take a copy of the file before the
  edit outside the project — there is no `context.before_copy` in these handoffs. So the
  independent check of step 00b "except for its block, nothing changed" relied on the hashes of
  the author of the edit and on old partial copies; ORCH recorded this in `context.before_copy`
  of the handoff of step 00b.
- Почему это плохо: the checker cannot compare the file "before" and "after" byte by byte itself —
  the proof that other blocks are intact is given by the same agent who could have touched them
  (Q2). Old copies are out of date: for blocks that changed after them there is nothing to
  compare with. The shared file is written by different steps and runs (in this run — two
  blocks, at steps 00a and 00c), and an accidental edit of another block would pass unnoticed.
- Как правильно: before any task with `context.edit_scope` on a shared file, ORCH copies
  the file outside the project and names the copy in `context.before_copy`; the checker compares
  "before" and "after" itself, by this copy. This was done in the rework of the same run: before
  round 1 ORCH took a copy and named it in the task (`step-00a-req-analyst-r1.json`).
- Где найдено: `handoffs/PO-20261002-01/step-00a-req-analyst.json` and
  `handoffs/PO-20261002-01/step-00c-req-analyst-req001.json` (no `before_copy` in `context`);
  `handoffs/PO-20261002-01/step-00b-req-validator.json` (`context.before_copy` — ORCH's record
  that there is no copy); a note of ORCH in the task
  `handoffs/SA-20261001-01/step-2c-final-doc-updater.json`.

### AP-024 — The trace check does not cover all signs at once

- Что случилось: the trace searches at steps 2b–2d of iteration 2 (`PLAN.md`) looked for names
  of other projects and paths of this computer, but not for names of neighbouring folders of this
  computer (for example, folders where sessions start) and not for the names of the employer
  company, its product and its system. So the line `tools/README.md:47` and lines in `ideas/`
  were found only in part C of step 2d.
- Почему это плохо: "no traces" by an incomplete list of signs is a false "done" (Q3); every new
  sign needs a new round over the same files, and what is found later may already have gone into
  a copy or into git history.
- Как правильно: the check "no traces" lists all signs at once — names of other projects,
  the author of the sample, paths of this computer, names of neighbouring folders, names of the
  employer company, its product and its system — and looks for them in one pass; the list of
  signs is written into the task of the check (this is how it is written in `PLAN.md`, step 2g).
- Где найдено: `handoffs/SA-20261001-01/step-2d-c-doc-updater-r1.json`, `result.issues` (I2).

### AP-025 — A test helper starts a server on the default port

- Что случилось: when the test SV-48 was written, the helper `runMain` started the Pixel Office
  server without `--port`, that is, on the default port 4780, where the owner's real Pixel
  Office runs. The start hit the busy port, and the check "Pixel Office is already here" sent
  one GET request to 4780 (read only; the owner's journal did not change). The helper is fixed:
  without `--port` it substitutes `--port 0`.
- Почему это плохо: the test could read or change the owner's working data, and its result
  depended on whether the owner has the real server running (the test is not independent, Q5).
- Как правильно: a test helper that starts a server always passes an explicit port 0 and a
  separate temporary state folder; if the port is not 0, the test fails at once and loudly and
  does not go on.
- Где найдено: `handoffs/PO-20261002-01/step-05-test-designer.json`, `result.issues` (I6).

### AP-026 — A long document in parts outside the project without an assembly plan

- Что случилось: the design of the office code (`docs/design/REQ-001-pixel-office.md`, run
  `PO-20261002-01`) was written as drafts in parts outside the project, and there was no
  assembly plan file "section → source". After the first run was stopped, the next one restored
  the plan by the names of the parts.
- Почему это плохо: after a break it is easy to lose or double a section; the checker cannot
  compare that the assembled document took each section from the right part.
- Как правильно: a long document written in parts at once gets an assembly plan file
  "section → part file → is it ready", next to the parts; the assembly goes by it, and it is
  named in the handoff.
- Где найдено: `handoffs/PO-20261002-01/step-01-code-designer-run2.json`, `result.issues` (I7,
  item 8).

### AP-027 — A criterion of a requirement names the folder of one run

- Что случилось: a criterion of a requirement named the folder of a specific run, while the
  step it checks repeats in the next runs too.
- Почему это плохо: in the next run the criterion checks the old folder — the check passes on
  other people's files or becomes impossible, and the requirement has to be corrected again.
- Как правильно: the criterion names the run folder as a template
  (`handoffs/<RUN-ID>/…`), and the specific run only in a comment to the status or in the
  history of the requirement.
- Где найдено: `handoffs/PO-20261002-01/step-01-code-designer-run2.json`, `result.issues` (I7,
  item 9; I1 there too).

### AP-028 — After a rework of code the chain was not restarted from the touched gates

- Что случилось: in the run `PO-20261002-01`, after the edits of CODE-FIXER and the reworks of
  TEST-DESIGNER (r2, r3), ORCH did not restart TEST-RUNNER (step 6) and sent the work on. The
  omission was found by RELEASE-VALIDATOR in the final check (finding RV-1); step 6 was passed
  again (`handoffs/PO-20261002-01/step-06-test-runner-r1.json`), and only after that the final
  check gave PASS.
- Почему это плохо: a gate passed on the earlier code says nothing about the new code (Q2); the
  omission is caught only at the last step, and the run loses a round.
- Как правильно: any rework restarts the chain from the gates it touched, including
  TEST-RUNNER; ORCH keeps for each round a list "which gates were passed again, by which
  handoff".
- Где найдено: `handoffs/PO-20261002-01/step-09-release-validator.json` (RV-1);
  `handoffs/PO-20261002-01/step-09-release-validator-r1.json` (RV-1 closed).

### AP-029 — The expected verdict in the task for a checker — again

- Что случилось: this is a repeat of AP-018. In the task of the final check of the run
  `PO-20261002-01` ORCH again wrote the expected verdict: "Give the final verdict: PASS provided
  that «не проверено» ("not checked") is only …". RELEASE-VALIDATOR recorded this and derived
  PASS from its own checks.
- Почему это плохо: the same as in AP-018: the task suggests the answer to an independent checker,
  and its independence has to be proved separately; the repeat shows that the lesson of AP-018
  did not become a habit.
- Как правильно: a task for an independent checker lists what to check and which items may
  be left «не проверено» — and never names the verdict. Before sending, ORCH searches the text of
  the task for the words "PASS" and "FAIL".
- Где найдено: `handoffs/PO-20261002-01/step-09-release-validator-r1.json`
  (`task.description`; `result.summary`, last line).

### AP-030 — No "before" copy of a shared file before an edit — again

- Что случилось: this is a repeat of AP-023. In the run `PO-20261005-01` ORCH reported in the
  task of step 10 (`handoffs/PO-20261005-01/step-10-doc-updater.json`) that a shared file had no
  "before" copy taken before the edit. Which file exactly is not named in the task; copies of the
  block of requirements exist at steps 00a and 00b (`context.before_copy`), so it is about
  another shared file of the run.
- Почему это плохо: the same as in AP-023: the checker cannot compare "before" and "after" byte by
  byte itself, the proof that other parts are intact is given by the same agent who could have
  touched them (Q2); the repeat shows that the lesson of AP-023 did not become a habit.
- Как правильно: before any task that edits a shared file, ORCH takes a copy outside the
  project and names it in `context.before_copy`; a task without `before_copy` on a shared file is
  not sent.
- Где найдено: the task of step 10 of the run `PO-20261005-01`
  (`handoffs/PO-20261005-01/step-10-doc-updater.json`, `task.description`, item 5а).

### AP-031 — The expected result is named to the validator in advance — again

- Что случилось: this is a repeat of AP-018 and AP-029. In the tasks of the checkers of the run
  `PO-20261005-01` there are expected results: "439 of 439 is expected" (steps 5b, 6 and 9) and
  "criterion 16 … is not a reason for FAIL" (step 9). The checkers ran the check themselves
  (`handoffs/PO-20261005-01/step-06-test-runner.json`,
  `handoffs/PO-20261005-01/step-09-release-validator.json`), the numbers matched.
- Почему это плохо: the task suggests the answer to an independent checker, and its independence
  has to be proved separately (Q2); the third repeat in a row (AP-018, AP-029, this one).
- Как правильно: the task for a checker says what to run and which items may be left
  «не проверено», and names neither the verdict nor the expected number; before sending, ORCH
  searches the text for "PASS", "FAIL" and "expected" («ожидается»).
- Где найдено: `handoffs/PO-20261005-01/step-05b-test-design-validator.json`,
  `step-06-test-runner.json`, `step-09-release-validator.json` (`task.description`).

### AP-032 — TEST-RUNNER was not restarted after a round of edits

- Что случилось: by the report of ORCH in the task of step 10, in the run `PO-20261005-01`, after
  a round of edits the check run (step 6) was not restarted; this is a repeat of AP-028. The last
  check run in the files is `handoffs/PO-20261005-01/step-06-test-runner.json` (16:15:01Z, 439 of
  439, twice in a row); RELEASE-VALIDATOR ran `npm run check` itself and got the same 439 of 439
  (`handoffs/PO-20261005-01/step-09-release-validator.json`), so the omission did not affect the
  result.
- Почему это плохо: a gate passed on the earlier code says nothing about the new one (Q2); the
  omission is caught only at the last step.
- Как правильно: as in AP-028 — any rework restarts the chain from the touched gates,
  including TEST-RUNNER; ORCH keeps a list "which gates were passed again, by which handoff".
- Где найдено: the task of step 10 of the run `PO-20261005-01`
  (`handoffs/PO-20261005-01/step-10-doc-updater.json`, `task.description`, item 5в).

### AP-033 — The trace check did not cover all signs in one pass — again

- Что случилось: this is a repeat of AP-024. In the run `PO-20261005-01` the trace check again
  did not cover all signs at once (by the report of ORCH in the task of step 10). Example: the
  list of signs in the task of step 10 — names of other projects, paths of this computer and the
  folder of temporary files — is shorter than the list from AP-024 (there are no names of the
  company, its product and system, and no names of neighbouring folders).
- Почему это плохо: "no traces" by an incomplete list is a false "done" (Q3); every missing sign is
  a new round over the same files.
- Как правильно: the list of signs is taken from the record AP-024 and from `PLAN.md`, step
  2g, and is written into the task of the check in full; it is searched in one pass over all
  changed files.
- Где найдено: the task of step 10 of the run `PO-20261005-01`
  (`handoffs/PO-20261005-01/step-10-doc-updater.json`, `task.description`, items 5г and «Границы» ("Limits")).

### AP-034 — REVIEWER could not write its handoff (an environment limit)

- Что случилось: at step 4 of the run `PO-20261005-01` REVIEWER gave the verdict PASS in a
  message, but could not write the fields `status`, `completed_at` and `result` into its
  handoff: in its environment there is no safe way to edit only these fields. The result was
  written by ORCH with the mark `not_agent_attested` (who wrote, when, on what basis, what cannot
  be checked).
- Почему это плохо: the handoff looks as if written by the checker itself, although ORCH wrote it;
  without the mark this is a substitution of the source (Q2). This is not an error of the agent
  but a limit of the environment.
- Как правильно: when an agent cannot write its handoff, ORCH carries over its report and
  adds `not_agent_attested` with the fields `written_by`, `at`, `reason`, `fields_written`,
  `evidence`, `unverifiable`, as in this run; without a verdict in the agent's message the
  handoff is not filled in. Removing the limit is a separate task of ORCH.
- Где найдено: `handoffs/PO-20261005-01/step-04-reviewer.json`, field `not_agent_attested`.

### AP-035 — A CODE-DESIGNER design contradicts itself in two places

- Что случилось: in the run `PO-20261005-02` the design `docs/design/REQ-008-history.md` was
  returned twice by the design gate because of differences inside the design itself. The first
  time: in the lines of criteria 3 and 14 it said "extension HK-11c, HK-11d, HK-12b", while item
  12.1 said that exactly four earlier tests change and the others "do not change" (finding N1,
  `handoffs/PO-20261005-02/step-01b-code-design-validator-r1.json`). In the same place: the design
  allowed opening the window from the agent card, and the description of the interface forbade it
  (N2). In the first run — the same differences between sections (F2, F3). The gate caught this
  three times in a row.
- Почему это плохо: the developer gets two laws instead of one and either chooses at random or
  breaks the earlier tests; in every round an edit of one place leaves the second (Q2: the gate
  catches it, not the author).
- Как правильно: before handing in, CODE-DESIGNER compares the design with itself: every
  place where the same thing is named (the list of earlier tests that change, the markup of the
  card, the table "criterion → test") is read next to the others; in a rework every place where it
  is mentioned is edited, not one.
- Где найдено: `handoffs/PO-20261005-02/step-01b-code-design-validator.json`,
  `step-01b-code-design-validator-r1.json`, `step-01-code-designer-r1.json`.

### AP-036 — The expected result is named to the validator — the fourth time

- Что случилось: this is a repeat of AP-018, AP-029 and AP-031. In the gate tasks of the run
  `PO-20261005-02` ORCH again named to the checker the expected verdict or conclusion (by the
  report of ORCH in the task of step 10; in particular a hint about the developer's issue 4, for
  which SECURITY-REVIEWER recorded that it derived the verdict from its own probes:
  `handoffs/PO-20261005-02/step-03-security-reviewer.json`, `result.issues`, "AP-018").
- Почему это плохо: from a matching verdict one cannot tell "found by itself" from "agreed"; the
  independence of the checker has to be proved separately (Q2). The fourth repeat shows that the
  records AP-018, AP-029, AP-031 did not become a habit.
- Как правильно: as in AP-031 — the task for a checker says what to run and which items may
  be left «не проверено», and names neither the verdict nor the expected number; before sending,
  ORCH searches the text for "PASS", "FAIL", "expected" («ожидается») and the developer's
  "issue".
- Где найдено: the task of step 10 of the run `PO-20261005-02`
  (`handoffs/PO-20261005-02/step-10-doc-updater.json`, `task.description`, item 4б); `handoffs/PO-20261005-02/step-03-security-reviewer.json`.

### AP-037 — The hook sent the signed body with the default agent: it went to the proxy

- Что случилось: the Pixel Office hook sent the signed body of the record with the ordinary
  default Node agent. With `NODE_USE_ENV_PROXY=1` and `HTTP_PROXY` set, such a request goes to the
  proxy and not directly to `127.0.0.1`. CODE-DESIGNER found it by a measurement before the design
  (`docs/design/REQ-008-history.md`, item 0, line F6: with the default agent the request went to
  the proxy); the decision is item 13, I8: the hook and the write command got their own
  `http.Agent` (tests HK-28, SV-70).
- Почему это плохо: the local signed write and the text of the owner's request would have left the
  computer through someone else's proxy — against the border "only `127.0.0.1`, nothing goes
  outside" (`decisions/0011`, Q7); a developer environment with a proxy does this silently.
- Как правильно: every outgoing call of Pixel Office (the hook, the write command, any new
  client) is created with its own `http.Agent` and the address `127.0.0.1`; a test replaces the
  environment (`NODE_USE_ENV_PROXY=1`, `HTTP_PROXY`) and checks that the connection goes to
  `127.0.0.1` and not to the proxy.
- Где найдено: `docs/design/REQ-008-history.md` (item 0, F6; item 13, I8),
  `handoffs/PO-20261005-02/step-01-code-designer.json`.

### AP-038 — Agents write status "DONE" and a time later than now into a handoff — again

- Что случилось: a repeat: an agent wrote the value `DONE` into `status` of a handoff instead of
  `COMPLETED`/`FAILED`; ORCH corrected the record and marked the edit in `context.orch_corrections`
  (`handoffs/PO-20261005-02/step-00a-req-analyst-r3.json`: `status` "DONE" → "COMPLETED", the
  reason — only COMPLETED/FAILED are allowed). By the report of ORCH in the task of step 10, a
  `completed_at` later than now was also met.
- Почему это плохо: a status outside the list breaks the handoff check; a time from the future is a
  record not from the clock (quality-bar §6 item 8, AP-002), and a comparison by time cannot trust
  it.
- Как правильно: in `status` only `COMPLETED` or `FAILED`; `completed_at` is the output of
  `date -u +%Y-%m-%dT%H:%M:%SZ` at the moment of writing, not earlier than `started_at` and not
  later than now; what ORCH finds, it corrects with a record `orch_correction` (field, was, became,
  reason), without a silent edit.
- Где найдено: `handoffs/PO-20261005-02/step-00a-req-analyst-r3.json`
  (`context.orch_corrections`); `handoffs/PO-20261005-01/step-07-design-qa-validator.json`
  (`status` "DONE" in the file); the task of step 10
  (`handoffs/PO-20261005-02/step-10-doc-updater.json`, item 4г).

### AP-039 — A requirement for a screen is written for two "nice" sizes and not for the owner's real windows

- Что случилось: criterion 17 of REQ-007 (scale for Full HD and 2K) was written only for windows
  1920 × 1080 and 2560 × 1440 and was met in them, but the owner sees the page in windows of about
  1470 × 784 (MacBook 13) and about 1920 × 950 (a 25-inch monitor): the office cell was 15 px, the
  character about 11 px, and the label unreadable. A new criterion 18 and one more run were needed
  (`PO-20261006-01`, `decisions/0016-pixel-office-compact-office.md`).
- Почему это плохо: "works on Full HD and 2K" does not say whether it works for the owner; a browser
  window is smaller than the monitor (panels, the address bar), and on a Retina screen the pixel
  density is 2 — the CSS size of the window is not the size of the screen.
- Как правильно: in a requirement for a screen, list the real sizes of the owner's browser
  window in CSS px (not the size of the monitor), with the owner's snapshot if there is one, and
  measurable thresholds of readability (cell, height of the figure, font of the label in px);
  check in each of these windows.
- Где найдено: `docs/requirements.yaml` (REQ-007, criteria 17 and 18);
  `docs/design/samples/office-owner-1470x784-2026-10-06.png`;
  `handoffs/PO-20261006-01/step-00b-req-validator.json`.

### AP-040 — The arithmetic of the canvas height showed up only at the requirement gate

- Что случилось: the first version of criterion 18 allowed a grid of 36 × 24 cells of 27 px (648
  px high), while under the canvas in a 1470 × 784 window with a legend of 7 rows about 513 px
  remain; REQ-VALIDATOR rejected the requirement, and the limit became 36 × 22 (r2). The author of
  the requirement did not do the calculation by `tools/src/pixel-office/public/style.css` before
  handing in.
- Почему это плохо: a numeric requirement that physically does not fit into the window was passed by
  the author; the error was found by an expensive gate and not by a simple subtraction.
- Как правильно: before handing in a requirement or a design with sizes, count the budget of
  the window by `style.css` and the drawing constants (height of the window minus the header, the
  legend, the margins = the place of the canvas) and write the calculation next to the number.
- Где найдено: `handoffs/PO-20261006-01/step-00b-req-validator.json` (the remark about the
  height), `step-00a-req-analyst-r2.json`.

### AP-041 — ORCH did not record "how I understood" of the owner's messages in the «Просмотр истории» ("History view") window

- Что случилось: the role of ORCH obliges it to record every message of the owner and "how I
  understood" with the command `pixel-office-note`, the «Просмотр истории» ("History view") window (REQ-008) is ready
  for this, but in the run `PO-20261006-01` the records for the owner's message were not made (by
  the report of ORCH in the task of step 10).
- Почему это плохо: the window shows the owner an empty place where his own order and the agent's
  understanding should be; it cannot be checked whether it was understood correctly.
- Как правильно: for every message of the owner, before the work begins — a record with the
  command `pixel-office-note` with "how I understood"; ORCH checks this in the bookkeeping check.
- Где найдено: the task of step 10 (`handoffs/PO-20261006-01/step-10-doc-updater.json`,
  `task.description`); `.claude/agents/orchestrator.md`.

### AP-042 — Code was edited after the last PASS of the gate steps without the gates again

- Что случилось: in the run `PROD-20261006-01` the code of the core and the executors changed
  after the PASS of the gate steps (15, 16, 19, 21) and did not pass the gates again; the
  acceptance (RELEASE-VALIDATOR, step 20) returned FAIL (findings F6, F7).
- Почему это плохо: a PASS belongs to the code that was checked; after an edit it proves nothing, and
  acceptance finds what the security and review gates would catch more cheaply.
- Как правильно: after any code edit made after a PASS, repeat steps 3–4 (security and
  review) and the tests before acceptance; ORCH checks that the last code edit is earlier than the
  last PASS of the gates.
- Где найдено: `handoffs/PROD-20261006-01/step-20-release-validator.json`,
  `step-24-code-design-validator.json`.

### AP-043 — The design of the executors never got a PASS: edits went one after another after a FAIL

- Что случилось: the design REQ-010 was edited in several versions in a row by lists of findings,
  and the design gate never returned a PASS before the code began; they moved to the code on "the
  finding is fixed".
- Почему это плохо: a fix can bring in a new difference (AP-005, AP-014); without a repeated gate the
  design goes into the code unchecked.
- Как правильно: repeat the design gate until PASS; move to the code only on a PASS, and not
  on the author's statement of a fix.
- Где найдено: `docs/design/REQ-010-agent-executors.md` (r1…r7),
  `handoffs/PROD-20261006-01/step-24-code-design-validator.json`.

### AP-044 — Earlier tests that a new version of the code changed stayed red

- Что случилось: a new version of the code changed behaviour that the earlier tests expected; 11
  tests stayed red until someone analysed them separately.
- Почему это плохо: a red set slows all steps and pushes toward "fitting" the tests (Q6) or arguing
  whose failure it is.
- Как правильно: the design and the handoff of the code contain a plan for updating the
  earlier tests (before → after, no check weakened); the tests are edited by the one who changes
  the behaviour, in the same work.
- Где найдено: `handoffs/PROD-20261006-01/` (the bookkeeping task, step 27),
  `docs/design/REQ-009-team-core.md` (items 15.1a, 15.1b).

### AP-045 — A test without its own timeout hung on a broken protection

- Что случилось: with a broken protection (mutant V07) a test that waits for a process or a stream
  had no timeout of its own and hung; the check did not turn red but stood still.
- Почему это плохо: a hung run cannot be told from a slow one; the mutant is not "killed", and the
  check loses its meaning (Q6) and holds the pipeline.
- Как правильно: every test that waits for a process, a stream or an event has its own
  limited timeout with an understandable message; mutants are checked so that the test fails and
  does not hang.
- Где найдено: `handoffs/PROD-20261006-01/step-24-code-design-validator.json` (mutant V07), tests
  `tools/test/exec-*.test.js`.

### AP-046 — A concurrency edit brought a regression caught only by the final security check

- Что случилось: a recovery edit (r5) brought in a race of the openers after a crash (S1): the
  recovery depended on who removed the stale lock. There were no race tests in the same step; the
  regression was found only by the final security check, by a repeated probe of the race.
- Почему это плохо: a concurrency error is not visible with one process; it reaches the last gates
  and costs an extra round of edits and repeated gates (AP-042).
- Как правильно: every edit that changes concurrency (a lock, recovery, the order of
  writing) has in the same step a race test that fails on the earlier code.
- Где найдено: `handoffs/PROD-20261006-01/step-36-code-fixer.json`, `step-28-code-fixer.json`;
  `docs/design/REQ-009-team-core.md` (r8, P13, TM-67).

### AP-047 — A race test is unstable under load

- Что случилось: a race test (F1 of the test gate) passed in a single run and failed or depended
  on time when other processes ran next to it.
- Почему это плохо: an unstable race test either turns red for no reason or silently misses an
  error; people stop believing it (Q6).
- Как правильно: check race tests in 4 parallel processes, not only one by one; wait for an
  event, not for a pause.
- Где найдено: `handoffs/PROD-20261006-01/step-40-test-design-validator.json` (F1),
  `tools/test/team-recovery.test.js` (TM-67).

### AP-048 — The mutant "lock check after the write" survived: the tests checked the result and not the absence of side calls

- Что случилось: a mutant that moved the lock check AFTER the write stayed alive: the failure
  tests checked the result (the error and the state), but not that on a refusal there were no
  calls to the journal at all.
- Почему это плохо: a refusal that has already reached the journal leaves traces or a partial
  write; the test "the state did not change" (Q5) does not see this.
- Как правильно: a failure test checks both the result and the absence of side calls (0
  writes, 0 `fsync`, 0 reads of the journal where the refusal must come earlier); for a new
  protection, the mutant "check later" must be killed.
- Где найдено: `handoffs/PROD-20261006-01/step-44-test-design-validator.json`,
  `step-41-test-designer.json`.

### AP-049 — The final acceptance started before the design edit was finished and before the repeated design gate

- Что случилось: step 9 (RELEASE-VALIDATOR) was created at 04:33:49Z, and the design edit step-48
  finished at 04:36:00Z and was not re-checked by the gate of step 1b: the last verdict of the
  design gate stayed FAIL (step-46). The acceptance returned FAIL for the process (step-49, F1).
  The release report at the same time said that the designs had passed the gates (F2), and the
  requirement statuses stood at `pending` (F3).
- Почему это плохо: the acceptance checks files that can still change; its verdict does not belong
  to what will remain. An extra round of acceptance.
- Как правильно: a repeat of AP-028 — do not start step 9 until step 1b of the last design
  edit is finished with PASS; the release report names the verdicts of the gates by fact and
  chronology, not "passed"; the status `in_progress` is set at the start of the run.
- Где найдено: `handoffs/PROD-20261006-01/step-49-release-validator.json` (F1, F2, F3),
  `step-50-code-design-validator.json`.

### AP-050 — Paths of this computer in the handoffs of a run

- Что случилось: in 65 of 85 handoffs of the run PROD-20261006-01 (`context.before_copy`,
  `task.description`) absolute paths of the temporary folder of this computer are written.
- Почему это плохо: bookkeeping files are only appended to, so such paths stay in history and will
  get into the commit; for another reader they mean nothing.
- Как правильно: in new handoffs write "<outside the project>/…"; do not
  rewrite old ones — the replacement at commit is done by ORCH.
- Где найдено: `handoffs/PROD-20261006-01/step-49-release-validator.json` (L2).

### AP-051 — The requirement status was not moved to in_progress at the start of the run (a repeat of AP-049)

- Что случилось: the run PROD-20261006-02 (REQ-013) went on to step 9, while in
  `docs/requirements.yaml` the requirement stood at `pending`; the acceptance step-43 returned
  FAIL for this (F1, High), and the status `in_progress` was set only by step-44.
- Почему это плохо: Q14 — bookkeeping is not postponed; from the requirement files one cannot tell
  that work is going on, and the checker spends a round on the obvious.
- Как правильно: step 0 of WF-02 is the first action of the run: the status `in_progress` in
  the requirement block, before the handoff of the first role.
- Где найдено: `handoffs/PROD-20261006-02/step-43-release-validator.json` (F1, F5),
  `step-44-release-validator.json`; a repeat of AP-049.

### AP-052 — Paths of this computer in handoffs (a repeat of AP-050)

- Что случилось: in the handoffs of the run PROD-20261006-02 absolute paths of the temporary
  folder and of the user folder appeared again; RELEASE-VALIDATOR (step-43, F4) found them in 7
  files, step-44 confirmed the replacement in step-15, 18, 21, 25, 34, 42: ORCH replaced them
  with `<рабочая папка ORCH>` (ORCH working folder) and `<корень Sai>` (Sai root).
- Почему это плохо: handoffs are only appended to, paths stay in history and get into the commit;
  for another reader they mean nothing.
- Как правильно: in the task and the report write `<рабочая папка ORCH>` and `<корень Sai>`
  at once; before handing in a step run
  `grep -rnE '/Users/|/private/tmp|/var/folders' handoffs/<RUN-ID>/` — it must be empty.
- Где найдено: `handoffs/PROD-20261006-02/step-43-release-validator.json` (F4),
  `step-44-release-validator.json`; a repeat of AP-050.

### AP-053 — The ORCH working folder was wiped, and the process relied on it

- Что случилось: by the report of ORCH, shutting down the laptop wiped the ORCH working folder;
  in it lay the "before" copies, the logs of runs and the snapshots of the checkers, which the
  handoffs of the run PROD-20261006-02 refer to.
- Почему это плохо: the links in handoffs lead into emptiness; the evidence cannot be re-checked
  (Q2, Q3), the "before" copy cannot be restored.
- Как правильно: everything the process needs (the "before" copies, outputs of checks,
  numbers for comparison) lies in the project — in a handoff or in `docs/`/`handoffs/`; the
  working folder is only for temporary things whose loss breaks nothing. The needed output of a
  check is pasted into `result` of the handoff, and not only given as a link to a file in the
  working folder.
- Где найдено: the order of ORCH to this step (`handoffs/PROD-20261006-02/step-45-doc-updater.json`);
  not checked in the file system, recorded from the words of ORCH.

### AP-054 — Tests with timers were considered unreliable because of a machine without a protocol of pauses

- Что случилось: on an overloaded machine four full `npm run check` gave 11, 9, 7 and 17 failures
  in different files (`handoffs/PROD-20261006-02/step-41-test-designer.json`, load average 12–17
  on 10 cores); the cause was named by a guess "pauses of the machine/sleep are possible", there
  was nothing to measure the pauses with. The step went to BLOCKED, and on a calm machine the same
  940 tests passed (step-42, step-44).
- Почему это плохо: without a measurement one can neither blame the failure on the machine
  (quality-bar §6, item 4 requires evidence) nor leave it with the work; the test is no longer
  waited for, red is counted as noise (ISS-0004).
- Как правильно: before a run of timer tests — a calm machine (`uptime`, nothing in parallel,
  `caffeinate`) and a record of load average before and after; a pause monitor is needed (the
  protocol: compare the clock and the counter of the process over the time of the test, a pause
  above the threshold is marked in the report). A failure with a pause mark is repeated on a calm
  machine; without a mark and without a repeat it stays with the work. While there is no monitor,
  this is a proposal, not an item of the bar.
- Где найдено: `handoffs/PROD-20261006-02/step-41-test-designer.json`, `step-42-test-runner.json`;
  defect ISS-0004.

### AP-055 — The words of a requirement and the design were compared for three rounds because of a difference in the wording of the output

- Что случилось: the check of the words of the requirement REQ-014 against the design went for
  three rounds: REQ-VALIDATOR gave FAIL (`step-03`: criterion 1 about the output for the name in
  the file name and criterion 4 about the git arguments did not match the design), then PASS only
  after two edits of REQ-ANALYST (`step-06`, `step-08`); one more edit of the words was needed
  after the code (`step-15`). Every round is a difference of wording between a criterion and an
  item of the design, not between the intention and the code.
- Почему это плохо: every round is extra runs of two roles; the wording of the output and of the
  calls (the label, the arguments) in two places is edited independently and diverges; had the
  difference reached acceptance, it would have become a defect (Q12).
- Как правильно: write the wording of the output and the exact arguments of calls in one
  place and refer to it from the second (a criterion to an item of the design, the design to the
  criterion); before the gate, check the verbatim comparison of these places, as REQ-VALIDATOR
  does in `step-06`. While it is a proposal, it is not an item of the bar.
- Где найдено: `handoffs/PROD-20261009-01/step-03-req-validator.json`,
  `step-06-req-validator.json`, `step-08-req-validator.json`, `step-15-req-validator.json`. A
  related finding of the acceptance: a line of the table of failure paths, item 7 of the design
  («usage + справка», "usage + help"), differed from the code and from item 2/TC-24, and was
  corrected during bookkeeping (`step-21-release-validator.json`).

### AP-056 — Times in handoffs were not written from the clock, and the "fix" was not from the clock either

- Что случилось: in the handoffs of the run `PROD-20261010-01` the times `completed_at` and
  `started_at` were written "approximately". When this was found, ORCH corrected them with the
  field `orch_correction.at = 2026-10-10T18:30:00Z` in four files (`step-23`, `24`, `25`, `27`);
  the commit with this value was made at 18:27:31Z — the value stands 2.5 minutes later than the
  commit it lies in, a clock could not give that (RELEASE-VALIDATOR, `step-50`, F1, FAIL of round
  3). The same kind of error is in `step-47`: the time 18:31:00Z against the clock 18:30Z.
- Почему это плохо: a journal that must prove the order of events itself contains events from the
  future (R2, Q3); fixing a wrong time with a wrong time fixes nothing (AP-002, AP-014:
  neighbouring places of the same kind).
- Как правильно: time is only `date -u +%Y-%m-%dT%H:%M:%SZ` at the moment of writing; an
  unknown time is `null` and the words "not later than <the time of the commit>" (this is how it
  was done in round 4: `orch_correction.at: null`, `at_note`); when correcting a time, compare the
  new value with the time of the commit it will get into (`git log -1 --format=%cI`), not with
  memory.
- Где найдено: `handoffs/PROD-20261010-01/step-50-release-validator.json` (F1),
  `step-51-release-validator.json`.

### AP-057 — Step 1 of WF-03 skipped, the design written after the fact, a violation of the bar called an "accepted risk"

- Что случилось: for ISS-0010 step 1 of WF-03 was not done (ISSUE-FIXER: diagnosis, reproduction,
  places of the same kind); the design of the fix was written at once by CODE-DESIGNER, and its
  handoff `step-44-code-designer-iss0010.json`, without `result`, was written by ORCH later than
  the work (`not_agent_attested: true`). The defect was first recorded as an "accepted residual
  risk" (`decisions/0025`, W9), although the item Q10 is violated ("try again later" said
  something untrue); RELEASE-VALIDATOR returned FAIL (`step-29`, F2).
- Почему это плохо: skipping a step lowers the bar (Q10 because of the false text, Q2 — no
  independent diagnosis); an exception from the bar is given only by the owner and in writing
  (`quality-bar.md` §1 item 3), a decision of ORCH is not an exception; a handoff written later
  and not by an agent is not evidence.
- Как правильно: a defect goes by WF-03 from step 1; a residual risk in a decision is
  allowed only if it does not violate an item of the bar; a violated item is fixed, or one stops
  and writes to the owner. If a step is still skipped, this is recorded in the handoff without
  inventing a performer or a time.
- Где найдено: `handoffs/PROD-20261010-01/step-29-release-validator.json` (F2),
  `step-44-code-designer-iss0010.json`, `docs/design/ISS-0010-web-chat-write-recovery.md` (the
  introduction); `decisions/0026-team-core-reclaim-own-broken-lock.md`.

### AP-058 — An edit of a test and of the interface description passed without gates, handoffs created in advance

- Что случилось: the edit of the test `step-42` (TEST-DESIGNER) reached bookkeeping without
  TEST-DESIGN-VALIDATOR and TEST-RUNNER: the gates passed only in round 2 (`step-48`, `step-49`).
  The edit of the interface description (r3.2) went on the "short path" first without its own
  gates (`step-46` FAIL, `step-47` PASS afterwards). The handoffs `step-45…48` were created by
  ORCH before the performers were started, so they had no `started_at` of their own from the clock.
- Почему это плохо: Q2 — who does does not check; an edit without gates is an unchecked edit, and the
  gates then have to be passed after the fact; a handoff created in advance carries a time that
  did not exist (AP-056).
- Как правильно: any edit of a test or a description goes through the gates of this kind of
  edit before the next step; the handoff is created and its `started_at` filled in by the
  performer itself by the clock; ORCH does not create handoffs in advance.
- Где найдено: `handoffs/PROD-20261010-01/step-43-release-validator.json` (F3),
  `step-46-code-design-validator.json`, `step-50-release-validator.json` (F2 — an edit of the
  description without a record of ORCH).

### AP-059 — A test on a timer is unstable under load: the "before" snapshot was taken with a live writer

- Что случилось: WEB-15 (б) took the hash of the journal before stopping the engine (`SIGSTOP`);
  a write of the engine in this window changed the hash, and one of three full runs failed falsely
  (ISS-0015). TM-67 from `team-recovery` fails with 8 background `yes` processes (ISS-0017).
- Почему это плохо: a red run without the code's fault is a reason to turn the check off (Q6, AP-054);
  under load the window of the race is wider.
- Как правильно: the "before" snapshot for the check "nothing was written" is taken only when
  the writer is stopped (or the hash is stable over several polls in a row); waits in tests are by
  condition, not by the length of a pause; a new test is run under load (3 runs in parallel, a loop)
  before handing in.
- Где найдено: `handoffs/PROD-20261010-01/step-40-test-design-validator.json` (F1),
  `docs/issues/ISS-0015-web15-flaky-snapshot.md`,
  `docs/issues/ISS-0017-tm67-flaky-under-load.md`.

### AP-060 — A real browser found what the tests on a hand-made DOM model did not

- Что случилось: the tests of the page REQ-011 ran on a hand-made DOM model, and a check in a real
  browser found a state without connection at the first load of the page, which these tests did not
  catch (by the report of ORCH in the task of this step; related defects — ISS-0011 and ISS-0016;
  browser checks — DESIGN-QA `step-18`, `step-22` and RELEASE-VALIDATOR `step-50`, the real
  `index.html` and `app.js`).
- Почему это плохо: a DOM model checks what was put into it; a green test on it does not prove the
  behaviour of the page (Q3).
- Как правильно: for every state of the page from the interface description — at least one
  check on the real code of the page in a real browser (or jsdom by REQ-033), and a snapshot in
  `docs/design/samples/`. While it is a proposal, it is not an item of the bar.
- Где найдено: `handoffs/PROD-20261010-01/step-50-release-validator.json`,
  `step-22-design-qa-validator.json`; `docs/issues/ISS-0011-web-chat-error-after-project-ok.md`,
  `docs/issues/ISS-0016-web-chat-down-then-error-not-switched.md`.

### AP-061 — Times from the future in handoffs and in the correction mark itself (a repeat of AP-056)

- Что случилось: in the run `PROD-20261011-01` `completed_at` in `step-08` (06:05:00Z with a commit
  at 06:04:50Z) and `step-20` (06:34:00Z with a commit at 06:33:30Z) stood later than the commit the
  files went into, and without a mark of ORCH; in `step-20` its own `self_check` wrote
  "date -u → 06:33:01Z". `step-25` and `step-35` had such times, but marked by ORCH. One more
  error of the same kind: in the correction mark (`orch_correction.at_note`) there stood a numeric
  value that a clock could not give. RELEASE-VALIDATOR, `step-41` (F1, FAIL of round 1); fixed by
  replacing `at_note` with "not later than the moment of the commit…" without a number, `step-43`
  — PASS.
- Почему это плохо: a journal of the order of events contains events from the future (R2, Q3); a
  repeat of AP-056 in the next run means that the rule does not work without a check.
- Как правильно: time is only `date -u` at the moment of writing; an unknown one is `null`
  and "not later than <the commit>"; before handing in a run, compare every time in
  `handoffs/<RUN-ID>/` with the commit of the file (`git log --follow --format=%cI`), including
  inside `orch_correction`/`orch_note`.
- Где найдено: `handoffs/PROD-20261011-01/step-41-release-validator.json` (F1),
  `step-42-release-validator.json`, `step-43-release-validator.json`.

### AP-062 — A path of the home folder in a handoff broke a check and an acceptance scenario (a repeat of AP-050, AP-052)

- Что случилось: in the handoffs `step-24` (DESIGN-QA) and `step-37` (TEST-RUNNER) of the run
  `PROD-20261011-01` a path of the home folder of this computer stayed; because of it
  `cd tools && npm run check` (the trace check) and acceptance scenario 37 (UAT-RUNNER, `step-39`)
  failed. The path was replaced with `<scratch>/…`, scenario 37 was then done by ORCH and not by
  UAT-RUNNER (`step-41`, L4).
- Почему это плохо: the same thing the third time in a row (AP-050, AP-052); an acceptance that
  checks traces fails on bookkeeping files and not on the product, and the signature goes out with
  a reservation.
- Как правильно: before handing in a handoff — `cd tools && npm run traces` and a search for
  the path of the home folder over `handoffs/<RUN-ID>/`; in the text write `<scratch>/…` and
  "cd tools && …".
- Где найдено: `handoffs/PROD-20261011-01/step-39-uat-runner.json`, `step-40-ba-analyst.json`,
  `step-41-release-validator.json` (L4).

### AP-063 — Tests were started in parallel with the security and review gates

- Что случилось: TEST-DESIGNER (`step-34`) was started at 09:05:05Z — before the PASS of security
  (`step-32`, 09:05:45Z) and review (`step-33`, 09:09:00Z); WF-02 puts tests only after both gates
  (step 5 after steps 3 and 4). The review did not require changes to the code, the tests passed
  the gates `step-36` and `step-37` after the last edit, so the final order is not broken.
- Почему это плохо: if the gates had returned the code, the tests would have been written for code
  that will not exist (rework, AP-028, AP-058).
- Как правильно: ORCH starts TEST-DESIGNER only after the PASS of steps 3 and 4; a start "in
  advance for speed" is allowed only with a record of the decision before the start and with a
  repeat of the tests after the edits of the gates.
- Где найдено: `handoffs/PROD-20261011-01/step-41-release-validator.json` (L3),
  `step-34-test-designer.json`.

### AP-064 — The outcome of "Continue" was predicted by the state of the project and not described conditionally

- Что случилось: the text of the pause "Press «Продолжить» ("Continue") to make the work go on"
  promised an outcome that depends on what the page does not know at the moment of showing (whether
  the project was waiting for a decision about the ceiling, whether the ceiling is left). For a
  project that was waiting for a decision, after «Продолжить» the project asked the same thing
  again (ISS-0020, found by BA-ANALYST, `step-25`; the project gates — F1, F2 in
  `step-28`/`step-30`). After the fix of four causes of waiting, the case of a spent ceiling
  without waiting stayed (ISS-0022).
- Почему это плохо: a promise that did not come true is worse for a person than no text (Q10).
- Как правильно: the text at a button whose outcome is determined by the engine or by a state
  the page does not know is conditional («после «Продолжить» проект продолжит работу или снова
  спросит о …» — "after «Continue» the project will go on or will ask again about …"), or the
  button is blocked until the outcome is known; for each cause of the pause — its own text and a
  check on the running system.
- Где найдено: `docs/issues/ISS-0020-pause-text-promises-more-for-waiting-project.md`,
  `docs/issues/ISS-0022-pause-text-without-wait-at-spent-ceiling.md`,
  `handoffs/PROD-20261011-01/step-41-release-validator.json` (L1).

### AP-065 — An interface checked in a browser found what the tests on a DOM model did not (a repeat of AP-060)

- Что случилось: the state "without connection at the first load of the page" (REQ-011; AP-060)
  was found by a check of the real interface in a browser, and the tests on the hand-made DOM model
  did not catch it. In REQ-035 the same was confirmed: an empty row of buttons with a margin
  (ISS-0021) was found by DESIGN-QA (`step-24`) on browser snapshots; RELEASE-VALIDATOR `step-41`
  checked criteria 1 and 4 in Chromium (windows 1470 × 784 and 375 × 812) and by the journal.
- Почему это плохо: green tests on a model prove the model; without a browser check of every state
  such findings are accidental (Q3).
- Как правильно: every state of the page from the interface description — at least one check
  on the real `index.html` and `app.js` in a browser and a snapshot in `docs/design/samples/`; add
  a column "browser check" to the table "criterion → test" of the code and the page. For now a
  proposal (AP-060), not an item of the bar.
- Где найдено: `handoffs/PROD-20261011-01/step-24-design-qa-validator.json` (F-1),
  `step-41-release-validator.json`; `docs/issues/ISS-0021-empty-controls-row-keeps-margin.md`.

### AP-066 — The engine was checked only with an executor that does not read files (related to AP-065)

- Что случилось: the tests of the engine REQ-013 ran on the scripted executor and on a fake claude,
  which do not read the working folder and the hint, so the conditions of a real check were not
  created. The first run on a real Claude (ISS-0023) showed that the checker does not find a file
  by its original name: the project stopped at the first task, having spent 0.67 of 1. The green
  tests of criterion 3 of REQ-013 checked only that the files lie in the hint, and not that the
  checker can use them.
- Почему это плохо: a check not in the conditions where the error shows itself (quality-bar §6 item
  1) proves the model of the executor and not the system; the error was found only by a paid run.
- Как правильно: for every behaviour that depends on what the executor reads (the working
  folder, the hint), the test uses an executor that really reads it and decides by what it read
  (`fake-claude-reads.js`), and checks the guard case "before" (red on the copy without the fix);
  the border of the evidence ("will the real model follow") is named directly and closed by a real
  run.
- Где найдено: `handoffs/ISS-0023-20261011-01/step-01-issue-fixer.json` (diagnosis),
  `docs/issues/ISS-0023-reviewer-cannot-see-result-file.md`.

### AP-067 — A red test in the first full run without a recorded name and without a repeat

- Что случилось: in the first full run of `npm run check` REVIEWER (run `ISS-0023-20261011-01`,
  `step-05-reviewer.json`) saw one red test (1163 passed, 1 not), but the output was cut, the name
  of the test was not recorded and the run on the same copy was not repeated; in the five next runs
  there was no failure. Whose failure it is has not been established (a guess — the load from
  parallel agents, not evidence). The following full runs (TEST-RUNNER, `step-08`) passed without
  red.
- Почему это плохо: a red without a name is not analysed (quality-bar §6 item 4): an unstable test
  (compare ISS-0017) cannot be told from a real error, and green repeats prove nothing.
- Как правильно: on a red test, at once save the full output to a file outside the project,
  record the name of the test, and repeat the same (on the same copy and under load); without a
  name in the handoff a red is counted as not analysed and not closed.
- Где найдено: `handoffs/ISS-0023-20261011-01/step-05-reviewer.json` (issues, INFO),
  `step-08-test-runner.json`.

### AP-068 — A closed list of files of a requirement did not take into account the guard test of a neighbouring requirement

- Что случилось: REQ-038 set a closed list of places of writing (`tools/src/handoffs/`,
  `tools/test/handoffs-*`, …). The guard test `TR-4c` of the neighbouring requirement REQ-014 lists
  the files where `child_process` is allowed (exactly two); the command `handoffs-check` needs a
  git call in a third file. This was noticed only on the design (finding of CODE-DESIGNER Ф7), the
  design stopped (B1), and in the middle of the run criterion 4 of REQ-014 had to be changed and the
  decision `0038` recorded (`handoffs/REQ038-20261011-01/step-00c-req-analyst.json`,
  `docs/design/REQ-038-handoffs-check.md`, item 2).
- Почему это плохо: a list that disturbs the guard test of another requirement breaks the run after
  the start and forces one to edit another requirement and to record a decision after the work (Q12).
- Как правильно: with a closed list, REQ-ANALYST and REQ-VALIDATOR look for guard tests that
  count files or words in `tools/src` (`grep -rn "child_process\|CHILD_PROCESS_FILES" tools/test`),
  and name them and the needed edit in the list and the criteria.
- Где найдено: `handoffs/REQ038-20261011-01/step-00c-req-analyst.json`,
  `docs/design/REQ-038-handoffs-check.md` (item 2),
  `decisions/0038-handoffs-git-history-child-process.md`.

### AP-069 — Literal fragments of paths of temporary folders and the status DONE in agents' reports (a continuation of AP-050, AP-052, AP-062)

- Что случилось: in the agents' reports of the run (`self_check`, `issues`) literal fragments of
  paths of temporary folders and the status `DONE` instead of `COMPLETED` got in. The new command
  `handoffs-check` found this only after the work was ready: three violations of H11 in
  `step-03-security-reviewer-r1.json` (the fields `f1_timing_direct`, `f1_timing_cli`,
  `equivalence`; `step-04-reviewer.json` — ORCH had to order them rewritten before step 6) and
  `DONE` in `step-00c-req-analyst.json`.
- Почему это плохо: the violation is seen late, the edit is made as a separate step in another's
  handoff, and the set of checks is red for that time (Q4, Q7).
- Как правильно: from now on an agent runs `cd tools && npm run handoffs-check` before handing
  in (the rule is written in `docs/workflows/handoffs.md`, section "Bookkeeping check"), ORCH includes this command in every task; temporary places are referred to as
  `<scratch>/…` or `<outside the project>`.
- Где найдено: `handoffs/REQ038-20261011-01/step-04-reviewer.json`,
  `step-03-security-reviewer-r1.json`, `step-00c-req-analyst.json`.

### AP-070 — A red test in the first full run without a name and without a repeat — the second time in a row (adds to AP-067)

- Что случилось: in the run of REQ-038 REVIEWER (`step-04-reviewer.json`, `issues`,
  `FLAKY_UNRESOLVED`) again saw one red test in the first full run, with the output cut by `tail`:
  the name was not taken, five repeats were green. Before that the same was in the run
  `ISS-0023-20261011-01` (AP-067). The further full runs of REQ-038
  (`step-05b-test-design-validator-r1.json` — twice, `step-06-test-runner.json`,
  `step-09-release-validator.json`) showed no red; whose failure it is has not been established.
- Почему это плохо: a red without a name stays not analysed (quality-bar §6 item 4); AP-067 already
  described this, and the lesson did not work — so it did not reach the agents in the task.
- Как правильно: a full run always writes its output to a file outside the project, not
  through `tail`; the name of the red test case is recorded in the handoff before any repeat; ORCH
  includes this in the task of the steps where a full run goes.
- Где найдено: `handoffs/REQ038-20261011-01/step-04-reviewer.json`,
  `handoffs/ISS-0023-20261011-01/step-05-reviewer.json`.

### AP-071 — A counting criterion that is met before the work does not prove the work

- Что случилось: a documents criterion of REQ-039 counted lines with
  `grep -c 'npm run handoff' tools/README.md`. On the base commit this number is already 2 — the
  matches are lines about `npm run handoffs-check` — so the threshold "not less than 2" is met
  before any edit. The criterion did not tell done work from not done; it had to be closed with
  strict tests (HO-50…HO-53).
- Почему это плохо: a green criterion without work is false confidence (Q2, Q5); RELEASE-VALIDATOR
  could have accepted an empty edit of a document.
- Как правильно: REQ-ANALYST and REQ-VALIDATOR compute the "before" value on the base commit
  and require that the criterion is not met on it; a count of lines is replaced by a check of
  content (a test for a specific phrase or section).
- Где найдено: `handoffs/REQ039-20261011-01/step-09-release-validator.json` (criterion 7),
  `docs/requirements.yaml` (block REQ-039).

### AP-072 — The design of a command that writes files was returned from the gate three times: outcomes of the write steps and bookkeeping files in the border check were missed (adds to AP-068)

- Что случилось: CODE-DESIGN-VALIDATOR returned the design of REQ-039 twice
  (`step-01b-code-design-validator.json`, `-r1`; accepted in `-r2`). In the first version the
  failure paths of the cleanup in a race and in a partial failure were missed: a temporary file at
  EEXIST on a link, `mkdir` into a folder not yet created at two simultaneous starts, a failure of
  a repeated search; in the second — the list of bookkeeping files of the run in the border check of
  criterion 8 (N1: `docs/requirements.yaml`, `STATE.md`, the design itself, `handoffs/<RUN-ID>/` and
  others were not named, and the check would turn red on a correct run), and the output at code 2
  (N2).
- Почему это плохо: every return is a separate round of the design; the developer would otherwise
  choose the outcome himself (a garbage `.sai-tmp` or a red test).
- Как правильно: for a command that writes files, CODE-DESIGNER lists at once the outcomes of
  each write step (success, EEXIST, disk error) and what stays on the disk in each; the border check
  includes the bookkeeping files of the run (as accepted in REQ-038).
- Где найдено: `handoffs/REQ039-20261011-01/step-01b-code-design-validator.json`,
  `step-01b-code-design-validator-r1.json`, `step-01b-code-design-validator-r2.json`.

### AP-073 — The fix of the code got into the snapshot of the repository before the tests and the bookkeeping of the defect were closed (adds to AP-013, AP-062)

- Что случилось: the run `ISS-0002-20260930-01` stopped on the environment at step 6, but the code of
  the fix (`writeAllOrNothing`, `createFolderAllOrNothing` in `tools/src/util.js`, the order of
  writing in `apply.js`, the assembly of the folder in `prepare.js`) already lay in the tree and got
  into the snapshot of the repository (commit `87b1511`). The file of the defect ISS-0002 and the
  header of the design for months described the state "before" (open, old line numbers, the test
  status "FAIL (narrow)"), and there is no "before" copy in history: to prove "the test fails before
  the fix" the decision `decisions/0041` (a reconstruction) was needed.
- Почему это плохо: bookkeeping says one thing, the code does another (Q14); the next run cannot tell
  "fix" from "finish the bookkeeping" and spends a round on diagnosis; without a "before" copy the
  regression test can be proved only by a reconstruction, and the author of the fix is not visible in
  the reports.
- Как правильно: when a run stops, at once write into the defect file and into `STATE.md` that
  the code is already in the tree, and a list of what is unfinished (tests, bookkeeping, design); do
  not commit code without such a record; before work on code, mark the "before" copy
  (`base/<RUN-ID>`) with a separate commit, so that steps 6–7 of WF-03 have a real copy.
- Где найдено: `handoffs/ISS-0002-20261011-01/step-01-issue-fixer.json`,
  `decisions/0041-iss0002-pre-fix-reconstruction.md`,
  `handoffs/ISS-0002-20261011-01/step-05-reviewer.json` (R4).

### AP-074 — A "before" copy taken through git archive carries no .git and no handoffs, and three tests turn red by the environment and not by the work

- Что случилось: in the run `ISS-0031-20261011-01` the "before" copy (tag
  `base/ISS-0031-20261011-01`) was obtained through `git archive`. In such a copy there is no `.git`
  and no `handoffs/`, so three tests (HC-7a, HC-7c, HC-5b) turn red on it — by the environment and
  not because of the defect. In a clean copy with `.git` there are no reds.
- Почему это плохо: the evidence "whose failure" (quality-bar §6 item 4) is mixed with a failure of the
  environment: red tests on the "before" copy cannot be attributed to the defect, and the number of
  "reds before" has to be explained and subtracted by hand.
- Как правильно: make the "before" copy as a clone of the repository at the tag (with `.git`,
  with `handoffs/`), not as an archive; if an archive was still used — name in the report the tests
  that turn red by the environment, and do not count their failure as evidence.
- Где найдено: `handoffs/ISS-0031-20261011-01/step-09-release-validator.json` (summary, item 1).

### AP-075 — A decision record referred to a decision without the needed text, described journal events from memory and was not made by the template

- Что случилось: the first version of `decisions/0043-iss0031-core-completes-file-dependency.md`
  quoted the decision 0020, which does not have the needed text, and described journal events from
  memory (`TASK_CREATED` is a phrase of the projection, not an event of the journal). The format
  departed from `decisions/README.md`: a section «Причины» ("Reasons") instead of «Почему» ("Why"),
  without «Граница» ("Boundary") and «Основания» ("Basis"). The design gate
  (`step-03b-code-design-validator.json`) returned the work with FAIL; the version `-r1` was
  accepted.
- Почему это плохо: a decision with a wrong reference and an invented event misleads the next readers
  (Q3, Q12); a return from the gate is an extra round.
- Как правильно: give a reference to a decision only after checking the quote against the text
  of the decision; check the names of journal events against the code (`grep` over
  `tools/src/team/`); write a decision record strictly by the template of `decisions/README.md`.
- Где найдено: `handoffs/ISS-0031-20261011-01/step-03b-code-design-validator.json`,
  `step-03b-code-design-validator-r1.json`,
  `decisions/0043-iss0031-core-completes-file-dependency.md`.

### AP-076 — A design with external actions relied on unchecked facts about the environment: four returns from the gate and the exception 0046 (adds to AP-012, AP-074)

- Что случилось: the design REQ-030 (`docs/design/REQ-030-github-check.md`) was returned four times
  from the gate of step 1b (findings F1…F7; `step-01b-code-design-validator.json`, `-r1`, `-r2`,
  `-r3`; accepted in `-r4`), and the limit of reworks was exceeded on the owner's word
  (`decisions/0046`). The first version relied on facts that nobody had checked by a run: (1) the
  prototype of the hook `if ! npm run check; then echo "код $?"` loses the exit code — in the branch
  `$?` is 0 (F1); (2) the step "red branch" took a clone of the Sai root, whose `origin` is a local
  folder and not GitHub: the push and the "deletion of the branch" would have gone into the Sai
  repository itself, and the check of the deletion would have given a false confirmation (F2); (3)
  the statement "the repository is private" was out of date — it became public between the
  measurement and the repeated gates (F1 in `-r1`); (4) the form of the start `node --test test/`
  is false on Node 22 (code 1 even on a green test, F7); (5) a nested start inside a running
  `node --test` inherits `NODE_TEST_CONTEXT`, and a red test "passes" with code 0 (F7).
- Почему это плохо: every unchecked statement about the external environment is a round of the gate
  (Q3, §6 item 2); some facts (the visibility of the repository) change by themselves, and a
  measurement that is not dated and not repeated before the gate gets out of date; a design with
  external actions (push, deleting a branch) without a prototype can write into the real repository
  to the wrong place.
- Как правильно: CODE-DESIGNER checks every statement about the external environment by a run
  and puts the date of the measurement — the visibility of the repository, the rights of the token
  and the Actions settings (read only), the exact form of the start commands, the inheritance of the
  environment by nested starts; a design with external actions passes a prototype on a local
  "remote" (a bare repository outside the project) before the gate; before sending to the gate ORCH
  requires in the design a section "what was checked by a run and when".
- Где найдено: `handoffs/REQ030-20261012-01/step-01b-code-design-validator.json`, `-r1`, `-r2`,
  `-r3`, `-r4`; `decisions/0046-req030-rework-limit-exceeded.md`.

### AP-077 — The text of a document and the tests for this text were written separately: the design required writing a word that the test forbade

- Что случилось: in the first version of the design REQ-030 the line R-3 told to write in the README
  "this decision is based on the fact that the repository is private" (приватный), while the test RD-4
  forbade the word «приватн» in the section (F6, `step-01b-code-design-validator-r2.json`). A
  developer who followed R-3 literally would have got a red RD-4; one who followed RD-4 would have
  departed from R-3. Small differences of the same kind: «Защиты ветки нет» with a capital against a
  search for `защиты ветки нет` in lower case (N3), the README section stood in different places in
  the measurement and in the design (F5).
- Почему это плохо: the rules of the text and the check of the text contradict each other, and the
  developer has to guess; this was found only by an independent run.
- Как правильно: the text of a document that tests check is run by CODE-DESIGNER through the
  script of the tests already in the design; CODE-DESIGN-VALIDATOR writes the section strictly by the
  rules of the design and runs the script on it (in `-r3` this closed F6 by a run).
- Где найдено: `handoffs/REQ030-20261012-01/step-01b-code-design-validator-r2.json` (F6, N3),
  `step-01b-code-design-validator-r1.json` (F5), `step-01b-code-design-validator-r3.json` (F6
  closed).

### AP-078 — A stand-in process in tests did not read its input, and the tests never ran on the target platform: the race was lost only on GitHub (adds to AP-012, AP-076)

- Что случилось: the test `GH-6` (`tools/test/handoffs-git.test.js`, REQ-038) puts in place of git a
  script that answers and exits with code 0 without reading standard input. The code `readBlobs`
  writes git's requests to this input; if the stand-in process exited before the write, `execFileSync`
  gives `EPIPE` with status 0, and `gitFailure` wrote «git не смог выполнить команду (код 0)» ("git
  could not run the command (code 0)") instead of the expected «вывод git не разобран» ("the output of
  git was not parsed"). On macOS the write always managed to finish, the tests ran only there; on the
  Linux runner of GitHub the race was lost (the first run of `check.yml`: 1475 of 1476, case 2 of
  GH-6 failed, line 243) — residual risk 6 of the design REQ-030 ("the tests never ran on Linux")
  came true in the very first run. Besides, the description of the defect named a wrong cause and a
  wrong failed test: the first version of `ISS-0053` stated that `isShallow` with `printf '\377\376'`
  failed and the difference of shells (dash and bash) was to blame — the reproduction refuted this
  (the shells give the same bytes; `readBlobs` failed). The same class of race stands in `HK-12b` and
  `HK-31` (a write into the input of `hook.sh` without an error handler) — ISS-0055.
- Почему это плохо: a red check on a clean machine (Q4) is learned only after the push, and fitting to a
  wrong cause (dash, `printf`) would have taken the work and fixed nothing (Q3); a branch of failure
  text written for the error code of one platform may not work on another.
- Как правильно: (1) a stand-in process reads its input before it answers (in a test without
  external commands — with a built-in shell command, for example `while read -r _; do :; done;`); (2)
  a test for "the process does not read the input" takes an input surely larger than the buffer (with
  a margin by the socket of the target platform, not by a measurement on its own machine), so that the
  outcome does not depend on the race; (3) a branch by the exit status and not by the error code of a
  platform measured on one platform (decision 0047), with an explicit list of what is measured and
  what is not; (4) a fact in a defect file is checked by a reproduction before writing (AP-012): "the
  check X failed, the cause is Y" — only with a run; (5) while there is no Linux, the confirmation is
  only a run of `check.yml` on GitHub, and the defect is not closed without it.
- Где найдено: `handoffs/ISS-0053-20261013-01/step-01-issue-fixer.json` (diagnosis),
  `step-03-code-designer.json` (I2, I3, I7), `step-09-release-validator.json` (F1, R1…R6);
  `decisions/0047-iss0053-git-exit-zero-with-failed-input.md`;
  `docs/issues/ISS-0053-gh6-fails-on-linux.md`.

### AP-079 — A test froze into a document words about an external setting (branch protection on GitHub), and the fact changed: the document cannot be corrected without changing the criterion and the tests (adds to AP-076, AP-077)

- Что случилось: criterion 5 of REQ-030 and the README tests `RD-2` and `RD-4`
  (`tools/test/repo.test.js`) require that the README section "Check on GitHub and before a push"
  contains the words "there is no branch protection" and does not contain "branch is protected",
  "protection is turned on", "required check", "private", "public", "403" (before the translation of
  the README into English, run TRANSL-20261025-01, the words were «защиты ветки нет», «ветка защищена»,
  «защита включена», «обязательная проверка», «приватн», «публичн»). This was true at the time of the design. On 2026-10-13 the owner said that he had
  opened the repository on purpose (`decisions/0048`), and ORCH turned on the protection of `main` on
  GitHub. Now the README section says something untrue ("On GitHub there is no branch protection"),
  but it cannot be corrected: the tests `RD-2` and `RD-4` will turn red, and criterion 5 requires
  exactly these words. The truth had to be written in other places (the description of REQ-030, lines
  of the README outside the section, `STATE.md`), and the false section had to be left and raised as a
  separate defect (ISS-0057).
- Почему это плохо: the setting of an external system (GitHub) changes independently of the code, and a
  test and a criterion froze the description of its state of today. The document cannot follow the
  fact without editing the criterion and the tests, while Q3 and Q14 require the document to say the
  truth. The same class as AP-076 (unchecked facts about the environment in a design), but the other
  way round: the fact was not wrong from the start, it got out of date.
- Как правильно: (1) a criterion that checks a text about the state of an external system does
  not freeze words about the state itself (on or off, private or public): it checks a reference to the
  decision or file where the state is recorded, and that the text does not contradict it; (2) words
  about the state of an external system live in one place (a decision or `STATE.md`) with the date of
  checking, and the README refers to it; (3) when the fact changes, the correction of the criterion
  and the tests goes as a separate work at once, and does not stay open.
- Где найдено: `docs/requirements.yaml` (REQ-030, criterion 5, the description);
  `tools/test/repo.test.js` (`README_WORDS`, `README_BANNED`, `RD-2`, `RD-4`); `README.md` (the
  section "Check on GitHub and before a push"); `decisions/0048-owner-delegates-open-points-repo-public.md`;
  `docs/issues/ISS-0049-docs-call-repo-private-but-public.md` (the section «Закрыто», "Closed");
  `docs/issues/ISS-0057-readme-says-no-branch-protection.md`;
  `handoffs/REQ030-20261012-01/step-13-doc-updater.json`.

### AP-080 — A requirement became `done`, and the marks of dependent requirements "the dependency is still `in_progress`" stayed and said something untrue for two days (adds to AP-005)

- Что случилось: REQ-002 became `done` on 2026-10-11 (run `ISS-0002-20261011-01`). In
  `docs/requirements.yaml` in the blocks REQ-009, REQ-010, REQ-013 the comments stayed "REQ-002 is
  still `in_progress`, `done` is impossible (the header of the file)" and "REQ-002 (now
  `in_progress`)"; in REQ-011, REQ-035 — "the dependency REQ-013/REQ-002 `in_progress`". The status
  marks were true on the day of writing, but when the status of the dependency changed, nobody went
  through the blocks that refer to it. Only RELEASE-VALIDATOR of the run `REAL-20261013-01` noticed
  (finding F4), and only because it read the blocks before `done`.
- Почему это плохо: a mark with the words "now", "still", "for now" lives longer than the fact; the next
  performer takes it for the current state (Q14, AP-005), and for a block whose status did not change
  no step will correct it, because by the rule bookkeeping touches only the block of its own
  requirement.
- Как правильно: (1) in marks write the state with a date ("`in_progress` on 2026-10-09"), not
  "now"; (2) when a requirement status changes, DOC-UPDATER looks for its id in the comments of other
  blocks (`grep -n 'REQ-NNN.*in_progress' docs/requirements.yaml`) and corrects the marks that speak
  of its former status — these are comments, criteria are not edited; (3) if for this the block is not
  in the `write_set`, the difference goes into `result.issues` and does not stay silent.
- Где найдено: `handoffs/REAL-20261013-01/step-09-release-validator.json` (F4);
  `docs/requirements.yaml` (blocks REQ-009, REQ-010, REQ-013, REQ-011, REQ-014, REQ-035);
  `handoffs/REAL-20261013-01/step-10-doc-updater.json`.

### AP-081 — An acceptance criterion tied the evidence to a command and to a number that "the owner will name", and life gave a different path (adds to AP-066, AP-071)

- Что случилось: criterion 14 of REQ-010 required "one real `npm run team -- run-task`" with a ceiling
  "that the owner will name", and criterion 13 of REQ-013 — "`start`" with the same ceiling. The real
  run of 2026-10-13 went with the command `start` (the engine calls the same `runTask`), and the
  number of the ceiling (3 USD) was named by ORCH on the owner's order (`decisions/0048`), because the
  owner answered "decide yourself". By the letter the criterion was not met in either place;
  RELEASE-VALIDATOR had to reason separately whether this was enough and to record three reservations
  (the form of consent, `run-task`, `ISS-0031`).
- Почему это плохо: a criterion that names one command and one person is formally not met in an honest
  but different organisation of the work, and the decision about `done` rests on the interpretation of
  the checker (Q3, AP-066). The border of the evidence (what is not checked on a real model) is then
  badly recorded by itself.
- Как правильно: (1) a UAT criterion describes an observable result ("the task of the role
  Researcher reached a result, the spend is not more than the ceiling, the journal and files are
  attached") and names the command as an example of checking, not as a condition; (2) who names the
  number — "the owner or the one he has told to do it, with a record in `decisions/`" (WF-01); (3)
  every "not checked on a real model" gets into the status mark and into `STATE.md` by name, and not
  with the words "mostly".
- Где найдено: `handoffs/REAL-20261013-01/step-09-release-validator.json` (reservations (а), (б), (в);
  `result.issues` I3 items 3–4); `docs/uat/REAL-RUN-20261013.md`, the section «Остаточные риски»
  ("Residual risks"); `decisions/0048-owner-delegates-open-points-repo-public.md`. The edit of the
  wording of criteria 13 and 14 was not made here: criteria of `done` are not rewritten by
  bookkeeping; this is a proposal for WF-01 (see `result.issues`).

### AP-082 — "Expected" in acceptance scenarios was written by the intuition "the rest stays as before" and not by the verbatim rule of the criterion (adds to AP-066)

- Что случилось: BA-ANALYST wrote the scenarios of REQ-042 (`docs/uat/REQ-042.md`, 42 scenarios), and
  in four of them «Ожидается» ("Expected") contradicted the criteria. UAT-RUNNER on live stands
  recorded them as "failed" (10, 12, 13, 15; `docs/uat/REQ-042-RUN.md`, «Провалы по буквальному
  сравнению (4 из 6 — вероятные ошибки ожиданий)», "Failures by literal comparison (4 of 6 — probable
  errors of expectations)"). In all four the page behaved by the criterion. Scenarios 12, 13, 15
  expected that a silent row or task "stayed «нет свежих данных»" ("no fresh data") when in the same
  session a new trusted row came (the end of a task, the end of an answer, a request) — but by
  criteria 1 and 2(е) the age is counted from the last trusted row of the **session**, and any such
  row except `SessionEnd` returns the silent elements of the session to «в работе» ("working") for 60
  minutes. Scenario 10 expected that "every value of the age grew" over 70 s, but the format «1 сут 2 ч
  назад» ("1 day 2 h ago") changes once an hour (criterion 4). BA-ANALYST admitted: «Мои первоначальные
  ожидания в 12, 13, 15 были ошибкой BA-ANALYST: … не учёл, что любая новая доверенная строка сессии
  освежает все её элементы» ("My first expectations in 12, 13, 15 were an error of BA-ANALYST: … I did
  not take into account that any new trusted row of the session refreshes all its elements")
  (`step-08c-ba-analyst-signoff.json`, I4) and corrected the document up to the version r2.
- Почему это плохо: false "HIGH" failures of acceptance would have sent defects that do not exist to
  WF-03, or stopped the release; RELEASE-VALIDATOR had to compare the corrected «Ожидается» with the
  text of the criteria separately and repeat four scenarios itself. The property of the criteria ("any
  new trusted row returns the silent ones of the same session") is important for the owner, but is
  hidden in the rules and not in intuition.
- Как правильно: (1) BA-ANALYST compares every phrase «Ожидается» for state transitions with the
  verbatim rule of the criterion and writes into the scenarios from which word of the criterion it
  follows; (2) if the rule refreshes or changes "other" elements of the same session, "stays as before"
  is written only for elements of **another** session (a stand with two sessions), and for the same
  one — what exactly changes and by which rule; (3) "grows with time" is not written for values whose
  format changes less often than the step of the check (days and hours without minutes).
- Где найдено: `handoffs/REQ042-20261013-01/step-08b-uat-runner.json`,
  `step-08c-ba-analyst-signoff.json` (I1, I4, verdicts for scenarios 10, 12, 13, 15),
  `step-09-release-validator.json` (acceptance: «Результат каждого совпал с «Ожидается» редакции r2»,
  "The result of each matched «Expected» of version r2"); `docs/uat/REQ-042-RUN.md` (Ф1, Ф2, Ф3, Ф6).

### AP-083 — A test looked for a phrase in a text whose meaning changed, and stayed green on the same phrase inside a negation

- Что случилось: the test `ST-06` (`tools/test/pixel-office-settings.test.js`) requires the README to
  have 14 mandatory lines, among them «остаться «в работе»» ("stay «working»") (limit 1 of the earlier
  version: «Задача может **остаться «в работе»**, если событие окончания потеряно…», "A task can
  **stay «working»** if the end event is lost…"). REQ-042 reverses the meaning of the limit: now a task
  does not stay «working» longer than 60 minutes without events. FRONTEND-DEV rewrote the limit as
  «Задача не может остаться «в работе» дольше 60 минут без доверенных событий её сессии…» ("A task
  cannot stay «working» longer than 60 minutes without trusted events of its session…"), and `ST-06`
  stayed green — the phrase is still in the text, but now inside a negation, that is, the test would
  have been checking the opposite of what the criterion requires (`step-02-frontend-dev.json`, I3;
  REVIEWER, `step-04-reviewer.json`, I4: «остаётся зелёным, потому что ограничение 1 содержит «не может
  остаться «в работе»» — отрицание», "stays green because limit 1 contains «cannot stay «working»» — a
  negation"). FRONTEND-DEV and REVIEWER noted this before the line was replaced; TEST-DESIGNER replaced
  the line in the list with «нет свежих данных» ("no fresh data") (the number of lines is 14),
  TEST-DESIGN-VALIDATOR killed the mutant "README without «нет свежих данных»" with two tests (FS-16
  and `ST-06`).
- Почему это плохо: a test for a word in a document proves the presence of a substring and not the
  meaning; when the meaning changes, it stays green and covers the difference (Q5, Q6).
- Как правильно: (1) when a text that a test checks by a phrase changes, the design names the test
  in a table "earlier check → new" and replaces the phrase with one that expresses the **new** meaning;
  (2) REVIEWER and TEST-DESIGN-VALIDATOR check whether the old phrase coincides with the new text in
  another meaning (a negation, an example, a quote), and apply the mutant "text with the earlier
  meaning"; (3) a criterion is formulated through the presence of a new word and not through the
  absence or presence of the old one.
- Где найдено: `handoffs/REQ042-20261013-01/step-02-frontend-dev.json` (I3), `step-04-reviewer.json`
  (I4), `step-05-test-designer.json` (the replacement of the line ST-06, mutant M34),
  `step-05b-test-design-validator.json` (mutant R1 killed by FS-16 and ST-06);
  `docs/design/REQ-042-state-honesty.md` (section 11, line ST-06).

### AP-084 — The clock of a test coincided with the border of a threshold: "now" = start + threshold, and any shift silently crosses the threshold

- Что случилось: the common helper of Pixel Office tests set the "now" of the page as `NOW = T0 + 3600 s`,
  and `STALE_AFTER_MS` (REQ-042) is 3 600 000 ms. For events at the moment `T0` the age is exactly at the
  threshold, and any test that shifts the page clock or builds an event a little earlier crosses the
  threshold and gets «нет свежих данных» ("no fresh data") instead of «в работе» ("working"). CODE-DESIGNER
  noticed this trap in the design («тест `PN-02` держится за «сейчас» на границе», "the test `PN-02` holds
  on to «now» at the border", a proposal for a journal record: section 14.3); FRONTEND-DEV confirmed on a
  copy: with `NOW = T0 + 1800 s` `PN-02` is green and exactly 11 are red (`step-02-frontend-dev.json`, I2).
  TEST-DESIGNER replaced the helper with `NOW = T0 + 1800 s`, and checked the border with a separate test
  `FS-05` (±1 ms from the threshold for the task, the row of the main session and the session).
- Почему это плохо: a test that is not about the border but stands on it breaks from unrelated edits and teaches
  to fix by "fitting the time"; the border itself is then checked by accident.
- Как правильно: "now" in the common helper stands inside the threshold with a margin (`T0 + 1800 s` with
  a threshold of 3600 s); the border of the threshold is checked by its own test with events at `threshold`,
  `threshold + 1 ms` and `threshold − 1 ms`; the number of the threshold in tests is taken from one constant
  or the literal of the criterion, and is not derived from the helper.
- Где найдено: `docs/design/REQ-042-state-honesty.md` (section 14.3, section 11 line `PN-02`);
  `handoffs/REQ042-20261013-01/step-02-frontend-dev.json` (I2), `step-05-test-designer.json` (FS-05).

### AP-085 — Code and tests read the real clock of the computer: the report command took `Date.now()`, and an engine test once failed from a step of the clock backwards (adds to AP-084)

- Что случилось: (1) `tools/src/pixel-office/public/office-report.js` (the report command of the office) took
  `Date.now()`. While the age did not influence the states, this was not noticed; after REQ-042 a journal of
  2026-09-20 with today's date would have made the expectations `OF-13` and `OF-25` depend on the date.
  CODE-DESIGNER noticed this in the design; `runReport(argv, io = process, nowFn = Date.now)` takes the clock as
  a parameter, `FS-19` checks a given clock. (2) The test `EN-57 (1, 2)` of the team engine
  (`tools/test/team-channel.test.js`) once failed with `E_TIME` («Часы компьютера показывают время раньше
  последней записи проекта», "The clock of the computer shows a time earlier than the last record of the
  project"): it writes engine events by the real clock `Date.now`, and the check `checkTime` for the source
  `ENGINE` is strict (`at < prev`). By the log of the macOS time service, at the same time the clock stepped
  back by 0.111 s (12:13:16Z) and by 0.060 s (12:29:16Z). Nobody reproduced the failure itself (`ISS-0065`).
- Почему это плохо: the result of a check depends on the date of the run and on the time service of the computer,
  a red run does not repeat, and it is easy to "cure" it with a restart (Q6, §6 item 4 of the bar: an external
  cause must be reproduced).
- Как правильно: time is a parameter (`nowFn`, a stand-in clock) and not a call of `Date.now()` inside code
  that is checked by date; tests that write events by the real clock into one journal get a stand-in clock; an
  accidental red check by the clock is recorded in a defect with the time before and after and the log of the
  time service (as done in `ISS-0065`), and is not restarted until green.
- Где найдено: `docs/design/REQ-042-state-honesty.md` (section 14.3);
  `handoffs/REQ042-20261013-01/step-05b-test-design-validator.json` (I1), `step-05-test-designer.json` (I2),
  `step-09-release-validator.json` (I4); `docs/issues/ISS-0065-team-channel-tests-real-clock-e-time.md`.

### AP-086 — An analyst agent ran `git checkout -- .` in the Sai folder and threw away the not yet accepted edits of the run

- Что случилось: by the record of ORCH in the task of step 10 (`handoffs/REQ042-20261013-01/step-10-doc-updater.json`,
  `task.description`), an analyst agent in this run ran `git checkout -- .` in the Sai folder and threw away the
  not yet accepted (not committed) edits; the edits were restored, ORCH checked the result. In the handoffs of the
  run this episode is not recorded separately (RELEASE-VALIDATOR in `step-09-release-validator.json` noted only
  that it itself did not run `git checkout/reset/stash/clean` and the hashes of the working tree before and after
  matched); the details (which role, which step) are not kept in the Sai files.
- Почему это плохо: the working tree of a run consists of not yet accepted edits of other roles (code, tests,
  documents); a command that returns files to the committed state silently erases another's work, and it can be
  restored only from copies, if there are any (R1, Q2).
- Как правильно: in tasks for agents who work in the Sai folder, `git checkout`, `git reset`, `git stash`,
  `git clean` and any commands that return files to a commit are directly forbidden; "return as it was" is done by
  copying from a copy outside the project and not by git commands; before starting a role that needs a "clean"
  copy, ORCH gives it a copy outside the project (as RELEASE-VALIDATOR of this run did). ORCH now writes the ban
  into the task explicitly.
- Где найдено: `handoffs/PIXEL-20261013-01/step-01-req-analyst.json` (`result.issues`, item I10 — the record of the
  agent itself: ran `git checkout -- .`, restored the files) and `step-01-req-analyst-r1.json` (ORCH checked the
  restoration); `handoffs/REQ042-20261013-01/step-10-doc-updater.json` (the task, the words of ORCH);
  `step-09-release-validator.json` (the working tree did not change, hashes before and after).

### AP-087 — ORCH created a handoff with a command whose text had backticks: the shell substituted an empty string, the file does not exist, and the agent got a message about a non-existent file

- Что случилось: by the record of ORCH in the task of step 10 (`handoffs/REQ042-20261013-01/step-10-doc-updater.json`),
  a handoff was created with a command in whose task text there were backticks; the shell executed them as a command
  substitution and substituted an empty string, the file was not created, and the agent was notified of a handoff
  that does not exist. In the Sai files the case itself is not recorded (which handoff — not written).
- Почему это плохо: the text of a task silently loses pieces, and the agent either does not find the file or, finding
  another one, works by an incomplete task (Q3: the performer gets not what ORCH wanted to say).
- Как правильно: write the task into a file (with an editor, not `echo`) and pass it to the command by a
  substitution from the file with quotes (for example, by the substitution `"$(cat file)"`: the content of the file
  the shell no longer parses; if the text is written into a file from the shell — a heredoc with quotes at the
  delimiter `<<'EOF'`, it does not substitute commands); after creating, ORCH reads the created handoff and checks
  that the file exists and `task.description` is not empty and not cut.
- Где найдено: the creation of `handoffs/REQ042-20261013-01/step-01-code-designer-r1.json` (step 1, rework r1 of the
  design): the first attempt of the command `handoff new` did not create the file, ORCH had already sent the
  designer agent a message about it; the file was created by the second attempt, the agent got a correction;
  `handoffs/REQ042-20261013-01/step-10-doc-updater.json` (the task, the words of ORCH).

### AP-088 — The step number in handoffs of different roles coincided: BA-ANALYST and UAT-RUNNER at step 8 (adds to `docs/workflows/handoffs.md`, section "Where handoffs are stored and how they are named")

- Что случилось: by the record of ORCH in the task of step 10, the handoffs of BA-ANALYST (scenarios) and
  UAT-RUNNER (run) in WF-02, step 8, had the same step number, while the `handoff_id` must not repeat in the whole
  of `handoffs/` (`docs/workflows/handoffs.md`). In the run it was fixed with suffixes of sub-steps:
  `step-08-ba-analyst.json` (`step08-…`), `step-08b-uat-runner.json` (`step08b-…`),
  `step-08c-ba-analyst-signoff.json` (`step08c-signoff-…`); `handoffs-check` in the run — 0 violations
  (RELEASE-VALIDATOR).
- Почему это плохо: two files with one `handoff_id` break the links to them and the bookkeeping check; three roles of
  one step (scenarios, run, signature) are three different handoffs.
- Как правильно: if several roles work at one step or one role in several sub-steps, each handoff gets its own
  `<STEP>` with a letter (`08`, `08b`, `08c`) and its own name; ORCH issues the letters when creating the handoffs
  and not afterwards.
- Где найдено: `handoffs/REQ042-20261013-01/step-08-ba-analyst.json`, `step-08b-uat-runner.json`,
  `step-08c-ba-analyst-signoff.json`; `docs/workflows/handoffs.md`;
  `handoffs/REQ042-20261013-01/step-10-doc-updater.json` (the task, the words of ORCH).

### AP-089 — The layout of the longest word of a new state was measured neither by the design, nor by the tests, nor by the acceptance before the repeat: the third repeat of AP-060 and AP-065

- Что случилось: REQ-042 introduced state words up to 300 px long (the earlier longest was «окончание не записано»
  ("end not recorded"), 145 px). The rules of `tools/src/pixel-office/public/style.css` `.item-head`
  (`display: flex` without `flex-wrap`), `.item-state` (`flex: none`) and `.item` (`overflow-wrap: anywhere`)
  together left 20 px for the name of the role: «Plan» broke into «Pl / an», the row of the main session grew to
  387 px (window 1470×784) and 716 px (window 375×812). ISSUE-FIXER recorded the cause: the page tests run on a
  hand-made DOM model, where `getBoundingClientRect` «отдаёт 0 или заданное вручную число» ("gives 0 or a number set
  by hand"), and the design REQ-042 did not name the layout of the longest word; DESIGN-QA-VALIDATOR was not run
  (there is no sample), and «первым раскладку увидел UAT-RUNNER» ("UAT-RUNNER was the first to see the layout")
  (`step-01-issue-fixer.json`, diagnosis and I9: «третье повторение AP-060/AP-065», "the third repetition of
  AP-060/AP-065"). In passing, the description of the defect ISS-0062 was wrong twice (I1 of the diagnosis): the
  numbers 332 / 644 and 387 / 716 are not two runs, but the height of the header `.item-head` and the height of the
  whole row `.item` from one run; and «регресс, внесённый самой работой REQ-042» ("a regression brought in by the
  work REQ-042 itself") is right by the effect but not by the code — the rules `.item-head` and `.item-state` have
  not changed since the first commit of Sai, the new words revealed a ready defect.
- Почему это плохо: the look that the owner sees in the main window stood on an unmeasured assumption "the text will
  fit"; the only check was the eyes of the acceptance; after the fix it is closed by criterion 14 of REQ-042 and the
  test `PN-23`, but the same class is possible with any new word.
- Как правильно: (1) when a requirement introduces or lengthens text in a row with neighbouring elements, the
  design names the **longest** word and the windows of checking (1470×784, 375×812) and lists the layout rules the
  row depends on (flex, wrapping, `flex: none`); (2) the acceptance measures `getBoundingClientRect` of the name and
  of the row with the longest word, and does not only read the text; (3) the regression test is a property of the
  CSS rules (`PN-23`) plus a measurement in a browser, and a reservation that the test checks the rule and not the
  look; (4) the description of a defect does not explain a difference of numbers by "two runs" without a check
  (AP-012): first find out what exactly was measured.
- Где найдено: `handoffs/ISS-0062-20261013-01/step-01-issue-fixer.json` (diagnosis, I1, I9);
  `step-09-release-validator.json` (a measurement before/after in six windows);
  `docs/issues/ISS-0062-pixel-office-restart-word-squeezes-role-name.md`;
  `decisions/0053-pixel-office-state-badge-wraps-below-role.md`.

### AP-090 — A closed handoff was corrected right in the file, because a repeated `close` is impossible

- Что случилось: by the check of ORCH in `step-08-test-runner.json` (`orch_check`): the agent after closing the
  handoff «поправил строку `self_check` прямо в файле (E_HO_STATE мешал повторному `close`)» ("corrected a line of
  `self_check` right in the file (E_HO_STATE prevented a repeated `close`)"). The command `close` does not close a
  handoff a second time and answers `E_HO_STATE`; `handoffs-check` gave 0 violations here, so the departure was
  caught only by ORCH, reading the file.
- Почему это плохо: a closed handoff is a record that the agent handed in; an edit after closing rewrites history
  (AP-002), and `handoffs-check` does not tell such an edit from an ordinary one. An inaccuracy in `self_check`
  could have been corrected more honestly.
- Как правильно: an inaccuracy is noticed before `close` and corrected in `result` (in `self_check` or
  `issues`); after `close` the handoff is not edited — the correction is written by ORCH in a separate field
  (`orch_note` or `orch_correction`, with the time and the reason, `docs/workflows/handoffs.md`, "Who writes what") or by the next handoff in its `result.issues`. If `close` does not pass, this is a reason to
  stop and write about it, and not to edit the file.
- Где найдено: `handoffs/ISS-0062-20261013-01/step-08-test-runner.json` (`orch_check`, 2026-10-13T16:16:29Z);
  `tools/src/handoffs/close.js` (`E_HO_STATE`); `docs/workflows/handoffs.md`.

### AP-091 — RELEASE-FINALIZER put into the first commit the unclosed handoff of its own step, and the check on GitHub turned red

- Что случилось: in the run `REQ042-20261013-01` RELEASE-FINALIZER committed and pushed to `main` the commit
  `fd5fac6` together with the handoff of step 11 in the status `PENDING`. `handoffs-check` on GitHub gave a violation
  H4 («status: PENDING в коммите: в коммите только законченные handoff-ы», "status: PENDING in the commit: only
  finished handoffs are in the commit"), the run of `check.yml` 38416285312 is red at the step "Run the check", the
  command did not reach the tests. Locally the check was green because the file was not in the commit. In the words
  of the finalizer itself: «Причина — моя ошибка: я включил этот handoff в первый коммит до закрытия» ("The cause is
  my error: I included this handoff in the first commit before closing") (`step-11-release-finalizer.json`,
  `result.summary`, I1); by the record of ORCH in the task of step 10 of the run `ISS-0062-20261013-01`, the task of
  ORCH listed the whole folder `handoffs`. The handoff was closed and committed in a separate second commit
  (`130a46d`).
- Почему это плохо: a red check on the shared branch (Q4) because of the order of work and not of the code; the push
  went directly because the owner is an administrator and `enforce_admins` is off (`decisions/0048`), that is, the
  protection of the branch did not stop a red check.
- Как правильно: an unclosed handoff does not go into a commit; the commit of the handoff of its own step is
  separate, after `close` (this is how the second commit was done); in the task of RELEASE-FINALIZER, ORCH writes
  the files by name and not the whole folder, and explicitly: «handoff шага 11 не добавлять в первый коммит» ("do
  not add the handoff of step 11 to the first commit"); before the commit the finalizer runs `handoffs-check` on what
  really goes into the commit (the list of files is `git diff --cached --name-only`, the status of each handoff in
  it is not `PENDING`).
- Где найдено: `handoffs/REQ042-20261013-01/step-11-release-finalizer.json` (summary, I1, I2);
  `handoffs/ISS-0062-20261013-01/step-10-doc-updater.json` (the task, the words of ORCH); `tools/src/handoffs/`
  (the rule H4).

### AP-092 — In the review task a record of the error journal that does not exist was named: the reference to an AP number was not checked against the file

- Что случилось: in the task of step 5 of the run `ISS-0062-20261013-01` (the review gate) among the comparisons
  there stood «AP-060, AP-065, AP-089 если есть» ("AP-060, AP-065, AP-089 if it exists"). REVIEWER found that there
  is no such record, the last one was AP-088 (`step-05b-reviewer.json`, F3: «Задание называет «AP-089 если есть»:
  такой записи нет», "The task names «AP-089 if it exists»: there is no such record"), and ORCH confirmed in
  `orch_check` («AP-089 в задании названа ошибочно; последняя запись AP-088 — DOC-UPDATER пишет следующую», "AP-089
  is named in the task by mistake; the last record is AP-088 — DOC-UPDATER writes the next one"). The reservation
  "if it exists" turned a reference to a non-existent fact into a check for the performer.
- Почему это плохо: a task must contain only facts from the project files (`docs/workflows/handoffs.md`, "How ORCH writes the task", AP-012); a reference to a non-existent record wastes the move of the
  checker and suggests that the lesson is already recorded, although it is not.
- Как правильно: before referring to an AP-, ISS- or other number in a task, ORCH checks it with a command
  (`grep -n '^### AP-089' docs/anti-patterns.md`); if a lesson is needed that does not yet exist, it writes «записи
  нет, предложить» ("no record, propose") and asks for a proposal in `result.issues`, and the record is made by
  DOC-UPDATER.
- Где найдено: `handoffs/ISS-0062-20261013-01/step-05b-reviewer.json` (the task, F3, `orch_check`);
  `handoffs/ISS-0062-20261013-01/step-01-issue-fixer.json` (I9 — the proposal of a record, which is now made as
  AP-089).

### AP-093 — A test itself contained the words whose absence the criterion checks: the command "the search is empty" became impossible

- Что случилось: criterion 9 (в) of REQ-036 requires that `grep -rn '· и ещё\|NOW_MORE' tools/test/
  tools/src/pixel-office/ docs/design/REQ-007-office-ui.md` finds nothing. The test `NM-02`
  (`tools/test/pixel-office-panels.test.js`), which exactly checks that these words are not in the code, wrote them
  literally — in a comment, in the expression `/NOW_MORE|· и ещё/` and in `Object.hasOwn(TX, "NOW_MORE")`.
  TEST-DESIGN-VALIDATOR: «Пока тест пишет искомые строки буквально, критерий 9 (в) невыполним: RELEASE-VALIDATOR
  получит FAIL на этом пункте при любом коде» ("While the test writes the searched strings literally, criterion 9
  (в) cannot be met: RELEASE-VALIDATOR will get FAIL on this item with any code")
  (`step-05b-test-design-validator.json`, F1, Medium, blocks). TEST-DESIGNER assembled the name and the tail from
  parts at run time; the check became stricter (checks of the expression itself were added), the mutants N3, N3b,
  N3c, N4 make `NM-02` fail (`step-05b-test-design-validator-r1.json`).
- Почему это плохо: a criterion "the search over the folders is empty" and a test lying in the same folders
  contradict each other; one rework of the test gate went on this (1 of 3).
- Как правильно: if a criterion checks the absence of words by a search over a folder where the tests lie, the
  test assembles the searched thing from parts (`["NOW", "MORE"].join("_")`), and the comment describes it without
  the words themselves; before handing in, TEST-DESIGNER runs the command of the criterion verbatim over
  `tools/test/` and attaches the empty output; the design names this trap in the table "criterion → test".
- Где найдено: `handoffs/REQ044-20261014-01/step-05b-test-design-validator.json` (F1, `orch_check`),
  `step-05b-test-design-validator-r1.json`, `step-05-test-designer-r1.json`.

### AP-094 — A requirement stated that a behaviour already exists (masking of the description) without checking the code; the design inherited it, the gap was found only by TEST-DESIGNER at step 5

- Что случилось: the description of REQ-036 says: «секрет, попавший в описание, уже заменён «[скрыто]» при записи
  (hook.js, mask.js)» ("a secret that got into the description is already replaced with «[скрыто]» ("hidden") at
  writing (hook.js, mask.js)"). This was wrong: the hook and the server masked only `prompt_text`, the description
  and the roles went into the journal as they were. The design of the run considered the hook and the server
  unchanged (D1), the design gate and the review did not check this. At step 5 TEST-DESIGNER could not write a green
  test of criterion 6 of REQ-036 and stopped: «Утверждение требования … неверно, а проект (D1) считает хук и сервер
  неизменными. Зелёный тест этой части написать нельзя без правки кода вне public/» ("The statement of the
  requirement … is wrong, and the design (D1) considers the hook and the server unchanged. A green test of this
  part cannot be written without editing code outside public/") (`step-05-test-designer.json`, BLOCKED
  2026-10-14T15:22:52Z). An addition to the design r3, the decision `0056`, step 5c and a repeat of steps 3 and 4
  were needed; the defect is ISS-0068.
- Почему это плохо: a statement about existing behaviour in a requirement is accepted by all the following roles as a
  fact (AP-012, quality-bar §6, item 2); a secret could have reached the page, and the gap was found at the fifth
  step and not at the first.
- Как правильно: a statement "already exists" in the description of a requirement is backed by REQ-ANALYST with
  a command or a probe (a function, a file, an output), REQ-VALIDATOR repeats it; CODE-DESIGNER in the section
  «Проверенные факты о текущем коде» ("Checked facts about the current code") checks every such statement by a
  probe, and not by reading the description. The wording of the description of REQ-036 is corrected by WF-01 after
  the run (question О19 of the design), not by bookkeeping.
- Где найдено: `handoffs/REQ044-20261014-01/step-05-test-designer.json` (BLOCKED),
  `step-01b-code-designer-r3.json`, `step-01c-code-design-validator-r2.json`;
  `decisions/0056-pixel-office-mask-all-text-fields.md`;
  `docs/issues/ISS-0068-pixel-office-secrets-in-description-and-role.md`.
- Repeat on 2026-10-21 (`TEXT068-20261021-01`, WF-02): criterion 1 of REQ-068 stated «любая пара суррогатов
  допустима» ("any pair of surrogates is allowed") (1024 × 1024), without checking this on the list of forbidden
  characters itself. CODE-DESIGNER went through all pairs on a prototype and found that 127 pairs encode forbidden
  characters Cf outside the BMP (`handoffs/TEXT068-20261021-01/step-01-code-designer.json`, I1, Ф5; 1 048 449 pairs
  are allowed). The criterion was corrected by a micro-amendment of WF-01
  (`handoffs/PICKERTEXT-20261021-01/step-01c-req-analyst.json`), the enumeration is fixed by the test TT-1d. The rule
  is the same: a statement about a set («любая», "any", «каждый», "every", «ни одного», "none") is backed by an
  enumeration of this set before the criterion is written; no new record was made.

### AP-095 — The name of another project got into a search command in `self_check`: the design looked for it, and the trace check found it in the handoff

- Что случилось: CODE-DESIGNER of the run `REQ044-20261014-01` wrote into `self_check` a `grep` command with the name
  of the owner's earlier project in its pattern (a search that this name is not in the project). The command itself,
  kept in the handoff, became a trace. ORCH replaced the name with the stand-in words «<название прежнего проекта
  владельца>» ("<name of the owner's earlier project>") in `step-01b-code-designer.json` and in the rework `-r1`
  («ORCH заменил в self_check название прежнего проекта владельца словами-заменителем (проверка следов,
  decisions/0021)», "ORCH replaced in self_check the name of the owner's earlier project with stand-in words (trace
  check, decisions/0021)", `orch_check` r1). By the words of ORCH in the task of step 10, this happened twice and the
  trace check was red.
- Почему это плохо: a handoff is a project file; the name of another project in it violates the rule of `CLAUDE.md`
  ("links to other projects" are not written) and turns `traces` red; ORCH has to fix it in another's `result`.
- Как правильно: a command that searches for forbidden words is not written into `self_check` with the word
  itself: write «поиск названий других проектов и путей компьютера (шаблон — `tools/src/traces/`) → пусто» ("a
  search for names of other projects and computer paths (the template is in `tools/src/traces/`) → empty") or run
  `npm run traces` and attach its output; a template with a forbidden word lives only in the code of the check.
- Где найдено: `handoffs/REQ044-20261014-01/step-01b-code-designer.json` (`self_check`),
  `step-01b-code-designer-r1.json` (`orch_check`); `decisions/0021`;
  `handoffs/REQ044-20261014-01/step-10-doc-updater.json` (the task, the words of ORCH).

### AP-096 — The requirement gate did not compare the requirement with the decisions of ORCH "inside a run" of a past work: a contradiction of decision 0014 was found only at the third gate

- Что случилось: REQ-047 required that the window «Просмотр истории» ("History view") opens from the agent card and
  the card under it stays open. `decisions/0014` («Решения ORCH внутри прогона», "Decisions of ORCH inside a run", 5
  and 6) says the opposite: the window opens from the journal and the cards of the panel «Задачи» ("Tasks"), not from
  the agent card; an open card is closed when the window opens. Its «Граница» ("Boundary"): «Решения ORCH 1–7
  относятся к REQ-008 и могут быть отменены владельцем по одному» ("The decisions of ORCH 1–7 belong to REQ-008 and
  can be cancelled by the owner one by one") — that is, they go on acting. The gates of `PIXEL-20261014-01` step 2 and
  the rework r1 did not find this; the third check found it (`step-02-req-validator-r2.json`, N7: «Требование молча
  расходится с записанным решением (Q12; quality-bar §6, п. 7)», "The requirement silently differs from a recorded
  decision (Q12; quality-bar §6, item 7)"). ORCH did not cancel 0014, REQ-047 was rewritten (r3), this was the third
  and last rework of REQ-047. Later BA-ANALYST also took 0014 for a decision «о превышении лимита доработок REQ-008»
  ("about exceeding the limit of reworks of REQ-008") by its title (`handoffs/REQ044-20261014-01/step-08-ba-analyst.json`,
  I3).
- Почему это плохо: a decision is named after the occasion (the limit of reworks) but carries rules of the product inside;
  a checker who looks only at the titles of decisions misses them, and the requirement goes on with a contradiction
  (Q12).
- Как правильно: the decisions of ORCH "inside a run" act also after the run if their «Граница» says so;
  REQ-VALIDATOR at the first pass searches `decisions/` not only by the title but also by the affected words of the
  requirement (`grep -rn "Просмотр истории\|карточк" decisions/`) and lists the decisions found in its report;
  decisions with rules of the product are named by ORCH in the line of `decisions/README.md` so that the rules are
  visible.
- Где найдено: `handoffs/PIXEL-20261014-01/step-02-req-validator.json`, `-r1`, `-r2` (N7), `-r3` (`orch_check`:
  «урок «решения ORCH внутри прогона действуют дальше по Границе» — в AP через DOC-UPDATER», "the lesson «decisions of
  ORCH inside a run go on acting by the Boundary» — into AP through DOC-UPDATER");
  `decisions/0014-pixel-office-history-rework-limit.md` («Граница»).

### AP-097 — An agent broke off on a session limit in the middle of a step; the step was restarted with a new agent, and the handoff stayed `PENDING`

- Что случилось: by the words of ORCH in the task of step 10 of the run `REQ044-20261014-01`, an agent broke
  off on a session limit in the middle of a step, the step was restarted with a new agent, and the handoff of the
  broken-off one stayed in the status `PENDING`. In the handoffs of the run this case is not recorded (the field
  `interruptions` is in none of them, there are no `-runN` files); which step it was is not named in the Sai files.
- Почему это плохо: without a record of the break it is not visible which files the broken-off agent managed to change
  and what of this went into the work of the restarted one; a handoff `PENDING` for a step that is already done
  misleads bookkeeping and the check `handoffs-check` before a commit (AP-091).
- Как правильно: by `docs/workflows/handoffs.md`, section "Pauses and interruptions": before a
  restart ORCH checks the state of the handoff and of the files from `write_set` (what changed after `started_at`),
  writes the break into `interruptions`, and either continues the same agent, or closes the handoff `FAILED` with the
  mark `not_agent_attested` and starts the role again with a file `-runN`; a broken-off handoff does not stay
  `PENDING`.
- Где найдено: `handoffs/REQ044-20261014-01/step-10-doc-updater.json` (the task, the words of ORCH);
  `docs/workflows/handoffs.md` ("Pauses and interruptions").

### AP-098 — Continued agents stay "working" on the page until they finish: their handoff is handed in, but the end event is not yet there (an observation, not a code defect)

- Что случилось: RELEASE-VALIDATOR, having opened the owner's working page for reading only, saw in "Now" three rows
  "working" of acceptance roles, «две из них — роли шагов, которые уже сдали handoff-ы» ("two of them are roles of
  steps that have already handed in their handoffs") (`step-09-release-validator.json`, I3). ORCH: «продолженные
  агенты (SendMessage) не присылают окончания до своего завершения» ("continued agents (SendMessage) do not send an
  end until they finish") (`orch_check` of step 9). A check of the owner's journal with counting commands (without
  printing texts, 2026-10-14T19:46Z): on 2026-10-14, 18 agents were started, 13 of them were continued again (a
  repeated `SubagentStart` with the same `agent_id`); for 22 continuations after which the end had already come, the
  interval from the continuation to `SubagentStop` is up to 13.6 min (median 4.4 min); for the BA-ANALYST agent
  continued at 17:08:43Z (2 s after the handoff of the signature `step-08c` was created, 17:08:41Z) there was no
  `SubagentStop` at 19:46Z, although the handoffs of the signature `step-08c` and `-r1` were closed at 19:14:33Z and
  19:16:57Z. The page shows the journal correctly (criteria of REQ-001 and REQ-042).
- Почему это плохо: the owner sees "working" at a role whose step is already handed in, and may decide that work is going
  on; ORCH, looking at the page, may count the agent as busy.
- Как правильно: this is not a defect of the page; ORCH compares "working" with the status of handoffs and not the
  other way round, and does not continue an agent without need after the step is handed in; if this disturbs the owner,
  it is an input for a requirement about showing "continued" ones (new hook events — REQ-048), and not an edit of the
  reading rules.
- Где найдено: `handoffs/REQ044-20261014-01/step-09-release-validator.json` (I3, `orch_check`); the owner's journal —
  only a count of rows `SubagentStart`/`SubagentStop` by `agent_id` (decisions/0054, addition 2).

### AP-099 — The design promised a "wrap" of a long role without a named CSS rule, the criterion was checked by a text test, nobody measured the worst case before acceptance: the fourth repeat of AP-060, AP-065 and AP-089

- Что случилось: in the run `REQ048-20261015-01` the table of failure paths of the design
  (`docs/design/REQ-048-049-046-047-interactive.md`, section 5) promised, for a role outside the table of 128 characters
  without spaces, «легенда, панель, карточка — перенос» ("legend, panel, card — wrap"), but did not name the CSS rules;
  criterion 4 of REQ-048 («легенда и панель — перенос», "legend and panel — wrap") was closed by the test LW-05, which
  checks only text, while the page tests run on a hand-made DOM model without layout. DESIGN-QA did not measure the
  legend with a long role. The failure was found by acceptance (scenario 48, severity HIGH): in the window 1470×784 the
  name went beyond the edge up to 1165.8 px with 1049 visible, in 375×812 — up to 1157.8 with 356. ISSUE-FIXER: `.legend`,
  `.legend-item` and the name have no rule of wrapping inside a word, the legend rules have not changed since the first
  commit; `overflow-wrap: break-word` does not help here — it does not reduce the smallest width of a flex-line element
  and of an `inline-block` button, `anywhere` is needed; the same cause hit «Кто запустил» and «Кого запустил» ("Who
  started" and "Whom started") in the cards (`step-08d-issue-fixer.json`). Fixed by the edit `step-08e-code-fixer.json`,
  the rule is fixed by the test DQ-04.
- Почему это плохо: a promise of this kind rested on an unmeasured assumption, and the table "criterion → test" gave a text
  test for a check of wrapping; a diagnosis, a code edit, a repeat of the security, review and test gates and a repeat of
  acceptance were needed. This is the same class as AP-060, AP-065 and AP-089, the fourth time.
- Как правильно: (1) when a failure path promises a "wrap" of text from input, the design names the CSS rule for
  every element where such text stands in a flex element or in an `inline-block` button (`overflow-wrap: anywhere`, not
  `break-word`), and a ban of `nowrap` on the element and its ancestors; (2) the table "criterion → test" does not close
  a "wrap" with a text test — next to it stand a check of the CSS rule and a measurement in a browser; (3) DESIGN-QA and
  acceptance go around all elements where a long role can stand (legend, panel, "Now", «Кто запустил», «Кого
  запустил/а», filter options), and not only those named in the scenario, and measure the worst case (128 characters
  without spaces, three words of 40 characters) in windows 1470×784, 375×812 and 320×568.
- Где найдено: `handoffs/REQ048-20261015-01/step-08b-uat-runner.json` (scenario 48, Ф1), `step-08d-issue-fixer.json`
  (diagnosis, I1, I6), `step-08e-code-fixer.json`, `step-05-test-designer-r3.json` (DQ-04);
  `docs/design/REQ-048-049-046-047-interactive.md` (section 5; items 3.12 and 7.1 added at step 10).

### AP-100 — The layout measurement depended on the page clock: the design and acceptance r1 measured one moment, while "less than a minute ago" and "no fresh data" lengthen rows

- Что случилось: the interface description of the run `REQ048-20261015-01` (item 7.2) promised that the line of
  transitions of the launch card is visible at once: «запас высоты прежней раскладки (видимое тело 726 px при «сразу»
  около 570) её вмещает» ("the margin of height of the earlier layout (visible body 726 px with «at once» about 570)
  holds it"). Acceptance r1 passed because the stand was older than a minute (746.75 ≤ 755). The repeat r2 failed
  scenario 42: while the last event is younger than a minute, the basis of «Задачи» ("Tasks") with «меньше минуты
  назад» ("less than a minute ago") takes three rows instead of two, and the buttons go 9 px below the edge; after 60
  minutes without events «Рабочее место» ("Workplace") writes the long «свободен…» ("free…"), and the line is below the
  edge again. The worst case of the roles of the table is 48 px lower (ISSUE-FIXER, `step-08f-issue-fixer.json`; the
  line is visible only between 1 and 60 minutes). ISSUE-FIXER measured with the page clock fixed by replacing
  `Date.now` in the browser (the journal and the server were not touched). Fixed by the order of the parts of the card
  (`decisions/0060`, `step-08g-code-fixer.json`).
- Почему это плохо: a look that depends on the age of events, checked at one moment, passes or fails by accident — by how
  many seconds passed since the last event of the stand; the same error of the class AP-089 (an unmeasured longest
  text), only the length is given by time.
- Как правильно: (1) the design and the description name the heights of the parts for the longest text of every
  state, including the age («меньше минуты назад», a day) and «нет свежих данных» / «свободен»; (2) the probe of
  ISSUE-FIXER, the measurement of DESIGN-QA, acceptance and the regression measurement fix the page clock (replacing
  `Date.now` only in the page) and measure at least the moments +5 s and +61 min after the last event; (3) a test on a
  DOM model that checks the order of parts (DQ-05) is not passed off as a check of the look.
- Где найдено: `handoffs/REQ048-20261015-01/step-08b-uat-runner-r2.json` (scenario 42, Ф2),
  `step-08f-issue-fixer.json` (diagnosis, I1, I2, I6), `step-08g-code-fixer.json`;
  `decisions/0060-card-links-after-launcher.md`; `docs/design/REQ-048-049-046-047-ui.md` (item 7.2, corrected at
  step 10).

### AP-101 — The facts of the ORCH task were not compared with the files: an edit of the requirement block went without a "before" copy, and the task named 23 traps to the tests instead of 27

- Что случилось: in the run `REQ048-20261015-01` two reworks of the WF-01 step (`step-01e-req-analyst-r2.json`,
  `-r3.json`) edited criterion 5 of REQ-046 in the shared `docs/requirements.yaml`, and their gates
  (`step-01f-req-validator-r2.json`, `-r3.json`) got tasks without `context.before_copy` — a copy of the file "before"
  outside the project (AP-023). REQ-VALIDATOR noted this both times (I1: «context.before_copy в задании нет (AP-023)»,
  "there is no context.before_copy in the task (AP-023)") and restored the "before" copy itself — from `HEAD` and the
  current file (r2) and from its own gate file r2 (r3), comparing hashes; there was no expected verdict in the tasks —
  this is right (AP-018). Separately: the task of TEST-DESIGNER (`step-05-test-designer.json`) named «Ловушки раздела 9
  (23 шт.)» ("Traps of section 9 (23)"), while the design has 27; ORCH in `orch_check`: «Ловушек 27, а не 23 — ошибка в
  задании ORCH, проект верен» ("27 traps, not 23 — an error in the ORCH task, the design is right").
- Почему это плохо: without a "before" copy the checker can confirm the integrity of the rest of a shared file only by the
  author's hashes or by its own reconstruction — extra work and a risk of missing another's edit; a wrong number in a
  task could have cut the performer's work (23 mutants instead of 27) or cost him a move on checking (quality-bar §6,
  item 2).
- Как правильно: a task for an edit of a block of a shared file (`docs/requirements.yaml`) and for its gate carries
  `context.before_copy` — the path to the "before" copy outside the project and its hash, taken by ORCH before the edit
  (AP-023, AP-007); numbers and numbers of items in a task ORCH takes by a command over the file and not from memory
  (`grep -c` over a section of the design; like AP-092 for AP numbers), or writes "all traps of section 9" without a
  number; the expected verdict is still not told to the checker (AP-018).
- Где найдено: `handoffs/REQ048-20261015-01/step-01f-req-validator-r2.json` (I1), `step-01f-req-validator-r3.json` (I1),
  `step-05-test-designer.json` (the task, item 4; `orch_check`).

### AP-102 — A GitHub setting (visibility, branch protection) was recorded in bookkeeping and nobody re-checked it after it changed: a document for people outside the project repeated an out-of-date fact

- Что случилось: `STATE.md` (the section «На 2026-10-13 — REQ-030…», "As of 2026-10-13 — REQ-030…"), `decisions/0048` and
  ISS-0057 recorded: the repository is open on purpose, the protection of `main` is on (the required check `check`, a ban
  of force-push and deletion). On 2026-10-17 DOC-UPDATER of the run `DOCSEN-20261017-01` wrote in `README.en.md` (this file was merged into `README.md` and removed on 2026-10-25, decision 0080) "The main
  branch is protected since 2026-10-13…" — by these records, without reading GitHub. RELEASE-VALIDATOR read GitHub itself
  (`gh api repos/<владелец>/sai` → `"private": true`; the protection of `main` — the answer 403 "Upgrade to GitHub Pro or
  make this repository public to enable this feature") and gave FAIL: the repository is now private, there is no
  protection of `main` (`step-09-release-validator.json`, F1, I1). Who changed the visibility and when is not recorded in
  the Sai files; ORCH did not change the visibility. A repeat by this bookkeeping on 2026-10-17: `"protected": false`. An
  assumption (not checked): the protection disappeared together with the change of the visibility, because for a private
  repository on a free plan it is not available.
- Почему это плохо: a GitHub setting changes outside Sai (the owner, GitHub), while bookkeeping holds it as a permanent fact;
  a document for a reader outside the project almost went out with a wrong statement about protection; `STATE.md` went on
  stating a protection that no longer exists (since which day — unknown). The same root as AP-079 (words about an external
  setting are frozen, the fact changed).
- Как правильно: (1) before any statement about a GitHub setting (visibility, branch protection, required checks,
  rights) — read GitHub now (`gh api repos/<владелец>/<репозиторий>`, `…/branches/main`) and write the date of reading next
  to the statement; (2) in documents for people outside the project do not write an external setting as a permanent fact —
  only what is true independently of it (for example, "every push is checked by `check.yml`"); (3) RELEASE-FINALIZER and
  RELEASE-VALIDATOR, seeing a difference between a setting and bookkeeping, tell ORCH, and bookkeeping appends a correction
  with a date (the earlier section is not rewritten).
- Где найдено: `handoffs/DOCSEN-20261017-01/step-09-release-validator.json` (F1, I1, `orch_check`),
  `step-01-doc-updater-r2.json`, `step-11-release-finalizer.json` (I3); `STATE.md` (the sections «На 2026-10-13 — REQ-030…»
  and «На 2026-10-17»); `decisions/0048`; `docs/issues/ISS-0057-readme-says-no-branch-protection.md`.

### AP-103 — A repeat of AP-095: a checker wrote into `self_check` a search command with names of other projects, and the trace check turned red

- Что случилось: RELEASE-VALIDATOR of the run `DOCSEN-20261017-01` checked that the new documents have no names of other
  projects, and wrote into `self_check` of its handoff the very `grep` command with these names. After its `close`
  `npm run traces` turned red on this handoff — DOC-UPDATER of the rework r2 reported: «npm run traces красный (код не 0)
  из-за чужого файла: handoffs/DOCSEN-20261017-01/step-09-release-validator.json … в self_check RELEASE-VALIDATOR записана
  команда grep с названиями других проектов» ("npm run traces is red (code not 0) because of another's file: …
  RELEASE-VALIDATOR's self_check has a grep command with names of other projects") (`step-01-doc-updater-r2.json`,
  issues). ORCH replaced the names with «<названия других проектов>» ("<names of other projects>") (`orch_check` of step 9,
  2026-10-17T03:17:06Z: «traces; повтор AP-095», "traces; a repeat of AP-095").
- Почему это плохо: the rule from AP-095 was already recorded, and the role repeated it; the closed handoff had to be edited by
  ORCH, and the check of the whole repository stood red while another role's rework went on.
- Как правильно: as in AP-095 — in `self_check` write «поиск названий других проектов и путей компьютера (шаблон —
  `tools/src/traces/`) → пусто» ("a search for names of other projects and computer paths (template — `tools/src/traces/`)
  → empty") or attach the output of `npm run traces`, and not a command with the words themselves; before `close` every role
  runs `npm run traces` on its handoff (it is part of `npm run check`); ORCH in the task of a checker who is told to search
  for traces reminds this rule.
- Где найдено: `handoffs/DOCSEN-20261017-01/step-09-release-validator.json` (`self_check`, `orch_check`),
  `step-01-doc-updater-r2.json` (issues); AP-095.

### AP-104 — ORCH allowed an agent to append a requirement and a closed handoff after `close`, when the gate had already started its check: a repeat of AP-090

- Что случилось: in the run `REQ050-20261017-01` REQ-ANALYST closed the handoff of rework r3 (`step-01e-req-analyst-r3.json`)
  at 18:14:34Z. The gate (`step-01f-req-validator-r3.json`) started its check at 18:15:40Z on the hash 3355a459…; at 18:15:55Z
  `docs/requirements.yaml` changed once more — rows 13, 21, 22 of the REQ-048 table and a comment above its criteria were
  appended — and in `result.changes` of the already closed handoff a fourth item about REQ-048 appeared. REQ-VALIDATOR noticed
  the change of the hash and started the check again on the new state (I1: «закрытый handoff дописан после close (как
  AP-090)… правка должна завершиться до close и до запуска ворот», "the closed handoff was appended after close (like
  AP-090)… the edit must finish before close and before the start of the gate"). ORCH in `orch_check`: «правка после close по
  разрешению ORCH во время старта ворот — ошибка ORCH (повтор AP-090)», "an edit after close by ORCH's permission during the
  start of the gate — an error of ORCH (a repeat of AP-090)".
- Почему это плохо: a closed handoff is a record of what was handed in, an edit after `close` rewrites history (AP-002, AP-090);
  the checker started work on one state of the file, and the author changed it under him — the check could have counted the
  wrong version if the change of the hash had not been noticed.
- Как правильно: everything an agent must change, it changes before `close`; ORCH, remembering a missed edit after
  `close`, does not allow appending to the earlier handoff, but creates a new rework (`-rN`, with the command `new`) and starts
  the gate only after its `close`; the checker takes the hash of a shared file at the beginning and at the end of the check and
  starts again on a difference (this is what REQ-VALIDATOR did).
- Где найдено: `handoffs/REQ050-20261017-01/step-01e-req-analyst-r3.json` (`result.changes`, `completed_at`),
  `step-01f-req-validator-r3.json` (I1, `orch_check`); AP-090.

### AP-105 — A block with a negative margin and `z-index` was put on a row of buttons without a set width; the tests press `click()` right on the element and do not see the overlap

- Что случилось: at sub-step 2d of the run `REQ050-20261017-01` the block of the "?" button of the office (`.office-hint`) got
  `position: relative; z-index: 1; align-self: stretch` and a negative bottom margin to stand at the left edge of the first row
  of the legend. The interface description gave it a height and a margin, but not a width; `align-self: stretch` stretched the
  block over the whole width of the panel, and it lay on top of the first row of the legend. Acceptance found this by a mouse
  press (Ф3): in 1470×784 and 1920×1080 no legend button opened the card — `elementFromPoint` at every point of the buttons gave
  `div#office-hint`; in narrow windows "Main session" could not be pressed. The keyboard worked. HN-02 checked only the place of
  the block in the markup, and the tests on a fake DOM press buttons by calling `click()` right on the element — the overlap is not
  visible to them; DESIGN-QA compared the look (`step-08f-issue-fixer.json`). Fixed with `align-self: flex-start` and
  `pointer-events: none` on the block with `auto` only on the "?" button (`step-08g-code-fixer.json`,
  `step-08h-code-fixer.json`).
- Почему это плохо: the main function of the page (open an agent card from the legend) stopped working with the mouse while the tests
  were green and DESIGN-QA passed; a diagnosis, two code edits, a repeat of the gates and of acceptance were needed.
- Как правильно: an element that is pushed over other buttons by a negative margin or positioning gets the width of its content
  (`align-self: flex-start` in a flex column) or `pointer-events: none` with `auto` only on its own buttons; the interface
  description names for such a block both the width and `pointer-events`; DESIGN-QA and acceptance check the pressability of
  neighbouring buttons through `elementFromPoint` and a real mouse press (the DevTools protocol), and the test on a fake DOM checks
  the CSS rule (HN-02 after r3), with a reservation that this is not the look.
- Где найдено: `handoffs/REQ050-20261017-01/step-08b-uat-runner-r1.json` (Ф3), `step-08f-issue-fixer.json` (diagnosis, I4),
  `step-08g-code-fixer.json`, `step-08h-code-fixer.json`, `step-05-test-designer-r3.json` (HN-02).

### AP-106 — Opening a hint on hover was checked by separate events on a fake DOM, without touch: on a phone the hint lay on its own button and did not pin

- Что случилось: the "?" hints (REQ-053) opened on `mouseenter` and closed on `mouseleave`. HN-01 on a fake DOM called `mouseenter`,
  `mouseleave` and `click` separately. On touch, Chrome after `touchend` sends compatible mouse events (`mouseover`, `mouseenter`,
  `mousemove`, `mousedown`, `mouseup`, `click`) and before each one determines again the element under the point. In a narrow window
  the hint (`position: fixed`, at the bottom of the window) lay on the "?" button that stood at the bottom of the screen: `mouseenter`
  opened it, `mouseleave` closed it, `mousedown` and `mouseup` came to different elements, and the `click` that pins the hint went to
  their common ancestor — for buttons at the bottom of the screen the hint did not open with any touch (in the middle of the screen the
  touch worked; Ф2 of acceptance). DESIGN-QA did not emulate touch (`step-08d-issue-fixer.json`). Fixed: hover — only for the mouse
  (`pointerType`), the hints have `pointer-events: none` (D21, D22, sub-step 2g).
- Почему это плохо: on a phone a part of the hints was unavailable with green tests; tests with separate events checked not what the browser
  does on touch.
- Как правильно: an element over the page without pressable content gets `pointer-events: none`; opening on hover — only for
  `pointerType` "mouse"; acceptance and DESIGN-QA check touch (touch emulation, `Input.dispatchTouchEvent`) of the buttons in the part of
  the window where what they open appears; a test on a fake DOM is not passed off as a touch check.
- Где найдено: `handoffs/REQ050-20261017-01/step-08b-uat-runner.json` (Ф2, scenario 26), `step-08d-issue-fixer.json` (diagnosis, I6),
  `step-02g-frontend-dev.json`; `docs/design/REQ-050-053-guide.md` (D21, D22).

### AP-107 — A live region `aria-live` is hidden with `display: none` while empty: a screen reader may not read a text that is put into it together with the showing

- Что случилось: the tour row `div#tour-later` with `aria-live="polite"` (REQ-052, criterion 1) was by the design D20 "hidden by the rule
  `:empty`"; the code did this through `.tour-later:empty { display: none }`, and the region appeared in the accessibility tree at the same
  moment when a text was put into it. REVIEWER: «экранные дикторы часто не объявляют содержимое области, которой не было в дереве
  доступности до изменения» ("screen readers often do not announce the content of a region that was not in the accessibility tree before
  the change") (`step-04-reviewer-r1.json`, L1). ORCH ordered to fix it at once (REQ-052 requires announcing): the empty row was taken out
  of the header line (`position: absolute`) and has no sizes, margins, border and background — it is in the accessibility tree before the text,
  and for a sighted person the look is as before; checked with `Accessibility.getFullAXTree` (`step-04a-code-fixer.json`).
- Почему это плохо: the requirement to announce a text by a screen reader was met only in words; tests and the look do not catch this.
- Как правильно: a live region (`aria-live`, `role="status"`) exists in the accessibility tree before a text appears; an empty one is hidden
  only visually (out of the flow, zero sizes), without `display: none`, `visibility: hidden` and the attribute `hidden`; the design names the way
  of hiding, the test checks the CSS rule, the check in a browser is by the accessibility tree.
- Где найдено: `handoffs/REQ050-20261017-01/step-04-reviewer-r1.json` (L1, `orch_check`), `step-04a-code-fixer.json`;
  `docs/design/REQ-050-053-guide.md` (D20, clarified at step 10).

### AP-108 — ORCH passed a message to an agent before the handoff file was created: the creation was rejected by the trace check, and the agent was already answering

- Что случилось: by the words of ORCH in the task of step 10 of the run `PICKER054-20261019-01`, before step 9 (RELEASE-VALIDATOR) the message with
  the task went to the agent earlier than the handoff file appeared: the creation of the file with the command `new` was rejected by the check — in
  the text of the task a path to the sample project was written, and such paths in Sai files are forbidden (`traces`, `decisions/0021`). The agent
  meanwhile started work and gave an early answer to the message, without a handoff. The handoff of step 9 itself was created later:
  `handoffs/PICKER054-20261019-01/step-09-release-validator.json`, `created_at` and `started_at` 2026-10-19T18:56:36Z, closed at 19:02:47Z. The
  "early" correspondence itself is not recorded in the Sai files — the fact is taken from the words of ORCH, not from a handoff.
- Почему это плохо: an agent's work without a handoff is outside bookkeeping (Q14, `docs/workflows/handoffs.md`: a handoff is created with a command at the
  moment an agent is started); an early answer has no `result`, no time and no `handoffs-check`; and a path of another project in the text of a task is
  the same as AP-095 and AP-103.
- Как правильно: (1) first create the handoff file (`cd tools && npm run handoff -- new …`) and make sure that it is created and passes
  `handoffs-check`, and only then start the agent; (2) in the text of the task do not write paths of other folders and names of other projects — tell
  the agent in a separate message where the material lies (call it «проект-образец», "sample project", as RELEASE-VALIDATOR does), or give the path
  outside a file; (3) if the creation is rejected — edit the text of the task and create again, and do not start the agent with a message going around.
- Где найдено: the words of ORCH in `handoffs/PICKER054-20261019-01/step-10-doc-updater.json` (the task, item 3);
  `handoffs/PICKER054-20261019-01/step-09-release-validator.json` (`created_at`, I2: «Адрес проекта-образца в файлы Sai и сюда не пишется; называется
  «проект-образец»», "The address of the sample project is not written in Sai files or here; it is called «sample project»"); AP-095, AP-103.

### AP-109 — An agent ran `git checkout` in its copy outside the project, although `git checkout` is forbidden: in the task the ban was worded only for the project

- Что случилось: CODE-DESIGNER of the run `PICKER054-20261019-01` cloned Sai for a prototype into folders outside the project and inside these clones ran
  `git checkout` of a tag and `git checkout README.md`; in the disclosure it wrote: «запрет git checkout в задании относится к проекту; проект не
  затронут — git status проекта показывает только новый файл проекта и папку handoff-ов прогона» ("the ban on git checkout in the task refers to the
  project; the project is not touched — git status of the project shows only the new file of the design and the handoff folder of the run")
  (`step-01-code-designer.json`, I10). The project indeed did not suffer, ORCH accepted this in `orch_check` («git checkout агента — в его копии вне
  проекта, правило о запретах относится к проекту — принято, но в следующих заданиях запрет формулируется и для копий», "the agent's git checkout is in
  its copy outside the project, the rule about bans refers to the project — accepted, but in the next tasks the ban is worded for copies too").
- Почему это плохо: the ban on `git checkout/reset/stash/clean` protects the working tree from losing another's unsaved edits (in Sai the files of a run are
  not committed until step 11); the border "project / not project" was understood by the agent differently; the same move in a copy where unchecked files
  of the run lie could have erased them, and a prototype built in such a copy could give wrong numbers.
- Как правильно: in the task the ban is worded for copies too: «git checkout, reset, stash, clean запрещены везде, в том числе в копиях вне проекта;
  копию для прототипа делают свежим `git clone` (нужную метку — `git clone -b <метка>`) и не переключают» ("git checkout, reset, stash, clean are
  forbidden everywhere, including in copies outside the project; a copy for a prototype is made with a fresh `git clone` (the needed tag with
  `git clone -b <tag>`) and is not switched"); an agent that needs another version makes a new clone and does not switch the old one; it writes about any
  departure in `result.issues`.
- Где найдено: `handoffs/PICKER054-20261019-01/step-01-code-designer.json` (I10, `orch_check`); `handoffs/PICKER054-20261019-01/step-10-doc-updater.json`
  (the task, item 3).

### AP-110 — A repeat of AP-014 in the tests of the picker engine: the check of a repeat in a list covered only neighbouring equal elements, as the protection of inherited properties covered only known questions

- Что случилось: in the run `PICKER055-20261019-01` criterion 2 of REQ-055 names "a repeat in a list", and the tests (step 5) checked it only for neighbouring
  equal elements (`b1,b1` and `b1,b1,b9`); the protection "inherited properties do not count as answers" was checked only for an inherited property that is
  itself a known question (`a`…`d`). TEST-DESIGN-VALIDATOR at step 5b built its own mutants on top of the mutants of the design (106 in total, 102 killed):
  N23 (a repeat is looked for only against the previous element) and N35 (only against the first) survived with 0 red tests out of 71 — the list
  `[b1,b2,b3,b2]` with the mutant gave `ok: true` instead of `E_ANSWER duplicate_option`; N24 (the keys of answers are taken by a `for-in` walk) survived on
  answers `Object.create({ zz: 1 })` with their own correct keys. The verdict of 5b is FAIL (F1, F2 blocking, Medium), called a repeat of AP-014: the named
  place is closed, the neighbouring case of the same class is not. Rework 1 of 3 (step 5c) added the cases `[b1,b2,b1]`, `[b1,b2,b3,b2]`, explicitly built
  repeats through one element in the property PE-R1 and a new test PE-2e on inherited properties; at step 5d the mutants are killed (N23 and N35 — 2 red of
  74, N24 — 1 of 74).
- Почему это плохо: a test that closes only the example from the text of the criterion stays green with an error in the same rule but in another input: code that
  looks for a repeat only nearby would have missed a list with a repeat through an element, and a visitor can send such a list. The author of the test checked what the
  criterion named, and not the class of inputs of the rule.
- Как правильно: for every rule that checks an input set ("no repeat", "inherited does not count", "order does not matter"), TEST-DESIGNER builds cases by the
  class and not by the named example: a repeat neighbouring, through one element, with the first and with the last; an inherited property both known and unknown; in the
  design of the tests such classes are listed in advance. TEST-DESIGN-VALIDATOR still builds its own mutants for every border of the rule (a search against the
  previous, against the first, a skip of the last).
- Где найдено: `handoffs/PICKER055-20261019-01/step-05b-test-design-validator.json` (F1, F2, mutants N23, N24, N35); `step-05c-test-designer.json` (rework);
  `step-05d-test-design-validator.json` (closing of F1–F4); AP-014.

### AP-111 — In the task a module is called an evaluator of conditions, while it holds only a check of the form: the difference was found by the design and not by the task

- Что случилось: the task of step 1 of the run `PICKER055-20261019-01` called `tools/src/picker/conditions.js` "conditions of showing" and implied that the evaluation
  "is the condition true with these answers" already exists. CODE-DESIGNER compared this with the file and recorded the difference Ф4: the module has one function
  `checkCondition`, it checks the *form* of a condition in the tenant file (REQ-054), and the evaluator of visibility today is only the test oracle `visibleQuestionIds`
  in `tools/test/picker-helpers.js`. The engine had to be built with its own evaluation of conditions (D2 of the design), and the test oracle had to stay independent
  of the code of `src/`. Had the developer believed the task, he would have connected `conditions.js` and not got the values of conditions, and by connecting the test
  oracle he would have made the visibility test prove nothing.
- Почему это плохо: the name and the role of the module in the task are taken from memory or by the name, not by the content; on such a fact the volume of work, the
  dependencies and the independence of the check are built (quality-bar §6, item 2: a fact in a task is checked before building on it).
- Как правильно: ORCH, naming an existing module in a task, checks it with `grep -n "^export"` and writes what it does by the code (evaluates or only checks the
  form); the receiver, not finding the named thing in the file, writes the difference into `result.issues` and works by what was measured, as CODE-DESIGNER did in Ф4 (the
  command of the comparison and the output were attached to the record).
- Где найдено: `docs/design/REQ-055-picker-engine.md` (Ф4, D2, item "Q13"); `handoffs/PICKER055-20261019-01/step-01-code-designer.json`;
  `handoffs/PICKER055-20261019-01/step-09-release-validator.json` (Q13).

### AP-112 — A requirement names new modules and paths without checking the guard tests of earlier requirements (a repeat of AP-068)

- Что случилось: the requirements REQ-056, REQ-057, REQ-059, REQ-060 and REQ-062 were written with new folders, modules and commands (a server in `tools/src/picker/`, a
  page in `tools/src/picker/public/`, writing of applications, the command `new`, the folder `tools/src/picker-ai/`) and with the criterion "`npm run check` — code 0", but did
  not name the guard tests of earlier requirements that turn red from this. By gate 2 of the run `PICKERLANG-20261020-01` (`step-02-req-validator.json`, F2–F6) this was found
  by reading the tests on the current files: PK-6d (the exact text of the help and «Доступна: check», "Available: check"), PK-6e (the closed list of modules and the ban of
  write words in the folder), PK-7c (the allowed `node:` modules), PK-8c (the ban of listing a folder), PE-8d (the list of modules of the engine), TR-4b, TR-4d, TR-4e, TR-4f
  (network files, addresses, `fetch(` and addresses in `public/` — the guard of criterion 4 of REQ-014). In the same place F1: the sample `e-field-schema.json` held the value
  `sai-picker-tenant/2` as wrong, and the new format made it right. The earlier gates (`PICKER-20261019-01`, step 2) did not notice this. Fixed by two reworks of the author
  (`step-01b`, `step-01c`) and two repeated gates (`step-02b`, `step-02c`): each requirement got a section «Охранные тесты прежних требований» ("Guard tests of earlier
  requirements") with a table of replacements without losing the ban, and for AI — an exception from criterion 4 of REQ-014 in `decisions/0069`, item 8.
- Почему это плохо: the guard tests of earlier requirements are part of `npm run check`; a requirement that does not name them gives a red check at the build, and the developer
  either weakens another's ban or stops in the middle of the run — and an edit of another requirement and a record of a decision after the work violate Q12. The same class as
  AP-068, repeated on a wider surface: one requirement after another writes a "closed list" of the new without comparing it with the lists of earlier ones.
- Как правильно: REQ-ANALYST, naming in a requirement a new module, folder, command, network address or write to disk, before writing looks for guard tests that count
  this (`grep` over `tools/test/` for the words `readdir`, `node:`, `fetch(`, `://`, lists of modules, exact help texts), and enters into the requirement a section "Guard
  tests of earlier requirements": which test, what turns it red, how it is changed without losing the ban (a table of replacements, as in `0061`). REQ-VALIDATOR in item (б)
  repeats this search itself, and does not trust the author's list. When a requirement is incompatible with a recorded rule (an external service against criterion 4 of
  REQ-014), the exception is recorded as a decision before building (`0069`, item 8).
- Где найдено: `handoffs/PICKERLANG-20261020-01/step-02-req-validator.json` (F1–F6); `step-02b-req-validator.json` and `step-02c-req-validator.json` (closing);
  `decisions/0069`; a repeat of AP-068.

### AP-113 — The description of a requirement named a list of modules where there is none (PK-7a, PK-8c), while the guard tests with closed lists (PK-6e, PE-8d) had to be edited with a table of replacements (a continuation of AP-112)

- Что случилось: in the description of REQ-061 there stood the phrase «охранные тесты закрытых перечней и запретов (PK-6e, PK-7a, PK-7c, PK-8c, PE-8b и PE-8d) получают новые
  модули в свой перечень» ("the guard tests of closed lists and bans (PK-6e, PK-7a, PK-7c, PK-8c, PE-8b and PE-8d) get the new modules into their list"). CODE-DESIGNER of the
  run `LANG061-20261020-01` checked this by reading the tests and recorded the difference Ф7: lists exist in PK-6e (the list of files of the folder is equal to `ALL_MODULES`),
  PK-7c (`CORE_MODULES.length`) and PE-8d (`ALL_MODULES.length`), while PK-7a and PK-8c have no list — they go over the folder themselves (`pickerSources()`, only the top level).
  CODE-DESIGNER and CODE-DESIGN-VALIDATOR confirmed this (`step-01-code-designer.json`, `step-01c-code-design-validator.json`, Ф7); the decision `0070`, О7, ordered the text of the
  requirement to be corrected during bookkeeping. Until the table of replacements existed, the earlier tests were red: on the code after step 3 exactly five are red — PK-1b, PK-1c,
  PK-2a, PK-6e, PE-8d (`step-04b-reviewer.json`, `step-05-code-fixer.json`, I1); after 15 rows of the table of replacements all 98 tests `picker-*` are green (review, step 4b). The
  phrase of the requirement was corrected in bookkeeping at step 12 (the "before" copy is `step-12-doc-updater.json`, `result.before_copy`).
- Почему это плохо: AP-112 required that a requirement name the guard tests of earlier requirements after reading the tests and not from memory. Here the list was named by the names
  of the tests, without reading: two tests of six turned out not to be lists. A task that names tests without checking them sends the developer to look for a list that is not there,
  and the design corrects the requirement after the fact, and in this run the difference was found by the design and not by the task (the same as AP-111).
- Как правильно: when a requirement names guard tests, REQ-ANALYST writes for each what exactly the test counts and where (`grep -n` over `tools/test/` with the line number and
  the output) — a "closed list" (a list or a number) or "goes over the folder itself"; REQ-VALIDATOR in item (б) repeats this reading for every named test, and not only for the first.
  In the table of replacements only tests that really turn red stay; tests without a list are recorded as "no edits, they act on the new modules" (this is how it was done in the design
  of REQ-061, item 11).
- Где найдено: `handoffs/LANG061-20261020-01/step-01-code-designer.json` and `step-01c-code-design-validator.json` (Ф7); `step-04b-reviewer.json` (red tests before the table of
  replacements); `decisions/0070` (О7); `docs/design/REQ-061-picker-languages.md` (Ф7, item 11); a continuation of AP-112.
- Repeat on 2026-10-21 (`PICKERCARD-20261021-01`, WF-01): REQ-065 again named the guard tests of the released REQ-056 with an incomplete list — it named only PK-6e, PK-7a, PK-7c,
  PK-8c, PE-8d, TR-4d, and did not name the tests that count the routes and the structure of `server.js` (SU-2, SV-3a, SV-3e, SV-4e and others, nine in all); found by gate 2 by reading the
  tests (P1, High, `handoffs/PICKERCARD-20261021-01/step-02-req-validator.json`), closed by the paragraph «Охранные тесты REQ-056 для новых маршрутов» ("Guard tests of REQ-056 for the
  new routes") with rows "was → became" and a comparison with the code (`step-01b-req-analyst.json`, `step-02b-req-validator.json`); no new record was made, the rule is the same.

### AP-114 — Translation readers who are not native speakers disagree with each other: the final "yes" of the agents does not prove that the disputed lines are right, and a third round of disputes does not resolve them

- Что случилось: the meaning of the translations kk and en was checked by reader agents in three rounds (criterion 8 of REQ-061). Round 1: "no" for 21 pairs of kk and 12 pairs of
  en; round 2: for 5 and 2; round 3: for 0 and 0; the final "yes" for 297 of 297 pairs in both languages (`step-10-ba-analyst.json`, `step-09-backend-dev.json`,
  `step-09b-backend-dev.json`). But the readers of Kazakh are not native speakers, and their edits differed between rounds and between runs: in kk 139 the first reader called «бос
  бюджет» ("free budget") ambiguous and asked for «еркін», the second proposed «бос бюджет», in the text there stands a third variant «Бос қаражат» (the word «бюджет» was not
  changed in the other nine texts); in kk 105 a reader proposed «сәйкессіздіксіз», a second called it heavy, «алшақтықсыз» was left; kk 141 («сауда» added), 121 (word order,
  verbatim from the reader) and 160 (in round 1 the meaning was the opposite) are also words of a reader, not a native speaker. Round 3 accepted these lines, but the "yes" of
  a reader agent does not mean that the Kazakh is flawless: RELEASE-VALIDATOR recognised criterion 8 as met only in the part of the reader agent and left five lines to a person who
  knows Kazakh (`step-11-release-validator.json`, К8).
- Почему это плохо: a third reader of the same nature does not resolve the dispute of two earlier ones — it chooses between variants without knowing which is right; the figure "297
  of 297" looks like a full check, although on the disputed lines it is the agreement of three who do not know.
- Как правильно: if after two rounds the edits of a line differ (readers propose different words or one rejects the word of another), the line is not given to a third reader,
  but marked "for a native speaker" in `result.issues` (kind `FOR_NATIVE_SPEAKER`) and goes together with the variants to the owner or to a person who knows, before publication; the
  number of "yes" of agents is written separately from the number of lines waiting for a native speaker; the criterion is recorded as met only in the part of the reader agent (as in
  `decisions/0069`, item 6, and the record of REQ-061).
- Где найдено: `handoffs/LANG061-20261020-01/step-10-ba-analyst.json` (I1, I2), `step-09b-backend-dev.json` (I1), `step-11-release-validator.json` (К8); `decisions/0069`, item 6.

### AP-115 — A threshold by the size of the socket buffer in a stability test (SF-6b) turned red in about 7% of runs: the test depended on the circumstances and not on the code

- Что случилось: the test SF-6b of the file `picker-server-faults.test.js` checked that the server stops accepting the body of a request: the client sends a stream of 40 MiB, and by the
  time the server closed the connection the client could have written no more than 12 MiB (`assert.ok(forty.written < 12 * 1024 * 1024)`). TEST-DESIGN-VALIDATOR of the run
  `SERVER056-20261020-01` ran the four server files in a row 44 times: 3 red, in the two caught ones — SF-6b with the messages `written 13107200` and `written 12582912` (the latter is
  exactly 12 MiB). The test without any change of code turned red because the loopback socket buffers on both sides together gave 12–13 MiB, and the margin of 4 MiB was smaller than
  their spread. The whole `npm run check` and SF-6b alone (0 of 30) were green meanwhile. Fixed by rework 1 (`step-05c`): `serverClosed` and `written < 30 MiB` are checked (a server that reads
  everything would have accepted 40 MiB, mutants M14–M16 stay red), the extra check of time was removed; the stability series after the fix is 62 runs in a row without red, SF-6b alone ×40
  with two parallel `npm test` — 0 of 40.
- Почему это плохо: a threshold chosen by single measurements on a quiet machine checks the size of the buffer of the operating system and not the behaviour of the server. Such a test turns red rarely and
  without connection to the work, it is written off as "unstable" (ISS-0075 has already collected three such tests), and a real error of the server hides among false reds. A single green run does not
  check the circumstances (quality-bar §6, item 1).
- Как правильно: when a test compares a number that the system sets (a buffer size, time, the order of events), the threshold is taken with a margin of several times and not by eye, and catches a
  qualitative difference (the stream was not stopped at all: almost everything was accepted) and not one that lies inside the spread of buffers. TEST-DESIGN-VALIDATOR at step 5b runs the test files as a
  series in a row (tens of times) and under load, and not as a single run; a red in a series is a finding, even if `npm run check` is green. Numbers by wall clock (less than 1500 ms) are not used in
  stability tests.
- Где найдено: `handoffs/SERVER056-20261020-01/step-05b-test-design-validator.json` (F1), `step-05c-test-designer.json` (rework), `step-05d-test-design-validator.json` (closing, a series of 62 runs);
  connected with ISS-0075.

### AP-116 — A test that does not finish on a red check: an exception in the check did not let the started server be closed, and the test file hung

- Что случилось: the failure tests SV-1c2, SV-1g and SF-6f checked that `startPicker` with a wrong parameter does not start a server. If the server was started by mistake (mutants M96 and M75), the red check
  threw an exception before this server was closed, and the `node --test` process did not finish: the run hung instead of ending red. TEST-DESIGN-VALIDATOR (`step-05b`, F3, Low) found this with mutants; with M75
  the file did not finish after the red SV-1b, SV-1c2, SV-1g and SV-1h. Fixed by rework 1 (`step-05c`): the helper `startPickerClosing(t, …)` closes the server in `t.after` if it was started after all; all calls of
  `startPicker` in the failure tests were replaced with it. After the fix M96 and M75 are red, the files finish in 29–30 s (`step-05d`, 59 mutants without a single hang).
- Почему это плохо: a red check after which the run does not finish cannot be told from a hang of the environment; `npm run check` stands for hours, ORCH or an agent kills the process, and the red test stays without a message.
  A test whose release of a resource comes after the check does not release it when the check is red.
- Как правильно: a resource that a test opens (a server, a socket, a timer, a process) is closed through `t.after` right after opening, and not at the end of the test body after the checks. For failure tests this is
  especially important: they are the ones that start a server where it must not be started. TEST-DESIGN-VALIDATOR for failure tests checks with the mutant "the refusal does not work" not only that the test turns red but also
  that the test file finishes after that.
- Где найдено: `handoffs/SERVER056-20261020-01/step-05b-test-design-validator.json` (F3), `step-05c-test-designer.json`, `step-05d-test-design-validator.json` (closing).

### AP-117 — In the acceptance task the expectation "there are no errors in the browser console" stood wider than the criterion: a failure of a scenario that is not in the criterion came out

- Что случилось: criterion 5 of REQ-056, part 1, required: the page opens (200), shows a stub, the text is visible in the chosen language, a snapshot for each language. Into the task of UAT-RUNNER (`step-08`) ORCH added
  scenario 3 «в консоли браузера нет ошибок и предупреждений» ("there are no errors and warnings in the browser console"). On a server with a closed list of routes, a fresh Chrome itself asks for `/favicon.ico`, gets 404 and writes a
  line `error` into the console — 18 loads out of 18 (Ф1, Low). The scenario "failed", although the criterion is met; RELEASE-VALIDATOR reproduced the same line itself (4 of 4) and analysed that the criterion Ф1 does not block
  (`step-09`, F1, I1). The decision is in ISS-0081, item 5, and in the conditions of the design of REQ-057.
- Почему это плохо: a scenario that is not in the criterion turns a right finding into an "acceptance failure", and the release waits for a decision on what to count as an error. Worse, the expectation is checked after the build,
  when it is already late to edit the stub, and the decision (declare an icon or record an exception) belongs to the design.
- Как правильно: the expectations of a scenario are taken from the criterion verbatim. If ORCH or BA-ANALYST wants to check more (the console, speed, contrast), this is written into the criterion in advance, through WF-01, or is marked
  in the scenario as "a remark, not a failure". For a page with a browser the design decides at once about the request for an icon (declare it or record an exception), like about any request that the browser makes itself.
- Где найдено: `handoffs/SERVER056-20261020-01/step-08-uat-runner.json` (scenario 3, Ф1), `step-09-release-validator.json` (F1, I1, I4а), `docs/uat/REQ-056-RUN.md`; ISS-0081, ISS-0077 (update of 2026-10-21).

### AP-118 — The table of translations in the design diverged from the code after the edits by readers: the design fell behind, and tests by the table would have turned red (a continuation of AP-114)

- Что случилось: in the design of REQ-056 (item 5.4) there stood a table of 12 server texts, and kk and en in it are named as a sentence that the readers will check. The readers (step 2c) proposed edits, ORCH accepted them,
  and different values got into `texts.js`: eight values in six keys (`server_forbidden`, `server_method`, `server_wrong_type`, `server_slow`, `server_answers_invalid`, `page_stub_notice`); I compared the table with the file by a
  program. REVIEWER noticed the difference at step 3b (F5), RELEASE-VALIDATOR confirmed at step 9 (F5). The design by the table is the support of TEST-DESIGNER: one who took the lines from the table would have got red tests on the texts;
  ORCH told him that `texts.js` is what acts.
- Почему это плохо: the table of texts in the design and the file of texts are two copies of one thing (AP-014); for a translation that readers edit the source of truth changes at once. The design stays a document by which tests and the
  README are made, and its out-of-date line turns into a false oracle.
- Как правильно: in the design the table of texts that readers will edit is marked «исходная редакция; источник истины — `texts.js`» ("original version; the source of truth is `texts.js`"), and at every edit by readers (the step at which
  ORCH accepts it) ORCH or CODE-DESIGNER append this to the design or tell TEST-DESIGNER explicitly. Tests take the texts from `texts.js` and not from the table of the design. DOC-UPDATER at step 10 compares the table of the design with the file
  by a program and writes in the design how many values in how many keys diverged (here a mark after the build was added in item 5.4).
- Где найдено: `handoffs/SERVER056-20261020-01/step-03b-reviewer.json` (F5, I1), `step-09-release-validator.json` (F5, I4б), `docs/design/REQ-056-picker-server.md`, item 5.4; a continuation of AP-114.

### AP-119 — A checker's probe stopped a process by a name pattern and hit its own server: the 10-minute stability check broke off through the fault of the probe

- Что случилось: RELEASE-VALIDATOR of the run `SERVER056-20261020-01` (step 9) started a 10-minute stability check of the server and in the course of it killed a process with a command by a name pattern; the pattern matched
  the checked server itself too, and the run broke off. This is not a failure of the server; the check was repeated in full, it passed (8650 requests, memory 58 → 62 MB, the process alive). Noted in `step-09`, I4в, and in the
  section about stability.
- Почему это плохо: stopping by a name pattern (`pkill -f`, `killall`) depends on what else runs on the computer with the same command name: it can kill another's process (including Pixel Office or the server of another agent) or the
  checked server instead of the extra one. A long check that broke off costs minutes, and the red look of the run is similar to a failure of the server.
- Как правильно: a process started by a probe is stopped by its own identifier (`$!` when started in the background, then `kill "$PID"`), and before stopping one checks that the identifier is the right one. The server for a probe
  is started on port 0 and one checks that it alone is in the list of listening sockets. If a pattern is still needed, it includes the unique path of the data folder of the probe, so that it fits only that one.
- Где найдено: `handoffs/SERVER056-20261020-01/step-09-release-validator.json` (the section about stability, I4в).

### AP-120 — A ban of words by substrings without identifier borders gives false hits on ordinary code: `rm(` inside `setTransform(`

- Что случилось: in REQ-067 criterion 1 forbade in the code of the customer part the words `exec`, `eval(`, `rm(`, `fork` and others "as substrings", criterion 6 looked for `skip|todo|only`, criterion 4 — the
  substring `step-`. By gate 2 of the run `PICKERCARD-20261021-01` (P2, Medium) this was checked on real code: the owner's office draws through `ctx.setTransform(`
  (`tools/src/pixel-office/public/office-view.js:429`), and `rm(` is a substring of `setTransform(`; a page in the style of the office will repeat this move and turn red by criterion 1. Likewise `eval(` inside `retrieval(`,
  `exec` inside `execCommand`, `fork` inside `forkJoin`, `only` and `skipped` in the text of a test, `step-` in the name of the CSS class `step-list`. Fixed by the author's rework (`step-01b-req-analyst.json`): a rule of
  comparison by identifier borders (on the left and on the right there is no letter, digit, `_`, `$`; list A — whole words everywhere, list B — a name with an opening bracket, `new Function`), exact forms of a test skip (`.skip(`,
  `.only(`, `.todo(`), `step-` narrowed to the names of step files. The repeated gate checked the rule itself: 12 violations out of 12 caught, 10 permitted lines (`setTransform(`, `retrieval(`, `execCommand(` and others) not touched,
  on the real files there are no hits (`step-02b-req-validator.json`).
- Почему это плохо: a search by substring paints ordinary code red, and the builder either guesses how to compare, or softens the check (Q6), or renames other people's calls for the sake of the test. The weak link is not the ban itself but
  that the way of comparison is not named: "a word as a substring" and "a whole word" give different results on one file, and a requirement without a choice cannot be checked.
- Как правильно: a requirement that forbids words in code names the way of comparison (a whole identifier or a call, the borders), what counts as a violation in a comment and in a string, and exact forms instead of general roots
  (`.skip(`, not `skip`). REQ-ANALYST before writing checks the rule on the real code it will look into — on false hits (`setTransform(`, `retrieval(`) and on artificial violations; REQ-VALIDATOR in item (а) repeats this itself, as it
  did at gate 2.
- Где найдено: `handoffs/PICKERCARD-20261021-01/step-02-req-validator.json` (P2); `step-01b-req-analyst.json` (the rule and the check); `step-02b-req-validator.json` (closing); `docs/requirements.yaml`, REQ-067, criteria 1, 4, 6.

### AP-121 — The output of an unstable red was not saved: the cause had to be restored from the OS log, and it cannot be proved

- Что случилось: at gate 1g of the run `SERVER056-20261020-01` the first full `npm run check` turned red with one test EX-42; the repeated run was green, and the red was recorded as "not because of the work". The full output of that
  failure and its exact time did not get into the handoff. The diagnosis of ISS-0075 (`step-01-issue-fixer.json`, item 3 and I12) later ran the same file 368 times on unchanged code and never got a red; the mechanism (a step of the wall
  clock backwards and the strict check of the time ENGINE) was reproduced only by emulation, and whether it was the cause of that single red stayed a coincidence in time with the OS log and is **not proved**. The closing of ISS-0075
  (RELEASE-VALIDATOR, `step-05`, I1) had to be limited: about EX-42 one cannot write that the cause is proved or the test is fixed.
- Почему это плохо: the evidence "whose failure" under quality-bar §6, item 4 requires a repeat with the same message; without a saved output there is nothing to compare a repeat with, and a red not connected with the work "by word" looks the
  same as a red connected with it. The defect stays with an unconfirmed cause, and the next agent again decides whether to restart or to investigate.
- Как правильно: at the first red that an agent attributes not to the work, the full output of the failed test (name, message, stack), the exact time of the failure from the clock (`date -u +%Y-%m-%dT%H:%M:%SZ`), the number of the run
  and what ran in parallel (other runs, load) are saved in `result.issues` of its handoff; with them — a repeat without the work by §6, item 4. If the output is not saved, this is written directly, and the cause stays "not established".
- Где найдено: `handoffs/ISS-0075-20261021-01/step-01-issue-fixer.json` (item 3, I7, I12), `step-05-release-validator.json` (I1, item 5); `docs/issues/ISS-0065-team-channel-tests-real-clock-e-time.md` (update of 2026-10-21).

### AP-122 — The test environment is not protected from background actions of a tool whose version was updated on CI later than the tests were written: git 2.55 and newer held a lock in the checked tree

- Что случилось: the test HC-6a (`tools/test/handoffs-base.test.js`) hashes the whole tree of a personal temporary repository, `.git` included, before and after a command and requires that the hash does not change. Git of version 2.55 and
  newer (it is installed on `ubuntu-24.04` in GitHub Actions) after `git commit` starts a background cleanup (`git maintenance run --auto --detach`), which takes `.git/objects/maintenance.lock`; the hash "before" saw the lock, "after" did not.
  Two runs of `check.yml` on GitHub turned red with the same test on the same line, a restart helped (ISS-0075). The description of the defect had before named "a slow GitHub machine" as the cause — this was a guess without reproduction.
  Reproduced only with git 2.55.0 (the lock is visible in 74 of 100 commits; with 2.50.1 — in 0 of 100), on the local system git there was no red at all.
- Почему это плохо: the test passed on all machines where git is older, and turned red on a runner with a newer one; the sandbox of the test did not create conditions in which the surrounding tool does nothing "by itself". The git version in `check.yml`
  is not pinned (ISS-0084, item 5), so this will repeat at the next update of the image. Fixing the hash ("exclude the lock") is not allowed — the check "the command does not change the tree" would weaken (Q6).
- Как правильно: the sandbox of a test turns off, for all processes of the test and of the checked command, the automatic background actions of tools that write into the checked tree (here `GIT_CONFIG_COUNT=2`, `maintenance.auto=false`,
  `gc.auto=0` in `sandbox()`), and the test of the environment checks the keys themselves (FR-4, FR-5), not depending on the git version on the machine. The cause of an unstable red on CI is reproduced in the conditions in which it turns red (the same version of
  the tool), and is not named by a guess.
- Где найдено: `handoffs/ISS-0075-20261021-01/step-01-issue-fixer.json` (item 2, I3, I7, I9, I12), `step-05-release-validator.json` (item 2), `decisions/0075-flaky-tests-en62-hc6a.md`, `docs/issues/ISS-0075-team-channel-en62-flaky-inbox-race.md`.

### AP-123 — A criterion named a test file that does not exist: the design planned a file, the task did not name it, the tests went into another file, and the way of checking cannot be run literally

- Что случилось: criterion 9 of REQ-068 says: «Тест-свойство `tools/test/picker-text-property.test.js` с закреплённым зерном…» ("A property test `tools/test/picker-text-property.test.js` with a fixed seed…"). The design
  (`docs/design/REQ-068-picker-text-charset.md`, item 3, D9) also planned such a file, but in the `write_set` of step 5 of the TEST-DESIGNER task it was not there, and the property tests TP-9a…c went into the already named file
  `tools/test/picker-text.test.js`; TEST-DESIGNER recorded this in `result.issues` (`handoffs/TEXT068-20261021-01/step-05-test-designer.json`, INFO). The difference was found twice: by TEST-DESIGN-VALIDATOR
  (`step-05b-test-design-validator.json`, F1, Low) and by RELEASE-VALIDATOR (`step-07-release-validator.json`, F1, Low: «ls: no matches»; the content of the criterion is met, the named way of checking cannot be run literally). Fixed at step 8
  by an edit of the name in the criterion (`picker-text.test.js`, tests TP-9a…c; the meaning of the criterion did not change; the "before" copy is `handoffs/TEXT068-20261021-01/step-08-doc-updater.json`, `result.before_copy`).
- Почему это плохо: the WF-05 audit by the dimension "Requirements" runs the way of checking of every criterion literally; the file is not there — a High finding with a criterion met in substance. The gates of the requirement and of the design passed
  without opening the named file: the name of the file lived in the criterion, the design and the task as three independent records, and nobody compared them with each other. Item Q1 ("every criterion has its way of checking named") is not met while what is named cannot be run.
- Как правильно: (1) REQ-ANALYST names a test file in a criterion only after the file exists, or writes "a new file `…` is created by this work", and ORCH includes such a file in the `write_set` of TEST-DESIGNER; (2) CODE-DESIGNER, naming a test file in the
  table "criterion → test", compares the name with the criterion, and ORCH compares the `write_set` with the table of the design; (3) if TEST-DESIGNER puts a test in another file, it writes at once a `result.issues` of the kind `DISCREPANCY` with the name from the criterion, so that
  the difference is corrected by a micro-amendment of WF-01 before step 7, and not by RELEASE-VALIDATOR at the last gates; (4) TEST-DESIGN-VALIDATOR and RELEASE-VALIDATOR for every criterion run `ls` on the named file (as in `step-07`).
- Где найдено: `handoffs/TEXT068-20261021-01/step-05-test-designer.json`, `step-05b-test-design-validator.json` (F1), `step-07-release-validator.json` (F1); `docs/requirements.yaml`, REQ-068, criterion 9; `docs/design/REQ-068-picker-text-charset.md`, item 3 (D9).

### AP-124 — A test compared a document-model node with `assert.equal`: on a red check `assert` printed the whole tree, and one failing test took 6.7 GB

- Что случилось: in `tools/test/picker-page.test.js` the checks `assert.equal(page.part("notice"), null, ...)` (the helper `assertLeftAlone` and `QP-9k`) compared a node of the model of the document with `null`. The model already had a custom
  inspection that prints a node short, but `assert` prints its operands with the custom inspection **off** and with a depth of 1000, so on a red check it tried to print the whole tree. With the validator's mutant V12 (the notice is always shown) `QP-9k` alone ran
  32 s and took about 6.7 GB of resident memory (`handoffs/PAGE057-20261021-01/step-18-test-design-validator.json`, F3, Medium, the AP-116 class: a red check that does not end). A custom inspection of the model did not help (it already existed);
  the fix at step 20 made every field of a node except `tag` non-enumerable (`hide()` in `tools/test/picker-page-dom.js`, pinned by `QP-0c`), and the two places compare a count of the notices. The same run after the fix: 0.11 s and 69 MB (step 23).
  The price of the fix is a second trap, found by REVIEWER (`step-22-reviewer.json`, L1): `assert.deepEqual` of two different nodes now compares only the tag and passes for any two nodes of one tag.
- Почему это плохо: a red check that eats the memory of a 16 GB computer or never ends is worse than a red check with a message: the run is killed, nobody sees which test failed, and the machine of the owner is loaded for minutes. A test that passes for
  any two nodes is silent in the opposite direction (Q5, Q6). Both come from comparing a structure that is not a plain value.
- Как правильно: (1) never compare a node of a document model (or any big linked structure) with `assert.equal`, `assert.deepEqual` or `assert.deepStrictEqual`; compare a boolean, a count, an id or a text (`assert.equal(page.parts("notice").length, 0)`);
  (2) keep the fields of a model node non-enumerable, so that a mistake in a test cannot print a tree, and write the trap in the comment of `hide()` ("deepEqual of nodes compares only the tag; compare id, text or count"; ISS-0086, item 13);
  (3) TEST-DESIGN-VALIDATOR, when it runs a mutant, measures the memory and the time of the test that fails (`/usr/bin/time -l`) and treats a red check that does not end quickly as a finding of its own.
- Где найдено: `handoffs/PAGE057-20261021-01/step-18-test-design-validator.json` (F3, V12), `step-20-test-designer.json` (I1, the root cause and the fix), `step-22-reviewer.json` (L1, I2), `step-23-test-design-validator.json` (the repeated measure); `tools/test/picker-page-dom.js`; AP-116.

### AP-125 — A step of the acceptance run said "stop the stand and open the page": it cannot be done literally in a browser, and the runner had to find another way

- Что случилось: step PR-8 (a) of the browser acceptance of REQ-057 (section 18 of `docs/design/REQ-057-picker-page.md`, written there as «ПР-8») said: stop the stand (`kill <pid>`), open the page, see the block "no connection". With the server down a browser does not open the page at all: it shows its
  own error page (`net::ERR_CONNECTION_REFUSED`, address `chrome-error://chromewebdata/`), and the page code, which makes the block, never runs. UAT-RUNNER found it (`handoffs/PAGE057-20261021-01/step-26-uat-runner.json`, I1; remark R1 of `docs/uat/REQ-057-RUN.md`)
  and reached the block of the load by holding the questionnaire request at the browser until the stand was stopped, so the request failed against a really stopped server; BA-ANALYST (P5) and RELEASE-VALIDATOR (RV-3) repeated the remark. The criterion was met; the text of the step was not true.
- Почему это плохо: a step that cannot be carried out as written either stops the run or is changed silently by the runner, and then the next run repeats it differently. The wording of the design is the only record of how the failure was meant to be reached. The same words would be
  copied into the acceptance of REQ-058.
- Как правильно: an acceptance step for a lost connection is written so that it is possible in a browser: **hold the request** (a pause at the protocol of the browser, or a stand that accepts the connection and does not answer), then stop the stand while the request is held, then release; or open the page first and stop the stand before the action that makes the request.
  CODE-DESIGNER and BA-ANALYST, writing a step "stop X and open Y", first check that Y can be opened without X (here: no). The wording of PR-8 (a) is corrected in the design (ISS-0087, item 5) before the same step is reused for REQ-058.
- Где найдено: `handoffs/PAGE057-20261021-01/step-26-uat-runner.json` (I1), `step-27-ba-analyst.json` (P5), `step-28-release-validator.json` (RV-3); `docs/uat/REQ-057-RUN.md` (R1); `docs/design/REQ-057-picker-page.md`, section 18.

### AP-126 — Three FAILs of one gate on one step: the test catalogue was built from the criteria and from only a part of the rows of the design's rule tables, so each pass found the rows that still had no test

- Что случилось: the test-design gate of REQ-057 returned FAIL three times (steps 16, 18, 23) and the third one was a stop under `decisions/0079`, item 4; the owner allowed exactly one more test (`decisions/0081`). The Medium findings per pass were 3, 3 and 1. Of these seven, **five cite a row of the rule tables of the design
  (sections 5.1 and 5.2) that had no test**: step 16 F1-F3 — B1 (the notice of a changed questionnaire), Q2, Q3, Q5, E1 (the position is written on a move), L1 (the last press of a language wins); step 18 F1 — D5 (the card offers "Continue" for a place beyond the first question);
  step 23 F1 — C3 ("Start over" on the screen of the result). One (step 18 F2) is a state during an open request ("Skip" and "Back" stay live) that `QP-7g` covered in part; one (step 18 F3) is the memory of AP-124, not a gap of coverage. The table "criterion → test" of the design (section 16) covered the 11 criteria, but the rows of sections 5.1-5.2 were not mapped to tests, so nobody could see which rows were still open; the validator found them one pass at a time with its own mutants. Besides the Medium ones, the validator's own
  mutants gave a tail of Low gaps (2, 13 and 18 survivors in the three passes; ISS-0086) that were real (probes passed on the real code and failed on the mutant) but not required by any criterion.
- Почему это плохо: a pass of the gate costs a whole rework step, a validator run and, at the limit, a stop and a question to the owner (`decisions/0079`, item 4; `decisions/0081`). The three passes did not mean that the validator was too strict: its Medium findings were real rules of the design or real states of the page. They meant that the work of TEST-DESIGNER and of the first validator pass was not planned against the rows that decide the behaviour.
- Как правильно: (1) CODE-DESIGNER adds to the table "criterion → test" a second table "row of the rule tables (sections 5.1, 5.2 and the like) → test id", and CODE-DESIGN-VALIDATOR checks that every row has a test; (2) TEST-DESIGNER at the first pass takes every row, one case with a state check per row, and says in `result.issues` which rows have no test and why;
  (3) TEST-DESIGN-VALIDATOR at the first pass runs its mutants **for every row of the table first** and gives the whole list of Medium gaps at once, then its own free mutants; what is found beyond the criteria and the rows is recorded as Low and goes to an ISS at the pass where it is found, without blocking; (4) ORCH counts the Medium findings per pass: a pass that does not lower them gives a question to the owner before the third pass, not after it.
  Not proved: that these steps would have saved a pass. They follow the facts above (five of the seven Medium findings cite a row without a test) and I did not rerun the gates.
- Где найдено: `handoffs/PAGE057-20261021-01/step-16-test-design-validator.json` (F1-F3, I1), `step-18-test-design-validator.json` (F1, F2, F3), `step-23-test-design-validator.json` (F1, I1, I2); `decisions/0081-gate-limit-owner-allowance-req057.md`; `docs/design/REQ-057-picker-page.md`, sections 5.1, 5.2, 16 and 17.5-17.7; `docs/issues/ISS-0086-picker-page-test-gaps-req057.md`.

### AP-127 — Criteria of REQ-069 demanded an error, or a plain acceptance, for input that the description of the same requirement decided the other way

- Что случилось: three examples in the nine criteria of `REQ-069` could not hold together with its own description, and the code designer found them only when it ran the examples on a sketch (`handoffs/LOOK069-20261026-01/step-01-code-designer.json`, issues I1-I3 = questions O1-O3 of the design), after the requirement had passed its gate. (1) The criterion on the objects of the office demanded an error for `url(http://x)` as a staff name, but the description said only "a name: one line, 1-30 signs", which accepts that text. (2) The criterion said that `object` is accepted on the options of a question "of any of the three types", but a number question has no options in any format (`options` there is `E_FIELD`). (3) The criterion on colours listed `#e0731f` among the colours "without an error", but its contrast against the light sheet is 2.90 : 1, below the 3.0 : 1 rule of the same description (`#e0731f` is the colour of the approved sample). The fix was a micro-amendment before the design gate (run `MA069-20261026-01`, `decisions/0085` items 2-4): the staff name got a closed list of characters, `object` was limited to `single` and `multiple`, and the example colour became `#c67d42` (3.0000006 : 1). The accents of the approved sample also had to be corrected in `REQ-070` (`decisions/0085` item 4).
- Почему это плохо: a criterion that cannot hold is a failure at the release gate (Q1, Q5) or a silent weakening of the criterion by whoever builds it. The fault is cheap when found in the requirement and expensive when found after the design, the code or the tests are written to it. An example that is only looked at, not run, passes the requirement gate, because the gate reads the words against each other and the contradiction lies in a computation (a character class, a contrast ratio) or in the absence of a thing (options of a number question). It is the AP-123 / AP-012 class (a fact written in a criterion without a check), applied to the examples of a criterion.
- Как правильно: (1) the author of a requirement (REQ-ANALYST) runs **every example of the kind "must give an error" and "must be accepted"** against the rules of the description before writing it down: by hand through the real command on the released code when the rule already exists, otherwise by a short calculation (the contrast ratio, the length, the character class); where the description says only "a name, 1-30 signs", an error example for a character must be backed by a stated character list in the description; (2) a "for any of the types" or "in any of the formats" in a criterion is checked against the table of the types: it lists, in the description, the types that have the field; (3) a colour or a number taken from an approved sample is checked against the rule of the requirement before it is written as an example (a sample is not a rule); (4) REQ-VALIDATOR, when it reads a criterion that gives an example of an error, repeats the example against the description and names the rule that makes it an error; (5) a mismatch found by the code design is a WF-01 micro-amendment before the design gate, not an edit of the criterion inside the design. How it is checked: for each example of a criterion, the line of the check (command, calculation or test id) and its output stand in the handoff of the author; RELEASE-VALIDATOR repeats the same examples through the real command (in `REQ-069`, step 18: 125 own cases, 0 differ from the criteria; 19 652 contrast outcomes, 0 differ from its own function).
- Где найдено: `handoffs/LOOK069-20261026-01/step-01-code-designer.json` (issues I1-I3); `decisions/0085-picker-look-format-conventions.md` (items 2-4); `handoffs/MA069-20261026-01/step-01-req-analyst.json` (the amended criteria and `result.before_copy`), `step-02-req-validator.json`; `docs/design/REQ-069-tenant-look-format.md`, section 16.1; `handoffs/LOOK069-20261026-01/step-18-release-validator.json` (the repeat of the examples); AP-012, AP-123.

### AP-128 — A sample file was named with a word that `show()` hides: the message printed "(скрыто)" in place of the file name, found only when the sample was run

- Что случилось: while sketching the design of `REQ-069`, the sample for a desk with the JSON value `null` was named `e-desk-null.json`. The command `picker check` prints the file name at the start of a line through `show()` (`tools/src/picker/places.js`), and `show()` replaces any value that holds a word from the list of words that no message may contain (`null`, `token`, `undefined`, `nan`, `unexpected`, a second-person word) with `(скрыто)` («hidden»). The line printed was `(скрыто): questions[0].desk: E_FIELD: ...` and the file could not be told from any other file with such a name (design `docs/design/REQ-069-tenant-look-format.md`, fact F8). The sample was renamed `e-desk-empty-value.json` and the rule was written into section 13.4 of the design; the names of the 89 samples of `tools/test/fixtures/picker-look/` were checked after the work and none holds one of the words of the ban list.
- Почему это плохо: the line that the test compares letter by letter does not hold the name, so the test of a sample either fails with a confusing line or, worse, passes for a different reason. The word list is not near the place where files are named: the author of a sample name does not read `places.js`. A tenant who names a file `null.json` meets the same line in real use.
- Как правильно: (1) name a sample by the **case** it shows (`e-desk-empty-value`, `e-mark-two`), never by the JSON value or by a word of the ban list (`null`, `token`, `undefined`, `nan`, `unexpected`, a word of the second person); (2) CODE-DESIGNER lists the words of the ban in the section of the design that names the sample files (section 13.4 of the REQ-069 design is the model); (3) possible later cleanup, not built for REQ-069: a test of the sample folder that fails when a sample file name makes `show()` return the hidden mark, so that the mistake cannot reach a test. How it is checked now: `cd tools && npm run -s picker -- check <sample>` on each new sample prints a line that begins with the real file name; `ls tools/test/fixtures/picker-look | grep -iE 'null|token|undefined|nan|unexpected'` is empty.
- Где найдено: `docs/design/REQ-069-tenant-look-format.md` (fact F8, section 13.4, section 16.3); `handoffs/LOOK069-20261026-01/step-01-code-designer.json`; `tools/src/picker/places.js` (`show()`).

### AP-129 — A summary of passes said "no pair got a third «нет»", written from memory: the answer files show that pair 153 did

- Что случилось: the summaries of the two BA-ANALYST steps of the reader check of `REQ-070` (`handoffs/DEMO070-20261027-01/step-16-ba-analyst.json` and `step-17-ba-analyst.json`) say that no pair got a third «нет» and that the limit of `decisions/0087` item 3 (three passes at most for a pair, a third «нет» is a question to the owner) was not reached. The answer files of the readers show that pair 153 (English text) got «нет» in passes 1, 2 and 3. The fourth reading of this pair was the one-time extra pass that the owner allowed (`decisions/0087` item 6). The process was right: the owner was asked and answered, and the answer is recorded in the decision. The sentence about it was wrong: it was written from the course of the work, not computed from the files. RELEASE-VALIDATOR found it by counting the «нет» per pass and per pair from the answer files (`handoffs/DEMO070-20261027-01/step-19-release-validator.json`, finding F3). The closed handoffs are not edited; the correct count is in the release validator's step and in the follow-up document `docs/issues/ISS-0090-picker-demo-v3-followups.md`.
- Почему это плохо: a sentence like "the limit was not reached" is the one a later reader trusts when deciding whether a rule was kept. If it is false, the record hides the very event (a limit reached and an owner's decision) that the rule exists to show. It is the AP-018 / AP-080 class: a count or a state written from memory instead of read from the place that holds it.
- Как правильно: (1) every sentence of a summary that counts passes, answers, «нет» or limits is **computed from the answer files** of that run by a short script at the time of writing, and the command and its output stand in `self_check` of the same handoff; (2) a sentence of the form "no X reached the limit" is written only with the per-pair table behind it (the pair, the count, the pass numbers); (3) when a limit was reached and the owner allowed one more pass, the summary says so by name (the decision item) and does not call the limit "not reached". How it is checked: for the reader tables of a run, count the «нет» per pair over all pass files (one `node` or `jq` line) and compare with the sentence; the maximum per pair is the number the summary may give.
- Где найдено: `handoffs/DEMO070-20261027-01/step-19-release-validator.json` (finding F3, which recomputed the counts per pass: kk 15, 1, 0 and en 25, 5, 1, 0, 0); `decisions/0087-picker-demo-v3-reader-corrections.md` (items 3 and 6); `handoffs/DEMO070-20261027-01/step-16-ba-analyst.json`, `step-17-ba-analyst.json`; AP-018, AP-080.

### AP-130 — ORCH wrote the label «PASS» in `orch_check` of steps whose gate verdict was FAIL, where `handoffs.md` asks for «FAIL принят»

- Что случилось: `docs/workflows/handoffs.md` (section on the optional fields) says that ORCH writes `context.orch_check` after every step, on PASS and on FAIL, and that on FAIL the verdict is «FAIL принят» ("FAIL accepted"). In `handoffs/DEMO070-20261027-01/step-02-code-design-validator.json` and in `handoffs/LOOK069-20261026-01/step-13-test-design-validator.json` the gate's own verdict (`result.verdict`) is FAIL, and ORCH's `orch_check.verdict` is «PASS»; the line `checked` of each says, in words, that the FAIL was accepted. RELEASE-VALIDATOR saw the first one (finding F3 of step 19); a count over all closed handoffs of the repository on the day of this entry (55 closed handoffs with `result.verdict` FAIL and an `orch_check`) found 29 with a label other than «FAIL принят», all «PASS», in older runs as well. The label «PASS» there means "ORCH accepted the step", the other meaning of the word; for a reader who looks only at the field, a FAIL step looks passed. The closed handoffs are not edited (history is only appended to).
- Почему это плохо: the field is the one place where a later reader (or a script) looks for the state of a step. Two meanings of the word «PASS» in two fields of one file make a FAIL gate read as a pass; a rework that follows a «PASS» step looks like an extra step. No tool checks the label today, so the habit continued unseen for several runs.
- Как правильно: (1) on a step whose `result.verdict` is FAIL (a gate, a validator, a test run) ORCH writes `orch_check.verdict` = «FAIL принят» and puts the accepted findings into `checked`; on PASS the label is «PASS»; (2) a step that is not a gate has no gate verdict, and the label follows the rule of `handoffs.md`; (3) closed handoffs are not corrected; a wrong label is named in the next step's `checked` if it matters. How it is checked (one command, exit 0 and an empty list for a clean run): `cd tools && node -e 'const fs=require("fs");const p=process.argv[1];for(const f of fs.readdirSync(p)){if(!f.endsWith(".json"))continue;const j=JSON.parse(fs.readFileSync(p+"/"+f,"utf8"));const o=j.context&&j.context.orch_check;if(j.result&&j.result.verdict==="FAIL"&&o&&o.verdict!=="FAIL принят")console.log(f,o.verdict)}' ../handoffs/<RUN-ID>` prints nothing. A rule in `handoffs-check` that does the same is possible and needs a decision (it would turn the old handoffs red unless it is limited to runs after a date).
- Где найдено: `handoffs/DEMO070-20261027-01/step-19-release-validator.json` (finding F3); `handoffs/DEMO070-20261027-01/step-02-code-design-validator.json`, `handoffs/LOOK069-20261026-01/step-13-test-design-validator.json` (the two examples); `docs/workflows/handoffs.md` (the field `orch_check`).

### AP-131 — A requirement forbade a text to stand in two files and also asked the files to copy the sample, and the sample itself shared two texts and an id between the two tenants: found only by the code design

- Что случилось: criterion 4 of `REQ-070` forbids any text or id to stand in both tenant files (Q8), and criterion 2 asks that the Russian texts equal the approved sample except for the table of edits whose reasons were codes of the check. The sample itself gives the same role text to a desk of both tenants (two roles, three languages) and uses one option id (`none`) in both. A duplicate search over all strings of the sample was not run when the requirement was written; CODE-DESIGNER ran it and found it (`docs/design/REQ-070-demo-tenants-v3.md`, fact F5, question I1). The fix was a micro-amendment after the design (run `MA070-20261027-01`, `decisions/0086` item 1: the reason of a row may be `SEP`), a new test (DT-2d: the `was` text of every `SEP` row stands in both sample tenants) and two id renames (`decisions/0086` item 5).
- Почему это плохо: two criteria that cannot be met together are a stop at the design gate or a silent weakening later. The fault was cheap in the requirement (one search over the sample) and cost a micro-amendment, a design rework (a gate FAIL, `step-02`) and an extra test. A free label such as `SEP` without the test DT-2d would have excused any rewrite.
- Как правильно: (1) when a requirement says "copy the text of the sample" and also "no text shared between the files", the author (REQ-ANALYST) first runs a **duplicate search over all strings and ids of the sample** (one short script outside the project) and writes the result into the handoff; every shared string is named in the requirement together with what is done to it; (2) REQ-VALIDATOR repeats the search when it reads such a pair of criteria; (3) an exception that has a free reason label (such as `SEP`) always comes with a test that the reason is true (the shared text really stands in both). How it is checked: the script lists the strings that occur in more than one tenant of the sample; the list in the requirement or the design equals it (in `REQ-070`: the roles at desks 1 and 4 and the id `none`).
- Где найдено: `docs/design/REQ-070-demo-tenants-v3.md` (sections 1 F5, 6.1, 15); `handoffs/DEMO070-20261027-01/step-01-code-designer.json`, `step-02-code-design-validator.json`; `decisions/0086-picker-demo-tenants-v3-choices.md` (items 1 and 5); `handoffs/MA070-20261027-01/`; AP-127.

### AP-132 — Checkers of one audit worked on one computer at the same time without a boundary: a probe folder appeared and vanished in the working tree, a foreign browser ran during a browser check, and a third full check was started by mistake

- Что случилось: in audit `AUD-001` (WF-05, step 3) five auditors and two RELEASE-VALIDATOR runs worked at the same time on one computer and one working tree. RELEASE-VALIDATOR recorded three events in `step-03f-release-validator.json` (issues I1-I3, kind PROCESS). (1) A folder `runs/WF06-20261027-99` (a probe of SECURITY-AUDITOR for finding SEC-02, created 2026-10-27T12:43:11Z) was in the working tree at about 13:05Z and was gone at about 13:10Z, while `security.json` says the probe ran on a copy. AUDIT-COMPILER found no such folder and nothing under `runs/` in `git status` at 13:50Z and could not settle it (`report.json`, `issues_for_orch`); **who wrote the folder and where is not established**. (2) A headless Chrome that RELEASE-VALIDATOR did not start (parent process 1, profile in another checker's scratch folder, started 13:17:02Z) was running while it ran its own browser probes (13:20-13:34Z), so the rule "one browser at a time" of the task was not kept for that window. (3) RELEASE-VALIDATOR started a third `npm run check` in the working tree at 13:28:56Z by mistake, inside another command, and stopped it and its children by their process numbers within about a minute; the working tree did not change.
- Почему это плохо: a probe that writes inside the project instead of a copy puts a file in the tree that another checker may read as a change of the work, and the check of "what the work changed" (a file list, a snapshot diff) then lies in either direction. A browser or a full check that belongs to someone else changes the timing under which tests and page probes are judged (whose failure it is is decided by a repeat, `docs/quality-bar.md` §6, item 4). Three such events in one run, with one of them unexplained, are a sign that nothing in the task fixed where each parallel checker may write and what it may run. AP-008 and AP-063 name the neighbouring faults (a parallel agent sees another's unfinished file; tests started in parallel with gates).
- Как правильно: (1) ORCH, when it starts several checkers of one audit at the same time, writes into each handoff the place where it may write (a copy outside the project in its own folder of the session scratch) and says in the task that the full check command and the browser are run by named roles in turn, not by everyone; (2) a checker that needs a probe that writes (`prepare-run`, a snapshot, a server) makes it on a copy and puts the command with the copy path in its evidence, so the compiler can see that nothing was written inside; (3) a checker that sees a process or a folder it did not start does not stop it or use it, writes the process number, the start time and the profile path in `result.issues`, and ORCH decides; (4) a command that starts a long run is typed on its own line, never inside another command. How it is checked: after the checkers end, `git status --short --ignored` in the working tree shows only the files named in the handoffs' `artifacts_out`, and `ps` shows no checker process left. Not proved: that the folder of event (1) was written by the probe; the lesson is the missing boundary, not the culprit.
- Где найдено: `handoffs/AUD-001-20261027-01/step-03f-release-validator.json` (issues I1, I2, I3); `step-03a-security-auditor.json`; `step-04-audit-compiler.json` (issue I1); `docs/audits/AUD-001/report.json` (`issues_for_orch`); AP-008, AP-063.

### AP-133 — A later requirement made the criterion text of an earlier done requirement false, and the earlier text was not amended in the same run

- Что случилось: criterion 1 of `REQ-061` (done) names the allowed schema line as «sai-picker-tenant/1 или sai-picker-tenant/2» and a file with `/3` as a wrong value. The requirement `REQ-069` (run `LOOK069-20261026-01`) made `sai-picker-tenant/3` a valid format on purpose (`decisions/0085`); the tests and the sample of the earlier requirement were re-pointed by the replacement table of the design, but the text of the criterion of `REQ-061` was not changed in that run. The audit `AUD-001` rechecked `REQ-061` and found criterion 1 not met as written (finding RV-B-061-1, High): the check the criterion names gives a result that the criterion does not describe. The same gap was already noted for the criterion 2 of `REQ-054` in the defect `ISS-0089`, item 18, and left open there as a text-only fix. RELEASE-VALIDATOR of the audit wrote that the same pattern may exist elsewhere (`step-03g-release-validator.json`, I1).
- Почему это плохо: a done requirement keeps its status while a criterion in it says a thing that is no longer true, and the status `done` then claims more than the code does; the next audit has to lower it to `in_progress` for a words-only reason. The test was changed by design, so the check was green and nobody was warned (Q14: bookkeeping follows the change in the same work).
- Как правильно: (1) when a design replaces or deletes a test of an earlier requirement by the table «было → стало», the table names for every such test the criterion of the earlier requirement that the test carries; (2) a criterion whose literal (a schema line, a name, a number) is changed by the new requirement is amended in the same run by a WF-01 micro-amendment (`decisions/0079`, item 5), with the "before" lines in `result.before_copy`, or the new requirement says in its description which earlier criterion it replaces and a defect is opened in the same run; (3) CODE-DESIGN-VALIDATOR checks that every row of the replacement table has this link. How it is checked: for the old literal of each replaced test, `grep -n '<old literal>' docs/requirements.yaml` finds no criterion that still states it as true. This is a proposal for the quality bar (the section «Proposal to raise the bar» of `step-03g`), not part of the minimum until the owner accepts it.
- Где найдено: `handoffs/AUD-001-20261027-01/step-03g-release-validator.json` (issue I1); `docs/audits/AUD-001/requirements/REQ-061.json`; `docs/audits/AUD-001/report.json` (finding RV-B-061-1); `docs/issues/ISS-0089-picker-look-format-followups.md` (item 18); `decisions/0085-picker-look-format-conventions.md`; AP-112.

### AP-134 — Gate and audit agents counted or read files outside the Sai folder, although Sai is self-sufficient and the task did not forbid it

- Что случилось: `CLAUDE.md` says that Sai is self-sufficient: everything an agent needs is in the files of its folder. In the run `ISS-0093-20261028-01` two agents went outside it, and the task of neither one said "work only inside the Sai folder and the scratch folder". (1) REQ-ANALYST (`step-02e-req-analyst.json`, issue I2) measured the cost of the closed refuse set on sketch rules over the files of a large web client tree found on the same computer (150 of 1164 files hit) and wrote the count next to the counts for Sai's own files. (2) REQ-VALIDATOR (`step-02f-req-validator.json`, issue I5) started a differential counting pass over a larger set of text files outside the repository, printed only counts, did not use it for a finding, deleted the output and disclosed it. Neither run changed a file outside Sai, and no finding rested on the second pass; the first count entered the reasoning of an open question to the owner.
- Почему это плохо: files outside Sai are not part of what the owner and the checkers can open again, so a number built from them cannot be repeated by the next checker (Q2, Q3) and does not belong in a requirement or a decision of Sai. It can also pull in content of another project that must not be read or copied here, and a read that was meant as "counts only" is still a read. The task text is the only place an agent learns the border: with no sentence about it, each agent decides for itself, and a careful one still crosses it.
- Как правильно: (1) every task and launch message for a gate, audit or analysis step says: "work only inside the Sai folder and the scratch folder"; ORCH puts the sentence into the handoff `task.description`, not only into the launch message; (2) a number that needs a bigger sample than Sai has is built from synthetic cases written in the scratch folder, or from the files of Sai itself, and is marked as a measure of that sample only; (3) an agent that notices it has read or counted outside the border stops that pass, deletes its output, writes it as an issue of kind PROCESS in its handoff (as the validator did) and does not use the number; (4) a number found this way that was already used is named in the next step as not repeatable and is not quoted as evidence. How it is checked: `grep -c "only inside the Sai folder" handoffs/<RUN-ID>/step-*.json` is not zero in every task of a gate or audit step of the run, and `result.issues` of the run holds no count that names a tree outside Sai.
- Где найдено: `handoffs/ISS-0093-20261028-01/step-02e-req-analyst.json` (issue I2), `handoffs/ISS-0093-20261028-01/step-02f-req-validator.json` (issue I5 and the summary line on the disclosure); the task of the records step named the analyst step as `step-02c`, the line is in `step-02e` (found by a search of all handoffs of the run; the task's number was wrong, the fact is the same); `CLAUDE.md` ("Sai is self-sufficient"); AP-132.

### AP-135 — ORCH accepted narrowings of what the old code protected (Q7) in a decision on its own word, where the quality bar says only the owner gives an exception

- Что случилось: `decisions/0102` item 15 accepts a list of narrowings of the secret detection for result files (public PEM blocks and a bare `-----BEGIN` line, short or digit-less unquoted values, quoted values with a space or a non-ASCII letter, placeholder words, and others) as "the detection design of REQ-102", on ORCH's own word with the sentence "the owner may cancel". The old rules hid these forms; the new ones do not refuse them. REQ-VALIDATOR saw it at the first gate that read the whole list (`step-02d-req-validator.json`, issue I1): the quality bar, section 1 item 3, says an exception is given only by the owner, in writing, with a reason and a time limit, and a message of another agent is not an exception. The same list had been asked about as an open question at `step-02b` (issue I1) and `step-02e` (issues I1, I2) and was answered by a decision of ORCH each time.
- Почему это плохо: whether a protection that existed (Q7, "secrets only by reference") may be made narrower is a question about the minimum of quality, and the bar says the minimum is not lowered by an agent. A decision of ORCH with "the owner may cancel" turns the owner's silence into consent and moves the burden to him; the narrowing then enters code and tests as if it were settled, and a later audit has to find out who allowed it.
- Как правильно: (1) a narrowing of what the old code or rule protected is the owner's question: ORCH puts it to the owner in plain words (what was hidden, what will not be, what is the risk) and records his answer in `decisions/` with his words, the reason and the limit; (2) a decision record for a choice that may touch an item of the bar names who may accept it; for a narrowing that is the owner, and the status of a record made by ORCH alone is "proposed" until he answers, so no step builds on it as settled; (3) a gate that finds a narrowing accepted by ORCH raises it in `result.issues` as a QUESTION to the owner (as the validator did) and does not give PASS on the strength of the record; (4) a choice that does not lower anything (a name, a threshold with no loss of protection) stays with ORCH. How it is checked: for every decision whose text contains "narrow" or "no longer" next to Q7 (a search of `decisions/`), the file names the owner's answer with its date, or the status line says "proposed".
- Где найдено: `handoffs/ISS-0093-20261028-01/step-02d-req-validator.json` (issue I1); `decisions/0102-core0-result-files-conventions.md` (item 15); `handoffs/ISS-0093-20261028-01/step-02b-req-validator.json` (issue I1), `step-02e-req-analyst.json` (issue I1); `docs/quality-bar.md` section 1 item 3; the form of an exception - `decisions/0103`, `decisions/0104`.

### AP-136 — Checkers ran forbidden git commands in their own copies and wrote files into the system temp folder, again, after AP-109 and AP-086

- Что случилось: in run `ISS-0093-20261028-01` four agents slipped in the same two ways, each time in a copy or a folder outside the project, so the project itself was not hurt. (1) TEST-DESIGNER (`step-08-test-designer.json`, issue I11) ran `git checkout -- <file>` once in a scratch clone to restore a stub, and made an empty file named `null` in the system temp folder by a stray redirect of the output of `eslint` (deleted at once). (2) TEST-DESIGN-VALIDATOR on the third launch of step 08n, which ran on another computer (as reported by the owner in the chat; the handoff `step-08n-test-design-validator.json`, `context.interruptions`, records the launch but none of these details, and that computer's files are not here), ran `git clone --no-checkout` and `git checkout` of the tag inside a fresh clone and wrote the output of `traces` into the system temp folder; both were deleted at once, and its handoff does not mention them. (3) TEST-DESIGN-VALIDATOR at step 08n, second launch (`step-08n-test-design-validator-run2.json`, issue I3): a shell command that began with a stray `cat > <file in the system temp folder>` waited for input and left an empty file there (deleted at once, the folder checked afterwards). The rules were in force each time: no `git checkout`, `reset`, `stash`, `clean` (AP-086, AP-109 - a ban worded for the project holds in copies as well) and temporary files only in the session scratch folder.
- Почему это плохо: a ban that is kept only inside the project is not a ban the next checker can rely on: the whole purpose of the rule is that a checker never has to think about which tree it is in. A file in the system temp folder is outside every list of what a run changed (`artifacts_out`, `git status`), so nobody can tell later whether it held a value that must not stay on a disk (Q7). A slip that is not written into the handoff of the agent is invisible to the next gate and surfaces only by luck (here: the owner's chat report).
- Как правильно: (1) ORCH puts one sentence into `task.description` of every checker step, not only into the launch message: «no `git checkout`, `reset`, `stash`, `clean`, no `git clone` that checks out a tree, in the project or in any copy; to get a tree at a tag use `git archive <tag> | tar -x -C <scratch folder>`; every file and every redirect goes into the session scratch folder, never into the system temp folder»; (2) a command that writes a file is typed with the full path in the scratch folder, never with a bare name or a stray `cat >`; (3) an agent that slipped writes it in `result.issues` with the kind PROCESS - what, where, when it was deleted, how it checked that nothing remained - even if the slip was undone at once; (4) ORCH, when the owner or a log tells it of a slip that is not in a handoff, records it in the `orch_note` of the next step. How it is checked: the task text of every checker step contains the sentence (`grep -c "git archive" handoffs/<RUN-ID>/step-*.json` is not zero for a checker step), and `ls` of the system temp folder after the checker ends shows no file with the name of the run or of a command of the checker.
- Где найдено: `handoffs/ISS-0093-20261028-01/step-08-test-designer.json` (I11), `step-08n-test-design-validator-run2.json` (I3), `step-08n-test-design-validator.json` (`context.interruptions`); `docs/program/public-v1/PROGRESS.md` (Open problems of 2026-10-28T19:20:00Z; the log lines of 2026-10-29T17:05:15Z and 18:37:35Z); AP-086, AP-109.
- Note of 2026-11-16 (run `E2E106-20261115-01`; `decisions/0112`, О23): the words of item (1) above — «no `git clone` that checks out a tree … use `git archive <tag> | tar -x -C <scratch folder>`» — are out of date and are read by `docs/workflows/handoffs.md`, «Common rules for all roles», item 3, which stands above this journal: copies, «before» copies and trials are made in a **fresh `git clone`** outside the project (`git clone -b <tag>` for a tag), never with `git archive` (it has no `.git` and no `handoffs/`, AP-074, AP-146); the ban of `git checkout`, `reset`, `stash` and `clean` in the project and in every copy stays. REVIEWER of the run followed the protocol and named the disagreement (`handoffs/E2E106-20261115-01/step-04-reviewer.json`, issue I5). The rest of this record stands.

### AP-137 — Stray background processes and a doubled test harness mixed the results of a gate and loaded the computer for hours

- Что случилось: four events in run `ISS-0093-20261028-01`, each found by ORCH or by the agent itself. (1) A backtick in ORCH's own task text for a shell command ran `node --test` over the whole tools suite in the background for about three minutes (PROGRESS log of 2026-10-28T20:56:00Z); ORCH stopped it by its exact process number and checked the project tree. (2) A stray `node timing.mjs` of an earlier agent of the session ran at 100 percent of a processor for about seven hours (PROGRESS log of 2026-10-28, step 08e) and was stopped by its exact process number. (3) At step 08p the TEST-DESIGN-VALIDATOR started its mutant harness through a chain with a shell background sign; the chain survived its tool call, a second chain was started, and two copies ran on one lane for about ten minutes with mixed results (`step-08p-test-design-validator.json`, issue I2). The agent killed both, compared the lane files with the originals, threw away every result of that period and ran all mutants again with a lock file in the harness. (4) Left alone and not ours, to be named to the owner: an old `node --test` and a picker `serve` process of three days from an earlier session.
- Почему это плохо: a test run is judged by its time and by its result; a second heavy process on the same machine changes both (the timing instrument of criterion 7 goes red at about twice the processor load, `step-08e-test-design-validator.json`, F3-F7), and two harnesses on one lane mix their results so that a survivor or a kill cannot be believed. A process left from an earlier session is a hidden load that nobody owns. The rule «one heavy process at a time» exists for this, and a command typed with a backtick, a `&` or a pipe chain breaks it without anyone choosing to.
- Как правильно: (1) a shell command is typed on its own line; a text with backticks is passed through a file or a quoted here-document, never inside double quotes; a long run is started with the tool's own background option, not with a shell `&`; (2) a harness that runs mutants takes a lock file first and refuses to start while the lock exists; (3) before and after a heavy step, `ps` for `node` and `chrome` processes is listed with start times in the handoff; a process not started by the agent is named (number, start time) and left alone, ORCH decides (AP-132); (4) when two copies of anything ran together, every result of that period is thrown away, as the validator did, not mixed into the report. How it is checked: the handoff of a checker lists the processes before and after; `ps` after the end of the step shows no process of the step.
- Где найдено: `docs/program/public-v1/PROGRESS.md` (log lines of 2026-10-28T20:56:00Z and 2026-10-28T23:47:52Z); `handoffs/ISS-0093-20261028-01/step-08p-test-design-validator.json` (I2), `step-08e-test-design-validator.json`; AP-132.

### AP-138 — The first plan of a launch on another computer assumed the tests were safe there, and the run gave a false picture

- Что случилось: step 08n of run `ISS-0093-20261028-01` was started a third time on a Windows computer (the owner's report in the chat; `step-08n-test-design-validator.json`, `context.interruptions`, third item). The plan of ORCH for that launch assumed the whole suite could be run there as it is on the main computer. It cannot: the tests use file modes and links (38 test files under `tools/test/` call `chmodSync` or `symlinkSync`) and one test fixes the null device as the path `/dev/null` (`tools/test/flaky-regression.test.js`; `tools/test/repo.test.js` uses `GIT_CONFIG_GLOBAL=os.devNull`), and nothing in `tools/src` or `tools/test` handles the platform. So part of the tests is red there only because of that system, and the validator stopped without a verdict. The pass was not counted and the limit of the owner's extra pass was not spent; the owner decided to run the step again on the main computer. No document of Sai says that the full check runs on the main computer and on GitHub (Linux) only.
- Почему это плохо: a red test on the wrong system looks like a defect of the work; a green gate on it would have proved nothing about the tests designed for the other system. A step lost a whole launch, and the cost is the owner's time. The limit exists only in the heads of those who have seen it, so the next plan will assume the same.
- Как правильно: (1) the full check is run on the main computer or on GitHub (Linux, Node 22), the two places where it has been green; (2) before a step is moved to another computer, ORCH names what the step needs from the system (file modes, links, the null device, ports, the line ends of the files) and whether that system has it; if the step needs the full suite and the system cannot run it, the step stays where it can run; (3) the limit is written in the README, section «Проверка» of `tools/README.md`, so that the plan does not have to be remembered (this record does not write it there: `tools/README.md` was outside the write set of the step, and the open item is in `ISS-0099`, item 3); (4) a launch that ended on the other system is recorded as «not counted» in `context.interruptions`, as ORCH did. How it is checked: `grep -n "Windows" tools/README.md` finds the sentence after ISS-0099 is closed; `grep -lE "chmodSync|symlinkSync" tools/test/*.js | wc -l` gives the number of test files that depend on the system (38 on 2026-10-30).
- Где найдено: `handoffs/ISS-0093-20261028-01/step-08n-test-design-validator.json` (`context.interruptions`); `docs/program/public-v1/PROGRESS.md` (log line of 2026-10-29T17:04:38Z); `tools/test/flaky-regression.test.js`, `tools/test/repo.test.js`; `docs/issues/ISS-0099-check-suite-time-and-where-it-runs.md`; the account of ORCH in `handoffs/ISS-0093-20261028-01/step-11-doc-updater.json` (task, item 4 e).

### AP-139 — ORCH told the owner a fact about the repository from an old decision, where a later decision and GitHub said the opposite

- Что случилось: when the full check of run `ISS-0093-20261028-01` was run on GitHub on a temporary branch (step 09), ORCH read `decisions/0048-owner-delegates-open-points-repo-public.md` («the repository is public on purpose») and told the owner in the chat that the temporary branch with the snapshot of the work would be public. The later `decisions/0062-repo-private-by-owner.md` («Уточняет 0048») records that the repository was closed by the owner on purpose on 2026-10-17, and GitHub says `PRIVATE`; the run log of ORCH states the correct fact afterwards (`PROGRESS.md`, line of 2026-10-29T23:00:54Z: «the repository is private»). The wrong sentence was said in the chat and is in no file; ORCH's own account of this slip is the task of the bookkeeping step (`step-11-doc-updater.json`).
- Почему это плохо: the visibility of the repository decides whether a snapshot of the work can be seen by anyone, and the owner decides what to allow knowing it (a push to `main` is done after his word, `decisions/0048`). A decision file keeps its old text when a later one narrows it; reading one file of a chain gives the state of the first day. The decision `0048` keeps the word «public» in its name and text, and `0062` is the only place that says it changed.
- Как правильно: (1) a fact about the repository that the owner will act on (visibility, branch protection, who has access, the minutes of the check) is read from GitHub at the moment of saying it, `gh repo view --json visibility,isPrivate`, and the command and its output stand in the message or the handoff (AP-018, AP-080); (2) a decision is read together with every later record that names it: `grep -ln "0048" decisions/*.md` lists them, and the newest one wins; (3) when a line of an old record is wrong now, the later record says so (as 0062 does), and the old record is not rewritten. How it is checked: any sentence to the owner about the visibility of the repository is followed by the output of the command above.
- Где найдено: `decisions/0048-owner-delegates-open-points-repo-public.md`, `decisions/0062-repo-private-by-owner.md`; `docs/program/public-v1/PROGRESS.md` (log line of 2026-10-29T23:00:54Z); `docs/design/REQ-030-github-check.md`; AP-018, AP-080.

### AP-140 — A mutation harness for a test file that starts a real browser took four minutes per mutant and left browsers behind when it killed a timed-out test process

- Что случилось: in run `E2E104-20261103-01` the kit tests (`tools/test/e2e-kit.test.js`) use a stand-in program instead of Chrome. Two mutants of the design list (M02, M70: the kit ignores the stand-in and starts the real Chrome) made every one of 50 tests start a real browser; one such mutant took about four minutes. When the harness ended a test process on its time limit, the browsers that process had started were not stopped: Chrome sits in its own process group, so a kill of the test process does not reach it. TEST-DESIGNER (`step-05-test-designer.json`, issue I6, items 1 and 2) and TEST-DESIGN-VALIDATOR (`step-05b-test-design-validator.json`, issue I3: the mutant K2 left an orphan stand-in and took 1116 s to end; four more mutants ran past the limit of the harness) both met it. No leftover was in the project; the leftovers were processes and temporary folders.
- Почему это плохо: a mutant that cannot fail fast costs minutes of a checker's time and a leftover browser takes memory of the owner's computer until someone finds it; with several mutants in a row the load changes the timing of the next ones (AP-137). A harness that kills only the test process reports "red by timeout" and moves on, so the cost is invisible in the verdict.
- Как правильно: (1) the harness gives each mutant of a browser test its own short limit (a tenth of the whole file is enough) and counts a limit hit as "caught by timeout", not as a normal red; (2) after a mutant the harness stops what the test process started: by the private temporary folder named in the command line of the browser (`sai-e2e-profile-…`) and by the process group, using the process numbers it recorded, never a name pattern (AP-119); (3) a mutant that turns a stand-in into the real thing is run last, once, and `pgrep -f sai-e2e-` and the list of `sai-e2e-*` folders are read after it; (4) the design list names such a mutant and the expected cost. How it is checked: after the series of mutants `pgrep -f sai-e2e- | wc -l` gives 0 and `ls "$(node -p "require('os').tmpdir()")" | grep -c '^sai-e2e-'` gives 0.
- Где найдено: `handoffs/E2E104-20261103-01/step-05-test-designer.json` (I6); `handoffs/E2E104-20261103-01/step-05b-test-design-validator.json` (summary, `mutants`, I3); `handoffs/E2E104-20261103-01/step-09-release-validator.json` (`self_check`, «LEFTOVERS»: after the mutant N10 two spec processes of the mutant and their children stayed and were stopped by process number); `docs/design/REQ-104-e2e-chrome-kit.md`, section 16 (M02, M70); AP-119, AP-137.

### AP-141 — The snapshot commit for a check on GitHub held the validator's own unfinished handoff, and the first run went red at the check of the records

- Что случилось: RELEASE-VALIDATOR of run `E2E104-20261103-01` built a snapshot of the working tree on a temporary branch (decisions/0107) and pushed it. The snapshot held its own handoff `step-09-release-validator.json` with `status: PENDING`; the check `handoffs-check` refuses a handoff that is not finished in a commit (rule H4) and run 41677599441 failed at that step after 53 s with `step-09-release-validator.json:9 — H4: status: PENDING в коммите`. The validator deleted the branch, rebuilt the snapshot without its own handoff and got a green run (836 s). The precedent `handoffs/ISS-0093-20261028-01/step-10-release-validator.json` had excluded its own handoff, but the task text of this run did not say so.
- Почему это плохо: one run of the check on GitHub costs 14 minutes of runner time when it gets to the end, and a red run for a cause that is not in the work looks like a defect of the work to anyone who reads only the conclusion. The temporary branch is pushed to the owner's repository with the owner's permission; every extra push is an extra use of it.
- Как правильно: (1) the task of a step that builds a snapshot says in one sentence: «the snapshot leaves out the handoff of this step and every handoff whose status is not COMPLETED or FAILED»; (2) before the push the validator runs `cd tools && npm run -s handoffs-check` on the tree of the snapshot (a copy outside the project made with `git archive` of the snapshot commit) and pushes only when it is clean; (3) the list of the files that were left out is written in `self_check`. How it is checked: the tree of the snapshot has no file under `handoffs/<RUN-ID>/` whose `status` is `PENDING` or `IN_PROGRESS` (`git ls-tree -r --name-only <sha> handoffs/<RUN-ID>/` against the statuses).
- Где найдено: `handoffs/E2E104-20261103-01/step-09-release-validator.json` (`self_check`, «GITHUB, first try»; issues I1 and I5); `handoffs/ISS-0093-20261028-01/step-10-release-validator.json` (the precedent); `tools/src/handoffs/rules.js` (rule H4).

### AP-142 — The first test gate failed because two behaviours of the runner that a person depends on were not pinned by any test: the stop of a hung command and the exit code of a spec

- Что случилось: the TEST-DESIGN-VALIDATOR at step 05b of run `E2E104-20261103-01` applied 82 mutants of its own and 9 survived; two of them were not equivalent. R14: the runner (`tools/test/e2e/kit/runner.js`) no longer checks the exit code of a spec file; a spec that prints a passing TAP summary and then exits non-zero would pass, and no fixture did that. R15: the timer that ends a hung file (120 s) was not cleared after a file ended, so `npm run e2e` would linger up to 120 s after printing its record line while `duration_ms` stayed small. The gate said FAIL (`step-05b-test-design-validator.json`, T1 Medium, T2 Low, with T3 and T4); TEST-FIXER added the tests at step 05c (`E2K-46`, the `exit-one` case of `E2K-32`, a negative row in `E2K-44`), and the repeat gate at step 05d passed. The code had no fault; the tests did not say what the code must keep doing.
- Почему это плохо: the runner's rules about time and exit codes are exactly what keeps `npm run check` honest: a command that passes with a silent non-zero exit or hangs for two minutes after a green result is a failure of the single check command (Q4, Q6). Both were listed in the design (section 6) as words, and a behaviour that is only in the words of the design is not pinned (Q5). Cost: one rework step and one repeat gate.
- Как правильно: (1) in the design of a runner or any code that starts a process, the "criterion → test" table has a row for each of: the exit code of the child on its own (a child with a good report and a bad exit), a timer or other armed handle left behind (a child process that must end by itself within a short time after its last line), the stop of a hung child; (2) TEST-DESIGNER checks the table of mutants for each of the three kinds before the gate; (3) a row that tests the end of a process runs a real child process (a test that only calls the function in-process cannot see an armed timer). How it is checked: for the runner, a mutant that removes the exit-code check and a mutant that removes the clearing of the timer each turn a named test red (`E2K-32` exit-one, `E2K-46`).
- Где найдено: `handoffs/E2E104-20261103-01/step-05b-test-design-validator.json` (verdict FAIL; findings T1, T2, T3, T4; survivors R14, R15, K10); `handoffs/E2E104-20261103-01/step-05c-test-fixer.json`; `handoffs/E2E104-20261103-01/step-05d-test-design-validator.json` (PASS); `docs/design/REQ-104-e2e-chrome-kit.md`, section 6.

### AP-143 — The counts in a design document fell behind the tests the same run built: 53 tests in the text, 63 in the files

- Что случилось: the design of REQ-104 states in its summary (section 0) and in the table of files (section 3) that the work has 53 tests (40 `E2K-…`, 13 `SMK-…`), 9 spec fixtures and "forty tests" in section 11.1. The built files have 50 `E2K-…` tests (ten more than the design: E2K-19, 26–29 and 42–46, added by TEST-DESIGNER and TEST-FIXER as the earlier reviews and gates asked), 13 `SMK-…` tests, so 63 in all, and 10 spec fixtures (`exit-one.e2e.js` was added at step 05c). The TEST-FIXER noted at step 05c that the text said 49 tests and 9 files and that the design was outside its write set; RELEASE-VALIDATOR listed the stale numbers at step 09 (I3); DOC-UPDATER carries them at step 10. The first number a reader meets in the design summary was wrong as soon as the first tests were added.
- Почему это плохо: a count in a design is the first thing a later checker uses to see whether a test was lost (AP-112, AP-113); a stale number either hides a lost test or sends the checker to look for one that was never planned. The design is not in the write set of the roles who change the count, so each of them noticed it and none could write it.
- Как правильно: (1) a count that is derived from files (tests, fixtures, mutants) is not written into a design text by hand where a command gives it; if it is written, the design names the command next to the number (`grep -c '^test(' tools/test/e2e-kit.test.js`); (2) the role that adds or removes a test or a fixture (TEST-DESIGNER, TEST-FIXER) names the new count in its handoff `result.issues` with that command, as the TEST-FIXER did; (3) ORCH puts the design file in the write set of DOC-UPDATER at step 10 and the task lists the numbers to carry; (4) the bookkeeping step does not rewrite the design, it changes the numbers and adds an "As built" section with the differences. How it is checked: `grep -c '^test($' tools/test/e2e-kit.test.js` (50) against the number in section 0 of the design after step 10.
- Где найдено: `docs/design/REQ-104-e2e-chrome-kit.md` (sections 0, 3, 11.1, 11.3 before step 10); `handoffs/E2E104-20261103-01/step-05c-test-fixer.json` (issue on counts); `handoffs/E2E104-20261103-01/step-09-release-validator.json` (I3); AP-112, AP-113.

### AP-144 — A timing fact taken on one machine (a killed process is reaped in about 2 ms) was written as a fact of all machines; the test passed on every validator run and failed on GitHub

- Что случилось: the kit tests of REQ-104 (`E2K-18`, `E2K-38`) end a stand-in browser with `SIGKILL` and, right after the end of the child that watched it, check once that the pid and the process group are gone. The design said «`SIGKILL` of the group is instant» (fact F20, measured on the developer computer, where the system reaps a killed process in about 2 ms). On the GitHub runner the killed process was seen once before it was reaped (a zombie answers `kill(pid, 0)`), and `E2K-18` failed: check.yml run 41685488320 on `main`, 2184 of 2185. Every earlier check of the run was on one machine: the tests passed on every validator run and on the developer computer (the series of the gates of the run `E2E104-20261103-01` were run there), and the first release was pushed to `main` after one green sample from a temporary branch (run 41678354227). Repairing it cost a whole WF-03 run (`ISS-0103-20261103-01`, ten steps). The Linux fact «zombie, or just slow» was never measured on the runner (no docker here) and is still not measured.
- Почему это плохо: a green series on one machine proves the timing of that machine; the other machine decides at the push, on `main`, in front of everyone. A single green run on a temporary branch is one sample of a race, not a proof that it cannot happen (the same shape as AP-100: one moment measured, taken as the rule; and AP-012: an unchecked fact written into a design that the later steps trusted). The design text «instant» made the single immediate check look right to the designer, the validators and the reviewers alike.
- Как правильно: (1) after a kill, a test waits with a limit for `ESRCH` of the pid and of its group (the helper `waitGone` of `tools/test/e2e-kit.test.js`, 5000 ms), never one immediate check; (2) a timing fact about an operating system is written with the machine it was measured on and is not called «instant» or «always»; a fact about Linux is taken from the runner (a step of the check that prints the state, or a measured run on GitHub), not from the macOS computer; (3) a race that depends on the timing of the system gets a test that holds the state on purpose (a killed process kept unreaped by its parent), so that the old check fails without luck (`E2K-62`), and a guard of the call sites (`E2K-63`); (4) the validator's series for a test that touches processes is run under load and the report says it was one machine; one green GitHub run is named as one sample. How it is checked: `grep -n "pidGone(\|groupGone(" tools/test/e2e-kit.test.js` shows no single check of a killed process outside `waitGone`, `until(...)` or the awaited close of the kit; `E2K-62` goes red when `waitGone` is replaced by the single check.
- Где найдено: `docs/issues/ISS-0103-e2e-kit-e2k18-stand-in-alive-on-github-main-red.md`; `docs/design/REQ-104-e2e-chrome-kit.md` (fact F20, corrected at step 10 of `ISS-0103-20261103-01`); `handoffs/ISS-0103-20261103-01/step-09-release-validator.json` (`self_check`, R and G; issues V1); `handoffs/E2E104-20261103-01/step-11-release-finalizer.json`; `decisions/0108`, Addendum 2026-11-03 (ISS-0103); AP-012, AP-100.

### AP-145 — A leak check between two tenants was made stronger at five gates and edits in a row, each time by one more place it did not read or one exception wider than its reason

- Что случилось: the test `isolation` of `tools/test/e2e/picker.e2e.js` (criterion 6 of REQ-105, run `E2E105-20261105-01`) checks that the page and the answers of tenant B hold nothing of tenant A. Every pass of the test gate and the edit after it found one more hole of one kind: (1) step 05b, FAIL (F1 High, F2 Medium; mutants W01, W02): the set of A's texts was built against B's answer of the server under test, so a leaked text left the set and hid itself, and a comparison by whole values missed a text of A inside a string of B; (2) step 05d, FAIL (F4; N05, N09): the exception «a one-word text is compared with whole values» was given to every one-word text, not to the two words it was measured for, and hid A's own name inside B's strings; (3) step 05f, PASS with F6 (G01, G02, G08; G05, G06 by the reading of `decisions/0109`, О19): no check read the object keys of the answers, and B's page was read on its card only; (4) the edit of step 05g (re-run 2): its first form compared an exception word with whole texts only (A2d, A2f), read four attributes of the page (A15, A16) and the page's own network records only, so a worker or a service worker of the page asked A's data unseen (A8, A14, A17) and a shared path could bring A's data (A18); (5) step 05h, PASS with F7–F9: the search of the bodies skipped a whole address prefix for the sake of two records (H1, H1b), the service-worker control was read once at the end and missed a worker that removes itself before it (H3), and the word rule read single text nodes, not the text the visitor reads (H4). The gate reached its limit of three passes (`decisions/0079`, item 4); the last shapes went to defects (`ISS-0105`, `ISS-0106`) instead of into the test.
- Почему это плохо: every round cost a full gate with its mutant series (78, 32, 27 and 57 mutants) and a rework or an edit of an already checked file; a leak check that its author bounds by what came to mind is found one hole at a time by the gate, and the run ends with known gaps on record instead of a closed test. The lessons of each round were in `result.issues` (I2 of 05b, I3 of 05d, I5 of 05e, I5 of 05f, I8 of 05g re-run 2, I6 of 05h) and the next round still met a new place of the same kind.
- Как правильно: (1) before the first gate the author of a leak check lists every place a leak can take — the values and the keys of each answer at any depth, every screen the test shows, the title, every attribute, the address, the requests of the page and of its workers, what each shared path brings, the stored values, what the page sends — and reads each or writes why not, with a mutant for each place; (2) the oracle of a leak is never built from the output under test (B's tenant file, not B's answer), and a list of the leaks looked for is completed by the complement oracle «B's answers hold B's own data only»; (3) an exception is computed from its measured reason and pinned with it (the word «человек» only inside «Есть отдельный человек»; the two checked records skipped by request id, not by an address prefix), and the test asserts the exception list equal to the measured one, so it cannot grow silently; (4) a control is read when the thing it controls can happen, not once at the end (a service worker can unregister itself before it), and a rule about where a word stands reads the text as the visitor reads it (an element with the texts of its children), not the nodes as the page built them; (5) the author applies its own leak mutants to these places before handing over. How it is checked: the row «criterion → test» of a leak criterion in the design names the places and the mutant of each, and the gate's own mutants around the criterion are red.
- Где найдено: `handoffs/E2E105-20261105-01/step-05b-test-design-validator.json` (F1, F2, I2), `step-05d-test-design-validator.json` (F4, I3), `step-05e-test-fixer.json` (I5), `step-05f-test-design-validator.json` (F6, I1, I5), `step-05g-test-fixer-run2.json` (I8), `step-05h-test-design-validator.json` (F7–F9, I6), `step-09-release-validator.json` (I4); `decisions/0109`, О17–О23; `docs/issues/ISS-0105-e2e-kit-late-page-text-and-worker-network.md`, `docs/issues/ISS-0106-picker-isolation-test-gaps.md`; AP-126.

### AP-146 — A copy made with `git archive` cannot run `handoffs-check` or `traces`, which AP-141 (item 2) asks to run on it: both commands need git

- Что случилось: AP-141, item 2, says: before the push of a snapshot run `cd tools && npm run -s handoffs-check` on the tree of the snapshot, «a copy outside the project made with `git archive` of the snapshot commit». TEST-RUNNER of run `E2E105-20261105-01` (step 06) did so: both `handoffs-check` and `traces` list the files through git and ended with exit 2 `E_TRACE_NOT_GIT` on the plain archive copy. It gave the copy its own git metadata without a checkout — `git init`, the object store of the project as an alternate, `git update-ref` of the branch to the snapshot, `git read-tree` of the snapshot — so that `HEAD` is the snapshot and rule H4 judges the handoffs as committed, as on the runner; both commands were then clean. RELEASE-VALIDATOR (step 09) checked its own snapshot the same way.
- Почему это плохо: a check that the journal asks for and that cannot be run as written is skipped or bent each time someone meets it; a copy whose `HEAD` is not the snapshot sees every handoff as «not in a commit» and lets a `PENDING` one pass H4 — the very mistake AP-141 is about.
- Как правильно: (1) the tree of a snapshot is checked in a copy whose `HEAD` is the snapshot: `git archive <sha> | tar -x -C <copy>`, then in the copy `git init`, the object store of the project as an alternate (`.git/objects/info/alternates` of the copy), `git update-ref refs/heads/main <sha>` and `git read-tree <sha>`; `git status --short` of the copy is empty before the checks; (2) from the copy's `tools/`, `node src/handoffs/cli.js` and `node src/traces/cli.js` both end with code 0 before the push; (3) no `checkout`, `reset`, `stash` or `clean` is used for it (AP-086, AP-109); (4) the task of a snapshot step names this way in one sentence. This record extends AP-141, item 2; AP-141 is not rewritten. How it is checked: the `self_check` of the step shows `git status --short` of the copy empty, its `HEAD` equal to the snapshot, and both commands with code 0.
- Где найдено: `handoffs/E2E105-20261105-01/step-06-test-runner.json` (issue I1, `self_check`); `handoffs/E2E105-20261105-01/step-09-release-validator.json` (`self_check` «SNAPSHOT TREE CHECKED BEFORE THE PUSH»); AP-141.

### AP-147 — In zsh `"$SHA:refs/heads/…"` is not the text it looks like: `:r` right after a variable is a modifier, and git refused the push

- Что случилось: TEST-RUNNER of run `E2E105-20261105-01` (step 06) pushed its snapshot from zsh with the refspec written as a variable, a colon and `refs/heads/ci/…` in double quotes. zsh reads `:r` right after a variable as a modifier (the root of a file name), so the text after the variable was no longer `:refs/heads/…`, and git refused it: `src refspec … does not match any`. Nothing reached GitHub (`git ls-remote` right after: only `main`). The second try with the variable in braces, `"${SHA}:refs/heads/…"`, worked; RELEASE-VALIDATOR (step 09) wrote it with braces from the start.
- Почему это плохо: the same text works in bash, so a command copied from a note or from another role fails in the shell of this computer; a push that fails this way costs a try, and with another tail the text could name a ref nobody meant.
- Как правильно: (1) a variable followed by a colon and text (a refspec `<sha>:<ref>`, `<host>:<path>`) is written with the variable in braces: `"${SHA}:refs/heads/<branch>"`; (2) after a push, `git ls-remote origin` shows that exactly the intended ref exists, at the intended commit. How it is checked: the push commands in the `self_check` of a step use `${…}` before a colon; `git ls-remote origin` follows each push.
- Где найдено: `handoffs/E2E105-20261105-01/step-06-test-runner.json` (issue I2, `self_check`); `handoffs/E2E105-20261105-01/step-09-release-validator.json` (`self_check` «PUSH»).

### AP-148 — The visibility of the repository on GitHub differed from the recorded decision, and a task passed the old fact to a checker: the shape of AP-102 and AP-139 again

- Что случилось: `decisions/0062` (2026-10-17) recorded Sai's repository as closed by the owner on purpose, and `STATE.md`, `CLAUDE.md` and the root `README.md` said so. The task of RELEASE-VALIDATOR of run `E2E105-20261105-01` (step 09) called it «the owner's private repository». The validator read GitHub before its push, as its role file asks (AP-102, AP-139): `gh repo view --json visibility,isPrivate` → `PUBLIC`, `isPrivate` false, `updatedAt` 2026-11-05T19:16:51Z (read 2026-11-15T14:56:29Z). When and by whom the visibility changed is not written in any Sai file. TEST-RUNNER of the same run (step 06) had pushed its temporary branch earlier the same day with no reading of the visibility in its report. ORCH confirmed the reading and asked the owner before the push to `main`; the owner answered «Да, открыл специально» (2026-11-15), recorded as `decisions/0111`, which replaces the part of `0062` about a closed repository. The pushed snapshots held no secret shape and no path of this computer (search 0, `traces` 0).
- Почему это плохо: the records said «closed» while everything pushed was readable by anyone; a step that pushes acts on the visibility, a task that repeats a recorded setting passes the old fact to the checker, and the reading caught it only because one role file asks for it. The same setting was wrong in the records twice before (AP-102: open, then closed; AP-139: an old decision quoted).
- Как правильно: (1) every step that pushes to GitHub (a temporary `ci/*` branch or `main`) reads the visibility right before the push and writes the command, its output and the time into `self_check` — TEST-RUNNER as well as RELEASE-VALIDATOR and RELEASE-FINALIZER; (2) ORCH does not write a GitHub setting into a task as a fact; it writes «read the visibility before the push»; (3) when the reading differs from the record, the step writes a `DISCREPANCY` and ORCH asks the owner before the next push to `main`; the answer becomes a decision that names the one it replaces, and the documents that state the setting get a dated correction (AP-102, item 3). How it is checked: in the `self_check` of every push step of a run the line of `gh repo view --json visibility,isPrivate`, with its time, stands before the line of the push.
- Где найдено: `handoffs/E2E105-20261105-01/step-09-release-validator.json` (issue I1, `self_check` «GITHUB SETTING READ BEFORE THE PUSH», `context.orch_check`); `handoffs/E2E105-20261105-01/step-06-test-runner.json` (no reading of the visibility); `decisions/0062`, `decisions/0111`; AP-102, AP-139.

### AP-149 — The notes of a paused step lay only in the system temporary folder; its clean-up removed them before the run resumed, and only the handoff kept the facts

- Что случилось: the owner paused the work on 2026-11-09 («Приостанови работу и зафиксируйся») in the middle of step 05g of run `E2E105-20261105-01`. TEST-FIXER stopped at a safe point. ORCH wrote the state at the pause into `context.interruptions` of the handoff (the hash of the edited `picker.e2e.js`, what was done and what was not) and pointed to the progress note with the remaining steps and the helper files, which lay only in `<scratch>/e2e105z/`. When the run resumed on 2026-11-15 those folders were empty (removed by the system clean-up of the temporary folder; empty since 2026-11-14), and the launch could not be continued: it lived in an earlier ORCH session, and `context.agent_run_id` had never been written. ORCH closed 05g `FAILED` with `not_agent_attested` and started `step-05g-test-fixer-run2.json`. The new launch rebuilt its start file by reversing its own edits, and the file the gate had passed at step 05f (`e87fc3ee…`) was kept nowhere (no commit, no object, no copy), so neither 05g re-run 2 nor 05h could compare with it and both read the whole file again. What survived came from the handoff: the hash at the pause and the list of what was not done.
- Почему это плохо: a pause of the owner can last days, and the system temporary folder is cleaned on its own schedule; a note kept only there is lost with it, and the resumed step works from guesses or redoes the work. A state that a gate passed and that is kept nowhere cannot be compared with later, so the next gate re-reads everything.
- Как правильно: (1) at a pause, everything needed to resume — the state, the hashes, the remaining steps, the commands — goes into the handoff (`context.interruptions[].state_at_pause`, written by ORCH) or into the agent's own `result` (an `IN_PROGRESS` result is allowed while the file is not in a commit); a note in `<scratch>` may be a copy, never the only record; (2) a file state that a gate passed and that a later step will compare with is named in the handoff by its hash and kept outside the system temporary folder, for example as a snapshot commit in the object store named in the handoff (made through a temporary index with no branch, as steps 06 and 09 made theirs); (3) ORCH writes `context.agent_run_id` right after each launch (`docs/workflows/handoffs.md`, section «context»), so that a pause can be resumed by the same agent where the session allows. How it is checked: after a pause, `context.interruptions[-1].state_at_pause` holds every fact the resumed step needs, and the resumed step needs nothing from `<scratch>`.
- Где найдено: `handoffs/E2E105-20261105-01/step-05g-test-fixer.json` (`context.interruptions`, `not_agent_attested`); `handoffs/E2E105-20261105-01/step-05g-test-fixer-run2.json` (issue I6); `handoffs/E2E105-20261105-01/step-05h-test-design-validator.json` (`summary.change_since_pass_3`); AP-097.

### AP-150 — A prototype of a design and its own mutant ran the real hook of Pixel Office on the owner's real state folder, though the task forbade it: a refusal case that named the real folder had no spawn that throws

- Что случилось: in run `E2E106-20261115-01` (REQ-106, step 01) the prototype of the spec held a refusal case of the hook helper, `runHook(start("x", …), { office: <the real state folder>, home: <the temporary root> })`, with no injected spawn, against the design's own words («its injected spawn not called»). The designer's mutant R02 removed the two folder checks of `runHook`, and the harness ran `isolated start` once (about 2026-11-15T18:35Z): `/bin/sh src/pixel-office/hook.sh` ran with `SAI_PIXEL_OFFICE_DIR` = the owner's real state folder, read the real `node-path`, `write-secret` and `port`, signed an invented `SubagentStart` and posted it to `127.0.0.1:4780`. The connection was refused only because no Pixel Office of the owner was running; the five real files stayed the same by sha256, size and time. The design said R2 held «by construction», and step 01 reported that every hook of every trial had its folders under the temporary root. The series rule of the design covered product mutants that write into a home and starter mutants with the stand-in, but not the mutants of the spec's own checks. CODE-DESIGN-VALIDATOR found it (step 01b, F1 High, issue I1), and the designer described it in full (step 01c, issues I1, I2; design F31, F32).
- Почему это плохо: a refusal case is correct only while the check it tests holds; with a real spawn, a regression or a mutant that removes the check turns the test into a start of Pixel Office or its hook on the owner's folder. With the owner's server running, the invented event would have been signed with the real secret and appended to his journal — exactly what R2 forbids («Pixel Office shows only the truth»). The breach was invisible to the author's own report and was found only by the next gate.
- Как правильно: (1) rule R2-S (design `docs/design/REQ-106-e2e-pixel-office.md`, section 6): every call that is given the person's home folder or the real state folder — a refusal case of a starter or a helper, a developer's own check, a prototype, every mutant of the check it tests — passes a spawn that records its arguments and throws, never the real spawn and never a counting wrapper of it; a test that needs a real process gives it only folders of the test; (2) a mutant that removes or weakens such a check runs only after a search of the copy shows that every call naming a real folder has that spawn (the gates of the run did it before every mutant: «the seams held in 41 of 41 copies»), and the mutant «the throwing spawn replaced by the real one» is kept on record and never applied; (3) a prototype follows the safety words of its design as strictly as the built file, and a report never says «every trial» without a search that shows it; (4) the real state folder is measured by hash, size and time before and after every series. A mechanical net (a preload that refuses any process start naming the real folders) is a raise of the bar and waits for the owner (`decisions/0112`, О19). How it is checked: before a mutant run of a check of rule P or of the hook helper, a search of the copy for each refusal call shows `spawn: throwingSpawn` (or its equal); the five real files are the same before and after.
- Где найдено: `handoffs/E2E106-20261115-01/step-01b-code-design-validator.json` (F1, issue I1), `step-01c-code-designer.json` (issues I1, I2), `step-01d-code-design-validator.json` (issue I3); `docs/design/REQ-106-e2e-pixel-office.md` (F29, F31, F32, section 6 rule R2-S, section 16 «R2 rule for every series», R09); `decisions/0112`, О19; quality-bar R2.

### AP-151 — An import of a program file to count its modes ran the program with the environment of the shell

- Что случилось: BACKEND-DEV of run `E2E106-20261115-01` (step 02, issue I8) counted the modes of the stand-in with `node -e` and an `import` of `tools/test/fixtures/e2e-stand/fake-stand.js`. An import runs the module: the stand-in started (2026-11-15T20:35:50Z) in its default mode with the environment of the shell — no log variable, no tripwire, `HOME` the person's home folder — listened on `127.0.0.1` and printed its link. Its default mode reads and writes nothing, and the developer stopped it by its pid; the home folder held no entry of it, the five real files were unchanged. The same kind of import of Pixel Office or its hook would run them with the real home folder and so with the real state folder.
- Почему это плохо: a «read-only» count became a start of a server outside every rule of the run (no private home, no checked folder, no throwing spawn); a program of Sai that resolves its folder from `HOME` reaches the owner's real files this way, and nothing in the command looks dangerous.
- Как правильно: a count, a check or a search of a program file reads it as text (`grep`, `sed`, `cat`, `wc`), never imports or requires it; a test or a harness imports a program module only when that is the test's purpose and only with the folders of the test; a report says «no program file was imported to read it» (every later step of the run did). How it is checked: the `self_check` of a step that counts or reads program files shows text commands only; no `node -e` with an `import` of a file under `tools/src` or of a stand-in.
- Где найдено: `handoffs/E2E106-20261115-01/step-02-backend-dev.json` (issue I8); the later steps' R2 notes (`step-05-test-designer.json` I7, `step-05b-test-design-validator.json` I5, `step-09-release-validator.json`, quality bar R2); AP-150.

### AP-152 — A red assertion that compares a whole environment prints every variable of the test process with its value into a log that, in an open repository, anyone can read

- Что случилось: in run `E2E106-20261115-01` the spec `pixel-office.e2e.js` checked the environment of the recorded hook call with `assert.deepEqual(options.env, { PATH, SAI_PIXEL_OFFICE_DIR, HOME })`. Under the gate's mutant R01 (the hook gets the whole environment) the red output held all 52 variables of the test process with their values, one of them a token of the session (TEST-DESIGN-VALIDATOR, step 05b, F3 and issue I4; the file deleted at once). The same shape stood in `E2S-05` and `E2K-37` (step 05c, issue I1). The fixes went one hole at a time: `assert.deepEqual(Object.keys(…).sort(), […])` would print the other names (step 05c, issue I2); a list of names by `Object.keys` misses the names that a prototype environment hands to `spawn` (probe SP1, step 05d, issue I1); `for…in` lists a shadowed name twice (step 05e, issue I1); and the later comparison of the two folder values with `assert.equal` still printed the value of `HOME` under the mutant A11 (step 05f, G1, left for `docs/issues/ISS-0111`). The checkers who looked for leaked values in their red outputs met a second trap: RELEASE-VALIDATOR's filter (step 09) deleted all 13 red outputs, because the path of the scratch folder, where the copies lie, holds the session id; with that path replaced by `<scratch>` first, no other value was found.
- Почему это плохо: Q7 says a secret does not go into logs; the GitHub logs of the open repository (`decisions/0111`) are read by anyone, and a red run on the runner would publish the runner's environment, locally the developer's. A filter that matches every output because of a known path finds nothing real and can delete the evidence.
- Как правильно: (1) an environment (or any object that may hold values of the process) is compared in two steps: first its shape — a plain prototype, no symbol keys, the names as `spawn` sees them (`for…in`, inherited ones included), the expected names listed and every other name only counted — then each expected value on its own by `assert.ok(actual === expected, "<what>")`, so a red message holds names and true or false, never a value (`envShape` of `tools/test/e2e-stand.test.js` and of the spec); (2) the same for every value-bearing comparison, not only the first one written (G1); (3) a checker that searches red outputs for values first replaces the known paths (the scratch folder, the temporary root, the working folder) by their placeholders, controls the search on a made-up line with a planted name and value and on a clean line, and keeps the file it deletes named in its report. How it is checked: a mutant that hands the whole environment (R01, W1) is red, and its red output, searched after the known paths are redacted, holds no foreign name and no value.
- Где найдено: `handoffs/E2E106-20261115-01/step-05b-test-design-validator.json` (F3, issues I2 (b), I4), `step-05c-test-fixer.json` (I1, I2), `step-05d-test-fixer.json` (I1, I2), `step-05e-test-fixer.json` (I1), `step-05f-test-design-validator.json` (G1, «RED-OUTPUT SEARCH»), `step-09-release-validator.json` (`self_check` «MUTANTS»); `decisions/0112`, О24, О25; `docs/issues/ISS-0111` (G1); AP-124 (a red `assert` printed a whole tree).

### AP-153 — Checks that pass without proving what they name: a folder checked but not handed over, a «real path» asserted on inputs that are real paths already, a link one level deep, a shape check tried with lists only, a key text masked by another rule, a wait that waits for nothing

- Что случилось: the design and the gates of run `E2E106-20261115-01` measured five checks that were green while the property they named could be broken. (1) The released starter checked the folders of `stateDirs` but did not hand those values to the child, so the check proved nothing about what the server got (design F14, the precondition О15 of `decisions/0109`). (2) The spec asserted that the hook gets the real paths of its folders, but every folder it gave came from `makeTempDir`, already a real path, so a helper that passed the raw value stayed green (mutants H01, H02; step 05b, F1, issue I2 (a)); the fix gave a link and a `..` spelling, and the link cases were then one link deep, so a helper that follows one level stays green (A4; step 05f, G2). (3) Design 4.1 said «not a plain object → `USAGE`» for `stateEnv`, the test rows tried a list and a string, and the built check, «not a list», took a `Map` as empty with no word (REVIEWER, step 04, L2). (4) The key-shaped text of the mask test was masked by a second rule (long strings) as well as by the key rule, so a broken input (a dash in place of the underscore, mutant R06) still looked masked until a shape control of the input was added (design F20). (5) The kit's `page.waitFor(source)` with no `args` evaluates the source as an expression; a function written as the source is itself truthy, so the wait ends at once — the gate's own sketch fell into it in two waits and still passed (step 01b, issue I3).
- Почему это плохо: each green run looked like evidence; a regression of exactly the named kind would have passed, and only a mutant of a gate showed it. The kind repeats AP-071 (a counting criterion met before the work) and AP-110 (a check that covers only the listed cases).
- Как правильно: (1) a check of an input is followed by the use of the checked value in the same call, and a test asserts what the child or the server got, not what was checked; (2) an assertion «X is turned into Y» is tried on an input where X differs from Y (a link, a `..`, a chain of two links), with a control that they differ; (3) a rule that excludes a shape («not a plain object») gets a test row for each kind of the excluded shape (a list, a `Map`, a class instance, `null`), and a design names the rows; (4) a test text that should be masked gets a control of its own shape, and the oracle does not rest on one rule when two may act; (5) page code given to `waitFor` or `evaluate` is an expression or a function with its `args`; a function without `args` is written as a called expression `(() => …)()`. How it is checked: the gate's mutant of each kind (H01, H02, A4, the `Map` row, R06, a bare-function wait) is red in the named test.
- Где найдено: `docs/design/REQ-106-e2e-pixel-office.md` (F14, F20, section 4.4 «A trap of the kit», section 15 Q13); `handoffs/E2E106-20261115-01/step-01-code-designer.json` (issue I18), `step-01b-code-design-validator.json` (issue I3), `step-04-reviewer.json` (L2, issue I7), `step-05b-test-design-validator.json` (F1, issue I2 (a)), `step-05f-test-design-validator.json` (G2); `docs/issues/ISS-0111` (L2, G2); AP-071, AP-110.

### AP-154 — A test server on the owner's computer: what a private home does not cover, and what a test must not read

- Что случилось: the design of REQ-106 (run `E2E106-20261115-01`, step 01) measured four facts about running Pixel Office and its hook inside a test on the computer where the owner's real Pixel Office lives. (1) A private `HOME` covers `os.homedir()`, but Node's `os.userInfo().homedir` still names the real home folder whatever `HOME` is (F13); no server of Sai asks it today (`decisions/0112`, О16). (2) A second Pixel Office on a port already held by another Pixel Office prints the same link line and ends with code 0, and its page looks exactly like ours; so a restart test that read the page first could read a foreign server as its own (F11; the identity is the start row in our own folder, read before the page, `decisions/0112`, О5). (3) A hash of the real journal read inside a test would turn red whenever a real Claude Code session writes during a check, because agents run `npm run check` inside sessions whose hooks feed the real server (C-6). (4) A stand-in that writes into «the home folder» to test the home net would, under a starter mutant that gives no private home, write into the home folder of the person who runs the tests (design 4.2, the guard and its test `E2S-21`).
- Почему это плохо: each fact makes a test either unsafe for the owner's real files (1, 4), wrong about which server it talks to (2) or flaky by construction (3); none shows up on a machine without the owner's Pixel Office, so it would surface first on his computer.
- Как правильно: (1) a stand gets a private home and the limit of `os.userInfo()` is written down where the starter is described (`tools/README.md`, «Servers for the page specs»); a server that would ask it needs a change of the kit first; (2) a test that restarts a server reads the identity from its own state folder (a start row) before the page, and a foreign holder of the port fails the test with its cause, never a retry; (3) the hash of a real shared file is measured by the validator around the command, never by a test; (4) a stand-in that writes into its home writes only when that home lies strictly under its real temporary root, and that guard has a test of its own (a direct run with a home outside the root). How it is checked: the README paragraph names the `os.userInfo()` limit; `reconnect` reads the start rows before the page; the spec never reads the real folder; `E2S-21` runs the stand-in directly with a home outside its root and sees `home-refused`.
- Где найдено: `docs/design/REQ-106-e2e-pixel-office.md` (F11, F13, C-6, 4.2, section 15 Q13); `handoffs/E2E106-20261115-01/step-01-code-designer.json` (issue I18); `decisions/0112`, О5, О6, О16; `tools/README.md`, «Servers for the page specs».

### AP-155 — A diagnostic that would have given Chrome the person's real home folder was tried; the permission check of the session stopped it, and nobody looked for another way

- Что случилось: in run `E2E107-20261116-01` (REQ-107, step 01) the code designer measured why the kit's Chrome did not answer its first navigation under a home folder below the temporary root (design F32) and tried one diagnostic that would have started Chrome with the person's real home folder. The permission check of the session denied the command; nothing ran, and the designer did not try it another way and named it in its report. The safety rule R2-T of the task listed the programs of the project (the team server, the engine, Pixel Office, any Node program of the project), not the browser, so the attempt was outside its letter and against its spirit, as ORCH's `orch_check` of step 01 wrote. The rule «a denied command is not repeated another way» held twice more in the run: BACKEND-DEV's removal of its own 38 Chrome folders (step 02, issue I2) and a second net of TEST-DESIGN-VALIDATOR written by a here-document (step 05b, issue I2); both were denied and not repeated.
- Почему это плохо: Chrome started with the person's home works in the person's profile area, and by Chromium's source a start without the mock keychain takes the real keychain path and can show a keychain dialog on the person's screen (step 03, issue I2 and the reviewer's reading of the switch); a safety rule read by its letter leaves open every program it does not name, and here only the permission check stood between the trial and the person's files.
- Как правильно: (1) a trial that would reach the person's home folder, keychain or real state folders is not tried, whatever program it starts and whether or not the rule names that program: a safety rule is read by what it protects; the trial gets a home under the temporary root, or the question goes to ORCH; (2) a command denied by a permission check is not repeated in another form; the agent writes what was denied, when and why into `result.issues` and goes on without it; (3) ORCH writes a safety rule with its purpose («nothing of the person's home is read, written or started with»), not only with the list of programs. How it is checked: the `self_check` of every trial shows a `HOME` under the temporary root for each start of a browser or a program; `result.issues` lists each denied command with its time.
- Где найдено: `handoffs/E2E107-20261116-01/step-01-code-designer.json` (`summary`, «Not done on purpose»; `context.orch_check`), `step-02-backend-dev.json` (issue I2), `step-03-security-reviewer.json` (issue I2), `step-05b-test-design-validator.json` (issue I2); `decisions/0113`, О2, О19, О25.

### AP-156 — Shell slips again: a zsh loop over an unsplit variable did not stop four busy loops, an argument that starts with `=` failed, and a stray redirect wrote a copy of a project file into the system temporary folder

- Что случилось: three slips of run `E2E107-20261116-01`, each seen and undone at once. (1) RELEASE-VALIDATOR (step 09) started four busy loops for a load run, kept their pids in one variable and stopped them with `for p in $PIDS`: zsh does not split an unquoted variable into words, so `kill` got the four numbers as one word and printed `kill: illegal pid`; the validator saw it, killed the four by their numbers and `ps -p` showed none. The same loop had failed the code designer at step 01 (issue I18 (7)), where a `kill -0` right after the signal also still saw the loops before they were reaped. (2) In zsh an argument that starts with `=` is expanded as the path of a command: `echo =====` fails with `===== not found` (step 01, issue I18 (8)); DOC-UPDATER hit it again at step 10 with a separator in a read-only command. (3) TEST-DESIGN-VALIDATOR (step 05b, issue I3): a stray redirect in a count command wrote a copy of the tag's `tools/test/e2e-kit.test.js` as a file named `x` into the system temporary folder; it was compared with the tag file and removed within ten seconds.
- Почему это плохо: a busy loop left running loads the machine and falsifies every later time, and the times of this run (the 70000 ms budget, the load series) are read on this machine; a command that fails on its own text can be read as a result; a file outside the session's folder is outside every list of what a run changed (AP-136). The kinds repeat AP-147 (a zsh modifier), AP-136 (stray redirects) and AP-137 (stray processes).
- Как правильно: (1) in zsh several pids go into an array and the loop runs over it (`pids=(…); for p in "${pids[@]}"`), or each pid is named (`kill <pid1> <pid2> …`); after the stop `ps -p` with those pids shows no line, and a killed process is waited for with a limit (AP-144); (2) a text that starts with `=` is quoted (`echo '====='`) or not used; (3) every redirect names a full path in the session's folder, and a slip goes into `result.issues` even when it was undone at once (AP-136, item 3). How it is checked: the `self_check` of a load run lists the pids it started and an empty `ps -p` after the stop; a listing of the system temporary folder after the step shows no file of the step.
- Где найдено: `handoffs/E2E107-20261116-01/step-09-release-validator.json` (`self_check` «BUSY LOOPS», issue I8 (f)), `step-01-code-designer.json` (issue I18 (7), (8)), `step-05b-test-design-validator.json` (issue I3), `step-10-doc-updater.json` (issues); AP-136, AP-137, AP-144, AP-147.

### AP-157 — The turn of an agent ended during its own background wait for a GitHub run, and the handoff hung until ORCH resumed the same launch; the harness also moves a long foreground command to its background after 180 s

- Что случилось: TEST-RUNNER of run `E2E107-20261116-01` (step 06) pushed its snapshot and waited for the GitHub run 43968701242 with a poll in the background of its shell. The harness of the session made it hand back a report before the end, and its turn ended while the poll was still running (ORCH's record in `context.interruptions`: 2026-11-16T22:17:57Z): the handoff stayed `IN_PROGRESS` with `result` null and the temporary branch still on GitHub. The agent reported that state honestly; ORCH resumed the same launch (resumed 2026-11-16T22:24:48Z); it waited for the same run, read it, deleted the branch and wrote its result, and nothing was run twice. In the same session the harness moved a waiting foreground command to its background after 180 s, at step 06 and at step 09 (both local `npm run check`, about 335 s); both agents kept waiting in their own turn by reading the log to its end line and started no second copy.
- Почему это плохо: after the turn of an agent ends nobody wakes it (`docs/workflows/handoffs.md`, «How the recipient works», item 6); a handoff `IN_PROGRESS` with a branch left on GitHub depends on ORCH noticing it, and a new launch from a clean sheet would push or poll a second time. A command moved to the background looks finished to a careless reader, and a second copy started «to be sure» doubles the load and mixes the results (AP-137).
- Как правильно: (1) a long wait — the full check, a GitHub run — is done in the agent's own turn by short foreground calls, each of which reads the log or the state of the run once and returns; the turn does not end «until the notification»; (2) when the harness moves a command to its background, the agent keeps reading its log until the end line it expects and starts no second copy; (3) when the turn ends anyway, the agent hands back the honest state (what is done, what is still running), and ORCH records the interruption and resumes the same launch (`docs/workflows/handoffs.md`, «Pauses and interruptions»). How it is checked: the `self_check` of a step that waited holds the end line of its log or the conclusion of the run, with its time; `context.interruptions` lists every end of a turn.
- Где найдено: `handoffs/E2E107-20261116-01/step-06-test-runner.json` (issue I6, `context.interruptions`, `self_check` «LOCAL CHECK»), `step-09-release-validator.json` (`self_check` «LOCAL CHECK», issue I8 (d), (g)); AP-006, AP-137.

### AP-158 — A decision and a README sentence said more than was measured: «keeps the browser of the normal check away from the person's keychain», and a measurement on macOS written with no system

- Что случилось: `decisions/0113` О1 (ORCH, run `E2E107-20261116-01`) accepted the kit switch `--use-mock-keychain` with the reason the designer measured (F32: under a home folder below the temporary root Chrome on macOS does not answer its first navigation without it) and one sentence more: «The argument also keeps the browser of the normal check away from the person's keychain». SECURITY-REVIEWER (step 03, issue I2) found it not shown: the browser of the normal check under the person's own home was never measured (such a trial is not allowed), and under a temporary home the browser still started the legacy layer of the Security framework. ORCH withdrew the sentence by О25 and kept only what was shown. REVIEWER (step 04, L1) found the same shape in `tools/README.md`: «measured for REQ-107: … and without it it does not» named no system, while it was measured on macOS only; by О27 the sentence now reads «measured for REQ-107 on macOS: …» (step 10).
- Почему это плохо: a recorded decision is above a task (quality-bar §6, item 7), so a sentence in it that says more than was shown becomes a «fact» the next agents build on — here a claim about the person's secrets. A measurement without its system reads as true for the runner and Windows as well (AP-144).
- Как правильно: (1) a decision or a document states only what was measured, with the conditions of the measurement (the system, the version, the home), and names what was not measured; a benefit that seems likely is written as «not measured»; (2) the checker of a decision or a README sentence compares each claim with a measurement in a handoff and makes an unmatched claim a finding, as steps 03 and 04 did. How it is checked: each causal or security claim of a decision points to its measurement; a README sentence with «measured» names the system.
- Где найдено: `decisions/0113`, О1, О25, О27; `handoffs/E2E107-20261116-01/step-03-security-reviewer.json` (issue I2), `step-04-reviewer.json` (L1); `tools/README.md`, section «End-to-end tests in a real browser»; AP-144.

### AP-159 — Checks of the team page spec that could not be red or proved less than they named, found only by the mutants of the gates; and two facts of the page that mislead a spec

- Что случилось: in run `E2E107-20261116-01`: (1) the stack mark `^\s+at ` of criteria 5 and 6 was read on text folded to single spaces and trimmed, where no line starts after the first character, so it could never be red (gate 5b, F1, Medium; mutants D10b, D10c); step 05c added the unfolded `textContent` beside the folded text; (2) `assert.rejects` with a validation function that returns the caught error prints that error's message on a red run, and a refusal message of the kit holds the refused value — here the `PATH` of the spec process (step 05, issue I8, mutant T05); the refusal tests now compare the code only; (3) the first form of the empty chat tries asserted «nothing sent» in both branches, stricter than criterion 5, which also allows a refused send with a plain sentence (step 01, issue I18 (5); P19, green on purpose); (4) the rule «options only from `teamOptions`» (`decisions/0113` О23) could be checked only by reading until the options were frozen and known by their object in a `WeakMap`, which turned a spread at a call site red (step 05, issue I8, V03d); (5) three checks whose window was shorter than the property: «Не останавливать» proved up to the page's next poll, whose length is not asserted (gate 5e, N1, P13g1), the button «inside the window» after a sideways scroll (step 09, L2, M11b), and the trap marker read before the stand stops (step 09, L1, M01p) — now `docs/issues/ISS-0116`; (6) two facts of the page and the kit (step 01, issue I18 (3), (4)): a `goto` to an address that differs only by its `#` part fires no load event (a 15 s `NAVIGATION_FAILED`, design F24), and `textContent` reads the hidden alternative sentences of the page that the visitor does not see (F25).
- Почему это плохо: each check was green while the property it names could be broken, and only a mutant of a gate showed it; the kind repeats AP-153 (checks that pass without proving) and AP-152 (a red message that prints a value). A check stricter than its criterion turns a correct page red and pushes the author to bend the page to the test.
- Как правильно: (1) a pattern that needs a line start or a line break is applied to the raw text (`textContent`, or `innerText` not folded), and the folded text is kept for comparisons; (2) a refusal test compares the code of the error only; (3) a check is as strict as its criterion and no stricter: every branch the criterion allows is green, every branch it forbids is red, each with a mutant; (4) a rule «only through one helper» is made mechanical (a frozen object known by a `WeakMap` or a `WeakSet`), so a bypass is red; (5) a proof by a window asserts the length of the window, a check «inside» forbids the scroll it does not allow, and an end check runs after the last event it guards (after the stop); (6) a navigation that changes only the `#` part waits for a fact of the page, not for a load event, and a text the visitor reads is taken from the `innerText` of shown elements. How it is checked: the gate's mutant of each kind (D10b, T05, P19 and its forbidden twin, V03d, P13g1, M11b, M01p) is red in the named test, or the gap is a named limit with its defect.
- Где найдено: `handoffs/E2E107-20261116-01/step-05b-test-design-validator.json` (F1, issue I5), `step-05-test-designer.json` (issue I8), `step-01-code-designer.json` (issue I18 (3), (4), (5)), `step-05e-test-design-validator.json` (N1, issue I3), `step-09-release-validator.json` (L1, L2); `docs/design/REQ-107-e2e-team-web.md` (F24, F25, sections 4.4 and 16, «As built»); `docs/issues/ISS-0116`; `decisions/0113`, О23, О31, О34, О35; AP-152, AP-153.

### AP-160 — Trial nets and a changed home changed what the trials measured: a wrapper that lost `util.promisify.custom`, a net that misread the nested `TMPDIR`, a fresh home that blocks Chrome, a refusal row that depends on whose home it is

- Что случилось: (1) SECURITY-REVIEWER of run `E2E107-20261116-01` (step 03, issue I4): a preload net that replaced `child_process.execFile` with a plain wrapper lost `util.promisify.custom`, so `promisify(execFile)` resolved with the stdout text only; the trial's poller read every answer as `undefined` and recorded 0 polls while the trial looked green; it was seen in the report (polls 0) and not used as evidence. (2) The code designer's own net (step 01, issue I18 (2)) judged paths by the child's `os.tmpdir()` and refused 65 stand-ins of the kit tests, because those tests give their children a nested `TMPDIR`; its root was fixed by the shell. (3) Under the run's rule R2-T (a home below the temporary root for every trial) the released kit's Chrome on macOS did not answer its first navigation (`CALL_TIMEOUT`; design F32), which led to the kit switch of `decisions/0113` О1 (step 01, issue I18 (1)). (4) A refusal row built from the spec process's home folder is refused only while that home is the person's; under a trial home the same row tests something else (step 01, issue I18 (6)).
- Почему это плохо: a net or a changed environment is an instrument; when it changes the behaviour of the code under trial, a green result says nothing (0 polls looked like a pass) and a red one blames the code, and the work goes into the instrument instead of the design.
- Как правильно: (1) a net that wraps a function keeps its whole contract or refuses the use it cannot keep (here: it refuses `promisify` of a wrapped `execFile`, since copying `promisify.custom` onto the wrapper would bypass the net); (2) every net and wrapper gets a positive control for each kind of call it will meet — a nested `TMPDIR`, a promisified call, a child of a child — before the trials; (3) a safety rule that changes `HOME` or `TMPDIR` is tried first with one start of each program of the trials, the browser included, and the result is written down; (4) a count of 0 events is a failure of the instrument until a control shows that the instrument sees an event; (5) a refusal row names the folder it refuses explicitly, not «the home of the spec process». How it is checked: the `self_check` of a step that used a net lists its positive controls and their output.
- Где найдено: `handoffs/E2E107-20261116-01/step-03-security-reviewer.json` (issue I4), `step-01-code-designer.json` (issue I18 (1), (2), (6)); `docs/design/REQ-107-e2e-team-web.md` (F32); `decisions/0113`, О1, О2, О18; AP-150.

### AP-161 — A ready fix written into a defect was tried on the mutant and on today's page only; on the benign twin the defect itself named, it was red

- Что случилось: item 3 of «Как исправить» of `docs/issues/ISS-0116-team-page-spec-low-gaps.md` (written at step 10 of run `E2E107-20261116-01` from the measurement of gate 5e) gave a ready form for N1: after the existing wait, assert that the window after «Не останавливать» lasted at least 3000 ms. It had been measured red on the mutant P13g1 and green on today's page. ISSUE-FIXER of run `ISS-0116-20261117-01` (step 01) also tried it on P13g0, the page that only refreshes the project at once on the cancel and sends nothing, which the defect itself calls benign. The form was red there (window 3 ms), so it was stricter than criterion 4. `decisions/0114` Д2 rejected it and took a measured form instead: the wait ends only when 3000 ms have passed since the click and the page's next poll has come. That form is red on P13g1 and P13t, green on P13g0 and on today's page, and adds no time.
- Почему это плохо: a fix that a defect states as ready is built as it is written, and the next gate is likely to check it against the same two cases. A check that is red on a page the criterion allows makes a correct page red and pushes the author to bend the page to the test (AP-159 (3)). It was found only because the diagnosis tried the twin.
- Как правильно: (1) a fix written into a defect is measured on three sides before it is written as ready: red on the mutant, green on today's page, and green on every benign twin the defect or its gate names; a fix not measured on the twins is written as «to be measured», not as ready; (2) the diagnosis of a defect tries the defect's own fix on the benign twins before it builds on it, as step 01 did; (3) a proof over a window bounds the window from below while keeping the wait for the page's next fact (a floor and the event), so a page that acts at once is neither punished nor let through. How it is checked: the «Как исправить» item of a defect names, for each ready form, its mutant red, today's page green and each named benign twin green.
- Где найдено: `handoffs/ISS-0116-20261117-01/step-01-issue-fixer.json` (summary, «FINDING ON THE PROPOSED FIX»; probes P13g0f, P13g1f, P13g1a, P13t1a, P13g0a, K2a); `decisions/0114`, Д2; `docs/issues/ISS-0116-team-page-spec-low-gaps.md` (item 3 of «Как исправить» and «Закрыто»); `handoffs/E2E107-20261116-01/step-05e-test-design-validator.json` (N1); AP-159.

### AP-162 — The same error of one check came back at two gate passes: each fix was tried against the probe that found the gap, not against the other ways to hide the thing the check proves

- Что случилось: in run `ISS-0116-20261117-01` the window check of test `windows` (criterion 7 of REQ-107, «the button is inside the window») was fixed three times. Step 06 added `scrollX === 0` against the probe M11b (L2). Gate pass 1 (step 07, F2, Medium) showed that the check's own `scrollIntoView` could still scroll an inner box with hidden overflow (TV05). The gate proposed a form, FX2 (read the sideways position before the scroll), which step 07b built. Gate pass 2 (step 07c, G1, Medium) showed the same error again: a box narrower than the window (TV16) or with hidden vertical overflow (TV17) was scrolled by the check, and a clip, a box over the button or a hidden button passed while nothing scrolled (G2: TV19, TV20, TV21). The validator wrote that FX2 had been measured on TV05, M11b and TV06b only (its own issue I2). By the rework rule the approach changed (`decisions/0114` Д14, Д18): «inside» became «the person can see and reach the button», read in five parts. Before the last pass TEST-FIXER (step 07d, issue I2) listed the ways it still saw to defeat the check, and ORCH recorded those as named limits (Д17) instead of leaving them for the last gate to find. Pass 3 (step 07e) passed with one more Low (H1) and two more named cases (Д19).
- Почему это плохо: every pass of a gate is one of three (`decisions/0079`, item 4). A fix tried only against the probe that found the gap closes that probe and leaves its neighbours, so the next pass spends itself on the next hole of the same check. With one pass left, a third such FAIL would have stopped the run and gone to the owner. It is the kind of AP-145 (a check made stronger one place at a time) in a page check.
- Как правильно: (1) before a check is fixed or a fix is proposed, write down what the check proves in the person's words («the person can see and reach the button») and list the ways to hide that thing: a sideways scroll, a scroll of a box the person cannot scroll, a clip, a box over it, a hidden or unpainted element, a transform, a disabled control, a later change; then try the fix against each, with a benign twin for each (a box the person can scroll, a page scroll); (2) a gate that proposes a form measures it against the same list, not only against its own probe (step 07c, issue I2); (3) when the same error comes back, the definition changes, not the patch (WF-03, «Rework loop»); (4) what a check of this kind cannot prove (here: what is painted, one moment, the page's own functions) is named as a limit with its defect before the last pass, so that pass judges the check against its stated scope. How it is checked: the handoff of a fix of a check holds the list of the ways to hide the property and the result of each, with the benign twins.
- Где найдено: `handoffs/ISS-0116-20261117-01/step-07-test-design-validator.json` (F2), `step-07b-test-fixer.json`, `step-07c-test-design-validator.json` (G1, G2, issue I2), `step-07d-test-fixer.json` (issue I2), `step-07e-test-design-validator.json` (H1, issues I1, I2); `decisions/0114`, Д8, Д14, Д16–Д19; `docs/issues/ISS-0118-team-page-window-check-needs-a-check-from-outside-the-page.md`; AP-145, AP-159.

### AP-163 — Long checks on the owner's Mac were cut by the closed lid and by a thermal emergency sleep; `caffeinate -i` does not hold a closed lid

- Что случилось: in run `ISS-0116-20261117-01` the Mac slept during long checks. Gate pass 1 (step 07, issue I2): the power log shows a lid-close sleep at 10:33:01Z. In the same second a quiet `control` run lost its Chrome (`BROWSER_CLOSED`), and a `chat` run hung through the sleep until the dark wake at 10:39:07Z, with no time-out firing. The machine slept again 10:52:21Z–11:19:36Z. Step 07b (issue I6): a lid-close sleep at 11:38:18Z, then a «Thermal Emergency Sleep» at 11:38:31Z, and a wake by the lid at 11:43:16Z. Both checks ran under `caffeinate -i`. The two bad runs were proven not caused by the work by the power log, matched to the second (`decisions/0114` Д11, Д13). The whole series was run again after the wake as the measurement (12 of 12 green), and both bad runs were kept in the report; no trial ran during the second sleep.
- Почему это плохо: a sleep turns a test red or makes it hang with no message that names the cause, so a red run looks like a fault of the work; if nobody reads the power log, it is either blamed on the work or, worse, waved away as noise (quality-bar §6, item 4; AP-054). A thermal emergency sleep also means the machine ran too hot for its load. A long gate that sleeps loses its time and may lose a gate pass.
- Как правильно: (1) a long check on the Mac runs with the lid open and the machine ventilated, one heavy job at a time; `caffeinate -i` keeps the machine from idle sleep only, not from a closed lid or a thermal emergency; keeping the lid open is the owner's matter, and the agent tells ORCH (AP-021); (2) the author of a long run reads the power log for the time of the run (sleep, wake, «Clamshell», «Thermal») and writes the result into `self_check`; a run cut by a sleep is set aside with the log lines as its evidence, and the series is run again after the wake as the measurement, with both results reported; (3) a sleep is never a reason to repeat a red until it is green: the evidence is the log line matched to the second. How it is checked: the `self_check` of a step with long runs on the Mac names the power-log reading for the time of the run.
- Где найдено: `handoffs/ISS-0116-20261117-01/step-07-test-design-validator.json` (issue I2), `step-07b-test-fixer.json` (issue I6); `decisions/0114`, Д11 and Д13; AP-054, AP-021.

### AP-164 — A fixed pixel threshold for a layout rule was measured on one platform's fonts and tested only there; it was moved three times and failed on the first other font

- Что случилось: in run `M1CODE-20261119-01` the speaker of a demo question (avatar, role title, stage word) had to leave its place beside the question when the title did not fit. Each fix set a window width: 360 px (`decisions/0124` О19), then 372 px after DESIGN-QA's first pass found the title 1.0 px from «‹ Назад» at 361 px (О32), then 380 px, with 8 px of slack, after REVIEWER's finding that 372 had no slack (О36). Every number was measured on one machine's font (the macOS system font stack), and the layout tests of the run were written to the same number and run only there. The first run on another font, the GitHub runner's Linux font (snapshot `ci/m1-landing-2`, commit bc3af8d, `app.yml` run 44887506935), failed at LD-5 at the 380 px window: the longest Russian title ended at 230.6 px and its column at 222.2 px, 8.4 px beyond. TEST-FIXER stopped (`step-06a-test-fixer-ld5-380.json`), because every fix changed an owner's ruling or the look, and the owner had to rule (О45: by content, no threshold). A new code round (02f), a new test round (05l), the narrow reviews and two more snapshots followed.
- Почему это плохо: how wide a text is depends on the font of the visitor, so a width at which it fits is a fact of one platform, not of the page; a slack added by hand (8 px, then more) is a guess about fonts nobody measured. Reviewers and validators of several steps passed the threshold and the tests that pinned it, because none of them could see another font; the owner's visitors have other fonts as well.
- Как правильно: (1) a layout rule that depends on the width of text is written on the content: the page measures whether the text fits in the visitor's font and sets one state (here the class `own`); no window width stands in for it; (2) its tests read invariants (no line beyond its column, no overlap, the state set exactly when the line is off its row) and make the font-dependent case by a stress on the page's own measure, never by a window width taken from one machine; (3) a design or a test that must name a width measures it on the runner's font before the first snapshot (a throwaway snapshot branch, `decisions/0110`), not only on the author's machine, and the look says which platform a measured width belongs to (AP-158); (4) a slack added «to be safe» is replaced by a rule on the content or by a measure on a second font. A proposal for the quality bar, not accepted and so not in it: a layout rule that depends on the width of text is tested by a rule on the content and measured on the runner's font before the first snapshot (`handoffs/M1CODE-20261119-01/step-09-release-validator.json`, issue I4).
- Где найдено: `handoffs/M1CODE-20261119-01/step-06a-test-fixer-ld5-380.json` (BLOCKED stop), `step-04d-reviewer.json` (L1, the 371 px threshold has no slack), `step-07-design-qa-validator.json` (N1), `step-02f-code-fixer-speaker-content.json`, `step-05l-test-designer-speaker-rows.json`, `step-05m-test-design-validator-speaker-rows.json` (T16), `step-09-release-validator.json` (I4); `decisions/0124` О19, О32, О36, О45; `docs/design/V1-public-look.md` 7.9, D25; AP-158.

### AP-165 — Comments written in a public file named an internal record, and the word check of that file was red only on GitHub, after three steps had passed

- Что случилось: round 02f of run `M1CODE-20261119-01` (the speaker row by content) wrote comments in two files of `app/public` (`css/site.css`, `js/pages/demo.js`) that named the record that holds the owner's ruling. The word of that record's folder is on the forbidden list of the public files (REQ-109 criterion 7; `check-public`). Steps 03f, 04f and 05m, all PASS, did not see it: they read the code and the tests, and the only step that runs the word check over the changed files, the job `check` of `app.yml`, is never run on the owner's PC (his rule: checks only on GitHub). It ran on the second snapshot, `ci/m1-landing-3` (commit 8337120, `app.yml` run 44906936052): the job `check` was red at `check-public`, while `pg`, `docker` and `e2e` were green. Round 02g (comments only), the narrow reviews 03g and 04g and a third snapshot, `ci/m1-landing-4`, were needed to put it right.
- Почему это плохо: a comment in a file that is served is part of what a visitor can read, and a record name in it is a comment that nobody can understand without the project. Every step before the snapshot judged the change finished, so a loop of steps was repeated for one word; and the owner's rule that checks run only on GitHub makes the first snapshot the only place where this kind of error shows.
- Как правильно: (1) a comment in a file of `app/public` names no internal record (no decision, handoff, requirement id, role or program word) and says the rule in plain words; (2) the author of a change to a public file searches the changed lines for the forbidden words of REQ-109 criterion 7 before the hand-in, and the reviewer does the same over the diff; (3) a round that changes only comments is still a change of reviewed code: the narrow reviews 3 and 4 run again and a new snapshot is made (done here, О47); (4) the plan says which check cannot be run on the author's machine and which snapshot will run it, so nobody reads a green review as a green check.
- Где найдено: `decisions/0124` О47; `handoffs/M1CODE-20261119-01/step-02g-code-fixer-comments.json`, `step-03g-security-reviewer-comments.json`, `step-04g-reviewer-comments.json`; GitHub `app.yml` run 44906936052 (job `check`, step check-public); `docs/program/public-v1/PROGRESS.md` (log of 2026-11-21).

### AP-166 — A resume of a workflow whose lanes run agents at the same time started the finished agents again

- Что случилось: on 2026-11-20 the build of run `M1CODE-20261119-01` (two lanes, FRONTEND-DEV and BACKEND-DEV, agents running at the same time) was stopped by the account's five-hour usage limit and resumed after the reset. The resume started two agents that had finished (F1k and the look edit) again: with two lanes the agents are called in another order on a resume, so their cache keys changed and the finished work was not recognised. ORCH stopped it after about 30 seconds; the modification times of the files (`texts.js`, the look and their handoffs) proved that nothing had changed; the rest was launched as a new workflow of only the remaining sub-steps (`docs/program/public-v1/PROGRESS.md`, 2026-11-20T07:32:59Z).
- Почему это плохо: a finished agent run again can rewrite a file that other steps have already read, change the handoff of a closed step, or spend the limit once more; here nothing was changed only because ORCH was watching and stopped it in time.
- Как правильно: never resume a workflow whose lanes run agents concurrently; take an inventory of the files and handoffs (what is COMPLETED, what stopped) and launch only the remaining steps as a new workflow; a stopped handoff is closed by ORCH with `not_agent_attested` (as B3's was here) or left `IN_PROGRESS` with a BLOCKED issue, never run again from a resume; within the first minute after a launch, check the modification times of the files of the finished steps.
- Где найдено: `docs/program/public-v1/PROGRESS.md` (log lines of 2026-11-20T07:04:26Z, 07:31:42Z and 07:32:59Z); `handoffs/M1CODE-20261119-01/step-02-backend-dev-b3.json` and `step-02-backend-dev-b3-run2.json`.

### AP-167 — Two agents died on an expired login session and the step stood about four hours; nothing in the project showed it

- Что случилось: on 2026-11-21 at about 04:40Z the agents of step 5b gate pass 3 (TEST-DESIGN-VALIDATOR) and of the DESIGN-QA second pass died on an authentication error, «OAuth session expired and could not be refreshed», before they wrote a handoff. No file changed, the steps looked as running, and the work stood about four hours, until a probe agent (09:45 local time) showed that agents worked again; both steps were launched again from a clean sheet (no partial handoff existed; `step-05j-test-design-validator.json` and `step-07b-design-qa-validator.json` are the second launches). Earlier in the same run the account's five-hour and weekly usage limits stopped agents before they wrote a file in the same way (2026-11-19T21:43Z, 2026-11-20T07:04Z and 11:35Z).
- Почему это плохо: a dead agent writes nothing, so a quiet step is not a working step; the cost is time and, when the agent had measured for an hour before it died, all the measurement is lost, because it lived only in the agent's memory; a relaunch from a clean sheet repeats everything.
- Как правильно: (1) a long agent step writes its measurements to files of the working folder as it goes, not only at the end, so that a relaunch can start from them; (2) ORCH looks at a running agent by the time of its newest file and by a short probe agent, at an interval of minutes, and asks whether the session is alive when an agent has not written for much longer than its step takes; (3) after an authentication error ORCH writes the time of the stop and of the relaunch into the log at once, relaunches only the steps that have no partial handoff and leaves the stopped ones by the rule of a stop (`IN_PROGRESS` with a BLOCKED issue, or `not_agent_attested`); (4) the owner is told in one line that the session needs a new login, because only he can give it.
- Где найдено: `docs/program/public-v1/PROGRESS.md` (log lines of 2026-11-21T04:40Z and 05:18:18Z; 2026-11-19T21:43Z; 2026-11-20T07:04:26Z and 11:35:53Z); `handoffs/M1CODE-20261119-01/step-05j-test-design-validator.json`, `step-07b-design-qa-validator.json`; AP-163 (a stopped machine, the same kind).

### AP-168 — The tags of a run stayed on one computer: the clone on the other computer could not run the commands that name them

- Что случилось: the design, criteria 11 and 16 of REQ-111 and the RELEASE-VALIDATOR's diff of run `M1CODE-20261119-01` name `base/M1CODE-20261119-01` and the later lightweight tags (`-build`, `-review`, `-review4`, `-review5`, `-5b2`), set before each round on the Mac. A tag is pushed only on the owner's word (WF-02, step 11), so none of them reached the repository; the work then moved to the owner's Windows PC from a clone that has only the first tag. The commands «`git diff --stat base/<RUN-ID> -- tools/src`» and «`git clone -b <tag>`» of the later tags could not be run there; `docs/program/public-v1/PROGRESS.md` («Last commit») had to say that the commands take commit ids instead, and RELEASE-VALIDATOR diffed against the commit f4ac340.
- Почему это плохо: a «before» that is a name in a command stays valid only where the name exists; a hand-over by tag names looks complete and is not; a later reader cannot tell from the handoffs which commit a tag was.
- Как правильно: when a tag is set, its commit id is written beside the name in the handoff or in the log of `docs/program/public-v1/PROGRESS.md`, so that the commands of a later step can take the id; a requirement or a design says «the tag, or its commit id from the log», not the tag alone; at the end of a work session on one computer the tags that a later step needs are listed with their ids in the hand-over note (`STATE.md`, PROGRESS «Now»), and their push is asked from the owner in the same message.
- Где найдено: `docs/program/public-v1/PROGRESS.md` («Now», «Last commit»; log lines of 2026-11-20T10:45:55Z, 21:08:37Z and 21:49:04Z), `handoffs/M1CODE-20261119-01/step-09-release-validator.json` (the state proved by the commit f4ac340); `docs/workflows/WF-02-development.md` step 11; AP-086.

### AP-169 — Errors of the code design of run `M1CODE-20261119-01`: a mutant that destroys the tree it runs in, a function made `async` under a test that asserts only «not zero», a filter tested only for what it leaves out, and a design measured on a base that a parallel round changed

- Что случилось: from the design steps 01, 01c and 01e (`docs/design/REQ-111-112-public-landing.md`, sections 1.1, 1.2, 16 and 17) and gate passes 1 and 2: (1) a mutant that removes a guard of the real working tree destroys the tree it runs in (F20), so such a mutant runs only in a throwaway clone; (2) a function that becomes `async` leaves a test that asserts only «≠ 0» passing without proving anything (F21, AP-153's kind); (3) a sketch file was moved to the system temporary folder by a shell fallback and moved back at once (section 17; AP-156's kind); (4) the design was measured on its base tag while a parallel fix round that landed first changed the same guard files, so its replacement table, its test names and its counts were measured again on the tree the build starts from (gate pass 1, issue I5; F34–F40; AP-068, AP-112); (5) a filter was tested only for what it leaves out, so an over-cut went through (V01, F41), and the next gate found the same error again against another way to over-cut, because the fix was tried only against the probe that found it (G2, F46; AP-162's kind); (6) a sketch test was measured alone, not under the check's other guards, and a comment of it was hit by the selector grep (G5, F49); (7) a read in the test (`getImageData` twice) printed a console line under a rule that allows only declared lines (G4, F48; AP-159's kind); (8) a criterion that names a scope («every state … that the test reaches») was mapped to one test that covers the load only (G1, F45; AP-126's kind).
- Почему это плохо: each is an error of an earlier entry in a new place, and each was found by a gate and not by the author; they cost two reworks of the design (steps 01c and 01e) and a third gate pass.
- Как правильно: (1) a mutant of a guard of the working tree runs only in a throwaway clone; (2) a change of a function to `async` goes with a test that proves the value, not only that something came back; (3) no shell fallback writes outside the folders of the project and the session; (4) a design is measured on the tree the build starts from, and again when a parallel round lands first; (5) a filter test proves what the output keeps as well as what it leaves out, and a fix is tried against every way to hide the thing the check proves, not only against the probe (AP-162); (6) a sketch test runs once in the whole check, not only alone; (7) a test that reads a page counts the console lines it causes; (8) a criterion with a scope has one test per element of the scope, or the catalogue says which test covers which (AP-126).
- Где найдено: `docs/design/REQ-111-112-public-landing.md` (sections 1.1, 1.2, 16, 17; F20, F21, F34–F41, F45–F49), `handoffs/M1CODE-20261119-01/step-01b-code-design-validator.json`, `step-01d-code-design-validator.json`; `decisions/0124` О13; AP-126, AP-153, AP-156, AP-159, AP-162.

### AP-170 — A criterion that cites «the test catalogue of the run» for the count of a folder stops holding at the next run, and the design's own counts fell behind the tree during the build

- Что случилось: criterion 2 of REQ-108 compares «# tests N» of each test step with «the test catalogue of the run — section 13 of docs/design/REQ-108-109-app-skeleton.md, with every test that a later step of the run names in its handoff as added or removed». That sentence describes the tree of the skeleton run only: the fix round already moved unit to 46, run `M1CODE-20261119-01` moved it to 120 (int to 47, e2e to 15), so read at a later commit it does not hold (gate finding F10 of the code design; AP-133's kind). The same happened to this run's own design: its section 10 said unit 117, int 46 and e2e 15 while the tree had unit 120, int 47 and e2e 15 after the fix rounds 02c and 02d (found by step 5b gate pass 2, finding T4, and by RELEASE-VALIDATOR, finding F3); DOC-UPDATER brought the design to the tree at step 10. The amendment of REQ-108 criterion 2's reference was proposed in the design (section 16) and left to a micro-amendment run, because a change of the meaning of a criterion needs the requirement gate (`decisions/0079`, item 5); it is recorded as ISS-0128.
- Почему это плохо: a count in a criterion that points to one run's catalogue makes the correct counts of a later run look like a failure of an old requirement; a count in a design that nobody measures again after the fix rounds makes the next checker compare against a wrong number.
- Как правильно: a criterion states a count as a command and its comparison (the lines `^test(` of each file plus the named loops equal «# tests» of the folder in the job log), or points to the catalogues of all the runs that the tree holds, not to one; the counts of a design are measured again on the tree and on the GitHub run by DOC-UPDATER at the last step (here sections 10, 19 and 20 of the design); a rework that changes a count names it in its handoff so that the bookkeeping finds it.
- Где найдено: `handoffs/M1CODE-20261119-01/step-09-release-validator.json` (F3, F4, «what DOC-UPDATER must change»), `step-05h-test-design-validator.json` (T4), `step-01b-code-design-validator.json` (F10); `docs/design/REQ-111-112-public-landing.md` sections 10, 16, 19, 20; `docs/issues/ISS-0128-requirement-text-amendments-left-by-the-landing-run.md`; AP-133.

### AP-171 — Paths of the owner's Windows PC went into handoffs again after the clean-up, because the traces check does not see Windows paths and the generator of ORCH's handoffs wrote them (a repeat of AP-050, AP-052, AP-062 and AP-069)

- Что случилось: the rule `hasHomePath` of the traces check looks for the forms `/Users/` and `/home/` only. A Windows path (`C:\Users\<name>\…`, the same JSON-escaped with doubled backslashes, and the Git Bash form of the same path) is never seen, so `npm run traces` printed 0 on 26 handoffs that carried the user name of the owner's PC, and the pre-push hook would have passed them. ORCH replaced them in commit 6cb68b1 and again before the push of 2026-11-22; the names came back in the handoffs of the audit AUD-002 and of the wording round of REQ-113 (8 to 9 handoffs at the time of the audit, none on an origin ref), because the script that ORCH uses to generate its handoffs wrote the real path of the scratch folder and of the Node folder into them. The lesson of AP-050 («no path of this computer in a handoff») was known; what was missing was a check that sees the Windows forms.
- Почему это плохо: the repository is public (`decisions/0111`), so the user name of the owner's PC would be published in the history on the first push that carried one of these files; a clean-up by hand after the fact does not stay clean while the generator and the check are unchanged; a check that prints 0 where the thing is present teaches everybody to trust it.
- Как правильно: ORCH's generator writes the placeholders `<scratch>`, `<node22>` and `<outside the project>` and never the real path (the launch message carries the real path, the file does not); until the rule is extended (ISS-0134, which first needs a micro-amendment of REQ-014 because its text names macOS and Linux only), ORCH searches `handoffs/` and `docs/` for the Windows forms of a home folder before every commit that carries a handoff, and a missed form is a defect, not a clean-up.
- Где найдено: AUD-002 (SECURITY-AUDITOR of the records, findings SEC-REC-01 and SEC-REC-02, AUDIT-SCOUT I4); `docs/issues/ISS-0134-traces-check-blind-to-windows-paths.md`; the earlier repeats AP-050, AP-052, AP-062, AP-069.

### AP-172 — ORCH committed handoffs of agents that were still running, with the status PENDING, and the handoffs check forbids that in a commit (a repeat of AP-091)

- Что случилось: on 2026-11-22 a commit of the work line carried handoffs whose agents had not finished (the status `PENDING`: the handoff of step 07 of the run `ISS-0092-20261117-01` stood PENDING in the commit 5ac7c98 while its agent still ran). `npm run -s handoffs-check`, read by RELEASE-VALIDATOR of the wording round, answered exit 1 with two violations of H4 (that handoff and the validator's own, which ORCH closes after the step) («status: PENDING в коммите: в коммите только законченные handoff-ы», "status: PENDING in the commit: only finished handoffs are in the commit"). AP-091 recorded the same departure for RELEASE-FINALIZER; this time the actor was ORCH, who put handoffs of running agents into a commit.
- Почему это плохо: the check of the project is red on the commit for a reason that has nothing to do with the work, and the next gate (the check on GitHub) stops at its first error; a handoff that is committed while its agent works is committed in a state that the agent then rewrites, so the history holds a file that never was true.
- Как правильно: ORCH commits only closed handoffs (the status `COMPLETED`, `completed_at` set by the closing command) and names them one by one, never the folder; the handoffs of running agents stay out of the commit until they are closed; before every commit ORCH runs `cd tools && npm run -s handoffs-check` and reads the number of violations.
- Где найдено: `handoffs/M1WORDS-20261122-02/step-11-release-validator.json` (finding F1 and the self-check line of `handoffs-check`); AP-091.

### AP-173 — A test step of an open run (step 06 of the run `ISS-0092-20261117-01`) was left undone for four days, and the first check on GitHub for the work line was red because of it

- Что случилось: the floor of the Node version `>=22.23.4 <23` came into `tools/package.json` with the M0 work of the run `ISS-0092-20261117-01` (commit a2fd74f, 2026-11-19), while the test `tools/test/repo.test.js` (REQ-030 AC1, rules CI-3 and CI-8) still accepted only the form `>=22 <23`; the step that was to change the test (step 06, TEST-DESIGNER) had waited since step 05 closed on 2026-11-18 and started on 2026-11-22, four days later. On the first run of the head of the work line on GitHub (the temporary branch `ci/aud002-head-2`, commit 4a8d751) the check run 45061034491 was red with exactly two failures of 2239, CI-3 and CI-8. TEST-RUNNER of the REQ-113 run proved them not caused by REQ-113 (the test file, `tools/package.json` and `.github` are byte-identical to the base tag), and the cost was still paid: REQ-113 has no green `check.yml` on its sha, and the `check.yml` half of its criterion 13 stays open.
- Почему это плохо: an unfinished gate step of one run turns the common check red for every other run that shares the line; each of the other runs then needs a proof «not from this work» before it can be believed, and the red check itself does not name the run that owns the cause.
- Как правильно: the unfinished gate steps of an open run are listed in `docs/program/public-v1/PROGRESS.md` («Now» and «Next step») with the test that is out of step with the code, so that nobody builds on the line before the step is done; a run is not left PENDING in a commit (AP-172); a change of a value that a test pins (here the Node floor) is committed together with the test fix or after it, never alone.
- Где найдено: the first run of the head on GitHub: check run 45061034491 (`not ok` 1446 CI-3 and 1451 CI-8); `handoffs/M1WORDS-20261122-02/step-09-test-runner.json` (F-1, F-2, issue NOT_FROM_THIS_WORK) and `step-11-release-validator.json` (F1, D2); `handoffs/ISS-0092-20261117-01/step-06-test-designer.json`.

### AP-174 — The raw replies and the run ids of the readers of the translation were not stored in the handoff that records them

- Что случилось: the handoff `handoffs/M1WORDS-20261122-02/step-03-ba-analyst.json` records two rounds of fresh readers for the en texts (six pairs) and two for the kk texts (two pairs), with a mark per pair, but only ORCH's reading of the replies: `agent_run_id` is null and the text says «recorded by ORCH from the replies». The en round 1 reader wrote MARK on the pair `now_closing` and withdrew it in the same reply (it found no real addition; the Russian says the same); BA-ANALYST read it as no mark and no rewrite followed. RELEASE-VALIDATOR could not check «four different reader runs» or the withdrawn mark from the file, and wrote a finding (F3) and a proposal to raise the bar (P1).
- Почему это плохо: a requirement that asks for two rounds by different fresh readers can be checked only from what the readers said and who they were; a summary of a reply cannot be read again, a withdrawn or changed mark is lost, and the validator has to trust the author of the record.
- Как правильно: the handoff that records a reader round stores each reply verbatim (or in a file named in `artifacts_out`) and the run id of each reader, and a mark that the reader withdrew is written down as a withdrawn mark with the sentence that withdrew it. P1 of RELEASE-VALIDATOR (raise the bar by this rule) is the owner's choice and is not in `docs/quality-bar.md` until he accepts it.
- Где найдено: `handoffs/M1WORDS-20261122-02/step-11-release-validator.json` (F3, P1); `handoffs/M1WORDS-20261122-02/step-03-ba-analyst.json`; AP-114 (the readers of kk are not native speakers).

### AP-175 — ORCH's answers at step 1a of the run `ISS-0092-20261117-01` added content to a design that was already written (a README sentence and a whole-sentence test), and the design gate had to fail for it

- Что случилось: after CODE-DESIGNER had written `docs/design/REQ-110-tools-node-floor.md` (step 03, 2026-11-18), ORCH recorded its step-1a answers in `decisions/0120`, and two of them added design content that the design's exact texts and test table could not carry: О4 (the README states the named limit of a hook candidate whose `--version` hangs, next to the hook's limit) and О10 (the test pins the whole sentences of README lines 157 and 207, not only that they hold the floor). The gate task did not name them as known changes, and the designer had not been asked to take them in. CODE-DESIGN-VALIDATOR failed pass 1 (step 03b, 2026-11-18T06:41:28Z) with five Medium findings, two of them these points (F3 for О10, F4 for О4: the exact README text and its row did not exist), and proposed the rule below (its issue I6). One rework step (03c) and a second gate pass (03d, PASS, 2026-11-18T07:33:08Z) followed.
- Почему это плохо: a design is the text that the developer and the test designer build from (AP-077: the exact words and the tests agree); a decision that changes the content after it, outside the design, leaves two sources that disagree, and the developer must choose between them. The gate rightly fails the design for it, so the owner's pass limit is spent on a step that ORCH could have avoided, and the run loses a day.
- Как правильно: when an ORCH answer at step 1a adds or changes design content (an exact text, a test row), ORCH returns that point to CODE-DESIGNER before the gate, or names it in the gate task as a known change (`decisions/0120` О15, accepted as a process rule). The decision text and the design are read side by side before the gate task is written. The number in `decisions/0120` («AP-164») was the next free number on 2026-11-18 and is taken by another entry; AP-175 was the next free number read by grep on 2026-11-22.
- Где найдено: `handoffs/ISS-0092-20261117-01/step-03b-code-design-validator.json` (F3, F4, issue I6); `handoffs/ISS-0092-20261117-01/step-03c-code-designer.json` (the rework); `decisions/0120` (О4, О10, О12, О14, О15); AP-077.

### AP-176 — The deploy command of the release was run in the wrong folder (the export root, not its app folder) and the production site answered 404 on every path for two to three minutes

- Что случилось: on 2026-11-22 the release of REQ-113 deployed to the production alias `https://sai-team.vercel.app` from an export of `dd54f43`. The recorded method said "from an export of the commit" and did not name the folder in which the deploy command runs; the first `vercel deploy --prod` was started in the export root, one level above `app/`. The upload held 121 files instead of 63 (the `.vercelignore` of `app/` was not read), the build ran no install and no `vercel-build` and produced an empty output ("Build Completed", "Skipping cache upload because no files were prepared"), and the alias answered 404 NOT_FOUND on every path from about 22:13:48Z to about 22:16Z, two to three minutes at night. The smoke check caught it at once (6 of 7 failed); ORCH repeated the command inside the app folder (63 files, `vercel-build` ran) and the smoke check passed 7 of 7 with version `dd54f43`.
- Почему это плохо: a deploy to the production alias has no safe window: a build that succeeds with an empty output replaces the working site at once, and the platform does not say that anything is wrong; the visitor sees a 404 on the whole site. The only protection was the smoke check, which stood after the deploy, not before it. A method that names the artifact ("an export of the commit") but not the working folder of the command can be read in two ways, and the wrong reading costs the site.
- Как правильно: the deploy command runs INSIDE the app folder of the export (`cd <export>/app`, where `vercel.json` and `.vercelignore` are), never in the folder that holds it; before the command is confirmed the person reads the working folder; after it the first thing to read is the line of the upload ("Downloading 63 deployment files": 63 is the allowlisted set, 121 is wrong) and the smoke check, before anything else; on a wrong count or a failed smoke check the same command is repeated at once in the right folder (or the previous production deployment is promoted back). The runbook `docs/runbooks/release.md` (section 1) says so since 2026-11-22.
- Где найдено: the smoke check of ORCH right after the first deploy command of the release of REQ-113, 2026-11-22; `docs/uat/M1WORDS-20261122-02-prod.md` (finding I-1) and `handoffs/M1WORDS-20261122-02/step-13-release-validator-postdeploy.json`; `docs/releases/M1STATUS-20261122-02.md`; `docs/runbooks/release.md`.

### AP-177 — A protection that depends on the operating system fell back silently to «pass» where it cannot work, and no requirement named the platforms the tools run on (adds to AP-078)

- Что случилось: the audit AUD-002 found that the team engine and Pixel Office ran on Windows without a guard (defect ISS-0132, HIGH). Every protection in them rested on a POSIX mechanism whose failure on win32 looks like success: a group signal `process.kill(-pid)` whose error ESRCH was read as «the group is gone» (the probe: `stopGroup` returned «gone» after 0 ms while the child lived, so a timeout or a cancel did not end a real run); `getuid` absent was read as «the owner is me»; `O_NOFOLLOW ?? 0` opened a file without the flag; a `chmod 0700` was never read back (the folder read 666 and the program printed «rights narrowed to 0700»). The supported platforms were named in no requirement and every check ran on one operating system, so no test could see it (ISSUE-FIXER of the run `ISS-0132-20261123-01`, step 01, I8; the same cause as AP-078, the tests never ran on the target platform).
- Почему это плохо: a protection that cannot work but reports success is worse than none: the owner trusts a stop that does not stop (a real run costs money, gate G2) and a folder that is not private. The fallback to «pass» is silent by construction, so neither a review of the code on the platform where it works nor a green check on that platform shows it; only a run on the other platform or a read-back of the protection does.
- Как правильно: name the run hosts in the requirement (the allow-list, here Linux and macOS in REQ-110 criteria 12-19); refuse every other host at the entry of each script and again inside the protected operation (here `check()` and `run()` of `claude-cli`), fail closed; after setting a protection read it back and refuse when it did not take (here `ensureHome` and `ensureStateDir`); for a code path that cannot work on a platform, keep the refusal first and record that as the reason, not the path as a fix (ISS-0146, `proc.js`). A mode, an owner or a group that a platform cannot keep is never reported as set.
- Где найдено: `handoffs/ISS-0132-20261123-01/step-01-issue-fixer.json` (I8, with the probes); confirmed by `handoffs/ISS-0132-20261123-01/step-09-release-validator.json` (the original error on the tag, gone on the fix); `docs/issues/ISS-0132-windows-is-not-guarded-as-a-run-host.md`; AP-078, AP-012.
