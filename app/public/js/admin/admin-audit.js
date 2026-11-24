// The page script of the audit log (the code design M2PROJ, 4.9.2): GET /api/admin/audit?after=<id> answers
// up to 50 rows after that id in id order and the id to ask next (or null). Each row shows its id, its time in
// the Kazakhstan format, the kind of the actor, the action and the target; «Ещё» loads the next page. The rows
// hold no e-mail, name or address, so the page shows none. A caller who is not the platform admin sees the
// text of not_found.

import { formatDateTime } from "../../shared/format/kz.js";
import { call, errorKey, me, mountFrame } from "../api.js";
import { el } from "../dom.js";

/**
 * @param {Document} doc
 * @returns {void}
 */
function start(doc) {
  const frame = mountFrame(doc);
  const byId = (/** @type {string} */ id) =>
    /** @type {HTMLElement} */ (doc.getElementById(id));
  const rows = byId("rows");
  const more = /** @type {HTMLButtonElement} */ (byId("more"));
  const err = byId("err");
  /**
   * the id to ask next, or null when there is no more
   * @type {number | string | null}
   */
  let next = null;
  let shown = 0;

  /**
   * @param {any} r
   * @returns {HTMLElement}
   */
  const row = (r) => {
    const target =
      r.target_kind === null
        ? ""
        : ` ${String(r.target_kind)}:${String(r.target_id ?? "")}`;
    return el("li", {}, [
      el("span", { cls: "fine num", text: `#${String(r.id)}` }),
      el("span", {
        cls: "fine num",
        text: formatDateTime(Date.parse(r.created_at)),
      }),
      el("span", { cls: "fine", text: String(r.actor_kind) }),
      el("span", { cls: "grow", text: `${String(r.action)}${target}` }),
    ]);
  };

  const load = async () => {
    more.disabled = true;
    const result = await call("GET", `/api/admin/audit?after=${next ?? 0}`);
    more.disabled = false;
    if (!result.ok) {
      frame.say(err, errorKey(result.code));
      return;
    }
    const page = Array.isArray(result.body.rows) ? result.body.rows : [];
    rows.append(...page.map(row));
    shown += page.length;
    next = result.body.next ?? null;
    more.hidden = next === null;
    byId("empty").hidden = shown > 0;
  };

  me().then(async (mine) => {
    if (!mine.ok || mine.body.platform_admin !== true) {
      byId("gate").hidden = false;
      return;
    }
    byId("app").hidden = false;
    await load();
  });

  more.addEventListener("click", load);
}

start(document);
