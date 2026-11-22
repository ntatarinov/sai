// HK: the hook and the command from settings.json (design 10.2, REQ-001
// criteria 1, 2, 3, 10, 11). The hook is run as Claude Code runs it: the
// command and args of .claude/settings.json, in temporary folders, against a
// real server on port 0 or a fake one.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  BODY_MAX,
  HOOK_INPUT_MAX,
  PROMPT_SCAN_MAX,
} from "../src/pixel-office/config.js";
import { maskSecrets, prepareText } from "../src/pixel-office/mask.js";
import {
  buildWriteBody,
  signBody,
  verifySignature,
} from "../src/pixel-office/protocol.js";
import {
  HOOK_EVENTS,
  LINE_KEYS,
  MASK_LABEL,
  PROMPT_MAX,
  SERVICE_MARKERS,
  isCanonicalTime,
} from "../src/pixel-office/public/schema.js";
import {
  LABELS,
  MASK_KEEP_ROWS,
  MASK_ROWS,
  MASK_RESIDUAL,
  MASK_RULE_ROWS,
  ROOT,
  SRC,
  assertSafeEnv,
  childEnv,
  hookInputs,
  isInsideTmp,
  prepareState,
  rng,
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

// REQ-008 12.1: the text of an owner message is stored in exactly one place
// when storage is on; with storage off and for a service message nothing of
// the input reaches the journal, as before.
test("HK-03b: UserPromptSubmit - forbidden fields (unique labels) never reach the journal; the message text only as prompt_text of an owner message with storage on", async (t) => {
  const checkKeys = (line) => {
    for (const key of Object.keys(line)) {
      assert.ok(LINE_KEYS.includes(key), `key ${key} is not in LINE_KEYS`);
    }
  };
  const runOnce = async (input, envExtra) => {
    const srv = await startServer(t);
    const r = await runHook(srv.box, input, {
      event: "UserPromptSubmit",
      envExtra,
    });
    quiet(r);
    const lines = srv.lines();
    assert.equal(lines.length, 1, "exactly one line");
    const line = JSON.parse(lines[0]);
    checkKeys(line);
    const file = fs.readFileSync(srv.eventsFile, "utf8");
    const used = LABELS.filter((l) => JSON.stringify(input).includes(l));
    assert.ok(used.length > 0, "the input has labels");
    return { line, file, used };
  };

  // (1) Storage off: no label at all, the prompt included.
  const off = hookInputs().UserPromptSubmit;
  const r1 = await runOnce(off, { SAI_PIXEL_OFFICE_STORE_TEXT: "0" });
  for (const l of r1.used) assert.equal(r1.file.includes(l), false, l);
  assert.equal(r1.line.prompt_kind, "owner");
  assert.equal(Object.hasOwn(r1.line, "prompt_text"), false);

  // (2) A service message: no label at all.
  const service = hookInputs().UserPromptSubmit;
  service.prompt = `<system-reminder>${service.prompt}`;
  const r2 = await runOnce(service, {});
  for (const l of r2.used) assert.equal(r2.file.includes(l), false, l);
  assert.equal(r2.line.prompt_kind, "service");
  assert.equal(Object.hasOwn(r2.line, "prompt_text"), false);

  // (3) An owner message, storage on: the prompt label exactly once, as
  // prompt_text; every other label nowhere.
  const owner = hookInputs().UserPromptSubmit;
  const r3 = await runOnce(owner, {});
  for (const l of r3.used) {
    if (l === owner.prompt) continue;
    assert.equal(r3.file.includes(l), false, l);
  }
  assert.equal(r3.file.split(owner.prompt).length - 1, 1, "prompt once");
  assert.equal(r3.line.prompt_kind, "owner");
  assert.equal(r3.line.prompt_text, owner.prompt);
  assert.equal(Object.hasOwn(r3.line, "prompt"), false);
  for (const [key, value] of Object.entries(r3.line)) {
    if (key === "prompt_text") continue;
    assert.equal(String(value).includes(owner.prompt), false, key);
  }
});

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

// ------------------------------------------------------------ REQ-008 (a)

const NOW_ISO = "2026-10-05T12:00:00.000Z";
const UPS = (prompt, session = "sess-ups-01") => ({
  hook_event_name: "UserPromptSubmit",
  session_id: session,
  prompt,
});
const ON = { storeText: true };

// Every file of a folder, recursively, as [path, text].
function filesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (entry.isFile()) out.push([full, fs.readFileSync(full, "utf8")]);
  }
  return out;
}

function bodyBytes(body) {
  return Buffer.byteLength(JSON.stringify(body), "utf8");
}

// No piece of `value` that is `size` characters long stays in `text`.
function noPiece(text, value, size = 8) {
  for (let i = 0; i + size <= value.length; i += 1) {
    assert.equal(
      text.includes(value.slice(i, i + size)),
      false,
      `piece ${JSON.stringify(value.slice(i, i + size))} stays`,
    );
  }
}

