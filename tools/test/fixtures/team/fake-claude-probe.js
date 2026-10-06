#!/usr/bin/env node
// A second fake executable of Claude Code for the tests of Sai Team (design
// REQ-010, section 15.4; the probes of the findings of the security and review
// gates). Like fake-claude.js it never calls a model and never goes to the
// network. The plan is $HOME/fake-claude/probe.json:
//
//   { "mode": "orphan-stdout" }   starts a child in ANOTHER process group that keeps
//                                 this process's stdout open and lives up to 60 s,
//                                 writes its pid to $HOME/fake-claude/orphan.pid and
//                                 exits 0 at once
//   { "mode": "big-line", "bytes": N }   writes N bytes of "a" without a line break
//                                 in chunks of 64 KiB, then waits
//   { "mode": "split", "sample": "stream-ok.jsonl", "max_chunk": 7 }
//                                 writes the sample in chunks of 1..max_chunk bytes
//                                 and no final line break, then exits 0
//
// The whole stdin is read first. The log is $HOME/fake-claude/probe-log.jsonl.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_NAME = /^stream-[a-z0-9-]+\.jsonl$/;
const home = process.env.HOME;
if (typeof home !== "string" || !path.isAbsolute(home)) {
  process.stderr.write("fake-claude-probe: no HOME\n");
  process.exit(90);
}
const dir = path.join(home, "fake-claude");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const plan = JSON.parse(fs.readFileSync(path.join(dir, "probe.json"), "utf8"));
fs.appendFileSync(
  path.join(dir, "probe-log.jsonl"),
  `${JSON.stringify({ event: "start", pid: process.pid, mode: plan.mode })}\n`,
);

function write(chunk) {
  return new Promise((resolve) => {
    if (process.stdout.write(chunk)) resolve();
    else process.stdout.once("drain", resolve);
  });
}

async function main() {
  await new Promise((resolve) => {
    process.stdin.on("data", () => {});
    process.stdin.on("end", resolve);
    process.stdin.on("error", resolve);
  });
  if (plan.mode === "orphan-stdout") {
    const child = spawn(
      process.execPath,
      [
        "-e",
        "setInterval(() => {}, 1000); setTimeout(() => process.exit(0), 60000)",
      ],
      { detached: true, stdio: ["ignore", "inherit", "ignore"] },
    );
    fs.writeFileSync(path.join(dir, "orphan.pid"), String(child.pid));
    child.unref();
    process.exitCode = 0;
    return;
  }
  if (plan.mode === "big-line") {
    const chunk = Buffer.alloc(64 * 1024, 0x61);
    let left = plan.bytes;
    while (left > 0) {
      const n = Math.min(left, chunk.length);
      await write(n === chunk.length ? chunk : chunk.subarray(0, n));
      left -= n;
    }
    setInterval(() => {}, 1000);
    return;
  }
  if (plan.mode === "split") {
    if (!SAMPLE_NAME.test(plan.sample)) process.exit(91);
    const text = fs
      .readFileSync(path.join(HERE, plan.sample), "utf8")
      .replace(/\n$/, "");
    const bytes = Buffer.from(text, "utf8");
    let at = 0;
    let size = 1;
    while (at < bytes.length) {
      await write(bytes.subarray(at, at + size));
      await new Promise((r) => setTimeout(r, 1));
      at += size;
      size = (size % plan.max_chunk) + 1;
    }
    process.exitCode = 0;
    return;
  }
  process.exit(92);
}

main();
