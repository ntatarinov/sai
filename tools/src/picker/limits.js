// The named limits of the tenant file check (design REQ-054, 5.1). Nothing here
// reads the disk, the clock or the environment.

// The one place where the core depends on a file of public/ (design REQ-061, 5.1).
export { DEFAULT_LANGUAGE, LANGUAGES } from "./public/texts.js";

// The closed catalogues and the colour rule of the look of a tenant (design REQ-069, D2):
// they live in one file shared with the page, and the core reads them here.
export {
  FIGURES,
  GLYPHS,
  MIN_CONTRAST,
  OBJECT_IDS,
  OBJECT_RULES,
  SHEET,
  SHIRTS,
  TEAM_SIZE,
  contrastRatio,
  fallbackLook,
  isColor,
  isMarkSign,
} from "./public/tenant-look.js";

export const FORMAT_V1 = "sai-picker-tenant/1";
export const FORMAT_V2 = "sai-picker-tenant/2";
export const FORMAT_V3 = "sai-picker-tenant/3";
export const MAX_FILE_BYTES = 524288;
export const MAX_DEPTH = 20;
export const MAX_LINES = 100;
export const MAX_WORDS = 18;
export const SHOWN_CHARS = 40;

// The id of a tenant (design REQ-054, 5.3): also the name of its file and its part of the
// address of the site. The check of the file and the server both read this one rule.
export const TENANT_ID = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

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
// The ways of contact in a file of the form /3 (design REQ-069, 5.7).
export const CONTACT_FIELDS_V3 = Object.freeze(["phone", "telegram", "email"]);
