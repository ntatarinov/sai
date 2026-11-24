// The page script of the invitation page (the code design M2PROJ, 4.9.2): the invitation code is read once
// from the fragment of the address (#c=...) and the fragment is cleared at once; GET /api/invites/<code>
// answers the organisation and the role; the five consent sentences are shown in the language of the page
// (or in ru when the server holds no complete text of that language); the box is not ticked at the start.
// The accept goes to POST /api/invites/<code>/accept with the name, the e-mail, the password, consent true
// and the sha256 of the exact text shown. Nothing is stored; the password field is emptied after each answer.

import { CONSENT_KEYS, consentText } from "../../shared/consent.js";
import { TEXTS } from "../../shared/i18n/texts.js";
import { call, errorKey, me, mountFrame } from "../api.js";
import { text } from "../dom.js";

/** The fragment of an invitation link: «#c=» and the 22 characters of the code. */
const FRAGMENT = /^#c=([A-Za-z0-9_-]{22})$/;

/**
 * The sha256 of a text as 64 lower-case hex digits.
 * @param {string} value
 * @returns {Promise<string>}
 */
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {Document} doc
 * @param {Window} win
 * @returns {void}
 */
function start(doc, win) {
  const byId = (/** @type {string} */ id) =>
    /** @type {HTMLElement} */ (doc.getElementById(id));
  const field = (/** @type {string} */ id) =>
    /** @type {HTMLInputElement} */ (doc.getElementById(id));
  const form = /** @type {HTMLFormElement} */ (byId("form"));
  const submit = /** @type {HTMLButtonElement} */ (byId("submit"));
  const err = byId("err");
  /** the languages the server holds the whole consent text of */
  let consentLangs = ["ru"];

  /** The language of the consent text: the page language when it has a text there, else ru. */
  const consentLang = () => {
    const lang = frame.lang();
    return consentLangs.includes(lang) && consentText(TEXTS, lang) !== null
      ? lang
      : "ru";
  };
  const showConsent = () => {
    const lang = consentLang();
    byId("consent-text").lang = lang;
    CONSENT_KEYS.forEach((key, i) => {
      byId(`consent-${i + 1}`).textContent = text(TEXTS, key, lang);
    });
  };
  const frame = mountFrame(doc, showConsent);

  const found = FRAGMENT.exec(win.location.hash);
  const code = found === null ? null : found[1];
  if (win.location.hash !== "") {
    try {
      win.history.replaceState(
        win.history.state,
        "",
        win.location.pathname + win.location.search,
      );
    } catch {
      // the address keeps its fragment; the code is already read
    }
  }
  if (code === null) {
    byId("invalid").hidden = false;
    return;
  }

  call("GET", `/api/invites/${code}`).then((result) => {
    if (!result.ok) {
      if (result.code === "not_found") byId("invalid").hidden = false;
      else frame.say(err, errorKey(result.code));
      return;
    }
    const body = result.body;
    byId("org").textContent = String(body.org.name);
    frame.say(byId("role"), `inv_role_${String(body.role)}`);
    byId("new-note").hidden = body.org.new !== true;
    if (Array.isArray(body.consent_langs))
      consentLangs = body.consent_langs.map(String);
    showConsent();
    byId("app").hidden = false;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    if (!field("consent").checked) {
      frame.say(err, "auth_err_consent_required");
      return;
    }
    const lang = consentLang();
    const shown = consentText(TEXTS, lang);
    if (shown === null || !globalThis.crypto?.subtle) {
      frame.say(err, errorKey("server_error"));
      return;
    }
    submit.disabled = true;
    const result = await call("POST", `/api/invites/${code}/accept`, {
      name: field("name").value.trim(),
      email: field("email").value.trim(),
      password: field("password").value,
      consent: true,
      consent_sha256: await sha256Hex(shown),
      consent_lang: lang,
    });
    field("password").value = "";
    if (!result.ok) {
      submit.disabled = false;
      frame.say(
        err,
        result.code === "not_found" ? "inv_check" : errorKey(result.code),
      );
      return;
    }
    const mine = await me();
    submit.disabled = false;
    if (!mine.ok) {
      frame.say(err, errorKey(mine.code));
      return;
    }
    win.location.assign("/projects.html");
  });
}

start(document, window);
