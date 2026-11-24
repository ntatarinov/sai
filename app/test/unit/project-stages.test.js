import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  OPTIONS,
  QUICK_KEYS,
  isOption,
} from "../../public/shared/project/quick-facts.js";
import {
  STAGES,
  canMove,
  isStage,
} from "../../public/shared/project/stages.js";
import { TEXTS } from "../../public/shared/i18n/texts.js";
import { APP } from "../fixtures/helpers.js";

// REQ-117 criterion 3 (the stages; the code design M2PROJ, 4.7 and 7.2): the stage list and the allowed moves of
// app/public/shared/project/stages.js against literals written here, the purity of the module, the one file
// that holds a statement changing a project, and the closed sets of the quick facts (QF-1). The oracles are the
// test's own: the eleven stages and the twenty allowed pairs are literals of the description, not read from the
// module.

/** The eleven stages of the description in the order of a project's life. */
const ELEVEN = [
  "draft",
  "interview",
  "spec",
  "approved",
  "dev_requested",
  "in_development",
  "built",
  "delivered",
  "accepted",
  "returned",
  "archived",
];

/**
 * The twenty allowed ordered pairs (4.7): the chain from draft to delivered, delivered to accepted or returned,
 * returned back to development, and archived from each of the ten other stages.
 * @type {Array<[string, string]>}
 */
const ALLOWED = [
  ["draft", "interview"],
  ["interview", "spec"],
  ["spec", "approved"],
  ["approved", "dev_requested"],
  ["dev_requested", "in_development"],
  ["in_development", "built"],
  ["built", "delivered"],
  ["delivered", "accepted"],
  ["delivered", "returned"],
  ["returned", "in_development"],
  ...ELEVEN.filter((s) => s !== "archived").map(
    (s) => /** @type {[string, string]} */ ([s, "archived"]),
  ),
];

test("STG-1 STAGES equals the eleven literals of the description in that order, frozen, and isStage accepts exactly those", () => {
  assert.deepEqual([...STAGES], ELEVEN);
  assert.equal(Object.isFrozen(STAGES), true);
  for (const s of ELEVEN) assert.equal(isStage(s), true, s);
  // Anything else is no stage: another text, another case, a number, nothing.
  for (const x of [
    "",
    "Draft",
    "DRAFT",
    " draft",
    "done",
    "archive",
    0,
    1,
    null,
    undefined,
    {},
    ["draft"],
  ])
    assert.equal(isStage(x), false, String(x));
});

test("STG-2 for every ordered pair of the eleven stages (121 pairs) canMove equals the test's own literal table of twenty; archived is reachable from every other stage and leads nowhere", () => {
  assert.equal(ALLOWED.length, 20);
  const wanted = new Set(ALLOWED.map(([a, b]) => `${a}>${b}`));
  assert.equal(wanted.size, 20, "no pair twice in the literal table");
  let pairs = 0;
  let allowed = 0;
  for (const from of ELEVEN)
    for (const to of ELEVEN) {
      pairs += 1;
      const want = wanted.has(`${from}>${to}`);
      assert.equal(canMove(from, to), want, `${from} -> ${to}`);
      if (want) allowed += 1;
    }
  assert.equal(pairs, 121);
  assert.equal(allowed, 20);
  for (const s of ELEVEN.filter((x) => x !== "archived"))
    assert.equal(canMove(s, "archived"), true, `${s} -> archived`);
  for (const s of ELEVEN)
    assert.equal(canMove("archived", s), false, `archived -> ${s}`);
  // No stage moves to itself.
  for (const s of ELEVEN) assert.equal(canMove(s, s), false, `${s} -> ${s}`);
  // A name that is no stage, or no text, is not a move in either place.
  for (const x of ["", "nope", "Draft", null, undefined, 3, {}]) {
    assert.equal(canMove(x, "interview"), false, String(x));
    assert.equal(canMove("draft", x), false, String(x));
  }
});

/**
 * The findings of the purity rules of criterion 3 in a source text: a `node:` import, a `document` or `window`,
 * `Math.random`, `Date.now` and `new Date`. Comments are read too (the strict reading).
 * @param {string} source
 * @returns {string[]}
 */
