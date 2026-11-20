// The stage view of the public pages (the code design of the public landing, 4.6; the look 5.2, 9.1,
// 9.13, 9.14, 9.16 and 10): the canvas controller of the stage scene. Nothing in the scene moves by
// time. A frame is drawn at once when the page loads, in its load state (when the page loads hidden,
// once it is shown); after it only in these cases: during a walk that a tap started, at most one
// frame per 40 ms of the clock, the last with the visitor at the target and the camera at its offset;
// one frame after a tap that changes the drawn state with no walk; one frame after a change of the
// theme, the language or the size. A tap to the state already drawn draws nothing, and nothing is
// drawn or asked for while the page is hidden. With reduced motion a tap puts the visitor at the
// target in one frame. When the canvas cannot draw, the stage gets the text view and the frames
// stop; no exception leaves this module. createStageView takes the clock, the frames and every call
// to the page as parameters, so it runs with stand-ins; mountStage gives it the real page.
//
// The only style writes are these, on the stage element (the closed list of the code design): the
// custom properties --H, --rw, --dt, --wh and --cx1 ... --cx4 when the geometry changes and --you
// when the visitor's place changes, which the style sheet places the labels and the canvas by; the
// width and height attributes of the canvas; and scrollLeft of the stage for the camera.

import { readChoice, themeFor } from "../js/theme.js";
import { drawScene, readPalette } from "./draw.js";
import { stageMap } from "./grid.js";
import { createLabels } from "./labels.js";
import { createWalker } from "./sim.js";
import {
  buildScene,
  cameraAt,
  cameraOffset,
  geometry,
  sameDrawn,
  stateFor,
  youX,
} from "./stage-scene.js";

/** @typedef {import("./stage-scene.js").Geometry} Geometry */
/** @typedef {import("./stage-scene.js").Moment} Moment */
/** @typedef {import("./stage-scene.js").Scene} Scene */
/** @typedef {import("./stage-scene.js").SceneState} SceneState */
/** @typedef {import("./stage-scene.js").Words} Words */
/** @typedef {import("./sim.js").Walker} Walker */
/** @typedef {import("./draw.js").Palette} Palette */
/** @typedef {import("./labels.js").Labels} Labels */

/**
 * What the stage view needs of the page: the canvas and the stage element, the labels, the words of
 * the scene and the kind of the page, and every call to the clock, the frames and the page.
 * @typedef {object} StageDeps
 * @property {HTMLCanvasElement} canvas the canvas of the scene; its width and height attributes are
 *   the room in logical px
 * @property {HTMLElement} stage the stage element: its custom properties, data-frames, data-figure,
 *   scrollLeft and the class text-view
 * @property {Labels} labels
 * @property {Words} words the words of the scene in the page's language
 * @property {"landing" | "how" | "demo"} page
 * @property {() => number} now the clock, in ms
 * @property {(fn: () => void) => number} raf asks for a frame
 * @property {(id: number) => void} caf cancels an asked frame
 * @property {(query: string) => MediaQueryList} matchMedia
 * @property {() => boolean} hidden whether the page is hidden
 * @property {(fn: () => void) => void} onVisibility calls fn when the page is hidden or shown
 * @property {(fn: () => void) => void} onResize calls fn when the window changes its size
 * @property {(name: string) => string} token the computed value of a CSS token
 * @property {() => number} px the scale s: the integer of the computed --px
 * @property {() => { clientWidth: number, innerHeight: number }} viewport
 * @property {() => "light" | "dark"} theme the theme drawn
 */

/**
 * The stage view of a page.
 * @typedef {object} StageView
 * @property {(moment: Moment) => void} tap the page's call after a tap on a step or an answer
 * @property {(words: Words) => void} setWords the words in another language
 * @property {(reason: "theme" | "lang" | "size") => void} refresh after the page changed its theme
 *   or its language, or the window its size
 */

/** At most one frame of a walk per this many ms of the clock: 25 frames a second. */
const FRAME_MS = 40;
/** The time step of a walk frame is at most this many ms, so a walk goes on from where it stood. */
const MAX_STEP_MS = 100;
/** The visitor walks 72 logical px a second, with step frames of 160 ms (the look's 9.8). */
const WALK_SPEED = 72;
const STEP_FRAME_MS = 160;
/** The camera eases over 700 ms, or over the walk's own time when the walk is shorter (9.14). */
const CAMERA_MS = 700;
/** The figure of the visitor is 22 logical px tall (9.8). */
const FIGURE_HEIGHT = 22;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** The narrow rule of the stage height: the query of the phone block of the style sheet (9.1). */
const NARROW = "(max-width: 759px)";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";
/** @type {Moment} */
const LOAD = Object.freeze({ kind: "load" });

