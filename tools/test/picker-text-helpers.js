// Helpers of the tests of the signs a text for the visitor may not hold (design REQ-068,
// 11.2). Not a test file. The list of the forbidden signs is written here as literals
// from the requirement (Unicode 17.0) - it is not the expression of the code. A sign that
// is not a plain letter is written as \uXXXX, so that the lint does not stop on it.
import path from "node:path";
import { TOOLS } from "./picker-helpers.js";

export const TEXT_FIXTURES = path.join(
  TOOLS,
  "test",
  "fixtures",
  "picker-text",
);

// ---------------------------------------------------------------- the list

// Cc without U+0009-U+000D: 60 signs.
export const CC_RANGES = [
  [0x0000, 0x0008],
  [0x000e, 0x001f],
  [0x007f, 0x009f],
];
// Cf, 170 signs, Unicode 17.0.
export const CF_LIST = [
  [0x00ad, 0x00ad],
  [0x0600, 0x0605],
  [0x061c, 0x061c],
  [0x06dd, 0x06dd],
  [0x070f, 0x070f],
  [0x0890, 0x0891],
  [0x08e2, 0x08e2],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
  [0x110bd, 0x110bd],
  [0x110cd, 0x110cd],
  [0x13430, 0x1343f],
  [0x1bca0, 0x1bca3],
  [0x1d173, 0x1d17a],
  [0xe0001, 0xe0001],
  [0xe0020, 0xe007f],
];
export const SEPARATORS = [0x2028, 0x2029];

const expand = (ranges) =>
  ranges.flatMap(([a, b]) =>
    Array.from({ length: b - a + 1 }, (_, i) => a + i),
  );
export const CC_SIGNS = expand(CC_RANGES);
export const CF_SIGNS = expand(CF_LIST);
// All the forbidden signs that are not halves of a pair: 60 + 170 + 2 = 232.
export const FORBIDDEN_SIGNS = [...CC_SIGNS, ...CF_SIGNS, ...SEPARATORS];
export const FORBIDDEN_SET = new Set(FORBIDDEN_SIGNS);
// The Cf signs outside the BMP: a pair of halves that makes one of them is forbidden.
export const ASTRAL_FORBIDDEN = CF_SIGNS.filter((c) => c > 0xffff);

// The 14 signs of criterion 2 and the 8 that must stay allowed.
export const FORBIDDEN_14 = [
  0x0000, 0x0007, 0x001f, 0x007f, 0x0085, 0x009f, 0x200b, 0x202e, 0x2060,
  0xfeff, 0x2028, 0x2029, 0xd800, 0xdc00,
];
export const ALLOWED_8 = [" ", " ", " ", "\u0009", "\u000a", "ё", "ү", "😀"];
// Allowed too: Co, Cn, Mn, U+FFFD and the rest of the invisible signs that the decision
// leaves for later (ISS-0085). When the ban is widened, the last seven are moved out.
export const ALLOWED_OTHER = ["", "͸", "́", "�"];
export const ALLOWED_RESIDUE = ["ㅤ", "⠀", "͏", "ᅟ", "ᅠ", "ﾠ", "឴", "឵"];

// ---------------------------------------------------------------- strings

export const hex = (unit) =>
  `U+${unit.toString(16).toUpperCase().padStart(4, "0")}`;
export const SIGN_TEXT = (unit) =>
  `Недопустимый знак ${hex(unit)} (невидимый или управляющий). Удалите его из текста.`;
export const HALF_TEXT = (unit) =>
  `Непарная половина знака ${hex(unit)}. Удалите её из текста.`;
export const textFor = (unit) =>
  unit >= 0xd800 && unit <= 0xdfff ? HALF_TEXT(unit) : SIGN_TEXT(unit);
export const textLine = (file, place, unit) =>
  `${file}: ${place}: E_TEXT: ${textFor(unit)}`;

// The code point that a pair of halves makes.
export const astralFromPair = (hi, lo) =>
  0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);

// ---------------------------------------------------------------- the samples

const sign = (name, place, unit) => ({
  code: 1,
  lines: [textLine(`${name}.json`, place, unit)],
});
const okLine = (name) => ({
  code: 0,
  lines: [
    `Файл арендатора ${name} в порядке: вопросов 4, решений 2, правил 3.`,
  ],
});

