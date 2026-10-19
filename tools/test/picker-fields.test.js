// PK-2c, PK-3e, PK-5d: the border of every field, the links and the conditions, one case
// at a time (design REQ-054, 4.2-4.12). The base is the sample ok-minimal; each case changes it
// and names the places and codes that the check must give - in the order of the file.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pathText } from "../src/picker/places.js";
import { validateTenant } from "../src/picker/validate.js";
import { fixtureJson } from "./picker-helpers.js";

const Y = (n) => "я".repeat(n);
const raz = (n) => Array(n).fill("раз").join(" ");

// The places and codes the check gives for the base changed by `edit`.
function found(edit, fileName) {
  const tenant = fixtureJson("ok-minimal.json");
  edit(tenant);
  const name =
    fileName ??
    (typeof tenant.id === "string" ? `${tenant.id}.json` : "x.json");
  return validateTenant(tenant, { fileName: name }).map(
    (i) => `${pathText(i.path)} ${i.code}`,
  );
}

// Taking something out of the base leaves the conditions that named it pointing at nothing:
// these lines follow the main mistake by design 4.6 (steps У5 and У8), table by table.
const WHEN_REFS = [
  "rules[0].when[0].question E_REF",
  "rules[1].when[0].question E_REF",
  "rules[2].when[0].question E_REF",
  "hypotheses[0].when[0].question E_REF",
];
const NO_FRUIT = [
  "questions[1].show_if[0].any_of[0] E_REF",
  "questions[3].show_if[1].none_of[0] E_REF",
  "rules[0].when[0].any_of[0] E_REF",
];
const FOLLOW_ON = new Map([
  ["top: questions not a list", WHEN_REFS],
  ["top: no questions", WHEN_REFS],
  ["question: no options on a single", NO_FRUIT],
  ["question: options not a list", NO_FRUIT],
  ["question: one option", ["questions[3].show_if[1].none_of[0] E_REF"]],
  [
    "question: option id twice in one question",
    ["questions[3].show_if[1].none_of[0] E_REF"],
  ],
  [
    "question: option id other form",
    [
      "questions[1].show_if[0].any_of[0] E_REF",
      "rules[0].when[0].any_of[0] E_REF",
    ],
  ],
  ["solution: a solution id twice", ["rules[1].solution E_REF"]],
]);

// A case: [what is changed, the edit, what is found]. All the cases of a table are run, and
// the ones that differ are shown together.
function table(title, cases, fileName) {
  const wrong = [];
  for (const [label, edit, base] of cases) {
    const want = [...base, ...(FOLLOW_ON.get(`${title}: ${label}`) ?? [])];
    const got = found(edit, fileName);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      wrong.push(
        `${title}: ${label}\n   want ${JSON.stringify(want)}\n   got  ${JSON.stringify(got)}`,
      );
    }
  }
  assert.deepEqual(wrong, []);
}

const manyRules = (t, n) => {
  for (let i = 0; i < n; i++) {
    t.rules.push({
      id: `extra-${i}`,
      when: [{ question: "kind", any_of: ["fruit"] }],
      solution: "stall",
      points: 1,
      text: "Ещё одно правило.",
    });
  }
};

