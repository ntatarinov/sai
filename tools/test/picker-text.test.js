// TT-1 ... TT-10, TT-R1 ... TT-R3 and TP-9a ... TP-9c: the signs that a text for the visitor
// may not hold (design docs/design/REQ-068-picker-text-charset.md, section 11): control
// signs, invisible format signs, the separators of lines and paragraphs and a single half
// of a pair of surrogates. The list of the forbidden signs is written in
// picker-text-helpers.js as literals (Unicode 17.0), not taken from the code. A sign that
// is not a plain letter is written as \uXXXX in this file.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkBytes, checkFile } from "../src/picker/check.js";
import { ERROR_CODES } from "../src/picker/limits.js";
import { tame, show } from "../src/picker/places.js";
import { forbiddenSign } from "../src/picker/text-rules.js";
import { validateTenant } from "../src/picker/validate.js";
import { deepFreeze } from "./picker-engine-helpers.js";
import {
  DEMO_TENANTS,
  LEGACY_TENANTS,
  TOOLS,
  fileDigest,
  lineProblems,
  makeRng,
  makeTmp,
  put,
  runPicker,
} from "./picker-helpers.js";
import {
  ALLOWED_8,
  ALLOWED_OTHER,
  ALLOWED_RESIDUE,
  ASTRAL_FORBIDDEN,
  CC_SIGNS,
  CF_SIGNS,
  FORBIDDEN_14,
  FORBIDDEN_SET,
  FORBIDDEN_SIGNS,
  SIGN_TEXT,
  TEXT_EXPECTED,
  TEXT_FIXTURES,
  astralFromPair,
  hex,
  textFor,
  textLine,
} from "./picker-text-helpers.js";
import {
  PLACE_KINDS,
  placeText,
  setAt,
  textPlaces,
} from "./picker-lang-helpers.js";
import { spawnCli } from "./picker-server-helpers.js";

const LANGS = ["ru", "kk", "en"];
const IDS = ["uchet-pro", "svet-marketing"];
const readText = (file) => fs.readFileSync(file, "utf8");
const demoV2 = (id) =>
  JSON.parse(readText(path.join(DEMO_TENANTS, `${id}.json`)));
const demoV1 = (id) =>
  JSON.parse(readText(path.join(LEGACY_TENANTS, `${id}.json`)));
const sampleBytes = (name) => fs.readFileSync(path.join(TEXT_FIXTURES, name));
const sampleJson = (name) =>
  JSON.parse(readText(path.join(TEXT_FIXTURES, name)));
const chr = (code) => String.fromCodePoint(code);

// ---------------------------------------------------------------------- TT-1

test("TT-1a: the version of Unicode of this Node is 17.0 - the list of the forbidden signs and the numbers 232, 127 and 1048449 are those of that version; when the version changes, this test is red on purpose", () => {
  assert.equal(
    process.versions.unicode,
    "17.0",
    `Unicode is ${process.versions.unicode}, not 17.0: update the list of the format signs in picker-text-helpers.js and the numbers of the tests (decision 0076, item 10)`,
  );
});

test("TT-1b: for every value U+0000-U+10FFFF but the surrogates, the signs 'a' sign 'b', sign 'b' and 'a' sign are forbidden exactly for the 232 signs of the list - the code is the sign; the list of Cf equals what the engine calls Cf (else the test names the signs that differ)", () => {
  assert.equal(CC_SIGNS.length, 60);
  assert.equal(CF_SIGNS.length, 170);
  assert.equal(FORBIDDEN_SIGNS.length, 232);
  assert.equal(FORBIDDEN_SET.size, 232);
  const differ = [];
  let cc = 0;
  const wrongCf = new Set(CF_SIGNS);
  let forbidden = 0;
  let allowed = 0;
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const ch = String.fromCodePoint(code);
    if (/\p{Cf}/u.test(ch) !== wrongCf.has(code)) differ.push(hex(code));
    if (/\p{Cc}/u.test(ch)) cc += 1;
    const want = FORBIDDEN_SET.has(code);
    for (const text of [`а${ch}б`, `${ch}б`, `а${ch}`]) {
      const got = forbiddenSign(text);
      if (want) {
        if (got === null || got.unit !== code || got.half !== false)
          assert.fail(`${hex(code)} is forbidden: ${JSON.stringify(got)}`);
      } else if (got !== null) {
        assert.fail(`${hex(code)} is allowed: ${JSON.stringify(got)}`);
      }
    }
    if (want) forbidden += 1;
    else allowed += 1;
  }
  assert.deepEqual(
    differ,
    [],
    "the list of Cf differs from the engine at these signs",
  );
  assert.equal(cc, 65, "Cc is the 60 signs and the five white signs");
  assert.equal(forbidden, 232);
  assert.equal(allowed, 1111832);
  for (const code of [
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x202f, 0x2003, 0x3000, 0x0301,
    0xfe0f, 0xe000, 0xfffd, 0x1f600,
  ])
    assert.equal(forbiddenSign(`а${chr(code)}б`), null, hex(code));
});

test("TT-1c: each of the 2048 single code units U+D800-U+DFFF is forbidden in the middle, at the start and at the end of a text - half is true, the code is the unit", () => {
  for (let unit = 0xd800; unit <= 0xdfff; unit++) {
    const lone = String.fromCharCode(unit);
    for (const text of [`а${lone}б`, `${lone}б`, `а${lone}`, lone]) {
      const got = forbiddenSign(text);
      assert.deepEqual(got, { unit, half: true }, hex(unit));
    }
  }
});

