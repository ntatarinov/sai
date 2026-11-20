import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkText } from "../../scripts/check-public.js";
import { el } from "../../public/js/dom.js";
import { APP, tempDir } from "../fixtures/helpers.js";

// REQ-109 criterion 7 and REQ-111 criterion 10 (the closed list of the code forms, the twins that stay
// green, and the helper `el()` that refuses the attribute names the list cannot see).

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
  // The sixteen twins of REQ-111 criterion 10: each looks like a form of the closed list and is none.
  "outerHTMLx",
  'el.insertAdjacentText("beforeend", t)',
  "stream.write(x)",
  "document.createDocumentFragment()",
  "parseFromStrings(x)",
  "el.setHTMLx",
  'data-srcdoc="a"',
  'el.setAttribute("data-style", v)',
  'el.style.setProperty("--x", v)',
  "opts.cssText",
  "retrieval(x)",
  "evaluate(x)",
  "new FunctionCall()",
  "myMath.random()",
  "profile://x",
  "Демо-опрос",
  // The borders of the identifier forms: a name before or after the form, and the form inside a longer name.
  "xsetHTML(a)",
  "setHTMLUnsafeX(a)",
  "my-srcdoc",
  "srcdoc-x",
  "Math.randomly()",
  "Maths.random()",
  "a.neweval(x)",
  "Demo: companyX",
  "Демо: этапы",
];

// The 22 forms of REQ-111 criterion 10, each with the one label that its own rule gives (the same text as
// the label of the rule in scripts/check-public.js: the oracle of this test is the list below), then the
// spellings the criterion allows (spaces around each dot and before each parenthesis, letter case).
/** @type {Array<[string, string]>} */
const FORMS = [
  ["x.outerHTML = a", "outerHTML"],
  ["x.insertAdjacentHTML(p, a)", "insertAdjacentHTML"],
  ["document.write(a)", "document.write"],
  ["document.writeln(a)", "document.writeln"],
  ["r.createContextualFragment(a)", "createContextualFragment"],
  ["new DOMParser().parseFromString(a, b)", "parseFromString"],
  ["x.setHTML(a)", "setHTML"],
  ["x.setHTMLUnsafe(a)", "setHTMLUnsafe"],
  ["Document.parseHTMLUnsafe(a)", "parseHTMLUnsafe"],
  ["f.srcdoc = a", "srcdoc"],
  ["x.setAttribute('style', a)", "setAttribute('style')"],
  ['x.setAttribute("style", a)', 'setAttribute("style")'],
  ["x.setAttribute(`style`, a)", "setAttribute(`style`)"],
  ["x.style.cssText = a", ".style.cssText"],
  ["eval(a)", "eval("],
  ["new Function(a)", "new Function"],
  ["Math.random()", "Math.random"],
  ["u = 'file:///x'", "file://"],
  ["Демо: компания", "phrase «Демо: компания»"],
  ["Демо: этап", "phrase «Демо: этап»"],
  ["Demo: company", "phrase «Demo: company»"],
  ["Demo: stage", "phrase «Demo: stage»"],
  ["document . write (a)", "document.write"],
  ["document\n.\nwriteln\n(a)", "document.writeln"],
  ["x . style . cssText = a", ".style.cssText"],
  ["x.setAttribute ( 'STYLE', a)", "setAttribute('style')"],
  ['x.setAttribute(\n"Style", a)', 'setAttribute("style")'],
  ["eval  (a)", "eval("],
  ["new\tFunction(a)", "new Function"],
  ["Math . random()", "Math.random"],
  ["Math\n.\nrandom ()", "Math.random"],
  ["u = 'FILE://x'", "file://"],
  ["u = 'File:///x'", "file://"],
  ["(file://x)", "file://"],
  ["ДЕМО:   КОМПАНИЯ", "phrase «Демо: компания»"],
  ["Демо:\nэтап", "phrase «Демо: этап»"],
  ["demo:\tCOMPANY", "phrase «Demo: company»"],
  ["DEMO: Stage", "phrase «Demo: stage»"],
  ["x.srcdoc=a", "srcdoc"],
  ["(x) => x.outerHTML", "outerHTML"],
];

test("CP-2 each planted item is red with its file, each benign twin is green", (t) => {
  for (const r of RED) assert.notDeepEqual(checkText("x.html", r), [], r);
  for (const g of GREEN) assert.deepEqual(checkText("x.html", g), [], g);
  assert.notDeepEqual(checkText("office/a.js", "Math.random()"), []);
  // Math.random is refused in any folder, not only under office/ (REQ-111 criterion 10; REQ-112 guard row (2)).
  assert.notDeepEqual(checkText("js/a.js", "Math.random()"), []);
  for (const rel of ["js/a.js", "shared/i18n/a.js", "a.js", "office/a.js"])
    assert.deepEqual(
      checkText(rel, "const n = Math.random();"),
      [{ file: rel, item: "Math.random" }],
      rel,
    );
  for (const [text, label] of FORMS)
    assert.deepEqual(
      checkText("js/a.js", text),
      [{ file: "js/a.js", item: label }],
      text,
    );
  const dir = tempDir(t);
  fs.writeFileSync(path.join(dir, "a.html"), "<p>handoff</p>\n");
  const r = run(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /a\.html: word «handoff»/);
});

// REQ-111 criterion 10: `el()` is the one way the pages make an element, and it refuses by an exception, before
// the element is made, an attribute name whose ASCII lower case is `style` or begins with `on`, so a name
// that is computed never reaches setAttribute, where this check reads literal forms only (code design 4.5).
test("CP-3 el() refuses an attribute named style or on… before it makes the element, and sets the others as given", () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "document");
  /** @type {string[]} */
  const calls = [];
  const fake = {
    createElement(/** @type {string} */ tag) {
      calls.push(`createElement ${tag}`);
      return {
        className: "",
        id: "",
        textContent: "",
        setAttribute(/** @type {string} */ name, /** @type {string} */ value) {
          calls.push(`setAttribute ${name}=${value}`);
        },
        append() {},
      };
    },
  };
  Object.defineProperty(globalThis, "document", {
    value: fake,
    configurable: true,
    writable: true,
  });
  try {
    for (const name of [
      "style",
      "STYLE",
      "Style",
      "onclick",
      "onClick",
      "ONLOAD",
    ]) {
      assert.throws(
        () => el("p", { attrs: { "data-x": "1", [name]: "x" } }),
        /dom: the attribute .* is refused/,
        name,
      );
      assert.deepEqual(calls, [], `${name}: nothing was made or set`);
    }
    // The helper does not refuse a name that only holds the letters.
    el("p", {
      attrs: {
        "data-x": "1",
        "aria-label": "a",
        lang: "ru",
        "data-style": "b",
      },
    });
    assert.deepEqual(calls, [
      "createElement p",
      "setAttribute data-x=1",
      "setAttribute aria-label=a",
      "setAttribute lang=ru",
      "setAttribute data-style=b",
    ]);
  } finally {
    if (saved === undefined) Reflect.deleteProperty(globalThis, "document");
    else Object.defineProperty(globalThis, "document", saved);
  }
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(globalThis, "document"),
    saved,
  );
});
