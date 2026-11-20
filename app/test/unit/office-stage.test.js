import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { APP, ROOT } from "../fixtures/helpers.js";

// REQ-112 criterion 4 and the functions the port adds: the stage scene of stage-scene.js and the drawing of
// draw.js on a recording 2D context, and (OS-7) the stage map of grid.js and the walker of sim.js, which are
// no part of the parity with the owner's office. The oracles are the test's own: the tables of the look
// description (docs/design/V1-public-look.md: 6.2, 9.1, 9.11, 9.13, 9.14), a colour reader, an exact decimal
// rounding and an easing found by Newton's method.

const OFFICE = path.join(APP, "public", "office");
const load = (/** @type {string} */ file) => import(pathToFileURL(file).href);
const scene = await load(path.join(OFFICE, "stage-scene.js"));
const draw = await load(path.join(OFFICE, "draw.js"));
const grid = await load(path.join(OFFICE, "grid.js"));
const sim = await load(path.join(OFFICE, "sim.js"));
const { TEXTS } = await load(
  path.join(APP, "public", "shared", "i18n", "texts.js"),
);
const { ROLES } = await load(
  path.join(ROOT, "tools", "src", "team", "roles.js"),
);

// ---------------------------------------------------------------------------------------------------------
// The tables.

/** The three windows of the matrix and their stage geometry (look 9.1). */
const WINDOWS = [
  {
    name: "1470x784",
    input: { s: 4, clientWidth: 1470, innerHeight: 784, narrow: false },
    geom: {
      s: 4,
      H: 88,
      W: 367,
      Rw: 367,
      wallH: 35,
      deskTop: 55,
      lane: 19,
      sp: 76.25,
      cx: [84, 160, 237, 313],
    },
    // The camera offset of the start state and of desks 1 to 4 (look 9.14).
    camera: [0, 0, 0, 0, 0],
  },
  {
    name: "390x844",
    input: { s: 2, clientWidth: 390, innerHeight: 844, narrow: true },
    geom: {
      s: 2,
      H: 106,
      W: 195,
      Rw: 350,
      wallH: 42,
      deskTop: 62,
      lane: 30,
      sp: 72,
      cx: [82, 154, 226, 298],
    },
    camera: [0, 0, 57, 129, 155],
  },
  {
    name: "320x568",
    input: { s: 2, clientWidth: 320, innerHeight: 568, narrow: true },
    geom: {
      s: 2,
      H: 84,
      W: 160,
      Rw: 350,
      wallH: 34,
      deskTop: 54,
      lane: 16,
      sp: 72,
      cx: [82, 154, 226, 298],
    },
    camera: [0, 2, 74, 146, 190],
  },
];

/** The desks that ask the five questions (look 9.13). */
const QUESTION_DESK = [1, 2, 3, 3, 4];

/**
 * Every moment of the step table of look 9.13: the page, the moment, and what the scene must be in it
 * (the kind of light, the desk lit, whether the visitor is at the door, the camera's focus).
 * @type {Array<{ page: string, moment: any, kind: "start" | "ask" | "result", desk: number | null, door: boolean, focus: "start" | number }>}
 */
const MOMENTS = [
  {
    page: "landing",
    moment: { kind: "load" },
    kind: "start",
    desk: null,
    door: true,
    focus: "start",
  },
  {
    page: "how",
    moment: { kind: "load" },
    kind: "start",
    desk: null,
    door: true,
    focus: "start",
  },
  {
    page: "demo",
    moment: { kind: "load" },
    kind: "ask",
    desk: 1,
    door: true,
    focus: 1,
  },
  ...[1, 2, 3, 4].map((n) => ({
    page: "how",
    moment: { kind: "step", n },
    kind: /** @type {const} */ ("ask"),
    desk: n,
    door: false,
    focus: n,
  })),
  ...QUESTION_DESK.map((desk, k) => ({
    page: "demo",
    moment: { kind: "question", i: k + 1 },
    kind: /** @type {const} */ ("ask"),
    desk,
    door: k === 0,
    focus: desk,
  })),
  {
    page: "demo",
    moment: { kind: "result" },
    kind: "result",
    desk: 4,
    door: false,
    focus: 4,
  },
];

/** What the bands keep of the dimming, per kind of state (look 9.11). */
const KEEPS = {
  start: [
    "1",
    ".7",
    ".49",
    ".343",
    ".30625",
    ".2401",
    ".214375",
    ".1500625",
    ".0937890625",
  ],
  ask: ["1", ".6", ".36", ".18"],
  result: [
    "1",
    ".9",
    ".81",
    ".729",
    ".70875",
    ".6561",
    ".637875",
    ".6",
    ".5740875",
    ".54",
    ".5023265625",
    ".486",
    ".42525",
    ".36",
    ".324",
    ".2916",
    ".25515",
    ".18",
    ".162",
    ".1458",
    ".127575",
  ],
};

/** The closed lists of alpha values of the light layer per theme and kind (look 9.11), for .15 and .5. */
const ALPHAS = {
  light: {
    start: [
      ".15",
      ".105",
      ".0735",
      ".0515",
      ".0459",
      ".036",
      ".0322",
      ".0225",
      ".0141",
    ],
    ask: [".15", ".09", ".054", ".027"],
    result: [
      ".15",
      ".135",
      ".1215",
      ".1094",
      ".1063",
      ".0984",
      ".0957",
      ".09",
      ".0861",
      ".081",
      ".0753",
      ".0729",
      ".0638",
      ".054",
      ".0486",
      ".0437",
      ".0383",
      ".027",
      ".0243",
      ".0219",
      ".0191",
    ],
  },
  dark: {
    start: [
      ".5",
      ".35",
      ".245",
      ".1715",
      ".1531",
      ".1201",
      ".1072",
      ".075",
      ".0469",
    ],
    ask: [".5", ".3", ".18", ".09"],
    result: [
      ".5",
      ".45",
      ".405",
      ".3645",
      ".3544",
      ".3281",
      ".3189",
      ".3",
      ".287",
      ".27",
      ".2512",
      ".243",
      ".2126",
      ".18",
      ".162",
      ".1458",
      ".1276",
      ".09",
      ".081",
      ".0729",
      ".0638",
    ],
  },
};
const STRENGTH = { light: ".15", dark: ".5" };
/** The real colour of the light layer per theme (look 6.2). */
const DIM = { light: "#3a2a18", dark: "#050a14" };

/** The 24 colour tokens of look 6.2, in its order, and the page token. */
const TOKENS = [
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
];
const PALETTE_NAMES = [...TOKENS, "--ink"];

