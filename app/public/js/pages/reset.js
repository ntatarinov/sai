// The page script of the new-password page (the code design M2AUTH, 5.2): the reset code is read once
// from the fragment of the address (#c=...) and the fragment is cleared at once, so the code stays in
// the memory of the page only; the new password is typed twice, the two are compared here, and the
// pair goes to POST /api/auth/reset with the code. A link without a code shows the text of reset_invalid.

import { call, errorKey, mountFrame } from "../api.js";

/** The fragment of a reset link: «#c=» and the 22 characters of the code. */
const FRAGMENT = /^#c=([A-Za-z0-9_-]{22})$/;

/**
 * @param {Document} doc
 * @param {Window} win
 * @returns {void}
 */
function start(doc, win) {
  const frame = mountFrame(doc);
  const form = /** @type {HTMLFormElement} */ (doc.getElementById("form"));
  const done = doc.getElementById("done");
  const err = doc.getElementById("err");
  const submit = /** @type {HTMLButtonElement} */ (
    doc.getElementById("submit")
  );
  const field = (/** @type {string} */ id) =>
    /** @type {HTMLInputElement} */ (doc.getElementById(id));

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
    form.hidden = true;
    frame.say(doc.getElementById("invalid"), errorKey("reset_invalid"));
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    const next = field("password").value;
    if (next !== field("repeat").value) {
      frame.say(err, "auth_mismatch");
      return;
    }
    submit.disabled = true;
    const result = await call("POST", "/api/auth/reset", {
      code,
      password: next,
    });
    submit.disabled = false;
    field("password").value = "";
    field("repeat").value = "";
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    form.hidden = true;
    if (done !== null) done.hidden = false;
  });
}

start(document, window);
