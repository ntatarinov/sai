// The labels of the stage scene (the code design of the public landing, 4.6; the look 9.7, 9.8 and
// 9.16): the door sign, the label of the visitor and the four desk plates over the canvas, and the
// text list right after the stage, which says the four desks and where the visitor stands. When the
// visitor stands at a new desk, the live region it is given says that desk (the look's 9.16: the new
// place after a walk, or at once when the visitor is placed with no walk). Every element is made with
// createElement and every text is set with textContent. This module places no label: the style sheet
// places each one by the custom properties of the stage element, and only the stage view writes
// those. The words of the labels are the scene's; the lines of the text list and of the live region
// are the texts module's, in the language of the page (the lang of the root element, which the page
// sets before it shows the scene in a language). A page module: it touches only the elements and the
// document it is given, and nothing at load.

import { fill, text } from "../js/dom.js";
import { TEXTS } from "../shared/i18n/texts.js";
import { youX } from "./stage-scene.js";

/** @typedef {import("./stage-scene.js").Scene} Scene */
/** @typedef {import("./stage-scene.js").Geometry} Geometry */
/** @typedef {import("./stage-scene.js").Desk} Desk */

/**
 * The labels of one stage.
 * @typedef {object} Labels
 * @property {(scene: Scene, geom: Geometry) => void} render shows a scene: the words of the door
 *   sign, of the visitor's label and of the plates, the current plate, and the four desk lines of
 *   the text list; it keeps the geometry, by which moveYou knows the places
 * @property {(x: number) => void} moveYou the visitor stands at x: when x is the door or the place
 *   at a desk, the place line of the text list says it, and a desk that is a new place after the
 *   first one is said in the live region
 * @property {(text: string) => void} say writes the live region
 */

/**
 * The parts of the page the labels fill.
 * @typedef {object} LabelParts
 * @property {HTMLElement | null} layer the layer over the canvas (#stage-labels)
 * @property {HTMLElement | null} list the list of the four desks (#stage-desks)
 * @property {HTMLElement | null} youLine the line where the visitor stands (#stage-you)
 * @property {HTMLElement | null} live the live region (#live), or null where the page's own script
 *   says what changed
 * @property {Document} doc the document the elements are made in
 */

/** @typedef {"desk_line" | "you_at_door" | "you_at_desk" | "live_desk"} LineKey */

/**
 * A line of the text list or of the live region in a language (the rule of dom.js text).
 * @param {LineKey} key
 * @param {string} lang
 * @returns {string}
 */
function lineText(key, lang) {
  return text(TEXTS, key, lang);
}

/**
 * The lines of a desk plate (the look's 9.7): the number, « · » and the first word of the stage
 * word, then the rest of the stage word on a line of its own; a stage word of one word gives one
 * line. The words are split at the first space, so a no-break space keeps two words together.
 * @param {number} n
 * @param {string} stage
 * @returns {string[]}
 */
function plateLines(n, stage) {
  const word = stage.trim();
  const cut = word.indexOf(" ");
  if (cut < 0) return [`${n} · ${word}`];
  return [`${n} · ${word.slice(0, cut)}`, word.slice(cut + 1).trim()];
}

/**
 * Whether a value has the parts of a scene the labels read: four desks and the words.
 * @param {unknown} scene
 * @returns {scene is Scene}
 */
