// Helpers of the tests of the three languages of the picker (design REQ-061, 13.3). Not a
// test file. The oracles here (the places of the texts, the phrases and words, the numbers
// of a text) are written from the description of the design and share nothing with src/.
import fs from "node:fs";
import path from "node:path";
import { TOOLS } from "./picker-helpers.js";

export const LANG_FIXTURES = path.join(
  TOOLS,
  "test",
  "fixtures",
  "picker-lang",
);
export const LANGS = ["ru", "kk", "en"];

export const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
export const langFixture = (name) => path.join(LANG_FIXTURES, name);
export const langFixtureBytes = (name) => fs.readFileSync(langFixture(name));
export const langFixtureJson = (name) => readJson(langFixture(name));
export const langFixtureNames = () => fs.readdirSync(LANG_FIXTURES).sort();

// ------------------------------------------------------------- paths in a value

export function getAt(value, pathList) {
  let here = value;
  for (const key of pathList) here = here[key];
  return here;
}

// Puts `value` at the path of `root` (the last segment is the key to set).
export function setAt(root, pathList, value) {
  const parent = getAt(root, pathList.slice(0, -1));
  Object.defineProperty(parent, pathList.at(-1), {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return root;
}

export function deleteAt(root, pathList) {
  const parent = getAt(root, pathList.slice(0, -1));
  if (Array.isArray(parent)) parent.splice(pathList.at(-1), 1);
  else delete parent[pathList.at(-1)];
  return root;
}

// The place of a path in the form of the messages: questions[2].title.kk
export function placeText(pathList) {
  let out = "";
  for (const segment of pathList) {
    if (typeof segment === "number") out += `[${segment}]`;
    else out += out === "" ? segment : `.${segment}`;
  }
  return out;
}

// ------------------------------------------------------------- the places of the texts

// The 19 kinds of place of design 4.3 with the borders of the length (signs), in the order
// of the file. For every text for the visitor of a tenant: { path, value, min, max, kind }.
// `value` is what the file holds there (a string in /1, an object in /2).
export function textPlaces(tenant) {
  const out = [];
  const add = (pathList, value, min, max, kind) =>
    out.push({ path: pathList, value, min, max, kind });
  const maybe = (obj, key, base, min, max, kind) => {
    if (Object.hasOwn(obj, key)) add([...base, key], obj[key], min, max, kind);
  };
  add(["name"], tenant.name, 1, 60, "name");
  add(["intro"], tenant.intro, 1, 400, "intro");
  tenant.questions.forEach((q, i) => {
    const base = ["questions", i];
    add([...base, "title"], q.title, 1, 200, "title");
    maybe(q, "help", base, 1, 300, "help");
    maybe(q, "unit", base, 1, 20, "unit");
    (q.options ?? []).forEach((o, j) =>
      add([...base, "options", j, "label"], o.label, 1, 100, "label"),
    );
  });
  tenant.solutions.forEach((s, i) => {
    const base = ["solutions", i];
    add([...base, "name"], s.name, 1, 80, "solution_name");
    add([...base, "summary"], s.summary, 1, 300, "summary");
    for (const [key, kind] of [
      ["includes", "includes"],
      ["needs_from_you", "needs_from_you"],
      ["next_steps", "next_steps"],
    ])
      s[key].forEach((x, k) => add([...base, key, k], x, 1, 150, kind));
    maybe(s, "price_text", base, 1, 120, "price_text");
    maybe(s, "duration_text", base, 1, 120, "duration_text");
    s.not_suitable_when.forEach((x, k) =>
      add([...base, "not_suitable_when", k], x, 1, 150, "not_suitable_when"),
    );
  });
  tenant.rules.forEach((r, i) =>
    add(["rules", i, "text"], r.text, 1, 200, "rule_text"),
  );
  (tenant.hypotheses ?? []).forEach((h, i) => {
    add(["hypotheses", i, "title"], h.title, 1, 100, "hypothesis_title");
    add(["hypotheses", i, "explanation"], h.explanation, 1, 300, "explanation");
  });
  add(
    ["result", "no_match_text"],
    tenant.result.no_match_text,
    1,
    300,
    "no_match_text",
  );
  if (Object.hasOwn(tenant, "leads"))
    maybe(tenant.leads, "consent_text", ["leads"], 1, 600, "consent_text");
  return out;
}

// The 19 kinds, as they stand in textPlaces.
export const PLACE_KINDS = [
  "name",
  "intro",
  "title",
  "help",
  "unit",
  "label",
  "solution_name",
  "summary",
  "includes",
  "needs_from_you",
  "next_steps",
  "price_text",
  "duration_text",
  "not_suitable_when",
  "rule_text",
  "hypothesis_title",
  "explanation",
  "no_match_text",
  "consent_text",
];

// ------------------------------------------------------------- phrases and words

// A phrase ends after ".", "!", "?" or "…" followed by a space sign or by the end of the
// text; the rest after the last sign is a phrase too (design REQ-054, 4.11).
export function phrases(text) {
  const out = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    if (!".!?…".includes(text[i])) continue;
    if (i + 1 === text.length || /\s/u.test(text[i + 1])) {
      out.push(text.slice(from, i + 1));
      from = i + 1;
    }
  }
  out.push(text.slice(from));
  return out;
}

// A word: a part between space signs with a letter or a digit in it.
export const words = (phrase) =>
  phrase.split(/\s+/u).filter((part) => /[\p{L}\p{N}]/u.test(part));

export const longestPhrase = (text) =>
  Math.max(...phrases(text).map((p) => words(p).length));

// ------------------------------------------------------------- numbers of a text

const SEPARATORS = new Set([" ", " ", " ", ","]);

// The numbers of a text by the rule of design 9.5: ASCII digits; groups of three after a
// separator (a space, U+00A0, U+202F or a comma) make one number; a point or a comma and
// digits after the whole part is the fraction; the value is a number.
export function numbersOf(text) {
  const out = [];
  const digit = (ch) => ch !== undefined && ch >= "0" && ch <= "9";
  let i = 0;
  while (i < text.length) {
    if (!digit(text[i])) {
      i += 1;
      continue;
    }
    // the digits
    let j = i;
    while (digit(text[j])) j += 1;
    let whole = text.slice(i, j);
    let end = j;
    // the grouped form: one to three digits, then groups "separator + three digits"
    if (whole.length <= 3) {
      let g = j;
      let grouped = whole;
      for (;;) {
        const sep = text[g];
        if (
          SEPARATORS.has(sep) &&
          digit(text[g + 1]) &&
          digit(text[g + 2]) &&
          digit(text[g + 3]) &&
          !digit(text[g + 4])
        ) {
          grouped += text.slice(g + 1, g + 4);
          g += 4;
        } else break;
      }
      if (g > j) {
        whole = grouped;
        end = g;
      }
    }
    let value = whole;
    // the fraction
    if ((text[end] === "." || text[end] === ",") && digit(text[end + 1])) {
      let k = end + 1;
      while (digit(text[k])) k += 1;
      value = `${whole}.${text.slice(end + 1, k)}`;
      end = k;
    }
    out.push(Number(value));
    i = end;
  }
  return out;
}

// ------------------------------------------------------------- skeleton of a tenant

function copyPlain(value) {
  if (Array.isArray(value)) return value.map(copyPlain);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value))
      Object.defineProperty(out, key, {
        value: copyPlain(value[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    return out;
  }
  return value;
}

// A copy where every text for the visitor is "T": the keys, the ids, the numbers and the
// lengths of the lists stay (design 13.1, LG-1f).
export function skeleton(tenant) {
  const copy = copyPlain(tenant);
  for (const place of textPlaces(copy)) setAt(copy, place.path, "T");
  return copy;
}

// A copy of a /2 tenant where every text is the string of one language.
export function viewByOracle(tenant, language) {
  const copy = copyPlain(tenant);
  for (const place of textPlaces(copy))
    setAt(copy, place.path, place.value[language]);
  return copy;
}

// ------------------------------------------------------------- line and column

// Line: 1 + the number of LF before the offset. Column: 1 + the number of code points
// after the last LF.
export function lineColumnOf(text, offset) {
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  const lineText = before.slice(before.lastIndexOf("\n") + 1);
  return { line, column: [...lineText].length + 1 };
}

// ------------------------------------------------------------- the expected lines of the samples

const NEED = "Нужен текст на трёх языках: ru, kk и en. Исправьте значение.";
const noTranslation = (l) =>
  `Нет перевода на ${l}. Добавьте текст на этом языке.`;
const EXTRA = (l) => `Лишний язык ${l}. Допустимы только ru, kk и en.`;
const NEED_STRING = "Ожидается строка. Исправьте значение.";
const NEED_INT = "Ожидается целое число. Исправьте значение.";
const LONG19 = "Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.";
const NOT_FORMAL = "Обращение не на «вы». Перепишите текст в форме «вы».";
const limitText = (n, a, b) =>
  `Знаков: ${n}, допустимо от ${a} до ${b}. Исправьте текст.`;

// The field F of design 10.3 and its place.
export const FIELD_PLACES = {
  name: "name",
  intro: "intro",
  title: "questions[0].title",
  label: "questions[0].options[0].label",
  summary: "solutions[0].summary",
  includes: "solutions[0].includes[0]",
  "rule-text": "rules[0].text",
  "no-match": "result.no_match_text",
  consent: "leads.consent_text",
};

const line = (file, place, code, text) =>
  `${file}.json: ${place}: ${code}: ${text}`;

// Every sample of design 10: the exit code and the exact lines (a function of the text
// of the file for the repeated key: its place is counted from the text).
export const LANG_EXPECTED = {};
const ok = (name, q, s, r) => {
  LANG_EXPECTED[`${name}.json`] = {
    code: 0,
    lines: [
      `Файл арендатора ${name} в порядке: вопросов ${q}, решений ${s}, правил ${r}.`,
    ],
  };
};
const bad = (name, ...lines) => {
  LANG_EXPECTED[`${name}.json`] = { code: 1, lines };
};
ok("ok-lang-minimal", 4, 2, 3);
ok("ok-lang-edges", 4, 2, 3);
ok("ok-lang-bounds", 30, 2, 3);
for (const [f, place] of Object.entries(FIELD_PLACES)) {
  const a = `e-lang-string-${f}`;
  bad(a, line(a, place, "E_FIELD", NEED));
  const b = `e-lang-no-kk-${f}`;
  bad(b, line(b, `${place}.kk`, "E_FIELD", noTranslation("kk")));
}
bad(
  "e-lang-no-kk-includes-2",
  line(
    "e-lang-no-kk-includes-2",
    "solutions[0].includes[1].kk",
    "E_FIELD",
    noTranslation("kk"),
  ),
);
bad(
  "e-lang-no-en-title",
  line(
    "e-lang-no-en-title",
    "questions[0].title.en",
    "E_FIELD",
    noTranslation("en"),
  ),
);
bad(
  "e-lang-no-ru-title",
  line(
    "e-lang-no-ru-title",
    "questions[0].title.ru",
    "E_FIELD",
    noTranslation("ru"),
  ),
);
bad(
  "e-lang-extra-de-title",
  line(
    "e-lang-extra-de-title",
    "questions[0].title.de",
    "E_FIELD",
    EXTRA("de"),
  ),
);
bad(
  "e-lang-de-for-en-title",
  line(
    "e-lang-de-for-en-title",
    "questions[0].title.en",
    "E_FIELD",
    noTranslation("en"),
  ),
  line(
    "e-lang-de-for-en-title",
    "questions[0].title.de",
    "E_FIELD",
    EXTRA("de"),
  ),
);
bad(
  "e-lang-object-for-number",
  line("e-lang-object-for-number", "questions[2].min", "E_FIELD", NEED_INT),
);
bad(
  "e-lang-object-for-id",
  line("e-lang-object-for-id", "hypotheses[0].id", "E_FIELD", NEED_STRING),
);
bad(
  "e-lang-v1-object",
  line("e-lang-v1-object", "name", "E_FIELD", NEED_STRING),
);
bad(
  "e-lang-operator-object",
  line("e-lang-operator-object", "leads.operator_name", "E_FIELD", NEED_STRING),
);
bad(
  "e-lang-privacy-object",
  line(
    "e-lang-privacy-object",
    "leads.privacy_contact",
    "E_FIELD",
    NEED_STRING,
  ),
);
for (const l of ["kk", "en"]) {
  const n = `e-lang-empty-${l}-title`;
  bad(n, line(n, `questions[0].title.${l}`, "E_LIMIT", limitText(0, 1, 200)));
}
for (const l of ["ru", "kk", "en"]) {
  const n = `e-lang-title-201-${l}`;
  bad(n, line(n, `questions[0].title.${l}`, "E_LIMIT", limitText(201, 1, 200)));
}
bad(
  "e-lang-all-three",
  line("e-lang-all-three", "name.kk", "E_FIELD", noTranslation("kk")),
  line("e-lang-all-three", "intro.ru", "E_TEXT", LONG19),
  line("e-lang-all-three", "intro.kk", "E_TEXT", LONG19),
  line("e-lang-all-three", "intro.en", "E_TEXT", LONG19),
  line(
    "e-lang-all-three",
    "questions[0].title.en",
    "E_LIMIT",
    limitText(201, 1, 200),
  ),
  line("e-lang-all-three", "solutions[0].summary.ru", "E_TEXT", NOT_FORMAL),
  line(
    "e-lang-all-three",
    "leads.consent_text.kk",
    "E_LIMIT",
    limitText(0, 1, 600),
  ),
);
bad(
  "e-lang-key-order",
  line("e-lang-key-order", "intro.en", "E_TEXT", LONG19),
  line("e-lang-key-order", "intro.kk", "E_TEXT", LONG19),
  line("e-lang-key-order", "intro.ru", "E_TEXT", LONG19),
);
// The repeated key: the place is the second "kk" of the text of the file.
LANG_EXPECTED["e-lang-dup-kk.json"] = {
  code: 1,
  lines: (fileText) => {
    const title = fileText.indexOf('"title"');
    const first = fileText.indexOf('"kk"', title);
    const second = fileText.indexOf('"kk"', first + 1);
    if (
      title < 0 ||
      first < 0 ||
      second < 0 ||
      fileText.slice(first, second).includes("}")
    )
      throw new Error("e-lang-dup-kk.json: the key kk is not written twice");
    const { line: l, column } = lineColumnOf(fileText, second);
    return [
      `e-lang-dup-kk.json: строка ${l}, знак ${column}: E_JSON: Поле kk записано дважды. Оставьте одно.`,
    ];
  },
};

export const LANG_SAMPLE_NAMES = Object.keys(LANG_EXPECTED);

// The messages of the new kinds, for the tests in memory.
export const MESSAGES = {
  NEED,
  noTranslation,
  EXTRA,
  NEED_STRING,
  NEED_INT,
  LONG19,
  NOT_FORMAL,
  limitText,
};

// ------------------------------------------------------------- the choice of the language

const KK_LIST = ["kk"];
const ALL = ["ru", "kk", "en"];
// One row: [query, stored, available, result]; the symbol NONE means "not passed".
export const NONE = Symbol("not passed");
const hasLength = { length: 2, 0: "ru", 1: "kk" };
const toKk = { toString: () => "kk" };
// The 33 rows of design 7 (rows 1-14 are the table of the requirement).
export const LANGUAGE_ROWS = [
  [1, "kk", NONE, ALL, "kk"],
  [2, NONE, "en", ALL, "en"],
  [3, NONE, NONE, ALL, "ru"],
  [4, "kk", "en", ALL, "kk"],
  [5, "de", "kk", ALL, "kk"],
  [6, "de", NONE, ALL, "ru"],
  [7, "KK", NONE, ALL, "ru"],
  [8, "", "en", ALL, "en"],
  [9, "kk,en", NONE, ALL, "ru"],
  [10, "kk", NONE, ["ru"], "ru"],
  [11, NONE, "kk", ["ru"], "ru"],
  [12, "kk", "en", ["ru"], "ru"],
  [13, NONE, "xx", ALL, "ru"],
  [14, "en", "kk", ALL, "en"],
  [15, " kk", NONE, ALL, "ru"],
  [16, "en", NONE, ALL, "en"],
  [17, NONE, "", ALL, "ru"],
  [18, "kk", NONE, ["ru", "kk"], "kk"],
  [19, "en", "kk", ["ru", "kk"], "ru"],
  [20, "ru", "kk", ALL, "ru"],
  [21, KK_LIST, "en", ALL, "en"],
  [22, null, null, ALL, "ru"],
  [23, "__proto__", NONE, ALL, "ru"],
  [24, "constructor", "toString", ALL, "ru"],
  [25, 5, "kk", ALL, "kk"],
  [26, toKk, NONE, ALL, "ru"],
  [27, "kk", NONE, NONE, "ru"],
  [28, "kk", NONE, "kk", "ru"],
  [29, "kk", NONE, hasLength, "ru"],
  [30, NONE, "kk", ALL, "kk"],
  [31, "kk", NONE, [], "ru"],
];

// Builds the argument of chooseLanguage from a row (the fields that are NONE are absent).
export function rowInput([, query, stored, available]) {
  const input = {};
  if (query !== NONE) input.query = query;
  if (stored !== NONE) input.stored = stored;
  if (available !== NONE) input.available = available;
  return input;
}

// ------------------------------------------------------------- the text of public/texts.js

// What the text of the module of the texts of the site must not hold (design 8.4, 14,
// decision 0070 item 14): the one definition for LG-4c and TX-6d. The words stand as words
// (borders: neither a letter nor a digit); the word "import" is forbidden as an
// instruction (at the start of a line, as a call, as import.meta, in "export ... from"),
// not inside a translation.
export const TEXTS_MODULE_FORBIDDEN = [
  { name: "import statement", re: /^[ \t]*import\b/mu },
  { name: "import call", re: /\bimport\s*\(/u },
  { name: "import.meta", re: /\bimport\s*\.\s*meta\b/u },
  {
    name: "export from",
    re: /\bexport\s*(?:\*|\{[^}]*\})[^;]*?\bfrom\b/u,
  },
  { name: "require", re: /(?<![\p{L}\p{N}])require(?![\p{L}\p{N}])/u },
  { name: "node:", re: /node:/u },
  { name: "process", re: /(?<![\p{L}\p{N}])process(?![\p{L}\p{N}])/u },
];

// The names of the forbidden things found in a text of the module.
export function scanTextsModule(text) {
  return TEXTS_MODULE_FORBIDDEN.filter(({ re }) => re.test(text)).map(
    ({ name }) => name,
  );
}
