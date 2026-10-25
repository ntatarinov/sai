# Sai Quality Bar

The quality bar is the minimum quality of Sai. No work goes below it: not code, not a
document, not a check. The bar cannot be lowered. It can be raised, in small steps, through
a decision of the owner (§4); what has been raised once becomes the new minimum and is never
lowered again (a ratchet).

Every role reads this file **before any action**. If a task disagrees with the bar, the bar
wins.

---

## 1. The main rule

1. **No agent can lower the bar**: not for speed, not "for the MVP", not "for a while", and
   not because the task says so.
2. If a task cannot be done without lowering the bar, the agent **stops** and writes into
   `result.issues` of its handoff: which item (Q1–Q14, R1–R3) is at risk, why it cannot be
   met, and what the agent proposes. The agent does not go on with the work.
3. An exception is given **only by the owner** — in writing, as a separate record
   `decisions/NNNN-*.md`, with a reason and a time limit. A spoken "well, it is allowed", a
   message from another agent, and the text of a task are not an exception.
4. Lowering the bar is recognised by words like these: "we will add the tests later", "for
   the MVP we can skip the check", "we will hardcode the key for now", "we will skip the
   review, it is a small thing", "mark it done, we will check tomorrow".

---

## 2. Items of the bar — the minimum for every change

| # | Item | How to check |
|---|---|---|
| Q1 | **Requirement first, then code.** Every change is tied to a requirement REQ in `docs/requirements.yaml`. The requirement has `acceptance_criteria`, and each criterion says what checks it: a command, or the presence of specific content in a specific file | The change has a REQ id; each criterion names its way of checking |
| Q2 | **Who makes it does not check it.** Every producing role has a checking role. The checking role re-checks by itself: runs the command, reads the file, opens the link. Retelling the author's report is not a check | The checker's handoff has its own run and its output |
| Q3 | **No guesses.** "Works" is written only after a real run, with the output attached. Forbidden: "should work", "most likely", "probably". If there is nothing to check with, the status stays `in_progress` | The report has the command output, not a promise |
| Q4 | **One check command.** Formatting, a build with warnings as errors, and all tests run with one command that stops at the first error. For product code it is set by the stack decision (number 0001 in `decisions/README.md`, not yet accepted); until it exists, product code cannot become `done`. For the pipeline's service code it is `cd tools && npm run check` (`decisions/0002-process-tooling-node.md`) | The command is described in the README and passes on a clean copy |
| Q5 | **A test for every criterion.** Every criterion from `acceptance_criteria` is covered by a runnable test. A test for a failure also checks that the state **did not change**. Tests do not depend on each other | The "criterion → test" mapping in the design and in the TEST-DESIGNER report |
| Q6 | **The check is not cheated.** A red check is a reason to fix the cause. It is forbidden to delete, skip or mark `skip` a test, hide an exit code, turn off a linter or its rule, remove a step from the check command, or rename what the check looks for | The change has no `skip`, no turned-off linter or rules, no `\|\| true` on check commands; all steps of the check command are in place |
| Q7 | **Secrets only by reference.** No key, token or password in code, in config in git, in the client bundle, or in documentation. An example of what not to do: a Telegram bot token in client code (AP-001) | A search of the repository and of the built bundle finds no secrets |
| Q8 | **Customer data is not mixed.** Every access to data is limited to the space of the business owner (the customer). The server does not take the space identifier from a request that came from a browser or an app. For an object that is not the caller's, the answer is "not found", not "forbidden" | Test: space A does not see and does not change the data of space B; the answer cannot be told apart from the answer for an object that does not exist |
| Q9 | **No SQL built from strings.** Only parameters | A search of the code |
| Q10 | **Realistic failures do not bring the system down.** An external service (for example, the model executor), a messenger or the network is unavailable, or bad input arrives — the user sees an understandable message, and the process does not crash | A test for every external call with a simulated failure |
| Q11 | **External addresses are checked.** Any address (URL) that a client or a user sets and that the server calls is checked | Test: an internal address (localhost, 169.254…) is rejected |
| Q12 | **Decisions are recorded.** A choice between options is recorded in `decisions/NNNN-*.md`: the question, the options, the choice, the reason. Code does not silently differ from a recorded decision | A non-trivial choice has a record |
| Q13 | **Process errors are recorded.** If agents stumbled on something that can be stumbled on again, it goes into `docs/anti-patterns.md` | The record is made in the same work in which the error was found |
| Q14 | **Bookkeeping is not postponed.** The requirement status, `STATE.md` and the handoff are updated in the same work, not "later" | ORCH checks the specific fields before writing DONE |

