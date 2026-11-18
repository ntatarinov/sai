// SV: the server, the journal, the secret and the start command (design 10.2,
// REQ-001 criteria 2-9, 11; REQ-007 criterion 6). Servers run on port 0 in
// their own temporary state directory with a substitutable clock.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DEFAULT_PORT, STATE_FILES } from "../src/pixel-office/config.js";
import {
  createJournal,
  JournalReadError,
} from "../src/pixel-office/journal.js";
import { main } from "../src/pixel-office/main.js";
import { buildWriteBody } from "../src/pixel-office/protocol.js";
import { signBody } from "../src/pixel-office/protocol.js";
import { writeSmallFile } from "../src/pixel-office/state-dir.js";
import { readRule } from "../src/pixel-office/public/model.js";
import { parseLine } from "../src/pixel-office/public/schema.js";
import {
  PUBLIC,
  SRC,
  TOOLS,
  T0,
  assertSafeArgs,
  childEnv,
  freePort,
  hookInputs,
  iso,
  MASK_ROWS,
  MASK_RULE_ROWS,
  occupyPort,
  prepareState,
  request,
  runMain,
  sandbox,
  sha256File,
  spawnMain,
  startServer,
  writeBody,
} from "./pixel-office-helpers.js";

const fixedNow = () => T0;

function sb(kind, session, offsetSec, extra) {
  return writeBody(kind, session, iso(T0 + offsetSec * 1000), extra);
}

function noStack(text) {
  assert.equal(/^\s+at /m.test(text), false, `a stack trace in: ${text}`);
}

function cyrillic(text) {
  assert.match(text, /[А-Яа-яЁё]/);
}

// Everything the server can answer, for the header checks: 200, 204, 400, 401,
// 403, 404, 405, 413, 500 and an OPTIONS with Origin.
async function everyKindOfAnswer(t) {
  const srv = await startServer(t, { now: fixedNow });
  const out = [];
  const add = (r) => out.push(r);
  add(await srv.get("/api/events"));
  add(await srv.get("/"));
  add(await srv.post(sb("Stop", "s1", 0)));
  add(await srv.post(sb("Stop", "s1", 500)));
  add(await srv.post(sb("Stop", "s1", 0), { sign: false }));
  add(await srv.get("/api/events", { host: "x" }).catch(() => null));
  add(await request(srv.port, { path: "/api/events", host: "evil.example" }));
  add(await srv.get("/nothing-here"));
  add(await request(srv.port, { method: "PUT", path: "/api/events" }));
  add(await srv.post(null, { raw: "x".repeat(20000) }));
  add(
    await request(srv.port, {
      method: "OPTIONS",
      path: "/api/events",
      headers: { origin: "http://evil.example" },
    }),
  );
  fs.chmodSync(srv.eventsFile, 0o444);
  add(await srv.post(sb("Stop", "s2", 1)));
  fs.chmodSync(srv.eventsFile, 0o644);
  return { srv, out: out.filter((r) => r !== null) };
}

test("SV-01: the time tolerance is +-60000 ms; beyond it 400 time_skew and the journal does not change", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  for (const off of [-60, 60]) {
    assert.equal((await srv.post(sb("Stop", "s", off))).status, 204);
  }
  const before = srv.sha();
  for (const ms of [-60001, 60001]) {
    const r = await srv.post(writeBody("Stop", "s", iso(T0 + ms)));
    assert.equal(r.status, 400);
    assert.equal(JSON.parse(r.body).error, "time_skew");
    assert.equal(srv.sha(), before);
  }
});

test("SV-02: append only - no byte of the earlier content changes; the order is the order of acceptance", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  let previous = "";
  for (const name of ["s1", "s2", "s3"]) {
    assert.equal((await srv.post(sb("Stop", name, 0))).status, 204);
    const content = fs.readFileSync(srv.eventsFile, "utf8");
    assert.ok(content.startsWith(previous));
    assert.ok(content.length > previous.length);
    previous = content;
  }
  const ids = srv.lines().map((l) => JSON.parse(l).session_id);
  assert.deepEqual(ids, ["s1", "s2", "s3"]);
});

test("SV-03: 20 simultaneous writes with times from -59 to +59 s give 20 whole lines; the reading rule marks none", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const posts = [];
  for (let i = 0; i < 20; i++) {
    const off = -59 + Math.round((118 * i) / 19);
    posts.push(srv.post(sb("UserPromptSubmit", `sess-${i}`, off)));
  }
  for (const r of await Promise.all(posts)) assert.equal(r.status, 204);
  const lines = srv.lines();
  assert.equal(lines.length, 20);
  const entries = lines.map((l) => parseLine(JSON.parse(l)));
  assert.ok(entries.every((e) => e !== null));
  assert.deepEqual(readRule(entries, T0), new Array(20).fill(null));
});

test("SV-04: the first start with an empty directory gives an empty journal", async (t) => {
  const srv = await startServer(t);
  const r = await srv.get("/api/events");
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.equal(body.lines, 0);
  assert.deepEqual(body.events, []);
  assert.equal(body.from, 0);
});

test("SV-04b: the time that was sent is stored byte for byte", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  for (const time of [
    "2026-09-20T10:00:05.000Z",
    "2026-09-20T10:00:05.123Z",
    "2026-09-20T09:59:30.999Z",
  ]) {
    assert.equal((await srv.post(writeBody("Stop", "s", time))).status, 204);
  }
  const times = srv.lines().map((l) => JSON.parse(l).time);
  assert.deepEqual(times, [
    "2026-09-20T10:00:05.000Z",
    "2026-09-20T10:00:05.123Z",
    "2026-09-20T09:59:30.999Z",
  ]);
});

test("SV-05: a write without source gives a line with source REAL", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s", 0));
  assert.equal(JSON.parse(srv.lines()[0]).source, "REAL");
});

test("SV-06: a request with the field source is refused 400 has_source and the journal does not change", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s", 0));
  const before = srv.sha();
  for (const source of ["REAL", "SIMULATION", ""]) {
    const r = await srv.post({ ...sb("Stop", "s", 0), source });
    assert.equal(r.status, 400);
    assert.equal(JSON.parse(r.body).error, "has_source");
    assert.equal(srv.sha(), before);
  }
});

test("SV-07: the read answer has only the allowed top-level keys", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s", 0));
  const body = JSON.parse((await srv.get("/api/events?after=0")).body);
  const allowed = ["app", "lines", "from", "events", "server_starts"];
  for (const key of Object.keys(body)) assert.ok(allowed.includes(key), key);
  for (const key of ["tasks", "state", "office"]) {
    assert.equal(Object.hasOwn(body, key), false);
  }
  assert.equal(body.events.length, 1);
});

test("SV-08: the state directory holds only the files of STATE_FILES (after start, writes, restart)", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const check = () => {
    for (const f of fs.readdirSync(srv.dir)) {
      assert.ok(STATE_FILES.includes(f), `unexpected file ${f}`);
    }
  };
  check();
  await srv.post(sb("Stop", "s", 0));
  check();
  await srv.server.close();
  const again = await startServer(t, { box: srv.box, now: fixedNow });
  assert.ok(again.port > 0);
  check();
});

test("SV-09: main.js prints exactly one line with the link; GET on it gives HTML", async (t) => {
  const box = sandbox(t);
  const run = await spawnMain(t, box);
  assert.equal(run.out.stdout, `${run.link}\n`);
  const r = await request(run.port, { path: "/" });
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /text\/html/);
  assert.match(r.body, /<!doctype html>/i);
  assert.equal((await run.stop()).code, 0);
});

test("SV-10: a repeated start on the same port and directory prints the same line, code 0, one start record", async (t) => {
  const box = sandbox(t);
  const first = await spawnMain(t, box);
  const second = await runMain(box, ["--port", String(first.port)], {
    allowPorts: [first.port],
  });
  assert.equal(second.code, 0);
  assert.equal(second.stdout, `${first.link}\n`);
  const starts = fs
    .readFileSync(path.join(box.dir, "server-starts.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean);
  assert.equal(starts.length, 1);
  await first.stop();
});

async function occupied(t, kind) {
  const port = await occupyPort(t, kind);
  const box = sandbox(t);
  const t0 = performance.now();
  const r = await runMain(box, ["--port", String(port)], {
    allowPorts: [port],
  });
  const ms = performance.now() - t0;
  assert.equal(r.code, 1);
  assert.equal(r.stdout, "");
  cyrillic(r.stderr);
  noStack(r.stderr);
  return ms;
}

test("SV-11: the port is taken by another process - code 1, a Russian message, no stack trace", async (t) => {
  await occupied(t, "text");
});

test("SV-11b: the occupant accepts the connection and is silent - the check gives up within 1.5 s", async (t) => {
  const ms = await occupied(t, "silent");
  assert.ok(ms <= 1500 + 800, `took ${ms} ms`);
});

test("SV-11c: the occupant closes the connection without an answer", async (t) => {
  await occupied(t, "close");
});

test("SV-11d: the occupant answers 200 with text that is not JSON", async (t) => {
  await occupied(t, "text");
});

test("SV-11e: the occupant answers JSON without app and JSON with a foreign app", async (t) => {
  await occupied(t, "json-no-app");
  await occupied(t, "json-foreign");
});

test("SV-12: DEFAULT_PORT is the number in the README; another --port works", async (t) => {
  const readme = fs.readFileSync(path.join(TOOLS, "README.md"), "utf8");
  const m = /The default port is (\d+)/.exec(readme);
  assert.ok(m, "the README names the default port");
  assert.equal(Number(m[1]), DEFAULT_PORT);
  const run = await spawnMain(t, sandbox(t));
  assert.notEqual(run.port, DEFAULT_PORT);
  assert.equal((await request(run.port, { path: "/" })).status, 200);
  await run.stop();
});

test("SV-13: no signature, a wrong signature, a signature of another secret - 401; the journal does not change; the next GET works", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const body = sb("Stop", "s", 0);
  const text = JSON.stringify(body);
  const before = srv.sha();
  const cases = [
    { sign: false },
    { sign: "0".repeat(64) },
    {
      sign: signBody("another-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", text),
    },
  ];
  for (const c of cases) {
    const r = await srv.post(body, c);
    assert.equal(r.status, 401);
    assert.equal(srv.sha(), before);
    assert.equal((await srv.get("/api/events")).status, 200);
  }
});

test("SV-14: bad bodies are refused 400, a body over 16 KiB 413; the journal does not change; GET works", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const good = sb("Stop", "s", 0);
  const before = srv.sha();
  const bad = [
    { raw: "not json" },
    { body: { ...good, hook_event_name: "Unknown" } },
    { body: { time: good.time, hook_event_name: "Stop" } },
    { body: { time: good.time, session_id: "s" } },
    { body: { hook_event_name: "Stop", session_id: "s" } },
    { body: sb("SubagentStart", "s", 0) },
    { body: sb("PostToolUse", "s", 0, { tool_use_id: "t" }) },
    { body: { ...good, extra_key: 1 } },
    { body: { ...good, session_id: 5 } },
    { body: { ...good, session_id: "x".repeat(129) } },
    { body: { ...good, time: "2026-09-20 10:00:00" } },
    { raw: "[1,2]" },
  ];
  for (const c of bad) {
    const r = await srv.post(c.body, c);
    assert.equal(r.status, 400, JSON.stringify(c).slice(0, 80));
    assert.equal(srv.sha(), before);
  }
  const big = await srv.post(null, { raw: "x".repeat(17 * 1024) });
  assert.equal(big.status, 413);
  assert.equal(srv.sha(), before);
  assert.equal((await srv.get("/api/events")).status, 200);
});

