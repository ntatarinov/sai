import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { APP } from "../fixtures/helpers.js";

// REQ-112 criterion 5: the stage view (app/public/office/view.js) draws only on taps. It runs here with an
// injected clock, requestAnimationFrame, matchMedia, page visibility and a recording canvas, so every
// frame, every request for a frame and every read of a token is counted. The test's own table of the
// scene: the stage at 390 x 844 (look 9.1), where the door is at x 24 and desk n is 37 left of its centre.

const { createStageView } = await import(
  pathToFileURL(path.join(APP, "public", "office", "view.js")).href
);

/** The centres of the four desks at 390 x 844 and the places the visitor walks to (look 9.1 and 9.13). */
const CX = [82, 154, 226, 298];
const DOOR = 24;
const AT = CX.map((c) => c - 37);
/** The desk each question of the demo is asked at (look 9.13). */
const QUESTION_DESK = [1, 2, 3, 3, 4];
/** The walking speed of the visitor, logical px a second (look 9.8). */
const SPEED = 72;

/** The 24 colour tokens of look 6.2, the page token and the strength: what the view reads of the page. */
const COLOUR_NAMES = [
  "--sc-wall",
  "--sc-wall-top",
  "--sc-wall-b",
  "--sc-trim",
  "--sc-floor-a",
  "--sc-floor-b",
  "--sc-sky",
  "--sc-wood-d",
  "--sc-wood-m",
  "--sc-wood-l",
  "--sc-desk-hi",
  "--sc-metal",
  "--sc-paper",
  "--sc-chair",
  "--sc-chair-hi",
  "--sc-chair-lo",
  "--sc-rug",
  "--sc-rug-edge",
  "--sc-jacket",
  "--sc-jacket-hi",
  "--sc-jacket-lo",
  "--sc-pack",
  "--sc-pack-hi",
  "--sc-dim",
  "--ink",
];
const TOKEN_NAMES = [...COLOUR_NAMES, "--sc-dim-alpha"].sort();
/** The only custom properties that the view writes on the stage (the closed list of the design). */
const STYLE_NAMES = [
  "--H",
  "--rw",
  "--dt",
  "--wh",
  "--cx1",
  "--cx2",
  "--cx3",
  "--cx4",
  "--you",
];

/** The tokens of a theme: markers that differ between the themes, so a frame shows which theme it used. */
const tokensOf = (/** @type {"light" | "dark"} */ theme) => {
  const base = theme === "light" ? 0x20 : 0x60;
  /** @type {Record<string, string>} */
  const out = { "--sc-dim-alpha": theme === "light" ? ".15" : ".5" };
  COLOUR_NAMES.forEach((name, k) => {
    out[name] = `#${(base + k).toString(16).padStart(2, "0")}c0${(0x30 + k)
      .toString(16)
      .padStart(2, "0")}`;
  });
  return out;
};

const WORDS_A = {
  stages: ["A-1", "A-2", "A-3", "A-4"],
  roles: ["RA-1", "RA-2", "RA-3", "RA-4"],
  you: "YOU-A",
  doorName: "DOOR-A",
  doorTagline: "TAG-A",
};
const WORDS_B = {
  stages: ["B-1", "B-2", "B-3", "B-4"],
  roles: ["RB-1", "RB-2", "RB-3", "RB-4"],
  you: "YOU-B",
  doorName: "DOOR-B",
  doorTagline: "TAG-B",
};

/**
 * One stage view on stand-ins. Time is the test's: `pump(ms, step)` moves the clock `step` ms at a time and
 * runs the frames that were asked for, as a browser does at its refresh rate.
 * @param {{ page?: "landing" | "how" | "demo", hidden?: boolean, reduce?: boolean, noContext?: boolean, failAfter?: number, labelsThrow?: boolean }} [o]
 */
