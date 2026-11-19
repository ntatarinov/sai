// Stable error codes of the JSON API (ARCH §13): the body is always {"error": "<code>"}.

/** @typedef {"not_found" | "bad_request" | "body_too_large" | "bad_encoding" | "site_closed" | "server_error" | "server_config"} ErrorCode */

/** @type {Readonly<Record<ErrorCode, number>>} */
export const ERROR_STATUS = Object.freeze({
  not_found: 404,
  bad_request: 400,
  body_too_large: 413,
  bad_encoding: 400,
  site_closed: 503,
  server_error: 500,
  server_config: 503,
});

export class HttpError extends Error {
  /** @param {ErrorCode} code */
  constructor(code) {
    super(code);
    this.code = code;
    this.status = ERROR_STATUS[code];
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