/** The constants of look 6.2: every other fillStyle of the scene, the same in both themes. */
const CONSTANT_LIST = [
  "#e0731f",
  "#1f7a8c",
  "#579ba9",
  "#196270",
  "#e8b64c",
  "#ffffff",
  "#ffe9a0",
  "#f4ecc8",
  "rgba(255, 242, 184, 0.16)",
  "rgba(0, 0, 0, 0.22)",
  "#8a5a3c",
  "#a8723f",
  "#2e9a55",
  "#41a15f",
  "#c9a073",
  "#f4d777",
  "#d8473f",
  "#3fae6a",
  "#6aa3b5",
  "#e99d62",
  "#62a2af",
  "#97bfcb",
  "#efcc82",
  "#2f6fa6",
  "#3b86c4",
  "#cfe6f7",
  "#8a97ad",
  "#cdd3de",
  "#eef1f6",
  "#9aa6bb",
  "#2c3547",
  "#0d1420",
  "#10283a",
  "#9fd0e6",
  "#f2f2f2",
  "#6a4a2c",
  "#ffffffaa",
  "#ffd98a",
  "#7a8499",
  "rgba(255, 217, 138, 0.16)",
  "rgba(255, 217, 138, 0.12)",
  "#e8e3d4",
  "#f1d394",
  "#e47e79",
  "#f0cfae",
  "#e7bd96",
  "#ceb296",
  "#c7a381",
  "#2b1d17",
  "#1f1a17",
  "#241915",
  "#c99a2e",
  "#2f5560",
  "#e68c47",
  "#4792a1",
  "#d3ac54",
  "#54747d",
  "#af5a18",
  "#185f6d",
  "#9d7824",
  "#25424b",
  "#1d1712",
  "#e8a08c",
  "#8a3a30",
  "#e9c4a0",
  "#2d3446",
  "#161b26",
  "#3a2c22",
  "#d9b08a",
  "#2a1f18",
];

// ---------------------------------------------------------------------------------------------------------
// The test's own readers.

/**
 * A fillStyle as red, green, blue and alpha: the forms #rrggbb, #rrggbbaa, rgb() and rgba(); null for any
 * other text.
 * @param {unknown} text
 * @returns {{ r: number, g: number, b: number, a: number } | null}
 */
function parseColour(text) {
  if (typeof text !== "string") return null;
  let m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(
    text,
  );
  if (m)
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
      a: m[4] === undefined ? 1 : parseInt(m[4], 16) / 255,
    };
  m =
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/.exec(
      text,
    );
  if (m)
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] === undefined ? 1 : Number(m[4]),
    };
  return null;
}
const key = (/** @type {{ r: number, g: number, b: number, a: number }} */ q) =>
  `${q.r},${q.g},${q.b},${q.a}`;
const rgbKey = (/** @type {{ r: number, g: number, b: number }} */ q) =>
  `${q.r},${q.g},${q.b}`;
const quad = (/** @type {string} */ text) => {
  const q = parseColour(text);
  assert.ok(q, `not a colour: ${text}`);
  return q;
};

/**
 * An exact decimal product rounded half up to four decimals, in whole numbers (BigInt): the strength and
 * the share the bands keep are decimal texts; no floating point is used.
 * @param {string} strength
 * @param {string} keep
 * @returns {string} the digits of the alpha, as a decimal text
 */
function roundedProduct(strength, keep) {
  /** @param {string} t */
  const split = (t) => {
    const [whole, frac = ""] = t.split(".");
    return { n: BigInt(`${whole || "0"}${frac}`), e: frac.length };
  };
  const a = split(strength);
  const b = split(keep);
  const n = a.n * b.n;
  const e = a.e + b.e;
  let q;
  if (e <= 4) q = n * 10n ** BigInt(4 - e);
  else {
    const d = 10n ** BigInt(e - 4);
    q = n / d;
    if ((n % d) * 2n >= d) q += 1n;
  }
  const digits = q.toString().padStart(5, "0");
  const text = `${digits.slice(0, -4)}.${digits.slice(-4)}`.replace(/0+$/, "");
  return text.endsWith(".") ? text.slice(0, -1) : text;
}

/** One recording 2D context: every call, read and set of it, and every fill with its fillStyle. */
function recorder() {
  /** @type {Array<{ kind: "call" | "get" | "set", name: string }>} */
  const log = [];
  /** @type {Array<{ style: string, x: number, y: number, w: number, h: number }>} */
  const fills = [];
  let style = "";
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name === "fillRect")
          return (/** @type {number[]} */ ...a) => {
            log.push({ kind: "call", name: "fillRect" });
            fills.push({ style, x: a[0], y: a[1], w: a[2], h: a[3] });
          };
        if (name === "fillStyle") return style;
        log.push({ kind: "get", name: String(name) });
        return () => {
          log.push({ kind: "call", name: String(name) });
        };
      },
      set(_, name, value) {
        log.push({ kind: "set", name: String(name) });
        if (name === "fillStyle") style = String(value);
        return true;
      },
    },
  );
  /** What the drawing did on the context beyond fillRect calls and fillStyle sets. */
  const findings = () => [
    ...new Set(
      log
        .filter(
          (e) =>
            !(
              (e.kind === "call" && e.name === "fillRect") ||
              (e.kind === "set" && e.name === "fillStyle")
            ),
        )
        .map((e) => `${e.kind} ${e.name}`),
    ),
  ];
  return { ctx, log, fills, findings };
}

// ---------------------------------------------------------------------------------------------------------
// The palettes and the draws.

/** 25 distinct #rrggbb markers, none of them a constant of the scene or the neutral colour. */
const MARKERS = PALETTE_NAMES.map((_, k) => {
  const hex = (/** @type {number} */ v) => v.toString(16).padStart(2, "0");
  return `#${hex(21 + k * 7)}${hex(200 - k * 6)}${hex(33 + k * 5)}`;
});
const CONSTANT_KEYS = new Set(CONSTANT_LIST.map((c) => key(quad(c))));

/** @param {Record<string, string>} values @param {string} strength */
const getterOf = (values, strength) => (/** @type {string} */ name) =>
  name === "--sc-dim-alpha" ? strength : (values[name] ?? "#000000");

/** The values of the markers by token name. */
const MARKED = Object.fromEntries(
  PALETTE_NAMES.map((name, k) => [name, MARKERS[k]]),
);

/**
 * Draws one moment of the step table in one window and theme on a recording context.
 * @param {{ page: string, moment: any }} m
 * @param {(typeof WINDOWS)[number]["input"]} win
 * @param {unknown} palette
 * @param {number} [scale]
 * @param {Record<string, string>} [words]
 */
function drawMoment(m, win, palette, scale = 1, words = undefined) {
  const geom = scene.geometry(win);
  const state = scene.stateFor(m.page, m.moment);
  const built = scene.buildScene({
    words: words ?? {
      stages: ["s1", "s2", "s3", "s4"],
      roles: ["r1", "r2", "r3", "r4"],
      you: "you",
      doorName: "door",
      doorTagline: "tag",
    },
    state,
    geom,
  });
  assert.ok(built, "the scene is built");
  const rec = recorder();
  const calls = draw.drawScene(
    rec.ctx,
    built,
    palette,
    geom,
    { x: scene.youX(geom, state.you), frame: 0, walking: false },
    scale,
  );
  return { ...rec, calls, geom };
}

/** @param {"light" | "dark"} theme @param {string} strength */
const markedPalette = (theme, strength) =>
  draw.readPalette(getterOf(MARKED, strength), theme);

// ---------------------------------------------------------------------------------------------------------

