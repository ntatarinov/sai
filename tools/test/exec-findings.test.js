// Tests of the findings of the security and review gates of REQ-010 (step 12 and 13
// of the run, repaired at step 12f): a cost that is not a cost, a rest that is not a
// number, a link put in place of a folder, a line without a break, a descendant that
// keeps stdout. The probes are those of the report of the repair. Only the fake
// executables of tools/test/fixtures/team/ are started; every process a probe leaves
// is killed by the test itself.
import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { readConfig } from "../src/team/config.js";
import { TeamError } from "../src/team/errors.js";
import { checkBudget, getExecutor } from "../src/team/executor.js";
import { createStreamParser } from "../src/team/executors/stream.js";
import { FAIL_DETAIL } from "../src/team/language.js";
import { recordableCost, runTask } from "../src/team/runner.js";
import { openWriter } from "../src/team/store.js";
import {
  assertSafeEnv,
  describeRun,
  execEnv,
  fakeLog,
  fakeStarts,
  ioFor,
  journal,
  killQuietly,
  makeProject,
  makeSandbox,
  ofType,
  pidAlive,
  probeClaudePath,
  requestFor,
  runTeam,
  sha256,
  stateOf,
  types,
  waitUntil,
  writePlan,
  writeRawPlan,
  withLimit,
} from "./exec-helpers.js";

const argAfter = (argv, flag) => argv[argv.indexOf(flag) + 1];

// ---- the cost of a run is not trusted -------------------------------------------------

test("a reported cost that is huge, negative or not a number is not a cost: the run is charged with its ceiling, assumed, and the sum grows", (t) => {
  const sb = makeSandbox(t);
  for (const raw of ["1e303", "1e21", "1e10", "-1", "1e999", "-1e999"]) {
    fs.rmSync(path.join(sb.user, "fake-claude"), {
      recursive: true,
      force: true,
    });
    writeRawPlan(
      sb,
      `{"default":{"stream":"stream-ok.jsonl","set_cost":${raw}}}`,
    );
    const p = makeProject(sb, { tasks: 2 });
    const first = runTeam(["run-task", p.id, "t-0001"], execEnv(sb));
    assert.equal(first.status, 0, `${raw}: ${describeRun(first)}`);
    let events = journal(p);
    assert.equal(ofType(events, "RUN_FINISHED")[0].data.cost_usd, null, raw);
    assert.deepEqual(
      ofType(events, "BUDGET_SPENT")[0].data,
      {
        run_id: "r-00001",
        cost_usd: 0.25,
        accounted: "assumed",
        total_usd: 0.25,
      },
      raw,
    );
    const second = runTeam(["run-task", p.id, "t-0002"], execEnv(sb));
    assert.equal(second.status, 0, `${raw}: ${describeRun(second)}`);
    assert.equal(
      argAfter(fakeStarts(sb)[1].argv, "--max-budget-usd"),
      "0.25",
      `${raw}: the ceiling of the second run`,
    );
    events = journal(p);
    const spent = ofType(events, "BUDGET_SPENT");
    assert.equal(spent.length, 2, raw);
    assert.equal(spent[1].data.total_usd, 0.5, raw);
    assert.equal(spent[1].data.accounted, "assumed", raw);
    assert.equal(stateOf(sb, p.id).spent_usd, 0.5, raw);
  }
});

test("a reported cost of 5e8 is written as it is and the next run is refused", (t) => {
  const sb = makeSandbox(t);
  writeRawPlan(sb, '{"default":{"stream":"stream-ok.jsonl","set_cost":5e8}}');
  const p = makeProject(sb, { tasks: 2 });
  const first = runTeam(["run-task", p.id, "t-0001"], execEnv(sb));
  assert.equal(first.status, 0, describeRun(first));
  const spent = ofType(journal(p), "BUDGET_SPENT")[0].data;
  assert.equal(spent.cost_usd, 500_000_000);
  assert.equal(spent.accounted, "reported");
  assert.equal(spent.total_usd, 500_000_000);
  const second = runTeam(["run-task", p.id, "t-0002"], execEnv(sb));
  assert.equal(second.status, 1, describeRun(second));
  assert.ok(second.stderr.startsWith("E_BUDGET_EXHAUSTED: "), second.stderr);
  assert.equal(fakeStarts(sb).length, 1, "a process was started with no rest");
  assert.equal(types(journal(p)).at(-1), "RUN_REFUSED");
});

