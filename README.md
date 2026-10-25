# Sai

"Sai" in Kazakh means "suitable". This file says what the project is, how it differs from
others, how to open it on another computer, and what is not ready yet. The state of things
today is in `STATE.md`, the plan is in `PLAN.md`; agents start their work from `CLAUDE.md`.

License: proprietary, all rights reserved — file `LICENSE` (copyright holder: N. Tatarinov, GitHub: ntatarinov; the name was entered on 2026-10-20, decision `0068`).

## What Sai is

**Sai is a virtual team of AI agents for business: you write a goal in ordinary words, the
team makes a plan, divides the work between roles, checks it and brings the result; one page
shows who does what and where your decision is needed — without diagrams and without
programming.**

The product is defined this way by the owner's decision
`decisions/0033-drop-clothing-shop-product.md` (it refines
`decisions/0015-product-virtual-team-start.md`). The earlier product hypothesis for clothing
shops was dropped; it remains only in the history of the idea selection (`ideas/`, `runs/`,
`docs/research/`, `docs/business-plan/`).

The repository has two layers of work:

- **The product, "Sai Team"** — the virtual team itself: a project with a goal, a planning and
  checking engine, agents that run on Claude Code, a local web page and terminal commands. Its
  business roles are a catalog of ten (project manager, business analyst, researcher,
  financial analyst, lawyer, marketer, designer, developer, reviewer (QA), support
  specialist).
- **The agent pipeline** — 37 AI-agent roles, seven workflows and a quality bar by which AI
  agents build Sai itself: requirements, designs, code, tests, reviews, documents. **Pixel
  Office** is a page that shows, live, which of these agents are working.

## Who it is for

- **A small-business owner** — sets a goal in his own words and decides only what matters:
  the team of agents does and checks the rest itself.
- **A person who leads the work of the agents** — sees on one page which roles work, what is
  done and where his decisions are waited for.

## How the work goes: you give a task — the agents design, build, test and check by themselves

You give a task in your own words. After that the agents lead it themselves. The one who does
the work does not check it. Another agent checks, and it runs everything again by itself. No
more than two agents work at the same time. After each step the main agent (ORCH) compares
the agent's words with the files. If a check is not passed, the work goes back to the author.
Gate passes for one check — up to three. Then ORCH stops and asks you.

In development the path is this. The designer describes everything before the code and tries
the idea on a sketch. Another agent repeats the trials on a clean copy. The developer builds
in small parts and runs the checks after each. Security and review go at the same time. The
first tries to break the code itself, the second looks for crutches. The tester writes a test
for each criterion and spoils the code on purpose. This is how the tests themselves are
checked. One command checks the formatting, the rules, the traces and all tests. Pages are
opened in a real Chrome: three window sizes, two themes, three languages, with snapshots.
Translations are read by separate agents in two or three rounds. The last checker runs
everything again. Only after that is "done" set. The release goes to `main` and waits for a
green check on GitHub. You get a report in plain words. The order of the steps is written in
`docs/workflows/` and in the decision `decisions/0079-agents-docs-practice.md`.

## How the roles and workflows work together

- **The orchestrator (ORCH)** leads every piece of work. It chooses the workflow, writes a
  task for each agent, starts the agents, lets the work move on only through checks (gates),
  checks the records and reports to the owner in plain words. It does not write code or
  requirements (the only exception is a tiny one-file fix on the "short path" of WF-02).
- **Roles.** Each agent works in exactly one role. A role is a file in `.claude/agents/` that
  says what the role does, what it reads, what it hands over and what it must not do. All 37
  roles are described there.
- **Handoffs.** Every step is a JSON file in `handoffs/<RUN-ID>/`: ORCH writes the task there,
  the agent writes its report there (summary, changes, its own check output, open issues,
  changed files). Times come from the clock. These files are the history of who did what and
  on what basis; they are not rewritten. The protocol is `docs/workflows/handoffs.md`.
- **Gates.** The one who produces something does not check it: every producing role has a
  separate checking role, and the checker runs the checks again itself instead of trusting the
  author's report. Work moves to the next step only after a PASS. After a FAIL the author
  fixes exactly the listed findings, and the same check runs again. A gate has at most three
  passes: the first and two repeats; a third FAIL stops the work and goes to the owner.
