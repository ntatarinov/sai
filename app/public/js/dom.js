// The page helpers of the public pages (the code design of the public landing, 4.5): elements made
// with document.createElement and texts set with textContent, the text of a key in a language, the
// texts of a page set from the texts module, the words of the stage scene, the row of the footer
// while the page is in Kazakh, the avatars of the people, the media queries of the pages and the one
// way to follow a change of them, the two one-word preferences of the reader's own browser, and the
// language switch. Each of these is written here once, for every page script and the stage. The
// module touches document, window, history and localStorage only inside its functions, so it loads
// in Node (the drawing it imports is pure).

import { drawAvatar, readPalette } from "../office/draw.js";
import { pickLang } from "../shared/i18n/lang.js";

/** @typedef {{ readonly [key: string]: { readonly [lang: string]: string } }} Texts */
/** @typedef {import("../office/stage-scene.js").Words} Words */
/** @typedef {Window & typeof globalThis} PageWindow the window of the page, with its classes */

/**
 * @typedef {object} ElOptions
 * @property {string} [cls] the class attribute
 * @property {string} [id]
 * @property {{ readonly [name: string]: string }} [attrs] other attributes, by name
 * @property {string} [text] the text, set with textContent
 */

/** The only keys of the browser storage the pages use: the language and the theme. */
const PREF_KEYS = Object.freeze(["sai-lang", "sai-theme"]);

/** A stored preference is one word of two to five small Latin letters. */
const PREF_VALUE = /^[a-z]{2,5}$/;

/** A placeholder of a text: a name of Latin letters and "_" in braces. */
const PLACEHOLDER = /\{([A-Za-z_]+)\}/g;

/** The media query of the system's dark setting, which «Авто» follows (the look 6.1). */
export const SYSTEM_DARK = "(prefers-color-scheme: dark)";

/** The media query of the reader's reduced motion (the look 10). */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The narrow rule of the stage height: the query of the phone block of the style sheet (the look 9.1). */
export const NARROW = "(max-width: 759px)";

/** The four desks of the scene, which are also the four steps of «how it works». */
export const DESKS = Object.freeze([1, 2, 3, 4]);

/**
 * The name in ASCII lower case: only A-Z change, as a browser compares attribute names.
 * @param {string} name
 * @returns {string}
 */
