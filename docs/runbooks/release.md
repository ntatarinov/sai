# Release of app/ to Vercel

Who: RELEASE-FINALIZER, after RELEASE-VALIDATOR PASS, the push, and `check.yml` and `app.yml` green on the pushed sha.

## 1. Deploy

```
git clone --quiet <origin URL> <outside the project>/deploy-<sha>
test "$(git -C <clone> rev-parse HEAD)" = "<pushed sha>"
test "$(git -C <clone> log -1 --format=%ae)" = "<team owner e-mail recorded at G3>"
cd <clone>/app && VERCEL_ORG_ID=<id> VERCEL_PROJECT_ID=<id> npx vercel@64.1.0 deploy --prod --yes --env APP_VERSION=<sha>   # verify at spike S1
node scripts/smoke.js --base <APP_ORIGIN> --expect-version <sha>
rm -rf <outside the project>/deploy-<sha>
```

The deploy command runs INSIDE the app folder of the export (`cd <export>/app`), never in the folder that holds it. On 2026-11-22 a deploy started one level up uploaded 121 files instead of 63 (the `.vercelignore` of app/ was not read), the build ran no install and no `vercel-build`, and production answered 404 on every path for about two to three minutes until the same command was repeated inside app/; the smoke check caught it at once. Always read the line «Downloading 63 deployment files» (the number of an allowlisted upload) and run the smoke check before anything else.

## 2. Rollback

```
npx vercel@64.1.0 rollback <previous production deployment URL>   # verify at spike S1
```

On Hobby only the previous production deployment can be rolled back to; the owner may use Instant Rollback instead. The database stays as it is: migrations are expand-only.

## 3. After a rollback

```
npx vercel@64.1.0 promote <deployment URL>   # verify at spike S1
```

`promote` turns the automatic assignment of the production domains back on, so the next release after a rollback ends with it.

## 4. Post-deploy record

`docs/uat/<RUN-ID>-prod.md`, by a RELEASE-VALIDATOR handoff `step-12-post-deploy.json`.
