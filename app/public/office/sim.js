// ported from tools/src/pixel-office/public/office-sim.js at 7591fc064505dc030edf26df43889bcd52a852bf
// sha256 2b8f90c4b9210e27ce35e7a65780dbe7687892668ed045b58d3e03ffa9403842; no import of tools/

// The movement of the figures of an office along their routes. A route is "there and back": the
// walker goes to the target cell, stands there, returns to its own seat and takes the next route. The
// positions depend only on the routes given, on the grid and on the time passed (the argument of
// tick), never on a clock or on chance. Pure: no page and no Node API. The code is the original's,
// with types in comments for the strict check of the app and one rename: the route kind of a delivery
// is "deliver". The one function added here is createWalker at the end, the walker of the stage of the
// public pages.

import {
  canStep as defaultCanStep,
  findPath as defaultFindPath,
} from "./grid.js";

/** @typedef {import("./grid.js").Layout} Layout */
/** @typedef {import("./grid.js").Cell} Cell */

/**
 * A route: the figure `walker` walks to `to_cell`, stands there and goes back to its seat. `after`
 * names a route that must end first. Routes are taken in the order of `event_index`; on the same
 * index a delivery goes before a result.
 * @typedef {object} Route
 * @property {string} id
 * @property {string} walker the key of the figure that walks
 * @property {string} kind "deliver" or "result"
 * @property {number} event_index
 * @property {Cell} to_cell
 * @property {string | null} [after]
 */

/**
 * The route a figure is on: out to the target, the pause there, and back to the seat.
 * @typedef {object} Run
 * @property {Route} route
 * @property {"out" | "pause" | "back"} phase
 * @property {number[][]} path the cells of the path, [x, y] each
 * @property {number} step the index of the next cell of the path
 * @property {number} rest the seconds still to stand at the target
 */

/**
 * A figure of the office.
 * @typedef {object} Char
 * @property {string} key
 * @property {number} deskIndex
 * @property {number[]} home its seat
 * @property {number} x
 * @property {number} y
 * @property {Route[]} queue
 * @property {Run | null} run
 */

/**
 * The office as the movement reads it: its grid and its figures, each at a desk of the grid.
 * @typedef {object} Office
 * @property {Layout} layout
 * @property {readonly { key: string, desk_index: number }[]} characters
 */

// Cells per second, and the seconds of standing at the target, at "1×".
export const SPEED = 3.4;
export const PAUSE = 0.6;
// The speed multipliers of the buttons "1×", "2×", "4×": the whole time of the movement runs m times
// faster, the walk and the standing.
export const SPEEDS = Object.freeze([1, 2, 4]);

const EPS = 1e-9;

/**
 * The order of the routes: by event_index, and on a tie a delivery before a result.
 * @param {Route} a
 * @param {Route} b
 * @returns {number}
 */
function byIndexThenKind(a, b) {
  const kind = (/** @type {Route} */ r) => (r.kind === "deliver" ? 0 : 1);
  return a.event_index - b.event_index || kind(a) - kind(b);
}

/**
 * The movement of the figures. findPath and canStep can be replaced (for a target that cannot be
 * reached, or for another walkability); by default they are those of grid.js.
 * @param {{ findPath?: typeof defaultFindPath, canStep?: typeof defaultCanStep }} [options]
 */
