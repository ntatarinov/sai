# 0136 — ORCH's answers to the open questions of the M2 lane B requirements (REQ-118 … REQ-120, the REQ-111 criterion 3 exception) and of the ISS-0132 criteria of REQ-110

Status: **accepted** (ORCH, 2026-11-23, under the owner's delegation of technical decisions, decisions/0134; the owner can cancel each answer by a word). Host and money questions are named as the owner's and not answered here.

## Question

REQ-ANALYST wrote REQ-118 (R2.5 job queue and worker API), REQ-119 (R2.6 the worker as a Linux container), REQ-120 (backup and its rehearsal) and the exception of REQ-111 criterion 3 for the consent keys at step 01 lane-b of the run M2ACCT-20261123-01, and the criteria 12-19 of REQ-110 (the supported platforms) at step 02 of the run ISS-0132-20261123-01. The open questions are in the two handoffs (result.issues). The blocks are written on the recommended answers.

## Decision — M2 lane B (О1-О16 of step 01 lane-b)

Every recommended answer is taken:

- **О1** The provider contract and the frozen registry live in the worker (`app/worker/providers/`, codes `api` and `scripted`, one conformance suite over every registered code); `claude-cli` and the core registry come with R3.3 and R1.5.
- **О2** `owner-local` (the subscription) is left out of V1 and named as left out: the worker modes are `api` and `fake` only.
- **О3** Every worker token of V1 is `host` until R7.1 proves the egress and credential proxies, so no build of another organisation is claimed before then. **Addition (the path of the first client):** R7.1 (the credential and egress proxy of the container) is on the path of the first client's build and comes right after M4, before the first invitation of a client (decisions/0134 item 3).
- **О4** Secrets in the container only from files (Docker secrets or a file the owner names); a secret in the environment is refused at start.
- **О5** The owner builds the image himself from `app/Dockerfile.worker` at the released commit; CI proves the same Dockerfile; no registry in V1.
- **О6** CI proves linux/amd64; arm64 is added when the owner moves to a Mac.
- **О7** The idle exit stays (default 60 minutes) and the compose file does not restart the worker; a worker always on for a client is the owner's host decision (G15) together with the Neon plan, raised when the first client is invited.
- **О8** A closed registry of the result schemas of the text kinds in `app/public/shared/ai/schemas.js`; REQ-118 registers a first `interview_turn`; a kind without a schema is never enqueued, claimed or completed.
- **О9** Events, files, artifacts and the session part of a lost lease wait for R3.3 and M4.
- **О10** The kill switch route stays in M4 (before the first real build); until then the STOP file, stopping the container, revoking the worker token and `SITE_GATE`.
- **О11** A section «Исполнители» in the admin pages (list, create with the token shown once, revoke; re-auth), built in M2.4 in turns with lane A on the shared files (PLAN §4.7).
- **О12** The pinned Claude Code CLI joins the image with R3.3; until then the worker never lists `build`.
- **О13** `db-verify` reads its URLs only from `SAI_VERIFY_A_URL` and `SAI_VERIFY_B_URL`; an address in argv is refused; a row of «Plan amendments».
- **О14** The backup before the first deploy of 0002 is a Neon restore point made by the owner by the runbook (and a logical dump when Docker runs on his machine); the rehearsal itself is proved in CI.
- **О15** REQ-120 is built in task M2.2 together with REQ-114 and REQ-115.
- **О16** The amended text of REQ-111 criterion 3 (only the exact deletion-term phrase per language is taken out, once) rules. The wider sentence in the description of REQ-116 is aligned to it in this WF-01 run if REQ-VALIDATOR asks; it never widens the exception.

## Decision — ISS-0132, REQ-110 criteria 12-19 (О1-О8 of step 02)

- **О1** REQ-110 goes to `in_progress` when the fix starts (ORCH, at step 03 of ISS-0132-20261123-01) and back to `done` by DOC-UPDATER after the RELEASE-VALIDATOR PASS.
- **О2** The e2e runner refuses on an unsupported platform too (its kit stops processes by a process group).
- **О3** `--help` is answered on an unsupported platform as on a supported one (as for the Node floor).
- **О4** The refusal line is Russian only, with the English gloss in tools/README.md, like the other refusals of the tools.
- **О5** The title of REQ-110 is widened by a later micro-amendment («… and the supported platforms Linux and macOS (defect ISS-0132)»), done with the bookkeeping of this run.
- **О6** Criterion 17 (the mode is read back after chmod) is taken.
- **О7** The residual `O_NOFOLLOW ?? 0` of the thin-client tools is the LOW defect ISS-0144, not a criterion here.
- **О8** The anti-pattern entry (a protection that depends on the OS falls back silently to «pass») is written by DOC-UPDATER at step 10.

## Why

The recommended answers keep the worker to what the first client's path needs, keep every real model run behind G2 and G6, and keep no secret where a process list or a compose file shows it. The one answer that changes the order of work (О3: R7.1 right after M4) follows from the goal of decisions/0133.

## Basis

`handoffs/M2ACCT-20261123-01/step-01-req-analyst-lane-b.json` and `handoffs/ISS-0132-20261123-01/step-02-req-analyst.json` (result.issues); decisions/0127, 0133, 0134, 0135; PLAN §4.7, §5 M2, M7; ARCHITECTURE §8, §9, §14.8, §20.4.
