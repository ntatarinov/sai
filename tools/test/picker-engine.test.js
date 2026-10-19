// PE-0 ... PE-8: the picker engine (design docs/design/REQ-055-picker-engine.md, section 11):
// which questions are seen, the errors of the answers, the points and the order, the mark
// "clear leader", the words of the result and one tenant per call. The small tenant
// `pico` and its answers are literals of the test; the expectations are written here by
// hand, not taken from the engine.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  ANSWER_REASONS,
  computeResult,
  resolveAnswers,
  visibleQuestions,
} from "../src/picker/engine.js";
import { validateTenant } from "../src/picker/validate.js";
import { ALL_MODULES, PICKER, visibleQuestionIds } from "./picker-helpers.js";
import {
  DEMO_IDS,
  NUMBER_PATHS,
  allStrings,
  deepCopy,
  deepFreeze,
  demoAnswers,
  demoPlain,
  demoTenant,
  noProto,
  numbersIn,
  pico,
  picoReversedRules,
  withSettings,
} from "./picker-engine-helpers.js";

const ENGINE = path.join(PICKER, "engine.js");
const OK = { a: "a1", b: ["b1"], c: 5, d: "d1" };
// Both forms of the small tenant: a plain object and the one the reader makes.
const FORMS = [
  ["plain", () => pico()],
  ["no prototype", () => noProto(pico())],
];

const ranked = (result) =>
  result.ranking.map((e) => `${e.solution} ${e.score}`);
const ids = (list) => list.map((x) => x.id);

// ---------------------------------------------------------------------- PE-0

test("PE-0: the small tenant and its copies with other settings are good files for the check of REQ-054", () => {
  assert.deepEqual(validateTenant(pico()), []);
  assert.deepEqual(validateTenant(pico(), { fileName: "pico-test.json" }), []);
  assert.deepEqual(
    validateTenant(noProto(pico()), { fileName: "pico-test.json" }),
    [],
  );
  for (const settings of [
    { top: 2 },
    { top: 1 },
    { min_score: 4 },
    { min_score: 6 },
    { clear_lead_gap: 1 },
    { clear_lead_gap: 3 },
  ]) {
    assert.deepEqual(
      validateTenant(withSettings(pico(), settings), {
        fileName: "pico-test.json",
      }),
      [],
    );
  }
  const bare = pico();
  delete bare.hypotheses;
  for (const s of bare.solutions) {
    delete s.price_text;
    delete s.duration_text;
  }
  assert.deepEqual(validateTenant(bare, { fileName: "pico-test.json" }), []);
  // the nine words
  assert.deepEqual(
    [...ANSWER_REASONS],
    [
      "not_object",
      "unknown_question",
      "wrong_kind",
      "unknown_option",
      "duplicate_option",
      "empty_list",
      "not_integer",
      "out_of_range",
      "missing_required",
    ],
  );
  assert.equal(Object.isFrozen(ANSWER_REASONS), true);
  // the texts of the small tenant are all different, so that a field in place of another is seen
  const texts = [];
  const walk = (v) => {
    if (typeof v === "string") texts.push(v);
    else if (v !== null && typeof v === "object")
      Object.values(v).forEach(walk);
  };
  const t = pico();
  for (const key of ["name", "intro"]) texts.push(t[key]);
  for (const s of t.solutions)
    walk([
      s.name,
      s.summary,
      s.includes,
      s.needs_from_you,
      s.next_steps,
      s.not_suitable_when,
      s.price_text ?? "",
      s.duration_text ?? "",
    ]);
  for (const r of t.rules) texts.push(r.text);
  for (const h of t.hypotheses) texts.push(h.title, h.explanation);
  const real = texts.filter((x) => x !== "");
  assert.equal(new Set(real).size, real.length);
});

// ---------------------------------------------------------------------- PE-1

const VISIBLE = [
  ["V1", {}, "a b c"],
  ["V2", { a: "a1" }, "a b c d"],
  ["V3", { a: "a1", d: "d1" }, "a b c d g"],
  ["V4", { a: "a3" }, "a b c"],
  ["V5", { a: "a2", d: "d2" }, "a b c d"],
  ["V6", { b: ["b1"] }, "a b c"],
  ["V7", { b: ["b2"] }, "a b c e"],
  ["V8", { b: ["b1", "b2"] }, "a b c"],
  ["V9", { c: 9 }, "a b c"],
  ["V10", { c: 10 }, "a b c f"],
  ["V11", { c: 20 }, "a b c f"],
  ["V12", { c: 21 }, "a b c"],
  ["V13", { a: "a3", g: "g1" }, "a b c"],
  ["V14", { a: "a3", d: "d1", g: "g1" }, "a b c"],
  ["V15", { a: "a2", c: 50 }, "a b c d h"],
  ["V16", { a: "a1", c: 50 }, "a b c d"],
  ["V17", { a: "a3", c: 49 }, "a b c"],
  ["V18", { a: "a1", b: ["b2"], c: 15, d: "d1" }, "a b c d e f g"],
  ["V19", { c: 0 }, "a b c"],
  ["V20", { c: 100 }, "a b c"],
];

test("PE-1a: the visible questions for 20 combinations of answers equal the list written in the test - an unanswered question hides what depends on it (also none_of), the borders of a range are in, all conditions are needed, a cascade, an answer to a hidden question opens nothing", () => {
  assert.ok(VISIBLE.length >= 12);
  for (const [label, answers, want] of VISIBLE) {
    for (const [form, make] of FORMS) {
      assert.deepEqual(
        visibleQuestions(make(), answers).join(" "),
        want,
        `${label} (${form})`,
      );
    }
  }
});

