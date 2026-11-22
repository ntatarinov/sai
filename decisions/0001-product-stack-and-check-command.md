# 0001 — Product stack and one check command (PUBLIC-V1)

Status: **accepted** (ORCH, 2026-10-28, on the owner's words of 2026-10-27 in `docs/owner-requests/2026-10-27-public-launch-plan.md` «…готовый сайт продукт был публичным на vercel а потом мы переедем на другой хостинг и домен…» and the launch line appended to that file as the start word; the owner may cancel). Fills the row reserved since the start of the project.

## Question

Which stack and which one check command does product code outside `tools/` use (quality bar Q4)?

## Options

- A (chosen): a new top-level folder `app/`, one npm package, Node 22 and plain JavaScript with JSDoc checked by `tsc`, few pinned dependencies, host-specific code behind adapters.
- B (rejected): grow the product inside `tools/src/team/` and `tools/src/web/`; those are the owner's local tools (decision 0003, 0015, 0024) and are never deployed (decision 0092 item 8).

## Decision

1. All product code lives in the top-level folder `app/`, one npm package (ARCH §2).
2. The stack, the pinning rule and the one check command are those of ARCH §3: Node 22.x ≥ 22.23.4, JavaScript with JSDoc, `hono`, `@hono/node-server`, `pg`, PGlite, `zod`, `fflate`, `@anthropic-ai/sdk` in the worker only, `playwright-core`; dev: `typescript` for `tsc`, `eslint`, `prettier`. Each dependency is listed in the first `app/` requirement's design with licence and reason. `ignore-scripts=true`; any exception is named in that design and added here as an "Addition". CI `app.yml` is green before any deploy.
3. Host-specific code sits only behind the adapters of ARCH §3.
4. The results of spikes S1–S3 are appended here as "Addition".

## Why

Portability (the owner's words above), a small auditable surface, and Q4: product code cannot become `done` without one check command.

## Boundary

`tools/` keeps decision 0002; `check.yml` is unchanged; no done requirement changes. Narrows decision 0015 for product code of the public site (it no longer lives in `tools/src/team/`; the team core there remains the engine the worker runs).

## Basis

`docs/owner-requests/2026-10-27-public-launch-plan.md` (quoted above, with the launch line); quality bar Q4; decisions 0002, 0015; `docs/program/public-v1/ARCHITECTURE.md` §2, §3.

## Addition 2026-11-18 (ORCH, the design of M1.3, `decisions/0118` О15)

The pins of `app/` measured by the design `docs/design/REQ-108-109-app-skeleton.md` (section 5; each version at least 14 days old, the lockfile from npmjs only, made with `npm install --before`): runtime `hono` 4.13.16, `@hono/node-server` 2.1.6, `pg` 8.23.1 (the production tree 16 packages, MIT/ISC; `npm audit --omit=dev` empty on 2026-11-17); development `@electric-sql/pglite` 0.5.15, `typescript` 6.0.3, `@types/node` 22.20.5, `@types/pg` 8.23.1, and the eslint and prettier versions of `tools/`. The two `@types` packages are added to the list of allowed development dependencies. TypeScript 7.0.2 is not taken (measured: 15 errors from type-checking JavaScript inside node_modules). The browser-test tool of `app/` is `playwright-core` (`decisions/0118` О1), added with the first browser test of `app/` (R1.2) with its own Addition here.

## Addition 2026-11-21 (DOC-UPDATER, run `M1CODE-20261119-01`, step 10: the pin of `playwright-core`, REQ-111 criterion 11; `decisions/0118` О1, `0123` О10, `0124` О7 and О12)

The browser-test tool of `app/` is `playwright-core`, the dependency that the first line of this record lists in item 2 and that `decisions/0118` О1 said would be pinned here with its first browser test (the e2e tests of R1.2, `app/test/e2e/landing.test.js` and `stage.test.js`).

- **Pin.** `playwright-core` **1.64.1**, exact (no range), in `devDependencies` of `app/package.json` only (line 32); the lockfile entry is `node_modules/playwright-core` 1.64.1, `"dev": true`, resolved from `registry.npmjs.org`, `"license": "Apache-2.0"`, no `dependencies` key, no `hasInstallScript` flag (no package of this lockfile has one; `ignore-scripts=true` of `app/.npmrc` stays), `engines.node` ≥ 20 (Sai runs 22.23.4 or newer).
- **Age.** Published 2026-10-14T11:54:58Z (read from the npm registry by the design, fact F16, and again by RELEASE-VALIDATOR at step 9), 38 days before the release commit, over the 14 days of the pinning rule of item 2 and `decisions/0118`.
- **Why this tool and not the own kit.** Sai has its own pure-Node Chrome kit in `tools/test/e2e/kit/` (`decisions/0107`, `0108`) and it stays the tool of `tools/`. The kit refuses the address `localhost`, which the protected preview host of `app/` needs, so the browser tests of `app/` use `playwright-core` (`decisions/0118` О1; planned in `docs/program/public-v1/ARCHITECTURE.md` §3 and §18). Nothing in `tools/` imports it.
- **Where it is used.** Only the test side: the one import of the package is `app/test/fixtures/browser.js` (`chromium`, `errors`); the e2e tests and their helpers name it in type comments only. It is not imported by `app/server`, `app/api`, `app/public`, `app/scripts` or `app/worker`, so it is not in the production tree (`npm ci --omit=dev` does not install it). The package ships no browser: the test launches the Chrome of the machine (`channel: "chrome"`); on the GitHub runner the job `e2e` of `.github/workflows/app.yml` prints the Chrome path and version first and then runs `npm run test:e2e` (`decisions/0124` О7: Chrome 157.0.8103.78 at `/opt/google/chrome/chrome`, measured at step 6 of the run).
- **How it was proved.** On GitHub, on the snapshot `ci/m1-landing-4` (commit f4ac340): `app.yml` run 44908361054 success with the job `e2e` «# tests 15, # pass 15, # fail 0, # skipped 0, # todo 0»; `check.yml` run 44908360975 success on the same commit.
- **The static part of REQ-111 criterion 11, closed by a search** (read-only, on the working folder at the time of writing): `grep -n '"playwright-core"' app/package.json` prints one line, 32, `"playwright-core": "1.64.1",` (inside `devDependencies`, after `globals`, before `prettier`); the lockfile entry above is at lines 1034–1042; `grep -rn "from \"playwright-core\"" app --include=*.js --exclude-dir=node_modules` prints one line, `app/test/fixtures/browser.js:6`; `grep -rln "playwright-core" app/server app/api app/public app/scripts` prints nothing.
- **What was not run.** The check in a pruned shallow clone (`git clone --depth 1`, every path outside the list of `app.yml` removed, `cd app && npm ci && npm run check`) that criterion 11 names is **not run on the owner's Windows PC**, by the owner's rule that the check commands run on GitHub only. Its two things are covered otherwise: the checkouts of `app.yml` are shallow and ran green on GitHub (above), and RELEASE-VALIDATOR proved by a search that every file of `app/` reading a path outside `app/` reads one that the list holds (step 9, criterion 11). The pruned run itself stays to be made on a machine where it is allowed, or accepted by the owner as covered by the GitHub runs; this is recorded in the status comment of REQ-111.

Boundary: no code, test or requirement changes with this Addition; the records above are not rewritten.
