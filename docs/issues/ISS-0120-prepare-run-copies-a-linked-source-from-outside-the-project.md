# ISS-0120 — `prepare-run` follows a symbolic link in a source: a `docs/context.md` that links to a file outside the project is copied into the run materials, and a cloned repository is enough to plant the link

Серьёзность: HIGH (предложена ORCH по словам проверки; диагноз может её изменить). Статус: closed, 2026-11-22, проверено перепроверкой `M1RECHECK-20261122-01` (шаги WF-03 исправление не проходило). Найдено: внешняя проверка безопасности (передано ORCH 2026-11-18 другой сессией владельца); заведено DOC-UPDATER (шаг 01), прогон `SECREG-20261118-01`, 2026-11-18T15:28:41Z. Пункт планки: Q7 (содержимое внешнего файла, в том числе секрет, не попадает в материалы прогона, которые читают агенты и которые идут в открытый репозиторий). Требования: REQ-002 (сделано; команда `prepare-run`). Та же причина, что у открытого дефекта `ISS-0037` (LOW, 2026-10-11; пункты планки там — Q10, Q11): см. «Что не так».

## Что не так

The words of the review (an external security review, relayed to ORCH on 2026-11-18; the reviewer used only artificial values and localhost, nothing real leaked): a `docs/context.md` planted as a symbolic link to a file outside the project was copied by `prepare-run` into the run materials. Git stores symbolic links, so a cloned foreign repository is enough: the owner does not have to make the link himself.

**The same cause is already an open defect.** `docs/issues/ISS-0037-prepare-run-reads-sources-through-symlink.md` (`Статус: open`, LOW; found by SECURITY-REVIEWER F1 and REVIEWER R1 of run `ISS-0002-20261011-01`, both with a probe on `ideas/01-kviz-zayavki.md` as a link: exit code 0, the outside text in `sources/`) records the same reading through a link for `ideas/<id>.md` and the `--context` file. It judged LOW because «ссылку кладёт сам владелец в свой проект» (the owner puts the link into his own project himself). The review adds the way the link can arrive without the owner: inside a repository that someone else made. How the two records go together is ORCH's choice (this step changes no other defect file).

What this step saw, reading the files as text (`tools/src/prepare.js`, `tools/src/contract.js` and `tools/src/util.js` are unchanged against the tag `base/SECREG-20261118-01`; in `tools/src/cli.js` the parallel run ISS-0092-20261117-01 added three lines, so the `prepare-run` handler is at line 64 today and at line 63 at the tag):

- `tools/src/prepare.js`, lines 89–114: for each source path, `isSafeSourcePath(p)` and then `readTextFile(path.join(root, p))`; the cleaned text goes into `copies` and is written as `runs/<RUN-ID>/sources/<path>` (lines 149–157). **Matches** the review: nothing in this path asks whether the file is a link or where it really lies.
- `tools/src/contract.js`, line 33 and lines 64–68: `isSafeSourcePath` checks only the text of the path (`^(ideas|docs)/[A-Za-z0-9._/-]+\.md$`, not `ideas/README.md`, no `.`, `..` or empty segment). A link named `docs/context.md` passes it.
- `tools/src/util.js`, lines 55–62: `readTextFile` calls `fs.statSync` and `fs.readFileSync`, and both follow a link; there is no `lstat`, no real path and no check that the real path lies under the project root. The check of a candidate (`fs.existsSync`, `prepare.js` line 71) follows a link too.
- `docs/context.md` does not exist in the project today, and the repository holds no symbolic link (`git ls-files -s`: no entry of mode 120000): the review planted the link in its own copy.
- The run materials are tracked in git: `git ls-files runs` lists 55 files, among them `runs/WF06-20260925-01/sources/docs/owner-goals.md`; and the repository is open on purpose (`decisions/0111`). A copied outside file would go to the public repository with the commit of the run.
- Not reproduced by this step (no program was run).

Why HIGH (as proposed): the copy is read by the WF-06 agents, goes into the verdict and is committed to a public repository; the outside file can be any file the owner can read. The earlier LOW rested on the owner making the link himself, and the review's way removes that condition. The diagnosis may change the severity.

