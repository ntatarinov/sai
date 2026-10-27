// LG-1 ... LG-4, LG-7, LG-10, LG-R1 ... LG-R4: the three languages of the picker site
// (design docs/design/REQ-061-picker-languages.md, section 13): the file of the form /2,
// the check of the translation, the choice of the language, the fictional tenants in three
// languages, files that stand apart. The expectations are literals or come from the
// oracles of picker-lang-helpers.js, which share nothing with src/.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkBytes, checkFile } from "../src/picker/check.js";
import { computeResult, visibleQuestions } from "../src/picker/engine.js";
import { isFormatV2 } from "../src/picker/lang-check.js";
import { chooseLanguage } from "../src/picker/public/texts.js";
import { validateTenant } from "../src/picker/validate.js";
import { fileLanguages, tenantInLanguage } from "../src/picker/view.js";
import { deepCopy, deepFreeze, demoAnswers } from "./picker-engine-helpers.js";
import {
  DEMO_ANSWERS,
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
  FIELD_PLACES,
  LANGS,
  LANGUAGE_ROWS,
  LANG_EXPECTED,
  LANG_FIXTURES,
  LANG_SAMPLE_NAMES,
  MESSAGES,
  PLACE_KINDS,
  deleteAt,
  getAt,
  langFixtureBytes,
  langFixtureJson,
  langFixtureNames,
  numbersOf,
  phrases,
  placeText,
  readJson,
  rowInput,
  setAt,
  skeleton,
  textPlaces,
  words,
  TEXTS_MODULE_FORBIDDEN,
  scanTextsModule,
} from "./picker-lang-helpers.js";

const IDS = ["uchet-pro", "svet-marketing"];
const V2 = "sai-picker-tenant/2";
const V1 = "sai-picker-tenant/1";
const demoPath = (id) => path.join(DEMO_TENANTS, `${id}.json`);
const legacyPath = (id) => path.join(LEGACY_TENANTS, `${id}.json`);
const SIZES = { "uchet-pro": [12, 5, 39], "svet-marketing": [11, 5, 37] };
const COUNTS = { "uchet-pro": 152, "svet-marketing": 145 };
const MINIMAL = "ok-lang-minimal.json";
const sha256 = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const minimal = () => langFixtureJson(MINIMAL);
// The check of an object as a file with the given name.
const checkObject = (value, name = MINIMAL) =>
  checkBytes(Buffer.from(JSON.stringify(value), "utf8"), name);
const lineOf = (name, place, code, text) =>
  `${name}: ${place}: ${code}: ${text}`;
const NEED = MESSAGES.NEED;

// ---------------------------------------------------------------------- LG-1

test("LG-1a: both fictional tenants in the form /2 pass the check through npm and directly - code 0, stderr empty, one line with the counts of the arrays of the file (12/5/39 and 11/5/37)", () => {
  for (const id of IDS) {
    const tenant = readJson(demoPath(id));
    assert.equal(tenant.schema, V2, id);
    const counts = [
      tenant.questions.length,
      tenant.solutions.length,
      tenant.rules.length,
    ];
    assert.deepEqual(counts, SIZES[id], id);
    const want = `Файл арендатора ${id} в порядке: вопросов ${counts[0]}, решений ${counts[1]}, правил ${counts[2]}.`;
    const rel = path.join("src", "picker", "demo-tenants", `${id}.json`);
    for (const viaNpm of [true, false]) {
      const run = runPicker(["check", rel], { cwd: TOOLS, viaNpm });
      assert.equal(run.code, 0, `${id} npm=${viaNpm}`);
      assert.deepEqual(run.err, [], `${id} npm=${viaNpm}`);
      assert.deepEqual(run.out, [want], `${id} npm=${viaNpm}`);
    }
  }
});

test("LG-1b: the copies of the form /1 pass the check as before - code 0, one line, the same counts", () => {
  for (const id of IDS) {
    const tenant = readJson(legacyPath(id));
    assert.equal(tenant.schema, V1, id);
    const counts = [
      tenant.questions.length,
      tenant.solutions.length,
      tenant.rules.length,
    ];
    assert.deepEqual(counts, SIZES[id], id);
    const rel = path.join("test", "fixtures", "picker-legacy", `${id}.json`);
    for (const viaNpm of [true, false]) {
      const run = runPicker(["check", rel], { cwd: TOOLS, viaNpm });
      assert.equal(run.code, 0, `${id} npm=${viaNpm}`);
      assert.deepEqual(run.err, [], `${id} npm=${viaNpm}`);
      assert.deepEqual(
        run.out,
        [
          `Файл арендатора ${id} в порядке: вопросов ${counts[0]}, решений ${counts[1]}, правил ${counts[2]}.`,
        ],
        `${id} npm=${viaNpm}`,
      );
    }
  }
});

const SCHEMA_LINE =
  "Допустимо только: sai-picker-tenant/1, sai-picker-tenant/2 или sai-picker-tenant/3. Исправьте значение.";

test("LG-1c: a file with a value of schema that is none of /1, /2 and /3 gives code 1 and exactly one line about schema; a number or null - 'a string is expected'; no schema - 'no field schema'; the mode /2 is not taken by the beginning of the string, by the case or by spaces", (t) => {
  const dir = makeTmp(t);
  const id = "uchet-pro";
  const wrong = [
    "sai-picker-tenant/4",
    "sai-picker-tenant/3 ",
    "SAI-PICKER-TENANT/3",
    "sai-picker-tenant/",
    "sai-picker-tenant/20",
    "sai-picker-tenant/2 ",
    " sai-picker-tenant/2",
    "SAI-PICKER-TENANT/2",
    "sai-picker-tenant/12",
    "",
  ];
  const base = readJson(legacyPath(id));
  const want = (text) => [lineOf(`${id}.json`, "schema", "E_FIELD", text)];
  for (const value of wrong) {
    const copy = { ...base, schema: value };
    const file = put(dir, `${id}.json`, JSON.stringify(copy));
    const before = fileDigest(file);
    const run = runPicker(["check", file]);
    assert.equal(run.code, 1, JSON.stringify(value));
    assert.deepEqual(run.out, want(SCHEMA_LINE), JSON.stringify(value));
    assert.deepEqual(run.err, [], JSON.stringify(value));
    assert.deepEqual(fileDigest(file), before, "the file stays");
  }
  for (const value of [2, null, true, ["sai-picker-tenant/2"], {}]) {
    const out = checkObject({ ...base, schema: value }, `${id}.json`);
    assert.equal(out.exitCode, 1, JSON.stringify(value));
    assert.deepEqual(
      out.stdout,
      want("Ожидается строка. Исправьте значение."),
      JSON.stringify(value),
    );
  }
  const gone = { ...base };
  delete gone.schema;
  const out = checkObject(gone, `${id}.json`);
  assert.equal(out.exitCode, 1);
  assert.deepEqual(out.stdout, want("Нет поля schema. Добавьте его."));
  // the right values are right
  for (const value of [V1, V2]) {
    const copy = value === V1 ? base : readJson(demoPath(id));
    assert.equal(checkObject(copy, `${id}.json`).exitCode, 0, value);
  }
});

test("LG-1c2: a wrong schema on a body of the form /2 - code 1, the first line is about schema (the value is told before any text), the rest is the reading as /1: 'a string is expected' at every text of three languages", () => {
  const body = minimal();
  const places = textPlaces(body);
  const asString = "Ожидается строка. Исправьте значение.";
  const want = (text) => lineOf(MINIMAL, "schema", "E_FIELD", text);
  const values = [
    ["sai-picker-tenant/4", SCHEMA_LINE],
    ["sai-picker-tenant/", SCHEMA_LINE],
    ["sai-picker-tenant/20", SCHEMA_LINE],
    ["sai-picker-tenant/2 ", SCHEMA_LINE],
    ["SAI-PICKER-TENANT/2", SCHEMA_LINE],
    ["", SCHEMA_LINE],
    [2, asString],
    [null, asString],
    [["sai-picker-tenant/2"], asString],
  ];
  for (const [value, text] of values) {
    const out = checkObject({ ...body, schema: value });
    const label = JSON.stringify(value);
    assert.equal(out.exitCode, 1, label);
    assert.equal(out.stdout[0], want(text), label);
    assert.equal(out.stdout.length, 1 + places.length, label);
    for (const [i, p] of places.entries()) {
      assert.equal(
        out.stdout[i + 1],
        lineOf(MINIMAL, placeText(p.path), "E_FIELD", asString),
        `${label} ${placeText(p.path)}`,
      );
    }
    assert.deepEqual(lineProblems(out.stdout), [], label);
  }
  // no schema at all
  const gone = { ...body };
  delete gone.schema;
  const out = checkObject(gone);
  assert.equal(out.stdout[0], want("Нет поля schema. Добавьте его."));
  assert.equal(out.stdout.length, 1 + places.length);
  // the same with the demo file of a tenant
  const demo = {
    ...readJson(demoPath("uchet-pro")),
    schema: "sai-picker-tenant/4",
  };
  const many = checkObject(demo, "uchet-pro.json");
  assert.equal(many.exitCode, 1);
  assert.equal(
    many.stdout[0],
    lineOf("uchet-pro.json", "schema", "E_FIELD", SCHEMA_LINE),
  );
  // an object in place of name does not hide the line about schema
  const objectName = { ...body, schema: "sai-picker-tenant/4" };
  assert.equal(
    checkObject(objectName).stdout[0],
    want(SCHEMA_LINE),
    "name is an object",
  );
});

