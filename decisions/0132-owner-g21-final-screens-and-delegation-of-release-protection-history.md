# 0132 — The owner's «Похоже» on the final screens of REQ-113, his delegation of the release, the branch protection and the public history; ORCH's choices

Status: **accepted** (the owner's words, 2026-11-23, the session on the owner's Windows PC, chat; the choices below are ORCH's under that delegation, the owner can cancel each by a word).

## Question

After the wording round of REQ-113 (decisions/0128) ORCH showed the owner the two screens of the FINAL build (the demo result at 1470×784 and the page «Как это работает» at 390×844; the folder of the six pictures made by DESIGN-QA) and asked four things: (1) «похоже» or «не похоже» (criterion 11), with a confirmation of the reader-pack form (decisions/0131); (2) his «да» to the release of REQ-113 (a push to `main` and the deploy); (3) whether the protection of `main` on GitHub, found OFF by audit AUD-002 (ISS-0130), is switched on again; (4) what to do with the former project's files and the reference product's name in the public history (ISS-0131).

## Owner's words (verbatim)

«Похоже да, остальные пункты 2, 3, 4 решай сам» (2026-11-23, chat).

## Decision

1. **G21, criterion 11 of REQ-113: «Похоже»** on the final screens. The reader-pack form (decisions/0131) is confirmed by the same «да».
2. **The release is delegated.** ORCH releases REQ-113 now: one commit on top of `main` (e0a425b) with the REQ-113 changes of `app/` only (the work line of records, tools and decisions stays off `main` until the release of the records, M0.13), a push to `main`, the check and the app workflows on that exact commit, then the deploy to the production of https://sai-team.vercel.app by the recorded method, the smoke check, and the post-deploy validation. The rule of decision 0048 stays: a push to `main` only after the PASS of RELEASE-VALIDATOR (it was given for this release at step 11 of run M1WORDS-20261122-02).
3. **Branch protection (ISS-0130): switched on again after the release,** with the rules of ISS-0052 and decision 0048: the check `check` is required, no force-push, no deletion of the branch, `enforce_admins` off (the administrator may push directly, R1 is unchanged), no pull request required. Secret scanning, push protection and Dependabot security updates are switched on too (SEC-CI-02, SEC-DOCS-03, SEC-REC-05; they are settings of the public repository and can be switched off again). It is done after the release so that the new rule cannot stop the release commit.
4. **The public history (ISS-0131): the files and the name are to be removed, as a prepared operation and not tonight.** The first commit holds 12 files (2276 lines) of another product under `reference/`, and the name of the reference product stands in six early commits; the repository has been public since 2026-10-13 (decision 0048). That contradicts the owner's rule to read the reference product without leaving a trace, and ORCH cannot judge whose the code is. ORCH chooses to **rewrite the history** (remove `reference/` and the name from all branches and tags, together), because the harm of leaving someone else's code public is larger than the cost of new commit numbers. It is not done at once, because the rewrite changes the number of every later commit, which the records cite (hundreds of references, the deployed version `e0a425b`, the tags `base/*`), and it cannot be undone. So it is its own run: a backup mirror outside the repository first, a rehearsal on a scratch clone with the checks, a table old number → new number kept in the repository, all branches rewritten and pushed together, and the references of the records mapped. Until it is done the defect stays open (HIGH) and nothing is added that makes it worse. The mirror of the owner's Mac is the other backup.

## Why

The owner delegated all three decisions in the same message («решай сам»), as he did on 2026-10-13 for the protection (decision 0048). The release has every gate behind it except his look answer, which is now given. The protection and the scanning are cheap and reversible. The history is the only irreversible item, so it gets a rehearsal first.

## Boundary

This record does not give G2 (real model runs) or any other gate. It does not allow a force-push of any branch before the rehearsal of item 4 has passed and the old → new table exists; deleting the temporary `ci/*` branches stays a separate step (they hold the old numbers too and are rewritten or deleted with the rest in item 4).

## Basis

The owner's chat message of 2026-11-23 quoted above; decisions/0048, 0111, 0128, 0129, 0130, 0131; docs/audits/AUD-002/ (ci, docs and records security reports); ISS-0130, ISS-0131, ISS-0052.
