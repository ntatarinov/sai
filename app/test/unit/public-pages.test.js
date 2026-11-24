import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { insideGitTree, runBuild } from "../../scripts/vercel-build.js";
import { blank } from "../fixtures/blank.js";
import { APP, tempDir } from "../fixtures/helpers.js";

// REQ-111 criterion 1 (the pages, PP-1 to PP-5 and, on the public set of the build, PP-7) and the closed list
// of the CSSOM writes of the code design 4.10 (PP-6). The reader of the pages is written here: a small tag
// reader with its own rules, so the test does not take a rule from the code it checks.

const PUBLIC = path.join(APP, "public");
const CONTENT = path.join(APP, "content");

// The exact ru values of the two places of every page (REQ-111 criterion 2; decisions/0123 О8) and the
// text of the landing's title (REQ-108 criterion 4).
const TEST_MODE =
  "Sai работает в тестовом режиме: вход по приглашению, заказы не принимаются.";
const AI_DISCLOSURE =
  "Работу в Sai выполняют ИИ-агенты (искусственный интеллект). Их ответы могут быть неточными.";
const CLOSED_TEST = "Sai — закрытое тестирование";
// The sha256 of the gate page of REQ-108, which REQ-111 leaves unchanged.
const GATE_SHA256 =
  "ac889bc15c7c6346acb45b932d021b2a70186d2fe5c286b86b7749792b1a065d";
// The twenty pages: the ten of M2.2 and the ten of M2.3 (guard row G15 of the code design M2PROJ).
const PAGES = [
  "404.html",
  "account.html",
  "admin-audit.html",
  "admin-deletions.html",
  "admin-invites.html",
  "admin-request.html",
  "admin-totp.html",
  "admin.html",
  "demo.html",
  "examples.html",
  "gate.html",
  "how.html",
  "index.html",
  "invite.html",
  "login.html",
  "project-new.html",
  "project.html",
  "projects.html",
  "reset.html",
  "setup.html",
];
// The five client pages of M2.3 load a module of js/pages, the five admin pages one of js/admin.
const CLIENT_PAGES = [
  "account.html",
  "invite.html",
  "project-new.html",
  "project.html",
  "projects.html",
];
const ADMIN_PAGES = [
  "admin-audit.html",
  "admin-deletions.html",
  "admin-invites.html",
  "admin-request.html",
  "admin.html",
];

// ---------------------------------------------------------------------------------------------------------
// The reader of a page: the tags with their attributes and the tree of the elements.

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const RAW = new Set(["script", "style", "textarea", "title"]);
const START_TAG = /<([A-Za-z][A-Za-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
const END_TAG = /<\/([A-Za-z][A-Za-z0-9-]*)\s*>/y;
const ATTRIBUTE =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " " };

/**
 * @typedef {{ name: string, attrs: Map<string, string>, children: Array<Node | string>, parent: Node | null }} Node
 */

/**
 * The elements of a page in document order and the tree of them. An attribute name is read in lower case, an
 * attribute with no value has the value "", a value may stand in double quotes, single quotes or none.
 * @param {string} html
 * @returns {{ root: Node, tags: Node[] }}
 */
function parseHtml(html) {
  /** @type {Node} */
  const root = { name: "#root", attrs: new Map(), children: [], parent: null };
  /** @type {Node[]} */
  const tags = [];
  let cur = root;
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", i)) {
      const end = html.indexOf(">", i);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    END_TAG.lastIndex = i;
    const closing = END_TAG.exec(html);
    if (closing && closing.index === i) {
      const name = closing[1].toLowerCase();
      for (let up = cur; up.parent; up = up.parent)
        if (up.name === name) {
          cur = up.parent;
          break;
        }
      i += closing[0].length;
      continue;
    }
    START_TAG.lastIndex = i;
    const open = START_TAG.exec(html);
    if (open && open.index === i) {
      /** @type {Node} */
      const el = {
        name: open[1].toLowerCase(),
        attrs: new Map(),
        children: [],
        parent: cur,
      };
      for (const a of open[2].matchAll(ATTRIBUTE))
        el.attrs.set(a[1].toLowerCase(), a[2] ?? a[3] ?? a[4] ?? "");
      cur.children.push(el);
      tags.push(el);
      i += open[0].length;
      if (VOID.has(el.name) || /\/\s*$/.test(open[2])) continue;
      if (RAW.has(el.name)) {
        const lower = html.toLowerCase();
        const end = lower.indexOf(`</${el.name}`, i);
        const stop = end < 0 ? html.length : end;
        if (stop > i) el.children.push(html.slice(i, stop));
        const close = html.indexOf(">", stop);
        i = close < 0 ? html.length : close + 1;
        continue;
      }
      cur = el;
      continue;
    }
    const next = html.indexOf("<", i + 1);
    const stop = next < 0 ? html.length : next;
    cur.children.push(html.slice(i, stop));
    i = stop;
  }
  return { root, tags };
}

