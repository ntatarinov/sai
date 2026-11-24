import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { blank } from "../fixtures/blank.js";
import { PUBLIC_LANGS, SOURCE_LANGS } from "../../public/shared/i18n/lang.js";
import {
  GATES,
  ORDER_TEXTS_PUBLIC,
  writePublicSet,
} from "../../scripts/public-set.js";
import { insideGitTree, runBuild } from "../../scripts/vercel-build.js";
import { APP, tempDir } from "../fixtures/helpers.js";
import { fileNames, snapshot } from "../fixtures/snapshot.js";

// REQ-111 criterion 9: the public set of the open build — what production leaves out (the order texts,
// examples.html, the Kazakh texts) and what it keeps byte for byte. Every build here runs in place on a copy of
// app/public and app/content outside any git working tree, its steps injected and awaited; the real folders are
// only read. The oracles are written here: the reader of the region markers, the line-by-line cut, the search
// for a leaked text.

const PUBLIC = path.join(APP, "public");
const CONTENT = path.join(APP, "content");
const TEXTS = "shared/i18n/texts.js";
// The four account pages of REQ-114 (the code design M2AUTH, 5): each holds exactly one region, the kk region
// around its kk button, and no order region (decisions/0137 Addition 3, the guard edit A6); the open build
// cuts that region, so they are files the public set changes too.
const ACCOUNT_PAGES = [
  "admin-totp.html",
  "login.html",
  "reset.html",
  "setup.html",
];
// The files that the public set changes (the code design 4.11, and the account pages); examples.html is
// removed.
const CHANGED = [
  "404.html",
  "demo.html",
  "how.html",
  "index.html",
  ...ACCOUNT_PAGES,
  TEXTS,
];
// The pages with regions of both kinds.
const PAGES = ["404.html", "demo.html", "how.html", "index.html"];

const names = fileNames;
const read = (/** @type {string} */ dir, /** @type {string} */ rel) =>
  fs.readFileSync(path.join(dir, rel), "utf8");

/**
 * A fresh upload: copies of app/public and app/content side by side, outside any git working tree.
 * @param {import("node:test").TestContext} t
 * @param {(pub: string) => void} [plant] edits the copy of app/public
 */
function upload(t, plant) {
  const root = tempDir(t);
  const pub = path.join(root, "public");
  fs.cpSync(PUBLIC, pub, { recursive: true });
  fs.cpSync(CONTENT, path.join(root, "content"), { recursive: true });
  assert.ok(!insideGitTree(pub), "the copy is inside a git working tree");
  if (plant) plant(pub);
  return { root, pub };
}

/**
 * The open build in place on `pub`, its steps injected.
 * @param {string} pub
 * @param {Record<string, string>} [env]
 */
async function build(pub, env = {}) {
  /** @type {string[]} */
  const calls = [];
  /** @type {string[]} */
  const lines = [];
  const code = await runBuild({
    env,
    migrate: () => {
      calls.push("migrate");
      return 0;
    },
    checkPublic: () => {
      calls.push("check-public");
      return 0;
    },
    publicDir: pub,
    outDir: pub,
    log: (l) => lines.push(l),
  });
  return { code, calls, lines };
}

/** The texts module of a folder, imported by its bytes' hash, so each folder's own file is read.
 * @param {string} dir */
async function importTexts(dir) {
  const file = path.join(dir, TEXTS);
  const hash = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  return import(`${pathToFileURL(file).href}?sha256=${hash}`);
}

const escape = (/** @type {string} */ s) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (/** @type {string} */ s) => s.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------------------------------------
// The oracles.

/**
 * The page without the regions of the closed kinds, by lines: from a line that is only an opening marker to the
 * nearest line that is only the end marker of its kind, both included.
 * @param {string} text
 * @param {string[]} kinds
 */
