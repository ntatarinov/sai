// QM-1 ... QM-5: the pure modules of the page of the picker site (design REQ-057, 6.4 and
// 17.2): the rule of the visible questions against the engine, the progress and the model
// of the questionnaire, the storage of the browser, the network and the texts. The modules
// run in Node without a document; the storage and the network are fakes that the test
// controls and records. The expected values are written here or come from the engine and
// from the validator of the tenant files (the server side), never from the page.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeResult,
  resolveAnswers,
  visibleQuestions,
} from "../src/picker/engine.js";
import { validateTenant } from "../src/picker/validate.js";
import { el, part, setText } from "../src/picker/public/dom.js";
import { renderResult } from "../src/picker/public/result.js";
import {
  bodyAnswers,
  entryQuestion,
  firstVisible,
  isLastVisible,
  nextVisible,
  openQuestion,
  previousVisible,
  progress,
  pruneAnswers,
  readNumber,
  setAnswer,
  verdict,
} from "../src/picker/public/flow.js";
import {
  API_QUESTIONNAIRE,
  API_RESULT,
  REQUEST_TIMEOUT_MS,
  getQuestionnaire,
  postResult,
} from "../src/picker/public/net.js";
import { checkAnswer, visibleIds } from "../src/picker/public/rules.js";
import { say } from "../src/picker/public/say.js";
import {
  STORAGE_PREFIX,
  clearSaved,
  readSaved,
  tenantIdOf,
  writeSaved,
} from "../src/picker/public/store.js";
import { fixtureJson, makeRng, visibleQuestionIds } from "./picker-helpers.js";
import {
  LANGS,
  RESULT_OK,
  click,
  demoSite,
  expectedProgress,
  loadPage,
  raw,
  same,
  s1Site,
} from "./picker-page-helpers.js";
import { expectedQuestionnaire } from "./picker-server-helpers.js";

const up = demoSite("uchet-pro");
const sm = demoSite("svet-marketing");
const SPECIAL_IDS = ["constructor", "toString", "valueOf", "hasOwnProperty"];

// ---------------------------------------------------------------- random files and answers

const GARBAGE = [
  null,
  true,
  false,
  "",
  0,
  -0,
  -1,
  1.5,
  1e21,
  2 ** 53,
  [],
  [1],
  ["a", "a"],
  {},
  "__proto__",
  [null],
  "constructor",
  ["constructor"],
  { toString: 1 },
];
const NOT_OBJECTS = [null, 7, [], "text", true, ["a"]];

// A questionnaire of 3 to 10 questions of the three kinds; the conditions refer to
// questions above; some ids are names that every object has (constructor, toString).
function randomFile(rng) {
  const count = 3 + rng.int(8);
  const questions = [];
  for (let i = 0; i < count; i += 1) {
    const id =
      rng.next() < 0.3
        ? `${rng.pick(SPECIAL_IDS)}${i === 0 ? "" : ""}`
        : `q${i}`;
    const unique = questions.some((q) => q.id === id) ? `q${i}` : id;
    const kind = rng.pick(["single", "multiple", "number"]);
    const question = {
      id: unique,
      title: `Title ${i}`,
      type: kind,
      required: rng.next() < 0.7,
    };
    if (kind === "number") {
      question.min = rng.int(11) - 5;
      question.max = question.min + 1 + rng.int(20);
    } else {
      const options = 2 + rng.int(4);
      question.options = Array.from({ length: options }, (_, k) => ({
        id: rng.next() < 0.1 ? rng.pick(SPECIAL_IDS) + k : `o${k}`,
        label: `Option ${k}`,
      }));
    }
    if (i > 0 && rng.next() < 0.5) {
      const conditions = [];
      const used = new Set();
      for (let c = 0; c < 1 + rng.int(3); c += 1) {
        const target = questions[rng.int(questions.length)];
        if (used.has(target.id)) continue;
        used.add(target.id);
        conditions.push(randomCondition(target, rng));
      }
      if (conditions.length > 0) question.show_if = conditions;
    }
    questions.push(question);
  }
  return questions;
}

function randomCondition(target, rng) {
  const condition = { question: target.id };
  const wrongKind = rng.next() < 0.1;
  if (target.type === "number" && !wrongKind) {
    const pick = () => target.min + rng.int(target.max - target.min + 1);
    const form = rng.int(3);
    if (form !== 1) condition.min = pick();
    if (form !== 0) condition.max = pick();
  } else if (target.type !== "number" && !wrongKind) {
    const ids = target.options.map((o) => o.id);
    const chosen = ids.filter(() => rng.next() < 0.5);
    condition[rng.next() < 0.6 ? "any_of" : "none_of"] =
      chosen.length > 0 ? chosen : [ids[0]];
  } else if (target.type === "number") {
    condition.any_of = ["o0"];
  } else {
    condition.min = 1;
  }
  return condition;
}

function validAnswer(question, rng) {
  if (question.type === "number")
    return question.min + rng.int(question.max - question.min + 1);
  const ids = question.options.map((o) => o.id);
  if (question.type === "single") return rng.pick(ids);
  const picked = ids.filter(() => rng.next() < 0.5);
  const list = picked.length > 0 ? picked : [rng.pick(ids)];
  return rng.next() < 0.5 ? list : [...list].reverse();
}

// The answers that are not right for this question: garbage, out of the limits, repeats in a
// list, an option that is not there.
function wrongAnswer(question, rng) {
  const roll = rng.next();
  if (roll < 0.35) return rng.pick(GARBAGE);
  if (question.type === "number")
    return rng.pick([
      question.min - 1,
      question.max + 1,
      question.min + 0.5,
      "5",
      [question.min],
    ]);
  const id = question.options[0].id;
  return rng.pick([
    [],
    [id, id],
    ["nowhere"],
    "nowhere",
    [id, 5],
    3,
    [[id]],
    { [id]: true },
  ]);
}

function answerSet(questions, rng, tally) {
  if (rng.next() < 0.03) {
    tally.notObject += 1;
    return rng.pick(NOT_OBJECTS);
  }
  const set = {};
  const goodShare = [0.9, 0.6, 0.3, 0.8][rng.int(4)];
  const skipShare = rng.next() < 0.3 ? 0.6 : 0.1;
  for (const question of questions) {
    const r = rng.next();
    if (r < skipShare) {
      tally.skipped += 1;
    } else if (rng.next() < goodShare) {
      set[question.id] = validAnswer(question, rng);
      tally.valid += 1;
    } else {
      set[question.id] = wrongAnswer(question, rng);
      tally.wrong += 1;
    }
  }
  if (rng.next() < 0.05) {
    set["not-in-the-file"] = "x";
    tally.extra += 1;
  }
  return set;
}

const sameList = (a, b) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------------- QM-1

test("QM-1a: the rule of the visible questions on the page equals the engine - 6 forms of the demo files (2 tenants in 3 languages) and 300 generated files, 4000 sets of answers each (more than a million), the same list of visible questions every time", () => {
  const rng = makeRng(57003);
  const files = [];
  for (const site of [up, sm])
    for (const lang of LANGS) files.push(site.body(lang).questions);
  for (let i = 0; i < 300; i += 1) files.push(randomFile(rng));
  assert.equal(files.length, 306);
  const tally = { valid: 0, wrong: 0, skipped: 0, notObject: 0, extra: 0 };
  let sets = 0;
  let shown = 0;
  for (const questions of files) {
    const tenant = { questions };
    for (let i = 0; i < 4000; i += 1) {
      const answers = answerSet(questions, rng, tally);
      const expected = visibleQuestions(tenant, answers);
      const got = visibleIds(questions, answers);
      if (!sameList(got, expected))
        assert.deepEqual(got, expected, JSON.stringify([questions, answers]));
      shown += expected.length;
      sets += 1;
    }
  }
  assert.ok(sets >= 1_000_000, `${sets} sets`);
  // the sets reach every class of input and the conditions hold in many of them
  for (const [kind, count] of Object.entries(tally))
    assert.ok(count > 1000, `${kind}: ${count}`);
  assert.ok(shown > sets * 2, "many questions are visible");
});