/** A view that does nothing: for a page without a stage, or a stage that could not be set up. */
/** @type {StageView} */
const INERT = Object.freeze({
  tap() {},
  setWords() {},
  refresh() {},
});

/**
 * Runs fn and keeps any exception in this module.
 * @param {() => void} fn
 */
function quietly(fn) {
  try {
    fn();
  } catch {
    // nothing leaves the stage view; the caller has already chosen what the page shows
  }
}

/**
 * Whether two geometries are the same in every value.
 * @param {Geometry} a
 * @param {Geometry} b
 * @returns {boolean}
 */
function sameGeometry(a, b) {
  return (
    a.s === b.s &&
    a.H === b.H &&
    a.W === b.W &&
    a.Rw === b.Rw &&
    a.wallH === b.wallH &&
    a.deskTop === b.deskTop &&
    a.lane === b.lane &&
    a.sp === b.sp &&
    a.cx.every((v, k) => v === b.cx[k])
  );
}

/**
 * Calls fn when a media query starts or stops matching.
 * @param {MediaQueryList} query
 * @param {() => void} fn
 */
function onChange(query, fn) {
  if (typeof query.addEventListener === "function")
    query.addEventListener("change", fn);
  else if (typeof query.addListener === "function") query.addListener(fn);
}

/**
 * The stage view over the stand-ins it is given (the rules at the top of this file).
 * @param {StageDeps} deps
 * @returns {StageView}
 */
