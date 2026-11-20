import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createEntry } from "../../api/index.js";
import { PUBLIC_LANGS, SOURCE_LANGS } from "../../public/shared/i18n/lang.js";
import { createApp, createFunctionApp } from "../../server/app.js";
import { readConfig } from "../../server/config.js";
import { loadIntake } from "../../server/routes/demo.js";
import { loadStaticSite } from "../../server/static.js";
import { APP, readApp, tempDir } from "../fixtures/helpers.js";

// REQ-111 criterion 7: the two demo routes, GET /api/demo/questionnaire and POST /api/demo/result, through
// createApp with the source languages (the local server and Docker) and through the function entry with the
// public languages (the Vercel function). The oracle is the test's own: the intake file read as JSON and a
// scoring written again here, never the code under test.

const ORIGIN = "https://app.example.test";
const LOCAL = "http://127.0.0.1:1";
const INTAKE_FILE = path.join(APP, "content", "sai-intake.json");
const RAW = JSON.parse(fs.readFileSync(INTAKE_FILE, "utf8"));
const ANSWERS_DIR = path.join(APP, "content", "sai-intake.answers");
/** @type {Array<[string, Record<string, string>]>} */
const FIXTURES = fs
  .readdirSync(ANSWERS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => [
    f,
    JSON.parse(fs.readFileSync(path.join(ANSWERS_DIR, f), "utf8")),
  ]);
/** The keys of a log line (REQ-108 criterion 10). */
const LOG_KEYS = [
  "ts",
  "level",
  "req_id",
  "route",
  "status",
  "ms",
  "actor_kind",
  "org_id",
  "job_id",
  "code",
];
const JSON_TYPE = "application/json; charset=utf-8";

/** The questionnaire in a language, by the test's own reading of the intake file. */
const questionnaireOf = (/** @type {string} */ lang) => ({
  lang,
  questions: RAW.questions.map((/** @type {any} */ q) => ({
    id: q.id,
    title: q.title[lang],
    options: q.options.map((/** @type {any} */ o) => ({
      id: o.id,
      label: o.label[lang],
    })),
  })),
});

/**
 * The result of the engine for answers, scored again from the intake file: the points of the rules whose
 * conditions all hold, the solutions in order of points and then of place, those from `min_score` up to
 * `top`, and whether the first has the lead of `clear_lead_gap`.
 * @param {Record<string, string>} answers
 * @param {string} lang
 */
function resultOf(answers, lang) {
  /** @type {Map<string, number>} */
  const scores = new Map(
    RAW.solutions.map((/** @type {any} */ s) => [s.id, 0]),
  );
  for (const rule of RAW.rules)
    if (
      rule.when.every((/** @type {any} */ c) =>
        c.any_of.includes(answers[c.question]),
      )
    )
      scores.set(
        rule.solution,
        /** @type {number} */ (scores.get(rule.solution)) + rule.points,
      );
  const best = RAW.solutions
    .map((/** @type {any} */ s, /** @type {number} */ place) => ({
      s,
      place,
      score: /** @type {number} */ (scores.get(s.id)),
    }))
    .sort(
      (/** @type {any} */ a, /** @type {any} */ b) =>
        b.score - a.score || a.place - b.place,
    )
    .filter((/** @type {any} */ e) => e.score >= RAW.result.min_score)
    .slice(0, RAW.result.top);
  return {
    lang,
    clear_leader:
      best.length === 0
        ? null
        : best.length === 1
          ? true
          : best[0].score - best[1].score >= RAW.result.clear_lead_gap,
    recommended: best.map((/** @type {any} */ e) => ({
      id: e.s.id,
      name: e.s.name[lang],
      summary: e.s.summary[lang],
      includes: e.s.includes.map((/** @type {any} */ t) => t[lang]),
      not_suitable_when: e.s.not_suitable_when.map(
        (/** @type {any} */ t) => t[lang],
      ),
    })),
    no_match_text: best.length === 0 ? RAW.result.no_match_text[lang] : null,
  };
}

/**
 * The names of the keys of a value at every depth.
 * @param {any} value
 * @param {Set<string>} [out]
 * @returns {Set<string>}
 */