test("LG-1d: the versions are not mixed - a /2 file with schema /1 reads texts as strings (first line: name), a /1 file with schema /2 reads texts as objects", () => {
  const id = "uchet-pro";
  const v2WithV1 = { ...readJson(demoPath(id)), schema: V1 };
  const a = checkObject(v2WithV1, `${id}.json`);
  assert.equal(a.exitCode, 1);
  assert.equal(
    a.stdout[0],
    lineOf(
      `${id}.json`,
      "name",
      "E_FIELD",
      "Ожидается строка. Исправьте значение.",
    ),
  );
  assert.deepEqual(lineProblems(a.stdout), []);
  const v1WithV2 = { ...readJson(legacyPath(id)), schema: V2 };
  const b = checkObject(v1WithV2, `${id}.json`);
  assert.equal(b.exitCode, 1);
  assert.equal(b.stdout[0], lineOf(`${id}.json`, "name", "E_FIELD", NEED));
  assert.deepEqual(lineProblems(b.stdout), []);
});

test("LG-1e: the copies of the form /1 and the answers of the demo are the bytes of the base - the sums are literals", () => {
  const sums = {
    [legacyPath("uchet-pro")]:
      "2f6c3437c379372b4c761571f62d50c0a58905251b4e04f199ff5391090f41eb",
    [legacyPath("svet-marketing")]:
      "46d3a5199701649e2ee2aa3bb0d0fb2af8e809c0c22e8feb1a792791d27148c1",
    [path.join(DEMO_ANSWERS, "uchet-pro.json")]:
      "c412d3987caa0524b223152fa465321e5de71f382444460d1d13b3ed4a2b068e",
    [path.join(DEMO_ANSWERS, "svet-marketing.json")]:
      "8d3be981bde3dfcb49ff44570461c68a1272092f6b68cd09646d9474b9d95393",
  };
  for (const [file, sum] of Object.entries(sums))
    assert.equal(sha256(file), sum, path.basename(file));
  assert.deepEqual(fs.readdirSync(LEGACY_TENANTS).sort(), [
    "svet-marketing.json",
    "uchet-pro.json",
  ]);
});

test("LG-1f: the view of the /2 file in ru is the /1 copy (every string, number and key in its order) and keeps schema /2; the views in kk and en have the same skeleton", () => {
  for (const id of IDS) {
    const legacy = readJson(legacyPath(id));
    const withV2 = { ...legacy, schema: V2 };
    for (const [form, v2] of [
      ["plain", readJson(demoPath(id))],
      ["no prototype", checkFile(demoPath(id)).tenant],
    ]) {
      const ru = tenantInLanguage(v2, "ru");
      assert.equal(ru.schema, V2, `${id} ${form}: schema stays /2`);
      assert.equal(JSON.stringify(ru), JSON.stringify(withV2), `${id} ${form}`);
      if (form === "plain") assert.deepStrictEqual(ru, withV2, id);
      const { schema: ignored, ...rest } = ru;
      const { schema: other, ...restLegacy } = legacy;
      assert.equal(ignored, V2);
      assert.equal(other, V1);
      assert.equal(JSON.stringify(rest), JSON.stringify(restLegacy), id);
      for (const language of ["kk", "en"]) {
        const view = tenantInLanguage(v2, language);
        assert.equal(
          JSON.stringify(skeleton(view)),
          JSON.stringify(skeleton(withV2)),
          `${id} ${form} ${language}`,
        );
        // every text is a string of the file in that language
        const places = textPlaces(view);
        const filePlaces = textPlaces(v2);
        assert.equal(places.length, filePlaces.length);
        places.forEach((p, i) => {
          assert.equal(typeof p.value, "string");
          assert.equal(
            p.value,
            filePlaces[i].value[language],
            `${id} ${language}`,
          );
        });
      }
    }
  }
});

test("LG-1g: fileLanguages (/1 gives ru, /2 gives ru, kk and en, a new list at each call) and tenantInLanguage (a language that is not there, not a string or __proto__ gives ru; a /1 file comes back as the same object)", () => {
  const v1 = readJson(legacyPath("uchet-pro"));
  const v2 = readJson(demoPath("uchet-pro"));
  assert.deepEqual(fileLanguages(v1), ["ru"]);
  assert.deepEqual(fileLanguages(v2), ["ru", "kk", "en"]);
  const a = fileLanguages(v2);
  a.push("de");
  a.length = 0;
  assert.deepEqual(fileLanguages(v2), ["ru", "kk", "en"], "a new list");
  assert.notEqual(fileLanguages(v2), fileLanguages(v2));
  assert.notEqual(fileLanguages(v1), fileLanguages(v1));
  const ru = JSON.stringify(tenantInLanguage(v2, "ru"));
  for (const bad of [
    "de",
    undefined,
    null,
    5,
    "__proto__",
    "KK",
    "",
    ["kk"],
    {},
    "constructor",
  ]) {
    assert.equal(
      JSON.stringify(tenantInLanguage(v2, bad)),
      ru,
      `v2 ${JSON.stringify(bad)}`,
    );
    assert.equal(tenantInLanguage(v1, bad), v1, "/1 is the same object");
  }
  for (const language of LANGS) {
    assert.equal(tenantInLanguage(v1, language), v1);
    assert.notEqual(tenantInLanguage(v2, language), v2);
  }
  assert.equal(
    JSON.stringify(tenantInLanguage(v2, "kk")) === ru,
    false,
    "kk is not ru",
  );
  assert.equal(
    JSON.stringify(tenantInLanguage(v2, "en")) === ru,
    false,
    "en is not ru",
  );
  // a language of the file is read by its own key
  const kk = tenantInLanguage(v2, "kk");
  assert.equal(kk.name, v2.name.kk);
  assert.equal(tenantInLanguage(v2, "en").name, v2.name.en);
});

test("LG-1h: the one rule of the form - isFormatV2 is true only for an object with its own schema equal to /2 (an array, null, a string, an object without schema, another case, /1, an inherited schema are not)", () => {
  assert.equal(isFormatV2({ schema: V2 }), true);
  assert.equal(
    isFormatV2(Object.assign(Object.create(null), { schema: V2 })),
    true,
  );
  assert.equal(isFormatV2({ schema: V1 }), false);
  assert.equal(isFormatV2({ schema: "SAI-PICKER-TENANT/2" }), false);
  assert.equal(isFormatV2({ schema: "sai-picker-tenant/2 " }), false);
  assert.equal(isFormatV2({ schema: "sai-picker-tenant/20" }), false);
  assert.equal(isFormatV2({ schema: ["sai-picker-tenant/2"] }), false);
  assert.equal(isFormatV2({ schema: 2 }), false);
  assert.equal(isFormatV2({}), false);
  assert.equal(isFormatV2({ id: "x" }), false);
  assert.equal(isFormatV2([]), false);
  assert.equal(isFormatV2([V2]), false);
  assert.equal(isFormatV2(null), false);
  assert.equal(isFormatV2(undefined), false);
  assert.equal(isFormatV2(V2), false);
  assert.equal(isFormatV2("sai-picker-tenant/2"), false);
  assert.equal(isFormatV2(2), false);
  assert.equal(isFormatV2(Object.create({ schema: V2 })), false);
  // the same rule decides in the check and in the view
  const inherited = Object.create({ schema: V2 });
  assert.deepEqual(fileLanguages(inherited), ["ru"]);
});

