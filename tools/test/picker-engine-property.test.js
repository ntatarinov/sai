// PE-5, PE-6, PE-7 on 1000 sets of answers per tenant and the tests of the risks PE-R1 ... PE-R4
// (design docs/design/REQ-055-picker-engine.md, section 11). The sets come from a seeded
// generator; the expectations come from a second computation written in the helpers of the
// tests, which shares nothing with src/.
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
import { PICKER, makeRng } from "./picker-helpers.js";
import {
  DEMO_IDS,
  NUMBER_PATHS,
  allStrings,
  deepCopy,
  deepFreeze,
  demoAnswers,
  demoTenant,
  expectedOutcome,
  inFileOrder,
  noProto,
  numbersIn,
  pico,
  sets,
  shuffleKeys,
  shuffleLists,
} from "./picker-engine-helpers.js";

const ENGINE = path.join(PICKER, "engine.js");
const SEEDS = { "uchet-pro": 5501, "svet-marketing": 5502, pico: 5503 };

// The tenants of the property: the two fictional ones as the reader makes them, and the small one.
const TENANTS = [
  ...DEMO_IDS.map((id) => [id, demoTenant(id)]),
  ["pico", noProto(pico())],
];
const SETS = new Map(TENANTS.map(([id, t]) => [id, sets(t, SEEDS[id], 1000)]));

// ---------------------------------------------------------------------- the generator itself

test("PE-R3: the 1000 sets of every fictional tenant are not an empty check - every kind of outcome is met often enough", () => {
  for (const id of DEMO_IDS) {
    const tenant = demoTenant(id);
    const list = SETS.get(id);
    assert.equal(list.length, 1000);
    const count = {
      empty: 0,
      one: 0,
      two: 0,
      three: 0,
      leaderTrue: 0,
      leaderFalse: 0,
      hypotheses: 0,
      minus: 0,
      tie: 0,
    };
    for (const answers of list) {
      const out = computeResult(tenant, answers);
      assert.equal(out.ok, true, `${id}: ${JSON.stringify(answers)}`);
      const r = out.result;
      const n = r.recommended.length;
      if (n === 0) count.empty++;
      if (n === 1) count.one++;
      if (n === 2) count.two++;
      if (n === 3) count.three++;
      if (r.clear_leader === true) count.leaderTrue++;
      if (r.clear_leader === false) count.leaderFalse++;
      if (r.hypotheses.length > 0) count.hypotheses++;
      if (r.recommended.some((x) => x.rules.some((y) => y.points < 0)))
        count.minus++;
      if (r.ranking.some((e, i) => i > 0 && e.score === r.ranking[i - 1].score))
        count.tie++;
    }
    const at = (name, least) =>
      assert.ok(
        count[name] >= least,
        `${id}: ${name} ${count[name]} < ${least}`,
      );
    at("empty", 10);
    at("one", 10);
    at("two", 10);
    at("three", 10);
    at("leaderTrue", 100);
    at("leaderFalse", 100);
    at("hypotheses", 100);
    at("minus", 50);
    at("tie", 100);
  }
});

// ---------------------------------------------------------------------- PE-5

