// PK-1 ... PK-8: the criteria of REQ-054 - the tenant file of the picker site and the
// command `npm run picker -- check <file>` (design docs/design/REQ-054-picker-tenant.md,
// section 12). The command is run as a process; the samples of section 10 stand in
// test/fixtures/picker/ and their exact output is written in picker-helpers.js.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { hasHomePath } from "../src/traces/rules.js";
import { validateTenant } from "../src/picker/validate.js";
import {
  ALL_MODULES,
  CORE_MODULES,
  DEMO_ANSWERS,
  DEMO_TENANTS,
  ERROR_CODES,
  EXPECTED,
  FIXTURES,
  PICKER,
  SAMPLE_NAMES,
  TOOLS,
  fileDigest,
  fixture,
  fixtureBytes,
  lineProblems,
  makeTmp,
  put,
  refusalProblems,
  runPicker,
  visibleQuestionIds,
} from "./picker-helpers.js";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const tenantPath = (id) => path.join(DEMO_TENANTS, `${id}.json`);
const IDS = ["uchet-pro", "svet-marketing"];
const SIZES = { "uchet-pro": [12, 5, 39], "svet-marketing": [11, 5, 37] };

// The output of every sample, once.
const RUNS = new Map();
function sample(name) {
  if (!RUNS.has(name)) RUNS.set(name, runPicker(["check", fixture(name)]));
  return RUNS.get(name);
}

// A sample must give exactly its code and its lines of design section 10, nothing in stderr.
function assertSample(name) {
  const r = sample(name);
  const want = EXPECTED[name];
  assert.equal(r.code, want.code, `${name}: exit code`);
  assert.deepEqual(r.out, want.lines, `${name}: stdout`);
  assert.deepEqual(r.err, [], `${name}: stderr`);
}

const named = (prefixes) =>
  SAMPLE_NAMES.filter((n) => prefixes.some((p) => n.startsWith(p)));

// ---------------------------------------------------------------------- PK-1

test("PK-1a: both fictional tenants pass the check through npm and directly - code 0, stderr empty, one line with the counts of the arrays of the file (12/5/39 and 11/5/37)", () => {
  for (const id of IDS) {
    const tenant = readJson(tenantPath(id));
    const [q, s, r] = [
      tenant.questions.length,
      tenant.solutions.length,
      tenant.rules.length,
    ];
    assert.deepEqual([q, s, r], SIZES[id], id);
    const want = `Файл арендатора ${id} в порядке: вопросов ${q}, решений ${s}, правил ${r}.`;
    const rel = path.join("src", "picker", "demo-tenants", `${id}.json`);
    for (const viaNpm of [true, false]) {
      const run = runPicker(["check", rel], { cwd: TOOLS, viaNpm });
      assert.equal(run.code, 0, `${id} npm=${viaNpm}`);
      assert.deepEqual(run.err, [], `${id} npm=${viaNpm}`);
      assert.deepEqual(run.out, [want], `${id} npm=${viaNpm}`);
    }
  }
});

// The kinds of a question and the texts that a visitor reads (design 4.11).
function textsOf(tenant) {
  const out = [tenant.name, tenant.intro];
  for (const q of tenant.questions) {
    out.push(q.title);
    if (q.help !== undefined) out.push(q.help);
    if (q.unit !== undefined) out.push(q.unit);
    for (const o of q.options ?? []) out.push(o.label);
  }
  for (const s of tenant.solutions) {
    out.push(
      s.name,
      s.summary,
      ...s.includes,
      ...s.needs_from_you,
      ...s.next_steps,
      ...s.not_suitable_when,
    );
    for (const k of ["price_text", "duration_text"])
      if (s[k] !== undefined) out.push(s[k]);
  }
  for (const r of tenant.rules) out.push(r.text);
  for (const h of tenant.hypotheses ?? []) out.push(h.title, h.explanation);
  out.push(tenant.result.no_match_text);
  if (tenant.leads !== undefined) {
    out.push(
      tenant.leads.operator_name,
      tenant.leads.consent_text,
      tenant.leads.privacy_contact,
    );
  }
  return out;
}
const idsOf = (tenant) => [
  ...tenant.questions.map((q) => q.id),
  ...tenant.questions.flatMap((q) => (q.options ?? []).map((o) => o.id)),
  ...tenant.solutions.map((s) => s.id),
  ...tenant.rules.map((r) => r.id),
  ...(tenant.hypotheses ?? []).map((h) => h.id),
];

