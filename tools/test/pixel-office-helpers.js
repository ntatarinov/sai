// Shared helpers of the Pixel Office tests (design 10.1). This file is not a
// test: its name has no ".test.js", so `node --test "test/**/*.test.js"` does
// not run it. Every helper works in temporary directories; nothing here
// touches ~/.sai-pixel-office, the real HOME or port 4780.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "../src/pixel-office/server.js";
import { signBody, SIGNATURE_HEADER } from "../src/pixel-office/protocol.js";
import { ensureSecret, ensureStateDir } from "../src/pixel-office/state-dir.js";
import { createApp } from "../src/pixel-office/public/app.js";

export const TOOLS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const ROOT = path.resolve(TOOLS, "..");
export const SRC = path.join(TOOLS, "src", "pixel-office");
export const PUBLIC = path.join(SRC, "public");
export const SETTINGS = path.join(ROOT, ".claude", "settings.json");
export const MAIN_JS = path.join(SRC, "main.js");
export const REPORT_JS = path.join(PUBLIC, "office-report.js");

// ------------------------------------------------------------------- time

// Fixed moments: the tests never read the real clock where the design says to
// substitute it (10.1).
export const T0 = Date.parse("2026-09-20T10:00:00.000Z");
// Half an hour after T0: inside the staleness threshold with a margin (REQ-042
// design 14.3). T0 + STALE_AFTER_MS would sit exactly on the threshold, and a
// test that moves the page clock would silently cross it. The border itself is
// tested by FS-05 with its own numbers.
export const NOW = T0 + 1800 * 1000;

export function iso(ms) {
  return new Date(ms).toISOString();
}

export function at(sec) {
  return iso(T0 + sec * 1000);
}

// A small seeded generator: random journals are always the same.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lets every pending promise chain run; there are no real timers in the page
// tests, so this is all the waiting there is.
export async function settle(turns = 300) {
  for (let i = 0; i < turns; i++) await Promise.resolve();
}

// ------------------------------------------------------- temporary folders

const REAL_TMP = fs.realpathSync(os.tmpdir());

// A folder with its own HOME and its own state directory path (not created).
export function sandbox(t) {
  const root = fs.mkdtempSync(path.join(REAL_TMP, "po-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  fs.mkdirSync(home);
  return { root, home, dir: path.join(root, "state") };
}

export function isInsideTmp(p) {
  return (
    typeof p === "string" && path.resolve(p).startsWith(REAL_TMP + path.sep)
  );
}

// The environment of every process the tests start: HOME and the state
// directory are in a temporary folder (design 10.1, HK-17; R2).
export function childEnv(box, extra = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: box.home,
    SAI_PIXEL_OFFICE_DIR: box.dir,
    ...extra,
  };
  assertSafeEnv(env);
  return env;
}

// The tests never use the default port 4780: every start of main.js has to
// carry --port with 0 (or with a value that cannot be a port, which only
// tests of wrong arguments use); anything else fails before a process starts.
export function assertSafeArgs(args, allowPorts = []) {
  let found = false;
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    let value = null;
    if (a === "--port")
      value = args[i + 1] === undefined ? "" : String(args[i + 1]);
    else if (a.startsWith("--port=")) value = a.slice(7);
    if (value === null) continue;
    found = true;
    const unusable = !/^\d+$/.test(value) || Number(value) > 65535;
    assert.notEqual(value, "4780", "port 4780 is never used by the tests");
    assert.ok(
      value === "0" || unusable || allowPorts.map(String).includes(value),
      `unsafe port argument: ${value}`,
    );
  }
  assert.ok(found, "--port is required: the default port 4780 is not used");
}

export function assertSafeEnv(env) {
  assert.ok(isInsideTmp(env.HOME), "HOME of a child is not temporary");
  if (env.SAI_PIXEL_OFFICE_DIR !== undefined) {
    assert.ok(
      isInsideTmp(env.SAI_PIXEL_OFFICE_DIR),
      "state directory of a child is not temporary",
    );
  }
}

// State directory with the secret, as `main.js` makes it.
export function prepareState(box) {
  ensureStateDir(box.dir);
  return ensureSecret(box.dir);
}

export function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

export function sha256OrNone(file) {
  return fs.existsSync(file) ? sha256File(file) : "none";
}

// ------------------------------------------------------ journal constructors

// Lines of the journal with an explicit time, built by constructors. `sec` is
// the moment of the next line; every line adds one second unless `time` moves it.
export function journal() {
  const entries = [];
  let sec = 0;
  const j = {
    entries,
    time(s) {
      sec = s;
      return j;
    },
    now() {
      return sec;
    },
    add(kind, session, extra = {}) {
      sec += 1;
      entries.push({
        time: at(sec),
        source: "REAL",
        hook_event_name: kind,
        session_id: session,
        ...extra,
      });
      return entries.length - 1;
    },
    sessionStart: (s, extra) => j.add("SessionStart", s, extra),
    sessionEnd: (s, extra) => j.add("SessionEnd", s, extra),
    prompt: (s, extra) => j.add("UserPromptSubmit", s, extra),
    stop: (s, extra) => j.add("Stop", s, extra),
    subStart: (s, id, type, extra = {}) =>
      j.add("SubagentStart", s, {
        agent_id: id,
        ...(type === undefined ? {} : { agent_type: type }),
        ...extra,
      }),
    subStop: (s, id, type, extra = {}) =>
      j.add("SubagentStop", s, {
        agent_id: id,
        ...(type === undefined ? {} : { agent_type: type }),
        ...extra,
      }),
    // The linking PostToolUse of an Agent call: launched is the agent_id of
    // the started subagent. by: the launcher inside a subagent.
    post(s, toolUseId, launched, o = {}) {
      const extra = { tool_use_id: toolUseId, launched_agent_id: launched };
      if (o.subagentType !== undefined) extra.subagent_type = o.subagentType;
      if (o.description !== undefined) extra.description = o.description;
      if (o.byId !== undefined) extra.agent_id = o.byId;
      if (o.byType !== undefined) extra.agent_type = o.byType;
      return j.add("PostToolUse", s, extra);
    },
    raw(entry) {
      entries.push(entry);
      return entries.length - 1;
    },
    // REQ-008: an owner message with its stored text (kind A), a service
    // message, and a record of the orchestrator (kind B, no hook_event_name).
    ownerPrompt(s, text, extra = {}) {
      const fields = { prompt_kind: "owner", ...extra };
      if (text !== undefined && text !== null) fields.prompt_text = text;
      return j.add("UserPromptSubmit", s, fields);
    },
    servicePrompt: (s, extra = {}) =>
      j.add("UserPromptSubmit", s, { prompt_kind: "service", ...extra }),
    note(fields = {}) {
      sec += 1;
      entries.push(noteEntry(at(sec), fields));
      return entries.length - 1;
    },
  };
  return j;
}

// A record of the orchestrator as it stands in the journal (REQ-008 2.1,
// kind B): fields = {note_text, session_id, req_id, request_time,
// request_time_auto}; note_text defaults to a fixed text.
export function noteEntry(isoTime, fields = {}) {
  return {
    time: isoTime,
    source: "ORCH",
    note_text: "как понял: пример",
    ...fields,
  };
}

