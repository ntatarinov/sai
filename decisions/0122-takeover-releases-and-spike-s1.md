# 0122 — The program led by another session from 2026-11-19; the security fixes and the first public release made outside the usual steps; what the first deploy measured (spike S1)

Status: **accepted** (ORCH's role, taken over on 2026-11-19 by the Claude Code session that leads the program now, on the owner's words below; the owner can cancel each point).

## Question

ORCH session 3 stood from 2026-11-18 on a closed question that the owner could not open in his editor. Its work of the
runs M0DOCS-20261117-01, ISS-0092-20261117-01, REQ103AMEND-20261117-01, REQ108AMEND-20261118-01,
REQ110AMEND-20261118-01, M1SITE-20261117-01, M1CODE-20261117-01, SECREG-20261118-01 and M0BACKLOG-20261028-01 step 04
stood uncommitted in the working tree. Meanwhile, on the owner's words, the five defects of the external security review
were fixed and the first public release was built and deployed outside the steps of WF-03 and WF-02. How are the
program, these two releases and their records taken from here?

## Options

(a) Wait for ORCH session 3 until the owner finds its question. (b) Another session takes ORCH's role under the same
rules: it commits the found work as it is, records openly what was done outside the steps, and continues the program by
PROGRESS.md. (c) Start the program again from the last commit on main.

## Decision

- **О1 (who leads).** From 2026-11-19 the program is led by another Claude Code session on the same Mac in ORCH's role,
  with the same rules (CLAUDE.md, the quality bar, two agents at most at the same time). ORCH session 3 was asked to
  stand down; it waits on its question and does not act on the tree. Its uncommitted work was committed as found (local
  branch `m0-records`, commit a2fd74f, then merges of main: 6e4ee03 and f78d09f) and reaches main with the records
  release M0.13.
