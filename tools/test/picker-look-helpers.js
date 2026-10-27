// Helpers of the tests of the look of a tenant (design REQ-069, 11.2). Not a test file.
// The oracles here are written from the description of the requirement and share nothing
// with src/picker/: the contrast of two colours, the test of a letter or a digit, the
// catalogues, the texts of the messages, the expected look and questionnaire of a file
// of the form /3, and the expected output of every sample as literal lines.
import fs from "node:fs";
import path from "node:path";
import { checkBytes } from "../src/picker/check.js";
import { TOOLS, makeTmp } from "./picker-helpers.js";
import { deleteAt, setAt } from "./picker-lang-helpers.js";

const copyPlain = (value) => structuredClone(value);

export const LOOK_FIXTURES = path.join(
  TOOLS,
  "test",
  "fixtures",
  "picker-look",
);
export const LANGS = ["ru", "kk", "en"];
export const MINIMAL = "ok-minimal";

export const lookFixture = (name) => path.join(LOOK_FIXTURES, `${name}.json`);
export const lookFixtureBytes = (name) => fs.readFileSync(lookFixture(name));
export const lookFixtureJson = (name) =>
  JSON.parse(lookFixtureBytes(name).toString("utf8"));
export const lookFixtureNames = () =>
  fs
    .readdirSync(LOOK_FIXTURES)
    .sort()
    .map((f) => f.replace(/\.json$/u, ""));

// A deep copy of the minimal file of the form /3.
export const minimal3 = () => copyPlain(lookFixtureJson(MINIMAL));

// ------------------------------------------------------------- the catalogues (literals)

export const OBJECT_IDS = [
  "shelf",
  "shop",
  "boxes",
  "monitor",
  "laptop",
  "scanner",
  "tsd",
  "clip",
  "bell",
  "phone",
  "cell",
  "headset",
  "poster",
  "coins",
  "chart",
];
export const FIGURES = [
  "f01",
  "f02",
  "f03",
  "f04",
  "f05",
  "f06",
  "f07",
  "f08",
  "f09",
  "f10",
  "f11",
  "f12",
];
export const SHIRTS = ["accent", "accent2", "ink"];
export const GLYPHS = ["tool", "box", "house", "cap"];
export const SHEETS = { light: "#f3f5f9", dark: "#161f2e" };
export const NEUTRAL = {
  light: { accent: "#35607f", accent2: "#7a5c2e" },
  dark: { accent: "#8fb4d8", accent2: "#c9b48c" },
};
// What each object may carry (design 5.5): level range or null, tag, glyph.
export const OBJECT_PARAMS = {
  shelf: { level: [1, 3], tag: false, glyph: false },
  shop: { level: null, tag: false, glyph: false },
  boxes: { level: [1, 4], tag: false, glyph: false },
  monitor: { level: null, tag: true, glyph: false },
  laptop: { level: null, tag: true, glyph: false },
  scanner: { level: null, tag: false, glyph: false },
  tsd: { level: null, tag: false, glyph: false },
  clip: { level: null, tag: false, glyph: false },
  bell: { level: null, tag: false, glyph: false },
  phone: { level: null, tag: false, glyph: false },
  cell: { level: null, tag: true, glyph: false },
  headset: { level: null, tag: false, glyph: false },
  poster: { level: null, tag: false, glyph: true },
  coins: { level: [1, 4], tag: false, glyph: false },
  chart: { level: [1, 4], tag: false, glyph: false },
};

// ------------------------------------------------------------- the contrast (own function)