function keysDeep(value, out = new Set()) {
  if (Array.isArray(value)) for (const v of value) keysDeep(v, out);
  else if (value !== null && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  return out;
}

/**
 * One way to reach the demo routes: the app of the local server, or the function entry of the Vercel
 * function. `fetch(pathAndQuery, init)` answers with the status, the headers and the text.
 * @typedef {{ name: string, langs: readonly string[], logs: Array<Record<string, any>>, fetch: (p: string, init?: RequestInit) => Promise<{ status: number, headers: Headers, text: string }> }} Way
 */

/**
 * @param {import("../../server/routes/demo.js").Intake} intake
 * @param {{ siteGate?: boolean }} [o]
 * @returns {Way}
 */
function local(intake, o = {}) {
  /** @type {Array<Record<string, any>>} */
  const logs = [];
  const app = createApp({
    config: { siteGate: o.siteGate ?? false, version: "dev" },
    origins: { app: LOCAL, preview: "http://localhost:1" },
    db: null,
    site: loadStaticSite(),
    migrations: [],
    log: (e) => logs.push(e),
    demo: { intake, langs: SOURCE_LANGS },
  });
  return {
    name: "createApp",
    langs: SOURCE_LANGS,
    logs,
    async fetch(p, init) {
      const r = await app.fetch(new Request(`${LOCAL}${p}`, init));
      return { status: r.status, headers: r.headers, text: await r.text() };
    },
  };
}

/**
 * @param {import("../../server/routes/demo.js").Intake} intake
 * @param {{ siteGate?: boolean }} [o]
 * @returns {Way}
 */
function entry(intake, o = {}) {
  /** @type {Array<Record<string, any>>} */
  const logs = [];
  const e = createEntry(() =>
    createFunctionApp(
      readConfig({
        APP_ORIGIN: ORIGIN,
        ...(o.siteGate ? { SITE_GATE: "closed" } : {}),
      }),
      { intake, log: (x) => logs.push(x) },
    ),
  );
  return {
    name: "createEntry",
    langs: PUBLIC_LANGS,
    logs,
    async fetch(p, init) {
      const r = await e.fetch(new Request(`${ORIGIN}${p}`, init));
      return { status: r.status, headers: r.headers, text: await r.text() };
    },
  };
}

/** The real intake, loaded as the app loads it. */
const real = () => {
  const intake = loadIntake();
  assert.equal(intake.ok, true);
  return intake;
};
/** Both ways, over the same intake. */
const ways = (
  /** @type {import("../../server/routes/demo.js").Intake} */ i,
) => [local(i), entry(i)];
/** @param {unknown} answers */
const post = (answers) => ({
  method: "POST",
  body: JSON.stringify({ answers }),
});

// ---------------------------------------------------------------------------------------------------------

test("DM-1 the questionnaire in ru: 200, JSON, no-store, five questions field by field, and a field planted into the intake does not reach the answer", async (t) => {
  for (const way of ways(real())) {
    const r = await way.fetch("/api/demo/questionnaire?lang=ru");
    assert.equal(r.status, 200, way.name);
    assert.equal(r.headers.get("content-type"), JSON_TYPE);
    assert.equal(r.headers.get("cache-control"), "no-store");
    const body = JSON.parse(r.text);
    assert.deepEqual(Object.keys(body), ["lang", "questions"]);
    assert.equal(body.lang, "ru");
    assert.equal(body.questions.length, 5);
    for (const q of body.questions) {
      assert.deepEqual(Object.keys(q), ["id", "title", "options"]);
      assert.ok(q.options.length >= 2 && q.options.length <= 4);
      for (const o of q.options)
        assert.deepEqual(Object.keys(o), ["id", "label"]);
    }
    assert.deepEqual(body, questionnaireOf("ru"), way.name);
    // The same answer to the request that names no language.
    const none = await way.fetch("/api/demo/questionnaire");
    assert.equal(none.text, r.text);
    // Nothing of the intake but the five questions: no help, rule, point, condition or solution text.
    const keys = keysDeep(body);
    for (const k of [
      "help",
      "required",
      "type",
      "rules",
      "points",
      "solutions",
      "summary",
      "includes",
      "when",
      "any_of",
      "result",
      "intro",
      "name",
      "schema",
    ])
      assert.ok(!keys.has(k), `${way.name}: the key ${k}`);
  }

  // A field planted into a copy of the intake is absent from the answer (the answer is built field by
  // field, never the question object passed on): on the question, on an option, and at the top.
  const planted = structuredClone(RAW);
  planted.secret_top = "PLANT-TOP";
  planted.questions.forEach((/** @type {any} */ q, /** @type {number} */ k) => {
    q.help = { ru: `PLANT-HELP-${k}`, kk: "x", en: "x" };
    q.hint = `PLANT-HINT-${k}`;
    q.extra = { nested: [`PLANT-EXTRA-${k}`] };
    q.options.forEach((/** @type {any} */ o) => {
      o.help = `PLANT-OPT-${k}`;
      o.score = 99;
    });
  });
  const file = path.join(tempDir(t), "planted.json");
  fs.writeFileSync(file, JSON.stringify(planted));
  const intake = loadIntake(file);
  assert.equal(intake.ok, true);
  for (const way of ways(intake)) {
    const r = await way.fetch("/api/demo/questionnaire?lang=ru");
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.text), questionnaireOf("ru"), way.name);
    assert.ok(!r.text.includes("PLANT"), way.name);
  }
});