// A line of a write request (no source) or of a journal.
export function writeBody(kind, session, isoTime, extra = {}) {
  return {
    time: isoTime,
    hook_event_name: kind,
    session_id: session,
    ...extra,
  };
}

export function entryOf(kind, session, isoTime, extra = {}) {
  return { ...writeBody(kind, session, isoTime, extra), source: "REAL" };
}

// Real names of the roles: the "name" field of .claude/agents/*.md and the
// three built-in types (design 10.1, K).
export const BUILTIN_TYPES = ["general-purpose", "Explore", "Plan"];

export function agentFiles() {
  const dir = path.join(ROOT, ".claude", "agents");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

export function agentNames() {
  const dir = path.join(ROOT, ".claude", "agents");
  const names = [];
  for (const file of agentFiles()) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const m = /^name:\s*(.+?)\s*$/m.exec(text);
    assert.ok(m, `no name in ${file}`);
    names.push(m[1].replace(/^["']|["']$/g, ""));
  }
  return names;
}

export function roleNames(n) {
  const base = [...agentNames(), ...BUILTIN_TYPES];
  const out = base.slice(0, n);
  for (let i = out.length; i < n; i++) {
    const num = String(i).padStart(4, "0");
    out.push(`Demo Role ${num} (DEMO-${num})`);
  }
  return out;
}

// Main session S0 and, for each of the N roles, one subagent started by the
// main session and (stopped: true) finished.
export function rolesJournal(n, { stopped = false, session = "S0" } = {}) {
  const j = journal();
  j.sessionStart(session);
  j.prompt(session);
  roleNames(n).forEach((role, i) => {
    const id = `agent-${i}`;
    j.post(session, `tu-${i}`, id, {
      subagentType: role,
      description: `task ${i}`,
    });
    j.subStart(session, id, role);
    if (stopped) j.subStop(session, id, role);
  });
  return j;
}

// design 4.15, 10: the roles of the owner's legend (the snapshot of
// 2026-10-06), in the order of their desks 1..18; the main session is desk 0.
// The files of .claude/agents/ are not read.
export const LEGEND_ROLES = [
  "Sai Documentation Updater (DOC-UPDATER)",
  "Sai Reviewer (REVIEWER)",
  "Sai Requirement Analyst (REQ-ANALYST)",
  "Sai Requirement Validator (REQ-VALIDATOR)",
  "Sai GUI Design Analyst (GUI-DESIGN-ANALYST)",
  "Sai Code Designer (CODE-DESIGNER)",
  "Sai Code Design Validator (CODE-DESIGN-VALIDATOR)",
  "Sai Frontend Developer (FRONTEND-DEV)",
  "Sai Security Reviewer (SECURITY-REVIEWER)",
  "Sai Test Designer (TEST-DESIGNER)",
  "Sai Test Design Validator (TEST-DESIGN-VALIDATOR)",
  "Sai Design QA Validator (DESIGN-QA-VALIDATOR)",
  "Sai Test Runner (TEST-RUNNER)",
  "Sai Code Fixer (CODE-FIXER)",
  "Sai Release Validator (RELEASE-VALIDATOR)",
  "Sai Plan Validator (PLAN-VALIDATOR)",
  "Sai Plan Writer (PLAN-WRITER)",
  "Sai Backend Developer (BACKEND-DEV)",
];

// The main session and the 18 roles of LEGEND_ROLES, each started once by the
// main session: 19 desks.
export function legendJournal() {
  const j = journal();
  j.sessionStart("S0");
  j.prompt("S0");
  LEGEND_ROLES.forEach((role, i) => {
    const id = `agent-${i}`;
    j.post("S0", `tu-${i}`, id, {
      subagentType: role,
      description: `task ${i}`,
    });
    j.subStart("S0", id, role);
  });
  return j;
}

// ------------------------------------------------------------- hook runner

// command and args of the hook as Claude Code starts them: from settings.json
// with ${CLAUDE_PROJECT_DIR} replaced (probe P1).
export function hookCommand(event = "SessionStart", projectDir = ROOT) {
  const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  const handler = settings.hooks[event][0].hooks[0];
  return {
    command: handler.command,
    args: handler.args.map((a) =>
      a.replaceAll("${CLAUDE_PROJECT_DIR}", projectDir),
    ),
  };
}

// Runs the hook command with `input` (an object, or a string as it is). It is
// asynchronous: a server of the test lives in this process and must be able
// to answer while the hook waits for it.
export function runHook(box, input, o = {}) {
  const { command, args } = hookCommand(
    o.event ?? "SessionStart",
    o.projectDir ?? ROOT,
  );
  const env = o.env ?? childEnv(box, o.envExtra ?? {});
  assertSafeEnv(env);
  const text = typeof input === "string" ? input : JSON.stringify(input);
  return new Promise((resolve) => {
    const before = Date.now();
    const t0 = performance.now();
    const child = spawn(command, args, {
      cwd: o.cwd ?? ROOT,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.stdin.on("error", () => {});
    child.on("close", (code) =>
      resolve({
        code,
        stdout,
        stderr,
        ms: performance.now() - t0,
        before,
        after: Date.now(),
      }),
    );
    child.stdin.end(text);
  });
}

// Inputs of the seven events as the documentation gives them. Every forbidden
// field holds a unique label so a copy shows up in a grep.
export const LABELS = [];
let labelCounter = 0;
export function label(name) {
  labelCounter += 1;
  const value = `LABEL-${name}-${labelCounter}-${crypto.randomBytes(4).toString("hex")}`;
  LABELS.push(value);
  return value;
}

export function hookInputs(session = "sess-hook-01") {
  const common = () => ({
    session_id: session,
    transcript_path: label("transcript_path"),
    cwd: label("cwd"),
    permission_mode: label("permission_mode"),
  });
  return {
    SessionStart: {
      ...common(),
      hook_event_name: "SessionStart",
      source: "resume",
      model: label("model"),
      session_title: label("session_title"),
    },
    UserPromptSubmit: {
      ...common(),
      hook_event_name: "UserPromptSubmit",
      prompt: label("prompt"),
    },
    PostToolUse: {
      ...common(),
      hook_event_name: "PostToolUse",
      tool_name: "Agent",
      tool_use_id: "toolu_01ABC",
      tool_input: {
        subagent_type: "general-purpose",
        description: "проба хуков",
        prompt: label("tool_input.prompt"),
      },
      tool_response: {
        agentId: "agent-xyz-01",
        status: label("tool_response.status"),
        content: label("tool_response.content"),
        background_tasks: label("background_tasks"),
      },
    },
    SubagentStart: {
      ...common(),
      hook_event_name: "SubagentStart",
      agent_id: "agent-xyz-01",
      agent_type: "general-purpose",
    },
    SubagentStop: {
      ...common(),
      hook_event_name: "SubagentStop",
      agent_id: "agent-xyz-01",
      agent_type: "general-purpose",
      agent_transcript_path: label("agent_transcript_path"),
      last_assistant_message: label("last_assistant_message"),
      stop_hook_active: false,
    },
    Stop: {
      ...common(),
      hook_event_name: "Stop",
      last_assistant_message: label("last_assistant_message"),
      stop_hook_active: false,
    },
    SessionEnd: {
      ...common(),
      hook_event_name: "SessionEnd",
      reason: label("reason"),
    },
  };
}

// ----------------------------------------------------------- HTTP helpers

// One request on a fresh connection; the Host header can be replaced.
export function request(port, o = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(o.headers ?? {}) };
    if (o.host !== undefined) headers.host = o.host;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: o.method ?? "GET",
        path: o.path ?? "/",
        headers,
        agent: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    if (o.body !== undefined) req.write(o.body);
    req.end();
  });
}

// A running server on port 0 in its own state directory, with substitutable
// clock, journal and public directory.
export async function startServer(t, o = {}) {
  const box = o.box ?? sandbox(t);
  const secret = prepareState(box);
  if (o.setup) o.setup(box, secret);
  const warnings = [];
  const server = createServer({
    stateDir: box.dir,
    port: 0,
    now: o.now,
    journal: o.journal,
    publicDir: o.publicDir,
    warn: (m) => warnings.push(m),
    // Text storage is given explicitly, never taken from the environment of
    // the test run (REQ-008 12.1): on unless the test turns it off.
    storeText: o.storeText ?? true,
  });
  const { port } = await server.listen();
  t.after(() => server.close());
  const eventsFile = path.join(box.dir, "events.jsonl");
  const api = {
    box,
    dir: box.dir,
    secret,
    port,
    server,
    warnings,
    eventsFile,
    startsFile: path.join(box.dir, "server-starts.jsonl"),
    get: (p, headers) => request(port, { path: p, headers }),
    // A signed write; sign: false → no signature, a string → that signature.
    post(body, { sign = true, key = secret, headers = {}, raw } = {}) {
      const text = raw ?? JSON.stringify(body);
      const h = { "content-type": "application/json", ...headers };
      if (sign === true) h[SIGNATURE_HEADER] = signBody(key, text);
      else if (typeof sign === "string") h[SIGNATURE_HEADER] = sign;
      return request(port, {
        method: "POST",
        path: "/api/events",
        headers: h,
        body: text,
      });
    },
    // A signed write of a record of the orchestrator (POST /api/note).
    postNote(body, { sign = true, key = secret, headers = {}, raw } = {}) {
      const text = raw ?? JSON.stringify(body);
      const h = { "content-type": "application/json", ...headers };
      if (sign === true) h[SIGNATURE_HEADER] = signBody(key, text);
      else if (typeof sign === "string") h[SIGNATURE_HEADER] = sign;
      return request(port, {
        method: "POST",
        path: "/api/note",
        headers: h,
        body: text,
      });
    },
    sha: () => sha256OrNone(eventsFile),
    lines: () =>
      fs.existsSync(eventsFile)
        ? fs
            .readFileSync(eventsFile, "utf8")
            .split("\n")
            .filter((l) => l !== "")
        : [],
  };
  return api;
}

// ------------------------------------------------------------- processes

// Starts main.js with pipes (port 0) and waits for the line with the link.
export async function spawnMain(t, box, args = [], o = {}) {
  const env = o.env ?? childEnv(box);
  assertSafeEnv(env);
  const full = ["--port", "0", ...args];
  assertSafeArgs(full);
  const child = spawn(process.execPath, [MAIN_JS, ...full], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const done = new Promise((resolve) =>
    child.on("close", (code, signal) => resolve({ code, signal })),
  );
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  });
  const out = { stdout: "", stderr: "" };
  child.stdout.on("data", (d) => (out.stdout += d));
  child.stderr.on("data", (d) => (out.stderr += d));
  const link = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no link line: ${out.stdout} ${out.stderr}`)),
      15000,
    );
    const check = () => {
      const m = /^Pixel Office: http:\/\/127\.0\.0\.1:(\d+)\/$/m.exec(
        out.stdout,
      );
      if (m) {
        clearTimeout(timer);
        resolve({ port: Number(m[1]), line: m[0] });
      }
    };
    child.stdout.on("data", check);
    child.once("close", () => {
      clearTimeout(timer);
      reject(new Error(`exited early: ${out.stdout} ${out.stderr}`));
    });
    check();
  });
  return {
    child,
    done,
    out,
    port: link.port,
    link: link.line,
    async stop() {
      child.kill("SIGTERM");
      return done;
    },
  };
}

// One run of main.js to the end (asynchronous: fake occupants of a port live
// in this process).
export function runMain(box, args = [], o = {}) {
  const env = o.env ?? childEnv(box);
  assertSafeEnv(env);
  // port 4780 is never used by the tests: without --port the port is 0
  const full = args.includes("--port") ? args : ["--port", "0", ...args];
  assertSafeArgs(full, o.allowPorts);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [MAIN_JS, ...full], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), o.timeout ?? 20000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

// A process that occupies a port: kind "silent" accepts and says nothing;
// "close" closes the connection; "text", "json-no-app", "json-foreign" are
// HTTP servers (probe P14).
export async function occupyPort(t, kind) {
  let server;
  const sockets = new Set();
  if (kind === "silent" || kind === "close") {
    server = net.createServer((s) => {
      sockets.add(s);
      s.on("error", () => {});
      if (kind === "close") s.destroy();
    });
  } else {
    server = http.createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      if (kind === "text") res.end("hello, this is not json");
      else if (kind === "json-no-app") res.end(JSON.stringify({ ok: true }));
      else res.end(JSON.stringify({ app: "someone-else" }));
    });
  }
  server.on("connection", (s) => sockets.add(s));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    for (const s of sockets) s.destroy();
    server.close();
  });
  return server.address().port;
}

// ----------------------------------------------------------------- fake DOM

const VOID = new Set(["meta", "link", "br", "img", "input", "hr"]);

function camel(name) {
  return name.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
}

function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

export class FakeElement {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = new Map();
    this.dataset = {};
    this.hidden = false;
    this.listeners = new Map();
    this.classes = new Set();
    this._text = "";
    // a form field holds text; other elements keep the old number (progress)
    this.value = ["INPUT", "SELECT", "TEXTAREA"].includes(this.tagName)
      ? ""
      : 0;
    this.max = 1;
    this.scrollHeight = 0;
    this.clientWidth = 0;
    this.clientHeight = 0;
    this.offsetTop = 0;
    this.offsetHeight = 0;
    this.rowHeight = null;
    this.rect = null;
    this.ctx = null;
    this.focusCount = 0;
    const self = this;
    this.classList = {
      add: (...names) => names.forEach((n) => self.classes.add(n)),
      remove: (...names) => names.forEach((n) => self.classes.delete(n)),
      contains: (n) => self.classes.has(n),
    };
  }

  // title is the attribute, as in a browser (the page sets either)
  get title() {
    return this.attrs.get("title") ?? "";
  }

  set title(v) {
    this.attrs.set("title", String(v));
  }

  get className() {
    return [...this.classes].join(" ");
  }

  get id() {
    return this.attrs.get("id") ?? "";
  }

  // As in a browser, a text set before children were appended stays the first
  // text node (REQ-049: "подробнее" and its arrow).
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map((c) => c.textContent).join("");
  }

  set textContent(v) {
    this._text = String(v);
    this.children.forEach((c) => (c.parentNode = null));
    this.children = [];
  }

  // Accesses that the page must never make (decision D16, criterion 6).
  get style() {
    this.ownerDocument.styleTouches += 1;
    throw new Error("style is not allowed");
  }

  get cssText() {
    this.ownerDocument.styleTouches += 1;
    throw new Error("cssText is not allowed");
  }

  set innerHTML(_v) {
    this.ownerDocument.htmlWrites += 1;
    throw new Error("innerHTML is not allowed");
  }

  setAttribute(name, value) {
    const text = String(value);
    this.attrs.set(name, text);
    if (name === "class") {
      this.classes = new Set(text.split(/\s+/).filter(Boolean));
    }
    if (name === "width" && this.tagName === "CANVAS")
      this.width = Number(text);
    if (name === "height" && this.tagName === "CANVAS")
      this.height = Number(text);
    if (name.startsWith("data-")) this.dataset[camel(name.slice(5))] = text;
  }

  getAttribute(name) {
    if (name === "class") return this.className;
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  removeAttribute(name) {
    this.attrs.delete(name);
    if (name.startsWith("data-")) delete this.dataset[camel(name.slice(5))];
  }

  hasAttribute(name) {
    return this.attrs.has(name);
  }

  _layout() {
    if (this.rowHeight === null) return;
    this.children.forEach((c, i) => {
      c.offsetTop = i * this.rowHeight;
      c.offsetHeight = this.rowHeight;
    });
    this.scrollHeight = this.children.length * this.rowHeight;
    this._clamp();
  }

  _clamp() {
    const max = Math.max(0, this.scrollHeight - this.clientHeight);
    if (this._top > max) this._top = max;
    if (this._top < 0) this._top = 0;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    this._layout();
    return child;
  }

  replaceChildren(...nodes) {
    this.children.forEach((c) => (c.parentNode = null));
    this.children = [];
    this._text = "";
    for (const n of nodes) {
      n.parentNode = this;
      this.children.push(n);
    }
    this._layout();
  }

  addEventListener(type, fn) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  // The test calls the listeners itself. As in a browser (design 8.3 of
  // REQ-036/044/045): a keydown of Enter or Space that no listener prevented
  // activates a BUTTON or a SUMMARY (a click), and a click on a SUMMARY opens
  // or closes its DETAILS. Returns true if a listener called preventDefault.
  fire(type, event = {}) {
    let prevented = false;
    const own = event.preventDefault;
    const e = {
      target: this,
      type,
      ...event,
      preventDefault: () => {
        prevented = true;
        if (typeof own === "function") own();
      },
    };
    for (const fn of this.listeners.get(type) ?? []) fn(e);
    if (
      type === "keydown" &&
      !prevented &&
      (e.key === "Enter" || e.key === " " || e.key === "Space") &&
      (this.tagName === "BUTTON" || this.tagName === "SUMMARY")
    ) {
      this.click();
    }
    return prevented;
  }

  click(event = {}) {
    const prevented = this.fire("click", event);
    if (
      !prevented &&
      this.tagName === "SUMMARY" &&
      this.parentNode !== null &&
      this.parentNode.tagName === "DETAILS"
    ) {
      this.parentNode.open = this.parentNode.open !== true;
    }
  }

  focus() {
    this.focusCount += 1;
    this.ownerDocument.focused = this;
  }

  getContext(_kind) {
    return this.ctx;
  }

  getBoundingClientRect() {
    return (
      this.rect ?? {
        left: 0,
        top: 0,
        width: this.width ?? 0,
        height: this.height ?? 0,
      }
    );
  }

  *walk() {
    yield this;
    for (const c of this.children) yield* c.walk();
  }

  find(pred) {
    for (const el of this.walk()) if (pred(el)) return el;
    return null;
  }

  all(pred) {
    return [...this.walk()].filter(pred);
  }

  byClass(name) {
    return this.all((e) => e.classes.has(name));
  }
}

// scrollTop with the clamp of a real scrolling box, when rows have a height.
Object.defineProperty(FakeElement.prototype, "scrollTop", {
  get() {
    return this._top ?? 0;
  },
  set(v) {
    this._top = Number(v);
    if (this.rowHeight !== null) this._clamp();
  },
});

export class FakeDocument {
  constructor(html) {
    this.styleTouches = 0;
    this.htmlWrites = 0;
    this.created = [];
    this.listeners = new Map();
    this.visibilityState = "visible";
    this.focused = null;
    this.root = new FakeElement(this, "html");
    this.scripts = [];
    this.parse(html);
  }

  parse(html) {
    const stack = [this.root];
    const re =
      /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^\s>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/gi;
    let m;
    const texts = new Map();
    while ((m = re.exec(html)) !== null) {
      if (m[1] !== undefined) {
        const el = stack.pop();
        if (el.children.length === 0 && texts.has(el)) {
          el._text = collapse(texts.get(el));
        }
      } else if (m[2] !== undefined) {
        const tag = m[2].toLowerCase();
        const el = new FakeElement(this, tag);
        const attrRe =
          /([^\s>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
        let a;
        while ((a = attrRe.exec(m[3])) !== null) {
          const value = a[2] ?? a[3] ?? a[4] ?? "";
          el.setAttribute(a[1], value);
          if (a[1] === "hidden") el.hidden = true;
        }
        if (tag === "canvas") {
          el.width = Number(el.attrs.get("width"));
          el.height = Number(el.attrs.get("height"));
        }
        if (tag === "script") this.scripts.push(el);
        const parent = stack[stack.length - 1];
        parent.children.push(el);
        el.parentNode = parent;
        if (!VOID.has(tag) && m[4] !== "/") stack.push(el);
      } else if (m[5] !== undefined) {
        const top = stack[stack.length - 1];
        texts.set(top, (texts.get(top) ?? "") + m[5]);
      }
    }
  }

  getElementById(id) {
    return this.root.find((e) => e.attrs.get("id") === id);
  }

  get activeElement() {
    return this.focused;
  }

  createElement(tag) {
    const el = new FakeElement(this, tag);
    this.created.push(el);
    // A test may give new elements sizes (rowHeight, clientHeight) to stand
    // for the layout of a browser (REQ-049: the list of "Сейчас" overflows).
    if (typeof this.onCreate === "function") this.onCreate(el);
    return el;
  }

  addEventListener(type, fn) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  fire(type, event = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn({ type, ...event });
  }
}

export function indexHtml() {
  return fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
}

// ------------------------------------------------------------- fake canvas

function fontSize(font) {
  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  return m ? Number(m[1]) : 10;
}

// A canvas context that records the drawing calls in order with the values of
// fillStyle, strokeStyle, font and textAlign at the moment of each call.
export function makeCtx() {
  const calls = [];
  const ctx = {
    calls,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    font: "10px sans-serif",
    textAlign: "start",
    lineWidth: 1,
    fail: null,
  };
  const rec = (op, args) => {
    if (ctx.fail !== null) throw ctx.fail;
    calls.push({
      op,
      args,
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      font: ctx.font,
      textAlign: ctx.textAlign,
    });
  };
  for (const op of [
    "setTransform",
    "fillRect",
    "beginPath",
    "roundRect",
    "fill",
    "stroke",
  ]) {
    ctx[op] = (...args) => rec(op, args);
  }
  ctx.fillText = (text, x, y, maxWidth) =>
    rec(
      "fillText",
      maxWidth === undefined ? [text, x, y] : [text, x, y, maxWidth],
    );
  ctx.measureText = (text) => ({
    width: 0.6 * fontSize(ctx.font) * Array.from(String(text)).length,
  });
  ctx.frames = () => {
    const frames = [];
    for (const c of calls) {
      if (c.op === "setTransform") frames.push([]);
      if (frames.length > 0) frames[frames.length - 1].push(c);
    }
    return frames;
  };
  ctx.lastFrame = () => {
    const f = ctx.frames();
    return f.length === 0 ? [] : f[f.length - 1];
  };
  ctx.clear = () => {
    calls.length = 0;
  };
  return ctx;
}

// Colour of the point (px, py) of the office (logical px, left wall at 0
// after the transform): the last fillRect that covers it. Text, rounded
// rectangles and strokes are not looked at (design 10.1, rasterize).
export function colorAt(calls, minX, px, py) {
  const x = px + minX * 24;
  for (let i = calls.length - 1; i >= 0; i--) {
    const c = calls[i];
    if (c.op !== "fillRect") continue;
    const [rx, ry, w, h] = c.args;
    if (x >= rx && x < rx + w && py >= ry && py < ry + h) return c.fillStyle;
  }
  return null;
}

// ------------------------------------------------------ fake world for pages

// A fake of the /api/events server of the page: the journal lines, the
// records of server starts and the way it answers.
export function makeEventsServer({ entries = [], starts = [] } = {}) {
  const s = {
    entries,
    starts,
    mode: "ok",
    calls: [],
    // Replaces the body of an answer: (after) => object.
    respond: null,
    async fetchFn(url, init) {
      s.calls.push({ url, method: init?.method, init });
      if (s.mode === "fail") throw new Error("connection refused");
      if (s.mode === "hang") {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        });
      }
      if (s.mode === "status500")
        return { status: 500, json: async () => ({}) };
      if (s.mode === "notjson") {
        return {
          status: 200,
          json: async () => {
            throw new SyntaxError("not json");
          },
        };
      }
      if (s.mode === "badshape") {
        return { status: 200, json: async () => ({ hello: "world" }) };
      }
      const q = new URL(url, "http://127.0.0.1").searchParams;
      const raw = q.get("after");
      const after = raw !== null && /^\d+$/.test(raw) ? Number(raw) : NaN;
      const lines = s.entries.length;
      const from = Number.isInteger(after) && after <= lines ? after : 0;
      const body = s.respond
        ? s.respond(after)
        : {
            app: "sai-pixel-office",
            lines,
            from,
            events: s.entries.slice(from),
            server_starts: s.starts,
          };
      return { status: 200, json: async () => body };
    },
  };
  return s;
}

export function makeClock(start = NOW) {
  let now = start;
  let seq = 0;
  const timers = new Map();
  const clock = {
    now: () => now,
    set(ms) {
      now = ms;
    },
    setIntervalFn(fn, ms) {
      seq += 1;
      timers.set(seq, { fn, ms, next: now + ms, every: true });
      return seq;
    },
    clearIntervalFn: (id) => timers.delete(id),
    setTimeoutFn(fn, ms) {
      seq += 1;
      timers.set(seq, { fn, ms, next: now + ms, every: false });
      return seq;
    },
    clearTimeoutFn: (id) => timers.delete(id),
    pending: () => timers.size,
    // Calls the function of every interval once, without moving time: a
    // "tick" of the polling.
    fire() {
      for (const tm of [...timers.values()]) if (tm.every) tm.fn();
    },
    // Moves time forward, firing due timers in order (synchronously).
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null;
        let pickId = null;
        for (const [id, tm] of timers) {
          if (tm.next <= target && (pick === null || tm.next < pick.next)) {
            pick = tm;
            pickId = id;
          }
        }
        if (pick === null) break;
        now = pick.next;
        if (pick.every) pick.next += pick.ms;
        else timers.delete(pickId);
        pick.fn();
      }
      now = target;
    },
  };
  return clock;
}

export function makeFrames() {
  let callback = null;
  let ts = 0;
  const frames = {
    requestFrameFn(fn) {
      callback = fn;
      return 1;
    },
    pending: () => callback !== null,
    // One frame of dtMs milliseconds.
    step(dtMs = 1000 / 60) {
      ts += dtMs;
      const fn = callback;
      callback = null;
      if (fn) fn(ts);
    },
    run(count, dtMs = 1000 / 60) {
      for (let i = 0; i < count; i++) frames.step(dtMs);
    },
  };
  return frames;
}

// The page of Pixel Office on fakes: the DOM parsed from index.html, a fake
// server, clock, frames and canvas. Nothing real: no timers, no network.
export function makePage(o = {}) {
  const doc = new FakeDocument(indexHtml());
  const server = makeEventsServer({
    entries: o.entries ?? [],
    starts: o.starts ?? [],
  });
  const clock = makeClock(o.now ?? NOW);
  const frames = makeFrames();
  const ctx = o.canvas === false ? null : makeCtx();
  const canvas = doc.getElementById("office");
  canvas.ctx = ctx;
  const journalEl = doc.getElementById("journal");
  journalEl.rowHeight = 20;
  journalEl.clientHeight = 200;
  const resizeListeners = [];
  const viewport = o.viewport ?? { width: 1920, height: 1080 };
  // The clipboard of the page (REQ-044): o.clipboardFn as given, or a function
  // that returns o.clipboard (an object with writeText, null, anything).
  let clipboardFn;
  if (typeof o.clipboardFn === "function") clipboardFn = o.clipboardFn;
  else if (Object.hasOwn(o, "clipboard")) clipboardFn = () => o.clipboard;
  // The memory of the browser for the tour (REQ-052): o.storageFn as given;
  // without it the page has no storage (the invitation shows each time).
  const storageFn = Object.hasOwn(o, "storageFn") ? o.storageFn : undefined;
  const app = createApp({
    document: doc,
    clipboardFn,
    storageFn,
    fetchFn: (url, init) => server.fetchFn(url, init),
    nowFn: clock.now,
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    requestFrameFn: frames.requestFrameFn,
    AbortControllerCtor: AbortController,
    viewportFn: () => viewport,
    addResizeListener: (fn) => resizeListeners.push(fn),
  });
  const page = {
    app,
    doc,
    server,
    clock,
    frames,
    ctx,
    canvas,
    resizeListeners,
    el: (id) => doc.getElementById(id),
    text: (id) => doc.getElementById(id).textContent,
    started: null,
    // Starts the page and lets its first poll finish.
    async start() {
      page.started = app.start();
      page.started.catch(() => {});
      await settle();
    },
    // Moves the clock and lets the polls that it started finish.
    async tick(ms = 2000) {
      clock.advance(ms);
      await settle();
    },
    // Appends lines to the fake journal and polls once.
    async push(...entries) {
      server.entries.push(...entries);
      await page.tick(2000);
    },
    rows: () => doc.getElementById("journal").byClass("row"),
    items: () => doc.getElementById("tasks").byClass("item"),
    legend: () => doc.getElementById("legend").byClass("legend-item"),
    created: (tag) =>
      doc.created.filter((e) => e.tagName === tag.toUpperCase()),
  };
  return page;
}

// A fake storage of the browser (REQ-052): the values by key, every call in
// order; failGet / failSet make getItem / setItem throw.
export function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const st = {
    values,
    calls: [],
    failGet: false,
    failSet: false,
    getItem(key) {
      st.calls.push(["getItem", key]);
      if (st.failGet) throw new Error("storage is not allowed");
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      st.calls.push(["setItem", key, value]);
      if (st.failSet) throw new Error("storage is full");
      values.set(key, String(value));
    },
    removeItem(key) {
      st.calls.push(["removeItem", key]);
      values.delete(key);
    },
  };
  return st;
}

// Elements of a page whose text is exactly `text`.
export function withText(root, text) {
  return root.all((e) => e.children.length === 0 && e.textContent === text);
}

// ------------------------------------------------- code run in a child process

// Runs a module script in a child process with a given TZ (a substitution of
// process.env.TZ inside the test process is not reliable, design 10.1). The
// script is ES module text; it may import the helpers through HELPERS_URL.
export const HELPERS_URL = pathToFileURL(fileURLToPath(import.meta.url)).href;

export function runWithTz(box, tz, code) {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    env: { ...childEnv(box), TZ: tz },
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(r.status, 0, `child failed: ${r.stderr}`);
  return r.stdout;
}

// A port that nobody listens on right now.
export async function freePort() {
  const s = net.createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address();
  await new Promise((r) => s.close(r));
  return port;
}

// ------------------------------------------------------ the scale tests (SC, OF-38)

// Measures of the office panel as rectangles (design 4.14, rule 5): the area
// #office-inner, the legend (its height) and the gap between the scroll area
// of the canvas (#office-scroll, design 4.15, 8) and the legend. Sizes may be
// fractional, as at a scale above 1.
export function setPanelRects(page, { width, height, legend, gap }) {
  const canvasBottom = 500;
  page.el("office-inner").rect = {
    left: 0,
    top: 0,
    width,
    height,
    bottom: height,
  };
  page.el("office-scroll").rect = {
    left: 0,
    top: 0,
    width: 1,
    height: canvasBottom,
    bottom: canvasBottom,
  };
  page.el("legend").rect = {
    left: 0,
    top: canvasBottom + gap,
    width: 1,
    height: legend,
    bottom: canvasBottom + gap + legend,
  };
}

// The same measures as whole numbers: clientWidth, clientHeight, offsetHeight
// and offsetTop, the way out when there is no rectangle.
export function setPanelInts(page, { width, height, legend, gap }) {
  const inner = page.el("office-inner");
  inner.clientWidth = width;
  inner.clientHeight = height;
  const scroll = page.el("office-scroll");
  scroll.offsetTop = 0;
  scroll.offsetHeight = 500;
  const legendEl = page.el("legend");
  legendEl.offsetHeight = legend;
  legendEl.offsetTop = 500 + gap;
}

// ------------------------------------------------ REQ-008: masking examples

// The tables of design REQ-008, section 3.1 (all values are invented). `leak`
// lists the pieces that must not survive masking (a `grep -F` of each is 1).
const LB = "[скрыто]";

// Forms of a value in quotes (Q) and boundaries (E): input -> exact result.
export const MASK_ROWS = [
  {
    id: "Q-1",
    input: 'password="primer 42" дальше',
    expected: `password=${LB} дальше`,
    leak: ["primer 42"],
  },
  {
    id: "Q-2",
    input: "token='abc123xyz' дальше",
    expected: `token=${LB} дальше`,
    leak: ["abc123xyz"],
  },
  {
    id: "Q-3",
    input: "secret=`s3cr3t` дальше",
    expected: `secret=${LB} дальше`,
    leak: ["s3cr3t"],
  },
  {
    id: "Q-4",
    input: '{"password": "primer42", "user": "anna"}',
    expected: `{"password": ${LB}, "user": "anna"}`,
    leak: ["primer42"],
  },
  {
    id: "Q-5",
    input: 'curl -H "x: 1" Bearer "eyAbc123" дальше',
    expected: `curl -H "x: 1" Bearer ${LB} дальше`,
    leak: ["eyAbc123"],
  },
  {
    id: "Q-6",
    input: '{"api_key":"abcd1234"}',
    expected: `{"api_key":${LB}}`,
    leak: ["abcd1234"],
  },
  {
    id: "Q-7",
    input: 'password="primer 42 без конца\nвторая строка',
    expected: `password=${LB}\nвторая строка`,
    leak: ["primer 42", "без конца"],
  },
  {
    id: "Q-8",
    input: 'password="a\\"b c" хвост',
    expected: `password=${LB} хвост`,
    leak: ['b c"', "a\\"],
  },
  {
    id: "Q-9",
    input: `password="ab'cd ef" хвост`,
    expected: `password=${LB} хвост`,
    leak: ["cd ef"],
  },
  { id: "Q-10", input: 'password=""', expected: 'password=""', leak: [] },
  {
    id: "Q-11",
    input: 'password: "[скрыто]"',
    expected: `password: ${LB}`,
    leak: [],
  },
  {
    id: "Q-12",
    input: "Bearer `a`Bearer b",
    expected: `Bearer ${LB}Bearer ${LB}`,
    leak: [],
  },
  {
    id: "Q-13",
    input: 'password="abc\\\nnext=1 token=x',
    expected: `password=${LB}\nnext=1 token=${LB}`,
    leak: ["abc"],
  },
  {
    id: "E-1",
    input: "AWS_ACCESS_KEY_ID=AKIAZZZZEXAMPLE00001",
    expected: `AWS_ACCESS_KEY_ID=${LB}`,
    leak: ["AKIAZZZZEXAMPLE00001"],
  },
  {
    id: "E-2",
    input: "id=AKIAZZZZEXAMPLE00001",
    expected: `id=${LB}`,
    leak: ["AKIAZZZZEXAMPLE00001"],
  },
  {
    id: "E-3",
    input: "K=ghp_abcdefghij0123456789",
    expected: `K=${LB}`,
    leak: ["ghp_abcdefghij0123456789"],
  },
  {
    id: "E-4",
    input: "X=sk-ant-abcdefghij12345",
    expected: `X=${LB}`,
    leak: ["sk-ant-abcdefghij12345"],
  },
  {
    id: "E-5",
    input: "DB_PASSWORD=primer42",
    expected: `DB_PASSWORD=${LB}`,
    leak: ["primer42"],
  },
  {
    id: "E-6",
    input: "my_password=primer42",
    expected: `my_password=${LB}`,
    leak: ["primer42"],
  },
  {
    id: "E-7",
    input: "GITHUB_TOKEN=ghp_abcdefghij0123456789",
    expected: `GITHUB_TOKEN=${LB}`,
    leak: ["ghp_abcdefghij0123456789"],
  },
  {
    id: "E-8",
    input: "max_token=1000",
    expected: `max_token=${LB}`,
    leak: [],
  },
];

// The rules M1-M10 one by one: a text that is masked (exact result).
export const MASK_RULE_ROWS = [
  // ISS-0121: a space or a tab before "=", and an address with an empty user.
  {
    id: "M9-spaced-quoted",
    input: 'password = "hunter2fake" дальше',
    expected: `password = ${LB} дальше`,
    leak: ["hunter2fake"],
  },
  {
    id: "M9-spaced-bare",
    input: "password = primer42",
    expected: `password = ${LB}`,
    leak: ["primer42"],
  },
  {
    id: "M9-spaced-tab-comment",
    input: "DB_PASSWORD\t=\tprimer42  # прод",
    expected: `DB_PASSWORD\t=\t${LB}  # прод`,
    leak: ["primer42"],
  },
  {
    id: "M3-empty-user",
    input: "redis://:primer42@host:6379",
    expected: `redis://${LB}@host:6379`,
    leak: ["primer42"],
  },
  {
    id: "M1",
    input:
      "до\n-----BEGIN PRIVATE KEY-----\nMIIBabc123xyz\n-----END PRIVATE KEY-----\nпосле",
    expected: `до\n${LB}\nпосле`,
    leak: ["MIIBabc123xyz"],
  },
  {
    id: "M1-cut",
    input: "до\n-----BEGIN PRIVATE KEY-----\nMIIBabc123xyz\nещё строка",
    expected: `до\n${LB}`,
    leak: ["MIIBabc123xyz", "ещё строка"],
  },
  {
    id: "M2",
    input: "Authorization: Basic dXNlcjpwYXNz дальше\nследующая",
    expected: `Authorization: ${LB}\nследующая`,
    leak: ["dXNlcjpwYXNz"],
  },
  {
    id: "M3",
    input: "открой https://anna:primer42@example.org/x",
    expected: `открой https://${LB}@example.org/x`,
    leak: ["primer42"],
  },
  {
    id: "M4",
    input: "ключ sk-ant-abcdefghij1234567890 конец",
    expected: `ключ ${LB} конец`,
    leak: ["abcdefghij1234567890"],
  },
  {
    id: "M4-proj",
    input: "sk-proj-abcd_efgh-ijkl_mnop-1234",
    expected: LB,
    leak: ["abcd_efgh"],
  },
  {
    id: "M5-ghp",
    input: "токен ghp_abcdefghij0123456789 конец",
    expected: `токен ${LB} конец`,
    leak: ["abcdefghij0123456789"],
  },
  {
    id: "M5-gho",
    input: "gho_abcdefghij0123456789",
    expected: LB,
    leak: ["abcdefghij0123456789"],
  },
  {
    id: "M5-ghs",
    input: "ghs_abcdefghij0123456789",
    expected: LB,
    leak: ["abcdefghij0123456789"],
  },
  {
    id: "M5-pat",
    input: "github_pat_abcdefghij0123456789_xyz",
    expected: LB,
    leak: ["abcdefghij0123456789"],
  },
  {
    id: "M6-AKIA",
    input: "ключ AKIAZZZZEXAMPLE00001 конец",
    expected: `ключ ${LB} конец`,
    leak: ["AKIAZZZZEXAMPLE00001"],
  },
  {
    id: "M6-ASIA",
    input: "ключ ASIAZZZZEXAMPLE00001 конец",
    expected: `ключ ${LB} конец`,
    leak: ["ASIAZZZZEXAMPLE00001"],
  },
  {
    id: "M7-jwt",
    input: "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcDEF123_-x. конец",
    expected: `jwt ${LB}. конец`,
    leak: ["eyJhbGciOiJIUzI1NiJ9"],
  },
  {
    id: "M7-no-eyJ",
    input: "три части abcd.efgh.ijkl конец",
    expected: `три части ${LB} конец`,
    leak: ["efgh"],
  },
  {
    id: "M7-file",
    input: "см. a.test.js",
    expected: `см. ${LB}`,
    leak: ["a.test.js"],
  },
  {
    id: "M8",
    input: "curl Bearer abcdef123 дальше",
    expected: `curl Bearer ${LB} дальше`,
    leak: ["abcdef123"],
  },
  {
    id: "M9-upper",
    input: "PASSWORD=primer42 дальше",
    expected: `PASSWORD=${LB} дальше`,
    leak: ["primer42"],
  },
  {
    id: "M9-mixed",
    input: "Api_Key: primer42 дальше",
    expected: `Api_Key: ${LB} дальше`,
    leak: ["primer42"],
  },
  {
    id: "M9-passwd",
    input: "passwd=primer42 apikey=primer43 authorization=primer44",
    expected: `passwd=${LB} apikey=${LB} authorization=${LB}`,
    leak: ["primer42", "primer43", "primer44"],
  },
  {
    id: "M10-base64",
    input: "Zm9vYmFyMTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3A=",
    expected: LB,
    leak: ["Zm9vYmFyMTIzNDU2"],
  },
  {
    id: "M10-40",
    input: "строка abcdefghij0123456789abcdefghij0123456789, конец",
    expected: `строка ${LB}, конец`,
    leak: ["abcdefghij0123456789abcdefghij"],
  },
];

