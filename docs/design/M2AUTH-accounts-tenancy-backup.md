# M2AUTH — code design: accounts (REQ-114), tenancy (REQ-115) and backup with its rehearsal (REQ-120)

Run `M2AUTH-20261123-01`, WF-02 step 1 (CODE-DESIGNER, handoff `handoffs/M2AUTH-20261123-01/step-01-code-designer.json`),
task M2.2 of PLAN M2. The contract is the three blocks REQ-114 (14 criteria), REQ-115 (12) and REQ-120 (6) of
`docs/requirements.yaml` as committed in f3f5a3b. Base of the run: the tag `base/M2AUTH-20261123-01` (commit f3f5a3b);
its `app/` and `.github/` are byte for byte those of main 27eb6d9, whose app.yml run 45218331263 is the last green one
(F1). Decisions that bind this design: 0001 (stack), 0091 (frozen PLAN and ARCH: changes as «Plan amendments» rows),
0110 and 0129 (checks run on GitHub only), 0116 (the login role, the password step, the selfcheck), 0122 (spike S1
facts), 0127 И and К, 0133, 0134, 0135, 0136.

This file holds shapes, signatures, tables, closed lists and rules. It holds no implementation code (the SQL of section 4.2
is a column list with constraints, not the migration file). Values are marked **[M]** measured (fact number of section 1),
**[R]** required by a block, a decision or ARCH, **[P]** proposed here with its reason (a disputable [P] is a question of
section 16). Nothing under `app/`, `tools/` or `docs/` but this file and the handoff's `result` was written by this step.

---

## 0. Summary

One build (task M2.2) of three blocks that share one migration and one request pipeline.

- **Accounts (REQ-114).** Own auth on `node:crypto` only, zero new dependencies: scrypt passwords, a session cookie of 32
  random bytes kept in the database as an HMAC, a CSRF token derived from the session token, single-use re-auth tokens
  bound to user, session and purpose, the lockout counters in `users`, an admin delay per client address in
  `login_delays`, fixed-window rate limits in `rate_limits`, the setup token compare, admin-issued reset codes in
  `password_resets`, admin TOTP (RFC 6238) with ten recovery codes. Four pages (setup, login, reset, admin TOTP), not
  linked from any public page.
- **Tenancy (REQ-115).** Migration `0002_identity.sql` (10 tables), RLS enabled and forced on `orgs`, `org_members`,
  `invites`, `audit_log`; the helpers `withTenant` / `withPlatform` run on one connection in one transaction through a
  new adapter method `transaction`; the selfcheck also refuses a runtime role that owns a table; route metadata with
  exactly six keys; one request transaction per route that holds every check and the action (protection in the same
  operation); the audit writer with the hash chain under an advisory lock; the isolation suite, the permission matrix and
  `docs/security-invariants.md`.
- **Backup (REQ-120).** `app/scripts/db-verify.js` (a pure comparer plus a reader that only uses constant SQL texts with
  parameters), seeds `app/test/fixtures/rehearsal/<migration>.sql`, the CI job `migration-rehearsal` placed before `e2e`,
  and the runbook `docs/runbooks/backup-restore.md` with the Neon facts read on 2026-11-23 (F17).

Files the code adds: 36 product files (18 changed) and 26 test files plus 2 fixtures (sections 3, 17). Criteria mapped: 32 of 32 (section 9). Mutants: 46
(section 13). Questions for ORCH: 14 (section 16); the one that changes a file list of the blocks is О1 (the grants step,
because `pg_dump --no-acl` drops every GRANT and the restored copy B could not serve the smoke of REQ-120 criterion 3).

---

## 1. Checked facts (command, output, date)

All runs on the trial clone of section 18 unless said; dates UTC.

