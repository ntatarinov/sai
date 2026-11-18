// Tests of the tools of the roles, the switch of the network of the Researcher and
// the hiding of the internal mapping (design REQ-010, section 15.1: EX-16, EX-17,
// EX-30; criteria 5 and 10). Only the fake executable is ever started.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES } from "../src/team/roles.js";
import {
  argAfter,
  describeRun,
  execEnv,
  fakeStarts,
  journal,
  makeProject,
  makeSandbox,
  runTeam,
  sha256,
  writePlan,
} from "./exec-helpers.js";
import fs from "node:fs";

const OK_PLAN = { default: { stream: "stream-ok.jsonl", set_cost: 0.01 } };
const ROLE_CODES = [
  "project_manager",
  "business_analyst",
  "researcher",
  "financial_analyst",
  "lawyer",
  "marketer",
  "designer",
  "developer",
  "reviewer",
  "support",
];
const BASIC_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
const DENY_RULES = [
  "WebFetch(domain:localhost)",
  "WebFetch(domain:127.0.0.1)",
  "WebFetch(domain:[::1])",
  "WebFetch(domain:0.0.0.0)",
  "WebFetch(domain:169.254.169.254)",
];

function runOf(sb, p, over = {}) {
  return runTeam(["run-task", p.id, p.task], execEnv(sb, over));
}

const setOf = (list) => [...new Set(list.split(","))].sort();

test("EX-16 the tools of the ten roles: --tools and --allowedTools, no Bash; by default the Researcher has WebSearch and no WebFetch, so no deny rules (ISS-0119)", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb, { role: ROLE_CODES, tasks: 10 });
  ROLE_CODES.forEach((code, i) => {
    const r = runTeam(
      ["run-task", p.id, `t-${String(i + 1).padStart(4, "0")}`],
      execEnv(sb),
    );
    assert.equal(r.status, 0, `${code}: ${describeRun(r)}`);
  });
  const starts = fakeStarts(sb);
  assert.equal(starts.length, 10);
  ROLE_CODES.forEach((code, i) => {
    const argv = starts[i].argv;
    const tools = argAfter(argv, "--tools");
    const allowed = argAfter(argv, "--allowedTools");
    const expected =
      code === "researcher"
        ? [...BASIC_TOOLS, "WebSearch"].sort()
        : [...BASIC_TOOLS].sort();
    assert.deepEqual(setOf(tools), expected, `${code} --tools`);
    assert.deepEqual(setOf(allowed), expected, `${code} --allowedTools`);
    for (const name of ["Bash", "Task", "Agent", "NotebookEdit", "TodoWrite"]) {
      assert.equal(setOf(tools).includes(name), false, `${code}: ${name}`);
      assert.equal(setOf(allowed).includes(name), false, `${code}: ${name}`);
    }
    const deny = argAfter(argv, "--disallowedTools");
    assert.equal(deny, undefined, `${code} has deny rules`);
  });
  // The developer has no Bash and no command execution at all.
  const dev = starts[ROLE_CODES.indexOf("developer")].argv;
  assert.doesNotMatch(argAfter(dev, "--tools"), /Bash/u);
});

test("EX-17 SAI_TEAM_WEB=0 takes WebSearch, WebFetch and the deny rules away from the Researcher", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb);
  const r = runOf(sb, p, { SAI_TEAM_WEB: "0" });
  assert.equal(r.status, 0, describeRun(r));
  const [start] = fakeStarts(sb);
  for (const arg of start.argv) {
    assert.doesNotMatch(arg, /WebSearch|WebFetch/u, `argument ${arg}`);
  }
  assert.equal(start.argv.includes("--disallowedTools"), false);
  assert.deepEqual(argAfter(start.argv, "--tools").split(","), BASIC_TOOLS);
  assert.deepEqual(
    argAfter(start.argv, "--allowedTools").split(","),
    BASIC_TOOLS,
  );
});

test("EX-17 without SAI_TEAM_REAL_RUNS=1 the Researcher gets no network whatever SAI_TEAM_WEB says", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb);
  for (const web of [undefined, "0", "1"]) {
    for (const runs of [undefined, "0", "true"]) {
      const before = sha256(fs.readFileSync(p.events));
      const r = runOf(sb, p, { SAI_TEAM_WEB: web, SAI_TEAM_REAL_RUNS: runs });
      assert.equal(r.status, 1, describeRun(r));
      assert.ok(r.stderr.startsWith("E_REAL_RUNS_OFF: "), r.stderr);
      assert.equal(fakeStarts(sb).length, 0);
      assert.equal(sha256(fs.readFileSync(p.events)), before);
    }
  }
});

test("EX-17 with the switch on and SAI_TEAM_WEB unset or 1, without SAI_TEAM_WEB_DOMAINS: WebSearch only, no WebFetch and no deny rules (ISS-0119)", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  for (const web of [undefined, "1", "yes"]) {
    for (const domains of [undefined, ""]) {
      const p = makeProject(sb);
      const r = runOf(sb, p, {
        SAI_TEAM_WEB: web,
        SAI_TEAM_WEB_DOMAINS: domains,
      });
      assert.equal(r.status, 0, describeRun(r));
    }
  }
  const starts = fakeStarts(sb);
  assert.equal(starts.length, 6);
  for (const s of starts) {
    for (const flag of ["--tools", "--allowedTools"]) {
      assert.deepEqual(argAfter(s.argv, flag).split(","), [
        ...BASIC_TOOLS,
        "WebSearch",
      ]);
    }
    for (const arg of s.argv) {
      assert.doesNotMatch(arg, /WebFetch/u, `argument ${arg}`);
    }
    assert.equal(s.argv.includes("--disallowedTools"), false);
  }
});

