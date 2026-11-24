// The page script of the two-step sign-in page of the platform admin (the code design M2AUTH, 5.2).
// The page needs GET /api/auth/me with platform_admin; for anyone else it shows the text of not_found.
// Turn on: the password goes to POST /api/auth/reauth (purpose totp_enrol), then POST /api/admin/totp/enrol
// answers the key and the address, which the page shows as text (no picture); the code from the app goes
// to POST /api/admin/totp/confirm, which answers the ten backup codes, shown once. Turn off: the password
// (and a code when the server asks) goes to the re-auth of purpose totp_off, then a next code goes to
// POST /api/admin/totp/off with the token. A token that a refused turn-off has spent is dropped and the
// form starts again. Keys, codes and tokens live in the memory of the page and in the elements shown;
// nothing is stored, and a field is emptied after it is sent.

import { call, errorKey, me, mountFrame } from "../api.js";

/**
 * @param {Document} doc
 * @returns {void}
 */
function start(doc) {
  const frame = mountFrame(doc);
  const byId = (/** @type {string} */ id) =>
    /** @type {HTMLElement} */ (doc.getElementById(id));
  const field = (/** @type {string} */ id) =>
    /** @type {HTMLInputElement} */ (doc.getElementById(id));
  const clean = (/** @type {string} */ id) =>
    field(id).value.replace(/\s+/g, "").toUpperCase();

  const gate = byId("gate-msg");
  const panels = byId("panels");
  const enrolForm = byId("enrol-form");
  const enrolErr = byId("enrol-err");
  const enrolSubmit = /** @type {HTMLButtonElement} */ (byId("enrol-submit"));
  const secretBox = byId("enrol-secret");
  const confirmForm = byId("confirm-form");
  const confirmErr = byId("confirm-err");
  const confirmSubmit = /** @type {HTMLButtonElement} */ (
    byId("confirm-submit")
  );
  const codes = byId("codes");
  const offForm = byId("off-form");
  const offErr = byId("off-err");
  const offSubmit = /** @type {HTMLButtonElement} */ (byId("off-submit"));
  const doneMsg = byId("done-msg");

  /**
   * The re-auth token of the turn-off that waits for its code, or null.
   * @type {string | null}
   */
  let offToken = null;

  /**
   * One re-auth: the token, or the code of the refusal.
   * @param {string} purpose
   * @param {string} password
   * @param {string} [code]
   * @returns {Promise<{ token: string } | { code: string }>}
   */
  const reauth = async (purpose, password, code) => {
    /** @type {{ password: string, purpose: string, code?: string }} */
    const body = { password, purpose };
    if (code !== undefined && code !== "") body.code = code;
    const result = await call("POST", "/api/auth/reauth", body);
    if (!result.ok) return { code: result.code };
    return { token: String(result.body.token) };
  };

  enrolForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(enrolErr);
    frame.clear(doneMsg);
    enrolSubmit.disabled = true;
    const password = field("enrol-password").value;
    field("enrol-password").value = "";
    const token = await reauth("totp_enrol", password);
    if ("code" in token) {
      enrolSubmit.disabled = false;
      frame.say(enrolErr, errorKey(token.code));
      return;
    }
    const result = await call(
      "POST",
      "/api/admin/totp/enrol",
      {},
      { reauth: token.token },
    );
    enrolSubmit.disabled = false;
    if (!result.ok) {
      frame.say(enrolErr, errorKey(result.code));
      return;
    }
    byId("secret-text").textContent = String(result.body.secret);
    byId("otpauth-text").textContent = String(result.body.otpauth);
    enrolForm.hidden = true;
    secretBox.hidden = false;
    field("confirm-code").focus();
  });

  confirmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(confirmErr);
    confirmSubmit.disabled = true;
    const result = await call("POST", "/api/admin/totp/confirm", {
      code: clean("confirm-code"),
    });
    confirmSubmit.disabled = false;
    field("confirm-code").value = "";
    if (!result.ok) {
      frame.say(confirmErr, errorKey(result.code));
      return;
    }
    const list = byId("codes-list");
    list.replaceChildren();
    for (const code of result.body.recovery_codes) {
      const item = doc.createElement("li");
      item.className = "msg-title num";
      item.textContent = String(code);
      list.append(item);
    }
    byId("secret-text").textContent = "";
    byId("otpauth-text").textContent = "";
    secretBox.hidden = true;
    codes.hidden = false;
  });

  /** The turn-off form back to its first step: the password, and the code only if the server asked. */
  const offFirstStep = () => {
    offToken = null;
    byId("row-off-code2").hidden = true;
    field("off-code2").value = "";
    frame.say(offSubmit, "auth_b_check");
  };

  offForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(offErr);
    frame.clear(doneMsg);
    offSubmit.disabled = true;
    if (offToken === null) {
      const password = field("off-password").value;
      field("off-password").value = "";
      const token = await reauth("totp_off", password, clean("off-code1"));
      field("off-code1").value = "";
      offSubmit.disabled = false;
      if ("code" in token) {
        if (token.code === "totp_required")
          byId("row-off-code1").hidden = false;
        frame.say(offErr, errorKey(token.code));
        return;
      }
      offToken = token.token;
      byId("row-off-code2").hidden = false;
      frame.say(offSubmit, "auth_b_off");
      frame.say(doneMsg, "auth_totp_off_next");
      field("off-code2").focus();
      return;
    }
    const token = offToken;
    const code = clean("off-code2");
    const result = await call(
      "POST",
      "/api/admin/totp/off",
      { code },
      { reauth: token },
    );
    offSubmit.disabled = false;
    field("off-code2").value = "";
    offFirstStep();
    if (!result.ok) {
      frame.say(offErr, errorKey(result.code));
      return;
    }
    frame.say(doneMsg, "auth_totp_off_done");
  });

  me().then((mine) => {
    if (mine.ok && mine.body.platform_admin === true) {
      panels.hidden = false;
      return;
    }
    frame.say(gate, errorKey("not_found"));
  });
}

start(document);