test("DM-2 the language comes from ?lang= alone: ru and en; kk on the local server and ru through the function entry; anything else, and no value, ru; a header changes nothing", async () => {
  const [lo, en] = ways(real());
  assert.deepEqual([...lo.langs], ["ru", "kk", "en"]);
  assert.deepEqual([...en.langs], ["ru", "en"]);
  /** @type {Array<[string, string]>} */
  const rows = [
    ["?lang=ru", "ru"],
    ["?lang=en", "en"],
    ["?lang=de", "ru"],
    ["?lang=RU", "ru"],
    ["?lang=EN", "ru"],
    ["?lang=", "ru"],
    ["?lang=" + "x".repeat(1000), "ru"],
    ["?lang=%3Cscript%3E", "ru"],
    ["?lang=ru-RU", "ru"],
    ["?lang=en%20", "ru"],
    ["?lang=en&lang=ru", "en"],
    ["?other=en", "ru"],
    ["", "ru"],
  ];
  for (const way of [lo, en]) {
    const all = /** @type {Array<[string, string]>} */ ([
      ...rows,
      ["?lang=kk", way.langs.includes("kk") ? "kk" : "ru"],
    ]);
    for (const [query, lang] of all) {
      for (const headers of [
        undefined,
        { "Accept-Language": "en" },
        { "Accept-Language": "kk,en;q=0.5" },
        { "Accept-Language": "de" },
      ]) {
        const label = `${way.name} ${query.slice(0, 30)} ${JSON.stringify(headers)}`;
        const q = await way.fetch(`/api/demo/questionnaire${query}`, {
          headers,
        });
        assert.equal(q.status, 200, label);
        assert.deepEqual(JSON.parse(q.text), questionnaireOf(lang), label);
        const r = await way.fetch(`/api/demo/result${query}`, {
          ...post(FIXTURES[0][1]),
          headers,
        });
        assert.equal(r.status, 200, label);
        assert.deepEqual(
          JSON.parse(r.text),
          resultOf(FIXTURES[0][1], lang),
          label,
        );
      }
    }
  }
  // Through the function entry the path that the platform rewrites gives the same answers.
  const viaRewrite = await en.fetch(
    "/api/index?__p=demo/questionnaire&lang=en",
  );
  assert.deepEqual(JSON.parse(viaRewrite.text), questionnaireOf("en"));
  const viaRewriteKk = await en.fetch(
    "/api/index?__p=demo/questionnaire&lang=kk",
  );
  assert.deepEqual(JSON.parse(viaRewriteKk.text), questionnaireOf("ru"));
  const viaRewritePost = await en.fetch(
    "/api/index?__p=demo/result&lang=en",
    post({}),
  );
  assert.deepEqual(JSON.parse(viaRewritePost.text), resultOf({}, "en"));
});

test("DM-3 the result in the language, field by field: the fields of the design and no other; every fixture in each language and 900 combinations in ru", async (t) => {
  const EXCLUDED = [
    "ranking",
    "score",
    "scores",
    "rules",
    "points",
    "price_text",
    "duration_text",
    "needs_from_you",
    "next_steps",
    "hypotheses",
    "because",
    "when",
    "min_score",
    "top",
  ];
  /** @param {string} text @param {string} label */
  const shape = (text, label) => {
    const body = JSON.parse(text);
    assert.deepEqual(
      Object.keys(body),
      ["lang", "clear_leader", "recommended", "no_match_text"],
      label,
    );
    for (const s of body.recommended)
      assert.deepEqual(
        Object.keys(s),
        ["id", "name", "summary", "includes", "not_suitable_when"],
        label,
      );
    const keys = keysDeep(body);
    for (const k of EXCLUDED) assert.ok(!keys.has(k), `${label}: ${k}`);
    return body;
  };
  const [lo, en] = ways(real());
  let seen = 0;
  for (const way of [lo, en])
    for (const lang of ["ru", "kk", "en"]) {
      const served = way.langs.includes(lang) ? lang : "ru";
      for (const [name, answers] of FIXTURES) {
        const label = `${way.name} ${lang} ${name}`;
        const r = await way.fetch(
          `/api/demo/result?lang=${lang}`,
          post(answers),
        );
        assert.equal(r.status, 200, label);
        assert.equal(r.headers.get("content-type"), JSON_TYPE);
        assert.equal(r.headers.get("cache-control"), "no-store");
        const body = shape(r.text, label);
        assert.deepEqual(body, resultOf(answers, served), label);
        // The skeleton of the answer: a solution that fits has its limit written, no match has its text.
        if (body.recommended.length > 0) {
          assert.equal(body.no_match_text, null);
          for (const s of body.recommended)
            assert.ok(s.not_suitable_when.length >= 1);
        } else assert.equal(typeof body.no_match_text, "string");
        seen += 1;
      }
    }
  assert.equal(seen, FIXTURES.length * 6);
  // The fixtures reach both kinds of answer: a recommendation and the no-match text.
  const kinds = new Set(
    FIXTURES.map(([, a]) => resultOf(a, "ru").recommended.length > 0),
  );
  assert.deepEqual([...kinds].sort(), [false, true]);
  // The fields that the engine answers and the page must not get, planted into a copy of the intake: a price
  // and a term on every solution, and hypotheses that the answers fire. The engine gives them (the picker's
  // own result carries them); the route does not.
  const tmp = tempDir(t);
  const rich = structuredClone(RAW);
  for (const s of rich.solutions) {
    s.price_text = { ru: "PLANT-PRICE", kk: "PLANT-PRICE", en: "PLANT-PRICE" };
    s.duration_text = { ru: "PLANT-TERM", kk: "PLANT-TERM", en: "PLANT-TERM" };
  }
  rich.hypotheses = [
    {
      id: "plant-h",
      when: [{ question: "goal", any_of: ["tell"] }],
      title: {
        ru: "PLANT-HYPOTHESIS",
        kk: "PLANT-HYPOTHESIS",
        en: "PLANT-HYPOTHESIS",
      },
      explanation: { ru: "PLANT-WHY", kk: "PLANT-WHY", en: "PLANT-WHY" },
    },
  ];
  const richFile = path.join(tmp, "rich.json");
  fs.writeFileSync(richFile, JSON.stringify(rich));
  const richIntake = loadIntake(richFile);
  assert.equal(richIntake.ok, true);
  for (const way of ways(richIntake)) {
    const r = await way.fetch(
      "/api/demo/result?lang=en",
      post({ goal: "tell" }),
    );
    assert.equal(r.status, 200, way.name);
    assert.ok(
      !r.text.includes("PLANT"),
      `${way.name}: a planted field is in the answer`,
    );
    assert.deepEqual(shape(r.text, way.name), resultOf({ goal: "tell" }, "en"));
  }
  // Every combination of answers, each question answered or left to «Не знаю»: 5 × 3 × 5 × 3 × 4 = 900.
  /** @type {Array<Array<string | null>>} */
  const choices = RAW.questions.map((/** @type {any} */ q) => [
    null,
    ...q.options.map((/** @type {any} */ o) => o.id),
  ]);
  let combos = 0;
  /** @param {number} k @param {Record<string, string>} so */
  const walk = async (k, so) => {
    if (k === RAW.questions.length) {
      combos += 1;
      const r = await lo.fetch("/api/demo/result?lang=ru", post(so));
      assert.equal(r.status, 200, JSON.stringify(so));
      assert.deepEqual(
        shape(r.text, JSON.stringify(so)),
        resultOf(so, "ru"),
        JSON.stringify(so),
      );
      return;
    }
    for (const c of choices[k])
      await walk(k + 1, c === null ? so : { ...so, [RAW.questions[k].id]: c });
  };
  await walk(0, {});
  assert.equal(combos, 900);
});

