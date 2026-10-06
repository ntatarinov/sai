// Tests of the work folder and of the result files (design REQ-010, section 15.1:
// EX-41...EX-43; criterion 16; checklist Q7, Q8). Only the fake executable is
// started; the file outside the project is a decoy of the test.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  FIXTURES,
  allFilesText,
  describeRun,
  execEnv,
  fakeStarts,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  runTeam,
  sha256,
  snapshot,
  stateOf,
  types,
  writePlan,
} from "./exec-helpers.js";

const GHP = "ghp_FAKEfake0000000000000000000000000000";
const REFUSED = "Файл результата не найден в рабочей папке или недопустим";

function run(sb, p, over = {}) {
  return runTeam(["run-task", p.id, p.task], execEnv(sb, over));
}

const mode = (p) => fs.lstatSync(p).mode & 0o777;

test("EX-41 a named result file is accepted masked, 0600, its source leaves work/; an unnamed file stays unaccepted", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    default: {
      stream: "stream-ok.jsonl",
      work_files: [
        { path: "report.md", content: `Итог. Ключ ${GHP} в тексте.\n` },
        { path: "extra.md", content: "Черновик, который агент не назвал.\n" },
      ],
      answer_files: ["report.md"],
    },
  });
  const a = makeProject(sb);
  const b = makeProject(sb);
  const r = run(sb, a);
  assert.equal(r.status, 0, describeRun(r));
  // (a) the process works in the work folder of its own project.
  const [start] = fakeStarts(sb);
  assert.equal(fs.realpathSync(start.cwd), fs.realpathSync(a.work));
  assert.notEqual(fs.realpathSync(start.cwd), fs.realpathSync(a.dir));
  assert.notEqual(fs.realpathSync(start.cwd), fs.realpathSync(b.work));
  // (b) the result file.
  assert.deepEqual(fs.readdirSync(a.files), ["t-0001-1-report.md"]);
  const kept = path.join(a.files, "t-0001-1-report.md");
  const text = fs.readFileSync(kept, "utf8");
  assert.match(text, /\[скрыто\]/u);
  assert.equal(text.includes(GHP), false);
  assert.equal(mode(kept), 0o600);
  assert.equal(mode(a.files), 0o700);
  assert.equal(mode(a.dir), 0o700);
  const events = journal(a);
  const rf = ofType(events, "RESULT_FILE");
  assert.equal(rf.length, 1);
  assert.equal(rf[0].data.name, "t-0001-1-report.md");
  assert.equal(rf[0].data.from_work, true);
  assert.deepEqual(ofType(events, "RUN_FINISHED")[0].data.files, [
    "t-0001-1-report.md",
  ]);
  assert.deepEqual(stateOf(sb, a.id).tasks[0].files, ["t-0001-1-report.md"]);
  // The unnamed file is not a result; it stays where the agent left it.
  assert.equal(fs.existsSync(path.join(a.files, "extra.md")), false);
  assert.equal(fs.existsSync(path.join(a.work, "extra.md")), true);
  // The unmasked source is gone: no copy of the key anywhere in the data folder.
  assert.equal(fs.existsSync(path.join(a.work, "report.md")), false);
  assert.equal(allFilesText(sb.home).includes(GHP), false);
  // The other project is untouched.
  assert.deepEqual(fs.readdirSync(b.work), []);
  assert.deepEqual(fs.readdirSync(b.files), []);
});

test("EX-41 a file in a subfolder: the name is the last part, the source goes, the folder stays", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    default: {
      stream: "stream-ok.jsonl",
      work_files: [{ path: "out/deep/note.md", content: "Заметка\n" }],
      answer_files: ["out/deep/note.md"],
    },
  });
  const p = makeProject(sb);
  assert.equal(run(sb, p).status, 0);
  assert.deepEqual(fs.readdirSync(p.files), ["t-0001-1-note.md"]);
  assert.equal(fs.existsSync(path.join(p.work, "out/deep/note.md")), false);
});