function stage(o = {}) {
  let clock = 5000;
  /** @type {Array<[number, () => void]>} */
  let queue = [];
  let nextId = 0;
  let rafCalls = 0;
  let cafCalls = 0;
  let hidden = o.hidden ?? false;
  /** @type {Array<() => void>} */
  const onVisible = [];
  /** @type {Array<() => void>} */
  const onResize = [];
  const media = {
    reduce: {
      matches: o.reduce ?? false,
      listeners: /** @type {Array<() => void>} */ ([]),
    },
    narrow: { matches: true, listeners: /** @type {Array<() => void>} */ ([]) },
  };
  const query = (/** @type {string} */ q) => {
    const m = /reduced-motion/.test(q)
      ? media.reduce
      : /max-width/.test(q)
        ? media.narrow
        : { matches: false, listeners: [] };
    return {
      get matches() {
        return m.matches;
      },
      addEventListener(
        /** @type {string} */ type,
        /** @type {() => void} */ fn,
      ) {
        assert.equal(type, "change");
        m.listeners.push(fn);
      },
    };
  };
  let theme = /** @type {"light" | "dark"} */ ("light");
  let tokens = tokensOf("light");
  /** @type {Map<string, number>} */
  const reads = new Map();
  let viewport = { clientWidth: 390, innerHeight: 844 };

  // The recording canvas: a frame begins with the fill of the wall at the corner, the first fill of the
  // drawing, so frames are counted by what was drawn and not by what the view says. The jacket of the
  // visitor's figure (10 x 9, the colour of its token) is the one rect whose row shows the step frame: frame 1
  // lowers it by one row (the bob of the look's 9.8); a frame keeps the row it was drawn at.
  /** @type {Array<{ at: number, first: string, fills: string[], jacketY?: number }>} */
  const frames = [];
  let style = "";
  let fillCount = 0;
  const ctx = {
    set fillStyle(v) {
      style = String(v);
    },
    get fillStyle() {
      return style;
    },
    fillRect(
      /** @type {number} */ x,
      /** @type {number} */ y,
      /** @type {number} */ w,
      /** @type {number} */ h,
    ) {
      fillCount += 1;
      if (o.failAfter !== undefined && fillCount > o.failAfter)
        throw new Error("the canvas cannot draw");
      if (style === tokens["--sc-wall"] && x === 0 && y === 0)
        frames.push({ at: clock, first: style, fills: [] });
      frames[frames.length - 1]?.fills.push(style);
      if (style === tokens["--sc-jacket"] && w === 10 && h === 9) {
        const f = frames[frames.length - 1];
        if (f !== undefined) f.jacketY = y;
      }
    },
  };
  const canvas = {
    width: 350,
    height: 106,
    getContext: (/** @type {string} */ kind) => {
      assert.equal(kind, "2d");
      return o.noContext ? null : ctx;
    },
  };
  /** @type {Array<[string, string]>} */
  const writes = [];
  /** @type {Record<string, string>} */
  const attrs = {};
  /** @type {string[]} */
  const classes = [];
  /** The camera: every value written to scrollLeft, with the time of the write. */
  /** @type {Array<[number, number]>} */
  const scrolls = [];
  let scroll = 0;
  const stageEl = {
    get scrollLeft() {
      return scroll;
    },
    set scrollLeft(v) {
      scroll = v;
      scrolls.push([clock, v]);
    },
    style: {
      setProperty(/** @type {string} */ name, /** @type {string} */ value) {
        writes.push([name, String(value)]);
      },
    },
    setAttribute(/** @type {string} */ name, /** @type {string} */ value) {
      attrs[name] = String(value);
    },
    classList: {
      add(/** @type {string} */ c) {
        classes.push(c);
      },
    },
  };
  /** @type {Array<{ stage: string, light: number[] }>} */
  const renders = [];
  /** @type {number[]} */
  const moves = [];
  const labels = {
    render(/** @type {any} */ scene) {
      if (o.labelsThrow) throw new Error("the labels cannot draw");
      renders.push({
        stage: scene.desks[0].stage,
        light: scene.desks.map((/** @type {any} */ d) => d.light),
      });
    },
    moveYou(/** @type {number} */ x) {
      moves.push(x);
    },
    say() {},
  };
  const view = createStageView({
    canvas,
    stage: stageEl,
    labels,
    words: WORDS_A,
    page: o.page ?? "how",
    now: () => clock,
    raf: (/** @type {() => void} */ fn) => {
      rafCalls += 1;
      queue.push([++nextId, fn]);
      return nextId;
    },
    caf: (/** @type {number} */ id) => {
      cafCalls += 1;
      queue = queue.filter(([k]) => k !== id);
    },
    matchMedia: query,
    hidden: () => hidden,
    onVisibility: (/** @type {() => void} */ fn) => onVisible.push(fn),
    onResize: (/** @type {() => void} */ fn) => onResize.push(fn),
    token: (/** @type {string} */ name) => {
      reads.set(name, (reads.get(name) ?? 0) + 1);
      return tokens[name];
    },
    px: () => 2,
    viewport: () => viewport,
    theme: () => theme,
  });
  const api = {
    view,
    frames,
    writes,
    attrs,
    classes,
    renders,
    moves,
    reads,
    stageEl,
    scrolls,
    canvas,
    media,
    now: () => clock,
    rafCalls: () => rafCalls,
    cafCalls: () => cafCalls,
    pending: () => queue.length,
    /** @param {number} ms @param {number} [step] */
    pump(ms, step = 16) {
      for (let t = 0; t < ms; t += step) {
        clock += step;
        const batch = queue;
        queue = [];
        for (const [, fn] of batch) fn();
      }
    },
    /** The values of --you written so far. */
    you: () => writes.filter(([n]) => n === "--you").map(([, v]) => Number(v)),
    /**
     * The page turns hidden (or visible) with no event: a callback that was asked for earlier still runs.
     * @param {boolean} value
     */
    flipHidden(value) {
      hidden = value;
    },
    /** @param {boolean} value */
    setHidden(value) {
      hidden = value;
      for (const fn of onVisible) fn();
    },
    /** @param {"light" | "dark"} value */
    setTheme(value) {
      theme = value;
      tokens = tokensOf(value);
    },
    /** @param {{ clientWidth: number, innerHeight: number }} v */
    setViewport(v) {
      viewport = v;
    },
    fireResize() {
      for (const fn of onResize) fn();
    },
    /** @param {boolean} value */
    setReduce(value) {
      media.reduce.matches = value;
      for (const fn of media.reduce.listeners) fn();
    },
  };
  return api;
}

