import crypto from "node:crypto";

// The admin bootstrap (REQ-114 criterion 2; the code design M2AUTH, 4.9.6). `node scripts/setup-token.js`
// prints a one-time token and its sha256; only the hash goes into SETUP_TOKEN_HASH. The route compares the
// sha256 digest of the sent token with the configured one through the one compare below.

export const HASH_FORM = /^[0-9a-f]{64}$/;
export const TOKEN_FORM = /^[A-Za-z0-9_-]{43}$/;

/**
 * The one compare: false unless both are 32 bytes, then crypto.timingSafeEqual.
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {boolean}
 */
export function setupDigestsEqual(a, b) {
  if (a.length !== 32 || b.length !== 32) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Whether the sent token matches the configured hash; false for an unset or malformed hash or token.
 * @param {string | null} configuredHash SETUP_TOKEN_HASH as given
 * @param {string} token
 * @returns {boolean}
 */
export function setupTokenMatches(configuredHash, token) {
  if (configuredHash === null || !HASH_FORM.test(configuredHash)) return false;
  if (!TOKEN_FORM.test(token)) return false;
  return setupDigestsEqual(
    crypto.createHash("sha256").update(token, "utf8").digest(),
    Buffer.from(configuredHash, "hex"),
  );
}