test("LG-1i: the view is built by the form of a value, not by its place - an object with exactly the keys ru, kk and en is replaced by the language (also where no text stands); an object with two or four keys is walked and kept; the keys __proto__ and constructor are kept as own keys in the order of the file; the kind of prototype is kept", () => {
  const extra =
    '{"__proto__":{"ru":"а","kk":"б","en":"в"},"constructor":1,"two":{"ru":"а","kk":"б"},"four":{"ru":"а","kk":"б","en":"в","de":{"ru":"1","kk":"2","en":"3"}},"nums":{"ru":1,"kk":2,"en":3},"list":[{"en":"x","ru":"y","kk":"z"},[{"ru":"a","kk":"b","en":"c"}]]}';
  const make = () => {
    const doc = minimal();
    doc.extra = JSON.parse(extra);
    return doc;
  };
  const nameless = checkBytes(
    Buffer.from(JSON.stringify(minimal()), "utf8"),
    MINIMAL,
  ).tenant;
  nameless.extra = JSON.parse(extra);
  for (const [form, doc] of [
    ["plain", make()],
    ["no prototype", nameless],
  ]) {
    assert.equal(Object.hasOwn(doc.extra, "__proto__"), true);
    const view = tenantInLanguage(doc, "kk");
    const label = form;
    assert.deepEqual(
      Object.keys(view.extra),
      ["__proto__", "constructor", "two", "four", "nums", "list"],
      label,
    );
    assert.equal(
      Object.hasOwn(view.extra, "__proto__"),
      true,
      `${label}: own __proto__`,
    );
    assert.equal(
      Object.getOwnPropertyDescriptor(view.extra, "__proto__").value,
      "б",
      label,
    );
    assert.equal(
      Object.getPrototypeOf(view.extra),
      Object.getPrototypeOf(doc.extra),
      `${label}: prototype kept`,
    );
    assert.equal(view.extra.constructor, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(view.extra.two)), {
      ru: "а",
      kk: "б",
    });
    assert.deepEqual(Object.keys(view.extra.four), ["ru", "kk", "en", "de"]);
    assert.equal(view.extra.four.kk, "б");
    assert.equal(view.extra.four.de, "2", "walked inside a four-key object");
    assert.equal(view.extra.nums, 2, "any values: the shape decides");
    assert.deepEqual(view.extra.list, ["z", ["b"]]);
    assert.equal(
      Object.getPrototypeOf(view),
      Object.getPrototypeOf(doc),
      `${label}: prototype of the root`,
    );
    // the input is untouched
    assert.equal(
      Object.getOwnPropertyDescriptor(doc.extra, "__proto__").value.kk,
      "б",
    );
  }
  // texts that are the words __proto__ and constructor, and an id constructor
  const named = minimal();
  named.questions[0].id = "constructor";
  setAt(named, ["questions", 0, "title", "kk"], "__proto__");
  setAt(named, ["questions", 0, "title", "en"], "constructor");
  const view = tenantInLanguage(named, "kk");
  assert.equal(view.questions[0].id, "constructor");
  assert.equal(view.questions[0].title, "__proto__");
  assert.equal(tenantInLanguage(named, "en").questions[0].title, "constructor");
});

// ---------------------------------------------------------------------- LG-2

const runSample = (dir, name) => {
  const bytes = langFixtureBytes(name);
  const file = put(dir, name, bytes);
  const before = fileDigest(file);
  const run = runPicker(["check", file]);
  assert.deepEqual(fileDigest(file), before, `${name}: the file stays`);
  return { run, text: bytes.toString("utf8") };
};
const wantLines = (name, text) => {
  const lines = LANG_EXPECTED[name].lines;
  return typeof lines === "function" ? lines(text) : lines;
};

test("LG-2a: nine samples with a string in place of a text give code 1 and exactly 'a text in three languages is needed' at the place", (t) => {
  const dir = makeTmp(t);
  const names = Object.keys(FIELD_PLACES).map((f) => `e-lang-string-${f}.json`);
  assert.equal(names.length, 9);
  for (const name of names) {
    const { run, text } = runSample(dir, name);
    assert.equal(run.code, 1, name);
    assert.deepEqual(run.out, wantLines(name, text), name);
    assert.deepEqual(run.err, [], name);
  }
});

test("LG-2b: twelve samples with a missing language give code 1 and exactly 'no translation into L' at the place of the language", (t) => {
  const dir = makeTmp(t);
  const names = [
    ...Object.keys(FIELD_PLACES).map((f) => `e-lang-no-kk-${f}.json`),
    "e-lang-no-kk-includes-2.json",
    "e-lang-no-en-title.json",
    "e-lang-no-ru-title.json",
  ];
  assert.equal(names.length, 12);
  for (const name of names) {
    const { run, text } = runSample(dir, name);
    assert.equal(run.code, 1, name);
    assert.deepEqual(run.out, wantLines(name, text), name);
    assert.deepEqual(run.err, [], name);
  }
});

test("LG-2c: an extra language is named at its own place; a text with de in place of en gives two lines - the missing en first, then the extra de", (t) => {
  const dir = makeTmp(t);
  for (const name of [
    "e-lang-extra-de-title.json",
    "e-lang-de-for-en-title.json",
  ]) {
    const { run, text } = runSample(dir, name);
    assert.equal(run.code, 1, name);
    assert.deepEqual(run.out, wantLines(name, text), name);
  }
  assert.equal(LANG_EXPECTED["e-lang-de-for-en-title.json"].lines.length, 2);
});

test("LG-2d: an object in place of a number, an id, a /1 text, operator_name or privacy_contact is 'a string/number is expected', not a text of three languages", (t) => {
  const dir = makeTmp(t);
  for (const name of [
    "e-lang-object-for-number.json",
    "e-lang-object-for-id.json",
    "e-lang-v1-object.json",
    "e-lang-operator-object.json",
    "e-lang-privacy-object.json",
  ]) {
    const { run, text } = runSample(dir, name);
    assert.equal(run.code, 1, name);
    assert.deepEqual(run.out, wantLines(name, text), name);
    assert.equal(run.out.length, 1, name);
  }
});

test("LG-2e: an empty text of a language and a title of 201 signs give E_LIMIT at that language; 200 signs in all three languages and a text of spaces are told apart", (t) => {
  const dir = makeTmp(t);
  for (const name of [
    "e-lang-empty-kk-title.json",
    "e-lang-empty-en-title.json",
    "e-lang-title-201-ru.json",
    "e-lang-title-201-kk.json",
    "e-lang-title-201-en.json",
  ]) {
    const { run, text } = runSample(dir, name);
    assert.equal(run.code, 1, name);
    assert.deepEqual(run.out, wantLines(name, text), name);
  }
  const at = ["questions", 0, "title"];
  for (const language of LANGS) {
    const same = minimal();
    for (const l of LANGS) setAt(same, [...at, l], "я".repeat(200));
    assert.equal(checkObject(same).exitCode, 0, "200 signs in all three");
    // 200 signs with spaces at the ends are 198 after the cut: still right
    const padded = minimal();
    setAt(padded, [...at, language], ` ${"я".repeat(198)} `);
    assert.equal(checkObject(padded).exitCode, 0, "spaces are cut");
    const blank = minimal();
    setAt(blank, [...at, language], "   ");
    const out = checkObject(blank);
    assert.equal(out.exitCode, 1);
    assert.deepEqual(out.stdout, [
      lineOf(
        MINIMAL,
        `${placeText(at)}.${language}`,
        "E_LIMIT",
        MESSAGES.limitText(0, 1, 200),
      ),
    ]);
    const long = minimal();
    setAt(long, [...at, language], "я".repeat(201));
    assert.deepEqual(checkObject(long).stdout, [
      lineOf(
        MINIMAL,
        `${placeText(at)}.${language}`,
        "E_LIMIT",
        MESSAGES.limitText(201, 1, 200),
      ),
    ]);
  }
  // signs are code points: 200 emoji are 200 signs
  const emoji = minimal();
  for (const l of LANGS) setAt(emoji, [...at, l], "😀".repeat(200));
  assert.equal(checkObject(emoji).exitCode, 0);
});

test("LG-2f: the three good samples pass with their line", (t) => {
  const dir = makeTmp(t);
  for (const name of [
    "ok-lang-minimal.json",
    "ok-lang-edges.json",
    "ok-lang-bounds.json",
  ]) {
    const { run } = runSample(dir, name);
    assert.equal(run.code, 0, name);
    assert.deepEqual(run.out, LANG_EXPECTED[name].lines, name);
    assert.deepEqual(run.err, [], name);
  }
});

test("LG-2g: every output of the samples with errors has the shape of the lines (a template, a code of the ten, at most 18 words, a dot, no 'ты', no word of a parser) and the language is told where the error is about a text in a language", (t) => {
  const dir = makeTmp(t);
  let lines = 0;
  for (const name of LANG_SAMPLE_NAMES) {
    if (LANG_EXPECTED[name].code !== 1) continue;
    const { run } = runSample(dir, name);
    assert.deepEqual(lineProblems(run.out), [], name);
    lines += run.out.length;
    if (/^e-lang-(string|no-|extra|de-for|empty|title-201)/u.test(name)) {
      for (const l of run.out) {
        assert.match(l, /(^|[^\p{L}])(ru|kk|en)([^\p{L}]|$)/u, `${name}: ${l}`);
      }
    }
  }
  assert.ok(lines >= 40, `lines ${lines}`);
});

const VALID_TITLE = {
  ru: "Что вы продаёте?",
  kk: "Не сатасыз?",
  en: "What do you sell?",
};

