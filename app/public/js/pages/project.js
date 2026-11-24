// The page script of the project page (the code design M2PROJ, 4.9.2): GET /api/projects/<id> answers the
// title, the stage, the three quick facts and every version of the idea; the page shows the stage strip (the
// current stage marked, the earlier ones done), the facts and the versions with their reason, author and time
// in the Kazakhstan format. A person who may write sees the form that adds a new version with its reason
// (POST /api/projects/<id>/idea); a viewer sees none. The id comes from ?id=; anything but a uuid shows the
// text of not_found.

import { TEXTS } from "../../shared/i18n/texts.js";
import { formatDateTime } from "../../shared/format/kz.js";
import { STAGES } from "../../shared/project/stages.js";
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
  if (id === null || !UUID.test(id)) {
    frame.say(err, errorKey("not_found"));
    return;
  }

  /** A span whose text is the key's text and follows the language. */
  const keyed = (/** @type {string} */ key, cls = "") =>
    el("span", {
      cls,
      attrs: { "data-t": key },
      text: text(TEXTS, key, frame.lang()),
    });

  /**
   * @param {any} project
   * @returns {void}
   */
  const render = (project) => {
    byId("title").textContent = String(project.title);
    const at = STAGES.indexOf(project.stage);
    byId("strip").replaceChildren(
      ...STAGES.map((stage, i) => {
        const key = `stage_${stage}`;
        const li = el("li", {
          cls: i < at ? "done" : "",
          attrs: { "data-stage": stage, "data-t": key },
          text: text(TEXTS, key, frame.lang()),
        });
        if (i === at) li.setAttribute("aria-current", "step");
        return li;
      }),
    );
    byId("facts").replaceChildren(
      ...QUICK_KEYS.map((key) => {
        const value = String(project.quick_facts?.[key] ?? "");
        return el("div", { cls: "fact" }, [
          keyed(`qf_${key}_label`, "lbl"),
          keyed(`qf_${key}_${value}`),
        ]);
      }),
    );
    byId("versions").replaceChildren(
      ...project.versions.map((/** @type {any} */ v) => {
        const label = el("b");
        frame.say(label, "prj_version", { n: String(v.version) });
        const li = el("li", {}, [
          label,
          el(
            "span",
            { cls: "fine num" },
            v.author.platform === true
              ? [
                  keyed("prj_author_platform"),
                  `, ${formatDateTime(Date.parse(v.created_at))}`,
                ]
              : [
                  `${String(v.author.name)}, ${formatDateTime(Date.parse(v.created_at))}`,
                ],
          ),
          el("p", { cls: "pre", text: String(v.text) }),
        ]);
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
    const newest = project.versions[project.versions.length - 1];
    field("edit-text").value = newest === undefined ? "" : String(newest.text);
  };

  const load = async () => {
    const result = await call("GET", `/api/projects/${id}`);
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return false;
    }
    render(result.body);
    return true;
  };

  me().then(async (mine) => {
    if (!mine.ok) {
      byId("gate").hidden = false;
      return;
    }
    const member = Array.isArray(mine.body.memberships)
      ? mine.body.memberships[0]
      : undefined;
    form.hidden = member !== undefined && member.role === "viewer";
    if (await load()) byId("app").hidden = false;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    frame.clear(err);
    submit.disabled = true;
    const result = await call("POST", `/api/projects/${id}/idea`, {
      text: field("edit-text").value,
      reason: field("edit-reason").value,
    });
    submit.disabled = false;
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    field("edit-reason").value = "";
    await load();
  });
}

start(document, window);