test("QM-1b: single wrong answers on every question of the six demo files, and answers that are not an object - the page and the engine agree on which questions are visible", () => {
  const rng = makeRng(57004);
  for (const site of [up, sm]) {
    for (const lang of LANGS) {
      const questions = site.body(lang).questions;
      const tenant = { questions };
      for (const q of questions) {
        const values = [...GARBAGE];
        if (q.type === "number")
          values.push(q.min - 1, q.min, q.max, q.max + 1, 2 ** 31, -(2 ** 31));
        else
          values.push(
            ...q.options.map((o) => o.id),
            [q.options[0].id, q.options[0].id],
            ["nowhere"],
          );
        for (const value of values) {
          const answers = { [q.id]: value };
          assert.deepEqual(
            visibleIds(questions, answers),
            visibleQuestions(tenant, answers),
            `${site.id} ${lang} ${q.id} ${JSON.stringify(value)}`,
          );
        }
      }
      for (const value of NOT_OBJECTS)
        assert.deepEqual(
          visibleIds(questions, value),
          visibleQuestions(tenant, value),
        );
      assert.deepEqual(
        visibleIds(questions, undefined),
        visibleQuestions(tenant, undefined),
      );
    }
  }
  assert.ok(rng.next() >= 0);
});

// The engine's verdict on one answer to one question (no conditions, not required).
function engineSays(question, raw) {
  const alone = { ...question, required: false };
  delete alone.show_if;
  const out = resolveAnswers({ questions: [alone] }, { [question.id]: raw });
  if (!out.ok) return { ok: false, reason: out.error.reason };
  return { ok: true, value: out.answers[question.id] };
}

test("QM-1c: the check of one answer on the page equals the engine - for every question of every file, 400 values: right ones in all forms, the limits of numbers, repeats and unknown options, garbage; ok, the reason and the normal form are the same", () => {
  const rng = makeRng(57005);
  const files = [];
  for (const site of [up, sm])
    for (const lang of LANGS) files.push(site.body(lang).questions);
  for (let i = 0; i < 40; i += 1) files.push(randomFile(rng));
  let checked = 0;
  let accepted = 0;
  const reasons = new Set();
  for (const questions of files) {
    for (const q of questions) {
      const values = [...GARBAGE];
      if (q.type === "number") {
        values.push(
          q.min - 1,
          q.min,
          q.max,
          q.max + 1,
          q.min + 0.5,
          String(q.min),
          [q.min],
        );
      } else {
        const ids = q.options.map((o) => o.id);
        values.push(
          ...ids,
          ids,
          [...ids].reverse(),
          [ids[0], ids[0]],
          ["nowhere"],
          "nowhere",
          [ids[0], 7],
        );
      }
      while (values.length < 400) {
        values.push(
          rng.next() < 0.5 ? validAnswer(q, rng) : wrongAnswer(q, rng),
        );
      }
      for (const raw of values) {
        const mine = checkAnswer(q, raw);
        const theirs = engineSays(q, raw);
        const label = `${q.id} ${JSON.stringify(raw)}`;
        assert.equal(mine.ok, theirs.ok, label);
        if (theirs.ok) {
          assert.deepEqual(mine.value, theirs.value, label);
          accepted += 1;
        } else {
          assert.equal(mine.reason, theirs.reason, label);
          reasons.add(theirs.reason);
        }
        checked += 1;
      }
    }
  }
  assert.ok(checked > 100_000, `${checked}`);
  assert.ok(accepted > 10_000);
  assert.deepEqual([...reasons].sort(), [
    "duplicate_option",
    "empty_list",
    "not_integer",
    "out_of_range",
    "unknown_option",
    "wrong_kind",
  ]);
});

// The path of a visitor through a questionnaire with the functions of the model: the
// answers are right, optional ones are sometimes skipped, sometimes the visitor goes back
// and changes an answer. Returns the answers at the end.
function walkModel(questions, rng) {
  let answers = Object.create(null);
  let current = firstVisible(questions);
  for (let guard = 0; guard < 200 && current !== null; guard += 1) {
    const question = questions.find((q) => q.id === current);
    const skip = !question.required && rng.next() < 0.3;
    answers = setAnswer(
      questions,
      answers,
      current,
      skip ? undefined : validAnswer(question, rng),
    );
    if (rng.next() < 0.12) {
      const back = previousVisible(questions, answers, current);
      if (back !== null) {
        current = back;
        continue;
      }
    }
    current = nextVisible(questions, answers, current);
  }
  return answers;
}

test("QM-1d: 5000 random walks through the two demo tenants with the model of the page (answers right, optional ones skipped, steps back with a change) - at the end the body of the request is accepted by the engine and its keys are exactly the visible questions that have an answer", () => {
  const rng = makeRng(57006);
  for (let run = 0; run < 5000; run += 1) {
    const site = run % 2 === 0 ? up : sm;
    const questions = site.body("ru").questions;
    const answers = walkModel(questions, rng);
    const body = bodyAnswers(questions, answers);
    assert.notEqual(
      site.result("ru", { ...body }),
      null,
      `${site.id} #${run}: the engine refuses ${JSON.stringify(body)}`,
    );
    const seen = visibleQuestionIds({ questions }, body);
    assert.deepEqual(
      Object.keys(body).sort(),
      questions
        .filter((q) => seen.has(q.id) && Object.hasOwn(body, q.id))
        .map((q) => q.id)
        .sort(),
    );
    for (const key of Object.keys(body))
      assert.ok(seen.has(key), `${site.id} #${run}: ${key} is hidden`);
    for (const q of questions) {
      if (seen.has(q.id) && q.required)
        assert.ok(Object.hasOwn(body, q.id), `${site.id} #${run}: ${q.id}`);
    }
  }
});

test("QM-1e: a text of a number and the engine - the strings that stand for whole numbers are accepted and give the same number as the engine takes, the others are refused by the page before they could reach it; 'Next' agrees with the engine on the number", () => {
  const question = {
    id: "n",
    title: "N",
    type: "number",
    required: true,
    min: -3,
    max: 3,
  };
  const tenant = { questions: [{ ...question, required: false }] };
  const texts = [
    "",
    "-",
    "1e3",
    "2.5",
    "+5",
    "0x10",
    "007",
    "-0",
    "9007199254740993",
    " 1",
    "1 ",
    "٣",
    "−1",
    "1_0",
    "--1",
    ".5",
    "5.",
  ];
  for (let n = -3; n <= 3; n += 1) texts.push(String(n));
  for (const text of texts) {
    const read = readNumber(text, false);
    if (read.state === "ok") {
      assert.equal(typeof read.value, "number", text);
      assert.ok(
        Object.is(read.value, Number(text) === 0 ? 0 : Number(text)),
        text,
      );
      const inRange =
        Number.isSafeInteger(read.value) && read.value >= -3 && read.value <= 3;
      const engine = resolveAnswers(tenant, { n: read.value });
      assert.equal(engine.ok, inRange, text);
      assert.equal(
        verdict(question, inRange ? read.value : undefined, read).ok,
        inRange,
        text,
      );
    } else {
      // the page does not hand a text like this to the engine at all
      assert.ok(["empty", "invalid"].includes(read.state), text);
      assert.equal(
        /^-?[0-9]+$/u.test(text) && Number.isSafeInteger(Number(text)),
        false,
        text,
      );
    }
  }
  for (let n = -3; n <= 3; n += 1)
    assert.deepEqual(readNumber(String(n), false), { state: "ok", value: n });
});