test("recordableCost: only a finite number >= 0 whose rounding is at most 1e9", () => {
  for (const bad of [
    1e303,
    1e21,
    1e16,
    1e9 + 1,
    Number.MAX_VALUE,
    -1,
    -0.000001,
    Number.NaN,
    "abc",
    "0.5",
    Infinity,
    -Infinity,
    null,
    undefined,
    true,
    {},
    [],
  ]) {
    assert.equal(recordableCost(bad), null, String(bad));
  }
  assert.equal(recordableCost(1e9), 1e9);
  assert.equal(recordableCost(5e8), 5e8);
  assert.equal(recordableCost(0), 0);
  assert.equal(recordableCost(0.123456789), 0.123457);
  assert.equal(recordableCost(0.05), 0.05);
});

test("the parser takes a cost only when it is a finite number >= 0, also for a literal too big for a double", () => {
  const cost = (text) => {
    const p = createStreamParser();
    p.push(
      `{"type":"result","subtype":"success","is_error":false,"total_cost_usd":${text}}`,
    );
    return p.finish().result.cost;
  };
  assert.equal(cost("1e999"), null);
  assert.equal(cost("-1e999"), null);
  assert.equal(cost("-0.5"), null);
  assert.equal(cost('"1"'), null);
  assert.equal(cost("0.25"), 0.25);
  assert.equal(cost("0"), 0);
});

// ---- the rest is a number --------------------------------------------------------------

test("checkBudget refuses a rest that is not a finite number (NaN, a string, Infinity) and accepts a good one", () => {
  const req = (budget, spent, max) => ({
    project: { budget_usd: budget, spent_usd: spent },
    limits: { max_budget_usd: max },
  });
  const refused = (r, label) =>
    assert.throws(
      () => checkBudget(r),
      (err) => err instanceof TeamError && err.code === "E_BUDGET_EXHAUSTED",
      label,
    );
  refused(req(1, Number.NaN, 0.25), "spent NaN");
  refused(req(1, "0", 0.25), "spent a string");
  refused(req("1", 0, 0.25), "budget a string");
  refused(req(Infinity, 0, 0.25), "budget Infinity");
  refused(req(1, Infinity, 0.25), "spent Infinity");
  refused(req(Number.NaN, 0, null), "budget NaN, no ceiling");
  refused(req(undefined, 0, null), "budget undefined");
  refused(req(1, null, 0.25), "spent null");
  refused(req(1, 0, Number.NaN), "ceiling NaN");
  refused(req(1, 0, "0.25"), "ceiling a string");
  refused(req(1, 0, Infinity), "ceiling Infinity");
  checkBudget(req(1, 0, 0.25));
  checkBudget(req(0, 0, null));
});

test("run() of claude-cli with such a rest throws before spawn: the spawn function is never called and no process starts", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-ok.jsonl" } });
  const p = makeProject(sb);
  for (const [budget, spent] of [
    [1, Number.NaN],
    ["1", 0],
    [1, Infinity],
    [Infinity, 0],
  ]) {
    let spawned = 0;
    const io = ioFor(sb, {
      spawn: (...a) => {
        spawned += 1;
        return cp.spawn(...a);
      },
    });
    const request = requestFor(sb, p.id);
    request.project = {
      ...request.project,
      budget_usd: budget,
      spent_usd: spent,
    };
    await assert.rejects(
      () => withLimit(getExecutor("claude-cli").run(request, io)),
      (err) => err instanceof TeamError && err.code === "E_BUDGET_EXHAUSTED",
      `${budget}/${spent}`,
    );
    assert.equal(spawned, 0, `${budget}/${spent}: spawn was called`);
    assert.equal(io.events.length, 0);
  }
  assert.equal(fakeStarts(sb).length, 0);
});

// ---- a link put in place of a folder after the check ------------------------------------

async function runWithSwap(t, swap) {
  const sb = makeSandbox(t);
  writePlan(sb, {
    default: {
      stream: "stream-ok.jsonl",
      work_files: [{ path: "out/report.md", content: "Итог работы\n" }],
      answer_files: ["out/report.md"],
    },
  });
  const p = makeProject(sb);
  const outside = path.join(sb.root, "outside-folder");
  fs.mkdirSync(outside);
  const decoy = path.join(outside, "report.md");
  fs.writeFileSync(decoy, "чужой файл вне проекта\n");
  const env = execEnv(sb);
  assertSafeEnv(env);
  const writer = openWriter(p.id, { home: sb.home });
  t.after(() => writer.close());
  const original = writer.importWorkFile.bind(writer);
  writer.importWorkFile = (file) => {
    const result = original(file);
    swap({ p, outside });
    return result;
  };
  const res = await withLimit(
    runTask(writer, "t-0001", { env, config: readConfig(env) }),
  );
  return { sb, p, res, decoy, outside };
}

