import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { insideGitTree, runBuild } from "../../scripts/vercel-build.js";
import { APP, tempDir } from "../fixtures/helpers.js";

// REQ-109 criterion 8, with injected steps and a temporary output folder.

const PUBLIC = path.join(APP, "public");
const MARK = ["pg", "marker", "Q7"].join("-");
const UNPOOLED_MARK = ["pg", "unpooled", "Q7"].join("-");

/** @param {import("node:test").TestContext} t @param {Record<string, string>} env @param {{ migrate?: number, check?: number, migrateThrows?: boolean }} [o] */
function build(t, env, o = {}) {
  const outDir = path.join(tempDir(t), "out");
  const calls = [];
  const lines = [];
  const code = runBuild({
    env,
    migrate: () => {
      calls.push("migrate");
      if (o.migrateThrows) throw new Error("the database adapter was called");
      return o.migrate ?? 0;
    },
    checkPublic: () => {
      calls.push("check-public");
      return o.check ?? 0;
    },
    publicDir: PUBLIC,
    outDir,
    log: (l) => lines.push(l),
  });
  return { code, calls, lines, outDir };
}

const tree = (/** @type {string} */ dir) =>
  fs.readdirSync(dir, { recursive: true }).map(String).sort();

test("VB-1 open (SITE_GATE unset or empty): migrate then check-public with MIGRATE_ON_BUILD=1; only check-public without it; the output equals app/public", (t) => {
  for (const gate of [{}, { SITE_GATE: "" }]) {
    const label = JSON.stringify(gate);
    const a = build(t, {
      ...gate,
      MIGRATE_ON_BUILD: "1",
      DATABASE_URL: `postgres://u:${MARK}@h/d`,
      DATABASE_URL_UNPOOLED: `postgres://u:${UNPOOLED_MARK}@h/d`,
    });
    assert.deepEqual(
      [a.code, a.calls],
      [0, ["migrate", "check-public"]],
      label,
    );
    assert.deepEqual(tree(a.outDir), tree(PUBLIC), label);
    for (const f of tree(PUBLIC).filter((f) =>
      fs.statSync(path.join(PUBLIC, f)).isFile(),
    ))
      assert.ok(
        fs
          .readFileSync(path.join(a.outDir, f))
          .equals(fs.readFileSync(path.join(PUBLIC, f))),
        `${label} ${f}`,
      );
    for (const m of [MARK, UNPOOLED_MARK])
      assert.ok(!a.lines.join("\n").includes(m), `${label} ${m}`);
    const b = build(t, { ...gate });
    assert.deepEqual([b.code, b.calls], [0, ["check-public"]], label);
  }
});

test("VB-2 a failing migrate stops before check-public; a failing check-public fails", (t) => {
  const a = build(t, { MIGRATE_ON_BUILD: "1" }, { migrate: 1 });
  assert.deepEqual([a.code !== 0, a.calls], [true, ["migrate"]]);
  const b = build(t, {}, { check: 1 });
  assert.notEqual(b.code, 0);
});

test("VB-3 closed: no migrate, no database call, exit 0, the output is only index.html equal to the gate page", (t) => {
  for (const gate of ["closed", "1"]) {
    const a = build(
      t,
      {
        SITE_GATE: gate,
        MIGRATE_ON_BUILD: "1",
        DATABASE_URL: ["postgres://u", "p@127.0.0.1:1/d"].join(":"),
      },
      { migrateThrows: true },
    );
    assert.deepEqual([a.code, a.calls], [0, []]);
    assert.deepEqual(tree(a.outDir), ["index.html"]);
    assert.ok(
      fs
        .readFileSync(path.join(a.outDir, "index.html"))
        .equals(fs.readFileSync(path.join(PUBLIC, "gate.html"))),
    );
    assert.ok(!a.lines.join("\n").includes("127.0.0.1"));
  }
  // The Vercel shape: the output folder is the uploaded public/ itself, outside any git tree, with
  // every file of app/public in it; the closed build leaves only index.html there.
  const upload = path.join(tempDir(t), "public");
  fs.cpSync(PUBLIC, upload, { recursive: true });
  assert.ok(!insideGitTree(upload), "the temporary folder is in a git tree");
  /** @type {string[]} */
  const calls = [];
  const code = runBuild({
    env: { SITE_GATE: "closed", MIGRATE_ON_BUILD: "1" },
    migrate: () => {
      calls.push("migrate");
      throw new Error("the database adapter was called");
    },
    checkPublic: () => {
      calls.push("check-public");
      return 0;
    },
    publicDir: upload,
    outDir: upload,
    log: () => {},
  });
  assert.deepEqual([code, calls], [0, []]);
  assert.deepEqual(tree(upload), ["index.html"]);
  assert.ok(
    fs
      .readFileSync(path.join(upload, "index.html"))
      .equals(fs.readFileSync(path.join(PUBLIC, "gate.html"))),
  );
});

/** The names and bytes of every file of a folder. */
const snapshot = (/** @type {string} */ dir) =>
  tree(dir).map((f) =>
    fs.statSync(path.join(dir, f)).isFile()
      ? `${f} ${fs.readFileSync(path.join(dir, f)).toString("base64")}`
      : f,
  );

test("VB-4 closed: the real app/public of a git working tree is never replaced", () => {
  // Outside a git tree runBuild would rightly replace the folder, so the test refuses to run there.
  assert.ok(insideGitTree(PUBLIC), "VB-4 needs app/ inside a git working tree");
  const lines = [];
  const before = snapshot(PUBLIC);
  const code = runBuild({
    env: { SITE_GATE: "closed" },
    migrate: () => 1,
    checkPublic: () => 1,
    publicDir: PUBLIC,
    outDir: PUBLIC,
    log: (l) => lines.push(l),
  });
  assert.equal(code, 2);
  assert.deepEqual(snapshot(PUBLIC), before);
  assert.match(lines.join("\n"), /^vercel-build: refused: /);
});
