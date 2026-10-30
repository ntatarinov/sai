# 0083 — The picker site is a tenant's pixel office: one-tap answers, a live result, four desks as the four request stages

Status: **accepted** (by the owner's word «да», 2026-10-26, in the session, after he opened the third mockup; recorded by ORCH).

## Question

The owner rejected two "enterprise" mockups as an ordinary template and asked for a different UX: multi-tenancy must stay, the Pixel Office must be visible to the visitor, and there must be the fewest movements and the most result for the visitor. The third mockup was opened and accepted as the direction.

## Decision

The approved sample is `docs/design/samples/picker-v3-approved-2026-10-26/` (source and 8 snapshots; the full set of snapshots stays outside the repository). What is accepted:

1. **The site is the tenant's pixel office.** Four desks are the four request stages (reception, documents, specification, ready). The visitor is a small character with the mark "Вы". The employee at the right desk asks the question.
2. **One tap per answer.** A big card advances by itself; no "Next" button; "Back" and "I do not know" are one tap; at most 6 questions in the demo flow; the full keyboard path works.
3. **The result is live.** A panel under the question shows what is included, a price range in tenge that narrows with each answer, effort in days, the fit, and the button "Enough, show the result" at any time.
4. **The request needs one field** (a phone, or a one-tap WhatsApp/Telegram message); after sending, the visitor lands on "My request": the same office with four stage desks, the current one lit, a private link.
5. **Multi-tenant by data.** The name on the door, colours, industry objects, questions and offers come from the tenant's data; no fixed product name; the platform appears only as a quiet line "Работает на платформе Sai". The tenant file format gets a look section (a new format version).
6. **The operator board** is a compact board of requests by the four stages with the tenant's office strip on top.
7. **The visitor sees only his own answers and the four stages**, never real events of agents, logs, code or task texts (`decisions/0073`, `0074` stay in force). Showing the real work of agents live is not accepted.
8. Kazakhstan formats (date 26.10.2026, Astana time, 1 250 000 ₸ with thin spaces); three interface languages; Kazakh needs a native speaker before publication.
9. The mockup is a sample, not code: prices, tenants, texts and applications in it are invented; Kazakh is a draft.

## Boundary

This decision accepts the direction and the sample. It does not by itself change a requirement or code: that is done by WF-01 (requirements) and WF-02/WF-04 (design and build). The logic of REQ-054…056 (tenant file, engine, server) stays; REQ-057 gets a new look and flow; REQ-058, 059, 064–067 are aligned to the sample; the operator board and the tenant look section are new.

## Why

Two earlier mockups looked like a generic template. The owner wants a product with its own memorable idea that also works with few movements.

## Basis

The owner's messages in the session (the rejection of the enterprise style; the three hard conditions; «да»), the sample folder above, `decisions/0073`, `0074`, `0082`.

Narrowed by decisions/0091 and decisions/0097 (2026-10-28): item 7 stays for public pages; the private project office of 0097 shows a safe projection of real events to users with a `view` grant.
