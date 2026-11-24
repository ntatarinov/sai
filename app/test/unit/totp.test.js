import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import {
  base32Decode,
  base32Encode,
  hotp,
  totpAt,
  verifyCode,
} from "../../server/auth/totp.js";

// REQ-114 criterion 7, the unit part (the code design M2AUTH, 4.9.7): RFC 6238 Appendix B with SHA-1, the
// window of one step on each side with the last used step, and base32 of RFC 4648. The oracle is the RFC's
// own table and a base32 encoder written here.

const KEY = Buffer.from("12345678901234567890", "ascii");
/** RFC 6238 Appendix B, the SHA-1 rows: T and the 8-digit TOTP. */
const VECTORS = /** @type {Array<[number, string]>} */ ([
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
]);

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** RFC 4648 base32 without padding, written here. @param {Buffer} bytes */
function own32(bytes) {
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  while (bits.length % 5) bits += "0";
  let out = "";
  for (let i = 0; i < bits.length; i += 5)
    out += B32[Number.parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

test("TO-1 the SHA-1 vectors of RFC 6238 Appendix B give the 8-digit values and their last 6 digits as the 6-digit codes", () => {
  for (const [t, eight] of VECTORS) {
    assert.equal(hotp(KEY, Math.floor(t / 30), 8), eight, `hotp T=${t}`);
    assert.equal(totpAt(KEY, t, 8), eight, `8 digits T=${t}`);
    assert.equal(totpAt(KEY, t), eight.slice(2), `6 digits T=${t}`);
    assert.equal(totpAt(KEY, t, 6), eight.slice(2));
  }
});

test("TO-2 verifyCode accepts the steps t-1, t and t+1 newer than the last used one and refuses t-2, t+2, a used step and a malformed code", () => {
  const key = crypto.randomBytes(20);
  const t = 1_800_000_015;
  const step = Math.floor(t / 30);
  for (const off of [-1, 0, 1]) {
    const code = hotp(key, step + off, 6);
    assert.equal(verifyCode(key, code, t, null), step + off, `offset ${off}`);
    assert.equal(verifyCode(key, code, t, step + off - 1), step + off);
    assert.equal(verifyCode(key, code, t, step + off), null, `used ${off}`);
    assert.equal(verifyCode(key, code, t, step + 5), null);
  }
  for (const off of [-3, -2, 2, 3])
    assert.equal(verifyCode(key, hotp(key, step + off, 6), t, null), null);
  const good = hotp(key, step, 6);
  for (const bad of [
    good.slice(1),
    `${good}0`,
    ` ${good.slice(1)}`,
    good.replace(/^./, "x"),
    "",
  ])
    assert.equal(verifyCode(key, bad, t, null), null, JSON.stringify(bad));
});

test("TO-3 base32 of RFC 4648 (no padding): the RFC examples, and 200 random inputs equal the encoder of this test and decode back", () => {
  for (const [plain, coded] of [
    ["", ""],
    ["f", "MY"],
    ["fo", "MZXQ"],
    ["foo", "MZXW6"],
    ["foob", "MZXW6YQ"],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI"],
  ]) {
    assert.equal(base32Encode(Buffer.from(plain)), coded);
    assert.equal(/** @type {Buffer} */ (base32Decode(coded)).toString(), plain);
  }
  for (let i = 0; i < 200; i++) {
    const bytes = crypto.randomBytes(i % 33);
    const text = base32Encode(bytes);
    assert.equal(text, own32(bytes));
    assert.ok(/** @type {Buffer} */ (base32Decode(text)).equals(bytes));
  }
  for (const bad of ["mzxw6", "MZXW1", "MZ XW", "MZXW6="])
    assert.equal(base32Decode(bad), null, bad);
});
