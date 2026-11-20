// The drawing of the stage scene in the approved look: the room, the door, the furniture, the four
// people, the light of the desks and the visitor's figure (the look's 6.2 and 9.1-9.11), and the
// avatar of a person (its 9.15). Pure: it draws on the 2D context it is given, in the palette it is
// given, by setting fillStyle and calling fillRect with whole numbers, nothing else, and it reads no
// page, no clock and no chance. No text is drawn: the words of the scene are labels over the canvas.
// Every fillStyle is a colour of the palette, a constant of the look's 6.2, or the light layer: the
// colour --sc-dim with an alpha computed in exact decimals.

/** @typedef {import("./stage-scene.js").Geometry} Geometry */
/** @typedef {import("./stage-scene.js").Scene} Scene */

/**
 * The context the drawing uses: it sets fillStyle and calls fillRect, nothing else.
 * @typedef {{ fillStyle: unknown, fillRect: (x: number, y: number, w: number, h: number) => void }} DrawContext
 */

/**
 * The palette of the scene for one theme: the 24 colour tokens and --ink, each #rrggbb in lower case
 * (or the neutral colour), and the strength of the light layer, a number from 0 to 1.
 * @typedef {object} Palette
 * @property {"light" | "dark"} theme
 * @property {Readonly<Record<string, string>>} colours
 * @property {number} strength
 */

/**
 * Where the visitor's figure is drawn: its x, its step frame and whether it walks.
 * @typedef {{ x: number, frame: number, walking: boolean }} YouPlace
 */

/**
 * A rectangle of the light layer and what the bands over it keep of the dimming.
 * @typedef {{ x: number, y: number, w: number, h: number, keep: number }} LightRect
 */

/** @typedef {(x: number, y: number, w: number, h: number, colour: string) => void} Fill */

/** An exact decimal: the whole number n over 10 to the power e. */
/** @typedef {{ n: bigint, e: number }} Decimal */

/** The 24 colour tokens of the scene (the look's 6.2), in its order. */
const COLOUR_TOKENS = Object.freeze([
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
]);

/** The palette the drawing reads, and nothing else: the 24 colour tokens, --ink and the strength. */
export const PALETTE_TOKENS = Object.freeze([
  ...COLOUR_TOKENS,
  "--ink",
  "--sc-dim-alpha",
]);

/** The colour drawn for a palette colour that is not #rrggbb. */
export const NEUTRAL_COLOUR = "#808080";

/** The strength of the light layer when the palette's strength is not a number from 0 to 1. */
export const NEUTRAL_STRENGTH = 0;

/** The constants of the scene, the same in both themes (the look's 6.2). */
const C = Object.freeze({
  accent: "#e0731f",
  accent2: "#1f7a8c",
  doorTop: "#579ba9",
  doorPanel: "#196270",
  gold: "#e8b64c",
  white: "#ffffff",
  sun: "#ffe9a0",
  moon: "#f4ecc8",
  beam: "rgba(255, 242, 184, 0.16)",
  shadow: "rgba(0, 0, 0, 0.22)",
  pot: "#8a5a3c",
  potRim: "#a8723f",
  stem: "#2e9a55",
  leaf: "#41a15f",
  cork: "#c9a073",
  note: "#f4d777",
  red: "#d8473f",
  green: "#3fae6a",
  binder: "#6aa3b5",
  accentEdge: "#e99d62",
  accent2Edge: "#62a2af",
  binderEdge: "#97bfcb",
  goldEdge: "#efcc82",
  blueprintEdge: "#2f6fa6",
  blueprint: "#3b86c4",
  blueprintLine: "#cfe6f7",
  grey: "#8a97ad",
  printer: "#cdd3de",
  printerTop: "#eef1f6",
  printerEdge: "#9aa6bb",
  printerSlot: "#2c3547",
  monitor: "#0d1420",
  screen: "#10283a",
  code: "#9fd0e6",
  mug: "#f2f2f2",
  coffee: "#6a4a2c",
  steam: "#ffffffaa",
  bulbOn: "#ffd98a",
  bulbOff: "#7a8499",
  glowFull: "rgba(255, 217, 138, 0.16)",
  glowThreeQuarters: "rgba(255, 217, 138, 0.12)",
  stack: "#e8e3d4",
  bellLight: "#f1d394",
  boxTop: "#e47e79",
  eye: "#1d1712",
  cheek: "#e8a08c",
  mouth: "#8a3a30",
  hand: "#e9c4a0",
  legs: "#2d3446",
  shoes: "#161b26",
  visitorHair: "#3a2c22",
  neck: "#d9b08a",
  visitorHairTop: "#2a1f18",
});