test("PK-2c: the borders of the first level - the id of a tenant, the schema, name, intro, the sizes of the lists", () => {
  table("top", [
    ["id of 2 signs", (t) => (t.id = "ab"), ["id E_ID"]],
    ["id of 3 signs", (t) => (t.id = "abc"), []],
    ["id of 32 signs", (t) => (t.id = "a".repeat(32)), []],
    ["id of 33 signs", (t) => (t.id = "a".repeat(33)), ["id E_ID"]],
    ["id with a dash inside", (t) => (t.id = "a-c"), []],
    ["id begins with a dash", (t) => (t.id = "-abc"), ["id E_ID"]],
    ["id ends with a dash", (t) => (t.id = "abc-"), ["id E_ID"]],
    ["id in capitals", (t) => (t.id = "ABC"), ["id E_ID"]],
    ["id with an underscore", (t) => (t.id = "a_c"), ["id E_ID"]],
    ["id with a Cyrillic letter", (t) => (t.id = "аbc"), ["id E_ID"]],
    ["id with a space", (t) => (t.id = "a bc"), ["id E_ID"]],
    ["id a number", (t) => (t.id = 5), ["id E_FIELD"]],
    ["no id", (t) => delete t.id, ["id E_FIELD"]],
    ["schema other", (t) => (t.schema = "x"), ["schema E_FIELD"]],
    ["schema a number", (t) => (t.schema = 5), ["schema E_FIELD"]],
    ["name empty", (t) => (t.name = ""), ["name E_LIMIT"]],
    ["name of blanks", (t) => (t.name = "    "), ["name E_LIMIT"]],
    ["name of 60", (t) => (t.name = Y(60)), []],
    ["name of 61", (t) => (t.name = Y(61)), ["name E_LIMIT"]],
    ["name a number", (t) => (t.name = 5), ["name E_FIELD"]],
    ["intro of 400", (t) => (t.intro = Y(400)), []],
    ["intro of 401", (t) => (t.intro = Y(401)), ["intro E_LIMIT"]],
    ["questions not a list", (t) => (t.questions = {}), ["questions E_FIELD"]],
    ["no questions", (t) => (t.questions = []), ["questions E_LIMIT"]],
    [
      "solutions empty",
      (t) => (t.solutions = []),
      [
        "solutions E_LIMIT",
        "rules[0].solution E_REF",
        "rules[1].solution E_REF",
        "rules[2].solution E_REF",
      ],
    ],
    [
      "rules empty",
      (t) => (t.rules = []),
      [
        "rules E_LIMIT",
        "solutions[0] E_UNREACHABLE",
        "solutions[1] E_UNREACHABLE",
      ],
    ],
    ["rules 200", (t) => manyRules(t, 197), []],
    ["rules 201", (t) => manyRules(t, 198), ["rules E_LIMIT"]],
    ["hypotheses absent", (t) => delete t.hypotheses, []],
    ["hypotheses empty", (t) => (t.hypotheses = []), []],
    [
      "hypotheses not a list",
      (t) => (t.hypotheses = 1),
      ["hypotheses E_FIELD"],
    ],
    [
      "hypotheses 20",
      (t) =>
        (t.hypotheses = Array.from({ length: 20 }, (_, i) => ({
          ...t.hypotheses[0],
          id: `h${i}`,
        }))),
      [],
    ],
    [
      "hypotheses 21",
      (t) =>
        (t.hypotheses = Array.from({ length: 21 }, (_, i) => ({
          ...t.hypotheses[0],
          id: `h${i}`,
        }))),
      ["hypotheses E_LIMIT"],
    ],
    ["no result", (t) => delete t.result, ["result E_FIELD"]],
    ["result a list", (t) => (t.result = []), ["result E_FIELD"]],
    ["leads null", (t) => (t.leads = null), ["leads E_FIELD"]],
    ["leads absent", (t) => delete t.leads, []],
    ["the root is a list", () => {}, []],
  ]);
  // the root that is not an object: one line, the place 'весь файл'
  for (const root of [[], null, 5, "x", true]) {
    const issues = validateTenant(root, { fileName: "x.json" });
    assert.deepEqual(
      issues.map((i) => [i.code, pathText(i.path)]),
      [["E_FIELD", "весь файл"]],
    );
  }
  // the file name is compared only when the id is good
  assert.deepEqual(
    found((t) => (t.id = "other"), "ok-minimal.json"),
    ["id E_ID"],
  );
  assert.deepEqual(
    found((t) => (t.id = "Other"), "ok-minimal.json"),
    ["id E_ID"],
  );
  assert.deepEqual(
    found(() => {}, "ok-minimal.txt"),
    ["id E_ID"],
  );
  assert.deepEqual(
    found(() => {}, "OK-minimal.json"),
    ["id E_ID"],
  );
  assert.deepEqual(
    validateTenant(fixtureJson("ok-minimal.json")),
    [],
    "no file name: not compared",
  );
});

