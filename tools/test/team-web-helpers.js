// Helpers of the tests of the server of the business interface of Sai Team
// (design REQ-011, section 15; decisions/0020, 0024, 0025). Not a test file.
//
// Rules of these tests:
//  - every data folder and HOME are temporary (makeSandbox/execEnv/assertSafeEnv
//    of exec-helpers.js — the helper of REQ-010, criterion 13); the fake claude
//    of fixtures/team is the only executable a test may start;
//  - the server runs in the process of the test (createWebServer, port 0) or as
//    the command (node src/web/main.js --port 0); requests go to 127.0.0.1 only;
//  - fixtures are made only through the API of the core (createProject,
//    openWriter) with a clock of the test, never by writing a journal by hand;
//  - the key of the page is taken the way the page takes it: GET / and
//    meta[name="sai-page"];
//  - every refusal is checked together with the unchanged data folder
//    (snapshot of paths, modes and hashes before and after).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { readConfig } from "../src/team/config.js";
import { createProject, openWriter, readProject } from "../src/team/store.js";
import { createEngines } from "../src/web/engines.js";
import { createWebServer, loadPublicFiles } from "../src/web/server.js";
import {
  CHILD_TIMEOUT_MS,
  TOOLS_DIR,
  assertSafeEnv,
  execEnv,
  makeSandbox,
  snapshot,
} from "./exec-helpers.js";

export const WEB_SRC = path.join(TOOLS_DIR, "src", "web");
export const PUBLIC_DIR = path.join(WEB_SRC, "public");
export const MAIN_PATH = path.join(WEB_SRC, "main.js");
export const JSON_TYPE = "application/json; charset=utf-8";
export const NOT_FOUND_BODY =
  '{"error_text":"Не найдено","field":null,"reload":false}';

// In the past of every real clock (a child engine uses the real clock).
export const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);
export const MIN = 60_000;

// ---- sandbox ------------------------------------------------------------------------

// { sb, env, home }: the temporary data folder and HOME, the fake claude.
export function webSandbox(t, over = {}) {
  const sb = makeSandbox(t);
  const env = execEnv(sb, over);
  assertSafeEnv(env);
  return { sb, env, home: sb.home };
}

// ---- engines ------------------------------------------------------------------------

// Engines that start nothing: the calls are counted; `result` is the answer of
// start(). (REQ-035, design section 7) `resume` is the answer of resume(id) — its
// calls go to `resumes`; `has` is the answer of has(id) — its calls go to `asked`.
export function fakeEngines(
  result = { started: true, error: null },
  { resume = { resumed: true, error: null, late: false }, has = false } = {},
) {
  const calls = [];
  const resumes = [];
  const asked = [];
  return {
    calls,
    resumes,
    asked,
    start: async (id) => {
      calls.push(id);
      return result;
    },
    resume: async (id) => {
      resumes.push(id);
      return resume;
    },
    has: (id) => {
      asked.push(id);
      return has;
    },
    stopAll: async () => true,
    size: () => 0,
  };
}

// ---- the server in the process of the test ------------------------------------------

let publicCache = null;
export function publicFiles() {
  if (publicCache === null) publicCache = loadPublicFiles(PUBLIC_DIR);
  return publicCache;
}