test("HK-18: an owner message gives prompt_kind owner and prompt_text; 4001 and 10000 characters are cut to 4000 with prompt_truncated; exactly 4000 is not; the body fits BODY_MAX; other events get none of the new fields", async (t) => {
  const plain = buildWriteBody(UPS("сделай X"), NOW_ISO, ON);
  assert.equal(plain.prompt_kind, "owner");
  assert.equal(plain.prompt_text, "сделай X");
  assert.equal(Object.hasOwn(plain, "prompt_truncated"), false);

  const exact = buildWriteBody(UPS("а".repeat(4000)), NOW_ISO, ON);
  assert.equal(Array.from(exact.prompt_text).length, 4000);
  assert.equal(Object.hasOwn(exact, "prompt_truncated"), false);
  for (const n of [4001, 10000]) {
    const cut = buildWriteBody(UPS("а".repeat(n)), NOW_ISO, ON);
    assert.equal(Array.from(cut.prompt_text).length, PROMPT_MAX, `n=${n}`);
    assert.equal(cut.prompt_truncated, true, `n=${n}`);
  }
  // 4000 characters of 6 bytes in JSON (\u0001) do not fit BODY_MAX: the text
  // is the longest start with which the body fits.
  const heavy = buildWriteBody(UPS("\u0001".repeat(4000)), NOW_ISO, ON);
  assert.ok(bodyBytes(heavy) <= BODY_MAX, `${bodyBytes(heavy)} bytes`);
  assert.equal(heavy.prompt_truncated, true);
  const longer = { ...heavy, prompt_text: `${heavy.prompt_text}\u0001` };
  assert.ok(bodyBytes(longer) > BODY_MAX, "the cut is the longest possible");
  // 4000 emoji (4 bytes each) in a long session id.
  const emoji = buildWriteBody(
    UPS("😀".repeat(4000), "s".repeat(128)),
    NOW_ISO,
    ON,
  );
  assert.ok(bodyBytes(emoji) <= BODY_MAX);
  assert.equal(
    Array.from(emoji.prompt_text).every((c) => c === "😀"),
    true,
  );

  // The same through the hook program: the body that is sent fits.
  const box = sandbox(t);
  const cap = await captureServer(t, box);
  const r = await runHook(box, UPS("\u0001".repeat(4000)), {
    event: "UserPromptSubmit",
  });
  quiet(r);
  assert.equal(cap.requests.length, 1);
  assert.ok(Buffer.byteLength(cap.requests[0].body) <= BODY_MAX);
  assert.equal(JSON.parse(cap.requests[0].body).prompt_truncated, true);

  // Only UserPromptSubmit gets the three fields; keys stay in LINE_KEYS.
  const newKeys = ["prompt_kind", "prompt_text", "prompt_truncated"];
  const inputs = hookInputs();
  for (const event of HOOK_EVENTS) {
    const input = { ...inputs[event], prompt: "сделай X" };
    const body = buildWriteBody(input, NOW_ISO, ON);
    assert.notEqual(body, null, event);
    for (const key of Object.keys(body)) {
      assert.ok(LINE_KEYS.includes(key), `${event}: ${key}`);
      if (newKeys.includes(key)) {
        assert.equal(event, "UserPromptSubmit", `${event}: ${key}`);
      }
    }
  }
});

test("HK-19: each of the five service markers (also after white space) gives prompt_kind service and no text anywhere in the journal; a marker in the middle stays owner", async (t) => {
  const srv = await startServer(t);
  const unique = [];
  for (const [i, marker] of SERVICE_MARKERS.entries()) {
    for (const lead of ["", "  \n\t"]) {
      const word = `уникальная-подстрока-${i}-${lead.length}-${Date.now()}`;
      unique.push(word);
      const r = await runHook(
        srv.box,
        UPS(`${lead}${marker} ${word} хвост`, `sess-svc-${i}`),
        { event: "UserPromptSubmit" },
      );
      quiet(r);
    }
  }
  const lines = srv.lines().map((l) => JSON.parse(l));
  assert.equal(lines.length, SERVICE_MARKERS.length * 2);
  for (const line of lines) {
    assert.equal(line.prompt_kind, "service");
    assert.equal(Object.hasOwn(line, "prompt_text"), false);
  }
  const file = fs.readFileSync(srv.eventsFile, "utf8");
  for (const word of unique) {
    assert.equal(file.split(word).length - 1, 0, `${word} is in the journal`);
  }
  const mid = buildWriteBody(UPS("сделай <system-reminder>"), NOW_ISO, ON);
  assert.equal(mid.prompt_kind, "owner");
  assert.equal(mid.prompt_text, "сделай <system-reminder>");
});

const QUIET_INPUTS = () => [
  UPS("сделай уникальная-подстрока-тихо-1"),
  UPS("<system-reminder> служебное уникальная-подстрока-тихо-2"),
  UPS(""),
];

test("HK-29: the server is not running; an owner message (storage on) and a service message - exit 0, quiet, journal not created", async (t) => {
  const box = sandbox(t);
  prepareState(box);
  fs.writeFileSync(path.join(box.dir, "port"), `${await deadPort()}\n`);
  for (const input of QUIET_INPUTS()) {
    const r = await runHook(box, input, { event: "UserPromptSubmit" });
    quiet(r);
    assert.ok(r.ms <= 3500, `took ${r.ms} ms`);
    assert.equal(sha256OrNone(path.join(box.dir, "events.jsonl")), "none");
  }
});

test("HK-30: the server accepts the connection and is silent; an owner message and a service message - exit 0, quiet, within 3500 ms", async (t) => {
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
  for (const input of QUIET_INPUTS()) {
    const r = await runHook(box, input, { event: "UserPromptSubmit" });
    quiet(r);
    assert.ok(r.ms <= 3500, `took ${r.ms} ms`);
    assert.equal(sha256OrNone(path.join(box.dir, "events.jsonl")), "none");
  }
});

test("HK-31: hook.sh run directly (no guard that discards output) prints nothing to stdout or stderr on owner and service messages", async (t) => {
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
  const inputs = QUIET_INPUTS();
  for (const input of inputs) {
    const r = await run(JSON.stringify(input));
    assert.equal(r.code, 0);
    assert.equal(r.out, "");
    assert.equal(r.err, "");
  }
  assert.equal(srv.lines().length, inputs.length);
});

test("HK-20: with the server stopped the message text is in no file of the temporary folder or the state directory, nor in stdout or stderr", async (t) => {
  const box = sandbox(t);
  prepareState(box);
  fs.writeFileSync(path.join(box.dir, "port"), `${await deadPort()}\n`);
  const needle = `уникальная-подстрока-${crypto.randomBytes(6).toString("hex")}`;
  const r = await runHook(box, UPS(`сделай ${needle} позже`), {
    event: "UserPromptSubmit",
  });
  quiet(r);
  assert.equal(r.stdout.includes(needle), false);
  assert.equal(r.stderr.includes(needle), false);
  for (const [file, text] of filesUnder(box.root)) {
    if (path.basename(file) === "events.jsonl") continue;
    assert.equal(text.includes(needle), false, file);
  }
  assert.equal(sha256OrNone(path.join(box.dir, "events.jsonl")), "none");
  // hook.sh itself prints nothing; the settings command only the mark (HK-13).
  const srv = await startServer(t);
  const direct = await runHook(srv.box, UPS(`<system-reminder> ${needle}`), {
    event: "UserPromptSubmit",
  });
  quiet(direct);
  assert.equal(direct.stderr.includes(needle), false);
});

