# Sai

This is the English description of the project. The main documents of the project are in
Russian; the Russian README is [README.md](README.md). "Sai" means "suitable" in Kazakh.

## What Sai is

**Sai is a virtual team of AI agents for business. You state a goal in plain words; the team
makes a plan, splits the work between roles, checks the results and delivers them. One page
shows who is doing what and where your decision is needed — no diagrams and no programming.**

This definition comes from the owner's decision
[decisions/0033-drop-clothing-shop-product.md](decisions/0033-drop-clothing-shop-product.md),
which refines [decisions/0015-product-virtual-team-start.md](decisions/0015-product-virtual-team-start.md).
An earlier product idea (a tool for clothing shops) was dropped; it remains only in the history
of how the idea was chosen (`ideas/`, `runs/`, `docs/research/`, `docs/business-plan/`).

The repository has two layers of work:

- **The product, "Sai Team"** — the virtual team itself: a project with a goal, a planning and
  checking engine, agents that run on Claude Code, a local web page and terminal commands. Its
  business roles are a catalog of ten (project manager, business analyst, researcher, financial
  analyst, lawyer, marketer, designer, developer, reviewer (QA), support specialist).
- **The agent pipeline** — 37 AI-agent roles, seven processes and a quality bar by which AI
  agents build Sai itself: requirements, designs, code, tests, reviews, documents. **Pixel
  Office** is a page that shows, live, which of these agents are working.

## Who it is for

- **A small-business owner** who states a goal in their own words and decides only what
  matters; the agent team does and checks the rest.
- **A person who runs the agents' work** and wants to see on one page which roles are working,
  what is done and where a decision is waited for.

## How the work goes: you give a task, the agents design, build, test and check it themselves

You give a task in your own words. After that the agents carry it on by themselves. Whoever does
the work does not check it. Another agent checks it, and that agent re-runs everything itself. At
most two agents work at the same time. After every step the main agent (ORCH) compares the
agent's words with the files. If a check fails, the work goes back to its author. A check has at
most three passes. After that ORCH stops and asks you.

In development the path is this. A designer describes everything before any code and tries the
idea on a sketch. Another agent repeats the trials on a clean copy. A developer builds in small
parts and runs the checks after each part. The security check and the code review run at the
same time. The first one tries to break the code itself; the second looks for hacks. A tester
writes a test for every criterion and deliberately damages the code. This is how the tests
themselves are checked. One command checks formatting, rules, traces and all tests. Pages are
opened in a real Chrome: three window sizes, two themes, three languages, with screenshots.
Separate agents read the translations in two to three rounds. The last checker runs everything
again. Only after that is the work marked "done". The release goes to `main` and waits for a
green check on GitHub. You get a report in plain words. The order of steps is written in
[docs/workflows/](docs/workflows/) and in
[decisions/0079](decisions/0079-agents-docs-practice.md).

## How it works

- **The orchestrator (ORCH)** leads every piece of work. It chooses the process, writes a task
  for each agent, starts the agents, lets work move on only through checks ("gates"), verifies
  the records and reports to the owner in plain words. It does not write code or requirements
  (the only exception is a tiny one-file fix on the "short path" of WF-02).
- **Roles.** Each agent works in exactly one role. A role is a file in
  [.claude/agents/](.claude/agents/) that says what the role does, what it reads, what it hands
  over and what it must not do. All 37 roles are described in English in
  [docs/agents.en.md](docs/agents.en.md).
- **Handoffs.** Every step is a JSON file in `handoffs/<RUN-ID>/`: the orchestrator writes the
  task there, the agent writes its report there (summary, changes, its own check output, open
  issues, changed files). Times come from the clock. These files are the history of who did
  what and on what basis; they are not rewritten. The protocol is
  [docs/workflows/handoffs.md](docs/workflows/handoffs.md).
- **Gates.** Whoever produces something does not check it: every producing role has a separate
  checking role, and the checker re-runs the checks itself instead of trusting the author's
  report. Work moves to the next step only after a PASS. After a FAIL the author fixes exactly
  the listed findings, and the same check runs again. A gate has at most three passes: the
  first and two repeats; a third FAIL stops the work and goes to the owner.