test("QM-1f: rules.js has no import and no name of the engine, reaches for no process, and exports exactly checkAnswer and visibleIds", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const file = path.join(
    import.meta.dirname,
    "..",
    "src",
    "picker",
    "public",
    "rules.js",
  );
  const text = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(text, /^\s*import\b|\bimport\s*\(/mu);
  assert.doesNotMatch(text, /engine/iu);
  assert.doesNotMatch(text, /\bprocess\b/u);
  const exports = [
    ...text.matchAll(
      /^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gmu,
    ),
  ].map((m) => m[1]);
  assert.deepEqual(exports.sort(), ["checkAnswer", "visibleIds"]);
  assert.doesNotMatch(text, /^export\s*\{/mu);
  assert.doesNotMatch(text, /^export\s+default/mu);
});

// ---------------------------------------------------------------------- QM-2

const S1 = s1Site().body("ru").questions;

test("QM-2a: the progress - the seven rows of design 5.3 as literals on the small file S1, and on 300 generated files the number N never grows from one question to the next on a way forward", () => {
  const rows = [
    // [answers, current, k, n]
    [{}, "a", 1, 6],
    [{ a: "p" }, "b", 2, 5],
    [{ a: "p", b: "p" }, "d", 3, 5],
    [{ a: "p", b: "p", d: "p" }, "e", 4, 5],
    [{ a: "p", b: "p", d: "p", e: "q" }, "f", 5, 5],
    [{ a: "q", d: "p", e: "q" }, "a", 1, 6],
    [{ a: "q", d: "p", e: "q" }, "c", 2, 5],
  ];
  for (const [answers, current, k, n] of rows)
    assert.deepEqual(progress(S1, answers, current), { k, n }, current);
  // a place that is not in the file: nothing is placed, and nothing is thrown
  assert.equal(progress(S1, {}, "nowhere").k, 0);
  // N on the generated files: forward paths, a question unanswered when it is reached
  const rng = makeRng(57002);
  let walked = 0;
  for (let f = 0; f < 300; f += 1) {
    const questions = randomFile(rng);
    for (let p = 0; p < 20; p += 1) {
      let answers = Object.create(null);
      let current = firstVisible(questions);
      let before = Infinity;
      while (current !== null) {
        const here = progress(questions, answers, current);
        assert.ok(
          here.n <= before,
          `file ${f} path ${p}: N grew at ${current}`,
        );
        assert.deepEqual(
          here,
          expectedProgress(questions, answers, current),
          `file ${f} ${current}`,
        );
        before = here.n;
        const question = questions.find((q) => q.id === current);
        const skip = !question.required && rng.next() < 0.3;
        answers = setAnswer(
          questions,
          answers,
          current,
          skip ? undefined : validAnswer(question, rng),
        );
        // the answer to the current question does not change N
        assert.equal(
          progress(questions, answers, current).n,
          here.n,
          `file ${f} ${current}: N moved with the answer`,
        );
        current = nextVisible(questions, answers, current);
        walked += 1;
      }
    }
  }
  assert.ok(walked > 5000, `${walked}`);
});

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

test("QM-2b: setAnswer - the chain of hiding (a hides b, and b hides c), an answer cleared, a wrong value counts as cleared, a list is stored in the order of the options, the input is not changed and the result is a new object without a prototype", () => {
  const chain = [
    {
      id: "a",
      title: "A",
      type: "single",
      required: true,
      options: [
        { id: "p", label: "P" },
        { id: "q", label: "Q" },
      ],
    },
    {
      id: "b",
      title: "B",
      type: "single",
      required: true,
      options: [
        { id: "x", label: "X" },
        { id: "y", label: "Y" },
      ],
      show_if: [{ question: "a", any_of: ["p"] }],
    },
    {
      id: "c",
      title: "C",
      type: "multiple",
      required: true,
      options: [
        { id: "m", label: "M" },
        { id: "n", label: "N" },
        { id: "o", label: "O" },
      ],
      show_if: [{ question: "b", any_of: ["x"] }],
    },
    {
      id: "d",
      title: "D",
      type: "number",
      required: false,
      min: 0,
      max: 9,
      show_if: [{ question: "c", any_of: ["o"] }],
    },
  ];
  const full = deepFreeze({
    __proto__: null,
    a: "p",
    b: "x",
    c: ["m", "o"],
    d: 4,
  });
  const hidden = setAnswer(chain, full, "a", "q");
  assert.deepEqual({ ...hidden }, { a: "q" }, "b, c and d all go");
  assert.equal(Object.getPrototypeOf(hidden), null);
  assert.notEqual(hidden, full);
  assert.deepEqual(
    { ...full },
    { a: "p", b: "x", c: ["m", "o"], d: 4 },
    "the input is as it was",
  );
  // a step in the middle of the chain
  assert.deepEqual({ ...setAnswer(chain, full, "b", "y") }, { a: "p", b: "y" });
  assert.deepEqual(
    { ...setAnswer(chain, full, "c", ["n"]) },
    { a: "p", b: "x", c: ["n"] },
  );
  // cleared and wrong values
  assert.deepEqual({ ...setAnswer(chain, full, "b", undefined) }, { a: "p" });
  assert.deepEqual(
    { ...setAnswer(chain, full, "d", 99) },
    { a: "p", b: "x", c: ["m", "o"] },
  );
  assert.deepEqual({ ...setAnswer(chain, full, "c", []) }, { a: "p", b: "x" });
  assert.deepEqual(
    { ...setAnswer(chain, full, "c", ["m", "m"]) },
    { a: "p", b: "x" },
  );
  assert.deepEqual(
    { ...setAnswer(chain, full, "zzz", "p") },
    { a: "p", b: "x", c: ["m", "o"], d: 4 },
  );
  // the order of the options, not the order of the choosing
  assert.deepEqual(
    {
      ...setAnswer(chain, { __proto__: null, a: "p", b: "x" }, "c", ["o", "m"]),
    },
    { a: "p", b: "x", c: ["m", "o"] },
  );
  // an answer to a question that is hidden by the answers is not kept
  assert.deepEqual(
    { ...setAnswer(chain, { __proto__: null, a: "q" }, "b", "x") },
    { a: "q" },
  );
  // answers that are not an object are no answers
  for (const bad of [null, undefined, 5, "text", ["a"]])
    assert.deepEqual({ ...setAnswer(chain, bad, "a", "p") }, { a: "p" });
});

test("QM-2e: pruneAnswers and bodyAnswers - only the own answers of the visible questions that are right, each in its normal form (a single choice as the id, a list in the order of the options, a number), unknown keys, hidden and wrong answers dropped; the input is not changed; a new object without a prototype", () => {
  const given = deepFreeze({
    __proto__: null,
    a: "p",
    b: "p",
    c: "q", // hidden: a = p
    d: "p",
    e: "zz", // wrong
    f: "q",
    nowhere: "p",
    constructor: "x",
  });
  const out = pruneAnswers(S1, given);
  assert.deepEqual({ ...out }, { a: "p", b: "p", d: "p", f: "q" });
  assert.equal(Object.getPrototypeOf(out), null);
  assert.deepEqual({ ...bodyAnswers(S1, given) }, { ...out });
  assert.notEqual(out, given);
  // forms: a list in the order of the options, a number
  const file = [
    {
      id: "m",
      title: "M",
      type: "multiple",
      required: true,
      options: [
        { id: "x", label: "X" },
        { id: "y", label: "Y" },
        { id: "z", label: "Z" },
      ],
    },
    { id: "n", title: "N", type: "number", required: true, min: 0, max: 9 },
  ];
  assert.deepEqual(
    { ...pruneAnswers(file, { m: ["z", "x"], n: 4 }) },
    { m: ["x", "z"], n: 4 },
  );
  assert.deepEqual({ ...pruneAnswers(file, { m: ["z", "z"], n: 10 }) }, {});
  assert.deepEqual({ ...pruneAnswers(file, { m: [], n: -0 }) }, { n: 0 });
  // answers that are no object are no answers
  for (const bad of [null, undefined, 3, "text", [{ m: ["x"] }]])
    assert.deepEqual({ ...pruneAnswers(file, bad) }, {});
  // a key that every object has is not an answer unless the file has such a question
  const proto = { __proto__: { m: ["x"] } };
  assert.deepEqual({ ...pruneAnswers(file, proto) }, {});
});

test("QM-2c: the steps of the questionnaire - next, previous, first, last, the first open required question and the question to continue from; 28 rows with the edges (an unknown place, a saved place that is hidden, a required question open above the place)", () => {
  // S1 with a = p: visible a b d f ; with a = q: a c d f ; d = p opens e
  const rows = [
    // [function, answers, current, expected]
    [nextVisible, {}, "a", "d"],
    [nextVisible, { a: "p" }, "a", "b"],
    [nextVisible, { a: "q" }, "a", "c"],
    [nextVisible, { a: "p" }, "b", "d"],
    [nextVisible, { a: "p", d: "p" }, "d", "e"],
    [nextVisible, { a: "p", d: "q" }, "d", "f"],
    [nextVisible, { a: "p" }, "f", null],
    [nextVisible, { a: "p" }, "c", null], // c is hidden: no place
    [nextVisible, { a: "p" }, "nowhere", null],
    [previousVisible, { a: "p" }, "a", null],
    [previousVisible, { a: "p" }, "b", "a"],
    [previousVisible, { a: "p" }, "d", "b"],
    [previousVisible, { a: "q" }, "d", "c"],
    [previousVisible, { a: "p", d: "p" }, "f", "e"],
    [previousVisible, { a: "p" }, "nowhere", null],
    [isLastVisible, { a: "p" }, "f", true],
    [isLastVisible, { a: "p" }, "d", false],
    [isLastVisible, {}, "nowhere", true],
    [openQuestion, {}, undefined, "a"],
    [openQuestion, { a: "p" }, undefined, "b"],
    [openQuestion, { a: "p", b: "p", d: "p", e: "q" }, undefined, "f"],
    [openQuestion, { a: "p", b: "p", d: "p", e: "q", f: "q" }, undefined, null],
    [openQuestion, { a: "p", b: "zz" }, undefined, "b"], // a wrong answer is no answer
    [entryQuestion, { a: "p", b: "p" }, "d", "d"],
    [entryQuestion, { a: "p", b: "p" }, "e", "d"], // e is hidden: the first without an answer
    [entryQuestion, { a: "p" }, "f", "b"], // not beyond the first open required question
    [entryQuestion, { a: "p", b: "p", d: "q", f: "p" }, "a", "a"],
    [entryQuestion, {}, null, "a"],
  ];
  assert.ok(rows.length >= 25);
  for (const [fn, answers, current, expected] of rows) {
    const got =
      fn === openQuestion ? fn(S1, answers) : fn(S1, answers, current);
    assert.equal(
      got,
      expected,
      `${fn.name} ${JSON.stringify(answers)} ${current}`,
    );
  }
  assert.equal(firstVisible(S1), "a");
  assert.equal(firstVisible([]), null);
  // entryQuestion: all answered, the saved place stays; an empty file has no place
  assert.equal(
    entryQuestion(S1, { a: "p", b: "p", d: "p", e: "q", f: "q" }, "e"),
    "e",
  );
  assert.equal(entryQuestion([], {}, "a"), null);
  // "required" is read from the file: an optional question open is not open
  const optional = [
    {
      id: "z",
      title: "Z",
      type: "single",
      required: false,
      options: [
        { id: "x", label: "X" },
        { id: "y", label: "Y" },
      ],
    },
  ];
  assert.equal(openQuestion(optional, {}), null);
  assert.equal(entryQuestion(optional, {}, null), "z");
});

test("QM-2d: the number in the field and the verdict of 'Next' - 36 rows: empty, bad input, signs, leading zeros, minus zero, the limits, 16 digits, the safe whole numbers", () => {
  const rows = [
    ["", false, { state: "empty" }],
    ["", true, { state: "invalid" }],
    ["abc", true, { state: "invalid" }],
    ["abc", false, { state: "invalid" }],
    ["-", false, { state: "invalid" }],
    ["+5", false, { state: "invalid" }],
    ["1e3", false, { state: "invalid" }],
    ["1E3", false, { state: "invalid" }],
    ["2.5", false, { state: "invalid" }],
    [".5", false, { state: "invalid" }],
    ["5.", false, { state: "invalid" }],
    ["0x10", false, { state: "invalid" }],
    [" 5", false, { state: "invalid" }],
    ["5 ", false, { state: "invalid" }],
    ["--5", false, { state: "invalid" }],
    ["١٢", false, { state: "invalid" }],
    ["5", false, { state: "ok", value: 5 }],
    ["007", false, { state: "ok", value: 7 }],
    ["-5", false, { state: "ok", value: -5 }],
    ["0", false, { state: "ok", value: 0 }],
    ["-0", false, { state: "ok", value: 0 }],
    ["000", false, { state: "ok", value: 0 }],
    ["9007199254740991", false, { state: "ok", value: 9007199254740991 }],
    ["-9007199254740991", false, { state: "ok", value: -9007199254740991 }],
    ["9007199254740992", false, { state: "invalid" }],
    ["9007199254740993", false, { state: "invalid" }],
    ["99999999999999999999", false, { state: "invalid" }],
    ["1000000000000000", false, { state: "ok", value: 1000000000000000 }],
  ];
  for (const [text, bad, expected] of rows) {
    const got = readNumber(text, bad);
    assert.deepEqual(got, expected, JSON.stringify([text, bad]));
    if (got.state === "ok")
      assert.ok(Object.is(got.value, expected.value), text);
  }
  assert.deepEqual(readNumber(5, false), { state: "invalid" }, "not a text");
  assert.deepEqual(readNumber(undefined, false), { state: "invalid" });
  // the verdict of "Next"
  const required = { id: "n", type: "number", required: true, min: 1, max: 10 };
  const optional = { ...required, required: false };
  const single = {
    id: "s",
    type: "single",
    required: true,
    options: [
      { id: "x", label: "X" },
      { id: "y", label: "Y" },
    ],
  };
  const verdicts = [
    [required, 5, readNumber("5", false), { ok: true }],
    [
      required,
      undefined,
      readNumber("", false),
      { ok: false, message: "required" },
    ],
    [
      required,
      undefined,
      readNumber("abc", true),
      { ok: false, message: "range" },
    ],
    [
      required,
      undefined,
      readNumber("0", false),
      { ok: false, message: "range" },
    ],
    [
      required,
      undefined,
      readNumber("11", false),
      { ok: false, message: "range" },
    ],
    [required, 1, readNumber("1", false), { ok: true }],
    [required, 10, readNumber("10", false), { ok: true }],
    [optional, undefined, readNumber("", false), { ok: true }],
    [
      optional,
      undefined,
      readNumber("abc", true),
      { ok: false, message: "range" },
    ],
    [
      optional,
      undefined,
      readNumber("11", false),
      { ok: false, message: "range" },
    ],
    [optional, 3, readNumber("3", false), { ok: true }],
    [single, undefined, undefined, { ok: false, message: "required" }],
    [single, "x", undefined, { ok: true }],
    [single, "nowhere", undefined, { ok: false, message: "required" }],
    [{ ...single, required: false }, undefined, undefined, { ok: true }],
  ];
  assert.ok(rows.length + verdicts.length >= 30);
  for (const [question, raw, numberState, expected] of verdicts)
    assert.deepEqual(
      verdict(question, raw, numberState),
      expected,
      JSON.stringify([question.id, raw, numberState]),
    );
});

// ---------------------------------------------------------------------- QM-3

// Puts a recording fake of localStorage into the global scope for the test.
function fakeStorage(
  t,
  {
    values = {},
    failGet = false,
    failSet = false,
    failRemove = false,
    refuse = false,
  } = {},
) {
  const data = new Map(Object.entries(values));
  const log = [];
  const api = new Proxy(
    {
      getItem(key) {
        log.push(["getItem", key]);
        if (failGet) throw new DOMException("denied", "SecurityError");
        return data.has(key) ? data.get(key) : null;
      },
      setItem(key, value) {
        log.push(["setItem", key, value]);
        if (failSet) throw new DOMException("quota", "QuotaExceededError");
        data.set(key, String(value));
      },
      removeItem(key) {
        log.push(["removeItem", key]);
        if (failRemove) throw new DOMException("denied", "SecurityError");
        data.delete(key);
      },
    },
    {
      get(target, prop) {
        if (typeof prop === "symbol") return undefined;
        if (!Object.hasOwn(target, prop)) {
          log.push(["other", prop]);
          throw new TypeError(`not allowed: ${prop}`);
        }
        return target[prop];
      },
    },
  );
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (refuse) {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        log.push(["access"]);
        throw new DOMException("denied", "SecurityError");
      },
    });
  } else {
    Object.defineProperty(globalThis, "localStorage", {
      value: api,
      configurable: true,
      writable: true,
    });
  }
  t.after(() => {
    if (saved === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", saved);
  });
  return { data, log };
}

