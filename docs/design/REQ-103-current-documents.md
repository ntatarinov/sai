# REQ-103 — Current documents: the design

WF-02, step 1, run `M0DOCS-20261117-01` (CODE-DESIGNER); reworked at step 1c by the gate 1b pass 1
(`handoffs/M0DOCS-20261117-01/step-01b-code-design-validator.json`, FC-1–FC-8), the amended block
REQ-103 (run `REQ103AMEND-20261117-01`) and `decisions/0117` О17–О35; what changed is listed in
section 22. Reworked again at step 1e by the gate 1d pass 2
(`handoffs/M0DOCS-20261117-01/step-01d-code-design-validator.json`, FD-1–FD-4) and `decisions/0117`
О37–О39; those changes are listed in section 23. Reworked a last time at step 1g, the one extra
rework the owner gave (DG-6, `decisions/0117` О41), by the gate 1f pass 3
(`handoffs/M0DOCS-20261117-01/step-01f-code-design-validator.json`, FE-1–FE-3); those changes are
listed in section 24. Requirement REQ-103 (P-code R0.3 of the
program PUBLIC-V1; plan task M0.10, acceptance AC0.7 and AC0.8 of `docs/program/public-v1/PLAN.md`).
Base tag `base/M0DOCS-20261117-01` (B below) on commit `6c756cd`. Commands are for bash, from the
root of Sai unless the row says `tools/`. Inside tables and inline code, `\`` stands for a backtick
and `\|` for a vertical bar (Markdown escapes; the files hold the plain characters); commands
meant to be copied are in fenced blocks. In bash, a variable before a colon is written in braces
(`"${B}:STATE.md"`): in zsh `"$B:t…"` is a modifier (AP-147), and this design met it again (section 21).

## 0. Summary

The run replaces the journals `STATE.md` and `PLAN.md` with short current files, keeps the old ones
as byte copies in `docs/archive/`, brings `CLAUDE.md`, `README.md`, `docs/product/*.md` and
`ideas/README.md` in line with PUBLIC-V1, cancels four stale handoffs and follows with two edits
in `tools/` (the base of `handoffs-check` and its guard test HC-7c).

The main finding of step 1: criterion 1 as first written could not be met without losing history.
It compared the archive with `git show "${B}:STATE.md"`, but the working `STATE.md` already holds
one line more than the tag (M0BACKLOG step 04, 2026-11-17T16:32:07Z), and the working `PLAN.md`
now holds one too (line 398, ORCH's line of WF-01 step 3 of M1SITE-20261117-01, F3). The design
keeps the rule «byte copy of what it replaces»: the archive is a byte copy of the file as it stands
when it is replaced. ORCH measures that file under a lock and records it; the amended criterion 1
(now in the block, `decisions/0117` О1, О20) compares the archive with the one record that is not
superseded. It also proves that every line of the tag is still in the archive and that every extra
line is one that ORCH recorded with the run that wrote it (section 4).

Measured on the trial of step 1c (section 21, `trial2`: a fresh clone of the tag with today's
working `STATE.md`, `PLAN.md`, `docs/requirements.yaml` and PROGRESS.md and an emulated ORCH record):
all 108 mechanical parts of the amended criteria 1–8 pass on the built trial, and the probes of
criterion 8 (c) pass with E11.2 as now written. The design's own checks (SHAPE, GATESEQ, PLANROWS,
the README places; sections 5.6, 6.1, 8) pass. The guard tests are green: team-docs 5/5, repo
26/26, traces-readme 7/7, handoffs-real 4/4, handoffs-docs 5/5, E2K-61 1/1, the temporary-root
tests of section 12 row 12 194/194. `traces` (0 of 2570 files), `handoffs-check` («110 из 110»)
and `prettier --check .` are clean. The gate's mutants V04, V09, V10 and V26 are red under the
reworked design (section 18). At step 1e the PLAN table rule reads the first PROGRESS row that
records the passed WF-01 gate, in a form that ORCH keeps (6.1). The gate's V28 and V28b are red
under the old rule and green under the new one, and V09c is red under GATESEQ in CD-2 (sections
6.1, 5.6, 18, 23). At step 1g the lock precondition reads each write-set item as path tokens, with
any character that cannot be part of a path as the boundary. It was measured against all 2192 real
write-set items of `handoffs/`: no real holder of a locked file is missed, and the 114 pairs where
it differs from the substring form are listed with their reasons (section 14). Check (6) of 6.1 now
covers the requirements of the PROGRESS P-code table, and the commands of checks (1)–(6) are in the
design (section 24). Of the 38 mutants of step 1 (46 runs), every one is red under the
check named for it; eight runs show a check as written that misses its mutant, and the design
rules or the amendment close each gap.

Nothing in this design is implementation code: the document texts are given exactly because
they are the product of the run, and the test edit is given as a replacement table.

## 1. Scope, sources and the write set of this step

- Requirement: the block REQ-103 of `docs/requirements.yaml` (9 criteria, read by id on
  2026-11-17; at step 1c read again as amended by the run `REQ103AMEND-20261117-01`, passed on its
  third gate pass, `decisions/0117` О17–О29). Its Low findings F1–F5 from
  `handoffs/M0BACKLOG-20261028-01/step-02-req-validator.json` are closed by that amendment. Issue I11 of
  `handoffs/M0BACKLOG-20261028-01/step-04-doc-updater.json` says the top block of `STATE.md` is
  false about the ISS-0116 release, and the new block replaces it.
- Plan: `docs/program/public-v1/PLAN.md` §5 M0 items 10 and 13, AC0.7, AC0.8, §4.2, §4.7 (only
  read; decisions/0091 item 8: the plan is not edited, a change is a row of «Plan amendments» in
  `docs/program/public-v1/PROGRESS.md`, written by ORCH).
- Decisions: `decisions/0091-program-public-v1.md` (items 4, 6, 8), `decisions/0099-backlog-rescope-and-supersede-method.md`,
  `decisions/0115-owner-chooses-public-v1-as-the-product.md`, `decisions/0080-english-instructions.md` (languages; item 7: the
  three Russian headings of `STATE.md` are literals the code reads), `decisions/0001-product-stack-and-check-command.md`.
- Code read: `tools/src/contract.js` (the three anchors and the markers), `tools/src/apply.js`
  (`placeBlock`, `ownerSection`), `tools/src/handoffs/rules.js` (H4, H5–H7, H9), `tools/src/handoffs/times.js`,
  `tools/src/traces/git-files.js`, `tools/handoffs/exceptions.tsv`, `tools/test/handoffs-real.test.js`
  and the guard tests of section 12.
- This step writes only this file and its own handoff.

## 2. Measured facts

All on 2026-11-17 (UTC). «Tag» is a fresh clone of B outside the project. «Work» is the working
tree of Sai, read only.

| # | Fact | Command | Output |
|---|---|---|---|
| F1 | The tag and HEAD | `git rev-parse base/M0DOCS-20261117-01`; `git log --oneline -1` | `6c756cd3a248…`; HEAD `6c756cd` |
| F2 | Sizes at the tag | `git show "${B}:STATE.md" \| wc -c -l`; the same for `PLAN.md` | STATE.md 474071 bytes, 1315 lines; PLAN.md 127572 bytes, 397 lines (the first block said 385895 and 105670; the amended block has 474071 and 127572) |
| F3 | Work `STATE.md` differs from the tag by one added line | `diff <(git show "${B}:STATE.md") STATE.md` | `51a52`: one `>` line «2026-11-17T16:32:07Z — M0.11 … сделано (WF-01 `M0BACKLOG-20261028-01`, шаг 04, DOC-UPDATER)»; no `<` line. Work: 474809 bytes, 1316 lines, blob `21f3930a42b2…`, sha256 `728cb4ea…` (17:22:58Z; unchanged at 17:42:44Z) |
| F3b | Work `PLAN.md` differs from the tag by one added line (step 1c, 2026-11-17T20:32:57Z) | `diff <(git show "${B}:PLAN.md") PLAN.md`; `git hash-object PLAN.md` | `397a398`: one `>` line «WF-01 `M1SITE-20261117-01` — требования R1.1 и R1.4 … проверены 2026-11-17 …», written by ORCH at WF-01 step 3 and recorded in the `context.orch_check` of `handoffs/M1SITE-20261117-01/step-02b-req-validator.json` («REQ-108 and REQ-109 enter the iteration plan (PLAN.md line …)»); no handoff of that run has PLAN.md in its `write_set`; no `<` line. Work: 128516 bytes, 398 lines, blob `8bd2ab413b92…`. STATE.md unchanged since step 1 (blob `21f3930a42b2…`) |
| F4 | Other target files equal the tag | `git diff --quiet "${B}" -- <f>` for CLAUDE.md, README.md, docs/product, ideas/README.md, the two handoff folders, `tools/handoffs/exceptions.tsv`, `tools/test/handoffs-real.test.js`, docs/anti-patterns.md | all equal (17:36:09Z; at step 1c PLAN.md differs, F3b); `docs/requirements.yaml` (REQ-108, REQ-109 of M1SITE, the REQ-014 comment of M0BACKLOG, the amended REQ-103) and `decisions/README.md` differ |
| F5 | The ORCH ruling at M0BACKLOG step 02 was not followed | `context.orch_check` of `handoffs/M0BACKLOG-20261028-01/step-02-req-validator.json` | «base/M0DOCS-<date>-01 is set only after the working tree is committed by a release»; the tag is on `6c756cd` while F3's line is uncommitted (DISCREPANCY, О12) |
| F6 | The anchors of `STATE.md` | `grep -n -x -F` of the three headings; markers | owner heading line 1231, `<!-- sai:wf06:start -->` 1247, `### Рекомендация агентов (WF-06)` 1248, `<!-- sai:wf06:end -->` 1276, `### Что делать дальше — по порядку` 1278 (work file); each once; no line `---` in the file |
| F7 | The tail from the owner heading to the end | `tail -n +1231 STATE.md \| wc -c`; `\| shasum -a 256` | 14723 bytes, sha256 `12897df2a158…`; the file ends with `\n` |
| F8 | No Markdown link in the two journals | `grep -o -E '\]\([^)]+\)' STATE.md PLAN.md \| wc -l` | 0, so the copies in `docs/archive/` have no relative link to break |
| F9 | `traces` lists untracked files | `grep -n -- '--others' tools/src/traces/git-files.js` | line 89 (`ls-files --others --exclude-standard`): the archive copies are checked before any commit |
| F10 | COUNTS | the awk programme of the block on `git show "${B}:docs/requirements.yaml"` and on the work file | tag: «107 in total — 38 done, 1 in progress, 3 blocked, 58 pending, 7 cancelled»; work (17:37:42Z): «109 in total — 38 done, 1 in progress, 3 blocked, 60 pending, 7 cancelled» |
| F11 | D (open defects) | the command of criterion 5 (c) on the tag; the same over `docs/issues/` | 97 on both: 1 CRITICAL (ISS-0092), 0 HIGH, 9 MEDIUM, 87 LOW. The first word after «Серьёзность: » comes in six forms (`awk '{print $2}' \| sort \| uniq -c` over the DEF lines, step 1c): `CRITICAL.` 1, `LOW` 4, `LOW,` 1, `LOW.` 82, `MEDIUM` 2, `MEDIUM.` 7; the grouping takes the word without its punctuation (section 5.3) |
| F12 | The base values of the criteria | harness `crit.sh` (section 21) on the tag clone | as the first block says, except criterion 3: `grep -c -F 'docs/program/public-v1/PLAN.md' PLAN.md` → **1** (the first block said 0; the amended block says 1): line 376 of the root PLAN.md, written by commit `a432020` (2026-11-17) |
| F13 | Open gates in PROGRESS.md | the awk of section 5.3 | 16 rows: G4, G6, G7, G8, G9, G10, G11, G14, G15, G16, G17, G19, G20, G21, G22, «WF-05 step 8 (AUD-001)» |
| F14 | PROGRESS.md «Now» is behind | `grep -n '^- Next step (exact):' docs/program/public-v1/PROGRESS.md` | line 11 still names «M0.11 step 04» as next, though it closed at 16:35:09Z (ORCH refreshes it before S1) |
| F15 | handoffs-check on the tag | `cd tools && node src/handoffs/cli.js` | «файлов проверено 1392, нарушений 0, исключений использовано 114 из 114»; the four rows are lines 21, 117, 118, 119 of `tools/handoffs/exceptions.tsv` |
| F16 | Cancellations alone (trial) | the four handoffs cancelled, the base unchanged | handoffs-check exit 0, four lines «исключение не использовано: tools/handoffs/exceptions.tsv:21/117/118/119», «110 из 114»; `node --test test/handoffs-real.test.js`: HC-7a red, HC-7c green (the first block said HC-7c is the red one; the amended block says this) |
| F17 | Rows deleted alone (fresh clone of the tag) | four rows deleted, handoffs PENDING | handoffs-check **exit 1**, four H4 violations: this order would block the `close` of every run |
| F18 | Rows deleted after the cancellations | trial | handoffs-check «110 из 110» exit 0; HC-7c red until its edit, then 4 of 4; `prettier --check` and `eslint` of the test file clean |
| F19 | A trap in the ISS-0002 handoff | `grep -n '"status": "IN_PROGRESS"' handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json` | two lines: 10 (top level, two spaces) and 57 (`result.status`, four spaces); a text edit that matches «  "status"» without the line start hits both |
| F20 | H4 needs `at` and `reason` only | `tools/src/handoffs/rules.js` lines 162–175 | `by` is not checked by H4 (mutant M26h); criterion 7's `jq` checks it |
| F21 | The records the reasons name exist | `test -e` | `decisions/0015-product-virtual-team-start.md`, `decisions/0033-drop-clothing-shop-product.md`, `runs/WF06-20260926-01/verdict-2.md`, `handoffs/ISS-0002-20261011-01/step-10-doc-updater.json`, `docs/issues/ISS-0002-apply-verdict-partial-write.md` (line 3: «Статус: closed, 2026-10-11»), `docs/audits/AUD-001/report.json` (DOC-10 Medium, DOC-11 Low) |
| F22 | `placeBlock` and `ownerSection` on the new STATE.md | a trial module outside the project that imports `tools/src/apply.js` (no top-level code in it) | `placeBlock` ok, the owner's section unchanged, the top block kept |
| F23 | The README places that turn false or that the criteria read | `grep -n` | line 182 «in the order of `PLAN.md`» (the picker queue; stopped by decisions/0099); 337 «will appear with the first audit»; 355 «As of 2026-10-26»; 369 the only REQ-008; 371–376 the counts and «Still pending, for example: … goal templates …» (REQ-020 goal templates is `cancelled`); 379 «Open defects: 74»; 387 «No health audit yet» |
| F24 | `CLAUDE.md` places | `grep -n` | «## What we are building» 16–33; the IDEA paragraph from line 51 (5 lines); the write-list item ending «(quality-bar §1, item 3);» line 129; «Product code is written in `tools/src/team/`» line 87 contradicts `decisions/0001` (accepted 2026-10-28) — out of scope, О15 |
| F25 | `docs/product/` dates | `TZ=UTC git log -1 --format=%cd --date=format-local:%Y-%m-%d "${B}" -- <f>` | current-state 2026-10-11, parity-matrix 2026-10-10, requirements-catalog 2026-10-13, roadmap 2026-10-09; 4 files (`git ls-tree --name-only "${B}" docs/product/`) |
| F26 | No `.gitattributes` | `cat .gitattributes` | absent: `git hash-object <file>` equals the blob id the commit will hold |
| F27 | References into the old PLAN.md | `grep -n 'PLAN.md`, step 2f'` | `.claude/agents/audit-scout.md:47`, `docs/workflows/WF-05-health-audit.md:86` (out of scope, О15) |
| F28 | Trial tests use the system temp folder | the apply, snapshot and cli tests | 96 folders `sai-wf06-*`, `sai-outside-*`, `sai-snap-*` were left at 17:24Z: the known defect ISS-0108, not caused by this design (at step 1c the tests got `TMPDIR` in the session folder, which was emptied after them) |
| F29 | The PROGRESS table «Requirements (P-code → REQ)» (step 1c) | the command PROGREQ of section 6.1 | rows are appended, a later row of the same REQ replaces the earlier (the table holds «correction» and «gate» rows); last rows: REQ-102 R0.1 «done …» run ISS-0093-20261028-01; REQ-103 R0.3 «… gate REQ-VALIDATOR PASSED …» run M0BACKLOG-20261028-01; REQ-108 R1.1 and REQ-109 R1.4 «… REQ-VALIDATOR PASS on pass 2 …» run M1SITE-20261117-01; R0.2 has no REQ id yet. Status lines: REQ-102 done, REQ-103, REQ-108, REQ-109 pending |
| F30 | The runs in parallel at step 1c | the handoffs of the run folders | ISS-0092-20261117-01 (WF-03 for R0.2, step 01 done; later steps write `docs/requirements.yaml`, `tools/`, `docs/issues/`, and at step 10 STATE.md); M1CODE-20261117-01 (the design of REQ-108/109, step 01 done; writes `docs/design/REQ-108-109-app-skeleton.md`); REQ108AMEND-20261118-01 (step 01c IN_PROGRESS, `write_set` «docs/requirements.yaml (block REQ-108 only)»); M1SITE-20261117-01 finished |
| F31 | E11.2 without messages (step 1 text) against the amended criterion 8 (c) | the probes of criterion 8 (c) (`probe-8c.sh`, section 21) on the built base with three forms of HC-7c | four literal calls without a message: 4 probe failures (tag row 21 at the top and at the sorted place: the output names neither the path nor H4 — the formatter splits that call and node prints only its first line); four literal calls with a message: 0 failures; a loop over a literal list with a message: 0 failures |
| F33 | The passing REQ-VALIDATOR handoffs of the four requirements (step 1e, 2026-11-17, read between 21:21:42Z and 21:25:53Z) | `for f in handoffs/*/*.json; do jq -r --arg r <REQ> 'select(.to_agent=="REQ-VALIDATOR" and (.result.verdict? // "")=="PASS" and ((.context.requirement_ids // []) \| index($r))) \| "\(.completed_at) \(.run_id) \(.file)"' "$f"; done \| sort` | REQ-102: ISS-0093-20261028-01 step-02f (06:48:20Z 2026-10-28; later 04d, 05c, 08f of the same run); REQ-103: M0BACKLOG-20261028-01 step-02 (2026-10-28T13:42:35Z), then REQ103AMEND-20261117-01 step-02c (2026-11-17T19:58:24Z); REQ-108 and REQ-109: M1SITE-20261117-01 step-02b (2026-11-17T18:07:20Z), then REQ108AMEND-20261118-01 step-02 (21:00:56Z). Each first handoff is WF-01 or WF-03, verdict PASS, its `requirement_ids` holds the REQ; the PROGRESS rows of F29 do not begin with «gate PASS: » |
| F34 | The lock precondition with substring matching (step 1e; replaced at step 1g, F35) | `contains($p)` of step 1c on invented handoffs (section 21) | `README.md` matched «tools/README.md (line 9 only)», `PLAN.md` matched «docs/program/public-v1/PLAN.md» (FD-4); the whole-path form of section 14 matches neither and still matches «README.md», «PLAN.md (the table only)», a string write set «STATE.md, PLAN.md and README.md», and for a folder `docs/issues/` the item «docs/issues/ISS-0092-node.md (closing)» but not «docs/issues-old/x.md» |
| F35 | The whole-path form of step 1e on the real write sets (step 1g, 2026-11-18T04:31:26Z) | every write-set item of the 1421 handoffs (2192 items) against the 16 locked paths, with `contains` and the regex of step 1e | the regex of step 1e misses «docs/requirements.yaml: new blocks at the end only» and «docs/requirements.yaml: blocks REQ-104..REQ-107 …» (`handoffs/E2E-20261103-01/step-01-req-analyst.json`, `step-01b-req-analyst.json`, ORCH's write sets of 2026-11-02), which `contains` matched; on invented items also a path in backticks, in «», with a final period and the pair «STATE.md/PLAN.md» (the gate's FE-1). The token form of section 14 matches all of them (measured there) |
| F32 | Line references of two guard rows | `awk 'NR>=67 && /^}\);/{print NR; exit}' tools/test/repo.test.js`; `grep -n '^test("HC-10a' tools/test/handoffs-docs.test.js` | REQ-003 AC3 ends at line 113; HC-10a starts at line 124 |

