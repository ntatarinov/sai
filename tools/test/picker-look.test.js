// LK-1 ... LK-7: the look of a tenant (design docs/design/REQ-069-tenant-look-format.md,
// section 11.2): the file format /3 with the section `look`, the closed catalogues, the
// colour rule, the desks and quick numbers, the leads, the fallback look and the shared
// module. The expectations are literals or come from the oracles of
// picker-look-helpers.js, which share nothing with src/picker/ (the contrast, the sign
// class and the texts of the messages are written there from the description).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { checkBytes } from "../src/picker/check.js";
import * as shared from "../src/picker/public/tenant-look.js";
import { validateTenant } from "../src/picker/validate.js";
import { deepFreeze } from "./picker-engine-helpers.js";
import {
  DEMO_TENANTS,
  LEGACY_TENANTS,
  PICKER,
  TOOLS,
  fileDigest,
  lineProblems,
  makeRng,
  makeTmp,
  put,
  runPicker,
} from "./picker-helpers.js";
import {
  FIGURES,
  GLYPHS,
  LANGS,
  LOOK_EXPECTED,
  LOOK_FIXTURES,
  MESSAGE_IDS,
  MINIMAL,
  MSG,
  NEUTRAL,
  OBJECT_IDS,
  OBJECT_PARAMS,
  SAMPLE_NAMES,
  SHEETS,
  SHIRTS,
  boundaryColors,
  changed,
  checkDoc,
  checkRows,
  contrast,
  expectedFallback,
  isLetterOrDigit,
  lineOf,
  lookFixture,
  lookFixtureBytes,
  lookFixtureJson,
  lookFixtureNames,
  minimal3,
  okLine,
  staffNameVerdict,
  v2Body,
} from "./picker-look-helpers.js";

const FILE = `${MINIMAL}.json`;
const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const REL = (name) =>
  path.join("test", "fixtures", "picker-look", `${name}.json`);

// The digest of a whole folder (every file and its bytes): what must not change when a
// file is only read.
function folderDigest(dir) {
  return fs
    .readdirSync(dir)
    .sort()
    .map((name) => [name, sha256(fs.readFileSync(path.join(dir, name)))]);
}

// The check of the minimal file with changes, against the expected rows.
function expectRows(edits, rows, label) {
  const { got, want } = checkRows(changed(edits), rows);
  assert.deepEqual(got, want, label);
  if (rows.length > 0)
    assert.deepEqual(lineProblems(got.lines), [], `${label}: shape`);
}

// The check of a fixture read from its bytes, in memory.
function sampleOutput(name) {
  const out = checkBytes(lookFixtureBytes(name), `${name}.json`);
  return { code: out.exitCode, lines: out.stdout };
}
function expectSamples(names) {
  for (const name of names)
    assert.deepEqual(sampleOutput(name), LOOK_EXPECTED[name], name);
}

const unit = (...codes) => codes.map((c) => String.fromCodePoint(c)).join("");
const run19 = (ch) => Array(19).fill(ch).join(" ");
const run18 = (ch) => Array(18).fill(ch).join(" ");
const hexCode = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

// ---------------------------------------------------------------------- LK-1

test("LK-1a: the sample ok-minimal (the form /3 with every section) passes the command through npm and directly - code 0, stderr empty, the one line with the counts; the file and its folder are not changed", () => {
  const file = lookFixture(MINIMAL);
  const digest = fileDigest(file);
  const folder = folderDigest(LOOK_FIXTURES);
  for (const viaNpm of [true, false]) {
    const run = runPicker(["check", REL(MINIMAL)], { cwd: TOOLS, viaNpm });
    assert.equal(run.code, 0, `npm=${viaNpm}`);
    assert.deepEqual(run.err, [], `npm=${viaNpm}`);
    assert.deepEqual(
      run.out,
      [
        "Файл арендатора ok-minimal в порядке: вопросов 4, решений 2, правил 3.",
      ],
      `npm=${viaNpm}`,
    );
  }
  assert.deepEqual(fileDigest(file), digest);
  assert.deepEqual(folderDigest(LOOK_FIXTURES), folder);
  // the sample holds every section of the form /3 (criterion 1)
  const plain = lookFixtureJson(MINIMAL);
  assert.equal(plain.schema, "sai-picker-tenant/3");
  assert.deepEqual(Object.keys(plain.look), [
    "mark",
    "tagline",
    "industry",
    "headline",
    "colors",
    "team",
  ]);
  assert.deepEqual(plain.look.colors, {
    light: { accent: "#9a4306", accent2: "#1f7a8c" },
    dark: { accent: "#e0731f", accent2: "#6cc3d5" },
  });
  assert.equal(plain.look.team.length, 4);
  assert.deepEqual(
    plain.questions.map((q) => q.desk),
    [1, 2, 3, 4],
  );
  assert.deepEqual(plain.questions[2].chips, [10, 50, 200]);
  assert.equal(plain.questions[2].min, 1);
  assert.equal(plain.questions[2].max, 1000);
  assert.deepEqual(plain.questions[0].options[0].object, {
    id: "shelf",
    level: 2,
  });
  assert.deepEqual(plain.questions[0].options[1].object, {
    id: "monitor",
    tag: "1С",
  });
  assert.deepEqual(plain.questions[1].options[0].object, {
    id: "boxes",
    level: 1,
  });
  assert.deepEqual(plain.questions[3].options[0].object, {
    id: "poster",
    glyph: "cap",
  });
  assert.deepEqual(plain.leads.contact_fields, ["phone", "telegram", "email"]);
  assert.equal(plain.leads.whatsapp, "77010000000");
  assert.equal(plain.leads.max_per_hour, 30);
  assert.equal(plain.leads.max_stored, 1000);
  assert.equal(plain.leads.enabled, false);
  // the sample holds no address and no code
  assert.doesNotMatch(
    fs.readFileSync(file, "utf8"),
    /https?:\/\/|url[(]|<script|javascript:/u,
  );
});

test("LK-1b: the two demo files (/2) and the two copies of the form /1 pass as before - code 0 and the numbers 12/5/39 and 11/5/37; the folder of the copies holds exactly its two files", () => {
  const SIZES = { "uchet-pro": [12, 5, 39], "svet-marketing": [11, 5, 37] };
  for (const [id, [n, s, r]] of Object.entries(SIZES)) {
    const want = [okLine(id, n, s, r)];
    const demo = path.join(DEMO_TENANTS, `${id}.json`);
    const legacy = path.join(LEGACY_TENANTS, `${id}.json`);
    assert.equal(
      JSON.parse(fs.readFileSync(demo, "utf8")).schema,
      "sai-picker-tenant/2",
    );
    assert.equal(
      JSON.parse(fs.readFileSync(legacy, "utf8")).schema,
      "sai-picker-tenant/1",
    );
    for (const file of [demo, legacy]) {
      const digest = fileDigest(file);
      for (const viaNpm of [true, false]) {
        const run = runPicker(["check", file], { cwd: TOOLS, viaNpm });
        assert.equal(run.code, 0, `${file} npm=${viaNpm}`);
        assert.deepEqual(run.err, [], `${file} npm=${viaNpm}`);
        assert.deepEqual(run.out, want, `${file} npm=${viaNpm}`);
      }
      assert.deepEqual(fileDigest(file), digest);
    }
  }
  assert.deepEqual(fs.readdirSync(LEGACY_TENANTS).sort(), [
    "svet-marketing.json",
    "uchet-pro.json",
  ]);
});

test("LK-1c: a schema that is none of /1, /2 and /3 on a /3-shaped body gives code 1 and the line about schema first (the new text with three formats), then the reading as /1; the file stays", (t) => {
  const dir = makeTmp(t);
  const body = minimal3();
  const wrong = [
    "sai-picker-tenant/4",
    "sai-picker-tenant/",
    "sai-picker-tenant/30",
    "SAI-PICKER-TENANT/3",
    "sai-picker-tenant/3 ",
    " sai-picker-tenant/3",
    "sai-picker-tenant/13",
    "",
  ];
  const want = lineOf(FILE, "schema", "E_FIELD", MSG.M33);
  for (const value of wrong) {
    const file = put(dir, FILE, JSON.stringify({ ...body, schema: value }));
    const digest = fileDigest(file);
    const run = runPicker(["check", file]);
    const label = JSON.stringify(value);
    assert.equal(run.code, 1, label);
    assert.deepEqual(run.err, [], label);
    assert.equal(run.out[0], want, label);
    // the rest is the reading as /1: a text of three languages is not a string
    assert.equal(run.out[1], lineOf(FILE, "name", "E_FIELD", MSG.M36), label);
    assert.ok(
      run.out.includes(lineOf(FILE, "look", "E_FIELD", MSG.M02("look"))),
      label,
    );
    assert.deepEqual(lineProblems(run.out), [], label);
    assert.deepEqual(fileDigest(file), digest, `${label}: the file stays`);
  }
  // not a string, and no schema at all
  for (const value of [3, null, true, ["sai-picker-tenant/3"], {}]) {
    const got = checkDoc({ ...body, schema: value });
    assert.equal(got.code, 1, JSON.stringify(value));
    assert.equal(
      got.lines[0],
      lineOf(FILE, "schema", "E_FIELD", MSG.M36),
      JSON.stringify(value),
    );
  }
  const gone = { ...body };
  delete gone.schema;
  assert.equal(
    checkDoc(gone).lines[0],
    lineOf(FILE, "schema", "E_FIELD", MSG.M01("schema")),
  );
  // the right value is right
  assert.deepEqual(checkDoc(body), { code: 0, lines: [okLine(MINIMAL)] });
});

test("LK-1d: the folder of the look samples holds exactly the 89 names of the table and the folder of the earlier samples still holds its 44 files", () => {
  assert.deepEqual(lookFixtureNames(), SAMPLE_NAMES);
  assert.equal(SAMPLE_NAMES.length, 89);
  assert.equal(
    Object.keys(LOOK_EXPECTED).length,
    89,
    "the table of the helper has 89 names",
  );
  const all = fs.readdirSync(LOOK_FIXTURES);
  assert.equal(all.length, 89);
  for (const name of all) assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*\.json$/u);
  assert.equal(
    fs.readdirSync(path.join(TOOLS, "test", "fixtures", "picker")).length,
    44,
  );
});

test("LK-1e: every sample of the table, through the real command - the exit code, an empty stderr and the lines (place, code, the whole text) equal the literal lines of the helper, in the order of the file; the folder is not changed", () => {
  const folder = folderDigest(LOOK_FIXTURES);
  for (const name of SAMPLE_NAMES) {
    const run = runPicker(["check", lookFixture(name)]);
    const want = LOOK_EXPECTED[name];
    assert.equal(run.code, want.code, name);
    assert.deepEqual(run.err, [], name);
    assert.deepEqual(run.out, want.lines, name);
    if (want.code === 1)
      assert.deepEqual(lineProblems(run.out), [], `${name}: shape`);
  }
  assert.deepEqual(folderDigest(LOOK_FIXTURES), folder);
});

// ---------------------------------------------------------------------- LK-2

test("LK-2a: look - presence and form: missing, a string, an extra field in the section and in a staff member, `look` in a file of the form /2 and of the form /1, the /3 fields in a /2 file; the body /2 alone is right", () => {
  expectSamples([
    "e-look-missing",
    "e-look-string",
    "e-look-extra",
    "e-look-staff-extra",
    "e-v2-with-look",
    "e-v2-with-v3-fields",
    "ok-no-tagline",
  ]);
  // the body /2 alone is accepted with the same numbers
  assert.deepEqual(checkDoc(v2Body()), { code: 0, lines: [okLine(MINIMAL)] });
  // `look` that is not an object
  for (const value of [5, null, true, [], "office"]) {
    expectRows(
      [[["look"], value]],
      [["look", "E_FIELD", MSG.M03]],
      JSON.stringify(value),
    );
  }
  // `look` in a file of the form /2 (the body) and of the form /1 (the released sample)
  const v2 = { ...v2Body(), look: minimal3().look };
  assert.deepEqual(checkDoc(v2).lines, [
    lineOf(FILE, "look", "E_FIELD", MSG.M02("look")),
  ]);
  const v1 = JSON.parse(
    fs.readFileSync(
      path.join(TOOLS, "test", "fixtures", "picker", "ok-minimal.json"),
      "utf8",
    ),
  );
  assert.deepEqual(checkDoc(v1), { code: 0, lines: [okLine(MINIMAL)] });
  assert.deepEqual(checkDoc({ ...v1, look: minimal3().look }).lines, [
    lineOf(FILE, "look", "E_FIELD", MSG.M02("look")),
  ]);
  // each field of the section is named when it is missing
  for (const key of ["mark", "industry", "headline", "colors", "team"])
    expectRows(
      [[["look", key], undefined]],
      [[`look.${key}`, "E_FIELD", MSG.M01(key)]],
      key,
    );
  // an extra field in the section, whatever its value
  for (const value of [1, null, "x", [], {}])
    expectRows(
      [[["look", "logo"], value]],
      [["look.logo", "E_FIELD", MSG.M02("logo")]],
      JSON.stringify(value),
    );
});

