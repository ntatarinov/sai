// Tests of the interface of the executors, the choice of the executor, the real-run
// conditions, the arguments and the process of claude-cli (design REQ-010, section
// 15.1: EX-01...EX-06, EX-08...EX-15, EX-48, EX-49; criteria 1, 2, 3, 4, 5, 16).
// A real Claude Code is never started: only fixtures/team/fake-claude.js or a
// missing-* name (exec-helpers.js refuses anything else).
import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TeamError } from "../src/team/errors.js";
import {
  WORK_ANSWER_SCHEMA,
  checkAnswer,
  getExecutor,
} from "../src/team/executor.js";
import { readConfig } from "../src/team/config.js";
import { PHRASES, phrasesForJournal } from "../src/team/language.js";
import { roleByCode } from "../src/team/roles.js";
import {
  FIXTURES,
  TEAM_SRC,
  argAfter,
  execEnv,
  fakeLog,
  fakeStarts,
  fakeStdin,
  ioFor,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  requestFor,
  runTeam,
  runTeamExpectRefusal,
  describeRun,
  sha256,
  snapshot,
  stateOf,
  types,
  writePlan,
  withLimit,
} from "./exec-helpers.js";

const OK_PLAN = { default: { stream: "stream-ok.jsonl", set_cost: 0.05 } };
const SCRIPTED_MARKERS = [
  /настоящ/iu,
  /реальн/iu,
  /claude/iu,
  /демо/iu,
  /demo/iu,
  /демонстрац/iu,
  /(^|[^\p{L}])(ии|ai)([^\p{L}]|$)/iu,
];

function scenarioBytes(runs) {
  return Buffer.from(JSON.stringify({ version: 1, runs }), "utf8");
}

const BASIC = fs.readFileSync(path.join(FIXTURES, "scenario-basic.json"));
const FLAKY = fs.readFileSync(path.join(FIXTURES, "scenario-flaky.json"));

function run(sb, p, over = {}) {
  return runTeam(["run-task", p.id, p.task], execEnv(sb, over));
}

function textOf(events) {
  return JSON.stringify(events);
}

// ---- EX-01 ------------------------------------------------------------------------

test("EX-01 run of scripted and claude-cli: events and a RunResult of one shape", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const cli = makeProject(sb);
  const scr = makeProject(sb, { executor: "scripted", scenario_bytes: BASIC });
  const shape = [
    "executor",
    "outcome",
    "transient",
    "spawned",
    "answer",
    "summary",
    "files",
    "outputs",
    "memory",
    "cost_usd",
    "detail",
    "stats",
  ];
  const a = ioFor(sb);
  const ra = await withLimit(
    getExecutor("claude-cli").run(requestFor(sb, cli.id), a),
  );
  const b = ioFor(sb);
  const rb = await withLimit(
    getExecutor("scripted").run(requestFor(sb, scr.id), b),
  );
  for (const [r, io, code] of [
    [ra, a, "claude-cli"],
    [rb, b, "scripted"],
  ]) {
    assert.deepEqual(Object.keys(r).sort(), [...shape].sort());
    assert.equal(r.executor, code);
    assert.equal(r.outcome, "ok");
    assert.equal(r.spawned, true);
    assert.equal(typeof r.summary, "string");
    assert.deepEqual(r.files, []);
    assert.ok(io.events.length >= 2, "events come while the run goes");
    for (const e of io.events) {
      assert.equal(e.kind, "activity");
      assert.ok(
        ["reading", "searching", "writing", "thinking", "other"].includes(
          e.activity,
        ),
      );
    }
  }
  assert.equal(ra.cost_usd, 0.05);
  assert.equal(ra.summary, "Сравнение цен трёх поставщиков готово");
  assert.equal(rb.cost_usd, 0);
  // run() never writes the journal.
  assert.equal(journal(cli).length, 2);
  assert.equal(journal(scr).length, 2);
});

test("EX-01 run-task writes RUN_STARTED, AGENT_ACTIVITY, RUN_FINISHED, BUDGET_SPENT for both executors", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const cli = makeProject(sb);
  const scr = makeProject(sb, { executor: "scripted", scenario_bytes: BASIC });
  for (const p of [cli, scr]) {
    const r = run(sb, p);
    assert.equal(r.status, 0, describeRun(r));
    const events = journal(p);
    const got = types(events);
    for (const type of [
      "RUN_STARTED",
      "AGENT_ACTIVITY",
      "RUN_FINISHED",
      "BUDGET_SPENT",
      "TASK_REVIEW",
    ]) {
      assert.ok(got.includes(type), `${type} in ${got.join(",")}`);
    }
    assert.ok(
      got.indexOf("RUN_STARTED") < got.indexOf("AGENT_ACTIVITY") &&
        got.indexOf("AGENT_ACTIVITY") < got.indexOf("RUN_FINISHED") &&
        got.indexOf("RUN_FINISHED") < got.indexOf("BUDGET_SPENT"),
    );
    assert.equal(stateOf(sb, p.id).tasks[0].status, "review");
  }
});