test("PK-2c: the borders of a question, an option and a condition", () => {
  const q = (n) => `questions[${n}]`;
  table("question", [
    ["id of 40", (t) => (t.questions[1].id = "a".repeat(40)), []],
    [
      "id of 41",
      (t) => (t.questions[1].id = "a".repeat(41)),
      [`${q(1)}.id E_ID`],
    ],
    ["id empty", (t) => (t.questions[1].id = ""), [`${q(1)}.id E_ID`]],
    ["id a dash", (t) => (t.questions[1].id = "-"), []],
    ["id in capitals", (t) => (t.questions[1].id = "A"), [`${q(1)}.id E_ID`]],
    [
      "id with a space",
      (t) => (t.questions[1].id = "a b"),
      [`${q(1)}.id E_ID`],
    ],
    ["id a number", (t) => (t.questions[1].id = 7), [`${q(1)}.id E_FIELD`]],
    ["no id", (t) => delete t.questions[1].id, [`${q(1)}.id E_FIELD`]],
    [
      "a question that is not an object",
      (t) => (t.questions[1] = 5),
      [`${q(1)} E_FIELD`],
    ],
    [
      "title empty",
      (t) => (t.questions[0].title = ""),
      [`${q(0)}.title E_LIMIT`],
    ],
    ["no title", (t) => delete t.questions[0].title, [`${q(0)}.title E_FIELD`]],
    ["help of 300", (t) => (t.questions[1].help = Y(300)), []],
    [
      "help of 301",
      (t) => (t.questions[1].help = Y(301)),
      [`${q(1)}.help E_LIMIT`],
    ],
    ["help empty", (t) => (t.questions[1].help = ""), [`${q(1)}.help E_LIMIT`]],
    [
      "type other",
      (t) => (t.questions[0].type = "text"),
      [`${q(0)}.type E_FIELD`],
    ],
    [
      "type a number",
      (t) => (t.questions[0].type = 1),
      [`${q(0)}.type E_FIELD`],
    ],
    ["no type", (t) => delete t.questions[0].type, [`${q(0)}.type E_FIELD`]],
    [
      "required a string",
      (t) => (t.questions[0].required = "yes"),
      [`${q(0)}.required E_FIELD`],
    ],
    [
      "no required",
      (t) => delete t.questions[0].required,
      [`${q(0)}.required E_FIELD`],
    ],
    [
      "options on a number",
      (t) =>
        (t.questions[2].options = [
          { id: "a", label: "Да" },
          { id: "b", label: "Нет" },
        ]),
      [`${q(2)}.options E_FIELD`],
    ],
    [
      "min on a single",
      (t) => (t.questions[0].min = 1),
      [`${q(0)}.min E_FIELD`],
    ],
    [
      "max on a multiple",
      (t) => (t.questions[1].max = 5),
      [`${q(1)}.max E_FIELD`],
    ],
    [
      "unit on a single",
      (t) => (t.questions[0].unit = "шт"),
      [`${q(0)}.unit E_FIELD`],
    ],
    [
      "no options on a single",
      (t) => delete t.questions[0].options,
      [`${q(0)}.options E_FIELD`],
    ],
    [
      "one option",
      (t) => (t.questions[0].options = [t.questions[0].options[0]]),
      [`${q(0)}.options E_LIMIT`],
    ],
    [
      "options not a list",
      (t) => (t.questions[0].options = "x"),
      [`${q(0)}.options E_FIELD`],
    ],
    [
      "no min on a number",
      (t) => delete t.questions[2].min,
      [`${q(2)}.min E_FIELD`],
    ],
    [
      "no max on a number",
      (t) => delete t.questions[2].max,
      [`${q(2)}.max E_FIELD`],
    ],
    [
      "min equal to max",
      (t) => (t.questions[2].min = 1000),
      [`${q(2)}.max E_LIMIT`],
    ],
    [
      "min above max",
      (t) => (t.questions[2].min = 2000),
      [`${q(2)}.max E_LIMIT`],
    ],
    ["min one below max", (t) => (t.questions[2].min = 999), []],
    [
      "min fractional",
      (t) => (t.questions[2].min = 1.5),
      [`${q(2)}.min E_FIELD`],
    ],
    [
      "max a string",
      (t) => (t.questions[2].max = "9"),
      [`${q(2)}.max E_FIELD`],
    ],
    ["min negative", (t) => (t.questions[2].min = -5), []],
    ["unit of 20", (t) => (t.questions[2].unit = Y(20)), []],
    [
      "unit of 21",
      (t) => (t.questions[2].unit = Y(21)),
      [`${q(2)}.unit E_LIMIT`],
    ],
    ["unit empty", (t) => (t.questions[2].unit = ""), [`${q(2)}.unit E_LIMIT`]],
    ["show_if empty", (t) => (t.questions[1].show_if = []), []],
    [
      "show_if of 3",
      (t) =>
        t.questions[3].show_if.push({ question: "extras", any_of: ["bags"] }),
      [],
    ],
    [
      "show_if of 4",
      (t) =>
        t.questions[3].show_if.push(
          { question: "extras", any_of: ["bags"] },
          { question: "extras", none_of: ["bags"] },
        ),
      [`${q(3)}.show_if E_LIMIT`],
    ],
    [
      "show_if not a list",
      (t) => (t.questions[1].show_if = {}),
      [`${q(1)}.show_if E_FIELD`],
    ],
    [
      "option id twice in one question",
      (t) => (t.questions[0].options[1].id = "fruit"),
      [`${q(0)}.options[1].id E_DUP`],
    ],
    [
      "the same option id in two questions",
      (t) => (t.questions[1].options[0].id = "fruit"),
      [],
    ],
    [
      "option label empty",
      (t) => (t.questions[0].options[0].label = ""),
      [`${q(0)}.options[0].label E_LIMIT`],
    ],
    [
      "option label of 100",
      (t) => (t.questions[0].options[0].label = Y(100)),
      [],
    ],
    [
      "option label of 101",
      (t) => (t.questions[0].options[0].label = Y(101)),
      [`${q(0)}.options[0].label E_LIMIT`],
    ],
    [
      "option with an extra field",
      (t) => (t.questions[0].options[0].score = 1),
      [`${q(0)}.options[0].score E_FIELD`],
    ],
    [
      "option id other form",
      (t) => (t.questions[0].options[0].id = "Fruit"),
      [`${q(0)}.options[0].id E_ID`],
    ],
    [
      "question id equal to a solution id",
      (t) => (t.questions[1].id = "stall"),
      [],
    ],
  ]);
});

