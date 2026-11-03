import fs from "node:fs";
import { test } from "node:test";
import { launchBrowser } from "../../../e2e/kit/index.js";

// Starts a browser through the kit (SAI_CHROME is the stand-in), writes the pids it
// knows into the file named by SAI_FIXTURE_PIDFILE, then waits 60 s. With
// SAI_FIXTURE_BLOCK=1 it blocks the event loop instead of waiting, so no handler of
// its own can run.
// Leaves a mark when it is asked to stop (SIGTERM), so that a test can tell an orderly
// stop from a kill.
process.on("SIGTERM", () => {
  fs.writeFileSync(`${process.env.SAI_FIXTURE_PIDFILE}.term`, "1");
});

test("sleep-chrome waits with a browser", async () => {
  const browser = await launchBrowser();
  fs.writeFileSync(
    process.env.SAI_FIXTURE_PIDFILE,
    JSON.stringify({
      spec: process.pid,
      browser: browser.pid,
      profileDir: browser.profileDir,
    }),
  );
  if (process.env.SAI_FIXTURE_BLOCK === "1") {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  }
  await new Promise((resolve) => setTimeout(resolve, 60000));
});