// Starts createWebServer on 127.0.0.1, port 0. opts: { executor, scenario (an
// object of the scripted scenario), engines ("real" or an object), bodyIdleMs,
// env }. Returns { port, warnings, engines, close(), request(), key() }.
export async function startServer(t, box, opts = {}) {
  const env = opts.env ?? box.env;
  assertSafeEnv(env);
  const warnings = [];
  const warn = (line) => warnings.push(String(line));
  const engines =
    opts.engines === "real"
      ? createEngines({ home: box.home, env, warn })
      : (opts.engines ?? fakeEngines());
  const executor = opts.executor ?? "scripted";
  const scenarioBytes =
    executor === "scripted"
      ? Buffer.from(JSON.stringify(opts.scenario ?? { version: 1, runs: [] }))
      : null;
  const server = createWebServer({
    home: box.home,
    env,
    config: readConfig(env),
    executor,
    scenarioBytes,
    port: 0,
    publicFiles: publicFiles(),
    engines,
    warn,
    ...(opts.bodyIdleMs === undefined ? {} : { bodyIdleMs: opts.bodyIdleMs }),
  });
  const { port } = await server.listen();
  rememberAccessKey(port, server.accessKey());
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await server.close();
    await engines.stopAll(15_000);
  };
  t.after(close);
  const s = {
    port,
    warnings,
    engines,
    server,
    close,
    request: (o) => request(port, o),
    key: () => pageKey(port),
  };
  s.post = async (p, body, over = {}) => {
    const key = over.key ?? (await s.key());
    return request(port, {
      method: "POST",
      path: p,
      headers: writeHeaders(port, key, over.headers),
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  };
  s.get = (p, headers, o = {}) => request(port, { path: p, headers, ...o });
  s.accessKey = () => server.accessKey();
  return s;
}

export function writeHeaders(port, key, over = {}) {
  const h = {
    Origin: `http://127.0.0.1:${port}`,
    "Content-Type": "application/json",
    "X-Sai-Page": key,
    ...over,
  };
  for (const [k, v] of Object.entries(h)) if (v === undefined) delete h[k];
  return h;
}

// One HTTP request to 127.0.0.1:<port>. o = { method, path, headers (Host is
// 127.0.0.1:<port> unless given), body (string|Buffer), parts ([string|Buffer,
// pauseMs] sent one after another; the request is not ended unless `end`),
// end, timeoutMs }. Returns { status, headers, text, json }.
// ISS-0122: the access key of every server a test started (port -> key). A GET
// through request() carries its cookie, as the browser does after the link,
// unless the test says access: false or gives a Cookie header itself.
const ACCESS_KEYS = new Map();

export function rememberAccessKey(port, key) {
  ACCESS_KEYS.set(port, key);
}

export function accessKeyOfPort(port) {
  return ACCESS_KEYS.get(port);
}

// The access key in the line of the command, remembered for its port.
export function accessKeyOfLine(line) {
  const m = /http:\/\/127\.0\.0\.1:(\d+)\/\?k=([0-9a-f]{64})/.exec(line);
  if (m !== null) rememberAccessKey(Number(m[1]), m[2]);
  return m === null ? null : m[2];
}

export function request(port, o = {}) {
  const headers = { Host: `127.0.0.1:${port}`, ...(o.headers ?? {}) };
  if (
    o.access !== false &&
    (o.method ?? "GET") === "GET" &&
    ACCESS_KEYS.has(port) &&
    !Object.keys(headers).some((h) => h.toLowerCase() === "cookie")
  ) {
    headers.Cookie = `sai_team_web=${ACCESS_KEYS.get(port)}`;
  }
  for (const [k, v] of Object.entries(headers))
    if (v === undefined) delete headers[k];
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: o.method ?? "GET",
        path: o.path ?? "/",
        headers,
        setHost: false,
        agent: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            json = undefined;
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(o.timeoutMs ?? CHILD_TIMEOUT_MS, () =>
      req.destroy(new Error("the request timed out")),
    );
    if (o.parts !== undefined) {
      // the headers go at once, even when no part of the body follows
      req.flushHeaders();
      (async () => {
        for (const [part, pause] of o.parts) {
          req.write(part);
          if (pause > 0) await new Promise((r) => setTimeout(r, pause));
        }
        if (o.end) req.end();
      })();
      return;
    }
    if (o.body !== undefined) req.end(o.body);
    else req.end();
  });
}

// The key of the page: GET / and the content of meta[name="sai-page"].
export async function pageKey(port) {
  const r = await request(port, { path: "/" });
  assert.equal(r.status, 200);
  const m = /<meta name="sai-page" content="([0-9a-f]{64})"/.exec(r.text);
  assert.ok(m !== null, "no key in the page");
  return m[1];
}

