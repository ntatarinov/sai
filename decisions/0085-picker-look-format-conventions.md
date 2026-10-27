# 0085 — Conventions of the tenant look format (REQ-069): the design choices and the answers to its four questions

Status: **accepted** (ORCH, 2026-10-26, run `LOOK069-20261026-01`, step 1a of WF-02; the owner may cancel).

## Question

The design `docs/design/REQ-069-tenant-look-format.md` made seventeen design choices (D1–D17) and left four questions to ORCH (O1–O4). Which are accepted?

## Decision

1. **D1–D17 are accepted** as written in sections 0–18 of the design (format /3 = /2 plus `look`; no new error code; one shared pure module `public/tenant-look.js` without `texts.js` keys; fallback roles `null` per `0084` item 17; `shape.js` and `v3-check.js`; colours lower-case `#rrggbb`; closed catalogue of 15 object ids; the same fields in a /1 or /2 file stay `E_FIELD`).
2. **O1, the staff name.** A staff name is letters, combining marks, digits, space, hyphen, apostrophe and dot, 1–30 characters (error `E_FIELD` otherwise). Criterion 3 of REQ-069 is amended to say so (the criterion demanded an error for `url(http://x)` which the old description would have accepted).
3. **O2, `object` on options.** Accepted on options of **single and multiple** questions only (a number question has no options in any format). The phrase "any of the three types" in criterion 3 is amended.
4. **O3, the sheet constants.** The contrast of an accent colour against the sheet of its theme must be at least 3.0 : 1, with the sheet constants of the released page style (`#f3f5f9` light, `#161f2e` dark). Consequence: the accents of the approved sample do not pass (`#e0731f` 2.90 : 1 on light, `#5b3fd6` 2.46 : 1 on dark); REQ-070 must use a darker light accent and a lighter dark accent, which it records as a note of the sample's colour correction. Nothing else of the approved look changes.
5. **O4, QS-12.** The guard QS-12 is widened now to all `picker-*.js` test files (at least 25), so the new `picker-look*` files are covered.
6. The two entries for the mistakes log proposed by the design (a criterion that demands an error for input the description accepts; a sample file named with a word that `show()` hides) are recorded by DOC-UPDATER at the end of the run.
7. **F4 of the design gate (the look for the board).** The server-side public data gets a second call next to `lookOfView`: one that returns the tenant's own look or `null` for a /1 or /2 file (what REQ-077 requires for `api/tenants` and the board data); the board page builds the fallback look itself with the shared module (`fallbackLook`). `lookOfView` (never null, with the fallback) is for the tenant's own public page and the progress look of REQ-065 and REQ-066; REQ-078 does not call `lookOfView`.
8. **О5.** A staff name with no letter or digit (for example one dot) is accepted, as the criterion defines the name by a character class only; requiring a letter would be a later micro-amendment, not now. The second public call of item 7 is named `ownLookOfView`.
9. **One extra rework of the design after the third FAIL of the design gate** (the owner's allowance, 2026-10-26, answer «Одна правка и перечитать (Рекомендую)»): the remaining blocking finding N1 (the rule for the chips range prints a line with the word `null`) is fixed by returning to «the chips range is checked only when both ends of the question are valid integers; otherwise only the integer form of each item», together with the cheap Low items N2–N7, and CODE-DESIGN-VALIDATOR re-reads only those places. It is not a general rule and does not raise the limit of three passes (as `decisions/0081` and `0084` section 6).
10. **P2 (min not less than max).** The behaviour measured in the design sketch and built stays: the question's own line plus the chips range lines against the inverted range; the tests pin it. Skipping the chips range in that case is a possible later cleanup (follow-up list), not now.

## Why

The criteria must be met by the code and by the description together; a criterion that cannot hold would fail at the release gate.

## Boundary

Changes no code by itself. Items 2, 3 and 4 need a micro-amendment of REQ-069 and REQ-070 (WF-01 section "Micro-amendment after the code design"), done in run `MA069-20261026-01` before the design is checked.

## Basis

`docs/design/REQ-069-tenant-look-format.md` (sections 0–18, questions O1–O4), `handoffs/LOOK069-20261026-01/step-01-code-designer.json`, `decisions/0084`.