/** The text of an element, character references read, white space folded to one space.
 * @param {Node | string} node */
function textOf(node) {
  const raw = (/** @type {Node | string} */ n) =>
    typeof n === "string" ? n : n.children.map(raw).join("");
  return raw(node)
    .replace(/&(#\d+|[a-z]+);/gi, (ref, name) => {
      if (name[0] === "#") return String.fromCodePoint(Number(name.slice(1)));
      return Object.hasOwn(ENTITIES, name.toLowerCase())
        ? /** @type {Record<string, string>} */ (ENTITIES)[name.toLowerCase()]
        : ref;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {{ tags: Node[] }} doc */
const idsOf = (doc) =>
  new Set(
    doc.tags.filter((e) => e.attrs.has("id")).map((e) => e.attrs.get("id")),
  );

/** Every file under `dir`, as a path with "/" separators.
 * @param {string} dir */
const filesOf = (dir) =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) =>
      path
        .relative(dir, path.join(e.parentPath, e.name))
        .split(path.sep)
        .join("/"),
    )
    .sort();

/**
 * The files of a published folder and the ids of each of its pages.
 * @param {string} dir
 */
function siteOf(dir) {
  const files = new Set(filesOf(dir));
  /** @type {Map<string, Set<string>>} */
  const ids = new Map();
  for (const f of files)
    if (f.endsWith(".html"))
      ids.set(f, idsOf(parseHtml(fs.readFileSync(path.join(dir, f), "utf8"))));
  return { files, ids };
}

// ---------------------------------------------------------------------------------------------------------
// The rules of the criterion, each a finding `<rule>: <what>`.

/**
 * Why an address is no good, or null. An address is an anchor of the same page, the icon's `data:` address, or
 * a path that starts with one "/" (never "//", "./", "../" or a scheme), read without its query and its
 * anchor, naming a file of the folder; an anchor after a path names an element of that file.
 * @param {string} value
 * @param {Set<string>} ownIds
 * @param {ReturnType<typeof siteOf>} site
 * @param {boolean} isIcon
 * @returns {string | null}
 */
function addressProblem(value, ownIds, site, isIcon) {
  if (value.startsWith("#"))
    return value.length > 1 && ownIds.has(value.slice(1))
      ? null
      : "an anchor that no element of the page has";
  if (value.startsWith("data:"))
    return isIcon ? null : "a data: address that is not the icon";
  if (!value.startsWith("/") || value.startsWith("//"))
    return "not a path that starts with one slash";
  const m = /^([^?#]*)(?:\?[^#]*)?(?:#(.*))?$/s.exec(value);
  const at = /** @type {RegExpExecArray} */ (m);
  const route = at[1];
  if (route.split("/").some((p) => p === "." || p === ".."))
    return "a path with a . or .. part";
  const file = route === "/" ? "index.html" : route.slice(1);
  if (!site.files.has(file)) return `no file ${file}`;
  const anchor = at[2];
  if (anchor !== undefined && anchor !== "") {
    const ids = site.ids.get(file);
    if (!ids) return `an anchor after a file that is no page: ${file}`;
    if (!ids.has(anchor)) return `${file} has no element #${anchor}`;
  }
  return null;
}

/**
 * The findings of one page of the criterion (PP-2, PP-3 and PP-4); `gate` leaves the head rules and the two
 * places out (gate.html is the page of REQ-108 and stays as it is).
 * @param {string} name
 * @param {string} html
 * @param {ReturnType<typeof siteOf>} site
 * @param {{ gate?: boolean, testMode?: string, disclosure?: string }} [o]
 * @returns {string[]}
 */
function pageFindings(name, html, site, o = {}) {
  const doc = parseHtml(html);
  /** @type {string[]} */
  const out = [];
  const all = (/** @type {string} */ n) => doc.tags.filter((e) => e.name === n);
  const own = idsOf(doc);
  const rels = (/** @type {Node} */ e) =>
    (e.attrs.get("rel") ?? "").toLowerCase().split(/\s+/);
  if (!o.gate) {
    if (!/^<!doctype html>/i.test(html)) out.push("doctype: not first");
    const root = all("html")[0];
    if (!root || root.attrs.get("lang") !== "ru") out.push("html lang: not ru");
    const metas = all("meta");
    if (
      !metas.some(
        (m) => (m.attrs.get("charset") ?? "").toLowerCase() === "utf-8",
      )
    )
      out.push("charset: no meta charset utf-8");
    if (!metas.some((m) => m.attrs.get("name")?.toLowerCase() === "viewport"))
      out.push("viewport: no meta viewport");
    if (
      !metas.some(
        (m) =>
          m.attrs.get("name")?.toLowerCase() === "color-scheme" &&
          m.attrs.get("content") === "light dark",
      )
    )
      out.push("color-scheme: no meta color-scheme light dark");
    if (
      !metas.some(
        (m) =>
          m.attrs.get("name")?.toLowerCase() === "robots" &&
          m.attrs.get("content") === "noindex",
      )
    )
      out.push("robots: no meta robots noindex");
    if (all("title").length !== 1)
      out.push(`title: ${all("title").length} title elements`);
    const icons = all("link").filter((l) => rels(l).includes("icon"));
    if (icons.length === 0) out.push("icon: no link rel icon");
    for (const l of icons) {
      const href = l.attrs.get("href") ?? "";
      if (addressProblem(href, own, site, true) !== null)
        out.push(`icon: ${href}`);
    }
    for (const s of all("script"))
      if (s.attrs.has("src")) {
        const src = /** @type {string} */ (s.attrs.get("src"));
        if (src.startsWith("data:") || addressProblem(src, own, site, false))
          out.push(`script src: ${src}`);
      }
    for (const l of all("link").filter((l) => rels(l).includes("stylesheet"))) {
      const href = l.attrs.get("href") ?? "";
      if (href.startsWith("data:") || addressProblem(href, own, site, false))
        out.push(`stylesheet: ${href}`);
    }
  }
  for (const e of doc.tags)
    for (const a of ["href", "src"])
      if (e.attrs.has(a)) {
        const value = /** @type {string} */ (e.attrs.get(a));
        const icon = e.name === "link" && rels(e).includes("icon");
        const problem = addressProblem(value, own, site, icon);
        if (problem !== null) out.push(`address: ${a}="${value}": ${problem}`);
      }
  if (!o.gate) {
    const text = textOf(doc.root);
    if (name === "index.html" && !text.includes(CLOSED_TEST))
      out.push("closed-test text: index.html lacks it");
    const place = (/** @type {string} */ id, /** @type {string} */ want) => {
      const e = doc.tags.find((t) => t.attrs.get("id") === id);
      if (!e)
        return `${id === "test-mode" ? "test-mode" : "ai-disclosure"} place: no #${id}`;
      return textOf(e) === want
        ? null
        : `${id === "test-mode" ? "test-mode" : "ai-disclosure"} place: #${id} does not hold its text`;
    };
    for (const f of [
      place("test-mode", o.testMode ?? TEST_MODE),
      place("ai-disclosure", o.disclosure ?? AI_DISCLOSURE),
    ])
      if (f !== null) out.push(f);
  }
  return out;
}

const realSite = () => siteOf(PUBLIC);
const readPage = (/** @type {string} */ f) =>
  fs.readFileSync(path.join(PUBLIC, f), "utf8");

/**
 * A copy of the text with `from` replaced by `to`; `from` must stand in it exactly once, so a damaged copy
 * that did not change anything fails loudly.
 * @param {string} text
 * @param {string} from
 * @param {string} to
 */
function swap(text, from, to) {
  assert.equal(text.split(from).length, 2, `one place for ${from}`);
  return text.replace(from, () => to);
}

// ---------------------------------------------------------------------------------------------------------

test("PP-1 the .html files of app/public are exactly the twenty; gate.html keeps its sha256", () => {
  assert.deepEqual(
    filesOf(PUBLIC).filter((f) => f.toLowerCase().endsWith(".html")),
    PAGES,
  );
  assert.equal(
    createHash("sha256").update(readPage("gate.html")).digest("hex"),
    GATE_SHA256,
  );
});

test("PP-2 every page but gate: doctype, html lang ru, charset, viewport, color-scheme, robots, one title, the icon, every script and style sheet a file of app/public", () => {
  const site = realSite();
  for (const f of PAGES.filter((p) => p !== "gate.html")) {
    const html = readPage(f);
    const head = pageFindings(f, html, site).filter((x) =>
      /^(doctype|html lang|charset|viewport|color-scheme|robots|title|icon|script src|stylesheet):/.test(
        x,
      ),
    );
    assert.deepEqual(head, [], f);
    // Every page loads the two style sheets and exactly one page module, and the scripts are module files.
    const doc = parseHtml(html);
    assert.deepEqual(
      doc.tags
        .filter((e) => e.name === "link" && e.attrs.get("rel") === "stylesheet")
        .map((e) => e.attrs.get("href"))
        .filter((h) => h !== "/css/noscript.css"),
      ["/css/tokens.css", "/css/site.css"],
      f,
    );
    const scripts = doc.tags.filter((e) => e.name === "script");
    assert.equal(scripts.length, 1, f);
    assert.equal(scripts[0].attrs.get("type"), "module", f);
    // The demo page and each account page load their own page module (the code design M2AUTH, 5.1), the five
    // client pages of M2.3 one of js/pages and its five admin pages one of js/admin (M2PROJ, 4.9); the others
    // the landing module.
    const own = f.replace(/\.html$/, "");
    assert.equal(
      scripts[0].attrs.get("src"),
      ADMIN_PAGES.includes(f)
        ? `/js/admin/${own}.js`
        : f === "demo.html" ||
            CLIENT_PAGES.includes(f) ||
            [
              "admin-totp.html",
              "login.html",
              "reset.html",
              "setup.html",
            ].includes(f)
          ? `/js/pages/${own}.js`
          : "/js/pages/landing.js",
      f,
    );
  }
  const gate = pageFindings("gate.html", readPage("gate.html"), site, {
    gate: true,
  });
  assert.deepEqual(gate, []);
});

test("PP-3 every href and src is an anchor of the page, the icon's data: address, or a path with one slash first that names a file; an anchor after a path names an element of that file", () => {
  const site = realSite();
  let seen = 0;
  for (const f of PAGES) {
    const html = readPage(f);
    const found = pageFindings(f, html, site, { gate: f === "gate.html" });
    assert.deepEqual(
      found.filter((x) => x.startsWith("address:")),
      [],
      f,
    );
    seen += parseHtml(html).tags.filter(
      (e) => e.attrs.has("href") || e.attrs.has("src"),
    ).length;
  }
  // The pages do carry addresses (a reader that found none would prove nothing), among them the demo page
  // that every page links and an anchor after a path.
  assert.ok(seen > 40, `${seen} addresses read`);
  const all = PAGES.map(readPage).join("\n");
  assert.match(all, /href="\/demo\.html"/);
  assert.match(all, /href="\/how\.html#stage-1"/);
  assert.ok(site.ids.get("how.html")?.has("stage-1"));
  assert.ok(site.ids.get("how.html")?.has("describe-idea"));
});

test("PP-4 index.html holds «Sai — закрытое тестирование»; every page but gate has #test-mode and #ai-disclosure with their ru values", () => {
  const site = realSite();
  for (const f of PAGES.filter((p) => p !== "gate.html")) {
    const found = pageFindings(f, readPage(f), site).filter((x) =>
      /^(closed-test text|test-mode place|ai-disclosure place):/.test(x),
    );
    assert.deepEqual(found, [], f);
    const doc = parseHtml(readPage(f));
    const byId = (/** @type {string} */ id) =>
      doc.tags.filter((e) => e.attrs.get("id") === id);
    assert.equal(byId("test-mode").length, 1, f);
    assert.equal(byId("ai-disclosure").length, 1, f);
    assert.equal(textOf(byId("test-mode")[0]), TEST_MODE, f);
    assert.equal(textOf(byId("ai-disclosure")[0]), AI_DISCLOSURE, f);
    // The text of each place is the one its `data-t` key names (the span inside #test-mode, #ai-disclosure
    // itself), so the page script fills it in the language of the visitor and not with another text.
    const keysIn = (/** @type {Node} */ place) =>
      doc.tags
        .filter((e) => {
          for (let up = /** @type {Node | null} */ (e); up; up = up.parent)
            if (up === place) return true;
          return false;
        })
        .map((e) => e.attrs.get("data-t"))
        .filter((k) => k !== undefined);
    assert.deepEqual(keysIn(byId("test-mode")[0]), ["test_mode"], f);
    assert.deepEqual(keysIn(byId("ai-disclosure")[0]), ["ai_disclosure"], f);
  }
  assert.ok(
    textOf(parseHtml(readPage("index.html")).root).includes(CLOSED_TEST),
  );
});

test("PP-5 the nine damaged copies of the criterion are red, each by its rule; the forms of the built pages are green", () => {
  const site = realSite();
  const index = readPage("index.html");
  const how = readPage("how.html");
  const before = index.split("</main>");
  assert.equal(before.length, 2);
  const withLink = (/** @type {string} */ href) =>
    index.replace("</main>", () => `<a href="${href}">x</a></main>`);
  /** @type {Array<[string, string, string, string]>} the name, the page, the page's text, the rule that must be found */
  const damaged = [
    [
      "no robots meta",
      "index.html",
      swap(index, '<meta name="robots" content="noindex" />\n', ""),
      "robots:",
    ],
    [
      "a script whose src names a missing file",
      "index.html",
      swap(index, 'src="/js/pages/landing.js"', 'src="/js/pages/gone.js"'),
      "script src:",
    ],
    [
      "a link to a missing file",
      "index.html",
      withLink("/missing.html"),
      "address:",
    ],
    [
      "an anchor that does not exist",
      "index.html",
      withLink("#nowhere"),
      "address:",
    ],
    [
      "an anchor after a path that the named file lacks",
      "index.html",
      withLink("/how.html#nowhere"),
      "address:",
    ],
    [
      "the relative address css/site.css",
      "index.html",
      swap(index, 'href="/css/site.css"', 'href="css/site.css"'),
      "stylesheet:",
    ],
    [
      "an address that starts with //",
      "index.html",
      withLink("//css/site.css"),
      "address:",
    ],
    [
      "index.html without the closed-test text",
      "index.html",
      index.split(CLOSED_TEST).join("Sai"),
      "closed-test text:",
    ],
    [
      "a page without the place of the test-mode line",
      "how.html",
      swap(how, 'id="test-mode"', 'id="mode"'),
      "test-mode place:",
    ],
    // More damaged copies of the same rules, each by its rule.
    [
      "a second title",
      "how.html",
      swap(how, "<body", "<title>x</title><body"),
      "title:",
    ],
    [
      "html lang en",
      "how.html",
      swap(how, '<html lang="ru">', '<html lang="en">'),
      "html lang:",
    ],
    [
      "color-scheme light only",
      "how.html",
      swap(how, 'content="light dark"', 'content="light"'),
      "color-scheme:",
    ],
    [
      "a style sheet that is missing",
      "how.html",
      swap(how, 'href="/css/tokens.css"', 'href="/css/gone.css"'),
      "stylesheet:",
    ],
    [
      "no icon link",
      "how.html",
      swap(how, '<link rel="icon" href="data:," />\n', ""),
      "icon:",
    ],
    [
      "a ./ address",
      "how.html",
      how.replace("</main>", () => '<a href="./demo.html">x</a></main>'),
      "address:",
    ],
    [
      "a ../ address",
      "how.html",
      how.replace("</main>", () => '<a href="../demo.html">x</a></main>'),
      "address:",
    ],
    [
      "a scheme address",
      "how.html",
      how.replace("</main>", () => '<a href="https://x.example/">x</a></main>'),
      "address:",
    ],
    [
      "a data: address that is not the icon",
      "how.html",
      how.replace("</main>", () => '<a href="data:,x">x</a></main>'),
      "address:",
    ],
    [
      "a folder, not a file",
      "how.html",
      how.replace("</main>", () => '<a href="/css/">x</a></main>'),
      "address:",
    ],
    [
      "an empty anchor",
      "how.html",
      how.replace("</main>", () => '<a href="#">x</a></main>'),
      "address:",
    ],
    [
      "an anchor after a file that is no page",
      "how.html",
      how.replace("</main>", () => '<a href="/css/site.css#a">x</a></main>'),
      "address:",
    ],
    [
      "the AI disclosure with other words",
      "how.html",
      swap(
        how.replace(/\s+/g, " "),
        "Их ответы могут быть неточными.",
        "Их ответы точные.",
      ),
      "ai-disclosure place:",
    ],
  ];
  for (const [name, page, text, rule] of damaged) {
    const found = pageFindings(page, text, site);
    assert.ok(
      found.some((x) => x.startsWith(rule)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
  // The undamaged pages are clean, so each finding above comes from its own change.
  assert.deepEqual(pageFindings("index.html", index, site), []);
  assert.deepEqual(pageFindings("how.html", how, site), []);
  // The forms of the built pages and their near forms are green.
  /** @type {Array<[string, string]>} */
  const green = [
    ["meta charset with the slash", index],
    ["upper-case doctype", swap(index, "<!doctype html>", "<!DOCTYPE HTML>")],
    [
      "charset UTF-8 in single quotes, no slash",
      swap(index, '<meta charset="utf-8" />', "<meta charset='UTF-8'>"),
    ],
    ["href=/", withLink("/")],
    ["a link /how.html?lang=en", withLink("/how.html?lang=en")],
    ["a link /how.html?lang=en#stage-2", withLink("/how.html?lang=en#stage-2")],
    ["a link /?lang=en#main", withLink("/?lang=en#main")],
    [
      "a link in single quotes",
      index.replace("</main>", () => "<a href='/how.html'>x</a></main>"),
    ],
  ];
  for (const [name, text] of green)
    assert.deepEqual(pageFindings("index.html", text, site), [], name);
});

// ---------------------------------------------------------------------------------------------------------
// PP-6 the closed list of the CSSOM writes (the code design 4.10).

/** The names that a file of app/public may write with `<x>.style.setProperty`, by its path. */
const WRITES = new Map([
  [
    "office/view.js",
    [
      "--H",
      "--rw",
      "--dt",
      "--wh",
      "--cx1",
      "--cx2",
      "--cx3",
      "--cx4",
      "--you",
    ],
  ],
  ["js/pages/demo.js", ["--tx"]],
]);

/**
 * The findings of the closed list in one served .js file: every use of `style` in the code (comments,
 * strings and templates blanked) must be `<x>.style.setProperty("<name>", …)` with a name that the file may
 * write; the computed form `["style"]` is refused too.
 * @param {string} rel
 * @param {string} src
 * @returns {string[]}
 */
function cssomFindings(rel, src) {
  const code = blank(src);
  const kept = blank(src, true);
  const allowed = WRITES.get(rel) ?? [];
  /** @type {string[]} */
  const out = [];
  for (const m of code.matchAll(/\bstyle\b/g)) {
    const at = m.index;
    const before = code.slice(0, at);
    const after = kept.slice(at + 5);
    const call =
      /^\s*\.\s*setProperty\s*\(\s*(["'`])(--[A-Za-z0-9-]+)\1\s*,/.exec(after);
    if (!/[\w$\])]\s*\.\s*$/.test(before))
      out.push(`style not read as a member: ${at}`);
    else if (call === null)
      out.push(`a use of .style that is no setProperty: ${at}`);
    else if (!allowed.includes(call[2]))
      out.push(`${call[2]} is not on the list of ${rel}`);
  }
  if (/\[\s*(["'`])style\1\s*\]/.test(kept)) out.push('the computed ["style"]');
  return out;
}

test("PP-6 the CSSOM closed list: every .style use of a served .js file is setProperty of a listed name; planted writes are red, the allowed ones green", () => {
  const served = filesOf(PUBLIC).filter((f) => f.endsWith(".js"));
  assert.ok(served.length >= 10, served.join());
  /** @type {Map<string, string[]>} */
  const writes = new Map();
  for (const f of served) {
    const src = fs.readFileSync(path.join(PUBLIC, f), "utf8");
    assert.deepEqual(cssomFindings(f, src), [], f);
    const names = [
      ...blank(src, true).matchAll(
        /\.style\s*\.\s*setProperty\s*\(\s*["'`](--[A-Za-z0-9-]+)["'`]/g,
      ),
    ].map((m) => m[1]);
    if (names.length > 0) writes.set(f, names);
  }
  // The pages do write them: nine names in the stage view and one in the demo, no other file writes one.
  assert.deepEqual([...writes.keys()].sort(), [
    "js/pages/demo.js",
    "office/view.js",
  ]);
  assert.deepEqual(
    writes.get("office/view.js")?.sort(),
    [...(WRITES.get("office/view.js") ?? [])].sort(),
  );
  assert.deepEqual(writes.get("js/pages/demo.js"), ["--tx"]);
  // The planted writes, built from parts so no search of the repository meets them (AP-093).
  const s = "sty" + "le";
  /** @type {Array<[string, string, string]>} the path, the code, the finding's start */
  const red = [
    ["js/a.js", `el.${s}.color = 1;`, "a use of .style"],
    ["js/a.js", `el.${s}["height"] = 1;`, "a use of .style"],
    ["js/a.js", `el["${s}"] = 1;`, "the computed"],
    ["js/a.js", `el.${s}.cssText = "a";`, "a use of .style"],
    ["js/a.js", `Object.assign(el.${s}, { a: 1 });`, "a use of .style"],
    ["js/a.js", `const { ${s} } = el;`, "style not read as a member"],
    ["js/a.js", `el.${s}.setProperty(name, 1);`, "a use of .style"],
    // A use inside the code of a template's ${…}, and after a division (no regular expression there).
    ["js/a.js", "const t = `x ${el." + s + ".color}`;", "a use of .style"],
    [
      "js/a.js",
      `const q = a / b; el.${s}.left = 1; const w = c / d;`,
      "a use of .style",
    ],
    ["js/a.js", `stage.${s}.setProperty("--x", 1);`, "--x is not on the list"],
    ["js/a.js", `stage.${s}.setProperty("--H", 1);`, "--H is not on the list"],
    [
      "office/view.js",
      `a.${s}.setProperty("--tx", 1);`,
      "--tx is not on the list",
    ],
    [
      "js/pages/demo.js",
      `a.${s}.setProperty("--you", 1);`,
      "--you is not on the list",
    ],
    ["office/view.js", `a.${s}.removeProperty("--H");`, "a use of .style"],
    ["office/view.js", `look.${s} = 3;`, "a use of .style"],
  ];
  for (const [rel, code, start] of red) {
    const found = cssomFindings(rel, code);
    assert.ok(
      found.length > 0 && found.some((x) => x.startsWith(start)),
      `${code}: ${JSON.stringify(found)}`,
    );
  }
  // The allowed writes: each name in its file, with the spaces and line breaks of prettier.
  /** @type {Array<[string, string]>} */
  const green = [];
  for (const n of WRITES.get("office/view.js") ?? [])
    green.push([
      "office/view.js",
      `stage.${s}.setProperty("${n}", String(g));`,
    ]);
  green.push([
    "js/pages/demo.js",
    `ask.${s}.setProperty("--tx", \`\${at}px\`);`,
  ]);
  green.push([
    "office/view.js",
    `stage\n  .${s}\n  .setProperty("--you", String(x));`,
  ]);
  // A word in a block comment (its text holds a slash), a regular expression, a string with an escaped quote
  // and a template is no use.
  green.push(["js/a.js", `/* a/b ${s} of it */ const k = 1;`]);
  green.push(["js/a.js", `const re = /${s}/; const r2 = /["']${s}/g;`]);
  green.push(["js/a.js", `const x = "a \\" ${s}"; const y = 'it\\'s ${s}';`]);
  green.push(["js/a.js", "const z = `a ${1 + 1} ${s} b`;"]);
  // A word in a comment, a string or a template is no use.
  green.push([
    "js/a.js",
    `// the ${s} of the page\nconst a = "${s}"; const b = \`${s}\`;`,
  ]);
  assert.ok(green.length >= 11);
  for (const [rel, code] of green)
    assert.deepEqual(cssomFindings(rel, code), [], code);
});

// ---------------------------------------------------------------------------------------------------------
// PP-7 the same rules on the public set of the open build.

/**
 * The open build run in place on a copy of app/public and app/content outside any git tree, its steps
 * injected, awaited.
 * @param {import("node:test").TestContext} t
 * @param {(publicDir: string) => void} [plant] edits the copy before the build
 */
async function publicSet(t, plant) {
  const root = tempDir(t);
  const out = path.join(root, "public");
  fs.cpSync(PUBLIC, out, { recursive: true });
  fs.cpSync(CONTENT, path.join(root, "content"), { recursive: true });
  assert.ok(!insideGitTree(out), "the copy is inside a git working tree");
  if (plant) plant(out);
  /** @type {string[]} */
  const lines = [];
  const code = await runBuild({
    env: {},
    migrate: () => 0,
    checkPublic: () => 0,
    publicDir: out,
    outDir: out,
    log: (l) => lines.push(l),
  });
  return { out, code, lines };
}

/**
 * The rules of PP-1 to PP-4 on a built folder: the pages, the head, the addresses, the two places with the ru
 * values of the folder's own texts module.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function builtFindings(dir) {
  const bytes = fs.readFileSync(path.join(dir, "shared/i18n/texts.js"));
  const mod = await import(
    `${pathToFileURL(path.join(dir, "shared/i18n/texts.js")).href}?sha256=${createHash("sha256").update(bytes).digest("hex")}`
  );
  const site = siteOf(dir);
  /** @type {string[]} */
  const out = [];
  const pages = [...site.files].filter((f) => f.endsWith(".html")).sort();
  const want = PAGES.filter((p) => p !== "examples.html");
  if (JSON.stringify(pages) !== JSON.stringify(want))
    out.push(`pages: ${pages.join(", ")}`);
  for (const f of pages)
    for (const x of pageFindings(
      f,
      fs.readFileSync(path.join(dir, f), "utf8"),
      site,
      {
        gate: f === "gate.html",
        testMode: mod.TEXTS.test_mode.ru,
        disclosure: mod.TEXTS.ai_disclosure.ru,
      },
    ))
      out.push(`${f}: ${x}`);
  return out;
}

test("PP-7 the rules of PP-1 to PP-4 hold on the public set of the open build; a left link or anchor, the greedy cut and a region opened before #ai-disclosure are red", async (t) => {
  const built = await publicSet(t);
  assert.equal(built.code, 0, built.lines.join("\n"));
  assert.deepEqual(await builtFindings(built.out), []);
  // The ru values that the places hold on production are the values of the records.
  const mod = await import(
    `${pathToFileURL(path.join(built.out, "shared/i18n/texts.js")).href}?built`
  );
  assert.equal(mod.TEXTS.test_mode.ru, TEST_MODE);
  assert.equal(mod.TEXTS.ai_disclosure.ru, AI_DISCLOSURE);
  assert.equal(
    createHash("sha256")
      .update(fs.readFileSync(path.join(built.out, "gate.html")))
      .digest("hex"),
    GATE_SHA256,
  );
  // A left link to /examples.html and a link to an anchor that the cut took are red on the built pages.
  const site = siteOf(built.out);
  const idx = fs.readFileSync(path.join(built.out, "index.html"), "utf8");
  const link = (/** @type {string} */ href) =>
    idx.replace("</main>", () => `<a href="${href}">x</a></main>`);
  for (const href of [
    "/examples.html",
    "/how.html#order-gone",
    "/examples.html#a",
  ])
    assert.ok(
      pageFindings("index.html", link(href), site).some((x) =>
        x.startsWith("address:"),
      ),
      href,
    );
  assert.ok(site.ids.get("how.html")?.has("describe-idea"));
  assert.deepEqual(pageFindings("index.html", idx, site), []);
  // A source whose footer opens an order region before #ai-disclosure builds, and its output lacks the place.
  const planted = await publicSet(t, (dir) => {
    const f = path.join(dir, "index.html");
    let text = fs.readFileSync(f, "utf8");
    text = swap(
      text,
      '<p class="disclosure">',
      '<!-- sai:order -->\n<p class="disclosure">',
    );
    text = swap(text, "      <nav>", "<!-- /sai:order -->\n      <nav>");
    fs.writeFileSync(f, text);
  });
  assert.equal(planted.code, 0, planted.lines.join("\n"));
  const found = await builtFindings(planted.out);
  assert.ok(
    found.some((x) => x.startsWith("index.html: ai-disclosure place:")),
    JSON.stringify(found),
  );
  // Pages that the build left whole keep their places: only index.html is damaged.
  assert.deepEqual(
    found.filter((x) => !x.startsWith("index.html:")),
    [],
  );
});