test("PE-5: for 1000 sets per tenant the explanation is true - the rules that fired and no others, in the order of the file, the sum of the points is the score, each line repeats a condition of its rule, the hypotheses are the true ones", () => {
  for (const [id, tenant] of TENANTS) {
    for (const answers of SETS.get(id)) {
      const label = `${id} ${JSON.stringify(answers)}`;
      const want = expectedOutcome(tenant, answers);
      const out = computeResult(tenant, answers);
      assert.equal(out.ok, true, label);
      const r = out.result;
      assert.deepEqual(visibleQuestions(tenant, answers), want.visible, label);
      assert.deepEqual(resolveAnswers(tenant, answers).visible, want.visible);
      assert.deepEqual(
        r.ranking.map((e) => [e.solution, e.score]),
        want.ranking,
        `${label}: ranking`,
      );
      assert.deepEqual(
        r.recommended.map((x) => x.id),
        want.recommended,
        label,
      );
      assert.equal(r.clear_leader, want.leader, `${label}: mark`);
      assert.equal(r.no_match_text === null, !want.noMatch, label);
      assert.deepEqual(
        r.hypotheses.map((h) => h.id),
        want.hypotheses,
        label,
      );
      for (const item of r.recommended) {
        const fired = want.firedBy(item.id);
        assert.deepEqual(
          item.rules.map((x) => x.id),
          fired.map((x) => x.id),
          `${label}: rules of ${item.id}`,
        );
        assert.equal(
          item.rules.reduce((sum, x) => sum + x.points, 0),
          item.score,
          `${label}: sum ${item.id}`,
        );
        item.rules.forEach((entry, i) => {
          const rule = fired[i];
          assert.equal(rule.solution, item.id);
          assert.equal(entry.points, rule.points);
          assert.equal(entry.text, rule.text);
          assert.equal(entry.because.length, rule.when.length, label);
          entry.because.forEach((line, k) => {
            const question = rule.when[k].question;
            assert.equal(line.question, question, label);
            assert.ok(
              want.visible.includes(question),
              `${label}: ${question} is seen`,
            );
            const given = want.answerOf(question);
            assert.notEqual(
              given,
              undefined,
              `${label}: ${question} is answered`,
            );
            const kind = tenant.questions.find((x) => x.id === question).type;
            if (kind === "number") {
              assert.deepEqual(Object.keys(line), ["question", "value"]);
              assert.equal(line.value, given, label);
            } else {
              assert.deepEqual(Object.keys(line), ["question", "selected"]);
              assert.deepEqual(
                line.selected,
                inFileOrder(tenant, question, given),
                label,
              );
            }
          });
        });
      }
    }
  }
});

// ---------------------------------------------------------------------- PE-6

test("PE-6a: for 1000 sets per tenant a second call, a call with the keys in another order and a call with the lists of a multiple question in another order give the same bytes", () => {
  for (const [id, tenant] of TENANTS) {
    const rng = makeRng(SEEDS[id] + 100);
    for (const answers of SETS.get(id)) {
      const first = JSON.stringify(computeResult(tenant, answers));
      const label = `${id} ${JSON.stringify(answers)}`;
      assert.equal(
        JSON.stringify(computeResult(tenant, answers)),
        first,
        label,
      );
      assert.equal(
        JSON.stringify(computeResult(tenant, shuffleKeys(answers, rng))),
        first,
        `${label}: keys`,
      );
      assert.equal(
        JSON.stringify(computeResult(tenant, shuffleLists(answers, rng))),
        first,
        `${label}: lists`,
      );
      const both = shuffleLists(shuffleKeys(answers, rng), rng);
      assert.equal(JSON.stringify(computeResult(tenant, both)), first, label);
      const resolved = resolveAnswers(tenant, answers);
      assert.equal(
        JSON.stringify(resolveAnswers(tenant, both)),
        JSON.stringify(resolved),
        `${label}: resolved`,
      );
      assert.deepEqual(
        Object.keys(resolved.answers),
        expectedOutcome(tenant, answers).visible.filter((q) =>
          Object.hasOwn(answers, q),
        ),
        `${label}: order of the resolved answers`,
      );
    }
  }
});

test("PE-6b: the text of the engine has no clock, no randomness and no environment word (comments count)", () => {
  const text = fs.readFileSync(ENGINE, "utf8");
  const found = text
    .split("\n")
    .map((line, i) => [i + 1, line])
    .filter(([, line]) =>
      /new Date|Date[.]now|Math[.]random|performance[.]now|process[.]env/u.test(
        line,
      ),
    );
  assert.deepEqual(found, []);
  // the expression itself finds what it should
  const re =
    /new Date|Date[.]now|Math[.]random|performance[.]now|process[.]env/u;
  for (const bad of [
    "new Date()",
    "Date.now()",
    "Math.random()",
    "performance.now()",
    "process.env.X",
  ]) {
    assert.equal(re.test(`const x = ${bad};`), true, bad);
    assert.equal(re.test(`// ${bad}`), true, bad);
  }
});

