// Helpers of the tests of the picker engine (design REQ-055, 11.3). Not a test file.
// The small tenant `pico` is a literal here, as the criteria want; the second computation of
// the outcome is written again from the description of the requirement, with other
// structures than the engine has, and it takes the visibility from the oracle of
// picker-helpers.js, never from src/.
import fs from "node:fs";
import path from "node:path";
import { checkFile } from "../src/picker/check.js";
import { parseJson } from "../src/picker/json.js";
import {
  DEMO_ANSWERS,
  LEGACY_TENANTS,
  makeRng,
  visibleQuestionIds,
} from "./picker-helpers.js";

// ------------------------------------------------------------- the small tenant

// Every text is its own: a field put in place of another one is seen.
const opt = (id) => ({ id, label: `Вариант ${id}` });
const q = (id, type, required, extra) => ({
  id,
  title: `Вопрос ${id}?`,
  type,
  required,
  ...extra,
});
const any = (question, ...ids) => ({ question, any_of: ids });
const none = (question, ...ids) => ({ question, none_of: ids });
const range = (question, min, max) => {
  const c = { question };
  if (min !== undefined) c.min = min;
  if (max !== undefined) c.max = max;
  return c;
};
const sol = (id, extra) => ({
  id,
  name: `Решение ${id}`,
  summary: `Кратко о решении ${id}.`,
  includes: [`Состав ${id} первый.`, `Состав ${id} второй.`],
  needs_from_you: [`Нужно от вас для ${id}.`],
  next_steps: [`Шаг ${id} первый.`, `Шаг ${id} второй.`],
  not_suitable_when: [],
  ...extra,
});
const rule = (id, when, solution, points) => ({
  id,
  when,
  solution,
  points,
  text: `Правило ${id} даёт баллы.`,
});

// The small tenant of design 9: 8 questions, 4 solutions (not in the order of the letters),
// 13 rules, 2 hypotheses. A new object at every call.
export function pico() {
  return {
    schema: "sai-picker-tenant/1",
    id: "pico-test",
    name: "Малый арендатор",
    intro: "Малый файл для проверки движка.",
    questions: [
      q("a", "single", true, { options: [opt("a1"), opt("a2"), opt("a3")] }),
      q("b", "multiple", true, { options: [opt("b1"), opt("b2"), opt("b3")] }),
      q("c", "number", true, { min: 0, max: 100, unit: "штук" }),
      q("d", "single", true, {
        options: [opt("d1"), opt("d2")],
        show_if: [any("a", "a1", "a2")],
      }),
      q("e", "single", false, {
        options: [opt("e1"), opt("e2")],
        show_if: [none("b", "b1")],
      }),
      q("f", "single", false, {
        options: [opt("f1"), opt("f2")],
        show_if: [range("c", 10, 20)],
      }),
      q("g", "single", false, {
        options: [opt("g1"), opt("g2")],
        show_if: [any("d", "d1")],
      }),
      q("h", "single", false, {
        options: [opt("h1"), opt("h2")],
        show_if: [any("a", "a2", "a3"), range("c", 50)],
      }),
    ],
    solutions: [
      sol("sol-m", { needs_from_you: [] }),
      sol("sol-k", {
        price_text: "Цена по договорённости.",
        duration_text: "Срок две недели.",
        not_suitable_when: ["Если нужен быстрый ответ."],
      }),
      sol("sol-z"),
      sol("sol-b"),
    ],
    rules: [
      rule("r-a1", [any("a", "a1")], "sol-m", 4),
      rule("r-a2", [any("a", "a2")], "sol-k", 4),
      rule("r-a3", [any("a", "a3")], "sol-z", 4),
      rule("r-b1", [any("b", "b1")], "sol-m", 2),
      rule("r-b23", [any("b", "b2", "b3")], "sol-k", 2),
      rule("r-b3-neg", [any("b", "b3")], "sol-m", -3),
      rule("r-c-low", [range("c", undefined, 9)], "sol-b", 3),
      rule("r-c-high", [range("c", 50)], "sol-z", 2),
      rule("r-d1", [any("d", "d1")], "sol-b", 2),
      rule(
        "r-three",
        [any("a", "a1", "a2"), any("b", "b1"), range("c", 10, 20)],
        "sol-k",
        5,
      ),
      rule("r-e1-neg", [any("e", "e1")], "sol-b", -1),
      rule("r-g1", [any("g", "g1")], "sol-m", 1),
      rule("r-none-a", [none("a", "a1"), range("c", 100)], "sol-z", 1),
    ],
    hypotheses: [
      {
        id: "h-one",
        title: "Первая причина",
        explanation: "Объяснение первой причины.",
        when: [any("a", "a1"), range("c", 50)],
      },
      {
        id: "h-two",
        title: "Вторая причина",
        explanation: "Объяснение второй причины.",
        when: [any("d", "d1")],
      },
    ],
    result: {
      top: 3,
      min_score: 3,
      clear_lead_gap: 2,
      no_match_text: "Подходящего решения нет.",
    },
  };
}

