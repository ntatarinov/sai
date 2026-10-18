// The buttons "?" next to four parts of the page and their hints (REQ-053,
// design REQ-050-053 3.5). A hint opens on the mouse or the focus and closes
// when they leave; a press pins it, a second press, a press elsewhere or
// Escape closes it. Not more than one hint is open. A hint is not a window: a
// press elsewhere also works on the page as usual. Every text is put in as
// text or as an attribute.

import {
  HINTS,
  HINT_CLOSE,
  HINT_LABEL,
  HINT_MARK,
  HINT_NAMES,
} from "./texts.js";
import { within } from "./guide-model.js";

export const HINT_KEYS = Object.freeze(["now", "journal", "tasks", "office"]);

export function createHints(deps) {
  const { document } = deps;
  const buttons = new Map();
  const tips = new Map();
  let openKey = null;
  let pinned = false;

  function make(tag, className, text) {
    const el = document.createElement(tag);
    el.classList.add(className);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // hidden and data-pinned of every hint by the state.
  function sync() {
    for (const key of buttons.keys()) {
      const open = key === openKey;
      tips.get(key).hidden = !open;
      buttons
        .get(key)
        .setAttribute("data-pinned", open && pinned ? "true" : "false");
    }
  }

  const api = {
    // places: key → function (button, tip) that puts them into the page.
    mount(places) {
      for (const key of HINT_KEYS) {
        const place = places[key];
        if (typeof place !== "function" || buttons.has(key)) continue;
        const button = make("button", "hint-btn", HINT_MARK);
        button.setAttribute("type", "button");
        button.setAttribute(
          "aria-label",
          HINT_LABEL.replace("{name}", HINT_NAMES[key]),
        );
        button.setAttribute("aria-describedby", `hint-${key}`);
        button.setAttribute("data-pinned", "false");
        const tip = make("div", "hint-tip");
        tip.setAttribute("id", `hint-${key}`);
        tip.setAttribute("role", "tooltip");
        tip.hidden = true;
        tip.appendChild(make("p", "hint-text", HINTS[key]));
        tip.appendChild(make("p", "hint-close", HINT_CLOSE));
        // Hovering opens and closes a hint only for a mouse (design D21): a
        // touch also sends mouseenter before its click, and the hint would lie
        // over its own button. No pointer type known (an old browser) counts
        // as a mouse.
        let pointer = null;
        const byMouse = () => pointer === null || pointer === "mouse";
        const remember = (event) => {
          const type = event?.pointerType;
          pointer = typeof type === "string" && type !== "" ? type : null;
        };
        button.addEventListener("pointerenter", remember);
        button.addEventListener("pointerdown", remember);
        const leave = () => {
          if (openKey === key && !pinned) api.close();
        };
        button.addEventListener("mouseenter", () => {
          if (byMouse() && openKey !== key) api.open(key, false);
        });
        button.addEventListener("focus", () => {
          if (openKey !== key) api.open(key, false);
        });
        button.addEventListener("mouseleave", () => {
          if (byMouse()) leave();
        });
        button.addEventListener("blur", leave);
        button.addEventListener("click", () => {
          if (openKey === key && pinned) api.close();
          else api.open(key, true);
        });
        buttons.set(key, button);
        tips.set(key, tip);
        place(button, tip);
      }
      // A press outside the pinned hint and its button closes it; the press
      // itself goes on as usual.
      document.addEventListener("click", (event) => {
        if (openKey === null || !pinned) return;
        const target = event?.target ?? null;
        if (within(target, buttons.get(openKey))) return;
        if (within(target, tips.get(openKey))) return;
        api.close();
      });
    },

    open(key, pin) {
      if (!buttons.has(key)) return;
      openKey = key;
      pinned = pin === true;
      sync();
    },

    // Closes the open hint; the focus is not touched.
    close() {
      openKey = null;
      pinned = false;
      sync();
    },

    isOpen: () => openKey !== null,
    openKey: () => openKey,
    button: (key) => buttons.get(key) ?? null,
  };
  return api;
}