test("PE-1b: the same 20 answers through the oracle of the tests; the engine reads only the list of questions; a null and a wrong answer do not throw and open nothing", () => {
  for (const [label, answers, want] of VISIBLE) {
    // the oracle gives a set: it is put in a list for the comparison
    assert.equal(
      Array.from(visibleQuestionIds(pico(), answers)).join(" "),
      want,
      label,
    );
  }
  const tenant = pico();
  for (const [label, answers] of VISIBLE) {
    assert.deepEqual(
      visibleQuestions({ questions: tenant.questions }, answers),
      visibleQuestions(tenant, answers),
      label,
    );
  }
  assert.deepEqual(visibleQuestions(tenant, null), ["a", "b", "c"]);
  assert.deepEqual(visibleQuestions(tenant, []), ["a", "b", "c"]);
  assert.deepEqual(visibleQuestions(tenant, "text"), ["a", "b", "c"]);
  assert.deepEqual(visibleQuestions(tenant, { a: "zzz", c: "x", d: "d1" }), [
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(visibleQuestions(tenant, { a: ["a1"], zz: 1 }), [
    "a",
    "b",
    "c",
  ]);
  // the answers to a hidden question are not read for the form
  assert.deepEqual(visibleQuestions(tenant, { a: "a3", d: "zzz", g: 7 }), [
    "a",
    "b",
    "c",
  ]);
  // a good answer after a wrong one: the wrong one is as if missing, the rest are looked at
  assert.deepEqual(visibleQuestions(tenant, { a: "a1", d: "zzz", g: "g1" }), [
    "a",
    "b",
    "c",
    "d",
  ]);
});

// ---------------------------------------------------------------------- PE-2

const BAD = (changes) => ({ ...OK, ...changes });
const ERRORS = [
  ["E1", { ...OK, zz: 1 }, "zz", "unknown_question"],
  ["E2", BAD({ a: "a9" }), "a", "unknown_option"],
  ["E3", BAD({ b: ["b1", "b1"] }), "b", "duplicate_option"],
  ["E3b", BAD({ b: ["b1", "b2", "b1"] }), "b", "duplicate_option"],
  ["E3c", BAD({ b: ["b1", "b2", "b3", "b2"] }), "b", "duplicate_option"],
  ["E4", BAD({ b: [] }), "b", "empty_list"],
  ["E5a", BAD({ c: 2.5 }), "c", "not_integer"],
  ["E5b", BAD({ c: JSON.parse("1e400") }), "c", "not_integer"],
  ["E5c", BAD({ c: 2 ** 53 }), "c", "not_integer"],
  ["E6a", BAD({ c: 101 }), "c", "out_of_range"],
  ["E6b", BAD({ c: -1 }), "c", "out_of_range"],
  ["E7a", BAD({ b: "b1" }), "b", "wrong_kind"],
  ["E7b", BAD({ a: ["a1"] }), "a", "wrong_kind"],
  ["E7c", BAD({ c: "5" }), "c", "wrong_kind"],
  ["E7d", BAD({ a: null }), "a", "wrong_kind"],
  ["E7e", BAD({ b: [1] }), "b", "wrong_kind"],
  ["E7f", BAD({ c: true }), "c", "wrong_kind"],
  ["E7g", BAD({ a: {} }), "a", "wrong_kind"],
  ["E7h", BAD({ c: [5] }), "c", "wrong_kind"],
  ["E8", { a: "a1", b: ["b1"], d: "d1" }, "c", "missing_required"],
  ["E9", { a: "a1", b: ["b1"], c: 5 }, "d", "missing_required"],
  ["E10", { ...OK, zz: 1, aa: 2, c: 500 }, "aa", "unknown_question"],
  ["E11", BAD({ a: "a9", c: 500 }), "a", "unknown_option"],
  ["E12", JSON.parse('{"__proto__":{}}'), "__proto__", "unknown_question"],
  ["E13", BAD({ b: ["b1", "b9", "b1"] }), "b", "unknown_option"],
  ["E13b", BAD({ b: ["zz"] }), "b", "unknown_option"],
  ["E13c", BAD({ b: ["b1", "zz"] }), "b", "unknown_option"],
  ["E14", BAD({ b: ["b1", "b1", "b9"] }), "b", "duplicate_option"],
  ["E15a", null, null, "not_object"],
  ["E15b", [], null, "not_object"],
  ["E15c", "a", null, "not_object"],
  ["E15d", 5, null, "not_object"],
  ["E15e", true, null, "not_object"],
  ["E15f", undefined, null, "not_object"],
];

test("PE-2a: every case of an answer error gives ok false, the code E_ANSWER, the question and the reason of the table, no result, no exception; resolveAnswers gives the same error", () => {
  assert.ok(ERRORS.length >= 15);
  const seen = new Set();
  for (const [form, make] of FORMS) {
    const tenant = make();
    for (const [label, answers, question, reason] of ERRORS) {
      const want = { code: "E_ANSWER", question, reason };
      const out = computeResult(tenant, answers);
      assert.equal(out.ok, false, `${label} ${form}`);
      assert.deepEqual(out.error, want, `${label} ${form}`);
      assert.equal(Object.hasOwn(out, "result"), false, `${label}: no result`);
      assert.deepEqual(Object.keys(out), ["ok", "error"]);
      const resolved = resolveAnswers(tenant, answers);
      assert.equal(resolved.ok, false);
      assert.deepEqual(resolved.error, want, `${label} resolve`);
      assert.equal(Object.hasOwn(resolved, "visible"), false);
      seen.add(reason);
    }
  }
  assert.deepEqual(
    [...seen].sort(),
    [...ANSWER_REASONS].sort(),
    "all nine reasons",
  );
  // the answers that are good give ok true
  const good = computeResult(pico(), OK);
  assert.equal(good.ok, true);
  assert.equal(Object.hasOwn(good, "error"), false);
});

test("PE-2b: the tenant and the answers are not changed - a deep comparison with a copy and calls on deeply frozen objects, for all three functions, also on answers with mistakes", () => {
  const cases = [
    OK,
    { a: "a2", b: ["b3", "b1"], c: 15, d: "d1", g: "g1" },
    ...ERRORS.map((e) => e[1]),
  ].filter((x) => x !== undefined);
  for (const [form, make] of FORMS) {
    const tenant = make();
    const tenantCopy = deepCopy(tenant);
    for (const answers of cases) {
      const copy = deepCopy(answers);
      for (const fn of [visibleQuestions, resolveAnswers, computeResult]) {
        fn(tenant, answers);
        assert.deepEqual(answers, copy, `${fn.name} ${form}: answers`);
        assert.deepEqual(tenant, tenantCopy, `${fn.name} ${form}: tenant`);
      }
    }
    // on frozen objects: a change would throw
    const frozenTenant = deepFreeze(make());
    for (const answers of cases) {
      const frozen = deepFreeze(deepCopy(answers));
      for (const fn of [visibleQuestions, resolveAnswers, computeResult]) {
        assert.doesNotThrow(
          () => fn(frozenTenant, frozen),
          `${fn.name} ${form}`,
        );
      }
    }
  }
  // a list of multiple in the order that is not the order of the options: still not sorted in place
  const list = ["b3", "b1", "b2"];
  computeResult(pico(), { ...OK, b: list });
  assert.deepEqual(list, ["b3", "b1", "b2"]);
});

test("PE-2c: an answer to a hidden question is no error and gives no points - the result is byte for byte the same as without it; rubbish in a hidden answer and a hidden required question without an answer are no mistakes", () => {
  const same = (withIt, without) => {
    const a = computeResult(pico(), withIt);
    const b = computeResult(pico(), without);
    assert.equal(a.ok, true, JSON.stringify(withIt));
    assert.equal(JSON.stringify(a), JSON.stringify(b), JSON.stringify(withIt));
    assert.equal(
      JSON.stringify(resolveAnswers(pico(), withIt)),
      JSON.stringify(resolveAnswers(pico(), without)),
    );
  };
  same(
    { a: "a1", b: ["b1"], c: 0, d: "d2", g: "g1" },
    { a: "a1", b: ["b1"], c: 0, d: "d2" },
  );
  same({ a: "a3", b: ["b1"], c: 5, d: "d1" }, { a: "a3", b: ["b1"], c: 5 });
  same(
    { a: "a1", b: ["b1"], c: 5, d: "d1", e: "e1" },
    { a: "a1", b: ["b1"], c: 5, d: "d1" },
  );
  same(
    { a: "a3", b: ["b1"], c: 5, d: "d1", g: "g1" },
    { a: "a3", b: ["b1"], c: 5 },
  );
  for (const answers of [
    { a: "a3", b: ["b1"], c: 5, d: "zzz" },
    { a: "a3", b: ["b1"], c: 5, g: 7, h: [] },
    { a: "a3", b: ["b1"], c: 5 },
    { a: "a3", b: ["b1"], c: 5, d: null, e: {}, f: [[]], g: 2.5, h: "x" },
  ]) {
    assert.equal(
      computeResult(pico(), answers).ok,
      true,
      JSON.stringify(answers),
    );
    assert.equal(resolveAnswers(pico(), answers).ok, true);
  }
  // the points of the hidden answer do not count: g1 at d2 would give sol-m 7
  const out = computeResult(pico(), {
    a: "a1",
    b: ["b1"],
    c: 0,
    d: "d2",
    g: "g1",
  });
  assert.deepEqual(ranked(out.result), [
    "sol-m 6",
    "sol-b 3",
    "sol-k 0",
    "sol-z 0",
  ]);
  // the resolved answers hold the visible ones only
  assert.deepEqual(
    resolveAnswers(pico(), { a: "a3", b: ["b1"], c: 5, d: "zzz", g: 7 }),
    {
      ok: true,
      visible: ["a", "b", "c"],
      answers: { a: ["a3"], b: ["b1"], c: 5 },
    },
  );
});

test("PE-2d: the order of the errors - an unknown key before everything and the smallest of them, then the first question of the file; in a list the first fault", () => {
  assert.deepEqual(
    computeResult(pico(), { ...OK, zz: 1, aa: 2, c: 500 }).error,
    { code: "E_ANSWER", question: "aa", reason: "unknown_question" },
  );
  assert.deepEqual(
    computeResult(pico(), { ...OK, zz: 1, aa: 2, Aa: 3 }).error.question,
    "Aa",
  );
  assert.deepEqual(
    computeResult(pico(), { zz: 1, aa: 2 }).error.question,
    "aa",
  );
  assert.deepEqual(
    computeResult(pico(), { aa: 2, zz: 1 }).error.question,
    "aa",
  );
  assert.deepEqual(computeResult(pico(), BAD({ a: "a9", c: 500 })).error, {
    code: "E_ANSWER",
    question: "a",
    reason: "unknown_option",
  });
  assert.deepEqual(computeResult(pico(), BAD({ c: 500, b: [] })).error, {
    code: "E_ANSWER",
    question: "b",
    reason: "empty_list",
  });
  assert.deepEqual(
    computeResult(pico(), BAD({ b: ["b1", "b9", "b1"] })).error.reason,
    "unknown_option",
  );
  assert.deepEqual(
    computeResult(pico(), BAD({ b: ["b1", "b1", "b9"] })).error.reason,
    "duplicate_option",
  );
  // a missing required question before a wrong answer further on
  assert.deepEqual(computeResult(pico(), { a: "a1", c: 500 }).error, {
    code: "E_ANSWER",
    question: "b",
    reason: "missing_required",
  });
  // a wrong answer before a missing one
  assert.deepEqual(
    computeResult(pico(), { a: "zzz", b: ["b1"] }).error.question,
    "a",
  );
});

// A tenant with a question named like a method of every object.
function withConstructorQuestion() {
  const t = pico();
  t.questions.push({
    id: "constructor",
    title: "Вопрос constructor?",
    type: "single",
    required: false,
    options: [
      { id: "k1", label: "Вариант k1" },
      { id: "k2", label: "Вариант k2" },
    ],
  });
  return t;
}

test("PE-2e: a question whose id is a name of Object.prototype - the answers are read by own keys: a set without it is good, the question is seen, a wrong option is named", () => {
  for (const make of [
    () => withConstructorQuestion(),
    () => noProto(withConstructorQuestion()),
  ]) {
    const tenant = make();
    assert.deepEqual(
      validateTenant(deepCopy(withConstructorQuestion()), {
        fileName: "pico-test.json",
      }),
      [],
    );
    assert.equal(computeResult(tenant, OK).ok, true);
    assert.deepEqual(visibleQuestions(tenant, OK), [
      "a",
      "b",
      "c",
      "d",
      "g",
      "constructor",
    ]);
    assert.deepEqual(
      computeResult(tenant, { ...OK, constructor: "zzz" }).error,
      {
        code: "E_ANSWER",
        question: "constructor",
        reason: "unknown_option",
      },
    );
    const named = JSON.parse(
      '{"a":"a1","b":["b1"],"c":5,"d":"d1","constructor":"k2"}',
    );
    assert.equal(computeResult(tenant, named).ok, true);
    assert.deepEqual(resolveAnswers(tenant, named).answers.constructor, ["k2"]);
  }
  // the tenant without such a question: a key "constructor" is unknown
  assert.deepEqual(
    computeResult(pico(), JSON.parse('{"constructor":"x"}')).error,
    {
      code: "E_ANSWER",
      question: "constructor",
      reason: "unknown_question",
    },
  );
  // answers that came with no prototype
  const bare = Object.create(null);
  Object.assign(bare, OK);
  assert.equal(computeResult(pico(), bare).ok, true);
  // a property that is only inherited is no answer
  assert.deepEqual(computeResult(pico(), Object.create({ a: "a1" })).error, {
    code: "E_ANSWER",
    question: "a",
    reason: "missing_required",
  });
});

// ---------------------------------------------------------------------- PE-3

const CASES = [
  [
    "C1",
    { a: "a2", b: ["b2"], c: 15, d: "d1" },
    ["sol-k 6", "sol-b 2", "sol-m 0", "sol-z 0"],
    ["sol-k"],
    true,
    ["h-two"],
  ],
  [
    "C2",
    { a: "a1", b: ["b1"], c: 0, d: "d1", g: "g1" },
    ["sol-m 7", "sol-b 5", "sol-k 0", "sol-z 0"],
    ["sol-m", "sol-b"],
    true,
    ["h-two"],
  ],
  [
    "C3",
    { a: "a1", b: ["b1"], c: 5, d: "d1" },
    ["sol-m 6", "sol-b 5", "sol-k 0", "sol-z 0"],
    ["sol-m", "sol-b"],
    false,
    ["h-two"],
  ],
  [
    "C4",
    { a: "a1", b: ["b2"], c: 0, d: "d1", g: "g1" },
    ["sol-m 5", "sol-b 5", "sol-k 2", "sol-z 0"],
    ["sol-m", "sol-b"],
    false,
    ["h-two"],
  ],
  [
    "C5",
    { a: "a2", b: ["b1"], c: 0, d: "d1", g: "g1" },
    ["sol-b 5", "sol-k 4", "sol-m 3", "sol-z 0"],
    ["sol-b", "sol-k", "sol-m"],
    false,
    ["h-two"],
  ],
  [
    "C6",
    { a: "a1", b: ["b3"], c: 0, d: "d2" },
    ["sol-b 3", "sol-k 2", "sol-m 1", "sol-z 0"],
    ["sol-b"],
    true,
    [],
  ],
  [
    "C7",
    { a: "a1", b: ["b3"], c: 0, d: "d2", e: "e1" },
    ["sol-k 2", "sol-b 2", "sol-m 1", "sol-z 0"],
    [],
    null,
    [],
  ],
  [
    "C8",
    { a: "a1", b: ["b1"], c: 10, d: "d1" },
    ["sol-m 6", "sol-k 5", "sol-b 2", "sol-z 0"],
    ["sol-m", "sol-k"],
    false,
    ["h-two"],
  ],
  [
    "C9",
    { a: "a1", b: ["b1"], c: 20, d: "d1" },
    ["sol-m 6", "sol-k 5", "sol-b 2", "sol-z 0"],
    ["sol-m", "sol-k"],
    false,
    ["h-two"],
  ],
  [
    "C10",
    { a: "a1", b: ["b1"], c: 9, d: "d1" },
    ["sol-m 6", "sol-b 5", "sol-k 0", "sol-z 0"],
    ["sol-m", "sol-b"],
    false,
    ["h-two"],
  ],
  [
    "C11",
    { a: "a1", b: ["b1"], c: 21, d: "d1" },
    ["sol-m 6", "sol-b 2", "sol-k 0", "sol-z 0"],
    ["sol-m"],
    true,
    ["h-two"],
  ],
  [
    "C12",
    { a: "a3", b: ["b3"], c: 100 },
    ["sol-z 7", "sol-k 2", "sol-b 0", "sol-m -3"],
    ["sol-z"],
    true,
    [],
  ],
  [
    "C13",
    { a: "a3", b: ["b3"], c: 99 },
    ["sol-z 6", "sol-k 2", "sol-b 0", "sol-m -3"],
    ["sol-z"],
    true,
    [],
  ],
  [
    "C14",
    { a: "a2", b: ["b1"], c: 100, d: "d1", g: "g1" },
    ["sol-k 4", "sol-m 3", "sol-z 3", "sol-b 2"],
    ["sol-k", "sol-m", "sol-z"],
    false,
    ["h-two"],
  ],
  [
    "C15",
    { a: "a1", b: ["b1"], c: 0, d: "d2", g: "g1" },
    ["sol-m 6", "sol-b 3", "sol-k 0", "sol-z 0"],
    ["sol-m", "sol-b"],
    true,
    [],
  ],
  [
    "C16",
    { a: "a3", b: ["b1"], c: 30, d: "d1" },
    ["sol-z 4", "sol-m 2", "sol-k 0", "sol-b 0"],
    ["sol-z"],
    true,
    [],
  ],
  [
    "C17",
    { a: "a1", b: ["b1"], c: 50, d: "d1" },
    ["sol-m 6", "sol-z 2", "sol-b 2", "sol-k 0"],
    ["sol-m"],
    true,
    ["h-one", "h-two"],
  ],
];

test("PE-3a: 17 sets of answers - the ranking is the literal of the table, line by line (solution and points); the recommended, the mark, the hypotheses; the text for no match only when nothing is recommended; the points of the explanation add up to the score", () => {
  for (const [form, make] of FORMS) {
    const tenant = make();
    for (const [
      label,
      answers,
      ranking,
      recommended,
      leader,
      hypotheses,
    ] of CASES) {
      const out = computeResult(tenant, answers);
      assert.equal(out.ok, true, `${label} ${form}`);
      const r = out.result;
      assert.deepEqual(ranked(r), ranking, `${label} ${form}: ranking`);
      assert.deepEqual(
        ids(r.recommended),
        recommended,
        `${label}: recommended`,
      );
      assert.equal(r.clear_leader, leader, `${label}: mark`);
      assert.deepEqual(ids(r.hypotheses), hypotheses, `${label}: hypotheses`);
      assert.equal(
        r.no_match_text,
        recommended.length === 0 ? "Подходящего решения нет." : null,
        `${label}: no match`,
      );
      for (const item of r.recommended) {
        assert.equal(
          item.rules.reduce((sum, x) => sum + x.points, 0),
          item.score,
          `${label}: ${item.id}`,
        );
        assert.equal(
          item.score,
          Number(ranking.find((x) => x.startsWith(item.id)).split(" ")[1]),
        );
      }
    }
  }
});

test("PE-3a: the explanation of the first sets - the rules that fired, in the order of the file, with the points of any sign", () => {
  const rulesOf = (answers, solution) =>
    computeResult(pico(), answers)
      .result.recommended.find((x) => x.id === solution)
      .rules.map((r) => `${r.id} ${r.points}`);
  assert.deepEqual(rulesOf(CASES[4][1], "sol-m"), ["r-b1 2", "r-g1 1"]);
  assert.deepEqual(rulesOf(CASES[4][1], "sol-b"), ["r-c-low 3", "r-d1 2"]);
  assert.deepEqual(rulesOf(CASES[4][1], "sol-k"), ["r-a2 4"]);
  assert.deepEqual(
    rulesOf({ a: "a1", b: ["b1", "b3"], c: 30, d: "d1" }, "sol-m"),
    ["r-a1 4", "r-b1 2", "r-b3-neg -3"],
  );
  // the rule with three conditions: every condition has a line, in the order of when
  const three = computeResult(pico(), CASES[7][1]).result.recommended.find(
    (x) => x.id === "sol-k",
  );
  assert.deepEqual(
    three.rules.map((r) => r.id),
    ["r-three"],
  );
  assert.deepEqual(three.rules[0].because, [
    { question: "a", selected: ["a1"] },
    { question: "b", selected: ["b1"] },
    { question: "c", value: 10 },
  ]);
});

test("PE-2e: a property that only the prototype of the answers holds is no answer and no unknown question - the same bytes as the plain answers, for all three functions", () => {
  for (const [form, make] of FORMS) {
    const tenant = make();
    const plain = { ...OK };
    const inheriting = [
      Object.assign(Object.create({ zz: 1 }), OK),
      Object.assign(Object.create({ a: "a9", constructor: 5 }), OK),
      Object.assign(Object.create(Object.create({ zz: 1, aa: [] })), OK),
    ];
    for (const inherited of inheriting) {
      assert.equal(computeResult(tenant, inherited).ok, true, form);
      for (const fn of [visibleQuestions, resolveAnswers, computeResult]) {
        assert.equal(
          JSON.stringify(fn(tenant, inherited)),
          JSON.stringify(fn(tenant, plain)),
          `${fn.name} ${form}`,
        );
      }
    }
  }
});

test("PE-3a: the rules of the explanation stand in the order of the file - on a copy of the small tenant whose rules are written in the reverse order (neither by id nor by points)", () => {
  for (const make of [
    () => picoReversedRules(),
    () => noProto(picoReversedRules()),
  ]) {
    const tenant = make();
    assert.deepEqual(
      validateTenant(tenant, { fileName: "pico-test.json" }),
      [],
    );
    const m = computeResult(tenant, {
      a: "a1",
      b: ["b1", "b3"],
      c: 30,
      d: "d1",
      g: "g1",
    }).result;
    assert.deepEqual(ranked(m), ["sol-m 4", "sol-k 2", "sol-b 2", "sol-z 0"]);
    assert.deepEqual(ids(m.recommended), ["sol-m"]);
    assert.deepEqual(
      m.recommended[0].rules.map((r) => `${r.id} ${r.points}`),
      ["r-g1 1", "r-b3-neg -3", "r-b1 2", "r-a1 4"],
    );
    const k = computeResult(tenant, {
      a: "a2",
      b: ["b1"],
      c: 15,
      d: "d1",
    }).result;
    assert.deepEqual(ranked(k), ["sol-k 9", "sol-m 2", "sol-b 2", "sol-z 0"]);
    assert.deepEqual(
      k.recommended[0].rules.map((r) => `${r.id} ${r.points}`),
      ["r-three 5", "r-a2 4"],
    );
  }
});

test("PE-3b: the settings of the result - top, min_score and the text for no match, on copies of the small tenant that stay good files", () => {
  const c5 = CASES[4][1];
  const run = (settings, answers) => {
    const tenant = withSettings(pico(), settings);
    assert.deepEqual(
      validateTenant(tenant, { fileName: "pico-test.json" }),
      [],
    );
    return computeResult(tenant, answers).result;
  };
  assert.deepEqual(ids(run({ top: 2 }, c5).recommended), ["sol-b", "sol-k"]);
  const one = run({ top: 1 }, c5);
  assert.deepEqual(ids(one.recommended), ["sol-b"]);
  assert.equal(one.clear_leader, true);
  assert.deepEqual(ids(run({ top: 3 }, c5).recommended), [
    "sol-b",
    "sol-k",
    "sol-m",
  ]);
  assert.deepEqual(ids(run({ min_score: 4 }, c5).recommended), [
    "sol-b",
    "sol-k",
  ]);
  assert.deepEqual(ids(run({ min_score: 5 }, c5).recommended), ["sol-b"]);
  const none = run({ min_score: 6 }, c5);
  assert.deepEqual(none.recommended, []);
  assert.equal(none.clear_leader, null);
  assert.equal(none.no_match_text, "Подходящего решения нет.");
  assert.deepEqual(
    ranked(none),
    ["sol-b 5", "sol-k 4", "sol-m 3", "sol-z 0"],
    "the ranking has all the solutions",
  );
  // a score equal to min_score is taken
  assert.deepEqual(ids(run({ min_score: 3 }, CASES[5][1]).recommended), [
    "sol-b",
  ]);
  assert.deepEqual(ids(run({ min_score: 4 }, CASES[5][1]).recommended), []);
  // the text for no match is the one of the file
  const other = withSettings(pico(), {
    min_score: 99,
    no_match_text: "Другой текст.",
  });
  assert.equal(computeResult(other, c5).result.no_match_text, "Другой текст.");
});

// The outcomes of the six sets of the fictional tenants (design 8).
const SIX = {
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
      [],
      10,
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
      [],
      10,
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
      [],
      11,
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
      ["g-invisible"],
      8,
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
      ["g-weak-pages"],
      9,
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
      [],
      9,
    ],
  },
};

