import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { APP } from "../fixtures/helpers.js";

// REQ-120 criterion 2 (the code design M2AUTH, 6.2): a rehearsal seed for every migration, with fixed test
// values only. The folder is read at test time, so a migration without its seed (0003, 0004 …) is red.

const MIGRATIONS = path.join(APP, "db", "migrations");
const SEEDS = path.join(APP, "test", "fixtures", "rehearsal");

// The key shapes of ARCH §14.4, built from parts so that this file does not hold them.
const KEY_SHAPES = [
  ["sk", "ant-"].join("-"),
  ["ghp", ""].join("_"),
  ["github", "pat", ""].join("_"),
  ["AK", "IA"].join(""),
  ["PRIVATE", "KEY"].join(" "),
];

/** @param {string} dir */
const sqlNames = (dir) =>
  fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort();

/**
 * The findings of one seed text: every e-mail-like word that does not end with `@example.test`, and every
 * key shape.
 * @param {string} text
 * @returns {string[]}
 */
export function seedFindings(text) {
  const out = [];
  for (const m of text.matchAll(/[^\s'",()]*@[^\s'",()]*/g))
    if (!/^[^@\s]+@example\.test$/.test(m[0])) out.push(`e-mail ${m[0]}`);
  for (const s of KEY_SHAPES) if (text.includes(s)) out.push(`key shape ${s}`);
  return out;
}

test("SEED-1 the seed names equal the migration names; every e-mail is under example.test; no seed holds a key shape", () => {
  assert.ok(
    fs.existsSync(SEEDS) && fs.statSync(SEEDS).isDirectory(),
    "app/test/fixtures/rehearsal is a folder",
  );
  const migrations = sqlNames(MIGRATIONS);
  assert.ok(migrations.length >= 2, migrations.join(", "));
  // Every file of the folder is a seed: nothing else stands there.
  assert.deepEqual(fs.readdirSync(SEEDS).sort(), migrations);
  /** @type {Record<string, string[]>} */
  const findings = {};
  let emails = 0;
  for (const name of migrations) {
    const text = fs.readFileSync(path.join(SEEDS, name), "utf8");
    assert.ok(text.trim().length > 0, `${name} is empty`);
    emails += [...text.matchAll(/@example\.test/g)].length;
    const f = seedFindings(text);
    if (f.length) findings[name] = f;
  }
  assert.deepEqual(findings, {});
  assert.ok(emails > 0, "the seeds hold e-mails to check");
  // The rule itself: a real address and each key shape are found.
  assert.deepEqual(seedFindings("'someone@gmail.com'"), [
    "e-mail someone@gmail.com",
  ]);
  assert.deepEqual(seedFindings("'a@example.test.org'"), [
    "e-mail a@example.test.org",
  ]);
  for (const s of KEY_SHAPES)
    assert.deepEqual(seedFindings(`'${s}x'`), [`key shape ${s}`]);
});
