import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { applyVerdict } from "../src/apply.js";
import { STATE_END, STATE_START } from "../src/contract.js";
import { STATE_TEXT, assertCode, tree, validRun } from "./helpers.js";

function rejectedWithStateText(stateText, code) {
  const { root, runDir } = validRun();
  const statePath = path.join(root, "STATE.md");
  if (stateText === undefined) fs.rmSync(statePath);
  else fs.writeFileSync(statePath, stateText);
  const before = tree(root);
  assertCode(applyVerdict(root, runDir), code);
  assert.equal(tree(root), before, "no file may be changed, added or removed");
}

test("E_STATE_ANCHOR: STATE.md missing", () => {
  rejectedWithStateText(undefined, "E_STATE_ANCHOR");
});

test("E_STATE_ANCHOR: anchor line missing", () => {
  rejectedWithStateText(
    STATE_TEXT.replace("### Что делать дальше — по порядку", "### Дальше"),
    "E_STATE_ANCHOR",
  );
});

test("E_STATE_ANCHOR: owner's section heading missing", () => {
  rejectedWithStateText(
    STATE_TEXT.replace("### Решение владельца о старте", "### Решение"),
    "E_STATE_ANCHOR",
  );
});

test("E_STATE_MARKERS: start marker without end marker", () => {
  rejectedWithStateText(`${STATE_TEXT}\n${STATE_START}\n`, "E_STATE_MARKERS");
});

test("E_OWNER_SECTION: markers spanning the owner's heading", () => {
  const damaged = STATE_TEXT.replace(
    "### Решение владельца о старте\n\nНе принято.\n",
    `${STATE_START}\n### Решение владельца о старте\n\nНе принято.\n${STATE_END}\n`,
  );
  rejectedWithStateText(damaged, "E_OWNER_SECTION");
});
