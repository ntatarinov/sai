import { fileURLToPath } from "node:url";
import {
  NODE_REFUSAL_EXIT,
  refuseBelowNodeFloor,
} from "../../src/node-floor.js";
import { refuseUnsupportedPlatform } from "../../src/platform-guard.js";
import { runAll } from "./kit/runner.js";

// The command `npm run e2e [-- <name> ...]`: runs the spec files of this folder.
// Below the Node floor (REQ-110), and then on a platform other than Linux and macOS
// (ISS-0132), it stops before any spec or browser is started.
const specDir = fileURLToPath(new URL(".", import.meta.url));
process.exitCode =
  refuseBelowNodeFloor(process.stderr) ||
  refuseUnsupportedPlatform(process.stderr)
    ? NODE_REFUSAL_EXIT
    : await runAll({ specDir, argv: process.argv.slice(2) });
