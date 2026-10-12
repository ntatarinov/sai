#!/usr/bin/env node
// A fake executable of Claude Code for the tests of ISS-0023 (design
// docs/design/ISS-0023-reviewer-sees-result-file.md, section 6). It never calls a
// model and never goes to the network. It reads only its stdin, its argument
// --json-schema, its own working folder and the plan of the test, and it writes
// only into $HOME/fake-claude-reads/ and (the files of a work run) into its own
// working folder.
//
// The plan is $HOME/fake-claude-reads/plan.json:
//   { plan: { tasks: [...] },                       the answer of the plan run
//     work: [ { when?, files: [{ path, content }], answer?: [path, ...] } ],
//     reassign_role: string, review_task?: "yes",
//     plans?: [ {tasks: [...]}, ... ],               ISS-0031, optional keys:
//     goal_script?: [ {passed, notes}, ... ],        without them nothing changes
//     probes?: [ string, ... ] }
// plans: the n-th run of the planner (n = the plan runs before it in the log)
// answers plans[min(n, last)]; without the key every run answers `plan`.
// goal_script: the n-th check of the goal answers goal_script[min(n, last)] (by:
// "script"); without the key the goal check judges by the text of the goal.
// probes: only with the key, the log line of every run also has `deps_header` (the
// header of the accepted files is in the stdin) and `probes` ({ string: is it in
// the stdin }).
// A work entry is chosen by `when` (a text found in the stdin) or, without it, by
// the number of the work run.
//
// What a run is, the fake decides itself by the required keys of the schema:
// `tasks` - plan, `passed` - check, `role` - choice of a role, otherwise work.
// A check of a task has the section "## Задача" in the stdin; a check of the goal
// has not.
//
// The check answers passed:true when the file named in the criterion (or in the
// goal) is in the working folder ("folder") or when a line of the area of the
// link names it together with its accepted name t-NNNN-N-X ("prompt"). The log is
// $HOME/fake-claude-reads/log.jsonl: {n, purpose, cwd_files, X, by, passed}; the
// whole stdin of run n is $HOME/fake-claude-reads/stdin-<n>.bin.
import fs from "node:fs";
import path from "node:path";

const DEPS_HEADER = "## Результаты задач, от которых зависит эта";
const NAME_AT = /сохран(?:ён|ен|ена|ено|ить)\s+в\s+(\S+)/u;

function fail(message) {
  process.stderr.write(`fake-claude-reads: ${message}\n`);
  process.exit(90);
}

const home = process.env.HOME;
if (typeof home !== "string" || !path.isAbsolute(home)) fail("no HOME");
const dir = path.join(home, "fake-claude-reads");
const logFile = path.join(dir, "log.jsonl");

function readStdin() {
  const chunks = [];
  return new Promise((resolve) => {
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", () => resolve(Buffer.concat(chunks)));
  });
}