test("PK-3e: the conditions step by step - the kinds, the types, the links, the sizes of the lists and the borders of a range", () => {
  const s = "questions[3].show_if[0]";
  const set = (cond) => (t) => (t.questions[3].show_if[0] = cond);
  table("condition", [
    ["a condition that is not an object", set(5), [s + " E_FIELD"]],
    ["a condition that is a list", set([]), [s + " E_FIELD"]],
    [
      "an extra key",
      set({ question: "count", min: 5, colour: 1 }),
      [s + ".colour E_FIELD"],
    ],
    ["no question", set({ min: 5 }), [s + ".question E_FIELD"]],
    [
      "question not a string",
      set({ question: 5, min: 5 }),
      [s + ".question E_FIELD"],
    ],
    ["no kind", set({ question: "count" }), [s + " E_COND"]],
    [
      "three kinds",
      set({ question: "kind", any_of: ["fruit"], none_of: ["bread"], min: 1 }),
      [s + " E_COND"],
    ],
    [
      "any_of and none_of",
      set({ question: "kind", any_of: ["fruit"], none_of: ["bread"] }),
      [s + " E_COND"],
    ],
    ["only min", set({ question: "count", min: 5 }), []],
    ["only max", set({ question: "count", max: 5 }), []],
    ["min and max", set({ question: "count", min: 5, max: 9 }), []],
    ["min equal to max", set({ question: "count", min: 5, max: 5 }), []],
    [
      "min above max",
      set({ question: "count", min: 6, max: 5 }),
      [s + ".max E_LIMIT"],
    ],
    [
      "min a string",
      set({ question: "count", min: "5" }),
      [s + ".min E_FIELD"],
    ],
    [
      "max fractional",
      set({ question: "count", max: 2.5 }),
      [s + ".max E_FIELD"],
    ],
    [
      "unknown question and a range",
      set({ question: "nope", min: 5 }),
      [s + ".question E_REF"],
    ],
    [
      "unknown question and a bad range",
      set({ question: "nope", min: "x" }),
      [s + ".question E_REF", s + ".min E_FIELD"],
    ],
    [
      "unknown question and two kinds",
      set({ question: "nope", any_of: ["a"], min: 1 }),
      [s + " E_COND", s + ".question E_REF"],
    ],
    [
      "any_of on a number",
      set({ question: "count", any_of: ["x"] }),
      [s + ".any_of E_COND"],
    ],
    [
      "none_of on a number",
      set({ question: "count", none_of: ["x"] }),
      [s + ".none_of E_COND"],
    ],
    ["max on a single", set({ question: "kind", max: 1 }), [s + ".max E_COND"]],
    [
      "min and max on a single: the first key",
      set({ question: "kind", min: 1, max: 2 }),
      [s + ".min E_COND"],
    ],
    [
      "a multiple takes any_of",
      set({ question: "extras", any_of: ["bags"] }),
      [],
    ],
    ["any_of: one option", set({ question: "kind", any_of: ["fruit"] }), []],
    ["none_of: one option", set({ question: "kind", none_of: ["bread"] }), []],
    [
      "any_of: eight times",
      set({ question: "kind", any_of: Array(8).fill("fruit") }),
      [],
    ],
    [
      "any_of: nine times",
      set({ question: "kind", any_of: Array(9).fill("fruit") }),
      [s + ".any_of E_LIMIT"],
    ],
    [
      "none_of: nine times",
      set({ question: "kind", none_of: Array(9).fill("fruit") }),
      [s + ".none_of E_LIMIT"],
    ],
    [
      "any_of empty",
      set({ question: "kind", any_of: [] }),
      [s + ".any_of E_LIMIT"],
    ],
    [
      "any_of not a list",
      set({ question: "kind", any_of: "fruit" }),
      [s + ".any_of E_FIELD"],
    ],
    [
      "any_of with a number",
      set({ question: "kind", any_of: [5] }),
      [s + ".any_of[0] E_FIELD"],
    ],
    [
      "an option of another question",
      set({ question: "kind", any_of: ["bags"] }),
      [s + ".any_of[0] E_REF"],
    ],
    [
      "one good and one wrong option",
      set({ question: "kind", any_of: ["fruit", "water", "bread"] }),
      [s + ".any_of[1] E_REF"],
    ],
  ]);
  // the show_if of the first question may refer to nothing; a question refers only upward
  table("order", [
    [
      "the first refers to itself",
      (t) =>
        (t.questions[0].show_if = [{ question: "kind", any_of: ["fruit"] }]),
      ["questions[0].show_if[0].question E_ORDER"],
    ],
    [
      "the first refers forward",
      (t) => (t.questions[0].show_if = [{ question: "count", min: 1 }]),
      ["questions[0].show_if[0].question E_ORDER"],
    ],
    [
      "the last refers to the one before",
      (t) => (t.questions[3].show_if = [{ question: "count", min: 1 }]),
      [],
    ],
    [
      "a question refers to the one right before",
      (t) =>
        (t.questions[2].show_if = [{ question: "extras", any_of: ["bags"] }]),
      [],
    ],
    // a look forward or at itself stops at E_ORDER: no E_COND for the kind, no E_REF for the option
    [
      "forward: any_of on a number below",
      (t) => (t.questions[0].show_if = [{ question: "count", any_of: ["x"] }]),
      ["questions[0].show_if[0].question E_ORDER"],
    ],
    [
      "forward: min on a multiple below",
      (t) => (t.questions[0].show_if = [{ question: "extras", min: 1 }]),
      ["questions[0].show_if[0].question E_ORDER"],
    ],
    [
      "forward: a missing option of a question below",
      (t) =>
        (t.questions[0].show_if = [
          { question: "extras", any_of: ["no-such-option"] },
        ]),
      ["questions[0].show_if[0].question E_ORDER"],
    ],
    [
      "forward: none_of with a missing option",
      (t) =>
        (t.questions[0].show_if = [
          { question: "extras", none_of: ["no-such-option"] },
        ]),
      ["questions[0].show_if[0].question E_ORDER"],
    ],
    [
      "forward: two kinds (the kind is looked at before the order)",
      (t) =>
        (t.questions[0].show_if = [
          { question: "count", any_of: ["x"], min: 1 },
        ]),
      [
        "questions[0].show_if[0] E_COND",
        "questions[0].show_if[0].question E_ORDER",
      ],
    ],
    [
      "itself: min on a single",
      (t) => (t.questions[0].show_if = [{ question: "kind", min: 1 }]),
      ["questions[0].show_if[0].question E_ORDER"],
    ],
    [
      "itself: a missing option",
      (t) =>
        (t.questions[0].show_if = [
          { question: "kind", any_of: ["no-such-option"] },
        ]),
      ["questions[0].show_if[0].question E_ORDER"],
    ],
    [
      "a question refers to itself by a range",
      (t) => (t.questions[2].show_if = [{ question: "count", min: 1 }]),
      ["questions[2].show_if[0].question E_ORDER"],
    ],
  ]);
  // the rules and the hypotheses use the same conditions, none of them with an order
  table("when", [
    [
      "a rule on any question",
      (t) => (t.rules[0].when = [{ question: "rush", any_of: ["queue-yes"] }]),
      [],
    ],
    [
      "a rule on a missing question",
      (t) => (t.rules[0].when = [{ question: "nope", any_of: ["x"] }]),
      ["rules[0].when[0].question E_REF"],
    ],
    ["when empty", (t) => (t.rules[0].when = []), ["rules[0].when E_LIMIT"]],
    [
      "when of 3",
      (t) =>
        (t.rules[0].when = Array(3).fill({
          question: "kind",
          any_of: ["fruit"],
        })),
      [],
    ],
    [
      "when of 4",
      (t) =>
        (t.rules[0].when = Array(4).fill({
          question: "kind",
          any_of: ["fruit"],
        })),
      ["rules[0].when E_LIMIT"],
    ],
    [
      "when not a list",
      (t) => (t.rules[0].when = {}),
      ["rules[0].when E_FIELD"],
    ],
    ["no when", (t) => delete t.rules[0].when, ["rules[0].when E_FIELD"]],
    [
      "a hypothesis with a missing option",
      (t) =>
        (t.hypotheses[0].when = [
          { question: "rush", any_of: ["queue-maybe"] },
        ]),
      ["hypotheses[0].when[0].any_of[0] E_REF"],
    ],
    [
      "a hypothesis with no condition",
      (t) => (t.hypotheses[0].when = []),
      ["hypotheses[0].when E_LIMIT"],
    ],
  ]);
  // a link to a question with a bad type is looked at for the link and the form only
  table("unknown type", [
    [
      "a question of an unknown type is linked",
      (t) => {
        t.questions[0].type = "text";
      },
      ["questions[0].type E_FIELD"],
    ],
  ]);
});