const VERSION = "ab".repeat(32);
const stateOf = (extra = {}) => ({
  format: 1,
  version: VERSION,
  lang: "kk",
  current: "items",
  answers: { business: "retail", items: 120, tools: ["paper"] },
  ...extra,
});
const KEYED = (id) => `${STORAGE_PREFIX}${id}`;

// A right value of exactly `length` signs (a key that the page does not read is padded).
function sizedValue(length) {
  const bare = JSON.stringify(stateOf({ pad: "" })).length;
  const text = JSON.stringify(stateOf({ pad: "x".repeat(length - bare) }));
  assert.equal(text.length, length);
  return text;
}

test("QM-3a: readSaved - every row of design 7.1: a storage that refuses, no key, a long value, text that is not JSON, values of another form, a wrong version, language, place and answers; and 1000 random values never throw", (t) => {
  const read = (value, id = "uchet-pro") => {
    fakeStorage(t, {
      values: value === undefined ? {} : { [KEYED(id)]: value },
    });
    return readSaved(id);
  };
  const empty = { version: null, lang: null, current: null, answers: {} };
  const plain = (r) => ({ ...r.saved, answers: { ...r.saved.answers } });
  // the storage refuses
  fakeStorage(t, { refuse: true });
  assert.deepEqual(readSaved("uchet-pro").ok, false);
  assert.deepEqual(plain(readSaved("uchet-pro")), empty);
  fakeStorage(t, { failGet: true });
  assert.equal(readSaved("uchet-pro").ok, false);
  // rows
  const rows = [
    ["no key", undefined, true, empty],
    ["not JSON", "not json {", true, empty],
    ["empty text", "", true, empty],
    ["null", "null", true, empty],
    ["list", "[]", true, empty],
    ["number", "42", true, empty],
    ["string", '"text"', true, empty],
    ["format 2", JSON.stringify(stateOf({ format: 2 })), true, empty],
    [
      "no format",
      JSON.stringify({ ...stateOf(), format: undefined }),
      true,
      empty,
    ],
    [
      "too long (32769)",
      JSON.stringify(stateOf({ pad: "x".repeat(32769) })),
      true,
      empty,
    ],
    // the limit of the whole value is 32768 signs (design 7.1): the value of exactly that
    // length is read, the value of one sign more is not
    ["exactly 32768 signs", sizedValue(32768), true, stateOf()],
    ["exactly 32769 signs", sizedValue(32769), true, empty],
    ["exactly 32767 signs", sizedValue(32767), true, stateOf()],
    ["the right value", JSON.stringify(stateOf()), true, stateOf()],
    [
      "version not hex",
      JSON.stringify(stateOf({ version: "xyz" })),
      true,
      { ...empty, lang: "kk" },
    ],
    [
      "version of 63 signs",
      JSON.stringify(stateOf({ version: "a".repeat(63) })),
      true,
      { ...empty, lang: "kk" },
    ],
    [
      "version in capitals",
      JSON.stringify(stateOf({ version: "AB".repeat(32) })),
      true,
      { ...empty, lang: "kk" },
    ],
    [
      "version a number",
      JSON.stringify(stateOf({ version: 5 })),
      true,
      { ...empty, lang: "kk" },
    ],
    [
      "language wrong",
      JSON.stringify(stateOf({ lang: "de" })),
      true,
      { ...stateOf(), lang: null },
    ],
    [
      "language in capitals",
      JSON.stringify(stateOf({ lang: "KK" })),
      true,
      { ...stateOf(), lang: null },
    ],
    [
      "place empty",
      JSON.stringify(stateOf({ current: "" })),
      true,
      { ...stateOf(), current: null },
    ],
    [
      "place of 65 signs",
      JSON.stringify(stateOf({ current: "c".repeat(65) })),
      true,
      { ...stateOf(), current: null },
    ],
    [
      "place of 64 signs",
      JSON.stringify(stateOf({ current: "c".repeat(64) })),
      true,
      { ...stateOf(), current: "c".repeat(64) },
    ],
    [
      "place a number",
      JSON.stringify(stateOf({ current: 3 })),
      true,
      { ...stateOf(), current: null },
    ],
    [
      "answers a list",
      JSON.stringify(stateOf({ answers: ["a"] })),
      true,
      { ...stateOf(), answers: {} },
    ],
    [
      "answers null",
      JSON.stringify(stateOf({ answers: null })),
      true,
      { ...stateOf(), answers: {} },
    ],
    [
      "no answers",
      JSON.stringify({ ...stateOf(), answers: undefined }),
      true,
      { ...stateOf(), answers: {} },
    ],
    [
      "answers of wrong forms are dropped, right ones stay",
      JSON.stringify(
        stateOf({
          answers: {
            ok1: "text",
            ok2: ["a", "b"],
            ok3: -5,
            "": "empty key",
            [`k${"k".repeat(64)}`]: "long key",
            bad1: { x: 1 },
            bad2: [],
            bad3: [1],
            bad4: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
            bad5: 1.5,
            bad6: "x".repeat(201),
            bad7: null,
            bad8: true,
            bad9: 2 ** 53,
          },
        }),
      ),
      true,
      { ...stateOf(), answers: { ok1: "text", ok2: ["a", "b"], ok3: -5 } },
    ],
    [
      "a string of 200 signs and a list of 8 are right",
      JSON.stringify(
        stateOf({
          answers: {
            s: "y".repeat(200),
            l: ["a", "b", "c", "d", "e", "f", "g", "h"],
          },
        }),
      ),
      true,
      {
        ...stateOf(),
        answers: {
          s: "y".repeat(200),
          l: ["a", "b", "c", "d", "e", "f", "g", "h"],
        },
      },
    ],
  ];
  for (const [label, value, ok, expected] of rows) {
    const got = read(value);
    assert.equal(got.ok, ok, label);
    assert.deepEqual(
      plain(got),
      expected.format === undefined
        ? expected
        : {
            version: expected.version,
            lang: expected.lang,
            current: expected.current,
            answers: expected.answers,
          },
      label,
    );
  }
  // at most 30 answers are taken
  const many = Object.fromEntries(
    Array.from({ length: 40 }, (_, i) => [`q${i}`, "x"]),
  );
  assert.equal(
    Object.keys(read(JSON.stringify(stateOf({ answers: many }))).saved.answers)
      .length,
    30,
  );
  // __proto__ is a plain key and pollutes nothing
  const proto = read(
    `{"format":1,"version":"${VERSION}","lang":"ru","current":null,"answers":{"__proto__":"x","constructor":["y"]}}`,
  );
  assert.equal({}.x, undefined);
  assert.equal(Object.getPrototypeOf(proto.saved.answers), null);
  assert.equal(proto.saved.answers.constructor.length, 1);
  // a path that is not an identifier is never read
  fakeStorage(t);
  assert.equal(readSaved(null).ok, false);
  assert.equal(readSaved("").ok, false);
  // 1000 random values: nothing throws, the answer is always the same shape
  const rng = makeRng(57007);
  const things = [
    null,
    true,
    7,
    -1.5,
    "",
    "a",
    [],
    [1, "a"],
    {},
    { format: 1 },
    { format: 1, version: VERSION, answers: { a: {} } },
    { __proto__: { format: 1 } },
  ];
  for (let i = 0; i < 1000; i += 1) {
    const value = rng.pick(things);
    const text =
      rng.next() < 0.5 ? JSON.stringify(value) : String(rng.pick(things));
    const got = read(text);
    assert.equal(typeof got.ok, "boolean");
    assert.ok(Object.hasOwn(got.saved, "answers"));
  }
});

