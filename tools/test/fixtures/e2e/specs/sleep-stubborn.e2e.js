import fs from "node:fs";
import { test } from "node:test";

// Like sleep, and ignores SIGTERM: only SIGKILL ends it.
process.on("SIGTERM", () => {});

test("sleep-stubborn waits", async () => {
  fs.writeFileSync(process.env.SAI_FIXTURE_PIDFILE, String(process.pid));
  await new Promise((resolve) => setTimeout(resolve, 60000));
});
