// Sai Team engine: the schedule and the limit of parallel work (design REQ-013,
// section 21, criterion 2: EN-10 ... EN-14) and the options of runTask that keep
// run-task as it was (C5: EN-81). Only the fake executable and the scripted
// executor are started, every command after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { main } from "../src/team/cli.js";
import { readConfig } from "../src/team/config.js";
import { PLAN_ANSWER_SCHEMA } from "../src/team/engine/plan.js";
import {
  GOAL_ANSWER_SCHEMA,
  REVIEW_ANSWER_SCHEMA,
} from "../src/team/engine/review.js";
import { runSingle } from "../src/team/engine/single-run.js";
import { openWriter } from "../src/team/store.js";
import {
  assertSafeEnv,
  describeRun,
  execEnv,
  fakeLog,
  fakeStarts,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  runTeam,
  sha256,
  snapshot,
} from "./exec-helpers.js";
import { countJournalCalls } from "./team-helpers.js";
import { engineProject, runToEnd } from "./team-engine-helpers.js";

// ---- EN-81 (C5) ---------------------------------------------------------------------

test("EN-81 run-task (the command) still refuses a task on review and a task waiting for the user (E_TASK_STATE); the journal is unchanged, nothing is started", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb, { tasks: 2, role: ["researcher", "designer"] });
  const w = openWriter(p.id, { home: sb.home });
  try {
    for (const [id, role] of [
      ["t-0001", "researcher"],
      ["t-0002", "designer"],
    ]) {
      w.append({ source: "ENGINE", type: "TASK_STARTED", task: id, data: {} });
      const run = w.nextRunId();
      w.append({
        source: "ENGINE",
        type: "RUN_STARTED",
        task: id,
        data: {
          run_id: run,
          purpose: "work",
          role,
          executor: "claude-cli",
          max_budget_usd: 0.25,
        },
      });
      w.append({
        source: "ENGINE",
        type: "RUN_FINISHED",
        task: id,
        data: {
          run_id: run,
          outcome: "ok",
          summary: null,
          cost_usd: 0,
          files: [],
        },
      });
      w.append({ source: "ENGINE", type: "TASK_REVIEW", task: id, data: {} });
    }
    w.append({
      source: "ENGINE",
      type: "TASK_WAITING_USER",
      task: "t-0002",
      data: { reason: "review_failed", draft: null },
    });
  } finally {
    w.close();
  }
  const env = execEnv(sb);
  assertSafeEnv(env);
  const cases = [
    ["t-0001", "на проверке"],
    ["t-0002", "ждёт решения пользователя"],
  ];
  for (const [task, status] of cases) {
    const before = sha256(fs.readFileSync(p.events));
    const tree = snapshot(p.dir);
    const r = runTeam(["run-task", p.id, task], env);
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      `E_TASK_STATE: Задачу сейчас нельзя запустить: ${status}\n`,
    );
    assert.equal(sha256(fs.readFileSync(p.events)), before);
    assert.deepStrictEqual(snapshot(p.dir), tree);
  }
  assert.equal(fakeStarts(sb).length, 0, "nothing was started");
  assert.equal(
    journal(p).filter((e) => e.type === "TASK_STARTED").length,
    2,
    "only the two starts of the fixture",
  );
});

const WORK_SLOW = (ms) => ({
  match: { purpose: "work" },
  steps: [{ delay_ms: ms }],
  result: {
    outcome: "ok",
    cost_usd: 0.01,
    answer: { summary: "Готово", files: [] },
  },
});
const PASS = {
  match: { purpose: "review" },
  steps: [],
  result: {
    outcome: "ok",
    cost_usd: 0.01,
    answer: { passed: true, notes: "Критерий выполнен" },
  },
};
const GOAL_OK = {
  match: { purpose: "goal_check" },
  steps: [],
  result: {
    outcome: "ok",
    cost_usd: 0.01,
    answer: { passed: true, notes: "Цель достигнута" },
  },
};
const planOf = (tasks) => ({
  match: { purpose: "plan" },
  steps: [],
  result: { outcome: "ok", cost_usd: 0.01, answer: { tasks } },
});
const item = (key, over = {}) => ({
  key,
  role: "researcher",
  text: `Вымышленная задача ${key}`,
  done_when: "Есть итог",
  depends_on: [],
  critical: false,
  ...over,
});

