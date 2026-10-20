// TX-6a ... TX-6f and TX-R1: the table of the texts of the site, public/texts.js (design
// REQ-061, 8 and 13.1). The check of a table is a function of this test that is given any
// table: the real one (all keys, also those that later work adds) and copies broken on
// purpose. It is written from the rules of design 8.2, not taken from src/.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import * as limits from "../src/picker/limits.js";
import * as site from "../src/picker/public/texts.js";
import { PICKER, makeRng } from "./picker-helpers.js";
import {
  TEXTS_MODULE_FORBIDDEN,
  phrases,
  scanTextsModule,
  words,
} from "./picker-lang-helpers.js";

const TEXTS_FILE = path.join(PICKER, "public", "texts.js");
const SECOND_PERSON = [
  "ты",
  "тебя",
  "тебе",
  "тобой",
  "твой",
  "твоя",
  "твоё",
  "твои",
];
const KEY = /^[a-z][a-z0-9_]*$/u;
const NAME = /^[a-z][a-z0-9_]*$/u;
const KAZAKH_NAME = "Қазақша";

const plain = (value) => JSON.parse(JSON.stringify(value));

// The problems of a table "key -> { ru, kk, en }" by the rules of design 8.2.
export function tableProblems(table) {
  const out = [];
  if (table === null || typeof table !== "object" || Array.isArray(table))
    return ["the table is no object"];
  for (const key of Object.keys(table)) {
    const value = table[key];
    const at = (what) => out.push(`${key}: ${what}`);
    if (!KEY.test(key))
      at("the key is not lower case Latin letters, digits and _");
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      at("the value is no object");
      continue;
    }
    const keys = Object.keys(value).sort();
    if (keys.join() !== "en,kk,ru") at(`the languages are ${keys.join()}`);
    const sets = [];
    for (const language of ["ru", "kk", "en"]) {
      const text = value[language];
      if (typeof text !== "string" || text === "") {
        at(`${language} is no non-empty string`);
        continue;
      }
      if (text !== text.trim()) at(`${language} has a space at an end`);
      if (/[\p{Cc}]/u.test(text)) at(`${language} has a control sign`);
      if (/https?:\/\//iu.test(text)) at(`${language} has an address`);
      for (const phrase of phrases(text)) {
        if (words(phrase).length > 18)
          at(`${language} has a phrase of more than 18 words`);
      }
      if (language === "ru") {
        const parts = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
        if (parts.some((w) => SECOND_PERSON.includes(w)))
          at("ru addresses as ты");
      }
      const names = [...text.matchAll(/\{([^{}]*)\}/gu)].map((m) => m[1]);
      if (names.some((n) => !NAME.test(n)))
        at(`${language} has a bad placeholder`);
      const rest = text.replace(/\{[^{}]*\}/gu, "");
      if (/[{}]/u.test(rest)) at(`${language} has a stray brace`);
      sets.push([language, [...new Set(names)].sort().join()]);
    }
    if (new Set(sets.map(([, s]) => s)).size > 1)
      at(
        `the placeholders differ: ${sets.map(([l, s]) => `${l}=${s}`).join(" ")}`,
      );
  }
  return out;
}

// ---------------------------------------------------------------------- TX-6a

test("TX-6a: the module exports exactly five things and their values are the literals of the design - LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_NAMES, the first constant, chooseLanguage", () => {
  assert.deepEqual(Object.keys(site).sort(), [
    "DEFAULT_LANGUAGE",
    "LANGUAGES",
    "LANGUAGE_NAMES",
    "TEXTS",
    "chooseLanguage",
  ]);
  assert.deepEqual([...site.LANGUAGES], ["ru", "kk", "en"]);
  assert.equal(site.DEFAULT_LANGUAGE, "ru");
  assert.deepEqual(
    { ...site.LANGUAGE_NAMES },
    {
      ru: "Русский",
      kk: KAZAKH_NAME,
      en: "English",
    },
  );
  assert.equal(site.LANGUAGE_NAMES.kk, "Қазақша");
  assert.equal(
    site.LANGUAGE_NAMES.kk.codePointAt(0),
    0x049a,
    "the first letter is Cyrillic",
  );
  assert.deepEqual(
    { ...site.TEXTS.language_switcher_label },
    {
      ru: "Язык",
      kk: "Тіл",
      en: "Language",
    },
  );
  assert.equal(typeof site.chooseLanguage, "function");
  assert.equal(site.LANGUAGES.length, 3);
  assert.deepEqual(Object.keys(site.LANGUAGE_NAMES), ["ru", "kk", "en"]);
});