function purityFindings(source) {
  /** @type {Array<[string, RegExp]>} */
  const rules = [
    ["a node: module", /\bnode:/],
    [
      "an import of a node module",
      /from\s*["'](?:fs|path|os|crypto|child_process|http|net|url)["']/,
    ],
    ["document", /\bdocument\b/],
    ["window", /\bwindow\b/],
    ["Math.random", /Math\s*\.\s*random/],
    ["Date.now", /Date\s*\.\s*now/],
    ["new Date", /new\s+Date\b/],
  ];
  return rules.filter(([, re]) => re.test(source)).map(([name]) => name);
}

test("STG-3 stages.js has no node: import, no document or window, no Math.random, Date.now or new Date; each planted form is found", () => {
  const source = fs.readFileSync(
    path.join(APP, "public", "shared", "project", "stages.js"),
    "utf8",
  );
  assert.deepEqual(purityFindings(source), []);
  // The self-check: each planted line is found by its own rule, so a clean result above means something.
  /** @type {Array<[string, string]>} */
  const plants = [
    ['import fs from "node:fs";', "a node: module"],
    ["const d = document.title;", "document"],
    ["const w = window.location;", "window"],
    ["const r = Math.random();", "Math.random"],
    ["const n = Date.now();", "Date.now"],
    ["const t = new Date();", "new Date"],
  ];
  for (const [line, name] of plants)
    assert.ok(
      purityFindings(`${source}\n${line}\n`).includes(name),
      `${name} is found in a planted line`,
    );
});

/**
 * The `.js` files under a folder, as `<folder>/…` paths from app/.
 * @param {string} rel
 * @returns {string[]}
 */
function jsFiles(rel) {
  return fs
    .readdirSync(path.join(APP, rel), { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory()
        ? d.name === "vendor"
          ? []
          : jsFiles(`${rel}/${d.name}`)
        : d.name.endsWith(".js")
          ? [`${rel}/${d.name}`]
          : [],
    );
}

/**
 * The files whose lines hold the pattern, as the grep -rniE of the criterion finds them: a line is read as a line,
 * case ignored.
 * @param {Record<string, string>} files path → source
 * @param {RegExp} re
 * @returns {string[]}
 */
function filesWith(files, re) {
  return Object.entries(files)
    .filter(([, text]) => text.split("\n").some((line) => re.test(line)))
    .map(([f]) => f)
    .sort();
}

test("STG-4 the statements that change a project stand in app/server/db/project-store.js only (the grep of the criterion on app/server and app/api, read here); a planted line in a service or a route is found", () => {
  const files = Object.fromEntries(
    [...jsFiles("server"), ...jsFiles("api")].map((f) => [
      f,
      fs.readFileSync(path.join(APP, f), "utf8"),
    ]),
  );
  const re = /update[ \t]+projects/i;
  assert.deepEqual(filesWith(files, re), ["server/db/project-store.js"]);
  // A statement text in the service, in a route or in an upper-case form is found as well.
  for (const [file, line] of [
    ["server/services/projects.js", '"update projects set title = $1"'],
    ["server/routes/projects.js", "// UPDATE  projects set stage = 'x'"],
    ["server/services/orgs.js", '"Update\tprojects set x"'],
  ]) {
    const planted = { ...files, [file]: `${files[file]}\n${line}\n` };
    assert.ok(
      filesWith(planted, re).includes(file),
      `${file}: ${line} is found`,
    );
  }
});

test("QF-1 the three quick facts are what, whom and lang with the closed sets of the design; every option has a label key and ru, kk and en texts; unknown stands on what and whom; lang is ru and en", () => {
  assert.deepEqual([...QUICK_KEYS], ["what", "whom", "lang"]);
  /** @type {Record<string, string[]>} */
  const sets = {
    what: ["site", "shop", "bot", "app", "tool", "unknown"],
    whom: ["customers", "team", "myself", "unknown"],
    lang: ["ru", "en"],
  };
  assert.deepEqual(Object.keys(OPTIONS).sort(), Object.keys(sets).sort());
  for (const [key, ids] of Object.entries(sets)) {
    assert.deepEqual([...OPTIONS[/** @type {"what"} */ (key)]], ids, key);
    // The label of the question and the text of each option, in the three languages.
    const keys = [`qf_${key}_label`, ...ids.map((id) => `qf_${key}_${id}`)];
    for (const k of keys)
      for (const lang of ["ru", "kk", "en"]) {
        const value = /** @type {any} */ (TEXTS)[k]?.[lang];
        assert.equal(typeof value, "string", `${k} ${lang}`);
        assert.ok(value.trim().length > 0, `${k} ${lang}`);
      }
    for (const id of ids) assert.equal(isOption(key, id), true, `${key}.${id}`);
    assert.equal(isOption(key, "spaceship"), false, key);
    assert.equal(isOption(key, null), false, key);
    assert.equal(isOption(key, 5), false, key);
  }
  // «Пока не знаю» is the unknown option of what and whom (the ru values of the description).
  assert.equal(TEXTS.qf_what_unknown.ru, "Пока не знаю");
  assert.equal(TEXTS.qf_whom_unknown.ru, "Пока не знаю");
  // An option of one fact is no option of another, and an unknown fact has none.
  assert.equal(isOption("what", "customers"), false);
  assert.equal(isOption("lang", "kk"), false);
  assert.equal(isOption("color", "red"), false);
});
