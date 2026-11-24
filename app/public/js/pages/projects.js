// The page script of the project list (the code design M2PROJ, 4.9.2): GET /api/projects answers the
// projects of the signed-in person's organisation; each row is a link to its page with the stage name and
// the time of the last change in the Kazakhstan format. A viewer does not see the «new project» button (the
// server refuses his create anyway). A caller with no session sees the text of auth_required.

import { TEXTS } from "../../shared/i18n/texts.js";
import { formatDateTime } from "../../shared/format/kz.js";
import { call, errorKey, me, mountFrame } from "../api.js";
import { el, text } from "../dom.js";

/**
 * @param {Document} doc
 * @returns {void}
 */
function start(doc) {
  const frame = mountFrame(doc);
  const byId = (/** @type {string} */ id) =>
    /** @type {HTMLElement} */ (doc.getElementById(id));
  const list = byId("list");
  const err = byId("err");

  /**
   * One row of the list.
   * @param {{ id: string, title: string, stage: string, updated_at: string }} p
   * @returns {HTMLElement}
   */
  const row = (p) => {
    const key = `stage_${p.stage}`;
    return el("li", {}, [
      el("a", {
        cls: "lnk",
        attrs: { href: `/project.html?id=${encodeURIComponent(p.id)}` },
        text: p.title,
      }),
      el("span", {
        cls: "fine",
        attrs: { "data-t": key },
        text: text(TEXTS, key, frame.lang()),
      }),
      el("span", {
        cls: "fine num",
        text: formatDateTime(Date.parse(p.updated_at)),
      }),
    ]);
  };

  me().then(async (mine) => {
    if (!mine.ok) {
      byId("gate").hidden = false;
      return;
    }
    const member = Array.isArray(mine.body.memberships)
      ? mine.body.memberships[0]
      : undefined;
    byId("new").hidden = member !== undefined && member.role === "viewer";
    byId("app").hidden = false;
    const result = await call("GET", "/api/projects");
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    const projects = Array.isArray(result.body.projects)
      ? result.body.projects
      : [];
    byId("empty").hidden = projects.length > 0;
    list.replaceChildren(...projects.map(row));
  });
}

start(document);