test("SV-15: a read-only journal - POST 500 write_failed, GET 200", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  assert.equal((await srv.post(sb("Stop", "s", 0))).status, 204);
  fs.chmodSync(srv.eventsFile, 0o444);
  const before = srv.sha();
  const r = await srv.post(sb("Stop", "s2", 0));
  assert.equal(r.status, 500);
  assert.equal(JSON.parse(r.body).error, "write_failed");
  assert.equal(srv.sha(), before);
  assert.equal((await srv.get("/api/events")).status, 200);
  fs.chmodSync(srv.eventsFile, 0o600);
});

test("SV-16: a corrupted line in the middle is skipped with a warning that has its number; null in its place; neighbours are read", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s1", 0));
  fs.appendFileSync(srv.eventsFile, "{this is broken\n");
  await srv.post(sb("Stop", "s3", 0));
  const body = JSON.parse((await srv.get("/api/events?after=0")).body);
  assert.equal(body.lines, 3);
  assert.equal(body.events[1], null);
  assert.equal(body.events[0].session_id, "s1");
  assert.equal(body.events[2].session_id, "s3");
  assert.ok(srv.warnings.some((w) => w.includes("строка журнала 1")));
  assert.equal((await srv.get("/api/events")).status, 200);
});

test("SV-17: the secret is in no served file of public/ and in no GET answer, also after a write", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const files = fs.readdirSync(PUBLIC);
  assert.ok(files.length >= 10);
  for (const name of files) {
    const url = name === "index.html" ? "/" : `/${name}`;
    const r = await srv.get(url);
    assert.equal(r.status, 200, name);
    assert.equal(r.body.includes(srv.secret), false, name);
  }
  await srv.post(sb("Stop", "s", 0));
  for (const url of [
    "/api/events",
    "/api/events?after=0",
    "/api/events?after=9",
  ]) {
    assert.equal((await srv.get(url)).body.includes(srv.secret), false);
  }
});

test("SV-18: CSP on HTML, no inline anything; every script has src and type module", async (t) => {
  const srv = await startServer(t);
  const r = await srv.get("/");
  const csp = r.headers["content-security-policy"];
  assert.ok(csp.includes("default-src 'self'"));
  assert.equal(csp.includes("'unsafe-inline'"), false);
  const scripts = r.body.match(/<script\b[^>]*>/gi) ?? [];
  assert.ok(scripts.length >= 1);
  for (const s of scripts) {
    assert.match(s, /\ssrc=/);
    assert.match(s, /type="module"/);
  }
  assert.equal(/<style\b/i.test(r.body), false);
  assert.equal(/\son[a-z]+\s*=/i.test(r.body), false);
  assert.equal(/\sstyle\s*=/i.test(r.body), false);
});

test("SV-19: only POST /api/events, POST /api/note and GET are allowed; other methods 405; POST elsewhere 404 or 405; the journal does not change", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s", 0));
  const before = srv.sha();
  for (const method of ["PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]) {
    const r = await request(srv.port, { method, path: "/api/events" });
    assert.equal(r.status, 405, method);
  }
  for (const method of ["PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]) {
    const r = await request(srv.port, { method, path: "/api/note" });
    assert.equal(r.status, 405, `/api/note ${method}`);
    assert.equal(r.headers.allow, "POST", `/api/note ${method}`);
  }
  for (const p of [
    "/",
    "/app.js",
    "/api/other",
    "/api/events/x",
    "/api/note/x",
    "/api/notes",
  ]) {
    const r = await request(srv.port, {
      method: "POST",
      path: p,
      body: JSON.stringify(sb("Stop", "s", 0)),
    });
    assert.ok([404, 405].includes(r.status), `${p}: ${r.status}`);
  }
  assert.equal(srv.sha(), before);
});

test("SV-20: a signature of a wrong length or not hex is 401 without an exception; a correct one passes", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const body = sb("Stop", "s", 0);
  for (const sign of [
    "",
    "abc",
    "zz".repeat(32),
    "0".repeat(63),
    "0".repeat(65),
  ]) {
    const r = await srv.post(body, { sign });
    assert.equal(r.status, 401);
  }
  assert.deepEqual(srv.warnings, []);
  assert.equal((await srv.post(body)).status, 204);
});

test("SV-21: the server listens on 127.0.0.1 only", async (t) => {
  const seen = [];
  const original = http.Server.prototype.listen;
  http.Server.prototype.listen = function (...args) {
    seen.push(args);
    return original.apply(this, args);
  };
  let srv;
  try {
    srv = await startServer(t);
  } finally {
    http.Server.prototype.listen = original;
  }
  assert.ok(seen.length >= 1);
  assert.ok(seen.every((a) => a.includes("127.0.0.1")));
  // no other address of this computer reaches it
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      const reached = await new Promise((resolve) => {
        const s = net.connect({ host: a.address, port: srv.port });
        s.setTimeout(1500, () => {
          s.destroy();
          resolve(false);
        });
        s.on("connect", () => {
          s.destroy();
          resolve(true);
        });
        s.on("error", () => resolve(false));
      });
      assert.equal(reached, false, `reachable on ${a.address}`);
    }
  }
});

test("SV-22: Host other than 127.0.0.1:<port> or localhost:<port> gets 403 and the journal is not touched", async (t) => {
  let touched = 0;
  const stub = {
    recordStart() {},
    append() {
      touched += 1;
      throw new Error("must not be called");
    },
    read() {
      touched += 1;
      throw new Error("must not be called");
    },
    starts() {
      touched += 1;
      throw new Error("must not be called");
    },
  };
  const srv = await startServer(t, { journal: stub });
  const hosts = [
    "evil.example",
    `127.0.0.1:${srv.port + 1}`,
    "localhost",
    `0.0.0.0:${srv.port}`,
  ];
  for (const host of hosts) {
    for (const method of ["GET", "POST"]) {
      const r = await request(srv.port, { method, path: "/api/events", host });
      assert.equal(r.status, 403, `${method} ${JSON.stringify(host)}`);
    }
  }
  // an empty Host: the http client would fill it in, so it is sent raw
  for (const method of ["GET", "POST"]) {
    const answer = await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port: srv.port });
      let data = "";
      socket.on("data", (d) => (data += d));
      socket.on("close", () => resolve(data));
      socket.write(
        `${method} /api/events HTTP/1.1\r\nHost: \r\nContent-Length: 0\r\nConnection: close\r\n\r\n`,
      );
    });
    assert.match(answer, /^HTTP\/1\.1 403 /, `${method} with an empty Host`);
  }
  assert.equal(touched, 0);
  const good = await startServer(t);
  for (const host of [`127.0.0.1:${good.port}`, `localhost:${good.port}`]) {
    const r = await request(good.port, { path: "/api/events", host });
    assert.equal(r.status, 200, host);
  }
});

test("SV-23: no answer has an access-control-* header", async (t) => {
  const { out } = await everyKindOfAnswer(t);
  const statuses = new Set(out.map((r) => r.status));
  for (const s of [200, 204, 400, 401, 403, 404, 405, 413, 500]) {
    assert.ok(statuses.has(s), `status ${s} was not produced`);
  }
  for (const r of out) {
    for (const h of Object.keys(r.headers)) {
      assert.equal(h.startsWith("access-control-"), false, h);
    }
  }
});

test("SV-24: permissions - directory 0700; secret, journal, port, node-path 0600", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s", 0));
  const mode = (p) => fs.statSync(p).mode & 0o777;
  assert.equal(mode(srv.dir), 0o700);
  for (const f of ["write-secret", "events.jsonl", "port", "node-path"]) {
    assert.equal(mode(path.join(srv.dir, f)), 0o600, f);
  }
});

