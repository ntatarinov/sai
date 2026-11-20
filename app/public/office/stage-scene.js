// The stage scene of the public pages: the geometry of the stage for a window, the state of the
// scene for a page and a moment (the step table and the light levels of the look), where the figure
// of the visitor stands, the camera, the scene built from the words it is given, and whether two
// states draw the same. Pure: it reads no page, no clock and no chance, and it holds no word of its
// own: every word of the scene comes in as a parameter. A value that is not what a function takes
// gives null, never an exception.

/**
 * The geometry of the stage, in logical px (one logical px is s CSS px): the height H, the width of
 * the window W, the width of the room Rw, the wall height, the top of the desks, the height of the
 * lane, the distance between two desks and the centres of the four desks.
 * @typedef {object} Geometry
 * @property {number} s
 * @property {number} H
 * @property {number} W
 * @property {number} Rw
 * @property {number} wallH
 * @property {number} deskTop
 * @property {number} lane
 * @property {number} sp
 * @property {readonly number[]} cx
 */

/**
 * A desk, 1 to 4.
 * @typedef {1 | 2 | 3 | 4} Desk
 */

/**
 * What the scene draws in a state: the light level of each desk, the desk whose plate is current,
 * the desk whose person faces the visitor, where the visitor stands, and what the camera follows.
 * @typedef {object} SceneState
 * @property {readonly number[]} light
 * @property {Desk | null} now
 * @property {Desk | null} attend
 * @property {"door" | Desk} you
 * @property {"start" | Desk} focus
 */

/**
 * The moment of a page: its load, a tap on step n of «how it works», question i of the demo, or the
 * result of the demo.
 * @typedef {{ kind: "load" } | { kind: "step", n: number } | { kind: "question", i: number } | { kind: "result" }} Moment
 */

/**
 * The words of the scene, in the page's language.
 * @typedef {object} Words
 * @property {readonly string[]} stages the four stage words
 * @property {readonly string[]} roles the four role titles
 * @property {string} you the label of the visitor
 * @property {string} doorName the first line of the door sign
 * @property {string} doorTagline the second line of the door sign
 */

/**
 * A desk of the scene: its number, its centre, its stage word and role title, its light level,
 * whether its plate is current and whether its person faces the visitor.
 * @typedef {object} SceneDesk
 * @property {Desk} n
 * @property {number} cx
 * @property {string} stage
 * @property {string} role
 * @property {number} light
 * @property {boolean} now
 * @property {boolean} attend
 */

/**
 * The scene: its four desks, the x the visitor walks to, the focus of the camera and the words.
 * @typedef {object} Scene
 * @property {readonly SceneDesk[]} desks
 * @property {number} youTarget
 * @property {"start" | Desk} focus
 * @property {Words} words
 */

/** The desks that ask the five questions of the demo, question 1 to question 5. */
export const QUESTION_DESKS = Object.freeze([1, 2, 3, 3, 4]);

/** The pages that show the scene. */
const PAGES = Object.freeze(["landing", "how", "demo"]);

/** The x of the visitor at the door, and its distance left of the centre of a desk it stands at. */
const DOOR_X = 24;
const AT_DESK = 37;

/** What the camera follows in the start state. */
const START_FOCUS = 70;

/**
 * Whether a value is a whole number from 1.
 * @param {unknown} v
 * @returns {v is number}
 */
