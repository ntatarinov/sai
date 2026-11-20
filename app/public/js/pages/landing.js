// The page script of the landing, «how it works», the examples page and the 404 page (the code
// design of the public landing, 4.5; the look 7.2, 7.7, 7.8, 7.19, 7.21, 9.13, 9.15 and 11). It sets
// the texts of the page in its language, mounts the language switch and the theme button, and, on
// the landing and on «how it works», the stage scene; there a tap on a step sends the visitor's figure
// to that desk and the live region says the desk. The team avatars of the landing are drawn at load
// and again after each change of the theme, with the palette of the theme drawn read once per
// change. While the page is in Kazakh, the footer holds the note that the translation is still being
// checked. Elements are made with createElement and texts set with textContent; the page writes no
// style of its own, and it keeps nothing but the two preferences of dom.js.

import { drawAvatar, readPalette } from "../../office/draw.js";
import { mountStage } from "../../office/view.js";
import { LANGS, TEXTS } from "../../shared/i18n/texts.js";
import { applyTexts, currentLang, el, fill, mountLangSwitch } from "../dom.js";
import { mountTheme, readChoice, themeFor } from "../theme.js";

/** @typedef {{ readonly [key: string]: { readonly [lang: string]: string } }} Texts */
/** @typedef {import("../../office/stage-scene.js").Words} Words */
/** @typedef {import("../../office/view.js").StageView} StageView */
/** @typedef {Window & typeof globalThis} PageWindow the window of the page, with its classes */

/** The media query of the system's dark setting (the one theme.js and the stage view read). */
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

/** The four desks of the scene, which are also the four steps of «how it works». */
const DESKS = Object.freeze([1, 2, 3, 4]);

/** The kinds of page that show the stage scene, by the data-page of the body. */
const STAGE_PAGES = Object.freeze({
  landing: /** @type {"landing"} */ ("landing"),
  how: /** @type {"how"} */ ("how"),
});

/** A stage view that does nothing, for a page without the scene. */
/** @type {StageView} */
const NO_STAGE = Object.freeze({
  tap() {},
  setWords() {},
  refresh() {},
});

/** @type {Texts} */
const texts = TEXTS;

/**
 * The text of a key in a language, else its Russian value (the text of the static page), else "".
 * @param {string} key
 * @param {string} lang
 * @returns {string}
 */
function text(key, lang) {
  if (!Object.hasOwn(texts, key)) return "";
  const entry = texts[key];
  if (Object.hasOwn(entry, lang)) return entry[lang];
  return Object.hasOwn(entry, "ru") ? entry.ru : "";
}

/**
 * The words of the stage scene in a language (the code design 4.6): the four stage words, the four
 * role titles, the visitor's label and the two lines of the door sign.
 * @param {string} lang
 * @returns {Words}
 */
function wordsFor(lang) {
  return {
    stages: DESKS.map((n) => text(`stage_${n}`, lang)),
    roles: DESKS.map((n) => text(`role_${n}`, lang)),
    you: text("you", lang),
    doorName: text("brand_name", lang),
    doorTagline: text("door_tagline", lang),
  };
}

/**
 * The theme drawn now: the choice on the root element (none for «Авто») and the system setting, by
 * the rule of theme.js.
 * @param {Document} doc
 * @param {PageWindow} win
 * @returns {"light" | "dark"}
 */
function drawnTheme(doc, win) {
  const choice = readChoice(doc.documentElement.getAttribute("data-theme"));
  return themeFor(choice, win.matchMedia(SYSTEM_DARK).matches);
}

/**
 * Draws every team avatar of the page (canvas[data-avatar], the person of desk 1 to 4, 24 × 26
 * logical px on a bitmap of that size) in a theme. The palette is read once, from the computed tokens
 * of the root element, for all the avatars. A canvas that cannot draw stays empty; no exception
 * leaves this function.
 * @param {Document} doc
 * @param {PageWindow} win
 * @param {"light" | "dark"} theme
 * @returns {void}
 */
function drawAvatars(doc, win, theme) {
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
      // the avatar stays as it is; the card keeps its texts
    }
  }
}

/**
 * The row of the footer that says the Kazakh translation is still being checked: the last element of
 * the footer while the page is in Kazakh, and no such row in another language.
 * @param {Document} doc
 * @param {string} lang
 * @returns {void}
 */
function syncKkNote(doc, lang) {
  const footer = doc.querySelector("body > footer");
  if (footer === null) return;
  const note = footer.querySelector(".kk-note");
  if (lang !== "kk") {
    if (note !== null) note.remove();
    return;
  }
  const row = note ?? footer.appendChild(el("p", { cls: "kk-note" }));
  row.textContent = text("kk_note", lang);
}

/**
 * Starts the page: its texts in the language of the page, the language switch, the theme button,
 * the stage scene and the steps on a page that has them, the avatars and the note of the footer.
 * @param {Document} doc
 * @param {PageWindow} win
 * @returns {void}
 */
function start(doc, win) {
  let lang = currentLang(LANGS);
  /** @type {StageView} */
  let stage = NO_STAGE;
  const live = doc.getElementById("live");

  applyTexts(doc, texts, lang);
  syncKkNote(doc, lang);

  const theme = mountTheme(doc, {
    texts,
    lang,
    onChange: (drawn) => {
      stage.refresh("theme");
      drawAvatars(doc, win, drawn);
    },
  });

  const page = doc.body.getAttribute("data-page") ?? "";
  if (doc.getElementById("stage") !== null && Object.hasOwn(STAGE_PAGES, page))
    stage = mountStage(doc, {
      words: wordsFor(lang),
      page: STAGE_PAGES[/** @type {keyof typeof STAGE_PAGES} */ (page)],
    });

  mountLangSwitch(doc, {
    langs: LANGS,
    current: lang,
    onChange: (next) => {
      lang = next;
      applyTexts(doc, texts, lang);
      theme.setLang(lang);
      syncKkNote(doc, lang);
      // The live region said a desk in the earlier language; the page keeps one language.
      if (live !== null) live.textContent = "";
      stage.setWords(wordsFor(lang));
    },
  });

  drawAvatars(doc, win, drawnTheme(doc, win));

  // «How it works»: a tap on step n walks the visitor to desk n (the look 9.13); the pressed step is
  // the one tapped last.
  const steps = [...doc.querySelectorAll("button[data-step]")];
  for (const button of steps)
    button.addEventListener("click", () => {
      const n = Number(button.getAttribute("data-step"));
      if (!DESKS.includes(n)) return;
      for (const other of steps)
        other.setAttribute("aria-pressed", String(other === button));
      stage.tap({ kind: "step", n });
      if (live !== null)
        live.textContent = fill(text("live_desk", lang), {
          n,
          stage: text(`stage_${n}`, lang),
        });
    });
}

start(document, window);