test("EX-01 an answer outside the schema is invalid_output: no files, no TASK_REVIEW", (t) => {
  const sb = makeSandbox(t);
  // claude-cli: an extra field in structured_output.
  writePlan(sb, { default: { stream: "stream-out-of-schema.jsonl" } });
  const cli = makeProject(sb);
  const r = run(sb, cli);
  assert.equal(r.status, 1, describeRun(r));
  assert.match(r.stderr, /^E_TASK_FAILED: Задача не получилась: /u);
  const events = journal(cli);
  const finished = ofType(events, "RUN_FINISHED");
  assert.equal(finished.length, 3);
  for (const e of finished) {
    assert.equal(e.data.outcome, "invalid_output");
    assert.deepEqual(e.data.files, []);
    assert.equal(e.data.summary, null);
  }
  const failed = ofType(events, "TASK_FAILED");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].data.reason, "invalid_output");
  assert.equal(
    failed[0].data.detail,
    "Ответ исполнителя не соответствует схеме",
  );
  assert.equal(ofType(events, "TASK_REVIEW").length, 0);
  assert.equal(ofType(events, "RESULT_FILE").length, 0);
  assert.deepEqual(fs.readdirSync(cli.files), []);

  // scripted: an answer without summary, then an extra field.
  for (const answer of [
    { files: [] },
    { summary: "Итог", files: [], lie: "executor=scripted" },
  ]) {
    const scr = makeProject(sb, {
      executor: "scripted",
      scenario_bytes: scenarioBytes([
        { match: {}, steps: [], result: { outcome: "ok", answer } },
      ]),
    });
    const rr = run(sb, scr);
    assert.equal(rr.status, 1, describeRun(rr));
    const ev = journal(scr);
    assert.ok(
      ofType(ev, "RUN_FINISHED").every(
        (e) => e.data.outcome === "invalid_output",
      ),
    );
    assert.equal(ofType(ev, "TASK_REVIEW").length, 0);
    assert.equal(ofType(ev, "TASK_FAILED")[0].data.reason, "invalid_output");
  }
});

// ---- EX-02 ------------------------------------------------------------------------

test("EX-02 checkAnswer on WORK_ANSWER_SCHEMA: the borders", () => {
  const ok = (v) => checkAnswer(WORK_ANSWER_SCHEMA, v).ok;
  const base = { summary: "Итог", files: [] };
  assert.equal(ok(base), true);
  // summary 1..2000 code points (an astral symbol counts as one).
  assert.equal(ok({ ...base, summary: "я".repeat(2000) }), true);
  assert.equal(ok({ ...base, summary: "я".repeat(2001) }), false);
  assert.equal(ok({ ...base, summary: "😀".repeat(2000) }), true);
  assert.equal(ok({ ...base, summary: "😀".repeat(2001) }), false);
  assert.equal(ok({ ...base, summary: "" }), false);
  assert.equal(ok({ ...base, summary: 5 }), false);
  assert.equal(ok({ files: [] }), false);
  assert.equal(ok({ summary: "Итог" }), false);
  // files <= 50, path 1..255, kind in the list, no extra field.
  const file = (i) => ({ path: `f${i}.md` });
  assert.equal(
    ok({ ...base, files: Array.from({ length: 50 }, (_, i) => file(i)) }),
    true,
  );
  assert.equal(
    ok({ ...base, files: Array.from({ length: 51 }, (_, i) => file(i)) }),
    false,
  );
  assert.equal(ok({ ...base, files: [{ path: "a".repeat(255) }] }), true);
  assert.equal(ok({ ...base, files: [{ path: "a".repeat(256) }] }), false);
  assert.equal(ok({ ...base, files: [{ path: "" }] }), false);
  assert.equal(
    ok({ ...base, files: [{ path: "a.md", kind: "result" }] }),
    true,
  );
  assert.equal(ok({ ...base, files: [{ path: "a.md", kind: "draft" }] }), true);
  assert.equal(
    ok({ ...base, files: [{ path: "a.md", kind: "final" }] }),
    false,
  );
  assert.equal(ok({ ...base, files: [{ path: "a.md", extra: 1 }] }), false);
  assert.equal(ok({ ...base, files: [{ kind: "result" }] }), false);
  assert.equal(ok({ ...base, extra: 1 }), false);
  // memory <= 10, kind and text.
  const mem = (i) => ({ kind: "fact", text: `запись ${i}` });
  assert.equal(
    ok({ ...base, memory: Array.from({ length: 10 }, (_, i) => mem(i)) }),
    true,
  );
  assert.equal(
    ok({ ...base, memory: Array.from({ length: 11 }, (_, i) => mem(i)) }),
    false,
  );
  assert.equal(ok({ ...base, memory: [{ kind: "idea", text: "x" }] }), false);
  assert.equal(
    ok({ ...base, memory: [{ kind: "note", text: "я".repeat(4000) }] }),
    true,
  );
  assert.equal(
    ok({ ...base, memory: [{ kind: "note", text: "я".repeat(4001) }] }),
    false,
  );
  assert.equal(ok({ ...base, memory: [{ kind: "note", text: "" }] }), false);
  // not an object at all.
  for (const bad of [null, [], "x", 3, undefined]) assert.equal(ok(bad), false);
  const bad = checkAnswer(WORK_ANSWER_SCHEMA, { ...base, extra: 1 });
  assert.equal(bad.ok, false);
  assert.equal(typeof bad.path, "string");
  assert.ok(Object.isFrozen(WORK_ANSWER_SCHEMA));
});

