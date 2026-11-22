# 0125 — The status block of the public site (REQ-113; run M1STATUS-20261122-01, WF-01 step 3)

Status: **accepted** (ORCH's role, held by the session that leads the program, decisions/0122 О1; the owner can cancel each
point).

## Question

The owner could not tell when a visitor gets the product (chat 2026-11-22, words in
docs/owner-requests/2026-11-22-visitor-status/request.md). Two read-only reviews (logic and design) found that the public
site shows the whole path in the present tense and never says what works now. REQ-113 was written
(handoffs/M1STATUS-20261122-01/step-01-req-analyst.json, rework step-01b) and passed the gate on pass 2 of 3
(step-02b, PASS; pass 1 FAIL with F1 Medium). The gate and the author left questions that only ORCH can answer.

## Decision

1. **The owner's «Делай» covers the whole cycle**, including a fresh look release: criterion 11 keeps the owner's «похоже»
   (G21 reads «each look release»).
2. **The marks «Работает» and «Пока нет» are not the «status of any project»** that decision 0083 item 7, decision 0097
   item 1 and REQ-112 forbid on the stage scene. They say which parts of the site work, not how far a customer's project
   has come; they sit beside the stage text on the how page and in the block, never on the scene.
3. **Two marks only.** «По приглашению» and «Скоро» are not used: there are no invitations or login today, and «Скоро»
   hints at a date. No date, no contact form and no invitation channel is promised, because none exists (the plan has no
   waiting list; a contact channel would be a separate owner decision).
4. **The explaining notes are body text**, not small grey print: the owner's complaint was exactly that the only caveat
   was the 14 px grey line.
5. **«Учтено ответов 4 из 5» next to «„Не знаю“ считается за половину»** (gate remark N1, Medium, not blocking): the number
   shows the whole part of 4.5 (demo.js writes `Math.floor`), the half is in the pips only. Accepted for this release:
   the number understates and never overstates. The code design may propose showing the half in the text; that is a
   change of criterion 5 by a micro-amendment, not a free change in code. Recorded so that the owner sees it at the look
   release.
6. **Remaining gate remarks N2–N6 (Low)** go to the next steps: the code design confirms the key names (F5) and the order
   of `how_plan_note` against the steps, the test loop accepts a missing answer, the step 9 run records the measured top
   edge of the block at 390×844.
7. **Where criteria 11 and 12 run:** a local server (`node app/server/node-main.js` on a free port) with real Chrome by
   UAT-RUNNER on this PC; the check commands run only on GitHub in Linux (the owner's rule for this PC).

## Consequences

REQ-113 is fit to be worked on and stays `pending` until WF-02 step 0. REQ-111 and REQ-112 are not edited (the gate
found no contradiction). The Russian review notes in docs/owner-requests/2026-11-22-visitor-status/ are working notes;
the requirement is the contract.