test("LK-2b: mark - one letter or digit of any alphabet: 0 or 2 signs is E_LIMIT, a space, an emoji, a dash, a half of a pair, a superscript, a Roman numeral, a tab, a mark alone and a zero-width sign are E_FIELD; the letters of the criterion, the case, a digit of another alphabet and a letter outside the main plane are accepted", () => {
  expectSamples([
    "e-mark-empty",
    "e-mark-two",
    "e-mark-space",
    "e-mark-emoji",
    "e-mark-dash",
    "e-mark-half",
  ]);
  const accepted = [
    "С",
    "Ң",
    "7",
    "A",
    "ß",
    "𐐀",
    "с",
    "a",
    "٣",
    "ŉ",
    "ә",
    unit(0x4e2d),
  ];
  for (const mark of accepted)
    expectRows([[["look", "mark"], mark]], [], JSON.stringify(mark));
  const notLetter = [
    "²",
    "Ⅷ",
    "_",
    "\t",
    "́",
    "​",
    "😀",
    "-",
    " ",
    " ",
    "#",
    "\ud800",
    "\udc00",
  ];
  for (const mark of notLetter)
    expectRows(
      [[["look", "mark"], mark]],
      [["look.mark", "E_FIELD", MSG.M06]],
      JSON.stringify(mark),
    );
  for (const [mark, count] of [
    ["", 0],
    ["АБ", 2],
    ["Á", 2],
    ["😀😀", 2],
    ["abc", 3],
    ["𐐀𐐀", 2],
    ["77", 2],
  ])
    expectRows(
      [[["look", "mark"], mark]],
      [["look.mark", "E_LIMIT", MSG.M05(count)]],
      JSON.stringify(mark),
    );
  for (const value of [5, null, true, [], {}, ["A"]])
    expectRows(
      [[["look", "mark"], value]],
      [["look.mark", "E_FIELD", MSG.M36]],
      JSON.stringify(value),
    );
  // the independent test of the helper agrees with the list
  for (const mark of accepted) assert.equal(isLetterOrDigit(mark), true, mark);
  for (const mark of notLetter.slice(0, 11))
    assert.equal(isLetterOrDigit(mark), false, JSON.stringify(mark));
});

test("LK-2c: the length of tagline (40), industry (60) and headline (120) on each of ru, kk and en - the last length is right and one more is E_LIMIT with the place that ends in the language; the language missing, a string, a text of two or of four languages and an empty text", () => {
  const BOUNDS = { tagline: 40, industry: 60, headline: 120 };
  for (const [field, max] of Object.entries(BOUNDS)) {
    for (const lang of LANGS) {
      const at = ["look", field, lang];
      const place = `look.${field}.${lang}`;
      expectRows([[at, "а".repeat(max)]], [], `${place} ${max}`);
      expectRows(
        [[at, "а".repeat(max + 1)]],
        [[place, "E_LIMIT", MSG.M07(max + 1, 1, max)]],
        `${place} ${max + 1}`,
      );
      expectRows(
        [[at, ""]],
        [[place, "E_LIMIT", MSG.M07(0, 1, max)]],
        `${place} empty`,
      );
      // the spaces at the ends are not counted
      expectRows([[at, `${"а".repeat(max)}   `]], [], `${place} spaces`);
      expectRows(
        [[at, `${"а".repeat(max + 1)} `]],
        [[place, "E_LIMIT", MSG.M07(max + 1, 1, max)]],
        `${place} spaces`,
      );
      expectRows(
        [[["look", field, lang], undefined]],
        [[place, "E_FIELD", MSG.M08(lang)]],
        `${place} missing`,
      );
      expectRows(
        [[["look", field], { ...minimal3().look[field], [lang]: 5 }]],
        [[place, "E_FIELD", MSG.M36]],
        `${place} not a string`,
      );
    }
    expectRows(
      [[["look", field], "text"]],
      [[`look.${field}`, "E_FIELD", MSG.M09]],
      `${field} string`,
    );
    for (const value of [5, null, [], ["ru"]])
      expectRows(
        [[["look", field], value]],
        [[`look.${field}`, "E_FIELD", MSG.M09]],
        `${field} ${JSON.stringify(value)}`,
      );
    const two = { ru: "а", kk: "а" };
    expectRows(
      [[["look", field], two]],
      [[`look.${field}.en`, "E_FIELD", MSG.M08("en")]],
      `${field} two languages`,
    );
    const four = { ru: "а", kk: "а", en: "a", de: "a" };
    expectRows(
      [[["look", field], four]],
      [
        [
          `look.${field}.de`,
          "E_FIELD",
          "Лишний язык de. Допустимы только ru, kk и en.",
        ],
      ],
      `${field} four languages`,
    );
  }
  expectSamples([
    "e-tagline-41",
    "e-industry-61",
    "e-headline-121",
    "e-headline-no-kk",
    "e-headline-string",
  ]);
});

test("LK-2d: the phrase rule on the look texts - 19 words in a phrase is E_TEXT with the place that ends in the language, 18 are right, two short phrases are right; «ты» is an error in ru only and the staff name has no such rule", () => {
  const places = [
    ["look", "tagline"],
    ["look", "industry"],
    ["look", "headline"],
    ...[0, 1, 2, 3].flatMap((i) => [
      ["look", "team", i, "role"],
      ["look", "team", i, "says"],
    ]),
  ];
  const text = (at) => at.join(".").replace(/\.(\d+)/gu, "[$1]");
  for (const at of places) {
    for (const lang of LANGS) {
      const place = `${text(at)}.${lang}`;
      expectRows(
        [[[...at, lang], run19("а")]],
        [[place, "E_TEXT", MSG.M10(19)]],
        place,
      );
      expectRows([[[...at, lang], run18("а")]], [], `${place} 18`);
      expectRows(
        [[[...at, lang], "а а а а а а а а а а. а а а а а а а а а."]],
        [],
        `${place} two phrases`,
      );
      if (lang === "ru")
        expectRows(
          [[[...at, lang], "ты получишь"]],
          [[place, "E_TEXT", MSG.M11]],
          place,
        );
      else expectRows([[[...at, lang], "ты получишь"]], [], `${place} ty`);
    }
  }
  expectSamples(["e-words-19", "e-text-ty"]);
  // the staff name is no phrase and no address
  for (const name of ["Ты", "ты получишь", "Ты ты ты ты"])
    expectRows([[["look", "team", 0, "name"], name]], [], name);
});

test("LK-2e: a forbidden sign (REQ-068) in a look text or in a staff name is E_TEXT with the code of the sign; a lone half of a pair has the second text; the sign in the mark is a class error", () => {
  const SIGNS = [
    [0x07, MSG.M12("U+0007")],
    [0x200b, MSG.M12("U+200B")],
    [0x202e, MSG.M12("U+202E")],
    [0x2028, MSG.M12("U+2028")],
    [0xfeff, MSG.M12("U+FEFF")],
    [0x7f, MSG.M12("U+007F")],
    [0xd800, MSG.M37("U+D800")],
    [0xdc00, MSG.M37("U+DC00")],
  ];
  const textPlaces = [
    ["look", "tagline"],
    ["look", "industry"],
    ["look", "headline"],
    ["look", "team", 0, "role"],
    ["look", "team", 3, "says"],
  ];
  const text = (at) => at.join(".").replace(/\.(\d+)/gu, "[$1]");
  for (const [cp, message] of SIGNS) {
    const sign = String.fromCodePoint(cp);
    for (const at of textPlaces)
      for (const lang of LANGS) {
        const place = `${text(at)}.${lang}`;
        expectRows(
          [[[...at, lang], `Есеп${sign}`]],
          [[place, "E_TEXT", message]],
          `${place} ${cp.toString(16)}`,
        );
      }
    for (const i of [0, 2]) {
      expectRows(
        [[["look", "team", i, "name"], `Ай${sign}гүл`]],
        [[`look.team[${i}].name`, "E_TEXT", message]],
        `name ${i} ${cp.toString(16)}`,
      );
    }
  }
  expectSamples(["e-text-sign"]);
  // the three lone halves of the criterion are in the places of the sample
  expectRows(
    [
      [["look", "headline", "ru"], "Есеп\ud800"],
      [["look", "team", 2, "name"], "\udc00"],
    ],
    [
      ["look.headline.ru", "E_TEXT", MSG.M37("U+D800")],
      ["look.team[2].name", "E_TEXT", MSG.M37("U+DC00")],
    ],
    "lone halves",
  );
});

test("LK-2f: the team - a size other than 4 is E_LIMIT and its items are still checked; each field of a staff member is required; the name is 1 to 30 signs and its characters are a class (the whole untrimmed value); roles and replies are 1 to 40 signs", () => {
  expectSamples([
    "e-team-3",
    "e-team-5",
    "e-staff-no-figure",
    "e-staff-name-31",
    "e-staff-name-empty",
    "e-staff-name-url",
  ]);
  const team = minimal3().look.team;
  const extra = (figure) => ({
    ...team[0],
    name: "Мария-Анна",
    figure,
  });
  // the items are checked also when the size is wrong
  expectRows(
    [
      [
        ["look", "team"],
        [...team, extra("f13")],
      ],
    ],
    [
      ["look.team", "E_LIMIT", MSG.M13(5, 4)],
      ["look.team[4].figure", "E_REF", MSG.M15],
    ],
    "five staff, the fifth with f13",
  );
  expectRows(
    [
      [
        ["look", "team"],
        [team[0], { ...team[1], shirt: "red" }],
      ],
    ],
    [
      ["look.team", "E_LIMIT", MSG.M13(2, 4)],
      ["look.team[1].shirt", "E_REF", MSG.M16],
    ],
    "two staff, the second with a wrong shirt",
  );
  expectRows(
    [[["look", "team"], []]],
    [["look.team", "E_LIMIT", MSG.M13(0, 4)]],
    "no staff",
  );
  for (const value of ["x", 5, null, {}])
    expectRows(
      [[["look", "team"], value]],
      [["look.team", "E_FIELD", "Ожидается список. Исправьте значение."]],
      JSON.stringify(value),
    );
  // each field of a staff member
  for (const key of ["name", "role", "says", "figure", "shirt"])
    expectRows(
      [[["look", "team", 2, key], undefined]],
      [[`look.team[2].${key}`, "E_FIELD", MSG.M01(key)]],
      key,
    );
  expectRows(
    [[["look", "team", 3, "age"], 30]],
    [["look.team[3].age", "E_FIELD", MSG.M02("age")]],
    "extra",
  );
  expectRows(
    [[["look", "team", 1], "Айгерим"]],
    [["look.team[1]", "E_FIELD", MSG.M03]],
    "a staff member that is a string",
  );
  // the name: length
  const place = "look.team[0].name";
  const nameAt = ["look", "team", 0, "name"];
  expectRows([[nameAt, "А".repeat(30)]], [], "30 signs");
  expectRows(
    [[nameAt, "А".repeat(31)]],
    [[place, "E_LIMIT", MSG.M07(31, 1, 30)]],
    "31 signs",
  );
  expectRows([[nameAt, ""]], [[place, "E_LIMIT", MSG.M07(0, 1, 30)]], "empty");
  expectRows(
    [[nameAt, "   "]],
    [[place, "E_LIMIT", MSG.M07(0, 1, 30)]],
    "spaces only",
  );
  expectRows([[nameAt, "  Айгерим  "]], [], "spaces at the ends are cut");
  expectRows(
    [[nameAt, `${" ".repeat(5)}${"А".repeat(30)}`]],
    [],
    "30 after the cut",
  );
  // the name: not a string
  for (const value of [5, null, [], {}, true])
    expectRows(
      [[nameAt, value]],
      [[place, "E_FIELD", MSG.M36]],
      JSON.stringify(value),
    );
  // the name: accepted (the four of the criterion, others, and the class alone)
  for (const name of [
    "Айгерим",
    "Жан-Пьер О'Нил",
    "Т. Ли 2",
    "О’Нил",
    "Мария-Анна",
    "Ә. Нұрлан",
    "Robot 2",
    ".",
    "-",
    "'",
    "’",
    "...",
    "- -",
    "Ай́гүл",
    "𐐨𐐨",
    "٣٤",
  ])
    expectRows([[nameAt, name]], [], JSON.stringify(name));
  // the name: refused by the class, on the whole value (a tab or a no-break space at an
  // end is not cut away for the class)
  for (const name of [
    "url(http://x)",
    "a/b",
    "a\nb",
    "a\tb",
    "<b>",
    "a_b",
    "a:b",
    "a;b",
    "a@b",
    "a%b",
    'a"b',
    "a\\b",
    "a&b",
    "a,b",
    "Ай\t",
    "\tАй",
    "Ай ",
    " Ай",
    "　Ай",
    "Ай😀",
    "a²",
    "Ⅷ",
  ])
    expectRows(
      [[nameAt, name]],
      [[place, "E_FIELD", MSG.M14]],
      JSON.stringify(name),
    );
  // the name: the class over the signs of the first planes against the independent test
  const codes = [];
  for (let cp = 0; cp <= 0x2ff; cp++) codes.push(cp);
  codes.push(
    0x2010,
    0x2013,
    0x2018,
    0x2019,
    0x201c,
    0x2028,
    0x2029,
    0x3000,
    0x200b,
    0x200d,
    0xfeff,
    0xd800,
    0xdbff,
    0xdc00,
    0xdfff,
    0x10400,
    0x10428,
    0x1f600,
    0x0301,
    0x0660,
    0x2167,
    0x00b2,
    0x0e01,
    0x4e2d,
  );
  for (const cp of codes) {
    const name = `a${String.fromCodePoint(cp)}b`;
    const verdict = staffNameVerdict(name);
    const got = checkDoc(changed([[nameAt, name]]));
    const label = `U+${cp.toString(16)}`;
    if (verdict === null) {
      assert.deepEqual(got, { code: 0, lines: [okLine(MINIMAL)] }, label);
    } else {
      const text =
        verdict === "E_FIELD"
          ? MSG.M14
          : cp >= 0xd800 && cp <= 0xdfff
            ? MSG.M37(hexCode(cp))
            : MSG.M12(hexCode(cp));
      assert.deepEqual(
        got,
        { code: 1, lines: [lineOf(FILE, place, verdict, text)] },
        label,
      );
    }
  }
  // roles and replies: 1 to 40 signs
  for (const key of ["role", "says"])
    for (const lang of LANGS) {
      const at = ["look", "team", 1, key, lang];
      const where = `look.team[1].${key}.${lang}`;
      expectRows([[at, "а".repeat(40)]], [], `${where} 40`);
      expectRows(
        [[at, "а".repeat(41)]],
        [[where, "E_LIMIT", MSG.M07(41, 1, 40)]],
        `${where} 41`,
      );
      expectRows(
        [[at, ""]],
        [[where, "E_LIMIT", MSG.M07(0, 1, 40)]],
        `${where} 0`,
      );
    }
});

