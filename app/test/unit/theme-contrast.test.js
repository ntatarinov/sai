import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { APP } from "../fixtures/helpers.js";

// REQ-111 criterion 4: the theme choice (the pure part of public/js/theme.js), the tokens of both themes in
// public/css/tokens.css and the contrast of every pair of the look (docs/design/V1-public-look.md, 6.1 to 6.3),
// by a WCAG 2.x function written here, not imported from the code. The tables below are the look's.

const THEME_FILE = path.join(APP, "public", "js", "theme.js");
const TOKENS_FILE = path.join(APP, "public", "css", "tokens.css");
const theme = () => import(pathToFileURL(THEME_FILE).href);

// ---------------------------------------------------------------------------------------------------------
// The tokens: [name, light, dark] of look 6.1 (the page colours) and 6.2 (the scene colours).

/** @type {Array<[string, string, string]>} */
const PAGE_TOKENS = [
  ["--bg", "#f6eddc", "#0d1b1e"],
  ["--paper", "#fbf5e8", "#13282c"],
  ["--card", "#fdfbf5", "#24373b"],
  ["--ink", "#17343a", "#f2ead8"],
  ["--ink2", "#4a5d60", "#a9bcbf"],
  ["--btn", "#ce6a1d", "#e0731f"],
  ["--onbtn", "#1b1208", "#1b1208"],
  ["--acct", "#9a4306", "#ffb06b"],
  ["--ring-rc", "#ce6a1d", "#9a4306"],
  ["--acc2", "#1f7a8c", "#1f7a8c"],
  ["--shadow", "rgba(40, 30, 20, 0.28)", "rgba(0, 0, 0, 0.55)"],
  ["--rc", "#fffbf0", "#fffbf0"],
  ["--rcink", "#241c12", "#241c12"],
  ["--rc2", "#62564a", "#62564a"],
  ["--rcline", "#cfc2a8", "#cfc2a8"],
  ["--rclink", "#7a3606", "#7a3606"],
  ["--chip", "#efe6d2", "#efe6d2"],
  ["--rcerr", "#a3261d", "#a3261d"],
  ["--rcpip", "#8f8372", "#8f8372"],
  ["--err", "#a3261d", "#ff9b90"],
  ["--plate", "#f4efe3", "#f4efe3"],
  ["--plate-ink", "#2a2118", "#2a2118"],
  ["--plate-ink2", "#5d5140", "#5d5140"],
  ["--plate-edge", "#8a7a60", "#8a7a60"],
  ["--plate-now", "#ce6a1d", "#ce6a1d"],
  ["--plate-now-edge", "#17343a", "#f2ead8"],
];
/** @type {Array<[string, string, string]>} */
const SCENE_TOKENS = [
  ["--sc-wall", "#eadcc2", "#1b363c"],
  ["--sc-wall-top", "#d3c6af", "#13262a"],
  ["--sc-wall-b", "#dcc8a6", "#142a2f"],
  ["--sc-trim", "#b99a6a", "#2c5059"],
  ["--sc-floor-a", "#e6d4b4", "#13252a"],
  ["--sc-floor-b", "#dec9a5", "#112024"],
  ["--sc-sky", "#bfe3ee", "#0b1626"],
  ["--sc-wood-d", "#a97646", "#4a3626"],
  ["--sc-wood-m", "#c28f5a", "#6b4f37"],
  ["--sc-wood-l", "#d9ab74", "#805e42"],
  ["--sc-desk-hi", "#e3c097", "#a08671"],
  ["--sc-metal", "#9aa6bb", "#8a97ad"],
  ["--sc-paper", "#fbf8ef", "#d9d4c6"],
  ["--sc-chair", "#418e9d", "#3c4b6a"],
  ["--sc-chair-hi", "#71aab6", "#6d788f"],
  ["--sc-chair-lo", "#316b76", "#2d3850"],
  ["--sc-rug", "#9ab2a5", "#11434d"],
  ["--sc-rug-edge", "#e0731f", "#924b14"],
  ["--sc-jacket", "#1d7485", "#2a8192"],
  ["--sc-jacket-hi", "#4a909d", "#559aa8"],
  ["--sc-jacket-lo", "#165764", "#20616e"],
  ["--sc-pack", "#1a6675", "#257280"],
  ["--sc-pack-hi", "#348291", "#3f8e9d"],
  ["--sc-dim", "#3a2a18", "#050a14"],
];
/** The strength of the light layer (--sc-dim-alpha): a plain number in each theme. */
const DIM_ALPHA = { light: 0.15, dark: 0.5 };

