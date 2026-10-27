// DT-1a ... DT-7b: the two made-up tenants of the form /3 for the stand of the new office
// ("stock" and "agency") and their sets of answers (design docs/design/
// REQ-070-demo-tenants-v3.md, sections 8 and 12). Every test reads the data files itself.
//
// The oracles share nothing with src/picker/: the contrast and the HSL are written here
// with the literal sheets of the themes, the expected compositions, rules, points and
// outcomes are literal tables of the design, the approved sample is loaded as a module with
// a substituted `window` and compared with the files by a path map, the scoring is done a
// second time by a small function over the literal rule table. The code of src/picker/ is
// imported only to be called (the real check, the real engine, the real view of a file).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { checkFile } from "../src/picker/check.js";
import { computeResult } from "../src/picker/engine.js";
import { tenantInLanguage } from "../src/picker/view.js";
import {
  PICKER,
  TOOLS,
  fileDigest,
  makeTmp,
  runPicker,
} from "./picker-helpers.js";
import { numbersOf } from "./picker-lang-helpers.js";
import { request, spawnCli } from "./picker-server-helpers.js";

const IDS = ["stock", "agency"];
const LANGS = ["ru", "kk", "en"];
const NEW_TENANTS = path.join(PICKER, "demo-tenants-v3");
const NEW_ANSWERS = path.join(PICKER, "demo-answers-v3");
const OLD_TENANTS = path.join(PICKER, "demo-tenants");
const OLD_ANSWERS = path.join(PICKER, "demo-answers");
const SAMPLE_FILE = path.resolve(
  TOOLS,
  "..",
  "docs",
  "design",
  "samples",
  "picker-v3-approved-2026-10-26",
  "data.js",
);
const README_FILE = path.join(TOOLS, "README.md");
const REL = (id) => `src/picker/demo-tenants-v3/${id}.json`;

const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const readText = (file) => fs.readFileSync(file, "utf8");
const tenantPlain = (id) =>
  JSON.parse(readText(path.join(NEW_TENANTS, `${id}.json`)));
const answersPlain = (id) =>
  JSON.parse(readText(path.join(NEW_ANSWERS, `${id}.json`)));
const okLine = (id, m, k) =>
  `Файл арендатора ${id} в порядке: вопросов 5, решений ${m}, правил ${k}.`;

// A folder as a list of [name, digest]: what must not change when files are only read.
function folderDigest(dir) {
  return fs
    .readdirSync(dir)
    .sort()
    .map((name) => [name, sha256(fs.readFileSync(path.join(dir, name)))]);
}

// The tokens of a path like "look.team[0].role" and the value at it.
const tokens = (p) =>
  [...p.matchAll(/[^.[\]]+/gu)].map((m) =>
    /^\d+$/u.test(m[0]) ? Number(m[0]) : m[0],
  );
const at = (root, p) =>
  tokens(p).reduce(
    (value, key) =>
      value === undefined || value === null ? undefined : value[key],
    root,
  );

// Every value of a tree, with its path.
function walk(value, here, visit) {
  visit(value, here);
  if (Array.isArray(value))
    value.forEach((item, i) => walk(item, `${here}[${i}]`, visit));
  else if (value !== null && typeof value === "object")
    for (const key of Object.keys(value))
      walk(value[key], here === "" ? key : `${here}.${key}`, visit);
}

// A text in three languages: an object that has any of the keys ru, kk, en.
const isTriple = (v) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  LANGS.some((k) => Object.hasOwn(v, k));
function triplesOf(root) {
  const out = [];
  walk(root, "", (value, here) => {
    if (isTriple(value)) out.push({ path: here, value });
  });
  return out;
}

// The approved sample as a module with a substituted window. The values are copied
// through JSON, so that they are plain objects of this realm.
function loadSample() {
  const window = {};
  vm.runInNewContext(readText(SAMPLE_FILE), { window });
  const { stock, agency } = window.SAI.TENANTS;
  return JSON.parse(JSON.stringify({ stock, agency }));
}

// ----------------------------------------------------------------- colours (own oracle)

