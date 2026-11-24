import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  setupDigestsEqual,
  setupTokenMatches,
} from "../../server/auth/setup.js";
import { blank } from "../fixtures/blank.js";
import { APP } from "../fixtures/helpers.js";

// REQ-114 criterion 2, the compare (the code design M2AUTH, 4.9.6): the one compare function of
// app/server/auth/setup.js calls crypto.timingSafeEqual on two 32-byte sha256 digests. The calls are
// counted by wrapping crypto.timingSafeEqual on the node:crypto object the module uses.

const SETUP_FILE = path.join(APP, "server", "auth", "setup.js");
const digest = (/** @type {string} */ s) =>
  crypto.createHash("sha256").update(s, "utf8").digest();

/**
 * Wraps crypto.timingSafeEqual for one test and records the byte lengths of each call.
 * @param {import("node:test").TestContext} t
 */
function countCompares(t) {
  const real = crypto.timingSafeEqual;
  /** @type {Array<[number, number]>} */
  const calls = [];
  crypto.timingSafeEqual = (a, b) => {
    calls.push([a.byteLength, b.byteLength]);
    return real(a, b);
  };
  t.after(() => {
    crypto.timingSafeEqual = real;
  });
  return calls;
}

test("SCMP-1 the compare calls crypto.timingSafeEqual on two 32-byte digests: equal → true, only the first or only the last byte differs → false; the token check goes through it", (t) => {
  const src = blank(fs.readFileSync(SETUP_FILE, "utf8"), true);
  assert.match(
    src,
    /\btimingSafeEqual\s*\(/,
    "the source calls timingSafeEqual",
  );
  const calls = countCompares(t);
  for (let i = 0; i < 20; i++) {
    const a = digest(`token ${i}`);
    assert.equal(setupDigestsEqual(a, Buffer.from(a)), true);
    const first = Buffer.from(a);
    first[0] ^= 0x80;
    const last = Buffer.from(a);
    last[31] ^= 0x01;
    assert.equal(setupDigestsEqual(a, first), false, "first byte");
    assert.equal(setupDigestsEqual(a, last), false, "last byte");
  }
  assert.equal(calls.length, 60, "one timingSafeEqual call per compare");
  for (const [x, y] of calls) assert.deepEqual([x, y], [32, 32]);
  // Other lengths are refused without a compare.
  calls.length = 0;
  const a = digest("x");
  for (const b of [
    a.subarray(0, 31),
    Buffer.concat([a, Buffer.alloc(1)]),
    Buffer.alloc(0),
  ])
    assert.equal(setupDigestsEqual(a, b), false);
  assert.equal(calls.length, 0);
  // The route's check: the sha256 of the token against the configured hex hash, through the same compare.
  const token = crypto.randomBytes(32).toString("base64url");
  const hex = digest(token).toString("hex");
  assert.equal(setupTokenMatches(hex, token), true);
  assert.deepEqual(
    calls,
    [[32, 32]],
    "the token check calls timingSafeEqual on 32-byte digests",
  );
  calls.length = 0;
  const firstHex = `${hex[0] === "0" ? "1" : "0"}${hex.slice(1)}`;
  const lastHex = `${hex.slice(0, -1)}${hex.endsWith("0") ? "1" : "0"}`;
  assert.equal(setupTokenMatches(firstHex, token), false);
  assert.equal(setupTokenMatches(lastHex, token), false);
  assert.deepEqual(calls, [
    [32, 32],
    [32, 32],
  ]);
  calls.length = 0;
  for (const bad of [
    null,
    "",
    hex.slice(1),
    `${hex}0`,
    hex.toUpperCase(),
    `${hex.slice(1)}g`,
  ])
    assert.equal(setupTokenMatches(bad, token), false, String(bad));
  assert.equal(
    calls.length,
    0,
    "a malformed hash is refused before any compare",
  );
});
