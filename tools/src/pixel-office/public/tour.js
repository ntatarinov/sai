// The invitation in the header and the tour of the page (REQ-052, design
// REQ-050-053 3.4). The tour never opens by itself: the header offers it, and
// "Показать" opens it. The caption of a step is not a window: no backdrop, no
// trap of the focus, presses on the page work and do not close it. This is the
// only module that touches the storage of the browser (decision 0061, item 3):
// one key, one value, every call inside try with catch.

import {
  TOUR_BACK,
  TOUR_CLOSE,
  TOUR_INVITE,
  TOUR_INVITE_LABEL,
  TOUR_INVITE_LATER,
  TOUR_INVITE_SHOW,
  TOUR_LAST,
  TOUR_LATER_CLOSE,
  TOUR_LATER_NOTE,
  TOUR_NEXT,
  TOUR_SKIP,
  TOUR_STEP,
  TOUR_STEPS,
} from "./texts.js";
import { tourStepView, within } from "./guide-model.js";

const TOUR_KEY = "pixel-office-tour";
const TOUR_CLOSED = "closed";
// The line about the tour after "Не сейчас" stays this long.
const TOUR_LATER_MS = 10000;

// The buttons of the caption by their name in a step view.
const BUTTONS = Object.freeze([
  ["back", TOUR_BACK],
  ["skip", TOUR_SKIP],
  ["next", TOUR_NEXT],
  ["last", TOUR_LAST],
]);