test("PE-3c: the six sets of the fictional tenants give the outcomes of the table - the tenant is taken as the check of the file gives it (no prototype) and as JSON.parse gives it", () => {
  for (const id of DEMO_IDS) {
    for (const [form, tenant] of [
      ["checked file", demoTenant(id)],
      ["JSON.parse", demoPlain(id)],
    ]) {
      const sets = demoAnswers(id);
      for (const name of ["leader", "close", "none"]) {
        const [ranking, recommended, leader, hypotheses, visible] =
          SIX[id][name];
        const label = `${id}/${name} (${form})`;
        const out = computeResult(tenant, sets[name]);
        assert.equal(out.ok, true, label);
        assert.deepEqual(ranked(out.result), ranking, label);
        assert.deepEqual(ids(out.result.recommended), recommended, label);
        assert.equal(out.result.clear_leader, leader, label);
        assert.deepEqual(ids(out.result.hypotheses), hypotheses, label);
        assert.equal(
          visibleQuestions(tenant, sets[name]).length,
          visible,
          label,
        );
        assert.equal(
          resolveAnswers(tenant, sets[name]).visible.length,
          visible,
          label,
        );
        if (recommended.length === 0) {
          assert.equal(
            out.result.no_match_text,
            tenant.result.no_match_text,
            label,
          );
        } else {
          assert.equal(out.result.no_match_text, null, label);
        }
      }
    }
  }
  // the sets close and leader of the tenants as the requirement words them
  for (const id of DEMO_IDS) {
    const t = demoTenant(id);
    const sets = demoAnswers(id);
    assert.equal(computeResult(t, sets.leader).result.clear_leader, true);
    const close = computeResult(t, sets.close).result;
    assert.ok(close.recommended.length === 2 || close.recommended.length === 3);
    assert.equal(close.clear_leader, false);
    assert.deepEqual(computeResult(t, sets.none).result.recommended, []);
  }
});

