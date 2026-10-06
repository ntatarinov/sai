// Tests of the commands add-task and run-task: usage, states, refusals (design REQ-010,
// section 15.1: EX-44, EX-45; criteria 2, 3, 10, 11). Only the fake executable is
// started.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { readConfig } from "../src/team/config.js";
import { TeamError } from "../src/team/errors.js";
import { runTask } from "../src/team/runner.js";
import { openWriter } from "../src/team/store.js";
import {
  assertSafeEnv,
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
  writePlan,
  withLimit,
} from "./exec-helpers.js";

const OK_PLAN = { default: { stream: "stream-ok.jsonl", set_cost: 0.05 } };

test("EX-44 add-task: a TASK_CREATED of the user, the output shows the title of the role and never its code", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb, { tasks: 0 });
  const env = execEnv(sb);
  const r = runTeam(
    [
      "add-task",
      p.id,
      "--role",
      "lawyer",
      "--text",
      "Проверить договор аренды",
      "--done-when",
      "Есть список рисков",
    ],
    env,
  );
  assert.equal(r.status, 0, describeRun(r));
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.task.id, "t-0001");
  assert.equal(out.task.role_title, "Юрист");
  assert.equal(out.task.text, "Проверить договор аренды");
  assert.equal(out.task.done_when, "Есть список рисков");
  assert.equal(out.task.status, "waiting");
  assert.equal(typeof out.task.phrase, "string");
  assert.equal("role" in out.task, false);
  assert.equal("internal" in out.task, false);
  assert.equal(r.stdout.includes("lawyer"), false);
  const created = ofType(journal(p), "TASK_CREATED");
  assert.equal(created.length, 1);
  assert.equal(created[0].source, "USER");
  assert.deepEqual(created[0].data, {
    role: "lawyer",
    text: "Проверить договор аренды",
    done_when: "Есть список рисков",
    depends_on: [],
    critical: false,
  });
  assert.equal(stateOf(sb, p.id).tasks[0].status, "waiting");
});

test("EX-44 add-task: an unknown role or a missing option is E_USAGE with exit 2 and the journal does not change", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb, { tasks: 0 });
  const env = execEnv(sb);
  const before = sha256(fs.readFileSync(p.events));
  const tree = snapshot(p.dir);
  const cases = [
    ["add-task", p.id, "--role", "wizard", "--text", "т", "--done-when", "д"],
    ["add-task", p.id, "--text", "т", "--done-when", "д"],
    ["add-task", p.id, "--role", "lawyer", "--done-when", "д"],
    ["add-task", p.id, "--role", "lawyer", "--text", "т"],
    [
      "add-task",
      p.id,
      "--role",
      "lawyer",
      "--text",
      "т",
      "--done-when",
      "д",
      "--extra",
      "1",
    ],
    ["add-task", "--role", "lawyer", "--text", "т", "--done-when", "д"],
  ];
  for (const argv of cases) {
    const r = runTeam(argv, env);
    assert.equal(r.status, 2, `${argv.join(" ")}: ${describeRun(r)}`);
    assert.equal(r.stdout, "");
    assert.ok(r.stderr.startsWith("E_USAGE: "), r.stderr);
    assert.doesNotMatch(r.stderr, /\n\s+at /u);
    assert.equal(sha256(fs.readFileSync(p.events)), before);
    assert.deepEqual(snapshot(p.dir), tree);
  }
  const unknown = runTeam(cases[0], env);
  assert.match(
    unknown.stderr,
    /Юрист \(lawyer\)/u,
    "the list of roles names titles and codes",
  );
  assert.match(unknown.stderr, /Исследователь \(researcher\)/u);
  // A project that does not exist.
  const missing = runTeam(
    [
      "add-task",
      "p-20200101-aaaaaa",
      "--role",
      "lawyer",
      "--text",
      "т",
      "--done-when",
      "д",
    ],
    env,
  );
  assert.equal(missing.status, 1, describeRun(missing));
  assert.equal(missing.stderr, "E_NOT_FOUND: Проект не найден\n");
});

test("EX-45 run-task: an unknown task, a stopped project and a missing id are refused with their own code; the journal does not change; nothing is started", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb);
  const env = execEnv(sb);
  const before = sha256(fs.readFileSync(p.events));
  const unknown = runTeam(["run-task", p.id, "t-0099"], env);
  assert.equal(unknown.status, 1, describeRun(unknown));
  assert.equal(unknown.stdout, "");
  assert.ok(unknown.stderr.startsWith("E_TASK_NOT_FOUND: "), unknown.stderr);
  assert.equal(sha256(fs.readFileSync(p.events)), before);

  const noTask = runTeam(["run-task", p.id], env);
  assert.equal(noTask.status, 2, describeRun(noTask));
  assert.equal(sha256(fs.readFileSync(p.events)), before);

  // paused and stopped projects.
  for (const [steps, label] of [
    [
      [
        ["PROJECT_STARTED", { parallel: 1 }],
        ["PROJECT_PAUSED", {}],
      ],
      "paused",
    ],
    [[["PROJECT_STOPPED", {}]], "stopped"],
  ]) {
    const q = makeProject(sb);
    const w = openWriter(q.id, { home: sb.home });
    for (const [type, data] of steps) {
      w.append({ source: "USER", type, task: null, data });
    }
    w.close();
    const frozen = sha256(fs.readFileSync(q.events));
    const r = runTeam(["run-task", q.id, q.task], env);
    assert.equal(r.status, 1, `${label}: ${describeRun(r)}`);
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      "E_PROJECT_STATE: Проект на паузе или завершён\n",
      label,
    );
    assert.equal(sha256(fs.readFileSync(q.events)), frozen, label);
    assert.equal(stateOf(sb, q.id).tasks[0].status, "waiting");
  }
  assert.equal(fakeStarts(sb).length, 0, "a process was started");
});

test("EX-45 run-task on a task that is on review, running or waiting for another task: E_TASK_STATE, the journal is unchanged, no new process", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const env = execEnv(sb);
  assertSafeEnv(env);
  const config = readConfig(env);
  const p = makeProject(sb, { tasks: 3 });
  const writer = openWriter(p.id, { home: sb.home });
  t.after(() => writer.close());
  // t-0004 waits for t-0001.
  writer.append({
    source: "USER",
    type: "TASK_CREATED",
    task: "t-0004",
    data: {
      role: "lawyer",
      text: "ждёт",
      done_when: "д",
      depends_on: ["t-0001"],
      critical: false,
    },
  });
  const first = await withLimit(runTask(writer, "t-0001", { env, config }));
  assert.equal(first.status, "review");
  assert.equal(fakeStarts(sb).length, 1);
  writer.append({
    source: "ENGINE",
    type: "TASK_STARTED",
    task: "t-0002",
    data: {},
  });

  const cases = [
    ["t-0001", /на проверке/u],
    ["t-0002", /в работе/u],
    ["t-0004", /ждёт результат других задач/u],
  ];
  for (const [task, text] of cases) {
    const before = sha256(fs.readFileSync(p.events));
    await assert.rejects(
      () => withLimit(runTask(writer, task, { env, config })),
      (err) =>
        err instanceof TeamError &&
        err.code === "E_TASK_STATE" &&
        text.test(err.message),
      task,
    );
    assert.equal(sha256(fs.readFileSync(p.events)), before, task);
    assert.equal(fakeStarts(sb).length, 1, task);
  }
});
