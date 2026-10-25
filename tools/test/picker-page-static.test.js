// QS-1 ... QS-12: the files of the page of the picker site read as text (design REQ-057,
// 17.3): the list of files, the markup, the words that must not stand in the code, the
// single door to the network and to the storage, the imports, the style sheet with its
// colors, contrasts and sizes, the module of the texts and the settings of the linter.
// What the layout looks like in a browser is checked by the acceptance run (design 18);
// here are the facts that a text can hold.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TOOLS } from "./picker-helpers.js";
import { INDEX_HTML, documentFromFile } from "./picker-page-dom.js";
import { PUBLIC } from "./picker-page-helpers.js";

const FILES = [
  "app.js",
  "dom.js",
  "flow.js",
  "index.html",
  "main.js",
  "net.js",
  "page.css",
  "result.js",
  "rules.js",
  "say.js",
  "screens.js",
  "store.js",
  "texts.js",
];
const read = (name) => fs.readFileSync(path.join(PUBLIC, name), "utf8");
const JS = FILES.filter((f) => f.endsWith(".js"));

// The words are put together where the test file would hold them itself.
const GONE_FILE = ["stub", ".js"].join("");
const GONE_KEY = ["page", "stub", "notice"].join("_");

// The code of a script without its comments (strings stay as they are).
function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .split("\n")
    .map((line) => line.replace(/(^|\s)\/\/.*$/u, "$1"))
    .join("\n");
}

// ---------------------------------------------------------------------- QS-1

test("QS-1: the files of public/ are exactly the 13 of the design - no folder, no old placeholder file, the names fit the pattern of the server and the extensions are .js, .css and .html", () => {
  const entries = fs.readdirSync(PUBLIC, { withFileTypes: true });
  assert.deepEqual(entries.map((e) => e.name).sort(), [...FILES].sort());
  for (const entry of entries) {
    assert.equal(entry.isFile(), true, entry.name);
    assert.match(entry.name, /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u);
    assert.ok(
      [".js", ".css", ".html"].includes(path.extname(entry.name)),
      entry.name,
    );
  }
  assert.equal(fs.existsSync(path.join(PUBLIC, GONE_FILE)), false);
  assert.equal(FILES.length, 13);
});

// ---------------------------------------------------------------------- QS-2

test("QS-2: index.html - one main#app, the live region with its three marks, one module script main.js, one style sheet page.css, no noscript, no icon, no inline script, no inline style, no handler attribute, nothing outside /assets/", () => {
  const doc = documentFromFile(INDEX_HTML);
  const html = doc.html;
  const text = read("index.html");
  assert.equal(html.all("main").length, 1);
  assert.equal(html.find("main").id, "app");
  assert.equal(html.find("main").children.length, 0);
  const live = doc.byId("live");
  assert.equal(live.tag, "div");
  assert.equal(live.attr("role"), "status");
  assert.equal(live.attr("aria-live"), "polite");
  assert.equal(live.attr("aria-atomic"), "true");
  assert.equal(live.has("hidden"), false);
  assert.equal(live.has("style"), false);
  const scripts = html.all("script");
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].attr("type"), "module");
  assert.equal(scripts[0].attr("src"), "/assets/main.js");
  assert.equal(scripts[0].text, "");
  const links = html.all("link");
  assert.equal(links.length, 1);
  assert.equal(links[0].attr("rel"), "stylesheet");
  assert.equal(links[0].attr("href"), "/assets/page.css");
  assert.equal(html.all("noscript").length, 0);
  assert.equal(html.all("style").length, 0);
  assert.doesNotMatch(text, /rel\s*=\s*["'][^"']*icon/iu);
  assert.doesNotMatch(text, /stub/iu);
  for (const el of html.all("*")) {
    assert.equal(el.has("style"), false, el.tag);
    for (const name of el.attrs.keys())
      assert.doesNotMatch(name, /^on/iu, `${el.tag} ${name}`);
    for (const name of ["src", "href"])
      if (el.has(name))
        assert.ok(el.attr(name).startsWith("/assets/"), `${el.tag} ${name}`);
  }
  assert.equal(html.attr("lang"), "ru");
  const viewport = html.all("meta").find((m) => m.attr("name") === "viewport");
  assert.equal(viewport.attr("content"), "width=device-width, initial-scale=1");
  assert.doesNotMatch(viewport.attr("content"), /user-scalable|maximum-scale/u);
  assert.equal(html.all("body > *").length, 3);
});