test("SV-25: the secret has at least 43 characters of the base64url alphabet; two first starts give different secrets", async (t) => {
  const a = await startServer(t);
  const b = await startServer(t);
  for (const s of [a.secret, b.secret]) {
    assert.match(s, /^[A-Za-z0-9_-]{43,}$/);
  }
  assert.notEqual(a.secret, b.secret);
  assert.equal(
    fs.readFileSync(path.join(a.dir, "write-secret"), "utf8").trim(),
    a.secret,
  );
});

test("SV-26: a restart keeps the secret; port and node-path are updated", async (t) => {
  const first = await startServer(t);
  const portBefore = fs.readFileSync(path.join(first.dir, "port"), "utf8");
  await first.server.close();
  fs.writeFileSync(path.join(first.dir, "node-path"), "/old/node\n");
  const second = await startServer(t, { box: first.box });
  assert.equal(second.secret, first.secret);
  const portNow = fs.readFileSync(path.join(second.dir, "port"), "utf8");
  assert.equal(portNow.trim(), String(second.port));
  assert.ok(portBefore.trim() !== "" && portNow.trim() !== "");
  assert.equal(
    fs.readFileSync(path.join(second.dir, "node-path"), "utf8").trim(),
    process.execPath,
  );
});

test("SV-27: the secret is in neither stdout nor stderr of the start command", async (t) => {
  const box = sandbox(t);
  const run = await spawnMain(t, box);
  const secret = fs
    .readFileSync(path.join(box.dir, "write-secret"), "utf8")
    .trim();
  await run.stop();
  assert.equal(run.out.stdout.includes(secret), false);
  assert.equal(run.out.stderr.includes(secret), false);
});

test("SV-28: without --dir the directory is ~/.sai-pixel-office of the (temporary) HOME with the right permissions", async (t) => {
  const box = sandbox(t);
  const env = { PATH: process.env.PATH, HOME: box.home };
  const run = await spawnMain(t, box, [], { env });
  const dir = path.join(box.home, ".sai-pixel-office");
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(dir, "write-secret")).mode & 0o777, 0o600);
  await run.stop();
});

test("SV-29: permissions wider than needed are narrowed (0755 -> 0700, 0644 -> 0600) and the secret is kept", async (t) => {
  const box = sandbox(t);
  fs.mkdirSync(box.dir, { mode: 0o755 });
  fs.chmodSync(box.dir, 0o755);
  const secretFile = path.join(box.dir, "write-secret");
  const secret = "Z".repeat(50);
  fs.writeFileSync(secretFile, `${secret}\n`);
  fs.chmodSync(secretFile, 0o644);
  const run = await spawnMain(t, box);
  assert.equal(fs.statSync(box.dir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(secretFile).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(secretFile, "utf8").trim(), secret);
  await run.stop();
});

test("SV-30: the state directory is a link or a file - a message, code 1, nothing created", async (t) => {
  // a file
  const box = sandbox(t);
  fs.writeFileSync(box.dir, "i am a file");
  let r = await runMain(box);
  assert.equal(r.code, 1);
  cyrillic(r.stderr);
  noStack(r.stderr);
  assert.equal(fs.readFileSync(box.dir, "utf8"), "i am a file");
  // a link to a folder
  const box2 = sandbox(t);
  const target = path.join(box2.root, "target");
  fs.mkdirSync(target);
  fs.symlinkSync(target, box2.dir);
  r = await runMain(box2);
  assert.equal(r.code, 1);
  cyrillic(r.stderr);
  assert.deepEqual(fs.readdirSync(target), []);
});

test("SV-31: a secret shorter than 43 characters - a message, code 1, the file is not changed", async (t) => {
  const box = sandbox(t);
  fs.mkdirSync(box.dir, { mode: 0o700 });
  const file = path.join(box.dir, "write-secret");
  fs.writeFileSync(file, "too-short\n", { mode: 0o600 });
  const before = sha256File(file);
  const r = await runMain(box);
  assert.equal(r.code, 1);
  cyrillic(r.stderr);
  noStack(r.stderr);
  assert.equal(sha256File(file), before);
  assert.deepEqual(fs.readdirSync(box.dir), ["write-secret"]);
});

test("SV-32: each start records {time, journal_lines} with the number of lines at that moment; GET gives them in order", async (t) => {
  const first = await startServer(t, { now: fixedNow });
  await first.post(sb("Stop", "s1", 0));
  await first.post(sb("Stop", "s2", 0));
  await first.server.close();
  const second = await startServer(t, { box: first.box, now: () => T0 + 5000 });
  const body = JSON.parse((await second.get("/api/events")).body);
  assert.deepEqual(body.server_starts, [
    { time: iso(T0), journal_lines: 0 },
    { time: iso(T0 + 5000), journal_lines: 2 },
  ]);
});

test("SV-33: the cursor - after=N gives only the new lines with from = N; a bad after reads from 0; limit rules", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  for (const s of ["a", "b", "c", "d"]) await srv.post(sb("Stop", s, 0));
  const read = async (q) => JSON.parse((await srv.get(`/api/events${q}`)).body);
  let b = await read("?after=2");
  assert.equal(b.from, 2);
  assert.deepEqual(
    b.events.map((e) => e.session_id),
    ["c", "d"],
  );
  for (const q of ["?after=99", "?after=abc", "?after=-1", "?after=1.5", ""]) {
    b = await read(q);
    assert.equal(b.from, 0, q);
    assert.equal(b.events.length, 4, q);
  }
  b = await read("?after=0&limit=0");
  assert.deepEqual(b.events, []);
  assert.equal(b.lines, 4);
  for (const q of ["?after=0&limit=-1", "?after=0&limit=abc"]) {
    assert.equal((await srv.get(`/api/events${q}`)).status, 400, q);
  }
});

test("SV-34: an outside edit (cut, appended) keeps GET consistent; a torn tail is not a line; the next write starts with a line break", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s1", 0));
  await srv.post(sb("Stop", "s2", 0));
  const lines = async () =>
    JSON.parse((await srv.get("/api/events?after=0")).body);
  assert.equal((await lines()).lines, 2);
  fs.appendFileSync(srv.eventsFile, '{"time":"torn');
  assert.equal((await lines()).lines, 2);
  await srv.post(sb("Stop", "s3", 0));
  const raw = fs.readFileSync(srv.eventsFile, "utf8");
  assert.ok(raw.includes('{"time":"torn\n{'));
  const b = await lines();
  assert.equal(b.lines, 4);
  assert.equal(b.events[2], null);
  assert.equal(b.events[3].session_id, "s3");
  const firstLine = raw.split("\n")[0];
  fs.writeFileSync(srv.eventsFile, `${firstLine}\n`);
  const cut = await lines();
  assert.equal(cut.lines, 1);
  assert.equal(cut.events[0].session_id, "s1");
});

test("SV-35: an exception inside the handler gives 500 without a trace; the next request is served", async (t) => {
  let calls = 0;
  const real = { lines: 0 };
  const stub = {
    recordStart() {},
    starts: () => [],
    read() {
      calls += 1;
      if (calls === 1) throw new TypeError("boom inside");
      return { lines: real.lines, from: 0, events: [] };
    },
    append() {},
  };
  const srv = await startServer(t, { journal: stub });
  const r = await srv.get("/api/events");
  assert.equal(r.status, 500);
  noStack(r.body);
  assert.equal(r.body.includes("boom inside"), false);
  assert.ok(srv.warnings.length >= 1);
  assert.equal((await srv.get("/api/events")).status, 200);
});

test("SV-36: static files - foreign names are 404, real ones 200 with their types, a 300-character name is 404 with empty stderr, the 64-character limit", async (t) => {
  const srv = await startServer(t);
  for (const p of [
    "/../package.json",
    "/%2e%2e/package.json",
    "/.hidden",
    "/a/b.js",
    "/x.exe",
    "/readme.txt",
  ]) {
    assert.equal((await srv.get(p)).status, 404, p);
  }
  for (const [p, type] of [
    ["/", "text/html"],
    ["/app.js", "text/javascript"],
    ["/style.css", "text/css"],
  ]) {
    const r = await srv.get(p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers["content-type"], new RegExp(type));
  }
  const long = await srv.get(`/${"a".repeat(300)}.js`);
  assert.equal(long.status, 404);
  assert.deepEqual(srv.warnings, []);
  // the limit of 64 characters with the extension
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "po-pub-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ok = `${"b".repeat(61)}.js`;
  fs.writeFileSync(path.join(dir, ok), "// ok\n");
  fs.writeFileSync(path.join(dir, `${"c".repeat(62)}.js`), "// too long\n");
  const lim = await startServer(t, { publicDir: dir });
  assert.equal(ok.length, 64);
  assert.equal((await lim.get(`/${ok}`)).status, 200);
  assert.equal((await lim.get(`/${"c".repeat(62)}.js`)).status, 404);
  assert.deepEqual(lim.warnings, []);
});

test("SV-37: nosniff and no-store on every answer", async (t) => {
  const { out } = await everyKindOfAnswer(t);
  for (const r of out) {
    assert.equal(r.headers["x-content-type-options"], "nosniff", r.status);
    assert.equal(r.headers["cache-control"], "no-store", r.status);
  }
});

test("SV-38: a failed write of the start record, port or node-path at start - code 1, the port is released", async (t) => {
  for (const name of ["server-starts.jsonl", "port", "node-path"]) {
    const box = sandbox(t);
    fs.mkdirSync(box.dir, { mode: 0o700 });
    fs.mkdirSync(path.join(box.dir, name));
    const port = await freePort();
    const r = await runMain(box, ["--port", String(port)], {
      allowPorts: [port],
    });
    assert.equal(r.code, 1, name);
    cyrillic(r.stderr);
    noStack(r.stderr);
    const probe = net.createServer();
    await new Promise((res, rej) => {
      probe.once("error", rej);
      probe.listen(port, "127.0.0.1", res);
    });
    await new Promise((res) => probe.close(res));
  }
});

