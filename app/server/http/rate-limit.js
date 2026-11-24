import { bumpRate, cleanup } from "../db/auth-store.js";
import { HttpError } from "./errors.js";

// Fixed-window rate limits (REQ-114 criterion 9; ARCH §14.3; the code design M2AUTH, 4.10). The key is the
// HMAC of the limit's name and the client address (or the session id for "user"); the address never enters
// a row in clear. One upsert increments and reads the window; a count over the limit is 429 rate_limited
// with Retry-After, thrown, so the increment rolls back and the count stays at the limit.

/** @typedef {import("../db/index.js").Q} Q */

/** @typedef {"setup" | "login" | "reset" | "user" | "invite" | "invite_view" | "project"} LimitName */

/** @type {Readonly<Record<LimitName, { windowMs: number, max: number }>>} */
export const LIMITS = Object.freeze({
  setup: { windowMs: 3600 * 1000, max: 5 },
  login: { windowMs: 15 * 60 * 1000, max: 10 },
  reset: { windowMs: 15 * 60 * 1000, max: 10 },
  user: { windowMs: 10 * 60 * 1000, max: 600 },
  // Invitations and projects (the code design M2PROJ, C14): an accept per address, a view of an invite per
  // address, a project creation per user in a fixed 24-hour window.
  invite: { windowMs: 3600 * 1000, max: 10 },
  invite_view: { windowMs: 3600 * 1000, max: 60 },
  project: { windowMs: 24 * 3600 * 1000, max: 20 },
});

/** The limits whose subject is not an address: a session id ("user") or a user id ("project"). */
const SUBJECT_LIMITS = Object.freeze(["user", "project"]);

/**
 * The address part of a limit key (decisions/0137 Addition 4, SEC F2): an IPv4 address whole, an IPv6 address
 * by its /64 prefix (one ordinary IPv6 client holds a whole /64), any other text ("unknown") as it is. The
 * address is the normalised text of http/client-ip.js (an IPv4-mapped address is already IPv4).
 * @param {string} ip
 * @returns {string}
 */
export function addressKey(ip) {
  if (!ip.includes(":")) return ip;
  const halves = ip.split("::");
  /** @param {string} half */
  const groups = (half) =>
    half === ""
      ? []
      : half.split(":").flatMap((g) => (g.includes(".") ? ["0", "0"] : [g]));
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const fill = Array.from({ length: 8 - head.length - tail.length }, () => "0");
  const all = halves.length === 2 ? [...head, ...fill, ...tail] : head;
  return `${all
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/** The share of pipeline requests that run the lazy cleanup. */
export const CLEANUP_SHARE = 0.01;

/**
 * Counts one request in its window; throws 429 rate_limited over the limit.
 * @param {Q} q
 * @param {(label: string, text: string) => string} mac
 * @param {LimitName} limit
 * @param {string} subject the normalised address or "unknown", the session id for "user", the user id for "project"
 * @param {number} now
 */
export async function countRequest(q, mac, limit, subject, now) {
  const { windowMs, max } = LIMITS[limit];
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = SUBJECT_LIMITS.includes(limit) ? subject : addressKey(subject);
  const count = await bumpRate(
    q,
    mac("rl", `${limit}\u0000${key}`),
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