test("QM-3b: writeSaved - exactly five keys; fields that are not part of the value (a name, a phone) do not get in even if the state holds them; a storage that throws gives false", (t) => {
  const fake = fakeStorage(t);
  const state = {
    ...stateOf(),
    name: "Ann",
    phone: "+7 700 000",
    email: "a@b",
    contact: "x",
  };
  delete state.format;
  assert.equal(writeSaved("uchet-pro", state), true);
  assert.equal(fake.log.length, 1);
  const [op, key, value] = fake.log[0];
  assert.deepEqual([op, key], ["setItem", "sai-picker:uchet-pro"]);
  const parsed = JSON.parse(value);
  assert.deepEqual(Object.keys(parsed), [
    "format",
    "version",
    "lang",
    "current",
    "answers",
  ]);
  assert.deepEqual(parsed, {
    format: 1,
    version: VERSION,
    lang: "kk",
    current: "items",
    answers: stateOf().answers,
  });
  assert.doesNotMatch(value, /Ann|phone|email|contact/u);
  // a null place is kept as null
  writeSaved("uchet-pro", { ...state, current: null, answers: {} });
  assert.equal(JSON.parse(fake.log[1][2]).current, null);
  // what was written is read back
  assert.deepEqual({ ...readSaved("uchet-pro").saved.answers }, {});
  // refusals
  fakeStorage(t, { failSet: true });
  assert.equal(writeSaved("uchet-pro", state), false);
  fakeStorage(t, { refuse: true });
  assert.equal(writeSaved("uchet-pro", state), false);
  // a state that cannot be turned into text
  const fake3 = fakeStorage(t);
  assert.equal(
    writeSaved("uchet-pro", { ...state, answers: { n: 10n } }),
    false,
  );
  assert.equal(writeSaved("", state), false);
  assert.equal(writeSaved(null, state), false);
  assert.deepEqual(fake3.log, [], "no id, no call");
});

test("QM-3c: clearSaved - one removeItem of the key of the tenant and nothing else; a storage that throws gives false", (t) => {
  const fake = fakeStorage(t, {
    values: {
      "sai-picker:uchet-pro": "x",
      "sai-picker:other": "y",
      foreign: "z",
    },
  });
  assert.equal(clearSaved("uchet-pro"), true);
  assert.deepEqual(fake.log, [["removeItem", "sai-picker:uchet-pro"]]);
  assert.deepEqual([...fake.data.keys()].sort(), [
    "foreign",
    "sai-picker:other",
  ]);
  fakeStorage(t, { failRemove: true });
  assert.equal(clearSaved("uchet-pro"), false);
  fakeStorage(t, { refuse: true });
  assert.equal(clearSaved("uchet-pro"), false);
  const none = fakeStorage(t);
  assert.equal(clearSaved(""), false);
  assert.deepEqual(none.log, []);
});