function asciiLower(name) {
  return name.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/**
 * An element made with document.createElement. An attribute name whose ASCII lower case is "style"
 * or begins with "on" is refused with an exception before the element is made, so no computed name
 * reaches setAttribute; the texts are set with textContent and the children are appended as nodes.
 * @param {string} tag
 * @param {ElOptions} [options]
 * @param {readonly (Node | string)[]} [children] a string child becomes a text node
 * @returns {HTMLElement}
 */
export function el(tag, options = {}, children = []) {
  const attrs = options.attrs ?? {};
  for (const name of Object.keys(attrs)) {
    const lower = asciiLower(name);
    if (lower === "style" || lower.startsWith("on"))
      throw new Error(`dom: the attribute ${JSON.stringify(name)} is refused`);
  }
  const node = document.createElement(tag);
  if (options.cls !== undefined) node.className = options.cls;
  if (options.id !== undefined) node.id = options.id;
  for (const [name, value] of Object.entries(attrs))
    node.setAttribute(name, value);
  if (options.text !== undefined) node.textContent = options.text;
  for (const child of children) node.append(child);
  return node;
}

/**
 * The template with every {name} placeholder replaced by its value; a placeholder with no value in
 * `values` stays as it is.
 * @param {string} template
 * @param {{ readonly [name: string]: string | number }} values
 * @returns {string}
 */
export function fill(template, values) {
  return template.replace(PLACEHOLDER, (whole, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
}

/**
 * The text of a key in a language: its value there, else its Russian value (the text of the static
 * page), else "" (also for a key the texts module does not hold). The one rule of the pages, the
 * theme button and the labels of the stage.
 * @param {Texts} texts
 * @param {string} key
 * @param {string} lang
 * @returns {string}
 */
export function text(texts, key, lang) {
  if (!Object.hasOwn(texts, key)) return "";
  const entry = texts[key];
  if (Object.hasOwn(entry, lang)) return entry[lang];
  return Object.hasOwn(entry, "ru") ? entry.ru : "";
}

/**
 * Sets the texts of a page, or of a part of it, in a language: the text of every element with
 * data-t, the accessible name (aria-label) of every element with data-t-aria, and the lang of the
 * root element. A key the texts module does not hold leaves its element as it is.
 * @param {Document | Element} root
 * @param {Texts} texts
 * @param {string} lang
 * @returns {void}
 */
export function applyTexts(root, texts, lang) {
  for (const node of root.querySelectorAll("[data-t]")) {
    const key = node.getAttribute("data-t");
    if (key !== null && Object.hasOwn(texts, key))
      node.textContent = text(texts, key, lang);
  }
  for (const node of root.querySelectorAll("[data-t-aria]")) {
    const key = node.getAttribute("data-t-aria");
    if (key !== null && Object.hasOwn(texts, key))
      node.setAttribute("aria-label", text(texts, key, lang));
  }
  const doc = "documentElement" in root ? root : root.ownerDocument;
  doc.documentElement.lang = lang;
}

/**
 * The words of the stage scene in a language (the code design 4.6): the four stage words, the four
 * role titles, the visitor's label and the two lines of the door sign.
 * @param {Texts} texts
 * @param {string} lang
 * @returns {Words}
 */
export function wordsFor(texts, lang) {
  return {
    stages: DESKS.map((n) => text(texts, `stage_${n}`, lang)),
    roles: DESKS.map((n) => text(texts, `role_${n}`, lang)),
    you: text(texts, "you", lang),
    doorName: text(texts, "brand_name", lang),
    doorTagline: text(texts, "door_tagline", lang),
  };
}

/**
 * The row of the footer that says the Kazakh translation is still being checked: the last element of
 * the footer while the page is in Kazakh, and no such row in another language.
 * @param {Document} doc
 * @param {Texts} texts
 * @param {string} lang
 * @returns {void}
 */
export function syncKkNote(doc, texts, lang) {
  const footer = doc.querySelector("body > footer");
  if (footer === null) return;
  const note = footer.querySelector(".kk-note");
  if (lang !== "kk") {
    if (note !== null) note.remove();
    return;
  }
  const row = note ?? footer.appendChild(el("p", { cls: "kk-note" }));
  row.textContent = text(texts, "kk_note", lang);
}

/**
 * Draws every avatar of the page (canvas[data-avatar], the person of desk 1 to 4, 24 × 26 logical px
 * on a bitmap of that size) in a theme: the team cards of the landing, the speaker of the demo's
 * question. The palette is read once, from the computed tokens of the root element, for all the
 * avatars. A canvas that cannot draw stays empty; no exception leaves this function.
 * @param {Document} doc
 * @param {PageWindow} win
 * @param {"light" | "dark"} theme
 * @returns {void}
 */
export function drawAvatars(doc, win, theme) {
  const canvases = [...doc.querySelectorAll("canvas[data-avatar]")];
  if (canvases.length === 0) return;
  const computed = win.getComputedStyle(doc.documentElement);
  const palette = readPalette(
    (/** @type {string} */ name) => computed.getPropertyValue(name).trim(),
    theme,
  );
  for (const canvas of canvases) {
    if (!(canvas instanceof win.HTMLCanvasElement)) continue;
    const desk = Number(canvas.getAttribute("data-avatar"));
    try {
      const ctx = canvas.getContext("2d");
      if (ctx === null) continue;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawAvatar(ctx, desk, palette, 1);
    } catch {
      // the avatar stays as it is; its card or speaker keeps its texts
    }
  }
}

/**
 * Calls fn when a media query starts or stops matching: by addEventListener, or by addListener where
 * the list has no addEventListener (older Safari).
 * @param {MediaQueryList} query
 * @param {() => void} fn
 * @returns {void}
 */
export function onMediaChange(query, fn) {
  if (typeof query.addEventListener === "function")
    query.addEventListener("change", fn);
  else if (typeof query.addListener === "function") query.addListener(fn);
}

/**
 * The two preferences of the reader's browser, «sai-lang» and «sai-theme». A key outside the two
 * and a value that is not one word are refused in the same call; a storage that throws gives null
 * on a read and false on a write, never an exception.
 */
export const pref = Object.freeze({
  /**
   * @param {string} key
   * @returns {string | null}
   */
  read(key) {
    if (!PREF_KEYS.includes(key)) return null;
    try {
      const value = window.localStorage.getItem(key);
      return value !== null && PREF_VALUE.test(value) ? value : null;
    } catch {
      return null;
    }
  },
  /**
   * @param {string} key
   * @param {string} value
   * @returns {boolean} true when the value was stored
   */
  write(key, value) {
    if (!PREF_KEYS.includes(key)) return false;
    if (typeof value !== "string" || !PREF_VALUE.test(value)) return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
});

/**
 * The language of the page: `?lang=` of the address when it is a language of the build, else the
 * stored «sai-lang» when it is one, else "ru" (the rule of lang.js).
 * @param {readonly string[]} langs the languages of the build
 * @returns {string}
 */
export function currentLang(langs) {
  const query = new URLSearchParams(window.location.search).get("lang");
  return pickLang(query, pref.read("sai-lang"), langs);
}

/**
 * Mounts the language buttons of a page (the elements with data-lang): the buttons of `langs` get
 * aria-pressed, the current one "true". A click on another language sets `?lang=` of the address by
 * history.replaceState (no reload), stores «sai-lang» and calls onChange with the new language.
 * @param {Document} doc
 * @param {{ langs: readonly string[], current: string, onChange: (lang: string) => void }} options
 * @returns {void}
 */
export function mountLangSwitch(doc, { langs, current, onChange }) {
  let lang = current;
  const buttons = [...doc.querySelectorAll("[data-lang]")].filter((b) =>
    langs.includes(b.getAttribute("data-lang") ?? ""),
  );
  const mark = () => {
    for (const b of buttons)
      b.setAttribute(
        "aria-pressed",
        String(b.getAttribute("data-lang") === lang),
      );
  };
  mark();
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const next = button.getAttribute("data-lang") ?? "";
      if (next === lang) return;
      lang = next;
      mark();
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("lang", lang);
        window.history.replaceState(
          window.history.state,
          "",
          url.pathname + url.search + url.hash,
        );
      } catch {
        // the address stays as it was; the page still changes its language
      }
      pref.write("sai-lang", lang);
      onChange(lang);
    });
  }
}
