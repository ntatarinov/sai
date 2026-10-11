// A preload for the tests of REQ-035 (design REQ-035-team-web-control.md, section
// 15, CTL-8b): the first write of a file in the folder inbox/ack/ of a project
// fails with EIO, so the engine writes the event of a command and its ack is lost
// (the case «the ack did not reach, the event is written», criterion 8 (б)).
// Loaded only into the process of an engine by a test, with --import; it writes
// nothing itself and never touches the network.
import fs from "node:fs";
import path from "node:path";

const real = fs.writeFileSync;
let done = false;
fs.writeFileSync = function (file, ...rest) {
  if (
    !done &&
    typeof file === "string" &&
    path.basename(path.dirname(file)) === "ack" &&
    path.basename(path.dirname(path.dirname(file))) === "inbox"
  ) {
    done = true;
    throw Object.assign(new Error(`EIO: injected fault, open '${file}'`), {
      code: "EIO",
      errno: -5,
      syscall: "open",
      path: file,
    });
  }
  return real.call(fs, file, ...rest);
};