test("EX-02 an unknown keyword of a schema is a program error, not a silent skip", () => {
  for (const schema of [
    { type: "object", pattern: "x" },
    { type: "string", format: "date" },
    { type: "object", properties: { a: { type: "string", oneOf: [] } } },
    { type: "banana" },
    { type: "object", additionalProperties: true },
  ]) {
    assert.throws(
      () => checkAnswer(schema, { a: "x" }),
      (err) => err instanceof TeamError && err.code === "E_INTERNAL",
    );
  }
  assert.deepEqual(
    checkAnswer({ type: "integer", minimum: 1, maximum: 3 }, 3),
    { ok: true },
  );
  assert.equal(checkAnswer({ type: "integer", minimum: 1 }, 0).ok, false);
  assert.equal(checkAnswer({ type: "integer", maximum: 3 }, 4).ok, false);
  assert.equal(checkAnswer({ type: "boolean" }, "true").ok, false);
  assert.equal(checkAnswer({ type: "number" }, Infinity).ok, false);
  assert.equal(checkAnswer({ enum: ["a", "b"] }, "c").ok, false);
  assert.equal(checkAnswer({ type: "array", minItems: 1 }, []).ok, false);
});

// ---- EX-03 ------------------------------------------------------------------------

test("EX-03 new without --executor is claude-cli; scripted needs a readable scenario", (t) => {
  const sb = makeSandbox(t);
  const env = execEnv(sb);
  const r = runTeam(["new", "--goal", "x", "--budget", "1"], env);
  assert.equal(r.status, 0, describeRun(r));
  const out = JSON.parse(r.stdout);
  assert.equal(out.project.executor, "claude-cli");
  assert.equal(out.project.executor_note, undefined);
  assert.equal(stateOf(sb, out.project.id).executor, "claude-cli");
  assert.equal(
    fs.existsSync(path.join(sb.home, out.project.id, "scenario.json")),
    false,
  );

  const before = snapshot(sb.home);
  const countBefore = fs.readdirSync(sb.home).length;
  const missing = path.join(sb.root, "no-such-scenario.json");
  for (const argv of [
    ["new", "--goal", "x", "--budget", "1", "--executor", "scripted"],
    [
      "new",
      "--goal",
      "x",
      "--budget",
      "1",
      "--executor",
      "scripted",
      "--scenario",
      missing,
    ],
    [
      "new",
      "--goal",
      "x",
      "--budget",
      "1",
      "--executor",
      "scripted",
      "--scenario",
      sb.root,
    ],
  ]) {
    const x = runTeam(argv, env);
    assert.equal(x.status, 1, describeRun(x));
    assert.equal(x.stdout, "");
    assert.match(x.stderr, /^E_SCENARIO: /u);
    assert.doesNotMatch(
      x.stderr,
      /no-such-scenario/u,
      "the path is not printed",
    );
    assert.deepEqual(snapshot(sb.home), before);
    assert.equal(fs.readdirSync(sb.home).length, countBefore);
  }
  // --scenario is not allowed with claude-cli.
  const y = runTeam(
    ["new", "--goal", "x", "--budget", "1", "--scenario", missing],
    env,
  );
  assert.equal(y.status, 2, describeRun(y));
  assert.deepEqual(snapshot(sb.home), before);
});

// ---- EX-04 ------------------------------------------------------------------------

test("EX-04 scripted: the first ENGINE event is TASK_STARTED, phrases carry the suffix, executor is scripted", (t) => {
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
  assert.equal(made.status, 0, describeRun(made));
  const created = JSON.parse(made.stdout);
  assert.equal(created.project.executor, "scripted");
  assert.equal(
    created.project.executor_note,
    "тестовый исполнитель — только для тестов",
  );
  const id = created.project.id;
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
  const r = runTeam(["run-task", id, "t-0001"], env);
  assert.equal(r.status, 0, describeRun(r));
  const view = JSON.parse(runTeam(["events", id], env).stdout);
  const engine = view.events.filter(
    (e) => e.source === "ENGINE" && e.type !== "PROJECT_CREATED",
  );
  assert.equal(engine[0].type, "TASK_STARTED");
  assert.match(engine[0].phrase, /тестовый исполнитель$/u);
  for (const e of view.events) {
    if (/^(TASK_|RUN_|AGENT_ACTIVITY)/u.test(e.type)) {
      assert.match(e.phrase, / — тестовый исполнитель$/u, e.type);
    }
    if (e.source === "AGENT") assert.equal(e.data.executor, "scripted");
    if (e.type === "RUN_STARTED") assert.equal(e.data.executor, "scripted");
  }
  assert.ok(view.events.some((e) => e.source === "AGENT"));
});

