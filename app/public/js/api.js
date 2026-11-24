// The JSON client of the account pages (the code design M2AUTH, 5.1) and the frame they share. `call`
// sends a JSON body with the CSRF header of the session, with the cookie of the same origin only, and
// answers { ok, status, body } or { ok, status, code, retryAfter? }; the code of a refusal maps to the
// text key auth_err_<code>. The CSRF token is the one `GET /api/auth/me` answers; it is cached and read
// again once when the server answers csrf_refused. The module keeps no secret: the token lives in the
// memory of the page only, never in the browser storage. `mountFrame` is the start every account page
// repeats: its texts, the Kazakh note, the theme button and the language switch.

import { LANGS, TEXTS } from "../shared/i18n/texts.js";
import {
  applyTexts,
  currentLang,
  fill,
  mountLangSwitch,
  syncKkNote,
  text,
} from "./dom.js";
import { mountTheme } from "./theme.js";

/**
 * Every code the account routes can answer, the same closed list as AUTH_CODES of the server (the page
 * may not import the server): each has a text under auth_err_<code>.
 */
export const AUTH_CODES = Object.freeze([
  "not_found",
  "body_too_large",
  "site_closed",
  "bad_json",
  "bad_body",
  "server_error",
  "server_config",
  "auth_required",
  "invalid_credentials",
  "totp_required",
  "totp_invalid",
  "origin_refused",
  "csrf_refused",
  "reauth_required",
  "unsupported_type",
  "password_rules",
  "unknown_purpose",
  "reset_invalid",
  "totp_state",
  "locked",
  "reauth_locked",
  "rate_limited",
  "db_unavailable",
  "personal_data_gate",
  "registration_closed",
  "forbidden",
  "owner_identity_required",
  "consent_required",
  "consent_stale",
  "account_exists",
  "bad_request",
]);

/** The paths after which the session is another one, so the cached CSRF token is dropped. */
const SESSION_CHANGERS = Object.freeze([
  "/api/auth/setup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/reset",
  "/api/auth/password",
]);

/** The accept path of an invitation: «/api/invites/», the 22 characters of the code and «/accept». */
const ACCEPT_PATH = /^\/api\/invites\/[A-Za-z0-9_-]{22}\/accept$/;

/**
 * Whether the session is another one after a successful call of this path: the five paths of the account
 * routes and the accept of an invitation (which ends the old session and opens a new one).
 * @param {string} path
 * @returns {boolean}
 */
export function sessionChanges(path) {
  return SESSION_CHANGERS.includes(path) || ACCEPT_PATH.test(path);
}

/**
 * @typedef {{ ok: true, status: number, body: any }} CallOk
 * @typedef {{ ok: false, status: number, code: string, retryAfter?: number }} CallFail
 * @typedef {CallOk | CallFail} CallResult
 */

/** @type {string | null} */
let csrf = null;

/**
 * The text key of a code: auth_err_<code>, or the key of server_error for a code the list does not hold.
 * @param {string} code
 * @returns {string}
 */
export function errorKey(code) {
  return AUTH_CODES.includes(code)
    ? `auth_err_${code}`
    : "auth_err_server_error";
}

/**
 * The error code of an answer body: the string under "error" when it is one, else server_error.
 * @param {unknown} body
 * @returns {string}
 */
function codeOf(body) {
  if (body !== null && typeof body === "object" && "error" in body) {
    const code = /** @type {{ error: unknown }} */ (body).error;
    if (typeof code === "string") return code;
  }
  return "server_error";
}

/**
 * One request. A network failure answers the code db_unavailable; an answer that is not JSON reads as
 * an empty body.
 * @param {string} method
 * @param {string} path
 * @param {unknown} body the JSON body, or undefined
 * @param {string | null} reauth the re-auth token to send, or null
 * @returns {Promise<CallResult>}
 */
async function send(method, path, body, reauth) {
  /** @type {Record<string, string>} */
  const headers = {};
  if (method !== "GET") headers["content-type"] = "application/json";
  if (method !== "GET" && csrf !== null) headers["x-sai-csrf"] = csrf;
  if (reauth !== null) headers["x-sai-reauth"] = reauth;
  /** @type {Response} */
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, status: 0, code: "db_unavailable" };
  }
  /** @type {any} */
  const parsed = await res.json().catch(() => null);
  if (res.ok) {
    if (sessionChanges(path)) csrf = null;
    return { ok: true, status: res.status, body: parsed ?? {} };
  }
  /** @type {CallFail} */
  const fail = { ok: false, status: res.status, code: codeOf(parsed) };
  const after = Number(res.headers.get("retry-after"));
  if (Number.isFinite(after) && after > 0) fail.retryAfter = after;
  return fail;
}

