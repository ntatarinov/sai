import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  BAR,
  RUN_ID,
  makeProject,
  runDirOf,
  tree,
  validRun,
} from "./helpers.js";

const CLI = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "cli.js",
);

function run(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

// The command fails with the design's exit code and error line, prints no stack
// trace, and no file under `dir` is changed, added or removed.
function failsCleanly(dir, exitCode, line, command) {
  const before = tree(dir);
  const r = command();
  assert.equal(r.code, exitCode, r.err);
  assert.match(r.err, line);
  assert.doesNotMatch(r.err, /^\s+at /m, "stderr has a stack trace");
  assert.equal(tree(dir), before, "no file may be changed, added or removed");
}

test("validate: missing artifact is exit 1 with E_JSON", () => {
  const { root, runDir } = validRun();
  fs.rmSync(path.join(runDir, "response-market.json"));
  const r = run("validate", runDir, "--root", root);
  assert.equal(r.code, 1);
  assert.match(r.err, /^E_JSON response-market\.json:/m);
});

test("apply-verdict: latest review REJECT below version 3 is exit 1 with E_NOT_ACCEPTED", () => {
  const { root, runDir } = validRun((a) => {
    a["verdict-review-1.json"].decision = "REJECT";
    a["verdict-review-1.json"].issues = ["доработать"];
  });
  const r = run("apply-verdict", runDir, "--root", root);
  assert.equal(r.code, 1);
  assert.match(r.err, /^E_NOT_ACCEPTED /m);
});

test("unknown command: exit 2, E_USAGE", () => {
  const r = run("frobnicate");
  assert.equal(r.code, 2);
  assert.match(r.err, /^E_USAGE/);
});

test("validate: missing run folder is exit 2", () => {
  const root = makeProject();
  assert.equal(
    run("validate", path.join(root, "runs", RUN_ID), "--root", root).code,
    2,
  );
});

test("validate: folder outside runs/ is exit 2", () => {
  const root = makeProject();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sai-outside-"));
  assert.equal(run("validate", outside, "--root", root).code, 2);
});

test("validate: broken JSON is exit 1 with E_JSON and no stack trace", () => {
  const { root, runDir } = validRun();
  fs.writeFileSync(path.join(runDir, "run.json"), "{");
  const r = run("validate", runDir, "--root", root);
  assert.equal(r.code, 1);
  assert.match(r.err, /^E_JSON run\.json:/m);
  assert.doesNotMatch(r.err, /^\s+at /m);
});

test("prepare-run prints a seal that validate accepts; valid run exits 0", () => {
  const root = makeProject();
  const p = run(
    "prepare-run",
    RUN_ID,
    "--root",
    root,
    "--candidates",
    "01-alpha,02-beta",
    "--context",
    BAR,
    "--analyst",
    "market=a-m",
    "--analyst",
    "execution=a-e",
    "--analyst",
    "owner_fit=a-o",
    "--judge",
    "judge",
    "--executor",
    "executor",
  );
  assert.equal(p.code, 0, p.err);
  const seal = /^seal ([0-9a-f]{64})$/m.exec(p.out)[1];
  const v = run(
    "validate",
    runDirOf(root),
    "--root",
    root,
    "--stage",
    "run",
    "--seal",
    seal,
  );
  assert.equal(v.code, 0, v.err);
  assert.match(v.out, /^OK WF06-20260925-01 \(stage run\)/);
  assert.equal(
    run(
      "prepare-run",
      RUN_ID,
      "--root",
      root,
      "--candidates",
      "01-alpha,02-beta",
    ).code,
    2,
  );
});

test("apply-verdict: exit 0 then 'unchanged'; invalid run exits 1", () => {
  const { root, runDir } = validRun();
  const first = run("apply-verdict", runDir, "--root", root);
  assert.equal(first.code, 0, first.err);
  assert.match(first.out, /^applied recommend/);
  assert.match(run("apply-verdict", runDir, "--root", root).out, /^unchanged/);
  fs.rmSync(path.join(runDir, "verdict-review-1.json"));
  assert.equal(run("apply-verdict", runDir, "--root", root).code, 1);
});

test("snapshot-diff exit codes", () => {
  const root = makeProject();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sai-snap-"));
  const before = path.join(dir, "before.txt");
  const after = path.join(dir, "after.txt");
  assert.equal(run("snapshot", before, "--root", root).code, 0);
  fs.appendFileSync(path.join(root, "STATE.md"), "\nx\n");
  assert.equal(run("snapshot", after, "--root", root).code, 0);
  assert.equal(
    run("snapshot-diff", before, after, "--allow", "STATE.md").code,
    0,
  );
  const r = run("snapshot-diff", before, after);
  assert.equal(r.code, 1);
  assert.match(r.out, /^changed STATE\.md$/m);
});

test("validate: verdict-1.md that is a folder is exit 1 with E_VERDICT_MD, no stack trace, nothing written", () => {
  const { root, runDir } = validRun();
  const mdPath = path.join(runDir, "verdict-1.md");
  fs.rmSync(mdPath);
  fs.mkdirSync(mdPath);
  failsCleanly(root, 1, /^E_VERDICT_MD verdict-1\.md: /m, () =>
    run("validate", runDir, "--root", root),
  );
});

// Relies on file permissions being enforced, i.e. the suite does not run as root.
test("validate: unreadable verdict-1.md is exit 1 with E_VERDICT_MD, no stack trace, nothing written", () => {
  const { root, runDir } = validRun();
  const mdPath = path.join(runDir, "verdict-1.md");
  failsCleanly(root, 1, /^E_VERDICT_MD verdict-1\.md: /m, () => {
    // put back the mode the file had, not a literal one: under umask 077 it is 0600, and
    // the strict listing of failsCleanly sees the mode
    const mode = fs.statSync(mdPath).mode & 0o7777;
    fs.chmodSync(mdPath, 0o000);
    try {
      return run("validate", runDir, "--root", root);
    } finally {
      fs.chmodSync(mdPath, mode);
    }
  });
});

test("apply-verdict: STATE.md that is a folder is exit 1 with E_STATE_ANCHOR, no stack trace, nothing written", () => {
  const { root, runDir } = validRun();
  const statePath = path.join(root, "STATE.md");
  fs.rmSync(statePath);
  fs.mkdirSync(statePath);
  failsCleanly(root, 1, /^E_STATE_ANCHOR STATE\.md: /m, () =>
    run("apply-verdict", runDir, "--root", root),
  );
});

test("snapshot-diff: a folder instead of a snapshot file is exit 2 with E_USAGE, no stack trace, nothing written", () => {
  const root = makeProject();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sai-snap-"));
  const before = path.join(dir, "before.txt");
  const after = path.join(dir, "after.txt");
  assert.equal(run("snapshot", before, "--root", root).code, 0);
  fs.mkdirSync(after);
  failsCleanly(dir, 2, /^E_USAGE: /, () => run("snapshot-diff", before, after));
});
