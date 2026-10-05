import { test } from "node:test";
import { validateRun } from "../src/validate.js";
import { assertCode, validRun } from "./helpers.js";

const FILE = "crossreview-market.json";

function check(mutate) {
  const { root, runDir } = validRun((arts) => mutate(arts[FILE]));
  return validateRun(root, runDir, { stage: "crossreviews" });
}

function disagreement(doc) {
  return doc.items.find((i) => i.stance === "disagree");
}

test("E_REVIEW_COVERAGE: a score of another lens left unreviewed", () => {
  assertCode(
    check((d) => d.items.shift()),
    "E_REVIEW_COVERAGE",
  );
});

test("E_REVIEW_COVERAGE: own lens reviewed", () => {
  assertCode(
    check((d) =>
      d.items.push({
        lens: "market",
        idea_id: "01-alpha",
        criterion: "demand_evidence",
        their_score: 4,
        stance: "agree",
        note: "своё",
      }),
    ),
    "E_REVIEW_COVERAGE",
  );
});

test("E_REVIEW_COVERAGE: the same score reviewed twice", () => {
  assertCode(
    check((d) => d.items.push(structuredClone(d.items[0]))),
    "E_REVIEW_COVERAGE",
  );
});

test("E_THEIR_SCORE: their_score differs from round 1", () => {
  assertCode(
    check((d) => (d.items[0].their_score += 1)),
    "E_THEIR_SCORE",
  );
});

test("E_DISAGREE_SHAPE: proposed_score equals their score", () => {
  assertCode(
    check(
      (d) => (disagreement(d).proposed_score = disagreement(d).their_score),
    ),
    "E_DISAGREE_SHAPE",
  );
});

test("E_DISAGREE_SHAPE: disagreement without evidence", () => {
  assertCode(
    check((d) => (disagreement(d).evidence = [])),
    "E_DISAGREE_SHAPE",
  );
});

test("E_SHAPE: unknown stance", () => {
  assertCode(
    check((d) => (d.items[0].stance = "maybe")),
    "E_SHAPE",
  );
});
