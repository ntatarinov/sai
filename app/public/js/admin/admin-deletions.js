// The page script of the deletion requests of the platform admin (the code design M2PROJ, 4.9.2):
// GET /api/admin/deletion-requests lists the open requests (name, e-mail, the time of the request in the
// Kazakhstan format). Each row has a password field (and a code field when the answer is totp_required) and
// the button «Удалить учётную запись»: the password goes to POST /api/auth/reauth with the purpose
// user_delete, then POST /api/admin/users/<id>/delete with that token, then the list is read again. The
// password fields are emptied after each answer; nothing is stored. A caller who is not the platform admin
// sees the text of not_found.

import { TEXTS } from "../../shared/i18n/texts.js";
import { formatDateTime } from "../../shared/format/kz.js";
import { call, errorKey, me, mountFrame, reauthToken } from "../api.js";
import { el, text } from "../dom.js";

/**
 * @param {Document} doc
 * @returns {void}
 */
function start(doc) {
  const frame = mountFrame(doc);
  const byId = (/** @type {string} */ id) =>
    /** @type {HTMLElement} */ (doc.getElementById(id));
  const err = byId("err");

  /**
   * One request of the list, with its own password field, code field and error line.
   * @param {{ user_id: string, name: string, email: string, requested_at: string }} r
   * @returns {HTMLElement}
   */
  const row = (r) => {
    const password = /** @type {HTMLInputElement} */ (
      el("input", {
        cls: "fld del-password",
        attrs: {
          type: "password",
          autocomplete: "off",
          maxlength: "128",
          "data-t-aria": "auth_f_password",
          "aria-label": text(TEXTS, "auth_f_password", frame.lang()),
        },
      })
    );
    const code = /** @type {HTMLInputElement} */ (
      el("input", {
        cls: "fld del-code",
        attrs: {
          type: "text",
          autocomplete: "one-time-code",
          autocapitalize: "characters",
          spellcheck: "false",
          maxlength: "24",
          hidden: "",
          "data-t-aria": "auth_f_code",
          "aria-label": text(TEXTS, "auth_f_code", frame.lang()),
        },
      })
    );
    const button = /** @type {HTMLButtonElement} */ (
      el("button", {
        cls: "btn small del-submit",
        attrs: { type: "button", "data-t": "adm_b_delete" },
        text: text(TEXTS, "adm_b_delete", frame.lang()),
      })
    );
    const note = el("p", { cls: "msg-text grow", attrs: { role: "alert" } });
    button.addEventListener("click", async () => {
      frame.clear(note);
      button.disabled = true;
      const token = await reauthToken(
        password.value,
        "user_delete",
        code.value.replace(/\s+/g, "").toUpperCase(),
      );
      if (!token.ok) {
        button.disabled = false;
        if (token.code === "totp_required") code.hidden = false;
        else password.value = "";
        frame.say(note, errorKey(token.code));
        return;
      }
      const done = await call(
        "POST",
        `/api/admin/users/${encodeURIComponent(r.user_id)}/delete`,
        {},
        { reauth: token.token },
      );
      button.disabled = false;
      password.value = "";
      code.value = "";
      if (!done.ok) {
        frame.say(note, errorKey(done.code));
        return;
      }
      await load();
    });
    return el("li", { cls: "row" }, [
      el("span", { cls: "grow" }, [
        el("b", { text: r.name }),
        " ",
        el("span", { cls: "fine wrap-any", text: r.email }),
      ]),
      el("span", { cls: "fine grow" }, [
        el("span", {
          cls: "lbl",
          attrs: { "data-t": "adm_f_requested" },
          text: text(TEXTS, "adm_f_requested", frame.lang()),
        }),
        " ",
        el("span", {
          cls: "when num",
          text: formatDateTime(Date.parse(r.requested_at)),
        }),
      ]),
      password,
      code,
      button,
      note,
    ]);
  };

  const load = async () => {
    const result = await call("GET", "/api/admin/deletion-requests");
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    const requests = Array.isArray(result.body.requests)
      ? result.body.requests
      : [];
    byId("empty").hidden = requests.length > 0;
    byId("list").replaceChildren(...requests.map(row));
  };

  me().then(async (mine) => {
    if (!mine.ok || mine.body.platform_admin !== true) {
      byId("gate").hidden = false;
      return;
    }
    byId("app").hidden = false;
    await load();
  });
}

start(document);