test("HK-21: masking - every rule M1-M10 (exact result), the tables Q, E and N of design 3.1, the five forms of F1 and the six of F2; idempotent on every row and on 10000 seeded inputs", () => {
  const L = MASK_LABEL;
  assert.equal(L, "[скрыто]");
  for (const row of [...MASK_RULE_ROWS, ...MASK_ROWS]) {
    const out = maskSecrets(row.input);
    assert.equal(out, row.expected, row.id);
    for (const piece of row.leak) {
      assert.equal(out.includes(piece), false, `${row.id}: ${piece}`);
    }
    assert.equal(maskSecrets(out), out, `${row.id}: second pass`);
  }
  for (const input of MASK_KEEP_ROWS) {
    assert.equal(maskSecrets(input), input, input);
  }
  // M7: 127.0.0.1 (four parts) and panels.js (two) stay; the name with two
  // dots is masked (the consequence named in the design).
  assert.equal(maskSecrets("127.0.0.1 panels.js"), "127.0.0.1 panels.js");
  assert.equal(maskSecrets("тест a.test.js"), `тест ${L}`);
  // Not a string -> an empty string, never an exception.
  for (const v of [undefined, null, 5, {}, []]) {
    assert.equal(maskSecrets(v), "");
  }
  // Seeded generator: the parts of design 3.2.
  const parts = [
    "password",
    "DB_",
    "Bearer ",
    "sk-",
    "ghp_",
    "AKIA",
    '"',
    "'",
    "`",
    "\\",
    "=",
    ":",
    "_",
    "-",
    "/",
    ".",
    "\n",
    " ",
    MASK_LABEL,
    "token",
    "abcdefghij0123456789",
    "ZZZZEXAMPLE00001",
    "x",
  ];
  const next = rng(20261005);
  for (let n = 0; n < 10000; n += 1) {
    let text = "";
    const count = 1 + Math.floor(next() * 12);
    for (let i = 0; i < count; i += 1) {
      text += parts[Math.floor(next() * parts.length)];
    }
    const once = maskSecrets(text);
    assert.equal(maskSecrets(once), once, JSON.stringify(text));
  }
});

test("HK-22: the hook sends the text already masked - no secret value in the intercepted body", async (t) => {
  const box = sandbox(t);
  const cap = await captureServer(t, box);
  const value = "primer42secretvalue";
  const key = "sk-ant-abcdefghij1234567890";
  const r = await runHook(
    box,
    UPS(`вот password="${value}" и ключ ${key} и Bearer eyAbc123 готово`),
    { event: "UserPromptSubmit" },
  );
  quiet(r);
  assert.equal(cap.requests.length, 1);
  const body = cap.requests[0].body;
  for (const secret of [value, key, "eyAbc123"]) {
    assert.equal(body.includes(secret), false, secret);
  }
  const sent = JSON.parse(body);
  assert.equal(
    sent.prompt_text,
    `вот password=${MASK_LABEL} и ключ ${MASK_LABEL} и Bearer ${MASK_LABEL} готово`,
  );
});

test("HK-23: a secret at the border of 4000 characters (and of the scan limit) leaves no piece of 8 characters; a quoted value cut by the border is hidden to the end", () => {
  const filler = (n) => "слово ".repeat(Math.ceil(n / 6)).slice(0, n);
  const key = "sk-ant-abcdefghijklmnopqrstuvwxyz0123456789";
  for (const at of [3965, 3970, 3980, 3990, 3995, 3999]) {
    const body = buildWriteBody(UPS(`${filler(at)}${key} хвост`), NOW_ISO, ON);
    noPiece(body.prompt_text, key);
    assert.ok(Array.from(body.prompt_text).length <= PROMPT_MAX);
    // The key is one label (8 characters) before the cut.
    if (at >= 3993) assert.equal(body.prompt_truncated, true, `at ${at}`);
  }
  const quoted = "tango victor whisky 12345 november";
  for (const at of [3960, 3980, 3990, 3996]) {
    const text = `${filler(at)}password="${quoted} дальше конец"`;
    const body = buildWriteBody(UPS(text), NOW_ISO, ON);
    noPiece(body.prompt_text, quoted);
    assert.equal(/tango|victor|whisky/.test(body.prompt_text), false);
    if (at < 3990)
      assert.ok(body.prompt_text.includes("password="), `at ${at}`);
  }
  // The scan limit: the cut goes through the secret, the run is dropped.
  const raw = `${"слово ".repeat(16)}${key} хвост`;
  const cut = raw.indexOf(key) + 15;
  const prepared = prepareText(raw, cut, PROMPT_MAX);
  assert.equal(prepared.truncated, true);
  noPiece(prepared.text, key);
  assert.equal(prepared.text.includes("sk-ant"), false);
  // The real limit: a secret across 65536 units.
  const p2 = prepareText(
    `${" ".repeat(PROMPT_SCAN_MAX - 10)}${key}${key}`,
    PROMPT_SCAN_MAX,
    PROMPT_SCAN_MAX,
  );
  noPiece(p2.text, key);
  // Masking comes before the cut: a masked key is one label, never half of one.
  const near = prepareText(`${"а".repeat(3995)} ${key}`, PROMPT_SCAN_MAX, 4000);
  assert.equal(near.text.includes("sk-"), false);
  noPiece(near.text, key);
});