const positiveInteger = (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1;

/**
 * Whether a value is a desk, 1 to 4.
 * @param {unknown} v
 * @returns {v is Desk}
 */
const isDesk = (v) => v === 1 || v === 2 || v === 3 || v === 4;

/**
 * The geometry of the stage for a window, by the formulas of the look (its 9.1): H = max(innerHeight
 * < 600 ? 84 : (s = 4 ? 88 : 92), min(150, round(innerHeight × (narrow ? .25 : .44) / s))), W =
 * floor(clientWidth / s), Rw = max(W, 350), wallH = round(.4 × H), deskTop = wallH + 20, lane = H −
 * (deskTop + 14), sp = (Rw − 62) / 4, cx[i] = round(46 + sp × (i + .5)). Null when s is not 2, 3 or 4
 * or a size is not a whole number from 1; narrow is the narrow rule of the page (true or not).
 * @param {{ s: unknown, clientWidth: unknown, innerHeight: unknown, narrow?: unknown }} input
 * @returns {Geometry | null}
 */
export function geometry({ s, clientWidth, innerHeight, narrow }) {
  if (s !== 2 && s !== 3 && s !== 4) return null;
  if (!positiveInteger(clientWidth) || !positiveInteger(innerHeight))
    return null;
  const low = innerHeight < 600 ? 84 : s === 4 ? 88 : 92;
  const H = Math.max(
    low,
    Math.min(
      150,
      Math.round((innerHeight * (narrow === true ? 0.25 : 0.44)) / s),
    ),
  );
  const W = Math.floor(clientWidth / s);
  const Rw = Math.max(W, 350);
  const wallH = Math.round(0.4 * H);
  const deskTop = wallH + 20;
  const lane = H - (deskTop + 14);
  const sp = (Rw - 62) / 4;
  const cx = Object.freeze(
    [0, 1, 2, 3].map((i) => Math.round(46 + sp * (i + 0.5))),
  );
  return Object.freeze({ s, H, W, Rw, wallH, deskTop, lane, sp, cx });
}

/**
 * The light levels with one desk lit and the others dark.
 * @param {Desk} desk
 * @returns {readonly number[]}
 */
const oneLit = (desk) =>
  Object.freeze([1, 2, 3, 4].map((n) => (n === desk ? 1 : 0)));

/** The start state: every desk at .75, no plate current, the visitor at the door. */
const START = Object.freeze({
  light: Object.freeze([0.75, 0.75, 0.75, 0.75]),
  now: null,
  attend: null,
  you: "door",
  focus: "start",
});

/** The result: desk 4 lit, the others at .25, the visitor at desk 4. */
const RESULT = Object.freeze({
  light: Object.freeze([0.25, 0.25, 0.25, 1]),
  now: 4,
  attend: 4,
  you: 4,
  focus: 4,
});

/**
 * The state of question i (1 to 5) of the demo: its desk lit, current and facing; the visitor at
 * that desk, but at the door for question 1.
 * @param {number} i
 * @returns {SceneState}
 */
function questionState(i) {
  const desk = /** @type {Desk} */ (QUESTION_DESKS[i - 1]);
  return Object.freeze({
    light: oneLit(desk),
    now: desk,
    attend: desk,
    you: i === 1 ? "door" : desk,
    focus: desk,
  });
}

/**
 * The state of the scene for a page and a moment, by the step table of the look (its 9.13) and the
 * light levels of its 9.11: at the load of the landing and of «how it works» the start state; at the
 * load of the demo its question 1; a tap on step n of «how it works» lights desk n and sends the
 * visitor there; question i of the demo lights the desk that asks it; the result lights desk 4 and
 * dims the others to .25. Null for a page or a moment not in the table (a step only on "how", a
 * question and the result only on "demo").
 * @param {unknown} page "landing", "how" or "demo"
 * @param {unknown} moment
 * @returns {SceneState | null}
 */
export function stateFor(page, moment) {
  if (typeof page !== "string" || !PAGES.includes(page)) return null;
  if (moment === null || typeof moment !== "object") return null;
  const m = /** @type {{ kind?: unknown, n?: unknown, i?: unknown }} */ (
    moment
  );
  if (m.kind === "load") return page === "demo" ? questionState(1) : START;
  if (m.kind === "step") {
    if (page !== "how" || !isDesk(m.n)) return null;
    return Object.freeze({
      light: oneLit(m.n),
      now: m.n,
      attend: m.n,
      you: m.n,
      focus: m.n,
    });
  }
  if (m.kind === "question") {
    const i = m.i;
    if (page !== "demo" || !positiveInteger(i) || i > 5) return null;
    return questionState(i);
  }
  if (m.kind === "result") return page === "demo" ? RESULT : null;
  return null;
}

/**
 * Whether a value is a geometry this module made (four whole desk centres and whole sizes).
 * @param {unknown} geom
 * @returns {geom is Geometry}
 */
function isGeometry(geom) {
  if (geom === null || typeof geom !== "object") return false;
  const g = /** @type {Record<string, unknown>} */ (geom);
  return (
    ["H", "W", "Rw"].every((k) => positiveInteger(g[k])) &&
    Array.isArray(g.cx) &&
    g.cx.length === 4 &&
    g.cx.every((v) => Number.isInteger(v))
  );
}

/**
 * The x the visitor stands at: 24 at the door, cx[n] − 37 at desk n. Null for another place.
 * @param {Geometry} geom
 * @param {unknown} you "door" or a desk 1 to 4
 * @returns {number | null}
 */
export function youX(geom, you) {
  if (!isGeometry(geom)) return null;
  if (you === "door") return DOOR_X;
  if (isDesk(you)) return geom.cx[you - 1] - AT_DESK;
  return null;
}

/**
 * The camera offset, in logical px: 0 when the room fits the window (Rw ≤ W); else the focus minus
 * half the window, rounded (halves up), within 0 … Rw − W, where the focus is 70 in the start state
 * and the centre of desk n for a desk (the look's 9.14). Null for another focus.
 * @param {Geometry} geom
 * @param {unknown} focus "start" or a desk 1 to 4
 * @returns {number | null}
 */
export function cameraOffset(geom, focus) {
  if (!isGeometry(geom)) return null;
  let f;
  if (focus === "start") f = START_FOCUS;
  else if (isDesk(focus)) f = geom.cx[focus - 1];
  else return null;
  if (geom.Rw <= geom.W) return 0;
  return Math.min(geom.Rw - geom.W, Math.max(0, Math.round(f - geom.W / 2)));
}

/**
 * A point of the curve cubic-bezier(x1, y1, x2, y2) at the parameter t.
 * @param {number} t
 * @param {number} p1
 * @param {number} p2
 * @returns {number}
 */
const bezier = (t, p1, p2) =>
  3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;

/**
 * The easing cubic-bezier(.3, .7, .2, 1) of the look (its 9.14) at the share p of the time, 0 < p <
 * 1: the parameter whose x is p, found by halving, and its y.
 * @param {number} p
 * @returns {number}
 */
function ease(p) {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 48; k++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, 0.3, 0.2) < p) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, 0.7, 1);
}