// ---------------------------------------------------------------------------------------------------------
// A reader of tokens.css: its rules as { selector, declarations } and the at-rules with their rules.

/**
 * @typedef {{ prelude: string, decls: Map<string, string>, rules: Rule[] }} Rule
 */

/**
 * The rules of a style sheet: the text before each `{`, the declarations of a block that holds none, the
 * rules inside a block that holds some.
 * @param {string} css
 * @returns {Rule[]}
 */
function parseCss(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  /** @returns {Rule[]} */
  const rules = () => {
    /** @type {Rule[]} */
    const out = [];
    for (;;) {
      const open = text.indexOf("{", i);
      const close = text.indexOf("}", i);
      if (open < 0 || (close >= 0 && close < open)) {
        if (close >= 0) i = close + 1;
        return out;
      }
      const prelude = text.slice(i, open).trim();
      i = open + 1;
      /** @type {Rule} */
      const rule = { prelude, decls: new Map(), rules: [] };
      const nextOpen = text.indexOf("{", i);
      const nextClose = text.indexOf("}", i);
      if (nextOpen >= 0 && nextOpen < nextClose) rule.rules = rules();
      else {
        for (const part of text.slice(i, nextClose).split(";")) {
          const colon = part.indexOf(":");
          if (colon > 0)
            rule.decls.set(
              part.slice(0, colon).trim(),
              part
                .slice(colon + 1)
                .trim()
                .replace(/\s+/g, " "),
            );
        }
        i = nextClose + 1;
      }
      out.push(rule);
    }
  };
  return rules();
}

/**
 * The three sets of colour tokens of tokens.css: the light set on :root, the dark set under the system setting
 * (when the root has no data-theme="light") and the dark set under data-theme="dark".
 * @param {string} css
 * @returns {{ light: Map<string, string> | null, system: Map<string, string> | null, forced: Map<string, string> | null }}
 */