test("HK-24: the known uncovered cases (design 3.3) are NOT masked - a change of the rules shows here", () => {
  for (const input of MASK_RESIDUAL) {
    assert.equal(maskSecrets(input), input, input);
  }
  // Part after a quote inside a value without quotes: one piece stays.
  assert.equal(maskSecrets('password=ab"cd'), `password=${MASK_LABEL}"cd`);
  // A quoted value goes on the next line: only the first line is hidden.
  assert.equal(maskSecrets('password="ab\ncd"'), `password=${MASK_LABEL}\ncd"`);
  // Decision of ORCH (N3), named in the README: escaped quotes and two-character
  // assignment signs leave the value open (or half open).
  const L = MASK_LABEL;
  assert.equal(
    maskSecrets(String.raw`password=\"primer42\"`),
    String.raw`password=${L}"primer42\"`,
  );
  assert.equal(
    maskSecrets(String.raw`curl -d "{\"password\":\"primer42\"}"`),
    String.raw`curl -d "{\"password\":\"primer42\"}"`,
  );
  assert.equal(maskSecrets('password=>"primer42"'), `password=${L}"primer42"`);
  assert.equal(maskSecrets('PASSWORD:="primer42"'), `PASSWORD:${L}"primer42"`);
  // Typographic quotes are not quotes.
  assert.equal(
    maskSecrets("password=«primer 42»"),
    `password=${MASK_LABEL} 42»`,
  );
});

test("HK-25: storage off at the hook (absent, empty, 0 or any other value but 1, ISS-0122) - prompt_kind stays, no text; on for 1 only", async (t) => {
  const srv = await startServer(t);
  const word = "уникальная-подстрока-хранение";
  const cases = [
    ["0", false],
    ["yes", false],
    ["true", false],
    ["", false],
    [undefined, false],
    ["1", true],
  ];
  for (const [value] of cases) {
    const r = await runHook(srv.box, UPS(`сделай ${word}`, `s-${value}`), {
      event: "UserPromptSubmit",
      envExtra: { SAI_PIXEL_OFFICE_STORE_TEXT: value },
    });
    quiet(r);
  }
  const lines = srv.lines().map((l) => JSON.parse(l));
  assert.equal(lines.length, cases.length);
  for (const [i, [value, stored]] of cases.entries()) {
    assert.equal(lines[i].prompt_kind, "owner", `value ${value}`);
    assert.equal(Object.hasOwn(lines[i], "prompt_text"), stored, value);
    assert.equal(
      lines[i].prompt_text === `сделай ${word}`,
      stored,
      `value ${value}`,
    );
  }
  assert.equal(
    buildWriteBody(UPS("сделай X"), NOW_ISO).prompt_text,
    undefined,
    "no option: storage off",
  );
  assert.equal(
    buildWriteBody(UPS("сделай X"), NOW_ISO, { storeText: false }).prompt_kind,
    "owner",
  );
});

test("HK-26: 5 MB of text, 5 MB of one character and pathological strings - each within 2 s, exit 0, quiet; the line has masked text of at most 4000 or none", async (t) => {
  const srv = await startServer(t);
  const secret = "primer42zz";
  const inputs = [
    "слово и дело ".repeat(Math.ceil(5e6 / 13)),
    "a".repeat(5e6),
    "_".repeat(5e6),
    `password="${"x ".repeat(2.5e6)}`,
    `token=${secret} ${"-sk-".repeat(1.2e6)}`,
    `${'Bearer "'.repeat(5e5)}`,
  ];
  for (const [i, prompt] of inputs.entries()) {
    const r = await runHook(srv.box, UPS(prompt, `s-big-${i}`), {
      event: "UserPromptSubmit",
    });
    quiet(r);
    assert.ok(r.ms <= 2000, `input ${i} took ${r.ms} ms`);
  }
  const lines = srv.lines().map((l) => JSON.parse(l));
  // Input 0 is about 9.5 MB in bytes (Cyrillic): over the hook input limit,
  // so the hook sends nothing for it. Every other input gives one line.
  assert.ok(Buffer.byteLength(inputs[0]) > HOOK_INPUT_MAX);
  assert.deepEqual(
    lines.map((l) => l.session_id),
    [1, 2, 3, 4, 5].map((n) => `s-big-${n}`),
  );
  // One long unbroken token (inputs 1 and 2) is not scanned: the line has no
  // text at all, never an unmasked one. The others have masked text of at
  // most PROMPT_MAX characters.
  const withoutText = new Set(["s-big-1", "s-big-2"]);
  for (const line of lines) {
    const i = line.session_id;
    assert.equal(line.hook_event_name, "UserPromptSubmit", i);
    assert.equal(line.prompt_kind, "owner", i);
    assert.equal(typeof line.time, "string", i);
    if (withoutText.has(i)) {
      assert.equal("prompt_text" in line, false, i);
      assert.equal("prompt_truncated" in line, false, i);
      continue;
    }
    assert.equal(typeof line.prompt_text, "string", i);
    assert.ok(Array.from(line.prompt_text).length <= PROMPT_MAX, i);
    assert.equal(line.prompt_text.includes(secret), false, i);
    assert.equal(line.prompt_truncated, true, i);
  }
  const fifth = lines.find((l) => l.session_id === "s-big-4");
  assert.ok(fifth.prompt_text.startsWith(`token=${MASK_LABEL}`));
});

