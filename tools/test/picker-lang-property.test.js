// LP-5a ... LP-5f and LP-R1: the result does not depend on the language (design REQ-061,
// 13.1 and 13.2). 2 tenants x 1000 sets of answers (seed 61001) are counted on the copy of
// the form /1 and on the view of the form /2 in ru, kk and en; points, order and ids must
// be the same, and every text of a result must be a string of the file in that language.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkBytes, checkFile } from "../src/picker/check.js";
import { computeResult, visibleQuestions } from "../src/picker/engine.js";
import { tenantInLanguage } from "../src/picker/view.js";
import {
  deepCopy,
  deepFreeze,
  demoTenant,
  sets,
} from "./picker-engine-helpers.js";
import {
  LANG_FIXTURES,
  PLACE_KINDS,
  LANGS,
  placeText,
  readJson,
  setAt,
  textPlaces,
} from "./picker-lang-helpers.js";
import { DEMO_TENANTS, makeRng } from "./picker-helpers.js";
import path from "node:path";

const IDS = ["uchet-pro", "svet-marketing"];
const SEED = 61001;
const demoPath = (id) => path.join(DEMO_TENANTS, `${id}.json`);

// Per tenant: the copy /1 (as the check gives it), the file /2 (as the check gives it and
// as JSON.parse gives it) and the sets of answers made for the copy.
const CASES = IDS.map((id) => {
  const legacy = demoTenant(id);
  return {
    id,
    legacy,
    v2: checkFile(demoPath(id)).tenant,
    v2plain: readJson(demoPath(id)),
    list: sets(legacy, SEED, 1000),
  };
});

const strip = (result) => ({
  ranking: result.ranking.map((e) => [e.solution, e.score]),
  recommended: result.recommended.map((x) => [x.id, x.score]),
  mark: result.clear_leader,
  rules: result.recommended.map((x) =>
    x.rules.map((r) => [r.id, r.points, JSON.stringify(r.because)]),
  ),
  hypotheses: result.hypotheses.map((h) => h.id),
  none: result.no_match_text === null,
});

test("LP-5a: for 1000 sets per tenant the result in ru, kk and en has the same visible questions, ranking, scores, order, mark, fired rules with their points and because, and hypotheses as the result on the copy of the form /1", () => {
  for (const { id, legacy, v2, v2plain, list } of CASES) {
    assert.equal(list.length, 1000);
    for (const language of LANGS) {
      for (const file of [v2, v2plain]) {
        const view = tenantInLanguage(file, language);
        for (const answers of list) {
          const label = `${id} ${language} ${JSON.stringify(answers)}`;
          const want = computeResult(legacy, answers);
          const got = computeResult(view, answers);
          assert.equal(want.ok, true, label);
          assert.equal(got.ok, true, label);
          assert.deepEqual(
            visibleQuestions(view, answers),
            visibleQuestions(legacy, answers),
            label,
          );
          assert.deepEqual(strip(got.result), strip(want.result), label);
        }
      }
    }
  }
});

test("LP-5b: every text of a result in the language L is the string of the file /2 in L, found by id - names, summaries, the four lists, price, duration, texts of rules, titles and explanations of hypotheses, the text for no match", () => {
  for (const { id, v2plain, v2, list } of CASES) {
    for (const language of LANGS) {
      const view = tenantInLanguage(v2, language);
      for (const answers of list) {
        const label = `${id} ${language} ${JSON.stringify(answers)}`;
        const r = computeResult(view, answers).result;
        for (const item of r.recommended) {
          const s = v2plain.solutions.find((x) => x.id === item.id);
          assert.equal(item.name, s.name[language], label);
          assert.equal(item.summary, s.summary[language], label);
          for (const key of [
            "includes",
            "needs_from_you",
            "next_steps",
            "not_suitable_when",
          ])
            assert.deepEqual(
              item[key],
              s[key].map((x) => x[language]),
              `${label} ${key}`,
            );
          for (const key of ["price_text", "duration_text"]) {
            assert.equal(
              Object.hasOwn(item, key),
              Object.hasOwn(s, key),
              `${label} ${key}`,
            );
            if (Object.hasOwn(s, key))
              assert.equal(item[key], s[key][language], `${label} ${key}`);
          }
          for (const entry of item.rules) {
            const rule = v2plain.rules.find((x) => x.id === entry.id);
            assert.equal(entry.text, rule.text[language], label);
          }
        }
        for (const h of r.hypotheses) {
          const source = v2plain.hypotheses.find((x) => x.id === h.id);
          assert.equal(h.title, source.title[language], label);
          assert.equal(h.explanation, source.explanation[language], label);
        }
        if (r.recommended.length === 0)
          assert.equal(
            r.no_match_text,
            v2plain.result.no_match_text[language],
            label,
          );
        else assert.equal(r.no_match_text, null, label);
      }
    }
  }
});

test("LP-5c: the result in ru is the same bytes (JSON) as the result of the engine on the copy of the form /1", () => {
  for (const { id, legacy, v2, v2plain, list } of CASES) {
    for (const file of [v2, v2plain]) {
      const view = tenantInLanguage(file, "ru");
      for (const answers of list) {
        assert.equal(
          JSON.stringify(computeResult(view, answers)),
          JSON.stringify(computeResult(legacy, answers)),
          `${id} ${JSON.stringify(answers)}`,
        );
      }
    }
  }
});

test("LP-5d: a language asked for a /1 file gives the result in ru, the same bytes, and the view is the file itself", () => {
  for (const { id, legacy, list } of CASES) {
    for (const language of ["kk", "en", "de", undefined]) {
      const view = tenantInLanguage(legacy, language);
      assert.equal(view, legacy, `${id} ${language}`);
      for (const answers of list.slice(0, 200)) {
        assert.equal(
          JSON.stringify(computeResult(view, answers)),
          JSON.stringify(computeResult(legacy, answers)),
        );
      }
    }
  }
});

