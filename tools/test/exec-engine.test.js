// The executors and runTask under the engine of REQ-013 (design REQ-013, sections
// 2.2, 5, 8, 11; ORCH decisions of step 23): claude-cli takes the answers of the
// plan, the review, the goal check and the choice of a role, which have no files;
// a task started a second time gets result files under new names. A real Claude
// Code is never started: only fixtures/team/fake-claude.js.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readConfig } from "../src/team/config.js";
import { getExecutor } from "../src/team/executor.js";
import { PLAN_ANSWER_SCHEMA } from "../src/team/engine/plan.js";
import {
  GOAL_ANSWER_SCHEMA,
  REASSIGN_ANSWER_SCHEMA,
  REVIEW_ANSWER_SCHEMA,
} from "../src/team/engine/review.js";
import { runSingle } from "../src/team/engine/single-run.js";
import { roleByCode } from "../src/team/roles.js";
import { runTask } from "../src/team/runner.js";
import { openWriter } from "../src/team/store.js";
import {
  FIXTURES,
  assertSafeEnv,
  execEnv,
  fakeStarts,
  ioFor,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  requestFor,
  withLimit,
  writePlan,
} from "./exec-helpers.js";

const sample = (name) =>
  JSON.parse(
    fs
      .readFileSync(path.join(FIXTURES, name), "utf8")
      .trim()
      .split("\n")
      .at(-1),
  ).structured_output;

const CASES = [
  [
    "plan",
    "project_manager",
    null,
    PLAN_ANSWER_SCHEMA,
    "stream-engine-plan.jsonl",
  ],
  [
    "review",
    "reviewer",
    "t-0001",
    REVIEW_ANSWER_SCHEMA,
    "stream-engine-pass.jsonl",
  ],
  [
    "goal_check",
    "reviewer",
    null,
    GOAL_ANSWER_SCHEMA,
    "stream-engine-pass.jsonl",
  ],
  [
    "reassign",
    "project_manager",
    "t-0001",
    REASSIGN_ANSWER_SCHEMA,
    "stream-engine-reassign.jsonl",
  ],
];

for (const [purpose, role, task, schema, stream] of CASES) {
  test(
    `claude-cli (fake executable): an answer of ${purpose} without files and summary is ok, files [] and summary null`,
    { timeout: 60_000 },
    async (t) => {
      const sb = makeSandbox(t);
      const p = makeProject(sb);
      writePlan(sb, { default: { stream } });
      const request = requestFor(sb, p.id, {
        purpose,
        role: roleByCode(role),
        answer_schema: schema,
        task: task === null ? null : requestFor(sb, p.id).task,
      });
      const result = await withLimit(
        getExecutor("claude-cli").run(request, ioFor(sb)),
      );
      assert.equal(result.outcome, "ok", JSON.stringify(result));
      assert.deepStrictEqual(result.answer, sample(stream));
      assert.deepStrictEqual(result.files, []);
      assert.equal(result.summary, null);
      assert.equal(result.cost_usd, 0.01);
      assert.equal(fakeStarts(sb).length, 1);
    },
  );
}

test(
  "claude-cli (fake executable): a run of the planner by runSingle is closed ok and charged",
  { timeout: 60_000 },
  async (t) => {
    const sb = makeSandbox(t);
    const p = makeProject(sb, { tasks: 0 });
    writePlan(sb, { default: { stream: "stream-engine-plan.jsonl" } });
    const env = execEnv(sb);
    assertSafeEnv(env);
    const w = openWriter(p.id, { home: sb.home });
    t.after(() => w.close());
    w.append({
      source: "USER",
      type: "PROJECT_STARTED",
      task: null,
      data: { parallel: 2 },
    });
    w.append({
      source: "ENGINE",
      type: "PLANNING_STARTED",
      task: null,
      data: { round: 0 },
    });
    const r = await withLimit(
      runSingle(
        w,
        {
          purpose: "plan",
          role: "project_manager",
          task: null,
          context: { goal: "x", memory: [], deps: [], note: null },
          answer_schema: PLAN_ANSWER_SCHEMA,
          maxBudget: 0.25,
        },
        { env, config: readConfig(env) },
      ),
    );
    assert.equal(r.error, null);
    assert.deepStrictEqual(r.result.answer, sample("stream-engine-plan.jsonl"));
    const events = journal(p);
    assert.deepStrictEqual(
      ofType(events, "RUN_FINISHED").map((e) => e.data.outcome),
      ["ok"],
    );
    assert.deepStrictEqual(
      ofType(events, "BUDGET_SPENT").map((e) => e.data.total_usd),
      [0.01],
    );
  },
);

test(
  "runTask: the second start of the same task names its result files after the attempt of the task, not E_FILE_EXISTS",
  { timeout: 60_000 },
  async (t) => {
    const sb = makeSandbox(t);
    const scenario = {
      version: 1,
      runs: [
        {
          match: { purpose: "work" },
          steps: [],
          result: {
            outcome: "ok",
            cost_usd: 0.01,
            answer: { summary: "Готово", files: [] },
            files: [{ name: "report.md", content: "Вымышленный отчёт" }],
          },
        },
      ],
    };
    const p = makeProject(sb, {
      executor: "scripted",
      scenario_bytes: Buffer.from(JSON.stringify(scenario)),
    });
    const env = execEnv(sb);
    assertSafeEnv(env);
    const config = readConfig(env);
    const w = openWriter(p.id, { home: sb.home });
    t.after(() => w.close());
    const opts = {
      env,
      config,
      startFrom: ["waiting", "interrupted", "failed", "review", "waiting_user"],
    };
    const first = await withLimit(runTask(w, p.task, opts));
    assert.equal(first.status, "review");
    const second = await withLimit(runTask(w, p.task, opts));
    assert.equal(second.status, "review", JSON.stringify(second.error));
    assert.deepStrictEqual(
      ofType(journal(p), "RESULT_FILE").map((e) => e.data.name),
      ["t-0001-1-report.md", "t-0001-2-report.md"],
    );
    assert.deepStrictEqual(w.state.tasks[0].files, [
      "t-0001-1-report.md",
      "t-0001-2-report.md",
    ]);
  },
);