test("LG-2h: in memory - extra keys are named through the safe form, wrong values of a language are 'a string is expected' at that language, an empty object gives three lines, a value that is no object gives 'a text of three languages is needed' (a number, null, a list, an empty list, true)", () => {
  const at = ["questions", 0, "title"];
  const place = placeText(at);
  const withTitle = (title) => setAt(minimal(), at, title);
  const extraOf = (keys) => {
    const title = JSON.parse(JSON.stringify(VALID_TITLE));
    for (const key of keys) title[key] = "Текст";
    return title;
  };
  const longKey = "k".repeat(60);
  const cases = [
    [["ты"], [`${place}["(скрыто)"]`, "(скрыто)"]],
    [["d e"], [`${place}["d_e"]`, "d_e"]],
    [[longKey], [`${place}["${"k".repeat(40)}…"]`, `${"k".repeat(40)}…`]],
    [["RU"], [`${place}.RU`, "RU"]],
  ];
  for (const [keys, [where, shown]] of cases) {
    const out = checkObject(withTitle(extraOf(keys)));
    assert.equal(out.exitCode, 1, keys.join());
    assert.deepEqual(
      out.stdout,
      [lineOf(MINIMAL, where, "E_FIELD", MESSAGES.EXTRA(shown))],
      keys.join(),
    );
    assert.deepEqual(lineProblems(out.stdout), []);
  }
  // two extra keys: both named, in the order of the file
  const two = checkObject(withTitle(extraOf(["de", "fr"])));
  assert.deepEqual(two.stdout, [
    lineOf(MINIMAL, `${place}.de`, "E_FIELD", MESSAGES.EXTRA("de")),
    lineOf(MINIMAL, `${place}.fr`, "E_FIELD", MESSAGES.EXTRA("fr")),
  ]);
  // the key __proto__ as an own key (a usual object, and the reader's object)
  const text = JSON.stringify(minimal()).replace(
    '"title":{',
    '"title":{"__proto__":"Текст",',
  );
  const proto = checkBytes(Buffer.from(text), MINIMAL);
  assert.deepEqual(proto.stdout, [
    lineOf(
      MINIMAL,
      `${place}.__proto__`,
      "E_FIELD",
      MESSAGES.EXTRA("__proto__"),
    ),
  ]);
  const usual = JSON.parse('{"__proto__":"Текст","ru":"а","kk":"б","en":"в"}');
  const plain = minimal();
  setAt(plain, at, usual);
  assert.equal(Object.hasOwn(usual, "__proto__"), true);
  const issues = validateTenant(plain, { fileName: MINIMAL });
  assert.deepEqual(
    issues.map((i) => [i.code, i.path.join("/")]),
    [["E_FIELD", "questions/0/title/__proto__"]],
  );
  // a constructor key of a usual object is an extra key, and nothing is thrown
  const named = checkObject(withTitle(extraOf(["constructor"])));
  assert.deepEqual(named.stdout, [
    lineOf(
      MINIMAL,
      `${place}.constructor`,
      "E_FIELD",
      MESSAGES.EXTRA("constructor"),
    ),
  ]);
  // wrong values of a language
  for (const bad of [5, null, ["x"], { a: 1 }, true]) {
    for (const language of LANGS) {
      const title = JSON.parse(JSON.stringify(VALID_TITLE));
      title[language] = bad;
      const out = checkObject(withTitle(title));
      assert.deepEqual(
        out.stdout,
        [
          lineOf(
            MINIMAL,
            `${place}.${language}`,
            "E_FIELD",
            MESSAGES.NEED_STRING,
          ),
        ],
        `${language} ${JSON.stringify(bad)}`,
      );
    }
  }
  // an empty object: three lines in the order ru, kk, en
  assert.deepEqual(
    checkObject(withTitle({})).stdout,
    LANGS.map((l) =>
      lineOf(MINIMAL, `${place}.${l}`, "E_FIELD", MESSAGES.noTranslation(l)),
    ),
  );
  // in place of the text: a number, null, a list, an empty list, true, a string
  const places = [
    ["name"],
    ["questions", 0, "title"],
    ["questions", 0, "options", 0, "label"],
    ["solutions", 0, "includes", 0],
    ["leads", "consent_text"],
  ];
  for (const where of places) {
    for (const bad of [5, null, ["ru", "kk", "en"], [], true, "строка"]) {
      const out = checkObject(setAt(minimal(), where, bad));
      assert.deepEqual(
        out.stdout,
        [lineOf(MINIMAL, placeText(where), "E_FIELD", NEED)],
        `${placeText(where)} ${JSON.stringify(bad)}`,
      );
    }
  }
});

test("LG-2i: the folder of the samples is the 39 of the design and the folder of the copies has two files; every sample is a file with the final newline whose id is its name", () => {
  assert.equal(LANG_SAMPLE_NAMES.length, 39);
  assert.deepEqual(langFixtureNames(), [...LANG_SAMPLE_NAMES].sort());
  assert.equal(
    LANG_SAMPLE_NAMES.filter((n) => LANG_EXPECTED[n].code === 0).length,
    3,
  );
  assert.equal(
    LANG_SAMPLE_NAMES.filter((n) => LANG_EXPECTED[n].code === 1).length,
    36,
  );
  for (const name of LANG_SAMPLE_NAMES) {
    const text = fs.readFileSync(path.join(LANG_FIXTURES, name), "utf8");
    assert.ok(text.endsWith("\n"), `${name}: a final newline`);
    if (name !== "e-lang-dup-kk.json") {
      const sample = JSON.parse(text);
      assert.equal(sample.id, name.replace(/[.]json$/u, ""), name);
    }
  }
  assert.equal(fs.readdirSync(LEGACY_TENANTS).length, 2);
});

// ---------------------------------------------------------------------- LG-3

// The ten fields of the criterion and their places in the small file.
const TEN = [
  ["intro", ["intro"]],
  ["title", ["questions", 0, "title"]],
  ["help", ["questions", 1, "help"]],
  ["label", ["questions", 0, "options", 0, "label"]],
  ["summary", ["solutions", 0, "summary"]],
  ["includes", ["solutions", 0, "includes", 0]],
  ["rule text", ["rules", 0, "text"]],
  ["explanation", ["hypotheses", 0, "explanation"]],
  ["no_match_text", ["result", "no_match_text"]],
  ["consent_text", ["leads", "consent_text"]],
];
const OTHER = [
  ["name", ["name"]],
  ["price_text", ["solutions", 1, "price_text"]],
  ["duration_text", ["solutions", 1, "duration_text"]],
  ["needs_from_you", ["solutions", 1, "needs_from_you", 0]],
  ["next_steps", ["solutions", 0, "next_steps", 0]],
  ["not_suitable_when", ["solutions", 1, "not_suitable_when", 0]],
  ["rule text 2", ["rules", 1, "text"]],
  ["hypothesis title", ["hypotheses", 0, "title"]],
  ["solution name", ["solutions", 0, "name"]],
  ["label 2", ["questions", 3, "options", 1, "label"]],
];
const wordsOfA = (n) => Array(n).fill("а").join(" ");
const ONLY_LINE = (where, language, text) => [
  lineOf(MINIMAL, `${placeText(where)}.${language}`, "E_TEXT", text),
];

test("LG-3a: in each of the ten fields of the criterion and in each language 19 words are exactly one E_TEXT at that language, 18 words are right", () => {
  for (const [label, where] of TEN) {
    for (const language of LANGS) {
      const long = setAt(minimal(), [...where, language], wordsOfA(19));
      const out = checkObject(long);
      assert.equal(out.exitCode, 1, `${label} ${language}`);
      assert.deepEqual(
        out.stdout,
        ONLY_LINE(where, language, MESSAGES.LONG19),
        `${label} ${language}`,
      );
      const edge = setAt(minimal(), [...where, language], wordsOfA(18));
      assert.equal(checkObject(edge).exitCode, 0, `${label} ${language} 18`);
    }
  }
});

test("LG-3b: the other places of the table (name, price, duration, lists, rules, hypotheses) follow the same rule; for unit the length is looked at first, and only ru has the address rule", () => {
  for (const [label, where] of OTHER) {
    for (const language of LANGS) {
      const long = setAt(minimal(), [...where, language], wordsOfA(19));
      const out = checkObject(long);
      assert.deepEqual(
        out.stdout,
        ONLY_LINE(where, language, MESSAGES.LONG19),
        `${label} ${language}`,
      );
      const edge = setAt(minimal(), [...where, language], wordsOfA(18));
      assert.equal(checkObject(edge).exitCode, 0, `${label} ${language} 18`);
    }
  }
  const unit = ["questions", 2, "unit"];
  for (const language of LANGS) {
    const out = checkObject(
      setAt(minimal(), [...unit, language], wordsOfA(19)),
    );
    assert.deepEqual(out.stdout, [
      lineOf(
        MINIMAL,
        `${placeText(unit)}.${language}`,
        "E_LIMIT",
        MESSAGES.limitText(37, 1, 20),
      ),
    ]);
  }
  const ru = checkObject(setAt(minimal(), [...unit, "ru"], "Ты тут"));
  assert.deepEqual(ru.stdout, ONLY_LINE(unit, "ru", MESSAGES.NOT_FORMAL));
  for (const language of ["kk", "en"])
    assert.equal(
      checkObject(setAt(minimal(), [...unit, language], "Ты тут")).exitCode,
      0,
    );
});

