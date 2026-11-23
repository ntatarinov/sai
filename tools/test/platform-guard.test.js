// PLT: the platform rule of tools/ (REQ-110 criteria 12-19; fix of ISS-0132; design
// docs/design/ISS-0132-platform-guard.md, sections 2-6, 9 and 10).
//
// The oracle of this file is its own: the allow-list, the closed tables of the scripts
// and the words of the README rows are written here, not read from tools/src. The new
// module is imported inside the tests that need it (a dynamic import), so that on a copy
// without it those tests are red while the rows that hold by construction stay readable.
// Every start of a program of tools/ gets a HOME, TMPDIR, Pixel Office state folder and
// team home inside the test's own temporary folder, a limit and a SIGKILL after the
// test; servers only on port 0; the child environment is built from named variables,
// never from the whole process.env; SAI_TEAM_REAL_RUNS is never set. A platform (and a
// Node version) is simulated by a preload that the test writes into its own folder.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { nodeFloorRefusal } from "../src/node-floor.js";
import {
  ensureStateDir,
  StateDirError,
} from "../src/pixel-office/state-dir.js";
import { readConfig } from "../src/team/config.js";
import { EXECUTOR_MESSAGES, TeamError } from "../src/team/errors.js";
import { WORK_ANSWER_SCHEMA, getExecutor } from "../src/team/executor.js";
import { ensureHome } from "../src/team/home.js";
import { roleByCode } from "../src/team/roles.js";
import { controlFailure, postProject } from "../src/web/api.js";
import { WHY_NOT_STARTED, WHY_OTHER } from "../src/web/texts.js";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REAL_TMP = fs.realpathSync(os.tmpdir());
const GUARD_URL = pathToFileURL(
  path.join(TOOLS, "src", "platform-guard.js"),
).href;
const LIMIT_MS = 15_000;
const LINK_RE = /http:\/\/127\.0\.0\.1:(\d+)\//u;
// The beginning of the refusal line of criterion 12, written here (the oracle).
const REFUSAL_START = "Эта команда работает только на Linux и macOS";

