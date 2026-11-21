import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { LANGS, LISTS, lintText } from "../../scripts/word-lists.js";
import { APP, tempDir } from "../fixtures/helpers.js";

// REQ-111 criterion 3: the forbidden-words lint. The lists are written here as a literal table (the forms of
// the requirement), so the test does not read its oracle from the module under test.

/** The lists Г, Б, В, Ц, С with their forms in ru, kk and en, as the requirement writes them. */
const TABLE = {
  Г: {
    ru: "гарантия гарантии гарантию гарантией гарантий гарантируем гарантирует гарантируют гарантирую гарантированно гарантированный гарантированная гарантированное гарантированные",
    kk: "кепіл кепілдік кепілдігі кепілдікті кепілдігін кепілдейміз кепілдейді",
    en: "guarantee guarantees guaranteed guaranteeing warranty warranties",
  },
  Б: {
    ru: "бесплатно бесплатный бесплатная бесплатное бесплатные бесплатного бесплатной бесплатному бесплатным бесплатных",
    kk: "тегін тегінге",
    en: "free gratis",
  },
  В: {
    ru: "минута минуту минуты минуте минутой минут минутам минутами минутах",
    kk: "минут минутта минуттан минутты минуттар",
    en: "minute minutes",
  },
  Ц: {
    ru: "цена цены цене цену ценой цен ценам ценами ценах день дня дню днём днем дне дни дней дням днями днях тенге стоимость стоимости",
    kk: "баға бағасы бағаны бағаның бағада күн күні күнді күндер күндері теңге",
    en: "price prices cost costs day days tenge KZT",
  },
  С: {
    ru: "срок срока сроку сроком сроке сроки сроков срокам сроками сроках",
    kk: "мерзім мерзімі мерзімін мерзімде мерзімнен мерзімдер мерзімдері",
    en: "deadline deadlines",
  },
};
const COUNTS = {
  Г: [14, 7, 6],
  Б: [10, 2, 2],
  В: [9, 5, 2],
  Ц: [23, 11, 8],
  С: [10, 7, 2],
};
const NAMES = Object.keys(TABLE);
/** @type {Array<"ru" | "kk" | "en">} */
const LANG_LIST = ["ru", "kk", "en"];
const forms = (
  /** @type {string} */ list,
  /** @type {"ru" | "kk" | "en"} */ lang,
) =>
  /** @type {Record<string, Record<string, string>>} */ (TABLE)[list][
    lang
  ].split(" ");
const ORDINARY = {
  ru: ["текст", "про", "дом"],
  kk: ["мәтін", "және", "үй"],
  en: ["plain", "text", "home"],
};
/** The ordinary words around a form, so the form is "set among ordinary words". */
const around = (
  /** @type {string} */ lang,
  /** @type {string} */ left,
  /** @type {string} */ form,
  /** @type {string} */ right,
) => {
  const [a, b] = ORDINARY[/** @type {"ru" | "kk" | "en"} */ (lang)];
  return `${a}${left}${form}${right}${b}`;
};
// The six borders of the criterion: a space, a dot, a comma, a bracket, a hyphen and U+00A0.
const BORDERS = /** @type {Array<[string, string]>} */ ([
  [" ", " "],
  [".", "."],
  [",", ","],
  ["(", ")"],
  ["-", "-"],
  [" ", " "],
]);
const lower = (/** @type {string} */ s) => s.toLocaleLowerCase("ru");
const upper = (/** @type {string} */ s) => s.toLocaleUpperCase("ru");
const capital = (/** @type {string} */ s) =>
  upper(s.slice(0, 1)) + lower(s.slice(1));

test("FW-1 the lists equal the literal table of the test: the forms and the counts, no form twice", () => {
  assert.deepEqual([...LANGS], LANG_LIST);
  assert.deepEqual(Object.keys(LISTS), NAMES);
  assert.ok(Object.isFrozen(LISTS));
  let total = 0;
  for (const name of NAMES) {
    const list =
      /** @type {Record<string, Record<string, readonly string[]>>} */ (LISTS)[
        name
      ];
    assert.ok(Object.isFrozen(list), name);
    assert.deepEqual(Object.keys(list).sort(), ["en", "kk", "ru"], name);
    LANG_LIST.forEach((lang, i) => {
      assert.ok(Object.isFrozen(list[lang]), `${name} ${lang}`);
      assert.deepEqual([...list[lang]], forms(name, lang), `${name} ${lang}`);
      assert.equal(
        list[lang].length,
        /** @type {Record<string, number[]>} */ (COUNTS)[name][i],
        `${name} ${lang}`,
      );
      assert.equal(
        new Set(list[lang].map(lower)).size,
        list[lang].length,
        `${name} ${lang} has a repeat`,
      );
      total += list[lang].length;
    });
  }
  assert.equal(total, 118);
  // No form stands in two lists of one language (a form would then have two names).
  for (const lang of LANG_LIST) {
    const seen = new Set();
    for (const name of NAMES)
      for (const f of forms(name, lang)) {
        assert.ok(!seen.has(lower(f)), `${lang}: ${f} stands in two lists`);
        seen.add(lower(f));
      }
  }
});

