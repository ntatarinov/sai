# 0092 — Publication on Vercel, closed first; the deploy path

Status: **accepted** (ORCH, 2026-10-28, on the owner's words of 2026-10-27 in `docs/owner-requests/2026-10-27-public-launch-plan.md` and the launch line; the owner may cancel any item).

## Question

How and when may the product in `app/` go onto the internet, and who may deploy it?

## Options

- A (chosen): closed first: Vercel Hobby during the closed test, production deploys only by RELEASE-FINALIZER from a fresh clone of the pushed sha, production starts invite-only.
- B (rejected): Git integration with automatic deploys on every push; an agent push would publish without a human check (quality bar R1 spirit) and the deployed commit is not the one that was validated.

## Decision

1. `app/` is deployed to Vercel: Hobby during the closed test, Pro before commercial use (G8).
2. Production deploys only by RELEASE-FINALIZER with the pinned Vercel CLI from a fresh clone of the pushed sha, after RELEASE-VALIDATOR PASS, the push and green CI (program plan §4.4, ARCH §19.5). Production checks are a post-deploy record, never requirement criteria. Migrations run inside the Vercel build, so no agent holds the production database URL.
3. No Git integration unless the owner chooses the alternative of ARCH §19.5.
4. On Hobby a deployed commit must be authored by the owner of the Vercel team: the author e-mail is compared with the one recorded at G3, and agents never change the git identity.
5. Production starts closed (landing, onboarding and demo public; invite-only; test banner; noindex) until «открывай» (G10). The first URL needs the owner's yes when created (decision 0068 item 2; G4).
6. "Published" is said only after the outside smoke and the owner's own check.
7. Rollback is `vercel rollback`; the kill switch is in the admin console from M4. An emergency `SITE_GATE=closed` takes effect only with a redeploy of the current production deployment (`vercel redeploy`), allowed as an emergency action without a code change, the owner informed.
8. The owner's Pixel Office, the picker server and the team web are never deployed.

## Why

The owner asked for a public product on Vercel; the order "closed first, opened by his word" keeps the legal, cost and Anthropic-terms gates (program plan §3) in his hands.

## Boundary

No publication beyond this record; no money beyond the owner gates. Narrows, for `app/` only, the no-publication lines of decisions 0065, 0068 item 2, 0069 item 9, 0072 item 5 and the boundaries of 0073, 0079 («не разрешает … публикации в интернет»), 0088 and 0089. The run limit of decision 0048 is replaced by the owner's answer to G2.

## Basis

`docs/owner-requests/2026-10-27-public-launch-plan.md`; `docs/program/public-v1/ARCHITECTURE.md` §19; program plan §3, §4.4; decisions 0048, 0062, 0068, 0079, 0091.
