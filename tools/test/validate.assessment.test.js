import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { stableJson } from "../src/util.js";
import { validateRun } from "../src/validate.js";
import { ALPHA, Q, assertCode, ev, runDirOf, validRun } from "./helpers.js";

const FILE = "assessment-market.json";

function check(mutate) {
  const { root, runDir } = validRun((arts) => mutate(arts[FILE]));
  return validateRun(root, runDir, { stage: "assessments" });
}

function firstScore(doc) {
  return doc.ideas[0].scores.demand_evidence;
}

test("E_LENS: lens field differs from file name", () => {
  assertCode(
    check((d) => (d.lens = "execution")),
    "E_LENS",
  );
});

test("E_LENS: file for an unknown lens", () => {
  const { root, runDir } = validRun();
  fs.writeFileSync(
    path.join(runDirOf(root), "assessment-price.json"),
    stableJson({}),
  );
  assertCode(validateRun(root, runDir, { stage: "assessments" }), "E_LENS");
});

test("E_PRODUCER: wrong instance", () => {
  assertCode(
    check((d) => (d.produced_by.instance = "judge")),
    "E_PRODUCER",
  );
});

test("E_COVERAGE: candidate not assessed", () => {
  assertCode(
    check((d) => d.ideas.pop()),
    "E_COVERAGE",
  );
});

test("E_COVERAGE: criterion of another lens", () => {
  assertCode(
    check((d) => (d.ideas[0].scores.cost_to_test = firstScore(d))),
    "E_COVERAGE",
  );
});

test("E_DUPLICATE: idea assessed twice", () => {
  assertCode(
    check((d) => d.ideas.push(structuredClone(d.ideas[0]))),
    "E_DUPLICATE",
  );
});

test("E_SCORE_RANGE: score outside 1-5", () => {
  assertCode(
    check((d) => (firstScore(d).score = 6)),
    "E_SCORE_RANGE",
  );
});

test("E_SHAPE: empty comment", () => {
  assertCode(
    check((d) => (firstScore(d).comment = " ")),
    "E_SHAPE",
  );
});

test("E_EVIDENCE_MISSING: no evidence", () => {
  assertCode(
    check((d) => (firstScore(d).evidence = [])),
    "E_EVIDENCE_MISSING",
  );
});

test("E_EVIDENCE_SOURCE: source not in run.sources", () => {
  assertCode(
    check(
      (d) =>
        (firstScore(d).evidence = [
          ev("ideas/README.md", "Файл Статус Выбрана"),
        ]),
    ),
    "E_EVIDENCE_SOURCE",
  );
});

test("E_QUOTE_SHORT: quote under 12 characters", () => {
  assertCode(
    check((d) => (firstScore(d).evidence = [ev(ALPHA, "Альфа")])),
    "E_QUOTE_SHORT",
  );
});

test("E_QUOTE_NOT_FOUND: quote absent from the source", () => {
  assertCode(
    check(
      (d) =>
        (firstScore(d).evidence = [ev(ALPHA, "Этой фразы в источнике нет")]),
    ),
    "E_QUOTE_NOT_FOUND",
  );
});

test("E_QUOTE_NOT_FOUND: a conclusion removed by cleaning cannot be quoted", () => {
  assertCode(
    check((d) => (firstScore(d).evidence = [ev(ALPHA, Q.conclusion)])),
    "E_QUOTE_NOT_FOUND",
  );
});

test("quotes match across different whitespace", () => {
  const result = check(
    (d) => (firstScore(d).evidence = [ev(ALPHA, Q.a2.replace(/ /g, "\n  "))]),
  );
  assert.deepEqual(result.issues.list, []);
});
