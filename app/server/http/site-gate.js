// SITE_GATE (decisions/0116 О6): any non-empty value closes the site; fail closed.

/**
 * @param {string | undefined} value
 * @returns {boolean}
 */
export function gateClosed(value) {
  return typeof value === "string" && value !== "";
}
