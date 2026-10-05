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

test("HK-25: storage off at the hook (0 or any other value but empty or 1) - prompt_kind stays, no text; on for absent, empty and 1", async (t) => {
  const srv = await startServer(t);
  const word = "уникальная-подстрока-хранение";
  const cases = [
    ["0", false],
    ["yes", false],
    ["true", false],
    ["", true],
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