/** The frames of the stage that were drawn between two counts. */
const since = (
  /** @type {ReturnType<typeof stage>} */ s,
  /** @type {number} */ n,
) => s.frames.slice(n);
/** The largest number of frames within any 1000 ms window that starts at a frame. */
const mostPerSecond = (/** @type {Array<{ at: number }>} */ list) =>
  Math.max(
    0,
    ...list.map(
      (f) => list.filter((g) => g.at >= f.at && g.at < f.at + 1000).length,
    ),
  );

test("OV-1 after the first frame, 10 000 ticks of the clock with no tap draw no frame and change no position", () => {
  const s = stage();
  // The first frame is drawn at once, in the load state: one frame, the visitor at the door.
  assert.equal(s.frames.length, 1);
  assert.equal(s.attrs["data-frames"], "1");
  assert.deepEqual(s.you(), [DOOR]);
  assert.deepEqual(s.moves, [DOOR]);
  assert.equal(s.stageEl.scrollLeft, 0);
  const before = JSON.stringify([
    s.writes,
    s.moves,
    s.renders,
    s.attrs,
    s.classes,
  ]);
  const asked = s.rafCalls();
  // 10 000 ticks of the clock, the page asking for nothing: no frame is drawn and nothing is asked for.
  s.pump(10000 * 16);
  assert.equal(s.frames.length, 1);
  assert.equal(s.rafCalls(), asked);
  assert.equal(s.pending(), 0);
  assert.equal(
    JSON.stringify([s.writes, s.moves, s.renders, s.attrs, s.classes]),
    before,
  );
  // The same with a clock that jumps and with a clock that is read at every tick of 1 ms.
  s.pump(60000, 5000);
  s.pump(20000, 1);
  assert.equal(s.frames.length, 1);
  assert.equal(s.rafCalls(), asked);
  // What the view writes on the stage is the closed list, and the hooks of the page are attributes.
  for (const [name] of s.writes) assert.ok(STYLE_NAMES.includes(name), name);
  assert.equal(s.attrs["data-figure"], "44");
  assert.equal(s.canvas.width, 350);
  assert.equal(s.canvas.height, 106);
  // Every page that has a scene draws its load state once and then stands still.
  for (const page of /** @type {const} */ (["landing", "how", "demo"])) {
    const p = stage({ page });
    p.pump(20000);
    assert.equal(p.frames.length, 1, page);
  }
});

