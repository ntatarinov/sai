import crypto from "node:crypto";

// The CSRF rule of the routes that use the session cookie (REQ-114 criterion 4; the code design M2AUTH, 4.7
// steps 3-5): a non-GET request needs Origin equal to APP_ORIGIN and the media type application/json; a
// signed-in caller also sends x-sai-csrf equal to the session's CSRF token (derived from the session token,
// C5), compared in constant time.

/**
 * @param {Headers} headers
 * @param {string} appOrigin
 * @returns {boolean}
 */
export function originAllowed(headers, appOrigin) {
  const origin = headers.get("origin");
  return origin !== null && appOrigin !== "" && origin === appOrigin;
}

/**
 * The media type application/json (any case) with at most one parameter, charset=utf-8.
 * @param {Headers} headers
 * @returns {boolean}
 */
export function isJsonType(headers) {
  const value = headers.get("content-type");
  if (value === null) return false;
  const parts = value.split(";").map((p) => p.trim().toLowerCase());
  if (parts[0] !== "application/json") return false;
  if (parts.length === 1) return true;
  if (parts.length !== 2) return false;
  const param = parts[1].replace(/\s*=\s*/, "=");
  return param === "charset=utf-8" || param === 'charset="utf-8"';
}

/**
 * @param {string | null} sent the x-sai-csrf header
 * @param {string} expected the session's CSRF token
 * @returns {boolean}
 */
export function csrfEqual(sent, expected) {
  if (sent === null) return false;
  const a = Buffer.from(sent, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