test("removeSource: when work/out is replaced by a link to a folder outside after the import, the outside file is untouched", async (t) => {
  const { p, res, decoy } = await runWithSwap(t, ({ p, outside }) => {
    fs.renameSync(path.join(p.work, "out"), path.join(p.work, "out-moved"));
    fs.symlinkSync(outside, path.join(p.work, "out"));
  });
  assert.equal(res.status, "review", JSON.stringify(res.error));
  assert.equal(fs.readFileSync(decoy, "utf8"), "чужой файл вне проекта\n");
  assert.deepEqual(fs.readdirSync(p.files), ["t-0001-1-report.md"]);
  assert.equal(fs.lstatSync(path.join(p.work, "out")).isSymbolicLink(), true);
});

test("removeSource: when the file itself is replaced by a link to an outside file, the outside file is untouched", async (t) => {
  const { p, res, decoy } = await runWithSwap(t, ({ p, outside }) => {
    const file = path.join(p.work, "out", "report.md");
    fs.rmSync(file);
    fs.symlinkSync(path.join(outside, "report.md"), file);
  });
  assert.equal(res.status, "review", JSON.stringify(res.error));
  assert.equal(fs.readFileSync(decoy, "utf8"), "чужой файл вне проекта\n");
  assert.equal(
    fs.lstatSync(path.join(p.work, "out", "report.md")).isSymbolicLink(),
    true,
  );
});

test("removeSource: without a swap the accepted source is removed as before", async (t) => {
  const { p, res, decoy } = await runWithSwap(t, () => {});
  assert.equal(res.status, "review", JSON.stringify(res.error));
  assert.equal(fs.existsSync(path.join(p.work, "out", "report.md")), false);
  assert.equal(fs.readFileSync(decoy, "utf8"), "чужой файл вне проекта\n");
});

// ---- a line without a break --------------------------------------------------------------

function useProbe(sb, plan) {
  writeRawPlan(sb, JSON.stringify(plan), "probe.json");
  return { SAI_TEAM_CLAUDE_BIN: probeClaudePath() };
}

test("a line of 9 MiB without a line break is refused as too big, the process is stopped, and memory does not grow several times over", async (t) => {
  const sb = makeSandbox(t);
  const over = useProbe(sb, { mode: "big-line", bytes: 9 * 1024 * 1024 });
  const p = makeProject(sb);
  const io = ioFor(sb, {}, over);
  let peak = process.memoryUsage().rss;
  const base = peak;
  const sampler = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, 5);
  let res;
  try {
    res = await withLimit(
      getExecutor("claude-cli").run(requestFor(sb, p.id), io),
    );
  } finally {
    clearInterval(sampler);
    for (const e of fakeLog(sb, "probe-log.jsonl"))
      if (e.pid) killQuietly(e.pid);
  }
  peak = Math.max(peak, process.memoryUsage().rss);
  assert.equal(res.outcome, "invalid_output");
  assert.equal(res.detail, FAIL_DETAIL.too_big);
  assert.equal(res.transient, true);
  assert.equal(res.spawned, true);
  assert.equal(res.answer, null);
  const growth = (peak - base) / (1024 * 1024);
  assert.ok(
    growth < 80,
    `memory grew by ${growth.toFixed(0)} MiB for a 9 MiB line`,
  );
  const [started] = fakeLog(sb, "probe-log.jsonl");
  assert.ok(
    await waitUntil(() => !pidAlive(started.pid), 3000),
    "the process is alive",
  );
});

