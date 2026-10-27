# 0087 — The corrections of the independent reader in REQ-070: where they are recorded

Status: **accepted** (ORCH, 2026-10-27, run `DEMO070-20261027-01`, step 8 of WF-02; the owner may cancel).

## Question

Criterion 5 of REQ-070 demands that every "no" of the independent reader of the Kazakh and English texts is corrected in the file and checked again. The design (DT-2c) compares the ru, kk and en texts of the mapped paths with the sample, allowing only the six rows of the table of edits (criterion 2: ru texts equal to the sample). The first pass of the readers gave 15 "no" (kk) and 25 "no" (en), most on texts that come from the sample. A correction of a kk or en text of the sample would turn DT-2c red, and putting 40 rows into the table of edits would break its limit of six.

## Decision

1. The table of edits (at most six rows) stays as it is and holds the edits of the ru texts, and of the kk and en texts of the same paths (E1–E3). It is not used for the corrections of the reader.
2. The corrections of the reader are a **separate table** in the test file `picker-demo-v3.test.js`: path, the sample text, the corrected text, the number of the pair of the reader's table. DT-2c compares the kk and en texts of the mapped paths with the sample, except the paths of this table, where the file must equal the corrected text word for word. ru texts are never corrected by the reader and stay equal to the sample except E1–E3.
3. A correction may only change the wording of the kk or en text: the numbers, the names of products and the meaning stay. The correction is accepted when the same reader method (a new launch, only the pairs) gives "yes" for the corrected pair. Three passes at most for a pair; a third "no" is a question to the owner.
4. The corrections go in by BACKEND-DEV (the data), the table in the test goes in by TEST-DESIGNER; the gate of the tests (TEST-DESIGN-VALIDATOR) reads the change as a limited second pass.
5. The currency sign is written as «₸» in all places of both files (two places used «KZT» in en).
6. **One-time extra pass (owner's word, 2026-10-27).** The English heading of pair 153 («Автоответ в мессенджере») got "no" at all three passes. The owner allowed one extra correction («Messenger auto-reply» or the best wording) and one re-read of this pair only. This is not a general rule; a fourth "no" for any pair is again a question to the owner.

## Why

Criterion 5 asks for the fix; the limit of six rows protects the texts from silent change. A separate and literal table keeps both: every changed text is named and pinned.

## Boundary

Does not change criterion 2 for ru. Does not change the format or the check. Does not mean that the Kazakh is checked by a native speaker: that is still not needed for the release (decisions/0072, item 2).