/**
 * The four people, desk 1 to desk 4 (the look's 9.6): skin and its shade, hair and its hairdo, the
 * shirt with its light top rows and its dark bottom rows.
 * @typedef {{ skin: string, skinShade: string, hair: string, hairdo: "long" | "short" | "cap" | "bun", shirt: string, shirtLight: string, shirtDark: string }} Look
 */
/** @type {readonly Look[]} */
const PEOPLE = Object.freeze([
  Object.freeze({
    skin: "#f0cfae",
    skinShade: "#ceb296",
    hair: "#2b1d17",
    hairdo: /** @type {"long"} */ ("long"),
    shirt: "#e0731f",
    shirtLight: "#e68c47",
    shirtDark: "#af5a18",
  }),
  Object.freeze({
    skin: "#e7bd96",
    skinShade: "#c7a381",
    hair: "#1f1a17",
    hairdo: /** @type {"short"} */ ("short"),
    shirt: "#1f7a8c",
    shirtLight: "#4792a1",
    shirtDark: "#185f6d",
  }),
  Object.freeze({
    skin: "#f0cfae",
    skinShade: "#ceb296",
    hair: "#6a4a2c",
    hairdo: /** @type {"cap"} */ ("cap"),
    shirt: "#c99a2e",
    shirtLight: "#d3ac54",
    shirtDark: "#9d7824",
  }),
  Object.freeze({
    skin: "#e7bd96",
    skinShade: "#c7a381",
    hair: "#241915",
    hairdo: /** @type {"bun"} */ ("bun"),
    shirt: "#2f5560",
    shirtLight: "#54747d",
    shirtDark: "#25424b",
  }),
]);

/** Every constant fillStyle of the scene, each value once: the closed list of the look's 6.2. */
export const CONSTANTS = Object.freeze([
  ...new Set([
    ...Object.values(C),
    ...PEOPLE.flatMap((p) => [
      p.skin,
      p.skinShade,
      p.hair,
      p.shirt,
      p.shirtLight,
      p.shirtDark,
    ]),
  ]),
]);

/** A colour of the palette, #rrggbb in either case. */
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
/** A strength of the palette: a plain decimal number. */
const DECIMAL = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * The value get gives for a token, or null when it is no string or get throws.
 * @param {unknown} get
 * @param {string} name
 * @returns {string | null}
 */