test("LK-2g: figure and shirt - all 12 figures and all 3 shirts are accepted in every position of the team; other values, of any type, are E_REF with the list of the catalogue in the text", () => {
  for (const i of [0, 1, 2, 3]) {
    for (const figure of FIGURES)
      expectRows(
        [[["look", "team", i, "figure"], figure]],
        [],
        `${i} ${figure}`,
      );
    for (const shirt of SHIRTS)
      expectRows([[["look", "team", i, "shirt"], shirt]], [], `${i} ${shirt}`);
  }
  for (const value of [
    "f00",
    "f13",
    "F01",
    "f1",
    "f001",
    "",
    " f01",
    "f01 ",
    5,
    null,
    {},
    [],
    true,
    ["f01"],
  ])
    expectRows(
      [[["look", "team", 1, "figure"], value]],
      [["look.team[1].figure", "E_REF", MSG.M15]],
      JSON.stringify(value),
    );
  for (const value of [
    "red",
    "Accent",
    "ACCENT",
    "accent3",
    "",
    0,
    null,
    {},
    [],
    false,
    ["ink"],
  ])
    expectRows(
      [[["look", "team", 2, "shirt"], value]],
      [["look.team[2].shirt", "E_REF", MSG.M16]],
      JSON.stringify(value),
    );
  expectSamples([
    "e-figure-f00",
    "e-figure-f13",
    "e-figure-capital",
    "e-shirt-red",
  ]);
  // the text holds the whole list of the catalogue
  assert.equal(MSG.M15.split(", ").length, 12);
  for (const figure of FIGURES) assert.ok(MSG.M15.includes(figure), figure);
});

// ---------------------------------------------------------------------- LK-3

const POSITIONS = [
  ["light", "accent"],
  ["light", "accent2"],
  ["dark", "accent"],
  ["dark", "accent2"],
];
const colorPlace = (theme, accent) => `look.colors.${theme}.${accent}`;
const colorAt = (theme, accent) => ["look", "colors", theme, accent];
const LIMIT_TEXT = { light: MSG.M18, dark: MSG.M19 };

test("LK-3a: the form of a colour - «#» and six lower-case hexadecimal digits; anything else, of any type, is E_FIELD at the place of its position; a missing theme or accent, an extra key and a colour section that is no object are named", () => {
  const BAD = [
    "#E0731F",
    "#fff",
    "e0731f",
    "#e0731g",
    "#e0731f1",
    "#e0731",
    "##e0731f",
    "rgb(1,2,3)",
    "url(x)",
    "",
    " #e0731f",
    "#e0731f ",
    "#e0731f\n",
    "red",
    255,
    null,
    true,
    [],
    {},
    ["#e0731f"],
  ];
  for (const [theme, accent] of POSITIONS)
    for (const value of BAD)
      expectRows(
        [[colorAt(theme, accent), value]],
        [[colorPlace(theme, accent), "E_FIELD", MSG.M17]],
        `${theme}.${accent} ${JSON.stringify(value)}`,
      );
  // «#e0731f» has the right form: in the dark theme it is accepted, in the light theme
  // it is refused by the contrast and not by the form
  expectRows([[colorAt("dark", "accent"), "#e0731f"]], [], "dark accent");
  expectRows([[colorAt("dark", "accent2"), "#e0731f"]], [], "dark accent2");
  expectRows(
    [[colorAt("light", "accent"), "#e0731f"]],
    [[colorPlace("light", "accent"), "E_LIMIT", MSG.M18]],
    "light accent",
  );
  // the structure
  expectRows(
    [[["look", "colors", "dark"], undefined]],
    [["look.colors.dark", "E_FIELD", MSG.M01("dark")]],
    "no dark",
  );
  expectRows(
    [[["look", "colors", "light"], undefined]],
    [["look.colors.light", "E_FIELD", MSG.M01("light")]],
    "no light",
  );
  for (const [theme, accent] of POSITIONS)
    expectRows(
      [[colorAt(theme, accent), undefined]],
      [[colorPlace(theme, accent), "E_FIELD", MSG.M01(accent)]],
      `no ${theme}.${accent}`,
    );
  expectRows(
    [[["look", "colors", "light", "accent3"], "#000000"]],
    [["look.colors.light.accent3", "E_FIELD", MSG.M02("accent3")]],
    "extra in a theme",
  );
  for (const value of ["x", 5, null, [], true])
    expectRows(
      [[["look", "colors"], value]],
      [["look.colors", "E_FIELD", MSG.M03]],
      `colors ${JSON.stringify(value)}`,
    );
  for (const value of ["x", 5, null, [], true])
    expectRows(
      [[["look", "colors", "dark"], value]],
      [["look.colors.dark", "E_FIELD", MSG.M03]],
      `dark ${JSON.stringify(value)}`,
    );
  expectSamples([
    "e-color-upper",
    "e-color-short",
    "e-color-url",
    "e-color-number",
    "e-colors-no-dark",
    "e-colors-no-accent2",
    "e-colors-extra",
  ]);
});

// The closest colours to 3.0 : 1 for each sheet, found by looking over every colour.
let boundary = null;
const boundaries = () => {
  boundary ??= {
    light: boundaryColors(SHEETS.light),
    dark: boundaryColors(SHEETS.dark),
  };
  return boundary;
};

test("LK-3b: the boundary of the contrast on each of the four positions - the colour found by looking over all 16 777 216 colours with the ratio just above 3.0 : 1 is accepted, the one just below is E_LIMIT at that place with the figure 3,0 in the text; the literal pairs of the criterion agree with the independent function", () => {
  const found = boundaries();
  for (const theme of ["light", "dark"]) {
    assert.ok(found[theme].above.ratio >= 3, theme);
    // no colour lies exactly on the boundary: «>= 3.0» and «> 3.0» give one verdict
    assert.ok(found[theme].above.ratio > 3, `${theme}: nothing is exactly 3.0`);
    assert.ok(found[theme].above.ratio - 3 < 1e-6, `${theme} above`);
    assert.ok(found[theme].below.ratio < 3, theme);
    assert.ok(3 - found[theme].below.ratio < 1e-6, `${theme} below`);
    assert.notEqual(found[theme].above.color, found[theme].below.color);
  }
  for (const [theme, accent] of POSITIONS) {
    const label = `${theme}.${accent}`;
    expectRows(
      [[colorAt(theme, accent), found[theme].above.color]],
      [],
      `${label} above ${found[theme].above.color}`,
    );
    const rows = [[colorPlace(theme, accent), "E_LIMIT", LIMIT_TEXT[theme]]];
    expectRows(
      [[colorAt(theme, accent), found[theme].below.color]],
      rows,
      `${label} below ${found[theme].below.color}`,
    );
    assert.ok(LIMIT_TEXT[theme].includes("3,0"));
  }
  // the pairs of the design, by the independent function
  const between = (value, lo, hi) => value >= lo && value < hi;
  assert.ok(between(contrast("#c67d42", SHEETS.light), 3, 3.00001));
  assert.ok(between(contrast("#1999c6", SHEETS.light), 2.99999, 3));
  assert.ok(between(contrast("#76691d", SHEETS.dark), 3, 3.00001));
  assert.ok(between(contrast("#c22c5c", SHEETS.dark), 2.99999, 3));
  assert.equal(contrast("#e0731f", SHEETS.light).toFixed(2), "2.90");
  assert.equal(contrast("#e0731f", SHEETS.dark).toFixed(2), "5.23");
  // the contrast is computed from the colours, not rounded: 2.9999996 is below
  assert.ok(contrast("#1999c6", SHEETS.light) < 3);
});

test("LK-3c: every theme has its own sheet - a light accent that passes the light sheet and fails the dark one is accepted in the light theme and refused in the dark one, and the other way round", () => {
  const onlyLight = "#5b3fd6";
  const onlyDark = "#e0731f";
  assert.ok(contrast(onlyLight, SHEETS.light) >= 3);
  assert.ok(contrast(onlyLight, SHEETS.dark) < 3);
  assert.ok(contrast(onlyDark, SHEETS.dark) >= 3);
  assert.ok(contrast(onlyDark, SHEETS.light) < 3);
  for (const accent of ["accent", "accent2"]) {
    expectRows([[colorAt("light", accent), onlyLight]], [], `light ${accent}`);
    expectRows(
      [[colorAt("dark", accent), onlyLight]],
      [[colorPlace("dark", accent), "E_LIMIT", MSG.M19]],
      `dark ${accent}`,
    );
    expectRows([[colorAt("dark", accent), onlyDark]], [], `dark ${accent}`);
    expectRows(
      [[colorAt("light", accent), onlyDark]],
      [[colorPlace("light", accent), "E_LIMIT", MSG.M18]],
      `light ${accent}`,
    );
  }
  // accent and accent2 are not compared with each other
  expectRows(
    [
      [colorAt("light", "accent"), "#9a4306"],
      [colorAt("light", "accent2"), "#9a4306"],
    ],
    [],
    "equal accents",
  );
});

