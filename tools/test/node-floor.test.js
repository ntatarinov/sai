// NF: the Node floor of tools/ (REQ-110, fix of ISS-0092; design
// docs/design/REQ-110-tools-node-floor.md, sections 2, 3, 5, 7, 9 and 10).
//
// The oracle of this file is its own: the floor of the refusal line and of the rows
// is read from `engines` of tools/package.json (the one source), and a test imports
// from tools/src only the guard module itself (NF-03, NF-04, NF-01) and the constant
// MAX_HEADER_BYTES of the picker (NF-07). Every start of a program of tools/ gets a
// HOME, TMPDIR, Pixel Office state folder and team home inside the test's own
// temporary folder, a limit and a SIGKILL after the test; servers only on port 0;
// the child environment is built from named variables, never from the whole
// process.env; SAI_TEAM_REAL_RUNS is never set and no test names a real state folder.
// A Node version is simulated by a preload that the test writes into its own folder.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  NODE_FLOOR,
  NODE_REFUSAL_EXIT,
  meetsNodeFloor,
  nodeFloorRefusal,
  refuseBelowNodeFloor,
} from "../src/node-floor.js";
import { MAX_HEADER_BYTES } from "../src/picker/config.js";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(TOOLS, "..");
const REAL_TMP = fs.realpathSync(os.tmpdir());

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const ENGINES = JSON.parse(readText("tools/package.json")).engines.node;
const LOCK_ENGINES = JSON.parse(readText("tools/package-lock.json")).packages[
  ""
].engines.node;
const SCRIPTS = JSON.parse(readText("tools/package.json")).scripts;
// The floor as the one source states it, for the oracles of this file.
const FLOOR = /^>=(\d+\.\d+\.\d+) </u.exec(ENGINES)?.[1] ?? "";
const FLOOR_PARTS = FLOOR.split(".").map(Number);

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ---- NF-01, NF-02, NF-09: one floor in every place that states it -------------------

const HOOK_REL = "tools/src/pixel-office/hook.sh";
const README_REL = "tools/README.md";
const PREPUSH_REL = ".githooks/pre-push";
const WORKFLOW_REL = ".github/workflows/check.yml";
// A text of the form 22.<n>.<n> with borders: not after a digit or "<digit>.", not
// before a digit or ".<digit>".
const FLOOR_TEXT = /(?<!\d)(?<!\d\.)22\.(\d+)\.(\d+)(?!\d)(?!\.\d)/gu;
// The two history mentions of 22.21.1: found exactly once each, on a line that starts so.
const HISTORY = [
  {
    file: README_REL,
    start: "**A consequence of the rule M7.**",
    value: "22.21.1",
  },
  {
    file: "tools/src/util.js",
    start: "// No `encoding` in these options, on purpose",
    value: "22.21.1",
  },
];
// The lines that must hold the floor; each anchor stands on exactly one line.
const NAMED = [
  { file: README_REL, anchor: "The one check command (quality-bar Q4)" },
  { file: README_REL, anchor: "The default port is" },
  { file: README_REL, anchor: "The second variable is `SAI_NODE_FALLBACKS`" },
  {
    file: README_REL,
    anchor: "The command starts `tools/src/pixel-office/hook.sh`",
  },
  { file: PREPUSH_REL, anchor: "не найден npm" },
];

function lineSplit(text) {
  return text.split(/\r?\n/u);
}

// texts: Map of a path relative to the project root -> text; the walked files.
function floorFindings({ texts, floor, engines, lock }) {
  const out = [];
  let seen = 0;
  const major = Number(floor.split(".")[0]);
  const m = /^>=(\d+)\.(\d+)\.(\d+) <(\d+)$/u.exec(engines ?? "");
  if (
    m === null ||
    `${m[1]}.${m[2]}.${m[3]}` !== floor ||
    Number(m[4]) !== major + 1
  )
    out.push(`engines ${engines} is not >=${floor} <${major + 1}`);
  if (lock !== engines)
    out.push(`the lockfile root engines ${lock} is not ${engines}`);
  const hookLines = lineSplit(texts.get(HOOK_REL) ?? "").filter((l) =>
    l.startsWith("node_floor="),
  );
  if (hookLines.length !== 1 || hookLines[0] !== `node_floor=${floor}`)
    out.push(`hook floor lines ${JSON.stringify(hookLines)}`);
  const history = new Map(HISTORY.map((h) => [h.file, 0]));
  for (const [file, text] of texts) {
    lineSplit(text).forEach((line, i) => {
      for (const hit of line.matchAll(FLOOR_TEXT)) {
        const value = hit[0];
        if (value === floor) {
          seen += 1;
          continue;
        }
        const h = HISTORY.find(
          (x) =>
            x.file === file &&
            x.value === value &&
            line.trimStart().startsWith(x.start),
        );
        if (h === undefined) out.push(`${file}:${i + 1} states ${value}`);
        else history.set(file, history.get(file) + 1);
      }
    });
  }
  for (const h of HISTORY)
    if (history.get(h.file) !== 1)
      out.push(
        `${h.file}: the history mention ${h.value} found ${history.get(h.file)} times, need 1`,
      );
  for (const n of NAMED) {
    const lines = lineSplit(texts.get(n.file) ?? "").filter((l) =>
      l.includes(n.anchor),
    );
    if (lines.length !== 1) {
      out.push(
        `${n.file}: the anchor "${n.anchor}" is on ${lines.length} lines`,
      );
      continue;
    }
    if (!lines[0].includes(floor))
      out.push(`${n.file}: the line of "${n.anchor}" does not name ${floor}`);
    if (
      n.anchor.startsWith("The one check") &&
      !lines[0].includes(`\`${engines}\``)
    )
      out.push(
        `${n.file}: the line of "${n.anchor}" does not hold \`${engines}\``,
      );
  }
  return { out, seen };
}

