import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkText } from "../../scripts/check-public.js";
import { APP, tempDir } from "../fixtures/helpers.js";

// REQ-109 criterion 7.

const run = (/** @type {string} */ dir) =>
  spawnSync(process.execPath, ["scripts/check-public.js", dir], {
    cwd: APP,
    encoding: "utf8",
  });

test("CP-1 the real app/public passes", () => {
  const r = run(path.join(APP, "public"));
  assert.equal(r.status, 0, r.stdout);
});

const RED = [
  "Claude Code",
  "claude\ncode",
  "Около  2 минут",
  "ТИПОВОЙ вариант",
  "x.innerHTML = 1",
  '<p style="a">',
  '<p onclick="x">',
  "<p ONLOAD=x>",
  "<style>p{}</style>",
  "<script>x()</script>",
  "REQ-108",
  "a handoff",
  "Handoffs",
  "the Orch",
  "DECISIONS",
  'see <a href="https://example.org">',
  "http://x",
  "<img src='http://x/y.png'>",
  "<p title=\"a\" onmouseover='b'>",
];
const GREEN = [
  '<link rel="stylesheet" href="/css/x.css">',
  '<script type="module" src="/js/x.js"></script>',
  "ORCHESTRA",
  "REQUEST",
  "decision",
  '<a href="/">',
  '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  '<p title="one=two">',
  '<p title="x onload=y">',
  '<p data-style="a">',
  '<link rel="icon" href="data:,">',
  "innerHTMLx",
];

test("CP-2 each planted item is red with its file, each benign twin is green", (t) => {
  for (const r of RED) assert.notDeepEqual(checkText("x.html", r), [], r);
  for (const g of GREEN) assert.deepEqual(checkText("x.html", g), [], g);
  assert.notDeepEqual(checkText("office/a.js", "Math.random()"), []);
  assert.deepEqual(checkText("js/a.js", "Math.random()"), []);
  const dir = tempDir(t);
  fs.writeFileSync(path.join(dir, "a.html"), "<p>handoff</p>\n");
  const r = run(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /a\.html: word «handoff»/);
});