// ---------------------------------------------------------------------- PE-7

test("PE-7a/b: for 1000 sets per tenant every string of a result is a string of the file, a number stands only in score, points and because[].value, the value is the visitor's answer, and no price or duration appears where the file has none", () => {
  for (const [id, tenant] of TENANTS) {
    const known = allStrings(tenant);
    for (const answers of SETS.get(id)) {
      const label = `${id} ${JSON.stringify(answers)}`;
      const r = computeResult(tenant, answers).result;
      const walk = (value) => {
        if (typeof value === "string")
          assert.ok(known.has(value), `${label}: ${value}`);
        else if (value !== null && typeof value === "object")
          Object.values(value).forEach(walk);
      };
      walk(r);
      for (const p of numbersIn(r))
        assert.ok(
          NUMBER_PATHS.some((re) => re.test(p)),
          `${label}: ${p}`,
        );
      for (const item of r.recommended) {
        const solution = tenant.solutions.find((s) => s.id === item.id);
        for (const key of ["price_text", "duration_text"]) {
          assert.equal(
            Object.hasOwn(item, key),
            Object.hasOwn(solution, key),
            `${label}: ${key}`,
          );
        }
        for (const rule of item.rules) {
          for (const line of rule.because) {
            if (line.value !== undefined)
              assert.equal(line.value, answers[line.question], label);
          }
        }
      }
    }
  }
});

// ---------------------------------------------------------------------- PE-R1

function randomValue(rng, depth, ids) {
  const simple = [
    null,
    true,
    false,
    -0,
    0,
    1,
    2.5,
    -1,
    JSON.parse("1e400"),
    1e21,
    "",
    " ",
    "__proto__",
    "constructor",
    "zz",
  ];
  const r = rng.next();
  if (depth >= 3 || r < 0.45) {
    return rng.next() < 0.4 ? rng.pick(ids) : rng.pick(simple);
  }
  if (r < 0.75) {
    return Array.from({ length: rng.int(4) }, () =>
      randomValue(rng, depth + 1, ids),
    );
  }
  const text = Array.from({ length: rng.int(4) }, () => {
    const key = rng.next() < 0.3 ? "__proto__" : rng.pick(ids);
    return `${JSON.stringify(key)}:${JSON.stringify(randomValue(rng, depth + 1, ids))}`;
  });
  return JSON.parse(`{${text.join(",")}}`);
}

// A right set of one of the demo sets with one to three answers spoiled.
function spoiled(rng, tenant, base, ids) {
  const answers = deepCopy(base);
  const keys = Object.keys(answers);
  for (let n = 1 + rng.int(3); n > 0; n--) {
    const r = rng.next();
    const key = rng.pick(keys);
    if (r < 0.5) answers[key] = randomValue(rng, 0, ids);
    else if (r < 0.7) delete answers[key];
    else answers[rng.pick(ids)] = randomValue(rng, 0, ids);
  }
  return answers;
}

