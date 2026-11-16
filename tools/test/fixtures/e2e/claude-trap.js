#!/usr/bin/env node
// A trap in place of the Claude Code program, for the spec of the team page
// (REQ-107; docs/design/REQ-107-e2e-team-web.md, 4.3). Node built-ins only. It
// never calls a model, never opens a connection and reads no variable and no
// stdin. The spec copies it into a folder of its own under the temporary root and
// gives the copy to the team server as SAI_TEAM_CLAUDE_BIN; nothing in the
// repository starts this file. When started, it appends one line (its pid) to the
// file "started" in its own folder, the folder of the running file, writes nothing
// else and ends with code 1, so a run of a project that started it fails at once.
// The spec starts its copy once on purpose and sees the line; at the end of every
// test it asserts that the line never appeared.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
fs.appendFileSync(path.join(here, "started"), `${process.pid}\n`);
process.exitCode = 1;