test("HK-27: maskSecrets on 64 KB of hostile text takes at most 200 ms each (linear time); a 16 times longer input does not take 200 times longer", () => {
  const rep = (unit, size = 65536) =>
    unit.repeat(Math.ceil(size / unit.length));
  const hostile = {
    underscore: rep("_"),
    a_: rep("a_"),
    _password: rep("_password"),
    'password="': rep('password="'),
    '"password"': rep('"password"'),
    'Bearer "': rep('Bearer "'),
    backslash: rep("\\"),
    "-sk-": rep("-sk-"),
    "short -sk-": rep("-sk- "),
    "=ghp_": rep("=ghp_"),
    "=AKIA": rep("=AKIA"),
    equals: rep("="),
    "open quote": rep('x="'),
    BEGIN: rep("-----BEGIN "),
    dots: rep("a.b."),
    slashes: rep("a/"),
    "token=": rep("token="),
    "://": rep("a://b:"),
  };
  const time = (text) => {
    const t0 = performance.now();
    maskSecrets(text);
    return performance.now() - t0;
  };
  maskSecrets("warm up password=x");
  for (const [name, text] of Object.entries(hostile)) {
    const ms = time(text);
    assert.ok(ms <= 200, `${name}: ${ms.toFixed(1)} ms`);
  }
  // Linear growth: 4 times the input is nowhere near 16 times the time.
  for (const name of ["underscore", "_password", 'password="']) {
    const unit = hostile[name].slice(0, 16);
    const small = Math.max(time(rep(unit, 16384)), 0.5);
    const large = time(rep(unit, 65536));
    assert.ok(large <= small * 12 + 20, `${name}: ${small} -> ${large}`);
  }
});

test("HK-28: with proxy variables in the environment the signed body still goes to 127.0.0.1 - the fake proxy gets no connection", async (t) => {
  const box = sandbox(t);
  const cap = await captureServer(t, box);
  let connections = 0;
  const proxy = net.createServer((s) => {
    connections += 1;
    s.destroy();
  });
  await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
  t.after(() => proxy.close());
  const url = `http://127.0.0.1:${proxy.address().port}`;
  for (const extra of [
    { NODE_USE_ENV_PROXY: "1", HTTP_PROXY: url, http_proxy: url },
    { NODE_OPTIONS: "--use-env-proxy", HTTP_PROXY: url, http_proxy: url },
  ]) {
    const r = await runHook(box, UPS("сделай X"), {
      event: "UserPromptSubmit",
      envExtra: extra,
    });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
  }
  assert.equal(cap.requests.length, 2, "both bodies reached the server");
  assert.equal(connections, 0, "the proxy got a connection");
  assert.equal(JSON.parse(cap.requests[0].body).prompt_text, "сделай X");
});

// ===================================================================
// REQ-036 criterion 6, design REQ-036-044-045 3.13 (D14): the description and
// the roles are masked in the hook and on the server, the identifiers are not.
// The secrets below are invented.
// ===================================================================
import { validateWriteBody } from "../src/pixel-office/protocol.js";

// Invented secrets, put together at run time (not a key in the text).
const MK_KEY = ["sk", "ant", "MK01fakeKEY0123456789abcdefXYZ"].join("-");
const MK_PASS = ["mk01", "pass", "VALUE42zz"].join("");
// No piece of 8 characters of a secret is in the text.
function leaks(text, secret) {
  for (let i = 0; i + 8 <= secret.length; i++) {
    if (text.includes(secret.slice(i, i + 8))) return secret.slice(i, i + 8);
  }
  return null;
}
const MK_TIME = "2026-10-05T12:00:00.000Z";
const ID40 = (seed) => {
  const r = rng(seed);
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 40; i++) s += abc[Math.floor(r() * abc.length)];
  return s;
};
const postInput = (o = {}) => ({
  session_id: "mk-session",
  hook_event_name: "PostToolUse",
  tool_name: "Agent",
  tool_use_id: o.toolUseId ?? "toolu_mk",
  ...(o.agentId === undefined
    ? {}
    : { agent_id: o.agentId, agent_type: o.agentType }),
  tool_input: { subagent_type: o.role ?? "Plan", description: o.description },
  tool_response: { agentId: o.launched ?? "agent-mk" },
});

test("MK-01: the hook masks the description, subagent_type and agent_type of a handoff and agent_type of a start; the identifiers of 40 letters and digits stay as they were", () => {
  const ids = { agentId: ID40(1), toolUseId: ID40(2), launched: ID40(3) };
  const body = buildWriteBody(
    postInput({
      ...ids,
      agentType: `Explore ${MK_KEY}`,
      role: `Plan ${MK_KEY}`,
      description: `ключ ${MK_KEY} password="${MK_PASS}"`,
    }),
    MK_TIME,
    { storeText: true },
  );
  assert.ok(body !== null);
  for (const field of ["description", "subagent_type", "agent_type"]) {
    assert.ok(body[field].includes(MASK_LABEL), `${field}: ${body[field]}`);
  }
  assert.equal(body.subagent_type, `Plan ${MASK_LABEL}`);
  assert.equal(body.agent_type, `Explore ${MASK_LABEL}`);
  assert.equal(leaks(JSON.stringify(body), MK_KEY), null);
  assert.equal(leaks(JSON.stringify(body), MK_PASS), null);
  assert.equal(body.agent_id, ids.agentId);
  assert.equal(body.tool_use_id, ids.toolUseId);
  assert.equal(body.launched_agent_id, ids.launched);
  // the start of an agent with a role that holds a secret
  const start = buildWriteBody(
    {
      session_id: "mk-session",
      hook_event_name: "SubagentStart",
      agent_id: ids.launched,
      agent_type: `Plan ${MK_KEY}`,
    },
    MK_TIME,
  );
  assert.equal(start.agent_type, `Plan ${MASK_LABEL}`);
  assert.equal(start.agent_id, ids.launched);
  // a role without a secret is not touched
  const plain = buildWriteBody(
    postInput({
      role: "Sai Security Reviewer (SECURITY-REVIEWER)",
      description: "проверка входа",
    }),
    MK_TIME,
  );
  assert.equal(
    plain.subagent_type,
    "Sai Security Reviewer (SECURITY-REVIEWER)",
  );
  assert.equal(plain.description, "проверка входа");
});