- **Quality bar.** [docs/quality-bar.md](docs/quality-bar.md) lists the minimum for every
  change (items Q1–Q14 and R1–R3): a requirement before code, a test for every acceptance
  criterion, no secrets in files, no faking a check, decisions written down, and so on. No agent
  may lower it; it is raised only by the owner's decision, one step at a time. A merge needs the
  owner's confirmation (R1); at present the owner allows a push to `main` after the final
  independent check has passed
  ([decisions/0048](decisions/0048-owner-delegates-open-points-repo-public.md),
  [decisions/0079](decisions/0079-agents-docs-practice.md)). Pixel Office
  may show only real events (R2).
- **Processes** (documents in [docs/workflows/](docs/workflows/)):
  - **WF-01, requirement** — the owner's request becomes a requirement with checkable acceptance
    criteria in `docs/requirements.yaml`; a separate agent confirms it can be worked on. If
    the design or the tests show that a criterion cannot be met, a short separate run fixes only
    that criterion, with the same gate.
  - **WF-02, development** — a design (with a sketch outside the project, a measure of the
    tests that will turn red at each sub-step and a table of replacements for the guard tests of
    released requirements), a design gate, code in sub-steps, a security check and a code review
    at the same time, tests with independent oracles and deliberate breakages (mutants), a test
    gate, a full check run, acceptance in a real Chrome without a window (windows 1470 × 784,
    390 × 844, 320 × 568, light and dark themes, three languages, with screenshots), readers of
    the translations in two to three rounds, a final independent gate, records, a commit of the
    run's files by name, a push to `main`, waiting for `check.yml` and a second commit with the
    handoff of the last step.
  - **WF-03, defect** — find the root cause first, then a checked fix design, the fix, and a
    regression test that fails before the fix and passes after it. If only the tests are wrong,
    the fix design and the code gates are skipped, with the reason written down.
  - **WF-04, UI by sample** — describe a screen from a screenshot so precisely that it can be
    built without guessing, build it, then compare the built page with the sample. Without a
    sample the description is written anyway, the comparison is replaced by acceptance in a real
    browser.
  - **WF-05, health audit** — check the whole project by dimensions (security, dependencies,
    architecture, test coverage, documentation, and re-checking requirements that are already
    done), then open defects for the serious findings. Once in 30 days the documentation
    dimension also compares the descriptions of roles and processes with the latest runs.
  - **WF-06, idea selection** — three analysts rate idea candidates from three points of view
    and check each other, a judge gives a verdict, a separate agent re-checks and applies it;
    the owner decides.
  - **WF-07, business plan** — market research, a check of every research file, a plan written
    only from checked facts, a check of the plan, a final check.

## What already works

Everything below is checked by the one check command `cd tools && npm run check` and by the
gates of the runs recorded in `STATE.md` (Russian). The user-facing text of the pages and
commands is in Russian.

- **Pixel Office** (`cd tools && npm run pixel-office`, a link on `127.0.0.1`, port 4780 by
  default). Tasks, their states and the office are built only from events that Claude Code
  hooks send at the moment they fire, with their real time; there are no invented or
  back-dated events. The event log also shows the orchestrator's own notes on how it
  understood a request; they are marked as orchestrator notes, not Claude Code events, and do
  not change tasks, states or the office. On the page:
  - a header with the connection state and a "Now" block: one line for each agent that is
    working right now, "working: N" and a "Show all (N)" button that opens the full list;
  - an office with characters at the desks of their roles and a role legend; each role has one
    plain-words name everywhere on the page (the role code is shown only in a hint and in the
    card details);
  - clicking a character, its desk or its label opens a card of that agent run: its current
    task, three state lines (task, agent, workplace) with their basis, who started it, and links
    to the task panel and to the log; a separate card for the main Claude Code session;
  - an event log in plain words; a row expands into "What happened" and "What this does not
    prove", then the technical fields; the log can be filtered by session, agent, event type and
    task, searched by words, and paged back with "Show earlier" to the very first row;
  - a "Tasks" panel (current, history, server starts) and a history window for one owner
    request;
  - five honest task states. If a session sends no events for 60 minutes, its tasks show "no
    fresh data" instead of "working".

  The newest Pixel Office features (one role name everywhere, the "Now" view, log navigation,
  the main session card) were released on 2026-10-16 with 1581 tests passing. Details (in
  Russian): [tools/README.md](tools/README.md), section "Pixel Office".