test("FW-2 every form of every list, in its language, in lower case, upper case and with a capital, with the six borders, is found with its list's name", () => {
  let checked = 0;
  for (const name of NAMES)
    for (const lang of LANG_LIST)
      for (const form of forms(name, lang))
        for (const variant of [lower(form), upper(form), capital(form)])
          for (const [l, r] of BORDERS) {
            const shapes = [
              around(lang, l, variant, r),
              // at the start and at the end of the text, the border on one side only
              `${variant}${r} ${ORDINARY[lang][0]}`,
              `${ORDINARY[lang][0]} ${l}${variant}`,
            ];
            for (const text of shapes) {
              assert.deepEqual(
                lintText(text, lang),
                [{ list: name, form }],
                `${lang} ${name} ${JSON.stringify(text)}`,
              );
              checked++;
            }
          }
  // 118 forms, three letter cases, six borders, three shapes.
  assert.equal(checked, 118 * 3 * 6 * 3);
  // A form with the other punctuation of a sentence, and the lists applied one by one.
  assert.deepEqual(lintText("Это бесплатно!", "ru"), [
    { list: "Б", form: "бесплатно" },
  ]);
  assert.deepEqual(lintText("Это бесплатно!", "ru", ["Г"]), []);
  assert.deepEqual(lintText("Это бесплатно!", "ru", ["Б"]), [
    { list: "Б", form: "бесплатно" },
  ]);
  // Two forms of two lists: both found, in the order in which they first stand.
  assert.deepEqual(lintText("Срок и цена, и срок", "ru"), [
    { list: "С", form: "срок" },
    { list: "Ц", form: "цена" },
  ]);
});

test("FW-3 a form that only another language's list has is not found in this language; «минут» is found in ru and in kk", () => {
  /** @type {Map<string, Set<string>>} the languages that hold each form (in lower case) */
  const holders = new Map();
  for (const name of NAMES)
    for (const lang of LANG_LIST)
      for (const f of forms(name, lang)) {
        const key = lower(f);
        holders.set(key, (holders.get(key) ?? new Set()).add(lang));
      }
  // The exhaustive pass over the 118 forms: «минут» is the one form that two languages share.
  const shared = [...holders].filter(([, langs]) => langs.size > 1);
  assert.deepEqual(
    shared.map(([f, l]) => [f, [...l].sort()]),
    [["минут", ["kk", "ru"]]],
  );
  let checked = 0;
  for (const name of NAMES)
    for (const from of LANG_LIST)
      for (const form of forms(name, from))
        for (const lang of LANG_LIST) {
          if (lang === from || holders.get(lower(form))?.has(lang)) continue;
          for (const variant of [lower(form), upper(form), capital(form)]) {
            assert.deepEqual(
              lintText(around(lang, " ", variant, " "), lang),
              [],
              `${from} form ${variant} in a ${lang} text`,
            );
            checked++;
          }
        }
  assert.ok(checked > 118 * 3);
  for (const lang of ["ru", "kk"])
    assert.deepEqual(
      lintText("через 5 минут", lang),
      [{ list: "В", form: "минут" }],
      lang,
    );
  assert.deepEqual(lintText("через 5 минут", "en"), []);
});

