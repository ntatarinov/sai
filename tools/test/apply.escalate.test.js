import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { applyVerdict, ownerSection } from "../src/apply.js";
import { BLOCK_HEADING } from "../src/contract.js";
import { STATE_TEXT, review, validRun, verdict } from "./helpers.js";

test("third REJECT: escalation block, report, no proposed actions", () => {
  const { root, runDir } = validRun((a) => {
    for (const n of [1, 2, 3]) {
      a[`verdict-${n}.json`] = verdict(n);
      a[`verdict-${n}.md`] = a["verdict-1.md"];
      a[`verdict-review-${n}.json`] = review(n, "REJECT");
    }
  });
  const result = applyVerdict(root, runDir);
  assert.ok(result.issues.empty, JSON.stringify(result.issues.list));
  assert.equal(result.mode, "escalate");

  const state = fs.readFileSync(path.join(root, "STATE.md"), "utf8");
  assert.ok(state.includes(BLOCK_HEADING));
  assert.ok(
    state.includes("агенты не пришли к принятому вердикту за 3 проверки"),
  );
  assert.ok(state.includes("- нужно уточнить причины"));
  assert.ok(state.includes("Решение принимает владелец."));
  assert.equal(ownerSection(state), ownerSection(STATE_TEXT));

  assert.equal(
    fs.existsSync(path.join(runDir, "proposed-actions.json")),
    false,
  );
  const report = JSON.parse(
    fs.readFileSync(path.join(runDir, "apply-report.json"), "utf8"),
  );
  assert.equal(report.mode, "escalate");
  assert.deepEqual(
    report.written.map((w) => w.path),
    ["STATE.md"],
  );
});
