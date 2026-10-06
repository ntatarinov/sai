// Tests of the parser of `stream-json` and of what a run makes of a stream (design
// REQ-010, section 15.1: EX-18...EX-21; criterion 6). Only the fake executable is
// started, with the recorded samples of tools/test/fixtures/team/.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { getExecutor } from "../src/team/executor.js";
import {
  createStreamParser,
  KNOWN_FIELDS,
} from "../src/team/executors/stream.js";
import {
  FIXTURES,
  describeRun,
  execEnv,
  fakeStarts,
  ioFor,
  journal,
  makeProject,
  makeSandbox,
  ofType,
  requestFor,
  runTeam,
  stateOf,
  writePlan,
  withLimit,
} from "./exec-helpers.js";

function run(sb, p) {
  return runTeam(["run-task", p.id, p.task], execEnv(sb));
}

function feed(lines) {
  const parser = createStreamParser();
  const events = [];
  for (const line of lines) events.push(...parser.push(line).events);
  return { events, summary: parser.finish() };
}

const j = (o) => JSON.stringify(o);
const assistantTool = (name, id = "tu1") =>
  j({
    type: "assistant",
    message: { content: [{ type: "tool_use", id, name, input: {} }] },
  });
const result = (extra = {}) =>
  j({ type: "result", subtype: "success", is_error: false, ...extra });

// ---- EX-18 ------------------------------------------------------------------------

test("EX-18 stream-ok.jsonl: the task is on review, the summary, the cost and the activities follow section 5.5", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-ok.jsonl" } });
  const p = makeProject(sb);
  const r = run(sb, p);
  assert.equal(r.status, 0, describeRun(r));
  const events = journal(p);
  assert.equal(stateOf(sb, p.id).tasks[0].status, "review");
  const finished = ofType(events, "RUN_FINISHED");
  assert.equal(finished.length, 1);
  assert.equal(finished[0].data.outcome, "ok");
  assert.equal(
    finished[0].data.summary,
    "Сравнение цен трёх поставщиков готово",
  );
  assert.equal(finished[0].data.cost_usd, 0.05);
  const spent = ofType(events, "BUDGET_SPENT");
  assert.equal(spent.length, 1);
  assert.equal(spent[0].data.cost_usd, 0.05);
  assert.equal(spent[0].data.accounted, "reported");
  assert.equal(spent[0].data.total_usd, 0.05);
  const acts = ofType(events, "AGENT_ACTIVITY");
  assert.deepEqual(
    acts.map((e) => [e.data.activity, e.data.text]),
    [
      ["reading", null],
      ["writing", null],
      ["thinking", "Сравниваю цены трёх поставщиков"],
    ],
  );
  for (const e of acts) {
    assert.equal(e.source, "AGENT");
    assert.equal(e.data.executor, "claude-cli");
  }
  // The activity was written when it was seen, before the end of the run.
  const lastAct = Date.parse(acts.at(-1).ts);
  assert.ok(lastAct <= Date.parse(finished[0].ts));
  const memory = ofType(events, "MEMORY_ADDED");
  assert.equal(memory.length, 1);
  assert.equal(
    memory[0].data.text,
    "Вымышленный поставщик Б дешевле поставщика А",
  );
});

test("EX-18 the table of tools to activities and the text of the assistant", () => {
  const { events } = feed([
    assistantTool("Read"),
    assistantTool("Glob"),
    assistantTool("Grep"),
    assistantTool("WebSearch"),
    assistantTool("WebFetch"),
    assistantTool("Write"),
    assistantTool("Edit"),
    assistantTool("Bash"),
    assistantTool("Something"),
    j({
      type: "assistant",
      message: { content: [{ type: "text", text: "думаю вслух" }] },
    }),
  ]);
  assert.deepEqual(
    events.map((e) => [e.activity, e.text]),
    [
      ["reading", null],
      ["reading", null],
      ["reading", null],
      ["searching", null],
      ["searching", null],
      ["writing", null],
      ["writing", null],
      ["other", null],
      ["other", null],
      ["thinking", "думаю вслух"],
    ],
  );
  for (const e of events) assert.equal(e.kind, "activity");
});

