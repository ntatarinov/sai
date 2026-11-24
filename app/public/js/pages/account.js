// The page script of the account page (the code design M2PROJ, 4.9.2): the name, the organisation and the
// role of the signed-in person (GET /api/auth/me); the request for the deletion of the account, which needs
// the password again (POST /api/account/deletion-request) and shows the time of the request in the
// Kazakhstan format; the sign-out. A caller with no session sees the text of auth_required and the link to
// the sign-in page. The password field is emptied after each answer; nothing is stored.

import { formatDateTime } from "../../shared/format/kz.js";
import { call, errorKey, me, mountFrame } from "../api.js";

/**
 * @param {Document} doc
 * @param {Window} win
 * @returns {void}
 */
function start(doc, win) {
  const frame = mountFrame(doc);
  const byId = (/** @type {string} */ id) =>
    /** @type {HTMLElement} */ (doc.getElementById(id));
  const password = /** @type {HTMLInputElement} */ (byId("del-password"));
  const submit = /** @type {HTMLButtonElement} */ (byId("del-submit"));
  const logout = /** @type {HTMLButtonElement} */ (byId("logout"));
  const note = byId("del-note");
  const err = byId("err");

  /**
   * Shows the time of the open deletion request.
   * @param {unknown} iso
   * @returns {void}
   */
  const showRequest = (iso) => {
    frame.say(note, "acc_del_note", {
      when: formatDateTime(Date.parse(String(iso))),
    });
  };

  me().then((mine) => {
    if (!mine.ok) {
      byId("gate").hidden = false;
      return;
    }
    const body = mine.body;
    const member = Array.isArray(body.memberships)
      ? body.memberships[0]
      : undefined;
    byId("who").textContent = String(body.name);
    if (member !== undefined) {
      byId("org").textContent = String(member.name);
      frame.say(byId("role"), `inv_role_${String(member.role)}`);
    }
    byId("to-admin").hidden = body.platform_admin !== true;
    if (typeof body.deletion_requested_at === "string")
      showRequest(body.deletion_requested_at);
    byId("app").hidden = false;
  });

  byId("del-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    submit.disabled = true;
    const result = await call("POST", "/api/account/deletion-request", {
      password: password.value,
    });
    password.value = "";
    submit.disabled = false;
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    showRequest(result.body.requested_at);
  });

  logout.addEventListener("click", async () => {
    logout.disabled = true;
    const result = await call("POST", "/api/auth/logout", {});
    logout.disabled = false;
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    win.location.assign("/login.html");
  });
}

start(document, window);