function walkFiles(dir, files = []) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, files);
    else if (e.isFile()) files.push(p);
  }
  return files;
}

function realTexts() {
  const texts = new Map();
  for (const abs of walkFiles(path.join(TOOLS, "src")))
    texts.set(
      path.relative(ROOT, abs).split(path.sep).join("/"),
      fs.readFileSync(abs, "utf8"),
    );
  for (const rel of [README_REL, PREPUSH_REL, WORKFLOW_REL])
    texts.set(rel, readText(rel));
  return texts;
}

function realInput() {
  return {
    texts: realTexts(),
    floor: NODE_FLOOR,
    engines: ENGINES,
    lock: LOCK_ENGINES,
  };
}

function withTexts(input, edits, extra = {}) {
  const texts = new Map(input.texts);
  for (const [file, edit] of Object.entries(edits)) {
    const before = texts.get(file);
    assert.notEqual(before, undefined, `no file ${file}`);
    const after = edit(before);
    assert.notEqual(after, before, `the edit of ${file} changed nothing`);
    texts.set(file, after);
  }
  return { ...input, ...extra, texts };
}

// An edit of the one line that holds an anchor.
function onLine(anchor, edit) {
  return (text) =>
    lineSplit(text)
      .map((l) => (l.includes(anchor) ? edit(l) : l))
      .join("\n");
}

test("NF-01: engines, the lockfile root, the module, the hook line and every bordered 22.n.n text of the walked files state one floor", () => {
  const { out, seen } = floorFindings(realInput());
  assert.deepEqual(out, []);
  assert.ok(seen >= 7, `only ${seen} texts of the floor were seen`);
  assert.equal(FLOOR, NODE_FLOOR, "engines and the module differ");
});

test("NF-02: the check of NF-01 is not blind - every damaged copy gives a finding, the border twins none", () => {
  const input = realInput();
  assert.deepEqual(floorFindings(input).out, [], "the real files");
  const other = (text) => text.replace(NODE_FLOOR, "22.23.3");
  const append = (line) => (text) => `${text}\n${line}\n`;
  const damaged = [
    [
      "README 157 at 22.23.3",
      {
        [README_REL]: onLine(
          "The second variable is `SAI_NODE_FALLBACKS`",
          other,
        ),
      },
    ],
    [
      "README 207 at 22.23.3",
      {
        [README_REL]: onLine(
          "The command starts `tools/src/pixel-office/hook.sh`",
          other,
        ),
      },
    ],
    ["pre-push at 22.23.3", { [PREPUSH_REL]: other }],
    [
      "a stray 22.23.5 in a comment",
      { "tools/src/web/main.js": append("// 22.23.5") },
    ],
    [
      "node-version 22.23.3 in check.yml",
      {
        [WORKFLOW_REL]: (x) =>
          x.replace('node-version: "22"', 'node-version: "22.23.3"'),
      },
    ],
    ["the lockfile root at 22.23.3", {}, { lock: ">=22.23.3 <23" }],
    ["engines of the tag", {}, { engines: ">=22 <23", lock: ">=22 <23" }],
    [
      "the hook line at 22.23.3",
      {
        [HOOK_REL]: (x) =>
          x.replace(`node_floor=${NODE_FLOOR}`, "node_floor=22.23.3"),
      },
    ],
    [
      "the hook floor as two numbers",
      {
        [HOOK_REL]: (x) =>
          x.replace(
            `node_floor=${NODE_FLOOR}`,
            "node_floor_minor=23\nnode_floor_patch=4",
          ),
      },
    ],
    [
      "README line 9 with >=22 <23 while it names the floor elsewhere",
      {
        [README_REL]: onLine("The one check command (quality-bar Q4)", (l) =>
          l.replace(`\`${ENGINES}\``, "`>=22 <23`"),
        ),
      },
    ],
    [
      "a third 22.21.1 in a comment",
      { "tools/src/cli.js": append("// 22.21.1") },
    ],
    [
      "the history 22.21.1 moved off its README line to another one",
      {
        [README_REL]: (x) =>
          onLine(
            "The default port is",
            (l) => `${l} 22.21.1`,
          )(
            onLine("**A consequence of the rule M7.**", (l) =>
              l.replace("22.21.1", "22.x"),
            )(x),
          ),
      },
    ],
    [
      "22.23.3 at the end of a sentence",
      { [README_REL]: append("it ends with 22.23.3.") },
    ],
    ["v22.23.3", { [README_REL]: append("the version v22.23.3 runs") }],
  ];
  for (const [name, edits, extra] of damaged) {
    const found = floorFindings(withTexts(input, edits, extra)).out;
    assert.ok(found.length > 0, `${name}: no finding`);
  }
  for (const twin of ["122.23.3", "22.23.3.9", "1.22.23.3"]) {
    const found = floorFindings(
      withTexts(input, { [README_REL]: append(`a text ${twin} here`) }),
    ).out;
    assert.deepEqual(found, [], `the border twin ${twin}`);
  }
});

// The exact texts of README lines 157 and 207 of the design (section 8), found by their
// anchors; `@FLOOR@` stands for the floor.
const README_157 =
  "The folder can be changed with the variable `SAI_PIXEL_OFFICE_DIR` (an absolute path), the same one for the server and for Claude Code; the key `--dir` alone is not enough (limit 12). The second variable is `SAI_NODE_FALLBACKS`: folders separated by a colon where `hook.sh` looks for a Node 22 at or above @FLOOR@ (for example, `<Node 22 folder>:<one more folder>`); if it is not set, `hook.sh` looks in the standard Homebrew folders for node@22 (they are written in `tools/src/pixel-office/hook.sh`).";
