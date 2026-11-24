import crypto from "node:crypto";
import { COMMON_PASSWORDS } from "./common-passwords.js";

// Passwords (REQ-114 criterion 1; the code design M2AUTH, 4.9.2): scrypt N = 2^17, r = 8, p = 1 (the OWASP
// minimum, decisions/0137 Addition N2a), 16-byte random salt, 64-byte key, stored as
// `scrypt$17$8$1$<salt b64url>$<key b64url>`. Only the async scrypt (the libuv pool), never the sync one, so
// the event loop is not blocked. A password is normalised to NFC first; lengths count code points.

const N = 2 ** 17;
const R = 8;
const P = 1;
// One computation needs 128 MiB of work area plus overhead: 128 MiB is refused by Node (F11).
const MAXMEM = 160 * 1024 * 1024;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const FORM = /^scrypt\$17\$8\$1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/;

export const MIN_LENGTH = 10;
export const MAX_LENGTH = 128;

/**
 * A stored hash of the same form for an e-mail without an active account, so that every login runs exactly
 * one scrypt computation (decisions/0137 Addition B7a). It is the hash of a random text made once and thrown
 * away: no password verifies against it, and it is no secret.
 */
export const DUMMY_HASH =
  "scrypt$17$8$1$UrKxabP-pG77RldG4hTJTg$q8xFsnCDoTqrnsmwmeRqGeaZtoaPCLIJNiLbHlVlJ49jbzO3MSTiXiTNBqrm3_TUpWRPWQBJtkm15-s8gaZh7Q";

// The bundled common-password list, built once when the module loads (decisions/0137 Addition 2).
const COMMON = new Set(COMMON_PASSWORDS);

/**
 * @param {string} pw
 * @param {Buffer} salt
 * @returns {Promise<Buffer>}
 */
function derive(pw, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      Buffer.from(pw.normalize("NFC"), "utf8"),
      salt,
      KEY_BYTES,
      { N, r: R, p: P, maxmem: MAXMEM },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/**
 * @param {string} pw
 * @returns {Promise<string>}
 */
export async function hash(pw) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await derive(pw, salt);
  return `scrypt$17$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/**
 * Derives the full 64 bytes and compares all of them in constant time. A stored text of another form → false.
 * @param {string} pw
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export async function verify(pw, stored) {
  const m = typeof stored === "string" ? stored.match(FORM) : null;
  if (!m) return false;
  const salt = Buffer.from(m[1], "base64url");
  const want = Buffer.from(m[2], "base64url");
  if (salt.length !== SALT_BYTES || want.length !== KEY_BYTES) return false;
  const got = await derive(pw, salt);
  return crypto.timingSafeEqual(got, want);
}

/**
 * The rule of every new or changed password (setup, password change, reset): 10 to 128 code points, and not
 * in the common-password list after NFC and lower case.
 * @param {string} pw
 * @returns {"ok" | "password_rules"}
 */
export function rules(pw) {
  const length = [...pw].length;
  if (length < MIN_LENGTH || length > MAX_LENGTH) return "password_rules";
  if (COMMON.has(pw.normalize("NFC").toLowerCase())) return "password_rules";
  return "ok";
}

/** @typedef {{ hash: (pw: string) => Promise<string>, verify: (pw: string, stored: string) => Promise<boolean> }} Hasher */

/** The hasher the app is given by default; a test injects a counting one (deps.auth.passwords). */
export const passwords = Object.freeze({ hash, verify });