- **Quality bar.** `docs/quality-bar.md` lists the minimum for every change (items Q1–Q14 and
  R1–R3): a requirement before code, a test for every acceptance criterion, no secrets in
  files, no faking of a check, decisions written down, and so on. No agent may lower it; it is
  raised only by the owner's decision, one step at a time. A merge needs the owner's
  confirmation (R1); at present the owner allows a push to `main` after the final independent
  check has passed (`decisions/0048-owner-delegates-open-points-repo-public.md`,
  `decisions/0079-agents-docs-practice.md`). Pixel Office may show only real events (R2).
- **Workflows** (documents in `docs/workflows/`):
  - **WF-01, requirement** — the owner's request becomes a requirement with checkable
    acceptance criteria in `docs/requirements.yaml`; a separate agent confirms it can be
    worked on. If the design or the tests show that a criterion cannot be met, a short
    separate run fixes only that criterion, with the same gate.
  - **WF-02, development** — a design (with a sketch outside the project, a measure of the
    tests that will turn red at each sub-step and a table of replacements for the guard tests
    of released requirements), a design gate, code in sub-steps, a security check and a code
    review at the same time, tests with independent oracles and deliberate breakages
    (mutants), a test gate, a full check run, acceptance in a real Chrome without a window
    (windows 1470 × 784, 390 × 844, 320 × 568, light and dark themes, three languages, with
    snapshots), readers of the translations in two to three rounds, a final independent gate,
    records, a commit of the run's files by name, a push to `main`, waiting for `check.yml`
    and a second commit with the handoff of the last step.
  - **WF-03, defect** — find the root cause first, then a checked design of the fix, the fix,
    and a regression test that fails before the fix and passes after it. If only the tests are
    wrong, the design of the fix and the code gates are skipped, with the reason written down.
  - **WF-04, interface by sample** — describe a screen from a screenshot so precisely that it
    can be built without guessing, build it, then compare the built page with the sample.
    Without a sample the description is written anyway, and the comparison is replaced by
    acceptance in a real browser.
  - **WF-05, health audit** — check the whole project by dimensions (security, dependencies,
    architecture, test coverage, documentation, and re-checking of requirements that are
    already done), then open defects for the serious findings. Once in 30 days the
    documentation dimension also compares the descriptions of roles and workflows with the
    latest runs.
  - **WF-06, idea selection** — three analysts rate idea candidates from three points of view
    and check each other, a judge gives a verdict, a separate agent re-checks and applies it;
    the owner decides.
  - **WF-07, business plan** — market research, a check of every research file, a plan written
    only from checked facts, a check of the plan, a final check.

## What already works

Everything below is checked by the command `cd tools && npm run check` and by the gates of the
runs (`STATE.md`).

- **Pixel Office** — a page that shows which tasks the agents are doing: a task list, an event
  journal and an office with characters of the roles. Everything is built only from events
  that the Claude Code hooks send, with their real time — there are no invented events and no
  events written after the fact (bar item R2, `docs/quality-bar.md`). Start it with
  `cd tools && npm run pixel-office` (a link on `127.0.0.1`, port 4780 by default); how it is
  built — `tools/README.md`, section "Pixel Office"; code — `tools/src/pixel-office/`, tests —
  `tools/test/pixel-office-*.test.js`. The event journal also shows the orchestrator's own
  notes on how it understood a request; they are marked as orchestrator notes, not Claude Code
  events, and do not change tasks, states or the office. On the page:
  - a header with the connection state and a "Now" block: one line for each agent that is
    working right now, "working: N" and a "Show all (N)" button that opens the full list;
  - an office with characters at the desks of their roles and a role legend; each role has one
    plain-words name everywhere on the page (the role code is shown only in a hint and in the
    card details);
  - a click on a character, its desk or its label opens a card of that agent run: its current
    task, three state lines (task, agent, workplace) with their basis, who started it, and
    links to the task panel and to the journal; a separate card for the main Claude Code
    session;
  - an event journal in plain words; a row expands into "What happened" and "What this does
    not prove", then the technical fields; the journal can be filtered by session, agent,
    event type and task, searched by words, and paged back with "Show earlier" to the very
    first row;
  - a "Tasks" panel (current, history, server starts) and a history window for one owner
    request;
  - five honest task states. If a session sends no events for 60 minutes, its tasks show "no
    fresh data" instead of "working".

  The newest Pixel Office features (one role name everywhere, the "Now" view, journal
  navigation, the main session card) were released on 2026-10-16 with 1581 tests passing.
