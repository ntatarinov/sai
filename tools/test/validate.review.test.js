import { test } from "node:test";
import { validateRun } from "../src/validate.js";
import { assertCode, review, validRun } from "./helpers.js";

const FILE = "verdict-review-1.json";

function check(mutate) {
  const { root, runDir } = validRun(mutate);
  return validateRun(root, runDir, { stage: "review" });
}

function checkReview(mutate) {
  return check((a) => mutate(a[FILE]));
}

test("E_REVIEW_CHECKS: a required check is missing", () => {
  assertCode(
    checkReview((r) => r.checks.pop()),
    "E_REVIEW_CHECKS",
  );
});

test("E_REVIEW_CHECKS: unknown check name", () => {
  assertCode(
    checkReview((r) => (r.checks[0].name = "vibes")),
    "E_REVIEW_CHECKS",
  );
});

test("E_REVIEW_CHECKS: result is not PASS or FAIL", () => {
  assertCode(
    checkReview((r) => (r.checks[0].result = "OK")),
    "E_REVIEW_CHECKS",
  );
});

test("E_REVIEW_CHECKS: empty detail", () => {
  assertCode(
    checkReview((r) => (r.checks[0].detail = "")),
    "E_REVIEW_CHECKS",
  );
});

test("E_REVIEW_DECISION: ACCEPT with a failed check", () => {
  assertCode(
    checkReview((r) => (r.checks[0].result = "FAIL")),
    "E_REVIEW_DECISION",
  );
});

test("E_REVIEW_DECISION: REJECT without issues", () => {
  assertCode(
    checkReview((r) => {
      r.decision = "REJECT";
      r.issues = [];
    }),
    "E_REVIEW_DECISION",
  );
});

test("E_VERSION: review version differs from the file number", () => {
  assertCode(
    checkReview((r) => (r.version = 2)),
    "E_VERSION",
  );
});

test("E_VERSION: review without its verdict", () => {
  assertCode(
    check((a) => (a["verdict-review-2.json"] = review(2))),
    "E_VERSION",
  );
});

test("E_JSON: review of the latest verdict missing", () => {
  assertCode(
    check((a) => (a[FILE] = undefined)),
    "E_JSON",
  );
});

test("E_PRODUCER: review written by the judge", () => {
  assertCode(
    checkReview((r) => (r.produced_by.instance = "judge")),
    "E_PRODUCER",
  );
});
