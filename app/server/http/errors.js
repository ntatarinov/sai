// Stable error codes of the JSON API (ARCH §13): the body is always {"error": "<code>"}.

/** @typedef {"not_found" | "bad_request" | "body_too_large" | "bad_encoding" | "site_closed" | "server_error" | "server_config" | "bad_json" | "bad_body" | "bad_answers" | "unknown_question" | "unknown_option" | "wrong_kind" | "demo_unavailable" | "auth_required" | "invalid_credentials" | "totp_required" | "totp_invalid" | "origin_refused" | "csrf_refused" | "reauth_required" | "unsupported_type" | "password_rules" | "unknown_purpose" | "reset_invalid" | "totp_state" | "locked" | "reauth_locked" | "rate_limited" | "db_unavailable"} ErrorCode */

/** @type {Readonly<Record<ErrorCode, number>>} */
export const ERROR_STATUS = Object.freeze({
  not_found: 404,
  bad_request: 400,
  body_too_large: 413,
  bad_encoding: 400,
  site_closed: 503,
  server_error: 500,
  server_config: 503,
  // The demo routes (the code design of the public landing, 4.7): a result body that is not JSON, not an
  // object with exactly the key answers, or answers that are not an object; the three refusals of the
  // engine that a page can cause; and an intake that is missing or broken, or an engine that throws.
  bad_json: 400,
  bad_body: 400,
  bad_answers: 400,
  unknown_question: 400,
  unknown_option: 400,
  wrong_kind: 400,
  demo_unavailable: 503,
  // Accounts (the code design M2AUTH, 4.8): the request pipeline and the auth and admin routes.
  auth_required: 401,
  invalid_credentials: 401,
  totp_required: 401,
  totp_invalid: 401,
  origin_refused: 403,
  csrf_refused: 403,
  reauth_required: 403,
  unsupported_type: 415,
  password_rules: 400,
  unknown_purpose: 400,
  reset_invalid: 400,
  totp_state: 409,
  locked: 429,
  reauth_locked: 429,
  rate_limited: 429,
  db_unavailable: 503,
});

/**
 * Every code that the auth and admin routes (rows 4-15 of the route table) can answer, including the codes
 * the app answers before any route (the body limit, the site gate); the pages map each to
 * `auth_err_<code>` (the code design M2AUTH, 4.8).
 * @type {ReadonlyArray<ErrorCode>}
 */
export const AUTH_CODES = Object.freeze([
  "not_found",
  "body_too_large",
  "site_closed",
  "bad_json",
  "bad_body",
  "server_error",
  "server_config",
  "auth_required",
  "invalid_credentials",
  "totp_required",
  "totp_invalid",
  "origin_refused",
  "csrf_refused",
  "reauth_required",
  "unsupported_type",
  "password_rules",
  "unknown_purpose",
  "reset_invalid",
  "totp_state",
  "locked",
  "reauth_locked",
  "rate_limited",
  "db_unavailable",
]);

export class HttpError extends Error {
  /**
   * @param {ErrorCode} code
   * @param {{ retryAfter?: number }} [extra] the seconds of a Retry-After header (a 429 answer)
   */
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    this.status = ERROR_STATUS[code];
    /** @type {number | undefined} */
    this.retryAfter = extra.retryAfter;
  }
}

/**
 * @param {ErrorCode} code
 * @returns {string}
 */
export function errorBody(code) {
  return JSON.stringify({ error: code });
}

/** The uniform 404 of every unknown /api address (REQ-108, criterion 5). */
export const UNIFORM_404 = errorBody("not_found");