function guardModule() {
  return import(GUARD_URL);
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function oneLineWithoutControls(line, label) {
  assert.equal(typeof line, "string", label);
  for (const ch of line) {
    const n = ch.codePointAt(0);
    assert.ok(
      !(n < 32 || (n >= 127 && n < 160) || n === 0x2028 || n === 0x2029),
      `${label}: a control character U+${n.toString(16)}`,
    );
  }
}

// ---- criterion 12: the rule --------------------------------------------------------------

const ALLOWED = ["linux", "darwin"];
const REFUSED_NAMES = [
  "win32",
  "cygwin",
  "freebsd",
  "openbsd",
  "aix",
  "sunos",
  "android",
  "netbsd",
  "haiku",
];
// Near misses of the allowed names: case, spaces, line ends, prefixes.
const REFUSED_TWINS = [
  "Linux",
  "LINUX",
  "linux ",
  " linux",
  "darwin\n",
  "Darwin",
  "linux2",
  "darwi",
  "linux\u0000",
];
const REFUSED_VALUES = [
  "",
  undefined,
  null,
  22,
  0,
  true,
  "x".repeat(1000),
  ["linux"],
  { toString: () => "linux" },
  new String("linux"),
];

test("PLT-01: the allow-list is exactly linux and darwin and frozen; every other name, a near miss of an allowed name and a value that is not a string is refused", async () => {
  const { SUPPORTED_PLATFORMS, isSupportedPlatform } = await guardModule();
  assert.deepEqual([...SUPPORTED_PLATFORMS], ALLOWED, "the list");
  assert.equal(Object.isFrozen(SUPPORTED_PLATFORMS), true, "not frozen");
  for (const p of ALLOWED)
    assert.equal(isSupportedPlatform(p), true, `${p} is refused`);
  for (const p of [...REFUSED_NAMES, ...REFUSED_TWINS, ...REFUSED_VALUES])
    assert.equal(
      isSupportedPlatform(p),
      false,
      `${JSON.stringify(String(p)).slice(0, 40)} is allowed`,
    );
  assert.equal(isSupportedPlatform(), false, "no argument is allowed");
});

test("PLT-02: the refusal line - one line, Cyrillic, no stack, Linux, macOS, tools/README.md and the platform; a text of another shape is not shown", async () => {
  const { platformRefusal } = await guardModule();
  for (const p of ["win32", "cygwin", "freebsd", "a".repeat(64)]) {
    const line = platformRefusal(p);
    oneLineWithoutControls(line, p.slice(0, 10));
    assert.match(line, /[А-Яа-яЁё]/u, `${p}: no Cyrillic`);
    assert.equal(/^\s+at /mu.test(line), false, `${p}: a stack line`);
    for (const word of ["Linux", "macOS", "tools/README.md", p])
      assert.ok(line.includes(word), `${p.slice(0, 10)}: no ${word}`);
    assert.equal(line.startsWith(REFUSAL_START), true, `${p}: ${line}`);
    assert.equal(line.includes("неизвестная платформа"), false, p);
  }
  const hostile = [
    "",
    undefined,
    null,
    22,
    "x".repeat(1000),
    "a".repeat(65),
    "win32\n",
    "win32\r",
    "a b",
    "<x>",
    "$(id)",
    "../etc",
    "é",
    "win32\u001b[31m",
    String.fromCharCode(0x2028),
    {
      toString() {
        throw new Error("toString was called");
      },
    },
  ];
  for (const p of hostile) {
    const label = JSON.stringify(typeof p === "string" ? p : typeof p).slice(
      0,
      20,
    );
    const line = platformRefusal(p);
    oneLineWithoutControls(line, label);
    assert.ok(line.includes("неизвестная платформа"), `${label}: ${line}`);
    if (typeof p === "string" && p !== "")
      assert.equal(line.includes(p), false, `${label}: the text is shown`);
    assert.ok(line.includes("tools/README.md"), label);
  }
});

test("PLT-03: the guard - a refused platform gives true and exactly one write of the line and its end; an allowed one false and no write; a writer that throws does not stop it", async () => {
  const { platformRefusal, refuseUnsupportedPlatform } = await guardModule();
  // undefined is not a row here: it means the running platform (the language's default).
  for (const p of ["win32", "cygwin", "", null, 22]) {
    const writes = [];
    const recorder = { write: (s) => writes.push(s) };
    assert.equal(refuseUnsupportedPlatform(recorder, p), true, String(p));
    assert.deepEqual(writes, [`${platformRefusal(p)}\n`], `${p}: one write`);
  }
  let calls = 0;
  const counter = {
    write() {
      calls += 1;
      throw new Error("must not be called");
    },
  };
  for (const p of ALLOWED)
    assert.equal(refuseUnsupportedPlatform(counter, p), false, p);
  assert.equal(calls, 0, "the writer was called for an allowed platform");
  const thrower = {
    write() {
      throw new Error("closed");
    },
  };
  let result;
  assert.doesNotThrow(() => {
    result = refuseUnsupportedPlatform(thrower, "win32");
  }, "a throwing writer: the guard throws");
  assert.equal(result, true, "a throwing writer: not refused");
  // No second argument: the running platform, judged by the oracle of this file.
  const writes = [];
  const refusedHere = !ALLOWED.includes(process.platform);
  assert.equal(
    refuseUnsupportedPlatform({ write: (s) => writes.push(s) }),
    refusedHere,
    `the running platform ${process.platform}`,
  );
  assert.equal(writes.length, refusedHere ? 1 : 0);
});

test("PLT-04: the module is pure - no import, no require, no environment, no fs, no node: word; process.platform once, as the default of the guard's second parameter", () => {
  const text = fs.readFileSync(
    path.join(TOOLS, "src", "platform-guard.js"),
    "utf8",
  );
  for (const [re, what] of [
    [/\bimport\b/u, "import"],
    [/\brequire\b/u, "require"],
    [/process\.env/u, "process.env"],
    [/\bfs\b/u, "fs"],
    [/node:/u, "node:"],
  ])
    assert.equal(re.test(text), false, `the module holds ${what}`);
  assert.equal(
    text.match(/process\.platform/gu)?.length ?? 0,
    1,
    "process.platform not exactly once",
  );
  assert.match(
    text,
    /export function refuseUnsupportedPlatform\(\s*stderr,\s*platform = process\.platform,?\s*\)/u,
    "process.platform is not the default of the second parameter",
  );
});

// ---- the temporary world of a start ------------------------------------------------------

// The preload: SAI_TEST_PLATFORM replaces process.platform, SAI_TEST_NODE_VERSION the
// version (both are configurable data properties).
const PRELOAD_TEXT = [
  "const p = process.env.SAI_TEST_PLATFORM;",
  "if (p !== undefined) {",
  '  Object.defineProperty(process, "platform", { value: p, configurable: true, enumerable: true });',
  "}",
  "const v = process.env.SAI_TEST_NODE_VERSION;",
  "if (v !== undefined) {",
  '  Object.defineProperty(process.versions, "node", { value: v, configurable: true, enumerable: true });',
  '  Object.defineProperty(process, "version", { value: `v${v}`, configurable: true, enumerable: true });',
  "}",
  "",
].join("\n");

function isInsideTmp(p) {
  return path.resolve(p).startsWith(REAL_TMP + path.sep);
}

// The folders of one start. state and team are not made: a refused start must not make them.
function makeBox(t) {
  const root = fs.mkdtempSync(path.join(REAL_TMP, "plt-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const box = {
    root,
    home: path.join(root, "home"),
    tmp: path.join(root, "tmp"),
    work: path.join(root, "work"),
    pre: path.join(root, "pre"),
    state: path.join(root, "state"),
    team: path.join(root, "team"),
  };
  for (const d of [box.home, box.tmp, box.work, box.pre]) fs.mkdirSync(d);
  box.preload = path.join(box.pre, "platform-preload.mjs");
  fs.writeFileSync(box.preload, PRELOAD_TEXT);
  return box;
}

// The environment of a child: named variables only.
function childEnv(box, { platform, version, extra = {} } = {}) {
  for (const d of [box.home, box.tmp, box.work, box.state, box.team])
    assert.ok(isInsideTmp(d), `a folder of a child is not temporary: ${d}`);
  const env = {
    PATH: process.env.PATH,
    HOME: box.home,
    USERPROFILE: box.home,
    TMPDIR: box.tmp,
    TMP: box.tmp,
    TEMP: box.tmp,
    SAI_PIXEL_OFFICE_DIR: box.state,
    SAI_TEAM_HOME: box.team,
    ...extra,
  };
  if (process.env.SystemRoot !== undefined)
    env.SystemRoot = process.env.SystemRoot;
  if (platform !== undefined) env.SAI_TEST_PLATFORM = platform;
  if (version !== undefined) env.SAI_TEST_NODE_VERSION = version;
  assert.equal(env.SAI_TEAM_REAL_RUNS, undefined);
  return env;
}

// A program of tools/ as a child with the preload, a limit and a SIGKILL after the test.
// `onLink`: "stop" ends a server by SIGTERM at its link line; "fail" kills it at once (a
// refused start must never print a link).
function runChild(t, box, file, args, opts = {}) {
  const child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(box.preload).href,
      path.join(TOOLS, file),
      ...args,
    ],
    {
      cwd: box.work,
      env: childEnv(box, opts),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const out = { stdout: "", stderr: "", timedOut: false, linkSeen: false };
  child.stderr.on("data", (d) => (out.stderr += d));
  child.stdout.on("data", (d) => {
    out.stdout += d;
    if (!out.linkSeen && LINK_RE.test(out.stdout)) {
      out.linkSeen = true;
      if (opts.onLink === "stop") child.kill("SIGTERM");
      else child.kill("SIGKILL");
    }
  });
  const timer = setTimeout(() => {
    out.timedOut = true;
    child.kill("SIGKILL");
  }, LIMIT_MS);
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  });
  return new Promise((resolve) =>
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, ...out });
    }),
  );
}