// ---------------------------------------------------------------------- PE-4

test("PE-4a: the mark 'clear leader' - a gap equal to the setting is a clear leader, one less is close variants; one recommended is a clear leader; none - no mark", () => {
  const gap = (settings, answers) =>
    computeResult(withSettings(pico(), settings), answers).result.clear_leader;
  const c2 = CASES[1][1];
  const c3 = CASES[2][1];
  assert.equal(gap({ clear_lead_gap: 2 }, c2), true, "gap 2 of 2");
  assert.equal(gap({ clear_lead_gap: 1 }, c2), true);
  assert.equal(gap({ clear_lead_gap: 3 }, c2), false, "gap 2 of 3");
  assert.equal(gap({ clear_lead_gap: 2 }, c3), false, "gap 1 of 2");
  assert.equal(gap({ clear_lead_gap: 1 }, c3), true);
  assert.equal(
    gap({ clear_lead_gap: 9 }, CASES[5][1]),
    true,
    "one recommended",
  );
  assert.equal(
    gap({ clear_lead_gap: 9 }, CASES[10][1]),
    true,
    "one recommended (C11)",
  );
  assert.equal(
    gap({ clear_lead_gap: 1 }, CASES[6][1]),
    null,
    "none recommended",
  );
  assert.equal(gap({}, CASES[6][1]), null);
  // the mark is true, false or null and nothing else
  for (const [, answers] of CASES) {
    assert.ok(
      [true, false, null].includes(
        computeResult(pico(), answers).result.clear_leader,
      ),
    );
  }
});

