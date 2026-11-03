// REQ-039, criteria 7 and 8 (design 10, HO-46, HO-47, HO-50...HO-54, HO-90, HO-91): the
// help and the documents (counted by whole lines and by sections, not by a substring that
// the old text already holds), the place of the writing, and the proof that the one word
// `export` added to check.js changes nothing in `handoffs-check`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  FAKE_REL,
  FAKE_RUN,
  HANDOFF,
  SAI,
  TOOLS,
  assertNoStack,
  baseTag,
  canonArgs,
  describe,
  doc,
  newCmdRepo,
  newSai,
  recipientWrites,
  runCli,
  runHandoff,
  summaryOf,
  violationLines,
} from "./handoffs-helpers.js";

const read = (...parts) => fs.readFileSync(path.join(SAI, ...parts), "utf8");
const KEYS = [
  "run",
  "step",
  "role",
  "workflow",
  "task",
  "criterion",
  "requirement",
  "artifact-in",
  "write-set",
  "route",
  "qualifier",
  "suffix",
  "priority",
  "rework-of",
];

// The text of the section with the heading `## <title>`, up to the next `## `.
function section(text, title) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l === `## ${title}`);
  assert.ok(start >= 0, `no section ${title}`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join("\n");
}

const countLines = (text, needle) =>
  text.split("\n").filter((l) => l.includes(needle)).length;

test("HO-50 handoffs.md: both forms of the command stand in the sections Time and Who writes what, at least two lines in all", () => {
  const text = read("docs", "workflows", "handoffs.md");
  assert.ok(countLines(text, "npm run handoff -- ") >= 2);
  for (const title of ["Time", "Who writes what"]) {
    const body = section(text, title);
    assert.match(body, /npm run handoff -- new/u, title);
    assert.match(body, /npm run handoff -- close/u, title);
  }
  const who = section(text, "Who writes what");
  assert.match(who, /writes `context\.write_set` as a list/u);
  assert.match(
    who,
    /`close` does not do the stop by the rule of a role\s+\(`IN_PROGRESS` and "BLOCKED"\)/u,
  );
  assert.match(section(text, "Time"), /from \*\*one\*\* reading of the clock/u);
});

test("HO-51 orchestrator.md: a line with `handoff -- new`, the words «at the moment of launching» and «not in advance»", () => {
  const lines = read(".claude", "agents", "orchestrator.md").split("\n");
  const found = lines.filter((l) => l.includes("handoff -- new"));
  assert.ok(found.length >= 1);
  // The point is a paragraph of a list: the line and the lines that continue it.
  const at = lines.findIndex((l) => l.includes("handoff -- new"));
  const point = [lines[at], lines[at + 1], lines[at + 2]]
    .filter((l, i) => i === 0 || (l !== undefined && l.startsWith("  ")))
    .join(" ");
  assert.match(point, /at the\s+moment of launching the agent/u);
  assert.match(point, /not in advance/u);
});