test("TT-1d: all 1024 x 1024 pairs (high, low) - a pair is allowed, except the 127 that make a forbidden Cf sign outside the BMP; for those the code is the sign and half is false: 1048449 allowed, 127 forbidden", () => {
  const forbiddenAstral = new Set(ASTRAL_FORBIDDEN);
  assert.equal(forbiddenAstral.size, 127);
  let allowed = 0;
  let forbidden = 0;
  for (let hi = 0xd800; hi <= 0xdbff; hi++) {
    for (let lo = 0xdc00; lo <= 0xdfff; lo++) {
      const pair = String.fromCharCode(hi, lo);
      const code = astralFromPair(hi, lo);
      const got = forbiddenSign(pair);
      if (forbiddenAstral.has(code)) {
        forbidden += 1;
        if (got === null || got.unit !== code || got.half !== false)
          assert.fail(`${hex(code)}: ${JSON.stringify(got)}`);
      } else {
        allowed += 1;
        if (got !== null)
          assert.fail(`${hex(code)} is allowed: ${JSON.stringify(got)}`);
      }
    }
  }
  assert.equal(allowed, 1048449);
  assert.equal(forbidden, 127);
  assert.deepEqual(forbiddenSign(`а${chr(0xe0001)}б`), {
    unit: 0xe0001,
    half: false,
  });
  assert.deepEqual(forbiddenSign(chr(0x110bd)), { unit: 0x110bd, half: false });
  assert.equal(forbiddenSign(chr(0x1f600)), null);
});

test("TT-1e: a pair in the other order (low, high) is two single units - the first, the low one, is named; a high half at the end and a low half at the start are forbidden", () => {
  for (let hi = 0xd800; hi <= 0xdbff; hi += 1) {
    for (let lo = 0xdc00; lo <= 0xdfff; lo += 1) {
      const swapped = String.fromCharCode(lo, hi);
      const got = forbiddenSign(swapped);
      if (got === null || got.unit !== lo || got.half !== true)
        assert.fail(`${hex(lo)} ${hex(hi)}: ${JSON.stringify(got)}`);
    }
  }
  assert.deepEqual(forbiddenSign("а\ud83d"), { unit: 0xd83d, half: true });
  assert.deepEqual(forbiddenSign("\ude00а"), { unit: 0xde00, half: true });
});

test("TT-1f: the first forbidden sign from the left is named", () => {
  assert.deepEqual(forbiddenSign("а​\u0007б"), { unit: 0x200b, half: false });
  assert.deepEqual(forbiddenSign("\u0007​"), { unit: 0x0007, half: false });
  assert.deepEqual(forbiddenSign("😀\ud83d"), { unit: 0xd83d, half: true });
  assert.deepEqual(forbiddenSign("\ude00\ud83d"), { unit: 0xde00, half: true });
  assert.deepEqual(forbiddenSign("﻿"), { unit: 0xfeff, half: false });
  assert.equal(forbiddenSign("😀"), null);
  assert.equal(forbiddenSign("а\tб\nв"), null);
  assert.equal(forbiddenSign(""), null);
  assert.deepEqual(forbiddenSign(`x${chr(0xe0001)}y`), {
    unit: 0xe0001,
    half: false,
  });
});

// ---------------------------------------------------------------------- TT-2

// Every place of a text in the four files: [label, tenant, path] - a text in each language
// of the form /2 and the two single strings of the leads, in both forms.
function allSlots() {
  const slots = [];
  const forms = [
    ["v2", (id) => demoV2(id)],
    ["v1", (id) => demoV1(id)],
  ];
  for (const [form, load] of forms) {
    for (const id of IDS) {
      const tenant = load(id);
      for (const place of textPlaces(tenant)) {
        if (form === "v2") {
          for (const lang of LANGS)
            slots.push({
              form,
              id,
              tenant,
              kind: place.kind,
              path: [...place.path, lang],
            });
        } else {
          slots.push({ form, id, tenant, kind: place.kind, path: place.path });
        }
      }
      if (Object.hasOwn(tenant, "leads")) {
        for (const key of ["operator_name", "privacy_contact"])
          slots.push({ form, id, tenant, kind: key, path: ["leads", key] });
      }
    }
  }
  return slots;
}

function valueAt(root, pathList) {
  let here = root;
  for (const key of pathList) here = here[key];
  return here;
}

test("TT-2a: in all the places of the four files (the demo /2 and the copies /1) and each language, with each of the 14 signs as 'a' sign 'b': the check gives exactly one E_TEXT at that place with the text of the sign or of the half; the other languages give none (1192 places x 14 signs)", () => {
  const slots = allSlots();
  assert.equal(slots.length, 1192);
  const kinds = new Set(slots.map((s) => s.kind));
  for (const kind of PLACE_KINDS) assert.ok(kinds.has(kind), kind);
  assert.equal(FORBIDDEN_14.length, 14);
  for (const slot of slots) {
    const file = `${slot.id}.json`;
    const parent = valueAt(slot.tenant, slot.path.slice(0, -1));
    const key = slot.path.at(-1);
    const saved = parent[key];
    try {
      for (const unit of FORBIDDEN_14) {
        parent[key] = `а${String.fromCharCode(unit)}б`;
        const issues = validateTenant(slot.tenant, { fileName: file });
        const label = `${slot.form} ${placeText(slot.path)} ${hex(unit)}`;
        assert.equal(issues.length, 1, `${label}: ${JSON.stringify(issues)}`);
        assert.equal(issues[0].code, "E_TEXT", label);
        assert.equal(placeText(issues[0].path), placeText(slot.path), label);
        assert.equal(issues[0].text, textFor(unit), label);
      }
    } finally {
      parent[key] = saved;
    }
  }
});

