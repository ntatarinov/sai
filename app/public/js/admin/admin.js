// The page script of the request board (the code design M2PROJ, 4.9.2): GET /api/admin/requests answers the
// eleven stages with their true counts and the newest projects of each; the page shows one block per stage
// (the first stage under the name «Новые») with its count in the Kazakhstan number format and its projects
// linking to the request card. A caller who is not the platform admin sees the text of not_found.

import { TEXTS } from "../../shared/i18n/texts.js";
import { formatDateTime, formatNumber } from "../../shared/format/kz.js";
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
  const err = byId("err");

  /**
   * One project of a block.
   * @param {{ id: string, title: string, org_name: string, updated_at: string }} p
   * @returns {HTMLElement}
   */
  const row = (p) =>
    el("li", {}, [
      el("a", {
        cls: "lnk",
        attrs: { href: `/admin-request.html?id=${encodeURIComponent(p.id)}` },
        text: p.title,
      }),
      el("span", { cls: "fine", text: p.org_name }),
      el("span", {
        cls: "fine num",
        text: formatDateTime(Date.parse(p.updated_at)),
      }),
    ]);

  /**
   * One block of the board.
   * @param {{ stage: string, count: number, projects: any[] }} s
   * @returns {HTMLElement}
   */
  const block = (s) => {
    const key = s.stage === "draft" ? "board_new" : `stage_${s.stage}`;
    const heading = el("h2", {}, [
      el("span", {
        attrs: { "data-t": key },
        text: text(TEXTS, key, frame.lang()),
      }),
      el("span", { cls: "count num", text: formatNumber(s.count) }),
    ]);
    return el("section", { cls: "col", attrs: { "data-stage": s.stage } }, [
      heading,
      el("ul", { cls: "rows" }, s.projects.map(row)),
    ]);
  };

  me().then(async (mine) => {
    if (!mine.ok || mine.body.platform_admin !== true) {
      byId("gate").hidden = false;
      return;
    }
    byId("app").hidden = false;
    const result = await call("GET", "/api/admin/requests");
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    const stages = Array.isArray(result.body.stages) ? result.body.stages : [];
    byId("board").replaceChildren(...stages.map(block));
  });
}

start(document);
