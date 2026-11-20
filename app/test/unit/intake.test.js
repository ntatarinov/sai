import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { APP } from "../fixtures/helpers.js";

// REQ-111 criterion 5: Sai's own intake (content/sai-intake.json) and its answer sets. The rules of the
// criterion are written here as one function of an intake and its fixtures, so a damaged copy is red by the
// same rules that the real files pass; the engine is the byte copy of the picker's, imported from the app.

const INTAKE_FILE = path.join(APP, "content", "sai-intake.json");
const ANSWERS_DIR = path.join(APP, "content", "sai-intake.answers");
const ENGINE = pathToFileURL(
  path.join(APP, "server", "vendor", "picker-engine.js"),
).href;
const LANGS = ["ru", "kk", "en"];
// The closed list of the six solution ids, one per kind of «what agents build in V1».
const SOLUTION_IDS = [
  "landing",
  "card-site",
  "catalog",
  "calculator",
  "dashboard",
  "single-page-app",
];

const engine = await import(ENGINE);
const readIntake = () => JSON.parse(fs.readFileSync(INTAKE_FILE, "utf8"));
/** The answer sets of the folder: file name (without .json) → the answers object. */
const readFixtures = () =>
  Object.fromEntries(
    fs
      .readdirSync(ANSWERS_DIR)
      .sort()
      .map((f) => [
        f.replace(/\.json$/, ""),
        JSON.parse(fs.readFileSync(path.join(ANSWERS_DIR, f), "utf8")),
      ]),
  );

/**
 * The tenant in one language: every object whose keys are exactly the three languages and whose values are
 * strings is replaced by the string of the language (the intake's own text shape, `{ru, kk, en}`).
 * @param {any} value
 * @param {string} lang
 * @returns {any}
 */
function inLanguage(value, lang) {
  if (Array.isArray(value)) return value.map((v) => inLanguage(v, lang));
  if (value === null || typeof value !== "object") return value;
  const keys = Object.keys(value);
  if (
    keys.length === 3 &&
    LANGS.every((l) => keys.includes(l) && typeof value[l] === "string")
  )
    return value[lang];
  return Object.fromEntries(keys.map((k) => [k, inLanguage(value[k], lang)]));
}

/**
 * The findings of the criterion over an intake and its answer sets (IN-1, IN-2 and IN-4).
 * @param {any} intake
 * @param {Record<string, any>} fixtures
 * @returns {string[]}
 */
function intakeFindings(intake, fixtures) {
  /** @type {string[]} */
  const out = [];
  if (intake.schema !== "sai-picker-tenant/2") out.push("schema is not /2");
  if (intake.id !== "sai-intake") out.push("id is not sai-intake");
  const questions = Array.isArray(intake.questions) ? intake.questions : [];
  if (questions.length !== 5) out.push(`${questions.length} questions, not 5`);
  questions.forEach((q, i) => {
    if (q.type !== "single")
      out.push(`question ${i}: type ${q.type}, not single`);
    if (Object.hasOwn(q, "show_if")) out.push(`question ${i}: show_if`);
    if (q.required !== false) out.push(`question ${i}: required is not false`);
    const n = Array.isArray(q.options) ? q.options.length : 0;
    if (n < 2 || n > 4) out.push(`question ${i}: ${n} options`);
  });
  const solutions = Array.isArray(intake.solutions) ? intake.solutions : [];
  for (const key of ["leads", "hypotheses"])
    if (Object.hasOwn(intake, key)) out.push(`the file has ${key}`);
  solutions.forEach((s, i) => {
    for (const key of ["price_text", "duration_text"])
      if (Object.hasOwn(s, key)) out.push(`solution ${i}: ${key}`);
    if (!Array.isArray(s.not_suitable_when) || s.not_suitable_when.length < 1)
      out.push(`solution ${i}: no not_suitable_when`);
  });
  const ids = solutions.map((/** @type {any} */ s) => s.id);
  if (
    JSON.stringify([...ids].sort()) !== JSON.stringify([...SOLUTION_IDS].sort())
  )
    out.push(`solution ids ${ids.join(",")} are not the six of the list`);
  const rules = Array.isArray(intake.rules) ? intake.rules : [];
  rules.forEach((r, i) => {
    const n = Array.isArray(r.when) ? r.when.length : 0;
    if (n < 1 || n > 3) out.push(`rule ${i}: ${n} conditions`);
  });
  const r = intake.result ?? {};
  if (r.top !== 3) out.push("result.top is not 3");
  if (!(r.min_score >= 1)) out.push("result.min_score is under 1");
  if (r.clear_lead_gap !== 2) out.push("result.clear_lead_gap is not 2");
  for (const l of LANGS)
    if (typeof r.no_match_text?.[l] !== "string" || r.no_match_text[l] === "")
      out.push(`result.no_match_text has no ${l} text`);
  // The answer sets: each is accepted by the engine, there are at least as many as solutions, and every
  // solution is recommended first by at least one (the file named after it), the file server-needed by none.
  const files = Object.keys(fixtures);
  if (files.length < solutions.length)
    out.push(`${files.length} answer sets for ${solutions.length} solutions`);
  /** @type {Set<string>} */
  const first = new Set();
  for (const name of files) {
    const tenant = inLanguage(intake, "ru");
    /** @type {any} */
    let resolved;
    /** @type {any} */
    let result;
    try {
      resolved = engine.resolveAnswers(tenant, fixtures[name]);
      if (resolved.ok) result = engine.computeResult(tenant, fixtures[name]);
    } catch (err) {
      out.push(
        `${name}: the engine throws (${err instanceof Error ? err.message : err})`,
      );
      continue;
    }
    if (!resolved.ok) {
      out.push(
        `${name}: the engine refuses the answers (${resolved.error.reason})`,
      );
      continue;
    }
    if (!result.ok) {
      out.push(`${name}: no result`);
      continue;
    }
    const lead = result.result.recommended[0]?.id;
    if (lead !== undefined) first.add(lead);
    if (ids.includes(name) && lead !== name)
      out.push(`${name}: the set does not make ${name} the first (${lead})`);
    if (name === "server-needed" && result.result.no_match_text === null)
      out.push("server-needed: a recommendation, not the no-match result");
  }
  for (const id of ids)
    if (!first.has(id)) out.push(`no answer set recommends ${id}`);
  if (!files.includes("server-needed")) out.push("no server-needed answer set");
  return out;
}

