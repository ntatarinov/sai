// The page script of the new-project page (the code design M2PROJ, 4.9.2): a title, the idea in the person's
// own words and three quick facts, each chosen by one tap from the closed sets of shared/project/quick-facts.js
// (the «not known yet» option stands on the first two). «Создать» sends POST /api/projects and opens the page
// of the new project. A fact left untouched is refused here with a plain text; the server checks the sets again.

import { OPTIONS, QUICK_KEYS } from "../../shared/project/quick-facts.js";
import { TEXTS } from "../../shared/i18n/texts.js";
import { call, errorKey, me, mountFrame } from "../api.js";
import { el, text } from "../dom.js";

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
  const submit = /** @type {HTMLButtonElement} */ (byId("create"));
  const err = byId("err");
  /** @type {Record<string, string | null>} */
  const chosen = { what: null, whom: null, lang: null };

  /**
   * Marks one option of a group as the chosen one.
   * @param {string} key
   * @param {string} id
   * @returns {void}
   */
  const choose = (key, id) => {
    chosen[key] = id;
    for (const b of byId(`qf-${key}`).querySelectorAll("[data-option]"))
      b.setAttribute(
        "aria-checked",
        String(b.getAttribute("data-option") === id),
      );
  };

  for (const key of QUICK_KEYS) {
    const group = byId(`qf-${key}`);
    const ids = /** @type {readonly string[]} */ (
      OPTIONS[/** @type {"what" | "whom" | "lang"} */ (key)]
    );
    group.replaceChildren(
      ...ids.map((id) => {
        const textKey = `qf_${key}_${id}`;
        const button = el("button", {
          cls: "opt",
          attrs: {
            type: "button",
            role: "radio",
            "aria-checked": "false",
            "data-option": id,
            "data-t": textKey,
          },
          text: text(TEXTS, textKey, frame.lang()),
        });
        button.addEventListener("click", () => choose(key, id));
        return button;
      }),
    );
  }
  choose("lang", frame.lang() === "en" ? "en" : "ru");

  me().then((mine) => {
    if (!mine.ok) {
      byId("gate").hidden = false;
      return;
    }
    byId("app").hidden = false;
  });

  byId("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    if (QUICK_KEYS.some((key) => chosen[key] === null)) {
      frame.say(err, "prj_err_facts");
      return;
    }
    submit.disabled = true;
    const result = await call("POST", "/api/projects", {
      title: field("title").value.trim(),
      idea: field("idea").value,
      what: chosen.what,
      whom: chosen.whom,
      lang: chosen.lang,
    });
    submit.disabled = false;
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    win.location.assign(
      `/project.html?id=${encodeURIComponent(String(result.body.id))}`,
    );
  });
}

start(document, window);