test("LP-5e: in every language the points of the explanation of a recommended solution add up to its score", () => {
  for (const { id, v2, list } of CASES) {
    for (const language of LANGS) {
      const view = tenantInLanguage(v2, language);
      for (const answers of list) {
        for (const item of computeResult(view, answers).result.recommended) {
          assert.equal(
            item.rules.reduce((sum, r) => sum + r.points, 0),
            item.score,
            `${id} ${language} ${item.id}`,
          );
        }
      }
    }
  }
});

// Every array of the file (the empty ones too) and the array at the same place of the
// view are two objects; the walk goes through objects and lists, and stops where the view
// holds a string in place of a text.
function countArrays(value) {
  if (Array.isArray(value))
    return 1 + value.reduce((n, v) => n + countArrays(v), 0);
  if (value !== null && typeof value === "object")
    return Object.values(value).reduce((n, v) => n + countArrays(v), 0);
  return 0;
}
function assertNoSharing(view, file, where) {
  if (Array.isArray(file)) {
    assert.ok(Array.isArray(view), where);
    assert.notEqual(view, file, `an array is shared at ${where}`);
    assert.equal(view.length, file.length, where);
    file.forEach((item, i) => assertNoSharing(view[i], item, `${where}[${i}]`));
  } else if (file !== null && typeof file === "object") {
    if (typeof view !== "object") return;
    assert.notEqual(view, file, `an object is shared at ${where}`);
    for (const key of Object.keys(file))
      assertNoSharing(view[key], file[key], `${where}.${key}`);
  }
}

test("LP-5f: the view of a deeply frozen /2 file is built without a throw, the file is not changed, two views are equal, and the view is a new object that shares no array or object with the file", () => {
  for (const { id, list } of CASES) {
    const frozen = deepFreeze(readJson(demoPath(id)));
    const before = JSON.stringify(frozen);
    for (const language of LANGS) {
      const a = tenantInLanguage(frozen, language);
      const b = tenantInLanguage(frozen, language);
      assert.equal(JSON.stringify(a), JSON.stringify(b), `${id} ${language}`);
      assert.equal(JSON.stringify(frozen), before);
      assert.notEqual(a, b);
      assert.notEqual(a.questions, frozen.questions);
      assert.notEqual(a.solutions[0].includes, frozen.solutions[0].includes);
      assert.ok(countArrays(frozen) > 100, "the walk found the arrays");
      assertNoSharing(a, frozen, id);
      assert.equal(Object.isFrozen(a), false);
      // the engine reads the view of a frozen file
      assert.equal(computeResult(a, list[0]).ok, true);
    }
  }
});

test("LP-5g: the view of the small file with empty lists shares no list with the file, the empty ones too", () => {
  const file = deepFreeze(
    readJson(path.join(LANG_FIXTURES, "ok-lang-minimal.json")),
  );
  assert.equal(file.solutions[0].needs_from_you.length, 0);
  assert.equal(file.solutions[0].not_suitable_when.length, 0);
  for (const language of LANGS) {
    const view = tenantInLanguage(file, language);
    assertNoSharing(view, file, language);
    assert.notEqual(
      view.solutions[0].needs_from_you,
      file.solutions[0].needs_from_you,
    );
    assert.notEqual(
      view.solutions[0].not_suitable_when,
      file.solutions[0].not_suitable_when,
    );
    assert.deepEqual(view.solutions[0].needs_from_you, []);
  }
});

const ALPHABET = [
  "а",
  "б",
  "в",
  "ә",
  "қ",
  "і",
  "a",
  "b",
  "z",
  "я",
  "х",
  " ",
  "-",
];
function randomText(rng, max, language) {
  const length = 1 + rng.int(Math.min(max, 60));
  let text = "";
  for (let i = 0; i < length; i++) text += rng.pick(ALPHABET);
  text = text.trim();
  if (text === "") text = "а";
  // no address in ru; at most 18 words
  if (language === "ru") text = text.replace(/ты|тебе|тебя/gu, "я");
  return text.split(/\s+/u).slice(0, 18).join(" ");
}

test("LP-R1: 500 /2 files with texts changed to other right texts are accepted by the check, the view in a random language is read by the engine without a throw, and the points do not move", () => {
  const rng = makeRng(61040);
  const answerSets = Object.fromEntries(
    CASES.map((c) => [c.id, sets(c.legacy, 61041, 500)]),
  );
  for (let i = 0; i < 500; i++) {
    const c = CASES[i % 2];
    const doc = deepCopy(c.v2plain);
    const places = textPlaces(doc);
    for (let k = 0; k < 1 + rng.int(6); k++) {
      const p = rng.pick(places);
      const language = rng.pick(LANGS);
      setAt(doc, [...p.path, language], randomText(rng, p.max, language));
    }
    const out = checkBytes(
      Buffer.from(JSON.stringify(doc), "utf8"),
      `${c.id}.json`,
    );
    assert.equal(out.exitCode, 0, `${i}: ${out.stdout.join(" | ")}`);
    const language = rng.pick(LANGS);
    const view = tenantInLanguage(out.tenant, language);
    const answers = answerSets[c.id][i];
    const got = computeResult(view, answers);
    assert.equal(got.ok, true, `${i}`);
    assert.deepEqual(
      strip(got.result),
      strip(computeResult(c.legacy, answers).result),
      `${i}`,
    );
    for (const p of textPlaces(view))
      assert.equal(typeof p.value, "string", placeText(p.path));
  }
  assert.equal(PLACE_KINDS.length, 19);
});