function memoryIo(extra = {}) {
  const io = {
    out: { write: (s) => (io.stdout += s) },
    err: { write: (s) => (io.stderr += s) },
    stdout: "",
    stderr: "",
    ...extra,
  };
  return io;
}

test("SV-39: not Node 22 - a refusal with the version, code 1, nothing created", async (t) => {
  for (const version of ["21.7.0", "25.2.1"]) {
    const box = sandbox(t);
    const io = memoryIo({ nodeVersion: version });
    const code = await main(["--port", "0"], childEnv(box), io);
    assert.equal(code, 1);
    assert.ok(io.stderr.includes(version));
    assert.equal(io.stdout, "");
    assert.equal(fs.existsSync(box.dir), false);
  }
});

test("SV-40b: the helper refuses any port argument but 0 and a missing one", () => {
  assert.throws(() => assertSafeArgs(["--port", "4780"]));
  assert.throws(() => assertSafeArgs(["--port=4780"]));
  assert.throws(() => assertSafeArgs(["--port", "4780"], [4780]));
  assert.throws(() => assertSafeArgs(["--port", "0", "--port", "4780"]));
  assert.throws(() => assertSafeArgs(["--dir", "/x"]));
  assert.throws(() => assertSafeArgs([]));
  assertSafeArgs(["--port", "0"]);
  assertSafeArgs(["--port=0", "--dir", "/x"]);
});

test("SV-40: wrong arguments - the usage line, code 2", async (t) => {
  const box = sandbox(t);
  for (const argv of [
    ["--port", "abc"],
    ["--port", "70000"],
    ["--port"],
    ["--port", "0", "--bogus"],
    ["--port", "0", "extra"],
    ["--port", "0", "--dir", "relative/path"],
  ]) {
    assertSafeArgs(argv);
    const io = memoryIo();
    const code = await main(argv, childEnv(box), io);
    assert.equal(code, 2, argv.join(" "));
    assert.ok(io.stderr.includes("Использование"));
    assert.equal(fs.existsSync(box.dir), false);
  }
});

test("SV-41: the state directory removed while running - GET gives an empty journal, POST 500, the process lives", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s", 0));
  fs.rmSync(srv.dir, { recursive: true, force: true });
  const g = await srv.get("/api/events");
  assert.equal(g.status, 200);
  assert.equal(JSON.parse(g.body).lines, 0);
  // another body: the same bytes again would be a replay (409, ISS-0123)
  const p = await srv.post(sb("Stop", "s", 1));
  assert.equal(p.status, 500);
  assert.equal((await srv.get("/api/events")).status, 200);
});

test("SV-42: SIGTERM - code 0 and the port is released", async (t) => {
  const run = await spawnMain(t, sandbox(t));
  // the server answers: the handlers of the signals are certainly in place
  assert.equal((await request(run.port, { path: "/" })).status, 200);
  const result = await run.stop();
  assert.equal(result.code, 0);
  const closed = await new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port: run.port });
    s.on("connect", () => {
      s.destroy();
      resolve(false);
    });
    s.on("error", () => resolve(true));
  });
  assert.equal(closed, true);
});

test("SV-43: an unexpected error in main - 'внутренняя ошибка', code 1, no trace", async (t) => {
  const box = sandbox(t);
  const io = memoryIo({
    out: {
      write() {
        throw new Error("the output is broken");
      },
    },
  });
  const code = await main(["--port", "0"], childEnv(box), io);
  assert.equal(code, 1);
  assert.ok(io.stderr.includes("внутренняя ошибка"));
  noStack(io.stderr);
});

test("SV-44: an unreadable journal or start file - GET 500 read_failed, the server lives, after the permissions return 200; starts() throws JournalReadError on a read failure and gives [] when the file is absent", async (t) => {
  for (const name of ["events.jsonl", "server-starts.jsonl"]) {
    // 1. no permission to read
    const srv = await startServer(t, { now: fixedNow });
    await srv.post(sb("Stop", "s", 0));
    const file = path.join(srv.dir, name);
    fs.chmodSync(file, 0o000);
    const bad = await srv.get("/api/events?after=0");
    assert.equal(bad.status, 500, name);
    assert.equal(JSON.parse(bad.body).error, "read_failed");
    fs.chmodSync(file, 0o600);
    assert.equal((await srv.get("/api/events?after=0")).status, 200);
    // 2. a directory instead of the file
    fs.rmSync(file);
    fs.mkdirSync(file);
    const dirCase = await srv.get("/api/events?after=0");
    assert.equal(dirCase.status, 500, `${name} as a directory`);
    fs.rmdirSync(file);
    assert.equal((await srv.get("/api/events?after=0")).status, 200);
  }
  const box = sandbox(t);
  prepareState(box);
  const j = createJournal(box.dir, { warn() {} });
  assert.deepEqual(j.starts(), []);
  const startsFile = path.join(box.dir, "server-starts.jsonl");
  fs.writeFileSync(startsFile, "{}\n");
  fs.chmodSync(startsFile, 0o000);
  assert.throws(() => j.starts(), JournalReadError);
  fs.chmodSync(startsFile, 0o600);
});

test("SV-45: --dir that differs from the default and from SAI_PIXEL_OFFICE_DIR warns in Russian; otherwise no warning", async (t) => {
  const box = sandbox(t);
  const other = path.join(box.root, "other-state");
  const differs = await spawnMain(t, box, ["--dir", other]);
  assert.equal(differs.out.stdout, `${differs.link}\n`);
  cyrillic(differs.out.stderr);
  assert.ok(differs.out.stderr.includes("SAI_PIXEL_OFFICE_DIR"));
  assert.equal((await differs.stop()).code, 0);
  for (const args of [[], ["--dir", box.dir]]) {
    const same = await spawnMain(t, box, args);
    assert.equal(same.out.stderr, "", args.join(" "));
    assert.equal(same.out.stdout, `${same.link}\n`);
    await same.stop();
  }
});

async function waitFor(fn, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timeout waiting");
}

test("SV-46: B1 - the reader of stderr is gone: the process survives every warning and ends with code 0", async (t) => {
  const box = sandbox(t);
  const run = await spawnMain(t, box);
  run.child.stderr.destroy();
  const secret = fs
    .readFileSync(path.join(box.dir, "write-secret"), "utf8")
    .trim();
  const alive = async () => {
    const r = await request(run.port, { path: "/api/events?after=0&limit=0" });
    assert.equal(r.status, 200);
  };
  await alive();
  assert.equal(
    (await request(run.port, { path: `/${"a".repeat(300)}.js` })).status,
    404,
  );
  await alive();
  const file = path.join(box.dir, "events.jsonl");
  fs.appendFileSync(file, "{broken line\n");
  assert.equal(
    (await request(run.port, { path: "/api/events?after=0" })).status,
    200,
  );
  await alive();
  fs.chmodSync(file, 0o444);
  const text = JSON.stringify(writeBody("Stop", "s", iso(Date.now())));
  const post = await request(run.port, {
    method: "POST",
    path: "/api/events",
    headers: {
      "content-type": "application/json",
      "x-pixel-office-signature": signBody(secret, text),
    },
    body: text,
  });
  assert.equal(post.status, 500);
  await alive();
  fs.chmodSync(file, 0o600);
  assert.equal((await run.stop()).code, 0);
});

test("SV-47: B1 - the reader of stdout is closed before the line with the link: the process survives and ends with code 0", async (t) => {
  const box = sandbox(t);
  const child = spawn(
    process.execPath,
    [path.join(SRC, "main.js"), "--port", "0"],
    {
      env: childEnv(box),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  });
  child.stdout.destroy();
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d));
  const done = new Promise((resolve) =>
    child.on("close", (code) => resolve(code)),
  );
  const port = await waitFor(() => {
    try {
      return Number(fs.readFileSync(path.join(box.dir, "port"), "utf8"));
    } catch {
      return 0;
    }
  });
  const r = await request(port, { path: "/api/events?after=0&limit=0" });
  assert.equal(r.status, 200);
  child.kill("SIGTERM");
  assert.equal(await done, 0);
  assert.equal(stderr.includes("Unhandled 'error' event"), false);
  noStack(stderr);
});