// Text that must stay as it is (N-1...N-7 and the examples of criterion 7).
// ISS-0121: a comparison, an arrow, a ternary, a bare word or an expression with
// a bracket after a spaced sign is no pair.
export const MASK_KEEP_ROWS = [
  "if (password == null)",
  "password === other",
  "x => password => 1",
  "def f(password = None):",
  "token = response.json()['token']",
  'password = request.form["password"]',
  "token = jwt",
  "cond ? token : other",
  "http://:8080/path",
  "docs/design/samples/history-view-sample-2026-10-05",
  "tools/src/pixel-office/public/panels.js",
  "REQ-008",
  "docs/design/REQ-008-history.md",
  "abcdefghijklmnopqrstuvwxyzabcdefghijklmn",
  "task-abcdefghijklmnopqrst",
  "xAKIAZZZZEXAMPLE00001",
  "docs/abcdefghij0123456789abcdefghij0123456789",
  "сделай X, версия 22 и номер 12345",
  "127.0.0.1",
  "a3f5c9e1b7d2486f90ab",
  "ABCDEF0123456789ABCDEF0123456789ABCD",
  "1234567890123456789012345678901234567890",
  'password=""',
];

// Known uncovered cases (design 3.3): these are NOT masked; a change of the
// rules must show up here.
export const MASK_RESIDUAL = [
  "пароль от почты — имя кота и год: тигр 2019",
  "мой ключ доступа: красный слон двадцать семь",
  "Zm9vYmFyMTIzNDU2Nzg5MGFi/Y2RlZmdoaWprbG1ub3A",
  "AB12CD34EF56GH78IJ90KL12MN34OP56QR78",
  "k9x2m4p7q1w8",
  "mypassword=primer42",
  "SECRET_ACCESS_KEY=abcd/EFGH+ijkl",
  "--password primer42",
  "pwd=primer42",
  "api-key: primer42",
];