test("PE-R1: 10000 random JSON values instead of answers on each demo tenant - no exception, the input is not changed, the error has its shape and no result", () => {
  for (const id of DEMO_IDS) {
    const tenant = deepFreeze(demoTenant(id));
    const names = tenant.questions.map((q) => q.id);
    const options = tenant.questions.flatMap((q) =>
      (q.options ?? []).map((o) => o.id),
    );
    const ids = [...names, ...options, "foreign", "x"];
    const bases = Object.values(demoAnswers(id));
    const rng = makeRng(SEEDS[id] + 200);
    let refused = 0;
    for (let n = 0; n < 10000; n++) {
      const value =
        n % 2 === 0
          ? randomValue(rng, 0, ids)
          : spoiled(rng, tenant, rng.pick(bases), ids);
      const copy = deepCopy(value);
      deepFreeze(value);
      for (const fn of [visibleQuestions, resolveAnswers, computeResult]) {
        try {
          fn(tenant, value);
        } catch (error) {
          assert.fail(
            `${id} ${fn.name} threw ${error}: ${JSON.stringify(value)}`,
          );
        }
      }
      assert.deepEqual(value, copy, `${id}: changed input`);
      const out = computeResult(tenant, value);
      const resolved = resolveAnswers(tenant, value);
      assert.equal(typeof out.ok, "boolean");
      assert.equal(resolved.ok, out.ok);
      if (out.ok) {
        assert.equal(Object.hasOwn(out, "error"), false);
        assert.equal(Object.hasOwn(out, "result"), true);
        continue;
      }
      refused++;
      assert.deepEqual(Object.keys(out), ["ok", "error"]);
      assert.equal(Object.hasOwn(out, "result"), false);
      assert.deepEqual(Object.keys(out.error), ["code", "question", "reason"]);
      assert.equal(out.error.code, "E_ANSWER");
      assert.ok(
        out.error.question === null || typeof out.error.question === "string",
      );
      assert.ok(ANSWER_REASONS.includes(out.error.reason), out.error.reason);
      assert.deepEqual(resolved.error, out.error);
    }
    assert.ok(refused >= 3000, `${id}: refused ${refused}`);
  }
});

// The nine reasons, one by one, built on purpose (not hoped for from random values).
function find(tenant, type) {
  for (const base of Object.values(demoAnswers(tenant.id))) {
    const seen = resolveAnswers(tenant, base).visible;
    const q = tenant.questions.find(
      (x) => seen.includes(x.id) && x.type === type,
    );
    if (q) return { base, q };
  }
  throw new Error(`${tenant.id}: no visible ${type} question in the sets`);
}

test("PE-R1: all nine reasons of the error are met on each demo tenant, each on a set spoiled in one place on purpose", () => {
  for (const id of DEMO_IDS) {
    const tenant = demoTenant(id);
    const seen = new Set();
    const expect = (answers, question, reason) => {
      const out = computeResult(tenant, answers);
      assert.equal(out.ok, false, `${id} ${reason}`);
      assert.deepEqual(
        out.error,
        { code: "E_ANSWER", question, reason },
        `${id} ${reason}`,
      );
      assert.deepEqual(resolveAnswers(tenant, answers).error, out.error);
      seen.add(reason);
    };
    const one = find(tenant, "single");
    const many = find(tenant, "multiple");
    const num = find(tenant, "number");
    const first = Object.keys(many.base)[0];
    expect(null, null, "not_object");
    expect(
      { ...one.base, "no-such-question": 1 },
      "no-such-question",
      "unknown_question",
    );
    expect(
      { ...one.base, [one.q.id]: [one.q.options[0].id] },
      one.q.id,
      "wrong_kind",
    );
    expect(
      { ...one.base, [one.q.id]: "no-such-option" },
      one.q.id,
      "unknown_option",
    );
    expect(
      {
        ...many.base,
        [many.q.id]: [many.q.options[0].id, many.q.options[0].id],
      },
      many.q.id,
      "duplicate_option",
    );
    // a repeat that does not stand next to its first (or is not the first item)
    const [o0, o1, o2] = many.q.options.map((o) => o.id);
    expect(
      { ...many.base, [many.q.id]: [o0, o1, o0] },
      many.q.id,
      "duplicate_option",
    );
    if (o2 !== undefined) {
      expect(
        { ...many.base, [many.q.id]: [o0, o1, o2, o1] },
        many.q.id,
        "duplicate_option",
      );
    }
    expect({ ...many.base, [many.q.id]: [] }, many.q.id, "empty_list");
    expect({ ...num.base, [num.q.id]: 2.5 }, num.q.id, "not_integer");
    expect(
      { ...num.base, [num.q.id]: num.q.max + 1 },
      num.q.id,
      "out_of_range",
    );
    const lacking = { ...one.base };
    const required = tenant.questions.find(
      (x) =>
        x.required &&
        Object.hasOwn(lacking, x.id) &&
        resolveAnswers(tenant, one.base).visible.includes(x.id),
    );
    delete lacking[required.id];
    // a question that is required but hidden now would not be named: the first missing one is
    const named = tenant.questions.find(
      (x) =>
        x.required &&
        !Object.hasOwn(lacking, x.id) &&
        visibleQuestions(tenant, lacking).includes(x.id),
    );
    expect(lacking, named.id, "missing_required");
    assert.ok(first !== undefined);
    assert.deepEqual([...seen].sort(), [...ANSWER_REASONS].sort(), id);
  }
});