test("OS-1 the scene has four desks with the stage words and the role titles, a door and «Вы» at the door; the geometry, the camera and the steps are those of the look", () => {
  // The words: the stage words of decisions/0084 and the role names of the team catalogue.
  const stages = [
    "Принято",
    "Готовим документацию",
    "Готовим спецификацию",
    "Готово к просмотру",
  ];
  assert.deepEqual(
    [1, 2, 3, 4].map((n) => TEXTS[`stage_${n}`].ru),
    stages,
  );
  const roleName = (/** @type {string} */ code) =>
    ROLES.find((/** @type {any} */ r) => r.code === code).name;
  const roles = [
    "project_manager",
    "business_analyst",
    "developer",
    "reviewer",
  ].map(roleName);
  assert.deepEqual(
    [1, 2, 3, 4].map((n) => TEXTS[`role_${n}`].ru),
    roles,
  );
  assert.deepEqual(roles, [
    "Руководитель проекта",
    "Аналитик",
    "Разработчик",
    "Проверяющий",
  ]);
  assert.equal(TEXTS.you.ru, "Вы");
  // The caption of the scene is a key of the texts module (ru exact).
  assert.equal(
    TEXTS.scene_caption.ru,
    "Картинка показывает этапы работы, а не движения людей.",
  );

  const ruWords = {
    stages,
    roles,
    you: TEXTS.you.ru,
    doorName: TEXTS.brand_name.ru,
    doorTagline: TEXTS.door_tagline.ru,
  };
  const geom = scene.geometry(WINDOWS[1].input);
  const start = scene.stateFor("landing", { kind: "load" });
  const built = scene.buildScene({ words: ruWords, state: start, geom });
  assert.deepEqual(
    built.desks.map((/** @type {any} */ d) => [d.n, d.cx, d.stage, d.role]),
    [1, 2, 3, 4].map((n) => [
      n,
      WINDOWS[1].geom.cx[n - 1],
      stages[n - 1],
      roles[n - 1],
    ]),
  );
  assert.equal(built.words.doorName, TEXTS.brand_name.ru);
  assert.equal(built.words.doorTagline, TEXTS.door_tagline.ru);
  assert.equal(built.words.you, "Вы");
  assert.equal(built.youTarget, 24);
  assert.equal(scene.youX(geom, "door"), 24);
  assert.equal(built.focus, "start");

  // Only the words that are given are in the scene: markers are all found and nothing else is.
  const marked = {
    stages: ["ST-1", "ST-2", "ST-3", "ST-4"],
    roles: ["RL-1", "RL-2", "RL-3", "RL-4"],
    you: "YOU-M",
    doorName: "DOOR-M",
    doorTagline: "TAG-M",
  };
  for (const m of MOMENTS) {
    const s = scene.buildScene({
      words: marked,
      state: scene.stateFor(m.page, m.moment),
      geom,
    });
    /** @type {string[]} */
    const strings = [];
    /** @param {any} v @param {string} k */
    const collect = (v, k) => {
      if (typeof v === "string" && k !== "focus") strings.push(v);
      else if (v !== null && typeof v === "object")
        for (const name of Object.keys(v)) collect(v[name], name);
    };
    collect(s, "scene");
    const found = new Set(strings);
    for (const w of [
      ...marked.stages,
      ...marked.roles,
      "YOU-M",
      "DOOR-M",
      "TAG-M",
    ])
      assert.ok(found.has(w), `${m.page}: ${w} not in the scene`);
    assert.equal(
      found.size,
      11,
      `${m.page}: a word that was not given is in the scene`,
    );
  }

  // The geometry at the three windows (look 9.1) and the camera (look 9.14).
  for (const w of WINDOWS) {
    const g = scene.geometry(w.input);
    assert.deepEqual({ ...g, cx: [...g.cx] }, w.geom, w.name);
    assert.deepEqual(
      ["start", 1, 2, 3, 4].map((f) => scene.cameraOffset(g, f)),
      w.camera,
      w.name,
    );
    assert.deepEqual(
      [1, 2, 3, 4].map((n) => scene.youX(g, n)),
      w.geom.cx.map((/** @type {number} */ c) => c - 37),
      w.name,
    );
  }
  // The formulas of look 9.1 by the test's own reading, over windows of every scale, narrow or not: the
  // height by the window and the scale, the width of the window and of the room, the desks.
  for (const s of [2, 3, 4])
    for (const clientWidth of [320, 390, 700, 1000, 1100, 1470, 1920, 2560])
      for (const innerHeight of [
        400, 568, 599, 600, 640, 784, 844, 900, 1080, 1400,
      ])
        for (const narrow of [true, false]) {
          const low = innerHeight < 600 ? 84 : s === 4 ? 88 : 92;
          const H = Math.max(
            low,
            Math.min(
              150,
              Math.round((innerHeight * (narrow ? 0.25 : 0.44)) / s),
            ),
          );
          const W = Math.floor(clientWidth / s);
          const Rw = Math.max(W, 350);
          const wallH = Math.round(0.4 * H);
          const g = scene.geometry({ s, clientWidth, innerHeight, narrow });
          const label = `${s} ${clientWidth}x${innerHeight} ${narrow}`;
          assert.deepEqual(
            { ...g, cx: [...g.cx] },
            {
              s,
              H,
              W,
              Rw,
              wallH,
              deskTop: wallH + 20,
              lane: H - (wallH + 20 + 14),
              sp: (Rw - 62) / 4,
              cx: [0, 1, 2, 3].map((i) =>
                Math.round(46 + ((Rw - 62) / 4) * (i + 0.5)),
              ),
            },
            label,
          );
        }
  // A window that does not give a geometry gives null, never an exception.
  for (const bad of [
    { s: 1, clientWidth: 390, innerHeight: 844 },
    { s: 5, clientWidth: 390, innerHeight: 844 },
    { s: "2", clientWidth: 390, innerHeight: 844 },
    { s: 2, clientWidth: 0, innerHeight: 844 },
    { s: 2, clientWidth: 390.5, innerHeight: 844 },
    { s: 2, clientWidth: 390, innerHeight: -1 },
    { s: 2, clientWidth: Number.NaN, innerHeight: 844 },
    { s: 2, clientWidth: 390, innerHeight: null },
  ])
    assert.equal(scene.geometry(bad), null, JSON.stringify(bad));
  assert.equal(scene.cameraOffset(null, "start"), null);
  assert.equal(scene.cameraOffset(geom, "x"), null);
  assert.equal(scene.cameraOffset(geom, 5), null);
  assert.equal(scene.youX(geom, 5), null);
  assert.equal(scene.youX(geom, "x"), null);
  assert.equal(scene.youX({}, "door"), null);

  // The camera during a walk: cubic-bezier(.3, .7, .2, 1), by the test's own Newton solution.
  /** @param {number} p */
  const easedBy = (p) => {
    const bez = (
      /** @type {number} */ t,
      /** @type {number} */ a,
      /** @type {number} */ b,
    ) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
    const dx = (/** @type {number} */ t) =>
      3 * (1 - t) ** 2 * 0.3 +
      6 * (1 - t) * t * (0.2 - 0.3) +
      3 * t ** 2 * (1 - 0.2);
    let t = p;
    for (let k = 0; k < 40; k++) t -= (bez(t, 0.3, 0.2) - p) / dx(t);
    return bez(t, 0.7, 1);
  };
  for (const [from, to] of [
    [0, 155],
    [155, 0],
    [2, 190],
    [57, 129],
  ])
    for (const p of [0.05, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.95]) {
      const got = scene.cameraAt(from, to, p * 700, 700);
      assert.equal(Number.isInteger(got), true);
      assert.equal(
        got,
        Math.round(from + (to - from) * easedBy(p)),
        `${from} → ${to} at ${p}`,
      );
    }
  // It reaches its target at the end, stays there, and starts at the origin; no walk is no easing.
  for (const [from, to] of [
    [0, 155],
    [155, 0],
    [2, 190],
  ]) {
    assert.equal(scene.cameraAt(from, to, 700, 700), to);
    assert.equal(scene.cameraAt(from, to, 5000, 700), to);
    assert.equal(scene.cameraAt(from, to, 0, 700), from);
    assert.equal(scene.cameraAt(from, to, -5, 700), from);
    assert.equal(scene.cameraAt(from, to, 100, 0), to);
    let last = from;
    for (let t = 0; t <= 700; t += 10) {
      const v = scene.cameraAt(from, to, t, 700);
      assert.ok(
        to > from ? v >= last : v <= last,
        `${from} → ${to}: not monotone at ${t}`,
      );
      last = v;
    }
    // A shorter walk is eased over its own time.
    assert.equal(scene.cameraAt(from, to, 290, 290), to);
  }

  // The step table of look 9.13.
  /** @param {number | null} desk @param {number[]} light */
  const lit = (desk, light) => light.map((v, k) => (desk === k + 1 ? 1 : v));
  for (const m of MOMENTS) {
    const s = scene.stateFor(m.page, m.moment);
    assert.ok(s, `${m.page} ${JSON.stringify(m.moment)}`);
    const light =
      m.kind === "start"
        ? [0.75, 0.75, 0.75, 0.75]
        : m.kind === "result"
          ? [0.25, 0.25, 0.25, 1]
          : lit(m.desk, [0, 0, 0, 0]);
    assert.deepEqual(
      [...s.light],
      light,
      `${m.page} ${JSON.stringify(m.moment)}`,
    );
    assert.equal(s.now, m.desk);
    assert.equal(s.attend, m.desk);
    assert.equal(s.you, m.door ? "door" : m.desk);
    assert.equal(s.focus, m.focus);
  }
  assert.deepEqual([...scene.QUESTION_DESKS], QUESTION_DESK);
  // A page and a moment that are not in the table give null.
  for (const [page, moment] of [
    ["landing", { kind: "step", n: 1 }],
    ["landing", { kind: "result" }],
    ["how", { kind: "question", i: 1 }],
    ["how", { kind: "result" }],
    ["demo", { kind: "step", n: 1 }],
    ["how", { kind: "step", n: 0 }],
    ["how", { kind: "step", n: 5 }],
    ["how", { kind: "step", n: "2" }],
    ["demo", { kind: "question", i: 0 }],
    ["demo", { kind: "question", i: 6 }],
    ["demo", { kind: "question", i: 1.5 }],
    ["other", { kind: "load" }],
    [null, { kind: "load" }],
    ["demo", null],
    ["demo", "load"],
    ["demo", {}],
  ])
    assert.equal(
      scene.stateFor(page, moment),
      null,
      `${page} ${JSON.stringify(moment)}`,
    );
  // Which states draw the same: a tap to the state already drawn draws no frame.
  const demo = (/** @type {number} */ i) =>
    scene.stateFor("demo", { kind: "question", i });
  assert.equal(scene.sameDrawn(demo(3), demo(4)), true);
  assert.equal(scene.sameDrawn(demo(2), demo(3)), false);
  assert.equal(
    scene.sameDrawn(demo(5), scene.stateFor("demo", { kind: "result" })),
    false,
  );
  assert.equal(
    scene.sameDrawn(scene.stateFor("landing", { kind: "load" }), demo(1)),
    false,
  );
  assert.equal(
    scene.sameDrawn(demo(1), scene.stateFor("demo", { kind: "load" })),
    true,
  );
  // Two states draw the same when their light, current plate, facing desk and visitor's place are equal:
  // each of the four alone makes them differ; the focus of the camera is no part of it.
  const base = demo(3);
  const variants = [
    { ...base, light: [0.5, 0, 1, 0] },
    { ...base, now: 2 },
    { ...base, attend: null },
    { ...base, attend: 2 },
    { ...base, you: "door" },
    { ...base, you: 2 },
  ];
  for (const v of variants)
    assert.equal(scene.sameDrawn(base, v), false, JSON.stringify(v));
  assert.equal(scene.sameDrawn(base, { ...base, focus: 2 }), true);
  assert.equal(
    scene.sameDrawn(base, { ...base, light: [...base.light] }),
    true,
  );
  assert.equal(scene.sameDrawn(demo(1), null), false);
  assert.equal(scene.sameDrawn({}, {}), false);
  // A scene is not built from a part that is not what it should be.
  assert.equal(scene.buildScene({ words: null, state: start, geom }), null);
  assert.equal(
    scene.buildScene({ words: { ...ruWords, you: 1 }, state: start, geom }),
    null,
  );
  assert.equal(
    scene.buildScene({
      words: { ...ruWords, roles: ["a"] },
      state: start,
      geom,
    }),
    null,
  );
  assert.equal(scene.buildScene({ words: ruWords, state: null, geom }), null);
  assert.equal(
    scene.buildScene({ words: ruWords, state: start, geom: {} }),
    null,
  );
});