// The largest number of runs of tasks open at once, by the journal.
function maxParallel(events) {
  const open = new Set();
  let max = 0;
  for (const e of events) {
    if (e.type === "RUN_STARTED" && e.task !== null) open.add(e.data.run_id);
    if (e.type === "RUN_FINISHED") open.delete(e.data.run_id);
    max = Math.max(max, open.size);
  }
  return max;
}

// ---- EN-10 -----------------------------------------------------------------------

for (const [label, parallel, expected] of [
  ["without a setting", null, 2],
  ["--parallel 1", 1, 1],
  ["--parallel 3", 3, 3],
]) {
  test(
    `EN-10 six independent tasks: at most ${expected} at once (${label})`,
    { timeout: 60_000 },
    async (t) => {
      const p = engineProject(t, [
        planOf([1, 2, 3, 4, 5, 6].map((i) => item(`k${i}`))),
        WORK_SLOW(150),
        PASS,
        GOAL_OK,
      ]);
      const result = await runToEnd(p, parallel === null ? {} : { parallel });
      assert.equal(result.status, "done");
      const events = journal(p);
      assert.equal(maxParallel(events), expected);
      assert.equal(
        ofType(events, "PROJECT_STARTED")[0].data.parallel,
        expected,
      );
      assert.equal(ofType(events, "TASK_DONE").length, 6);
    },
  );
}

// ---- EN-11 -----------------------------------------------------------------------

test("EN-11 start --parallel 0, 4 or x: exit 2, the text, the journal unchanged and not even opened", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb, { tasks: 0 });
  const env = execEnv(sb);
  assertSafeEnv(env);
  const before = sha256(fs.readFileSync(p.events));
  const counts = countJournalCalls(t, p.events);
  for (const value of ["0", "4", "x", "2.0", ""]) {
    let out = "";
    let err = "";
    const io = {
      stdout: { write: (s) => (out += s) },
      stderr: { write: (s) => (err += s) },
    };
    const code = main(["start", p.id, "--parallel", value], env, io);
    assert.equal(code, 2, value);
    assert.equal(out, "");
    assert.equal(err, "E_USAGE: --parallel: число 1, 2 или 3\n");
  }
  assert.deepStrictEqual(counts, {
    writeSync: 0,
    fsyncSync: 0,
    ftruncateSync: 0,
  });
  assert.equal(sha256(fs.readFileSync(p.events)), before);
  assert.equal(fs.existsSync(path.join(p.dir, "writer.lock")), false);
});

// ---- EN-12 -----------------------------------------------------------------------

test(
  "EN-12 A -> B -> C and D: B begins after A is done, C after B, D runs together with A",
  { timeout: 60_000 },
  async (t) => {
    const p = engineProject(t, [
      planOf([
        item("a"),
        item("b", { depends_on: ["a"] }),
        item("c", { depends_on: ["b"] }),
        item("d"),
      ]),
      WORK_SLOW(200),
      PASS,
      GOAL_OK,
    ]);
    const result = await runToEnd(p);
    assert.equal(result.status, "done");
    const events = journal(p);
    const seqOf = (type, task) =>
      events.find((e) => e.type === type && e.task === task).seq;
    // t-0001 a, t-0002 b, t-0003 c, t-0004 d
    assert.ok(seqOf("TASK_STARTED", "t-0002") > seqOf("TASK_DONE", "t-0001"));
    assert.ok(seqOf("TASK_STARTED", "t-0003") > seqOf("TASK_DONE", "t-0002"));
    assert.ok(seqOf("TASK_STARTED", "t-0004") < seqOf("TASK_DONE", "t-0001"));
    assert.ok(
      seqOf("TASK_STARTED", "t-0004") > seqOf("TASK_STARTED", "t-0001"),
    );
  },
);

// ---- EN-13 -----------------------------------------------------------------------