test("EX-04 scripted: every phrase of a failing, retrying and succeeding journal is marked and never calls itself real", (t) => {
  const sb = makeSandbox(t);
  const outcomes = ["failed", "timeout", "network", "invalid_output"];
  const journals = [];
  const projects = [];
  for (const outcome of outcomes) {
    projects.push(
      makeProject(sb, {
        executor: "scripted",
        scenario_bytes: scenarioBytes([
          {
            match: {},
            steps: [{ activity: "reading" }, { activity: "writing" }],
            result: { outcome, cost_usd: 0 },
          },
        ]),
      }),
    );
  }
  projects.push(
    makeProject(sb, { executor: "scripted", scenario_bytes: FLAKY }),
  );
  projects.push(
    makeProject(sb, { executor: "scripted", scenario_bytes: BASIC }),
  );
  projects.push(
    makeProject(sb, {
      executor: "scripted",
      scenario_bytes: scenarioBytes([
        { match: { attempt: 99 }, steps: [], result: { outcome: "ok" } },
      ]),
    }),
  );
  for (const p of projects) {
    run(sb, p);
    journals.push(journal(p));
  }
  let checked = 0;
  for (const events of journals) {
    const phrases = phrasesForJournal(events);
    events.forEach((e, i) => {
      if (!/^(TASK_|RUN_|AGENT_ACTIVITY)/u.test(e.type)) return;
      checked += 1;
      assert.match(phrases[i], / — тестовый исполнитель$/u, `${e.type}`);
      for (const marker of SCRIPTED_MARKERS) {
        assert.doesNotMatch(phrases[i], marker, `${e.type}: ${phrases[i]}`);
      }
    });
  }
  assert.ok(checked > 40, `phrases checked: ${checked}`);
  // The texts of the table themselves never call a scripted run real.
  for (const row of PHRASES) {
    if (!/^(TASK_|RUN_|AGENT_ACTIVITY)/u.test(row.type)) continue;
    for (const marker of SCRIPTED_MARKERS) {
      assert.doesNotMatch(row.text, marker, `${row.type}: ${row.text}`);
    }
  }
});

// ---- EX-05 ------------------------------------------------------------------------

test("EX-05 claude-cli never turns into scripted: failures keep the executor of the project", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb);
  const runs = [
    runTeamExpectRefusal(
      ["run-task", p.id, p.task],
      execEnv(sb, {
        SAI_TEAM_CLAUDE_BIN: path.join(FIXTURES, "missing-claude"),
      }),
    ),
    runTeam(
      ["run-task", p.id, p.task],
      execEnv(sb, { SAI_TEAM_REAL_RUNS: "0" }),
    ),
  ];
  assert.equal(runs[0].status, 1, describeRun(runs[0]));
  assert.equal(runs[1].status, 1, describeRun(runs[1]));
  const events = journal(p);
  for (const e of events) {
    if (e.type === "PROJECT_CREATED")
      assert.equal(e.data.executor, "claude-cli");
    if (e.data.executor !== undefined) {
      assert.equal(e.data.executor, "claude-cli", e.type);
    }
  }
  assert.equal(stateOf(sb, p.id).executor, "claude-cli");
  const shown = JSON.parse(
    runTeam(["project", p.id], execEnv(sb)).stdout,
  ).project;
  assert.equal(shown.executor, "claude-cli");
  assert.equal(fs.existsSync(path.join(p.dir, "scenario.json")), false);
  assert.equal(fakeStarts(sb).length, 0);
  assert.doesNotMatch(textOf(events), /scripted|тестовый исполнитель/u);
});

// ---- EX-06 ------------------------------------------------------------------------

function walk(dir, visit) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, visit);
    else visit(abs);
  }
}

function readmeSection() {
  const text = fs.readFileSync(
    path.join(TEAM_SRC, "..", "..", "README.md"),
    "utf8",
  );
  const at = text.indexOf("## Sai Team — исполнители");
  assert.ok(at >= 0);
  return text.slice(at);
}

test("EX-06 no demo words, no scenario files and no fixtures path in the code; the README says scripted is for tests only", () => {
  const files = [];
  walk(TEAM_SRC, (f) => files.push(f));
  assert.ok(files.length > 15);
  for (const f of files) {
    const body = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(body, /демо|demo|демонстрац/iu, f);
    assert.doesNotMatch(body, /fixtures\/team/u, f);
    const base = path.basename(f);
    assert.doesNotMatch(base, /scenario|сценари|demo/iu, f);
  }
  const readme = readmeSection();
  for (const line of readme.split("\n")) {
    if (/scripted/u.test(line)) {
      assert.doesNotMatch(line, /демо|demo|демонстрац/iu, line);
    }
  }
  const scriptedLine = readme
    .split("\n")
    .find((l) => l.startsWith("- `scripted`"));
  assert.ok(scriptedLine !== undefined);
  assert.match(scriptedLine, /только для тестов/u);
});

