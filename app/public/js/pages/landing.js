// The page script of the landing, «how it works», the examples page and the 404 page (the code
// design of the public landing, 4.5; the look 7.2, 7.7, 7.8, 7.19, 7.21, 9.13, 9.15, 9.16 and 11). It
// sets the texts of the page in its language, mounts the language switch and the theme button, and,
// on the landing and on «how it works», the stage scene; there a tap on a step sends the visitor's
// figure to that desk, and the live region says the desk when the figure stands there (the stage's
// labels say it). The team avatars of the landing are drawn at load and again after each change of
// the theme, with the palette of the theme drawn read once per change. While the page is in Kazakh,
// the footer holds the note that the translation is still being checked. Elements are made with
// createElement and texts set with textContent; the page writes no style of its own, and it keeps
// nothing but the two preferences of dom.js.

import { INERT, mountStage } from "../../office/view.js";
import { LANGS, TEXTS } from "../../shared/i18n/texts.js";
import {
  DESKS,
  applyTexts,
  currentLang,
  drawAvatars,
  mountLangSwitch,
  syncKkNote,
  wordsFor,
} from "../dom.js";
import { drawnTheme, mountTheme } from "../theme.js";

/** @typedef {{ readonly [key: string]: { readonly [lang: string]: string } }} Texts */
/** @typedef {import("../../office/view.js").StageView} StageView */
/** @typedef {Window & typeof globalThis} PageWindow the window of the page, with its classes */

/** The kinds of page that show the stage scene, by the data-page of the body. */
const STAGE_PAGES = Object.freeze({
  landing: /** @type {"landing"} */ ("landing"),
  how: /** @type {"how"} */ ("how"),
});

/** @type {Texts} */
const texts = TEXTS;

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
  let stage = INERT;
  const live = doc.getElementById("live");

  applyTexts(doc, texts, lang);
  syncKkNote(doc, texts, lang);

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
      words: wordsFor(texts, lang),
      page: STAGE_PAGES[/** @type {keyof typeof STAGE_PAGES} */ (page)],
    });

  mountLangSwitch(doc, {
    langs: LANGS,
    current: lang,
    onChange: (next) => {
      lang = next;
      applyTexts(doc, texts, lang);
      theme.setLang(lang);
      syncKkNote(doc, texts, lang);
      // The live region said a desk in the earlier language; the page keeps one language.
      if (live !== null) live.textContent = "";
      stage.setWords(wordsFor(texts, lang));
    },
  });

  drawAvatars(doc, win, drawnTheme(doc, win));

  // «How it works»: a tap on step n walks the visitor to desk n (the look 9.13); the pressed step is
  // the one tapped last. The live region says desk n when the visitor stands there, after the walk
  // (at once with reduced motion): the labels of the stage say it (the look 9.16).
  const steps = [...doc.querySelectorAll("button[data-step]")];
  for (const button of steps)
    button.addEventListener("click", () => {
      const n = Number(button.getAttribute("data-step"));
      if (!DESKS.includes(n)) return;
      for (const other of steps)
        other.setAttribute("aria-pressed", String(other === button));
      stage.tap({ kind: "step", n });
    });
}

start(document, window);
