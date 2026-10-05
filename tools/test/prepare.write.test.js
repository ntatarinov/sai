// P01-P18 (design REQ-002 §9.5, ISS-0002): prepare-run creates the run folder all or
// nothing - it is built under a temporary name and appears with one rename. Every row
// builds its own project in a temporary folder (makeProject(): `runs/` exists unless the
// row removes it), puts one obstacle or one injected failure in the way, runs the real CLI
// as a separate process with a time limit and checks A1-A6 of §9.3; the rows with a
// SIGKILL check K1-K4. The command is always the one of prepareOptions(), `--created-at`
// included, so that a second run produces the same bytes. The name of each test starts
// with its row.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { prepareRun } from "../src/prepare.js";
import { sha256 } from "../src/util.js";
import {
  RUN_ID,
  RUN_REL,
  assertFixtureRoot,
  assertPrepareConverges,
  checks,
  cleanPrepare,
  fileSpec,
  firstHalf,
  interrupted,
  leftoverLine,
  leftoversIn,
  listing,
  lock,
  makeOutside,
  makeProject,
  newDirMode,
  newFileMode,
  prepareOptions,
  readFolder,
  recordFs,
  refusal,
  removeAfter,
  runDirOf,
  runPrepareCli,
  success,
  tempOf,
  writeLine,
} from "./helpers.js";

const NOTHING = "nothing was changed";
const PREPARED = /^prepared WF06-20260925-01\nseal [0-9a-f]{64}\n$/;

// A path in the run folder as the code before the fix writes it (inside <R>) and as the
// fixed code writes it (inside the temporary folder `runs/.<RUN-ID>.sai-tmp`): a fault
// names both, and only the one of the code that runs fires.
function bothWays(root, rel) {
  const runDir = runDirOf(root);
  return [path.join(runDir, rel), path.join(tempOf(runDir), rel)];
}

// Directories above the given files, down from `prefix`, as the entries a listing gets.
function folderSpecs(prefix, files, dirMode, fileMode) {
  const specs = { [prefix]: { type: "d", mode: dirMode } };
  for (const [rel, text] of Object.entries(files)) {
    const parts = rel.split("/");
    for (let i = 1; i < parts.length; i++) {
      specs[`${prefix}/${parts.slice(0, i).join("/")}`] = {
        type: "d",
        mode: dirMode,
      };
    }
    specs[`${prefix}/${rel}`] = fileSpec(text, fileMode);
  }
  return specs;
}

// ---- controls: no obstacle, the strict listing has to change exactly as stated --------

test("P01 control: with runs/ present, prepare-run adds the run folder with its files and nothing else", () => {
  const root = makeProject();
  const clean = cleanPrepare();
  success({
    root,
    run: () => runPrepareCli(root),
    stdout: PREPARED,
    delta: () => ({
      added: folderSpecs(RUN_REL, clean, newDirMode(root), newFileMode(root)),
    }),
    verify: (c, r) =>
      c.run("the printed seal is the sha256 of run.json", () =>
        assert.equal(
          /^seal ([0-9a-f]{64})$/m.exec(r.stdout)[1],
          sha256(clean["run.json"]),
        ),
      ),
  });
});

test("P02 control: with runs/ missing, prepare-run adds runs/ and the run folder with its files and nothing else", () => {
  const root = makeProject();
  const clean = cleanPrepare();
  fs.rmdirSync(path.join(root, "runs"));
  success({
    root,
    run: () => runPrepareCli(root),
    stdout: PREPARED,
    delta: () => ({
      added: {
        runs: { type: "d", mode: newDirMode(root) },
        ...folderSpecs(RUN_REL, clean, newDirMode(root), newFileMode(root)),
      },
    }),
  });
});

// ---- runs is not a folder (P1) -----------------------------------------------------------

test("P03 runs is a regular file", () => {
  const root = makeProject();
  const runs = path.join(root, "runs");
  refusal({
    root,
    setup: () => {
      fs.rmdirSync(runs);
      fs.writeFileSync(runs, "not a folder");
      return () => fs.rmSync(runs);
    },
    run: () => runPrepareCli(root),
    lines: [writeLine("runs", `is not a folder (ENOTDIR); ${NOTHING}`)],
    converge: () => assertPrepareConverges(root),
  });
});