test("PE-4b: a tie of the first and the second is close variants; the gap is between the first and the second, not the first and the last", () => {
  assert.equal(
    computeResult(pico(), CASES[3][1]).result.clear_leader,
    false,
    "C4: a tie",
  );
  const c5 = computeResult(pico(), CASES[4][1]).result;
  assert.equal(c5.recommended.length, 3);
  // first 5, second 4, last 3: the gap to the second is 1 (< 2), to the last 2
  assert.equal(c5.clear_leader, false);
  // the same with a setting of 2 against the last: a tie of the second and the third does not matter
  const c14 = computeResult(pico(), CASES[13][1]).result;
  assert.deepEqual(ranked(c14).slice(0, 3), ["sol-k 4", "sol-m 3", "sol-z 3"]);
  assert.equal(c14.clear_leader, false);
  const wide = computeResult(
    withSettings(pico(), { clear_lead_gap: 1 }),
    CASES[13][1],
  ).result;
  assert.equal(wide.clear_leader, true);
});

// ---------------------------------------------------------------------- PE-7

const asStrings = (value, out = []) => {
  if (typeof value === "string") out.push(value);
  else if (value !== null && typeof value === "object")
    Object.values(value).forEach((x) => asStrings(x, out));
  return out;
};

test("PE-7a: every string of a result is a string of the tenant file - on the small tenant and on the six sets of the fictional tenants", () => {
  const checks = [];
  for (const [, answers] of CASES) checks.push([pico(), answers]);
  for (const id of DEMO_IDS) {
    for (const name of ["leader", "close", "none"])
      checks.push([demoTenant(id), demoAnswers(id)[name]]);
  }
  for (const [tenant, answers] of checks) {
    const known = allStrings(tenant);
    const out = computeResult(tenant, answers);
    for (const s of asStrings(out.result))
      assert.ok(known.has(s), `a word that the file does not have: ${s}`);
  }
});

