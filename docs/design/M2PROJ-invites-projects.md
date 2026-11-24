# M2PROJ — code design: organisations and invitations (REQ-116) and projects with the request board (REQ-117)

Run `M2PROJ-20261124-01`, WF-02 step 1 (CODE-DESIGNER, handoff `handoffs/M2PROJ-20261124-01/step-01-code-designer.json`),
task M2.3 of PLAN M2: one build of two requirements that are released together. The contract is the blocks REQ-116
(10 criteria) and REQ-117 (12 criteria) of `docs/requirements.yaml` as they stand on the base. Base of the run: the tag
`base/M2PROJ-20261124-01` (commit 60b10b7); its `app/` and `.github/` are byte for byte those of main 6078bfb, whose
app.yml run 45325040037 is the last green one (F1). The code of M2.2 is the ground this design stands on:
`docs/design/M2AUTH-accounts-tenancy-backup.md` (cited as «M2AUTH» with its section numbers, e.g. M2AUTH 4.7) and the
code of `app/` read at the base (the code is the fact). Decisions that bind this design: 0001 (stack), 0091 (frozen PLAN
and ARCH: changes as «Plan amendments» rows), 0100 (personal data minimum), 0110 and 0129 (checks run on GitHub only),
0127 И and К (four roles), 0133 and 0134 (the goal path of the first client), 0135 (О3, О4, О8, О12, О13, О15, О16),
0136 (О16: the narrow exception of the public word lists) and 0137 (O11 and Additions 1-7).

This file holds shapes, signatures, tables, closed lists and rules. It holds no implementation code (the SQL of 4.2 is
a column list with constraints, not the migration file). Values are marked **[M]** measured (fact number of section 1),
**[R]** required by a block, a decision or ARCH, **[P]** proposed here with its reason (a disputable [P] is a question
of section 13). Nothing under `app/`, `tools/` or `docs/` but this file and the handoff's `result` was written by this
step.

---

## 0. Summary

**What is built.** An invited person opens the link the owner sent, types a name, the e-mail of the invitation and a
password, ticks the consent sentence and is signed in as a member of his organisation (REQ-116); he presses «Новый
проект», types a title and his idea, taps three quick facts and sees his project page with the stage strip (REQ-117); the
owner sees every request on his board by stage, opens the card, corrects it with «Изменить заявку» (a new idea version
with «Почему») and reads the audit log. Every date and number on these pages is in the Kazakhstan format.

**The one hard question, settled here (decisions/0137 О11).** The audit writer runs only under platform settings
(`appendAudit` throws under tenant settings, 0137 Addition 4), while a tenant route's handler runs under tenant settings
after the switch of M2AUTH 4.7 step 9b. The audit row of a tenant action must still commit with the action. Settled
(C1): a tenant route that writes gets a **plan** (a new function stored beside the row, 4.4): the pipeline runs it on the
platform part of the one request transaction, **before** `switchToTenant`; the plan reads and locks what it needs with an
explicit organisation filter, checks the role, decides the facts the audit row needs (the new project id, the next idea
version number) and returns the audit entry; the pipeline appends that entry (organisation, actor and address come from
the session and the request, never from the plan) and only then switches to tenant settings and runs the handler, which
does the action under row-level security. One transaction, one connection, no way back from tenant to platform.

**Build.** Migration `0003_projects.sql` (4 tables, 2 columns and a check on `invites`, 2 widened checks, 1 guard trigger), `grants.sql`
extended, 14 new routes (7 admin, 4 tenant, 2 public invite, 1 account), the plan hook in the pipeline, two services
and two stores, four shared pure modules, ten pages, the consent exception of the public word lists, the rehearsal seed
for 0003.

Files the code adds: 9 server and db files and 1 rehearsal seed, 4 shared modules, 10 pages with 10 scripts (section 3);
15 backend files and 8 frontend files change. Criteria mapped: 22 of 22 (section 7). New tests: 79, 73 of them in 12 new
files and 6 in existing files (section 7.3). Mutants: 74 numbered and a group (section 11). Open questions: 10 (section 13),
each with a recommendation; none is settled by a guess.

---

## 1. Checked facts (command, output, date)

All sketch runs are on the trial clone of section 14 (a fresh clone of the base, `npm ci` in `app/`), dates UTC.

| # | Fact | Command and output | Date |
| --- | --- | --- | --- |
| F1 | The tag `base/M2PROJ-20261124-01` is 60b10b7; `app/` and `.github/` of 60b10b7 equal those of main 6078bfb; the last green app.yml run on main is 45325040037: check job unit 152 tests, int 126, pg job 21, e2e job 15, each `# fail 0`, `# skipped 0`, `# todo 0`; jobs check, pg, docker, migration-rehearsal and e2e all success | `git rev-parse base/M2PROJ-20261124-01` → 60b10b72…; `git diff --stat 6078bfb 60b10b7 -- app .github` → empty; `gh run view 45325040037 --log \| grep -E "# (tests\|fail\|skipped\|todo) "` → 152/0/0/0, 126/0/0/0 (check), 21/0/0/0 (pg), 15/0/0/0 (e2e); `gh run view 45325040037 --json jobs` → five success | 2026-11-24 |
| F2 | The route table has 15 rows (the two demo rows, health, seven auth rows, five admin rows); `AUTH_CODES` 23 codes, `MAC_LABELS` 10, `PURPOSES` 11, `LIMITS` 4 (setup, login, reset, user), the closed audit `ACTIONS` 14; a route row has exactly the keys handler, meta, method, path (the body shape is kept beside it in a WeakMap, `withBody`) | `node sketch/t5.mjs` (reads `routeTable`, `AUTH_CODES`, `MAC_LABELS`, `PURPOSES`, `LIMITS`; its audit count 21 includes the 7 actions its own sketch edit added to the clone) → `routes 15 …`, `AUTH_CODES 23 MAC_LABELS 10 PURPOSES 11`; read `app/server/http/schema.js` (`SHAPES`), `app/test/unit/route-table.test.js` (`metaFindings`) | 2026-11-24T16:40Z |
| F3 | A JSON boolean in a body is refused by `parseBody` as `bad_body` (every field kind is a string kind), so `consent: true` needs a new field kind | `node sketch/t5.mjs` → `boolean in a body bad_body` | 2026-11-24T16:40Z |
| F4 | The pipeline runs one platform transaction per request and switches it to tenant settings at step 9b, before the handler; `appendAudit` throws a TypeError «the writer runs only under platform settings» unless `app.role` is `platform` | read `app/server/http/auth-mw.js` (steps 9b, 10), `app/server/services/audit.js` (`appendAudit`), `app/server/db/audit-store.js` (`currentAppRole`) | 2026-11-24 |
| F5 | **[O11]** In one `withPlatform` transaction: `appendAudit` (platform), then `switchToTenant(A)`, then an INSERT of a project and its idea version under row-level security: committed together (audit 1, projects 1, versions 1, `verifyAudit` ok); inside, `current_user` sai_app, role tenant, org A. The same with an invalid project row (title empty) after the audit row: rolled back whole (audit 1, projects 1, versions 1 as before, SQLSTATE 23514) | `node sketch/t1.mjs` → `inside after switch {"u":"sai_app","r":"tenant","o":"<A>"}`, `committed {"a":1,"p":1,"v":1,"verify":{"ok":true,"count":1}}`, `failing action "E_DB_QUERY/23514"`, `after failing {"a":1,"p":1,"v":1}` | 2026-11-24T16:35Z |
| F6 | **[0003]** A trial `0003_projects.sql` applies on 0001 + 0002 through the real runner with a grants file holding the new blocks; `audit_log_action_check` and `reauth_tokens_purpose_check` are the names Postgres gave the column checks (drop and add work); the new action `admin_read` and the purpose `user_delete` are accepted, an action outside the list is refused (23514) | `node sketch/t1.mjs` → `migrate applied [0001…,0002…,0003…]`, `audit new action "no error"`, `an action outside the list "E_DB_QUERY/23514"`, `reauth purpose user_delete "no error"` | 2026-11-24T16:35Z |
| F7 | **[0003]** Row-level security on `projects` and `idea_versions`: tenant B sees 0 rows of A's project; a tenant write of a foreign organisation is refused (42501); with no organisation and no role set the read sees 0; the composite foreign key refuses a version of organisation B for A's project (23503); a version 1 with a reason and a version 2 without one are refused (23514); the five tables with an `org_id` column are `audit_log`, `idea_versions`, `invites`, `org_members`, `projects`, each with row security enabled and forced | `node sketch/t1.mjs` → `tenant B sees 0`, `tenant B foreign insert "E_DB_QUERY/42501"`, `no org sees 0`, `composite fk "E_DB_QUERY/23503"`, `version 1 with reason … 23514`, `version 2 without reason … 23514`, `org_id tables [… five rows, rls true, frc true]` | 2026-11-24T16:35Z |
| F8 | **[0003]** The insert-only trigger of `idea_versions` (a row trigger BEFORE UPDATE OR DELETE and a statement trigger BEFORE TRUNCATE): as the migration role UPDATE, DELETE and TRUNCATE are refused (P0001); a DELETE passes only when the transaction-local setting `app.purge_org` equals the row's organisation (a setting of another organisation: P0001); as `sai_app` without an UPDATE grant an UPDATE is refused at the privilege (42501) and a DELETE without the setting by the trigger (P0001); the purge form (set the setting, delete the versions, delete the projects of that organisation) removes 1 version and 1 project and the setting is empty after the transaction | `node sketch/t2.mjs` → `owner update E_DB_QUERY/P0001`, `owner removal …/P0001`, `owner truncate …/P0001`, `owner removal with the purge setting no error`; `node sketch/t1.mjs` → `delete refused …/P0001`, `delete with the setting of another org …/P0001`, `update with the setting of the own org …/42501`, `purge {"versions":1,"projects":1}`, `setting after the transaction ""` | 2026-11-24T16:35Z |
| F9 | **[0003]** The users guard (a trigger BEFORE UPDATE OF `is_owner_identity`) refuses setting the flag false for a member of the owner organisation (P0001); the 0002 trigger refuses a non-owner-identity member of the owner organisation (P0001); the `invites` rule `(org_id is null) = (org_name is not null)` refuses a new-organisation invite without a name and an existing-organisation invite with one (23514) and accepts a named new-organisation invite | `node sketch/t1.mjs` → `flip owner identity of an owner-org member …/P0001`, `owner org insert of a non owner identity …/P0001`, `invite new org without a name …/23514`, `invite existing org with a name …/23514`, `invite new org with a name "no error"` | 2026-11-24T16:35Z |
| F10 | **[0003]** The grants file of 4.2.4 (the 0002 blocks with `org_members` and `invites` widened, and the four new blocks) gives `sai_app` exactly: deletion_requests INSERT,SELECT,UPDATE; idea_versions DELETE,INSERT,SELECT; invites DELETE,INSERT,SELECT,UPDATE; org_members DELETE,INSERT,SELECT; orgs INSERT,SELECT; projects DELETE,INSERT,SELECT,UPDATE; user_consents INSERT,SELECT | `node sketch/t1.mjs` → `grants [{…deletion_requests INSERT,SELECT,UPDATE…idea_versions DELETE,INSERT,SELECT…invites DELETE,INSERT,SELECT,UPDATE…org_members DELETE,INSERT,SELECT…orgs INSERT,SELECT…projects DELETE,INSERT,SELECT,UPDATE…user_consents INSERT,SELECT}]` | 2026-11-24T16:53Z |
| F11 | **[version numbers]** Five parallel edits of one project, each in one platform transaction that locks the project row (`select … for update` with the organisation filter), takes `max(version) + 1`, switches to tenant settings and inserts the version, get 2, 3, 4, 5, 6; stored versions 1…6, no gap, no duplicate. PGlite serialises transactions (M2AUTH F9), so this shows the logic only; the row lock under real concurrency is proved by the pg job (M2R-2) | `node sketch/t4.mjs` → `parallel edits got versions [2,3,4,5,6]`, `stored versions [1,2,3,4,5,6]` | 2026-11-24T16:36Z |
| F12 | **[consent]** The ru, kk and en drafts of section 4.8 have five phrases each; words per phrase ru 12, 13, 6, 12, 13; kk 11, 15, 6, 9, 13; en 17, 15, 9, 18, 15 (all ≤ 18); `textProblem` null and no forbidden sign in each; the lint of `word-lists.js` finds exactly one form in each language, list Ц, in the fifth sentence («дней», «күні», «days»), and nothing after the deletion-term phrase is taken out once; the six tokens of the kk criterion stand in the kk text. sha256 of the five sentences joined by one space: ru 8da00909…34e1, kk 47fc3d17…7a85, en cc354b3b…8cb3 (the tests compute their own) | `node sketch/t3.mjs` → `ru phrases / words per phrase [5,[12,13,6,12,13]]`, `kk … [5,[11,15,6,9,13]]`, `en … [5,[17,15,9,18,15]]`, `ru lint without the exception ["Ц:дней"]`, `kk … ["Ц:күні"]`, `en … ["Ц:days"]`, `… term occurrences / lint after the exception [1,[]]` (three times), `kk tokens [true×6]` | 2026-11-24T16:36Z |
| F13 | **[KZ formats]** An own days-from-civil arithmetic (no Date) at UTC+5 reproduces the seven date rows of REQ-117 criterion 7 and the number rows (0, 999, 1 000, 1 250 000 with U+202F); 5 000 seeded moments from 1970-minus-31-years to 2128 agree with the fields of `Date` shifted by five hours | `node sketch/t3.mjs` → `kz rows [[true,…]×7]`, `kz numbers ["0","999","1_000","1_250_000"]`, `kz 5000 moments differing from Date fields 0` | 2026-11-24T16:36Z |
| F14 | The open build writes the texts module again with only the public languages (kk values gone) and without the `order_` keys; the language list of the server's own demo is `PUBLIC_LANGS` (ru, en) on the function entry; so on production the server's copy of the consent texts has no kk value | read `app/scripts/public-set.js` (`writePublicSet`, the module rewrite), `app/server/app.js` (`createFunctionApp`) | 2026-11-24 |
| F15 | A failed statement is a `DbError` code `E_DB_QUERY` that carries the SQLSTATE (`sqlstate`), so a unique violation (23505) can be mapped to a named refusal in the same transaction (which is aborted and rolled back) | read `app/server/db/index.js` (`DbError`, `toDbError`) | 2026-11-24 |
| F16 | **[conflict, question О1]** `db-calls.test.js` DBC-1 forbids `.query(`, `.exec(` and `.transaction(` in every file of `app/server` and `app/api` outside `app/server/db/`; REQ-117 criteria 3 and 9 print `update projects` and `delete from idea_versions` as lines of `app/server/services/projects.js` only. Both cannot hold with the statement text in one file and the call in another unless the statements stand in `app/server/db/` | read `app/test/unit/db-calls.test.js` (`callFindings`), `docs/requirements.yaml` REQ-117 criteria 3 and 9 | 2026-11-24 |
| F17 | `isolation.test.js` IS-1 sends the body `{}` on every non-GET object route, so a strict body shape would answer 400 before the 404 it expects for POST `…/:id/idea`; IS-4 adds the keys `org_id` and `orgId` to every non-GET route and expects 400 `bad_body`, so no route body of this block may have a key of those names (the admin invite names its organisation key `organisation`) | read `app/test/int/isolation.test.js` lines 575-580 (`opt`), 753-800 (IS-4) | 2026-11-24 |
| F18 | `node-main.js` derives the app origin from the real port (`originsFor(config, port)`), so a server started with `PORT=0` has the origin `http://127.0.0.1:<port>` and the cookie `sai_s`; `startNode` gives a child only `PATH` and the given variables, so the e2e test passes `SECRET_PEPPER` and `SETUP_TOKEN_HASH` itself; with no `DATABASE_URL` the runtime database is a fresh in-memory PGlite | read `app/server/node-main.js`, `app/test/fixtures/helpers.js` (`startNode`), `app/test/fixtures/browser.js` (`serveLocal`) | 2026-11-24 |
| F19 | The lazy cleanup deletes `rate_limits` rows with `window_start` older than 24 h; a 24-hour window row has `window_start` greater than `now − 24 h` for every `now` inside it, so a live daily window is never cleaned (arithmetic on `floor(now / 86400000) * 86400000`) | read `app/server/db/auth-store.js` (`cleanup`), `app/server/http/rate-limit.js` (`countRequest`) | 2026-11-24 |
| F20 | Guard greps (section 9): `tools/test` and `tools/src` name no `app/db`, `app/server` or `app/public` path; every `app/test` line that turns red from this work is in the table of section 9 | `grep -rln "app/db\|app/server\|app/public" tools/test tools/src` → empty; the greps of section 9 over `app/test` | 2026-11-24T16:41Z |
| F21 | The existing pages keep the structure PP-2 checks and put the ru text in the HTML (`data-t` keys, a ru fallback), so a page that holds the five consent sentences as HTML text would hold «дней» in a page text that the page lint reads; the consent elements of `invite.html` are therefore empty in the HTML and filled from the texts module | read `app/public/login.html`, `app/scripts/check-public.js` (the lint of page text), `app/test/unit/public-pages.test.js` | 2026-11-24 |
| F22 | **[statements]** `insert into deletion_requests … on conflict (user_id) where closed_at is null do nothing returning id` returns one row the first time and none the second time; after the open request is closed a new request returns a row again; the table then holds 2 rows, 1 open; the stale-invite statement `delete from invites where used_at is null and expires_at < $1::timestamptz` runs under `sai_app` with the `invites` DELETE grant | `node sketch/t6.mjs` → `first returns a row 1 second returns a row 0`, `after closing, a new request returns a row 1`, `rows [{"n":2,"open":1}]`, `cleanup statement runs under sai_app, deleted 0` | 2026-11-24T16:53Z |
| F23 | **[P3, rework 01c]** The repaired step 9a formula on the real writer: the entry is built from the session (organisation, actor kind, actor, address), the plan's `audit` must have exactly the keys `action`, `targetKind`, `targetId`, `details`; a plan with an extra `orgId`, `actorKind`, `actorId` or `ip` key, and one with `details` missing, throws a `TypeError` before any statement and `audit_log` keeps its 1 row, 0 of them of the other organisation; the good plan commits one row | `node sketch/t7.mjs` → `good plan committed {"n":1,"b":0}`, four lines `plan with <key> TypeError: plan: a key outside action, targetKind, targetId, details {"n":1,"b":0}`, `plan missing details TypeError: plan: a missing key {"n":1,"b":0}` | 2026-11-24T17:15Z |

Not measurable on this PC (no Postgres binary, decisions/0110): the row lock of the version number and of the invite
claim under real concurrency (M2R-1, M2R-2, M2R-3 in the pg job); that the trigger and the policies behave the same on the
Neon owner role (they are a trigger and policies, which fire and apply for every role; the pg job runs them on Postgres 17).