- **Sai Team — the virtual team itself:**
  - `cd tools && npm run team` — commands in a terminal (list of projects, create, start,
    pause, resume, stop, answer, budget);
  - `cd tools && npm run team-web` — a page on `127.0.0.1` (port 4781 by default): projects, a
    new project with a goal in ordinary words and a spending cap, a project page that answers
    six questions (what is happening, who is working, when it will be ready, is there a
    problem, is anything needed from you, the result), a chat, and the buttons "Pause",
    "Continue", "Stop";
  - the core: a project with a goal, tasks, memory and result files, stored in files on this
    computer, with one event journal as the single source of truth and recovery after a crash;
  - the engine: the project manager role makes a plan; tasks run in parallel (two at a time by
    default); every result is checked by a separate reviewer run before it counts as done;
    critical tasks (sending, publishing, paying) only prepare a draft and wait for the user's
    approval, and the engine never performs the outside action itself; a spending cap per
    project and per run; at the end the results are checked against the goal;
  - the code is in `tools/src/team/` and `tools/src/web/`, the description is in
    `tools/README.md`.

  The engine and the page are tested with a scripted test executor that does not call a model.
  One real run on Claude Code was done on 2026-10-13 from the command line: a small project
  ("three tips for a coffee shop owner") was finished, 6 of 6 tasks, 14 agent runs, in 8
  minutes, with a reported cost of 0.92 USD out of a 3 USD cap; no task became "done" without
  a separate check. The report: `docs/uat/REAL-RUN-20261013.md`.
- **The solution picker site** — a visitor answers the questions of a questionnaire and sees
  which solution suits them; every tenant has its own file, texts in Russian, Kazakh and
  English. A part of the requirements REQ-054…REQ-068 is done (the tenant file and its check,
  the scoring engine, the server, the three languages, the check of characters in texts, the
  questionnaire page with the card of the site); the rest wait to be built, first the result
  page (REQ-058): until then the questionnaire ends with a temporary screen and the page is
  not for real visitors. The exact status is in `docs/requirements.yaml` and `STATE.md`. Start
  it with `cd tools && npm run picker`; how it is built — `tools/README.md`; code —
  `tools/src/picker/`; decision — `decisions/0065-solution-picker-stack-and-choices.md`.
- **The agent pipeline** — the roles, workflows and quality bar by which the AI agents make Sai
  itself: 37 role files in `.claude/agents/`, workflows WF-01…WF-07 in `docs/workflows/`; every
  producing role has a checking role (`CLAUDE.md`).
