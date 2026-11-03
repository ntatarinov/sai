import { fileURLToPath } from "node:url";
import { runAll } from "./kit/runner.js";

// The command `npm run e2e [-- <name> ...]`: runs the spec files of this folder.
const specDir = fileURLToPath(new URL(".", import.meta.url));
process.exitCode = await runAll({ specDir, argv: process.argv.slice(2) });