test("OS-2 the drawing calls fillRect and sets fillStyle on the context and does nothing else; the eight planted uses are red", () => {
  const palette = markedPalette("light", ".37");
  for (const theme of /** @type {const} */ (["light", "dark"]))
    for (const w of WINDOWS)
      for (const m of MOMENTS) {
        const d = drawMoment(m, w.input, markedPalette(theme, ".37"));
        assert.deepEqual(d.findings(), [], `${w.name} ${theme} ${m.page}`);
        assert.equal(d.calls, d.fills.length);
        assert.ok(d.calls > 100);
      }
  // The avatars of the four desks draw by the same two operations.
  for (const desk of [1, 2, 3, 4]) {
    const rec = recorder();
    draw.drawAvatar(rec.ctx, desk, palette, 2);
    assert.deepEqual(rec.findings(), [], `avatar ${desk}`);
    assert.ok(rec.fills.length > 10);
  }

  // Planted uses of the context, after a normal drawing on the same recorder: each is found.
  /** @type {Array<[string, (c: any) => void, string]>} */
  const planted = [
    ["fillText", (c) => c.fillText("x", 1, 1), "call fillText"],
    ["strokeRect", (c) => c.strokeRect(0, 0, 1, 1), "call strokeRect"],
    ["arc", (c) => c.arc(1, 1, 1, 0, 3), "call arc"],
    ["drawImage", (c) => c.drawImage({}, 0, 0), "call drawImage"],
    ["getImageData", (c) => c.getImageData(0, 0, 1, 1), "call getImageData"],
    ["globalAlpha", (c) => (c.globalAlpha = 0.5), "set globalAlpha"],
    [
      "globalCompositeOperation",
      (c) => (c.globalCompositeOperation = "destination-out"),
      "set globalCompositeOperation",
    ],
    ["font", (c) => (c.font = "10px x"), "set font"],
  ];
  assert.equal(planted.length, 8);
  for (const [what, use, finding] of planted) {
    const rec = recorder();
    const geom = scene.geometry(WINDOWS[1].input);
    const state = scene.stateFor("landing", { kind: "load" });
    const built = scene.buildScene({
      words: {
        stages: ["a", "b", "c", "d"],
        roles: ["a", "b", "c", "d"],
        you: "y",
        doorName: "d",
        doorTagline: "t",
      },
      state,
      geom,
    });
    draw.drawScene(rec.ctx, built, palette, geom, {
      x: 24,
      frame: 0,
      walking: false,
    });
    assert.deepEqual(rec.findings(), [], what);
    use(rec.ctx);
    assert.ok(rec.findings().includes(finding), `${what}: ${rec.findings()}`);
  }
});