test("EX-42 a result file that is missing, outside, absolute or a link out is refused; nothing is written; the decoy is intact", (t) => {
  const sb = makeSandbox(t);
  const decoy = path.join(sb.root, "outside-decoy.md");
  fs.writeFileSync(decoy, "чужой файл вне проекта\n");
  const decoyHash = sha256(fs.readFileSync(decoy));
  // The target of the link has no other name: only the check of links can refuse it.
  const linkTarget = path.join(sb.root, "link-target.md");
  fs.writeFileSync(linkTarget, "другой чужой файл\n");
  const linkHash = sha256(fs.readFileSync(linkTarget));
  const cases = [
    ["a missing file", "missing.md"],
    ["a path out of the folder", "../x"],
    ["a path out through a decoy name", "../../outside-decoy.md"],
    ["an absolute path", decoy],
    ["a link out", "link.md"],
    ["a folder", "dir"],
    ["a hard link to a file outside", "hard.md"],
    ["a name with a backslash", "a\\b.md"],
  ];
  for (const [label, named] of cases) {
    writePlan(sb, {
      default: { stream: "stream-ok.jsonl", answer_files: [named] },
    });
    fs.rmSync(path.join(sb.user, "fake-claude", "log.jsonl"), { force: true });
    const p = makeProject(sb);
    fs.symlinkSync(linkTarget, path.join(p.work, "link.md"));
    fs.linkSync(decoy, path.join(p.work, "hard.md"));
    fs.mkdirSync(path.join(p.work, "dir"));
    const before = snapshot(sb.home);
    const r = run(sb, p);
    assert.equal(r.status, 1, `${label}: ${describeRun(r)}`);
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      `E_TASK_FAILED: Задача не получилась: ${REFUSED}\n`,
      label,
    );
    const events = journal(p);
    const failed = ofType(events, "TASK_FAILED");
    assert.equal(failed.length, 1, label);
    assert.equal(failed[0].data.reason, "result_file");
    assert.equal(failed[0].data.detail, REFUSED);
    assert.equal(ofType(events, "RESULT_FILE").length, 0, label);
    assert.equal(ofType(events, "TASK_REVIEW").length, 0, label);
    assert.equal(fakeStarts(sb).length, 1, `${label}: not retried`);
    assert.deepEqual(fs.readdirSync(p.files), [], label);
    assert.equal(sha256(fs.readFileSync(decoy)), decoyHash, label);
    assert.equal(sha256(fs.readFileSync(linkTarget)), linkHash, label);
    assert.ok(fs.existsSync(decoy));
    assert.equal(
      fs.lstatSync(path.join(p.work, "link.md")).isSymbolicLink(),
      true,
    );
    // Everything else of the data folder is as before, except this project's journal.
    const after = snapshot(sb.home);
    for (const key of Object.keys(before)) {
      if (key.endsWith("events.jsonl")) continue;
      assert.deepEqual(after[key], before[key], `${label}: ${key}`);
    }
    assert.equal(stateOf(sb, p.id).tasks[0].status, "failed");
  }
  assert.equal(
    fs.readdirSync(sb.root).filter((n) => n.startsWith(".")).length,
    0,
  );
});

test("EX-42 all files are checked before the first is written: a bad second file leaves files/ empty and the first source in place", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    default: {
      stream: "stream-ok.jsonl",
      work_files: [{ path: "good.md", content: "хороший файл\n" }],
      answer_files: ["good.md", "missing.md"],
    },
  });
  const p = makeProject(sb);
  const r = run(sb, p);
  assert.equal(r.status, 1, describeRun(r));
  assert.deepEqual(fs.readdirSync(p.files), []);
  assert.equal(ofType(journal(p), "RESULT_FILE").length, 0);
  assert.equal(
    fs.existsSync(path.join(p.work, "good.md")),
    true,
    "a source was removed",
  );
  assert.equal(ofType(journal(p), "RUN_FINISHED")[0].data.outcome, "failed");
  assert.deepEqual(ofType(journal(p), "RUN_FINISHED")[0].data.files, []);
});