/**
 * The session of the caller: GET /api/auth/me; on success the CSRF token of the answer is cached.
 * @returns {Promise<CallResult>}
 */
export async function me() {
  const result = await send("GET", "/api/auth/me", undefined, null);
  csrf =
    result.ok && typeof result.body.csrf === "string" ? result.body.csrf : null;
  return result;
}

/**
 * A call of the JSON API. A csrf_refused answer reads the session once more and sends the request
 * again, once.
 * @param {"GET" | "POST"} method
 * @param {string} path
 * @param {unknown} [body]
 * @param {{ reauth?: string }} [options] the re-auth token of the action
 * @returns {Promise<CallResult>}
 */
export async function call(method, path, body, options = {}) {
  const reauth = options.reauth ?? null;
  const first = await send(method, path, body, reauth);
  if (first.ok || first.code !== "csrf_refused") return first;
  const again = await me();
  if (!again.ok) return first;
  return send(method, path, body, reauth);
}

/**
 * A re-auth token for an action: POST /api/auth/reauth with the password and the purpose as given (and
 * the second-factor code when the account has one). A refusal answers its code, so a page can ask for the
 * code on totp_required and send the same call again.
 * @param {string} password
 * @param {string} purpose
 * @param {string} [code] the code from the app or a backup code
 * @returns {Promise<{ ok: true, token: string } | { ok: false, code: string, retryAfter?: number }>}
 */
export async function reauthToken(password, purpose, code) {
  /** @type {{ password: string, purpose: string, code?: string }} */
  const body = { password, purpose };
  if (code !== undefined && code !== "") body.code = code;
  const result = await call("POST", "/api/auth/reauth", body);
  if (!result.ok) {
    /** @type {{ ok: false, code: string, retryAfter?: number }} */
    const fail = { ok: false, code: result.code };
    if (result.retryAfter !== undefined) fail.retryAfter = result.retryAfter;
    return fail;
  }
  return { ok: true, token: String(result.body.token) };
}

/**
 * The text of a failed call in a language.
 * @param {CallFail} fail
 * @param {string} lang
 * @returns {string}
 */
export function failText(fail, lang) {
  return text(TEXTS, errorKey(fail.code), lang);
}

/**
 * An error line (data-err) sits in a box with its label; the box is shown with the line and hidden
 * with it.
 * @param {Element} node
 * @param {boolean} shown
 * @returns {void}
 */
function showBox(node, shown) {
  const box = node.parentElement;
  if (node.hasAttribute("data-err") && box !== null) box.hidden = !shown;
}

/**
 * The start every account page repeats: its texts in its language, the Kazakh note, the theme button
 * and the language switch. A text a page sets later by `say` keeps its key on the element, so a change
 * of the language sets it again.
 * @param {Document} doc
 * @param {(lang: string) => void} [onLang] called with the new language after a switch
 * @returns {{ lang: () => string, say: (node: Element | null, key: string, values?: { [name: string]: string }) => void, clear: (node: Element | null) => void }}
 */
export function mountFrame(doc, onLang = () => {}) {
  let lang = currentLang(LANGS);
  /** @type {Map<Element, { [name: string]: string }>} */
  const values = new Map();
  const render = () => {
    applyTexts(doc, TEXTS, lang);
    for (const [node, vals] of values) {
      const key = node.getAttribute("data-t");
      if (key !== null) node.textContent = fill(text(TEXTS, key, lang), vals);
    }
  };
  render();
  syncKkNote(doc, TEXTS, lang);
  const theme = mountTheme(doc, { texts: TEXTS, lang, onChange: () => {} });
  mountLangSwitch(doc, {
    langs: LANGS,
    current: lang,
    onChange: (next) => {
      lang = next;
      render();
      theme.setLang(lang);
      syncKkNote(doc, TEXTS, lang);
      onLang(lang);
    },
  });
  return {
    lang: () => lang,
    say(node, key, vals = {}) {
      if (node === null) return;
      node.setAttribute("data-t", key);
      values.set(node, vals);
      node.textContent = fill(text(TEXTS, key, lang), vals);
      showBox(node, true);
    },
    clear(node) {
      if (node === null) return;
      node.removeAttribute("data-t");
      values.delete(node);
      node.textContent = "";
      showBox(node, false);
    },
  };
}