// ---- EX-08 ------------------------------------------------------------------------

test("EX-08 run-task without the exact real-run switch or without a ceiling is refused before any process", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const withCeiling = makeProject(sb);
  const noCeiling = makeProject(sb, { budget_usd: 0 });
  const cases = [
    [
      withCeiling,
      { SAI_TEAM_REAL_RUNS: undefined },
      "E_REAL_RUNS_OFF",
      /SAI_TEAM_REAL_RUNS=1/u,
    ],
    [
      withCeiling,
      { SAI_TEAM_REAL_RUNS: "true" },
      "E_REAL_RUNS_OFF",
      /SAI_TEAM_REAL_RUNS=1/u,
    ],
    [
      withCeiling,
      { SAI_TEAM_REAL_RUNS: "0" },
      "E_REAL_RUNS_OFF",
      /SAI_TEAM_REAL_RUNS=1/u,
    ],
    [
      withCeiling,
      { SAI_TEAM_REAL_RUNS: "yes" },
      "E_REAL_RUNS_OFF",
      /SAI_TEAM_REAL_RUNS=1/u,
    ],
    [
      withCeiling,
      { SAI_TEAM_REAL_RUNS: "" },
      "E_REAL_RUNS_OFF",
      /SAI_TEAM_REAL_RUNS=1/u,
    ],
    [
      withCeiling,
      { SAI_TEAM_REAL_RUNS: "11" },
      "E_REAL_RUNS_OFF",
      /SAI_TEAM_REAL_RUNS=1/u,
    ],
    [noCeiling, { SAI_TEAM_REAL_RUNS: "1" }, "E_NO_BUDGET", /нет потолка/u],
  ];
  for (const [p, over, code, text] of cases) {
    const before = {
      journal: sha256(fs.readFileSync(p.events)),
      tree: snapshot(p.dir),
      status: stateOf(sb, p.id).tasks[0].status,
      project: stateOf(sb, p.id).status,
    };
    const r = run(sb, p, over);
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.stdout, "");
    assert.ok(r.stderr.startsWith(`${code}: `), r.stderr);
    assert.match(r.stderr, text);
    assert.equal(fakeStarts(sb).length, 0, "the fake file was started");
    assert.equal(sha256(fs.readFileSync(p.events)), before.journal);
    assert.deepEqual(snapshot(p.dir), before.tree);
    assert.equal(stateOf(sb, p.id).tasks[0].status, before.status);
    assert.equal(stateOf(sb, p.id).status, before.project);
  }
  // Both conditions: one run.
  const ok = run(sb, withCeiling);
  assert.equal(ok.status, 0, describeRun(ok));
  assert.equal(fakeStarts(sb).length, 1);
});

// ---- EX-09 ------------------------------------------------------------------------

test("EX-09 run() itself refuses without the switch and without a ceiling (the protection is in the same operation)", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const claude = getExecutor("claude-cli");
  const withCeiling = makeProject(sb);
  const noCeiling = makeProject(sb, { budget_usd: 0 });
  const cases = [
    [withCeiling, { SAI_TEAM_REAL_RUNS: undefined }, "E_REAL_RUNS_OFF"],
    [withCeiling, { SAI_TEAM_REAL_RUNS: "true" }, "E_REAL_RUNS_OFF"],
    [noCeiling, { SAI_TEAM_REAL_RUNS: "1" }, "E_NO_BUDGET"],
  ];
  for (const [p, envOver, code] of cases) {
    const before = sha256(fs.readFileSync(p.events));
    const io = ioFor(sb, {}, envOver);
    const request = requestFor(sb, p.id);
    if (p === noCeiling) request.limits.max_budget_usd = 0.1;
    await assert.rejects(
      () => withLimit(claude.run(request, io)),
      (err) => err instanceof TeamError && err.code === code,
    );
    assert.equal(io.events.length, 0, "onEvent not called");
    assert.equal(fakeStarts(sb).length, 0);
    assert.equal(sha256(fs.readFileSync(p.events)), before);
  }
  // The same checks through check().
  for (const [p, envOver, code] of cases) {
    const io = ioFor(sb, {}, envOver);
    const request = requestFor(sb, p.id);
    if (p === noCeiling) request.limits.max_budget_usd = 0.1;
    assert.throws(
      () => claude.check(request, io),
      (err) => err instanceof TeamError && err.code === code,
    );
  }
  // An executor that is not the executor of the project.
  const scr = makeProject(sb, { executor: "scripted", scenario_bytes: BASIC });
  await assert.rejects(
    () => withLimit(claude.run(requestFor(sb, scr.id), ioFor(sb))),
    (err) => err instanceof TeamError && err.code === "E_EXECUTOR",
  );
  await assert.rejects(
    () =>
      withLimit(
        getExecutor("scripted").run(requestFor(sb, withCeiling.id), ioFor(sb)),
      ),
    (err) => err instanceof TeamError && err.code === "E_EXECUTOR",
  );
  assert.throws(
    () => getExecutor("fallback"),
    (err) => err instanceof TeamError && err.code === "E_EXECUTOR",
  );
  assert.throws(() => getExecutor(undefined), TeamError);
  assert.equal(fakeStarts(sb).length, 0);
});

