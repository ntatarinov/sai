# app/ — the product of PUBLIC-V1

One npm package (decisions/0001): one Hono app with two entries — the Node and Docker entry
`server/node-main.js` and the Vercel function `api/index.js` — the database layer in `server/db/`, the
migrations in `db/migrations/` and the served files in `public/`.

## The check

`cd app && npm ci && npm run check` — one command; it stops at the first error. Its six steps, in this
order:

1. `prettier --check .`
2. `eslint . --max-warnings 0`
3. `tsc --noEmit -p jsconfig.json` (`checkJs` and `strict`; `api/`, `server/`, `scripts/`, `public/` and
   `eslint.config.js`)
4. `node scripts/check-public.js` (the forbidden texts and forms of the served files of `public/`)
5. `npm run test:unit` (`node --test` over `test/unit`)
6. `npm run test:int` (`node --test` over `test/int`, PGlite)

A green check ends with exit 0, and the output of each test step holds «# fail 0», «# skipped 0» and
«# todo 0», and «# tests N» with N equal to the count of its folder in the test catalogue (section 13 of
`docs/design/REQ-108-109-app-skeleton.md`, as the runner counts: SC-2 runs as two tests, one per role
attribute) together with the tests added after it: in `test/unit` VC-3 (`vercel-config.test.js`) and
NPM-6 (`npmrc.test.js`); in `test/int` AE-5 (`api-entry.test.js`), HD-3 (`headers.test.js`), SC-5 and
SC-6 (`selfcheck.test.js`).

## Local start

`cd app && PORT=0 node server/node-main.js` prints two addresses with one port: `http://127.0.0.1:<p>/`
(the app host) and `http://localhost:<p>/` (the preview host, which redirects to the app host). Without
`DATABASE_URL` the server uses an in-memory PGlite, migrated at the start. `SIGTERM` or Ctrl+C stops it.

## Test levels

- unit — `test/unit`: pure modules and the rules of the files; in `npm run check`.
- int — `test/int`: the app, the entries and the database layer on PGlite; in `npm run check`.
- pg — `test/pg`: real Postgres. `npm run test:pg` with `SAI_PG_HOST`, `SAI_PG_PORT` and
  `SAI_PG_SUPERUSER_PASSWORD` set; it runs in the `pg` job of `.github/workflows/app.yml`. A missing
  variable fails the tests; they are never skipped.

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