// ---------------------------------------------------------------------- PE-R2

function hugeKeys(base) {
  const out = { ...base };
  for (let i = 0; i < 1e6; i++) out[`k${i}`] = 1;
  return out;
}
function nested(depth) {
  let value = [];
  for (let i = 0; i < depth; i++) value = [value];
  return value;
}

test(
  "PE-R2: an object of a million extra keys is an error, not an exception",
  { timeout: 30000 },
  () => {
    const out = computeResult(
      pico(),
      hugeKeys({ a: "a1", b: ["b1"], c: 5, d: "d1" }),
    );
    assert.deepEqual(out.error, {
      code: "E_ANSWER",
      question: "k0",
      reason: "unknown_question",
    });
    assert.equal(Object.hasOwn(out, "result"), false);
    assert.equal(resolveAnswers(pico(), hugeKeys({})).ok, false);
    assert.equal(visibleQuestions(pico(), hugeKeys({})).join(), "a,b,c");
  },
);

test(
  "PE-R2: a list of a million elements for a multiple question is an error, not an exception",
  { timeout: 30000 },
  () => {
    const wide = Array.from({ length: 1e6 }, (_, i) => `x${i}`);
    const answers = { a: "a1", b: wide, c: 5, d: "d1" };
    assert.deepEqual(computeResult(pico(), answers).error, {
      code: "E_ANSWER",
      question: "b",
      reason: "unknown_option",
    });
    const same = {
      a: "a1",
      b: Array.from({ length: 1e6 }, () => "b1"),
      c: 5,
      d: "d1",
    };
    assert.deepEqual(computeResult(pico(), same).error, {
      code: "E_ANSWER",
      question: "b",
      reason: "duplicate_option",
    });
    assert.equal(answers.b.length, 1e6);
    assert.equal(same.b.length, 1e6);
  },
);

test(
  "PE-R2: a value nested a hundred thousand deep is an error, not an exception",
  { timeout: 30000 },
  () => {
    const deep = nested(1e5);
    const base = { a: "a1", b: ["b1"], c: 5, d: "d1" };
    assert.deepEqual(computeResult(pico(), { ...base, a: deep }).error, {
      code: "E_ANSWER",
      question: "a",
      reason: "wrong_kind",
    });
    assert.deepEqual(computeResult(pico(), { ...base, zz: deep }).error, {
      code: "E_ANSWER",
      question: "zz",
      reason: "unknown_question",
    });
    assert.deepEqual(computeResult(pico(), { ...base, b: [deep] }).error, {
      code: "E_ANSWER",
      question: "b",
      reason: "wrong_kind",
    });
    assert.equal(computeResult(pico(), deep).ok, false);
    assert.equal(
      computeResult(pico(), { ...base, c: deep }).error.reason,
      "wrong_kind",
    );
  },
);

