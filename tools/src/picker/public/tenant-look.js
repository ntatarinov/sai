// The look of a tenant: the closed catalogues, the colour rule, the fallback look and the
// desk rule. The file runs in the browser and in Node, so it has no dependencies and no
// calls to the platform: no state between calls, no clock, no random. It holds no text of
// any language and no key of the texts of the site: a role that is null is named by the
// page. Everything it exports is frozen; every function gives a new value and never
// throws on a wrong argument.

function freezeAll(value) {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) freezeAll(value[key]);
    Object.freeze(value);
  }
  return value;
}

// The 15 objects of the office, in this order, and what each one may carry.
export const OBJECT_IDS = freezeAll([
  "shelf",
  "shop",
  "boxes",
  "monitor",
  "laptop",
  "scanner",
  "tsd",
  "clip",
  "bell",
  "phone",
  "cell",
  "headset",
  "poster",
  "coins",
  "chart",
]);

const NO_PARAMS = { level: null, tag: false, glyph: false };

// id -> { level: [min, max] or null, tag: boolean, glyph: boolean }.
export const OBJECT_RULES = freezeAll({
  shelf: { level: [1, 3], tag: false, glyph: false },
  shop: { ...NO_PARAMS },
  boxes: { level: [1, 4], tag: false, glyph: false },
  monitor: { level: null, tag: true, glyph: false },
  laptop: { level: null, tag: true, glyph: false },
  scanner: { ...NO_PARAMS },
  tsd: { ...NO_PARAMS },
  clip: { ...NO_PARAMS },
  bell: { ...NO_PARAMS },
  phone: { ...NO_PARAMS },
  cell: { level: null, tag: true, glyph: false },
  headset: { ...NO_PARAMS },
  poster: { level: null, tag: false, glyph: true },
  coins: { level: [1, 4], tag: false, glyph: false },
  chart: { level: [1, 4], tag: false, glyph: false },
});

export const GLYPHS = freezeAll(["tool", "box", "house", "cap"]);

export const FIGURES = freezeAll([
  "f01",
  "f02",
  "f03",
  "f04",
  "f05",
  "f06",
  "f07",
  "f08",
  "f09",
  "f10",
  "f11",
  "f12",
]);

export const SHIRTS = freezeAll(["accent", "accent2", "ink"]);

// Four staff, one at each of the four desks.
export const TEAM_SIZE = 4;

// The colour of the sheet of each theme: the page of the light theme and the card of
// the dark theme of the style of the site.
export const SHEET = freezeAll({ light: "#f3f5f9", dark: "#161f2e" });

// The least contrast of an accent colour with the sheet of its own theme.
export const MIN_CONTRAST = 3;

// The colours of a tenant that has no look of its own.
export const NEUTRAL_COLORS = freezeAll({
  light: { accent: "#35607f", accent2: "#7a5c2e" },
  dark: { accent: "#8fb4d8", accent2: "#c9b48c" },
});

const MARK_SIGN = /^[\p{L}\p{Nd}]$/u;
const COLOR = /^#[0-9a-f]{6}$/u;

// True for exactly one code point that is a letter or a decimal digit of any alphabet.
export function isMarkSign(ch) {
  return typeof ch === "string" && MARK_SIGN.test(ch);
}

// True for "#" and six lower-case hexadecimal digits.
export function isColor(v) {
  return typeof v === "string" && COLOR.test(v);
}

function luminance(color) {
  const channels = [1, 3, 5].map((start) => {
    const s = Number.parseInt(color.slice(start, start + 2), 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// The contrast of two colours (1 to 21); NaN when either is not a colour.
export function contrastRatio(a, b) {
  if (!isColor(a) || !isColor(b)) return Number.NaN;
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// The mark of a tenant that has none: the first letter or digit of the name in upper
// case when that is one sign, else the sign itself; "#" when the name has none.
export function markOf(name) {
  if (typeof name !== "string") return "#";
  for (const ch of name) {
    if (!isMarkSign(ch)) continue;
    const upper = ch.toUpperCase();
    return [...upper].length === 1 ? upper : ch;
  }
  return "#";
}

// The desk of question `index` of `total`: 1 to 4, spread evenly. A value that is not
// a whole number, or a total below 1, gives 1; an index out of range is moved into it.
export function deskForQuestion(index, total) {
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1)
    return 1;
  const at = Math.min(Math.max(index, 0), total - 1);
  return Math.floor((at * TEAM_SIZE) / total) + 1;
}

const FALLBACK_SHIRTS = ["accent", "accent2", "ink", "accent"];

// The look of a tenant that has none of its own. The roles, the names and the replies
// of the staff are null: the page names them itself.
export function fallbackLook(name) {
  const colors = {};
  for (const theme of Object.keys(NEUTRAL_COLORS))
    colors[theme] = { ...NEUTRAL_COLORS[theme] };
  return {
    mark: markOf(name),
    tagline: null,
    industry: null,
    headline: typeof name === "string" ? name : "",
    colors,
    team: FALLBACK_SHIRTS.map((shirt, i) => ({
      name: null,
      role: null,
      says: null,
      figure: FIGURES[i],
      shirt,
    })),
  };
}
