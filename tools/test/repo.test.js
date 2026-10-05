import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function hasHeading(text, heading) {
  return text.split("\n").some((l) => l.trim() === heading);
}

test("REQ-002 AC1: decisions/0002 has every section and the owner's confirmation", () => {
  const text = read("decisions/0002-process-tooling-node.md");
  for (const h of [
    "Вопрос",
    "Варианты",
    "Решение",
    "Почему",
    "Граница",
    "Основание",
  ]) {
    assert.ok(hasHeading(text, `## ${h}`), `missing ## ${h}`);
  }
  assert.ok(text.includes("Подтверждено владельцем"));
});

test("REQ-003 AC1: WF-06 document has the required sections and steps 0-7", () => {
  const text = read("docs/workflows/WF-06-idea-selection.md");
  for (const h of [
    "Роли",
    "Шаги",
    "Артефакты",
    "Handoff-ы",
    "Цикл доработки",
    "Условия остановки",
  ]) {
    assert.ok(hasHeading(text, `## ${h}`), `missing ## ${h}`);
  }
  for (let n = 0; n <= 7; n++) {
    assert.ok(text.includes(`Шаг ${n}`), `missing Шаг ${n}`);
  }
});

test("REQ-003 AC2: WF-06 roles exist and are bound to the quality bar", () => {
  for (const role of ["idea-analyst", "idea-judge", "verdict-executor"]) {
    const text = read(`.claude/agents/${role}.md`);
    assert.ok(
      text.includes("## Quality bar — binding"),
      `${role}: no quality bar block`,
    );
  }
  assert.ok(read(".claude/agents/orchestrator.md").includes("WF-06"));
});

test("REQ-003 AC3: analyst and judge have a reading scope that overrides CLAUDE.md", () => {
  for (const role of ["idea-analyst", "idea-judge"]) {
    const text = read(`.claude/agents/${role}.md`);
    assert.ok(
      hasHeading(text, "## Reading scope"),
      `${role}: no ## Reading scope`,
    );
    const scope = text.split("## Reading scope")[1].split("\n## ")[0];
    assert.ok(
      scope.includes("overrides the start-up reading list in `CLAUDE.md`"),
      `${role}: reading scope does not override CLAUDE.md`,
    );
    const [allowedPart, forbiddenPart = ""] = scope.split("**Do not read:**");
    for (const token of ["runs/<RUN-ID>/", "docs/quality-bar.md"]) {
      assert.ok(allowedPart.includes(token), `${role}: ${token} not allowed`);
    }
    const forbidden = forbiddenPart.split("\n- ")[0];
    assert.doesNotMatch(
      forbidden,
      /\bmay\b|\bcan\b|\ballowed\b/i,
      `${role}: the "Do not read" list must not grant anything`,
    );
    for (const token of [
      "`ideas/`",
      "`ideas/README.md`",
      "`STATE.md`",
      "`docs/requirements.yaml`",
      "`decisions/`",
    ]) {
      assert.ok(
        forbidden.includes(token),
        `${role}: ${token} is not in the "Do not read" list`,
      );
      assert.ok(
        !allowedPart.includes(token),
        `${role}: ${token} appears among the allowed sources`,
      );
    }
  }
  const claude = read("CLAUDE.md");
  assert.ok(
    claude.includes("IDEA-ANALYST") &&
      claude.includes("IDEA-JUDGE") &&
      claude.includes("Reading scope"),
    "CLAUDE.md has no exception line for IDEA-ANALYST and IDEA-JUDGE",
  );
});
