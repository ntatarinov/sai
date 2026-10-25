// The README of the executors (design REQ-010, section 15.1: EX-37; criterion 13): the
// section exists, holds what the design lists and agrees with the code on the tools
// of the roles. The text of the prompts never appears there.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ROLES } from "../src/team/roles.js";
import { TOOLS_DIR } from "./exec-helpers.js";

const README = fs.readFileSync(path.join(TOOLS_DIR, "README.md"), "utf8");
const HEAD = "## Sai Team — executors";

function section() {
  const at = README.indexOf(HEAD);
  assert.ok(at >= 0, "the section is missing");
  assert.equal(README.indexOf(HEAD, at + 1), -1, "the section is there twice");
  const rest = README.slice(at + HEAD.length);
  const next = rest.search(/\n## /u);
  return next === -1 ? rest : rest.slice(0, next);
}

test("EX-37 the section names the interface, both executors, the conditions and the switches", () => {
  const s = section();
  for (const [what, re] of [
    ["run", /`run\(request, io\)`/u],
    ["claude-cli", /`claude-cli`/u],
    ["scripted", /`scripted`/u],
    ["only for tests", /only for tests/u],
    ["fixtures", /tools\/test\/fixtures\/team\//u],
    ["real runs", /SAI_TEAM_REAL_RUNS=1/u],
    ["binary", /SAI_TEAM_CLAUDE_BIN/u],
    ["timeout", /SAI_TEAM_TASK_TIMEOUT_MS/u],
    ["pause", /SAI_TEAM_RETRY_DELAY_MS/u],
    ["run cap", /SAI_TEAM_RUN_CAP_USD/u],
    ["residual risk", /[Rr]esidual risk/u],
    ["retries", /Repeats/u],
    ["worst case", /by the worst case/u],
    ["assumed", /accounted: assumed/u],
    ["new", /`new /u],
    ["add-task", /`add-task /u],
    ["run-task", /`run-task /u],
    ["exit codes", /Exit codes/u],
  ]) {
    assert.match(s, re, what);
  }
  const web = s.split("\n").find((l) => l.includes("SAI_TEAM_WEB"));
  assert.ok(web !== undefined, "no line about SAI_TEAM_WEB inside the section");
  assert.match(web, /turns off WebSearch and WebFetch/u);
});

test("EX-37 the ten roles and their tools are listed and agree with the code; the prompts are not", () => {
  const s = section();
  const titles = [
    "Руководитель проекта",
    "Бизнес-аналитик",
    "Исследователь",
    "Финансовый аналитик",
    "Юрист",
    "Маркетолог",
    "Дизайнер",
    "Разработчик",
    "Проверяющий (QA)",
    "Специалист поддержки",
  ];
  const rows = s.split("\n").filter((l) => l.startsWith("|"));
  for (const title of titles) {
    // the cell is the title, or the title and a gloss in brackets ("Юрист (lawyer)")
    const row = rows.find((l) => {
      const cell = l.split("|")[1].trim();
      return cell === title || cell.startsWith(`${title} (`);
    });
    assert.ok(row !== undefined, `no row for ${title}`);
    const role = ROLES.find((r) => r.title === title);
    assert.ok(role !== undefined, `the catalog has no ${title}`);
    const shown = row
      .split("|")[2]
      .split(",")
      .map((x) => x.trim());
    assert.deepEqual(shown, [...role.internal.tools], title);
  }
  assert.equal(ROLES.length, 10);
  for (const role of ROLES) {
    assert.equal(
      README.includes(role.internal.prompt),
      false,
      `prompt of ${role.code}`,
    );
    assert.equal(
      README.includes(role.internal.prompt.slice(0, 40)),
      false,
      role.code,
    );
  }
  assert.match(s, /No role has Bash/u);
});

test("EX-37 the section gives the real arguments and the real never-passed list", () => {
  const s = section();
  for (const flag of [
    "-p",
    "--output-format stream-json",
    "--max-budget-usd",
    "--json-schema",
    "--permission-prompts none",
    "--restricted",
    "--safe-mode",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--append-system-prompt",
  ]) {
    assert.ok(s.includes(flag), flag);
  }
  for (const never of [
    "--add-dir",
    "--dangerously-skip-permissions",
    "--permission-mode",
    "--bare",
  ]) {
    assert.ok(s.includes(never), never);
  }
  assert.doesNotMatch(
    s,
    /sk-ant-|ghp_|AKIA[0-9A-Z]{8}/u,
    "a secret in the README",
  );
});