const README_207 =
  "- The command starts `tools/src/pixel-office/hook.sh`, and that takes only a Node 22 at or above @FLOOR@, by the `--version` of each candidate: first the path from the file `node-path`, then `node` from `PATH`, then the folders from `SAI_NODE_FALLBACKS`; a candidate below the floor, of another major or that cannot start is skipped for the next one. If none is left, the hook ends quietly with code 0 and the event is lost: it is not written later. The hook has no timer of its own: a candidate whose `--version` does not answer holds the hook until the time-out of its handler in `.claude/settings.json` ends it, and that event is lost too.";
const README_PINNED = [
  ["The second variable is `SAI_NODE_FALLBACKS`", README_157],
  ["The command starts `tools/src/pixel-office/hook.sh`", README_207],
];

function pinnedFindings(readme, floor) {
  const out = [];
  const lines = lineSplit(readme);
  for (const [anchor, template] of README_PINNED) {
    const found = lines.filter((l) => l.includes(anchor));
    if (found.length !== 1) {
      out.push(`the anchor "${anchor}" is on ${found.length} lines`);
      continue;
    }
    if (found[0] !== template.replaceAll("@FLOOR@", floor))
      out.push(`the line of "${anchor}" is not the text of the design`);
  }
  return out;
}

test("NF-09: README lines of the hook (the second variable, the command) are the exact texts of the design; the damaged copies are red", () => {
  const readme = readText(README_REL);
  assert.deepEqual(pinnedFindings(readme, NODE_FLOOR), []);
  const second = "The second variable is `SAI_NODE_FALLBACKS`";
  const command = "The command starts `tools/src/pixel-office/hook.sh`";
  const damaged = [
    [
      "157 in the form of the floor in brackets",
      onLine(second, (l) =>
        l.replace(
          `looks for a Node 22 at or above ${NODE_FLOOR} (for example`,
          `looks for Node 22 (the floor: at or above ${NODE_FLOOR}; for example`,
        ),
      ),
    ],
    [
      "207 with finds Node 22 (floor)",
      onLine(command, (l) =>
        l.replace(
          `takes only a Node 22 at or above ${NODE_FLOOR}`,
          `finds Node 22 (floor ${NODE_FLOOR})`,
        ),
      ),
    ],
    [
      "207 without the sentence of the hang limit",
      onLine(command, (l) =>
        l.replace(/ The hook has no timer of its own:.*$/u, ""),
      ),
    ],
  ];
  for (const [name, edit] of damaged) {
    const after = edit(readme);
    assert.notEqual(after, readme, `${name}: the edit changed nothing`);
    assert.notDeepEqual(pinnedFindings(after, NODE_FLOOR), [], name);
  }
});

// ---- NF-03, NF-04: the rule and the guard (the module is the subject) ---------------

test("NF-03: the version rule - every refused row false, every accepted row true, and the rows read from the floor itself", () => {
  const refused = [
    // another major (the upper bound is the next major)
    "21.7.0",
    "23.0.0",
    "24.11.0",
    "25.2.1",
    // another major whose minor and patch are at or above the floor's
    "23.24.0",
    "24.23.4",
    "23.23.4",
    "21.24.0",
    "21.23.4",
    // below the floor, compared as numbers
    "22.0.0",
    "22.3.0",
    "22.21.1",
    "22.22.0",
    "22.23.0",
    "22.23.3",
    // not three whole numbers
    "22.23",
    "22.23.4.1",
    "22.23.x",
    "22.24.0-pre",
    "x",
    "",
    "v22.23.4",
    "22.23.4+build",
    "+22.23.4",
    "22.-1.4",
    "22..4",
    // a leading zero, a space or a line end, a part of ten digits or more
    "022.23.4",
    "22.023.4",
    "22.23.04",
    " 22.23.4",
    "22.23.4 ",
    "22.23.4\n",
    "2222222222.0.0",
    "22.1000000000.0",
    "22.23.1000000000",
    // not a string
    undefined,
    null,
    22.234,
    22,
    {},
    ["22.23.4"],
  ];
  for (const v of refused)
    assert.equal(meetsNodeFloor(v), false, `row ${JSON.stringify(v)} accepted`);
  const accepted = [
    "22.23.4",
    "22.23.10",
    "22.24.0",
    "22.100.0",
    "22.999999999.0",
    "22.23.999999999",
  ];
  for (const v of accepted)
    assert.equal(meetsNodeFloor(v), true, `row ${JSON.stringify(v)} refused`);
  // read from the rule: the floor and its neighbours
  const [maj, min, pat] = NODE_FLOOR.split(".").map(Number);
  assert.equal(meetsNodeFloor(NODE_FLOOR), true, "the floor itself");
  assert.equal(
    meetsNodeFloor(
      pat > 0 ? `${maj}.${min}.${pat - 1}` : `${maj}.${min - 1}.999`,
    ),
    false,
    "the floor minus one patch",
  );
  assert.equal(meetsNodeFloor(`${maj + 1}.0.0`), false, "the next major");
  assert.equal(
    meetsNodeFloor(`${maj + 1}.${min + 1}.${pat}`),
    false,
    "next major, minor + 1",
  );
  assert.equal(
    meetsNodeFloor(`${maj - 1}.${min + 1}.${pat}`),
    false,
    "previous major, minor + 1",
  );
  assert.equal(meetsNodeFloor(`${maj}.${min + 1}.0`), true, "minor + 1");
  // a grid by class of input against an oracle of this file (numbers, not text)
  for (const a of [20, 21, 22, 23, 24])
    for (const b of [0, 1, 3, 22, 23, 24, 100])
      for (const c of [0, 3, 4, 5, 10, 100]) {
        const want =
          a === FLOOR_PARTS[0] &&
          (b > FLOOR_PARTS[1] || (b === FLOOR_PARTS[1] && c >= FLOOR_PARTS[2]));
        assert.equal(meetsNodeFloor(`${a}.${b}.${c}`), want, `${a}.${b}.${c}`);
      }
});