test("LK-3d: the grid of 4913 colours (channels 00, 10, … f0, ff) on each of the four positions - the verdict of every one equals «contrast not less than 3.0 : 1» by the independent function (19 652 verdicts), both outcomes occur, no grid colour is within 1e-4 of the boundary, and the contrast of the shared module equals the independent one", () => {
  const steps = [...Array(16).keys()].map((i) => i * 16).concat(255);
  const base = minimal3();
  const hex = (n) => n.toString(16).padStart(2, "0");
  const seen = { accepted: 0, refused: 0 };
  let closest = Infinity;
  let verdicts = 0;
  for (const r of steps)
    for (const g of steps)
      for (const b of steps) {
        const color = `#${hex(r)}${hex(g)}${hex(b)}`;
        const doc = changed(
          POSITIONS.map(([theme, accent]) => [colorAt(theme, accent), color]),
          base,
        );
        const issues = validateTenant(deepFreeze(doc), { fileName: FILE });
        const refused = new Map(issues.map((i) => [i.path.join("."), i]));
        assert.equal(refused.size, issues.length, color);
        for (const [theme, accent] of POSITIONS) {
          const ratio = contrast(color, SHEETS[theme]);
          closest = Math.min(closest, Math.abs(ratio - 3));
          const issue = refused.get(colorPlace(theme, accent));
          if (ratio >= 3) {
            assert.equal(issue, undefined, `${color} ${theme}.${accent}`);
            seen.accepted++;
          } else {
            assert.equal(issue?.code, "E_LIMIT", `${color} ${theme}.${accent}`);
            assert.equal(issue.text, LIMIT_TEXT[theme]);
            seen.refused++;
          }
          verdicts++;
          const own = shared.contrastRatio(color, SHEETS[theme]);
          assert.ok(Math.abs(own - ratio) < 1e-9, `${color} ${theme}`);
        }
        assert.equal(issues.length, verdicts === 0 ? 0 : refused.size);
      }
  assert.equal(verdicts, 19652);
  assert.ok(seen.accepted > 1000 && seen.refused > 1000, JSON.stringify(seen));
  assert.ok(closest > 1e-4, `the closest grid ratio is ${closest} from 3.0`);
});

test("LK-3e: the constants of the shared module - the two sheets, the least contrast, the neutral colours (each passes on its own sheet), the closed catalogues and the size of the team equal the literals of the test", () => {
  assert.deepEqual({ ...shared.SHEET }, { light: "#f3f5f9", dark: "#161f2e" });
  assert.deepEqual({ ...shared.SHEET }, SHEETS);
  assert.equal(shared.MIN_CONTRAST, 3);
  assert.equal(shared.TEAM_SIZE, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(shared.NEUTRAL_COLORS)), {
    light: { accent: "#35607f", accent2: "#7a5c2e" },
    dark: { accent: "#8fb4d8", accent2: "#c9b48c" },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(shared.NEUTRAL_COLORS)), NEUTRAL);
  for (const [theme, accent] of POSITIONS) {
    const color = NEUTRAL[theme][accent];
    assert.ok(contrast(color, SHEETS[theme]) > 5, `${theme}.${accent}`);
    assert.ok(contrast(color, SHEETS[theme]) >= 3);
  }
  // the two published constants of the channel threshold (0.04045 and 0.03928) give the
  // same linear value for each of the 256 channel values, so the choice is no rule
  const linear = (c, line) => {
    const s = c / 255;
    return s <= line ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  for (let c = 0; c < 256; c++)
    assert.equal(linear(c, 0.04045), linear(c, 0.03928), `channel ${c}`);
  // the neutral colours are a look that the file check accepts
  const doc = changed(
    POSITIONS.map(([theme, accent]) => [
      colorAt(theme, accent),
      NEUTRAL[theme][accent],
    ]),
  );
  assert.deepEqual(checkDoc(doc), { code: 0, lines: [okLine(MINIMAL)] });
  // the catalogues
  assert.deepEqual([...shared.OBJECT_IDS], OBJECT_IDS);
  assert.deepEqual([...shared.FIGURES], FIGURES);
  assert.deepEqual([...shared.SHIRTS], SHIRTS);
  assert.deepEqual([...shared.GLYPHS], GLYPHS);
  assert.deepEqual(Object.keys(shared.OBJECT_RULES), OBJECT_IDS);
  for (const id of OBJECT_IDS) {
    const rules = shared.OBJECT_RULES[id];
    const want = OBJECT_PARAMS[id];
    assert.deepEqual(
      {
        level: rules.level === null ? null : [...rules.level],
        tag: rules.tag,
        glyph: rules.glyph,
      },
      want,
      id,
    );
  }
  assert.deepEqual(Object.keys(shared).sort(), [
    "FIGURES",
    "GLYPHS",
    "MIN_CONTRAST",
    "NEUTRAL_COLORS",
    "OBJECT_IDS",
    "OBJECT_RULES",
    "SHEET",
    "SHIRTS",
    "TEAM_SIZE",
    "contrastRatio",
    "deskForQuestion",
    "fallbackLook",
    "isColor",
    "isMarkSign",
    "markOf",
  ]);
});

test("LK-3f: the cases of criterion 3 one by one, with the theme, the place and the code written in the test - the pair at 3.0000006 : 1 is accepted, the light accent «#e0731f» is E_LIMIT and not E_FIELD, it is accepted as a dark accent, and the boundary figures of the other three positions", () => {
  const ONE = (theme, accent, value) => [[colorAt(theme, accent), value]];
  // (1) 3.0000006 : 1 with the light sheet
  expectRows(ONE("light", "accent", "#c67d42"), [], "(1) light.accent");
  // (2) «#e0731f» in the light theme: one line, E_LIMIT, the figure 3,0
  const light = checkDoc(changed(ONE("light", "accent", "#e0731f")));
  assert.equal(light.code, 1);
  assert.equal(light.lines.length, 1);
  assert.equal(
    light.lines[0],
    lineOf(FILE, "look.colors.light.accent", "E_LIMIT", MSG.M18),
  );
  assert.ok(light.lines[0].includes("3,0"));
  assert.ok(!light.lines[0].includes("E_FIELD"));
  // (3) «#e0731f» in the dark theme (5.23 : 1): accepted, also after another passing colour
  expectRows(ONE("dark", "accent", "#8fb4d8"), [], "(3) other colour first");
  expectRows(ONE("dark", "accent", "#e0731f"), [], "(3) dark.accent");
  // (4) the same for the second accent and for the dark theme
  expectRows(
    ONE("light", "accent2", "#e0731f"),
    [["look.colors.light.accent2", "E_LIMIT", MSG.M18]],
    "(4) light.accent2",
  );
  expectRows(ONE("light", "accent2", "#c67d42"), [], "(4) light.accent2 ok");
  expectRows(
    ONE("dark", "accent", "#c22c5c"),
    [["look.colors.dark.accent", "E_LIMIT", MSG.M19]],
    "(4) dark.accent",
  );
  expectRows(ONE("dark", "accent", "#76691d"), [], "(4) dark.accent ok");
  expectRows(
    ONE("dark", "accent2", "#c22c5c"),
    [["look.colors.dark.accent2", "E_LIMIT", MSG.M19]],
    "(4) dark.accent2",
  );
  expectRows(ONE("dark", "accent2", "#76691d"), [], "(4) dark.accent2 ok");
  expectRows(
    ONE("light", "accent2", "#1999c6"),
    [["look.colors.light.accent2", "E_LIMIT", MSG.M18]],
    "(4) light.accent2 below",
  );
  // (5) 2.9999996 : 1 with the light sheet
  const below = checkDoc(changed(ONE("light", "accent", "#1999c6")));
  assert.deepEqual(below, {
    code: 1,
    lines: [lineOf(FILE, "look.colors.light.accent", "E_LIMIT", MSG.M18)],
  });
  assert.ok(below.lines[0].includes("3,0"));
  expectSamples(["e-contrast-light", "e-contrast-dark"]);
});

// ---------------------------------------------------------------------- LK-4

const OBJECT_AT = ["questions", 0, "options", 0, "object"];
const OBJECT_PLACE = "questions[0].options[0].object";
const objectEdit = (value) => [[OBJECT_AT, value]];

test("LK-4a: each of the 15 ids of the catalogue is accepted as the object of an option of a `single` question and of a `multiple` question", () => {
  assert.equal(OBJECT_IDS.length, 15);
  for (const id of OBJECT_IDS) {
    expectRows(
      [[["questions", 0, "options", 1, "object"], { id }]],
      [],
      `single ${id}`,
    );
    expectRows(
      [[["questions", 1, "options", 1, "object"], { id }]],
      [],
      `multiple ${id}`,
    );
    expectRows(objectEdit({ id }), [], id);
  }
  assert.equal(lookFixtureJson(MINIMAL).questions[0].type, "single");
  assert.equal(lookFixtureJson(MINIMAL).questions[1].type, "multiple");
});

test("LK-4b: the matrix 15 ids × level, tag and glyph - an allowed parameter with a right value is accepted, out of its range E_LIMIT, a wrong form E_FIELD, a parameter that the id does not allow is E_FIELD at the parameter", () => {
  const LEVELS = [0, 1, 2, 3, 4, 5, 2.5, "1"];
  const TAGS = ["", "A", "1С", "ABCD", "A B", "A BCD", "ab cd"];
  const GLYPH_VALUES = [...GLYPHS, "star"];
  let cases = 0;
  for (const id of OBJECT_IDS) {
    const rule = OBJECT_PARAMS[id];
    for (const level of LEVELS) {
      let rows = [];
      if (rule.level === null)
        rows = [[`${OBJECT_PLACE}.level`, "E_FIELD", MSG.M02("level")]];
      else if (!Number.isInteger(level))
        rows = [[`${OBJECT_PLACE}.level`, "E_FIELD", MSG.M04]];
      else if (level < rule.level[0] || level > rule.level[1])
        rows = [
          [
            `${OBJECT_PLACE}.level`,
            "E_LIMIT",
            MSG.M21(level, rule.level[0], rule.level[1]),
          ],
        ];
      expectRows(
        objectEdit({ id, level }),
        rows,
        `${id} level ${JSON.stringify(level)}`,
      );
      cases++;
    }
    for (const tag of TAGS) {
      let rows = [];
      if (!rule.tag)
        rows = [[`${OBJECT_PLACE}.tag`, "E_FIELD", MSG.M02("tag")]];
      else if (tag === "")
        rows = [[`${OBJECT_PLACE}.tag`, "E_LIMIT", MSG.M07(0, 1, 3)]];
      else if (tag === "ABCD")
        rows = [[`${OBJECT_PLACE}.tag`, "E_LIMIT", MSG.M07(4, 1, 3)]];
      // the count is checked first: too long AND a sign that is no letter or digit
      else if (tag === "A BCD" || tag === "ab cd")
        rows = [[`${OBJECT_PLACE}.tag`, "E_LIMIT", MSG.M07(5, 1, 3)]];
      else if (tag === "A B")
        rows = [[`${OBJECT_PLACE}.tag`, "E_FIELD", MSG.M22]];
      expectRows(
        objectEdit({ id, tag }),
        rows,
        `${id} tag ${JSON.stringify(tag)}`,
      );
      cases++;
    }
    for (const glyph of GLYPH_VALUES) {
      let rows = [];
      if (!rule.glyph)
        rows = [[`${OBJECT_PLACE}.glyph`, "E_FIELD", MSG.M02("glyph")]];
      else if (glyph === "star")
        rows = [[`${OBJECT_PLACE}.glyph`, "E_FIELD", MSG.M23]];
      expectRows(objectEdit({ id, glyph }), rows, `${id} glyph ${glyph}`);
      cases++;
    }
  }
  assert.equal(cases, 15 * (8 + 7 + 5));
  // a tag may hold letters and digits of any alphabet, one to three signs
  for (const tag of ["1С", "5G", "Қ", "٣", "𐐀𐐀𐐀", "abc"])
    expectRows(objectEdit({ id: "monitor", tag }), [], tag);
  for (const tag of ["a-b", "a_", "😀", "ab\n", "áb"])
    assert.ok(
      checkDoc(changed(objectEdit({ id: "cell", tag }))).code === 1,
      JSON.stringify(tag),
    );
  // not allowed parameters together: one line each, in the order of the object
  expectRows(
    objectEdit({ id: "poster", level: 1, tag: "A", glyph: "cap" }),
    [
      [`${OBJECT_PLACE}.level`, "E_FIELD", MSG.M02("level")],
      [`${OBJECT_PLACE}.tag`, "E_FIELD", MSG.M02("tag")],
    ],
    "poster with level and tag",
  );
  // a parameter of a wrong type
  expectRows(
    objectEdit({ id: "monitor", tag: 5 }),
    [[`${OBJECT_PLACE}.tag`, "E_FIELD", MSG.M36]],
    "tag number",
  );
  expectRows(
    objectEdit({ id: "poster", glyph: null }),
    [[`${OBJECT_PLACE}.glyph`, "E_FIELD", MSG.M23]],
    "glyph null",
  );
  expectRows(
    objectEdit({ id: "shelf", level: null }),
    [[`${OBJECT_PLACE}.level`, "E_FIELD", MSG.M04]],
    "level null",
  );
  expectSamples([
    "e-object-level-0",
    "e-object-level-4-shelf",
    "e-object-level-5-boxes",
    "e-object-level-phone",
    "e-object-tag-4",
    "e-object-tag-empty",
    "e-object-tag-space",
    "e-object-tag-poster",
    "e-object-glyph-star",
    "e-object-glyph-monitor",
  ]);
});

