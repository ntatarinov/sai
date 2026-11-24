import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { textProblem } from "../../public/shared/text-rules.js";
import { lintText } from "../../scripts/word-lists.js";
import { blank } from "../fixtures/blank.js";
import { APP, ROOT, tempDir } from "../fixtures/helpers.js";

// REQ-111 criterion 2: the texts module, the text rules of the public pages and the one rule that picks the
// language of a page. The rules of the criterion are written here (own oracle); the module under test is
// imported, and a damaged copy of a source file is written into a temporary folder and imported from there.

const SHARED = path.join(APP, "public", "shared");
const LANG_FILE = path.join(SHARED, "i18n", "lang.js");
const RULES_FILE = path.join(SHARED, "text-rules.js");
const url = (/** @type {string} */ file, query = "") =>
  `${pathToFileURL(file).href}${query}`;

const texts = await import(url(path.join(SHARED, "i18n", "texts.js")));
const { SOURCE_LANGS } = await import(url(LANG_FILE));

/**
 * A copy of a source file with one edit, written into a temporary folder outside the project and imported
 * from there; the edit must change the file, so a damaged copy that is not damaged fails loudly.
 * @param {import("node:test").TestContext} t
 * @param {string} file
 * @param {string} from
 * @param {string} to
 */
async function damaged(t, file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  assert.ok(src.includes(from), `the place to damage: ${from}`);
  const dir = tempDir(t);
  const copy = path.join(dir, path.basename(file));
  fs.writeFileSync(
    copy,
    src.replace(from, () => to),
  );
  return import(url(copy));
}

// ---------------------------------------------------------------------------------------------------------
// The rules of the criterion over a texts object: the findings of TX-2 and TX-3.

const PLACEHOLDER = /\{([A-Za-z_]+)\}/g;
// The signs that no text for a visitor may hold (the class of the picker's rule, decisions/0076): control
// signs except U+0009 to U+000D, format signs (so the zero-width ones), the line and paragraph separators, and
// a single half of a surrogate pair.
const FORBIDDEN_SIGN = /(?![\t-\r])[\p{Cc}\p{Cf}\u2028\u2029]|\p{Cs}/u;
const SECOND_PERSON =
  /(?<![\p{L}\p{N}])(?:ты|тебя|тебе|тобой|твой|твоя|твоё|твои)(?![\p{L}\p{N}])/iu;
const CLAUDE_CODE = /(?<![\p{L}\p{N}_])Claude\s+Code(?![\p{L}\p{N}_])/iu;

/** The phrases of a text and the longest of them in words.
 * @param {string} text */
function longestPhrase(text) {
  let most = 0;
  for (const phrase of text.split(/(?<=[.!?…])\s+/)) {
    const words = phrase
      .split(/\s+/)
      .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    most = Math.max(most, words);
  }
  return most;
}

/**
 * The findings of TX-2 and TX-3 over a texts object: the shape of every entry, the placeholders, the invisible
 * signs, the length of a phrase, the address «ты» in ru, the words «Claude Code».
 * @param {Record<string, Record<string, unknown>>} all
 * @param {readonly string[]} langs
 * @returns {string[]}
 */
function textFindings(all, langs) {
  /** @type {string[]} */
  const out = [];
  for (const [key, entry] of Object.entries(all)) {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) out.push(`${key}: the key`);
    /** @type {Map<string, string>} */
    const sets = new Map();
    for (const lang of langs) {
      const v = entry[lang];
      if (typeof v !== "string" || v.trim() === "") {
        out.push(`${key}: ${lang}: not a non-empty string`);
        continue;
      }
      const names = [...v.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
      sets.set(lang, names.join(","));
      if (/[{}]/.test(v.replace(PLACEHOLDER, "")))
        out.push(`${key}: ${lang}: a brace that is no placeholder`);
      if (FORBIDDEN_SIGN.test(v))
        out.push(`${key}: ${lang}: an invisible sign`);
      if (longestPhrase(v) > 18) out.push(`${key}: ${lang}: a long phrase`);
      if (lang === "ru" && SECOND_PERSON.test(v))
        out.push(`${key}: ru: the address ты`);
      if (CLAUDE_CODE.test(v)) out.push(`${key}: ${lang}: Claude Code`);
    }
    if (new Set(sets.values()).size > 1)
      out.push(`${key}: the placeholders differ between the languages`);
  }
  return out;
}

/** A plain deep copy of a texts object, so a damaged copy can be written.
 * @returns {Record<string, Record<string, unknown>>} */
const plainTexts = () => JSON.parse(JSON.stringify(texts.TEXTS));

// ---------------------------------------------------------------------------------------------------------

test("TX-1 the module exports exactly LANGS (= SOURCE_LANGS) and TEXTS, frozen, every entry frozen, every key lower case", () => {
  assert.deepEqual(Object.keys(texts).sort(), ["LANGS", "TEXTS"]);
  assert.equal(texts.LANGS, SOURCE_LANGS);
  assert.deepEqual([...texts.LANGS], ["ru", "kk", "en"]);
  assert.ok(Object.isFrozen(texts.LANGS));
  assert.ok(Object.isFrozen(texts.TEXTS));
  const keys = Object.keys(texts.TEXTS);
  assert.ok(keys.length >= 150, `${keys.length} keys`);
  for (const key of keys) {
    assert.match(key, /^[a-z][a-z0-9_]*$/, key);
    assert.ok(Object.isFrozen(texts.TEXTS[key]), `${key} is not frozen`);
    assert.deepEqual(
      Object.keys(texts.TEXTS[key]).sort(),
      ["en", "kk", "ru"],
      key,
    );
  }
});

test("TX-2 every key has three non-empty strings and the same placeholders in the three values", () => {
  assert.deepEqual(textFindings(texts.TEXTS, texts.LANGS), []);
  // The placeholders are really used: the entries that take values name the same set in every language.
  const withPlaceholder = Object.keys(texts.TEXTS).filter((k) =>
    /\{[A-Za-z_]+\}/.test(texts.TEXTS[k].ru),
  );
  assert.ok(withPlaceholder.length >= 8, withPlaceholder.join());
});

test("TX-3 no control or invisible sign, no phrase over 18 words, no ты-form in ru, no «Claude Code»", () => {
  // The same findings as TX-2, read by class: not one of the four classes is found in any value.
  const found = textFindings(texts.TEXTS, texts.LANGS).filter((f) =>
    /an invisible sign|a long phrase|the address|Claude Code/.test(f),
  );
  assert.deepEqual(found, []);
  // The rule's own cases: it finds each class, so the empty answer above is no blind rule.
  const probe = (/** @type {string} */ ru) =>
    textFindings({ k: { ru, kk: "a", en: "a" } }, ["ru", "kk", "en"]);
  assert.deepEqual(probe("Один два три."), []);
  assert.ok(probe("a\u200bb").some((f) => /invisible/.test(f)));
  assert.ok(probe("a\u0007b").some((f) => /invisible/.test(f)));
  assert.ok(probe("a\ufeffb").some((f) => /invisible/.test(f)));
  assert.ok(probe("a\u2028b").some((f) => /invisible/.test(f)));
  assert.ok(probe("a\ud800b").some((f) => /invisible/.test(f)));
  assert.deepEqual(probe("a\tb\nc\r"), []);
  const words = (/** @type {number} */ n) =>
    Array.from(
      { length: n },
      (_, i) => `слово${"абвгдежзиклмнопрст"[i % 18]}`,
    ).join(" ");
  assert.deepEqual(probe(`${words(18)}.`), []);
  assert.ok(probe(`${words(19)}.`).some((f) => /long/.test(f)));
  assert.deepEqual(probe(`${words(18)}. ${words(18)}.`), []);
  assert.ok(probe("Мы ждём ты ").some((f) => /ты/.test(f)));
  assert.deepEqual(
    probe("Мы тыква и ты-то").filter((f) => /ты/.test(f)).length,
    1,
  );
  assert.deepEqual(probe("Мы ждём вас"), []);
  assert.ok(probe("Claude  Code").some((f) => /Claude Code/.test(f)));
});

