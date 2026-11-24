// The page script of the first setup page (the code design M2AUTH, 5.2): the setup code, the e-mail,
// the name, the password and the language go to POST /api/auth/setup; 201 shows the done line and the
// link to the sign-in page, every refusal shows the plain text of its code. The page keeps nothing: no
// field is stored, and the password field is emptied after each answer.

import { call, errorKey, mountFrame } from "../api.js";

/**
 * @param {Document} doc
 * @returns {void}
 */
function start(doc) {
  const frame = mountFrame(doc);
  const form = /** @type {HTMLFormElement} */ (doc.getElementById("form"));
  const done = doc.getElementById("done");
  const err = doc.getElementById("err");
  const submit = /** @type {HTMLButtonElement} */ (
    doc.getElementById("submit")
  );
  const value = (/** @type {string} */ id) =>
    /** @type {HTMLInputElement} */ (doc.getElementById(id)).value;
  const language = /** @type {HTMLSelectElement} */ (
    doc.getElementById("language")
  );
  const offered = [...language.options].map((o) => o.value);
  language.value = offered.includes(frame.lang()) ? frame.lang() : "ru";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    submit.disabled = true;
    const result = await call("POST", "/api/auth/setup", {
      token: value("token").trim(),
      email: value("email").trim(),
      name: value("name").trim(),
      password: value("password"),
      language: language.value,
    });
    submit.disabled = false;
    /** @type {HTMLInputElement} */ (doc.getElementById("password")).value = "";
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    /** @type {HTMLInputElement} */ (doc.getElementById("token")).value = "";
    form.hidden = true;
    if (done !== null) done.hidden = false;
  });
}

start(document);
