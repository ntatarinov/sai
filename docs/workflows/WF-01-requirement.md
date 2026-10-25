# WF-01 — Requirement

How a requirement appears in Sai: a request of the owner becomes a record in
`docs/requirements.yaml` with criteria, each of which can be checked, and a separate agent
confirms that work can be done from this record. No code is written without a requirement
that has passed this workflow (quality-bar Q1).

All roles follow `docs/quality-bar.md`; handoffs follow `docs/workflows/handoffs.md`.

## When it starts

- The owner asks for something new: a product feature, a document, research, a service tool.
- An existing requirement must be changed: a criterion added or corrected. For example, after
  a defect, when the expected behavior was not in the requirement — this is how criterion 11
  appeared in REQ-002.
- It **does not start** for a defect if the expected behavior is already written in a
  requirement or in a test: that is WF-03.

WF-01 goes as a separate run before WF-02 (as with `PICKER-20261019-01`): it holds
`step-01-req-analyst.json`, `step-02-req-validator.json` and, if bookkeeping is needed,
`step-03-doc-updater.json`. WF-01 goes as the first steps of a larger run (`step-00a`,
`step-00b`) only if WF-02 opens right away in the same run. A short edit of a requirement in
the middle of development is the section "Micro-amendment after the code design".

## Roles

| Role | What it does | Who checks |
|---|---|---|
| ORCH | Passes the owner's words on verbatim, writes handoffs, after PASS includes the requirement in the iteration plan and tells the owner. Does not write requirements itself (AP-011) | — |
| REQ-ANALYST | Writes or edits a requirement block | REQ-VALIDATOR |
| REQ-VALIDATOR | Gate: checks the requirement | ORCH checks that all items were checked |
| DOC-UPDATER | Records a process error if it is found in a separate WF-01 run, and what the owner's answers produced (`STATE.md`, `PLAN.md`, decisions) | ORCH checks the record |
| Owner | The source of the request; decides the disputed points of the statement; may stop the work on a requirement | — |

## Steps

**Step 0 — ORCH prepares the task.**

1. Writes down the owner's request verbatim — with the date and the place where it was said
   (session, message). A retelling instead of the words is not acceptable.
2. Decides what it is: a new requirement, an edit of an existing one, or a defect (then
   WF-03).
