/* global document, getComputedStyle, HTMLElement, innerHeight, innerWidth, NodeFilter, requestAnimationFrame, window */

// The in-page measures of the e2e tests of app/test/e2e (no test here; the code design 10, `landing.test.js` and
// `stage.test.js`): what a page shows to the eye, read once in the page and reported as lines, so every LD and ST
// test reads a state the same way (AP-014). Each function that runs in the page is self-contained (it is sent to
// the browser as source text) and gives plain data; nothing in the page is changed, but a scroll position (a
// control is scrolled to the middle of the window to see what lies over it, and the page is scrolled back) and,
// for `skipLinkFindings` and `focusWalkFindings`, the focus.

/**
 * Everything the layout rules of REQ-111 criterion 12 read in the page now, as lines of findings, and the sizes of
 * the controls (for a test that wants them). A finding is one line, `<rule>: <what>`.
 *
 * - `scroll`: `document.documentElement.scrollWidth` above `innerWidth`.
 * - `cut`: the reading of decisions/0123 V2: every visible text node that is not only white space (its parent's
 *   `checkVisibility()` true; the visually hidden `.sr` elements and what they hold left out) is read on its nearest
 *   ancestor whose computed display is not inline (and is not `contents`, which has no box), and that ancestor's
 *   `scrollWidth` may not be above its `clientWidth`.
 * - `contrast`: every visible text element (the parent of such a text node) against its background found up the tree,
 *   at least 4.5:1 (the colour and the backgrounds composited, opacity of the element included).
 * - `size`: every visible button and link (the skip link, which stands outside the window until it has the focus,
 *   aside; its place is read by `skipLinkFindings` below) at least 44 × 44 CSS pixels.
 * - `overlap`: two visible controls whose boxes meet over more than one square pixel (a control that is fixed or
 *   sticky, as the phone bar of the demo, is read only against the others of its kind: the page scrolls from under
 *   it).
 * - `covered`: a control scrolled to the middle of the window whose middle point is hit by an element that is neither
 *   the control nor inside it.
 * @param {{ minSide?: number, ratio?: number }} [options]
 * @returns {Promise<string[]>}
 */