test("DM-4 the seven refusals answer 400 with their codes, a body over 65 536 bytes 413, and the next request is answered", async () => {
  /** @type {Array<[string, string, BodyInit]>} */
  const cases = [
    ["bad_json", "text", "this is not JSON"],
    ["bad_json", "empty", ""],
    ["bad_json", "invalid UTF-8", new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])],
    [
      "bad_json",
      "invalid UTF-8 inside a string of an object that would be read",
      new Uint8Array([
        ...new TextEncoder().encode('{"answers":{"goal":"te'),
        0xff,
        ...new TextEncoder().encode('ll"}}'),
      ]),
    ],
    ["bad_json", "a truncated object", '{"answers":{"goal":"tell"'],
    ["bad_body", "an array", "[]"],
    ["bad_body", "null", "null"],
    ["bad_body", "a string", '"answers"'],
    ["bad_body", "a number", "7"],
    ["bad_body", "no key", "{}"],
    ["bad_body", "another key", '{"answer":{}}'],
    ["bad_body", "a second key", '{"answers":{},"x":1}'],
    ["bad_answers", "an array", '{"answers":[]}'],
    ["bad_answers", "a string", '{"answers":"goal"}'],
    ["bad_answers", "null", '{"answers":null}'],
    ["bad_answers", "a number", '{"answers":1}'],
    ["unknown_question", "an unknown question", '{"answers":{"nope":"tell"}}'],
    [
      "unknown_question",
      "one known and one unknown",
      '{"answers":{"goal":"tell","zzz":"a"}}',
    ],
    ["unknown_option", "an unknown option", '{"answers":{"goal":"zzz"}}'],
    [
      "unknown_option",
      "an option of another question",
      '{"answers":{"goal":"clients"}}',
    ],
    ["wrong_kind", "a list", '{"answers":{"goal":["tell"]}}'],
    ["wrong_kind", "a number", '{"answers":{"goal":1}}'],
    ["wrong_kind", "null", '{"answers":{"goal":null}}'],
    ["wrong_kind", "an object", '{"answers":{"goal":{"id":"tell"}}}'],
  ];
  // The six codes cover the seven cases of E9 (not JSON, not an object and another key both give bad_body).
  assert.equal(new Set(cases.map(([c]) => c)).size, 6);
  for (const way of ways(real())) {
    const before = await way.fetch(
      "/api/demo/result?lang=ru",
      post(FIXTURES[0][1]),
    );
    const questions = await way.fetch("/api/demo/questionnaire?lang=ru");
    assert.equal(before.status, 200);
    for (const [code, what, body] of cases) {
      const r = await way.fetch("/api/demo/result?lang=ru", {
        method: "POST",
        body,
      });
      assert.equal(r.status, 400, `${way.name} ${code}: ${what}`);
      assert.equal(
        r.text,
        JSON.stringify({ error: code }),
        `${way.name} ${what}`,
      );
      assert.equal(r.headers.get("content-type"), JSON_TYPE);
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert.equal(r.headers.get("set-cookie"), null);
      // Nothing changed: the next requests give what they gave before.
      const next = await way.fetch(
        "/api/demo/result?lang=ru",
        post(FIXTURES[0][1]),
      );
      assert.equal(next.status, 200);
      assert.equal(next.text, before.text, `${way.name} after ${what}`);
      const again = await way.fetch("/api/demo/questionnaire?lang=ru");
      assert.equal(again.text, questions.text);
    }
    // 65 536 bytes are read; one more is refused before the route runs.
    const pad = (/** @type {number} */ n) =>
      `{"answers":{}}${" ".repeat(n - '{"answers":{}}'.length)}`;
    const edge = await way.fetch("/api/demo/result?lang=ru", {
      method: "POST",
      body: pad(65536),
    });
    assert.equal(edge.status, 200, `${way.name}: 65 536 bytes`);
    const over = await way.fetch("/api/demo/result?lang=ru", {
      method: "POST",
      body: pad(65537),
    });
    assert.equal(over.status, 413, way.name);
    assert.equal(over.text, '{"error":"body_too_large"}');
    const huge = await way.fetch("/api/demo/result?lang=ru", {
      method: "POST",
      body: new Uint8Array(300000),
    });
    assert.equal(huge.status, 413);
    const next = await way.fetch(
      "/api/demo/result?lang=ru",
      post(FIXTURES[0][1]),
    );
    assert.equal(next.text, before.text, `${way.name} after 413`);
  }
});