function oneLineWithoutControls(line) {
  assert.equal(typeof line, "string");
  for (const ch of line) {
    const n = ch.codePointAt(0);
    assert.ok(
      !(n < 32 || (n >= 127 && n < 160) || n === 0x2028 || n === 0x2029),
      `a control character U+${n.toString(16)} in the refusal line`,
    );
  }
}

test("NF-04: the refusal line and the guard - one line, the versions, no stack; a hostile text is not shown; a writer that throws does not stop the exit code", () => {
  for (const v of ["22.21.1", "22.23.3", "21.7.0", "25.2.1"]) {
    const line = nodeFloorRefusal(v);
    oneLineWithoutControls(line);
    assert.match(line, /[А-Яа-яЁё]/u, "Cyrillic");
    assert.ok(line.includes(v) && line.includes(NODE_FLOOR), `${v}: ${line}`);
    assert.equal(/^\s+at /mu.test(line), false);
    assert.equal(line.endsWith("\n"), false);
  }
  const hostile = [
    "22.21.1\nsecret=abc",
    "22.21.1\r",
    "22.21.1\u001b[31m",
    "a b",
    "x".repeat(65),
    String.fromCharCode(0x2028),
    "",
    "é",
    "../etc",
    "<b>",
    "$(id)",
  ];
  for (const v of hostile) {
    const line = nodeFloorRefusal(v);
    oneLineWithoutControls(line);
    assert.ok(line.includes("неизвестная версия"), JSON.stringify(v));
    if (v !== "") assert.equal(line.includes(v), false, JSON.stringify(v));
  }
  assert.ok(nodeFloorRefusal("a".repeat(64)).includes("a".repeat(64)));
  const bomb = {
    toString() {
      throw new Error("toString was called");
    },
  };
  for (const v of [undefined, null, 22.21, bomb]) {
    assert.ok(nodeFloorRefusal(v).includes("неизвестная версия"));
  }
  // the guard
  const writes = [];
  const recorder = { write: (s) => writes.push(s) };
  assert.equal(refuseBelowNodeFloor(recorder, "22.21.1"), true);
  assert.deepEqual(writes, [`${nodeFloorRefusal("22.21.1")}\n`], "one write");
  const thrower = {
    write() {
      throw new Error("closed");
    },
  };
  let result;
  assert.doesNotThrow(() => {
    result = refuseBelowNodeFloor(thrower, "22.21.1");
  }, "row throwing writer: the guard throws");
  assert.equal(result, true, "row throwing writer: not refused");
  let calls = 0;
  const counter = {
    write() {
      calls += 1;
      throw new Error("must not be called");
    },
  };
  assert.equal(refuseBelowNodeFloor(counter, NODE_FLOOR), false);
  assert.equal(refuseBelowNodeFloor(recorder, "22.24.0"), false);
  assert.equal(calls, 0, "the writer was called at the floor");
  assert.equal(writes.length, 1, "the writer was called at the floor");
  assert.equal(NODE_REFUSAL_EXIT, 2);
});

// ---- the temporary world of a start ----------------------------------------------------

const LIMIT_MS = 15_000;
const LINK_RE = /http:\/\/127\.0\.0\.1:(\d+)\//u;
// The version preload, written into the test's own folder: when SAI_TEST_NODE_VERSION
// is set it replaces process.versions.node and process.version (both are configurable).
const PRELOAD_TEXT = [
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
  const root = fs.mkdtempSync(path.join(REAL_TMP, "nf-"));
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
  box.preload = path.join(box.pre, "version-preload.mjs");
  fs.writeFileSync(box.preload, PRELOAD_TEXT);
  box.tenants = path.join(box.pre, "tenants");
  fs.mkdirSync(box.tenants);
  fs.copyFileSync(
    path.join(TOOLS, "src", "picker", "demo-tenants", "uchet-pro.json"),
    path.join(box.tenants, "uchet-pro.json"),
  );
  return box;
}

// The environment of a child: named variables only.
function childEnv(box, version, extra = {}) {
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
  if (version !== undefined) env.SAI_TEST_NODE_VERSION = version;
  return env;
}

// A program of tools/ as a child with the version preload, a limit and a SIGKILL after
// the test. `link` resolves to the port of the first link line, or null when it ended
// without one.
function spawnChild(t, box, file, args, { version, env = {} } = {}) {
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
      env: childEnv(box, version, env),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const out = { stdout: "", stderr: "", timedOut: false, linkSeen: false };
  child.stdout.on("data", (d) => (out.stdout += d));
  child.stderr.on("data", (d) => (out.stderr += d));
  const done = new Promise((resolve) =>
    child.on("close", (code, signal) => resolve({ code, signal })),
  );
  const timer = setTimeout(() => {
    out.timedOut = true;
    child.kill("SIGKILL");
  }, LIMIT_MS);
  done.then(() => clearTimeout(timer));
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  });
  const link = new Promise((resolve) => {
    child.stdout.on("data", () => {
      const m = LINK_RE.exec(out.stdout);
      if (m !== null) {
        out.linkSeen = true;
        resolve(Number(m[1]));
      }
    });
    done.then(() => resolve(null));
  });
  return {
    child,
    out,
    done,
    link,
    stop() {
      child.kill("SIGTERM");
      return done;
    },
  };
}