test("PE-R2: the key __proto__ from JSON.parse and the key constructor are unknown questions; answers with no prototype are taken; an inherited property is no answer", () => {
  const proto = JSON.parse(
    '{"a":"a1","b":["b1"],"c":5,"d":"d1","__proto__":{"a":"a2"}}',
  );
  assert.equal(Object.hasOwn(proto, "__proto__"), true);
  const out = computeResult(pico(), proto);
  assert.deepEqual(out.error, {
    code: "E_ANSWER",
    question: "__proto__",
    reason: "unknown_question",
  });
  assert.deepEqual(
    Object.getPrototypeOf(proto),
    Object.prototype,
    "the prototype is the usual one",
  );
  assert.deepEqual(
    computeResult(pico(), JSON.parse('{"__proto__":{}}')).error.question,
    "__proto__",
  );
  for (const tenant of [pico(), noProto(pico())]) {
    assert.deepEqual(
      computeResult(
        tenant,
        JSON.parse('{"a":"a1","b":["b1"],"c":5,"d":"d1","constructor":"x"}'),
      ).error,
      {
        code: "E_ANSWER",
        question: "constructor",
        reason: "unknown_question",
      },
    );
    assert.deepEqual(
      computeResult(tenant, JSON.parse('{"toString":1}')).error.reason,
      "unknown_question",
    );
    const bare = Object.assign(Object.create(null), {
      a: "a1",
      b: ["b1"],
      c: 5,
      d: "d1",
    });
    assert.equal(computeResult(tenant, bare).ok, true);
    assert.equal(
      JSON.stringify(computeResult(tenant, bare)),
      JSON.stringify(
        computeResult(tenant, { a: "a1", b: ["b1"], c: 5, d: "d1" }),
      ),
    );
    const inherited = Object.create({ a: "a1", b: ["b1"], c: 5, d: "d1" });
    assert.deepEqual(computeResult(tenant, inherited).error, {
      code: "E_ANSWER",
      question: "a",
      reason: "missing_required",
    });
  }
});

// ---------------------------------------------------------------------- PE-R4

test("PE-R4: a tenant with no hypotheses and no price or duration gives hypotheses [] and no such keys", () => {
  const bare = pico();
  delete bare.hypotheses;
  for (const s of bare.solutions) {
    delete s.price_text;
    delete s.duration_text;
  }
  assert.deepEqual(validateTenant(bare, { fileName: "pico-test.json" }), []);
  const copy = deepCopy(bare);
  for (const [, answers] of [
    [0, { a: "a2", b: ["b2"], c: 15, d: "d1" }],
    [1, { a: "a1", b: ["b1"], c: 50, d: "d1" }],
    [2, { a: "a1", b: ["b3"], c: 0, d: "d2", e: "e1" }],
  ]) {
    const result = computeResult(bare, answers).result;
    assert.deepEqual(result.hypotheses, []);
    for (const item of result.recommended) {
      assert.equal(Object.hasOwn(item, "price_text"), false);
      assert.equal(Object.hasOwn(item, "duration_text"), false);
      assert.deepEqual(Object.keys(item).slice(-3), [
        "not_suitable_when",
        "score",
        "rules",
      ]);
    }
  }
  assert.deepEqual(bare, copy);
  // the same on 1000 sets of a fictional tenant with the fields cut out
  const tenant = deepCopy(demoTenant("uchet-pro"));
  delete tenant.hypotheses;
  for (const s of tenant.solutions) {
    delete s.price_text;
    delete s.duration_text;
  }
  for (const answers of sets(tenant, 5504, 300)) {
    const result = computeResult(tenant, answers).result;
    assert.deepEqual(result.hypotheses, []);
    for (const item of result.recommended) {
      assert.equal(Object.hasOwn(item, "price_text"), false);
      assert.equal(Object.hasOwn(item, "duration_text"), false);
    }
  }
});