test("P04 runs is a link to a folder outside the root, which stays as it is", () => {
  const root = makeProject();
  const runs = path.join(root, "runs");
  const outside = makeOutside();
  refusal({
    root,
    extra: [outside],
    setup: () => {
      fs.rmdirSync(runs);
      fs.symlinkSync(outside, runs);
      return () => fs.unlinkSync(runs);
    },
    run: () => runPrepareCli(root),
    lines: [writeLine("runs", `is a symbolic link (ELOOP); ${NOTHING}`)],
    converge: () => assertPrepareConverges(root),
  });
});

// ---- the folder is read-only, a leftover is in the way (P1, P2) --------------------------

test("P05 runs/ with mode 555: the temporary folder cannot be created", () => {
  const root = makeProject();
  refusal({
    root,
    setup: () => lock(path.join(root, "runs"), 0o555),
    run: () => runPrepareCli(root),
    lines: [
      writeLine(
        RUN_REL,
        `cannot create the temporary folder ${tempOf(RUN_REL)} (EACCES); ${NOTHING}`,
      ),
    ],
    converge: () => assertPrepareConverges(root),
  });
});

test("P06 a leftover runs/.<RUN-ID>.sai-tmp/ makes the command refuse", () => {
  const root = makeProject();
  const leftover = tempOf(runDirOf(root));
  refusal({
    root,
    setup: () => {
      fs.mkdirSync(leftover);
      return removeAfter(leftover);
    },
    run: () => runPrepareCli(root),
    lines: [leftoverLine(RUN_REL, tempOf(RUN_REL))],
    converge: () => assertPrepareConverges(root),
  });
});

// ---- the OS refuses to write, to create a folder, to rename (P2, P3) ---------------------

test("P07 run.json (after all the copies) is written in part, then ENOSPC", () => {
  const root = makeProject();
  refusal({
    root,
    run: () =>
      runPrepareCli(root, {
        faults: [
          {
            fn: "writeFileSync",
            paths: bothWays(root, "run.json"),
            effect: "partial",
            code: "ENOSPC",
          },
        ],
      }),
    lines: [
      writeLine(`${RUN_REL}/run.json`, `cannot write (ENOSPC); ${NOTHING}`),
    ],
    converge: () => assertPrepareConverges(root),
  });
});

test("P08 runs/ missing: the first copy is written in part, then EIO; neither runs/ nor the temporary folder is left", () => {
  const root = makeProject();
  const runs = path.join(root, "runs");
  const rel = "sources/ideas/01-alpha.md";
  refusal({
    root,
    setup: () => fs.rmdirSync(runs),
    run: () =>
      runPrepareCli(root, {
        faults: [
          {
            fn: "writeFileSync",
            // the fixed code builds it in `.runs.sai-tmp/<RUN-ID>`, beside runs/
            paths: [
              path.join(runDirOf(root), rel),
              path.join(tempOf(runs), RUN_ID, rel),
            ],
            effect: "partial",
            code: "EIO",
          },
        ],
      }),
    lines: [writeLine(`${RUN_REL}/${rel}`, `cannot write (EIO); ${NOTHING}`)],
    converge: () => assertPrepareConverges(root),
  });
});

test("P09 the folder sources/ideas cannot be created, ENOSPC", () => {
  const root = makeProject();
  refusal({
    root,
    run: () =>
      runPrepareCli(root, {
        faults: [
          {
            fn: "mkdirSync",
            paths: bothWays(root, "sources/ideas"),
            effect: "throw",
            code: "ENOSPC",
          },
        ],
      }),
    lines: [
      writeLine(
        `${RUN_REL}/sources/ideas`,
        `cannot create the folder (ENOSPC); ${NOTHING}`,
      ),
    ],
    converge: () => assertPrepareConverges(root),
  });
});