test("TT-2b: the same places with the allowed signs - U+00A0, U+202F, U+2003, a tab, a line feed, two letters, a pair of the smiley - give no error", () => {
  const slots = allSlots();
  assert.equal(ALLOWED_8.length, 8);
  for (const slot of slots) {
    const file = `${slot.id}.json`;
    const parent = valueAt(slot.tenant, slot.path.slice(0, -1));
    const key = slot.path.at(-1);
    const saved = parent[key];
    try {
      for (const sign of ALLOWED_8) {
        parent[key] = `а${sign}б`;
        const issues = validateTenant(slot.tenant, { fileName: file });
        assert.deepEqual(
          issues,
          [],
          `${slot.form} ${placeText(slot.path)} ${JSON.stringify(sign)}`,
        );
      }
    } finally {
      parent[key] = saved;
    }
  }
});

test("TT-2c: for each of the 19 kinds of place in each of the 3 languages and the two single fields (59 files) the command through a process gives code 1 and exactly one line about U+200B at that place; one of them through npm", (t) => {
  const tenants = IDS.map((id) => ({ id, tenant: demoV2(id) }));
  const cases = [];
  for (const kind of PLACE_KINDS) {
    const found = tenants
      .map(({ id, tenant }) => ({
        id,
        tenant,
        place: textPlaces(tenant).find((p) => p.kind === kind),
      }))
      .find((x) => x.place !== undefined);
    assert.ok(found, kind);
    for (const lang of LANGS)
      cases.push({ id: found.id, path: [...found.place.path, lang] });
  }
  for (const key of ["operator_name", "privacy_contact"])
    cases.push({ id: "uchet-pro", path: ["leads", key] });
  assert.equal(cases.length, 59);
  const dir = makeTmp(t);
  cases.forEach((c, index) => {
    const tenant = demoV2(c.id);
    setAt(tenant, c.path, "а​б");
    const file = put(dir, `${c.id}.json`, JSON.stringify(tenant));
    const before = fileDigest(file);
    const run =
      index === 0
        ? runPicker(["check", file], { viaNpm: true })
        : runPicker(["check", file]);
    const label = `${c.id} ${placeText(c.path)}`;
    assert.equal(run.code, 1, label);
    assert.deepEqual(
      run.out,
      [textLine(`${c.id}.json`, placeText(c.path), 0x200b)],
      label,
    );
    assert.deepEqual(run.err, [], label);
    assert.deepEqual(fileDigest(file), before, `${label}: the file stays`);
  });
});

// ---------------------------------------------------------------------- TT-3

const SAMPLE_NAMES = Object.keys(TEXT_EXPECTED);

test("TT-3a: the folder of the samples is the 37 of the design, by name; the id of every .json sample is its name", () => {
  assert.equal(SAMPLE_NAMES.length, 37);
  assert.deepEqual(
    fs.readdirSync(TEXT_FIXTURES).sort(),
    [...SAMPLE_NAMES].sort(),
  );
  for (const name of SAMPLE_NAMES) {
    if (!name.endsWith(".json")) continue;
    assert.equal(sampleJson(name).id, name.replace(/[.]json$/u, ""), name);
    assert.ok(
      readText(path.join(TEXT_FIXTURES, name)).endsWith("\n"),
      `${name}: final newline`,
    );
  }
  assert.equal(SAMPLE_NAMES.filter((n) => n.startsWith("ok-")).length, 5);
});

function runSamples(t) {
  const dir = makeTmp(t);
  const out = new Map();
  for (const name of SAMPLE_NAMES) {
    const file = put(dir, name, sampleBytes(name));
    const before = fileDigest(file);
    const run = runPicker(["check", file]);
    assert.deepEqual(fileDigest(file), before, `${name}: the file stays`);
    out.set(name, run);
  }
  return out;
}

test("TT-3b: the samples with a mistake give code 1 and exactly the lines of the design in stdout, stderr empty; the lines have the shape of a line (a template, at most 18 words, a dot, no 'ты'), do not hold the forbidden sign and do not hold U+FFFD", (t) => {
  const runs = runSamples(t);
  for (const name of SAMPLE_NAMES) {
    const want = TEXT_EXPECTED[name];
    if (want.code !== 1) continue;
    const run = runs.get(name);
    assert.equal(run.code, 1, name);
    assert.deepEqual(run.out, want.lines, name);
    assert.deepEqual(run.err, [], name);
    assert.deepEqual(lineProblems(run.out), [], name);
    for (const unit of FORBIDDEN_SIGNS)
      assert.equal(
        run.stdout.includes(chr(unit)),
        false,
        `${name}: ${hex(unit)} in the output`,
      );
    assert.equal(
      run.stdout.includes("�"),
      false,
      `${name}: U+FFFD in the output`,
    );
  }
});

test("TT-3c: the samples that are right give code 0 and the line of success with the numbers of the file", (t) => {
  const runs = runSamples(t);
  for (const name of SAMPLE_NAMES) {
    if (!name.startsWith("ok-")) continue;
    const run = runs.get(name);
    assert.equal(run.code, 0, name);
    assert.deepEqual(run.out, TEXT_EXPECTED[name].lines, name);
    assert.deepEqual(run.err, [], name);
  }
});