3. Sets the lightweight git tag `base/<RUN-ID>` before the first change of the run; it is
   written in `context.base_tag` (`docs/workflows/handoffs.md`, "Common rules for all
   roles").
4. Writes the handoff for REQ-ANALYST: the owner's words, the related requirements, which
   block may be changed (`context.edit_scope`), who else is working with
   `docs/requirements.yaml` now (`context.parallel_work_now`). Only one agent may write to
   this file at a time.

**Step 1 — REQ-ANALYST writes the requirement.**

1. Reads `docs/requirements.yaml` (numbers, fields, neighboring requirements), the records of
   `decisions/` and `docs/anti-patterns.md`.
2. A new requirement gets the next free number `REQ-NNN`: the largest number in the whole file
   plus one. Fields: `id`, `title`, `owner`, `status: pending`, `depends_on`,
   `original_request` (the owner's words verbatim), `description`, `acceptance_criteria`. The
   sample is any requirement from the file.
3. There are at least two criteria. Each one says what checks it: a command, a test or the
   specific content of a specific file. "Convenient", "fast", "works well" are not criteria.
4. The requirement concerns customer data — it has a criterion of isolation of the business
   spaces (Q8); photos of people — a criterion of the storage period (R3; not applicable now,
   decision 0033); an external service — a criterion for its failure (Q10); an address that a
   customer or a user sets and that the server visits — a criterion of address validation
   (Q11).
5. The size is one piece of work for one run. If it does not fit — several requirements linked
   through `depends_on`.
6. Nothing in the text hints at lowering the bar ("no tests for now", "we will check later").
7. Changes only its own block: a new block is added at the end, the others are not moved or
   rewritten. Before and after writing, takes the hash of the rest of the file and writes both
   hashes into `result`, so that it is visible that the other blocks did not change.
   The tag `base/<RUN-ID>` (`context.base_tag`) serves as the "before" copy: REQ-ANALYST
   writes into `result.before_copy` the "before" lines of every edit, taken from
   `git show base/<RUN-ID>:docs/requirements.yaml` (AP-023); REQ-VALIDATOR compares the file
   with the tag with the command `git diff`.
8. Hands in the handoff: `result.changes` — what was written or changed, `result.self_check` —
   the output of its own checks (for example, that every command from the criteria runs on the
   current files).

**Step 2 — REQ-VALIDATOR, gate.** Reads the block itself, not from the author's report, and
checks:

- (а) **checkability** — there are at least two criteria, and each has a way of checking that
  gives an unambiguous "yes" or "no"; fewer than two criteria or vague words ("if necessary",
  "enough", "convenient") — FAIL;
- (б) **consistency** — no contradiction with the requirements in the status `done` and with
  the records of `decisions/`;
- (в) **dependencies** — every requirement in `depends_on` exists and is really needed
  earlier;
- (г) **size** — one piece of work, without several separate pieces of work inside one
  requirement;
- (д) **bar** — the criteria Q8, R3, Q10 and Q11 are there where they are needed; not a word
  about lowering the bar;
- (е) **owner's words** — `original_request` is verbatim, not a retelling.

What the gate checks itself, without trusting the author:

- in (а): the words in prohibitions are compared by identifier boundaries, with exact forms
  instead of stems, and the rule is tested on real code (AP-120); a statement "any", "every",
  "none" is backed by going through the whole set (AP-094); for a counting criterion, the
  "before" value on the base commit does not satisfy the criterion (AP-071); the test file
  named in a criterion exists or is written as created by this work (AP-123);
- in (б): by searching `tools/test/`, the guard tests of earlier requirements that turn red
  because of new modules, paths, commands and addresses are found, and the table of their
  replacement is named (AP-068, AP-112, AP-113); the decisions "inside a run" are found by the
  words concerned (AP-096).

The checker runs the commands from the criteria itself on the current files where possible.
Any item not passed is a FAIL with a list: the requirement number, the letter of the item,
what is wrong. PASS — the requirement is ready to be worked on.

**Step 3 — ORCH.** Checks that the checker went through all items (а)–(е), includes the
checked requirement in the iteration plan (`PLAN.md`) and tells the owner about it in the
report. It does not wait for a separate approval, but the owner may stop the work on the
requirement — then nobody works on it until the owner decides otherwise. The status of the
requirement stays `pending`: WF-01 only confirms that the requirement is fit. ORCH moves it
to `in_progress` when the work on it starts (WF-02, step 0).

If a process error is found in a separate WF-01 run, DOC-UPDATER records it in
`docs/anti-patterns.md` — with a separate handoff of this run (`step-03-doc-updater.json`);
ORCH checks the record (Q13). In such a run DOC-UPDATER also records what the owner's answers
produced: `STATE.md`, `PLAN.md`, decisions. If WF-01 goes as the first steps of a larger run,
the error is recorded by the bookkeeping of that run.

## Micro-amendment after the code design

It happens that the code design, the gates or the tests of WF-02 showed that a criterion
cannot be met, is wrong or names a file that does not exist (examples: criterion 5 of REQ-056
against the order of REQ-057, criterion 10 of REQ-057, criterion 1 of REQ-068 about "any pair
of surrogates"). Then ORCH starts a short separate WF-01 run (`<LABEL>-<date>-NN`), and the
development continues after its PASS.

- REQ-ANALYST edits only the named criteria and the description, without weakening them; in
  `result.before_copy` — the "before" lines of every edit from the tag, in `result.changes` —
  what it was and what it became.
- REQ-VALIDATOR checks the whole block by (а)–(е), the meaning of the edits and that the rest
  of the file did not change (a hash before and after, `git diff` with the tag); the gate is
  short, but the items are the same.
- DOC-UPDATER in WF-02, step 10, may correct in the requirement block a name, a reference, a
  number or an outdated fact without changing the meaning, with `before_copy` in `result`
  (`decisions/0079`, item 5). Any change of the meaning of a criterion is only this
  micro-amendment with the REQ-VALIDATOR gate.

## Gates

Step 2 (REQ-VALIDATOR). Until there is a PASS, work on the requirement does not start: no
design, no research, no code (AP-010).

## Artifacts

| Step | Who | What |
|---|---|---|
| 1 | REQ-ANALYST | the block `REQ-NNN` in `docs/requirements.yaml` |
| 2 | REQ-VALIDATOR | the `result` of its handoff: PASS or FAIL with a list |
| 3 | ORCH | the requirement in the iteration plan (`PLAN.md`), the report to the owner |
| 3 | DOC-UPDATER | a record in `docs/anti-patterns.md`, if a process error is found |
| 0–3 | ORCH | handoffs in `handoffs/<RUN-ID>/` |

## Handoffs

- `workflow_id`: `"WF-01"`, or the workflow of the whole run if WF-01 goes as its first steps.
- File names, serial numbers of steps and the form of rework steps — see
  `docs/workflows/handoffs.md`. A rework step gets the next letter of the step, not the suffix
  `-rN`.

## Rework loop

- FAIL → REQ-ANALYST reworks only by the list of remarks (a new handoff with the next letter
  of the step, with the table "what was fixed, where"); findings beyond the list go as a
  question in `result.issues` (AP-019). Then step 2 again.
- No more than **three gate passes**: the first and two repeats after a FAIL
  (`decisions/0079`, item 4). If the same remark came back after a rework step, the next
  attempt changes the approach and does not repeat the previous one.
- An edit of a requirement after PASS is also a separate handoff and a new check of step 2
  (the micro-amendment, the section above); if this check gives a FAIL, the pass counts toward
  the limit.
- A new launch after an interruption (`-runN`) does not count as a rework step.

## Stop conditions

- **Done:** PASS of step 2, ORCH checked the check, included the requirement in the iteration
  plan and sent the report to the owner.
- **Stopped by the owner:** the owner stopped the work on the requirement — ORCH removes it
  from the iteration plan; the requirement stays `pending`.
- **Stopped:** the third gate pass gave a FAIL again. ORCH writes to the owner what was
  proposed, what did not pass and why; nobody works on the requirement until the owner
  decides.
- **Stopped:** the statement of the requirement demands lowering the bar or going against a
  record in `decisions/` — a question to the owner (quality-bar §1, §6).

## Report to the owner

Short and in plain words: which requirement appeared or changed (number and title), what it
promises in one or two sentences, how many criteria it has and how they are checked, on which
attempt the check passed, what is next (which workflow will go on it) and what the owner has
to decide, if there is anything to decide.
