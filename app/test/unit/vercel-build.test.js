import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
import { snapshot, tree } from "../fixtures/snapshot.js";

// REQ-109 criterion 8 and REQ-111 criterion 9, with injected steps and a temporary output folder. runBuild is
// async (decisions/0124 О2): every test here awaits it, because a test that does not await a promise proves
// nothing (the rows of the code design, section 11 row 8).

const PUBLIC = path.join(APP, "public");
// The files that the public set may change (the code design 4.11); examples.html is removed.
const CHANGED = [
  "index.html",
  "how.html",
  "demo.html",
  "404.html",
  "shared/i18n/texts.js",
];
const MARK = ["pg", "marker", "Q7"].join("-");
const UNPOOLED_MARK = ["pg", "unpooled", "Q7"].join("-");

/** @param {import("node:test").TestContext} t @param {Record<string, string>} env @param {{ migrate?: number, check?: number, migrateThrows?: boolean }} [o] */
async function build(t, env, o = {}) {
  const outDir = path.join(tempDir(t), "out");
  const calls = [];
  const lines = [];
  const code = await runBuild({
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

/**
 * One closed build in the Vercel shape: the output folder is the uploaded public/ itself (or `outDir`),
 * MIGRATE_ON_BUILD=1 and a migrate step that throws.
 * @param {string} publicDir
 * @param {string} [outDir]
 */
async function closedRun(publicDir, outDir = publicDir) {
  /** @type {string[]} */
  const calls = [];
  /** @type {string[]} */
  const lines = [];
  const code = await runBuild({
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

test("VB-1 open (SITE_GATE unset or empty): migrate then check-public with MIGRATE_ON_BUILD=1; only check-public without it; the output is app/public without examples.html, every file outside the list of 4.11 byte-equal", async (t) => {
  for (const gate of [{}, { SITE_GATE: "" }]) {
    const label = JSON.stringify(gate);
    const a = await build(t, {
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
    // The public set (REQ-111 criterion 9, the code design 4.11): examples.html is left out, the files of
    // CHANGED keep only what the build cuts (PB-2 proves each of them), and every other file is byte-equal.
    assert.ok(tree(PUBLIC).includes("examples.html"), label);
    assert.deepEqual(
      tree(a.outDir),
      tree(PUBLIC).filter((f) => f !== "examples.html"),
      label,
    );
    for (const f of tree(a.outDir).filter((f) =>
      fs.statSync(path.join(a.outDir, f)).isFile(),
    ))
      if (!CHANGED.includes(f))
        assert.ok(
          fs
            .readFileSync(path.join(a.outDir, f))
            .equals(fs.readFileSync(path.join(PUBLIC, f))),
          `${label} ${f}`,
        );
    for (const m of [MARK, UNPOOLED_MARK])
      assert.ok(!a.lines.join("\n").includes(m), `${label} ${m}`);
    const b = await build(t, { ...gate });
    assert.deepEqual([b.code, b.calls], [0, ["check-public"]], label);
  }
});

test("VB-2 a failing migrate stops before check-public; a failing check-public fails", async (t) => {
  const a = await build(t, { MIGRATE_ON_BUILD: "1" }, { migrate: 1 });
  assert.deepEqual([a.code !== 0, a.calls], [true, ["migrate"]]);
  const b = await build(t, {}, { check: 1 });
  assert.notEqual(b.code, 0);
});

test("VB-3 closed: no migrate, no database call, exit 0, the output is only index.html equal to the gate page", async (t) => {
  // GATE_SHA256 of vercel-build.js is the sha256 of the bytes of the gate page: a change of
  // app/public/gate.html without a new constant is red here (and every closed run below is refused).
  const gateBytes = fs.readFileSync(path.join(PUBLIC, "gate.html"));
  assert.equal(
    GATE_SHA256,
    createHash("sha256").update(gateBytes).digest("hex"),
    "GATE_SHA256 is not the sha256 of app/public/gate.html",
  );
  for (const gate of ["closed", "1"]) {
    const a = await build(
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
  const first = await closedRun(upload);
  assert.deepEqual([first.code, first.calls], [0, []]);
  assert.deepEqual(tree(upload), ["index.html"]);
  assert.ok(fs.readFileSync(path.join(upload, "index.html")).equals(gateBytes));
  // The platform runs vercel-build twice in one build (spike S1, decisions/0122 О5 (4)). The second run
  // on the same folder (the finished output) finds public/gate.html gone and the bytes of the gate page
  // alone: exit 0, nothing changed.
  const before = snapshot(upload);
  const second = await closedRun(upload);
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
    // The title line of the open index.html carries a data-t attribute (the code design 4.3), the
    // gate page's does not: the line is read with or without attributes.
    const m = /^ *<title[^>]*>[^<]*<\/title>$/m.exec(text);
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
    const r = await closedRun(dir);
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
  const elsewhere = await closedRun(src, out);
  assert.deepEqual([elsewhere.code, elsewhere.calls], [1, []]);
  assert.deepEqual(snapshot(out), outBefore);
  assert.deepEqual(elsewhere.lines, [
    "vercel-build: refused: SITE_GATE is set and public/gate.html is missing; the output folder is not public/ itself, so no earlier run is accepted",
  ]);
});

test("VB-4 closed: the real app/public of a git working tree is never replaced; a copy of it inside a temporary git working tree is refused and stays as it was", async (t) => {
  // The real app/public is only read. Outside a git tree runBuild would rightly replace the folder, so the
  // test refuses to run where it is not in one, and the closed build below runs on a copy of it that lies in
  // a git working tree made here: a refusal that were broken could replace only that copy, never the
  // uncommitted pages of the tree the check runs in (the same shape as PB-4).
  assert.ok(insideGitTree(PUBLIC), "VB-4 needs app/ inside a git working tree");
  const real = snapshot(PUBLIC);
  const root = tempDir(t);
  const copy = path.join(root, "app", "public");
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.cpSync(PUBLIC, copy, { recursive: true });
  assert.ok(!insideGitTree(copy), "the temporary folder is in a git tree");
  // A scratch repository with no global or system git settings, as IB-2 makes one.
  const home = path.join(tempDir(t), "home");
  fs.mkdirSync(home);
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], {
    cwd: root,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: home,
      XDG_CONFIG_HOME: home,
      GIT_CONFIG_NOSYSTEM: "1",
    },
    stdio: "pipe",
  });
  assert.ok(insideGitTree(copy), "git init made no working tree");
  const copyBefore = snapshot(copy);
  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  const calls = [];
  const code = await runBuild({
    env: { SITE_GATE: "closed" },
    migrate: () => {
      calls.push("migrate");
      return 1;
    },
    checkPublic: () => {
      calls.push("check-public");
      return 1;
    },
    publicDir: copy,
    outDir: copy,
    log: (l) => lines.push(l),
  });
  assert.equal(code, 2);
  assert.deepEqual(calls, []);
  assert.deepEqual(snapshot(copy), copyBefore);
  assert.deepEqual(lines, [
    "vercel-build: refused: the closed build replaces the output folder and runs only in the uploaded copy, not in a git working tree",
  ]);
  assert.deepEqual(snapshot(PUBLIC), real);
});

test("VB-5 the open build into another output folder refuses a link that the output folder already holds, before the copy: nothing is written through it and the folder stays as it was (SECURITY-REVIEWER L3 of the second pass)", async (t) => {
  const refusal = (/** @type {string} */ link) =>
    `vercel-build: refused: ${link}: a symbolic link, which the public set does not follow`;
  /** The state of a folder by lstat: each entry, with the target of a link and the bytes of a file. */
  const state = (/** @type {string} */ dir) => {
    /** @type {string[]} */
    const out = [];
    /** @param {string} abs @param {string} rel */
    const walk = (abs, rel) => {
      for (const e of fs
        .readdirSync(abs, { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        const r = rel === "" ? e.name : `${rel}/${e.name}`;
        const at = path.join(abs, e.name);
        if (e.isSymbolicLink()) out.push(`${r} -> ${fs.readlinkSync(at)}`);
        else if (e.isDirectory()) {
          out.push(`${r}/`);
          walk(at, r);
        } else out.push(`${r} ${fs.readFileSync(at).toString("base64")}`);
      }
    };
    walk(dir, "");
    return out;
  };
  /**
   * @param {string} out
   * @returns {Promise<{ code: number, lines: string[] }>}
   */
  const run = async (out) => {
    /** @type {string[]} */
    const lines = [];
    const code = await runBuild({
      env: {},
      migrate: () => 0,
      checkPublic: () => 0,
      publicDir: PUBLIC,
      outDir: out,
      log: (l) => lines.push(l),
    });
    return { code, lines };
  };
  const rows = [
    [
      "an entry that is a link to a folder outside (the office folder)",
      "office",
      (/** @type {string} */ out, /** @type {string} */ outside) =>
        fs.symlinkSync(outside, path.join(out, "office")),
    ],
    [
      "a page that is a link to a file outside",
      "index.html",
      (/** @type {string} */ out, /** @type {string} */ outside) =>
        fs.symlinkSync(
          path.join(outside, "page.html"),
          path.join(out, "index.html"),
        ),
    ],
    [
      "a link below a folder",
      "css/link.html",
      (/** @type {string} */ out, /** @type {string} */ outside) => {
        fs.mkdirSync(path.join(out, "css"));
        fs.symlinkSync(
          path.join(outside, "page.html"),
          path.join(out, "css", "link.html"),
        );
      },
    ],
  ];
  for (const [
    name,
    named,
    plant,
  ] of /** @type {Array<[string, string, (o: string, x: string) => void]>} */ (
    rows
  )) {
    const root = tempDir(t);
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "page.html"), "<p>outside</p>\n");
    const out = path.join(root, "out");
    fs.mkdirSync(out);
    plant(out, outside);
    const outBefore = state(out);
    const outsideBefore = state(outside);
    const { code, lines } = await run(out);
    assert.equal(code, 1, name);
    assert.deepEqual(lines, [refusal(named)], name);
    assert.deepEqual(state(out), outBefore, `${name}: the output folder`);
    assert.deepEqual(state(outside), outsideBefore, `${name}: outside`);
  }
  {
    // The output folder is itself a link to a folder outside.
    const root = tempDir(t);
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    const out = path.join(root, "out");
    fs.symlinkSync(outside, out);
    const { code, lines } = await run(out);
    assert.equal(code, 1);
    assert.deepEqual(lines, [
      "vercel-build: refused: the folder of the public set is a symbolic link, which the public set does not follow",
    ]);
    assert.deepEqual(state(outside), []);
    assert.equal(fs.readlinkSync(out), outside);
  }
  {
    // The control: an output folder that holds only plain files and folders is built into, as one that does
    // not exist is.
    const root = tempDir(t);
    const out = path.join(root, "out");
    fs.mkdirSync(path.join(out, "css"), { recursive: true });
    fs.writeFileSync(path.join(out, "css", "old.css"), "a{}\n");
    const { code, lines } = await run(out);
    assert.equal(code, 0);
    assert.deepEqual(lines, ["vercel-build: done"]);
    assert.ok(fs.existsSync(path.join(out, "index.html")));
  }
});

test("VB-6 the folder snapshot that the refusal checks rely on: it changes with an added empty directory, with a changed byte of the same length, with an added and a removed file, and with nothing else", (t) => {
  const dir = tempDir(t);
  fs.mkdirSync(path.join(dir, "sub"));
  fs.writeFileSync(path.join(dir, "a.txt"), "abc");
  fs.writeFileSync(path.join(dir, "sub", "b.txt"), "xyz");
  // A top-level file that sorts after the nested one: the order is by the sorted names, not the order of reading.
  fs.writeFileSync(path.join(dir, "z.txt"), "zzz");
  const sha = (/** @type {string} */ text) =>
    createHash("sha256").update(text).digest("hex");
  const base = [
    `a.txt ${sha("abc")}`,
    "sub dir",
    `sub/b.txt ${sha("xyz")}`,
    `z.txt ${sha("zzz")}`,
  ];
  assert.deepEqual(
    snapshot(dir),
    base,
    "the names, the directories, the bytes",
  );
  assert.deepEqual(snapshot(dir), base, "a read changes nothing");
  // An added empty directory.
  fs.mkdirSync(path.join(dir, "empty"));
  assert.deepEqual(snapshot(dir), [
    base[0],
    "empty dir",
    base[1],
    base[2],
    base[3],
  ]);
  fs.rmdirSync(path.join(dir, "empty"));
  assert.deepEqual(snapshot(dir), base, "the directory removed again");
  // A changed byte, the size and the names the same.
  fs.writeFileSync(path.join(dir, "a.txt"), "abd");
  assert.deepEqual(snapshot(dir), [
    `a.txt ${sha("abd")}`,
    base[1],
    base[2],
    base[3],
  ]);
  assert.notDeepEqual(snapshot(dir), base);
  fs.writeFileSync(path.join(dir, "a.txt"), "abc");
  assert.deepEqual(snapshot(dir), base, "the byte restored");
  // An added file and a removed file.
  fs.writeFileSync(path.join(dir, "c.txt"), "");
  assert.deepEqual(snapshot(dir), [
    base[0],
    `c.txt ${sha("")}`,
    base[1],
    base[2],
    base[3],
  ]);
  fs.rmSync(path.join(dir, "c.txt"));
  fs.rmSync(path.join(dir, "sub", "b.txt"));
  assert.deepEqual(snapshot(dir), [base[0], "sub dir", base[3]]);
});