/**
 * The 13 keys that REQ-113 (the visitor status block) adds, with the exact ru and en values the requirement
 * writes: [key, ru, en]. The test's own oracle: the module is read, these are not imported from it.
 * @type {ReadonlyArray<readonly [string, string, string]>}
 */
const ADDED_VALUES = [
  ["now_title", "Что работает сейчас", "What works now"],
  ["now_demo_t", "Демо-опрос", "Demo survey"],
  [
    "now_demo_s",
    "Пять вопросов и подсказка, какой вид продукта вам подойдёт.",
    "Five questions and a hint at which kind of product fits you.",
  ],
  [
    "now_idea_t",
    "Опрос по вашей идее и ТЗ",
    "Survey on your idea and the requirements",
  ],
  [
    "now_idea_s",
    "ИИ-аналитик задаёт вопросы и пишет техническое задание (ТЗ).",
    "The AI analyst asks questions and writes the requirements.",
  ],
  ["now_build_t", "Сборка и результат", "Build and result"],
  [
    "now_build_s",
    "Разработчик собирает продукт, вы принимаете работу.",
    "The developer builds the product and you accept the work.",
  ],
  ["stat_on", "Работает", "Working"],
  ["stat_off", "Пока нет", "Not yet"],
  [
    "now_closing",
    "Даты запуска пока нет. Описать идею смогут только приглашённые участники. Способа получить приглашение пока нет. Готовый продукт посетителям пока не выдаётся.",
    "No launch date is set yet. Only invited participants will be able to describe an idea. There is no way to get an invitation yet. Finished products are not handed out to visitors yet.",
  ],
  [
    "how_plan_note",
    "Ниже описано, как работа будет устроена, когда этапы запустятся.",
    "Below is how the work will go once the stages start.",
  ],
  [
    "how_stage_1_note",
    "Название этапа описывает будущий проект. Заказы сейчас не принимаются.",
    "The stage name describes a future project. Orders are not accepted now.",
  ],
  [
    "demo_accuracy_note",
    "Чем больше ответов, тем надёжнее подсказка. «Не знаю» считается за половину.",
    "The more answers, the more reliable the hint. “Not sure” counts as half.",
  ],
];

/** The two keys whose values REQ-113 changes, with the exact ru and en values: [key, ru, en]. */
const CHANGED_VALUES = [
  [
    "idea_panel_lead",
    "Сейчас идею описать в Sai нельзя: по кнопке откроется подсказка, как о ней рассказать.",
    "You cannot describe an idea in Sai yet: the button opens tips on how to describe it.",
  ],
  ["demo_accuracy", "Учтено ответов", "Answers counted"],
];

/** The 15 keys of REQ-113 criterion 1. */
const STATUS_VALUES = [...ADDED_VALUES, ...CHANGED_VALUES];

/**
 * The two kk drafts that REQ-113 criterion 1 pins (the amendment of 2026-11-22): [key, kk]. They follow the new ru
 * values and nothing more; the kk of the other keys stays the coding role's draft, no row pins it.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const KK_DRAFT_VALUES = [
  [
    "now_idea_s",
    "ЖИ-талдаушы сұрақтар қояды және техникалық тапсырма (ТТ) жазады.",
  ],
  [
    "now_closing",
    "Іске қосу датасы әзірге жоқ. Идеяны тек шақырылған қатысушылар сипаттай алады. Шақыру алудың жолы әзірге жоқ. Дайын өнім келушілерге әзірге берілмейді.",
  ],
];

/**
 * Every file under a folder, as absolute paths, in the order of the directory listing sorted by name.
 * @param {string} dir
 * @returns {string[]}
 */
function filesUnder(dir) {
  /** @type {string[]} */
  const out = [];
  for (const e of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(p));
    else out.push(p);
  }
  return out;
}

test("TX-4 the exact values fixed by records; kk and en of the theme words; no nobuild_ key starts with order_", async () => {
  const T = texts.TEXTS;
  /** @type {Array<[string, string]>} */
  const ru = [
    [
      "test_mode",
      "Sai работает в тестовом режиме: вход по приглашению, заказы не принимаются.",
    ],
    [
      "ai_disclosure",
      "Работу в Sai выполняют ИИ-агенты (искусственный интеллект). Их ответы могут быть неточными.",
    ],
    ["theme_auto", "Авто"],
    ["theme_light", "Светлая"],
    ["theme_dark", "Тёмная"],
    ["theme_name", "Тема"],
    ["describe_idea", "Описать идею"],
    ["nobuild_title", "Чего Sai пока не делает"],
    ["nobuild_1", "Серверы, API и базы данных"],
    ["nobuild_2", "Вход по логину и паролю"],
    ["nobuild_3", "Приём оплаты"],
    ["nobuild_4", "Настоящая отправка писем и сообщений в мессенджеры"],
    ["nobuild_5", "Связь с внешними системами учёта и CRM"],
    ["nobuild_6", "Сбор данных с чужих сайтов"],
    ["nobuild_7", "Расширения для браузера"],
    ["nobuild_8", "Мобильные приложения"],
    ["nobuild_9", "То, что требует секретных ключей или паролей"],
    ["nobuild_10", "То, что нарушает правила использования ИИ"],
    ["closed_test", "Sai — закрытое тестирование"],
    ["stage_1", "Принято"],
    ["stage_2", "Готовим документацию"],
    ["stage_3", "Готовим спецификацию"],
    ["stage_4", "Готово к просмотру"],
    ["role_1", "Руководитель проекта"],
    ["role_2", "Аналитик"],
    ["role_3", "Разработчик"],
    ["role_4", "Проверяющий"],
    ["you", "Вы"],
    ["scene_caption", "Картинка показывает этапы работы, а не движения людей."],
    ["notfound_title", "Страница не найдена"],
    ["title_404", "Страница не найдена — Sai"],
    ["demo_unsure", "Не знаю"],
    ["demo_back", "Назад"],
    ["demo_retry", "Повторить"],
  ];
  for (const [key, value] of ru) assert.equal(T[key]?.ru, value, key);
  // The theme words and the theme button's name in kk and en (decisions/0084 §3 item 15; decisions/0123 I4).
  /** @type {Array<[string, string, string]>} */
  const themes = [
    ["theme_auto", "Авто", "Auto"],
    ["theme_light", "Ашық", "Light"],
    ["theme_dark", "Қараңғы", "Dark"],
    ["theme_name", "Тақырып", "Theme"],
  ];
  for (const [key, kk, en] of themes) {
    assert.equal(T[key].kk, kk, key);
    assert.equal(T[key].en, en, key);
  }
  // The role names are the team catalogue's names (decisions/0123 О14).
  const roles = await import(url(path.join(ROOT, "tools/src/team/roles.js")));
  /** @type {Array<[string, string]>} */
  const byCode = [
    ["role_1", "project_manager"],
    ["role_2", "business_analyst"],
    ["role_3", "developer"],
    ["role_4", "reviewer"],
  ];
  for (const [key, code] of byCode)
    assert.equal(T[key].ru, roles.roleByCode(code).name, key);
  // The ten items and the heading are the keys nobuild_*, and none of them is an order text.
  const nobuild = Object.keys(T).filter((k) => k.startsWith("nobuild_"));
  assert.deepEqual(nobuild.sort(), [
    "nobuild_1",
    "nobuild_10",
    "nobuild_2",
    "nobuild_3",
    "nobuild_4",
    "nobuild_5",
    "nobuild_6",
    "nobuild_7",
    "nobuild_8",
    "nobuild_9",
    "nobuild_title",
  ]);
  for (const k of nobuild) assert.ok(!k.startsWith("order_"), k);

  // REQ-113 criterion 1: the 15 keys of the visitor status block have exactly the ru and en values the
  // requirement writes (13 new, two changed), and the 13 new ones exist and are no order texts.
  assert.equal(STATUS_VALUES.length, 15);
  for (const [key, ruValue, enValue] of STATUS_VALUES) {
    assert.equal(T[key]?.ru, ruValue, `${key}: ru`);
    assert.equal(T[key]?.en, enValue, `${key}: en`);
  }
  for (const [key] of ADDED_VALUES)
    assert.ok(
      key in T && !key.startsWith("order_"),
      `${key}: a new key must exist and be no order text`,
    );
  // The amendment of 2026-11-22: the two kk drafts follow the new ru values, so each holds the exact text, and the
  // texts file holds each of the two texts exactly once (the grep -c of criterion 1).
  assert.equal(KK_DRAFT_VALUES.length, 2);
  const textsSource = fs.readFileSync(
    path.join(SHARED, "i18n", "texts.js"),
    "utf8",
  );
  for (const [key, kkValue] of KK_DRAFT_VALUES) {
    assert.equal(T[key]?.kk, kkValue, `${key}: kk`);
    assert.equal(
      textsSource.split(kkValue).length - 1,
      1,
      `${key}: the kk text stands once in texts.js`,
    );
  }
  // The label of the receipt's count is no longer called accuracy in any language.
  assert.notEqual(
    T.demo_accuracy.kk,
    "Таңдау дәлдігі",
    "demo_accuracy: kk still says accuracy",
  );
  // The removed key: not in the module and in no file of the public pages or of the tests. The name is built
  // from two parts, so that no file of app/test holds it in one piece (AP-093).
  const removed = ["idea_panel_", "fine"].join("");
  assert.equal(removed in T, false, "the removed key is still in the module");
  const holders = [
    ...filesUnder(path.join(APP, "public")),
    ...filesUnder(path.join(APP, "test")).filter((f) => f.endsWith(".js")),
  ];
  assert.ok(holders.length > 30, `${holders.length} files read`);
  for (const file of holders)
    assert.ok(
      !fs.readFileSync(file, "utf8").includes(removed),
      `the removed key is still used: ${path.relative(APP, file)}`,
    );
});

