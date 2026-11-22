# REQ-108, REQ-109 — code design: the product app skeleton (R1.1) and its Vercel readiness (R1.4)

Run `M1CODE-20261117-01`, WF-02 step 1 (task M1.3 of the program PUBLIC-V1). Base: the tag
`base/M1CODE-20261117-01` (commit 6c756cd). The blocks REQ-108 (15 criteria) and REQ-109 (10 criteria) are read
from the working file `docs/requirements.yaml`: they are not in the tag (F1). The answers this design rests on:
`decisions/0001`, `0091`, `0092`, `0094`, `0096`, `0106`, `0107`, `0110`, `0111`, `0115` and `0116` (О1–О26); the
architecture `docs/program/public-v1/ARCHITECTURE.md` (ARCH) with the «Plan amendments» rows of
`docs/program/public-v1/PROGRESS.md` of 2026-11-17; the gate handoffs
`handoffs/M1SITE-20261117-01/step-02-req-validator.json` (F1–F18) and `step-02b-req-validator.json` (N1–N12).

This file holds shapes, signatures, tables, exact file lists, exact texts and exact command lines. It holds no
implementation code. Every statement about how Node, PGlite, Postgres, the npm registry, Chrome, Docker or GitHub
behave was measured on a sketch outside the project (section 20); a fact that only the owner's Vercel project can
show is listed in section 7 as «waits for spike S1/S2/S3», not guessed. The open questions for ORCH are in section 21
(О1…О17), each with a default; ORCH answers them by a record before the gate 1b (WF-02, step 1a).

---

## 0. Summary

- **What is built (BACKEND-DEV the product files, TEST-DESIGNER the tests; one writer per file, section 15).** A new top-level folder `app/` (decision 0001): one npm
  package with three runtime dependencies (`hono` 4.13.16, `@hono/node-server` 2.1.6, `pg` 8.23.1) and eight dev
  dependencies; a Hono app `createApp(deps)` with two entries — the Node and Docker entry `server/node-main.js` and the
  Vercel function `api/index.js`; static files served from memory; the site gate; the uniform 404; the security
  headers; request ids and JSON log lines; the body limit; `/api/health`; the database layer (PGlite outside
  production, `pg` with a selfcheck before any other statement); the migration runner and migration `0001_init.sql`;
  three scripts (`vercel-build`, `smoke`, `check-public`); Vercel, Docker and compose files; the CI workflow
  `.github/workflows/app.yml`; six added lines of the root `.gitignore`; two runbooks `docs/runbooks/{release,incident}.md`;
  26 test files under `app/test/{unit,int,pg}` and three helper files under `app/test/fixtures` (О13).
- **Nothing outside `app/`, `.github/workflows/app.yml`, `.gitignore` and `docs/runbooks/` changes.** `check.yml`,
  `.githooks/pre-push`, `tools/**`, the root `README.md`, `CLAUDE.md`, `STATE.md` and `PLAN.md` stay byte for byte.
  No guard test of an earlier requirement turns red (section 14, measured on GitHub: F15).
- **The database facts the requirement left to the design** (section 6). PGlite 0.5.15 supports `CREATE ROLE`, role
  membership, forced row security under `SET LOCAL ROLE` and advisory locks; its session user is the superuser
  `postgres` (F9). The PGlite reading of decisions/0116 О10 is one step of the PGlite adapter only: after the
  migrations it runs `set session authorization sai_app_login`, so the one selfcheck statement reads the same columns
  on PGlite and on Postgres (F9). The password form of О24 works on PGlite (PostgreSQL 18.6 inside), on Postgres 16.14
  (the Mac) and on Postgres 17.12 (the `pg` job on GitHub): the value is a bound parameter of `set_config`, and the
  `DO` block that quotes it with `format('%L', …)` has an exception handler that replaces every error, because without
  it the error carries the quoted statement with the password in its `where` field (measured on both, F9, F10). The
  password step is a step of the runner after the files, on every run with `APP_DB_PASSWORD` set (N3).
- **The Vercel shape** (section 7): one function `api/index.js` whose default export is `{ fetch(request) }`, behind the
  one rewrite of О4; `vercel-build` without a database call when `SITE_GATE` is set, its output then only `index.html`
  (N6). Nine facts wait for the spikes S1–S3 and are listed, not guessed.
- **app.yml** (section 4.17): `push` to `main` and `ci/**`, the six paths, jobs `check`, `pg`, `docker`, actions pinned
  by commit, images by digest, Node 22.23.4 exact; the sketch of it is green on GitHub (run 44151782390, F14).
- **The browser-test tool** (section 8, О1): both measured; the default is `playwright-core` 1.64.1 for the later
  browser tests of `app/`, written as a proposal for a decision record; nothing is installed for it in this run.
- **Three points of the requirement need ORCH** (section 21): Chrome writes one console error for every page answered
  with 404 or 503, so criterion 14 of REQ-108 («no console line is excused») cannot be met on `/nope` and on the gate
  page (F16, О2: a micro-amendment before the gate 1b); the `pg` job cannot start its Postgres as a `services:`
  container with a password made in the run (О4); and a test step that finds no test file ends with 0 and «# tests 0»,
  so criterion 2's three counts alone are met by an empty folder (F28, О17).
- **Sizes** (section 22 has the commands). 25 criteria; 26 test files with 79 named tests in the catalogue (66 of them
  in the sketch, all green on the Mac and, before the four tests added after the first mutant series, on GitHub); 11
  build sub-steps (B1–B7 BACKEND-DEV, T1–T4 TEST-DESIGNER); 48 mutants (29 applied on the sketch: 27 red, 1
  equivalent, 1 closed by an added row); 17 open questions; 28 checked facts.

---

## 1. Checked facts

Measured on 2026-11-17 from 18:10Z to 19:10Z (clock `date -u`), macOS 27.2 arm64, Node v22.23.4, npm 10.9.9, Google
Chrome 157.0.8103.79, Postgres 16.14 (Homebrew). "Clone" is `git clone -b base/M1CODE-20261117-01` of the project into
`<outside the project>/m1code-01/clone`; "the sketch" is the folder `app/` (and `app.yml`, the `.gitignore` lines and
the two runbooks) written in that clone and never in the project (section 20). The registry reads are `npm view` on the
public npm registry; the image digests are read from the Docker Hub registry; GitHub is read with `gh`.

