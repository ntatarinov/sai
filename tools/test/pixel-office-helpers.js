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
export const NOW = T0 + 3600 * 1000;

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
  };
  return j;
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
    this.title = "";
    this.value = 0;
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

  get className() {
    return [...this.classes].join(" ");
  }

  get id() {
    return this.attrs.get("id") ?? "";
  }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((c) => c.textContent).join("");
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
    this._text = "";
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

  // The test calls the listeners itself.
  fire(type, event = {}) {
    const e = { target: this, type, ...event };
    for (const fn of this.listeners.get(type) ?? []) fn(e);
  }

  click(event = {}) {
    this.fire("click", event);
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
  const app = createApp({
    document: doc,
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
