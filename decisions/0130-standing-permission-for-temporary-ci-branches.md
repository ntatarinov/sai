# 0130 — A standing permission for the temporary `ci/*` branches

Status: **accepted** (the owner's answer, 2026-11-22, the session on the owner's Windows PC, chat; recorded by ORCH).

## Question

No check command runs on the owner's Windows PC (decisions/0110): every run of the tests goes through a temporary branch
`ci/*` on GitHub. Until now each such push waited for the owner's «да» (the autonomy mode: a push is one of the three things
ORCH asks about). With the audit, the fixes and the new work of decisions/0129 there are many such runs. May ORCH send these
branches without asking each time?

The question as it was asked in the chat (verbatim): «тесты на этом компьютере запускать нельзя, каждый прогон идёт через
временную ветку `ci/*` на GitHub. Разрешаете отправлять такие ветки без вопроса каждый раз? В `main` они не попадают и сайт
не меняют. Ответьте «да» или «спрашивай каждый раз».»

## Owner's words (verbatim)

«Да» (2026-11-22, chat).

## Options

1. «да»: a standing permission for the temporary `ci/*` branches. **Chosen by the owner.**
2. «спрашивай каждый раз»: every push waits for his word, as before.

## Decision

ORCH may push a temporary branch `ci/<name>` to GitHub without asking each time, **only to run the checks there**.

What the permission covers, and its limits:

- Only new branches whose name starts with `ci/`. Never `main`, never `m0-records`, never any other branch, never a tag.
- Never a force-push; a new run gets a new branch name.
- The pushed commit is a snapshot made for the run (the tree to be checked on top of `main`), with the project's commit
  author. Before the push ORCH checks the tree: `cd tools && npm run -s traces` prints 0 traces, and a search of the tree for
  paths of this computer (also the Windows forms, which the `traces` rules do not see yet) is empty.
- Nothing of a `ci/*` branch reaches `main` or the site by itself: a release still goes only through step 11 of WF-02 on the
  owner's «да».
- Deleting branches is not covered: ORCH keeps the list of the temporary branches in docs/program/public-v1/PROGRESS.md and
  asks the owner to delete them in one batch.
- The deploy, the push to `main`, the deletion of data or branches, gate G21 and gate G2 stay the owner's, each time.

The owner can take the permission back by a word.

## Why

The owner asked for the work to go to the maximum (decisions/0129). A temporary branch changes neither `main` nor the site;
asking about each one only slowed the checks. The repository is public on purpose (decisions/0111), so the runs cost no
Actions minutes, but everything pushed is visible to everyone: hence the check of the tree before each push.

## Boundary

This record does not allow any push except a new `ci/*` branch. It does not change decisions/0110 (no check on this PC).

## Basis

The owner's chat message of 2026-11-22 quoted above; decisions/0110, 0111, 0129; the autonomy mode of 2026-11-21; quality-bar
Q12 and R1.
