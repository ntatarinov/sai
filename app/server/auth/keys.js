import crypto from "node:crypto";

// The keys derived from SECRET_PEPPER (the code design M2AUTH, 4.9.1). Every secret the database keeps is an
// HMAC of this module (64 lower-case hex) or the TOTP secret encrypted with AES-256-GCM under a key derived
// from the pepper. A pepper change invalidates every session, token, code and TOTP secret.

/**
 * The closed labels of `mac`: session token, CSRF token hash, CSRF token, re-auth token, reset code, recovery
 * code, client address, rate-limit key, admin delay key, the login counter of an e-mail without an active
 * account (4.9.5) and the invite code (the code design M2PROJ, C4).
 */
export const MAC_LABELS = Object.freeze([
  "session",
  "csrfh",
  "csrf",
  "reauth",
  "reset",
  "recovery",
  "ip",
  "rl",
  "delay",
  "acct",
  "invite",
]);

const TOTP_INFO = "sai totp v1";
const SECRET_FORM =
  /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{1,200})\.([A-Za-z0-9_-]{22})$/;

/**
 * @typedef {object} Keys
 * @property {(label: string, text: string) => string} mac HMAC-SHA256(pepper, label + "\0" + text), hex
 * @property {(sessionToken: string) => string} csrfFor the CSRF token of a session token, base64url
 * @property {(secret: Buffer, userId: string) => string} sealTotp the stored form of a TOTP secret
 * @property {(stored: string, userId: string) => Buffer | null} openTotp the secret, or null
 */

/**
 * @param {Buffer} pepper
 * @returns {Keys}
 */
export function makeKeys(pepper) {
  const hmac = (/** @type {string} */ label, /** @type {string} */ text) => {
    if (!MAC_LABELS.includes(label))
      throw new TypeError("keys: an unknown label");
    return crypto
      .createHmac("sha256", pepper)
      .update(`${label}\u0000${text}`, "utf8");
  };
  const totpKey = Buffer.from(
    crypto.hkdfSync("sha256", pepper, Buffer.alloc(0), TOTP_INFO, 32),
  );
  return {
    mac: (label, text) => hmac(label, text).digest("hex"),
    csrfFor: (token) => hmac("csrf", token).digest("base64url"),
    sealTotp(secret, userId) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", totpKey, iv);
      cipher.setAAD(Buffer.from(userId, "utf8"));
      const ct = Buffer.concat([cipher.update(secret), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `v1.${iv.toString("base64url")}.${ct.toString("base64url")}.${tag.toString("base64url")}`;
    },
    openTotp(stored, userId) {
      const m = stored.match(SECRET_FORM);
      if (!m) return null;
      try {
        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          totpKey,
          Buffer.from(m[1], "base64url"),
        );
        decipher.setAAD(Buffer.from(userId, "utf8"));
        decipher.setAuthTag(Buffer.from(m[3], "base64url"));
        return Buffer.concat([
          decipher.update(Buffer.from(m[2], "base64url")),
          decipher.final(),
        ]);
      } catch {
        return null;
      }
    },
  };
}
