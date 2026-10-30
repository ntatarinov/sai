# Sai PUBLIC-V1 — architecture

Companion of `PLAN.md` (both live in `docs/program/public-v1/`). Written 2026-10-27 for Claude Sonnet working as ORCH.
Paths are relative to the repository root. **verify** marks a vendor fact to re-check on the day a task relies on it,
with the output in the handoff (AP-076, AP-102). Code is not shown; names, contracts, numbers and rules are. Before
writing any code that calls the Anthropic API, load the `claude-api` skill; never write API calls from memory.
`PLAN.md` refers to this file as "ARCH §n" and does not repeat it; this file does not repeat `PLAN.md`.

## 0. Principles

1. **Portable core:** one Hono app, static files and Postgres; a Vercel Function now, `node server/node-main.js` or
   Docker anywhere; host-specific code only behind the adapters of §3.
2. **The web tier never runs agents and never holds AI credentials:** all AI work runs in the worker (`app/worker/`).
3. **Tenancy at every layer:** the organisation comes from the session or the resource row, never from the request.
4. **Real events only:** offices draw projections of journal events; idle is idle. **Fail closed:** a refused action
   leaves state unchanged and returns a stable code that the page maps to plain words.
5. **One product folder:** all product code lives in `app/` (one npm package, one check command); `tools/` keeps the
   pipeline tooling, the owner's local tools and the team core.

## 1. Components

```
 Browser (visitor, customer, admin)                         Preview tab (CSP sandbox, opaque origin)
     │ HTTPS: cookie session, CSRF header, JSON                  │ HTTPS GET only, no cookies
     ▼                                                           ▼
 ┌──────── app/  (Vercel Function fra1 + CDN; or node server/node-main.js; or Docker) ─────────┐
 │ public/ static pages │ /api/* JSON API (Hono) │ /api/p/<token>/* answered on PREVIEW_ORIGIN only │
 └───────────────┬──────────────────────────────────────────────────────────────────────────────┘
                 │ SQL with parameters; SET LOCAL ROLE sai_app | sai_preview; row-level security
          ┌──────▼──────┐
          │  Postgres   │ accounts, orgs, projects, ТЗ, jobs, sessions, office events, artifacts, audit
          └─────────────┘
 app/worker/ (owner's Mac now; container from M7) ── outbound HTTPS, Bearer worker token ──► /api/worker/*
     │ in-process, only through app/worker/core-bridge.js
     ▼
 tools/src/team (engine, executors) ── spawn ──► claude-guard ── exec ──► claude --bare
                                                 cwd <worker home>/orgs/<org>/<engine project>/work
     └── api-mode text jobs ── HTTPS ──► Anthropic Messages API (key only in the worker)
```

| Component                                       | Runs                                                          | Does                                                                                           | Never does                                                             |
| ----------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Web app (`app/api`, `app/server`, `app/public`) | Vercel `fra1`; Node 22 or Docker elsewhere                    | pages, auth, tenancy, ТЗ, sessions, job queue API, office feed, preview serving, admin console | hold AI keys; spawn processes; work longer than 30 s per request       |
| Postgres                                        | Neon `aws-eu-central-1` now; any Postgres 17 later            | the single source of truth, including the queue and artifact bytes                             | —                                                                      |
| Worker (`app/worker`)                           | owner's Mac (modes `owner-local`, `api`); a container from M7 | claims jobs; runs text jobs and builds; uploads safe events, files, spend                      | accept inbound connections; touch the database; execute generated code |
| Team core (`tools/src/team`)                    | inside the worker process                                     | plan, run role agents, review, goal check, journal, pause, resume                              | network of its own                                                     |
| Claude Code CLI                                 | child of the core, started through `claude-guard`             | one agent attempt with file tools only                                                         | see the worker token; use Bash or web tools                            |
| Preview host                                    | the same deployment under a second hostname                   | serve built files in a sandbox                                                                 | serve app pages; set cookies                                           |
| Owner's local tools                             | Mac only (ports 4780, 4781, 4782, 4790)                       | staff Pixel Office, team web, picker                                                           | be deployed or exposed                                                 |

### 1.1 Key choices and rejected alternatives

| Choice                                                                           | Why                                                                                                                             | Rejected                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Worker polls the app over HTTPS and runs the existing core in-process            | works behind a home network; same protocol in a container; reuses the engine, journal, recovery, executors and ≈ 480 core tests | Vercel Sandbox/Workflows for builds (Vercel-only; Hobby sandbox sessions 45 min); the engine inside functions (300 s cap) |
| Modes `owner-local` / `api` / `fake`; interview and ТЗ go through the same queue | one job path; the web tier stays credential-free                                                                                | AI calls from functions                                                                                                   |
| Hono + vanilla ES modules, no bundler                                            | Web-standard handler on Vercel, Node and Docker; reuses Sai's page patterns and canvas code                                     | Next.js (React rewrite, build step, lock-in)                                                                              |
| Postgres only; artifact bytes in Postgres behind `BlobStore`; PGlite in tests    | one service to move with `pg_dump`                                                                                              | Vercel Blob/KV/Queues (lock-in)                                                                                           |
| Own small auth on `node:crypto`                                                  | no personal data at a foreign identity vendor; portable                                                                         | hosted auth vendors, large auth libraries                                                                                 |
| Row-level security as a second wall behind the API filters                       | tenant isolation in the database (F4)                                                                                           | application filters only                                                                                                  |
| A build delivers the work tree `work/site/`, scanned and uploaded by the worker  | no core schema change; multi-file sites from the first real build                                                               | a new core event `RESULT_TREE` (REQ-009 design revision, many guard tests)                                                |
| CLI deploy after the release gate and green CI                                   | production never ahead of CI; no GitHub App with write rights on the private repository                                         | the Git integration (owner alternative, §19.5)                                                                            |
| One deployment, two hostnames (app, preview)                                     | one deploy; `*.vercel.app` is a public suffix, so the two hosts are different sites                                             | a second Vercel project (fallback, §19.7)                                                                                 |

### 1.2 Trust boundaries (each has tests, §18)

TB1 internet → app: auth, CSRF, rate limits, strict input. TB2 app → Postgres: RLS, parameters only. TB3 worker → app:
token, lease epochs, every field re-validated (semi-trusted). TB4 core → agents: agents are untrusted (customer text is
data, file tools only, `--bare`, sweep, output scan). TB5 generated code → viewers: another site, CSP sandbox, no
cookies. TB6 admin console: re-auth, audit, kill switch.

## 2. Repository layout

```
app/                         one npm package (decision 0001); production deploys run from here
  package.json package-lock.json .npmrc jsconfig.json eslint.config.js .prettierignore README.md
  vercel.json .vercelignore vendored.json .env.example Dockerfile Dockerfile.worker compose.yaml
  api/index.js               Vercel entry: exports the Hono app's fetch (shape proved by spike S1)
  server/  app.js (createApp(deps)) config.js node-main.js (Node entry + static files) static.js
           http/{headers,errors,body,request-id,origin,csrf,auth-mw,rate-limit,site-gate}.js
           db/{index,pg,pglite,tx,selfcheck,migrate}.js   blob/{index,pg-blob-store}.js   mail/{index,null-mailer}.js
           auth/{password,sessions,reauth,lockout,invites,setup}.js
           services/*.js (one per area)   routes/{index,*}.js (route table with metadata)   vendor/picker-engine.js
  worker/  main.js config.js client.js loop.js core-bridge.js core-bridge.d.ts start-checks.js bin/start.sh
           guard/claude-guard.js   providers/{text-cli,text-api,text-fake}.js
           jobs/{interview-turn,spec-draft,spec-revise,build}.js   build/{workspace,goal,events,scan,upload}.js
           prompts/*.md   fixtures/ai/*.json
  public/  *.html  css/{tokens,site}.css  img/  js/{dom,api,theme,heartbeat}.js  js/pages/  js/admin/
           office/{grid,sim,draw,stage-scene,project-scene,view,labels}.js
           shared/   pure modules for browser, server and worker (public by design): text-rules.js format/kz.js
                     i18n/{texts,lang}.js spec/{schema,render,diff}.js session/machine.js project/stages.js
                     office/{project-events,model,phrases}.js ai/{schemas,limits}.js
  content/ sai-intake.json  sai-intake.answers/*.json         deploy/egress-proxy/ (M7)
  db/migrations/NNNN_<name>.sql
  scripts/{vercel-build,smoke,check-public,setup-token,uat-login,db-verify}.js
  test/{unit,int,pg,e2e,fixtures}/
docs/program/public-v1/      PLAN.md ARCHITECTURE.md KICKOFF.md PROGRESS.md HANDOVER.md vercel-setup.ru.md
                             claude-token.ru.md api-key.ru.md worker-mac.ru.md reachability.md anthropic-question.md
docs/runbooks/               release.md incident.md migrate-host.md
docs/archive/                STATE-until-2026-10-27.md PLAN-until-2026-10-27.md
.github/workflows/app.yml    CI for app/ (check.yml stays exactly as it is: tests CI-1…CI-8)
```

**What stays in `tools/`:** the pipeline tooling, the owner's Pixel Office, picker and team web (all local), and the team
core `tools/src/team`, which gains only the changes of §10 and keeps decision 0002 (no runtime dependencies, its own
check and guard tests). The deployed app never imports `tools/`; the worker reaches the core only through `core-bridge.js`.

### 2.1 Reuse