test("PK-2c: the borders of a solution, a rule, a hypothesis, the result and the leads", () => {
  table("solution", [
    ["name of 80", (t) => (t.solutions[0].name = Y(80)), []],
    [
      "name of 81",
      (t) => (t.solutions[0].name = Y(81)),
      ["solutions[0].name E_LIMIT"],
    ],
    ["summary of 300", (t) => (t.solutions[0].summary = Y(300)), []],
    [
      "summary of 301",
      (t) => (t.solutions[0].summary = Y(301)),
      ["solutions[0].summary E_LIMIT"],
    ],
    [
      "includes empty",
      (t) => (t.solutions[0].includes = []),
      ["solutions[0].includes E_LIMIT"],
    ],
    [
      "includes 10",
      (t) => (t.solutions[0].includes = Array(10).fill("Пункт")),
      [],
    ],
    [
      "includes 11",
      (t) => (t.solutions[0].includes = Array(11).fill("Пункт")),
      ["solutions[0].includes E_LIMIT"],
    ],
    ["an item of 150", (t) => (t.solutions[0].includes = [Y(150)]), []],
    [
      "an item of 151",
      (t) => (t.solutions[0].includes = [Y(151)]),
      ["solutions[0].includes[0] E_LIMIT"],
    ],
    [
      "an item empty",
      (t) => (t.solutions[0].includes = [""]),
      ["solutions[0].includes[0] E_LIMIT"],
    ],
    [
      "an item a number",
      (t) => (t.solutions[0].includes = [5]),
      ["solutions[0].includes[0] E_FIELD"],
    ],
    ["needs_from_you empty", (t) => (t.solutions[1].needs_from_you = []), []],
    [
      "needs_from_you 10",
      (t) => (t.solutions[1].needs_from_you = Array(10).fill("Пункт")),
      [],
    ],
    [
      "needs_from_you 11",
      (t) => (t.solutions[1].needs_from_you = Array(11).fill("Пункт")),
      ["solutions[1].needs_from_you E_LIMIT"],
    ],
    [
      "no needs_from_you",
      (t) => delete t.solutions[1].needs_from_you,
      ["solutions[1].needs_from_you E_FIELD"],
    ],
    [
      "next_steps empty",
      (t) => (t.solutions[0].next_steps = []),
      ["solutions[0].next_steps E_LIMIT"],
    ],
    [
      "next_steps 5",
      (t) => (t.solutions[0].next_steps = Array(5).fill("Шаг")),
      [],
    ],
    [
      "next_steps 6",
      (t) => (t.solutions[0].next_steps = Array(6).fill("Шаг")),
      ["solutions[0].next_steps E_LIMIT"],
    ],
    [
      "not_suitable_when 5",
      (t) => (t.solutions[1].not_suitable_when = Array(5).fill("Случай")),
      [],
    ],
    [
      "not_suitable_when 6",
      (t) => (t.solutions[1].not_suitable_when = Array(6).fill("Случай")),
      ["solutions[1].not_suitable_when E_LIMIT"],
    ],
    [
      "no not_suitable_when",
      (t) => delete t.solutions[0].not_suitable_when,
      ["solutions[0].not_suitable_when E_FIELD"],
    ],
    ["price_text of 120", (t) => (t.solutions[1].price_text = Y(120)), []],
    [
      "price_text of 121",
      (t) => (t.solutions[1].price_text = Y(121)),
      ["solutions[1].price_text E_LIMIT"],
    ],
    [
      "price_text empty",
      (t) => (t.solutions[1].price_text = ""),
      ["solutions[1].price_text E_LIMIT"],
    ],
    [
      "duration_text of 121",
      (t) => (t.solutions[1].duration_text = Y(121)),
      ["solutions[1].duration_text E_LIMIT"],
    ],
    [
      "no price and no duration",
      (t) => {
        delete t.solutions[1].price_text;
        delete t.solutions[1].duration_text;
      },
      [],
    ],
    [
      "a solution id twice",
      (t) => (t.solutions[1].id = "stall"),
      ["solutions[1].id E_DUP"],
    ],
    [
      "an extra field",
      (t) => (t.solutions[0].cost = 5),
      ["solutions[0].cost E_FIELD"],
    ],
    [
      "a solution that is not an object",
      (t) => (t.solutions[0] = 1),
      [
        "solutions[0] E_FIELD",
        "rules[0].solution E_REF",
        "rules[2].solution E_REF",
      ],
    ],
  ]);
  table("rule", [
    ["points 10", (t) => (t.rules[0].points = 10), []],
    ["points -10", (t) => (t.rules[2].points = -10), []],
    [
      "points -11",
      (t) => (t.rules[0].points = -11),
      ["rules[0].points E_LIMIT"],
    ],
    ["points 11", (t) => (t.rules[0].points = 11), ["rules[0].points E_LIMIT"]],
    ["points 0", (t) => (t.rules[0].points = 0), ["rules[0].points E_LIMIT"]],
    [
      "points a string",
      (t) => (t.rules[0].points = "3"),
      ["rules[0].points E_FIELD"],
    ],
    [
      "points fractional",
      (t) => (t.rules[0].points = 1.5),
      ["rules[0].points E_FIELD"],
    ],
    [
      "points beyond the safe integers",
      (t) => (t.rules[0].points = 2 ** 53),
      ["rules[0].points E_FIELD"],
    ],
    [
      "points null",
      (t) => (t.rules[0].points = null),
      ["rules[0].points E_FIELD"],
    ],
    ["text of 200", (t) => (t.rules[0].text = Y(200)), []],
    [
      "text of 201",
      (t) => (t.rules[0].text = Y(201)),
      ["rules[0].text E_LIMIT"],
    ],
    [
      "solution a number",
      (t) => (t.rules[0].solution = 5),
      ["rules[0].solution E_FIELD"],
    ],
    ["rule id twice", (t) => (t.rules[1].id = "rule-a"), ["rules[1].id E_DUP"]],
    ["rule id like a question id", (t) => (t.rules[1].id = "kind"), []],
    ["rule id like a solution id", (t) => (t.rules[1].id = "van"), []],
    [
      "hypothesis id like a rule id",
      (t) => (t.hypotheses[0].id = "rule-a"),
      [],
    ],
    [
      "hypothesis id twice",
      (t) => t.hypotheses.push({ ...t.hypotheses[0] }),
      ["hypotheses[1].id E_DUP"],
    ],
  ]);
  table("hypothesis", [
    ["title of 100", (t) => (t.hypotheses[0].title = Y(100)), []],
    [
      "title of 101",
      (t) => (t.hypotheses[0].title = Y(101)),
      ["hypotheses[0].title E_LIMIT"],
    ],
    ["explanation of 300", (t) => (t.hypotheses[0].explanation = Y(300)), []],
    [
      "explanation of 301",
      (t) => (t.hypotheses[0].explanation = Y(301)),
      ["hypotheses[0].explanation E_LIMIT"],
    ],
    [
      "an extra field",
      (t) => (t.hypotheses[0].weight = 1),
      ["hypotheses[0].weight E_FIELD"],
    ],
  ]);
  table("result", [
    ["top 1", (t) => (t.result.top = 1), []],
    ["top 3", (t) => (t.result.top = 3), []],
    ["top 0", (t) => (t.result.top = 0), ["result.top E_LIMIT"]],
    ["top 4", (t) => (t.result.top = 4), ["result.top E_LIMIT"]],
    ["top a string", (t) => (t.result.top = "2"), ["result.top E_FIELD"]],
    ["min_score 1", (t) => (t.result.min_score = 1), []],
    [
      "min_score 0",
      (t) => (t.result.min_score = 0),
      ["result.min_score E_LIMIT"],
    ],
    ["min_score large", (t) => (t.result.min_score = 100000), []],
    [
      "clear_lead_gap 0",
      (t) => (t.result.clear_lead_gap = 0),
      ["result.clear_lead_gap E_LIMIT"],
    ],
    [
      "clear_lead_gap -1",
      (t) => (t.result.clear_lead_gap = -1),
      ["result.clear_lead_gap E_LIMIT"],
    ],
    ["no_match_text of 300", (t) => (t.result.no_match_text = Y(300)), []],
    [
      "no_match_text of 301",
      (t) => (t.result.no_match_text = Y(301)),
      ["result.no_match_text E_LIMIT"],
    ],
    ["no top", (t) => delete t.result.top, ["result.top E_FIELD"]],
    [
      "no no_match_text",
      (t) => delete t.result.no_match_text,
      ["result.no_match_text E_FIELD"],
    ],
    ["an extra field", (t) => (t.result.mode = 1), ["result.mode E_FIELD"]],
  ]);
  table("leads", [
    [
      "enabled a string",
      (t) => (t.leads.enabled = "no"),
      ["leads.enabled E_FIELD"],
    ],
    ["enabled true", (t) => (t.leads.enabled = true), []],
    ["both ways", (t) => (t.leads.contact_fields = ["phone", "email"]), []],
    [
      "email twice",
      (t) => (t.leads.contact_fields = ["email", "email"]),
      ["leads.contact_fields[1] E_DUP"],
    ],
    [
      "phone twice",
      (t) => (t.leads.contact_fields = ["phone", "phone"]),
      ["leads.contact_fields[1] E_DUP"],
    ],
    [
      "a way that is not allowed",
      (t) => (t.leads.contact_fields = ["sms"]),
      ["leads.contact_fields[0] E_FIELD"],
    ],
    [
      "a way a number",
      (t) => (t.leads.contact_fields = [1]),
      ["leads.contact_fields[0] E_FIELD"],
    ],
    [
      "no ways",
      (t) => (t.leads.contact_fields = []),
      ["leads.contact_fields E_LIMIT"],
    ],
    [
      "three ways",
      (t) => (t.leads.contact_fields = ["phone", "email", "phone"]),
      ["leads.contact_fields E_LIMIT", "leads.contact_fields[2] E_DUP"],
    ],
    [
      "ways not a list",
      (t) => (t.leads.contact_fields = "email"),
      ["leads.contact_fields E_FIELD"],
    ],
    ["operator_name of 100", (t) => (t.leads.operator_name = Y(100)), []],
    [
      "operator_name of 101",
      (t) => (t.leads.operator_name = Y(101)),
      ["leads.operator_name E_LIMIT"],
    ],
    ["consent_text of 600", (t) => (t.leads.consent_text = Y(600)), []],
    [
      "consent_text of 601",
      (t) => (t.leads.consent_text = Y(601)),
      ["leads.consent_text E_LIMIT"],
    ],
    ["privacy_contact of 200", (t) => (t.leads.privacy_contact = Y(200)), []],
    [
      "privacy_contact of 201",
      (t) => (t.leads.privacy_contact = Y(201)),
      ["leads.privacy_contact E_LIMIT"],
    ],
    [
      "retention_days 1.5",
      (t) => (t.leads.retention_days = 1.5),
      ["leads.retention_days E_FIELD"],
    ],
    [
      "retention_days a string",
      (t) => (t.leads.retention_days = "30"),
      ["leads.retention_days E_FIELD"],
    ],
    [
      "no retention_days",
      (t) => delete t.leads.retention_days,
      ["leads.retention_days E_FIELD"],
    ],
    ["no enabled", (t) => delete t.leads.enabled, ["leads.enabled E_FIELD"]],
    ["an extra field", (t) => (t.leads.extra = 1), ["leads.extra E_FIELD"]],
  ]);
});