- **О2 (the security fixes, ISS-0119 … ISS-0123).** Built in a separate clone, not in ORCH's tree, where the checks of
  the M0 runs were running, on the owner's words of 2026-11-18 («дай правки сделай значит по  sai проекту»; «Исправлять
  все пять (Recommended)»; «Отключить (Recommended)»; «Делай комит, когда стоит оно того и тесты в гитхаб»; «Влить в
  main»). The five commits first carried a wrong author address; on «Да, переписать (Recommended)» they were made again
  with the noreply author (same trees, same dates) and main was replaced: d22ceec ISS-0120 (it closes ISS-0037 too,
  decisions/0121 О2), 9e797d5 ISS-0121, c94beb5 ISS-0123, 39df2b7 ISS-0119 (WebFetch only with the allow list
  `SAI_TEAM_WEB_DOMAINS`), 8d8b59b ISS-0122 (reads only with a key; `SAI_PIXEL_OFFICE_STORE_TEXT` stores the texts only
  for `1`, the owner's «Отключить»). `check.yml` run 44454959286 success on 8d8b59b; the local `npm run check` 2226 of
  2226. The WF-03 runs of decisions/0121 О6 were not held: no diagnosis handoff and no gate of a Sai role. Their records
  (the status lines of the five defect files and of ISS-0037 with these commits) are written by the DOC-UPDATER step of
  M0.13 after a RELEASE-VALIDATOR re-check of the five fixes on main.
- **О3 (M1.3, REQ-108 and REQ-109).** The code of `app/` was built from the sketch of the design
  `docs/design/REQ-108-109-app-skeleton.md` (M1CODE-20261117-01 step 01; its design gate 01b never ran) by a workflow of
  agents: alignment to the design (13 named tests added; two real defects found and fixed — an open redirect of the
  preview host for a path that starts with `//`, and the entry that rejected instead of answering 503 when the
  configuration is wrong), an independent security review and an independent review of every criterion, one skeptic per
  claim (29 claims: 18 confirmed, 11 refuted), one fixer with a test that is red without each fix, a fresh recheck (5 low
  findings, fixed in a further pass). Released to main as ed7f67d and the two spike fixes da492fd and 0d8fa78 (main =
  0d8fa78; `app.yml` and `check.yml` green on each commit, runs 44478974334 and 44478974387, 44480510171 and
  44480510128, 44482100712 and 44482100722) and deployed to production. Not held: the design gate 01b and the WF-02 steps
  TEST-RUNNER, RELEASE-VALIDATOR, DOC-UPDATER and RELEASE-FINALIZER. The owner's word for this release: «пуш, брат. Я
  хочу чтобы ты меня понял в корне и дал мне результат…» and «Да, сайт по ссылке (Recommended)» (quality-bar R1: a
  merge in another way is confirmed by the owner). REQ-108 and REQ-109 stay `pending` until a RELEASE-VALIDATOR re-check
  of the released state passes; then DOC-UPDATER sets their statuses.
- **О4 (owner gates).** G4 (the first URL) is answered by «Да, сайт по ссылке (Recommended)»: the production URL is
  https://sai-team.vercel.app. G3: the owner's existing Vercel account with a new project (his answer of 2026-11-17);
  the project was created from the command line in his account, the Neon database on «Да, принять и подключить
  (Recommended)»; the ids (not secret) are in PROGRESS.md. The commit author stays the noreply address: a deploy goes
  from an export of the pushed commit without `.git`, so the Hobby check of the commit author does not apply. G8 stays
  at its default «б» (no order texts on production), G9 at its default (kk hidden on production); G21 is asked before
  the look release (R1.2, R1.3).
- **О5 (spike S1, measured 2026-11-19 on the owner's project; Vercel CLI 64.1.0 on the Mac, the platform built with CLI
  65.17.0).** (1) The CLI asks the rules of `.vercelignore` about a folder by its bare relative name (`api`, never
  `api/`; it bundles `ignore` 4.0.6): after `/*` the entry `!api/` never keeps the folder, so the first upload held only
  the four root files and the build stopped («The pattern "api/index.js" defined in `functions` doesn't match any
  Serverless Functions inside the `api` directory»); `!api` keeps it (da492fd). (2) With `framework: null` the
  platform's static builder still picks a framework from the dependencies of package.json; it picked Hono and appended
  Hono's default rules `{handle: filesystem}`, `{src: "/(.*)", dest: "/"}` after the rewrites, so every unknown path
  answered the bytes of index.html with 200 (read in the build output of the same build made locally with CLI
  65.14.0); the static builder adds none of them only when the build output has routes of its own. `app/vercel.json`
  now has one explicit `routes` table: the header set for every path (`continue`), the files, one rule `/api` and
  `/api/<path>` → `/api/index?__p=<path>`, a terminal 404 to `/404.html` (0d8fa78). (3) The old rewrite's destination
  also got an extra `path=$1` from the platform. (4) `vercel-build` runs twice per build (the node builder and the
  static builder); the migration is idempotent (the second run: «nothing to apply»). (5) A request's own `__p` never
  reaches the function: `/api/health?__p=x` answers health with 200. (6) `/api/%2e%2e/x` gets the platform's 403;
  `//evil.example/x` a 308 to `/evil.example/x` on the same host. (7) The function runs Node v22.23.5; the platform sets
  `Server: Vercel` (no digit); every answer carries the security headers, the /api answers `Cache-Control: no-store`
  and `X-Request-Id`; no `X-Powered-By`. (8) Health answers `db ok, role ok, migrations_pending 0`: the runtime connects
  as `sai_app_login` with `APP_DB_PASSWORD` through the pooled `DATABASE_URL`; the role attributes of the database owner
  of Neon were not read (part of S3). (9) pg prints a warning that `sslmode=require` is treated as `verify-full` (V9).
  (10) The Neon integration adds its variables as plain configuration, not as secrets. (11) `vercel curl` creates a
  deployment protection bypass secret on the project; it was revoked at once. Reachability from the Mac (M1.8, first
  part): five requests of `/api/health`, all 200 in 0.30–0.34 s.
- **О6 (the requirement text).** REQ-109 criterion 1 names one `rewrites` rule and `.vercelignore` entries with a slash;
  the measured forms of О5 (1) and (2) replace them. A micro-amendment run REQ109AMEND-<date>-01 writes the new text
  with this evidence; until then the code holds the measured form, and these facts stand as the S1 Addition to
  decisions/0001 (PLAN M1.2).
- **О7 (numbers).** Next free: REQ-111, decision 0123, AP-164, ISS-0124.

## Why

The owner asked for a visible result and could not reach ORCH's question. The quality bar is kept by an independent
check of every change (reviews, skeptics, CI on GitHub, the smoke on production) and by recording openly which steps
were not held, so that a RELEASE-VALIDATOR can re-check them before any status becomes `done`.

## Boundary

No requirement status changes by this record. The look release (R1.2, R1.3) follows the usual steps and G21. The
records release M0.13 still needs the open steps of ISS-0092-20261117-01 (from step 06) and M0DOCS-20261117-01 (from
step 05c).

## Basis

The owner's words verbatim: `docs/owner-requests/2026-10-27-public-launch-plan.md`, the section of 2026-11-18 –
2026-11-19. Commits on main 8d8b59b and ed7f67d, da492fd, 0d8fa78; the GitHub runs named in О2 and О3; the build log
of the production deployment and the local build output (О5 (2)).