- **Sai Team, the virtual team:**
  - the core: a project with a goal, tasks, memory and result files, stored in files on this
    computer, with one event journal as the single source of truth and recovery after a crash;
  - the engine: the project manager role makes a plan; tasks run in parallel (two at a time by
    default); every result is checked by a separate reviewer run before it counts as done;
    critical tasks (sending, publishing, paying) only prepare a draft and wait for the user's
    approval, and the engine never performs the outside action itself; a spending cap per
    project and per run; at the end the results are checked against the goal;
  - terminal commands: `cd tools && npm run team` (list, create, start, pause, resume, stop,
    answer, budget);
  - a local page `cd tools && npm run team-web` (port 4781 by default): projects, a new project
    with a goal in one sentence and a spending cap, a project page that answers six questions
    (what is happening, who is working, when it will be ready, is there a problem, is anything
    needed from you, the result), a chat, and "Pause", "Continue", "Stop" buttons.

  The engine and the page are tested with a scripted test executor that does not call a model.
  One real run on Claude Code was done on 2026-10-13 from the command line: a small project
  ("three tips for a coffee shop owner") was finished, 6 of 6 tasks, 14 agent runs, in 8
  minutes, with a reported cost of 0.92 USD out of a 3 USD cap; no task became "done" without a
  separate check. Report (in Russian):
  [docs/uat/REAL-RUN-20261013.md](docs/uat/REAL-RUN-20261013.md).

- **The solution picker site** (`cd tools && npm run picker`, code in `tools/src/picker/`,
  requirements REQ-054 to REQ-068, [decisions/0065](decisions/0065-solution-picker-stack-and-choices.md)).
  A visitor answers the questions of a questionnaire and sees which solution suits them; every
  tenant has its own file, with texts in Russian, Kazakh and English. Part of the requirements is
  done (the tenant file and its check, the scoring engine, the server, the three languages, the
  check of characters in texts); the rest is in progress, the exact state is in
  `docs/requirements.yaml` and `STATE.md`.

