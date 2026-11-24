import crypto from "node:crypto";
import { insertSession, readSession } from "../db/auth-store.js";

// Login sessions (REQ-114 criterion 3; the code design M2AUTH, 4.9.3): 32 random bytes in the cookie, the
// database keeps only HMACs of the token and of its CSRF token; idle 12 h (read from last_seen_at), absolute
// 7 days. The cookie is `__Host-sai_s` with Secure when APP_ORIGIN is https, `sai_s` only when APP_ORIGIN is
// exactly http://127.0.0.1:<port>; any other origin has no cookie name, and the pipeline answers 503.

/** @typedef {import("../db/index.js").Q} Q */
/** @typedef {import("./keys.js").Keys} Keys */

export const IDLE_MS = 12 * 3600 * 1000;
export const ABSOLUTE_MS = 7 * 24 * 3600 * 1000;
const MAX_AGE_S = 604800;

/** A token of 32 random bytes in base64url. */
export const TOKEN_FORM = /^[A-Za-z0-9_-]{43}$/;

const LOCAL_ORIGIN = /^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/;

/**
 * @typedef {object} Session
 * @property {string} id
 * @property {string} userId
 * @property {boolean} isAdmin
 * @property {string | null} orgId the organisation of the user's only membership
 * @property {string | null} role
 * @property {string} csrf
 */

/** @returns {string} a new token of 32 random bytes */
export const newToken = () => crypto.randomBytes(32).toString("base64url");

/**
 * @param {string} appOrigin
 * @returns {string | null}
 */
export function cookieName(appOrigin) {
  if (appOrigin.startsWith("https://")) return "__Host-sai_s";
  if (LOCAL_ORIGIN.test(appOrigin)) return "sai_s";
  return null;
}

/**
 * @param {string} name
 * @param {string} value
 * @param {number} maxAge
 * @returns {string}
 */
const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${name.startsWith("__Host-") ? "; Secure" : ""}`;

/**
 * @param {string} name
 * @param {string} token
 * @returns {string}
 */
export const setCookie = (name, token) => cookie(name, token, MAX_AGE_S);

/**
 * @param {string} name
 * @returns {string}
 */
export const clearCookie = (name) => cookie(name, "", 0);

/**
 * The token of the cookie `name` in its 43-character form, or null (a missing, malformed or repeated cookie).
 * @param {string | null} header the Cookie header
 * @param {string | null} name
 * @returns {string | null}
 */
export function readCookie(header, name) {
  if (header === null || name === null) return null;
  /** @type {string[]} */
  const found = [];
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name)
      found.push(part.slice(at + 1).trim());
  }
  if (found.length !== 1 || !TOKEN_FORM.test(found[0])) return null;
  return found[0];
}

/**
 * A new session row; the token and the CSRF token go only to the caller.
 * @param {Q} q
 * @param {Keys} keys
 * @param {{ userId: string, ip: string | null, now: number }} s
 * @returns {Promise<{ id: string, token: string, csrf: string }>}
 */
export async function openSession(q, keys, { userId, ip, now }) {
  const token = newToken();
  const csrf = keys.csrfFor(token);
  const id = await insertSession(q, {
    userId,
    tokenHash: keys.mac("session", token),
    csrfHash: keys.mac("csrfh", csrf),
    now,
    absExpiresAt: now + ABSOLUTE_MS,
    ipHmac: ip === null ? null : keys.mac("ip", ip),
  });
  return { id, token, csrf };
}

/**
 * The live session of a cookie token, read only (4.7 step 1).
 * @param {Q} q
 * @param {Keys} keys
 * @param {string} token
 * @param {number} now
 * @returns {Promise<Session | null>}
 */
export async function readLiveSession(q, keys, token, now) {
  const row = await readSession(
    q,
    keys.mac("session", token),
    now - IDLE_MS,
    now,
  );
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    isAdmin: row.is_platform_admin === true,
    orgId: row.org_id ?? null,
    role: row.role ?? null,
    csrf: keys.csrfFor(token),
  };
}