export async function layoutFindingsIn(options = {}) {
  const minSide = options.minSide ?? 44;
  const ratio = options.ratio ?? 4.5;
  /** @type {string[]} */
  const out = [];
  /** @param {Element} e */
  const describe = (e) => {
    const cls =
      typeof e.className === "string" && e.className !== ""
        ? `.${e.className.trim().split(/\s+/).join(".")}`
        : "";
    const id = e.id === "" ? "" : `#${e.id}`;
    const own = (e.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${e.tagName.toLowerCase()}${id}${cls}${own === "" ? "" : ` «${own}»`}`;
  };
  /** @param {Element} e */
  const inSr = (e) => e.closest(".sr") !== null;
  /** @param {Element} e */
  const shown = (e) => e.checkVisibility({ checkVisibilityCSS: true });
  /**
   * @param {string} s
   * @returns {number[] | null} red, green, blue (0-255) and alpha
   */
  const parse = (s) => {
    let m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m !== null) {
      const p = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    m = /^color\(srgb ([^)]+)\)$/.exec(s);
    if (m !== null) {
      const p = m[1].split(/[ /]+/).filter(Boolean).map(Number);
      return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
    }
    return null;
  };
  /**
   * @param {number[]} top
   * @param {number[]} bottom
   */
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2]
      .map((k) => (top[k] * top[3] + bottom[k] * bottom[3] * (1 - top[3])) / a)
      .concat([a]);
  };
  /** @param {number[]} c */
  const lum = (c) => {
    const f = (/** @type {number} */ v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };

  // The entrance motion of the page (the look's 10) has ended: a text at the start of its rise is almost clear.
  await Promise.all(
    document
      .getAnimations()
      .filter(
        (a) =>
          a.effect !== null &&
          a.effect.getComputedTiming().iterations !== Infinity,
      )
      .map((a) => a.finished.catch(() => {})),
  );

  if (document.documentElement.scrollWidth > innerWidth)
    out.push(
      `scroll: scrollWidth ${document.documentElement.scrollWidth} above innerWidth ${innerWidth}`,
    );

  // The text nodes that are seen.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  /** @type {Set<Element>} */
  const boxes = new Set();
  /** @type {Set<Element>} */
  const holders = new Set();
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    if ((n.nodeValue ?? "").trim() === "") continue;
    const parent = n.parentElement;
    if (parent === null || !shown(parent) || inSr(parent)) continue;
    holders.add(parent);
    let box = parent;
    for (;;) {
      const d = getComputedStyle(box).display;
      if (d !== "inline" && d !== "contents") break;
      if (box.parentElement === null) break;
      box = box.parentElement;
    }
    boxes.add(box);
  }
  for (const box of boxes)
    if (box.scrollWidth > box.clientWidth)
      out.push(
        `cut: ${describe(box)} scrollWidth ${box.scrollWidth} above clientWidth ${box.clientWidth}`,
      );

  // The contrast of every text element.
  for (const el of holders) {
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (fg === null) {
      out.push(
        `contrast: ${describe(el)} has a colour that is not read: ${cs.color}`,
      );
      continue;
    }
    /** @type {number[][]} */
    const layers = [];
    let opaque = false;
    let image = false;
    let opacity = 1;
    for (
      let e = /** @type {Element | null} */ (el);
      e !== null;
      e = e.parentElement
    ) {
      const s = getComputedStyle(e);
      opacity *= Number(s.opacity);
      if (s.backgroundImage !== "none") image = true;
      const c = parse(s.backgroundColor);
      if (c !== null && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) {
          opaque = true;
          break;
        }
      }
    }
    if (image) {
      out.push(`contrast: ${describe(el)} stands on a background image`);
      continue;
    }
    if (!opaque) {
      out.push(
        `contrast: ${describe(el)} has no opaque background up the tree`,
      );
      continue;
    }
    let back = layers[layers.length - 1];
    for (let k = layers.length - 2; k >= 0; k--) back = over(layers[k], back);
    const text = over([fg[0], fg[1], fg[2], fg[3] * opacity], back);
    const l1 = lum(text);
    const l2 = lum(back);
    const r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (r < ratio)
      out.push(
        `contrast: ${describe(el)} ${r.toFixed(2)}:1 (${cs.color} on rgb(${back.slice(0, 3).map(Math.round).join(", ")}))`,
      );
  }

  // The controls.
  const controls = [...document.querySelectorAll("a[href], button")].filter(
    (e) => !e.classList.contains("skip") && !inSr(e) && shown(e),
  );
  /** @param {Element} e */
  const pinned = (e) => {
    for (
      let p = /** @type {Element | null} */ (e);
      p !== null;
      p = p.parentElement
    ) {
      const pos = getComputedStyle(p).position;
      if (pos === "fixed" || pos === "sticky") return true;
    }
    return false;
  };
  window.scrollTo(0, 0);
  const boxesOf = controls.map((e) => ({
    e,
    r: e.getBoundingClientRect(),
    pin: pinned(e),
  }));
  for (const { e, r } of boxesOf) {
    if (r.width === 0 || r.height === 0) continue;
    if (r.width < minSide - 0.01 || r.height < minSide - 0.01)
      out.push(
        `size: ${describe(e)} ${r.width.toFixed(1)} x ${r.height.toFixed(1)}`,
      );
  }
  for (let i = 0; i < boxesOf.length; i++)
    for (let j = i + 1; j < boxesOf.length; j++) {
      const a = boxesOf[i];
      const b = boxesOf[j];
      if (a.pin !== b.pin || a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 1 && h > 1)
        out.push(
          `overlap: ${describe(a.e)} and ${describe(b.e)} (${w.toFixed(1)} x ${h.toFixed(1)})`,
        );
    }
  for (const { e } of boxesOf) {
    e.scrollIntoView({ block: "center", inline: "center" });
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    if (hit === null || !(e === hit || e.contains(hit)))
      out.push(
        `covered: ${describe(e)} lies under ${hit === null ? "nothing" : describe(hit)}`,
      );
  }
  window.scrollTo(0, 0);
  return out;
}

/**
 * @param {import("playwright-core").Page} page
 * @param {{ minSide?: number, ratio?: number }} [options]
 * @returns {Promise<string[]>}
 */
export function layoutFindings(page, options = {}) {
  return page.evaluate(layoutFindingsIn, options);
}

/**
 * Where the skip link stands (REQ-111 criterion 12, decisions/0124 O18-b, look 7.1), read in the page. At rest (`focused`
 * false: the page has just loaded, scrolled to the top) the link is off the window above: its bottom is at 0 or
 * higher on the screen, whatever its text wraps to. With the focus (`focused` true) it stands in the window at
 * `top: 8px` (look 7.1), inside the window on every side, with no cut text.
 * @param {boolean} focused
 * @returns {string[]}
 */
export function skipLinkFindingsIn(focused) {
  const link = document.querySelector("a.skip");
  if (link === null) return ["skip link: no a.skip on the page"];
  const r = link.getBoundingClientRect();
  const at = `${focused ? "focused" : "at rest"} (top ${r.top.toFixed(1)}, bottom ${r.bottom.toFixed(1)}, left ${r.left.toFixed(1)}, right ${r.right.toFixed(1)}, window ${innerWidth} x ${innerHeight})`;
  /** @type {string[]} */
  const out = [];
  if (r.width === 0 || r.height === 0) out.push(`skip link: no box ${at}`);
  if (!focused) {
    if (document.activeElement === link)
      out.push(`skip link: it has the focus at load ${at}`);
    if (r.bottom > 0)
      out.push(`skip link: its bottom shows over the window ${at}`);
    return out;
  }
  if (document.activeElement !== link)
    out.push(`skip link: it does not take the focus ${at}`);
  if (Math.abs(r.top - 8) > 0.5)
    out.push(`skip link: its top is not 8 px ${at}`);
  if (r.left < 0 || r.right > innerWidth || r.bottom > innerHeight)
    out.push(`skip link: it is not inside the window ${at}`);
  if (link.scrollWidth > link.clientWidth)
    out.push(
      `skip link: cut text, scrollWidth ${link.scrollWidth} above clientWidth ${link.clientWidth}`,
    );
  return out;
}

/**
 * The skip link of a page just loaded, at rest and then with the focus (given by a call); the focus is taken off
 * again after the reading.
 * @param {import("playwright-core").Page} page
 * @returns {Promise<string[]>}
 */
export async function skipLinkFindings(page) {
  const out = await page.evaluate(skipLinkFindingsIn, false);
  // Focused by a call, not by the first Tab: the demo page puts the focus on its heading at load (demo.js), so the
  // first Tab there starts after the heading; the rule under test is the link's `:focus` place.
  await page.evaluate(() => {
    const link = document.querySelector("a.skip");
    if (link instanceof HTMLElement) link.focus();
  });
  out.push(...(await page.evaluate(skipLinkFindingsIn, true)));
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  return out;
}

/**
 * What the focused control (`document.activeElement`) lies over, read in the page (REQ-111 criterion 12, the scroll
 * padding of site.css that keeps a control the keyboard reaches above the live strip, look 7.11): a finding when
 * its box meets the box of `#ticket` over more than one square pixel and it is not inside the strip itself. Also
 * says which control it is, and whether the walk has come back to its start (the skip link or no control).
 * @returns {{ at: string, card: boolean, back: boolean, findings: string[] }}
 */
export function focusOverStripIn() {
  const strip = document.getElementById("ticket");
  const a = document.activeElement;
  if (strip === null)
    return {
      at: "",
      card: false,
      back: true,
      findings: ["strip: #ticket is not on the page"],
    };
  if (
    a === null ||
    a === document.body ||
    a === document.documentElement ||
    a.classList.contains("skip")
  )
    return { at: "", card: false, back: true, findings: [] };
  const cls =
    typeof a.className === "string" && a.className !== ""
      ? `.${a.className.trim().split(/\s+/).join(".")}`
      : "";
  const at = `${a.tagName.toLowerCase()}${a.id === "" ? "" : `#${a.id}`}${cls} «${(a.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30)}»`;
  /** @type {string[]} */
  const findings = [];
  if (!strip.contains(a)) {
    const r = a.getBoundingClientRect();
    const s = strip.getBoundingClientRect();
    const w = Math.min(r.right, s.right) - Math.max(r.left, s.left);
    const h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
    if (w > 1 && h > 1)
      findings.push(
        `focus under the strip: ${at} (top ${r.top.toFixed(1)}, bottom ${r.bottom.toFixed(1)}) meets #ticket (top ${s.top.toFixed(1)}) by ${w.toFixed(1)} x ${h.toFixed(1)}`,
      );
  }
  return {
    at,
    card: a.classList.contains("card"),
    back: false,
    findings,
  };
}

/**
 * Tabs through the page from its start, one control at a time, and reads after each Tab what the focused control
 * lies over (`focusOverStripIn`), until the walk is back at the skip link or leaves the page. The walk must have
 * reached at least five controls and a card, so a walk that stands still is red as well (a green walk over no
 * control proves nothing).
 * @param {import("playwright-core").Page} page
 * @returns {Promise<string[]>}
 */
export async function focusWalkFindings(page) {
  /** @type {string[]} */
  const out = [];
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const skip = document.querySelector("a.skip");
    if (skip instanceof HTMLElement) skip.focus();
  });
  let stops = 0;
  let cards = 0;
  for (let n = 0; n < 80; n++) {
    await page.keyboard.press("Tab");
    const got = await page.evaluate(focusOverStripIn);
    out.push(...got.findings);
    if (got.back) break;
    stops += 1;
    if (got.card) cards += 1;
  }
  if (stops < 5 || cards === 0)
    out.push(`focus walk: ${stops} controls and ${cards} cards reached`);
  return out;
}

/**
 * The labels of the stage (the door sign, the «Вы» label, the four plates and each line element of a plate,
 * REQ-112 criterion 6, decisions/0123 L3) read at one moment: a label whose `scrollWidth` is above its
 * `clientWidth` is cut, and two labels whose boxes meet over more than half a pixel in both directions overlap.
 * With `overlap` false only the cut is read (a walk: «Вы» passes under a plate at 390, look 9.7).
 * @param {{ overlap: boolean }} options
 * @returns {string[]}
 */
export function labelFindingsIn(options) {
  /** @type {string[]} */
  const out = [];
  /** @param {Element} e */
  const name = (e) =>
    `${e.className === "" ? e.tagName.toLowerCase() : e.className} «${(e.textContent ?? "").trim()}»`;
  const all = [
    ...document.querySelectorAll(
      "#stage-labels .sign, #stage-labels .you, #stage-labels .plate, #stage-labels .plate > span",
    ),
  ];
  if (all.length === 0) out.push("labels: none found in #stage-labels");
  for (const e of all)
    if (e.scrollWidth > e.clientWidth)
      out.push(
        `label cut: ${name(e)} scrollWidth ${e.scrollWidth} above clientWidth ${e.clientWidth}`,
      );
  if (options.overlap) {
    const boxes = [
      ...document.querySelectorAll(
        "#stage-labels .sign, #stage-labels .you, #stage-labels .plate",
      ),
    ];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].getBoundingClientRect();
        const b = boxes[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 0.5 && h > 0.5)
          out.push(
            `labels overlap: ${name(boxes[i])} and ${name(boxes[j])} (${w.toFixed(1)} x ${h.toFixed(1)})`,
          );
      }
  }
  return out;
}