test("DM-5 GET on the result and a non-GET on the questionnaire answer the uniform 404", async () => {
  for (const way of ways(real())) {
    const missing = await way.fetch("/api/demo/nothing");
    assert.equal(missing.status, 404);
    assert.equal(missing.text, '{"error":"not_found"}');
    /** @type {Array<[string, string, RequestInit | undefined]>} */
    const wrong = [
      ["GET result", "/api/demo/result", undefined],
      ["GET result with a query", "/api/demo/result?lang=en", undefined],
      ["HEAD result", "/api/demo/result", { method: "HEAD" }],
      ["PUT result", "/api/demo/result", { method: "PUT", body: "{}" }],
      ["DELETE result", "/api/demo/result", { method: "DELETE" }],
      [
        "POST questionnaire",
        "/api/demo/questionnaire",
        { method: "POST", body: "{}" },
      ],
      [
        "PUT questionnaire",
        "/api/demo/questionnaire",
        { method: "PUT", body: "{}" },
      ],
      [
        "PATCH questionnaire",
        "/api/demo/questionnaire",
        { method: "PATCH", body: "{}" },
      ],
      ["DELETE questionnaire", "/api/demo/questionnaire", { method: "DELETE" }],
      ["a path with a slash", "/api/demo/questionnaire/", undefined],
      ["a longer path", "/api/demo/questionnaire/x", undefined],
      [
        "a longer path of the result",
        "/api/demo/result/x",
        { method: "POST", body: "{}" },
      ],
      ["another case", "/api/demo/Questionnaire", undefined],
    ];
    for (const [what, p, init] of wrong) {
      const r = await way.fetch(p, init);
      assert.equal(r.status, 404, `${way.name} ${what}`);
      // HEAD has no body; every other answer is the one body of every unknown /api address.
      assert.equal(
        r.text,
        what.startsWith("HEAD") ? "" : missing.text,
        `${way.name} ${what}`,
      );
      assert.equal(r.headers.get("content-type"), JSON_TYPE);
      assert.equal(r.headers.get("cache-control"), "no-store");
    }
    // The two real routes still answer.
    assert.equal((await way.fetch("/api/demo/questionnaire")).status, 200);
    assert.equal((await way.fetch("/api/demo/result", post({}))).status, 200);
  }
  // An app made with no demo has no demo paths: the same uniform 404 (the routes are given, not built in).
  const bare = createApp({
    config: { siteGate: false, version: "dev" },
    origins: { app: LOCAL, preview: "http://localhost:1" },
    db: null,
    site: loadStaticSite(),
    migrations: [],
    log: () => {},
  });
  for (const [
    p,
    init,
  ] of /** @type {Array<[string, RequestInit | undefined]>} */ ([
    ["/api/demo/questionnaire", undefined],
    ["/api/demo/result", { method: "POST", body: "{}" }],
  ])) {
    const r = await bare.fetch(new Request(`${LOCAL}${p}`, init));
    assert.equal(r.status, 404);
    assert.equal(await r.text(), '{"error":"not_found"}');
  }
});

/** The intakes of DM-6: a missing file, broken files, one whose engine call throws, and the planted L2 rows. */
function brokenIntakes(/** @type {string} */ dir) {
  /** @param {string} name @param {string} text */
  const write = (name, text) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, text);
    return file;
  };
  /** @param {(t: any) => void} edit */
  const edited = (edit) => {
    const t = structuredClone(RAW);
    edit(t);
    return JSON.stringify(t);
  };
  /** A value nested `depth` objects deep: it overflows any recursive copy. */
  const deepObject = (/** @type {number} */ depth) =>
    `${'{"a":'.repeat(depth)}1${"}".repeat(depth)}`;
  const deepArray = (/** @type {number} */ depth) =>
    `${"[".repeat(depth)}1${"]".repeat(depth)}`;
  /** @type {Array<[string, string]>} */
  const list = [
    ["missing", path.join(dir, "no-such-file.json")],
    ["empty", write("empty.json", "")],
    ["not JSON", write("text.json", "{ this is not json")],
    ["an array", write("array.json", "[]")],
    ["null", write("null.json", "null")],
    [
      "another schema",
      write(
        "schema.json",
        edited((t) => (t.schema = "sai-picker-tenant/3")),
      ),
    ],
    [
      "another id",
      write(
        "id.json",
        edited((t) => (t.id = "other")),
      ),
    ],
    [
      "four questions",
      write(
        "four.json",
        edited((t) => t.questions.pop()),
      ),
    ],
    [
      "a multiple question",
      write(
        "multiple.json",
        edited((t) => (t.questions[0].type = "multiple")),
      ),
    ],
    [
      "options that are no array",
      write(
        "options.json",
        edited((t) => (t.questions[1].options = "x")),
      ),
    ],
    [
      "solutions that are no array",
      write(
        "solutions.json",
        edited((t) => (t.solutions = {})),
      ),
    ],
    [
      "rules that are no array",
      write(
        "rules.json",
        edited((t) => (t.rules = null)),
      ),
    ],
    [
      "no result",
      write(
        "result.json",
        edited((t) => delete t.result),
      ),
    ],
    [
      "a result that is an array",
      write(
        "result-array.json",
        edited((t) => (t.result = [])),
      ),
    ],
  ];
  return {
    list,
    /** Accepted by the loader, and the engine throws. */
    engine: write(
      "engine.json",
      edited((t) => (t.solutions = [null])),
    ),
    /** SECURITY-REVIEWER L2 of the first pass: accepted by the loader, and the projection cannot read it. */
    nullOption: write(
      "null-option.json",
      edited((t) => (t.questions[0].options[1] = null)),
    ),
    optionString: write(
      "option-string.json",
      edited((t) => (t.questions[2].options[0] = null)),
    ),
    deepObject: write(
      "deep-object.json",
      edited((t) => (t.questions[0].title = "DEEP")).replace(
        '"DEEP"',
        deepObject(20000),
      ),
    ),
    deepArray: write(
      "deep-array.json",
      edited((t) => (t.questions[0].title = "DEEP")).replace(
        '"DEEP"',
        deepArray(50000),
      ),
    ),
    deepLabel: write(
      "deep-label.json",
      edited((t) => (t.questions[3].options[0].label = "DEEP")).replace(
        '"DEEP"',
        deepObject(30000),
      ),
    ),
  };
}

