// PK-R1 ... PK-R4: whatever the file holds, the check does not fall, names every place once,
// writes in the shape of the lines and does not change what it was given (design REQ-054,
// 12.2). The random choices come from a generator with a fixed seed, so a run repeats.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkBytes } from "../src/picker/check.js";
import { parseJson } from "../src/picker/json.js";
import { pathText } from "../src/picker/places.js";
import { validateTenant } from "../src/picker/validate.js";
import {
  LEGACY_TENANTS,
  ERROR_CODES,
  fixtureBytes,
  lineProblems,
  makeRng,
} from "./picker-helpers.js";
import fs from "node:fs";
import path from "node:path";

const demo = (id) =>
  JSON.parse(fs.readFileSync(path.join(LEGACY_TENANTS, `${id}.json`), "utf8"));
const SEEDS = [demo("uchet-pro"), demo("svet-marketing")];
const SAMPLES = [
  "ok-minimal.json",
  "ok-bounds.json",
  "ok-text-edges.json",
  "e-five-errors.json",
  "e-sort-order.json",
  "e-text-long-all.json",
];
const JUNK = [
  null,
  true,
  false,
  0,
  1,
  -1,
  1.5,
  11,
  366,
  2 ** 53,
  -0,
  "",
  " ",
  "a b",
  "Ты",
  "я".repeat(300),
  "раз ".repeat(19),
  [],
  {},
  [[]],
  { a: 1 },
  ["x"],
  "nope",
  "Unexpected token",
  "undefined",
  "null",
  "NaN",
  "A-B",
  "-x-",
];
const KEYS = [
  "extra",
  "__proto__",
  "constructor",
  "toString",
  "id",
  "type",
  "min",
  "max",
  "options",
  "when",
  "any_of",
  "none_of",
  "question",
  "points",
  "show_if",
  "ты",
];

// Every place of a value: [parent, key] pairs, the root excluded.
function places(value, out = []) {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      out.push([value, key]);
      places(value[key], out);
    }
  }
  return out;
}