test("OV-2 a tap walks «Вы» to the desk of the step table; frames are drawn only during the walk, at most 25 in 1000 ms, none after it", () => {
  for (const step of [16, 4]) {
    const s = stage({ page: "how" });
    for (const n of [1, 2, 3, 4]) {
      const framesBefore = s.frames.length;
      const youBefore = s.you().length;
      const started = s.now();
      s.view.tap({ kind: "step", n });
      s.pump(8000, step);
      const walk = since(s, framesBefore);
      const target = AT[n - 1];
      const from = s.you()[youBefore - 1];
      // «Вы» ends at the desk of the step, and the place line of the labels is told.
      assert.equal(s.you().at(-1), target, `step ${n}`);
      assert.equal(s.moves.at(-1), target);
      // The way is monotone and never goes past the target.
      const places = s.you().slice(youBefore - 1);
      for (let i = 1; i < places.length; i++) {
        assert.ok(places[i] >= places[i - 1], `step ${n}: backwards`);
        assert.ok(places[i] <= target, `step ${n}: past the target`);
      }
      // It is a walk: several frames, within the time that the distance takes at 72 px a second.
      assert.ok(walk.length >= 3, `step ${n}: ${walk.length} frames`);
      const duration = (Math.abs(target - from) / SPEED) * 1000;
      const last = walk[walk.length - 1].at - started;
      assert.ok(
        last >= duration - 50 && last <= duration + 200,
        `step ${n}: walked ${last} ms for ${duration}`,
      );
      assert.ok(
        mostPerSecond(walk) <= 25,
        `step ${n}: ${mostPerSecond(walk)} frames in a second`,
      );
      // Frames are 40 ms apart at least.
      for (let i = 1; i < walk.length; i++)
        assert.ok(walk[i].at - walk[i - 1].at >= 40);
      // The step frame of the figure changes every 160 ms of the walk (look 9.8): the bob of its jacket is
      // frame 1, and the frame drawn at the clock t of a walk that began at `started` is
      // floor((t - started) / 160) mod 2. A frame at an exact multiple of 160 is left out (the sum of the
      // walk's time is a decimal one and may fall on either side).
      const rest = s.frames[0].jacketY;
      assert.equal(typeof rest, "number", "the figure is drawn at the load");
      for (const f of walk.slice(0, -1)) {
        assert.equal(typeof f.jacketY, "number", `step ${n}: a figure drawn`);
        if ((f.at - started) % 160 === 0) continue;
        assert.equal(
          /** @type {number} */ (f.jacketY) - /** @type {number} */ (rest),
          Math.floor((f.at - started) / 160) % 2,
          `step ${n} at ${f.at - started} ms: the step frame`,
        );
      }
      // After the walk no frame is drawn and none is asked for.
      assert.equal(s.pending(), 0, `step ${n}: a frame is still asked for`);
      const done = s.frames.length;
      const asked = s.rafCalls();
      s.pump(5000, step);
      assert.equal(s.frames.length, done);
      assert.equal(s.rafCalls(), asked);
      assert.equal(s.attrs["data-frames"], String(s.frames.length));
    }
  }
  // The camera of a long walk (door to desk 4 at 390 px: 0 to 155 logical px, 310 CSS px): it moves with
  // the walk, eased over 700 ms, and stands at its offset from then on, not later.
  const cam = stage({ page: "how" });
  const t0 = cam.now();
  cam.view.tap({ kind: "step", n: 4 });
  cam.pump(8000);
  const track = cam.scrolls.filter(([t]) => t >= t0);
  assert.ok(track.length > 10);
  for (let i = 1; i < track.length; i++)
    assert.ok(track[i][1] >= track[i - 1][1], "the camera goes back");
  const early = track.filter(([t]) => t - t0 <= 200);
  assert.ok(
    early.some(([, v]) => v > 0 && v < 310),
    "the camera moves with the walk",
  );
  for (const [t, v] of track)
    if (t - t0 >= 760) assert.equal(v, 310, `the camera at ${t - t0} ms`);
  assert.equal(cam.stageEl.scrollLeft, 310);
  assert.ok(track.some(([t, v]) => t - t0 >= 760 && v === 310));
  // The demo: the five answers walk to the desks of its step table, and the fifth answer to the result.
  const d = stage({ page: "demo" });
  assert.deepEqual(d.you(), [DOOR], "the demo loads with «Вы» at the door");
  for (let i = 2; i <= 5; i++) {
    const before = d.frames.length;
    d.view.tap({ kind: "question", i });
    d.pump(8000);
    const desk = QUESTION_DESK[i - 1];
    assert.equal(d.you().at(-1), AT[desk - 1], `question ${i}`);
    if (QUESTION_DESK[i - 2] === desk)
      assert.equal(d.frames.length, before, `question ${i}: no walk`);
    else assert.ok(d.frames.length - before >= 3, `question ${i}`);
  }
  // A tap that came during a walk turns the walk to the new target from where «Вы» is, with no jump.
  const t = stage({ page: "how" });
  t.view.tap({ kind: "step", n: 4 });
  t.pump(1000);
  const mid = t.you().at(-1);
  assert.ok(mid > DOOR + 30 && mid < AT[3]);
  t.view.tap({ kind: "step", n: 1 });
  t.pump(16 * 3);
  for (const v of t.you().slice(-3))
    assert.ok(Math.abs(v - mid) <= 8, `a jump from ${mid} to ${v}`);
  t.pump(8000);
  assert.equal(t.you().at(-1), AT[0]);
  assert.equal(t.pending(), 0);
});

