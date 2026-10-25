// REQ-038, criteria 1, 10 and 11: the place of the command in `npm run check`, the words
// of the documents and the rules of the quality bar for the new files (design 12, HC-02,
// HC-03, HC-9a, HC-9b, HC-10a). The checks of documents are counts of lines, as in the
// criteria; the tests of the other team members are not touched.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { hasHomePath } from "../src/traces/rules.js";
import { SAI, TOOLS } from "./handoffs-helpers.js";

const pkg = () =>
  JSON.parse(fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"));
const steps = (check) => check.split("&&").map((s) => s.trim());

test("HC-02 package.json has the script handoffs-check and the step in check before npm run test, and no ||", () => {
  const { scripts } = pkg();
  assert.equal(scripts["handoffs-check"], "node src/handoffs/cli.js");
  assert.ok(!scripts.check.includes("||"));
  const list = steps(scripts.check);
  assert.ok(list.includes("npm run handoffs-check"));
  assert.ok(
    list.indexOf("npm run handoffs-check") < list.indexOf("npm run test"),
  );
  // Nothing was taken out of the command: every step of the bar is still there, in order.
  assert.deepEqual(list, [
    "npm run format:check",
    "npm run lint",
    "npm run traces",
    "npm run handoffs-check",
    "npm run test",
  ]);
  const raw = fs.readFileSync(path.join(TOOLS, "package.json"), "utf8");
  assert.ok((raw.match(/handoffs-check/gu) ?? []).length >= 2);
});

test("HC-03 the properties that TC-20 of traces and the check of team-web-control rely on still hold", () => {
  const { scripts } = pkg();
  // TC-20 of tools/test/traces-check.test.js.
  assert.equal(scripts.traces, "node src/traces/cli.js");
  const list = steps(scripts.check);
  assert.ok(list.includes("npm run traces"));
  assert.ok(list.indexOf("npm run traces") < list.indexOf("npm run test"));
  // The check of tools/test/team-web-control.test.js.
  assert.equal(scripts.test, 'node --test "test/**/*.test.js"');
  assert.match(scripts.check, /npm run test$/u);
});

const handoffsMd = () =>
  fs.readFileSync(path.join(SAI, "docs", "workflows", "handoffs.md"), "utf8");

// The lines of a section "## <title>" up to the next "## " (the awk of the criterion).
function section(markdown, title) {
  const out = [];
  let inside = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith(`## ${title}`)) {
      inside = true;
      continue;
    }
    if (line.startsWith("## ")) inside = false;
    if (inside) out.push(line);
  }
  return out;
}
const count = (lines, word) => lines.filter((l) => l.includes(word)).length;

test("HC-9a handoffs.md: the rules of the check in 'Bookkeeping check' and of at_note, was and previous in 'Time'", () => {
  const md = handoffsMd();
  const check = section(md, "Bookkeeping check");
  assert.ok(check.length > 0);
  assert.ok(count(check, "handoffs-check") >= 1);
  assert.ok(count(check, "orch_correction") >= 1);
  assert.ok(count(check, "<scratch>/") >= 1);
  const time = section(md, "Time");
  assert.ok(time.length > 0);
  assert.ok(count(time, "at_note") >= 1);
  assert.ok(count(time, "previous") >= 1);
});

test("HC-9b tools/README.md describes the command, the rules, the base of exceptions and the codes", () => {
  const lines = fs
    .readFileSync(path.join(TOOLS, "README.md"), "utf8")
    .split("\n");
  assert.ok(count(lines, "handoffs-check") >= 2);
  assert.ok(count(lines, "База handoffs-check") >= 1);
  const joined = lines.join("\n");
  for (const word of [
    "--emit-exceptions",
    "H11",
    "tools/handoffs/exceptions.tsv",
  ])
    assert.ok(joined.includes(word), word);
});

// The files of this work: tests, helpers, code of the command, the base.
function ownFiles() {
  const out = [];
  for (const name of fs.readdirSync(path.join(TOOLS, "test")))
    if (/^handoffs-.*\.js$/u.test(name)) out.push(path.join("test", name));
  for (const name of fs.readdirSync(path.join(TOOLS, "src", "handoffs")))
    out.push(path.join("src", "handoffs", name));
  out.push(path.join("handoffs", "exceptions.tsv"));
  return out;
}

// Written in parts, so that this file does not contain what it looks for.
const FORBIDDEN = [
  new RegExp(`\\.${"sk"}ip\\(|\\b${"sk"}ip:`, "u"),
  new RegExp(`\\.${"to"}do\\(|\\b${"to"}do:`, "u"),
  new RegExp(`\\.${"on"}ly\\(|\\b${"on"}ly:`, "u"),
  new RegExp(
    `${"eslint"}-${"disable"}|${"prettier"}-${"ignore"}|@${"ts"}-ignore`,
    "u",
  ),
  new RegExp(`\\|\\|\\s*${"tr"}ue\\b`, "u"),
  /\bxit\(|\bxdescribe\(|\bxtest\(/u,
];
const SECRET =
  /sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[abp]-[A-Za-z0-9-]{10,}|(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{6,}["']/iu;

test("HC-10a no skipped, todo or only test, no disabled rule, no path of this computer and no secret in the new files", () => {
  const files = ownFiles();
  assert.ok(files.length >= 14, files.join(", "));
  for (const rel of files) {
    const body = fs.readFileSync(path.join(TOOLS, rel), "utf8");
    body.split("\n").forEach((line, i) => {
      const where = `${rel}:${i + 1}`;
      for (const re of FORBIDDEN) assert.ok(!re.test(line), `${where}: ${re}`);
      assert.ok(!hasHomePath(line), `${where}: a path of a home folder`);
      assert.ok(!SECRET.test(line), `${where}: a secret`);
    });
  }
  // The runner knows no skipped test of these files: every test line is a plain test(.
  for (const rel of files.filter((f) => f.endsWith(".test.js"))) {
    const body = fs.readFileSync(path.join(TOOLS, rel), "utf8");
    assert.ok(/^test\(/mu.test(body), rel);
    assert.ok(!/^\s*(?:describe|it)\(/mu.test(body), rel);
  }
});