export function createSim({
  findPath = defaultFindPath,
  canStep = defaultCanStep,
} = {}) {
  // key -> figure, kept in the order of the desks.
  /** @type {Map<string, Char>} */
  const chars = new Map();
  // The ids of the routes that were shown or are queued: a route is shown once.
  /** @type {Set<string>} */
  const shown = new Set();
  // The ids of the routes that are queued or running and not finished yet.
  /** @type {Set<string>} */
  const pending = new Set();
  // The grid of the last sync; the paths are built on it.
  /** @type {Layout | null} */
  let layout = null;
  let paused = false;
  let speed = 1;

  const cellOf = (/** @type {Char} */ ch) => [
    Math.round(ch.x),
    Math.round(ch.y),
  ];
  const pathTo = (/** @type {unknown} */ from, /** @type {unknown} */ to) =>
    layout === null ? null : findPath(layout, from, to, canStep);
  const blocked = (/** @type {Route} */ route) =>
    route.after !== null &&
    route.after !== undefined &&
    pending.has(route.after);

  /** @param {Char} ch */
  function finishRun(ch) {
    pending.delete(/** @type {Run} */ (ch.run).route.id);
    ch.run = null;
  }

  /**
   * Takes the next route of the queue. False if there is none or the first one waits for another
   * route to finish.
   * @param {Char} ch
   * @returns {boolean}
   */
  function startNext(ch) {
    while (ch.queue.length > 0) {
      const route = ch.queue[0];
      if (blocked(route)) return false;
      ch.queue.shift();
      const path = pathTo(cellOf(ch), route.to_cell);
      if (path === null) {
        // A target that cannot be reached: the walker stays where it is, the route is skipped and
        // counts as finished for the routes that wait for it.
        pending.delete(route.id);
        continue;
      }
      ch.run = { route, phase: "out", path, step: 0, rest: 0 };
      if (path.length === 0) {
        ch.run.phase = "pause";
        ch.run.rest = PAUSE;
      }
      return true;
    }
    return false;
  }

  /** @param {Char} ch */
  function goHome(ch) {
    const back = pathTo(cellOf(ch), ch.home);
    if (back === null || back.length === 0) {
      finishRun(ch);
      return;
    }
    /** @type {Run} */ (ch.run).phase = "back";
    /** @type {Run} */ (ch.run).path = back;
    /** @type {Run} */ (ch.run).step = 0;
  }

  /**
   * Moves a figure by dt, the time of the movement (already multiplied by the speed).
   * @param {Char} ch
   * @param {number} dt
   */
  function advance(ch, dt) {
    let left = dt;
    let guard = 0;
    while (left > EPS && guard < 100000) {
      guard += 1;
      if (ch.run === null) {
        if (!startNext(ch)) return;
        continue;
      }
      const run = ch.run;
      if (run.phase === "pause") {
        const used = Math.min(left, run.rest);
        run.rest -= used;
        left -= used;
        if (run.rest > EPS) return;
        goHome(ch);
        continue;
      }
      if (run.step >= run.path.length) {
        if (run.phase === "out") {
          run.phase = "pause";
          run.rest = PAUSE;
        } else {
          finishRun(ch);
        }
        continue;
      }
      const [tx, ty] = run.path[run.step];
      const dx = tx - ch.x;
      const dy = ty - ch.y;
      const dist = Math.hypot(dx, dy);
      const reach = left * SPEED;
      if (dist <= reach + EPS) {
        ch.x = tx;
        ch.y = ty;
        left -= dist / SPEED;
        run.step += 1;
      } else {
        ch.x += (dx / dist) * reach;
        ch.y += (dy / dist) * reach;
        left = 0;
      }
    }
  }

  // The grid changed: the rest of the path of every walker is checked step by step on the new grid;
  // if a step is closed (a new partition), the rest is built anew from the cell where the walker is.
  // The walker first returns to the centre of that cell, so no step crosses a line that already
  // stands.
  function revisePaths() {
    for (const ch of chars.values()) {
      const run = ch.run;
      if (run === null || run.phase === "pause") continue;
      const here = cellOf(ch);
      const atCentre = ch.x === here[0] && ch.y === here[1];
      let rest = run.path.slice(run.step);
      if (rest.length > 0 && rest[0][0] === here[0] && rest[0][1] === here[1]) {
        rest = rest.slice(1);
      }
      let open = true;
      let prev = here;
      for (const cell of rest) {
        if (
          !canStep(
            /** @type {Layout} */ (layout),
            prev[0],
            prev[1],
            cell[0],
            cell[1],
          )
        ) {
          open = false;
          break;
        }
        prev = cell;
      }
      if (open) continue;
      const goal = run.phase === "out" ? run.route.to_cell : ch.home;
      const fresh = pathTo(here, goal);
      if (fresh !== null) {
        run.path = atCentre ? fresh : [here, ...fresh];
        run.step = 0;
        continue;
      }
      // No way to the target: the route ends here and the walker goes to its seat the same way; with
      // no way there either, it stands where it is.
      const home = pathTo(here, ch.home);
      if (run.phase === "out" && home !== null) {
        run.phase = "back";
        run.path = atCentre ? home : [here, ...home];
        run.step = 0;
      } else {
        ch.x = here[0];
        ch.y = here[1];
        finishRun(ch);
      }
    }
  }

  return {
    /**
     * Brings the figures in line with the office: adds the new ones at their seats; removes the ones
     * that are gone, with their queue (their routes count as finished for those who wait for them);
     * seats a figure anew only if it has no movement and no queue and its desk changed. A figure that
     * walks or waits in the queue is not touched: it takes its new seat when it comes back. A new
     * grid is taken and the paths of the walkers are checked on it.
     * @param {Office} office
     */
    sync(office) {
      const gridChanged = layout !== office.layout;
      layout = office.layout;
      const wanted = new Set(office.characters.map((c) => c.key));
      for (const [key, ch] of [...chars]) {
        if (wanted.has(key)) continue;
        if (ch.run !== null) pending.delete(ch.run.route.id);
        for (const route of ch.queue) pending.delete(route.id);
        chars.delete(key);
      }
      for (const c of office.characters) {
        const desk = layout.desks[c.desk_index];
        if (desk === undefined) continue;
        const home = [desk.seat[0], desk.seat[1]];
        const ch = chars.get(c.key);
        if (ch === undefined) {
          chars.set(c.key, {
            key: c.key,
            deskIndex: c.desk_index,
            home,
            x: home[0],
            y: home[1],
            queue: [],
            run: null,
          });
        } else if (ch.deskIndex !== c.desk_index) {
          ch.deskIndex = c.desk_index;
          ch.home = home;
          if (ch.run === null && ch.queue.length === 0) {
            ch.x = home[0];
            ch.y = home[1];
          }
        }
      }
      const ordered = [...chars.values()].sort(
        (a, b) => a.deskIndex - b.deskIndex,
      );
      chars.clear();
      for (const ch of ordered) chars.set(ch.key, ch);
      if (gridChanged) revisePaths();
    },

    /**
     * Queues the routes in the order of event_index (a delivery before a result on a tie). A route
     * whose id was already shown is passed over, so the whole list can be given on every update.
     * With {seen: true} the routes are only remembered as shown and nobody walks (the first load).
     * During a pause the routes are queued too, and walked when the pause ends.
     * @param {readonly Route[]} routes
     * @param {{ seen?: boolean }} [options]
     */
    enqueue(routes, { seen = false } = {}) {
      for (const route of [...routes].sort(byIndexThenKind)) {
        if (shown.has(route.id)) continue;
        if (seen) {
          shown.add(route.id);
          continue;
        }
        const ch = chars.get(route.walker);
        if (ch === undefined) continue;
        shown.add(route.id);
        ch.queue.push(route);
        pending.add(route.id);
      }
    },

    /**
     * Moves everyone dtSeconds forward, times the speed. During a pause nothing moves and nobody
     * finishes standing at a target.
     * @param {number} dtSeconds
     */
    tick(dtSeconds) {
      if (paused || !(dtSeconds > 0)) return;
      for (const ch of chars.values()) advance(ch, dtSeconds * speed);
    },

    /** @param {unknown} value */
    setPaused(value) {
      paused = value === true;
    },

    isPaused() {
      return paused;
    },

    /**
     * A value that is not one of SPEEDS does not change the speed.
     * @param {number} m
     */
    setSpeed(m) {
      if (SPEEDS.includes(m)) speed = m;
    },

    getSpeed() {
      return speed;
    },

    // Where everyone is now, in the order of the desks. state: "seated", "walking" (on a route, also
    // while standing at the target) or "waiting" (the next route waits for another one to finish);
    // route: the id of the current route or null; queued: how many routes wait.
    positions() {
      const out = [];
      for (const ch of chars.values()) {
        let state = "seated";
        if (ch.run !== null) state = "walking";
        else if (ch.queue.length > 0 && blocked(ch.queue[0])) state = "waiting";
        out.push({
          key: ch.key,
          x: ch.x,
          y: ch.y,
          state,
          route: ch.run === null ? null : ch.run.route.id,
          queued: ch.queue.length,
          desk_index: ch.deskIndex,
        });
      }
      return out;
    },

    /**
     * The cell of a figure: its position rounded. It is always walkable.
     * @param {string} key
     */
    cell(key) {
      const ch = chars.get(key);
      return ch === undefined ? null : cellOf(ch);
    },
  };
}