test("QM-3d: every call of the module to the storage is recorded: only getItem, setItem and removeItem, and only with the key 'sai-picker:<id>'; the prefix is that text", (t) => {
  assert.equal(STORAGE_PREFIX, "sai-picker:");
  const fake = fakeStorage(t, {
    values: { [KEYED("a-tenant")]: JSON.stringify(stateOf()) },
  });
  readSaved("a-tenant");
  writeSaved("a-tenant", stateOf());
  readSaved("a-tenant");
  clearSaved("a-tenant");
  readSaved("another-one");
  assert.deepEqual(
    fake.log.map((e) => e[0]),
    ["getItem", "setItem", "getItem", "removeItem", "getItem"],
  );
  assert.deepEqual(
    fake.log.map((e) => e[1]),
    ["a-tenant", "a-tenant", "a-tenant", "a-tenant", "another-one"].map(KEYED),
  );
  assert.equal(
    fake.log.some((e) => e[0] === "other"),
    false,
  );
});

test("QM-3e: tenantIdOf - 18 paths: only '/t/<id>/' with an id of 1 to 64 signs and no slash is an id", () => {
  const rows = [
    ["/t/uchet-pro/", "uchet-pro"],
    ["/t/a/", "a"],
    [`/t/${"a".repeat(64)}/`, "a".repeat(64)],
    [`/t/${"a".repeat(65)}/`, null],
    ["/t//", null],
    ["/t/uchet-pro", null],
    ["/t/uchet-pro/x/", null],
    ["/t/uchet-pro//", null],
    ["//t/uchet-pro/", null],
    ["/t/", null],
    ["/t", null],
    ["/", null],
    ["", null],
    ["/assets/index.html", null],
    ["/assets/t/uchet-pro/", null],
    ["t/uchet-pro/", null],
    ["/T/uchet-pro/", null],
    ["/t/uchet-pro/index.html", null],
    ["/t/Uchet Pro/", "Uchet Pro"],
    [undefined, null],
    [null, null],
    [5, null],
  ];
  assert.ok(rows.length >= 15);
  for (const [path, id] of rows)
    assert.equal(tenantIdOf(path), id, String(path));
});

// ---------------------------------------------------------------------- QM-4

// Fakes of fetch and of AbortSignal.timeout for the test; every call is recorded.
function fakeNet(t, behave) {
  const calls = [];
  const timeouts = [];
  const savedFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const savedTimeout = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (path, init) => {
      calls.push({ path, init });
      return behave(path, init);
    },
  });
  Object.defineProperty(AbortSignal, "timeout", {
    configurable: true,
    writable: true,
    value: (ms) => {
      const controller = new AbortController();
      timeouts.push({ ms, controller });
      return controller.signal;
    },
  });
  t.after(() => {
    if (savedFetch === undefined) delete globalThis.fetch;
    else Object.defineProperty(globalThis, "fetch", savedFetch);
    Object.defineProperty(AbortSignal, "timeout", savedTimeout);
  });
  return { calls, timeouts };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const GOOD_BODY = up.body("ru");

test("QM-4a: the outcomes of the network - 22 rows: a refusal, an abort, 400/404/500 with a body and without, 200 that is not JSON or not an object or not a questionnaire, a right questionnaire, a 201 with a right body, a right result", async (t) => {
  const rows = [
    [
      "fetch refuses",
      () => {
        throw new TypeError("Failed to fetch");
      },
      { kind: "network" },
    ],
    [
      "fetch rejects with a timeout",
      () => Promise.reject(new DOMException("t", "TimeoutError")),
      { kind: "network" },
    ],
    [
      "fetch rejects with an abort",
      () => Promise.reject(new DOMException("t", "AbortError")),
      { kind: "network" },
    ],
    [
      "400 with a code and a text",
      () => json(400, { error: "answers_invalid", message: "No." }),
      { kind: "server", status: 400, code: "answers_invalid", message: "No." },
    ],
    [
      "400 with a code only",
      () => json(400, { error: "bad_request" }),
      { kind: "server", status: 400, code: "bad_request", message: null },
    ],
    [
      "404 with a body",
      () => json(404, { error: "not_found", message: "Not here." }),
      { kind: "server", status: 404, code: "not_found", message: "Not here." },
    ],
    [
      "500 with a body",
      () => json(500, { error: "internal", message: "Oops." }),
      { kind: "server", status: 500, code: "internal", message: "Oops." },
    ],
    [
      "500 with no body",
      () => new Response("", { status: 500 }),
      { kind: "server", status: 500, code: null, message: null },
    ],
    [
      "502 with markup",
      () => new Response("<html>Bad</html>", { status: 502 }),
      { kind: "server", status: 502, code: null, message: null },
    ],
    [
      "500 with a list",
      () => json(500, ["x"]),
      { kind: "server", status: 500, code: null, message: null },
    ],
    [
      "500 with an empty text",
      () => json(500, { error: "internal", message: "" }),
      { kind: "server", status: 500, code: "internal", message: null },
    ],
    [
      "500 with a text of 301 signs",
      () => json(500, { error: "internal", message: "m".repeat(301) }),
      { kind: "server", status: 500, code: "internal", message: null },
    ],
    [
      "500 with a text of 300 signs",
      () => json(500, { error: "internal", message: "m".repeat(300) }),
      {
        kind: "server",
        status: 500,
        code: "internal",
        message: "m".repeat(300),
      },
    ],
    [
      "500 with a code that is no text",
      () => json(500, { error: 5, message: 7 }),
      { kind: "server", status: 500, code: null, message: null },
    ],
    [
      "200 that is not JSON",
      () => new Response("not json", { status: 200 }),
      { kind: "server", status: 200, code: null, message: null },
    ],
    [
      "200 with a list",
      () => json(200, []),
      { kind: "server", status: 200, code: null, message: null },
    ],
    [
      "200 with null",
      () => json(200, null),
      { kind: "server", status: 200, code: null, message: null },
    ],
    [
      "200 with a wrong form",
      () => json(200, { version: "x" }),
      { kind: "server", status: 200, code: null, message: null },
    ],
    [
      "200 with a right questionnaire",
      () => json(200, GOOD_BODY),
      { kind: "ok", body: GOOD_BODY },
    ],
    // only 200 is an answer: another status that a browser calls "ok" is a mistake of
    // the server, even with a body that would be right
    [
      "201 with a right questionnaire",
      () => json(201, GOOD_BODY),
      { kind: "server", status: 201, code: null, message: null },
    ],
    [
      "204 with no body",
      () => new Response(null, { status: 204 }),
      { kind: "server", status: 204, code: null, message: null },
    ],
    [
      "299 with a right questionnaire",
      () => json(299, GOOD_BODY),
      { kind: "server", status: 299, code: null, message: null },
    ],
  ];
  assert.ok(rows.length >= 14);
  for (const [label, behave, expected] of rows) {
    fakeNet(t, behave);
    assert.deepEqual(await getQuestionnaire("ru"), expected, label);
  }
  // the result: right and wrong forms
  const result = {
    clear_leader: false,
    recommended: [{ id: "x" }],
    no_match_text: null,
    hypotheses: [],
  };
  fakeNet(t, () => json(200, result));
  assert.deepEqual(await postResult("ru", { business: "retail" }), {
    kind: "ok",
    body: result,
  });
  fakeNet(t, () => json(201, result));
  assert.deepEqual(await postResult("ru", { business: "retail" }), {
    kind: "server",
    status: 201,
    code: null,
    message: null,
  });
  for (const body of [
    { ...result, clear_leader: "yes" },
    { ...result, recommended: {} },
    { ...result, no_match_text: 5 },
    { ...result, hypotheses: null },
    { recommended: [], hypotheses: [] },
    "text",
    [],
  ]) {
    fakeNet(t, () => json(200, body));
    assert.deepEqual(
      await postResult("ru", {}),
      { kind: "server", status: 200, code: null, message: null },
      JSON.stringify(body),
    );
  }
  // a body that comes slowly and is cut by the limit of time is a lost net, not a bad body
  fakeNet(t, () => ({
    status: 200,
    json: () => Promise.reject(new DOMException("t", "TimeoutError")),
  }));
  assert.deepEqual(await getQuestionnaire("ru"), { kind: "network" });
});