function readToken(get, name) {
  if (typeof get !== "function") return null;
  try {
    const value = get(name);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/**
 * A colour of the palette: #rrggbb in lower case, or NEUTRAL_COLOUR for anything else.
 * @param {unknown} value
 * @returns {string}
 */
const colourOf = (value) =>
  typeof value === "string" && HEX_COLOUR.test(value)
    ? value.toLowerCase()
    : NEUTRAL_COLOUR;

/**
 * The strength of the light layer: a number from 0 to 1, or a decimal text of one; NEUTRAL_STRENGTH
 * for anything else.
 * @param {unknown} value
 * @returns {number}
 */
function strengthOf(value) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && DECIMAL.test(value)
        ? Number(value)
        : Number.NaN;
  return number >= 0 && number <= 1 ? number : NEUTRAL_STRENGTH;
}

/**
 * The palette for a theme, from get(name), the computed value of a token: a colour that is not
 * #rrggbb (in either case; kept in lower case) becomes NEUTRAL_COLOUR, and a strength that is not a
 * decimal number from 0 to 1 becomes NEUTRAL_STRENGTH. It never throws.
 * @param {unknown} get
 * @param {unknown} theme "light" or "dark"; anything else is read as light
 * @returns {Palette}
 */
export function readPalette(get, theme) {
  /** @type {Record<string, string>} */
  const colours = {};
  for (const name of [...COLOUR_TOKENS, "--ink"])
    colours[name] = colourOf(readToken(get, name));
  const raw = readToken(get, "--sc-dim-alpha");
  return Object.freeze({
    theme: theme === "dark" ? "dark" : "light",
    colours: Object.freeze(colours),
    strength:
      raw !== null && DECIMAL.test(raw) ? strengthOf(raw) : NEUTRAL_STRENGTH,
  });
}

/**
 * The palette as the drawing uses it, by the same rules as readPalette, also for a palette that did
 * not come from it: each colour #rrggbb or NEUTRAL_COLOUR, the strength from 0 to 1 or
 * NEUTRAL_STRENGTH, the theme light unless it is "dark".
 * @param {unknown} palette
 * @returns {{ colours: Readonly<Record<string, string>>, strength: number, dark: boolean }}
 */
function paletteOf(palette) {
  const p =
    palette !== null && typeof palette === "object"
      ? /** @type {Record<string, unknown>} */ (palette)
      : {};
  const given =
    p.colours !== null && typeof p.colours === "object"
      ? /** @type {Record<string, unknown>} */ (p.colours)
      : {};
  /** @type {Record<string, string>} */
  const colours = {};
  for (const name of [...COLOUR_TOKENS, "--ink"])
    colours[name] = colourOf(Object.hasOwn(given, name) ? given[name] : null);
  return {
    colours: Object.freeze(colours),
    strength: strengthOf(p.strength),
    dark: p.theme === "dark",
  };
}

/**
 * The exact decimal of a number from 0 (by its shortest text, the one it was written as) or of a
 * plain decimal text; null for anything else.
 * @param {unknown} value
 * @returns {Decimal | null}
 */
function decimalOf(value) {
  let text;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    text = String(value);
  else if (typeof value === "string" && DECIMAL.test(value)) text = value;
  else return null;
  const m = /^(\d*)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(text);
  if (m === null) return null;
  const fraction = m[2] ?? "";
  let e = fraction.length - Number(m[3] ?? 0);
  let n = BigInt(`${m[1] || "0"}${fraction}`);
  if (e < 0) {
    n *= 10n ** BigInt(-e);
    e = 0;
  }
  return { n, e };
}

/**
 * @param {Decimal} a
 * @param {Decimal} b
 * @returns {Decimal}
 */
const times = (a, b) => ({ n: a.n * b.n, e: a.e + b.e });

/**
 * One minus a decimal.
 * @param {Decimal} a
 * @returns {Decimal}
 */
const oneMinus = (a) => ({ n: 10n ** BigInt(a.e) - a.n, e: a.e });

/**
 * The text of a decimal from 0: no trailing zeros, «0.» before a fraction of one.
 * @param {Decimal} a
 * @returns {string}
 */
function textOf(a) {
  const digits = a.n.toString().padStart(a.e + 1, "0");
  const whole = digits.slice(0, digits.length - a.e);
  const fraction = digits.slice(digits.length - a.e).replace(/0+$/, "");
  return fraction === "" ? whole : `${whole}.${fraction}`;
}

/** @type {Decimal} */
const ONE = Object.freeze({ n: 1n, e: 0 });

/**
 * The alpha of a fill of the light layer: the strength times what the bands keep, in exact decimal
 * arithmetic (whole numbers scaled by powers of ten), rounded half up to 4 decimals and written with
 * no trailing zeros, so .15 × .729 gives "0.1094" (a binary floating-point product gives 0.1093).
 * "0" when either is not a number from 0.
 * @param {unknown} strength
 * @param {unknown} keep
 * @returns {string}
 */
export function lightAlpha(strength, keep) {
  const a = decimalOf(strength);
  const b = decimalOf(keep);
  if (a === null || b === null) return "0";
  const p = times(a, b);
  let q;
  if (p.e <= 4) q = p.n * 10n ** BigInt(4 - p.e);
  else {
    const d = 10n ** BigInt(p.e - 4);
    q = p.n / d;
    if ((p.n % d) * 2n >= d) q += 1n;
  }
  return textOf({ n: q, e: 4 });
}

/** The half widths of the three bands of light of a desk at the bottom row (the look's 9.11). */
const BAND_HALVES = Object.freeze([56, 46, 36]);

/**
 * The light layer as rectangles, in rows of 2 (the last row 1 when H is odd), each a run of one row
 * over which the set of covering bands is constant, from x 0 to Rw. Each lit desk (L > 0) has three
 * nested bands whose half width narrows upwards as round(half × (.55 + .45 × y / H)), plus 6 on each
 * side; a band keeps 1 − .4 × L, 1 − .4 × L and 1 − .5 × L of the dimming, and a point under several
 * bands keeps the product. `keep` is that product, computed exactly, and 1 where no band lies.
 * @param {Geometry} geom
 * @param {readonly number[]} light the light level of each desk, desk 1 to desk 4
 * @returns {LightRect[]}
 */
export function lightRects(geom, light) {
  const { H, Rw } = geom;
  /** @type {Array<{ cx: number, factors: Decimal[] }>} */
  const lit = [];
  for (let i = 0; i < 4; i++) {
    const L = light[i];
    const level = decimalOf(L);
    if (level === null || !(L > 0)) continue;
    const forty = oneMinus(times({ n: 4n, e: 1 }, level));
    const fifty = oneMinus(times({ n: 5n, e: 1 }, level));
    lit.push({ cx: geom.cx[i], factors: [forty, forty, fifty] });
  }
  /** @type {LightRect[]} */
  const out = [];
  for (let y = 0; y < H; y += 2) {
    const h = Math.min(2, H - y);
    /** @type {Array<{ from: number, to: number, factor: Decimal }>} */
    const bands = [];
    for (const desk of lit) {
      for (let b = 0; b < 3; b++) {
        const w = Math.round(BAND_HALVES[b] * (0.55 + 0.45 * (y / H)));
        bands.push({
          from: desk.cx - w - 6,
          to: desk.cx + w + 6,
          factor: desk.factors[b],
        });
      }
    }
    const edges = new Set([0, Rw]);
    for (const band of bands) {
      for (const x of [band.from, band.to]) if (x > 0 && x < Rw) edges.add(x);
    }
    const xs = [...edges].sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k++) {
      const from = xs[k];
      const to = xs[k + 1];
      let keep = ONE;
      for (const band of bands) {
        if (band.from <= from && to <= band.to) keep = times(keep, band.factor);
      }
      out.push(
        Object.freeze({
          x: from,
          y,
          w: to - from,
          h,
          keep: Number(textOf(keep)),
        }),
      );
    }
  }
  return out;
}

