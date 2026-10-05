// HK: the hook and the command from settings.json (design 10.2, REQ-001
// criteria 1, 2, 3, 10, 11). The hook is run as Claude Code runs it: the
// command and args of .claude/settings.json, in temporary folders, against a
// real server on port 0 or a fake one.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  buildWriteBody,
  signBody,
  verifySignature,
} from "../src/pixel-office/protocol.js";
import {
  HOOK_EVENTS,
  LINE_KEYS,
  isCanonicalTime,
} from "../src/pixel-office/public/schema.js";
import {
  LABELS,
  ROOT,
  SRC,
  assertSafeEnv,
  childEnv,
  hookInputs,
  isInsideTmp,
  prepareState,
  runHook,
  sandbox,
  sha256OrNone,
  startServer,
} from "./pixel-office-helpers.js";

const MARK = "sai-pixel-office";

// A fake server that records every request and answers with a fixed status.
async function captureServer(t, box, status = 204) {
  const secret = prepareState(box);
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      requests.push({
        headers: req.headers,
        method: req.method,
        url: req.url,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      res.statusCode = status;
      res.end();
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  fs.writeFileSync(path.join(box.dir, "port"), `${server.address().port}\n`);
  return { secret, requests, port: server.address().port };
}

// A state directory with a secret and a port file that nobody listens on.
async function deadPort() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return port;
}

function quiet(r) {
  assert.equal(r.code, 0, `exit code ${r.code}: ${r.stderr}`);
  assert.equal(r.stdout, "");
}

test("HK-01: the time of the line is between the moment before the command and after it, for each of the 7 events", async (t) => {
  const srv = await startServer(t);
  const inputs = hookInputs();
  let count = 0;
  for (const event of HOOK_EVENTS) {
    const r = await runHook(srv.box, inputs[event], { event });
    quiet(r);
    const lines = srv.lines();
    count += 1;
    assert.equal(lines.length, count, `${event}: one new line`);
    const line = JSON.parse(lines[lines.length - 1]);
    assert.equal(line.hook_event_name, event);
    const ms = Date.parse(line.time);
    assert.ok(ms >= r.before, `${event}: ${line.time} before the start`);
    assert.ok(ms <= r.after, `${event}: ${line.time} after the end`);
  }
});

test("HK-02: the time is the canonical UTC record with milliseconds, as the hook sent it", async (t) => {
  const box = sandbox(t);
  const cap = await captureServer(t, box);
  const r = await runHook(box, hookInputs().UserPromptSubmit, {
    event: "UserPromptSubmit",
  });
  quiet(r);
  assert.equal(cap.requests.length, 1);
  const sent = JSON.parse(cap.requests[0].body);
  assert.ok(isCanonicalTime(sent.time), sent.time);
  assert.match(sent.time, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(new Date(sent.time).toISOString(), sent.time);
  const ms = Date.parse(sent.time);
  assert.ok(ms >= r.before && ms <= r.after);
});

for (const [suffix, event] of [
  ["a", "SessionStart"],
  ["b", "UserPromptSubmit"],
  ["c", "PostToolUse"],
  ["d", "SubagentStart"],
  ["e", "SubagentStop"],
  ["f", "Stop"],
  ["g", "SessionEnd"],
]) {
  test(`HK-03${suffix}: ${event} - forbidden fields (unique labels) never reach the journal`, async (t) => {
    const srv = await startServer(t);
    const input = hookInputs()[event];
    const r = await runHook(srv.box, input, { event });
    quiet(r);
    const lines = srv.lines();
    assert.equal(lines.length, 1, "exactly one line");
    const line = JSON.parse(lines[0]);
    for (const key of Object.keys(line)) {
      assert.ok(LINE_KEYS.includes(key), `key ${key} is not in LINE_KEYS`);
    }
    const file = fs.readFileSync(srv.eventsFile, "utf8");
    const used = LABELS.filter((l) => JSON.stringify(input).includes(l));
    assert.ok(used.length > 0, "the input has labels");
    for (const l of used) assert.equal(file.includes(l), false, l);
    if (event === "PostToolUse") {
      assert.equal(line.launched_agent_id, "agent-xyz-01");
      assert.equal(line.subagent_type, "general-purpose");
      assert.equal(line.tool_use_id, "toolu_01ABC");
    }
  });
}

test("HK-04: the own field `source` of SessionStart does not reach the line; the source is REAL", async (t) => {
  const srv = await startServer(t);
  const input = { ...hookInputs().SessionStart, source: "resume" };
  quiet(await runHook(srv.box, input));
  const line = JSON.parse(srv.lines()[0]);
  assert.equal(line.source, "REAL");
  const body = buildWriteBody(input, "2026-09-20T10:00:00.000Z");
  assert.equal(Object.hasOwn(body, "source"), false);
});

test("HK-05: a description of 150 characters is stored as the first 100 code points; 100 is unchanged; empty has no key", async (t) => {
  const long = "я".repeat(75) + "😀".repeat(75);
  const expected = "я".repeat(75) + "😀".repeat(25);
  const now = "2026-09-20T10:00:00.000Z";
  const mk = (description) => ({
    ...hookInputs().PostToolUse,
    tool_input: { subagent_type: "general-purpose", description },
  });
  assert.equal(buildWriteBody(mk(long), now).description, expected);
  assert.equal(
    Array.from(buildWriteBody(mk(long), now).description).length,
    100,
  );
  const hundred = "ж".repeat(100);
  assert.equal(buildWriteBody(mk(hundred), now).description, hundred);
  assert.equal(
    Object.hasOwn(buildWriteBody(mk(""), now), "description"),
    false,
  );
  // and through the real command
  const srv = await startServer(t);
  quiet(await runHook(srv.box, mk(long), { event: "PostToolUse" }));
  assert.equal(JSON.parse(srv.lines()[0]).description, expected);
});

test("HK-06: events that are dropped leave no line", async (t) => {
  const srv = await startServer(t);
  const ok = hookInputs();
  const cases = [
    { ...ok.PostToolUse, tool_name: "Bash" },
    { ...ok.PostToolUse, tool_response: { status: "x" } },
    { ...ok.SubagentStart, agent_id: undefined },
    { ...ok.Stop, hook_event_name: "Notification" },
    { ...ok.Stop, session_id: undefined },
  ];
  for (const input of cases) {
    const before = srv.sha();
    quiet(await runHook(srv.box, input));
    assert.equal(srv.sha(), before);
  }
  assert.equal(srv.lines().length, 0);
});

test("HK-07: a call of Agent from a subagent keeps the caller's agent_id and agent_type; from the main session there is no agent_id", async (t) => {
  const now = "2026-09-20T10:00:00.000Z";
  const base = hookInputs().PostToolUse;
  const fromSub = buildWriteBody(
    { ...base, agent_id: "caller-1", agent_type: "Explore" },
    now,
  );
  assert.equal(fromSub.agent_id, "caller-1");
  assert.equal(fromSub.agent_type, "Explore");
  const fromMain = buildWriteBody(base, now);
  assert.equal(Object.hasOwn(fromMain, "agent_id"), false);
  const srv = await startServer(t);
  quiet(
    await runHook(srv.box, {
      ...base,
      agent_id: "caller-1",
      agent_type: "Explore",
    }),
  );
  const line = JSON.parse(srv.lines()[0]);
  assert.equal(line.agent_id, "caller-1");
  assert.equal(line.agent_type, "Explore");
});

test("HK-08: the command works from sai/, sai/tools and a folder outside sai/", async (t) => {
  const srv = await startServer(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "po-cwd-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  let n = 0;
  for (const cwd of [ROOT, path.join(ROOT, "tools"), outside]) {
    quiet(await runHook(srv.box, hookInputs().UserPromptSubmit, { cwd }));
    n += 1;
    assert.equal(srv.lines().length, n, cwd);
  }
});

test("HK-09: PATH without node - the event is recorded (Node 22 is found by node-path)", async (t) => {
  const srv = await startServer(t);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "po-path-"));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const r = await runHook(srv.box, hookInputs().UserPromptSubmit, {
    env: childEnv(srv.box, { PATH: empty }),
  });
  quiet(r);
  assert.equal(srv.lines().length, 1);
});

test("HK-10: a node v25.2.1 in PATH does not break the hook; without node-path Node 22 comes from SAI_NODE_FALLBACKS", async (t) => {
  const srv = await startServer(t);
  const tools = fs.mkdtempSync(path.join(os.tmpdir(), "po-stub-"));
  t.after(() => fs.rmSync(tools, { recursive: true, force: true }));
  const stubDir = path.join(tools, "stub");
  const fallbackDir = path.join(tools, "fallback");
  fs.mkdirSync(stubDir);
  fs.mkdirSync(fallbackDir);
  const stub = path.join(stubDir, "node");
  fs.writeFileSync(stub, '#!/bin/sh\necho "v25.2.1"\n');
  fs.chmodSync(stub, 0o755);
  // The link to the running Node is made for the hook to execute; it is not
  // changed by the test and the folder is removed without following links.
  fs.symlinkSync(process.execPath, path.join(fallbackDir, "node"));
  const env = (extra) => childEnv(srv.box, { PATH: stubDir, ...extra });
  // 1. node-path exists (the server wrote it)
  quiet(
    await runHook(srv.box, hookInputs().UserPromptSubmit, { env: env({}) }),
  );
  assert.equal(srv.lines().length, 1);
  // 2. no node-path: the stub is not Node 22, the fallback directory is
  fs.rmSync(path.join(srv.dir, "node-path"));
  quiet(
    await runHook(srv.box, hookInputs().UserPromptSubmit, {
      env: env({ SAI_NODE_FALLBACKS: fallbackDir }),
    }),
  );
  assert.equal(srv.lines().length, 2);
});

// ------------------------------------------------------------- HK-11 matrix

test("HK-11a: empty or not-JSON input - exit 0, quiet, journal unchanged", async (t) => {
  const srv = await startServer(t);
  for (const text of ["", "not json at all", "{", "[1,2,3]", "null"]) {
    const before = srv.sha();
    const r = await runHook(srv.box, text);
    quiet(r);
    assert.ok(r.ms <= 3500);
    assert.equal(srv.sha(), before);
  }
});

test("HK-11b: no state directory, no secret, no port or garbage in them - exit 0, quiet, nothing sent", async (t) => {
  // no state directory at all: nothing is created
  const none = sandbox(t);
  const r0 = await runHook(none, hookInputs().Stop);
  quiet(r0);
  assert.ok(r0.ms <= 3500);
  assert.equal(fs.existsSync(none.dir), false);
  // a server is up; the files the hook reads are damaged one by one
  const srv = await startServer(t);
  const secretFile = path.join(srv.dir, "write-secret");
  const portFile = path.join(srv.dir, "port");
  const secret = fs.readFileSync(secretFile, "utf8");
  const port = fs.readFileSync(portFile, "utf8");
  const variants = [
    () => fs.rmSync(secretFile),
    () => fs.writeFileSync(secretFile, "short\n"),
    () => fs.writeFileSync(secretFile, secret),
    () => fs.rmSync(portFile),
    () => fs.writeFileSync(portFile, "garbage\n"),
    () => fs.writeFileSync(portFile, "99999\n"),
    () => fs.writeFileSync(portFile, ""),
  ];
  const expectSent = [false, false, true, false, false, false, false];
  let lines = 0;
  for (let i = 0; i < variants.length; i++) {
    fs.writeFileSync(secretFile, secret);
    fs.writeFileSync(portFile, port);
    variants[i]();
    const r = await runHook(srv.box, hookInputs().UserPromptSubmit);
    quiet(r);
    assert.ok(r.ms <= 3500);
    if (expectSent[i]) lines += 1;
    assert.equal(srv.lines().length, lines, `variant ${i}`);
  }
});

test("HK-11c: the server is not running - exit 0, quiet, journal unchanged", async (t) => {
  const box = sandbox(t);
  prepareState(box);
  fs.writeFileSync(path.join(box.dir, "port"), `${await deadPort()}\n`);
  const r = await runHook(box, hookInputs().UserPromptSubmit);
  quiet(r);
  assert.ok(r.ms <= 3500);
  assert.equal(sha256OrNone(path.join(box.dir, "events.jsonl")), "none");
});

test("HK-11d: the server accepts the connection and is silent - exit 0, quiet, within 3500 ms", async (t) => {
  const box = sandbox(t);
  prepareState(box);
  const sockets = new Set();
  const silent = net.createServer((s) => sockets.add(s));
  await new Promise((r) => silent.listen(0, "127.0.0.1", r));
  t.after(() => {
    for (const s of sockets) s.destroy();
    silent.close();
  });
  fs.writeFileSync(path.join(box.dir, "port"), `${silent.address().port}\n`);
  const r = await runHook(box, hookInputs().UserPromptSubmit);
  quiet(r);
  assert.ok(r.ms <= 3500, `took ${r.ms} ms`);
  assert.equal(sha256OrNone(path.join(box.dir, "events.jsonl")), "none");
});

test("HK-11e: answers 400, 401, 403, 413, 500 - exit 0, quiet, no retry", async (t) => {
  for (const status of [400, 401, 403, 413, 500]) {
    const box = sandbox(t);
    const cap = await captureServer(t, box, status);
    const r = await runHook(box, hookInputs().UserPromptSubmit);
    quiet(r);
    assert.ok(r.ms <= 3500);
    assert.equal(cap.requests.length, 1, `status ${status}: one request`);
  }
});

test("HK-11f: no hook files in CLAUDE_PROJECT_DIR - exit 0, quiet, the mark is still written", async (t) => {
  const srv = await startServer(t);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "po-proj-"));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const r = await runHook(srv.box, hookInputs().UserPromptSubmit, {
    projectDir: empty,
  });
  quiet(r);
  assert.ok(r.stderr.startsWith(MARK));
  assert.equal(srv.lines().length, 0);
});