const copyOf = () => structuredClone(readIntake());
const fixturesOf = () => structuredClone(readFixtures());

test("IN-1 sai-picker-tenant/2, id sai-intake, exactly five single questions, no show_if, required false, 2 to 4 options each", () => {
  const intake = readIntake();
  assert.equal(intake.schema, "sai-picker-tenant/2");
  assert.equal(intake.id, "sai-intake");
  assert.equal(intake.questions.length, 5);
  for (const q of intake.questions) {
    assert.equal(q.type, "single", q.id);
    assert.ok(!Object.hasOwn(q, "show_if"), q.id);
    assert.equal(q.required, false, q.id);
    assert.ok(q.options.length >= 2 && q.options.length <= 4, q.id);
    // Every option has a text in each of the three languages.
    for (const o of q.options)
      for (const l of LANGS)
        assert.ok(
          typeof o.label[l] === "string" && o.label[l] !== "",
          `${q.id} ${o.id} ${l}`,
        );
  }
  // The result settings and every rule of one to three conditions (so five «Не знаю» give no match).
  assert.equal(intake.result.top, 3);
  assert.ok(intake.result.min_score >= 1);
  assert.equal(intake.result.clear_lead_gap, 2);
  for (const rule of intake.rules)
    assert.ok(rule.when.length >= 1 && rule.when.length <= 3, rule.id);
  assert.deepEqual(
    intakeFindings(intake, readFixtures()).filter((f) =>
      /question|schema|id is|result|rule/.test(f),
    ),
    [],
  );
});

test("IN-2 no price_text, duration_text, leads or hypotheses; every solution has at least one not_suitable_when; the ids are exactly the six", () => {
  const intake = readIntake();
  assert.ok(!Object.hasOwn(intake, "leads"));
  assert.ok(!Object.hasOwn(intake, "hypotheses"));
  assert.equal(intake.solutions.length, 6);
  for (const s of intake.solutions) {
    assert.ok(!Object.hasOwn(s, "price_text"), s.id);
    assert.ok(!Object.hasOwn(s, "duration_text"), s.id);
    assert.ok(s.not_suitable_when.length >= 1, s.id);
  }
  assert.deepEqual(
    intake.solutions.map((/** @type {any} */ s) => s.id),
    SOLUTION_IDS,
  );
});