test("PK-1b: the composition of each tenant - 8-15 questions, at least 3 with show_if, the three kinds, at least 4 solutions, at least 2 hypotheses, exactly one solution with both price and duration and one with neither, the leads of the first, none for the second, top at least 2", () => {
  for (const id of IDS) {
    const t = readJson(tenantPath(id));
    assert.equal(t.schema, "sai-picker-tenant/1");
    assert.equal(t.id, id);
    assert.ok(
      t.questions.length >= 8 && t.questions.length <= 15,
      `${id}: questions`,
    );
    assert.ok(
      t.questions.filter((q) => (q.show_if ?? []).length > 0).length >= 3,
      `${id}: show_if`,
    );
    for (const type of ["single", "multiple", "number"]) {
      assert.ok(
        t.questions.some((q) => q.type === type),
        `${id}: ${type}`,
      );
    }
    assert.ok(t.solutions.length >= 4, `${id}: solutions`);
    assert.ok((t.hypotheses ?? []).length >= 2, `${id}: hypotheses`);
    const both = t.solutions.filter(
      (s) => s.price_text !== undefined && s.duration_text !== undefined,
    );
    const none = t.solutions.filter(
      (s) => s.price_text === undefined && s.duration_text === undefined,
    );
    assert.equal(both.length, 1, `${id}: one with both`);
    assert.ok(none.length >= 1, `${id}: one with neither`);
    assert.equal(
      t.solutions.filter(
        (s) => (s.price_text === undefined) !== (s.duration_text === undefined),
      ).length,
      0,
      `${id}: no half`,
    );
    assert.ok(t.result.top >= 2, `${id}: top`);
  }
  const first = readJson(tenantPath("uchet-pro"));
  assert.equal(first.leads.enabled, true);
  assert.deepEqual(first.leads.contact_fields, ["phone", "email"]);
  assert.equal(
    Object.hasOwn(readJson(tenantPath("svet-marketing")), "leads"),
    false,
  );
});

test("PK-1c: the two tenants share no id and no text for a visitor", () => {
  const [a, b] = IDS.map((id) => readJson(tenantPath(id)));
  assert.notEqual(a.id, b.id);
  const same = (xs, ys) => xs.filter((x) => new Set(ys).has(x));
  assert.deepEqual(same(idsOf(a), idsOf(b)), [], "ids");
  assert.deepEqual(same(textsOf(a), textsOf(b)), [], "texts");
  // the sets themselves hold no empty or repeated entry that would hide a match
  assert.ok(textsOf(a).every((x) => typeof x === "string" && x.trim() !== ""));
  assert.ok(textsOf(b).every((x) => typeof x === "string" && x.trim() !== ""));
});

// The shape of an answer by the kind of the question.
function answerProblems(q, value) {
  if (q.type === "single") {
    return typeof value === "string" && q.options.some((o) => o.id === value)
      ? []
      : [`${q.id}: single`];
  }
  if (q.type === "multiple") {
    const ok =
      Array.isArray(value) &&
      value.length > 0 &&
      new Set(value).size === value.length &&
      value.every((v) => q.options.some((o) => o.id === v));
    return ok ? [] : [`${q.id}: multiple`];
  }
  return Number.isInteger(value) && value >= q.min && value <= q.max
    ? []
    : [`${q.id}: number`];
}

test("PK-1d: the sets of answers - the file stands, exactly leader, close and none; only questions and options of its tenant, right forms; an answer on every visible required question and none on a hidden one (by the oracle of the test, not by src/)", () => {
  for (const id of IDS) {
    const file = path.join(DEMO_ANSWERS, `${id}.json`);
    assert.ok(fs.existsSync(file), `${id}: answers`);
    const sets = readJson(file);
    assert.deepEqual(Object.keys(sets).sort(), ["close", "leader", "none"], id);
    const tenant = readJson(tenantPath(id));
    const byId = new Map(tenant.questions.map((q) => [q.id, q]));
    for (const [name, answers] of Object.entries(sets)) {
      const where = `${id}/${name}`;
      for (const key of Object.keys(answers))
        assert.ok(byId.has(key), `${where}: unknown question ${key}`);
      for (const [key, value] of Object.entries(answers)) {
        assert.deepEqual(answerProblems(byId.get(key), value), [], where);
      }
      const seen = visibleQuestionIds(tenant, answers);
      for (const q of tenant.questions) {
        const answered = Object.hasOwn(answers, q.id);
        if (seen.has(q.id) && q.required)
          assert.ok(answered, `${where}: no answer on ${q.id}`);
        if (!seen.has(q.id))
          assert.equal(answered, false, `${where}: answer on hidden ${q.id}`);
      }
    }
  }
});