test("HK-11g: Node 22 is not found - exit 0, quiet, journal unchanged", async (t) => {
  const srv = await startServer(t);
  fs.rmSync(path.join(srv.dir, "node-path"));
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "po-empty-"));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const r = await runHook(srv.box, hookInputs().UserPromptSubmit, {
    env: childEnv(srv.box, { PATH: empty, SAI_NODE_FALLBACKS: empty }),
  });
  quiet(r);
  assert.equal(srv.lines().length, 0);
});

// A temporary project with its own hook files in tools/src/pixel-office/.
function fakeProject(t, files) {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), "po-fakeproj-"));
  t.after(() => fs.rmSync(proj, { recursive: true, force: true }));
  const dir = path.join(proj, "tools", "src", "pixel-office");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text);
  }
  return proj;
}

test("HK-11h: hook.js throws an exception - exit 0, quiet, journal unchanged", async (t) => {
  const srv = await startServer(t);
  const proj = fakeProject(t, {
    "hook.sh": fs.readFileSync(path.join(SRC, "hook.sh"), "utf8"),
    "hook.js": 'throw new Error("boom");\n',
  });
  const r = await runHook(srv.box, hookInputs().UserPromptSubmit, {
    projectDir: proj,
  });
  quiet(r);
  assert.equal(srv.lines().length, 0);
});