test("TT-3d: a raw null byte and the raw bytes of a single surrogate in a file are still E_JSON (not E_TEXT) with the lines they had before", (t) => {
  const runs = runSamples(t);
  for (const name of ["e-json-raw-nul.txt", "e-json-raw-surrogate.txt"]) {
    const run = runs.get(name);
    assert.equal(run.code, 1, name);
    assert.deepEqual(run.out, TEXT_EXPECTED[name].lines, name);
    assert.doesNotMatch(run.stdout, /E_TEXT/u);
  }
  assert.ok(sampleBytes("e-json-raw-nul.txt").includes(0x00));
  assert.ok(
    sampleBytes("e-json-raw-surrogate.txt").includes(
      Buffer.from([0xed, 0xa0, 0x80]),
    ),
  );
});

test("TT-3e: in the output for the two samples that print a name with a single half there is no EF BF BD, the output is right UTF-8, and the half is an underscore", (t) => {
  const dir = makeTmp(t);
  for (const name of [
    "e-ref-lone-surrogate.json",
    "e-field-lone-surrogate-key.json",
  ]) {
    const file = put(dir, name, sampleBytes(name));
    const raw = spawnSync(
      process.execPath,
      [path.join(TOOLS, "src", "picker", "cli.js"), "check", file],
      { cwd: TOOLS },
    );
    assert.equal(raw.status, 1, name);
    assert.equal(
      raw.stdout.includes(Buffer.from([0xef, 0xbf, 0xbd])),
      false,
      `${name}: EF BF BD`,
    );
    const text = new TextDecoder("utf-8", { fatal: true }).decode(raw.stdout);
    assert.equal(text.trimEnd(), TEXT_EXPECTED[name].lines[0]);
    assert.ok(/s_x|a_b/u.test(text));
    assert.equal(raw.stderr.length, 0);
  }
});

test("TT-3f: the rule of words and of 'ты' works on a text without the sign, and the two ways of taking the sign out differ - 'glue' with a space instead of the sign is 40 words, with the sign deleted it is one word; 'ty' with the sign deleted is 'Ты тут', with a space it is 'Т ы тут'", () => {
  const glue = sampleJson("e-text-zwsp-glue-nomatch.json");
  const ty = sampleJson("e-text-zwsp-ty-intro.json");
  assert.ok(glue.result.no_match_text.ru.includes("​"));
  assert.ok(ty.intro.ru.includes("​"));
  const run = (tenant) =>
    checkBytes(
      Buffer.from(JSON.stringify(tenant), "utf8"),
      `${tenant.id}.json`,
    );
  // glue: the sign is replaced by a space
  const spaced = structuredClone(glue);
  spaced.result.no_match_text.ru = spaced.result.no_match_text.ru.replaceAll(
    "​",
    " ",
  );
  const a = run(spaced);
  assert.equal(a.exitCode, 1);
  assert.deepEqual(a.stdout, [
    "e-text-zwsp-glue-nomatch.json: result.no_match_text.ru: E_TEXT: Фраза длиннее 18 слов (в ней 40). Разбейте её точкой.",
  ]);
  // glue: the sign is deleted
  const deleted = structuredClone(glue);
  deleted.result.no_match_text.ru = deleted.result.no_match_text.ru.replaceAll(
    "​",
    "",
  );
  assert.equal(run(deleted).exitCode, 0);
  // ty: the sign is deleted
  const gone = structuredClone(ty);
  gone.intro.ru = gone.intro.ru.replaceAll("​", "");
  assert.equal(gone.intro.ru, "Ты тут");
  const b = run(gone);
  assert.equal(b.exitCode, 1);
  assert.deepEqual(b.stdout, [
    "e-text-zwsp-ty-intro.json: intro.ru: E_TEXT: Обращение не на «вы». Перепишите текст в форме «вы».",
  ]);
  // ty: the sign is replaced by a space - 'Т ы тут' is right
  const withSpace = structuredClone(ty);
  withSpace.intro.ru = withSpace.intro.ru.replaceAll("​", " ");
  assert.equal(withSpace.intro.ru, "Т ы тут");
  assert.equal(run(withSpace).exitCode, 0);
});

// ---------------------------------------------------------------------- TT-4

test("TT-4a: with a sign and 19 words the one line is about the sign; the same text without the sign is E_TEXT about 19 words", () => {
  const tenant = sampleJson("e-text-sign-and-long.json");
  assert.deepEqual(
    checkBytes(Buffer.from(JSON.stringify(tenant)), "e-text-sign-and-long.json")
      .stdout,
    TEXT_EXPECTED["e-text-sign-and-long.json"].lines,
  );
  tenant.intro.ru = tenant.intro.ru.replaceAll("​", "");
  const out = checkBytes(
    Buffer.from(JSON.stringify(tenant)),
    "e-text-sign-and-long.json",
  );
  assert.deepEqual(out.stdout, [
    "e-text-sign-and-long.json: intro.ru: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
  ]);
});

test("TT-4b: with a sign and 201 signs the one line is about the sign; without the sign it is E_LIMIT", () => {
  const tenant = sampleJson("e-text-sign-and-201.json");
  assert.deepEqual(
    checkBytes(Buffer.from(JSON.stringify(tenant)), "e-text-sign-and-201.json")
      .stdout,
    TEXT_EXPECTED["e-text-sign-and-201.json"].lines,
  );
  tenant.questions[0].title.ru = tenant.questions[0].title.ru.replaceAll(
    "​",
    "",
  );
  const out = checkBytes(
    Buffer.from(JSON.stringify(tenant)),
    "e-text-sign-and-201.json",
  );
  assert.deepEqual(out.stdout, [
    "e-text-sign-and-201.json: questions[0].title.ru: E_LIMIT: Знаков: 201, допустимо от 1 до 200. Исправьте текст.",
  ]);
});