// ---------------------------------------------------------------------- TX-6b

test("TX-6b: the real table - every key, also those that later work adds - has no problem by the rules of design 8.2", () => {
  assert.ok(Object.keys(site.TEXTS).length >= 1);
  assert.deepEqual(tableProblems(site.TEXTS), []);
  // the check works on a good table with placeholders
  assert.deepEqual(
    tableProblems({
      lead_hello: {
        ru: "Здравствуйте, {name}.",
        kk: "Сәлем, {name}.",
        en: "Hello, {name}.",
      },
    }),
    [],
  );
});

// ---------------------------------------------------------------------- TX-6c

const MUTANTS = [
  ["a constant with no kk", (t) => delete t.language_switcher_label.kk],
  [
    "en with a phrase of 19 words",
    (t) => (t.language_switcher_label.en = Array(19).fill("word").join(" ")),
  ],
  [
    "a placeholder in ru and en but not in kk",
    (t) => {
      t.language_switcher_label.ru = "Язык {name}";
      t.language_switcher_label.en = "Language {name}";
    },
  ],
  ["an extra language", (t) => (t.language_switcher_label.de = "Sprache")],
  ["a space at the ends", (t) => (t.language_switcher_label.kk = " Тіл ")],
  ["ты in ru", (t) => (t.language_switcher_label.ru = "Ты выбираешь язык")],
  [
    "two placeholders in ru and one in en and kk",
    (t) => {
      t.language_switcher_label.ru = "{a} и {b}";
      t.language_switcher_label.kk = "{a}";
      t.language_switcher_label.en = "{a}";
    },
  ],
  ["an empty string", (t) => (t.language_switcher_label.en = "")],
  ["a number in place of a string", (t) => (t.language_switcher_label.kk = 5)],
  [
    "a key with a capital letter",
    (t) => {
      t.Language_switcher = t.language_switcher_label;
      delete t.language_switcher_label;
    },
  ],
  ["a stray brace", (t) => (t.language_switcher_label.en = "Language {")],
  [
    "an address in a text",
    (t) => (t.language_switcher_label.en = "See https://x.example"),
  ],
  [
    "a line break in a text",
    (t) => (t.language_switcher_label.en = "Lang\nuage"),
  ],
  [
    "a value that is a list",
    (t) => (t.language_switcher_label = ["Язык", "Тіл", "Language"]),
  ],
  ["no language at all", (t) => (t.language_switcher_label = {})],
];

test("TX-6c: the check of a table is red on each of 15 copies of the real table broken in one place (also the 11 of design 8.3) and green on the real one", () => {
  assert.ok(MUTANTS.length >= 11);
  assert.deepEqual(tableProblems(site.TEXTS), []);
  for (const [label, mutate] of MUTANTS) {
    const copy = plain(site.TEXTS);
    mutate(copy);
    assert.ok(tableProblems(copy).length >= 1, label);
  }
  // each one is red by its own reason, not by chance
  const reason = (mutate) => {
    const copy = plain(site.TEXTS);
    mutate(copy);
    return tableProblems(copy).join(" | ");
  };
  assert.match(reason(MUTANTS[0][1]), /languages are en,ru/u);
  assert.match(reason(MUTANTS[1][1]), /more than 18 words/u);
  assert.match(reason(MUTANTS[2][1]), /placeholders differ/u);
  assert.match(reason(MUTANTS[5][1]), /ты/u);
  assert.match(reason(MUTANTS[4][1]), /space at an end/u);
  // a phrase of exactly 18 words is right, and two phrases of 18 are right
  const edge = plain(site.TEXTS);
  edge.language_switcher_label.en = `${Array(18).fill("word").join(" ")}. ${Array(18).fill("word").join(" ")}.`;
  assert.deepEqual(tableProblems(edge), []);
});

// ---------------------------------------------------------------------- TX-6d