// ------------------------------------------------ REQ-008 part (b): history

export const HISTORY_TEXT = "Первая строка запроса\n\nВторой абзац запроса";
export const HISTORY_NOTE_TEXT =
  "Понял так: сделать окно\nвторая строка понимания";

// The journal of the criterion fixture (REQ-008 criterion 10): one message of
// the owner with a text of two paragraphs, a record of the orchestrator with a
// number of a requirement, two tasks (one finished, with a description; one
// not finished, without one) and one service message. `idx` has the index of
// every line.
export function historyFixture() {
  const j = journal();
  const idx = {};
  idx.start = j.sessionStart("S1");
  idx.owner = j.ownerPrompt("S1", HISTORY_TEXT);
  idx.note = j.note({
    session_id: "S1",
    request_time: j.entries[idx.owner].time,
    req_id: "REQ-008",
    note_text: HISTORY_NOTE_TEXT,
  });
  idx.post1 = j.post("S1", "tu-a1", "a1", {
    subagentType: "Plan",
    description: "Проект окна",
  });
  idx.a1 = j.subStart("S1", "a1", "Plan");
  idx.a2 = j.subStart("S1", "a2", "Explore");
  idx.a1stop = j.subStop("S1", "a1", "Plan");
  idx.service = j.servicePrompt("S1");
  return { j, entries: j.entries, idx };
}