test("PE-7b: the numbers of a result stand only in score, points and because[].value, and a value is what the visitor answered", () => {
  for (const [, answers] of CASES) {
    const out = computeResult(pico(), answers);
    for (const p of numbersIn(out.result))
      assert.ok(
        NUMBER_PATHS.some((re) => re.test(p)),
        p,
      );
    for (const item of out.result.recommended) {
      for (const r of item.rules) {
        for (const b of r.because) {
          if (b.value !== undefined)
            assert.equal(
              b.value,
              answers[b.question],
              `${item.id}/${r.id}/${b.question}`,
            );
        }
      }
    }
  }
  for (const id of DEMO_IDS) {
    for (const name of ["leader", "close", "none"]) {
      const answers = demoAnswers(id)[name];
      const out = computeResult(demoTenant(id), answers);
      for (const p of numbersIn(out.result))
        assert.ok(
          NUMBER_PATHS.some((re) => re.test(p)),
          p,
        );
    }
  }
  // a number is seen in the explanation: C12 has a rule on a number question
  const c12 = computeResult(pico(), CASES[11][1]).result;
  const numeric = c12.recommended[0].rules
    .flatMap((r) => r.because)
    .filter((b) => b.value !== undefined);
  assert.deepEqual(numeric, [
    { question: "c", value: 100 },
    { question: "c", value: 100 },
  ]);
  // the zero is a zero, never -0
  const zero = computeResult(pico(), { a: "a1", b: ["b1"], c: -0, d: "d1" });
  assert.equal(zero.ok, true);
  assert.equal(
    Object.is(
      resolveAnswers(pico(), { a: "a1", b: ["b1"], c: -0, d: "d1" }).answers.c,
      0,
    ),
    true,
  );
  const withZero = computeResult(pico(), {
    a: "a1",
    b: ["b1"],
    c: -0,
    d: "d1",
    g: "g1",
  });
  const values = withZero.result.recommended
    .flatMap((x) => x.rules)
    .flatMap((r) => r.because)
    .filter((b) => b.value !== undefined);
  assert.ok(values.length >= 1);
  for (const b of values) assert.equal(Object.is(b.value, 0), true);
});