test(
  "EN-13 start and resume on claude-cli without SAI_TEAM_REAL_RUNS=1, and a project without a ceiling: refused before anything, nothing started, no lock",
  { timeout: 120_000 },
  (t) => {
    const sb = makeSandbox(t);
    const paused = makeProject(sb, { tasks: 0 });
    const w = openWriter(paused.id, { home: sb.home });
    try {
      w.append({
        source: "USER",
        type: "PROJECT_STARTED",
        task: null,
        data: { parallel: 2 },
      });
      w.append({
        source: "USER",
        type: "PROJECT_PAUSED",
        task: null,
        data: {},
      });
    } finally {
      w.close();
    }
    const fresh = makeProject(sb, { tasks: 0 });
    const noCeiling = makeProject(sb, { tasks: 0, budget_usd: 0 });
    const off = execEnv(sb, { SAI_TEAM_REAL_RUNS: undefined });
    const on = execEnv(sb);
    const cases = [
      [
        ["start", fresh.id],
        off,
        fresh,
        "E_REAL_RUNS_OFF: Настоящие запуски выключены: нужна переменная SAI_TEAM_REAL_RUNS=1",
      ],
      [
        ["resume", paused.id],
        off,
        paused,
        "E_REAL_RUNS_OFF: Настоящие запуски выключены: нужна переменная SAI_TEAM_REAL_RUNS=1",
      ],
      [
        ["start", noCeiling.id],
        on,
        noCeiling,
        "E_NO_BUDGET: У проекта нет потолка стоимости: настоящий запуск без потолка запрещён",
      ],
    ];
    for (const [argv, env, p, text] of cases) {
      const before = sha256(fs.readFileSync(p.events));
      const tree = snapshot(p.dir);
      const r = runTeam(argv, env);
      assert.equal(r.status, 1, describeRun(r));
      assert.equal(r.stdout, "");
      assert.equal(r.stderr, `${text}\n`);
      assert.equal(sha256(fs.readFileSync(p.events)), before);
      assert.deepStrictEqual(
        snapshot(p.dir),
        tree,
        "no lock, no inbox, nothing",
      );
    }
    assert.equal(fakeStarts(sb).length, 0);
    // a project without a ceiling can be resumed neither
    const w2 = openWriter(noCeiling.id, { home: sb.home });
    try {
      w2.append({
        source: "USER",
        type: "PROJECT_STARTED",
        task: null,
        data: { parallel: 1 },
      });
      w2.append({
        source: "USER",
        type: "PROJECT_PAUSED",
        task: null,
        data: {},
      });
    } finally {
      w2.close();
    }
    const before = sha256(fs.readFileSync(noCeiling.events));
    const r = runTeam(["resume", noCeiling.id], on);
    assert.equal(r.status, 1, describeRun(r));
    assert.match(r.stderr, /^E_NO_BUDGET: /);
    assert.equal(sha256(fs.readFileSync(noCeiling.events)), before);
    assert.equal(fakeStarts(sb).length, 0);
  },
);

// ---- EN-14 -----------------------------------------------------------------------

test("EN-14 the check inside the executor holds for the plan, the review and the goal check even without the check of the command: nothing is started or written", async (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb, { tasks: 1 });
  const env = execEnv(sb, { SAI_TEAM_REAL_RUNS: undefined });
  assertSafeEnv(env);
  const config = readConfig(env);
  const w = openWriter(p.id, { home: sb.home });
  t.after(() => w.close());
  const before = sha256(fs.readFileSync(p.events));
  const specs = [
    ["plan", "project_manager", null, PLAN_ANSWER_SCHEMA],
    ["review", "reviewer", "t-0001", REVIEW_ANSWER_SCHEMA],
    ["goal_check", "reviewer", null, GOAL_ANSWER_SCHEMA],
  ];
  for (const [purpose, role, task, schema] of specs) {
    const r = await runSingle(
      w,
      {
        purpose,
        role,
        task,
        context: { goal: "x", memory: [], deps: [], note: null },
        answer_schema: schema,
        maxBudget: 0.25,
      },
      { env, config },
    );
    assert.equal(r.error?.code, "E_REAL_RUNS_OFF", purpose);
    assert.equal(r.run_id, null);
  }
  assert.equal(sha256(fs.readFileSync(p.events)), before);
  assert.deepStrictEqual(fakeLog(sb), []);
});