/**
 * The walker of the stage.
 * @typedef {object} Walker
 * @property {(x: number) => boolean} place stands at cell x at once, with no walk; false, and no
 *   change, when the map has no such cell
 * @property {(x: number) => boolean} walkTo starts a walk to cell x from where the walker is; false
 *   when it stands at x or walks to x already, or x cannot be reached
 * @property {(dtSeconds: number) => boolean} tick moves the walker dtSeconds along its path; true
 *   while it walks
 * @property {() => { x: number, walking: boolean, frame: 0 | 1 }} position the cell it is at (its
 *   place rounded), whether it walks, and its step frame
 */

/**
 * The walker of the stage of the public pages, added by the port: one figure on a one-row map (the
 * stageMap of grid.js). It stands still until walkTo sends it; then it walks the path findPath gives,
 * `speed` cells a second, and stops at the target. A walkTo during a walk starts from the cell where
 * the walker is, so it never jumps. Its step frame changes every `frameMs` of walking; standing, it is
 * 0. Null unless x is a walkable cell of the map (as this grid.js reads it: a stage map made by
 * another copy of grid.js is not registered here) and speed and frameMs are positive numbers.
 * @param {{ map: Layout | null, x: number, speed?: number, frameMs?: number }} options
 * @returns {Walker | null}
 */