function makeView(deps) {
  const { canvas, stage, labels, page } = deps;
  let words = deps.words;
  /** The state of the last tap that was taken, or of the load. */
  let state = stateFor(page, LOAD);
  /** @type {Geometry | null} */
  let geom = null;
  /** @type {Scene | null} */
  let scene = null;
  /** @type {Walker | null} */
  let walker = null;
  /** @type {Palette | null} */
  let palette = null;
  /** @type {CanvasRenderingContext2D | null} */
  let ctx = null;
  /** Whether the first frame is drawn. */
  let started = false;
  /** Whether the canvas cannot draw: the text view is shown and no frame is drawn any more. */
  let failed = false;
  let frames = 0;
  /** @type {number | null} */
  let asked = null;
  /** Whether one frame is owed for a change with no walk. */
  let owed = false;
  /** Whether the labels still show an earlier scene. */
  let labelsBehind = true;
  let lastFrameAt = 0;
  let lastStepAt = 0;
  /** The camera offset drawn, in logical px, and the easing of a walk's camera. */
  let cam = 0;
  const camera = { from: 0, to: 0, elapsed: 0, duration: 0 };
  /** @type {number | null} */
  let youWritten = null;
  const reduce = deps.matchMedia(REDUCED_MOTION);
  const narrow = deps.matchMedia(NARROW);

  /** The text list for the state taken, with no frame (the text view keeps saying the scene). */
  const writeText = () => {
    if (geom === null || state === null) return;
    const s = buildScene({ words, state, geom });
    if (s === null) return;
    scene = s;
    labels.render(s, geom);
    const x = youX(geom, state.you);
    if (x !== null) labels.moveYou(x);
  };

  /** The text view of the look's 9.16 in the place of the stage; the frames stop. */
  const toTextView = () => {
    failed = true;
    if (asked !== null) {
      const id = asked;
      asked = null;
      quietly(() => deps.caf(id));
    }
    quietly(() => stage.classList.add("text-view"));
    quietly(writeText);
  };

  /** The geometry of the stage for the window now, or null. */
  const measure = () => {
    const { clientWidth, innerHeight } = deps.viewport();
    return geometry({
      s: deps.px(),
      clientWidth,
      innerHeight,
      narrow: narrow.matches,
    });
  };

  /**
   * Takes a geometry: the stage map, the visitor standing at the place of the state taken (no
   * walk), the custom properties of the stage, the size of the canvas, the figure's height and the
   * camera at its offset at once. False when the scene cannot stand in it.
   * @param {Geometry} g
   * @returns {boolean}
   */
  const takeGeometry = (g) => {
    geom = g;
    if (state === null) return false;
    const map = stageMap(g.Rw);
    const x = youX(g, state.you);
    const w =
      map === null || x === null
        ? null
        : createWalker({ map, x, speed: WALK_SPEED, frameMs: STEP_FRAME_MS });
    const s = buildScene({ words, state, geom: g });
    if (w === null || s === null) return false;
    walker = w;
    scene = s;
    labelsBehind = true;
    stage.style.setProperty("--H", String(g.H));
    stage.style.setProperty("--rw", String(g.Rw));
    stage.style.setProperty("--dt", String(g.deskTop));
    stage.style.setProperty("--wh", String(g.wallH));
    stage.style.setProperty("--cx1", String(g.cx[0]));
    stage.style.setProperty("--cx2", String(g.cx[1]));
    stage.style.setProperty("--cx3", String(g.cx[2]));
    stage.style.setProperty("--cx4", String(g.cx[3]));
    if (canvas.width !== g.Rw) canvas.width = g.Rw;
    if (canvas.height !== g.H) canvas.height = g.H;
    stage.setAttribute("data-figure", String(FIGURE_HEIGHT * g.s));
    cam = cameraOffset(g, state.focus) ?? 0;
    camera.duration = 0;
    return true;
  };

  /**
   * Draws one frame now: the scene with the visitor where the walker is, then the labels (when the
   * scene changed), the visitor's place for the labels, the camera and the count of frames. When the
   * visitor stands, the text list says where.
   * @param {number} t the clock of the frame
   */
  const drawFrame = (t) => {
    const g = geom;
    const s = scene;
    const w = walker;
    const c = ctx;
    const p = palette;
    if (g === null || s === null || w === null || c === null || p === null) {
      toTextView();
      return;
    }
    const you = w.position();
    try {
      drawScene(c, s, p, g, you);
    } catch {
      toTextView();
      return;
    }
    frames += 1;
    lastFrameAt = t;
    try {
      if (labelsBehind) {
        labels.render(s, g);
        labelsBehind = false;
      }
      if (youWritten !== you.x) {
        stage.style.setProperty("--you", String(you.x));
        youWritten = you.x;
      }
      stage.scrollLeft = cam * g.s;
      stage.setAttribute("data-frames", String(frames));
      if (!you.walking) labels.moveYou(you.x);
    } catch {
      toTextView();
    }
  };

  /** Asks for a frame, unless one is asked, the page is hidden or the canvas cannot draw. */
  const ask = () => {
    if (failed || asked !== null || deps.hidden()) return;
    asked = deps.raf(onFrame);
  };

  /** A frame of the page: a step of the walk (at most one per 40 ms), or the one frame owed. */
  const onFrame = () => {
    asked = null;
    if (failed) return;
    try {
      if (deps.hidden()) return;
      const t = deps.now();
      if (walker !== null && walker.position().walking) {
        if (t - lastFrameAt < FRAME_MS) {
          ask();
          return;
        }
        const dt = Math.min(Math.max(t - lastStepAt, 0), MAX_STEP_MS);
        lastStepAt = t;
        walker.tick(dt / 1000);
        camera.elapsed += dt;
        const walking = walker.position().walking;
        cam = walking
          ? cameraAt(camera.from, camera.to, camera.elapsed, camera.duration)
          : camera.to;
        owed = false;
        drawFrame(t);
        if (walking) ask();
        return;
      }
      if (owed) {
        owed = false;
        drawFrame(t);
      }
    } catch {
      toTextView();
    }
  };

  /** The first frame, in the state taken (the page's load state unless a tap came before it). */
  const start = () => {
    try {
      if (state === null) {
        toTextView();
        return;
      }
      const g = measure();
      if (g === null || !takeGeometry(g)) {
        toTextView();
        return;
      }
      const c = canvas.getContext("2d");
      if (c === null) {
        toTextView();
        return;
      }
      ctx = c;
      palette = readPalette(deps.token, deps.theme());
      started = true;
      drawFrame(deps.now());
    } catch {
      toTextView();
    }
  };

  /** The window changed its size: a new geometry places the visitor at once and draws one frame. */
  const resize = () => {
    try {
      if (failed || !started) return;
      const g = measure();
      if (g === null) {
        toTextView();
        return;
      }
      if (geom !== null && sameGeometry(g, geom)) return;
      if (!takeGeometry(g)) {
        toTextView();
        return;
      }
      owed = true;
      ask();
    } catch {
      toTextView();
    }
  };

  /** @param {Moment} moment */
  const tap = (moment) => {
    try {
      const next = stateFor(page, moment);
      if (next === null || state === null || sameDrawn(next, state)) return;
      state = next;
      if (failed) {
        writeText();
        return;
      }
      const g = geom;
      const w = walker;
      if (!started || g === null || w === null) return;
      const s = buildScene({ words, state, geom: g });
      const x = youX(g, state.you);
      if (s === null || x === null) {
        toTextView();
        return;
      }
      scene = s;
      labelsBehind = true;
      const to = cameraOffset(g, state.focus) ?? 0;
      const before = w.position();
      if (reduce.matches) {
        w.place(x);
        cam = to;
        camera.duration = 0;
        owed = true;
        ask();
        return;
      }
      if (w.walkTo(x)) {
        if (!before.walking) lastStepAt = deps.now();
        camera.from = cam;
        camera.to = to;
        camera.elapsed = 0;
        camera.duration = Math.min(
          CAMERA_MS,
          (Math.abs(x - before.x) / WALK_SPEED) * 1000,
        );
        ask();
        return;
      }
      // The visitor walks to this place already: the frames of the walk draw the new state.
      if (before.walking) return;
      cam = to;
      camera.duration = 0;
      owed = true;
      ask();
    } catch {
      toTextView();
    }
  };

  /** @param {Words} next */
  const setWords = (next) => {
    try {
      if (
        geom !== null &&
        state !== null &&
        buildScene({ words: next, state, geom }) === null
      )
        return;
      words = next;
      if (failed) {
        writeText();
        return;
      }
      if (!started || geom === null || state === null) return;
      scene = buildScene({ words, state, geom });
      labelsBehind = true;
      owed = true;
      ask();
    } catch {
      toTextView();
    }
  };

  /** @param {"theme" | "lang" | "size"} reason */
  const refresh = (reason) => {
    try {
      if (reason === "size") {
        resize();
        return;
      }
      if (reason === "lang") {
        if (failed) {
          writeText();
          return;
        }
        if (!started) return;
        labelsBehind = true;
        owed = true;
        ask();
        return;
      }
      if (reason === "theme") {
        if (failed || !started) return;
        palette = readPalette(deps.token, deps.theme());
        owed = true;
        ask();
      }
    } catch {
      toTextView();
    }
  };

  stage.setAttribute("data-frames", "0");
  deps.onVisibility(() => {
    try {
      if (failed) return;
      if (deps.hidden()) {
        if (asked !== null) {
          const id = asked;
          asked = null;
          deps.caf(id);
        }
        return;
      }
      if (!started) {
        start();
        return;
      }
      if (owed || (walker !== null && walker.position().walking)) ask();
    } catch {
      toTextView();
    }
  });
  deps.onResize(resize);
  onChange(reduce, () => {
    try {
      if (failed || !started || !reduce.matches) return;
      if (walker === null || geom === null || state === null) return;
      if (!walker.position().walking) return;
      const x = youX(geom, state.you);
      if (x === null) return;
      walker.place(x);
      cam = camera.to;
      camera.duration = 0;
      owed = true;
      ask();
    } catch {
      toTextView();
    }
  });

  if (!deps.hidden()) start();
  return Object.freeze({ tap, setWords, refresh });
}