test("TX-6d: the text of the module has no import (as an instruction, a call, import.meta, export from), no require, no node: and no process - the words as words; the expressions find what they must and leave a word inside a translation alone", async () => {
  const text = fs.readFileSync(TEXTS_FILE, "utf8");
  assert.deepEqual(scanTextsModule(text), []);
  assert.ok(text.endsWith("\n"));
  const mustFind = [
    ['import x from "y";', "import statement"],
    ['  import { a } from "b";', "import statement"],
    ['import "./a.js";', "import statement"],
    ["import.meta.url;", "import statement"],
    ['const m = await import("x");', "import call"],
    ['const m = import ( "x" );', "import call"],
    ["const u = import.meta.url;", "import.meta"],
    ['export { a } from "./b.js";', "export from"],
    ['export * from "./b.js";', "export from"],
    ['export * as x from "./b.js";', "export from"],
    ['const x = require("y");', "require"],
    ["// require is not used", "require"],
    ['"node:fs"', "node:"],
    ["// node:path", "node:"],
    ["process.env.X", "process"],
    ["// the process is", "process"],
  ];
  for (const [sample, name] of mustFind) {
    assert.ok(scanTextsModule(sample).includes(name), `${name}: ${sample}`);
  }
  const mustLeave = [
    'en: "Please import your list first.",',
    'en: "Required fields",',
    'en: "Important: processing",',
    'ru: "Процесс",',
    'en: "To import, press the button.",',
    '    "import the file",',
    "export const A = 1;",
    "export const T = Object.freeze({});",
    'en: "Requirement"',
    'en: "Preprocessor"',
  ];
  for (const sample of mustLeave) {
    assert.deepEqual(scanTextsModule(sample), [], sample);
  }
  assert.ok(TEXTS_MODULE_FORBIDDEN.length >= 6);
  // the module loads in Node with no help (a dynamic import of the file)
  const module = await import(TEXTS_FILE);
  assert.equal(module.DEFAULT_LANGUAGE, "ru");
});

// ---------------------------------------------------------------------- TX-6e

test("TX-6e: LANGUAGES, LANGUAGE_NAMES, TEXTS and every constant of TEXTS are frozen and refuse a change", () => {
  for (const frozen of [site.LANGUAGES, site.LANGUAGE_NAMES, site.TEXTS]) {
    assert.equal(Object.isFrozen(frozen), true);
  }
  for (const [key, value] of Object.entries(site.TEXTS))
    assert.equal(Object.isFrozen(value), true, key);
  assert.throws(() => site.LANGUAGES.push("de"), TypeError);
  assert.throws(() => (site.LANGUAGES[0] = "xx"), TypeError);
  assert.throws(() => (site.LANGUAGE_NAMES.ru = "x"), TypeError);
  assert.throws(() => (site.TEXTS.extra = {}), TypeError);
  assert.throws(() => (site.TEXTS.language_switcher_label.kk = "x"), TypeError);
  assert.throws(() => delete site.TEXTS.language_switcher_label, TypeError);
  assert.deepEqual([...site.LANGUAGES], ["ru", "kk", "en"]);
});

// ---------------------------------------------------------------------- TX-6f

test("TX-6f: limits.js gives the same list of languages (the very object) and the same default as the file of the site", () => {
  assert.equal(limits.LANGUAGES, site.LANGUAGES);
  assert.equal(limits.DEFAULT_LANGUAGE, site.DEFAULT_LANGUAGE);
  assert.equal(limits.FORMAT_V1, "sai-picker-tenant/1");
  assert.equal(limits.FORMAT_V2, "sai-picker-tenant/2");
  assert.equal(Object.hasOwn(limits, "FORMAT_ID"), false);
});

// ---------------------------------------------------------------------- TX-R1

test("TX-R1: the check of a table does not throw on 1000 random values (numbers, null, lists, objects with a prototype)", () => {
  const rng = makeRng(61030);
  const atoms = [
    0,
    1,
    -1,
    2.5,
    null,
    true,
    false,
    "",
    "x",
    " ",
    "{a}",
    "ты",
    [],
    {},
    ["ru"],
    { ru: "а" },
  ];
  const make = (depth) => {
    const r = rng.next();
    if (depth > 2 || r < 0.4) return rng.pick(atoms);
    if (r < 0.7)
      return Array.from({ length: rng.int(4) }, () => make(depth + 1));
    const obj = {};
    for (let i = rng.int(4); i > 0; i--)
      obj[rng.pick(["ru", "kk", "en", "a_b", "A", "constructor", "x"])] = make(
        depth + 1,
      );
    return obj;
  };
  for (let i = 0; i < 1000; i++) {
    const value = make(0);
    const problems = tableProblems(value);
    assert.ok(Array.isArray(problems));
    if (Array.isArray(value) || value === null || typeof value !== "object") {
      assert.ok(problems.length >= 1);
    }
  }
  assert.deepEqual(tableProblems(Object.create({ ru: "а" })), []);
  assert.ok(tableProblems(null).length >= 1);
});
