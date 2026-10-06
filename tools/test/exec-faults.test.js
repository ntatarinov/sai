// Tests of disk failures of the commands of the executors (design REQ-010, section
// 15.1: EX-39, EX-40; criterion 15; checklist Q10). A failure of the operating system
// is real (a folder without the right to write) or injected by fault-inject.js; only
// the fake executable is started.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  FAULT_PATH,
  describeRun,
  execEnv,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  runTeam,
  snapshot,
  stateOf,
  types,
  writePlan,
} from "./exec-helpers.js";

test("EX-39 new without the right to write into the data folder: E_DISK (EACCES) in Russian, no stack, nothing created", (t) => {
  const sb = makeSandbox(t);
  const existing = makeProject(sb);
  const before = snapshot(sb.home);
  const names = fs.readdirSync(sb.home).sort();
  // Not root: only this temporary folder, by its own name (AP-020), read and search,
  // no write (EACCES). Root ignores modes, so there the data folder is a path inside a
  // plain file (ENOTDIR): the data folder cannot be used, E_HOME, no stack, nothing
  // created, no skipping.
  const asRoot = process.getuid() === 0;
  const env = execEnv(sb);
  if (asRoot) {
    const plain = path.join(sb.root, "plain-file");
    fs.writeFileSync(plain, "x");
    env.SAI_TEAM_HOME = path.join(plain, "team");
  } else {
    fs.chmodSync(sb.home, 0o500);
  }
  const expected = asRoot
    ? "E_HOME: Папка данных Sai Team недоступна: ENOTDIR"
    : "E_DISK: Не удалось записать на диск (EACCES)";
  let r;
  try {
    r = runTeam(["new", "--goal", "Вымышленная цель", "--budget", "1"], env);
  } finally {
    if (!asRoot) fs.chmodSync(sb.home, 0o700);
  }
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(r.stdout, "");
  assert.ok(r.stderr.startsWith(expected), r.stderr);
  assert.doesNotMatch(r.stderr, /\n\s+at |Uncaught/u);
  assert.equal(r.stderr.trim().split("\n").length, 1);
  assert.deepEqual(fs.readdirSync(sb.home).sort(), names);
  assert.equal(
    fs.readdirSync(sb.home).filter((n) => n.startsWith(".creating-")).length,
    0,
  );
  // The mode of the folder changed back; compare the rest of the snapshot.
  const after = snapshot(sb.home);
  assert.deepEqual({ ...after, ".": before["."] }, before);
  assert.equal(stateOf(sb, existing.id).tasks.length, 1);
});

test("EX-40 EIO while writing a result file: E_DISK (EIO), files/ without the file and without .partial, no RESULT_FILE, the task is failed, the journal grows only by whole lines", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    default: {
      stream: "stream-ok.jsonl",
      work_files: [{ path: "report.md", content: "Итог работы\n" }],
      answer_files: ["report.md"],
    },
  });
  const p = makeProject(sb);
  const oldBytes = fs.readFileSync(p.events);
  const faults = [
    {
      fn: "writeFileSync",
      paths: [path.join(p.files, ".partial-t-0001-1-report.md")],
      effect: "throw",
      code: "EIO",
    },
  ];
  const r = runTeam(
    ["run-task", p.id, p.task],
    execEnv(sb, { SAI_TEST_FAULTS: JSON.stringify(faults) }),
    ["--import", FAULT_PATH],
  );
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^E_DISK: Не удалось записать на диск \(EIO\)/u);
  assert.doesNotMatch(r.stderr, /\n\s+at |Uncaught/u);
  assert.deepEqual(fs.readdirSync(p.files), []);
  const events = journal(p);
  assert.equal(ofType(events, "RESULT_FILE").length, 0);
  assert.equal(ofType(events, "TASK_REVIEW").length, 0);
  const failed = ofType(events, "TASK_FAILED");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].data.reason, "result_file");
  assert.equal(
    failed[0].data.detail,
    "Не удалось записать файл результата на диск",
  );
  assert.equal(stateOf(sb, p.id).tasks[0].status, "failed");
  // The earlier bytes of the journal are the same; after them only whole lines.
  const now = fs.readFileSync(p.events);
  assert.ok(now.subarray(0, oldBytes.length).equals(oldBytes));
  assert.equal(now.at(-1), 0x0a);
  assert.ok(types(events).includes("RUN_FINISHED"));
  assert.equal(ofType(events, "RUN_FINISHED")[0].data.outcome, "failed");
  assert.deepEqual(ofType(events, "RUN_FINISHED")[0].data.files, []);
  // The source stays: it was not accepted.
  assert.equal(fs.existsSync(path.join(p.work, "report.md")), true);
});