| Source                                                                    | Reuse                                                                                                                                                                   | Guard                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tools/src/team/**`                                                       | imported in-process by the worker through the barrel `tools/src/team/index.js` (CORE-8)                                                                                 | tools check + §10 tests                                                                       |
| `tools/src/picker/engine.js`                                              | byte copy `app/server/vendor/picker-engine.js`, server-only (it carries `REQ-` comments)                                                                                | `app/vendored.json` + sha256 test                                                             |
| `tools/src/picker/validate.js` and `picker check`                         | build-time check of `app/content/sai-intake.json` (Sai as storefront #1)                                                                                                | step `content` of `npm run check`                                                             |
| `tools/src/picker/public/{dom,net,store,say,screens}.js`, `text-rules.js` | adapted into `app/public/js/` and `app/public/shared/text-rules.js`                                                                                                     | own tests; text-rule parity test                                                              |
| `tools/src/pixel-office/public/layout.js`, `office-sim.js`                | ported into `app/public/office/grid.js`, `sim.js`: header "ported from <path> at <sha>; no import of tools/", route kind `handoff` renamed `deliver`, no internal words | port-parity test: same positions per tick for fixture routes (the test imports the originals) |
| `tools/src/pixel-office/public/{guide,hints,tour}.js`                     | adapted with injected captions                                                                                                                                          | own tests                                                                                     |
| `tools/src/team/language.js` `PHRASES`, `FAIL_DETAIL` keys                | office phrase keys with ru/kk/en texts per key                                                                                                                          | key-set equality test                                                                         |
| `docs/design/samples/picker-v3-approved-2026-10-26/`                      | visual reference for drawing, cards and panels                                                                                                                          | WF-04 + the owner's «похоже»                                                                  |

### 2.2 Import boundaries (test `app/test/unit/import-boundaries.test.js` parses every import)

- `public/shared/**` imports only `public/shared/**`: no `node:` module, no `document`/`window`; no `Math.random`,
  `Date.now` or `new Date` in `shared/office/**`, `shared/spec/**`, `shared/session/**` (clocks are injected).
- `public/js/**` and `public/office/**` import only `public/**`.
- `server/**` imports `public/shared/**`, `node:*` (never `node:child_process`), `hono`, `@hono/node-server`, `pg`,
  `zod`, `fflate`; never `worker/**` and nothing under `tools/`.
- `worker/**` imports `public/shared/**`, `node:*`, `@anthropic-ai/sdk`, `zod`; `tools/src/team/**` and
  `tools/src/pixel-office/mask.js` only inside `worker/core-bridge.js` (dynamic import, typed by `core-bridge.d.ts` so
  `tsc` does not check `tools/`).
- `api/index.js` imports only `server/{app,config}.js`.

## 3. Stack, pinning and the one check command

| Layer               | Choice                                                                                                                                            | Notes                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime             | Node 22.x ≥ 22.23.4, `engines: "22.x"`; Vercel picks the 22.x patch itself (**verify** in the build log); Node 24 by a decision before 2027-03-31 | the floor is an injected check enforced only in entry points: `worker/main.js` and the Docker/Node entry (`server/node-main.js` with `NODE_ENV=production`) refuse below 22.23.4; on Vercel `/api/health` reports `process.version` and `smoke.js` fails the release below the floor; in-process tests never enforce it |
| Language            | JavaScript ES modules + JSDoc, `tsc --noEmit --checkJs`                                                                                           | no build step                                                                                                                                                                                                                                                                                                           |
| HTTP                | `hono`, `@hono/node-server`                                                                                                                       | one app on Vercel, Node and Docker                                                                                                                                                                                                                                                                                      |
| Database            | Postgres 17 through `pg`; `@electric-sql/pglite` in tests                                                                                         | SQL with parameters only (Q9)                                                                                                                                                                                                                                                                                           |
| Validation          | `zod` for API input and AI output; the JSON Schemas for the CLI and the API are generated from the same schemas                                   | one schema per contract                                                                                                                                                                                                                                                                                                 |
| Archive             | `fflate`                                                                                                                                          | zip download only                                                                                                                                                                                                                                                                                                       |
| AI (worker only)    | `@anthropic-ai/sdk` in api mode; the Claude Code CLI through the core for builds and owner-local text jobs                                        | load the `claude-api` skill first                                                                                                                                                                                                                                                                                       |
| Browser tests       | `playwright-core` driven from `node:test`; installed Chrome locally, Chromium in CI                                                               | one browser at a time                                                                                                                                                                                                                                                                                                   |
| Lint, format, types | eslint 10.11.0, @eslint/js 10.0.1, globals 17.12.0, prettier 3.9.9 (the versions of `tools/`); `typescript` for `tsc`                             | dev only                                                                                                                                                                                                                                                                                                                |
| Deploy CLI          | `npx vercel@<exact>` (version written in `app/README.md`), never installed globally                                                               |                                                                                                                                                                                                                                                                                                                         |
| Not used            | ORM, front-end framework, bundler, CSS framework, auth library, Vercel Blob/KV/Queues/Workflows/Sandbox/Cron in core paths                        |                                                                                                                                                                                                                                                                                                                         |

**Pinning rule.** Exact versions only (`.npmrc`: `save-exact=true`, `engine-strict=true`, `ignore-scripts=true` — no
dependency install script runs on the Mac or in the Vercel build, where the owner database URL is present; `npm run`
still runs named scripts, without pre/post hooks; a unit test reads `.npmrc`; any needed exception is named in decision
0001); committed lockfile; `npm ci`
only; a version is adopted only if `npm view <pkg>@<version> time` shows it is ≥ 14 days old; licence MIT, ISC, BSD or
Apache-2.0; each runtime dependency listed in decision 0001 with licence and reason; Actions pinned by commit SHA, images
by digest; the Claude Code CLI version fixed in `SAI_CLAUDE_VERSION` (changed only after a re-probe, §9.3); CI runs
`npm audit --omit=dev --audit-level=high`; after every install `cd tools && npm run traces` (the lockfile is scanned).

**The one check command.** `cd app && npm run check` = prettier `--check` → eslint (0 warnings) → `tsc` →
`scripts/check-public.js` (forbidden words of Sai's public texts; `REQ-`, `handoff`, `ORCH`, `decisions` and «Claude
Code» in served files; no `innerHTML`, inline `style=`, external URLs, or `Math.random` in `public/office/`) →
`vendored` → `content` (`picker check` of the intake) → `test:unit` → `test:int` (PGlite); it stops at the first error
and needs `# fail 0`, `# skipped 0`. CI (`app.yml`) adds `test:pg`, `test:e2e`, `docker`, `migration-rehearsal`; all
are green before any deploy. **Host adapters:** `api/index.js` vs `server/node-main.js`; `BlobStore` (Postgres now,
S3-compatible later); `Mailer` (null now, a provider after G16); `TRUST_PROXY`; `scripts/vercel-build.js` vs the Docker
entrypoint (both run `server/db/migrate.js`). Nothing else knows the host.

## 4. Data model

**Conventions.** `uuid` keys (`gen_random_uuid()`); `timestamptz` in UTC; every tenant table has
`org_id uuid not null references orgs(id)` and an index starting with `org_id`; child tables reference parents by the
composite `(org_id, id)`, so a row can never point into another organisation; insert-only tables have a trigger that
raises on `UPDATE`/`DELETE`; closed sets are `text check (… in …)`; text limits are `check (char_length(x) <= N)`.

**Roles and row-level security.**

- Group roles `sai_app` and `sai_preview` (NOLOGIN, NOBYPASSRLS, own no table). Every request transaction runs
  `SET LOCAL ROLE sai_app` and `select set_config('app.org_id', $1, true), set_config('app.role', $2, true)` with role
  `tenant`, `platform` or `worker`. Tenant tables have RLS enabled **and forced**, policy for `USING` and `WITH CHECK`:
  `org_id = nullif(current_setting('app.org_id', true), '')::uuid OR current_setting('app.role', true) IN ('platform','worker')`.
  Platform and worker code also filter by `org_id` explicitly. `SET LOCAL` stays correct behind the Neon pooler.
- `sai_preview` has `SELECT` on `artifacts`, `artifact_files`, `preview_links` only; the preview route runs
  `SET LOCAL ROLE sai_preview` with `app.org_id` taken from the verified token.
- Helpers in `server/db/tx.js`: `withTenant(orgId)`, `withPlatform()`, `withWorker()`, `withPreview(orgId)`; a lint test
  forbids database calls anywhere else.
- **Login role and selfcheck.** The runtime connection's role must have `rolsuper = false` and `rolbypassrls = false`;
  `server/db/selfcheck.js` checks it at start (and `/api/health` reports it) and the process exits with one plain log
  line otherwise. Spike S3 reads the attributes of the role in the integration's `DATABASE_URL`. If either is true,
  migration 0001 creates `sai_app_login` (LOGIN NOSUPERUSER NOBYPASSRLS, member of `sai_app` and `sai_preview`) with the
  password from `APP_DB_PASSWORD`, and the app builds its URL from the host of `DATABASE_URL` with that role. Migrations
  themselves run as the owner role through `DATABASE_URL_UNPOOLED` (§19.6).
- **Completeness test** (`test:pg`; PGlite too if it supports roles — **verify**): every table with an `org_id` column
  (read from `information_schema`) has RLS enabled and forced and a policy.

**Global tables**

| Table               | Key columns                                                                                                                                                                                                              | Keys and rules                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`             | id, email, email_norm, display_name, password_hash, is_platform_admin, is_owner_identity, totp_secret_enc null, language, status (`active`/`disabled`/`deleted`), failed_logins, locked_until, created_at, last_login_at | unique(email_norm); at most one platform admin; `is_owner_identity` (the owner's own accounts, including test logins) is set only by the admin with re-auth, audited |
| `auth_sessions`     | id, user_id, token_hash, csrf_hash, created_at, last_seen_at, idle_expires_at, abs_expires_at, ip_hmac                                                                                                                   | unique(token_hash)                                                                                                                                                   |
| `reauth_tokens`     | id, user_id, auth_session_id, purpose, token_hash, expires_at, used_at                                                                                                                                                   | unique(token_hash); single use                                                                                                                                       |
| `invites`           | id, org_id null (null = a new customer organisation), email_norm, role, code_hash, expires_at, used_at, used_by, created_by                                                                                              | unique(code_hash)                                                                                                                                                    |
| `workers`           | id, name, mode (`owner-local`/`api`/`fake`), isolation (`host`/`container`, set at token creation with re-auth), token_hash, created_by, created_at, last_seen_at, version, claude_version, revoked_at                   | unique(token_hash)                                                                                                                                                   |
| `rate_limits`       | key, window_start, count                                                                                                                                                                                                 | pk(key, window_start)                                                                                                                                                |
| `platform_settings` | key, value jsonb, updated_by, updated_at                                                                                                                                                                                 | keys: kill_switch, test_mode, registration_mode, caps, timers, max_concurrent_builds, read_only, setup_done                                                          |
| `audit_log`         | id bigserial, org_id null, actor_kind (`user`/`admin`/`worker`/`system`), actor_id, action, target_kind, target_id, ip_hmac, details jsonb (closed keys), prev_hash, hash, created_at                                    | insert-only; explicit policies: INSERT for every app role, SELECT only with `app.role = 'platform'` (the same for `error_events`)                                    |
| `error_events`      | id, org_id null, route, code, req_id, created_at                                                                                                                                                                         | kept 14 days; no texts, no stacks                                                                                                                                    |
| `schema_migrations` | name, sha256, applied_at                                                                                                                                                                                                 | pk(name)                                                                                                                                                             |

**Tenant tables** (all with `org_id`; `orgs` uses its own `id`)

| Table             | Key columns                                                                                                                                                                                                                                                                                                                                     | Keys and rules                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orgs`            | id, name, kind (`owner`/`customer`), ai_allowed, created_by, created_at                                                                                                                                                                                                                                                                         | unique partial (kind) where kind = 'owner'; ai_allowed is true for the owner org and false for others until the admin switches it (re-auth, audited) |
| `org_members`     | org_id, user_id, role (`org_owner`/`member`), created_at                                                                                                                                                                                                                                                                                        | pk(org_id, user_id); a member of the `owner` org must have `is_owner_identity` (service rule + trigger)                                              |
| `projects`        | id, org_id, title, language, stage, created_by, created_at, updated_at                                                                                                                                                                                                                                                                          | (org_id, stage); (stage, updated_at)                                                                                                                 |
| `idea_versions`   | id, org_id, project_id, version, text ≤ 8 000, quick_facts jsonb, reason, created_by, created_at                                                                                                                                                                                                                                                | unique(project_id, version); insert-only                                                                                                             |
| `interviews`      | id, org_id, project_id, status (`active`/`done`/`abandoned`), question_count, created_at, finished_at                                                                                                                                                                                                                                           | one active per project                                                                                                                               |
| `interview_turns` | id, org_id, interview_id, seq, kind (`question`/`answer`), body jsonb, job_id, created_at                                                                                                                                                                                                                                                       | unique(interview_id, seq)                                                                                                                            |
| `spec_versions`   | id, org_id, project_id, version, parent_version, status (`draft`/`proposed`/`approved`/`superseded`), body jsonb ≤ 64 KiB, change_reasons jsonb, author_kind (`ai`/`user`/`admin`), demo bool, reason, sha256, created_by, created_at                                                                                                           | unique(project_id, version); unique partial (project_id) where status = 'approved'; body immutable (trigger)                                         |
| `spec_comments`   | id, org_id, project_id, spec_version, item_id, body ≤ 2 000, author_id, status (`open`/`addressed`/`dismissed`), addressed_in, created_at                                                                                                                                                                                                       | (org_id, project_id, spec_version)                                                                                                                   |
| `approvals`       | id, org_id, project_id, spec_version, spec_sha256, approved_by, approved_at                                                                                                                                                                                                                                                                     | insert-only                                                                                                                                          |
| `change_requests` | id, org_id, project_id, base_version, body ≤ 2 000, source (`customer`/`admin`/`return`), status (`queued`/`accepted`/`rejected`/`applied`), created_by, decided_by, decided_at, result_version                                                                                                                                                 | (org_id, project_id)                                                                                                                                 |
| `dev_sessions`    | id, org_id, project_id, spec_version, spec_sha256, state (§7), reason, version int, started_by, controller_user_id, ceiling_usd, run_cap_usd, spent_usd, duration_min, grace_s, last_heartbeat_at, pausing_since, expires_at, worker_id (pinned at first claim), engine_project_id, checkpoint jsonb, created_at, closed_at                     | unique partial (project_id) where state not in ('completed','failed','closed')                                                                       |
| `access_grants`   | id, org_id, project_id, session_id null, user_id, rights text[], code_hash, code_expires_at, redeemed_at, expires_at, revoked_at, created_by                                                                                                                                                                                                    | unique(code_hash); check rights ⊆ {view, stop} in V1                                                                                                 |
| `jobs`            | id, org_id, project_id, session_id null, kind, payload jsonb ≤ 256 KiB, status (`queued`/`leased`/`done`/`failed`/`cancelled`/`interrupted`), priority, run_after, attempts, max_attempts, lease_worker_id, lease_epoch, lease_token_hash, lease_expires_at, idempotency_key, result jsonb, error_category, created_at, claimed_at, finished_at | unique(idempotency_key); partial index on queued; partial index (lease_expires_at) on leased                                                         |
| `office_events`   | id bigserial, org_id, project_id, session_id, src (`engine`/`worker`/`server`), src_seq, ts, kind, role, task_no, activity, category, passed, progress_done, progress_total                                                                                                                                                                     | unique(session_id, src, src_seq); (project_id, id)                                                                                                   |
| `artifacts`       | id, org_id, project_id, session_id, demo bool, status (`uploading`/`partial`/`ready`/`rejected`), manifest jsonb, manifest_sha256, file_count, total_bytes, checks jsonb, created_at                                                                                                                                                            | (org_id, project_id)                                                                                                                                 |
| `artifact_files`  | artifact_id, org_id, path, bytes, sha256, content_type, content bytea                                                                                                                                                                                                                                                                           | pk(artifact_id, path)                                                                                                                                |
| `preview_links`   | id, org_id, artifact_id, token_hash, expires_at, created_by, created_at                                                                                                                                                                                                                                                                         | unique(token_hash)                                                                                                                                   |
| `spend_ledger`    | id bigserial, org_id, project_id, job_id, session_id, ref, mode, model, usd numeric(12,6), accounted (`reported`/`assumed`), tokens jsonb, created_at                                                                                                                                                                                           | unique(job_id, ref); (org_id, created_at)                                                                                                            |

- **Project stages** (`public/shared/project/stages.js`, pure): `draft` → `interview` → `spec` → `approved` →
  `dev_requested` → `in_development` → `built`; later `delivered`, `accepted`, `returned`; `archived` at any time. Only
  the owning service changes a stage, with an audit row.
- **Retention** (lazy cleanup on 1 % of requests; no cron): `rate_limits` 24 h, `error_events`
  14 days, expired sessions, tokens, invites, grants and preview links 30 days, artifacts beyond the last 3 per project
  30 days; `audit_log` is kept (pseudonymous once a user is deleted).
- **Audit chain:** `hash = sha256(prev_hash || canonical_json(row without hash))`; rows are written only by one helper
  that runs `withPlatform()` and takes `pg_advisory_xact_lock(<audit key>)` before reading `prev_hash` (a pg test with
  20 parallel inserts → verify passes); `GET /api/admin/audit/verify`.
- **Migrations:** plain SQL in name order by `server/db/migrate.js`, one transaction each, under `pg_advisory_lock`,
  sha256 recorded (a changed applied file stops the run); expand-only per release; drops and renames one release after
  the code stops using the object.

## 5. Authentication, roles and permissions

**Mechanics.**

- Passwords: `crypto.scrypt` N = 2^15, r = 8, p = 1, 16-byte salt, 64-byte key (`scrypt$15$8$1$<salt>$<hash>`);
  length 10–128; an unknown e-mail runs scrypt on a dummy hash; constant-time comparison.
- Login session: cookie `__Host-sai_s` (Secure, HttpOnly, SameSite=Lax, Path=/; plain `sai_s` only on
  `http://127.0.0.1` locally); 32 random bytes stored as `HMAC-SHA256(SECRET_PEPPER, token)`; idle 12 h, absolute 7
  days; rotated at login; a password change revokes all other sessions.
- CSRF: every non-GET request needs `Origin` equal to `APP_ORIGIN`, `Content-Type: application/json` and header
  `x-sai-csrf` equal to the session's CSRF token (returned by `GET /api/auth/me`); GET never changes state.
- Re-auth: `POST /api/auth/reauth {password, purpose, totp?}` → a single-use token for 5 minutes bound to user, session
  and purpose (`dev_start`, `dev_resume`, `worker_token`, `settings`, `kill_switch_off`, `ai_allow`, `codes`,
  `owner_identity`). `dev/preview` consumes a `dev_start` (or `dev_resume`) token and returns the one-time confirm token
  (5 minutes, bound to the draft, user and sha256); `dev/start` and `resume` need only that confirm token.
- Lockout (stored in the database): an ordinary account → 5 wrong passwords in 15 minutes lock it for 15 minutes. The
  platform admin is never locked (an attacker who knows his e-mail could keep him out of «Стоп всем»): per-IP limits
  and a growing delay (1, 2, 4 … 60 s per IP). Re-auth failures have their own counter (5 → re-auth refused for 15
  minutes) and never lock login. Admin TOTP (RFC 6238, `node:crypto`, secret encrypted with `SECRET_PEPPER`) is built in
  M2; required at login and re-auth once the owner enrols (G20).
- Bootstrap: the owner runs `node scripts/setup-token.js` on his Mac (prints a one-time token and its sha256); only
  `SETUP_TOKEN_HASH` goes into the host environment; `/setup` compares digests in constant time, creates the platform
  admin and the owner organisation once, then answers 404 forever; the owner then deletes `SETUP_TOKEN_HASH`.
- Invites: 128-bit, 7 days, single use, stored as HMAC, shown once to the admin (no e-mail in V1); accepting needs name,
  e-mail, password and the consent sentence (PLAN R2.2 lists its elements). `registration_mode` (`platform_settings`)
  `closed` / `invite` (default) / `open` (after G10). An invite into the owner organisation, and every invite until G7
  «б» is in force, creates only an owner identity; otherwise refused. Password reset in V1: a one-time 30-minute link
  from the admin; e-mail resets after G16.

**Actors and rights**

| Action                                                                                                     | Visitor                         | Org member / org owner                                                             | Platform admin (the owner)                        | Worker                                                   |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Landing, how it works, demo survey, legal pages                                                            | yes                             | yes                                                                                | yes                                               | —                                                        |
| Register                                                                                                   | with an invite (open after G10) | —                                                                                  | —                                                 | —                                                        |
| Create a project, edit the idea, answer the interview, comment the ТЗ, request development, change request | —                               | own org                                                                            | own org; edits any request (new version + reason) | —                                                        |
| Approve a ТЗ version                                                                                       | —                               | org owner, own org                                                                 | yes                                               | —                                                        |
| Start an interview or AI revision                                                                          | —                               | own org if `ai_allowed` (owner org: always; customer org: admin switch + api mode) | yes                                               | —                                                        |
| View the project office and results                                                                        | —                               | a grant with `view` (codes; real customers after G11)                              | always (reads audited)                            | —                                                        |
| Start or resume development                                                                                | —                               | never in V1 (only by the owner's word)                                             | re-auth + one-time confirm token                  | —                                                        |
| Pause or close a session                                                                                   | —                               | a grant with `stop` (V1: owner identities only)                                    | yes                                               | —                                                        |
| Invites, codes, worker tokens, settings, kill switch, costs, audit, request board                          | —                               | —                                                                                  | yes (re-auth where §13 marks it)                  | —                                                        |
| `/api/worker/*`                                                                                            | —                               | —                                                                                  | —                                                 | worker token; owner-local tokens get owner-org jobs only |

**Separation.** User routes reject worker tokens; worker routes ignore cookies; every audit row carries `actor_kind`;
admin actions record the id of their re-auth token; agents have no HTTP identity at all. While `test_mode` is on, the
office, results, grants and preview links are served only to the platform admin and to owner identities; everyone else
gets the uniform 404 (int tests for both sides).

## 6. Interview, ТЗ versioning and diff

- **6.1 Interview.** `POST …/interview/start` creates an interview and the job `interview_turn` (payload: idea, quick
  facts, language, transcript so far). The worker returns `{done, question?, notes_for_spec[]}`; the app validates it and
  stores a `question` turn. The page polls `GET …/interview?after=<seq>` every 2 s while a job is pending and shows
  «Аналитик думает… N с» counted from the job's own `created_at`. The interview stops when the AI says done, after 15
  questions, or when the user presses «Хватит — составьте ТЗ»; then a `spec_draft` job runs. On failure the page says so
  and offers «Повторить»; nothing is invented. Question schema: `text` ≤ 300, `why` ≤ 200, `options` 2–4 × {label ≤ 60,
  value ≤ 60}, `allow_free_text`; the UI always adds «Не знаю». Answers: an option value, free text ≤ 2 000 characters,
  or `dont_know`; control and invisible characters are refused (the picker's `forbiddenSign` rule).
- **6.2 ТЗ body** (JSON ≤ 64 KiB; rendered by `shared/spec/render.js` as canonical Markdown ≤ 40 000 characters):
  `title, summary, language, goals[], users_roles[], features[{id "F1", title, description, priority must|should|could,
acceptance[], source_refs[]}], screens[{id "S1", title, purpose, elements[], source_refs[]}], data[{id "D1", entity,
fields[], storage none|browser}], constraints[], out_of_scope[], assumptions[{id "A1", text, why}],
open_questions[{id "Q1", question, why_it_matters, blocking, options[]}], acceptance_criteria[],
build_profile{kind: "static-web"}`. Item ids are stable across versions. `source_refs` point to an idea version, an
  answer turn, a comment or an admin edit. The validator refuses a goal, feature, screen or constraint without
  `source_refs` that no assumption covers ("no silent invention"). Anything outside the V1 build profile (servers,
  payments, integrations) must sit in `out_of_scope` or `open_questions`.
- **6.3 Versions.** v1 comes from the interview (`author_kind: ai`). A new version comes from a manual edit (user or admin,
  reason required) or from an AI revision (`spec_revise`: base body, open comments, answers → new body and
  `change_reasons[{item_id, change added|removed|modified, reason, source_ref}]`; an AI result without a reason for every
  changed item is refused and retried). Statuses: `draft` → `proposed` → `approved` (immutable; one per project) →
  `superseded` (when a newer version is approved after a change request). `sha256` is computed over canonical JSON with
  sorted keys. Versions are unlimited; only AI revisions count against the caps (§15).
- **6.4 Diff.** The pure module `shared/spec/diff.js` compares by section and item id (added, removed, modified); a modified
  item gets a field list and a word-level diff of text fields (≤ 4 000 words per field, otherwise "changed as a whole").
  Output `{items:[{section, id, change, fields:[{name, before, after, ops}]}], reasons:[…]}`. The page shows two columns on
  wide screens and stacked blocks on phones, with «Почему» and a link to the source comment or answer.
- **6.5 Approval and changes after approval.** `POST …/specs/:v/approve {sha256}` checks status `proposed`, the hash and
  the stage, then writes `approved`, an `approvals` row and an audit row; an open question marked `blocking` needs an
  explicit confirmation. After approval nothing edits that version: a change request (`queued`, «не сразу») is accepted by
  the admin and produces a new version with `parent_version` = the approved one and status `proposed`, which needs its own
  approval; the approved version and its approval row stay. Development always uses the newest approved version and
  records its number and sha256 in the session.

## 7. Development session state machine

- **7.1 States and timers.** One `dev_sessions` row is both the authorisation and the build it governs: `authorized`
  (build job queued), `running`, `grace` (no controller heartbeat for 90 s; work continues), `pausing` (no new
  tasks; in-flight attempts may finish), `paused` (engine exited, state kept), `resuming`, and final `completed`,
  `failed`, `closed`. Timers (`platform_settings.timers`, admin-editable within brackets): controller heartbeat every 15 s
  from a dedicated Web Worker timer (a hidden tab may still slow to 60 s); lost after 90 s; `grace_s` 300 [60–1800];
  drain 120 s [60–600], then a hard pause; duration 120 min [15–480] per time window (`expires_at`); `lifetime_end` = 7
  days after creation, then a paused session closes; worker lease: text jobs 60 s, builds 180 s, renewed every 15 s.
  running → grace → running inside one grace window writes no audit or office row.
- **7.2 Transitions.** The pure function `shared/session/machine.js`
  `next(session, event, now, settings) → {state, reason, control} | {refused: code}` implements the table; every other
  pair is a named refusal. A unit test covers every (state, event) pair.

| From \ event              | admin_start      | engine_started | heartbeat  | hb_timeout | grace_expired            | deadline          | user_pause        | kill_switch                 | needs_owner           | engine_paused | lease_lost           | engine_done | engine_failed | admin_resume                                                                                | admin_close               | lifetime_end |
| ------------------------- | ---------------- | -------------- | ---------- | ---------- | ------------------------ | ----------------- | ----------------- | --------------------------- | --------------------- | ------------- | -------------------- | ----------- | ------------- | ------------------------------------------------------------------------------------------- | ------------------------- | ------------ |
| (none)                    | authorized       | —              | —          | —          | —                        | —                 | —                 | —                           | —                     | —             | —                    | —           | —             | —                                                                                           | —                         | —            |
| authorized                | refused `exists` | running        | authorized | —          | —                        | closed `expired`  | closed `stopped`  | authorized (claims blocked) | —                     | —             | paused `worker_lost` | —           | failed        | refused                                                                                     | closed                    | closed       |
| running                   | refused          | —              | running    | grace      | —                        | pausing `expired` | pausing `stopped` | pausing `kill_switch`       | pausing `needs_owner` | paused        | paused `worker_lost` | completed   | failed        | refused                                                                                     | refused                   | —            |
| grace                     | refused          | —              | running    | grace      | pausing `heartbeat_lost` | pausing `expired` | pausing `stopped` | pausing `kill_switch`       | pausing `needs_owner` | paused        | paused `worker_lost` | completed   | failed        | refused                                                                                     | refused                   | —            |
| pausing                   | refused          | —              | pausing    | pausing    | pausing                  | pausing           | pausing           | pausing `kill_switch`       | pausing               | paused        | paused `worker_lost` | completed   | failed        | refused                                                                                     | refused                   | —            |
| paused                    | refused          | —              | paused     | —          | —                        | paused            | paused            | paused                      | paused                | paused        | paused               | —           | —             | resuming (re-auth, limits, before `lifetime_end`; new window `expires_at = now + duration`) | closed                    | closed       |
| resuming                  | refused          | running        | resuming   | —          | —                        | paused `expired`  | paused `stopped`  | paused `kill_switch`        | —                     | —             | paused `worker_lost` | —           | failed        | refused                                                                                     | closed                    | closed       |
| completed, failed, closed | refused          | —              | —          | —          | —                        | —                 | —                 | —                           | —                     | —             | —                    | —           | —             | refused                                                                                     | completed/failed → closed | —            |

Computed events (`hb_timeout`, `grace_expired`, `deadline`, `lifetime_end`, the end of the drain) are evaluated lazily
whenever the session is touched (controller or worker heartbeat, office poll, admin view): no cron on any host. Writes
use optimistic concurrency (`… SET state = $new, version = version + 1 WHERE id = $id AND version = $v`; a lost race
re-reads). **Control** in every worker heartbeat, in this priority: kill switch on → `halt`; `pausing` → `pause` until
`pausing_since + drain`, then `halt`; `paused`/`completed`/`failed`/`closed` → `halt`; otherwise `continue`. The core's
irreversible `stop` command is never used by sessions.

- **7.3 What the worker does.** `continue`: nothing. `pause`: `engine.command({kind: "pause"})` and `isAuthorized()`
  returns false (CORE-7), so no new attempt starts even if a command is lost; when nothing is in flight,
  `engine.requestStop("signal")`; the engine exits; the current tree is uploaded as a `partial` artifact; the job completes
  with outcome `paused`. `halt`: `engine.requestStop("signal")` at once (attempts are cancelled, `PROJECT_PAUSED` is
  written, killed attempts are booked at their full run cap as `assumed`, so the drain is preferred). A budget wait of the
  engine (`PROJECT_WAITING budget`) is reported as `needs_owner`.
- **7.4 Checkpoints and resume.** The engine journal (`events.jsonl`, fsync per event) in the worker home is the
  checkpoint (task granularity); `dev_sessions.checkpoint` mirrors `{core_seq, tasks_done, tasks_total, tree_sha256}`.
  Resume = a `build` job with mode `resume` → `createEngine(id, {mode: "resume"})` on the same `engine_project_id` (a
  `budget` command first when the admin set a new ceiling within the caps); done tasks, accepted files and spend are kept;
  an interrupted attempt restarts as a new attempt. A session is pinned to its `worker_id` (the journal lives there).
  A new session on a project whose last engine project is paused (its session closed or past `lifetime_end`) reuses that
  `engine_project_id` in `resume` mode, so done tasks are never rebuilt.
- **7.5 Grants and codes.** The admin holds every right implicitly. Others get rights only through a code: 12 characters
  of Crockford base32 (60 bits), shown once, 15 minutes to redeem, single use, bound to user, project and rights
  ⊆ {`view`, `stop`} (wider rights need the owner's word); HMAC stored; ≤ 10 attempts per hour per user and per IP hash;
  a wrong, used, expired or foreign code gives the same 404. A grant lasts until its session closes plus 24 h.
- **7.6 Limits and locks.** One non-final session per project (partial unique index); `max_concurrent_builds` (default 1)
  checked at claim; ≤ 3 sessions per project and ≤ 5 per day, counted with failed starts (`decisions/0089` item 10);
  `dev/start` locks the project row (`SELECT … FOR UPDATE`), so racing requests create at most one session. A resume is not
  a new start.

## 8. Job queue and worker protocol

- **8.1 Job kinds** (payload assembled by the app at enqueue; result validated by the app)

| Kind             | Payload                                                                                    | Result                                                   | Attempts                           |
| ---------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------- |
| `interview_turn` | idea, quick facts, language, transcript, question count, model, cap                        | question or done                                         | 3                                  |
| `spec_draft`     | idea, quick facts, transcript, language, build-profile limits                              | ТЗ body                                                  | 3                                  |
| `spec_revise`    | base body, open comments, answers, change request                                          | new body + change reasons                                | 3                                  |
| `build`          | session id, mode `start`/`resume`, approved body + sha256, ceiling, run cap, limits, model | outcome `built`/`paused`/`failed` + artifact id + checks | 1 (never re-claimed automatically) |

- **8.2 Endpoints** (`/api/worker/*`, `Authorization: Bearer swk_<43 chars>`, token stored as HMAC, JSON; every write
  carries `lease_token` and `epoch`)

| Method, path               | Body                                                                                                                                    | Answer                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /claim`              | `{version, claude_version, kinds[]}`                                                                                                    | 200 `{job, lease_token, epoch, lease_expires_at, next_poll_ms}` or 204 `{next_poll_ms}`                                                 |
| `POST /jobs/:id/heartbeat` | `{lease_token, epoch, progress?}`                                                                                                       | `{lease_expires_at, control, session?: {state, reason}}`                                                                                |
| `POST /jobs/:id/events`    | `{lease_token, epoch, events[≤ 200]}`                                                                                                   | `{accepted_through_seq}`                                                                                                                |
| `PUT /jobs/:id/files`      | `{lease_token, epoch, path, sha256, content_b64}` (≤ 3 MiB raw; kept in the job's open `uploading` artifact, created by the first file) | `{stored}`                                                                                                                              |
| `POST /jobs/:id/artifact`  | `{lease_token, epoch, manifest, checks, status: ready\|partial}`                                                                        | `ready`/`partial` only when every manifest file is stored                                                                               |
| `POST /jobs/:id/complete`  | `{lease_token, epoch, outcome, result, spend[]}`                                                                                        | `{ok}`                                                                                                                                  |
| `POST /jobs/:id/spend`     | `{epoch, spend[]}`                                                                                                                      | `{booked}`; accepted for the job's last epoch even after `lease_lost` (idempotent by job and ref), so killed attempts are always booked |
| `POST /jobs/:id/fail`      | `{lease_token, epoch, category, retryable}`                                                                                             | `{requeued, run_after}`                                                                                                                 |

Errors: 401 (one body); 409 `lease_lost` (stale epoch or expired lease: the worker stops that job at once, posts its
spend to `/spend`, and on a later resume reconciles `BUDGET_SPENT` from the journal by run id); 422; 429 with
`Retry-After`. The kill switch makes `/claim` answer 204 and every heartbeat `halt`.

- **8.3 Claim and fencing.** Before each claim and heartbeat the server expires leases (`status = 'leased' AND
lease_expires_at < now()`): a text job returns to `queued` with `run_after = now + 30 s × 2^(attempts−1)` or becomes
  `failed` at `max_attempts`; a build job becomes `interrupted` and its session gets `lease_lost` (never an automatic
  restart). Then, under `withWorker`:

```sql
UPDATE jobs SET status = 'leased', lease_worker_id = $w, lease_token_hash = $h, lease_epoch = lease_epoch + 1,
       lease_expires_at = now() + <60 s text | 180 s build>, attempts = attempts + 1, claimed_at = now()
WHERE id = (SELECT j.id FROM jobs j JOIN orgs o ON o.id = j.org_id JOIN users u ON u.id = j.created_by
            WHERE j.status = 'queued' AND j.run_after <= now() AND j.kind = ANY($kinds)
              AND (($mode = 'owner-local' AND o.kind = 'owner' AND u.is_owner_identity)
                   OR ($mode = 'api' AND o.ai_allowed
                       AND (j.kind <> 'build' OR o.kind = 'owner' OR $isolation = 'container'))
                   OR ($mode = 'fake' AND (o.kind = 'owner' OR $fake_allowed)))
              AND (j.session_id IS NULL OR <session pinned to $w or unpinned, control = continue, builds below max>)
              AND NOT <kill switch>
            ORDER BY j.priority, j.run_after, j.created_at
            FOR UPDATE OF j SKIP LOCKED LIMIT 1)
RETURNING *;
```

Fencing: every worker write runs `… WHERE id = $1 AND lease_worker_id = $2 AND lease_epoch = $3 AND status = 'leased'`;
zero rows → 409 `lease_lost`. A heartbeat renews `lease_expires_at` by its lease length the same way. **Demo rule:**
`fake` jobs (fake provider, scripted executor) are claimable for the owner organisation in every environment and for
other organisations only with `ALLOW_FAKE=1` (tests, never production); they book zero spend, and every result is
marked `demo` (`spec_versions.demo`, `artifacts.demo`) and labelled «тестовый ИИ» / «тестовый исполнитель»; the
worker checks the same rule (claim test). **Test mode (D18):** no AI job is created or claimed for an organisation with
`ai_allowed = false`, whatever the worker mode; while `test_mode` is on, the admin may switch `ai_allowed` on only for
an organisation whose members are all owner identities, and results, office, grants and preview links follow §5.

- **8.4 Server-side validation (TB3).** Results are parsed with the zod schemas (unknown keys refused); texts pass the text
  rules and length limits; events pass the closed enums of §11.2; artifact paths and sizes are re-checked by the rules of
  §12.1 and sha256 is recomputed; a worker can touch only jobs it currently leases.
- **8.5 Idempotency and retries.** Creation keys: `turn:<interview>:<seq>`, `draft:<project>:<interview>`,
  `revise:<project>:<base>:<hash of comment ids>`, `build:<session>:<n>`; a duplicate returns the existing job. `complete`
  with the same lease token is accepted once and answered 200 again; events are keyed by (session, src, src_seq), files
  by (artifact, path, sha256), spend by (job, ref). Retryable: `network`, `timeout`, `invalid_output`, `rate_limited`. Not
  retryable: `refused`, `budget`, `mode_forbidden`, `invalid_input`, `version_mismatch`, `spec_tampered`.
- **8.6 Polling.** `next_poll_ms` is 3 000 while a job of the worker's mode is queued or leased, an interview is active or
  a session is not final; otherwise 30 000, and 60 000 after 10 idle minutes. An `owner-local` worker exits after 60 idle
  minutes (`SAI_WORKER_IDLE_EXIT_MIN`), so Neon can scale to zero; on 5xx or timeouts the worker backs off up to 60 s. This
  keeps Hobby invocations and Neon free compute low (**verify** both quotas on the day).
- **8.7 The worker process.** One process per worker home, holding `<home>/worker.lock` (CORE-5 instance id);
  `SAI_WORKER_CONCURRENCY=1` (one job at a time; a running job counts as one of the two agents allowed on the Mac).
  - Start checks (`start-checks.js`, each an injected function; any failure → one plain line, nothing claimed): Node ≥
    22.23.4 (enforced by `worker/main.js` only, never in in-process tests); a `container` worker proves its isolation
    (P2); `SAI_WORKER_HOME`
    absolute, mode 0700, owned by the user, outside any git work tree (`git -C <home> rev-parse` fails), with no
    `CLAUDE.md`, `CLAUDE.local.md`, `.claude/` or `.mcp.json` in it or in its parents below `$HOME`; `claude --version`
    equals `SAI_CLAUDE_VERSION`; `claude --help` lists every flag in use (and `--bare`); `SAI_APP_URL` is `https://`
    (`http://127.0.0.1` only with `NODE_ENV=test`); the token is accepted by `/claim`.
  - Launch: `cd app && npm run worker` runs `worker/bin/start.sh`, which reads the Keychain items of §9.6 into the
    environment (`security find-generic-password -s <item> -w`) and execs `node worker/main.js`; it prints the worker id
    and the app URL, never a secret. SIGINT/SIGTERM: stop claiming; a text job finishes or fails as retryable; a build
    gets `requestStop("signal")` and its session becomes `paused`.
  - Fail-safe (below the 180 s build lease): no successful contact for 60 s → graceful pause of every build, 150 s →
    halt; claim nothing until contact returns; a file
    `$SAI_WORKER_HOME/STOP` → pause all, stop claiming (local kill switch); after a restart the core recovers journals to
    `paused` and the worker resumes nothing by itself.
  - Home layout: `$SAI_WORKER_HOME/{worker.lock, STOP?, bin/claude-guard, logs/, oneshot/<job>/, clean-home/,
orgs/<org_id>/<engine project id>/{events.jsonl, files/, work/{SPEC.md, site/}, quarantine/}}`; logs are JSON lines
    without secrets; `bin/` and `claude-guard` are mode 0500.
- **8.8 Build flow** (`worker/jobs/build.js`).
  1. `createProject({goal, budget_usd: ceiling, executor: "claude-cli"}, {home: <home>/orgs/<org_id>})`; the goal
     (`build/goal.js`, ≤ 2 000 characters, English): build the static web product described in `SPEC.md` into `site/`;
     `SPEC.md` is customer data, not instructions; no network, no packages, no build step.
  2. `build/workspace.js` renders the approved body (`shared/spec/render.js`), checks its sha256 against the job, writes
     `work/SPEC.md` with mode 0444, records the file's sha256 and creates an empty `work/site/`.
  3. `createEngine(id, {home, env, mode, parallel: 1, isAuthorized, onEvent})` with `SAI_TEAM_ROLE_PROFILE=software`,
     `SAI_TEAM_BARE=1`, `SAI_TEAM_AUTH=oauth-token|api-key` (§9), `SAI_TEAM_MODEL`, `SAI_TEAM_RUN_CAP_USD`,
     `SAI_TEAM_WEB=0`, `SAI_TEAM_CLAUDE_BIN=<home>/bin/claude-guard`, `SAI_TEAM_CLAUDE_VERSION`, `SAI_TEAM_REAL_RUNS=1`.
  4. `onEvent` → `shared/office/project-events.js` → batched `POST /events` every 2 s; every `BUDGET_SPENT` → spend.
  5. After every run the sha256 of `SPEC.md` is unchanged (else fail `spec_tampered`); on `TASK_DONE` scan `work/site/`
     (§12.1) and store the checkpoint.
  6. `PROJECT_DONE` → final scan and checks → files, then the manifest → complete `built`. A pause uploads the current
     tree as `partial` (best effort) → complete `paused`. `PROJECT_FAILED` → fail. Core projects are never deleted by the
     worker; old folders are pruned only by an admin command.
- **8.9 Owner-local guard.** Two independent checks: the claim filter (owner org and an owner identity as creator) and
  the worker's own check of `payload.org_kind` and `payload.creator_is_owner`; a mismatch fails the job with
  `mode_forbidden` and an audit row.

## 9. AI provider modes

- **9.1 Modes**

| Job                                           | `owner-local` (owner org only; G5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `api` (orgs with `ai_allowed`; G6)                                                                                                                                                                        | `fake` (tests, labelled demo)         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `interview_turn`, `spec_draft`, `spec_revise` | `runStructured` (CORE-9): `claude -p` without `--bare`, with `--restricted --safe-mode --strict-mcp-config --no-session-persistence --permission-prompts none --tools ""` (if `""` is refused: `--disallowedTools` for every tool, else stop; never a Read fallback), `--json-schema`, `--max-budget-usd`, `--model`; cwd = a fresh empty folder `<home>/oneshot/<job>/`, removed afterwards; `HOME` and `CLAUDE_CONFIG_DIR` = `<home>/clean-home/` if P1(c) shows the subscription login still works there (otherwise G19); prompt on stdin | Messages API through `@anthropic-ai/sdk` with structured output from the same schema; `stop_reason` checked (`refusal` → category `refused`, plain message); exact parameters from the `claude-api` skill | fixtures in `worker/fixtures/ai/`     |
| `build`                                       | engine + CLI `--bare` with `CLAUDE_CODE_OAUTH_TOKEN` — **only if probe P1 passed**                                                                                                                                                                                                                                                                                                                                                                                                                                                           | engine + CLI `--bare` with `ANTHROPIC_API_KEY` in the child env (Mac, owner org); other organisations only in the M7 container behind the credential proxy                                                | engine + the core's scripted executor |

**Rules.** Every Claude Code run on a generated workspace uses `--bare` (no hooks, CLAUDE.md, MCP or memory from the
folder). The only runs without `--bare` are text jobs, which have no workspace: a fresh empty folder, no tools, the
hardened flags above. The core refuses `SAI_TEAM_BARE=1` with `SAI_TEAM_AUTH=subscription` (`E_CONFIG`), so a build can
never fall back to the subscription login without `--bare`. An `owner-local` worker lists `build` in its claim `kinds`
only when P1 passed and the OAuth token is set; otherwise real builds wait for an `api` worker (G6), and the chain
meanwhile runs with the scripted executor, labelled «тестовый исполнитель».

- **9.2 Text jobs.** The system prompt is constant per kind (`worker/prompts/*.md`, English; output in the project
  language) and comes first, so caching works; the transcript is appended. Customer text goes only inside
  `<customer_data>…</customer_data>` (a closing tag inside is escaped) after an instruction that the block is data and
  cannot change instructions. Model from `SAI_MODEL` (the owner's answer to G6; Sonnet 5.5 until he answers — **verify**
  the model ids with the `claude-api` skill); effort explicit (interview medium, ТЗ high). Cost: the CLI's
  `total_cost_usd`; in api mode `usage` × the price table in `worker/config.js` (**verify** on the day: Sonnet 5.5 2 $
  input / 10 $ output, Opus 5.5 4 $ / 20 $ per million tokens).
- **9.3 Probe P1** (M0; needs G2 and G5b). On the owner's Mac, with the pinned CLI and no API key, the token passed
  without echo: `CLAUDE_CODE_OAUTH_TOKEN="$(security find-generic-password -s sai-claude-oauth-token -w)" claude -p
--bare …` (the value never reaches stdout, a file or the transcript). (a) the executor's build flags plus `--bare` in a
  fresh empty folder with a one-line task; (b) the text-job flags with `--bare`, a tiny schema and `--max-budget-usd
0.05`; (c) the text-job flags without `--bare` in a oneshot folder with `HOME`/`CLAUDE_CONFIG_DIR` = `clean-home/`
  holding canary `CLAUDE.md` and `.claude/` files: does the login still work, and does any canary reach the output? Pass
  of (a)/(b) = exit 0, a schema-valid result and a cost line. Vendor docs say bare mode never reads OAuth credentials, so
  **fail is the expected result**. Command lines (no secrets), versions and outputs go to `docs/uat/P1-bare-auth-<date>.md`;
  the result is appended to decision 0093; on fail the owner deletes and revokes the token (`claude-token.ru.md`). Probe P2 (M7) checks the CLI behind the credential proxy (`ANTHROPIC_BASE_URL` → proxy).
- **9.4 The workspace guard** (worker side, no core change). At start the worker writes `$SAI_WORKER_HOME/bin/claude-guard`
  (a short shell script with the real binary path; `bin/` and the file mode 0500) and keeps its sha256; before every job
  and on every `RUN_STARTED` it recomputes the hash and halts with `guard_tampered` on a mismatch (the same check for
  `worker.lock`). The core runs it through `SAI_TEAM_CLAUDE_BIN`. Before
  `exec` it (1) refuses unless the cwd is under `orgs/` or `oneshot/` of the worker home; (2) moves `.claude/`,
  `.mcp.json`, `CLAUDE.md`, `CLAUDE.local.md`, `.claude.json` found in the cwd or its parents up to the worker home into
  `quarantine/<UTC>/` with one line in `logs/guard.log`; (3) only if spike S4 shows authentication still works, execs
  inside `@anthropic-ai/sandbox-runtime` (writes only in the cwd, network only to the model API) with read-deny rules for
  `~/.ssh`, `~/.aws`, `~/.config`, `~/Library`; otherwise no real build on the Mac until the owner answers G19. `exec` keeps the pid for
  the core's group signals. This is defence in depth next to `--bare`, never a substitute.
- **9.5 Never executed.** The worker and the core never open or run generated code: no Bash for any build role, no
  package scripts, no `npm install`. Generated code runs only in the sandboxed preview (§12.4); UAT-RUNNER may open a
  result only there (opaque origin, `connect-src 'none'`) in a fresh temporary Chrome profile, never from `file://` or a
  local server of its own.
- **9.6 Where secrets live**

| Secret                                      | Where                                                                        | Who reads it                                                                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker token                                | Keychain `sai-worker-token` → env at launch (§8.7); a container secret later | worker process                                                                                                                                                                                               |
| Claude OAuth token (only if P1 passed)      | Keychain `sai-claude-oauth-token`                                            | worker → CLI child only in `oauth-token` mode                                                                                                                                                                |
| Anthropic API key (G6)                      | Keychain `sai-anthropic-api-key`; in M7 the credential proxy's secret        | worker / proxy; never an agent of another organisation                                                                                                                                                       |
| `SECRET_PEPPER`, DB URLs, `APP_DB_PASSWORD` | Vercel env (Sensitive) or the host's secret store                            | app                                                                                                                                                                                                          |
| UAT test-identity password                  | Keychain `sai-uat-identity` (the owner stores it, M2)                        | only `app/scripts/uat-login.js` in-process (child `security` with captured stdout); it logs in through playwright-core and saves only the session state outside the project; UAT-RUNNER never sees the value |

Nothing secret goes into the repository, a handoff, a log, a report, a fixture or the client bundle.

- **9.7 Disclosure and branding.** The interview page says «Вопросы задаёт ИИ-аналитик Sai (искусственный интеллект).
  Ответы ИИ могут быть неточными — проверяйте ТЗ.» The words "Claude Code" never appear in the product; the legal pages may
  say «работает на моделях Claude (Anthropic)».

## 10. Changes to the team core (`tools/src/team`; FULL lane; guard tests change only by "was → became" tables)

| Id     | When                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Files                                                                                                           | Tests                                                                                                               |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| CORE-0 | M0 (WF-03 ISS-0093, + ISS-0058 for result files, ARC-07) | Result files byte-exact: new export `findSecrets(text)` in `tools/src/pixel-office/mask.js` (PEM `PRIVATE KEY` with or without END, `sk-`, `ghp_/gho_/ghs_`, `github_pat_`, `AKIA/ASIA` keys, JWT shape, URL credentials with a non-placeholder password; linear time; secret rules may not live in `tools/src/team`, test TM-44); `#publish` stores exact bytes or refuses (`E_WORK_FILE`, reason `secret`); sha256 of the original; `depsOf` passes exact bytes; accepted sources stay in `work/`; one acceptance helper for `runner.js` and `engine/single-run.js`; `maskSecrets` unchanged | `mask.js`, `store.js`, `runner.js`, `engine/single-run.js`, new `accept.js`, `tools/README.md` "What is stored" | new `team-result-bytes.test.js` R1–R6; TM-57, TM-58, TM-63, RF-03, SF-13 by table; Pixel Office mask rows unchanged |
| CORE-1 | M1 lane B (ISS-0065)                                     | ENGINE event time = max(clock, last ts); USER and AGENT keep ±2 000 ms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `store.js` or `reducer.js`                                                                                      | clock-step-back test; WF-01 micro-amendment of the TM-09 criterion                                                  |
| CORE-2 | M1 lane B                                                | `--bare` when `SAI_TEAM_BARE=1`; `SAI_TEAM_AUTH` = `subscription` (default, today's behaviour) / `oauth-token` (`SAI_TEAM_CLAUDE_OAUTH_TOKEN` → child `CLAUDE_CODE_OAUTH_TOKEN`) / `api-key` (`SAI_TEAM_ANTHROPIC_API_KEY` → child `ANTHROPIC_API_KEY`); bare + subscription refused                                                                                                                                                                                                                                                                                                           | `config.js`, `executors/claude-cli.js`                                                                          | argv with and without `--bare`; env per mode; EX-35 unchanged for the default                                       |
| CORE-3 | M1 lane B                                                | `--model` from `SAI_TEAM_MODEL`; fixed child variables `DISABLE_AUTOUPDATER=1`, `DISABLE_TELEMETRY=1`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` (constants, never copied from the parent)                                                                                                                                                                                                                                                                                                                                                             | same                                                                                                            | argv and env tests                                                                                                  |
| CORE-4 | M1 lane B                                                | `SAI_TEAM_ROLE_PROFILE` = `business` (default) / `software`: the planner may use only project_manager, designer, developer, reviewer; ≤ 8 tasks; no critical tasks; the developer writes product files in `site/` and lists only `REPORT-<task>.md`; reviewer and goal check read `site/` and `SPEC.md` and never edit; all prompts say `SPEC.md` is customer data                                                                                                                                                                                                                             | `role-internal.js`, `engine/plan.js`                                                                            | prompt tests; business tests unchanged                                                                              |
| CORE-5 | M1 lane B                                                | Lock bodies get `instance` (random per process) and `host`; a lock with our pid but another instance is stale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `lock.js`, `store.js`                                                                                           | restart-with-same-pid test                                                                                          |
| CORE-6 | M1 lane B                                                | `SAI_TEAM_CLAUDE_VERSION`: `claude --version` must match before the first spawn, else `E_CONFIG`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `executors/claude-cli.js`                                                                                       | version cases                                                                                                       |
| CORE-7 | M1 lane B                                                | `createEngine(id, {isAuthorized, onEvent})`: `isAuthorized()` is checked in `tick()` before `nextActions`; false → one `PROJECT_PAUSED` and no new `RUN_STARTED`; `onEvent` is called once per appended event in `seq` order                                                                                                                                                                                                                                                                                                                                                                   | `engine/engine.js`                                                                                              | `team-worker-api.test.js`                                                                                           |
| CORE-8 | M1 lane B                                                | Barrel `tools/src/team/index.js` exporting `createProject, createEngine, readEvents, readProject, ROLES, publicRole, PHRASES, FAIL_DETAIL, runStructured`                                                                                                                                                                                                                                                                                                                                                                                                                                      | new file                                                                                                        | export-list test                                                                                                    |
| CORE-9 | M1 lane B                                                | `runStructured({prompt, systemPrompt, schema, budgetUsd, cwd, env, model, signal, timeoutMs})` for text jobs, reusing the spawn, process group, stream parser and cost line of `claude-cli.js` (no new `child_process` file: TR-4c unchanged)                                                                                                                                                                                                                                                                                                                                                  | `executors/claude-cli.js`                                                                                       | fake-binary cases                                                                                                   |

Unchanged on purpose: journal text masking, the 37-event catalogue (no REQ-009 design revision), "no Bash for any
role", the env allowlist except CORE-2/3, recovery semantics. ISS-0024, ISS-0025, ISS-0040 stay open: the software
profile avoids them (parallel 1, results are reports, the reviewer reads `site/` itself).

## 11. Project Pixel Office

- **11.1 Flow.** Engine journal → `onEvent` (CORE-7) → pure projection `shared/office/project-events.js` → `POST /events` →
  `office_events` → `GET /api/projects/:id/office?after=<id>` → browser model `shared/office/model.js` → scene → canvas.
- **11.2 Projection** (anything not listed is dropped; `app/test/unit/office-projection.test.js` reads the 37 event types
  from `tools/src/team/schema.js` and fails when one has no row here)

| Engine event                                                                                                                                             | Office row                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PROJECT_STARTED`, `PROJECT_PAUSED`, `PROJECT_RESUMED`, `PROJECT_DONE`, `PROJECT_FAILED`                                                                 | `kind=project`, `category` = status                                                                                       |
| `PROJECT_STOPPED`                                                                                                                                        | `kind=project`, `category=failed` (never produced by sessions)                                                            |
| `PLANNING_STARTED` / `PLAN_RECEIVED`                                                                                                                     | `role=project_manager`, `kind=planning` / `plan`, `progress_total` = number of tasks                                      |
| `TASK_STARTED`, `RUN_STARTED{purpose: work}`                                                                                                             | `kind=work_started`, `role`, `task_no`                                                                                    |
| `AGENT_ACTIVITY`                                                                                                                                         | `kind=activity`, `role`, `activity` ∈ reading/searching/writing/thinking/other (text dropped; ≤ 1 per role per 5 s)       |
| `RUN_FINISHED`                                                                                                                                           | `kind=run_finished`, `role`, `category` = outcome (summary dropped)                                                       |
| `TASK_REVIEW`, `RUN_STARTED{purpose: review}` / `REVIEW_RESULT`                                                                                          | `kind=review_started` / `review`, `passed` (notes dropped)                                                                |
| `TASK_DONE` / `TASK_FAILED` / `TASK_RETRY` / `TASK_REASSIGNED` / `TASK_INTERRUPTED`                                                                      | `task_done` + `progress_done` / `task_failed` + `category` (a `FAIL_DETAIL` key) / `retry` / `reassigned` / `interrupted` |
| `GOAL_CHECK_STARTED` / `GOAL_CHECK_RESULT`                                                                                                               | `goal_check` / `goal_result`, `passed` (notes dropped)                                                                    |
| `TASK_WAITING_USER`, `PROJECT_WAITING` / `DECISION_RECEIVED`                                                                                             | `waiting`, `category` = reason (budget reasons → `owner_decision`) / `waiting_cleared`                                    |
| `RESULT_FILE`                                                                                                                                            | `kind=result`, count only                                                                                                 |
| worker checks (§12.1)                                                                                                                                    | `kind=checks`, `passed`, `progress_total` = total (`src=worker`)                                                          |
| session transitions (§7)                                                                                                                                 | `kind=session`, `category` = state/reason (`src=server`)                                                                  |
| `BUDGET_SPENT`, `BUDGET_SET`, `RUN_REFUSED`                                                                                                              | not office rows: `spend_ledger` (admin only)                                                                              |
| `CHAT`, `MEMORY_ADDED`, `TASK_CREATED`, `PROJECT_CREATED`, `PROJECT_RECOVERED`, `PLAN_REJECTED`, `PLAN_RETRY`, `LOCK_STALE_REMOVED`, `JOURNAL_RECOVERED` | dropped                                                                                                                   |

**Never in an office row:** task text, `done_when`, plan texts, chat, memory, review or goal notes, activity text, file
names, hashes, contents, paths, run ids, executor names, costs, internal role codes, REQ or ISS ids, CLI session ids.
Roles map to public titles in three languages; task ordinals («Задача 2 из 5») are allowed (decision 0097). A property
test puts bait strings (a key shape, a home-folder path, a URL, a 4 000-character task text) into every free-text field of
every event type and checks that none appears in the projected JSON.

- **11.3 Scene rules.** One desk per role in order of first appearance (the project manager at desk 0); a fixed sprite per
  role; states idle, working (screen glows), reviewing, waiting (sign «ждёт решения владельца»), failed (mark), done.
  Bubbles show a constant phrase for 8 s after the event's own time. Walks happen only for events newer than the page load
  (history is not replayed): project manager → role on `work_started`, role → reviewer on `review_started`. Header: session
  state, «Задача N из M», «Проверки: N из M». No event for 60 minutes while running → «нет свежих данных»; no lease heartbeat
  for 90 s → «исполнитель не на связи». Every drawn element carries the `seq` of its source row (`data-seq` on labels).
- **11.4 Renderer** (`app/public/office/`, one family for the landing and the project office). `grid.js` and `sim.js` are
  the ports of §2.1 (deterministic BFS, route queue, `after` dependency); `draw.js` draws in the approved v3 look (figures,
  desks, monitors, plates, bubbles; integer pixel scale; `fillRect`/`fillText` only; colours read once from the CSS tokens
  of the current theme); `stage-scene.js` (landing) and `project-scene.js` (events) build scenes; `view.js` is the canvas
  controller (≤ 25 fps, no drawing while hidden, `prefers-reduced-motion` → no walks); `labels.js` builds DOM labels with
  `textContent`, `role="img"` and a text list for screen readers. Pure modules have no DOM, no clock and no `Math.random`.
  The owner's staff office in `tools/src/pixel-office/` is never imported by the product (only the port-parity test reads
  the originals). The word ban of decision 0074 item 6 (`REQ-`, `handoff`, `ORCH`, `decisions`) applies to every file
  under `app/public/` (`check-public.js`).
- **11.5 Polling.** Every 2 s while the tab is visible, none while hidden, an immediate poll on `visibilitychange`; one
  request in flight; 3 s timeout; the first load gets a snapshot plus the last 200 rows.
- **11.6 Landing stage scene.** The same renderer with four desks named with the owner's stage words «Принято», «Готовим
  документацию», «Готовим спецификацию», «Готово к просмотру» (decision 0084), staffed by Sai's role titles (no invented
  names), the door and the «Вы» figure, and the caption «Картинка показывает этапы работы, а не движения людей.» The figure
  moves only on the visitor's own taps in the demo survey and in "how it works"; public pages never show agent events
  (decision 0083 item 7).
- **11.7 Not carried over from the sample:** `innerHTML`, inline `style=`, leads in `localStorage`, sequential request
  numbers and `Math.random` tokens, accents below 3:1, «Около 2 минут», «возьмём типовой вариант», a fit percentage,
  prices, the demo WhatsApp number, demo switchers, invented staff names, the kk draft texts, the snapshot that shows a
  local file path.

## 12. Result delivery and preview isolation

- **12.1 Scan and checks** (`worker/build/scan.js`; the server repeats the rules on upload). A `lstat` walk of
  `work/site/` refuses: symlinks, hard links (`nlink > 1`), special files, depth > 8, a path segment not matching
  `^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$` (so no dotfiles), more than 300 files, more than 2 MiB per file or 8 MiB in total,
  extensions outside `.html .htm .css .js .mjs .json .svg .txt .md .webmanifest .xml`, invalid UTF-8, NUL bytes, a BOM in
  HTML, a `findSecrets` hit, a home-folder path or the worker home path in the content. A refusal fails the build with a
  plain reason. Checks, reported as `{passed, total, items[]}` and shown to the owner: C1 limits; C2 path rules; C3 no
  secrets; C4 `index.html` at the root with `<meta charset="utf-8">` and a viewport meta; C5 every local `src`, `href`,
  CSS `url()` and `import` is relative and resolves inside the tree; C6 no external URL in `src`, `href` (except `<a>` to
  `https://wa.me/`, `mailto:`, `tel:`), `url()`, `import` or literal `fetch(`/`XMLHttpRequest` targets (flagged: they
  cannot load in the preview); C7 every `.js`/`.mjs` passes `node --check` (syntax only, 10 s timeout, modules through
  `--input-type=module` on stdin; nothing is executed) and every `.json` parses; C8 HTML has `<html` and `</html>`.
- **12.2 Storage.** `artifacts` + `artifact_files` (bytea) behind `BlobStore {put, get, list, delete}` (Postgres now,
  S3-compatible later, §20.6); the last 3 artifacts per project are kept, older ones deleted after 30 days.
- **12.3 Upload.** One file per request (≤ 3 MiB raw), the manifest last; the server recomputes sha256, re-applies the
  §12.1 rules and keeps the artifact `uploading` until every manifest file is stored, then `ready` (or `partial` after a
  pause). `manifest_sha256` = sha256 of the canonical JSON of the sorted `{path, bytes, sha256}` list. A Vercel Function
  body is limited to 4.5 MB (**verify**).
- **12.4 Preview host.** `PREVIEW_ORIGIN` is a second hostname of the same deployment: another `*.vercel.app` name now;
  on an own domain a different registrable domain, never a subdomain of the app. URL `<PREVIEW_ORIGIN>/api/p/<token>/
<path>`; token 128-bit, 24 h, stored as HMAC, issued only to a user with `view` (in test mode only the admin). The app
  host answers `/api/p/*` with the uniform 404; on the preview host every other path redirects to `APP_ORIGIN`. Locally
  both names share one port (`127.0.0.1` = app, `localhost` = preview). Fallback if a second hostname is impossible:
  first the second project of §19.7; `PREVIEW_ORIGIN = APP_ORIGIN` (same sandbox) only after a SECURITY-REVIEWER
  handoff and the hostile-fixture e2e on the same origin, recorded as an addition to decision 0093. Exact headers:

```
Content-Security-Policy: sandbox allow-scripts allow-forms allow-modals; default-src 'self' data: blob:;
  script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
  font-src 'self' data:; media-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; worker-src 'none';
  object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff     Referrer-Policy: no-referrer     Cache-Control: private, no-store
Cross-Origin-Resource-Policy: cross-origin     Access-Control-Allow-Origin: *     X-Robots-Tag: noindex, nofollow
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

No `allow-same-origin`, `allow-top-navigation` or `allow-popups`; never `Set-Cookie`; content types from the extension
allowlist. `Access-Control-Allow-Origin: *` is needed because module scripts and fonts of an opaque-origin page are
fetched in CORS mode. Whether `'self'` matches the subresources of a sandboxed page is proved by an e2e test in real
Chrome (PLAN M4); the fallback is the explicit preview origin in the source lists.

- **12.5 Honest limits in the UI.** Before opening: «Предпросмотр открывается в защищённом режиме: сеть и сохранение
  данных в браузере в нём не работают. Архив — для передачи и хранения; открывать его файлы на компьютере стоит только
  после проверки.»
- **12.6 Zip.** `GET …/artifacts/:aid/zip` (right `view`): built in memory with `fflate`, `manifest.json` included,
  `Content-Disposition: attachment`; a compressed body above 4 MiB (the 4.5 MB function response limit, **verify**) →
  413 with a plain message and preview-only delivery; entry sha256 equals the manifest; tested with a 7 MiB text tree.

## 13. API list

All JSON; errors are `{error: "<code>"}` with stable codes that pages map to texts in three languages. Tenant routes
resolve the organisation from the session or the resource row; a foreign or missing object gives the same 404. Route
metadata (`tenant`, `admin`, `reauth`, `worker`, `rateLimit`) lives in `server/routes/index.js`; middleware enforces it
and the isolation test enumerates it.

| Method, path                                                                                                                                | Who                                                           | Notes                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `GET /api/health`                                                                                                                           | anyone                                                        | DB ping, role selfcheck, pending migrations = 0, version   |
| `GET /api/demo/questionnaire?lang=`, `POST /api/demo/result`                                                                                | anyone, 60/h per IP hash                                      | Sai's one-tap survey; deterministic engine; stores nothing |
| `POST /api/auth/setup`                                                                                                                      | setup-token holder, once                                      | first admin + owner organisation                           |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`                                                                         | user                                                          | lockout, rate limits; `me` returns the CSRF token          |
| `POST /api/auth/password`, `POST /api/auth/reauth`                                                                                          | user                                                          | re-auth → single-use purpose token                         |
| `GET /api/invites/:code`, `POST /api/invites/:code/accept`                                                                                  | invite holder                                                 | consent sentence required                                  |
| `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id`                                                                          | member                                                        |                                                            |
| `POST /api/projects/:id/idea`                                                                                                               | member, admin                                                 | new idea version + reason                                  |
| `POST /api/projects/:id/request-development`                                                                                                | org owner                                                     | stage `dev_requested`; starts nothing                      |
| `POST …/interview/start`, `GET …/interview?after=`, `POST …/interview/answer`, `POST …/interview/finish`                                    | member                                                        | needs `ai_allowed`                                         |
| `GET …/specs`, `GET …/specs/:v`, `GET …/specs/:a/diff/:b`, `POST …/specs`                                                                   | member, admin                                                 | manual version + reason                                    |
| `POST …/specs/:v/comments`, `POST …/specs/:v/revise`, `POST …/specs/:v/approve`                                                             | member; approve: org owner, admin                             | revise → job; approve needs sha256                         |
| `POST /api/projects/:id/change-requests`                                                                                                    | member                                                        | queued for the admin                                       |
| `POST /api/projects/:id/dev/preview`                                                                                                        | admin (consumes a `dev_start`/`dev_resume` re-auth token, §5) | ceiling, duration, limits, one-time confirm token          |
| `POST …/dev/start`, `POST /api/sessions/:id/resume`                                                                                         | admin + the confirm token                                     |                                                            |
| `POST /api/sessions/:id/heartbeat`, `…/pause`, `…/close`, `GET /api/projects/:id/session`                                                   | controller; pause/close: right `stop`                         |                                                            |
| `POST /api/codes/redeem`                                                                                                                    | user, 10/h                                                    | creates a grant                                            |
| `GET /api/projects/:id/office?after=`                                                                                                       | right `view`                                                  |                                                            |
| `GET …/artifacts`, `POST …/artifacts/:aid/preview-link`, `GET …/artifacts/:aid/zip`                                                         | right `view`                                                  |                                                            |
| `GET /api/p/:token/*`                                                                                                                       | token holder, preview host only                               | §12.4 headers                                              |
| `GET /api/admin/requests?stage=`, `GET /api/admin/projects/:id`, `POST …/allow-ai`                                                          | admin (`allow-ai` with re-auth)                               | request board                                              |
| `POST /api/admin/invites`, `POST /api/admin/projects/:id/codes`, `POST /api/admin/users/:id/reset-link`, `POST /api/admin/users/:id/delete` | admin (codes with re-auth)                                    |                                                            |
| `POST /api/admin/change-requests/:id/accept`, `…/reject`                                                                                    | admin                                                         | accept → `spec_revise` job                                 |
| `GET`/`PUT /api/admin/settings` (M5), `POST /api/admin/kill-switch` (M4)                                                                    | admin (+ re-auth to change or switch off)                     |                                                            |
| `GET /api/admin/costs`, `GET /api/admin/audit?after=`, `GET /api/admin/audit/verify`, `GET /api/admin/health`                               | admin                                                         |                                                            |
| `POST /api/admin/workers`, `DELETE /api/admin/workers/:id`                                                                                  | admin + re-auth                                               | token shown once                                           |
| `/api/worker/*`                                                                                                                             | worker token                                                  | §8.2                                                       |

## 14. Security controls

- **14.1 Headers** (the same set from `server/http/headers.js` for function responses and from `vercel.json` for static
  files; a parity test compares them): `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self';
img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self';
frame-ancestors 'none'`; `Strict-Transport-Security: max-age=31536000` (HTTPS only); `X-Content-Type-Options: nosniff`;
  `X-Frame-Options: DENY`; `Referrer-Policy: no-referrer`; `Permissions-Policy: camera=(), microphone=(), geolocation=(),
payment=()`; `Cross-Origin-Opener-Policy: same-origin`; API `Cache-Control: no-store`; `X-Robots-Tag: noindex` for all of
  V1 (§19.3); no `Server` or `X-Powered-By`.
- **14.2 Input.** Bodies ≤ 64 KiB (worker events 256 KiB, files 3 MiB raw); strict UTF-8; zod schemas with unknown keys
  refused; ids checked as uuid before any query; titles ≤ 120, ideas ≤ 8 000, answers, comments and change requests
  ≤ 2 000 characters; control and invisible characters refused (`shared/text-rules.js`, parity test with the picker copy);
  SQL only with parameters (a lint test forbids template literals in `query(`).
- **14.3 Rate limits** (fixed windows in `rate_limits`; keys use `HMAC(SECRET_PEPPER, IP)` from the platform's client-IP
  header only): login 10 per 15 min per IP; 5 failures per ordinary account → 15-minute lock (the platform admin: §5, no
  lock); setup 5/h per IP; invite accept 10/h per IP; re-auth 5 failures → re-auth refused for 15 minutes; code redeem 10/h per user and per IP; project create 20/day per user; interview answers
  60/h per user; AI revisions 20/day per project; demo 60/h per IP; worker API 600/min per worker; preview 300/min per
  token; other user routes 600 per 10 min per session. Answer 429 with `Retry-After`.
- **14.4 Secrets.** Only in the host environment (Vercel "Sensitive") or the macOS Keychain (§9.6); generated by the owner
  with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; never in the repository,
  handoffs, logs, error bodies or the client bundle. RELEASE-VALIDATOR searches the diff and `app/public` for key shapes
  (`sk-ant-`, `ghp_`, `github_pat_`, `AKIA`, `PRIVATE KEY`) and env names. Rotation steps: `docs/runbooks/incident.md`.
- **14.5 Audit log.** Append-only with the hash chain (§4): every auth event, invite, project and idea change, interview
  start, ТЗ version and approval, change-request decision, AI allow, dev preview/start/pause/resume/close, session
  transition, code issue/redeem, grant revoke, kill switch, settings, worker token, preview link, admin read of tenant
  data, user delete, reset link; `details` holds only closed keys (ids, enums, numbers).
- **14.6 Prompt injection.** Customer text (idea, answers, comments, ТЗ) reaches models only as delimited data (§9.2);
  interviewer outputs must match a strict schema and the interviewer has no tools; build agents have file tools only,
  `--bare`, `SAI_TEAM_WEB=0`, cwd = the project's `work/`, `SPEC.md` read-only with a hash check, the workspace guard
  (§9.4); results are scanned (§12.1); generated code runs only in the preview sandbox; the M7 injection pack checks that
  hostile texts leak nothing.
- **14.7 Tenancy layers.** API: organisation from the session, uniform 404. Database: forced RLS behind `SET LOCAL ROLE`
  plus the role selfcheck. Files: one worker home folder per organisation (`orgs/<org_id>/`, mode 0700, ids checked as
  uuid) — on the Mac all agents run as one OS user, so this is order, not isolation; other organisations' builds run
  only on `container` workers (§8.3). Agents: one `work/` per project. Previews: per-artifact tokens on an opaque origin of another site.
- **14.8 Agent sandbox.** Mac (owner org): `--bare`, file tools only, no web tools, `--restricted`, cwd per project, the
  guard, one build at a time, spike S4 for an OS sandbox. Other organisations (M7): a container per build, non-root,
  read-only root file system except the work volume, all capabilities dropped, `no-new-privileges`, memory, CPU and pid
  limits, network only through the egress proxy (allowlist: the model API host), and the credential proxy adding the key
  (`app/deploy/egress-proxy/`, M7), so the agent never holds a real key.
- **14.9 Kill switch** (levels): (1) `platform_settings.kill_switch` from the admin console (switching it off needs
  re-auth): claims answer 204, every heartbeat answers `halt`, new AI jobs and starts are refused with «Сервис временно
  остановлен владельцем»; (2) the file `$SAI_WORKER_HOME/STOP` on the Mac; (3) the Anthropic Console workspace limit in api
  mode; (4) `SITE_GATE=closed` in the host environment closes the whole site even when the database is unreachable; on
  Vercel an env change applies only to new deployments, so it takes effect with `npx vercel@<pin> redeploy <current
production URL>`, which rebuilds with the current variables (**verify**; exact owner steps in
  `docs/runbooks/incident.md`). Sonnet
  itself can only create the STOP file (2) and ask the owner to press «Стоп всем» (1).
- **14.10 Logging and personal data.** JSON lines `{ts, level, req_id, route, status, ms, actor_kind, org_id?, job_id?,
code?}`; never request bodies, e-mails, tokens, passwords, ТЗ text, AI output or clear IP addresses; stack traces only with
  `LOG_LEVEL=debug` locally; a test greps captured logs.
- **14.11 Admin hardening.** Re-auth for dangerous actions; the admin console is not linked from public pages and answers
  the uniform 404 to non-admins; no account lock for the admin, TOTP after G20 (§5).

## 15. Cost controls

- Fences, innermost first: the run cap `min(1.5 $, 30 % of the session ceiling)` (`--max-budget-usd`); the session
  ceiling (default 5 $, `decisions/0089`); job caps (interview 1.5 $ per interview, ТЗ draft 1 $, revision 0.5 $); the
  project lifetime cap (15 $); the platform day cap (20 $) and the monthly cap set at G6; the Anthropic Console
  workspace limit as the outer fence in api mode. Also ≤ 3 sessions per project, ≤ 5 per day, ≤ 20 AI revisions per
  project per day, one build at a time.
- Before creating an AI job the app checks that every enclosing cap has room for the job's cap; otherwise the user sees
  «Лимит расходов исчерпан — решение за владельцем» and nothing starts.
- Booking: Messages API `usage`, the CLI's `total_cost_usd` and the engine's `BUDGET_SPENT` events (reported or assumed)
  go to `spend_ledger`; assumed bookings (killed attempts) are shown separately; a graceful pause is preferred over a
  halt.
- Alarms at 80 % and 100 % of the day or month cap: a banner in the admin pages; at 100 % new AI jobs are refused and
  running builds get `halt`.
- Owner-local runs have a notional cost; they are counted the same way (they also use the owner's plan limits).
- `/admin/costs`: per day, project, mode and model; reported vs assumed. Nobody but the owner raises a cap.

## 16. Observability

Request logs as §14.10 with `X-Request-Id`; `error_events` in the database, because Hobby keeps runtime logs for one hour
(**verify**); `GET /api/health` for smoke and uptime checks; the admin page «Состояние» (workers with mode, version and
last seen; queue counts and the oldest queued age; sessions by state; spend against the caps; errors of 24 h; the kill
switch); worker logs as JSON lines without secrets. Release check: `node scripts/smoke.js --base <APP_ORIGIN> --preview
<PREVIEW_ORIGIN> --expect-version <sha>` (status, headers, health, version, the 404 shape, noindex, the preview redirect).

## 17. Languages (ru, kk, en)

- Texts in `shared/i18n/texts.js` as key → `{ru, kk, en}`; every key has all three (test). Choice: `?lang=` → stored
  choice (`localStorage['sai-lang']` inside try/catch) → the user's language → `ru`; never `Accept-Language`.
  `PUBLIC_LANGS` hides kk on production until G9; tests and local runs show all three.
- Rules from the picker (`text-rules.js`): at most 18 words per UI phrase, the polite «вы» form, no control or invisible
  characters. The forbidden-words lint (the idea of REQ-086) covers all of Sai's public texts: no guarantees,
  «бесплатно», minutes, «100 %», prices or terms.
- Formats (`shared/format/kz.js`, the REQ-079 rules): `27.10.2026, 18:53` in Astana time (UTC+5), digit groups with
  U+202F, `1 250 000 ₸` with U+00A0 before ₸, no `Intl`. Themes «Авто / Светлая / Тёмная»; text contrast 4.5:1, accents
  3:1.
- Server errors are codes; pages map them to texts. AI output uses the project language chosen at creation (ru or en in
  V1; kk AI output is not offered).
- Translations are written by the coding role and read by independent reader agents (two to three rounds,
  `decisions/0079` item 7; one round in the light lane). **Native-reader rule:** Kazakh goes public only after a human
  native reader's pass or the owner's explicit «публикуй как есть» (G9; decision 0083 item 8).

## 18. Testing strategy

| Level         | Where                                                                                           | What                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit          | `app/test/unit` (`node:test`, in `check`)                                                       | pure modules: session machine (every pair), diff, spec validator, projection (37 types + bait property), office model, formats, text rules, caps arithmetic, controls; header parity; vendored and port parity; import boundaries; CI-workflow hardening; no string SQL; `dev-job-origin` (only `server/services/sessions.js` enqueues `build` jobs, grep over `server/` and `worker/`)         |
| Integration   | `app/test/int` (PGlite, in `check`)                                                             | every route through `createApp` with a real SQL database: auth, CSRF, isolation enumeration over the route table (fails on an unlisted route), jobs, sessions, limits, artifacts, previews, kill switch, audit chain; failure tests with unchanged state (row counts, sha256); the worker loop in-process against the app with fake providers, fake `claude` binaries and the scripted executor |
| Real Postgres | `app/test/pg` (CI, service container `postgres:17@sha256:<digest>`)                             | 20 parallel claimers get 20 distinct jobs; racing starts and approvals; RLS completeness and role selfcheck; migrations from empty and from the previous release's schema                                                                                                                                                                                                                       |
| Core          | `tools/test`                                                                                    | CORE-0…CORE-9 tests; every existing test stays green or changes by a "was → became" table                                                                                                                                                                                                                                                                                                       |
| E2E           | `app/test/e2e` (playwright-core from `node:test`, one browser, `--test-concurrency=1`)          | landing matrix; the chain (invite → … → preview + zip) with fake AI and the scripted executor; preview isolation with a hostile fixture site; office polling; two organisations                                                                                                                                                                                                                 |
| Acceptance    | UAT-RUNNER in real Chrome with a fresh temporary profile                                        | windows 1470×784, 390×844, 320×568; light and dark; ru and en (kk in tests); snapshots outside the project                                                                                                                                                                                                                                                                                      |
| Real runs     | only with G2, recorded in `docs/uat/`                                                           | P1, interview, build, revision, P2, the production chain                                                                                                                                                                                                                                                                                                                                        |
| Mutation      | CODE-DESIGN-VALIDATOR ≥ 10, TEST-DESIGN-VALIDATOR ≥ 20, RELEASE-VALIDATOR ≥ 5 in the light lane | in a fresh clone outside the project                                                                                                                                                                                                                                                                                                                                                            |

Rules: tests never reach the network (outbound `fetch` is stubbed; an unexpected call fails the test); servers bind port
0; temporary folders outside the project; resources closed in `t.after` (AP-116); no `skip` or `todo`; clocks injected;
counts and hashes instead of deep comparisons of big structures (AP-124).

**CI `.github/workflows/app.yml`** (separate from `check.yml`): trigger `push` to `main` with `paths: [app/**,
tools/src/team/**, tools/src/pixel-office/mask.js, .github/workflows/app.yml]` (handoff-only commits skip it; the
private repository's Actions minutes are limited, PLAN §0.7); `permissions: contents:
read`; actions pinned by SHA; no secrets, no `pull_request_target`; jobs `check` (`cd tools && npm ci`, then
`cd app && npm ci && npm run check`), `pg`, `e2e` (Chromium), `docker` (build `app/Dockerfile`,
`docker compose -f app/compose.yaml up -d --wait`, smoke against `127.0.0.1:8080`; from M7 also the chain e2e against
it), `migration-rehearsal` (§20.4). Its hardening and paths are pinned by `app/test/unit/ci-workflow.test.js`.

## 19. Deployment on Vercel

- **19.1 Owner setup (G3; `docs/program/public-v1/vercel-setup.ru.md`).** Part 1 (any time, nothing deployed): a Vercel
  account (Hobby) signed in with the GitHub account that owns the repository; `npx vercel@<pin> login` once in a folder
  outside the sai folder (the credential stays in the CLI's own store); the project created by him (`npx vercel@<pin>
project add <name>` or the web UI without a Git import; framework "Other", Node.js 22.x, region `fra1`); Neon from the
  Marketplace on that project (free, `aws-eu-central-1`; it injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`); the
  values of §19.3 typed by him; he says the e-mail of the account that owns the team and the project and team ids
  (`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, not secret) for `PROGRESS.md`. Nobody runs `vercel link` inside the
  repository, so no `.vercel/` or `app/.gitignore` appears there. The second domain `<name>-preview.vercel.app` is added
  only after G4. No Git integration. Deployment Protection "Standard". Part 2 (M2): the admin bootstrap and the UAT login.
- **19.2 `app/vercel.json`** (shape): `framework: null`; `buildCommand: "npm run vercel-build"`; `outputDirectory:
"public"`; `regions: ["fra1"]`; `functions: {"api/index.js": {maxDuration: 30}}`; `rewrites: [{source: "/api/(.*)",
destination: "/api"}]`; `redirects`: on the preview host (`has: [{type: "host", value: "<preview host>"}]`) every path
  except `/api/p/` → 307 to `APP_ORIGIN` (the host names are configuration, not secrets); `headers`: the §14.1 set for
  static paths. `app/.vercelignore` is an allowlist: `api/`, `server/`, `public/`, `content/`, `scripts/`, `db/`,
  `package.json`, `package-lock.json`, `.npmrc`, `vercel.json`; `worker/`, `test/` and Docker files never upload.
- **19.3 Environment variables** (Production). Values that must change without a redeploy — `test_mode`,
  `registration_mode`, `public_langs`, the kill switch — live in `platform_settings` (admin + re-auth); the static
  `X-Robots-Tag: noindex` of `vercel.json` stays for all of V1 and changes only by a release.

| Name                                           | Secret      | Value                                                                                 |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`        | yes         | set by the Neon integration; the unpooled URL is used only by migrations in the build |
| `APP_DB_PASSWORD`                              | yes         | only if spike S3 needs the dedicated login role (§4)                                  |
| `APP_ORIGIN`, `PREVIEW_ORIGIN`                 | no          | `https://<name>.vercel.app`, `https://<name>-preview.vercel.app`                      |
| `SECRET_PEPPER`                                | yes         | 32 random bytes, base64url (§14.4)                                                    |
| `SETUP_TOKEN_HASH`                             | no (a hash) | from `scripts/setup-token.js`; removed by the owner after `/setup`                    |
| `SITE_GATE`                                    | no          | empty; `closed` = emergency close (needs a redeploy, §14.9)                           |
| `TRUST_PROXY`, `LOG_LEVEL`, `MIGRATE_ON_BUILD` | no          | `vercel`, `info`, `1`                                                                 |

Never in Vercel: any Anthropic key, any Claude login, a worker token. Worker settings (Mac, launch environment; secrets
only from the Keychain): `SAI_APP_URL`, `SAI_WORKER_MODE`, `SAI_WORKER_HOME` (default `~/.sai-worker`),
`SAI_WORKER_CONCURRENCY=1`, `SAI_WORKER_IDLE_EXIT_MIN=60`, `SAI_CLAUDE_BIN`, `SAI_CLAUDE_VERSION`, `SAI_MODEL`,
`SAI_TEAM_REAL_RUNS`.

- **19.4 Region.** Functions in `fra1` next to Neon `aws-eu-central-1` (Vercel's rule: functions in the database's
  region). There is no Central Asian region; latency and reachability from Kazakhstan are measured (PLAN M1, M7).
- **19.5 Deploy path (decision 0092).** RELEASE-FINALIZER, after RELEASE-VALIDATOR PASS, the push, and `check.yml` and
  `app.yml` green on the pushed sha:

```
git clone --quiet <origin URL> <outside the project>/deploy-<sha>     # fresh clone: no ignored or uncommitted file
test "$(git -C <clone> rev-parse HEAD)" = "<pushed sha>"
test "$(git -C <clone> log -1 --format=%ae)" = "<team owner e-mail from PROGRESS.md>"   # Hobby commit-author rule
cd <clone>/app && VERCEL_ORG_ID=<id> VERCEL_PROJECT_ID=<id> npx vercel@<pin> deploy --prod --yes --env APP_VERSION=<sha>
node scripts/smoke.js --base <APP_ORIGIN> --preview <PREVIEW_ORIGIN> --expect-version <sha>
# then remove the clone; PROGRESS.md is updated after this step
```

Uncommitted lane-B files and ORCH's bookkeeping never reach production, because only the clone is uploaded. Exact CLI
flags (and whether the project ids replace a linked `.vercel/`, **verify**) are fixed by spike S1 in
`docs/runbooks/release.md`. **Hobby rule:** deploying a commit needs its author to be the owner of the Vercel team; the
author e-mail is compared with the one recorded at G3, agents never change `user.name`/`user.email` and no bot authors a
deploying commit; a mismatch or a git-author refusal is a stop and an owner action.
Rollback: `npx vercel@<pin> rollback <previous production URL> --yes`, or Instant Rollback by the owner; the database
stays (expand-only migrations). Preview deployments are not used in V1 (UAT runs on the local Node server); a spike that
needs one, after G4, uses `vercel deploy` without `--prod` (protected) with Preview variables on a Neon `preview` branch.
**Owner alternative (only his choice):** the Git integration — the Vercel GitHub App on this repository only (read and
write on Contents, Administration, Workflows and more), Root Directory `app`, production branch `main`, auto-assign of
production domains off with manual promotion after both workflows are green, an Ignored Build Step that compares with
the previously deployed sha (not `HEAD^`); the commit-author rule then applies to every pushed commit.

- **19.6 Migrations.** `vercel-build` = `node server/db/migrate.js` (when `MIGRATE_ON_BUILD=1`; `DATABASE_URL_UNPOOLED`;
  advisory lock), then `node scripts/check-public.js`. A failed migration fails the build and the previous deployment stays
  live. No agent ever holds the production database URL.
- **19.7 Spikes and fallbacks** (PLAN M1.2, M4; S1–S3 only after G4, on the owner's project: its first deployment is the
  closed page of the first release; S2 runs on the two production hostnames G4 named). S1: function entry shape (`export default app.fetch` vs `handle(app)` from
  `hono/vercel`), the path the function sees after the rewrite, `outputDirectory` for a framework-less project, CLI flags
  (`--prod`, `--env`, `rollback`), git metadata and the author check of CLI deploys, marking env values Sensitive. S2: a
  second `*.vercel.app` hostname on the same project and the host-conditional redirect; fallback: a second project from the
  same `app/` serving only `/api/p/*`, or the same-origin sandbox of §12.4. S3: Neon role attributes, `SET LOCAL ROLE` and
  `set_config(…, true)` through the pooler; fallback: the dedicated login role of §4. S4 (Mac, M4):
  `@anthropic-ai/sandbox-runtime` and `--disallowedTools` read-deny syntax with the pinned CLI. Results are appended to
  decisions 0001 and 0093.

## 20. Portability and the migration runbook

- **20.1 Rules that keep the move cheap.** One Hono app with two thin entries; static files are plain files; all state is
  in Postgres; artifacts go through `BlobStore`, e-mail through `Mailer`; no cron (lazy expiry); configuration is env plus
  `platform_settings`; origins only from env, cookies `__Host-` without a domain attribute, so a domain change is
  configuration; the worker reaches the app by URL only.
- **20.2 Images.** `app/Dockerfile` (web): `node:22.23.4-bookworm-slim@sha256:<digest>`, `npm ci --omit=dev`, non-root,
  `ENV PORT=8080`, `EXPOSE 8080`, entrypoint `node server/db/migrate.js && node server/node-main.js`, health check on
  `/api/health` (locally, with `PORT` unset, the server binds port 0 and prints its URLs); compose `web` sets
  `PORT=8080` too, and the `docker` CI job asserts it. `app/Dockerfile.worker` (context = repository root): the
  same base, `tools/src/team`, `tools/src/pixel-office/mask.js`, `app/{worker,public/shared,package*.json}`, the pinned
  CLI, non-root; run with `--cap-drop ALL --security-opt no-new-privileges --read-only --tmpfs /tmp --pids-limit 256`.
- **20.3 `app/compose.yaml`.** `db` (`postgres:17@sha256:<digest>`, volume), `web` (app and preview on two host names,
  port 8080, depends on a healthy db), profile `worker` with `egress-proxy` (worker on an internal network; only the proxy
  reaches the internet; the credential proxy injects the key), profile `edge` (Caddy with automatic TLS for both names).
- **20.4 Rehearsal.** CI job `migration-rehearsal` on every push: seed Postgres through the e2e chain → `pg_dump
--format=custom --no-owner --no-acl` → `pg_restore` into a fresh container → `node scripts/db-verify.js --a <url>
--b <url>` (row counts and sha256 of ordered ids per table, sha256 of every `artifact_files` row, equal
  `schema_migrations`) → app smoke and role selfcheck. Once by hand in M7 (`docs/uat/<RUN-ID>-restore.md`).
- **20.5 Moving the database** (Neon → any Postgres 17, e.g. in Kazakhstan). Create the target with the same extensions
  and the roles of §4; rehearse §20.4 against it; cut-over: kill switch on (builds paused, state kept),
  `platform_settings.read_only = true` (writes answer 503 «идёт переезд»), final dump with `DATABASE_URL_UNPOOLED`,
  restore, `db-verify`, start `web` on the new host, smoke and the chain e2e with a test organisation. The dump holds
  personal data: kept encrypted outside the repository and deleted after the move.
- **20.6 Blobs.** Artifact bytes live in Postgres, so they move with the dump. When stored files pass about 1 GB, or the
  new host offers S3-compatible storage, switch `BlobStore` to the S3 adapter and copy rows with a one-off script that
  verifies every sha256 (a later requirement).
- **20.7 DNS cut-over and rollback.** 48 h before: record TTL 300 s; the new host runs the same images with both origins
  on the new domain (the preview on its own registrable domain, §12.4), TLS for both, smoke on a temporary hostname.
  Cut-over: §20.5, switch the records, check from two Kazakh networks, new `SAI_APP_URL` and worker tokens, kill switch
  off; users sign in again. The old deployment stays read-only with a banner for 7 days. Rollback while nothing was
  written on the new host: DNS back, `read_only = false` on the old host; after writes, a reverse dump/restore.
- **20.8 Reachability fallback (F8).** If the owner's networks cannot open the Vercel URL: (1) retry through another
  `*.vercel.app` name and a non-`.kz` custom domain on Vercel; (2) if still blocked, run the compose stack on a Kazakhstan
  VPS with Caddy behind a non-`.kz` domain, keeping Neon or moving it by §20.5 (the compliance path anyway; needs G14/G15
  money); (3) never announce the site before the check passes from his home and mobile networks.
- **20.9 Domain and compliance.** While anything runs on Vercel, only a non-`.kz` domain: a `.kz` domain and its
  subdomains must point to servers physically in Kazakhstan. The move to Kazakhstan hosting is the path to Law 94-V
  art. 12(2) for personal data; the owner's lawyer confirms the scope (G7). Candidate providers to compare on the day:
  PS Cloud Services, Yandex Cloud Kazakhstan region, Hoster.kz, QazCloud (**verify** offers and prices).
