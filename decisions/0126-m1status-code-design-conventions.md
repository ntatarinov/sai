# 0126 — Answers to the questions of the code design of REQ-113 (run M1STATUS-20261122-02, WF-02 step 1a)

Status: **accepted** (ORCH's role, held by the session that leads the program, decisions/0122 О1; the owner can cancel each
point).

## Question

CODE-DESIGNER wrote docs/design/REQ-113-visitor-status.md (handoffs/M1STATUS-20261122-02/step-01c-code-designer.json) by
REQ-113, the look description (docs/design/V1-public-look.md, section 7.22) and decisions/0125, and left eleven questions
О1–О11 and a proposal О12 that only ORCH can answer, each with a default (section 15 of the design). WF-02 step 1a: ORCH
answers them in a record before gate 1b.

## Options

(a) The designer's defaults, each measured on a trial copy of `app/` outside the project (120 loads, 0 layout findings,
block top edge 557 px at 390×844). (b) The alternatives named in the design. (c) Ask the owner: none of the points changes
what he sees beyond what the owner's «Делай» and the later «похоже» already cover.

## Decision

The designer's defaults, each as the design states it:

- **О1** accepted: on a no-match result at 1000 px and narrower the block stands under the fixed list, above the button;
  no amendment of REQ-111 criterion 12.
- **О2** the block heading stays `h3`.
- **О3** the names `demo_accuracy_note`, `how_stage_1_note`, `now`, `stat`, `stat-line`, `pair`, `r-side` and the
  479 px breakpoint are confirmed, with the scoping rule (no bare `.now`: `.plate.now` exists on the scene).
- **О4** «4 из 5» stays for 4.5 answers (decisions/0125 item 5); LD-6 asserts k = 4 with a half pip.
- **О5** a short GUI-DESIGN-ANALYST rework step (01d) corrects the stale lines of the look (D20, the section 14 row,
  the 7.12 label line) before gate 1b, so the gate and DESIGN-QA-VALIDATOR read one measure.
- **О6** the requirement holds: DESIGN-QA-VALIDATOR runs at step 7 against the look description, and UAT-RUNNER at step 8
  as well.
- **О7** two new unit tests TX-9 and TX-10 (unit 120 → 122 expected; the other counts unchanged).
- **О8** the stand for step 8 is a fresh clone outside the project (`core.autocrlf=false`), `npm ci` there, the server on
  a free port. The check commands themselves still run only on GitHub in Linux.
- **О9** validators may use either tag (`-01` or `-02`): `app`, `tools` and `.github` are identical between them.
- **О10** the kk values are drafts for the reader rounds; disputed lines go to the FOR_NATIVE_SPEAKER list (kk stays
  hidden, G9).
- **О11** LD-6 resizes the window and switches the colour scheme on a live result page; if CI shows a flake caused by
  the resize, the cell is loaded anew (no weakening).
- **О12** this record.

## Basis (Q12)

Each default rests on the trial of the design and on the released text of REQ-111/REQ-112, which it does not weaken.
The owner can still cancel any point; none of them is irreversible.
