import assert from "node:assert/strict";
import { test } from "node:test";
import { applyVerdict } from "../src/apply.js";
import { assertCode, review, tree, validRun, verdict } from "./helpers.js";

function rejectedWithoutChanges(mutate, code) {
  const { root, runDir } = validRun(mutate);
  const before = tree(root);
  const result = applyVerdict(root, runDir);
  assertCode(result, code);
  assert.equal(tree(root), before, "no file may be changed, added or removed");
}

test("invalid run: nothing is written", () => {
  rejectedWithoutChanges(
    (a) => (a["verdict-1.json"].owner_decision_required = false),
    "E_OWNER_DECISION",
  );
});

test("E_NOT_ACCEPTED: latest review REJECT below version 3, nothing is written", () => {
  rejectedWithoutChanges(
    (a) => (a["verdict-review-1.json"] = review(1, "REJECT")),
    "E_NOT_ACCEPTED",
  );
});

test("E_NOT_ACCEPTED at version 2 as well", () => {
  rejectedWithoutChanges((a) => {
    a["verdict-review-1.json"] = review(1, "REJECT");
    a["verdict-2.json"] = verdict(2);
    a["verdict-2.md"] = a["verdict-1.md"];
    a["verdict-review-2.json"] = review(2, "REJECT");
  }, "E_NOT_ACCEPTED");
});