// What a folder holds: names and hashes, or "absent".
function listing(dir) {
  if (!fs.existsSync(dir)) return "absent";
  const out = [];
  const walk = (d, rel) => {
    const entries = fs
      .readdirSync(d, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of entries) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        out.push(`${r}/`);
        walk(path.join(d, e.name), r);
      } else out.push(`${r} ${sha256(fs.readFileSync(path.join(d, e.name)))}`);
    }
  };
  walk(dir, "");
  return out.join("\n");
}

// A listener on 127.0.0.1 port 0 that records every request and answers 204.
async function stubListener(t) {
  const requests = [];
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url });
      res.statusCode = 204;
      res.end();
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return { requests, port: server.address().port };
}

// A valid state folder for the note: the port of the stub and a secret, written here.
function writeNoteState(box, port) {
  fs.mkdirSync(box.state, { mode: 0o700 });
  fs.chmodSync(box.state, 0o700);
  fs.writeFileSync(path.join(box.state, "port"), `${port}\n`, { mode: 0o600 });
  fs.writeFileSync(
    path.join(box.state, "write-secret"),
    `${"PltSecret0123456789abcdefghijKLMNOPQRSTUVWXYZ-_09"}\n`,
    { mode: 0o600 },
  );
}

// The rows of design 9.1 (PLT-05): the five refused scripts and a second command of team.
// `prepare(box, stub)` makes what the row needs before the start.
const ENTRY_ROWS = [
  {
    key: "team new",
    file: "src/team/cli.js",
    args: () => ["new", "--goal", "Вымышленная цель", "--budget", "1"],
    code: 2,
  },
  {
    key: "team projects",
    file: "src/team/cli.js",
    args: () => ["projects"],
    code: 2,
  },
  {
    key: "team-web",
    file: "src/web/main.js",
    args: () => ["--port", "0"],
    code: 2,
    server: true,
  },
  {
    key: "pixel-office",
    file: "src/pixel-office/main.js",
    args: () => ["--port", "0"],
    code: 1,
    server: true,
  },
  {
    key: "pixel-office-note",
    file: "src/pixel-office/note.js",
    args: () => ["--text", "Вымышленная заметка"],
    code: 2,
    extra: { SAI_PIXEL_OFFICE_STORE_TEXT: "1" },
    note: true,
  },
  {
    key: "e2e",
    file: "test/e2e/run.js",
    args: () => ["no-such-spec"],
    code: 2,
  },
];