// The score of every solution: the sum of the points of the rules whose conditions are all true
// (a condition on a hidden or unanswered question is false), by the description of the conditions.
function scores(tenant, answers) {
  const seen = visibleQuestionIds(tenant, answers);
  const holds = (c) => {
    if (!seen.has(c.question) || !Object.hasOwn(answers, c.question))
      return false;
    const v = answers[c.question];
    const chosen = Array.isArray(v) ? v : [v];
    if (c.any_of) return chosen.some((x) => c.any_of.includes(x));
    if (c.none_of) return !chosen.some((x) => c.none_of.includes(x));
    return (
      (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max)
    );
  };
  const total = Object.fromEntries(tenant.solutions.map((s) => [s.id, 0]));
  for (const r of tenant.rules)
    if (r.when.every(holds)) total[r.solution] += r.points;
  return total;
}

test("PK-1f: the three sets of each tenant give the outcomes of design 9.4 - a clear leader, close variants and nothing suitable (scores counted by the test)", () => {
  const want = {
    "uchet-pro": {
      leader: {
        "sheet-start": 15,
        "shop-kit": 8,
        "order-check": 1,
        "warehouse-docs": 0,
        "chain-control": -2,
      },
      close: {
        "chain-control": 11,
        "shop-kit": 9,
        "warehouse-docs": 2,
        "order-check": 0,
        "sheet-start": -4,
      },
      none: {
        "sheet-start": 7,
        "warehouse-docs": 4,
        "shop-kit": 2,
        "chain-control": 0,
        "order-check": 0,
      },
    },
    "svet-marketing": {
      leader: {
        "quick-start": 12,
        "content-month": 8,
        "site-booking": 3,
        "guest-return": 0,
        "ads-launch": -4,
      },
      close: {
        "content-month": 13,
        "guest-return": 11,
        "ads-launch": 3,
        "site-booking": 3,
        "quick-start": 2,
      },
      none: {
        "quick-start": 6,
        "content-month": 0,
        "ads-launch": 0,
        "guest-return": 0,
        "site-booking": -1,
      },
    },
  };
  for (const id of IDS) {
    const tenant = readJson(tenantPath(id));
    const sets = readJson(path.join(DEMO_ANSWERS, `${id}.json`));
    for (const name of ["leader", "close", "none"]) {
      assert.deepEqual(
        scores(tenant, sets[name]),
        want[id][name],
        `${id}/${name}`,
      );
    }
    const { min_score: min, clear_lead_gap: gap } = tenant.result;
    const ranked = (name) =>
      Object.entries(want[id][name])
        .sort((x, y) => y[1] - x[1])
        .filter(([, v]) => v >= min);
    assert.ok(
      ranked("leader").length >= 1 &&
        ranked("leader")[0][1] - (ranked("leader")[1]?.[1] ?? 0) >= gap,
      `${id}: leader`,
    );
    assert.ok(
      ranked("close").length >= 2 &&
        ranked("close")[0][1] - ranked("close")[1][1] < gap,
      `${id}: close`,
    );
    assert.equal(ranked("none").length, 0, `${id}: none`);
  }
});

test("PK-1e: validateTenant gives nothing for both tenants with their file names, and the id is the name of the file", () => {
  for (const id of IDS) {
    const tenant = readJson(tenantPath(id));
    assert.deepEqual(validateTenant(tenant, { fileName: `${id}.json` }), []);
    assert.equal(tenant.id, id);
    assert.deepEqual(
      validateTenant(tenant, { fileName: `${id}-copy.json` }).map(
        (i) => i.code,
      ),
      ["E_ID"],
      "another file name is an E_ID",
    );
  }
});

// ---------------------------------------------------------------------- PK-2

test("PK-2a: the samples of E_FIELD, E_ID, E_DUP and E_LIMIT give code 1 and exactly the lines of the table, in order, with nothing in stderr", () => {
  const names = named(["e-field-", "e-id-", "e-dup-", "e-limit-"]);
  assert.equal(names.length, 17);
  for (const name of names) assertSample(name);
});