test("IN-3 every combination of the five answers (each question answered or left unanswered) through the byte copy gives ok and a recommended solution or the no_match_text, in each language", () => {
  const intake = readIntake();
  const sizes = intake.questions.map(
    (/** @type {any} */ q) => q.options.length + 1,
  );
  const total = sizes.reduce(
    (/** @type {number} */ a, /** @type {number} */ b) => a * b,
    1,
  );
  assert.ok(total <= 3125 && total > 100, String(total));
  for (const lang of LANGS) {
    const tenant = inLanguage(intake, lang);
    const noMatch = intake.result.no_match_text[lang];
    let noRecommendation = 0;
    const lead = new Set();
    for (let n = 0; n < total; n++) {
      /** @type {Record<string, string>} */
      const answers = {};
      let rest = n;
      intake.questions.forEach(
        (/** @type {any} */ q, /** @type {number} */ i) => {
          const pick = rest % sizes[i];
          rest = Math.floor(rest / sizes[i]);
          if (pick > 0) answers[q.id] = q.options[pick - 1].id;
        },
      );
      const got = engine.computeResult(tenant, answers);
      assert.equal(got.ok, true, `${lang} ${JSON.stringify(answers)}`);
      const { recommended, no_match_text: text } = got.result;
      assert.ok(
        recommended.length > 0 || text === noMatch,
        `${lang} ${JSON.stringify(answers)}`,
      );
      assert.ok(
        recommended.length === 0 || text === null,
        `${lang} ${JSON.stringify(answers)}`,
      );
      for (const r of recommended) assert.ok(SOLUTION_IDS.includes(r.id), r.id);
      if (recommended.length === 0) noRecommendation++;
      else lead.add(recommended[0].id);
    }
    // Five «Не знаю» give no match, and every solution leads somewhere.
    assert.ok(noRecommendation > 0, lang);
    assert.deepEqual([...lead].sort(), [...SOLUTION_IDS].sort(), lang);
    const none = engine.computeResult(tenant, {});
    assert.equal(none.result.no_match_text, noMatch, lang);
    assert.deepEqual(none.result.recommended, [], lang);
  }
});

test("IN-4 every answer set is accepted by resolveAnswers, there are at least as many as solutions, every solution leads in one", () => {
  const fixtures = readFixtures();
  const intake = readIntake();
  const names = Object.keys(fixtures);
  assert.ok(names.length >= intake.solutions.length, names.join());
  assert.deepEqual(names, [...SOLUTION_IDS, "server-needed"].sort());
  for (const lang of LANGS) {
    const tenant = inLanguage(intake, lang);
    for (const name of names) {
      const resolved = engine.resolveAnswers(tenant, fixtures[name]);
      assert.equal(resolved.ok, true, `${lang} ${name}`);
      const got = engine.computeResult(tenant, fixtures[name]);
      if (name === "server-needed") {
        assert.deepEqual(got.result.recommended, [], `${lang} ${name}`);
        assert.equal(
          got.result.no_match_text,
          intake.result.no_match_text[lang],
        );
      } else
        assert.equal(got.result.recommended[0].id, name, `${lang} ${name}`);
    }
  }
  // Each file is the answers object itself: question id → option id of that question.
  for (const [name, answers] of Object.entries(fixtures)) {
    assert.deepEqual(
      Object.keys(answers).length,
      intake.questions.length,
      name,
    );
    for (const q of intake.questions)
      assert.ok(
        q.options.some((/** @type {any} */ o) => o.id === answers[q.id]),
        `${name} ${q.id}`,
      );
  }
  assert.deepEqual(intakeFindings(intake, fixtures), []);
});