test("HK-11i: hook.sh prints noise to stdout and exits with 3 - the command exits 0 with empty stdout", async (t) => {
  const srv = await startServer(t);
  const proj = fakeProject(t, {
    "hook.sh": '#!/bin/sh\necho "noise on stdout"\necho "noise" >&2\nexit 3\n',
  });
  const r = await runHook(srv.box, hookInputs().UserPromptSubmit, {
    projectDir: proj,
  });
  quiet(r);
  assert.equal(r.stderr.includes("noise"), false);
  assert.equal(srv.lines().length, 0);
});

test("HK-11j: input larger than 8 MiB - exit 0, quiet, within 3500 ms, journal unchanged", async (t) => {
  const srv = await startServer(t);
  const r = await runHook(srv.box, "a".repeat(9 * 1024 * 1024));
  assert.equal(r.stdout, "");
  assert.ok(r.code === 0 || r.code === null, `code ${r.code}`);
  assert.ok(r.ms <= 3500, `took ${r.ms} ms`);
  assert.equal(srv.lines().length, 0);
});

test("HK-12: stdout of the command is empty in every case above", async (t) => {
  const srv = await startServer(t);
  const inputs = hookInputs();
  for (const event of HOOK_EVENTS) {
    assert.equal((await runHook(srv.box, inputs[event], { event })).stdout, "");
  }
  assert.equal((await runHook(srv.box, "not json")).stdout, "");
  const dead = sandbox(t);
  assert.equal((await runHook(dead, inputs.Stop)).stdout, "");
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "po-proj-"));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  assert.equal(
    (await runHook(srv.box, inputs.Stop, { projectDir: empty })).stdout,
    "",
  );
});

