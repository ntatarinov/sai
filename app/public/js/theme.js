// The theme of the public pages (the code design of the public landing, 4.5; the look 6.1 and 7.2):
// the pure part — the reader's choice and the theme it gives — and the page part, the one theme
// button and the theme drawn now, which the page scripts and the stage read. «Авто» is no data-theme
// attribute on the root element, so tokens.css follows the system; «Светлая» and «Тёмная» set the
// attribute. The pure part reads no document and no window, and the module loads in Node.

import { SYSTEM_DARK, onMediaChange, pref, text } from "./dom.js";

/** @typedef {"auto" | "light" | "dark"} Choice */
/** @typedef {"light" | "dark"} Theme */
/** @typedef {{ readonly [key: string]: { readonly [lang: string]: string } }} Texts */

/** The positions of the theme button, in the order of its cycle. */
export const CHOICES = Object.freeze(["auto", "light", "dark"]);

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
 * The theme drawn now: the choice on the root element (none for «Авто») and the system setting.
 * @param {Document} doc
 * @param {Window} win
 * @returns {Theme}
 */
export function drawnTheme(doc, win) {
  const choice = readChoice(doc.documentElement.getAttribute("data-theme"));
  return themeFor(choice, win.matchMedia(SYSTEM_DARK).matches);
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
    const position = text(texts, `theme_${choice}`, current);
    if (label) label.textContent = position;
    if (button)
      button.setAttribute(
        "aria-label",
        `${text(texts, "theme_name", current)}: ${position}`,
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
  onMediaChange(system, () => {
    if (choice === "auto") apply();
  });
  return {
    setLang(next) {
      current = next;
      write();
    },
  };
}
