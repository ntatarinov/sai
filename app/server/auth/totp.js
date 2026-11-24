import crypto from "node:crypto";

// TOTP of the platform admin (REQ-114 criterion 7, G20; the code design M2AUTH, 4.9.7): RFC 4226 HOTP with
// HMAC-SHA1 and dynamic truncation, RFC 6238 steps of 30 s, 6 digits, the steps t-1, t and t+1 accepted when
// they are newer than the last used one. Base32 of RFC 4648 without padding. Pure: no clock, no database.

export const STEP_SECONDS = 30;
export const DIGITS = 6;
export const SECRET_BYTES = 20;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * @param {Buffer} key
 * @param {number} counter a non-negative integer
 * @param {number} digits
 * @returns {string}
 */
export function hotp(key, counter, digits) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/**
 * @param {number} unixSeconds
 * @returns {number}
 */
export const stepAt = (unixSeconds) => Math.floor(unixSeconds / STEP_SECONDS);

/**
 * @param {Buffer} key
 * @param {number} unixSeconds
 * @param {number} [digits]
 * @returns {string}
 */
export function totpAt(key, unixSeconds, digits = DIGITS) {
  return hotp(key, stepAt(unixSeconds), digits);
}

/**
 * The step of a valid 6-digit code among t-1, t and t+1 that is newer than `lastStep`, or null. The step is
 * claimed by the caller with one conditional update (a replay finds it taken).
 * @param {Buffer} key
 * @param {string} code
 * @param {number} unixSeconds
 * @param {number | null} lastStep
 * @returns {number | null}
 */
export function verifyCode(key, code, unixSeconds, lastStep) {
  if (!/^[0-9]{6}$/.test(code)) return null;
  const now = stepAt(unixSeconds);
  for (const step of [now - 1, now, now + 1]) {
    if (step < 0 || (lastStep !== null && step <= lastStep)) continue;
    const want = Buffer.from(hotp(key, step, DIGITS));
    if (crypto.timingSafeEqual(want, Buffer.from(code))) return step;
  }
  return null;
}

/**
 * @param {Buffer} bytes
 * @returns {string}
 */
export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/**
 * @param {string} text upper-case base32 without padding
 * @returns {Buffer | null}
 */
export function base32Decode(text) {
  if (!/^[A-Z2-7]*$/.test(text)) return null;
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of text) {
    value = ((value << 5) | ALPHABET.indexOf(ch)) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