/**
 * The fill of a whole-pixel rectangle at an integer scale, counting the calls.
 * @param {DrawContext} ctx
 * @param {number} scale
 * @param {{ calls: number }} count
 * @returns {Fill}
 */
function filler(ctx, scale, count) {
  return (x, y, w, h, colour) => {
    ctx.fillStyle = colour;
    ctx.fillRect(
      Math.round(x) * scale,
      Math.round(y) * scale,
      w * scale,
      h * scale,
    );
    count.calls += 1;
  };
}

/**
 * The rgba text of a colour #rrggbb with an alpha text.
 * @param {string} colour
 * @param {string} alpha
 * @returns {string}
 */
function rgba(colour, alpha) {
  const channel = (/** @type {number} */ k) =>
    Number.parseInt(colour.slice(k, k + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
}

/**
 * A person at a desk, in the pose «attend» (leaning 1 px towards the visitor, the mouth open) or
 * «type», with the eyes open (the look's 9.6): the chair, the torso and the arms, the neck and the
 * head, the hair by its hairdo, the face. px is the centre of the person, dt the top of the desk.
 * @param {Fill} R
 * @param {Readonly<Record<string, string>>} P
 * @param {number} px
 * @param {number} dt
 * @param {Look} look
 * @param {boolean} attend
 */
function drawPerson(R, P, px, dt, look, attend) {
  const { skin, skinShade, hair, shirt, shirtLight, shirtDark } = look;
  const lean = attend ? 1 : 0;
  const head = dt - 19 + lean;
  R(px - 9, dt - 14, 18, 16, P["--sc-chair"]);
  R(px - 9, dt - 14, 18, 2, P["--sc-chair-hi"]);
  R(px - 9, dt - 2, 18, 2, P["--sc-chair-lo"]);
  R(px - 6, dt - 9 + lean, 12, 9, shirt);
  R(px - 6, dt - 9 + lean, 12, 2, shirtLight);
  R(px - 6, dt - 3, 12, 3, shirtDark);
  R(px - 8, dt - 8, 2, 8, shirtDark);
  R(px + 6, dt - 8, 2, 8, shirtDark);
  R(px - 1, dt - 11 + lean, 2, 3, skinShade);
  R(px - 4, head, 8, 9, skin);
  R(px - 4, head + 8, 8, 1, skinShade);
  R(px - 4, head - 1, 8, 4, hair);
  if (look.hairdo === "short") {
    R(px - 5, head + 1, 1, 3, hair);
    R(px + 4, head + 1, 1, 3, hair);
  } else if (look.hairdo === "long") {
    R(px - 5, head, 1, 11, hair);
    R(px + 4, head, 1, 11, hair);
    R(px - 6, head + 8, 2, 4, hair);
    R(px + 4, head + 8, 2, 4, hair);
    R(px - 5, head - 1, 10, 3, hair);
  } else if (look.hairdo === "bun") {
    R(px - 2, head - 4, 4, 3, hair);
    R(px - 3, head - 2, 6, 1, hair);
    R(px - 5, head + 1, 1, 3, hair);
    R(px + 4, head + 1, 1, 3, hair);
  } else {
    R(px - 5, head - 2, 10, 4, shirtDark);
    R(px - 5, head + 2, 11, 1, shirtDark);
    R(px - 3, head - 3, 6, 1, shirtDark);
    R(px - 5, head + 3, 1, 2, hair);
    R(px + 4, head + 3, 1, 2, hair);
  }
  R(px - 2, head + 4, 1, 2, C.eye);
  R(px + 1, head + 4, 1, 2, C.eye);
  R(px - 3, head + 6, 1, 1, C.cheek);
  R(px + 2, head + 6, 1, 1, C.cheek);
  R(px - 1, head + 7, 2, 1, attend ? C.mouth : skinShade);
}

/**
 * Whether a value is a whole number from 1.
 * @param {unknown} v
 * @returns {v is number}
 */
const wholeFromOne = (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1;

/**
 * Draws the scene on the canvas bitmap of Rw × H logical px, each logical px a square of `scale`
 * bitmap px, in the order of the look's 9.2: (1) the wall, the floor, the rug, the windows, the door,
 * the desk shadows and the plant; (2) the wall decor; (3) the printer at desk 4; (4) per desk the
 * person, the desk, the monitor, the mug, the hands, the lamp and the desk items; (5) the light layer
 * and, in the dark theme, the lamp glow; (6) the visitor's figure at you.x. Only fillRect after
 * fillStyle, whole numbers only. Returns the number of fillRect calls. A scale that is not a whole
 * number from 1 is a RangeError.
 * @param {DrawContext} ctx
 * @param {Scene} scene
 * @param {Palette} palette
 * @param {Geometry} geom
 * @param {YouPlace} you
 * @param {number} [scale]
 * @returns {number}
 */
export function drawScene(ctx, scene, palette, geom, you, scale = 1) {
  if (!wholeFromOne(scale))
    throw new RangeError("draw: the scale is not a whole number from 1");
  const count = { calls: 0 };
  const R = filler(ctx, scale, count);
  const { colours: P, strength, dark } = paletteOf(palette);
  const { H, Rw, sp } = geom;
  const wh = geom.wallH;
  const dt = geom.deskTop;
  const desks = scene.desks;

  // (1) The wall with its top rows, its base band and two trim lines.
  R(0, 0, Rw, wh, P["--sc-wall"]);
  R(0, 0, Rw, 2, P["--sc-wall-top"]);
  R(0, wh - 7, Rw, 7, P["--sc-wall-b"]);
  R(0, wh - 8, Rw, 1, P["--sc-trim"]);
  R(0, wh, Rw, 1, P["--sc-trim"]);
  // The floor of 8 × 8 checks, --sc-floor-a and --sc-floor-b by (i + j) % 2, from wh + 1: the
  // floor-a colour over the whole floor, then the floor-b checks on it. The pixels are those of one
  // fill per check (the sample's way); the calls are half, so a wide room keeps within 4 000.
  R(0, wh + 1, Rw, H - wh - 1, P["--sc-floor-a"]);
  for (let j = 0; j * 8 < H - wh; j++) {
    for (let i = (j + 1) % 2; i * 8 < Rw; i += 2) {
      R(i * 8, wh + 1 + j * 8, 8, 8, P["--sc-floor-b"]);
    }
  }
  // The rug the visitor walks on, with its edges and two rows of dashes.
  const ry = H - 17;
  const rh = 14;
  R(0, ry, Rw, rh, P["--sc-rug"]);
  R(0, ry, Rw, 1, P["--sc-rug-edge"]);
  R(0, ry + rh - 1, Rw, 1, P["--sc-rug-edge"]);
  for (let i = 0; i < Rw; i += 6) {
    R(i, ry + 3, 3, 1, P["--sc-rug-edge"]);
    R(i + 3, ry + rh - 4, 3, 1, P["--sc-rug-edge"]);
  }
  // Two windows between the desks: the sky with clouds and the sun by day, the moon and stars by
  // night (by the theme), the mullions, and by day four beams of light on the floor.
  const wy = 5;
  const wH = Math.max(14, wh - 17);
  for (const k of [1, 3]) {
    const wx = Math.round(46 + sp * k) - 11;
    R(wx - 1, wy - 1, 24, wH + 2, P["--sc-trim"]);
    R(wx, wy, 22, wH, P["--sc-sky"]);
    if (dark) {
      R(wx + 14, wy + 3, 4, 4, C.moon);
      R(wx + 16, wy + 3, 2, 3, P["--sc-sky"]);
      for (const [sx, sy] of [
        [3, 2],
        [8, 8],
        [6, 4],
        [18, 11],
        [11, 3],
      ]) {
        if (sy < wH - 2) R(wx + sx, wy + sy, 1, 1, C.white);
      }
    } else {
      R(wx + 3, wy + 3, 7, 2, C.white);
      R(wx + 5, wy + 2, 4, 1, C.white);
      R(wx + 12, wy + 6 < wH ? wy + 7 : wy + 3, 6, 2, C.white);
      R(wx + 15, wy + 1, 3, 3, C.sun);
    }
    R(wx + 10, wy, 2, wH, P["--sc-trim"]);
    R(wx, wy + Math.floor(wH / 2), 22, 1, P["--sc-trim"]);
    if (!dark) {
      for (let i = 0; i < 4; i++)
        R(wx + 2 + i * 3, wh + 1 + i * 2, 14, 10, C.beam);
    }
  }
  // The door with its frame, top highlight, panel, knob and sill, and the doormat.
  const dx = 7;
  const dw = 34;
  const dh = wh - 6;
  R(dx - 2, 4, dw + 4, dh + 3, P["--sc-trim"]);
  R(dx, 5, dw, dh + 1, C.accent2);
  R(dx, 5, dw, 2, C.doorTop);
  R(dx + 3, 18 < dh ? 20 : 12, dw - 6, Math.max(6, dh - 20), C.doorPanel);
  R(dx + dw - 5, 5 + Math.floor(dh / 2), 2, 3, C.gold);
  R(dx - 2, wh, dw + 4, 2, P["--sc-trim"]);
  R(dx - 5, wh + 2, dw + 10, 5, P["--sc-rug-edge"]);
  R(dx - 4, wh + 3, dw + 8, 3, P["--sc-rug"]);
  // The shadows under the desks.
  for (const desk of desks) R(desk.cx - 26, dt + 14, 54, 3, C.shadow);
  // The plant at the right edge.
  const plantX = Rw - 14;
  const plantY = wh - 10;
  R(plantX + 2, plantY + 11, 6, 5, C.pot);
  R(plantX + 2, plantY + 11, 6, 1, C.potRim);
  R(plantX + 3, plantY + 3, 4, 8, C.stem);
  R(plantX, plantY + 5, 4, 3, C.leaf);
  R(plantX + 6, plantY + 2, 4, 4, C.leaf);
  R(plantX + 4, plantY, 2, 3, C.leaf);

  // (2) The wall decor of each desk: a pin board, binders, a blueprint, a certificate (shifted 6).
  {
    const cx = desks[0].cx;
    const x = cx - 10;
    const y = Math.max(5, wh - 15 - 8);
    R(x, y, 20, 15, P["--sc-wood-d"]);
    R(x + 1, y + 1, 18, 13, C.cork);
    R(x + 3, y + 3, 6, 7, P["--sc-paper"]);
    R(x + 11, y + 2, 6, 5, C.note);
    R(x + 11, y + 8, 6, 5, P["--sc-paper"]);
    R(x + 5, y + 2, 1, 1, C.red);
    R(x + 13, y + 1, 1, 1, C.green);
  }
  {
    const cx = desks[1].cx;
    const x = cx - 11;
    const y = Math.max(5, wh - 14 - 8);
    R(x, y + 12, 22, 2, P["--sc-wood-m"]);
    const spines = [
      [C.accent, C.accentEdge],
      [C.accent2, C.accent2Edge],
      [C.binder, C.binderEdge],
      [C.gold, C.goldEdge],
      [C.accent, C.accentEdge],
    ];
    for (let i = 0; i < 5; i++) {
      R(x + 1 + i * 4, y + 1 + (i % 2), 3, 11 - (i % 2), spines[i][0]);
      R(x + 1 + i * 4, y + 1 + (i % 2), 1, 11 - (i % 2), spines[i][1]);
    }
  }
  {
    const cx = desks[2].cx;
    const x = cx - 11;
    const y = Math.max(5, wh - 15 - 8);
    R(x, y, 22, 15, C.blueprintEdge);
    R(x + 1, y + 1, 20, 13, C.blueprint);
    for (let i = 0; i < 4; i++)
      R(x + 3, y + 3 + i * 3, 16 - i * 2, 1, C.blueprintLine);
    R(x + 14, y + 8, 5, 4, C.blueprintLine);
    R(x + 15, y + 9, 3, 2, C.blueprint);
  }
  {
    const cx = desks[3].cx;
    const x = cx - 8 + 6;
    const y = Math.max(5, wh - 13 - 8);
    R(x, y, 16, 13, P["--sc-wood-d"]);
    R(x + 1, y + 1, 14, 11, P["--sc-paper"]);
    R(x + 4, y + 3, 8, 1, P["--ink"]);
    R(x + 4, y + 5, 8, 1, C.grey);
    R(x + 6, y + 8, 4, 3, C.accent);
  }

  // (3) The printer at desk 4, with its sheet of two rows and no count.
  {
    const x = desks[3].cx + 30;
    const y = dt - 1;
    R(x + 4, y + 6, 8, 2, P["--sc-paper"]);
    R(x + 5, y + 7, 5, 1, C.grey);
    R(x, y + 8, 16, 5, C.printer);
    R(x, y + 8, 16, 1, C.printerTop);
    R(x, y + 12, 16, 1, C.printerEdge);
    R(x + 3, y + 9, 10, 1, C.printerSlot);
    R(x + 13, y + 10, 2, 1, C.green);
  }

  // (4) Each desk: the person, the desk, the monitor, the mug, the hands, the lamp, the desk items.
  for (let i = 0; i < 4; i++) {
    const desk = desks[i];
    const cx = desk.cx;
    const px = cx - 8;
    drawPerson(R, P, px, dt, PEOPLE[i], desk.attend);
    R(cx - 26, dt, 52, 5, P["--sc-wood-l"]);
    R(cx - 26, dt, 52, 1, P["--sc-desk-hi"]);
    R(cx - 26, dt + 5, 52, 9, P["--sc-wood-m"]);
    R(cx - 26, dt + 13, 52, 1, P["--sc-wood-d"]);
    R(cx - 25, dt + 5, 2, 9, P["--sc-wood-d"]);
    R(cx + 23, dt + 5, 2, 9, P["--sc-wood-d"]);
    R(cx - 26, dt + 5, 52, 1, P["--sc-wood-d"]);
    // The monitor with four still code lines.
    const mx = cx + 4;
    const my = dt - 15;
    R(mx, my, 17, 12, C.monitor);
    R(mx + 1, my + 1, 15, 10, C.screen);
    R(mx + 6, my + 12, 5, 2, P["--sc-metal"]);
    R(mx + 4, my + 14, 9, 1, P["--sc-metal"]);
    for (let k = 0; k < 4; k++) {
      R(
        mx + 2,
        my + 2 + k * 2,
        5 + ((k * 5) % 8),
        1,
        k % 2 ? C.accent : C.code,
      );
    }
    // The mug with its steam pixel, on desks 1 and 2.
    if (i === 0 || i === 1) {
      const ux = cx + 21;
      const uy = dt - 5;
      R(ux, uy, 5, 5, C.mug);
      R(ux + 5, uy + 1, 1, 3, C.mug);
      R(ux + 1, uy + 1, 3, 1, C.coffee);
      R(ux + 2, uy - 2, 1, 1, C.steam);
    }
    // The hands: level when the person faces the visitor, one lower when it types.
    R(px - 5, dt + 1, 2, 2, C.hand);
    R(px + 3, dt + 1 + (desk.attend ? 0 : 1), 2, 2, C.hand);
    // The lamp, its bulb on when the desk is lit at .75 or more.
    R(cx + 21, dt - 12, 2, 8, P["--sc-metal"]);
    R(cx + 18, dt - 13, 5, 2, P["--sc-metal"]);
    R(cx + 16, dt - 12, 3, 2, desk.light >= 0.75 ? C.bulbOn : C.bulbOff);
    // The desk items: a bell at desk 1, paper stacks at desks 2 and 3, a red box at desk 4.
    if (i === 0) {
      const bx = cx - 24;
      const by = dt - 7;
      R(bx, by + 6, 10, 2, P["--sc-wood-d"]);
      R(bx + 2, by + 2, 6, 4, C.gold);
      R(bx + 3, by, 4, 2, C.gold);
      R(bx + 3, by + 2, 1, 3, C.bellLight);
      R(bx + 4, by - 1, 2, 1, P["--sc-metal"]);
    } else if (i === 1) {
      R(cx - 24, dt - 4, 10, 4, P["--sc-paper"]);
      R(cx - 24, dt - 6, 9, 2, C.stack);
      R(cx - 23, dt - 7, 8, 1, P["--sc-paper"]);
    } else if (i === 2) {
      R(cx - 24, dt - 3, 9, 3, P["--sc-paper"]);
      R(cx - 22, dt - 5, 9, 2, C.stack);
    } else {
      R(cx - 24, dt - 5, 8, 5, C.red);
      R(cx - 24, dt - 5, 8, 1, C.boxTop);
    }
  }

  // (5) The light layer: --sc-dim with the alpha of each rectangle; in the dark theme the warm glow
  // of each lamp that is on.
  const dim = P["--sc-dim"];
  const rects = lightRects(
    geom,
    desks.map((desk) => desk.light),
  );
  for (const r of rects)
    R(r.x, r.y, r.w, r.h, rgba(dim, lightAlpha(strength, r.keep)));
  if (dark) {
    for (const desk of desks) {
      if (!(desk.light >= 0.75)) continue;
      const glow = desk.light >= 1 ? C.glowFull : C.glowThreeQuarters;
      R(desk.cx - 20, dt - 2, 40, 6, glow);
      R(desk.cx - 28, dt + 14, 56, 4, glow);
    }
  }

  // (6) The visitor's figure, feet on H − 3: its shadow, legs and shoes (by the step frame while it
  // walks), the jacket with its arms and the backpack, the hair and the neck; a 1 px bob on frame 1.
  {
    const x = Math.round(you.x);
    const feet = H - 3;
    const y = feet - 22;
    const walking = you.walking === true;
    const step = walking ? you.frame % 2 : 0;
    const other = walking ? 1 - step : 0;
    const bob = walking && step === 1 ? 1 : 0;
    R(x - 5, feet - 1, 10, 1, C.shadow);
    R(x - 3, y + 15, 3, 7 - step, C.legs);
    R(x + 1, y + 15, 3, 7 - other, C.legs);
    R(x - 3, y + 21 - step, 3, 1, C.shoes);
    R(x + 1, y + 21 - other, 3, 1, C.shoes);
    R(x - 5, y + 7 + bob, 10, 9, P["--sc-jacket"]);
    R(x - 5, y + 7 + bob, 10, 2, P["--sc-jacket-hi"]);
    R(x - 5, y + 14 + bob, 10, 2, P["--sc-jacket-lo"]);
    R(x - 6, y + 8 + bob, 1, 7, P["--sc-jacket-lo"]);
    R(x + 5, y + 8 + bob, 1, 7, P["--sc-jacket-lo"]);
    R(x - 3, y + 9 + bob, 6, 6, P["--sc-pack"]);
    R(x - 3, y + 9 + bob, 6, 1, P["--sc-pack-hi"]);
    R(x - 3, y + 1 + bob, 6, 7, C.visitorHair);
    R(x - 3, y + 7 + bob, 6, 1, C.neck);
    R(x - 4, y + 2 + bob, 1, 4, C.visitorHair);
    R(x + 3, y + 2 + bob, 1, 4, C.visitorHair);
    R(x - 3, y + bob, 6, 2, C.visitorHairTop);
  }
  return count.calls;
}

/**
 * Draws the avatar of the person of desk 1 to 4 (the look's 9.15): the person of its 9.6 in the pose
 * «attend» with the eyes open, centred on a bitmap of 24 × 26 logical px, its desk top at the last
 * row, each logical px a square of `scale` bitmap px, by fillRect after fillStyle only. A desk or a
 * scale that is not a whole number in its range is a RangeError.
 * @param {DrawContext} ctx
 * @param {number} desk
 * @param {Palette} palette
 * @param {number} scale
 */
export function drawAvatar(ctx, desk, palette, scale) {
  if (desk !== 1 && desk !== 2 && desk !== 3 && desk !== 4)
    throw new RangeError("draw: the desk is not 1, 2, 3 or 4");
  if (!wholeFromOne(scale))
    throw new RangeError("draw: the scale is not a whole number from 1");
  const R = filler(ctx, scale, { calls: 0 });
  drawPerson(R, paletteOf(palette).colours, 12, 25, PEOPLE[desk - 1], true);
}
