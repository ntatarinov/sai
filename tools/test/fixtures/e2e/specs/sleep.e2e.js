import fs from "node:fs";
import { test } from "node:test";

// Writes its own process id into the file named by SAI_FIXTURE_PIDFILE, then waits 60 s.
test("sleep waits", async () => {
  fs.writeFileSync(process.env.SAI_FIXTURE_PIDFILE, String(process.pid));
  await new Promise((resolve) => setTimeout(resolve, 60000));
});
