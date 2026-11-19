import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { APP, childEnv, startNode } from "../fixtures/helpers.js";

// REQ-109 criterion 5 (against the real Node server).

test("SL-1 the smoke passes against node-main with the preview host", async (t) => {
  const s = startNode(t, { PORT: "0" });
  const port = await s.ready;
  const r = spawnSync(
    process.execPath,
    [
      "scripts/smoke.js",
      "--base",
      `http://127.0.0.1:${port}`,
      "--preview",
      `http://localhost:${port}`,
    ],
    { cwd: APP, env: childEnv(), encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