function tokenSets(css) {
  const top = parseCss(css);
  const light = top.find((r) => r.prelude === ":root" && r.decls.has("--bg"));
  const media = top.find((r) =>
    /^@media\s*\(prefers-color-scheme:\s*dark\)$/.test(r.prelude),
  );
  const system = media?.rules.find(
    (r) => r.prelude === ':root:not([data-theme="light"])',
  );
  const forced = top.find((r) => r.prelude === ':root[data-theme="dark"]');
  return {
    light: light?.decls ?? null,
    system: system?.decls ?? null,
    forced: forced?.decls ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------
// WCAG 2.x, written here.

/** @param {string} hex #rrggbb @returns {number[]} the channels 0 to 255 */
const channels = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** The relative luminance of WCAG 2.x. @param {number[]} rgb */
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** The contrast ratio of two colours given as channels. @param {number[]} a @param {number[]} b */
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** @param {number[]} rgb */
const hexOf = (rgb) =>
  `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** `color-mix(in srgb, <top> <share>, <base>)` as the look writes it: each channel round(share·top + (1 − share)·base).
 * @param {string} top @param {string} base @param {number} share */
const mix = (top, base, share) =>
  hexOf(
    channels(top).map((v, i) =>
      Math.round(share * v + (1 - share) * channels(base)[i]),
    ),
  );

// The pairs of look 6.3: a foreground token against a background token, the least ratio it needs, and the
// pressed card (the button colour 16 % into the card) as a pseudo token. Text 4.5:1, accents and rings 3:1.
const TEXT = 4.5;
const ACCENT = 3;
/** @type {Array<[string, string, number]>} */
const PAIRS = [
  ["--ink", "--bg", TEXT],
  ["--ink", "--paper", TEXT],
  ["--ink", "--card", TEXT],
  ["--ink2", "--bg", TEXT],
  ["--ink2", "--paper", TEXT],
  ["--ink2", "--card", TEXT],
  ["--acct", "--bg", TEXT],
  ["--acct", "--paper", TEXT],
  ["--acct", "--card", TEXT],
  ["--onbtn", "--btn", TEXT],
  ["--onbtn", "--plate-now", TEXT],
  ["--ink", "pressed", TEXT],
  ["--acct", "pressed", TEXT],
  ["--rcink", "--rc", TEXT],
  ["--rc2", "--rc", TEXT],
  ["--rclink", "--rc", TEXT],
  ["--rcerr", "--rc", TEXT],
  ["--rcink", "--chip", TEXT],
  ["--err", "--paper", TEXT],
  ["--err", "--card", TEXT],
  ["--plate-ink", "--plate", TEXT],
  ["--plate-ink2", "--plate", TEXT],
  ["--ink", "--sc-wall", TEXT],
  ["--btn", "--bg", ACCENT],
  ["--btn", "--paper", ACCENT],
  ["--btn", "--card", ACCENT],
  ["--btn", "--rc", ACCENT],
  ["--acct", "--bg", ACCENT],
  ["--acct", "--paper", ACCENT],
  ["--acct", "--card", ACCENT],
  ["--ring-rc", "--rc", ACCENT],
  ["--ring-rc", "--ink", ACCENT],
  ["--ink2", "--paper", ACCENT],
  ["--ink2", "--card", ACCENT],
  ["--rcpip", "--rc", ACCENT],
  ["--acc2", "--bg", ACCENT],
  ["--ink", "--bg", ACCENT],
  ["--plate-now", "--plate", ACCENT],
];

/**
 * The findings of TC-2 and TC-3 over a style sheet: every token of look 6.1 and 6.2 in the light set and in
 * both dark blocks (with the look's values), the two dark blocks equal, and every pair of the look at its
 * least contrast in both themes.
 * @param {string} css
 * @returns {string[]}
 */
function tokenFindings(css) {
  const sets = tokenSets(css);
  /** @type {string[]} */
  const out = [];
  if (!sets.light) out.push("the light set (:root) is missing");
  if (!sets.system)
    out.push("the dark set under the system setting is missing");
  if (!sets.forced) out.push('the dark set under data-theme="dark" is missing');
  if (!sets.light || !sets.system || !sets.forced) return out;
  const { light, system, forced } = sets;
  for (const [name, l, d] of [...PAGE_TOKENS, ...SCENE_TOKENS]) {
    if (light.get(name) !== l)
      out.push(`light ${name}: ${light.get(name)}, not ${l}`);
    if (system.get(name) !== d)
      out.push(
        `dark (system) ${name}: ${system.get(name) ?? "missing"}, not ${d}`,
      );
    if (forced.get(name) !== d)
      out.push(
        `dark (data-theme) ${name}: ${forced.get(name) ?? "missing"}, not ${d}`,
      );
  }
  for (const [
    set,
    label,
    want,
  ] of /** @type {Array<[Map<string, string>, string, number]>} */ ([
    [light, "light", DIM_ALPHA.light],
    [system, "dark (system)", DIM_ALPHA.dark],
    [forced, "dark (data-theme)", DIM_ALPHA.dark],
  ]))
    if (Number(set.get("--sc-dim-alpha")) !== want)
      out.push(
        `${label} --sc-dim-alpha: ${set.get("--sc-dim-alpha")}, not ${want}`,
      );
  // The two dark blocks hold the same declarations.
  for (const name of new Set([...system.keys(), ...forced.keys()]))
    if (system.get(name) !== forced.get(name))
      out.push(`the dark blocks differ at ${name}`);
  // Every dark token has a light value.
  for (const name of system.keys())
    if (!light.has(name)) out.push(`${name} is dark only`);
  // The scale of the stage and the fonts stand in the light set.
  for (const name of ["--px", "--font", "--mono"])
    if (!light.has(name)) out.push(`light ${name} is missing`);
  // Contrast, both themes.
  for (const [
    label,
    set,
  ] of /** @type {Array<[string, Map<string, string>]>} */ ([
    ["light", light],
    ["dark", forced],
  ])) {
    const colour = (/** @type {string} */ name) => {
      if (name === "pressed") {
        const btn = set.get("--btn");
        const card = set.get("--card");
        return btn &&
          card &&
          /^#[0-9a-f]{6}$/.test(btn) &&
          /^#[0-9a-f]{6}$/.test(card)
          ? mix(btn, card, 0.16)
          : undefined;
      }
      return set.get(name);
    };
    for (const [fg, bg, least] of PAIRS) {
      const a = colour(fg);
      const b = colour(bg);
      if (
        a === undefined ||
        b === undefined ||
        !/^#[0-9a-f]{6}$/.test(a) ||
        !/^#[0-9a-f]{6}$/.test(b)
      ) {
        out.push(
          `${label}: ${fg} on ${bg}: a colour is missing or is no #rrggbb`,
        );
        continue;
      }
      const got = ratio(channels(a), channels(b));
      if (got < least)
        out.push(
          `${label}: ${fg} on ${bg}: ${got.toFixed(2)}:1, under ${least}:1`,
        );
    }
  }
  return out;
}