| # | Statement | Command / sketch | Result |
|---|---|---|---|
| F1 | The blocks REQ-108 and REQ-109 are in the working file, not in the tag | `git show base/M1CODE-20261117-01:docs/requirements.yaml \| grep -c -E '^  - id: REQ-10[89]$'`; the same grep on the working file | 0 on the tag, 2 in the working file; the blocks were read by `awk` by id (handoffs.md) |
| F2 | The tag has no `app/`, no `docs/runbooks/`; `.github/workflows/` holds only `check.yml` | `git ls-tree --name-only base/M1CODE-20261117-01 .github/workflows/ app docs/runbooks` | `.github/workflows/check.yml` only — holds |
| F3 | `tools/package.json`: engines `>=22 <23`; eslint 10.11.0, @eslint/js 10.0.1, globals 17.12.0, prettier 3.9.9 | `cat tools/package.json` on the clone | holds |
| F4 | The pins and their age (section 5) | `npm view <name> time --json` for every candidate; the newest stable version published on or before 2026-11-03T18:00Z (14 days before the measurement) | hono 4.13.16 (2026-11-01T03:04Z), @hono/node-server 2.1.6 (2026-11-02T10:22Z), pg 8.23.1 (2026-09-30), @electric-sql/pglite 0.5.15 (2026-11-03T12:39Z), typescript 6.0.3 (2026-04-16), @types/node 22.20.5 (2026-10-01), @types/pg 8.23.1 (2026-08-17), playwright-core 1.64.1 (2026-10-14); eslint, @eslint/js, globals, prettier as in F3 |
| F5 | Every entry of the lockfile is at least 14 days old and comes from npmjs | `npm install --before=2026-11-03T18:00:00Z` in the sketch; then `npm view <name> time --json` for all 101 entries (a script, 8 at a time) | 101 entries, lockfileVersion 3, every `resolved` on `https://registry.npmjs.org/`, newest entry `@electric-sql/pglite@0.5.15` 2026-11-03T12:39:40Z, none later than the cut |
| F6 | Licences | `package-lock.json` read by `node -e` | all 101: MIT 73, Apache-2.0 14, ISC 6, BSD-2-Clause 6, BSD-3-Clause 1, BlueOak-1.0.0 1 (`minimatch`, a dev package of eslint, as in `tools/`, decisions/0116 О14); the 11 direct ones MIT or Apache-2.0; the production tree (`npm ci --omit=dev`) is 16 packages, all MIT or ISC |
| F7 | `npm audit --omit=dev --audit-level=high` | in the sketch on the Mac and in the `check` job | «found 0 vulnerabilities» both; `npm ci` on the runner reports «3 moderate severity vulnerabilities» for the whole tree, in `tools/` too (dev packages; outside this run, issue I3) |
| F8 | TypeScript: 6.0.3 against 7.0.2 | `npx tsc --noEmit -p jsconfig.json` with each, the same `jsconfig.json` | 6.0.3: 0 errors, 0.8 s; 7.0.2 (the native compiler): it type-checks JavaScript inside `node_modules` (15 errors in `punycode/punycode.js`, a package of eslint's tree) and adds 20 platform packages to the lockfile — 6.0.3 is chosen |
| F9 | PGlite 0.5.15: roles, row security, locks, the password form, the session switch | `<outside the project>/m1code-01/trials/pglite-roles.mjs` and `pglite-switch.mjs` (in-memory PGlite) | `select version()` → PostgreSQL 18.6 (PGlite 0.5.15), wasm32; `current_user` = `session_user` = `postgres`, rolsuper and rolbypassrls true; `create role … nologin nosuperuser nobypassrls` and `login` work, `grant` membership works, a second `create role` → 42710, a `do` block with `exception when duplicate_object` passes; `select set_config('sai.app_db_password', $1, true)` with a bound value, then `do $$ … execute format('alter role sai_app_login password %L', current_setting(…)) … $$` → stored as `SCRAM-SHA-256$…`, the setting is empty after `commit`; the same block on a missing role → error 42704 whose `where` is `SQL statement "alter role … password '<the value>'"`; with `exception when others then raise exception 'sai: the password step failed'` → P0001, `where` holds no value; `pg_advisory_lock` and `pg_try_advisory_xact_lock` work; a table with forced row security shows 1 of 2 rows under `set local role sai_app` and 2 to the superuser; `set session authorization sai_app_login` → `session_user` sai_app_login, rolsuper false, rolbypassrls false, `is_superuser` off, `create role` refused 42501; `set session authorization postgres` works again after it (the switch is not a security boundary in PGlite); the option `username` needs an existing role; `begin; create table a1 …; select * from no_such_table` → the table does not exist after `rollback` |
| F10 | Real Postgres 16.14: the same form; the password in a URL | a private cluster in the work folder, listening on a Unix socket only (`listen_addresses = ''`, no TCP port; `lsof` shows 0 internet sockets), `log_statement = 'all'`; `trials/pg-real.mjs`, `pg-login.mjs`, `pg-login2.mjs` | the form of F9 works; the guarded failure holds no value, the unguarded one does (`where`, and the server log line `CONTEXT`); login as sai_app_login with a password holding `@:/?#%` works only when the password is written into the URL as `encodeURIComponent(value)`: the WHATWG URL `password` setter leaves `%` as it is and the client then reads another password (28P01); the server log with `log_statement = 'all'` holds every bound value in `DETAIL: parameters` lines (29 lines) and never the quoted `alter role` (0 lines); `pg_try_advisory_lock(k)` held in database A is free in database B of the same server (advisory locks are per database); the roles made by 0001 in database A are found unchanged after 0001 runs in database B |
| F11 | `pg` 8.23.1 error texts and timeouts | `trials/pg-timeouts.mjs`: a port where nothing listens and a TCP stand-in on 127.0.0.1:0 that accepts and never answers | refused → `connect ECONNREFUSED 127.0.0.1:<port>` after 2 ms (the message names the host and port); silent with `connectionTimeoutMillis: 2000` → `timeout expired` after 2004 ms; a pool → `Connection terminated due to connection timeout` after 2004 ms |
| F12 | `@hono/node-server` 2.1.6 and Node's own headers | read `dist/index.mjs` lines 600–625; `curl -i` against the sketch | the request URL takes `https` only when the socket is encrypted (`X-Forwarded-Proto` is not read); an absolute-form request target (`GET http://x/…`) becomes the URL as it is; the answer holds no `Server` and no `X-Powered-By` header |
| F13 | The image digests | Docker Hub registry, `HEAD /v2/library/<name>/manifests/<tag>` with the OCI index media type, 2026-11-17T18:23Z | `node:22.23.4-bookworm-slim` → `sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d`; `postgres:17` → `sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac` (PostgreSQL 17.12 in the `docker` job log) |
| F14 | The sketch of `app.yml` on GitHub | the snapshot commit 7c14e72 (section 20) pushed to `ci/m1code-design-1`; `gh run view 44151782390 --json …` and `--log` | `success`; `check` 80 s (unit 38 of 38 in 8.3 s, int 21 of 21 in 52.1 s, `# skipped 0`, `# todo 0`, audit 0), `pg` 26 s (4 of 4 on Postgres 17.12), `docker` 42 s; `node -v` → v22.23.4 in every job and in the image; the `pg_stat_activity` probe printed one row, `sai_app_login`; the smoke printed 8 `smoke: ok` lines; `id -u` ≠ 0; `schema_migrations` holds `0001_init.sql` |
| F15 | `check.yml` on the same sha (the whole tools check with `app/` present) | `gh run view 44151782067 --json status,conclusion,jobs` and `--log` | `success`, 18:48:25Z → 18:56:09Z (7 min 44 s); Node v22.23.4; traces 2632 files, 0 traces; handoffs-check 0 violations; `# tests 2209`, `# pass 2209`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0` (the same count as the release of 6c756cd); the e2e files passed |
| F16 | The closed page in a real Chrome with the own kit | `trials/chrome-kit.mjs`: `withBrowser` of `tools/test/e2e/kit/index.js` (fresh profile under the temporary root, `TMPDIR` set to the work folder), the sketch server on port 0; `/` and `/nope`, and `/` of a second server with `SITE_GATE=closed`; 1470×784, 390×844, 320×568 × light, dark; 18 snapshots | text shown, `lang` `ru`, no horizontal overflow, one request per load (no `/favicon.ico`: the icon `data:,` works), text contrast 21 : 1 light and 18.73 : 1 dark (`/`, gate), 9.4 and 7.84 (`/nope`, the link); `/` writes no console line; **`/nope` and the gate page write one console error each, in every load: «Failed to load resource: the server responded with a status of 404 (Not Found)» and «… 503 (Service Unavailable)»** (О2) |
| F17 | `playwright-core` 1.64.1 | `npm install playwright-core@1.64.1` in `<outside the project>/m1code-01/pw-trial`, `chromium.launch({ channel: "chrome" })` | 13 MB, one package, Apache-2.0, no install script needed (no browser download); launch 940 ms; opens `http://localhost:<p>/` (the preview host) and follows the 307; reports CSP violations and the same 404 line as F16 |
| F18 | The own kit | `trials/kit-limits.mjs` | launch 294 ms; `page.goto("http://localhost:<p>/")` → `URL_REFUSED` (the kit opens only `http://127.0.0.1:<port>/…`, `guards.js` `assertLoopbackUrl`; Chrome gets `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`); an inline style blocked by the CSP ends `withBrowser` with `CONSOLE_ENTRIES` |
| F19 | `bash -e` and a negated pipeline | `bash -ec '! echo postgres \| grep -qx postgres; echo reached'` | prints «reached»: a failing `!` pipeline does not stop a GitHub `run` step (`bash -e`) |
| F20 | No app test reads a path outside the `paths` list of `app.yml` | a fresh clone of the snapshot, every path outside `app/**`, `docs/runbooks/**`, `tools/package.json`, `tools/src/team/**`, `tools/src/pixel-office/mask.js`, `.github/workflows/app.yml` removed with `rm -rf` (`.git` kept), then `cd app && npm ci && npm run check` | exit 0 (38 + 21 tests) |
| F21 | The snapshot holds no secret, no skip, no trace, no unfinished handoff | the snapshot tree in a copy whose `HEAD` is the snapshot (AP-146): `node src/handoffs/cli.js`, `node src/traces/cli.js`, the grep of REQ-108 criterion 13, the grep of criterion 2 | handoffs-check 0 violations of 1392 files; traces 2632 files, 0 traces; both greps → no line (two hits of the first draft were fixed in the sketch: a test that held key shapes and a literal address password; both now built from parts) |
| F22 | The Vercel CLI pin | `npm view vercel@64.1.0 version license`, `npm view vercel time --json` | 64.1.0 exists (Apache-2.0, 2026-10-14T21:49Z), the version `docs/program/public-v1/vercel-setup.ru.md` gives the owner; the latest is 65.17.0; the final pin is fixed by spike S1 |
| F23 | The app check on the Mac | `cd app && npm run check` in the sketch, three times | exit 0 in 39.0, 39.3 and 39.6 s (unit 7.2 s, int 30.2–30.5 s) |
| F24 | The `.gitignore` lines | the six lines of section 4.18 appended in the clone; `git check-ignore -q` for each path; `git ls-files -ci --exclude-standard` | the six paths of criterion 13 ignored, `app/.env.example` not; 0 tracked files become ignored |
| F25 | Guard tests that read what this run adds or changes | on the clone: `grep -rnE "['\"/]app/\|app\.yml\|runbooks" tools/test tools/src`; the readers of `.github/workflows`, `.gitignore`, the root `README.md` and `CLAUDE.md` | 0 hits for `app/`, `app.yml`, `runbooks`; `.github/workflows`: only `repo.test.js` (the constant `WORKFLOW_REL = ".github/workflows/check.yml"`, lines 122, 327, 1115); `.gitignore`: only `traces-runtime.test.js:187`, which writes its own in a temporary repository; root `README.md`: `repo.test.js:1200, 1223` (RD-1…RD-4) and `e2e-kit.test.js:4044` (E2K-61); `CLAUDE.md`: `repo.test.js:106` and `team-docs.test.js:81` (TM-01) — none of these files changes in this run |
| F26 | The sketch server on the Mac | `PORT=0 node server/node-main.js` in the sketch; `curl` | prints `http://127.0.0.1:<p>/` and `http://localhost:<p>/`; `/` 200 with the page; `/api/health` → `{"ok":true,"db":"ok","role":"ok","migrations_pending":0,"version":"dev","node":"v22.23.4"}` (in-memory PGlite, migrated and switched); `Host: localhost:<p>` → 307 to `http://127.0.0.1:<p>/x/y`; `/api/x/y` the uniform 404; `/..%2fpackage.json` and `//etc/passwd` (with `--path-as-is`) → 404; `SIGTERM` → stopped within 1 s |
| F28 | `node --test` over a glob that matches nothing | `node --test "test/unit/**/*.test.js"` in an empty folder | exit 0, `# tests 0`, `# pass 0`, `# fail 0`: a test step with no test file passes criterion 2 as written (О17) |
| F27 | The body limit through a tee | the first sketch read the body of a clone of the request (`request.clone()`) and cancelled its reader above the limit | the test of a 70 000-byte body without a length header hung («Promise resolution is still pending but the event loop has already resolved»): the cancel of one branch of a tee waits for the other branch; the design reads the body once, never through a clone (section 4.6) |

---

## 2. Choices that could be disputed

Each is an open question of section 21 with its default; the design is written with the default.

| # | Choice | Default | Why | О |
|---|---|---|---|---|
| C1 | The browser-test tool of `app/` | `playwright-core` 1.64.1, added with the first browser test (R1.2), not now | the kit cannot open the preview host (F18), and `app/test` importing `tools/test` would add `tools/test/e2e/kit/**` to the path list of `app.yml` | О1 |
| C2 | The console line of a 404 or 503 page in criterion 14 | a micro-amendment of REQ-108 that excuses exactly that one line per load | measured in every load (F16); the statuses are required by criteria 5 and 9 | О2 |
| C3 | `tsc` covers `api/`, `server/`, `scripts/`, `public/` and `eslint.config.js`, not `test/` | as written | the tests run in the same check; strict JSDoc types on test doubles cost casts that prove nothing | О3 |
| C4 | The `pg` job starts Postgres with `docker run` in a step | as written | a `services:` container starts before the first step, so its password would be a literal or a predictable expression; `trust` would make the login check prove nothing (AP-153) | О4 |
| C5 | Stricter module and global rules than criterion 3 lists (N2) | `node:worker_threads`, `node:vm`, `eval(`, `Function(`, the names `globalThis`, `global`, `self`, `window`, the member `getBuiltinModule`, a destructuring of the `node:http` binding: all red in `app/server` and `app/api` | each is a way to call out without the listed forms; none is used by the skeleton | О5 |
| C6 | `/api/health` values when the database is down | `role` `"unknown"`, `migrations_pending` `null` | decisions/0116 О5 fixes the keys, not these two values | О6 |
| C7 | The error codes | section 4.2 | stable codes for the pages of R1.2 | О7 |
| C8 | The test-only variables `PGLITE_DIR` and `MIGRATIONS_DIR` | refused with `NODE_ENV=production` | the gate's F12 asks the design to name them | О8 |
| C9 | The closed build refuses to replace `public/` inside a git working tree | as written; S1 builds once with `SITE_GATE=closed` on a protected preview deployment | a local `npm run vercel-build` with `SITE_GATE` set would delete the working `app/public` | О9 |
| C10 | `/gate.html` is served (Node, Docker and Vercel) while the site is open | as written | criterion 9 puts the gate page into `app/public`, and the closed build needs its bytes | О10 |
| C11 | The server log of Postgres may hold the bound password | named as a limit | `log_statement = 'all'` logs bound values (F10); no statement of the app can stop it without a superuser | О11 |
| C12 | Hono's node adapter major 2 | 2.1.6 | both 2.1.6 and 1.19.18 were published on 2026-11-02; 2.x is the current line; the sketch is green on it | — |
| C13 | Test helper files under `app/test/fixtures/` | three files (section 3) | the requirement lists only the test files named in the criteria; ARCH §2 has `test/fixtures/` | О13 |
| C14 | `app/server/db/tx.js` holds only `withPlatform` with a one-statement body in M1 | as written | the requirement lists the file; M1 has one reader; transactions under `set local role` come with M2 | О14 |

---

## 3. Files, roles, owners, order

The product files, the deploy and CI files and the runbooks are written by BACKEND-DEV (lane FULL; the runbooks by the
same role, REQ-109); the files under `app/test/` by TEST-DESIGNER at step 5. New unless said. The tree of
`app/` (★ = REQ-109):

```
app/
  package.json  package-lock.json  .npmrc  jsconfig.json  eslint.config.js  .prettierignore  README.md  .env.example
  vercel.json★  .vercelignore★  Dockerfile  compose.yaml
  api/index.js★                       the Vercel entry: restores the path from __p, calls createFunctionApp
  server/
    app.js                            createApp(deps); createFunctionApp(config, inject)
    config.js                         readConfig(env), runtimeUrl(), nodeFloorRefusal(), ConfigError, LOGIN_ROLE
    node-main.js                      the Node and Docker entry
    static.js                         loadStaticSite(dir): app/public in memory
    http/errors.js                    error codes, HttpError, errorBody(), UNIFORM_404
    http/body.js                      readBody(), readText(), BODY_LIMIT
    http/request-id.js                newRequestId()
    http/origin.js                    parseOrigin(), originsFor(), isPreviewHost()
    http/site-gate.js                 gateClosed(value)
    http/headers.js★                  securityHeaders({ https }), API_CACHE
    routes/index.js                   routeTable(deps)
    routes/health.js★                 healthHandler(deps), HEALTH_DEADLINE_MS
    db/index.js                       createDb(adapter), openRuntimeDb(config, o), DbError, toDbError()
    db/pg.js                          createPgAdapter(url, o), connectPgSession(url, o)  — the only importer of pg
    db/pglite.js                      openPglite(dir)  — the only importer of @electric-sql/pglite
    db/tx.js                          withPlatform(db, fn)
    db/selfcheck.js                   SELFCHECK_SQL, judgeRole(row), runSelfcheck(adapter)
    db/migrate.js                     migrate(o), readMigrations(dir), the CLI
  db/migrations/0001_init.sql
  public/index.html  public/404.html  public/gate.html     (no CSS file, no icon file: О12)
  scripts/vercel-build.js★  scripts/smoke.js★  scripts/check-public.js★
  test/unit/   npmrc  import-boundaries  no-string-sql  node-floor  db-config  body  ci-workflow  docker-files
               headers-parity★  vercel-config★  smoke★  check-public★  vercel-build★  runbooks★        (.test.js)
  test/int/    node-main  migrate  selfcheck  site-gate  logging  db-down
               api-entry★  health★  headers★  smoke-local★                                          (.test.js)
  test/pg/     migrate-pg  selfcheck-pg                                                             (.test.js)
  test/fixtures/helpers.js  test/fixtures/db.js  test/fixtures/pg-env.js                            (О13)
.github/workflows/app.yml
.gitignore                            six lines appended (section 4.18)
docs/runbooks/release.md★  docs/runbooks/incident.md★
```

Order of work: the shared contract first — `config.js`, `http/errors.js`, the adapter contract of `db/index.js`
(section 4.8) — then the sides (the db layer, the HTTP layer, the entries), then the scripts, the deploy files and the
CI, then the runbooks (section 15). One developer writes the product side and TEST-DESIGNER the tests; no file has two writers. Shared files of PLAN
§4.7 touched here for the first time: `app/db/migrations/` (number 0001), `app/package*.json`, `.github/workflows/app.yml`,
`app/server/routes/index.js` — no other run writes them now (`context.parallel_work_now` names only the block REQ-103).

---

## 4. Interfaces

### 4.1 The configuration — `app/server/config.js`

`readConfig(env: Record<string, string | undefined>) → Config`, throws `ConfigError { code, message }`. A value that
is an empty string counts as unset. Messages name the variable, never its value (criterion 8: «no error text of
config.js holds either password»).

| Variable | Read by | Type, default | Rule | Error code | Message (the whole line after `sai: refused: ` or `migrate: `) |
|---|---|---|---|---|---|
| `NODE_ENV` | config, node-main | `production` or other | `production` → the rules marked (P) | — | — |
| `PORT` | config | integer 0–65535, default `0` | `^\d{1,5}$`, ≤ 65535 | `E_CONFIG_PORT` | `PORT is not a port number` |
| `HOST` | config | default `127.0.0.1` | any text; the Dockerfile sets `0.0.0.0` | — | — |
| `DATABASE_URL` | config | `postgres://` or `postgresql://` | (P) required; parsed by WHATWG `URL` | `E_CONFIG_DATABASE_URL`, `E_CONFIG_URL` | `DATABASE_URL is required when NODE_ENV=production`; `DATABASE_URL is not a postgres:// address` |
| `DATABASE_URL_UNPOOLED` | config | as above | the migration URL when set (О23) | `E_CONFIG_URL` | `DATABASE_URL_UNPOOLED is not a postgres:// address` |
| `APP_DB_PASSWORD` | config, migrate | text | set → the runtime URL uses sai_app_login and this password; the runner's password step runs | — | — |
| `APP_ORIGIN`, `PREVIEW_ORIGIN` | config | an origin | `http:` or `https:`, path `/`, no user, query or fragment; unset → derived from the bound port (`http://127.0.0.1:<p>`, `http://localhost:<p>`) in node-main, none in the function | `E_CONFIG_ORIGIN` | `APP_ORIGIN is not an origin` / `PREVIEW_ORIGIN is not an origin` |
| `APP_VERSION` | config | text, default `dev` | — | — | — |
| `SITE_GATE` | config | text | any non-empty value closes (О6 of 0116) | — | — |
| `LOG_LEVEL` | config | `info` (default) or `debug` | other → refused | `E_CONFIG_LOG` | `LOG_LEVEL is not info or debug` |
| `MIGRATE_ON_BUILD` | vercel-build | `1` or other | only `1` runs the migration step | — | — |
| `PGLITE_DIR` | config (node-main, migrate) | a folder | outside production only (О8) | `E_CONFIG_TEST_ONLY` | `PGLITE_DIR and MIGRATIONS_DIR are refused when NODE_ENV=production` |
| `MIGRATIONS_DIR` | config (node-main, migrate) | a folder | outside production only (О8) | `E_CONFIG_TEST_ONLY` | as above |

`Config` = `{ production, port, host, databaseUrl, migrationUrl, appDbPassword, appOrigin, previewOrigin, version,
siteGate, logLevel, pgliteDir, migrationsDir }`. Rules that always hold: `databaseUrl` is `runtimeUrl(DATABASE_URL,
APP_DB_PASSWORD)` when both are set, else `DATABASE_URL` or null; `migrationUrl` is `DATABASE_URL_UNPOOLED ??
DATABASE_URL`; with `production` true, `databaseUrl` is never null and `pgliteDir`, `migrationsDir` are null. The
order of the production checks is: `DATABASE_URL` first, then the test-only variables (criterion 4 needs the line
that names `DATABASE_URL`).

`runtimeUrl(databaseUrl, password) → string`: a WHATWG `URL` of `databaseUrl` with `username = "sai_app_login"` and
`password = encodeURIComponent(password)`; host, port, path and the whole query stay (F10: the setter alone breaks a
password with `%`). `LOGIN_ROLE = "sai_app_login"`.

`nodeFloorRefusal(version) → string | null`: `null` for `v22.23.4` and every `v22.x.y` above it; otherwise the one line
`sai: refused: Node <version> is below the floor 22.23.4 (Node 22.x, at least 22.23.4)` (also for `v23.…`, a text that is
not `vX.Y.Z`, and every `v21.…`). `NODE_FLOOR = "22.23.4"`. Called only by `server/node-main.js` with `NODE_ENV=production`
(criterion 6, ARCH §3).

### 4.2 Error codes and plain lines — `app/server/http/errors.js`

The JSON body of every error is `{"error":"<code>"}` (one key, no other text). `HttpError { code, status }`;
`errorBody(code) → string`; `UNIFORM_404 = '{"error":"not_found"}'`.

| Code | Status | When |
|---|---|---|
| `not_found` | 404 | every unknown `/api` address, `/api/p/*` in M1 on both hosts, a refused `__p` of the function entry — the uniform 404 |
| `bad_request` | 400 | reserved for M2 input checks (not answered in M1) |
| `body_too_large` | 413 | a body above 65 536 bytes, by `Content-Length` or by counting |
| `bad_encoding` | 400 | `readText` on bytes that are not UTF-8 |
| `site_closed` | 503 | every `/api` address while `SITE_GATE` is set (the gate answer) |
| `server_error` | 500 | an exception in a handler (`app.onError`); no text, no stack |
| `server_config` | 503 | the function entry when `readConfig` throws (Vercel cannot exit) |

The plain lines of the entries (stderr, one line, no stack, no address, no user name, no password):

| Program | Line | Exit |
|---|---|---|
| node-main | `sai: refused: <ConfigError message>` | 1 |
| node-main | the floor line of 4.1 | 1 |
| node-main | `sai: refused: the database role of the app is a superuser or bypasses row security` | 1 |
| node-main | `sai: the database does not answer; the pages are served and /api/health answers 503` (a warning; it keeps running) | — |
| migrate | `migrate: <ConfigError message>` | 2 |
| migrate | `migrate: refused: set DATABASE_URL (or PGLITE_DIR outside production)` | 2 |
| migrate | `migrate: refused: <name> is not a migration file name` | 1 |
| migrate | `migrate: refused: <name> changed after it was applied` / `… was applied and its file is missing` | 1 |
| migrate | `migrate: refused: <name> failed (<SQLSTATE>)` (only the five-character code of the database, never its message) | 1 |
| migrate | `migrate: refused: the password step of sai_app_login failed` | 1 |
| migrate | `migrate: refused: the database does not answer` / `migrate: refused: no answer from the database` (the 12 s guard) | 2 |
| migrate (stdout) | `migrate: applied <name>`, `migrate: the password of sai_app_login is set`, `migrate: nothing to apply` | 0 |
| vercel-build | section 4.13 | — |
| smoke | section 4.13 | — |

### 4.3 The app — `app/server/app.js`

`createApp(deps: AppDeps) → Hono`. `AppDeps = { config: { siteGate: boolean, version: string }, origins: { app:
string, preview: string | null }, db: Db | null, site: StaticSite | null, migrations: ReadonlyArray<{ name, sha256 }>,
log: (entry) => void, now?: () => number }`. The Hono instance is typed with the context variables `tag` (`{ route,
code? }`) and `body` (`Uint8Array`).

Middleware order (each in the same request, protection before the action, section 10):

1. **Request id, headers, log** (outermost): a new `X-Request-Id` (`newRequestId()`, never the incoming header); after
   the inner answer: the security headers of 4.6 for the scheme of the request URL (`https:` → the https set), plus
   `Cache-Control: no-store` for `/api` and `/api/*`; `Server` and `X-Powered-By` deleted; one log line
   `{ ts, level: "info", req_id, route, status, ms[, code] }` where `route` is one label of the closed set `gate`,
   `body`, `preview_redirect`, `api_404`, `static`, `static_404`, `/api/health`, `unknown` — never the path, the query,
   a header or the body.
2. **Site gate**: `config.siteGate` true → `/api`, `/api/*` (or any path when `site` is null) answer 503
   `{"error":"site_closed"}`; every other path answers 503 with the bytes of `public/gate.html`; no further middleware
   runs, so the database is never called (criterion 9).
3. **Body**: for a request with a body, `readBody(request)` once (limit 65 536; never through `request.clone()`, F27);
   the bytes go to the context variable `body`; 413 `{"error":"body_too_large"}` above the limit.
4. **Preview host**: `isPreviewHost(url, origins)` → `/api/p/*` answers the uniform 404 (M1 has no preview route);
   every other path answers 307 with `Location = new URL(path + search, origins.app)` — the origin always from the
   configuration, never from `Host` or `X-Forwarded-Host`.
5. **Routes** of `routeTable` (4.7).
6. **Fallback**: `/api`, `/api/*` (or any path when `site` is null) → 404 `UNIFORM_404`; `GET`/`HEAD` of a path that
   `site.lookup` finds → 200 with its bytes and type; any other → 404 with the bytes of `public/404.html`.
7. `app.onError` → 500 `{"error":"server_error"}`, `code` in the log line.

`createFunctionApp(config, inject = {}) → Promise<Hono>`: the app of the function: `db` = `createDb(inject.adapter)`
or `createDb(createPgAdapter(config.databaseUrl, { connectTimeoutMs: 4000 }))` (null with `siteGate` or without a URL),
`site` null, `migrations` from `readMigrations(defaultMigrationsDir())`, origins from `originsFor(config, null)`. The
dynamic imports of `./db/index.js`, `./db/migrate.js`, `./db/pg.js`, `./http/origin.js` are literal (criterion 3).

| Request (local, both hosts on one port p) | Answer |
|---|---|
| `GET /` on `127.0.0.1:p` | 200, `text/html; charset=utf-8`, the bytes of `public/index.html` |
| `GET /index.html` | 200, the same bytes |
| `GET /nope`, `/a/b.html`, `/../package.json`, `/%2e%2e/package.json`, `/..%2fpackage.json`, `/.env`, `/server/app.js`, `/db/migrations/0001_init.sql`, `//etc/passwd`, `/css/` | 404, the bytes of `public/404.html` (the map holds only the files of `public/`; the URL parser folds `..` and `%2e%2e` into `/package.json`, which is not in the map) |
| `GET /api/x`, `/api/x/y/z`, `/api/p/x` | 404, `application/json; charset=utf-8`, `{"error":"not_found"}` |
| `GET /api/health` | section 4.7 |
| any path on `localhost:p` except `/api/p/*` | 307, `Location: http://127.0.0.1:p<path><query>` |
| `/api/p/*` on `localhost:p` | the uniform 404 |
| `Host: evil.example` | served as the app host; a 307 never names it |
| any request with a body > 65 536 bytes | 413 `{"error":"body_too_large"}` |
| any request with `SITE_GATE` set | 503 (gate answer) |

### 4.4 The Node entry — `app/server/node-main.js`

`node server/node-main.js`, no arguments. Imports from `node:http` only `{ createServer }`, and `{ getRequestListener }`
from `@hono/node-server`. Start order:

1. `NODE_ENV=production` → `nodeFloorRefusal(process.version)`; a line → stderr, exit 1.
2. `readConfig(process.env)`; `ConfigError` → `sai: refused: <message>`, exit 1.
3. `loadStaticSite()` (4.5) and `readMigrations(config.migrationsDir ?? defaultMigrationsDir())` (4.9).
4. `SITE_GATE` set → no database at all (no adapter, no PGlite, no statement). Else `openRuntimeDb(config, {
   connectTimeoutMs: 4000 })` (4.8): no statement on Postgres; on PGlite the migrations and the switch.
5. With a database: `db.ensureSafe()` raced with a 4000 ms timer → `unsafe` → the role line, exit 1; `down` (refused,
   timeout or silent) → the warning line, the server starts.
6. `createServer()`, `listen(config.port, config.host)`; in the listen callback: `originsFor(config, port)`,
   `createApp(…)`, `server.on("request", getRequestListener(app.fetch))`, then stdout gets exactly
   `http://127.0.0.1:<p>/` and `http://localhost:<p>/` (two lines, the same `p`). Later stdout lines are the JSON log.
7. `SIGTERM` / `SIGINT` (once): `server.close()`, `server.closeIdleConnections()`, `db.close()`,
   `server.closeAllConnections()`; a 3000 ms timer (unref) ends the process with 0 if anything still holds it. Exit 0.

### 4.5 Static files — `app/server/static.js`

`loadStaticSite(dir = PUBLIC_DIR) → StaticSite { lookup(pathname) → StaticFile | null, notFound: StaticFile, gate:
StaticFile }`, `StaticFile = { bytes: Uint8Array<ArrayBuffer>, type }`. Reads the folder once at start, recursively;
a file or folder name must match `^[A-Za-z0-9_-][A-Za-z0-9._-]*$` (so no dot-names, no `..`) and an extension of the
closed map (`.html` `text/html; charset=utf-8`, `.css`, `.js` `text/javascript; charset=utf-8`, `.svg`, `.png`, `.ico`,
`.txt`), else it is not served; one file ≤ 2 MiB, all ≤ 8 MiB, else the start fails; `/index.html`, `/404.html`,
`/gate.html` must exist. `lookup("/")` is the index; every other path is looked up exactly, never decoded and never
joined to a folder. `PUBLIC_DIR = new URL("../public/", import.meta.url)`.

### 4.6 The HTTP modules

- `http/headers.js`: `securityHeaders({ https: boolean }) → Array<[name, value]>` — exactly the list of REQ-109
  criterion 4 (the https set has `Strict-Transport-Security: max-age=31536000`, the http set has not);
  `API_CACHE = ["Cache-Control", "no-store"]`.
- `http/body.js`: `BODY_LIMIT = 65536`; `readBody(request, limit?) → Promise<Uint8Array>` (a `Content-Length` above the
  limit → `HttpError("body_too_large")` before reading; else the stream is counted chunk by chunk and its reader
  cancelled, not awaited through a tee, when the count passes the limit); `readText(request, limit?) → Promise<string>`
  (`TextDecoder("utf-8", { fatal: true })`; a decoding error → `HttpError("bad_encoding")`).
- `http/request-id.js`: `newRequestId() → string` = `crypto.randomUUID()`.
- `http/origin.js`: `parseOrigin(text) → string | null`; `originsFor(config, port | null) → { app, preview }`;
  `isPreviewHost(url, origins) → boolean` (the URL's `host`, lower case, equals the host of `origins.preview`).
- `http/site-gate.js`: `gateClosed(value) → boolean` = a string that is not empty.

### 4.7 Routes — `app/server/routes/index.js`, `routes/health.js`

`routeTable(deps) → ReadonlyArray<{ method, path, meta, handler }>`, frozen; M1 holds one row: `GET /api/health`,
`meta { tenant: false }`. The isolation enumeration of M2 reads this table.

`healthHandler({ db, migrations, version, deadlineMs = 4000 }) → () => Promise<{ status, body }>`. `HEALTH_DEADLINE_MS
= 4000` (the criterion bound is 5000 ms, decisions/0116 О11; the border is kept away from it, AP-084). One statement:
`select name, sha256 from schema_migrations` through `db.query` (so the selfcheck runs first when it has not passed).
The body has exactly `ok, db, role, migrations_pending, version, node`, in this order:

| Situation | Status | ok | db | role | migrations_pending |
|---|---|---|---|---|---|
| answered, role safe, every file applied with its sha256 | 200 | true | `"ok"` | `"ok"` | 0 |
| answered, a file not applied (or applied with another sha256) | 503 | false | `"ok"` | `"ok"` | n ≥ 1 |
| the selfcheck refused (rolsuper or rolbypassrls true) | 503 | false | `"ok"` | `"unsafe"` | `null` |
| refused, timed out (4000 ms) or silent | 503 | false | `"down"` | `"unknown"` | `null` |
| `db` null (no URL in the function) | 503 | false | `"down"` | `"unknown"` | `null` |

`version` is `APP_VERSION` or `dev`; `node` is `process.version`. No other key, no text of an error.

### 4.8 The database layer — `app/server/db/`

**The adapter contract** (shared by `pg.js`, `pglite.js` and the test doubles): `Adapter = { query(text: string,
params?: unknown[]) → Promise<{ rows: any[] }>, exec(text: string) → Promise<void>, close() → Promise<void> }`. `query`
is one statement with bound parameters; `exec` is the simple protocol, several statements, no parameters (the
migration files and constant statements). Every error is a `DbError`.

- `db/index.js`: `class DbError { code: "E_DB_DOWN" | "E_DB_ROLE" | "E_DB_QUERY", sqlstate: string | null }` with the
  fixed messages `the database does not answer`, `the database role is unsafe`, `a database statement failed`;
  `toDbError(err)` — an error with a five-character SQLSTATE outside class `08` → `E_DB_QUERY` with that state;
  anything else → `E_DB_DOWN`; the client's message is never kept (F11).
  `createDb(adapter) → Db { ensureSafe(), roleState() → "unchecked" | "ok" | "unsafe", query(text, params), close() }`:
  `query` awaits `ensureSafe()` first; `ensureSafe` runs `runSelfcheck(adapter)` once (one promise shared by parallel
  callers), keeps `ok` or `unsafe` for the life of the object, stays `unchecked` after a `DbError` of the selfcheck
  (so the next use runs it again — the gate's F13), and throws `DbError("E_DB_ROLE")` while `unsafe`.
  `openRuntimeDb(config, { connectTimeoutMs }) → Promise<Db>`: with `config.databaseUrl` → `createDb(createPgAdapter(…))`
  (no statement); else PGlite: `openPglite(config.pgliteDir)`, `migrate({ adapter, dir, password: null })`,
  `adapter.switchToLoginRole()`, then `createDb(adapter)`. Literal dynamic imports of `./pg.js`, `./pglite.js`,
  `./migrate.js`, so the image (no dev packages) never loads PGlite.
- `db/pg.js`: `createPgAdapter(url, { connectTimeoutMs, max = 3 })` — a `pg.Pool` with `connectionTimeoutMillis`,
  `idleTimeoutMillis: 10000`, an `error` listener that drops idle errors; `connectPgSession(url, { connectTimeoutMs })`
  — one `pg.Client` for the runner (a session lock needs one session).
- `db/pglite.js`: `openPglite(dir | null)` → the adapter plus `switchToLoginRole()`, which runs the one constant
  statement `set session authorization sai_app_login`. It is the PGlite reading of decisions/0116 О10 and runs only
  here (criterion 8: never with a `DATABASE_URL`).
- `db/selfcheck.js`: `SELFCHECK_SQL = "select rolsuper, rolbypassrls from pg_roles where rolname = session_user"`;
  `judgeRole(row) → "ok" | "unsafe"` (`ok` only when both are exactly `false`; no row → unsafe); `runSelfcheck(adapter)`.
  `session_user`, not `current_user`: a superuser that ran `set role sai_app_login` can reset it.
- `db/tx.js`: `withPlatform(db, fn)` — M1: `fn` gets `db.query`; the body of M2 (`begin`, `set local role sai_app`,
  `set_config('app.role', 'platform', true)`, `commit` on one connection) needs a `transaction` method of the adapter,
  which is not in this contract yet (О14).

### 4.9 The migration runner — `app/server/db/migrate.js`

Exports: `NAME = /^\d{4}_[a-z0-9_]+\.sql$/`, `LOCK_KEY = 7300108`, `CONNECT_TIMEOUT_MS = 10000`, `class MigrateError {
code, message }`, `defaultMigrationsDir()`, `readMigrations(dir) → Array<{ name, text, sha256 }>`, `migrate({ adapter,
dir, password, log }) → Promise<{ applied: string[] }>`; the CLI runs only when the file is the started script.

`migrate` steps and the outcome of each (AP-072):

| # | Step | Success | Failure → what stays |
|---|---|---|---|
| 1 | `readMigrations(dir)`: every entry of the folder, sorted, must match `NAME`; bytes → sha256 | a list | `E_MIGRATE_NAME` before any statement; nothing changed |
| 2 | `select pg_advisory_lock($1)` (session lock; per database, F10) | held | `DbError` → the CLI's exit 2; nothing changed |
| 3 | `select to_regclass('public.schema_migrations') is not null as present`; when present `select name, sha256 from schema_migrations order by name` | the applied map | as 2 |
| 4 | every applied row has its file with the same sha256 | — | `E_MIGRATE_MISSING` / `E_MIGRATE_CHANGED` before any statement of a file; nothing changed |
| 5 | per file not applied, in name order: `exec("begin")`, `exec(<file text>)`, `query("insert into schema_migrations (name, sha256) values ($1, $2)", [name, sha256])`, `exec("commit")` | one row per file, `migrate: applied <name>` | `exec("rollback")`; `E_MIGRATE_FAILED` with the SQLSTATE; the failed file leaves no object and no row (transactional DDL, F9), the earlier files of this run stay applied |
| 6 | `password` not null: `exec("begin")`, `query("select set_config('sai.app_db_password', $1, true)", [password])`, `exec("set local log_parameter_max_length_on_error = 0")`, `exec(<the guarded block>)`, `exec("commit")` | `migrate: the password of sai_app_login is set` | `exec("rollback")`; `E_MIGRATE_PASSWORD`; the role keeps its earlier password; no error text carries the value |
| 7 | finally `select pg_advisory_unlock($1)` (errors ignored), then the CLI closes the session | — | — |

The guarded block (one constant text, no parameter, no value): `do $$ begin execute format('alter role sai_app_login
password %L', current_setting('sai.app_db_password')); exception when others then raise exception 'sai: the password
step failed' using errcode = 'P0001'; end $$`. A migration file holds only statements that may run inside a
transaction (no `begin`, `commit`, `create database`, `create index concurrently`, `vacuum`) — written in
`app/README.md`.

The CLI: `readConfig`; the URL is `config.migrationUrl` (owner role; О23) or `config.pgliteDir`; neither →
the line of 4.2, exit 2. A guard timer of `CONNECT_TIMEOUT_MS + 2000` = 12 000 ms (unref) ends the process with exit 2
and its line (criterion 15: within 15 000 ms). Exit 0 / 1 / 2 as in 4.2. `migrate.js` never runs the selfcheck: it
runs as the owner role, which in Docker and the `pg` job is the image's superuser.

### 4.10 Migration 0001 — `app/db/migrations/0001_init.sql`

In this order, no password and no `org_id` anywhere:

1. `create table schema_migrations (name text primary key check (name ~ '^[0-9]{4}_[a-z0-9_]+[.]sql$'), sha256 text not
   null check (sha256 ~ '^[0-9a-f]{64}$'), applied_at timestamptz not null default now())`.
2. `create table platform_settings (key text primary key check (key in ('kill_switch', 'test_mode', 'registration_mode',
   'caps', 'timers', 'max_concurrent_builds', 'read_only', 'setup_done')), value jsonb not null, updated_by uuid,
   updated_at timestamptz not null default now())` — no row (decisions/0116 О16); `updated_by` gets its foreign key
   when `users` exists (M2).
3. One `do` block with three inner blocks: `create role sai_app nologin nosuperuser nobypassrls`, `create role
   sai_preview nologin nosuperuser nobypassrls`, `create role sai_app_login login nosuperuser nobypassrls`, each with
   `exception when duplicate_object or unique_violation then null` (a role of the server is kept as it is: the second
   database of criterion 8; `unique_violation` covers two databases of one server migrating at once, whose advisory
   locks do not meet, F10).
4. `grant sai_app to sai_app_login; grant sai_preview to sai_app_login; grant usage on schema public to sai_app,
   sai_preview; grant select on schema_migrations to sai_app;` (the health read; `platform_settings` gets its grants
   with its first reader).

With `APP_DB_PASSWORD` unset (PGlite, a first deploy before S3) the login role has no password, so no password login
is possible; PGlite uses it only through the session switch (N3).

### 4.11 The Vercel entry — `app/api/index.js` (REQ-109)

Imports only `../server/app.js` (`createFunctionApp`) and `../server/config.js` (`readConfig`, `ConfigError`).
Exports: `restorePath(url: URL) → string | null`, `createEntry(makeApp) → { fetch(request) }`, and `default
createEntry(() => createFunctionApp(readConfig(process.env)))`.

- `restorePath`: exactly one `__p` (`searchParams.getAll("__p").length === 1`), length 1–2048, split by `/`, every
  segment matches `^[A-Za-z0-9._~-]+$` and is neither `.` nor `..` → `/api/<segments joined by />`; else `null`.
- `fetch(request)`: the app is built once (a failed build with `ConfigError` → one JSON log line with the code, and the
  answer 503 `{"error":"server_config"}` with `Cache-Control: no-store`; the next request tries again). A request
  whose path is not `/api/index` goes to the app as it is. For `/api/index`: the target URL has the request's origin
  (never `__p`), the path `restorePath(url) ?? "/api/index"` (so a refused value gets the uniform 404 of the app), and
  every query parameter but `__p` in its order; a new `Request(target, { method, headers, body (not for GET/HEAD),
  duplex: "half" })` goes to `app.fetch`.

### 4.12 The pages — `app/public/` (Russian only, decisions/0116 О15)

Each page: `<!doctype html>`, `<html lang="ru">`, `<meta charset="utf-8" />`, `<meta name="viewport"
content="width=device-width, initial-scale=1" />`, `<meta name="color-scheme" content="light dark" />` (the dark
scheme uses the browser's own colours: measured 18.73 : 1, F16), `<meta name="robots" content="noindex" />`, `<link
rel="icon" href="data:," />` (no `/favicon.ico` request, F16; `img-src 'self' data:`), no style, no script, no address.

| File | `<title>` | Body |
|---|---|---|
| `index.html` | `Sai — закрытое тестирование` | `<main><h1>Sai — закрытое тестирование</h1><p>Sai работает в тестовом режиме: вход по приглашению, заказы не принимаются.</p></main>` (the sentence of PLAN M1) |
| `404.html` | `Страница не найдена — Sai` | `<main><h1>Страница не найдена</h1><p><a href="/">На главную</a></p></main>` |
| `gate.html` | `Sai — сервис временно остановлен` | `<main><h1>Сервис временно остановлен владельцем</h1></main>` (the words of ARCH §14.9) |

### 4.13 The scripts — `app/scripts/` (REQ-109)

**`vercel-build.js`**: exports `runBuild(deps) → exit code` and `insideGitTree(dir) → boolean`; `deps = { env, migrate()
→ code, checkPublic() → code, publicDir, outDir, log(line) }`. The CLI: `publicDir = outDir = app/public`, the steps
are `node server/db/migrate.js` and `node scripts/check-public.js` as child processes (`stdio: inherit`).

| Situation | Steps | Output folder | Exit | Line |
|---|---|---|---|---|
| `SITE_GATE` set, `outDir` is not `publicDir`, or not inside a git tree | none (no migrate, no database call, no check-public) | emptied, then only `index.html` = the bytes of `public/gate.html` | 0 | `vercel-build: SITE_GATE is set: the output is the gate page only; no migration` |
| `SITE_GATE` set, `outDir` is `publicDir` inside a git working tree (a local run) | none | unchanged | 2 | `vercel-build: refused: the closed build replaces the output folder and runs only in the uploaded copy, not in a git working tree` |
| open, `MIGRATE_ON_BUILD=1` | migrate, then check-public | `outDir` = `publicDir` (Vercel) or a copy of it | 0 | `vercel-build: done` |
| open, migrate ≠ 0 | migrate only | unchanged | 1 | `vercel-build: refused: the migration step ended with code <n>` |
| open, without `MIGRATE_ON_BUILD` | check-public | as above | 0 | `vercel-build: done` |
| open, check-public ≠ 0 | (migrate,) check-public | unchanged | 1 | `vercel-build: refused: check-public found forbidden items` |

`insideGitTree(dir)`: a `.git` entry in `dir` or any parent up to the root. On Vercel the uploaded `app/` has no `.git`
(the allowlist of `.vercelignore`); whether the build machine adds one is S1 (section 7).

**`smoke.js`**: exports `nodeAtFloor(version)`, `headerFailures(headers, https) → string[]`, `isUniform404Body(text)`,
`parseArgs(argv) → options | null`, `runSmoke(options, say, rand?) → Promise<code>`. Call: `node scripts/smoke.js --base
<http(s) URL> [--preview <URL>] [--expect-version <v>]`; a wrong call or a scheme other than `http:`/`https:` → the usage
line on stderr, exit 2, no request. Requests: `fetch` with `redirect: "manual"`, each with its own 5000 ms limit inside
one 12 000 ms limit (`AbortSignal.any`). Checks, one stdout line each (`smoke: ok <name>` or `smoke: FAIL <name>:
<reason>`), in this order: `/ 200`; `headers of /` (CSP present without `unsafe-inline`, `nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy` present, `X-Robots-Tag: noindex`, no `X-Powered-By`, no digit in `Server`, and for an https base
`max-age=31536000` in HSTS); `/api/health 200`; `/api/health version` (a string, equal to `--expect-version` when
given); `/api/health node` (`nodeAtFloor`: v22.x ≥ 22.23.4); `nested /api 404` (`/api/<r1>/<r2>` → 404, JSON type, one key
`error` with a string); `random path 404` (`/<r>` → 404); with `--preview`, `preview 307` (`/` of the preview → 307
whose `Location` origin equals the base origin). A network failure or a time-out → one line `smoke: FAIL the site did not
answer`, exit 1. Exit 0 when every check passed, else 1.

**`check-public.js`**: exports `checkText(rel, text) → Array<{ file, item }>`, `checkPublic(dir)`. CLI: `node
scripts/check-public.js [dir]` (default `app/public`) → one line `check-public: <file>: <item>` per finding (exit 1) or
`check-public: app/public is clean` (exit 0). Files read: `.html .css .js .svg .txt .json`. Rules (REQ-109 criterion
7; identifier borders = no `A-Za-z0-9_$` on either side, AP-120): the three phrases «Claude Code», «Около 2 минут»,
«типовой вариант», any letter case, any white space between the words; `innerHTML` (exact case, whole identifier); in
every tag, after its quoted attribute values are replaced by `""`, an attribute name `style` or `on<letters>` before `=`
(any case); a `<style` tag; a `<script` tag without `src`; `REQ-` before a digit; the whole words `handoff`, `handoffs`,
`orch`, `decisions`, any case; `Math.random` in a file under `office/`; `http://` or `https://` after the values of
`xmlns` and `xmlns:*` attributes are removed.

### 4.14 Package files

`app/package.json` (exact):

| Key | Value |
|---|---|
| `name`, `version`, `private`, `type` | `sai-app`, `0.1.0`, `true`, `module` |
| `engines` | `{ "node": "22.x" }` |
| `scripts.start` | `node server/node-main.js` |
| `scripts.migrate` | `node server/db/migrate.js` |
| `scripts.format` | `prettier --write .` |
| `scripts.test:unit` | `node --test "test/unit/**/*.test.js"` |
| `scripts.test:int` | `node --test --test-concurrency=1 "test/int/**/*.test.js"` |
| `scripts.test:pg` | `node --test --test-concurrency=1 "test/pg/**/*.test.js"` |
| `scripts.vercel-build` | `node scripts/vercel-build.js` |
| `scripts.check` | `prettier --check . && eslint . --max-warnings 0 && tsc --noEmit -p jsconfig.json && node scripts/check-public.js && npm run test:unit && npm run test:int` |
| `dependencies` | `@hono/node-server` 2.1.6, `hono` 4.13.16, `pg` 8.23.1 |
| `devDependencies` | `@electric-sql/pglite` 0.5.15, `@eslint/js` 10.0.1, `@types/node` 22.20.5, `@types/pg` 8.23.1, `eslint` 10.11.0, `globals` 17.12.0, `prettier` 3.9.9, `typescript` 6.0.3 |

No `preinstall`, `install`, `postinstall`, `prepare`. The `check` chain is the one of ARCH §3 for M1 (`vendored` and
`content` come with R1.2 at their places after `check-public`). The lockfile is made once with `npm install
--before=<the date 14 days before the install>` and then used only by `npm ci` (F5).

- `app/.npmrc`: `save-exact=true`, `engine-strict=true`, `ignore-scripts=true` (three lines).
- `app/jsconfig.json`: `target es2023`, `module` and `moduleResolution` `nodenext`, `checkJs`, `allowJs`, `noEmit`,
  `strict`, `skipLibCheck`, `types ["node"]`; `include` `api/**/*.js`, `server/**/*.js`, `scripts/**/*.js`,
  `public/**/*.js`, `eslint.config.js` (О3); `exclude` `node_modules`.
- `app/eslint.config.js`: `@eslint/js` recommended; `ecmaVersion 2024`, `sourceType module`, Node globals; rules
  `no-unused-vars` (args `^_` allowed), `eqeqeq`, `prefer-const` (the rules of `tools/`); browser globals for
  `public/**/*.js`.
- `app/.prettierignore`: `node_modules`, `package-lock.json`.
- `app/.env.example`: the 14 names of 4.1 (`NODE_ENV`, `PORT`, `HOST`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `APP_DB_PASSWORD`, `APP_ORIGIN`, `PREVIEW_ORIGIN`, `APP_VERSION`, `SITE_GATE`, `LOG_LEVEL`, `MIGRATE_ON_BUILD`,
  `PGLITE_DIR`, `MIGRATIONS_DIR`) and the three of the `pg` tests (`SAI_PG_HOST`, `SAI_PG_PORT`,
  `SAI_PG_SUPERUSER_PASSWORD`), each `NAME=` with an empty value, with a comment line.
- `app/README.md` sections: «The check» (`cd app && npm ci && npm run check`, the six steps, «# fail 0», «# skipped
  0», «# todo 0»), «Local start» (`cd app && PORT=0 node server/node-main.js`, the two printed addresses, in-memory
  PGlite), «Test levels» (unit, int, pg — `npm run test:pg` with the three variables, in the `pg` job of `app.yml`),
  «Migrations» (the rule of 4.9 on statements inside a transaction; the password step; the named limit of F10),
  «Deploy» (`npx vercel@64.1.0`, never installed; the runbooks `docs/runbooks/release.md` and `incident.md`).

### 4.15 Vercel files (REQ-109)

`app/vercel.json`: `framework` null, `buildCommand` `npm run vercel-build`, `outputDirectory` `public`, `regions`
`["fra1"]`, `functions` `{ "api/index.js": { "maxDuration": 30 } }`, `rewrites` `[{ "source": "/api/:path*",
"destination": "/api/index?__p=:path*" }]`, `headers` `[{ "source": "/(.*)", "headers": [<the https set of 4.6 as
{ key, value }>] }]`. No `redirects` (decisions/0116 О8).

`app/.vercelignore` (an allowlist): `/*` then `!api/`, `!server/`, `!public/`, `!content/`, `!scripts/`, `!db/`,
`!package.json`, `!package-lock.json`, `!.npmrc`, `!vercel.json` (comment lines allowed).

### 4.16 Docker files

`app/Dockerfile` (context `app/`), in this order, line 1 being the `FROM` line (no comment before it, criterion 12 «starts `FROM`»): `FROM node:22.23.4-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d` (F13);
`WORKDIR /app`; `COPY package.json package-lock.json .npmrc ./`; `RUN npm ci --omit=dev`; `COPY server ./server`;
`COPY public ./public`; `COPY db ./db`; `USER node`; `ENV NODE_ENV=production`; `ENV HOST=0.0.0.0`; `ENV PORT=8080`;
`EXPOSE 8080`; `HEALTHCHECK --interval=5s --timeout=4s --start-period=10s --retries=6 CMD ["node", "-e", "<a GET of
http://127.0.0.1:8080/api/health through node:http; exit 0 on 200, else 1>"]` (the slim image has no curl); `CMD ["sh",
"-c", "node server/db/migrate.js && exec node server/node-main.js"]`. No `.env`, `test/`, `scripts/` or `api/` enters
the image.

`app/compose.yaml`: services `db` and `web` only; one volume `db-data`.

| Service | Keys |
|---|---|
| `db` | `image: postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac`; `environment: POSTGRES_DB: sai`, `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}`; `volumes: db-data:/var/lib/postgresql/data`; `healthcheck: ["CMD", "pg_isready", "-U", "postgres", "-d", "postgres"]`, interval 2s, timeout 3s, retries 30 (database `postgres`, so the probe of N5 never counts it) |
| `web` | `build: .`; `environment: PORT: "8080"`, `DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD:?required}@db:5432/sai`, `APP_DB_PASSWORD: ${APP_DB_PASSWORD:?required}`, `APP_ORIGIN: http://127.0.0.1:8080`, `PREVIEW_ORIGIN: http://localhost:8080`; `ports: "127.0.0.1:8080:8080"`; `depends_on: db: condition: service_healthy` |

Every password is a `${…:?required}` reference (one word after `:?`, so the address has no space); the job makes the
values with `openssl rand -hex 24` (hex: safe inside an address).

### 4.17 The CI workflow — `.github/workflows/app.yml`

Top level, in this order: `name: app`; `on: push: branches: [main, "ci/**"], paths: ["app/**", "docs/runbooks/**",
"tools/package.json", "tools/src/team/**", "tools/src/pixel-office/mask.js", ".github/workflows/app.yml"]`;
`permissions: contents: read`; `concurrency: group: app-${{ github.ref }}, cancel-in-progress: true`; `jobs`. Every job:
`runs-on: ubuntu-24.04`, `timeout-minutes` (check 15, pg 15, docker 20), first steps `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
# v7.0.1` with `persist-credentials: false`, `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0` with
`node-version: "22.23.4"` and `package-manager-cache: false` (the pins of `check.yml`), then a step `run: node -v`.

| Job | Steps after the three common ones |
|---|---|
| `check` | `working-directory: tools` `run: npm ci`; `working-directory: app` `run: npm ci`; `run: npm run check`; `run: npm audit --omit=dev --audit-level=high` |
| `pg` | one step: `pw="$(openssl rand -hex 24)"`, `echo "::add-mask::$pw"`, `SAI_PG_SUPERUSER_PASSWORD=$pw` into `$GITHUB_ENV`, `docker run -d --name sai-pg -e POSTGRES_PASSWORD="$pw" -p 127.0.0.1:5432:5432 postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac`, a loop of up to 60 `pg_isready` (О4); `working-directory: app` `run: npm ci`; `run: npm run test:pg` with `SAI_PG_HOST: 127.0.0.1`, `SAI_PG_PORT: "5432"` |
| `docker` | make `POSTGRES_PASSWORD` and `APP_DB_PASSWORD` (`openssl rand -hex 24`, masked, into `$GITHUB_ENV`); `docker compose -f app/compose.yaml build`; `docker compose -f app/compose.yaml up -d --wait`; `docker compose … exec -T web node -v`; the page checks (`curl -sS -o page.html -w '%{http_code}\n' http://127.0.0.1:8080/ \| grep -qx 200`, `cmp page.html app/public/index.html`, the same for `/nope` with 404 and `404.html`, `test "$(curl -sS http://127.0.0.1:8080/api/x/y)" = '{"error":"not_found"}'`, `test "$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: localhost:8080' http://127.0.0.1:8080/x)" = "307 http://127.0.0.1:8080/x"`); `test "$(docker compose … exec -T web id -u)" != "0"`; `test "$(docker compose … exec -T db psql -U postgres -d sai -Atc 'select name from schema_migrations')" = "0001_init.sql"`; the probe of N5 (section 17); `run: node app/scripts/smoke.js --base http://127.0.0.1:8080 --preview http://localhost:8080` (REQ-109 criterion 6); `if: always()` the logs (`--tail 50`) and `docker compose … down -v` |

Rules for every `run:` text: no `||`, no `continue-on-error`, no `set +e`, and no line that starts with `!` (F19: `bash -e`
does not stop on a failing negated pipeline; a negative check is written `if <command>; then exit 1; fi`). No
`secrets.`, no `${{ github.event`, no `pull_request_target`.

### 4.18 The root `.gitignore`

Appended after the last line (added lines only, criterion 13): an empty line, a comment line `# The product app/
(REQ-108): local secrets, Vercel link folders, test output.`, then `.env`, `.env.*`, `!.env.example`, `.vercel/`,
`app/test-results/`, `app/.tmp/` (F24).

### 4.19 The runbooks (REQ-109) — `docs/runbooks/release.md`, `docs/runbooks/incident.md`

English (decisions/0116 О9); the owner's own steps in Russian. Every Vercel command is `npx vercel@64.1.0 …` (one
version in both files and in `app/README.md`; S1 fixes the final pin and every line marked «verify at spike S1»).

`release.md`, in this order: (1) «Deploy» — a code block with `git clone --quiet <origin URL> <outside the
project>/deploy-<sha>`, `test "$(git -C <clone> rev-parse HEAD)" = "<pushed sha>"`, `test "$(git -C <clone> log -1
--format=%ae)" = "<team owner e-mail recorded at G3>"`, `cd <clone>/app && VERCEL_ORG_ID=<id> VERCEL_PROJECT_ID=<id> npx
vercel@64.1.0 deploy --prod --yes --env APP_VERSION=<sha>   # verify at spike S1`, `node scripts/smoke.js --base
<APP_ORIGIN> --expect-version <sha>`, `rm -rf <outside the project>/deploy-<sha>`; (2) «Rollback» — `npx vercel@64.1.0
rollback <previous production deployment URL>   # verify at spike S1`, the Hobby sentence, Instant Rollback by the owner,
«The database stays as it is: migrations are expand-only.»; (3) «After a rollback» — `npx vercel@64.1.0 promote
<deployment URL>   # verify at spike S1` and the sentence that the next release after a rollback ends with it; (4)
«Post-deploy record» — `docs/uat/<RUN-ID>-prod.md` and the handoff `step-12-post-deploy.json`.

`incident.md`: «An agent only asks; the owner changes the variable himself.»; «## Закрыть сайт (шаги владельца)» — 1.
`SITE_GATE` = `closed` for Production in Settings → Environment Variables; 2. «Изменение действует только для новой
публикации», then the command line `npx vercel@64.1.0 redeploy <current production deployment URL>` (verify at spike S1) — the command and its placeholder stay as in the criterion, the words around it are Russian; 3. check that `/`
shows «Сервис временно остановлен владельцем» and `/api/health` answers 503 (S1 writes the status Vercel gives the
static page, О18); other addresses show the platform's own 404 page (N6); «## Открыть снова» — the empty value and the
same `redeploy`. No `vercel link`, no secret, no path of this computer.

---

## 5. Pins, licences and the Addition to decisions/0001

Every version is exact (`save-exact=true`), at least 14 days old on the day of the install (F4, F5) and comes from
the public npm registry. The lockfile is made by `npm install --before=<the install date minus 14 days>`, so the
transitive entries are as old as the direct ones (F5: none later than the cut). RELEASE-VALIDATOR repeats
criterion 1's command for the 11 direct names and, as a wider read, the same `npm view <name> time --json` for every
entry of the lockfile (a loop; the output in its handoff).

| Name | Version | Published (UTC) | Licence | Kind | Why |
|---|---|---|---|---|---|
| `hono` | 4.13.16 | 2026-11-01T03:04Z | MIT | runtime | the one app of ARCH §0 (decision 0001) |
| `@hono/node-server` | 2.1.6 | 2026-11-02T10:22Z | MIT | runtime | `getRequestListener` for `node:http` (node-main); engines `>=20` |
| `pg` | 8.23.1 | 2026-09-30 | MIT | runtime | Postgres client, only in `server/db/pg.js` |
| `@electric-sql/pglite` | 0.5.15 | 2026-11-03T12:39Z | Apache-2.0 | dev | the local and test database (О10 of 0116); never in the image (`--omit=dev`) |
| `typescript` | 6.0.3 | 2026-04-16 | Apache-2.0 | dev | `tsc --noEmit`; 7.0.2 measured and not taken (F8) |
| `eslint`, `@eslint/js`, `globals`, `prettier` | 10.11.0, 10.0.1, 17.12.0, 3.9.9 | as in `tools/` | MIT | dev | the versions of `tools/package.json` (criterion 1) |
| `@types/node` | 22.20.5 | 2026-10-01 | MIT | dev | **Addition**: the types of `node:*` for `tsc` (Node 22 line) |
| `@types/pg` | 8.23.1 | 2026-08-17 | MIT | dev | **Addition**: the types of `pg` for `tsc` (`pg` ships none) |

Not added in this run: `zod`, `fflate` (no input schema and no archive in M1), `playwright-core` (section 8). The
production tree is 16 packages (F6). **Proposal of an Addition to decisions/0001** (ORCH writes it, О15): «2026-11-17,
run M1CODE-20261117-01: the dev type packages `@types/node` (MIT) and `@types/pg` (MIT) are allowed for `tsc`; the
transitive licence BlueOak-1.0.0 of `minimatch` (a dev package of eslint, as in `tools/`) is named; no install script
is needed by any package (`ignore-scripts=true` holds with no exception).»

---

## 6. The database

**PGlite (decisions/0116 О10).** Migration 0001 runs on PGlite unchanged (F9: roles, membership, the `do` blocks).
PGlite starts as the superuser `postgres`, so the role selfcheck would refuse it. The PGlite reading is therefore one
step of the PGlite adapter: after the migrations, `set session authorization sai_app_login`. From then on
`session_user` is the login role, and the one selfcheck statement (`SELFCHECK_SQL`) reads the same columns as on
Postgres — no second reading exists. The switch is not a security boundary inside PGlite (the session can switch
back, F9); PGlite is never production (`NODE_ENV=production` requires `DATABASE_URL`, 4.1). The text `set session
authorization` stands only in `server/db/pglite.js`, and `switchToLoginRole(` is called only in the PGlite branch of
`openRuntimeDb` (test SC-4).

**The login role (О17).** 0001 creates `sai_app`, `sai_preview` (NOLOGIN NOSUPERUSER NOBYPASSRLS) and
`sai_app_login` (LOGIN NOSUPERUSER NOBYPASSRLS, a member of both), owning nothing. In Docker, compose and the `pg` job
the runtime connects as `sai_app_login` with `APP_DB_PASSWORD`, the migrations as the image's superuser (F14: the
probe saw only `sai_app_login`). On Vercel with Neon, S3 decides whether `APP_DB_PASSWORD` is set (section 7).

**The password form (О24).** Measured on PGlite (PostgreSQL 18.6), Postgres 16.14 and Postgres 17.12 (F9, F10, F14):
`set_config('sai.app_db_password', $1, true)` with the value bound, then the constant guarded block of 4.9. The value
never stands in a statement text the code sends (MG-3, MP-1 record the texts of an in-process run), in a migration
file, in a row, in a printed line or in an error (MG-4 reads every field of the database's own error). Named limits:
(1) a Postgres server with `log_statement = 'all'` (or a parameter-logging duration setting) writes every bound value
into its own log (F10, О11) — a setting of the server, off by default in the image and stock Postgres; Neon's is read by
S3; (2) `set local log_parameter_max_length_on_error = 0` keeps bound values out of the server's error log lines for
this transaction (a user-settable parameter); the general statement log needs a superuser setting the app cannot make.

**The password step (N3).** Not in 0001 (an applied file is locked by its sha256): the runner's step 6, on every run
with `APP_DB_PASSWORD` set, after the files and inside the advisory lock. So a password set or changed later reaches
the role at the next migrate run (the next deploy, the next container start). Without `APP_DB_PASSWORD` the login role
has no password.

**The selfcheck order (criterion 8, the gate's F13).** `createDb` runs `SELFCHECK_SQL` before the first other
statement of its life, once, shared by parallel callers; `unchecked` after a down database, so the first use after it
answers runs it again (SC-3). node-main runs it at start with a 4000 ms deadline: unsafe → exit 1; down → serve
pages, health 503 (DD-2). The function cannot exit: every `/api/health` answers 503 `role: "unsafe"` and no other
statement runs (AE-2). The migration runner never runs it (the owner role may be a superuser).

**The fallback of О23.** `migrationUrl = DATABASE_URL_UNPOOLED ?? DATABASE_URL` (DBC-2); the runtime URL is built from
`DATABASE_URL` (the pooled one on Neon), never from the unpooled one.

**Advisory lock scope.** Per database (F10). Two runners on one database serialise (MP-2); two databases of one
server do not, which is why 0001's role blocks also catch `unique_violation`.

---

## 7. The Vercel shape and what waits for the spikes

Built and tested here: one function `app/api/index.js` (default export `{ fetch(request) }`), the rewrite
`/api/:path*` → `/api/index?__p=:path*` (О4), `framework: null`, `outputDirectory: public`, `regions: ["fra1"]`,
`maxDuration: 30`, the static header set in `vercel.json`, the allowlist `.vercelignore`, `vercel-build` (4.13), the
smoke and the runbooks. No Vercel command runs in any test or in this design.

What only the owner's project can show (after G3/G4; PLAN M1.2), each written into `docs/runbooks/release.md` or the
post-deploy record by S1–S3, never guessed:

| # | Fact | Spike | Where the design depends on it |
|---|---|---|---|
| V1 | Vercel's Node runtime accepts the default export `{ fetch }` of `api/index.js` (the alternative `handle(app)` of `hono/vercel` is allowed by criterion 3 only if needed) | S1 | 4.11 |
| V2 | The path and query the function sees after the rewrite (is `__p` encoded; does an original `__p` of the request merge with the rewrite's) | S1 | `restorePath` refuses two `__p` (AE-3) |
| V3 | The function bundle holds `db/migrations/*.sql` (health reads the folder at the first request) | S1 | 4.7; if not, `functions["api/index.js"].includeFiles` is a WF-03 defect of criterion 1 |
| V4 | The build machine has no `.git` above `app/`, so the closed build replaces `public/` (one protected preview build with `SITE_GATE=closed`) | S1 | 4.13, О9 |
| V5 | The status Vercel gives the static gate page (likely 200) and that other paths show the platform's 404 page | S1 | post-deploy record, О18 of 0116 |
| V6 | Which header wins when the function and `vercel.json` set the same one; whether the platform adds `Server` | S1 | the smoke fails only on a digit in `Server` (О7 of 0116) |
| V7 | The exact CLI forms (`deploy --prod --yes --env`, `rollback`, `redeploy`, `promote`, the project ids instead of `.vercel/`) and the final CLI pin | S1 | the runbooks, lines «verify at spike S1» |
| V8 | A second `*.vercel.app` host on one project and the host redirect | S2 | the preview redirect is in the app; no `vercel.json` redirect now (О8 of 0116) |
| V9 | Neon's role attributes in `DATABASE_URL` (rolsuper, rolbypassrls), `set local role` and `set_config(…, true)` through the pooler, whether `APP_DB_PASSWORD` is needed, Neon's statement logging, the `sslmode` warning of `pg-connection-string` | S3 | 6, О11 |

---

## 8. The browser-test tool of `app/` (decisions/0116 О3)

Measured both ways on the same sketch server (F16, F17, F18):

| | The own kit `tools/test/e2e/kit/` | `playwright-core` 1.64.1 |
|---|---|---|
| New package | none | one, 13 MB, Apache-2.0, 2026-10-14, no install script |
| Launch with the installed Chrome | 294 ms | 940 ms (`channel: "chrome"`) |
| Fresh profile under the temporary root, `--use-mock-keychain` | yes, built in | yes (Playwright's temporary profile; the switch passed as an argument) |
| Opens the preview host `localhost:<p>` (needed by the preview-isolation tests of M4) | no: `URL_REFUSED`, and the host resolver maps every name but 127.0.0.1 to nothing | yes |
| CSP violations and the console | captured; any line fails `withBrowser` (`CONSOLE_ENTRIES`) | captured as `console` events; the test decides |
| Where its code lives | `tools/test/`: an `app/test` import would add `tools/test/e2e/kit/**` to the path list of `app.yml` (criterion 11) and tie the product's tests to the pipeline's | `app/node_modules` |
| In the recorded decisions | decisions/0107, 0108 (for `tools/`) | decision 0001 item 2, ARCH §3, §18 |

**Proposal (О1, a record):** the browser tests of `app/` use `playwright-core` (exact version, ≥ 14 days old at its
install), driven from `node:test`, Chrome by `channel: "chrome"` (installed Chrome locally; on the runner, its Chrome),
one browser at a time (`--test-concurrency=1`), a fresh context per test, `--use-mock-keychain`, and a URL guard that
lets the page open only `http://127.0.0.1:<port>` and `http://localhost:<port>` of the test's own server (Playwright
`route` that aborts every other request). It is installed by the first requirement that adds a browser test (R1.2,
its e2e landing), not now: REQ-108 adds no browser test, and an unused package is work the requirement did not ask
for. The UAT step of criterion 14 (a person-like check by UAT-RUNNER) uses the own kit's way of starting Chrome, as
measured (F16).

---

## 9. Failure paths — what the user sees, what stays unchanged

| # | Failure | What the user (visitor, owner, operator) sees | What stays unchanged | Test |
|---|---|---|---|---|
| E1 | `NODE_ENV=production`, Node below 22.23.4 | node-main ends at once, one line naming 22.23.4 | nothing was opened | NF-1 |
| E2 | production without `DATABASE_URL`; a bad `DATABASE_URL`, `PORT`, origin or `LOG_LEVEL` | one `sai: refused: …` line naming the variable, exit 1 | nothing opened; no value printed | NM-2, DBC-4 |
| E3 | the database refuses or is silent at start | the warning line; pages served; `/api/health` 503 `db: "down"` within 5 s | the database (no statement ran) | DD-2, HL-2 |
| E4 | the login role is a superuser or bypasses RLS | node-main: one line, exit 1; function: health 503 `role: "unsafe"` on every request | the database (only the selfcheck ran) | SC-2, AE-2, HL-2 |
| E5 | a migration file fails | `migrate: refused: <name> failed (<SQLSTATE>)`, exit 1; in Vercel the build fails and the previous deployment stays live | no object and no row of that file (MG-2) | MG-2 |
| E6 | an applied file changed, a file missing, a bad file name | one line naming the file, exit 1 | no statement ran | MG-2 |
| E7 | the password step fails | `migrate: refused: the password step of sai_app_login failed`, exit 1 | the earlier password; no value in any error | MG-3, MG-4, MP-1 |
| E8 | the migration database is unreachable or silent | one line within 12 s, exit 2; no address, user or password | nothing | DD-1 |
| E9 | two migrate processes at once | both exit 0 | one row per file | MP-2 |
| E10 | a body above 65 536 bytes; bytes that are not UTF-8 | 413 `body_too_large`; 400 `bad_encoding` | nothing stored (M1 stores nothing) | BODY-1, BODY-2, HD-2 |
| E11 | an unknown `/api` address; a path outside `app/public` | the uniform 404; the 404 page | the server answers the next request | NM-3 |
| E12 | a bad `__p` | the uniform 404 | the app saw only `/api/index` | AE-1, AE-3 |
| E13 | `SITE_GATE` set (Node, Docker) | 503 and the gate page on every path; 503 `site_closed` for `/api` | no database call from the start | SG-1, SG-3 |
| E14 | `SITE_GATE` set and the owner redeploys on Vercel, the database down | the build ends with 0, the output is the gate page only | the database (no call); the previous deployment until the new one is ready | VB-3 |
| E15 | a closed build run locally | `vercel-build: refused: …`, exit 2 | `app/public` | VB-4 |
| E16 | an exception in a handler | 500 `server_error`, one log line with the code, no stack | the process keeps serving | (onError; HD-1 reads the headers of every answer) |
| E17 | the smoke against a wrong, refused, silent or redirecting site | `smoke: FAIL <check>` lines or one `smoke: FAIL the site did not answer`, exit 1 within 15 s; a `file:`/`ftp:` base → exit 2, no request | the site; no redirect followed | SM-2, SM-4, SM-5, SM-6 |
| E18 | a config error in the function | 503 `server_config`, one log line with the code | the next request tries again | AE-4 |

---

## 10. Protection in the same operation as the action

- The site gate is checked inside the request, before the body, the routes and any database use (middleware 2); the
  closed `vercel-build` checks `SITE_GATE` before any step, in the same call.
- The selfcheck is inside `createDb().query()`: the statement waits for `ensureSafe()` in the same call, never "checked
  at start, trusted later" for a new adapter, and never skipped after a down start.
- The body limit counts the bytes while reading them (and checks `Content-Length` first), in the same read.
- The static map is the only source of files: a request path is looked up, never joined to a folder.
- `restorePath` returns the only path the entry uses; the refused value is never passed on.
- The migration runner holds the advisory lock across the read of the applied rows, the sha256 check, the files and the
  password step, and each file and its row are one transaction.
- The password is bound in the same transaction as the block that quotes it; the setting is transaction-local.
- The preview redirect builds `Location` from the configured app origin in the same expression.

---

## 11. Time budget

Measured (F14, F23 and per file on 2026-11-17T19:05Z): `cd app && npm run check` on the Mac 39.0–39.9 s (prettier,
eslint, tsc and check-public about 1.5 s; unit 38 tests 7.2 s; int 25 tests 30.2–31.0 s). The int files: `db-down`
14.5 s (the migrate guard against the silent stand-in waits its 10 s connect limit; two node-main starts), `health`
5.1 s (the silent adapter waits the 4 s deadline), `migrate` 3.9 s, `selfcheck` 2.4 s, `node-main` 1.6 s, the rest under
1 s each. On the runner: the `check` job 80 s (int 52.1 s), `pg` 26 s, `docker` 42 s; the jobs run in parallel, so
`app.yml` ends in about 1.5 minutes; `check.yml` on the same sha 7 min 44 s (2209 tools tests, the e2e files).

Budget for the built work (79 named tests): the app check ≤ 120 s on the Mac and ≤ 4 min on the runner; `test:pg` ≤ 60 s;
the `docker` job ≤ 5 min; the job limits are 15, 15 and 20 minutes (Q10: a hang does not eat 360 minutes). TEST-DESIGNER
keeps every waiting test on its own deadline (4 s, 5 s, 10–12 s), never a sleep, and closes every stand-in socket in
`t.after` (F27, AP-116).

---

## 12. Criterion → test

| Requirement / criterion | Design element | Test or command (fails when the criterion is violated) |
|---|---|---|
| REQ-108 / 1 package files, pinning | 4.14, section 5 | `unit/npmrc.test.js` NPM-1, NPM-2; RV: `npm view <name> time --json` for the 11 direct names |
| REQ-108 / 2 one check command | 4.14 `scripts.check` | NPM-3, NPM-5, NM-5; commands on a fresh clone `cd app && npm ci && npm run check` (exit 0, «# fail 0», «# skipped 0», «# todo 0» twice), the skip/todo/only grep, RV's six planted failures, `cd tools && npm run check` |
| REQ-108 / 3 layout, import boundaries, no outside call | 4.3–4.11, О5, N1, N2 | `unit/import-boundaries.test.js` IB-1…IB-4 |
| REQ-108 / 4 the Node server and two hosts | 4.4, 4.3 | `int/node-main.test.js` NM-1, NM-2 |
| REQ-108 / 5 unknown addresses, static files | 4.3, 4.5 | NM-3, NM-4 |
| REQ-108 / 6 Node floor in the entry only | 4.1 `nodeFloorRefusal` | `unit/node-floor.test.js` NF-1, NF-2 |
| REQ-108 / 7 migration 0001, the runner, parameters only | 4.9, 4.10 | `int/migrate.test.js` MG-1, MG-2; `unit/no-string-sql.test.js` SQL-1, SQL-2 |
| REQ-108 / 8 roles, login role, selfcheck | 4.8–4.10, section 6 | `pg/migrate-pg.test.js` MP-1…MP-3; `pg/selfcheck-pg.test.js` SP-1; `unit/db-config.test.js` DBC-1…DBC-5; `int/selfcheck.test.js` SC-1…SC-4; `int/migrate.test.js` MG-3…MG-5 |
| REQ-108 / 9 site gate, server part | 4.3 middleware 2 | `int/site-gate.test.js` SG-1…SG-3 |
| REQ-108 / 10 request id, logs, body limits | 4.3 middleware 1 and 3, 4.6 | `int/logging.test.js` LG-1; `unit/body.test.js` BODY-1, BODY-2 |
| REQ-108 / 11 app.yml beside check.yml | 4.17 | `unit/ci-workflow.test.js` CIW-1, CIW-2; RV: the `rm` of unlisted paths then the app check (F20); `git diff --exit-code base/M1CODE-20261117-01 -- .github/workflows/check.yml`; `cd tools && node --test test/repo.test.js`; `gh run list --workflow app.yml --branch <ci branch> --limit 1 --json conclusion,headSha` |
| REQ-108 / 12 Docker and compose parity | 4.16, the `docker` job | `unit/docker-files.test.js` DF-1, DF-2; the `docker` job of the run of criterion 11 |
| REQ-108 / 13 root .gitignore, no secret | 4.18, 4.14 `.env.example` | commands of the criterion (check-ignore ×7, `git diff … -- .gitignore`, `git ls-files` ×2, the secret grep); `unit/npmrc.test.js` ENV-1 |
| REQ-108 / 14 browser step | 4.12 | UAT-RUNNER, step 8, with the kit's Chrome (F16); О2 |
| REQ-108 / 15 the database unreachable or silent | 4.9 CLI guard, 4.4 step 5 | `int/db-down.test.js` DD-1, DD-2 |
| REQ-109 / 1 Vercel configuration | 4.15 | `unit/vercel-config.test.js` VC-1, VC-2 |
| REQ-109 / 2 the function entry, the rewritten path | 4.11 | `int/api-entry.test.js` AE-1, AE-3 |
| REQ-109 / 3 /api/health | 4.7 | `int/health.test.js` HL-1…HL-4; AE-2 |
| REQ-109 / 4 security headers, parity | 4.6, 4.15 | `unit/headers-parity.test.js` HP-1, HP-2; `int/headers.test.js` HD-1, HD-2 |
| REQ-109 / 5 smoke | 4.13 | `unit/smoke.test.js` SM-1…SM-7; `int/smoke-local.test.js` SL-1 |
| REQ-109 / 6 Docker parity of headers and health | 4.16 HEALTHCHECK, 4.17 smoke step | DF-1, DF-2; CIW-1, CIW-2; the `docker` job |
| REQ-109 / 7 check-public | 4.13 | `unit/check-public.test.js` CP-1, CP-2; NPM-3, NPM-4 (its place in `check`) |
| REQ-109 / 8 vercel-build and the static gate | 4.13 | `unit/vercel-build.test.js` VB-1…VB-4 |
| REQ-109 / 9 runbooks | 4.19 | `unit/runbooks.test.js` RB-1, RB-2; `cd tools && npm run traces` |
| REQ-109 / 10 the checks of both folders | — | the commands of the criterion |

Every test of section 13 maps to a row here; the file names are those of the criteria (AP-123), plus the three helper
files of О13, which hold no test.

---

## 13. Test catalogue

✓ = in the sketch and green (F14, F23); ◦ = designed, not in the sketch. Every damaged copy and planted case is made in
the test, from parts where a literal would hit a search (AP-093).

**`unit/npmrc.test.js`** — NPM-1 ✓ the real `.npmrc`, `package.json`, lockfile and `tools/package.json` give no finding
(the rules of criterion 1 as one function `packageFindings`). NPM-2 ✓ nine damaged copies, each red with its rule: a `^`
range, `engines >=22`, no `ignore-scripts=true`, a `git+` resolved, a tarball resolved, a GPL licence, a `postinstall`,
an unlisted dependency, another prettier version. NPM-3 ✓ `scripts.check` equals the chain of 4.14 split by ` && `; no
`||` or `;`; no `--test-only`, `--test-name-pattern`, `--test-skip-pattern` in `test:unit`, `test:int`, `test:pg`; damaged:
`|| true`, `--test-only`, check-public removed. NPM-4 ◦ damaged: check-public moved after `npm run test:unit` → red. NPM-5 ◦ the 10 int and 2 pg test files of section 3 exist (a closed list; О17).
ENV-1 ◦ the names read by the code (`raw("NAME")` in `config.js`, `env.NAME`, `env["NAME"]`, `process.env.NAME` in
`server/`, `api/`, `scripts/`, `test/fixtures/pg-env.js`) are each a line `NAME=` with an empty value in `.env.example`;
a planted read of an unlisted name → red; a value after `=` → red.

**`unit/import-boundaries.test.js`** — IB-1 ✓ the real tree (every `.js` under `app/` except `node_modules/` and `test/`)
gives no finding. IB-2 ✓ the 48 red twins of the sketch (the 22 module twins of criterion 3, the 7 fetch twins, the four
forms of N2, an import inside a comment, `tools/` and `worker/` imports, a non-literal `import(`, `node:child_process`,
`node:worker_threads`, `eval(`, `honox`, `pg-native`, PGlite and `pg` outside their files, `api/index.js` importing
`db/pg.js`, `document`/`window` in `public/shared`, `public/shared` importing `public/js`, `public/js` importing
`server/`), each asserting its expected finding label. IB-3 ✓ the 20 green twins (the 10 module twins and the 9 fetch
twins of criterion 3, own-folder imports, `windowSize` and `opts.document`). IB-4 ◦ the blanking: `fetch(` in a comment,
a string and a template text is green, inside `${…}` red; the bracket keys of `globalThis["fetch"]` and
`http["request"](` are read on the raw text (N1).

**`unit/no-string-sql.test.js`** — SQL-1 ✓ no file of `app/server` passes a template with `${` or a `+` at the top
level of the first argument of `query(`, `.query(`, `exec(`, `.exec(`. SQL-2 ✓ seven planted forms red, five parameter
forms green (`query(text, [a + b])` stays green: the `+` is inside the parameters).

**`unit/node-floor.test.js`** — NF-1 ✓ `v22.23.3`, `v22.9.0`, `v21.99.99`, `v23.0.0`, `x` refused with one line naming
22.23.4; `v22.23.4`, `v22.24.0`, `v22.30.0` accepted. NF-2 ✓ the only call of `nodeFloorRefusal(` outside its
definition is in `server/node-main.js`.

**`unit/db-config.test.js`** — DBC-1 ✓ the runtime URL: user `sai_app_login`, the password decoded equals
`APP_DB_PASSWORD` (built from parts, with `%@:/?#`), host, port, path and query unchanged; migration URL =
`DATABASE_URL`. DBC-2 ✓ `DATABASE_URL_UNPOOLED` wins. DBC-3 ✓ no password → `DATABASE_URL`. DBC-4 ✓ four bad configs, no
error message holds either password. DBC-5 ◦ defaults `host` `127.0.0.1`, `port` 0, `version` `dev`; `PGLITE_DIR` or
`MIGRATIONS_DIR` with `NODE_ENV=production` (and a `DATABASE_URL`) → `E_CONFIG_TEST_ONLY`.

**`unit/body.test.js`** — BODY-1 ✓ 65 536 bytes accepted; 65 537 refused 413 with and without `Content-Length`, the body
`{"error":"body_too_large"}`. BODY-2 ✓ `61 ff 62` → 400 `{"error":"bad_encoding"}`; valid UTF-8 read.

**`unit/ci-workflow.test.js`** — CIW-1 ✓ the real `app.yml` keeps every rule of 4.17 (trigger, branches, the six paths
in order, permissions, no job permissions, banned texts, `uses:` by 40 hex, images by digest, the three jobs, timeouts,
the exact Node and `node -v` in each job, the steps of `check`, `pg` and `docker`, the smoke after `up --wait`, no hidden
exit code, no line starting with `!`). CIW-2 ✓ 17 damaged copies, each red.

**`unit/docker-files.test.js`** — DF-1 ✓ the real files keep 4.16. DF-2 ✓ seven damaged copies (no digest, `USER
root`, `USER 0`, `npm ci` without `--omit=dev`, no HEALTHCHECK, a password literal, a third service).

**`unit/headers-parity.test.js`** — HP-1 ✓ the https set and the http set equal the list written in the test, name and
value. HP-2 ✓ `vercel.json`'s `/(.*)` headers equal the https set; three damaged copies red.

**`unit/vercel-config.test.js`** — VC-1 ✓ the rules of REQ-109 criterion 1 (`git ls-files app` for the `[` rule). VC-2 ✓
six damaged copies red.

**`unit/smoke.test.js`** — SM-1 ✓ a right stand-in: exit 0, 8 `smoke: ok` lines. SM-2 ✓ 15 wrong answers, each red with
its check named. SM-3 ✓ HSTS only for https (the pure function). SM-4 ✓ a 302 of `/` is red and its target gets no
request. SM-5 ✓ `file:` and `ftp:` bases → exit 2. SM-6 ✓ a refused port and a silent stand-in → exit ≠ 0 within 15 s, one
line, no stack. SM-7 ◦ a preview 307 to another origin → red; without `--expect-version` any version string passes.

**`unit/check-public.test.js`** — CP-1 ✓ the real `app/public` → exit 0. CP-2 ✓ 19 planted items red and 12 benign twins
green, `Math.random` red only under `office/`, the CLI line names the file and the item.

**`unit/vercel-build.test.js`** — VB-1 ✓ open with `MIGRATE_ON_BUILD=1`: migrate then check-public, the output equals
`app/public` byte for byte, no planted address marker in any line; without it only check-public. VB-2 ✓ a failing
migrate stops before check-public; a failing check-public fails. VB-3 ✓ `SITE_GATE` `closed` and `1`, with
`MIGRATE_ON_BUILD=1`, a migrate step that throws and an address to a refused port: exit 0, no step called, the output
only `index.html` equal to `gate.html`. VB-4 ✓ closed with the output being the real `app/public` of a git tree → exit 2,
the folder unchanged.

**`unit/runbooks.test.js`** — RB-1 ✓ the order of `release.md`, the owner's steps of `incident.md`, one exact `vercel@`
version in both files and `app/README.md`, only the listed options per command, the S1 words on every `rollback`,
`redeploy`, `promote` line and on the ids line, no `vercel link`, no key shape, no computer path. RB-2 ✓ seven damaged
forms red (`--yes` on rollback, `--token`, a second version, `vercel@latest`, `npx vercel@<pin> link`, a rollback line
without the S1 words, `--force`).

**`int/node-main.test.js`** — NM-1 ✓ two addresses, one port; `/` 200 with the bytes and type, the text, `lang="ru"`;
the preview host gets 307 to the app origin for `/`, `/x/y`, `/api/health`; `Host: evil.example` and
`X-Forwarded-Host: evil.example` never in a `Location`; `/api/p/x` on the preview host the uniform 404; `SIGTERM` → exit 0
within 5000 ms. NM-2 ✓ production without `DATABASE_URL` → exit ≠ 0, one line with `DATABASE_URL`, no `at` line. NM-3 ✓
the three uniform 404s byte-equal, the 404 page for `/nope` and `/a/b.html`, `/index.html`, the eight escapes, then `/`
answers. NM-4 ✓ the static map of a planted folder serves no dot-name, no unknown type and no folder. NM-5 ◦ the 14 unit test files of section 3 exist (the other half of О17).

**`int/migrate.test.js`** — MG-1 ✓ `PGLITE_DIR` run: the two tables and their columns, one row with the file's sha256,
no `platform_settings` row; a second run changes nothing. MG-2 ✓ on a copy of the folder (`MIGRATIONS_DIR`): a 0002
whose second statement fails, a changed 0001, a bad name — each exit ≠ 0 with the state equal before and after (rows,
`applied_at`, tables, columns). MG-3 ✓ in-process with a recording adapter: the password only among bound values,
never in a text or a printed line; roles and attributes; `SCRAM-SHA-256$` stored; with the role dropped the step fails
and no error field holds the value. MG-4 ✓ the guarded block itself on raw PGlite with no `sai_app_login`: the error is
P0001 and none of its fields holds the value (kills the removal of the handler, M05). MG-5 ◦ 0001 with
`APP_DB_PASSWORD` unset: `sai_app_login` has no password (`rolpassword` null) and the role attributes and membership are
those of criterion 8.

**`int/selfcheck.test.js`** — SC-1 ✓ `judgeRole`. SC-2 ✓ node-main on a `PGLITE_DIR` whose `sai_app_login` was made
`superuser`, and `bypassrls`: exit ≠ 0, one line with no role name, no `postgres`, no stack. SC-3 ✓ a counting adapter:
while the database is down only `SELFCHECK_SQL` was sent; after it answers, `SELFCHECK_SQL` again, then the statement.
SC-4 ◦ the text `set session authorization` stands only in `server/db/pglite.js`, `switchToLoginRole(` is called only in
`server/db/index.js`, and `openRuntimeDb` with a `DATABASE_URL` sends no statement (a counting `createPgAdapter` double
is not needed: the adapter is created lazily and the test reads `roleState()` `unchecked` and no PGlite folder made).

**`int/site-gate.test.js`** — SG-1 ✓ `/`, `/nope` → 503 with the bytes of `gate.html`; `/api/health`, `/api/x/y` → 503 one
JSON body, on both hosts; a throwing adapter is called 0 times; (◦ added row: a 70 000-byte POST is 503, not 413).
SG-2 ✓ `closed`, `CLOSED`, ` closed`, `1`, `open` close; empty and unset open (criteria 4 and 5 answers come back).
SG-3 ◦ node-main with `SITE_GATE=closed` and a `DATABASE_URL` to a counting TCP stand-in: the stand-in gets no
connection during the start and three requests.

**`int/logging.test.js`** — LG-1 ✓ every answer has `X-Request-Id`, two differ, one JSON line per request with keys
from the closed list, `req_id` equals the header, none of `QMARK1`, `BMARK2`, `CMARK3`, `AMARK4`, `203.0.113.7` in stdout
or stderr; (◦ added row: an incoming `X-Request-Id: planted-id` is not echoed).

**`int/db-down.test.js`** — DD-1 ✓ `migrate.js` against a refused port and a silent stand-in: exit ≠ 0 within 15 000 ms,
one line without the address, port, user, password marker or stack. DD-2 ✓ node-main on both: alive, `/` 200, `/nope`
404, again `/` 200, no marker on stderr.

**`int/api-entry.test.js`** — AE-1 ✓ `/api/index?__p=health` equals `/api/health` in status and keys; `__p=x/y` and
`/api/x/y` the same uniform 404; five bad values → 404 or 400, no `Location` to another origin, the next request
answered. AE-2 ✓ an unsafe reading through the entry: three requests 503 `role: "unsafe"`, the adapter got only
`SELFCHECK_SQL` once. AE-3 ✓ the app sees `/api/health?x=1` for `__p=health&x=1`, `/api/index` for six bad values and
for two `__p`. AE-4 ◦ `readConfig` throwing in the entry → 503 `{"error":"server_config"}` with `Cache-Control: no-store`.

**`int/health.test.js`** — HL-1 ✓ the healthy answer, `Content-Type`, `Cache-Control: no-store`, the exact body. HL-2 ✓
refused, silent (under 5000 ms), unsafe, one pending: 503, the exact keys, `ok` false, no address, `ECONNREFUSED`,
`Error` or `at` line. HL-3 ◦ after each failure the next request is answered and `schema_migrations` (names and sha256)
is equal before and after. HL-4 ◦ `APP_VERSION=abc` → `version` `abc`.

**`int/headers.test.js`** — HD-1 ✓ through node-main: `/`, `/nope`, `/api/health`, `/api/x/y`, the 307, a 70 000-byte POST
(413), and the 503 of a gated server carry the http set, `/api` answers `Cache-Control: no-store`, none has `Server`,
`X-Powered-By` or HSTS. HD-2 ✓ the 413 of `createApp`.

**`int/smoke-local.test.js`** — SL-1 ✓ the smoke against node-main with the preview host → exit 0.

**`pg/migrate-pg.test.js`** (the `pg` job; fresh database per test; the three variables of 4.14, a missing one fails the
test with a plain message, never a skip) — MP-1 ✓ the process run with `APP_DB_PASSWORD`: exit 0, nothing printed holds
the value; the three roles and their attributes, membership, no table owned, no `org_id` column, no row holds the value;
a login as `sai_app_login` with the value succeeds; then an in-process run with a recording adapter: the value only among
bound values; a broken role name in the block → the run fails with no value in the error. MP-2 ✓ two processes at once
on an empty database: both 0, one row. MP-3 ✓ 0001 on a second database keeps the attributes of the three roles.

**`pg/selfcheck-pg.test.js`** — SP-1 ✓ the real selfcheck refuses the image's superuser and a `LOGIN BYPASSRLS` role
made by the test, passes `sai_app_login`; (◦ added row: a `LOGIN SUPERUSER NOBYPASSRLS` role is refused — kills P4 at
this level too).

---

## 14. Replacement table of earlier guard tests

Measured, not inherited (AP-094, AP-112, AP-113): the grep of F25 on the clone of the tag, and the whole tools check
on GitHub with the sketch present (F15: `check.yml` run 44151782067 on the snapshot 7c14e72 — `success`, 2209 tests of
2209, 0 failed, 0 skipped, 0 todo; traces 2632 files, 0 traces; handoffs-check 0 violations; the four e2e files passed).

| Guard test (file, line) | What it counts | Touched by this run? | Was → became |
|---|---|---|---|
| CI-1…CI-8 `tools/test/repo.test.js` (122, 327, 1115) | the one file `.github/workflows/check.yml` by its constant, not the folder | no: `check.yml` stays byte for byte; `app.yml` is a file it never reads | none |
| RD-1…RD-4 `repo.test.js` (1200, 1223) | the root `README.md` section «Check on GitHub and before a push» | no: the root README does not change (REQ-103 owns it) | none |
| REQ-003 AC3 `repo.test.js:106`; TM-01 `team-docs.test.js:81` | `CLAUDE.md` | no | none |
| E2K-61 `e2e-kit.test.js:4044` | the root `README.md` paragraph and `tools/README.md` | no | none |
| E2K-50 `e2e-kit.test.js` | every spec of `tools/test/e2e` | no: no browser test is added; `app/test` is outside it (О1) | none |
| TR-4a…TR-4f `traces-runtime.test.js` | `tools/src` (`walk(SRC)`) and `tools/package.json` | no | none |
| `traces-runtime.test.js:187` | writes its own `.gitignore` in a temporary repository | no: the root `.gitignore` is not read | none |
| `npm run traces` (`tools/src/traces/git-files.js`: `ls-files --cached --others --exclude-standard`) | every tracked or trackable file | yes: it scans `app/`, the lockfile, `app.yml`, the runbooks (F21: 0 traces) | none — the scan is the protection; `app/node_modules` stays ignored by the root `node_modules/` |
| PH-1…PH-8 and `.githooks/pre-push` | the hook runs the tools check | no | none |
| `handoffs-check` | `handoffs/` | no | none |

No row has a "was → became": no guard test of an earlier requirement turns red, and no prohibition is weakened.

---

## 15. Build sub-steps

BACKEND-DEV writes the product files (B1–B7); TEST-DESIGNER writes the 26 test files and the three helpers at step 5
(T1–T4). Until T1, `npm run test:unit` and `npm run test:int` find no file and end with 0 and «# tests 0» (F28), so
BACKEND-DEV's own check after each sub-step is the static part of the chain — `npx prettier --check . && npx eslint .
--max-warnings 0 && npx tsc --noEmit -p jsconfig.json` (and `node scripts/check-public.js` from B6) — plus a driver
outside the project that imports the new modules by absolute path, and `cd tools && npm run traces`. No test of
`tools/test` turns red at any sub-step (section 14, F15).

**BACKEND-DEV**

| # | Files | Own check of the sub-step | Red after it |
|---|---|---|---|
| B1 | `package.json` (the `check` chain of 4.14 complete), the lockfile by `npm install --before=…`, `.npmrc`, `jsconfig.json`, `eslint.config.js`, `.prettierignore`, `.env.example`, the root `.gitignore` lines | `npm ci`; the static steps; the commands of criterion 13 on the `.gitignore`; `npm audit --omit=dev --audit-level=high` | `npm run check` stops at `check-public` (the file comes at B6): named `EXPECTED_RED` with this row until B6 |
| B2 | `server/config.js`, `http/errors.js`, `http/site-gate.js`, `http/origin.js`, `http/request-id.js`, `http/body.js`, `http/headers.js` | driver: the tables of 4.1 (every error code and message, the runtime URL with `%@:/?#`), `nodeFloorRefusal` on the versions of NF-1, `readBody` at 65 536 and 65 537 bytes with and without a length | as B1 |
| B3 | `db/index.js`, `db/selfcheck.js`, `db/pg.js`, `db/pglite.js`, `db/tx.js`, `db/migrate.js`, `db/migrations/0001_init.sql` | driver: `migrate` on an in-memory PGlite and twice on a `PGLITE_DIR`; the role readings; the switch; a counting adapter around `createDb`; `node server/db/migrate.js` against a refused port (exit 2 within 12 s) | as B1 |
| B4 | `server/static.js`, `server/app.js`, `routes/index.js`, `routes/health.js`, `server/node-main.js`, `public/index.html`, `404.html`, `gate.html` | `PORT=0 node server/node-main.js`; `curl` of the rows of 4.3 on both hosts; `SITE_GATE=closed`; `SIGTERM` | as B1 |
| B5 | `api/index.js` | driver: `createEntry` with the PGlite app; the `__p` values of AE-1 and AE-3 | as B1 |
| B6 | `scripts/check-public.js`, `scripts/smoke.js`, `scripts/vercel-build.js` | `node scripts/check-public.js` → 0; the smoke against node-main with `--preview`; `runBuild` with injected steps and a temporary output folder, open and closed | none: `npm run check` passes its static steps and runs 0 tests (F28) |
| B7 | `vercel.json`, `.vercelignore`, `Dockerfile`, `compose.yaml`, `.github/workflows/app.yml`, `docs/runbooks/release.md`, `docs/runbooks/incident.md`, `app/README.md` | `node -e` reading `vercel.json`; `cd tools && npm run traces`; the runbook texts written by the rules of 4.19 (AP-077: TEST-DESIGNER's RB-1 checks the same rules at T3) | none |

**TEST-DESIGNER**

| # | Work | Red after it |
|---|---|---|
| T1 | `test/fixtures/helpers.js`, `db.js`, `pg-env.js`; the unit files of REQ-108 (npmrc, import-boundaries, no-string-sql, node-floor, db-config, body, ci-workflow, docker-files) | none |
| T2 | the int files of REQ-108 (node-main, migrate, selfcheck, site-gate, logging, db-down) and the two pg files | none locally for unit and int; the pg files need Postgres: on the Mac a private cluster on a Unix socket only, or the `pg` job |
| T3 | the files of REQ-109 (headers-parity, vercel-config, smoke, check-public, vercel-build, runbooks, api-entry, health, headers, smoke-local) | none |
| T4 | NPM-5 and NM-5 (the presence guards of О17), the mutant series (section 16), the commands of criteria 2, 11 and 13 of REQ-108 and 10 of REQ-109, the snapshot on a temporary `ci/*` branch at step 6 | — |

Each sub-step can be checked alone: B1–B7 by their own checks, T1–T4 by `npm run check` (green after each).

---

## 16. Mutants

"Applied" = applied on a fresh clone of the sketch snapshot outside the project (`<outside the project>/m1code-01/mut`),
one at a time, the named test files run, the file restored from its saved text (no `git checkout`), the clone clean
afterwards. 29 applied: 27 red, 1 equivalent, 1 red only at the int level (P4, closed by the added SP-1 row). 19 more
designed for the gates. Measured cost (AP-140): the first series of 25 took 6 min 5 s; three mutants (one of them M23,
a node-main that no longer exits) left a sketch server running after the harness ended the test process at its 120 s
limit — found after the series by their working folder, stopped by their pids. So every test that awaits the exit of a
child gets its own `timeout` option (20 000 ms), the helper kills its child in `t.after` (SIGKILL, by the child object),
and a mutant harness for these files kills what the test process started by the recorded pids, never by a name pattern
(AP-119).

| # | Mutant | Caught by | Applied |
|---|---|---|---|
| M01 | `url.password = password` (no `encodeURIComponent`) | DBC-1 | red |
| M02 | migration URL = `DATABASE_URL` even with the unpooled one | DBC-2 | red |
| M03 | `judgeRole` ignores `rolbypassrls` | SC-1, SC-2 | red |
| M04 | `ensureSafe` returns unless `unsafe` (no selfcheck before the statement) | SC-3 | red |
| M05 | the exception handler removed from the password block | MG-4 | red (green before MG-4 was added — the sketch's first series) |
| M06 | the sha256 comparison of applied files removed | MG-2 | red |
| M07 | `commit` instead of `rollback` after a failed file | — | equivalent: Postgres and PGlite turn a `commit` of a failed transaction into a rollback (green, measured) |
| M08 | the counted limit is `limit + 1` | BODY-1 | red |
| M09 | only `SITE_GATE=closed` closes | SG-2 | red (green before SG-2 was added) |
| M10 | the gate lets `/api` through | SG-1 | red |
| M11 | the 307 `Location` takes the request's origin | NM-1 | red |
| M12 | `X-Frame-Options: SAMEORIGIN` | HP-1, HD-1 | red |
| M13 | HSTS on http answers too | HP-1, HD-1 | red |
| M14 | health `ok` true with a pending file | HL-2 | red |
| M15 | health deadline 60 000 ms | HL-2 | red |
| M16 | `restorePath` without the segment check | AE-3 | red (green before AE-3: the app's own 404 hid it) |
| M17 | `__p` passed on to the app | AE-3 | red |
| M18 | static names may start with a dot | NM-4 | red (green before NM-4) |
| M19 | the closed build migrates when `MIGRATE_ON_BUILD=1` | VB-3 | red |
| M20 | the smoke never asks HSTS | SM-3 | red |
| M21 | the smoke follows redirects | SM-4 | red |
| M22 | the word `orch` dropped from check-public | CP-2 | red |
| M23 | node-main does not exit on an unsafe role | SC-2 | red |
| M24 | PGlite not switched to the login role | HL-1 (health `role` unsafe) | red |
| M25 | 0001 makes `sai_app_login` with `bypassrls` | MG-3, HL-1 | red |
| P1 | 0001 without the `duplicate_object`/`unique_violation` handlers | MP-2, MP-3 (local Postgres 16) | red |
| P2 | the runner takes no advisory lock | MP-2 | red |
| P3 | the password step never runs | MP-1, SP-1 | red |
| P4 | `judgeRole` ignores `rolsuper` | SC-1 (int); SP-1 green (the image's superuser also bypasses RLS) → the added SP-1 row `LOGIN SUPERUSER NOBYPASSRLS` | red at int, green at pg |
| M26 | the blanking keeps strings | IB-3 (`fetch(x)` in a string) | designed |
| M27 | bracket keys read after blanking | IB-2 (`globalThis["fetch"]`, `http["request"](`) | designed |
| M28 | the `!`-line rule of app.yml removed | CIW-2 | designed |
| M29 | `USER root` allowed | DF-2 | designed |
| M30 | the `/*` start of `.vercelignore` not checked | VC-2 | designed |
| M31 | `--yes` allowed on rollback | RB-2 | designed |
| M32 | production without `DATABASE_URL` starts | NM-2 | designed |
| M33 | `HOST` default `0.0.0.0` | DBC-5 | designed |
| M34 | the request id taken from the incoming header | LG-1 (added row) | designed |
| M35 | the log line holds the path and query | LG-1 (`QMARK1`) | designed |
| M36 | the gate after the body limit | SG-1 (added row: a large POST is 503) | designed |
| M37 | health ignores `APP_VERSION` | HL-4 | designed |
| M38 | the smoke compares only the preview host, not the origin | SM-7 | designed |
| M39 | the closed build keeps the other files of `public/` | VB-3 | designed |
| M40 | check-public phrases with one space only | CP-2 (`Около  2 минут`, `claude\ncode`) | designed |
| M41 | a migration file run without `begin` | MG-2 (the first statement's table exists) | designed |
| M42 | no `SIGTERM` handler | NM-1 | designed |
| M43 | `APP_DB_PASSWORD` missing from `.env.example` | ENV-1 | designed |
| M44 | the int test folder emptied (the check would pass with «# tests 0», F28) | NPM-5 | designed |

---

## 17. The Low points of decisions/0116 О25 assigned to the design

- **N1** (the blanking sentence, the bracket twins, an import inside a comment). Comments, strings and template text
  are blanked for every rule except two that read the raw text: the import rules (so an import written inside a
  comment counts, and is red when it names a banned module — the sketch twin `// import x from "node:https"` is red) and
  the bracket-key rules (`<name>["fetch"]`, `<binding>["request"]` and the other banned members). Measured: 48 red and
  20 green twins with 0 wrong (F21 sketch, IB-2, IB-3).
- **N2** (four forms that passed the gate's sketch). All four are red: `const { fetch: f } = globalThis` and
  `Reflect.get(globalThis, "fetch")` by the global-object rule (`globalThis`, `global`, `self`, `window` as whole names
  not after `.` in `app/server` and `app/api`); `process.getBuiltinModule("node:https")` by the member rule
  `getBuiltinModule`; `const { request } = http` in node-main by the rule «no destructuring of the `node:http`
  binding». Also red (О5): `node:worker_threads`, `node:vm`, `eval(`, `Function(`. The one named limit left: a `fetch`
  right before `:` (`c ? fetch : x`) reads as an object key (the requirement's own named limit) — the global-object rule
  does not help there, and the import rules close every module form.
- **N3** (no `APP_DB_PASSWORD`; a password set or changed after 0001). Section 6: no password in 0001; the runner sets it
  on every run when the variable is set (MG-3, MG-5, MP-1).
- **N4** (which run the statement log records). The in-process run of `migrate()` with a recording adapter (MG-3 on
  PGlite, MP-1 on Postgres); the process run is checked for its printed lines and its rows only.
- **N5** (the `pg_stat_activity` probe). Right after `GET /api/health`: `select usename from pg_stat_activity where
  datname = 'sai' and backend_type = 'client backend' and pid <> pg_backend_pid()`; at least one row `sai_app_login`
  (`grep -qx`) and no row `postgres` (`if … grep -qx postgres; then exit 1; fi`, F19). The db healthcheck connects to the
  database `postgres`, so the `datname` filter leaves it out; the pool keeps its connection idle for 10 s and the web
  HEALTHCHECK asks every 5 s. Measured: one row, `sai_app_login` (F14).
- **N6** (the name of the closed output file). `index.html` (the bytes of `gate.html`), so `/` shows the gate page on
  Vercel; other non-API paths get the platform's own 404 page and `/api/*` gets the function's 503 (the runtime
  `SITE_GATE`); written in `incident.md`; S1 measures the static status (V5).
- **N8** (the ternary false hit of the skip grep). Kept as written; the rule for test authors is: no variable, parameter
  or property named `skip`, `todo` or `only` in `app/test` (the sketch has none; the grep is clean, F21). The shorthand
  options `{ skip }` and `{ todo }` the grep does not see are caught by «# skipped 0» and «# todo 0».

---

## 18. Quality bar

| Item | Applicable? | How it is met |
|---|---|---|
| Q1 | yes | every change belongs to REQ-108 or REQ-109; every criterion has its test or command (section 12) |
| Q2 | yes | the gates of WF-02; the sketch facts are for CODE-DESIGN-VALIDATOR to repeat on a fresh clone of the tag |
| Q3 | yes | every fact of section 1 has its command and output; the GitHub runs are read, not assumed (F14, F15) |
| Q4 | yes | one check command `cd app && npm run check` (decision 0001 item 2); `test:pg` and Docker run in `app.yml`; the tools check stays as it is |
| Q5 | yes | 79 named tests; failure tests compare the state before and after (MG-2, HL-3, VB-4, SG-1) |
| Q6 | yes | no skip, todo or only (the grep and «# todo 0»); `|| true`, `;`, `continue-on-error`, `set +e` and negated lines banned in `check` and `app.yml` (NPM-3, CIW-1) |
| Q7 | yes | passwords only from the environment; compose uses `${…:?required}`; CI makes and masks its passwords; the secret grep is clean (F21); no error, log line or health answer holds a value (DBC-4, DD-1, HL-2, MG-3, MG-4, MP-1); the named limit of the server's own statement log (section 6) |
| Q8 | partly | no tenant data in M1 (no `org_id` column, MP-1); the ground of Q8 — the login role without superuser and bypass, checked before any statement — criterion 8 (section 6) |
| Q9 | yes | parameters only; `no-string-sql` (SQL-1, SQL-2); the password through `set_config($1)` |
| Q10 | yes | down and silent databases (DD-1, DD-2, HL-2), the 4 s, 12 s, 5 s and 15 s limits, the smoke against refused and silent sites (SM-6), the gate without a database (VB-3, SG-1) |
| Q11 | not applicable | the server calls no outside address (decision 0094), pinned by the module, fetch and global rules (IB-*); the smoke is an operator tool that takes only `http`/`https` bases and follows no redirect (SM-4, SM-5) |
| Q12 | yes | the choices of section 2 go to a record by ORCH (section 21); nothing departs silently from decisions 0001, 0092, 0094, 0116 |
| Q13 | yes | issues I1–I5 of the handoff go to ORCH for the error journal where they repeat (the tee cancel, the `!` pipeline, the 404 console line) |
| Q14 | yes | the handoff is closed by the command; the requirement statuses are ORCH's and DOC-UPDATER's |
| R1 | yes | no merge, no push to `main`, no tag; one temporary `ci/*` branch, deleted after its runs were read (section 20) |
| R2 | not applicable | no Pixel Office event; no office in M1 |
| R3 | not applicable | decision 0033 (no photos of people) |

---

## 19. Documents that change, and what becomes outdated outside the project

Written by this run: `app/README.md` (section 4.14), `docs/runbooks/release.md`, `docs/runbooks/incident.md`
(section 4.19). Not changed: the root `README.md`, `CLAUDE.md`, `tools/README.md`, `STATE.md`, `PLAN.md`.

For DOC-UPDATER (outside the files of this run; ORCH's files are ORCH's):

- `docs/program/public-v1/PROGRESS.md` «Plan amendments» — new rows for ARCH §2 (the helper folder `app/test/fixtures`,
  О13), ARCH §3 (`tsc` scope, О3; typescript 6.0.3, F8), ARCH §18 (the `pg` job with `docker run`, О4), ARCH §19.2
  (`vercel.json` `headers` as written; the rewrite of О4 already recorded), ARCH §20.2 (the Dockerfile `HEALTHCHECK`
  through `node`, the slim image has no curl).
- `docs/program/public-v1/vercel-setup.ru.md` step 6 names `TRUST_PROXY`, which the M1 code does not read (harmless;
  it is read from M2 on).
- decisions/0001 — the Addition of section 5 (О15); the spike results later.
- The error journal (Q13), proposals: the cancel of one branch of a tee waits for the other (F27); `bash -e` does not
  stop on a failing negated pipeline (F19); Chrome writes a console error for every page answered with 404 or 503 (F16,
  a repeat of the kind of AP-117).

---

## 20. The sketch (for `result.prototype`)

`<outside the project>/m1code-01/` holds: `clone/` (a fresh clone of the tag with the sketch: `app/` — the files of
section 3 as a working sketch, 26 test files and three helpers, `node_modules` from the lockfile —
`.github/workflows/app.yml`, the `.gitignore` lines, `docs/runbooks/`; `tools/node_modules` for the traces run);
`snapcopy/` (the snapshot tree with its own git metadata, AP-146); `rmcheck/` (a fresh clone of the snapshot with every
unlisted path removed, F20; also the TypeScript 7 trial, F8); `mut/` (the mutant clone, clean); `pw-trial/`
(`playwright-core`); `pgdata/` (the private Postgres 16 cluster, a Unix socket only) and its log; `trials/` (the PGlite,
Postgres, timeout, Chrome and mutant scripts, their outputs, the GitHub logs, 18 snapshots under `trials/tmproot/`).
The snapshot commit 7c14e72 (base tree plus 72 files of the sketch, built through a temporary index in the clone, never
in the project's index) was pushed once to `ci/m1code-design-1` at 2026-11-17T18:48:17Z; the runs 44151782390 (`app`,
success) and 44151782067 (`check`, success) were read; the branch was deleted at 18:59:17Z (`git ls-remote` → only
`main` at 6c756cd). The sketch is a measuring tool, not the build: BACKEND-DEV writes the files from this design.

Where the sketch differs from this design (the design wins): the helpers lie at `test/helpers.js`, `test/int/fixtures.js`
and `test/pg/pg-env.js` (the design: `test/fixtures/helpers.js`, `db.js`, `pg-env.js`, О13); `DbError` and `toDbError`
lie in a file `server/db/errors.js` (the design: in `server/db/index.js`, because the requirement's file list has no
`db/errors.js`); the ◦ tests and rows of section 13 are not in it; the tests MG-4, SG-2, NM-4 and AE-3 were added after
the snapshot was pushed (green on the Mac, not run on GitHub); `PASSWORD_BLOCK` is exported for MG-4.

---

## 21. Open questions for ORCH (answered by a record before gate 1b)

- **О1 — the browser-test tool of `app/` (decisions/0116 О3).** Default: `playwright-core` (section 8), as a decision
  record; installed with the first browser test (R1.2), not in this run.
- **О2 — criterion 14 of REQ-108 cannot be met as written.** Chrome writes «Failed to load resource: the server responded
  with a status of 404 (Not Found)» for `/nope` and «… 503 (Service Unavailable)» for the gate page, in every load (F16),
  while criteria 5 and 9 require those statuses and criterion 14 excuses no console line. Default: a micro-amendment of
  REQ-108 (WF-01) before gate 1b: on `/nope` and the gate page exactly one console line is excused per load — level
  error, that text with that status, the URL of the page itself; any other line fails.
- **О3 — the scope of `tsc`.** Default: `api/`, `server/`, `scripts/`, `public/`, `eslint.config.js`; not `test/`.
- **О4 — the Postgres of the `pg` job.** Criterion 11 says «a `postgres:17@sha256:…` service». Default: started by
  `docker run` in a step with a password made in the run (section 4.17), read as that service; the test CIW-1 checks
  the digest and `npm run test:pg`. Alternative: `services:` with a password expression such as the run id (no literal,
  but predictable).
- **О5 — stricter rules than criterion 3 lists** (N2 and `node:worker_threads`, `node:vm`, `eval(`, `Function(`). Default:
  yes, all red.
- **О6 — `/api/health` values when the database is down.** Default: `role` `"unknown"`, `migrations_pending` `null`.
- **О7 — the error codes of section 4.2.** Default: as written.
- **О8 — `PGLITE_DIR` and `MIGRATIONS_DIR`.** Default: names as written, refused in production, listed in `.env.example`.
- **О9 — the closed build's git-tree guard and its S1 check.** Default: as written (V4).
- **О10 — `/gate.html` reachable while open.** Default: accepted; it shows only «Сервис временно остановлен
  владельцем».
- **О11 — the server-side statement log of Postgres may hold the bound password.** Default: a named limit in this design
  and `app/README.md`; S3 reads Neon's logging.
- **О12 — no CSS file and no icon file in M1.** Default: none (the browser's colours pass 4.5 : 1, F16; the icon is
  `data:,`); R1.2 brings the look.
- **О13 — three helper files under `app/test/fixtures/`.** Default: allowed (ARCH §2 lists `test/fixtures/`); they hold no
  test, so the criterion → test table is unchanged.
- **О14 — `db/tx.js` in M1.** Default: `withPlatform` only, one statement; the transaction method of the adapter comes
  with M2.
- **О15 — the Addition to decisions/0001** (section 5). Default: ORCH appends it.
- **О16 — the post-deploy smoke without `--preview`.** The record of REQ-109 runs `smoke.js --base <APP_ORIGIN>
  --expect-version <sha>` (no second host before S2); the design keeps `--preview` optional. Default: as written.
- **О17 — a test step that finds no test file passes.** `node --test` over a glob with no match ends with 0 and «#
  tests 0» (F28), so criterion 2 as written («# fail 0», «# skipped 0», «# todo 0») is met by an empty folder. Default:
  the presence guards NPM-5 (unit, reads the int and pg files) and NM-5 (int, reads the unit files), and TEST-RUNNER and
  RELEASE-VALIDATOR also read «# tests» equal to the catalogue counts; a micro-amendment adding «# tests ≥ 1» to
  criterion 2 is ORCH's choice.

---

## 22. Counts and their commands

- Criteria: 15 + 10 (`grep -c '^      - >-'` in each block of the working file).
- Test files 26 (`ls app/test/unit app/test/int app/test/pg | grep -c '\.test\.js$'` in the sketch); named tests in the
  catalogue 79 (section 13: 44 unit, 31 int, 4 pg), of them 66 in the sketch (`grep -cE '^test\(' ` per file plus the two
  tests of the `SC-2` loop: 38 unit, 24 int, 4 pg); executed in the sketch: 38 + 25 + 4.
- Sketch check: `npm run check` exit 0, unit «# pass 38», int «# pass 25», «# skipped 0», «# todo 0» (F23, last run
  2026-11-17T19:03Z, 39.9 s).
- GitHub: `app` run 44151782390 `success` (check, pg, docker); `check` run 44151782067 `success`, 2209 of 2209 (F14, F15).
- Mutants: 48 in section 16 (29 applied); open questions 17; checked facts 28; build sub-steps 11 (B1–B7, T1–T4).
