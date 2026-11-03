# 0108 — Conventions of the real-Chrome e2e kit (answers to the open questions О1–О9 of the design of REQ-104)

Status: **accepted** (ORCH, 2026-11-03, inside the owner's word of the same day: «Делай что считаешь нужным, мне главное получить правки верные»; the owner can cancel each point).

## Question

The design `docs/design/REQ-104-e2e-chrome-kit.md` (section 19) leaves nine questions for ORCH (WF-02, step 1a). They must be closed before the gate CODE-DESIGN-VALIDATOR.

## Options

For each point the design names a default (section 19) and what it costs. The alternatives are in that table; no point is closed by a guess outside it.

## Decision

- **О1.** The kit has no starter of server processes. REQ-105 designs the first one (`tools/test/e2e/kit/stand.js`); REQ-106 and REQ-107 reuse it. REQ-104 gives only `makeTempDir`, `removeTempDir`, `assertUnderTempRoot`.
- **О2.** Page code is passed as strings only; `eslint.config.js` is not changed.
- **О3.** Confirmed: the runner stops at the first failing spec file; a file that hangs is ended after 120 s; a file with no test, or with `skipped`/`todo` above 0, fails (Q4, Q6).
- **О4.** Confirmed: the hash comparison of the blocks REQ-014 and REQ-033 in criterion 13 stays; those two blocks are not edited in this run. If the owner's answers about them come inside the run, the comparison is moved to the new tag by a micro-amendment of WF-01.
- **О5.** Accepted: the Chrome argument `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`. Its Linux behaviour is read by the run of criterion 10.
- **О6.** The stand-in program `tools/test/fixtures/e2e/fake-chrome.js` is written by BACKEND-DEV in sub-step 3 (a stand, as in the design of REQ-056); the tests that use it are written by TEST-DESIGNER.
- **О7.** (a) Accepted: after a `SIGKILL` of the runner Chrome processes may stay; no sweeper of old `sai-e2e-*` folders is added. (b) NOT decided in advance: if the run of criterion 10 shows that Chrome on `ubuntu-24.04` does not start with its sandbox, the requirement says BLOCKED with a question to the owner; a runner setting is not changed without his word. (c) The root README sentence «about 2 minutes» is out of date; DOC-UPDATER notes it as a defect candidate, it is not part of this work.
- **О8.** Kept: key presses, network records with response bodies, `reload` and a second tab are part of the kit API (REQ-105 and REQ-107 need them), with the tests SMK-09 and SMK-11 under criterion 3.
- **О9.** (extended 2026-11-03 after the second pass of gate 1b, finding F15: the pending REQ-040 has the same sentence at lines near 5502 and 5566; it is corrected by DOC-UPDATER in the same way as REQ-038, or, because it is `pending`, by REQ-ANALYST in a micro-amendment of WF-01 — ORCH chooses at step 10.) The words of the done REQ-038 («the check ends with `npm run test`», lines near 5266–5268 and 5313 of `docs/requirements.yaml`) become out of date when `check` gets a sixth step. DOC-UPDATER corrects them at step 10 as an outdated fact without a change of meaning, with `before_copy` (`decisions/0079`, item 5), and RELEASE-VALIDATOR checks it. If DOC-UPDATER finds that the meaning of a criterion changes, it stops and ORCH starts a micro-amendment of WF-01 with the REQ-VALIDATOR gate.

## Why

Each answer is the default of the designer where the default keeps the work inside the criteria of REQ-104 (Q5) and inside the bar (Q4, Q6); the two points that need the owner's power (О7b, the change of a runner setting) are left open on purpose.

## Boundary

Only the run E2E104-20261103-01 and the kit of REQ-104. It does not decide REQ-033, REQ-014 or the runner setting of О7b, and it does not change `decisions/0107`.

## Basis

The owner's words of 2026-11-03: «Делай что считаешь нужным, мне главное получить правки верные»; `decisions/0107`; the design `docs/design/REQ-104-e2e-chrome-kit.md`, section 19.

## Addendum 2026-11-03 (ORCH, WF-02 steps 3 and 4 of the run E2E104-20261103-01)

Four points found while building, accepted by the reviewers and by ORCH; DOC-UPDATER carries them into the design at step 10:

- The kit waits 100 ms after the load event in `goto` and `reload`: without it Chrome drops the favicon console line when a second navigation starts at once (measured by BACKEND-DEV: lost in 1 of 8 starts; with the wait 20 of 20 starts gave exactly one line).
- The stand-in program gets the mode `ok-ignore-term` (for the SIGKILL escalation test E2K-17, because `hang-ignore-term` prints no port line), and the modes `bad-json`, `error-object`, `no-answer` make `launchBrowser` itself reject; the tests E2K-13/14/15 use `cdp.connect` on the stand-in port line for the pending-call cases.
- The Chrome argument `--no-proxy-server` is added to the argument list (finding F3 of SECURITY-REVIEWER: with a proxy on a loopback address foreign names get out and the resolver rule alone does not confine the browser). It keeps criterion 5 true; the Linux behaviour is read by the run of criterion 10.
- Page and browser text that goes into errors and the log is escaped (control characters, a line start `::` of workflow commands) and bounded (finding F2 of SECURITY-REVIEWER).
