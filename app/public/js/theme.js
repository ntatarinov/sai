// The theme of the public pages (the code design of the public landing, 4.5; the look 6.1 and 7.2):
// the pure part — the reader's choice and the theme it gives — and the page part, the one theme
// button. «Авто» is no data-theme attribute on the root element, so tokens.css follows the system;
// «Светлая» and «Тёмная» set the attribute. The pure part reads no document and no window, and the
// module loads in Node.

import { pref } from "./dom.js";

/** @typedef {"auto" | "light" | "dark"} Choice */
/** @typedef {"light" | "dark"} Theme */
/** @typedef {{ readonly [key: string]: { readonly [lang: string]: string } }} Texts */

/** The positions of the theme button, in the order of its cycle. */
export const CHOICES = Object.freeze(["auto", "light", "dark"]);

/** The media query of the system's dark setting. */
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

/**
 * The choice a stored value names: exactly "light" or "dark"; anything else is "auto".
 * @param {unknown} raw
 * @returns {Choice}
 */
export function readChoice(raw) {
  return raw === "light" || raw === "dark" ? raw : "auto";
}

/**
 * The theme drawn for a choice: "light" and "dark" as chosen, "auto" as the system asks.
 * @param {unknown} choice
 * @param {boolean} systemDark whether the system asks for dark
 * @returns {Theme}
 */
export function themeFor(choice, systemDark) {
  const read = readChoice(choice);
  if (read === "auto") return systemDark ? "dark" : "light";
  return read;
}

/**
 * The next position of the button: auto → light → dark → auto.
 * @param {unknown} choice
 * @returns {Choice}
 */
export function nextChoice(choice) {
  const read = readChoice(choice);
  if (read === "auto") return "light";
  if (read === "light") return "dark";
  return "auto";
}

/**
 * The text of a key in a language, or "" when the texts module holds no such key or language.
 * @param {Texts} texts
 * @param {string} key
 * @param {string} lang
 * @returns {string}
 */
function textOf(texts, key, lang) {
  if (!Object.hasOwn(texts, key)) return "";
  const entry = texts[key];
  return Object.hasOwn(entry, lang) ? entry[lang] : "";
}

/**
 * Mounts the theme button #theme of the page (its label #theme-label). It reads the stored
 * «sai-theme», sets or removes data-theme on the root element, writes the label and the accessible
 * name «theme_name: position», goes to the next position on a click (Enter and Space press a
 * native button) and stores it, and follows a change of the system setting while the choice is
 * «Авто». onChange gets the theme drawn each time it changes; a click that keeps the drawn theme
 * (Авто → Светлая on a light system) changes only the label.
 * @param {Document} doc
 * @param {{ texts: Texts, lang: string, onChange: (theme: Theme) => void }} options
 * @returns {{ setLang: (lang: string) => void }}
 */
export function mountTheme(doc, { texts, lang, onChange }) {
  const root = doc.documentElement;
  const button = doc.getElementById("theme");
  const label = doc.getElementById("theme-label");
  const system = window.matchMedia(SYSTEM_DARK);
  let choice = readChoice(pref.read("sai-theme"));
  let current = lang;
  let drawn = themeFor(choice, system.matches);

  const write = () => {
    const position = textOf(texts, `theme_${choice}`, current);
    if (label) label.textContent = position;
    if (button)
      button.setAttribute(
        "aria-label",
        `${textOf(texts, "theme_name", current)}: ${position}`,
      );
  };
  const apply = () => {
    if (choice === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    write();
    const next = themeFor(choice, system.matches);
    if (next !== drawn) {
      drawn = next;
      onChange(drawn);
    }
  };

  apply();
  if (button)
    button.addEventListener("click", () => {
      choice = nextChoice(choice);
      pref.write("sai-theme", choice);
      apply();
    });
  system.addEventListener("change", () => {
    if (choice === "auto") apply();
  });
  return {
    setLang(next) {
      current = next;
      write();
    },
  };
}
