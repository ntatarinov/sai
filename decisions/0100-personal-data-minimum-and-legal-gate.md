# 0100 — Personal data minimum and the legal gate (closed test)

Status: **accepted** (ORCH, 2026-10-28, on the launch line of `docs/owner-requests/2026-10-27-public-launch-plan.md`; the owner may cancel any item). Item 6 waits for the owner's approval of the documents.

## Question

Which personal data may the product store, and who may register, while the legal question about storing Kazakh citizens' data abroad is open?

## Options

- A (chosen): minimum data, only the owner's own identities on production until he answers G7.
- B (rejected): invite other testers now; the lawyer has not confirmed storage abroad.

## Decision

1. Stored personal data: e-mail, display name, password hash, consent record, HMAC of IP addresses for rate limits (24 h). Users are asked not to put personal data into ideas.
2. Until the owner answers G7, production holds only his own identities (`users.is_owner_identity`).
3. Vercel and Neon have no Kazakhstan region; storing Kazakh citizens' data there may conflict with Law 94-V art. 12(2). This is not solved; the compliance path is the move of M9; it is never claimed solved. The site says «Данные хранятся за рубежом (Германия, Франкфурт); тексты для ИИ обрабатывает Anthropic (за рубежом).»
4. The consent names purpose, data list, period and cross-border transfer (art. 8, 16). Notification (art. 10-1) and policy documents (art. 25(2)), duties in force since 2026-08-25 (**verify** with the lawyer), are prepared for the lawyer.
5. An account and its data are deleted on request within 15 working days (admin action, audited).
6. Policy, consent and terms stay drafts until the owner approves them.

## Why

A closed test with only the owner's identities lets the chain be built and proved without storing other people's data before a lawyer answers.

## Boundary

No legal opinion is given or implied. Never log request bodies, e-mails, tokens or clear IP addresses. The quality bar is unchanged.

## Basis

`docs/program/public-v1/ARCHITECTURE.md` §14; program plan §3 (G7, G10), §7 (R4); Law 94-V as cited there.