// The elements of the window of history of a started page.
export function historyDom(page) {
  const overlay = page.el("history-overlay");
  const body = page.el("history-body");
  return {
    overlay,
    body,
    dialog: page.el("history"),
    close: page.el("history-close"),
    isOpen: () => overlay.hidden === false,
    section: (name) => body.find((e) => e.dataset.section === name),
    title: () => body.find((e) => e.attrs.get("id") === "history-title"),
    meta: () => body.byClass("history-meta")[0],
  };
}

// The rows of the journal that open a window, and the buttons of the cards of
// the task panel.
export const historyRows = (page) =>
  page.rows().filter((r) => r.classes.has("opens-history"));
export const historyRowOf = (page, key) =>
  page.rows().find((r) => r.dataset.request === key) ?? null;
export const historyButtons = (page) =>
  page.items().flatMap((item) => item.byClass("history-open"));

// The rules of a style sheet as {media, selectors, decls}; a comment is
// dropped, a nested @media block keeps its head in `media`.
export function parseCss(css) {
  const out = [];
  const decls = (inner) => {
    const map = new Map();
    for (const part of inner.split(";")) {
      const c = part.indexOf(":");
      if (c < 0) continue;
      map.set(
        part.slice(0, c).trim(),
        part
          .slice(c + 1)
          .trim()
          .replace(/\s+/g, " "),
      );
    }
    return map;
  };
  const declList = (inner) => {
    const list = [];
    for (const part of inner.split(";")) {
      const c = part.indexOf(":");
      if (c < 0) continue;
      list.push([
        part.slice(0, c).trim(),
        part
          .slice(c + 1)
          .trim()
          .replace(/\s+/g, " "),
      ]);
    }
    return list;
  };
  const walk = (text, media) => {
    let pos = 0;
    while (pos < text.length) {
      const open = text.indexOf("{", pos);
      if (open < 0) break;
      const head = text.slice(pos, open).trim();
      let depth = 1;
      let k = open + 1;
      while (k < text.length && depth > 0) {
        if (text[k] === "{") depth += 1;
        else if (text[k] === "}") depth -= 1;
        k += 1;
      }
      const inner = text.slice(open + 1, k - 1);
      if (head.startsWith("@media")) walk(inner, head);
      else if (!head.startsWith("@")) {
        out.push({
          media,
          selectors: head.split(",").map((s) => s.trim().replace(/\s+/g, " ")),
          decls: decls(inner),
          // every declaration in its order, repeated ones too (a fallback
          // value before the one a browser may drop)
          list: declList(inner),
        });
      }
      pos = k;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ""), null);
  return out;
}