test("DM-6 a missing or broken intake gives 503 demo_unavailable on both routes, and so does an engine that throws; health and the pages stay as they were", async (t) => {
  const dir = tempDir(t);
  const planted = brokenIntakes(dir);
  const good = real();
  const goodWays = ways(good);
  const health = await goodWays[0].fetch("/api/health");
  const entryHealth = await goodWays[1].fetch("/api/health");
  const pages = [
    ["/", readApp("public/index.html")],
    ["/how.html", readApp("public/how.html")],
    ["/demo.html", readApp("public/demo.html")],
  ];
  const UNAVAILABLE = '{"error":"demo_unavailable"}';

  /**
   * Both routes, through both ways, for an intake that the loader refuses.
   * @param {string} label
   * @param {string} file
   */
  const check = async (label, file) => {
    const intake = loadIntake(file);
    for (const way of ways(intake)) {
      const q = await way.fetch("/api/demo/questionnaire?lang=ru");
      const r = await way.fetch(
        "/api/demo/result?lang=ru",
        post({ goal: "tell" }),
      );
      const r2 = await way.fetch("/api/demo/result?lang=en", post({}));
      for (const [what, x] of [
        ["questionnaire", q],
        ["result", r],
        ["result with no answer", r2],
      ])
        assert.deepEqual(
          [x.status, x.text],
          [503, UNAVAILABLE],
          `${label} ${way.name}: ${what}`,
        );
      for (const x of [q, r]) {
        assert.equal(x.headers.get("content-type"), JSON_TYPE);
        assert.equal(x.headers.get("cache-control"), "no-store");
      }
      // The code is in the log line of the request, and nothing else of it.
      const lines = way.logs.filter((l) => l.status === 503);
      for (const l of lines) {
        assert.equal(l.code, "demo_unavailable", `${label} ${way.name}`);
        for (const k of Object.keys(l)) assert.ok(LOG_KEYS.includes(k), k);
      }
      // Every other route answers as before, and the app answers the next request.
      const h = await way.fetch("/api/health");
      const was = way.name === "createApp" ? health : entryHealth;
      assert.equal(h.status, was.status, `${label} ${way.name}: health`);
      assert.deepEqual(JSON.parse(h.text), JSON.parse(was.text));
      const miss = await way.fetch("/api/demo/other");
      assert.equal(miss.text, '{"error":"not_found"}');
      if (way.name === "createApp")
        for (const [p, bytes] of pages) {
          const page = await way.fetch(p);
          assert.equal(page.status, 200, `${label}: ${p}`);
          assert.equal(page.text, bytes.toString("utf8"), `${label}: ${p}`);
        }
    }
  };

  // A missing and a broken file: the loader says no, and both routes say 503.
  assert.equal(planted.list.length, 14);
  for (const [label, file] of planted.list) {
    assert.deepEqual(loadIntake(file), { ok: false }, label);
    await check(label, file);
  }
  // A file that the loader accepts and whose engine call throws: the result is 503, the next request is
  // answered, and the log line of the refused one holds the code.
  assert.equal(loadIntake(planted.engine).ok, true);
  for (const way of ways(loadIntake(planted.engine))) {
    const r = await way.fetch(
      "/api/demo/result?lang=ru",
      post({ goal: "tell" }),
    );
    assert.equal(r.status, 503, way.name);
    assert.equal(r.text, UNAVAILABLE);
    const line = way.logs.at(-1);
    assert.equal(line?.status, 503);
    assert.equal(line?.code, "demo_unavailable");
    assert.equal(line?.route, "/api/demo/result");
    const next = await way.fetch("/api/demo/result?lang=ru", post({}));
    assert.equal(next.status, 503);
    assert.equal((await way.fetch("/api/demo/other")).status, 404);
  }
  // SECURITY-REVIEWER L2 of the first review pass: an intake that the loader accepts and that the projection
  // of the questionnaire cannot read (an option that is null; a value nested too deep to copy) answers one
  // stable code on the questionnaire, as the result does for the same intake.
  // Each row names the question whose answer reaches the broken place (the engine reads an option only
  // for a question that is answered).
  for (const [
    label,
    file,
    k,
  ] of /** @type {Array<[string, string, number]>} */ ([
    ["an option that is null", planted.nullOption, 0],
    ["an option that is null in another question", planted.optionString, 2],
    ["an object nested 20000 deep", planted.deepObject, 0],
    ["an array nested 50000 deep", planted.deepArray, 0],
    ["a label nested 30000 deep", planted.deepLabel, 3],
  ])) {
    const loaded = loadIntake(file);
    for (const way of ways(loaded)) {
      const q = await way.fetch("/api/demo/questionnaire?lang=ru");
      assert.equal(q.status, 503, `${label} ${way.name}: questionnaire`);
      assert.equal(q.text, UNAVAILABLE, `${label} ${way.name}`);
      // The result with an answer that reaches the broken place gives the same code.
      const r = await way.fetch(
        "/api/demo/result?lang=ru",
        post({ [RAW.questions[k].id]: RAW.questions[k].options[1].id }),
      );
      assert.equal(r.status, 503, `${label} ${way.name}: result`);
      assert.equal(r.text, UNAVAILABLE);
      const lines = way.logs.filter((l) => l.status >= 500);
      assert.ok(lines.length >= 2);
      for (const l of lines)
        assert.equal(l.code, "demo_unavailable", `${label} ${way.name}`);
      assert.deepEqual(
        way.logs.filter((l) => l.status === 500),
        [],
        `${label} ${way.name}: a 500`,
      );
      const h = await way.fetch("/api/health");
      assert.equal(
        h.status,
        (way.name === "createApp" ? health : entryHealth).status,
      );
      assert.equal((await way.fetch("/api/demo/other")).status, 404);
    }
  }
  // The files that the loader accepts are accepted by it as the real one is: the control.
  assert.equal(loadIntake(INTAKE_FILE).ok, true);
  assert.equal(
    (await goodWays[0].fetch("/api/demo/questionnaire")).status,
    200,
  );
});