// The 37 samples of design 8: the exit code and the exact lines of stdout.
export const TEXT_EXPECTED = {
  "e-text-nul-name-ru.json": sign("e-text-nul-name-ru", "name.ru", 0x0000),
  "e-text-bell-title-kk.json": sign(
    "e-text-bell-title-kk",
    "questions[0].title.kk",
    0x0007,
  ),
  "e-text-del-help-en.json": sign(
    "e-text-del-help-en",
    "questions[1].help.en",
    0x007f,
  ),
  "e-text-nel-label-ru.json": sign(
    "e-text-nel-label-ru",
    "questions[0].options[0].label.ru",
    0x0085,
  ),
  "e-text-rlo-intro-en.json": sign("e-text-rlo-intro-en", "intro.en", 0x202e),
  "e-text-isolate-summary-kk.json": sign(
    "e-text-isolate-summary-kk",
    "solutions[0].summary.kk",
    0x2066,
  ),
  "e-text-zwsp-glue-nomatch.json": sign(
    "e-text-zwsp-glue-nomatch",
    "result.no_match_text.ru",
    0x200b,
  ),
  "e-text-zwsp-ty-intro.json": sign("e-text-zwsp-ty-intro", "intro.ru", 0x200b),
  "e-text-bom-consent-kk.json": sign(
    "e-text-bom-consent-kk",
    "leads.consent_text.kk",
    0xfeff,
  ),
  "e-text-wj-ruletext-en.json": sign(
    "e-text-wj-ruletext-en",
    "rules[0].text.en",
    0x2060,
  ),
  "e-text-ls-explanation-ru.json": sign(
    "e-text-ls-explanation-ru",
    "hypotheses[0].explanation.ru",
    0x2028,
  ),
  "e-text-ps-includes-kk.json": sign(
    "e-text-ps-includes-kk",
    "solutions[0].includes[1].kk",
    0x2029,
  ),
  "e-text-lone-high-name-en.json": sign(
    "e-text-lone-high-name-en",
    "name.en",
    0xd800,
  ),
  "e-text-lone-low-summary-ru.json": sign(
    "e-text-lone-low-summary-ru",
    "solutions[0].summary.ru",
    0xdc00,
  ),
  "e-text-swapped-pair-title-en.json": sign(
    "e-text-swapped-pair-title-en",
    "questions[0].title.en",
    0xde00,
  ),
  "e-text-emoji-lone-tail.json": sign(
    "e-text-emoji-lone-tail",
    "name.kk",
    0xd83d,
  ),
  "e-text-zwj-emoji-name-ru.json": sign(
    "e-text-zwj-emoji-name-ru",
    "name.ru",
    0x200d,
  ),
  "e-text-all-langs-name.json": {
    code: 1,
    lines: ["ru", "kk", "en"].map((l) =>
      textLine("e-text-all-langs-name.json", `name.${l}`, 0x200b),
    ),
  },
  "e-text-two-places.json": {
    code: 1,
    lines: [
      textLine("e-text-two-places.json", "intro.ru", 0x202e),
      textLine("e-text-two-places.json", "questions[0].title.ru", 0x200b),
    ],
  },
  "e-text-sign-and-long.json": sign("e-text-sign-and-long", "intro.ru", 0x200b),
  "e-text-sign-and-201.json": sign(
    "e-text-sign-and-201",
    "questions[0].title.ru",
    0x200b,
  ),
  "e-text-first-sign-named.json": sign(
    "e-text-first-sign-named",
    "intro.en",
    0x200b,
  ),
  "e-text-operator-zwsp.json": sign(
    "e-text-operator-zwsp",
    "leads.operator_name",
    0x200b,
  ),
  "e-text-privacy-bell.json": sign(
    "e-text-privacy-bell",
    "leads.privacy_contact",
    0x0007,
  ),
  "e-text-v1-zwsp-name.json": sign("e-text-v1-zwsp-name", "name", 0x200b),
  "e-text-v1-rlo-label.json": sign(
    "e-text-v1-rlo-label",
    "questions[0].options[0].label",
    0x202e,
  ),
  "e-text-v1-lone-title.json": sign(
    "e-text-v1-lone-title",
    "questions[0].title",
    0xd800,
  ),
  "e-text-v1-bell-consent.json": sign(
    "e-text-v1-bell-consent",
    "leads.consent_text",
    0x0007,
  ),
  "e-ref-lone-surrogate.json": {
    code: 1,
    lines: [
      "e-ref-lone-surrogate.json: rules[0].solution: E_REF: Решение s_x не найдено. Укажите id решения из списка solutions.",
    ],
  },
  "e-field-lone-surrogate-key.json": {
    code: 1,
    lines: [
      'e-field-lone-surrogate-key.json: ["a_b"]: E_FIELD: Лишнее поле a_b. Удалите его.',
    ],
  },
  "e-json-raw-nul.txt": {
    code: 1,
    lines: [
      "e-json-raw-nul.txt: строка 3, знак 13: E_JSON: В строке есть перенос или служебный знак. Запишите его как \\n.",
    ],
  },
  "e-json-raw-surrogate.txt": {
    code: 1,
    lines: [
      "e-json-raw-surrogate.txt: строка 3, знак 13: E_JSON: Файл не в кодировке UTF-8. Сохраните его как UTF-8.",
    ],
  },
  "ok-text-spaces.json": okLine("ok-text-spaces"),
  "ok-text-emoji.json": okLine("ok-text-emoji"),
  "ok-text-letters.json": okLine("ok-text-letters"),
  "ok-text-white-escapes.json": okLine("ok-text-white-escapes"),
  "ok-text-v1-allowed.json": okLine("ok-text-v1-allowed"),
};