const REAL = () => fs.readFileSync(TOKENS_FILE, "utf8");

// ---------------------------------------------------------------------------------------------------------

test("TC-1 themeFor, readChoice and nextChoice by the table of the criterion", async () => {
  const { themeFor, readChoice, nextChoice, CHOICES } = await theme();
  assert.deepEqual([...CHOICES], ["auto", "light", "dark"]);
  // The choice and «the system asks for dark» give the theme.
  /** @type {Array<[string, boolean, string]>} */
  const table = [
    ["auto", false, "light"],
    ["auto", true, "dark"],
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
  ];
  for (const [choice, systemDark, want] of table)
    assert.equal(themeFor(choice, systemDark), want, `${choice} ${systemDark}`);
  // A value that is no choice reads as auto: null, «sepia», «Dark», an empty value, a number, 1 000 characters.
  const strange = [
    null,
    undefined,
    "sepia",
    "Dark",
    "LIGHT",
    "Light",
    "",
    1,
    0,
    {},
    [],
    true,
    "x".repeat(1000),
    " dark",
    "dark ",
  ];
  for (const raw of strange) {
    assert.equal(readChoice(raw), "auto", String(raw).slice(0, 12));
    assert.equal(themeFor(raw, false), "light", String(raw).slice(0, 12));
    assert.equal(themeFor(raw, true), "dark", String(raw).slice(0, 12));
    assert.equal(nextChoice(raw), "light", String(raw).slice(0, 12));
  }
  assert.equal(readChoice("light"), "light");
  assert.equal(readChoice("dark"), "dark");
  assert.equal(readChoice("auto"), "auto");
  // The button goes auto → light → dark → auto from each position, and round once is the identity.
  assert.equal(nextChoice("auto"), "light");
  assert.equal(nextChoice("light"), "dark");
  assert.equal(nextChoice("dark"), "auto");
  for (const start of ["auto", "light", "dark"]) {
    let at = start;
    const seen = [];
    for (let i = 0; i < 3; i++) {
      at = nextChoice(at);
      seen.push(at);
    }
    assert.equal(at, start, start);
    assert.equal(new Set(seen).size, 3, start);
  }
});