// ---- EX-10 ------------------------------------------------------------------------

test("EX-10 new --budget: 0, negative, text, exponent and seven digits are refused; the API still makes a project with ceiling 0", (t) => {
  const sb = makeSandbox(t);
  const env = execEnv(sb);
  const before = snapshot(sb.home);
  for (const budget of [
    "0",
    "-1",
    "x",
    "1e3",
    "1.1234567",
    "",
    "100001",
    " 1",
  ]) {
    const r = runTeam(["new", "--goal", "x", "--budget", budget], env);
    assert.equal(r.status, 2, `${JSON.stringify(budget)}: ${describeRun(r)}`);
    assert.equal(r.stdout, "");
    assert.ok(r.stderr.startsWith("E_USAGE: "), r.stderr);
    assert.deepEqual(snapshot(sb.home), before);
  }
  const edge = runTeam(["new", "--goal", "x", "--budget", "100000"], env);
  assert.equal(edge.status, 0, describeRun(edge));
  const low = runTeam(["new", "--goal", "x", "--budget", "0.000001"], env);
  assert.equal(low.status, 0, describeRun(low));
  const p = makeProject(sb, { budget_usd: 0 });
  assert.equal(stateOf(sb, p.id).budget_usd, 0);
});

// ---- EX-11 ------------------------------------------------------------------------

// The arguments of Claude Code the test knows, with the number of values.
const FLAGS = new Map([
  ["-p", 0],
  ["--output-format", 1],
  ["--verbose", 0],
  ["--max-budget-usd", 1],
  ["--json-schema", 1],
  ["--tools", 1],
  ["--allowedTools", 1],
  ["--disallowedTools", 1],
  ["--permission-prompts", 1],
  ["--restricted", 0],
  ["--safe-mode", 0],
  ["--strict-mcp-config", 0],
  ["--no-session-persistence", 0],
  ["--append-system-prompt", 1],
]);

function leftovers(argv) {
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (FLAGS.has(argv[i])) i += FLAGS.get(argv[i]);
    else rest.push(argv[i]);
  }
  return rest;
}

test("EX-11 the fake file sees the arguments, the folder and the environment of section 5", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb);
  const r = run(sb, p);
  assert.equal(r.status, 0, describeRun(r));
  const [start] = fakeStarts(sb);
  const argv = start.argv;
  assert.equal(argv[0], "-p");
  assert.equal(argAfter(argv, "--output-format"), "stream-json");
  assert.ok(argv.includes("--verbose"));
  const max = Number(argAfter(argv, "--max-budget-usd"));
  assert.ok(max > 0 && max <= 1, `max budget ${max}`);
  const schema = argAfter(argv, "--json-schema");
  assert.deepEqual(
    JSON.parse(schema),
    JSON.parse(JSON.stringify(WORK_ANSWER_SCHEMA)),
  );
  for (const forbidden of [
    "--add-dir",
    "--dangerously-skip-permissions",
    "--allow-dangerously-skip-permissions",
    "--permission-mode",
    "--bare",
    "--agents",
    "--agent",
    "--mcp-config",
    "--plugin-dir",
    "--plugin-url",
    "--settings",
    "--worktree",
    "--bg",
    "--resume",
    "--continue",
    "--model",
    "--file",
    "--cloud",
  ]) {
    assert.equal(argv.includes(forbidden), false, forbidden);
  }
  assert.deepEqual(leftovers(argv), [], "no positional argument");
  assert.equal(fs.realpathSync(start.cwd), fs.realpathSync(p.work));
  const allowed = new Set([
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TMPDIR",
    "TZ",
    "CLAUDE_CONFIG_DIR",
  ]);
  // macOS adds __CF_USER_TEXT_ENCODING to every process it starts (not our code).
  for (const name of start.env_names) {
    if (name === "__CF_USER_TEXT_ENCODING") continue;
    assert.ok(allowed.has(name), `the process got ${name}`);
  }
  assert.ok(start.env_names.includes("HOME"));
  assert.ok(start.env_names.includes("PATH"));
});

test("EX-11 the folder of the process is the work folder of its own project (two projects)", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const a = makeProject(sb);
  const b = makeProject(sb);
  assert.equal(run(sb, a).status, 0);
  assert.equal(run(sb, b).status, 0);
  const starts = fakeStarts(sb);
  assert.equal(starts.length, 2);
  assert.equal(fs.realpathSync(starts[0].cwd), fs.realpathSync(a.work));
  assert.equal(fs.realpathSync(starts[1].cwd), fs.realpathSync(b.work));
  assert.notEqual(
    fs.realpathSync(starts[0].cwd),
    fs.realpathSync(starts[1].cwd),
  );
});

// ---- EX-12 ------------------------------------------------------------------------