// ---- fixtures through the API of the core -----------------------------------------

// A clock for createProject/openWriter: set(ms) fixes it; by default +1 ms.
export function clockAt(start = T0) {
  let t = start;
  let fixed = null;
  const c = () => {
    if (fixed !== null) return fixed;
    t += 1;
    return t;
  };
  c.set = (ms) => {
    fixed = ms;
    t = ms;
  };
  c.run = () => {
    fixed = null;
  };
  return c;
}

const SCENARIO = Buffer.from(JSON.stringify({ version: 1, runs: [] }));

// A project made by the core: { id, dir, events, w (open writer or null) }.
export function project(
  t,
  box,
  over = {},
  { clock = clockAt(), open = true } = {},
) {
  const executor = over.executor ?? "claude-cli";
  const input = {
    goal: over.goal ?? "Вымышленная цель проверки страницы",
    budget_usd: over.budget_usd ?? 5,
    executor,
  };
  if (executor === "scripted") input.scenario_bytes = over.scenario ?? SCENARIO;
  const { id } = createProject(input, { home: box.home, now: clock });
  const dir = path.join(box.home, id);
  let w = null;
  if (open) {
    w = openWriter(id, { home: box.home, now: clock });
    t.after(() => {
      try {
        w.close();
      } catch {
        // already closed
      }
    });
  }
  return { id, dir, events: path.join(dir, "events.jsonl"), w, clock };
}

export const eng = (type, data = {}, task = null) => ({
  source: "ENGINE",
  type,
  task,
  data,
});
export const usr = (type, data = {}, task = null) => ({
  source: "USER",
  type,
  task,
  data,
});

export const planTask = (id, role, over = {}) => ({
  id,
  role,
  text: `Вымышленная задача ${id}`,
  done_when: "Есть итог",
  depends_on: [],
  critical: false,
  ...over,
});

export function withPlan(w, tasks, parallel = 2) {
  w.append(usr("PROJECT_STARTED", { parallel }));
  w.append(eng("PLANNING_STARTED", { round: 0 }));
  w.append(eng("PLAN_RECEIVED", { round: 0, tasks }));
}

export function startRun(w, purpose, role, task = null) {
  const run_id = w.nextRunId();
  w.append(
    eng(
      "RUN_STARTED",
      {
        run_id,
        purpose,
        role,
        executor: w.state.executor,
        max_budget_usd: null,
      },
      task,
    ),
  );
  return run_id;
}

export function endRun(w, run_id, task = null, over = {}) {
  w.append(
    eng(
      "RUN_FINISHED",
      {
        run_id,
        outcome: "ok",
        summary: null,
        cost_usd: null,
        files: [],
        ...over,
      },
      task,
    ),
  );
}

export function roleOf(w, id) {
  return w.state.tasks.find((x) => x.id === id).role;
}

// The task starts and its work run ends (status running).
export function work(w, id, files = []) {
  w.append(eng("TASK_STARTED", {}, id));
  const run = startRun(w, "work", roleOf(w, id), id);
  for (const name of files) {
    w.writeResultFile({
      task: id,
      name,
      content: `Вымышленный итог ${name}\n`,
    });
  }
  endRun(w, run, id, { files });
}

// From running to review (status review).
export function toReview(w, id) {
  w.append(eng("TASK_REVIEW", {}, id));
}

// From review to done.
export function passReview(w, id) {
  const run = startRun(w, "review", "reviewer", id);
  endRun(w, run, id);
  w.append(
    eng("REVIEW_RESULT", { run_id: run, passed: true, notes: "Хорошо" }, id),
  );
  w.append(
    eng("TASK_DONE", { via: "review", external_action_done: false }, id),
  );
}

