// Helpers of the tests of `npm run picker` (design REQ-054, 12.3). Not a test file.
// The command is always run as a process (cli.js runs its command at once when it is
// loaded, so it is never imported). The expected output of every sample is written
// here as literals, line by line: the texts of design section 6 are the contract.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const PICKER = path.join(TOOLS, "src", "picker");
export const CLI = path.join(PICKER, "cli.js");
export const FIXTURES = path.join(TOOLS, "test", "fixtures", "picker");
export const DEMO_TENANTS = path.join(PICKER, "demo-tenants");
export const LEGACY_TENANTS = path.join(
  TOOLS,
  "test",
  "fixtures",
  "picker-legacy",
);
export const DEMO_ANSWERS = path.join(PICKER, "demo-answers");

// All the modules of the picker, the one that touches the disk and the paths last.
export const CORE_MODULES = [
  "limits.js",
  "utf8.js",
  "json.js",
  "text-rules.js",
  "places.js",
  "conditions.js",
  "lang-check.js",
  "validate.js",
  "report.js",
  "check.js",
  "view.js",
  "cli.js",
  "engine.js",
  "config.js",
  "messages.js",
  "public-data.js",
  "request.js",
  "serve.js",
];
// The modules that read the disk or the network, and the modules that write (none yet).
export const READ_MODULES = [
  ...CORE_MODULES,
  "load.js",
  "fingerprint.js",
  "tenants.js",
  "assets.js",
  "server.js",
];
export const WRITE_MODULES = [];
export const ALL_MODULES = [...READ_MODULES, ...WRITE_MODULES];
// The exact set of node: modules that each module imports (design REQ-056, 7.1).
export const NODE_IMPORTS = Object.fromEntries([
  ...CORE_MODULES.map((name) => [name, []]),
  ["load.js", ["node:fs", "node:path"]],
  ["tenants.js", ["node:fs", "node:path"]],
  ["assets.js", ["node:fs", "node:path"]],
  ["fingerprint.js", ["node:crypto"]],
  ["server.js", ["node:http"]],
]);
// The modules that may list a folder.
export const LISTING_MODULES = ["tenants.js"];

export const ERROR_CODES = [
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

// ---------------------------------------------------------------- running

// Runs the command with arguments. Default: `node src/picker/cli.js` in tools/.
// viaNpm: `npm run -s picker --` with PATH and the HOME of a temporary folder, so that
// the header lines of npm do not stand in the output.
export function runPicker(args, { cwd = TOOLS, viaNpm = false, home } = {}) {
  let r;
  if (viaNpm) {
    const ownHome =
      home ?? fs.mkdtempSync(path.join(os.tmpdir(), "picker-npm-"));
    try {
      r = spawnSync("npm", ["run", "-s", "picker", "--", ...args], {
        cwd,
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: ownHome },
        timeout: 60000,
      });
    } finally {
      if (home === undefined)
        fs.rmSync(ownHome, { recursive: true, force: true });
    }
  } else {
    r = spawnSync(process.execPath, [CLI, ...args], {
      cwd,
      encoding: "utf8",
      timeout: 60000,
    });
  }
  const lines = (s) => (s === "" ? [] : s.replace(/\n$/u, "").split("\n"));
  return {
    code: r.status,
    signal: r.signal,
    stdout: r.stdout,
    stderr: r.stderr,
    out: lines(r.stdout),
    err: lines(r.stderr),
  };
}

// A temporary folder, removed after the test.
export function makeTmp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "picker-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export const fixture = (name) => path.join(FIXTURES, name);
export const fixtureBytes = (name) => fs.readFileSync(fixture(name));
export const fixtureJson = (name) =>
  JSON.parse(fs.readFileSync(fixture(name), "utf8"));

// Copies a sample (or the given bytes) into a folder, returns the path.
export function put(dir, name, bytes) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, bytes);
  return file;
}

// What must not change when a file is only read: the digest and the time of the file
// and the list of its folder.
export function fileDigest(file) {
  const stat = fs.statSync(file);
  return {
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex"),
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    listing: fs.readdirSync(path.dirname(file)).sort(),
  };
}

// ---------------------------------------------------------------- random

// A generator with a fixed seed (mulberry32); Math.random is never used.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
  return rng;
}

// ---------------------------------------------------------------- the oracle of visibility