/**
 * @param {import("playwright-core").Page} page
 * @param {{ overlap: boolean }} options
 * @returns {Promise<string[]>}
 */
export function labelFindings(page, options) {
  return page.evaluate(labelFindingsIn, options);
}

/**
 * Starts the test's own `requestAnimationFrame` loop in the page (the code design 10, ST-2; measured F51): on every
 * frame it takes one sample — the stage's `--you`, `data-frames`, the line of the text list that says where «Вы»
 * stands, the live region, and every label that is cut — until that line is `until` and `data-frames` has not
 * changed for 300 ms (then `done` is true), so it sees every frame the page draws. Start it before the tap.
 * @param {string} until
 * @returns {void}
 */
export function startWalkIn(until) {
  const stage = /** @type {HTMLElement} */ (document.getElementById("stage"));
  const line = /** @type {HTMLElement} */ (
    document.getElementById("stage-you")
  );
  const live = /** @type {HTMLElement} */ (document.getElementById("live"));
  /** @type {{ samples: Array<{ you: string, frames: string, line: string, live: string, cut: string[] }>, done: boolean }} */
  const walk = { samples: [], done: false };
  let last = stage.getAttribute("data-frames") ?? "";
  let changedAt = performance.now();
  /** @param {number} now */
  const loop = (now) => {
    const frames = stage.getAttribute("data-frames") ?? "";
    if (frames !== last) {
      last = frames;
      changedAt = now;
    }
    /** @type {string[]} */
    const cut = [];
    for (const e of document.querySelectorAll(
      "#stage-labels .sign, #stage-labels .you, #stage-labels .plate, #stage-labels .plate > span",
    ))
      if (e.scrollWidth > e.clientWidth)
        cut.push(
          `${e.className === "" ? e.tagName.toLowerCase() : e.className} «${(e.textContent ?? "").trim()}» ${e.scrollWidth} > ${e.clientWidth}`,
        );
    walk.samples.push({
      you: stage.style.getPropertyValue("--you"),
      frames,
      line: line.textContent ?? "",
      live: live.textContent ?? "",
      cut,
    });
    if (
      walk.samples.length > 3 &&
      (line.textContent ?? "") === until &&
      now - changedAt >= 300
    )
      walk.done = true;
    else requestAnimationFrame(loop);
  };
  /** @type {any} */ (window).__saiWalk = walk;
  requestAnimationFrame(loop);
}

