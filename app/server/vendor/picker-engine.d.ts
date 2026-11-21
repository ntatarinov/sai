// The declarations of server/vendor/picker-engine.js, the byte copy of tools/src/picker/engine.js
// (REQ-111 criterion 6; design docs/design/REQ-111-112-public-landing.md, 4.8). jsconfig.json leaves
// exactly the copy out of tsc, and tsc reads this file for an import of the copy (the sibling
// declaration). No file imports this file, so Node never loads it.
//
// The shapes are those of the engine's code. The tenant is the view of a checked tenant file in one
// language (its texts are strings); the engine does not check it again and never changes it. The
// answers are any value that came from JSON: an answer that is not right is an answer error, never an
// exception. The module exports exactly the four names of the copy (the `export {}` at the end keeps
// the types below from being exports too).

/** The reasons of an answer error, frozen, in this order. */
export declare const ANSWER_REASONS: readonly [
  "not_object",
  "unknown_question",
  "wrong_kind",
  "unknown_option",
  "duplicate_option",
  "empty_list",
  "not_integer",
  "out_of_range",
  "missing_required",
];

/** One reason of ANSWER_REASONS. */
type AnswerReason = (typeof ANSWER_REASONS)[number];

/** A condition on one earlier answer: any_of or none_of for a choice, a range for a number. */
type Condition =
  | { question: string; any_of: readonly string[] }
  | { question: string; none_of: readonly string[] }
  | { question: string; min?: number; max?: number };

type ChoiceQuestion = {
  id: string;
  type: "single" | "multiple";
  required: boolean;
  options: readonly { id: string }[];
  show_if?: readonly Condition[];
};

type NumberQuestion = {
  id: string;
  type: "number";
  required: boolean;
  min: number;
  max: number;
  show_if?: readonly Condition[];
};

type Solution = {
  id: string;
  name: string;
  summary: string;
  includes: readonly string[];
  needs_from_you: readonly string[];
  next_steps: readonly string[];
  price_text?: string;
  duration_text?: string;
  not_suitable_when: readonly string[];
};

type Rule = {
  id: string;
  solution: string;
  points: number;
  text: string;
  when: readonly Condition[];
};

type Hypothesis = {
  id: string;
  title: string;
  explanation: string;
  when: readonly Condition[];
};

/** The fields of the tenant that the engine reads. */
type Tenant = {
  questions: readonly (ChoiceQuestion | NumberQuestion)[];
  solutions: readonly Solution[];
  rules: readonly Rule[];
  result: {
    top: number;
    min_score: number;
    clear_lead_gap: number;
    no_match_text: string;
  };
  hypotheses?: readonly Hypothesis[];
};

/** The first wrong answer; `question` is null when the answers are not an object. */
type AnswerError = {
  code: "E_ANSWER";
  question: string | null;
  reason: AnswerReason;
};

/** A normalized answer: the chosen option ids in the order of the options, or the number. */
type Answer = string[] | number;

/** Why a rule gave its points: the question and what was chosen or answered. */
type Because =
  | { question: string; selected: string[] }
  | { question: string; value: number };

/** A recommended solution with its points and the rules whose conditions all hold. */
type RecommendedSolution = {
  id: string;
  name: string;
  summary: string;
  includes: string[];
  needs_from_you: string[];
  next_steps: string[];
  price_text?: string;
  duration_text?: string;
  not_suitable_when: string[];
  score: number;
  rules: {
    id: string;
    points: number;
    text: string;
    because: Because[];
  }[];
};

type EngineResult = {
  /** true for one best solution, for several whether the first leads by clear_lead_gap, null for none. */
  clear_leader: boolean | null;
  /** At most `top` solutions with at least `min_score` points, points down, then the place in the file. */
  recommended: RecommendedSolution[];
  /** The tenant's no_match_text when no solution is recommended, else null. */
  no_match_text: string | null;
  /** Every solution with its points, points down, then the place in the file. */
  ranking: { solution: string; score: number }[];
  /** The hypotheses whose conditions all hold, in the order of the file. */
  hypotheses: { id: string; title: string; explanation: string }[];
};

/** The ids of the visible questions in the order of the file; nothing is refused. */
export declare function visibleQuestions(
  tenant: Tenant,
  answers: unknown,
): string[];

/** The normalized answers to the visible answered questions, or the first answer error. */
export declare function resolveAnswers(
  tenant: Tenant,
  answers: unknown,
):
  | { ok: true; visible: string[]; answers: Record<string, Answer> }
  | { ok: false; error: AnswerError };

/** The whole result, or the first answer error. */
export declare function computeResult(
  tenant: Tenant,
  answers: unknown,
): { ok: true; result: EngineResult } | { ok: false; error: AnswerError };

export {};
