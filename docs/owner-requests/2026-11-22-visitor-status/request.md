# Owner request 2026-11-22: the visitor must see what works now and when the product comes

## Owner's words (verbatim, session 4 on the Windows PC, Russian)

1. After walking through the demo survey to its end: «Я прошел до конца, что дальше делать?»
2. Later, asking what he must do and what he gets at the end of the survey: «посмотри скриншот, что я должен делать и что я получу в конце опроса?»
3. The request for this work: «прогони агентов по дизайну и логики, а то не понятно когда пользователь получит продукт»
4. The go-ahead after the two review agents reported and ORCH proposed a new requirement (REQ-113) with the full cycle: «Делай»

## What the two read-only reviews found (2026-11-22)

The full notes are in this folder: `review-logic.ru.md` (the visitor's path, honesty, gaps) and `review-design.ru.md` (the design of the fix). They are working notes in Russian; the facts below are the part the requirement stands on.

- Only M1 is released (landing, how page, demo of five questions). Accounts, the interview, the ТЗ, the build and the delivery of results (M2–M4, M8) do not exist. The public site shows no date and has no form, login or contact. There is no waiting list in the plan.
- In test mode only invited participants describe ideas, and the result is received only by the owner of Sai (PLAN.md D18; delivery to customers is M8 behind G11).
- The how page describes the whole path (interview, ТЗ, approval, build, office, accept the result) in the present tense, without a status.
- The main button of the demo result, «Описать идею», leads to a paragraph on `how.html#describe-idea`; the only caveat is a 14 px grey line under it.
- «Принято» (stage 1) reads as «the order is accepted» while the banner says orders are not accepted.
- «Точность подбора 5 из 5» is really the number of answers counted («Не знаю» counts as half), but reads as a quality guarantee.

## What the owner gets from this work (the wanted result)

A visitor who finishes the demo, or opens the how page, sees in plain words at once: what works now (the demo survey), what does not exist yet (the interview and ТЗ, the build and the result), that there is no launch date, that only invited participants will describe ideas, and that finished products are not handed out to visitors yet. No date is invented and no contact form or invitation channel is promised, because none exists.

## Decisions already made by ORCH (change only by the owner)

- One status block «Что работает сейчас» (ru) / «What works now» (en) on the demo result (above the «Описать идею» panel) and on `how.html` (between the intro and the steps). Same markup, same words in both places.
- Two status marks only: «Работает» and «Пока нет» (en: «Works», «Not yet»). No «По приглашению» and no «Скоро»: both are untrue or hint at a date today.
- The words «срока», «день», «дней», «минут», «цена», «бесплатно», «гарантия», «100 %» are forbidden by the public word lists: use «Даты запуска пока нет».
- The label of the button stays «Описать идею» (it is fixed by REQ-111 and the TX-4 test). The lead above it becomes honest; the 14 px grey line under it goes away (its meaning moves into the block).
- «Точность подбора» becomes «Учтено ответов» (en: «Answers counted») with one explaining sentence inside the receipt.
- The banner text with «заказы не принимаются», the stage name «Принято» and the stage buttons stay as they are; the how-page stages get status marks beside the stage text, not inside the buttons.
- kk stays hidden (G9); its texts follow the same pattern as drafts.
- This changes released requirements REQ-111/REQ-112 only through a micro-amendment recorded as in ISS-0126/ISS-0128; the new work is REQ-113.

## Out of scope

Any way to leave a contact, a waiting list, invitations, the real «Новый проект» flow (M2), real dates, delivery to customers (M8), kk review by a native speaker (ISS-0127).