test("EX-12 spawn is called without a shell, detached, with the file of SAI_TEAM_CLAUDE_BIN and an array of arguments", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb);
  const calls = [];
  const io = ioFor(sb, {
    spawn: (...a) => {
      calls.push(a);
      return cp.spawn(...a);
    },
  });
  const result = await withLimit(
    getExecutor("claude-cli").run(requestFor(sb, p.id), io),
  );
  assert.equal(result.outcome, "ok");
  assert.equal(calls.length, 1);
  const [bin, args, options] = calls[0];
  assert.equal(bin, io.env.SAI_TEAM_CLAUDE_BIN);
  assert.ok(Array.isArray(args));
  assert.strictEqual(options.shell, false);
  assert.strictEqual(options.detached, true);
  assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
  assert.equal(options.cwd, requestFor(sb, p.id).limits.work_dir);
  assert.ok(!("ANTHROPIC_API_KEY" in options.env));
});

// ---- EX-13 ------------------------------------------------------------------------

test("EX-13 the code of Sai Team starts a process in one place only: cp.spawn with shell: false", () => {
  const found = [];
  let shells = 0;
  let spawnCalls = 0;
  walk(TEAM_SRC, (f) => {
    const rel = path.relative(TEAM_SRC, f);
    const body = fs.readFileSync(f, "utf8");
    // The pattern of the design (REQ-010 item 15, EX-13) over ALL files of the folder;
    // `.exec(` of a RegExp has a dot before it and is not a match.
    for (const m of body.matchAll(
      /child_process|execFile|execSync|(?:^|[^.\w])exec[(]/gu,
    )) {
      found.push(`${rel}: ${m[0]}`);
    }
    for (const m of body.matchAll(/shell\s*:\s*(\S+)/gu)) {
      shells += 1;
      assert.match(m[1], /^false/u, `${f}: shell: ${m[1]}`);
    }
    spawnCalls += [...body.matchAll(/\bcp\s*\.\s*spawn\b/gu)].length;
    // Other forms of starting a process, anywhere.
    assert.doesNotMatch(body, /\bspawnSync\b/u, f);
    assert.doesNotMatch(body, /\bfork\s*\(/u, f);
    assert.doesNotMatch(body, /import\s*\{[^}]*\b(exec|spawn)\b/u, f);
  });
  assert.deepEqual(
    found,
    [`${path.join("executors", "claude-cli.js")}: child_process`],
    "the only match is the import of child_process in executors/claude-cli.js",
  );
  assert.equal(shells, 1, "exactly one shell: and it is false");
  assert.equal(spawnCalls, 1, "exactly one cp.spawn");
});

// ---- EX-14 ------------------------------------------------------------------------

test("EX-14 the text of the user is stdin byte for byte; it is never an argument and no command runs", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const decoy = path.join(sb.root, "decoy-file");
  const text = `Текст с "двойными" и 'одинарными'; $(touch ${decoy}) \`touch ${decoy}\` && touch ${decoy} | tee ${decoy}\nвторая строка\\n --add-dir /`;
  const p = makeProject(sb, { text });
  const r = run(sb, p);
  assert.equal(r.status, 0, describeRun(r));
  const stdin = fakeStdin(sb, 1);
  assert.ok(stdin.includes(Buffer.from(text, "utf8")), "the text is in stdin");
  const [start] = fakeStarts(sb);
  const joined = start.argv.join("\u0000");
  for (const piece of [
    "двойными",
    "touch",
    "$(",
    "вторая строка",
    "--add-dir /",
  ]) {
    assert.equal(joined.includes(piece), false, `argv has ${piece}`);
  }
  assert.equal(fs.existsSync(decoy), false, "a command of the text ran");
  assert.deepEqual(leftovers(start.argv), []);
});

// ---- EX-15 ------------------------------------------------------------------------

test("EX-15 a missing executable file: not_found, TASK_FAILED executor_not_found, no stack, nothing started", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb);
  const r = runTeamExpectRefusal(
    ["run-task", p.id, p.task],
    execEnv(sb, { SAI_TEAM_CLAUDE_BIN: path.join(FIXTURES, "missing-claude") }),
  );
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(r.stdout, "");
  assert.ok(r.stderr.startsWith("E_EXECUTOR_NOT_FOUND: "), r.stderr);
  assert.doesNotMatch(r.stderr, /\n\s+at /u);
  const events = journal(p);
  assert.deepEqual(types(events).slice(2), [
    "TASK_STARTED",
    "RUN_STARTED",
    "RUN_FINISHED",
    "TASK_FAILED",
  ]);
  assert.equal(ofType(events, "RUN_FINISHED")[0].data.outcome, "not_found");
  assert.equal(
    ofType(events, "TASK_FAILED")[0].data.reason,
    "executor_not_found",
  );
  assert.equal(ofType(events, "BUDGET_SPENT").length, 0, "no process, no cost");
  const view = JSON.parse(runTeam(["events", p.id], execEnv(sb)).stdout);
  assert.equal(
    view.events.find((e) => e.type === "RUN_FINISHED").phrase,
    "Исполнитель недоступен",
  );
  assert.equal(stateOf(sb, p.id).spent_usd, 0);
});