test("HK-12b: hook.sh run directly (without the guard that discards its output) prints nothing to stdout or stderr", async (t) => {
  const srv = await startServer(t);
  const run = (input) =>
    new Promise((resolve) => {
      const child = spawn("/bin/sh", [path.join(SRC, "hook.sh")], {
        env: childEnv(srv.box),
        stdio: ["pipe", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (code) => resolve({ code, out, err }));
      child.stdin.end(input);
    });
  for (const input of [JSON.stringify(hookInputs().Stop), "not json", ""]) {
    const r = await run(input);
    assert.equal(r.code, 0);
    assert.equal(r.out, "");
    assert.equal(r.err, "");
  }
  assert.equal(srv.lines().length, 1);
});

test("HK-13: stderr of the command starts with the mark sai-pixel-office in every case, f included", async (t) => {
  const srv = await startServer(t);
  const inputs = hookInputs();
  for (const event of HOOK_EVENTS) {
    const r = await runHook(srv.box, inputs[event], { event });
    assert.ok(r.stderr.startsWith(MARK), `${event}: ${r.stderr}`);
  }
  assert.ok((await runHook(srv.box, "not json")).stderr.startsWith(MARK));
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "po-proj-"));
  t.after(() => fs.rmSync(empty, { recursive: true, force: true }));
  const f = await runHook(srv.box, inputs.Stop, { projectDir: empty });
  assert.ok(f.stderr.startsWith(MARK));
});

