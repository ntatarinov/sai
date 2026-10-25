# WF-04 — Interface by sample

How Sai makes a screen from a sample — a screenshot or reference code: one agent describes the
interface so precisely that it can be built without guessing, another builds it, and a third
compares the finished page with the sample. The last word on the likeness belongs to the
owner.

WF-04 is the interface lane inside development: the code written by FRONTEND-DEV passes all
the gates of WF-02 (review, tests, the final check). WF-04 adds to them the interface
description at the start and the comparison with the sample at the end.

All roles follow `docs/quality-bar.md`; handoffs follow `docs/workflows/handoffs.md`.

## When it starts

- A requirement changes what a person sees, and the change has a sample: the owner's
  screenshot or another sample that lies in the Sai files (for example, a snapshot of a page
  in `docs/design/samples/`).
- The requirement has already passed WF-01. If it first has to be corrected because of the
  sample, WF-01 goes first: the edit of the requirement → the check of the requirement.
- Without a sample, the interface is made by development (WF-02); the interface description is
  then written by GUI-DESIGN-ANALYST, it serves as the measure, the comparison with the sample
  (step 4) is not done, and the acceptance goes in a real browser (WF-02, step 8;
  `decisions/0079`, item 13).

## Roles

| Role | What it does | Who checks |
|---|---|---|
| ORCH | Saves the sample in the Sai files, leads the run, shows the result to the owner | — |
| GUI-DESIGN-ANALYST | The interface description from the sample: areas, elements, order, states | CODE-DESIGN-VALIDATOR |
| CODE-DESIGNER | The code design, if logic stands behind the interface (data, server) | CODE-DESIGN-VALIDATOR |
| FRONTEND-DEV | Builds the page by the checked description | the WF-02 gates: SECURITY-REVIEWER (always; whether its area is touched is decided by it) and REVIEWER at the same time, the tests |
| DESIGN-QA-VALIDATOR | Runs the page, takes snapshots of it and compares it with the sample and the description | — (a checker itself) |
| CODE-FIXER | Fixes by the findings of the comparison | again SECURITY-REVIEWER and REVIEWER, then a check run and again DESIGN-QA-VALIDATOR |
| Owner | Approves the sample; confirms that the finished page looks like it | — |

## Steps

**Step 0 — ORCH saves the sample.** A screenshot is put in `docs/design/samples/` (for
example, `docs/design/samples/REQ-NNN-<short>.png`); another sample is named by a path inside
Sai. A sample that is not in the Sai files is not acceptable: the checker must open it
itself. ORCH records which sample the owner approved and when.

**Step 1 — GUI-DESIGN-ANALYST writes the interface description**
`docs/design/REQ-NNN-<short>-ui.md`:

- the scheme of the screen: which areas there are (header, list, log, panel) and how they are
  placed;
- for each area — which elements, in which order, which labels and which data they show (from
  which field and which event);
- the states: empty, loading, error, no connection, a lot of data;
- sizes and behavior in the windows 1470 × 784, 390 × 844 and 320 × 568, in the light and dark
  themes, in the languages of the page;
- colors, fonts and spacing — as named values, without "as in the picture";
- what from the sample is **not carried over** and why. For example: in the Pixel Office
  reference the movements and the lines were invented, while here the page shows only what
  follows from the real hook events (R2) — such places are marked "not carried over";
- for each criterion of the requirement — which part of the description meets it.

Nothing is left "to the developer's taste": if the description does not decide how a place
looks, that is a gap. There is no code in the description. The description does not invent
business logic: if the requirement is unclear, that is a question in `result.issues`, not a
guess.

**Step 1b — CODE-DESIGN-VALIDATOR, gate.** Opens the sample and the description itself and
checks: every visible part of the sample is either described or marked "not carried over" with
a reason; every criterion of the requirement is covered; the states are described; there are
no places "to the developer's taste"; nothing breaks R2 (for Pixel Office) and the other items
of the bar; there is no code. Any item not passed is a FAIL. If logic stands behind the
interface, the design of CODE-DESIGNER is checked together with it (WF-02, step 1b).

**Step 2 — FRONTEND-DEV builds** by the checked description, only in its own files. After that
the code goes through the WF-02 gates: steps 3–6 (SECURITY-REVIEWER — always, whether its area
is touched is decided by it — and the review at the same time; the tests and their check; the
check run). FRONTEND-DEV builds the page in sub-steps of the design and after each one looks at
it live in a real Chrome without a window.

**Step 3 — preparation for the comparison.** ORCH makes sure that the page can be run
separately from the working instance: its own port, its own state folder, its own test data or
events. For Pixel Office — `npm run pixel-office -- --port <free port> --dir <absolute path
outside the project>` from `tools/` (the keys are described in `tools/README.md`). Events made
up for the check are written only in this separate directory outside the project and never in
the owner's working log: the server marks every accepted event as real (R2).

**Step 4 — DESIGN-QA-VALIDATOR, gate.** The checker walks through the running page area by
area — the way the owner will look at it — and for each area records whether it matches the
interface description. The measure is the description; the sample serves as a map.

1. **No run, no verdict.** The page did not start separately from the working instance, or
   there is nothing to take its snapshot with — this is a block with a named reason, not a
   PASS and not "looks about right".
