import { bumpRate, cleanup } from "../db/auth-store.js";
import { HttpError } from "./errors.js";

// Fixed-window rate limits (REQ-114 criterion 9; ARCH §14.3; the code design M2AUTH, 4.10). The key is the
// HMAC of the limit's name and the client address (or the session id for "user"); the address never enters
// a row in clear. One upsert increments and reads the window; a count over the limit is 429 rate_limited
// with Retry-After, thrown, so the increment rolls back and the count stays at the limit.

/** @typedef {import("../db/index.js").Q} Q */

/** @type {Readonly<Record<"setup" | "login" | "reset" | "user", { windowMs: number, max: number }>>} */
export const LIMITS = Object.freeze({
  setup: { windowMs: 3600 * 1000, max: 5 },
  login: { windowMs: 15 * 60 * 1000, max: 10 },
  reset: { windowMs: 15 * 60 * 1000, max: 10 },
  user: { windowMs: 10 * 60 * 1000, max: 600 },
});

/** The share of pipeline requests that run the lazy cleanup. */
export const CLEANUP_SHARE = 0.01;

/**
 * Counts one request in its window; throws 429 rate_limited over the limit.
 * @param {Q} q
 * @param {(label: string, text: string) => string} mac
 * @param {"setup" | "login" | "reset" | "user"} limit
 * @param {string} subject the normalised address or "unknown", or the session id for "user"
 * @param {number} now
 */
export async function countRequest(q, mac, limit, subject, now) {
  const { windowMs, max } = LIMITS[limit];
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const count = await bumpRate(
    q,
    mac("rl", `${limit}\u0000${subject}`),
    windowStart,
  );
  if (count > max)
    throw new HttpError("rate_limited", {
      retryAfter: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
    });
}

/**
 * The lazy cleanup, run by `random() < CLEANUP_SHARE` (injected random source).
 * @param {Q} q
 * @param {number} now
 * @param {() => number} random
 */
export async function maybeCleanup(q, now, random) {
  if (random() < CLEANUP_SHARE) await cleanup(q, now);
}