// The relative luminance of "#rrggbb" by WCAG 2.x. The channel threshold here is the
// older 0.03928; for 8-bit channels both constants give the same verdict.
export function luminance(color) {
  const channel = (hex) => {
    const s = parseInt(hex, 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(color.slice(1, 3));
  const g = channel(color.slice(3, 5));
  const b = channel(color.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hex2 = (n) => n.toString(16).padStart(2, "0");
export const colorOf = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

// The colours of the whole space that are closest to 3.0 : 1 with a sheet: the closest at
// or above and the closest below. One pass over 16 777 216 colours with a table of the
// linear values of the channels.
export function boundaryColors(sheet) {
  const linear = new Float64Array(256);
  for (let c = 0; c < 256; c++) {
    const s = c / 255;
    linear[c] = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }
  const ls = luminance(sheet);
  let above = { color: null, ratio: Infinity };
  let below = { color: null, ratio: 0 };
  for (let r = 0; r < 256; r++) {
    const lr = 0.2126 * linear[r];
    for (let g = 0; g < 256; g++) {
      const lg = lr + 0.7152 * linear[g];
      for (let b = 0; b < 256; b++) {
        const l = lg + 0.0722 * linear[b];
        const ratio =
          l > ls ? (l + 0.05) / (ls + 0.05) : (ls + 0.05) / (l + 0.05);
        if (ratio >= 3 && ratio < above.ratio)
          above = { color: [r, g, b], ratio };
        else if (ratio < 3 && ratio > below.ratio)
          below = { color: [r, g, b], ratio };
      }
    }
  }
  return {
    above: { color: colorOf(...above.color), ratio: above.ratio },
    below: { color: colorOf(...below.color), ratio: below.ratio },
  };
}

// ------------------------------------------------------------- signs (own tests)

const SIGN_CLASS = /^(?:\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nd})$/u;
// One code point that is a letter or a decimal digit.
export const isLetterOrDigit = (ch) =>
  typeof ch === "string" && [...ch].length === 1 && SIGN_CLASS.test(ch);

// A sign that a text for the visitor may not hold (decision 0076): a control sign except
// the tab, line and carriage signs, a format sign, the line and paragraph separators and
// a single half of a pair.
export const isForbiddenSign = (cp) =>
  (cp >= 0 && cp <= 8) ||
  (cp >= 0x0e && cp <= 0x1f) ||
  (cp >= 0x7f && cp <= 0x9f) ||
  cp === 0x2028 ||
  cp === 0x2029 ||
  (cp >= 0xd800 && cp <= 0xdfff) ||
  cp === 0xad ||
  (cp >= 0x600 && cp <= 0x605) ||
  cp === 0x61c ||
  cp === 0x6dd ||
  cp === 0x70f ||
  cp === 0x180e ||
  (cp >= 0x200b && cp <= 0x200f) ||
  (cp >= 0x202a && cp <= 0x202e) ||
  (cp >= 0x2060 && cp <= 0x2064) ||
  (cp >= 0x2066 && cp <= 0x206f) ||
  cp === 0xfeff ||
  (cp >= 0xfff9 && cp <= 0xfffb);

// The verdict that a staff name must get (design D10, decision 0085 item 2): a forbidden
// sign - E_TEXT; 0 or more than 30 signs after the spaces at the ends are cut - E_LIMIT;
// a sign outside the letters, marks, digits, space, hyphen, apostrophes and dot - E_FIELD;
// else null. The class is tested on the whole value, not on the cut one.
export function staffNameVerdict(name) {
  const signs = [...name];
  if (signs.some((ch) => isForbiddenSign(ch.codePointAt(0)))) return "E_TEXT";
  const cut = [...name.trim()].length;
  if (cut < 1 || cut > 30) return "E_LIMIT";
  const allowed = (ch) =>
    isLetterOrDigit(ch) ||
    /^\p{M}$/u.test(ch) ||
    [" ", "-", "'", "’", "."].includes(ch);
  return signs.every(allowed) ? null : "E_FIELD";
}

// ------------------------------------------------------------- the texts of the messages

const OBJECT_LIST = OBJECT_IDS.join(", ");
const FIGURE_LIST = FIGURES.join(", ");

// The catalogue of design 6.4: the whole text of each message, written here.
export const MSG = {
  M01: (name) => `Нет поля ${name}. Добавьте его.`,
  M02: (name) => `Лишнее поле ${name}. Удалите его.`,
  M03: "Ожидается объект. Исправьте значение.",
  M04: "Ожидается целое число. Исправьте значение.",
  M05: (n) => `Знаков: ${n}, нужен ровно 1. Оставьте одну букву или цифру.`,
  M06: "Нужна буква или цифра любого алфавита. Исправьте значение.",
  M07: (n, a, b) => `Знаков: ${n}, допустимо от ${a} до ${b}. Исправьте текст.`,
  M08: (lang) => `Нет перевода на ${lang}. Добавьте текст на этом языке.`,
  M09: "Нужен текст на трёх языках: ru, kk и en. Исправьте значение.",
  M10: (n) => `Фраза длиннее 18 слов (в ней ${n}). Разбейте её точкой.`,
  M11: "Обращение не на «вы». Перепишите текст в форме «вы».",
  M12: (code) =>
    `Недопустимый знак ${code} (невидимый или управляющий). Удалите его из текста.`,
  M13: (n, k) => `Элементов: ${n}, нужно ровно ${k}. Исправьте список.`,
  M14: "Имя — только буквы, цифры, пробел, дефис, апостроф и точка. Исправьте значение.",
  M15: `Допустимо только: ${FIGURE_LIST}. Исправьте значение.`,
  M16: "Допустимо только: accent, accent2, ink. Исправьте значение.",
  M17: "Цвет записывается как «#» и шесть строчных шестнадцатеричных цифр, например #1f7a8c. Исправьте значение.",
  M18: "Контраст цвета с листом светлой темы меньше 3,0 : 1. Возьмите цвет темнее.",
  M19: "Контраст цвета с листом тёмной темы меньше 3,0 : 1. Возьмите цвет светлее.",
  M20: `Допустимо только: ${OBJECT_LIST}.`,
  M21: (n, a, b) =>
    `Число ${n} вне границ от ${a} до ${b}. Исправьте значение.`,
  M22: "Допустимы только буквы и цифры, без пробелов. Исправьте значение.",
  M23: "Допустимо только: tool, box, house, cap. Исправьте значение.",
  M24: "Стол задан не у всех вопросов. Добавьте поле desk.",
  M25: "Номер стола меньше, чем у предыдущего вопроса. Не уменьшайте его.",
  M26: (n) => `Элементов: ${n}, допустимо от 0 до 4. Исправьте список.`,
  M27: (n) => `Число ${n} уже есть в chips. Оставьте одно.`,
  M28: "Числа должны идти по возрастанию. Поставьте это число правее.",
  M29: "Допустимо только: phone, telegram, email. Исправьте значение.",
  M30: (name) => `Способ связи ${name} указан дважды. Оставьте один.`,
  M31: "Номер WhatsApp — только цифры, без плюса и пробелов. Исправьте значение.",
  M32: (n) => `Цифр: ${n}, допустимо от 10 до 15. Исправьте номер.`,
  M33: "Допустимо только: sai-picker-tenant/1, sai-picker-tenant/2 или sai-picker-tenant/3. Исправьте значение.",
  M34: "Элементов: 0, допустимо от 1 до 3. Исправьте список.",
  M35: "Допустимо только: phone, email. Исправьте значение.",
  M36: "Ожидается строка. Исправьте значение.",
  M37: (code) => `Непарная половина знака ${code}. Удалите её из текста.`,
};
export const MESSAGE_IDS = Object.keys(MSG);

// ------------------------------------------------------------- lines and checks in memory

export const okLine = (id, n = 4, s = 2, r = 3) =>
  `Файл арендатора ${id} в порядке: вопросов ${n}, решений ${s}, правил ${r}.`;
export const lineOf = (file, place, code, text) =>
  `${file}: ${place}: ${code}: ${text}`;

// The check of a plain value as a file with the given name: { code, lines }.
export function checkDoc(doc, name = `${MINIMAL}.json`) {
  const out = checkBytes(Buffer.from(JSON.stringify(doc), "utf8"), name);
  return { code: out.exitCode, lines: out.stdout };
}

// A copy of the minimal file with changes: [[path, value], ...]; the value `undefined`
// removes the key.
export function changed(edits, base = minimal3()) {
  const doc = copyPlain(base);
  for (const [at, value] of edits) {
    if (value === undefined) deleteAt(doc, at);
    else setAt(doc, at, value);
  }
  return doc;
}

// The check of a plain value against expected rows [place, code, text]: no rows - code 0
// and the one line of an accepted file; else code 1 and exactly these lines, in order.
export function checkRows(doc, rows, name = `${MINIMAL}.json`) {
  const got = checkDoc(doc, name);
  if (rows.length === 0)
    return {
      got,
      want: { code: 0, lines: [okLine(name.replace(/\.json$/u, ""))] },
    };
  return {
    got,
    want: {
      code: 1,
      lines: rows.map(([place, code, text]) => lineOf(name, place, code, text)),
    },
  };
}

// The body of the form /2 (design 10.2): the minimal file with schema /2 and the eight
// items of /3 removed: look, desk, chips, object, whatsapp, max_per_hour, max_stored and
// telegram.
export function v2Body(base = minimal3()) {
  const doc = copyPlain(base);
  doc.schema = "sai-picker-tenant/2";
  delete doc.look;
  for (const q of doc.questions) {
    delete q.desk;
    delete q.chips;
    for (const option of q.options ?? []) delete option.object;
  }
  delete doc.leads.whatsapp;
  delete doc.leads.max_per_hour;
  delete doc.leads.max_stored;
  doc.leads.contact_fields = doc.leads.contact_fields.filter(
    (x) => x !== "telegram",
  );
  return doc;
}

// ------------------------------------------------------------- the expected output of the samples

export const LOOK_EXPECTED = {};
const ok = (name) => {
  LOOK_EXPECTED[name] = { code: 0, lines: [okLine(name)] };
};
const bad = (name, ...rows) => {
  LOOK_EXPECTED[name] = {
    code: 1,
    lines: rows.map(([place, code, text]) =>
      lineOf(`${name}.json`, place, code, text),
    ),
  };
};
const REPEAT3 = (field, n, a, b) =>
  LANGS.map((l) => [`look.${field}.${l}`, "E_LIMIT", MSG.M07(n, a, b)]);

// Look: presence and form
ok("ok-minimal");
ok("ok-no-tagline");
bad("e-look-missing", ["look", "E_FIELD", MSG.M01("look")]);
bad("e-look-string", ["look", "E_FIELD", MSG.M03]);
bad("e-look-extra", ["look.logo", "E_FIELD", MSG.M02("logo")]);
bad("e-look-staff-extra", ["look.team[0].age", "E_FIELD", MSG.M02("age")]);
bad("e-v2-with-look", ["look", "E_FIELD", MSG.M02("look")]);
bad(
  "e-v2-with-v3-fields",
  ["questions[0].options[0].object", "E_FIELD", MSG.M02("object")],
  ["questions[0].desk", "E_FIELD", MSG.M02("desk")],
  ["questions[2].chips", "E_FIELD", MSG.M02("chips")],
  ["leads.contact_fields[1]", "E_FIELD", MSG.M35],
  ["leads.whatsapp", "E_FIELD", MSG.M02("whatsapp")],
  ["leads.max_per_hour", "E_FIELD", MSG.M02("max_per_hour")],
  ["leads.max_stored", "E_FIELD", MSG.M02("max_stored")],
);

// Mark and the length of the look texts
bad("e-mark-empty", ["look.mark", "E_LIMIT", MSG.M05(0)]);
bad("e-mark-two", ["look.mark", "E_LIMIT", MSG.M05(2)]);
bad("e-mark-space", ["look.mark", "E_FIELD", MSG.M06]);
bad("e-mark-emoji", ["look.mark", "E_FIELD", MSG.M06]);
bad("e-mark-dash", ["look.mark", "E_FIELD", MSG.M06]);
bad("e-mark-half", ["look.mark", "E_FIELD", MSG.M06]);
bad("e-tagline-41", ...REPEAT3("tagline", 41, 1, 40));
bad("e-industry-61", ...REPEAT3("industry", 61, 1, 60));
bad("e-headline-121", ...REPEAT3("headline", 121, 1, 120));
bad("e-headline-no-kk", ["look.headline.kk", "E_FIELD", MSG.M08("kk")]);
bad("e-headline-string", ["look.headline", "E_FIELD", MSG.M09]);

// Texts of the look
bad(
  "e-words-19",
  ["look.industry.en", "E_TEXT", MSG.M10(19)],
  ["look.headline.kk", "E_TEXT", MSG.M10(19)],
  ["look.team[1].role.ru", "E_TEXT", MSG.M10(19)],
);
bad("e-text-ty", ["look.team[0].says.ru", "E_TEXT", MSG.M11]);
bad(
  "e-text-sign",
  ["look.headline.en", "E_TEXT", MSG.M12("U+0007")],
  ["look.team[0].name", "E_TEXT", MSG.M12("U+200B")],
  ["look.team[1].says.kk", "E_TEXT", MSG.M37("U+D800")],
);

// Team
bad("e-team-3", ["look.team", "E_LIMIT", MSG.M13(3, 4)]);
bad("e-team-5", ["look.team", "E_LIMIT", MSG.M13(5, 4)]);
bad("e-staff-no-figure", ["look.team[2].figure", "E_FIELD", MSG.M01("figure")]);
bad("e-staff-name-31", ["look.team[0].name", "E_LIMIT", MSG.M07(31, 1, 30)]);
bad("e-staff-name-empty", ["look.team[0].name", "E_LIMIT", MSG.M07(0, 1, 30)]);
bad("e-staff-name-url", ["look.team[0].name", "E_FIELD", MSG.M14]);
bad("e-figure-f00", ["look.team[0].figure", "E_REF", MSG.M15]);
bad("e-figure-f13", ["look.team[1].figure", "E_REF", MSG.M15]);
bad("e-figure-capital", ["look.team[2].figure", "E_REF", MSG.M15]);
bad("e-shirt-red", ["look.team[3].shirt", "E_REF", MSG.M16]);

// Colours
bad("e-color-upper", ["look.colors.light.accent", "E_FIELD", MSG.M17]);
bad("e-color-short", ["look.colors.light.accent", "E_FIELD", MSG.M17]);
bad("e-color-url", ["look.colors.dark.accent2", "E_FIELD", MSG.M17]);
bad("e-color-number", ["look.colors.dark.accent", "E_FIELD", MSG.M17]);
bad("e-colors-no-dark", ["look.colors.dark", "E_FIELD", MSG.M01("dark")]);
bad("e-colors-no-accent2", [
  "look.colors.light.accent2",
  "E_FIELD",
  MSG.M01("accent2"),
]);
bad("e-colors-extra", ["look.colors.sepia", "E_FIELD", MSG.M02("sepia")]);
bad("e-contrast-light", ["look.colors.light.accent", "E_LIMIT", MSG.M18]);
bad("e-contrast-dark", ["look.colors.dark.accent2", "E_LIMIT", MSG.M19]);

// Objects
const OBJ = "questions[0].options[0].object";
bad("e-object-unknown", [`${OBJ}.id`, "E_REF", MSG.M20]);
bad("e-object-number", [`${OBJ}.id`, "E_REF", MSG.M20]);
bad("e-object-string", [OBJ, "E_FIELD", MSG.M03]);
bad("e-object-extra", [`${OBJ}.size`, "E_FIELD", MSG.M02("size")]);
bad("e-object-level-0", [`${OBJ}.level`, "E_LIMIT", MSG.M21(0, 1, 3)]);
bad("e-object-level-4-shelf", [`${OBJ}.level`, "E_LIMIT", MSG.M21(4, 1, 3)]);
bad("e-object-level-5-boxes", [
  "questions[1].options[0].object.level",
  "E_LIMIT",
  MSG.M21(5, 1, 4),
]);
bad("e-object-level-phone", [`${OBJ}.level`, "E_FIELD", MSG.M02("level")]);
bad("e-object-tag-4", [
  "questions[0].options[1].object.tag",
  "E_LIMIT",
  MSG.M07(4, 1, 3),
]);
bad("e-object-tag-empty", [
  "questions[0].options[1].object.tag",
  "E_LIMIT",
  MSG.M07(0, 1, 3),
]);
bad("e-object-tag-space", [
  "questions[0].options[1].object.tag",
  "E_FIELD",
  MSG.M22,
]);
bad("e-object-tag-poster", [
  "questions[3].options[0].object.tag",
  "E_FIELD",
  MSG.M02("tag"),
]);
bad("e-object-glyph-star", [
  "questions[3].options[0].object.glyph",
  "E_FIELD",
  MSG.M23,
]);
bad("e-object-glyph-monitor", [
  "questions[0].options[1].object.glyph",
  "E_FIELD",
  MSG.M02("glyph"),
]);
bad("e-object-on-number-options", [
  "questions[2].options",
  "E_FIELD",
  MSG.M02("options"),
]);

// Desks and chips
bad("e-desk-0", ["questions[0].desk", "E_LIMIT", MSG.M21(0, 1, 4)]);
bad("e-desk-5", ["questions[0].desk", "E_LIMIT", MSG.M21(5, 1, 4)]);
bad("e-desk-fraction", ["questions[0].desk", "E_FIELD", MSG.M04]);
bad("e-desk-string", ["questions[0].desk", "E_FIELD", MSG.M04]);
bad("e-desk-empty-value", ["questions[0].desk", "E_FIELD", MSG.M04]);
bad("e-desk-partial", ["questions[2].desk", "E_FIELD", MSG.M24]);
bad("e-desk-order", ["questions[2].desk", "E_ORDER", MSG.M25]);
ok("ok-desk-flat");
bad("e-chips-single", ["questions[0].chips", "E_FIELD", MSG.M02("chips")]);
bad("e-chips-5", ["questions[2].chips", "E_LIMIT", MSG.M26(5)]);
bad("e-chips-range", [
  "questions[2].chips[1]",
  "E_LIMIT",
  MSG.M21(1001, 1, 1000),
]);
bad("e-chips-fraction", ["questions[2].chips[0]", "E_FIELD", MSG.M04]);
bad("e-chips-dup", ["questions[2].chips[1]", "E_DUP", MSG.M27(5)]);
bad("e-chips-order", ["questions[2].chips[1]", "E_ORDER", MSG.M28]);
ok("ok-chips-edges");
ok("ok-chips-empty");

// Leads
ok("ok-contact-telegram");
bad("e-contact-empty", ["leads.contact_fields", "E_LIMIT", MSG.M34]);
bad("e-contact-sms", ["leads.contact_fields[0]", "E_FIELD", MSG.M29]);
bad("e-contact-dup", ["leads.contact_fields[1]", "E_DUP", MSG.M30("phone")]);
bad("e-wa-plus", ["leads.whatsapp", "E_FIELD", MSG.M31]);
bad("e-wa-letters", ["leads.whatsapp", "E_FIELD", MSG.M31]);
bad("e-wa-9", ["leads.whatsapp", "E_LIMIT", MSG.M32(9)]);
bad("e-wa-16", ["leads.whatsapp", "E_LIMIT", MSG.M32(16)]);
ok("ok-wa-10");
ok("ok-wa-15");
bad("e-rate-0", ["leads.max_per_hour", "E_LIMIT", MSG.M21(0, 1, 1000)]);
bad("e-rate-1001", ["leads.max_per_hour", "E_LIMIT", MSG.M21(1001, 1, 1000)]);
bad("e-stored-0", ["leads.max_stored", "E_LIMIT", MSG.M21(0, 1, 10000)]);
bad("e-stored-10001", [
  "leads.max_stored",
  "E_LIMIT",
  MSG.M21(10001, 1, 10000),
]);
ok("ok-limits-edges");

// The two tenants of the server tests (design 10.3)
ok("ok-office-a");
ok("ok-office-b");

export const SAMPLE_NAMES = Object.keys(LOOK_EXPECTED).sort();

// ------------------------------------------------------------- what the visitor must get

const hasOwn = (o, k) => Object.hasOwn(o, k);

// The look of a file of the form /3 in one language (design 7.2).
export function expectedLook(plain, lang) {
  const look = plain.look;
  const pick = (text) => text[lang];
  return {
    mark: look.mark,
    tagline: hasOwn(look, "tagline") ? pick(look.tagline) : null,
    industry: pick(look.industry),
    headline: pick(look.headline),
    colors: {
      light: {
        accent: look.colors.light.accent,
        accent2: look.colors.light.accent2,
      },
      dark: {
        accent: look.colors.dark.accent,
        accent2: look.colors.dark.accent2,
      },
    },
    team: look.team.map((staff) => ({
      name: staff.name,
      role: pick(staff.role),
      says: pick(staff.says),
      figure: staff.figure,
      shirt: staff.shirt,
    })),
  };
}

// The object of an option as the visitor gets it: id, level, tag, glyph (those present).
export function expectedObject(object) {
  const out = { id: object.id };
  for (const key of ["level", "tag", "glyph"])
    if (hasOwn(object, key)) out[key] = object[key];
  return out;
}

// The fallback look (design 8): what the platform shows for a tenant with no look.
export function expectedFallback(name) {
  const first = [...name].find((ch) => isLetterOrDigit(ch));
  let mark = "#";
  if (first !== undefined) {
    const upper = first.toUpperCase();
    mark = [...upper].length === 1 ? upper : first;
  }
  return {
    mark,
    tagline: null,
    industry: null,
    headline: name,
    colors: structuredClone(NEUTRAL),
    team: [
      ["f01", "accent"],
      ["f02", "accent2"],
      ["f03", "ink"],
      ["f04", "accent"],
    ].map(([figure, shirt]) => ({
      name: null,
      role: null,
      says: null,
      figure,
      shirt,
    })),
  };
}

// ------------------------------------------------------------- the two tenants of the server tests

export const OFFICES = ["ok-office-a", "ok-office-b"];

// A temporary folder with the two /3 tenants of the server tests (design 10.3).
export function officeDir(t, names = OFFICES) {
  const dir = makeTmp(t);
  for (const name of names)
    fs.writeFileSync(path.join(dir, `${name}.json`), lookFixtureBytes(name));
  return dir;
}

const isTriple = (v) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).join() === LANGS.join();

// A file of the form /3 (a plain object) in one language: every text of three languages
// becomes the text of that language, wherever it stands (the form is the mark of a text).
export function languageView(plain, lang) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v === null || typeof v !== "object") return v;
    if (isTriple(v)) return v[lang];
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
  };
  return walk(plain);
}

// All string values of the look of a /3 file, in every language (the keys are not values).
export function lookStrings(plain) {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === "string") out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v !== null && typeof v === "object")
      Object.values(v).forEach(walk);
  };
  walk(plain.look);
  return out;
}

// All numbers that stand as values in a JSON value.
export function walkNumbers(value, out = []) {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => walkNumbers(v, out));
  else if (value !== null && typeof value === "object")
    Object.values(value).forEach((v) => walkNumbers(v, out));
  return out;
}