/** The 45 order_ keys of the design 4.1, closed. */
const ORDER_KEYS = [
  "order_landing_title",
  "order_examples_link",
  "order_how_title",
  "order_how_text",
  "order_nav_examples",
  "order_title_examples",
  "order_examples_h1",
  "order_examples_pitch",
  "order_example_label",
  "order_gets_label",
  "order_not_label",
  "order_can_title",
  ...[1, 2, 3, 4, 5, 6].map((n) => `order_can_${n}`),
  "order_cannot_title",
  ...[1, 2, 3, 4, 5].map((n) => `order_cannot_${n}`),
  ...[1, 2, 3].flatMap((n) => [
    `order_example_${n}_kind`,
    `order_example_${n}_request`,
    ...[1, 2, 3].map((g) => `order_example_${n}_gets_${g}`),
    ...[1, 2].map((g) => `order_example_${n}_not_${g}`),
  ]),
];

test("TX-5 the order_ keys are exactly the 45 of the design; examples.html shows the three example requests and the two lists", () => {
  assert.equal(ORDER_KEYS.length, 45);
  assert.equal(new Set(ORDER_KEYS).size, 45);
  assert.deepEqual(
    Object.keys(texts.TEXTS)
      .filter((k) => k.startsWith("order_"))
      .sort(),
    [...ORDER_KEYS].sort(),
  );
  // The page of the examples (E2 and E3): its data-t keys of the lists and of the three requests are the
  // order_can_*, order_cannot_* and order_example_* keys, each of them shown; every other text of the page is
  // another order_ key, the shell's or the demo button.
  const html = fs.readFileSync(
    path.join(APP, "public", "examples.html"),
    "utf8",
  );
  const keys = new Set(
    [...html.matchAll(/\sdata-t(?:-aria)?="([^"]+)"/g)].map((m) => m[1]),
  );
  const items = ORDER_KEYS.filter((k) =>
    /^order_(can_\d|cannot_\d|example_\d_)/.test(k),
  );
  assert.equal(items.length, 6 + 5 + 21);
  for (const k of items)
    assert.ok(keys.has(k), `examples.html does not show ${k}`);
  const shell = new Set([
    "skip_link",
    "brand_tile",
    "brand_name",
    "lang_group",
    "lang_ru",
    "lang_kk",
    "lang_en",
    "theme_name",
    "test_mode",
    "ai_disclosure",
    "nav_landing",
    "nav_how",
    "nav_demo",
    "to_landing",
    "kk_note",
    "cta_demo",
    "title_examples",
  ]);
  for (const k of keys)
    assert.ok(
      k.startsWith("order_") || shell.has(k),
      `examples.html: ${k} is neither an order text nor the shell`,
    );
  for (const k of keys)
    if (k.startsWith("order_")) assert.ok(ORDER_KEYS.includes(k), k);
});

// ---------------------------------------------------------------------------------------------------------
// TX-6 the text rules of the public pages against the picker's.

/** @param {number} seed a seeded generator (mulberry32): the same corpus on every run */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The corpus: fixed edge cases and generated texts by the class of input — lengths, signs, ты-forms, breaks. */
function corpus() {
  const next = seeded(20261120);
  const pick = (/** @type {readonly string[]} */ list) =>
    list[Math.floor(next() * list.length)];
  const WORDS = [
    "сайт",
    "заказ",
    "Sai",
    "агент",
    "проект",
    "идея",
    "plain",
    "test",
    "команда",
    "1.5",
    "100",
    "—",
    "-",
    "ё",
    "ТЫ",
    "Ты",
    "тыква",
    "мы",
    "вы",
    "ваш",
    "кітап",
    "жұмыс",
    "AI",
  ];
  const SECOND = [
    "ты",
    "Ты",
    "ТЫ",
    "тебя",
    "тебе",
    "тобой",
    "твой",
    "твоя",
    "твоё",
    "твои",
    "ты-то",
    "тыква",
    "тебёнок",
  ];
  const ENDS = [
    ".",
    "!",
    "?",
    "…",
    "...",
    ". ",
    "?! ",
    "\n",
    " ",
    "",
    ".\n",
    "!\t",
  ];
  const GAPS = [" ", "  ", " ", "\t", "\n", " \n "];
  const SIGNS = [
    "\u0000",
    "\u0007",
    "\u001b",
    "\u007f",
    "\u0085",
    "\u00ad",
    "\u200b",
    "\u200c",
    "\u200e",
    "\u202e",
    "\u2060",
    "\ufeff",
    "\u2028",
    "\u2029",
    "\ud800",
    "\udc00",
    "😀",
    "\t",
    "\n",
    "\r",
    "\u000b",
    "\u000c",
  ];
  /** @type {string[]} */
  const out = ["", " ", "  \n", "—", "…", ".", "!?", "1.5", "a.b c.d"];
  const phrase = (/** @type {number} */ words, end = ".") =>
    Array.from({ length: words }, () => pick(WORDS)).join(" ") + end;
  // The length class: phrases of 0 to 25 words around the limit of 18, each alone and in pairs.
  for (let n = 0; n <= 25; n++) {
    out.push(phrase(n));
    out.push(`${phrase(n, "!")} ${phrase(n === 0 ? 1 : 25 - n, "?")}`);
    out.push(`${phrase(n, "…")}${pick(GAPS)}${phrase(3)}`);
    out.push(phrase(n, ""));
  }
  // The break class: the ends and gaps between phrases, a dot inside a number.
  for (let i = 0; i < 60; i++) {
    const parts = [];
    const count = 1 + Math.floor(next() * 4);
    for (let p = 0; p < count; p++)
      parts.push(phrase(Math.floor(next() * 22)) + pick(ENDS));
    out.push(parts.join(pick(GAPS)));
  }
  // The address class.
  for (const w of SECOND) {
    out.push(w);
    out.push(`Это ${w} сам.`);
    out.push(`${phrase(5)} ${w}${pick(ENDS)}`);
    out.push(`(${w}) и «${w}»`);
  }
  // The sign class.
  for (const s of SIGNS) {
    out.push(s);
    out.push(`a${s}b`);
    out.push(`${phrase(4)}${s}`);
    out.push(`${s}${phrase(4)}`);
  }
  // Mixed.
  for (let i = 0; i < 80; i++) {
    let text = "";
    const count = 1 + Math.floor(next() * 12);
    for (let p = 0; p < count; p++) {
      const r = next();
      text += r < 0.1 ? pick(SIGNS) : r < 0.2 ? pick(SECOND) : pick(WORDS);
      text += next() < 0.15 ? pick(ENDS) : pick(GAPS);
    }
    out.push(text);
  }
  return out;
}

