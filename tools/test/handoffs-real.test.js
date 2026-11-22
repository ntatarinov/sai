// REQ-038, criteria 5 and 8: the real repository. The command is green on Sai itself with
// every record of the base used, the base is pinned by a record of decisions/, the base
// holds what the requirement says it holds, and the run takes no more than 20 seconds
// (design 12, HC-5b, HC-7a, HC-7b, HC-7c, HC-8i). These tests read the repository and
// write nothing.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CLI, SAI, TOOLS, describe } from "./handoffs-helpers.js";

const BASE = path.join(TOOLS, "handoffs", "exceptions.tsv");

function records() {
  return fs
    .readFileSync(BASE, "utf8")
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t"));
}

function header() {
  const hits = fs
    .readFileSync(BASE, "utf8")
    .split("\n")
    .map((l) => /^# база: ([0-9a-f]{40})$/u.exec(l))
    .filter((m) => m !== null);
  assert.equal(hits.length, 1);
  return hits[0][1];
}

function decisionCommit() {
  const dir = path.join(SAI, "decisions");
  const found = new Map();
  for (const name of fs.readdirSync(dir)) {
    const m = /^(\d{4})-.+\.md$/u.exec(name);
    if (m === null) continue;
    for (const line of fs
      .readFileSync(path.join(dir, name), "utf8")
      .split("\n")) {
      const hit = /^База handoffs-check: ([0-9a-f]{40})\s*$/u.exec(line);
      if (hit === null) continue;
      const n = Number(m[1]);
      if (!found.has(n)) found.set(n, new Set());
      found.get(n).add(hit[1]);
    }
  }
  assert.ok(found.size > 0, "no record of decisions/ with the line");
  const top = found.get(Math.max(...found.keys()));
  assert.equal(top.size, 1);
  return [...top][0];
}

test("HC-7a the real repository: code 0, 'нарушений 0, исключений использовано K из L' with K = L = the records of the base", () => {
  const started = Date.now();
  const r = spawnSync(process.execPath, [CLI], {
    cwd: TOOLS,
    encoding: "utf8",
    timeout: 60_000,
  });
  const spent = Date.now() - started;
  assert.equal(r.status, 0, describe(r));
  assert.equal(r.stderr, "");
  const lines = r.stdout.split("\n").filter((l) => l !== "");
  assert.equal(lines.length, 1, r.stdout);
  const m =
    /^handoffs-check: файлов проверено (\d+), нарушений 0, исключений использовано (\d+) из (\d+)$/u.exec(
      lines[0],
    );
  assert.ok(m !== null, lines[0]);
  assert.equal(m[2], m[3], "K = L");
  assert.equal(Number(m[3]), records().length);
  assert.ok(Number(m[1]) > 600, "the handoffs are read");
  // HC-8i: the run takes no more than 20 seconds.
  assert.ok(spent <= 20_000, `the command took ${spent} ms`);
});

test("HC-7b the line 'База handoffs-check:' of the record of decisions/ with the largest number and the header of the base are one hash", () => {
  assert.equal(decisionCommit(), header());
});

test("HC-7c the base holds the records of the requirement and none that it excludes", () => {
  const rows = records();
  assert.equal(rows.length, 110);
  const has = (file, rule, field) =>
    rows.some(
      (r) =>
        r[0] === file &&
        r[1] === rule &&
        (field === undefined || r[2] === field),
    );
  assert.ok(
    has(
      "handoffs/PO-20261005-01/step-07-design-qa-validator.json",
      "H4",
      "status",
    ),
  );
  assert.ok(
    has(
      "handoffs/PROD-20261011-01/step-17-reviewer.json",
      "H4",
      "result.status",
    ),
  );
  assert.ok(
    has(
      "handoffs/PROD-20261010-01/step-24-test-designer.json",
      "H7",
      "result.issues[0].at",
    ),
  );
  // The CANCELLED handoffs give no violation, and the base holds no H4 record of them:
  // the two of WF06-20260925-01 and the four of REQ-103 (run M0DOCS-20261117-01).
  assert.ok(!has("handoffs/WF06-20260925-01/step-10-orch.json", "H4"));
  assert.ok(!has("handoffs/WF06-20260925-01/step-13-req-analyst.json", "H4"));
  assert.ok(
    !has("handoffs/WF06-20260926-01/step-10-orch.json", "H4"),
    "the base holds an H4 record of handoffs/WF06-20260926-01/step-10-orch.json",
  );
  assert.ok(
    !has("handoffs/WF06-20260926-01/step-11-req-analyst.json", "H4"),
    "the base holds an H4 record of handoffs/WF06-20260926-01/step-11-req-analyst.json",
  );
  assert.ok(
    !has("handoffs/WF06-20260926-01/step-12-ba-analyst.json", "H4"),
    "the base holds an H4 record of handoffs/WF06-20260926-01/step-12-ba-analyst.json",
  );
  assert.ok(
    !has("handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json", "H4"),
    "the base holds an H4 record of handoffs/ISS-0002-20260930-01/step-06-test-designer-r2.json",
  );
  // The values written after the first commit but not after their own are no H7.
  assert.ok(
    !has("handoffs/PROD-20261006-01/step-04-code-designer-r2.json", "H7"),
  );
  assert.ok(
    !has("handoffs/PROD-20261010-01/step-44-code-designer-iss0010.json", "H7"),
  );
  // No H10 (the base of traces holds those) and no record of a rule other than H1-H9, H11.
  assert.ok(rows.every((r) => /^H(?:[1-9]|11)$/u.test(r[1])));
  // Every record is of a file of handoffs/ that git has.
  const listed = spawnSync("git", ["-C", SAI, "ls-files", "-z", "handoffs"], {
    encoding: "utf8",
  }).stdout.split("\0");
  for (const r of rows) assert.ok(listed.includes(r[0]), r[0]);
});

test("HC-5b npm run traces on the real repository: code 0 and no trace", () => {
  const r = spawnSync(
    process.execPath,
    [path.join(TOOLS, "src", "traces", "cli.js")],
    {
      cwd: TOOLS,
      encoding: "utf8",
      timeout: 120_000,
    },
  );
  assert.equal(r.status, 0, describe(r));
  assert.match(r.stdout, /traces: файлов проверено \d+, следов 0,/u);
});