2. **The map of the walk.** The checker itself opens the sample and the description (not a
   retelling in the handoff or in the report of FRONTEND-DEV) and writes out the areas of the
   sample in the order of the description — for the Pixel Office office this is the header with
   the connection block, the office with characters and bubbles, the board, the role legend,
   the log — and with them the states from the description (empty, loading, error, no
   connection, a lot of data), the three windows 1470 × 784, 390 × 844 and 320 × 568, the light and
   dark themes and the languages of the page.
3. **Snapshots by the map.** For each combination "state × window × theme" that can be
   obtained — a snapshot with a tool that is in the environment; the report gives what was used,
   the command, the address, the window size. The snapshots lie outside the project or in
   `docs/design/samples/` with `actual` in the name. A state that could not be obtained stays
   in the map with the mark "not checked" and the reason.
4. **The walk by a table and the tolerance.** For each area of the map — a row:

   | Area | What must be there (item of the description) | What is seen (snapshot) | Conclusion |
   |---|---|---|---|
   | role legend | each role with its own color (the description section «Легенда», "Legend") | the last two roles are cut off | finding High |

   In "what must be there" — the composition and order of elements, labels, where the data
   comes from (fields and events), named colors, fonts, sizes and spacing, behavior in a narrow
   window and the "not carried over" places (in Pixel Office — the invented movements and lines
   of the reference, R2). **The tolerance is set by the description:** what it names as a value
   is compared with the value; what the description does not name — how the system draws fonts,
   the scroll bar, system elements — is not compared, and is never a finding. If the checker
   thinks that the description should have named such a place, that is a question to the
   description in `result.issues`.
5. **The weight of a finding — by what the owner will get when looking at the page:**
   - **Critical — the page cannot be used or it deceives:** it shows what was not in the events
     (R2), a whole area is gone (no log), a random color instead of the named one;
   - **High — the page cannot be understood:** the legend is cut off and the color of a role
     cannot be read, bubbles overlap and the text is not readable, a needed state is missing
     (a connection break is not shown — the owner thinks that all is going well), a wrong
     element or a wrong order, a narrow window behaves not as described;
   - **Medium — unpleasant but works:** a spacing, an alignment, a line wrap not as in the
     description, while the meaning and the order are intact;
   - **Low — a trifle** that only one who compares with the description will notice.

   A difference in composition, order, state or a named color is not lower than High, even if
   it does not get in the way of looking.
6. **The verdict.** There is a Critical or High finding — FAIL. This is the own threshold of
   WF-04: Medium and Low do not block, but they are recorded and go to the owner at step 6. On
   FAIL the checker says what is wrong: the implementation — the findings go to CODE-FIXER
   (step 5); the description itself — a question in `result.issues`, and ORCH returns the work
   to step 1.

DESIGN-QA-VALIDATOR fixes nothing: it runs, takes snapshots and compares.

**Step 5 — after a FAIL:** CODE-FIXER fixes only the named findings → SECURITY-REVIEWER and
REVIEWER (WF-02, steps 3–4) → one check command (WF-02, step 6) → step 4 again. An edit of
code that has already passed review does not go into the tests and the comparison without a new
review.

**Step 6 — the owner.** ORCH shows the owner the snapshot next to the sample and the list of
differences that remain knowingly (for example, "not carried over" because of R2). Until the
owner confirms the likeness, the work is not considered done.

**Step 7 — then by WF-02:** acceptance (if needed), RELEASE-VALIDATOR, DOC-UPDATER,
RELEASE-FINALIZER.

## Gates

Step 1b (the description), the WF-02 gates for the code (steps 3–6), step 4 (the comparison
with the sample), step 6 (the owner's confirmation) and the final check of WF-02.

## Artifacts

| Step | Who | What |
|---|---|---|
| 0 | ORCH | the sample in `docs/design/samples/` or another path inside Sai |
| 1 | GUI-DESIGN-ANALYST | `docs/design/REQ-NNN-<short>-ui.md` |
| 2 | FRONTEND-DEV | the code of the page |
| 4 | DESIGN-QA-VALIDATOR | snapshots, findings and the verdict — in `result` |
| 6 | ORCH | the report to the owner with the snapshot next to the sample |

## Handoffs

- `workflow_id`: `"WF-04"` if the run is only about the interface; if the interface is part of
  a large development, the workflow of the run is `"WF-02"`, and the WF-04 steps go as its
  steps.
- File names, serial numbers of steps and the form of rework steps (the next letter of the
  step) — see `docs/workflows/handoffs.md`; the WF-02 steps go by WF-02.

## Rework loop

- The description (step 1b) — no more than **three passes** of the gate: the first and two
  repeats after a FAIL (`decisions/0079`, item 4).
- The comparison (step 4) — no more than **three passes** of "CODE-FIXER → review → check run →
  comparison"; the third FAIL is a stop and a report to the owner.
- The same finding came back — the next attempt changes the approach.
- The owner said "does not look like it" — their words go verbatim into the task of the next
  round; if they change the requirement, WF-01 first.

## Stop conditions

- **Done:** PASS of step 4, the owner confirmed the likeness, then WF-02 to the end.
- **Stopped:** the limit of gate passes is used up; the sample contradicts the bar (for
  example, demands invented events — R2) — such a place is not carried over, and if it cannot
  be done without it, a question to the owner; there is nothing to run or take snapshots of the
  page with — a block with a named reason.

## Report to the owner

A snapshot of the finished page next to the sample; what is done the same way, what is done
differently and why (especially the "not carried over" places); how to open the page yourself
(a command and a link); what is needed from the owner — to confirm the likeness or to say what
is wrong.