test("MK-03: mask first, then cut - a description of 98 characters ending in password=ab is 100 and the event is kept; a role of 127 characters (with spaces) ending in password=ab is 128; a key at the 95th character of a description of 150 leaves no piece of itself; 100 characters without a secret are as they were", () => {
  const d98 = `${"а".repeat(87)}password=ab`;
  assert.equal(Array.from(d98).length, 98);
  let body = buildWriteBody(postInput({ description: d98 }), MK_TIME);
  assert.ok(body !== null, "the event is not dropped");
  assert.equal(Array.from(body.description).length, 100);
  assert.ok(body.description.startsWith(`${"а".repeat(87)}password=[`));
  assert.equal(body.description.includes("password=ab"), false);
  // a role with spaces (a role of one long word is hidden whole by rule M10)
  const role = `${"Роль с пробелами ".repeat(8).slice(0, 116)}password=ab`;
  assert.equal(Array.from(role).length, 127);
  body = buildWriteBody(postInput({ role, description: "x" }), MK_TIME);
  assert.ok(body !== null, "the event is not dropped");
  assert.equal(Array.from(body.subagent_type).length, 128);
  assert.ok(body.subagent_type.startsWith(role.slice(0, 116)));
  assert.equal(body.subagent_type.includes("password=ab"), false);
  // the key across the border of 100: masked before the cut
  const head = "слово ".repeat(16).slice(0, 94);
  const d150 = `${head} ${MK_KEY} ${"еще ".repeat(20)}`.slice(0, 150);
  assert.equal(d150.indexOf(MK_KEY), 95);
  assert.equal(Array.from(d150).length, 150);
  body = buildWriteBody(postInput({ description: d150 }), MK_TIME);
  assert.equal(Array.from(body.description).length, 100);
  assert.equal(leaks(body.description, MK_KEY), null);
  assert.equal(body.description.includes("sk-"), false);
  // 100 characters without a secret: unchanged (as HK-05)
  const hundred = "ж".repeat(100);
  assert.equal(
    buildWriteBody(postInput({ description: hundred }), MK_TIME).description,
    hundred,
  );
  // the server does the same with what came around the hook
  const raw = {
    time: MK_TIME,
    hook_event_name: "PostToolUse",
    session_id: "mk-session",
    tool_use_id: "toolu_mk",
    launched_agent_id: "agent-mk",
    subagent_type: role,
    description: d98,
  };
  const line = validateWriteBody(raw, Date.parse(MK_TIME));
  assert.equal(line.ok, true, line.reason);
  assert.equal(Array.from(line.line.description).length, 100);
  assert.equal(Array.from(line.line.subagent_type).length, 128);
});

test("MK-05: identifiers are never masked - a long random agent_id (40 letters of both cases and digits) of SubagentStart, SubagentStop and launched_agent_id of PostToolUse equal the original after the hook and after the server", async (t) => {
  const id = ID40(5);
  assert.match(id, /^[A-Za-z0-9]{40}$/);
  assert.equal(maskSecrets(id), MASK_LABEL, "rule M10 would hide it as a text");
  const srv = await startServer(t);
  const inputs = [
    [
      "SubagentStart",
      {
        session_id: "mk-session",
        hook_event_name: "SubagentStart",
        agent_id: id,
        agent_type: "Plan",
      },
    ],
    [
      "PostToolUse",
      postInput({ launched: id, toolUseId: ID40(6), description: "дело" }),
    ],
    [
      "SubagentStop",
      {
        session_id: "mk-session",
        hook_event_name: "SubagentStop",
        agent_id: id,
        agent_type: "Plan",
      },
    ],
  ];
  for (const [event, input] of inputs) {
    const body = buildWriteBody(input, MK_TIME);
    const own =
      event === "PostToolUse" ? body.launched_agent_id : body.agent_id;
    assert.equal(own, id, `${event}: the hook`);
    const line = validateWriteBody(body, Date.parse(MK_TIME)).line;
    assert.equal(
      event === "PostToolUse" ? line.launched_agent_id : line.agent_id,
      id,
      `${event}: the server`,
    );
    const r = await runHook(srv.box, input, { event });
    assert.equal(r.code, 0, r.stderr);
  }
  const lines = srv.lines().map((l) => JSON.parse(l));
  assert.equal(lines.length, 3);
  assert.deepEqual(
    lines.map((l) =>
      l.hook_event_name === "PostToolUse" ? l.launched_agent_id : l.agent_id,
    ),
    [id, id, id],
  );
});

// ---- REQ-110: hook.sh takes only a Node at or above the floor (HK-32 ... HK-40) ----------
//
// Candidates are stub nodes written by the test: shell scripts that use only built-in
// commands, with mode 755. `--version` prints a fixed text and ends with a fixed code
// (optionally after reading all of stdin, or after writing a line to stderr); any other
// start appends `start <args>` and the lines of its stdin to the stub's own record file.
// PATH and SAI_NODE_FALLBACKS name only stub folders and an empty folder, so no real
// node is reachable, and hook.sh is run directly as `/bin/sh <hook.sh>` (the command of
// settings.json hides the script's own output). The state, HOME and every record are in
// the test's own temporary folder.

const HOOK_SH = path.join(SRC, "hook.sh");
const HOOK_DELIMITER = process.platform === "win32" ? ";" : ":";

// A path as a POSIX shell reads it (the identity where the hook runs: Linux and macOS).
function posix(p) {
  if (process.platform !== "win32") return p;
  return p.replace(/^([A-Za-z]):/u, "/$1").replaceAll("\\", "/");
}