// Which questions a visitor sees with the given answers - written here from the
// description of the conditions (design 4.5), not taken from src/. A question is seen when
// every condition of its show_if is true. any_of: the question is seen, answered and one
// of the chosen is in the list; none_of: seen, answered and none of the chosen is in the
// list; a range: seen, answered with a number inside the borders (both included). A
// condition on an unanswered or hidden question is false.
export function visibleQuestionIds(tenant, answers) {
  const seen = new Set();
  for (const q of tenant.questions) {
    const ok = (q.show_if ?? []).every((c) => {
      if (!seen.has(c.question)) return false;
      if (!Object.hasOwn(answers, c.question)) return false;
      const value = answers[c.question];
      if (Array.isArray(c.any_of)) {
        const chosen = Array.isArray(value) ? value : [value];
        return chosen.some((x) => c.any_of.includes(x));
      }
      if (Array.isArray(c.none_of)) {
        const chosen = Array.isArray(value) ? value : [value];
        return !chosen.some((x) => c.none_of.includes(x));
      }
      if (typeof value !== "number") return false;
      return (
        (c.min === undefined || value >= c.min) &&
        (c.max === undefined || value <= c.max)
      );
    });
    if (ok) seen.add(q.id);
  }
  return seen;
}

// ---------------------------------------------------------------- the shape of the lines

// The words of a text: parts between spaces with a letter or a digit in them.
export const wordsIn = (text) =>
  text.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w));

const SECOND_PERSON =
  /(^|[^\p{L}\p{N}])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои)(?![\p{L}\p{N}])/iu;
const PARSER_WORDS =
  /Unexpected|token|undefined|null|NaN|JSON|position|Expected/u;

// The problems of the lines of the output of check (code 1) by the shape of design 6.1:
// "<file>: <place>: <code>: <text>", a code of the ten, a text of at most 18 words that
// ends with a dot, no "ты…", no words of a parser, no line of a stack. A last line
// "И ещё ошибок: N." is allowed.
export function lineProblems(lines) {
  const out = [];
  for (const line of lines) {
    if (/^И ещё ошибок: \d+\.$/u.test(line)) continue;
    if (/^ {4}at /u.test(line)) out.push(`stack: ${line}`);
    const parts = line.split(": ");
    if (parts.length < 4) {
      out.push(`shape: ${line}`);
      continue;
    }
    const [name, place, code, ...rest] = parts;
    const text = rest.join(": ");
    if (name === "") out.push(`name: ${line}`);
    if (!/^(весь файл|строка \d+, знак \d+|[^\s]+)$/u.test(place))
      out.push(`place: ${line}`);
    if (!ERROR_CODES.includes(code)) out.push(`code: ${line}`);
    if (wordsIn(text).length > 18) out.push(`long: ${line}`);
    if (!text.endsWith(".")) out.push(`dot: ${line}`);
    if (SECOND_PERSON.test(text)) out.push(`ty: ${line}`);
    if (PARSER_WORDS.test(text)) out.push(`parser: ${line}`);
  }
  return out;
}

// The line of code 2: "picker: <one line of text>" with no stack.
export function refusalProblems(err) {
  const out = [];
  if (err.length !== 1) out.push(`lines: ${err.length}`);
  for (const line of err) {
    if (!line.startsWith("picker: ")) out.push(`start: ${line}`);
    if (/^ {4}at /u.test(line)) out.push(`stack: ${line}`);
    if (PARSER_WORDS.test(line)) out.push(`parser: ${line}`);
    if (SECOND_PERSON.test(line)) out.push(`ty: ${line}`);
  }
  return out;
}

// ---------------------------------------------------------------- the samples

const MANY = (i) =>
  `e-many-errors-150.json: rules[${i}].points: E_LIMIT: Баллы не могут быть равны 0. Укажите от -10 до -1 или от 1 до 10.`;