/**
 * The camera offset during a walk: from `from` to `to` on the easing cubic-bezier(.3, .7, .2, 1)
 * over durationMs (the caller gives min(700, the walk's own time)), rounded to a whole number; `to`
 * from the end of the time on, and at once when durationMs is not above 0; `from` before the walk's
 * time starts.
 * @param {number} from
 * @param {number} to
 * @param {number} elapsedMs
 * @param {number} durationMs
 * @returns {number}
 */
export function cameraAt(from, to, elapsedMs, durationMs) {
  if (!(durationMs > 0) || elapsedMs >= durationMs) return to;
  if (!(elapsedMs > 0)) return from;
  return Math.round(from + (to - from) * ease(elapsedMs / durationMs));
}

/**
 * Whether a value is the words of a scene: four stage words, four role titles and three more words,
 * every one a string.
 * @param {unknown} words
 * @returns {words is Words}
 */
function isWords(words) {
  if (words === null || typeof words !== "object") return false;
  const w = /** @type {Record<string, unknown>} */ (words);
  const four = (/** @type {unknown} */ list) =>
    Array.isArray(list) &&
    list.length === 4 &&
    list.every((v) => typeof v === "string");
  return (
    four(w.stages) &&
    four(w.roles) &&
    ["you", "doorName", "doorTagline"].every((k) => typeof w[k] === "string")
  );
}

/**
 * Whether a value is a scene state: four light levels from 0 to 1, a current and a facing desk or
 * none, the place of the visitor and the focus.
 * @param {unknown} state
 * @returns {state is SceneState}
 */
function isState(state) {
  if (state === null || typeof state !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (state);
  return (
    Array.isArray(s.light) &&
    s.light.length === 4 &&
    s.light.every((v) => typeof v === "number" && v >= 0 && v <= 1) &&
    (s.now === null || isDesk(s.now)) &&
    (s.attend === null || isDesk(s.attend)) &&
    (s.you === "door" || isDesk(s.you)) &&
    (s.focus === "start" || isDesk(s.focus))
  );
}

/**
 * The scene for its words, its state and the geometry of the stage: the four desks in order, each
 * with its centre, its stage word, its role title, its light level, whether its plate is current and
 * whether its person faces the visitor; the x the visitor walks to; the focus of the camera; and the
 * words. Every word comes from `words`. Null when a part is not what it should be.
 * @param {{ words: unknown, state: unknown, geom: unknown }} input
 * @returns {Scene | null}
 */
export function buildScene({ words, state, geom }) {
  if (!isWords(words) || !isState(state) || !isGeometry(geom)) return null;
  const desks = Object.freeze(
    /** @type {Desk[]} */ ([1, 2, 3, 4]).map((n) =>
      Object.freeze({
        n,
        cx: geom.cx[n - 1],
        stage: words.stages[n - 1],
        role: words.roles[n - 1],
        light: state.light[n - 1],
        now: state.now === n,
        attend: state.attend === n,
      }),
    ),
  );
  return Object.freeze({
    desks,
    youTarget: /** @type {number} */ (youX(geom, state.you)),
    focus: state.focus,
    words: Object.freeze({
      stages: Object.freeze([...words.stages]),
      roles: Object.freeze([...words.roles]),
      you: words.you,
      doorName: words.doorName,
      doorTagline: words.doorTagline,
    }),
  });
}

/**
 * Whether two states draw the same: equal light levels, the same current plate, the same facing desk
 * and the same place of the visitor. A tap that leads to the state already drawn draws no frame.
 * False when either is not a state.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function sameDrawn(a, b) {
  if (!isState(a) || !isState(b)) return false;
  return (
    a.light.every((v, k) => v === b.light[k]) &&
    a.now === b.now &&
    a.attend === b.attend &&
    a.you === b.you
  );
}