test("PK-2b: the borders are accepted - 30 questions, a title of 200, 8 options, points 10, -10 and 1, 365 days and 1 day", () => {
  assertSample("ok-bounds.json");
  assertSample("ok-retention-1.json");
  assertSample("ok-minimal.json");
  // the sample really sits on the borders it names
  const t = JSON.parse(fixtureBytes("ok-bounds.json").toString("utf8"));
  assert.equal(t.questions.length, 30);
  assert.equal([...t.questions[0].title].length, 200);
  assert.equal(t.questions[1].options.length, 8);
  assert.deepEqual(
    t.rules.map((r) => r.points),
    [10, -10, 1],
  );
  assert.equal(t.leads.retention_days, 365);
});

// ---------------------------------------------------------------------- PK-3

test("PK-3a: a link to a missing question, option or solution names the place and the wrong id", () => {
  const cases = [
    ["e-ref-question.json", "questions[1].show_if[0].question", "nope"],
    ["e-ref-option.json", "questions[1].show_if[0].any_of[0]", "water"],
    ["e-ref-solution.json", "rules[2].solution", "nothing"],
    ["e-ref-when-question.json", "rules[2].when[0].question", "nope"],
  ];
  for (const [name, place, wrong] of cases) {
    assertSample(name);
    const [line] = sample(name).out;
    assert.ok(line.startsWith(`${name}: ${place}: E_REF: `), line);
    assert.ok(line.includes(` ${wrong} `), line);
  }
});

test("PK-3b: E_ORDER stands only on the condition that looks at itself or forward; in a cycle of two questions it is one line", () => {
  for (const name of [
    "e-order-self.json",
    "e-order-later.json",
    "e-order-cycle.json",
  ]) {
    assertSample(name);
    assert.equal(sample(name).out.length, 1, name);
    assert.match(sample(name).out[0], /: E_ORDER: /u);
  }
  // the look back of the same two questions is not an error
  const cycle = JSON.parse(fixtureBytes("e-order-cycle.json").toString("utf8"));
  assert.equal(cycle.questions[0].show_if[0].question, "extras");
  assert.equal(cycle.questions[1].show_if[0].question, "kind");
});

test("PK-3c: a condition of two kinds, of no kind, any_of on a number and min on a single", () => {
  for (const name of [
    "e-cond-two-kinds.json",
    "e-cond-no-kind.json",
    "e-cond-any-of-number.json",
    "e-cond-min-single.json",
  ]) {
    assertSample(name);
    assert.match(sample(name).out[0], /: E_COND: /u);
  }
});

test("PK-3d: a solution without a rule of positive points is unreachable, though a rule with negative points points at it", () => {
  assertSample("e-unreachable.json");
  const t = JSON.parse(fixtureBytes("e-unreachable.json").toString("utf8"));
  assert.deepEqual(
    t.rules.filter((r) => r.solution === "van").map((r) => r.points),
    [-2],
  );
});

// ---------------------------------------------------------------------- PK-4

test("PK-4a: five mistakes in one file - exactly five lines, in the order of their places", () => {
  assertSample("e-five-errors.json");
  assert.equal(sample("e-five-errors.json").out.length, 5);
});

test("PK-4b: the order of the lines is the order of the places in the file, not the order of the search", () => {
  assertSample("e-sort-order.json");
  const places = sample("e-sort-order.json").out.map((l) => l.split(": ")[1]);
  assert.deepEqual(places, [
    "solutions[1]",
    "rules[0].solution",
    "leads.retention_days",
  ]);
});

test("PK-4c: 150 mistakes - 100 lines and 'И ещё ошибок: 50.', code 1", () => {
  assertSample("e-many-errors-150.json");
  const r = sample("e-many-errors-150.json");
  assert.equal(r.out.length, 101);
  assert.equal(r.out[100], "И ещё ошибок: 50.");
  assert.equal(r.out[0].split(": ")[1], "rules[2].points");
  assert.equal(r.out[99].split(": ")[1], "rules[101].points");
});

test("PK-4d: a file that is not JSON or not UTF-8 gives one line E_JSON with 'строка L, знак C'", () => {
  const names = named(["e-json-"]);
  assert.equal(names.length, 5);
  for (const name of names) {
    assertSample(name);
    assert.equal(sample(name).out.length, 1, name);
    assert.match(
      sample(name).out[0],
      /^[^:]+: строка \d+, знак \d+: E_JSON: /u,
    );
  }
});

