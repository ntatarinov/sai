// The screen of the result. For now it only says that the result will come to this
// page, and gives the two ways back; the real screen replaces this file as a whole.
import { part } from "./dom.js";

// renderResult(ctx) -> { node, focus }. ctx is { lang, name, result, answers,
// questionnaire, say(key, values), head, onEdit(), onRestart() }: `result` is the body
// of the answer as it came, `answers` are the answers that were sent, `head` is the
// node of the header of the page (the name of the tenant) that stays on the screen.
// `node` is the panel of the screen, `focus` is the node that gets the focus.
export function renderResult(ctx) {
  const title = part(
    "h2",
    "result-title",
    { tabindex: "-1" },
    ctx.say("result_soon"),
  );
  const edit = part(
    "button",
    "edit",
    { type: "button", "data-action": "edit" },
    ctx.say("quiz_back"),
  );
  const restart = part(
    "button",
    "restart",
    { type: "button", "data-action": "restart" },
    ctx.say("card_restart"),
  );
  edit.addEventListener("click", () => ctx.onEdit());
  restart.addEventListener("click", () => ctx.onRestart());
  const node = part(
    "div",
    "panel",
    { "data-screen": "result" },
    ctx.head,
    title,
    part("div", "actions", null, edit, restart),
  );
  return { node, focus: title };
}