// Starts one row under `opts` and returns what is needed for the asserts.
async function startRow(t, row, opts) {
  const box = makeBox(t);
  const stub = await stubListener(t);
  if (row.note) writeNoteState(box, stub.port);
  const before = listing(box.root);
  const r = await runChild(t, box, row.file, row.args(box), {
    ...opts,
    extra: row.extra,
  });
  return { box, stub, before, r, after: listing(box.root) };
}

// Collects the failures of every row, so that a red message names all failing rows.
async function eachRow(rows, check) {
  const failures = [];
  for (const row of rows) {
    try {
      await check(row);
    } catch (err) {
      failures.push(`${row.key ?? row}: ${err.message.split("\n")[0]}`);
    }
  }
  assert.deepEqual(failures, [], "rows failed");
}

// ---- criterion 13: the entry points refuse -----------------------------------------------

test("PLT-05: under the win32 preload every entry ends by itself with its code, an empty stdout and exactly the refusal line, writes nothing, starts no server and sends nothing", async (t) => {
  const { platformRefusal } = await guardModule();
  const expected = `${platformRefusal("win32")}\n`;
  await eachRow(ENTRY_ROWS, async (row) => {
    const { stub, before, r, after } = await startRow(t, row, {
      platform: "win32",
      onLink: "fail",
    });
    assert.equal(r.timedOut, false, "did not end by itself");
    assert.equal(r.linkSeen, false, "a server started");
    assert.equal(r.signal, null, `signal ${r.signal}`);
    assert.equal(r.code, row.code, `code ${r.code}`);
    assert.equal(r.stdout, "", "stdout is not empty");
    assert.equal(r.stderr, expected, "stderr is not the refusal line");
    assert.equal(after, before, "a folder changed");
    assert.equal(stub.requests.length, 0, "the listener received a request");
  });
});

test("PLT-06: below the Node floor under the win32 preload the floor's line wins - its code, only its line, nothing written", async (t) => {
  const version = "22.21.1";
  const expected = `${nodeFloorRefusal(version)}\n`;
  await eachRow(ENTRY_ROWS, async (row) => {
    const { stub, before, r, after } = await startRow(t, row, {
      platform: "win32",
      version,
      onLink: "fail",
    });
    assert.equal(r.timedOut, false, "did not end by itself");
    assert.equal(r.linkSeen, false, "a server started");
    assert.equal(r.code, row.code, `code ${r.code}`);
    assert.equal(r.stdout, "", "stdout is not empty");
    assert.equal(r.stderr, expected, "stderr is not the floor's line");
    assert.equal(after, before, "a folder changed");
    assert.equal(stub.requests.length, 0, "the listener received a request");
  });
});

test("PLT-07: --help of pixel-office and pixel-office-note under the win32 preload is the help of the running Node - code 0, the same stdout, empty stderr, nothing written", async (t) => {
  const rows = ["src/pixel-office/main.js", "src/pixel-office/note.js"];
  await eachRow(rows, async (file) => {
    const realBox = makeBox(t);
    const real = await runChild(t, realBox, file, ["--help"], {});
    assert.equal(real.code, 0, `under the running Node: code ${real.code}`);
    assert.notEqual(real.stdout, "", "the help is empty");
    const box = makeBox(t);
    const before = listing(box.root);
    const r = await runChild(t, box, file, ["--help"], { platform: "win32" });
    assert.equal(r.code, 0, `code ${r.code}`);
    assert.equal(r.stdout, real.stdout, "another help text");
    assert.equal(r.stderr, "", "stderr is not empty");
    assert.equal(listing(box.root), before, "a folder changed");
  });
});