test("OV-3 while the page is hidden no frame is requested or drawn; when it is visible again the walk goes on from where it stood", () => {
  // A page that loads hidden draws nothing until it is shown, then its first frame.
  const h = stage({ hidden: true });
  assert.equal(h.frames.length, 0);
  assert.equal(h.rafCalls(), 0);
  h.pump(20000);
  assert.equal(h.frames.length, 0);
  assert.equal(h.rafCalls(), 0);
  assert.equal(h.attrs["data-frames"], "0");
  h.view.tap({ kind: "step", n: 2 });
  h.view.refresh("theme");
  h.view.refresh("lang");
  h.pump(5000);
  assert.equal(
    h.frames.length,
    0,
    "a tap or a change while hidden draws nothing",
  );
  assert.equal(h.rafCalls(), 0, "and asks for nothing");
  h.setHidden(false);
  h.pump(100);
  assert.equal(h.frames.length >= 1, true, "shown: the first frame");
  // Hidden during a walk.
  const s = stage({ page: "how" });
  s.view.tap({ kind: "step", n: 4 });
  s.pump(700);
  const drawn = s.frames.length;
  const place = s.you().at(-1);
  assert.ok(drawn > 5 && place > DOOR && place < AT[3]);
  s.setHidden(true);
  const asked = s.rafCalls();
  assert.equal(s.pending(), 0, "the frame that was asked for is cancelled");
  s.pump(5000);
  assert.equal(s.frames.length, drawn, "no frame while hidden");
  assert.equal(s.rafCalls(), asked, "no frame is asked for while hidden");
  assert.equal(s.you().at(-1), place);
  // A change of the theme or of the language while hidden asks for nothing either.
  s.setTheme("dark");
  s.view.refresh("theme");
  s.view.refresh("lang");
  s.view.setWords(WORDS_B);
  s.pump(2000);
  assert.equal(s.frames.length, drawn);
  assert.equal(s.rafCalls(), asked);
  // Visible again: the walk goes on from the place where it stood (the time of a frame is capped), to
  // the target, and then stops.
  s.setHidden(false);
  s.pump(16 * 4);
  const resumed = s.you().at(-1);
  assert.ok(
    resumed > place - 1 && resumed - place <= 16,
    `jumped from ${place} to ${resumed}`,
  );
  s.pump(8000);
  assert.equal(s.you().at(-1), AT[3]);
  assert.equal(s.pending(), 0);
  assert.ok(s.frames.length > drawn + 3);
  // The guard inside the frame: the page turns hidden with no event (the flag changes, the frame that was asked
  // for stays asked) and the frame that runs then draws nothing and asks for nothing.
  const g = stage({ page: "how" });
  g.view.tap({ kind: "step", n: 4 });
  g.pump(700);
  const gDrawn = g.frames.length;
  assert.equal(g.pending(), 1, "a frame of the walk is asked for");
  g.flipHidden(true);
  assert.equal(g.pending(), 1, "no event: the frame stays asked for");
  const gAsked = g.rafCalls();
  g.pump(16);
  assert.equal(g.pending(), 0, "the frame ran and asked for no other");
  g.pump(5000);
  assert.equal(
    g.frames.length,
    gDrawn,
    "the frame that ran while hidden drew none",
  );
  assert.equal(g.rafCalls(), gAsked, "and asked for none");
  // A hidden page shown with nothing owed draws no frame (the view stands still).
  const q = stage({ page: "landing" });
  q.setHidden(true);
  q.setHidden(false);
  q.pump(2000);
  assert.equal(q.frames.length, 1);
});

