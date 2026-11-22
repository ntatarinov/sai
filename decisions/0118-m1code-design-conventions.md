# 0118 — Conventions of the design of M1.3 (REQ-108 app skeleton, REQ-109 Vercel readiness): answers to the open questions О1–О17

Status: **accepted** (ORCH, 2026-11-18, inside the owner's words of 2026-11-17 «Продолжи работу, так чтобы я получил готовый продукт», «Публичный сайт V1» (`decisions/0115`) and «Сначала каркас»; the owner can cancel each point).

## Question

The design `docs/design/REQ-108-109-app-skeleton.md` (section 21; `handoffs/M1CODE-20261117-01/step-01-code-designer.json`) leaves seventeen questions. Two of them (О2, О17) show criteria of REQ-108 that cannot be met as written or are met by an empty folder; they go to a short WF-01 micro-amendment run before the gate CODE-DESIGN-VALIDATOR, together with the wording points N7, N9, N10, N11 that `decisions/0116` О25 left for the first micro-amendment.

## Options

For each point the design names a default measured on its sketch (a sketch `app/` in a clone, and one GitHub run of a sketch on a temporary branch: `app.yml` run 44151782390 and `check.yml` run 44151782067, both green; the branch deleted).

## Decision

- **О1.** Accepted: the browser-test tool of `app/` is `playwright-core` (measured: the own kit refuses `localhost`, which the preview host needs; `playwright-core` 1.64.1 is one package, Apache-2.0, opens it). It is added with the first browser test of `app/` (R1.2), not in M1.3; its pin and licence go into the Addition of `decisions/0001` then. The own kit stays the tool of `tools/`.
- **О2.** Accepted, by micro-amendment of criterion 14 of REQ-108: the browser's one console line for a page answered with 404 or 503 is declared exactly (the status and the path), once per such page, as `decisions/0112` О3 and `0113` О10 declared the favicon line; no other line is allowed.
- **О3.** Accepted: `tsc` checks `app/server`, `app/api` and `app/scripts`, not `app/test`.
- **О4.** Accepted: the `pg` job starts Postgres with `docker run` (a `services:` container cannot take a password made in the run); REQ-108 names no `services:` form, so no amendment is needed.
- **О5.** Accepted: the design's module and global rules, stricter than criterion 3 lists, are built and tested.
- **О6.** Accepted: with the database down `/api/health` answers 503 with `role` `unknown` and `migrations_pending` `null`.
- **О7.** Accepted: the error codes of the design's section 4.2.
- **О8.** Accepted: `PGLITE_DIR` and `MIGRATIONS_DIR` are refused in production.
- **О9.** Accepted: the closed build refuses to run inside a git working tree; spike S1 confirms it on Vercel.
- **О10.** Accepted: `/gate.html` stays reachable while the site is open (it shows only the gate words).
- **О11.** Recorded as a named limit: a Postgres server with `log_statement=all` writes bound values, the password included, into its own log; Sai's code never sets it, and the runbook says so.
- **О12.** Accepted: no CSS file and no icon file in M1 (the browser's colours pass 4.5:1; the icon is declared inline so no request fails).
- **О13.** Accepted: the three test helper files under `app/test/fixtures/`.
- **О14.** Accepted: `tx.js` is minimal in M1.
- **О15.** Accepted: the pins of the design (runtime hono 4.13.16, @hono/node-server 2.1.6, pg 8.23.1; development @electric-sql/pglite 0.5.15, typescript 6.0.3, @types/node 22.20.5, @types/pg 8.23.1 and the eslint/prettier versions of `tools/`) and the two `@types` packages are recorded by an Addition to `decisions/0001` written by ORCH with this record; TypeScript 7.0.2 is not taken (measured: 15 errors inside node_modules).
- **О16.** Accepted: `--preview` stays optional in the smoke script.
- **О17.** Accepted, by micro-amendment of criterion 2 of REQ-108: `node --test` with no matching file exits 0 with «# tests 0», so the criterion gains two presence guards (the unit and int folders hold their named test files) and a check that the test counts are above zero and equal the design's catalogue.

## Why

Each answer is the designer's measured default; the two amendments make criteria checkable that could not be met (О2) or could be met by nothing (О17). The tool choice follows a measurement, not a preference, and keeps the own kit where it fits.

## Boundary

Only the run M1CODE-20261117-01 and the blocks REQ-108 and REQ-109 (through the micro-amendment run). No code is written before the M0 release (PLAN §5.0); no Vercel action; the owner's gates G3, G4, G8, G21 stay with him.

## Basis

`docs/design/REQ-108-109-app-skeleton.md` (sections 1, 5, 6, 7, 8, 21); `handoffs/M1CODE-20261117-01/step-01-code-designer.json`; GitHub runs 44151782390 (`app.yml` sketch) and 44151782067 (`check.yml`) on the deleted branch `ci/m1code-design-1`; decisions 0001, 0112 О3, 0113 О10, 0116.

## Addendum 2026-11-18 (ORCH, after the micro-amendment step 1, `handoffs/REQ108AMEND-20261118-01/step-01-req-analyst.json`)

- **О18 (the analyst's issue I4, the same kind as О17, AP-014).** The `pg` job of `app.yml` (criteria 8 and 11 of REQ-108) gets the same presence guard and the same «# tests N» rule (N above 0 and equal to its count in the catalogue), in the same micro-amendment run (step 1b), not later.
- **О19 (issue I5).** The stricter secret grep the analyst measured (`grep -rniE` with the user part `[^ :/@]*`; it also catches an address with an empty user and an upper-case scheme, and stays clean on the benign lines and the sketch tree) is adopted in criterion 13 of REQ-108 in step 1b; the named limit of a literal value starting with `${` stays named.
- **О20 (issue I3).** The design writes each folder's test count as the runner counts it (each loop case and each subtest once; from the design's section 13 today unit 44, int 32, pg 4), so the count rule of criterion 2 is checked in one place; CODE-DESIGN-VALIDATOR checks it at the design gate of M1.3.
- **О21 (issue I2).** Recorded: the base tag 6c756cd holds neither REQ-108 nor REQ-109 (they are written in this session and reach the repository with the next release), so the "before" of the micro-amendment is the analyst's copy of the working file, kept in its work folder with its hash in the handoff.
- **О22 (the analyst's issue I2 of step 1b, a correction of О19).** The narrower measured form is adopted: only the scheme of the address is case-insensitive (each letter of `postgres` and of the optional `ql` written as a two-letter bracket class, as the analyst measured it), with no `-i` for the whole grep and the user part `[^ :/@]*`; it keeps every password hit of the `-i` form (9 of 9 planted) and drops the three word false hits («private key» in any case, «akia» inside a word), which the page texts of R1.2 could hit. Written into criterion 13 in step 1c by the same analyst.

## Addendum 2026-11-18 (ORCH, after the gate of the micro-amendment pass 1 = PASS, `handoffs/REQ108AMEND-20261118-01/step-02-req-validator.json`)

- **О23 (L1, L2, Low).** The sentence of REQ-108's description that ordinary text with «private key» in any letter case is not hit is false for upper case («PRIVATE KEY», «SLOVAKIA» are hit, by the new pattern and the old one); DOC-UPDATER corrects it at step 10 of run M1CODE as a false fact without a change of meaning, together with the design pointers and the Q12 line that do not yet name О22 (L2). The check is not weakened by it.
- **О24 (L3, Low; for the design gate of M1.3).** "`/` of the open site writes no console line at all" of criterion 14 needs a record of console events of every level (errors, warnings, logs, info), while the console matcher of the own kit keeps only errors; the design of M1.3 names how the browser step records every level (with the browser-test tool of О1 or a raw recorder), and CODE-DESIGN-VALIDATOR checks it at 1b together with О20 (the runner counts per folder, which the gate also found not yet written in section 13).