test("PLT-08: the positive controls - the preload sets the platform a child sees; under linux and darwin every entry row goes on as under the running Node", async (t) => {
  const box = makeBox(t);
  const probe = (platform) =>
    new Promise((resolve) => {
      const c = spawn(
        process.execPath,
        ["--import", pathToFileURL(box.preload).href, "-p", "process.platform"],
        {
          cwd: box.work,
          env: childEnv(box, { platform }),
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let out = "";
      c.stdout.on("data", (d) => (out += d));
      c.on("close", () => resolve(out.trim()));
    });
  for (const p of ["win32", "linux", "darwin"])
    assert.equal(await probe(p), p, `the preload did not set ${p}`);
  assert.equal(await probe(undefined), process.platform);
  const rows = ALLOWED.flatMap((platform) =>
    ENTRY_ROWS.map((row) => ({
      ...row,
      platform,
      key: `${row.key} (${platform})`,
    })),
  );
  await eachRow(rows, async (row) => {
    const {
      box: b,
      stub,
      r,
    } = await startRow(t, row, {
      platform: row.platform,
      onLink: "stop",
    });
    assert.equal(r.timedOut, false, "did not end");
    assert.equal(
      r.stderr.includes(REFUSAL_START),
      false,
      `refused: ${r.stderr}`,
    );
    if (row.server) assert.equal(r.linkSeen, true, `no link: ${r.stderr}`);
    else if (row.note)
      assert.deepEqual(
        stub.requests.map((q) => `${q.method} ${q.url}`),
        ["POST /api/note"],
        "the listener did not receive the note",
      );
    else if (row.key.startsWith("e2e")) {
      assert.equal(r.code, 1, `code ${r.code}`);
      assert.match(r.stdout + r.stderr, /SELECTION_UNKNOWN/u);
    } else {
      assert.equal(r.code, 0, `code ${r.code}: ${r.stderr}`);
      if (row.key.startsWith("team new"))
        assert.equal(
          fs
            .readdirSync(b.team)
            .filter((name) => /^p-[0-9]{8}-[0-9a-f]{6}$/u.test(name)).length,
          1,
          "no project in the temporary home",
        );
    }
  });
});

// The closed tables of design 3.3.
const REFUSED_SCRIPTS = [
  "team",
  "team-web",
  "pixel-office",
  "pixel-office-note",
  "e2e",
];
const THIN_CLIENT_SCRIPTS = [
  "prepare-run",
  "validate",
  "apply-verdict",
  "snapshot",
  "snapshot-diff",
  "traces",
  "handoffs-check",
  "handoff",
  "picker",
];

test("PLT-09: every node <file> script of tools/package.json stands in exactly one of the two closed tables, and every table entry is such a script", () => {
  const scripts = JSON.parse(
    fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"),
  ).scripts;
  const nodeFile = Object.entries(scripts)
    .filter(([, body]) => /^node [^\s-]/u.test(body))
    .map(([name]) => name);
  const tables = [...REFUSED_SCRIPTS, ...THIN_CLIENT_SCRIPTS];
  assert.equal(new Set(tables).size, tables.length, "a script in both tables");
  for (const name of nodeFile)
    assert.ok(tables.includes(name), `the script ${name} is in neither table`);
  for (const name of tables)
    assert.ok(nodeFile.includes(name), `${name} is not a node <file> script`);
});

// ---- criterion 15: the thin client keeps working -----------------------------------------

const FIXTURE_PICKER = path.join(
  TOOLS,
  "test",
  "fixtures",
  "picker",
  "ok-minimal.json",
);
const FIXTURE_JOURNAL = path.join(
  TOOLS,
  "test",
  "fixtures",
  "pixel-office",
  "events-fresh.jsonl",
);
// The rows of PLT-10: the help of the help-only tools, and one call of each of them that
// passes the floor guard and writes nothing (review step 03b, L2).
const THIN_ROWS = [
  { key: "traces --help", file: "src/traces/cli.js", args: () => ["--help"] },
  {
    key: "traces check",
    file: "src/traces/cli.js",
    args: (b) => ["check", "--root", b.work],
  },
  {
    key: "handoffs-check --help",
    file: "src/handoffs/cli.js",
    args: () => ["--help"],
  },
  {
    key: "handoffs-check --root",
    file: "src/handoffs/cli.js",
    args: (b) => ["--root", b.work],
  },
  {
    key: "handoff --help",
    file: "src/handoffs/handoff.js",
    args: () => ["--help"],
  },
  {
    key: "handoff close",
    file: "src/handoffs/handoff.js",
    args: () => [
      "close",
      "handoffs/X-20990101-01/step-01-x.json",
      "--status",
      "COMPLETED",
    ],
  },
  { key: "picker --help", file: "src/picker/cli.js", args: () => ["--help"] },
  {
    key: "picker check",
    file: "src/picker/cli.js",
    args: () => ["check", FIXTURE_PICKER],
  },
  {
    key: "prepare-run",
    file: "src/cli.js",
    args: (b) => ["prepare-run", "--root", b.work],
  },
  {
    key: "validate",
    file: "src/cli.js",
    args: (b) => ["validate", "--root", b.work],
  },
  {
    key: "apply-verdict",
    file: "src/cli.js",
    args: (b) => ["apply-verdict", "--root", b.work],
  },
  {
    key: "snapshot",
    file: "src/cli.js",
    args: (b) => ["snapshot", "--root", b.work],
  },
  { key: "snapshot-diff", file: "src/cli.js", args: () => ["snapshot-diff"] },
  {
    key: "office-report",
    file: "src/pixel-office/public/office-report.js",
    args: () => ["--journal", FIXTURE_JOURNAL],
  },
];

test("PLT-10: the thin client under the win32 preload gives the same code, stdout and stderr as under the linux preload, no refusal line, and writes nothing", async (t) => {
  await eachRow(THIN_ROWS, async (row) => {
    const runs = {};
    for (const platform of ["win32", "linux"]) {
      const box = makeBox(t);
      const before = listing(box.root);
      const r = await runChild(t, box, row.file, row.args(box), {
        platform,
        onLink: "fail",
      });
      assert.equal(r.timedOut, false, `${platform}: did not end`);
      assert.equal(r.linkSeen, false, `${platform}: a server started`);
      assert.equal(
        r.stderr.includes(REFUSAL_START),
        false,
        `${platform}: the refusal line`,
      );
      assert.equal(listing(box.root), before, `${platform}: a folder changed`);
      // The folder of the box differs between the two starts; it is not compared.
      const norm = (s) => s.split(box.work).join("<work>");
      runs[platform] = {
        code: r.code,
        stdout: norm(r.stdout),
        stderr: norm(r.stderr),
      };
    }
    assert.deepEqual(runs.win32, runs.linux, "win32 differs from linux");
    if (row.key.endsWith("--help")) assert.equal(runs.linux.code, 0);
  });
});

const THIN_DIRS = [
  "src/traces",
  "src/handoffs",
  "src/picker",
  "src/pixel-office/public",
];

test("PLT-11: no file of the thin client (traces, handoffs, picker, the Pixel Office page and src/cli.js) holds the text platform-guard", () => {
  const files = [path.join(TOOLS, "src", "cli.js")];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  for (const rel of THIN_DIRS) walk(path.join(TOOLS, rel));
  assert.ok(files.length > 10, "the walk found almost nothing");
  const holders = files
    .filter((f) => fs.readFileSync(f, "latin1").includes("platform-guard"))
    .map((f) => path.relative(TOOLS, f));
  assert.deepEqual(holders, [], "a thin-client file names platform-guard");
});

// ---- criterion 16: the real executor refuses as the second layer -------------------------

// A full request of a real run (as exec-helpers.js requestFor builds it), without a store.
function fullRequest(work, project = {}) {
  return {
    project: {
      id: "p-20990101-a1b2c3",
      executor: "claude-cli",
      budget_usd: 1,
      spent_usd: 0,
      ...project,
    },
    run_id: "r-00001",
    purpose: "work",
    role: roleByCode("researcher"),
    task: {
      id: "t-0001",
      text: "Вымышленная задача 1",
      done_when: "Есть краткий итог",
    },
    attempt: 1,
    context: {
      goal: "Сравнить цены трёх вымышленных поставщиков",
      memory: [],
      deps: [],
      note: null,
    },
    limits: {
      max_budget_usd: (project.budget_usd ?? 1) > 0 ? 0.25 : null,
      timeout_ms: 20_000,
      work_dir: work,
    },
    answer_schema: WORK_ANSWER_SCHEMA,
    scenario_path: null,
  };
}

// The io of check()/run(): real runs allowed (unless `realRuns` is false), a claude that
// does not exist, a spawn spy and an onEvent counter.
function executorIo(box, { platform, realRuns = true } = {}) {
  const env = { PATH: process.env.PATH, HOME: box.home };
  if (realRuns) env.SAI_TEAM_REAL_RUNS = "1";
  env.SAI_TEAM_CLAUDE_BIN = path.join(box.root, "no-such-claude");
  const io = {
    env,
    config: readConfig(env),
    signal: new AbortController().signal,
    spawned: 0,
    events: 0,
    spawn() {
      io.spawned += 1;
      throw new Error("spawn must not be called");
    },
    onEvent() {
      io.events += 1;
    },
  };
  if (platform !== undefined) io.platform = platform;
  return io;
}

const isCode = (code) => (err) => err instanceof TeamError && err.code === code;

test("PLT-12: check() refuses E_PLATFORM first for io.platform win32 (a valid request, no budget, real runs off, another executor) and goes on for linux; run() refuses before any process, event or write", async (t) => {
  const box = makeBox(t);
  const claude = getExecutor("claude-cli");
  const journalFile = path.join(box.work, "events.jsonl");
  fs.writeFileSync(journalFile, '{"type":"PROJECT_CREATED"}\n');
  const before = listing(box.root);
  const rows = [
    ["a valid request", fullRequest(box.work), {}, null],
    ["no budget", fullRequest(box.work, { budget_usd: 0 }), {}, "E_NO_BUDGET"],
    [
      "real runs off",
      fullRequest(box.work),
      { realRuns: false },
      "E_REAL_RUNS_OFF",
    ],
    [
      "another executor",
      fullRequest(box.work, { executor: "scripted" }),
      {},
      "E_EXECUTOR",
    ],
  ];
  for (const [label, request, ioOpts, linuxCode] of rows) {
    const win = executorIo(box, { ...ioOpts, platform: "win32" });
    assert.throws(
      () => claude.check(request, win),
      isCode("E_PLATFORM"),
      `win32, ${label}`,
    );
    for (const platform of ALLOWED) {
      const io = executorIo(box, { ...ioOpts, platform });
      if (linuxCode === null)
        assert.doesNotThrow(
          () => claude.check(request, io),
          `${platform}, ${label}`,
        );
      else
        assert.throws(
          () => claude.check(request, io),
          isCode(linuxCode),
          `${platform}, ${label}`,
        );
    }
  }
  // No io.platform: the running platform, judged by the oracle of this file.
  const plain = executorIo(box);
  if (ALLOWED.includes(process.platform))
    assert.doesNotThrow(() => claude.check(fullRequest(box.work), plain));
  else
    assert.throws(
      () => claude.check(fullRequest(box.work), plain),
      isCode("E_PLATFORM"),
    );
  // run(): refused before buildArgs, onEvent and spawn.
  const io = executorIo(box, { platform: "win32" });
  await assert.rejects(
    () => claude.run(fullRequest(box.work), io),
    isCode("E_PLATFORM"),
    "run() under win32",
  );
  assert.equal(io.spawned, 0, "spawn was called");
  assert.equal(io.events, 0, "onEvent was called");
  assert.equal(listing(box.root), before, "a file changed");
  assert.equal(plain.spawned + plain.events, 0);
});

const BAIT = "детали ядра /bait/path";

test("PLT-13: E_PLATFORM has plain words in the CLI and the team web - the resume of the control answers 409, a created project whose engine refuses answers 201, never the general text", async (t) => {
  assert.equal(typeof EXECUTOR_MESSAGES.E_PLATFORM, "string");
  const why = WHY_NOT_STARTED.E_PLATFORM;
  assert.equal(typeof why, "string", "WHY_NOT_STARTED has no E_PLATFORM");
  for (const word of ["Linux", "macOS"]) {
    assert.ok(EXECUTOR_MESSAGES.E_PLATFORM.includes(word), word);
    assert.ok(why.includes(word), word);
  }
  const api = fs.readFileSync(path.join(TOOLS, "src", "web", "api.js"), "utf8");
  assert.equal(api.match(/"E_PLATFORM"/gu)?.length ?? 0, 1, "api.js");
  const table = /const PREFLIGHT_CODES = Object\.freeze\(\[([^\]]*)\]\)/u.exec(
    api,
  );
  assert.ok(table !== null, "no PREFLIGHT_CODES table");
  assert.ok(table[1].includes('"E_PLATFORM"'), "not inside PREFLIGHT_CODES");
  const box = makeBox(t);
  fs.mkdirSync(box.team, { mode: 0o700 });
  const warned = [];
  const resume = controlFailure(
    { home: box.team, warn: (l) => warned.push(String(l)) },
    "p-20990101-a1b2c3",
    "resume",
    new TeamError("E_PLATFORM", BAIT),
  );
  assert.deepEqual(resume, {
    status: 409,
    body: {
      error_text: `Проект не продолжен: ${why}`,
      field: null,
      reload: false,
    },
  });
  const calls = [];
  const ctx = {
    home: box.team,
    env: { HOME: box.home, SAI_TEAM_HOME: box.team },
    config: { realRuns: true },
    executor: "scripted",
    scenarioBytes: Buffer.from(JSON.stringify({ version: 1, runs: [] })),
    engines: {
      start: async (id) => {
        calls.push(id);
        return { started: false, error: new TeamError("E_PLATFORM", BAIT) };
      },
    },
    warn: (l) => warned.push(String(l)),
  };
  const created = await postProject(ctx, {
    goal: "Вымышленная цель",
    budget_usd: 1,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.started, false);
  assert.equal(
    created.body.result_text,
    `Проект создан, но работа не началась: ${why}`,
  );
  assert.equal(calls.length, 1, "the engine was not asked");
  for (const r of [resume, created]) {
    const text = JSON.stringify(r);
    assert.equal(text.includes(WHY_OTHER), false, "the general text");
    assert.equal(text.includes(BAIT), false, "the bait is shown");
  }
  assert.deepEqual(warned, [], "a warning was written");
});

// ---- criterion 17: the mode is read back -------------------------------------------------

// A view of a real lstat with other mode bits (the kind bits stay).
function withMode(st, bits) {
  return {
    mode: (st.mode & ~0o777) | bits,
    uid: st.uid,
    isDirectory: () => st.isDirectory(),
    isSymbolicLink: () => st.isSymbolicLink(),
  };
}

// An fs over the real one whose chmodSync does nothing and whose lstat reports 0666.
function deafFs() {
  return {
    lstatSync: (p) => withMode(fs.lstatSync(p), 0o666),
    mkdirSync: (p, o) => fs.mkdirSync(p, o),
    chmodSync: () => {},
  };
}

// An fs over the real one that keeps what chmodSync sets; before that it reports `bits`.
function obeyingFs(bits) {
  const modes = new Map();
  return {
    lstatSync: (p) => withMode(fs.lstatSync(p), modes.get(p) ?? bits),
    mkdirSync: (p, o) => fs.mkdirSync(p, o),
    chmodSync: (p, m) => modes.set(p, m),
  };
}

function plainRefusal(err, label) {
  oneLineWithoutControls(err.message, label);
  assert.match(err.message, /[А-Яа-яЁё]/u, `${label}: no Cyrillic`);
  assert.equal(/^\s+at /mu.test(err.message), false, `${label}: a stack`);
  for (const w of ["0700", "0666"])
    assert.ok(err.message.includes(w), `${label}: no ${w}: ${err.message}`);
  assert.equal(err.message.includes("сужены"), false, `${label}: a notice`);
}

const NARROWED_0755 = "Права папки данных сужены до 0700 (были 0755)";

test("PLT-14: ensureHome and ensureStateDir read the mode back - a mode that did not hold is E_HOME / E_STATE_DIR with no notice; a mode that holds gives the notices of today", (t) => {
  const box = makeBox(t);
  let n = 0;
  const fresh = (exists) => {
    n += 1;
    const d = path.join(box.root, `dir-${n}`);
    if (exists) fs.mkdirSync(d, { mode: 0o700 });
    return d;
  };
  for (const exists of [false, true]) {
    const label = exists ? "an existing folder" : "a new folder";
    const home = fresh(exists);
    let notices = "not called";
    assert.throws(
      () => {
        notices = ensureHome(home, deafFs());
      },
      (err) => {
        assert.ok(err instanceof TeamError, `home, ${label}: ${err}`);
        assert.equal(err.code, "E_HOME", `home, ${label}`);
        plainRefusal(err, `home, ${label}`);
        return true;
      },
    );
    assert.equal(notices, "not called", `home, ${label}: a notice returned`);
    const state = fresh(exists);
    assert.throws(
      () => ensureStateDir(state, deafFs()),
      (err) => {
        assert.ok(err instanceof StateDirError, `state, ${label}: ${err}`);
        assert.equal(err.code, "E_STATE_DIR", `state, ${label}`);
        plainRefusal(err, `state, ${label}`);
        return true;
      },
    );
    assert.deepEqual(fs.readdirSync(state), [], `state, ${label}: written`);
  }
  // A file system that keeps the mode: the notice of today and no refusal.
  assert.deepEqual(ensureHome(fresh(true), obeyingFs(0o755)), [NARROWED_0755]);
  assert.doesNotThrow(() => ensureStateDir(fresh(true), obeyingFs(0o755)));
  assert.deepEqual(ensureHome(fresh(true), obeyingFs(0o700)), []);
  // The real file system (the run hosts Linux and macOS): a new folder 0700 without a
  // notice, a 0755 folder narrowed to 0700 with the notice.
  const mode = (d) => fs.lstatSync(d).mode & 0o777;
  const newHome = fresh(false);
  assert.deepEqual(ensureHome(newHome), [], "real fs, a new home");
  assert.equal(mode(newHome), 0o700);
  const wideHome = fresh(true);
  fs.chmodSync(wideHome, 0o755);
  assert.deepEqual(ensureHome(wideHome), [NARROWED_0755], "real fs, 0755");
  assert.equal(mode(wideHome), 0o700);
  const newState = fresh(false);
  ensureStateDir(newState);
  assert.equal(mode(newState), 0o700);
  const wideState = fresh(true);
  fs.chmodSync(wideState, 0o755);
  ensureStateDir(wideState);
  assert.equal(mode(wideState), 0o700);
});

// ---- criterion 18: the documents name the platforms --------------------------------------

test("PLT-15: tools/README.md has one section «Platforms» right after «Check» with the scripts, codes and records; each rights line names Linux and macOS", () => {
  const lines = fs
    .readFileSync(path.join(TOOLS, "README.md"), "utf8")
    .split("\n");
  assert.equal(
    lines.filter((l) => l === "## Platforms").length,
    1,
    "not exactly one heading ## Platforms",
  );
  const headings = lines.filter((l) => l.startsWith("## "));
  assert.equal(
    headings[headings.indexOf("## Check") + 1],
    "## Platforms",
    "## Platforms does not follow ## Check",
  );
  const start = lines.indexOf("## Platforms");
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
  const section = lines.slice(start, end).join("\n");
  for (const word of [
    "Linux and macOS",
    "Windows is a client",
    "drops the event silently",
    "E_PLATFORM",
    "decisions/0110",
    "decisions/0134",
  ])
    assert.ok(section.includes(word), `the section has no «${word}»`);
  const one = /`npm run pixel-office` with code 1/u;
  assert.match(section, one, "pixel-office with code 1");
  const two =
    /`npm run team`, `npm run team-web`, `npm run pixel-office-note` and `npm run e2e`[^.]*with code 2/u;
  assert.match(section, two, "the four scripts with code 2");
  for (const anchor of ["rights 0700", "folders 0700, files 0600"]) {
    const holders = lines.filter((l) => l.includes(anchor));
    assert.equal(holders.length, 1, `«${anchor}» not on exactly one line`);
    assert.ok(
      holders[0].includes("Linux and macOS"),
      `the line of «${anchor}» does not name Linux and macOS`,
    );
  }
});
