// W01-W54 and W13b (design REQ-002 §9.4, ISS-0002): the write phase of apply-verdict is
// all or nothing. Every row builds its own fixture (a state of §9.2 in a temporary
// folder, never the real project), puts one obstacle or one injected failure in the way,
// runs the real CLI as a separate process with a time limit and checks A1-A6 of §9.3;
// the rows with a SIGKILL check K1-K4. The name of each test starts with its row.
//
// States: RF recommend, first application; RR recommend, repeated, all three targets
// stale unless the row says otherwise; EF escalate, first application.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { applyVerdict } from "../src/apply.js";
import { sha256 } from "../src/util.js";
import {
  PROPOSED_REL as PA,
  REPORT_REL as AR,
  RUN_ID,
  RUN_REL,
  STATE_REL as ST,
  assertApplyConverges,
  assertFixtureRoot,
  assertTargetBytes,
  checks,
  cleanTargets,
  commitFaults,
  fileSpec,
  firstHalf,
  interrupted,
  leftoverLine,
  leftoversIn,
  listing,
  listingInChild,
  lock,
  makeFifo,
  makeOutside,
  makeSocket,
  newFileMode,
  oldOf,
  readTargets,
  recordFs,
  refusal,
  removeAfter,
  runApplyCli,
  stateEF,
  stateRF,
  stateRR,
  success,
  tempOf,
  undoAll,
  writeLine,
  writeNewFault,
} from "./helpers.js";

const NOTHING = "nothing was changed";
const APPLIED = "applied recommend\n";

// ---- small builders of obstacles, each returns the function that takes it away --------

function folderAt(abs, { inner = false } = {}) {
  fs.rmSync(abs, { recursive: true, force: true });
  fs.mkdirSync(abs);
  if (inner) fs.writeFileSync(path.join(abs, "inner.txt"), "inside");
  return removeAfter(abs);
}

function linkAt(abs, text) {
  fs.rmSync(abs, { recursive: true, force: true });
  fs.symlinkSync(text, abs);
  return () => fs.unlinkSync(abs);
}

// What the listing of a replaced target has to look like: the clean bytes and the
// permission bits it had; its time is not compared (it cannot be known in advance).
function replacedBy(clean, before, ...rels) {
  return Object.fromEntries(
    rels.map((rel) => [rel, fileSpec(clean.files[rel], before.get(rel).mode)]),
  );
}

// ---- controls: no obstacle, the strict listing has to change exactly as stated --------

test("W01 RF control: the first application replaces STATE.md and creates proposed-actions.json and apply-report.json", () => {
  const fx = stateRF();
  const clean = cleanTargets("RF");
  success({
    root: fx.root,
    run: () => runApplyCli(fx.root, fx.runDir),
    stdout: APPLIED,
    delta: (before) => {
      // new files get the mode the OS gives a file this test makes itself in <R>
      const mode = newFileMode(fx.runDir);
      return {
        replaced: replacedBy(clean, before, ST),
        added: {
          [PA]: fileSpec(clean.files[PA], mode),
          [AR]: fileSpec(clean.files[AR], mode),
        },
      };
    },
  });
});

test("W02 RR control: the repeated application replaces all three targets", () => {
  const fx = stateRR();
  const clean = cleanTargets("RF");
  success({
    root: fx.root,
    run: () => runApplyCli(fx.root, fx.runDir),
    stdout: APPLIED,
    delta: (before) => ({ replaced: replacedBy(clean, before, ST, PA, AR) }),
  });
});

test("W03 EF control: escalation replaces STATE.md, creates apply-report.json and no proposed-actions.json", () => {
  const fx = stateEF();
  const clean = cleanTargets("EF");
  success({
    root: fx.root,
    run: () => runApplyCli(fx.root, fx.runDir),
    stdout: "applied escalate\n",
    delta: (before) => ({
      replaced: replacedBy(clean, before, ST),
      added: { [AR]: fileSpec(clean.files[AR], newFileMode(fx.runDir)) },
    }),
    verify: (c) =>
      c.run("A5 proposed-actions.json does not exist", () =>
        assert.equal(fs.existsSync(fx.proposed), false),
      ),
  });
});