test("a stream cut into pieces of 1-3 bytes, with no final line break, is read whole, and its activities come while it is written", async (t) => {
  const sb = makeSandbox(t);
  const over = useProbe(sb, {
    mode: "split",
    sample: "stream-ok.jsonl",
    max_chunk: 3,
  });
  const p = makeProject(sb);
  const times = [];
  const io = ioFor(sb, { onEvent: () => times.push(Date.now()) }, over);
  const res = await withLimit(
    getExecutor("claude-cli").run(requestFor(sb, p.id), io),
  );
  const end = Date.now();
  assert.equal(res.outcome, "ok");
  assert.equal(res.stats.lines, 7);
  assert.equal(res.stats.activities, 3);
  assert.equal(res.stats.skipped, 1);
  assert.equal(res.cost_usd, 0.05);
  assert.equal(times.length, 3);
  assert.ok(
    end - times[0] >= 150,
    `the first activity came ${end - times[0]} ms before the end`,
  );
});

// ---- a descendant outside the group keeps stdout ------------------------------------------

function orphanPid(sb) {
  const file = path.join(sb.user, "fake-claude", "orphan.pid");
  return fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8")) : null;
}

test("a descendant outside the group that keeps stdout: run() returns at the timeout, with the detail 'group', not waiting for it", async (t) => {
  const sb = makeSandbox(t);
  const over = useProbe(sb, { mode: "orphan-stdout" });
  const p = makeProject(sb);
  const request = requestFor(sb, p.id);
  request.limits.timeout_ms = 1500;
  const io = ioFor(sb, {}, over);
  const began = Date.now();
  let res;
  try {
    res = await withLimit(getExecutor("claude-cli").run(request, io));
  } finally {
    const pid = orphanPid(sb);
    if (pid !== null) killQuietly(pid);
  }
  const took = Date.now() - began;
  assert.ok(took < 5000, `run() took ${took} ms`);
  assert.equal(res.outcome, "timeout");
  assert.equal(res.detail, FAIL_DETAIL.group);
  assert.equal(res.transient, false);
  assert.equal(res.spawned, true);
  const pid = orphanPid(sb);
  assert.ok(pid !== null, "the probe did not start its descendant");
  assert.ok(
    await waitUntil(() => !pidAlive(pid), 3000),
    "the test left a process",
  );
});

test("the same with a long timeout: run() returns after the bounded wait, with 'group' and no retry", async (t) => {
  const sb = makeSandbox(t);
  const over = useProbe(sb, { mode: "orphan-stdout" });
  const p = makeProject(sb);
  const request = requestFor(sb, p.id);
  request.limits.timeout_ms = 60_000;
  const io = ioFor(sb, {}, over);
  const began = Date.now();
  let res;
  try {
    res = await withLimit(getExecutor("claude-cli").run(request, io));
  } finally {
    const pid = orphanPid(sb);
    if (pid !== null) killQuietly(pid);
  }
  const took = Date.now() - began;
  assert.ok(took < 10_000, `run() took ${took} ms`);
  assert.equal(res.detail, FAIL_DETAIL.group);
  assert.equal(res.transient, false);
  assert.notEqual(res.outcome, "ok");
});

test("the task with such a descendant: one run, no retry, TASK_FAILED with the text of the group, no process of the probe left", async (t) => {
  const sb = makeSandbox(t);
  const over = useProbe(sb, { mode: "orphan-stdout" });
  const p = makeProject(sb);
  let r;
  try {
    r = runTeam(
      ["run-task", p.id, p.task],
      execEnv(sb, { ...over, SAI_TEAM_TASK_TIMEOUT_MS: "1500" }),
    );
  } finally {
    const pid = orphanPid(sb);
    if (pid !== null) killQuietly(pid);
  }
  assert.equal(r.status, 1, describeRun(r));
  assert.equal(
    r.stderr,
    "E_TASK_FAILED: Задача не получилась: Не удалось остановить процессы исполнителя\n",
  );
  const events = journal(p);
  assert.equal(ofType(events, "RUN_STARTED").length, 1);
  assert.equal(ofType(events, "TASK_RETRY").length, 0);
  assert.equal(ofType(events, "RUN_FINISHED")[0].data.outcome, "timeout");
  const failed = ofType(events, "TASK_FAILED")[0];
  assert.equal(failed.data.reason, "retries_exhausted");
  assert.equal(failed.data.detail, FAIL_DETAIL.group);
  assert.equal(
    fakeLog(sb, "probe-log.jsonl").length,
    1,
    "the process of the probe ran once",
  );
  const pid = orphanPid(sb);
  assert.ok(
    await waitUntil(() => !pidAlive(pid), 3000),
    "the test left a process",
  );
  assert.equal(sha256(fs.readFileSync(p.events)).length, 64);
});