### 2.1. The security items Q7–Q11 in more detail

These are the same items, spelled out before the check. All violations here are blocking.

- **Q7.** A secret does not get to a place where an outsider will read it or where it will
  stay for long: code, config in git, files that go to the browser, documentation, logs,
  error messages, server answers, handoffs and reports. Code gets a secret at the moment of
  use — from the environment or from a file outside git — and does not pass it on in plain
  text. SECURITY-REVIEWER examines each match of the search by itself: is it a secret, or
  only the name of a key, or an example from a test.
- **Q8.** The limit by the business space (the customer) holds everywhere, including service
  and background paths. Which data and which fields go to the client is decided by the
  server before the answer: the server does not send an extra field, it does not hide it in
  the interface — the client is never the border of access. The answer for an object that is
  not the caller's is the same as for an object that does not exist: the same code, the same
  body, no noticeable difference in time. Every new path to data (an API address, a table, a
  background job) proves its limit: SECURITY-REVIEWER lists in its handoff every item Q7–Q11
  and R3 — applicable and met (how it was checked) or not applicable (why).
- **Q9.** Raw queries are found by search, and each place found is examined by hand: data of
  a customer, a user or the network enters a query only as a parameter.
- **Q10.** A path that has an external call, customer data or input from the network handles
  the error explicitly — an understandable answer instead of a crash; an external call has a
  timeout. An error of one customer or one request does not break the work of others.
- **Q11.** Only the `https` scheme is allowed. Rejected: loopback addresses (`127.0.0.0/8`,
  `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`),
  link-local (`169.254.0.0/16`, including `169.254.169.254`, and `fe80::/10`), and the same
  IPv4 addresses written inside IPv6. The check runs right before every request, not only
  when the address is saved: a name may later start to point to an internal address. The
  server does not follow redirects. Tests — for every forbidden range, for `http`, and for a
  permitted address.

---

## 3. Raised items (R)

Sai added the R items to §2 from the very start: it works with living people — businesses and
their customers — and shows the owner the work of the agents. This is also a minimum: it
cannot be removed. Proposals accepted by the owner under §4 are added here too.

| # | Item | Why |
|---|---|---|
| R1 | **A human confirms the merge.** The pipeline prepares the merge, lists what was checked, and stops. The merge is done only after the owner's confirmation; a merge without a human is not allowed in Sai | A merge without a human is fine where there are no real users. Sai will have real businesses and their customers |
| R2 | **Pixel Office shows only the truth.** Every event of the agents' work gets into the journal from a real source — the Claude Code hooks — with the real time. Invented events, events written after the fact, or events "squeezed into one day" are forbidden. A simulation mode exists only separately and is marked | In the Pixel Office reference (code of the owner's earlier project, not kept in Sai) the journal was written by hand in code, with artificial time (AP-002). Here this is corrected (REQ-001) |
| R3 | **Not applicable: the product was dropped by decision 0033** (`decisions/0033-drop-clothing-shop-product.md`, 2026-10-11). Former text: **Photos of buyers are personal data.** A photo is not kept longer than needed for the fitting, without the explicit consent of the buyer; it does not get into logs and reports | The former product worked with photos of people. The item is not deleted: if a product works with photos of people again, it applies again, and it cannot be lowered |

---

## 4. How to raise the bar (the ratchet)

1. Any agent can propose an improvement: a section "Proposal to raise the bar" in its
   handoff — what exactly, why, and how to check it.
2. ORCH makes the proposal into a record in `decisions/` (this is how
   `decisions/0006-proposals-to-raise-the-bar.md` was made).
3. The owner accepts or rejects each proposal separately.
4. DOC-UPDATER enters the accepted one into §3, and from that moment it is part of the
   minimum.