test("PK-4e: every line of every output - and every refusal of code 2 - has the shape of design 6.1: the file, the place, a code of the ten, a text of 18 words at most, no 'ты', no word of a parser, no line of a stack", (t) => {
  for (const name of SAMPLE_NAMES) {
    const r = sample(name);
    if (r.code === 1) assert.deepEqual(lineProblems(r.out), [], name);
    else assert.equal(r.out.length, 1, name);
  }
  const tmp = makeTmp(t);
  fs.mkdirSync(path.join(tmp, "dir"));
  const refusals = [
    [],
    ["no-such-command"],
    ["check"],
    ["check", "a.json", "b.json"],
    ["check", "--x"],
    ["check", path.join(tmp, "missing.json")],
    ["check", path.join(tmp, "dir")],
    ["check", ""],
    ["toString"],
  ];
  for (const args of refusals) {
    const r = runPicker(args);
    assert.equal(r.code, 2, JSON.stringify(args));
    assert.deepEqual(r.out, [], JSON.stringify(args));
    assert.deepEqual(refusalProblems(r.err), [], JSON.stringify(args));
  }
});

test("PK-4f: all ten codes stand in the outputs of the samples and no other code", () => {
  const seen = new Set();
  for (const name of SAMPLE_NAMES) {
    for (const line of sample(name).out) {
      const code = line.split(": ")[2];
      if (code !== undefined && /^E_/u.test(code)) seen.add(code);
    }
  }
  assert.deepEqual([...seen].sort(), [...ERROR_CODES].sort());
});

// ---------------------------------------------------------------------- PK-5

test("PK-5a: a phrase of 19 words in ten fields gives ten lines E_TEXT with their places", () => {
  assertSample("e-text-long-all.json");
  const places = sample("e-text-long-all.json").out.map(
    (l) => l.split(": ")[1],
  );
  assert.deepEqual(places, [
    "intro",
    "questions[0].title",
    "questions[0].options[0].label",
    "questions[1].help",
    "solutions[0].summary",
    "solutions[0].includes[0]",
    "rules[0].text",
    "hypotheses[0].explanation",
    "result.no_match_text",
    "leads.consent_text",
  ]);
});

test("PK-5b: the edges of the rule pass - 18 words with a dash, 'вы получите' style texts, three phrases of 10 words, 'цветы' and 'тыква', 200 characters made of 50 emoji, spaces at the ends", () => {
  assertSample("ok-text-edges.json");
  const t = JSON.parse(fixtureBytes("ok-text-edges.json").toString("utf8"));
  assert.equal([...t.questions[2].title].length, 200);
  assert.equal(t.questions[2].title.length, 250);
  assert.equal(t.questions[3].title.trim().length, 200);
  assert.ok(
    t.questions[3].title.startsWith(" ") && t.questions[3].title.endsWith(" "),
  );
  assert.ok(t.intro.includes(" — "));
  assert.match(t.questions[0].title, /Цветы и тыква/u);
});

test("PK-5c: a dot inside '1.5' does not cut a phrase (19 words stay 19), and 'Ты' and 'Твой' break the form 'вы' in the order of the file", () => {
  assertSample("e-text-inner-dot.json");
  assertSample("e-text-ty.json");
  assert.equal(sample("e-text-ty.json").out.length, 2);
});

// ---------------------------------------------------------------------- PK-6