/**
 * The names of the rules of a text-rules module that give another answer than the picker's on a text of the
 * corpus, and of its constants that differ.
 * @param {Record<string, any>} mod
 * @param {Record<string, any>} picker
 * @param {string[]} texts
 */
function ruleDifferences(mod, picker, texts) {
  const names = [
    "forbiddenSign",
    "trimmedLength",
    "phrasesOf",
    "wordsOf",
    "hasSecondPerson",
    "wordsProblem",
    "textProblem",
  ];
  /** @type {Set<string>} */
  const out = new Set();
  const same = (/** @type {unknown} */ a, /** @type {unknown} */ b) => {
    try {
      assert.deepEqual(a, b);
      return true;
    } catch {
      return false;
    }
  };
  for (const name of names)
    for (const text of texts)
      if (!same(mod[name](text), picker[name](text))) out.add(name);
  for (const text of texts)
    for (const phrase of picker.phrasesOf(text))
      if (mod.wordCount(phrase) !== picker.wordCount(phrase))
        out.add("wordCount");
  if (mod.MAX_WORDS !== 18) out.add("MAX_WORDS");
  if (
    !same(
      [...mod.SECOND_PERSON_WORDS],
      ["ты", "тебя", "тебе", "тобой", "твой", "твоя", "твоё", "твои"],
    )
  )
    out.add("SECOND_PERSON_WORDS");
  return [...out].sort();
}

test("TX-6 the text rules of public/shared give the picker's answers on a corpus of at least 200 texts", async (t) => {
  const picker = await import(
    url(path.join(ROOT, "tools/src/picker/text-rules.js"))
  );
  const real = await import(url(RULES_FILE));
  const texts = corpus();
  assert.ok(texts.length >= 200, `${texts.length} texts`);
  // The corpus reaches the cases of the rules: a phrase of 18 and of 19 words, a ты-form, a sign of each class.
  assert.ok(
    texts.some((x) => picker.wordsProblem(x) === null && x.length > 60),
  );
  assert.ok(texts.some((x) => picker.wordsProblem(x)?.words === 19));
  assert.ok(texts.some((x) => picker.hasSecondPerson(x)));
  assert.ok(texts.some((x) => picker.forbiddenSign(x)?.half === true));
  assert.ok(texts.some((x) => picker.forbiddenSign(x)?.half === false));
  assert.ok(texts.some((x) => picker.textProblem(x)?.kind === "formal"));
  assert.ok(texts.some((x) => picker.textProblem(x)?.kind === "long"));
  assert.deepEqual(ruleDifferences(real, picker, texts), []);
  // The rule's own power: a copy of the file with one rule changed is red on this corpus, by that rule.
  /** @type {Array<[string, string, string, string]>} */
  const damagedRules = [
    ["MAX_WORDS = 18", "MAX_WORDS = 19", "MAX_WORDS", "the limit of 19 words"],
    ['  "тобой",\n', "", "SECOND_PERSON_WORDS", "a form of ты dropped"],
    ["\\p{Cf}", "\\p{Zs}", "forbiddenSign", "the format signs"],
    ["[.!?…]", "[.!?]", "phrasesOf", "the phrase cut after …"],
    [
      "/[\\p{L}\\p{N}]/u.test(w)",
      "/\\p{L}/u.test(w)",
      "wordCount",
      "a digit is no word",
    ],
    ["text.toLowerCase().match", "text.match", "wordsOf", "the letter case"],
  ];
  for (const [from, to, rule, what] of damagedRules) {
    const mod = await damaged(t, RULES_FILE, from, to);
    assert.ok(ruleDifferences(mod, picker, texts).includes(rule), what);
  }
});

// ---------------------------------------------------------------------------------------------------------
// TX-7 the language rule.

const LONG = "x".repeat(1000);

/**
 * The findings of the table of the criterion over a lang.js module.
 * @param {Record<string, any>} mod
 * @returns {string[]}
 */
function langFindings(mod) {
  /** @type {string[]} */
  const out = [];
  const { pickLang } = mod;
  if (pickLang.length !== 3) out.push(`pickLang.length is ${pickLang.length}`);
  // The parameter list as written: no fourth parameter even when it has a default (which Function.length
  // does not count).
  const written = /^[^(]*\(([^)]*)\)/.exec(String(pickLang));
  const count = written === null ? 0 : written[1].split(",").length;
  if (count !== 3) out.push(`pickLang has ${count} parameters`);
  const ALL = ["ru", "kk", "en"];
  const PUBLIC = ["ru", "en"];
  /** @type {Array<[unknown, unknown, string[], string]>} */
  const rows = [
    // ?lang= first, when it is a language of the build (also ru, over a stored other language).
    ["en", null, ALL, "en"],
    ["kk", null, ALL, "kk"],
    ["ru", null, ALL, "ru"],
    ["ru", "en", ALL, "ru"],
    ["en", "kk", ALL, "en"],
    ["kk", "en", ALL, "kk"],
    ["en", "ru", PUBLIC, "en"],
    // The stored value next, when ?lang= is no language of the build: a stored language other than ru wins,
    // so a rule that skips this step (or reads ?lang= more loosely) answers ru or the query.
    ["kk", "en", PUBLIC, "en"],
    ["kk", "kk", PUBLIC, "ru"],
    ["kk", null, PUBLIC, "ru"],
    [null, "en", PUBLIC, "en"],
    [null, "kk", ALL, "kk"],
    [null, "kk", PUBLIC, "ru"],
    // Then ru.
    [null, null, ALL, "ru"],
    ["en", "en", ["ru"], "ru"],
    ["en", null, ["en"], "en"],
    [null, null, ["en"], "ru"],
  ];
  // Each «next rule» row of the criterion — de, RU, an empty value, <script>, 1 000 characters, and more
  // near forms — runs with a stored value that is a language of the build other than ru, and with none.
  for (const query of [
    "de",
    "RU",
    "Kk",
    "EN",
    "",
    "<script>",
    LONG,
    " en",
    "en ",
    "ru-RU",
    "en-US",
    "ruru",
    "e",
  ]) {
    rows.push([query, "en", ALL, "en"]);
    rows.push([query, "kk", ALL, "kk"]);
    rows.push([query, "en", PUBLIC, "en"]);
    rows.push([query, null, ALL, "ru"]);
    rows.push([query, "de", ALL, "ru"]);
    rows.push([query, "EN", ALL, "ru"]);
    rows.push([query, "", ALL, "ru"]);
    rows.push([query, "<script>", ALL, "ru"]);
    rows.push([query, LONG, ALL, "ru"]);
  }
  for (const [q, s, langs, want] of rows) {
    let got;
    try {
      got = pickLang(q, s, langs);
    } catch (err) {
      got = `throws ${err instanceof Error ? err.message : err}`;
    }
    if (got !== want)
      out.push(
        `pickLang(${JSON.stringify(String(q).slice(0, 12))}, ${JSON.stringify(s === null ? s : String(s).slice(0, 12))}, ${langs.join("/")}) is ${got}, not ${want}`,
      );
  }
  return out;
}

