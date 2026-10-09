// A preload for the tests of the engine of Sai Team (EN-61): the first reading of
// the folder inbox/ of a project waits SAI_TEST_INBOX_WAIT_MS (default 1500 ms)
// before it happens, so that a test can send a message to a new engine whose
// clean-up has begun (design REQ-013, section 13.4, step 2.1). Loaded only by
// tests with --import; it writes nothing and never touches the network.
import fs from "node:fs";
import path from "node:path";

const wait = Number(process.env.SAI_TEST_INBOX_WAIT_MS ?? "1500");
const real = fs.readdirSync;
let done = false;
fs.readdirSync = function (dir, ...rest) {
  if (!done && typeof dir === "string" && path.basename(dir) === "inbox") {
    done = true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
  }
  return real.call(fs, dir, ...rest);
};