test("LK-4c: an id outside the catalogue, of any form, is E_REF at `….object.id` with the whole list in the text; while the id is unknown its parameters are checked for their form only (level 1 to 4) and none is told as not allowed", () => {
  for (const id of [
    "Shelf",
    "pc",
    "",
    "../x",
    "http://x",
    "url(x)",
    "<b>",
    "SHELF",
    " shelf",
    "shelf ",
    "shelf\n",
    5,
    null,
    {},
    [],
    true,
    ["shelf"],
  ])
    expectRows(
      objectEdit({ id }),
      [[`${OBJECT_PLACE}.id`, "E_REF", MSG.M20]],
      JSON.stringify(id),
    );
  for (const id of OBJECT_IDS) assert.ok(MSG.M20.includes(id), id);
  assert.equal(MSG.M20.split(", ").length, 15);
  expectSamples(["e-object-unknown", "e-object-number"]);
  // unknown id: the parameters by their form, the widest range of the catalogue
  const ref = [`${OBJECT_PLACE}.id`, "E_REF", MSG.M20];
  const at = (name) => `${OBJECT_PLACE}.${name}`;
  expectRows(
    objectEdit({ id: "x", level: 1, tag: "A", glyph: "cap" }),
    [ref],
    "all allowed",
  );
  expectRows(objectEdit({ id: "x", level: 4 }), [ref], "level 4");
  expectRows(
    objectEdit({ id: "x", level: 5 }),
    [ref, [at("level"), "E_LIMIT", MSG.M21(5, 1, 4)]],
    "level 5",
  );
  expectRows(
    objectEdit({ id: "x", level: 0 }),
    [ref, [at("level"), "E_LIMIT", MSG.M21(0, 1, 4)]],
    "level 0",
  );
  expectRows(
    objectEdit({ id: "x", level: "2" }),
    [ref, [at("level"), "E_FIELD", MSG.M04]],
    "level text",
  );
  expectRows(
    objectEdit({ id: "x", level: 2.5 }),
    [ref, [at("level"), "E_FIELD", MSG.M04]],
    "level fraction",
  );
  expectRows(
    objectEdit({ id: "x", tag: "ABCD" }),
    [ref, [at("tag"), "E_LIMIT", MSG.M07(4, 1, 3)]],
    "tag 4",
  );
  expectRows(
    objectEdit({ id: "x", tag: "A B" }),
    [ref, [at("tag"), "E_FIELD", MSG.M22]],
    "tag space",
  );
  expectRows(
    objectEdit({ id: "x", glyph: "star" }),
    [ref, [at("glyph"), "E_FIELD", MSG.M23]],
    "glyph star",
  );
  expectRows(
    objectEdit({ id: "x", size: 1 }),
    [ref, [at("size"), "E_FIELD", MSG.M02("size")]],
    "extra field",
  );
});

test("LK-4d: `object` as a string, a list, a number, null or true is E_FIELD «an object is expected»; an extra field, an empty object and an object without id are named; an object may stand on the options of a single and of a multiple question", () => {
  for (const value of ["shelf", [], ["shelf"], 5, null, true])
    expectRows(
      objectEdit(value),
      [[OBJECT_PLACE, "E_FIELD", MSG.M03]],
      JSON.stringify(value),
    );
  expectRows(
    objectEdit({}),
    [[`${OBJECT_PLACE}.id`, "E_FIELD", MSG.M01("id")]],
    "empty",
  );
  expectRows(
    objectEdit({ level: 1 }),
    [[`${OBJECT_PLACE}.id`, "E_FIELD", MSG.M01("id")]],
    "no id",
  );
  expectRows(
    objectEdit({ id: "shelf", size: 3, color: "red" }),
    [
      [`${OBJECT_PLACE}.size`, "E_FIELD", MSG.M02("size")],
      [`${OBJECT_PLACE}.color`, "E_FIELD", MSG.M02("color")],
    ],
    "two extra fields",
  );
  expectRows(objectEdit(undefined), [], "no object at all");
  expectSamples(["e-object-string", "e-object-extra"]);
  // an object on every option of the file
  const doc = minimal3();
  for (const q of doc.questions)
    for (const option of q.options ?? []) option.object = { id: "clip" };
  assert.deepEqual(checkDoc(doc), { code: 0, lines: [okLine(MINIMAL)] });
});