test("TT-4c: 150 places with U+200B in one file give 100 lines and 'И ещё ошибок: 50.' - the lines in the order of the file, inside a text ru, kk, en; the samples with three languages and two places keep that order", () => {
  const tenant = demoV2("uchet-pro");
  const slots = textPlaces(tenant)
    .flatMap((p) => LANGS.map((l) => [...p.path, l]))
    .slice(0, 150);
  assert.equal(slots.length, 150);
  for (const slotPath of slots) setAt(tenant, slotPath, "а​б");
  const out = checkBytes(Buffer.from(JSON.stringify(tenant)), "uchet-pro.json");
  assert.equal(out.exitCode, 1);
  assert.equal(out.stdout.length, 101);
  slots.slice(0, 100).forEach((slotPath, i) => {
    assert.equal(
      out.stdout[i],
      textLine("uchet-pro.json", placeText(slotPath), 0x200b),
      `line ${i}`,
    );
  });
  assert.equal(out.stdout[100], "И ещё ошибок: 50.");
  assert.equal(out.stdout[0].split(": ")[1], "name.ru");
  assert.deepEqual(lineProblems(out.stdout), []);
});

test("TT-4d: every line of the output of the 31 samples with a mistake of the design and of the 59 + 150 cases above has the shape of a line", (t) => {
  const runs = runSamples(t);
  let lines = 0;
  for (const [name, run] of runs) {
    if (run.code === 1) assert.deepEqual(lineProblems(run.out), [], name);
    lines += run.out.length;
  }
  assert.ok(lines >= 36);
});