test("QM-4b: the request - a relative address with lang= one of the three, the right method and header, a body of one key 'answers', a signal of the limit of time, and none of mode, referrer policy, credentials, redirect or cache", async (t) => {
  assert.equal(API_QUESTIONNAIRE, "api/questionnaire");
  assert.equal(API_RESULT, "api/result");
  assert.equal(REQUEST_TIMEOUT_MS, 20000);
  const net = fakeNet(t, () => json(200, GOOD_BODY));
  for (const lang of LANGS) await getQuestionnaire(lang);
  for (const lang of ["de", "KK", "", undefined, null, "ru&x=1", "../ru"])
    await getQuestionnaire(lang);
  assert.deepEqual(
    net.calls.map((c) => c.path),
    [
      ...LANGS.map((l) => `api/questionnaire?lang=${l}`),
      ...Array(7).fill("api/questionnaire?lang=ru"),
    ],
  );
  for (const call of net.calls) {
    assert.doesNotMatch(call.path, /^[a-z][a-z0-9+.-]*:|^\/\//iu);
    assert.deepEqual(Object.keys(call.init), ["signal"]);
    assert.ok(call.init.signal instanceof AbortSignal);
  }
  // the result
  const answers = {
    business: "retail",
    items: 120,
    tools: ["paper", "sheets"],
  };
  const post = fakeNet(t, () => json(200, RESULT_OK));
  for (const lang of LANGS) await postResult(lang, answers);
  await postResult("zz", answers);
  assert.deepEqual(
    post.calls.map((c) => c.path),
    [...LANGS.map((l) => `api/result?lang=${l}`), "api/result?lang=ru"],
  );
  for (const call of post.calls) {
    assert.equal(call.init.method, "POST");
    assert.deepEqual(call.init.headers, { "Content-Type": "application/json" });
    assert.equal(call.init.body, JSON.stringify({ answers }));
    assert.deepEqual(Object.keys(JSON.parse(call.init.body)), ["answers"]);
    assert.deepEqual(Object.keys(call.init).sort(), [
      "body",
      "headers",
      "method",
      "signal",
    ]);
    for (const key of [
      "mode",
      "referrerPolicy",
      "credentials",
      "redirect",
      "cache",
    ])
      assert.equal(Object.hasOwn(call.init, key), false, key);
  }
  assert.ok(post.timeouts.every((x) => x.ms === 20000));
  assert.equal(
    post.timeouts.length,
    post.calls.length,
    "a signal for every request",
  );
});

// Gives a question another id and keeps the conditions that refer to it right.
function renameQuestion(body, from, to) {
  body.questions.find((x) => x.id === from).id = to;
  for (const question of body.questions)
    for (const c of question.show_if ?? [])
      if (c.question === from) c.question = to;
}

test("QM-4c: the form of the questionnaire - 24 spoilt copies of a right one are all refused as 'a body the page cannot show', and the right one is taken", async (t) => {
  const good = () => JSON.parse(JSON.stringify(up.body("ru")));
  const q = (b, id) => b.questions.find((x) => x.id === id);
  const spoil = [
    ["no version", (b) => delete b.version],
    [
      "version of 63 signs",
      (b) => {
        b.version = b.version.slice(1);
      },
    ],
    [
      "version in capitals",
      (b) => {
        b.version = b.version.toUpperCase();
      },
    ],
    ["no lang", (b) => delete b.lang],
    [
      "lang outside the three",
      (b) => {
        b.lang = "de";
      },
    ],
    ["no languages", (b) => delete b.languages],
    [
      "languages empty",
      (b) => {
        b.languages = [];
      },
    ],
    [
      "languages repeat",
      (b) => {
        b.languages = ["ru", "ru"];
      },
    ],
    [
      "languages without lang",
      (b) => {
        b.languages = ["kk", "en"];
      },
    ],
    [
      "name not a text",
      (b) => {
        b.name = 5;
      },
    ],
    [
      "no questions",
      (b) => {
        b.questions = [];
      },
    ],
    [
      "questions not a list",
      (b) => {
        b.questions = {};
      },
    ],
    [
      "questions_max not the length",
      (b) => {
        b.questions_max = 11;
      },
    ],
    [
      "questions_min not the count",
      (b) => {
        b.questions_min = 7;
      },
    ],
    [
      "questions_min over max",
      (b) => {
        b.questions_min = 13;
        b.questions_max = 12;
      },
    ],
    [
      "id repeated",
      (b) => {
        b.questions[1].id = b.questions[0].id;
      },
    ],
    [
      "id empty",
      (b) => {
        b.questions[0].id = "";
      },
    ],
    [
      "type unknown",
      (b) => {
        b.questions[0].type = "text";
      },
    ],
    [
      "required not a boolean",
      (b) => {
        b.questions[0].required = "yes";
      },
    ],
    [
      "one option only",
      (b) => {
        q(b, "business").options = q(b, "business").options.slice(0, 1);
      },
    ],
    [
      "option id repeated",
      (b) => {
        const o = q(b, "business").options;
        o[1].id = o[0].id;
      },
    ],
    [
      "number with min over max",
      (b) => {
        const n = q(b, "items");
        n.min = 5;
        n.max = 5;
      },
    ],
    [
      "number min not whole",
      (b) => {
        q(b, "items").min = 1.5;
      },
    ],
    [
      "a condition of two kinds",
      (b) => {
        q(b, "documents").show_if[0].min = 1;
      },
    ],
    [
      "a condition with no kind",
      (b) => {
        q(b, "documents").show_if = [{ question: "business" }];
      },
    ],
    [
      "show_if empty",
      (b) => {
        q(b, "documents").show_if = [];
      },
    ],
    ["a body that is a list", null],
  ];
  assert.ok(spoil.length >= 20);
  fakeNet(t, () => json(200, good()));
  assert.equal((await getQuestionnaire("ru")).kind, "ok");
  for (const [label, change] of spoil) {
    const body = good();
    const sent = change === null ? [body] : (change(body), body);
    fakeNet(t, () => json(200, sent));
    assert.deepEqual(
      await getQuestionnaire("ru"),
      { kind: "server", status: 200, code: null, message: null },
      label,
    );
  }
  // the second and the third row of the table of the accepted differences (design 4.1) are
  // not refused by the page: the server is the border, the page only does not fall
  const lenient = [
    [
      "empty name",
      (b) => {
        b.name = "";
      },
    ],
    [
      "empty intro",
      (b) => {
        b.intro = "";
      },
    ],
    [
      "empty title",
      (b) => {
        q(b, "business").title = "";
      },
    ],
    [
      "empty label of an option",
      (b) => {
        q(b, "business").options[0].label = "";
      },
    ],
    [
      "empty any_of",
      (b) => {
        q(b, "documents").show_if[0].any_of = [];
      },
    ],
    [
      "an id of 41 signs",
      (b) => {
        renameQuestion(b, "business", "x".repeat(41));
      },
    ],
    [
      "an id that is no template",
      (b) => {
        renameQuestion(b, "business", "Bad Id!");
      },
    ],
  ];
  for (const [label, change] of lenient) {
    const body = good();
    change(body);
    fakeNet(t, () => json(200, body));
    assert.equal((await getQuestionnaire("ru")).kind, "ok", label);
  }
});

// The tenant file of the sample that sits on the bounds (30 questions, an option list of 8,
// a number question); changed in one place for each row.
const BOUNDS = fixtureJson("ok-bounds.json");
const clone = (value) => JSON.parse(JSON.stringify(value));

async function pageSays(t, tenant) {
  const body = expectedQuestionnaire(tenant, "ru", VERSION);
  fakeNet(t, () => json(200, body));
  return (await getQuestionnaire("ru")).kind;
}

test("QM-4d: the limits of the page against the validator of the tenant files, on both sides of each bound - the page takes what the validator takes and refuses what it refuses, for the lengths counted in whole signs after the spaces at both ends are cut (emoji and spaces at the edges included)", async (t) => {
  assert.deepEqual(
    validateTenant(clone(BOUNDS), { fileName: "ok-bounds.json" }),
    [],
  );
  assert.equal(await pageSays(t, clone(BOUNDS)), "ok");
  const shapes = [
    ["letters", (n) => "я".repeat(n)],
    ["emoji", (n) => "😀".repeat(n)],
    ["spaces at the edges", (n) => `  ${"x".repeat(n)}  `],
    ["a tab and a newline at the edges", (n) => `\t${"x".repeat(n)}\n`],
    ["a sign outside the plane 0", (n) => "𝒳".repeat(n)],
  ];
  const places = [
    [
      "name",
      60,
      (tenant, text) => {
        tenant.name = text;
      },
    ],
    [
      "intro",
      400,
      (tenant, text) => {
        tenant.intro = text;
      },
    ],
    [
      "title of a question",
      200,
      (tenant, text) => {
        tenant.questions[0].title = text;
      },
    ],
    [
      "help of a question",
      300,
      (tenant, text) => {
        tenant.questions[0].help = text;
      },
    ],
    [
      "label of an option",
      100,
      (tenant, text) => {
        tenant.questions[1].options[0].label = text;
      },
    ],
    [
      "unit of a number",
      20,
      (tenant, text) => {
        tenant.questions[2].unit = text;
      },
    ],
  ];
  for (const [place, max, put] of places) {
    for (const [shape, make] of shapes) {
      for (const [length, expected] of [
        [max, "ok"],
        [max + 1, "server"],
      ]) {
        const tenant = clone(BOUNDS);
        put(tenant, make(length));
        const issues = validateTenant(tenant, { fileName: "ok-bounds.json" });
        const label = `${place} ${shape} ${length}`;
        assert.equal(
          issues.length === 0,
          expected === "ok",
          `${label}: the validator says ${JSON.stringify(issues)}`,
        );
        assert.equal(await pageSays(t, tenant), expected, `${label}: the page`);
      }
    }
  }
  // the counts: conditions in show_if (3), items of any_of and none_of (8), questions (30), options (8)
  const withConditions = (n) => {
    const tenant = clone(BOUNDS);
    tenant.questions[29].show_if = Array.from({ length: n }, (_, i) => ({
      question: `q${i + 3}`,
      any_of: [tenant.questions[i + 3].options[0].id],
    }));
    return tenant;
  };
  const withItems = (kind, n) => {
    const tenant = clone(BOUNDS);
    const ids = tenant.questions[1].options.map((o) => o.id);
    tenant.questions[29].show_if = [
      {
        question: "q1",
        [kind]: Array.from({ length: n }, (_, i) => ids[i % ids.length]),
      },
    ];
    return tenant;
  };
  const counts = [
    ["conditions 3", withConditions(3), "ok"],
    ["conditions 4", withConditions(4), "server"],
    ["any_of 8", withItems("any_of", 8), "ok"],
    ["any_of 9", withItems("any_of", 9), "server"],
    ["none_of 8", withItems("none_of", 8), "ok"],
    ["none_of 9", withItems("none_of", 9), "server"],
    ["questions 30", clone(BOUNDS), "ok"],
    ["questions 31", fixtureJson("e-limit-questions-31.json"), "server"],
    ["options 8", clone(BOUNDS), "ok"],
    ["options 9", fixtureJson("e-limit-options-9.json"), "server"],
  ];
  for (const [label, tenant, expected] of counts) {
    const issues = validateTenant(clone(tenant), {
      fileName: `${tenant.id}.json`,
    });
    assert.equal(
      issues.length === 0,
      expected === "ok",
      `${label}: the validator says ${JSON.stringify(issues)}`,
    );
    assert.equal(await pageSays(t, tenant), expected, `${label}: the page`);
  }
  // the page is not stricter than the server on what the server does not limit: an
  // identifier of 40 signs and one of 1 sign are taken
  const long = clone(BOUNDS);
  long.questions[0].id = "i".repeat(40);
  assert.equal(await pageSays(t, long), "ok");
  // and the engine takes the answers that the page would send on the sample
  assert.equal(computeResult(clone(BOUNDS), {}).ok, false);
});

// ---------------------------------------------------------------------- QM-5

test("QM-5a: say - the placeholders are filled by a function, so '$&' and '$1' in a value stay letters; a key or a language that is not there is an error; a placeholder with no value stays; numbers are turned into text", () => {
  assert.equal(
    say("card_count", "ru", { min: 8, max: 12 }),
    "Вопросов: от 8 до 12",
  );
  assert.equal(
    say("card_count", "en", { min: "$&", max: "$1" }),
    "Questions: from $& to $1",
  );
  assert.equal(
    say("card_count", "ru", { min: "$`", max: "$'" }),
    "Вопросов: от $` до $'",
  );
  assert.equal(say("card_count", "ru", { min: 8 }), "Вопросов: от 8 до {max}");
  assert.equal(say("card_count", "ru"), "Вопросов: от {min} до {max}");
  assert.equal(say("card_count", "ru", null), "Вопросов: от {min} до {max}");
  assert.equal(
    say("card_count", "kk", { min: 0, max: 3 }),
    "Сұрақтар: 0 бастап 3 дейін",
  );
  assert.equal(say("card_start", "ru", { min: 1 }), "Пройти опрос");
  assert.equal(
    say("card_count", "ru", { min: "{max}", max: 5 }),
    "Вопросов: от {max} до 5",
  );
  assert.throws(() => say("no_such_key", "ru"), /no text for the key/u);
  assert.throws(() => say("constructor", "ru"), /no text for the key/u);
  assert.throws(
    () => say("card_start", "de"),
    /no text for the key card_start in the language de/u,
  );
  assert.throws(() => say("card_start", "toString"), /language/u);
  assert.throws(() => say("card_start", undefined), /language/u);
  assert.equal(say("language_switcher_label", "kk"), "Тіл");
  // a value that holds the name of a key of an object is not read from the prototype
  assert.equal(
    say("card_count", "ru", { min: 1, max: 2, constructor: "x" }),
    "Вопросов: от 1 до 2",
  );
});

// ---------------------------------------------------------------------- QM-6

test("QM-6a: dom.js - a node is made with attributes (numbers as text, null and undefined left out) and children (texts and nodes, null and undefined left out); part() adds data-part; the text of a node is replaced as a whole and is never taken for markup", async (t) => {
  await loadPage(t, { start: false });
  const child = el("span", null, "inner");
  const node = el(
    "div",
    { id: "a", n: 5, skip: null, gone: undefined, empty: "" },
    "text",
    null,
    child,
    undefined,
    "<b>x</b>",
  );
  const seen = raw(node);
  assert.deepEqual(
    [...seen.attrs.entries()],
    [
      ["id", "a"],
      ["n", "5"],
      ["empty", ""],
    ],
  );
  assert.equal(seen.text, "textinner<b>x</b>");
  assert.equal(seen.elements.length, 1, "the markup in a text is no element");
  const named = part("p", "intro", { id: "z" }, "hello");
  assert.equal(raw(named).attr("data-part"), "intro");
  assert.equal(raw(named).attr("id"), "z");
  assert.equal(raw(named).text, "hello");
  assert.equal(raw(part("p", "x", null)).attr("data-part"), "x");
  setText(named, "<i>a</i> & b");
  assert.equal(raw(named).text, "<i>a</i> & b");
  assert.equal(raw(named).elements.length, 0);
  setText(named, "");
  assert.equal(raw(named).children.length, 0);
});

test("QM-6b: result.js - the screen of the result for now: a panel for the result screen with the header of the page first, a heading that can take the focus and says that the result will come, and two buttons that call back what the page gave", async (t) => {
  await loadPage(t, { start: false });
  const calls = [];
  const head = el("header", null, "H");
  const out = renderResult({
    lang: "ru",
    name: "N",
    result: RESULT_OK,
    answers: { a: "x" },
    questionnaire: up.body("ru"),
    say: (key) => `<${key}>`,
    head,
    onEdit: () => calls.push("edit"),
    onRestart: () => calls.push("restart"),
  });
  const panel = raw(out.node);
  assert.equal(panel.attr("data-part"), "panel");
  assert.equal(panel.attr("data-screen"), "result");
  same(panel.elements[0], raw(head), "the header stays first");
  const focus = raw(out.focus);
  assert.equal(focus.tag, "h2");
  assert.equal(focus.attr("tabindex"), "-1");
  assert.equal(focus.text, "<result_soon>");
  assert.ok(panel.chain().length >= 1 && focus.parent === panel);
  const edit = panel.find('[data-action="edit"]');
  const restart = panel.find('[data-action="restart"]');
  assert.equal(edit.text, "<quiz_back>");
  assert.equal(restart.text, "<card_restart>");
  assert.equal(edit.attr("type"), "button");
  click(edit);
  click(restart);
  click(edit);
  assert.deepEqual(calls, ["edit", "restart", "edit"]);
});
