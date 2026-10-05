import { test } from "node:test";
import { validateRun } from "../src/validate.js";
import { ALPHA, Q, assertCode, ev, validRun } from "./helpers.js";

function check(mutate) {
  const { root, runDir } = validRun(mutate);
  return validateRun(root, runDir, { stage: "responses" });
}

test("E_RESPONSE_COVERAGE: a disagreement left unanswered", () => {
  assertCode(
    check((a) => (a["response-owner_fit.json"].responses = [])),
    "E_RESPONSE_COVERAGE",
  );
});

test("E_RESPONSE_COVERAGE: answer to a disagreement that was never raised", () => {
  assertCode(
    check((a) =>
      a["response-execution.json"].responses.push({
        raised_by: "market",
        idea_id: "02-beta",
        criterion: "cost_to_test",
        action: "hold",
        reason: "нет",
        evidence: [ev(ALPHA, Q.a1)],
      }),
    ),
    "E_RESPONSE_COVERAGE",
  );
});

test("E_RESPONSE_SHAPE: revise with the wrong 'from'", () => {
  assertCode(
    check((a) => (a["response-market.json"].responses[0].from = 5)),
    "E_RESPONSE_SHAPE",
  );
});

test("E_RESPONSE_SHAPE: hold without evidence", () => {
  assertCode(
    check((a) => (a["response-owner_fit.json"].responses[0].evidence = [])),
    "E_RESPONSE_SHAPE",
  );
});

test("E_RESPONSE_SHAPE: unknown action", () => {
  assertCode(
    check((a) => (a["response-owner_fit.json"].responses[0].action = "ignore")),
    "E_RESPONSE_SHAPE",
  );
});

test("E_RESPONSE_CONFLICT: two revisions of one score to different values", () => {
  assertCode(
    check((a) => {
      const item = a["crossreview-owner_fit.json"].items.find(
        (i) =>
          i.lens === "market" &&
          i.idea_id === "01-alpha" &&
          i.criterion === "demand_evidence",
      );
      Object.assign(item, {
        stance: "disagree",
        proposed_score: 2,
        evidence: [ev(ALPHA, Q.a3)],
      });
      a["response-market.json"].responses.push({
        raised_by: "owner_fit",
        idea_id: "01-alpha",
        criterion: "demand_evidence",
        action: "revise",
        from: 4,
        to: 2,
        reason: "ещё ниже",
      });
    }),
    "E_RESPONSE_CONFLICT",
  );
});