test("TT-4e: there are still ten codes of errors, the same, in the same order", () => {
  assert.equal(ERROR_CODES.length, 10);
  assert.deepEqual(
    [...ERROR_CODES],
    [
      "E_JSON",
      "E_FIELD",
      "E_ID",
      "E_DUP",
      "E_LIMIT",
      "E_REF",
      "E_ORDER",
      "E_COND",
      "E_UNREACHABLE",
      "E_TEXT",
    ],
  );
  const limits = readText(path.join(TOOLS, "src", "picker", "limits.js"));
  assert.equal((limits.match(/"E_/gu) ?? []).length, 10);
});

function longText(length) {
  const phrase = "Раз два три. ";
  return phrase.repeat(Math.ceil(length / phrase.length)).slice(0, length);
}

test("TT-4f: a sign in the tail of a long text is found - consent_text of 600 signs in ru and kk at positions 599, 550 and 299 and intro.en of 400 signs at 399 and 299, with U+200B, a single half and U+FEFF: one E_TEXT about the sign, not a length and not 18 words; the text without the sign is right", () => {
  const base = JSON.parse(
    readText(
      path.join(
        TOOLS,
        "test",
        "fixtures",
        "picker-lang",
        "ok-lang-minimal.json",
      ),
    ),
  );
  const check = (place, text) =>
    validateTenant(setAt(structuredClone(base), place, text), {
      fileName: "ok-lang-minimal.json",
    });
  const cases = [
    [["leads", "consent_text", "ru"], 600, [599, 550, 299]],
    [["leads", "consent_text", "kk"], 600, [599, 550, 299]],
    [["intro", "en"], 400, [399, 299]],
  ];
  for (const [place, length, positions] of cases) {
    const plain = longText(length);
    assert.equal([...plain].length, length);
    assert.deepEqual(
      check(place, plain),
      [],
      `${placeText(place)} without a sign`,
    );
    for (const position of positions) {
      for (const unit of [0x200b, 0xd800, 0xfeff]) {
        const text =
          plain.slice(0, position) +
          String.fromCharCode(unit) +
          plain.slice(position + 1);
        assert.equal(text.length, length);
        const issues = check(place, text);
        const label = `${placeText(place)} ${position} ${hex(unit)}`;
        assert.equal(issues.length, 1, label);
        assert.equal(issues[0].code, "E_TEXT", label);
        assert.equal(issues[0].text, textFor(unit), label);
        assert.equal(placeText(issues[0].path), placeText(place), label);
      }
    }
  }
});

// ---------------------------------------------------------------------- TT-5

test("TT-5a: the fictional tenants and the copies /1 pass the check - code 0 and the line with 12/5/39 and 11/5/37, through npm and directly", () => {
  const cases = [
    [
      path.join("src", "picker", "demo-tenants", "uchet-pro.json"),
      "uchet-pro",
      "12, решений 5, правил 39",
    ],
    [
      path.join("src", "picker", "demo-tenants", "svet-marketing.json"),
      "svet-marketing",
      "11, решений 5, правил 37",
    ],
    [
      path.join("test", "fixtures", "picker-legacy", "uchet-pro.json"),
      "uchet-pro",
      "12, решений 5, правил 39",
    ],
    [
      path.join("test", "fixtures", "picker-legacy", "svet-marketing.json"),
      "svet-marketing",
      "11, решений 5, правил 37",
    ],
  ];
  for (const [file, id, counts] of cases) {
    for (const viaNpm of [false, true]) {
      const run = runPicker(["check", file], { viaNpm });
      assert.equal(run.code, 0, file);
      assert.deepEqual(
        run.out,
        [`Файл арендатора ${id} в порядке: вопросов ${counts}.`],
        file,
      );
      assert.deepEqual(run.err, []);
    }
  }
});

test("TT-5b: in each of the 19 kinds of place (and in each language) 'a' sign 'b' with an allowed sign - the white signs, the spaces, letters, a pair, Co, Cn, Mn, U+FFFD and the rest of the invisible signs that are not forbidden today (U+3164, U+2800, U+034F, U+115F, U+1160, U+FFA0, U+17B4, U+17B5) - gives no error; the last eight are allowed by the decision for now (ISS-0085): when the ban is widened, this test is changed", () => {
  const tenants = IDS.map((id) => demoV2(id));
  const allowed = [...ALLOWED_8, ...ALLOWED_OTHER, ...ALLOWED_RESIDUE];
  assert.equal(allowed.length, 20);
  for (const kind of PLACE_KINDS) {
    const tenant = tenants.find((t) =>
      textPlaces(t).some((p) => p.kind === kind),
    );
    const place = textPlaces(tenant).find((p) => p.kind === kind);
    for (const lang of LANGS) {
      const target = [...place.path, lang];
      const saved = valueAt(tenant, target);
      try {
        for (const sign of allowed) {
          setAt(tenant, target, `а${sign}б`);
          assert.deepEqual(
            validateTenant(tenant, { fileName: `${tenant.id}.json` }),
            [],
            `${kind} ${lang} ${JSON.stringify(sign)}`,
          );
        }
      } finally {
        setAt(tenant, target, saved);
      }
    }
  }
  for (const code of [
    0x3164, 0x2800, 0x034f, 0x115f, 0x1160, 0xffa0, 0x17b4, 0x17b5,
  ])
    assert.equal(forbiddenSign(chr(code)), null, hex(code));
});

// ---------------------------------------------------------------------- TT-6

test("TT-6a: tame and show - 'a' single half 'b' is a_b, a pair stays, two single halves are two underscores, a half at the end and at the start; and the two samples through serve print no U+FFFD (the half is an underscore)", async (t) => {
  assert.equal(tame("a\ud800b"), "a_b");
  assert.equal(show("a\ud800b"), "a_b");
  assert.equal(tame("😀"), "😀");
  assert.equal(tame("\ude00\ud83d"), "__");
  assert.equal(tame("x\ud83d"), "x_");
  assert.equal(tame("\udc00x"), "_x");
  const dir = makeTmp(t);
  put(
    dir,
    "uchet-pro.json",
    fs.readFileSync(path.join(DEMO_TENANTS, "uchet-pro.json")),
  );
  for (const name of [
    "e-ref-lone-surrogate.json",
    "e-field-lone-surrogate-key.json",
  ])
    put(dir, name, sampleBytes(name));
  const run = spawnCli(t, ["serve", "--tenants", dir, "--port", "0"]);
  await run.waitLines(4);
  const err = run.stderr();
  assert.equal(err.includes("�"), false);
  assert.ok(
    err.includes("Арендатор e-ref-lone-surrogate.json не обслуживается:"),
  );
  assert.ok(err.includes("Решение s_x не найдено."));
  assert.ok(err.includes('["a_b"]: E_FIELD: Лишнее поле a_b. Удалите его.'));
  assert.equal((await run.stop("SIGTERM")).code, 0);
});

test("TT-6b: a U+FFFD that the tenant wrote in a value is shown as it is", () => {
  assert.equal(tame("a�b"), "a�b");
  assert.equal(show("a�b"), "a�b");
  const tenant = JSON.parse(
    readText(
      path.join(
        TOOLS,
        "test",
        "fixtures",
        "picker-lang",
        "ok-lang-minimal.json",
      ),
    ),
  );
  tenant["a�b"] = 1;
  const out = checkBytes(
    Buffer.from(JSON.stringify(tenant)),
    "ok-lang-minimal.json",
  );
  assert.equal(out.exitCode, 1);
  assert.deepEqual(out.stdout, [
    'ok-lang-minimal.json: ["a�b"]: E_FIELD: Лишнее поле a�b. Удалите его.',
  ]);
});

// ---------------------------------------------------------------------- TT-7

test("TT-7a: the list of the forbidden signs stands in one file of the picker - text-rules.js; no other file (comments count) holds an expression of it; validate.js and places.js take forbiddenSign from text-rules.js; check.js and lang-check.js hold none", () => {
  const dir = path.join(TOOLS, "src", "picker");
  const patterns = [
    /\\p\{Cc\}/u,
    /\\p\{Cf\}/u,
    /\\p\{Cs\}/u,
    /\\u2028/u,
    /\\u2029/u,
    /\\u200[Bb]/u,
    /\\u202[Ee]/u,
    /\\u[Ff][Ee][Ff][Ff]/u,
    /\\u0085/u,
  ];
  const found = new Map();
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const text = readText(path.join(dir, name));
    const hits = patterns.filter((re) => re.test(text)).map(String);
    if (hits.length > 0) found.set(name, hits);
  }
  assert.deepEqual([...found.keys()], ["text-rules.js"]);
  const rules = found.get("text-rules.js").join(" ");
  for (const word of ["Cc", "Cf", "Cs", "2028", "2029"])
    assert.ok(rules.includes(word), word);
  for (const name of ["validate.js", "places.js"]) {
    assert.match(
      readText(path.join(dir, name)),
      /import\s*\{[^}]*\bforbiddenSign\b[^}]*\}\s*from\s*"\.\/text-rules\.js"/u,
      name,
    );
  }
  for (const name of ["check.js", "lang-check.js"])
    assert.equal(found.has(name), false, name);
  // a sign by the old ways is gone from places.js: no 0x20 or 0x9f limits, no Cf
  const places = readText(path.join(dir, "places.js"));
  assert.doesNotMatch(places, /0x9f|0x7f|\\p\{C/u);
});

// ---------------------------------------------------------------------- TT-10

function readmeParagraph() {
  const readme = readText(path.join(TOOLS, "README.md"));
  const start = readme.indexOf(
    "## Сайт подбора решения: проверка файла арендатора",
  );
  assert.ok(start >= 0, "the section is there");
  const end = readme.indexOf("\n## ", start + 10);
  const section = readme.slice(start, end < 0 ? undefined : end);
  const paragraph = section
    .split(/\n\n/u)
    .find((p) => p.includes("E_TEXT") && p.includes("U+200B"));
  assert.ok(paragraph, "the paragraph about the forbidden signs");
  return paragraph;
}

test("TT-10a: the section of the README about the check of a file has the paragraph about the forbidden signs with the marks E_TEXT, U+200B, U+202E, U+00A0, U+202F and a smiley", () => {
  const paragraph = readmeParagraph();
  for (const mark of ["E_TEXT", "U+200B", "U+202E", "U+00A0", "U+202F", "😀"])
    assert.ok(paragraph.includes(mark), mark);
});

test("TT-10b: each phrase of that paragraph is not longer than 18 words and none addresses the reader as 'ты'", () => {
  const paragraph = readmeParagraph().replaceAll("\n", " ");
  const phrases = paragraph.split(/(?<=[.!?…])\s+/u);
  assert.ok(phrases.length >= 8);
  for (const phrase of phrases) {
    const words = phrase.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w));
    assert.ok(words.length <= 18, `${words.length} words: ${phrase}`);
  }
  assert.doesNotMatch(
    paragraph,
    /(^|[^\p{L}\p{N}])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои)(?![\p{L}\p{N}])/iu,
  );
});

