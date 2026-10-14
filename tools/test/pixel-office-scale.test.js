// SC: the page scale for Full HD and 2K (design 4.14; REQ-007 criteria 16, 17).
// The expected numbers are written out here from the design, not read from the
// code under test; the page files are read as text.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PUBLIC } from "./pixel-office-helpers.js";

const CSS = fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8");
const BLANK = (m) => m.replace(/[^\n]/g, " ");
const CLEAN = CSS.replace(/\/\*[\s\S]*?\*\//g, BLANK);
const collapse = (s) => s.replace(/\s+/g, " ").trim();

function parseCss(src) {
  const rules = [];
  const media = [];
  let i = 0;
  function block(cond) {
    while (i < src.length) {
      const open = src.indexOf("{", i);
      const close = src.indexOf("}", i);
      if (close !== -1 && (open === -1 || close < open)) {
        i = close + 1;
        return;
      }
      if (open === -1) {
        i = src.length;
        return;
      }
      const prelude = collapse(src.slice(i, open));
      i = open + 1;
      if (prelude.startsWith("@media")) {
        media.push(prelude);
        block(prelude);
      } else {
        const end = src.indexOf("}", i);
        const decls = src
          .slice(i, end)
          .split(";")
          .map((d) => {
            const k = d.indexOf(":");
            return k < 0
              ? null
              : [d.slice(0, k).trim(), collapse(d.slice(k + 1))];
          })
          .filter(Boolean);
        rules.push({ selector: prelude, decls, media: cond });
        i = end + 1;
      }
    }
  }
  block(null);
  return { rules, media };
}

const PARSED = parseCss(CLEAN);
const WIDE = "@media (min-width: 1240px) and (min-height: 640px)";
const NARROW = "@media (max-width: 599px)";

function rulesOf(selector, media = null) {
  return PARSED.rules.filter(
    (r) =>
      r.media === media &&
      r.selector.split(",").some((s) => s.trim() === selector),
  );
}
function declOf(selector, prop, media = null) {
  const found = rulesOf(selector, media).flatMap((r) =>
    r.decls.filter(([p]) => p === prop).map(([, v]) => v),
  );
  assert.equal(found.length, 1, `${selector} ${prop} in ${media}`);
  return found[0];
}

const EXPRESSION = "clamp(16px, min(100vw / 120, 100vh / 67.5), 24px)";

// The root size at a window, computed from the numbers of the found value.
function rootAt(value, w, h) {
  const m =
    /^clamp\((\d+)px, min\(100vw \/ ([\d.]+), 100vh \/ ([\d.]+)\), (\d+)px\)$/.exec(
      value,
    );
  assert.ok(m !== null, `the expression: ${value}`);
  const [lo, a, b, hi] = m.slice(1).map(Number);
  return Math.min(hi, Math.max(lo, Math.min(w / a, h / b)));
}

test("SC-01: style.css has exactly one html rule outside @media, with one font-size equal to the expression; :root and body set no root font-size", () => {
  const html = rulesOf("html", null);
  assert.equal(html.length, 1);
  assert.deepEqual(html[0].decls, [["font-size", EXPRESSION]]);
  assert.equal(
    PARSED.rules.filter(
      (r) => r.media !== null && /(^|,)\s*html\s*(,|$)/.test(r.selector),
    ).length,
    0,
    "no html rule inside @media",
  );
  for (const sel of [":root", "body"]) {
    for (const r of rulesOf(sel, null).concat(
      rulesOf(sel, WIDE),
      rulesOf(sel, NARROW),
    )) {
      assert.ok(
        r.decls.every(([p]) => p !== "font-size"),
        `${sel} sets no font-size`,
      );
    }
  }
});

test("SC-02: the expression gives 16 / 21.33 / 24 px in the windows of the design, root / 16 = S, never below 16 or above 24", () => {
  const value = declOf("html", "font-size");
  const table = [
    [1920, 1080, 16],
    [2560, 1440, 21.33],
    [3840, 2160, 24],
    [2560, 1080, 16],
    [1600, 900, 16],
    [1000, 700, 16],
    [2560, 1600, 21.33],
    [3440, 1440, 21.33],
    [1920, 1200, 16],
    [500, 800, 16],
  ];
  for (const [w, h, want] of table) {
    const root = rootAt(value, w, h);
    assert.ok(Math.abs(root - want) <= 0.05, `${w}x${h}: ${root}`);
    const s = Math.min(1.5, Math.max(1, Math.min(w / 1920, h / 1080)));
    assert.ok(Math.abs(root / 16 - s) <= 0.05 / 16 + 1e-9, `${w}x${h}: S ${s}`);
  }
  for (let w = 100; w <= 7680; w += 290) {
    for (let h = 100; h <= 4320; h += 270) {
      const root = rootAt(value, w, h);
      assert.ok(root >= 16 && root <= 24, `${w}x${h}: ${root}`);
    }
  }
});

test("SC-03: px stays only in the list of the design - 15 lines (10 borders of 1px, 2 outlines, the root rule, 2 @media); border-radius and the rest in rem; no px in comments", () => {
  const found = [];
  CLEAN.split("\n").forEach((line, i) => {
    if (/[0-9.]+px/.test(line)) found.push([i + 1, collapse(line)]);
  });
  const kinds = { border: 0, outline: 0, offset: 0, root: 0, media: 0 };
  for (const [no, line] of found) {
    if (
      /^(border(-top|-right|-bottom|-left)?(-width)?): 1px\b[^;]*;$/.test(line)
    ) {
      kinds.border += 1;
      assert.ok(!/[0-9.]+px.*[0-9.]+px/.test(line), `line ${no}: ${line}`);
    } else if (/^outline: 2px solid [^;]*;$/.test(line)) kinds.outline += 1;
    else if (/^outline-offset: 2px;$/.test(line)) kinds.offset += 1;
    else if (line === `font-size: ${EXPRESSION};`) kinds.root += 1;
    else if (
      line === "@media (min-width: 1240px) and (min-height: 640px) {" ||
      line === "@media (max-width: 599px) {"
    )
      kinds.media += 1;
    else assert.fail(`px outside the list, line ${no}: ${line}`);
  }
  assert.deepEqual(kinds, {
    border: 10,
    outline: 1,
    offset: 1,
    root: 1,
    media: 2,
  });
  assert.equal(found.length, 15);
  const comments = CSS.match(/\/\*[\s\S]*?\*\//g) ?? [];
  assert.ok(
    comments.every((c) => !/[0-9.]+\s*px/.test(c)),
    "no px number in comments",
  );
  for (const r of PARSED.rules) {
    for (const [p, v] of r.decls) {
      if (p === "border-radius") {
        assert.ok(!/px/.test(v), `${r.selector} ${p}: ${v}`);
      }
    }
  }
});

test("SC-04: the values at S = 1.0 equal the table of the description (rem x 16 = px), and every rem is a multiple of half a pixel", () => {
  assert.equal(declOf(":root", "--gap"), "0.875rem");
  assert.equal(declOf(":root", "--gap", NARROW), "0.5rem");
  assert.equal(declOf(".top", "height", WIDE), "3.75rem");
  assert.equal(
    declOf(".layout", "grid-template-columns", WIDE),
    "minmax(0, 1fr) 23.75rem",
  );
  assert.equal(declOf(".layout", "height", WIDE), "calc(100vh - 3.75rem)");
  assert.equal(declOf(".panel", "border-radius"), "0.625rem");
  assert.equal(declOf(".panel-office", "padding"), "0.75rem");
  assert.ok(declOf(".row", "border-left").startsWith("0.1875rem "));
  assert.equal(declOf(".card", "width"), "40rem");
  assert.ok(declOf("body", "font").startsWith("0.8125rem/1.5 "));
  assert.equal(declOf(".legend", "font-size"), "0.71875rem");
  for (const m of CLEAN.matchAll(/([0-9]*\.?[0-9]+)rem/g)) {
    const px = Number(m[1]) * 16;
    assert.ok(
      Math.abs(px * 2 - Math.round(px * 2)) < 1e-9,
      `${m[0]} is not a half pixel`,
    );
  }
});

test("SC-05: exactly two @media conditions, the same thresholds in app.js, and no border or padding in the .office-inner rules (the rectangle and the client box give one area)", () => {
  assert.deepEqual(PARSED.media, [WIDE, NARROW]);
  const app = fs.readFileSync(path.join(PUBLIC, "app.js"), "utf8");
  assert.ok(/const WIDE_MIN_WIDTH = 1240;/.test(app));
  assert.ok(/const WIDE_MIN_HEIGHT = 640;/.test(app));
  const all = PARSED.rules.filter((r) =>
    r.selector
      .split(",")
      .some((s) => /(^|[\s>+~])\.office-inner(?![\w-])/.test(s)),
  );
  assert.ok(all.length >= 1, "the rule exists");
  for (const r of all) {
    for (const [p] of r.decls) {
      assert.ok(!/^(border|padding)/.test(p), `${r.selector} sets ${p}`);
    }
  }
});

test("SC-06: the scale is not set by a script or an attribute - no style= in index.html, no root-size calls in public/*.js, the window size is read only in boot.js", () => {
  const html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
  assert.equal((html.match(/style\s*=/gi) ?? []).length, 0);
  const files = fs.readdirSync(PUBLIC).filter((f) => f.endsWith(".js"));
  assert.ok(files.includes("app.js") && files.includes("boot.js"));
  for (const f of files) {
    const text = fs.readFileSync(path.join(PUBLIC, f), "utf8");
    for (const word of [
      "documentElement",
      "getComputedStyle",
      "fontSize",
      "setProperty",
      "devicePixelRatio",
      "cssText",
    ]) {
      assert.ok(!text.includes(word), `${f} has ${word}`);
    }
    assert.ok(
      !/\.style\b|setAttribute\(\s*["']style/.test(text),
      `${f} writes style`,
    );
    if (f !== "boot.js") {
      assert.ok(
        !/innerWidth|innerHeight/.test(text),
        `${f} reads the window size`,
      );
    }
  }
  assert.ok(
    /innerWidth/.test(fs.readFileSync(path.join(PUBLIC, "boot.js"), "utf8")),
  );
});

// ------------------------------------------------------------------ NM-07
// REQ-036 criterion 7: the block "Сейчас" and its rows are sized in rem, no
// height in px; the numbers of px lines and @media stay (SC-03, SC-05 as they
// were). The view at the named windows is measured by DESIGN-QA-VALIDATOR.

test("NM-07: the rule of the CSS of 'Сейчас' (the view is measured in a browser at step 7) - every rule of the block is in rem, no px but the line of 1 px; the wide header keeps 3.75rem with two rows seen (2.75rem, list 2.125rem), elsewhere five rows (5.5rem); the font of a row is not smaller than the words of a journal row; still exactly two @media", () => {
  const ofBlock = PARSED.rules.filter((r) =>
    r.selector
      .split(",")
      .some((s) => /(^|[\s>+~])\.now([-\w]*)/.test(s.trim())),
  );
  assert.ok(ofBlock.length >= 10, `rules of the block: ${ofBlock.length}`);
  for (const rule of ofBlock) {
    for (const [prop, value] of rule.decls) {
      if (!/px/.test(value)) continue;
      assert.match(
        `${prop}: ${value}`,
        /^border: 1px solid var\(--[a-z-]+\)$/,
        `${rule.media ?? "-"} ${rule.selector}`,
      );
    }
    for (const [prop, value] of rule.decls) {
      if (!/^(min-|max-)?height$/.test(prop)) continue;
      assert.match(
        value,
        /^(auto|\d+(\.\d+)?rem)$/,
        `${rule.selector} ${prop}`,
      );
    }
  }
  assert.equal(declOf(".now", "height", WIDE), "2.75rem");
  assert.equal(declOf(".now-list", "max-height", WIDE), "2.125rem");
  assert.equal(declOf(".now-list", "max-height"), "5.5rem");
  assert.equal(declOf(".now-list", "overflow-y"), "auto");
  assert.equal(declOf(".top", "height", WIDE), "3.75rem");
  const rem = (v) => Number(/^([\d.]+)rem$/.exec(v)[1]);
  assert.ok(
    rem(declOf(".now-row", "font-size")) >= rem(declOf(".event", "font-size")),
  );
  assert.deepEqual(
    PARSED.media.filter((m, i, a) => a.indexOf(m) === i).sort(),
    [NARROW, WIDE].sort(),
  );
});