test("IN-5 the eight damaged copies of the criterion are red, each by its rule: a sixth question, multiple, show_if, price_text, leads, a solution without not_suitable_when, an id outside the list, a fixture with an unknown option", () => {
  assert.deepEqual(intakeFindings(copyOf(), fixturesOf()), []);
  /** @type {Array<[string, (i: any, f: Record<string, any>) => void, RegExp]>} */
  const damaged = [
    [
      "a sixth question",
      (i) =>
        i.questions.push({ ...structuredClone(i.questions[0]), id: "sixth" }),
      /6 questions, not 5/,
    ],
    ["a fourth question fewer", (i) => i.questions.pop(), /4 questions, not 5/],
    [
      "a question of type multiple",
      (i) => (i.questions[2].type = "multiple"),
      /question 2: type multiple/,
    ],
    [
      "a show_if",
      (i) =>
        (i.questions[1].show_if = [
          {
            question: i.questions[0].id,
            any_of: [i.questions[0].options[0].id],
          },
        ]),
      /question 1: show_if/,
    ],
    [
      "a required question",
      (i) => (i.questions[3].required = true),
      /question 3: required/,
    ],
    [
      "one option only",
      (i) => (i.questions[0].options = i.questions[0].options.slice(0, 1)),
      /question 0: 1 options/,
    ],
    [
      "five options",
      (i) =>
        (i.questions[0].options = [
          ...i.questions[0].options,
          { id: "a1", label: {} },
          { id: "a2", label: {} },
          { id: "a3", label: {} },
          { id: "a4", label: {} },
          { id: "a5", label: {} },
        ].slice(0, 5)),
      /question 0: 5 options/,
    ],
    [
      "a price_text",
      (i) => (i.solutions[0].price_text = { ru: "a", kk: "a", en: "a" }),
      /solution 0: price_text/,
    ],
    [
      "a duration_text",
      (i) => (i.solutions[2].duration_text = { ru: "a", kk: "a", en: "a" }),
      /solution 2: duration_text/,
    ],
    ["a leads section", (i) => (i.leads = []), /the file has leads/],
    [
      "a hypotheses section",
      (i) => (i.hypotheses = []),
      /the file has hypotheses/,
    ],
    [
      "a solution without not_suitable_when",
      (i) => delete i.solutions[1].not_suitable_when,
      /solution 1: no not_suitable_when/,
    ],
    [
      "a solution with an empty not_suitable_when",
      (i) => (i.solutions[1].not_suitable_when = []),
      /solution 1: no not_suitable_when/,
    ],
    [
      "a solution id outside the list",
      (i) => (i.solutions[3].id = "blog"),
      /solution ids .* are not the six/,
    ],
    [
      "a seventh solution",
      (i) =>
        i.solutions.push({ ...structuredClone(i.solutions[0]), id: "seventh" }),
      /solution ids .* are not the six/,
    ],
    [
      "a rule with four conditions",
      (i) =>
        (i.rules[0].when = [
          ...i.rules[0].when,
          ...i.rules[0].when,
          ...i.rules[0].when,
          ...i.rules[0].when,
        ]),
      /rule 0: 4 conditions/,
    ],
    [
      "a rule with no condition",
      (i) => (i.rules[1].when = []),
      /rule 1: 0 conditions/,
    ],
    [
      "another schema",
      (i) => (i.schema = "sai-picker-tenant/3"),
      /schema is not \/2/,
    ],
    ["another id", (i) => (i.id = "intake"), /id is not sai-intake/],
    ["result.top 2", (i) => (i.result.top = 2), /result\.top/],
    [
      "no no_match_text in en",
      (i) => delete i.result.no_match_text.en,
      /no_match_text has no en/,
    ],
    [
      "a fixture with an unknown option",
      (i, f) =>
        (f.landing = { ...f.landing, [i.questions[0].id]: "no-such-option" }),
      /landing: the engine refuses the answers \(unknown_option\)/,
    ],
    [
      "a fixture with an unknown question",
      (_i, f) => (f.landing = { ...f.landing, zzz: "x" }),
      /landing: the engine refuses the answers \(unknown_question\)/,
    ],
    [
      "a fixture of the wrong kind",
      (i, f) =>
        (f.landing = {
          ...f.landing,
          [i.questions[0].id]: [i.questions[0].options[0].id],
        }),
      /landing: the engine refuses the answers \(wrong_kind\)/,
    ],
    [
      "a fixture removed",
      (_i, f) => delete f.catalog,
      /no answer set recommends catalog|catalog/,
    ],
    [
      "a fixture that does not make its solution first",
      (_i, f) => (f.dashboard = f.landing),
      /dashboard: the set does not make dashboard the first/,
    ],
    [
      "no server-needed set",
      (_i, f) => delete f["server-needed"],
      /no server-needed answer set/,
    ],
    [
      "server-needed that recommends",
      (_i, f) => (f["server-needed"] = f.landing),
      /server-needed: a recommendation/,
    ],
  ];
  for (const [name, edit, want] of damaged) {
    const intake = copyOf();
    const fixtures = fixturesOf();
    edit(intake, fixtures);
    const found = intakeFindings(intake, fixtures);
    assert.ok(
      found.some((f) => want.test(f)),
      `${name}: ${JSON.stringify(found)}`,
    );
  }
});

test("IN-6 the step content: picker check on content/sai-intake.json from app/ exits 0 with its one line, N from 1 to 6", () => {
  const intake = readIntake();
  const r = spawnSync(
    process.execPath,
    ["../tools/src/picker/cli.js", "check", "content/sai-intake.json"],
    { cwd: APP, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stderr, "");
  const m =
    /^Файл арендатора sai-intake в порядке: вопросов 5, решений (\d+), правил (\d+)\.\n$/.exec(
      r.stdout,
    );
  assert.ok(m, JSON.stringify(r.stdout));
  const solutions = Number(m[1]);
  assert.ok(solutions >= 1 && solutions <= 6, String(solutions));
  assert.equal(solutions, intake.solutions.length);
  assert.equal(Number(m[2]), intake.rules.length);
  // The command is no formality: on a file that is not there it exits with a code other than 0, so the step of
  // the check would stop.
  const broken = spawnSync(
    process.execPath,
    ["../tools/src/picker/cli.js", "check", "content/no-such-file.json"],
    { cwd: APP, encoding: "utf8" },
  );
  assert.notEqual(broken.status, 0);
});
