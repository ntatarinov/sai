import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ROOT, readRoot } from "../fixtures/helpers.js";

// REQ-115 criterion 11 (the code design M2AUTH, 4.14): every row of docs/security-invariants.md names a test
// file that exists and a test of that name in it; the table has at least eleven rows. The pair of a row is
// its check command (the CI job runs the file; the name is the test that proves the row).

/**
 * The rows of the one table of the file: `| # | Invariant | Test file | Test name |`.
 * @param {string} text
 * @returns {Array<{ n: string, invariant: string, file: string, name: string }>}
 */
export function invariantRows(text) {
  const lines = text.split("\n").filter((l) => l.startsWith("|"));
  const [head, rule, ...rows] = lines;
  assert.equal(head, "| # | Invariant | Test file | Test name |");
  assert.match(rule ?? "", /^\|( --- \|){4}$/);
  return rows.map((l) => {
    const cells = l
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    assert.equal(cells.length, 4, l);
    const [n, invariant, file, name] = cells;
    return { n, invariant, file, name };
  });
}

/**
 * The findings of the rows: a file that is not a test file of app/test, a file that does not exist, a test
 * name that does not stand in the file as `test("<name> ` (or with a template text), a number out of order, a
 * row repeated.
 * @param {ReturnType<typeof invariantRows>} rows
 * @param {(rel: string) => string | null} read the text of a file of the repository, or null
 * @returns {string[]}
 */
export function invariantFindings(rows, read) {
  const out = [];
  const seen = new Set();
  rows.forEach((r, i) => {
    if (r.n !== String(i + 1)) out.push(`row ${i + 1}: number ${r.n}`);
    if (!r.invariant) out.push(`row ${r.n}: no invariant`);
    if (!/^app\/test\/(unit|int|pg|e2e)\/[a-z0-9-]+\.test\.js$/.test(r.file))
      out.push(`row ${r.n}: ${r.file} is not a test file of app/test`);
    if (!/^[A-Z]+(-[A-Z]+)*-\d+[a-z]?$/.test(r.name))
      out.push(`row ${r.n}: ${r.name} is not a test name`);
    const key = `${r.file} ${r.name}`;
    if (seen.has(key)) out.push(`row ${r.n}: repeated ${key}`);
    seen.add(key);
    const text = read(r.file);
    if (text === null) {
      out.push(`row ${r.n}: ${r.file} does not exist`);
      return;
    }
    if (
      !text.includes(`test("${r.name} `) &&
      !text.includes(`test(\`${r.name} `)
    )
      out.push(`row ${r.n}: ${r.file} has no test ${r.name}`);
  });
  return out;
}

/** @param {string} rel */
const readRepo = (rel) => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return null;
  }
};

test("SI-1 every row of docs/security-invariants.md names an existing test file and a test of that name; at least eleven rows", () => {
  const rows = invariantRows(readRoot("docs/security-invariants.md"));
  assert.ok(rows.length >= 11, `rows ${rows.length}`);
  assert.deepEqual(invariantFindings(rows, readRepo), []);
  // A row naming a missing test, a missing file or a test that is only a word in another line is red.
  const first = rows[0];
  const text = /** @type {string} */ (readRepo(first.file));
  /** @param {Partial<(typeof rows)[number]>} change */
  const damaged = (change) =>
    invariantFindings([{ ...first, ...change }], readRepo);
  assert.deepEqual(damaged({ name: "IS-99" }), [
    `row 1: ${first.file} has no test IS-99`,
  ]);
  assert.deepEqual(damaged({ file: "app/test/int/no-such.test.js" }), [
    "row 1: app/test/int/no-such.test.js does not exist",
  ]);
  assert.deepEqual(
    invariantFindings([first], (rel) =>
      rel === first.file
        ? text.replaceAll(`test("${first.name} `, `// ${first.name} `)
        : readRepo(rel),
    ),
    [`row 1: ${first.file} has no test ${first.name}`],
  );
  assert.deepEqual(invariantFindings([first, first], readRepo), [
    "row 2: number 1",
    `row 1: repeated ${first.file} ${first.name}`,
  ]);
});