test("P10 the rename of the temporary folder to the run folder fails, EIO", () => {
  const root = makeProject();
  const runDir = runDirOf(root);
  refusal({
    root,
    run: () =>
      runPrepareCli(root, {
        faults: [
          {
            fn: "renameSync",
            from: tempOf(runDir),
            to: runDir,
            effect: "throw",
            code: "EIO",
          },
        ],
      }),
    lines: [writeLine(RUN_REL, `cannot be moved into place (EIO); ${NOTHING}`)],
    converge: () => assertPrepareConverges(root),
  });
});

test("P11 ENOSPC on run.json, and the temporary folder cannot be removed, EIO: it is named and the rest is as before", () => {
  const root = makeProject();
  const runDir = runDirOf(root);
  const clean = cleanPrepare();
  // what the temporary folder holds: the clean copies and run.json with its first half
  const left = { ...clean, "run.json": firstHalf(clean["run.json"]) };
  refusal({
    root,
    setup: () => removeAfter(tempOf(runDir)),
    run: () =>
      runPrepareCli(root, {
        faults: [
          {
            fn: "writeFileSync",
            paths: bothWays(root, "run.json"),
            effect: "partial",
            code: "ENOSPC",
          },
          {
            fn: "rmSync",
            paths: [tempOf(runDir)],
            effect: "throw",
            code: "EIO",
          },
        ],
      }),
    lines: [
      writeLine(
        `${RUN_REL}/run.json`,
        "cannot write (ENOSPC); no target was changed; leftovers are listed next",
      ),
      writeLine(
        tempOf(RUN_REL),
        "could not remove this temporary folder (EIO); delete it by hand",
      ),
    ],
    // the listing as before plus the temporary folder with everything in it; the times
    // of what is in it are not known in advance
    delta: () => ({
      added: folderSpecs(
        tempOf(RUN_REL),
        left,
        newDirMode(root),
        newFileMode(root),
      ),
    }),
    converge: () => assertPrepareConverges(root),
  });
});

// ---- the path of the run folder is taken (E_USAGE, exit code 2) --------------------------

test("P12 the run folder path is a dangling link: E_USAGE with exit code 2, as for an existing folder", () => {
  const root = makeProject();
  const runDir = runDirOf(root);
  refusal({
    root,
    setup: () => {
      fs.symlinkSync("missing-target", runDir);
      return () => fs.unlinkSync(runDir);
    },
    run: () => runPrepareCli(root),
    code: 2,
    lines: [`E_USAGE: run folder already exists: ${RUN_REL}`],
    converge: () => assertPrepareConverges(root),
  });
});

// ---- the process is killed (SIGKILL): the folder is not there, or whole ------------------

test("P13 SIGKILL in the middle of writing run.json: there is no run folder, the temporary folder is left; the next run refuses", () => {
  const root = makeProject();
  const runDir = runDirOf(root);
  const clean = cleanPrepare();
  interrupted({
    root,
    run: () =>
      runPrepareCli(root, {
        faults: [
          {
            fn: "writeFileSync",
            paths: bothWays(root, "run.json"),
            effect: "partial-kill",
          },
        ],
      }),
    k2: () => {
      assert.equal(fs.existsSync(runDir), false, "<R> must not exist");
      // the copies and the first half of run.json
      assert.deepEqual(readFolder(tempOf(runDir)), {
        ...clean,
        "run.json": firstHalf(clean["run.json"]),
      });
    },
    rerun: () => runPrepareCli(root),
    lines: [leftoverLine(RUN_REL, tempOf(RUN_REL))],
    remove: [tempOf(runDir)],
    converge: () => assertPrepareConverges(root),
  });
});