- **Checks:**
  - `cd tools && npm run check` — one command: formatting, linter, a trace check (no paths of
    the author's computer, no forbidden names, no links outside the repository), a check of the
    handoff records, and all tests. It stops at the first error.
  - On GitHub, `.github/workflows/check.yml` runs the same command on every push to any
    branch and on every pull request (see below). The runs of 2026-10-25 were red because of 11
    tests of the questionnaire page that were being rebuilt; with the release of REQ-057 the
    local check is green (1998 of 1998 tests) and so is the GitHub run of that release
    (`gh run list --workflow check.yml`).
  - A local hook `.githooks/pre-push` runs the same check before a push (it is enabled once
    per clone, see below).

The text of the pages and commands the user sees is in Russian.

## How Sai differs

- **The work is seen by real events.** There are no invented statuses on the page: what is
  shown, did happen (R2).
- **A check of the value in one phrase before building.** Before building, the agents write
  one phrase about what people pay for, and a table of competitors, and an independent checker
  verifies by the market research whether others give the same:
  `docs/workflows/WF-07-business-plan.md`, section "Variant: a short document with a value gate"; requirement REQ-006 in
  `docs/requirements.yaml`.
- **Choice of an idea by three views and a judge.** Three analysts rate the ideas — market,
  execution, fit to the owner — with verbatim quotes and check each other, a judge gives a
  verdict, an executor re-checks it and applies it: `docs/workflows/WF-06-idea-selection.md`,
  contracts — `docs/design/REQ-002-idea-verdict.md`, the commands `prepare-run`, `validate`,
  `apply-verdict` — `tools/README.md`.
- **Parallel runs with protected files and a "before" snapshot.** Every parallel run declares
  its paths in advance in `handoffs/<BP-ID>/parallel-runs.jsonl`, and the protected files are
  compared with the "before" snapshot: `docs/workflows/WF-07-business-plan.md`, section "The "before" snapshot and parallel runs"; the commands
  `snapshot` and `snapshot-diff` — `tools/README.md`.
- **Writing files "all or nothing" with rollback.** New bytes are written to a temporary file
  next to the target, the old version stays as a hard link, and on a failure everything is
  rolled back: `decisions/0004-write-phase-rename-and-hardlink-rollback.md`, code —
  `tools/src/util.js`.
- **A quality bar that cannot be lowered.** Items Q1–Q14 and R1–R3; the bar can be raised only
  by the owner's decision: `docs/quality-bar.md`.
- **Work in iterations with a report to the owner.** One iteration is one result that the
  owner can see himself; after each one — a short report: `PLAN.md`.

## How to open on another computer

You need: git; Node 22 with npm (`tools/package.json`, field `engines`). Claude Code is needed
only for the Pixel Office hooks and for real runs of the Sai Team executor; for the rest it is
not needed.

1. Clone the Sai repository (the owner's access is needed):

   ```
   git clone <Sai repository address>
   ```

2. In a terminal, in the folder of the clone:

   ```
   cd tools
   npm ci
   npm run check
   ```

   `npm ci` installs the development tools from `tools/package-lock.json`; `npm run check` is
   the one check command: formatting, linter, the trace check (`npm run traces`: no paths of
   this computer, no names of other projects and no links outside the repository root) and all
   tests. The trace check works only in a clone with a `.git` folder: it checks the files that
   git tracks.
3. In the same place, in `tools/`, start Pixel Office:

   ```
   npm run pixel-office
   ```

   The command prints a link to 127.0.0.1 (the default port is 4780; another one — with the
   key `npm run pixel-office -- --port <port>`). Open it: there are the tasks of the agents,
   the event journal and the office. The server keeps the journal and the write secret outside
   the Sai folder; details, stopping the server and limits — `tools/README.md`.
4. In the same place, in `tools/`, the list of Sai Team projects (on a new computer it is
   empty):

   ```
   npm run team -- projects
   ```

   The local page of Sai Team is started with `npm run team-web` (port 4781 by default). Real
   Claude Code runs are off unless `SAI_TEAM_REAL_RUNS=1` is set; other settings are in
   `tools/README.md`, the sections about Sai Team.
5. The Pixel Office hooks: open Claude Code in the Sai folder — where `CLAUDE.md` is. The hooks
   are written in `.claude/settings.json` and fire only in sessions started in this folder. In
   Claude Code type `/hooks` and confirm the hooks — or start a new session. If Claude Code
   asks whether to trust the folder — confirm: without this the hooks do not start.

The names that must not be in Sai files are put by the owner into the list of forbidden names
with the command `npm run traces -- add` (the names go to standard input, only their hashes
get into Sai); a name that equals an ordinary word is entered as a pair of words, otherwise the
check would find the ordinary word too. The check skips, without reading, binary files, files
larger than 16 MiB and files outside the repository root (the exit code is then 0, the skip is
visible in the output).

## Check on GitHub and before a push

On GitHub, `.github/workflows/check.yml` runs on every push to any branch and on every pull
request: Node 22, then in `tools/` — `npm ci` and `npm run check`. This is the same one check
command that the owner has on his own computer. Look at the result with the command
`gh run list --workflow check.yml`.

On GitHub there is no branch protection: the requirement does not turn it
on, and turning it on is a separate decision on the owner's word. Why there is no protection is
written in `decisions/0023` (D1); the owner reviews this decision if the visibility of the
repository or the plan changes. A green check is provided by the process: red is not merged,
and the merge is confirmed by the owner.

Before a push the check is run by the hook `.githooks/pre-push`: it runs
`cd tools && npm run check` (about 2 minutes), and if the exit code is not 0,
the push does not go. A push that only deletes branches or tags carries no code, and the check
is not run for it. The hook is turned on once for each clone:

```
git config core.hooksPath .githooks
```

Limits to know about:

- The hook can be bypassed with a git flag; the bypass is forbidden by the rules of
  the process.
- While the setting is not turned on, there is no hook: the setting is kept in the clone and
  does not get into the repository.
- The hook checks the code in the working folder, not the commit that is
  leaving: unsent edits get into the check, and a red working folder can stop the push of a
  clean commit.
- The check on GitHub is the second line: it goes by the pushed commit.

## Where things are

- `CLAUDE.md` — the index for agents: what to read at the start, the main rule, roles,
  workflows.
- `STATE.md` — what is done, what is open, what is next; `PLAN.md` — iterations and steps.
- `.claude/agents/` — the 37 role files; `.claude/settings.json` — the Pixel Office hooks.
- `docs/` — the quality bar (`quality-bar.md`), requirements (`requirements.yaml`), workflows
  (`workflows/`), designs and samples (`design/`), defects (`issues/`), acceptance scenarios
  (`uat/`), release reports (`releases/`), the journal of process errors
  (`anti-patterns.md`), research and the business plan (`research/`, `business-plan/`),
  product state and plans (`product/`), the owner's goals in his words (`owner-goals.md`). The
  folder of audits `docs/audits/` will appear with the first audit
  (`docs/workflows/WF-05-health-audit.md`).
- `decisions/` — recorded decisions, their list is `decisions/README.md`.
- `handoffs/` — tasks and reports of agents by runs; `runs/` — files of idea-selection runs;
  `reports/` — run reports. This is history: it is not rewritten.
- `ideas/` — the ideas the project grew from, and why the others were dropped
  (`ideas/README.md`).
- `tools/` — the code of Sai Team, Pixel Office, the solution picker site and the pipeline
  tools, with tests; the commands are in `tools/README.md`.
- `.github/workflows/check.yml` — the check on GitHub; `.githooks/pre-push` — the local check
  before a push.

All instructions and documents of the pipeline are written in English
(`decisions/0080-english-instructions.md`). Some history files (handoffs, early decisions,
defects, release reports, research) are still in Russian.

## What is not ready or not proven

As of 2026-10-25, from `STATE.md`, `docs/requirements.yaml` and `docs/issues/`:

- **Demand is not tested.** Nobody has checked yet that businesses want a virtual team; this is
  an accepted risk (`decisions/0015`).
- **Real model runs are barely tested.** Only one real Claude Code run was done, from the
  command line; its goal check passed on the first try, so re-planning after a failed goal
  check was not exercised on the real model. Pause, continue and stop, the chat and owner
  answers, network and executor failures, running out of the cap, parallel tasks, critical
  tasks and retries were tested only with a scripted executor. A real run through the web page
  has not been done. A real run needs the owner's consent and a spending cap (`STATE.md`,
  "Ждёт владельца", i.e. "Waits for the owner").
- **Pixel Office is not fully accepted.** Acceptance ran on separate test servers with made-up
  data; the newest features have not been run with a real Claude Code session; the owner has
  not yet confirmed that the page looks like the approved sample (criterion 16 of REQ-007).
  The requirements for the core of Pixel Office (REQ-001, REQ-007, REQ-008) are still in
  progress.
- **Requirements:** 68 in total — 31 done, 4 in progress, 33 pending (counted from
  `docs/requirements.yaml`; the order of work is in `docs/product/requirements-catalog.md`).
  Still pending, for example: user accounts and login, workspaces and access roles, a
  decisions window, goal templates, a second interface language. The requirements for a
  built-in Pixel Office guide (help panel, first-visit tour, hints; REQ-050…REQ-053) are
  built and done since 2026-10-18.
- **A single computer only.** Both servers listen only on `127.0.0.1`; there are no user
  accounts yet. The interface is in Russian only.
- **Open defects: 73** in `docs/issues/` — 9 of medium severity and 64 low; none high or
  critical.
- **A merge in a way other than the push to `main` needs the owner's confirmation** (R1). The
  repository exists on GitHub and is closed by the owner on purpose (`decisions/0062`). A push
  to `main` after PASS of RELEASE-VALIDATOR is allowed by the owner (`decisions/0048`,
  `decisions/0079`); the release step commits the run's files, pushes them and waits for a
  green check on GitHub (`docs/workflows/WF-02-development.md`, step 11).
- **No health audit yet.** The first WF-05 audit has not run; the folder `docs/audits/` will
  appear with it (`docs/workflows/WF-05-health-audit.md`).