test("FW-4 list П: the six forms of 100 percent are found in every language; «1100 %», «100,5 %», «0,100 %» and the near forms are not", () => {
  const found = [
    "100%",
    "100 %",
    "100 %",
    "100 %",
    "100 процентов",
    "100 percent",
    "100 процента",
    "100 процент",
    "100 пайыз",
    "100процентов",
    "ВСЕ 100 ПРОЦЕНТОВ",
    "100 Percent.",
    "(100 %)",
    "на 100%.",
    "100-100 %",
  ];
  for (const lang of LANG_LIST)
    for (const text of found) {
      const got = lintText(`Это ${text} точно`, lang);
      assert.equal(got.length, 1, `${lang} ${text}: ${JSON.stringify(got)}`);
      assert.equal(got[0].list, "П", `${lang} ${text}`);
      assert.ok(
        got[0].form.startsWith("100"),
        `${lang} ${text}: ${got[0].form}`,
      );
    }
  const notFound = [
    "1100 %",
    "100,5 %",
    "0,100 %",
    "100.5 %",
    "0.100 %",
    "1,100 %",
    "5100 %",
    "100 000 %",
    "1000%",
    "99 %",
    "200 %",
    "100",
    "100 percents",
    "100 процентный",
    "100  %",
    "%100",
    "100,5%",
    "100.5%",
  ];
  for (const lang of LANG_LIST)
    for (const text of notFound)
      assert.deepEqual(
        lintText(`Это ${text} точно`, lang),
        [],
        `${lang} ${text}`,
      );
  // Only list П applies when it is the one asked for.
  assert.deepEqual(lintText("100 % бесплатно", "ru", ["П"]), [
    { list: "П", form: "100 %" },
  ]);
  assert.deepEqual(lintText("100 % бесплатно", "ru", ["Б"]), [
    { list: "Б", form: "бесплатно" },
  ]);
});

test("FW-5 the 17 twins are not found in any language; a form joined to a letter or a digit is another word", () => {
  const twins = [
    "свободный",
    "freedom",
    "freezer",
    "минутка",
    "ценность",
    "дневник",
    "срочно",
    "просрочка",
    "today",
    "holiday",
    "costume",
    "1100 %",
    "100,5 %",
    "0,100 %",
    "decision",
    "order",
    "тестирование",
  ];
  assert.equal(twins.length, 17);
  for (const lang of LANG_LIST)
    for (const twin of twins) {
      assert.deepEqual(lintText(twin, lang), [], `${lang} ${twin}`);
      assert.deepEqual(
        lintText(`Сайт ${twin} Sai.`, lang),
        [],
        `${lang} ${twin}`,
      );
    }
  // The substring property over every form: a form with a letter or a digit joined before or after it is a
  // longer word, which is not on any list, so the lint finds nothing.
  for (const name of NAMES)
    for (const lang of LANG_LIST)
      for (const form of forms(name, lang))
        for (const text of [
          `x${form}`,
          `${form}x`,
          `${form}1`,
          `1${form}`,
          `${form}ка`,
          `под${form}`,
        ])
          assert.deepEqual(lintText(text, lang), [], `${lang} ${text}`);
});

test("FW-6 a text that is no string throws a TypeError, an unknown language or list a RangeError, the empty text gives no finding", () => {
  const before = JSON.stringify(LISTS);
  for (const bad of [
    null,
    undefined,
    1,
    true,
    {},
    [],
    ["a"],
    Symbol("a"),
    () => "a",
    10n,
    // A String object has the methods of a string and is none: the rule is on the type.
    new String("бесплатно"),
    { matchAll: () => [] },
  ])
    assert.throws(
      () => lintText(/** @type {any} */ (bad), "ru"),
      TypeError,
      String(typeof bad),
    );
  for (const lang of [
    "de",
    "RU",
    "",
    "ru ",
    "kz",
    "English",
    null,
    undefined,
    1,
    {},
  ])
    assert.throws(
      () => lintText("текст", /** @type {any} */ (lang)),
      RangeError,
      String(lang),
    );
  for (const list of ["Z", "г", "Т", "Р", "Ч", "", "ГБ", "T", "Ц "])
    assert.throws(() => lintText("текст", "ru", [list]), RangeError, list);
  assert.throws(
    () => lintText("текст", "ru", /** @type {any} */ ("Г")),
    TypeError,
  );
  for (const lang of LANG_LIST) {
    assert.deepEqual(lintText("", lang), []);
    assert.deepEqual(lintText("", lang, []), []);
    assert.deepEqual(lintText("", lang, ["Г", "Б", "В", "П", "Ц", "С"]), []);
  }
  // The sign of the tenge is a finding of list Ц in every language, and only of it.
  for (const lang of LANG_LIST) {
    assert.deepEqual(
      lintText("Итого 500 ₸", lang),
      [{ list: "Ц", form: "₸" }],
      lang,
    );
    assert.deepEqual(
      lintText("500₸ и 600 ₸", lang),
      [{ list: "Ц", form: "₸" }],
      lang,
    );
    assert.deepEqual(
      lintText("500 ₸", lang, ["Г", "Б", "В", "П", "С"]),
      [],
      lang,
    );
  }
  // No call changed the lists.
  assert.equal(JSON.stringify(LISTS), before);
});