test("SV-48: F3 - links in place of the state files: a clear message or no write; the targets are not touched", async (t) => {
  const textTarget = (box, name, content = "just text\n") => {
    const p = path.join(box.root, name);
    fs.writeFileSync(p, content);
    fs.chmodSync(p, 0o644);
    return p;
  };
  // (a) write-secret is a link to a text file with mode 0644
  {
    const box = sandbox(t);
    fs.mkdirSync(box.dir, { mode: 0o700 });
    const target = textTarget(box, "target-secret", `${"Q".repeat(60)}\n`);
    fs.symlinkSync(target, path.join(box.dir, "write-secret"));
    const before = sha256File(target);
    const r = await runMain(box);
    assert.equal(r.code, 1);
    cyrillic(r.stderr);
    noStack(r.stderr);
    assert.equal(fs.statSync(target).mode & 0o777, 0o644);
    assert.equal(sha256File(target), before);
  }
  // (b) events.jsonl becomes a link while the server runs: POST 500
  // write_failed, GET 500 read_failed, the server lives
  {
    const box = sandbox(t);
    const target = textTarget(box, "target-events");
    const srv = await startServer(t, { box, now: fixedNow });
    fs.symlinkSync(target, path.join(box.dir, "events.jsonl"));
    const before = sha256File(target);
    const post = await srv.post(sb("Stop", "s", 0));
    assert.equal(post.status, 500);
    assert.equal(JSON.parse(post.body).error, "write_failed");
    assert.equal(sha256File(target), before);
    const get = await srv.get("/api/events?after=0");
    assert.equal(get.status, 500);
    assert.equal(JSON.parse(get.body).error, "read_failed");
    assert.equal((await srv.get("/")).status, 200);
  }
  // (b2) events.jsonl is a link at the start: a clear message, the target is
  // not touched
  {
    const box = sandbox(t);
    fs.mkdirSync(box.dir, { mode: 0o700 });
    const target = textTarget(box, "target-events2");
    fs.symlinkSync(target, path.join(box.dir, "events.jsonl"));
    const before = sha256File(target);
    const r = await runMain(box);
    assert.equal(r.code, 1);
    cyrillic(r.stderr);
    noStack(r.stderr);
    assert.equal(sha256File(target), before);
  }
  // (c) server-starts.jsonl is a link: the start refuses
  {
    const box = sandbox(t);
    fs.mkdirSync(box.dir, { mode: 0o700 });
    const target = textTarget(box, "target-starts");
    fs.symlinkSync(target, path.join(box.dir, "server-starts.jsonl"));
    const before = sha256File(target);
    const r = await runMain(box);
    assert.equal(r.code, 1);
    assert.equal(sha256File(target), before);
  }
  // (d) port and node-path are links: the start replaces them with files
  {
    const box = sandbox(t);
    fs.mkdirSync(box.dir, { mode: 0o700 });
    const portTarget = textTarget(box, "target-port");
    const nodeTarget = textTarget(box, "target-node");
    fs.symlinkSync(portTarget, path.join(box.dir, "port"));
    fs.symlinkSync(nodeTarget, path.join(box.dir, "node-path"));
    const run = await spawnMain(t, box);
    for (const [name, target] of [
      ["port", portTarget],
      ["node-path", nodeTarget],
    ]) {
      assert.ok(fs.lstatSync(path.join(box.dir, name)).isFile(), name);
      assert.equal(fs.readFileSync(target, "utf8"), "just text\n");
    }
    await run.stop();
  }
  // (e) a link in place of the temporary file of writeSmallFile
  {
    const box = sandbox(t);
    fs.mkdirSync(box.dir, { mode: 0o700 });
    const target = textTarget(box, "target-tmp");
    const tmp = path.join(box.dir, `port.tmp-${process.pid}`);
    fs.symlinkSync(target, tmp);
    writeSmallFile(box.dir, "port", "4242\n");
    assert.equal(fs.readFileSync(target, "utf8"), "just text\n");
    assert.ok(fs.lstatSync(path.join(box.dir, "port")).isFile());
    assert.equal(fs.readFileSync(path.join(box.dir, "port"), "utf8"), "4242\n");
    assert.equal(fs.existsSync(tmp), false);
  }
});

test("SV-49: F3 - a link inside public/ is not served; ordinary files are", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "po-pub-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "po-out-"));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const secretText = "text outside of public";
  const target = path.join(outside, "outside.txt");
  fs.writeFileSync(target, secretText);
  fs.symlinkSync(target, path.join(dir, "leak.js"));
  fs.symlinkSync(target, path.join(dir, "style.css"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><p>ok</p>");
  fs.writeFileSync(path.join(dir, "real.js"), "// real\n");
  const srv = await startServer(t, { publicDir: dir });
  for (const p of ["/leak.js", "/style.css"]) {
    const r = await srv.get(p);
    assert.equal(r.status, 404, p);
    assert.equal(r.body.includes(secretText), false);
  }
  assert.deepEqual(srv.warnings, []);
  assert.equal((await srv.get("/real.js")).status, 200);
  assert.equal((await srv.get("/")).status, 200);
});

test("SV-50: F6 - 40 repeated 413 on one connection: all 413, no MaxListenersExceededWarning, one timeout handler per socket, journal unchanged", async (t) => {
  const warnings = [];
  const onWarning = (w) => warnings.push(w.name);
  process.on("warning", onWarning);
  const perSocket = new Map();
  const original = net.Socket.prototype.setTimeout;
  net.Socket.prototype.setTimeout = function (ms, cb) {
    if (typeof cb === "function") {
      perSocket.set(this, (perSocket.get(this) ?? 0) + 1);
    }
    return original.call(this, ms, cb);
  };
  t.after(() => {
    process.off("warning", onWarning);
    net.Socket.prototype.setTimeout = original;
  });
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s", 0));
  const before = srv.sha();
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  t.after(() => agent.destroy());
  const body = "x".repeat(20000);
  for (let i = 0; i < 40; i++) {
    const status = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port: srv.port,
          method: "POST",
          path: "/api/events",
          agent,
          headers: { "content-length": Buffer.byteLength(body) },
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        },
      );
      req.on("error", reject);
      req.end(body);
    });
    assert.equal(status, 413, `request ${i}`);
  }
  assert.equal(warnings.includes("MaxListenersExceededWarning"), false);
  assert.deepEqual(srv.warnings, []);
  agent.destroy();
  // no socket got more than one timeout handler
  assert.ok(perSocket.size >= 1, "the drain timeout was set");
  for (const n of perSocket.values()) assert.ok(n <= 1, `handlers: ${n}`);
  assert.equal(srv.sha(), before);
  assert.equal((await srv.get("/api/events")).status, 200);
});

// A raw HTTP exchange: the client keeps sending the body after the 413.
function rawPost(port, contentLength) {
  const socket = net.connect({ host: "127.0.0.1", port });
  const state = { data: "", closed: false, error: null, socket };
  socket.on("data", (d) => (state.data += d));
  socket.on("close", () => (state.closed = true));
  socket.on("error", (e) => (state.error = e));
  socket.write(
    `POST /api/events HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nContent-Length: ${contentLength}\r\n\r\n`,
  );
  return state;
}

const tick = () => new Promise((r) => setImmediate(r));

async function until(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return false;
}

test("SV-51: 413 at once, the rest of the body is read; no ECONNRESET; no Connection: close; closed after 8 MiB or 5 s without data", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  await srv.post(sb("Stop", "s", 0));
  const before = srv.sha();
  for (const total of [1024 * 1024, 17 * 1024, 20 * 1024]) {
    const c = rawPost(srv.port, total);
    const chunk = Buffer.alloc(Math.min(total, 8192), 97);
    let sent = 0;
    while (sent < total && !c.error) {
      const n = Math.min(chunk.length, total - sent);
      c.socket.write(chunk.subarray(0, n));
      sent += n;
      await tick();
    }
    assert.equal(
      await until(() => c.data.includes("HTTP/1.1 413")),
      true,
      `${total}`,
    );
    assert.equal(c.error, null, `${total}: ${c.error}`);
    assert.equal(/connection:\s*close/i.test(c.data), false);
    c.socket.destroy();
  }
  // after 8 MiB of the rest the connection is closed
  const big = rawPost(srv.port, 64 * 1024 * 1024);
  const piece = Buffer.alloc(1024 * 1024, 98);
  let sentMiB = 0;
  while (!big.closed && sentMiB < 40) {
    if (!big.socket.destroyed) big.socket.write(piece);
    sentMiB += 1;
    await until(() => big.closed, 50);
  }
  assert.equal(await until(() => big.closed, 5000), true);
  assert.ok(big.data.includes("HTTP/1.1 413"));
  assert.ok(sentMiB < 40, `still open after ${sentMiB} MiB`);
  // 5 seconds without data close it too
  const idle = rawPost(srv.port, 1024 * 1024);
  idle.socket.write(Buffer.alloc(1000, 99));
  assert.equal(await until(() => idle.closed, 7500), true);
  assert.equal(srv.sha(), before);
  assert.equal((await srv.get("/api/events")).status, 200);
});

test("SV-52: the number in the warning about a corrupted line counts from 0; one warning per number; the same for start records", async (t) => {
  const srv = await startServer(t, {
    now: fixedNow,
    setup: (box) => {
      const good = JSON.stringify({
        ...writeBody("Stop", "s", iso(T0)),
        source: "REAL",
      });
      fs.writeFileSync(
        path.join(box.dir, "events.jsonl"),
        `${good}\n{bad\n${good}\n`,
      );
      fs.writeFileSync(
        path.join(box.dir, "server-starts.jsonl"),
        `${JSON.stringify({ time: iso(T0), journal_lines: 0 })}\nnot json\n`,
      );
    },
  });
  for (let i = 0; i < 3; i++) await srv.get("/api/events?after=0");
  const lineWarnings = srv.warnings.filter((w) => w.includes("строка журнала"));
  assert.deepEqual(lineWarnings, [
    "Pixel Office: строка журнала 1 испорчена и пропущена",
  ]);
  const startWarnings = srv.warnings.filter((w) =>
    w.includes("запись запуска"),
  );
  assert.deepEqual(startWarnings, [
    "Pixel Office: запись запуска сервера 1 испорчена и пропущена",
  ]);
});

test("SV-53: unknown_key:<name> echoes only plain names of 1-40 characters; others give unknown_key:?; an unsigned request does not learn the name", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const base = sb("Stop", "s", 0);
  const answer = async (key, o) => {
    const r = await srv.post({ ...base, [key]: 1 }, o);
    return { status: r.status, body: JSON.parse(r.body) };
  };
  let r = await answer("foo_Bar-9");
  assert.equal(r.status, 400);
  assert.deepEqual(r.body, { error: "unknown_key:foo_Bar-9" });
  r = await answer("a".repeat(40));
  assert.equal(r.body.error, `unknown_key:${"a".repeat(40)}`);
  for (const key of ["<b>x</b>", "has space", "a".repeat(41), "x.y", ""]) {
    r = await answer(key);
    assert.equal(r.status, 400);
    assert.deepEqual(r.body, { error: "unknown_key:?" }, JSON.stringify(key));
  }
  r = await answer("foo", { sign: false });
  assert.equal(r.status, 401);
  assert.equal(JSON.stringify(r.body).includes("foo"), false);
});

