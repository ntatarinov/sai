// The guide "Как пользоваться" (REQ-050, design REQ-050-053 3.3): the button
// of the header and the panel next to the page — a band at the right edge in
// the wide layout, a sheet at the bottom elsewhere (style.css). The panel is
// not a window: no backdrop, no trap of the focus, the page next to it keeps
// working. Every text is put in as text (textContent) or as an attribute.

import {
  GUIDE_CLOSE,
  GUIDE_CLOSE_TEXT,
  GUIDE_LEAD,
  GUIDE_MARK,
  GUIDE_OPEN,
  GUIDE_TITLE,
  GUIDE_TOC,
  GUIDE_TOUR_START,
} from "./texts.js";
import { within } from "./guide-model.js";

const ROLE_SEPARATOR = " — ";

function make(document, tag, classNames, text) {
  const el = document.createElement(tag);
  for (const name of classNames) el.classList.add(name);
  if (text !== undefined) el.textContent = text;
  return el;
}

function button(document, classNames, text) {
  const el = make(document, "button", classNames, text);
  el.setAttribute("type", "button");
  return el;
}

// An item of a group of roles, "<name> — <description>": the name in its own
// span (it is shown bolder), the rest after it; the text of the item stays the
// same string.
function roleItem(document, item) {
  const li = make(document, "li", []);
  const at = item.indexOf(ROLE_SEPARATOR);
  if (at <= 0) {
    li.textContent = item;
    return li;
  }
  li.appendChild(
    make(document, "span", ["guide-role-name"], item.slice(0, at)),
  );
  li.appendChild(make(document, "span", [], item.slice(at)));
  return li;
}

// One block of a section: a paragraph, a list, a list of pairs or groups of
// items under their own small headings.
function blockElements(document, block) {
  if (block.kind === "p") return [make(document, "p", [], block.text)];
  if (block.kind === "ul" || block.kind === "ol") {
    const list = make(document, block.kind, []);
    for (const item of block.items) {
      list.appendChild(make(document, "li", [], item));
    }
    return [list];
  }
  if (block.kind === "dl") {
    const list = make(document, "dl", []);
    for (const [term, meaning] of block.pairs) {
      list.appendChild(make(document, "dt", [], term));
      list.appendChild(make(document, "dd", [], meaning));
    }
    return [list];
  }
  if (block.kind === "groups") {
    const out = [];
    for (const group of block.groups) {
      out.push(make(document, "h4", [], group.title));
      const list = make(document, "ul", []);
      for (const item of group.items)
        list.appendChild(roleItem(document, item));
      out.push(list);
    }
    return out;
  }
  return [];
}

// The table of contents and the sections: a button of the table per section
// (its click calls onToc(key)) and a section with its heading and blocks.
export function renderGuideSections(document, sections, onToc) {
  const nav = make(document, "nav", ["guide-toc"]);
  nav.setAttribute("aria-label", GUIDE_TOC);
  nav.appendChild(make(document, "h3", [], GUIDE_TOC));
  const out = [];
  const headings = new Map();
  for (const section of sections) {
    const tocButton = button(document, ["guide-toc-btn"], section.title);
    tocButton.setAttribute("data-section", section.key);
    tocButton.addEventListener("click", () => onToc(section.key));
    nav.appendChild(tocButton);
    const box = make(document, "section", ["guide-section"]);
    box.setAttribute("data-section", section.key);
    const heading = make(document, "h3", [], section.title);
    heading.setAttribute("tabindex", "-1");
    box.appendChild(heading);
    for (const block of section.blocks) {
      for (const el of blockElements(document, block)) box.appendChild(el);
    }
    out.push(box);
    headings.set(section.key, heading);
  }
  return { nav, sections: out, headings };
}

// deps: {document, sections, canOpen, beforeOpen, onLayout, onTourStart,
// openerElement}.
export function createGuide(deps) {
  const { document } = deps;
  let openButton = null;
  let aside = null;
  let page = null;
  let body = null;
  let title = null;
  let headings = new Map();
  let built = false;
  let shown = false;
  // What opened the guide: {kind: "header"} or {kind: "empty"}.
  let opener = null;

  function onToc(key) {
    const heading = headings.get(key);
    if (!heading) return;
    if (typeof heading.scrollIntoView === "function") {
      heading.scrollIntoView({ block: "start" });
    }
    heading.focus({ preventScroll: true });
  }

  // The content is built once, at the first opening, and stays.
  function build() {
    built = true;
    const head = make(document, "div", ["guide-head"]);
    title = make(document, "h2", [], GUIDE_TITLE);
    title.setAttribute("id", "guide-title");
    title.setAttribute("tabindex", "-1");
    const close = button(document, ["ctl", "guide-close"], GUIDE_CLOSE_TEXT);
    close.setAttribute("aria-label", GUIDE_CLOSE);
    close.addEventListener("click", () => api.close());
    head.appendChild(title);
    head.appendChild(close);
    body = make(document, "div", ["guide-body"]);
    body.appendChild(make(document, "p", ["guide-lead"], GUIDE_LEAD));
    const tourButton = button(
      document,
      ["ctl", "guide-tour-start"],
      GUIDE_TOUR_START,
    );
    tourButton.addEventListener("click", () => deps.onTourStart());
    body.appendChild(tourButton);
    const parts = renderGuideSections(document, deps.sections(), onToc);
    headings = parts.headings;
    body.appendChild(parts.nav);
    for (const section of parts.sections) body.appendChild(section);
    aside.replaceChildren(head, body);
  }

  const api = {
    mount(places) {
      openButton = places.button ?? null;
      aside = places.aside ?? null;
      page = places.page ?? null;
      if (openButton) {
        for (const child of Array.from(openButton.children ?? [])) {
          if (child.classList.contains("guide-mark")) {
            child.textContent = GUIDE_MARK;
          } else if (child.classList.contains("guide-open-text")) {
            child.textContent = GUIDE_OPEN;
          }
        }
        openButton.setAttribute("aria-label", GUIDE_OPEN);
        openButton.setAttribute("aria-expanded", "false");
        openButton.addEventListener("click", () =>
          api.toggle({ kind: "header" }),
        );
      }
    },

    open(from) {
      if (shown || !aside || !deps.canOpen()) return false;
      deps.beforeOpen();
      if (!built) build();
      opener = from ?? { kind: "header" };
      shown = true;
      aside.hidden = false;
      if (body) body.scrollTop = 0;
      page?.setAttribute("data-guide", "open");
      openButton?.setAttribute("aria-expanded", "true");
      deps.onLayout();
      title?.focus();
      return true;
    },

    close() {
      if (!shown) return;
      const focusWasInside = within(document.activeElement, aside);
      shown = false;
      aside.hidden = true;
      page?.removeAttribute("data-guide");
      openButton?.setAttribute("aria-expanded", "false");
      deps.onLayout();
      if (focusWasInside) {
        const back = deps.openerElement(opener) ?? openButton;
        back?.focus();
      }
    },

    toggle(from) {
      if (shown) api.close();
      else api.open(from);
    },

    isOpen: () => shown,

    holds: (node) => shown && within(node, aside),
  };
  return api;
}