// The small tenant with its rules written in the reverse order: the order of the rules in
// the file is then neither the order of their ids nor the order of their points.
export function picoReversedRules() {
  const tenant = pico();
  tenant.rules.reverse();
  return tenant;
}

// A copy of the tenant with other settings of the result.
export function withSettings(tenant, settings) {
  const copy = deepCopy(tenant);
  Object.assign(copy.result, settings);
  return copy;
}

// The same tenant as the reader of the file makes it: objects with no prototype.
export function noProto(tenant) {
  return parseJson(JSON.stringify(tenant)).value;
}

// ------------------------------------------------------------- the demo tenants

// The tenant as the check of the file gives it (no prototype), and the plain one.
export function demoTenant(id) {
  const checked = checkFile(path.join(LEGACY_TENANTS, `${id}.json`));
  if (checked.exitCode !== 0)
    throw new Error(`${id}: ${checked.stdout.join()}`);
  return checked.tenant;
}
export const demoPlain = (id) =>
  JSON.parse(fs.readFileSync(path.join(LEGACY_TENANTS, `${id}.json`), "utf8"));
export const demoAnswers = (id) =>
  JSON.parse(fs.readFileSync(path.join(DEMO_ANSWERS, `${id}.json`), "utf8"));
export const DEMO_IDS = ["uchet-pro", "svet-marketing"];

// ------------------------------------------------------------- copies and strings

export function deepCopy(value) {
  if (Array.isArray(value)) return value.map(deepCopy);
  if (value !== null && typeof value === "object") {
    const out =
      Object.getPrototypeOf(value) === null ? Object.create(null) : {};
    for (const key of Object.keys(value))
      Object.defineProperty(out, key, {
        value: deepCopy(value[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    return out;
  }
  return value;
}

export function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

// Every string value of a tenant file (texts and ids, in lists and objects).
export function allStrings(value, out = new Set()) {
  if (typeof value === "string") out.add(value);
  else if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) allStrings(value[key], out);
  }
  return out;
}

// The paths of all numbers in a value, as "recommended[0].rules[1].points".
export function numbersIn(value, here = "", out = []) {
  if (typeof value === "number") out.push(here);
  else if (Array.isArray(value)) {
    value.forEach((item, i) => numbersIn(item, `${here}[${i}]`, out));
  } else if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      numbersIn(value[key], here === "" ? key : `${here}.${key}`, out);
    }
  }
  return out;
}

// The path shapes allowed for numbers in a result (decision 0067, item 1).
export const NUMBER_PATHS = [
  /^ranking\[\d+\]\.score$/u,
  /^recommended\[\d+\]\.score$/u,
  /^recommended\[\d+\]\.rules\[\d+\]\.points$/u,
  /^recommended\[\d+\]\.rules\[\d+\]\.because\[\d+\]\.value$/u,
];

// ------------------------------------------------------------- shuffles

export function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// Answers with the keys in another order.
export function shuffleKeys(answers, rng) {
  const out = {};
  for (const key of shuffled(Object.keys(answers), rng))
    out[key] = answers[key];
  return out;
}
// Answers with the chosen options of every multiple question in another order.
export function shuffleLists(answers, rng) {
  const out = {};
  for (const key of Object.keys(answers)) {
    out[key] = Array.isArray(answers[key])
      ? shuffled(answers[key], rng)
      : answers[key];
  }
  return out;
}

// ------------------------------------------------------------- the generator of answers

// The numbers that the conditions on a question name, and their neighbours that stay in
// the borders of the question.
function edgeNumbers(tenant, question) {
  const edges = new Set();
  const conditions = [
    ...tenant.questions.flatMap((x) => x.show_if ?? []),
    ...tenant.rules.flatMap((r) => r.when),
    ...(tenant.hypotheses ?? []).flatMap((h) => h.when),
  ];
  for (const c of conditions) {
    if (c.question !== question.id) continue;
    for (const key of ["min", "max"]) {
      if (c[key] === undefined) continue;
      for (const n of [c[key] - 1, c[key], c[key] + 1]) {
        if (n >= question.min && n <= question.max) edges.add(n);
      }
    }
  }
  return [...edges];
}

