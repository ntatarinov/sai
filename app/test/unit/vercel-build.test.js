import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  GATE_SHA256,
  insideGitTree,
  runBuild,
} from "../../scripts/vercel-build.js";
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

/** The names and bytes of every file of a folder. */
const snapshot = (/** @type {string} */ dir) =>
  tree(dir).map((f) =>
    fs.statSync(path.join(dir, f)).isFile()
      ? `${f} ${fs.readFileSync(path.join(dir, f)).toString("base64")}`
      : f,
  );

/**
 * One closed build in the Vercel shape: the output folder is the uploaded public/ itself (or `outDir`),
 * MIGRATE_ON_BUILD=1 and a migrate step that throws.
 * @param {string} publicDir
 * @param {string} [outDir]
 */
function closedRun(publicDir, outDir = publicDir) {
  /** @type {string[]} */
  const calls = [];
  /** @type {string[]} */
  const lines = [];
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
    publicDir,
    outDir,
    log: (l) => lines.push(l),
  });
  return { code, calls, lines };
}

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
  // GATE_SHA256 of vercel-build.js is the sha256 of the bytes of the gate page: a change of
  // app/public/gate.html without a new constant is red here (and every closed run below is refused).
  const gateBytes = fs.readFileSync(path.join(PUBLIC, "gate.html"));
  assert.equal(
    GATE_SHA256,
    createHash("sha256").update(gateBytes).digest("hex"),
    "GATE_SHA256 is not the sha256 of app/public/gate.html",
  );
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
  const first = closedRun(upload);
  assert.deepEqual([first.code, first.calls], [0, []]);
  assert.deepEqual(tree(upload), ["index.html"]);
  assert.ok(fs.readFileSync(path.join(upload, "index.html")).equals(gateBytes));
  // The platform runs vercel-build twice in one build (spike S1, decisions/0122 О5 (4)). The second run
  // on the same folder (the finished output) finds public/gate.html gone and the bytes of the gate page
  // alone: exit 0, nothing changed.
  const before = snapshot(upload);
  const second = closedRun(upload);
  assert.deepEqual([second.code, second.calls], [0, []]);
  assert.deepEqual(snapshot(upload), before);
  assert.deepEqual(tree(upload), ["index.html"]);
  assert.ok(fs.readFileSync(path.join(upload, "index.html")).equals(gateBytes));
  assert.deepEqual(second.lines, [
    "vercel-build: SITE_GATE is set: the output folder already holds only index.html, the bytes of the gate page (an earlier run of this build); nothing changed, no migration",
  ]);
  // Fail closed: every other folder is refused and stays as it was. Without public/gate.html that is any
  // folder but the lone regular index.html with the bytes of the gate page; with it, a public/gate.html
  // that does not hold those bytes. The tampered forms keep the title of the gate page and differ in bytes;
  // one of them also keeps the length, so a check of the size alone is red here.
  const openBytes = fs.readFileSync(path.join(PUBLIC, "index.html"));
  const titleLine = (/** @type {string} */ text) => {
    const m = /^ *<title>[^<]*<\/title>$/m.exec(text);
    assert.ok(m, "a page without a title line");
    return m[0];
  };
  const gateText = gateBytes.toString("utf8");
  const openText = openBytes.toString("utf8");
  const gateTitle = titleLine(gateText);
  /** @type {Array<[string, Buffer]>} */
  const tampered = [
    [
      "the gate page with a script added",
      Buffer.from(
        gateText.replace(
          "</head>",
          '<script src="https://example.invalid/x.js"></script></head>',
        ),
      ),
    ],
    [
      "the gate page with a byte cut",
      gateBytes.subarray(0, gateBytes.length - 1),
    ],
    [
      "the open page with its title swapped",
      Buffer.from(openText.replace(titleLine(openText), gateTitle)),
    ],
    ["the title line alone", Buffer.from(`${gateTitle}\n`)],
    [
      "the gate page with its last byte changed (same length)",
      (() => {
        const b = Buffer.from(gateBytes);
        b[b.length - 1] ^= 1;
        return b;
      })(),
    ],
  ];
  for (const [form, bytes] of tampered) {
    assert.ok(!bytes.equals(gateBytes), form);
    assert.ok(bytes.toString("utf8").includes(gateTitle.trim()), form);
  }
  assert.ok(
    tampered.some(([, bytes]) => bytes.length === gateBytes.length),
    "no tampered form has the length of the gate page",
  );
  /** @type {Array<[string, (dir: string) => void]>} */
  const twins = [
    [
      "gate.html missing beside the open pages",
      (dir) => {
        fs.cpSync(PUBLIC, dir, { recursive: true });
        fs.rmSync(path.join(dir, "gate.html"));
      },
    ],
    [
      "the open index.html alone",
      (dir) => {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, "index.html"), openBytes);
      },
    ],
    [
      "the gate page as index.html beside another file",
      (dir) => {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, "index.html"), gateBytes);
        fs.copyFileSync(
          path.join(PUBLIC, "404.html"),
          path.join(dir, "404.html"),
        );
      },
    ],
    [
      "the gate page as index.html beside a folder",
      (dir) => {
        fs.mkdirSync(path.join(dir, "css"), { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), gateBytes);
      },
    ],
    [
      "the gate page as a link named index.html",
      (dir) => {
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, "..", "gate-copy.html"), gateBytes);
        fs.symlinkSync(
          path.join(dir, "..", "gate-copy.html"),
          path.join(dir, "index.html"),
        );
      },
    ],
    ["no output folder", () => {}],
  ];
  for (const [form, bytes] of tampered)
    twins.push(
      [
        `${form} as the lone index.html, public/gate.html gone`,
        (dir) => {
          fs.mkdirSync(dir);
          fs.writeFileSync(path.join(dir, "index.html"), bytes);
        },
      ],
      [
        `${form} as public/gate.html beside the open pages`,
        (dir) => {
          fs.cpSync(PUBLIC, dir, { recursive: true });
          fs.writeFileSync(path.join(dir, "gate.html"), bytes);
        },
      ],
    );
  // Every twin runs in place (the output folder is public/ itself), and its refusal line names the real
  // reason: public/gate.html missing, or public/gate.html with other bytes.
  const missingLine =
    "vercel-build: refused: SITE_GATE is set, public/gate.html is missing and the output folder is not the closed output of an earlier run";
  const otherBytesLine =
    "vercel-build: refused: SITE_GATE is set and public/gate.html does not hold the bytes of the gate page (its sha256 is not GATE_SHA256); nothing changed";
  for (const [name, plant] of twins) {
    const dir = path.join(tempDir(t), "public");
    plant(dir);
    const line = fs.existsSync(path.join(dir, "gate.html"))
      ? otherBytesLine
      : missingLine;
    const was = fs.existsSync(dir) ? snapshot(dir) : null;
    const r = closedRun(dir);
    assert.notEqual(r.code, 0, name);
    assert.deepEqual(r.calls, [], name);
    assert.deepEqual(fs.existsSync(dir) ? snapshot(dir) : null, was, name);
    assert.match(r.lines.join("\n"), /^vercel-build: refused: /, name);
    assert.deepEqual(r.lines, [line], name);
  }
  // Outside the Vercel shape the output folder is not public/: a public/ without gate.html is refused
  // even beside an output folder that already holds the gate page alone, and the line says so (it does not
  // say that the output folder is not the closed output of an earlier run, which would be untrue here).
  const src = path.join(tempDir(t), "public");
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, "index.html"), openBytes);
  const out = path.join(tempDir(t), "out");
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, "index.html"), gateBytes);
  const outBefore = snapshot(out);
  const elsewhere = closedRun(src, out);
  assert.deepEqual([elsewhere.code, elsewhere.calls], [1, []]);
  assert.deepEqual(snapshot(out), outBefore);
  assert.deepEqual(elsewhere.lines, [
    "vercel-build: refused: SITE_GATE is set and public/gate.html is missing; the output folder is not public/ itself, so no earlier run is accepted",
  ]);
});

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
