# 0116 — Conventions of the requirements R1.1 and R1.4 of the program PUBLIC-V1 (answers to the open questions О1–О16 of the run M1SITE-20261117-01)

Status: **accepted** (ORCH, 2026-11-17, inside the owner's words of 2026-11-17 «Продолжи работу, так чтобы я получил готовый продукт», his choice «Публичный сайт V1» (`decisions/0115`) and his answer «Сначала каркас» for the order of M1; the owner can cancel each point).

## Question

REQ-ANALYST wrote REQ-108 (R1.1, the app skeleton) and REQ-109 (R1.4, Vercel readiness) and left sixteen questions for ORCH and seven discrepancies with `docs/program/public-v1/ARCHITECTURE.md` (`handoffs/M1SITE-20261117-01/step-01-req-analyst.json`, result and issues I2–I8). They are closed before the gate REQ-VALIDATOR.

## Options

For each point the analyst names a default and its reason; no point is closed by a guess.

## Decision

- **О1.** Accepted: `app.yml` runs on a push to `main` and to `ci/**`, so its jobs are proved on a temporary branch before the push to `main` (`decisions/0110`). ARCH §18 ("main only") is amended in PROGRESS «Plan amendments».
- **О2.** Accepted: the jobs of `app.yml` in M1 are `check`, `pg` and `docker`; the jobs `e2e` and `migration-rehearsal` come with the requirements that need them.
- **О3.** Accepted: the browser-test tool of `app/` is chosen by the design of M1.3 with a record (the own pure-Node Chrome kit of `tools/test/e2e/kit/` or `playwright-core` of ARCH); the requirement forbids neither (PROGRESS «Open problems», 2026-11-17).
- **О4.** Accepted: the rewrite is one function `app/api/index.js` behind one rewrite of `/api/:path*` to `/api/index?__p=:path*` (the lesson measured on another Vercel project on 2026-10-31, PROGRESS Log), not the form of ARCH §19.2; spike S1 of M1.2 confirms it on the owner's project after G3/G4, and a correction is a WF-03 defect.
- **О5.** Accepted: `/api/health` answers exactly the keys `ok`, `db`, `role`, `migrations_pending`, `version`, `node`, with 200 or 503; `version` is `APP_VERSION` or `dev`.
- **О6.** Accepted: any non-empty `SITE_GATE` closes the site with 503 on every path and no database call; on Vercel the build replaces the static output with the gate page; no production drill by default (a drill is the owner's step in the runbook).
- **О7.** Accepted: Node and Docker send no `Server` and no `X-Powered-By`; the smoke script fails on `X-Powered-By` and on a `Server` value with a version number; the value Vercel adds is written into the post-deploy record. ARCH §14.1 ("no Server header") is amended for the platform's own header.
- **О8.** Accepted: no preview-host redirect in `vercel.json` now; it comes with spike S2 after G4.
- **О9.** Accepted: the runbooks are in English, the owner's own steps in them in Russian (`decisions/0080`, G18).
- **О10.** Accepted: outside production the local database is in-memory PGlite; the design measures PGlite's support of roles; if migration 0001 cannot run on PGlite, a micro-amendment of REQ-108 comes before the design gate.
- **О11.** Accepted: time limits — health 5 s, migrate 15 s, smoke 15 s, exit after SIGTERM 5 s.
- **О12.** Accepted as written (an `xmlns` value is not an outside address; inline `<style>`, inline `<script>` and `on…=` attributes are banned); the whole-word ban list is reviewed by the requirement R1.2, where English page text could hit a banned word.
- **О13.** Accepted: REQ-108 has an empty `depends_on`; the order of the program (the code of M1.3 after the release of M0, PLAN §5.0) is kept by ORCH, not by the block.
- **О14.** Accepted: the licence rule binds the direct dependencies; a transitive exception is named in the design and recorded by an Addition to `decisions/0001`. ARCH §3 is amended so.
- **О15.** Accepted: the closed page is Russian only until R1.2.
- **О16.** Accepted: `platform_settings` has no rows after migration 0001.
- **Discrepancy ARCH §2.2 (issue I4).** PGlite may be imported only by `app/server/db/pglite.js`, as the layout of ARCH §2 and criterion 3 of REQ-108 say; ARCH §2.2 is amended so.
- **Issues I2 and I3.** Recorded: the working file differed from the tag by one line of REQ-014 written by the run M0BACKLOG (step 04), and the row «Сначала каркас» lives in the uncommitted PROGRESS.md; both reach the repository with the records release M0.13. The changes of `decisions/0101` and `decisions/README.md` during the run were ORCH's (the Addition that accepted 0101).

## Why

Each answer is the analyst's default where it keeps the requirements checkable locally and on GitHub (PLAN §4.2: production checks are never criteria) and keeps the recorded decisions (0110 for the checks before the push, 0080 for the language). The amendments of ARCH follow measured facts or the platform's own behaviour, not a wish.

## Boundary

Only the requirements REQ-108 and REQ-109 and the run M1SITE-20261117-01. It decides no code, no Vercel project and no owner gate (G3, G4, G8, G21 stay with the owner).

## Basis

`handoffs/M1SITE-20261117-01/step-01-req-analyst.json` (result, open questions О1–О16, issues I2–I8); `docs/program/public-v1/PLAN.md` §4.2, §5 M1; `docs/program/public-v1/ARCHITECTURE.md` §2, §2.2, §3, §14.1, §18, §19.2; PROGRESS.md (Owner gates, Open problems, the Log line of 2026-10-31); decisions 0080, 0110, 0115.

## Addendum 2026-11-17 (ORCH, after the gate REQ-VALIDATOR pass 1 = FAIL, `handoffs/M1SITE-20261117-01/step-02-req-validator.json`)

- **О17 (F1, the database login role; the validator's issue I3).** As ARCH §4 "Login role and selfcheck" says: the runtime connection's role must have `rolsuper = false` and `rolbypassrls = false`, checked by `server/db/selfcheck.js` at start and reported by `/api/health`. Migration 0001 creates `sai_app_login` (LOGIN NOSUPERUSER NOBYPASSRLS, member of `sai_app` and `sai_preview`) with the password from `APP_DB_PASSWORD`; when `APP_DB_PASSWORD` is set, the app builds its runtime URL from the host of `DATABASE_URL` with that role, and migrations run as the owner role (the unpooled URL of ARCH §19.6). In Docker, compose and the `pg` job of `app.yml` the image's `POSTGRES_USER` is a superuser, so there the dedicated login role is always used, and the `pg` job holds a real-Postgres selfcheck case (refuses a superuser and a bypass role, accepts `sai_app_login`) as ARCH §18 asks. On Vercel and Neon spike S3 decides whether `APP_DB_PASSWORD` is needed.
- **О18 (F2, the gate when the database is down).** As ARCH §14.9 item 4: with a non-empty `SITE_GATE` the build `vercel-build` does not migrate and makes no database call; its output is only the gate page, so the owner's emergency redeploy closes the site also when the database is unreachable (decisions/0092 item 7). What status Vercel gives the static gate page (the validator's F14: 200, not the 503 of the Node server) is measured by spike S1 and written into the post-deploy record; the 503 criterion binds the Node server.
- **О19 (F6, the CLI flags of the runbooks).** The runbooks pin one exact Vercel CLI version everywhere; a flag that the ARCH leaves to spike S1 (for `rollback` and `redeploy`) is not pinned by a criterion before S1: the runbook names the command and marks such a line "verify at spike S1", and S1 writes the measured form. No criterion names a flag that the CLI reference does not list.
- **О20 (F3-F5 Medium and F7-F18 Low).** Fixed by the same REQ-ANALYST in the rework step 01b while gate passes are left (as `decisions/0112` О24): the skip/todo grep covers the option forms (`todo`, `skip`, `only` as options and as methods) and the check proves a todo body cannot pass; the `fetch(` ban gets an exact comparison form that does not hit `app.fetch(` or a method named `fetch`, and the import rules say what app/server files may import from each other and whether package subpaths are allowed; the `app.yml` path list includes `docs/runbooks/**` (or the runbook test leaves the app check); the Low findings each closed or named in the block with the reason.
- **О21 (the validator's issue I6).** The PROGRESS row of 2026-11-17T13:47:37Z with the next free numbers is outdated; ORCH appends a correction row (next free now: REQ-110, decision 0117, AP-164, ISS-0119).

## Addendum 2026-11-17 (ORCH, after the rework step 01b, `handoffs/M1SITE-20261117-01/step-01b-req-analyst.json`)

- **О22 (the analyst's issue I1, outside calls of the server, Q10).** The rule "no outside call" of criterion 3 of REQ-108 does not rest on the `fetch` ban alone: `app/server` and `app/api` may not import `node:https`, `node:http2`, `node:net`, `node:tls`, `node:dgram`, `node:dns` or an HTTP client package; `node:http` may be imported only by `app/server/node-main.js`, and only its server part is used there (no `request(` or `get(` of it anywhere). The database client library is the one named exception, imported only by the files of `app/server/db/` that ARCH §2.2 names. The gate checks the planted twins of this rule.
- **О23 (issue I4).** Accepted: migrations use `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL` when it is unset (compose and the `pg` job have one address; on Vercel with Neon both are set).
- **О24 (issue I5).** Postgres takes no bind parameter in `CREATE ROLE` or `ALTER ROLE`, so "the password reaches the database only as a parameter" is read as: the password never appears in the SQL text of a migration file, a log line or an error; it is bound as a parameter of a server-side statement that quotes it inside the database (for example a session setting set with a bound value and read by `format('%L', …)` in a `DO` block). The design of M1.3 shows a working form on real Postgres and on PGlite; if none works, a micro-amendment of REQ-108 comes before the design gate. Whether the pool still holds a connection when the `pg_stat_activity` probe runs is a question of the design.

## Addendum 2026-11-17 (ORCH, after the gate REQ-VALIDATOR pass 2 = PASS, `handoffs/M1SITE-20261117-01/step-02b-req-validator.json`)

- **О25 (N1–N12, Low).** As after the passed second pass of other gates (`decisions/0112` О25), the Low findings do not return the requirement: the design of M1.3 settles N1 (the blanking sentence and the bracket twins of criterion 3; an import inside a comment), N2 (the four outside-call forms that pass the sketch: destructured `fetch` from `globalThis`, `Reflect.get`, `process.getBuiltinModule`, `const { request } = http` — the design makes them red or names them), N3 (migration 0001 with `APP_DB_PASSWORD` unset, and a password set or changed after 0001), N4 (which run the statement-log check records), N5 (the `pg_stat_activity` probe with no open connection), N6 (the gate page file is `index.html` in the closed build) and N8 (the ternary false hit of the skip grep); the wording points N7 (the `${` overclaim), N9 (the redeploy fact of REQ-109), N10 (the Q12 lines name О1–О24) and N11 (the Status line of this record) go into the first micro-amendment of REQ-108/REQ-109 or into this record now: the Status line of this record is read with the full words of the owner's answer «Сначала каркас (Recommended)», as PROGRESS.md records them. N12 (the disclosed reference renames) is accepted.
- **О26 (issue I2).** The three departures from ARCH of the rework get rows in PROGRESS «Plan amendments»: the §18 path list of `app.yml` (with `docs/runbooks/**` and `tools/package.json`), §2.2 (`pg` only in `app/server/db/pg.js`, PGlite only in `app/server/db/pglite.js`, and the network-module bans of О22), §4 (`sai_app_login` always created by migration 0001, used in Docker, compose and the `pg` job).