test("LG-3c: three phrases of ten words are right; the dash between spaces is no word; a point inside 1.5 does not cut a phrase", () => {
  const ten = Array(10).fill("слово").join(" ");
  const threePhrases = `${ten}. ${ten}. ${ten}.`;
  const dashed = `${wordsOfA(9)} — ${wordsOfA(9)}`;
  const where = ["rules", 0, "text"];
  for (const language of LANGS) {
    for (const ok of [threePhrases, dashed, `${wordsOfA(17)} 1.5`]) {
      assert.equal(
        checkObject(setAt(minimal(), [...where, language], ok)).exitCode,
        0,
        `${language}: ${ok.slice(0, 30)}`,
      );
    }
    // 19 words, the tenth is 1.5: one phrase, so one error (a cut at the point would hide it)
    const many = `${wordsOfA(9)} 1.5 ${wordsOfA(9)}`;
    assert.equal(words(many).length, 19);
    assert.deepEqual(
      checkObject(setAt(minimal(), [...where, language], many)).stdout,
      ONLY_LINE(where, language, MESSAGES.LONG19),
      language,
    );
    // 19 words with a real stop inside are two phrases: no error
    const cut = `${wordsOfA(9)}. ${wordsOfA(10)}`;
    assert.deepEqual(
      phrases(cut).map((p) => words(p).length),
      [9, 10],
    );
    assert.equal(
      checkObject(setAt(minimal(), [...where, language], cut)).exitCode,
      0,
      language,
    );
    // a dash between spaces among 18 words is right, a 19th word is not
    const dash19 = `${wordsOfA(10)} — ${wordsOfA(9)}`;
    assert.deepEqual(
      checkObject(setAt(minimal(), [...where, language], dash19)).stdout,
      ONLY_LINE(where, language, MESSAGES.LONG19),
      language,
    );
  }
});

test("LG-3d: the address 'ты' is forbidden in ru only (all eight words, any case); the same words in kk and en and the words 'вы получите', 'цветы', 'тыква' are right; 19 words with 'ты' in ru name the address", () => {
  const where = ["rules", 0, "text"];
  const formal = [
    "ты",
    "тебя",
    "тебе",
    "тобой",
    "твой",
    "твоя",
    "твоё",
    "твои",
  ];
  for (const word of formal) {
    for (const text of [
      `${word} получишь`,
      `${word[0].toUpperCase()}${word.slice(1)} здесь`,
      word.toUpperCase(),
    ]) {
      assert.deepEqual(
        checkObject(setAt(minimal(), [...where, "ru"], text)).stdout,
        ONLY_LINE(where, "ru", MESSAGES.NOT_FORMAL),
        text,
      );
      for (const language of ["kk", "en"])
        assert.equal(
          checkObject(setAt(minimal(), [...where, language], text)).exitCode,
          0,
          `${language}: ${text}`,
        );
    }
  }
  for (const ok of [
    "вы получите",
    "цветы",
    "тыква",
    "Вы получите тыкву и цветы.",
  ]) {
    assert.equal(
      checkObject(setAt(minimal(), [...where, "ru"], ok)).exitCode,
      0,
      ok,
    );
  }
  const mixed = `ты ${wordsOfA(18)}`;
  assert.deepEqual(
    checkObject(setAt(minimal(), [...where, "ru"], mixed)).stdout,
    ONLY_LINE(where, "ru", MESSAGES.NOT_FORMAL),
  );
  assert.equal(
    checkObject(setAt(minimal(), [...where, "kk"], mixed)).exitCode,
    1,
    "kk: 19 words",
  );
});

test("LG-3e: in kk a phrase of 18 words with the Kazakh letters is right and 19 words is E_TEXT", () => {
  const where = ["rules", 0, "text"];
  const letters = ["ә", "ғ", "қ", "ң", "ө", "ұ", "ү", "һ", "і"];
  const eighteen = [...letters, ...letters].join(" ");
  assert.equal(words(eighteen).length, 18);
  assert.equal(
    checkObject(setAt(minimal(), [...where, "kk"], eighteen)).exitCode,
    0,
  );
  const nineteen = `${eighteen} ә`;
  assert.deepEqual(
    checkObject(setAt(minimal(), [...where, "kk"], nineteen)).stdout,
    ONLY_LINE(where, "kk", MESSAGES.LONG19),
  );
  // a word of the Kazakh letters is one word (a letter is a letter)
  assert.equal(words("қазақстан үлгісі").length, 2);
});

test("LG-3f: operator_name and privacy_contact are one string in both forms; the rule of understandable text works once, as for ru", () => {
  const forms = [
    ["/2", minimal, MINIMAL],
    [
      "/1",
      () =>
        readJson(
          path.join(TOOLS, "test", "fixtures", "picker", "ok-minimal.json"),
        ),
      "ok-minimal.json",
    ],
  ];
  for (const [form, make, name] of forms) {
    for (const [key, max] of [
      ["operator_name", 100],
      ["privacy_contact", 200],
    ]) {
      const where = ["leads", key];
      const run = (value) => checkObject(setAt(make(), where, value), name);
      assert.deepEqual(
        run(wordsOfA(19)).stdout,
        [lineOf(name, placeText(where), "E_TEXT", MESSAGES.LONG19)],
        `${form} ${key}`,
      );
      assert.deepEqual(
        run("Ты тут").stdout,
        [lineOf(name, placeText(where), "E_TEXT", MESSAGES.NOT_FORMAL)],
        `${form} ${key}`,
      );
      assert.deepEqual(
        run("").stdout,
        [
          lineOf(
            name,
            placeText(where),
            "E_LIMIT",
            MESSAGES.limitText(0, 1, max),
          ),
        ],
        `${form} ${key}`,
      );
      assert.equal(run(wordsOfA(18)).exitCode, 0, `${form} ${key}`);
      assert.deepEqual(run({ ru: "а", kk: "б", en: "в" }).stdout, [
        lineOf(name, placeText(where), "E_FIELD", MESSAGES.NEED_STRING),
      ]);
    }
  }
});

test("LG-3g: the sample with every kind of error gives seven lines in the order of the file, the languages of one text in the order ru, kk, en; a text written in the order en, kk, ru is told in the order of the file", (t) => {
  const dir = makeTmp(t);
  const all = runSample(dir, "e-lang-all-three.json");
  assert.deepEqual(all.run.out, LANG_EXPECTED["e-lang-all-three.json"].lines);
  assert.equal(all.run.out.length, 7);
  const order = runSample(dir, "e-lang-key-order.json");
  assert.deepEqual(
    order.run.out.map((l) => l.split(": ")[1]),
    ["intro.en", "intro.kk", "intro.ru"],
  );
  const dup = runSample(dir, "e-lang-dup-kk.json");
  assert.deepEqual(dup.run.out, wantLines("e-lang-dup-kk.json", dup.text));
  assert.equal(dup.run.out.length, 1);
  assert.deepEqual(lineProblems(dup.run.out), []);
});

// ---------------------------------------------------------------------- LG-4

test("LG-4a: the 31 rows of the table of the choice of the language, plus a call with no argument and the header of a request that is not read", () => {
  assert.ok(LANGUAGE_ROWS.length >= 14);
  for (const row of LANGUAGE_ROWS) {
    const got = chooseLanguage(rowInput(row));
    assert.equal(got, row[4], `row ${row[0]}`);
  }
  assert.equal(chooseLanguage(), "ru", "row 32");
  assert.equal(
    chooseLanguage({
      acceptLanguage: "kk",
      "Accept-Language": "kk",
      available: LANGS,
    }),
    "ru",
    "row 33",
  );
  assert.equal(
    chooseLanguage({ query: undefined, stored: undefined, available: LANGS }),
    "ru",
  );
  // a value that is not an object: ru, no exception (null, a number, a list, a string, a symbol, a bigint)
  for (const input of [
    null,
    5,
    [],
    ["kk"],
    "kk",
    Symbol("kk"),
    10n,
    true,
    false,
    undefined,
    () => "kk",
  ]) {
    assert.equal(chooseLanguage(input), "ru", String(typeof input));
  }
  // a hostile object: a getter that throws
  const hostile = {
    get query() {
      throw new Error("no");
    },
    available: LANGS,
  };
  assert.equal(chooseLanguage(hostile), "ru");
  // the right values: every language alone
  for (const language of LANGS) {
    assert.equal(
      chooseLanguage({ query: language, available: LANGS }),
      language,
    );
    assert.equal(
      chooseLanguage({ stored: language, available: LANGS }),
      language,
    );
  }
  // an array-like object is not a list of the languages of the file
  assert.equal(
    chooseLanguage({
      query: "kk",
      available: { length: 3, 0: "ru", 1: "kk", 2: "en" },
    }),
    "ru",
  );
});