test("PE-7c: the fields are compared by name - the fields of a solution, a rule and a hypothesis equal those of the file; no price and no duration where the file has none (no key, not null)", () => {
  for (const answers of [
    CASES[1][1],
    CASES[4][1],
    CASES[13][1],
    CASES[16][1],
  ]) {
    const tenant = pico();
    const result = computeResult(tenant, answers).result;
    for (const item of result.recommended) {
      const solution = tenant.solutions.find((s) => s.id === item.id);
      for (const key of [
        "id",
        "name",
        "summary",
        "includes",
        "needs_from_you",
        "next_steps",
        "not_suitable_when",
      ]) {
        assert.deepEqual(item[key], solution[key], `${item.id}.${key}`);
      }
      for (const key of ["price_text", "duration_text"]) {
        assert.equal(
          Object.hasOwn(item, key),
          Object.hasOwn(solution, key),
          `${item.id}.${key}`,
        );
        if (Object.hasOwn(solution, key))
          assert.equal(item[key], solution[key]);
      }
      for (const entry of item.rules) {
        const rule = tenant.rules.find((r) => r.id === entry.id);
        assert.equal(rule.solution, item.id);
        assert.equal(entry.text, rule.text);
        assert.equal(entry.points, rule.points);
        assert.deepEqual(
          entry.because.map((b) => b.question),
          rule.when.map((c) => c.question),
        );
      }
    }
    for (const h of result.hypotheses) {
      const found = tenant.hypotheses.find((x) => x.id === h.id);
      assert.equal(h.title, found.title);
      assert.equal(h.explanation, found.explanation);
    }
  }
  // the one solution with a price and a duration
  const k = computeResult(pico(), CASES[0][1]).result.recommended[0];
  assert.equal(k.id, "sol-k");
  assert.equal(k.price_text, "Цена по договорённости.");
  assert.equal(k.duration_text, "Срок две недели.");
  const m = computeResult(pico(), CASES[1][1]).result.recommended[0];
  assert.equal(m.id, "sol-m");
  assert.equal(Object.hasOwn(m, "price_text"), false);
  assert.equal(Object.hasOwn(m, "duration_text"), false);
  assert.deepEqual(m.needs_from_you, []);
  // the solutions of the fictional tenants: the fields are those of the file
  for (const id of DEMO_IDS) {
    const tenant = demoTenant(id);
    for (const name of ["leader", "close"]) {
      for (const item of computeResult(tenant, demoAnswers(id)[name]).result
        .recommended) {
        const solution = tenant.solutions.find((s) => s.id === item.id);
        assert.equal(item.name, solution.name);
        assert.equal(item.summary, solution.summary);
        assert.equal(
          Object.hasOwn(item, "price_text"),
          Object.hasOwn(solution, "price_text"),
        );
      }
    }
  }
});

test("PE-7d: the order of the keys is the order of the design; a change of a returned list does not change the tenant", () => {
  const tenant = pico();
  const copy = deepCopy(tenant);
  const result = computeResult(tenant, CASES[0][1]).result;
  assert.deepEqual(Object.keys(result), [
    "clear_leader",
    "recommended",
    "no_match_text",
    "ranking",
    "hypotheses",
  ]);
  const item = result.recommended[0];
  assert.deepEqual(Object.keys(item), [
    "id",
    "name",
    "summary",
    "includes",
    "needs_from_you",
    "next_steps",
    "price_text",
    "duration_text",
    "not_suitable_when",
    "score",
    "rules",
  ]);
  assert.deepEqual(Object.keys(item.rules[0]), [
    "id",
    "points",
    "text",
    "because",
  ]);
  assert.deepEqual(Object.keys(item.rules[0].because[0]), [
    "question",
    "selected",
  ]);
  const number = computeResult(tenant, CASES[7][1]).result.recommended[1]
    .rules[0].because[2];
  assert.deepEqual(Object.keys(number), ["question", "value"]);
  assert.deepEqual(Object.keys(result.ranking[0]), ["solution", "score"]);
  assert.deepEqual(Object.keys(result.hypotheses[0]), [
    "id",
    "title",
    "explanation",
  ]);
  const bare = computeResult(tenant, CASES[1][1]).result.recommended[0];
  assert.deepEqual(Object.keys(bare), [
    "id",
    "name",
    "summary",
    "includes",
    "needs_from_you",
    "next_steps",
    "not_suitable_when",
    "score",
    "rules",
  ]);
  const err = computeResult(tenant, null).error;
  assert.deepEqual(Object.keys(err), ["code", "question", "reason"]);
  const resolved = resolveAnswers(tenant, OK);
  assert.deepEqual(Object.keys(resolved), ["ok", "visible", "answers"]);
  // changes of the returned lists
  item.includes.push("чужой пункт");
  item.next_steps.length = 0;
  item.not_suitable_when.push("чужой пункт");
  item.rules.length = 0;
  result.ranking.length = 0;
  resolved.visible.push("zz");
  resolved.answers.b.push("zz");
  assert.deepEqual(tenant, copy);
  const again = computeResult(tenant, CASES[0][1]).result;
  assert.equal(again.recommended[0].includes.length, 2);
  // the lists of a result are not the lists of the file
  assert.notEqual(again.recommended[0].includes, tenant.solutions[1].includes);
  assert.notEqual(
    again.recommended[0].next_steps,
    tenant.solutions[1].next_steps,
  );
  assert.notEqual(
    again.recommended[0].not_suitable_when,
    tenant.solutions[1].not_suitable_when,
  );
  assert.notEqual(
    again.recommended[0].needs_from_you,
    tenant.solutions[1].needs_from_you,
  );
});