## Доказательство

- The review's statements: `docs/program/public-v1/PROGRESS.md`, the table «Finding → defect», row EXT-2, and the row of 2026-11-18T15:01:53Z.
- The earlier probes of the same cause: `docs/issues/ISS-0037-prepare-run-reads-sources-through-symlink.md` («Доказательство»), `handoffs/ISS-0002-20261011-01/step-05-security-reviewer-security.json` (F1), `handoffs/ISS-0002-20261011-01/step-05-reviewer.json` (R1).
- Read as text at step 01: `tools/src/prepare.js` lines 71 and 89–157; `tools/src/contract.js` lines 33–34 and 64–68; `tools/src/util.js` lines 55–62; `git ls-files runs`; `ls docs/context.md` (no such file).
- The tests of the write phase have link cases for the run folder (`tools/test/prepare.write.test.js`, lines 138 and 336); no test reads a source through a link.
- To repeat, only in a fresh clone outside the project: make `docs/context.md` a link to a file outside the clone that holds a harmless marker text, run `prepare-run` there with `--context docs/context.md`, and look for the marker under `runs/<RUN-ID>/sources/`.

## Как исправить

The acceptance that the review proposes (to be measured by the diagnosis; not a ready fix, AP-161): `prepare-run` resolves the real path of every source it reads and refuses, with a named message and a non-zero exit, any file whose real path is outside the project root; a test with a link to an outside file shows the refusal and that its contents are absent from the run materials; a link inside the root still works.

ISS-0037 proposed something stricter: refuse any link in a source through `lstat` with `E_SOURCE_PATH`, with tests for an outside link, a link inside the project and a dangling link. The design chooses one of the two and says why. The diagnosis also looks for all places of the same kind (AP-014): the candidates `ideas/<id>.md`, a link in a middle folder of the path (`docs/<link>/x.md`), the other WF-06 commands that read project files, and the gap between the check of the path and the read (the reading twin of the race that `decisions/0042` records for the write). A weaker check or a skipped test is not a fix (Q6).

## Маршрут

WF-03, the second of the five (the order of `docs/program/public-v1/PROGRESS.md`), together with ISS-0037 (one cause, one fix; ORCH decides how ISS-0037 is closed): ISSUE-FIXER, CODE-DESIGNER and CODE-DESIGN-VALIDATOR, CODE-FIXER, SECURITY-REVIEWER and REVIEWER at the same time, TEST-DESIGNER and TEST-DESIGN-VALIDATOR, RELEASE-VALIDATOR. Before the public release (PROGRESS, row EXT-2). Open question to the reviewer, through ORCH and the owner: which part of the code was reviewed (which commit or which files), and whether anything was checked on Windows (how a link of a cloned repository arrives there was not measured by this step).

## Закрыто

Closed 2026-11-22T07:48:21Z (time from the clock), run `M1RECHECK-20261122-01` (WF-02 step 10, DOC-UPDATER, after the RELEASE-VALIDATOR PASS of `handoffs/M1RECHECK-20261122-01/step-09-release-validator.json`, ORCH accepted it). The cause is removed: the fix commit d22ceec (2026-11-18, an ancestor of e0a425b): `prepare-run` refuses a source whose real path leads outside the project — `leadsOutside()` with `realpath` in `tools/src/prepare.js`; tests in `tools/test/prepare.test.js` (the idea file, the context file, a linked folder, an inner link kept, a dangling link). The same cause closes ISS-0037 (`decisions/0121`). The fix did not pass the WF-03 steps (it was made in a separate session and went to `main` on the owner's word, `decisions/0122` О2 and О3, row of 2026-11-19T08:30:00Z of `docs/program/public-v1/PROGRESS.md`); the re-check of this run read the code of `e0a425b` and the CI record, it did not run the tests on this Windows PC. check.yml run 44919421116 on `e0a425b` is green (tools tests 2226 of 2226). Not read by the re-check: the decision records and requirement amendments that the section «Как исправить» names as steps before the design (the RELEASE-VALIDATOR of this run did not look for them); if one is missing, it is a new defect, not a reason to reopen this one.