test("OS-3 every coordinate and size is an integer, the scale an integer from 1, at most 4000 calls a frame (the named limit of decisions/0124 О16)", () => {
  const palette = markedPalette("dark", ".37");
  for (const w of WINDOWS)
    for (const m of MOMENTS) {
      const one = drawMoment(m, w.input, palette, 1);
      for (const f of one.fills) {
        for (const v of [f.x, f.y, f.w, f.h])
          assert.ok(
            Number.isInteger(v),
            `${w.name} ${m.page}: ${JSON.stringify(f)}`,
          );
        assert.ok(
          f.w > 0 && f.h > 0,
          `${w.name}: an empty fill ${JSON.stringify(f)}`,
        );
        assert.ok(parseColour(f.style), `${w.name}: ${f.style}`);
      }
      assert.ok(one.calls <= 4000, `${w.name} ${m.page}: ${one.calls} calls`);
      // At scale 2 and 3 every fill is the scale-1 fill times the scale, with the same colour.
      for (const k of [2, 3, 4]) {
        const big = drawMoment(m, w.input, palette, k);
        assert.equal(big.fills.length, one.fills.length);
        for (let i = 0; i < one.fills.length; i++) {
          const a = one.fills[i];
          const b = big.fills[i];
          assert.deepEqual(
            [b.style, b.x, b.y, b.w, b.h],
            [a.style, a.x * k, a.y * k, a.w * k, a.h * k],
            `${w.name} scale ${k} fill ${i}`,
          );
        }
      }
    }
  // A scale that is no whole number from 1 is refused.
  const geom = scene.geometry(WINDOWS[0].input);
  const built = scene.buildScene({
    words: {
      stages: ["a", "b", "c", "d"],
      roles: ["a", "b", "c", "d"],
      you: "y",
      doorName: "d",
      doorTagline: "t",
    },
    state: scene.stateFor("landing", { kind: "load" }),
    geom,
  });
  for (const bad of [0, -1, 1.5, "2", null, Number.NaN, Infinity]) {
    const rec = recorder();
    assert.throws(
      () =>
        draw.drawScene(
          rec.ctx,
          built,
          palette,
          geom,
          { x: 24, frame: 0, walking: false },
          bad,
        ),
      RangeError,
      String(bad),
    );
    assert.equal(rec.log.length, 0, "nothing was drawn before the refusal");
    assert.throws(() => draw.drawAvatar(rec.ctx, 1, palette, bad), RangeError);
  }
  for (const bad of [0, 5, 1.5, "1", null])
    assert.throws(
      () => draw.drawAvatar(recorder().ctx, bad, palette, 1),
      RangeError,
    );

  // The bound of 4000 calls: every window of the scale rule of tokens.css (the scale by the size of the
  // window, the narrow rule below 760 px) up to 3 700 px wide draws at most 4000 calls in every state; the
  // named limit of decisions/0124 О16 above that (a room of at most 2000 logical px draws up to 4339 calls,
  // and a wider room has no stage map) is kept by the second assertion.
  const scaleFor = (/** @type {number} */ w, /** @type {number} */ h) =>
    w >= 1300 && h >= 700 ? 4 : w >= 1000 && h >= 640 ? 3 : 2;
  let most = 0;
  let mostAbove = 0;
  const widths = [
    ...Array.from({ length: 22 }, (_, k) => 320 + k * 160),
    3700,
    3780,
    3920,
    4000,
    5000,
    6760,
    8000,
  ];
  const heights = [
    ...Array.from({ length: 14 }, (_, k) => 360 + k * 80),
    620,
    630,
    639,
    1400,
  ];
  const sweepMoments = [MOMENTS[0], MOMENTS[MOMENTS.length - 1], MOMENTS[5]];
  for (const cw of widths)
    for (const ih of heights) {
      const s = scaleFor(cw, ih);
      if (Math.floor(cw / s) > 2000) continue;
      const input = { s, clientWidth: cw, innerHeight: ih, narrow: cw <= 759 };
      for (const m of sweepMoments)
        for (const theme of /** @type {const} */ (["light", "dark"])) {
          const calls = drawMoment(m, input, markedPalette(theme, ".37")).calls;
          if (cw <= 3700) most = Math.max(most, calls);
          else mostAbove = Math.max(mostAbove, calls);
        }
    }
  assert.ok(most > 1000, `the sweep drew ${most} calls at most`);
  assert.ok(most <= 4000, `a window up to 3700 px wide drew ${most} calls`);
  assert.ok(
    mostAbove <= 4339,
    `a wider window drew ${mostAbove} calls (the named limit is 4339)`,
  );
  // A room wider than 2000 logical px has no stage map: the stage view shows the text view there.
  assert.equal(grid.stageMap(2000) !== null, true);
  assert.equal(grid.stageMap(2001), null);
});

/**
 * Checks every fill of a drawing against the set that look 6.2 and 9.11 allow, and says which markers were
 * found. A fill is a given colour at alpha 1, the light layer (the channels of the dim marker with an alpha
 * the test computes), or a constant of the list of 6.2.
 * @param {ReturnType<typeof drawMoment>} d
 * @param {{ kind: "start" | "ask" | "result" }} m
 * @param {{ markers: Record<string, string>, dim: string, strength: string, light: string[] | null }} ctx
 * @returns {{ found: Set<string>, layer: Set<number>, findings: string[] }}
 */
function classify(d, m, ctx) {
  /** @type {Map<string, string>} */
  const byRgb = new Map();
  for (const name of PALETTE_NAMES)
    if (name !== "--sc-dim") byRgb.set(rgbKey(quad(ctx.markers[name])), name);
  const dim = quad(ctx.dim);
  const allowed = new Set(
    KEEPS[m.kind].map((k) => Number(roundedProduct(ctx.strength, k))),
  );
  /** @type {Set<string>} */
  const found = new Set();
  /** @type {Set<number>} */
  const layer = new Set();
  /** @type {string[]} */
  const findings = [];
  for (const f of d.fills) {
    const q = parseColour(f.style);
    if (q === null) {
      findings.push(`not a colour: ${f.style}`);
      continue;
    }
    if (rgbKey(q) === rgbKey(dim) && q.a !== 1) {
      found.add("--sc-dim");
      layer.add(q.a);
      if (!allowed.has(q.a)) findings.push(`light layer alpha ${q.a}`);
      continue;
    }
    const name = byRgb.get(rgbKey(q));
    if (name !== undefined) {
      found.add(name);
      if (q.a !== 1) findings.push(`${name} at alpha ${q.a}`);
      continue;
    }
    if (!CONSTANT_KEYS.has(key(q))) findings.push(`no such fill: ${f.style}`);
  }
  return { found, layer, findings };
}