function cutOracle(text, kinds) {
  const out = [];
  /** @type {string | null} */
  let inside = null;
  for (const line of text.split("\n")) {
    if (inside !== null) {
      if (new RegExp(`^\\s*<!-- /sai:${inside} -->\\s*$`).test(line))
        inside = null;
      continue;
    }
    const open = /^\s*<!-- sai:(order|kk) -->\s*$/.exec(line);
    if (open && kinds.includes(open[1])) {
      inside = open[1];
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * The greedy cut (the mutant M78): from the first opening marker of a kind to the last end marker of that kind.
 * @param {string} text
 * @param {string[]} kinds
 */
function greedyCut(text, kinds) {
  let out = text.split("\n");
  for (const kind of kinds) {
    const from = out.findIndex((l) => l.trim() === `<!-- sai:${kind} -->`);
    const to = out.map((l) => l.trim()).lastIndexOf(`<!-- /sai:${kind} -->`);
    if (from >= 0 && to > from)
      out = [...out.slice(0, from), ...out.slice(to + 1)];
  }
  return out.join("\n");
}

/**
 * The regions of a page, read by the test's own reader of the markers: every line with a marker-like comment
 * must be one of the four forms alone on its line; a region is closed by the end marker of its kind, never
 * nested.
 * @param {string} text
 * @returns {{ regions: Array<{ kind: string, from: number, to: number }>, problems: string[] }}
 */
function readMarkers(text) {
  const lines = text.split("\n");
  /** @type {Array<{ kind: string, from: number, to: number }>} */
  const regions = [];
  /** @type {string[]} */
  const problems = [];
  /** @type {{ kind: string, from: number } | null} */
  let open = null;
  lines.forEach((line, i) => {
    if (!/<!--\s*\/?\s*sai\s*:/i.test(line)) return;
    const m = /^[ \t]*<!-- (\/?)sai:(order|kk) -->[ \t]*$/.exec(line);
    if (!m)
      return void problems.push(
        `line ${i + 1}: not one of the four forms alone`,
      );
    if (m[1] === "") {
      if (open)
        problems.push(`line ${i + 1}: an opening marker inside a region`);
      else open = { kind: m[2], from: i };
    } else if (!open || open.kind !== m[2])
      problems.push(`line ${i + 1}: an end marker with no region of its kind`);
    else {
      regions.push({ kind: m[2], from: open.from, to: i });
      open = null;
    }
  });
  if (open) problems.push("a region is never closed");
  return { regions, problems };
}

/**
 * The findings of PB-6 on the real (or planted) source of a page: the markers, the places of the references to
 * examples.html and of the kk button, and the content of every region.
 * @param {string} page
 * @param {string} text
 * @returns {string[]}
 */
function regionFindings(page, text) {
  const { regions, problems } = readMarkers(text);
  /** @type {string[]} */
  const out = problems.map((p) => `markers: ${p}`);
  const lines = text.split("\n");
  const inside = (/** @type {number} */ i, /** @type {string} */ kind) =>
    regions.some((r) => r.kind === kind && i > r.from && i < r.to);
  const keysOf = (/** @type {string} */ s) =>
    [...s.matchAll(/\sdata-t(?:-aria)?="([^"]*)"/g)].map((m) => m[1]);
  lines.forEach((line, i) => {
    if (
      /examples\.html/.test(line) &&
      !inside(i, "order") &&
      page !== "examples.html"
    )
      out.push(`line ${i + 1}: examples.html outside an order region`);
    if (/data-lang\s*=\s*["']?kk/.test(line) && !inside(i, "kk"))
      out.push(`line ${i + 1}: data-lang kk outside a kk region`);
    if (
      !regions.some((r) => i >= r.from && i <= r.to) &&
      page !== "examples.html"
    )
      for (const k of keysOf(line))
        if (k.startsWith("order_"))
          out.push(`line ${i + 1}: ${k} outside a region`);
  });
  for (const r of regions) {
    const body = lines.slice(r.from + 1, r.to).join("\n");
    if (/\sid\s*=/.test(body))
      out.push(`${r.kind} region at line ${r.from + 1}: an element with an id`);
    if (r.kind === "order")
      for (const k of keysOf(body))
        if (!k.startsWith("order_"))
          out.push(`order region at line ${r.from + 1}: ${k} is no order_ key`);
    if (r.kind === "kk") {
      const tags = [...body.matchAll(/<([A-Za-z][\w-]*)/g)].map((m) => m[1]);
      if (
        tags.length !== 1 ||
        tags[0] !== "button" ||
        !/data-lang="kk"/.test(body) ||
        !/data-t="lang_kk"/.test(body)
      )
        out.push(
          `kk region at line ${r.from + 1}: not exactly the one kk button`,
        );
    }
  }
  return out;
}

/**
 * The findings of PB-1 on a built folder: examples.html, the texts module, the references to examples.html and
 * to the kk button, and every order_ value of any language or kk-only value of the source that a file holds
 * as a whole word or phrase unless a kept key has that value.
 * @param {string} dir
 * @param {Record<string, any>} source the texts module of the source
 * @returns {Promise<string[]>}
 */
async function leakFindings(dir, source) {
  /** @type {string[]} */
  const out = [];
  const files = names(dir);
  if (files.includes("examples.html")) out.push("examples.html is left");
  const mod = await importTexts(dir);
  if (JSON.stringify([...mod.LANGS]) !== JSON.stringify(["ru", "en"]))
    out.push(`LANGS ${JSON.stringify(mod.LANGS)}`);
  /** @type {Set<string>} */
  const kept = new Set();
  for (const [key, entry] of Object.entries(mod.TEXTS)) {
    if (key.startsWith("order_")) out.push(`the output keeps ${key}`);
    else {
      for (const l of ["ru", "en"]) kept.add(/** @type {any} */ (entry)[l]);
      const src = source.TEXTS[key];
      for (const l of ["ru", "en"])
        if (!src || src[l] !== /** @type {any} */ (entry)[l])
          out.push(`${key}: ${l} differs from the source`);
    }
    if (Object.hasOwn(/** @type {any} */ (entry), "kk"))
      out.push(`${key} has a kk value`);
  }
  for (const key of Object.keys(source.TEXTS))
    if (!key.startsWith("order_") && !Object.hasOwn(mod.TEXTS, key))
      out.push(`${key}: dropped`);
  /** @type {Set<string>} */
  const leaks = new Set();
  for (const [key, entry] of Object.entries(source.TEXTS)) {
    const e = /** @type {Record<string, string>} */ (entry);
    if (key.startsWith("order_"))
      for (const l of ["ru", "kk", "en"]) leaks.add(e[l]);
    else if (e.kk !== e.ru && e.kk !== e.en) leaks.add(e.kk);
  }
  for (const v of kept) leaks.delete(v);
  const found = [...leaks].map((v) => ({
    value: v,
    re: new RegExp(
      `(?<![\\p{L}\\p{N}])${escape(fold(v))}(?![\\p{L}\\p{N}])`,
      "iu",
    ),
  }));
  for (const f of files) {
    const text = fold(read(dir, f));
    if (/examples\.html/i.test(text)) out.push(`${f} holds examples.html`);
    if (/data-lang\s*=\s*["']?\s*kk/i.test(text))
      out.push(`${f} holds data-lang kk`);
    for (const { value, re } of found)
      if (re.test(text)) out.push(`${f} holds «${value}»`);
  }
  return out;
}

/**
 * The findings of PB-2 on a built folder: the names, the files that differ, every other file byte for byte,
 * and each page that differs against its source minus exactly the lines of its regions.
 * @param {string} src
 * @param {string} out
 * @returns {string[]}
 */
function diffFindings(src, out) {
  /** @type {string[]} */
  const found = [];
  const a = snapshot(src);
  const b = snapshot(out);
  const was = new Map(a.map((l) => l.split(" ")));
  const now = new Map(b.map((l) => l.split(" ")));
  const differ = [...new Set([...was.keys(), ...now.keys()])]
    .filter((f) => was.get(f) !== now.get(f))
    .sort();
  const want = [...CHANGED, "examples.html"].sort();
  if (JSON.stringify(differ) !== JSON.stringify(want))
    found.push(`the files that differ: ${differ.join(", ")}`);
  for (const f of [...PAGES, ...ACCOUNT_PAGES]) {
    if (!now.has(f)) {
      found.push(`${f}: missing`);
      continue;
    }
    if (read(out, f) !== cutOracle(read(src, f), ["order", "kk"]))
      found.push(`${f}: is not its source minus the lines of its regions`);
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------

test("PB-1 the open build in place: no examples.html, no order_ key, languages ru and en, no kk value, no leaked order or kk-only text, no reference to examples.html or the kk button", async (t) => {
  const source = await importTexts(PUBLIC);
  const { pub } = upload(t);
  const r = await build(pub);
  assert.deepEqual(
    [r.code, r.calls],
    [0, ["check-public"]],
    r.lines.join("\n"),
  );
  assert.deepEqual(await leakFindings(pub, source), []);
  assert.ok(!fs.existsSync(path.join(pub, "examples.html")));
  const mod = await importTexts(pub);
  assert.ok(Object.keys(source.TEXTS).some((k) => k.startsWith("order_")));
  assert.ok(Object.keys(mod.TEXTS).length > 100);
  // Planted outputs: each rule of the search is red on an output that breaks it.
  /** @type {Array<[string, (dir: string) => void, RegExp]>} */
  const kk =
    Object.entries(source.TEXTS).find(
      ([k, e]) =>
        !k.startsWith("order_") &&
        /** @type {any} */ (e).kk !== /** @type {any} */ (e).ru &&
        /** @type {any} */ (e).kk !== /** @type {any} */ (e).en,
    ) ?? [];
  const order =
    Object.entries(source.TEXTS).find(
      ([k, e]) =>
        k.startsWith("order_") &&
        !Object.entries(mod.TEXTS).some(
          ([, m]) =>
            /** @type {any} */ (m).ru === /** @type {any} */ (e).ru ||
            /** @type {any} */ (m).en === /** @type {any} */ (e).ru,
        ),
    ) ?? [];
  const sameAsKept =
    Object.entries(source.TEXTS).find(
      ([k, e]) =>
        k.startsWith("order_") &&
        Object.entries(mod.TEXTS).some(
          ([, m]) => /** @type {any} */ (m).ru === /** @type {any} */ (e).ru,
        ),
    ) ?? [];
  assert.ok(kk[0] && order[0] && sameAsKept[0]);
  const append =
    (/** @type {string} */ f, /** @type {string} */ text) =>
    (/** @type {string} */ dir) =>
      fs.appendFileSync(path.join(dir, f), `\n${text}\n`);
  /** @type {Array<[string, (dir: string) => void, RegExp]>} */
  const planted = [
    [
      "examples.html left",
      (d) =>
        fs.copyFileSync(
          path.join(PUBLIC, "examples.html"),
          path.join(d, "examples.html"),
        ),
      /examples\.html is left/,
    ],
    [
      "an order_ key left",
      (d) => {
        const f = path.join(d, TEXTS);
        const text = fs.readFileSync(f, "utf8");
        fs.writeFileSync(
          f,
          text.replace(
            /\}\);\s*$/,
            `"order_x": Object.freeze({"ru":"Один","en":"One"}),\n});\n`,
          ),
        );
      },
      /the output keeps order_x/,
    ],
    [
      "a kk value left",
      (d) => {
        const f = path.join(d, TEXTS);
        const text = fs.readFileSync(f, "utf8");
        const line = /^"you": Object\.freeze\(\{/m;
        assert.match(text, line);
        fs.writeFileSync(
          f,
          text.replace(line, '"you": Object.freeze({"kk":"Сіз",'),
        );
      },
      /you has a kk value/,
    ],
    [
      "kk in LANGS",
      (d) => {
        const f = path.join(d, TEXTS);
        fs.writeFileSync(
          f,
          fs
            .readFileSync(f, "utf8")
            .replace(
              'Object.freeze(["ru","en"])',
              'Object.freeze(["ru","kk","en"])',
            ),
        );
      },
      /LANGS/,
    ],
    [
      "a key dropped",
      (d) => {
        const f = path.join(d, TEXTS);
        fs.writeFileSync(
          f,
          fs.readFileSync(f, "utf8").replace(/^"you": .*\n/m, ""),
        );
      },
      /you: dropped/,
    ],
    [
      "a reference to examples.html",
      append("how.html", '<a href="/examples.html">x</a>'),
      /how\.html holds examples\.html/,
    ],
    [
      "the kk button left",
      append("404.html", '<button data-lang="kk">ҚАЗ</button>'),
      /404\.html holds data-lang kk/,
    ],
    [
      "the kk button left (single quotes)",
      append("404.html", "<button data-lang='kk'>x</button>"),
      /404\.html holds data-lang kk/,
    ],
    [
      "an order text left in a page",
      append("how.html", `<p>${/** @type {any} */ (order[1]).ru}</p>`),
      /how\.html holds «/,
    ],
    [
      "an order text of another language left in a script",
      append("js/dom.js", `// ${/** @type {any} */ (order[1]).en}`),
      /js\/dom\.js holds «/,
    ],
    [
      "a kk-only text left in a page",
      append("how.html", `<p>${/** @type {any} */ (kk[1]).kk}</p>`),
      /how\.html holds «/,
    ],
    [
      "an order text with its white space folded",
      append(
        "demo.html",
        `<p>${/** @type {any} */ (order[1]).ru.split(" ").join("\n  ")}</p>`,
      ),
      /demo\.html holds «/,
    ],
    [
      "an order text in another letter case",
      append(
        "demo.html",
        `<p>${/** @type {any} */ (order[1]).ru.toUpperCase()}</p>`,
      ),
      /demo\.html holds «/,
    ],
  ];
  for (const [name, plant, want] of planted) {
    const copy = path.join(tempDir(t), "out");
    fs.cpSync(pub, copy, { recursive: true });
    plant(copy);
    const found = await leakFindings(copy, source);
    assert.ok(
      found.some((f) => want.test(f)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
  // The twins: an order value that a kept key also has stays allowed; an order value inside a longer word
  // is another word; the unplanted copy is clean.
  const twinValue = /** @type {any} */ (sameAsKept[1]).ru;
  const copy = path.join(tempDir(t), "out");
  fs.cpSync(pub, copy, { recursive: true });
  fs.appendFileSync(
    path.join(copy, "how.html"),
    `\n<p>${twinValue}</p>\n<p>x${/** @type {any} */ (order[1]).ru}y</p>\n`,
  );
  assert.deepEqual(await leakFindings(copy, source), []);
});

test("PB-2 every other file byte for byte; the files that differ are exactly the list of 4.11; each page that differs is its source minus exactly the lines of its regions", async (t) => {
  const { pub } = upload(t);
  const r = await build(pub);
  assert.equal(r.code, 0, r.lines.join("\n"));
  assert.deepEqual(diffFindings(PUBLIC, pub), []);
  assert.deepEqual(
    names(PUBLIC).filter((f) => !names(pub).includes(f)),
    ["examples.html"],
  );
  for (const f of names(pub))
    if (!CHANGED.includes(f))
      assert.ok(
        fs
          .readFileSync(path.join(pub, f))
          .equals(fs.readFileSync(path.join(PUBLIC, f))),
        f,
      );
  // The pages do hold regions of both kinds, so the comparison has something to cut; the account pages hold
  // the kk region only.
  for (const f of PAGES) {
    const src = read(PUBLIC, f);
    assert.ok(/<!-- sai:kk -->/.test(src) && /<!-- sai:order -->/.test(src), f);
    assert.ok(read(pub, f).length < src.length, f);
  }
  for (const f of ACCOUNT_PAGES) {
    const src = read(PUBLIC, f);
    assert.ok(/<!-- sai:kk -->/.test(src) && !/sai:order/.test(src), f);
    assert.ok(read(pub, f).length < src.length, f);
    assert.doesNotMatch(read(pub, f), /data-lang\s*=\s*["']?kk/, f);
  }
  // Planted outputs: each is red by the strict comparison.
  /** @type {Array<[string, (dir: string) => void, RegExp]>} */
  const planted = [
    [
      "the greedy cut (M78)",
      (d) => {
        for (const f of ["index.html", "how.html"])
          fs.writeFileSync(
            path.join(d, f),
            greedyCut(read(PUBLIC, f), ["order", "kk"]),
          );
      },
      /(index|how)\.html: is not its source minus/,
    ],
    [
      "a region left in a page",
      (d) =>
        fs.writeFileSync(path.join(d, "demo.html"), read(PUBLIC, "demo.html")),
      /demo\.html: is not its source minus/,
    ],
    [
      "one line more cut",
      (d) =>
        fs.writeFileSync(
          path.join(d, "404.html"),
          read(d, "404.html").replace("<footer>\n", ""),
        ),
      /404\.html: is not its source minus/,
    ],
    [
      "a byte changed in a kept file",
      (d) => fs.appendFileSync(path.join(d, "css/site.css"), " "),
      /the files that differ/,
    ],
    [
      "gate.html changed",
      (d) => fs.appendFileSync(path.join(d, "gate.html"), "\n"),
      /the files that differ/,
    ],
    [
      "examples.html kept",
      (d) =>
        fs.copyFileSync(
          path.join(PUBLIC, "examples.html"),
          path.join(d, "examples.html"),
        ),
      /the files that differ/,
    ],
    [
      "a file added",
      (d) => fs.writeFileSync(path.join(d, "extra.txt"), "x"),
      /the files that differ/,
    ],
    [
      "the texts module unchanged",
      (d) => fs.copyFileSync(path.join(PUBLIC, TEXTS), path.join(d, TEXTS)),
      /the files that differ/,
    ],
  ];
  for (const [name, plant, want] of planted) {
    const copy = path.join(tempDir(t), "out");
    fs.cpSync(pub, copy, { recursive: true });
    plant(copy);
    const found = diffFindings(PUBLIC, copy);
    assert.ok(
      found.some((f) => want.test(f)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
  // The line oracle itself: a region ends at its own end marker, and a text with no region is unchanged.
  const sample =
    "a\n<!-- sai:order -->\nb\n<!-- /sai:order -->\nc\n<!-- sai:order -->\nd\n<!-- /sai:order -->\ne\n";
  assert.equal(cutOracle(sample, ["order"]), "a\nc\ne\n");
  assert.equal(greedyCut(sample, ["order"]), "a\ne\n");
  assert.equal(cutOracle(sample, ["kk"]), sample);
});

test("PB-3 a second run on its own output: exit 0 and a byte-equal tree", async (t) => {
  const { pub } = upload(t);
  const first = await build(pub, { MIGRATE_ON_BUILD: "1" });
  assert.deepEqual([first.code, first.calls], [0, ["migrate", "check-public"]]);
  const after = snapshot(pub);
  const second = await build(pub, { MIGRATE_ON_BUILD: "1" });
  assert.deepEqual(
    [second.code, second.calls],
    [0, ["migrate", "check-public"]],
    second.lines.join("\n"),
  );
  assert.deepEqual(snapshot(pub), after);
  // And a third, after the second.
  const third = await build(pub);
  assert.equal(third.code, 0);
  assert.deepEqual(snapshot(pub), after);
  // The two runs said the same.
  assert.equal(second.lines.at(-1), "vercel-build: done");
  assert.equal(first.lines.at(-1), "vercel-build: done");
});

test("PB-4 a git working tree: the real app/public is only read; the open build on a copy inside a temporary git working tree is refused with exit 2, no step called, the copy as it was", async (t) => {
  assert.ok(insideGitTree(PUBLIC), "PB-4 needs app/ inside a git working tree");
  const real = snapshot(PUBLIC);
  const { root, pub } = upload(t);
  assert.ok(!insideGitTree(pub));
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
  // The copy lies at <root>/public; the build asks the same of any folder: inside a git working tree.
  const appPublic = path.join(root, "app", "public");
  fs.mkdirSync(path.dirname(appPublic), { recursive: true });
  fs.renameSync(pub, appPublic);
  assert.ok(insideGitTree(appPublic), "git init made no working tree");
  const before = snapshot(appPublic);
  const r = await build(appPublic, { MIGRATE_ON_BUILD: "1" });
  assert.equal(r.code, 2);
  assert.deepEqual(r.calls, []);
  assert.deepEqual(r.lines, [
    "vercel-build: refused: the open build writes the public set into the output folder and runs only in the uploaded copy, not in a git working tree",
  ]);
  assert.deepEqual(snapshot(appPublic), before);
  // The same copy outside the tree is built: the refusal is about the tree, not the folder.
  const outside = upload(t);
  assert.equal((await build(outside.pub)).code, 0);
  assert.deepEqual(snapshot(PUBLIC), real);
});

/**
 * The findings of PB-5 over the sources of app/ (path from app/ → text), blanked of comments: where
 * PUBLIC_LANGS is defined and who reads it, and every other literal list of the two public languages.
 * @param {Map<string, string>} files
 * @returns {string[]}
 */
function constantFindings(files) {
  /** @type {string[]} */
  const out = [];
  const LANG_FILE = "public/shared/i18n/lang.js";
  const readers = ["scripts/public-set.js", "server/app.js"];
  for (const [rel, src] of files) {
    const code = blank(src);
    const kept = blank(src, true);
    const defines =
      /\b(?:const|let|var)\s+PUBLIC_LANGS\b/.test(code) ||
      /\bPUBLIC_LANGS\s*=[^=]/.test(code);
    if (defines && rel !== LANG_FILE) out.push(`${rel} defines PUBLIC_LANGS`);
    const names = /\bPUBLIC_LANGS\b/.test(code);
    const from = [
      ...kept.matchAll(/import\s*\{([^}]*)\}\s*from\s*(["'`])([^"'`]+)\2/g),
    ].find((m) => /\bPUBLIC_LANGS\b/.test(m[1]));
    if (readers.includes(rel)) {
      if (!from) out.push(`${rel} does not import PUBLIC_LANGS`);
      else if (
        path.resolve(APP, path.dirname(rel), from[3]) !==
        path.join(APP, LANG_FILE)
      )
        out.push(`${rel} imports PUBLIC_LANGS from ${from[3]}`);
    } else if (rel !== LANG_FILE && names)
      out.push(`${rel} names PUBLIC_LANGS`);
    if (
      rel !== LANG_FILE &&
      /\[\s*(["'`])ru\1\s*,\s*(["'`])en\2\s*\]/.test(kept)
    )
      out.push(`${rel} holds a literal list of ru and en`);
  }
  return out;
}

test("PB-5 PUBLIC_LANGS is defined once, in lang.js, and imported by scripts/public-set.js and server/app.js; the output's LANGS equal it", async (t) => {
  /** @type {Map<string, string>} */
  const files = new Map();
  /** @param {string} dir */
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || (dir === APP && e.name === "test"))
        continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile() && /\.(?:js|mjs|cjs)$/.test(e.name))
        files.set(
          path.relative(APP, abs).split(path.sep).join("/"),
          fs.readFileSync(abs, "utf8"),
        );
    }
  };
  walk(APP);
  assert.ok(files.size > 30);
  assert.deepEqual(constantFindings(files), []);
  // The value, and the two gates.
  assert.deepEqual([...PUBLIC_LANGS], ["ru", "en"]);
  assert.ok(!PUBLIC_LANGS.includes("kk"));
  assert.deepEqual([...SOURCE_LANGS], ["ru", "kk", "en"]);
  assert.ok(Object.isFrozen(PUBLIC_LANGS));
  assert.equal(ORDER_TEXTS_PUBLIC, false);
  assert.ok(Object.isFrozen(GATES));
  assert.equal(GATES.langs, PUBLIC_LANGS);
  assert.equal(GATES.orderTexts, false);
  // The output's languages are the constant.
  const { pub } = upload(t);
  assert.equal((await build(pub)).code, 0);
  const mod = await importTexts(pub);
  assert.deepEqual([...mod.LANGS], [...PUBLIC_LANGS]);
  // Planted sources: a second definition, a reader that does not import it, an import from another file, a
  // second literal list, a third reader.
  const app = files.get("server/app.js") ?? "";
  /** @type {Array<[string, string, string, RegExp]>} */
  const damaged = [
    [
      "a second definition",
      "server/app.js",
      `${app}\nconst PUBLIC_LANGS = ["ru", "en"];\n`,
      /server\/app\.js defines PUBLIC_LANGS/,
    ],
    [
      "a literal list in the entry",
      "server/app.js",
      `${app}\nconst langs = ["ru", "en"];\n`,
      /holds a literal list/,
    ],
    [
      "a reader that does not import it",
      "scripts/public-set.js",
      (files.get("scripts/public-set.js") ?? "").replace(
        /import \{ PUBLIC_LANGS \} from [^\n]*\n/,
        "",
      ),
      /scripts\/public-set\.js does not import PUBLIC_LANGS/,
    ],
    [
      "an import from another file",
      "server/app.js",
      app.replace(
        /(import \{ PUBLIC_LANGS \} from )"[^"]+"/,
        '$1"../public/shared/i18n/texts.js"',
      ),
      /server\/app\.js imports PUBLIC_LANGS from/,
    ],
    [
      "a third reader",
      "server/routes/demo.js",
      `${files.get("server/routes/demo.js") ?? ""}\nconsole.log(PUBLIC_LANGS);\n`,
      /server\/routes\/demo\.js names PUBLIC_LANGS/,
    ],
    [
      "a definition in the lint",
      "scripts/word-lists.js",
      `${files.get("scripts/word-lists.js") ?? ""}\nexport const PUBLIC_LANGS = [];\n`,
      /scripts\/word-lists\.js defines PUBLIC_LANGS/,
    ],
  ];
  for (const [name, rel, text, want] of damaged) {
    assert.notEqual(text, files.get(rel), name);
    const found = constantFindings(new Map(files).set(rel, text));
    assert.ok(
      found.some((f) => want.test(f)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
});

// ---------------------------------------------------------------------------------------------------------
// PB-6 the source regions and the refusals of the markers.

test("PB-6 the source pages' regions: each marker alone, one of the four forms, closed, not nested; every examples.html and data-lang kk inside its region; the content of every region; the planted shapes (a) to (k) are refused; a symbolic link in the upload is refused", async (t) => {
  const pages = fs
    .readdirSync(PUBLIC)
    .filter((f) => f.endsWith(".html") && f !== "gate.html")
    .sort();
  assert.deepEqual(pages, [
    "404.html",
    "admin-totp.html",
    "demo.html",
    "examples.html",
    "how.html",
    "index.html",
    "login.html",
    "reset.html",
    "setup.html",
  ]);
  // The account pages: no finding (so no data-lang kk outside the one region), exactly one region, the kk one.
  for (const f of ACCOUNT_PAGES) {
    assert.deepEqual(regionFindings(f, read(PUBLIC, f)), [], f);
    assert.deepEqual(
      readMarkers(read(PUBLIC, f)).regions.map((r) => r.kind),
      ["kk"],
      f,
    );
  }
  for (const f of pages.filter((p) => !ACCOUNT_PAGES.includes(p))) {
    assert.deepEqual(regionFindings(f, read(PUBLIC, f)), [], f);
    const { regions } = readMarkers(read(PUBLIC, f));
    assert.ok(
      regions.some((r) => r.kind === "kk"),
      `${f}: no kk region`,
    );
    assert.ok(
      regions.some((r) => r.kind === "order"),
      `${f}: no order region`,
    );
  }
  // index.html and how.html hold two order regions each (the cut ends each at its own end marker).
  for (const f of ["index.html", "how.html"])
    assert.equal(
      readMarkers(read(PUBLIC, f)).regions.filter((r) => r.kind === "order")
        .length,
      2,
      f,
    );
  // The content rule is red on planted sources. A region opened before #ai-disclosure (M79) breaks it.
  const index = read(PUBLIC, "index.html");
  const idxLines = index.split("\n");
  const first = (/** @type {string} */ s) =>
    idxLines.findIndex((l) => l.trim() === s);
  const openD = first("<!-- sai:order -->");
  const endD = first("<!-- /sai:order -->");
  const footerOpen = idxLines.findIndex(
    (l, i) => i > endD && l.trim() === "<!-- sai:order -->",
  );
  const home = idxLines.findIndex((l) => l.includes('data-t="nav_landing"'));
  const disclosure = idxLines.findIndex((l) =>
    l.includes('class="disclosure"'),
  );
  const nav = idxLines.findIndex((l) => l.trim() === "<nav>");
  const footerEnd = idxLines.findIndex((l) => l.trim() === "</footer>");
  assert.ok(
    openD > 0 &&
      endD > openD &&
      footerOpen > endD &&
      home > 0 &&
      disclosure > 0 &&
      nav > disclosure &&
      footerEnd > nav,
  );
  /** @param {(lines: string[]) => void} edit */
  const planted = (edit) => {
    const lines = [...idxLines];
    edit(lines);
    return lines.join("\n");
  };
  const m79 = planted((l) => {
    l.splice(nav, 0, "<!-- /sai:order -->");
    l.splice(disclosure, 0, "<!-- sai:order -->");
  });
  assert.ok(
    regionFindings("index.html", m79).some((f) =>
      /an element with an id|is no order_ key/.test(f),
    ),
    "M79",
  );
  /** @type {Array<[string, string, RegExp]>} */
  const content = [
    [
      "an id inside a region",
      planted((l) => l.splice(openD + 1, 0, '<p id="x"></p>')),
      /an element with an id/,
    ],
    [
      "a kept key inside an order region",
      planted((l) => l.splice(openD + 1, 0, '<p data-t="nav_how"></p>')),
      /nav_how is no order_ key/,
    ],
    [
      "an order_ key outside a region",
      planted((l) =>
        l.splice(openD - 1, 0, '<p data-t="order_how_title"></p>'),
      ),
      /order_how_title outside a region/,
    ],
    [
      "an examples.html link outside a region",
      planted((l) => l.splice(openD - 1, 0, '<a href="/examples.html">x</a>')),
      /examples\.html outside an order region/,
    ],
    [
      "a kk button outside a region",
      planted((l) =>
        l.splice(openD - 1, 0, '<button data-lang="kk">x</button>'),
      ),
      /data-lang kk outside a kk region/,
    ],
    [
      "a second element in the kk region",
      planted((l) => {
        const kkEnd = l.findIndex((x) => x.trim() === "<!-- /sai:kk -->");
        l.splice(kkEnd, 0, "<span>x</span>");
      }),
      /not exactly the one kk button/,
    ],
    [
      "a marker that is not alone",
      planted(
        (l) =>
          (l[endD] = `${l[endD - 1]}${l[endD].trim()}`) &&
          l.splice(endD - 1, 1),
      ),
      /markers: line \d+: not one of the four forms/,
    ],
    [
      "a marker with no space",
      planted((l) => (l[openD] = "<!--sai:order-->")),
      /markers: line \d+: not one of the four forms/,
    ],
    [
      "a region never closed",
      planted((l) => l.splice(footerEnd, 0, "<!-- sai:order -->")),
      /markers: a region is never closed/,
    ],
    [
      "a stray end marker",
      planted((l) => l.splice(openD, 0, "<!-- /sai:order -->")),
      /an end marker with no region of its kind/,
    ],
  ];
  for (const [name, text, want] of content) {
    const found = regionFindings("index.html", text);
    assert.ok(
      found.some((f) => want.test(f)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
  // The planted shapes of the markers, each on a fresh copy of app/public and app/content outside any git tree,
  // writePublicSet awaited: (a) to (h) are refused by a message that names the file, the line and the rule,
  // and the copy is byte for byte as it was (refused before the first write).
  /** @type {Array<[string, string, (lines: string[]) => void, (lines: string[]) => string]>} */
  const shapes = [
    [
      "(a) block D's end marker dropped",
      "index.html",
      (l) => l.splice(endD, 1),
      () =>
        `index.html: line ${footerOpen}: an opening marker while the order region of line ${openD + 1} is open`,
    ],
    [
      "(b) an opening marker before the footer's home link",
      "index.html",
      (l) => l.splice(home, 0, "<!-- sai:order -->"),
      () =>
        `index.html: line ${footerOpen + 2}: an opening marker while the order region of line ${home + 1} is open`,
    ],
    [
      "(c) an opening marker nested inside block D",
      "index.html",
      (l) => l.splice(openD + 2, 0, "<!-- sai:order -->"),
      () =>
        `index.html: line ${openD + 3}: an opening marker while the order region of line ${openD + 1} is open`,
    ],
    [
      "(d) a stray end marker before block D",
      "index.html",
      (l) => l.splice(openD, 0, "<!-- /sai:order -->"),
      () =>
        `index.html: line ${openD + 1}: an end marker with no region of its kind open`,
    ],
    [
      "(e) an opening marker after the last region, never closed",
      "index.html",
      (l) => l.splice(footerEnd, 0, "<!-- sai:order -->"),
      () => `index.html: line ${footerEnd + 1}: a region never closed`,
    ],
    [
      "(f) block D's end marker on one line with the element before it",
      "index.html",
      (l) => {
        l[endD - 1] = `${l[endD - 1]}${l[endD].trim()}`;
        l.splice(endD, 1);
      },
      () =>
        `index.html: line ${endD}: a marker that is not alone on its line or not one of the four forms`,
    ],
    [
      "(k) a marker-like comment inside a region (every line is read, a region's inside too)",
      "index.html",
      (l) => l.splice(openD + 2, 0, "<!--sai:kk-->"),
      () =>
        `index.html: line ${openD + 3}: a marker that is not alone on its line or not one of the four forms`,
    ],
    [
      "(h) a kk region crossing block D",
      "index.html",
      (l) => {
        l.splice(openD + 3, 0, "<!-- /sai:kk -->");
        l.splice(openD, 0, "<!-- sai:kk -->");
      },
      () =>
        `index.html: line ${openD + 2}: an opening marker while the kk region of line ${openD + 1} is open`,
    ],
  ];
  for (const [name, page, edit, message] of shapes) {
    const { pub } = upload(t);
    const lines = read(pub, page).split("\n");
    edit(lines);
    fs.writeFileSync(path.join(pub, page), lines.join("\n"));
    const before = snapshot(pub);
    const expected = message(lines);
    await assert.rejects(
      writePublicSet(pub),
      (e) => e instanceof Error && e.message === expected,
      name,
    );
    assert.deepEqual(snapshot(pub), before, name);
  }
  // (g) the how panel's two markers written with no spaces: no other guard sees them (the panel holds no
  // examples.html), and the page is refused at the opening marker.
  {
    const { pub } = upload(t);
    const lines = read(pub, "how.html").split("\n");
    const open = lines.findIndex((l) => l.trim() === "<!-- sai:order -->");
    const end = lines.findIndex(
      (l, i) => i > open && l.trim() === "<!-- /sai:order -->",
    );
    lines[open] = lines[open].replace("<!-- sai:order -->", "<!--sai:order-->");
    lines[end] = lines[end].replace("<!-- /sai:order -->", "<!--/sai:order-->");
    fs.writeFileSync(path.join(pub, "how.html"), lines.join("\n"));
    const before = snapshot(pub);
    await assert.rejects(
      writePublicSet(pub),
      (e) =>
        e instanceof Error &&
        e.message ===
          `how.html: line ${open + 1}: a marker that is not alone on its line or not one of the four forms`,
      "(g)",
    );
    assert.deepEqual(snapshot(pub), before, "(g)");
  }
  // (i) the texts module with a third export, and one that cannot be imported: each names the file.
  for (const [
    name,
    tail,
    rule,
  ] of /** @type {Array<[string, string, RegExp]>} */ ([
    [
      "(i) a third export",
      "\nexport const EXTRA = 1;\n",
      /^shared\/i18n\/texts\.js: the texts module exports EXTRA, LANGS, TEXTS, not exactly LANGS and TEXTS$/,
    ],
    [
      "(i) a module that cannot be imported",
      "\nexport const = ;\n",
      /^shared\/i18n\/texts\.js: the texts module cannot be imported: /,
    ],
  ])) {
    const { pub } = upload(t);
    fs.appendFileSync(path.join(pub, TEXTS), tail);
    const before = snapshot(pub);
    await assert.rejects(
      writePublicSet(pub),
      (e) => e instanceof Error && rule.test(e.message),
      name,
    );
    assert.deepEqual(snapshot(pub), before, name);
  }
  // (j) a link to examples.html outside a region: refused by the guard of the output, after the cut, naming the page.
  {
    const { pub } = upload(t);
    const text = read(pub, "index.html");
    fs.writeFileSync(
      path.join(pub, "index.html"),
      text.replace("</main>", '<a href="/examples.html">x</a></main>'),
    );
    await assert.rejects(
      writePublicSet(pub),
      (e) =>
        e instanceof Error &&
        /^index\.html: /.test(e.message) &&
        /examples\.html/.test(e.message),
      "(j)",
    );
  }
  // A symbolic link anywhere in the upload is refused before anything is read, imported or written, so no
  // write can leave the folder through a link (the review finding SEC L1): the message names the first link in
  // name order, the outside targets and the copy are as they were.
  /** @param {string} dir the names, the bytes of files, the targets of links and the folders of a tree, by lstat */
  const lstate = (dir) => {
    /** @type {string[]} */
    const out = [];
    /** @param {string} abs @param {string} rel */
    const walk = (abs, rel) => {
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      entries.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
      for (const e of entries) {
        const r = rel === "" ? e.name : `${rel}/${e.name}`;
        const at = path.join(abs, e.name);
        if (e.isSymbolicLink()) out.push(`${r} -> ${fs.readlinkSync(at)}`);
        else if (e.isDirectory()) {
          out.push(`${r}/`);
          walk(at, r);
        } else
          out.push(
            `${r} ${createHash("sha256").update(fs.readFileSync(at)).digest("hex")}`,
          );
      }
    };
    walk(dir, "");
    return out;
  };
  const refusal = (/** @type {string} */ link) =>
    `${link}: a symbolic link, which the public set does not follow`;
  const outside = tempDir(t);
  fs.writeFileSync(
    path.join(outside, "page.html"),
    "<!doctype html>\n<p>outside</p>\n",
  );
  fs.copyFileSync(path.join(PUBLIC, TEXTS), path.join(outside, "texts.js"));
  fs.mkdirSync(path.join(outside, "dir"));
  fs.writeFileSync(path.join(outside, "dir", "x.html"), "<p>outside</p>\n");
  // An outside module that cannot be imported and an outside page whose markers cannot be paired: a link to
  // either is refused as a link, before the module is imported or the markers are read.
  fs.writeFileSync(path.join(outside, "broken.js"), "export const = ;\n");
  fs.writeFileSync(
    path.join(outside, "marker.html"),
    "<!-- sai:order -->\n<p>x</p>\n",
  );
  const outsideBefore = lstate(outside);
  /** @type {Array<[string, (pub: string) => void, string]>} */
  const links = [
    [
      "a page that is a link to an outside page",
      (pub) => {
        fs.rmSync(path.join(pub, "index.html"));
        fs.symlinkSync(
          path.join(outside, "page.html"),
          path.join(pub, "index.html"),
        );
      },
      refusal("index.html"),
    ],
    [
      "the texts module as a link",
      (pub) => {
        fs.rmSync(path.join(pub, TEXTS));
        fs.symlinkSync(path.join(outside, "texts.js"), path.join(pub, TEXTS));
      },
      refusal(TEXTS),
    ],
    [
      "a folder that is a link and holds a page",
      (pub) =>
        fs.symlinkSync(path.join(outside, "dir"), path.join(pub, "extra")),
      refusal("extra"),
    ],
    [
      "the texts module as a link to a file that cannot be imported",
      (pub) => {
        fs.rmSync(path.join(pub, TEXTS));
        fs.symlinkSync(path.join(outside, "broken.js"), path.join(pub, TEXTS));
      },
      refusal(TEXTS),
    ],
    [
      "a page that is a link to a page whose markers cannot be paired",
      (pub) => {
        fs.rmSync(path.join(pub, "404.html"));
        fs.symlinkSync(
          path.join(outside, "marker.html"),
          path.join(pub, "404.html"),
        );
      },
      refusal("404.html"),
    ],
    [
      "examples.html as a link",
      (pub) => {
        fs.rmSync(path.join(pub, "examples.html"));
        fs.symlinkSync(
          path.join(outside, "page.html"),
          path.join(pub, "examples.html"),
        );
      },
      refusal("examples.html"),
    ],
    [
      "two links: the first in name order is named",
      (pub) => {
        fs.symlinkSync(
          path.join(outside, "page.html"),
          path.join(pub, "zz.html"),
        );
        fs.symlinkSync(
          path.join(outside, "page.html"),
          path.join(pub, "aa.html"),
        );
      },
      refusal("aa.html"),
    ],
    [
      "a link below a folder",
      (pub) =>
        fs.symlinkSync(
          path.join(outside, "page.html"),
          path.join(pub, "css", "link.html"),
        ),
      refusal("css/link.html"),
    ],
  ];
  for (const [name, plant, message] of links) {
    const { pub } = upload(t, plant);
    const before = lstate(pub);
    await assert.rejects(
      writePublicSet(pub),
      (e) => e instanceof Error && e.message === message,
      name,
    );
    assert.deepEqual(lstate(pub), before, name);
    assert.deepEqual(lstate(outside), outsideBefore, name);
  }
  {
    // The upload folder itself is a link.
    const { root, pub } = upload(t);
    const link = path.join(root, "link-to-public");
    fs.symlinkSync(pub, link);
    const before = lstate(pub);
    await assert.rejects(
      writePublicSet(link),
      (e) =>
        e instanceof Error &&
        e.message ===
          "the folder of the public set is a symbolic link, which the public set does not follow",
      "the folder is a link",
    );
    assert.deepEqual(lstate(pub), before);
  }
  {
    // Into another output folder: a relative link in the source is refused before the copy (a copy would make
    // it an absolute link back into the source), the source is as it was and no output folder is made.
    const { root, pub } = upload(t, (dir) => {
      fs.renameSync(
        path.join(dir, TEXTS),
        path.join(dir, "shared/i18n/texts-real.js"),
      );
      fs.symlinkSync("texts-real.js", path.join(dir, TEXTS));
    });
    const out = path.join(root, "out");
    const before = lstate(pub);
    /** @type {string[]} */
    const lines = [];
    const code = await runBuild({
      env: {},
      migrate: () => 0,
      checkPublic: () => 0,
      publicDir: pub,
      outDir: out,
      log: (l) => lines.push(l),
    });
    assert.equal(code, 1);
    assert.deepEqual(lines, [`vercel-build: refused: ${refusal(TEXTS)}`]);
    assert.ok(!fs.existsSync(out));
    assert.deepEqual(lstate(pub), before);
    // The control without a link builds into another folder, as in place, and leaves the source as it was.
    const clean = upload(t);
    const cleanOut = path.join(clean.root, "out");
    const cleanBefore = lstate(clean.pub);
    const done = await runBuild({
      env: {},
      migrate: () => 0,
      checkPublic: () => 0,
      publicDir: clean.pub,
      outDir: cleanOut,
      log: () => {},
    });
    assert.equal(done, 0);
    assert.deepEqual(lstate(clean.pub), cleanBefore);
    const inPlace = upload(t);
    assert.equal((await build(inPlace.pub)).code, 0);
    assert.deepEqual(lstate(cleanOut), lstate(inPlace.pub));
  }
  // The well-formed real pages are not refused: the build of a clean copy passes.
  const clean = upload(t);
  const done = await writePublicSet(clean.pub);
  assert.deepEqual(done.removed, ["examples.html"]);
  assert.deepEqual(done.changed, [...CHANGED].sort());
});

test("PB-7 with the gates open the output is byte-equal to the source; one gate open leaves exactly that part", async (t) => {
  const open = upload(t);
  const done = await writePublicSet(open.pub, {
    langs: SOURCE_LANGS,
    orderTexts: true,
  });
  assert.deepEqual(done, { changed: [], removed: [] });
  assert.deepEqual(snapshot(open.pub), snapshot(PUBLIC));
  // The order gate open, kk closed: examples.html and the order regions stay, kk is cut.
  const orderOnly = upload(t);
  await writePublicSet(orderOnly.pub, {
    langs: PUBLIC_LANGS,
    orderTexts: true,
  });
  assert.ok(fs.existsSync(path.join(orderOnly.pub, "examples.html")));
  assert.ok(read(orderOnly.pub, "index.html").includes("examples.html"));
  assert.ok(!/data-lang="kk"/.test(read(orderOnly.pub, "index.html")));
  assert.deepEqual([...(await importTexts(orderOnly.pub)).LANGS], ["ru", "en"]);
  assert.ok(
    Object.keys((await importTexts(orderOnly.pub)).TEXTS).some((k) =>
      k.startsWith("order_"),
    ),
  );
  // The language gate open, the order gate closed: kk stays, the order texts and examples.html go.
  const langOnly = upload(t);
  await writePublicSet(langOnly.pub, {
    langs: SOURCE_LANGS,
    orderTexts: false,
  });
  assert.ok(!fs.existsSync(path.join(langOnly.pub, "examples.html")));
  assert.ok(/data-lang="kk"/.test(read(langOnly.pub, "index.html")));
  assert.ok(!read(langOnly.pub, "index.html").includes("examples.html"));
  assert.deepEqual(
    [...(await importTexts(langOnly.pub)).LANGS],
    ["ru", "kk", "en"],
  );
  assert.ok(
    !Object.keys((await importTexts(langOnly.pub)).TEXTS).some((k) =>
      k.startsWith("order_"),
    ),
  );
});