// deps: {document, storageFn, facts, targets, focusAfter, beforeOpen,
// onLayout, setTimeoutFn, clearTimeoutFn}. onLayout is called after the
// invitation or the line about the tour is shown or removed (the header
// changed its width).
export function createTour(deps) {
  const { document, storageFn } = deps;
  let invite = null;
  let box = null;
  // The line "Тур можно открыть позже…" (a live region, empty when hidden)
  // and the timer that empties it.
  let later = null;
  let laterTimer = null;
  let countEl = null;
  let titleEl = null;
  let textEl = null;
  let closeX = null;
  const buttons = new Map();
  let step = null;
  let marked = null;
  let offered = false;
  // Closed on this page: without a storage the invitation does not come back
  // before the page is loaded again.
  let dismissed = false;

  // The storage, or null when there is none or it cannot be had.
  function storage() {
    if (typeof storageFn !== "function") return null;
    try {
      return storageFn() ?? null;
    } catch {
      return null;
    }
  }

  function readClosed() {
    const store = storage();
    if (store === null) return false;
    try {
      return store.getItem(TOUR_KEY) === TOUR_CLOSED;
    } catch {
      return false;
    }
  }

  // The tour was closed: remembered on this page and in the storage; the
  // invitation goes away.
  function writeClosed() {
    dismissed = true;
    const store = storage();
    if (store !== null) {
      try {
        store.setItem(TOUR_KEY, TOUR_CLOSED);
      } catch {
        // Without a storage the tour is remembered only on this page.
      }
    }
    hideInvite();
  }

  function layout() {
    if (typeof deps.onLayout === "function") deps.onLayout();
  }

  function hideInvite() {
    if (!invite || invite.hidden) return;
    const focusWasInside = within(document.activeElement, invite);
    invite.hidden = true;
    layout();
    if (focusWasInside) deps.focusAfter()?.focus();
  }

  // Empties the line about the tour and stops its timer.
  function clearLater() {
    if (laterTimer !== null && typeof deps.clearTimeoutFn === "function") {
      deps.clearTimeoutFn(laterTimer);
    }
    laterTimer = null;
    if (!later || later.children.length === 0) return;
    later.replaceChildren();
    layout();
  }

  // The line about the tour, in place of the invitation (design D20): the
  // text and "×"; it goes away by "×" or after TOUR_LATER_MS. Without a timer
  // function it stays until "×".
  function showLater() {
    if (!later) return;
    clearLater();
    const close = button(["tour-later-x"], "×");
    close.setAttribute("aria-label", TOUR_LATER_CLOSE);
    close.addEventListener("click", () => {
      clearLater();
      deps.focusAfter()?.focus();
    });
    later.replaceChildren(
      make("span", ["tour-later-text"], TOUR_LATER_NOTE),
      close,
    );
    layout();
    if (typeof deps.setTimeoutFn === "function") {
      laterTimer = deps.setTimeoutFn(() => {
        laterTimer = null;
        const focusWasInside = within(document.activeElement, later);
        clearLater();
        if (focusWasInside) deps.focusAfter()?.focus();
      }, TOUR_LATER_MS);
    }
  }

  function make(tag, classNames, text) {
    const el = document.createElement(tag);
    for (const name of classNames) el.classList.add(name);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function button(classNames, text) {
    const el = make("button", classNames, text);
    el.setAttribute("type", "button");
    return el;
  }

  function unmark() {
    if (marked !== null) marked.removeAttribute("data-tour-target");
    marked = null;
  }

  function scrollTo(el) {
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }

  // Shows the current step; scroll: the target is scrolled into view even if
  // it is the one marked already (a press of "Далее", "Назад", the opening).
  function show(scroll) {
    const view = tourStepView(step, deps.facts());
    if (view === null || !box) return;
    box.setAttribute("data-step", String(view.step));
    countEl.textContent = TOUR_STEP.replace("{n}", String(view.step)).replace(
      "{N}",
      String(TOUR_STEPS.length),
    );
    titleEl.textContent = view.title;
    textEl.textContent = view.text;
    for (const [name, el] of buttons) {
      el.hidden = !view.buttons.includes(name);
    }
    const el =
      view.target === null ? null : (deps.targets()[view.target] ?? null);
    if (el !== marked) {
      unmark();
      if (el !== null) {
        el.setAttribute("data-tour-target", "true");
        marked = el;
        scrollTo(el);
      }
    } else if (scroll && el !== null) {
      scrollTo(el);
    }
  }

  function go(delta, pressed) {
    if (step === null) return;
    const next = step + delta;
    if (next < 1 || next > TOUR_STEPS.length) return;
    step = next;
    show(true);
    const nextButton = buttons.get("next");
    let focus = buttons.get("last");
    if (!pressed.hidden) focus = pressed;
    else if (!nextButton.hidden) focus = nextButton;
    focus.focus();
  }

  const api = {
    mount(places) {
      invite = places.invite ?? null;
      box = places.box ?? null;
      later = places.later ?? null;
      if (invite) {
        invite.setAttribute("role", "region");
        invite.setAttribute("aria-label", TOUR_INVITE_LABEL);
        const text = document.getElementById("tour-invite-text");
        const showButton = document.getElementById("tour-invite-show");
        const later = document.getElementById("tour-invite-later");
        if (text) text.textContent = TOUR_INVITE;
        if (showButton) {
          showButton.textContent = TOUR_INVITE_SHOW;
          showButton.addEventListener("click", () => api.open());
        }
        if (later) {
          later.textContent = TOUR_INVITE_LATER;
          later.addEventListener("click", () => api.dismissInvite());
        }
      }
      if (box) {
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "false");
        box.setAttribute("aria-labelledby", "tour-title");
        box.setAttribute("aria-describedby", "tour-text");
        closeX = button(["tour-x"], "×");
        closeX.setAttribute("aria-label", TOUR_CLOSE);
        closeX.addEventListener("click", () => api.close());
        const live = make("div", ["tour-live"]);
        live.setAttribute("aria-live", "polite");
        countEl = make("span", ["tour-count"]);
        titleEl = make("h2", ["tour-title"]);
        titleEl.setAttribute("id", "tour-title");
        textEl = make("p", ["tour-text"]);
        textEl.setAttribute("id", "tour-text");
        live.appendChild(countEl);
        live.appendChild(titleEl);
        live.appendChild(textEl);
        const row = make("div", ["tour-buttons"]);
        for (const [name, caption] of BUTTONS) {
          const classes = ["ctl"];
          if (name === "next" || name === "last") classes.push("ctl-primary");
          const el = button(classes, caption);
          el.setAttribute("data-tour", name);
          if (name === "back") el.addEventListener("click", () => go(-1, el));
          else if (name === "next")
            el.addEventListener("click", () => go(1, el));
          else el.addEventListener("click", () => api.close());
          buttons.set(name, el);
          row.appendChild(el);
        }
        box.replaceChildren(closeX, live, row);
      }
    },

    // The invitation is offered once a load of the page, at the first result
    // of the link; the focus is not touched.
    offer() {
      if (offered) return;
      offered = true;
      if (!invite || dismissed || step !== null || readClosed()) return;
      invite.hidden = false;
      layout();
    },

    open() {
      if (!box) return;
      deps.beforeOpen();
      dismissed = true;
      // The tour and the line about it are not seen together.
      clearLater();
      hideInvite();
      box.hidden = false;
      step = 1;
      show(true);
      buttons.get("next")?.focus();
    },

    close() {
      if (step === null) return;
      const focusWasInside = within(document.activeElement, box);
      step = null;
      unmark();
      box.hidden = true;
      writeClosed();
      if (focusWasInside) deps.focusAfter()?.focus();
    },

    // "Не сейчас" or Escape in the invitation: remembered; in its place the
    // line about the tour; the focus goes to "Как пользоваться".
    dismissInvite() {
      const wasShown = invite !== null && !invite.hidden;
      writeClosed();
      if (wasShown) {
        showLater();
        deps.focusAfter()?.focus();
      }
    },

    refresh() {
      if (step !== null) show(false);
    },

    isOpen: () => step !== null,
    step: () => step,
    holds: (node) => step !== null && within(node, box),
    inviteShown: () => invite !== null && !invite.hidden,
    inviteHolds: (node) =>
      invite !== null && !invite.hidden && within(node, invite),
  };
  return api;
}
