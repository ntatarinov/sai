// Tests of the amendment "the group is not gone" and of the stop of what a normal exit
// leaves (REQ-010 r6, sections 5.4 and 5.6, I11 (b)). No real claude and no fake file
// of fixtures is started as the executor: io.spawn gives a stand-in Node process of
// this file that prints a sample stream of fixtures/team/ and leaves a descendant,
// either outside the process group (it keeps stdout, so the group "is not gone") or
// inside it. Every descendant is killed by the test itself; each call has a limit.
import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { getExecutor } from "../src/team/executor.js";
import { FAIL_DETAIL } from "../src/team/language.js";
import {
  FIXTURES,
  ioFor,
  killQuietly,
  makeProject,
  makeSandbox,
  pidAlive,
  requestFor,
  waitUntil,
  withLimit,
} from "./exec-helpers.js";

// The stand-in process. argv: sample file, "outside" | "inside", pid file. It prints
// the sample, leaves the descendant, and exits with code 0 when the sample is out.
const STUB = `
const fs = require("node:fs");
const cp = require("node:child_process");
process.stdin.resume();
const [sample, where, pidFile] = process.argv.slice(1);
const outside = where === "outside";
const kid = cp.spawn(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], {
  detached: outside,
  stdio: outside ? ["ignore", "inherit", "ignore"] : "ignore",
});
fs.writeFileSync(pidFile, String(kid.pid));
kid.unref();
process.stdout.write(fs.readFileSync(sample), () => process.exit(0));
`;

// Runs claude-cli once with the stand-in; returns { res, pid } (pid of the descendant).
async function runWithStub(t, sample, where) {
  const sb = makeSandbox(t);
  const p = makeProject(sb);
  const pidFile = path.join(sb.root, "kid.pid");
  const io = ioFor(sb, {}, {});
  let calls = 0;
  io.spawn = (_cmd, _args, opts) => {
    calls += 1;
    return cp.spawn(
      process.execPath,
      ["-e", STUB, path.join(FIXTURES, sample), where, pidFile],
      opts,
    );
  };
  const readPid = () =>
    fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, "utf8")) : null;
  let res;
  try {
    res = await withLimit(
      getExecutor("claude-cli").run(requestFor(sb, p.id), io),
      40_000,
    );
  } finally {
    const pid = readPid();
    if (pid !== null) {
      // alive or not, the test leaves nothing (checked by the caller before this)
      t.after(() => killQuietly(pid));
    }
  }
  assert.equal(calls, 1, "one spawn, no retry inside run()");
  return { res, pid: readPid() };
}

test("I11 (b): a result 'ok' while the group is not gone is not accepted: failed, the detail 'group', no retry, no answer", async (t) => {
  const { res, pid } = await runWithStub(t, "stream-ok.jsonl", "outside");
  assert.equal(res.outcome, "failed");
  assert.equal(res.detail, FAIL_DETAIL.group);
  assert.equal(res.transient, false);
  assert.equal(res.answer, null);
  assert.equal(res.spawned, true);
  assert.ok(pid !== null, "the stand-in did not start its descendant");
  killQuietly(pid);
  assert.ok(
    await waitUntil(() => !pidAlive(pid), 3000),
    "the test left a process",
  );
});

test("I11 (b): an answer outside the schema while the group is not gone: the detail 'group', transient false (no retry), not the text of the schema", async (t) => {
  const { res, pid } = await runWithStub(
    t,
    "stream-out-of-schema.jsonl",
    "outside",
  );
  assert.equal(res.outcome, "invalid_output");
  assert.equal(res.detail, FAIL_DETAIL.group);
  assert.notEqual(res.detail, FAIL_DETAIL.schema);
  assert.equal(res.transient, false);
  assert.equal(res.answer, null);
  killQuietly(pid);
  assert.ok(await waitUntil(() => !pidAlive(pid), 3000));
});

test("I11 (b): a broken stream (not JSON) while the group is not gone: the detail 'group', transient false (no retry)", async (t) => {
  const { res, pid } = await runWithStub(t, "stream-not-json.jsonl", "outside");
  assert.equal(res.outcome, "invalid_output");
  assert.equal(res.detail, FAIL_DETAIL.group);
  assert.equal(res.transient, false);
  assert.equal(res.answer, null);
  killQuietly(pid);
  assert.ok(await waitUntil(() => !pidAlive(pid), 3000));
});

test("I11 (b) control: the same streams with the group gone keep their usual outcomes (ok; invalid_output with the schema text, transient)", async (t) => {
  const ok = await runWithStub(t, "stream-ok.jsonl", "inside");
  assert.equal(ok.res.outcome, "ok");
  assert.equal(ok.res.detail, null);
  const bad = await runWithStub(t, "stream-out-of-schema.jsonl", "inside");
  assert.equal(bad.res.outcome, "invalid_output");
  assert.equal(bad.res.detail, FAIL_DETAIL.schema);
  assert.equal(bad.res.transient, true);
  const broken = await runWithStub(t, "stream-not-json.jsonl", "inside");
  assert.equal(broken.res.outcome, "invalid_output");
  assert.notEqual(broken.res.detail, FAIL_DETAIL.group);
});

test("5.6: what a normal exit leaves in the group is stopped before run() returns; the result is the one of the stream", async (t) => {
  const { res, pid } = await runWithStub(t, "stream-ok.jsonl", "inside");
  assert.ok(pid !== null, "the stand-in did not start its descendant");
  assert.equal(res.outcome, "ok");
  assert.equal(res.detail, null);
  assert.equal(
    pidAlive(pid),
    false,
    "the descendant of the group is alive after run() returned",
  );
});