// Every sample of design section 10: the exit code and the exact lines of stdout.
export const EXPECTED = {
  "ok-minimal.json": {
    code: 0,
    lines: [
      "Файл арендатора ok-minimal в порядке: вопросов 4, решений 2, правил 3.",
    ],
  },
  "ok-bounds.json": {
    code: 0,
    lines: [
      "Файл арендатора ok-bounds в порядке: вопросов 30, решений 2, правил 3.",
    ],
  },
  "ok-retention-1.json": {
    code: 0,
    lines: [
      "Файл арендатора ok-retention-1 в порядке: вопросов 4, решений 2, правил 3.",
    ],
  },
  "ok-text-edges.json": {
    code: 0,
    lines: [
      "Файл арендатора ok-text-edges в порядке: вопросов 4, решений 2, правил 3.",
    ],
  },
  "e-field-missing-name.json": {
    code: 1,
    lines: [
      "e-field-missing-name.json: name: E_FIELD: Нет поля name. Добавьте его.",
    ],
  },
  "e-field-extra-top.json": {
    code: 1,
    lines: [
      "e-field-extra-top.json: colour: E_FIELD: Лишнее поле colour. Удалите его.",
    ],
  },
  "e-field-extra-question.json": {
    code: 1,
    lines: [
      "e-field-extra-question.json: questions[1].colour: E_FIELD: Лишнее поле colour. Удалите его.",
    ],
  },
  "e-field-wrong-type.json": {
    code: 1,
    lines: [
      "e-field-wrong-type.json: questions[2].min: E_FIELD: Ожидается целое число. Исправьте значение.",
    ],
  },
  "e-field-schema.json": {
    code: 1,
    lines: [
      "e-field-schema.json: schema: E_FIELD: Допустимо только: sai-picker-tenant/1 или sai-picker-tenant/2. Исправьте значение.",
    ],
  },
  "e-id-capital.json": {
    code: 1,
    lines: [
      "e-id-capital.json: id: E_ID: Допустимы 3–32 знака: строчные латинские буквы, цифры и дефис внутри.",
    ],
  },
  "e-id-file-mismatch.json": {
    code: 1,
    lines: [
      "e-id-file-mismatch.json: id: E_ID: Имя файла должно быть other-name.json. Переименуйте файл или исправьте id.",
    ],
  },
  "e-dup-question.json": {
    code: 1,
    lines: [
      "e-dup-question.json: questions[1].id: E_DUP: Идентификатор kind уже есть в questions[0].id. Выберите другой.",
    ],
  },
  "e-dup-option.json": {
    code: 1,
    lines: [
      "e-dup-option.json: questions[1].options[1].id: E_DUP: Идентификатор bags уже есть в questions[1].options[0].id. Выберите другой.",
    ],
  },
  "e-dup-rule.json": {
    code: 1,
    lines: [
      "e-dup-rule.json: rules[2].id: E_DUP: Идентификатор rule-a уже есть в rules[0].id. Выберите другой.",
    ],
  },
  "e-limit-questions-31.json": {
    code: 1,
    lines: [
      "e-limit-questions-31.json: questions: E_LIMIT: Элементов: 31, допустимо от 1 до 30. Исправьте список.",
    ],
  },
  "e-limit-options-9.json": {
    code: 1,
    lines: [
      "e-limit-options-9.json: questions[1].options: E_LIMIT: Элементов: 9, допустимо от 2 до 8. Исправьте список.",
    ],
  },
  "e-limit-points-0.json": {
    code: 1,
    lines: [
      "e-limit-points-0.json: rules[2].points: E_LIMIT: Баллы не могут быть равны 0. Укажите от -10 до -1 или от 1 до 10.",
    ],
  },
  "e-limit-points-11.json": {
    code: 1,
    lines: [
      "e-limit-points-11.json: rules[2].points: E_LIMIT: Число 11 вне границ от -10 до 10. Исправьте значение.",
    ],
  },
  "e-limit-retention-0.json": {
    code: 1,
    lines: [
      "e-limit-retention-0.json: leads.retention_days: E_LIMIT: Число 0 вне границ от 1 до 365. Исправьте значение.",
    ],
  },
  "e-limit-retention-366.json": {
    code: 1,
    lines: [
      "e-limit-retention-366.json: leads.retention_days: E_LIMIT: Число 366 вне границ от 1 до 365. Исправьте значение.",
    ],
  },
  "e-limit-title-201.json": {
    code: 1,
    lines: [
      "e-limit-title-201.json: questions[0].title: E_LIMIT: Знаков: 201, допустимо от 1 до 200. Исправьте текст.",
    ],
  },
  "e-ref-question.json": {
    code: 1,
    lines: [
      "e-ref-question.json: questions[1].show_if[0].question: E_REF: Вопрос nope не найден. Укажите id вопроса из списка questions.",
    ],
  },
  "e-ref-option.json": {
    code: 1,
    lines: [
      "e-ref-option.json: questions[1].show_if[0].any_of[0]: E_REF: Вариант water у вопроса kind не найден. Укажите id варианта этого вопроса.",
    ],
  },
  "e-ref-solution.json": {
    code: 1,
    lines: [
      "e-ref-solution.json: rules[2].solution: E_REF: Решение nothing не найдено. Укажите id решения из списка solutions.",
    ],
  },
  "e-ref-when-question.json": {
    code: 1,
    lines: [
      "e-ref-when-question.json: rules[2].when[0].question: E_REF: Вопрос nope не найден. Укажите id вопроса из списка questions.",
    ],
  },
  "e-order-self.json": {
    code: 1,
    lines: [
      "e-order-self.json: questions[1].show_if[0].question: E_ORDER: Вопрос extras стоит не выше этого. Ссылайтесь только на вопросы выше.",
    ],
  },
  "e-order-later.json": {
    code: 1,
    lines: [
      "e-order-later.json: questions[1].show_if[0].question: E_ORDER: Вопрос count стоит не выше этого. Ссылайтесь только на вопросы выше.",
    ],
  },
  "e-order-cycle.json": {
    code: 1,
    lines: [
      "e-order-cycle.json: questions[0].show_if[0].question: E_ORDER: Вопрос extras стоит не выше этого. Ссылайтесь только на вопросы выше.",
    ],
  },
  "e-cond-two-kinds.json": {
    code: 1,
    lines: [
      "e-cond-two-kinds.json: questions[1].show_if[0]: E_COND: Условие должно быть одного вида: any_of, none_of или min и max.",
    ],
  },
  "e-cond-no-kind.json": {
    code: 1,
    lines: [
      "e-cond-no-kind.json: questions[1].show_if[0]: E_COND: Условие должно быть одного вида: any_of, none_of или min и max.",
    ],
  },
  "e-cond-any-of-number.json": {
    code: 1,
    lines: [
      "e-cond-any-of-number.json: questions[3].show_if[0].any_of: E_COND: Условие any_of не подходит вопросу типа number. Используйте min и max.",
    ],
  },
  "e-cond-min-single.json": {
    code: 1,
    lines: [
      "e-cond-min-single.json: questions[1].show_if[0].min: E_COND: Условие min не подходит вопросу типа single. Используйте any_of или none_of.",
    ],
  },
  "e-unreachable.json": {
    code: 1,
    lines: [
      "e-unreachable.json: solutions[1]: E_UNREACHABLE: У решения van нет правила с положительными баллами. Добавьте такое правило.",
    ],
  },
  "e-five-errors.json": {
    code: 1,
    lines: [
      "e-five-errors.json: intro: E_FIELD: Нет поля intro. Добавьте его.",
      "e-five-errors.json: questions[0].colour: E_FIELD: Лишнее поле colour. Удалите его.",
      "e-five-errors.json: rules[2].solution: E_REF: Решение zz не найдено. Укажите id решения из списка solutions.",
      "e-five-errors.json: rules[2].points: E_LIMIT: Баллы не могут быть равны 0. Укажите от -10 до -1 или от 1 до 10.",
      "e-five-errors.json: leads.retention_days: E_LIMIT: Число 400 вне границ от 1 до 365. Исправьте значение.",
    ],
  },
  "e-json-syntax.txt": {
    code: 1,
    lines: [
      "e-json-syntax.txt: строка 3, знак 1: E_JSON: Здесь неожиданный знак. Проверьте запятые, кавычки и скобки.",
    ],
  },
  "e-json-truncated.txt": {
    code: 1,
    lines: [
      "e-json-truncated.txt: строка 3, знак 27: E_JSON: Файл закончился раньше времени. Проверьте скобки и кавычки.",
    ],
  },
  "e-json-empty.txt": {
    code: 1,
    lines: [
      "e-json-empty.txt: строка 1, знак 1: E_JSON: Файл закончился раньше времени. Проверьте скобки и кавычки.",
    ],
  },
  "e-json-dup-key.txt": {
    code: 1,
    lines: [
      "e-json-dup-key.txt: строка 3, знак 3: E_JSON: Поле schema записано дважды. Оставьте одно.",
    ],
  },
  "e-json-utf8.txt": {
    code: 1,
    lines: [
      "e-json-utf8.txt: строка 2, знак 12: E_JSON: Файл не в кодировке UTF-8. Сохраните его как UTF-8.",
    ],
  },
  "e-text-long-all.json": {
    code: 1,
    lines: [
      "e-text-long-all.json: intro: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: questions[0].title: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: questions[0].options[0].label: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: questions[1].help: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: solutions[0].summary: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: solutions[0].includes[0]: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: rules[0].text: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: hypotheses[0].explanation: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: result.no_match_text: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
      "e-text-long-all.json: leads.consent_text: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
    ],
  },
  "e-text-inner-dot.json": {
    code: 1,
    lines: [
      "e-text-inner-dot.json: intro: E_TEXT: Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
    ],
  },
  "e-sort-order.json": {
    code: 1,
    lines: [
      "e-sort-order.json: solutions[1]: E_UNREACHABLE: У решения van нет правила с положительными баллами. Добавьте такое правило.",
      "e-sort-order.json: rules[0].solution: E_REF: Решение zz не найдено. Укажите id решения из списка solutions.",
      "e-sort-order.json: leads.retention_days: E_LIMIT: Число 0 вне границ от 1 до 365. Исправьте значение.",
    ],
  },
  "e-text-ty.json": {
    code: 1,
    lines: [
      "e-text-ty.json: name: E_TEXT: Обращение не на «вы». Перепишите текст в форме «вы».",
      "e-text-ty.json: intro: E_TEXT: Обращение не на «вы». Перепишите текст в форме «вы».",
    ],
  },
  "e-many-errors-150.json": {
    code: 1,
    lines: [
      ...Array.from({ length: 100 }, (_, i) => MANY(i + 2)),
      "И ещё ошибок: 50.",
    ],
  },
};

export const SAMPLE_NAMES = Object.keys(EXPECTED);