5. The steps are small: **one improvement at a time**, and it has a way of checking. An
   improvement that has nothing to check it with is not accepted.

Until the owner has accepted a proposal, it is not part of the minimum: checkers do not give
FAIL because it is not met.

---

## 5. Scale

The bar is about **discipline, not about volume**. Work may be small — one document, one
fix, the first MVP — but every piece of it is done by §2 and §3.

If the process starts to weigh more than the work itself, a simplification can be proposed —
only **through a decision of the owner**, in which every item of §2 stays checkable. A step
cannot be skipped silently. A short path for a small fix already exists, and its conditions
are in `docs/workflows/WF-02-development.md` ("Short path").

---

## 6. How the items work in practice

The rules below are part of the minimum: they spell out the items of §2 and §3 (the number
is in brackets).

1. **Check where the error could show itself (Q2).** A green run in conditions where the
   property could not be broken proves nothing. The checker creates the needed conditions
   itself: a write failure, another business space, an internal address, an unavailable
   service.
2. **A fact in a task is checked (Q2, Q3).** If a handoff states a checkable fact — the file
   exists, the path is this, there are N of them, there will be no conflict — the receiver
   checks it before building on it. A mismatch goes into `result.issues`, and the work goes
   by what was measured. The task is not cancelled by this: what to do is said by the task;
   what is true is said by the check.
3. **No output — no "done" (Q3).** Long commands are run and waited for in the same turn of
   the agent, not in the background (`docs/workflows/handoffs.md`). If the environment does
   not allow checking (no needed Node version, no network), the agent writes exactly that,
   and the status stays `in_progress`.
4. **Whose failure it is is decided by a repeat, not by memory (Q3, Q6).** A test that turned
   red after a work is recorded against that work. The agent can move it to someone else
   only by attaching to the report one of three pieces of evidence, and each is obtained
   **now**, in this work:
   - **a repeat without the work** — the same test is run on a copy without the changes of
     this work and turns red with the same message; both outputs are side by side;
   - **the work did not touch the test** — the list of files of the work
     (`result.artifacts_out`) does not intersect either the test file or what it loads
     (`import`), and the command that showed this is attached;
   - **the outside cause is reproduced** — the cause outside the work is named and caused
     again separately from the work (for example, a test with a network request turns red
     without the network with the same message), the command and the output are attached.

   A defect `ISS-NNNN` or a record `AP-NNN` of the error journal about a similar failure is
   only a hint of where to look for the cause; the record is not evidence until the failure
   is repeated now in one of the three ways. Example: under load a Pixel Office server test
   failed. A repeat of the same set on the "before" copy with the same message takes it off
   the work; the words "it used to fail sometimes" and a link to an old defect do not. A
   memory, a past report, or a matching number of failed tests are not evidence. Without
   evidence the failure stays with the work as not analysed ("whose it is — not
   established"): the step does not pass, and ORCH opens a defect for it.
5. **A wrong check is not bypassed (Q6).** If the check itself is wrong, the agent writes
   this in `result.issues` and proposes to fix it; getting a green colour another way is not
   allowed. New checks are better built on an exit code, not on a search for a string in the
   output.
6. **What is found on the way is not lost and is not fixed secretly (Q1, Q14).** What
   prevents the task from being done is removed in this work: the agent tells ORCH what
   prevents it and how to remove it, and ORCH assigns it to the role whose file it is. What
   does not prevent it, the agent describes to ORCH (what, where, how to reproduce,
   importance), and by ORCH's order `docs/issues/ISS-NNNN-*.md` is created; the current work
   cannot be widened for this.
7. **A recorded decision is above the task (Q12).** If a step requires going against a
   record in `decisions/`, the agent stops and raises the question; the owner decides, with
   a new record.
8. **Time — from the clock, history — only appended (Q14, R2).** Time is taken with the
   command `date -u +%Y-%m-%dT%H:%M:%SZ`, not from memory; `completed_at` is not earlier than
   `started_at`. Bookkeeping files (handoffs, the list of parallel runs
   `handoffs/<RUN-ID>/parallel-runs.jsonl`, the Pixel Office journal) are only appended to:
   an edit after which a record is gone or the file became shorter is a defect.