function isScene(scene) {
  if (scene === null || typeof scene !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (scene);
  return (
    Array.isArray(s.desks) &&
    s.desks.length === 4 &&
    s.words !== null &&
    typeof s.words === "object"
  );
}

/**
 * The place the visitor stands at for x in a geometry: the door, a desk, or null for any other x.
 * @param {Geometry} geom
 * @param {number} x
 * @returns {"door" | Desk | null}
 */
function placeAt(geom, x) {
  if (x === youX(geom, "door")) return "door";
  for (const n of /** @type {Desk[]} */ ([1, 2, 3, 4]))
    if (x === youX(geom, n)) return n;
  return null;
}

/**
 * The labels of a stage over the parts of the page it is given. Nothing is made before the first
 * render; then the door sign, the visitor's label and the four plates stand in the layer in this
 * order (the look's 9.7: a plate paints over the visitor's label where they meet), and the four
 * desk lines in the list. A part that is missing is left out.
 * @param {LabelParts} parts
 * @returns {Labels}
 */
export function createLabels({ layer, list, youLine, live, doc }) {
  /**
   * The elements, once made.
   * @type {{ name: HTMLElement, tagline: HTMLElement, you: HTMLElement, plates: HTMLElement[], items: HTMLElement[] } | null}
   */
  let made = null;
  /** @type {Scene | null} */
  let shown = null;
  /** @type {Geometry | null} */
  let geometry = null;
  /** @type {"door" | Desk | null} */
  let place = null;

  /**
   * An element of a tag, with a class when one is given.
   * @param {string} tag
   * @param {string} [cls]
   * @returns {HTMLElement}
   */
  const make = (tag, cls) => {
    const node = doc.createElement(tag);
    if (cls !== undefined) node.className = cls;
    return node;
  };

  /**
   * Sets the text of a node when it differs.
   * @param {Node | null} node
   * @param {string} text
   */
  const write = (node, text) => {
    if (node !== null && node.textContent !== text) node.textContent = text;
  };

  /** The language of the page: the lang its root element holds. */
  const pageLang = () => doc.documentElement.lang;

  const build = () => {
    const sign = make("div", "sign");
    const name = make("b");
    const tagline = make("i");
    sign.append(name, tagline);
    const you = make("div", "you");
    const plates = [1, 2, 3, 4].map((n) => {
      const plate = make("div", "plate");
      plate.setAttribute("data-desk", String(n));
      return plate;
    });
    if (layer !== null) layer.replaceChildren(sign, you, ...plates);
    const items = [1, 2, 3, 4].map(() => make("li"));
    if (list !== null) list.replaceChildren(...items);
    return { name, tagline, you, plates, items };
  };

  /**
   * The lines of a plate: each line one element, set with textContent.
   * @param {HTMLElement} plate
   * @param {string[]} lines
   */
  const writePlate = (plate, lines) => {
    const spans = [...plate.children];
    if (spans.length === lines.length) {
      lines.forEach((line, k) => write(spans[k], line));
      return;
    }
    plate.replaceChildren(
      ...lines.map((line) => {
        const span = make("span");
        span.textContent = line;
        return span;
      }),
    );
  };

  /**
   * The place line of the text list, for where the visitor stands, in a language.
   * @param {string} lang
   */
  const writePlace = (lang) => {
    if (place === null || shown === null) return;
    if (place === "door") {
      write(youLine, lineText("you_at_door", lang));
      return;
    }
    write(
      youLine,
      fill(lineText("you_at_desk", lang), {
        n: place,
        stage: shown.desks[place - 1].stage,
      }),
    );
  };

  return Object.freeze({
    /**
     * @param {Scene} scene
     * @param {Geometry} geom
     */
    render(scene, geom) {
      if (!isScene(scene)) return;
      const parts = made ?? (made = build());
      const lang = pageLang();
      shown = scene;
      geometry = geom;
      write(parts.name, scene.words.doorName);
      write(parts.tagline, scene.words.doorTagline);
      write(parts.you, scene.words.you);
      scene.desks.forEach((desk, k) => {
        writePlate(parts.plates[k], plateLines(desk.n, desk.stage));
        parts.plates[k].classList.toggle("now", desk.now);
        write(
          parts.items[k],
          fill(lineText("desk_line", lang), {
            n: desk.n,
            stage: desk.stage,
            role: desk.role,
          }),
        );
      });
      writePlace(lang);
    },

    /** @param {number} x */
    moveYou(x) {
      if (geometry === null || shown === null) return;
      const at = placeAt(geometry, x);
      if (at === null) return;
      const before = place;
      place = at;
      const lang = pageLang();
      writePlace(lang);
      // The visitor stands at a new desk: the live region says it. Not the first place (the load),
      // not the same place again (a frame after a change of the theme, the language or the size).
      if (before !== null && at !== before && at !== "door")
        write(
          live,
          fill(lineText("live_desk", lang), {
            n: at,
            stage: shown.desks[at - 1].stage,
          }),
        );
    },

    /** @param {string} text */
    say(text) {
      if (typeof text === "string") write(live, text);
    },
  });
}