function singleQuoted(text) {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function writeStub(dir, spec, record) {
  fs.mkdirSync(dir, { recursive: true });
  const lines = ["#!/bin/sh", 'if [ "$1" = "--version" ]; then'];
  if (spec.readsStdin)
    lines.push('  while IFS= read -r l || [ -n "$l" ]; do l=; done');
  if (spec.noise) lines.push('  echo "stub noise" >&2');
  lines.push(`  printf '%s\\n' ${singleQuoted(spec.version)}`);
  lines.push(`  exit ${spec.exit ?? 0}`, "fi");
  lines.push(
    `{ printf 'start %s\\n' "$*"; while IFS= read -r l || [ -n "$l" ]; do printf 'in %s\\n' "$l"; l=; done; } >> ${singleQuoted(posix(record))}`,
  );
  const file = path.join(dir, "node");
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  fs.chmodSync(file, 0o755);
  return file;
}

function hookWorld(t) {
  const box = sandbox(t);
  fs.mkdirSync(box.dir);
  const empty = path.join(box.root, "empty");
  fs.mkdirSync(empty);
  const cwd = path.join(box.root, "cwd");
  fs.mkdirSync(cwd);
  let n = 0;
  const stub = (spec, folder) => {
    n += 1;
    const dir = path.join(box.root, folder ?? `stub-${n}`);
    const record = path.join(box.root, `record-${n}.txt`);
    return { dir, node: writeStub(dir, spec, record), record };
  };
  return { box, empty, cwd, stub };
}

function dirListing(dir) {
  return fs
    .readdirSync(dir)
    .sort()
    .map(
      (name) =>
        `${name} ${crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(dir, name)))
          .digest("hex")}`,
    )
    .join("\n");
}

// The starts of hook.js that a stub recorded: a start whose last argument ends with /hook.js.
function hookStarts(stub) {
  if (!fs.existsSync(stub.record)) return [];
  return fs
    .readFileSync(stub.record, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("start ") && l.endsWith("/hook.js"));
}

function runHookSh(world, o = {}) {
  const { box, empty, cwd } = world;
  const { pathStubs = [], fallbackDirs = [], input = "{}\n" } = o;
  const env = {
    PATH: [...pathStubs.map((s) => s.dir), empty].join(HOOK_DELIMITER),
    HOME: box.home,
    SAI_PIXEL_OFFICE_DIR: box.dir,
    SAI_NODE_FALLBACKS: [...fallbackDirs, empty].map(posix).join(":"),
  };
  assertSafeEnv(env);
  const script = o.script ?? HOOK_SH;
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn("/bin/sh", [posix(script)], {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.stdin.on("error", () => {});
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, ms: performance.now() - t0 });
    });
    child.stdin.end(input);
  });
}

// One row: the stubs are made and the hook runs; the stubs it started are compared with
// `starter` ("np", "path", "fb" or null), and the common rules of every row hold: exit
// code 0, stdout and stderr empty, at most 2 s, the state folder unchanged.
async function hookRow(t, label, o, starter) {
  const w = hookWorld(t);
  const stubs = {};
  if (o.np !== undefined) stubs.np = w.stub(o.np, o.npFolder);
  if (o.path !== undefined) stubs.path = w.stub(o.path, o.pathFolder);
  if (o.fb !== undefined) stubs.fb = w.stub(o.fb, o.fbFolder);
  if (stubs.np !== undefined)
    fs.writeFileSync(
      path.join(w.box.dir, "node-path"),
      `${posix(stubs.np.node)}\n`,
    );
  const before = dirListing(w.box.dir);
  const r = await runHookSh(w, {
    pathStubs: stubs.path === undefined ? [] : [stubs.path],
    fallbackDirs: stubs.fb === undefined ? [] : [stubs.fb.dir],
    input: o.input,
    script: o.script,
  });
  assert.equal(r.code, 0, `${label}: exit code ${r.code}`);
  assert.equal(r.stdout, "", `${label}: stdout`);
  assert.equal(r.stderr, "", `${label}: stderr`);
  assert.ok(r.ms <= 2000, `${label}: took ${r.ms} ms`);
  assert.equal(
    dirListing(w.box.dir),
    before,
    `${label}: the state folder changed`,
  );
  const started = Object.keys(stubs).filter(
    (k) => hookStarts(stubs[k]).length > 0,
  );
  assert.deepEqual(
    started,
    starter === null ? [] : [starter],
    `${label}: started`,
  );
  return { w, stubs, r };
}

const V_FLOOR = "v22.23.4";

test("HK-32: a candidate below the floor, alone, is not started - node-path, PATH and fallbacks (REQ-110 criterion 4 a)", async (t) => {
  for (const v of ["v22.21.1", "v22.23.3", "v21.7.0", "v25.2.1"])
    await hookRow(t, `node-path ${v}`, { np: { version: v } }, null);
  for (const v of ["v22.21.1", "v22.23.3"])
    await hookRow(t, `PATH ${v}`, { path: { version: v } }, null);
  await hookRow(t, "fallback v22.21.1", { fb: { version: "v22.21.1" } }, null);
});

test("HK-33: a candidate at the floor starts; a refused node-path falls through to PATH, a refused PATH to the fallbacks; the order is node-path, PATH, fallbacks (criterion 4 b)", async (t) => {
  await hookRow(t, "PATH at the floor", { path: { version: V_FLOOR } }, "path");
  await hookRow(
    t,
    "node-path below, PATH at the floor",
    { np: { version: "v22.21.1" }, path: { version: V_FLOOR } },
    "path",
  );
  await hookRow(
    t,
    "PATH another major, fallback at the floor",
    { path: { version: "v25.2.1" }, fb: { version: V_FLOOR } },
    "fb",
  );
  await hookRow(
    t,
    "node-path at the floor wins over PATH at the floor",
    { np: { version: V_FLOOR }, path: { version: V_FLOOR } },
    "np",
  );
  await hookRow(
    t,
    "PATH at the floor wins over a fallback at the floor",
    { path: { version: V_FLOOR }, fb: { version: V_FLOOR } },
    "path",
  );
});

test("HK-34: a candidate whose --version ends with a code other than 0 is skipped, although its text is right (criterion 4 c)", async (t) => {
  await hookRow(
    t,
    "PATH exit 1",
    { path: { version: V_FLOOR, exit: 1 } },
    null,
  );
  await hookRow(
    t,
    "node-path exit 1, PATH at the floor",
    { np: { version: V_FLOOR, exit: 1 }, path: { version: V_FLOOR } },
    "path",
  );
  await hookRow(
    t,
    "fallback exit 3",
    { fb: { version: V_FLOOR, exit: 3 } },
    null,
  );
});