// One run to the end. `onLink`: "stop" ends a server by SIGTERM at its link line; "fail"
// kills it at once (a refused start must never print a link).
async function runChild(t, box, file, args, { onLink, ...opts } = {}) {
  const c = spawnChild(t, box, file, args, opts);
  c.link.then((port) => {
    if (port === null) return;
    if (onLink === "stop") c.stop();
    else if (onLink === "fail") c.child.kill("SIGKILL");
  });
  const end = await c.done;
  return { ...end, ...c.out };
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

function listAll(box) {
  return Object.fromEntries(
    ["home", "tmp", "state", "team", "work"].map((k) => [k, listing(box[k])]),
  );
}

function refusalLine(version) {
  return `Нужен Node ${FLOOR_PARTS[0]} не ниже ${FLOOR}, а запущен ${version}: команда остановлена, ничего не записано. Подробности — tools/README.md, раздел «Check».\n`;
}

// ---- NF-05: every entry point refuses below the floor, before it does anything -------

// The rows of design 9.2: every `node <file>` script of tools/package.json and a second
// command of each program that serves several, plus the report program that has no script.
// args(box) -> arguments that write nothing outside the test's folders even if not refused.
const ROWS = [
  {
    key: "prepare-run",
    script: "prepare-run",
    file: "src/cli.js",
    args: (b) => ["prepare-run", "--root", b.work],
  },
  {
    key: "validate",
    script: "validate",
    file: "src/cli.js",
    args: (b) => ["validate", "--root", b.work],
  },
  {
    key: "apply-verdict",
    script: "apply-verdict",
    file: "src/cli.js",
    args: (b) => ["apply-verdict", "--root", b.work],
  },
  {
    key: "snapshot",
    script: "snapshot",
    file: "src/cli.js",
    args: (b) => ["snapshot", "--root", b.work],
  },
  {
    key: "snapshot-diff",
    script: "snapshot-diff",
    file: "src/cli.js",
    args: () => ["snapshot-diff"],
  },
  {
    key: "pixel-office",
    script: "pixel-office",
    file: "src/pixel-office/main.js",
    args: () => ["--port", "0"],
    server: true,
    code: 1,
  },
  {
    key: "pixel-office-note",
    script: "pixel-office-note",
    file: "src/pixel-office/note.js",
    args: () => ["--text", "x"],
  },
  {
    key: "pixel-office-note, storage off",
    second: true,
    file: "src/pixel-office/note.js",
    args: () => ["--text", "x"],
    env: { SAI_PIXEL_OFFICE_STORE_TEXT: "0" },
  },
  {
    key: "team",
    script: "team",
    file: "src/team/cli.js",
    args: () => ["projects"],
  },
  {
    key: "team, second command",
    second: true,
    file: "src/team/cli.js",
    args: () => ["project", "01-alpha"],
  },
  {
    key: "team-web",
    script: "team-web",
    file: "src/web/main.js",
    args: () => ["--port", "0"],
    server: true,
  },
  {
    key: "traces",
    script: "traces",
    file: "src/traces/cli.js",
    args: (b) => ["check", "--root", b.work],
  },
  {
    key: "traces, second command",
    second: true,
    file: "src/traces/cli.js",
    args: (b) => [
      "hash-line",
      "--file",
      "a.txt",
      "--line",
      "1",
      "--root",
      b.work,
    ],
  },
  {
    key: "handoffs-check",
    script: "handoffs-check",
    file: "src/handoffs/cli.js",
    args: (b) => ["--root", b.work],
  },
  {
    key: "handoffs-check, second mode",
    second: true,
    file: "src/handoffs/cli.js",
    args: (b) => ["--root", b.work, "--emit-exceptions"],
  },
  {
    key: "handoff",
    script: "handoff",
    file: "src/handoffs/handoff.js",
    args: () => [
      "close",
      "handoffs/X-20990101-01/step-01-x.json",
      "--status",
      "COMPLETED",
    ],
  },
  {
    key: "handoff, second command",
    second: true,
    file: "src/handoffs/handoff.js",
    args: () => [
      "new",
      "--run",
      "X-20990101-01",
      "--step",
      "01",
      "--role",
      "BACKEND-DEV",
      "--workflow",
      "WF-02",
      "--task",
      "x",
    ],
  },
  {
    key: "picker",
    script: "picker",
    file: "src/picker/cli.js",
    args: (b) => ["check", path.join(b.work, "absent.json")],
  },
  {
    key: "picker, second command",
    second: true,
    file: "src/picker/cli.js",
    args: (b) => [
      "serve",
      "--tenants",
      b.tenants,
      "--home",
      b.home,
      "--port",
      "0",
    ],
    server: true,
  },
  {
    key: "e2e",
    script: "e2e",
    file: "test/e2e/run.js",
    args: () => ["no-such-spec"],
  },
  {
    key: "office-report",
    file: "src/pixel-office/public/office-report.js",
    args: (b) => ["--journal", path.join(b.work, "absent.jsonl")],
  },
  // Twins that make a read before the guard visible although it writes nothing: a
  // warning of a foreign --dir would come before the refusal, a wrong value of the
  // configuration would replace it (security review step 05, I2 b; review step 05b, I4 b).
  {
    key: "pixel-office, a foreign --dir",
    variant: true,
    file: "src/pixel-office/main.js",
    args: (b) => ["--port", "0", "--dir", path.join(b.root, "elsewhere")],
    server: true,
    code: 1,
  },
  {
    key: "team-web, a wrong configuration",
    variant: true,
    file: "src/web/main.js",
    args: () => ["--port", "0"],
    env: { SAI_TEAM_TASK_TIMEOUT_MS: "abc" },
    server: false,
  },
];

function nodeFileScripts() {
  const files = new Map();
  const stray = [];
  for (const [name, body] of Object.entries(SCRIPTS)) {
    if (!/^node(\s|$)/u.test(body)) continue;
    const m = /^node ([^\s-][^\s]*)(?: (.*))?$/u.exec(body);
    if (m !== null) files.set(name, m[1]);
    else if (!(name === "test" && body === 'node --test "test/**/*.test.js"'))
      stray.push(name);
  }
  return { files, stray };
}

test("NF-05a: every node <file> script has a row, every row's script exists and runs its file; the second commands are the named rows", () => {
  const { files, stray } = nodeFileScripts();
  assert.deepEqual(
    stray,
    [],
    "a script starts with node but is not a node <file> script",
  );
  const scriptRows = ROWS.filter((r) => r.script !== undefined);
  assert.deepEqual(
    scriptRows.map((r) => r.script).sort(),
    [...files.keys()].sort(),
    "the rows and the node <file> scripts differ",
  );
  for (const r of scriptRows)
    assert.equal(
      r.file,
      files.get(r.script),
      `row ${r.key}: another file than its script`,
    );
  // By design the counts below are edited together with a new script and its row.
  assert.equal(files.size, 14, "the count of node <file> scripts");
  assert.deepEqual(
    ROWS.filter((r) => r.second).map((r) => r.key),
    [
      "pixel-office-note, storage off",
      "team, second command",
      "traces, second command",
      "handoffs-check, second mode",
      "handoff, second command",
      "picker, second command",
    ],
  );
  assert.deepEqual(
    ROWS.filter((r) => r.script === undefined && !r.second && !r.variant).map(
      (r) => r.key,
    ),
    ["office-report"],
  );
  assert.equal(ROWS.length, 23);
  for (const r of ROWS)
    assert.ok(
      fs.existsSync(path.join(TOOLS, r.file)),
      `row ${r.key}: no file ${r.file}`,
    );
});

test("NF-05b: the positive control of the version preload - the simulated version is what an ES entry and a -p probe see; without it the real version", async (t) => {
  const box = makeBox(t);
  const probe = path.join(box.pre, "probe.mjs");
  fs.writeFileSync(
    probe,
    "console.log(process.versions.node, process.version);\n",
  );
  const run = (version) =>
    new Promise((resolve) => {
      const c = spawn(
        process.execPath,
        ["--import", pathToFileURL(box.preload).href, probe],
        {
          cwd: box.work,
          env: childEnv(box, version),
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let out = "";
      c.stdout.on("data", (d) => (out += d));
      c.on("close", () => resolve(out.trim()));
    });
  for (const v of ["22.21.1", "22.23.3", "21.7.0", "22.23.4"])
    assert.equal(await run(v), `${v} v${v}`, `simulated ${v}`);
  assert.equal(
    await run(undefined),
    `${process.versions.node} ${process.version}`,
  );
});

test("NF-05c: below the floor every entry row ends with its code, an empty stdout and exactly the refusal line, writes nothing and starts nothing", async (t) => {
  for (const version of ["22.21.1", "22.23.3"]) {
    for (const row of ROWS) {
      const box = makeBox(t);
      const label = `${row.key} under ${version}`;
      const before = listAll(box);
      const r = await runChild(t, box, row.file, row.args(box), {
        version,
        env: row.env,
        onLink: "fail",
      });
      assert.equal(r.timedOut, false, `${label}: did not end by itself`);
      assert.equal(r.linkSeen, false, `${label}: a server started`);
      assert.equal(r.signal, null, `${label}: signal ${r.signal}`);
      assert.equal(
        r.code,
        row.code ?? 2,
        `${label}: code ${r.code}, stderr ${r.stderr}`,
      );
      assert.equal(r.stdout, "", `${label}: stdout is not empty`);
      assert.equal(
        r.stderr,
        refusalLine(version),
        `${label}: stderr is not the refusal line`,
      );
      assert.deepEqual(listAll(box), before, `${label}: a folder changed`);
    }
  }
});

test("NF-05d: at the floor the same starts print no refusal line and end as under the running Node; a server row reaches its link line", async (t) => {
  for (const row of ROWS) {
    const box = makeBox(t);
    const label = `${row.key} at the floor`;
    const simulated = await runChild(t, box, row.file, row.args(box), {
      version: FLOOR,
      env: row.env,
      onLink: "stop",
    });
    assert.equal(simulated.timedOut, false, `${label}: did not end`);
    assert.equal(
      simulated.stderr.includes("Нужен Node"),
      false,
      `${label}: refused: ${simulated.stderr}`,
    );
    if (row.server === true)
      assert.equal(
        simulated.linkSeen,
        true,
        `${label}: no link line: ${simulated.stderr}`,
      );
    const realBox = makeBox(t);
    const real = await runChild(t, realBox, row.file, row.args(realBox), {
      env: row.env,
      onLink: "stop",
    });
    assert.equal(
      real.stderr.includes("Нужен Node"),
      false,
      `${row.key} under the running Node: refused: ${real.stderr}`,
    );
    if (row.server !== true)
      assert.equal(
        simulated.code,
        real.code,
        `${label}: another code than under the running Node`,
      );
  }
});

// ---- NF-06: the check command (criterion 6) ---------------------------------------------

const WRITING_OPTIONS = {
  prettier: [
    "--write",
    "-w",
    "--cache",
    "--cache-location",
    "--experimental-cli",
  ],
  eslint: [
    "--fix",
    "--cache",
    "--cache-location",
    "--cache-file",
    "--output-file",
    "-o",
    "--suppress-all",
    "--prune-suppressions",
    "--suppress-rule",
    "--suppressions-location",
    "--init",
    "--mcp",
    "--inspect-config",
  ],
};

// The findings of the steps of `check` before the first `npm run traces`.
function checkFindings(scripts) {
  const out = [];
  const check = scripts.check;
  if (typeof check !== "string") return ["no check script"];
  const steps = check.split(" && ");
  for (const s of steps)
    if (/[&|;]/u.test(s)) out.push(`the step "${s}" holds & | or ;`);
  const first = steps.indexOf("npm run traces");
  if (first < 0) return [...out, "no step npm run traces"];
  for (const step of steps.slice(0, first)) {
    const m = /^npm run ([\w:-]+)$/u.exec(step);
    if (m === null) {
      out.push(`the step "${step}" is not npm run <name>`);
      continue;
    }
    const body = scripts[m[1]];
    if (typeof body !== "string") {
      out.push(`no script ${m[1]}`);
      continue;
    }
    const tokens = body.split(/\s+/u).filter((x) => x !== "");
    if (tokens[0] !== "prettier" && tokens[0] !== "eslint")
      out.push(`${m[1]}: the first token is ${tokens[0]}`);
    if (/[&|;<>`$()\r\n]/u.test(body)) out.push(`${m[1]}: a sign of the ban`);
    if (tokens.includes("tee")) out.push(`${m[1]}: tee`);
    const writing = WRITING_OPTIONS[tokens[0]] ?? [];
    for (const token of tokens.slice(1)) {
      const name = token.split("=")[0];
      const parts = /^-[A-Za-z]{2,}$/u.test(name)
        ? [...name.slice(1)].map((c) => `-${c}`)
        : [name];
      for (const p of parts)
        if (writing.includes(p)) out.push(`${m[1]}: the option ${p} writes`);
    }
  }
  return out;
}

test("NF-06: the steps of npm run check before npm run traces write nothing - the real scripts are clean, every damaged copy is red, the twins are green", () => {
  const real = SCRIPTS;
  assert.deepEqual(checkFindings(real), []);
  assert.ok(
    real.check.split(" && ").indexOf("npm run traces") >= 2,
    "steps before traces",
  );
  const withScripts = (over) => ({ ...real, ...over });
  const lint = (body) => withScripts({ lint: body });
  const format = (body) => withScripts({ "format:check": body });
  const red = [
    ["prettier --write", format("prettier --write .")],
    ["prettier -w after --check", format("prettier --check . -w")],
    ["prettier -lw", format("prettier -lw .")],
    ["prettier --cache", format("prettier --check --cache .")],
    [
      "prettier --cache-location=x",
      format("prettier --check --cache-location=x ."),
    ],
    [
      "prettier --experimental-cli",
      format("prettier --check . --experimental-cli"),
    ],
    ["eslint --fix", lint("eslint . --fix")],
    ["eslint --cache", lint("eslint . --cache")],
    ["eslint -o", lint("eslint . -o report.txt")],
    ["eslint --output-file=", lint("eslint . --output-file=r.txt")],
    ["eslint redirect", lint("eslint . --max-warnings 0 > lint.txt")],
    ["eslint --suppress-all", lint("eslint . --suppress-all")],
    ["eslint --prune-suppressions", lint("eslint . --prune-suppressions")],
    ["eslint --suppress-rule", lint("eslint . --suppress-rule no-undef")],
    [
      "eslint --suppressions-location",
      lint("eslint . --suppressions-location x.json"),
    ],
    ["eslint --init", lint("eslint --init")],
    ["eslint --mcp", lint("eslint --mcp")],
    ["eslint --inspect-config", lint("eslint . --inspect-config")],
    ["eslint --cache-file", lint("eslint . --cache-file x")],
    ["eslint | tee", lint("eslint . | tee x")],
    ["an environment assignment", lint("X=1 eslint .")],
    ["npx", lint("npx eslint .")],
    ["a path", lint("./node_modules/.bin/eslint .")],
    [
      "|| between the steps",
      withScripts({ check: real.check.replace(" && ", " || ") }),
    ],
    [
      "npm run test before the steps",
      withScripts({ check: `npm run test && ${real.check}` }),
    ],
    [
      "a step that is not npm run",
      withScripts({ check: `eslint . && ${real.check}` }),
    ],
    ["a sign: ;", lint("eslint . --max-warnings 0 ; touch x")],
    ["a sign: && npm test", lint("eslint . --max-warnings 0 && npm test")],
    ["a sign: $(", lint("eslint . $(touch x)")],
    ["a sign: backtick", lint("eslint . `touch x`")],
    ["a sign: | dd", lint("eslint . | dd of=x")],
    // forms refused on purpose (the rule reads the script as text, design 7.1)
    ["strictness: an input redirect", lint("eslint . < /dev/null")],
    [
      "strictness: parentheses in a quoted glob",
      format('prettier --check "src/**/*.(js|mjs)"'),
    ],
    ["strictness: a dollar in quotes", lint('eslint . --ignore-pattern "$X"')],
  ];
  for (const [name, scripts] of red)
    assert.notDeepEqual(checkFindings(scripts), [], `${name}: no finding`);
  const green = [
    ["--fix-dry-run", lint("eslint . --fix-dry-run --max-warnings 0")],
    ["--log-level", format("prettier --check . --log-level warn")],
    ["--format stylish", lint("eslint . --max-warnings 0 --format stylish")],
    ["prettier -c", format("prettier -c .")],
    ["--no-cache", format("prettier --check . --no-cache")],
    [
      "--cache-strategy",
      lint("eslint . --cache-strategy content --max-warnings 0"),
    ],
    ["quotes, * and /", format('prettier --check "src/**/*.js"')],
    [
      "a colon and quotes",
      lint('eslint . --rule "no-console: error" --max-warnings 0'),
    ],
    ["a comma", lint("eslint . --ext .js,.mjs --max-warnings 0")],
  ];
  for (const [name, scripts] of green)
    assert.deepEqual(checkFindings(scripts), [], `twin ${name}`);
});

// ---- NF-07: the header-count canary of the team web server and the picker --------------

// A raw request: the request line, Host and Connection and `total - 2` short lines, so
// `total` header lines in all. Resolves to { status, bytes, closedByServer } (status null if no answer; closedByServer is
// false when the connection was still open at the safety-net timer).
function rawHead(port, total) {
  const lines = [`Host: 127.0.0.1:${port}`, "Connection: close"];
  while (lines.length < total) lines.push("a:b");
  const head = `GET / HTTP/1.1\r\n${lines.join("\r\n")}\r\n\r\n`;
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    let got = "";
    // the safety net only: a server that behaves ends the connection itself and the
    // promise resolves at once; a server that leaves the socket open runs into the timer
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      socket.destroy();
    }, 10_000);
    socket.on("connect", () => socket.write(head));
    socket.on("data", (d) => (got += d));
    socket.on("error", () => {});
    socket.on("close", () => {
      clearTimeout(timer);
      resolve({
        status: /^HTTP\/1\.1 (\d{3})/u.exec(got)?.[1] ?? null,
        bytes: Buffer.byteLength(head),
        closedByServer: !timedOut,
      });
    });
  });
}

const CANARY_SERVERS = [
  {
    name: "team web",
    file: "src/web/main.js",
    args: () => ["--port", "0"],
    watch: "team",
  },
  {
    name: "picker",
    file: "src/picker/cli.js",
    args: (b) => [
      "serve",
      "--tenants",
      b.tenants,
      "--home",
      b.home,
      "--port",
      "0",
    ],
    watch: "home",
  },
];

test("NF-07: the team web server and the picker keep Node's header count - 2 500 lines are refused with 431, 1 000 are answered as a normal request, and nothing is written", async (t) => {
  for (const s of CANARY_SERVERS) {
    const box = makeBox(t);
    const c = spawnChild(t, box, s.file, s.args(box));
    const port = await c.link;
    assert.notEqual(
      port,
      null,
      `${s.name}: no link line: ${c.out.stdout} ${c.out.stderr}`,
    );
    const before = listing(box[s.watch]);
    const first = await rawHead(port, 2);
    // the head of the probe is under both size limits, so only the count can refuse it
    const big = await rawHead(port, 2500);
    assert.ok(
      big.bytes < 16_384 && big.bytes < MAX_HEADER_BYTES,
      `${s.name}: the probe head is ${big.bytes} bytes`,
    );
    const mid = await rawHead(port, 1000);
    const last = await rawHead(port, 2);
    assert.notEqual(
      first.status,
      null,
      `${s.name}: no answer to a normal request`,
    );
    assert.notEqual(
      first.status,
      "431",
      `${s.name}: a normal request is refused`,
    );
    assert.equal(big.status, "431", `${s.name}: 2500 lines`);
    assert.equal(
      big.closedByServer,
      true,
      `${s.name}: the connection stays open after the 431`,
    );
    assert.equal(mid.status, first.status, `${s.name}: 1000 lines`);
    assert.equal(
      last.status,
      first.status,
      `${s.name}: a normal request after the probe`,
    );
    assert.equal(
      listing(box[s.watch]),
      before,
      `${s.name}: the folder changed`,
    );
    const end = await c.stop();
    assert.equal(c.out.timedOut, false, `${s.name}: did not stop`);
    assert.ok(
      end.code === 0 || end.signal !== null,
      `${s.name}: stop code ${end.code}`,
    );
  }
});

// ---- NF-08: --help is answered on any Node ---------------------------------------------

const HELP_FIXED = [
  "src/pixel-office/main.js",
  "src/pixel-office/note.js",
  "src/traces/cli.js",
  "src/handoffs/cli.js",
  "src/handoffs/handoff.js",
  "src/picker/cli.js",
];

test("NF-08: --help ends with code 0 and the same stdout under a simulated 22.21.1 and 22.23.3 as under the running Node, with no refusal line and nothing written", async (t) => {
  const { files } = nodeFileScripts();
  for (const rel of HELP_FIXED)
    assert.ok(
      [...files.values()].includes(rel),
      `the fixed row ${rel} is not a script file`,
    );
  const targets = [...HELP_FIXED];
  for (const rel of new Set(files.values())) {
    if (targets.includes(rel)) continue;
    const probe = await runChild(t, makeBox(t), rel, ["--help"]);
    if (probe.code === 0) targets.push(rel);
  }
  for (const rel of targets) {
    const real = await runChild(t, makeBox(t), rel, ["--help"]);
    assert.equal(
      real.code,
      0,
      `${rel} --help under the running Node: code ${real.code}`,
    );
    assert.notEqual(real.stdout, "", `${rel} --help prints nothing`);
    for (const version of ["22.21.1", "22.23.3"]) {
      const box = makeBox(t);
      const before = listAll(box);
      const r = await runChild(t, box, rel, ["--help"], { version });
      const label = `${rel} --help under ${version}`;
      assert.equal(r.code, 0, `${label}: code ${r.code}, stderr ${r.stderr}`);
      assert.equal(r.stdout, real.stdout, `${label}: another text`);
      assert.equal(
        r.stderr.includes("Нужен Node"),
        false,
        `${label}: a refusal line`,
      );
      assert.deepEqual(listAll(box), before, `${label}: a folder changed`);
    }
  }
});
