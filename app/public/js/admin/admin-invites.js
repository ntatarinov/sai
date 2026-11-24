// The page script of the invitation form of the platform admin (the code design M2PROJ, 4.9.2): the e-mail,
// the role, the organisation (an existing one by its identifier, or a new one with its name; a new one is
// always for its owner), the owner-identity box and the admin's password. The password goes to
// POST /api/auth/reauth with the purpose owner_identity (a code field appears when the answer is
// totp_required), then the invitation is created with that token (POST /api/admin/invites). The link comes
// back once: it is shown in a read-only field and cleared on the next input. The password field is emptied
// after each answer except the one that asks for the code; nothing is stored. A caller who is not the
// platform admin sees the text of not_found.

import { call, errorKey, me, mountFrame, reauthToken } from "../api.js";

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
  const form = /** @type {HTMLFormElement} */ (byId("form"));
  const submit = /** @type {HTMLButtonElement} */ (byId("submit"));
  const role = /** @type {HTMLSelectElement} */ (byId("role"));
  const mode = /** @type {HTMLSelectElement} */ (byId("org-mode"));
  const err = byId("err");
  const prompt = byId("prompt");
  const rowCode = byId("row-code");
  const result = byId("result");

  /** A new organisation is for its owner: the role is fixed and the identifier row gives way to the name. */
  const syncMode = () => {
    const isNew = mode.value === "new";
    byId("row-org-name").hidden = !isNew;
    byId("row-organisation").hidden = isNew;
    role.disabled = isNew;
    if (isNew) role.value = "org_owner";
  };
  syncMode();
  mode.addEventListener("change", syncMode);

  /** The link is shown once: any new input clears it. */
  form.addEventListener("input", () => {
    field("link").value = "";
    result.hidden = true;
  });

  me().then((mine) => {
    if (!mine.ok || mine.body.platform_admin !== true) {
      byId("gate").hidden = false;
      return;
    }
    byId("app").hidden = false;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    frame.clear(prompt);
    submit.disabled = true;
    const token = await reauthToken(
      field("password").value,
      "owner_identity",
      field("code").value.replace(/\s+/g, "").toUpperCase(),
    );
    if (!token.ok) {
      submit.disabled = false;
      if (token.code === "totp_required") {
        // not a failure: the password was right and the form asks for the code
        rowCode.hidden = false;
        frame.say(prompt, errorKey(token.code));
        field("code").focus();
        return;
      }
      field("password").value = "";
      frame.say(err, errorKey(token.code));
      return;
    }
    /** @type {Record<string, string | boolean>} */
    const body = {
      email: field("email").value.trim(),
      role: role.value,
      owner_identity: field("owner-identity").checked,
    };
    if (mode.value === "new") body.org_name = field("org-name").value.trim();
    else body.organisation = field("organisation").value.trim();
    const created = await call("POST", "/api/admin/invites", body, {
      reauth: token.token,
    });
    submit.disabled = false;
    field("password").value = "";
    field("code").value = "";
    rowCode.hidden = true;
    if (!created.ok) {
      frame.say(err, errorKey(created.code));
      return;
    }
    field("link").value = String(created.body.link);
    result.hidden = false;
  });
}

start(document);
