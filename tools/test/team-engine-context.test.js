// Sai Team engine: the input of a task (design REQ-013, section 7; criterion 4:
// EN-25, EN-26). Only the scripted executor is started, after assertSafeEnv.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { journal } from "./exec-helpers.js";
import {
  GOAL,
  ok,
  WORK_OK,
  PASS,
  GOAL_OK,
  scenarioRun,
  planRun,
  item,
  engineProject,
  runToEnd,
} from "./team-engine-helpers.js";

const withFile = (task, name, content, memory = []) =>
  scenarioRun(
    { purpose: "work", task },
    {
      ...ok({ summary: "Готово", files: [], memory }),
      files: [{ name, content }],
    },
  );

function contextProject(t, marks) {
  return engineProject(t, [
    planRun(
      [item("a"), item("b"), item("c", { depends_on: ["a"] })],
      [{ record_input: "plan.md" }],
    ),
    withFile("t-0001", "prices.md", marks.a, [
      { kind: "fact", text: marks.memory },
    ]),
    withFile("t-0002", "other.md", marks.b),
    scenarioRun({ purpose: "work", task: "t-0003" }, WORK_OK, [
      { record_input: "input.md" },
    ]),
    scenarioRun({ purpose: "review" }, PASS, [{ record_input: "review.md" }]),
    scenarioRun({ purpose: "goal_check" }, GOAL_OK, [
      { record_input: "goal.md" },
    ]),
  ]);
}

// ---- EN-25 -----------------------------------------------------------------------

test(
  "EN-25 the input of a task: the goal, the memory, the names and the contents of the files of every dependency; no file of an independent task, nothing of another project",
  { timeout: 60_000 },
  async (t) => {
    const other = contextProject(t, {
      a: "ВТОРОЙ-ПРОЕКТ-ЦЕНЫ",
      b: "ВТОРОЙ-ПРОЕКТ-ДРУГОЕ",
      memory: "ВТОРОЙ-ПРОЕКТ-ПАМЯТЬ",
    });
    assert.equal((await runToEnd(other, { parallel: 1 })).status, "done");
    const p = contextProject(t, {
      a: "Вымышленные цены: А — 100, Б — 90",
      b: "НЕЗАВИСИМАЯ-ЗАДАЧА-Б",
      memory: "Вымышленный поставщик Б дешевле",
    });
    assert.equal((await runToEnd(p, { parallel: 1 })).status, "done");
    const events = journal(p);
    const doneB = events.find(
      (e) => e.type === "TASK_DONE" && e.task === "t-0002",
    );
    const startC = events.find(
      (e) => e.type === "TASK_STARTED" && e.task === "t-0003",
    );
    assert.ok(doneB.seq < startC.seq, "the file of b exists when c begins");
    const name = events.find(
      (e) => e.type === "RESULT_FILE" && e.data.name.endsWith("-input.md"),
    ).data.name;
    const input = fs.readFileSync(path.join(p.dir, "files", name), "utf8");
    assert.ok(input.includes(`## Цель проекта\n${GOAL}`));
    assert.ok(input.includes("— fact: Вымышленный поставщик Б дешевле"));
    assert.ok(input.includes("## Результаты задач, от которых зависит эта"));
    assert.ok(
      input.includes(
        "### t-0001-1-prices.md\nВымышленные цены: А — 100, Б — 90",
      ),
    );
    assert.equal(input.includes("НЕЗАВИСИМАЯ-ЗАДАЧА-Б"), false);
    assert.equal(input.includes("other.md"), false);
    assert.equal(input.includes("ВТОРОЙ-ПРОЕКТ"), false);
    assert.equal(input.includes(other.id), false);
  },
);

// ---- EN-26 -----------------------------------------------------------------------

test(
  "EN-26 no input of an agent (plan, work, review, goal check) names the files of the core or the folder of the project",
  { timeout: 60_000 },
  async (t) => {
    const p = contextProject(t, { a: "Цены", b: "Другое", memory: "Факт" });
    assert.equal((await runToEnd(p)).status, "done");
    const names = journal(p)
      .filter(
        (e) =>
          e.type === "RESULT_FILE" &&
          /-(plan|input|review|goal)\.md$/.test(e.data.name),
      )
      .map((e) => e.data.name);
    assert.ok(names.length >= 6, names.join(", "));
    for (const name of names) {
      const input = fs.readFileSync(path.join(p.dir, "files", name), "utf8");
      for (const bad of [
        "events.jsonl",
        "writer.lock",
        "inbox",
        p.dir,
        p.sb.home,
      ]) {
        assert.equal(input.includes(bad), false, `${name}: ${bad}`);
      }
    }
  },
);
