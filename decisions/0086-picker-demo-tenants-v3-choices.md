# 0086 — The two demo tenants of the form /3 (REQ-070): answers to the four questions of the design

Status: **accepted** (ORCH, 2026-10-27, run `DEMO070-20261027-01`, step 1a of WF-02; the owner may cancel).

## Question

The design `docs/design/REQ-070-demo-tenants-v3.md` leaves four questions to ORCH (I1–I4). Which defaults are accepted?

## Decision

1. **I1, the reason of a text edit.** The two roles of the second tenant (desks 1 and 4) are word for word the same as the roles of the first tenant in the approved sample, and criterion 4 forbids a text shared by the two files. They are rewritten, and the reason of such a row in the table of edits is `SEP` (criterion 4), not a code of the check. Criterion 2 is amended in a micro-amendment (run `MA070-20261027-01`): "the reason of each row is a code of the check, or `SEP` when criterion 4 forces the edit". Nothing is weakened: the table stays at six rows at most, and every row still needs a reason.
2. **I2, counts.** The block has seven criteria; where a text says six, the amendment corrects it. The new test file is `tools/test/picker-demo-v3.test.js` (no `picker-demo*.test.js` exists).
3. **I3, who writes the test file.** TEST-DESIGNER at step 5 of WF-02, as the workflow says. BACKEND-DEV writes the data and the paragraph of `tools/README.md` (sub-steps 70a–70d of the design).
4. **I4, the `figure` ids.** Accepted: `f01`–`f04` for the first tenant and `f05`–`f08` for the second. REQ-071 draws them; changing a value later is a one-line edit of the data.
5. The option id `none` is used by both tenants in the sample; it becomes `nowhere` (first tenant) and `nothing` (second tenant), as the design says, and the table of id renames in the test lists it.
6. The replacement colours are the design's: the rule is tested (same hue within 2°, contrast between 3.0 and 3.4 : 1), the values `#d76e1e` and `#6d54da` are the chosen ones.

## Why

The owner asked for two tenants taken from the approved sample and for no shared text between them (Q8). Where the sample contradicts the requirement, the requirement text is made true by a recorded amendment rather than by a silent exception.

## Boundary

Does not change the engine, the format or the check (REQ-055, REQ-069). Does not change the older demo tenants.