test("LG-4b: the choice is pure - the frozen input is not changed, two calls are equal, nothing is kept between calls", () => {
  const input = deepFreeze({
    query: "kk",
    stored: "en",
    available: ["ru", "kk", "en"],
  });
  assert.equal(chooseLanguage(input), "kk");
  assert.equal(chooseLanguage(input), "kk");
  assert.deepEqual(input, {
    query: "kk",
    stored: "en",
    available: ["ru", "kk", "en"],
  });
  const rng = makeRng(61004);
  const pool = [
    "ru",
    "kk",
    "en",
    "de",
    "",
    " kk",
    "KK",
    "kk,en",
    null,
    5,
    ["kk"],
    undefined,
    "__proto__",
  ];
  const lists = [["ru"], ["ru", "kk"], ["ru", "kk", "en"], [], "kk", undefined];
  const calls = [];
  for (let i = 0; i < 400; i++) {
    const call = {
      query: rng.pick(pool),
      stored: rng.pick(pool),
      available: rng.pick(lists),
    };
    calls.push([call, chooseLanguage(call)]);
  }
  // in another order and twice: the same answers
  for (const [call, got] of [...calls].reverse())
    assert.equal(chooseLanguage(call), got);
  for (const [call, got] of calls) {
    assert.ok(LANGS.includes(got));
    // the rule, written again: the first right value, a language that the file lacks gives ru
    const right = (v) => typeof v === "string" && LANGS.includes(v);
    const wanted = right(call.query)
      ? call.query
      : right(call.stored)
        ? call.stored
        : "ru";
    const want =
      Array.isArray(call.available) && call.available.includes(wanted)
        ? wanted
        : "ru";
    assert.equal(got, want, JSON.stringify(call));
  }
});

test("LG-4c: the file public/texts.js has no import, require, node: or process (the words as words, comments count) and loads in Node as a module with no help", async () => {
  const file = path.join(PICKER, "public", "texts.js");
  const text = fs.readFileSync(file, "utf8");
  assert.deepEqual(scanTextsModule(text), []);
  const module = await import(file);
  assert.equal(typeof module.chooseLanguage, "function");
  // the scan finds what it must and not what it must not (the same definition in TX-6d)
  assert.ok(TEXTS_MODULE_FORBIDDEN.length >= 6);
});

// ---------------------------------------------------------------------- LG-7

const SIXTH = {
  "uchet-pro": {
    leader: [
      [
        "sheet-start 15",
        "shop-kit 8",
        "order-check 1",
        "warehouse-docs 0",
        "chain-control -2",
      ],
      ["sheet-start", "shop-kit"],
      true,
    ],
    close: [
      [
        "chain-control 11",
        "shop-kit 9",
        "warehouse-docs 2",
        "order-check 0",
        "sheet-start -4",
      ],
      ["chain-control", "shop-kit"],
      false,
    ],
    none: [
      [
        "sheet-start 7",
        "warehouse-docs 4",
        "shop-kit 2",
        "chain-control 0",
        "order-check 0",
      ],
      [],
      null,
    ],
  },
  "svet-marketing": {
    leader: [
      [
        "quick-start 12",
        "content-month 8",
        "site-booking 3",
        "guest-return 0",
        "ads-launch -4",
      ],
      ["quick-start", "content-month"],
      true,
    ],
    close: [
      [
        "content-month 13",
        "guest-return 11",
        "ads-launch 3",
        "site-booking 3",
        "quick-start 2",
      ],
      ["content-month", "guest-return"],
      false,
    ],
    none: [
      [
        "quick-start 6",
        "content-month 0",
        "ads-launch 0",
        "guest-return 0",
        "site-booking -1",
      ],
      [],
      null,
    ],
  },
};
const KAZAKH = /[әғқңөұүһі]/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;

test("LG-7a: the fictional tenants are the form /2 with 152 and 145 texts, each an object with exactly ru, kk and en and non-empty strings with no space at the ends; everything else, operator_name and privacy_contact are equal to the copies; the ru strings are equal byte for byte", () => {
  for (const id of IDS) {
    const v2 = readJson(demoPath(id));
    const v1 = readJson(legacyPath(id));
    assert.equal(v2.schema, V2);
    const places = textPlaces(v2);
    const old = textPlaces(v1);
    assert.equal(places.length, COUNTS[id], id);
    assert.deepEqual(
      places.map((p) => p.path),
      old.map((p) => p.path),
    );
    places.forEach((p, i) => {
      const label = `${id} ${placeText(p.path)}`;
      assert.deepEqual(Object.keys(p.value), ["ru", "kk", "en"], label);
      for (const l of LANGS) {
        assert.equal(typeof p.value[l], "string", label);
        assert.ok(p.value[l].length > 0, label);
        assert.equal(p.value[l], p.value[l].trim(), label);
      }
      assert.ok(
        Buffer.from(p.value.ru, "utf8").equals(
          Buffer.from(old[i].value, "utf8"),
        ),
        label,
      );
    });
    // all the rest, in the order of the keys
    const rest = { ...v1, schema: V2 };
    assert.equal(
      JSON.stringify(skeleton(v2)),
      JSON.stringify(skeleton(rest)),
      id,
    );
    assert.equal(v2.leads === undefined, v1.leads === undefined);
    if (v1.leads !== undefined) {
      assert.equal(v2.leads.operator_name, v1.leads.operator_name);
      assert.equal(v2.leads.privacy_contact, v1.leads.privacy_contact);
      assert.equal(typeof v2.leads.operator_name, "string");
    }
    // the kinds of place: all of them stand (the first tenant) or all but the consent text (the second)
    const kinds = new Set(places.map((p) => p.kind));
    for (const kind of PLACE_KINDS) {
      if (kind === "consent_text" && id === "svet-marketing") continue;
      assert.ok(kinds.has(kind), `${id}: ${kind}`);
    }
  }
});

const NUMBER_ROWS = [
  ["50 000", [50000]],
  ["50 000", [50000]],
  ["50 000", [50000]],
  ["50,000", [50000]],
  ["2,5", [2.5]],
  ["2.5", [2.5]],
  ["2.50", [2.5]],
  ["1 000,5", [1000.5]],
  ["1,000.5", [1000.5]],
  ["40.000", [40]],
  ["0,125", [125]],
  ["1,2,3", [1.2, 3]],
  ["2020-2025", [2020, 2025]],
  ["в 2 100 точках", [2100]],
  ["1 2345", [1, 2345]],
  ["5 000, 6 000", [5000, 6000]],
  ["100%", [100]],
  ["сто", []],
  ["три рабочих дня", []],
  ["", []],
  ["1 000 000", [1000000]],
  ["12,345,678", [12345678]],
  ["7", [7]],
  ["от 100 000 тенге", [100000]],
  ["a12b34", [12, 34]],
  ["0.5 и 0,5", [0.5, 0.5]],
  ["150 000 ₸ за 3 месяца", [150000, 3]],
  ["1234 567", [1234, 567]],
  ["١٢٣", []],
];

test("LG-7b: the oracle of numbers follows the table of design 9.5 (29 rows); in every text the numbers of ru, kk and en are one set; the two files hold two numbers in all, 40000 and 150000", () => {
  assert.ok(NUMBER_ROWS.length >= 29);
  for (const [text, want] of NUMBER_ROWS)
    assert.deepEqual(numbersOf(text), want, JSON.stringify(text));
  const found = { "uchet-pro": [], "svet-marketing": [] };
  for (const id of IDS) {
    for (const p of textPlaces(readJson(demoPath(id)))) {
      const [ru, kk, en] = LANGS.map((l) => numbersOf(p.value[l]));
      assert.deepEqual(kk, ru, `${id} ${placeText(p.path)} kk`);
      assert.deepEqual(en, ru, `${id} ${placeText(p.path)} en`);
      found[id].push(...ru);
    }
  }
  assert.deepEqual(found["uchet-pro"], [40000]);
  assert.deepEqual(found["svet-marketing"], [150000]);
});

test("LG-7c: no Cyrillic letter in en; only ASCII digits in kk and en; kk and en differ from ru in a text of three words or more; kk has a Kazakh letter in a text of six words or more", () => {
  for (const id of IDS) {
    for (const p of textPlaces(readJson(demoPath(id)))) {
      const label = `${id} ${placeText(p.path)}`;
      const { ru, kk, en } = p.value;
      assert.equal(CYRILLIC.test(en), false, `${label}: en has Cyrillic`);
      for (const text of [kk, en]) {
        for (const m of text.matchAll(/\p{Nd}/gu))
          assert.match(m[0], /[0-9]/u, label);
      }
      const count = words(ru).length;
      if (count >= 3) {
        assert.notEqual(kk, ru, `${label}: kk is ru`);
        assert.notEqual(en, ru, `${label}: en is ru`);
      }
      if (words(kk).length >= 6)
        assert.match(
          kk.toLowerCase(),
          KAZAKH,
          `${label}: kk has no Kazakh letter`,
        );
    }
  }
});

test("LG-7d: the two files share no id and no text, in each of ru, kk and en", () => {
  const files = IDS.map((id) => readJson(demoPath(id)));
  const idsOf = (t) =>
    new Set([
      ...t.questions.map((q) => q.id),
      ...t.questions.flatMap((q) => (q.options ?? []).map((o) => o.id)),
      ...t.solutions.map((s) => s.id),
      ...t.rules.map((r) => r.id),
      ...(t.hypotheses ?? []).map((h) => h.id),
      t.id,
    ]);
  const a = idsOf(files[0]);
  for (const id of idsOf(files[1])) assert.equal(a.has(id), false, `id ${id}`);
  for (const language of LANGS) {
    const first = new Set(textPlaces(files[0]).map((p) => p.value[language]));
    for (const p of textPlaces(files[1])) {
      assert.equal(
        first.has(p.value[language]),
        false,
        `${language}: ${p.value[language]}`,
      );
    }
  }
});