test("SV-54: allowed keys at every kind - Stop with description and SessionStart with subagent_type are accepted; missing keys are named; hook never emits such keys", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  let r = await srv.post(sb("Stop", "s", 0, { description: "d" }));
  assert.equal(r.status, 204);
  r = await srv.post(
    sb("SessionStart", "s", 0, { subagent_type: "general-purpose" }),
  );
  assert.equal(r.status, 204);
  for (const line of srv.lines()) {
    assert.ok(parseLine(JSON.parse(line)) !== null);
  }
  const miss = async (kind, extra, error) => {
    const res = await srv.post(sb(kind, "s", 0, extra));
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).error, error);
  };
  await miss("PostToolUse", { launched_agent_id: "a" }, "missing:tool_use_id");
  await miss("PostToolUse", { tool_use_id: "t" }, "missing:launched_agent_id");
  await miss("SubagentStart", {}, "missing:agent_id");
  await miss("Stop", { not_in_table: "x" }, "unknown_key:not_in_table");
  // the hook never produces such keys for the other kinds
  const input = {
    ...hookInputs().Stop,
    tool_input: { description: "d", subagent_type: "x" },
  };
  const built = buildWriteBody(input, iso(T0));
  assert.equal(Object.hasOwn(built, "description"), false);
  assert.equal(Object.hasOwn(built, "subagent_type"), false);
});

test("SV-42b: the handlers of SIGINT and SIGTERM are in place before the link is printed - start, read the link, SIGTERM at once, 12 times: always code 0, never a signal", async (t) => {
  for (let i = 0; i < 12; i++) {
    const run = await spawnMain(t, sandbox(t));
    const result = await run.stop();
    assert.equal(result.signal, null, `run ${i}: ended by ${result.signal}`);
    assert.equal(result.code, 0, `run ${i}`);
  }
});

// ------------------------------------------------------------ REQ-008 (a)

const owner = (session, offsetSec, text = "сделай X") =>
  sb("UserPromptSubmit", session, offsetSec, {
    prompt_kind: "owner",
    prompt_text: text,
  });

// The journal after a request: lines as objects.
const journalOf = (srv) => srv.lines().map((l) => JSON.parse(l));

// A refusal changes nothing: the sha256 and the number of lines of the journal.
async function refused(srv, send, status, error) {
  const sha = srv.sha();
  const count = srv.lines().length;
  const r = await send();
  assert.equal(r.status, status, `${r.body}`);
  if (error !== undefined) assert.equal(JSON.parse(r.body).error, error);
  assert.equal(srv.sha(), sha, "the journal changed");
  assert.equal(srv.lines().length, count);
  return r;
}

test("SV-55: /api/events refuses wrong prompt fields, fields of the orchestrator and any source - 400, the journal does not change", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  assert.equal((await srv.post(owner("s1", 0))).status, 204);
  const base = (extra) => sb("UserPromptSubmit", "s1", 1, extra);
  const cases = {
    "prompt_text not a string": base({ prompt_kind: "owner", prompt_text: 5 }),
    "prompt_text 4001": base({
      prompt_kind: "owner",
      prompt_text: "а".repeat(4001),
    }),
    "prompt_text empty": base({ prompt_kind: "owner", prompt_text: "" }),
    "prompt_text of a Stop": sb("Stop", "s1", 1, {
      prompt_kind: "owner",
      prompt_text: "x",
    }),
    "prompt_kind of a Stop": sb("Stop", "s1", 1, { prompt_kind: "owner" }),
    "prompt_truncated of a Stop": sb("Stop", "s1", 1, {
      prompt_truncated: true,
    }),
    "prompt_text of a service": base({
      prompt_kind: "service",
      prompt_text: "x",
    }),
    "prompt_text without kind": base({ prompt_text: "x" }),
    "prompt_kind outside": base({ prompt_kind: "admin" }),
    "prompt_truncated without text": base({
      prompt_kind: "owner",
      prompt_truncated: true,
    }),
    "prompt_truncated false": base({
      prompt_kind: "owner",
      prompt_text: "x",
      prompt_truncated: false,
    }),
    note_text: base({ note_text: "x" }),
    req_id: base({ req_id: "REQ-008" }),
    request_time: base({ request_time: iso(T0) }),
    request_time_auto: base({ request_time_auto: true }),
    "source ORCH": base({ source: "ORCH" }),
    "source REAL": base({ source: "REAL" }),
    "source empty": base({ source: "" }),
    "source SIMULATION": base({ source: "SIMULATION" }),
  };
  for (const [name, body] of Object.entries(cases)) {
    await refused(srv, () => srv.post(body), 400);
    assert.ok(name);
  }
  // A note as a body: no hook_event_name.
  await refused(
    srv,
    () => srv.post({ time: iso(T0), source: "ORCH", note_text: "x" }),
    400,
  );
  const sha = srv.sha();
  assert.equal(srv.lines().length, 1);
  assert.equal(srv.sha(), sha);
});

test("SV-56: the body of /api/note on /api/events is 400 and no ORCH line appears", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  assert.equal((await srv.post(owner("s1", 0))).status, 204);
  for (const body of [
    { note_text: "как понял", req_id: "REQ-008" },
    { note_text: "как понял", session_id: "s1", request_time: iso(T0) },
    { time: iso(T0), source: "ORCH", note_text: "x" },
  ]) {
    await refused(srv, () => srv.post(body), 400);
  }
  for (const line of journalOf(srv)) assert.notEqual(line.source, "ORCH");
});

test("SV-57: a correct owner message on /api/events is 204; the line has source REAL, the time of the body and the prompt fields", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const r = await srv.post(
    sb("UserPromptSubmit", "s1", 0, {
      prompt_kind: "owner",
      prompt_text: "сделай X",
      prompt_truncated: true,
    }),
  );
  assert.equal(r.status, 204);
  assert.equal(r.body, "");
  const lines = journalOf(srv);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], {
    time: iso(T0),
    source: "REAL",
    hook_event_name: "UserPromptSubmit",
    session_id: "s1",
    prompt_kind: "owner",
    prompt_text: "сделай X",
    prompt_truncated: true,
  });
  const service = await srv.post(
    sb("UserPromptSubmit", "s1", 1, { prompt_kind: "service" }),
  );
  assert.equal(service.status, 204);
  assert.equal(journalOf(srv)[1].prompt_kind, "service");
});

test("SV-60: both write paths - 401, 403, 405 with Allow, 413 in one table; /api/note field table; an accepted note is 200 with source and time of the server", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  assert.equal((await srv.post(owner("s1", -5))).status, 204);
  const paths = [
    ["/api/events", (body, o) => srv.post(body, o), owner("s1", 0)],
    ["/api/note", (body, o) => srv.postNote(body, o), { note_text: "x" }],
  ];
  for (const [p, send, good] of paths) {
    await refused(srv, () => send(good, { sign: false }), 401);
    await refused(srv, () => send(good, { sign: "0".repeat(64) }), 401);
    await refused(srv, () => send(good, { key: "чужой-секрет" }), 401);
    await refused(
      srv,
      () =>
        request(srv.port, {
          method: "POST",
          path: p,
          host: "evil.example",
          body: JSON.stringify(good),
        }),
      403,
    );
    await refused(srv, () => send(null, { raw: "x".repeat(16385) }), 413);
    await refused(
      srv,
      () => send(null, { raw: JSON.stringify({ pad: "x".repeat(20000) }) }),
      413,
    );
    await refused(srv, () => send(null, { raw: "not json" }), 400, "not_json");
    await refused(srv, () => send(null, { raw: "[1]" }), 400, "not_json");
  }
  for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
    const r = await request(srv.port, { method, path: "/api/note" });
    assert.equal(r.status, 405, method);
    assert.equal(r.headers.allow, "POST", method);
  }
  for (const method of ["PUT", "DELETE", "PATCH"]) {
    const r = await request(srv.port, { method, path: "/api/events" });
    assert.equal(r.status, 405, `events ${method}`);
    assert.equal(r.headers.allow, "GET, POST", `events ${method}`);
  }
  // A foreign Host is refused with 403 before the body is read: a 20 KB
  // unsigned body gives 403, not 413 or 401, and the journal does not change.
  for (const p of ["/api/events", "/api/note"]) {
    await refused(
      srv,
      () =>
        request(srv.port, {
          method: "POST",
          path: p,
          host: "evil.example",
          body: "x".repeat(20000),
        }),
      403,
    );
  }

  // /api/note field table.
  const note = (extra) => ({ note_text: "как понял", ...extra });
  const bad = {
    "hook field prompt_kind": [
      note({ prompt_kind: "owner" }),
      "unknown_key:prompt_kind",
    ],
    "hook field prompt_text": [
      note({ prompt_text: "x" }),
      "unknown_key:prompt_text",
    ],
    "hook field prompt_truncated": [
      note({ prompt_truncated: true }),
      "unknown_key:prompt_truncated",
    ],
    hook_event_name: [
      note({ hook_event_name: "Stop" }),
      "unknown_key:hook_event_name",
    ],
    agent_id: [note({ agent_id: "a" }), "unknown_key:agent_id"],
    request_time_auto: [
      note({ request_time_auto: true }),
      "unknown_key:request_time_auto",
    ],
    "source ORCH": [note({ source: "ORCH" }), "has_source"],
    "source REAL": [note({ source: "REAL" }), "has_source"],
    "source empty": [note({ source: "" }), "has_source"],
    time: [note({ time: iso(T0) }), "has_time"],
    "note_text 2001": [{ note_text: "а".repeat(2001) }, "bad_value:note_text"],
    "note_text not a string": [{ note_text: 7 }, "bad_value:note_text"],
    "note_text null": [{ note_text: null }, "bad_value:note_text"],
    "note_text empty": [{ note_text: "" }, "empty_note"],
    "note_text spaces": [{ note_text: " \n\t " }, "empty_note"],
    "no note_text": [{ req_id: "REQ-008" }, "missing:note_text"],
    "REQ-8": [note({ req_id: "REQ-8" }), "bad_value:req_id"],
    "../x": [note({ req_id: "../x" }), "bad_value:req_id"],
    "req_id number": [note({ req_id: 8 }), "bad_value:req_id"],
    "request_time +61 s": [
      note({ request_time: iso(T0 + 61000) }),
      "bad_value:request_time",
    ],
    "request_time not a time": [
      note({ request_time: "вчера" }),
      "bad_value:request_time",
    ],
    "request_time not canonical": [
      note({ request_time: "2026-09-20T10:00:00Z" }),
      "bad_value:request_time",
    ],
    "session_id 201": [
      note({ session_id: "s".repeat(201) }),
      "bad_value:session_id",
    ],
    "session_id number": [note({ session_id: 5 }), "bad_value:session_id"],
    "session_id empty": [note({ session_id: "" }), "bad_value:session_id"],
  };
  for (const [name, [body, error]] of Object.entries(bad)) {
    const r = await refused(srv, () => srv.postNote(body), 400);
    assert.equal(JSON.parse(r.body).error, error, name);
    assert.equal(
      r.body.includes("как понял"),
      false,
      "the body is not repeated",
    );
  }
  // Accepted: limits themselves, +59 s, 200 characters.
  const ok = [
    note({ note_text: "а".repeat(2000) }),
    note({ request_time: iso(T0 + 59000) }),
    note({ session_id: "s".repeat(200), req_id: "REQ-123456" }),
    note({ req_id: "REQ-008", request_time: iso(T0 - 10000) }),
  ];
  for (const body of ok) {
    const before = srv.lines().length;
    const r = await srv.postNote(body);
    assert.equal(r.status, 200, r.body);
    assert.match(r.headers["content-type"], /^application\/json/);
    assert.equal(srv.lines().length, before + 1);
    const line = journalOf(srv).at(-1);
    assert.equal(line.source, "ORCH");
    assert.equal(line.time, iso(T0));
    assert.equal(Object.hasOwn(line, "hook_event_name"), false);
    assert.equal(r.body.includes("как понял"), false);
  }
});

