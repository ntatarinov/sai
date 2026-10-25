// Sai Team engine: the README and the guard of the tests (design REQ-013, section
// 21, criterion 12: EN-75, EN-76; EN-77 is a command run in the report of the step).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TOOLS_DIR } from "./exec-helpers.js";

const HEAD = "## Sai Team — the engine";

function section() {
  const text = fs.readFileSync(path.join(TOOLS_DIR, "README.md"), "utf8");
  const at = text.indexOf(`\n${HEAD}\n`);
  assert.notEqual(at, -1, "no section of the engine");
  assert.equal(text.indexOf(`\n${HEAD}\n`, at + 1), -1, "the section twice");
  const rest = text.slice(at + HEAD.length + 2);
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
}

test("EN-75 the README has the section of the engine with every subsection of the design and its key lines", () => {
  const body = section();
  for (const heading of [
    "### How a goal becomes a plan",
    "### Parallelism",
    "### The context of a task",
    "### The check of a result",
    "### Approvals",
    "### The spending ceiling",
    "### Completion",
    "### Pause, resume, stop, Ctrl-C",
    "### Recovery after a crash",
    "### The channel of commands",
    "### Engine commands",
    "### Residual risks",
  ]) {
    assert.ok(body.includes(`\n${heading}\n`), heading);
  }
  for (const line of [
    "**one repeat attempt**",
    "--parallel 1",
    "**only** of the tasks it depends on",
    "a separate run",
    "the engine does not perform the action outside",
    "**reserve**",
    "no more than two rounds",
    "Ctrl-C",
    "inbox/",
    "does not write or repeat by itself",
    "no longer than 10 s",
  ]) {
    assert.ok(body.includes(line), line);
  }
  for (const command of [
    "start",
    "pause",
    "resume",
    "stop",
    "answer",
    "budget",
    "say",
  ]) {
    assert.ok(body.includes(`npm run team -- ${command} p-`), command);
  }
  assert.equal(/sk-|ghp_|AKIA/.test(body), false, "no secret in the README");
});

// The code of a file without its comments (a word in a comment is not a call).
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
    .join("\n");
}

// The local names a file imports from a module: Map<local, imported>.
function importsFrom(text, module) {
  const out = new Map();
  const re = /import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g;
  for (const m of text.matchAll(re)) {
    if (m[2] !== module) continue;
    for (const part of m[1].split(",")) {
      const [name, local] = part.trim().split(/\s+as\s+/);
      if (name) out.set(local ?? name, name);
    }
  }
  return out;
}

// Each function of a helper module that starts an executor or the engine calls
// assertSafeEnv( before its first start (by its code, not its comments).
function guardedHelpers(file, starts) {
  const text = code(fs.readFileSync(file, "utf8"));
  const guarded = new Set();
  for (const chunk of text.split(/\nexport (?:async )?function /).slice(1)) {
    const name = chunk.match(/^(\w+)/)[1];
    const body = chunk.slice(chunk.indexOf("{"));
    const first = body.search(starts);
    if (first === -1) continue;
    const guard = body.indexOf("assertSafeEnv(");
    assert.ok(guard !== -1 && guard < first, `${path.basename(file)}: ${name}`);
    guarded.add(name);
  }
  return guarded;
}

test("EN-76 every test file of Sai Team that starts start, resume, run-task or the engine calls assertSafeEnv itself, or starts them only through a helper that calls it before every start", () => {
  const dir = path.join(TOOLS_DIR, "test");
  const exec = guardedHelpers(
    path.join(dir, "exec-helpers.js"),
    /spawnSync\(|spawn\(|runTeam\(/,
  );
  const engine = guardedHelpers(
    path.join(dir, "team-engine-helpers.js"),
    /createEngine\(|spawnTeam\(/,
  );
  for (const name of ["runTeam", "spawnTeam", "runTeamExpectRefusal"]) {
    assert.ok(exec.has(name), name);
  }
  for (const name of [
    "startEngine",
    "runToEnd",
    "spawnEngine",
    "manualEngine",
  ]) {
    assert.ok(engine.has(name), name);
  }
  const unguarded = [];
  for (const name of fs
    .readdirSync(dir)
    .filter((n) => /^team-.*\.test\.js$/.test(n))) {
    const text = code(fs.readFileSync(path.join(dir, name), "utf8"));
    if (text.includes("assertSafeEnv(")) continue;
    const fromExec = importsFrom(text, "./exec-helpers.js");
    const fromEngine = importsFrom(text, "./team-engine-helpers.js");
    const isGuarded = (local) =>
      (fromExec.has(local) && exec.has(fromExec.get(local))) ||
      (fromEngine.has(local) && engine.has(fromEngine.get(local)));
    // every start in the file: a call with "start", "resume" or "run-task" as its
    // first word, createEngine, or a helper of the engine
    const calls = [
      ...text.matchAll(/(\w+)\(\s*\[\s*"(?:start|resume|run-task)"/g),
      ...text.matchAll(
        /\b(createEngine|startEngine|runToEnd|spawnEngine|manualEngine)\(/g,
      ),
    ];
    for (const m of calls) {
      if (!isGuarded(m[1])) unguarded.push(`${name}: ${m[1]}`);
    }
  }
  assert.deepStrictEqual(unguarded, []);
});

test("F-9 the README of the fixtures says that structured_output holds the fields of the answers of the engine too (design REQ-013, section 28)", () => {
  const text = fs.readFileSync(
    path.join(TOOLS_DIR, "test", "fixtures", "team", "README.md"),
    "utf8",
  );
  const at = text.indexOf("## Источник образцов `stream-json`");
  assert.notEqual(at, -1);
  const paragraph = text.slice(at).split("\n\n")[1];
  for (const name of [
    "PLAN_ANSWER_SCHEMA",
    "REVIEW_ANSWER_SCHEMA",
    "GOAL_ANSWER_SCHEMA",
    "REASSIGN_ANSWER_SCHEMA",
    "REQ-013",
  ]) {
    assert.ok(paragraph.includes(name), name);
  }
});