test("OS-4 with 25 colour markers and a strength marker every fill is a given colour, the light layer with the computed alpha, or a constant of the look; every marker is found back", () => {
  // The markers are 25 distinct colours that are no constant and not the neutral colour.
  assert.equal(new Set(MARKERS).size, 25);
  for (const marker of MARKERS) {
    assert.ok(!CONSTANT_KEYS.has(key(quad(marker))), marker);
    assert.notEqual(marker, "#808080");
  }
  // The list of constants of the test is the list of the drawing: the same set, both ways.
  assert.equal(CONSTANT_KEYS.size, CONSTANT_LIST.length);
  assert.deepEqual(
    [
      ...new Set(draw.CONSTANTS.map((/** @type {string} */ c) => key(quad(c)))),
    ].sort(),
    [...CONSTANT_KEYS].sort(),
  );
  assert.deepEqual(
    [...draw.PALETTE_TOKENS],
    [...PALETTE_NAMES, "--sc-dim-alpha"],
  );

  for (const theme of /** @type {const} */ (["light", "dark"]))
    for (const strength of ["0.37", "0.91", "0.08"]) {
      /** @type {Set<string>} */
      const everything = new Set();
      for (const w of WINDOWS)
        for (const m of MOMENTS) {
          const d = drawMoment(m, w.input, markedPalette(theme, strength));
          const c = classify(d, m, {
            markers: MARKED,
            dim: MARKED["--sc-dim"],
            strength,
            light: null,
          });
          assert.deepEqual(
            c.findings,
            [],
            `${theme} ${strength} ${w.name} ${m.page} ${JSON.stringify(m.moment)}`,
          );
          // The alpha m stands where no band lies, in every state.
          assert.ok(
            c.layer.has(Number(strength)),
            `${w.name}: no alpha ${strength}`,
          );
          for (const name of c.found) everything.add(name);
        }
      assert.deepEqual(
        [...everything].sort(),
        [...PALETTE_NAMES].sort(),
        `${theme}: a marker was not found back`,
      );
    }
  // The strength marker is not .15 or .5: the alpha is the marker's, not the token's of the real theme.
  assert.notEqual(Number("0.37"), 0.15);
  // With real light and dark dim colours the dim layer is that colour with an alpha below 1.
  for (const theme of /** @type {const} */ (["light", "dark"])) {
    const d = drawMoment(
      MOMENTS[0],
      WINDOWS[0].input,
      draw.readPalette(
        getterOf({ ...MARKED, "--sc-dim": DIM[theme] }, "0.37"),
        theme,
      ),
    );
    const layer = d.fills.filter(
      (f) => rgbKey(quad(f.style)) === rgbKey(quad(DIM[theme])),
    );
    assert.ok(layer.length > 10, theme);
    for (const f of layer) assert.ok(quad(f.style).a < 1);
  }
});

test("OS-5 with .15 and .5 the alphas of the light layer in every state are exactly the closed lists of the look, the half-way products included", () => {
  // The test's own exact rounding gives the lists of the look from the strengths and the shares kept.
  for (const theme of /** @type {const} */ (["light", "dark"]))
    for (const kind of /** @type {const} */ (["start", "ask", "result"])) {
      assert.deepEqual(
        KEEPS[kind].map((k) => roundedProduct(STRENGTH[theme], k)),
        ALPHAS[theme][kind].map((a) => roundedProduct(a, "1")),
        `${theme} ${kind}`,
      );
      assert.equal(
        ALPHAS[theme][kind].length,
        { start: 9, ask: 4, result: 21 }[kind],
      );
    }
  // The half-way products, written in the look as exact, are rounded up and not down.
  assert.equal(roundedProduct(".15", ".729"), "0.1094");
  assert.equal(roundedProduct(".15", ".343"), "0.0515");
  assert.equal(roundedProduct(".5", ".6561"), "0.3281");
  assert.equal(roundedProduct(".5", ".24010"), "0.1201");
  assert.notEqual((0.15 * 0.729).toFixed(4), "0.1094");

  for (const theme of /** @type {const} */ (["light", "dark"])) {
    for (const w of WINDOWS)
      for (const m of MOMENTS) {
        const palette = draw.readPalette(
          getterOf({ ...MARKED, "--sc-dim": DIM[theme] }, STRENGTH[theme]),
          theme,
        );
        const d = drawMoment(m, w.input, palette);
        const dim = quad(DIM[theme]);
        const alphas = new Set(
          d.fills
            .map((f) => quad(f.style))
            .filter((q) => rgbKey(q) === rgbKey(dim) && q.a !== 1)
            .map((q) => q.a),
        );
        const want = ALPHAS[theme][m.kind].map(Number);
        assert.deepEqual(
          [...alphas].sort((a, b) => a - b),
          [...new Set(want)].sort((a, b) => a - b),
          `${theme} ${w.name} ${m.page} ${JSON.stringify(m.moment)}`,
        );
      }
  }
  // The four half-way alphas stand in the drawings: .0515 and .1094 in light, .3281 and .1201 in dark.
  /** @param {"light" | "dark"} theme @param {number} k */
  const alphasOf = (theme, k) => {
    const palette = draw.readPalette(
      getterOf({ ...MARKED, "--sc-dim": DIM[theme] }, STRENGTH[theme]),
      theme,
    );
    const d = drawMoment(MOMENTS[k], WINDOWS[0].input, palette);
    return new Set(d.fills.map((f) => quad(f.style).a));
  };
  assert.ok(alphasOf("light", 0).has(0.0515));
  assert.ok(alphasOf("light", MOMENTS.length - 1).has(0.1094));
  assert.ok(alphasOf("dark", 0).has(0.1201));
  assert.ok(alphasOf("dark", MOMENTS.length - 1).has(0.3281));
  // lightAlpha itself, on the closed lists and on the half-way cases, as a text with no trailing zeros.
  assert.equal(draw.lightAlpha(0.15, 0.729), "0.1094");
  assert.equal(draw.lightAlpha(0.15, 0.343), "0.0515");
  assert.equal(draw.lightAlpha(0.5, 0.6561), "0.3281");
  assert.equal(draw.lightAlpha(0.5, 0.2401), "0.1201");
  assert.equal(draw.lightAlpha(0.15, 1), "0.15");
  assert.equal(draw.lightAlpha(0, 0.7), "0");
  for (const theme of /** @type {const} */ (["light", "dark"]))
    for (const kind of /** @type {const} */ (["start", "ask", "result"]))
      KEEPS[kind].forEach((k, i) =>
        assert.equal(
          draw.lightAlpha(Number(STRENGTH[theme]), Number(k)),
          roundedProduct(STRENGTH[theme], k),
          `${theme} ${kind} ${i}`,
        ),
      );
});