function corrupt(source, rng) {
  const tenant = structuredClone(source);
  for (let step = 1 + rng.int(3); step > 0; step--) {
    const all = places(tenant);
    if (all.length === 0) break;
    const [parent, key] = rng.pick(all);
    const op = rng.int(7);
    if (op === 0) parent[key] = structuredClone(rng.pick(JUNK));
    else if (op === 1) {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete parent[key];
    } else if (op === 2) {
      const target = parent[key];
      if (Array.isArray(target)) target.push(structuredClone(rng.pick(JUNK)));
      else if (target !== null && typeof target === "object") {
        Object.defineProperty(target, rng.pick(KEYS), {
          value: structuredClone(rng.pick(JUNK)),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    } else if (op === 3) {
      const [, otherKey] = rng.pick(all);
      const from = rng.pick(all);
      parent[key] = structuredClone(from[0][from[1]]);
      void otherKey;
    } else if (op === 4) {
      if (Array.isArray(parent) && parent.length > 1) {
        const j = rng.int(parent.length);
        [parent[Number(key)], parent[j]] = [parent[j], parent[Number(key)]];
      }
    } else if (op === 5) {
      const v = parent[key];
      if (typeof v === "string")
        parent[key] =
          v +
          rng.pick([
            " ",
            ". ",
            "ты",
            "я".repeat(150),
            " раз".repeat(19),
            "\n",
            "😀",
          ]);
      else if (typeof v === "number")
        parent[key] = v + rng.pick([1, -1, 0.5, 100, -100]);
    } else {
      const v = parent[key];
      if (typeof v === "string")
        parent[key] = rng.pick([
          "x",
          "a b",
          "A",
          "-a-",
          v.toUpperCase(),
          v.slice(0, 1),
        ]);
    }
  }
  return tenant;
}

// The problems of the issues of validateTenant: the shape, the place once, the lines.
function issueProblems(issues, label) {
  const out = [];
  if (!Array.isArray(issues)) return [`${label}: not a list`];
  const seen = new Set();
  for (const issue of issues) {
    if (!ERROR_CODES.includes(issue.code))
      out.push(`${label}: code ${issue.code}`);
    if (
      !Array.isArray(issue.path) ||
      issue.path.some((s) => typeof s !== "string" && typeof s !== "number")
    )
      out.push(`${label}: path`);
    if (typeof issue.text !== "string") out.push(`${label}: text`);
    const key = JSON.stringify(issue.path);
    if (seen.has(key)) out.push(`${label}: place twice ${key}`);
    seen.add(key);
  }
  const lines = issues.map(
    (i) => `x.json: ${pathText(i.path)}: ${i.code}: ${i.text}`,
  );
  out.push(...lineProblems(lines).map((p) => `${label}: ${p}`));
  return out;
}

test("PK-R1: validateTenant on 5000 spoiled objects of both tenants - it does not throw, every code is one of the ten, no place twice, every line has the shape and the words of design 6", () => {
  const rng = makeRng(54001);
  const codes = new Set();
  let withIssues = 0;
  for (let i = 0; i < 5000; i++) {
    const source = SEEDS[i % 2];
    const tenant = corrupt(source, rng);
    // the same object as the reader makes it (no prototype) every fifth time
    const input =
      i % 5 === 0 ? parseJson(JSON.stringify(tenant)).value : tenant;
    let issues;
    try {
      issues = validateTenant(input, {
        fileName: i % 3 === 0 ? undefined : `${source.id}.json`,
      });
    } catch (error) {
      assert.fail(`threw on case ${i}: ${error?.stack ?? error}`);
    }
    const problems = issueProblems(issues, `case ${i}`);
    assert.deepEqual(
      problems,
      [],
      `case ${i}: ${JSON.stringify(tenant).slice(0, 200)}`,
    );
    if (issues.length > 0) withIssues += 1;
    for (const issue of issues) codes.add(issue.code);
  }
  assert.ok(withIssues > 2500, `${withIssues} spoiled objects found`);
  assert.ok(codes.size >= 8, `${codes.size} codes met: ${[...codes].join()}`);
});

test("PK-R1: values that are not objects at the root and spoiled roots do not throw", () => {
  const roots = [
    null,
    true,
    0,
    "",
    "text",
    [],
    [1],
    {},
    { questions: null },
    { questions: "x", solutions: 5, rules: {}, result: [] },
    Object.create(null),
    JUNK,
  ];
  for (const root of roots) {
    const issues = validateTenant(root, { fileName: "x.json" });
    assert.deepEqual(issueProblems(issues, JSON.stringify(root)), []);
    assert.ok(issues.length >= 1);
  }
  assert.deepEqual(
    validateTenant(null).map((i) => [i.code, i.path.length]),
    [["E_FIELD", 0]],
  );
  assert.equal(validateTenant({}).length, 8);
});

test("PK-R2: checkBytes on 3000 files with spoiled bytes - code 0 or 1, no throw, stderr empty, at most 101 lines of the right shape", () => {
  const rng = makeRng(54002);
  const sources = SAMPLES.map((name) => [name, fixtureBytes(name)]);
  for (const id of ["uchet-pro", "svet-marketing"])
    sources.push([
      `${id}.json`,
      fs.readFileSync(path.join(LEGACY_TENANTS, `${id}.json`)),
    ]);
  const exits = new Set();
  for (let i = 0; i < 3000; i++) {
    const [name, original] = rng.pick(sources);
    const bytes = Array.from(original);
    // one file in ten is left as it is, a blank or a BOM keeps a good file good
    for (let step = i % 10 === 0 ? 0 : 1 + rng.int(3); step > 0; step--) {
      const at = rng.int(bytes.length + 1);
      const op = rng.int(6);
      if (op === 0) bytes[at] = rng.int(256);
      else if (op === 1) bytes.splice(at, 1);
      else if (op === 2)
        bytes.splice(
          at,
          0,
          rng.pick([
            0x22, 0x2c, 0x7b, 0x7d, 0x5b, 0x5d, 0xff, 0x00, 0x0a, 0xc3, 0xef,
          ]),
        );
      else if (op === 3) bytes.length = at;
      else if (op === 4) bytes.splice(0, 0, 0x20);
      else bytes.splice(0, 0, 0xef, 0xbb, 0xbf);
    }
    let r;
    try {
      r = checkBytes(Uint8Array.from(bytes), name);
    } catch (error) {
      assert.fail(`threw on file ${i}: ${error?.stack ?? error}`);
    }
    exits.add(r.exitCode);
    assert.ok(
      r.exitCode === 0 || r.exitCode === 1,
      `file ${i}: code ${r.exitCode}`,
    );
    assert.deepEqual(r.stderr, []);
    assert.ok(
      r.stdout.length >= 1 && r.stdout.length <= 101,
      `file ${i}: ${r.stdout.length} lines`,
    );
    if (r.exitCode === 1)
      assert.deepEqual(lineProblems(r.stdout), [], `file ${i}`);
    else
      assert.match(
        r.stdout[0],
        /^Файл арендатора [a-z0-9-]+ в порядке: вопросов \d+, решений \d+, правил \d+\.$/u,
      );
  }
  assert.ok(exits.has(0) && exits.has(1));
});

// The text of a tenant file around a list.
const around = (field, items) => {
  const t = structuredClone(SEEDS[0]);
  t[field] = items;
  return JSON.stringify(t);
};

test("PK-R3: hostile files below 512 KB - deep nesting, thousands of rules, questions and options, 60000 phrases, 500000 brackets: code 1, at most 101 lines, a few seconds at most", () => {
  const rule = (i) => ({
    id: `z${i}`,
    when: [{ question: "business", any_of: ["retail"] }],
    solution: "shop-kit",
    points: 0,
    text: "Правило.",
  });
  const question = (i) => ({
    id: `q${i}`,
    title: "Вопрос?",
    type: "single",
    required: true,
    options: [
      { id: "a", label: "Да" },
      { id: "a", label: "Нет" },
    ],
  });
  const files = [
    ["brackets", "[".repeat(500000)],
    ["braces", '{"a":'.repeat(100000)],
    ["deep tenant", `{"schema":${"[".repeat(1000)}${"]".repeat(1000)}}`],
    [
      "rules",
      around(
        "rules",
        Array.from({ length: 3500 }, (_, i) => rule(i)),
      ),
    ],
    [
      "questions",
      around(
        "questions",
        Array.from({ length: 2500 }, (_, i) => question(i)),
      ),
    ],
    [
      "phrases",
      (() => {
        const t = structuredClone(SEEDS[1]);
        t.intro = "а. ".repeat(60000);
        return JSON.stringify(t);
      })(),
    ],
    [
      "any_of",
      (() => {
        const t = structuredClone(SEEDS[0]);
        t.rules[0].when[0].any_of = Array.from(
          { length: 8000 },
          (_, i) => `v${i}`,
        );
        return JSON.stringify(t);
      })(),
    ],
    [
      "long texts",
      (() => {
        const t = structuredClone(SEEDS[0]);
        t.intro = "я".repeat(200000);
        return JSON.stringify(t);
      })(),
    ],
    [
      "many keys",
      `{${Array.from({ length: 30000 }, (_, i) => `"k${i}":1`).join(",")}}`,
    ],
  ];
  for (const [label, text] of files) {
    const bytes = new TextEncoder().encode(text);
    assert.ok(bytes.length <= 524288, `${label}: ${bytes.length} bytes`);
    const started = performance.now();
    const r = checkBytes(bytes, "x.json");
    const ms = performance.now() - started;
    assert.equal(r.exitCode, 1, label);
    assert.ok(
      r.stdout.length >= 1 && r.stdout.length <= 101,
      `${label}: ${r.stdout.length} lines`,
    );
    assert.deepEqual(lineProblems(r.stdout), [], label);
    assert.ok(ms < 5000, `${label}: ${Math.round(ms)} ms`);
  }
});

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

test("PK-R4: validateTenant does not change what it is given (a deeply frozen object) and gives the same answer twice", () => {
  const rng = makeRng(54004);
  const inputs = [];
  for (const tenant of SEEDS)
    inputs.push([`${tenant.id}.json`, deepFreeze(structuredClone(tenant))]);
  for (const name of SAMPLES) {
    const parsed = parseJson(fixtureBytes(name).toString("utf8"));
    inputs.push([name, deepFreeze(parsed.value)]);
  }
  for (let i = 0; i < 300; i++)
    inputs.push(["x.json", deepFreeze(corrupt(SEEDS[i % 2], rng))]);
  for (const [fileName, input] of inputs) {
    const before = JSON.stringify(input);
    const a = validateTenant(input, { fileName });
    const b = validateTenant(input, { fileName });
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(input), before);
  }
  // the good files stay good: the answer "nothing" is among them
  assert.equal(
    inputs
      .slice(0, 3)
      .filter(
        ([name, input]) =>
          validateTenant(input, { fileName: name }).length === 0,
      ).length,
    3,
  );
  // the options object is not changed either
  const options = Object.freeze({ fileName: "uchet-pro.json" });
  assert.deepEqual(
    validateTenant(deepFreeze(structuredClone(SEEDS[0])), options),
    [],
  );
});
