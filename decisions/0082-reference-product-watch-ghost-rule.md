# 0082 — A colleague's product as a reference: we watch it all the time and take the best ideas, and we leave no trace in it

Status: **accepted** (by the owner's word, 2026-10-25, in the session; recorded by ORCH).

## Question

The owner pointed at a colleague's product (a workflow platform with its own web interface) as the level Sai has to beat. How do we work with it?

## Decision

The owner's words, verbatim: «1. Мы должны постоянно смотреть на [проект коллеги] постоянно и брать лучшее для проекта sai. 2. для проекта [коллеги] мы должны быть прикраками» (the product name is replaced by a placeholder in brackets on purpose: see item 3) (in the second sentence the owner means "ghosts": we are not seen there and leave nothing behind).

1. **Watch all the time.** Before every design or product requirement (WF-01, WF-04) and at the start of every iteration that changes how Sai looks or works, ORCH looks at the current state of the reference product, read-only: a fresh shallow copy outside the project folders (the scratchpad), never inside a working folder, and notes what is better there than in Sai.
2. **Take the best.** Ideas, structure, and good practice are taken and then made better in Sai's own words, design, and code. No code, text, picture, name, or data is copied into Sai files. A comparison is written as a note outside the repository or, if it is needed in the record, with neutral wording ("the reference product").
3. **Ghost.** Nothing goes into that project: no commit, no push, no branch, no issue, no pull request, no comment, no message, no change of its files in any working folder of ours, no account created, no real request to its servers from tests or the study. The study runs only on a copy and with mocked data. The name and the address of the reference product are not written into Sai files (the traces check and the habit of `decisions/0018`-style anonymity stay as they are).
4. **Bar.** Sai has to be visibly better than the reference at what the visitor sees: layout on a phone, readability, consistent design system, dark theme, accurate local formats, clear words. The reference is the floor, not the goal.

## Addition (2026-10-25, the owner's word): the other reference project

The owner repeated, about the other company project that Sai once used as a sample for its agents: «с проекта [второго проекта] надо брать документацию агентов, и на этом все! а остальное не стоит передавать туда никакой информации и прочей информации». So:

- From that project only the **documentation of agents** (role descriptions, workflows, instructions) is taken, and only by reading; nothing else is taken.
- Nothing goes there: no files, no information, no notes, no commits, no pushes, no messages. The ghost rule (item 3) applies to it in full.
- Its name is not written into Sai files either; the working folders of both projects are not changed from the Sai sessions.

## Why

The owner wants Sai to be stronger than a working product of a colleague, without any trace in or any conflict with the colleague's project.

## Boundary

This does not forbid the owner himself from talking to the colleague. It does not change the rule that Sai's own repository is the only place where ORCH commits and pushes (`decisions/0048`). It does not allow copying code or text.

## Basis

The owner's message in the session after the release of REQ-057; the study of the reference interface made on a copy outside the project (notes and snapshots outside the repository); `decisions/0048`.