const SHEETS = { light: "#f3f5f9", dark: "#161f2e" };
function channel(hex) {
  const s = parseInt(hex, 16) / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(color) {
  return (
    0.2126 * channel(color.slice(1, 3)) +
    0.7152 * channel(color.slice(3, 5)) +
    0.0722 * channel(color.slice(5, 7))
  );
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// HSL of "#rrggbb": hue in degrees, saturation and lightness from 0 to 1.
function hsl(color) {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(color.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}
const hueGap = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

// The table of colours (design 6.3): the two replacements, their contrast before and
// after to two decimals, and the direction of the change. Not counted in the table of edits.
const COLOUR_ROWS = [
  {
    id: "stock",
    theme: "light",
    key: "accent",
    was: "#e0731f",
    wasContrast: "2.90",
    became: "#d76e1e",
    becameContrast: "3.13",
    darker: true,
  },
  {
    id: "agency",
    theme: "dark",
    key: "accent2",
    was: "#5b3fd6",
    wasContrast: "2.46",
    became: "#6d54da",
    becameContrast: "3.10",
    darker: false,
  },
];
// The six colours that stay as the sample has them.
const KEPT_COLOURS = {
  stock: {
    "light.accent2": "#1f7a8c",
    "dark.accent": "#e0731f",
    "dark.accent2": "#1f7a8c",
  },
  agency: {
    "light.accent": "#e0356f",
    "light.accent2": "#5b3fd6",
    "dark.accent": "#e0356f",
  },
};
const COLOUR_PLACES = [
  ["light", "accent"],
  ["light", "accent2"],
  ["dark", "accent"],
  ["dark", "accent2"],
];

// ----------------------------------------------------------------- the composition (5.x)

// Conditions are written as [question, spec]: a list is "any_of", an object is min/max.
const cond = ([question, spec]) =>
  Array.isArray(spec) ? { question, any_of: spec } : { question, ...spec };
const normalCond = (c) =>
  Array.isArray(c.any_of) ? { ...c, any_of: [...c.any_of].sort() } : c;

const EXPECTED = {
  stock: {
    mark: "С",
    team: [
      ["f01", "accent"],
      ["f02", "accent2"],
      ["f03", "ink"],
      ["f04", "ink"],
    ],
    questions: [
      {
        id: "sites",
        type: "single",
        desk: 1,
        options: [
          ["one", { id: "shelf", level: 1 }],
          ["few", { id: "shelf", level: 2 }],
          ["many", { id: "shelf", level: 3 }],
          ["shop", { id: "shop" }],
        ],
      },
      {
        id: "sys",
        type: "single",
        desk: 2,
        options: [
          ["s1c", { id: "monitor", tag: "1С" }],
          ["sap", { id: "monitor", tag: "SAP" }],
          ["xls", { id: "monitor", tag: "XLS" }],
          ["nowhere", { id: "monitor" }],
        ],
      },
      {
        id: "sku",
        type: "number",
        desk: 3,
        min: 1,
        max: 1000000,
        chips: [500, 3000, 10000, 50000],
      },
      {
        id: "count",
        type: "single",
        desk: 3,
        options: [
          ["scan", { id: "scanner" }],
          ["tsd", { id: "tsd" }],
          ["paper", { id: "clip" }],
        ],
      },
      {
        id: "support",
        type: "single",
        desk: 4,
        options: [
          ["self", { id: "bell" }],
          ["phone", { id: "phone" }],
          ["dedic", { id: "headset" }],
        ],
      },
    ],
    solutions: ["sk-base", "sk-exchange", "sk-terminal", "sk-network"],
    firstName: "Склад-Контроль",
    rules: [
      ["sk-r01", "sk-base", 4, [["sites", ["one"]]]],
      ["sk-r02", "sk-base", 3, [["sku", { max: 5000 }]]],
      ["sk-r03", "sk-base", 2, [["count", ["scan", "paper"]]]],
      ["sk-r04", "sk-base", 2, [["support", ["self"]]]],
      ["sk-r05", "sk-base", 2, [["sys", ["xls", "nowhere"]]]],
      ["sk-r06", "sk-base", -4, [["sites", ["many", "shop"]]]],
      ["sk-r07", "sk-exchange", 5, [["sys", ["s1c", "sap"]]]],
      ["sk-r08", "sk-exchange", 2, [["sku", { min: 5001 }]]],
      ["sk-r09", "sk-exchange", 1, [["support", ["dedic"]]]],
      ["sk-r10", "sk-terminal", 5, [["count", ["tsd"]]]],
      ["sk-r11", "sk-terminal", 3, [["count", ["scan"]]]],
      ["sk-r12", "sk-terminal", 3, [["sku", { min: 10001 }]]],
      ["sk-r13", "sk-network", 5, [["sites", ["many", "shop"]]]],
      ["sk-r14", "sk-network", 2, [["sites", ["few"]]]],
      ["sk-r15", "sk-network", 2, [["support", ["dedic"]]]],
    ],
    hypotheses: [
      ["sk-h1", [["sys", ["xls", "nowhere"]]]],
      [
        "sk-h2",
        [
          ["count", ["paper"]],
          ["sku", { min: 3000 }],
        ],
      ],
    ],
    leads: {
      contact_fields: ["phone", "telegram"],
      whatsapp: "77010000000",
      retention_days: 90,
    },
    boundaries: {
      sku: [1, 500, 2999, 3000, 5000, 5001, 10000, 10001, 1000000],
    },
  },
  agency: {
    mark: "Л",
    team: [
      ["f05", "accent"],
      ["f06", "accent2"],
      ["f07", "ink"],
      ["f08", "ink"],
    ],
    questions: [
      {
        id: "offer",
        type: "single",
        desk: 1,
        options: [
          ["srv", { id: "poster", glyph: "tool" }],
          ["goods", { id: "poster", glyph: "box" }],
          ["real", { id: "poster", glyph: "house" }],
          ["edu", { id: "poster", glyph: "cap" }],
        ],
      },
      {
        id: "chan",
        type: "single",
        desk: 2,
        options: [
          ["ig", { id: "monitor", tag: "IG" }],
          ["g", { id: "monitor", tag: "GIS" }],
          ["tt", { id: "monitor", tag: "TT" }],
          ["all", { id: "monitor", tag: "ALL" }],
        ],
      },
      {
        id: "budget",
        type: "number",
        desk: 3,
        min: 1,
        max: 100000000,
        chips: [200000, 500000, 1000000, 3000000],
      },
      {
        id: "intake",
        type: "single",
        desk: 3,
        options: [
          ["wa", { id: "cell", tag: "WA" }],
          ["call", { id: "phone" }],
          ["form", { id: "laptop", tag: "CRM" }],
          ["nothing", { id: "clip" }],
        ],
      },
      {
        id: "report",
        type: "single",
        desk: 4,
        options: [
          ["m", { id: "chart", level: 2 }],
          ["w", { id: "chart", level: 4 }],
          ["pm", { id: "headset" }],
        ],
      },
    ],
    solutions: ["lw-start", "lw-channels", "lw-intake", "lw-report"],
    firstName: "Лид-Поток",
    rules: [
      ["lw-r01", "lw-start", 4, [["budget", { max: 700000 }]]],
      ["lw-r02", "lw-start", 3, [["chan", ["ig", "g"]]]],
      ["lw-r03", "lw-start", 2, [["offer", ["srv"]]]],
      ["lw-r04", "lw-start", 2, [["report", ["m"]]]],
      ["lw-r05", "lw-start", -4, [["budget", { min: 2000001 }]]],
      ["lw-r06", "lw-channels", 5, [["chan", ["all"]]]],
      ["lw-r07", "lw-channels", 3, [["budget", { min: 700001 }]]],
      ["lw-r08", "lw-channels", 2, [["chan", ["tt"]]]],
      ["lw-r09", "lw-channels", 2, [["offer", ["goods", "real"]]]],
      ["lw-r10", "lw-intake", 4, [["intake", ["nothing"]]]],
      ["lw-r11", "lw-intake", 3, [["intake", ["form"]]]],
      ["lw-r12", "lw-intake", 2, [["intake", ["wa", "call"]]]],
      ["lw-r13", "lw-report", 5, [["report", ["pm"]]]],
      ["lw-r14", "lw-report", 3, [["report", ["w"]]]],
      ["lw-r15", "lw-report", 2, [["budget", { min: 2000001 }]]],
    ],
    hypotheses: [
      ["lw-h1", [["intake", ["nothing"]]]],
      [
        "lw-h2",
        [
          ["chan", ["all"]],
          ["budget", { max: 700000 }],
        ],
      ],
    ],
    leads: {
      contact_fields: ["phone"],
      whatsapp: "77020000000",
      retention_days: 60,
    },
    boundaries: {
      budget: [1, 200000, 699999, 700000, 700001, 2000000, 2000001, 100000000],
    },
  },
};
const RESULT_SETTINGS = { top: 3, min_score: 5, clear_lead_gap: 3 };
const sorted = (list) => [...list].sort();

// ----------------------------------------------------------------- the outcomes (7.1)

// clear: clear_leader; rec: [id, score] of the recommended; ranking: all four, in order.
const OUTCOMES = {
  stock: {
    leader: {
      clear: true,
      rec: [["sk-base", 13]],
      ranking: [
        ["sk-base", 13],
        ["sk-exchange", 0],
        ["sk-terminal", 0],
        ["sk-network", 0],
      ],
      hyp: ["sk-h1"],
    },
    close: {
      clear: false,
      rec: [
        ["sk-exchange", 7],
        ["sk-terminal", 5],
      ],
      ranking: [
        ["sk-exchange", 7],
        ["sk-terminal", 5],
        ["sk-network", 2],
        ["sk-base", 0],
      ],
      hyp: [],
    },
    none: {
      clear: null,
      rec: [],
      ranking: [
        ["sk-base", 4],
        ["sk-exchange", 2],
        ["sk-network", 2],
        ["sk-terminal", 0],
      ],
      hyp: ["sk-h1", "sk-h2"],
    },
  },
  agency: {
    leader: {
      clear: true,
      rec: [["lw-start", 11]],
      ranking: [
        ["lw-start", 11],
        ["lw-intake", 2],
        ["lw-channels", 0],
        ["lw-report", 0],
      ],
      hyp: [],
    },
    close: {
      clear: false,
      rec: [
        ["lw-channels", 7],
        ["lw-report", 5],
      ],
      ranking: [
        ["lw-channels", 7],
        ["lw-report", 5],
        ["lw-intake", 2],
        ["lw-start", 0],
      ],
      hyp: [],
    },
    none: {
      clear: null,
      rec: [],
      ranking: [
        ["lw-start", 4],
        ["lw-intake", 4],
        ["lw-report", 3],
        ["lw-channels", 2],
      ],
      hyp: ["lw-h1"],
    },
  },
};
const SETS = ["leader", "close", "none"];

// The label of an outcome by its words: a leader, close variants, nothing fits.
function labelOf(result) {
  if (result.recommended.length === 0) return "none";
  return result.clear_leader === true ? "leader" : "close";
}

// The tenant as the real check gives it, in one language, and the real engine on a set.
function engineOn(
  id,
  lang,
  answers,
  file = path.join(NEW_TENANTS, `${id}.json`),
) {
  const checked = checkFile(file);
  assert.equal(checked.exitCode, 0, file);
  return computeResult(tenantInLanguage(checked.tenant, lang), answers);
}

// ----------------------------------------------------------------- the edits (6.1)

// The table of edits "was -> became -> reason". `became: null` means: the field is absent
// (no own key). A reason is a code of the check, or SEP when criterion 4 forces the edit.
const CHECK_CODES = [
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
];
const EDITS = [
  {
    row: "E1",
    id: "stock",
    path: "questions[1].options[3].object.tag",
    samplePath: "questions[1].opts[3].prop.x",
    was: "?",
    became: null,
    reason: "E_FIELD",
  },
  {
    row: "E2",
    id: "agency",
    path: "look.team[0].role",
    samplePath: "team[0].role",
    was: {
      ru: "приём заявок",
      kk: "өтінімдерді қабылдау",
      en: "reception",
    },
    became: {
      ru: "приём клиентов",
      kk: "клиенттерді қабылдау",
      en: "client reception",
    },
    reason: "SEP",
  },
  {
    row: "E3",
    id: "agency",
    path: "look.team[3].role",
    samplePath: "team[3].role",
    was: {
      ru: "выдача результата",
      kk: "нәтижені беру",
      en: "handover",
    },
    became: {
      ru: "выдача плана",
      kk: "жоспарды беру",
      en: "plan handover",
    },
    reason: "SEP",
  },
];
// The ids of the sample that are renamed because both tenants use them (6.2).
const RENAMES = {
  stock: { sys: { none: "nowhere" } },
  agency: { intake: { none: "nothing" } },
};
const EN_NAMES = { stock: "Skladeon", agency: "Leadway" };

// The table of the corrections of the independent readers (decisions/0087, item 2). One row
// for every kk or en text of a mapped path (the texts that come from the sample) that the
// readers made differ from the sample; the file must equal `corrected` word for word.
// `pair` is the number of the pair in the reader's table (the same number for a text in kk
// and in en); `sample` is the text before the correction. The texts that the executor wrote
// (solutions, rules, hypotheses, the no-match text) are not in the sample and are not rows.
// ru texts are never corrected by the readers: there is no row for them. One row (pair 99)
// corrects a text that the table of edits had already changed (E2): `after` names that row,
// and `sample` is then the `became` text of that row.
const READER_ROWS = [
  {
    pair: 2,
    id: "stock",
    path: "look.tagline",
    lang: "en",
    sample: "stock control, turnkey",
    corrected: "Turnkey stock control",
  },
  {
    pair: 2,
    id: "stock",
    path: "look.tagline",
    lang: "kk",
    sample: "тауар есебі кілтімен",
    corrected: "Тауар есебі — дайын шешім",
  },
  {
    pair: 4,
    id: "stock",
    path: "look.headline",
    lang: "kk",
    sample: "Қоймаңызға шешімді жауап беріп жатқанда құрастырамыз",
    corrected:
      "Сіз жауап беріп жатқанда қоймаңызға арналған шешімді құрастырамыз",
  },
  {
    pair: 5,
    id: "stock",
    path: "look.team[0].role",
    lang: "en",
    sample: "reception",
    corrected: "request intake",
  },
  {
    pair: 12,
    id: "stock",
    path: "look.team[3].says",
    lang: "kk",
    sample: "Баспа дайын.",
    corrected: "Басып шығару дайын.",
  },
  {
    pair: 28,
    id: "stock",
    path: "questions[3].options[1].label",
    lang: "en",
    sample: "Handheld terminal",
    corrected: "Data-collection terminal",
  },
  {
    pair: 31,
    id: "stock",
    path: "questions[4].options[0].label",
    lang: "en",
    sample: "We will manage",
    corrected: "We will manage on our own",
  },
  {
    pair: 33,
    id: "stock",
    path: "questions[4].options[2].label",
    lang: "en",
    sample: "Our own specialist",
    corrected: "A dedicated specialist",
  },
  {
    pair: 98,
    id: "agency",
    path: "look.headline",
    lang: "en",
    sample: "We assemble your customer plan while you answer",
    corrected:
      "We'll put together a customer acquisition plan while you answer",
  },
  {
    pair: 98,
    id: "agency",
    path: "look.headline",
    lang: "kk",
    sample: "Клиент тарту жоспарын жауап беріп жатқанда құрастырамыз",
    corrected: "Сіз жауап беріп жатқанда клиент тарту жоспарын құрастырамыз",
  },
  {
    pair: 99,
    id: "agency",
    path: "look.team[0].role",
    lang: "en",
    after: "E2",
    sample: "client reception",
    corrected: "customer intake",
  },
  {
    pair: 104,
    id: "agency",
    path: "look.team[2].says",
    lang: "en",
    sample: "Counting budget…",
    corrected: "Calculating the budget…",
  },
  {
    pair: 107,
    id: "agency",
    path: "intro",
    lang: "kk",
    sample:
      "Лидвейв клиенттерді Instagram, Google және 2ГИС арқылы әкеледі. 5 сұраққа жауап беріңіз: команда жоспар мен баға жинайды.",
    corrected:
      "Лидвейв клиенттерді Instagram, Google және 2ГИС арқылы әкеледі. 5 сұраққа жауап беріңіз: команда сіздің көз алдыңызда жоспар мен іске қосу бағасын құрастырады.",
  },
  {
    pair: 108,
    id: "agency",
    path: "questions[0].title",
    lang: "kk",
    sample: "Нені жылжытасыз?",
    corrected: "Нені жарнамалайсыз?",
  },
  {
    pair: 118,
    id: "agency",
    path: "questions[2].title",
    lang: "en",
    sample: "Monthly ad budget, KZT?",
    corrected: "Monthly ad budget, ₸?",
  },
  {
    pair: 119,
    id: "agency",
    path: "questions[2].unit",
    lang: "en",
    sample: "KZT a month",
    corrected: "₸ a month",
  },
];
// The number of the rows (the kk and en texts of mapped paths that differ from the sample
// because of the readers) and the number of all texts changed by the readers in steps 11-13
// (the other 26 were written by the executor and are not compared with the sample).
const READER_ROW_COUNT = 16;
const READER_CHANGED_PAIRS = 42;

// ----------------------------------------------------------------- DT-1

test("DT-1a: both files pass `npm run picker -- check` - code 0, stderr empty, stdout exactly the one line with 5 questions, 4 solutions, 15 rules (the counts equal the parsed file, at least 3 and 12); the files are not changed by the run", () => {
  for (const id of IDS) {
    const file = path.join(NEW_TENANTS, `${id}.json`);
    const folder = folderDigest(NEW_TENANTS);
    const before = fileDigest(file);
    const plain = tenantPlain(id);
    const run = runPicker(["check", REL(id)], { cwd: TOOLS, viaNpm: true });
    assert.equal(run.code, 0, id);
    assert.deepEqual(run.err, [], id);
    assert.deepEqual(run.out, [okLine(id, 4, 15)], id);
    assert.equal(plain.questions.length, 5, id);
    assert.equal(plain.solutions.length, 4, id);
    assert.equal(plain.rules.length, 15, id);
    assert.ok(plain.solutions.length >= 3 && plain.rules.length >= 12, id);
    assert.deepEqual(fileDigest(file), before, id);
    assert.deepEqual(folderDigest(NEW_TENANTS), folder, id);
  }
});

test("DT-1b: the composition equals the literals of the design - schema, five questions (ids, order, types, required, no show_if, desks 1 2 3 3 4), every option with its object, the number questions with min, max, unit and the four quick numbers, four solutions (only the first has price and duration), the 15 rules with solution, points and conditions, the hypotheses with their conditions, the result settings, the leads, the look", () => {
  for (const id of IDS) {
    const want = EXPECTED[id];
    const t = tenantPlain(id);
    assert.deepEqual(
      sorted(Object.keys(t)),
      sorted([
        "schema",
        "id",
        "name",
        "look",
        "intro",
        "questions",
        "solutions",
        "rules",
        "hypotheses",
        "result",
        "leads",
      ]),
      `${id}: top keys`,
    );
    assert.equal(t.schema, "sai-picker-tenant/3", id);
    assert.equal(t.id, id);
    // questions
    assert.deepEqual(
      t.questions.map((q) => q.id),
      want.questions.map((q) => q.id),
      `${id}: question ids and order`,
    );
    assert.deepEqual(
      t.questions.map((q) => q.desk),
      [1, 2, 3, 3, 4],
      `${id}: desks`,
    );
    assert.equal(t.questions.filter((q) => q.type === "single").length, 4, id);
    assert.equal(t.questions.filter((q) => q.type === "number").length, 1, id);
    want.questions.forEach((wq, j) => {
      const q = t.questions[j];
      const label = `${id}.${wq.id}`;
      assert.equal(q.type, wq.type, label);
      assert.equal(q.required, true, label);
      assert.equal(Object.hasOwn(q, "show_if"), false, label);
      assert.equal(q.desk, wq.desk, label);
      if (wq.type === "number") {
        assert.deepEqual(
          sorted(Object.keys(q)),
          sorted([
            "id",
            "title",
            "type",
            "required",
            "desk",
            "min",
            "max",
            "unit",
            "chips",
          ]),
          label,
        );
        assert.equal(q.min, wq.min, label);
        assert.equal(q.max, wq.max, label);
        assert.deepEqual(q.chips, wq.chips, label);
        assert.deepEqual(
          sorted(Object.keys(q.unit)),
          ["en", "kk", "ru"],
          label,
        );
        assert.equal(Object.hasOwn(q, "options"), false, label);
        return;
      }
      assert.deepEqual(
        sorted(Object.keys(q)),
        sorted(["id", "title", "type", "required", "desk", "options"]),
        label,
      );
      assert.deepEqual(
        q.options.map((o) => o.id),
        wq.options.map(([oid]) => oid),
        `${label}: option ids and order`,
      );
      wq.options.forEach(([oid, object], k) => {
        const o = q.options[k];
        assert.deepEqual(
          sorted(Object.keys(o)),
          ["id", "label", "object"],
          `${label}.${oid}`,
        );
        assert.deepEqual(o.object, object, `${label}.${oid}: object`);
      });
    });
    // the option "Nowhere yet" has a monitor without a tag (no own key)
    if (id === "stock") {
      const object = t.questions[1].options[3].object;
      assert.deepEqual(Object.keys(object), ["id"]);
      assert.equal(Object.hasOwn(object, "tag"), false);
    }
    // solutions
    assert.deepEqual(
      t.solutions.map((s) => s.id),
      want.solutions,
      `${id}: solutions`,
    );
    assert.equal(t.solutions[0].name.ru, want.firstName, id);
    t.solutions.forEach((s, i) => {
      const label = `${id}.${s.id}`;
      assert.equal(Object.hasOwn(s, "price_text"), i === 0, label);
      assert.equal(Object.hasOwn(s, "duration_text"), i === 0, label);
      const lists = {
        includes: [2, 4],
        needs_from_you: [1, 3],
        next_steps: [2, 3],
        not_suitable_when: [1, 2],
      };
      for (const [key, [lo, hi]] of Object.entries(lists)) {
        assert.ok(
          s[key].length >= lo && s[key].length <= hi,
          `${label}.${key}: ${s[key].length}`,
        );
      }
    });
    // rules: id, solution, points and the conditions themselves
    assert.deepEqual(
      t.rules.map((r) => r.id),
      want.rules.map(([rid]) => rid),
      `${id}: rule ids and order`,
    );
    want.rules.forEach(([rid, solution, points, when], i) => {
      const r = t.rules[i];
      assert.deepEqual(
        sorted(Object.keys(r)),
        sorted(["id", "when", "solution", "points", "text"]),
        rid,
      );
      assert.equal(r.solution, solution, rid);
      assert.equal(r.points, points, rid);
      assert.deepEqual(
        r.when.map(normalCond),
        when.map(cond).map(normalCond),
        `${rid}: when`,
      );
    });
    // hypotheses: ids and conditions
    assert.deepEqual(
      t.hypotheses.map((h) => h.id),
      want.hypotheses.map(([hid]) => hid),
      `${id}: hypotheses`,
    );
    want.hypotheses.forEach(([hid, when], i) => {
      const h = t.hypotheses[i];
      assert.deepEqual(
        sorted(Object.keys(h)),
        sorted(["id", "title", "explanation", "when"]),
        hid,
      );
      assert.deepEqual(
        h.when.map(normalCond),
        when.map(cond).map(normalCond),
        `${hid}: when`,
      );
    });
    assert.ok(t.hypotheses.length >= 2, id);
    // result
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(t.result).filter(([k]) => k !== "no_match_text"),
      ),
      RESULT_SETTINGS,
      `${id}: result`,
    );
    assert.deepEqual(
      sorted(Object.keys(t.result)),
      sorted([...Object.keys(RESULT_SETTINGS), "no_match_text"]),
      id,
    );
    // leads
    assert.deepEqual(
      sorted(Object.keys(t.leads)),
      sorted([
        "enabled",
        "contact_fields",
        "whatsapp",
        "operator_name",
        "consent_text",
        "privacy_contact",
        "retention_days",
      ]),
      `${id}: leads keys`,
    );
    assert.equal(t.leads.enabled, true, id);
    assert.deepEqual(t.leads.contact_fields, want.leads.contact_fields, id);
    assert.equal(t.leads.whatsapp, want.leads.whatsapp, id);
    assert.match(t.leads.whatsapp, /^\d{11}$/u, id);
    assert.equal(t.leads.retention_days, want.leads.retention_days, id);
    // look
    assert.deepEqual(
      Object.keys(t.look),
      ["mark", "tagline", "industry", "headline", "colors", "team"],
      `${id}: look keys`,
    );
    assert.equal(t.look.mark, want.mark, id);
    for (const key of ["tagline", "industry", "headline"])
      assert.deepEqual(
        sorted(Object.keys(t.look[key])),
        ["en", "kk", "ru"],
        `${id}.${key}`,
      );
    assert.equal(t.look.team.length, 4, id);
    t.look.team.forEach((member, i) => {
      assert.deepEqual(
        sorted(Object.keys(member)),
        sorted(["name", "role", "says", "figure", "shirt"]),
        `${id}.team[${i}]`,
      );
      assert.equal(member.figure, want.team[i][0], `${id}.team[${i}].figure`);
      assert.equal(member.shirt, want.team[i][1], `${id}.team[${i}].shirt`);
    });
  }
});

test("DT-1c: the eight colours - the form #rrggbb, the contrast with the literal sheet of the theme (#f3f5f9 light, #161f2e dark) is at least 3.0 without rounding, the six unchanged colours equal the sample, the two replacements keep the hue (2 degrees) and the saturation (0.02), change only the lightness in the right direction, stay under 3.4 : 1, differ from the sample colour and have a row of the colour table with the contrast before and after to two decimals", () => {
  for (const id of IDS) {
    const colors = tenantPlain(id).look.colors;
    assert.deepEqual(sorted(Object.keys(colors)), ["dark", "light"], id);
    for (const [theme, key] of COLOUR_PLACES) {
      const value = colors[theme][key];
      const label = `${id} ${theme}.${key} ${value}`;
      assert.match(value, /^#[0-9a-f]{6}$/u, label);
      assert.ok(
        contrast(value, SHEETS[theme]) >= 3.0,
        `${label}: ${contrast(value, SHEETS[theme])}`,
      );
      const kept = KEPT_COLOURS[id][`${theme}.${key}`];
      const row = COLOUR_ROWS.find(
        (r) => r.id === id && r.theme === theme && r.key === key,
      );
      assert.equal(
        kept === undefined,
        row !== undefined,
        `${label}: kept or replaced`,
      );
      if (kept !== undefined) assert.equal(value, kept, label);
    }
    assert.deepEqual(
      sorted(Object.keys(colors.light)),
      ["accent", "accent2"],
      id,
    );
    assert.deepEqual(
      sorted(Object.keys(colors.dark)),
      ["accent", "accent2"],
      id,
    );
  }
  assert.equal(COLOUR_ROWS.length, 2);
  for (const row of COLOUR_ROWS) {
    const value = tenantPlain(row.id).look.colors[row.theme][row.key];
    const sheet = SHEETS[row.theme];
    const label = `${row.id} ${row.theme}.${row.key}`;
    // the row of the colour table
    assert.equal(value, row.became, `${label}: the value of the row`);
    assert.equal(contrast(row.was, sheet).toFixed(2), row.wasContrast, label);
    assert.equal(contrast(value, sheet).toFixed(2), row.becameContrast, label);
    // the rule
    assert.notEqual(value, row.was, label);
    assert.ok(
      contrast(row.was, sheet) < 3.0,
      `${label}: the sample colour fails`,
    );
    assert.ok(contrast(value, sheet) >= 3.0, label);
    assert.ok(contrast(value, sheet) < 3.4, `${label}: not over-corrected`);
    if (row.darker) assert.ok(luminance(value) < luminance(row.was), label);
    else assert.ok(luminance(value) > luminance(row.was), label);
    const a = hsl(row.was);
    const b = hsl(value);
    assert.ok(hueGap(a.h, b.h) <= 2, `${label}: hue ${a.h} -> ${b.h}`);
    assert.ok(
      Math.abs(a.s - b.s) <= 0.02,
      `${label}: saturation ${a.s} -> ${b.s}`,
    );
    if (row.darker) assert.ok(b.l < a.l, `${label}: lightness`);
    else assert.ok(b.l > a.l, `${label}: lightness`);
  }
});

test("DT-1d: a copy of each file with the sample colour put back fails the real check - code 1, exactly one line, at the place of the colour, with the code E_LIMIT; the copy and the project files are unchanged", (t) => {
  const places = {
    stock: "look.colors.light.accent",
    agency: "look.colors.dark.accent2",
  };
  for (const row of COLOUR_ROWS) {
    const dir = makeTmp(t);
    const projectFile = path.join(NEW_TENANTS, `${row.id}.json`);
    const projectDigest = fileDigest(projectFile);
    const plain = tenantPlain(row.id);
    plain.look.colors[row.theme][row.key] = row.was;
    const copy = path.join(dir, `${row.id}.json`);
    fs.writeFileSync(copy, `${JSON.stringify(plain, null, 2)}\n`);
    const copyDigest = fileDigest(copy);
    const run = runPicker(["check", copy]);
    assert.equal(run.code, 1, row.id);
    assert.deepEqual(run.err, [], row.id);
    assert.equal(run.out.length, 1, `${row.id}: ${run.out.join("|")}`);
    assert.ok(
      run.out[0].startsWith(`${row.id}.json: ${places[row.id]}: E_LIMIT: `),
      run.out[0],
    );
    assert.deepEqual(fileDigest(copy), copyDigest, row.id);
    assert.deepEqual(fileDigest(projectFile), projectDigest, row.id);
  }
  // the project files with their own colours pass the same command
  for (const id of IDS) {
    const run = runPicker(["check", REL(id)]);
    assert.equal(run.code, 0, id);
  }
});

// ----------------------------------------------------------------- DT-2

test("DT-2a: every {ru, kk, en} object of both files has exactly the three keys and three non-empty strings; operator_name and privacy_contact are non-empty strings; the numbers of the three languages of a text are the same; there is no Cyrillic letter in an English text", () => {
  for (const id of IDS) {
    const plain = tenantPlain(id);
    const triples = triplesOf(plain);
    assert.ok(triples.length >= 90, `${id}: ${triples.length} texts`);
    for (const { path: p, value } of triples) {
      const label = `${id} ${p}`;
      assert.deepEqual(sorted(Object.keys(value)), ["en", "kk", "ru"], label);
      for (const lang of LANGS) {
        assert.equal(typeof value[lang], "string", `${label} ${lang}`);
        assert.notEqual(value[lang].trim(), "", `${label} ${lang}`);
      }
      assert.deepEqual(
        numbersOf(value.kk),
        numbersOf(value.ru),
        `${label}: kk numbers`,
      );
      assert.deepEqual(
        numbersOf(value.en),
        numbersOf(value.ru),
        `${label}: en numbers`,
      );
      assert.doesNotMatch(value.en, /\p{Script=Cyrillic}/u, `${label}: en`);
    }
    for (const key of ["operator_name", "privacy_contact"]) {
      assert.equal(typeof plain.leads[key], "string", `${id} ${key}`);
      assert.notEqual(plain.leads[key].trim(), "", `${id} ${key}`);
    }
    // no other object holds a language key by itself
    walk(plain, "", (value, here) => {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !isTriple(value)
      )
        for (const lang of LANGS)
          assert.equal(Object.hasOwn(value, lang), false, `${id} ${here}`);
    });
  }
});

test("DT-2b: the number before the word for a question in the intro (вопрос, сұрақ, question) equals the number of the questions of the file, on every language", () => {
  for (const id of IDS) {
    const plain = tenantPlain(id);
    const wordFor = { ru: "вопрос", kk: "сұрақ", en: "question" };
    for (const lang of LANGS) {
      const found = [
        ...plain.intro[lang].matchAll(/(\d+)\s*(вопрос|сұрақ|question)/gu),
      ];
      assert.equal(found.length, 1, `${id} ${lang}: ${plain.intro[lang]}`);
      assert.equal(found[0][2], wordFor[lang], `${id} ${lang}`);
      assert.equal(
        Number(found[0][1]),
        plain.questions.length,
        `${id} ${lang}`,
      );
      assert.equal(Number(found[0][1]), 5, `${id} ${lang}`);
    }
  }
});

// The pairs (file value, sample value) of the path map of design section 4.
function pathMap(id, file, T) {
  const texts = []; // {path, sp, file, sample}: three languages each
  const plains = []; // {path, file, sample}
  const tags = []; // {path, parent, sample}
  const text = (p, sp) =>
    texts.push({ path: p, sp, file: at(file, p), sample: at(T, sp) });
  const plain = (p, sample) =>
    plains.push({ path: p, file: at(file, p), sample });
  plain("id", T.id);
  plain("name.ru", T.name);
  plain("name.kk", T.name);
  plain("look.mark", T.initial);
  text("look.tagline", "tag");
  text("look.industry", "industry");
  text("look.headline", "headline");
  text("intro", "pitch");
  T.team.forEach((member, i) => {
    plain(`look.team[${i}].name`, member.name);
    text(`look.team[${i}].role`, `team[${i}].role`);
    text(`look.team[${i}].says`, `say[${i}]`);
    const shirt =
      member.shirt === T.pal.accent
        ? "accent"
        : member.shirt === T.pal.accent2
          ? "accent2"
          : "ink";
    plain(`look.team[${i}].shirt`, shirt);
  });
  T.questions.forEach((q, j) => {
    plain(`questions[${j}].id`, q.id);
    text(`questions[${j}].title`, `questions[${j}].title`);
    plain(`questions[${j}].desk`, q.st + 1);
    plain(`questions[${j}].type`, q.kind === "choice" ? "single" : "number");
    if (q.kind === "number") {
      text(`questions[${j}].unit`, `questions[${j}].unit`);
      plain(`questions[${j}].chips`, q.chips);
      return;
    }
    q.opts.forEach((o, k) => {
      plain(
        `questions[${j}].options[${k}].id`,
        RENAMES[id]?.[q.id]?.[o.id] ?? o.id,
      );
      text(
        `questions[${j}].options[${k}].label`,
        `questions[${j}].opts[${k}].label`,
      );
      if (typeof o.prop.x === "string")
        tags.push({
          path: `questions[${j}].options[${k}].object.tag`,
          parent: `questions[${j}].options[${k}].object`,
          sp: `questions[${j}].opts[${k}].prop.x`,
          sample: o.prop.x,
        });
    });
  });
  plain("leads.whatsapp", T.wa);
  plain("solutions[0].name.ru", T.pkg);
  return { texts, plains, tags };
}

test("DT-2c: against the approved sample (loaded as a module with a substituted window) every mapped text of ru, kk and en, every id, desk, type and quick number equals the sample, except the rows of the table of edits (at most 6 rows, each with a code of the check or SEP): there the sample equals `was` and the file equals `became`, and except the rows of the table of reader corrections (decisions/0087; kk and en only): there the sample equals the row's sample text and the file equals the corrected text word for word; the absent field of E1 has no own key; the name, the Latin name, the renames and the colours of the sample are as the path map says", () => {
  const sample = loadSample();
  assert.ok(EDITS.length <= 6, "at most six rows");
  // the table of reader corrections: its own rules
  assert.equal(READER_ROWS.length, READER_ROW_COUNT, "the number of the rows");
  assert.ok(
    READER_ROWS.length <= READER_CHANGED_PAIRS,
    "no more rows than changed pairs",
  );
  const readerKeys = READER_ROWS.map((r) => `${r.id}|${r.path}|${r.lang}`);
  assert.equal(
    new Set(readerKeys).size,
    READER_ROWS.length,
    "no path twice in the table of reader corrections",
  );
  assert.equal(
    new Set(READER_ROWS.map((r) => `${r.pair}|${r.lang}`)).size,
    READER_ROWS.length,
    "a pair of the reader's table once per language",
  );
  for (const row of READER_ROWS) {
    const label = `reader row ${row.pair} ${row.id} ${row.path} ${row.lang}`;
    assert.notEqual(row.lang, "ru", `${label}: ru is never corrected`);
    assert.ok(["kk", "en"].includes(row.lang), label);
    assert.ok(IDS.includes(row.id), label);
    assert.equal(typeof row.sample, "string", label);
    assert.equal(typeof row.corrected, "string", label);
    assert.notEqual(row.corrected.trim(), "", label);
    assert.notEqual(row.corrected, row.sample, `${label}: a real correction`);
    // one pair is one text of one tenant, in both languages
    for (const other of READER_ROWS)
      if (other.pair === row.pair) {
        assert.equal(other.id, row.id, `${label}: one pair, one tenant`);
        assert.equal(other.path, row.path, `${label}: one pair, one path`);
      }
    // a row after an edit names a row of the table of edits for the same path
    const edit = EDITS.find((r) => r.id === row.id && r.path === row.path);
    if (edit === undefined) assert.equal(row.after, undefined, label);
    else assert.equal(row.after, edit.row, `${label}: after the edit`);
  }
  const readerUsed = new Map(readerKeys.map((key) => [key, 0]));
  for (const row of EDITS)
    assert.ok(
      [...CHECK_CODES, "SEP"].includes(row.reason),
      `${row.row}: ${row.reason}`,
    );
  assert.equal(new Set(EDITS.map((r) => r.row)).size, EDITS.length);
  const used = new Map(EDITS.map((r) => [r.row, 0]));
  const wantTexts = { stock: 32, agency: 33 };
  for (const id of IDS) {
    const file = tenantPlain(id);
    const T = sample[id];
    const { texts, plains, tags } = pathMap(id, file, T);
    assert.equal(
      texts.length,
      wantTexts[id],
      `${id}: the number of mapped texts`,
    );
    assert.ok(plains.length >= 40, `${id}: ${plains.length} mapped values`);
    for (const pair of texts) {
      const row = EDITS.find((r) => r.id === id && r.path === pair.path);
      for (const lang of LANGS) {
        const label = `${id} ${pair.path} ${lang}`;
        const reader = READER_ROWS.find(
          (r) => r.id === id && r.path === pair.path && r.lang === lang,
        );
        if (reader !== undefined)
          readerUsed.set(`${id}|${pair.path}|${lang}`, 1);
        if (row === undefined) {
          if (reader === undefined) {
            assert.equal(pair.file[lang], pair.sample[lang], label);
          } else {
            assert.equal(
              reader.sample,
              pair.sample[lang],
              `${label}: the sample text of the reader row`,
            );
            assert.equal(
              pair.file[lang],
              reader.corrected,
              `${label}: the corrected text of the reader row`,
            );
          }
        } else {
          assert.equal(row.samplePath, pair.sp, `${row.row}: sample path`);
          assert.equal(pair.sample[lang], row.was[lang], `${label}: was`);
          if (reader === undefined) {
            assert.equal(pair.file[lang], row.became[lang], `${label}: became`);
          } else {
            // the text of the edit, corrected once more by a reader
            assert.equal(
              reader.sample,
              row.became[lang],
              `${label}: the reader row follows the edit`,
            );
            assert.equal(
              pair.file[lang],
              reader.corrected,
              `${label}: the corrected text of the reader row`,
            );
          }
        }
      }
      if (row !== undefined) used.set(row.row, used.get(row.row) + 1);
    }
    for (const pair of plains)
      assert.deepEqual(pair.file, pair.sample, `${id} ${pair.path}`);
    for (const pair of tags) {
      const row = EDITS.find((r) => r.id === id && r.path === pair.path);
      const parent = at(file, pair.parent);
      if (row === undefined) {
        assert.equal(parent.tag, pair.sample, `${id} ${pair.path}`);
      } else {
        assert.equal(row.samplePath, pair.sp, `${row.row}: sample path`);
        assert.equal(pair.sample, row.was, `${row.row}: the sample value`);
        assert.equal(row.became, null);
        assert.equal(
          Object.hasOwn(parent, "tag"),
          false,
          `${row.row}: no own key tag`,
        );
        used.set(row.row, used.get(row.row) + 1);
      }
    }
    // the name: the string of the sample in ru and kk, the Latin spelling in en
    assert.equal(file.name.en, EN_NAMES[id], `${id}: name.en`);
    assert.ok(
      T.pitch.en.startsWith(EN_NAMES[id]),
      `${id}: the sample spells it so`,
    );
    assert.deepEqual(sorted(Object.keys(file.name)), ["en", "kk", "ru"], id);
    // the colours of the sample, except the two replaced
    for (const [theme, key] of COLOUR_PLACES) {
      const row = COLOUR_ROWS.find(
        (r) => r.id === id && r.theme === theme && r.key === key,
      );
      const fromSample = T.pal[key];
      if (row === undefined)
        assert.equal(
          file.look.colors[theme][key],
          fromSample,
          `${id} ${theme}.${key}`,
        );
      else
        assert.equal(
          row.was,
          fromSample,
          `${id} ${theme}.${key}: the colour table's "was"`,
        );
    }
  }
  for (const [row, count] of used)
    assert.equal(count, 1, `${row} is used once`);
  for (const [key, count] of readerUsed)
    assert.equal(count, 1, `reader row ${key} is on a mapped text`);
  // the id renames of the table 6.2 stand in the files and the sample holds the old ids
  assert.equal(sample.stock.questions[1].opts[3].id, "none");
  assert.equal(sample.agency.questions[3].opts[3].id, "none");
  assert.equal(tenantPlain("stock").questions[1].options[3].id, "nowhere");
  assert.equal(tenantPlain("agency").questions[3].options[3].id, "nothing");
});

test("DT-2d: for every row of the table of edits with the reason SEP the `was` text stands, word for word and with no folding, at the same mapped path of both sample tenants in ru, kk and en; the rows with a code of the check are not asked for it", () => {
  const sample = loadSample();
  const seps = EDITS.filter((r) => r.reason === "SEP");
  assert.ok(seps.length >= 1);
  for (const row of seps) {
    for (const who of IDS) {
      const value = at(sample[who], row.samplePath);
      for (const lang of LANGS)
        assert.equal(
          value[lang],
          row.was[lang],
          `${row.row}: sample ${who} ${lang}`,
        );
    }
  }
  // the other reasons are codes of the check, and E1 is one of them: its sample text is
  // held by the first tenant only, as it must be
  const codes = EDITS.filter((r) => r.reason !== "SEP");
  assert.ok(codes.length >= 1);
  assert.equal(at(sample.stock, "questions[1].opts[3].prop.x"), "?");
  assert.equal(at(sample.agency, "questions[3].opts[3].prop.x"), undefined);
});

// ----------------------------------------------------------------- DT-3

test("DT-3a: the answer files - exactly the keys leader, close, none, half; every key is a question of its own tenant; a single answer is an option of that question; a number is a whole number inside min..max; leader, close and none answer all five questions; half answers exactly the first two questions of the file", () => {
  for (const id of IDS) {
    const tenant = tenantPlain(id);
    const answers = answersPlain(id);
    assert.deepEqual(
      Object.keys(answers),
      ["leader", "close", "none", "half"],
      id,
    );
    const ids = tenant.questions.map((q) => q.id);
    for (const [name, set] of Object.entries(answers)) {
      const label = `${id}.${name}`;
      assert.ok(
        set !== null && typeof set === "object" && !Array.isArray(set),
        label,
      );
      for (const [key, value] of Object.entries(set)) {
        const q = tenant.questions.find((x) => x.id === key);
        assert.notEqual(
          q,
          undefined,
          `${label}: ${key} is not a question of ${id}`,
        );
        if (q.type === "single") {
          assert.equal(typeof value, "string", `${label}.${key}`);
          assert.ok(
            q.options.some((o) => o.id === value),
            `${label}.${key}: ${value}`,
          );
        } else {
          assert.ok(Number.isInteger(value), `${label}.${key}`);
          assert.ok(
            value >= q.min && value <= q.max,
            `${label}.${key}: ${value}`,
          );
        }
      }
      if (name === "half")
        assert.deepEqual(Object.keys(set), ids.slice(0, 2), label);
      else assert.deepEqual(sorted(Object.keys(set)), sorted(ids), label);
    }
  }
});

test("DT-3b: the real engine on every set in ru, kk and en - the label (leader, close variants, nothing fits), clear_leader, the ids and scores of the recommended, the ranking of all four, the hypotheses equal the literals of the design; the no-match text is null or the file's text of that language; the three languages give the same ids and scores", () => {
  for (const id of IDS) {
    const answers = answersPlain(id);
    const file = tenantPlain(id);
    for (const name of SETS) {
      const want = OUTCOMES[id][name];
      const seen = [];
      for (const lang of LANGS) {
        const label = `${id}.${name} ${lang}`;
        const out = engineOn(id, lang, answers[name]);
        assert.equal(out.ok, true, label);
        const r = out.result;
        assert.equal(labelOf(r), name, `${label}: label`);
        assert.equal(r.clear_leader, want.clear, `${label}: clear_leader`);
        assert.deepEqual(
          r.recommended.map((x) => [x.id, x.score]),
          want.rec,
          `${label}: recommended`,
        );
        assert.deepEqual(
          r.ranking.map((x) => [x.solution, x.score]),
          want.ranking,
          `${label}: ranking`,
        );
        assert.deepEqual(
          r.hypotheses.map((h) => h.id),
          want.hyp,
          `${label}: hypotheses`,
        );
        if (name === "leader") assert.equal(r.recommended.length, 1, label);
        if (name === "close")
          assert.ok(
            r.recommended.length >= 2 && r.recommended.length <= 3,
            label,
          );
        if (name === "none") {
          assert.equal(r.recommended.length, 0, label);
          assert.equal(r.no_match_text, file.result.no_match_text[lang], label);
          assert.notEqual(r.no_match_text, "", label);
        } else {
          assert.equal(r.no_match_text, null, label);
        }
        seen.push(
          JSON.stringify([
            r.recommended.map((x) => [x.id, x.score]),
            r.ranking,
          ]),
        );
      }
      assert.equal(new Set(seen).size, 1, `${id}.${name}: the languages agree`);
    }
    // the set `half` is not run here: what the engine does with it is REQ-072's to say
  }
});

// Does a condition [question, spec] hold for the answers? (own reading of design 5.2)
function holds([question, spec], answers) {
  const value = answers[question];
  if (Array.isArray(spec)) return spec.includes(value);
  if (typeof value !== "number") return false;
  return (
    (spec.min === undefined || value >= spec.min) &&
    (spec.max === undefined || value <= spec.max)
  );
}
// The second scoring: the totals per solution, the fired rules, the order, the
// recommended and the clear leader, from the literal rule table.
function scoreAgain(id, answers) {
  const want = EXPECTED[id];
  const totals = new Map(want.solutions.map((s) => [s, 0]));
  const fired = new Map(want.solutions.map((s) => [s, []]));
  for (const [rid, solution, points, when] of want.rules) {
    if (!when.every((c) => holds(c, answers))) continue;
    totals.set(solution, totals.get(solution) + points);
    fired.get(solution).push(rid);
  }
  const ranking = want.solutions
    .map((solution, place) => ({
      solution,
      place,
      score: totals.get(solution),
    }))
    .sort((a, b) => b.score - a.score || a.place - b.place);
  const best = ranking
    .filter((x) => x.score >= RESULT_SETTINGS.min_score)
    .slice(0, RESULT_SETTINGS.top);
  let clear = null;
  if (best.length === 1) clear = true;
  else if (best.length > 1)
    clear = best[0].score - best[1].score >= RESULT_SETTINGS.clear_lead_gap;
  const hypotheses = want.hypotheses
    .filter(([, when]) => when.every((c) => holds(c, answers)))
    .map(([hid]) => hid);
  return { ranking, best, clear, fired, hypotheses };
}

test("DT-3c: the scoring is not read from the file - the test scores again with its own function over the literal rule table, for the three sets and then for every combination of the single answers with the numbers at the edges of the rules, and the engine agrees on totals, order, recommended, clear leader, fired rules and hypotheses", () => {
  for (const id of IDS) {
    const answers = answersPlain(id);
    const want = EXPECTED[id];
    const tenant = checkFile(path.join(NEW_TENANTS, `${id}.json`)).tenant;
    const compare = (set, label) => {
      const mine = scoreAgain(id, set);
      const out = computeResult(tenantInLanguage(tenant, "ru"), set);
      assert.equal(out.ok, true, label);
      const r = out.result;
      assert.deepEqual(
        r.ranking.map((x) => [x.solution, x.score]),
        mine.ranking.map((x) => [x.solution, x.score]),
        `${label}: totals and order`,
      );
      assert.deepEqual(
        r.recommended.map((x) => x.id),
        mine.best.map((x) => x.solution),
        `${label}: recommended`,
      );
      assert.equal(r.clear_leader, mine.clear, `${label}: clear leader`);
      assert.deepEqual(
        r.hypotheses.map((h) => h.id),
        mine.hypotheses,
        `${label}: hypotheses`,
      );
      for (const rec of r.recommended)
        assert.deepEqual(
          rec.rules.map((x) => x.id),
          mine.fired.get(rec.id),
          `${label}: fired rules of ${rec.id}`,
        );
    };
    // the three sets: the second computation gives the literals of DT-3b
    for (const name of SETS) {
      const mine = scoreAgain(id, answers[name]);
      assert.deepEqual(
        mine.ranking.map((x) => [x.solution, x.score]),
        OUTCOMES[id][name].ranking,
        `${id}.${name}: the second scoring`,
      );
      compare(answers[name], `${id}.${name}`);
    }
    // every combination of the single answers with the numbers at the edges
    const singles = want.questions.filter((q) => q.type === "single");
    const number = want.questions.find((q) => q.type === "number");
    let combos = [{}];
    for (const q of singles)
      combos = combos.flatMap((c) =>
        q.options.map(([oid]) => ({ ...c, [q.id]: oid })),
      );
    let count = 0;
    for (const base of combos)
      for (const n of want.boundaries[number.id]) {
        compare(
          { ...base, [number.id]: n },
          `${id} ${JSON.stringify(base)} ${n}`,
        );
        count += 1;
      }
    assert.ok(count >= 1000, `${id}: ${count} combinations`);
  }
});

// ----------------------------------------------------------------- DT-4

// The folded text: lower case, ends cut, every run of spaces and line breaks one space.
const fold = (text) => text.toLowerCase().trim().replace(/\s+/gu, " ");
// The ids of a file: tenant, question, option, solution, rule, hypothesis.
function idsOfFile(t) {
  return [
    t.id,
    ...t.questions.map((q) => q.id),
    ...t.questions.flatMap((q) => (q.options ?? []).map((o) => o.id)),
    ...t.solutions.map((s) => s.id),
    ...t.rules.map((r) => r.id),
    ...t.hypotheses.map((h) => h.id),
  ];
}
// All the strings that a visitor can read, in one language, folded.
function visitorStrings(t, lang) {
  const out = [];
  for (const { value } of triplesOf(t)) out.push(fold(value[lang]));
  out.push(
    fold(t.look.mark),
    fold(t.leads.operator_name),
    fold(t.leads.privacy_contact),
  );
  for (const member of t.look.team) out.push(fold(member.name));
  return out;
}

test("DT-4a: the ids of the two files (tenant, question, option, solution, rule, hypothesis) form two sets with nothing in common", () => {
  const [a, b] = IDS.map((id) => idsOfFile(tenantPlain(id)));
  assert.ok(a.length >= 40 && b.length >= 40);
  assert.equal(new Set(a).size, a.length, "stock: no id twice");
  assert.equal(new Set(b).size, b.length, "agency: no id twice");
  const shared = a.filter((x) => b.includes(x));
  assert.deepEqual(shared, []);
});

test("DT-4b: for each of ru, kk and en the visitor strings of the two files (name, look texts, staff names, roles and replies, intro, questions, options, unit, solutions, rules, hypotheses, result and lead texts, operator, privacy contact), folded the same way on both sides (lower case, ends cut, runs of spaces one space), have no common element", () => {
  const [a, b] = IDS.map((id) => tenantPlain(id));
  for (const lang of LANGS) {
    const left = visitorStrings(a, lang);
    const right = new Set(visitorStrings(b, lang));
    assert.ok(left.length >= 90 && right.size >= 90, lang);
    const shared = [...new Set(left.filter((x) => right.has(x)))];
    assert.deepEqual(shared, [], lang);
  }
  // the fold itself: the same text with other case and other spaces is one text
  assert.equal(fold("  Приём  заявок \n"), fold("приём заявок"));
});

test("DT-4c: the four colours of one file and the four colours of the other have no value in common", () => {
  const values = IDS.map((id) => {
    const colors = tenantPlain(id).look.colors;
    return COLOUR_PLACES.map(([theme, key]) =>
      colors[theme][key].toLowerCase(),
    );
  });
  assert.equal(values[0].length, 4);
  assert.equal(values[1].length, 4);
  assert.deepEqual(
    values[0].filter((c) => values[1].includes(c)),
    [],
  );
});

test("DT-4d: a folder with the real stock.json and a broken agency.json - `check` of stock.json gives code 0 and the ok line, and the same for agency.json beside a broken stock.json; no file is changed", (t) => {
  for (const [good, broken] of [
    ["stock", "agency"],
    ["agency", "stock"],
  ]) {
    const dir = makeTmp(t);
    fs.copyFileSync(
      path.join(NEW_TENANTS, `${good}.json`),
      path.join(dir, `${good}.json`),
    );
    fs.writeFileSync(path.join(dir, `${broken}.json`), "{");
    const before = folderDigest(dir);
    const run = runPicker(["check", path.join(dir, `${good}.json`)]);
    assert.equal(run.code, 0, good);
    assert.deepEqual(run.err, [], good);
    assert.deepEqual(run.out, [okLine(good, 4, 15)], good);
    assert.deepEqual(folderDigest(dir), before, good);
    // the broken neighbour is really broken
    assert.equal(
      runPicker(["check", path.join(dir, `${broken}.json`)]).code,
      1,
      broken,
    );
  }
});

// ----------------------------------------------------------------- DT-5

test('DT-5a: for each file the count of `"kk":` by a regular expression on the text equals the count of `"ru":`, of `"en":` and of the {ru, kk, en} objects found by walking, and each of them has exactly the keys ru, kk, en - the number of rows the reader\'s table must hold', () => {
  const total = { regex: 0, walk: 0 };
  for (const id of IDS) {
    const text = readText(path.join(NEW_TENANTS, `${id}.json`));
    const count = (key) =>
      (text.match(new RegExp(`"${key}":`, "gu")) ?? []).length;
    const triples = triplesOf(JSON.parse(text));
    assert.equal(count("kk"), triples.length, `${id}: kk`);
    assert.equal(count("ru"), triples.length, `${id}: ru`);
    assert.equal(count("en"), triples.length, `${id}: en`);
    for (const { path: p, value } of triples)
      assert.deepEqual(
        sorted(Object.keys(value)),
        ["en", "kk", "ru"],
        `${id} ${p}`,
      );
    total.regex += count("kk");
    total.walk += triples.length;
  }
  assert.equal(total.regex, total.walk);
  assert.ok(total.walk >= 180, `${total.walk} texts`);
});

// ----------------------------------------------------------------- DT-6

const newStandLines = (port) => [
  "Сайт подбора запущен. Откройте ссылки:",
  `http://127.0.0.1:${port}/t/agency/`,
  `http://127.0.0.1:${port}/t/stock/`,
  "Изменения файлов арендаторов применяются после перезапуска.",
  "Остановить сайт: Ctrl+C.",
];
const oldStandLines = (port) => [
  "Сайт подбора запущен. Откройте ссылки:",
  `http://127.0.0.1:${port}/t/svet-marketing/`,
  `http://127.0.0.1:${port}/t/uchet-pro/`,
  "Изменения файлов арендаторов применяются после перезапуска.",
  "Остановить сайт: Ctrl+C.",
];

// Starts `serve` on a stand folder with port 0 and a temporary home folder.
async function startStand(t, folder) {
  const home = makeTmp(t);
  const run = spawnCli(
    t,
    ["serve", "--tenants", folder, "--home", home, "--port", "0"],
    {
      env: { PATH: process.env.PATH, HOME: home },
    },
  );
  const lines = await run.waitLines(5);
  const port = Number(/^http:\/\/127\.0\.0\.1:(\d+)\//u.exec(lines[1])?.[1]);
  assert.ok(port > 0, lines[1]);
  return { run, lines, port };
}

test("DT-6a: `serve --tenants src/picker/demo-tenants-v3 --port 0` prints the five lines (the links agency, then stock) with an empty stderr; each folder of the stand holds exactly stock.json and agency.json; the questionnaire of each tenant on ru, kk and en is 200 with the look, the desk of every question, the object of every option, the quick numbers and the whatsapp number of the file; SIGTERM ends it with code 0", async (t) => {
  assert.deepEqual(fs.readdirSync(NEW_TENANTS).sort(), [
    "agency.json",
    "stock.json",
  ]);
  assert.deepEqual(fs.readdirSync(NEW_ANSWERS).sort(), [
    "agency.json",
    "stock.json",
  ]);
  const before = folderDigest(NEW_TENANTS);
  const { run, lines, port } = await startStand(
    t,
    "src/picker/demo-tenants-v3",
  );
  assert.deepEqual(lines, newStandLines(port));
  for (const id of IDS) {
    const file = tenantPlain(id);
    for (const lang of LANGS) {
      const label = `${id} ${lang}`;
      const res = await request(port, {
        path: `/t/${id}/api/questionnaire?lang=${lang}`,
      });
      assert.equal(res.status, 200, label);
      const answer = JSON.parse(res.text);
      assert.equal(answer.lang, lang, label);
      assert.deepEqual(answer.look.colors, file.look.colors, label);
      assert.equal(answer.look.mark, file.look.mark, label);
      assert.equal(answer.look.team.length, 4, label);
      assert.deepEqual(
        answer.questions.map((q) => q.desk),
        [1, 2, 3, 3, 4],
        label,
      );
      for (const q of answer.questions) {
        for (const o of q.options ?? [])
          assert.equal(typeof o.object, "object", `${label} ${q.id}`);
      }
      const number = answer.questions.find((q) => Object.hasOwn(q, "chips"));
      assert.deepEqual(
        number.chips,
        file.questions.find((q) => q.type === "number").chips,
        label,
      );
      assert.equal(answer.leads.whatsapp, file.leads.whatsapp, label);
    }
  }
  const done = await run.stop("SIGTERM");
  assert.equal(done.code, 0);
  assert.equal(run.stderr(), "");
  assert.deepEqual(folderDigest(NEW_TENANTS), before);
});

// The sha256 of the six questionnaires of the old stand, obtained by running the server on
// the base tag of the run (design REQ-069, F4; design REQ-070, 8.3). The same six values
// stand in picker-server.test.js (SV-9): a later requirement that changes the old stand on
// purpose changes both places.
const OLD_HASHES = {
  "uchet-pro": {
    ru: "ed7d65846b4885f0722b6428aab07080820c6cf597681a0ca462d6ebbdcc1e96",
    kk: "b7ed6ba4f73efa9842cead1006f0c9e6038397441f8345c8576f6d57b47b4081",
    en: "b74367ccc8716c3780275eef00ac3fc1171cc119166c07afdf788a845cf4d95e",
  },
  "svet-marketing": {
    ru: "952a99e23c9c060a1b182028aee1c3721220db4b8221745412ebef8ce0ceda60",
    kk: "53a706196b498567a1e23589339a6b468d0fff61d06defbe5332a54ae9f75024",
    en: "1a0b16d18ea49937ff863d6fe030728148ece5bd9fb7fa7ff9ab725a8fa3fc7c",
  },
};
const OLD_FILE_HASHES = {
  [path.join(OLD_TENANTS, "svet-marketing.json")]:
    "0deb80e04aee0a515223cee51b18b51bbdcb563dfeec61c6e1eb0c4659b5d9fd",
  [path.join(OLD_TENANTS, "uchet-pro.json")]:
    "d4f0885bf5b34469014bcd2e57258ddc04056c5bdf661363749a035ab5a55ee8",
  [path.join(OLD_ANSWERS, "svet-marketing.json")]:
    "8d3be981bde3dfcb49ff44570461c68a1272092f6b68cd09646d9474b9d95393",
  [path.join(OLD_ANSWERS, "uchet-pro.json")]:
    "c412d3987caa0524b223152fa465321e5de71f382444460d1d13b3ed4a2b068e",
};
// The engine on the old answer sets (design 8.3): clear_leader and the recommended.
const OLD_OUTCOMES = {
  "uchet-pro": {
    leader: {
      clear: true,
      rec: [
        ["sheet-start", 15],
        ["shop-kit", 8],
      ],
    },
    close: {
      clear: false,
      rec: [
        ["chain-control", 11],
        ["shop-kit", 9],
      ],
    },
    none: { clear: null, rec: [] },
  },
  "svet-marketing": {
    leader: {
      clear: true,
      rec: [
        ["quick-start", 12],
        ["content-month", 8],
      ],
    },
    close: {
      clear: false,
      rec: [
        ["content-month", 13],
        ["guest-return", 11],
      ],
    },
    none: { clear: null, rec: [] },
  },
};

test("DT-6b: the old stand is not touched - `serve --tenants src/picker/demo-tenants --port 0` prints its own five lines, the six questionnaires have the sha256 of the base tag, the four old data files have their sha256, and the real engine on the six old sets gives the clear leader, the recommended ids and scores and the no-match text of the design", async (t) => {
  for (const [file, hash] of Object.entries(OLD_FILE_HASHES))
    assert.equal(sha256(fs.readFileSync(file)), hash, path.basename(file));
  assert.deepEqual(fs.readdirSync(OLD_TENANTS).sort(), [
    "svet-marketing.json",
    "uchet-pro.json",
  ]);
  assert.deepEqual(fs.readdirSync(OLD_ANSWERS).sort(), [
    "svet-marketing.json",
    "uchet-pro.json",
  ]);
  const { run, lines, port } = await startStand(t, "src/picker/demo-tenants");
  assert.deepEqual(lines, oldStandLines(port));
  for (const [id, byLang] of Object.entries(OLD_HASHES)) {
    for (const lang of LANGS) {
      const res = await request(port, {
        path: `/t/${id}/api/questionnaire?lang=${lang}`,
      });
      assert.equal(res.status, 200, `${id} ${lang}`);
      assert.equal(sha256(res.body), byLang[lang], `${id} ${lang}`);
    }
  }
  assert.equal((await run.stop("SIGTERM")).code, 0);
  assert.equal(run.stderr(), "");
  // the engine on the old sets
  for (const [id, sets] of Object.entries(OLD_OUTCOMES)) {
    const answers = JSON.parse(readText(path.join(OLD_ANSWERS, `${id}.json`)));
    const file = path.join(OLD_TENANTS, `${id}.json`);
    const plain = JSON.parse(readText(file));
    for (const [name, want] of Object.entries(sets)) {
      for (const lang of LANGS) {
        const label = `${id}.${name} ${lang}`;
        const out = engineOn(id, lang, answers[name], file);
        assert.equal(out.ok, true, label);
        assert.equal(out.result.clear_leader, want.clear, label);
        assert.deepEqual(
          out.result.recommended.map((x) => [x.id, x.score]),
          want.rec,
          label,
        );
        if (name === "none")
          assert.equal(
            out.result.no_match_text,
            plain.result.no_match_text[lang],
            label,
          );
        else assert.equal(out.result.no_match_text, null, label);
      }
    }
  }
});

test("DT-6c: tools/README.md in the section of the stand holds the exact command `npm run picker -- serve --tenants src/picker/demo-tenants-v3 --home <folder outside the project>` and the names stock and agency", () => {
  const text = readText(README_FILE);
  const start = text.indexOf("### A stand of two made-up tenants");
  assert.notEqual(start, -1, "the section exists");
  const next = text.indexOf("\n### ", start + 1);
  const section = text.slice(start, next === -1 ? undefined : next);
  assert.ok(
    section.includes(
      "npm run picker -- serve --tenants src/picker/demo-tenants-v3 --home <folder outside the project>",
    ),
  );
  assert.match(section, /`stock`/u);
  assert.match(section, /`agency`/u);
  assert.ok(section.includes("src/picker/demo-answers-v3"));
});

// ----------------------------------------------------------------- DT-7

const DATA_FOLDERS = [NEW_TENANTS, NEW_ANSWERS];

test("DT-7a: the search for an address or a mail in the two data folders finds nothing - the command grep ends with code 1 and prints nothing, and an own regular expression over every file finds nothing either", () => {
  const run = spawnSync(
    "grep",
    [
      "-rnE",
      "https?://|@[a-z]+[.][a-z]+",
      "src/picker/demo-tenants-v3/",
      "src/picker/demo-answers-v3/",
    ],
    { cwd: TOOLS, encoding: "utf8" },
  );
  assert.equal(run.status, 1, run.stdout);
  assert.equal(run.stdout, "");
  let files = 0;
  for (const dir of DATA_FOLDERS)
    for (const name of fs.readdirSync(dir)) {
      files += 1;
      assert.doesNotMatch(
        readText(path.join(dir, name)),
        /https?:\/\/|@[a-z]+\.[a-z]+/u,
        name,
      );
    }
  assert.equal(files, 4);
});

test("DT-7b: every run of ten or more digits in the files of the two data folders, listed, is exactly the invented whatsapp number of stock.json and the one of agency.json - nothing else", () => {
  const found = [];
  for (const dir of DATA_FOLDERS)
    for (const name of fs.readdirSync(dir).sort())
      for (const m of readText(path.join(dir, name)).matchAll(/\d{10,}/gu))
        found.push([`${path.basename(dir)}/${name}`, m[0]]);
  assert.deepEqual(found, [
    ["demo-tenants-v3/agency.json", "77020000000"],
    ["demo-tenants-v3/stock.json", "77010000000"],
  ]);
});