test("EX-42 a file that is not UTF-8 text is refused like a missing one", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, {
    default: { stream: "stream-ok.jsonl", answer_files: ["bin.dat"] },
  });
  const p = makeProject(sb);
  fs.writeFileSync(
    path.join(p.work, "bin.dat"),
    Buffer.from([0xff, 0xfe, 0x00, 0x80]),
  );
  const r = run(sb, p);
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(ofType(journal(p), "TASK_FAILED")[0].data.reason, "result_file");
  assert.deepEqual(fs.readdirSync(p.files), []);
  assert.equal(fs.existsSync(path.join(p.work, "bin.dat")), true);
});

test("EX-43 the scenario is a byte copy in the project folder and the run reads only the copy", (t) => {
  const sb = makeSandbox(t);
  const fixture = path.join(FIXTURES, "scenario-basic.json");
  const copy = path.join(sb.root, "my-scenario.json");
  fs.copyFileSync(fixture, copy);
  const env = execEnv(sb);
  const made = runTeam(
    [
      "new",
      "--goal",
      "Вымышленная цель",
      "--budget",
      "1",
      "--executor",
      "scripted",
      "--scenario",
      copy,
    ],
    env,
  );
  assert.equal(made.status, 0, describeRun(made));
  const id = JSON.parse(made.stdout).project.id;
  const dir = path.join(sb.home, id);
  assert.equal(
    sha256(fs.readFileSync(path.join(dir, "scenario.json"))),
    sha256(fs.readFileSync(fixture)),
  );
  assert.equal(mode(path.join(dir, "scenario.json")), 0o600);
  assert.equal(stateOf(sb, id).scenario_file, "scenario.json");
  const added = runTeam(
    [
      "add-task",
      id,
      "--role",
      "researcher",
      "--text",
      "Вымышленный текст",
      "--done-when",
      "Готов итог",
    ],
    env,
  );
  assert.equal(added.status, 0, describeRun(added));
  // The copy that the user gave is changed, then removed: the run does not care.
  fs.writeFileSync(copy, "{ not a scenario");
  fs.rmSync(copy);
  const r = runTeam(["run-task", id, "t-0001"], env);
  assert.equal(r.status, 0, describeRun(r));
  const events = journal(path.join(dir, "events.jsonl"));
  assert.deepEqual(
    ofType(events, "AGENT_ACTIVITY").map((e) => [e.data.activity, e.data.text]),
    [
      ["reading", null],
      ["thinking", "Сверяю вымышленные цены поставщиков по списку"],
      ["writing", null],
    ],
  );
  assert.equal(
    ofType(events, "RUN_FINISHED")[0].data.summary,
    "Вымышленное сравнение цен поставщиков готово",
  );
  assert.ok(types(events).includes("TASK_REVIEW"));
});

test("EX-43 the copy in the project is what runs: a changed copy changes the run (the source is never read again)", (t) => {
  const sb = makeSandbox(t);
  const env = execEnv(sb);
  const made = runTeam(
    [
      "new",
      "--goal",
      "Вымышленная цель",
      "--budget",
      "1",
      "--executor",
      "scripted",
      "--scenario",
      path.join(FIXTURES, "scenario-basic.json"),
    ],
    env,
  );
  const id = JSON.parse(made.stdout).project.id;
  runTeam(
    ["add-task", id, "--role", "lawyer", "--text", "т", "--done-when", "д"],
    env,
  );
  const projectCopy = path.join(sb.home, id, "scenario.json");
  const edited = JSON.parse(fs.readFileSync(projectCopy, "utf8"));
  edited.runs[0].result.answer.summary = "Итог из копии в папке проекта";
  fs.writeFileSync(projectCopy, JSON.stringify(edited));
  const r = runTeam(["run-task", id, "t-0001"], env);
  assert.equal(r.status, 0, describeRun(r));
  assert.equal(
    ofType(journal(path.join(sb.home, id, "events.jsonl")), "RUN_FINISHED")[0]
      .data.summary,
    "Итог из копии в папке проекта",
  );
});
