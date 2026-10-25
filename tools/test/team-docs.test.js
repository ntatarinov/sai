// Sai Team core: the decision before the code and the README of the core (design
// REQ-009, TM-01, TM-50). These tests read documents; each of them checks one thing a
// criterion names, not that a word exists somewhere.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { REPO_ROOT, TOOLS_DIR } from "./team-helpers.js";

const read = (...parts) =>
  fs.readFileSync(path.join(REPO_ROOT, ...parts), "utf8");

// The text of the section that starts with `heading` up to the next heading of the
// same or a higher level.
function section(text, heading) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  assert.notEqual(start, -1, `no heading ${heading}`);
  const level = heading.match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#+) /);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

// ---- TM-01 ---------------------------------------------------------------------------

test("TM-01 (а) STATE.md records the start of the development in its section with the date", () => {
  const body = section(read("STATE.md"), "### Решение владельца о старте");
  const line = body
    .split("\n")
    .find((l) => l.includes("ДОВЕСТИ ПРОДУКТ ДО РАБОЧЕГО СОСТОЯНИЯ"));
  assert.ok(line, "no line with the words of the owner in the section");
  assert.match(line, /2026-10-06/);
});

test("TM-01 (б) one decision 0015 exists and the index lists it as accepted", () => {
  const files = fs
    .readdirSync(path.join(REPO_ROOT, "decisions"))
    .filter((n) => /^0015-.*\.md$/.test(n));
  assert.equal(files.length, 1);
  const row = read("decisions", "README.md")
    .split("\n")
    .find((l) => l.includes("0015"));
  assert.ok(row, "no row of 0015 in the index");
  assert.match(row, /Принято/);
  assert.match(row, new RegExp(files[0].replace(/[.]/g, "[.]")));
});

test("TM-01 (в) the decision names the code folder, the stack, the check, D-A, the web switch and the residual risk", () => {
  const [file] = fs
    .readdirSync(path.join(REPO_ROOT, "decisions"))
    .filter((n) => /^0015-.*\.md$/.test(n));
  const lines = read("decisions", file).split("\n");
  for (const sample of [
    "tools/src/team",
    "Node 22",
    "npm run check",
    "D-A",
    "SAI_TEAM_WEB",
  ]) {
    assert.ok(
      lines.some((l) => l.includes(sample)),
      `0015 has no "${sample}"`,
    );
  }
  const risk = lines.find((l) => l.includes("остаточн"));
  assert.ok(risk, "no line about the residual risk");
  assert.ok(
    risk.includes("SAI_TEAM_WEB") ||
      lines.some((l) => l.includes("остаточн") && l.includes("SAI_TEAM_WEB")),
  );
});

test("TM-01 (г) CLAUDE.md describes the product as a virtual team and no longer says there is no product code", () => {
  const text = read("CLAUDE.md");
  assert.ok(text.includes("virtual team"));
  assert.ok(!text.includes("кода продукта нет"));
  assert.ok(!text.includes("there is no product code"));
  assert.ok(!text.includes("no product code"));
});

// ---- TM-50 ---------------------------------------------------------------------------

test("TM-50 the README has the section of the core with every point of the design", () => {
  const body = section(
    fs.readFileSync(path.join(TOOLS_DIR, "README.md"), "utf8"),
    "## Sai Team — the core",
  );
  const low = body.toLowerCase();
  const points = [
    "SAI_TEAM_HOME",
    "0700",
    "0600",
    "work/",
    "busy",
    "recovered",
    "прервано аварией",
    "by hand",
    "the names of result files are not masked",
    "UTF-8",
    "binary ones are rejected",
    "looks like a key",
    "npm run check",
  ];
  for (const point of points)
    assert.ok(
      low.includes(point.toLowerCase()),
      `the README has no "${point}"`,
    );
  for (const title of [
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
  ]) {
    assert.ok(body.includes(title), `the README has no role "${title}"`);
  }
  for (const command of [
    "projects",
    "project <id>",
    "events <id>",
    "say <id>",
  ]) {
    assert.ok(
      body.includes(`team -- ${command.split(" ")[0]}`),
      `no example of ${command}`,
    );
    assert.ok(body.includes(`\`${command}`), `no description of ${command}`);
  }
  for (const code of ["0", "1", "2", "3"])
    assert.ok(body.includes(`${code} —`), `no exit code ${code}`);
});