// ---------------------------------------------------------------------- TT-R

test("TT-R1: tame on every one of the 1112064 values outside the surrogates equals the old rule written here - a white sign, a code below 0x20, 0x7F-0x9F or Cf becomes '_'", () => {
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    const ch = String.fromCodePoint(code);
    const old =
      code < 0x20 || (code >= 0x7f && code <= 0x9f) || /[\s\p{Cf}]/u.test(ch)
        ? "_"
        : ch;
    if (tame(ch) !== old)
      assert.fail(
        `${hex(code)}: ${JSON.stringify(tame(ch))} and not ${JSON.stringify(old)}`,
      );
  }
});

test(
  "TT-R2: forbiddenSign does not throw on 10000 random strings (single halves, pairs, controls), does not change what it is given, and gives the same twice; a string of a million signs that are nearly forbidden is looked at to the end at once",
  { timeout: 60000 },
  () => {
    const rng = makeRng(68002);
    const pieces = [
      "а",
      "\ud83d",
      "\ude00",
      "😀",
      "\u0007",
      "​",
      " ",
      "\t",
      "\n",
      "�",
      "ㅤ",
      " ",
      chr(0xe0001),
      chr(0x1f600),
      "\udc00",
      "x",
    ];
    for (let i = 0; i < 10000; i++) {
      let text = "";
      for (let k = rng.int(12); k >= 0; k--) text += rng.pick(pieces);
      const copy = `${text}`;
      const first = forbiddenSign(text);
      assert.deepEqual(forbiddenSign(text), first);
      assert.equal(text, copy);
      assert.ok(
        first === null ||
          (Number.isInteger(first.unit) && typeof first.half === "boolean"),
      );
    }
    const big = (unit, tail) =>
      unit.repeat(Math.floor(1_000_000 / unit.length)) + tail;
    for (const unit of [" ", "\t\n\u000b\f\r", "😀", "а", "�", "ㅤ", " "]) {
      const started = Date.now();
      assert.equal(forbiddenSign(big(unit, "x")), null);
      assert.deepEqual(forbiddenSign(big(unit, "​")), {
        unit: 0x200b,
        half: false,
      });
      assert.deepEqual(forbiddenSign(big(unit, "\ud83d")), {
        unit: 0xd83d,
        half: true,
      });
      assert.ok(Date.now() - started < 20000, "a million signs");
    }
    // a million signs as a text of a tenant: the error is one line, at once
    const tenant = JSON.parse(
      readText(
        path.join(
          TOOLS,
          "test",
          "fixtures",
          "picker-lang",
          "ok-lang-minimal.json",
        ),
      ),
    );
    setAt(tenant, ["intro", "ru"], big("а", "​"));
    const issues = validateTenant(tenant, { fileName: "ok-lang-minimal.json" });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].text, SIGN_TEXT(0x200b));
  },
);

test("TT-R3: validateTenant does not change a deeply frozen file with a forbidden sign in every place, and gives exactly one error for each place", () => {
  const slots = [];
  for (const id of IDS) {
    const tenant = demoV2(id);
    const targets = [];
    for (const place of textPlaces(tenant))
      for (const lang of LANGS) targets.push([...place.path, lang]);
    if (Object.hasOwn(tenant, "leads"))
      for (const key of ["operator_name", "privacy_contact"])
        targets.push(["leads", key]);
    targets.forEach((target, i) => {
      const unit = FORBIDDEN_14[i % FORBIDDEN_14.length];
      setAt(tenant, target, `а${String.fromCharCode(unit)}б`);
      slots.push([id, target, unit]);
    });
    const text = JSON.stringify(tenant);
    deepFreeze(tenant);
    const first = validateTenant(tenant, { fileName: `${id}.json` });
    const second = validateTenant(tenant, { fileName: `${id}.json` });
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(tenant), text);
    const mine = slots.filter(([who]) => who === id);
    assert.equal(first.length, mine.length);
    const byPlace = new Map(
      first.map((issue) => [placeText(issue.path), issue]),
    );
    assert.equal(byPlace.size, first.length, "one error for a place");
    for (const [, target, unit] of mine) {
      const issue = byPlace.get(placeText(target));
      assert.ok(issue, placeText(target));
      assert.equal(issue.code, "E_TEXT");
      assert.equal(issue.text, textFor(unit));
    }
  }
});