/**
 * The stage view of a page, over the stand-ins it is given: the canvas, the stage element, the
 * labels, the words of the scene, the kind of the page and the calls to the clock, the frames and
 * the page (StageDeps). It draws the first frame before it returns, unless the page is hidden.
 * @param {StageDeps} deps
 * @returns {StageView}
 */
export function createStageView(deps) {
  try {
    return makeView(deps);
  } catch {
    quietly(() => deps.stage.classList.add("text-view"));
    return INERT;
  }
}

/**
 * Mounts the stage of a page (index.html, how.html, demo.html) on the real page: the canvas
 * #stage-canvas inside the stage #stage, the labels in #stage-labels, the text list #stage-desks and
 * #stage-you, the live region #live. The page calls it after it has set its texts and its theme. A
 * page without the stage gets a view that does nothing.
 * @param {Document} doc
 * @param {{ words: Words, page: "landing" | "how" | "demo" }} options
 * @returns {StageView}
 */
export function mountStage(doc, { words, page }) {
  try {
    const win = doc.defaultView;
    const stage = doc.getElementById("stage");
    if (win === null || stage === null) return INERT;
    const canvas = doc.getElementById("stage-canvas");
    if (!(canvas instanceof win.HTMLCanvasElement)) {
      stage.classList.add("text-view");
      return INERT;
    }
    const root = doc.documentElement;
    const labels = createLabels({
      layer: doc.getElementById("stage-labels"),
      list: doc.getElementById("stage-desks"),
      youLine: doc.getElementById("stage-you"),
      live: doc.getElementById("live"),
      doc,
    });
    const system = win.matchMedia(SYSTEM_DARK);
    return createStageView({
      canvas,
      stage,
      labels,
      words,
      page,
      now: () => win.performance.now(),
      raf: (fn) => win.requestAnimationFrame(fn),
      caf: (id) => win.cancelAnimationFrame(id),
      matchMedia: (query) => win.matchMedia(query),
      hidden: () => doc.hidden,
      onVisibility: (fn) => doc.addEventListener("visibilitychange", fn),
      onResize: (fn) => win.addEventListener("resize", fn),
      token: (name) => win.getComputedStyle(root).getPropertyValue(name).trim(),
      px: () =>
        Number.parseInt(
          win.getComputedStyle(root).getPropertyValue("--px"),
          10,
        ),
      viewport: () => ({
        clientWidth: root.clientWidth,
        innerHeight: win.innerHeight,
      }),
      theme: () =>
        themeFor(readChoice(root.getAttribute("data-theme")), system.matches),
    });
  } catch {
    return INERT;
  }
}