test("OS-6 a colour that is not #rrggbb is drawn #808080 and a strength that is not a number from 0 to 1 draws the light layer at alpha 0, with no exception", () => {
  // readPalette: the colour and the strength of the palette.
  /** @type {unknown[]} */
  const badColours = [
    "red",
    "#fff",
    "#12345",
    "#1234567",
    "#gggggg",
    "rgb(1, 2, 3)",
    "#12345678",
    "",
    " #aabbcc",
    "#aabbcc ",
    "#aabbcc;",
    1,
    null,
    undefined,
    {},
  ];
  for (const bad of badColours) {
    const p = draw.readPalette(
      (/** @type {string} */ name) =>
        name === "--sc-wall" ? bad : MARKED[name],
      "light",
    );
    assert.equal(p.colours["--sc-wall"], "#808080", String(bad));
    assert.equal(p.colours["--sc-wall-top"], MARKED["--sc-wall-top"]);
  }
  const throwing = draw.readPalette(() => {
    throw new Error("no token");
  }, "dark");
  for (const name of PALETTE_NAMES)
    assert.equal(throwing.colours[name], "#808080");
  assert.equal(throwing.strength, 0);
  assert.equal(throwing.theme, "dark");
  assert.equal(draw.readPalette(null, "light").colours["--ink"], "#808080");
  // An upper-case #RRGGBB is a colour, kept in lower case.
  assert.equal(
    draw.readPalette(() => "#ABCDEF", "light").colours["--sc-wall"],
    "#abcdef",
  );
  for (const [text, want] of /** @type {Array<[string, number]>} */ ([
    [".15", 0.15],
    ["0.5", 0.5],
    ["0", 0],
    ["1", 1],
    ["1.000", 1],
    ["0.37", 0.37],
    ["abc", 0],
    ["", 0],
    ["-0.1", 0],
    ["-1", 0],
    ["1.01", 0],
    ["2", 0],
    ["10", 0],
    ["NaN", 0],
    ["Infinity", 0],
  ])) {
    const p = draw.readPalette(
      (/** @type {string} */ name) =>
        name === "--sc-dim-alpha" ? text : MARKED[name],
      "light",
    );
    assert.equal(p.strength, want, JSON.stringify(text));
  }
  for (const bad of [null, undefined, 0.5, {}])
    assert.equal(
      draw.readPalette(
        (/** @type {string} */ name) =>
          name === "--sc-dim-alpha" ? bad : MARKED[name],
        "light",
      ).strength,
      0,
      String(bad),
    );

  // drawScene, call by call against the drawing of the good palette: where a colour marker was, #808080
  // is; where the light layer was, the same rectangle with the channels of the dim colour or alpha 0.
  const good = markedPalette("light", "0.37");
  const win = WINDOWS[1].input;
  for (const m of [MOMENTS[0], MOMENTS[MOMENTS.length - 1], MOMENTS[5]]) {
    const base = drawMoment(m, win, good);
    const dimRgb = rgbKey(quad(MARKED["--sc-dim"]));
    // Each of the 25 colours bad in turn, through readPalette and through a hand-made palette.
    for (const [k, name] of PALETTE_NAMES.entries()) {
      for (const bad of ["red", "#12", "", "rgb(1,2,3)"]) {
        const viaGet = draw.readPalette(
          getterOf({ ...MARKED, [name]: bad }, "0.37"),
          "light",
        );
        const byHand = {
          theme: "light",
          colours: { ...good.colours, [name]: bad },
          strength: 0.37,
        };
        for (const palette of [viaGet, byHand]) {
          const d = drawMoment(m, win, palette);
          assert.equal(d.fills.length, base.fills.length);
          for (let i = 0; i < base.fills.length; i++) {
            const a = quad(base.fills[i].style);
            const b = quad(d.fills[i].style);
            const wasMarker =
              rgbKey(a) === rgbKey(quad(MARKERS[k])) && a.a === 1;
            const wasDim =
              name === "--sc-dim" && rgbKey(a) === dimRgb && a.a !== 1;
            if (wasMarker)
              assert.equal(d.fills[i].style, "#808080", `${name} fill ${i}`);
            else if (wasDim)
              assert.deepEqual(
                [b.r, b.g, b.b, b.a],
                [128, 128, 128, a.a],
                `${name} light layer ${i}`,
              );
            else
              assert.equal(
                d.fills[i].style,
                base.fills[i].style,
                `${name} fill ${i}`,
              );
            assert.deepEqual(
              [d.fills[i].x, d.fills[i].y, d.fills[i].w, d.fills[i].h],
              [
                base.fills[i].x,
                base.fills[i].y,
                base.fills[i].w,
                base.fills[i].h,
              ],
            );
          }
        }
      }
      assert.ok(base.fills.length > 100, name);
    }
    // A strength that is no number from 0 to 1: every fill of the light layer has alpha 0.
    for (const bad of [
      "abc",
      "",
      "-0.1",
      "1.01",
      "2",
      "NaN",
      null,
      undefined,
    ]) {
      const viaGet = draw.readPalette(
        (/** @type {string} */ name) =>
          name === "--sc-dim-alpha" ? bad : MARKED[name],
        "light",
      );
      const byHand = { theme: "light", colours: good.colours, strength: bad };
      for (const palette of [viaGet, byHand]) {
        const d = drawMoment(m, win, palette);
        let layer = 0;
        for (let i = 0; i < base.fills.length; i++) {
          const a = quad(base.fills[i].style);
          const b = quad(d.fills[i].style);
          if (rgbKey(a) === dimRgb && a.a !== 1) {
            layer += 1;
            assert.equal(b.a, 0, `${String(bad)} fill ${i}`);
            assert.equal(rgbKey(b), dimRgb);
          } else assert.equal(d.fills[i].style, base.fills[i].style);
        }
        assert.ok(layer > 10);
      }
    }
    // The numbers 1.5, -0.2 and NaN given as numbers to a hand-made palette: alpha 0 too.
    for (const bad of [1.5, -0.2, Number.NaN, Infinity]) {
      const d = drawMoment(m, win, {
        theme: "light",
        colours: good.colours,
        strength: bad,
      });
      for (const f of d.fills) {
        const q = quad(f.style);
        if (rgbKey(q) === dimRgb && q.a !== 1) assert.equal(q.a, 0);
      }
    }
  }
  // Nothing at all is a palette: every fill is the neutral colour or a constant, no exception.
  for (const palette of [null, undefined, {}, "x", { colours: null }]) {
    const d = drawMoment(MOMENTS[0], win, palette);
    for (const f of d.fills) {
      const q = quad(f.style);
      assert.ok(
        f.style === "#808080" || CONSTANT_KEYS.has(key(q)) || q.a === 0,
        f.style,
      );
    }
  }
  assert.equal(draw.NEUTRAL_COLOUR, "#808080");
  assert.equal(draw.NEUTRAL_STRENGTH, 0);
});

