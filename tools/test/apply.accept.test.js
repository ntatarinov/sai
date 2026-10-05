import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { applyVerdict, ownerSection } from "../src/apply.js";
import { BLOCK_HEADING, STATE_ANCHOR, STATE_START } from "../src/contract.js";
import { sha256 } from "../src/util.js";
import { STATE_TEXT, runDirOf, tree, validRun } from "./helpers.js";

function readState(root) {
  return fs.readFileSync(path.join(root, "STATE.md"), "utf8");
}

test("ACCEPT: recommendation block, proposed actions and report are written", () => {
  const { root, runDir } = validRun();
  const result = applyVerdict(root, runDir);
  assert.ok(result.issues.empty, JSON.stringify(result.issues.list));
  assert.equal(result.mode, "recommend");

  const state = readState(root);
  assert.ok(state.includes(BLOCK_HEADING));
  assert.ok(
    state.includes(
      "Решение принимает владелец. До его записи код продукта не пишется.",
    ),
  );
  assert.ok(
    state.includes(
      "**Идея 2 — Бета: подбор размера** (`02-beta`), уверенность: средняя.",
    ),
  );
  assert.equal(ownerSection(state), ownerSection(STATE_TEXT));
  const lines = state.split("\n");
  assert.ok(lines.indexOf(STATE_START) < lines.indexOf(STATE_ANCHOR));
  assert.ok(
    lines.indexOf("### Решение владельца о старте") <
      lines.indexOf(STATE_START),
  );

  const proposedText = fs.readFileSync(
    path.join(runDir, "proposed-actions.json"),
    "utf8",
  );
  const proposed = JSON.parse(proposedText);
  assert.deepEqual(
    proposed.actions.map((a) => [a.step, a.to_agent]),
    [["10", "REQ-ANALYST"]],
  );

  const report = JSON.parse(
    fs.readFileSync(path.join(runDir, "apply-report.json"), "utf8"),
  );
  assert.equal(report.mode, "recommend");
  assert.deepEqual(report.written, [
    { path: "STATE.md", sha256: sha256(state) },
    {
      path: `runs/${path.basename(runDir)}/proposed-actions.json`,
      sha256: sha256(proposedText),
    },
  ]);
});

test("a second apply changes no byte", () => {
  const { root, runDir } = validRun();
  applyVerdict(root, runDir);
  const after = tree(root);
  const second = applyVerdict(root, runDir);
  assert.ok(second.issues.empty);
  assert.equal(second.changed, 0);
  assert.equal(tree(root), after);
});

test("an edited block is replaced between the markers, owner's section intact", () => {
  const { root } = validRun();
  const runDir = runDirOf(root);
  applyVerdict(root, runDir);
  const statePath = path.join(root, "STATE.md");
  const good = readState(root);
  fs.writeFileSync(
    statePath,
    good.replace("Условия:", "Условия (правка руками):"),
  );
  const result = applyVerdict(root, runDir);
  assert.ok(result.issues.empty);
  assert.equal(readState(root), good);
  assert.equal(readState(root).split(STATE_START).length, 2);
});