test("PK-6a: a wrong call or a file that cannot be read - code 2, stdout empty, one line 'picker: …' in stderr with the exact texts, no stack", (t) => {
  const dir = makeTmp(t);
  fs.mkdirSync(path.join(dir, "folder"));
  const SEE = "Справка: npm run picker -- --help";
  const cases = [
    [[], `picker: Не указана команда. Доступна: check. ${SEE}`],
    [
      ["no-such-command"],
      `picker: Неизвестная команда no-such-command. Доступна: check. ${SEE}`,
    ],
    [
      ["toString"],
      `picker: Неизвестная команда toString. Доступна: check. ${SEE}`,
    ],
    [
      ["constructor"],
      `picker: Неизвестная команда constructor. Доступна: check. ${SEE}`,
    ],
    [
      ["__proto__"],
      `picker: Неизвестная команда __proto__. Доступна: check. ${SEE}`,
    ],
    [["--x"], `picker: Неизвестная команда --x. Доступна: check. ${SEE}`],
    [
      ["check"],
      "picker: Не указан файл. Пример: npm run picker -- check <файл>",
    ],
    [["check", "--x"], `picker: Неизвестный ключ --x. ${SEE}`],
    [
      ["check", "a.json", "b.json"],
      "picker: Лишний аргумент b.json. Проверяется один файл за раз.",
    ],
    [
      ["check", ""],
      "picker: Путь к файлу пустой или с недопустимым знаком. Проверьте путь.",
    ],
    [
      ["check", path.join(dir, "missing.json")],
      "picker: Файл не найден: missing.json. Проверьте путь.",
    ],
    [
      ["check", path.join(dir, "folder")],
      "picker: folder — папка, а не файл. Укажите файл арендатора.",
    ],
  ];
  for (const [args, want] of cases) {
    const r = runPicker(args);
    assert.equal(r.code, 2, JSON.stringify(args));
    assert.equal(r.stdout, "", JSON.stringify(args));
    assert.deepEqual(r.err, [want], JSON.stringify(args));
    assert.doesNotMatch(r.stderr, / {4}at /u);
  }
});

test("PK-6f: what the person typed is shown tamed in a refusal - spaces and controls become '_', a long word is cut to 40 signs with '…', a word of the form 'ты' is hidden", () => {
  const SEE = "Справка: npm run picker -- --help";
  const cases = [
    [["a b"], `picker: Неизвестная команда a_b. Доступна: check. ${SEE}`],
    [["ты"], `picker: Неизвестная команда (скрыто). Доступна: check. ${SEE}`],
    [
      ["x".repeat(60)],
      `picker: Неизвестная команда ${"x".repeat(40)}…. Доступна: check. ${SEE}`,
    ],
    [["check", "--k l"], `picker: Неизвестный ключ --k_l. ${SEE}`],
    [
      ["check", `--${"y".repeat(60)}`],
      `picker: Неизвестный ключ --${"y".repeat(38)}…. ${SEE}`,
    ],
    [
      ["check", "a.json", "b c.json"],
      "picker: Лишний аргумент b_c.json. Проверяется один файл за раз.",
    ],
    [
      ["check", "a.json", "твой"],
      "picker: Лишний аргумент (скрыто). Проверяется один файл за раз.",
    ],
    [
      ["check", "a.json", "z\tz"],
      "picker: Лишний аргумент z_z. Проверяется один файл за раз.",
    ],
  ];
  for (const [args, want] of cases) {
    const r = runPicker(args);
    assert.equal(r.code, 2, JSON.stringify(args));
    assert.deepEqual(r.err, [want], JSON.stringify(args));
  }
});

test("PK-6b: the file is only read - with codes 0, 1 and 2 the digest and the time of the file and the list of its folder stay as they were", (t) => {
  const dir = makeTmp(t);
  const big = Buffer.alloc(524289, 0x20);
  const files = [
    put(dir, "ok-minimal.json", fixtureBytes("ok-minimal.json")),
    put(dir, "e-five-errors.json", fixtureBytes("e-five-errors.json")),
    put(dir, "e-json-utf8.txt", fixtureBytes("e-json-utf8.txt")),
    put(dir, "too-big.json", big),
  ];
  const before = files.map(fileDigest);
  const codes = files.map((file) => runPicker(["check", file]).code);
  assert.deepEqual(codes, [0, 1, 1, 2]);
  assert.deepEqual(files.map(fileDigest), before);
  // a relative path from the folder of the file, the same
  const rel = runPicker(["check", "ok-minimal.json"], { cwd: dir });
  assert.equal(rel.code, 0);
  assert.deepEqual(files.map(fileDigest), before);
});