test("LK-4e: the sample holds no address and no code; the string «url(http://x)» is an error in the mark, in a staff name, in an object id and in a colour value, and an ordinary text in tagline, industry, headline, role and says of every language", () => {
  assert.doesNotMatch(
    lookFixtureBytes(MINIMAL).toString("utf8"),
    /https?:\/\/|url[(]|<script|javascript:/u,
  );
  const BAD = "url(http://x)";
  const bad = (edits, place, code) => {
    const got = checkDoc(changed(edits));
    assert.equal(got.code, 1, place);
    assert.ok(
      got.lines.some((l) => l.startsWith(`${FILE}: ${place}: ${code}: `)),
      `${place}: ${got.lines.join(" | ")}`,
    );
  };
  bad([[["look", "mark"], BAD]], "look.mark", "E_LIMIT");
  bad([[["look", "team", 1, "name"], BAD]], "look.team[1].name", "E_FIELD");
  bad(objectEdit({ id: BAD }), `${OBJECT_PLACE}.id`, "E_REF");
  bad([[colorAt("dark", "accent"), BAD]], "look.colors.dark.accent", "E_FIELD");
  bad(
    [[colorAt("light", "accent2"), BAD]],
    "look.colors.light.accent2",
    "E_FIELD",
  );
  bad(
    objectEdit({ id: "monitor", tag: BAD }),
    `${OBJECT_PLACE}.tag`,
    "E_LIMIT",
  );
  bad(
    objectEdit({ id: "poster", glyph: BAD }),
    `${OBJECT_PLACE}.glyph`,
    "E_FIELD",
  );
  bad([[["look", "team", 2, "figure"], BAD]], "look.team[2].figure", "E_REF");
  bad([[["look", "team", 2, "shirt"], BAD]], "look.team[2].shirt", "E_REF");
  const texts = [
    ["look", "tagline"],
    ["look", "industry"],
    ["look", "headline"],
    ["look", "team", 0, "role"],
    ["look", "team", 3, "says"],
  ];
  for (const at of texts)
    for (const lang of LANGS)
      expectRows([[[...at, lang], BAD]], [], `${at.join(".")}.${lang}`);
  expectSamples(["e-staff-name-url"]);
});

test("LK-4f: `options` on a number question is E_FIELD «extra field options» at questions[2].options on each of the three formats (/3, /2, /1), one line each, and the files are not changed", (t) => {
  expectSamples(["e-object-on-number-options"]);
  const dir = makeTmp(t);
  const three = lookFixtureJson("e-object-on-number-options");
  assert.equal(three.schema, "sai-picker-tenant/3");
  assert.equal(three.questions[2].type, "number");
  const two = v2Body();
  two.questions[2].options = [
    { id: "small", label: { ru: "Мало", kk: "Аз", en: "Few" } },
    { id: "large", label: { ru: "Много", kk: "Көп", en: "Many" } },
  ];
  const one = JSON.parse(
    fs.readFileSync(
      path.join(TOOLS, "test", "fixtures", "picker", "ok-minimal.json"),
      "utf8",
    ),
  );
  assert.equal(one.schema, "sai-picker-tenant/1");
  assert.equal(one.questions[2].type, "number");
  one.questions[2].options = [
    { id: "small", label: "Мало" },
    { id: "large", label: "Много" },
  ];
  const want = [
    lineOf(FILE, "questions[2].options", "E_FIELD", MSG.M02("options")),
  ];
  for (const [format, doc] of [
    ["/3", { ...three, id: MINIMAL }],
    ["/2", two],
    ["/1", one],
  ]) {
    const file = put(dir, FILE, JSON.stringify(doc));
    const digest = fileDigest(file);
    const run = runPicker(["check", file]);
    assert.equal(run.code, 1, format);
    assert.deepEqual(run.err, [], format);
    assert.deepEqual(run.out, want, format);
    assert.deepEqual(fileDigest(file), digest, `${format}: the file stays`);
  }
  // and the same files without options are right
  two.questions[2].options = undefined;
  assert.deepEqual(checkDoc(two), { code: 0, lines: [okLine(MINIMAL)] });
});

// ---------------------------------------------------------------------- LK-5

// Desks: a list of values for the four questions; "-" removes the key.
const deskEdits = (list) =>
  list.map((value, i) => [
    ["questions", i, "desk"],
    value === "-" ? undefined : value,
  ]);
const deskPlace = (i) => `questions[${i}].desk`;

test("LK-5a: desks - 0, 5, 2.5, «1» and null have their own line at questions[i].desk; the desk of every question or of none; the first question without a desk gets the one line; order is compared with the nearest earlier valid desk; equal desks are right", () => {
  expectRows(
    deskEdits([0, 2, 3, 4]),
    [[deskPlace(0), "E_LIMIT", MSG.M21(0, 1, 4)]],
    "0",
  );
  expectRows(
    deskEdits([1, 2, 3, 5]),
    [[deskPlace(3), "E_LIMIT", MSG.M21(5, 1, 4)]],
    "5",
  );
  expectRows(deskEdits([1, 4, 4, 4]), [], "4 is the last desk");
  for (const value of [2.5, "1", null, true, [], {}, "x", 1e21])
    expectRows(
      deskEdits([value, 2, 3, 4]),
      [[deskPlace(0), "E_FIELD", MSG.M04]],
      JSON.stringify(value),
    );
  expectSamples([
    "e-desk-0",
    "e-desk-5",
    "e-desk-fraction",
    "e-desk-string",
    "e-desk-empty-value",
    "e-desk-partial",
    "e-desk-order",
    "ok-desk-flat",
  ]);
  // all or none
  expectRows(deskEdits(["-", "-", "-", "-"]), [], "no desk at all");
  expectRows(
    deskEdits([1, 2, "-", 4]),
    [[deskPlace(2), "E_FIELD", MSG.M24]],
    "partial",
  );
  // only the first question without a desk gets the line
  expectRows(
    deskEdits([1, "-", "-", 4]),
    [[deskPlace(1), "E_FIELD", MSG.M24]],
    "1,-,-,4",
  );
  expectRows(
    deskEdits([1, 2, "-", "-"]),
    [[deskPlace(2), "E_FIELD", MSG.M24]],
    "1,2,-,-",
  );
  expectRows(
    deskEdits(["-", "-", "-", 4]),
    [[deskPlace(0), "E_FIELD", MSG.M24]],
    "-,-,-,4",
  );
  // the only desk of the file is a wrong value: a present key counts as a desk
  for (const value of ["x", null])
    expectRows(
      deskEdits(["-", value, "-", "-"]),
      [
        [deskPlace(0), "E_FIELD", MSG.M24],
        [deskPlace(1), "E_FIELD", MSG.M04],
      ],
      JSON.stringify(value),
    );
  // a wrong value before a question without the key: both lines stay, the wrong
  // value does not use up the one line of the first question without a desk
  expectRows(
    deskEdits([1, "x", "-", 4]),
    [
      [deskPlace(1), "E_FIELD", MSG.M04],
      [deskPlace(2), "E_FIELD", MSG.M24],
    ],
    "1,x,-,4",
  );
  expectRows(
    deskEdits([1, null, "-", "-"]),
    [
      [deskPlace(1), "E_FIELD", MSG.M04],
      [deskPlace(2), "E_FIELD", MSG.M24],
    ],
    "1,null,-,-",
  );
  // order
  expectRows(
    deskEdits([1, 2, 1, 2]),
    [[deskPlace(2), "E_ORDER", MSG.M25]],
    "1,2,1,2",
  );
  expectRows(deskEdits([1, 1, 2, 4]), [], "1,1,2,4");
  expectRows(deskEdits([2, 2, 2, 2]), [], "2,2,2,2");
  expectRows(deskEdits([1, 2, 3, 4]), [], "1,2,3,4");
  expectRows(
    deskEdits([4, 3, 2, 1]),
    [
      [deskPlace(1), "E_ORDER", MSG.M25],
      [deskPlace(2), "E_ORDER", MSG.M25],
      [deskPlace(3), "E_ORDER", MSG.M25],
    ],
    "4,3,2,1",
  );
  // 3,1,2,4: the nearest earlier valid desk is the one before, so one line
  expectRows(
    deskEdits([3, 1, 2, 4]),
    [[deskPlace(1), "E_ORDER", MSG.M25]],
    "3,1,2,4",
  );
  // a wrong value does not become the earlier desk
  expectRows(
    deskEdits([3, "x", 2, 4]),
    [
      [deskPlace(1), "E_FIELD", MSG.M04],
      [deskPlace(2), "E_ORDER", MSG.M25],
    ],
    "3,x,2,4",
  );
  expectRows(
    deskEdits([2, 0, 1, 4]),
    [
      [deskPlace(1), "E_LIMIT", MSG.M21(0, 1, 4)],
      [deskPlace(2), "E_ORDER", MSG.M25],
    ],
    "2,0,1,4",
  );
  expectRows(
    deskEdits([4, 5, 4, 4]),
    [[deskPlace(1), "E_LIMIT", MSG.M21(5, 1, 4)]],
    "4,5,4,4",
  );
});

// The number question with its ends and quick numbers; undefined removes the key.
const chipsEdits = (min, max, chips) => [
  [["questions", 2, "min"], min],
  [["questions", 2, "max"], max],
  [["questions", 2, "chips"], chips],
];
const CHIPS = "questions[2].chips";
const chipsLine = (i, code, text) => [`${CHIPS}[${i}]`, code, text];

test("LK-5b: quick numbers - only on a number question, at most 4, whole numbers inside min…max when both ends are valid, no repeat, ascending; the cases of the ends that are missing or wrong print no word «null»; more than four items are still checked; min not less than max is pinned as built", () => {
  expectSamples([
    "e-chips-single",
    "e-chips-5",
    "e-chips-range",
    "e-chips-fraction",
    "e-chips-dup",
    "e-chips-order",
    "ok-chips-edges",
    "ok-chips-empty",
  ]);
  const cases = [];
  const run = (label, edits, rows) => {
    expectRows(edits, rows, label);
    cases.push(label);
  };
  // accepted
  run("empty", chipsEdits(1, 1000, []), []);
  run("one", chipsEdits(1, 1000, [500]), []);
  run("four", chipsEdits(1, 1000, [10, 20, 30, 40]), []);
  run("edges", chipsEdits(1, 1000, [1, 2, 999, 1000]), []);
  run("negative range", chipsEdits(-10, -1, [-10, -5, -1]), []);
  // errors of an item
  run("zero and 1001", chipsEdits(1, 1000, [0, 1001]), [
    chipsLine(0, "E_LIMIT", MSG.M21(0, 1, 1000)),
    chipsLine(1, "E_LIMIT", MSG.M21(1001, 1, 1000)),
  ]);
  run("-5 and 1001", chipsEdits(1, 1000, [-5, 1001]), [
    chipsLine(0, "E_LIMIT", MSG.M21(-5, 1, 1000)),
    chipsLine(1, "E_LIMIT", MSG.M21(1001, 1, 1000)),
  ]);
  run("fraction", chipsEdits(1, 1000, [2.5]), [
    chipsLine(0, "E_FIELD", MSG.M04),
  ]);
  run("text", chipsEdits(1, 1000, ["5"]), [chipsLine(0, "E_FIELD", MSG.M04)]);
  run("null item", chipsEdits(1, 1000, [null]), [
    chipsLine(0, "E_FIELD", MSG.M04),
  ]);
  run("repeat", chipsEdits(1, 1000, [5, 5]), [
    chipsLine(1, "E_DUP", MSG.M27(5)),
  ]);
  run("descending", chipsEdits(1, 1000, [50, 10]), [
    chipsLine(1, "E_ORDER", MSG.M28),
  ]);
  run("repeat and descending", chipsEdits(1, 1000, [10, 50, 10]), [
    chipsLine(2, "E_DUP", MSG.M27(10)),
  ]);
  run("five", chipsEdits(1, 1000, [1, 2, 3, 4, 5]), [
    [CHIPS, "E_LIMIT", MSG.M26(5)],
  ]);
  run("not a list", chipsEdits(1, 1000, 5), [
    [CHIPS, "E_FIELD", "Ожидается список. Исправьте значение."],
  ]);
  // the nearest earlier valid item is the one before, also after a line
  run("order then up", chipsEdits(1, 1000, [10, 50, 20, 30]), [
    chipsLine(2, "E_ORDER", MSG.M28),
  ]);
  run("repeat then lower", chipsEdits(1, 1000, [10, 50, 50, 20]), [
    chipsLine(2, "E_DUP", MSG.M27(50)),
    chipsLine(3, "E_ORDER", MSG.M28),
  ]);
  run("wrong item is no earlier item", chipsEdits(1, 1000, [50, 2000, 20]), [
    chipsLine(1, "E_LIMIT", MSG.M21(2000, 1, 1000)),
    chipsLine(2, "E_ORDER", MSG.M28),
  ]);
  // more than four items are still checked
  run("five with 1001", chipsEdits(1, 1000, [10, 20, 30, 40, 1001]), [
    [CHIPS, "E_LIMIT", MSG.M26(5)],
    chipsLine(4, "E_LIMIT", MSG.M21(1001, 1, 1000)),
  ]);
  run("five with a repeat", chipsEdits(1, 1000, [10, 20, 30, 40, 40]), [
    [CHIPS, "E_LIMIT", MSG.M26(5)],
    chipsLine(4, "E_DUP", MSG.M27(40)),
  ]);
  // the range only when both ends are valid: no chips line and the question's own line
  const NEED_MIN = ["questions[2].min", "E_FIELD", MSG.M01("min")];
  const NEED_MAX = ["questions[2].max", "E_FIELD", MSG.M01("max")];
  run("no min", chipsEdits(undefined, 1000, [-5, 1001]), [NEED_MIN]);
  run("min text", chipsEdits("x", 1000, [-5, 1001]), [
    ["questions[2].min", "E_FIELD", MSG.M04],
  ]);
  run("min null", chipsEdits(null, 1000, [-5, 1001]), [
    ["questions[2].min", "E_FIELD", MSG.M04],
  ]);
  run("min fraction", chipsEdits(2.5, 1000, [-5, 1001]), [
    ["questions[2].min", "E_FIELD", MSG.M04],
  ]);
  run("no max", chipsEdits(1, undefined, [-5, 1001]), [NEED_MAX]);
  run("max text", chipsEdits(1, "y", [-5, 1001]), [
    ["questions[2].max", "E_FIELD", MSG.M04],
  ]);
  run("max fraction", chipsEdits(1, 3.5, [-5, 1001]), [
    ["questions[2].max", "E_FIELD", MSG.M04],
  ]);
  run("neither end", chipsEdits(undefined, undefined, [-5, 1001]), [
    NEED_MIN,
    NEED_MAX,
  ]);
  run("both ends text", chipsEdits("x", "y", [-5, 99999, 2.5]), [
    ["questions[2].min", "E_FIELD", MSG.M04],
    ["questions[2].max", "E_FIELD", MSG.M04],
    chipsLine(2, "E_FIELD", MSG.M04),
  ]);
  run("no min, form only", chipsEdits(undefined, 1000, [2.5]), [
    NEED_MIN,
    chipsLine(0, "E_FIELD", MSG.M04),
  ]);
  // min not less than max (both valid): the question's own line, and each item against
  // the range as written (decisions 0085, item 10)
  const BOUNDS = [
    "questions[2].max",
    "E_LIMIT",
    "Число min должно быть меньше max. Исправьте границы.",
  ];
  run("min above max", chipsEdits(10, 5, [7, 3]), [
    BOUNDS,
    chipsLine(0, "E_LIMIT", MSG.M21(7, 10, 5)),
    chipsLine(1, "E_LIMIT", MSG.M21(3, 10, 5)),
  ]);
  run("min equals max", chipsEdits(5, 5, [5]), [BOUNDS]);
  run("min equals max, other item", chipsEdits(5, 5, [4]), [
    BOUNDS,
    chipsLine(0, "E_LIMIT", MSG.M21(4, 5, 5)),
  ]);
  run("min above max, no chips", chipsEdits(10, 5, undefined), [BOUNDS]);
  // on a single and a multiple question the field is an extra field, at the field
  expectRows(
    [[["questions", 1, "chips"], [10]]],
    [["questions[1].chips", "E_FIELD", MSG.M02("chips")]],
    "multiple",
  );
  expectRows(
    [[["questions", 3, "chips"], "x"]],
    [["questions[3].chips", "E_FIELD", MSG.M02("chips")]],
    "single, wrong value",
  );
  assert.ok(cases.length >= 30);
});

test("LK-5c: contact_fields (1 to 3 of phone, telegram, email), whatsapp (10 to 15 ASCII digits), max_per_hour (1 to 1000) and max_stored (1 to 10000) - the right values, the borders, the errors and the code of each", () => {
  const CONTACT = ["leads", "contact_fields"];
  const CF = "leads.contact_fields";
  for (const list of [
    ["telegram"],
    ["phone"],
    ["email"],
    ["phone", "telegram", "email"],
    ["email", "telegram"],
  ])
    expectRows([[CONTACT, list]], [], JSON.stringify(list));
  expectRows([[CONTACT, []]], [[CF, "E_LIMIT", MSG.M34]], "[]");
  expectRows([[CONTACT, ["sms"]]], [[`${CF}[0]`, "E_FIELD", MSG.M29]], "sms");
  expectRows(
    [[CONTACT, ["phone", "phone"]]],
    [[`${CF}[1]`, "E_DUP", MSG.M30("phone")]],
    "phone twice",
  );
  expectRows(
    [[CONTACT, ["phone", "telegram", "email", "phone"]]],
    [
      [CF, "E_LIMIT", "Элементов: 4, допустимо от 1 до 3. Исправьте список."],
      [`${CF}[3]`, "E_DUP", MSG.M30("phone")],
    ],
    "four items",
  );
  expectRows([[CONTACT, [5]]], [[`${CF}[0]`, "E_FIELD", MSG.M36]], "[5]");
  expectRows(
    [[CONTACT, "phone"]],
    [[CF, "E_FIELD", "Ожидается список. Исправьте значение."]],
    "string",
  );
  expectRows(
    [[CONTACT, ["Telegram"]]],
    [[`${CF}[0]`, "E_FIELD", MSG.M29]],
    "capital",
  );
  expectSamples([
    "ok-contact-telegram",
    "e-contact-empty",
    "e-contact-sms",
    "e-contact-dup",
  ]);
  // whatsapp
  const WA = ["leads", "whatsapp"];
  const WP = "leads.whatsapp";
  for (const number of [
    "7701000000",
    "77010000000",
    "770100000012345",
    "1234567890",
    "0000000000",
  ])
    expectRows([[WA, number]], [], number);
  for (const number of [
    "+77010000000",
    "7701abc0000",
    "7701 000000",
    " 77010000000",
    "77010000000 ",
    "7701000000\n",
    "٧٧٠١٠٠٠٠٠٠٠",
    "７７０１０００００００",
    "7701-000000",
    "(701)0000000",
    "tel:77010000000",
  ])
    expectRows(
      [[WA, number]],
      [[WP, "E_FIELD", MSG.M31]],
      JSON.stringify(number),
    );
  for (const [number, count] of [
    ["", 0],
    ["1", 1],
    ["770100000", 9],
    ["7701000000123456", 16],
    ["7".repeat(40), 40],
  ])
    expectRows(
      [[WA, number]],
      [[WP, "E_LIMIT", MSG.M32(count)]],
      `${count} digits`,
    );
  for (const value of [77010000000, null, true, [], {}])
    expectRows(
      [[WA, value]],
      [[WP, "E_FIELD", MSG.M36]],
      JSON.stringify(value),
    );
  expectSamples([
    "e-wa-plus",
    "e-wa-letters",
    "e-wa-9",
    "e-wa-16",
    "ok-wa-10",
    "ok-wa-15",
  ]);
  // the limits of the lead server
  for (const [key, max, sample] of [
    ["max_per_hour", 1000, ["e-rate-0", "e-rate-1001"]],
    ["max_stored", 10000, ["e-stored-0", "e-stored-10001"]],
  ]) {
    const place = `leads.${key}`;
    for (const value of [1, 2, max - 1, max])
      expectRows([[["leads", key], value]], [], `${key} ${value}`);
    for (const value of [0, -1, max + 1, 1e9])
      expectRows(
        [[["leads", key], value]],
        [[place, "E_LIMIT", MSG.M21(value, 1, max)]],
        `${key} ${value}`,
      );
    for (const value of [2.5, "5", null, true, [], {}])
      expectRows(
        [[["leads", key], value]],
        [[place, "E_FIELD", MSG.M04]],
        `${key} ${JSON.stringify(value)}`,
      );
    expectSamples(sample);
  }
  expectSamples(["ok-limits-edges"]);
  // the three fields are optional
  for (const key of ["whatsapp", "max_per_hour", "max_stored"])
    expectRows([[["leads", key], undefined]], [], `no ${key}`);
});

test("LK-5d: the fields of the form /3 in a file of the form /2 or /1 are E_FIELD - whatsapp, max_per_hour, max_stored, desk, chips, object and the value telegram", (t) => {
  const dir = makeTmp(t);
  const one = JSON.parse(
    fs.readFileSync(
      path.join(TOOLS, "test", "fixtures", "picker", "ok-minimal.json"),
      "utf8",
    ),
  );
  const bodies = [
    ["/2", v2Body(), ["phone", "email"]],
    ["/1", one, ["email"]],
  ];
  for (const [format, body, contacts] of bodies) {
    assert.deepEqual(
      checkDoc(body),
      { code: 0, lines: [okLine(MINIMAL)] },
      format,
    );
    const additions = [
      ["whatsapp", [["leads", "whatsapp"], "77010000000"], "leads.whatsapp"],
      ["max_per_hour", [["leads", "max_per_hour"], 30], "leads.max_per_hour"],
      ["max_stored", [["leads", "max_stored"], 1000], "leads.max_stored"],
      ["desk", [["questions", 0, "desk"], 1], "questions[0].desk"],
      [
        "chips",
        [
          ["questions", 2, "chips"],
          [10, 50],
        ],
        "questions[2].chips",
      ],
      [
        "object",
        [["questions", 0, "options", 0, "object"], { id: "shelf" }],
        "questions[0].options[0].object",
      ],
    ];
    for (const [name, edit, place] of additions) {
      const doc = changed([edit], body);
      const file = put(dir, FILE, JSON.stringify(doc));
      const digest = fileDigest(file);
      const run = runPicker(["check", file]);
      assert.equal(run.code, 1, `${format} ${name}`);
      assert.deepEqual(run.err, [], `${format} ${name}`);
      assert.deepEqual(
        run.out,
        [lineOf(FILE, place, "E_FIELD", MSG.M02(name))],
        `${format} ${name}`,
      );
      assert.deepEqual(
        fileDigest(file),
        digest,
        `${format} ${name}: the file stays`,
      );
    }
    const withTelegram = changed(
      [
        [
          ["leads", "contact_fields"],
          [contacts[0], "telegram"],
        ],
      ],
      body,
    );
    assert.deepEqual(
      checkDoc(withTelegram).lines,
      [lineOf(FILE, "leads.contact_fields[1]", "E_FIELD", MSG.M35)],
      `${format} telegram`,
    );
    const alone = changed([[["leads", "contact_fields"], ["telegram"]]], body);
    assert.deepEqual(
      checkDoc(alone).lines,
      [lineOf(FILE, "leads.contact_fields[0]", "E_FIELD", MSG.M35)],
      `${format} telegram alone`,
    );
    // a third value is too many for the form
    const three = changed(
      [
        [
          ["leads", "contact_fields"],
          ["phone", "email", "telegram"],
        ],
      ],
      body,
    );
    assert.equal(checkDoc(three).code, 1, `${format} three values`);
  }
  expectSamples(["e-v2-with-v3-fields"]);
});

test("LK-5e: the desk rules on a `questions` that is not a list and on entries that are not objects - lines and no exception, through the check in memory and through the command; the file and the folder are not changed", (t) => {
  const dir = makeTmp(t);
  const REFS = [
    [
      "rules[0].when[0].question",
      "E_REF",
      "Вопрос kind не найден. Укажите id вопроса из списка questions.",
    ],
    [
      "rules[1].when[0].question",
      "E_REF",
      "Вопрос count не найден. Укажите id вопроса из списка questions.",
    ],
    [
      "rules[2].when[0].question",
      "E_REF",
      "Вопрос count не найден. Укажите id вопроса из списка questions.",
    ],
    [
      "hypotheses[0].when[0].question",
      "E_REF",
      "Вопрос rush не найден. Укажите id вопроса из списка questions.",
    ],
  ];
  const NOT_LIST = [
    "questions",
    "E_FIELD",
    "Ожидается список. Исправьте значение.",
  ];
  const cases = [];
  for (const value of [5, "x", null, {}, true])
    cases.push([
      `questions is ${JSON.stringify(value)}`,
      [[["questions"], value]],
      [NOT_LIST, ...REFS],
    ]);
  cases.push([
    "questions is absent",
    [[["questions"], undefined]],
    [["questions", "E_FIELD", MSG.M01("questions")], ...REFS],
  ]);
  cases.push([
    "entries that are no objects",
    [[["questions"], [1, "a", null]]],
    [
      ["questions[0]", "E_FIELD", MSG.M03],
      ["questions[1]", "E_FIELD", MSG.M03],
      ["questions[2]", "E_FIELD", MSG.M03],
      ...REFS,
    ],
  ]);
  cases.push([
    "a string is skipped and is not the earlier desk",
    [...deskEdits([1, "-", 3, 2]), [["questions", 1], "x"]],
    [
      ["questions[1]", "E_FIELD", MSG.M03],
      [deskPlace(3), "E_ORDER", MSG.M25],
    ],
  ]);
  cases.push([
    "the first object without a desk gets the line",
    [...deskEdits([1, "-", "-", 4]), [["questions", 1], "x"]],
    [
      ["questions[1]", "E_FIELD", MSG.M03],
      [deskPlace(2), "E_FIELD", MSG.M24],
    ],
  ]);
  cases.push([
    "no object has a desk",
    [...deskEdits(["-", "-", "-", "-"]), [["questions", 1], "x"]],
    [["questions[1]", "E_FIELD", MSG.M03]],
  ]);
  const frozen = [];
  for (const [label, edits, rows] of cases) {
    const doc = changed(edits);
    // in memory, on a frozen copy: the check must not change its input
    frozen.push(deepFreeze(structuredClone(doc)));
    const issues = validateTenant(frozen.at(-1), { fileName: FILE });
    assert.equal(issues.length, rows.length, label);
    expectRows(edits, rows, label);
    // through the command
    const file = put(dir, FILE, JSON.stringify(doc));
    const digest = fileDigest(file);
    const run = runPicker(["check", file]);
    assert.equal(run.code, 1, label);
    assert.deepEqual(run.err, [], label);
    assert.deepEqual(
      run.out,
      rows.map(([p, c, text]) => lineOf(FILE, p, c, text)),
      label,
    );
    assert.equal(
      run.out.some((l) => /^ {4}at /u.test(l)),
      false,
      label,
    );
    assert.deepEqual(fileDigest(file), digest, `${label}: the file stays`);
  }
});

// ---------------------------------------------------------------------- LK-6

const asLetterOrHash = (name) => {
  const mark = shared.markOf(name);
  return mark === "#" || isLetterOrDigit(mark);
};

test("LK-6a: the fallback mark - the names of the criterion give У, A, 7, #, ß, ŉ and 𐐀 (U+10400); empty names, spaces and a Roman numeral first; and a property over 2000 names from a pinned seed against the independent oracle", () => {
  const TABLE = [
    ["Учёт-Про", "У"],
    ["ab", "A"],
    ["7 звёзд", "7"],
    ["«»", "#"],
    ["ßета", "ß"],
    ["ŉ-центр", "ŉ"],
    ["𐐨 лаб", "𐐀"],
    ["", "#"],
    ["  ", "#"],
    ["Ⅷ Studio", "S"],
    ["--- 2", "2"],
    ["😀 Кафе", "К"],
    ["ǆ", "Ǆ"],
    ["٣ звезды", "٣"],
    ["\ud800 Ақ", "А"],
  ];
  for (const [name, mark] of TABLE) {
    assert.equal(shared.markOf(name), mark, JSON.stringify(name));
    assert.equal(
      expectedFallback(name).mark,
      mark,
      `oracle ${JSON.stringify(name)}`,
    );
  }
  for (const value of [undefined, null, 5, {}, [], true])
    assert.equal(shared.markOf(value), "#", JSON.stringify(value));
  // the property: letters, digits, signs, pairs, lone halves
  const rng = makeRng(0x069a);
  const pool = [
    ..."abcxyzABCXYZ",
    ..."уцкенгшщзхъфывапролджэячсмитьбю",
    ..."ӘәҒғҚқҢңӨөҰұҮүҺһІі",
    ..."0123456789٣٤",
    ..."ßŉǆǅǈǋ",
    "𐐨",
    "𐐀",
    "́",
    "​",
    " ",
    "-",
    "«",
    "»",
    ".",
    "😀",
    "\ud800",
    "\udc00",
    "Ⅷ",
    "²",
    "_",
  ];
  const marks = new Set();
  for (let i = 0; i < 2000; i++) {
    const length = rng.int(8);
    let name = "";
    for (let k = 0; k < length; k++) name += rng.pick(pool);
    const mark = shared.markOf(name);
    assert.equal(asLetterOrHash(name), true, JSON.stringify(name));
    assert.equal(mark, expectedFallback(name).mark, JSON.stringify(name));
    marks.add(mark);
    // a fallback mark that is not «#» passes the rule of the file
    if (mark !== "#" && marks.size < 40)
      expectRows(
        [[["look", "mark"], mark]],
        [],
        `file rule ${JSON.stringify(mark)}`,
      );
  }
  assert.ok(marks.size > 20);
  assert.ok(marks.has("#"));
});

test("LK-6b: fallbackLook for «Учёт-Про» - the exact object of design 8 (the name as headline, the neutral colours, four staff with no name, role and reply, figures f01 to f04, shirts accent, accent2, ink, accent); the keys of every level are those of the look and in their order", () => {
  const got = shared.fallbackLook("Учёт-Про");
  assert.deepEqual(got, {
    mark: "У",
    tagline: null,
    industry: null,
    headline: "Учёт-Про",
    colors: {
      light: { accent: "#35607f", accent2: "#7a5c2e" },
      dark: { accent: "#8fb4d8", accent2: "#c9b48c" },
    },
    team: [
      { name: null, role: null, says: null, figure: "f01", shirt: "accent" },
      { name: null, role: null, says: null, figure: "f02", shirt: "accent2" },
      { name: null, role: null, says: null, figure: "f03", shirt: "ink" },
      { name: null, role: null, says: null, figure: "f04", shirt: "accent" },
    ],
  });
  assert.deepEqual(got, expectedFallback("Учёт-Про"));
  assert.deepEqual(Object.keys(got), [
    "mark",
    "tagline",
    "industry",
    "headline",
    "colors",
    "team",
  ]);
  assert.deepEqual(Object.keys(got.colors), ["light", "dark"]);
  assert.deepEqual(Object.keys(got.colors.light), ["accent", "accent2"]);
  assert.deepEqual(Object.keys(got.colors.dark), ["accent", "accent2"]);
  assert.equal(got.team.length, 4);
  for (const member of got.team)
    assert.deepEqual(Object.keys(member), [
      "name",
      "role",
      "says",
      "figure",
      "shirt",
    ]);
  // the same shape for the shape of the look of a file (the keys of 7.2)
  assert.deepEqual(
    Object.keys(got),
    Object.keys(lookFixtureJson(MINIMAL).look),
  );
  // the colours of the fallback pass the rule of the file
  for (const [theme, accent] of POSITIONS)
    assert.ok(contrast(got.colors[theme][accent], SHEETS[theme]) >= 3);
});

test("LK-6c: the text of the shared module - none of import, require, node: and process (not even inside a word), no key of the texts of the site (the search of the criterion; it bites on «scene_desk_1» and not on «null»), no such string in the result of the fallback look, and the module loads in a fresh process with no side effect", () => {
  const file = path.join(PICKER, "public", "tenant-look.js");
  const text = fs.readFileSync(file, "utf8");
  for (const word of ["import", "require", "node:", "process"])
    assert.equal(text.includes(word), false, word);
  // the search of the criterion
  const SEARCH =
    /(^|[^A-Za-z0-9_$])(lead_|flow_|receipt_|progress_|panel_|quiz_|scene_|shell_|start_|act_)/u;
  const lines = text.split("\n");
  assert.deepEqual(
    lines.map((l, i) => [i + 1, l]).filter(([, l]) => SEARCH.test(l)),
    [],
  );
  assert.equal(SEARCH.test('role: "scene_desk_1"'), true);
  assert.equal(SEARCH.test("role: null"), false);
  assert.equal(SEARCH.test("exact_x"), false);
  // the strings of the result
  const strings = [];
  const walk = (value) => {
    if (typeof value === "string") strings.push(value);
    else if (value !== null && typeof value === "object")
      for (const key of Object.keys(value)) {
        strings.push(key);
        walk(value[key]);
      }
  };
  walk(shared.fallbackLook("Учёт-Про"));
  assert.ok(strings.length > 20);
  for (const s of strings) assert.equal(SEARCH.test(s), false, s);
  // no statement runs at load: every line at the left edge opens a declaration or a comment
  for (const line of lines) {
    if (line === "" || /^\s/u.test(line)) continue;
    assert.match(line, /^(\/\/|export |function |const |\}|\)|\])/u, line);
  }
  // loaded in a fresh process: no output, no new global name
  const script = `
    const before = Object.getOwnPropertyNames(globalThis).sort();
    const m = await import(${JSON.stringify(pathToFileURL(file).href)});
    const after = Object.getOwnPropertyNames(globalThis).sort();
    process.stdout.write(JSON.stringify({ same: before.join() === after.join(), n: Object.keys(m).length }));
  `;
  const out = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(out.status, 0);
  assert.equal(out.stderr, "");
  assert.deepEqual(JSON.parse(out.stdout), { same: true, n: 15 });
});

