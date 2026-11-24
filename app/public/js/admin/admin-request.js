// The page script of the request card (the code design M2PROJ, 4.9.2): GET /api/admin/projects/<id> answers
// the card (every load writes one audit row on the server): the title, the organisation, the stage, the
// quick facts and every idea version with its reason, author and time in the Kazakhstan format. «Изменить
// заявку» opens the form whose text is the newest version; the form sends POST /api/admin/projects/<id>/idea
// with the text and the reason («Почему»), and the card is read again. The id comes from ?id=; a caller who is
// not the platform admin sees the text of not_found.

import { TEXTS } from "../../shared/i18n/texts.js";
import { formatDateTime } from "../../shared/format/kz.js";
import { QUICK_KEYS } from "../../shared/project/quick-facts.js";
import { call, errorKey, me, mountFrame } from "../api.js";
import { el, text } from "../dom.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * @param {Document} doc
 * @param {Window} win
 * @returns {void}
 */
function start(doc, win) {
  const frame = mountFrame(doc);
  const byId = (/** @type {string} */ id) =>
    /** @type {HTMLElement} */ (doc.getElementById(id));
  const field = (/** @type {string} */ id) =>
    /** @type {HTMLInputElement} */ (doc.getElementById(id));
  const err = byId("err");
  const form = /** @type {HTMLFormElement} */ (byId("edit-form"));
  const submit = /** @type {HTMLButtonElement} */ (byId("edit-submit"));
  const id = new URLSearchParams(win.location.search).get("id");

  /** A span whose text is the key's text and follows the language. */
  const keyed = (/** @type {string} */ key, cls = "") =>
    el("span", {
      cls,
      attrs: { "data-t": key },
      text: text(TEXTS, key, frame.lang()),
    });

  /**
   * @param {any} card
   * @returns {void}
   */
  const render = (card) => {
    byId("title").textContent = String(card.title);
    byId("org").textContent = String(card.org.name);
    frame.say(byId("stage"), `stage_${String(card.stage)}`);
    byId("created").textContent = formatDateTime(Date.parse(card.created_at));
    byId("updated").textContent = formatDateTime(Date.parse(card.updated_at));
    byId("facts").replaceChildren(
      ...QUICK_KEYS.map((key) => {
        const value = String(card.quick_facts?.[key] ?? "");
        return el("div", { cls: "fact" }, [
          keyed(`qf_${key}_label`, "lbl"),
          keyed(`qf_${key}_${value}`),
        ]);
      }),
    );
    byId("versions").replaceChildren(
      ...card.versions.map((/** @type {any} */ v) => {
        const label = el("b");
        frame.say(label, "prj_version", { n: String(v.version) });
        const who = el("span", {
          cls: "fine num",
          text: `${String(v.author.name)}, ${formatDateTime(Date.parse(v.created_at))}`,
        });
        const li = el("li", {}, [label, who]);
        if (v.author.admin === true) li.append(keyed("adm_admin_mark", "fine"));
        li.append(el("p", { cls: "pre", text: String(v.text) }));
        if (v.reason !== null)
          li.append(
            el("div", { cls: "fact grow" }, [
              keyed("prj_f_why", "lbl"),
              el("span", { text: String(v.reason) }),
            ]),
          );
        return li;
      }),
    );
    const newest = card.versions[card.versions.length - 1];
    field("edit-text").value = newest === undefined ? "" : String(newest.text);
  };

  const load = async () => {
    const result = await call("GET", `/api/admin/projects/${id}`);
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return false;
    }
    render(result.body);
    return true;
  };

  me().then(async (mine) => {
    if (!mine.ok || mine.body.platform_admin !== true) {
      byId("gate").hidden = false;
      return;
    }
    if (id === null || !UUID.test(id)) {
      frame.say(err, errorKey("not_found"));
      return;
    }
    if (await load()) byId("app").hidden = false;
  });

  byId("edit").addEventListener("click", () => {
    form.hidden = false;
    field("edit-reason").focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    submit.disabled = true;
    const result = await call("POST", `/api/admin/projects/${id}/idea`, {
      text: field("edit-text").value,
      reason: field("edit-reason").value,
    });
    submit.disabled = false;
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    field("edit-reason").value = "";
    form.hidden = true;
    await load();
  });
}

start(document, window);