// ---------------------------------------------------------------------------------------------------------
// FW-7 check-public on planted copies of app/public and app/content.

/**
 * A fresh pair of folders `public` and `content` beside each other, copies of the real ones, outside the
 * project; `plant` edits them.
 * @param {import("node:test").TestContext} t
 * @param {(dir: string) => void} [plant] gets the folder that holds public/ and content/
 */
function copies(t, plant) {
  const root = tempDir(t);
  fs.cpSync(path.join(APP, "public"), path.join(root, "public"), {
    recursive: true,
  });
  fs.cpSync(path.join(APP, "content"), path.join(root, "content"), {
    recursive: true,
  });
  if (plant) plant(root);
  return root;
}

const run = (/** @type {string} */ root) =>
  spawnSync(
    process.execPath,
    ["scripts/check-public.js", path.join(root, "public")],
    {
      cwd: APP,
      encoding: "utf8",
    },
  );

/**
 * A key added at the end of the texts module of a copy, the values in the three languages.
 * @param {string} root
 * @param {{ ru?: string, kk?: string, en?: string }} v
 */
function plantKey(root, v) {
  const file = path.join(root, "public/shared/i18n/texts.js");
  const src = fs.readFileSync(file, "utf8");
  const end = src.lastIndexOf("});");
  assert.ok(end > 0);
  const entry = `  planted_x: Object.freeze({ ru: ${JSON.stringify(v.ru ?? "Один")}, kk: ${JSON.stringify(v.kk ?? "Бір")}, en: ${JSON.stringify(v.en ?? "One")} }),\n`;
  fs.writeFileSync(file, src.slice(0, end) + entry + src.slice(end));
}

/**
 * An edit of the intake of a copy, by a function on the parsed file.
 * @param {string} root
 * @param {(intake: any) => void} edit
 */
function editIntake(root, edit) {
  const file = path.join(root, "content/sai-intake.json");
  const intake = JSON.parse(fs.readFileSync(file, "utf8"));
  edit(intake);
  fs.writeFileSync(file, JSON.stringify(intake, null, 2));
}

/**
 * A page of a copy with one edit of its text.
 * @param {string} root
 * @param {string} page
 * @param {string} from
 * @param {string} to
 */
function editPage(root, page, from, to) {
  const file = path.join(root, "public", page);
  const src = fs.readFileSync(file, "utf8");
  assert.ok(src.includes(from), `${page} holds ${from}`);
  fs.writeFileSync(
    file,
    src.replace(from, () => to),
  );
}