test("PK-2c: the places of the lines - a key that is no plain name is written in brackets and quotes, a key with a space or a word of a parser is shown changed; a missing field stands at its parent", () => {
  assert.equal(pathText([]), "весь файл");
  assert.equal(
    pathText(["questions", 3, "show_if", 0, "question"]),
    "questions[3].show_if[0].question",
  );
  assert.equal(pathText([0]), "[0]");
  assert.equal(pathText(["a-b"]), '["a-b"]');
  assert.equal(pathText(["a b"]), '["a_b"]');
  assert.equal(pathText(["x", "ты"]), 'x["(скрыто)"]');
  assert.equal(pathText(["__proto__"]), "__proto__");
  // a long key is shown cut to 40 signs
  assert.equal(pathText(["k".repeat(50)]), `["${"k".repeat(40)}…"]`);
  // a key of the file that is no plain name, in an extra field
  const found2 = (key) => {
    const t = fixtureJson("ok-minimal.json");
    t[key] = 1;
    return validateTenant(t, { fileName: "ok-minimal.json" }).map(
      (i) => `${pathText(i.path)}|${i.text}`,
    );
  };
  assert.deepEqual(found2("a b"), ['["a_b"]|Лишнее поле a_b. Удалите его.']);
  assert.deepEqual(found2("ты"), [
    '["(скрыто)"]|Лишнее поле (скрыто). Удалите его.',
  ]);
  assert.deepEqual(found2("__proto__x"), [
    "__proto__x|Лишнее поле __proto__x. Удалите его.",
  ]);
});