// The whole task: TASK_STARTED at `from`, TASK_DONE at `from + ms`.
export function doneIn(w, clock, id, from, ms) {
  clock.set(from);
  w.append(eng("TASK_STARTED", {}, id));
  const run = startRun(w, "work", roleOf(w, id), id);
  endRun(w, run, id);
  toReview(w, id);
  const review = startRun(w, "review", "reviewer", id);
  endRun(w, review, id);
  w.append(
    eng("REVIEW_RESULT", { run_id: review, passed: true, notes: "Хорошо" }, id),
  );
  clock.set(from + ms);
  w.append(
    eng("TASK_DONE", { via: "review", external_action_done: false }, id),
  );
}

export function fail(w, id, detail = "Попытки закончились") {
  w.append(eng("TASK_STARTED", {}, id));
  endRun(w, startRun(w, "work", roleOf(w, id), id), id, { outcome: "failed" });
  w.append(eng("TASK_FAILED", { reason: "retries_exhausted", detail }, id));
}

// An engine question in the chat (CHAT ENGINE question) about a task or the project.
export function ask(w, text, task = null) {
  return w.append(
    eng("CHAT", { text, kind: "question", truncated: false }, task),
  );
}

// ---- reading -------------------------------------------------------------------------

export function readOf(box, id) {
  return readProject(id, { home: box.home });
}

export function journalText(p) {
  return fs.readFileSync(p.events, "utf8");
}

export { snapshot };

export function dirs(home) {
  return fs.existsSync(home) ? fs.readdirSync(home).sort() : [];
}

// Every string value of a JSON value, with its path.
export function strings(value, at = "$", out = []) {
  if (typeof value === "string") out.push([at, value]);
  else if (Array.isArray(value))
    value.forEach((v, i) => strings(v, `${at}[${i}]`, out));
  else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) strings(v, `${at}.${k}`, out);
  }
  return out;
}

// ---- the command -----------------------------------------------------------------------

// node src/web/main.js <argv> as a child process. Returns { child, lines(),
// errText(), firstLine (a promise of the first stdout line or null), done }.
export function spawnWeb(t, argv, env) {
  assertSafeEnv(env);
  const child = spawn(process.execPath, [MAIN_PATH, ...argv], {
    env,
    cwd: TOOLS_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => {
    out += d;
  });
  child.stderr.on("data", (d) => {
    err += d;
  });
  const done = new Promise((resolve) => {
    child.on("exit", (code, signal) =>
      resolve({ code, signal, stdout: out, stderr: err }),
    );
  });
  const firstLine = new Promise((resolve) => {
    const look = () => {
      const i = out.indexOf("\n");
      if (i !== -1) {
        child.stdout.off("data", look);
        resolve(out.slice(0, i + 1));
      }
    };
    child.stdout.on("data", look);
    done.then(() => resolve(null));
  });
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  });
  return {
    child,
    firstLine,
    done,
    out: () => out,
    err: () => err,
  };
}

// Resolves with the value of the promise, or rejects after `ms`.
export function within(promise, ms, what) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what}: over ${ms} ms`)), ms);
    }),
  ]);
}

// ---- the words of criterion 7 ---------------------------------------------------------

const TECH_LATIN = [
  "prompt",
  "token",
  "context",
  "JSON",
  "stderr",
  "stdout",
  "exit",
  "executor",
  "run_id",
  "seq",
];
const TECH_CYRILLIC = ["токен", "контекст", "промт"];

// The problems of one text «for display» (design REQ-011, section 6.1): [] when it
// is clean. `codes` — the codes of statuses and roles to look for as words.
export function technical(text, codes = []) {
  const out = [];
  for (const w of [...TECH_LATIN, ...codes]) {
    if (new RegExp(`(^|[^A-Za-z0-9_])${w}($|[^A-Za-z0-9_])`, "i").test(text)) {
      out.push(w);
    }
  }
  for (const w of TECH_CYRILLIC)
    if (text.toLowerCase().includes(w)) out.push(w);
  if (/\bE_[A-Z_]+/.test(text)) out.push("E_…");
  if (text.includes("%")) out.push("%");
  if (/процент/i.test(text)) out.push("процент");
  return out;
}
