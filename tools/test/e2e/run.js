import { fileURLToPath } from "node:url";
import {
  NODE_REFUSAL_EXIT,
  refuseBelowNodeFloor,
} from "../../src/node-floor.js";
import { runAll } from "./kit/runner.js";

// The command `npm run e2e [-- <name> ...]`: runs the spec files of this folder.
// Below the Node floor (REQ-110) it stops before any spec or browser is started.
const specDir = fileURLToPath(new URL(".", import.meta.url));
process.exitCode = refuseBelowNodeFloor(process.stderr)
  ? NODE_REFUSAL_EXIT
  : await runAll({ specDir, argv: process.argv.slice(2) });
