import { test } from "node:test";
import { validateRun } from "../src/validate.js";
import { assertCode, review, validRun, verdict } from "./helpers.js";

const FILE = "verdict-1.json";

function check(mutate) {
  const { root, runDir } = validRun(mutate);
  return validateRun(root, runDir, { stage: "verdict" });
}

function checkVerdict(mutate) {
  return check((a) => mutate(a[FILE]));
}

test("E_VERSION: version field differs from the file number", () => {
  assertCode(
    checkVerdict((v) => (v.version = 2)),
    "E_VERSION",
  );
});

test("E_VERSION: verdict-2 while verdict-review-1 is ACCEPT", () => {
  assertCode(
    check((a) => {
      a["verdict-2.json"] = verdict(2);
      a["verdict-2.md"] = a["verdict-1.md"];
    }),
    "E_VERSION",
  );
});

test("E_REVIEW_LIMIT: a fourth version", () => {
  assertCode(
    check((a) => (a["verdict-4.json"] = verdict(4))),
    "E_REVIEW_LIMIT",
  );
});

test("E_RANKING_COVERAGE: candidate missing from the ranking", () => {
  assertCode(
    checkVerdict((v) => v.ranking.pop()),
    "E_RANKING_COVERAGE",
  );
});

test("E_RANK_SEQUENCE: ranks with a gap", () => {
  assertCode(
    checkVerdict((v) => (v.ranking[1].rank = 3)),
    "E_RANK_SEQUENCE",
  );
});

test("E_TOTAL_MISMATCH: total ignores the round-3 revision", () => {
  assertCode(
    checkVerdict((v) => (v.ranking[1].total = 19)),
    "E_TOTAL_MISMATCH",
  );
});

test("E_RANK_ORDER: lower total ranked first", () => {
  assertCode(
    checkVerdict((v) => {
      v.ranking = [
        { idea_id: "01-alpha", rank: 1, total: 18, rationale: "a" },
        { idea_id: "02-beta", rank: 2, total: 25, rationale: "b" },
      ];
      v.chosen = "01-alpha";
      v.reasons.forEach((r) => (r.refs[0].idea_id = "01-alpha"));
    }),
    "E_RANK_ORDER",
  );
});

test("E_CHOSEN_NOT_FIRST: chosen is not rank 1", () => {
  assertCode(
    checkVerdict((v) => (v.chosen = "01-alpha")),
    "E_CHOSEN_NOT_FIRST",
  );
});

test("E_REASONS: fewer than two reasons", () => {
  assertCode(
    checkVerdict((v) => v.reasons.pop()),
    "E_REASONS",
  );
});

test("E_REASONS: ref to a non-existent score", () => {
  assertCode(
    checkVerdict((v) => (v.reasons[0].refs[0].criterion = "owner_goals")),
    "E_REASONS",
  );
});

test("E_REASONS: reasons do not refer to the chosen idea", () => {
  assertCode(
    checkVerdict((v) =>
      v.reasons.forEach((r) => (r.refs[0].idea_id = "01-alpha")),
    ),
    "E_REASONS",
  );
});

test("E_DISSENT_MISSING: held disagreement absent from dissent", () => {
  assertCode(
    checkVerdict((v) => (v.dissent = [])),
    "E_DISSENT_MISSING",
  );
});

test("E_OWNER_DECISION: owner_decision_required is not true", () => {
  assertCode(
    checkVerdict((v) => (v.owner_decision_required = false)),
    "E_OWNER_DECISION",
  );
});

test("E_NEXT_ACTION_AGENT: task for a product developer", () => {
  assertCode(
    checkVerdict((v) => (v.next_actions[0].to_agent = "BACKEND-DEV")),
    "E_NEXT_ACTION_AGENT",
  );
});

test("E_SHAPE: unknown confidence", () => {
  assertCode(
    checkVerdict((v) => (v.confidence = "certain")),
    "E_SHAPE",
  );
});

test("E_VERDICT_MD: no '## Ограничения' section", () => {
  assertCode(
    check((a) => (a["verdict-1.md"] = "# Вердикт\n\n02-beta\n")),
    "E_VERDICT_MD",
  );
});

test("E_VERDICT_MD: markdown file missing", () => {
  assertCode(
    check((a) => (a["verdict-1.md"] = undefined)),
    "E_VERDICT_MD",
  );
});

test("E_PRODUCER: verdict written by an analyst label", () => {
  assertCode(
    checkVerdict((v) => (v.produced_by.instance = "a-m")),
    "E_PRODUCER",
  );
});

test("a second version after a REJECT review is accepted", () => {
  const { root, runDir } = validRun((a) => {
    a["verdict-review-1.json"] = review(1, "REJECT");
    a["verdict-2.json"] = verdict(2);
    a["verdict-2.md"] = a["verdict-1.md"];
  });
  const result = validateRun(root, runDir, { stage: "verdict" });
  if (!result.issues.empty) throw new Error(JSON.stringify(result.issues.list));
});