test("SV-61: the write paths are exactly /api/events and /api/note; a signed POST anywhere else is 404 or 405 and writes nothing", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const source = fs.readFileSync(path.join(SRC, "server.js"), "utf8");
  const found = [...source.matchAll(/"(\/api\/[A-Za-z0-9/_-]*)"/g)].map(
    (m) => m[1],
  );
  assert.deepEqual([...new Set(found)].sort(), ["/api/events", "/api/note"]);
  assert.equal((await srv.post(owner("s1", 0))).status, 204);
  const others = [
    "/",
    "/index.html",
    "/app.js",
    "/api",
    "/api/",
    "/api/other",
    "/api/event",
    "/api/events/x",
    "/api/note/x",
    "/api/notes",
    "/api/Note",
    "/api/note.json",
    "/events",
    "/note",
  ];
  for (const p of others) {
    for (const method of ["POST", "PUT", "DELETE"]) {
      const body = JSON.stringify({ note_text: "x" });
      const sha = srv.sha();
      const r = await request(srv.port, {
        method,
        path: p,
        headers: {
          "content-type": "application/json",
          "x-pixel-office-signature": signBody(srv.secret, body),
        },
        body,
      });
      assert.ok([404, 405].includes(r.status), `${method} ${p}: ${r.status}`);
      assert.equal(srv.sha(), sha, `${method} ${p}`);
    }
  }
  assert.equal(srv.lines().length, 1);
  assert.equal((await srv.postNote({ note_text: "x" })).status, 200);
  assert.equal((await srv.post(owner("s1", 1))).status, 204);
});

test("SV-63: the same open examples sent to both paths are stored masked - no secret value in events.jsonl, the label in its place, the rest kept; masking twice changes nothing", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const rows = [...MASK_ROWS, ...MASK_RULE_ROWS];
  let n = 0;
  for (const row of rows) {
    n += 1;
    const asPrompt = await srv.post(
      sb("UserPromptSubmit", `s-${n}`, 0, {
        prompt_kind: "owner",
        prompt_text: row.input,
      }),
    );
    assert.equal(asPrompt.status, 204, row.id);
    const asNote = await srv.postNote({ note_text: row.input });
    assert.equal(asNote.status, 200, row.id);
    const [promptLine, noteLine] = journalOf(srv).slice(-2);
    assert.equal(promptLine.prompt_text, row.expected, `events ${row.id}`);
    assert.equal(noteLine.note_text, row.expected, `note ${row.id}`);
  }
  const file = fs.readFileSync(srv.eventsFile, "utf8");
  for (const row of rows) {
    for (const piece of row.leak) {
      assert.equal(
        file.includes(JSON.stringify(piece).slice(1, -1)),
        false,
        `${row.id}: ${piece}`,
      );
    }
  }
  // An already masked text is not lengthened or changed by the second masking.
  const masked = `password=${"[скрыто]"} и Bearer [скрыто] и [скрыто]`;
  assert.equal((await srv.post(owner("s-m", 0, masked))).status, 204);
  assert.equal(journalOf(srv).at(-1).prompt_text, masked);
  // A text that is longer than the limit only after masking: events cut it to
  // 4000 and mark it; note refuses it without a write.
  const grows = "token=x ".repeat(500);
  assert.equal(grows.length, 4000);
  assert.equal((await srv.post(owner("s-g", 0, grows))).status, 204);
  const cut = journalOf(srv).at(-1);
  assert.equal(Array.from(cut.prompt_text).length, 4000);
  assert.equal(cut.prompt_truncated, true);
  assert.equal(cut.prompt_text.includes("token=x"), false);
  const longNote = "token=x ".repeat(250);
  assert.equal(longNote.length, 2000);
  await refused(
    srv,
    () => srv.postNote({ note_text: longNote }),
    400,
    "too_long_after_mask",
  );
});

test("SV-64: with storage off the server refuses prompt_text and note_text (400 text_storage_off) and keeps the journal; prompt_kind alone is accepted", async (t) => {
  const srv = await startServer(t, { now: fixedNow, storeText: false });
  const kindOnly = await srv.post(
    sb("UserPromptSubmit", "s1", 0, { prompt_kind: "owner" }),
  );
  assert.equal(kindOnly.status, 204);
  await refused(srv, () => srv.post(owner("s1", 1)), 400, "text_storage_off");
  await refused(
    srv,
    () => srv.postNote({ note_text: "как понял" }),
    400,
    "text_storage_off",
  );
  assert.equal(srv.lines().length, 1);
  // The switch is read from the environment when it is not given.
  const prior = process.env.SAI_PIXEL_OFFICE_STORE_TEXT;
  t.after(() => {
    if (prior === undefined) delete process.env.SAI_PIXEL_OFFICE_STORE_TEXT;
    else process.env.SAI_PIXEL_OFFICE_STORE_TEXT = prior;
  });
  for (const [value, status] of [
    ["0", 400],
    ["yes", 400],
    ["1", 204],
    ["", 204],
  ]) {
    process.env.SAI_PIXEL_OFFICE_STORE_TEXT = value;
    const box = sandbox(t);
    const secret = prepareState(box);
    const { createServer } = await import("../src/pixel-office/server.js");
    const server = createServer({
      stateDir: box.dir,
      port: 0,
      now: fixedNow,
      warn() {},
    });
    const { port } = await server.listen();
    t.after(() => server.close());
    const body = JSON.stringify(owner("s1", 0));
    const r = await request(port, {
      method: "POST",
      path: "/api/events",
      headers: { "x-pixel-office-signature": signBody(secret, body) },
      body,
    });
    assert.equal(r.status, status, `value ${JSON.stringify(value)}`);
  }
});