test("FW-7 check-public on planted copies: each planted value ends with exit 1 and the line of 4.10; on the real files exit 0", (t) => {
  const real = run(copies(t));
  assert.equal(real.status, 0, real.stdout);
  assert.equal(real.stdout, "check-public: app/public is clean\n");
  assert.equal(real.stderr, "");
  const W = ["бесплат", "но"].join("");
  const G = ["гаран", "тия"].join("");
  const handoff = ["hand", "off"].join("");
  const req = ["RE", "Q"].join("");
  /** @type {Array<[string, (root: string) => void, string]>} the name, the plant, the line that must stand in the output */
  const planted = [
    [
      "a texts value «бесплатно»",
      (root) => plantKey(root, { ru: `Это ${W}` }),
      `check-public: shared/i18n/texts.js: key planted_x: ru: list Б «${W}»`,
    ],
    [
      "an intake option «гарантия»",
      (root) =>
        editIntake(
          root,
          (i) => (i.questions[0].options[1].label.ru = `Это ${G}`),
        ),
      `check-public: ../content/sai-intake.json: questions[0].options[1].label: ru: list Г «${G}»`,
    ],
    [
      "a page «5 минут»",
      (root) =>
        editPage(
          root,
          "how.html",
          '<main id="main"',
          '<p>5 минут</p>\n<main id="main"',
        ),
      "check-public: how.html: text: ru: list В «минут»",
    ],
    [
      "an en value «100%»",
      (root) => plantKey(root, { en: "Costs 100%" }),
      "check-public: shared/i18n/texts.js: key planted_x: en: list П «100%»",
    ],
    [
      "a kk value «теңге»",
      (root) => plantKey(root, { kk: "Бұл теңге" }),
      "check-public: shared/i18n/texts.js: key planted_x: kk: list Ц «теңге»",
    ],
    [
      "a value with «₸»",
      (root) => plantKey(root, { ru: "Итого 5 ₸" }),
      "check-public: shared/i18n/texts.js: key planted_x: ru: list Ц «₸»",
    ],
    [
      "an intake string «REQ-1»",
      (root) =>
        editIntake(
          root,
          (i) => (i.questions[1].options[0].label.en = `${req}-1 text`),
        ),
      `check-public: ../content/sai-intake.json: questions[1].options[0].label: en: ${req}- before a digit`,
    ],
    [
      "an intake string «handoff»",
      (root) =>
        editIntake(
          root,
          (i) => (i.questions[2].title.ru = `Это ${handoff} вопрос`),
        ),
      `check-public: ../content/sai-intake.json: questions[2].title: ru: word «${handoff}»`,
    ],
    // More planted values of the same rules.
    [
      "a kk intake value «кепілдейді»",
      (root) =>
        editIntake(root, (i) => (i.solutions[0].summary.kk = "Біз кепілдейді")),
      "check-public: ../content/sai-intake.json: solutions[0].summary: kk: list Г «кепілдейді»",
    ],
    [
      "an en intake value «free»",
      (root) => editIntake(root, (i) => (i.intro.en = "It is free")),
      "check-public: ../content/sai-intake.json: intro: en: list Б «free»",
    ],
    [
      "an intake string with no language key, linted with the ru lists",
      (root) =>
        editIntake(
          root,
          (i) => (i.solutions[1].not_suitable_when[0] = { ru: "Цена сайта" }),
        ),
      "check-public: ../content/sai-intake.json: solutions[1].not_suitable_when[0]: ru: list Ц «цена»",
    ],
    [
      "a page attribute aria-label «срок»",
      (root) =>
        editPage(
          root,
          "demo.html",
          'id="theme" aria-label="',
          'id="theme" aria-label="Срок ',
        ),
      "check-public: demo.html: attribute aria-label: ru: list С «срок»",
    ],
    [
      "a page text in a noscript element",
      (root) =>
        editPage(
          root,
          "404.html",
          '<main id="main"',
          '<noscript>Минута</noscript>\n<main id="main"',
        ),
      "check-public: 404.html: text: ru: list В «минута»",
    ],
    [
      "a page attribute title «цена»",
      (root) =>
        editPage(
          root,
          "how.html",
          '<main id="main"',
          '<p title="Цена">x</p>\n<main id="main"',
        ),
      "check-public: how.html: attribute title: ru: list Ц «цена»",
    ],
    [
      "a page attribute alt «бесплатно»",
      (root) =>
        editPage(
          root,
          "how.html",
          '<main id="main"',
          '<img alt="Это ' + W + '" src="/x.png" />\n<main id="main"',
        ),
      `check-public: how.html: attribute alt: ru: list Б «${W}»`,
    ],
    [
      "a page meta content «гарантия»",
      (root) =>
        editPage(
          root,
          "index.html",
          '<meta name="robots" content="noindex" />',
          `<meta name="description" content="${G}" />`,
        ),
      `check-public: index.html: attribute content: ru: list Г «${G}»`,
    ],
  ];
  for (const [name, plant, line] of planted) {
    const root = copies(t, plant);
    const r = run(root);
    assert.equal(r.status, 1, `${name}: ${r.stdout}`);
    assert.ok(r.stdout.split("\n").includes(line), `${name}: ${r.stdout}`);
    assert.equal(r.stderr, "", name);
  }
  // Twins that stay clean: a form in a comment of a page is no visible text; a word that only another
  // language's list has stands in a text of the language where it is no form («минут» is of ru and kk, so it
  // is a twin in en).
  const comment = run(
    copies(t, (root) =>
      editPage(
        root,
        "how.html",
        '<main id="main"',
        "<!-- " + W + ' -->\n<main id="main"',
      ),
    ),
  );
  assert.equal(comment.status, 0, comment.stdout);
  const crossed = run(
    copies(t, (root) => plantKey(root, { kk: W, en: "5 минут" })),
  );
  assert.equal(crossed.status, 0, crossed.stdout);
  // The copies are the test's own: the real folders were not touched.
  assert.equal(run(copies(t)).status, 0);
});

test("FW-8 the module of the lists is the one file of app/ outside app/test that holds a Kazakh form", () => {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || (dir === APP && e.name === "test"))
        continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (
        e.isFile() &&
        fs.readFileSync(abs).toString("utf8").includes("кепілдейді")
      )
        found.push(path.relative(APP, abs).split(path.sep).join("/"));
    }
  };
  walk(APP);
  assert.deepEqual(found, ["scripts/word-lists.js"]);
});
