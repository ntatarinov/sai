#!/usr/bin/env node
// A stand-in for a server of Sai, for the tests of the starter
// (docs/design/REQ-105-e2e-picker.md, section 4.3, and
// docs/design/REQ-106-e2e-pixel-office.md, section 4.2). Node built-ins only. It
// never reads stdin. Variables: SAI_FAKE_STAND_MODE (default "ok") and
// SAI_FAKE_STAND_LOG (a file; one JSON line per event: start, env, term, child,
// child-ready, child-term, home-written, home-refused). It listens on 127.0.0.1
// and prints its link; the modes change what it does around that. Started with the
// argument --child it is the child of the mode "with-child": it ignores SIGTERM,
// tells that it is ready, and sleeps.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODE = process.env.SAI_FAKE_STAND_MODE || "ok";
const LOG = process.env.SAI_FAKE_STAND_LOG;
const MODES = new Set([
  "ok",
  "ok-late",
  "exit-early",
  "hang",
  "foreign-link",
  "exit-one",
  "ignore-term",
  "die-later",
  "quit-later",
  "noisy",
  "with-child",
  "stack",
  "write-home",
  "write-home-exit-one",
  "write-home-ignore-term",
]);
// the modes that write into the home folder after the link (only under the guard)
const WRITE_HOME = MODE.startsWith("write-home");

function log(event) {
  if (!LOG) return;
  try {
    fs.appendFileSync(LOG, `${JSON.stringify(event)}\n`);
  } catch {
    // the log is only for the tests
  }
}

// A whole write to a pipe that may be full: retries on EAGAIN.
function writeAll(fd, text) {
  const buffer = Buffer.from(text);
  let offset = 0;
  while (offset < buffer.length) {
    try {
      offset += fs.writeSync(fd, buffer, offset);
    } catch (err) {
      if (err.code !== "EAGAIN") throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
  }
}

const stdout = (text) => writeAll(1, text);
const stderr = (text) => writeAll(2, text);

if (process.argv.includes("--child")) {
  // ignores the signal of the group; the log tells that the signal arrived
  process.on("SIGTERM", () => log({ event: "child-term", pid: process.pid }));
  log({ event: "child-ready", pid: process.pid });
  stdout("ready\n");
  setInterval(() => {}, 1000);
} else {
  main();
}

function main() {
  log({ event: "start", pid: process.pid, argv: process.argv.slice(2) });
  log({
    event: "env",
    keys: Object.keys(process.env).sort(),
    home: os.homedir(),
  });
  if (!MODES.has(MODE)) {
    stderr(`fake stand: unknown mode ${MODE}\n`);
    process.exit(2);
  }
  if (MODE === "exit-early") {
    stderr("fake stand: cannot start, boom\n");
    process.exit(3);
  }

  let server = null;
  // closes the server step by step and ends with `code` when the close is done
  const shutdown = (code) => {
    if (server === null) process.exit(code);
    server.close(() => process.exit(code));
    server.closeAllConnections();
  };
  process.on("SIGTERM", () => {
    log({ event: "term" });
    if (MODE === "ignore-term" || MODE === "write-home-ignore-term") return;
    shutdown(MODE === "exit-one" || MODE === "write-home-exit-one" ? 1 : 0);
  });

  if (MODE === "hang") {
    setInterval(() => {}, 1000);
    return;
  }

  server = http.createServer((req, res) => {
    req.resume();
    res.end("ok");
  });
  server.on("error", (err) => {
    stderr(`fake stand: ${err.code ?? "error"}\n`);
    process.exit(1);
  });
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    const link =
      MODE === "foreign-link"
        ? "http://example.com:1/t/demo/"
        : `http://127.0.0.1:${port}/t/demo/`;
    if (MODE === "ok-late") setTimeout(() => announce(link), 800);
    else if (MODE === "with-child") startChild(link);
    else announce(link);
  });
}

function announce(link) {
  stdout(`Fake stand ready.\n${link}\n`);
  if (WRITE_HOME) writeHome();
  if (MODE === "die-later") setTimeout(() => process.exit(5), 300);
  if (MODE === "quit-later") setTimeout(() => process.exit(0), 300);
  if (MODE === "stack") {
    stderr("Error: boom\n    at fake (file.js:1:1)\n");
  }
  if (MODE === "noisy") {
    const chunk = `${"x".repeat(4095)}\n`;
    for (let i = 0; i < 512; i++) {
      stdout(chunk);
      stderr(chunk);
    }
    stdout("END\n");
    stderr("END\n");
  }
}

// The modes "write-home…": a folder and a file in the home folder, as a server that
// keeps its state under the home folder would make, but only when that folder lies
// strictly under the real temporary root of this process. So a starter that gives
// no private home makes the stand-in write nothing into the home folder of the
// person who runs the tests (docs/design/REQ-106-e2e-pixel-office.md, 4.2).
function writeHome() {
  let home = null;
  let rel = "";
  try {
    const root = fs.realpathSync(os.tmpdir());
    home = fs.realpathSync(os.homedir());
    rel = path.relative(root, home);
  } catch {
    // a root or a home folder that cannot be resolved: nothing is written
  }
  if (rel === "" || path.isAbsolute(rel) || rel.split(path.sep)[0] === "..") {
    log({ event: "home-refused" });
    return;
  }
  try {
    fs.mkdirSync(path.join(home, ".fake-stand-dir"));
    // "wx": a new file only, never through a link or over another file
    fs.writeFileSync(path.join(home, ".fake-stand-note"), "fake\n", {
      flag: "wx",
    });
  } catch (err) {
    stderr(
      `fake stand: the home folder was not written: ${err.code ?? "error"}\n`,
    );
    return;
  }
  log({ event: "home-written" });
}

// The child is in the same group (no detach). The link is printed only when the
// child has said that it ignores SIGTERM and has logged it.
function startChild(link) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "--child"],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  let said = "";
  let done = false;
  const fail = () => {
    if (done) return;
    done = true;
    stderr("fake stand: the child did not become ready\n");
    process.exit(4);
  };
  const limit = setTimeout(fail, 5000);
  child.on("error", fail);
  child.on("exit", fail);
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    said += chunk;
    if (done || !said.includes("ready\n")) return;
    done = true;
    clearTimeout(limit);
    child.stdout.destroy();
    child.unref();
    log({ event: "child", pid: child.pid });
    announce(link);
  });
}