test("EX-18 the final line: the cost only when it is a finite number >= 0; the answer from structured_output or from a JSON string", () => {
  const cost = (v) => feed([result({ total_cost_usd: v })]).summary.result.cost;
  assert.equal(cost(0.05), 0.05);
  assert.equal(cost(0), 0);
  assert.equal(cost(-1), null);
  assert.equal(cost("0.05"), null);
  assert.equal(cost(null), null);
  assert.equal(feed([result()]).summary.result.cost, null);
  const a = feed([result({ structured_output: { summary: "s", files: [] } })]);
  assert.deepEqual(a.summary.result.answer, { summary: "s", files: [] });
  const b = feed([result({ result: '{"summary":"s","files":[]}' })]);
  assert.deepEqual(b.summary.result.answer, { summary: "s", files: [] });
  assert.equal(
    feed([result({ result: "не JSON" })]).summary.result.answer,
    null,
  );
  assert.equal(feed([result({ result: "[1]" })]).summary.result.answer, null);
  assert.equal(feed([result()]).summary.result.answer, null);
  // structured_output wins over result.
  const c = feed([
    result({
      structured_output: { summary: "a", files: [] },
      result: '{"summary":"b","files":[]}',
    }),
  ]);
  assert.equal(c.summary.result.answer.summary, "a");
});

test("EX-18 a result line needs subtype and is_error; a second result line is a broken stream", () => {
  assert.equal(
    feed([j({ type: "result", is_error: false })]).summary.broken,
    1,
  );
  assert.equal(
    feed([j({ type: "result", subtype: "success" })]).summary.broken,
    1,
  );
  assert.equal(
    feed([j({ type: "result", subtype: 5, is_error: false })]).summary.broken,
    1,
  );
  const twice = feed([result(), result()]);
  assert.equal(twice.summary.broken, 1);
  assert.equal(twice.summary.result.subtype, "success");
  assert.equal(feed([result()]).summary.broken, 0);
});

test("EX-18 a network error: only an error result of WebFetch/WebSearch counts, not of another tool", () => {
  const toolResult = (id, isError) =>
    j({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: id,
            content: "x",
            is_error: isError,
          },
        ],
      },
    });
  assert.equal(
    feed([assistantTool("WebFetch", "a"), toolResult("a", true)]).summary
      .webError,
    true,
  );
  assert.equal(
    feed([assistantTool("WebSearch", "a"), toolResult("a", true)]).summary
      .webError,
    true,
  );
  assert.equal(
    feed([assistantTool("Read", "a"), toolResult("a", true)]).summary.webError,
    false,
  );
  assert.equal(
    feed([assistantTool("WebFetch", "a"), toolResult("a", false)]).summary
      .webError,
    false,
  );
  assert.equal(
    feed([assistantTool("WebFetch", "a"), toolResult("unknown", true)]).summary
      .webError,
    false,
  );
  const searchBad = j({
    type: "user",
    message: {
      content: [{ type: "web_search_tool_result", content: { error: "x" } }],
    },
  });
  assert.equal(feed([searchBad]).summary.webError, true);
  const searchGood = j({
    type: "user",
    message: { content: [{ type: "web_search_tool_result", content: [] }] },
  });
  assert.equal(feed([searchGood]).summary.webError, false);
});

// ---- EX-19 ------------------------------------------------------------------------

test("EX-19 a line of an unknown type does not fail the task: it is skipped and counted", async (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, { default: { stream: "stream-unknown-type.jsonl" } });
  const p = makeProject(sb);
  const io = ioFor(sb);
  const res = await withLimit(
    getExecutor("claude-cli").run(requestFor(sb, p.id), io),
  );
  assert.equal(res.outcome, "ok");
  assert.ok(res.stats.skipped >= 1, `skipped ${res.stats.skipped}`);
  assert.equal(res.stats.activities, 2);
  // The same through the command.
  const r = run(sb, p);
  assert.equal(r.status, 0, describeRun(r));
  assert.equal(stateOf(sb, p.id).tasks[0].status, "review");
});

test("EX-19 unknown types, system lines and lines without content are skipped", () => {
  const { summary, events } = feed([
    j({ type: "system", subtype: "init" }),
    j({ type: "system", subtype: "whatever" }),
    j({ type: "stream_event" }),
    j({ type: "rate_limit_event", info: {} }),
    j({ type: "assistant", message: {} }),
    j({ type: "user", message: { content: "text" } }),
    result(),
  ]);
  assert.equal(summary.broken, 0);
  assert.equal(summary.skipped, 6);
  assert.equal(summary.lines, 7);
  assert.deepEqual(events, []);
  assert.notEqual(summary.result, null);
});

// ---- EX-20 ------------------------------------------------------------------------