test("HK-14: the request of the hook has no secret; the signature is valid; neither stdout nor stderr has the secret", async (t) => {
  const box = sandbox(t);
  const cap = await captureServer(t, box);
  const r = await runHook(box, hookInputs().Stop);
  quiet(r);
  assert.equal(cap.requests.length, 1);
  const req = cap.requests[0];
  const whole = JSON.stringify(req.headers) + req.body;
  assert.equal(whole.includes(cap.secret), false);
  assert.equal(r.stdout.includes(cap.secret), false);
  assert.equal(r.stderr.includes(cap.secret), false);
  assert.equal(req.method, "POST");
  assert.equal(req.url, "/api/events");
  assert.equal(
    verifySignature(
      cap.secret,
      req.body,
      req.headers["x-pixel-office-signature"],
    ),
    true,
  );
});

test("HK-15: 20 simultaneous hooks against a real server give 20 lines", async (t) => {
  const srv = await startServer(t);
  const inputs = hookInputs();
  const runs = [];
  for (let i = 0; i < 20; i++) {
    runs.push(
      runHook(
        srv.box,
        { ...inputs.UserPromptSubmit, session_id: `sess-par-${i}` },
        { event: "UserPromptSubmit" },
      ),
    );
  }
  const results = await Promise.all(runs);
  for (const r of results) {
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
  }
  const lines = srv.lines();
  assert.equal(lines.length, 20);
  const sessions = new Set(lines.map((l) => JSON.parse(l).session_id));
  assert.equal(sessions.size, 20);
});