test("PE-7d: every list of chosen options in the explanation is a list of its own - not one that another line, or the resolved answers, hold too", () => {
  const answers = CASES[7][1];
  const result = computeResult(pico(), answers).result;
  const lists = result.recommended
    .flatMap((x) => x.rules)
    .flatMap((r) => r.because)
    .filter((b) => b.selected !== undefined)
    .map((b) => b.selected);
  assert.ok(lists.length >= 4);
  assert.equal(new Set(lists).size, lists.length);
  const resolved = resolveAnswers(pico(), answers).answers;
  for (const list of lists) {
    for (const held of Object.values(resolved)) assert.notEqual(list, held);
  }
  // a change of one list is seen nowhere else
  lists[0].push("zz");
  assert.ok(lists.slice(1).every((x) => !x.includes("zz")));
});

test("PE-7d: the resolved answers stand in the order of the questions of the file, whatever the order of the keys and of the lists that came", () => {
  const sent = { g: "g1", e: "e1", d: "d1", c: 5, b: ["b3", "b1"], a: "a1" };
  const canon = { a: "a1", b: ["b1", "b3"], c: 5, d: "d1", g: "g1" };
  for (const [form, make] of FORMS) {
    const tenant = make();
    const out = resolveAnswers(tenant, sent);
    assert.equal(out.ok, true, form);
    assert.deepEqual(Object.keys(out.answers), ["a", "b", "c", "d", "g"], form);
    assert.deepEqual(out.answers.b, ["b1", "b3"]);
    assert.equal(
      JSON.stringify(out),
      JSON.stringify(resolveAnswers(tenant, canon)),
      form,
    );
  }
});

test("PE-7d: the chosen options of a multiple question stand in the order of the options of the file, not in the order of the list that came", () => {
  const out = resolveAnswers(pico(), {
    a: "a1",
    b: ["b3", "b1", "b2"],
    c: 5,
    d: "d1",
  });
  assert.deepEqual(out.answers, {
    a: ["a1"],
    b: ["b1", "b2", "b3"],
    c: 5,
    d: ["d1"],
  });
  assert.deepEqual(out.visible, ["a", "b", "c", "d", "g"]);
  const result = computeResult(pico(), {
    a: "a1",
    b: ["b3", "b1"],
    c: 5,
    d: "d1",
  }).result;
  const because = result.recommended
    .flatMap((x) => x.rules)
    .flatMap((r) => r.because)
    .filter((b) => b.question === "b");
  assert.ok(because.length >= 1);
  for (const b of because) assert.deepEqual(b.selected, ["b1", "b3"]);
  assert.equal(
    JSON.stringify(
      computeResult(pico(), { a: "a1", b: ["b3", "b1"], c: 5, d: "d1" }),
    ),
    JSON.stringify(
      computeResult(pico(), { d: "d1", c: 5, b: ["b1", "b3"], a: "a1" }),
    ),
  );
});

// ---------------------------------------------------------------------- PE-8

test("PE-8a: answers of another tenant are no result - the smallest of the foreign keys is named", () => {
  const uchet = demoTenant("uchet-pro");
  const svet = demoTenant("svet-marketing");
  const foreign = computeResult(uchet, demoAnswers("svet-marketing").leader);
  assert.equal(foreign.ok, false);
  assert.deepEqual(foreign.error, {
    code: "E_ANSWER",
    question: "ad-budget",
    reason: "unknown_question",
  });
  assert.equal(Object.hasOwn(foreign, "result"), false);
  const back = computeResult(svet, demoAnswers("uchet-pro").leader);
  assert.deepEqual(back.error, {
    code: "E_ANSWER",
    question: "budget",
    reason: "unknown_question",
  });
  assert.equal(Object.hasOwn(back, "result"), false);
  assert.equal(
    resolveAnswers(uchet, demoAnswers("svet-marketing").close).ok,
    false,
  );
});

test("PE-8b: the text of the engine has no file, network, process or team word and no import (comments count)", () => {
  const text = fs.readFileSync(ENGINE, "utf8");
  assert.doesNotMatch(
    text,
    /node:fs|node:net|node:http|child_process|src\/team\/|fetch[(]/u,
  );
  assert.doesNotMatch(text, /^\s*import\b/mu);
  assert.doesNotMatch(text, /\bimport\s*[({]/u);
  assert.doesNotMatch(text, /\brequire\s*[(]/u);
  assert.equal(/\bexport\b/u.test(text), true);
});

test("PE-8d: the list of the files of the picker is the one that the tests of REQ-054 wait for, with the engine in it", () => {
  assert.deepEqual(
    fs
      .readdirSync(PICKER)
      .filter((f) => f.endsWith(".js"))
      .sort(),
    [...ALL_MODULES].sort(),
  );
  assert.ok(ALL_MODULES.includes("engine.js"));
  assert.equal(ALL_MODULES.length, 12);
});

test("PE-8e: calls in turn on two tenants give what each gives alone - the engine keeps nothing between calls", () => {
  const uchet = demoTenant("uchet-pro");
  const svet = demoTenant("svet-marketing");
  const alone = {};
  for (const [id, t] of [
    ["uchet-pro", uchet],
    ["svet-marketing", svet],
  ]) {
    for (const name of ["leader", "close", "none"])
      alone[`${id}/${name}`] = JSON.stringify(
        computeResult(t, demoAnswers(id)[name]),
      );
  }
  for (let round = 0; round < 3; round++) {
    for (const name of ["none", "leader", "close"]) {
      for (const [id, t] of [
        ["svet-marketing", svet],
        ["uchet-pro", uchet],
      ]) {
        assert.equal(
          JSON.stringify(computeResult(t, demoAnswers(id)[name])),
          alone[`${id}/${name}`],
          `${id}/${name}`,
        );
        // an error in between does not leave a trace
        assert.equal(computeResult(t, { nothing: 1 }).ok, false);
      }
    }
  }
  const small = JSON.stringify(computeResult(pico(), CASES[0][1]));
  computeResult(pico(), CASES[1][1]);
  assert.equal(JSON.stringify(computeResult(pico(), CASES[0][1])), small);
});
