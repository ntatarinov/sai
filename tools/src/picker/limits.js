// The named limits of the tenant file check (design REQ-054, 5.1). Nothing here
// reads the disk, the clock or the environment.

// The one place where the core depends on a file of public/ (design REQ-061, 5.1).
export { DEFAULT_LANGUAGE, LANGUAGES } from "./public/texts.js";

export const FORMAT_V1 = "sai-picker-tenant/1";
export const FORMAT_V2 = "sai-picker-tenant/2";
export const MAX_FILE_BYTES = 524288;
export const MAX_DEPTH = 20;
export const MAX_LINES = 100;
export const MAX_WORDS = 18;
export const SHOWN_CHARS = 40;

// Exactly ten codes, in this order.
export const ERROR_CODES = Object.freeze([
  "E_JSON",
  "E_FIELD",
  "E_ID",
  "E_DUP",
  "E_LIMIT",
  "E_REF",
  "E_ORDER",
  "E_COND",
  "E_UNREACHABLE",
  "E_TEXT",
]);

// Words of the second person singular; a text addressed that way breaks the rule E_TEXT.
export const SECOND_PERSON_WORDS = Object.freeze([
  "ты",
  "тебя",
  "тебе",
  "тобой",
  "твой",
  "твоя",
  "твоё",
  "твои",
]);

export const QUESTION_TYPES = Object.freeze(["single", "multiple", "number"]);
export const CONTACT_FIELDS = Object.freeze(["phone", "email"]);