test("OV-4 with reduced motion a tap puts «Вы» at its target in one frame with no place between, and a change of the setting while the page is open is followed", () => {
  const r = stage({ page: "how", reduce: true });
  for (const n of [3, 1, 4, 2]) {
    const framesBefore = r.frames.length;
    const youBefore = r.you().length;
    r.view.tap({ kind: "step", n });
    r.pump(3000);
    assert.equal(r.frames.length - framesBefore, 1, `step ${n}: one frame`);
    assert.deepEqual(
      r.you().slice(youBefore),
      [AT[n - 1]],
      `step ${n}: no place between`,
    );
    assert.equal(r.moves.at(-1), AT[n - 1]);
    assert.equal(r.pending(), 0);
  }
  // The camera is at its place at once: desk 3 at 390 px is 129 logical px, two CSS px each.
  const c = stage({ page: "how", reduce: true });
  c.view.tap({ kind: "step", n: 3 });
  c.pump(100);
  assert.equal(c.stageEl.scrollLeft, 129 * 2);

  // The setting turned on during a walk: «Вы» is at the target in the next frame, nothing between.
  const f = stage({ page: "how" });
  f.view.tap({ kind: "step", n: 4 });
  f.pump(500);
  const mid = f.you().at(-1);
  assert.ok(mid > DOOR + 20 && mid < AT[3]);
  const framesMid = f.frames.length;
  const youMid = f.you().length;
  f.setReduce(true);
  f.pump(3000);
  assert.deepEqual(f.you().slice(youMid), [AT[3]], "the walk ends at once");
  assert.equal(f.frames.length - framesMid, 1);
  assert.equal(f.pending(), 0);
  // With the setting on, the next tap is at once; turned off again, the next tap walks.
  const framesOn = f.frames.length;
  const youOn = f.you().length;
  f.view.tap({ kind: "step", n: 1 });
  f.pump(3000);
  assert.equal(f.frames.length - framesOn, 1);
  assert.deepEqual(f.you().slice(youOn), [AT[0]]);
  f.setReduce(false);
  const framesOff = f.frames.length;
  const youOff = f.you().length;
  f.view.tap({ kind: "step", n: 3 });
  f.pump(8000);
  assert.ok(f.frames.length - framesOff > 3, "a walk again");
  assert.ok(new Set(f.you().slice(youOff)).size > 3);
  assert.equal(f.you().at(-1), AT[2]);
  // The setting turned off while standing does nothing.
  const quiet = f.frames.length;
  f.setReduce(true);
  f.setReduce(false);
  f.pump(2000);
  assert.equal(f.frames.length, quiet);
});

test("OV-5 the tokens are read once per change of the theme, not per frame (counted over 100 frames)", () => {
  const s = stage({ page: "how" });
  const reads = () => Object.fromEntries([...s.reads].sort());
  // At the start: every token of the palette once, and no other.
  assert.deepEqual([...s.reads.keys()].sort(), TOKEN_NAMES);
  for (const [name, n] of s.reads) assert.equal(n, 1, name);
  // Over more than 100 frames of walking: not read again.
  const first = reads();
  for (const n of [4, 1, 4, 1]) {
    s.view.tap({ kind: "step", n });
    s.pump(8000);
  }
  assert.ok(s.frames.length > 100, `${s.frames.length} frames`);
  assert.deepEqual(reads(), first);
  // A change of the theme: every token once more, and one frame with the new colours.
  const frames = s.frames.length;
  s.setTheme("dark");
  s.view.refresh("theme");
  s.pump(1000);
  assert.equal(s.frames.length, frames + 1);
  assert.equal(s.frames.at(-1)?.first, tokensOf("dark")["--sc-wall"]);
  for (const name of TOKEN_NAMES) assert.equal(s.reads.get(name), 2, name);
  // And again over 100 frames: not once more.
  const second = reads();
  for (const n of [4, 1, 4, 1]) {
    s.view.tap({ kind: "step", n });
    s.pump(8000);
  }
  assert.ok(s.frames.length > frames + 100);
  assert.deepEqual(reads(), second);
  // A frame uses the palette that was read: after the change every frame starts with the dark wall.
  for (const f of s.frames.slice(frames + 1))
    assert.equal(f.first, tokensOf("dark")["--sc-wall"]);
  // A change of the language or of the size does not read the tokens.
  s.view.setWords(WORDS_B);
  s.view.refresh("lang");
  s.setViewport({ clientWidth: 320, innerHeight: 568 });
  s.view.refresh("size");
  s.pump(1000);
  assert.deepEqual(reads(), second);
});

