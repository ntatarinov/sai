// Movement of the characters along the routes of the office (design 4.5).
// A route is "there and back": the walker goes to the approach cell of the
// desk of the target, stands there, returns to its own seat and takes the next
// route. The positions depend only on the routes given, on the grid and on the
// time passed (the argument of tick), never on a clock or on chance. Pure ES
// module: no DOM and no Node API.

import {
  canStep as defaultCanStep,
  findPath as defaultFindPath,
} from "./layout.js";

// Cells per second and seconds of standing at the target at "1×".
export const SPEED = 3.4;
export const PAUSE = 0.6;
// The multipliers of the buttons "1×", "2×", "4×" (decision D18: the whole
// time of the simulator runs m times faster, the walk and the standing).
export const SPEEDS = Object.freeze([1, 2, 4]);

const EPS = 1e-9;

function byIndexThenKind(a, b) {
  const kind = (r) => (r.kind === "handoff" ? 0 : 1);
  return a.event_index - b.event_index || kind(a) - kind(b);
}

// findPath and canStep can be replaced (a test of an unreachable target or of
// another walkability passes its own); by default they are those of layout.js.
export function createSim({
  findPath = defaultFindPath,
  canStep = defaultCanStep,
} = {}) {
  // key -> character, kept in the order of the desks.
  const chars = new Map();
  // Ids of the routes that were shown or are queued: a route is shown once.
  const shown = new Set();
  // Ids of the routes that are queued or running and not finished yet.
  const pending = new Set();
  // The grid of the last sync; the paths are built on it.
  let layout = null;
  let paused = false;
  let speed = 1;

  const cellOf = (ch) => [Math.round(ch.x), Math.round(ch.y)];
  const pathTo = (from, to) =>
    layout === null ? null : findPath(layout, from, to, canStep);
  const blocked = (route) =>
    route.after !== null &&
    route.after !== undefined &&
    pending.has(route.after);

  function finishRun(ch) {
    pending.delete(ch.run.route.id);
    ch.run = null;
  }

  // Takes the next route of the queue. False if there is none or the first
  // one waits for another route to finish.
  function startNext(ch) {
    while (ch.queue.length > 0) {
      const route = ch.queue[0];
      if (blocked(route)) return false;
      ch.queue.shift();
      const path = pathTo(cellOf(ch), route.to_cell);
      if (path === null) {
        // Unreachable target: the walker stays where it is, the route is
        // skipped and counts as finished for the routes that wait for it.
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

  function goHome(ch) {
    const back = pathTo(cellOf(ch), ch.home);
    if (back === null || back.length === 0) {
      finishRun(ch);
      return;
    }
    ch.run.phase = "back";
    ch.run.path = back;
    ch.run.step = 0;
  }

  // dt is the time of the simulator (already multiplied by the speed).
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

  // The grid changed (decision D21): the rest of the path of every walker is
  // checked step by step on the new grid; if a step is closed (a new
  // partition), the rest is built anew from the cell where the walker is. The
  // walker first returns to the centre of that cell, so no step crosses a
  // line that already exists.
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
        if (!canStep(layout, prev[0], prev[1], cell[0], cell[1])) {
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
      // No way to the target: the route ends here and the walker goes to its
      // seat the same way; with no way there either it stands where it is.
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
    // Brings the characters in line with the office after a poll: adds the
    // ones that are new at their seats; removes the ones that are gone, with
    // their queue (their routes count as finished for those who wait for
    // them); seats a character anew only if it has no movement and no queue and
    // its desk changed. A character that walks or waits in the queue is not
    // touched: it takes its new seat when it comes back. A new grid is taken
    // and the paths of the walkers are checked on it.
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

    // Queues the routes in the order of event_index (a handoff before a
    // result on a tie). A route whose id was already shown is ignored, so the
    // whole list can be passed on every poll. With {seen: true} the routes are
    // only remembered as shown and nobody walks (the first load of the page).
    // On a pause the routes are queued too and walked after "Продолжить".
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

    // Moves everyone dtSeconds forward, times the speed. On a pause nothing
    // moves and nobody finishes standing at a target.
    tick(dtSeconds) {
      if (paused || !(dtSeconds > 0)) return;
      for (const ch of chars.values()) advance(ch, dtSeconds * speed);
    },

    setPaused(value) {
      paused = value === true;
    },

    isPaused() {
      return paused;
    },

    // A value that is not one of SPEEDS does not change the speed.
    setSpeed(m) {
      if (SPEEDS.includes(m)) speed = m;
    },

    getSpeed() {
      return speed;
    },

    // Where everyone is now, in the order of the desks. state: "seated",
    // "walking" (on a route, also while standing at the target) or "waiting"
    // (the next route waits for another one to finish); route: id of the
    // current route or null; queued: how many routes wait.
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

    // The cell of a character: the position rounded. It is always walkable.
    cell(key) {
      const ch = chars.get(key);
      return ch === undefined ? null : cellOf(ch);
    },
  };
}
