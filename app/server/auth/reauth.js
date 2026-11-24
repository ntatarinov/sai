import crypto from "node:crypto";
import { consumeReauth, insertReauth } from "../db/auth-store.js";

// Re-auth tokens (REQ-114 criterion 6; the code design M2AUTH, 4.9.4): the password again gives a token of
// 5 minutes, single use, bound to the user, the session and the purpose; the database keeps only its HMAC.
// The route that consumes it does so in its own request transaction (4.7 step 8): a throw of the handler
// rolls the consumption back, so the action and the use of the token commit together.

/** @typedef {import("../db/index.js").Q} Q */
/** @typedef {import("./keys.js").Keys} Keys */

/**
 * The closed table of purposes (REQ-114 «written as one table in the code design»): the first three are
 * consumed by routes of M2.2, the others by the routes of M2.4-M5 (ARCH §5).
 */
export const PURPOSES = Object.freeze([
  "reset_link",
  "totp_enrol",
  "totp_off",
  "dev_start",
  "dev_resume",
  "worker_token",
  "settings",
  "kill_switch_off",
  "ai_allow",
  "codes",
  "owner_identity",
]);

export const REAUTH_TTL_MS = 5 * 60 * 1000;
export const REAUTH_HEADER = "x-sai-reauth";
const TOKEN_FORM = /^[A-Za-z0-9_-]{43}$/;

/**
 * @param {unknown} purpose
 * @returns {purpose is string}
 */
export const isPurpose = (purpose) =>
  typeof purpose === "string" && PURPOSES.includes(purpose);

/**
 * @param {Q} q
 * @param {Keys} keys
 * @param {{ userId: string, sessionId: string, purpose: string, now: number }} t
 * @returns {Promise<{ token: string, id: string }>}
 */
export async function issueReauth(
  q,
  keys,
  { userId, sessionId, purpose, now },
) {
  const token = crypto.randomBytes(32).toString("base64url");
  const id = await insertReauth(q, {
    userId,
    sessionId,
    purpose,
    tokenHash: keys.mac("reauth", token),
    now,
    expiresAt: now + REAUTH_TTL_MS,
  });
  return { token, id };
}

/**
 * Consumes the token of the header for this session and purpose: its id, or null (403 reauth_required).
 * @param {Q} q
 * @param {Keys} keys
 * @param {string | null} header
 * @param {{ id: string, userId: string }} session
 * @param {string} purpose
 * @param {number} now
 * @returns {Promise<string | null>}
 */
export async function consumeReauthToken(
  q,
  keys,
  header,
  session,
  purpose,
  now,
) {
  if (header === null || !TOKEN_FORM.test(header)) return null;
  return consumeReauth(q, {
    tokenHash: keys.mac("reauth", header),
    userId: session.userId,
    sessionId: session.id,
    purpose,
    now,
  });
}
