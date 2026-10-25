// REQ-014, criterion 5: one instruction in README.md (design REQ-014, 10 and 14.1:
// TD-1 - TD-3). Links beyond the root are covered by `npm run traces` (TC-20).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { SAI } from "./fixtures/traces/helpers.js";

const README = fs.readFileSync(path.join(SAI, "README.md"), "utf8");
const HEADING = "## How to open on another computer";

function section() {
  const start = README.indexOf(`\n${HEADING}\n`);
  assert.ok(start !== -1, "no section");
  const rest = README.slice(start + HEADING.length + 2);
  const next = rest.search(/^## /mu);
  return next === -1 ? rest : rest.slice(0, next);
}

for (const command of [
  "git clone",
  "npm ci",
  "npm run check",
  "npm run pixel-office",
  "npm run team -- projects",
]) {
  test(`TD-1 the section has a line with ${command}`, () => {
    assert.ok(
      section()
        .split("\n")
        .some((line) => line.includes(command)),
      command,
    );
  });
}

test("TD-2 no outdated words in README.md", () => {
  assert.ok(!README.includes("Своего репозитория у Sai пока нет"));
  assert.ok(!README.includes("кода продукта нет"));
  assert.ok(!README.includes("Sai has no repository of its own yet"));
  assert.ok(!README.includes("there is no product code"));
});

test("TD-3 the section has no copy of the folder and no address but the placeholder", () => {
  const text = section();
  assert.ok(!text.includes("копию папки"));
  assert.ok(!text.includes("a copy of the folder"));
  assert.ok(!text.includes("git@"));
  assert.ok(!text.includes("://"));
  assert.ok(text.includes("git clone <Sai repository address>"));
  assert.match(text, /npm run traces -- add/u);
});