test("ISS-0119 with SAI_TEAM_WEB_DOMAINS the Researcher gets WebFetch, --allowedTools allows it only for the listed sites (never a bare WebFetch), and the five deny rules stay", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb);
  const r = runOf(sb, p, {
    SAI_TEAM_WEB_DOMAINS: "docs.python.org,example.com,docs.python.org",
  });
  assert.equal(r.status, 0, describeRun(r));
  const [start] = fakeStarts(sb);
  assert.deepEqual(argAfter(start.argv, "--tools").split(","), [
    ...BASIC_TOOLS,
    "WebSearch",
    "WebFetch",
  ]);
  // a repeated site is one rule; the order of the list is kept
  assert.deepEqual(argAfter(start.argv, "--allowedTools").split(","), [
    ...BASIC_TOOLS,
    "WebSearch",
    "WebFetch(domain:docs.python.org)",
    "WebFetch(domain:example.com)",
  ]);
  assert.deepEqual(
    argAfter(start.argv, "--disallowedTools").split(","),
    DENY_RULES,
  );
  // SAI_TEAM_WEB=0 still wins over the list
  const off = makeProject(sb);
  const r0 = runOf(sb, off, {
    SAI_TEAM_WEB: "0",
    SAI_TEAM_WEB_DOMAINS: "example.com",
  });
  assert.equal(r0.status, 0, describeRun(r0));
  for (const arg of fakeStarts(sb)[1].argv) {
    assert.doesNotMatch(arg, /WebSearch|WebFetch/u, `argument ${arg}`);
  }
});

test("ISS-0119 a bad SAI_TEAM_WEB_DOMAINS is E_CONFIG and starts nothing: a wildcard, a scheme, a port, a path, an IP address, one label, upper case, spaces, an empty item", (t) => {
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb);
  for (const bad of [
    "*.example.com",
    "https://example.com",
    "example.com:443",
    "example.com/x",
    "10.0.0.1",
    "127.0.0.1",
    "localhost",
    "Example.com",
    " example.com",
    "example.com,",
    "example..com",
    "-a.example.com",
    "a".repeat(64) + ".com",
    Array.from({ length: 51 }, (_, i) => `s${i}.example.com`).join(","),
  ]) {
    const r = runOf(sb, p, { SAI_TEAM_WEB_DOMAINS: bad });
    assert.equal(r.status, 2, `${bad}: ${describeRun(r)}`);
    assert.ok(
      r.stderr.startsWith("E_CONFIG: Неверная настройка SAI_TEAM_WEB_DOMAINS"),
      `${bad}: ${r.stderr}`,
    );
  }
  assert.equal(fakeStarts(sb).length, 0);
});

test("EX-30 every role has a prompt and tools; neither the prompt nor a tool name ever reaches the output of the commands or the phrases", (t) => {
  assert.equal(ROLES.length, 10);
  for (const role of ROLES) {
    assert.ok(
      typeof role.internal.prompt === "string" &&
        role.internal.prompt.length > 20,
      role.code,
    );
    assert.ok(role.internal.tools.length >= 5, role.code);
  }
  const sb = makeSandbox(t);
  writePlan(sb, OK_PLAN);
  const p = makeProject(sb, { role: ROLE_CODES, tasks: 10 });
  const outputs = [];
  ROLE_CODES.forEach((_, i) => {
    const r = runTeam(
      ["run-task", p.id, `t-${String(i + 1).padStart(4, "0")}`],
      execEnv(sb),
    );
    assert.equal(r.status, 0, describeRun(r));
    outputs.push(r.stdout, r.stderr);
  });
  const env = execEnv(sb);
  const project = runTeam(["project", p.id], env);
  const events = runTeam(["events", p.id, "--limit", "200"], env);
  const projects = runTeam(["projects"], env);
  const added = runTeam(
    [
      "add-task",
      p.id,
      "--role",
      "lawyer",
      "--text",
      "ещё",
      "--done-when",
      "готово",
    ],
    env,
  );
  outputs.push(project.stdout, events.stdout, projects.stdout, added.stdout);
  for (const r of [project, events, projects, added]) {
    assert.equal(r.status, 0, describeRun(r));
  }
  const shown = outputs.join("\n");
  const phrases = JSON.parse(events.stdout)
    .events.map((e) => e.phrase)
    .join("\n");
  const tools = new Set(ROLES.flatMap((r) => [...r.internal.tools]));
  for (const role of ROLES) {
    const prompt = role.internal.prompt;
    assert.equal(shown.includes(prompt), false, `${role.code}: prompt shown`);
    assert.equal(
      shown.includes(prompt.slice(0, 30)),
      false,
      `${role.code}: start of prompt`,
    );
    assert.equal(phrases.includes(prompt.slice(0, 30)), false);
  }
  for (const tool of tools) {
    const word = new RegExp(`(?<![A-Za-z])${tool}(?![A-Za-z])`, "u");
    assert.doesNotMatch(shown, word, `tool name ${tool} shown`);
  }
  // The log is real: the prompts did go to the process, only not to the user.
  const starts = fakeStarts(sb);
  assert.equal(starts.length, 10);
  assert.equal(
    argAfter(starts[0].argv, "--append-system-prompt"),
    ROLES[0].internal.prompt,
  );
  assert.ok(journal(p).length > 40);
});