test("OV-6 a tap that changes the drawn state with no walk draws exactly one frame; a tap to the state already drawn draws none", () => {
  /** @param {ReturnType<typeof stage>} s @param {any} moment */
  const tapped = (s, moment) => {
    const before = s.frames.length;
    const asked = s.rafCalls();
    const youBefore = s.you().length;
    s.view.tap(moment);
    s.pump(8000);
    return {
      frames: s.frames.length - before,
      asked: s.rafCalls() - asked,
      moved: s.you().length - youBefore,
      last: s.frames.at(-1),
    };
  };
  const d = stage({ page: "demo" });
  // Question 1 is the load state: a tap to it draws nothing.
  assert.deepEqual(
    (({ frames, asked, moved }) => ({ frames, asked, moved }))(
      tapped(d, { kind: "question", i: 1 }),
    ),
    { frames: 0, asked: 0, moved: 0 },
  );
  assert.ok(
    tapped(d, { kind: "question", i: 2 }).frames >= 3,
    "desk 2: a walk",
  );
  assert.ok(
    tapped(d, { kind: "question", i: 3 }).frames >= 3,
    "desk 3: a walk",
  );
  // Question 4 is asked at desk 3 as well: the same state, nothing is drawn.
  const same = tapped(d, { kind: "question", i: 4 });
  assert.deepEqual([same.frames, same.asked, same.moved], [0, 0, 0]);
  assert.ok(
    tapped(d, { kind: "question", i: 5 }).frames >= 3,
    "desk 4: a walk",
  );
  // The result is asked at desk 4 as well, but the light changes: one frame, no walk.
  const beforeResult = d.frames.at(-1);
  const result = tapped(d, { kind: "result" });
  assert.deepEqual([result.frames, result.moved], [1, 0]);
  assert.ok(result.asked >= 1);
  assert.notDeepEqual(
    result.last?.fills,
    beforeResult?.fills,
    "the drawn state changed",
  );
  assert.equal(d.pending(), 0);
  // A tap to the result again draws nothing; back to question 5 is one frame (no walk either way).
  assert.deepEqual(
    [
      tapped(d, { kind: "result" }).frames,
      tapped(d, { kind: "question", i: 5 }).frames,
    ],
    [0, 1],
  );
  assert.equal(tapped(d, { kind: "question", i: 5 }).frames, 0);
  // «Назад» to question 1 walks to the door; a chip back to question 3 walks to desk 3.
  const back = tapped(d, { kind: "question", i: 1 });
  assert.ok(back.frames >= 3);
  assert.equal(d.you().at(-1), DOOR);
  // The same on «how»: a tap on the step that is current draws nothing, a first tap walks.
  const h = stage({ page: "how" });
  assert.ok(tapped(h, { kind: "step", n: 2 }).frames >= 3);
  const again = tapped(h, { kind: "step", n: 2 });
  assert.deepEqual([again.frames, again.asked, again.moved], [0, 0, 0]);
  // A moment that is not in the table of the page is ignored: no frame, no exception.
  for (const moment of [
    { kind: "step", n: 9 },
    { kind: "question", i: 1 },
    { kind: "result" },
    { kind: "nothing" },
    null,
    undefined,
    "step",
  ]) {
    const x = tapped(h, moment);
    assert.deepEqual([x.frames, x.asked], [0, 0], JSON.stringify(moment));
  }
  assert.equal(h.you().at(-1), AT[1]);
});