// ---------------------------------------------------------------------- TP-9

const SAMPLE_FOLDERS = [
  TEXT_FIXTURES,
  path.join(TOOLS, "test", "fixtures", "picker-lang"),
  LEGACY_TENANTS,
];

function randomSign(rng) {
  const roll = rng.next();
  if (roll < 0.2) return String.fromCharCode(0xd800 + rng.int(0x800));
  const plane = rng.int(17);
  for (;;) {
    const code = plane * 0x10000 + rng.int(0x10000);
    if (code < 0x20 && rng.next() < 0.9) continue;
    if (code >= 0xd800 && code <= 0xdfff) continue;
    return String.fromCodePoint(code);
  }
}

function damagedFiles(count) {
  const rng = makeRng(68001);
  const files = SAMPLE_FOLDERS.flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(dir, f)),
  );
  const out = [];
  while (out.length < count) {
    const file = rng.pick(files);
    const tenant = JSON.parse(readText(file));
    const slots = textPlaces(tenant).flatMap((p) =>
      typeof p.value === "string" ? [p.path] : LANGS.map((l) => [...p.path, l]),
    );
    if (slots.length === 0) continue;
    for (let n = 1 + rng.int(3); n > 0; n--) {
      const slot = rng.pick(slots);
      const text = valueAt(tenant, slot);
      if (typeof text !== "string") continue;
      const at = rng.int(text.length + 1);
      setAt(tenant, slot, text.slice(0, at) + randomSign(rng) + text.slice(at));
    }
    let bytes = Buffer.from(JSON.stringify(tenant), "utf8");
    if (out.length % 5 === 4) {
      const where = rng.int(bytes.length);
      bytes = Buffer.from(bytes);
      bytes[where] = rng.int(256);
    }
    out.push({ bytes, name: `${tenant.id}.json` });
  }
  return out;
}

test("TP-9a: 1000 damaged files (seed 68001) - samples with one to three signs of any plane or a single half inserted, in every fifth also a damaged byte: only code 0 or 1, stderr empty, no line of a stack, every line has the shape, at most 101 lines, the output is well-formed and holds no U+FFFD that the input did not hold; 40 of them through a process", (t) => {
  const files = damagedFiles(1000);
  const codes = new Set();
  for (const { bytes, name } of files) {
    const out = checkBytes(bytes, name);
    codes.add(out.exitCode);
    assert.ok(out.exitCode === 0 || out.exitCode === 1, name);
    assert.deepEqual(out.stderr, [], name);
    assert.equal(
      out.stdout.some((l) => l.startsWith("    at ")),
      false,
    );
    if (out.exitCode === 1)
      assert.deepEqual(lineProblems(out.stdout), [], name);
    assert.ok(out.stdout.length <= 101);
    const text = out.stdout.join("\n");
    assert.equal(text.isWellFormed(), true, name);
    if (!bytes.toString("utf8").includes("�"))
      assert.equal(text.includes("�"), false, name);
  }
  assert.deepEqual([...codes].sort(), [0, 1]);
  const dir = makeTmp(t);
  files.slice(0, 40).forEach(({ bytes, name }, i) => {
    const file = put(dir, name, bytes);
    const before = fileDigest(file);
    const run = runPicker(["check", file]);
    assert.ok(run.code === 0 || run.code === 1, `${i} ${name}: ${run.code}`);
    assert.deepEqual(run.err, [], name);
    if (run.code === 1) assert.deepEqual(lineProblems(run.out), [], name);
    assert.deepEqual(fileDigest(file), before);
  });
});

test("TP-9b: a file beside a file with a forbidden sign is checked alone - uchet-pro.json is code 0 and the sample stays code 1", (t) => {
  const dir = makeTmp(t);
  const good = put(
    dir,
    "uchet-pro.json",
    fs.readFileSync(path.join(DEMO_TENANTS, "uchet-pro.json")),
  );
  const bad = put(
    dir,
    "e-text-nul-name-ru.json",
    sampleBytes("e-text-nul-name-ru.json"),
  );
  const before = [good, bad].map(fileDigest);
  const a = runPicker(["check", good]);
  assert.equal(a.code, 0);
  assert.deepEqual(a.out, [
    "Файл арендатора uchet-pro в порядке: вопросов 12, решений 5, правил 39.",
  ]);
  const b = runPicker(["check", bad]);
  assert.equal(b.code, 1);
  assert.deepEqual(b.out, TEXT_EXPECTED["e-text-nul-name-ru.json"].lines);
  assert.deepEqual([good, bad].map(fileDigest), before);
  assert.equal(checkFile(good).exitCode, 0);
});

test(
  "TP-9c: the command npm run traces gives code 0 - the samples and the tests hold no path of this computer, no name of a model project, no secret",
  { timeout: 120000 },
  () => {
    const run = spawnSync("npm", ["run", "-s", "traces"], {
      cwd: TOOLS,
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      timeout: 110000,
    });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /следов 0/u);
  },
);