test("PK-6c: a link to a sample - code 2; a pipe - code 2 and no hang; a file of 524288 bytes is read, one of 524289 is refused; npm and node give the same output", (t) => {
  const dir = makeTmp(t);
  const real = put(dir, "ok-minimal.json", fixtureBytes("ok-minimal.json"));
  const link = path.join(dir, "link.json");
  fs.symlinkSync(real, link);
  const viaLink = runPicker(["check", link]);
  assert.equal(viaLink.code, 2);
  assert.deepEqual(viaLink.err, [
    "picker: link.json — ссылка. Укажите сам файл, а не ссылку.",
  ]);
  const pipe = path.join(dir, "pipe.json");
  assert.equal(spawnSync("mkfifo", [pipe]).status, 0);
  const p = runPicker(["check", pipe]);
  assert.equal(p.signal, null, "no hang");
  assert.equal(p.code, 2);
  assert.deepEqual(p.err, [
    "picker: pipe.json — не обычный файл. Укажите файл арендатора.",
  ]);
  // the sizes: a file of exactly 524288 bytes is not refused for its size
  const pad = (n) =>
    Buffer.concat([Buffer.from("{}"), Buffer.alloc(n - 2, 0x20)]);
  const exact = put(dir, "exact.json", pad(524288));
  const over = put(dir, "over.json", pad(524289));
  const a = runPicker(["check", exact]);
  assert.equal(a.code, 1);
  assert.ok(
    a.out.length >= 1 && a.out.every((l) => l.startsWith("exact.json: ")),
    a.stdout,
  );
  assert.deepEqual(a.err, []);
  const b = runPicker(["check", over]);
  assert.equal(b.code, 2);
  assert.deepEqual(b.err, [
    "picker: Файл over.json больше 512 КБ. Сократите его.",
  ]);
  assert.equal(b.stdout, "");
  // npm and node: the same output
  for (const args of [
    ["check", fixture("ok-minimal.json")],
    ["check", fixture("e-five-errors.json")],
    ["check", over],
    ["--help"],
    [],
  ]) {
    const viaNpm = runPicker(args, { viaNpm: true });
    const direct = runPicker(args);
    assert.deepEqual(
      [viaNpm.code, viaNpm.stdout, viaNpm.stderr],
      [direct.code, direct.stdout, direct.stderr],
      JSON.stringify(args),
    );
  }
});

test("PK-6d: --help gives code 0 and the help of design 7.3, also with other arguments", () => {
  const help = [
    "Использование: npm run picker -- <команда> [аргументы]",
    "Команды:",
    "  check <файл>   проверить файл арендатора; файл только читается",
    "Коды выхода check: 0 — в порядке; 1 — найдены ошибки; 2 — неверный вызов или файл нельзя прочитать.",
  ];
  for (const args of [
    ["--help"],
    ["check", "--help"],
    ["check", "a", "b", "--help"],
    ["nothing", "--help"],
  ]) {
    const r = runPicker(args);
    assert.equal(r.code, 0, JSON.stringify(args));
    assert.deepEqual(r.out, help, JSON.stringify(args));
    assert.deepEqual(r.err, []);
  }
});

const WRITING = [
  "writeFile",
  "appendFile",
  "mkdir",
  "rename",
  "unlink",
  "rmSync",
  "copyFile",
  "truncate",
  "chmod",
  "utimes",
  "createWriteStream",
  "O_WRONLY",
  "O_RDWR",
  "O_CREAT",
];
const pickerSources = () =>
  fs
    .readdirSync(PICKER)
    .filter((f) => f.endsWith(".js"))
    .map((f) => [f, fs.readFileSync(path.join(PICKER, f), "utf8")]);

test("PK-6e: no call or word of writing in the code of the picker (comments count)", () => {
  const files = pickerSources();
  assert.deepEqual(files.map(([f]) => f).sort(), [...ALL_MODULES].sort());
  for (const [file, text] of files) {
    for (const word of WRITING) {
      assert.equal(
        new RegExp(`\\b${word}`, "u").test(text),
        false,
        `${file}: ${word}`,
      );
    }
  }
});

// ---------------------------------------------------------------------- PK-7