// The declarations that apply to one selector (later rules win) in one media
// block (null: outside of any).
export function cssDecls(rules, selector, media = null) {
  const merged = new Map();
  for (const rule of rules) {
    if (rule.media !== media || !rule.selectors.includes(selector)) continue;
    for (const [name, value] of rule.decls) merged.set(name, value);
  }
  return merged;
}

// The declarations of one selector in the order of the sheet: the rules outside
// any @media and, when `media` is given, the rules of that block, as a browser
// meets them (a later rule of the same selector wins).
export function cssCascade(rules, selector, media = null) {
  const out = [];
  for (const rule of rules) {
    if (rule.media !== null && rule.media !== media) continue;
    if (!rule.selectors.includes(selector)) continue;
    out.push(...rule.list);
  }
  return out;
}

// The value of a property that acts last in such a list: the shorthand
// "border" sets "border-color" too (its colour part), so a later shorthand
// takes the colour back (REQ-048, DESIGN-QA F3/F4).
export function cssValue(list, property) {
  let value;
  for (const [name, v] of list) {
    if (name === property) value = v;
    else if (property === "border-color" && name === "border") {
      const color = v
        .split(/\s+(?![^(]*\))/)
        .find((t) => /^(var\(|#|rgb|hsl)/.test(t));
      value = color ?? "currentcolor";
    }
  }
  return value;
}

// ------------------------------------------------------ REQ-042: state honesty

// The five words of the states, written here as literals of the criteria (not
// read from the constants under test).
export const WORDS = Object.freeze({
  in_progress: "в работе",
  stale: "нет свежих данных",
  restarted: "сервер перезапускался, события не записывались",
  completed: "закончила работу, итог не записан",
  unrecorded: "окончание не записано",
});

// The invented sample of the journal (design 9): events-*.jsonl.
export const FIXTURES = path.join(TOOLS, "test", "fixtures", "pixel-office");

export function readFixture(name) {
  const text = fs.readFileSync(path.join(FIXTURES, name), "utf8");
  const lines = text.split("\n").filter((l) => l !== "");
  return { text, lines, entries: lines.map((l) => JSON.parse(l)) };
}

// A line of the journal at an absolute moment (milliseconds), by the same
// constructor as the other tests.
export const lineAt = (kind, session, ms, extra = {}) =>
  entryOf(kind, session, iso(ms), extra);

// A record of a server start: the time and the number of lines before it.
export const startRec = (lines, ms = T0) => ({
  time: iso(ms),
  journal_lines: lines,
});