## 3. Files of the run

| File | Read / written | By whom | Sub-step | Base of its checks |
|---|---|---|---|---|
| `STATE.md` | replaced | DOC-UPDATER | S1; S8b, step 10 (refresh of the time lines) | the record PH (criterion 1) |
| `PLAN.md` | replaced | DOC-UPDATER | S1 | PH |
| `docs/archive/STATE-until-M0DOCS-20261117-01.md`, `docs/archive/PLAN-until-M0DOCS-20261117-01.md` | new (names by О2) | DOC-UPDATER | S1 | PH |
| the S1 handoff (step 02 of the run; `context.pre_state`) and, at a re-measure, the earlier record's `orch_correction` | written | ORCH | before S1 (lock L1) | — |
| `docs/product/current-state.md`, `parity-matrix.md`, `requirements-catalog.md`, `roadmap.md` | one first line added | DOC-UPDATER | S2 | B |
| `ideas/README.md` | line 9 | DOC-UPDATER | S2 | B |
| `CLAUDE.md` | two places | DOC-UPDATER | S3 | B |
| `README.md` | eleven places (R1–R11) | DOC-UPDATER | S4 | B |
| the four handoffs (section 10) | `status` and a new `orch_cancellation` | ORCH | S5a | B |
| `tools/handoffs/exceptions.tsv` | four lines deleted | BACKEND-DEV | S5b | B |
| `tools/test/handoffs-real.test.js` | HC-7c by the table, with a message on each of the four assertions (`decisions/0117` О30) | BACKEND-DEV | S5b | B |
| `tools/test/current-docs.test.js` | new (`decisions/0117` О10, named in the block's «Files») | TEST-DESIGNER | step 5 | — |
| `docs/requirements.yaml` | REQ-103 block (amended by REQ103AMEND-20261117-01, done), its status line (ORCH, `in_progress` when the build starts, О35; DOC-UPDATER, `done` at step 10) | REQ-ANALYST, ORCH, DOC-UPDATER | 1a, S0, step 10 | B for the rest of the file |
| `docs/program/public-v1/PROGRESS.md` | read; ORCH's own rows | ORCH | before S1, after each step | — |
| `docs/anti-patterns.md`, this design («As built») | appended | DOC-UPDATER | step 10 | — |

No other file of the two handoff folders changes: `git diff --name-only "${B}" -- handoffs/WF06-20260926-01 handoffs/ISS-0002-20260930-01` lists exactly the four.

## 4. The archive (criterion 1)

### 4.1 The problem

Criterion 1 as first written asked `sha256(archive) = sha256(git show "${B}:STATE.md")`. B is fixed
at `6c756cd`. Lines written into `STATE.md` and `PLAN.md` after the tag are not in B (F3, F3b, F5):
on 2026-11-17 one line in each, and the runs of section 14 may add more before S1. Measured on the
trial of step 1: an archive equal to B passed that form and lost the line (mutant M01o green); the
correct archive failed it. The amended criterion 1 of the block (О1, О20) is the form this design
builds for.

### 4.2 The rule

The archive is a byte copy of the file at the moment it is replaced (P). P contains B: every line
of B stands in P in the same order, and the extra lines are lines written after the tag by named
runs. The lock L1 (section 14) guarantees that nothing is written between ORCH's measurement and
the copy. The copy is checked against the measurement in the same operation.

### 4.3 The record of the pre-state (ORCH)

When ORCH takes L1 (after it has refreshed the PROGRESS line «Next step (exact)», О35, and
checked the precondition of L1, section 14), before it launches S1, it writes into the S1 handoff
`context.pre_state` (ORCH's field; it is not `before_copy`, which means a copy from the tag). The S1
handoff is the build handoff of DOC-UPDATER (step 02 of the run; on the trial
`handoffs/M0DOCS-20261117-01/step-02-doc-updater.json`, made by `handoff new`). The records PR are
the handoffs of the run folder whose `pre_state.base_tag` is B; the one that binds, PH, is the one
that is not superseded (criterion 1 (f)):

| Field | Type | Rule |
|---|---|---|
| `at` | time `YYYY-MM-DDTHH:MM:SSZ` | from the clock, at the measurement |
| `base_tag` | string | `base/M0DOCS-20261117-01` |
| `files[]` | list of 2 | `STATE.md` first, then `PLAN.md` (criterion 1 reads `files[0]` and `files[1]` by place) |
| `files[].path` | string | the file (`STATE.md`, `PLAN.md`); for the reader, the criterion does not read it |
| `files[].git_blob` | 40 hex | `git hash-object <file>` (F26: equals the future blob in the commit) |
| `files[].sha256`, `bytes`, `lines` | 64 hex, integers | `shasum -a 256`, `wc -c`, `wc -l` |
| `files[].removed_vs_tag` | integer, must be 0 | `diff <(git show "${B}:<file>") <file> \| grep -c '^<'` |
| `files[].added_after_tag[]` | list | one item per `>` line of the same `diff`: `line` (its number in P), `text` (the whole line), `run` (the RUN-ID that wrote it) and `handoff` — a handoff of that run that records the write: its `write_set` names the file, or, for a line that ORCH writes itself, its `context.orch_check` names the write (`decisions/0117` О32). The `run_id` of that handoff equals `run` (criterion 1 (d), mechanical); RELEASE-VALIDATOR reads the handoff for the write (1 (d), reading, О35) |

Measured at step 1c (2026-11-17T20:35:59Z, the emulated record of the trial): STATE.md — blob
`21f3930a42b2…`, 474809 bytes, 1316 lines, removed 0, one added (line 52, run
M0BACKLOG-20261028-01, `handoffs/M0BACKLOG-20261028-01/step-04-doc-updater.json`, whose `write_set`
names STATE.md); PLAN.md — blob `8bd2ab413b92…`, 128516 bytes, 398 lines, removed 0, one added (line
398, run M1SITE-20261117-01, `handoffs/M1SITE-20261117-01/step-02b-req-validator.json`, whose
`orch_check` names ORCH's PLAN.md line). If `removed_vs_tag` is not 0, someone rewrote history after
the tag: ORCH stops and asks (quality-bar §6 item 8).

A re-measure (4.5 row 1) or a `-runN` re-run that carries the record makes a newer record. In the
same step, before it launches the newer S1, ORCH writes into the handoff of the earlier record an
`orch_correction` (or appends one to the list there): `by` «ORCH», `at` from the clock, and a text
with the words «superseded by» and the path of the handoff of the newer record (`decisions/0117`
О20, О32). A carried record keeps the values and the `at` of the record it copies; a re-measure has
a new `at`. Measured: a newer record without that correction makes criterion 1 (f) red (the gate's
V04: PH prints two paths); with it, criterion 1 and `handoffs-check` are green (V04c, section 18).

### 4.4 Sub-step S1, in this order

Each check stands right before the write it protects, in the same command sequence of DOC-UPDATER.
For each file (STATE.md, then PLAN.md):

1. `git hash-object <file>` equals `git_blob` of PH. Otherwise stop: nothing is written,
   and the first issue is BLOCKED («<file> changed under the lock»).
2. The archive path does not exist yet (`test ! -e`). If it exists and its blob equals `git_blob`,
   this part is already done (a resumed step) and DOC-UPDATER goes to 4. If it exists with
   another blob, stop.
3. Copy the bytes to a temporary name in `docs/archive/` (a leading dot, `.tmp` at the end), check
   that the temporary file's blob equals `git_blob`, then rename it to the final name.
4. Build the new file under a temporary name in `docs/archive/`. For STATE.md: the block of 5.2,
   then the bytes of the **archive copy** from the line `### Решение владельца о старте` to its
   end (5.4); the tail is never re-read from `STATE.md`. For PLAN.md: the text of section 6 with
   the rows of PLANROWS (6.1).
5. On the temporary file, before the rename: for STATE.md, `cmp` of its tail with the archive's
   tail → equal, each anchor once, and the check SHAPE of 5.6 (the kinds of the block's lines,
   the empty line before `---`) and GATESEQ; for PLAN.md, every part of the amended criterion 3
   (the three phrases, no `## Итерация`, below 8000 bytes, the rows REQ-102 and REQ-103) and the
   check PLANROWS of 6.1. Then rename it over `<file>`.

After both files: both archive blobs still equal `git_blob` of PH, `ls -a docs/archive` lists
exactly the two files (no temporary file left), and the commands of criteria 1, 2 (a)–(e), 3 and
the checks of 5.6 and 6.1 are run and their output goes into `self_check`. Measured on the trial
(S1 at 2026-11-17T20:36:54Z): STATE.md 17470 bytes, `---` at line 35; PLAN.md 1797 bytes, 24 lines.

### 4.5 Failure paths of S1

| What fails | What stays | What the next run of S1 does |
|---|---|---|
| step 1 (the file changed) | everything as it was | ORCH finds the writer, measures again, writes the new `pre_state` into a new S1 handoff (the next step letter, or `-runN` after an interruption) and, in the same step, the «superseded by <new handoff>» correction into the earlier record (4.3) |
| the copy (disk, interruption) at 3 | STATE.md = P; a temporary file at most | DOC-UPDATER deletes its own temporary file; S1 runs from 1 |
| the build or the checks at 4–5 | archive = P (correct); `<file>` = P | step 2 sees the archive with the right blob and continues at 4 |
| after STATE.md is replaced, before PLAN.md | STATE.md new, its archive = P | for STATE.md: archive blob = `git_blob` and the tail of STATE.md equals the archive's, so the file is done; PLAN.md goes from 1 |
| any other state (archive with another blob, file neither P nor new) | — | stop, BLOCKED, ORCH decides |

A reader never sees a half file: each file is replaced by one rename.

### 4.6 How it is checked, and why not the alternatives

The check is the amended criterion 1 of the block, parts (a)–(f) (`decisions/0117` О1, О20, О26);
on the trial all its mechanical parts pass (section 21). After the release commit R, the record
also holds in git: `git rev-parse "${R}:docs/archive/STATE-until-M0DOCS-20261117-01.md"` = the
`git_blob` of PH, which is committed with the run. Rejected alternatives:
(a) the archive = B, and the lines written after the tag are carried into the new top block.
This loses them at the next rewrite of the block, and the archive is not a copy of what it
replaced. (b) ORCH moves the tag to a release commit that holds P, as the M0BACKLOG ruling said.
This needs a records release (RV PASS) of the other runs before S1, moves «before» under the
design gate, and still needs L1 for the lines written after that commit.

## 5. The new STATE.md

### 5.1 Shape

- Lines up to the first line that is exactly `---` form the block; that line is at most line 50
  (criterion 2 (d)) and has an empty line before it. Without that empty line Markdown reads the
  text above as a heading (mutant M08).
- In the block, exactly one line starts with `**State:**`, one with `**Open gates:**` and one with
  `**Next step:**`, and no other line starts with `State`, `Open gates` or `Next step` (the regex
  of 2 (d) allows `#+ ` or `**` in front).
- One bullet is one line: a count line is never wrapped, because the checks use `grep -F` per line.
- The block holds no `###` heading, no marker `<!-- sai:wf06:… -->` and none of the three anchor
  headings.
- After the line: one empty line, then the tail (5.4). Size measured on the trial of step 1c:
  17470 bytes (block 35 lines up to `---`; tail 14723 bytes), below 40000.
- The block holds only the line kinds of 5.6, in their order; a dated journal line is none of
  them (check SHAPE).

### 5.2 The exact text of the block

Placeholders are in `<…>` and are filled by the commands of 5.3; everything else is exact. The
names in the first paragraph follow О2.

```
# Sai — the current state

One screen. DOC-UPDATER rewrites the lines of this block at the end of every run and adds no dated sections (REQ-103, `decisions/0091` item 6). The journal up to the run M0DOCS-20261117-01 is `docs/archive/STATE-until-M0DOCS-20261117-01.md`, a byte copy of the file this one replaced. The iteration is in `PLAN.md`; the program is `docs/program/public-v1/PLAN.md`, its checkpoint `docs/program/public-v1/PROGRESS.md`.

**State:** the program PUBLIC-V1 (`decisions/0091`; the owner's choice of the finished product, `decisions/0115`), milestone <MILESTONE> in progress; the first audit AUD-001 is closed («готов», `docs/audits/README.md`).

- Requirements (`docs/requirements.yaml`, the status lines of the blocks, read <T>): <COUNTS>.
- Open defects (`docs/issues/`, the first line «Серьёзность: …» of each file, read <T>): <D> — <DC> critical, <DH> high, <DM> medium, <DL> low.

**Open gates:** the rows of «Owner gates» in `docs/program/public-v1/PROGRESS.md` with no recorded answer (read <T>):

- <GATE>          (one line per open row, in the order of the table)

Owner actions pending (the same file, «Now»): <OWNER_ACTIONS>

**Next step:** <NEXT> — `docs/program/public-v1/PROGRESS.md`, «Now», «Next step (exact)».

The three sections below the line are copied verbatim from the old file: the code (`tools/src/contract.js`, `tools/src/apply.js`) and the test TM-01 (`tools/test/team-docs.test.js`) read them. Their text is the record of 2026-10-06, not the current plan.

---

```

(The note «(one line per open row …)» belongs to this design, not to the file.)

### 5.3 The placeholders

| Placeholder | Command (run once, at <T>) | Reading on the trial of step 1c (2026-11-17T20:36:54Z) |
|---|---|---|
| `<T>` | `date -u +%Y-%m-%dT%H:%M:%SZ`, one reading before all the others | 2026-11-17T20:36:54Z |
| `<MILESTONE>` | the «Now» bullet `- Milestone:` of PROGRESS.md: the milestone and its name, written as `M<k> «<name>»` (command MILESTONE) | M0 «Clean start» |
| `<COUNTS>` | the awk programme of the block's COUNTS on the working `docs/requirements.yaml` (О4) | 109 in total — 38 done, 1 in progress, 3 blocked, 60 pending, 7 cancelled |
| `<D>`, `<DC>`…`<DL>` | command DEF below, its lines counted; and command SEV, which groups them by the first word after «Серьёзность: » **without its punctuation** (F11: `LOW`, `LOW,` and `LOW.` are one severity); the four numbers add up to `<D>` | 97 — 1, 0, 9, 87 |
| `<GATE>` lines | command GATES below, each output line written as `- <line>` | the 16 rows of F13, the full first-column text of each (for example the row of G11 with «Начинай» and `stop`) |
| `<OWNER_ACTIONS>` | the text after «Owner actions pending: » in the «Now» bullet «Next step (exact)», verbatim to the end of that bullet | «Vercel part 1 in his existing account with a new project for Sai, then the account e-mail, Team ID and Project ID; REQ-014 two checks» |
| `<NEXT>` | the text of the same bullet after «Next step (exact): » up to « Owner actions pending:», verbatim (command NEXT); ORCH brings the bullet up to date before L1 (F14, `decisions/0117` О35) | the stale bullet of F14 (the trial copied it as it is) |

The commands (bash, from the root of Sai; each was run on the trial):

```
# DEF — the open defects, one line per file
ls docs/issues/ | grep -E '^ISS-[0-9]+' | while read f; do grep -m1 -E '^Серьёзность:' "docs/issues/$f"; done | grep -E 'Статус: open'

# SEV — DEF grouped by severity; the word is taken without its punctuation
ls docs/issues/ | grep -E '^ISS-[0-9]+' | while read f; do grep -m1 -E '^Серьёзность:' "docs/issues/$f"; done | grep -E 'Статус: open' | sed -E 's/^Серьёзность: ([A-Z]+).*/\1/' | sort | uniq -c

# GATES — the rows of «Owner gates» with an empty answer column
awk -F'|' '/^## Owner gates$/{f=1;next} f&&/^## /{exit} f&&/^\|/{g=$2; a=$4; gsub(/^ +| +$/,"",g); gsub(/^ +| +$/,"",a); if (g!="Gate" && g !~ /^-+$/ && a=="") print g}' docs/program/public-v1/PROGRESS.md

# MILESTONE, NEXT, OWNER — from the «Now» bullets of PROGRESS.md
sed -n 's/^- Milestone: \(M[0-9][0-9]*\) — \([^—]*\) — .*$/\1 «\2»/p' docs/program/public-v1/PROGRESS.md | sed 's/ »$/»/'
sed -n 's/^- Next step (exact): //p' docs/program/public-v1/PROGRESS.md | sed 's/ Owner actions pending: .*$//'
sed -n 's/^- Next step (exact): .* Owner actions pending: //p' docs/program/public-v1/PROGRESS.md
```

Check of the gate lines (also for RV, 2 (f)): `diff` of the GATES output with `- ` in front of
each line against the output of
`awk '/^\*\*Open gates:\*\*/{f=1;next} f&&/^(\*\*|Owner actions)/{exit} f&&/^- /' STATE.md` → empty
(trial: empty).

### 5.4 The tail

The bytes of P from the start of the line `### Решение владельца о старте` to the end of P,
unchanged: today lines 1231–1316, 14723 bytes, sha256 `12897df2a158…` (F7). It holds the owner's
section, the start marker, `### Рекомендация агентов (WF-06)`, the end marker, an empty line and
`### Что делать дальше — по порядку` with its ten items, to the last `\n`. Its text is stale (for
example, item 5 asks to resume the very handoff that S5a cancels). The note line of the block
says so; the text is not edited, because criterion 2 (c) and the code require it verbatim.

### 5.5 Later writers of STATE.md

From S1 on, every writer of `STATE.md` (DOC-UPDATER of this or another run) rewrites only the
lines of the block (the counts, the defects, the gate lines, the owner actions and the next step,
each from its command), adds no dated section and no dated journal line, keeps the line `---` at
most at line 50 with an empty line before it, and never touches the lines below it. The rule is
mechanical: after every write the writer runs SHAPE and GATESEQ (both parts) of 5.6, and both pass
(`decisions/0117` О38). CD-2 of `tools/test/current-docs.test.js` pins SHAPE and the durable part of
GATESEQ (section 16). Until `.claude/agents/doc-updater.md` says so (О13), ORCH writes this sentence
into every task whose `write_set` has `STATE.md`.

### 5.6 The checks of the block: SHAPE and GATESEQ

SHAPE gives each line of the block (up to the first `---`) one letter and asks the sequence to be
`HEPESERDEGEg*EOENETE`, which is the order of 5.2:

| Letter | The line |
|---|---|
| `H` | exactly `# Sai — the current state` |
| `E` | empty |
| `P` | starts with `One screen. DOC-UPDATER rewrites the lines of this block ` |
| `S` | starts with `**State:** ` |
| `R` | starts with ``- Requirements (`docs/requirements.yaml`, the status lines of the blocks, read <time>): `` |
| `D` | starts with ``- Open defects (`docs/issues/`, the first line «Серьёзность: …» of each file, read <time>): <number> — `` |
| `G` | starts with `**Open gates:** the rows of «Owner gates» in ` |
| `g` | after `G` and before `O`: starts with `- `, does not start with `- **`, and holds no time `YYYY-MM-DDTHH:MM` |
| `O` | starts with `Owner actions pending (the same file, «Now»): ` |
| `N` | starts with `**Next step:** ` |
| `T` | starts with `The three sections below the line are copied verbatim from the old file: ` |
| `X` | any other line (makes the check red) |

The line just before `---` must be empty (part of the sequence; also checked alone). GATESEQ has
two parts (`decisions/0117` О38):

- **equal** — the `g` lines equal the GATES output with `- ` in front, in order. It is checked at
  S1, at the refresh before step 9, by RELEASE-VALIDATOR, and by every later writer (rule 5.5);
- **durable** — every `g` line, without its `- `, is exactly the first-column text of a row of the
  table «Owner gates» of PROGRESS.md, answered or not (command GATEROWS below). That table's rows
  are only appended, so a row name stays a row name; this part joins CD-2. The equal part stays out
  of the permanent test on purpose: an owner's answer recorded in PROGRESS.md would turn
  `npm run check` red until the next run refreshes the block. Rule 5.5 makes every writer check
  equality when it writes.

```
# GATEROWS — every row name of «Owner gates», answered or not
awk -F'|' '/^## Owner gates$/{f=1;next} f&&/^## /{exit} f&&/^\|/{g=$2; gsub(/^ +| +$/,"",g); if (g!="Gate" && g !~ /^-+$/) print g}' docs/program/public-v1/PROGRESS.md
```

The command of SHAPE (bash, from the root of Sai):

```
awk '$0=="---"{exit}
  /^# Sai — the current state$/ {printf "H"; next}
  /^$/ {printf "E"; next}
  /^One screen\. DOC-UPDATER rewrites the lines of this block / {printf "P"; next}
  /^\*\*State:\*\* / {printf "S"; next}
  /^- Requirements \(`docs\/requirements\.yaml`, the status lines of the blocks, read [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\): / {printf "R"; next}
  /^- Open defects \(`docs\/issues\/`, the first line «Серьёзность: …» of each file, read [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\): [0-9]+ — / {printf "D"; next}
  /^\*\*Open gates:\*\* the rows of «Owner gates» in / {printf "G"; g=1; next}
  /^- / && g==1 && !/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/ && !/^- \*\*/ {printf "g"; next}
  /^Owner actions pending \(the same file, «Now»\): / {printf "O"; g=2; next}
  /^\*\*Next step:\*\* / {printf "N"; next}
  /^The three sections below the line are copied verbatim from the old file: / {printf "T"; next}
  {printf "X"}' STATE.md | grep -q -x -E 'HEPESERDEGEg*EOENETE'
```

Measured on the trial: the built block gives `HEPESERDEGE` + 16 × `g` + `EOENETE` (green); the
gate's V09 (a dated journal line after the defects line) gives an `X` (red); V09b (the same line
among the gate lines) gives an `X` and GATESEQ red; V26 (no empty line before `---`) ends `…ENET`
(red). The gate's V09c, a journal line with a date only among the gate lines («- 2026-11-18 —
ISS-0092 closed, a run X done …», no time, not bold), passes SHAPE as a `g` line; it is red under
both parts of GATESEQ (step 1e: the durable part names the line as no row of the gate table). The
criteria of the block stay green on all four (section 18): the checks are the design's and CD-2's.

## 6. The new root PLAN.md (exact text)

```
# Sai plan — the current iteration

ORCH keeps this file (`CLAUDE.md`, the closed list of what ORCH writes): the current iteration, its rules and the requirements that ORCH adds to it after their check (WF-01, step 3). The iterations 1–9 and the queues up to the run M0DOCS-20261117-01 are in `docs/archive/PLAN-until-M0DOCS-20261117-01.md`, a byte copy of the file this one replaced.

Rules:

- One iteration — one result that the owner can see himself. After each iteration — a short report to the owner: what is done, how to check it himself, what is next. The next iteration starts after the report.
- Одновременно работают не больше двух агентов.
- The two lanes of the program and a running worker job share these two slots (`docs/program/public-v1/PLAN.md`, §4.7).

## Current iteration — PUBLIC-V1 milestone M0 «Clean start»

The work goes by the program PUBLIC-V1 (`decisions/0091`, `decisions/0115`): the plan `docs/program/public-v1/PLAN.md` (milestone M0 — its §5: tasks M0.1–M0.14, acceptance AC0.1–AC0.9), the architecture `docs/program/public-v1/ARCHITECTURE.md`, the checkpoint `docs/program/public-v1/PROGRESS.md` («Now» — what runs and the next step). The owner sees the result in report #M0 (task M0.14).

## Requirements of the iteration (ORCH adds each one after its check, WF-01 step 3)

The requirements of the program that are checked and not yet done, and REQ-102 (done in release 1 of M0, kept as the record of the iteration); the statuses are in `docs/requirements.yaml`.

| Requirement | P-code | Run of its WF-01 gate |
| --- | --- | --- |
<PLANROWS>
```

`<PLANROWS>` is the output of the command PLANROWS of 6.1 at the build, one row per line. Read on
the trial of step 1c (2026-11-17T20:36:54Z, the rule of step 1c), and the same four rows on the
trial of step 1e (the rule of step 1e, after ORCH's four form rows):

```
| REQ-102 | R0.1 | ISS-0093-20261028-01 |
| REQ-103 | R0.3 | M0BACKLOG-20261028-01 |
| REQ-108 | R1.1 | M1SITE-20261117-01 |
| REQ-109 | R1.4 | M1SITE-20261117-01 |
```

The statuses are not repeated in the table (they are in `docs/requirements.yaml`), so it cannot
drift. A row that comes later (R0.2 when its WF-01 gate passes, with its form row in PROGRESS.md)
is ORCH's own step (WF-01 step 3), outside the run (`decisions/0117` О5, О22, О31, О37); a later
build, correction or amendment row in PROGRESS.md adds no row and changes none. Trial: 1797 bytes, 24 lines; the greps of criterion 3 give 2, 1, 1, `## Итерация` 0 (the
tag: 9), the rows REQ-102 1 and REQ-103 1.

### 6.1 The rows: PLANROWS

The source is the PROGRESS table «Requirements (P-code → REQ)» at the moment of the build
(`decisions/0117` О31, О36, О37). That table is append only and holds several rows per
requirement (written, gate, build, correction, amendment; F29). The rule of step 1c read the
**last** row of each requirement; the gate's V28 and V28b showed that a later build row drops
REQ-103 and a later amendment row swaps its run (FD-1). The rule now reads the **first** row that
records a passed WF-01 gate (О37).

**The form ORCH keeps for the rows it writes (О37).** A row that records a passed WF-01 gate has
its Status cell begin with the exact text `gate PASS: `, followed by the path of the passing
REQ-VALIDATOR handoff. Its last column (Run) is the run of that handoff. Its P-code cell is the
P-code, with an optional note in brackets. Every other row of the same requirement (written,
build, correction, amendment, a later gate of a micro-amendment) says what it records and does
**not** begin its Status cell with `gate PASS: `. The form, with the angle brackets filled:

```
| <P-code> (gate) | <REQ-NNN> | gate PASS: <path of the passing REQ-VALIDATOR handoff> | <RUN-ID of that handoff> |
```

The rows of the table today were written before the form (F29: «gate REQ-VALIDATOR PASSED …»,
«REQ-VALIDATOR PASS on pass 2 …»); none begins with `gate PASS: `. Before L1 (with the refresh of
«Next step (exact)», О35), ORCH therefore appends one form row for each requirement of the
iteration. Rows are only appended, so the old rows stay. Today these are the four rows (each
handoff measured: `to_agent` REQ-VALIDATOR, `result.verdict` PASS, `run_id` = the Run, the REQ in
`context.requirement_ids`, and the earliest such handoff of that REQ, F33):

```
| R0.1 (gate) | REQ-102 | gate PASS: handoffs/ISS-0093-20261028-01/step-02f-req-validator.json | ISS-0093-20261028-01 |
| R0.3 (gate) | REQ-103 | gate PASS: handoffs/M0BACKLOG-20261028-01/step-02-req-validator.json | M0BACKLOG-20261028-01 |
| R1.1 (gate) | REQ-108 | gate PASS: handoffs/M1SITE-20261117-01/step-02b-req-validator.json | M1SITE-20261117-01 |
| R1.4 (gate) | REQ-109 | gate PASS: handoffs/M1SITE-20261117-01/step-02b-req-validator.json | M1SITE-20261117-01 |
```

When a later requirement passes its WF-01 gate (R0.2), ORCH appends its form row at WF-01 step 3,
in the same step as its PLAN.md row.

**The rule.** For each REQ id of the REQ column, the gate counts as passed if any row of that
REQ is a form row. The first form row in table order gives the P-code (without the note in
brackets: «R0.3 (gate)» → «R0.3»), the Run and the gate handoff. Later rows of any kind never
change the P-code, the Run or the membership. A row goes into the PLAN table for REQ-102, and for
every other REQ with a form row whose status line in `docs/requirements.yaml` is `pending`,
`in_progress` or `blocked`. Rows are sorted by the REQ id. A requirement without a form row is not
in the table. For REQ-102 that makes criterion 3 red at S1 step 5, so S1 stops: ORCH's rows are a
precondition of S1. The commands (bash, from the root of Sai):

```
# PROGREQ — the FIRST form row of each REQ: REQ <tab> P-code <tab> run <tab> gate handoff
awk -F'|' '/^## Requirements \(P-code → REQ\)$/{f=1;next} f&&/^## /{exit} f&&/^\| /{r=$3; gsub(/^ +| +$/,"",r); if (r !~ /^REQ-[0-9][0-9][0-9]$/) next; s=$4; gsub(/^ +| +$/,"",s); if (index(s, "gate PASS: ") != 1 || (r in first)) next; p=$2; gsub(/^ +| +$/,"",p); sub(/ \(.*$/,"",p); u=$5; gsub(/^ +| +$/,"",u); h=substr(s, 12); sub(/ .*$/,"",h); first[r]=r"\t"p"\t"u"\t"h} END{for (r in first) print first[r]}' docs/program/public-v1/PROGRESS.md | LC_ALL=C sort

# PLANROWS — the rows of the table
<PROGREQ> | while IFS="$(printf '\t')" read -r r p u h; do
  s=$(awk -v id="$r" '$0=="  - id: "id{f=1} f&&/^    status: /{print $2; exit}' docs/requirements.yaml)
  if [ "$r" = REQ-102 ] || printf '%s\n' "$s" | grep -q -x -E 'pending|in_progress|blocked'; then printf '| %s | %s | %s |\n' "$r" "$p" "$u"; fi
done

# FIRSTGATE — from the handoffs themselves: REQ <tab> the run of its earliest passing REQ-VALIDATOR handoff
for f in handoffs/*/*.json; do jq -r 'select(.to_agent=="REQ-VALIDATOR" and (.result.verdict? // "")=="PASS") | .completed_at as $t | .run_id as $u | (.context.requirement_ids // [])[] | select(type=="string" and test("^REQ-[0-9]{3}$")) | "\(.)\t\($t)\t\($u)"' "$f" 2>/dev/null; done | LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k2,2 | awk -F'\t' '!($1 in s){s[$1]=1; print $1"\t"$3}'
```

**The check PLANROWS** runs at S1 step 5, after the refresh before step 9, and by
RELEASE-VALIDATOR at step 9 under L3. «The section» is the section «Requirements of the
iteration» of PLAN.md, and «its rows» are its lines that start with `| REQ-NNN `:

1. every line of the PLANROWS output is one of its rows, compared as the whole line. A row whose
   gate passed after the build is added by ORCH's WF-01 step 3 before step 9;
2. every row names a block of `docs/requirements.yaml` whose status line is not `cancelled`;
3. the rows REQ-102 and REQ-103 are there (criterion 3);
4. for every row, the gate handoff of the first form row of its REQ exists and is a REQ-VALIDATOR
   handoff with `result.verdict` PASS, whose `run_id` is the row's Run and whose
   `context.requirement_ids` holds the REQ;
5. for every row, its Run is the run of FIRSTGATE for its REQ: the run that first gated the block
   (`decisions/0117` О36). This reads the handoffs, not PROGRESS.md;
6. every requirement of the PROGRESS table «Requirements (P-code → REQ)» (a REQ-NNN with any row
   there) that FIRSTGATE lists and whose status line is `pending`, `in_progress` or `blocked` has a
   row. This is the meaning of «program requirement» (`decisions/0117` О41; FE-2). A requirement
   outside that table, such as REQ-104…REQ-107 of the run E2E-20261103-01, which PROGRESS.md
   «Now» names as outside the program, is not in the scope of (6).

Parts (1), (4) and (6) depend on PROGRESS.md or on a gate that may pass during the run, so they
are not in the permanent test. Parts (2), (3) and (5) are CD-4: the handoffs are append only and
committed, and a later gate of a micro-amendment comes later in time, so (5) does not change with
time. The commands of (1)–(6) (bash, from the root of Sai; PROGREQ, PLANROWS and FIRSTGATE stand for
the three commands above; every check prints nothing when it holds; FE-3):

```
ROWS=$(awk '/^## Requirements of the iteration/{f=1;next} f&&/^## /{exit} f' PLAN.md | grep -E '^\| REQ-[0-9]{3} ')
st() { awk -v id="$1" '$0=="  - id: "id{f=1} f&&/^    status: /{print $2; exit}' docs/requirements.yaml; }
# (1) every derived row is a row of the section, as the whole line
<PLANROWS> | while IFS= read -r line; do printf '%s\n' "$ROWS" | grep -q -x -F -- "$line" || echo "missing: $line"; done
# (2) every row names a block that is not cancelled
printf '%s\n' "$ROWS" | cut -d'|' -f2 | tr -d ' ' | while read -r r; do s=$(st "$r"); if [ -z "$s" ] || [ "$s" = cancelled ]; then echo "no block or cancelled: $r"; fi; done
# (3) the rows REQ-102 and REQ-103
for r in REQ-102 REQ-103; do [ "$(printf '%s\n' "$ROWS" | grep -c -E "^\| $r ")" = 1 ] || echo "no row: $r"; done
# (4) the gate handoff of the first form row backs each row
PQ=$(<PROGREQ>); printf '%s\n' "$ROWS" | while IFS='|' read -r _ r p u _; do r=$(echo $r); u=$(echo $u); h=$(printf '%s\n' "$PQ" | awk -F'\t' -v r="$r" '$1==r{print $4}'); if [ -z "$h" ] || ! jq -e --arg r "$r" --arg u "$u" '.to_agent=="REQ-VALIDATOR" and .result.verdict=="PASS" and .run_id==$u and ((.context.requirement_ids // []) | index($r) != null)' "$h" >/dev/null 2>&1; then echo "not backed by its gate handoff: $r"; fi; done
# (5) the Run of each row is the run of the first passing gate of its REQ
FG=$(<FIRSTGATE>); printf '%s\n' "$ROWS" | while IFS='|' read -r _ r p u _; do r=$(echo $r); u=$(echo $u); e=$(printf '%s\n' "$FG" | awk -F'\t' -v r="$r" '$1==r{print $2}'); [ "$e" = "$u" ] || echo "Run is not the first gate: $r ($u, first gate ${e:-none})"; done
# (6) every requirement of the P-code table with a passed gate and not done has a row (FG from (5))
awk -F'|' '/^## Requirements \(P-code → REQ\)$/{f=1;next} f&&/^## /{exit} f&&/^\| /{r=$3; gsub(/^ +| +$/,"",r); if (r ~ /^REQ-[0-9][0-9][0-9]$/) print r}' docs/program/public-v1/PROGRESS.md | LC_ALL=C sort -u | while read -r r; do printf '%s\n' "$FG" | cut -f1 | grep -q -x -F "$r" || continue; st "$r" | grep -q -x -E 'pending|in_progress|blocked' || continue; printf '%s\n' "$ROWS" | grep -q -E "^\| $r " || echo "no row: $r"; done
```

Measured on the trial of step 1g (2026-11-18T04:37:39Z; today's working `docs/requirements.yaml`
with 110 requirements, PROGRESS.md with ORCH's four form rows): every check prints nothing. The
gate's V28f (REQ-104 back to `pending`) is red under the (6) of step 1e («missing: REQ-104») and
green under this one. V10 (the REQ-108 row dropped) is red under (1) and (6). REQ-110 (R0.2,
pending; its gate step 02b FAIL, step 02d in progress) has no row in the P-code table and no
passing gate yet. When ORCH appends its form row, (6) asks for its PLAN.md row.

**Measured on the trial of step 1e** (2026-11-17T21:26:17Z–21:26:50Z; PROGRESS.md with ORCH's
four form rows appended; the PLAN table as built):

| Case | Old rule (step 1c) | New rule (step 1e) |
|---|---|---|
| today's PROGRESS.md, no form row yet | the four rows | no row (ORCH's form rows are a precondition; S1 would stop at criterion 3) |
| the four form rows appended | the four rows | the four rows, equal to the built table; checks (1)–(6) green |
| V28: a build row `\| R0.3 (build) \| REQ-103 \| in_progress: the build of run M0DOCS-20261117-01 has started (S0) \| M0DOCS-20261117-01 \|` appended | **red**: S1 would build a table without REQ-103 (criterion 3's REQ-103 grep → 0) | green: the same four rows |
| V28b: the gate's amendment row `\| R0.3 (micro-amendment) \| REQ-103 \| pending; amended, gate REQ-VALIDATOR PASS on pass 3 \| REQ103AMEND-20261117-01 \|` appended | **red**: S1 would build `\| REQ-103 \| R0.3 \| REQ103AMEND-20261117-01 \|`; that table is red under (1), (4) and (5) | green: Run M0BACKLOG-20261028-01 |
| V28c: an amendment row in the form (`gate PASS: handoffs/REQ103AMEND-20261117-01/step-02c-req-validator.json`, Run REQ103AMEND-20261117-01) appended — ORCH breaking its own form | **red**: Run REQ103AMEND-20261117-01 | green: the first form row wins |
| V28e: the same form row **inserted** above every row (not appended) | — | **red**: on the built table (1) and (4); on a table built from it (5) («REQ103AMEND-20261117-01 != M0BACKLOG-20261028-01») |

The ways that remain to defeat the rule are named in section 23.

## 7. CLAUDE.md (was → became)

E7.1 — the body of «## What we are building» (tag lines 17–32, from the empty line after the
heading to the line before «## Read at the start — every role»). The last paragraph («What is
already done … — `PLAN.md`.») stays. Was:

```
The virtual team: the user sets a goal in ordinary words, the engine builds a plan, starts
…  (two paragraphs; they name `docs/product/current-state.md`, `docs/product/parity-matrix.md`,
`docs/product/roadmap.md`, decision 0015, `tools/src/team/`, the picker, «REQ-054…REQ-068»)
```

Became (these two paragraphs, then the kept last paragraph):

```
Sai is a virtual team of AI agents for business: a person describes an idea in ordinary words,
the agents clarify it, write the specification (ТЗ) in versions, build the result after the
owner's approval, and the office shows only their real work. Now it is built as the program
PUBLIC-V1 (`decisions/0091`; the owner chose it as the finished product, `decisions/0115`): a
closed public product site on Vercel in test mode. The landing and the demo survey are open to
everyone, accounts are by invitation; the owner runs the whole chain on his own projects —
idea, AI interview, ТЗ versions, approval, «В разработку» behind his password, the agents
build, the office shows the real work, he opens the result. V1 is the milestones M0–M7; open
registration, the customer cabinet, the own domain and hosting in Kazakhstan come later (M8,
M9). The plan is `docs/program/public-v1/PLAN.md`, the architecture
`docs/program/public-v1/ARCHITECTURE.md`, the checkpoint and the next step
`docs/program/public-v1/PROGRESS.md`; the stack and the one check command of the product —
`decisions/0001-product-stack-and-check-command.md`.

The code of the earlier work stays: the team core and engine in `tools/src/team/`
(`decisions/0015-product-virtual-team-start.md`), Pixel Office — the owner's local monitor of
the pipeline, never published (`tools/src/pixel-office/`), and the solution picker site in
`tools/src/picker/` (`decisions/0065-solution-picker-stack-and-choices.md`; its build queue is
stopped by `decisions/0099`). The files of `docs/product/` are snapshots of 2026-10, kept as
history.
```

Each sentence was compared with §1 and §2 of `docs/program/public-v1/PLAN.md` («A closed public
product on Vercel in test mode», «The landing, onboarding and the demo survey are open to
everyone; accounts are invite-only», «V1 = M0–M7. Later: M8 …, M9 …», «The owner's original
Pixel Office stays his local monitor … and is never published»). The text keeps «virtual team»
(TM-01 (г), 4 (a)) and holds none of «кода продукта нет», «there is no product code», «no
product code».

E7.2 — the ORCH write list. Insert after the line «  exception from the bar — only by the
owner's written words (quality-bar §1, item 3);» (tag line 129) and before «- moving a requirement
status …». No existing line changes:

```
- the files of the program in `docs/program/public-v1/**` — bookkeeping and the owner's
  instructions, no code; its `PLAN.md` and `ARCHITECTURE.md` are not edited, a change is a
  dated row of the table "Plan amendments" of `PROGRESS.md` (`decisions/0091`, items 4 and 8);
- appending the owner's words verbatim to `docs/owner-requests/` (`decisions/0091`, item 4):
  only appended, nothing in those files is rewritten;
```

The IDEA-ANALYST and IDEA-JUDGE paragraph (from tag line 51) is not touched (4 (b); M14).

## 8. README.md (was → became)

No edit touches the sections «## How to open on another computer» and «## Check on GitHub and
before a push» (5 (e), RD-1…RD-4, TD-1…TD-3, E2K-61). No new line equals either heading or
contains its text: the «rules are not blind» test edits the first occurrence of the heading text
(M17). `REQ-008` appears on exactly one line of the file, because 5 (d) reads that line and the
next one (M20 found that a second `REQ-008` followed by the counts line «3 blocked» satisfied (d)
without the sentence).

| # | Tag line | Was | Became |
|---|---|---|---|
| R1 | 182 | `  built, in the order of \`PLAN.md\`: until the` | `  built; their build queue is stopped by \`decisions/0099\`: until the` (О9) |
| R2 | 336–338 | `  product state and plans (\`product/\`), the owner's goals in his words (\`owner-goals.md\`). The` / `  folder of audits \`docs/audits/\` will appear with the first audit` / `  (\`docs/workflows/WF-05-health-audit.md\`).` | `  snapshots of the product state of 2026-10 (\`product/\`), the owner's goals in his words` / `  (\`owner-goals.md\`), the program PUBLIC-V1 (\`program/public-v1/\`), the old journals of` / `  \`STATE.md\` and \`PLAN.md\` (\`archive/\`), and the audits (\`audits/\`, their list is` / `  \`docs/audits/README.md\`; the first one, AUD-001, is closed).` |
| R3 | 355 | `As of 2026-10-26, from \`STATE.md\`, \`docs/requirements.yaml\` and \`docs/issues/\`:` | `As of <T>, from \`docs/requirements.yaml\` and \`docs/issues/\`:` (`<T>` of 5.3; if О4 keeps B: `As of 2026-11-17, from \`docs/requirements.yaml\` and \`docs/issues/\` at the base of the run M0DOCS-20261117-01:`) |
| R4 | 369–370 | `  The requirements for the core of Pixel Office (REQ-001, REQ-007, REQ-008) are still in` / `  progress.` | `  The requirements for the core of Pixel Office (REQ-001, REQ-007, REQ-008) are \`blocked\`:` / `  they wait for one real Claude Code session that the owner allows and for his look at the` / `  office (criterion 16 of REQ-007).` (the true reasons of the three status lines, read on 2026-11-17) |
| R5 | 371–376 | `- **Requirements:** 87 in total — 31 done, 4 in progress, 52 pending (counted from` … `  built and done since 2026-10-18.` (six lines) | `- **Requirements:** <COUNTS>` / `  (counted from the status lines of \`docs/requirements.yaml\`; the order of work is the` / `  program PUBLIC-V1, \`docs/program/public-v1/PLAN.md\`).` / `  The requirements the program does not need now are deferred or cancelled with a pointer` / `  (\`decisions/0099\`). The requirements for a built-in Pixel Office guide (help panel,` / `  first-visit tour, hints; REQ-050…REQ-053) are built and done since 2026-10-18.` (the «Still pending, for example» sentence names goal templates, `cancelled`; О9) |
| R6 | 379–380 | `- **Open defects: 74** in \`docs/issues/\` — 9 of medium severity and 65 low; none high or` / `  critical.` | `- **Open defects: <D>** in \`docs/issues/\` — <DC> critical, <DM> of medium severity and <DL> low; none high.` (if `<DH>` > 0: `…, <DH> high, …` and no «none high») |
| R7 | 387–388 | `- **No health audit yet.** The first WF-05 audit has not run; the folder \`docs/audits/\` will` / `  appear with it (\`docs/workflows/WF-05-health-audit.md\`).` | `- **The first health audit, AUD-001, is closed** (WF-05, 2026-10-27; \`docs/audits/README.md\`,` / `  the report \`docs/audits/AUD-001/report.md\`). Each of its Critical and High findings has a` / `  defect (\`docs/program/public-v1/PROGRESS.md\`, «Finding → defect»); the open ones are in the` / `  count above.` |
| R8 | 119–120 | `Everything below is checked by the command \`cd tools && npm run check\` and by the gates of the` / `runs (\`STATE.md\`).` | `Everything below is checked by the command \`cd tools && npm run check\` and by the gates of the` / `runs (the release reports in \`docs/releases/\`; the old journal` / `\`docs/archive/STATE-until-M0DOCS-20261117-01.md\`).` (the new STATE.md holds no run history; FC-5, О34) |
| R9 | 184 | `  real visitors. The exact status is in \`docs/requirements.yaml\` and \`STATE.md\`. Start` | `  real visitors. The exact status is in \`docs/requirements.yaml\`. Start` (the new block holds no status of the picker) |
| R10 | 330 | `- \`STATE.md\` — what is done, what is open, what is next; \`PLAN.md\` — iterations and steps.` | `- \`STATE.md\` — one screen: the state, the open gates and the next step; \`PLAN.md\` — the` / `  current iteration and its requirements.` (their old journals are named by R2) |
| R11 | 364–365 | `  has not been done. A real run needs the owner's consent and a spending cap (\`STATE.md\`,` / `  "Ждёт владельца", i.e. "Waits for the owner").` | `  has not been done. A real run needs the owner's consent for that run and a spending cap` / `  (gate G2 in \`docs/program/public-v1/PROGRESS.md\`, «Owner gates»).` (in the new file «Ждёт владельца» stands only in the stale tail; G2's answer is «Спрашивать перед каждым», «no run without his written yes and a ceiling») |

(`/` separates lines; each line keeps its leading spaces as shown.) R8–R11 lie outside the two
protected sections and add no line equal to a heading. Their check (S4, CD-6; bash, from the root
of Sai) — each count → 0:

```
grep -c -F 'runs (`STATE.md`)' README.md
grep -c -F 'The exact status is in `docs/requirements.yaml` and `STATE.md`' README.md
grep -c -F 'what is done, what is open, what is next' README.md
grep -c -F '"Ждёт владельца"' README.md
```

Trial of step 1c: (a) 0, 0, 3, 2; (b) the live COUNTS 1 and one «As of <time>,» line; (c) D = 97,
1; (d) 1 and 0, the sentence 1; (e) both sections equal; (g) 0 and 0; the four greps above 0; repo
26/26, traces-readme 7/7 and E2K-61 1/1 green.

## 9. docs/product and ideas/README.md

E9.1 — for each of the four files of `git ls-tree --name-only "${B}" docs/product/`, a new first
line `Snapshot of <date>; current: docs/program/public-v1/`, where `<date>` is the UTC date of
the last commit that changed the file before B (F25: 2026-10-11, 2026-10-10, 2026-10-13,
2026-10-09). The rest of the file is the bytes of the tag unchanged, with no empty line inserted
(M22). The heading stays on line 2: an ATX heading follows a paragraph line in Markdown without
an empty line.

E9.2 — `ideas/README.md` line 9, the third cell only (no `|` inside: NF stays 5, M24). Was:
`| **Выбрана**, спрос не проверен |`. Became:
`| Снята решением \`decisions/0033\` (2026-10-11); продукт Sai — виртуальная команда ИИ-агентов (\`decisions/0015\`) |`.
The cell is in Russian like the rest of the table (О8). No other line changes; the top note that
DOC-07 also proposed is not added, because 6 (b) forbids it.

## 10. The four handoffs (ORCH, sub-step S5a)

Files: `handoffs/WF06-20260926-01/step-10-orch.json`, `step-11-req-analyst.json`,
`step-12-ba-analyst.json` (status `PENDING`), `handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json`
(status `IN_PROGRESS`, `result.status` `IN_PROGRESS`, its first issue not BLOCKED). The edit is a
text edit of two places; every other byte stays:

1. The top-level line, exactly `\n  "status": "<old>",\n` including the line start (F19: in the
   ISS-0002 file the same text with four spaces is `result.status`, which must not change; M25),
   becomes `\n  "status": "CANCELLED",\n`.
2. A new last top-level member, with the file's two-space indent:
   `"orch_cancellation": { "by": "ORCH", "at": "<clock>", "reason": "<text>" }`. The member before
   it gets a `,`, and the file keeps its final `}\n`.

Shape of `orch_cancellation`: `by` — non-empty string «ORCH»; `at` — the strict time from the
clock (H5–H7; M27); `reason` — more than 20 characters, naming at least one existing path under
`decisions/` or `handoffs/` (`test -e` of each named path; M38). The proposed texts (О16):

- three WF06-20260926-01 files: «Not done and no longer to be done: these steps waited for the
  owner's written decision to start the demand check of the idea 01-kviz-zayavki
  (runs/WF06-20260926-01/verdict-2.md); the owner chose the virtual team instead
  (decisions/0015-product-virtual-team-start.md) and dropped the earlier product
  (decisions/0033-drop-clothing-shop-product.md). Finding DOC-10 of the audit AUD-001
  (docs/audits/AUD-001/report.json). The record is closed, not rewritten (REQ-103, run
  M0DOCS-20261117-01).»
- the ISS-0002 file: «Superseded: this step was not continued after its interruption
  (context.interruptions), and the defect ISS-0002 was closed on 2026-10-11 by the run
  ISS-0002-20261011-01 (handoffs/ISS-0002-20261011-01/step-10-doc-updater.json;
  docs/issues/ISS-0002-apply-verdict-partial-write.md). Finding DOC-11 of the audit AUD-001
  (docs/audits/AUD-001/report.json). The record is closed, not rewritten (REQ-103, run
  M0DOCS-20261117-01).»

Before each edit ORCH checks that the file equals B (`git diff --quiet "${B}" -- <file>`), and
after it runs criterion 7's `jq` and `diff`. After all four, `handoffs-check` → exit 0 with
exactly four lines «исключение не использовано» for lines 21, 117, 118, 119 (F16). H4 does not
check `by` (F20), so the criterion's `jq` and CD-9 are the guards of `by`. RELEASE-VALIDATOR does
the reading part of criterion 7 itself (`test -e` of each path a reason names; `decisions/0117`
О35); the gate's V19 (a reason naming a missing decision file) is green under the `jq` and red only
under that reading and CD-9.

## 11. The two tools edits (BACKEND-DEV, sub-step S5b)

E11.1 — `tools/handoffs/exceptions.tsv`: delete exactly the four lines whose first three columns
are (tag line numbers):

| Tag line | Path | Rule | Field |
|---|---|---|---|
| 21 | `handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json` | H4 | `result.issues` |
| 117 | `handoffs/WF06-20260926-01/step-10-orch.json` | H4 | `status` |
| 118 | `handoffs/WF06-20260926-01/step-11-req-analyst.json` | H4 | `status` |
| 119 | `handoffs/WF06-20260926-01/step-12-ba-analyst.json` | H4 | `status` |

The header (`# база: 7760e4b…`) and the other 110 records stay byte-equal. The developer checks
each deleted line by its three columns, not only by its number (M30: a wrong deleted line is
red in handoffs-check and HC-7a).

E11.2 — HC-7c in `tools/test/handoffs-real.test.js` (tag lines 83–126), the replacement table:

| Tag line | Was | Became | Why |
|---|---|---|---|
| 85 | `assert.equal(rows.length, 114);` | `assert.equal(rows.length, 110);` | four records removed |
| 100 | `assert.ok(has("handoffs/WF06-20260926-01/step-10-orch.json", "H4", "status"));` | removed | the base no longer holds that row |
| 115–117 | the comment «The two CANCELLED handoffs give no violation.» and two `!has` of WF06-20260925-01 | the comment names both sets («the two of WF06-20260925-01 and the four of REQ-103 (run M0DOCS-20261117-01)»); the two `!has` stay; after them, for each of the four files of E11.1, one assertion that the base holds no H4 record of that file, **with a message that names the file and the rule** (below) | stronger: the base holds none of the four, and a red run says which |

The four new assertions (`decisions/0117` О21, О24, О30), in this form — four literal calls, each
with its own path twice and the rule H4, reached on every run (no condition on the base around
them), in the order of E11.1's paths:

| # | The assertion | Its message |
|---|---|---|
| 1 | `!has("handoffs/WF06-20260926-01/step-10-orch.json", "H4")` | `the base holds an H4 record of handoffs/WF06-20260926-01/step-10-orch.json` |
| 2 | `!has("handoffs/WF06-20260926-01/step-11-req-analyst.json", "H4")` | `the base holds an H4 record of handoffs/WF06-20260926-01/step-11-req-analyst.json` |
| 3 | `!has("handoffs/WF06-20260926-01/step-12-ba-analyst.json", "H4")` | `the base holds an H4 record of handoffs/WF06-20260926-01/step-12-ba-analyst.json` |
| 4 | `!has("handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json", "H4")` | `the base holds an H4 record of handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json` |

Each is `assert.ok(<the assertion>, "<its message>")`; the formatter splits each over four lines.
A loop over a literal list of the four paths with the message built from the path is equivalent
(measured, F31); the design takes the four calls because RELEASE-VALIDATOR reads them more easily
for criterion 8 (b). Without the message, the formatter splits the call and node prints only its
first line, so the output names neither the path nor H4, and criterion 8 (c) is red (F31; the
gate's V22). BACKEND-DEV builds this form in S5b, so the checks right after S5b are green; TEST-DESIGNER
does not rebuild it at step 5 (О30 supersedes О24 here). The test file stays formatted (`prettier
--check`) and lint-clean, and adds no word that HC-10a forbids. HC-7a, HC-7b and HC-5b do not
change. Counts: `grep -c '^test(' tools/test/handoffs-real.test.js` → 4 (unchanged);
`grep -c 'assert\.' tools/test/handoffs-real.test.js` → 25 at the tag, 28 after E11.2 (measured).

## 12. Guard tests: the replacement table

A grep of `tools/test` and `tools/src` on the tag clone (2026-11-17) for `STATE.md`, `PLAN.md`,
`CLAUDE.md`, `README.md`, `docs/product`, `docs/archive`, `ideas/README.md`, `owner-requests`,
`program/public-v1`, the path segments `"product"`, `"archive"`, `"ideas"`, `"program"`, the
handoff ids, the phrases edited above (`Выбрана`, `Одновременно`, `What we are building`, `ORCH
writes by itself`, `No health audit`, `will appear with the first audit`, `Open defects`, `Snapshot
of`, `still in`) and `exceptions.tsv`. 147 hits of the file names. Each hit was classified by
whether it reads the real tree or a temporary root, and what it counts (AP-068, AP-112, AP-113):

| # | Test (file:line) | Reads | Real tree? | What it counts | Was → became | Red in |
|---|---|---|---|---|---|---|
| 1 | HC-7a `tools/test/handoffs-real.test.js:55` | runs `handoffs-check` | yes | K = L = records of the base (a closed number through the file) | 114 of 114 → 110 of 110; code unchanged | S5a until S5b (F16) |
| 2 | HC-7c `:83` | `tools/handoffs/exceptions.tsv` | yes | `rows.length` = 114 and named rows | table E11.2 | S5b between its two edits (F18) |
| 3 | HC-7b `:79` | the line «База handoffs-check:» of the decision with the largest number that has it, and the header | yes | one hash | unchanged (neither is touched; new decisions have no such line) | — |
| 4 | HC-5b `:134` | `npm run traces` | yes, untracked files too (F9) | 0 traces | unchanged; the archive and new files have no trace (trial: 2563 files, 0) | — |
| 5 | HC-10a `tools/test/handoffs-docs.test.js:124` (the list FORBIDDEN it uses starts at line 109) | the handoffs files of tools, incl. `handoffs-real.test.js` and `exceptions.tsv` | yes | forbidden words, home paths, secrets per line | unchanged; the E11.2 lines add none (5/5 on the trial) | — |
| 6 | TM-01 (а) `tools/test/team-docs.test.js:33` | `STATE.md`, the section of «### Решение владельца о старте» up to the next `#`–`###` heading | yes | a line with «ДОВЕСТИ ПРОДУКТ ДО РАБОЧЕГО СОСТОЯНИЯ» and 2026-10-06 | unchanged; the section is in the tail (5.4) | — |
| 7 | TM-01 (г) `team-docs.test.js:80` | `CLAUDE.md` whole | yes | has «virtual team», none of three phrases | unchanged; rule of E7.1. The phrase also stands in CLAUDE.md's first section, so this test alone does not guard the new section (M35t); 4 (a) does | — |
| 8 | REQ-003 AC3 `tools/test/repo.test.js:67–113` | role files and `CLAUDE.md` | yes | CLAUDE.md includes IDEA-ANALYST, IDEA-JUDGE, «Reading scope» | unchanged; the paragraph is byte-equal (4 (b)) | — |
| 9 | RD-1…RD-4 and «the rules are not blind» `repo.test.js:1113–1296` (rules 1149–1197, tests 1205–1296; the amended block says the same) | `README.md` | yes | exactly one of each heading, the order, no `## ` between, 13 words, banned words; the mutants edit the first occurrence of the heading text | unchanged; rule of section 8 | — |
| 10 | TD-1…TD-3 `tools/test/traces-readme.test.js:20–52` | `README.md` | yes | lines of «How to open on another computer»; no outdated words in the whole file | unchanged | — |
| 11 | E2K-61 `tools/test/e2e-kit.test.js:4038` (not in the block's table: written for REQ-104 after 2026-10-28) | root `README.md`, «## How to open on another computer» up to the first `1. ` line; `tools/README.md`; decisions/0107 | yes | Chrome, SAI_CHROME, «fails», no `://` | unchanged; the section is byte-equal | — |
| 12 | apply, snapshot, cli, prepare, validate tests (`tools/test/helpers.js:103–110`, `apply.*.test.js`, `snapshot.test.js`, `cli.test.js`, `prepare.test.js:46`, `validate.*.test.js`) | `STATE.md`, `ideas/README.md` | no: temporary roots of `helpers.js`; the anchors come from `tools/src/contract.js` | — | none (trial of step 1c: the 15 files, 194 of 194 green) | — |
| 13 | `tools/README.md` readers (DC-01, HC-9b, HO-52, WEB-12, CTL-13, DT-6c, E2K, team-engine, exec docs) and other readers of these file names that the gate found (RB-17 reads the blocks REQ-009, REQ-010, REQ-013; `handoffs-cmd-*` use the ISS-0002 run id as a name only) | `tools/README.md`, other blocks | yes | phrases of tools/README, other blocks | not touched by this run | — |

No test or code in `tools/` opens `docs/product/*.md`, the root `PLAN.md`, `docs/archive/`,
`docs/owner-requests/` or the real `ideas/README.md` (grep: 0). Replaced or weakened: none.
HC-7c becomes stricter.

## 13. Build sub-steps

Each sub-step is checked on its own; «red» was measured on the trial.

| Sub-step | Who | What | Checks after it | Existing tests red after it |
|---|---|---|---|---|
| S0 | ORCH | when the build starts (WF-02 step 0, `decisions/0117` О35): REQ-103 `pending` → `in_progress` (status line only, under L0) | `git diff` of the file: one line in the block | none |
| S1 | ORCH, then DOC-UPDATER | ORCH refreshes PROGRESS «Next step (exact)», appends the form rows of 6.1 that are missing (today four), takes L1, writes `pre_state` (and «superseded by» on an earlier record); DOC-UPDATER: section 4.4 | criteria 1 (a)–(f), 2 (a)–(e), (g), 3; SHAPE, GATESEQ (5.6); PLANROWS (6.1); `cd tools && node --test test/team-docs.test.js` | none (trial: 108 of 108 mechanical parts after S5b; TM-01 green; the temporary-root tests 194/194; `placeBlock` ok) |
| S2 | DOC-UPDATER | E9.1, E9.2 | criterion 6 | none |
| S3 | DOC-UPDATER | E7.1, E7.2 | criterion 4 (a)–(d) | none |
| S4 | DOC-UPDATER | R1–R11 | criterion 5 (a)–(g); the four greps of R8–R11; `node --test --test-name-pattern E2K-61 test/e2e-kit.test.js` | none |
| S5a | ORCH | L2; section 10 | criterion 7; `npm run -s handoffs-check` exit 0 with four «не использовано» lines | HC-7a only (expected by the design; nobody runs the full check in L2) |
| S5b | BACKEND-DEV, right after S5a | E11.1, then E11.2 with the four messages | criterion 8 (a) and the mechanical parts of (b); (c) on a fresh clone with the built two files (the block's probes); `node --test test/handoffs-real.test.js` 4 of 4; `npx prettier --check test/handoffs-real.test.js`; `npx eslint --max-warnings 0 test/handoffs-real.test.js`; `npm run traces` | HC-7c between E11.1 and E11.2 only; none after |
| step 5 | TEST-DESIGNER | `tools/test/current-docs.test.js` (section 16); the mutants of section 18 on a fresh clone | 5b gate; criterion 9's `node --test test/current-docs.test.js` | — |
| S8b | DOC-UPDATER (only if a source changed after S1, О11; the block's «Time-dependent lines») | only the time lines of the block and R3, R5, R6 (and the gate lines) | `diff` of STATE.md and README.md before/after shows only those lines; SHAPE, GATESEQ | none |
| step 9 | RELEASE-VALIDATOR | every criterion under L3, with its own reading of 1 (d), 2 (f), 4 (a), 7 and 8 (b) (О28, О29, О35); PLANROWS and GATESEQ | — | — |
| step 10 | DOC-UPDATER, after ISS-0092-20261117-01 has passed its step 10 (О33) | takes L4; REQ-103 `done` first, then reads COUNTS and D and rewrites the time lines of the block and R3, R5, R6; AP records; the Low defect of О15; «As built» of this design | ORCH's check of step 10 runs the same commands | none |
| M0.13 | ORCH, RELEASE-VALIDATOR, DOC-UPDATER, RELEASE-FINALIZER of run M0REC | one records release of M0.9 (ISS-0092), M0.10 (this run) and the records of M0.11, M1.1 and the decisions (О33); L4 stays until its commit C | right before C: the comparison on the index below (STAGED); a difference stops the commit, and the next step follows | — |

S1–S4 touch different files and can go in any order. S5 does not depend on them, but S5a and
S5b go together with no full check between them. The order inside S5 is fixed:
cancellations first. The other order makes `handoffs-check` exit 1 for every run (F17).

The count lines are protected as one sequence from the reading of step 10 to the commit C
(`decisions/0117` О33; FC-4). ISS-0092-20261117-01 writes its last statuses (its R0.2 block, ISS-0092
closed) before this run's step 10. From that reading until C, L4 holds every source of the count
lines and every file they stand in, so none can change. Any writer inside L4 (a DOC-UPDATER of
M0REC) that changes a source runs the commands again and rewrites the time lines in the same step.
RELEASE-FINALIZER stages the files of the release by name. As the last action before
`git commit`, it runs the comparison STAGED on the index, which is what C will hold
(`decisions/0117` О38). The commands are those of the block's «a later re-check», read from the
index instead of a commit (bash, from the root of Sai; each count → the number shown):

```
# STAGED — the count lines against the index, right before the commit C
CI=$(git show ":docs/requirements.yaml" | awk '/^  - id: REQ-/{n++} /^    status: /{c[$2]++} END{printf "%d in total — %d done, %d in progress, %d blocked, %d pending, %d cancelled", n, c["done"], c["in_progress"], c["blocked"], c["pending"], c["cancelled"]}')
DI=$(git ls-files docs/issues/ | grep -E '^docs/issues/ISS-[0-9]+' | while read -r f; do git show ":$f" | grep -m1 -E '^Серьёзность:'; done | grep -c -E 'Статус: open')
git show ":STATE.md" | awk '$0=="---"{exit} 1' | grep -c -F -- "$CI"                     # → 1
git show ":STATE.md" | awk '$0=="---"{exit} 1' | grep -c -E "^- Open defects \(.*\): $DI — "   # → 1
git show ":README.md" | grep -c -F -- "$CI"                                                # → 1
git show ":README.md" | grep -c -E "Open defects: $DI([^0-9]|\$)"                           # → 1
git diff --quiet -- docs/requirements.yaml docs/issues/ STATE.md README.md                  # exit 0: no unstaged change
git ls-files --others --exclude-standard -- docs/issues/ | wc -l                            # → 0: no defect file left out
```

On a difference, RELEASE-FINALIZER does not commit. Its handoff stops (BLOCKED) and names the
line that differs. ORCH then runs the next step under L4, which still holds:

1. a short DOC-UPDATER step (the next step letter of step 10) runs the commands of 5.3 again and
   rewrites the count and defect lines of STATE.md and README.md (R3, R5, R6), and its `diff`
   shows only those lines;
2. ORCH checks that step;
3. a RELEASE-FINALIZER step stages the files again, runs STAGED again, and commits only when every
   count is as shown.

Measured on the trial of step 1e: STAGED is green on the staged built files. A status changed and
staged after the lines were written (REQ-109 `pending` → `in_progress`) makes both COUNTS lines
red. A new open defect file that was not staged makes the last line red. Both were undone with
`git add` and the files, and STAGED was green again. After C, a later re-check reads the lines at
C (the block's «a later re-check»).

## 14. Locks of the shared files (PLAN §4.7)

The runs in parallel at step 1c (F30; `decisions/0117` О33; M1SITE-20261117-01 is finished):

- ISS-0092-20261117-01 — WF-03 for R0.2 (the Node floor), step 01 done, step 02 REQ-ANALYST
  IN_PROGRESS at step 1e (it appends one block to `docs/requirements.yaml`). Its later steps write
  `docs/requirements.yaml` (the R0.2 block), `tools/package.json`, its lockfile,
  `tools/src/pixel-office/main.js`, `tools/README.md` line 9 and tests (none of the two files of
  E11). At its step 10 it writes `docs/issues/` (ISS-0092 closed), status lines, `STATE.md` (rule 5.5)
  and perhaps `PLAN.md` and `docs/anti-patterns.md`. It runs the full check.
- M1CODE-20261117-01 — the code design of REQ-108/109, step 01 done; it writes
  `docs/design/REQ-108-109-app-skeleton.md`. ORCH's decision records go to `decisions/` and
  `decisions/README.md`.
- REQ108AMEND-20261118-01 — a WF-01 micro-amendment, step 01c IN_PROGRESS with `write_set`
  «docs/requirements.yaml (block REQ-108 only)».

The holder of each lock writes `context.file_lock` into the handoffs of the other runs
(handoffs.md). Every lock on a file has the same precondition: before it is taken, no handoff that
is `PENDING` or `IN_PROGRESS` (a stop included: it may resume) has that file in its `write_set`.

**How a write-set item is read (step 1g; `decisions/0117` О38, О41; FE-1).** Step 1e matched a name
after a space, comma, semicolon or bracket. That missed `docs/requirements.yaml:` with a colon, which
ORCH wrote in two real handoffs (F35). The item is now cut into **path tokens**. A token is a longest
run of the characters a path can hold: `A-Z a-z 0-9 _ . - /` and the glob star `*`. Every other
character is a boundary on both sides: a space, a colon, a backtick, «», a bracket, a comma, a
semicolon, Cyrillic text. Then:

1. a token loses its final periods (a sentence period: «only STATE.md.») and a leading `./`;
2. a token is cut after a segment with an extension that a `/` follows, so the pair
   `STATE.md/PLAN.md` gives the two tokens `STATE.md` and `PLAN.md`;
3. a token holds the locked path `<file>` when:
   - it is `<file>`; for a folder (a name that ends with `/`), with or without its `/`;
   - for a locked folder, it is a path or a glob under it;
   - it is a folder written with its `/` that holds `<file>` («ideas/» holds `ideas/README.md`);
   - it is a glob that matches `<file>` («docs/*.yaml», «docs/**»).

So `tools/README.md` is one token and does not hold `README.md`, and `docs/program/public-v1/PLAN.md`
does not hold `PLAN.md`. ORCH lists the holders with this command (bash, from the root of Sai;
`<file>` is the locked path, for example `README.md` or `docs/issues/`):

```
for f in handoffs/*/*.json; do jq -r --arg p "<file>" '
def segs_to_tokens: reduce (split("/")[]) as $s ({out: [], cur: []}; .cur += [$s] | if ($s | test("^[A-Za-z0-9_*-]+[.][A-Za-z0-9*]+$")) then .out += [.cur | join("/")] | .cur = [] else . end) | if (.cur | length) > 0 then .out + [.cur | join("/")] else .out end;
def tokens: [scan("[A-Za-z0-9_./*-]+")] | map(sub("[.]+$"; "") | sub("^([.]/)+"; "")) | map(segs_to_tokens) | flatten | map(select(length > 0 and . != "/"));
def glob2re: "^" + (gsub("[.]"; "[.]") | gsub("[*][*]"; "\u0001") | gsub("[*]"; "[^/]*") | gsub("\u0001"; ".*")) + "/?$";
def covers($p): . as $t | ($p | endswith("/")) as $dir | ($p | rtrimstr("/")) as $q | if ($t | contains("*")) then ($p | test($t | glob2re)) or ($q | test($t | glob2re)) or ($dir and ($t | startswith($p))) else ($t == $p) or ($t == $q) or ($dir and ($t | startswith($p))) or (($t | endswith("/")) and ($p | startswith($t))) end;
select((.status == "PENDING" or .status == "IN_PROGRESS") and ([.context.write_set // []] | flatten | map(tostring) | any(tokens | any(covers($p))))) | .file' "$f" 2>/dev/null; done
```

→ empty. `[… // []] | flatten` reads a list and the string form of old handoffs alike.

**Measured against every real write-set item** (2026-11-18T04:33:54Z, the project's `handoffs/`,
read only). There are 1421 handoffs with 2192 write-set items, read against the 16 paths that the
locks of this section name. Those paths are `STATE.md`, `PLAN.md`, `README.md`, `CLAUDE.md`,
`docs/requirements.yaml`, `docs/issues/`, `decisions/README.md`, `docs/anti-patterns.md`,
`docs/product/`, `ideas/README.md`, `tools/handoffs/exceptions.tsv`,
`tools/test/handoffs-real.test.js`, `handoffs/WF06-20260926-01/`, `handoffs/ISS-0002-20260930-01/`,
`docs/program/public-v1/PROGRESS.md` and `docs/design/REQ-103-current-documents.md`. That gives
35072 (item, path) pairs. The token form and the substring form of pass 2 (`contains`) give:

| Both match | Neither | Substring only | Token only |
|---|---|---|---|
| 465 | 34493 | 83 | 31 |

The two forms differ in 114 pairs. Every one of them, with its reason:

| Kind | Locked path | The token in the item | Count | Handoffs (under `handoffs/`) |
|---|---|---|---|---|
| substring only: a longer path, another file | `README.md` | `tools/README.md` | 58 | DEMO070-20261027-01/step-05-backend-dev, E2E104-20261103-01/step-04b-code-fixer, E2E106-20261115-01/step-02-backend-dev, E2E106-20261115-01/step-10-doc-updater, E2E107-20261116-01/step-02-backend-dev, E2E107-20261116-01/step-10-doc-updater, ISS-0023-20261011-01/step-04-code-fixer, ISS-0031-20261011-01/step-04-code-fixer, ISS-0093-20261028-01/step-05-code-fixer, ISS-0093-20261028-01/step-05d-code-fixer, LANG061-20261020-01/step-03-backend-dev, LANG061-20261020-01/step-05-code-fixer, LANG061-20261020-01/step-12-doc-updater, LOOK069-20261026-01/step-09-backend-dev, PAGE057-20261021-01/step-02d-frontend-dev, PICKER054-20261019-01/step-02-backend-dev, PICKER055-20261019-01/step-02-backend-dev, PICKER055-20261019-01/step-10-doc-updater, PO-20260930-01/step-01-code-designer, PO-20260930-01/step-02-backend-dev, PO-20260930-01/step-02-frontend-dev, PO-20261002-01/step-02-frontend-dev, PO-20261005-02/step-02-backend-dev, PO-20261005-02/step-03f-code-fixer, PO-20261005-02/step-03g-code-fixer, PROD-20261006-01/step-05-backend-dev, PROD-20261006-01/step-11-backend-dev, PROD-20261006-01/step-15-code-fixer, PROD-20261006-01/step-27-doc-updater, PROD-20261006-01/step-47-doc-updater, PROD-20261006-02/step-22-backend-dev, PROD-20261006-02/step-23-backend-dev, PROD-20261006-02/step-26-backend-dev, PROD-20261006-02/step-28-backend-dev, PROD-20261006-02/step-31-backend-dev, PROD-20261010-01/step-05-backend-dev, PROD-20261010-01/step-12-test-designer, PROD-20261011-01/step-09-backend-dev, PROD-20261011-01/step-31-backend-dev, PROD-20261011-01/step-35-code-fixer, REQ038-20261011-01/step-02-backend-dev, REQ039-20261011-01/step-02-backend-dev, REQ042-20261013-01/step-02-frontend-dev, REQ042-20261013-01/step-04a-code-fixer, REQ044-20261014-01/step-02d-frontend-dev, REQ048-20261015-01/step-02e-frontend-dev, REQ048-20261015-01/step-10-doc-updater, REQ050-20261017-01/step-02b-frontend-dev, REQ050-20261017-01/step-02e-frontend-dev, REQ050-20261017-01/step-02f-frontend-dev, SA-20261001-01/step-2d-a-doc-updater, SA-20261001-01/step-2d-c-doc-updater-r1, SA-20261001-01/step-2d-c-doc-updater, SERVER056-20261020-01/step-02c-backend-dev, SERVER056-20261020-01/step-10-doc-updater, TEXT068-20261021-01/step-02a-backend-dev, TEXT068-20261021-01/step-04-code-fixer, TEXT068-20261021-01/step-08-doc-updater |
| substring only: a longer path, another file (the token form matches it for `decisions/README.md`) | `README.md` | `decisions/README.md` | 14 | CLEAN-20261006-01/step-01-doc-updater, ISS-0023-20261011-01/step-03-code-designer, ISS-0093-20261028-01/step-11-doc-updater, PAGE057-20261021-01/step-29-doc-updater, PO-20261005-01/step-10-doc-updater, PO-20261005-02/step-10-doc-updater, PROD-20261006-01/step-03-doc-updater, PROD-20261006-01/step-06-doc-updater, PROD-20261006-01/step-27-doc-updater, PROD-20261006-01/step-47-doc-updater, PROD-20261010-01/step-01-code-designer, REQ030-20261012-01/step-14-doc-updater, SA-20261001-01/step-2d-d-doc-updater-r1, SA-20261001-01/step-2d-d-doc-updater |
| substring only: a longer path, another file | `README.md` | `docs/business-plan/README.md` | 7 | BP-20261003-01/step-02-plan-writer-r1, -r2, -r3, -r4, -r5, -r6, BP-20261003-01/step-02-plan-writer |
| substring only: a longer path, another file | `README.md` | `tools/test/fixtures/team/README.md` | 2 | ISS-0023-20261011-01/step-06-test-designer, ISS-0031-20261011-01/step-06-test-designer |
| substring only: a longer path, another file | `README.md` | `docs/audits/README.md` | 1 | AUD-001-20261027-01/step-07a-doc-updater |
| substring only: a longer path, another file (the token form matches it for `ideas/README.md`) | `README.md` | `ideas/README.md` | 1 | SA-20261001-01/step-2d-a-doc-updater |
| token only: a folder that holds the file | `tools/test/handoffs-real.test.js` | `tools/test/` | 6 | ISS-0002-20260930-01/step-04-backend-dev, PO-20260930-01/step-02-backend-dev, PO-20260930-01/step-02-frontend-dev, PO-20261005-02/step-02b-frontend-dev, PO-20261005-02/step-05-test-designer, PO-20261006-01/step-02-frontend-dev |
| token only: the locked folder without its `/` | `docs/issues/` | `docs/issues` | 4 | DEMO070-20261027-01/step-20-doc-updater, DESIGN0083-20261026-01/step-09-doc-updater, LOOK069-20261026-01/step-19-doc-updater, PAGE057-20261021-01/step-29-doc-updater |
| token only: a folder that holds the file (the words «… in tools/» of the item; over the safe side) | `tools/handoffs/exceptions.tsv`, `tools/test/handoffs-real.test.js` | `tools/` | 3 + 3 | E2E105-20261105-01/step-02-backend-dev, step-04b-code-fixer, step-04e-code-fixer |
| token only: a glob that matches the file | `tools/test/handoffs-real.test.js` | `tools/test/*.js` | 3 | PAGE057-20261021-01/step-08-test-designer, TRANSL-20261025-01/step-06-test-fixer, TRANSL-20261025-01/step-08b-test-fixer |
| token only: a folder that holds the file | `decisions/README.md` | `decisions/` | 3 | REQ030-20261012-01/step-01-code-designer, REQ038-20261011-01/step-01-code-designer, REQ039-20261011-01/step-01-code-designer |
| token only: a glob that matches the file | `tools/test/handoffs-real.test.js` | `tools/test/handoffs-*.test.js` | 2 | REQ038-20261011-01/step-05-test-designer-r1, REQ038-20261011-01/step-05-test-designer |
| token only: a folder that holds the file | `docs/design/REQ-103-current-documents.md` | `docs/design/` | 2 | REQ048-20261015-01/step-01-gui-design-analyst, REQ048-20261015-01/step-01b-code-designer |
| token only: a folder that holds the file | `ideas/README.md` | `ideas/` | 2 | SA-20261001-01/step-2d-c-doc-updater-r1, SA-20261001-01/step-2d-c-doc-updater |
| token only: a folder that holds the folder | `handoffs/WF06-20260926-01/`, `handoffs/ISS-0002-20260930-01/` | `handoffs/` | 1 + 1 | PROD-20261009-01/step-10-backend-dev |
| token only: a glob that matches the file | `docs/design/REQ-103-current-documents.md` | `docs/design/*.md` | 1 | REQ048-20261015-01/step-02f-doc-updater |

So every pair that the substring form matched is still matched, or it names a longer path (another
file whose name ends with the locked one). No real item that names a locked file is missed. The 31
pairs that only the token form matches are real holders: a parent folder, a glob, or the locked
folder without its `/`. The two pass-2 items with a colon
(`handoffs/E2E-20261103-01/step-01-req-analyst.json`, `step-01b-req-analyst.json`,
«docs/requirements.yaml: …») are matched by both. The command of this section and the functions
the measurement used give the same answer on all 35072 pairs (the definitions were compared on
every pair: 0 differences).

**Invented items** (25, through the command itself, F34): the token form matches
«docs/requirements.yaml: …», «`STATE.md` (one line)», ««STATE.md» only», «only STATE.md.», both
names of «STATE.md/PLAN.md (…)», «./STATE.md», «README.md», «PLAN.md (the table only)»,
«STATE.md, PLAN.md and README.md», «docs/issues», «docs/issues/ISS-0092-node.md (closing)», «новые
docs/issues/ISS-0054-*.md …», «ideas/» for `ideas/README.md`, «docs/product/*.md» for
`docs/product/`, «docs/**» and «docs/*.yaml» for `docs/requirements.yaml`, «decisions/0009-*.md и
decisions/README.md» and «STATE.mdи PLAN.md». It does not match «tools/README.md (line 9 only)»,
«docs/program/public-v1/PLAN.md», «docs/issues-old/x.md», «STATE.md.bak», «docs/design/*.md» for
`docs/requirements.yaml` and «decisions/0009-*.md» for `decisions/README.md`. One over-match on the
safe side stays: a folder with an extension-like name before the file («docs/x.v2/PLAN.md» holds
`PLAN.md`).

**On the project at 2026-11-18T04:34:43Z** the command printed nothing for 14 of the 15 locked paths
it was given. For `docs/design/REQ-103-current-documents.md` it printed
`handoffs/M0DOCS-20261117-01/step-01g-code-designer.json` (this rework, IN_PROGRESS: a positive
control).

**What the precondition still cannot see** (named, not closed; FE-1, О41):

1. a holder that names the file by a word and not a path («the state file», «the top block»,
   «STATE» without `.md`), or a parent folder written without its `/` («docs» alone). A bare folder
   word is not read as a folder, so that common words like «tools» do not lock;
2. a misspelled path («State.md», «STATE.md» in another script of letters), or a glob of another
   form than `*` and `**` («{a,b}.md», «[A-Z]*.md»);
3. a writer that is not a `PENDING` or `IN_PROGRESS` handoff: a person, a process outside the
   protocol, a handoff whose status says it is done while its agent still writes;
4. a handoff whose task names the file but whose `write_set` does not. Only `write_set` is read.
   The protocol makes `write_set` the list of what a step may change (handoffs.md), and the
   bookkeeping checks hold it.

| Lock | Files | Holder | From | Until | The other runs meanwhile |
|---|---|---|---|---|---|
| L0 | `docs/requirements.yaml` | ORCH (S0, the status line of REQ-103) | the precondition holds (REQ108AMEND-20261118-01 and ISS-0092-20261117-01 do not hold the file) | ORCH's check of S0 (minutes) | prepare their edits and wait |
| L1 | `STATE.md`, `PLAN.md` | ORCH, then DOC-UPDATER | the precondition; ORCH refreshes PROGRESS «Next step (exact)» (О35) and measures `pre_state` | ORCH's check of S1 (minutes) | read only; a DOC-UPDATER of another run waits |
| L1b | `CLAUDE.md`, `README.md`, `docs/product/*.md`, `ideas/README.md` | DOC-UPDATER | S2 start (the precondition) | ORCH's check of S4 | no writes (none planned by them) |
| L2 | the two handoff folders, `tools/handoffs/exceptions.tsv`, `tools/test/handoffs-real.test.js`; and **no run of `npm test`, `npm run check` or `handoffs-real.test.js`** by any run (ISS-0092-20261117-01 runs the full check) | ORCH (S5a), then BACKEND-DEV (S5b) | before the first cancellation | `node --test test/handoffs-real.test.js` 4 of 4 after S5b (minutes; the test file runs in seconds) | `npm run handoffs-check` (exit 0 in this window) and `handoff close` are allowed |
| L3 | read-consistency of `STATE.md`, `PLAN.md`, `README.md`, `docs/requirements.yaml`, `docs/issues/`, `docs/program/public-v1/PROGRESS.md` | RELEASE-VALIDATOR | the start of its commands of criteria 2, 3, 5 and of PLANROWS and GATESEQ | their end (tens of minutes) | no writes to these files |
| L4 | `docs/requirements.yaml`, `STATE.md`, `PLAN.md`, `README.md`, `docs/issues/`, `decisions/README.md`, `docs/anti-patterns.md`, this design | DOC-UPDATER of step 10, then the steps of M0.13 (run M0REC) | the start of step 10, after ISS-0092-20261117-01 has passed its step 10 | the commit C of the records release M0.13 (`decisions/0117` О33) | no run writes these files; a writer inside M0.13 follows the rule of section 13 |
| — | `decisions/README.md` outside L4 | ORCH (decision records, number by `ls decisions \| sort \| tail -1`) | the write | its check | ORCH writes all decision records itself, one after another |

Between L1 and L4, another run may write `STATE.md` only by the rule of 5.5 and only when ORCH
gives it the file. The release of the run is the records release M0.13 (О14, О33), so the
archive's extra lines and the other runs' uncommitted records are committed together.

## 15. Criterion → check

The criteria are those of the amended block (`decisions/0117` О1–О29); «as written» is the
criterion's own command. The CD tests are those of section 16 (О10 accepted). RELEASE-VALIDATOR
does the reading parts itself: 1 (d), 2 (f), 4 (a), 7 and 8 (b) (О28, О29, О35).

| Criterion | Design element | Check | Tests | Mutants |
|---|---|---|---|---|
| 1 archive copies | 4.2–4.5; names О2 | as written: (a) the archives equal PH (blob, sha256, bytes, lines), (b) no `<` line against B, (c) the recorded lines at their places and the base without them, (d) each recorded line's run and handoff (mechanical) and RV's reading of the handoff, (e) two files, (f) one live record, the newest; after the release, `git rev-parse` | CD-1 | M01, M01o, M02, M03; the gate's V01–V05, V04 and V04c (section 18) |
| 2 (a) size | 5.1 | `wc -c < STATE.md` < 40000 (trial of step 1c: 17470) | CD-2 | M07 |
| 2 (b) anchors once | 5.1, 5.4 | as written | CD-2 | M04 |
| 2 (c) sections verbatim | 5.4 | as written against the archive, plus the byte tail `cmp` (О7) | CD-3, TM-01 (а) | M05, M06, M11, M11t, M34c |
| 2 (d) one screen, labels | 5.1, 5.2, 5.6 | as written; SHAPE (the line kinds and the empty line before `---`) at S1, S8b and by RV | CD-2 | M07, M08, M09; the gate's V09, V26 |
| 2 (e) counts | 5.3 | as written: the live COUNTS on one line with its time, not later than the check | — (time-dependent) | M10; the gate's V07, V08 |
| 2 (f) gates and next step | 5.3, 5.6 | RV reading; GATESEQ (both parts); the refresh S8b before step 9 | CD-2 (the durable part) | (reading); V09b, V09c |
| 2 (g) TM-01 (а) | 5.4 | `node --test test/team-docs.test.js` | TM-01 | M34 |
| 3 root PLAN.md | 6, 6.1 | as written (the three phrases, no «## Итерация», below 8000 bytes, the rows REQ-102 and REQ-103); PLANROWS parts (1)–(6) at S1 and by RV at step 9 (`decisions/0117` О31, О37) | CD-4 (parts (2), (3), (5) of PLANROWS) | M12, M12n, M13, M40; the gate's V10, V11, V28, V28b, V28f; V28c, V28e |
| 4 (a) section | E7.1 | as written + RV reading against PLAN §1 | CD-5 | M35 (M35t shows TM-01 (г) alone is not enough) |
| 4 (b) IDEA paragraph | E7.1 (untouched) | as written | REQ-003 AC3 | M14 |
| 4 (c) write list | E7.2 | as written | CD-5 | M15 |
| 4 (d) tests | — | `node --test test/team-docs.test.js test/repo.test.js` | TM-01 (г), REQ-003 AC3 | M16 |
| 5 (a) audit | R2, R7 | as written | CD-6 | M36 |
| 5 (b) counts | R3, R5 | as written: the live COUNTS once, and one «As of <time>,» line not later than the check | — | M18; the gate's V13 |
| 5 (c) defects | R6 | as written: the live D | — | M19; the gate's V15 |
| 5 (d) REQ-008 blocked | R4 | as written, with the exact sentence | CD-6 | M20; the gate's V14 |
| 5 (e) two sections | section 8 rule | as written | RD, TD, E2K-61 | M17, M37 |
| 5 (f) tests | — | `node --test test/repo.test.js test/traces-readme.test.js` | RD, TD | M17 |
| 5 (g) and R8–R11 | R1, R5, R8–R11 | as written (g); the four greps of section 8 | CD-6 | M39 |
| 6 (a) product | E9.1 | as written | CD-7 | M21, M22 |
| 6 (b) ideas line 9 | E9.2 | as written | CD-8 | M23, M24 |
| 7 handoffs | 10 | as written (`jq`, `diff`, `test -e`, `git diff --name-only`) | CD-9 | M25, M26, M26h, M27, M28, M38 |
| 8 base and HC-7c | 11 | as written: (a) the content of the base (the regex 0, each path 0, 110 records, handoffs-check «110 из 110»); (b) the source of HC-7c (each path named, R1 not named, `node --test` green) and RV's reading of the four assertions (literal paths, reached on every run, each with a message naming the path and the rule; О28, О29); (c) the probes on a fresh clone (each of tag rows 21, 117, 118, 119 at the top and at its sorted place: exit 1, the output names that path and H4 and no other record; 109 and 111 records: exit 1; the built file: exit 0 with an `ok … HC-7c` line) | HC-7a, HC-7c | M29, M30, M31, M32; the gate's V21–V24, V27; V22 = E11.2 without messages |
| 9 one check, no traces | all | `cd tools && npm run check` (TEST-RUNNER, RV), `npm run traces`, `npm run handoffs-check`, `node --test test/current-docs.test.js` | all, CD-1…CD-10 | M33, F17 (the other order) |

Every criterion has a row; every test and check named above serves a row.

## 16. Tests of step 5 (`decisions/0117` О10)

New file `tools/test/current-docs.test.js`, built by TEST-DESIGNER at step 5 (the block's «Files»).
Its tests read files only: no write, no process, no network. Each test checks only properties that
do not change with time:

| Id | Asserts |
|---|---|
| CD-1 | the two archive files exist, and their sha256 equal the constants pinned from `pre_state` (history never changes) |
| CD-2 | `STATE.md` below 40000 bytes; the first `---` at most at line 50 with an empty line before it; each anchor once; each marker once, start before end; the three labels once each above the line; SHAPE of 5.6 (the line kinds in their order, so no dated journal line and no other line in the block; `decisions/0117` О34); the durable part of GATESEQ (every gate line is exactly a row name of the PROGRESS table «Owner gates», so a journal line with a date only among the gate lines is red; О38, V09c) |
| CD-3 | the bytes of `STATE.md` from the owner heading to the end equal the same bytes of the archive copy |
| CD-4 | `PLAN.md` names `docs/program/public-v1/PLAN.md`, `PUBLIC-V1 milestone M<k>` and the Russian two-agent line; has no `## Итерация N` heading; below 8000 bytes; has the section «Requirements of the iteration», with the rows REQ-102 and REQ-103, and every `\| REQ-NNN ` row of it names a block of `docs/requirements.yaml` whose status line is not `cancelled`, and its Run is the run of the earliest passing REQ-VALIDATOR handoff of that REQ (PLANROWS parts (2), (3), (5); `decisions/0117` О31, О36, О37) |
| CD-5 | `CLAUDE.md`: the section «What we are building» names `docs/program/public-v1/PLAN.md`, `PUBLIC-V1`, «virtual team»; the write list names `docs/program/public-v1/**` and `docs/owner-requests/` and holds «append» |
| CD-6 | `README.md`: none of «No health audit yet», «will appear with the first audit», «in the order of `PLAN.md`», «goal templates», nor the four phrases of R8–R11 (section 8); names AUD-001 and `docs/audits/README.md`; exactly one line with REQ-008, and it says «blocked» |
| CD-7 | every file of `docs/product/` (a pass over the folder, not a list) begins with the snapshot line |
| CD-8 | `ideas/README.md` line 9: no «Выбрана», names `decisions/0033`, three cells |
| CD-9 | the four handoffs: `CANCELLED`; `orch_cancellation` with `by`, a strict `at`, and a `reason` longer than 20 characters whose named paths all exist |
| CD-10 | the rules are not blind: each of CD-2…CD-9 is red on an in-memory damaged copy (the shapes of M04, M07, M08, M09, M11t, M12, M21, M22, M24, M25, M26, M38 and of the gate's V09, V09c, V26, a cancelled row in the PLAN table and a row whose Run is not the run of the first gate), as RD's «not blind» test does |

## 17. Quality bar

| Item | Applicable? | How |
|---|---|---|
| Q1 | yes | every change is REQ-103; every criterion of the amended block names its command (section 15); the requirements table of the root PLAN.md (F3 of step 02) has criterion 3 and PLANROWS |
| Q2 | yes | the builder (DOC-UPDATER, BACKEND-DEV, ORCH for the cancellations) does not check its own work: CODE-DESIGN-VALIDATOR repeats the facts on a fresh clone of B; RV re-runs every criterion and does the reading parts of 1 (d), 2 (f), 4 (a), 7 and 8 (b) itself (О35); ORCH's `pre_state` is independent of the builder's copy |
| Q3 | yes | every statement about the current files has a command and an output (section 2, 2026-11-17); the trial outputs are in section 21 |
| Q4 | yes | criterion 9: `cd tools && npm run check` on a clean copy by TEST-RUNNER and RV |
| Q5 | yes | section 15; the CD tests make the properties permanent; a failure path (S1) leaves the file as it was (4.5) |
| Q6 | yes | no test is skipped or removed; HC-7c becomes stricter and names the path and the rule in its message; the four deleted exception rows have no violation left (F18); the code-form greps of criterion 8 are replaced by its three direct parts (the content of the base, the source of HC-7c with RV's reading, the behaviour by probes; `decisions/0117` О25) |
| Q7 | yes | no secret in any new text; `npm run traces` → 0 with the archive present (untracked files are read, F9); the cancellation reasons hold no machine path |
| Q8 | not applicable | documents and bookkeeping only; no customer data and no business space |
| Q9 | not applicable | no query |
| Q10 | not applicable | no external call and no network input; the failure paths of the write steps are in 4.5 and section 13 |
| Q11 | not applicable | no address is called |
| Q12 | yes | the disputable choices were О1–О16 with defaults; ORCH recorded the answers and the later points О17–О35 in `decisions/0117-m0docs-conventions.md`, and this design follows them (section 22); it keeps decisions/0080 item 7 (the Russian anchors), 0091 items 6 and 8 |
| Q13 | yes | process errors found: the tag set against the recorded ruling (F5), a criterion's base value made false by a later commit (F12), a reading window that an unrelated line satisfies (M20), my own shell slips (section 21); DOC-UPDATER records them at step 10 (AP-164 onwards) |
| Q14 | yes | the status, `STATE.md`, `PLAN.md` and the design («As built», AP-143) are updated in this run at step 10; the counts are refreshed with their command (О4) |
| R1 | yes | the merge is the push to `main` by RELEASE-FINALIZER after RV PASS (decisions/0079), together with M0.13 |
| R2 | yes | no Pixel Office event is written or edited; no step starts Pixel Office, the team server or the real `claude` |
| R3 | not applicable | decision 0033 |

## 18. Mutants

Step 1: 38 mutants (M01–M38), 46 runs (some mutants are run against two checks), on the trial of
step 1 with `mutants.sh` (section 21); the checks there are the criteria as first written and
the design's proposals, which the amended block now holds. Step 1c: the gate's mutants V04, V09,
V10, V26 (and the control V04c, the variant V09b, the form V22) and two new ones (M39, M40) on the
trial of step 1c, against the amended criteria (`crit-amended.sh`, 108 mechanical parts) and the
design's checks (`dchecks.sh`: SHAPE, GATESEQ, PLANROWS, the README greps). Every file was put back
by `cp` and confirmed by `cmp`; after the last run the criteria and the checks were clean again.
«Green under» means that a check as written misses the mutant.

| Id | Breakage | Check | Result |
|---|---|---|---|
| M01 | archive = B (the line after the tag lost) | О1 (a) | red; **green under criterion 1 as written** (M01o), and the correct archive is red under it |
| M02 | one line of B dropped from the archive | О1 (b) | red |
| M03 | the final `\n` of the archive removed | О1 (a) | red |
| M04 | the anchor «… — по порядку» with a hyphen | 2 (b) | red |
| M05 | one word inside the WF-06 section | 2 (c) | red |
| M06 | the end marker dropped | 2 (c) | red |
| M07 | 34 lines more before the line (`---` at 51) | 2 (d) | red |
| M08 | no empty line before `---` (a setext heading) | CD-2 rule | red; **green under 2 (d) as written** (M08d) |
| M09 | a second `**State:**` line | 2 (d) | red |
| M10 | one count changed | 2 (e) | red |
| M11 | the final `\n` of the new STATE.md removed | 2 (c) as written | **green**; the byte tail `cmp` (M11t, О7) red |
| M12 | the old PLAN.md kept below a new head | criterion 3 as written | **green**; О5 (M12n) red |
| M13 | «не более двух агентов» | 3 | red |
| M14 | the IDEA paragraph re-wrapped | 4 (b) | red |
| M15 | the two new items placed after «## Workflows» | 4 (c) | red |
| M16 | «no product code» in the new text | TM-01 (г) | red |
| M17 | the heading «## Check on GitHub and before a push» written again | RD (repo.test.js) | red |
| M18 | the counts wrapped over two lines | 5 (b) | red |
| M19 | «Open defects: 970» | 5 (c) | red |
| M20 | «blocked» moved off the REQ-008 line | 5 (d) | red with the design text (one REQ-008); with a second REQ-008 before the counts line it was **green** (the first trial text) |
| M21 | the snapshot line without the last `/` | 6 (a) | red |
| M22 | an empty line after the snapshot line | 6 (a) | red |
| M23 | «Выбрана» kept in the cell | 6 (b) | red |
| M24 | a `\|` in the cell | 6 (b) | red |
| M25 | `result.status` of the ISS-0002 handoff changed | 7 (`diff`) | red |
| M26 | `orch_cancellation` without `by` | 7 (`jq`) | red; `handoffs-check` **green** (M26h, F20) |
| M27 | `at` with milliseconds | 7 | red |
| M28 | a fifth file of the folder touched | 7 (`git diff --name-only`) | red |
| M29 | three rows deleted, row 21 kept | HC-7a | red |
| M30 | line 116 deleted in place of 117 | handoffs-check, HC-7a | red, red |
| M31 | `110` but the old `has(step-10, H4)` kept | HC-7c | red |
| M32 | one of the four `!has` removed | HC-7c | **green**; under the amended criterion 8 red by (b) (the path of step-12 is no longer named) and by (c) (the probes of tag row 119 exit 0); the gate's V23 (a loop over three names) is the same shape, red under (b) and (c) |
| M33 | a home-folder path in the block | `npm run traces` | red |
| M34 | the owner's date 2026-10-06 → 07 in the tail | TM-01 (а); 2 (c) (M34c) | red, red |
| M35 | «virtual team» removed from the new section | 4 (a) | red; TM-01 (г) **green** (M35t) |
| M36 | «No health audit yet» left beside the new bullet | 5 (a) | red |
| M37 | one word in «Check on GitHub and before a push» | 5 (e) | red |
| M38 | a reason that names a non-existing decision file | 7 (`test -e`) | red |

Step 1c, on the built trial of step 1c (2026-11-17T20:40:23Z–20:43:25Z; M39, M40 at about 20:55Z):

| Id | Breakage | Amended criteria | Design checks |
|---|---|---|---|
| V04 | a newer record `step-02-doc-updater-run2.json` (a later `pre_state.at`), the older not superseded | **red**: 1 (f) PH prints two paths; 1 (f) the other record names no record | — |
| V04c | the same, and the older record gets the `orch_correction` «superseded by handoffs/M0DOCS-20261117-01/step-02-doc-updater-run2.json …» of 4.3 | green (as designed) | `handoffs-check` «нарушений 0 … 110 из 110» |
| V09 | a dated journal line `- **2026-11-18T10:00:00Z — a run X done (a journal line).**` after the defects line | green (the gap of FC-7) | **red**: SHAPE `HEPESERD` `X` `EGE…` |
| V09b | the same line among the gate lines | green | **red**: SHAPE (an `X`) and GATESEQ |
| V10 | the PLAN table without the REQ-108 row | green (the gap of FC-2) | **red**: PLANROWS «missing: REQ-108» |
| V26 | no empty line before `---` | green | **red**: SHAPE ends `…ENET`; «empty line before ---» at line 34 |
| V22 | E11.2 without messages (four literal calls, formatted) | **red**: 8 (c), 4 probe failures (tag row 21 at the top and sorted: neither the path nor H4 in the output) | — |
| M39 | R9 not applied (README line 184 still names `STATE.md`) | green | **red**: the README grep of R9 |
| M40 | a row of a cancelled requirement (REQ-020) added to the PLAN table | green | **red**: PLANROWS part (2) «bad: REQ-020» |

Step 1e, on the trial of step 1e (the trial of step 1c with ORCH's four form rows appended to its
PROGRESS.md, emulated; 2026-11-17T21:26:17Z–21:26:50Z for the V28 cases, 21:30:28Z–21:35:02Z for the
earlier series). Old rule = the commands of step 1c (`bin2/`), new rule = this design (`bin3/`):

| Id | Breakage | Old rule (step 1c) | New rule (step 1e) |
|---|---|---|---|
| V28 | the gate's build row of REQ-103 appended to the PROGRESS table | **red**: S1 would build no REQ-103 row (criterion 3) | green |
| V28b | the gate's micro-amendment row of REQ-103 (Run REQ103AMEND-20261117-01) appended | **red**: S1 would build Run REQ103AMEND-20261117-01, red under PLANROWS (1), (4), (5) | green |
| V28c | an amendment row written in the gate form (against ORCH's own form) appended | **red**: Run REQ103AMEND-20261117-01 | green: the first form row wins |
| V28e | the same form row inserted above every row | — | **red**: PLANROWS (1), (4) on the built table; (5) on a table built from it |
| V09c | the gate's journal line with a date only among the gate lines | SHAPE green | **red**: GATESEQ equal and durable (CD-2) |

The earlier series, run again on the trial of step 1e with the checks of step 1e
(`bin3/mutants-step1.sh`, `bin3/gmut-b3.sh`): M01–M38 and M08d give the same results as in step 1.
M32 and M32g name the single-line `!has` of the step-1 text, which E11.2 no longer has, so their
change did not apply. M32 on the E11.2 form was measured in step 1c (red under 8 (b) and (c)). V04,
V04c, V09, V09b, V10, V26 give the same results as in step 1c (V09b and V10 now also red under
GATESEQ durable and PLANROWS (6)). M39 is red under the R9 grep, as in step 1c. M40 is red under
PLANROWS (2), and now also under (4) and (5) (21:35:28Z). After every run the criteria (108 of 108)
and the checks were clean again.

Step 1g, on the trial of step 1g (a fresh clone of the tag with today's working files: 110
requirements, PROGRESS.md with ORCH's four form rows; built 2026-11-18T04:37:31Z):

| Id | Breakage | Before (step 1e) | Step 1g |
|---|---|---|---|
| V28f | the gate's REQ-104 back to `pending` (a requirement outside the program) | **red**: PLANROWS (6) «missing: REQ-104» on a correct table | green: REQ-104 has no row in the P-code table |
| V10 | the REQ-108 row dropped from the PLAN table | red | red: PLANROWS (1) and (6) |
| FE-1 items | the two real colon items, a path in backticks, in «», with a final period, the pair | the regex of step 1e: not matched | matched (section 14) |

The earlier series, run again on this trial with the checks of step 1g (`bin4/`; background job
2026-11-18T04:39:19Z–04:44:32Z, read to its end line «BATCH END»): the step-1 series M01–M38 and M08d give the same results as on the trial of step 1e (`diff` of the two outputs: empty; M32 and M32g do not apply, as there); V04 (red 1 (f)), V04c (green), V09, V09b, V10, V26 (red under the design checks) as in step 1c; V28, V28b, V28c red under the old rule and green under the new, V28e red, V09c red, as in step 1e; M39 and M40 red, as in step 1e. The built `tools/handoffs/exceptions.tsv` and `tools/test/handoffs-real.test.js` are the same bytes as the files probed for criterion 8 (c) in step 1c (sha256 `01e96e1614b9…`, `ca247aeb3790…`), so those probes stand. After every run the criteria (108 of 108) and the checks were clean again.

Not applied on purpose: none of the mutants writes outside the trial clone. No mutant starts a
program of the project other than the node test runner on the trial's own files.

## 19. What becomes outdated outside this run's files (for DOC-UPDATER and ORCH)

1. `docs/program/public-v1/PLAN.md` M0.10 and AC0.7 name `docs/archive/*-until-2026-10-27.md` and
   the comparison with the tag. The plan is not edited (0091 item 8): ORCH has added the dated row
   to «Plan amendments» of PROGRESS.md (2026-11-17T18:40:21Z, `decisions/0117` О18).
2. `docs/program/public-v1/KICKOFF.md` line 62 («1 164 lines until M0.10 shortens it») and PLAN §0.3
   («after it, the top block up to the first `---`») match the design. Only the count in
   KICKOFF.md is old (ORCH's file).
3. `.claude/agents/doc-updater.md` item 4 describes `STATE.md` as «the session handover»; the rule of
   5.5 and its check SHAPE (5.6) are not there (О13, О34).
4. `.claude/agents/audit-scout.md:47` and `docs/workflows/WF-05-health-audit.md:86` cite «`PLAN.md`, step
   2f». After S1 that step is in the archive (О15).
5. `CLAUDE.md` «Rules of this folder» (line 87: product code in `tools/src/team/`) and
   `docs/quality-bar.md` Q4 («number 0001 …, not yet accepted») contradict `decisions/0001` (accepted)
   (О15).
6. The REQ-103 block itself (amended by the run REQ103AMEND-20261117-01), and the status of the AUD-001
   findings DOC-03…DOC-08, DOC-10, DOC-11, which this run closes. Their `defect` field stays null
   for Medium and Low, so nothing is edited; the release report names them.
7. The README counts become old after the next run (residual; the planned REQ-040 at M7 replaces
   the hand count, F2 of step 02).
8. ISS-0108: the trial confirmed it again (F28). DOC-UPDATER may append the observation.
9. After the push, the public repository (decisions/0111) shows the new `STATE.md` and `README.md`;
   traces are 0.

## 20. Open questions for ORCH (step 1a), with defaults

Status at step 1c: answered. `decisions/0117` accepted О1–О16 as their defaults, and the run
REQ103AMEND-20261117-01 carried О1–О7 and О9–О11 into the block. Later points changed four of them:
О6 is superseded by О25 (criterion 8 has three direct parts, not swap probes); the table rows of
О5 are set by О17, О22 and О31; О10's test is built at step 5 by TEST-DESIGNER (О10, О31, О34); and
О14 is set by О33 (one records release M0.13, L4 until its commit). The list below is kept as the
record of step 1.

Each default is what the design assumes. The micro-amendment of REQ-103 (WF-01, «Micro-amendment
after the code design») carries the accepted ones; no criterion is weakened.

- **О1 — the base of criterion 1.** Default: the archive is a byte copy of the replaced file P,
  recorded by ORCH in `context.pre_state` of the S1 handoff (4.3). Criterion 1 becomes:
  «(a) `git hash-object docs/archive/STATE-until-M0DOCS-20261117-01.md` equals
  `pre_state.files[0].git_blob` of the S1 handoff, and the same for the PLAN copy;
  (b) `diff <(git show "${B}:STATE.md") docs/archive/STATE-until-M0DOCS-20261117-01.md | grep -c '^<'`
  → 0, the same for PLAN.md; (c) the `>` lines of that diff are exactly
  `pre_state.files[].added_after_tag[].text`, and RV reads the named handoff of each;
  (d) `ls docs/archive/*-until-M0DOCS-20261117-01.md | wc -l` → 2; on the base the folder does not
  exist». The description's sentence «move unchanged to docs/archive/» stays. Alternative: keep
  B (and lose the line of F3), or re-tag on a records release (4.6).
- **О2 — the names.** Default: `docs/archive/STATE-until-M0DOCS-20261117-01.md` and
  `docs/archive/PLAN-until-M0DOCS-20261117-01.md`. They hold the journals up to this run, and a date
  name would be false if S1 moves to another day. Alternative: `…-until-<UTC date of S1>.md`, with
  the date written by ORCH into the criterion at L1.
- **О3 — stale literals of the description.** Default: «STATE.md (385895 bytes)» → «(474071 bytes
  at the base tag, `git show "$B:STATE.md" | wc -c`)»; «PLAN.md (105670 bytes)» → «(127572 bytes)»;
  2 (a) «(the base file has 385895)» → «474071»; row (5) «lines 1205–1260» → «1205–1296»; row (1)
  «an unused row is a violation (исключение не использовано)» → «an unused row is printed as
  «исключение не использовано»; `handoffs-check` stays at code 0, and HC-7a turns red (K < L)» (F1 of
  step 02); row (2) «HC-7c is the one test that turns red until this edit is made» → «after the four
  cancellations alone HC-7a is red; after the row deletion alone HC-7c is red» (F16, F18); a new row
  for E2K-61 (section 12, row 11).
- **О4 — the counts (F2 of step 02).** Default: COUNTS and D in criteria 2 (e), 5 (b), 5 (c) are
  read from the working files at the moment of the check: the same awk on `docs/requirements.yaml`,
  and the same D pipeline over `ls docs/issues/`. RV checks them at step 9 under L3. DOC-UPDATER
  rewrites the lines at step 10 after REQ-103 is `done`, and ORCH's check of step 10 runs the same
  commands, which answers how AC0.5 is met. The lines carry the time of the reading (5.2, R3).
  Alternative: keep B: deterministic, but the block says 107 on the day the file says 109.
- **О5 — criterion 3 is met at the base (F12) and F3 of step 02.** Default: «(the base: 0)» → «(the
  base: 1)», and add: `grep -c -E '^## Итерация [0-9]' PLAN.md` → 0 (the base: 9);
  `wc -c < PLAN.md` → below 8000 (the base: 127572); and
  `awk '/^## Requirements of the iteration/{f=1;next} f&&/^## /{exit} f' PLAN.md | grep -c -E '^\| REQ-10[23] '`
  → 2. Rows that come later are ORCH's own step (WF-01 step 3) outside the run.
- **О6 — the code-form pins of criterion 8 (F4 of step 02).** Default: replace the three greps of the
  test text (`assert.equal(rows.length,110)`, `assert.ok(has("…step-10-orch.json"`, the count of
  `!has(`) with probes on a fresh clone of the build: (i) for each of tag lines 21, 117, 118, 119 of
  `git show "${B}:tools/handoffs/exceptions.tsv"`, a copy of the built file whose first record is
  replaced by that line makes `cd tools && node --test --test-name-pattern HC-7c test/handoffs-real.test.js`
  exit 1; (ii) a copy with one record removed (109) makes it exit 1; (iii) the built file → exit 0.
  Measured: the literal form and a loop form pass (i)–(iii). A loop that drops one name fails (i)
  for its row. The literal grep gives 0 on the correct loop form. Keep the other parts of
  criterion 8 as written.
- **О7 — tightenings found by the mutants.** Default: 2 (c) compares the sections with the archive
  copy (= the replaced file) and adds the byte tail `cmp` of 5.4/M11t; 5 (d) adds
  `grep -c -E 'REQ-008\) are .?blocked' README.md` → 1 (M20); the empty line before `---` stays a
  design rule and a CD-2 check. Alternative: no change of the criteria, design rules only.
- **О8 — languages.** Default: the new block of `STATE.md` and the new `PLAN.md` are in English
  (decisions/0080's reason; the labels the criteria read are English). The literals that code or
  criteria read stay Russian: the three headings, «Одновременно работают не больше двух агентов»,
  «Серьёзность», «Статус». The `ideas/README.md` cell is Russian like its table. Alternative: the
  Russian text with the English labels.
- **О9 — two README sentences that the run makes or finds false.** Default: edit R1 («in the order of
  `PLAN.md`», false once PLAN.md is replaced) and the «Still pending, for example …» sentence of R5
  (goal templates is `cancelled`) in this run (AP-133). Add checks: a fixed-string count of the
  text «in the order of» followed by a backtick, `PLAN.md` and a backtick in `README.md` → 0, and
  `grep -c -F 'goal templates' README.md` → 0. Alternative: leave them and open a Low defect.
- **О10 — a permanent guard test.** Default: yes, TEST-DESIGNER adds `tools/test/current-docs.test.js`
  (section 16, CD-1…CD-10), named in the block's «Files». The time-dependent checks stay RV's commands.
  Alternative: no new file; the criteria commands are run by TEST-RUNNER and RV only.
- **О11 — the time lines before step 9 (criterion 2 (f)).** Default: if a source changed after S1
  (a gate answer, «Next step (exact)», the counts, the defects), DOC-UPDATER refreshes exactly the
  time lines of the block and R3, R5, R6 in a short step 08b before step 9. Its `diff` shows only
  those lines, and RV checks under L3. «Next step» is the verbatim text of «Next step (exact)», which
  ORCH keeps current, and RV reads it against the plan order and the Log. Alternative: RV accepts
  the block as of its own time stamp (not checkable: PROGRESS.md is not in git between releases).
- **О12 — the tag against the ruling (F5).** Default: keep `base/M0DOCS-20261117-01` on `6c756cd`.
  О1 makes the archive lossless, and moving the tag after step 1 would change «before» for the
  design gate. DOC-UPDATER records the process error at step 10.
- **О13 — the writers of STATE.md after S1.** Default: the sentence of 5.5 goes into every task
  that writes `STATE.md` until `.claude/agents/doc-updater.md` carries it. That edit is a protected
  path (`.claude/**`) and goes through a later WF-02 FULL run (a Low defect now).
- **О14 — the release.** Default: the run is released together with M0.13 (the route of this
  handoff), so `docs/requirements.yaml`, `STATE.md` and the other runs' uncommitted records go in one
  release. If ORCH releases M0DOCS alone, the commit by name would carry other runs' lines in
  `docs/requirements.yaml` and the archive. Then ORCH decides which.
- **О15 — out-of-scope stale statements (section 19 items 3–5).** Default: not edited in this run.
  ORCH opens one Low defect (the number by `ls docs/issues | sort | tail -1`) for CLAUDE.md «Rules of
  this folder» and quality-bar Q4 against decisions/0001, the two «`PLAN.md`, step 2f» references,
  and doc-updater.md item 4.
- **О16 — the cancellation reasons.** Default: the two texts of section 10. ORCH may shorten them,
  but each keeps more than 20 characters and at least one existing path.

Proposed record: `decisions/NNNN-m0docs-conventions.md` (next free number at the time, 0117 today)
with the answers to О1–О16 and «Основание»: this design and the M0BACKLOG step 02 findings F1–F5.

## 21. Trial sketch

Where: `<outside the project>/m0docs-01/` (the session folder; not part of Sai).

- `clone/` — a fresh `git clone -b base/M0DOCS-20261117-01`, `npm ci` in `tools/`. The working
  `STATE.md`, `PLAN.md` and `docs/requirements.yaml` were copied in (read from Sai only), to stand
  for the lines written after the tag. Then S1–S5b were built as designed.
- `clone2/` — a second fresh clone of the tag for the reversed order of S5 (F17).
- `pre/` — the two pre-state copies (sha256 `728cb4ea…`, `e85251b0…`).
- `crit.sh` — every criterion command as written, plus the pre-state comparisons (bash).
- `mutants.sh` — the 38 mutants of step 1; `probe.sh` — the swap probes of step 1 (О6, superseded by О25); `place-trial.mjs` — F22.
- `cancel.py`, `claude-edit.py`, `readme-edit.py` — the text edits of sections 7, 8 and 10.

Slips during the trial, all seen and redone at once: `echo ======` in zsh failed («===== not
found», AP-156 item 2). The first probe run was written in zsh with `"$B:tools/…"`, read as a
modifier (AP-147): all four probes were red for the wrong reason, so the run was thrown away and
done again in bash with `${B}` (the step-1 outputs of section 18 and of О6 are from the bash run). The
apply, snapshot and cli tests left 96 folders in the system temp folder (F28, ISS-0108). They were
not deleted, because folders of parallel runs could carry the same names.

The trial of step 1c, in the same folder:

- `trial2/` — a fresh `git clone -b base/M0DOCS-20261117-01` with `npm ci`; today's working
  `STATE.md`, `PLAN.md`, `docs/requirements.yaml` (with the amended block) and
  `docs/program/public-v1/PROGRESS.md` copied in (read from Sai only, 2026-11-17T20:35:42Z;
  copies in `pre2/`), and the two writer handoffs (`handoffs/M0BACKLOG-20261028-01/step-04-doc-updater.json`,
  `handoffs/M1SITE-20261117-01/*.json`). The S1 handoff was made by `handoff new`, and the
  ORCH record was emulated by `orch-s1.py` (difflib against the tag; 2026-11-17T20:35:59Z). Then S1
  (`bin2/s1.py`, the block and the PLAN text from the commands), S2–S4 (`bin2/s2s4.py`), S5a
  (`cancel.py`, at 2026-11-17T20:38:09Z) and S5b (`bin2/s5b.py`) were built as this design says.
- `probe2/` — a fresh clone of the tag for the probes of criterion 8 (c).
- `bin2/derive.sh` — the commands of 5.3 and 6.1; `bin2/dchecks.sh` — SHAPE, GATESEQ, PLANROWS
  and the README greps; `bin2/crit-amended.sh` and `bin2/probe-8c.sh` — the amended criteria 1–8
  and the probes of 8 (c), copies of the gate's scripts typed from the block (read against the
  block before use); `bin2/gmut.sh` — V04, V04c, V09, V09b, V10, V26.
- The node tests ran with `TMPDIR` in the session folder, which was emptied after each run, so
  nothing went to the system temporary folder in step 1c.

At step 1e, the same `trial2/` got two more changes. ORCH's four form rows of 6.1 were appended
to its PROGRESS.md (`bin3/add-rows.py`, emulated), and the handoff folders of REQ103AMEND-20261117-01
and REQ108AMEND-20261118-01 were copied in, so that FIRSTGATE sees their later gates. The scripts of
step 1e are in `bin3/`:

- `derive.sh` — PROGREQ, PLANROWS, FIRSTGATE and GATEROWS of the new rule;
- `dchecks.sh` — SHAPE, both parts of GATESEQ, PLANROWS (1)–(6) and the README greps;
- `gmut3.sh`, `v28b-old.sh` — V28, V28b, V28c, V28e, V09c under both rules;
- `fd4.sh` — the lock precondition on invented handoffs;
- `staged.sh`, `staged-trial.sh` — STAGED, with `git add` on the trial's index only;
- `mutants-step1.sh`, `gmut-b3.sh` — the earlier series against the checks of step 1e.

The long command texts were written to files, not to shell here-documents.

At step 1g, a fresh trial `trial3/` was built from a fresh clone of the tag (`bin4/build3.sh`).
Today's working `STATE.md`, `PLAN.md`, `docs/requirements.yaml` (110 requirements) and
PROGRESS.md (with ORCH's four form rows) were copied in, read from Sai only, at
2026-11-18T04:37:29Z (copies in `pre3/`). So were the handoff folders M0BACKLOG-20261028-01,
M1SITE-20261117-01, REQ103AMEND-20261117-01, REQ108AMEND-20261118-01 and ISS-0092-20261117-01.
Then came the emulated ORCH record, S1–S5b and the checks. The scripts of step 1g are in `bin4/`:

- `lockpre.sh` — the command of section 14, exactly as written;
- `lockmatch2.jq` and `measure2.sh` — the same functions, applied to every write-set item of
  `handoffs/` with both forms;
- `classify.py`, `why.sh`, `difflist.py` — the reasons of the differences;
- `same-code.py` — the command and the functions agree on all 35072 pairs;
- `samples2.sh` — the 25 invented items, through `lockpre.sh`;
- `derive.sh`, `dchecks.sh` (check (6) limited) and `planrows-checks.sh` (the commands of 6.1,
  as written);
- `v28f.sh`, and the earlier series again: `mutants-step1.sh`, `gmut-b4.sh`, `gmut4.sh`,
  `m39m40.sh`.

The long command texts were written to files.

## 22. Closed in the rework of step 01c

The rework covers only the findings of `handoffs/M0DOCS-20261117-01/step-01b-code-design-validator.json`,
the amended block and `decisions/0117` О17–О35 (AP-019).

| Finding / point | Where in this design | What changed |
|---|---|---|
| FC-1 (О21, О24, О25, О28–О30) | 3 (row of the test file), 11 (E11.2), 13 (S5b), 15 (row 8), 17 (Q6), 18 (M32, V22), F31 | E11.2 names the message on each of the four assertions (the path and the rule) in a table; BACKEND-DEV builds it at S5b; the checks after S5b are criterion 8 (a), (b), (c) and RV's reading of (b); the О6 probes are gone. Measured: the form with messages passes (c) with 0 failures, the form without fails it with 4 (V22) |
| FC-2 (О17, О22, О31) | 4.4 step 4, 6 (the PLAN text with `<PLANROWS>`), 6.1 (new: the rule, PROGREQ, PLANROWS, the check), 13, 15 (row 3), 16 (CD-4), F29 | the rows come from the PROGRESS table at the build (today REQ-102, REQ-103, REQ-108, REQ-109), with the run of their WF-01 gate; part (1) of PLANROWS is checked at S1 and by RV, parts (2), (3) by CD-4. The gate's V10 is red under part (1) |
| FC-3 (О18, О20, О26, О32) | 4.1, 4.3 (the `handoff` rule with the orch_check case, today's PLAN.md line 398, the «superseded by» correction at every re-measure and `-runN` carry), 4.4 (PH; step 5 checks the amended criterion 3), 4.5 (row 1), 4.6, F3b | the record follows the amended criterion 1; on the trial its (a)–(f) pass; the gate's V04 is red, and V04c (the same with the correction) is green |
| FC-4 (О33) | 13 (step 10, the new row M0.13, the paragraph on the protected sequence), 14 (the runs of today, the precondition of every lock, L0, L4 until the commit C), F30 | ISS-0092-20261117-01 passes its step 10 first; this run's step 10 sets REQ-103 done, then reads the counts; L4 holds every source and every file of the count lines until C; RELEASE-FINALIZER compares the lines with the commands on the committed tree right before C |
| FC-5 (О34) | 8 (R8–R11 and their greps), 13 (S4), 15 (row 5 (g)), 16 (CD-6), 3 (README row) | the four README places that pointed into the old STATE.md content get an edit each; M39 is red under the grep of R9 |
| FC-6 (О34) | 12 (rows 5, 8, 9, 12, 13), F32 | REQ-003 AC3 ends at line 113; HC-10a starts at line 124; the other readers the gate found are named |
| FC-7 (О34) | 5.1, 5.5, 5.6 (new: SHAPE and GATESEQ), 16 (CD-2, CD-10) | rule 5.5 is mechanical: the line kinds of the block in their order, the empty line before `---`; V09, V09b and V26 are red under SHAPE |
| FC-8 (О34) | 5.3 (SEV), F11 | the severity word is taken without its punctuation; the six forms are measured |
| О35 | 3, 4.3, 5.3, 10, 13 (S0, step 9), 15 (intro), 17 (Q2) | REQ-103 moves to `in_progress` when the build starts; ORCH refreshes «Next step (exact)» before L1; RELEASE-VALIDATOR does the reading parts of 1 (d), 7 and 8 (b) (and 2 (f), 4 (a)) itself |
| the amended block (О17–О29) | 0, 1, 2 (F3b, F4), 15 (all rows now name the block's checks), 19 (items 1, 3, 6), 20 (status), 21 (trial2) | the references to the criteria «as first written» are kept only where they explain a finding (4.1, 18) |

Kept as they were: sections 7, 9 (texts), 10 (the edit and the reasons), the guard rows of
section 12 other than 5, 8, 9, 12, 13, the step-1 mutants M01–M38, and the list of section 20.

## 23. Closed in the rework of step 01e

The rework covers only the findings of `handoffs/M0DOCS-20261117-01/step-01d-code-design-validator.json`
(FD-1 Medium; FD-2, FD-3, FD-4 Low) and `decisions/0117` О37–О39 (AP-019). This is the material for
the last gate pass (О39).

| Finding / point | Where in this design | What changed |
|---|---|---|
| FD-1 (О36, О37) | 6.1 (the form ORCH keeps, the four form rows of today, the rule, PROGREQ, PLANROWS, FIRSTGATE, the checks (1)–(6), the measured table), 13 (row S1: ORCH appends the form rows), 15 (row 3), 16 (CD-4 part (5)), 18, F33 | the rule reads the FIRST row whose Status cell begins with `gate PASS: `, takes the P-code, the Run and the gate handoff from it, and counts the gate as passed if any such row exists; later rows never change them. Checks (4)–(6) tie the rows to the handoffs. V28 and V28b are red under the old rule and green under the new; V28c (a later form row) is green; V28e (a forged row inserted above) is red under (1), (4), (5) |
| FD-2 (О38) | 5.5 (every writer runs SHAPE and both parts of GATESEQ), 5.6 (GATESEQ equal and durable, the command GATEROWS), 15 (row 2 (f)), 16 (CD-2), 18 | the durable part of GATESEQ (every gate line is a row name of the gate table) joins CD-2; the equal part is asked of every writer by rule 5.5. V09c is red under both parts |
| FD-3 (О38) | 13 (row M0.13, the STAGED commands on the index, the three-step next step on a difference) | the comparison reads `git show ":<file>"` and `git ls-files docs/issues/`, checks that no source has an unstaged change and that no defect file is left out. On a difference: stop, a short DOC-UPDATER step under L4, ORCH's check, then stage and compare again. Measured: green on the staged build; a status changed and staged, and an unstaged open defect file, are red |
| FD-4 (О38) | 14 (the precondition command, whole-path matching, folders), F34 | `README.md` no longer matches `tools/README.md`, `PLAN.md` no longer matches `docs/program/public-v1/PLAN.md`; whole names, string write sets and folder prefixes still match |
| О39 | this section; the issues of the handoff | the remaining ways to defeat the rule are named (below) |

**Remaining ways to defeat the rule of 6.1** (named, not closed by this design):

1. A forged or edited REQ-VALIDATOR handoff with an earlier `completed_at` and verdict PASS that
   names the requirement. FIRSTGATE and checks (4), (5) trust the handoffs. The defense is the
   bookkeeping: handoffs are only appended, `handoffs-check` checks their times against the clock
   and the commit, and ORCH checks every step.
2. A form row written before the first real gate row, naming a real handoff that is not the
   earliest PASS of the requirement (V28e). The rule takes it, so it is not stopped at the source.
   Check (5) is red on a table built from it, and (1), (4) are red on the built table.
3. ORCH writes no form row for a newly gated requirement, or writes it in a broken form
   («Gate PASS:», leading text). The requirement is then not in the PLAN table. Check (6) is red at
   S1 and at step 9 while the requirement is pending, in progress or blocked; after the run it is
   ORCH's WF-01 step 3.
4. A requirement of the program numbered below REQ-102. Check (6) covers REQ-102 on only (program
   plan §4.2). (Step 1g: (6) now covers the requirements of the PROGRESS P-code table, so this limit
   is replaced by one: a program requirement that has no row at all in that table; section 24.)

Kept as they were: every other section, the step-1 and step-1c mutant results (run again on the
trial of step 1e, section 18), and the lists of sections 20 and 22.

## 24. Closed in the rework of step 01g

The rework covers only the findings of `handoffs/M0DOCS-20261117-01/step-01f-code-design-validator.json`
(FE-1 Medium; FE-2, FE-3 Low). It is the one extra rework that the owner gave on 2026-11-18 (DG-6,
`decisions/0117` О41), and the next gate pass is the one extra pass (AP-019).

| Finding / point | Where in this design | What changed |
|---|---|---|
| FE-1 (Medium; О38, О41) | 14 (how a write-set item is read, the command, the measurement against every real item, the full list of the 114 differing pairs, the invented items, the project run, what the precondition still cannot see), F34, F35 | the item is cut into path tokens with any character that cannot be part of a path as the boundary on both sides; a final period and a leading `./` are dropped, a pair `a.ext/b.ext` gives two tokens, a folder with `/` and a glob hold what they cover. Measured on all 2192 write-set items of the 1421 handoffs against the 16 locked paths: 465 pairs both forms match, 83 only the substring form (each a longer path, another file), 31 only the token form (a parent folder, a glob, the locked folder without its `/`); no real holder missed; the two colon items of E2E-20261103-01 matched. 25 invented items as expected |
| FE-2 (Low; О41) | 6.1 (check (6)), 15 (row 3) | «program requirement» = a requirement with any row in the PROGRESS P-code table; REQ-104…REQ-107 are outside its scope. The gate's V28f is red under the old (6) and green under the new; V10 stays red |
| FE-3 (Low; О41) | 6.1 (the commands of checks (1)–(6)) | the six checks are written as commands in the design; on the trial each prints nothing |
| the record of step 1e | 23 (limit 4) | the limit «check (6) covers REQ-102 on only» is replaced: (6) covers the requirements of the P-code table |

**What the lock precondition still cannot see** is named in section 14 (four ways): a holder that
names the file by a word or a bare folder word, a misspelled path or another glob form, a writer
outside the handoffs, and a task that names the file outside its `write_set`. **What check (6)
still cannot see:** a program requirement that has no row at all in the PROGRESS P-code table.
Every requirement of the program gets its row there when it is written (ORCH's bookkeeping,
PLAN §4.2), and its form row at its gate (6.1).

Kept as they were: every other section, the results of the mutants of steps 1, 1c and 1e (run again
on the trial of step 1g, section 18), and the lists of sections 20, 22 and 23.
