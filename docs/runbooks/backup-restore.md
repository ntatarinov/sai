# Backup and restore of the app database

Who: the owner, with RELEASE-FINALIZER for the deploy steps. What it covers: the restore point before a deploy that
carries a migration, a logical dump kept outside the repository, a restore into a fresh database with its check, and
what the rehearsal job of CI proves (REQ-120; the code design `docs/design/M2AUTH-accounts-tenancy-backup.md`, 6.4).
The rollback of the code is `docs/runbooks/release.md`, section «2. Rollback»: the database stays as it is, because
migrations are expand-only (ARCH §19.5).

Addresses of databases never stand in a command line or a file of the repository: each one is set only in an
environment variable of the shell that runs the command (`SAI_DUMP_SOURCE`, `SAI_RESTORE_TARGET`, `SAI_VERIFY_A_URL`,
`SAI_VERIFY_B_URL`), typed by the owner from the Neon console.

## Before a deploy that carries a migration

1. Note the time in UTC just before the deploy (the restore point of the next section).
2. Where the Neon console offers it, take the manual snapshot of the branch.
3. Make the logical dump of the section «Logical dump».
4. Deploy by `docs/runbooks/release.md` (the build runs the migration).
5. Read `/api/health` of the deployment: `"ok":true`, `"role":"ok"` and `"migrations_pending":0`.

## Restore point in Neon

Read on 2026-11-23 on https://neon.com/docs/introduction/plans and https://neon.com/docs/introduction/branch-restore:

- the history window of the Free plan is 6 hours, up to 1 GB of changes; the Free plan has one manual snapshot;
- restore: Console, select the branch, then «Postgres database», «Backup & Restore», «Restore from history», and pick
  the noted UTC time;
- instant restore is supported for root branches only; the current data of the branch is overwritten, and Neon keeps
  a backup branch of the state before the restore (named `<branch>_old_<timestamp>`);
- the pricing page (https://neon.com/pricing, read on 2026-11-04) shows no instant restore on Free, which conflicts
  with the plans page: the owner's console decides; when it offers no restore from history, the logical dump below is
  the only way back.

The Neon owner role must read every row for `pg_dump` and for `db-verify`: forced row-level security hides rows from
a role without BYPASSRLS. Whether the owner role has it is read in spike S3 before the first dump (decisions/0137 О9);
without it `pg_dump` stops on the forced tables and `db-verify` refuses with «the role of A cannot read every row».

## Logical dump

With the pinned Postgres 17 client in Docker; the address only in `SAI_DUMP_SOURCE`; the files in a folder outside
the repository:

```
docker run --rm -e SAI_DUMP_SOURCE -v <a folder outside the repository>:/work postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac sh -c 'pg_dump --format=custom --no-owner --no-acl --dbname="$SAI_DUMP_SOURCE" --file=/work/app.dump'
docker run --rm -it -v <a folder outside the repository>:/work postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in /work/app.dump -out /work/app.dump.enc
docker run --rm -v <a folder outside the repository>:/work postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac rm /work/app.dump
```

The pass phrase of `openssl enc` is typed at its prompt and kept by the owner outside the repository; only the
encrypted file `app.dump.enc` is kept. The flags are those of the rehearsal job: `--no-acl` leaves out the grants,
which `migrate.js` sets again after a restore (decisions/0137 О1).

## Restore and verify

1. Create a fresh, empty database (a new Neon branch or a database of a local Postgres 17).
2. On another server than the source, the server-wide roles of `0001_init.sql` (`sai_app`, `sai_preview`,
   `sai_app_login` and their memberships) do not exist yet, and the dump holds neither them nor a step that makes them
   (0001 is recorded as applied in the dump). First create one more empty database on that server and run
   `node server/db/migrate.js` against it once (from `app/`, with `DATABASE_URL` of that database): 0001 creates the
   roles. Then restore into the fresh database of step 1.
3. Decrypt and restore:

```
docker run --rm -it -v <a folder outside the repository>:/work postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in /work/app.dump.enc -out /work/app.dump
docker run --rm -e SAI_RESTORE_TARGET -v <a folder outside the repository>:/work postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac sh -c 'pg_restore --no-owner --no-acl --dbname="$SAI_RESTORE_TARGET" /work/app.dump'
```

4. From `app/`, with `DATABASE_URL` of the restored database and `APP_DB_PASSWORD`: `node server/db/migrate.js`. It
   applies nothing new, sets every grant of `app/db/grants.sql` again and sets the password of `sai_app_login`.
5. From `app/`, with `SAI_VERIFY_A_URL` of the source and `SAI_VERIFY_B_URL` of the restored copy (each read by a role
   that can read every row): `node scripts/db-verify.js`. The last line must be `db-verify: equal` (exit 0); a line
   `db-verify: <table>: differs: <kind>` names the table and the kind of difference, never a value.
6. The selfcheck of the app refuses a runtime role that is a superuser, bypasses row security or owns a table: start
   the app on the copy and read `/api/health` (`"role":"ok"`).

## Delete the copy

Delete the decrypted dump as soon as the restore is checked, and the restored database when it is no longer needed:

```
docker run --rm -v <a folder outside the repository>:/work postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac rm /work/app.dump
```

The encrypted dump is kept only as long as the owner needs it; a Neon branch made for a check is deleted in the
console.

## Rehearsal in CI

The job `migration-rehearsal` of `.github/workflows/app.yml` runs on every push of app/ (before the job `e2e`): it
builds database A from every migration but the newest and their seeds (`app/test/fixtures/rehearsal/`), dumps it
with `pg_dump --format=custom --no-owner --no-acl`, restores it into B with `pg_restore --no-owner --no-acl`, runs
`node scripts/db-verify.js` (equal), migrates B to the newest migration, seeds it, runs
`node scripts/db-verify.js --previous-schema` (equal), checks that every table of B has a row, and starts the app on
B: the selfcheck and the smoke must pass. Its log is read with `gh run view <run id> --log` (job
`migration-rehearsal`). A migration that drops or retypes a seeded column turns the job red at the previous-schema
comparison before it can reach production.