| # | Fact | Command and output | Date |
| --- | --- | --- | --- |
| F1 | `app/` and `.github/` of the base equal main 27eb6d9; the last green app.yml run on it is 45218331263 with unit 122, int 47, pg 4, e2e 15, each `# fail 0`, `# skipped 0`, `# todo 0` | `git diff --stat 27eb6d9 f3f5a3b -- app .github` → empty; `gh run view 45218331263 --log \| grep -E "# (tests\|fail\|skipped\|todo) "` → check 122/0/0/0, check 47/0/0/0, pg 4/0/0/0, e2e 15/0/0/0 (diff repeated at 2026-11-23T18:03:17Z: 0 lines) | 2026-11-23 |
| F2 | Route rows today have `meta: { tenant }` only; handlers get `{ query, body }` only and answer `{ status, body }`; no cookie, header, address or clock reaches a handler | read `app/server/routes/index.js`, `app/server/app.js` lines 134-153 | 2026-11-23 |
| F3 | `zod` is in SERVER_PACKAGES of the import-boundaries test but is not a dependency of `app/package.json` (dependencies: hono, @hono/node-server, pg) | read `app/package.json`, `app/test/unit/import-boundaries.test.js:29` | 2026-11-23 |
| F4 | The one statement of `/api/health` is `select name, sha256 from schema_migrations` through `db.query`; SC-5 asserts the exact statement sequence `[1, SELFCHECK_SQL], [2, SELFCHECK_SQL], [2, HEALTH_SQL]` and SC-3 the texts `[SELFCHECK_SQL, SELFCHECK_SQL, "select 1"]`; SC-2 asserts the exact refusal line «sai: refused: the database role of the app is a superuser or bypasses row security»; the SC-5 stand-in answers only the two columns `rolsuper`, `rolbypassrls` | read `app/test/int/selfcheck.test.js` 57-269 | 2026-11-23 |
| F5 | On PGlite under `set session authorization sai_app_login`: `set local role sai_app` + `set_config('app.org_id', A, true)` + `set_config('app.role','tenant', true)` inside a transaction → `current_user` sai_app, org A, role tenant, orgs 1 row, org_members 1, audit_log 0; after commit the connection answers `sai_app_login` and `''` | `node sketch/t1-rls.mjs` → `tenant A sees orgs [{"u":"sai_app","o":"1111…","r":"tenant","orgs":1,"m":1,"al":0}]`, `after tx [{"u":"sai_app_login","o":""}]` | 2026-11-23T17:47:26Z |
| F6 | Forced RLS with the ARCH §4 policy refuses an INSERT with a foreign org_id and an UPDATE that sets it (SQLSTATE 42501); without app.org_id every tenant table reads 0 rows | same run → `insert foreign refused "42501"`, `update foreign refused "42501"`, `no org [{"o":0,"m":0}]` | 2026-11-23T17:47:26Z |
| F7 | The append-only trigger refuses UPDATE and DELETE of `audit_log` also for the superuser (P0001); sai_app without a grant gets 42501 | same run → `audit update superuser refused "P0001"`, `audit delete superuser refused "P0001"`, `audit update tenant refused "42501"` | 2026-11-23T17:48Z |
| F8 | The folded selfcheck statement of 4.6 answers `rolbypassrls false` on a clean 0001+0002 and `true` after `alter table planted_owned owner to sai_app`, with the same two columns as today | same run → `selfcheck clean [{"rolsuper":false,"rolbypassrls":false}]`, `selfcheck owner planted [{"rolsuper":false,"rolbypassrls":true}]` | 2026-11-23T17:48Z |
| F9 | PGlite serialises `transaction()`: a plain query sent during it waits for its end; a manual `exec("begin")` on the same PGlite does **not** serialise: a plain query runs inside the open transaction | same run → `pglite transaction() interleave ["tx-insert","tx-end","outside saw 1"]`, `manual begin interleave ["manual-insert","outside saw 2","manual-rollback"]` | 2026-11-23T17:48Z |
| F10 | `query_to_xml(format('select * from public.%I order by 1', $1::text), true, false, '')` runs on PGlite with the table name as a bound parameter | same run → `query_to_xml [{"x":"<table …><row><x>1</x></row></table>"}]` | 2026-11-23T17:48Z |
| F11 | `crypto.scryptSync(…, 64, { N: 2**15, r: 8, p: 1 })` with the default `maxmem` throws `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`; with `maxmem: 64 MiB` it takes 130 ms (sync) and 140 ms (async) on this PC | `node sketch/t2-crypto.mjs` → `scrypt default maxmem "ERR_CRYPTO_INVALID_SCRYPT_PARAMS"`, `scrypt ms (maxmem 64 MiB) 130`, `async scrypt ms 140` | 2026-11-23T17:48:04Z |
| F12 | HMAC-SHA1 HOTP with dynamic truncation on the RFC 6238 Appendix B key gives all six 8-digit values; their last 6 digits equal the 6-digit codes | same run → six lines `totp T=… ["94287082",true,…]` … `["65353130",true,"353130","353130"]` | 2026-11-23T17:48:04Z |
| F13 | In Hono, `app.request(url, init, { clientIp })` reaches the handler as `c.env.clientIp`; on the Node server through `getRequestListener` the handler reads `c.env.incoming.socket.remoteAddress` (127.0.0.1) and a sent `X-Forwarded-For` does not change it | same run → `app.request env {"incoming":null,"given":"203.0.113.7"}`, `node server env {"incoming":"127.0.0.1","given":null}` | 2026-11-23T17:48:04Z |
| F14 | 32 random bytes are 43 base64url characters; 16 bytes are 22 | same run | 2026-11-23T17:48:04Z |
| F15 | `app/vercel.json` is one `routes` table: headers (`continue`), `handle: filesystem`, `/api` → `/api/index?__p=$1`, terminal 404 → `/404.html`; a clean address such as `/setup` would answer the 404 page | read `app/vercel.json`; decisions/0122 О5 (2) | 2026-11-23 |
| F16 | Production connects as `sai_app_login` with `APP_DB_PASSWORD` (spike S1 fact 8); the attributes of the Neon owner role were not read | decisions/0122 О5 (8) | read 2026-11-23 |
| F17 | Vendor pages, read through the fetch helper: Vercel `x-forwarded-for` «The public IP address of the client that made the request.» and «we currently overwrite the X-Forwarded-For header and do not forward external IPs. This restriction is in place to prevent IP spoofing.» (https://vercel.com/docs/headers/request-headers, page dated 2025-12-13). Neon Free: «History window … 6 hours, up to 1 GB of changes»; «Instant restore … Free: No charge, up to 6 hours, limited to 1 GB of change history per project»; «Snapshots: 1 manual snapshot» (https://neon.com/docs/introduction/plans, updated 2026-11-18); restore: «select your branch, then open Postgres database > Backup & Restore and use Restore from history»; «Instant restore is only supported for root branches.»; «Current data is overwritten.»; a backup branch `{branch_name}_old_{head_timestamp}` is made (https://neon.com/docs/introduction/branch-restore, updated 2026-11-06). The pricing page (https://neon.com/pricing, 2026-11-04) shows «-» for Instant restore on Free: a conflict, so the owner reads his console (runbook) | WebFetch of the four addresses | 2026-11-23 |
| F18 | Guard grep of `app/test` and `tools/test`: the lines of section 11 (MP-1, MP-2, MG-1, HL-2, HL-3, CIW JOBS and the docker 0001 row, NPM-5 and its lists, PB-6, PP-1, DF-1 rules, SC-*); `tools/test` names `app/` only in `tools/test/e2e/kit/find-chrome.js` and `tools/test/e2e-kit.test.js` (the Chrome path) | `grep -rn "0001_init\|0002\|org_id\|INT_FILES\|PG_FILES\|JOBS\|gate.html\|\.html\"" app/test`; `grep -rln "app/" tools/test` | 2026-11-23 |
| F19 | Outside `app/server/db/` the only `.query(`/`.exec(`/`.transaction(` forms in `app/server` and `app/api` are `db.query` in `routes/health.js:46` and the regular-expression literal `.exec(` of `config.js:141` | `grep -rn "\.query(\|\.exec(\|\.transaction(" server api` | 2026-11-23 |
| F20 | `app/scripts/` is outside every rule of `import-boundaries.test.js` (it reads `server/`, `api/`, `public/`, `worker/` only, line 419) and outside `no-string-sql.test.js` (it reads `app/server`, line 126) | read both files | 2026-11-23 |
| F21 | `ci-workflow.test.js` pins `JOBS = ["check","pg","docker","e2e"]`, requires `e2e` to be the last job (CIW-2 cuts the file at `\n  e2e:\n`) and refuses `\|\|`, `continue-on-error`, `set +e` and a line starting `! ` anywhere | read lines 32, 287, 404-410, 365-366 | 2026-11-23 |
| F22 | `readConfig` checks in the order PORT, DATABASE_URL (production), TEST_ONLY, URLs, origins, LOG_LEVEL; DBC-5 asserts `E_CONFIG_TEST_ONLY` and «DATABASE_URL is checked first» on production inputs without a pepper | read `app/server/config.js`, `app/test/unit/db-config.test.js` 73-103 | 2026-11-23 |

Not measurable here and named so: `pg_dump --no-acl` drops the GRANT statements (documented behaviour of pg_dump,
not run here: no Postgres binary on this PC; the CI job proves the consequence, О1); `openssl` present in the pinned
`postgres:17` image (a step of the job proves it, 6.3); Vercel's behaviour for a client-sent `X-Forwarded-For` on a
direct request (the page states only the overwrite; post-deploy probe, 14); the Neon owner role's BYPASSRLS (О9).

---

## 2. Choices (the disputable ones are questions of section 16)

| # | Choice | Reason | Alternative |
| --- | --- | --- | --- |
| C1 | **[P]** No `zod`: a small strict validator `app/server/http/schema.js` (exact keys, types, lengths, enums) | ARCH §1.1 «own small auth», zero new dependency; REQ-114 c8 of REQ-115 needs only «unknown keys refused» (F3) | add zod (an Addition to 0001 and REQ-108 c1 list), О2 |
| C2 | **[P]** Pages by `.html` names: `/setup.html`, `/login.html`, `/reset.html`, `/admin-totp.html` | `vercel.json` and VC-1 stay unchanged (F15) | clean addresses: one routes row each and a VC-1 row |
| C3 | **[P]** One **request transaction** per database route that holds the session read, every check, the counters, the re-auth consumption and the action | «protection in the same operation as the action»; a thrown refusal rolls everything back, so «state unchanged» holds by construction | separate transactions per step |
| C4 | **[P]** A refusal that must be counted is **returned** (commits its counters); every other refusal is **thrown** (rolls back) | the lockout, the admin delay and the limits must persist; CSRF, schema and re-auth refusals must leave no row | — |
| C5 | **[P]** CSRF token derived: `base64url(HMAC(pepper, "csrf\0" + session token))`; `auth_sessions.csrf_hash` keeps its HMAC | `GET /api/auth/me` must return it while the database keeps no clear value | a random token stored encrypted |
| C6 | **[P]** The selfcheck stays one statement with the same two columns; table ownership folds into `rolbypassrls` | SC-2, SC-3, SC-5 keep their inputs and answers (F4, F8); a table owner can switch row security off for its table | a third column (SC-5's stand-in has two) |
| C7 | **[P]** On PGlite `withTenant` uses `PGlite.transaction()`, never `exec("begin")` | F9: a manual begin lets another request's statement run inside the transaction | — |
| C8 | **[P]** Vercel client address = the `x-forwarded-for` value when it is exactly one IP literal; anything else → the shared bucket `unknown` | F17: Vercel overwrites it to prevent spoofing | `x-real-ip` (documented as identical) |
| C9 | **[P]** The admin delay applies when the target account is the platform admin; ordinary accounts get the lock | the letter of REQ-114 c5 | a delay for every account |
| C10 | **[P]** The reset limit `reset`: 10 per 15 minutes per address (the description names none) | the same numbers as login; the code is 128 bits | 10 per hour |
| C11 | **[P]** db-verify reads rows with `query_to_xml(format(…%I…), …)` and every name as a bound parameter | Q9 in a script; F10 | dynamic SQL text in Node |
| C12 | **[P]** Mask list of REQ-115 c8 (lane-a P1): a closed table `MASKED` in `app/test/int/isolation.test.js`, mirrored in 4.13; each entry has a kind (`id`, `code`, `token`, `time`) and the test checks the masked value's shape for that kind | the code under test cannot declare what its own test ignores; a mask cannot hide a value of another kind | a field of the route row |
| C13 | **[P]** REQ-120 previous-schema mode (lane-b P1): `schema_migrations` is compared only by the prefix rule; the row-count, key and content rules read «every other table of A» | settles the two readings | — |
| C14 | **[P]** Grants in `app/db/grants.sql`, applied by `migrate.js` on every run after the files (like the password step) | `--no-acl` restores no GRANT; B must serve the smoke | О1 |

---

## 3. Files, owners and order

Product files (new unless «changed»). Owner: **B** = BACKEND-DEV, **F** = FRONTEND-DEV, **T** = TEST-DESIGNER (step 5;
the developers name the tests, TEST-DESIGNER writes and fixes them, WF-02).

| Owner | File | What |
| --- | --- | --- |
| B | `app/db/migrations/0002_identity.sql` | 4.2 |
| B | `app/db/grants.sql` (О1) | 4.2.4 |
| B | `app/server/db/index.js` (changed) | `Db.transaction`, adapter contract `transaction` (4.5) |
| B | `app/server/db/pg.js`, `app/server/db/pglite.js` (changed) | adapter `transaction` (4.5) |
| B | `app/server/db/tx.js` (changed) | `withTenant`, `withPlatform` (4.5) |
| B | `app/server/db/selfcheck.js` (changed) | folded statement (4.6) |
| B | `app/server/db/migrate.js` (changed, О1) | the grants step (4.2.4) |
| B | `app/server/db/health-read.js` | the health read moved (4.5.4) |
| B | `app/server/db/auth-store.js` | every statement of the auth services (4.9) |
| B | `app/server/db/audit-store.js` | the audit statements (4.11) |
| B | `app/server/config.js` (changed) | `secretPepper`, `setupTokenHash` (4.15) |
| B | `app/server/app.js` (changed) | the pipeline wiring, `clientIp`, answer headers, `routeTable` injection (4.7) |
| B | `app/server/http/errors.js` (changed) | the new codes, `AUTH_CODES` (4.8) |
| B | `app/server/http/schema.js` | strict body validator (C1) |
| B | `app/server/http/csrf.js` | Origin, Content-Type, CSRF token (4.7) |
| B | `app/server/http/auth-mw.js` | the request pipeline (4.7) |
| B | `app/server/http/rate-limit.js` | fixed windows, keys (4.10) |
| B | `app/server/http/client-ip.js` | address normalisation (4.10) |
| B | `app/server/auth/keys.js` | the pepper-derived HMAC and the TOTP key (4.9.1) |
| B | `app/server/auth/password.js`, `sessions.js`, `reauth.js`, `lockout.js`, `setup.js`, `totp.js` | 4.9 |
| B | `app/server/services/audit.js` | the one audit writer (4.11) |
| B | `app/server/routes/index.js` (changed), `app/server/routes/health.js` (changed), `app/server/routes/demo.js` (changed: the meta object of its two rows only) | 4.4, 4.5.4 |
| B | `app/server/routes/auth.js`, `app/server/routes/admin.js` | 4.4 |
| B | `app/api/index.js` (changed) | passes `{ clientIp }` (4.10) |
| B | `app/scripts/setup-token.js`, `app/scripts/uat-login.js`, `app/scripts/db-verify.js` | 4.16, 4.17, 6.1 |
| B | `app/test/fixtures/rehearsal/0001_init.sql`, `0002_identity.sql` | 6.2 |
| B | `app/.env.example`, `app/compose.yaml`, `app/README.md` (changed) | 4.15, 6.3, 6.4 |
| B | `.github/workflows/app.yml` (changed) | job `migration-rehearsal`, docker passwords line (6.3) |
| B | `docs/runbooks/backup-restore.md`, `docs/security-invariants.md` | 6.4, 4.14 |
| F | `app/public/setup.html`, `login.html`, `reset.html`, `admin-totp.html` | 5 |
| F | `app/public/js/api.js`, `app/public/js/pages/setup.js`, `login.js`, `reset.js`, `admin-totp.js` | 5 |
| F | `app/public/shared/i18n/texts.js` (changed) | the `auth_` keys (5.3) |
| T | the test files of section 9 and the guard edits of section 11; `app/test/fixtures/auth.js`, `app/test/fixtures/permission-matrix.golden.json` | 9, 11 |

Order: (1) B writes the shared contract first — `errors.js` codes, the route row shape, `RouteRequest`/`RouteAnswer`,
the API table of 4.4 is this file — and F only reads it; (2) B and F in parallel in their own files; F reads the codes
and bodies of 4.4 and 4.8 and reports a divergence through ORCH; (3) T after both (step 5). No file has two writers.
`app/public/shared/i18n/texts.js` is F's only; `app/server/http/errors.js` is B's only.

---

## 4. Interfaces

### 4.1 Common shapes

- **Ids** are lower-case uuid texts checked by `UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`
  before any statement **[R ARCH §14.2]**.
- **Times** come from the injected clock `deps.auth.clock(): number` (ms since epoch) and enter SQL as parameters;
  no comparison in SQL uses `now()` **[P]** (so the injected clock rules PGlite and Postgres alike). Column defaults
  `now()` stay only for `created_at`-like columns no rule reads.
- **Secrets in the database** are HMAC hex texts (64 lower-case hex) of 4.9.1; the TOTP secret is AES-256-GCM text.
- **Bodies** are JSON objects read by `schema.js`; an unknown key, a missing required key, a wrong type, a text over its
  limit or with a control or invisible character (`public/shared/text-rules.js`) → `400 bad_body`; not JSON or not
  UTF-8 → `400 bad_json` (the existing codes).

### 4.2 Migration `app/db/migrations/0002_identity.sql`

Applied by `server/db/migrate.js` in one transaction as the owner role (as 0001). Expand-only. Ten tables; columns
with type, nullability, default and check. «→» is a foreign key.

#### 4.2.1 Global tables (no org_id, no RLS)

| Table | Columns | Keys and checks |
| --- | --- | --- |
| `users` | id uuid pk default gen_random_uuid(); email text not null (3–254 chars); email_norm text not null unique (= lower(email_norm)); display_name text not null (1–80); password_hash text not null (≤ 200, `^scrypt\$15\$8\$1\$`); is_platform_admin bool not null default false; is_owner_identity bool not null default false; totp_secret_enc text null (≤ 200); totp_enabled_at timestamptz null; totp_last_step bigint null; totp_recovery text[] not null default '{}' (each 64 hex, at most 10); language text not null default 'ru' in ('ru','kk','en'); status text not null default 'active' in ('active','disabled','deleted'); failed_logins int not null default 0 ≥ 0; failed_since timestamptz null; locked_until timestamptz null; reauth_failures int not null default 0 ≥ 0; reauth_failed_since timestamptz null; reauth_locked_until timestamptz null; created_at timestamptz not null default now(); last_login_at timestamptz null | unique partial index on `((true)) where is_platform_admin` (at most one admin); check `totp_enabled_at is null or totp_secret_enc is not null` |
| `auth_sessions` | id uuid pk; user_id uuid not null → users; token_hash text not null unique (64 hex); csrf_hash text not null (64 hex); created_at, last_seen_at, abs_expires_at timestamptz not null; ip_hmac text null (64 hex) | index (user_id); the idle limit is `last_seen_at + 12 h`, so a GET changes only `last_seen_at` (REQ-114 c4); ARCH's `idle_expires_at` is not kept (О3) |
| `reauth_tokens` | id uuid pk; user_id uuid not null → users; auth_session_id uuid not null → auth_sessions on delete cascade; purpose text not null in (the 11 purposes of 4.9.4); token_hash text not null unique; created_at, expires_at timestamptz not null; used_at timestamptz null | index (auth_session_id) |
| `password_resets` | id uuid pk; user_id uuid not null → users; code_hash text not null unique; created_by uuid not null → users; created_at, expires_at timestamptz not null; used_at timestamptz null | index (user_id) |
| `rate_limits` | key text not null (64 hex); window_start timestamptz not null; count int not null ≥ 1 | pk (key, window_start) **[R ARCH §4]** |
| `login_delays` | key text pk (64 hex); fails int not null ≥ 1; next_at timestamptz not null; updated_at timestamptz not null | — |

`password_resets` and `login_delays` are added to the ARCH §4 table list (the reset code and the admin delay need a
place; the users row would hold one code only and no per-address state). ARCH change → a «Plan amendments» row (О3).

#### 4.2.2 Tenant tables (org_id; RLS enabled and forced)

| Table | Columns | Keys, checks, triggers |
| --- | --- | --- |
| `orgs` | id uuid pk; name text not null (1–120); kind text not null in ('owner','customer'); ai_allowed bool not null default false; created_by uuid null → users; created_at timestamptz not null default now() | unique partial index (kind) where kind = 'owner'; RLS on `id` |
| `org_members` | org_id uuid not null → orgs; user_id uuid not null → users; role text not null in ('org_owner','org_admin','member','viewer'); created_at timestamptz not null default now() | pk (org_id, user_id); unique (user_id) (one membership per user in V1, decisions/0135 О15); trigger BEFORE INSERT OR UPDATE: a member of the `owner` organisation must have `is_owner_identity` (P0001) **[R ARCH §4]** |
| `invites` | id uuid pk; org_id uuid null → orgs; email_norm text not null; role text not null in the four roles; code_hash text not null unique; expires_at timestamptz not null; used_at timestamptz null; used_by uuid null → users; created_by uuid not null → users; created_at timestamptz not null default now() | index (org_id); used by REQ-116 |
| `audit_log` | id bigint pk (sequence `audit_log_id_seq`, taken by the writer, 4.11); org_id uuid null → orgs; actor_kind text not null in ('user','admin','worker','system'); actor_id uuid null; action text not null (the closed list of 4.11); target_kind text null; target_id text null (≤ 64); ip_hmac text null; details jsonb not null default '{}'; prev_hash text not null (64 hex); hash text not null unique (64 hex); created_at timestamptz not null | index (org_id, id); trigger BEFORE UPDATE OR DELETE raises P0001 for every role **[M F7]** |

`invites.org_id` may be null (a new customer organisation, ARCH §4); the policy then gives the row only to `platform`
and `worker` (`null = x` is not true), which is the intent.

#### 4.2.3 Row-level security and grants

- For `org_members`, `invites`: `enable` and `force row level security`; one policy `<table>_tenant` `for all to sai_app`
  with USING and WITH CHECK `org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform','worker')`
  **[R ARCH §4]**. `orgs`: the same on `id` **[R REQ-115 c1]**.
- `audit_log`: enabled and forced; policy `audit_log_insert` `for insert to sai_app with check (true)`; policy
  `audit_log_select` `for select to sai_app using (current_setting('app.role', true) = 'platform')`; no UPDATE or DELETE
  policy, no grant, and the trigger **[R ARCH §4, REQ-115 c3]**.
- `sai_app` and `sai_preview` own no table (unchanged); `sai_preview` gets nothing on 0002 tables (M4).

Least grants to `sai_app` (the routes of 4.4 and the tests of c2 need exactly these):

| Table | Grants | Why |
| --- | --- | --- |
| `users` | select, insert, update | setup, login counters, password, TOTP |
| `orgs` | select, insert | setup; RLS isolation reads |
| `org_members` | select, insert | setup; membership read; c2 |
| `invites` | select, insert, update | c2 reads and refused writes prove RLS, not a missing grant; REQ-116 uses them |
| `auth_sessions`, `reauth_tokens`, `password_resets`, `rate_limits`, `login_delays` | select, insert, update, delete | the auth routes and the lazy cleanup |
| `audit_log` | select, insert; usage on `audit_log_id_seq` | the writer and verify |
| `platform_settings` (0001) | select, insert | `setup_done` |
| `schema_migrations` (0001) | select (as today) | health |

A pg test (RLS-5, 9.2) compares `information_schema.role_table_grants` for `sai_app` with this table: one grant more or
less is red.

#### 4.2.4 The grants step (О1, recommended answer)

`app/db/grants.sql`: only `grant … to sai_app;` statements and `grant usage on schema public to sai_app, sai_preview;`
— the whole table of 4.2.3, including the two grants of 0001 restated. `migrate.js` runs it after the migration files
and before the password step, on every run, in its own transaction under the same advisory lock; log line
`migrate: the grants are set`; a failure → `MigrateError E_MIGRATE_GRANTS` «migrate: refused: the grants step failed»,
exit 1, the transaction rolled back. The migration files hold no `grant` (0001's two stay as applied history). Why:
`pg_dump --no-acl` (REQ-120 flags) restores no GRANT, so the restored copy B, and any moved database (ARCH §20.5),
gets its grants back when `node server/db/migrate.js` runs on it. Without О1 «да» the alternative is the dump without
`--no-acl` (a change of REQ-120 text) — the design then puts the grants in 0002 and drops this step.

### 4.3 Roles and helpers summary

`app.role` values: `tenant` (withTenant), `platform` (withPlatform); `worker` is lane B. The request transaction of 4.7
for every route of M2.2 is a `withPlatform` transaction (every table it touches is global, or is read by the user's own
id with an explicit `where user_id = $1` filter, ARCH §4 «Platform … code also filter by org_id explicitly»). Tenant
routes (REQ-117) open their own `withTenant(session.orgId)` inside the handler (4.7 step 10).

### 4.4 The route table (`app/server/routes/index.js`)

Route row: `{ method, path, meta, handler }`; `meta` is frozen and has **exactly** these keys and types **[R REQ-115 c6]**:

| Key | Type | Meaning |
| --- | --- | --- |
| `tenant` | boolean | the route reads or writes tenant data of the session's organisation; implies a signed-in user |
| `admin` | boolean | only the platform admin; everyone else gets the uniform 404 before any other check |
| `reauth` | string \| null | the re-auth purpose the route consumes (4.9.4), or null |
| `worker` | boolean | a worker route (lane B); false for every row of M2.2 |
| `session` | boolean | the route uses the session cookie and falls under the CSRF rule of REQ-114 c4 |
| `rateLimit` | `"setup"` \| `"login"` \| `"reset"` \| `"user"` \| null | the limit of 4.10; `"user"` also means «a signed-in user is needed» (401) |

The rows (in this order; the demo rows only when the app is given the demo, as today):

| # | Method, path | tenant | admin | reauth | worker | session | rateLimit | File |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | GET /api/demo/questionnaire | f | f | null | f | f | null | routes/demo.js (meta only changes) |
| 2 | POST /api/demo/result | f | f | null | f | f | null | routes/demo.js |
| 3 | GET /api/health | f | f | null | f | f | null | routes/health.js |
| 4 | POST /api/auth/setup | f | f | null | f | t | setup | routes/auth.js |
| 5 | POST /api/auth/login | f | f | null | f | t | login | routes/auth.js |
| 6 | POST /api/auth/logout | f | f | null | f | t | user | routes/auth.js |
| 7 | GET /api/auth/me | f | f | null | f | t | user | routes/auth.js |
| 8 | POST /api/auth/password | f | f | null | f | t | user | routes/auth.js |
| 9 | POST /api/auth/reauth | f | f | null | f | t | user | routes/auth.js |
| 10 | POST /api/auth/reset | f | f | null | f | t | reset | routes/auth.js |
| 11 | POST /api/admin/users/:id/reset-link | f | t | reset_link | f | t | user | routes/admin.js |
| 12 | POST /api/admin/totp/enrol | f | t | totp_enrol | f | t | user | routes/admin.js |
| 13 | POST /api/admin/totp/confirm | f | t | null | f | t | user | routes/admin.js |
| 14 | POST /api/admin/totp/off | f | t | totp_off | f | t | user | routes/admin.js |
| 15 | GET /api/admin/audit/verify | f | t | null | f | t | user | routes/admin.js |

No tenant route exists in M2.2 (the printed count of IS-1 is 0, REQ-115 c7; REQ-117 brings them).

Request and answer of every M2.2 route (bodies are JSON; «→» success; every route may also answer the pipeline codes of
4.7: 404 not_found (admin), 403 origin_refused / csrf_refused, 415 unsupported_type, 401 auth_required (rateLimit user),
429 rate_limited, 403 reauth_required, 400 bad_json / bad_body, 503 db_unavailable / server_config, 500 server_error):

| # | Body in | → answer | Own refusals |
| --- | --- | --- | --- |
| 4 | `{token: 43 b64url, email, name: 1–80, password: 10–128, language?: ru\|kk\|en}` | 201 `{"ok":true}`; creates users (admin, owner identity), orgs (owner, ai_allowed), org_members (org_owner), platform_settings `setup_done` = `true`, 1 audit row `auth.setup` | 404 uniform (returned, counted) when SETUP_TOKEN_HASH is unset, not `^[0-9a-f]{64}$`, the token differs, or setup is done; 400 password_rules |
| 5 | `{email, password: ≤ 128, code?: 6 digits \| 16 base32}` | 200 `{"ok":true}` + `Set-Cookie` (4.9.3); audit `auth.login` | 401 invalid_credentials (returned); 429 locked + Retry-After (returned); 429 rate_limited + Retry-After (admin delay, returned, no scrypt); 401 totp_required, 401 totp_invalid (returned) |
| 6 | `{}` | 200 `{"ok":true}` + clearing `Set-Cookie`; deletes the session; audit `auth.logout` | — |
| 7 | (GET) | 200 `{"id","name","language","platform_admin":bool,"memberships":[{"org_id","role"}],"csrf"}` | — |
| 8 | `{current: ≤ 128, next: 10–128}` | 200 `{"ok":true}`; new hash; deletes every other session of the user; audit `auth.password_change` | 401 invalid_credentials (returned; counts a re-auth failure, 4.9.5); 429 reauth_locked; 400 password_rules |
| 9 | `{password: ≤ 128, purpose, code?}` | 200 `{"token": 43 b64url, "expires_in": 300}`; audit `auth.reauth` | 400 unknown_purpose (thrown); 401 invalid_credentials, totp_required, totp_invalid (returned, counted); 429 reauth_locked (returned) |
| 10 | `{code: 22 b64url, password: 10–128}` | 200 `{"ok":true}`; new hash; deletes every session of that user; clears its lock counters; audit `auth.reset_used` | 400 password_rules (thrown, code unused); 400 reset_invalid (returned, counted) |
| 11 | `{}`; `:id` uuid | 200 `{"link": "<APP_ORIGIN>/reset.html#c=<22 b64url>"}`; deletes the user's earlier unused codes; audit `auth.reset_link_issued` with `reauth_id` | 404 uniform when `:id` is not a uuid or no live user has it |
| 12 | `{}` | 200 `{"secret": 32 base32, "otpauth": "otpauth://totp/Sai:<email>?secret=…&issuer=Sai&algorithm=SHA1&digits=6&period=30"}`; stores the encrypted secret, `totp_enabled_at` null; audit `auth.totp_enrol` | 409 totp_state when TOTP is on |
| 13 | `{code: 6 digits}` | 200 `{"recovery_codes": [10 × 16 base32]}`; `totp_enabled_at` set, `totp_last_step` set, 10 HMACs stored; audit `auth.totp_confirm` | 409 totp_state (no pending secret or already on); 401 totp_invalid (returned) |
| 14 | `{code: 6 digits \| 16 base32}` | 200 `{"ok":true}`; clears secret, enabled time, last step, recovery; audit `auth.totp_off` | 409 totp_state (off); 401 totp_invalid (returned) |
| 15 | (GET) | 200 `{"ok":true,"count":N}` or `{"ok":false,"count":N,"bad_id":"<id>"}` | — |

`email` everywhere: 3–254 characters, exactly one `@` with at least one character on each side, no whitespace, control
or invisible character; `email_norm` = its lower case (ASCII mapping only) **[P]**. `name`: 1–80, text rules. Passwords
are counted in code points and normalised to NFC before scrypt **[P]**.

### 4.5 Database layer

#### 4.5.1 Adapter contract (`app/server/db/index.js`)

`Adapter = { query(text, params?), exec(text), close(), transaction(fn) }` — `transaction<T>(fn: (c: { query(text,
params?): Promise<{rows}> }) => Promise<T>): Promise<T>`: every statement of `fn` runs on one connection between BEGIN and
COMMIT; a throw of `fn` → ROLLBACK and the throw goes on; errors are `DbError` (as today).
- `pg.js`: `pool.connect()`, `begin`, `fn`, `commit`; on a throw `rollback` then `client.release(true)` (the connection is
  dropped, so a broken or silent one never returns to the pool); the pool's `query_timeout` 3000 ms applies to each
  statement (as today).
- `pglite.js`: `PGlite.transaction(tx => fn(tx))` (C7, F9).
- Test doubles that lack `transaction` keep working for the routes they are used with (health and demo never call it).

#### 4.5.2 `Db.transaction(fn, { deadlineAt })`

Runs `ensureSafe()` and then `adapter.transaction(fn)`, the two raced together against `deadlineAt` (ms of the
monotonic clock; default now + `TX_DEADLINE_MS` = 4500 **[P]**, below the 5 s of REQ-114 c10). On the deadline →
`DbError E_DB_DOWN` (the late transaction still ends by its own timeouts and is dropped). `Db.query` stays as today
(health uses it; SC-3 and SC-5 unchanged).

#### 4.5.3 `app/server/db/tx.js`

```
withTenant(db, orgId: string, fn: (q) => Promise<T>, opts?: { deadlineAt?: number }) => Promise<T>
withPlatform(db, fn: (q) => Promise<T>, opts?: { deadlineAt?: number }) => Promise<T>
```
- `withTenant`: `orgId` must match UUID, else `TypeError("withTenant: orgId is not a uuid")` **before** `db.transaction`
  is called (0 statements, REQ-115 c4).
- Both: inside the transaction, first `set local role sai_app`, then
  `select set_config('app.org_id', $1, true), set_config('app.role', $2, true)` with `[orgId, 'tenant']` or
  `['', 'platform']`, then `fn(q)`, where `q.query(text, params)` is the connection's query. `q` has no `exec`.
- The M1 signature `withPlatform(db, fn)` keeps its name; its only caller today is none (F19), so nothing breaks.

#### 4.5.4 The one place of database calls

`routes/health.js` calls `readAppliedMigrations(db)` of `app/server/db/health-read.js`, which runs the same text
`select name, sha256 from schema_migrations` through `db.query` (one statement, no transaction: SC-5 keeps its
sequence). Every statement of the auth and audit code stands in `app/server/db/auth-store.js` and
`app/server/db/audit-store.js` as named functions that take `q` and parameters (4.9, 4.11); services and routes call
those functions and never `.query(`, `.exec(` or `.transaction(` (DBC-1, 9.2). The rule of `db-calls.test.js`: in
every `.js` file of `app/server` and `app/api` outside `app/server/db/`, a `.query(`, `.exec(` or `.transaction(` call is
a database call, except `.exec(` written directly after a regular-expression literal (`/…/flags.exec(`, the form of
`config.js:141`, F19); comments and strings are blanked first (the blanking of import-boundaries IB-4). A regular
expression kept in a constant is called with `.test(` or `String.prototype.match` instead.

### 4.6 Selfcheck (`app/server/db/selfcheck.js`)

`SELFCHECK_SQL` stays one statement with the columns `rolsuper` and `rolbypassrls` (C6). New text, as measured (F8):

`select coalesce(bool_or(r.rolsuper), true) as rolsuper, coalesce(bool_or(r.rolbypassrls), true) or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f') and pg_has_role(session_user, c.relowner, 'MEMBER')) as rolbypassrls from pg_roles r where pg_has_role(session_user, r.oid, 'MEMBER')`

`judgeRole` unchanged. The refusal line of node-main stays exactly «sai: refused: the database role of the app is a
superuser or bypasses row security» (SC-2 keeps it; it is the code design's text of REQ-115 c5 for the owner case too,
because an owner can disable or un-force row security on its table). At the base the old statement passes a planted
ownership (SC-7 red on the base, AP-071).

### 4.7 The request pipeline (`app/server/http/auth-mw.js`, wired by `app/server/app.js`)

`RouteRequest` (what a handler gets): `{ query, body, params, headers: Headers, clientIp: string | null, now: number,
session: Session | null, q: Q | null, reauthId: string | null, withTenant?: (fn) => Promise }`.
`RouteAnswer`: `{ status, body, headers?: Array<[name, value]> }` where `name` ∈ {`Set-Cookie`, `Retry-After`} only.
`Session = { id, userId, isAdmin, orgId | null, role | null, csrf }` (orgId and role from the user's only membership).

`clientIp`: from `c.env.clientIp` when the env has that key (the Vercel entry), else `c.env.incoming.socket.remoteAddress`
(the Node server), else null (F13); normalised by `client-ip.js` (4.10). A request header is never read for it on the
Node server.

For a route whose `meta.session` is true or whose `rateLimit` is not null, the steps, in this order, in **one**
`withPlatform` transaction (C3), with the request's deadline:

| Step | Rule | Refusal (kind) |
| --- | --- | --- |
| 0 | auth configured: `secretPepper` present and the cookie name of 4.9.3 defined for APP_ORIGIN | 503 server_config (thrown, before the transaction) |
| 1 | read the session (read only): cookie of the configured name, 43 base64url, `token_hash` found, `last_seen_at + 12 h > now`, `abs_expires_at > now`, user `status = 'active'`; membership by `user_id` | none: an unknown, expired or malformed cookie reads as no session; the cookie is not cleared (the 404 stays byte-equal) |
| 2 | `meta.admin` and not (session and isAdmin) | 404 not_found, UNIFORM_404, no other header (thrown) |
| 3 | method ≠ GET and `meta.session`: `Origin` header equal to APP_ORIGIN | 403 origin_refused (thrown) |
| 4 | method ≠ GET and `meta.session`: media type of `Content-Type` is `application/json` (case-insensitive; one optional `charset=utf-8` parameter) | 415 unsupported_type (thrown) |
| 5 | method ≠ GET, `meta.session`, session present: `x-sai-csrf` equals the session's CSRF token (timingSafeEqual on equal lengths; a length mismatch is a refusal) | 403 csrf_refused (thrown) |
| 6 | `meta.tenant` or `rateLimit = "user"`: session present | 401 auth_required (thrown) |
| 7 | `rateLimit` not null: increment the window of 4.10 | 429 rate_limited + Retry-After (thrown: the increment rolls back, the count stays at the limit) |
| 8 | `meta.reauth` not null: consume `x-sai-reauth` (4.9.4) | 403 reauth_required (thrown) |
| 9 | read and validate the body (C1) | 400 bad_json / bad_body (thrown) |
| 10 | the handler, with `q` of this transaction (and `withTenant` bound to `session.orgId` for tenant routes, which opens a second transaction under the same deadline) | its own (4.4) |
| 11 | session present and not ended by the handler: `last_seen_at = now` (the only column a GET changes) | — |
| 12 | lazy cleanup when `deps.auth.random() < 0.01` (4.10) | — |
| 13 | commit; answer | — |

A `DbError` anywhere → 503 `db_unavailable` (E_DB_DOWN, E_DB_ROLE) or 500 `server_error` (E_DB_QUERY), no
`Set-Cookie`. GET routes skip steps 3–5 and change no row except `auth_sessions.last_seen_at`, `rate_limits` and
`audit_log` (REQ-114 c4). CS-1 calls each route as an actor that passes step 2 (the admin for the admin routes), so the
refusal it sees is the CSRF one. Routes with `session` false and `rateLimit` null (demo, health) take the
pipeline of today unchanged.

`app.js` changes: the route loop passes the extended RouteRequest; writes `RouteAnswer.headers`; accepts
`deps.routeTable?: (deps) => Route[]` (default the real one) so the tests can plant rows (RT-3, RT-4, IS-3); and
`deps.auth?: AuthDeps` = `{ pepper: Buffer | null, setupTokenHash: string | null, clock: () => number, random: () =>
number, passwords: Hasher }` (defaults from config, `Date.now`, `Math.random`, `password.js`). The log line keeps the
closed key set of LG-1; `actor_kind` is added when a session is present (`user` or `admin`); no other key.

### 4.8 Error codes (`app/server/http/errors.js`)

New entries of `ERROR_STATUS`, and `AUTH_CODES` = the closed list of every code a route of this run answers (the pages
map each to `auth_err_<code>`, 5.3). TX-11 holds this list as a literal and compares it with `AUTH_CODES` (AP-077).

| Code | Status | New |
| --- | --- | --- |
| not_found | 404 | — |
| bad_json, bad_body | 400 | — |
| server_error | 500 | — |
| server_config | 503 | — |
| auth_required, invalid_credentials, totp_required, totp_invalid | 401 | yes |
| origin_refused, csrf_refused, reauth_required | 403 | yes |
| unsupported_type | 415 | yes |
| password_rules, unknown_purpose, reset_invalid | 400 | yes |
| totp_state | 409 | yes |
| locked, reauth_locked, rate_limited | 429 | yes |
| db_unavailable | 503 | yes |

`AUTH_CODES` has these 21 codes. No answer text names a duration (REQ-114, word lists В and Ц).

### 4.9 Auth primitives (`app/server/auth/*.js`; statements in `app/server/db/auth-store.js`)

#### 4.9.1 Keys (`auth/keys.js`)

- `SECRET_PEPPER`: base64url text whose decoded length is at least 32 bytes (4.15).
- `mac(label, text) → 64 hex` = HMAC-SHA256(pepper, label + "\0" + text). Closed labels: `session`, `csrfh`, `csrf`,
  `reauth`, `reset`, `recovery`, `ip`, `rl`, `delay`.
- `totpKey()` = HKDF-SHA256(pepper, empty salt, info «sai totp v1», 32 bytes). Stored secret form:
  `v1.<iv b64url>.<ciphertext b64url>.<tag b64url>`, AES-256-GCM, 12-byte random iv, AAD = the user id (70 characters
  for a 20-byte secret, measured in the run of F11).
- A pepper change invalidates every session, token, code and TOTP secret (incident runbook, 15).

#### 4.9.2 Passwords (`auth/password.js`)

`hash(pw): Promise<string>`, `verify(pw, stored): Promise<boolean>`, `rules(pw): "ok" | "password_rules"`.
scrypt N = 2^15, r = 8, p = 1, `maxmem` 64 MiB (F11: the default throws), 16-byte random salt, 64-byte key; form
`scrypt$15$8$1$<salt b64url>$<key b64url>`; `verify` compares with `timingSafeEqual`; a stored text of another form →
false. `DUMMY_HASH`: a constant of the same form (the hash of a random text made once by the developer; not a secret),
verified for an unknown e-mail so that each login runs exactly one scrypt. The `Hasher` is injected (`deps.auth.passwords`)
so LI-1 counts the computations.

#### 4.9.3 Sessions and cookie (`auth/sessions.js`)

- Cookie name: `__Host-sai_s` when APP_ORIGIN is `https:`; `sai_s` only when APP_ORIGIN is exactly
  `http://127.0.0.1:<port>`; any other origin → no cookie name → step 0 refuses with 503 server_config.
- Set: `<name>=<token>; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax` plus `; Secure` for `__Host-`; no Domain.
  Clear: same attributes with an empty value and `Max-Age=0`.
- Token 32 random bytes base64url (43); row: `token_hash = mac("session", token)`, `csrf_hash = mac("csrfh", csrf)`,
  `last_seen_at = now`, `abs_expires_at = now + 7 d`, `ip_hmac = mac("ip", ip)` or null.
- CSRF token = base64url(HMAC-SHA256(pepper, "csrf\0" + token)) (C5); compared at step 5 with timingSafeEqual.
- Login rotates: a valid session cookie sent with a successful login is deleted in the same transaction.
- Password change: in one transaction verify `current`, set the hash, `delete from auth_sessions where user_id = $1 and
  id <> $2`, audit.

#### 4.9.4 Re-auth (`auth/reauth.js`)

Purposes — one closed table **[R REQ-114 «written as one table in the code design»]**:

| Purpose | Consumed by (M2.2) | Origin |
| --- | --- | --- |
| reset_link | POST /api/admin/users/:id/reset-link | this program |
| totp_enrol | POST /api/admin/totp/enrol | this program |
| totp_off | POST /api/admin/totp/off | this program |
| dev_start, dev_resume, worker_token, settings, kill_switch_off, ai_allow, codes, owner_identity | none yet (their routes come in M2.4–M5) | ARCH §5 |

`POST /api/auth/reauth` accepts any purpose of the table (an ordinary user may get a token; no route of his consumes
one); another text → 400 unknown_purpose before any scrypt. Token 32 bytes base64url, `token_hash = mac("reauth",
token)`, `expires_at = now + 5 min`. Consumption at step 8, one statement:
`update reauth_tokens set used_at = $now where token_hash = $1 and user_id = $2 and auth_session_id = $3 and purpose = $4 and used_at is null and expires_at > $now returning id`;
no row → 403 reauth_required. The returned id goes to the handler as `reauthId` and into the audit details. A handler
throw rolls the consumption back (the action did not happen).

#### 4.9.5 Lockout and the admin delay (`auth/lockout.js`)

- Ordinary account, at login, before scrypt: `locked_until > now` → 429 locked, Retry-After = ceil(seconds left).
  Wrong password: if `failed_since` is null or older than 15 min → `failed_logins = 1, failed_since = now`, else
  `failed_logins + 1`; at 5 → `locked_until = now + 15 min`. Right password → counters reset, `last_login_at = now`.
- Platform admin: never locked (`locked_until` stays null). Delay key `mac("delay", ip or "unknown")` in
  `login_delays`. Before scrypt: `next_at > now` → 429 rate_limited, Retry-After = ceil(seconds left), no scrypt. A
  failure (password or code) → `fails + 1`, `next_at = now + min(2^(fails − 1), 60) s`. A success from that address
  deletes the row.
- Re-auth (and the `current` of POST /api/auth/password): `reauth_locked_until > now` → 429 reauth_locked; failure
  counted in `reauth_failures` / `reauth_failed_since` with the same 5-in-15-minutes rule → `reauth_locked_until = now
  + 15 min`; success resets them. `failed_logins` and `locked_until` are never touched by re-auth.

#### 4.9.6 Setup (`auth/setup.js`)

Exports `setupDigestsEqual(a: Buffer, b: Buffer): boolean` — the one compare: false unless both are 32 bytes, then
`crypto.timingSafeEqual(a, b)`. The route: (pipeline steps 0–9 with `rateLimit` setup) → hash configured and
`^[0-9a-f]{64}$` → token `^[A-Za-z0-9_-]{43}$` → `setupDigestsEqual(sha256(token utf-8), hex-decoded hash)` → each
failure returns the uniform 404 (counted). Then `password_rules` (400, thrown) → `insert into platform_settings (key,
value) values ('setup_done', 'true'::jsonb) on conflict do nothing returning key`; no row → uniform 404 (returned); else
users, orgs, org_members, one audit row; 201. Two parallel calls: the second insert waits for the first commit and finds
the key (Postgres) or runs after it (PGlite) → exactly one 201 (SU-3).

#### 4.9.7 TOTP (`auth/totp.js`)

`hotp(key, counter, digits)`, `totpAt(key, unixSeconds, digits = 6)`, `verifyCode(key, code, unixSeconds, lastStep):
step | null` (accepts steps t−1, t, t+1 with step > lastStep), `base32Encode/Decode` (RFC 4648, no padding). Secret 20
random bytes. The step is claimed atomically: `update users set totp_last_step = $2 where id = $1 and (totp_last_step
is null or totp_last_step < $2) returning id`; no row → totp_invalid (a replay). Recovery codes: 10 × 10 random bytes
→ 16 base32; stored `mac("recovery", code)`; use = `update users set totp_recovery = array_remove(totp_recovery, $2)
where id = $1 and $2 = any(totp_recovery) returning cardinality(totp_recovery)`. Required at login and re-auth only
when `totp_enabled_at` is not null; only the platform admin reaches the enrol routes (meta.admin).

#### 4.9.8 Reset codes

Code 16 random bytes base64url (22 = 128 bits), `code_hash = mac("reset", code)`, `expires_at = now + 30 min`. Use, in
one transaction: password rules first (400 thrown, the code stays unused); then `update password_resets set used_at =
$now where code_hash = $1 and used_at is null and expires_at > $now returning user_id`; no row → 400 reset_invalid
(returned, counted by `reset`); else new hash, `delete from auth_sessions where user_id = $1`, counters cleared, audit.
The link carries the code in the fragment (`#c=`), so it never reaches a server log or a Referer; the page clears the
fragment with `history.replaceState` after reading it.

### 4.10 Rate limits and the client address

| Limit | Key text | Window | Max |
| --- | --- | --- | --- |
| setup | `mac("rl", "setup\0" + ip)` | 1 h | 5 |
| login | `mac("rl", "login\0" + ip)` | 15 min | 10 |
| reset | `mac("rl", "reset\0" + ip)` | 15 min | 10 (C10) |
| user | `mac("rl", "user\0" + session id)` | 10 min | 600 |

`ip` is the normalised address or the text `unknown`. Fixed window: `window_start = floor(now / window) * window`;
`insert … on conflict (key, window_start) do update set count = rate_limits.count + 1 returning count`; count > max →
429 rate_limited, Retry-After = ceil((window_start + window − now) / 1000). Lazy cleanup (1 % of pipeline requests,
injected random): delete `rate_limits` with `window_start < now − 24 h`, `login_delays` with `updated_at < now − 24 h`,
`auth_sessions` with `abs_expires_at < now − 30 d`, `reauth_tokens` and `password_resets` with `expires_at < now − 30 d`.

`client-ip.js`: `normalise(text): string | null` — a text that is not an IPv4 or IPv6 literal by the module's own closed
regular expressions → null (`node:net` and its `isIP` are banned in `server/`, import-boundaries); `::ffff:a.b.c.d` →
`a.b.c.d`; IPv6 lower case. `vercelClientIp(headers)` (in `client-ip.js`, re-exported by `server/app.js`, because `api/index.js` may import
only `server/app.js` and `server/config.js`, import-boundaries line 448) = the normalised `x-forwarded-for` value when it
is exactly one IP literal (after trim), else null (C8); every `app.fetch` call of `app/api/index.js` passes
`{ clientIp: vercelClientIp(request.headers) }`. No other header is read.

### 4.11 Audit writer (`app/server/services/audit.js`; statements in `app/server/db/audit-store.js`)

`appendAudit(q, entry)` where `q` is the query of a **platform** transaction (the caller's request transaction, so the
action and its row commit together). `entry = { orgId | null, actorKind, actorId | null, action, targetKind | null,
targetId | null, ip | null, details }`. Steps: validate (`action` in the closed list; `details` keys ⊆ the closed list
with their types; else `TypeError`, no statement); `select pg_advisory_xact_lock($1)` with `AUDIT_LOCK_KEY = 7300115`;
`select nextval('audit_log_id_seq')`; `select hash from audit_log order by id desc limit 1` (none → 64 zeros);
`created_at = new Date(now).toISOString()` (ms precision, stored and read back unchanged); `hash = sha256(prev_hash +
canonical(row))`; insert with every column given. Grep of REQ-115 c10: `insert into audit_log` stands only in
`app/server/db/audit-store.js`.

`canonical(row)`: JSON with object keys sorted by UTF-16 code units at every level, no whitespace, over the keys `id`
(decimal text), `org_id`, `actor_kind`, `actor_id`, `action`, `target_kind`, `target_id`, `ip_hmac`, `details`,
`prev_hash`, `created_at` (ISO text); null as `null`.

Closed actions: `auth.setup`, `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_change`, `auth.reauth`,
`auth.reauth_failed`, `auth.reset_link_issued`, `auth.reset_used`, `auth.reset_failed`, `auth.totp_enrol`,
`auth.totp_confirm`, `auth.totp_recovery_used`, `auth.totp_off`. Closed details keys: `purpose` (a purpose of 4.9.4),
`reason` (`unknown_email`, `wrong_password`, `locked`, `delay`, `totp_missing`, `totp_wrong`, `disabled`, `expired`),
`method` (`password`, `totp`, `recovery`), `remaining` (integer 0–10), `reauth_id` (uuid), `session_id` (uuid). No
e-mail, name, address or token ever enters a row; the address enters only as `ip_hmac`.

`verifyAudit(q) → { ok, count, badId? }` (withPlatform): reads rows in id order in pages of 1000, recomputes each hash
and checks `prev_hash` equals the previous row's hash (64 zeros first). Ids may have gaps (a rolled-back writer took a
number); order is by id.

### 4.12 Isolation suite and permission matrix (test contracts)

- `isolation.test.js` (IS-*) reads the route table of `createApp` at test time; a route with `tenant: true` and no case
  in its `CASES` table fails; planted pair (IS-3): two test-only tenant routes injected through `deps.routeTable`, one
  reading its object under `withTenant(session.orgId)` and one reading it by id alone under `withPlatform`; the suite
  function is green on the first and red on the second.
- `permission-matrix.golden.json`: an array of `{ "route": "<METHOD path>", "actor": "<actor>", "class": "2xx" | "401" |
  "403" | "404" }`, 15 routes × 6 actors = 90 rows. Canonical request per route (fresh migrated database with setup done,
  each actor signed in except anonymous; admin calls carry a fresh re-auth token of the route's purpose; TOTP routes
  start from the state the route needs; reset uses a fresh code for a throwaway user). Expected classes:

| Route | anonymous | viewer | member | org_admin | org_owner | platform admin |
| --- | --- | --- | --- | --- | --- | --- |
| GET /api/health, GET /api/demo/questionnaire, POST /api/demo/result | 2xx | 2xx | 2xx | 2xx | 2xx | 2xx |
| POST /api/auth/setup (setup done) | 404 | 404 | 404 | 404 | 404 | 404 |
| POST /api/auth/login (own credentials; anonymous: an unknown e-mail) | 401 | 2xx | 2xx | 2xx | 2xx | 2xx |
| POST /api/auth/logout, GET /api/auth/me, POST /api/auth/password, POST /api/auth/reauth | 401 | 2xx | 2xx | 2xx | 2xx | 2xx |
| POST /api/auth/reset (a fresh valid code) | 2xx | 2xx | 2xx | 2xx | 2xx | 2xx |
| the five /api/admin/* rows | 404 | 404 | 404 | 404 | 404 | 2xx |

### 4.13 The mask table of REQ-115 c8 (C12; mirrored literally in `isolation.test.js` as `MASKED`)

| Route | Field | Kind | Shape the test checks before masking |
| --- | --- | --- | --- |
| POST /api/auth/reauth | token | token | `^[A-Za-z0-9_-]{43}$` |
| POST /api/admin/users/:id/reset-link | link | code | APP_ORIGIN + `/reset.html#c=` + `[A-Za-z0-9_-]{22}` |
| POST /api/admin/totp/enrol | secret | code | `^[A-Z2-7]{32}$` |
| POST /api/admin/totp/enrol | otpauth | code | `^otpauth://totp/Sai:[^?]+\?secret=[A-Z2-7]{32}&issuer=Sai&algorithm=SHA1&digits=6&period=30$` |
| POST /api/admin/totp/confirm | recovery_codes[*] | code | `^[A-Z2-7]{16}$`, exactly 10 |

Every other route masks nothing. Kinds `id` and `time` have no row in M2.2 (REQ-117 adds them with their shapes: uuid
and ISO-8601 `Z`).

### 4.14 `docs/security-invariants.md`

One table: `| # | Invariant | Test file | Test name |`, 13 rows: foreign object = missing (isolation.test.js IS-1, IS-3);
RLS forced on every org_id table (rls.test.js RLS-1); no organisation from the request (isolation.test.js IS-4, IS-5);
role selfcheck (selfcheck.test.js SC-7); CSRF and Origin (auth-csrf.test.js CS-1); cookie flags (auth-session.test.js
SS-1); lockout and admin delay (auth-lockout.test.js LO-1, LO-3); append-only audit with chain (rls.test.js RLS-4,
audit-chain.test.js AC-2); no SQL from strings (no-string-sql.test.js SQL-1); no secret or personal data in logs
(logging.test.js LG-2); admin routes 404 to non-admins (route-table.test.js RT-3); one place of database calls
(db-calls.test.js DBC-1); grants least (rls.test.js RLS-5). One row per test name; SI-1 checks each named file exists
and contains `test("<name> ` .

### 4.15 Configuration

`readConfig` adds, **after** every existing check (F22, DBC-5 keeps its codes): `secretPepper: Buffer | null` —
`SECRET_PEPPER` decoded as base64url; present but not `^[A-Za-z0-9_-]+$` or decoded below 32 bytes →
`ConfigError E_CONFIG_PEPPER` «SECRET_PEPPER is not base64url of at least 32 bytes»; missing with `NODE_ENV=production` →
the same code with «SECRET_PEPPER is required when NODE_ENV=production»; `setupTokenHash: string | null` — the raw value
(no start refusal: a malformed value makes setup answer 404, REQ-114 c2). node-main prints `sai: refused: <message>`
and exits 1 (as today); the Vercel entry answers 503 server_config to every /api request (AE-4 path). `migrate.js` reads
the same config, so a production build or container without the pepper stops before any migration (the previous
deployment stays). `.env.example` + `SECRET_PEPPER=`, `SETUP_TOKEN_HASH=`, `SAI_UAT_IDENTITY_FILE=`,
`SAI_VERIFY_A_URL=`, `SAI_VERIFY_B_URL=` (ENV-1). Throwaway peppers for CI and compose are made in the run (6.3),
never written as literals (Q7).

### 4.16 `app/scripts/setup-token.js`

No argument (any argument → exit 2 «setup-token: refused: no argument is taken»). Prints exactly two lines: the token
(32 random bytes base64url, 43) and `sha256(token utf-8)` hex; exit 0; reads no environment, writes no file.

### 4.17 `app/scripts/uat-login.js`

`node scripts/uat-login.js --base <origin> --out <file>`; exported `run({ argv, env, platform, fetch, repoRoot }) →
{ code, out, err }` (the process entry calls it with the real values). Rules, each refusal = exit 1, one line
`uat-login: refused: <reason>` on stderr, no file written:
- `--base` must be an origin (`https:` or `http://127.0.0.1:<port>`); `--out` absolute, outside the repository (repo root
  = the folder above `app/`, compared after `realpath` of the existing parent), not existing;
- `SAI_UAT_IDENTITY_FILE` set, absolute, `lstat` not a symbolic link, a regular file, outside the repository after
  realpath; POSIX (`platform !== "win32"`): `mode & 0o077 === 0`, else refused; **win32: refused** «uat-login: refused:
  file permissions cannot be checked on Windows; run it on Linux or macOS» (О4);
- the file is JSON `{ "email": text, "password": text }` exactly;
- login through `fetch` with `Origin` = base, `Content-Type: application/json`, a 10 s timeout; not 200 or no cookie →
  refused «the login was refused» (no server text echoed);
- writes `{ "cookies": [{ name, value, domain, path: "/", expires, httpOnly: true, secure, sameSite: "Lax" }], "origins": [] }`
  (the session-state form of the browser kit) with flag `wx` and mode 0600; prints only the path.
No `node:child_process`, no Keychain (grep of REQ-114 c11).

---

## 5. Pages (FRONTEND-DEV)

### 5.1 Common

Four pages at the root of `app/public`, the structure of the M1 pages (PP-2: doctype, `lang="ru"`, charset, viewport,
color-scheme, `robots noindex`, one title, the icon; `#test-mode` and `#ai-disclosure` with their ru values, PP-4),
styles only from `css/tokens.css` and `css/site.css` (no new visual pattern; no inline style, no `innerHTML`, no
external address, CSP of 14.1). Texts by `data-t` keys and `el()`/`textContent`. No link to these pages from the five
public pages or gate (REQ-114 c13); the pages link each other only where said. Served files carry none of `REQ-`,
`handoff`, `ORCH`, `decisions`, «Claude Code» (check-public).

`app/public/js/api.js`: `call(method, path, body?, { reauth? })` → `{ ok: true, status, body } | { ok: false, status,
code, retryAfter? }`; sends `Content-Type: application/json`, `x-sai-csrf` (from a cached `GET /api/auth/me`, refreshed
once on `csrf_refused`), `credentials: "same-origin"`; maps `code` to `auth_err_<code>`; network failure → code
`db_unavailable` text.

### 5.2 The pages

| Page | Form and flow |
| --- | --- |
| `setup.html` | fields token, e-mail, name, password, language; POST /api/auth/setup; 201 → «готово» line and a link to `login.html`; 404 → the text of `auth_err_not_found` |
| `login.html` | e-mail, password; on `totp_required` a code field appears; POST /api/auth/login; 200 → GET me, shows the name and a logout button (POST logout); for the admin a link to `admin-totp.html` |
| `reset.html` | reads `#c=` once and clears it; new password twice (equal, checked in the page); POST /api/auth/reset; 200 → link to `login.html` |
| `admin-totp.html` | needs me with `platform_admin` (else the 404 text); password → POST reauth (`totp_enrol`) → POST enrol → shows `secret` and `otpauth` as text (no QR) → code → POST confirm → shows the ten codes once with «сохраните»; switch-off form: password → reauth `totp_off` → code → POST off |

### 5.3 Texts (`app/public/shared/i18n/texts.js`)

New keys, all with ru, kk and en, lower case, ≤ 18 words, «вы» form, none of the forbidden words (lists of
`app/scripts/word-lists.js`; no «минут», «дней», duration or price): page labels with the prefix `auth_` (F names them),
and `auth_err_<code>` for each of the 21 `AUTH_CODES`. The lock and limit texts say «попробуйте позже» without a time.

---

## 6. Backup and the rehearsal (REQ-120)

### 6.1 `app/scripts/db-verify.js`

CLI: `node scripts/db-verify.js` (mode `same`) or `node scripts/db-verify.js --previous-schema`; any other argument (a
URL among them) → exit 2 «db-verify: refused: usage: db-verify.js [--previous-schema]; the addresses come from
SAI_VERIFY_A_URL and SAI_VERIFY_B_URL». Missing variable → exit 2 «db-verify: refused: SAI_VERIFY_A_URL is not set»
(the name, never a value). Connection through `connectPgSession` of `server/db/pg.js` (its `DbError` messages carry no
address) → a failure is exit 2 «db-verify: refused: <A|B> does not answer», no stack. Each session first runs the
constant `set time zone 'UTC'`, `set datestyle = 'ISO, YMD'`, `set intervalstyle = 'iso_8601'`, `set extra_float_digits
= 3`, `set bytea_output = 'hex'`, and checks that its role can read every row (`select bool_or(rolsuper or rolbypassrls)
from pg_roles where pg_has_role(current_user, oid, 'MEMBER')`; false → exit 2 «db-verify: refused: the role of <A|B>
cannot read every row (it needs SUPERUSER or BYPASSRLS)»: forced RLS would hide rows and give a false «equal»).

Exports: `readSnapshot(q, { columnsOf?: Map<table, column[]> }) → Snapshot`, `compare(a: Snapshot, b: Snapshot, { mode:
"same" | "previous-schema" }) → { lines: string[], code: 0 | 1 }` (pure), `CONTENT_TABLES = ["audit_log", "users",
"orgs", "org_members", "platform_settings", "artifact_files"]` (a name is used when the table exists).

`Snapshot = { migrations: [{ name, sha256 }], tables: Map<name, { columns: [{ name, type, nullable, hasDefault }], pk:
[column], count, pkSha, contentSha | null }> }`. Reads (constant texts, every name a parameter, C11):
`information_schema.tables` (public, BASE TABLE), `information_schema.columns` (`udt_name` as type), the primary key
from `pg_index`; rows by `select query_to_xml(format('select %s from public.%I order by %s', <quote_ident list of $2>,
$1::text, <quote_ident list of $3>), true, true, '')` — `$1` table, `$2` columns, `$3` pk columns (all columns when there
is no pk); `count` = number of `<row>` elements of the pk read; `pkSha` = sha256 of the pk XML; `contentSha` = sha256 of
the content XML over `columnsOf(table)` (default: its own columns).

Rules: mode `same` — equal table sets; per table equal count and pkSha; `contentSha` equal for CONTENT_TABLES;
`schema_migrations` names and sha256 equal. Mode `previous-schema` — `schema_migrations` of A is a prefix of B's and B
has exactly one row more; for **every other table of A** (C13): it exists in B; each column of A exists in B with the
same type; a column only B has is allowed when nullable or with a default; count, pkSha and contentSha (over A's columns,
the reader is given A's column list) equal; tables only B has are not compared.

Output: one line per table, sorted by name, `db-verify: <table>: ok` or `db-verify: <table>: differs: <kind>`; kinds
(closed): `missing in A`, `missing in B`, `row count`, `primary keys`, `content`, `column dropped`, `column retyped`,
`column added without a default`; for schema_migrations: `names`, `sha256`, `not one row more`; then `db-verify: equal`
(exit 0) or `db-verify: different` (exit 1). No line holds a value or an address.

### 6.2 Seeds `app/test/fixtures/rehearsal/<migration name>.sql`

One per migration file, same name. Plain `insert` statements with fixed test values; e-mails `…@example.test`; no key
shape of ARCH §14.4; a seed fills **only** the tables its migration creates (so the previous-schema counts of A's tables
hold), and every one of them with at least one row. `0001_init.sql`: one `platform_settings` row (`test_mode`, `true`).
`0002_identity.sql`: 2 users (an owner identity and a customer), 2 orgs, 2 memberships, 1 session, 1 re-auth token,
1 reset code, 1 invite, 1 rate-limit row, 1 delay row, 2 audit rows whose hashes follow 4.11 (literals the developer
computes once with the writer's canonical form). Hash-like columns hold 64-hex test values.

### 6.3 CI job `migration-rehearsal` (`.github/workflows/app.yml`)

Placed after `docker` and before `e2e` (e2e stays the last job, F21): `JOBS` becomes `check, pg, docker,
migration-rehearsal, e2e`. `runs-on: ubuntu-24.04`, `timeout-minutes: 20`, the pinned checkout and setup-node 22.23.4,
`node -v`, `npm ci` in app. Steps in this order (each a separate step; no `||`, `set +e`, `continue-on-error`, no line
starting `! `):

| # | Step kind | Content |
| --- | --- | --- |
| 1 | passwords | `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `SECRET_PEPPER` from `openssl rand -hex 32`, each `::add-mask::` then into `$GITHUB_ENV` |
| 2 | postgres | `docker run -d --name sai-reh -e POSTGRES_PASSWORD -p 127.0.0.1:5433:5432 postgres:17@sha256:<the pinned digest>` and the `pg_isready` loop |
| 3 | databases | `createdb a`, `createdb b` through `docker exec` |
| 4 | previous set | the migration files without the newest (name order) copied into `$RUNNER_TEMP/prev` |
| 5 | migrate A | `node server/db/migrate.js` with `MIGRATIONS_DIR=$RUNNER_TEMP/prev`, `DATABASE_URL` of a (superuser) |
| 6 | seed A | `psql -v ON_ERROR_STOP=1 -f` of the seed of each file of the previous set, in order |
| 7 | openssl | `docker exec sai-reh openssl version` (the runbook's encryption tool is in the pinned image) |
| 8 | pg_dump | `pg_dump --format=custom --no-owner --no-acl` of a into `/tmp/a.dump` in the container |
| 9 | pg_restore | `pg_restore --no-owner --no-acl -d b /tmp/a.dump` |
| 10 | db-verify same | `node scripts/db-verify.js` with `SAI_VERIFY_A_URL`, `SAI_VERIFY_B_URL` |
| 11 | migrate B | `node server/db/migrate.js` with `DATABASE_URL` of b and `APP_DB_PASSWORD` (applies the newest file, the grants step, the password step) |
| 12 | seed B | `psql -v ON_ERROR_STOP=1 -f` of the newest file's seed |
| 13 | db-verify previous | `node scripts/db-verify.js --previous-schema` |
| 14 | every table filled | `psql -v ON_ERROR_STOP=1 -c` of one constant `do` block that raises when a public table of b has no row |
| 15 | start app on B | `node server/node-main.js` in the background with `NODE_ENV=production`, `PORT=18080`, `HOST=127.0.0.1`, `DATABASE_URL` of b, `APP_DB_PASSWORD`, `SECRET_PEPPER`, `APP_ORIGIN=http://127.0.0.1:18080`, `PREVIEW_ORIGIN=http://localhost:18080`; its pid written to a file |
| 16 | selfcheck | wait for `/api/health` 200 and `"role":"ok"` (the selfcheck passed; an unsafe role exits node-main) |
| 17 | smoke | `node scripts/smoke.js --base http://127.0.0.1:18080 --preview http://localhost:18080` |
| 18 | stop and remove | `kill "$(cat <pid file>)"`; `docker exec sai-reh rm /tmp/a.dump`; `docker rm -f sai-reh` (`if: always()`) |

The docker job's passwords line becomes `for name in POSTGRES_PASSWORD APP_DB_PASSWORD SECRET_PEPPER; do` with
`openssl rand -hex 32`, and `app/compose.yaml` web gets `SECRET_PEPPER: ${SECRET_PEPPER:?required}` (the container runs
with `NODE_ENV=production`, 4.15). The trial of REQ-120 c3 (TEST-RUNNER): a branch `ci/m2auth-rehearsal-trial` from
the snapshot with `app/db/migrations/0003_trial_drop.sql` (`alter table users drop column display_name`) and its seed
(one comment line); expected: the job red at step 13 with `db-verify: users: differs: column dropped`; recorded with
the run id; the branch is deleted by ORCH under decisions/0130.

### 6.4 Runbook `docs/runbooks/backup-restore.md` (English, the owner's steps)

Headings exactly: «Before a deploy that carries a migration», «Restore point in Neon», «Logical dump», «Restore and
verify», «Delete the copy», «Rehearsal in CI». Content: (1) before such a deploy: the restore point, then the deploy,
then health; (2) Neon, read 2026-11-23 on https://neon.com/docs/introduction/plans and
https://neon.com/docs/introduction/branch-restore (F17): Free history window 6 hours, up to 1 GB of changes; one manual
snapshot on Free; restore by Console → the branch → Postgres database → Backup & Restore → Restore from history, root
branches only, current data overwritten, a backup branch kept; the owner notes the UTC time just before the deploy and,
where the console offers it, takes the manual snapshot; the pricing page conflict is named and the console decides; (3)
logical dump with the pinned `postgres:17@sha256:…` client in Docker, the flags of the job (`--format=custom --no-owner
--no-acl`), the address only in an environment variable, encrypted with `openssl enc -aes-256-cbc -pbkdf2 -iter 600000`
inside the same image, kept outside the repository; (4) restore into a fresh database, `node server/db/migrate.js`
(the grants, О1), `node scripts/db-verify.js` with the two variables; (5) delete the dump and its decrypted copy; (6)
what the CI job proves and where its log is; rollback of the code: `docs/runbooks/release.md` section «2. Rollback» (the
database stays, ARCH §19.5). No `postgres://`, no key shape, no computer path, no Vercel command (so RB's Vercel rule
need not read it). `app/README.md` gets one line naming the runbook beside release.md and incident.md.

---

## 7. Failure paths — what the user sees, what stays unchanged

| Path | Answer | Unchanged |
| --- | --- | --- |
| Database refuses or is silent | 503 db_unavailable within 4.5 s, no cookie; page text `auth_err_db_unavailable`; process keeps serving | every row (transaction never committed) |
| Unsafe role at start | node-main exits 1 with the one line; on Vercel health 503 role unsafe, auth 503 | — |
| Pepper missing in production | node-main and migrate refuse with one line; Vercel /api 503 server_config (also the demo) | database untouched |
| Foreign Origin, wrong type, bad CSRF, missing re-auth, bad body, unknown purpose | 403 / 415 / 403 / 403 / 400 / 400 | every row, the rate counters included (thrown → rollback) |
| Wrong password, unknown e-mail | 401 invalid_credentials, byte-equal | sessions; only counters and one audit row change |
| Locked, delay, limit | 429 + Retry-After, no duration in the text | no session; a delay/lock check runs no scrypt |
| Setup refused | uniform 404 | users, orgs, org_members, platform_settings, audit_log |
| Re-auth token used, expired, foreign | 403 reauth_required | the guarded action did not happen |
| Reset code bad | 400 reset_invalid; 400 password_rules leaves the code usable | password_hash, sessions |
| A handler throws | 500 server_error | the whole request transaction |
| Audit details with a foreign key | the writer throws before any statement → 500, the action rolls back | audit_log, the action's rows |
| db-verify: argument URL, missing variable, unreachable, RLS-blind role | exit 2, one line | both databases (read only) |
| uat-login refusals | exit 1, one line, no file | the secret file, the out folder |
| Migration or grants step fails | migrate exit 1, rolled back; the Vercel build fails and the previous deployment stays | schema |

---

## 8. Protection in the same operation

Every check and the action it guards run in one transaction (C3): the re-auth token is consumed by the same `update`
that checks it and in the transaction of the action; the setup guard is the `insert … on conflict do nothing` of
`setup_done` in the same transaction as the admin; the reset code is consumed by one `update … returning`; the TOTP step
and a recovery code are claimed by one conditional `update`; a rate window is incremented and compared by one upsert;
the audit row is chained under the advisory lock of the same transaction. No «check now, act later».

---

## 9. Criterion → test (every criterion of the three blocks; every test has a criterion)

### 9.1 REQ-114

| c | Design element | Test (file → names) |
| --- | --- | --- |
| 1 | 4.9.2, DUMMY_HASH, injected hasher | unit/auth-password.test.js PW-1 form and decoded lengths, PW-2 first/last char, PW-3 lengths 9/10/128/129; int/auth-login.test.js LI-1 byte-equal answers and one scrypt each, LI-2 no cookie, no auth_sessions row |
| 2 | 4.9.6, 4.10 setup, 4.16 | int/auth-setup.test.js SU-1 rows, SU-2 the four 404 cases byte-equal with counts, SU-3 parallel, SU-4 sixth → 429; unit/setup-compare.test.js SCMP-1 (source holds `timingSafeEqual`, first/last byte, equal); unit/setup-token.test.js STK-1 |
| 3 | 4.9.3, 4.7 steps 1, 11 | int/auth-session.test.js SS-1 https flags, SS-2 http cookie, SS-3 dump search (text and bytea, raw, base64url, hex), SS-4 idle ±1 s, SS-5 absolute, SS-6 rotation, SS-7 logout, SS-8 password change and wrong current, SS-9 me body |
| 4 | 4.7 steps 3–5, meta.session | int/auth-csrf.test.js CS-1 every non-GET session route (printed count > 0) with row counts and sha256, CS-2 the session-false non-GET routes are demo/result or /api/worker/*, CS-3 demo/result without Origin answers as before, CS-4 GET routes change only the three allowed tables |
| 5 | 4.9.5, 4.10 login | int/auth-lockout.test.js LO-1 ordinary lock + 429 locked, LO-2 4/16 min/4, LO-3 admin 20 failures, second address, delay and no scrypt, LO-4 eleventh login → 429, LO-5 re-auth lock separate and users counters unchanged |
| 6 | 4.9.4, 4.7 step 8 | int/auth-reauth.test.js RA-1 one use, RA-2 second use / +5 min 1 s / other session / other user / other purpose with counts, RA-3 unknown purpose, RA-4 hash only, RA-5 every `reauth` route without token |
| 7 | 4.9.7 | unit/totp.test.js TO-1 RFC 6238 vectors; int/auth-totp.test.js TT-1 admin only + token, TT-2 dump search, TT-3 password only until confirmed, TT-4 codes −1/0/+1 and replay, TT-5 wrong codes delay and no lock, TT-6 recovery codes, TT-7 switch-off needs token and code, TT-8 audit rows |
| 8 | 4.9.8 | int/auth-reset.test.js RS-1 issue and use, RS-2 second use / +30 min 1 s / 9 characters unchanged, RS-3 404 for ordinary and anonymous, RS-4 audit rows |
| 9 | 4.10, client-ip.js, api/index.js | int/rate-limit.test.js RL-1 planted address in no column and no log line, RL-2 X-Forwarded-For ignored on the Node server, RL-3 the Vercel entry reads only `x-forwarded-for` (a planted `x-real-ip` changes nothing), RL-4 each limit's first refusal 429 + Retry-After, RL-5 cleanup |
| 10 | 4.5.2, 4.7 DbError mapping | int/auth-db-down.test.js ADD-1 refused and silent adapters, four routes, 503 within 5 s, no cookie, recovery |
| 11 | 4.17 | int/uat-login.test.js UL-1 works, UL-2 each refusal, UL-3 modes 0640/0604/0600 (POSIX) and the win32 branch through `run({ platform: "win32" })`, UL-4 grep and the planted child_process |
| 12 | 4.7 log line, 4.11 no clear values | int/logging.test.js LG-2 (LG-1 unchanged) |
| 13 | 5, 4.8 | unit/texts.test.js TX-11 (literal of 4.8 = `AUTH_CODES`, each `auth_err_<code>` with ru, kk, en); texts.test.js and forbidden-words.test.js existing; the two commands of c13 |
| 14 | 11, 12 | the guard rows (section 11); GitHub run (gh run list / view); traces and handoffs-check; the SECURITY-REVIEWER step answering ASVS V2 and V3 by the list of 9.4 |

### 9.2 REQ-115

| c | Design element | Test |
| --- | --- | --- |
| 1 | 4.2.3 | pg/rls.test.js RLS-1 completeness with printed count ≥ 3, planted table reported by name, no owned table |
| 2 | 4.2.3, 4.5.3 | pg/rls.test.js RLS-2 three organisations, every tenant table, 0 rows without app.org_id, refused INSERT/UPDATE with counts; RLS-3 20 parallel over a pool of 4 |
| 3 | 4.2.2 trigger, 4.2.3 policies | pg/rls.test.js RLS-4 |
| 4 | 4.5.3, 4.5.4 | int/tx.test.js TXH-1 non-uuid throws with 0 statements, TXH-2 settings inside, TXH-3 after the transaction the login role and an empty app.org_id, and a plain `db.query("select current_user")` sent while a withTenant callback waits answers the login role (F9), TXH-4 rollback; unit/db-calls.test.js DBC-1 real tree, DBC-2 planted service and route copies |
| 5 | 4.6 | int/selfcheck.test.js SC-7 (owner and member-of-owner cases: exit 1 with the line, health 503), pg/selfcheck-pg.test.js SP-2; SC-7 red on the base |
| 6 | 4.4 | unit/route-table.test.js RT-1 keys and types, RT-2 planted lack/extra key, RT-3 planted admin route 404 byte-equal for an ordinary user and an anonymous caller, each with and without `Origin`, RT-4 planted reauth route 403, RT-5 session values |
| 7 | 4.12 | int/isolation.test.js IS-1 object-id routes (count printed, 0 in this run), IS-2 list/create routes, IS-3 planted pair green/red |
| 8 | C1, 4.13 | int/isolation.test.js IS-4 `org_id`/`orgId` keys → 400 unchanged, IS-5 query and header ignored with MASKED and its shape checks |
| 9 | 4.12 golden | int/permission-matrix.test.js PM-1 classes equal the golden file, PM-2 a route or actor without rows fails; the four greps |
| 10 | 4.11 | pg/audit-chain.test.js AC-1 20 parallel, verify ok with count, recomputed hashes, AC-2 tamper → ok false with id, AC-3 foreign details key → no row, AC-4 404 for ordinary and anonymous; the grep of c10 |
| 11 | 4.14 | unit/security-invariants.test.js SI-1 |
| 12 | 11, 12 | as REQ-114 c14, plus the pg log lines of rls.test.js and audit-chain.test.js |

Also from 4.2.3: pg/rls.test.js RLS-5 (grants equal 4.2.3) — it proves REQ-115's «grants are the least each route
needs» and the invariant row; it belongs to c2 (the refusals are RLS ones, not missing grants).

### 9.3 REQ-120

| c | Design element | Test |
| --- | --- | --- |
| 1 | 6.1 | unit/db-verify.test.js DV-1 equal snapshots, DV-2 the six planted differences, DV-3 URL argument / missing variable / unreachable (a closed port of a server bound on port 0 and closed) → exit 2 one line no stack, DV-4 additive migration → 0, DV-5 the eight previous-schema differences; pg/db-verify-pg.test.js DVP-1 equal and one UPDATE, DVP-2 nullable column added → 0, seeded column dropped → 1 |
| 2 | 6.2 | unit/rehearsal-seeds.test.js SEED-1 names equal, `@example.test`, no key shape (red on the base: no folder) |
| 3 | 6.3 | unit/ci-workflow.test.js CIW-1 (real file keeps the rehearsal rules), CIW-2 cases (no pg_dump, unpinned image, unmasked password, db-verify removed → red); the GitHub log of the job; the trial branch run |
| 4 | 6.4 | unit/runbooks.test.js RB-3 headings, flags equal app.yml, Neon date and https address, no forbidden line; traces |
| 5 | build order | the `git merge-base --is-ancestor` command; the job green on the ci snapshot and the first main commit with 0002 |
| 6 | 11, 12 | guard rows; GitHub run; traces; SECURITY-REVIEWER |

Plus, from О1: int/migrate.test.js MG-6 (the grants step: a database whose grants were revoked gets them back by one
migrate run; a failing grants file → exit 1 and nothing changed) — it serves REQ-120 c3 (B serves the smoke).

### 9.4 ASVS 4.0.3 rows for SECURITY-REVIEWER (REQ-114 c14)

V2: 2.1.1/2.1.2 (lengths 10–128), 2.1.7 not applicable (no breach list in V1, named), 2.2.1 (lock and delay), 2.2.3 not
applicable (no e-mail), 2.4.1/2.4.4 (scrypt parameters), 2.5.1–2.5.4 (reset link: one-time, 30 min, admin-issued),
2.7/2.8 (TOTP: RFC 6238, replay, ±1 step, secret encrypted), 2.8.4 (used code refused), 2.10 (no secret in source).
V3: 3.2.1–3.2.3 (32 random bytes, rotated at login, HMAC at rest), 3.3.1–3.3.2 (logout, idle 12 h, absolute 7 d),
3.3.3 (password change ends other sessions), 3.4.1–3.4.5 (`__Host-`, Secure, HttpOnly, SameSite=Lax, Path=/), 3.5.3
(CSRF token and Origin), 3.7.1 (re-auth before dangerous actions).

---

## 10. Quality bar (Q1 – Q14, R1 – R3)

| Item | Applicable | How |
| --- | --- | --- |
| Q1 | yes | three REQ ids; every criterion names its test (section 9) |
| Q2 | yes | the gate 1b repeats facts F1–F22 on a fresh clone of the tag; SECURITY-REVIEWER and REVIEWER read the code |
| Q3 | yes | every fact has its command and output (section 1); unverified ones are named as such |
| Q4 | yes | the one check `cd app && npm run check` unchanged; app.yml adds the rehearsal job; the run is on GitHub (0110) |
| Q5 | yes | every refusal test checks counts or sha256 of rows (9; mutants 13) |
| Q6 | yes | no skip or todo (NPM-6); the guard edits only widen lists or follow new files (11); no rule removed |
| Q7 | yes | pepper and setup hash only from the environment; secrets in the database only as HMAC or AES-GCM; peppers of CI made in the run; tests LG-2, SS-3, RA-4, TT-2, RL-1; db-verify prints no value or URL; the runbook keeps the address in a variable |
| Q8 | yes | organisation from the membership row; RLS forced; isolation suite, mask table with shapes, permission matrix; uniform 404 for admin routes and setup |
| Q9 | yes | every statement a constant text with parameters; SQL-1 for app/server; SQL-3 added for `app/scripts/db-verify.js` (11 row R4); db-verify names are bound parameters (C11) |
| Q10 | yes | 503 db_unavailable within 4.5 s; transaction deadline; the pg client dropped on error; ADD-1 |
| Q11 | not applicable | the server calls no address a user sets; `uat-login.js --base` is the owner's own CLI and allows only https or 127.0.0.1 |
| Q12 | yes | C1–C14; О1–О14 with proposals for the record of step 1a |
| Q13 | yes | the two traps found here go to DOC-UPDATER as proposed anti-patterns (15): the manual begin on PGlite (F9) and `--no-acl` without a grants step |
| Q14 | yes | the handoff result now; status lines by DOC-UPDATER at step 10 |
| R1 | yes | push to main after green checks (0134 item 2); the deploy, the pepper and the setup hash are the owner's |
| R2 | not applicable | no Pixel Office event is written |
| R3 | not applicable | decisions/0033 |

---

## 11. Replacement table of earlier guard tests (grep F18; the prohibition is never weakened)

| # | File, line | Was → became | What it counts |
| --- | --- | --- | --- |
| A1 | app/test/unit/npmrc.test.js:34 INT_FILES | 12 names → the 12 + auth-login, auth-setup, auth-session, auth-csrf, auth-lockout, auth-reauth, auth-totp, auth-reset, rate-limit, auth-db-down, uat-login, tx, isolation, permission-matrix (26) | a literal list |
| A2 | npmrc.test.js:48 PG_FILES | 2 → + rls, audit-chain, db-verify-pg (5) | literal |
| A3 | npmrc.test.js:406 NPM-5 title «holds its 12 named test files and app/test/pg its 2» | → «its 26 … its 5» (the name follows the list; the rule is the same) | — |
| A4 | npmrc.test.js:51-55 E2E_FILES, E2E_TESTS | unchanged (no e2e file in this run) | — |
| A5 | npmrc.test.js ENV-1 | unchanged; `.env.example` gains the five names of 4.15 | a directory scan |
| A6 | app/test/unit/public-build.test.js:800-808 PB-6 | the five names → the five + admin-totp.html, login.html, reset.html, setup.html (sorted, gate still filtered); each new page: no region, `regionFindings` empty | a directory scan asserted as a list |
| A7 | public-build.test.js:29-30 CHANGED, PAGES | unchanged: the new pages have no region, so the open build does not change them; texts.js is already listed | literal |
| A8 | app/test/unit/public-pages.test.js:28 PAGES and PP-1 | the six → the six + the four (sorted); PP-2–PP-4 apply to them (4 pages carry #test-mode and #ai-disclosure) | a directory scan asserted as a list |
| A9 | app/test/unit/forbidden-words.test.js page lists | the six → + the four; M1 cases unchanged | literal |
| A10 | app/test/unit/vercel-config.test.js VC-1 | unchanged (C2) | — |
| A11 | app/test/unit/docker-files.test.js DF-1 | unchanged rules; compose gains `SECRET_PEPPER: ${SECRET_PEPPER:?required}` (passes «a password literal» and «web») | — |
| A12 | app/test/unit/ci-workflow.test.js:32 JOBS | `["check","pg","docker","e2e"]` → `["check","pg","docker","migration-rehearsal","e2e"]`; e2e stays last; new `REHEARSAL_STEPS` rule (the 18 kinds of 6.3 in order) and its damaged copies (REQ-120 c3) | literal |
| A13 | ci-workflow.test.js:77-78 «docker 0001 row» | `= "0001_init.sql"` → the newline-joined names of every file of app/db/migrations in order (read at test time); the workflow line `… -Atc 'select name from schema_migrations order by name')" = "$(ls app/db/migrations \| sort \| tr …)"` is fixed by the developer and the test's expected line follows it | read at test time |
| A14 | app/test/pg/migrate-pg.test.js:104-110 MP-1 «no org_id» | `count = 0` → every table with org_id has relrowsecurity and relforcerowsecurity and a policy for sai_app (the RLS-1 rule); «no table owned» stays; title «no org_id» → «RLS on every org_id table» | information_schema |
| A15 | migrate-pg.test.js:172-174 MP-2 | `[{ name: "0001_init.sql" }]` → the names of every migration file in name order | read at test time |
| A16 | app/test/int/migrate.test.js:47-70 MG-1 | `[["0001_init.sql", sha]]` → every file with its sha256 in order; table list → the 12 tables of 0001 + 0002 (sorted); the column list keeps the 0001 columns of the two 0001 tables (filtered to them) | read at test time + literal |
| A17 | migrate.test.js MG-2 planted `0002_bad.sql` | → `9999_bad.sql` (the only pending one stays the planted one) | — |
| A18 | app/test/int/health.test.js:71, 155 `0002_more.sql` | → `9999_more.sql` (REQ-115 row 4) | — |
| A19 | int/selfcheck.test.js, pg/selfcheck-pg.test.js | every case keeps input and answer (F4, F8); SC-7 and SP-2 added | — |
| A20 | app/test/unit/no-string-sql.test.js | SQL-1/SQL-2 unchanged; SQL-3 added: the same finder over `app/scripts/db-verify.js` (REQ-120 row 4) | — |
| A21 | import-boundaries.test.js | unchanged (scripts outside it, F20; server imports only `node:crypto` and existing packages; `node:net` not used, 4.10) | — |
| A22 | app/test/unit/runbooks.test.js RB-1 | unchanged; RB-3 added (the new runbook names no Vercel command) | — |
| A23 | app/test/int/logging.test.js LG-1 | unchanged; LG-2 added | — |
| A24 | app/test/e2e/landing.test.js DEMO_ROUTES; demo.test.js; demo-parity.test.js; stage.test.js | unchanged (CS-3 proves the demo answers as before) | — |
| A25 | app/test/int/api-entry.test.js AE-1–AE-5 | unchanged (the entry adds an env argument; the paths and answers stay) | — |
| A26 | tools/test | none (F18) | — |

---

## 12. Build sub-steps (small; each with the existing tests that turn red, by reading their assertions)

| # | Owner | Sub-step | Existing tests red until T fixes them (step 5) |
| --- | --- | --- | --- |
| B1 | B | errors.js codes, `AUTH_CODES`; route row meta with six keys (all false/null for demo and health); RouteRequest/Answer; `deps.routeTable`; `clientIp` wiring; api/index.js env | none |
| B2 | B | adapter `transaction` (pg, PGlite), `Db.transaction` with deadline, tx.js helpers, health-read.js move | none |
| B3 | B | selfcheck folded statement | none (F8; SC-* unchanged answers) |
| B4 | B | `0002_identity.sql`, `grants.sql`, the grants step in migrate.js | MG-1 (A16), MP-1 (A14), MP-2 (A15), docker 0001 row (A13; red on GitHub only) |
| B5 | B | config pepper and setup hash; `.env.example`; compose and the docker job's passwords line | none (DBC-5 order kept, F22; ENV-1 green with the names) |
| B6 | B | keys.js, password.js, totp.js (pure) | none |
| B7 | B | auth-store.js, audit-store.js, services/audit.js | none |
| B8 | B | csrf.js, rate-limit.js, client-ip.js, auth-mw.js pipeline | none |
| B9 | B | routes/auth.js (setup, login, logout, me, password, reauth, reset) | none |
| B10 | B | routes/admin.js (reset-link, TOTP, verify) | none |
| B11 | B | setup-token.js, uat-login.js | none |
| B12 | B | db-verify.js, seeds | none |
| B13 | B | app.yml job `migration-rehearsal` | CIW-1, CIW-2 (A12) |
| B14 | B | runbook, security-invariants.md, README line | none |
| F1 | F | texts.js keys | none (TX-1–TX-10 rules hold for new keys) |
| F2 | F | api.js and the four pages with their scripts | PB-6 (A6), PP-1 (A8), forbidden-words lists (A9) |
| T1 | T | guard edits A1–A20 | — |
| T2 | T | unit tests of section 9 | — |
| T3 | T | int tests | — |
| T4 | T | pg tests, golden file | — |

On this PC nothing runs (0110, 0129): each sub-step's evidence is the GitHub run of the snapshot; the developers name
the tests they expect red in their handoffs, by this table.

---

## 13. Mutants (one per trap; ≥ 1 per criterion; 46)

| # | Breakage | Caught by |
| --- | --- | --- |
| M1 | salt 8 bytes | PW-1 |
| M2 | compare only the first 32 bytes of the key | PW-2 (last char) |
| M3 | length rule `< 10` written `<= 10` | PW-3 |
| M4 | unknown e-mail skips scrypt | LI-1 (count 0) |
| M5 | unknown e-mail answers `{"error":"unknown_email"}` | LI-1 |
| M6 | setup compares hex texts with `===` | SCMP-1 (source and first/last byte cases) |
| M7 | setup without `on conflict do nothing` guard (checks `setup_done` by a select first) | SU-3 (two 2xx) |
| M8 | setup answers 403 when the hash is unset | SU-2 |
| M9 | setup-token prints the hash first | STK-1 |
| M10 | cookie without `Secure` on https | SS-1 |
| M11 | token stored in clear in `token_hash` | SS-3 |
| M12 | idle limit 12 h checked with `>=` on last_seen + 12 h + 1 s | SS-4 |
| M13 | login does not delete the old session | SS-6 |
| M14 | password change deletes every session including the current | SS-8 |
| M15 | `me` returns `password_hash` | SS-9 |
| M16 | Origin check only when the header is present | CS-1 (missing Origin) |
| M17 | CSRF compared with the session id instead of the CSRF token | CS-1 (another session's token) |
| M18 | demo/result marked `session: true` | CS-3, RT-5 |
| M19 | rate-limit increment before the CSRF check committed | CS-1 (counts) |
| M20 | lock after 6 failures | LO-1 |
| M21 | failure window not reset after 15 min | LO-2 |
| M22 | the admin gets `locked_until` | LO-3 |
| M23 | delay check after scrypt | LO-3 (scrypt count) |
| M24 | re-auth failures increment `failed_logins` | LO-5 |
| M25 | re-auth token not bound to the session | RA-2 (other session) |
| M26 | consumption without `used_at is null` | RA-2 (second use) |
| M27 | unknown purpose accepted | RA-3 |
| M28 | TOTP window ±2 steps | TT-4 |
| M29 | no `totp_last_step` claim (replay accepted) | TT-4 |
| M30 | TOTP required before confirmation | TT-3 |
| M31 | recovery code not removed after use | TT-6 |
| M32 | reset code valid 31 minutes | RS-2 |
| M33 | reset keeps the target's sessions | RS-1 |
| M34 | IP stored in clear in `ip_hmac` | RL-1 |
| M35 | Node server reads `X-Forwarded-For` | RL-2 |
| M36 | Vercel entry reads `x-real-ip` | RL-3 |
| M37 | no transaction deadline (a silent statement waits) | ADD-1 |
| M38 | uat-login accepts mode 0640 | UL-3 |
| M39 | the log line carries `email` | LG-2 |
| M40 | an `auth_err_` key without kk | TX-11, TX-2 |
| M41 | `org_members` without `force row level security` | RLS-1 |
| M42 | policy without WITH CHECK | RLS-2 (refused UPDATE) |
| M43 | `withTenant` with `exec("begin")` on PGlite (C7) | RLS-3 runs on pg; TXH-3 on PGlite (a parallel plain query sees the open transaction's role — the case sends one) |
| M44 | selfcheck old statement (no ownership) | SC-7, SP-2 |
| M45 | a service file calls `q.query` directly; route meta with a seventh key; admin check after Origin | DBC-2; RT-2; RT-3 (no Origin → 403 instead of 404) |
| M46 | isolation: handler reads by id alone; `orgId` accepted in a body; a golden row missing; audit lock removed; details key `email` accepted; an invariant row naming a missing test; db-verify ignores `content` of audit_log; previous-schema accepts a dropped column; a seed missing; job without pg_dump; runbook flags differ; db-verify committed after 0002 | IS-3; IS-4; PM-2; AC-1 (20 parallel: duplicate prev_hash); AC-3; SI-1; DV-2; DV-5; SEED-1; CIW-2; RB-3; the c5 command |

M46 groups twelve breakages of the same kind «a guard of one criterion removed»; each has its own test named beside it.
The gate applies at least 10 of M1–M46 on a fresh clone (WF-02 1b).

---

## 14. Post-deploy record (not criteria; for RELEASE-FINALIZER and RELEASE-VALIDATOR)

Before the deploy: the owner sets `SECRET_PEPPER` (without it every /api answer of production is 503, the demo
included) and `SETUP_TOKEN_HASH` in Vercel, and makes the Neon restore point by the runbook. After it: `/setup.html`
once, then he removes `SETUP_TOKEN_HASH` and redeploys. RELEASE-VALIDATOR reads the `__Host-sai_s` flags, the 404 of a
second setup, the headers of the four pages, `GET /api/admin/audit/verify`, and probes C8: eleven logins with an unknown
e-mail, each with another `X-Forwarded-For`, end with 429 on the eleventh (the platform overwrote the header).

---

## 15. What becomes outdated outside the project (DOC-UPDATER)

- ARCH §4 table list: + `password_resets`, `login_delays`; users columns (totp_*, failed_since, reauth_*); org_members
  roles four (already a Plan amendment, 0127 И); ARCH §3 «zod» (C1); ARCH §2 file names (`auth/totp.js`, `auth/keys.js`,
  `http/schema.js`, `http/client-ip.js`, `db/auth-store.js`, `db/audit-store.js`, `db/health-read.js`, `db/grants.sql`);
  ARCH §13 meta keys (+ `session`); ARCH §20.4 db-verify CLI (env variables, decisions/0136 О13): rows of «Plan amendments».
- `docs/runbooks/incident.md`: a pepper rotation ends every session, token and TOTP secret (a later edit, named).
- `app/README.md`: the runbook line (in this run, B14).
- Proposed anti-patterns (Q13): «a transaction opened by `exec("begin")` on a shared single-connection database lets
  another request's statement run inside it» (F9); «a logical dump without ACLs restores a database the app role cannot
  read; the grants must be re-applied by the migration runner».
- STATE.md counts and the status lines of REQ-114, REQ-115, REQ-120 at step 10.

---

## 16. Questions for ORCH (answers in a record `decisions/NNNN-m2auth-code-design-conventions.md` at step 1a)

| # | Question | Recommendation |
| --- | --- | --- |
| О1 | `pg_dump --no-acl` restores no GRANT: B could not serve the smoke of REQ-120 c3. Take the grants step (`app/db/grants.sql` run by `migrate.js` every run; adds two files to REQ-115/120 file lists) or change the dump flags (drop `--no-acl`, a REQ-120 text change)? | the grants step (4.2.4): the flags stay, a moved database also gets its grants |
| О2 | No zod: own strict validator `server/http/schema.js` (C1), ARCH §3 diverges by a Plan amendment? | yes |
| О3 | Two tables beyond ARCH §4: `password_resets`, `login_delays`; the users columns of 4.2.1; `auth_sessions` without `idle_expires_at` (the idle limit read from `last_seen_at`, so a GET changes one column only, REQ-114 c4) | yes, a Plan amendment row |
| О4 | `uat-login.js` on Windows: refuse (fail closed, run it in the Linux container or on macOS) rather than skip the mode check | refuse |
| О5 | Pages by `.html` names (`/setup.html` …), so `vercel.json` and VC-1 stay; the post-deploy steps say `/setup.html` | yes |
| О6 | The four pages need no WF-04 look description and no G21 now (functional forms on the existing styles); the owner sees them at UAT | yes; G21 for the client-facing pages comes with REQ-116/117 |
| О7 | Vercel address header `x-forwarded-for` (C8), with the post-deploy probe of 14 | yes |
| О8 | Admin delay only for the admin account (C9; a 429 for the admin's e-mail tells an attacker which address is the admin's, as ARCH accepts) | yes |
| О9 | The Neon owner role's BYPASSRLS is not read (F16): without it `pg_dump` refuses forced-RLS tables and db-verify refuses (6.1). Add it to spike S3 before the first dump | yes, the owner's step in the runbook names the refusal and the spike |
| О10 | The reset limit 10 per 15 min per address (C10) | yes |
| О11 | Audit rows of tenant actions (REQ-117) must commit with the action, but a tenant transaction cannot read `prev_hash` (SELECT needs `platform`). REQ-117's design writes its audited actions in a platform transaction with explicit org filters, or a SECURITY DEFINER append function. Name it now as REQ-117's question | name it for REQ-117 |
| О12 | A wrong `current` in POST /api/auth/password counts as a re-auth failure (changes `users.reauth_*`, not `password_hash` or the sessions of REQ-114 c3) | yes |
| О13 | Re-auth tokens for ordinary users are issued (no route of theirs consumes one) rather than refused | yes |
| О14 | The rehearsal job binds port 5433 for its Postgres and 18080 for the app on the GitHub runner (not this PC) | yes |

---

## 17. Counts and their commands

- Criteria: REQ-114 14, REQ-115 12, REQ-120 6 = 32; rows of section 9: 32 (`grep -c` of the c columns).
- New test files: unit 9 (auth-password, setup-compare, setup-token, totp, route-table, db-calls, security-invariants,
  db-verify, rehearsal-seeds), int 14 (A1), pg 3 (A2); fixtures: `auth.js`, `permission-matrix.golden.json`; new cases in
  existing files: texts (TX-11), ci-workflow (rehearsal rules), runbooks (RB-3), no-string-sql (SQL-3), logging (LG-2),
  selfcheck (SC-7), selfcheck-pg (SP-2), migrate (MG-6).
- Product files new: 36 (section 3): 0002, grants.sql, health-read, auth-store, audit-store, schema, csrf, auth-mw,
  rate-limit, client-ip, keys, password, sessions, reauth, lockout, setup, totp, services/audit, routes/auth,
  routes/admin, setup-token, uat-login, db-verify, 2 seeds, 2 docs, 4 pages, api.js and 4 page scripts); changed: 18
  (db/index, pg, pglite, tx, selfcheck, migrate, config, app, errors, routes/index, health, demo, api/index,
  .env.example, compose.yaml, README, app.yml, texts.js).
- Mutants: 46 (section 13).

---

## 18. The sketch (`result.prototype`)

A fresh clone of the tag `base/M2AUTH-20261123-01` (`git clone -c core.autocrlf=false`) under `<scratch>/m2auth-01/sai`,
`npm ci` in its `app/`, and three files in `app/sketch/` of that clone: `0002_trial.sql` (users, orgs, org_members,
audit_log with the trigger, the policies of 4.2.3 and grants), `t1-rls.mjs` (F5–F10: forced RLS under the login role,
foreign writes, the folded selfcheck, the audit trigger, PGlite interleaving, `query_to_xml`), `t2-crypto.mjs`
(F11–F14: scrypt memory and time, the RFC 6238 vectors, HKDF and AES-GCM, the client address in Hono). No server was
left running; the Node server of t2 bound port 0 and was closed in the same script. No app test, check or e2e was run.