// The number of this run: the first free stdin-<n>.bin (exclusive create, so that
// two runs at once never take one number).
function takeNumber(stdin) {
  for (let n = 1; ; n += 1) {
    try {
      fs.writeFileSync(path.join(dir, `stdin-${n}.bin`), stdin, { flag: "wx" });
      return n;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
  }
}

function logLines() {
  let text = "";
  try {
    text = fs.readFileSync(logFile, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return text
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => JSON.parse(l));
}

// The lines of the section `title`: after its line up to the next "## " line.
function sectionOf(lines, title) {
  const at = lines.indexOf(title);
  if (at === -1) return "";
  const out = [];
  for (let i = at + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

// The name X of the file named in a text, or null.
function nameIn(text) {
  const m = NAME_AT.exec(text);
  if (m === null) return null;
  const x = m[1].replace(/^[«"'([]+/u, "").replace(/[.,;:!?»"')\]]+$/u, "");
  return x === "" ? null : x;
}

// The lines between the header of the accepted files and the first line "### t-"
// or "## " after it (the place of the explanation and of the map of names).
function linkArea(lines) {
  const a = lines.indexOf(DEPS_HEADER);
  if (a === -1) return [];
  let b = lines.length;
  for (let i = a + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("### t-") || lines[i].startsWith("## ")) {
      b = i;
      break;
    }
  }
  return lines.slice(a + 1, b);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const BEFORE = "(?<![\\p{L}\\p{N}._-])";
const AFTER = "(?![\\p{L}\\p{N}._-])";

function judge(stdin, cwdFiles) {
  const lines = stdin.split("\n");
  const isTask = lines.includes("## Задача");
  const source = sectionOf(
    lines,
    isTask ? "## Критерий готовности" : "## Цель проекта",
  );
  const X = nameIn(source);
  if (X === null) {
    return {
      isTask,
      X,
      by: "none",
      passed: false,
      notes: "в критерии нет имени файла (fake)",
    };
  }
  if (cwdFiles.includes(X)) {
    return { isTask, X, by: "folder", passed: true, notes: "файл в папке" };
  }
  const word = new RegExp(`${BEFORE}${escapeRe(X)}${AFTER}`, "u");
  const accepted = new RegExp(
    `${BEFORE}t-[0-9]{4}-[0-9]+-${escapeRe(X)}${AFTER}`,
    "u",
  );
  if (linkArea(lines).some((l) => word.test(l) && accepted.test(l))) {
    return { isTask, X, by: "prompt", passed: true, notes: "связь названа" };
  }
  let notes = `файл ${X} отсутствует в текущей рабочей папке`;
  if (lines.some((l) => accepted.test(l))) {
    notes += "; содержимое под принятым именем есть, но связи с X нет";
  }
  return { isTask, X, by: "none", passed: false, notes };
}

function insideCwd(rel) {
  if (typeof rel !== "string" || rel === "" || path.isAbsolute(rel)) {
    fail("work file: path must be relative");
  }
  if (rel.split(/[\\/]/u).includes("..")) fail("work file: no ..");
  return path.join(process.cwd(), rel);
}

function schemaKeys(argv) {
  const i = argv.indexOf("--json-schema");
  if (i === -1 || i + 1 >= argv.length) fail("no --json-schema");
  const schema = JSON.parse(argv[i + 1]);
  return Array.isArray(schema.required) ? schema.required : [];
}

async function main() {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const required = schemaKeys(process.argv.slice(2));
  const stdinBytes = await readStdin();
  const stdin = stdinBytes.toString("utf8");
  const n = takeNumber(stdinBytes);
  const plan = JSON.parse(fs.readFileSync(path.join(dir, "plan.json"), "utf8"));
  let answer;
  const entry = { n };
  if (required.includes("tasks")) {
    entry.purpose = "plan";
    if (Array.isArray(plan.plans) && plan.plans.length > 0) {
      const before = logLines().filter((l) => l.purpose === "plan").length;
      answer = plan.plans[Math.min(before, plan.plans.length - 1)];
    } else {
      answer = plan.plan;
    }
  } else if (required.includes("passed")) {
    const cwdFiles = fs.readdirSync(process.cwd());
    const j = judge(stdin, cwdFiles);
    entry.purpose = j.isTask ? "review" : "goal_check";
    entry.cwd_files = cwdFiles;
    const script = Array.isArray(plan.goal_script) ? plan.goal_script : [];
    if (!j.isTask && script.length > 0) {
      const before = logLines().filter(
        (l) => l.purpose === "goal_check",
      ).length;
      const step = script[Math.min(before, script.length - 1)];
      entry.X = j.X;
      entry.by = "script";
      answer = { passed: step.passed, notes: step.notes };
    } else if (j.isTask && plan.review_task === "yes") {
      entry.X = j.X;
      entry.by = "plan";
      answer = { passed: true, notes: "по плану теста" };
    } else {
      entry.X = j.X;
      entry.by = j.by;
      answer = { passed: j.passed, notes: j.notes };
    }
    entry.passed = answer.passed;
  } else if (required.includes("role")) {
    entry.purpose = "reassign";
    answer = { role: plan.reassign_role ?? "researcher", reason: "fake" };
  } else {
    entry.purpose = "work";
    const work = Array.isArray(plan.work) ? plan.work : [];
    const byText = work.find(
      (w) => typeof w.when === "string" && stdin.includes(w.when),
    );
    const done = logLines().filter((l) => l.purpose === "work").length;
    const step = byText ??
      work[Math.min(done, work.length - 1)] ?? { files: [] };
    for (const f of step.files ?? []) {
      const target = insideCwd(f.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.content);
    }
    const named = step.answer ?? (step.files ?? []).map((f) => f.path);
    answer = {
      summary: "Готово по вымышленным данным",
      files: named.map((p) => ({ path: p, kind: "result" })),
    };
  }
  if (Array.isArray(plan.probes)) {
    entry.deps_header = stdin.split("\n").includes(DEPS_HEADER);
    entry.probes = Object.fromEntries(
      plan.probes.map((s) => [s, stdin.includes(s)]),
    );
  }
  fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`);
  const sid = "00000000-0000-4000-8000-000000000003";
  process.stdout.write(
    `${JSON.stringify({ type: "system", subtype: "init", session_id: sid })}\n`,
  );
  process.stdout.write(
    `${JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      duration_ms: 1,
      num_turns: 1,
      total_cost_usd: 0.01,
      permission_denials: [],
      result: "",
      structured_output: answer,
      session_id: sid,
    })}\n`,
  );
}

main().catch((err) => fail(err && err.code ? err.code : "error"));
