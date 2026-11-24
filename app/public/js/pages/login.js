// The page script of the sign-in page (the code design M2AUTH, 5.2): the e-mail and the password go to
// POST /api/auth/login; on totp_required a code field appears and the same form is sent again with the
// code; on success the page reads GET /api/auth/me and shows the name, the logout button and, for the
// platform admin, the link to the two-step page. A caller who is already signed in sees that view at
// once. The password field is emptied after each answer; nothing is stored.

import { call, errorKey, me, mountFrame } from "../api.js";

/**
 * @param {Document} doc
 * @returns {void}
 */
function start(doc) {
  const frame = mountFrame(doc);
  const form = /** @type {HTMLFormElement} */ (doc.getElementById("form"));
  const session = /** @type {HTMLElement} */ (doc.getElementById("session"));
  const who = doc.getElementById("who");
  const info = doc.getElementById("info");
  const err = doc.getElementById("err");
  const toTotp = /** @type {HTMLElement} */ (doc.getElementById("to-totp"));
  const submit = /** @type {HTMLButtonElement} */ (
    doc.getElementById("submit")
  );
  const logout = /** @type {HTMLButtonElement} */ (
    doc.getElementById("logout")
  );
  const rowCode = /** @type {HTMLElement} */ (doc.getElementById("row-code"));
  const field = (/** @type {string} */ id) =>
    /** @type {HTMLInputElement} */ (doc.getElementById(id));

  /**
   * Shows the signed-in view from an answer of GET /api/auth/me.
   * @param {any} body
   * @returns {void}
   */
  const showSession = (body) => {
    form.hidden = true;
    session.hidden = false;
    toTotp.hidden = body.platform_admin !== true;
    frame.say(who, "auth_signed_in", { name: String(body.name) });
    frame.clear(info);
    frame.clear(err);
  };

  const showForm = () => {
    session.hidden = true;
    form.hidden = false;
    rowCode.hidden = true;
    field("code").value = "";
    field("password").value = "";
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    submit.disabled = true;
    const code = field("code").value.replace(/\s+/g, "").toUpperCase();
    /** @type {{ email: string, password: string, code?: string }} */
    const body = {
      email: field("email").value.trim(),
      password: field("password").value,
    };
    if (!rowCode.hidden && code !== "") body.code = code;
    const result = await call("POST", "/api/auth/login", body);
    if (!result.ok) {
      submit.disabled = false;
      if (result.code === "totp_required") rowCode.hidden = false;
      frame.say(err, errorKey(result.code));
      if (result.code === "totp_required" || result.code === "totp_invalid")
        field("code").focus();
      else field("password").value = "";
      return;
    }
    field("password").value = "";
    const mine = await me();
    submit.disabled = false;
    if (mine.ok) showSession(mine.body);
    else frame.say(err, errorKey(mine.code));
  });

  logout.addEventListener("click", async () => {
    logout.disabled = true;
    const result = await call("POST", "/api/auth/logout", {});
    logout.disabled = false;
    if (!result.ok) {
      frame.say(info, errorKey(result.code));
      return;
    }
    showForm();
  });

  me().then((mine) => {
    if (mine.ok) showSession(mine.body);
  });
}

start(document);
