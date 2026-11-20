// The page helpers of the public pages (the code design of the public landing, 4.5): elements made
// with document.createElement and texts set with textContent, the texts of a page set from the texts
// module, the two one-word preferences of the reader's own browser, and the language switch. The
// module touches document, window, history and localStorage only inside its functions, so it loads
// in Node.

import { pickLang } from "../shared/i18n/lang.js";

/** @typedef {{ readonly [key: string]: { readonly [lang: string]: string } }} Texts */

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
 * The text of a key in a language, or null when the texts module holds no such key or language.
 * @param {Texts} texts
 * @param {string | null} key
 * @param {string} lang
 * @returns {string | null}
 */
function textOf(texts, key, lang) {
  if (key === null || !Object.hasOwn(texts, key)) return null;
  const entry = texts[key];
  return Object.hasOwn(entry, lang) ? entry[lang] : null;
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
    const value = textOf(texts, node.getAttribute("data-t"), lang);
    if (value !== null) node.textContent = value;
  }
  for (const node of root.querySelectorAll("[data-t-aria]")) {
    const value = textOf(texts, node.getAttribute("data-t-aria"), lang);
    if (value !== null) node.setAttribute("aria-label", value);
  }
  const doc = "documentElement" in root ? root : root.ownerDocument;
  doc.documentElement.lang = lang;
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
