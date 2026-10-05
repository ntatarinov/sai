import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { sha256 } from "../src/util.js";
import { validateRun } from "../src/validate.js";
import {
  ALPHA,
  assertCode,
  readRunJson,
  runDirOf,
  validRun,
  writeRunJson,
} from "./helpers.js";

function runStage(root) {
  return validateRun(root, runDirOf(root), { stage: "run" });
}

test("the fixture run is valid at every stage", () => {
  const { root, runDir, seal } = validRun();
  const result = validateRun(root, runDir, { stage: "review", seal });
  assert.deepEqual(result.issues.list, []);
});

test("E_JSON: run.json missing", () => {
  const { root } = validRun();
  fs.rmSync(path.join(runDirOf(root), "run.json"));
  assertCode(runStage(root), "E_JSON");
});

test("E_SHAPE: unexpected top-level field", () => {
  const { root } = validRun();
  writeRunJson(root, { ...readRunJson(root), extra: 1 });
  assertCode(runStage(root), "E_SHAPE");
});

test("E_RUN_ID: run_id differs from the folder", () => {
  const { root } = validRun();
  writeRunJson(root, { ...readRunJson(root), run_id: "WF06-20260925-02" });
  assertCode(runStage(root), "E_RUN_ID");
});

test("E_CANDIDATE: fewer than two candidates", () => {
  const { root } = validRun();
  writeRunJson(root, { ...readRunJson(root), candidates: ["01-alpha"] });
  assertCode(runStage(root), "E_CANDIDATE");
});

test("E_DUPLICATE: candidate repeated", () => {
  const { root } = validRun();
  writeRunJson(root, {
    ...readRunJson(root),
    candidates: ["01-alpha", "01-alpha", "02-beta"],
  });
  assertCode(runStage(root), "E_DUPLICATE");
});

test("E_SOURCE_PATH: ideas/README.md as a source", () => {
  const { root } = validRun();
  const run = readRunJson(root);
  run.sources.push({
    path: "ideas/README.md",
    original_sha256: "x",
    clean_sha256: "x",
  });
  writeRunJson(root, run);
  assertCode(runStage(root), "E_SOURCE_PATH");
});

test("E_SOURCE_CHANGED: cleaned copy edited", () => {
  const { root } = validRun();
  fs.appendFileSync(
    path.join(runDirOf(root), "sources", ALPHA),
    "\nПриписка.\n",
  );
  assertCode(runStage(root), "E_SOURCE_CHANGED");
});

test("E_SOURCE_CHANGED: copy and its clean_sha256 edited together while the original is unchanged", () => {
  const { root } = validRun();
  const copyPath = path.join(runDirOf(root), "sources", ALPHA);
  const forged = `${fs.readFileSync(copyPath, "utf8")}\nПодложная строка для цитаты.\n`;
  fs.writeFileSync(copyPath, forged);
  const run = readRunJson(root);
  run.sources.find((s) => s.path === ALPHA).clean_sha256 = sha256(forged);
  writeRunJson(root, run);
  assertCode(runStage(root), "E_SOURCE_CHANGED");
});

test("an original edited after step 0 does not invalidate the run", () => {
  const { root, runDir } = validRun();
  fs.appendFileSync(path.join(root, ALPHA), "\nНовая строка после прогона.\n");
  assert.deepEqual(validateRun(root, runDir).issues.list, []);
});

test("E_ROSTER: labels not distinct", () => {
  const { root } = validRun();
  const run = readRunJson(root);
  run.roster.executor = run.roster.judge;
  writeRunJson(root, run);
  assertCode(runStage(root), "E_ROSTER");
});

test("E_SOURCE_CHANGED: a cleaned copy replaced by a folder is reported, not thrown", () => {
  const { root } = validRun();
  const copyPath = path.join(runDirOf(root), "sources", ALPHA);
  fs.rmSync(copyPath);
  fs.mkdirSync(copyPath);
  assertCode(runStage(root), "E_SOURCE_CHANGED");
});

// Relies on file permissions being enforced, i.e. the suite does not run as root.
test("E_SOURCE_CHANGED: an unreadable cleaned copy is reported, not thrown", () => {
  const { root } = validRun();
  const copyPath = path.join(runDirOf(root), "sources", ALPHA);
  // put back the mode the file had, not a literal one (0600 under umask 077)
  const mode = fs.statSync(copyPath).mode & 0o7777;
  fs.chmodSync(copyPath, 0o000);
  try {
    assertCode(runStage(root), "E_SOURCE_CHANGED");
  } finally {
    fs.chmodSync(copyPath, mode);
  }
});

test("E_SEAL: seal mismatch", () => {
  const { root } = validRun();
  const result = validateRun(root, runDirOf(root), {
    stage: "run",
    seal: "0".repeat(64),
  });
  assertCode(result, "E_SEAL");
});
