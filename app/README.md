# app/ — the product of PUBLIC-V1

One npm package (decisions/0001): one Hono app with two entries — the Node and Docker entry
`server/node-main.js` and the Vercel function `api/index.js` — the database layer in `server/db/`, the
migrations in `db/migrations/` and the served files in `public/`.

## The check

`cd app && npm ci && npm run check` — one command; it stops at the first error. Its eight steps, in this
order:

1. `prettier --check .`
2. `eslint . --max-warnings 0`
3. `tsc --noEmit -p jsconfig.json` (`checkJs` and `strict`; `api/`, `server/`, `scripts/`, `public/` and
   `eslint.config.js`; the byte copy `server/vendor/picker-engine.js` is excluded, and an import of it is
   typed by its declaration `server/vendor/picker-engine.d.ts`)
4. `node scripts/check-public.js` (the forbidden texts and forms of the served files of `public/`, and the
   word lists of `scripts/word-lists.js` over the texts module `public/shared/i18n/texts.js`, the pages and
   the intake `content/sai-intake.json`)
5. `node scripts/vendored.js` (the byte copy of the picker engine in `server/vendor/` equals its source
   `tools/src/picker/engine.js` and the sha256 recorded in `vendored.json`, and the folder holds no other
   `.js` file)
6. `node ../tools/src/picker/cli.js check content/sai-intake.json` (the intake of the demo survey is a valid
   picker tenant file)
7. `npm run test:unit` (`node --test` over `test/unit`)
8. `npm run test:int` (`node --test` over `test/int`, PGlite)

A green check ends with exit 0, and the output of each test step holds «# fail 0», «# skipped 0» and
«# todo 0», and «# tests N» with N equal to the count of its folder in the test catalogues: section 13 of
`docs/design/REQ-108-109-app-skeleton.md` (as the runner counts: SC-2 runs as two tests, one per role
attribute) together with the tests added after it — in `test/unit` VC-3 (`vercel-config.test.js`) and
NPM-6 (`npmrc.test.js`); in `test/int` AE-5 (`api-entry.test.js`), HD-3 (`headers.test.js`), SC-5 and
SC-6 (`selfcheck.test.js`) — and section 10 of `docs/design/REQ-111-112-public-landing.md`, with every
test that a later step of its run (M1CODE-20261119-01) names in its handoff as added or removed.

## Local start

`cd app && PORT=0 node server/node-main.js` prints two addresses with one port: `http://127.0.0.1:<p>/`
(the app host) and `http://localhost:<p>/` (the preview host, which redirects to the app host). Without
`DATABASE_URL` the server uses an in-memory PGlite, migrated at the start. `SIGTERM` or Ctrl+C stops it.

The local server serves the local set, the files of `public/` as they are: the five pages — the landing
`/` (`index.html`), how it works `/how.html`, the examples `/examples.html` (what can and cannot be
ordered, three example requests), the demo survey `/demo.html` and the 404 page — in Russian, Kazakh and
English (`?lang=ru`, `?lang=kk`, `?lang=en`). The demo asks `GET /api/demo/questionnaire?lang=<l>` and
`POST /api/demo/result?lang=<l>`, which answer from the byte copy of the picker engine over the intake
`content/sai-intake.json`, read once at the start of the server; they read and write no database, set no
cookie and write no answer into a log line.

## Test levels

- unit — `test/unit`: pure modules and the rules of the files; in `npm run check`.
- int — `test/int`: the app, the entries and the database layer on PGlite; in `npm run check`.
- pg — `test/pg`: real Postgres. `npm run test:pg` with `SAI_PG_HOST`, `SAI_PG_PORT` and
  `SAI_PG_SUPERUSER_PASSWORD` set; it runs in the `pg` job of `.github/workflows/app.yml`. A missing
  variable fails the tests; they are never skipped.
- e2e — `test/e2e`: the pages in a real browser. `npm run test:e2e` runs the test files one after another
  (`--test-concurrency=1`), one browser at a time; the tests drive the Google Chrome installed on the
  computer through the dev dependency `playwright-core` (its `chrome` channel), against servers on port 0
  that they start. Not in `npm run check`; it runs in the `e2e` job of `.github/workflows/app.yml`, whose
  first step prints the path and the version of the runner's Chrome.

The shared helpers of the tests are in `test/fixtures/`; they hold no test.

## Migrations

`node server/db/migrate.js` (also `npm run migrate`) applies the files `db/migrations/NNNN_<name>.sql` in
name order under a session advisory lock: each file runs in one transaction together with its row in
`schema_migrations` (the name and the sha256 of the bytes). An applied file that changed or is missing
stops the run before any statement. A migration file holds only statements that may run inside a
transaction: no `begin`, `commit`, `create database`, `create index concurrently` or `vacuum`.

The password step: with `APP_DB_PASSWORD` set, every run ends by setting the password of the login role
`sai_app_login`. The value is only a bound parameter of `set_config`, quoted inside the database by a
constant block whose handler replaces every error, so no statement text, printed line or error of the
runner holds it. Without `APP_DB_PASSWORD` the login role has no password.

A named limit: a Postgres server whose own statement log records bound values (`log_statement = 'all'`,
or a duration setting that logs parameters) writes the password into the server's log. That is a setting
of the server, off by default in the image and in stock Postgres; no statement of the app can change it.

## Deploy

The Vercel CLI is used only as `npx vercel@64.1.0`, never installed. The release, the rollback and the
owner's emergency close of the site are in `docs/runbooks/release.md` and `docs/runbooks/incident.md`.

Production serves the public set, not the local set. The platform's build, `npm run vercel-build`
(`scripts/vercel-build.js`) with `SITE_GATE` empty, writes it in place in the uploaded copy: it removes
`examples.html`, cuts from every page the regions between `<!-- sai:order -->` and `<!-- /sai:order -->`
and between `<!-- sai:kk -->` and `<!-- /sai:kk -->`, and writes the texts module without the `order_`
keys and without kk. So production serves no order text and no Kazakh text, and no link or language
button that leads to them; every other file stays byte for byte, and the function answers both demo routes
only in ru and en (`?lang=kk` gives Russian). A second run on its own output changes nothing (the platform
runs the build twice), and since it writes in place it refuses to run inside a git working tree, so it
never rewrites `public/` of a clone. The local server and the Docker image serve the local set as it is.

Each gate is one constant of the source. G9, the public languages: `PUBLIC_LANGS` in
`public/shared/i18n/lang.js` (ru and en), read by the build and by the function entry. G8, the order
texts: `ORDER_TEXTS_PUBLIC` in `scripts/public-set.js` (`false`: built and checked here, left out of
production). Changing either constant is a release, made after the owner's answer to its gate
(`docs/program/public-v1/PROGRESS.md`, «Owner gates»).