// ---------------------------------------------------------------------- QS-3

test("QS-3: the words that must not stand in the scripts of the page (comments count) - windows that block, markup built from text, the console, timers, the language header of the browser, other ways to the network, eval, a listing of the storage, an assignment to style other than the width of the fill", () => {
  const words = [
    "alert(",
    "confirm(",
    "prompt(",
    "showModal",
    "beforeunload",
    "dialog",
    "innerHTML",
    "insertAdjacentHTML",
    "outerHTML",
    "document.write",
    "console.",
    "setTimeout",
    "setInterval",
    "requestAnimationFrame",
    "matchMedia",
    "XMLHttpRequest",
    "eval(",
    "new Function",
    "import(",
    "localStorage.clear",
    ".key(",
    "sessionStorage",
    "indexedDB",
    "document.cookie",
    "postMessage",
    "window.open",
    "location.reload",
    "location.assign",
    "location.replace",
    "pushState",
    "history.go",
    "history.back",
    "navigator.",
  ];
  for (const name of JS) {
    const text = read(name);
    for (const word of words)
      assert.equal(text.includes(word), false, `${name}: ${word}`);
    assert.doesNotMatch(text, /Accept-Language/iu, name);
    assert.doesNotMatch(text, /setAttribute\(\s*["']style["']/u, name);
    const styles = [...codeOnly(text).matchAll(/\.style\b(?!\.width\b)/gu)];
    assert.equal(styles.length, 0, `${name}: style other than style.width`);
  }
  // the only assignment to style.width is in screens.js
  const writers = JS.filter((n) =>
    /\.style\.width\s*=(?!=)/u.test(codeOnly(read(n))),
  );
  assert.deepEqual(writers, ["screens.js"]);
  // the check bites
  assert.ok("window.alert(1)".includes("alert("));
  assert.match("el.style.color = x", /\.style\b(?!\.width\b)/u);
});

// ---------------------------------------------------------------------- QS-4

test("QS-4: one fetch( on the whole page - in net.js, inside the function request(path, init); the options of the call hold no mode, no referrer policy, no credentials; the address constants are relative", () => {
  const holders = JS.filter((n) => read(n).includes("fetch("));
  assert.deepEqual(holders, ["net.js"]);
  const net = read("net.js");
  assert.equal(net.split("fetch(").length - 1, 1);
  const start = net.indexOf("async function request(path, init) {");
  assert.ok(start !== -1);
  const end = net.indexOf("\n}\n", start);
  const at = net.indexOf("fetch(");
  assert.ok(at > start && at < end);
  const body = net.slice(start, end);
  for (const key of [
    "mode",
    "referrerPolicy",
    "credentials",
    "redirect",
    "cache",
    "keepalive",
    "referrer",
    "integrity",
  ])
    assert.doesNotMatch(body, new RegExp(`\\b${key}\\s*:`, "u"), key);
  assert.match(body, /signal:\s*AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/u);
  const constants = [
    ...net.matchAll(/const\s+(API_[A-Z_]+)\s*=\s*"([^"]*)"/gu),
  ];
  assert.deepEqual(constants.map((m) => m[1]).sort(), [
    "API_QUESTIONNAIRE",
    "API_RESULT",
  ]);
  for (const [, name, value] of constants) {
    assert.doesNotMatch(value, /^[a-z][a-z0-9+.-]*:/iu, name);
    assert.equal(value.startsWith("/"), false, name);
    assert.match(value, /^api\/[a-z]+$/u, name);
  }
  assert.match(net, /const REQUEST_TIMEOUT_MS = 20000;/u);
  assert.doesNotMatch(net, /https?:/u);
});

// ---------------------------------------------------------------------- QS-5

test("QS-5: each door has one file - localStorage only in store.js; fetch( and AbortSignal only in net.js; history and scrollTo only in app.js; the document only in the files that build or drive it", () => {
  const where = (re) => JS.filter((n) => re.test(codeOnly(read(n)))).sort();
  assert.deepEqual(where(/\blocalStorage\b/u), ["store.js"]);
  assert.deepEqual(where(/\bfetch\(/u), ["net.js"]);
  assert.deepEqual(where(/\bAbortSignal\b/u), ["net.js"]);
  assert.deepEqual(where(/\bhistory\./u), ["app.js"]);
  assert.deepEqual(where(/\bscrollTo\b/u), ["app.js"]);
  assert.deepEqual(where(/\blocation\b/u), ["app.js"]);
  // the pure files do not touch the document
  for (const name of [
    "rules.js",
    "flow.js",
    "say.js",
    "store.js",
    "net.js",
    "texts.js",
  ])
    assert.doesNotMatch(codeOnly(read(name)), /\bdocument\b/u, name);
  assert.deepEqual(where(/\bdocument\b/u), ["app.js", "dom.js"]);
});

// ---------------------------------------------------------------------- QS-6

test("QS-6: no number of a requirement, no 'handoff', no 'ORCH' (capitals) and no 'decisions' in the comments and the code of public/", () => {
  for (const name of FILES) {
    const text = read(name);
    assert.doesNotMatch(text, /REQ-\d/u, name);
    assert.doesNotMatch(text, /handoff/iu, name);
    assert.doesNotMatch(text, /ORCH/u, name);
    assert.doesNotMatch(text, /decisions/iu, name);
  }
});

// ---------------------------------------------------------------------- QS-7

const GRAPH = {
  "app.js": [
    "flow.js",
    "net.js",
    "result.js",
    "say.js",
    "screens.js",
    "store.js",
    "texts.js",
  ],
  "dom.js": [],
  "flow.js": ["rules.js"],
  "main.js": ["app.js"],
  "net.js": [],
  "result.js": ["dom.js"],
  "rules.js": [],
  "say.js": ["texts.js"],
  "screens.js": ["dom.js", "say.js", "texts.js"],
  "store.js": [],
  "texts.js": [],
};

test("QS-7: the imports - only './name.js' of a file that is there, no node: module, no '../', no cycle; rules.js, store.js, net.js and dom.js import nothing; the graph is that of the design", () => {
  const graph = {};
  for (const name of JS) {
    const imports = [
      ...read(name).matchAll(
        /^\s*import\b[^;]*?from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gmu,
      ),
    ].map((m) => m[1] ?? m[2]);
    for (const spec of imports) {
      assert.match(spec, /^\.\/[a-z]+\.js$/u, `${name}: ${spec}`);
      assert.ok(
        FILES.includes(spec.slice(2)),
        `${name}: ${spec} is not a file`,
      );
      assert.doesNotMatch(spec, /node:|\.\.\//u);
    }
    graph[name] = imports.map((s) => s.slice(2)).sort();
  }
  for (const name of ["rules.js", "store.js", "net.js", "dom.js"])
    assert.deepEqual(graph[name], [], name);
  assert.deepEqual(graph, GRAPH);
  // no cycle
  const state = new Map();
  const visit = (name) => {
    assert.notEqual(state.get(name), "open", `cycle at ${name}`);
    if (state.get(name) === "done") return;
    state.set(name, "open");
    for (const next of graph[name]) visit(next);
    state.set(name, "done");
  };
  for (const name of JS) visit(name);
  // nothing runs when a module is loaded but main.js
  assert.match(
    codeOnly(read("main.js")).trim(),
    /^import \{ start \} from "\.\/app\.js";\s*start\(\);$/u,
  );
  for (const name of JS.filter((n) => n !== "main.js"))
    assert.doesNotMatch(
      codeOnly(read(name)),
      /^start\(\)|^[a-z]\w*\(.*\);$/mu,
      name,
    );
});

// ---------------------------------------------------------------------- QS-8

// The rules of a style sheet: [{ media, selector, decls: [[property, value]] }].
function parseCss(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  const rules = [];
  const walk = (chunk, media) => {
    let i = 0;
    while (i < chunk.length) {
      const open = chunk.indexOf("{", i);
      if (open === -1) break;
      const prelude = chunk.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < chunk.length && depth > 0) {
        if (chunk[j] === "{") depth += 1;
        else if (chunk[j] === "}") depth -= 1;
        j += 1;
      }
      const inner = chunk.slice(open + 1, j - 1);
      if (prelude.startsWith("@media")) walk(inner, prelude.slice(6).trim());
      else if (prelude.startsWith("@"))
        rules.push({ media, selector: prelude, decls: [], at: true });
      else {
        const decls = inner
          .split(";")
          .map((d) => d.trim())
          .filter((d) => d !== "")
          .map((d) => {
            const colon = d.indexOf(":");
            return [d.slice(0, colon).trim(), d.slice(colon + 1).trim()];
          });
        rules.push({ media, selector: prelude.replace(/\s+/gu, " "), decls });
      }
      i = j;
    }
  };
  walk(text, null);
  return rules;
}

const LIGHT = {
  "--page": "#f3f5f9",
  "--surface": "#ffffff",
  "--surface-2": "#eef2f8",
  "--text": "#172033",
  "--muted": "#4b5568",
  "--line": "#cfd6e2",
  "--control": "#5f6b7e",
  "--accent": "#1d4ed8",
  "--accent-hover": "#1a44bf",
  "--on-accent": "#ffffff",
  "--accent-soft": "#e6edff",
  "--accent-ink": "#1d4ed8",
  "--focus": "#1d4ed8",
  "--error": "#b3261e",
  "--error-bg": "#fdecea",
  "--notice-bg": "#fff6dc",
  "--notice-border": "#8a5b00",
  "--track": "#d3dae6",
};
const DARK = {
  "--page": "#0f1520",
  "--surface": "#161f2e",
  "--surface-2": "#1c2738",
  "--text": "#e8eef7",
  "--muted": "#a7b4c8",
  "--line": "#2c3a52",
  "--control": "#8393ab",
  "--accent": "#6cb0ff",
  "--accent-hover": "#8fc2ff",
  "--on-accent": "#07101c",
  "--accent-soft": "#1e3556",
  "--accent-ink": "#8cc4ff",
  "--focus": "#8cc4ff",
  "--error": "#ff9a8f",
  "--error-bg": "#3a1c1c",
  "--notice-bg": "#3a2f12",
  "--notice-border": "#e0b64a",
  "--track": "#2c3a52",
};
// [foreground, background, light, dark, minimum] - design 8.2
const PAIRS = [
  ["--text", "--surface", 16.27, 14.18, 4.5],
  ["--text", "--page", 14.9, 15.68, 4.5],
  ["--text", "--surface-2", 14.48, 12.89, 4.5],
  ["--text", "--accent-soft", 13.88, 10.6, 4.5],
  ["--text", "--notice-bg", 15.08, 11.29, 4.5],
  ["--muted", "--surface", 7.5, 7.88, 4.5],
  ["--muted", "--surface-2", 6.68, 7.16, 4.5],
  ["--muted", "--accent-soft", 6.4, 5.89, 4.5],
  ["--on-accent", "--accent", 6.7, 8.45, 4.5],
  ["--on-accent", "--accent-hover", 8.01, 10.3, 4.5],
  ["--accent-ink", "--surface", 6.7, 9.02, 4.5],
  ["--accent-ink", "--accent-soft", 5.72, 6.74, 4.5],
  ["--accent-ink", "--error-bg", 5.86, 8.41, 4.5],
  ["--error", "--error-bg", 5.72, 7.54, 4.5],
  ["--error", "--surface", 6.54, 8.09, 4.5],
  ["--control", "--surface", 5.4, 5.3, 3],
  ["--control", "--accent-soft", 4.61, 3.96, 3],
  ["--control", "--error-bg", 4.72, 4.94, 3],
  ["--accent", "--surface", 6.7, 7.32, 3],
  ["--accent", "--track", 4.77, 5.07, 3],
  ["--focus", "--surface", 6.7, 9.02, 3],
  ["--focus", "--page", 6.14, 9.97, 3],
  ["--focus", "--accent-soft", 5.72, 6.74, 3],
  ["--notice-border", "--notice-bg", 5.44, 6.87, 3],
];

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("QS-8: page.css - the tokens of the light and the dark theme are those of the design, the contrast of every pair is computed by the WCAG formula and equals the table (text 4.5, not text 3), no color outside the tokens, none of the forbidden properties, no text under 1rem, the ring of the focus, the sizes of the controls", () => {
  const rules = parseCss(read("page.css"));
  const tokens = (media) => {
    const found = rules.filter(
      (r) => r.selector === ":root" && r.media === media,
    );
    assert.equal(found.length, 1, `${media}`);
    return Object.fromEntries(
      found[0].decls.filter(([p]) => p.startsWith("--")),
    );
  };
  assert.deepEqual(tokens(null), LIGHT);
  assert.deepEqual(tokens("(prefers-color-scheme: dark)"), DARK);
  const root = rules.find((r) => r.selector === ":root" && r.media === null);
  assert.deepEqual(
    root.decls.find(([p]) => p === "color-scheme"),
    ["color-scheme", "light dark"],
  );
  // the contrasts by the formula
  for (const [fg, bg, light, dark, minimum] of PAIRS) {
    for (const [theme, set, expected] of [
      ["light", LIGHT, light],
      ["dark", DARK, dark],
    ]) {
      const got = ratio(set[fg], set[bg]);
      assert.ok(
        Math.abs(got - expected) <= 0.01,
        `${fg} on ${bg} ${theme}: ${got.toFixed(2)} not ${expected}`,
      );
      assert.ok(
        got >= minimum,
        `${fg} on ${bg} ${theme}: ${got.toFixed(2)} under ${minimum}`,
      );
    }
  }
  // no color outside the two blocks of tokens
  const others = rules.filter(
    (r) =>
      !(r.selector === ":root" && r.decls.some(([p]) => p.startsWith("--"))),
  );
  const named =
    /\b(white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|brown|silver|navy|teal|maroon|lime|aqua|fuchsia|olive|cyan|magenta|gold|violet|indigo|coral|salmon|tan|khaki)\b/iu;
  for (const rule of others) {
    for (const [property, value] of rule.decls) {
      const where = `${rule.selector} { ${property}: ${value} }`;
      assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b/iu, where);
      assert.doesNotMatch(
        value,
        /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/iu,
        where,
      );
      assert.doesNotMatch(value.replace(/var\([^)]*\)/gu, ""), named, where);
    }
  }
  // the properties that must not be there at all
  const text = read("page.css");
  for (const word of [
    "url(",
    "@import",
    "@font-face",
    "position: fixed",
    "nowrap",
    "text-transform",
    "transition",
    "animation",
    "!important",
  ])
    assert.equal(text.includes(word), false, word);
  // the text is not under 1rem, every size is in rem
  for (const rule of others)
    for (const [property, value] of rule.decls) {
      if (property !== "font-size") continue;
      assert.match(value, /^\d+(\.\d+)?rem$/u, `${rule.selector}: ${value}`);
      assert.ok(parseFloat(value) >= 1, `${rule.selector}: ${value}`);
    }
  // the sizes of the controls
  const has = (selector, property, value) =>
    rules.some(
      (r) =>
        r.selector === selector &&
        r.decls.some(([p, v]) => p === property && v === value),
    );
  assert.ok(
    has('[data-part="option"]', "min-height", "3rem"),
    "rows of the options",
  );
  assert.ok(
    has('[data-part="number"] input', "min-height", "3rem"),
    "the field of a number",
  );
  assert.ok(
    has(
      '[data-part="actions"] button, [data-part="net-action"]',
      "min-height",
      "3rem",
    ),
    "buttons",
  );
  assert.ok(
    has(
      '[data-part="actions"] button, [data-part="net-action"]',
      "min-width",
      "3rem",
    ),
    "buttons",
  );
  assert.ok(
    has('[data-part="lang"]', "min-height", "2.75rem"),
    "buttons of the languages",
  );
  assert.ok(
    has('[data-part="lang"]', "min-width", "2.75rem"),
    "buttons of the languages",
  );
  // the ring of the focus
  const ring = rules.find((r) => r.selector.includes("button:focus-visible"));
  assert.ok(ring.selector.includes('[tabindex="-1"]:focus'));
  assert.ok(ring.selector.includes("input:focus-visible"));
  assert.deepEqual(ring.decls, [
    ["outline", "3px solid var(--focus)"],
    ["outline-offset", "2px"],
  ]);
  assert.ok(
    has(
      '[data-part="option"]:has(input:focus-visible)',
      "outline",
      "3px solid var(--focus)",
    ),
  );
  // the width of the fill is given by the script, not by the style sheet
  const fill = rules.filter((r) => r.selector.includes("bar-fill"));
  assert.ok(fill.length >= 1);
  for (const r of fill)
    assert.equal(
      r.decls.some(([p]) => p === "width"),
      false,
    );
  // the live region is hidden for the eye and open for the reader, never removed
  const live = rules.find((r) => r.selector === "#live");
  const liveDecls = Object.fromEntries(live.decls);
  assert.equal(liveDecls.position, "absolute");
  assert.equal(liveDecls.width, "1px");
  assert.equal(liveDecls.height, "1px");
  assert.equal(liveDecls.overflow, "hidden");
  assert.ok(liveDecls.clip);
  for (const rule of rules)
    for (const [p, v] of rule.decls) {
      if (
        /#live|q-error|\[hidden\]/u.test(rule.selector) ||
        rule.selector === "#live"
      ) {
        assert.equal(
          p === "display" && v === "none",
          false,
          `${rule.selector}: display none`,
        );
        assert.equal(
          p === "visibility" && v === "hidden",
          false,
          `${rule.selector}: visibility hidden`,
        );
      }
    }
  // the long words break
  assert.ok(
    rules.some((r) =>
      r.decls.some(([p, v]) => p === "overflow-wrap" && v === "anywhere"),
    ),
  );
  // the contrast check bites: a pair that is below the bar is found
  assert.ok(ratio("#777777", "#ffffff") < 4.5);
  assert.ok(ratio("#767676", "#ffffff") >= 4.5);
});

// ---------------------------------------------------------------------- QS-9

test("QS-9: the page does not hold the engine - no import of engine.js and none of the names computeResult, resolveAnswers, visibleQuestions", () => {
  for (const name of JS) {
    const text = read(name);
    assert.doesNotMatch(text, /engine/iu, name);
    for (const word of ["computeResult", "resolveAnswers", "visibleQuestions"])
      assert.equal(text.includes(word), false, `${name}: ${word}`);
  }
});

// ---------------------------------------------------------------------- QS-10

test("QS-10: no variable that lives between two loads of the page - no 'let' and no 'var' at the start of a line in any script of public/ (the state is created in start())", () => {
  for (const name of JS) {
    const text = read(name);
    assert.doesNotMatch(text, /^(let|var)\s/mu, name);
    assert.doesNotMatch(text, /^export\s+(let|var)\s/mu, name);
  }
  assert.match("let x = 1;", /^(let|var)\s/mu);
});

// ---------------------------------------------------------------------- QS-11

test("QS-11: texts.js - the key of the old placeholder is gone, there are 35 keys (13 before, one less, 23 more), exactly five exports, and the first line of the file names no requirement", async () => {
  const text = read("texts.js");
  assert.equal(text.includes(GONE_KEY), false);
  const { TEXTS, ...exports } = await import("../src/picker/public/texts.js");
  assert.equal(Object.hasOwn(TEXTS, GONE_KEY), false);
  assert.equal(Object.keys(TEXTS).length, 35);
  assert.deepEqual(
    Object.keys({ TEXTS, ...exports }).sort(),
    [
      "DEFAULT_LANGUAGE",
      "LANGUAGES",
      "LANGUAGE_NAMES",
      "TEXTS",
      "chooseLanguage",
    ].sort(),
  );
  const first = text.split("\n")[0];
  assert.match(first, /^\/\//u);
  assert.doesNotMatch(first, /REQ|design|\d{2,}/iu);
  assert.doesNotMatch(first, /\d/u);
});

// ---------------------------------------------------------------------- QS-12

test("QS-12: the settings of the linter - the block for src/picker/public/**/*.js with the browser names is in eslint.config.js, every other block of a browser is a public/ folder, the script lint has --max-warnings 0, and no file of the page or of its tests turns a rule off", () => {
  const config = fs.readFileSync(path.join(TOOLS, "eslint.config.js"), "utf8");
  const blocks = [
    ...config.matchAll(
      /files:\s*\[\s*"([^"]+)"\s*\]\s*,\s*languageOptions:\s*\{\s*globals:\s*\{\s*\.\.\.globals\.(\w+)/gu,
    ),
  ];
  assert.ok(
    blocks.some(
      ([, files, set]) =>
        files === "src/picker/public/**/*.js" && set === "browser",
    ),
  );
  const filesOf = [...config.matchAll(/files:\s*\[([^\]]*)\]/gu)].flatMap((m) =>
    [...m[1].matchAll(/"([^"]+)"/gu)].map((x) => x[1]),
  );
  assert.ok(filesOf.length >= 3);
  for (const file of filesOf)
    assert.match(file, /public\/\*\*\/\*\.js$/u, file);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"),
  );
  assert.match(pkg.scripts.lint, /--max-warnings 0/u);
  assert.match(pkg.scripts.check, /npm run lint/u);
  const tests = fs
    .readdirSync(path.join(TOOLS, "test"))
    .filter((f) => /^picker-page.*\.js$/u.test(f));
  assert.ok(tests.length >= 5);
  const off = new RegExp(["eslint", "-disable"].join(""), "u");
  const ignore = new RegExp(["prettier", "-ignore"].join(""), "u");
  for (const name of JS) assert.doesNotMatch(read(name), off, name);
  for (const name of tests) {
    const text = fs.readFileSync(path.join(TOOLS, "test", name), "utf8");
    assert.doesNotMatch(text, off, name);
    assert.doesNotMatch(text, ignore, name);
  }
});