test("OV-7 one frame after a change of the theme, of the language and of the size; a canvas that cannot draw leaves the text view (decisions/0124 H4)", () => {
  // The theme: one frame in the new colours.
  const s = stage({ page: "how" });
  const settle = () => s.pump(3000);
  assert.equal(s.frames.length, 1);
  s.setTheme("dark");
  s.view.refresh("theme");
  settle();
  assert.equal(s.frames.length, 2);
  assert.equal(s.frames[1].first, tokensOf("dark")["--sc-wall"]);
  assert.notEqual(s.frames[0].first, s.frames[1].first);
  // The language: the new words reach the labels, in one frame, whichever of the two calls is made.
  s.view.setWords(WORDS_B);
  settle();
  assert.equal(s.frames.length, 3);
  assert.equal(s.renders.at(-1)?.stage, "B-1");
  s.view.refresh("lang");
  settle();
  assert.equal(s.frames.length, 4);
  s.view.setWords(WORDS_A);
  s.view.refresh("lang");
  settle();
  assert.equal(s.frames.length, 5, "both calls together draw one frame");
  assert.equal(s.renders.at(-1)?.stage, "A-1");
  // A words object that is no words changes nothing.
  s.view.setWords(/** @type {any} */ ({ stages: [] }));
  settle();
  assert.equal(s.frames.length, 5);
  // The size: a new geometry, «Вы» placed at the target of the drawn state at once, one frame.
  const writes = s.writes.length;
  s.setViewport({ clientWidth: 320, innerHeight: 568 });
  s.fireResize();
  settle();
  assert.equal(s.frames.length, 6);
  const written = Object.fromEntries(s.writes.slice(writes));
  assert.equal(written["--H"], "84");
  assert.equal(written["--rw"], "350");
  assert.equal(written["--wh"], "34");
  assert.equal(s.you().at(-1), DOOR);
  assert.equal(s.canvas.height, 84);
  assert.equal(s.attrs["data-figure"], "44");
  // The same size again draws nothing; the size through refresh draws one frame when it differs.
  s.fireResize();
  s.view.refresh("size");
  settle();
  assert.equal(s.frames.length, 6);
  s.setViewport({ clientWidth: 390, innerHeight: 844 });
  s.view.refresh("size");
  settle();
  assert.equal(s.frames.length, 7);
  assert.equal(s.canvas.height, 106);
  // After a tap, a size change places «Вы» at the target of the state drawn, with no walk.
  s.view.tap({ kind: "step", n: 3 });
  s.pump(8000);
  const walked = s.frames.length;
  s.setViewport({ clientWidth: 320, innerHeight: 568 });
  s.fireResize();
  settle();
  assert.equal(s.frames.length, walked + 1);
  assert.equal(s.you().at(-1), AT[2]);
  assert.equal(s.pending(), 0);

  // The canvas cannot draw (decisions/0124 H4): getContext gives null. Nothing is thrown, the stage gets the
  // text view, no frame is drawn or asked for, and the text list keeps saying the scene, taps included.
  const n = stage({ page: "how", noContext: true });
  assert.deepEqual(n.classes, ["text-view"]);
  assert.equal(n.frames.length, 0);
  assert.equal(n.rafCalls(), 0);
  assert.ok(n.renders.length >= 1, "the labels still say the scene");
  const shown = n.renders.length;
  n.view.tap({ kind: "step", n: 3 });
  n.view.refresh("theme");
  n.view.refresh("size");
  n.view.setWords(WORDS_B);
  n.pump(3000);
  assert.equal(n.frames.length, 0);
  assert.equal(n.rafCalls(), 0);
  assert.ok(
    n.renders.length > shown,
    "a tap and a new language reach the text",
  );
  assert.deepEqual(
    n.renders.at(-1)?.light,
    [0, 0, 1, 0],
    "the text list says desk 3",
  );
  assert.equal(n.renders.at(-1)?.stage, "B-1");
  assert.deepEqual(new Set(n.classes), new Set(["text-view"]));

  // The drawing throws at the first frame: the same text view, no exception, no frame loop.
  const t = stage({ page: "how", failAfter: 0 });
  assert.ok(t.classes.includes("text-view"));
  assert.equal(t.rafCalls(), 0);
  t.view.tap({ kind: "step", n: 2 });
  t.view.refresh("theme");
  t.pump(3000);
  assert.equal(t.rafCalls(), 0);
  assert.deepEqual(t.renders.at(-1)?.light, [0, 1, 0, 0]);

  // The drawing throws in the middle of a walk: the loop stops, the text view stays, nothing is thrown.
  const m = stage({ page: "how", failAfter: 6000 });
  assert.equal(m.classes.length, 0);
  m.view.tap({ kind: "step", n: 4 });
  m.pump(16000);
  assert.ok(
    m.classes.includes("text-view"),
    "the text view after the failing frame",
  );
  assert.equal(m.pending(), 0);
  const stopped = m.frames.length;
  const askedBefore = m.rafCalls();
  m.pump(5000);
  assert.equal(m.frames.length, stopped);
  assert.equal(m.rafCalls(), askedBefore);
  m.view.tap({ kind: "step", n: 1 });
  m.pump(3000);
  assert.deepEqual(
    m.renders.at(-1)?.light,
    [1, 0, 0, 0],
    "the text list follows the tap",
  );

  // The labels throw: the same, the page keeps working.
  const l = stage({ page: "how", labelsThrow: true });
  assert.ok(l.classes.includes("text-view"));
  l.view.tap({ kind: "step", n: 2 });
  l.pump(3000);
  assert.equal(l.pending(), 0);
});