test("OS-7 the stage map and the walker that the port adds: one row of floor, straight paths, 72 cells a second, a step frame every 160 ms", () => {
  // stageMap: a frozen one-row layout read by cellKind, walkable, canStep and findPath.
  for (const width of [1, 2, 5, 120, 350, 2000]) {
    const map = grid.stageMap(width);
    assert.ok(map, String(width));
    assert.ok(Object.isFrozen(map));
    assert.deepEqual(
      { ...map, desks: [...map.desks], partitions: [...map.partitions] },
      {
        desk_count: 0,
        extra_columns: 0,
        columns: 0,
        min_x: 0,
        max_x: width - 1,
        width,
        height: 1,
        desks: [],
        partitions: [],
      },
    );
    for (const x of [0, Math.floor(width / 2), width - 1]) {
      assert.equal(grid.cellKind(map, x, 0), "floor");
      assert.equal(grid.walkable(map, x, 0), true);
      assert.equal(grid.walkable(map, x, 1), false);
      assert.equal(grid.walkable(map, x, -1), false);
    }
    assert.equal(grid.cellKind(map, -1, 0), "outside");
    assert.equal(grid.cellKind(map, width, 0), "outside");
    assert.equal(grid.walkable(map, width, 0), false);
    assert.equal(grid.walkable(map, -1, 0), false);
    if (width > 1) {
      assert.equal(grid.canStep(map, 0, 0, 1, 0), true);
      assert.equal(grid.canStep(map, 1, 0, 0, 0), true);
      assert.equal(grid.canStep(map, width - 1, 0, width - 2, 0), true);
    }
    assert.equal(grid.canStep(map, width - 1, 0, width, 0), false);
    assert.equal(grid.canStep(map, 0, 0, -1, 0), false);
    assert.equal(grid.canStep(map, 0, 0, 0, 1), false);
    assert.equal(grid.canStep(map, 0, 0, 1, 1), false);
    assert.equal(grid.canStep(map, 0, 0, 2, 0), false);
    // Every cell walkable: the whole row (a sample of the cells of a long one).
    const cells =
      width <= 350 ? [...Array(width).keys()] : [0, 1, 999, 1998, 1999];
    for (const x of cells)
      assert.equal(grid.walkable(map, x, 0), true, `${width}:${x}`);
    // findPath is straight: the cells after `from` up to and including `to`.
    for (const [a, b] of [
      [0, width - 1],
      [width - 1, 0],
      [Math.floor(width / 3), Math.floor((2 * width) / 3)],
      [0, 0],
    ]) {
      const want = [];
      const sign = Math.sign(b - a);
      for (let x = a + sign; sign !== 0 && x !== b + sign; x += sign)
        want.push([x, 0]);
      assert.deepEqual(
        grid.findPath(map, [a, 0], [b, 0]),
        want,
        `${width}: ${a} → ${b}`,
      );
    }
    assert.equal(grid.findPath(map, [0, 0], [width, 0]), null);
    assert.equal(grid.findPath(map, [-1, 0], [0, 0]), null);
    assert.equal(grid.findPath(map, [0, 0], [0, 1]), null);
  }
  // No stage map for a width that is no whole number from 1 to 2000.
  for (const bad of [
    0,
    -1,
    1.5,
    2001,
    100000,
    Number.NaN,
    Infinity,
    "5",
    null,
    undefined,
    {},
    [],
    2 ** 31,
  ])
    assert.equal(grid.stageMap(bad), null, String(bad));
  // Two maps are two maps: a map is read by its own table.
  const [one, two] = [grid.stageMap(10), grid.stageMap(20)];
  assert.notEqual(one, two);
  assert.equal(grid.walkable(one, 15, 0), false);
  assert.equal(grid.walkable(two, 15, 0), true);

  // The walker.
  const map = grid.stageMap(400);
  const walker = sim.createWalker({ map, x: 24 });
  assert.ok(walker);
  assert.deepEqual(
    { ...walker.position() },
    { x: 24, walking: false, frame: 0 },
  );
  // The walk: 72 cells a second, a step frame every 160 ms of walking, none while standing.
  assert.equal(walker.walkTo(240), true);
  assert.equal(walker.walkTo(240), false, "the walk to this cell has started");
  assert.equal(walker.position().walking, true);
  assert.equal(walker.position().x, 24, "no jump at the start");
  assert.equal(walker.tick(0.5), true);
  assert.deepEqual(
    { ...walker.position() },
    { x: 60, walking: true, frame: 1 },
  );
  assert.equal(walker.tick(0.1), true);
  assert.deepEqual(
    { ...walker.position() },
    { x: 67, walking: true, frame: 1 },
    "7.2 cells",
  );
  assert.equal(walker.tick(0.05), true);
  assert.equal(
    walker.position().frame,
    0,
    "650 ms is 4.06 frames of 160 ms: frame 0 again",
  );
  // Frames by the time walked: floor(ms / 160) mod 2, on steps that never end on a frame edge.
  const frames = sim.createWalker({ map, x: 0 });
  frames.walkTo(399);
  /** @type {number[]} */
  const seen = [];
  for (let k = 0; k < 130; k++) {
    frames.tick(0.0123);
    seen.push(frames.position().frame);
  }
  assert.deepEqual(
    seen,
    Array.from(
      { length: 130 },
      (_, i) => Math.floor(((i + 1) * 12.3) / 160) % 2,
    ),
  );
  assert.ok(seen.includes(0) && seen.includes(1));
  // It arrives, stands and its frame is 0 again; the time it took is the distance over the speed.
  const run = sim.createWalker({ map, x: 24 });
  run.walkTo(24 + 72);
  let elapsed = 0;
  while (run.position().walking && elapsed < 3) {
    run.tick(0.05);
    elapsed += 0.05;
  }
  assert.ok(Math.abs(elapsed - 1) < 0.051, `72 cells took ${elapsed} s`);
  assert.deepEqual({ ...run.position() }, { x: 96, walking: false, frame: 0 });
  assert.equal(run.tick(0.5), false, "standing: tick answers false");
  assert.equal(run.walkTo(96), false, "a walk to the current place");

  // A walkTo during a walk starts from the cell where the walker is: no jump, and a turn back works.
  const turn = sim.createWalker({ map, x: 24 });
  turn.walkTo(300);
  turn.tick(0.5);
  assert.equal(turn.position().x, 60);
  assert.equal(turn.walkTo(30), true, "a new target during a walk");
  assert.equal(turn.position().x, 60, "no jump at the turn");
  turn.tick(0.1);
  assert.equal(turn.position().x, 53);
  assert.equal(turn.position().walking, true);
  let guard = 0;
  while (turn.position().walking && guard++ < 200) turn.tick(0.05);
  assert.deepEqual({ ...turn.position() }, { x: 30, walking: false, frame: 0 });
  assert.equal(turn.walkTo(5000), false, "an unreachable cell");
  assert.equal(turn.walkTo(-1), false);
  assert.equal(turn.walkTo(1.5), false);
  assert.deepEqual({ ...turn.position() }, { x: 30, walking: false, frame: 0 });

  // place stands at once, with no walk, and cancels a walk.
  const placed = sim.createWalker({ map, x: 24 });
  placed.walkTo(300);
  placed.tick(0.3);
  assert.equal(placed.place(100), true);
  assert.deepEqual(
    { ...placed.position() },
    { x: 100, walking: false, frame: 0 },
  );
  assert.equal(placed.tick(1), false);
  assert.equal(placed.position().x, 100);
  assert.equal(placed.place(5000), false);
  assert.equal(placed.place(-3), false);
  assert.equal(placed.position().x, 100);
  assert.equal(placed.walkTo(100), false);

  // No walker for what cannot be one: no map, a cell outside the map, a speed or a frame time that is no
  // positive number, and a map that is not made by this grid.js.
  assert.equal(sim.createWalker({ map: null, x: 0 }), null);
  assert.equal(sim.createWalker({ map, x: 400 }), null);
  assert.equal(sim.createWalker({ map, x: -1 }), null);
  assert.equal(sim.createWalker({ map, x: 24, speed: 0 }), null);
  assert.equal(sim.createWalker({ map, x: 24, speed: Number.NaN }), null);
  assert.equal(sim.createWalker({ map, x: 24, frameMs: -1 }), null);
  assert.equal(sim.createWalker({ map, x: 24, frameMs: 0 }), null);
  assert.equal(sim.createWalker({ map: { ...map }, x: 24 }), null);
  assert.equal(sim.createWalker({ map: grid.buildLayout(4), x: 3 }), null);
  // Another speed and frame time are honoured.
  const slow = sim.createWalker({ map, x: 0, speed: 10, frameMs: 100 });
  slow.walkTo(50);
  slow.tick(1.03);
  assert.deepEqual({ ...slow.position() }, { x: 10, walking: true, frame: 0 });
  slow.tick(0.1);
  assert.equal(slow.position().frame, 1);
});