function validAnswer(tenant, question, rng) {
  if (question.type === "single") return rng.pick(question.options).id;
  if (question.type === "multiple") {
    const ids = question.options.map((o) => o.id);
    const chosen = shuffled(ids, rng).slice(0, 1 + rng.int(ids.length));
    return chosen;
  }
  const r = rng.next();
  if (r < 0.15) return question.min;
  if (r < 0.3) return question.max;
  const edges = edgeNumbers(tenant, question);
  if (edges.length > 0 && rng.next() < 0.3) return rng.pick(edges);
  return question.min + rng.int(question.max - question.min + 1);
}

// A set of right answers to the visible questions, in the order of the file: a required
// question always, an optional one in 70% of the sets; in 10% of the sets one right answer
// to a hidden question is added (design 11.3).
export function generateAnswers(tenant, rng) {
  const answers = {};
  const seen = new Set();
  for (const question of tenant.questions) {
    const visible = visibleQuestionIds(tenant, answers).has(question.id);
    if (!visible) continue;
    seen.add(question.id);
    if (question.required || rng.next() < 0.7) {
      answers[question.id] = validAnswer(tenant, question, rng);
    }
  }
  if (rng.next() < 0.1) {
    const hidden = tenant.questions.filter((x) => !seen.has(x.id));
    if (hidden.length > 0) {
      const question = rng.pick(hidden);
      answers[question.id] = validAnswer(tenant, question, rng);
    }
  }
  return answers;
}

export const sets = (tenant, seed, n = 1000) => {
  const rng = makeRng(seed);
  return Array.from({ length: n }, () => generateAnswers(tenant, rng));
};

// ------------------------------------------------------------- the second computation

// The outcome for right answers, written again from the description of the requirement:
// facts as sets of "question=option" strings, the order by picking the best of what
// is left. It shares nothing with src/ and takes the visibility from the oracle.
export function expectedOutcome(tenant, answers) {
  const seen = visibleQuestionIds(tenant, answers);
  const chosen = new Map(); // question -> Set of options, or a number
  for (const question of tenant.questions) {
    if (!seen.has(question.id) || !Object.hasOwn(answers, question.id))
      continue;
    const value = answers[question.id];
    chosen.set(
      question.id,
      question.type === "number"
        ? value
        : new Set(Array.isArray(value) ? value : [value]),
    );
  }
  const true1 = (c) => {
    if (!chosen.has(c.question)) return false;
    const have = chosen.get(c.question);
    if (c.any_of) return c.any_of.some((id) => have.has(id));
    if (c.none_of) return c.none_of.every((id) => !have.has(id));
    return (
      (c.min === undefined || have >= c.min) &&
      (c.max === undefined || have <= c.max)
    );
  };
  const fired = tenant.rules.filter((r) => r.when.every(true1));
  const points = new Map(tenant.solutions.map((s) => [s.id, 0]));
  for (const r of fired)
    points.set(r.solution, points.get(r.solution) + r.points);
  // the order: pick the best of the rest, the earlier place wins a tie
  const left = tenant.solutions.map((s, place) => ({
    id: s.id,
    place,
    score: points.get(s.id),
  }));
  const ranking = [];
  while (left.length > 0) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      const a = left[i];
      const b = left[best];
      if (a.score > b.score || (a.score === b.score && a.place < b.place))
        best = i;
    }
    ranking.push(left.splice(best, 1)[0]);
  }
  const { top, min_score: minScore, clear_lead_gap: gap } = tenant.result;
  const recommended = ranking.filter((e) => e.score >= minScore).slice(0, top);
  let leader = null;
  if (recommended.length === 1) leader = true;
  if (recommended.length >= 2)
    leader = recommended[0].score - recommended[1].score >= gap;
  const hypotheses = (tenant.hypotheses ?? [])
    .filter((h) => h.when.every(true1))
    .map((h) => h.id);
  return {
    visible: tenant.questions.filter((x) => seen.has(x.id)).map((x) => x.id),
    ranking: ranking.map((e) => [e.id, e.score]),
    recommended: recommended.map((e) => e.id),
    leader,
    noMatch: recommended.length === 0,
    hypotheses,
    firedBy: (solution) =>
      fired.filter((r) => r.solution === solution).map((r) => r),
    answerOf: (question) => {
      const have = chosen.get(question);
      return have instanceof Set ? have : have;
    },
  };
}

// The options of a question in the order of the file, picked from a set.
export function inFileOrder(tenant, question, set) {
  const found = tenant.questions.find((x) => x.id === question);
  return found.options.map((o) => o.id).filter((id) => set.has(id));
}