test("P14 SIGKILL when the run folder is put in place: there is no run folder, the temporary one is complete; the next run refuses", () => {
  const root = makeProject();
  const runDir = runDirOf(root);
  const clean = cleanPrepare();
  interrupted({
    root,
    run: () =>
      runPrepareCli(root, {
        faults: [
          // the fixed code: the one rename; the code before the fix: its last write
          {
            fn: "renameSync",
            from: tempOf(runDir),
            to: runDir,
            effect: "kill",
          },
          {
            fn: "writeFileSync",
            paths: [path.join(runDir, "run.json")],
            effect: "kill",
          },
        ],
      }),
    k2: () => {
      assert.equal(fs.existsSync(runDir), false, "<R> must not exist");
      // all the copies and the whole run.json
      assert.deepEqual(readFolder(tempOf(runDir)), clean);
    },
    rerun: () => runPrepareCli(root),
    lines: [leftoverLine(RUN_REL, tempOf(RUN_REL))],
    remove: [tempOf(runDir)],
    converge: () => assertPrepareConverges(root),
  });
});

// ---- a program error is not an OS error (no E_WRITE, the trace stays) -------------------

test("P15 a program error (TypeError) at the rename of the temporary folder is not turned into E_WRITE; the temporary folder is removed", () => {
  const root = makeProject();
  const runDir = runDirOf(root);
  refusal({
    root,
    crash: true,
    run: () =>
      runPrepareCli(root, {
        faults: [
          {
            fn: "renameSync",
            from: tempOf(runDir),
            to: runDir,
            effect: "bug",
          },
        ],
      }),
    converge: () => assertPrepareConverges(root),
  });
});

test("P16 a program error (TypeError) in the check 'something is at the run folder path' is not taken for 'nothing is there'", () => {
  const root = makeProject();
  refusal({
    root,
    crash: true,
    run: () =>
      runPrepareCli(root, {
        faults: [{ fn: "lstatSync", paths: [runDirOf(root)], effect: "bug" }],
      }),
    converge: () => assertPrepareConverges(root),
  });
});

test("P17 a program error (TypeError) in the check of runs (P1) is not turned into an E_WRITE violation", () => {
  const root = makeProject();
  refusal({
    root,
    crash: true,
    run: () =>
      runPrepareCli(root, {
        faults: [
          { fn: "lstatSync", paths: [path.join(root, "runs")], effect: "bug" },
        ],
      }),
    converge: () => assertPrepareConverges(root),
  });
});

// ---- every file is flushed to disk before the rename -------------------------------------

test("P18 control, in this process: fsyncSync is called once per written file, all before the one renameSync", () => {
  const root = makeProject();
  assertFixtureRoot(root);
  const tmp = tempOf(runDirOf(root));
  const calls = recordFs(["openSync", "fsyncSync", "renameSync"]);
  let result;
  try {
    result = prepareRun(root, prepareOptions());
  } finally {
    calls.restore();
  }
  const syncs = calls.events.filter((e) => e.fn === "fsyncSync");
  const renames = calls.events.filter((e) => e.fn === "renameSync");
  const firstRename = calls.events.findIndex((e) => e.fn === "renameSync");
  const lastSync = calls.events.map((e) => e.fn).lastIndexOf("fsyncSync");
  const c = checks();
  c.run("RESULT the call succeeds", () =>
    assert.deepEqual(result.issues.list, []),
  );
  c.run("LEFTOVERS no entry of the write phase is left", () =>
    assert.deepEqual(leftoversIn(listing(root)), []),
  );
  // the exact count is needed: with no call at all "all before the rename" holds
  c.run("FSYNC-COUNT fsyncSync is called exactly once per written file", () =>
    assert.deepEqual(
      syncs.map((e) => e.path),
      [
        path.join(tmp, "sources", "ideas", "01-alpha.md"),
        path.join(tmp, "sources", "ideas", "02-beta.md"),
        path.join(tmp, "sources", "docs", "quality-bar.md"),
        path.join(tmp, "run.json"),
      ],
    ),
  );
  c.run(
    "RENAME-COUNT renameSync is called exactly once: the temporary folder into <R>",
    () =>
      assert.deepEqual(
        renames.map((e) => [e.path, e.to]),
        [[tmp, runDirOf(root)]],
      ),
  );
  c.run("FSYNC-ORDER all fsyncSync calls come before the renameSync", () =>
    assert.ok(lastSync < firstRename, "an fsyncSync call follows the rename"),
  );
  c.done();
});