export function createWalker({ map, x, speed = 72, frameMs = 160 }) {
  if (map === null || typeof map !== "object") return null;
  if (!(Number.isFinite(speed) && speed > 0)) return null;
  if (!(Number.isFinite(frameMs) && frameMs > 0)) return null;
  // A cell the walker may stand on: a step into it is allowed, so it is a cell of the map and
  // walkable as grid.js reads the map (a map that grid.js did not make reads as no stage map).
  const holds = (/** @type {number} */ cell) =>
    defaultCanStep(map, cell + 1, 0, cell, 0);
  if (!holds(x)) return null;
  // Where the walker is, in cells along the row (between two cells while it walks).
  let at = x;
  // The cell it walks to, the cells of its path and the index of the next one.
  let target = x;
  /** @type {readonly (readonly number[])[]} */
  let path = [];
  let step = 0;
  let walking = false;
  let walkedMs = 0;

  const stand = (/** @type {number} */ cell) => {
    at = cell;
    target = cell;
    path = [];
    step = 0;
    walking = false;
    walkedMs = 0;
  };

  return Object.freeze({
    /** @param {number} cell */
    place(cell) {
      if (!holds(cell)) return false;
      stand(cell);
      return true;
    },

    /** @param {number} cell */
    walkTo(cell) {
      if (walking ? cell === target : cell === at) return false;
      const from = Math.round(at);
      const found = defaultFindPath(map, [from, 0], [cell, 0]);
      if (found === null) return false;
      // The target is the cell the walker is passing: it goes back the part of a cell it is past it.
      path = found.length === 0 ? [[cell, 0]] : found;
      step = 0;
      target = cell;
      if (!walking) walkedMs = 0;
      walking = true;
      return true;
    },

    /** @param {number} dtSeconds */
    tick(dtSeconds) {
      if (!walking || !(dtSeconds > 0)) return walking;
      let left = dtSeconds;
      while (left > EPS && step < path.length) {
        const next = path[step][0];
        const dist = Math.abs(next - at);
        const reach = left * speed;
        if (dist <= reach + EPS) {
          at = next;
          left -= dist / speed;
          step += 1;
        } else {
          at += Math.sign(next - at) * reach;
          left = 0;
        }
      }
      walkedMs += (dtSeconds - left) * 1000;
      if (step >= path.length) stand(target);
      return walking;
    },

    position() {
      const frame = walking ? Math.floor(walkedMs / frameMs) % 2 : 0;
      return Object.freeze({
        x: Math.round(at),
        walking,
        frame: /** @type {0 | 1} */ (frame),
      });
    },
  });
}