test("TC-2 tokens.css defines every token of the look in the light set and in both dark blocks, with the look's values; the two dark blocks are equal", () => {
  const css = REAL();
  assert.deepEqual(
    tokenFindings(css).filter((f) => !/ on /.test(f)),
    [],
  );
  const { light, system, forced } = tokenSets(css);
  assert.ok(light && system && forced);
  assert.equal(PAGE_TOKENS.length, 26);
  assert.equal(SCENE_TOKENS.length, 24);
  // Every colour token is a #rrggbb in lower case (the shadow is the one rgba).
  for (const set of [light, system, forced])
    for (const [name, value] of set) {
      if (
        name.startsWith("--sc-dim-alpha") ||
        name === "--shadow" ||
        name === "--font" ||
        name === "--mono" ||
        name === "--px"
      )
        continue;
      assert.match(value, /^#[0-9a-f]{6}$/, name);
    }
  assert.deepEqual([...system.entries()], [...forced.entries()]);
  // The scale of the stage: 2 px, 3 px from 1000 × 640, 4 px from 1300 × 700.
  assert.equal(light.get("--px"), "2px");
  const queries = parseCss(css).filter((r) =>
    r.prelude.startsWith("@media (min-width"),
  );
  assert.deepEqual(
    queries.map((q) => [q.prelude, q.rules[0].decls.get("--px")]),
    [
      ["@media (min-width: 1000px) and (min-height: 640px)", "3px"],
      ["@media (min-width: 1300px) and (min-height: 700px)", "4px"],
    ],
  );
});

test("TC-3 every text pair of the look has at least 4.5:1 and every accent pair at least 3:1, in both themes", () => {
  // The function itself: known answers of WCAG 2.x.
  assert.equal(ratio([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(ratio([255, 255, 255], [255, 255, 255]), 1);
  assert.equal(ratio(channels("#777777"), [255, 255, 255]).toFixed(2), "4.48");
  assert.equal(ratio(channels("#767676"), [255, 255, 255]).toFixed(2), "4.54");
  assert.equal(
    ratio(channels("#17343a"), channels("#f6eddc")).toFixed(2),
    "11.37",
  );
  assert.equal(
    ratio(channels("#e0731f"), channels("#f6eddc")).toFixed(2),
    "2.72",
  );
  // The pressed card of the look, by its rule.
  assert.equal(mix("#ce6a1d", "#fdfbf5", 0.16), "#f5e4d2");
  assert.equal(mix("#e0731f", "#24373b", 0.16), "#424137");
  assert.equal(PAIRS.length, 38);
  assert.deepEqual(
    tokenFindings(REAL()).filter((f) => / on /.test(f)),
    [],
  );
});

/**
 * The grey (as #rrggbb) whose contrast against `against` is the nearest to `want` from the side `side`: "under"
 * gives the greatest ratio that is at most `want`, "over" the least ratio that is at least `want`.
 * @param {string} against
 * @param {number} want
 * @param {"under" | "over"} side
 */
function greyAt(against, want, side) {
  /** @type {Array<[number, number]>} */
  const rows = [];
  for (let v = 0; v < 256; v++)
    rows.push([v, ratio([v, v, v], channels(against))]);
  const fit = rows.filter(([, r]) =>
    side === "under" ? r <= want : r >= want,
  );
  assert.ok(fit.length > 0, `no grey at ${want} against ${against}`);
  fit.sort((x, y) => (side === "under" ? y[1] - x[1] : x[1] - y[1]));
  const v = fit[0][0];
  return hexOf([v, v, v]);
}

/**
 * A copy of the style sheet with the value of one token changed in one block.
 * @param {string} css
 * @param {string} block the prelude that opens the block: ":root {" is the light set
 * @param {string} name
 * @param {string | null} value null removes the declaration
 */
function withToken(css, block, name, value) {
  const at = css.indexOf(block);
  assert.ok(at >= 0, block);
  const end = css.indexOf("}", at);
  const body = css.slice(at, end);
  const line = new RegExp(`(\\n\\s*)${name}:\\s*[^;]*;`);
  assert.ok(line.test(body), `${name} in ${block}`);
  const next = body.replace(line, (_, lead) =>
    value === null ? "" : `${lead}${name}: ${value};`,
  );
  return css.slice(0, at) + next + css.slice(end);
}

test("TC-4 damaged copies of tokens.css are red: a text colour at 4.4:1, an accent at 2.9:1, a token missing in the dark set; the same colours at 4.51:1 and 3.01:1 are green", () => {
  const css = REAL();
  assert.deepEqual(tokenFindings(css), []);
  const LIGHT = ":root {";
  const SYSTEM = ':root:not([data-theme="light"]) {';
  const FORCED = ':root[data-theme="dark"] {';
  const bgLight = "#f6eddc";
  const cardLight = "#fdfbf5";
  // A text colour at 4.4:1 (the least background of its pairs is --bg of the light set, --card for --ink2's
  // lightest row): --ink2 at 4.4:1 against --card is under 4.5:1 against every background of its pairs.
  const text44 = greyAt(cardLight, 4.4, "under");
  assert.ok(
    Math.abs(ratio(channels(text44), channels(cardLight)) - 4.4) < 0.05,
    text44,
  );
  const red1 = tokenFindings(withToken(css, LIGHT, "--ink2", text44));
  assert.ok(
    red1.some((f) =>
      /^light: --ink2 on --\w+: 4\.\d\d:1, under 4\.5:1$/.test(f),
    ),
    JSON.stringify(red1),
  );
  // An accent at 2.9:1 against --bg.
  const accent29 = greyAt(bgLight, 2.9, "under");
  const red2 = tokenFindings(withToken(css, LIGHT, "--acc2", accent29));
  assert.ok(
    red2.some((f) => /^light: --acc2 on --bg: 2\.\d\d:1, under 3:1$/.test(f)),
    JSON.stringify(red2),
  );
  // The dark theme too: a dark text colour and a dark accent under the least.
  const darkText = greyAt("#24373b", 4.4, "under");
  const red3 = tokenFindings(
    withToken(
      withToken(css, SYSTEM, "--ink2", darkText),
      FORCED,
      "--ink2",
      darkText,
    ),
  );
  assert.ok(
    red3.some((f) => /^dark: --ink2 on --card: 4\.\d\d:1/.test(f)),
    JSON.stringify(red3),
  );
  // A token missing in the dark set — in the block of the system setting, in the block of data-theme, and in both.
  for (const [name, blocks] of /** @type {Array<[string, string[]]>} */ ([
    ["--ring-rc", [SYSTEM]],
    ["--ring-rc", [FORCED]],
    ["--sc-chair", [SYSTEM, FORCED]],
    ["--err", [FORCED]],
  ])) {
    let copy = css;
    for (const block of blocks) copy = withToken(copy, block, name, null);
    const found = tokenFindings(copy);
    assert.ok(
      found.some((f) => f.includes(`${name}: missing`)),
      `${name} ${blocks}: ${JSON.stringify(found)}`,
    );
  }
  // A token missing in the light set, a dark block that differs, a changed value.
  assert.ok(
    tokenFindings(withToken(css, LIGHT, "--sc-sky", null)).some((f) =>
      /light --sc-sky: undefined/.test(f),
    ),
  );
  assert.ok(
    tokenFindings(withToken(css, SYSTEM, "--bg", "#0d1b1f")).some((f) =>
      /the dark blocks differ at --bg/.test(f),
    ),
  );
  // The button colour back to the sample's (2.72:1 against --bg, under 3:1).
  const btn = tokenFindings(withToken(css, LIGHT, "--btn", "#e0731f"));
  assert.ok(
    btn.some((f) => /^light: --btn on --bg: 2\.72:1, under 3:1$/.test(f)),
    JSON.stringify(btn),
  );
  // The twins: the same two colours at 4.51:1 and at 3.01:1 stay green (the limits are 4.5 and 3).
  const text451 = greyAt(bgLight, 4.51, "over");
  assert.ok(ratio(channels(text451), channels(bgLight)) >= 4.5);
  assert.deepEqual(
    tokenFindings(withToken(css, LIGHT, "--ink2", text451)).filter((f) =>
      f.includes("--ink2 on"),
    ),
    [],
  );
  const accent301 = greyAt(bgLight, 3.01, "over");
  assert.ok(ratio(channels(accent301), channels(bgLight)) >= 3);
  assert.ok(
    !tokenFindings(withToken(css, LIGHT, "--acc2", accent301)).some((f) =>
      /--acc2 on --bg/.test(f),
    ),
  );
});

test("TC-5 theme.js imports in Node with no document and no window, and its pure part works there", async () => {
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(typeof globalThis.window, "undefined");
  // A fresh import (a query makes it another module instance): the load itself touches no page object.
  const fresh = await import(`${pathToFileURL(THEME_FILE).href}?fresh=tc5`);
  for (const name of [
    "CHOICES",
    "readChoice",
    "themeFor",
    "nextChoice",
    "mountTheme",
    "drawnTheme",
  ])
    assert.ok(name in fresh, name);
  assert.equal(fresh.themeFor("auto", true), "dark");
  assert.equal(fresh.nextChoice("dark"), "auto");
  // The module it loads (dom.js) does not touch them either.
  const dom = await import(
    `${pathToFileURL(path.join(APP, "public", "js", "dom.js")).href}?fresh=tc5`
  );
  assert.equal(typeof dom.pref.read, "function");
  assert.equal(typeof globalThis.document, "undefined");
});