test("HK-35: the version rule of the hook - every refused text of the rule table is not started, every accepted one is", async (t) => {
  const refused = [
    "21.7.0",
    "23.0.0",
    "24.11.0",
    "25.2.1",
    "23.24.0",
    "24.23.4",
    "23.23.4",
    "21.24.0",
    "21.23.4",
    "22.0.0",
    "22.3.0",
    "22.21.1",
    "22.22.0",
    "22.23.0",
    "22.23.3",
    "22.23",
    "22.23.4.1",
    "22.23.x",
    "22.24.0-pre",
    "x",
    "",
    "022.23.4",
    "22.023.4",
    "22.23.04",
    "2222222222.0.0",
    "22.1000000000.0",
    "22.23.1000000000",
  ];
  for (const text of refused)
    await hookRow(t, `v${text}`, { path: { version: `v${text}` } }, null);
  const raw = [
    "22.23.4",
    "V22.23.4",
    "v22.23.4 ",
    "v22.23.4\nv22.23.4",
    "vv22.23.4",
    "v+22.23.4",
    "v22.-23.4",
  ];
  for (const text of raw)
    await hookRow(t, JSON.stringify(text), { path: { version: text } }, null);
  const accepted = [
    "22.23.4",
    "22.23.10",
    "22.24.0",
    "22.100.0",
    "22.999999999.0",
    "22.23.999999999",
  ];
  for (const text of accepted)
    await hookRow(t, `v${text}`, { path: { version: `v${text}` } }, "path");
});

test("HK-36: a candidate's --version that reads all of stdin does not take the event - the candidate that runs hook.js gets it whole (Q10, R2)", async (t) => {
  const input =
    'line one\nline two with $(x) and `y` "q"\nlast line without a line end';
  const { stubs } = await hookRow(
    t,
    "event after a stdin-reading --version",
    {
      np: { version: "v22.21.1", readsStdin: true },
      path: { version: V_FLOOR },
      input,
    },
    "path",
  );
  const record = fs
    .readFileSync(stubs.path.record, "utf8")
    .split("\n")
    .filter((l) => l !== "");
  assert.deepEqual(record.slice(1), [
    "in line one",
    'in line two with $(x) and `y` "q"',
    "in last line without a line end",
  ]);
});

test("HK-37: the line node_floor= is what the rule uses - a copy of hook.sh with the floor raised by one patch skips the old floor and takes the raised one", async (t) => {
  const text = fs.readFileSync(HOOK_SH, "utf8");
  const lines = text.split("\n").filter((l) => l.startsWith("node_floor="));
  assert.equal(lines.length, 1, "exactly one node_floor= line");
  const m = /^node_floor=(\d+)\.(\d+)\.(\d+)$/u.exec(lines[0]);
  assert.notEqual(m, null, lines[0]);
  const old = `v${m[1]}.${m[2]}.${m[3]}`;
  const raised = `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
  const holder = hookWorld(t);
  const same = path.join(holder.box.root, "hook-same.sh");
  const up = path.join(holder.box.root, "hook-up.sh");
  fs.writeFileSync(same, text);
  fs.writeFileSync(
    up,
    text.replace(lines[0], `node_floor=${m[1]}.${m[2]}.${Number(m[3]) + 1}`),
  );
  // the copy with the same line works: the control of the mechanism
  await hookRow(
    t,
    "copy, same floor, stub at it",
    { path: { version: old }, script: same },
    "path",
  );
  await hookRow(
    t,
    "raised floor, stub at the old floor",
    { path: { version: old }, script: up },
    null,
  );
  await hookRow(
    t,
    "raised floor, stub at the raised floor",
    { path: { version: raised }, script: up },
    "path",
  );
});

test("HK-38: a --version text with shell signs is only text - refused, and nothing it names is created or run", async (t) => {
  let n = 0;
  for (const tail of [
    ";touch @F",
    "$(touch @F)",
    "`touch @F`",
    "|touch @F",
    " && touch @F",
    "\ntouch @F",
  ]) {
    n += 1;
    const w = hookWorld(t);
    const target = path.join(w.box.root, `pwned-${n}`);
    const version = `${V_FLOOR}${tail.replaceAll("@F", posix(target))}`;
    const label = JSON.stringify(tail);
    const stub = w.stub({ version });
    fs.writeFileSync(
      path.join(w.box.dir, "node-path"),
      `${posix(stub.node)}\n`,
    );
    const before = dirListing(w.box.dir);
    const r = await runHookSh(w, { pathStubs: [stub] });
    assert.equal(r.code, 0, label);
    assert.equal(r.stdout, "", label);
    assert.equal(r.stderr, "", label);
    assert.equal(fs.existsSync(target), false, `${label}: the text was run`);
    assert.deepEqual(hookStarts(stub), [], `${label}: started`);
    assert.equal(dirListing(w.box.dir), before, label);
  }
});

test("HK-39: a candidate in a folder whose name has a space, a quote, $() and a backtick is taken from node-path, PATH and the fallbacks, and the name is not run", async (t) => {
  const folder = "sp ace 'q' $(touch pwned-a) `touch pwned-b`";
  for (const where of ["np", "path", "fb"]) {
    const o = { [where]: { version: V_FLOOR }, [`${where}Folder`]: folder };
    const { w } = await hookRow(t, `a spaced folder as ${where}`, o, where);
    for (const name of ["pwned-a", "pwned-b"])
      assert.equal(
        fs.existsSync(path.join(w.cwd, name)),
        false,
        `${where}: ${name} was made`,
      );
  }
});

test("HK-40: what a candidate writes to stderr is not shown - a skipped one and a taken one leave the hook's stderr empty", async (t) => {
  await hookRow(
    t,
    "a noisy node-path that fails, a noisy PATH at the floor",
    {
      np: { version: V_FLOOR, exit: 1, noise: true },
      path: { version: V_FLOOR, noise: true },
    },
    "path",
  );
  await hookRow(
    t,
    "a noisy PATH below the floor",
    { path: { version: "v22.21.1", noise: true } },
    null,
  );
});
