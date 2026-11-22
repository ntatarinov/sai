# ISS-0129 — Parts of REQ-108 criteria 2, 11 and 14 that nobody ran in Linux CI: the pruned-clone run, the emptied-pg-folder and one-pg-test-removed runs, the real-Chrome step of the gate page with SITE_GATE set

Серьёзность: LOW. Статус: open. Найдено: RELEASE-VALIDATOR (шаг 09, находка M1, прогон `M1RECHECK-20261122-01`, `handoffs/M1RECHECK-20261122-01/step-09-release-validator.json`), решение ORCH принять PASS и завести этот дефект; заведено DOC-UPDATER (шаг 10), 2026-11-22T07:49:02Z. Пункт планки: Q3 (проверка, которую никто не запускал, не названа выполненной; статус `done` записан с этим пределом).
Требования: REQ-108 (критерии 2, 11 и 14; сделано, статус `done` с пределом в комментарии), REQ-109 (критерий 8, закрытая сборка; тот же предел для страницы шлюза).

## Что не так

The properties are met by the CI log of `e0a425b` and by guard tests with planted copies in the unit step (app run 44919421105, green), but some runs of the criteria were made by nobody: the owner's rule bars `npm run`, `node --test` and browser or e2e runs on his Windows PC, and no CI step makes them.

1. **REQ-108 criterion 11**, the pruned-clone run: remove every path that `app.yml` does not list in `paths`, then `cd app && npm ci && npm run check`, exit 0 (the release report of `M1CODE-20261119-01` also says it was not made). The GitHub checkout of the pushed commit is a clean copy, which proves the same property only in part.
2. **REQ-108 criterion 11**, the emptied-pg-folder run and the run with one pg test removed: each must make the pg count guard red. The guard itself sits in the unit step and is green; the two damaged-tree runs were not made.
3. **REQ-108 criterion 14**, the real-Chrome step for the gate page with `SITE_GATE` set (the 503 page of the closed site): no run ever opened the page in a browser; and the status that Vercel gives that static page was never measured (spike S1 measured deploy, health and `vercel curl`; `docs/runbooks/incident.md` still says S1 will). The pages `/` and `/nope` of the open site in a real Chrome are recorded in `docs/uat/M1CODE-20261119-01-prod.md` (48 of 48 page-cell audits PASS).

Not part of this defect (the same re-check named them; they stay open items of milestone M1): the runbooks' words «verify at spike S1» for rollback, redeploy and promote, and the post-deploy record of the first deploys (`docs/uat/M1CODE-20261117-01-prod.md`, `docs/program/public-v1/reachability.md`; task M1.8).

## Доказательство

`handoffs/M1RECHECK-20261122-01/step-09-release-validator.json` (finding M1; criteria 2, 11 and 14 of REQ-108); the status comments of REQ-108 and REQ-109 in `docs/requirements.yaml`; GitHub runs 44919421105 (app.yml) and 44919421116 (check.yml) on `e0a425b`.

## Как исправить

Run the three on GitHub at the next CI snapshot, on a temporary `ci/*` branch (a push needs the owner's word; checks run on GitHub only): (1) a branch where every unlisted path is removed and `cd app && npm ci && npm run check` runs; (2) the same tree with the pg test folder emptied, then with one pg test file removed, each expected red at the pg count guard; (3) the build with `SITE_GATE=closed`, the gate page opened in the runner's Chrome (the page audit of `docs/uat/` for one window and both themes), and the status that Vercel gives the page read once with `curl` and written into `docs/runbooks/incident.md` in place of «S1 will». The result goes into this file. The defect closes when all three are recorded, or when the owner says in a decision record that a part is accepted as not run.

## Маршрут

WF-03 with a run on GitHub (RELEASE-FINALIZER pushes the temporary branch, RELEASE-VALIDATOR reads the log). Low: no step blocks the release; the properties stand on the CI record of `e0a425b`.