test("LG-7e: the composition of each tenant is as the copies had it - 8-15 questions, at least 3 with show_if, three kinds, at least 4 solutions, at least 2 hypotheses, one solution with a price and a duration and one with neither, the leads of the first enabled and none for the second, top at least 2", () => {
  for (const id of IDS) {
    const t = readJson(demoPath(id));
    assert.equal(t.id, id);
    assert.ok(t.questions.length >= 8 && t.questions.length <= 15, id);
    assert.ok(
      t.questions.filter((q) => (q.show_if ?? []).length > 0).length >= 3,
      id,
    );
    for (const type of ["single", "multiple", "number"])
      assert.ok(
        t.questions.some((q) => q.type === type),
        `${id} ${type}`,
      );
    assert.ok(t.solutions.length >= 4);
    assert.ok((t.hypotheses ?? []).length >= 2);
    const both = t.solutions.filter(
      (s) => s.price_text !== undefined && s.duration_text !== undefined,
    );
    const none = t.solutions.filter(
      (s) => s.price_text === undefined && s.duration_text === undefined,
    );
    assert.equal(both.length, 1, id);
    assert.ok(none.length >= 1, id);
    assert.equal(
      t.solutions.filter(
        (s) => (s.price_text === undefined) !== (s.duration_text === undefined),
      ).length,
      0,
    );
    assert.ok(t.result.top >= 2);
  }
  assert.equal(readJson(demoPath("uchet-pro")).leads.enabled, true);
  assert.equal(
    Object.hasOwn(readJson(demoPath("svet-marketing")), "leads"),
    false,
  );
});

test("LG-7f: the keys are written in the text of each file as often as there are texts - 152 and 145 times each of ru, kk and en, and the sum of the two files is 297", () => {
  let total = 0;
  for (const id of IDS) {
    const text = fs.readFileSync(demoPath(id), "utf8");
    for (const l of LANGS) {
      const n = text.split(`"${l}":`).length - 1;
      assert.equal(n, COUNTS[id], `${id} "${l}":`);
    }
    total += COUNTS[id];
  }
  assert.equal(total, 297);
});

test("LG-7h: no text of the fictional tenants, in any language, holds a line break, a carriage return, a tab or another control sign (the site shows a text as one line; a protection beyond the design)", () => {
  const control = /[\p{Cc}\u2028\u2029]/u;
  assert.equal(control.test("a\nb"), true);
  assert.equal(control.test("a\tb"), true);
  assert.equal(control.test("a\rb"), true);
  assert.equal(control.test("a b"), false);
  for (const id of IDS) {
    for (const p of textPlaces(readJson(demoPath(id)))) {
      for (const l of LANGS) {
        assert.equal(
          control.test(p.value[l]),
          false,
          `${id} ${placeText(p.path)} ${l}`,
        );
      }
    }
  }
  // the controls of the small file as well, and a file with a break in a text is still a file
  for (const p of textPlaces(minimal())) {
    for (const l of LANGS)
      assert.equal(control.test(p.value[l]), false, placeText(p.path));
  }
});

test("LG-7g: the six sets of answers give the outcomes of the table in each of ru, kk and en - the ranking line by line, the recommended, the mark; the names of the solutions are the strings of that language", () => {
  for (const id of IDS) {
    const answers = JSON.parse(
      fs.readFileSync(path.join(DEMO_ANSWERS, `${id}.json`), "utf8"),
    );
    for (const [form, v2] of [
      ["plain", readJson(demoPath(id))],
      ["no prototype", checkFile(demoPath(id)).tenant],
    ]) {
      for (const language of LANGS) {
        const view = tenantInLanguage(v2, language);
        for (const name of ["leader", "close", "none"]) {
          const [ranking, recommended, mark] = SIXTH[id][name];
          const out = computeResult(view, answers[name]);
          const label = `${id}/${name} ${language} ${form}`;
          assert.equal(out.ok, true, label);
          assert.deepEqual(
            out.result.ranking.map((e) => `${e.solution} ${e.score}`),
            ranking,
            label,
          );
          assert.deepEqual(
            out.result.recommended.map((x) => x.id),
            recommended,
            label,
          );
          assert.equal(out.result.clear_leader, mark, label);
          for (const item of out.result.recommended) {
            const source = v2.solutions.find((s) => s.id === item.id);
            assert.equal(item.name, source.name[language], label);
            assert.equal(item.summary, source.summary[language], label);
          }
          assert.deepEqual(
            visibleQuestions(view, answers[name]),
            visibleQuestions(tenantInLanguage(v2, "ru"), answers[name]),
          );
        }
      }
    }
  }
  // the answers of the demo are the ones of the base (the same file as in the test of the engine)
  assert.deepEqual(Object.keys(demoAnswers("uchet-pro")), [
    "leader",
    "close",
    "none",
  ]);
});

// ---------------------------------------------------------------------- LG-10

test("LG-10a: a good /2 file beside two bad ones in one folder passes alone - the neighbours are not read, and they stay as they were", (t) => {
  const dir = makeTmp(t);
  const good = put(
    dir,
    "uchet-pro.json",
    fs.readFileSync(demoPath("uchet-pro")),
  );
  const bad1 = put(
    dir,
    "e-lang-no-kk-title.json",
    langFixtureBytes("e-lang-no-kk-title.json"),
  );
  const bad2 = put(
    dir,
    "e-lang-all-three.json",
    langFixtureBytes("e-lang-all-three.json"),
  );
  const before = [good, bad1, bad2].map(fileDigest);
  const run = runPicker(["check", good]);
  assert.equal(run.code, 0);
  assert.deepEqual(run.err, []);
  assert.deepEqual(run.out, [
    "Файл арендатора uchet-pro в порядке: вопросов 12, решений 5, правил 39.",
  ]);
  assert.deepEqual([good, bad1, bad2].map(fileDigest), before);
  // and the other way round: a bad file beside a good one tells only its own errors
  const other = runPicker(["check", bad1]);
  assert.equal(other.code, 1);
  assert.deepEqual(other.out, LANG_EXPECTED["e-lang-no-kk-title.json"].lines);
});

const NUMBERS = [0, 1, -1, 2.5, 1e21, 7];
function corruptOnce(base, rng) {
  const places = textPlaces(base);
  const place = rng.pick(places);
  const doc = deepCopy(base);
  const kind = rng.int(9);
  const language = rng.pick(LANGS);
  if (kind === 0) setAt(doc, place.path, rng.pick(NUMBERS));
  else if (kind === 1) setAt(doc, place.path, null);
  else if (kind === 2) setAt(doc, place.path, rng.next() < 0.5 ? [] : ["ru"]);
  else if (kind === 3) setAt(doc, place.path, {});
  else if (kind === 4)
    setAt(doc, [...place.path, language], { ru: "а", kk: "б", en: "в" });
  else if (kind === 5) setAt(doc, place.path, "Просто строка");
  else if (kind === 6) deleteAt(doc, [...place.path, language]);
  else if (kind === 7) setAt(doc, [...place.path, language], rng.pick(NUMBERS));
  else setAt(doc, [...place.path, language], "@@dup@@");
  let text = JSON.stringify(doc);
  if (kind === 8) {
    // the repeat of a key goes into the text of the file
    const key = rng.pick(LANGS);
    text = text.replace(
      `"${language}":"@@dup@@"`,
      `"${language}":"а","${language}":"б"`,
    );
    void key;
  }
  return { text, label: `${placeText(place.path)} kind ${kind} ${language}` };
}

test("LG-10b: 500 variants of the /2 file with one broken text (a number, null, a list, an empty object, an object inside a language, a string, a language deleted or written twice) are all code 1, stderr empty, no line of a stack, each line of the shape; 40 of them through the process", (t) => {
  const rng = makeRng(61010);
  const base = readJson(demoPath("uchet-pro"));
  const variants = Array.from({ length: 500 }, () => corruptOnce(base, rng));
  for (const { text, label } of variants) {
    const out = checkBytes(Buffer.from(text, "utf8"), "uchet-pro.json");
    assert.equal(out.exitCode, 1, label);
    assert.deepEqual(out.stderr, [], label);
    assert.equal(
      out.stdout.some((l) => l.startsWith("    at ")),
      false,
      label,
    );
    assert.deepEqual(lineProblems(out.stdout), [], label);
  }
  const dir = makeTmp(t);
  for (const { text, label } of variants.slice(0, 40)) {
    const file = put(dir, "uchet-pro.json", text);
    const before = fileDigest(file);
    const run = runPicker(["check", file]);
    assert.equal(run.code, 1, label);
    assert.deepEqual(run.err, [], label);
    assert.deepEqual(lineProblems(run.out), [], label);
    assert.deepEqual(fileDigest(file), before, label);
  }
  // the repeated key is one E_JSON line and nothing else
  const repeated = variants.filter((v) => /kind 8/u.test(v.label));
  assert.ok(repeated.length > 20, `${repeated.length}`);
  for (const { text } of repeated) {
    const out = checkBytes(Buffer.from(text, "utf8"), "uchet-pro.json");
    if (out.stdout.length === 1 && out.stdout[0].includes("E_JSON")) continue;
    assert.fail(`not one E_JSON line: ${out.stdout.join(" | ")}`);
  }
});