test("HK-16: buildWriteBody table; identifiers over 128 characters drop the event; non-strings are not copied; signBody known answer", () => {
  const now = "2026-09-20T10:00:00.000Z";
  const inputs = hookInputs("sess-0001");
  const out = buildWriteBody(inputs.SubagentStart, now);
  assert.deepEqual(out, {
    time: now,
    hook_event_name: "SubagentStart",
    session_id: "sess-0001",
    agent_id: "agent-xyz-01",
    agent_type: "general-purpose",
  });
  assert.deepEqual(buildWriteBody(inputs.Stop, now), {
    time: now,
    hook_event_name: "Stop",
    session_id: "sess-0001",
  });
  const post = buildWriteBody(inputs.PostToolUse, now);
  assert.deepEqual(Object.keys(post).sort(), [
    "description",
    "hook_event_name",
    "launched_agent_id",
    "session_id",
    "subagent_type",
    "time",
    "tool_use_id",
  ]);
  const long = "x".repeat(129);
  assert.equal(buildWriteBody({ ...inputs.Stop, session_id: long }, now), null);
  assert.equal(
    buildWriteBody({ ...inputs.SubagentStart, agent_id: long }, now),
    null,
  );
  assert.equal(
    buildWriteBody({ ...inputs.SubagentStart, agent_type: long }, now),
    null,
  );
  assert.ok(
    buildWriteBody({ ...inputs.Stop, session_id: "x".repeat(128) }, now) !==
      null,
  );
  // not strings are not copied
  const odd = buildWriteBody(
    { ...inputs.SubagentStart, agent_type: 5, session_id: "s" },
    now,
  );
  assert.equal(Object.hasOwn(odd, "agent_type"), false);
  assert.equal(
    buildWriteBody({ ...inputs.Stop, session_id: { a: 1 } }, now),
    null,
  );
  // known answer of signBody (design 2.2, probe P12)
  const secret = "fictional-secret-AAAAAAAAAAAAAAAAAAAAAAAAAA";
  const body =
    '{"time":"2026-01-01T00:00:00.000Z","hook_event_name":"SessionStart","session_id":"sess-0001"}';
  assert.equal(Buffer.byteLength(body), 93);
  const known =
    "4b10787ad84cb619fbc717640b635f24477c05db51a4e2066eb6a700ae6231d5";
  assert.equal(signBody(secret, body), known);
  const asBase64 = Buffer.from(secret, "base64url");
  assert.notEqual(signBody(asBase64, body), known);
});

test("HK-17: every child process of the tests gets HOME and the state directory inside the temporary folder; port 4780 is not used", async (t) => {
  const box = sandbox(t);
  const env = childEnv(box);
  assert.ok(isInsideTmp(env.HOME));
  assert.ok(isInsideTmp(env.SAI_PIXEL_OFFICE_DIR));
  assert.notEqual(env.HOME, os.homedir());
  assert.throws(() => assertSafeEnv({ ...env, HOME: os.homedir() }));
  assert.throws(() =>
    assertSafeEnv({
      ...env,
      SAI_PIXEL_OFFICE_DIR: path.join(os.homedir(), ".sai-pixel-office"),
    }),
  );
  const srv = await startServer(t);
  assert.notEqual(srv.port, 4780);
  assert.ok(isInsideTmp(srv.dir));
});