test("EX-15 a relative SAI_TEAM_CLAUDE_BIN is E_CONFIG with exit 2; the journal is unchanged", (t) => {
  const sb = makeSandbox(t);
  const p = makeProject(sb);
  const before = sha256(fs.readFileSync(p.events));
  const r = runTeamExpectRefusal(
    ["run-task", p.id, p.task],
    execEnv(sb, {
      SAI_TEAM_CLAUDE_BIN: "missing-claude-relative",
      PATH: sb.emptyPath,
    }),
  );
  assert.equal(r.status, 2, describeRun(r));
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "E_CONFIG: Неверная настройка SAI_TEAM_CLAUDE_BIN\n");
  assert.equal(sha256(fs.readFileSync(p.events)), before);
  assert.equal(readConfig({}).claudeBin, "claude");
  assert.equal(fakeLog(sb).length, 0);
});

// ---- EX-48 ------------------------------------------------------------------------

test("EX-48 structured_output and a JSON string in result are both accepted; a result that is not JSON is invalid_output", (t) => {
  const sb = makeSandbox(t);
  for (const [sample, expected] of [
    ["stream-ok.jsonl", "Сравнение цен трёх поставщиков готово"],
    ["stream-result-string.jsonl", "Итог пришёл строкой JSON в поле result"],
  ]) {
    writePlan(sb, { default: { stream: sample } });
    fs.rmSync(path.join(sb.user, "fake-claude", "log.jsonl"), { force: true });
    const p = makeProject(sb);
    const r = run(sb, p);
    assert.equal(r.status, 0, describeRun(r));
    assert.equal(ofType(journal(p), "RUN_FINISHED")[0].data.summary, expected);
  }
  writePlan(sb, { default: { stream: "stream-result-text.jsonl" } });
  const bad = makeProject(sb);
  const r = run(sb, bad);
  assert.equal(r.status, 1, describeRun(r));
  const events = journal(bad);
  assert.ok(
    ofType(events, "RUN_FINISHED").every(
      (e) => e.data.outcome === "invalid_output",
    ),
  );
  assert.equal(ofType(events, "TASK_REVIEW").length, 0);
  assert.equal(ofType(events, "TASK_FAILED")[0].data.reason, "invalid_output");
});

// ---- EX-49 ------------------------------------------------------------------------

const ROLE_TOOLS = {
  project_manager: "Read,Write,Edit,Glob,Grep",
  business_analyst: "Read,Write,Edit,Glob,Grep",
  researcher: "Read,Write,Edit,Glob,Grep,WebSearch,WebFetch",
  financial_analyst: "Read,Write,Edit,Glob,Grep",
  lawyer: "Read,Write,Edit,Glob,Grep",
  marketer: "Read,Write,Edit,Glob,Grep",
  designer: "Read,Write,Edit,Glob,Grep",
  developer: "Read,Write,Edit,Glob,Grep",
  reviewer: "Read,Write,Edit,Glob,Grep",
  support: "Read,Write,Edit,Glob,Grep",
};
const DENY =
  "WebFetch(domain:localhost),WebFetch(domain:127.0.0.1),WebFetch(domain:[::1]),WebFetch(domain:0.0.0.0),WebFetch(domain:169.254.169.254)";
// The six flags of isolation, held here as a string of this test (not taken from the code).
const ISOLATION = [
  "--restricted",
  "--safe-mode",
  "--strict-mcp-config",
  "--no-session-persistence",
];

test("EX-49 the arguments equal the table of section 5.2 position by position; every flag of isolation exactly once", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  for (const role of ["researcher", "developer"]) {
    fs.rmSync(path.join(sb.user, "fake-claude", "log.jsonl"), { force: true });
    const p = makeProject(sb, { role });
    const r = run(sb, p);
    assert.equal(r.status, 0, describeRun(r));
    const [start] = fakeStarts(sb);
    const tools = ROLE_TOOLS[role];
    const expected = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--max-budget-usd",
      "0.25",
      "--json-schema",
      JSON.stringify(WORK_ANSWER_SCHEMA),
      "--tools",
      tools,
      "--allowedTools",
      tools,
      ...(role === "researcher" ? ["--disallowedTools", DENY] : []),
      "--permission-prompts",
      "none",
      "--restricted",
      "--safe-mode",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--append-system-prompt",
      roleByCode(role).internal.prompt,
    ];
    assert.deepEqual(start.argv, expected);
    for (const flag of ISOLATION) {
      assert.equal(start.argv.filter((a) => a === flag).length, 1, flag);
    }
    const at = start.argv.indexOf("--permission-prompts");
    assert.equal(start.argv[at + 1], "none");
    assert.equal(
      start.argv.filter((a) => a === "--permission-prompts").length,
      1,
    );
    assert.ok(roleByCode(role).internal.prompt.length > 10);
  }
});