test("TX-7 lang.js is pure (no document, window or storage, no header, no import) and picks ?lang=, then the stored language, then ru", async (t) => {
  const real = await import(url(LANG_FILE));
  assert.deepEqual([...real.SOURCE_LANGS], ["ru", "kk", "en"]);
  assert.deepEqual([...real.PUBLIC_LANGS], ["ru", "en"]);
  assert.ok(Object.isFrozen(real.SOURCE_LANGS));
  assert.ok(Object.isFrozen(real.PUBLIC_LANGS));
  assert.deepEqual(Object.keys(real).sort(), [
    "PUBLIC_LANGS",
    "SOURCE_LANGS",
    "pickLang",
  ]);
  // The source, with its comments and strings blanked, names no page object, no storage, no header and
  // imports nothing.
  const code = blank(fs.readFileSync(LANG_FILE, "utf8"));
  for (const word of [
    "document",
    "window",
    "localStorage",
    "sessionStorage",
    "navigator",
    "location",
    "history",
    "header",
    "headers",
    "cookie",
    "request",
    "import",
    "require",
    "fetch",
  ])
    assert.ok(!new RegExp(`\\b${word}\\b`).test(code), word);
  assert.deepEqual(langFindings(real), []);
  // A temporary copy of the file imports where no page object exists: nothing global was needed.
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(typeof globalThis.window, "undefined");
  // The table has power: a rule changed in one place is red in the rows of that place.
  /** @type {Array<[string, string, string, RegExp]>} */
  const rules = [
    [
      "langs.includes(query)",
      "langs.includes(query.toLowerCase())",
      "accepts a query in another letter case",
      /pickLang\("RU"/,
    ],
    [
      "if (query !== null && langs.includes(query)) return query;\n  if (stored !== null && langs.includes(stored)) return stored;",
      "if (stored !== null && langs.includes(stored)) return stored;\n  if (query !== null && langs.includes(query)) return query;",
      "prefers the stored value",
      /pickLang\("en", "kk"/,
    ],
    [
      "langs.includes(stored)",
      "langs.includes(stored.toLowerCase())",
      "accepts a stored value in another letter case",
      /pickLang\([^)]*"EN"/,
    ],
    [
      "if (stored !== null && langs.includes(stored)) return stored;\n",
      "",
      "never reads the stored value",
      /, "en", /,
    ],
    [
      "if (query !== null && langs.includes(query)) return query;",
      "if (query !== null && SOURCE_LANGS.includes(query)) return query;",
      "reads ?lang= against the source languages, not the languages of the build",
      /pickLang\("kk", "en", ru\/en\)/,
    ],
  ];
  for (const [from, to, what, row] of rules) {
    const mod = await damaged(t, LANG_FILE, from, to);
    const found = langFindings(mod);
    assert.ok(
      found.some((f) => row.test(f)),
      `${what}: ${JSON.stringify(found.slice(0, 3))}`,
    );
  }
});

// ---------------------------------------------------------------------------------------------------------

test("TX-8 the seven damaged copies of the criterion are red: a key without kk, a placeholder missing in en, a phrase of 19 words, «ты», U+200B, a text rule that differs, a lang rule that reads a header", async (t) => {
  const langs = ["ru", "kk", "en"];
  assert.deepEqual(textFindings(plainTexts(), langs), []);
  /** @param {(all: Record<string, Record<string, unknown>>) => void} edit */
  const run = (edit) => {
    const all = plainTexts();
    edit(all);
    return textFindings(all, langs);
  };
  const withPlaceholder = Object.keys(texts.TEXTS).find((k) =>
    /\{[a-z]+\}/.test(texts.TEXTS[k].en),
  );
  assert.ok(withPlaceholder);
  const key = "you";
  const nineteen = Array.from({ length: 19 }, () => "слово").join(" ");
  /** @type {Array<[string, (all: Record<string, Record<string, unknown>>) => void, RegExp]>} */
  const copies = [
    [
      "a key without kk",
      (a) => delete a[key].kk,
      /you: kk: not a non-empty string/,
    ],
    [
      "a key with an empty kk",
      (a) => (a[key].kk = " "),
      /you: kk: not a non-empty/,
    ],
    [
      "a placeholder missing in en",
      (a) =>
        (a[/** @type {string} */ (withPlaceholder)].en = "no placeholder here"),
      /the placeholders differ/,
    ],
    [
      "a placeholder that only en has",
      (a) => (a[key].en = "You {n}"),
      /the placeholders differ/,
    ],
    [
      "a phrase of 19 words",
      (a) => (a[key].ru = `${nineteen}.`),
      /you: ru: a long phrase/,
    ],
    [
      "a phrase of 19 words in en",
      (a) => (a[key].en = `${nineteen}.`),
      /you: en: a long phrase/,
    ],
    ["«ты»", (a) => (a[key].ru = "Это ты сам"), /you: ru: the address/],
    [
      "a U+200B",
      (a) => (a[key].kk = "Сіз\u200b"),
      /you: kk: an invisible sign/,
    ],
    [
      "a key in capitals",
      (a) => (a.Bad_key = { ru: "a", kk: "a", en: "a" }),
      /Bad_key: the key/,
    ],
    ["Claude Code", (a) => (a[key].en = "Claude Code"), /Claude Code/],
  ];
  for (const [name, edit, want] of copies) {
    const found = run(edit);
    assert.ok(
      found.some((f) => want.test(f)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
  // The text rule that differs from the picker's, and the lang rule that reads a header: damaged copies of the
  // two source files, each red in its own check (TX-6's comparison, TX-7's table).
  const picker = await import(
    url(path.join(ROOT, "tools/src/picker/text-rules.js"))
  );
  const rules = await damaged(
    t,
    RULES_FILE,
    "MAX_WORDS = 18",
    "MAX_WORDS = 19",
  );
  assert.notDeepEqual(ruleDifferences(rules, picker, corpus()), []);
  /** @type {Array<[string, RegExp]>} the head of the damaged function, and the finding it must give */
  const heads = [
    // A header read as a fourth parameter: the length of the function is 4.
    [
      "export function pickLang(query, stored, langs, header) {\n  if (query === null && header !== undefined && langs.includes(header)) return header;",
      /pickLang\.length is 4/,
    ],
    // The same with a default value, which Function.length does not count: the parameter list does.
    [
      'export function pickLang(query, stored, langs, header = "") {\n  if (query === null && langs.includes(header)) return header;',
      /pickLang has 4 parameters/,
    ],
  ];
  for (const [head, want] of heads) {
    const header = await damaged(
      t,
      LANG_FILE,
      "export function pickLang(query, stored, langs) {",
      head,
    );
    assert.ok(
      langFindings(header).some((f) => want.test(f)),
      JSON.stringify(langFindings(header)),
    );
  }
});

// ---------------------------------------------------------------------------------------------------------
// REQ-113 (the visitor status block): TX-9, the words of the 15 keys, and TX-10, the static source of how.html.

/**
 * The whole words that no ru or en value of the 15 keys may hold (REQ-113 criterion 2; the list is closed: a form
 * that is not written here is no violation).
 * @type {Record<string, string[]>}
 */
const CLOSED_WORDS = {
  ru: [
    "контакт",
    "контакты",
    "контактов",
    "почта",
    "почту",
    "почты",
    "почте",
    "форма",
    "форму",
    "формы",
    "форме",
    "регистрация",
    "регистрации",
    "регистрацию",
  ],
  en: [
    "contact",
    "contacts",
    "email",
    "mail",
    "form",
    "forms",
    "register",
    "registration",
    "waitlist",
  ],
};

/**
 * The closed words that a text holds as whole words: compared without letter case, between borders of Unicode
 * letters and digits, never as a substring (AP-120).
 * @param {string} text
 * @param {string} lang
 * @returns {string[]}
 */
function closedWordHits(text, lang) {
  return (CLOSED_WORDS[lang] ?? []).filter((word) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "iu").test(text),
  );
}

/**
 * The findings of REQ-113 criterion 2 in one value: the lists of the forbidden-words lint in the value's own
 * language, the rules of the public text (a phrase of at most 18 words, no ты-form), a digit, and for ru and en
 * the closed whole words. Each finding is one line, `<key> <lang>: <what>`.
 * @param {string} key
 * @param {string} lang
 * @param {string} value
 * @returns {string[]}
 */
function valueFindings(key, lang, value) {
  /** @type {string[]} */
  const out = [];
  for (const f of lintText(value, lang))
    out.push(`${key} ${lang}: list ${f.list} «${f.form}»`);
  const problem = textProblem(value);
  if (problem !== null)
    out.push(`${key} ${lang}: the text rule gives ${JSON.stringify(problem)}`);
  if (/\p{N}/u.test(value)) out.push(`${key} ${lang}: a digit`);
  for (const word of closedWordHits(value, lang))
    out.push(`${key} ${lang}: the whole word «${word}»`);
  return out;
}

test("TX-9 the 45 values of the 15 keys of the visitor status block pass the lint of the lists, the text rule, no digit and none of the closed words", () => {
  /** @type {string[]} */
  const found = [];
  let checked = 0;
  for (const [key] of STATUS_VALUES) {
    const entry = texts.TEXTS[key];
    if (entry === undefined) {
      found.push(`${key}: the key is missing`);
      continue;
    }
    for (const lang of texts.LANGS) {
      checked += 1;
      found.push(...valueFindings(key, lang, entry[lang]));
    }
  }
  assert.equal(checked, 45, "15 keys in three languages, every value read");
  assert.deepEqual(found, []);

  // The rule's own cases: it finds what it is meant to find, so the empty answer above is no blind rule. The
  // cases are by class of input: every closed word as a whole word in four settings, and as a part of a longer
  // word in four others (AP-110).
  for (const lang of Object.keys(CLOSED_WORDS))
    for (const word of CLOSED_WORDS[lang]) {
      for (const text of [
        `Тут ${word}.`,
        `«${word}»`,
        word.toUpperCase(),
        `a-${word}`,
      ])
        assert.deepEqual(
          closedWordHits(text, lang),
          [word],
          `the rule finds «${word}» as a whole word`,
        );
      for (const text of [`${word}ный`, `без${word}`, `${word}1`, `1${word}`])
        assert.deepEqual(
          closedWordHits(text, lang),
          [],
          "the rule does not find a substring",
        );
    }
  assert.deepEqual(
    closedWordHits("Контакты", "ru"),
    ["контакты"],
    "the rule finds «контакт» as a whole word",
  );
  assert.deepEqual(
    closedWordHits("контактный", "ru"),
    [],
    "the rule does not find a substring",
  );
  assert.deepEqual(closedWordHits("Contact us", "ru"), []);
  assert.ok(
    valueFindings("k", "ru", "Срок запуска").some((f) =>
      /list С «срок»/.test(f),
    ),
    "a form of a list in ru is found",
  );
  assert.ok(
    valueFindings("k", "kk", "Іске қосу күні").some((f) =>
      /list Ц «күні»/.test(f),
    ),
    "a form of a list in kk is found",
  );
  assert.ok(
    valueFindings("k", "en", "Price 100 %").some((f) => /list Ц/.test(f)),
    "a form of a list in en is found",
  );
  assert.ok(
    valueFindings("k", "ru", "Это ты сам").some((f) => /formal/.test(f)),
    "the ты-form is found",
  );
  const nineteen = Array.from({ length: 19 }, () => "слово").join(" ");
  assert.equal(
    valueFindings("k", "ru", `${nineteen}.`).length,
    1,
    "a phrase of 19 words is found",
  );
  assert.deepEqual(valueFindings("k", "ru", `${nineteen.slice(6)}.`), []);
  assert.deepEqual(
    valueFindings("k", "ru", "Один 2 три."),
    ["k ru: a digit"],
    "a digit is found",
  );
});

// ---------------------------------------------------------------------------------------------------------
// TX-10: the static source of how.html, read by a tolerant reader of the markup built here (the oracle).

/**
 * @typedef {{ tag: string, attrs: Record<string, string>, kids: Array<HtmlNode | string>, parent: HtmlNode | null, start: number, end: number }} HtmlNode
 */

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/**
 * A tolerant reader of a page's markup: the tree of its elements with their attributes, the text, and the place
 * of each element in the source (`start` at its `<`, `end` after its closing tag). Comments and the doctype are
 * skipped, void elements have no children, a closing tag closes the nearest open element of its name.
 * @param {string} src
 * @returns {HtmlNode}
 */
function readHtml(src) {
  /** @type {HtmlNode} */
  const root = {
    tag: "#root",
    attrs: {},
    kids: [],
    parent: null,
    start: 0,
    end: src.length,
  };
  let node = root;
  let at = 0;
  const tags =
    /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  for (const m of src.matchAll(tags)) {
    if (m.index > at) node.kids.push(src.slice(at, m.index));
    at = m.index + m[0].length;
    if (m[2] === undefined) continue;
    const tag = m[2].toLowerCase();
    if (m[1] === "/") {
      let up = node;
      while (up !== root && up.tag !== tag)
        up = /** @type {HtmlNode} */ (up.parent);
      if (up !== root) {
        up.end = at;
        node = /** @type {HtmlNode} */ (up.parent);
      }
      continue;
    }
    /** @type {Record<string, string>} */
    const attrs = {};
    for (const a of m[3].matchAll(
      /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
    ))
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? "";
    /** @type {HtmlNode} */
    const el = { tag, attrs, kids: [], parent: node, start: m.index, end: at };
    node.kids.push(el);
    if (!VOID_TAGS.has(tag) && !m[3].endsWith("/")) node = el;
  }
  if (at < src.length) node.kids.push(src.slice(at));
  return root;
}

/** @param {HtmlNode} n @returns {HtmlNode[]} the child elements */
const childElements = (n) =>
  /** @type {HtmlNode[]} */ (n.kids.filter((k) => typeof k !== "string"));

/** @param {HtmlNode} n @returns {HtmlNode[]} every element below `n`, in source order */
function descendants(n) {
  /** @type {HtmlNode[]} */
  const out = [];
  for (const k of childElements(n)) out.push(k, ...descendants(k));
  return out;
}

/** @param {HtmlNode} n @returns {string} the text of the element, white space folded */
const textOfNode = (n) =>
  n.kids
    .map((k) => (typeof k === "string" ? k : textOfNode(k)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

/** @param {HtmlNode} n @param {string} cls */
const hasClass = (n, cls) =>
  (n.attrs.class ?? "").split(/\s+/).filter(Boolean).includes(cls);

/**
 * The shape of an element: `<tag` and, when it has attributes other than `data-t`, a space and the attributes
 * sorted by name as `name=value` joined by commas, `>`, the shapes of the child elements, `</>`; text and
 * `data-t` are left out. The same function stands in landing.test.js for the page in the browser.
 * @param {HtmlNode} n
 * @returns {string}
 */
function skeletonOfNode(n) {
  const attrs = Object.entries(n.attrs)
    .filter(([name]) => name !== "data-t")
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join(",");
  return `<${n.tag}${attrs === "" ? "" : ` ${attrs}`}>${childElements(n).map(skeletonOfNode).join("")}</>`;
}

/** The shape of the status block on every page that holds it (REQ-113 design 4.2, F15). */
const NOW_SKELETON =
  "<section aria-labelledby=now-title,class=info now><h3 id=now-title></><ul class=rl>" +
  "<li><span class=stat on></><span class=rn><b></><small></></></>" +
  "<li><span class=stat></><span class=rn><b></><small></></></>" +
  "<li><span class=stat></><span class=rn><b></><small></></></>" +
  "</><p></></>";

/** How many elements of how.html carry each of the added keys (REQ-113 design F19). */
const HOW_KEY_COUNTS = {
  now_title: 1,
  now_demo_t: 2,
  now_demo_s: 1,
  now_idea_t: 2,
  now_idea_s: 1,
  now_build_t: 1,
  now_build_s: 1,
  stat_on: 2,
  stat_off: 6,
  now_closing: 1,
  how_plan_note: 1,
  how_stage_1_note: 1,
  demo_accuracy_note: 0,
};

/** The text of `ol.steps` of how.html at the base of REQ-113, from `<ol class="steps">` to `</ol>`. */
const STEPS_SHA256 =
  "8a03a716ebbf3bda63ecc562747382cd1e9a8878fc647f9ab9dde20046941cb5";

/**
 * What the static source of how.html gets wrong against REQ-113 criterion 6, as lines.
 * @param {string} src the page's source text
 * @param {Record<string, Record<string, string>>} T the texts module
 * @returns {string[]}
 */
function howFindings(src, T) {
  /** @type {string[]} */
  const out = [];
  const all = descendants(readHtml(src));
  /** @param {string} key */
  const keyed = (key) => all.filter((n) => n.attrs["data-t"] === key);

  // (a) every element with a key shows its ru value as its static text (the page without script).
  for (const n of all) {
    const key = n.attrs["data-t"];
    if (key === undefined) continue;
    const want = T[key]?.ru;
    if (typeof want !== "string")
      out.push(`how.html: ${key} is no key of the module`);
    else if (textOfNode(n) !== want.replace(/\s+/g, " ").trim())
      out.push(`how.html: ${key} static text differs from its ru value`);
  }
  // (b) the added keys stand as often as the design says.
  for (const [key, want] of Object.entries(HOW_KEY_COUNTS)) {
    const n = keyed(key).length;
    if (n !== want) out.push(`how.html: ${key} stands ${n} times, not ${want}`);
  }

  const blocks = all.filter(
    (n) => n.tag === "section" && hasClass(n, "info") && hasClass(n, "now"),
  );
  const intros = all.filter((n) => n.tag === "section" && hasClass(n, "intro"));
  const steps = all.filter((n) => n.tag === "ol" && hasClass(n, "steps"));
  const stages = all.filter(
    (n) => n.tag === "div" && hasClass(n, "how-stages"),
  );
  const panels = all.filter((n) => n.tag === "div" && hasClass(n, "panels"));
  const plan = keyed("how_plan_note");
  const block = blocks[0];
  // (c) the order in the source: the intro, the block, the plan note, the steps, the stages, the panels; the block
  // beside the intro, the note the first element of the section that holds the steps.
  const ordered =
    blocks.length === 1 &&
    intros.length === 1 &&
    plan.length === 1 &&
    steps.length === 1 &&
    stages.length === 1 &&
    panels.length === 1 &&
    [intros[0], block, plan[0], steps[0], stages[0], panels[0]].every(
      (n, i, line) => i === 0 || n.start > line[i - 1].start,
    ) &&
    block.parent === intros[0].parent &&
    plan[0].parent === steps[0].parent &&
    steps[0].parent !== null &&
    childElements(steps[0].parent)[0] === plan[0];
  if (!ordered)
    out.push(
      "how.html: the status block follows the intro and precedes the steps",
    );
  if (block === undefined || steps.length === 0) return out;

  // (d) the block is no part of the panels and of no region that the open build cuts, and holds no order text.
  const regions = [
    ...src.matchAll(
      /<!--\s*sai:(order|kk)\s*-->[\s\S]*?<!--\s*\/sai:\1\s*-->/g,
    ),
  ].map((m) => [m.index, m.index + m[0].length]);
  let inPanels = false;
  for (let up = block.parent; up !== null; up = up.parent)
    if (hasClass(up, "panels")) inPanels = true;
  const orderKey = [block, ...descendants(block)].some((n) =>
    (n.attrs["data-t"] ?? "").startsWith("order_"),
  );
  if (
    inPanels ||
    orderKey ||
    regions.some(([from, to]) => block.start >= from && block.start < to)
  )
    out.push(
      "how.html: the status block is inside the panels or an order region",
    );

  // (e) the markup of the block.
  if (skeletonOfNode(block) !== NOW_SKELETON)
    out.push("how.html: the status block has the markup of the design");

  // (f) the stages: the children of each section in order, the marks and the names beside them.
  /** @param {HtmlNode} e */
  const describe = (e) => {
    if (e.tag === "p" && hasClass(e, "stat-line"))
      return `p.stat-line(${childElements(e)
        .map((k) =>
          hasClass(k, "pair")
            ? childElements(k)
                .map((x) => x.attrs["data-t"] ?? "?")
                .join("+")
            : (k.attrs["data-t"] ?? "?"),
        )
        .join(" | ")})`;
    const cls = e.attrs.class === undefined ? "" : `.${e.attrs.class}`;
    const key = e.attrs["data-t"] === undefined ? "" : `:${e.attrs["data-t"]}`;
    return `${e.tag}${cls}${key}`;
  };
  for (const n of [1, 2, 3, 4]) {
    const stage = all.find((e) => e.attrs.id === `stage-${n}`);
    const got =
      stage === undefined
        ? "no section"
        : childElements(stage).map(describe).join(", ");
    const want =
      n === 1
        ? "h2, p.stat-line(stat_on+now_demo_t | stat_off+now_idea_t), p:how_stage_1_note, p:how_stage_1_text"
        : `h2, p.stat-line(stat_off), p:how_stage_${n}_text`;
    if (got !== want)
      out.push(`how.html: the stage ${n} holds ${got}, not ${want}`);
  }

  // (g) the two notes are plain paragraphs: no class (so no small grey print).
  for (const note of [...plan, ...keyed("how_stage_1_note")])
    if (note.attrs.class !== undefined)
      out.push("how.html: a note carries a class");

  // (h) the steps and their buttons are as at the base.
  const list = steps[0];
  const inside = descendants(list);
  const buttons = inside.filter((n) => n.tag === "button");
  if (
    createHash("sha256")
      .update(src.slice(list.start, list.end))
      .digest("hex") !== STEPS_SHA256 ||
    buttons.map((b) => b.attrs["data-step"]).join() !== "1,2,3,4" ||
    buttons.some((b) => b.attrs["aria-pressed"] === undefined) ||
    inside.some((n) => hasClass(n, "stat") || hasClass(n, "stat-line"))
  )
    out.push("how.html: ol.steps is not byte for byte as at the base");
  return out;
}

test("TX-10 the static source of how.html: the status block between the intro and the steps, its markup and keys, the stage marks and notes, the static Russian text equals the module, ol.steps as at the base", () => {
  const src = fs.readFileSync(path.join(APP, "public", "how.html"), "utf8");
  assert.deepEqual(howFindings(src, texts.TEXTS), []);

  // (i) each of the 13 added keys is used by a page or by a script of app/public.
  const pages = filesUnder(path.join(APP, "public"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  const scripts = filesUnder(path.join(APP, "public", "js"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  for (const [key] of ADDED_VALUES)
    assert.ok(
      pages.includes(`data-t="${key}"`) ||
        scripts.includes(`"${key}"`) ||
        scripts.includes(`'${key}'`),
      `${key} is used by no page`,
    );

  // The reader is no blind one: each damaged copy of the page gives the finding of its place.
  /**
   * @param {string} from
   * @param {string} to
   * @returns {string}
   */
  const damage = (from, to) => {
    assert.ok(src.includes(from), `the place to damage: ${from}`);
    return src.replace(from, () => to);
  };
  const block = descendants(readHtml(src)).find(
    (n) => n.tag === "section" && hasClass(n, "now"),
  );
  assert.ok(block !== undefined, "the block is in the source");
  const blockText = src.slice(block.start, block.end);
  const withoutBlock = src.slice(0, block.start) + src.slice(block.end);
  const stageMark = (/** @type {string} */ mark) =>
    `<p class="stat-line">\n                ${mark}\n              </p>\n              <p data-t="how_stage_3_text">`;
  const off = '<span class="stat" data-t="stat_off">Пока нет</span>';
  /** @type {Array<[string, string, RegExp]>} */
  const copies = [
    [
      "a typo in a static text",
      damage(">Работает</span>", ">Работаеть</span>"),
      /stat_on static text differs/,
    ],
    [
      "the block after the steps",
      withoutBlock.replace(
        '<div class="how-stages">',
        () => `${blockText}<div class="how-stages">`,
      ),
      /the status block follows the intro and precedes the steps/,
    ],
    [
      "the plan note with a class",
      damage(
        '<p data-t="how_plan_note">',
        '<p class="fine" data-t="how_plan_note">',
      ),
      /a note carries a class/,
    ],
    [
      "the plan note without its key",
      damage('<p data-t="how_plan_note">', "<p>"),
      /how_plan_note stands 0 times/,
    ],
    [
      "stage 3 with the mark Working",
      damage(
        stageMark(off),
        stageMark('<span class="stat on" data-t="stat_on">Работает</span>'),
      ),
      /the stage 3 holds/,
    ],
    [
      "a mark inside a stage button",
      damage('<span class="sn">1</span', `${off}<span class="sn">1</span`),
      /ol\.steps is not byte for byte/,
    ],
    [
      "a step button without aria-pressed",
      damage(
        '<button type="button" data-step="2" aria-pressed="false">',
        '<button type="button" data-step="2">',
      ),
      /ol\.steps is not byte for byte/,
    ],
    [
      "the block inside an order region",
      damage(
        '<section class="info now"',
        '<!-- sai:order -->\n<section class="info now"',
      ).replace(
        '</section>\n        <section>\n          <p data-t="how_plan_note">',
        () =>
          '</section>\n<!-- /sai:order -->\n        <section>\n          <p data-t="how_plan_note">',
      ),
      /inside the panels or an order region/,
    ],
    [
      "the closing paragraph without its key",
      damage('<p data-t="now_closing">', "<p>"),
      /now_closing stands 0 times/,
    ],
    [
      "an odd class on the mark of row 3",
      damage(
        `${off}\n              <span class="rn"\n                ><b data-t="now_build_t">`,
        `<span class="stat later" data-t="stat_off">Пока нет</span>\n              <span class="rn"\n                ><b data-t="now_build_t">`,
      ),
      /the status block has the markup of the design/,
    ],
    [
      "a link inside the block",
      damage(
        '<p data-t="now_closing">',
        '<a href="/x">x</a><p data-t="now_closing">',
      ),
      /the status block has the markup of the design/,
    ],
  ];
  for (const [name, copy, want] of copies)
    assert.ok(
      howFindings(copy, texts.TEXTS).some((f) => want.test(f)),
      `${name}: ${JSON.stringify(howFindings(copy, texts.TEXTS))}`,
    );
});

/** The 23 codes of the code design M2AUTH, 4.8 (AUTH_CODES): every code that routes 4-15 can answer. */
const AUTH_CODES_OF_THE_DESIGN = [
  "not_found",
  "body_too_large",
  "site_closed",
  "bad_json",
  "bad_body",
  "server_error",
  "server_config",
  "auth_required",
  "invalid_credentials",
  "totp_required",
  "totp_invalid",
  "origin_refused",
  "csrf_refused",
  "reauth_required",
  "unsupported_type",
  "password_rules",
  "unknown_purpose",
  "reset_invalid",
  "totp_state",
  "locked",
  "reauth_locked",
  "rate_limited",
  "db_unavailable",
];

test("TX-11 AUTH_CODES of errors.js equals the 23 codes of the code design (body_too_large and site_closed among them), and each code has an auth_err_<code> key with ru, kk and en values", async () => {
  const { AUTH_CODES, ERROR_STATUS } = await import(
    url(path.join(APP, "server", "http", "errors.js"))
  );
  assert.equal(AUTH_CODES_OF_THE_DESIGN.length, 23);
  assert.deepEqual(
    [...AUTH_CODES].sort(),
    [...AUTH_CODES_OF_THE_DESIGN].sort(),
  );
  assert.equal(new Set(AUTH_CODES).size, AUTH_CODES.length, "no code twice");
  for (const code of AUTH_CODES_OF_THE_DESIGN) {
    assert.ok(Object.hasOwn(ERROR_STATUS, code), `${code} has a status`);
    const entry = texts.TEXTS[`auth_err_${code}`];
    assert.ok(entry, `auth_err_${code}`);
    for (const lang of ["ru", "kk", "en"]) {
      assert.equal(typeof entry[lang], "string", `auth_err_${code} ${lang}`);
      assert.ok(entry[lang].trim().length > 0, `auth_err_${code} ${lang}`);
    }
    // The lock and limit texts name no duration (word lists В and Ц).
    assert.doesNotMatch(
      entry.ru,
      /(?<!\p{L})(минут|секунд|час|дня|дней|сутк)|\d/iu,
      `auth_err_${code}`,
    );
  }
  // No auth_err_ key without a code: the pages map exactly these.
  const extra = Object.keys(texts.TEXTS)
    .filter((k) => k.startsWith("auth_err_"))
    .map((k) => k.slice("auth_err_".length))
    .filter((c) => !AUTH_CODES_OF_THE_DESIGN.includes(c));
  assert.deepEqual(extra, []);
});