test("LG-10c: the files of public/ have no address, no fetch (except the one in net.js), no request object, no socket and no random number (the words as written, comments count)", () => {
  const dir = path.join(PICKER, "public");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
  assert.ok(files.includes("texts.js"));
  assert.ok(files.includes("net.js"));
  const banned = [
    "http://",
    "https://",
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "sendBeacon",
    "importScripts",
    "child_process",
    "Math.random",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    for (const word of banned) {
      // the one right to the word: the call of the network in net.js, and only one
      if (word === "fetch(" && file === "net.js") continue;
      assert.equal(text.includes(word), false, `${file}: ${word}`);
    }
  }
  const net = fs.readFileSync(path.join(dir, "net.js"), "utf8");
  assert.equal(net.split("fetch(").length - 1, 1, "net.js: exactly one fetch(");
});

test("LG-10d: the new modules (lang-check.js, view.js, shape.js, v3-check.js, public/texts.js, public/tenant-look.js) hold no word of a clock, of a random number or of the environment - they are pure (the words as written, comments count)", () => {
  const expression =
    /new Date|Date[.]now|Math[.]random|performance[.]now|process[.]env/u;
  for (const sample of [
    "new Date()",
    "Date.now()",
    "Math.random()",
    "performance.now()",
    "process.env.X",
  ]) {
    assert.equal(expression.test(`// ${sample}`), true, sample);
  }
  for (const file of [
    "lang-check.js",
    "view.js",
    "shape.js",
    "v3-check.js",
    path.join("public", "texts.js"),
    path.join("public", "tenant-look.js"),
  ]) {
    const text = fs.readFileSync(path.join(PICKER, file), "utf8");
    const found = text
      .split("\n")
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => expression.test(line));
    assert.deepEqual(found, [], file);
  }
});

// ---------------------------------------------------------------------- LG-R

// Every node of a value: [path, value].
function nodes(value, here = [], out = []) {
  out.push([here, value]);
  if (Array.isArray(value))
    value.forEach((v, i) => nodes(v, [...here, i], out));
  else if (value !== null && typeof value === "object")
    for (const k of Object.keys(value)) nodes(value[k], [...here, k], out);
  return out;
}
const SCALARS = [
  0,
  1,
  -1,
  2.5,
  1e21,
  true,
  false,
  null,
  "",
  "x",
  " ",
  "я".repeat(700),
  [],
  {},
  [1, 2],
  { ru: "а" },
];

function corruptAny(base, rng) {
  const doc = deepCopy(base);
  const all = nodes(doc).filter(([p]) => p.length > 0);
  const [where] = rng.pick(all);
  const op = rng.int(5);
  const parent = getAt(doc, where.slice(0, -1));
  if (op === 0) setAt(doc, where, deepCopy(rng.pick(SCALARS)));
  else if (op === 1) deleteAt(doc, where);
  else if (op === 2 && !Array.isArray(parent))
    setAt(
      doc,
      [
        ...where.slice(0, -1),
        rng.pick(["de", "RU", "ty", "extra", "__proto__"]),
      ],
      "Текст",
    );
  else if (op === 3) {
    const [, other] = rng.pick(all);
    setAt(doc, where, deepCopy(other));
  } else {
    const holder = getAt(doc, where);
    if (
      holder !== null &&
      typeof holder === "object" &&
      !Array.isArray(holder) &&
      Object.hasOwn(holder, "ru")
    ) {
      delete holder[rng.pick(LANGS)];
    } else setAt(doc, where, deepCopy(rng.pick(SCALARS)));
  }
  return doc;
}

test("LG-R1: 3000 broken objects of the form /2 (a value replaced, a language deleted or added, a node copied over another) - nothing is thrown, the code is 0 or 1, every place is told once, every line has the shape, at most 101 lines", () => {
  const rng = makeRng(61020);
  const base = minimal();
  let refused = 0;
  for (let i = 0; i < 3000; i++) {
    const doc = corruptAny(base, rng);
    const out = checkBytes(Buffer.from(JSON.stringify(doc), "utf8"), MINIMAL);
    assert.ok(out.exitCode === 0 || out.exitCode === 1, `case ${i}`);
    assert.deepEqual(out.stderr, [], `case ${i}`);
    if (out.exitCode === 0) continue;
    refused += 1;
    assert.ok(out.stdout.length <= 101, `case ${i}: ${out.stdout.length}`);
    assert.deepEqual(lineProblems(out.stdout), [], `case ${i}`);
    const places = out.stdout
      .filter((l) => !l.startsWith("И ещё"))
      .map((l) => l.split(": ")[1]);
    assert.equal(
      new Set(places).size,
      places.length,
      `case ${i}: a place twice: ${out.stdout.join(" | ")}`,
    );
  }
  assert.ok(refused > 2000, `refused ${refused}`);
});

test("LG-R2: the check does not change a deeply frozen /2 file and gives the same answer twice, for the good file and for broken ones", () => {
  const rng = makeRng(61021);
  const inputs = [
    [MINIMAL, deepFreeze(minimal())],
    ["uchet-pro.json", deepFreeze(readJson(demoPath("uchet-pro")))],
    ["svet-marketing.json", deepFreeze(readJson(demoPath("svet-marketing")))],
  ];
  for (let i = 0; i < 150; i++)
    inputs.push([MINIMAL, deepFreeze(corruptAny(minimal(), rng))]);
  for (const [fileName, input] of inputs) {
    const before = JSON.stringify(input);
    const a = validateTenant(input, { fileName });
    const b = validateTenant(input, { fileName });
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(input), before);
  }
  assert.deepEqual(validateTenant(inputs[0][1], { fileName: MINIMAL }), []);
  assert.deepEqual(
    validateTenant(inputs[1][1], { fileName: "uchet-pro.json" }),
    [],
  );
  // the view does not change a frozen file either
  assert.doesNotThrow(() => tenantInLanguage(inputs[1][1], "kk"));
});

test("LG-R3: all 19 kinds of place are found in the small file, and each place (all of them, one by one) replaced by a string gives exactly one line - 'a text of three languages is needed' at that place", () => {
  const base = minimal();
  const places = textPlaces(base);
  const kinds = new Set(places.map((p) => p.kind));
  assert.deepEqual([...kinds].sort(), [...PLACE_KINDS].sort());
  assert.equal(PLACE_KINDS.length, 19);
  for (const p of places) {
    const out = checkObject(setAt(minimal(), p.path, "Просто строка"));
    assert.deepEqual(
      out.stdout,
      [lineOf(MINIMAL, placeText(p.path), "E_FIELD", NEED)],
      placeText(p.path),
    );
  }
});

function bigTenant(extraRules) {
  const doc = minimal();
  const text = (n) => "😀".repeat(n);
  for (let i = 0; i < extraRules; i++) {
    const rule = deepCopy(doc.rules[0]);
    rule.id = `big-${i}`;
    rule.text = { ru: text(160), kk: text(160), en: text(160) };
    doc.rules.push(rule);
  }
  return doc;
}

test(
  "LG-R4: a /2 file of about 400 KB (200 rules of three long texts) is checked in time with code 0 or 1 and at most 101 lines; a file over 512 KB is refused with code 2 and one line, and stays",
  { timeout: 60000 },
  (t) => {
    const bytes = Buffer.from(JSON.stringify(bigTenant(200)), "utf8");
    assert.ok(
      bytes.length > 350000 && bytes.length < 524288,
      `${bytes.length}`,
    );
    const out = checkBytes(bytes, MINIMAL);
    assert.ok(out.exitCode === 0 || out.exitCode === 1);
    assert.ok(out.stdout.length <= 101);
    const dir = makeTmp(t);
    const file = put(dir, MINIMAL, bytes);
    const before = fileDigest(file);
    const run = runPicker(["check", file]);
    assert.ok(run.code === 0 || run.code === 1);
    assert.ok(run.out.length <= 101);
    assert.deepEqual(fileDigest(file), before);
    const huge = Buffer.from(JSON.stringify(bigTenant(260)), "utf8");
    assert.ok(huge.length > 524288, `${huge.length}`);
    const big = put(dir, "ok-lang-big.json", huge);
    const bigBefore = fileDigest(big);
    const refused = runPicker(["check", big]);
    assert.equal(refused.code, 2);
    assert.deepEqual(refused.out, []);
    assert.deepEqual(refused.err, [
      "picker: Файл ok-lang-big.json больше 512 КБ. Сократите его.",
    ]);
    assert.deepEqual(fileDigest(big), bigBefore);
  },
);
