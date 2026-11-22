# 0121 — Five defects of an external security review (ISS-0119 … ISS-0123): how they are taken

Status: **accepted** (ORCH, 2026-11-18, on a request relayed to ORCH by another local Claude session of the owner as his word; points О3 and О7 wait for the owner's own answer in this session; the owner can cancel each point).

## Question

An external security review of Sai, relayed on 2026-11-18, names five defects. DOC-UPDATER recorded them as ISS-0119 … ISS-0123 (`handoffs/SECREG-20261118-01/step-01-doc-updater.json`) and found, by reading, that every named place holds what the review says, that one defect has the cause of an open defect, and that four are recorded accepted residual risks. How are they taken, in which order, and what needs the owner?

## Options

For the language: the task's words or `decisions/0080`. For ISS-0120: its own run, or one run with ISS-0037. For the accepted risks: fix on the relayed words, or ask the owner first.

## Decision

- **О1 (DOC-UPDATER issue I1).** The task's «in Russian» was ORCH's slip: `decisions/0080` item 2 (new issues in English, with the Russian field names of the sample) is above the task; the five files follow the recent sample.
- **О2 (issue I2).** ISS-0120 has the cause of the open ISS-0037 (prepare-run follows a symbolic link of a source); the review's new fact (a cloned repository is enough to bring the link) removes the reason ISS-0037 gave for LOW. One WF-03 run for ISS-0120 also closes ISS-0037: its diagnosis covers both, and its step 10 closes both files with a line that names the other.
- **О3 (issue I3).** ISS-0119, ISS-0121, ISS-0122 and ISS-0123 are recorded accepted residual risks (ISS-0119: `decisions/0015` and the design of REQ-010; ISS-0121: the residual risks of REQ-102 accepted by the owner on 2026-10-28 and `decisions/0105` item 6; ISS-0122: `decisions/0025` W2 and `decisions/0011`; ISS-0123: the design of REQ-001, section 7.3). A fix of an accepted risk needs the owner's word and a decision record before its design (quality-bar §6 item 7, Q12). The relayed request counts as that word once the owner confirms it in this session; ORCH asks him. ISS-0120 has no acceptance (`decisions/0042` left the read out) and needs no such word.
- **О4 (issue I4).** The replay of a signed note (`POST /api/note` with no time window) is the same kind of hole; it stays in ISS-0123, and its diagnosis decides the severity or a separate number.
- **О5 (issues I5-I7).** The header comment of `tools/src/web/server.js` that says Origin and the key are checked before any read goes to the diagnosis of ISS-0122; the review's advice `SAI_TEAM_WEB=0` turns off only the web tools of the researcher, not the Team Web page, and the page key alone does not close a local read (`GET /` hands it to any local process) — both are told to the owner.
- **О6 (order).** The runs share the two agent slots with the remaining M0 steps. ISS-0120 (with ISS-0037) starts first, at the next free slot after the M0 steps already queued; then, after the owner's answer, ISS-0119, ISS-0121, ISS-0122, ISS-0123 in that order; ISS-0119, ISS-0120 and ISS-0121 are closed before the public release. Each is a WF-03 run with the usual gates; ISSUE-FIXER re-checks every statement of the review at its diagnosis. No commit or push without the owner's word.
- **О7 (an owner question).** The default of `SAI_PIXEL_OFFICE_STORE_TEXT` (today the request texts are stored unless it is `0`) is the owner's choice; it is decided in the run of ISS-0122.

## Why

The review's statements were checked by reading before any work; the accepted risks were accepted by the owner, so only he can reopen them; the defect without an acceptance starts at once.

## Boundary

Only ISS-0119 … ISS-0123 and ISS-0037. No code is changed by this record.

## Basis

The relayed request of 2026-11-18 (PROGRESS, tables «Finding → defect» rows EXT-1 … EXT-5 and «Open problems»); `handoffs/SECREG-20261118-01/step-01-doc-updater.json`; `docs/issues/ISS-0037-prepare-run-reads-sources-through-symlink.md`; decisions 0011, 0015, 0025, 0042, 0080, 0105; `docs/quality-bar.md` §6 item 7.