test("DM-6c an intake text that is not exactly {ru, kk, en} gives 503 demo_unavailable on the route that reads it, an answer body that cannot be written to text is the same 503, and the next request is answered (SECURITY-REVIEWER L1, L2 of the second pass)", async (t) => {
  const dir = tempDir(t);
  const UNAVAILABLE = '{"error":"demo_unavailable"}';
  /** @param {(t: any) => void} edit */
  const edited = (edit) => {
    const tenant = structuredClone(RAW);
    edit(tenant);
    return tenant;
  };
  /** @param {string} name @param {any} tenant */
  const file = (name, tenant) => {
    const f = path.join(dir, name);
    fs.writeFileSync(f, JSON.stringify(tenant));
    return f;
  };
  const matched = FIXTURES.find(([n]) => n === "landing.json")?.[1] ?? {};
  const unmatched =
    FIXTURES.find(([n]) => n === "server-needed.json")?.[1] ?? {};
  assert.ok(resultOf(matched, "ru").recommended.length > 0);
  assert.equal(resultOf(unmatched, "ru").recommended.length, 0);
  /** The seven shapes of the review: the route that reads the text, and the answers that reach it. */
  /** @type {Array<[string, string, Record<string, string> | null, (t: any) => void]>} */
  const rows = [
    [
      "a question title with an extra key",
      "questionnaire",
      null,
      (x) => (x.questions[0].title.note = "note"),
    ],
    [
      "an option label without en",
      "questionnaire",
      null,
      (x) => {
        for (const o of x.questions[0].options) delete o.label.en;
      },
    ],
    [
      "a solution summary without en",
      "result",
      matched,
      (x) => {
        for (const sol of x.solutions) delete sol.summary.en;
      },
    ],
    [
      "an includes item without en",
      "result",
      matched,
      (x) => {
        for (const sol of x.solutions) delete sol.includes[0].en;
      },
    ],
    [
      "a not_suitable_when item with an extra key",
      "result",
      matched,
      (x) => {
        for (const sol of x.solutions) sol.not_suitable_when[0].x = "x";
      },
    ],
    [
      "a no-match text without en",
      "result",
      unmatched,
      (x) => delete x.result.no_match_text.en,
    ],
    [
      "a solution name with an extra key",
      "result",
      matched,
      (x) => {
        for (const sol of x.solutions) sol.name.x = "x";
      },
    ],
  ];
  const good = real();
  const goodWays = ways(good);
  const health = await goodWays[0].fetch("/api/health");
  for (const [i, [label, route, answers, edit]] of rows.entries()) {
    const loaded = loadIntake(file(`shape-${i}.json`, edited(edit)));
    assert.equal(loaded.ok, true, `${label}: the loader accepts the shape`);
    for (const way of ways(loaded))
      for (const lang of ["ru", "en", "kk"]) {
        const x =
          route === "questionnaire"
            ? await way.fetch(`/api/demo/questionnaire?lang=${lang}`)
            : await way.fetch(`/api/demo/result?lang=${lang}`, post(answers));
        assert.deepEqual(
          [x.status, x.text],
          [503, UNAVAILABLE],
          `${label} ${way.name} ${lang}`,
        );
        assert.equal(x.headers.get("content-type"), JSON_TYPE);
        assert.equal(x.headers.get("cache-control"), "no-store");
      }
    for (const way of ways(loaded)) {
      await way.fetch("/api/demo/questionnaire?lang=ru");
      for (const l of way.logs.filter((e) => e.status >= 500))
        assert.equal(l.code, "demo_unavailable", `${label} ${way.name}`);
      assert.equal((await way.fetch("/api/health")).status, health.status);
      assert.equal((await way.fetch("/api/demo/other")).status, 404);
    }
  }
  // A body that JSON.stringify cannot write: a value of the intake whose toJSON throws reaches the body as
  // it is (an id is copied whole), and the app writes the body after the handler returns.
  const unwritable = edited((x) => {
    x.questions[0].id = {
      toJSON() {
        throw new Error("cannot be written");
      },
    };
  });
  for (const way of ways({ ok: true, tenant: unwritable })) {
    const q = await way.fetch("/api/demo/questionnaire?lang=ru");
    assert.deepEqual([q.status, q.text], [503, UNAVAILABLE], way.name);
    assert.deepEqual(
      way.logs.filter((l) => l.status === 500),
      [],
      `${way.name}: a 500`,
    );
    assert.equal(way.logs.at(-1)?.code, "demo_unavailable", way.name);
    assert.equal((await way.fetch("/api/health")).status, health.status);
    assert.equal((await way.fetch("/api/demo/other")).status, 404);
  }
  // The control: the real intake is answered as before.
  assert.equal(
    (await goodWays[0].fetch("/api/demo/questionnaire?lang=ru")).status,
    200,
  );
  assert.equal(
    (await goodWays[1].fetch("/api/demo/result?lang=en", post(matched))).status,
    200,
  );
});