- **Checks:**
  - `cd tools && npm run check` — one command: formatting, linter, a trace check (no paths of
    the author's computer, no forbidden names, no links outside the repository), a check of the
    handoff records, and all tests. It stops at the first error.
  - On GitHub, `.github/workflows/check.yml` runs the same command (Node 22, `npm ci`,
    `npm run check`) on every push to any branch and on every pull request. The last release
    commit passed it.
  - An optional local hook `.githooks/pre-push` runs the same check before a push (enable it
    once per clone, see "How to run").

## What is not ready or not proven

As of 2026-10-17, from `STATE.md`, `docs/requirements.yaml` and `docs/issues/`:

- **Demand is not tested.** Nobody has checked yet that businesses want a virtual team; this is
  an accepted risk ([decisions/0015](decisions/0015-product-virtual-team-start.md)).
- **Real model runs are barely tested.** Only one real Claude Code run was done, from the
  command line; its goal check passed on the first try, so re-planning after a failed goal
  check was not exercised on the real model. Pause, continue and stop, the chat
  and owner answers, network and executor failures, running out of the cap, parallel tasks,
  critical tasks and retries were tested only with a fake executor. A real run through the web
  page has not been done. A real run needs the owner's consent and a spending cap.
- **Pixel Office is not fully accepted.** Acceptance ran on separate test servers with made-up
  data; the newest features have not been run with a real Claude Code session; the owner has
  not yet confirmed that the page looks like the approved sample. The requirements for Pixel
  Office's core (REQ-001, REQ-007, REQ-008) are still in progress.
- **Requirements:** 53 in total — 21 done, 4 in progress, 28 pending (counted from
  `docs/requirements.yaml`; the order of work is in `docs/product/requirements-catalog.md`).
  Still pending, for example: user accounts and login, workspaces and access roles, a decisions
  window, goal templates, a second interface language. The requirements for a built-in Pixel
  Office guide (help panel, first-visit tour, hints; REQ-050…REQ-053) are written and wait to
  be built.
- **Single computer only.** Both servers listen only on `127.0.0.1`; there are no user accounts
  yet. The interface is in Russian only.
- **Open defects: 62** in `docs/issues/` — 7 of medium severity and 55 low; none high or
  critical.
- **No health audit yet.** The first WF-05 audit has not run; the folder `docs/audits/` will
  appear with it.

## License

License: proprietary, all rights reserved; copyright holder N. Tatarinov (GitHub: ntatarinov) (see [LICENSE](LICENSE)).

## How to run

You need git and Node 22 with npm (`tools/package.json`, field `engines`). Claude Code is needed
only for the Pixel Office hooks and for real runs of the Sai Team executor.

1. Clone the repository:

   ```
   git clone <Sai repository address>
   ```

2. In a terminal, in the clone:

   ```
   cd tools
   npm ci
   npm run check
   ```

   `npm ci` installs the development tools from `tools/package-lock.json`. The trace check works
   only in a git clone (it checks the files that git tracks).

3. Pixel Office, from `tools/`:

   ```
   npm run pixel-office
   ```

   The command prints a link on `127.0.0.1` (port 4780 by default; another port:
   `npm run pixel-office -- --port <port>`). The server keeps its event log and its write secret
   in a folder in your home directory, outside the repository.

4. To see agents on the page, open Claude Code in the repository root (where `CLAUDE.md` is).
   The hooks are in `.claude/settings.json` and fire only in sessions started in this folder.
   Confirm them with `/hooks` in Claude Code or start a new session, and trust the folder when
   Claude Code asks; without that the hooks do not run.

5. Sai Team, from `tools/`:

   ```
   npm run team -- projects
   npm run team-web
   ```

   The first command lists projects (empty on a new computer). The second starts the local page
   (port 4781 by default). Real Claude Code runs are off unless `SAI_TEAM_REAL_RUNS=1` is set;
   other settings are in [tools/README.md](tools/README.md), sections "Sai Team".

6. Optional: run the check before every push (once per clone):

   ```
   git config core.hooksPath .githooks
   ```

## Repository structure

- `CLAUDE.md` — the entry point for agents: what to read first, the main rule, roles, processes.
- `STATE.md` — what is done, what is open, what is next; `PLAN.md` — iterations and steps.
- `.claude/agents/` — the 37 role files; `.claude/settings.json` — the Pixel Office hooks.
- `docs/` — the quality bar (`quality-bar.md`), requirements (`requirements.yaml`), processes
  (`workflows/`), designs and samples (`design/`), defects (`issues/`), acceptance scenarios
  (`uat/`), release reports (`releases/`), the log of process mistakes (`anti-patterns.md`),
  research and the business plan (`research/`, `business-plan/`), product state and plans
  (`product/`), the owner's goals in his words (`owner-goals.md`). English: this file and
  [docs/agents.en.md](docs/agents.en.md).
- `decisions/` — recorded decisions; the list is `decisions/README.md`.
- `handoffs/` — tasks and reports of agents by run; `runs/` — files of idea-selection runs;
  `reports/` — run reports. This is history and is not rewritten.
- `ideas/` — the ideas the project grew from and why the others were dropped.
- `tools/` — the code of Sai Team, Pixel Office, the solution picker site and the pipeline tools, with tests; commands are
  in [tools/README.md](tools/README.md).
- `.github/workflows/check.yml` — the check on GitHub; `.githooks/pre-push` — the local check
  before a push.

Most documents are in Russian. The Russian README is [README.md](README.md); parts of it are
out of date (for example, the counts of requirements and defects and the note about real model
runs). This English version was checked against the repository files on 2026-10-17; the parts on
the agent pipeline, the processes and the picker site were updated on 2026-10-25
([decisions/0079](decisions/0079-agents-docs-practice.md)). Where the two differ, this file and
`STATE.md` follow the files.