test("W04 RR control: only STATE.md is stale, the two other targets are not touched (bytes and time)", () => {
  const fx = stateRR({ stale: ["state"] });
  const clean = cleanTargets("RF");
  success({
    root: fx.root,
    run: () => runApplyCli(fx.root, fx.runDir),
    stdout: APPLIED,
    delta: (before) => ({ replaced: replacedBy(clean, before, ST) }),
  });
});

test("W05 RR control: STATE.md with mode 0600 keeps it when it is replaced", () => {
  const fx = stateRR();
  const clean = cleanTargets("RF");
  success({
    root: fx.root,
    setup: () => lock(fx.state, 0o600),
    run: () => runApplyCli(fx.root, fx.runDir),
    stdout: APPLIED,
    delta: (before) => ({ replaced: replacedBy(clean, before, ST, PA, AR) }),
    verify: (c) =>
      c.run("A5 STATE.md has mode 0600", () =>
        assert.equal(listing(fx.root).get(ST).mode, "0600"),
      ),
  });
});

// ---- the target is a folder, a link or not a regular file (W1.2) -----------------------

test("W06 RF: proposed-actions.json is an empty folder", () => {
  const fx = stateRF();
  refusal({
    root: fx.root,
    setup: () => folderAt(fx.proposed),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(PA, `is a folder (EISDIR); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W07 RF: apply-report.json is an empty folder", () => {
  const fx = stateRF();
  refusal({
    root: fx.root,
    setup: () => folderAt(fx.report),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(AR, `is a folder (EISDIR); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W08 RR: apply-report.json is a folder with a file inside", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => folderAt(fx.report, { inner: true }),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(AR, `is a folder (EISDIR); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W09 EF: apply-report.json is an empty folder", () => {
  const fx = stateEF();
  refusal({
    root: fx.root,
    setup: () => folderAt(fx.report),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(AR, `is a folder (EISDIR); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("EF")),
  });
});

test("W10 RF: apply-report.json is a dangling symbolic link", () => {
  const fx = stateRF();
  refusal({
    root: fx.root,
    setup: () => linkAt(fx.report, "missing/x"),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(AR, `is a symbolic link (ELOOP); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W11 RR: apply-report.json is a link to a stale copy outside the root, which stays as it is", () => {
  const fx = stateRR();
  const copy = path.join(makeOutside(), "apply-report.json");
  refusal({
    root: fx.root,
    extra: [copy],
    setup: () => {
      fs.copyFileSync(fx.report, copy);
      return linkAt(fx.report, copy);
    },
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(AR, `is a symbolic link (ELOOP); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W12 RR: STATE.md is a link to docs/STATE-real.md inside the root", () => {
  const fx = stateRR();
  const real = path.join(fx.root, "docs", "STATE-real.md");
  refusal({
    root: fx.root,
    setup: () => {
      fs.renameSync(fx.state, real);
      fs.symlinkSync("docs/STATE-real.md", fx.state);
      return () => {
        fs.unlinkSync(fx.state);
        fs.renameSync(real, fx.state);
      };
    },
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(ST, `is a symbolic link (ELOOP); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

// ---- a folder on the way to the target is a link (W1.1) --------------------------------

test("W13 RF: runs/<RUN-ID> is a link to the run folder moved outside the root, which stays as it is", () => {
  const fx = stateRF();
  const moved = path.join(makeOutside(), RUN_ID);
  const why = `folder ${RUN_REL} is a symbolic link (ELOOP); ${NOTHING}`;
  refusal({
    root: fx.root,
    extra: [moved],
    setup: () => {
      fs.renameSync(fx.runDir, moved);
      fs.symlinkSync(moved, fx.runDir);
      return () => {
        fs.unlinkSync(fx.runDir);
        fs.renameSync(moved, fx.runDir);
      };
    },
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(PA, why), writeLine(AR, why)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W13b RF: runs is a link to the whole runs folder moved outside the root, which stays as it is", () => {
  const fx = stateRF();
  const runs = path.join(fx.root, "runs");
  const moved = path.join(makeOutside(), "runs");
  const why = `folder runs is a symbolic link (ELOOP); ${NOTHING}`;
  refusal({
    root: fx.root,
    extra: [moved],
    setup: () => {
      fs.renameSync(runs, moved);
      fs.symlinkSync(moved, runs);
      return () => {
        fs.unlinkSync(runs);
        fs.renameSync(moved, runs);
      };
    },
    run: () => runApplyCli(fx.root, fx.runDir),
    // STATE.md does not go through runs: no line for it
    lines: [writeLine(PA, why), writeLine(AR, why)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

// ---- leftovers of an interrupted or concurrent run (W1.3) ------------------------------

test("W14 RR: a leftover .STATE.md.sai-tmp makes the command refuse", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => {
      fs.writeFileSync(tempOf(fx.state), "left by an interrupted run");
      return removeAfter(tempOf(fx.state));
    },
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [leftoverLine(ST, tempOf(ST))],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W15 nothing is stale: a leftover .apply-report.json.sai-old still makes the command refuse", () => {
  const fx = stateRR({ stale: [] });
  refusal({
    root: fx.root,
    setup: () => {
      fs.writeFileSync(oldOf(fx.report), "left by an interrupted run");
      return removeAfter(oldOf(fx.report));
    },
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [leftoverLine(AR, oldOf(AR))],
    converge: () =>
      assertApplyConverges(fx, cleanTargets("RF"), { alreadyNew: true }),
  });
});

// ---- the target cannot be read, is read-only (W1.4, W1.6) ------------------------------

// Relies on file permissions being enforced, i.e. the suite does not run as root.
test("W16 RR: proposed-actions.json with mode 000 cannot be read for comparison", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => lock(fx.proposed, 0o000),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      writeLine(PA, `cannot be read for comparison (EACCES); ${NOTHING}`),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W17 RR: apply-report.json with mode 000 cannot be read for comparison", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => lock(fx.report, 0o000),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      writeLine(AR, `cannot be read for comparison (EACCES); ${NOTHING}`),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W18 RR: STATE.md with mode 000 is refused before the write phase with E_STATE_ANCHOR", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => lock(fx.state, 0o000),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      "E_STATE_ANCHOR STATE.md: STATE.md missing, not a file or unreadable",
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W19 RR: STATE.md with mode 444 is read-only and must change", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => lock(fx.state, 0o444),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(ST, `is read-only and must change (EACCES); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W20 RR: proposed-actions.json with mode 444 is read-only and must change", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => lock(fx.proposed, 0o444),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(PA, `is read-only and must change (EACCES); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W21 RR: apply-report.json with mode 444 is read-only and must change", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => lock(fx.report, 0o444),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(AR, `is read-only and must change (EACCES); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W22 RR control: a read-only proposed-actions.json that does not need to change is not touched", () => {
  const fx = stateRR({ stale: ["state", "report"] });
  const clean = cleanTargets("RF");
  success({
    root: fx.root,
    setup: () => lock(fx.proposed, 0o444),
    run: () => runApplyCli(fx.root, fx.runDir),
    stdout: APPLIED,
    // proposed-actions.json: mode 0444, bytes and time as before (not named here)
    delta: (before) => ({ replaced: replacedBy(clean, before, ST, AR) }),
  });
});

test("W23 RF: every violation is listed in the order of the targets, a folder and a read-only STATE.md", () => {
  const fx = stateRF();
  refusal({
    root: fx.root,
    setup: () => undoAll(folderAt(fx.proposed), lock(fx.state, 0o444)),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      writeLine(PA, `is a folder (EISDIR); ${NOTHING}`),
      writeLine(ST, `is read-only and must change (EACCES); ${NOTHING}`),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

// ---- a folder is read-only (W2: the temporary file cannot be created) -------------------

test("W24 RF: <R> with mode 555, proposed-actions.json would be created there", () => {
  const fx = stateRF();
  refusal({
    root: fx.root,
    setup: () => lock(fx.runDir, 0o555),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      writeLine(
        PA,
        `cannot write the temporary file ${tempOf(PA)} (EACCES); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W25 EF: <R> with mode 555, apply-report.json would be created there", () => {
  const fx = stateEF();
  refusal({
    root: fx.root,
    setup: () => lock(fx.runDir, 0o555),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      writeLine(
        AR,
        `cannot write the temporary file ${tempOf(AR)} (EACCES); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("EF")),
  });
});

test("W26 RR: <R> with mode 555, the targets in it need to change: a new refusal, no write in place", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => lock(fx.runDir, 0o555),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      writeLine(
        PA,
        `cannot write the temporary file ${tempOf(PA)} (EACCES); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W27 RR control: <R> with mode 555 and nothing to change in it is no obstacle", () => {
  const fx = stateRR({ stale: ["state"] });
  const clean = cleanTargets("RF");
  success({
    root: fx.root,
    setup: () => lock(fx.runDir, 0o555),
    run: () => runApplyCli(fx.root, fx.runDir),
    stdout: APPLIED,
    // nothing in <R> changes (not named here), only STATE.md in the root
    delta: (before) => ({ replaced: replacedBy(clean, before, ST) }),
  });
});

test("W28 RF: the root with mode 555, the temporary file of STATE.md cannot be created (those of the two other targets were made and removed)", () => {
  const fx = stateRF();
  refusal({
    root: fx.root,
    setup: () => lock(fx.root, 0o555),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      writeLine(
        ST,
        `cannot write the temporary file ${tempOf(ST)} (EACCES); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W29 RR: the root with mode 555, the temporary file of STATE.md cannot be created (temporary files and backups of the two other targets were made and removed)", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => lock(fx.root, 0o555),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      writeLine(
        ST,
        `cannot write the temporary file ${tempOf(ST)} (EACCES); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

// ---- the OS refuses to write the new bytes (W2.1) ----------------------------------------

test("W30 RR: the new bytes of STATE.md are written in part, then ENOSPC", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [writeNewFault(fx.state, "partial", "ENOSPC")],
      }),
    lines: [
      writeLine(
        ST,
        `cannot write the temporary file ${tempOf(ST)} (ENOSPC); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W31 RR: the new bytes of proposed-actions.json are written in part, then EFBIG", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [writeNewFault(fx.proposed, "partial", "EFBIG")],
      }),
    lines: [
      writeLine(
        PA,
        `cannot write the temporary file ${tempOf(PA)} (EFBIG); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W32 RR: the new bytes of apply-report.json are written in part, then EIO", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [writeNewFault(fx.report, "partial", "EIO")],
      }),
    lines: [
      writeLine(
        AR,
        `cannot write the temporary file ${tempOf(AR)} (EIO); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W33 EF: the new bytes of apply-report.json are written in part, then ENOSPC", () => {
  const fx = stateEF();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [writeNewFault(fx.report, "partial", "ENOSPC")],
      }),
    lines: [
      writeLine(
        AR,
        `cannot write the temporary file ${tempOf(AR)} (ENOSPC); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("EF")),
  });
});

test("W34 RR: a real EFBIG, the command runs under ulimit -f 1 and the new STATE.md is larger than the limit", () => {
  const fx = stateRR({ bigState: true });
  // The premise of the row: `ulimit -f 1` allows 1024 bytes in the /bin/sh of macOS and
  // 512 in dash, so only the new STATE.md may be above the limit.
  const sizes = cleanTargets("RF", { bigState: true }).files;
  assert.ok(
    Buffer.byteLength(sizes[ST]) > 2048,
    "the new STATE.md must exceed 2 KiB",
  );
  assert.ok(
    Buffer.byteLength(sizes[PA]) < 512,
    "proposed-actions.json must stay below 512 bytes",
  );
  assert.ok(
    Buffer.byteLength(sizes[AR]) < 512,
    "apply-report.json must stay below 512 bytes",
  );
  refusal({
    root: fx.root,
    run: () => runApplyCli(fx.root, fx.runDir, { ulimitF: 1 }),
    lines: [
      writeLine(
        ST,
        `cannot write the temporary file ${tempOf(ST)} (EFBIG); ${NOTHING}`,
      ),
    ],
    converge: () =>
      assertApplyConverges(fx, cleanTargets("RF", { bigState: true })),
  });
});

test("W35 RR control: no target is ever written in place (a failure injected at a write to any of the three would show)", () => {
  const fx = stateRR();
  const clean = cleanTargets("RF");
  success({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [fx.state, fx.proposed, fx.report].map((abs) => ({
          fn: "writeFileSync",
          paths: [abs],
          effect: "throw",
          code: "EIO",
        })),
      }),
    stdout: APPLIED,
    delta: (before) => ({ replaced: replacedBy(clean, before, ST, PA, AR) }),
  });
});

// ---- the other steps of the preparation (W2.2) -------------------------------------------

test("W36 RR: the permissions cannot be copied to .STATE.md.sai-tmp, EPERM", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [
          {
            fn: "chmodSync",
            paths: [tempOf(fx.state)],
            effect: "throw",
            code: "EPERM",
          },
        ],
      }),
    lines: [
      writeLine(
        ST,
        `cannot copy the permissions to ${tempOf(ST)} (EPERM); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W37 RR: the hard link .STATE.md.sai-old to the old STATE.md cannot be made, EPERM", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [
          {
            fn: "linkSync",
            from: fx.state,
            to: oldOf(fx.state),
            effect: "throw",
            code: "EPERM",
          },
        ],
      }),
    lines: [
      writeLine(
        ST,
        `cannot keep the old version as ${oldOf(ST)} (EPERM); ${NOTHING}`,
      ),
    ],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W38 RR: another process creates .apply-report.json.sai-tmp first, its file is neither overwritten nor removed", () => {
  const fx = stateRR();
  const foreign = "held by another process\n";
  refusal({
    root: fx.root,
    setup: () => removeAfter(tempOf(fx.report)),
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [
          {
            fn: "writeFileSync",
            paths: [tempOf(fx.report)],
            effect: "preempt",
          },
        ],
      }),
    lines: [leftoverLine(AR, tempOf(AR))],
    // the listing as before plus the other process's file, as it was written
    delta: () => ({
      added: {
        [tempOf(AR)]: {
          type: "f",
          mode: newFileMode(fx.runDir),
          size: Buffer.byteLength(foreign),
          sha: sha256(foreign),
        },
      },
    }),
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

// ---- the commit of a target fails (W3): the earlier ones are rolled back -----------------

test("W39 RR: the commit of proposed-actions.json fails, EIO", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: commitFaults(fx.proposed, "throw", "EIO"),
      }),
    lines: [writeLine(PA, `cannot be replaced (EIO); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W40 RR: the commit of apply-report.json fails, EIO: proposed-actions.json is given back (same bytes, same time)", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: commitFaults(fx.report, "throw", "EIO"),
      }),
    lines: [writeLine(AR, `cannot be replaced (EIO); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W41 RR: the commit of STATE.md fails, EIO: both other targets are given back", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: commitFaults(fx.state, "throw", "EIO"),
      }),
    lines: [writeLine(ST, `cannot be replaced (EIO); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W42 RF: the commit of STATE.md fails, EIO: the created proposed-actions.json and apply-report.json are removed", () => {
  const fx = stateRF();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: commitFaults(fx.state, "throw", "EIO"),
      }),
    lines: [writeLine(ST, `cannot be replaced (EIO); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W43 EF: the commit of STATE.md fails, EIO: the created apply-report.json is removed and proposed-actions.json never appears", () => {
  const fx = stateEF();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: commitFaults(fx.state, "throw", "EIO"),
      }),
    lines: [writeLine(ST, `cannot be replaced (EIO); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("EF")),
  });
});

// ---- double failures and the failure of the cleanup ------------------------------------

test("W44 RR: ENOSPC on the new bytes of STATE.md, and the half-written .STATE.md.sai-tmp cannot be removed, EIO", () => {
  const fx = stateRR();
  const clean = cleanTargets("RF");
  const half = firstHalf(clean.files[ST]);
  refusal({
    root: fx.root,
    setup: () => removeAfter(tempOf(fx.state)),
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [
          writeNewFault(fx.state, "partial", "ENOSPC"),
          {
            fn: "unlinkSync",
            paths: [tempOf(fx.state)],
            effect: "throw",
            code: "EIO",
          },
        ],
      }),
    lines: [
      writeLine(
        ST,
        `cannot write the temporary file ${tempOf(ST)} (ENOSPC); no target was changed; leftovers are listed next`,
      ),
      writeLine(
        tempOf(ST),
        "could not remove this temporary file (EIO); delete it by hand",
      ),
    ],
    // the listing as before plus the leftover with the first half of the new data
    delta: () => ({
      added: {
        [tempOf(ST)]: {
          type: "f",
          mode: newFileMode(fx.root),
          size: Buffer.byteLength(half),
          sha: sha256(half),
        },
      },
    }),
    converge: () => assertApplyConverges(fx, clean),
  });
});

test("W45 RR: the commit of STATE.md fails, EIO, and so does the rollback of proposed-actions.json", () => {
  const fx = stateRR();
  const clean = cleanTargets("RF");
  refusal({
    root: fx.root,
    setup: () => removeAfter(oldOf(fx.proposed)),
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [
          ...commitFaults(fx.state, "throw", "EIO"),
          {
            fn: "renameSync",
            from: oldOf(fx.proposed),
            to: fx.proposed,
            effect: "throw",
            code: "EIO",
          },
        ],
      }),
    lines: [
      writeLine(
        ST,
        "cannot be replaced (EIO); rollback incomplete; see the next lines",
      ),
      writeLine(
        PA,
        `rollback failed (EIO); it holds the new content, the old content is in ${oldOf(PA)}`,
      ),
    ],
    // proposed-actions.json holds the new bytes; its backup is the old file itself (a hard
    // link: every field, the time too); apply-report.json was given back completely
    delta: (before) => ({
      replaced: replacedBy(clean, before, PA),
      added: { [oldOf(PA)]: { ...before.get(PA), path: oldOf(PA) } },
    }),
    converge: () => assertApplyConverges(fx, clean),
  });
});

test("W46 RR: everything is applied, then .STATE.md.sai-old cannot be removed, EIO: the command still fails and names it", () => {
  const fx = stateRR();
  const clean = cleanTargets("RF");
  refusal({
    root: fx.root,
    setup: () => removeAfter(oldOf(fx.state)),
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [
          {
            fn: "unlinkSync",
            paths: [oldOf(fx.state)],
            effect: "throw",
            code: "EIO",
          },
        ],
      }),
    lines: [
      writeLine(
        oldOf(ST),
        "applied, but this backup of the old version could not be removed (EIO); delete it by hand",
      ),
    ],
    // the three targets are new; the leftover is the old STATE.md itself (every field)
    delta: (before) => ({
      replaced: replacedBy(clean, before, ST, PA, AR),
      added: { [oldOf(ST)]: { ...before.get(ST), path: oldOf(ST) } },
    }),
    converge: () => assertApplyConverges(fx, clean, { alreadyNew: true }),
  });
});

// ---- the process is killed (SIGKILL) -----------------------------------------------------

test("W47 RR: SIGKILL when apply-report.json is committed: proposed-actions.json is new, the others old; the next run refuses", () => {
  const fx = stateRR();
  const clean = cleanTargets("RF");
  const old = readTargets(fx);
  interrupted({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: commitFaults(fx.report, "kill"),
      }),
    k2: () =>
      assertTargetBytes(fx, {
        proposed: ["new", clean.files[PA]],
        report: ["old", old.report],
        state: ["old", old.state],
      }),
    rerun: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      leftoverLine(PA, oldOf(PA)),
      leftoverLine(AR, tempOf(AR), oldOf(AR)),
      leftoverLine(ST, tempOf(ST), oldOf(ST)),
    ],
    remove: [
      oldOf(fx.proposed),
      tempOf(fx.report),
      oldOf(fx.report),
      tempOf(fx.state),
      oldOf(fx.state),
    ],
    converge: () => assertApplyConverges(fx, clean),
  });
});

test("W48 RR: SIGKILL in the middle of writing the new bytes of STATE.md: all three targets are old; the next run refuses", () => {
  const fx = stateRR();
  const clean = cleanTargets("RF");
  const old = readTargets(fx);
  interrupted({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [writeNewFault(fx.state, "partial-kill")],
      }),
    k2: () =>
      assertTargetBytes(fx, {
        proposed: ["old", old.proposed],
        report: ["old", old.report],
        state: ["old", old.state],
      }),
    rerun: () => runApplyCli(fx.root, fx.runDir),
    lines: [
      leftoverLine(PA, tempOf(PA), oldOf(PA)),
      leftoverLine(AR, tempOf(AR), oldOf(AR)),
      leftoverLine(ST, tempOf(ST)),
    ],
    remove: [
      tempOf(fx.proposed),
      oldOf(fx.proposed),
      tempOf(fx.report),
      oldOf(fx.report),
      tempOf(fx.state),
    ],
    converge: () => assertApplyConverges(fx, clean),
  });
});

// ---- a program error is not an OS error (no E_WRITE, the trace stays) -------------------

test("W49 RR: a program error (TypeError) at the commit of STATE.md is not turned into E_WRITE; rollback is done", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    crash: true,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [
          {
            fn: "renameSync",
            from: tempOf(fx.state),
            to: fx.state,
            effect: "bug",
          },
        ],
      }),
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

// ---- lstat fails (W1) ---------------------------------------------------------------------

test("W50 RR: lstat of STATE.md fails, EIO: it is reported, not taken for 'there is no STATE.md'", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [
          { fn: "lstatSync", paths: [fx.state], effect: "throw", code: "EIO" },
        ],
      }),
    lines: [writeLine(ST, `cannot be checked (EIO); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

// ---- the target is not a regular file: a pipe, a socket (W1.2 before W1.4) ---------------

test("W51 RF: apply-report.json is a pipe: refused at once, the command does not hang on reading it", () => {
  const fx = stateRF();
  refusal({
    root: fx.root,
    // a pipe is in the root: a hanging listing must fail this row, not freeze the file
    list: listingInChild,
    setup: () => makeFifo(fx.report),
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(AR, `is not a regular file (EINVAL); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

test("W52 RR: proposed-actions.json is a socket", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    setup: () => {
      fs.rmSync(fx.proposed);
      return makeSocket(fx.proposed);
    },
    run: () => runApplyCli(fx.root, fx.runDir),
    lines: [writeLine(PA, `is not a regular file (EINVAL); ${NOTHING}`)],
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});

// ---- every temporary file is flushed to disk before the first rename ---------------------

test("W53 RR control, in this process: fsyncSync is called once per temporary file, all before the first renameSync", () => {
  const fx = stateRR();
  assertFixtureRoot(fx.root);
  const calls = recordFs(["openSync", "fsyncSync", "renameSync"]);
  let result;
  try {
    result = applyVerdict(fx.root, fx.runDir);
  } finally {
    calls.restore();
  }
  const syncs = calls.events.filter((e) => e.fn === "fsyncSync");
  const renames = calls.events.filter((e) => e.fn === "renameSync");
  const firstRename = calls.events.findIndex((e) => e.fn === "renameSync");
  const lastSync = calls.events.map((e) => e.fn).lastIndexOf("fsyncSync");
  const c = checks();
  c.run("RESULT the call succeeds", () => {
    assert.deepEqual(result.issues.list, []);
    assert.equal(result.changed, 3);
  });
  c.run("LEFTOVERS no entry of the write phase is left", () =>
    assert.deepEqual(leftoversIn(listing(fx.root)), []),
  );
  // the exact count is needed: with no call at all "all before the first rename" holds
  c.run("FSYNC-COUNT fsyncSync is called exactly once per temporary file", () =>
    assert.deepEqual(
      syncs.map((e) => e.path),
      [tempOf(fx.proposed), tempOf(fx.report), tempOf(fx.state)],
    ),
  );
  c.run("RENAME-COUNT renameSync is called exactly three times", () =>
    assert.equal(renames.length, 3),
  );
  c.run(
    "FSYNC-ORDER all fsyncSync calls come before the first renameSync",
    () =>
      assert.ok(
        lastSync < firstRename,
        "an fsyncSync call follows a renameSync",
      ),
  );
  c.done();
});

// ---- a program error while the first check runs (W1) -------------------------------------

test("W54 RR: a program error (TypeError) in the check of STATE.md is not turned into an E_WRITE violation", () => {
  const fx = stateRR();
  refusal({
    root: fx.root,
    crash: true,
    run: () =>
      runApplyCli(fx.root, fx.runDir, {
        faults: [{ fn: "lstatSync", paths: [fx.state], effect: "bug" }],
      }),
    converge: () => assertApplyConverges(fx, cleanTargets("RF")),
  });
});