test("PK-7a: no network, no process, no random number anywhere in the code of the picker (the search of the criterion, comments count)", () => {
  const re =
    /fetch[(]|https?[.]request|node:net|node:dgram|child_process|Math[.]random/u;
  for (const [file, text] of pickerSources())
    assert.doesNotMatch(text, re, file);
});

test("PK-7b: package.json - the script picker right after handoff, check as it was, no dependencies, the four development ones with their versions", () => {
  const pkg = readJson(path.join(TOOLS, "package.json"));
  assert.equal(pkg.scripts.picker, "node src/picker/cli.js");
  const keys = Object.keys(pkg.scripts);
  assert.equal(keys.indexOf("picker"), keys.indexOf("handoff") + 1);
  assert.equal(
    pkg.scripts.check,
    "npm run format:check && npm run lint && npm run traces && npm run handoffs-check && npm run test",
  );
  assert.equal(Object.hasOwn(pkg, "dependencies"), false);
  assert.deepEqual(pkg.devDependencies, {
    "@eslint/js": "10.0.1",
    eslint: "10.11.0",
    globals: "17.12.0",
    prettier: "3.9.9",
  });
});

test("PK-7c: only load.js imports a node: module", () => {
  for (const [file, text] of pickerSources()) {
    const imports = /node:/u.test(text);
    assert.equal(imports, file === "load.js", file);
  }
  assert.equal(CORE_MODULES.length, 11);
  const load = fs.readFileSync(path.join(PICKER, "load.js"), "utf8");
  const wanted = [...load.matchAll(/from "(node:[a-z]+)"/gu)]
    .map((m) => m[1])
    .sort();
  assert.deepEqual(wanted, ["node:fs", "node:path"]);
});

// ---------------------------------------------------------------------- PK-8

test("PK-8a: a tenant is checked alone - beside a file with mistakes it still gives code 0", (t) => {
  const dir = makeTmp(t);
  const mine = put(
    dir,
    "uchet-pro.json",
    fs.readFileSync(tenantPath("uchet-pro")),
  );
  put(dir, "e-field-extra-top.json", fixtureBytes("e-field-extra-top.json"));
  put(dir, "broken.txt", fixtureBytes("e-json-utf8.txt"));
  const r = runPicker(["check", mine]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.out, [
    "Файл арендатора uchet-pro в порядке: вопросов 12, решений 5, правил 39.",
  ]);
  assert.deepEqual(r.err, []);
});

test("PK-8b: the id is compared with the name of the file only, not with its neighbours - a file named like the id of its neighbour gets E_ID", (t) => {
  const dir = makeTmp(t);
  const first = put(
    dir,
    "other-name.json",
    fs
      .readFileSync(fixture("ok-minimal.json"), "utf8")
      .replace("ok-minimal", "other-name"),
  );
  const second = put(
    dir,
    "e-id-file-mismatch.json",
    fixtureBytes("e-id-file-mismatch.json"),
  );
  assert.equal(runPicker(["check", first]).code, 0);
  const r = runPicker(["check", second]);
  assert.equal(r.code, 1);
  assert.deepEqual(r.out, EXPECTED["e-id-file-mismatch.json"].lines);
});

test("PK-8c: the code never lists a folder", () => {
  for (const [file, text] of pickerSources()) {
    assert.doesNotMatch(text, /readdir|opendir|glob/u, file);
  }
});

function listFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? listFiles(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}

test("PK-8d: no test is left out or marked as to be written and no path of this computer in the new files", () => {
  // the words are put together, so that this file does not hold them itself
  const banned = new RegExp(
    [`[.]${"sk"}${"ip"}[(]`, `[{] ?${"sk"}${"ip"}`, `${"to"}${"do"}`].join("|"),
    "u",
  );
  const tests = fs
    .readdirSync(path.join(TOOLS, "test"))
    .filter((f) => /^picker-.*\.js$/u.test(f))
    .map((f) => path.join(TOOLS, "test", f));
  assert.ok(tests.length >= 5);
  for (const file of tests)
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), banned, file);
  const all = [...tests, ...listFiles(PICKER), ...listFiles(FIXTURES)];
  assert.ok(all.length >= 60);
  for (const file of all) {
    const buffer = fs.readFileSync(file);
    if (buffer.includes(0)) continue;
    buffer
      .toString("utf8")
      .split("\n")
      .forEach((line, i) =>
        assert.equal(hasHomePath(line), false, `${file}:${i + 1}`),
      );
  }
});

test("PK-8e: the samples are the 44 of design section 10 and each stands with its exact output", () => {
  assert.equal(SAMPLE_NAMES.length, 44);
  assert.deepEqual(fs.readdirSync(FIXTURES).sort(), [...SAMPLE_NAMES].sort());
  for (const name of SAMPLE_NAMES) {
    if (name.endsWith(".txt")) continue;
    const text = fs.readFileSync(fixture(name), "utf8");
    assert.ok(text.endsWith("\n"), `${name}: a final newline`);
    const t = JSON.parse(text);
    const stem = name.replace(/[.]json$/u, "");
    if (!["e-id-capital", "e-id-file-mismatch"].includes(stem))
      assert.equal(t.id, stem, name);
  }
});