test("PK-5d: the rule of text on every field of the visitor, and the order of the checks of one place - the length first, then the form 'вы', then the words", () => {
  const places = [
    ["name", (t, v) => (t.name = v)],
    ["intro", (t, v) => (t.intro = v)],
    ["questions[0].title", (t, v) => (t.questions[0].title = v)],
    ["questions[1].help", (t, v) => (t.questions[1].help = v)],
    ["questions[2].unit", (t, v) => (t.questions[2].unit = v)],
    [
      "questions[0].options[0].label",
      (t, v) => (t.questions[0].options[0].label = v),
    ],
    ["solutions[0].name", (t, v) => (t.solutions[0].name = v)],
    ["solutions[0].summary", (t, v) => (t.solutions[0].summary = v)],
    ["solutions[0].includes[0]", (t, v) => (t.solutions[0].includes[0] = v)],
    [
      "solutions[1].needs_from_you[0]",
      (t, v) => (t.solutions[1].needs_from_you[0] = v),
    ],
    [
      "solutions[0].next_steps[0]",
      (t, v) => (t.solutions[0].next_steps[0] = v),
    ],
    [
      "solutions[1].not_suitable_when[0]",
      (t, v) => (t.solutions[1].not_suitable_when[0] = v),
    ],
    ["solutions[1].price_text", (t, v) => (t.solutions[1].price_text = v)],
    [
      "solutions[1].duration_text",
      (t, v) => (t.solutions[1].duration_text = v),
    ],
    ["rules[0].text", (t, v) => (t.rules[0].text = v)],
    ["hypotheses[0].title", (t, v) => (t.hypotheses[0].title = v)],
    ["hypotheses[0].explanation", (t, v) => (t.hypotheses[0].explanation = v)],
    ["result.no_match_text", (t, v) => (t.result.no_match_text = v)],
    ["leads.operator_name", (t, v) => (t.leads.operator_name = v)],
    ["leads.consent_text", (t, v) => (t.leads.consent_text = v)],
    ["leads.privacy_contact", (t, v) => (t.leads.privacy_contact = v)],
  ];
  assert.equal(places.length, 21);
  // One-letter words: 19 of them are 37 signs, they fit into every field but "unit" (20).
  const a = (n) => Array(n).fill("а").join(" ");
  for (const [place, set] of places) {
    const run = (value) => found((t) => set(t, value));
    const room = place !== "questions[2].unit";
    if (room) {
      assert.deepEqual(run(a(19)), [`${place} E_TEXT`], `${place}: 19 words`);
      assert.deepEqual(run(a(18)), [], `${place}: 18 words`);
      assert.deepEqual(
        run(`${a(19)} ты`),
        [`${place} E_TEXT`],
        `${place}: both`,
      );
    }
    assert.deepEqual(run("Ты это знаешь"), [`${place} E_TEXT`], `${place}: ты`);
    assert.deepEqual(run("Цветы и тыква"), [], `${place}: цветы`);
    assert.deepEqual(run(""), [`${place} E_LIMIT`], `${place}: empty`);
  }
  // the text of the line: the second rule is named when both are broken
  const text = (value) => {
    const t = fixtureJson("ok-minimal.json");
    t.intro = value;
    return validateTenant(t, { fileName: "ok-minimal.json" })[0].text;
  };
  assert.equal(
    text(`${raz(19)} ты`),
    "Обращение не на «вы». Перепишите текст в форме «вы».",
  );
  assert.equal(
    text(raz(19)),
    "Фраза длиннее 18 слов (в ней 19). Разбейте её точкой.",
  );
  assert.equal(
    text(raz(25)),
    "Фраза длиннее 18 слов (в ней 25). Разбейте её точкой.",
  );
  // the length is looked at first: a long text of long words shows the length
  assert.deepEqual(
    found((t) => (t.intro = `${Y(401)} ты`)),
    ["intro E_LIMIT"],
  );
  // the later phrase is the long one
  assert.deepEqual(
    found((t) => (t.intro = `Коротко. Ещё коротко! ${raz(19)}`)),
    ["intro E_TEXT"],
  );
  assert.deepEqual(
    found((t) => (t.intro = `${raz(10)}… ${raz(10)}? ${raz(10)}.`)),
    [],
  );
  assert.deepEqual(
    found((t) => (t.intro = "Тебя, тебе, тобой.")),
    ["intro E_TEXT"],
  );
  assert.deepEqual(
    found((t) => (t.intro = "Твоё и твои дела")),
    ["intro E_TEXT"],
  );
  // a text that is not a text of the visitor is not read for the rule: ids and a way of contact
  assert.deepEqual(
    found((t) => (t.rules[0].id = "ty")),
    [],
  );
});

