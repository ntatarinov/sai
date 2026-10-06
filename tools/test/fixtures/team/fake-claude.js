#!/usr/bin/env node
// A fake executable of Claude Code for the tests of Sai Team (design REQ-010,
// section 15.4). It never calls a model and never goes to the network: it prints a
// recorded sample of `stream-json` from this folder and does what the plan of the
// test says.
//
// The plan is $HOME/fake-claude/plan.json (the process gets only the names of
// CHILD_ENV_ALLOW, so the plan comes through the HOME of the test):
//
//   { "runs": [Step, ...], "default": Step }      run n takes runs[n-1] or default
//   Step = { stream?: "stream-ok.jsonl", set_cost?: number, omit_cost?: true,
//            work_files?: [{ path, content }], answer_files?: [path, ...],
//            spawn_child?: true, hang?: true, exit?: int }
//
// The log is $HOME/fake-claude/log.jsonl: {event:"start", n, pid, ppid, t, argv,
// cwd, env_names}, {event:"child", n, pid}, {event:"end", n, t, code}; the whole
// stdin of run n is $HOME/fake-claude/stdin-<n>.bin.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_NAME = /^stream-[a-z0-9-]+\.jsonl$/;

function fail(message) {
  process.stderr.write(`fake-claude: ${message}\n`);
  process.exit(90);
}

const home = process.env.HOME;
if (typeof home !== "string" || !path.isAbsolute(home)) fail("no HOME");
const dir = path.join(home, "fake-claude");
const logFile = path.join(dir, "log.jsonl");

function log(entry) {
  fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

function runNumber() {
  let text = "";
  try {
    text = fs.readFileSync(logFile, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  let n = 1;
  for (const line of text.split("\n")) {
    if (line === "") continue;
    if (JSON.parse(line).event === "start") n += 1;
  }
  return n;
}

// A path inside the working folder: relative, without "..".
function insideCwd(rel) {
  if (typeof rel !== "string" || rel === "" || path.isAbsolute(rel)) {
    fail("work_files: path must be relative");
  }
  if (rel.split(/[\\/]/).includes("..")) fail("work_files: no ..");
  return path.join(process.cwd(), rel);
}

function sampleLines(step) {
  if (step.stream === undefined) return [];
  if (!SAMPLE_NAME.test(step.stream)) fail("stream: bad sample name");
  const text = fs.readFileSync(path.join(HERE, step.stream), "utf8");
  return text.split("\n").filter((line) => line !== "");
}

// Changes only the line of the result (cost, named files); other lines as they are.
function adjust(line, step) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return line;
  }
  if (obj === null || typeof obj !== "object" || obj.type !== "result") {
    return line;
  }
  if (step.omit_cost === true) delete obj.total_cost_usd;
  if (typeof step.set_cost === "number") obj.total_cost_usd = step.set_cost;
  if (Array.isArray(step.answer_files)) {
    const files = step.answer_files.map((p) => ({ path: p }));
    if (obj.structured_output && typeof obj.structured_output === "object") {
      obj.structured_output.files = files;
    }
  }
  return JSON.stringify(obj);
}

function readStdin() {
  const chunks = [];
  return new Promise((resolve) => {
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", () => resolve(Buffer.concat(chunks)));
  });
}

async function main() {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const n = runNumber();
  log({
    event: "start",
    n,
    pid: process.pid,
    ppid: process.ppid,
    t: Date.now(),
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    env_names: Object.keys(process.env).sort(),
  });
  process.on("exit", (code) => {
    log({ event: "end", n, t: Date.now(), code });
  });
  const stdin = await readStdin();
  fs.writeFileSync(path.join(dir, `stdin-${n}.bin`), stdin);

  const plan = readJson(path.join(dir, "plan.json"), {});
  const runs = Array.isArray(plan.runs) ? plan.runs : [];
  const step = runs[n - 1] ?? plan.default ?? {};

  for (const file of step.work_files ?? []) {
    const target = insideCwd(file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  if (step.spawn_child === true) {
    const child = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      {
        stdio: "ignore",
      },
    );
    log({ event: "child", n, pid: child.pid });
  }
  for (const line of sampleLines(step)) {
    process.stdout.write(`${adjust(line, step)}\n`);
  }
  if (step.hang === true) {
    setInterval(() => {}, 1000);
    return;
  }
  process.exitCode = Number.isInteger(step.exit) ? step.exit : 0;
}

main().catch((err) => fail(err && err.code ? err.code : "error"));
