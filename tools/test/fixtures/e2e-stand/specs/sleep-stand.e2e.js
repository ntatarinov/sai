import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { startStand } from "../../../e2e/kit/index.js";

// The spec of the runner's net in E2S-18 (docs/design/REQ-105-e2e-picker.md, 11.1).
// It starts a stand through the kit (the stand-in server in its mode "ok"), writes
// the pid of this spec process and of the stand into the file named by
// SAI_FIXTURE_PIDFILE, and then waits 60 s for the runner to stop it. With
// SAI_FIXTURE_BLOCK=1 it blocks its own event loop instead, so no handler of this
// process can run and only the runner's list can end the stand. The stand-in logs
// its events next to the pid file, so a test can still find a stand it never saw.
const FAKE_STAND = fileURLToPath(new URL("../fake-stand.js", import.meta.url));

test("sleep-stand waits with a stand", async () => {
  const pidFile = process.env.SAI_FIXTURE_PIDFILE;
  const stand = await startStand({
    name: "sleeper",
    args: [FAKE_STAND],
    readyPattern: /(http:\/\/127\.0\.0\.1:\d+)\/t\//u,
    env: {
      SAI_FAKE_STAND_MODE: "ok",
      SAI_FAKE_STAND_LOG: `${pidFile}.log`,
    },
  });
  fs.writeFileSync(
    pidFile,
    JSON.stringify({ spec: process.pid, stand: stand.pid }),
  );
  if (process.env.SAI_FIXTURE_BLOCK === "1") {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  }
  await new Promise((resolve) => setTimeout(resolve, 60000));
});