test("PK-2c: one error for one place, and the order of the checks - the type, the pattern, the borders, the repeat, the link, the rule of text", () => {
  // an id that breaks the pattern and repeats another is named once, for the pattern
  assert.deepEqual(
    found((t) => (t.questions[1].id = "Kind")),
    ["questions[1].id E_ID"],
  );
  // a repeat of a good id
  assert.deepEqual(
    found((t) => (t.questions[1].id = "kind")),
    ["questions[1].id E_DUP"],
  );
  // a bad type of a text is named for the type, not for the length
  assert.deepEqual(
    found((t) => (t.intro = 5)),
    ["intro E_FIELD"],
  );
  // a text over the limit is named for the limit, not for the words
  assert.deepEqual(
    found((t) => (t.intro = raz(150))),
    ["intro E_LIMIT"],
  );
  // the unreachable solution is named after the rest of the file's own mistakes only by place
  const lines = found((t) => {
    t.rules[1].points = -4;
    t.leads.retention_days = 0;
  });
  assert.deepEqual(lines, [
    "leads.retention_days E_LIMIT",
    "solutions[1] E_UNREACHABLE",
  ]);
});

// The lines of a file as the command writes them: the place and the code, in the order of the output.
import { checkBytes } from "../src/picker/check.js";
function written(edit) {
  const tenant = fixtureJson("ok-minimal.json");
  edit(tenant);
  const r = checkBytes(
    new TextEncoder().encode(JSON.stringify(tenant, null, 2)),
    "ok-minimal.json",
  );
  return r.stdout.map((line) => line.split(": ").slice(1, 3).join(" "));
}

test("PK-4b: places that stand at one position keep the order of finding - missing fields of one object come in the order of the table, whatever the rest of the lines", () => {
  // name and intro are both missing: both stand at the start of the file
  assert.deepEqual(
    written((t) => {
      delete t.name;
      delete t.intro;
    }),
    ["name E_FIELD", "intro E_FIELD"],
  );
  // four missing fields at the root, and a mistake further on
  assert.deepEqual(
    written((t) => {
      delete t.result;
      delete t.name;
      delete t.schema;
      delete t.intro;
      t.leads.retention_days = 0;
    }),
    [
      "schema E_FIELD",
      "name E_FIELD",
      "intro E_FIELD",
      "result E_FIELD",
      "leads.retention_days E_LIMIT",
    ],
  );
  // two missing fields of one rule stand together too
  assert.deepEqual(
    written((t) => {
      delete t.rules[2].text;
      delete t.rules[2].points;
    }),
    ["rules[2].points E_FIELD", "rules[2].text E_FIELD"],
  );
  // the mistakes in a file are written by place, not by the order of finding
  assert.deepEqual(
    written((t) => {
      delete t.name;
      t.questions[0].colour = 1;
      delete t.intro;
    }),
    ["name E_FIELD", "intro E_FIELD", "questions[0].colour E_FIELD"],
  );
});