test("SV-65: a note without request_time is bound by the server to the last owner message of the whole journal (any session), with request_time_auto; session_id narrows it; none found - no binding; an explicit request_time is kept without request_time_auto", async (t) => {
  const A = owner("s-A", -30);
  const B = owner("s-B", -20);
  const service = sb("UserPromptSubmit", "s-B", -10, {
    prompt_kind: "service",
  });
  const legacy = sb("UserPromptSubmit", "s-B", -5);
  const srv = await startServer(t, {
    now: fixedNow,
    setup: (box) => {
      const lines = [A, B, service, legacy].map((l) =>
        JSON.stringify({ ...l, source: "REAL" }),
      );
      fs.writeFileSync(
        path.join(box.dir, "events.jsonl"),
        `${lines.join("\n")}\n`,
        { mode: 0o600 },
      );
    },
  });
  const last = () => journalOf(srv).at(-1);

  // The main case: no request_time and no session_id (how ORCH calls).
  const r1 = await srv.postNote({
    note_text: "как понял 1",
    req_id: "REQ-008",
  });
  assert.equal(r1.status, 200);
  assert.deepEqual(JSON.parse(r1.body), {
    request_time: B.time,
    request_time_auto: true,
  });
  assert.deepEqual(last(), {
    time: iso(T0),
    source: "ORCH",
    note_text: "как понял 1",
    req_id: "REQ-008",
    request_time: B.time,
    request_time_auto: true,
  });
  // session_id narrows the search.
  const r2 = await srv.postNote({
    note_text: "как понял 2",
    session_id: "s-A",
  });
  assert.deepEqual(JSON.parse(r2.body), {
    request_time: A.time,
    request_time_auto: true,
  });
  assert.equal(last().session_id, "s-A");
  assert.equal(last().request_time, A.time);
  // A session without an owner message: no binding.
  const r3 = await srv.postNote({
    note_text: "как понял 3",
    session_id: "s-none",
  });
  assert.deepEqual(JSON.parse(r3.body), {
    request_time: null,
    request_time_auto: false,
  });
  assert.equal(Object.hasOwn(last(), "request_time"), false);
  assert.equal(Object.hasOwn(last(), "request_time_auto"), false);
  // An explicit request_time: kept, no auto mark (even if it matches nothing).
  const explicit = iso(T0 - 100000);
  const r4 = await srv.postNote({
    note_text: "как понял 4",
    request_time: explicit,
  });
  assert.deepEqual(JSON.parse(r4.body), {
    request_time: explicit,
    request_time_auto: false,
  });
  assert.equal(last().request_time, explicit);
  assert.equal(Object.hasOwn(last(), "request_time_auto"), false);
  assert.equal(Object.hasOwn(last(), "session_id"), false);
  // A later owner message moves the binding; the notes of ORCH are not owners.
  assert.equal((await srv.post(owner("s-C", 1))).status, 204);
  const r5 = await srv.postNote({ note_text: "как понял 5" });
  assert.equal(JSON.parse(r5.body).request_time, iso(T0 + 1000));
  // A journal without any owner message.
  const empty = await startServer(t, { now: fixedNow });
  assert.equal((await empty.post(sb("Stop", "s", 0))).status, 204);
  assert.equal(
    (
      await empty.post(
        sb("UserPromptSubmit", "s", 1, { prompt_kind: "service" }),
      )
    ).status,
    204,
  );
  const r6 = await empty.postNote({ note_text: "как понял" });
  assert.deepEqual(JSON.parse(r6.body), {
    request_time: null,
    request_time_auto: false,
  });
  const noted = journalOf(empty).at(-1);
  assert.equal(Object.hasOwn(noted, "request_time"), false);
});

test("SV-66: after the writes of criteria 1 and 5 events.jsonl and write-secret are 0600, the directory 0700, and the directory holds only STATE_FILES", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  assert.equal((await srv.post(owner("s1", 0, "текст-проба-66"))).status, 204);
  assert.equal(
    (await srv.postNote({ note_text: "запись-проба-66" })).status,
    200,
  );
  const mode = (p) => fs.statSync(p).mode & 0o777;
  assert.equal(mode(srv.eventsFile), 0o600);
  assert.equal(mode(path.join(srv.dir, "write-secret")), 0o600);
  assert.equal(mode(srv.dir), 0o700);
  for (const name of fs.readdirSync(srv.dir)) {
    assert.ok(STATE_FILES.includes(name), `a new file: ${name}`);
  }
  // Nothing with the texts anywhere else in the temporary folder.
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    });
  for (const file of walk(srv.box.root)) {
    if (file === srv.eventsFile) continue;
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text.includes("текст-проба-66"), false, file);
    assert.equal(text.includes("запись-проба-66"), false, file);
  }
});

test("SV-67: the server makes no outgoing requests (grep of server.js is empty) and the texts reach neither its stdout nor its stderr", async (t) => {
  const source = fs.readFileSync(path.join(SRC, "server.js"), "utf8");
  assert.equal(/https?\.request|fetch\(|net\.connect/.test(source), false);
  const box = sandbox(t);
  const run = await spawnMain(t, box);
  const secret = fs
    .readFileSync(path.join(box.dir, "write-secret"), "utf8")
    .trim();
  const needle = "уникальная-подстрока-67";
  const send = (p, value) => {
    const body = JSON.stringify(value);
    return request(run.port, {
      method: "POST",
      path: p,
      headers: { "x-pixel-office-signature": signBody(secret, body) },
      body,
    });
  };
  const time = new Date().toISOString();
  const first = await send("/api/events", {
    time,
    hook_event_name: "UserPromptSubmit",
    session_id: "s67",
    prompt_kind: "owner",
    prompt_text: `сделай ${needle}`,
  });
  assert.equal(first.status, 204);
  assert.equal(
    (await send("/api/note", { note_text: `понял ${needle}` })).status,
    200,
  );
  // Refusals and a corrupted line produce warnings: none repeats the text.
  await send("/api/events", {
    time,
    hook_event_name: "Stop",
    session_id: "s67",
    note_text: needle,
  });
  await send("/api/note", { note_text: needle, source: "ORCH" });
  await run.stop();
  assert.equal(run.out.stdout.includes(needle), false);
  assert.equal(run.out.stderr.includes(needle), false);
  assert.equal(run.out.stdout.includes(secret), false);
});

// ===================================================================
// REQ-036 criterion 6, D14 (design REQ-036-044-045 3.13): the server masks
// the description and the roles itself, also when a signed body came around
// the hook. The secrets are invented.
// ===================================================================
import { validateWriteBody } from "../src/pixel-office/protocol.js";
import { MASK_LABEL } from "../src/pixel-office/public/schema.js";

test("MK-02: the server masks the description, subagent_type and agent_type of a signed body that did not pass the hook - not in the file of the journal, not in the answer of GET /api/events, '[скрыто]' in their place; a body masked by the hook is written as it is", async (t) => {
  // invented secrets, put together at run time
  const key = ["sk", "ant", "MK02fakeKEY9876543210zyxwvu"].join("-");
  const pass = ["mk02", "pass", "VALUE77qq"].join("");
  const srv = await startServer(t, { now: fixedNow });
  const raw = writeBody("PostToolUse", "mk-session", iso(T0), {
    tool_use_id: "toolu_mk02",
    launched_agent_id: "agent-mk02",
    subagent_type: `Plan ${key}`,
    agent_id: "agent-parent",
    agent_type: `Explore password="${pass}"`,
    description: `ключ ${key} и password="${pass}"`,
  });
  const direct = validateWriteBody(raw, T0);
  assert.equal(direct.ok, true, direct.reason);
  for (const f of ["description", "subagent_type", "agent_type"]) {
    assert.ok(direct.line[f].includes(MASK_LABEL), f);
  }
  assert.equal(direct.line.agent_id, "agent-parent");
  assert.equal(direct.line.launched_agent_id, "agent-mk02");
  const res = await srv.post(raw);
  assert.equal(res.status, 204);
  const file = fs.readFileSync(srv.eventsFile, "utf8");
  const answer = (await srv.get("/api/events?after=0")).body;
  for (const text of [file, answer]) {
    for (const secret of [key, pass]) {
      for (let i = 0; i + 8 <= secret.length; i++) {
        assert.equal(
          text.includes(secret.slice(i, i + 8)),
          false,
          secret.slice(i, i + 8),
        );
      }
    }
    assert.ok(text.includes(MASK_LABEL));
  }
  const line = JSON.parse(file.trim().split("\n").at(-1));
  assert.equal(line.subagent_type, `Plan ${MASK_LABEL}`);
  // a body already masked by the hook: written without a change
  const masked = buildWriteBody(
    {
      session_id: "mk-session",
      hook_event_name: "PostToolUse",
      tool_name: "Agent",
      tool_use_id: "toolu_mk02b",
      tool_input: { subagent_type: `Plan ${key}`, description: `ключ ${key}` },
      tool_response: { agentId: "agent-mk02b" },
    },
    iso(T0),
  );
  const again = validateWriteBody(masked, T0);
  assert.equal(again.line.description, masked.description);
  assert.equal(again.line.subagent_type, masked.subagent_type);
  assert.equal((await srv.post(masked)).status, 204);
  const last = JSON.parse(
    fs.readFileSync(srv.eventsFile, "utf8").trim().split("\n").at(-1),
  );
  assert.equal(last.description, masked.description);
  assert.equal(last.subagent_type, masked.subagent_type);
});

// ---- ISS-0123: a signed body is accepted once -------------------------------------

test("ISS-0123 the same signed event sent twice: 204, then 409 replayed, one line in the journal", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const body = sb("Stop", "s-replay", 0);
  assert.equal((await srv.post(body)).status, 204);
  const before = srv.sha();
  const again = await srv.post(body);
  assert.equal(again.status, 409);
  assert.equal(JSON.parse(again.body).error, "replayed");
  assert.equal(srv.sha(), before);
  assert.equal(
    srv.lines().filter((l) => JSON.parse(l).session_id === "s-replay").length,
    1,
  );
  // another body (another moment of the event) is a new event
  assert.equal((await srv.post(sb("Stop", "s-replay", 1))).status, 204);
});

test("ISS-0123 the same signed note sent twice: 200, then 409 replayed, one note line", async (t) => {
  const srv = await startServer(t, { now: fixedNow });
  const note = { note_text: "понял задачу", session_id: "s-note" };
  assert.equal((await srv.postNote(note)).status, 200);
  const before = srv.sha();
  const again = await srv.postNote(note);
  assert.equal(again.status, 409);
  assert.equal(JSON.parse(again.body).error, "replayed");
  assert.equal(srv.sha(), before);
});

test("ISS-0123 a body is remembered for twice the time tolerance, then forgotten; a refused body is not remembered", async (t) => {
  let nowMs = T0;
  const srv = await startServer(t, { now: () => nowMs });
  const body = sb("Stop", "s-keep", 0);
  assert.equal((await srv.post(body)).status, 204);
  nowMs = T0 + 60000;
  assert.equal((await srv.post(body)).status, 409);
  // past the time tolerance the body is refused by the time check anyway
  nowMs = T0 + 120001;
  assert.equal((await srv.post(body)).status, 400);
  // a body that failed the signature is not remembered: the same bytes, signed, pass
  nowMs = T0;
  const fresh = sb("Stop", "s-keep", 2);
  assert.equal((await srv.post(fresh, { sign: "bad" })).status, 401);
  assert.equal((await srv.post(fresh)).status, 204);
});
