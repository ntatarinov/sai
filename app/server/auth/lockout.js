// The lockout rules (REQ-114 criterion 5; the code design M2AUTH, 4.9.5). Pure: the callers read the counter
// row under a row lock (select ... for update) and write the result in the same transaction, so the check and
// the count are one operation per counter (B3). An ordinary account (and an e-mail without an active account,
// in login_failures) locks for 15 minutes after 5 failures within 15 minutes; the re-auth counter has the
// same rule on its own columns; the platform admin is never locked and gets a delay per client address
// instead: after the n-th failure in a row the next attempt waits 2^(n-1) s, at most 60 s.

export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;
export const DELAY_CAP_S = 60;

/**
 * Whether a lock or a delay time is still ahead.
 * @param {number | null} until
 * @param {number} now
 * @returns {boolean}
 */
export const isAhead = (until, now) => until !== null && until > now;

/**
 * The Retry-After seconds of a lock or a delay, at least 1.
 * @param {number} until
 * @param {number} now
 * @returns {number}
 */
export const secondsLeft = (until, now) =>
  Math.max(1, Math.ceil((until - now) / 1000));

/**
 * The counter after one more failure: a new window when there is none or it is older than 15 minutes; the
 * lock at the fifth failure of a window.
 * @param {{ fails: number, since: number | null }} counter
 * @param {number} now
 * @returns {{ fails: number, since: number, lockedUntil: number | null }}
 */
export function afterFailure({ fails, since }, now) {
  const fresh = since === null || since <= now - WINDOW_MS;
  const next = fresh ? 1 : fails + 1;
  return {
    fails: next,
    since: fresh ? now : /** @type {number} */ (since),
    lockedUntil: next >= MAX_FAILS ? now + LOCK_MS : null,
  };
}

/**
 * The admin delay after one more failure in a row: 2^(fails before) seconds, at most 60.
 * @param {number} failsBefore
 * @returns {number} seconds
 */
export const delaySeconds = (failsBefore) =>
  Math.min(2 ** Math.min(failsBefore, 6), DELAY_CAP_S);