test("DM-7 SITE_GATE gives the gate answer with no cookie and no route runs; every request writes one log line with the keys of the skeleton and no answer in it", async () => {
  // The gate: the demo paths answer as every path does, and nothing of the demo runs.
  for (const way of [
    local(real(), { siteGate: true }),
    entry(real(), { siteGate: true }),
  ]) {
    const q = await way.fetch("/api/demo/questionnaire?lang=en");
    const r = await way.fetch(
      "/api/demo/result?lang=en",
      post({ goal: "tell" }),
    );
    const other = await way.fetch("/api/anything");
    for (const x of [q, r]) {
      assert.equal(x.status, 503, way.name);
      assert.equal(x.text, other.text, way.name);
      assert.equal(x.text, '{"error":"site_closed"}');
      assert.equal(x.headers.get("set-cookie"), null);
    }
    for (const l of way.logs) {
      assert.equal(l.route, "gate");
      assert.equal(l.status, 503);
    }
    assert.equal(way.logs.length, 3);
  }

  // The log line: one per request, only the keys of the skeleton, the code of a refusal and nothing that
  // the visitor sent. The markers are planted in a value of an answer, a key, a second key, the query, a
  // header and a cookie.
  const MARKERS = [
    "MARK-ANSWER-VALUE",
    "MARK-ANSWER-KEY",
    "MARK-QUERY",
    "MARK-HEADER",
    "MARK-BODY-TEXT",
    "MARK-LANG",
  ];
  for (const way of ways(real())) {
    /** @type {Array<[string, RequestInit, number, string | null]>} */
    const requests = [
      ["/api/demo/questionnaire?lang=ru", {}, 200, null],
      [
        `/api/demo/questionnaire?lang=${MARKERS[5]}&x=${MARKERS[2]}`,
        { headers: { "X-Marker": MARKERS[3], Cookie: `c=${MARKERS[3]}` } },
        200,
        null,
      ],
      ["/api/demo/result?lang=en", post({ goal: "tell" }), 200, null],
      [
        `/api/demo/result?lang=ru&q=${MARKERS[2]}`,
        post({ goal: MARKERS[0] }),
        400,
        "unknown_option",
      ],
      [
        "/api/demo/result",
        post({ [MARKERS[1]]: "tell" }),
        400,
        "unknown_question",
      ],
      [
        "/api/demo/result",
        { method: "POST", body: MARKERS[4] },
        400,
        "bad_json",
      ],
      [
        "/api/demo/result",
        {
          method: "POST",
          body: JSON.stringify({ answers: {}, [MARKERS[1]]: MARKERS[0] }),
        },
        400,
        "bad_body",
      ],
      [
        "/api/demo/result",
        post({ goal: ["tell", MARKERS[0]] }),
        400,
        "wrong_kind",
      ],
      ["/api/demo/result", { method: "GET" }, 404, null],
    ];
    for (const [p, init, status, code] of requests) {
      const before = way.logs.length;
      const r = await way.fetch(p, init);
      assert.equal(r.status, status, `${way.name} ${p}`);
      assert.equal(r.headers.get("set-cookie"), null, `${way.name} ${p}`);
      assert.equal(
        way.logs.length,
        before + 1,
        `${way.name} ${p}: one line per request`,
      );
      const line = way.logs[before];
      for (const k of Object.keys(line))
        assert.ok(LOG_KEYS.includes(k), `${way.name}: ${k}`);
      assert.equal(line.status, status);
      assert.equal(line.code, code ?? undefined);
      assert.equal(typeof line.req_id, "string");
      assert.ok(r.headers.get("x-request-id"));
      assert.equal(line.req_id, r.headers.get("x-request-id"));
    }
    const all = JSON.stringify(way.logs);
    for (const m of MARKERS)
      assert.ok(!all.includes(m), `${way.name}: ${m} is in a log line`);
    // The routes of the lines are the route paths (never the address with its query).
    assert.deepEqual(
      [...new Set(way.logs.map((l) => l.route))].sort(),
      ["/api/demo/questionnaire", "/api/demo/result", "api_404"].sort(),
    );
  }
});