test("LK-6d: deskForQuestion - the tables of the criterion (N=1, 5, 12) and of the design (N=2, 3, 4) as literals; for N from 1 to 40 the sequence never decreases, starts at 1, ends at floor((N−1)×4/N)+1 and never passes 4, and for N from 4 uses all four desks; a wrong argument gives an integer from 1 to 4", () => {
  const seq = (n) =>
    Array.from({ length: n }, (_, i) => shared.deskForQuestion(i, n));
  assert.deepEqual(seq(1), [1]);
  assert.deepEqual(seq(2), [1, 3]);
  assert.deepEqual(seq(3), [1, 2, 3]);
  assert.deepEqual(seq(4), [1, 2, 3, 4]);
  assert.deepEqual(seq(5), [1, 1, 2, 3, 4]);
  assert.deepEqual(seq(12), [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
  for (let n = 1; n <= 40; n++) {
    const s = seq(n);
    assert.equal(s[0], 1, `N=${n}`);
    assert.equal(s.at(-1), Math.floor(((n - 1) * 4) / n) + 1, `N=${n}`);
    for (let i = 0; i < n; i++) {
      assert.ok(s[i] >= 1 && s[i] <= 4, `N=${n} i=${i}`);
      assert.equal(s[i], Math.floor((i * 4) / n) + 1, `N=${n} i=${i}`);
      if (i > 0) assert.ok(s[i] >= s[i - 1], `N=${n} i=${i}`);
    }
    if (n >= 4) assert.deepEqual([...new Set(s)], [1, 2, 3, 4], `N=${n}`);
  }
  for (const [index, total] of [
    [-1, 5],
    [5, 5],
    [99, 5],
    [2.5, 5],
    [Number.NaN, 5],
    ["1", 5],
    [null, 5],
    [undefined, undefined],
    [0, 0],
    [0, -3],
    [3, 2.5],
    [3, Number.NaN],
    ["x", null],
    [Infinity, 10],
    [1, Infinity],
  ]) {
    const value = shared.deskForQuestion(index, total);
    assert.ok(
      Number.isInteger(value) && value >= 1 && value <= 4,
      `${String(index)} ${String(total)}`,
    );
  }
  // an index out of range is moved into it
  assert.equal(shared.deskForQuestion(-1, 12), 1);
  assert.equal(shared.deskForQuestion(12, 12), 4);
  assert.equal(shared.deskForQuestion(0, 0), 1);
});

const deepFrozen = (value) =>
  value === null ||
  typeof value !== "object" ||
  (Object.isFrozen(value) && Object.values(value).every(deepFrozen));

test("LK-6e: purity - two calls of fallbackLook give equal objects that are not the same; changing one result changes nothing in the next; every exported constant is deeply frozen and a change throws; wrong arguments give a value and never throw", () => {
  const a = shared.fallbackLook("Учёт-Про");
  const b = shared.fallbackLook("Учёт-Про");
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
  assert.notEqual(a.colors, b.colors);
  assert.notEqual(a.team, b.team);
  assert.notEqual(a.team[0], b.team[0]);
  assert.notEqual(a.colors.light, shared.NEUTRAL_COLORS.light);
  a.mark = "X";
  a.colors.light.accent = "#000000";
  a.team[0].figure = "f99";
  a.team.pop();
  const c = shared.fallbackLook("Учёт-Про");
  assert.deepEqual(c, b);
  assert.deepEqual(shared.NEUTRAL_COLORS.light, NEUTRAL.light);
  assert.deepEqual(shared.fallbackLook("Другой"), expectedFallback("Другой"));
  // the constants
  for (const name of [
    "OBJECT_IDS",
    "OBJECT_RULES",
    "GLYPHS",
    "FIGURES",
    "SHIRTS",
    "SHEET",
    "NEUTRAL_COLORS",
  ]) {
    assert.equal(deepFrozen(shared[name]), true, name);
    assert.throws(
      () => {
        if (Array.isArray(shared[name])) shared[name].push("x");
        else shared[name].extra = 1;
      },
      TypeError,
      name,
    );
  }
  assert.throws(() => {
    shared.SHEET.light = "#000000";
  }, TypeError);
  assert.throws(() => {
    shared.NEUTRAL_COLORS.dark.accent = "#000000";
  }, TypeError);
  assert.throws(() => {
    shared.OBJECT_RULES.shelf.level[0] = 0;
  }, TypeError);
  assert.equal(shared.SHEET.light, "#f3f5f9");
  // wrong arguments
  for (const value of [undefined, null, 5, {}, [], true, () => 1]) {
    const look = shared.fallbackLook(value);
    assert.equal(look.headline, "", String(value));
    assert.equal(look.mark, "#", String(value));
    assert.equal(look.team.length, 4);
  }
  assert.equal(shared.contrastRatio("red", "blue"), Number.NaN);
  assert.ok(Number.isNaN(shared.contrastRatio("red", "#000000")));
  assert.ok(Number.isNaN(shared.contrastRatio("#000000", 5)));
  assert.ok(Number.isNaN(shared.contrastRatio(undefined, undefined)));
  assert.equal(shared.contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(shared.contrastRatio("#ffffff", "#ffffff"), 1);
  assert.equal(shared.isColor("#e0731f"), true);
  for (const value of [
    "#E0731F",
    "#fff",
    5,
    null,
    undefined,
    {},
    "#e0731g",
    "#e0731f\n",
  ])
    assert.equal(shared.isColor(value), false, String(value));
  for (const ch of ["a", "Я", "٣", "𐐀"])
    assert.equal(shared.isMarkSign(ch), true, ch);
  for (const ch of ["", "ab", " ", "²", "Ⅷ", "\ud800", 5, null, undefined, "Á"])
    assert.equal(shared.isMarkSign(ch), false, String(ch));
});

// ---------------------------------------------------------------------- LK-7

const COVER = {
  M01: MSG.M01("look"),
  M02: MSG.M02("logo"),
  M03: MSG.M03,
  M04: MSG.M04,
  M05: MSG.M05(2),
  M06: MSG.M06,
  M07: MSG.M07(41, 1, 40),
  M08: MSG.M08("kk"),
  M09: MSG.M09,
  M10: MSG.M10(19),
  M11: MSG.M11,
  M12: MSG.M12("U+0007"),
  M13: MSG.M13(3, 4),
  M14: MSG.M14,
  M15: MSG.M15,
  M16: MSG.M16,
  M17: MSG.M17,
  M18: MSG.M18,
  M19: MSG.M19,
  M20: MSG.M20,
  M21: MSG.M21(0, 1, 3),
  M22: MSG.M22,
  M23: MSG.M23,
  M24: MSG.M24,
  M25: MSG.M25,
  M26: MSG.M26(5),
  M27: MSG.M27(5),
  M28: MSG.M28,
  M29: MSG.M29,
  M30: MSG.M30("phone"),
  M31: MSG.M31,
  M32: MSG.M32(9),
  M33: MSG.M33,
  M34: MSG.M34,
  M35: MSG.M35,
  M36: MSG.M36,
  M37: MSG.M37("U+D800"),
};

test("LK-7a: every output line of the 78 error samples has the shape of the lines (a place without spaces, a code of the ten, at most 18 words in the whole message, ends with a dot, no «ты», no words of a parser); each of the 37 messages of the catalogue is produced by some sample and equals its text; no sample is changed by the check", () => {
  assert.deepEqual(MESSAGE_IDS, Object.keys(COVER));
  assert.equal(MESSAGE_IDS.length, 37);
  const produced = new Set();
  let errorSamples = 0;
  for (const name of SAMPLE_NAMES) {
    const want = LOOK_EXPECTED[name];
    if (want.code === 0) continue;
    errorSamples++;
    const bytes = lookFixtureBytes(name);
    const before = sha256(bytes);
    const out = sampleOutput(name);
    assert.deepEqual(out, want, name);
    assert.deepEqual(lineProblems(out.lines), [], name);
    for (const line of out.lines)
      produced.add(line.split(": ").slice(3).join(": "));
    assert.equal(sha256(lookFixtureBytes(name)), before, name);
  }
  assert.equal(errorSamples, 78);
  // the messages that no sample holds come from small files in memory
  const extra = [
    changed([[["look", "mark"], 5]]),
    { ...minimal3(), schema: "sai-picker-tenant/4" },
  ];
  for (const doc of extra)
    for (const line of checkDoc(doc).lines)
      produced.add(line.split(": ").slice(3).join(": "));
  for (const [id, text] of Object.entries(COVER)) {
    assert.ok(produced.has(text), `${id}: no line has the text «${text}»`);
    assert.deepEqual(
      lineProblems([`x.json: place: E_FIELD: ${text}`]),
      [],
      `${id}: shape`,
    );
  }
  // the whole list of words of a message: at most 18
  for (const text of Object.values(COVER))
    assert.ok(
      text.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w)).length <= 18,
      text,
    );
});

test("LK-7b: the command only reads - for a sample of each kind (accepted, an error of the section, an error of the old kind, a file of the form /2, of the form /1, a bad JSON) the digest of the file and the listing of its folder are the same before and after, and stderr is empty", (t) => {
  const dir = makeTmp(t);
  const legacy = fs.readFileSync(
    path.join(TOOLS, "test", "fixtures", "picker", "ok-minimal.json"),
  );
  const files = [
    ["ok-minimal.json", lookFixtureBytes(MINIMAL), 0],
    ["e-look-missing.json", lookFixtureBytes("e-look-missing"), 1],
    ["e-wa-plus.json", lookFixtureBytes("e-wa-plus"), 1],
    ["e-v2-with-look.json", lookFixtureBytes("e-v2-with-look"), 1],
    ["legacy.json", legacy, 1],
    [
      "broken.json",
      Buffer.from('{"schema": "sai-picker-tenant/3",', "utf8"),
      1,
    ],
  ];
  for (const [name, bytes] of files) put(dir, name, bytes);
  const digests = files.map(([name]) => fileDigest(path.join(dir, name)));
  const listing = fs.readdirSync(dir).sort();
  files.forEach(([name, , code]) => {
    const run = runPicker(["check", path.join(dir, name)]);
    assert.equal(run.code, code, name);
    assert.deepEqual(run.err, [], name);
  });
  files.forEach(([name], i) => {
    assert.deepEqual(fileDigest(path.join(dir, name)), digests[i], name);
  });
  assert.deepEqual(fs.readdirSync(dir).sort(), listing);
});
