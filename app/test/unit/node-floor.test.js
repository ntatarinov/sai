import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { nodeFloorRefusal } from "../../server/config.js";
import { APP } from "../fixtures/helpers.js";

// REQ-108 criterion 6.

test("NF-1 the floor refuses below 22.23.4 with one plain line and accepts the floor and above", () => {
  for (const v of ["v22.23.3", "v22.9.0", "v21.99.99", "v23.0.0", "x"]) {
    const line = nodeFloorRefusal(v);
    assert.ok(line && !line.includes("\n") && line.includes("22.23.4"), v);
  }
  for (const v of ["v22.23.4", "v22.30.0", "v22.24.0"])
    assert.equal(nodeFloorRefusal(v), null, v);
});

test("NF-2 only server/node-main.js calls the floor", () => {
  const callers = fs
    .readdirSync(APP, { recursive: true })
    .map(String)
    .filter(
      (f) =>
        f.endsWith(".js") &&
        !f.startsWith("node_modules") &&
        !f.startsWith("test"),
    )
    .filter((f) =>
      /nodeFloorRefusal\s*\(/.test(
        fs
          .readFileSync(path.join(APP, f), "utf8")
          .replace(/export function nodeFloorRefusal\s*\(/, ""),
      ),
    );
  assert.deepEqual(callers, [path.join("server", "node-main.js")]);
});