test("HO-52 README.md: the section «The handoff command» holds both calls, every key, the codes of exit and the recipe of a long text; whole lines are counted, not the substring that handoffs-check already holds", () => {
  const text = read("tools", "README.md");
  assert.ok(countLines(text, "npm run handoff -- ") >= 2);
  const body = section(text, "The handoff command");
  assert.match(body, /^ {4}cd tools && npm run handoff -- new --run /mu);
  assert.match(body, /^ {4}cd tools && npm run handoff -- close /mu);
  assert.match(body, /^ {4}cd tools && npm run handoff -- --help/mu);
  for (const key of [...KEYS, "status"])
    assert.ok(body.includes(`\`--${key}\``), key);
  assert.match(body, /Exit codes: 0 .*1 .*2 /u);
  assert.match(body, /\$\(cat /u);
  assert.match(body, /decisions\/0039/u);
  assert.match(body, /decisions\/0040/u);
  assert.match(body, /tag `base\/<RUN-ID>`/u);
  assert.match(body, /hard link/u);
  // The line about the content of npm run check is as it was.
  assert.match(text, /handoffs-check/u);
});

test("HO-53 --help: code 0, both subcommands, every key, in Russian, nothing on stderr; also next to wrong arguments; npm run -s handoff -- --help gives the same", (t) => {
  const sai = newCmdRepo(t);
  const direct = runHandoff(["--help"], { cwd: sai.root, env: sai.env });
  assert.equal(direct.status, 0, describe(direct));
  assert.equal(direct.stderr, "");
  assert.match(direct.stdout, /\bnew\b/u);
  assert.match(direct.stdout, /\bclose\b/u);
  for (const key of [...KEYS, "status"])
    assert.ok(direct.stdout.includes(`--${key}`), key);
  assert.match(direct.stdout, /[А-Яа-я]{4}/u);
  assert.match(direct.stdout, /tools\/README\.md/u);
  for (const args of [
    ["new", "--bogus", "--help"],
    ["--help", "--run"],
    ["close", "--help"],
  ]) {
    const r = runHandoff(args, { cwd: sai.root, env: sai.env });
    assert.equal(r.status, 0, describe(r));
    assert.equal(r.stdout, direct.stdout);
    assert.equal(r.stderr, "");
  }
  const npm = spawnSync("npm", ["run", "-s", "handoff", "--", "--help"], {
    cwd: TOOLS,
    env: { PATH: process.env.PATH, HOME: sai.env.HOME },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(npm.status, 0, npm.stdout + npm.stderr);
  assert.equal(npm.stdout, direct.stdout);
});

test("HO-54 package.json: the script handoff is `node src/handoffs/handoff.js`, the steps of check are the same five and `npm run e2e` as the sixth, no ||", () => {
  const raw = fs.readFileSync(path.join(TOOLS, "package.json"), "utf8");
  const { scripts } = JSON.parse(raw);
  assert.equal(scripts.handoff, "node src/handoffs/handoff.js");
  assert.equal(path.join(TOOLS, "src", "handoffs", "handoff.js"), HANDOFF);
  assert.deepEqual(
    scripts.check.split("&&").map((s) => s.trim()),
    [
      "npm run format:check",
      "npm run lint",
      "npm run traces",
      "npm run handoffs-check",
      "npm run test",
      "npm run e2e",
    ],
  );
  assert.ok(!raw.includes("||"));
  assert.ok((raw.match(/handoffs-check/gu) ?? []).length >= 2);
  const keys = Object.keys(scripts);
  assert.equal(keys[keys.indexOf("handoffs-check") + 1], "handoff");
});

// The node runner inside a test reports to its parent unless this is dropped.
function nodeTest(file) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ["--test", file], {
    cwd: TOOLS,
    env,
    encoding: "utf8",
    timeout: 180_000,
  });
}

test("HO-46 HC-RT-1 (six calls of git, fixed lists of arguments) is green: node --test test/handoffs-runtime.test.js is code 0", () => {
  const r = nodeTest("test/handoffs-runtime.test.js");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /# fail 0/u);
  assert.match(r.stdout, /HC-RT-1b/u);
});

test("HO-47 TR-4c of traces is green without a change: node --test test/traces-runtime.test.js is code 0", () => {
  const r = nodeTest("test/traces-runtime.test.js");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /# fail 0/u);
});

test("HO-90 on a repository with the tag base/<RUN-ID>: after new and close git diff against the tag lists no tracked file and git status shows one new folder; the handoffs of another run have the same hashes", (t) => {
  const sai = newCmdRepo(t);
  const old = "handoffs/OLD-20260101-01/step-01-a.json";
  sai.writeDoc(old, doc(old, { run_id: "OLD-20260101-01" }));
  sai.commit("2025-01-05T00:00:00Z", { message: "old" });
  sai.tag(baseTag(FAKE_RUN));
  const oldBytes = sai.read(old);
  const r = sai.cmd(canonArgs());
  assert.equal(r.status, 0, describe(r));
  recipientWrites(sai, FAKE_REL, {
    status: "IN_PROGRESS",
    result: { status: "COMPLETED", summary: "s" },
  });
  const c = sai.cmd(["close", FAKE_REL, "--status", "COMPLETED"]);
  assert.equal(c.status, 0, describe(c));
  assert.equal(sai.git("diff", "--name-only", baseTag(FAKE_RUN)), "");
  assert.equal(sai.status(), `?? handoffs/${FAKE_RUN}/\n`);
  const others = sai
    .git("diff", "--name-only", baseTag(FAKE_RUN), "--", "handoffs/")
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith(`handoffs/${FAKE_RUN}/`));
  assert.deepEqual(others, []);
  assert.deepEqual(sai.read(old), oldBytes);
});

test("HO-91 handoffs-check on handoffs of the old form prints the recorded text: the added word `export` in check.js changes nothing", (t) => {
  const sai = newSai(t);
  const a = "handoffs/R-1/step-01-a.json";
  const b = "handoffs/R-1/step-02-b.json";
  // Old form: no created_at, write_set as a string, round after from_agent.
  const oldForm = (rel, over = {}) => {
    const d = doc(rel, {
      context: { requirement_ids: ["REQ-900"], write_set: "tools/x.js" },
      ...over,
    });
    const { round, ...rest } = { round: 1, ...d };
    const out = {};
    for (const [k, v] of Object.entries(rest)) {
      out[k] = v;
      if (k === "from_agent") out.round = round;
    }
    return out;
  };
  sai.writeDoc(a, oldForm(a));
  sai.writeDoc(b, oldForm(b, { status: "DONE" }));
  sai.commit("2025-03-02T00:00:00Z");
  const r = runCli([], { root: sai.root, env: sai.env });
  assert.equal(r.status, 1, describe(r));
  assertNoStack(r.stderr);
  assert.deepEqual(violationLines(r.stdout), [
    "handoffs/R-1/step-02-b.json:10 — H4: status: недопустимое значение DONE",
  ]);
  assert.equal(
    summaryOf(r.stdout),
    "handoffs-check: файлов проверено 2, нарушений 1, исключений использовано 0 из 0",
  );
});