---

## 2. Choices (the disputable ones are questions of section 13)

| # | Choice | Reason | Alternative |
| --- | --- | --- | --- |
| C1 | **[O11, proposal for a decisions record]** A tenant write route has a **plan**: `withPlan(row, plan)` (new file `app/server/http/plan.js`) keeps the function beside the row in a WeakMap, like `withBody`, so a row keeps exactly the keys method, path, meta, handler (F2). The pipeline runs it at the new step 9a, on the platform settings of the request transaction, appends the returned audit entry with the session's organisation and actor, then switches (9b) and runs the handler | F4, F5: the writer needs platform settings, the action needs tenant settings, both in one transaction; no second transaction, no function from tenant back to platform (M2AUTH DBC-3 unchanged) | a SECURITY DEFINER SQL function that computes the chain hash (the hash form is canonical JSON in JavaScript; a SQL copy would be a second writer); a platform-only handler with explicit organisation filters (drops row-level security on the tenant routes the isolation suite exists to prove) |
| C2 | **[P]** The plan reads a tenant object under platform settings only with an explicit `org_id = <session organisation>` filter and `for update`; the handler then writes under row-level security and every write statement also carries the organisation | M2AUTH 4.3 «platform code also filters by org_id explicitly»; the two walls: the plan's filter (API wall) and the policy (database wall); a plan that forgets the filter still cannot write another organisation's rows (policy 42501, rolled back) | none |
| C3 | **[P]** The version number is never a stored counter: the plan locks the project row (`for update`), reads `max(version) + 1`, and the handler inserts that number; `unique (project_id, version)` is the backstop | F11: parallel edits serialise on the project row; no extra column; the unique key turns a missed lock into a visible failure | a `projects.idea_version` counter column |
| C4 | **[P]** The invite code is 16 random bytes in base64url (22 characters, 128 bits), stored as `mac("invite", code)` (a new label of `keys.js`), shown once in the link `<APP_ORIGIN>/invite.html#c=<code>`; the page reads the fragment once and clears it (as `reset.html`) | REQ-116 «128-bit, 7 days, single use, HMAC, shown once»; the fragment never reaches a server log or a Referer; the API carries the code in the path as ARCH §13 and the criteria fix (residual: the path is in the host's request log, named in 5) | a code in the request body of a POST (the criteria fix `GET /api/invites/:code`) |
| C5 | **[P]** Refusals of the accept route that depend on the state of the database are **returned** (their counters commit, no other row changes); refusals that depend only on the body are **thrown** (M2AUTH C4). The invite is claimed by one conditional UPDATE after every check and after the password hash, so a returned refusal never spends it | the eleventh accept from one address must count wrong-e-mail attempts too; «unchanged state» holds by construction | every refusal thrown (wrong-e-mail guesses against a valid code would not count) |
| C6 | **[P]** The answers that tell a code holder nothing extra: an unknown, expired or used code and a wrong e-mail all answer the uniform `not_found` 404 body; only `account_exists` (409) tells that the invite's own e-mail already has an account | a holder who guesses e-mails must not learn whether a guess was right; `account_exists` concerns the e-mail the admin himself typed | distinct codes for each |
| C7 | **[P]** The G7 gate is the constant `PERSONAL_DATA_GATE = "owner_only"` in `app/server/services/orgs.js` (`"invited"` is the owner's answer «б»); the app takes it from `deps.auth.personalDataGate` when given (tests) and otherwise from the constant; a test pins the source value to `"owner_only"` | REQ-116 «a constant in source, changed by a release»; the pin makes the release visible in the test list | an environment variable (a release gate must not be flipped by an env change) |
| C8 | **[P]** Registration mode is read as `platform_settings.registration_mode`: row missing → `invite`; `invite` or `open` → accept; `closed` → refuse; any other value → `closed` (fail closed); no code of this block writes it | REQ-116 criterion 4 | fail open on an unknown value |
| C9 | **[P]** The consent record is a new table `user_consents` (user id, sha256 of the exact sentence shown, its language, the time), not columns of `users`; the sha256 is over the five sentences of the shown language joined by one U+0020; the page computes it with Web Crypto from the texts it shows, the server from its own copy of the texts module (the same pure function `consentText`); an acceptance whose digest differs, or whose language has no complete text in the server's copy (kk on production, F14), is refused `consent_stale` | «the sha256 of the exact sentence shown»; a table keeps `users` free of a new personal-data column and the rehearsal seed fills only tables the migration creates (M2AUTH 6.2) | columns on `users` |
| C10 | **[P]** Deletion replaces the personal fields by fixed placeholders — e-mail and its normalised form `deleted-<user id>@deleted.invalid`, name `Deleted account`, the password hash by the constant `DELETED_HASH` (the form of a scrypt hash that no computation gives; the account can no longer log in, status `deleted` takes the no-account path of M2AUTH 4.9.5), the TOTP fields cleared — and also replaces `invites.email_norm` of the invites that user used by the same e-mail placeholder (the invite holds his address) | decisions/0100 items 1 and 5: the account and its data are deleted; an invite row left with the address would keep it | leave the invite row (question О7) |
| C11 | **[P]** A deletion request needs the password again, and is refused for the platform admin (403 `forbidden`: his account cannot be deleted); a second request while one is open adds no row and answers 2xx with the first request's time | REQ-116 criterion 6; a request that can never be carried out is not stored | allow the admin's request |
| C12 | **[P]** A new re-auth purpose `user_delete` for `POST /api/admin/users/:id/delete`; the invite route consumes `owner_identity` on **every** invite (not only for an owner identity) | REQ-116 names a re-auth token for the delete without a purpose; the closed table of M2AUTH 4.9.4 gains one row; an invite creates an account, so the stricter rule costs the owner one password entry (question О2) | re-auth only when the flag is set (a body-dependent `meta.reauth`) |
| C13 | **[P]** `grants.sql` gains: `org_members` DELETE (deletion removes the membership), `invites` DELETE (the lazy cleanup removes expired unused invites after 30 days, ARCH §4 retention), and blocks for the four new tables (4.2.4); the least-grants oracles (RLS-5, MG-6) are updated | the least privilege each statement of 4.6 needs | none |
| C14 | **[P]** `rate_limits` gains three kinds: `invite` (accept: 10 per hour per address, ARCH §14.3), `invite_view` (GET of an invite: 60 per hour per address) and `project` (project creation: 20 per day per user, ARCH §14.3; the key's subject is the user id, a fixed 24-hour window); `meta.rateLimit` may be `invite` or `invite_view`, `project` is counted by the plan of `POST /api/projects` | the criteria name 10 and 20; `invite_view` keeps the public GET off an unbounded path | no limit on the GET |
| C15 | **[P]** A new body field kind `bool` in `app/server/http/schema.js`; `parseBody` returns `Record<string, any>` and `PipelineRequest.body` has that type (the route's shape is the checked contract; only N2 and N4 read a boolean), so the existing handlers keep compiling under `tsc` | F3; the criterion says «consent false», a JSON boolean | the string `"true"` |
| C16 | **[P]** The new closed audit actions are `invite.create`, `invite.accept`, `account.deletion_request`, `account.delete`, `project.create`, `project.idea_version`, `project.stage` and `admin_read` (the REQ's literal name for the card read); new closed details keys: `version` (integer ≥ 1), `role` (the four roles), `owner_identity` (boolean), `stage` (a stage of `stages.js`); the `audit_log_action_check` of 0002 is replaced by the wider list in 0003 (F6) | REQ-116 and REQ-117 name these audit rows; closed keys keep personal values out of the log | free-text details |
| C17 | **[P]** A project's `language` is the quick fact `lang` (`ru` or `en`, ARCH §17); the three quick facts are stored on every idea version (`quick_facts` jsonb, copied forward on an edit; M2 edits change the text only) | ARCH §4 puts `quick_facts` on `idea_versions`; the card reads the newest version's facts | facts on `projects` |
| C18 | **[P]** The board shows 200 projects at most per stage (newest `updated_at` first) with the true count; the audit page shows 50 rows per page by `after` | a bounded answer; V1 holds a handful of projects | unbounded lists |
| C19 | **[P]** The organisation of a new customer organisation is named by the owner when he creates the invite (`org_name`, 1-120 characters, a column of `invites`), never by the invited person | REQ-116 says «a new customer organisation» and names no source for its name; a name typed by the person would put his personal data into `orgs.name`, which stays after his deletion (question О3) | the accepting person's name |
| C20 | **[P]** `GET /api/invites/:code` and `POST …/accept` have `meta.session` true (so they take the pipeline: a transaction, a deadline, the rate limit) although an anonymous caller has no session; a signed-in caller's old session is ended by an accept (rotation, M2AUTH 4.9.3) | the non-pipeline path gives a handler no database (M2AUTH 4.7 last paragraph) | a new pipeline switch |

---

## 3. Files, owners and order

Owner: **B** = BACKEND-DEV, **F** = FRONTEND-DEV, **T** = TEST-DESIGNER (step 5). New unless «changed».

| Owner | File | What |
| --- | --- | --- |
| B | `app/db/migrations/0003_projects.sql` | 4.2 |
| B | `app/db/grants.sql` (changed) | 4.2.4 |
| B | `app/test/fixtures/rehearsal/0003_projects.sql` | 4.2.5 |
| B | `app/server/http/plan.js` | `withPlan`, `planOf` (4.4) |
| B | `app/server/http/auth-mw.js` (changed) | step 9a, the plan, `PipelineRequest.plan` (4.4) |
| B | `app/server/http/schema.js` (changed) | field kind `bool`, body type (4.1) |
| B | `app/server/http/rate-limit.js` (changed) | the three limits (C14) |
| B | `app/server/http/errors.js` (changed) | the eight codes, `AUTH_CODES` (4.3) |
| B | `app/server/auth/keys.js` (changed) | label `invite` |
| B | `app/server/auth/reauth.js` (changed) | purpose `user_delete` (C12) |
| B | `app/server/db/org-store.js` | statements of invites, organisations, consent, deletion (4.6) |
| B | `app/server/db/project-store.js` | statements of projects, idea versions, board, purge (4.6, question О1) |
| B | `app/server/db/auth-store.js` (changed) | `listMemberships` with name and kind, the open deletion read for `me`, the cleanup of stale invites |
| B | `app/server/services/orgs.js` | invites, acceptance, consent, deletion, the G7 constant (4.5.1) |
| B | `app/server/services/projects.js` | create, edit, stage move, board, card, purge helper (4.5.2) |
| B | `app/server/services/audit.js` (changed) | actions and details keys (C16) |
| B | `app/server/routes/invites.js` | rows N1, N2 (4.3) |
| B | `app/server/routes/projects.js` | rows N11-N14 |
| B | `app/server/routes/admin-projects.js` | rows N7-N10 |
| B | `app/server/routes/admin.js` (changed) | rows N4-N6 |
| B | `app/server/routes/auth.js` (changed) | row N3, the `me` answer |
| B | `app/server/routes/index.js` (changed) | the table order (4.3), the `RouteMeta` typedef |
| B | `app/scripts/word-lists.js` (changed) | `CONSENT_KEYS`, `DELETION_TERM`, `stripDeletionTerm` (4.8) |
| B | `app/scripts/check-public.js` (changed) | reads them (4.8) |
| B | `docs/security-invariants.md` (changed) | six rows (4.10) |
| F | `app/public/shared/format/kz.js` | 4.7 |
| F | `app/public/shared/project/stages.js`, `quick-facts.js` | 4.7 |
| F | `app/public/shared/consent.js` | 4.7 |
| F | `app/public/invite.html`, `account.html`, `projects.html`, `project-new.html`, `project.html` | 4.9 |
| F | `app/public/admin.html`, `admin-request.html`, `admin-audit.html`, `admin-invites.html`, `admin-deletions.html` | 4.9 |
| F | `app/public/js/pages/invite.js`, `account.js`, `projects.js`, `project-new.js`, `project.js` | 4.9 |
| F | `app/public/js/admin/admin.js`, `admin-request.js`, `admin-audit.js`, `admin-invites.js`, `admin-deletions.js` | 4.9 |
| F | `app/public/js/api.js` (changed) | codes, `reauthToken`, `sessionChanges` (4.9.1) |
| F | `app/public/shared/i18n/texts.js` (changed) | keys (4.8, 4.9.3) |
| F | `app/public/css/site.css` (changed) | rules appended for the stage strip, the board, tables (4.9.2) |
| F | `app/public/login.html`, `reset.html`, `setup.html`, `admin-totp.html` and `app/public/js/pages/login.js` (changed) | the footer of M2; login's links |
| T | the test files of section 7, the guard edits of section 9, `app/test/fixtures/auth.js`, `app/test/fixtures/browser.js` (`serveAccounts`), `app/test/fixtures/permission-matrix.golden.json` | 7, 9 |

Order: (1) B writes the shared contract first — `errors.js` codes, the route rows and bodies of 4.3, `plan.js`, `schema.js`
`bool`; F only reads it (this file is the contract); (2) B and F in parallel in their own files; F reads the codes and
bodies of 4.3 and reports a divergence through ORCH; (3) T after both (step 5). No file has two writers.
`app/public/shared/i18n/texts.js` and `app/public/js/api.js` are F's only; `errors.js` is B's only. The shared
modules under `app/public/shared/` are F's and are imported by the server (allowed: `server/` may import
`public/shared/`, `import-boundaries.test.js` line 446); B reads them and reports a divergence.

---

## 4. Interfaces

### 4.1 Common shapes (what M2AUTH 4.1 fixed stays: uuid check before any statement, times from the injected clock as parameters, bodies strict)

- **Body field kinds** (`app/server/http/schema.js`): the four of M2AUTH (`text`, `email`, `enum`, `form`) and a new **`bool`** (`{ kind: "bool", optional?: boolean }`): a JSON `true` or `false` and nothing else (a string, number or null → `bad_body`). `parseBody` returns `Record<string, any>` (the shape of the route is the checked contract). An unknown key, a missing required key, a wrong type, a text over its limit or with a control or invisible sign → 400 `bad_body`; not JSON or not UTF-8 → 400 `bad_json` (unchanged).
- **Organisation keys.** No body of this block has a key named `org_id` or `orgId` (F17, IS-4). The admin invite names an existing organisation by the key `organisation` (a uuid text).
- **Ids** in a path (`:id`, a project or a user) are lower-case uuid texts checked by `UUID` before any statement; a path id that is not a uuid answers the same 404 as an unknown one. The invite `:code` is `^[A-Za-z0-9_-]{22}$`; any other text answers the uniform 404 before any statement.
- **Times in answers** are ISO-8601 texts with `Z` and milliseconds (`new Date(ms).toISOString()`); pages format them with `shared/format/kz.js`.
- **Closed texts of the database** (`stage`, `role`, `language`, quick-fact values) are enforced twice: by the strict body (`enum`) and by the column check.

### 4.2 Migration `app/db/migrations/0003_projects.sql`

Applied by `server/db/migrate.js` in one transaction as the owner role (as 0001, 0002). Expand-only. The file holds no `grant`
(MG-7 stays: grants live in `grants.sql`, 4.2.4). Times that a rule reads come from the clock as parameters; `now()` is not a default of any column here.

#### 4.2.1 Changes of 0002 objects (measured, F6, F9)

| Object | Change |
| --- | --- |
| `invites` | add `owner_identity boolean not null default false`; add `org_name text` with `char_length(org_name) between 1 and 120`; add the check `invites_org_name_rule`: `(org_id is null) = (org_name is not null)` (a new-organisation invite names the organisation, an existing-organisation invite does not). The seeded 0002 invite row (an existing organisation) satisfies it, so the previous-schema rehearsal holds |
| `audit_log_action_check` | dropped and added again with the 14 actions of 0002 plus the eight of C16 (`invite.create`, `invite.accept`, `account.deletion_request`, `account.delete`, `project.create`, `project.idea_version`, `project.stage`, `admin_read`) |
| `reauth_tokens_purpose_check` | dropped and added again with the 11 purposes of 0002 plus `user_delete` |
| `users` | a trigger `users_owner_identity_guard` BEFORE UPDATE OF `is_owner_identity` FOR EACH ROW: P0001 «a member of the owner organisation must be an owner identity» when the new value is false and the user is a member of the organisation of kind `owner`. (The 0002 trigger on `org_members` guards the other side; no route changes the flag of an existing user, so the guard is the database half of the rule of REQ-116 criterion 3) |

#### 4.2.2 New tables

| Table | Columns | Keys, checks, triggers |
| --- | --- | --- |
| `user_consents` | user_id uuid not null → users; text_sha256 text not null (`^[0-9a-f]{64}$`); lang text not null in (`ru`,`kk`,`en`); accepted_at timestamptz not null | pk (user_id). Global table, no `org_id`, no row-level security. The only personal-data-adjacent table of this block: it holds the digest of the sentence shown, its language and the time, no personal value |
| `deletion_requests` | id uuid pk default gen_random_uuid(); user_id uuid not null → users; requested_at timestamptz not null; closed_at timestamptz null | unique partial index `deletion_requests_one_open` on (user_id) where `closed_at is null` (one open request per user). Global table |
| `projects` | id uuid pk default gen_random_uuid(); org_id uuid not null → orgs; title text not null (1-120); language text not null in (`ru`,`en`); stage text not null default `draft` in the eleven stages of `stages.js`; created_by uuid not null → users; created_at, updated_at timestamptz not null | unique (org_id, id) (the target of the composite key below); index (org_id, stage); index (stage, updated_at) [R ARCH §4] |
| `idea_versions` | id uuid pk default gen_random_uuid(); org_id uuid not null → orgs; project_id uuid not null; version integer not null ≥ 1; text text not null (1-8 000); quick_facts jsonb not null (an object); reason text null (1-2 000); created_by uuid not null → users; created_at timestamptz not null | foreign key (org_id, project_id) → projects (org_id, id) (a version can never point into another organisation, F7); unique (project_id, version); check `(version = 1) = (reason is null)` (version 1 has no reason, every later version has one, F7); index (org_id, project_id); triggers 4.2.3 |

`users` is not altered: the new personal-data fields are none. The column lists the test of REQ-116 criterion 5 compares with `information_schema` are: `users` — the 21 columns of 0002, unchanged (id, email, email_norm, display_name, password_hash, is_platform_admin, is_owner_identity, totp_secret_enc, totp_enabled_at, totp_last_step, totp_recovery, language, status, failed_logins, failed_since, locked_until, reauth_failures, reauth_failed_since, reauth_locked_until, created_at, last_login_at; the test holds the list as a literal); `user_consents` — user_id, text_sha256, lang, accepted_at.

#### 4.2.3 Row-level security, triggers, the purge protocol

- `projects` and `idea_versions`: row security enabled and forced; one policy each, `<table>_tenant` `for all to sai_app`, USING and WITH CHECK `org_id = nullif(current_setting('app.org_id', true), '')::uuid or current_setting('app.role', true) in ('platform', 'worker')` (the form of `org_members`, F7). `deletion_requests`, `user_consents`: no `org_id`, no row security (global, like `users`).
- **Insert-only `idea_versions`** (F8): a function and two triggers, a row trigger BEFORE UPDATE OR DELETE and a statement trigger BEFORE TRUNCATE. The function raises P0001 «sai: idea_versions is insert-only» for every UPDATE and TRUNCATE, and for a DELETE **unless** `current_setting('app.purge_org', true)` equals `old.org_id::text`. The trigger fires for every role, the owner included.
- **The purge protocol** (the one exception, the form REQ-117 criterion 2 asks the design to show): `purgeOrg(q, orgId)` in `app/server/db/project-store.js` (a) refuses unless `app.role` is `platform` (TypeError, no statement), (b) sets `app.purge_org` to the organisation id with `set_config(…, true)` (transaction-local), (c) deletes the idea versions of that organisation, (d) sets the setting to the empty text, (e) deletes the projects of that organisation. The text `app.purge_org` stands only in this store function and in the migration (grep, DEL-8). Residual, named: code that can run SQL as `sai_app` could set the setting itself; the app has no such path (Q9: every statement is a constant in a store file), and a setting for another organisation deletes nothing of this one (F8).
- Existing triggers unchanged: `org_members_owner_identity` (a member of the owner organisation must be an owner identity), `unique (user_id)` on `org_members` (one membership per user, decisions/0135 О15), `audit_log` append-only.

#### 4.2.4 `app/db/grants.sql` (decisions/0137 О1: static blocks, one table each, guarded by `to_regclass`)

The two schema-level lines and the existing blocks stay. Changed blocks: `org_members` becomes `select, insert, delete`; `invites` becomes `select, insert, update, delete`. New blocks, one table each (MG-7 rules unchanged: each `to_regclass` table is created by a migration, each grant names its block's table):

| Table | Grants to `sai_app` | Why |
| --- | --- | --- |
| `projects` | select, insert, update, delete | create, edit (`updated_at`, stage), the purge |
| `idea_versions` | select, insert, delete | insert-only by trigger; DELETE only for the purge (the trigger refuses it otherwise; no UPDATE grant) |
| `deletion_requests` | select, insert, update | request, list, close |
| `user_consents` | select, insert | the consent record |

The least-grants oracles (RLS-5 in `rls.test.js`, `APP_GRANTS` of MG-6 in `migrate.test.js`) are updated to this table (guard rows G12, G13). A database built from the 0002 prefix gets exactly the grants of its own tables and no error (the guard of 0137 О1, F6 trial ran on a 0002 database).

#### 4.2.5 The rehearsal seed `app/test/fixtures/rehearsal/0003_projects.sql`

Fixed test values, e-mails under `example.test`, no key shape; it fills **only** the four tables 0003 creates and every one of them with at least one row: `user_consents` 1 (the seeded client user, a 64-hex test digest, `ru`), `deletion_requests` 1 (the same user, open), `projects` 2 (one in the seeded owner organisation, one in the client organisation), `idea_versions` 3 (version 1 of each project, version 2 of one with a reason). It touches no 0002 table, so the previous-schema counts and contents of A's tables hold (M2AUTH 6.1, 6.2); the new columns of `invites` have defaults, so db-verify allows them. REQ-120's job step «every table filled» passes with the four tables.

### 4.3 The route table, request and answer of every route, the error codes

Route rows `N1…N14` are added to the 15 of M2AUTH 4.4 (the 15 stay unchanged except the `me` answer, 4.3.3). `routeTable` concatenates: demo rows, health, `authRoutes` (7 + N3), `adminRoutes` (5 + N4, N5, N6), `inviteRoutes` (N1, N2), `adminProjectRoutes` (N7-N10), `projectRoutes` (N11-N14): 29 rows. Metadata keys are exactly the six of M2AUTH 4.4 (`tenant`, `admin`, `reauth`, `worker`, `session`, `rateLimit`); `rateLimit` may now be `"invite"` or `"invite_view"` (RT-1's allowed list, guard row G1).

| # | Method, path | tenant | admin | reauth | worker | session | rateLimit | File |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N1 | GET /api/invites/:code | f | f | null | f | t | invite_view | routes/invites.js |
| N2 | POST /api/invites/:code/accept | f | f | null | f | t | invite | routes/invites.js |
| N3 | POST /api/account/deletion-request | f | f | null | f | t | user | routes/auth.js |
| N4 | POST /api/admin/invites | f | t | owner_identity | f | t | user | routes/admin.js |
| N5 | GET /api/admin/deletion-requests | f | t | null | f | t | user | routes/admin.js |
| N6 | POST /api/admin/users/:id/delete | f | t | user_delete | f | t | user | routes/admin.js |
| N7 | GET /api/admin/requests | f | t | null | f | t | user | routes/admin-projects.js |
| N8 | GET /api/admin/projects/:id | f | t | null | f | t | user | routes/admin-projects.js |
| N9 | POST /api/admin/projects/:id/idea | f | t | null | f | t | user | routes/admin-projects.js |
| N10 | GET /api/admin/audit | f | t | null | f | t | user | routes/admin-projects.js |
| N11 | GET /api/projects | **t** | f | null | f | t | user | routes/projects.js |
| N12 | POST /api/projects | **t** | f | null | f | t | user | routes/projects.js |
| N13 | GET /api/projects/:id | **t** | f | null | f | t | user | routes/projects.js |
| N14 | POST /api/projects/:id/idea | **t** | f | null | f | t | user | routes/projects.js |

`worker` is false for every row. The four `tenant: true` rows are the real tenant routes of the isolation suite (REQ-117 criterion 4): N13 and N14 take an object id (IS-1), N11 and N12 are a list and a create (IS-2).

#### 4.3.1 Request, answer and own refusals

Every route may also answer the pipeline codes of M2AUTH 4.7 (404 uniform for an admin route and a non-admin, 403 `origin_refused` / `csrf_refused`, 415, 401 `auth_required`, 429 `rate_limited`, 403 `reauth_required`, 400 `bad_json` / `bad_body`, 503 `db_unavailable` / `server_config`, 500 `server_error`). «returned» = the counters commit, nothing else changes; «thrown» = the whole transaction rolls back (M2AUTH C4).

| # | Body in | → answer | Own refusals |
| --- | --- | --- | --- |
| N1 | (GET) | 200 `{"org":{"name":<text>,"new":<bool>},"role":<role>,"consent_langs":[<lang>…]}`; `org.name` is the organisation's name, or the name the admin typed for a new organisation (`new` true); `consent_langs` = the languages for which the server's texts hold all five consent sentences (ru, kk, en locally; ru, en on production, F14). No e-mail, no id; it answers 200 also while the mode is `closed` (the accept refuses) | 404 `not_found` (returned) for an unknown, expired or used code, and for a text that is not a 22-character code (the same body and headers, except `Date` and `X-Request-Id`) |
| N2 | `{name: 1-80, email, password: ≤1024, consent: bool, consent_sha256: 64 hex, consent_lang: ru\|kk\|en}` | 200 `{"ok":true}` + `Set-Cookie` (M2AUTH 4.9.3); creates the user (is_owner_identity = the invite's flag), the consent record, the membership with the invite's role in the invite's organisation or, for a new organisation, one `orgs` row of kind `customer` named by the invite with `ai_allowed` false and the user as `org_owner`; spends the invite; audit `invite.accept` | thrown: 400 `consent_required` (consent is false), 400 `consent_stale` (the digest is not the current one of that language, or the language has no complete text), 400 `password_rules` (length or the common-password list, M2AUTH 4.9.2). Returned: 403 `registration_closed`; 404 `not_found` (unknown, expired or used code; **and an e-mail that is not the invite's**, C6); 403 `personal_data_gate` (the gate is `owner_only` and the invite is not for an owner identity, also for a row planted in the database); 409 `account_exists` (the e-mail already has an account; a unique violation 23505 on `users` at the insert is mapped to this code and rolls back, F15). A signed-in caller's old session is ended |
| N3 | `{password: ≤128}` | 200 `{"ok":true,"requested_at":<iso>}`; the first request stores one `deletion_requests` row and one audit row `account.deletion_request`; a second while one is open stores nothing and answers the first one's time | returned: 401 `invalid_credentials` (counts a re-auth failure, M2AUTH 4.9.5 and 0137 О12), 429 `reauth_locked`; thrown: 403 `forbidden` (the platform admin) |
| N4 | `{email, role, owner_identity: bool, organisation?: uuid, org_name?: 1-120}` | 201 `{"link":"<APP_ORIGIN>/invite.html#c=<22 b64url>","expires_at":<iso>}`; stores the invite (code only as `mac("invite", code)`, `expires_at` = clock + 7 days, `created_by` the admin); audit `invite.create` with `role`, `owner_identity` and `reauth_id`; organisation id on the row | thrown: 400 `bad_body` (`organisation` and `org_name` both or neither; a new organisation with a role other than `org_owner`); 404 `not_found` (unknown `organisation`); 400 `owner_identity_required` (the organisation is the owner organisation and the flag is false); 403 `personal_data_gate` (the gate is `owner_only` and the flag is false); 409 `account_exists` (the e-mail has an account) |
| N5 | (GET) | 200 `{"requests":[{"id","user_id","name","email","requested_at"}…]}`, the open requests, oldest first (the admin sees the e-mail and name of the requester: he must know whom to delete; the answer goes to the admin only) | — |
| N6 | `{}`; `:id` uuid | 200 `{"ok":true}`; the deletion of 4.5.1 | thrown: 404 `not_found` (not a uuid, no such user, or already `deleted`); 403 `forbidden` (the target is the platform admin: the admin cannot delete his own account, nor any admin) |
| N7 | (GET) `?stage=` | 200 `{"stages":[{"stage":<stage>,"count":<n>,"projects":[{"id","title","org_name","updated_at"}…]}…]}` for the eleven stages in the order of `stages.js` (with `?stage=<stage>`: one entry); counts are true, the list per stage is the 200 newest (C18) | thrown: 400 `bad_request` (an unknown stage) |
| N8 | (GET) | 200 the card `{"id","title","stage","language","org":{"id","name"},"quick_facts":{"what","whom","lang"},"created_at","updated_at","versions":[{"version","text","reason","author":{"id","name","admin":<bool>},"created_at"}…]}` in version order; writes exactly one audit row `admin_read` (organisation id of the project, target the project) per call | thrown: 404 `not_found` (not a uuid or no such project) |
| N9 | `{text: 1-8000, reason: 1-2000}` | 200 `{"version":<n>}`; adds version n+1 (quick facts copied from the newest version), sets `updated_at`, audit `project.idea_version` with the version, actor kind `admin`, organisation id of the project | thrown: 404 `not_found` |
| N10 | (GET) `?after=<id>` | 200 `{"rows":[{"id","actor_kind","action","target_kind","target_id","created_at","details"}…],"next":<id\|null>}`: rows with `id` greater than `after` (default 0) in id order, at most **50**; `next` is the last id when the page is full, else null; `details` holds the closed keys only; no e-mail, name or address ever (the writer cannot store one, M2AUTH 4.11) | thrown: 400 `bad_request` (`after` is not `^[0-9]{1,15}$`) |
| N11 | (GET) | 200 `{"projects":[{"id","title","stage","updated_at"}…]}` of the session's organisation, newest `updated_at` first, at most 200 | — |
| N12 | `{title: 1-120, idea: 1-8000, what, whom, lang}` (the three quick facts are flat keys, each an `enum` of the sets of 4.7) | 201 `{"id","stage":"draft","version":1}`; one `projects` row (stage `draft`, `language` = `lang`, the session's organisation, `created_by` the caller), one `idea_versions` row (version 1, the quick facts, no reason), one audit row `project.create` | thrown (plan): 403 `forbidden` (a viewer), 429 `rate_limited` (the 21st creation of one user within one fixed 24-hour window; Retry-After) |
| N13 | (GET) | 200 `{"id","title","stage","language","quick_facts":{…},"created_at","updated_at","versions":[{"version","text","reason","author":{"id","name"},"created_at"}…]}` in version order | thrown: 404 `not_found` (an id of another organisation answers exactly as a missing one) |
| N14 | `{text: 1-8000, reason: 1-2000}` | 200 `{"version":<n>}`; as N9 with actor kind `user` (`admin` for the platform admin) | thrown (plan): 404 `not_found` (foreign or missing; checked **before** the role), 403 `forbidden` (a viewer) |

#### 4.3.2 Roles on each route (decisions/0127 И, 0135 О8)

Roles: `org_owner`, `org_admin`, `member` write; `viewer` reads only; the platform admin is the `org_owner` of the owner organisation (setup) and also has the `admin: true` routes. «—» = the route answers 404 uniform (admin routes) or 401 (anonymous).

| Route | anonymous | viewer | member | org_admin | org_owner | platform admin |
| --- | --- | --- | --- | --- | --- | --- |
| N1 GET invite | 2xx or 404 | same | same | same | same | same |
| N2 POST accept | 2xx or refusal | same | same | same | same | same |
| N3 deletion request | 401 | 2xx | 2xx | 2xx | 2xx | 403 |
| N4-N10 `admin: true` | 404 | 404 | 404 | 404 | 404 | 2xx |
| N11 GET projects | 401 | 2xx | 2xx | 2xx | 2xx | 2xx (own organisation) |
| N12 POST project | 401 | 403 | 2xx | 2xx | 2xx | 2xx (own organisation) |
| N13 GET project | 401 | 2xx | 2xx | 2xx | 2xx | 2xx (own organisation) |
| N14 POST idea | 401 | 403 | 2xx | 2xx | 2xx | 2xx (own organisation) |

Approving a ТЗ and requesting development are `org_owner` only when M3 and M4 add those routes (0135 О8); every invite of V1 is the platform admin's (ARCH §5); `org_admin` gets member-management rights when such a route is written (REQ-116 «Not covered»). This is the content of the golden file rows (guard row G8: 14 routes × 6 actors = 84 new rows, 174 in all).

#### 4.3.3 `GET /api/auth/me` (changed)

The memberships list is `[{"org_id","name","kind","role"}]` (exactly one in V1, REQ-116 criterion 7: the organisation's name and kind are read with the user's own `org_members` row, platform settings, explicit `user_id` filter), and the answer gains `"deletion_requested_at": <iso|null>` (the open request's time). Nothing else changes: no hash, no TOTP field (SS-9, guard row G10).

#### 4.3.4 Error codes (`app/server/http/errors.js`, `AUTH_CODES`)

Eight new entries of `ERROR_STATUS`; `AUTH_CODES` = the 23 of M2AUTH 4.8 plus these eight (31): the closed list of every code that any route of the table can answer. `bad_request` is added because N7 and N10 answer it (it was in `ERROR_STATUS` and in no route before). The pages map each to `auth_err_<code>`; TX-11 holds the 31 as a literal and compares (AP-077, guard row G5); RT-6 scans the new route files (guard row G4); TX-12 reads this table's eight codes (REQ-116 criterion 10).

| Code | Status | Answered by |
| --- | --- | --- |
| personal_data_gate | 403 | N2, N4 |
| registration_closed | 403 | N2 |
| forbidden | 403 | N3, N6, N12, N14 |
| owner_identity_required | 400 | N4 |
| consent_required | 400 | N2 |
| consent_stale | 400 | N2 |
| account_exists | 409 | N2, N4 |
| bad_request | 400 | N7, N10 |

No answer text names a duration, a price or a day (word lists В and Ц). The texts say «попробуйте позже» without a time.

### 4.4 The request pipeline: the plan hook (settles decisions/0137 О11)

`app/server/http/plan.js` (new):

```
Plan = (req: PipelineRequest) => Promise<{ audit: PlannedAudit | null, state: unknown }>
PlannedAudit = { action: string, targetKind: string | null, targetId: string | null, details: object }
withPlan(row, plan) → row        // WeakMap beside the row, like withBody; throws TypeError unless row.meta.tenant === true
planOf(row)         → Plan | undefined
```

Pipeline steps of M2AUTH 4.7 change at **9a** (new) and **10**; everything else is as is (the `PipelineRequest` `pr` is built after step 9 with the platform `q`, one step earlier than today's step 10):

| Step | Rule | Refusal |
| --- | --- | --- |
| 9 | the body is read and validated (unchanged) | 400 `bad_json` / `bad_body` (thrown) |
| **9a** | `meta.tenant`: the session's `orgId` must not be null (404 `not_found`, thrown); then, if the row has a plan: `planned = await plan(pr)` on the **platform** settings of this transaction (`pr.q`), `pr.session` is present; then, if `planned.audit` is not null, the audit entry is **built from the session and the request first** — `orgId` = `session.orgId`, `actorKind` = `"admin"` or `"user"` by `session.isAdmin`, `actorId` = `session.userId`, `ip` = the client address — and exactly four values are then copied into it from the plan: `action`, `targetKind`, `targetId`, `details`. Before any statement the pipeline checks that `planned.audit` has **exactly** those four keys; any other key (an `orgId`, an `actorKind`, an `actorId`, an `ip`, anything) or a missing one throws a `TypeError` (a program error: 500, the transaction rolls back, no row is written). Only then `appendAudit(q, entry, { now, mac })`. The plan's keys can therefore never overwrite a session value (F23) | whatever the plan throws (rolled back: the audit row is not written, the plan wrote nothing that outlives the transaction: a quota count it incremented rolls back with it) |
| 9b | `meta.tenant`: `switchToTenant(q, session.orgId)` (unchanged) | — |
| **10** | the handler gets `pr.plan = planned.state` (or null with no plan) and the same `q`, now under tenant settings | its own (4.3) |

Facts the rule rests on: the plan's statements read and lock under platform settings with an explicit `org_id = session.orgId` filter (C2); the handler's statements run under row-level security and carry the organisation too; one transaction and one connection throughout (F5); a failure of the handler after the audit row rolls both back (F5, TP-2). A plan on a route whose `meta.tenant` is false is refused at table build (`withPlan` throws, RT-7). The ordering `plan → audit → switch → handler` is a test (TP-1) that reads the statement sequence of a planted tenant route.

Other pipeline changes: `PipelineRequest.body` is `Record<string, any>`; the typedefs of `RouteMeta` and `PipelineRoute` allow `"invite"` and `"invite_view"` as `rateLimit` (tsc); `PipelineRequest.plan` is added; `AuthContext` gains `gate` (`"owner_only"` or `"invited"`, from `deps.auth.personalDataGate` or the constant of C7) and `consent` (`{ [lang]: sha256 hex | null }`, from `deps.auth.consentTexts` or the module's own texts, so a test can plant a stale sentence). `rate-limit.js` `LIMITS` gains `invite` (1 hour, 10), `invite_view` (1 hour, 60), `project` (24 hours, 20); `countRequest(q, mac, limit, subject, now)` keys `user` and `project` by their subject text (a session id, a user id) and the others by `addressKey(ip)`; the lazy cleanup also removes unused invites that expired more than 30 days ago (`delete from invites where used_at is null and expires_at < now − 30 days`, ARCH §4 retention; the cleanup stays in `auth-store.js`, F19: the 24-hour window row is not cleaned while live).

### 4.5 Services

Services hold the rules; they never run a statement (every statement is a named function of a store, 4.6; DBC-1).

#### 4.5.1 `app/server/services/orgs.js` (REQ-116)

Exports (signatures only):

- `PERSONAL_DATA_GATE = "owner_only"` (the G7 constant, C7; `"invited"` after the owner's «б»), `INVITE_TTL_MS` (7 days), `DELETED_NAME`, `DELETED_HASH`, `deletedEmail(userId)`.
- `createInvite(q, ctx, input) → { id, link, expiresAt }`; input `{ adminId, reauthId, email, role, organisation | null, orgName | null, ownerIdentity, now, ip }`. Order: validate the cross-field rules; read the organisation if named (platform, explicit id; not found → 404); owner-organisation rule; the gate; `account_exists`; code = 16 random bytes base64url; `insertInvite` with `mac("invite", code)`; audit `invite.create` (writer, the caller's platform transaction). A refusal throws before any write.
- `viewInvite(q, ctx, code, now) → { org, role, consentLangs } | null` (one read; null for an unknown, expired or used code).
- `acceptInvite(q, ctx, input) → RouteAnswer`, input the checked body, the code, `now`, `clientIp`, the old session id or null. **Order** (C5, C6): (1) `consent` true, else thrown `consent_required`; (2) `consent_sha256` equals `ctx.consent[consent_lang]` (a null entry never equals), else thrown `consent_stale`; (3) `rules(password)`, else thrown `password_rules`; (4) registration mode (C8) `closed` → returned `registration_closed`; (5) the invite by `mac("invite", code)` unused and `expires_at > now`, else returned `not_found`; (6) the e-mail normalised (`emailNorm`) equals the invite's `email_norm`, else returned `not_found`; (7) the gate: `owner_only` and not owner identity → returned `personal_data_gate`; (8) no `users` row with that `email_norm`, else returned `account_exists`; (9) the password hashed (`ctx.passwords.hash`); (10) **claim**: `claimInvite` one conditional UPDATE `where code_hash = … and used_at is null and expires_at > now returning …`; no row → returned `not_found` (the parallel winner); (11) `insertInvitedUser` (`language` = `consent_lang`; a 23505 on `email_norm` → thrown `account_exists`), `insertConsent`, then the membership with the invite's role in the invite's organisation, or `insertCustomerOrg` (named by the invite, `ai_allowed` false, `created_by` the user) and the membership `org_owner`; the owner-organisation trigger is the database half (a P0001 there is a thrown 500, never a half account); (12) `setInviteUsedBy`; (13) audit `invite.accept` (actor kind `user`, actor the new user, organisation of the membership, target the invite, details `role`, `owner_identity`); (14) the old session of the request is deleted, a new session opened, the cookie set. The scrypt of (9) runs before the claim so no lock is held through it (M2AUTH 4.9.5 lock order: the rate window row, then the invite row, then the audit lock last).
- `requestDeletion(q, ctx, input)` (N3), `listDeletions(q)` (N5), `deleteAccount(q, ctx, input) → void` (N6), input `{ adminId, targetId, reauthId, now, ip }`. **Deletion, in one platform transaction, in this order**: lock the target's users row (`for update`; not found or `deleted` → 404; an admin → 403 `forbidden`); read the organisations of his memberships; `anonymiseUser` (e-mail and `email_norm` → `deletedEmail`, name → `DELETED_NAME`, hash → `DELETED_HASH`, `totp_secret_enc`, `totp_enabled_at`, `totp_last_step` → null, `totp_recovery` → `{}`, counters cleared, status `deleted`); delete the user's `auth_sessions`, `reauth_tokens`, `password_resets` and `org_members` rows (counts 0); `scrubInviteEmails` (C10); `closeDeletionRequests`; for each organisation that now has no member, `purgeOrgProjects` of the projects service (REQ-117 criterion 9); audit `account.delete` (actor kind `admin`, target the user, details `reauth_id`). `user_consents` is kept (a digest, a language and a time: no personal value). Audit rows stay and hold no e-mail or name (M2AUTH 4.11).

#### 4.5.2 `app/server/services/projects.js` (REQ-117)

Exports (signatures only):

- `WRITE_ROLES = ["org_owner", "org_admin", "member"]`, `canWrite(role)`; `BOARD_LIMIT = 200`, `AUDIT_PAGE = 50`.
- `planCreate(ctx, req) → { audit, state }` (plan of N12; the context gives the HMAC of the daily limit, the route wraps it as `(req) => planCreate(ctx, req)`): role (`forbidden`), the daily limit `countRequest(q, mac, "project", userId, now)`, `id = crypto.randomUUID()`, audit `project.create` target the id, details `stage` `draft`; state `{ id }`. `runCreate(req) → RouteAnswer` (handler): `insertProject` (the explicit organisation, `created_by`, `created_at = updated_at = now`) and `insertIdeaVersion` (version 1, the quick facts as `{what, whom, lang}`).
- `planIdeaEdit(req) → { audit, state }` (plan of N14): `lockProject(q, id, session.orgId)` (404 if none), role (`forbidden`), `nextVersion(q, id)`; audit `project.idea_version` target the project id, details `version`; state `{ projectId, version }`. `runIdeaEdit(req)`: the newest version's quick facts, `insertIdeaVersion` with `state.version`, `touchProject` (`updated_at = now`), answer `{version}`.
- `adminIdeaEdit(q, ctx, input) → { version }` (N9, platform transaction, no plan: the route is `admin: true` and the writer runs in the handler as in M2AUTH): `lockProject(q, id, null)` → the organisation of the project; `nextVersion`; `insertIdeaVersion` (platform settings, the project's organisation id explicit); `touchProject`; audit `project.idea_version` with actor kind `admin`, organisation the project's.
- `listProjects(q, orgId)`, `readProjectForOrg(q, id, orgId)` (N11, N13: the handler reads under tenant settings with the organisation as an explicit filter too), `board(q, stage | null)`, `card(q, id)` (N7, N8), `auditPage(q, after)` (N10).
- `moveStage(q, ctx, { projectId, orgId, to, actor, now })`: the **only** place that changes a stage: refuses unless `canMove(current, to)` of `stages.js`; `setStage` (the one `update projects set stage`), `updated_at = now`; audit `project.stage` (details `stage`). No route of M2 calls it (the first moves are M3); PRJ-11 calls it directly in a platform transaction.
- `purgeOrgProjects(q, orgId) → { versions, projects }`: the purge helper (REQ-117 criterion 9): calls `purgeOrg` of the project store (4.2.3) and nothing else deletes `idea_versions`.

Concurrency: the plan holds the project row lock from `lockProject` to the commit, so two edits of one project serialise (C3, F11, M2R-2); the audit lock of the chain is taken last (the plan's `appendAudit` runs after the row lock: the order is rate window row → project row → audit lock, no two requests wait on each other in reverse).

### 4.6 Statements (stores)

Every statement is a constant text with bound parameters in `app/server/db/org-store.js` or `app/server/db/project-store.js` (Q9; M2AUTH 4.5.4). Named functions, each taking `q`:

- `org-store.js`: `readRegistrationMode`, `findOrg`, `accountExists`, `insertInvite`, `findInviteByHash` (joins the organisation's name), `claimInvite`, `setInviteUsedBy`, `insertInvitedUser`, `insertCustomerOrg`, `insertMember` (the existing function of `auth-store.js` is reused), `insertConsent`, `insertDeletionRequest` (`on conflict (user_id) where closed_at is null do nothing returning id`), `readOpenDeletion`, `listOpenDeletions`, `lockUserForDelete`, `orgsOfUser`, `orgMemberCount`, `anonymiseUser`, `deleteUserSessions`-like removals of `auth_sessions`, `reauth_tokens`, `password_resets`, `org_members` of one user, `scrubInviteEmails`, `closeDeletionRequests`. The text `registration_mode` stands once, in the one `select` of `readRegistrationMode`; no other line of `app/server` holds it, a comment included (REQ-116 criterion 4 grep). `audit.js` (changed): `ACTIONS` gains the eight actions of C16; `DETAILS` gains `version` (integer ≥ 1), `role` (one of the four roles), `owner_identity` (boolean) and `stage` (a stage of `stages.js`); `target_kind` values are `user`, `invite`, `project`. `insert into users` stands only in `auth-store.js` (`insertAdmin`) and `org-store.js` (`insertInvitedUser`); the column name `is_owner_identity` stands only in those two files (REQ-116 criterion 3 grep, the code design's list).
- `project-store.js`: `insertProject`, `insertIdeaVersion`, `lockProject(q, id, orgId | null)`, `nextVersion`, `touchProject`, `setStage` (the one `update projects set stage`), `latestQuickFacts`, `listProjectsOf`, `readProjectRow`, `readVersions` (joined with the author's name and admin flag), `boardCounts`, `boardProjects`, `readCardRow`, `readAuditRows` (the page of N10 with the closed columns only), `purgeOrg` (4.2.3). `update projects` and `delete from idea_versions` stand only here (question О1).
- `auth-store.js` (changed): `listMemberships` also returns the organisation's name and kind; `readOpenDeletion` for `me` is called from `routes/auth.js`; `cleanup` also deletes stale invites.

### 4.7 The shared pure modules (`app/public/shared/`, FRONTEND-DEV; importable by `server/` and by the pages)

**`project/stages.js`** — `STAGES`: the eleven literals in this order: `draft`, `interview`, `spec`, `approved`, `dev_requested`, `in_development`, `built`, `delivered`, `accepted`, `returned`, `archived`; `NEXT`: the frozen table of allowed moves (question О4); `canMove(from, to) → boolean`; `isStage(x) → boolean`. No import of a `node:` module, no `document` or `window`, no `Math.random`, `Date.now` or `new Date` (the rules of `import-boundaries.test.js` and criterion 3). The 20 allowed pairs: `draft→interview`, `interview→spec`, `spec→approved`, `approved→dev_requested`, `dev_requested→in_development`, `in_development→built`, `built→delivered`, `delivered→accepted`, `delivered→returned`, `returned→in_development`, and `→archived` from each of the ten other stages; every other pair of the 121 (the equal pairs included) is not allowed.

**`project/quick-facts.js`** — the closed sets (each option has a text key `qf_<key>_<id>` with ru, kk and en values, each key a label `qf_<key>_label`): `what`: `site`, `shop`, `bot`, `app`, `tool`, `unknown`; `whom`: `customers`, `team`, `myself`, `unknown`; `lang`: `ru`, `en` (ARCH §17: kk AI output is not offered). `unknown` means «Пока не знаю» (ru value of `qf_what_unknown` and `qf_whom_unknown`). Exports `QUICK_KEYS = ["what","whom","lang"]`, `OPTIONS` (key → frozen list of ids), `isOption(key, id)`. The body's three enum fields and the pages' three tap groups are built from `OPTIONS`.

**`format/kz.js`** — `formatNumber(n)` (a non-negative safe integer; digit groups of three by U+202F), `formatDate(ms)`, `formatTime(ms)`, `formatDateTime(ms)` → `27.10.2026, 18:53` in Astana time (UTC+5), from the time's own civil arithmetic (days from civil date; no `Date`, no time-zone table, no `Intl`): the output does not depend on the process or browser zone (F13). A value that is not a finite number (and a number that is not a non-negative safe integer for `formatNumber`) throws an `Error` with a plain message. The module's comments avoid the whole words `import`, `require`, `process`, `Intl`, `getTimezoneOffset` and the substrings `node:`, `fetch(`, `Math.random`, `Date.now`, `toLocale` (the greps of criterion 7 read comments too). The price and range forms of REQ-079 are not built (no page of V1 shows a price).

**`consent.js`** — `CONSENT_KEYS = ["consent_s1","consent_s2","consent_s3","consent_s4","consent_s5"]`; `consentText(texts, lang) → string | null`: the five values of `lang` joined by one U+0020, or null when any of them is missing for that language. Pure; imports only inside `public/shared/`.

### 4.8 Consent sentence, word-list exception, texts

**The sentences** (the draft of the description; the keys `consent_s1` … `consent_s5`; ru and en are the REQ-116 text character for character):

| Key | ru | en |
| --- | --- | --- |
| consent_s1 | Я соглашаюсь на обработку моих данных, чтобы работать в Sai по приглашению. | I agree to the processing of my data so that I can work in Sai by invitation. |
| consent_s2 | Данные: адрес почты, имя, хеш пароля, запись об этом согласии и HMAC-код IP-адреса. | Data: e-mail, name, password hash, this consent record and an HMAC code of the IP. |
| consent_s3 | Данные хранятся до удаления учётной записи. | The data is kept until the account is deleted. |
| consent_s4 | Данные хранятся в Германии (Франкфурт); тексты для ИИ обрабатывает Anthropic в США. | The data is stored in Germany (Frankfurt); texts for the AI are processed by Anthropic in the USA. |
| consent_s5 | Согласие можно отозвать, а данные удалить по запросу в течение 15 рабочих дней. | I can withdraw consent, and the data is deleted on request within 15 working days. |

**kk (a draft of the coding role, FOR_NATIVE_SPEAKER, ISS-0127 practice; it stays a draft until the owner approves it, decisions/0100 item 6; on production it is not served until G9):** consent_s1 «Мен Sai жүйесінде шақыру бойынша жұмыс істеу үшін деректерімді өңдеуге келісемін.» consent_s2 «Деректер: пошта мекенжайы, аты, құпиясөз хэші, осы келісім туралы жазба және IP мекенжайының HMAC коды.» consent_s3 «Деректер есептік жазба жойылғанға дейін сақталады.» consent_s4 «Деректер Германияда (Франкфурт) сақталады; ЖИ мәтіндерін АҚШ-тағы Anthropic өңдейді.» consent_s5 «Келісімді қайтарып алуға болады, ал деректер сұраныс бойынша 15 жұмыс күні ішінде жойылады.» Measured (F12): five phrases, at most 18 words each, text rules clean, the six tokens (`Sai`, `HMAC`, `IP`, `Франкфурт`, `Anthropic`, `15`) present.

**The narrow exception (REQ-111 criterion 3 as amended, decisions/0135 О13, 0136 О16).** `app/scripts/word-lists.js` gains: `CONSENT_KEYS` (the same five keys, frozen; at most five, each a key of the texts module), `DELETION_TERM` = `{ ru: "в течение 15 рабочих дней", kk: "15 жұмыс күні ішінде", en: "within 15 working days" }` (frozen; the kk phrase is the one the code design fixes), and `stripDeletionTerm(value, lang)`: the first occurrence of that language's phrase is taken out, once. `check-public.js` applies `lintText(stripDeletionTerm(value, lang), lang)` to a value whose key is in `CONSENT_KEYS`, and `lintText(value, lang)` to every other value. `forbidden-words.test.js` reads the same constant for its cases (FW-8, FW-9). The list Ц form «дней» / «күні» / «days» stands once in each language, inside the phrase only (F12). `consent.js` and `word-lists.js` each hold the key list (the pure shared module cannot import from `scripts/`); CON-5 asserts they are equal.

**Footer of every page of M2** (key `m2_footer`; ru and en are the REQ-117 text): ru «Закрытый тест. Данные хранятся за рубежом (Германия, Франкфурт); тексты для ИИ обрабатывает Anthropic (за рубежом).» en «Closed test. Data is stored abroad (Germany, Frankfurt); texts for the AI are processed by Anthropic (abroad).»; kk by the coding role (a draft).

### 4.9 Pages

#### 4.9.1 Common

Ten new pages at the root of `app/public`, the structure of the M1 and account pages (PP-2: doctype, `lang="ru"`, charset, viewport, color-scheme, `robots noindex`, one title, the icon; `#test-mode` and `#ai-disclosure` with their ru values, PP-4); each holds exactly one `sai:kk` region around its kk button and no order region (as the account pages, decisions/0137 Addition 3), so the open build cuts it (guard rows G16); styles only from `css/tokens.css` and `css/site.css` (new rules appended to `site.css` for the stage strip, the board columns, the tables and the version list; tokens unchanged, no colour literal, so `theme-contrast.test.js` is unaffected); no inline style, no `.style` use in a page script (PP-6: classes and `hidden` only), no `innerHTML`, no external address (CSP of M2AUTH 14.1); texts by `data-t` keys and `textContent`. Every page and the four account pages carry the footer element `<p class="disclosure" id="m2-footer"><span class="sq2" aria-hidden="true"></span><span data-t="m2_footer">…</span></p>` (the ru value in the HTML) inside `<footer>`. No link to these pages from the five public pages or the gate (REQ-114 criterion 13 stands); the pages link each other where 4.9.2 says; `login.html`'s signed-in view gains links to `/projects.html` and `/account.html` (and `/admin.html` for the platform admin). Served files carry none of `REQ-`, `handoff`, `ORCH`, `decisions`, «Claude Code» (check-public). The invite page's five consent elements are **empty in the HTML** and filled from the texts module (F21).

`app/public/js/api.js` (changed): `AUTH_CODES` gains the eight codes (kept equal to the server's by TX-11); `reauthToken(password, purpose, code?)` → `{ ok: true, token } | { ok: false, … }` (POST `/api/auth/reauth`, the purpose is sent as given); `sessionChanges(path)` replaces the exact-path list: true for the five existing paths and for `/api/invites/<22 characters>/accept`, so the cached CSRF token is dropped after an accept. Dates and numbers on every page go through `shared/format/kz.js` (the greps of KZ-6).

#### 4.9.2 The pages, their flows and the element contract (the ids the e2e test reads)

| Page and script | Flow | Element ids |
| --- | --- | --- |
| `invite.html` `pages/invite.js` | reads `#c=<code>` once and clears it (`history.replaceState`); GET N1 (404 → the text `inv_check`); shows the organisation and role; the consent sentences of the current language (re-rendered on a language switch, the digest recomputed with Web Crypto `SHA-256` over `consentText(TEXTS, lang)` UTF-8) and the unticked box; POST N2 with `consent: true` only when ticked; 200 → `me()` → `/projects.html` | `#form`, `#name`, `#email`, `#password`, `#consent` (checkbox, **no `checked` attribute**), `#consent-1`…`#consent-5`, `#org`, `#role`, `#submit`, `#err` |
| `account.html` `pages/account.js` | `me()`; shows the name, organisation name, role; the deletion block (password, button → N3; after it the note with the request's time in the KZ format); logout; links | `#who`, `#org`, `#role`, `#del-form`, `#del-password`, `#del-submit`, `#del-note`, `#logout`, `#err` |
| `projects.html` `pages/projects.js` | N11; list (title, stage name, updated time in the KZ format) linking `/project.html?id=<id>`; the button «Новый проект» (`prj_b_new`) linking `/project-new.html`; an empty text | `#list`, `#new`, `#empty`, `#err` |
| `project-new.html` `pages/project-new.js` | title, idea, three tap groups built from `OPTIONS` (one value each, `role="radiogroup"`, the «Пока не знаю» option on `what` and `whom`), «Создать» (`prj_b_create`) → N12 → `/project.html?id=<id>` | `#form`, `#title`, `#idea`, `#qf-what`, `#qf-whom`, `#qf-lang` (each holds buttons `data-option="<id>"`), `#create`, `#err` |
| `project.html` `pages/project.js` | `?id` uuid else the text of `not_found`; N13; the title, the **stage strip** (`#strip`: one item per stage of `STAGES`, the current one marked `aria-current="step"` and the earlier ones done), the quick facts, the versions with reason, author and time; for a non-viewer the edit form (text prefilled, «Почему» reason) → N14 → reload | `#title`, `#strip`, `#facts`, `#versions`, `#edit-form`, `#edit-text`, `#edit-reason`, `#edit-submit`, `#err` |
| `admin.html` `admin/admin.js` | needs `me().platform_admin`, else the text of `not_found`; N7; one block per stage: the stage name (`board_new` «Новые» for `draft`, `stage_<id>` otherwise) with its **count** and its projects linking `/admin-request.html?id=<id>`; links to the invite, deletion and audit pages | `#board`, `[data-stage="<stage>"]` blocks each with `.count`, `#err` |
| `admin-request.html` `admin/admin-request.js` | N8 (one `admin_read` row per load); the card; the button «Изменить заявку» (`adm_b_edit`) opens the form (`#edit-text` prefilled with the newest text, `#edit-reason` «Почему», `adm_f_why`) → N9 → reload | `#card`, `#facts`, `#versions`, `#edit`, `#edit-form`, `#edit-text`, `#edit-reason`, `#edit-submit`, `#err` |
| `admin-audit.html` `admin/admin-audit.js` | N10 from `after=0`; rows (id, KZ time, actor kind, action, target); «Ещё» loads `next` | `#rows`, `#more`, `#err` |
| `admin-invites.html` `admin/admin-invites.js` | e-mail, role, organisation (existing id or a new one with its name), the owner-identity box, the password; `reauthToken(password, "owner_identity")` (a code field appears when the answer is `totp_required`, as on `login.html`) then N4 with the token; shows the link once in a read-only field and clears it on the next input | `#form`, `#email`, `#role`, `#org-mode`, `#organisation`, `#org-name`, `#owner-identity`, `#password`, `#submit`, `#link`, `#err` |
| `admin-deletions.html` `admin/admin-deletions.js` | N5: name, e-mail, request time in the KZ format; per row a password field (and the code field on `totp_required`) and «Удалить учётную запись»: `reauthToken(password, "user_delete")` then N6, then reload | `#list`, `.row` items each with `.when`, `.del-password`, `.del-submit`, `#err` |

Every page script follows the pattern of `login.js`: `mountFrame`, `call`, `errorKey`, `say`/`clear`, the Kazakh note, the theme button; a failed call shows `auth_err_<code>` (or `inv_check` for the 404 of an accept); a network failure shows `auth_err_db_unavailable`. A page of the app part with no session shows the text of `auth_required` and a link to `/login.html`.

#### 4.9.3 Texts

New keys, all with ru, kk and en, lower case, ≤ 18 words per phrase, the «вы» form, none of the forbidden-word forms (lists of `word-lists.js`; no minutes, days, terms, prices; the one exception is the deletion-term phrase of the consent keys): `m2_footer`; `consent_s1`…`consent_s5`; the page families `inv_`, `acc_`, `prj_`, `adm_` (titles `inv_title`…, headings `inv_h_…`, fields `inv_f_…`, buttons `inv_b_…`, notes, empty states); `qf_<key>_label` (3) and `qf_<key>_<id>` (12); `stage_<id>` (11) and `board_new`; and `auth_err_<code>` for the eight new codes. Literal ru values the REQ fixes: `prj_b_new` «Новый проект», `prj_b_create` «Создать», `adm_b_edit` «Изменить заявку», `adm_f_why` «Почему» (also `prj_f_why`), `board_new` «Новые», `qf_what_unknown` and `qf_whom_unknown` «Пока не знаю». M2P-5 reads, for each page, every `data-t` and `data-t-aria` value of the HTML and every string literal of its script that matches `^(m2|consent|inv|acc|prj|adm|qf|stage|board)_[a-z0-9_]+$` and finds each in the texts module with three values. F names the keys; the key list is whatever those scans find, so nothing a page shows is without a text.

### 4.10 `docs/security-invariants.md` (changed)

Six rows are added to the 13 of M2AUTH 4.14 (one row per test name; SI-1 checks that each named file exists and holds `test("<name> `): the audit row of a tenant action commits with the action and is written before the switch (tenant-plan.test.js TP-1, TP-2); an invite is spent once (m2-race-pg.test.js M2R-1; invites.test.js INV-6); the idea versions are insert-only and only the purge helper deletes them (rls.test.js RLS-6; deletion.test.js DEL-8); the consent record holds the digest of the exact sentence shown (invites.test.js INV-11; consent.test.js CON-6); the owner-organisation rule holds on both sides (owner-org.test.js OO-1, OO-3); the admin read of a project is audited once per call (admin-board.test.js BRD-3).

### 4.11 Configuration

No new environment variable. The invite link uses `APP_ORIGIN` as the reset link does (M2AUTH 4.4 row 11); `SECRET_PEPPER` already feeds `mac("invite", …)`; the G7 gate is a source constant, not configuration (C7).

---

## 5. Failure paths — what the user sees, what stays unchanged

| Path | Answer | Unchanged |
| --- | --- | --- |
| Database refuses, is silent, or drops while a request transaction holds it (accept, create, edit, deletion, admin routes) | 503 `db_unavailable` within 4.9 s (M2AUTH 4.5.2 deadline guard, the `error` listener of 0137 Addition 5); the page shows `auth_err_db_unavailable`; no cookie; the process keeps serving | every row: a transaction whose deadline passed is rolled back before its next statement or before COMMIT (INV-13, PRJ-6) |
| A plan refuses (viewer, quota, foreign or missing project) | 403 `forbidden` / 429 `rate_limited` / 404 `not_found` | the whole transaction rolls back: no audit row, no project, no version, no quota count (TP-3, PRJ-2, PRJ-4) |
| The handler fails after the plan appended the audit row (a statement error, a failed write, the deadline) | 500 `server_error` or 503 | the audit row and the action roll back together (F5, TP-2) |
| Accept, state-dependent refusals (`registration_closed`, unknown/expired/used code, wrong e-mail, `personal_data_gate`, `account_exists`, the parallel loser) | the codes of N2 | `users`, `orgs`, `org_members`, `user_consents`, `audit_log`, the invite row; only the `rate_limits` count of the address commits (C5, INV-5) |
| Accept, body-dependent refusals (`consent_required`, `consent_stale`, `password_rules`, `bad_body`) | 400 | every row, the rate count included (thrown) |
| Two accepts of one code at once | exactly one 200; the other `not_found` | one user, one membership (INV-6, M2R-1) |
| An accept whose unique insert on `users.email_norm` loses a race | 409 `account_exists` (the 23505 is caught and rethrown as `account_exists`, the transaction rolls back) | every row, the invite stays unused |
| kk consent on production (the served texts have no kk) | 400 `consent_stale`; `consent_langs` of N1 lists ru and en only | every row |
| Invite link path in a host's request log | the code is in the request path of N1 and N2 (ARCH §13 and the criteria fix the path). The app's own log line holds the route pattern, never the path (LG-3); the host's log (Vercel keeps runtime logs for one hour) may hold the path of a GET and a POST. Named residual: the code is single use, 7 days, and spent by the accept | the app's log |
| Invite creation refused (re-auth missing, rules, gate, bad body, unknown organisation, existing account) | N4 codes | `invites`, `audit_log`, `reauth_tokens` (a refused creation does not spend the token: thrown rolls the consumption back, M2AUTH 4.9.4) |
| Deletion request: wrong password, locked, admin, anonymous | 401, 429, 403, 401 | `deletion_requests`, `audit_log`; the re-auth counter of the user's row commits on a wrong password (M2AUTH 4.9.5) |
| Deletion of an account refused (no token, own account/admin, ordinary caller) | 403 `reauth_required`, 403 `forbidden`, 404 | every row and the unspent token |
| Deletion fails midway (a statement error in the purge) | 500 | every row (one transaction; the purge setting is transaction-local) |
| `GET /api/admin/projects/:id` of a missing project | 404 | no audit row (the read happens before the audit append, and a miss throws) |
| An unknown `?stage=` or a malformed `after` | 400 `bad_request` | no audit row (the board and the page write none) |
| A stale 24-hour window or a clock jump | the daily window is `floor(now / 24 h)`; at the next window the count restarts | the earlier rows (cleaned after 24 h by the lazy cleanup, F19) |
| A project's version number race (a missed lock) | the unique key `(project_id, version)` raises 23505 → 500 `server_error` and the transaction rolls back; with the lock it cannot happen (M2R-2) | every row |
| A purge setting forged by other code | deletes nothing of another organisation (F8); **accepted residual (N5 of gate 1b, decisions/0138 Addition 1)**: code that can run SQL as `sai_app` can set `app.purge_org` to its own organisation and delete that organisation's idea versions; Q9 closes the injection path, the post-deploy record names it, and a SECURITY DEFINER purge function owned by the migration role (and no DELETE grant on `idea_versions` and `projects` for `sai_app`) is a LOW defect for later hardening | — |
| Deleting an `org_owner` of an organisation that keeps other members | allowed; **accepted residual (N4 of gate 1b)**: the organisation may be left without an `org_owner`, whom M3 and M4 approvals need; in V1 every user has one membership and only the platform admin invites, so it is rare; a LOW defect for M3, not a requirement change | the other members and the projects |
| Pages: a network failure, a stale CSRF token | the text of `db_unavailable`; one silent retry on `csrf_refused` (api.js, unchanged) | the form's values stay in the page |
| The migration fails | `migrate` exit 1, rolled back; the Vercel build fails and the previous deployment stays | schema |

---

## 6. Protection in the same operation

Every check and the action it guards run in one transaction (M2AUTH C3). The audit row of a tenant action commits with the
action (C1: plan → audit → switch → handler, one transaction). The invite is spent by the one conditional UPDATE that
checks `used_at is null and expires_at > now`, and the user, consent record, membership, organisation, `used_by` and the
audit row are written in the same transaction, so a failure anywhere leaves the invite unused. The registration mode, the
gate, the e-mail binding and the consent digest are checked in the accept transaction before the claim; the gate is also
checked at creation. The re-auth token of an invite creation or a deletion is consumed by the pipeline's step 8 in the
transaction of the action (M2AUTH 4.9.4). The idea version number is read under the project row lock and inserted in the
same transaction; the unique key is the backstop. The daily project quota is incremented in the plan's transaction, so a
refused creation does not count. The deletion's anonymisation, removals, scrub, request closing, purge and audit row are one
transaction. The purge setting is transaction-local and set and cleared inside the one store function. «Check now, act
later, in another call» appears nowhere.

---

## 7. Criterion → test (every criterion of both blocks; every test has a criterion)

The files and test ids of this table are the contract of TEST-DESIGNER (step 5); the criteria's file names are kept
(AP-123). `new` = a new file of this work; `+` = a case added to an existing file. «Counts unchanged» means row counts and the
sha256 of the rows of the named tables (`users`, `orgs`, `org_members`, `invites`, `audit_log`, `user_consents`, `projects`,
`idea_versions`, `deletion_requests`) before and after, taken with the helper `h.digest()` of `fixtures/auth.js`.

### 7.1 REQ-116

| c | Design element | Test (file → ids) |
| --- | --- | --- |
| 1 Creating an invite | 4.3 N4, 4.5.1 `createInvite`, C4, C7, C12, 4.2.1 | `int/invites.test.js` (new) **INV-1**: the admin's creation with a re-auth token of `owner_identity` → 201 with the link; the `invites` row holds `code_hash` = HMAC (a dump search over every table's row JSON for the code, its hex and its base64 forms finds nothing); `expires_at` = clock + 7 days exactly; one audit row `invite.create` whose `details.reauth_id` is that token's id; **INV-2**: without a token → 403 `reauth_required`; into the owner organisation with the flag false → 400 `owner_identity_required` (even under the default gate); under the default gate a flag false → 403 `personal_data_gate`; the source constant equals the literal `"owner_only"` (pin, C7); an ordinary user and an anonymous caller → 404 byte-equal to an unknown /api address (with and without Origin); the bad bodies of N4 (organisation and name both, neither, a new organisation with another role than `org_owner`, an unknown organisation, an existing account's e-mail); counts of `invites` and `audit_log` unchanged after every refusal, and the re-auth token still unspent after a refusal |
| 2 Accepting | 4.3 N1, N2, 4.5.1 `viewInvite` / `acceptInvite`, C5, C6, C9, 4.8 | **INV-3**: GET of a valid code → `{org, role, consent_langs}` (no e-mail, no id); an unknown, an expired (clock + 7 d + 1 s) and a used code and a non-22-character code → 404 with bodies and headers byte-equal except `Date` and `X-Request-Id`; **INV-4**: a valid accept (the e-mail typed in upper case, the sha256 of the current ru sentence, `consent: true`) creates exactly one user, one membership with the invite's role, for a new organisation one `orgs` row of kind `customer` with `ai_allowed` false named by the invite and the user as `org_owner`; `is_owner_identity` equals the invite's flag; `used_at` and `used_by` set; the answer sets the session cookie; the user's old session (a signed-in caller) is deleted; one audit row `invite.accept`; **INV-5**: each of — consent key missing (400 `bad_body`), `consent: false`, the digest of another text, a language with no complete text, another e-mail, a 9-character password, a used code (planted as used with no account behind it: the answer is `not_found`), a code after 7 d + 1 s, `registration_mode` `closed`, an e-mail that already has an account, and, with the gate `owner_only`, an invite row not for an owner identity planted directly — is refused and leaves the counts of `users`, `orgs`, `org_members`, `audit_log` and the invite row's sha256 unchanged (the `rate_limits` row of the address may change); **INV-6**: two parallel accepts of one code (PGlite, through the app) → exactly one 200; **INV-7**: the eleventh accept within one hour from one address → 429 with `Retry-After`; the pg job repeats the race on a real pool in **M2R-1** |
| 3 Owner identities, one membership | 4.2.1 guard trigger, the 0002 trigger and unique key, 4.6 grep lists | `pg/owner-org.test.js` (new) **OO-1**: a direct INSERT into `org_members` of the owner organisation for a user with the flag false → P0001, as the owner role and as `sai_app` under platform settings, counts unchanged; **OO-2**: a second membership row for a user who has one → 23505; **OO-3**: setting `is_owner_identity` false for a member of the owner organisation → P0001 (the guard trigger; setting it true is not guarded, and no statement of the app does either); `int/invites.test.js` **INV-8**: the flag of every pre-existing user is unchanged after every route of the table is called with its canonical request as every actor; the only writers of a user's flag are `POST /api/auth/setup` and the accept (copied from the invite the admin created with the re-auth); each creation of an owner-identity invite wrote one audit row; command `grep -rnwl is_owner_identity app/server` prints exactly `app/server/db/auth-store.js` and `app/server/db/org-store.js` (the design's list, 4.6; quoted in the RELEASE-VALIDATOR result) |
| 4 Registration modes | 4.5.1 step 4, C8, 4.6 `readRegistrationMode` | **INV-9**: no row and `invite` and `open` accept; `closed` → 403 `registration_closed`, counts unchanged; an unrecognised value (`"weird"`) behaves as `closed`; **INV-10**: the route table read at test time: every route is called with its canonical request as every actor and the number of `users` rows changes only for `POST /api/auth/setup` (with the token) and `POST /api/invites/:code/accept` (with a code); `grep -rn "insert into users" app/server` prints lines of `auth-store.js` and `org-store.js` only; command `grep -rnE "registration_mode" app/server` prints exactly one line, the `select` of `readRegistrationMode` (no INSERT or UPDATE of `platform_settings` with that key), checked line by line in the RELEASE-VALIDATOR result |
| 5 Consent sentence | 4.8, C9, 4.2.2 | `unit/consent.test.js` (new) **CON-1**: the ru and en values of `consent_s1`…`consent_s5` equal the ten sentences of 4.8 character for character; **CON-2**: each sentence has at most 18 words by `text-rules.js`; **CON-3**: each fixed phrase of the criterion stands in the ru value («обработку моих данных» … «в течение 15 рабочих дней») and in the en value («processing of my data» … «within 15 working days»); **CON-4**: the kk value has five sentence ends and the tokens `Sai`, `HMAC`, `IP`, `Франкфурт`, `Anthropic`, `15`; **CON-5**: `CONSENT_KEYS` of `word-lists.js` equals `CONSENT_KEYS` of `consent.js`, has at most five keys, each a key of the texts module; each `DELETION_TERM` phrase stands exactly once in its language's value of `consent_s5`; the kk phrase is the one of 4.8; **CON-6**: `consentText` is the five values joined by one space, null when a language lacks one, and its sha256 equals the test's own oracle (Node `crypto` over its own join of the literals); `int/invites.test.js` **INV-11**: after an accept the `user_consents` row holds the sha256 of the sentence shown, its language and the clock time; the column list of `users` and of `user_consents` read from `information_schema` equals the literals of 4.2.2 (no other new personal field) |
| 6 Deletion request and deletion | 4.3 N3, N5, N6, 4.5.1, C10, C11, C12 | `int/deletion.test.js` (new) **DEL-1**: a signed-in user's request with his password stores one `deletion_requests` row with the clock time and writes one audit row `account.deletion_request`; **DEL-2**: a second request while one is open adds no row (and no audit row) and answers 2xx with the first time; **DEL-3**: a wrong password → 401 `invalid_credentials`, no row; an anonymous caller → 401; the platform admin → 403 `forbidden`, no row; five wrong passwords → `reauth_locked` (the counter of the re-auth rule); **DEL-4**: the admin's list shows the request with its `requested_at` and the test applies `formatDateTime` of `kz.js` to it and compares with the literal of the injected clock in the KZ form (e.g. clock 2026-11-24 09:00 UTC → `24.11.2026, 14:00`); an ordinary user and an anonymous caller → 404; **DEL-5**: `POST /api/admin/users/:id/delete` with a `user_delete` token sets status `deleted`, replaces the e-mail, name, hash and TOTP fields by the placeholders of 4.5.1, leaves `auth_sessions`, `reauth_tokens` and `org_members` rows of the user at 0 (counts), his `password_resets` at 0, his used invite's `email_norm` at the placeholder, the request closed, `user_consents` kept; a login with the old e-mail and password answers byte-equal to the answer for an unknown e-mail; no audit row holds the old e-mail or name (a search of `details` and every text column of every audit row); **DEL-6**: a delete without a token → 403 `reauth_required`, of the platform admin (even by himself) → 403 `forbidden`, by an ordinary user → 404, of a missing or deleted user → 404, each with counts unchanged and the token unspent |
| 7 Memberships in the session | 4.3.3 | **INV-12** (`int/invites.test.js`): `GET /api/auth/me` of an accepted user lists exactly one membership `{org_id, name, kind, role}`; every route of this block is called with its canonical request as a member of organisation A (the canonical invites of N1 and N2 are for a new organisation: an invite shows its own organisation's name to its holder, by design) and the concatenated answer bodies hold neither B's id nor B's name |
| 8 Logs | 4.4 log line, C4 | `int/logging.test.js` **LG-3** (+; LG-1 and LG-2 unchanged): after an invite creation, a GET and an accept of an invite, a refused accept, a deletion request and a deletion, each with planted values, the captured stdout and stderr hold none of the planted invite code, e-mail, name, password and client address, and every line keeps the keys of LG-1 |
| 9 Matrix rows and isolation cases | 4.3.2, 7.5 | `permission-matrix.golden.json` has the 84 new rows (G8) and `int/permission-matrix.test.js` **PM-1**, **PM-2** pass; every `tenant: true` route has its case in `int/isolation.test.js` (G6) and **IS-1…IS-5** pass |
| 10 Pages, words, failure, both checks | 4.3.4, 4.8, 4.9, 9 | `unit/texts.test.js` **TX-12** (+) reads the eight codes of the table of 4.3.4 and finds `auth_err_<code>` with ru, kk and en in the texts module and each in `AUTH_CODES` of `errors.js` and of `api.js`, and **TX-11** (the literal of 31, G5); `unit/texts.test.js` and `unit/forbidden-words.test.js` pass with the one exception of 4.8 and no other (**FW-8**, **FW-9**); the consent box is not ticked when the page opens (`unit/m2-pages.test.js` **M2P-3**: no `checked` attribute; `e2e/accounts.test.js` **ACC-1**: the box is not ticked at load); with a failing database adapter `POST /api/invites/:code/accept` answers 503 `db_unavailable` within 5 s and writes nothing (`int/invites.test.js` **INV-13**); the guard rows of section 9 are done; GitHub run and `# tests N` as in 7.4; `cd tools && npm run -s traces` → 0 and `cd tools && npm run -s handoffs-check` → 0; SECURITY-REVIEWER lists no open Critical or High finding |

### 7.2 REQ-117

| c | Design element | Test (file → ids) |
| --- | --- | --- |
| 1 Creating a project | 4.3 N12, 4.4, 4.5.2 `planCreate` / `runCreate`, C14, C17 | `int/projects.test.js` (new) **PRJ-1**: `POST /api/projects` by an `org_owner`, an `org_admin` and a `member` → 201, one `projects` row (stage `draft`, the session's organisation, `language` = `lang`), one `idea_versions` row (version 1, the quick facts), one audit row `project.create` whose `org_id` is the session's organisation and whose actor is the caller; **PRJ-2**: a viewer → 403 `forbidden`, no row, no audit row, no quota count; **PRJ-3**: each of — an empty title, a title of 121 characters, an idea of 8 001 characters, U+0001 in the idea, U+200B in the idea, a quick fact outside its set, a missing quick fact, an added key `org_id` — is refused with 400 and leaves the counts of `projects`, `idea_versions` and `audit_log` unchanged; **PRJ-4**: the 21st creation of one user within one 24-hour window (injected clock) → 429 with `Retry-After`, counts unchanged; two hours later it is still refused; one window later it works; a second user from the same address is not limited (the key is the user); **PRJ-5**: `GET /api/projects` of a member of A lists only A's projects (B and C have projects); **PRJ-6**: with a failing database adapter the creation answers 503 `db_unavailable` within 5 s and nothing is written; the pg job repeats the quota edge on a real pool in **M2R-3** |
| 2 Idea versions | 4.3 N9, N13, N14, 4.4, 4.5.2, C3, 4.2.3 | **PRJ-7**: `POST /api/projects/:id/idea` adds version n+1; every earlier version row is byte-equal (the sha256 of each earlier row unchanged); `projects.updated_at` = the clock; one audit row `project.idea_version` with `details.version` = n+1; **PRJ-8**: without a reason, with a reason of 2 001 characters, by a viewer → refused with counts unchanged; a foreign or missing project → 404 (before the role); **PRJ-9**: the platform admin's `POST /api/admin/projects/:id/idea` on a project of a customer organisation adds a version the same way and its audit row has `actor_kind` `admin` and the project's organisation; **PRJ-10**: `GET /api/projects/:id` answers the versions in order with their reasons; `pg/rls.test.js` **RLS-6** (+): UPDATE and DELETE of an `idea_versions` row and TRUNCATE are refused by the trigger also for the owner role; a DELETE with `app.purge_org` set to the row's organisation passes, with another organisation's refused, an UPDATE with the setting refused (the one exception, 4.2.3); **RLS-1** (existing, G12) prints a count of at least 5 after 0003 (`org_members`, `invites`, `audit_log`, `projects`, `idea_versions`; `orgs` by its id) and passes |
| 3 Stages | 4.7 `stages.js`, 4.5.2 `moveStage` | `unit/project-stages.test.js` (new) **STG-1**: `STAGES` equals the eleven literals of the description in that order; **STG-2**: for every ordered pair of the eleven stages (121 pairs) `canMove` equals the test's own literal table (the 20 pairs of 4.7); `archived` is reachable from every other stage; **STG-3**: the module has no `node:` import, no `document` or `window`, no `Math.random`, `Date.now` or `new Date`; **STG-4**: command `grep -rniE 'update[[:space:]]+projects' app/server` prints lines of the file named in question О1 only (recommended: `app/server/db/project-store.js`, the one `setStage`, `touchProject` and the rest); and `int/projects.test.js` **PRJ-11**: `moveStage` in a platform transaction moves a project along an allowed pair, updates `updated_at`, writes one audit row `project.stage`, refuses a pair outside the table (`forbidden`) with counts unchanged |
| 4 Isolation on the real routes | 4.3 N11-N14, 4.4, 4.12 | `int/isolation.test.js` **IS-1** prints at least 2 object-id tenant routes (N13, N14) and passes (foreign = missing byte-equal 404, anonymous 401), **IS-2** the list and create routes (N11, N12), **IS-4**, **IS-5**; `permission-matrix.test.js` **PM-1** has the rows for every route of this block and passes; `pg/m2-race-pg.test.js` and `rls.test.js` RLS-2 (G12) give the same on a real pool |
| 5 Request board and card | 4.3 N7, N8, 4.5.2 | `int/admin-board.test.js` (new) **BRD-1**: `GET /api/admin/requests` answers for every stage of `stages.js` its count and its projects (title, organisation name, `updated_at`) with three organisations' projects in the counts; **BRD-2**: `?stage=draft` answers only draft projects, an unknown stage → 400 `bad_request`; **BRD-3**: `GET /api/admin/projects/:id` answers the card fields of 4.3 N8 and writes exactly one audit row `admin_read` per call (two calls, two rows; a missing project, none); **BRD-4**: both routes answer 404 byte-equal to an unknown /api address for an `org_owner`, a `member`, a viewer, an `org_admin` and an anonymous caller |
| 6 Audit page route | 4.3 N10, 4.5.2 `auditPage` | **ADT-1**: `GET /api/admin/audit?after=<id>` answers the rows after that id in id order, at most 50, each with `actor_kind`, `action`, `target_kind`, `target_id`, `created_at` and the closed `details` keys only, and `next`; a malformed `after` → 400; **ADT-2**: no answer holds an e-mail, a name or a client address of the values planted in the test (a search of every page's body); a non-admin and an anonymous caller → 404 as above |
| 7 KZ formats | 4.7 `kz.js` | `unit/format-kz.test.js` (new) **KZ-1**: a literal table of at least 16 rows, among them the numbers 0, 999, 1 000, 1 250 000 (U+202F) and the seven date-times of the criterion (`27.10.2026, 18:53`, `27.10.2026, 01:00`, `26.10.2026, 05:00`, `01.01.2027, 00:00`, `29.02.2028, 00:00`, `01.03.2027, 00:00`, `01.01.1970, 05:00`); **KZ-2**: an independent oracle in the test (its own days-from-civil arithmetic, no `Date`) agrees for 5 000 seeded moments; **KZ-3**: child processes with `TZ=America/New_York`, `TZ=Asia/Almaty` and `TZ=Pacific/Kiritimati` print the same strings; **KZ-4**: −1, 1.5, NaN, Infinity, the string «5» and null as a number, and NaN as a time, throw an `Error`; **KZ-5**: the three greps of the criterion on `kz.js` print nothing (exit 1), with the self-check on a planted `const p = process.env` (found) and `processed` (not found); **KZ-6**: a grep of `app/public/js/pages` and `app/public/js/admin` for `toLocale`, `Intl` and `getTimezoneOffset` with word boundaries finds nothing |
| 8 Footer on every M2 page | 4.8, 4.9.1 | `unit/m2-pages.test.js` (new) **M2P-1**: the list of the 14 M2 pages is closed in the test (`admin-totp`, `login`, `reset`, `setup` and the ten new) and every `.html` file of `app/public` outside the six M1 pages (`404`, `demo`, `examples`, `gate`, `how`, `index`) is on it; **M2P-2**: each page of the list holds `#m2-footer` with the key `m2_footer` whose ru and en values equal the two sentences of 4.8; **M2P-3**: `invite.html` has no `checked` attribute on `#consent` and empty `#consent-1`…`#consent-5` (F21); **M2P-4**: the sha256 of each of the six M1 pages, `public/js/pages/demo.js` and every file under `public/office/` equals the literal the test records from the base 60b10b7 (so `git diff --stat base/M2PROJ-20261124-01 -- app/public/index.html app/public/how.html app/public/demo.html app/public/examples.html app/public/404.html app/public/gate.html app/public/js/pages/demo.js app/public/office` prints nothing; the command is run by RELEASE-VALIDATOR); **M2P-5**: the key scan of 4.9.3 |
| 9 Deletion and the organisation's projects | 4.5.1, 4.5.2 `purgeOrgProjects`, 4.2.3 | `int/deletion.test.js` **DEL-7**: deleting the only member of a customer organisation removes that organisation's projects and idea versions through the purge helper (counts 0) and keeps their audit rows with ids only; deleting one member of an organisation that keeps another member keeps the projects; **DEL-8**: command `grep -rniE 'delete[[:space:]]+from[[:space:]]+idea_versions' app/server` prints lines of the file named in question О1 only (recommended `app/server/db/project-store.js`, inside `purgeOrg`), and `grep -rn 'purge_org' app/server` prints lines of that file only |
| 10 The whole path in a browser | 4.9, F18 | `e2e/accounts.test.js` (new) **ACC-1** (the e2e job of app.yml; real Chrome through playwright-core; the server of `serveAccounts(t)`: `node server/node-main.js` on port 0 with a fresh in-memory PGlite, `SECRET_PEPPER` and the hash of a setup token given to the child): setup with the token (`/setup.html`) → the admin signs in (`/login.html`) → creates an owner-identity invite for a new organisation with a re-auth (`/admin-invites.html`) → a second browser context opens the link, the box `#consent` is not ticked, ticks it, accepts → «Новый проект» with a title, an idea and the three quick facts → «Создать» → the project page shows `#strip` at its first stage → the admin board shows the project under «Новые» with count 1 → the card → «Изменить заявку» with «Почему» → the card and the project page show version 2 with its reason → the audit page shows the six actions in this relative order (other rows, such as the re-auth, may stand between): the setup, the admin login, the invite, the acceptance (which starts the client's session), the project creation, the idea change; the console of both contexts has no error; the shown-text lint of the browser kit (`shownTextFindings`) and the UAT's reading of `invite.html` take the five consent elements through the exception of 4.8 (`stripDeletionTerm` of the `CONSENT_KEYS` values) and apply the lists to the rest, because that function otherwise finds «дней» or «days» in the fifth sentence; no request leaves the server's own origin; **ACC-2**: the client's deletion request on `/account.html`, and the admin deletion page lists it with its time in the KZ form (the literal of the page's clock) |
| 11 Browser step (UAT-RUNNER) | 4.9 | the UAT of step 8: real Chrome, a fresh temporary profile, 1470×784, 390×844, 320×568, light and dark, ru and en, a local server on port 0 started and stopped by its process id; the client part (invite, new project, project page) and the admin part (board, card with «Изменить заявку», audit) each show every text of their keys (the shown-text lint reads the consent elements through the exception of 4.8, as in ACC-1), no horizontal scroll at 320 px, the footer, dates in the KZ form; snapshots outside the project, listed in the handoff |
| 12 Guard table, both checks | 9, 7.4 | the rows of section 9 are done and no other test changes; the GitHub run, `# tests N`, the e2e log with `accounts.test.js` `fail 0`, traces, handoffs-check, SECURITY-REVIEWER (7.4) |

### 7.3 The new tests by file (the count that 7.4 uses)

| Folder | New file → ids | Added to an existing file |
| --- | --- | --- |
| unit | `consent.test.js` CON-1…CON-6 (6); `project-stages.test.js` STG-1…STG-4, QF-1 (5; QF-1: each quick-fact option has ru, kk, en text keys, `unknown` on `what` and `whom`, `lang` is `ru` and `en`); `format-kz.test.js` KZ-1…KZ-6 (6); `m2-pages.test.js` M2P-1…M2P-5 (5) | `forbidden-words.test.js` FW-8, FW-9; `texts.test.js` TX-12; `route-table.test.js` RT-7 (a plan only on tenant rows, rows keep four keys) |
| int | `invites.test.js` INV-1…INV-13 (13); `deletion.test.js` DEL-1…DEL-8 (8); `projects.test.js` PRJ-1…PRJ-11 (11); `admin-board.test.js` BRD-1…BRD-4, ADT-1, ADT-2 (6); `tenant-plan.test.js` TP-1…TP-5 (5) | `logging.test.js` LG-3 |
| pg | `owner-org.test.js` OO-1…OO-3 (3); `m2-race-pg.test.js` M2R-1 (10 parallel accepts of one code over a pool: one 200, one user), M2R-2 (10 parallel edits of one project: versions 2…11 distinct, no gap, ten audit rows with distinct versions), M2R-3 (25 parallel creations by one user: exactly 20 succeed, 5 are 429) (3) | `rls.test.js` RLS-6 |
| e2e | `accounts.test.js` ACC-1, ACC-2 (2) | — |

**TP-1…TP-5** (`int/tenant-plan.test.js`, the O11 settlement; the planted tenant routes are injected through `deps.routeTable`): TP-1 the statement sequence of one request is `plan statements (platform) → insert audit_log → set tenant settings → handler statements`, the audit row's `org_id` is the session's organisation, `actor_kind` and `actor_id` are the caller's and `ip_hmac` is the request's; TP-2 a handler that throws after the plan leaves `audit_log` and the tables unchanged (counts and sha256); TP-3 a plan that throws writes nothing; TP-4 `withPlan` on a row with `tenant: false` throws, and rows keep exactly the keys method, path, meta, handler; TP-5 a planned audit with a key other than `action`, `targetKind`, `targetId`, `details` (an `orgId`, an `actorKind`, an `actorId`, an `ip`) or with one of the four missing makes the request fail before any statement (TypeError → 500, rolled back, counts of `audit_log` and every table unchanged), and a planted plan that sets `orgId` to another organisation writes no row of that organisation; with exactly the four keys the row carries the session's organisation, actor and address.

### 7.4 The count of the final check (REQ-116 c10, REQ-117 c12)

On a temporary `ci/*` branch the log of `app.yml` holds for each test step «# tests N», «# fail 0», «# skipped 0», «# todo 0», with N not below the count of the last green run before this work (F1: unit 152, int 126, pg 21, e2e 15) plus the tests this work adds: unit 152 + 26 = **178**, int 126 + 44 = **170**, pg 21 + 7 = **28**, e2e 15 + 2 = **17**; the step handoffs name the final numbers (guard edits change no count). The e2e job's log shows `accounts.test.js` with `fail 0`; `check.yml` is green on the same sha; on this PC no app check, no test and no e2e is run.

### 7.5 Test contracts of the guard suites

- **Isolation** (`isolation.test.js`, G6): `CASES` gets `GET /api/projects/:id` (`object`, `make` creates a project of A by SQL), `POST /api/projects/:id/idea` (`object`, with a new optional `body` of the case: a valid `{text, reason}`, because a strict body answers 400 before the 404 the suite expects, F17), `GET /api/projects` (`list`, `secrets` = A's project ids and titles) and `POST /api/projects` (`create`, `created` reads the new project's organisation, `body` a valid project body). The planted row of IS-1 is renamed to a path that has no case.
- **Mask table** (M2AUTH 4.13, C12): rows added to `MASKED` — `POST /api/admin/invites` `link` (kind `code`, shape `APP_ORIGIN/invite.html#c=` + `[A-Za-z0-9_-]{22}`), `POST /api/projects` `id` (kind `id`, shape the lower-case uuid). Kinds `id` and `time` get their first use here; `time` has none (times derive from the shared clock).
- **Canonical requests** (`isolation.test.js` `canonical`, `permission-matrix.test.js`): N1 a fresh invite for a throwaway e-mail; N2 the same invite with the full valid accept body; N3 the actor's own password; N4 a body for a new organisation, owner identity true, with an `owner_identity` re-auth token; N5 none; N6 a throwaway user and a `user_delete` token; N7 none; N8 a project of a customer organisation; N9 the same with a valid body; N10 none; N11 none; N12 a valid project body; N13 a project of the actor's own organisation; N14 the same with a valid body. The matrix's purpose map gains `POST /api/admin/invites` → `owner_identity` and `POST /api/admin/users/:id/delete` → `user_delete`.

---

## 8. Quality bar (Q1 – Q14, R1 – R3)

| Item | Applicable | How |
| --- | --- | --- |
| Q1 | yes | two REQ ids; every criterion names its test (section 7); the contract is `docs/requirements.yaml` REQ-116 and REQ-117 |
| Q2 | yes | the gate 1b repeats F1-F23 on a fresh clone of the tag; SECURITY-REVIEWER and REVIEWER read the code; TEST-DESIGN-VALIDATOR applies the mutants of section 11 |
| Q3 | yes | every fact has its command and output (section 1); what is not measurable on this PC is named (the row lock under real concurrency, M2R-1…M2R-3 in the pg job) |
| Q4 | yes | the one check `cd app && npm run check` is unchanged; `app.yml` is unchanged (its test steps pick up the new files by their folder globs); the run is on GitHub (decisions/0110) |
| Q5 | yes | every refusal test checks counts and the sha256 of the rows of the named tables (section 7); the mutants of section 11 name the test that catches each |
| Q6 | yes | no `skip`, `todo` or `only` (NPM-6); the guard edits of section 9 only widen lists, follow new files or add cases (each row says what is kept); no rule is removed; the exception of the word lists is the narrow one of REQ-111 criterion 3 as amended, with cases that prove it is narrow (FW-8, FW-9) |
| Q7 | yes | no secret is added: `mac("invite", …)` uses the existing pepper; the invite code, the re-auth token and the password never enter a log, an audit row (closed details keys) or an answer other than the one-time link; the consent record holds a digest; LG-3, INV-1 (dump search) prove it; the deletion removes the e-mail and name from the account and from the used invite |
| Q8 | yes | the organisation of a new member comes from the invite row, never from a request; no body has an organisation key (`organisation` of the admin invite names an existing organisation for the admin only); the project routes read the organisation from the session, filter by it explicitly and run under forced row-level security on one transaction switched by `switchToTenant` (C1, C2); the foreign object answers exactly like a missing one (IS-1, byte-equal 404 also for the plan's lookup); the admin routes answer the uniform 404 to everyone else (BRD-4, RT-3); the audit rows' organisation is the session's, never the plan's (TP-1, TP-5); `GET /api/auth/me` and every answer of the block never show another organisation's id or name (INV-12) |
| Q9 | yes | every statement is a constant text with bound parameters in a store file (SQL-1 over `app/server`, DBC-1); the one dynamic-looking statement, `insert … on conflict (user_id) where closed_at is null do nothing`, is a constant; the db-verify statements are unchanged |
| Q10 | yes | every path with customer data or input from the network answers a plain code (4.3.4, section 5): a failing database answers 503 within 4.9 s and writes nothing (INV-13, PRJ-6); the deadline guard of M2AUTH 4.5.2 rolls a late transaction back; a unique violation on the e-mail is mapped to `account_exists`; one request's failure does not touch others |
| Q11 | not applicable | the server calls no address a user sets; the invite link is built from `APP_ORIGIN` of the configuration, not from the request |
| Q12 | yes | C1-C20; the questions О1-О10 of section 13 go to ORCH with recommendations and a proposed decisions record before the gate; nothing silently differs from decisions/0100, 0127, 0133-0137 |
| Q13 | yes | the traps found here go to DOC-UPDATER as proposed anti-patterns (section 12): a hook that writes an audit row after the switch to tenant settings is silently refused by the writer (F4); a guard test that sends an empty body to every object route hides the 404 behind a 400 (F17); a body key named `org_id` on a legitimate route turns the key-refusal suite red (F17); an exact-path list of «routes that change the session» misses a route with a path parameter |
| Q14 | yes | the handoff result now; the status lines of REQ-116 and REQ-117, STATE.md and PROGRESS.md by DOC-UPDATER at step 10 |
| R1 | yes | the push to main after green checks (0134 item 2); the deploy, the owner's second identity (the UAT identity), his answer «б» of G7 and the approval of the consent wording are the owner's |
| R2 | not applicable | no Pixel Office event is written in M2 |
| R3 | not applicable | decisions/0033 |

---

## 9. Replacement table of earlier guard tests (greps of `app/test` and `tools/test`, F20; the prohibition is never weakened)

Lines are those of the base 60b10b7. «Counts» says what the test counts (a literal list, a directory scan, a table read at test time).

| # | File, line | Was → became | What it counts |
| --- | --- | --- | --- |
| G1 | `app/test/unit/route-table.test.js:206` `RATE_LIMITS` | `["setup","login","reset","user",null]` → plus `"invite"` and `"invite_view"` (RT-2 still refuses `"hourly"`) | literal |
| G2 | `route-table.test.js:208` `PURPOSES`; `app/test/int/auth-reauth.test.js:14` `PURPOSES`, and RA-5 (`auth-reauth.test.js:225-290`, `CASES`) | the 11 purposes → plus `user_delete` (the closed table of M2AUTH 4.9.4 gains the row of C12). RA-5 reads the real route table and asserts a case for every route whose `meta.reauth` is not null: `CASES` gains `POST /api/admin/invites` (purpose `owner_identity`, a valid N4 body for a new organisation) and `POST /api/admin/users/:id/delete` (purpose `user_delete`, a throwaway user as `:id`), each with the same checks as the existing cases (one use, bound to user, session and purpose; no token → 403 `reauth_required` and counts unchanged); a route with a re-auth purpose and no case still fails | literal + table read at test time |
| G3 | `route-table.test.js:281-298` RT-1 | `rows.length >= 15` → `>= 29`; the `admin` map of 5 routes → the 12 admin routes (the five of M2AUTH plus N4-N10) with their purposes (`POST /api/admin/invites` → `owner_identity`, `POST /api/admin/users/:id/delete` → `user_delete`, the others null); «every row has `tenant` false» → `tenant` is true exactly for N11-N14 and false for every other row; `reauth` is null for every route not in the map; `worker` false for all | read at test time + literal |
| G4 | `route-table.test.js:14` `scannedFiles` (RT-6) | `server/routes/{auth,admin}.js` → plus `server/routes/invites.js`, `projects.js`, `admin-projects.js`; the list of codes the scan must find gains `forbidden`, `personal_data_gate`, `registration_closed`, `account_exists`, `consent_stale`; the rule «every code literal is in `AUTH_CODES`» is unchanged | literal + a scan |
| G5 | `app/test/unit/texts.test.js:1566` `AUTH_CODES_OF_THE_DESIGN`, `:1596` `length` 23 (TX-11) | the 23 codes → the 31 (plus the eight of 4.3.4); `length` 31; the title «the 23 codes» → «the 31 codes» (the name follows the list, the rule is the same); the equality with `AUTH_CODES` of `app/public/js/api.js` is added | literal |
| G6 | `app/test/int/isolation.test.js:629` `CASES`, `:520` `canonical` default, `:575` `opt`, `:634`, `:645`, `:798` (IS-1, IS-4) | `CASES = {}` → the four cases of 7.5; `canonical` throws «no canonical request» for an unknown route → the 14 new routes have their requests (7.5); `opt` sends `{}` on every non-GET → `c.body ?? {}` (an object case may carry a valid body, F17); IS-1 `table.length >= 15` → `>= 29`; the planted row `path: "/api/projects/:id"` (expects «a tenant route without a case») → the path `/api/planted/:id`, since the real route now has a case; IS-4 `routes.length >= 11` → `>= 18` | table read at test time + literal |
| G7 | `isolation.test.js:36-62` `KINDS`, `MASKED` | `MASKED` gets the two rows of 7.5 (`link` of the admin invite, `id` of a created project); `KINDS` unchanged | literal |
| G8 | `app/test/fixtures/permission-matrix.golden.json`, `app/test/int/permission-matrix.test.js:117` `purpose` | 90 rows → 174 (the 84 rows of 4.3.2 for N1-N14 × 6 actors, written from the design's table, not from answers); the route-to-purpose map gains the two routes of G3; the test's canonical requests follow 7.5; PM-2 (a route or actor without its row fails) unchanged | read at test time + golden file |
| G9 | `app/test/int/auth-csrf.test.js` `CASES` (CS-1) | the cases of the existing non-GET session routes → plus the seven new ones (`POST /api/invites/:code/accept`, `/api/account/deletion-request`, `/api/admin/invites`, `/api/admin/users/:id/delete`, `/api/admin/projects/:id/idea`, `/api/projects`, `/api/projects/:id/idea`); a route without a case still fails; the route-count printed is the table's | table read at test time |
| G10 | `app/test/int/auth-session.test.js:316` SS-9 | memberships `[{org_id, role}]` → `[{org_id, name, kind, role}]`; the answer gains `deletion_requested_at`; «no hash or TOTP field» unchanged | literal |
| G11 | `app/test/int/rate-limit.test.js:232` RL-4, `:317` RL-5 | RL-4's list of limits gains `invite` (10 per hour per address), `invite_view` (60) and the daily `project` (20 per user per 24 h); RL-5 gains «an unused invite expired more than 30 days ago is removed, a used one and a younger one stay»; the case reaches the cleanup through a request of a **platform** route (an admin route or an auth route), because the cleanup runs at step 12 under the settings the handler left and on a tenant route that is tenant settings, which row security filters to the caller's organisation (N1 of the gate) | literal |
| G12 | `app/test/pg/rls.test.js:90` RLS-1, RLS-2 (`tenantTables`, line 49), RLS-5 | `r.count >= 3` → `>= 5`; RLS-2 and RLS-3 read the tenant tables from `information_schema` (so `projects` and `idea_versions` join: the `fixture()` of that file inserts a project and a version for each of A, B and C); RLS-5's grants table → the table of 4.2.4 (org_members +DELETE, invites +DELETE, the four new tables); RLS-4 unchanged | read at test time + literal |
| G13 | `app/test/int/migrate.test.js:47-70` MG-1, `:290` `APP_GRANTS` (MG-6) | MG-1's table list of 13 → 17 (`deletion_requests`, `idea_versions`, `projects`, `user_consents` added, sorted); `APP_GRANTS` gains the lines of 4.2.4; MG-7's file rules unchanged (the new blocks satisfy them) | read at test time + literal |
| G14 | `app/test/unit/npmrc.test.js:34` `INT_FILES`, `:48` `PG_FILES`, `:51-55` `E2E_FILES`/`E2E_TESTS`, NPM-5 title | `INT_FILES` 26 names → plus `invites`, `deletion`, `projects`, `admin-board`, `tenant-plan` (31); `PG_FILES` 6 → plus `owner-org`, `m2-race-pg` (8); `E2E_FILES` `["landing","stage"]` → plus `accounts`; `E2E_TESTS` plus `ACC-1`, `ACC-2`; the title numbers follow the lists | literal |
| G15 | `app/test/unit/public-pages.test.js:28` `PAGES`, PP-1 title and list, PP-2 `:384` | the ten pages → the twenty (plus `account`, `admin`, `admin-audit`, `admin-deletions`, `admin-invites`, `admin-request`, `invite`, `project-new`, `project`, `projects`; sorted); PP-2's rule «the demo page and each account page load their own module, the others the landing module» → the five client pages load `/js/pages/<name>.js` and the five admin pages `/js/admin/<name>.js`; PP-4 and the head rules apply to the new pages unchanged | a directory scan asserted as a list |
| G16 | `app/test/unit/public-build.test.js:29-35` `CHANGED`, `:800-808` PB-6 page list, PP-7 list at `:836` (and `public-pages.test.js:839`); `app/test/unit/vercel-build.test.js:23` `CHANGED` | the lists of pages gain the ten new ones; each new page holds exactly one `sai:kk` region around its kk button and no order region (the rule `ACCOUNT_PAGES` already holds), so the open build changes it and it joins `CHANGED` (the rule «every other file byte for byte» still holds for every file not on the list); `ACCOUNT_PAGES` is renamed to cover the 14 pages with a region | a directory scan asserted as a list + literal |
| G17 | `app/test/unit/forbidden-words.test.js` FW-7 (copies the whole real `app/public`, no page list) and the cases | FW-7 on the real files stays exit 0 and needs the exception of 4.8 to exist (the five consent values hold the deletion term); FW-8 and FW-9 (the cases of REQ-111 criterion 3's exception, each on a planted copy) are added; the M1 cases unchanged | a directory copy |
| G18 | `app/test/unit/rehearsal-seeds.test.js` SEED-1 | reads `db/migrations` and `test/fixtures/rehearsal` at test time: it is red until `0003_projects.sql` stands in the seeds (4.2.5); the rules (names equal, e-mails under `example.test`, no key shape) unchanged | directory scan |
| G19 | `app/test/unit/security-invariants.test.js` SI-1 | the 13 rows → 19 (4.10) | read at test time |
| G20 | `app/test/int/logging.test.js` | LG-1 and LG-2 unchanged; LG-3 added | — |
| G21 | `app/test/fixtures/auth.js:22` `TABLES` | the 13 tables → 17 (the four new, sorted); every digest and row dump of the suites follows | literal |
| G22 | `app/test/unit/import-boundaries.test.js` | unchanged: the four shared modules under `app/public/shared/` import only inside `public/shared/` and have no `document` or `window`; `stages.js` has no `Math.random`, `Date.now` or `new Date`; the server's imports of `public/shared/` are allowed (line 446); the page scripts import `../api.js` and `../../shared/…` as `login.js` does | — |
| G23 | `app/test/unit/db-calls.test.js` (DBC-1…DBC-3), `no-string-sql.test.js` | unchanged: no service or route file calls `.query(`, `.exec(` or `.transaction(`; `set_config('app.role'` stays only in `db/tx.js`; the new stores are under `app/server/db/` | — |
| G24 | `app/test/unit/check-public` cases of `forbidden-words.test.js` FW-7 | unchanged on the real files (exit 0 with the new texts, the exception read from `word-lists.js`) | — |
| G25 | `tools/test` | none: `grep -rln "app/db\|app/server\|app/public" tools/test tools/src` is empty (F20) | — |
| G26 | `app/test/int/auth-db-down.test.js`, `selfcheck.test.js`, `health.test.js`, `demo*.test.js`, `api-entry.test.js`, `app/test/e2e/landing.test.js`, `stage.test.js` | unchanged (the demo rows and the public pages are not touched; `M2P-4` proves it by sha256) | — |

---

## 10. Build sub-steps (small; each with the existing tests that turn red, by reading their assertions)

On this PC nothing runs (0110, 0129): each sub-step's evidence is the GitHub run of the snapshot; the developers name the tests they expect red in their handoffs, by this table. A red test not in the row is a stop and a report to ORCH.

| # | Owner | Sub-step | Existing tests red until T fixes them (step 5) |
| --- | --- | --- | --- |
| B1 | B | the HTTP contract: `errors.js` (eight codes, `AUTH_CODES`), `schema.js` (`bool`), `plan.js`, the step 9a of `auth-mw.js` and the `plan` field, `rate-limit.js` (three limits), `keys.js` label `invite`, `reauth.js` purpose `user_delete`; no route uses them yet | TX-11 (G5; also needs F2's texts); RT-1's allowed lists are not yet read (G1, G2 stay green until the rows exist) |
| B2 | B | `0003_projects.sql`, `grants.sql`, the rehearsal seed `0003_projects.sql` | MG-1 (G13), MG-6's `APP_GRANTS` (G13), RLS-5 (G12), **RLS-2 and RLS-3** (G12: they read the tenant tables from `information_schema` and demand fixture rows of the three organisations for every one, so `projects` and `idea_versions` turn them red until the `fixture()` of `rls.test.js` inserts them); SEED-1 is green with the seed |
| B3 | B | `audit.js` (actions, details keys), `auth-store.js` (memberships, the stale-invite cleanup), `org-store.js`, `project-store.js` | none (no route calls them yet); RL-5 stays green until the cleanup is read (G11) |
| B4 | B | `services/orgs.js`, `services/projects.js`, the shared modules read from `public/shared/` (after F1) | none |
| B5a | B | the routes of REQ-116: `routes/invites.js` (N1, N2), `routes/admin.js` (N4-N6), `routes/auth.js` (N3, `me`), their rows in `routes/index.js` | RT-1 (G3), SS-9 (G10), CS-1 (G9), PM-1 and PM-2 (G8), IS-4, IS-5 (G6, G7), RA-5 (G2), RL-4 (G11) |
| B5b | B | the tenant routes with their plans: `routes/projects.js` (N11-N14) and their rows | the table-reading tests of B5a stay red (they turn green at step 5); new: IS-1 (a tenant route without a case, G6) |
| B5c | B | the admin board, card and audit routes: `routes/admin-projects.js` (N7-N10) and their rows | none new (the table-reading tests are red already) |
| B6 | B | `word-lists.js` (`CONSENT_KEYS`, `DELETION_TERM`, `stripDeletionTerm`) and `check-public.js` | none until the consent keys exist (the constant names keys of the texts module: FW-8's «a constant that names a key missing from the texts module» is red until F2) |
| B7 | B | `docs/security-invariants.md` (6 rows) | SI-1 (G19) |
| F1 | F | the four shared modules (`stages.js`, `quick-facts.js`, `kz.js`, `consent.js`) | none (new files; import-boundaries stays green) |
| F2 | F | `texts.js` keys (the consent sentences, the footer, the stage names, the quick facts, the page families, the eight error texts) | TX-11 (green with B1), FW-7 on the real files (green with B6) |
| F3 | F | `api.js` (codes, `reauthToken`, `sessionChanges`), `site.css` rules | none |
| F4a | F | the client pages and scripts: `invite`, `account`, `projects`, `project-new`, `project`; the footer on the four account pages; `login.html`/`login.js` links | PP-1, PP-2 (G15), PB-6, PP-7, `CHANGED` of both build tests (G16) for the five pages; FW-7 until the exception and the texts are in (G17) |
| F4b | F | the admin pages and scripts: `admin`, `admin-request`, `admin-audit`, `admin-invites`, `admin-deletions` | the same tests for the five pages |
| T1 | T | the guard edits G1-G24 | — |
| T2 | T | the unit tests of 7.3 | — |
| T3 | T | the int tests of 7.3 and `tenant-plan.test.js` | — |
| T4 | T | the pg tests, the golden file, `fixtures/auth.js`, `fixtures/browser.js` `serveAccounts` | — |
| T5 | T | the e2e test | — |

---

## 11. Mutants (intentional breakages, one per trap; 74: M1–M74; at least one per criterion)

The gate applies at least 10 of them on a fresh clone (WF-02 1b); TEST-DESIGN-VALIDATOR applies the rest.

| # | Breakage | Caught by |
| --- | --- | --- |
| M1 | `POST /api/projects` has no plan (no audit row) | PRJ-1 (audit count), TP-1 |
| M2 | the pipeline appends the plan's audit row after `switchToTenant` (the writer refuses, 500) | TP-1 |
| M3 | the pipeline builds the entry as `{ …session values, …planned.audit }` (the plan's keys last), or copies the four keys with no check of the others | TP-5 (an `orgId` or `actorKind` key in the plan: no TypeError, or a row of another organisation), TP-1 |
| M4 | the audit row is written in a transaction of its own before the handler | TP-2 (the row survives a failing handler) |
| M5 | `withPlan` accepts a row with `tenant: false` | TP-4, RT-7 |
| M6 | the plan's `lockProject` filters by id alone (no organisation) | IS-1 (a foreign project answers 500 instead of the 404 of a missing one) |
| M7 | the role check is dropped from the plan of N12 | PRJ-2 |
| M8 | the title limit is 121 | PRJ-3 |
| M9 | the idea limit is 8 001 | PRJ-3 |
| M10 | the idea's control or invisible sign check is skipped | PRJ-3 (U+0001, U+200B) |
| M11 | a quick fact is a free text | PRJ-3 |
| M12 | the project body accepts a key `org_id` | PRJ-3, IS-4 |
| M13 | the daily limit is 21 | PRJ-4 |
| M14 | the daily window is one hour | PRJ-4 (a request two hours later is still refused in the test's clock step) |
| M15 | the quota is counted per address, not per user | PRJ-4 (the second user from the same address) |
| M16 | `GET /api/projects` lists without the organisation filter, on platform settings | PRJ-5, IS-2 |
| M17 | `GET /api/projects/:id` reads by id alone | IS-1 |
| M18 | `lockProject` without `for update` | M2R-2 (duplicate or missing versions under 10 parallel edits) |
| M19 | an edit updates the newest version instead of inserting | PRJ-7 (the sha256 of the earlier row), RLS-6 |
| M20 | an edit does not set `updated_at` | PRJ-7 |
| M21 | a viewer may edit an idea | PRJ-8 |
| M22 | the reason is optional on an edit | PRJ-8 |
| M23 | the admin's edit writes `actor_kind` `user` | PRJ-9 |
| M24 | the admin's edit writes no organisation on the audit row | PRJ-9 |
| M25 | the trigger lets a DELETE pass for any `app.purge_org` value | RLS-6 |
| M26 | the trigger lets an UPDATE pass when the setting is set | RLS-6 |
| M27 | the purge deletes the projects first (the foreign key refuses; the transaction rolls back) | DEL-7 (counts not 0) |
| M28 | the purge runs although another member stays | DEL-7 |
| M29 | a second file holds `delete from idea_versions` | DEL-8 |
| M30 | the text `purge_org` stands in a service file | DEL-8 |
| M31 | a route file holds `update projects` | STG-4 |
| M32 | `moveStage` skips `canMove` | PRJ-11 |
| M33 | the stage table allows `draft → accepted` | STG-2 |
| M34 | `archived` is not reachable from `accepted` | STG-2 |
| M35 | `stages.js` reads `Date.now` | STG-3 |
| M36 | `kz.js` uses `toLocaleString` | KZ-5 |
| M37 | `kz.js` reads the zone of the process (`getTimezoneOffset`) | KZ-3, KZ-5 |
| M38 | `kz.js` uses UTC+6 | KZ-1 |
| M39 | `kz.js` treats 2028 as not a leap year | KZ-1, KZ-2 |
| M40 | `kz.js` groups digits with a plain space | KZ-1 |
| M41 | the invite code is stored in clear | INV-1 (the dump search) |
| M42 | the invite lives 8 days | INV-1 |
| M43 | accept ignores the expiry | INV-5 |
| M44 | accept does not claim the invite (no `used_at`) | INV-4 (`used_at` and `used_by` set); INV-5's used-code case (a code planted as used with no account: the answer is `not_found`, not `account_exists`) |
| M45 | the e-mail is compared without the normalisation of ARCH §4 | INV-4 (the upper-case e-mail) |
| M46 | the e-mail is not compared at all | INV-5 |
| M47 | `consent: false` is accepted | INV-5 |
| M48 | the consent digest is not compared | INV-5 |
| M49 | kk consent is accepted when the served texts have no kk | INV-5 (a language with no complete text) |
| M50 | the gate is not checked at acceptance | INV-5 (the planted row) |
| M51 | the gate is not checked at creation | INV-2 |
| M52 | the source constant is `"invited"` | INV-2 (the pin) |
| M53 | the accept body takes the organisation (a key `organisation`) | IS-4, INV-5 |
| M54 | a new organisation is created with `ai_allowed` true | INV-4 |
| M55 | `closed` is ignored | INV-9 |
| M56 | an unrecognised mode value behaves as `invite` | INV-9 |
| M57 | a second route creates a user without an invite code | INV-10 |
| M58 | the invite route has `reauth: null` | INV-2 (a creation without a token succeeds), RT-1 |
| M59 | the `invite.create` audit row lacks `reauth_id` | INV-1 |
| M60 | a refused accept writes an audit row | INV-5 |
| M61 | GET of a used code answers a body different from an unknown code | INV-3 |
| M62 | the accept limit is 11 | INV-7 |
| M63 | an accept keeps the caller's old session | INV-4 |
| M64 | deletion keeps the e-mail or the memberships or the re-auth tokens | DEL-5 |
| M65 | the deletion's scrub of the used invite's e-mail is skipped | DEL-5 |
| M66 | a login after deletion answers unlike an unknown e-mail | DEL-5 |
| M67 | the admin account can be deleted | DEL-6 |
| M68 | the delete route has `reauth: null` | DEL-6, RT-1 |
| M69 | a second deletion request adds a row | DEL-2 |
| M70 | a wrong password stores the request | DEL-3 |
| M71 | the board's counts are the number of listed rows (capped) | BRD-1 |
| M72 | an unknown `?stage=` answers 200 | BRD-2 |
| M73 | the card read writes no audit row, or two | BRD-3 |
| M74 | the board answers 403 to an `org_owner` instead of the uniform 404 | BRD-4 |

Further breakages, each with its own catching test, are grouped here (the gate may apply any): the audit page unbounded or in descending order (ADT-1); the audit page returns `ip_hmac` or an unlisted details key (ADT-2); a page without the footer (M2P-2); `#consent` checked by default or the sentences in the HTML (M2P-3, FW-9, ACC-1); the exception strips the whole value, twice, or in a key outside `CONSENT_KEYS`, or `CONSENT_KEYS` holds a sixth key (FW-8, CON-5); the users guard trigger dropped (OO-3); the unique key on `org_members.user_id` dropped (OO-2); the action `admin_read` misspelt, or `project.create` missing from the writer's list (BRD-3, PRJ-1); `me` shows another organisation's name (INV-12); a golden row wrong (PM-1); a route row with a seventh meta key or without `rateLimit` (RT-1, RT-2); the cleanup deletes used invites (RL-5).

---

## 12. Post-deploy record and what becomes outdated outside the project (for DOC-UPDATER)

**Post-deploy (not criteria; RELEASE-FINALIZER and RELEASE-VALIDATOR).** After the release the owner invites his second identity (the UAT identity of REQ-114 criterion 11) into the owner organisation (`POST /api/admin/invites` through `/admin-invites.html`, the owner-identity box ticked, the organisation chosen as the owner organisation) and accepts it; RELEASE-VALIDATOR checks on production that an invite not for an owner identity is refused with `personal_data_gate` while G7 is «а» (REQ-116 post-deploy line), reads the cookie flags of the new accept, and, through `app/scripts/uat-login.js` with that identity, creates one project on production, finds it on the board under «Новые», edits it with a reason and finds the actions in the audit log (REQ-117 post-deploy line). The release report names two accepted residuals (decisions/0138 Addition 1): the purge setting `app.purge_org` can be set by any statement run as `sai_app` (the app has no such statement), and an `org_owner` deleted from an organisation that keeps other members can leave it without an owner. The migration 0003 runs in the build (`vercel-build`) after the owner's Neon restore point (`docs/runbooks/backup-restore.md`, «Before a deploy that carries a migration»).

**Outdated outside the project:**

- ARCH §4: `projects` (+ `unique (org_id, id)`), `idea_versions` (+ the composite key, the `(version = 1) = (reason is null)` check, the insert-only purge exception), the new tables `user_consents` and `deletion_requests`, the columns `invites.owner_identity` and `invites.org_name`; ARCH §5 re-auth purposes (+ `user_delete`) and the invite rules (the re-auth on every invite, C12); ARCH §13 rows (`POST /api/account/deletion-request`, `GET /api/admin/deletion-requests`, the `organisation` and `org_name` body keys of `POST /api/admin/invites`); ARCH §14.3 (`invite_view`); ARCH §14.5 (the new audit actions); ARCH §17 (kz.js API): rows of «Plan amendments» (decisions/0091).
- `docs/design/M2AUTH-accounts-tenancy-backup.md`: the closed purpose table of 4.9.4 (+ `user_delete`), the route table 4.4 (+ the 14 rows), the `me` answer, `AUTH_CODES` 23 → 31, `MAC_LABELS` + `invite`, the lazy cleanup, the pipeline step 9a — a note that this design extends them (the M2AUTH file itself is history).
- `docs/runbooks/`: a short runbook for the deletion requests of the owner («within 15 working days», admin page) is not written in this work; the incident runbook's pepper-rotation note already says every session, token and code ends (invite codes too).
- PLAN §5 M2 R2.2/R2.4/AC2.10/AC2.6; PROGRESS.md: G7 stays «а» (the constant), the consent wording stays a draft (decisions/0100 item 6), the legal draft pages are their own requirement before M3 is released (decisions/0135 О3 Addition); the demo carry-over of R2.4 is out (0135 О10).
- Proposed anti-patterns (Q13, section 8).
- LOW defects to open (list for DOC-UPDATER, gate 1b N4 and N5): (a) the deletion of an `org_owner` can leave an organisation without an owner (decide the rule when M3 adds the owner-only approvals); (b) the purge setting `app.purge_org` is settable by any statement run as `sai_app`: a SECURITY DEFINER purge function and no DELETE grant on `idea_versions` and `projects`.
- The post-deploy record (above) names the residual of N5.
- STATE.md counts and the status lines of REQ-116 and REQ-117 at step 10; REQ-024, REQ-059, REQ-064, REQ-077, REQ-078, REQ-019 and REQ-079 are rescoped by result.rescoped of the REQ-ANALYST step (decisions/0135 О14), not here.

---

## 13. Questions for ORCH (each with a recommendation; ORCH answers them before the design gate)

| # | Question | Recommendation |
| --- | --- | --- |
| О1 | **Where the statements of projects stand.** REQ-117 criteria 3 and 9 print `update projects` and `delete from idea_versions` as lines of `app/server/services/projects.js` only; DBC-1 (REQ-115, released) forbids any database call outside `app/server/db/` and its rule «services never run a statement» is what M2AUTH 4.5.4 built (F16). Both cannot hold with the text in the service and the call in a store | The statements stand in `app/server/db/project-store.js`; a micro-amendment of REQ-117 criteria 3 and 9 (the two greps name `app/server/db/project-store.js` instead of `app/server/services/projects.js`; the meaning «only the projects code changes a project and deletes versions» is unchanged) by REQ-ANALYST and REQ-VALIDATOR before step 2, in the form of decisions/0079 item 5. If ORCH refuses the amendment, the only form that meets both texts is the service holding the statement texts as constants and handing them to a one-function runner of `app/server/db/`, which empties DBC-1 of its meaning; not recommended |
| О2 | **Re-auth purposes.** (a) `POST /api/admin/invites` consumes `owner_identity` on every invite, not only for an owner identity (a body-dependent `meta.reauth` does not exist); (b) `POST /api/admin/users/:id/delete` needs a re-auth token and the REQ names no purpose: add `user_delete` (the closed table of M2AUTH 4.9.4, the 0003 check, two test literals, ARCH §5) | (a) yes; (b) yes. Under the default gate every invite is for an owner identity anyway; the owner enters his password once more |
| О3 | **The name of a new customer organisation and the key `organisation`.** The requirement names no source for `orgs.name` of a new organisation (C19) and IS-4 forbids a body key `org_id`/`orgId` (F17) | the owner types the organisation's name on the invite (`org_name`, 1-120 characters, a column of `invites`); an existing organisation is named by the key `organisation`; the invited person never names an organisation |
| О4 | **The stage transitions** (REQ-117 «the allowed transitions» without a table): the minimal forward table of 4.7 (20 of 121 pairs: the chain, `delivered → accepted`/`returned`, `returned → in_development`, and `archived` from every other stage) | take it; M3-M5 requirements extend it with a «was → became» row; a proposal for a decisions record |
| О5 | **Consent language.** The server accepts a consent only in a language whose five sentences its served texts hold (C9, F14): on production ru and en; kk (a draft for a native reader, decisions/0100 item 6, gate G9) is refused with `consent_stale` and not listed by `GET /api/invites/:code` | yes |
| О6 | **Audit of the board list.** ARCH §14.5 lists «admin read of tenant data»; REQ-117 criterion 5 audits the card only. The board shows titles, organisation names and times | audit the card only (the REQ's text); the list is not audited |
| О7 | **Personal data in invites.** The `invites` row holds the invited e-mail: (a) the lazy cleanup removes unused invites expired more than 30 days ago (ARCH §4 retention; `invites` gets DELETE); (b) a deletion replaces the e-mail of the invites that user used (C10) | yes to both (decisions/0100 items 1 and 5) |
| О8 | **A deletion request by the platform admin** is refused with 403 `forbidden` (his account cannot be deleted; a request that cannot be carried out is not stored) | yes |
| О9 | **The look of the client pages.** decisions/0137 О6 says G21 «comes with the client-facing pages of REQ-116 and REQ-117»; the route of this run (handoff context) has no GUI-DESIGN-ANALYST step before step 2. The pages of 4.9 are functional forms on the existing styles with a closed id contract | ORCH decides: either a WF-04 look description of the invite, project-list, new-project and project pages is inserted before step 2, or the pages are built as designed and the owner's G21 «похоже» is asked on the UAT screens (a change of look then comes as a rework of F4 only) |
| О10 | **A client-side idea edit form.** The route N14 is required by criterion 2; the form on `project.html` is not (the description names «Изменить заявку» as the owner's feature) | include the small form (members and above; a viewer sees none): it is the only way a client corrects his own idea on the goal path; it costs one form and the existing route |

**Proposal for a decisions record (ORCH, step 1a, before gate 1b):** `decisions/0138-m2proj-code-design-conventions.md` with the section «Основание»: the settlement of О11 of decisions/0137 (C1: the plan hook, audit before the switch), C2-C20 as written, and the answers to О1-О10. The code design never differs silently from it (Q12).

---

## 14. The sketch (`result.prototype`)

A fresh clone of the tag `base/M2PROJ-20261124-01` (`git clone -c core.autocrlf=false`) under `<scratch>/m2proj-01/sai`, `npm ci` in its `app/`, and in `app/sketch/` of that clone: `mig/` (0001 and 0002 copied, and a trial `0003_projects.sql`), `grants3.sql` (the grants file extended), `t1.mjs` (F5-F10: the audit-then-switch transaction and its rollback, row-level security of the new tables, the composite key, the version checks, the insert-only trigger and the purge setting, the users guard, the invite rules, the widened checks, the grants, the `org_id` tables), `t2.mjs` (F8: the owner-role trigger behaviour before the switch to the login role), `t3.mjs` (F12, F13: the consent sentences' word counts, lint and digests; the KZ arithmetic against the criterion's rows and 5 000 seeded moments), `t4.mjs` (F11: five parallel edits), `t5.mjs` (F2, F3: the route table, the codes, the labels, the boolean body), `t6.mjs` (F22: the deletion-request statement and the stale-invite cleanup statement), `t7.mjs` (F23: the repaired step 9a formula with a plan that carries an organisation key). The clone's own `app/server/services/audit.js` got the seven new action names so the sketch could run the real writer; no file of the project was touched. No server was started, no app test, check or e2e was run, no port bound.

---

## 15. Counts and their commands

- Criteria: REQ-116 10, REQ-117 12 = 22; rows of section 7: 22 (`grep -c` of the `| <n> ` rows of 7.1 and 7.2).
- New product files: server and db 9 (`0003_projects.sql`, `plan.js`, `org-store.js`, `project-store.js`, `orgs.js`, `projects.js` service, `routes/invites.js`, `routes/projects.js`, `routes/admin-projects.js`) plus the seed `0003_projects.sql` = 10; shared 4 (`stages.js`, `quick-facts.js`, `kz.js`, `consent.js`); pages 10 and page scripts 10. Changed: 15 backend files (`grants.sql`, `auth-mw.js`, `schema.js`, `rate-limit.js`, `errors.js`, `keys.js`, `reauth.js`, `auth-store.js`, `audit.js`, `routes/admin.js`, `routes/auth.js`, `routes/index.js`, `word-lists.js`, `check-public.js`, `security-invariants.md`) and 8 frontend files (`texts.js`, `api.js`, `site.css`, the four account pages, `login.js`).
- New tests: 79 (unit 26, int 44, pg 7, e2e 2); 73 of them in 12 new files, 6 in existing files (FW-8, FW-9, TX-12, RT-7, LG-3, RLS-6).
- Mutants: 74 numbered (M1-M74) and the group of section 11.
- Routes: 29 (15 + 14); `AUTH_CODES` 31; `PURPOSES` 12; `LIMITS` 7 (setup, login, reset, user, invite, invite_view, project); `MAC_LABELS` 11; audit actions 22; tables 17 (13 + 4); `idea_versions` and `projects` are the 4th and 5th tables with an `org_id` column after `org_members`, `invites`, `audit_log` (completeness count 5).

---

## 16. Rework 02b (decisions/0138 Addition 2)

| # | Fix | Where | Test that catches it |
| --- | --- | --- | --- |
| SEC F1 | `deleteAccount` removes every unused invite of the deleted account's e-mail (by `email_norm`, read from the locked users row), not only the invites he used; `acceptInvite` deletes the e-mail's other unused invites after the claim (`deleteUnusedInvitesOf` in `org-store.js`) | `services/orgs.js`, `db/org-store.js` | DEL-5 (no unused invite and no clear address left in `invites`), INV-4 (the second unused invite is gone; the old code answers 404) |
| SEC F2 | N13 answers the platform admin as author with the mark `{ "id": null, "name": null, "platform": true }`; an ordinary author keeps `{ id, name }`; N8 (admin card) is unchanged | `services/projects.js` (`readProjectForOrg`) | PRJ-10 (no admin id or name in the N13 body) |
| SEC F4 | `purgeOrg` reads the organisation's kind and throws a TypeError for kind `owner` before any delete | `db/project-store.js` | DEL-7 (a purge of the owner organisation is refused, counts unchanged) |