for (const sample of ["stream-not-json.jsonl", "stream-no-result.jsonl"]) {
  test(`EX-20 ${sample}: invalid_output three times, two retries, a clean exit with no stack`, (t) => {
    const sb = makeSandbox(t);
    writePlan(sb, { default: { stream: sample } });
    const p = makeProject(sb);
    const r = run(sb, p);
    assert.equal(r.status, 1, describeRun(r));
    assert.equal(r.stdout, "");
    assert.equal(
      r.stderr,
      "E_TASK_FAILED: Задача не получилась: Исполнитель прислал неверный вывод\n",
    );
    assert.doesNotMatch(r.stderr, /\n\s+at /u);
    const events = journal(p);
    const finished = ofType(events, "RUN_FINISHED");
    assert.equal(finished.length, 3);
    for (const e of finished) {
      assert.equal(e.data.outcome, "invalid_output");
      assert.equal(e.data.summary, null);
      assert.deepEqual(e.data.files, []);
    }
    const retry = ofType(events, "TASK_RETRY");
    assert.equal(retry.length, 2);
    for (const e of retry) assert.equal(e.data.reason, "invalid_output");
    const failed = ofType(events, "TASK_FAILED");
    assert.equal(failed.length, 1);
    assert.equal(failed[0].data.reason, "invalid_output");
    assert.equal(ofType(events, "TASK_REVIEW").length, 0);
    assert.equal(fakeStarts(sb).length, 3);
    assert.equal(stateOf(sb, p.id).tasks[0].status, "failed");
  });
}

test("EX-20 a broken line is counted, not fatal for the parser: the rest of the stream is still read", () => {
  const { summary, events } = feed([
    j({ type: "system", subtype: "init" }),
    "это не JSON",
    "[1,2]",
    "123",
    j({ no_type: true }),
    assistantTool("Read"),
    result(),
  ]);
  assert.equal(summary.broken, 4);
  assert.equal(events.length, 1);
  assert.notEqual(summary.result, null);
  // An empty line is not a line.
  assert.equal(feed(["", "   "]).summary.lines, 0);
});

// ---- EX-21 ------------------------------------------------------------------------

// The names of the fields found in the installed Claude Code 2.1.289 by a search
// of strings (`grep -c -a -F`, nothing was run): design REQ-010, F6; plus the fields
// of the answer schema inside structured_output (section 3.3).
const F6 = new Set([
  "type",
  "subtype",
  "message",
  "content",
  "text",
  "name",
  "id",
  "input",
  "is_error",
  "tool_use_id",
  "session_id",
  "total_cost_usd",
  "structured_output",
  "num_turns",
  "duration_ms",
  "permission_denials",
  "parent_tool_use_id",
  "result",
]);
const ANSWER_FIELDS = new Set([
  "summary",
  "files",
  "path",
  "kind",
  "memory",
  "text",
]);

function collectKeys(value, inAnswer, out, file) {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, inAnswer, out, file);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, v] of Object.entries(value)) {
    out.push({ key, inAnswer, file });
    collectKeys(v, inAnswer || key === "structured_output", out, file);
  }
}

test("EX-21 every sample has a source line in the README; the samples hold no invented field", () => {
  const readme = fs.readFileSync(path.join(FIXTURES, "README.md"), "utf8");
  const samples = fs
    .readdirSync(FIXTURES)
    .filter((n) => /^stream-.*\.jsonl$/u.test(n));
  assert.ok(samples.length >= 9, `samples: ${samples.length}`);
  for (const name of samples) {
    const row = readme
      .split("\n")
      .find((l) => l.includes(`\`${name}\``) && l.startsWith("|"));
    assert.ok(row !== undefined, `${name} has no row in the README`);
    assert.match(row, /форма по `claude --help` 2\.1\.289|то же/u, name);
  }
  assert.match(readme, /Источник образцов/u);
  assert.match(readme, /2\.1\.289/u);
  const keys = [];
  for (const name of samples) {
    for (const line of fs
      .readFileSync(path.join(FIXTURES, name), "utf8")
      .split("\n")) {
      if (line === "") continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue; // the sample "not JSON" has such a line on purpose
      }
      collectKeys(obj, false, keys, name);
    }
  }
  const invented = keys.filter(({ key, inAnswer, file }) => {
    if (inAnswer) {
      return (
        !ANSWER_FIELDS.has(key) &&
        !(file === "stream-out-of-schema.jsonl" && key === "extra")
      );
    }
    return !F6.has(key);
  });
  assert.deepEqual(invented, []);
  assert.ok(keys.length > 60);
});

test("EX-21 the fields the parser reads are names from the list of the installed file", () => {
  const known = new Set(KNOWN_FIELDS);
  for (const name of known) assert.ok(F6.has(name), `the parser reads ${name}`);
  assert.ok(known.has("structured_output"));
  assert.ok(known.has("total_cost_usd"));
});