/**
 * Waits (a deadline of ten seconds, red when it passes) for the loop of `startWalkIn` to be done and returns its
 * samples.
 * @param {import("playwright-core").Page} page
 * @returns {Promise<Array<{ you: string, frames: string, line: string, live: string, cut: string[] }>>}
 */
export async function finishWalk(page) {
  await page.waitForFunction(
    () => /** @type {any} */ (window).__saiWalk.done,
    null,
    { timeout: 10000 },
  );
  return page.evaluate(() => /** @type {any} */ (window).__saiWalk.samples);
}

/**
 * The avatars of the page read the way the code design 10 (LD-4, gate finding G4) says: for each read a new canvas of
 * the avatar's bitmap size, its context made with `willReadFrequently`, the avatar drawn into it by `drawImage`,
 * and `getImageData` of the copy (a second read of the avatar canvas itself prints a console warning). One entry per
 * `canvas[data-avatar]`: its desk, the opaque colours it holds as `#rrggbb`, and the computed `--sc-chair` of the page.
 * @returns {{ chair: string, avatars: Array<{ desk: string, colours: string[] }> }}
 */
export function avatarPixelsIn() {
  const chair = getComputedStyle(document.documentElement)
    .getPropertyValue("--sc-chair")
    .trim();
  const hex = (/** @type {number} */ n) => n.toString(16).padStart(2, "0");
  const avatars = [...document.querySelectorAll("canvas[data-avatar]")].map(
    (c) => {
      const canvas = /** @type {HTMLCanvasElement} */ (c);
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const ctx = /** @type {CanvasRenderingContext2D} */ (
        copy.getContext("2d", { willReadFrequently: true })
      );
      ctx.drawImage(canvas, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      /** @type {Set<string>} */
      const colours = new Set();
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3] === 255)
          colours.add(`#${hex(data[i])}${hex(data[i + 1])}${hex(data[i + 2])}`);
      return {
        desk: canvas.getAttribute("data-avatar") ?? "",
        colours: [...colours],
      };
    },
  );
  return { chair, avatars };
}

/**
 * @param {import("playwright-core").Page} page
 * @returns {Promise<{ chair: string, avatars: Array<{ desk: string, colours: string[] }> }>}
 */
export function avatarPixels(page) {
  return page.evaluate(avatarPixelsIn);
}
