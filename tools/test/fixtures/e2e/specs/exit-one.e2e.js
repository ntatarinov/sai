import assert from "node:assert/strict";
import { test } from "node:test";

test("exit-one one passing test", () => {
  assert.equal(1 + 1, 2);
});

// every test passes, and the process still ends with a non-zero code
process.on("exit", () => {
  process.exitCode = 1;
});
