/* global document, getComputedStyle, Node, window */
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  newPage,
  openBrowser,
  serveLocal,
  servePublicSet,
  shownTextFindings,
} from "../fixtures/browser.js";
import {
  answerAndWait,
  answerFixtures,
  atDesk,
  clearReports,
  clearSpeakerStress,
  collector,
  filled,
  framesPass,
  intakeIn,
  LINE_404,
  liveBack,
  liveResult,
  LOCAL_LANGS,
  norm,
  pageReady,
  placeLine,
  publicFiles,
  readState,
  reportedProblems,
  say,
  shownKind,
  speakerRow,
  stressSpeakerLine,
  waitHeading,
  waitLive,
  waitPlace,
  WINDOWS,
} from "../fixtures/e2e-kit.js";
import { startNode, waitFor } from "../fixtures/helpers.js";
import {
  avatarPixels,
  focusWalkFindings,
  layoutFindings,
  skipLinkFindings,
} from "../fixtures/page-checks.js";

// REQ-111 criterion 12 (the landing in a browser, automated) and the page parts of criteria 4, 9 and 10: the
// tests LD-1 … LD-9 of the code design 10, one real Chrome, the local server on port 0 (the public set for LD-9).
// A test reads every state it reaches and collects what it finds in `problems`; it asserts the list is empty at
// its end, so one run shows every finding. The lint of the shown text (`shownTextFindings`) is read after each
// state, not only at load: a text that a page script writes shows only then.

/** The scene's chair colour of look 6.2 in the two themes: the avatars hold the one of the theme drawn. */
const CHAIR = Object.freeze({ light: "#418e9d", dark: "#3c4b6a" });
/** The desks that ask question 1 … 5 (look 9.13). */
const ASKING_DESK = Object.freeze([1, 2, 3, 3, 4]);

const PATHS = Object.freeze([
  "/",
  "/how.html",
  "/examples.html",
  "/demo.html",
  "/nope",
  "/a/b/c.html",
  "/x/y/",
]);
const NOT_FOUND_PATHS = new Set(["/nope", "/a/b/c.html", "/x/y/"]);
/** The routes of the demo: the only requests of a page besides the files of app/public. */
const DEMO_ROUTES = new Set(["/api/demo/questionnaire", "/api/demo/result"]);

/**
 * Taps an answer card (0-3 an option, `options` «Не знаю») of the question on the screen, with a read of the shown
 * text before the tap, and waits for the next heading.
 * @param {ReturnType<typeof collector>} problems
 * @param {string} where
 * @param {Awaited<ReturnType<typeof newPage>>} env
 * @param {string} lang
 * @param {number} index
 * @param {string} next
 */
async function tap(problems, where, env, lang, index, next) {
  await answerAndWait(env.page, index, next);
  problems.add(where, await shownTextFindings(env.page, lang));
}

// ---------------------------------------------------------------------------------------------------------
// REQ-113 (the visitor status block): the readers and the checks that LD-3 (how.html), LD-6 (the demo result) and
// LD-9 (the public set) share. The oracle is the test's own: the words come from the function `words(key)` that
// the caller gives (the texts module for the local server, the output's module for the public set); the three rows,
// the marks, the skeleton and the geometry rules are written here.

/** The three rows of the status block (the look 7.22): the keys of the title, of the line and of the mark. */
const STATUS_ROWS = Object.freeze([
  Object.freeze({
    title: "now_demo_t",
    line: "now_demo_s",
    mark: "stat_on",
    cls: "stat on",
  }),
  Object.freeze({
    title: "now_idea_t",
    line: "now_idea_s",
    mark: "stat_off",
    cls: "stat",
  }),
  Object.freeze({
    title: "now_build_t",
    line: "now_build_s",
    mark: "stat_off",
    cls: "stat",
  }),
]);

/**
 * The shape of the status block, the same on the result and on how.html (REQ-113 design 4.2): an element is
 * `<tag`, then (when it has attributes other than `data-t`) a space and the attributes sorted by name as
 * `name=value` joined by commas, `>`, its child elements, `</>`; text and `data-t` are left out.
 */
const NOW_SKELETON =
  "<section aria-labelledby=now-title,class=info now><h3 id=now-title></><ul class=rl>" +
  "<li><span class=stat on></><span class=rn><b></><small></></></>" +
  "<li><span class=stat></><span class=rn><b></><small></></></>" +
  "<li><span class=stat></><span class=rn><b></><small></></></>" +
  "</><p></></>";

/** The 15 keys of REQ-113 criterion 1 (13 new, two changed): the public set must keep each with its ru and en values. */
const STATUS_KEYS = Object.freeze([
  "now_title",
  "now_demo_t",
  "now_demo_s",
  "now_idea_t",
  "now_idea_s",
  "now_build_t",
  "now_build_s",
  "stat_on",
  "stat_off",
  "now_closing",
  "how_plan_note",
  "how_stage_1_note",
  "demo_accuracy_note",
  "idea_panel_lead",
  "demo_accuracy",
]);

/** The windows of the layout cells of LD-6 row 15: the three of the matrix and the two between the phones. */
const CELL_WINDOWS = Object.freeze([
  ...WINDOWS,
  { name: "360x800", width: 360, height: 800 },
  { name: "380x800", width: 380, height: 800 },
]);

/**
 * Reads the status block inside `scope` (a selector), as plain data: how many blocks stand there, and for the
 * first one its heading, the target of its label, its rows (the mark, its class, the mark's `innerText`, its
 * fill, the title, the line, the boxes of the mark and of the title block), its closing paragraph (the
 * computed size and colour against those of `body`), the controls inside, its shape and its box.
 * @param {import("playwright-core").Page} page
 * @param {string} scope
 */
function readBlock(page, scope) {
  return page.evaluate((/** @type {string} */ within) => {
    const text = (/** @type {Element | null} */ e) =>
      (e?.textContent ?? "").replace(/\s+/g, " ").trim();
    /** @param {Element} e @returns {string} */
    const skeletonOf = (e) => {
      const attrs = [...e.attributes]
        .filter((a) => a.name !== "data-t")
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .map((a) => `${a.name}=${a.value}`)
        .join(",");
      return `<${e.tagName.toLowerCase()}${attrs === "" ? "" : ` ${attrs}`}>${[...e.children].map(skeletonOf).join("")}</>`;
    };
    /** @param {Element} e */
    const box = (e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const blocks = [...document.querySelectorAll(`${within} section.info.now`)];
    const root = blocks[0];
    if (root === undefined) return { count: 0, block: null };
    const h3 = root.querySelector("h3");
    const labelled = root.getAttribute("aria-labelledby");
    const closing = root.lastElementChild;
    const bodyColor = getComputedStyle(document.body).color;
    // Words that stand in no part of the block (a bare text node in the section, the list or a row, or after the
    // closing paragraph): the shape of the elements cannot see them.
    /** @type {string[]} */
    const stray = [];
    const SHOW_TEXT = 0x4;
    const walker = document.createTreeWalker(root, SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const holder = n.parentElement;
      const own =
        holder !== null &&
        (holder === closing || holder.matches("h3, span.stat, b, small"));
      const said = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!own && said !== "") stray.push(said);
    }
    const rows = [...root.querySelectorAll("ul.rl > li")].map((li) => {
      const mark = /** @type {HTMLElement} */ (li.querySelector(".stat"));
      const title = /** @type {Element} */ (li.querySelector(".rn"));
      const style = getComputedStyle(mark);
      return {
        mark: text(mark),
        markInner: mark.innerText,
        markClass: mark.getAttribute("class"),
        fill: { background: style.backgroundColor, color: style.color },
        title: text(li.querySelector("b")),
        line: text(li.querySelector("small")),
        markBox: box(mark),
        titleBox: box(title),
      };
    });
    return {
      count: blocks.length,
      block: {
        heading: text(h3),
        labelledByHeading:
          h3 !== null &&
          labelled !== null &&
          document.getElementById(labelled) === h3,
        text: text(root),
        stray,
        rows,
        closing:
          closing === null
            ? null
            : {
                tag: closing.tagName.toLowerCase(),
                text: text(closing),
                cls: closing.getAttribute("class"),
                size: parseFloat(getComputedStyle(closing).fontSize),
                color: getComputedStyle(closing).color,
                bodyColor,
              },
        controls: root.querySelectorAll(
          "a, button, input, select, textarea, form",
        ).length,
        skeleton: skeletonOf(root),
        box: box(root),
        everyShown: [root, ...root.querySelectorAll("*")].every((e) =>
          e.checkVisibility({ checkVisibilityCSS: true }),
        ),
      },
    };
  }, scope);
}

/** @typedef {Awaited<ReturnType<typeof readBlock>>} BlockRead */

/**
 * The status block as REQ-113 criteria 3 and 6 want it, against the words the caller gives: one block, its
 * heading and the label that names it, three rows with the title and the line of each part, the marks in
 * order (words, not only a colour; the mark `Working` filled and the other two plain), the closing paragraph as
 * body text of at least 16 px, no link, button or field, the markup of the design, and no word outside the heading,
 * the rows and the closing paragraph.
 * @param {BlockRead} read
 * @param {(key: string) => string} words
 * @param {string} where
 */
function checkBlock(read, words, where) {
  assert.equal(read.count, 1, `${where}: exactly one status block`);
  const b = read.block;
  assert.ok(b !== null, `${where}: exactly one status block`);
  assert.equal(
    b.heading,
    norm(words("now_title")),
    `${where}: the heading of the status block`,
  );
  assert.equal(
    b.labelledByHeading,
    true,
    `${where}: the heading of the status block labels it`,
  );
  assert.deepEqual(
    b.rows.map((r) => [r.title, r.line]),
    STATUS_ROWS.map((r) => [norm(words(r.title)), norm(words(r.line))]),
    `${where}: three rows with the title and the line of each part`,
  );
  assert.deepEqual(
    b.rows.map((r) => [r.mark, r.markClass]),
    STATUS_ROWS.map((r) => [norm(words(r.mark)), r.cls]),
    `${where}: the marks in order`,
  );
  for (const r of b.rows)
    assert.equal(r.markInner, r.mark, `${where}: a mark reads as its word`);
  // The mark «Working» is filled and the marks «Not yet» are plain: they differ by the computed fill and colour, so the
  // eye tells them apart as well as the word does.
  const [on, ...off] = b.rows.map((r) => r.fill);
  for (const plain of off) {
    assert.notEqual(
      on.background,
      plain.background,
      `${where}: the mark Working is filled, the others are plain`,
    );
    assert.notEqual(
      on.color,
      plain.color,
      `${where}: the mark Working has its own colour`,
    );
    assert.equal(
      plain.background,
      "rgba(0, 0, 0, 0)",
      `${where}: a mark Not yet has no fill`,
    );
  }
  assert.notEqual(
    on.background,
    "rgba(0, 0, 0, 0)",
    `${where}: the mark Working is filled, the others are plain`,
  );
  const c = b.closing;
  assert.ok(c !== null, `${where}: the closing paragraph`);
  assert.equal(c.tag, "p", `${where}: the closing paragraph is the last child`);
  assert.equal(
    c.text,
    norm(words("now_closing")),
    `${where}: the closing paragraph says its words`,
  );
  assert.ok(
    c.cls === null && c.size >= 16 && c.color === c.bodyColor,
    `${where}: the closing paragraph is body text of at least 16 px`,
  );
  assert.equal(
    b.controls,
    0,
    `${where}: the status block holds no link, button or field`,
  );
  assert.equal(
    b.skeleton,
    NOW_SKELETON,
    `${where}: the status block has the markup of the design`,
  );
  assert.deepEqual(
    b.stray,
    [],
    `${where}: the status block holds its words and nothing more`,
  );
  assert.equal(
    b.everyShown,
    true,
    `${where}: every part of the status block is visible`,
  );
}

/**
 * Where the mark of each row stands against its title block (the look 7.22): from 480 px up right of it and with
 * its top at the top of the title block, below 480 px above it.
 * @param {BlockRead} read
 * @param {number} width the window's width
 * @param {string} where
 */
function checkRowSides(read, width, where) {
  const b = read.block;
  assert.ok(b !== null, `${where}: the status block is there`);
  for (const r of b.rows)
    if (width >= 480) {
      assert.ok(
        r.markBox.left >= r.titleBox.right - 0.5,
        `${where}: the mark of a row stands right of its title`,
      );
      assert.ok(
        Math.abs(r.markBox.top - r.titleBox.top) <= 0.5,
        `${where}: the mark of a row starts at the top of its title`,
      );
    } else
      assert.ok(
        r.markBox.bottom <= r.titleBox.top + 0.5,
        `${where}: the mark of a row stands above its title`,
      );
}

/**
 * The boxes of the parts of the demo result that the look 8.4 orders: the receipt block, the side area, the status
 * block, the idea panel, the answers, the lists.
 * @param {import("playwright-core").Page} page
 */
function readParts(page) {
  return page.evaluate(() => {
    /** @param {string} s */
    const box = (s) => {
      const e = document.querySelector(`#demo ${s}`);
      if (e === null) return null;
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    return {
      sum: box(".r-sum"),
      side: box(".r-side"),
      now: box("section.info.now"),
      idea: box(".idea"),
      answers: box(".r-ans"),
      lists: box(".r-lines"),
    };
  });
}

/**
 * Reads how.html as REQ-113 criterion 6 describes it: the order of the block, the plan note, the steps, the stages
 * and the panels; the two notes (class, computed size and colour); each stage's children, marks and names; the
 * four step buttons and what they hold.
 * @param {import("playwright-core").Page} page
 */
function readHow(page) {
  return page.evaluate(() => {
    const text = (/** @type {Element | null} */ e) =>
      (e?.textContent ?? "").replace(/\s+/g, " ").trim();
    /** @param {Element | null} a @param {Element | null} b whether b follows a and is no part of it */
    const follows = (a, b) =>
      a !== null &&
      b !== null &&
      !a.contains(b) &&
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const intro = document.querySelector("section.intro");
    const block = document.querySelector("section.info.now");
    const plan = document.querySelector('[data-t="how_plan_note"]');
    const steps = document.querySelector("ol.steps");
    const stages = document.querySelector("div.how-stages");
    const panels = document.querySelector("div.panels");
    const bodyColor = getComputedStyle(document.body).color;
    const notes = ["how_plan_note", "how_stage_1_note"].map((key) => {
      const e = document.querySelector(`[data-t="${key}"]`);
      return {
        key,
        text: text(e),
        cls: e?.getAttribute("class") ?? null,
        size: e === null ? 0 : parseFloat(getComputedStyle(e).fontSize),
        color: e === null ? "" : getComputedStyle(e).color,
        bodyColor,
        shown: e?.checkVisibility({ checkVisibilityCSS: true }) ?? false,
      };
    });
    const stageList = [1, 2, 3, 4].map((n) => {
      const s = document.getElementById(`stage-${n}`);
      return {
        n,
        kids: [...(s?.children ?? [])].map((e) => ({
          tag: e.tagName.toLowerCase(),
          cls: e.getAttribute("class"),
          text: text(e),
          marks: [...e.querySelectorAll(".stat")].map((m) => ({
            text: text(m),
            cls: m.getAttribute("class"),
            name: text(m.nextElementSibling),
            shown: m.checkVisibility({ checkVisibilityCSS: true }),
          })),
        })),
      };
    });
    const buttons = [...document.querySelectorAll("ol.steps button")].map(
      (b) => ({
        step: b.getAttribute("data-step"),
        pressed: b.getAttribute("aria-pressed"),
        name: text(b.querySelector("b")),
        sub: text(b.querySelector("b + span")),
      }),
    );
    return {
      order: {
        introBeforeBlock: follows(intro, block),
        blockBeforePlan: follows(block, plan),
        planBeforeSteps: follows(plan, steps),
        stepsBeforeStages: follows(steps, stages),
        blockOutsidePanels:
          block !== null &&
          (panels === null ||
            (!panels.contains(block) && follows(block, panels))),
        planOutside:
          plan !== null &&
          block !== null &&
          steps !== null &&
          !block.contains(plan) &&
          !steps.contains(plan) &&
          plan.closest("button") === null,
      },
      notes,
      stages: stageList,
      buttons,
      inSteps:
        steps?.querySelectorAll(
          '.stat, .stat-line, [data-t="how_plan_note"], [data-t="how_stage_1_note"]',
        ).length ?? -1,
    };
  });
}

/**
 * how.html as REQ-113 criteria 6 and 7 want it in a language: the status block (and, from 760 px up, no wider than
 * 640 px), the order of the parts, the plan note after the block and before the stages, each stage's marks, note and
 * text in order, the two notes as body text, the four step buttons with no mark or note in them.
 * @param {import("playwright-core").Page} page
 * @param {(key: string) => string} words
 * @param {string} where
 * @param {number} width the window's width
 * @param {string} lang
 */
async function checkHowPage(page, words, where, width, lang) {
  const block = await readBlock(page, "main");
  checkBlock(block, words, where);
  assert.ok(block.block !== null);
  if (lang === "en")
    assert.doesNotMatch(
      block.block.text,
      /\p{Script=Cyrillic}/u,
      `${where}: no Russian left in the status block`,
    );
  if (width >= 760)
    assert.ok(
      block.block.box.right - block.block.box.left <= 640.5,
      `${where}: the status block is no wider than 640 px`,
    );
  checkRowSides(block, width, where);
  const how = await readHow(page);
  assert.deepEqual(
    [
      how.order.introBeforeBlock,
      how.order.blockBeforePlan,
      how.order.blockOutsidePanels,
    ],
    [true, true, true],
    `${where}: the block follows the intro and precedes the steps`,
  );
  assert.deepEqual(
    [
      how.order.planBeforeSteps,
      how.order.stepsBeforeStages,
      how.order.planOutside,
    ],
    [true, true, true],
    `${where}: the plan note stands after the block and before the stages`,
  );
  for (const note of how.notes) {
    assert.equal(
      note.text,
      norm(words(note.key)),
      `${where}: ${note.key} says its words`,
    );
    assert.ok(
      note.cls === null && note.size >= 16 && note.color === note.bodyColor,
      `${where}: a note is body text`,
    );
    assert.equal(note.shown, true, `${where}: ${note.key} is visible`);
  }
  for (const stage of how.stages) {
    const want = [
      ["h2", null],
      ["p", "stat-line"],
      ...(stage.n === 1 ? [["p", null]] : []),
      ["p", null],
    ];
    assert.deepEqual(
      stage.kids.map((k) => [k.tag, k.cls]),
      want,
      `${where}: the stage ${stage.n} holds its marks, its note and its text in order`,
    );
    const [head, marks, ...rest] = stage.kids;
    assert.equal(
      head.text,
      `${stage.n} · ${norm(words(`stage_${stage.n}`))}`,
      `${where}: the stage ${stage.n} keeps its name`,
    );
    const marked =
      stage.n === 1
        ? [
            ["stat_on", "stat on", "now_demo_t"],
            ["stat_off", "stat", "now_idea_t"],
          ]
        : [["stat_off", "stat", null]];
    assert.deepEqual(
      marks.marks.map((m) => [m.text, m.cls, m.name]),
      marked.map(([mark, cls, name]) => [
        norm(words(mark)),
        cls,
        name === null ? "" : norm(words(name)),
      ]),
      `${where}: the stage ${stage.n} holds its marks, its note and its text in order`,
    );
    assert.ok(
      marks.marks.every((m) => m.shown),
      `${where}: the marks of the stage ${stage.n} are visible`,
    );
    assert.deepEqual(
      rest.map((k) => k.text),
      [
        ...(stage.n === 1 ? [norm(words("how_stage_1_note"))] : []),
        norm(words(`how_stage_${stage.n}_text`)),
      ],
      `${where}: the stage ${stage.n} holds its marks, its note and its text in order`,
    );
  }
  assert.deepEqual(
    how.buttons,
    [1, 2, 3, 4].map((n) => ({
      step: String(n),
      pressed: "false",
      name: norm(words(`stage_${n}`)),
      sub: norm(words(`stage_${n}_sub`)),
    })),
    `${where}: the stage buttons carry no mark and no note`,
  );
  assert.equal(
    how.inSteps,
    0,
    `${where}: the stage buttons carry no mark and no note`,
  );
}

/**
 * The parts of a demo result that REQ-113 criteria 3 to 5 name, on a result `readResult` has read: the status
 * block (rows 2 to 8 of LD-6), its place against the lists and the idea panel, the panel's title, honest lead and
 * button with no grey line, and the accuracy row with its label and sentence (a recommended result) or none (the
 * no-match result), and no whole word «точность» or «accuracy» in ru and en.
 * @param {Awaited<ReturnType<typeof readResult>>} got
 * @param {string} lang
 * @param {(key: string) => string} words
 * @param {string} where
 * @param {boolean} recommended whether the receipt names a solution
 */
function checkStatus(got, lang, words, where, recommended) {
  checkBlock(got.now, words, where);
  assert.ok(
    got.blockBeforeIdea && !got.blockInLists,
    `${where}: the block is outside the lists of the result`,
  );
  assert.deepEqual(
    got.linkAfterBlock,
    {
      text: words("describe_idea"),
      href: "/how.html#describe-idea",
      isIdeaLink: true,
    },
    `${where}: the link of the panel is the first link after the block`,
  );
  assert.deepEqual(
    got.ideaKids,
    [
      ["h3", norm(words("idea_panel_title"))],
      ["p", norm(words("idea_panel_lead"))],
      ["a", norm(words("describe_idea"))],
    ],
    `${where}: the idea panel holds its title, the honest lead and the button`,
  );
  assert.equal(got.fineCount, 0, `${where}: the small grey line is gone`);
  if (recommended) {
    assert.equal(
      got.accLabel,
      norm(words("demo_accuracy")),
      `${where}: the label of the accuracy row`,
    );
    assert.deepEqual(
      got.accNote,
      {
        count: 1,
        text: norm(words("demo_accuracy_note")),
        afterProg: true,
      },
      `${where}: the sentence stands in the accuracy row after the pips`,
    );
  } else
    assert.deepEqual(
      got.accNote,
      { count: 0, text: "", afterProg: false },
      `${where}: no sentence of the accuracy row on a no-match result`,
    );
  if (lang === "ru" || lang === "en")
    assert.doesNotMatch(
      got.resultText,
      /(?<![\p{L}\p{N}])(?:точность|accuracy)(?![\p{L}\p{N}])/iu,
      `${where}: no word accuracy on the result`,
    );
}

test(
  "LD-1 every page in the three windows, two themes and three languages: no scroll, no cut text, controls, the two lines, language and title, contrast, no outside request, no CSP violation, a clean console, the lint",
  {
    timeout: 900000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const files = publicFiles();
    const problems = collector();
    let loads = 0;
    for (const win of WINDOWS)
      for (const scheme of /** @type {const} */ (["light", "dark"])) {
        const env = await newPage(browser, t, {
          port,
          viewport: { width: win.width, height: win.height },
          colorScheme: scheme,
        });
        for (const lang of LOCAL_LANGS)
          for (const pathname of PATHS) {
            const where = `${win.name} ${scheme} ${lang} ${pathname}`;
            const notFound = NOT_FOUND_PATHS.has(pathname);
            clearReports(env);
            const res = await env.page.goto(
              `${origin}${pathname}?lang=${lang}`,
            );
            loads += 1;
            await pageReady(env.page, pathname, lang);
            await framesPass(env.page, 2);
            if (res === null || res.status() !== (notFound ? 404 : 200))
              problems.add(where, [
                `status ${res === null ? "none" : res.status()} is not ${notFound ? 404 : 200}`,
              ]);
            const lines = await env.page.evaluate(() => {
              /** @param {string} id */
              const read = (id) => {
                const e = document.getElementById(id);
                if (e === null) return null;
                const r = e.getBoundingClientRect();
                return {
                  shown: e.checkVisibility({ checkVisibilityCSS: true }),
                  text: e.textContent ?? "",
                  w: r.width,
                  h: r.height,
                };
              };
              return {
                mode: read("test-mode"),
                ai: read("ai-disclosure"),
              };
            });
            for (const [id, key, got] of /** @type {const} */ ([
              ["test-mode", "test_mode", lines.mode],
              ["ai-disclosure", "ai_disclosure", lines.ai],
            ])) {
              if (got === null || !got.shown || got.w <= 0 || got.h <= 0)
                problems.add(where, [`#${id} is not visible`]);
              else if (norm(got.text) !== norm(say(key, lang)))
                problems.add(where, [
                  `#${id} does not hold the text of ${key}`,
                ]);
            }
            // The skip link first: it stands above the window at load and in the window, at 8 px, with the focus.
            problems.add(where, await skipLinkFindings(env.page));
            problems.add(where, await layoutFindings(env.page));
            problems.add(where, await shownTextFindings(env.page, lang));
            for (const u of env.requested) {
              const p = new URL(u).pathname;
              if (!(
                files.has(p) ||
                DEMO_ROUTES.has(p) ||
                p === pathname ||
                p === "/"
              ))
                problems.add(where, [
                  `a request that is no file of app/public: ${u}`,
                ]);
            }
            problems.add(
              where,
              reportedProblems(env, notFound ? [LINE_404] : []),
            );
            if (
              notFound &&
              !env.consoleLines.every((l) =>
                l.url.startsWith(`${origin}${pathname}`),
              )
            )
              problems.add(where, ["the 404 line is not the page's own"]);
          }
      }
    assert.equal(loads, 126, "7 pages x 3 windows x 2 themes x 3 languages");
    assert.deepEqual(problems.lines(), []);
  },
);

test(
  "LD-2 examples.html shows the three example requests and the two lists in each language",
  {
    timeout: 120000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const keys = [
      "order_examples_h1",
      "order_examples_pitch",
      "order_can_title",
      "order_cannot_title",
      ...[1, 2, 3, 4, 5, 6].map((n) => `order_can_${n}`),
      ...[1, 2, 3, 4, 5].map((n) => `order_cannot_${n}`),
      ...[1, 2, 3].flatMap((n) => [
        `order_example_${n}_kind`,
        `order_example_${n}_request`,
        ...[1, 2, 3].map((k) => `order_example_${n}_gets_${k}`),
        ...[1, 2].map((k) => `order_example_${n}_not_${k}`),
      ]),
    ];
    const env = await newPage(browser, t, { port });
    for (const lang of LOCAL_LANGS) {
      const where = `examples ${lang}`;
      await env.page.goto(`${origin}/examples.html?lang=${lang}`);
      await pageReady(env.page, "/examples.html", lang);
      const got = await env.page.evaluate((/** @type {string[]} */ ks) => {
        /** @type {Record<string, Array<{ shown: boolean, text: string }>>} */
        const out = {};
        for (const k of ks)
          out[k] = [...document.querySelectorAll(`[data-t="${k}"]`)].map(
            (e) => ({
              shown: e.checkVisibility({ checkVisibilityCSS: true }),
              text: e.textContent ?? "",
            }),
          );
        const lists = [...document.querySelectorAll("section.info")].map(
          (s) => s.querySelectorAll("li").length,
        );
        const cards = document.querySelectorAll(
          '[data-t="order_example_label"]',
        ).length;
        return { out, lists, cards };
      }, keys);
      for (const k of keys) {
        const items = got.out[k];
        if (items.length !== 1)
          problems.add(where, [`${k}: ${items.length} elements, not 1`]);
        else if (!items[0].shown) problems.add(where, [`${k} is not visible`]);
        else if (norm(items[0].text) !== norm(say(k, lang)))
          problems.add(where, [`${k} does not show its text`]);
      }
      if (got.cards !== 3)
        problems.add(where, [`${got.cards} example cards, not 3`]);
      if (got.lists.length !== 2 || got.lists[0] !== 6 || got.lists[1] !== 5)
        problems.add(where, [
          `the two lists hold ${got.lists.join(", ")} items, not 6 and 5`,
        ]);
      await readState(problems, where, env, lang);
    }
    assert.deepEqual(problems.lines(), []);
  },
);

test(
  "LD-3 the language switch: the build's languages, lang on each, the current one pressed, no reload, ?lang= set, sai-lang stored, the lint after each switch",
  {
    timeout: 180000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const env = await newPage(browser, t, { port });
    const { page } = env;
    let loads = 0;
    page.on("load", () => (loads += 1));
    await page.goto(`${origin}/`);
    await pageReady(page, "/", "ru");
    assert.equal(loads, 1);
    await page.evaluate(() => {
      /** @type {any} */ (window).__sameDocument = true;
    });
    /** @param {string} current */
    const buttons = async (current) => {
      const rows = await page.$$eval("[data-lang]", (els) =>
        els.map((e) => [
          e.getAttribute("data-lang"),
          e.getAttribute("lang"),
          e.getAttribute("aria-pressed"),
        ]),
      );
      assert.deepEqual(
        rows.map((r) => r[0]),
        [...LOCAL_LANGS],
        "the buttons are the build's languages",
      );
      for (const [l, own, pressed] of rows) {
        assert.equal(own, l, `button ${l} has lang`);
        assert.equal(pressed, String(l === current), `button ${l} pressed`);
      }
    };
    await buttons("ru");
    for (const lang of ["kk", "en", "ru", "en"]) {
      await page.click(`[data-lang="${lang}"]`);
      await pageReady(page, "/", lang);
      const where = `switch to ${lang}`;
      await buttons(lang);
      const after = await page.evaluate(() => ({
        same: /** @type {any} */ (window).__sameDocument === true,
        search: window.location.search,
        stored: localStorage.getItem("sai-lang"),
        h1: document.querySelector("h1")?.textContent ?? "",
        note: document.querySelector(".kk-note")?.textContent ?? null,
      }));
      assert.equal(after.same, true, "no reload: the same document");
      assert.equal(loads, 1, "no load event after the first");
      assert.equal(after.search, `?lang=${lang}`);
      assert.equal(after.stored, lang);
      assert.equal(norm(after.h1), norm(say("landing_h1", lang)));
      assert.equal(
        after.note === null ? null : norm(after.note),
        lang === "kk" ? norm(say("kk_note", "kk")) : null,
        "the Kazakh note of the footer stands in kk only",
      );
      await readState(problems, where, env, lang);
    }
    // The stored language is the default of a page without ?lang=, and ?lang= is stronger than the stored one.
    await page.goto(`${origin}/how.html`);
    await pageReady(page, "/how.html", "en");
    await page.goto(`${origin}/how.html?lang=kk`);
    await pageReady(page, "/how.html", "kk");
    assert.equal(
      await page.evaluate(() => localStorage.getItem("sai-lang")),
      "en",
    );
    await readState(problems, "reload", env, "kk");

    // The demo asks again in the new language; the answers and the scene stay (decisions/0124 О17).
    await page.goto(`${origin}/demo.html?lang=ru`);
    await pageReady(page, "/demo.html", "ru");
    const ru = intakeIn("ru");
    const en = intakeIn("en");
    await answerAndWait(page, 0, ru.questions[1].title);
    await waitPlace(page, atDesk(2, "ru"));
    await page.click('[data-lang="en"]');
    await waitHeading(page, en.questions[1].title);
    await waitPlace(page, atDesk(2, "en"));
    problems.add("demo switch", await shownTextFindings(page, "en"));
    await page.locator("#demo .back").click();
    await waitHeading(page, en.questions[0].title);
    assert.equal(
      await page.locator("#demo .card").nth(0).getAttribute("aria-pressed"),
      "true",
      "the answer given before the switch is kept",
    );
    assert.ok(
      env.requested.some((u) => u.endsWith("/api/demo/questionnaire?lang=en")),
      "the questionnaire is asked again in the new language",
    );
    await readState(problems, "demo switch", env, "en");

    // REQ-113 criteria 6 and 7: how.html shows the status block, the plan note and the marks of the four stages in
    // the language of the page, in both colour schemes, and a switch of the language keeps them in the language of
    // the button, with no reload.
    {
      const how = await newPage(browser, t, { port });
      await how.page.goto(`${origin}/how.html?lang=ru`);
      await pageReady(how.page, "/how.html", "ru");
      /** @param {string} lang */
      const read = async (lang) => {
        for (const scheme of /** @type {const} */ (["light", "dark"])) {
          await how.page.emulateMedia({ colorScheme: scheme });
          await framesPass(how.page, 2);
          await checkHowPage(
            how.page,
            (key) => say(key, lang),
            `how.html ${lang} ${scheme}`,
            1280,
            lang,
          );
        }
        await how.page.emulateMedia({ colorScheme: "light" });
        await readState(problems, `how.html ${lang}`, how, lang);
      };
      await read("ru");
      for (const lang of ["kk", "en", "ru", "en"]) {
        await how.page.click(`[data-lang="${lang}"]`);
        await pageReady(how.page, "/how.html", lang);
        await read(lang);
      }
    }
    // At 390x844 the block starts inside the first screen (the page at its top), and each mark stands above its title.
    for (const scheme of /** @type {const} */ (["light", "dark"])) {
      const phone = await newPage(browser, t, {
        port,
        viewport: { width: 390, height: 844 },
        colorScheme: scheme,
      });
      for (const lang of LOCAL_LANGS) {
        const where = `how.html ${lang} ${scheme} 390x844`;
        await phone.page.goto(`${origin}/how.html?lang=${lang}`);
        await pageReady(phone.page, "/how.html", lang);
        await framesPass(phone.page, 2);
        const first = await readBlock(phone.page, "main");
        const top = first.block?.box.top ?? -1;
        const scrolled = await phone.page.evaluate(() => window.scrollY);
        if (scrolled !== 0 || !(top >= 0 && top < 844))
          problems.add(where, [
            "how.html: the status block starts inside the first screen at 390x844",
          ]);
        await checkHowPage(
          phone.page,
          (key) => say(key, lang),
          where,
          390,
          lang,
        );
        await readState(problems, where, phone, lang);
      }
    }
    // A storage that throws on read and on write: the block stands on how.html in ru, the button en turns it English,
    // and a short pass to a result shows the block.
    {
      const bad = await newPage(browser, t, { port });
      await bad.context.addInitScript(() => {
        const fail = () => {
          throw new Error("storage planted to fail");
        };
        Storage.prototype.getItem = fail;
        Storage.prototype.setItem = fail;
      });
      const { page } = bad;
      await page.goto(`${origin}/how.html`);
      await pageReady(page, "/how.html", "ru");
      checkBlock(
        await readBlock(page, "main"),
        (key) => say(key, "ru"),
        "a throwing storage: the status block",
      );
      await page.click('[data-lang="en"]');
      await pageReady(page, "/how.html", "en");
      checkBlock(
        await readBlock(page, "main"),
        (key) => say(key, "en"),
        "a throwing storage: the status block in en",
      );
      await page.goto(`${origin}/demo.html?lang=en`);
      await pageReady(page, "/demo.html", "en");
      const fixture = answerFixtures().find((f) => f.name === "landing");
      assert.ok(fixture, "the landing fixture");
      for (const q of en.questions) {
        await waitHeading(page, q.title);
        await page
          .locator("#demo .card")
          .nth(q.options.findIndex((o) => o.id === fixture.answers[q.id]))
          .click();
      }
      await waitHeading(page, say("demo_result_title", "en"));
      await page.waitForSelector("#demo .rc-kind, #demo .rc-nomatch");
      checkBlock(
        await readBlock(page, "#demo"),
        (key) => say(key, "en"),
        "a throwing storage: the status block on a result",
      );
      await readState(problems, "a throwing storage how", bad, "en");
    }
    // No script: the page holds the block, the marks and the notes with the ru values, and they are visible.
    {
      const bare = await newPage(browser, t, { port, javaScript: false });
      await bare.page.goto(`${origin}/how.html`);
      await bare.page.waitForSelector("section.info.now");
      await checkHowPage(
        bare.page,
        (key) => say(key, "ru"),
        "no script: the status block holds the ru values",
        1280,
        "ru",
      );
      problems.add("no script", await shownTextFindings(bare.page, "ru"));
      problems.add("no script", reportedProblems(bare));
    }
    assert.deepEqual(problems.lines(), []);
  },
);

/**
 * The theme button's name and label in a language for a position.
 * @param {string} lang
 * @param {"auto" | "light" | "dark"} choice
 */
const themeWords = (lang, choice) => ({
  label: say(`theme_${choice}`, lang),
  name: `${say("theme_name", lang)}: ${say(`theme_${choice}`, lang)}`,
});

test(
  "LD-4 the theme button: one button, its text and name, click, Enter and Space, sai-theme one word, Auto follows the system and the others do not, a storage that throws, the avatars redrawn",
  {
    timeout: 240000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();

    /**
     * The state of the theme as the page shows it.
     * @param {import("playwright-core").Page} page
     */
    const theme = (page) =>
      page.evaluate(() => ({
        attr: document.documentElement.getAttribute("data-theme"),
        label: document.getElementById("theme-label")?.textContent ?? "",
        name:
          document.getElementById("theme")?.getAttribute("aria-label") ?? "",
        stored: localStorage.getItem("sai-theme"),
        buttons: document.querySelectorAll(".theme, #theme").length,
        same: /** @type {any} */ (window).__sameDocument === true,
      }));

    for (const lang of LOCAL_LANGS) {
      const env = await newPage(browser, t, { port, colorScheme: "light" });
      const { page } = env;
      await page.goto(`${origin}/?lang=${lang}`);
      await pageReady(page, "/", lang);
      await page.evaluate(() => {
        /** @type {any} */ (window).__sameDocument = true;
      });
      let now = await theme(page);
      assert.equal(now.buttons, 1, "one theme button");
      assert.equal(await page.locator("button#theme").count(), 1);
      assert.equal(now.attr, null, "Auto sets no attribute");
      assert.equal(now.label, themeWords(lang, "auto").label);
      assert.equal(now.name, themeWords(lang, "auto").name);
      await expectAvatars(page, "light", `${lang} at load`, TEAM);
      await readState(problems, `${lang} theme at load`, env, lang);
      // Click: Auto -> Light -> Dark -> Auto, each with its words, its attribute and its stored word.
      for (const [choice, drawn] of /** @type {const} */ ([
        ["light", "light"],
        ["dark", "dark"],
        ["auto", "light"],
      ])) {
        await page.click("#theme");
        now = await theme(page);
        assert.equal(now.attr, choice === "auto" ? null : choice);
        assert.equal(now.label, themeWords(lang, choice).label);
        assert.equal(now.name, themeWords(lang, choice).name);
        assert.equal(now.stored, choice);
        assert.match(now.stored ?? "", /^[a-z]{2,5}$/, "one word");
        assert.equal(now.same, true, "no reload");
        await expectAvatars(
          page,
          drawn,
          `${lang} after click to ${choice}`,
          TEAM,
        );
        await readState(problems, `${lang} theme ${choice}`, env, lang);
      }
    }

    // Enter and Space press the button too, and the choice goes on from where it is.
    {
      const env = await newPage(browser, t, { port, colorScheme: "light" });
      const { page } = env;
      await page.goto(`${origin}/`);
      await pageReady(page, "/", "ru");
      await page.focus("#theme");
      await page.keyboard.press("Enter");
      assert.equal((await theme(page)).attr, "light");
      await page.keyboard.press("Space");
      assert.equal((await theme(page)).attr, "dark");
      await expectAvatars(page, "dark", "by keyboard", TEAM);
      await page.keyboard.press("Enter");
      assert.equal((await theme(page)).attr, null);
      await page.keyboard.press("Space");
      assert.equal((await theme(page)).attr, "light");
      assert.equal((await theme(page)).stored, "light");
      await readState(problems, "theme by keyboard", env, "ru");
    }

    // Auto follows a change of the system setting with no reload; Light and Dark do not.
    {
      const env = await newPage(browser, t, { port, colorScheme: "light" });
      const { page } = env;
      await page.goto(`${origin}/`);
      await pageReady(page, "/", "ru");
      await page.evaluate(() => {
        /** @type {any} */ (window).__sameDocument = true;
      });
      await expectAvatars(page, "light", "auto, system light", TEAM);
      await page.emulateMedia({ colorScheme: "dark" });
      await expectAvatars(
        page,
        "dark",
        "auto follows the system to dark",
        TEAM,
      );
      assert.equal((await theme(page)).attr, null);
      assert.equal((await theme(page)).same, true, "no reload");
      await page.emulateMedia({ colorScheme: "light" });
      await expectAvatars(page, "light", "auto follows the system back", TEAM);
      await page.click("#theme"); // light
      await page.emulateMedia({ colorScheme: "dark" });
      await framesPass(page, 30);
      await expectAvatars(
        page,
        "light",
        "light stays light on a dark system",
        TEAM,
      );
      await page.click("#theme"); // dark
      await expectAvatars(page, "dark", "dark", TEAM);
      await page.emulateMedia({ colorScheme: "light" });
      await framesPass(page, 30);
      await expectAvatars(
        page,
        "dark",
        "dark stays dark on a light system",
        TEAM,
      );
      await readState(problems, "system follows", env, "ru");
    }

    // A storage that throws on read and on write: the theme is the system's, and both buttons work (E4).
    for (const system of /** @type {const} */ (["light", "dark"])) {
      const env = await newPage(browser, t, { port, colorScheme: system });
      await env.context.addInitScript(() => {
        const fail = () => {
          throw new Error("storage planted to fail");
        };
        Storage.prototype.getItem = fail;
        Storage.prototype.setItem = fail;
      });
      const { page } = env;
      await page.goto(`${origin}/`);
      await pageReady(page, "/", "ru");
      await expectAvatars(
        page,
        system,
        `a throwing storage, system ${system}`,
        TEAM,
      );
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
        null,
      );
      await page.click("#theme");
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
        "light",
        "the theme button works",
      );
      await expectAvatars(
        page,
        "light",
        "a throwing storage, after a click",
        TEAM,
      );
      await page.click('[data-lang="en"]');
      await pageReady(page, "/", "en");
      assert.equal(
        await page.evaluate(
          () => document.getElementById("theme-label")?.textContent,
        ),
        say("theme_light", "en"),
        "the language button works",
      );
      await readState(problems, `a throwing storage ${system}`, env, "en");
      const state = await env.context.storageState();
      assert.deepEqual(
        state.origins.flatMap((o) => o.localStorage),
        [],
        "nothing written",
      );
    }
    assert.deepEqual(problems.lines(), []);
  },
);

/**
 * The avatars of the page hold the chair colour of the theme drawn and not the other theme's (the read is exact,
 * design F42; M80). The page redraws them when the theme changes, by a click at once and by the system's change when
 * the browser's event comes, so the read is repeated, frame by frame, until it holds or its deadline (150 reads of two
 * frames) passes; a page that never redraws is red at the deadline. `desks` are the `data-avatar` values expected, in
 * the order of the page.
 * @param {import("playwright-core").Page} page
 * @param {"light" | "dark"} drawn
 * @param {string} where
 * @param {string[]} desks
 */
async function expectAvatars(page, drawn, where, desks) {
  const other = drawn === "light" ? "dark" : "light";
  const problem = async () => {
    const got = await avatarPixels(page);
    if (got.chair !== CHAIR[drawn])
      return `the token --sc-chair is ${got.chair}, not ${CHAIR[drawn]}`;
    if (got.avatars.map((a) => a.desk).join() !== desks.join())
      return `the avatars are for desks ${got.avatars.map((a) => a.desk).join()}, not ${desks.join()}`;
    for (const a of got.avatars) {
      if (!a.colours.includes(CHAIR[drawn]))
        return `avatar ${a.desk} does not hold ${CHAIR[drawn]}`;
      if (a.colours.includes(CHAIR[other]))
        return `avatar ${a.desk} still holds ${CHAIR[other]}`;
    }
    return null;
  };
  let found = await problem();
  for (let k = 0; found !== null && k < 150; k++) {
    await framesPass(page, 2);
    found = await problem();
  }
  assert.equal(found, null, `${where}: the avatars of the ${drawn} theme`);
}

/** The four avatars of the landing's team row. */
const TEAM = ["1", "2", "3", "4"];

/**
 * The speaker's avatar of question `question` (1-5) holds the chair of the theme drawn.
 * @param {import("playwright-core").Page} page
 * @param {"light" | "dark"} drawn
 * @param {number} question
 * @param {string} where
 */
function expectSpeaker(page, drawn, question, where) {
  return expectAvatars(page, drawn, where, [String(ASKING_DESK[question - 1])]);
}

test(
  "LD-5 the survey: the first question at load, five taps to the result, Back keeps the answer, Не знаю goes on, the whole survey by keyboard, the lint after each state, the focus above the live strip",
  {
    timeout: 600000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const ru = intakeIn("ru");
    const Q = ru.questions;
    const unsure = say("demo_unsure", "ru");

    // A. Five taps, nothing else, to the result; every question as it shows.
    {
      const env = await newPage(browser, t, { port });
      const { page } = env;
      await page.goto(`${origin}/demo.html`);
      await pageReady(page, "/demo.html", "ru");
      for (let i = 0; i < 5; i++) {
        const where = `question ${i + 1}`;
        await waitHeading(page, Q[i].title);
        assert.deepEqual(
          await page.$$eval("#demo .card .cl", (els) =>
            els.map((e) => e.textContent),
          ),
          [...Q[i].options.map((o) => o.label), unsure],
          `${where}: the options and «Не знаю»`,
        );
        assert.equal(
          norm((await page.locator("#demo .prog .pt").textContent()) ?? ""),
          filled(say("demo_question_of", "ru"), { i: i + 1, n: 5 }),
        );
        await expectSpeaker(page, "light", i + 1, where);
        await readState(problems, where, env, "ru");
        if (i === 0) {
          // A theme change on the demo redraws the speaker (decisions/0124 H2).
          await page.click("#theme");
          await page.click("#theme");
          await expectSpeaker(
            page,
            "dark",
            i + 1,
            `${where} after the theme change`,
          );
          await readState(problems, `${where} dark`, env, "ru");
          await page.click("#theme");
          await expectSpeaker(page, "light", i + 1, `${where} back to Auto`);
        }
        await page
          .locator("#demo .card")
          .nth(i % Q[i].options.length)
          .click();
        if (i < 4) await waitHeading(page, Q[i + 1].title);
        else await waitHeading(page, say("demo_result_title", "ru"));
      }
      await page.waitForSelector(
        "#demo .receipt .rc-kind, #demo .receipt .rc-nomatch",
      );
      problems.add("result", await shownTextFindings(page, "ru"));
      assert.equal(await page.locator("#demo .receipt").count(), 1);
      await readState(problems, "result", env, "ru", [], {
        result: await shownKind(page, "ru"),
      });
    }

    // B. «Назад» keeps the answer, a changed answer goes on, «Не знаю» goes on.
    {
      const env = await newPage(browser, t, { port });
      const { page } = env;
      await page.goto(`${origin}/demo.html`);
      await pageReady(page, "/demo.html", "ru");
      await waitHeading(page, Q[0].title);
      await tap(problems, "tap 1", env, "ru", 1, Q[1].title);
      await tap(problems, "tap 2", env, "ru", 1, Q[2].title);
      await page.locator("#demo .back").click();
      await waitHeading(page, Q[1].title);
      assert.equal(
        await page.locator("#demo .card").nth(1).getAttribute("aria-pressed"),
        "true",
        "back to question 2: its answer is kept",
      );
      assert.equal(
        await page.locator("#demo .card").nth(0).getAttribute("aria-pressed"),
        "false",
      );
      await readState(problems, "after Назад", env, "ru", [], { back: 2 });
      await page.locator("#demo .back").click();
      await waitHeading(page, Q[0].title);
      assert.equal(
        await page.locator("#demo .card").nth(1).getAttribute("aria-pressed"),
        "true",
        "back to question 1: its answer is kept",
      );
      await waitPlace(page, say("you_at_door", "ru"));
      await readState(problems, "after Назад to 1", env, "ru", [], { back: 1 });
      await tap(problems, "change 1", env, "ru", 0, Q[1].title);
      await tap(
        problems,
        "не знаю 2",
        env,
        "ru",
        Q[1].options.length,
        Q[2].title,
      );
      await readState(problems, "after Не знаю", env, "ru");
      await tap(problems, "tap 3", env, "ru", 0, Q[3].title);
      await tap(
        problems,
        "не знаю 4",
        env,
        "ru",
        Q[3].options.length,
        Q[4].title,
      );
      await tap(
        problems,
        "не знаю 5",
        env,
        "ru",
        Q[4].options.length,
        say("demo_result_title", "ru"),
      );
      await page.waitForSelector(
        "#demo .receipt .rc-kind, #demo .receipt .rc-nomatch",
      );
      await readState(problems, "result after Не знаю", env, "ru", [], {
        result: await shownKind(page, "ru"),
      });
    }

    // C. The whole survey by the keyboard alone (no mouse): Tab to a card, Enter or Space, five times, then the result.
    {
      const env = await newPage(browser, t, { port });
      const { page } = env;
      await page.goto(`${origin}/demo.html`);
      await pageReady(page, "/demo.html", "ru");
      for (let i = 0; i < 5; i++) {
        await waitHeading(page, Q[i].title);
        let guard = 0;
        while (
          !(await page.evaluate(
            () => document.activeElement?.classList.contains("card") ?? false,
          ))
        ) {
          assert.ok(
            (guard += 1) < 12,
            `question ${i + 1}: no card reached by Tab`,
          );
          await page.keyboard.press("Tab");
        }
        await page.keyboard.press(i % 2 === 0 ? "Enter" : "Space");
        await waitHeading(
          page,
          i < 4 ? Q[i + 1].title : say("demo_result_title", "ru"),
        );
        problems.add(`keyboard ${i + 1}`, await shownTextFindings(page, "ru"));
      }
      await page.waitForSelector(
        "#demo .receipt .rc-kind, #demo .receipt .rc-nomatch",
      );
      await readState(problems, "keyboard result", env, "ru", [], {
        result: await shownKind(page, "ru"),
      });
    }

    // D. A phone, in English: the same survey at 390 x 844 with the answers strip and the sheet.
    {
      const en = intakeIn("en");
      const env = await newPage(browser, t, {
        port,
        viewport: { width: 390, height: 844 },
        colorScheme: "dark",
      });
      const { page } = env;
      await page.goto(`${origin}/demo.html?lang=en`);
      await pageReady(page, "/demo.html", "en");
      for (let i = 0; i < 5; i++) {
        await waitHeading(page, en.questions[i].title);
        await expectSpeaker(page, "dark", i + 1, `phone question ${i + 1}`);
        problems.add(`phone ${i + 1}`, await shownTextFindings(page, "en"));
        await page.locator("#demo .card").nth(0).click();
        await (i < 4
          ? waitHeading(page, en.questions[i + 1].title)
          : waitHeading(page, say("demo_result_title", "en")));
      }
      await readState(problems, "phone result", env, "en", [], {
        result: await shownKind(page, "en"),
      });
    }

    // E. The focus above the live strip (the scroll padding of site.css, round 02c): on the two phone windows, in
    // each language, at each of the five questions, Tab through every control from the start of the page; a
    // focused control that is not the strip's own may not lie over the strip.
    for (const win of WINDOWS.filter((w) => w.width < 760))
      for (const lang of LOCAL_LANGS) {
        const env = await newPage(browser, t, {
          port,
          viewport: { width: win.width, height: win.height },
        });
        const { page } = env;
        const questions = intakeIn(lang).questions;
        await page.goto(`${origin}/demo.html?lang=${lang}`);
        await pageReady(page, "/demo.html", lang);
        for (let i = 0; i < 5; i++) {
          await waitHeading(page, questions[i].title);
          problems.add(
            `focus ${win.name} ${lang} question ${i + 1}`,
            await focusWalkFindings(page),
          );
          if (i < 4) await answerAndWait(page, 0, questions[i + 1].title);
        }
      }

    // F. The speaker in Russian at 320, 360, 371, 372, 375, 379, 380, 389, 390 and 420 px, at each of the five
    // questions (decisions/0124 О45): the speaker takes a row of its own above the question only where its title does
    // not fit beside «‹ Назад» in the visitor's font, so no window width is a threshold and the row it takes is NOT
    // asserted here — the widths 380 and 389 px in particular, where the Mac and the Linux runner choose differently.
    // What holds at every window and every font (`speakerRow` of the kit): every line of the speaker ends within its
    // column (0.5 px); the title is 4 px or more from «‹ Назад» where they share a row; the speaker, the question,
    // the progress and «‹ Назад» overlap in no two boxes; the speaker is beside «‹ Назад» or on a row of its own above
    // the question; the class own stands on the head exactly when the speaker is not on the row of «‹ Назад»; no
    // sideways scroll. The choice itself is pinned by G (a wider title moves to its own row) and H (a resize).
    for (const width of [320, 360, 371, 372, 375, 379, 380, 389, 390, 420]) {
      const env = await newPage(browser, t, {
        port,
        viewport: { width, height: 640 },
      });
      const { page } = env;
      await page.goto(`${origin}/demo.html?lang=ru`);
      await pageReady(page, "/demo.html", "ru");
      for (let i = 0; i < 5; i++) {
        await waitHeading(page, Q[i].title);
        await framesPass(page, 2);
        problems.add(
          `speaker ${width} question ${i + 1}`,
          (await speakerRow(page)).lines,
        );
        if (i < 4) await answerAndWait(page, 0, Q[i + 1].title);
      }
    }

    // G. The content rule (decisions/0124 О45), font-proof: at 420 px every title of the five questions fits beside
    // «‹ Назад» (the plain state, read first). Then a line of the speaker, the title and after it the stage line, is
    // made wider on the test page alone (a letter spacing from a sheet that the kit makes in the page, never in the
    // project) and the window is made 1 px wider, which is a resize. A line whose longest word ends 6 px beyond the
    // column it had beside «‹ Назад» must take the speaker to its own row (the invariants of F hold there: the row of
    // its own is wider); a line whose longest word ends 3 px before that edge keeps the speaker beside «‹ Назад»
    // (and still 4 px from it). With the stress taken away and the window back at 420 px the speaker is beside
    // «‹ Назад» again and the class own is gone.
    {
      const env = await newPage(browser, t, {
        port,
        viewport: { width: 420, height: 640 },
      });
      const { page } = env;
      await page.goto(`${origin}/demo.html?lang=ru`);
      await pageReady(page, "/demo.html", "ru");
      for (let i = 0; i < 5; i++) {
        await waitHeading(page, Q[i].title);
        await framesPass(page, 2);
        const plain = await speakerRow(page);
        problems.add(`title stress question ${i + 1} plain`, plain.lines);
        if (!plain.beside)
          problems.add(`title stress question ${i + 1}`, [
            "the title does not fit beside «Назад» at 420 px, so the stress has nothing to move",
          ]);
        for (const tag of /** @type {const} */ (["b", "span"]))
          for (const over of [6, -3]) {
            const where = `${tag === "b" ? "title" : "stage line"} stress ${over} question ${i + 1}`;
            const stress = await stressSpeakerLine(page, tag, over);
            if (Math.abs(stress.error) > 1)
              problems.add(where, [
                `the stress missed its mark by ${stress.error.toFixed(1)} px (the test page, not the project)`,
              ]);
            await page.setViewportSize({ width: 421, height: 640 });
            await framesPass(page, 2);
            const got = await speakerRow(page);
            problems.add(where, got.lines);
            if (over > 0 && got.beside)
              problems.add(where, [
                "a line that ends beyond its column stays beside «Назад» (the speaker must take its own row)",
              ]);
            if (over < 0 && !got.beside)
              problems.add(where, [
                "a line that fits its column goes to its own row (the speaker must stay beside «Назад»)",
              ]);
            await clearSpeakerStress(page);
            await page.setViewportSize({ width: 420, height: 640 });
            await framesPass(page, 2);
            const back = await speakerRow(page);
            problems.add(`${where} taken away`, back.lines);
            if (!back.beside)
              problems.add(`${where} taken away`, [
                "with the stress taken away and the window resized the speaker stays on its own row",
              ]);
          }
        if (i < 4) await answerAndWait(page, 0, Q[i + 1].title);
      }
    }

    // H. A resize in place re-measures (decisions/0124 О45): on the open question, with no reload and no new question,
    // the window goes 420, 340, 320, 360 and back to 420 px. At 420 the title fits beside «‹ Назад» and at 320 it
    // cannot (every question is on its own row there on the Mac, and the Linux runner's font is
    // wider, so it holds there too); the widths between are read for the invariants of F, not for the row. The class
    // own that the narrow window set is gone at 420 px again.
    {
      const env = await newPage(browser, t, {
        port,
        viewport: { width: 420, height: 640 },
      });
      const { page } = env;
      await page.goto(`${origin}/demo.html?lang=ru`);
      await pageReady(page, "/demo.html", "ru");
      for (let i = 0; i < 5; i++) {
        await waitHeading(page, Q[i].title);
        for (const width of [420, 340, 320, 360, 420]) {
          const where = `resize question ${i + 1} to ${width}`;
          await page.setViewportSize({ width, height: 640 });
          await framesPass(page, 2);
          const got = await speakerRow(page);
          problems.add(where, got.lines);
          if (width === 420 && !got.beside)
            problems.add(where, [
              "the speaker is not beside «Назад» at 420 px after a resize",
            ]);
          if (width === 320 && got.beside)
            problems.add(where, [
              "the speaker is beside «Назад» at 320 px after a resize",
            ]);
        }
        if (i < 4) await answerAndWait(page, 0, Q[i + 1].title);
      }
    }
    assert.deepEqual(problems.lines(), []);
  },
);

/**
 * Reads the result of the demo on the screen: the heading, the receipt, the lists of the result by their heading,
 * the idea panel's link and the chips, and (REQ-113) the status block, the panel's children and the count of the
 * grey line, the accuracy row (label, the class of each pip, the count text, the sentence and whether it follows
 * the pips), the whole text of the demo, the place of the block against the panel and the lists, and the first
 * link after the block.
 * @param {import("playwright-core").Page} page
 */
async function readResult(page) {
  const read = await page.evaluate(() => {
    const text = (/** @type {Element | null} */ e) =>
      (e?.textContent ?? "").replace(/\s+/g, " ").trim();
    const lists = [...document.querySelectorAll("#demo .r-lines section")].map(
      (s) => ({
        title: text(s.querySelector("h3")),
        items: [...s.querySelectorAll("li")].map(text),
      }),
    );
    const link = document.querySelector("#demo .idea a");
    const idea = document.querySelector("#demo .idea");
    const block = document.querySelector("#demo section.info.now");
    const prog = document.querySelector("#demo .rc-acc .prog");
    const sentence = document.querySelector("#demo .rc-acc > p");
    const first =
      block === null
        ? null
        : ([...document.querySelectorAll("#demo a")].find(
            (a) =>
              !block.contains(a) &&
              (block.compareDocumentPosition(a) &
                Node.DOCUMENT_POSITION_FOLLOWING) !==
                0,
          ) ?? null);
    return {
      ideaKids:
        idea === null
          ? []
          : [...idea.children].map((e) => [e.tagName.toLowerCase(), text(e)]),
      fineCount: document.querySelectorAll("#demo .fine").length,
      accLabel: text(document.querySelector("#demo .rc-acc .lbl")),
      accPips: [...document.querySelectorAll("#demo .rc-acc .pp i")].map(
        (i) => i.className,
      ),
      accPt: text(document.querySelector("#demo .rc-acc .pt")),
      accNote: {
        count: document.querySelectorAll("#demo .rc-acc > p").length,
        text: text(sentence),
        afterProg: prog !== null && prog.nextElementSibling === sentence,
      },
      resultText: document.getElementById("demo")?.innerText ?? "",
      blockBeforeIdea:
        block !== null &&
        idea !== null &&
        (block.compareDocumentPosition(idea) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0,
      blockInLists: block !== null && block.closest(".r-lines") !== null,
      linkAfterBlock:
        first === null
          ? null
          : {
              text: text(first),
              href: first.getAttribute("href"),
              isIdeaLink: first === link,
            },
      heading: text(document.querySelector("#demo .r-sum h2")),
      kind: text(document.querySelector("#demo .rc-kind")),
      summary: text(document.querySelector("#demo .rc-text")),
      also: text(document.querySelector("#demo .rc-also")),
      noMatch: text(document.querySelector("#demo .rc-nomatch")),
      receiptBody: text(document.querySelector("#demo .rc-body")),
      fitsLabel: text(document.querySelector("#demo .rc-fit .lbl")),
      accuracy: document.querySelectorAll("#demo .rc-acc").length,
      lists,
      listAfterReceipt:
        document.querySelector("#demo .r-sum + .r-lines") !== null,
      idea: {
        text: text(link),
        href: link?.getAttribute("href") ?? null,
      },
      chips: [...document.querySelectorAll("#demo .chips .chip b")].map(text),
      chipTitles: [...document.querySelectorAll("#demo .chips .chip")].map(
        (c) => c.getAttribute("title"),
      ),
    };
  });
  return { ...read, now: await readBlock(page, "#demo") };
}

test(
  "LD-6 every fixture and five Не знаю in each language: the solution and its not_suitable_when or the no-match text, the heading and the ten items, «Описать идею»",
  {
    timeout: 480000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const fixtures = answerFixtures();
    assert.ok(fixtures.length >= 7, "the fixtures of the intake");
    for (const lang of LOCAL_LANGS) {
      const intake = intakeIn(lang);
      const env = await newPage(browser, t, {
        port,
        reducedMotion: "reduce",
      });
      const { page } = env;
      // The pass of REQ-113 criterion 5: the answers of the fixture landing, the question storage left to «Не знаю».
      // If the engine's data change so that these answers name no solution, the pass fails here and is replaced by
      // another that does, never dropped.
      const landing = fixtures.find((f) => f.name === "landing");
      assert.ok(
        landing !== undefined && "storage" in landing.answers,
        "the fixture landing answers the question storage",
      );
      const passes = [
        ...fixtures.map((f) => ({
          name: f.name,
          answers: /** @type {Record<string, string> | null} */ (f.answers),
          cells: f.name === "landing",
          mustRecommend: false,
        })),
        {
          name: "landing with Не знаю on storage",
          answers: /** @type {Record<string, string> | null} */ (
            Object.fromEntries(
              Object.entries(landing.answers).filter(
                ([id]) => id !== "storage",
              ),
            )
          ),
          cells: false,
          mustRecommend: true,
        },
        {
          name: "five Не знаю",
          answers: null,
          cells: true,
          mustRecommend: false,
        },
      ];
      for (const [number, pass] of passes.entries()) {
        const where = `${lang} ${pass.name}`;
        await page.goto(`${origin}/demo.html?lang=${lang}`);
        await pageReady(page, "/demo.html", lang);
        const chosen = /** @type {Record<string, string>} */ ({});
        /** The answer each question was given, as the result's chip names it. */
        const picked = /** @type {string[]} */ ([]);
        for (const [i, q] of intake.questions.entries()) {
          await waitHeading(page, q.title);
          const labels = await page.$$eval("#demo .card .cl", (els) =>
            els.map((e) => e.textContent),
          );
          assert.deepEqual(
            labels,
            [...q.options.map((o) => o.label), say("demo_unsure", lang)],
            `${where} q${i + 1}`,
          );
          problems.add(
            `${where} q${i + 1}`,
            await shownTextFindings(page, lang),
          );
          assert.equal(
            await page.locator("#demo .now").count(),
            0,
            i === intake.questions.length - 1
              ? `${where}: no status block on the last question`
              : `${where} q${i + 1}: no status block on a question screen`,
          );
          let index = q.options.length;
          if (pass.answers !== null && pass.answers[q.id] !== undefined) {
            index = q.options.findIndex((o) => o.id === pass.answers?.[q.id]);
            assert.ok(index >= 0, `${where}: the fixture answers ${q.id}`);
            chosen[q.id] = q.options[index].id;
          }
          picked.push(
            index < q.options.length
              ? q.options[index].label
              : say("demo_not_sure", lang),
          );
          await page.locator("#demo .card").nth(index).click();
        }
        await waitHeading(page, say("demo_result_title", lang));
        await page.waitForFunction(
          () =>
            document.querySelector("#demo .rc-kind, #demo .rc-nomatch") !==
            null,
          null,
          { timeout: 15000 },
        );
        // What the server answers for these answers is what the page must show; the file of the intake holds the
        // texts of the solution it names.
        const answer = await (
          await fetch(`${origin}/api/demo/result?lang=${lang}`, {
            method: "POST",
            body: JSON.stringify({ answers: chosen }),
          })
        ).json();
        const got = await readResult(page);
        assert.equal(got.heading, say("demo_result_title", lang), where);
        const fixed = got.lists.at(-1);
        assert.deepEqual(
          fixed,
          {
            title: say("nobuild_title", lang),
            items: Array.from({ length: 10 }, (_v, k) =>
              say(`nobuild_${k + 1}`, lang),
            ),
          },
          `${where}: the heading and the ten items of the list`,
        );
        assert.equal(got.idea.text, say("describe_idea", lang), where);
        assert.equal(got.idea.href, "/how.html#describe-idea", where);
        const recommended = answer.recommended.length > 0;
        if (pass.mustRecommend)
          assert.ok(
            recommended,
            `${where}: the pass has a recommended solution`,
          );
        /** @param {string} key */
        const words = (key) => say(key, lang);
        checkStatus(got, lang, words, where, recommended);
        // The count of the receipt: a given answer is one, «Не знаю» is half; the pips show the whole answers full
        // and the skipped one as a half pip, and the text says the whole number (REQ-113 criterion 5).
        const n = intake.questions.length;
        const known = intake.questions.filter(
          (q) => pass.answers?.[q.id] !== undefined,
        ).length;
        const count = known + (n - known) / 2;
        if (recommended) {
          assert.deepEqual(
            got.accPips,
            Array.from({ length: n }, (_v, k) =>
              count >= k + 1 ? "on" : count > k ? "half" : "",
            ),
            known === n
              ? `${where}: five whole answers fill five pips`
              : `${where}: the pips of a skipped answer`,
          );
          assert.equal(
            got.accPt,
            filled(say("demo_k_of_n", lang), { k: Math.floor(count), n }),
            `${where}: the count text`,
          );
        }
        assert.equal(
          got.chips.length,
          5,
          `${where}: five answers kept as chips`,
        );
        // Each chip is named by its question and its answer (decisions/0124 О33): five answers «Не знаю» are five
        // chips of one visible text, and the question is what tells them apart. The name is the browser's own
        // computed one (the role query), not the attribute.
        assert.deepEqual(got.chips, picked, `${where}: the text of the chips`);
        // The chip keeps only its aria-label: no title attribute that repeats the question (decisions/0124 О37,
        // TEST-DESIGN-VALIDATOR T11), so a screen reader does not say the name twice. Read on each chip.
        assert.equal(got.chipTitles.length, 5, `${where}: five chips read`);
        for (const [k, title] of got.chipTitles.entries())
          assert.equal(
            title,
            null,
            `${where}: the chip of question ${k + 1} has no title attribute`,
          );
        for (const [k, q] of intake.questions.entries()) {
          const name = `${q.title}: ${picked[k]}`;
          assert.equal(
            await page.getByRole("button", { name, exact: true }).count(),
            1,
            `${where}: the chip of question ${k + 1} is named «${name}»`,
          );
        }
        if (answer.recommended.length > 0) {
          const first = answer.recommended[0];
          const mine = intake.solutions.find((s) => s.name === first.name);
          assert.ok(
            mine,
            `${where}: ${first.name} is a solution of the intake`,
          );
          assert.equal(got.kind, first.name, where);
          assert.equal(got.summary, norm(first.summary), where);
          assert.equal(got.noMatch, "", `${where}: no no-match text`);
          const notFit = got.lists.find(
            (l) => l.title === say("demo_not_fit", lang),
          );
          assert.deepEqual(
            notFit?.items,
            mine.notFit,
            `${where}: not_suitable_when`,
          );
          assert.deepEqual(first.not_suitable_when, mine.notFit, where);
          const includes = got.lists.find(
            (l) => l.title === say("demo_includes", lang),
          );
          assert.deepEqual(
            includes?.items,
            mine.includes,
            `${where}: includes`,
          );
          assert.equal(got.lists.length, 3, where);
          assert.equal(got.fitsLabel, say("demo_fits", lang), where);
          assert.equal(got.accuracy, 1, where);
          if (answer.clear_leader === false && answer.recommended.length > 1)
            assert.equal(
              got.also,
              filled(say("demo_also_fits", lang), {
                names: answer.recommended
                  .slice(1)
                  .map((/** @type {{ name: string }} */ s) => s.name)
                  .join(", "),
              }),
              where,
            );
        } else {
          assert.equal(answer.no_match_text, intake.noMatch, where);
          assert.equal(
            got.noMatch,
            norm(intake.noMatch),
            `${where}: the no-match text`,
          );
          assert.equal(
            got.receiptBody,
            norm(intake.noMatch),
            `${where}: the receipt holds only the no-match text (Q4)`,
          );
          assert.equal(got.kind, "", `${where}: no solution named`);
          assert.equal(got.fitsLabel, "", `${where}: no «fits» label (Q4)`);
          assert.equal(got.accuracy, 0, `${where}: no accuracy row (Q4)`);
          assert.equal(got.lists.length, 1, `${where}: only the fixed list`);
          assert.equal(
            got.listAfterReceipt,
            true,
            `${where}: the list right under the receipt`,
          );
        }
        // The live line says the result of the solution the server named (the no-match text when none): written
        // 30 ms after the receipt, so the read waits for it and the lint of the shown text sees it.
        await readState(problems, `${where} result`, env, lang, [], {
          result: answer.recommended[0]?.name ?? intake.noMatch,
        });
        // REQ-113 criterion 10: the result in each window of the cells and in both colour schemes, on this page (the
        // window and the scheme are set, two frames pass, then the page is read): no layout finding, the block above
        // the panel, the parts in the order of the look 8.4, the mark of each row on its side of the title.
        if (pass.cells) {
          for (const win of CELL_WINDOWS)
            for (const scheme of /** @type {const} */ (["light", "dark"])) {
              const cell = `${where} ${win.name} ${scheme}`;
              await page.setViewportSize({
                width: win.width,
                height: win.height,
              });
              await page.emulateMedia({ colorScheme: scheme });
              await framesPass(page, 2);
              problems.add(`status block ${cell}`, await layoutFindings(page));
              const { sum, side, now, idea, answers, lists } =
                await readParts(page);
              assert.ok(
                sum !== null &&
                  side !== null &&
                  now !== null &&
                  idea !== null &&
                  answers !== null &&
                  lists !== null,
                `${cell}: the parts of the result are there`,
              );
              if (now.bottom > idea.top)
                problems.add(cell, [
                  "result: the status block stands above Описать идею",
                ]);
              const tops = (/** @type {Array<{ top: number }>} */ list) =>
                list.every((p, k) => k === 0 || list[k - 1].top < p.top);
              assert.ok(
                win.width >= 1000
                  ? side.left >= sum.right - 0.5 &&
                      Math.abs(side.top - sum.top) <= 0.5
                  : tops(
                      recommended
                        ? [sum, side, answers, lists]
                        : [sum, lists, side, answers],
                    ),
                `${cell}: the parts of the result stand in the order of 8.4`,
              );
              checkRowSides(await readBlock(page, "#demo"), win.width, cell);
            }
          await page.setViewportSize({ width: 1280, height: 800 });
          await page.emulateMedia({ colorScheme: "light" });
        }
        // REQ-113 criterion 7: a language chosen on a result shows the lead, the label, the sentence, the count text and
        // the block in that language, and the pips and the answers stay (decisions/0124 О17 for the survey).
        if (number === 1 && recommended) {
          const other = lang === "en" ? "ru" : "en";
          /** @param {string} key */
          const there = (key) => say(key, other);
          const after = `${where}: after a switch to ${other} the`;
          await page.click(`[data-lang="${other}"]`);
          await waitHeading(page, say("demo_result_title", other));
          await shownKind(page, other);
          const again = await readResult(page);
          checkBlock(again.now, there, `${where} after a switch to ${other}`);
          assert.deepEqual(
            again.ideaKids[1],
            ["p", norm(there("idea_panel_lead"))],
            `${after} lead is in ${other}`,
          );
          assert.equal(
            again.accLabel,
            norm(there("demo_accuracy")),
            `${after} label is in ${other}`,
          );
          assert.equal(
            again.accNote.text,
            norm(there("demo_accuracy_note")),
            `${after} sentence is in ${other}`,
          );
          assert.equal(
            again.accPt,
            filled(there("demo_k_of_n"), {
              k: Math.floor(count),
              n,
            }),
            `${after} count text is in ${other}`,
          );
          assert.deepEqual(
            again.accPips,
            got.accPips,
            `${after} pips are as they were`,
          );
          assert.deepEqual(again.chips.length, 5, `${after} answers are kept`);
          await readState(
            problems,
            `${where} switched to ${other}`,
            env,
            other,
          );
        }
        // «Описать идею» opens the part of how.html and asks for nothing but the files of the page.
        if (number === 0) {
          const seen = /** @type {string[]} */ ([]);
          /** @param {import("playwright-core").Request} r */
          const watch = (r) =>
            seen.push(`${r.method()} ${new URL(r.url()).pathname}`);
          page.on("request", watch);
          // A visitor who chose the language by its button has it stored; a link carries no ?lang=.
          await page.evaluate(
            (/** @type {string} */ l) => localStorage.setItem("sai-lang", l),
            lang,
          );
          await page.locator("#demo .idea a").click();
          await page.waitForURL(`${origin}/how.html#describe-idea`);
          await pageReady(page, "/how.html", lang);
          const place = await page.evaluate(() => {
            const r = document
              .getElementById("describe-idea")
              ?.getBoundingClientRect();
            return r === undefined
              ? null
              : { top: r.top, bottom: r.bottom, h: window.innerHeight };
          });
          assert.ok(
            place !== null && place.bottom > 0 && place.top < place.h,
            `${where}: the part is on the screen`,
          );
          const files = publicFiles();
          assert.deepEqual(
            seen.filter(
              (s) => !(s.startsWith("GET ") && files.has(s.slice(4))),
            ),
            [],
            `${where}: no request beyond the files of the page`,
          );
          problems.add(`${where} how`, await shownTextFindings(page, lang));
          page.off("request", watch);
          clearReports(env);
        }
      }
    }
    // REQ-113 design 5, rows 4 to 6: the block in the states of the demo's requests (ru, a fresh page each). A
    // result request that is held, that fails with 500 or is refused leaves the block and the panel as they stood,
    // and «Повторить» fills the receipt without building the block again; a questionnaire that fails shows no block.
    const ru = intakeIn("ru");
    const ANSWERS = [0, 1, 0, 1, 0];
    const wordsRu = (/** @type {string} */ key) => say(key, "ru");
    const resultTitle = say("demo_result_title", "ru");
    const messageIs = (/** @type {string} */ key) => [
      (/** @type {string} */ want) =>
        document.querySelector("#demo .msg .msg-title")?.textContent === want,
      say(key, "ru"),
      { timeout: 20000 },
    ];
    const pattern = "**/api/demo/result*";
    {
      const env = await newPage(browser, t, { port, reducedMotion: "reduce" });
      const { page } = env;
      /** @type {() => void} */
      let release = () => {};
      const gate = new Promise((resolve) => {
        release = () => resolve(null);
      });
      await env.context.route(pattern, async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto(`${origin}/demo.html?lang=ru`);
      await pageReady(page, "/demo.html", "ru");
      for (const [i, q] of ru.questions.entries()) {
        await waitHeading(page, q.title);
        await page.locator("#demo .card").nth(ANSWERS[i]).click();
      }
      await waitHeading(page, resultTitle);
      await page.waitForFunction(...messageIs("demo_putting"));
      const held = await readBlock(page, "#demo");
      assert.equal(
        held.count,
        1,
        "result held: the status block stands while the receipt waits",
      );
      checkBlock(held, wordsRu, "result held");
      release();
      await page.waitForFunction(
        () =>
          document.querySelector("#demo .rc-kind, #demo .rc-nomatch") !== null,
        null,
        { timeout: 15000 },
      );
      checkBlock(await readBlock(page, "#demo"), wordsRu, "result released");
      await readState(problems, "result held then released", env, "ru", [], {
        result: await shownKind(page, "ru"),
      });
    }
    for (const failure of [FAILURES[0], FAILURES[3]]) {
      const where = `result ${failure.name}`;
      const env = await newPage(browser, t, { port, reducedMotion: "reduce" });
      const { page } = env;
      /** @type {(r: import("playwright-core").Route) => unknown} */
      const handler = (r) => failure.fail(r);
      await page.goto(`${origin}/demo.html?lang=ru`);
      await pageReady(page, "/demo.html", "ru");
      for (const [i, q] of ru.questions.entries()) {
        if (i === 4) await env.context.route(pattern, handler);
        await waitHeading(page, q.title);
        await page.locator("#demo .card").nth(ANSWERS[i]).click();
      }
      await waitHeading(page, resultTitle);
      await page.waitForFunction(...messageIs(failure.message));
      const failed = await readResult(page);
      assert.equal(failed.now.count, 1, `${where}: the status block stays`);
      checkBlock(failed.now, wordsRu, where);
      assert.deepEqual(
        failed.ideaKids,
        [
          ["h3", norm(wordsRu("idea_panel_title"))],
          ["p", norm(wordsRu("idea_panel_lead"))],
          ["a", norm(wordsRu("describe_idea"))],
        ],
        `${where}: the panel stays`,
      );
      const labels = ANSWERS.map((a, i) => ru.questions[i].options[a].label);
      assert.deepEqual(failed.chips, labels, `${where}: the answers are kept`);
      problems.add(where, reportedProblems(env, [failure.line(origin)]));
      clearReports(env);
      // «Повторить» asks again and fills the receipt; the block is the one that stood, not a new one.
      await page.evaluate(() => {
        /** @type {any} */ (
          document.querySelector("#demo section.info.now")
        ).__kept = true;
      });
      await env.context.unroute(pattern, handler);
      await page.locator("#demo .msg button").click();
      await page.waitForFunction(
        () =>
          document.querySelector("#demo .rc-kind, #demo .rc-nomatch") !== null,
        null,
        { timeout: 15000 },
      );
      assert.equal(
        await page.evaluate(
          () =>
            /** @type {any} */ (
              document.querySelector("#demo section.info.now")
            )?.__kept === true,
        ),
        true,
        `${where}: the status block stays`,
      );
      checkBlock(await readBlock(page, "#demo"), wordsRu, `${where} retried`);
      await readState(problems, `${where} after Повторить`, env, "ru", [], {
        result: await shownKind(page, "ru"),
      });
    }
    {
      const env = await newPage(browser, t, { port, reducedMotion: "reduce" });
      const { page } = env;
      await env.context.route("**/api/demo/questionnaire*", (r) =>
        FAILURES[0].fail(r),
      );
      await page.goto(`${origin}/demo.html?lang=ru`);
      await pageReady(page, "/demo.html", "ru", { survey: false });
      await page.waitForFunction(...messageIs("demo_failed"));
      assert.equal(
        (await page.locator("#demo .now").count()) +
          (await page.locator("#demo .r-side").count()),
        0,
        "questionnaire failed: no status block",
      );
      problems.add(
        "questionnaire failed",
        reportedProblems(env, [FAILURES[0].line(origin)]),
      );
      clearReports(env);
    }
    assert.deepEqual(problems.lines(), []);
  },
);

/** The failing answers of the demo routes (design 5, E1-E3) and what the page shows and the console holds. */
const FAILURES = [
  {
    name: "500",
    fail: /** @param {import("playwright-core").Route} r */ (r) =>
      r.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"error":"x"}',
      }),
    message: "demo_failed",
    line: (/** @type {string} */ _u) =>
      "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
  },
  {
    name: "a body that is not JSON",
    fail: /** @param {import("playwright-core").Route} r */ (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html>no</html>",
      }),
    message: "demo_failed",
    line: null,
  },
  {
    name: "refused (403)",
    fail: /** @param {import("playwright-core").Route} r */ (r) =>
      r.fulfill({ status: 403, contentType: "application/json", body: "{}" }),
    message: "demo_failed",
    line: (/** @type {string} */ _u) =>
      "Failed to load resource: the server responded with a status of 403 (Forbidden)",
  },
  {
    name: "refused connection",
    fail: /** @param {import("playwright-core").Route} r */ (r) =>
      r.abort("connectionrefused"),
    message: "demo_offline",
    line: (/** @type {string} */ _u) =>
      "Failed to load resource: net::ERR_CONNECTION_REFUSED",
  },
  {
    name: "no connection (aborted at once)",
    fail: /** @param {import("playwright-core").Route} r */ (r) =>
      r.abort("internetdisconnected"),
    message: "demo_offline",
    line: (/** @type {string} */ _u) =>
      "Failed to load resource: net::ERR_INTERNET_DISCONNECTED",
  },
  {
    name: "never answering (held until the page's time limit)",
    fail: /** @param {import("playwright-core").Route} _r */ (_r) =>
      new Promise(() => {}),
    message: "demo_offline",
    line: null,
  },
];

test(
  "LD-7 the demo's failures in Russian: 500, a body that is not JSON, never answering, no connection, refused — a plain message with «Повторить», the answers kept, a clean console",
  {
    timeout: 420000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const ru = intakeIn("ru");
    const Q = ru.questions;
    const ANSWERS = [0, 1, 0, 1, 0];
    const body = Object.fromEntries(
      Q.map((q, i) => [q.id, q.options[ANSWERS[i]].id]),
    );
    for (const route of /** @type {const} */ (["questionnaire", "result"])) {
      for (const failure of FAILURES) {
        const where = `${route}: ${failure.name}`;
        const env = await newPage(browser, t, {
          port,
          reducedMotion: "reduce",
        });
        const { page } = env;
        /** @type {Array<{ method: string, path: string, body: unknown }>} */
        const asked = [];
        page.on("request", (r) => {
          const p = new URL(r.url()).pathname;
          if (p.startsWith("/api/"))
            asked.push({
              method: r.method(),
              path: p,
              body: r.method() === "POST" ? r.postDataJSON() : null,
            });
        });
        const pattern = `**/api/demo/${route}*`;
        /** @type {(r: import("playwright-core").Route) => unknown} */
        const handler = (r) => failure.fail(r);
        if (route === "questionnaire")
          await env.context.route(pattern, handler);
        await page.goto(`${origin}/demo.html`);
        await pageReady(page, "/demo.html", "ru", {
          survey: route === "result",
        });
        /** @param {string} key */
        const expectMessage = async (key) => {
          await page.waitForFunction(
            (/** @type {string} */ want) =>
              document.querySelector("#demo .msg .msg-title")?.textContent ===
              want,
            say(key, "ru"),
            { timeout: 20000 },
          );
        };
        if (route === "questionnaire") {
          if (failure.name.startsWith("never")) {
            await expectMessage("demo_loading");
            problems.add(
              `${where} loading`,
              await shownTextFindings(page, "ru"),
            );
          }
          await expectMessage(failure.message);
          // The scene stays in its load state.
          assert.equal(
            await placeLine(page),
            say("you_at_door", "ru"),
            `${where}: the scene stays`,
          );
        } else {
          await waitHeading(page, Q[0].title);
          for (let i = 0; i < 5; i++) {
            if (i === 4) await env.context.route(pattern, handler);
            await page.locator("#demo .card").nth(ANSWERS[i]).click();
            await (i < 4
              ? waitHeading(page, Q[i + 1].title)
              : waitHeading(page, say("demo_result_title", "ru")));
          }
          if (failure.name.startsWith("never")) {
            await expectMessage("demo_putting");
            problems.add(
              `${where} putting`,
              await shownTextFindings(page, "ru"),
            );
          }
          await expectMessage(failure.message);
          assert.equal(
            await placeLine(page),
            atDesk(4, "ru"),
            `${where}: the scene stays in the result state`,
          );
          assert.deepEqual(
            await page.$$eval("#demo .chips .chip b", (els) =>
              els.map((e) => e.textContent),
            ),
            ANSWERS.map((a, i) => Q[i].options[a].label),
            `${where}: the answers are kept`,
          );
        }
        const shown = await page.evaluate(() => ({
          label: document.querySelector("#demo .msg .lbl")?.textContent,
          text: document.querySelector("#demo .msg .msg-text")?.textContent,
          buttons: [...document.querySelectorAll("#demo .msg button")].map(
            (b) => b.textContent,
          ),
          links: [...document.querySelectorAll("#demo .msg a")].map((a) => [
            a.textContent,
            a.getAttribute("href"),
          ]),
        }));
        assert.deepEqual(
          shown,
          {
            label: say("demo_error", "ru"),
            text: say("demo_what_now", "ru"),
            buttons: [say("demo_retry", "ru")],
            links: [[say("to_landing", "ru"), "/"]],
          },
          where,
        );
        problems.add(`${where} message`, await shownTextFindings(page, "ru"));
        problems.add(`${where} layout`, await layoutFindings(page));
        // The console holds only the browser's line of the failed request, once.
        const lines = failure.line === null ? [] : [failure.line(origin)];
        problems.add(where, reportedProblems(env, lines));
        clearReports(env);
        assert.equal(
          await page.evaluate(
            () => localStorage.length + sessionStorage.length,
          ),
          0,
          `${where}: nothing stored`,
        );
        // «Повторить» asks again, with the same answers; the failure is lifted first.
        await env.context.unroute(pattern, handler);
        const before = asked.length;
        await page.locator("#demo .msg button").click();
        if (route === "questionnaire") await waitHeading(page, Q[0].title);
        else
          await page.waitForFunction(
            () =>
              document.querySelector("#demo .rc-kind, #demo .rc-nomatch") !==
              null,
            null,
            { timeout: 15000 },
          );
        assert.equal(asked.length - before, 1, `${where}: one new request`);
        assert.equal(asked.at(-1)?.path, `/api/demo/${route}`);
        if (route === "result")
          assert.deepEqual(
            asked.at(-1)?.body,
            { answers: body },
            `${where}: the same answers`,
          );
        await readState(
          problems,
          `${where} after Повторить`,
          env,
          "ru",
          [],
          route === "result"
            ? { result: await shownKind(page, "ru") }
            : undefined,
        );
      }
    }
    // A server that is really stopped (E2, E3): the connection is refused, and the page says there is no
    // connection. The retry asks again and says it again; a change of language asks the other language.
    const REFUSED = "Failed to load resource: net::ERR_CONNECTION_REFUSED";
    for (const stopAt of /** @type {const} */ (["result", "questionnaire"])) {
      const where = `a stopped server at the ${stopAt}`;
      const dead = startNode(t, { PORT: "0" });
      const port2 = await dead.ready;
      const env = await newPage(browser, t, {
        port: port2,
        reducedMotion: "reduce",
      });
      const { page } = env;
      /** @param {string} key @param {string} lang */
      const expectMessage = (key, lang) =>
        page.waitForFunction(
          (/** @type {string} */ want) =>
            document.querySelector("#demo .msg .msg-title")?.textContent ===
            want,
          say(key, lang),
          { timeout: 20000 },
        );
      await page.goto(`http://127.0.0.1:${port2}/demo.html`);
      await pageReady(page, "/demo.html", "ru");
      if (stopAt === "result") {
        for (let i = 0; i < 4; i++) {
          await page.locator("#demo .card").nth(ANSWERS[i]).click();
          await waitHeading(page, Q[i + 1].title);
        }
        dead.child.kill("SIGKILL");
        await dead.exited;
        await page.locator("#demo .card").nth(ANSWERS[4]).click();
        await waitHeading(page, say("demo_result_title", "ru"));
        await expectMessage("demo_offline", "ru");
        assert.equal(await placeLine(page), atDesk(4, "ru"), where);
        assert.deepEqual(
          await page.$$eval("#demo .chips .chip b", (els) =>
            els.map((e) => e.textContent),
          ),
          ANSWERS.map((a, i) => Q[i].options[a].label),
          `${where}: the answers are kept`,
        );
        problems.add(where, await shownTextFindings(page, "ru"));
        await page.locator("#demo .msg button").click();
        await waitFor(
          () => env.consoleLines.length >= 2,
          15000,
          "the second refused request after «Повторить»",
        );
        await expectMessage("demo_offline", "ru");
        problems.add(`${where} retry`, await shownTextFindings(page, "ru"));
      } else {
        await page.locator("#demo .card").nth(ANSWERS[0]).click();
        await waitHeading(page, Q[1].title);
        dead.child.kill("SIGKILL");
        await dead.exited;
        await page.click('[data-lang="en"]');
        await expectMessage("demo_offline", "en");
        assert.equal(
          await placeLine(page),
          atDesk(2, "en"),
          `${where}: the scene stays`,
        );
        problems.add(`${where} en`, await shownTextFindings(page, "en"));
      }
      problems.add(
        where,
        reportedProblems(env, Array(env.consoleLines.length).fill(REFUSED)),
      );
      assert.ok(
        env.consoleLines.length >= 1 &&
          env.consoleLines.every((l) => l.text === REFUSED),
        `${where}: the console holds the browser's line of the refused request`,
      );
      clearReports(env);
    }
    assert.deepEqual(problems.lines(), []);
  },
);

test(
  "LD-8 after a whole pass with changes of theme and language: localStorage holds sai-lang and sai-theme only, one word each; no session storage, no cookie, no answer in the address",
  {
    timeout: 240000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const env = await newPage(browser, t, { port });
    const { page, context } = env;
    const intake = {
      ru: intakeIn("ru"),
      en: intakeIn("en"),
      kk: intakeIn("kk"),
    };
    /**
     * @param {string} where
     * @param {string} lang
     * @param {string} [live] the announcement the state holds in the live line (waited for, then asserted)
     */
    const step = async (where, lang, live = undefined) => {
      if (live !== undefined) await waitLive(page, live, where);
      const s = await page.evaluate(() => ({
        local: Object.fromEntries(Object.entries(localStorage)),
        session: sessionStorage.length,
        cookie: document.cookie,
        href: window.location.href,
      }));
      for (const [k, v] of Object.entries(s.local)) {
        if (!["sai-lang", "sai-theme"].includes(k))
          problems.add(where, [`localStorage key ${k}`]);
        if (!/^[a-z]{2,5}$/.test(String(v)))
          problems.add(where, [`localStorage ${k} is not one word`]);
      }
      if (s.session !== 0)
        problems.add(where, [`sessionStorage holds ${s.session} entries`]);
      if (s.cookie !== "" || (await context.cookies()).length > 0)
        problems.add(where, ["a cookie is set"]);
      const url = new URL(s.href);
      if (
        url.pathname !== "/demo.html" ||
        !/^(\?lang=(ru|kk|en))?$/.test(url.search) ||
        url.hash !== ""
      )
        problems.add(where, [
          `the address holds more than ?lang=: ${url.pathname}${url.search}${url.hash}`,
        ]);
      problems.add(where, await shownTextFindings(page, lang));
      return s.local;
    };
    await page.goto(`${origin}/demo.html`);
    await pageReady(page, "/demo.html", "ru");
    let lang = /** @type {"ru" | "en" | "kk"} */ ("ru");
    await waitHeading(page, intake.ru.questions[0].title);
    await step("load", lang);
    await page.click('[data-lang="en"]');
    lang = "en";
    await waitHeading(page, intake.en.questions[0].title);
    await step("to en", lang);
    await tap(problems, "answer 1", env, lang, 1, intake.en.questions[1].title);
    await step("answer 1", lang);
    await page.click("#theme");
    await page.click("#theme");
    await step("theme dark", lang);
    await tap(problems, "answer 2", env, lang, 2, intake.en.questions[2].title);
    // The announcement of the answer is in the live line before the switch (a condition: the demo writes it
    // ANNOUNCE_MS after the tap), so the switch has a line to empty.
    await page.waitForFunction(
      () => (document.getElementById("live")?.textContent ?? "") !== "",
      null,
      { timeout: 15000 },
    );
    await page.click('[data-lang="kk"]');
    lang = "kk";
    await waitHeading(page, intake.kk.questions[2].title);
    assert.equal(
      await page.evaluate(() => document.getElementById("live")?.textContent),
      "",
      "to kk: the live line that spoke in en is emptied",
    );
    await step("to kk", lang);
    await page.locator("#demo .back").click();
    await waitHeading(page, intake.kk.questions[1].title);
    await step("back", lang, liveBack(2, lang));
    await tap(
      problems,
      "answer 2 again",
      env,
      lang,
      1,
      intake.kk.questions[2].title,
    );
    await page.click("#theme");
    await step("theme auto", lang);
    await tap(problems, "answer 3", env, lang, 0, intake.kk.questions[3].title);
    await tap(
      problems,
      "answer 4",
      env,
      lang,
      intake.kk.questions[3].options.length,
      intake.kk.questions[4].title,
    );
    await tap(
      problems,
      "answer 5",
      env,
      lang,
      1,
      say("demo_result_title", lang),
    );
    await page.waitForSelector("#demo .rc-kind, #demo .rc-nomatch");
    await step("result", lang, liveResult(await shownKind(page, lang), lang));
    await page.click('[data-lang="ru"]');
    lang = "ru";
    await page.waitForFunction(
      (/** @type {string} */ want) =>
        document.querySelector("#demo .r-sum h2")?.textContent === want,
      say("demo_result_title", "ru"),
    );
    await page.waitForSelector("#demo .rc-kind, #demo .rc-nomatch");
    const local = await step(
      "result in ru",
      lang,
      liveResult(await shownKind(page, lang), lang),
    );
    assert.deepEqual(Object.keys(local).sort(), ["sai-lang", "sai-theme"]);
    assert.equal(local["sai-lang"], "ru");
    assert.equal(local["sai-theme"], "auto");
    problems.add("the pass", reportedProblems(env));
    // No announcement of the old language arrives after a switch (TEST-DESIGN-VALIDATOR T12): the tap and the
    // language button are pressed in ONE task, so the announcement of the answer is still pending (the demo writes
    // it ANNOUNCE_MS after the tap) when the language changes; the survey drops it, and the live line stays
    // empty. The wait is a condition: the page is past 30 ms by its own clock, and the next question has opened
    // in Kazakh (its timer was set after the announcement's, so the announcement's timer has fired by then).
    const late = await newPage(browser, t, { port });
    await late.page.goto(`${origin}/demo.html?lang=en`);
    await pageReady(late.page, "/demo.html", "en");
    await waitHeading(late.page, intake.en.questions[0].title);
    const pressedAt = await late.page.evaluate(() => {
      const card = /** @type {HTMLElement | undefined} */ (
        document.querySelectorAll("#demo .card")[1]
      );
      const button = /** @type {HTMLElement | null} */ (
        document.querySelector('[data-lang="kk"]')
      );
      if (card === undefined || button === null) return null;
      const at = performance.now();
      card.click();
      button.click();
      return at;
    });
    assert.notEqual(
      pressedAt,
      null,
      "the card and the Kazakh button are there",
    );
    await waitHeading(late.page, intake.kk.questions[1].title);
    await late.page.waitForFunction(
      (/** @type {number} */ at) => performance.now() - at >= 130,
      pressedAt,
      { timeout: 15000 },
    );
    assert.equal(
      await late.page.evaluate(
        () => document.getElementById("live")?.textContent,
      ),
      "",
      "the announcement of the tap, pending at the switch to kk, does not write the old language afterwards",
    );
    problems.add("the late announcement", reportedProblems(late));
    assert.deepEqual(problems.lines(), []);
  },
);

test(
  "LD-9 the public set: no link to examples.html, /examples.html is the 404 page, RU and EN only, ?lang=kk in Russian, the scene and the caption, the two lines, the demo result with the fixed list in ru and en",
  {
    timeout: 300000,
  },
  async (t) => {
    const { port, origin, dir } = await servePublicSet(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const output = await import(
      pathToFileURL(path.join(dir, "shared", "i18n", "texts.js")).href
    );
    assert.deepEqual([...output.LANGS], ["ru", "en"], "the output's languages");
    /** @param {string} key @param {string} lang */
    const out = (key, lang) => output.TEXTS[key][lang];
    // REQ-113 criterion 8: the output's module keeps the 15 keys with their ru and en values, and holds no order
    // text and no kk value.
    assert.ok(
      !Object.keys(output.TEXTS).some((key) => key.startsWith("order_")) &&
        !Object.values(output.TEXTS).some((entry) => "kk" in entry),
      "the output has a kk value or an order key",
    );
    for (const key of STATUS_KEYS)
      for (const lang of ["ru", "en"]) {
        assert.ok(output.TEXTS[key] !== undefined, `the output keeps ${key}`);
        assert.equal(out(key, lang), say(key, lang), `the output keeps ${key}`);
      }
    const fixture = answerFixtures().find((f) => f.name === "landing");
    assert.ok(fixture, "the landing fixture");
    for (const win of [WINDOWS[0], WINDOWS[1]]) {
      const env = await newPage(browser, t, {
        port,
        viewport: { width: win.width, height: win.height },
      });
      const { page } = env;
      for (const lang of /** @type {const} */ (["ru", "en"])) {
        for (const pathname of [
          "/",
          "/how.html",
          "/demo.html",
          "/examples.html",
          "/nope",
        ]) {
          const where = `${win.name} ${lang} ${pathname}`;
          const notFound =
            pathname === "/examples.html" || pathname === "/nope";
          const res = await page.goto(`${origin}${pathname}?lang=${lang}`);
          assert.equal(res?.status(), notFound ? 404 : 200, where);
          const titleKey = notFound
            ? "title_404"
            : pathname === "/"
              ? "closed_test"
              : pathname === "/how.html"
                ? "title_how"
                : "title_demo";
          await page.waitForFunction(
            (/** @type {string} */ want) => document.title === want,
            out(titleKey, lang),
            { timeout: 15000 },
          );
          if (!notFound) await pageReady(page, pathname, lang);
          await framesPass(page, 2);
          const facts = await page.evaluate(() => {
            const text = (/** @type {Element | null} */ e) =>
              (e?.textContent ?? "").replace(/\s+/g, " ").trim();
            const stage = document.getElementById("stage");
            return {
              lang: document.documentElement.lang,
              examplesLinks: document.querySelectorAll('a[href*="examples"]')
                .length,
              orderTexts: document.querySelectorAll(
                '[data-t^="order_"], [data-t-aria^="order_"]',
              ).length,
              langButtons: [...document.querySelectorAll("[data-lang]")].map(
                (b) => b.getAttribute("data-lang"),
              ),
              page: document.body.getAttribute("data-page"),
              mode: text(document.getElementById("test-mode")),
              modeShown:
                document
                  .getElementById("test-mode")
                  ?.checkVisibility({ checkVisibilityCSS: true }) ?? false,
              ai: text(document.getElementById("ai-disclosure")),
              aiShown:
                document
                  .getElementById("ai-disclosure")
                  ?.checkVisibility({ checkVisibilityCSS: true }) ?? false,
              stage:
                stage === null
                  ? null
                  : {
                      role: stage.getAttribute("role"),
                      name: stage.getAttribute("aria-label"),
                      canvasInside: stage.querySelector("canvas") !== null,
                      list: document.querySelectorAll("#stage-desks li").length,
                      captionAfter: (() => {
                        const c = document.getElementById("scene-caption");
                        return (
                          c !== null &&
                          (stage.compareDocumentPosition(c) &
                            Node.DOCUMENT_POSITION_FOLLOWING) !==
                            0 &&
                          c.getBoundingClientRect().top >=
                            stage.getBoundingClientRect().bottom - 1
                        );
                      })(),
                      caption: text(document.getElementById("scene-caption")),
                    },
            };
          });
          assert.equal(facts.lang, lang, `${where}: the page's language`);
          assert.equal(
            facts.examplesLinks,
            0,
            `${where}: no link to examples.html`,
          );
          assert.equal(facts.orderTexts, 0, `${where}: no order text`);
          assert.deepEqual(
            facts.langButtons,
            ["ru", "en"],
            `${where}: RU and EN only`,
          );
          assert.equal(
            facts.page,
            notFound
              ? "notfound"
              : pathname === "/"
                ? "landing"
                : pathname === "/how.html"
                  ? "how"
                  : "demo",
            where,
          );
          assert.equal(
            facts.modeShown && facts.aiShown,
            true,
            `${where}: the two lines are visible`,
          );
          assert.equal(facts.mode, norm(out("test_mode", lang)), where);
          assert.equal(facts.ai, norm(out("ai_disclosure", lang)), where);
          if (
            pathname === "/" ||
            pathname === "/how.html" ||
            pathname === "/demo.html"
          ) {
            assert.equal(
              facts.stage?.role,
              "img",
              `${where}: the scene is an image`,
            );
            assert.equal(
              facts.stage?.canvasInside,
              true,
              `${where}: the canvas is inside`,
            );
            assert.equal(facts.stage?.list, 4, `${where}: the text list`);
            assert.equal(
              facts.stage?.captionAfter,
              true,
              `${where}: the caption under the scene`,
            );
            assert.equal(facts.stage?.name, out("scene_alt", lang), where);
            assert.equal(
              facts.stage?.caption,
              norm(out("scene_caption", lang)),
              where,
            );
          } else assert.equal(facts.stage, null, `${where}: no scene`);
          if (pathname === "/how.html")
            await checkHowPage(
              page,
              (key) => out(key, lang),
              `${where}: the output shows`,
              win.width,
              lang,
            );
          problems.add(where, await layoutFindings(page));
          await readState(
            problems,
            where,
            env,
            lang,
            notFound ? [LINE_404] : [],
          );
        }
        // ?lang=kk is Russian here.
        if (lang === "ru") {
          await page.goto(`${origin}/demo.html?lang=kk`);
          await pageReady(page, "/demo.html", "ru");
          assert.equal(
            await page.evaluate(() => document.documentElement.lang),
            "ru",
            "?lang=kk in Russian",
          );
          await readState(problems, `${win.name} kk asked`, env, "ru");
          await page.goto(`${origin}/how.html?lang=kk`);
          await pageReady(page, "/how.html", "ru");
          const asked = (await readBlock(page, "main")).block;
          assert.deepEqual(
            [asked?.heading, asked?.rows.map((r) => r.mark)],
            [
              norm(out("now_title", "ru")),
              [
                norm(out("stat_on", "ru")),
                norm(out("stat_off", "ru")),
                norm(out("stat_off", "ru")),
              ],
            ],
            "kk asked: how.html shows Russian",
          );
        }
        // The demo result with the fixed list, and «Описать идею» opening the part of how.html.
        const intake = intakeIn(lang);
        await page.goto(`${origin}/demo.html?lang=${lang}`);
        await pageReady(page, "/demo.html", lang);
        for (const [i, q] of intake.questions.entries()) {
          await waitHeading(page, q.title);
          await page
            .locator("#demo .card")
            .nth(q.options.findIndex((o) => o.id === fixture.answers[q.id]))
            .click();
          if (i === 4) await waitHeading(page, out("demo_result_title", lang));
        }
        await page.waitForSelector("#demo .rc-kind, #demo .rc-nomatch");
        const got = await readResult(page);
        assert.deepEqual(
          got.lists.at(-1),
          {
            title: out("nobuild_title", lang),
            items: Array.from({ length: 10 }, (_v, k) =>
              out(`nobuild_${k + 1}`, lang),
            ),
          },
          `${win.name} ${lang}: the fixed list of the result`,
        );
        const words = (/** @type {string} */ key) => out(key, lang);
        checkStatus(
          got,
          lang,
          words,
          `${win.name} ${lang} result: the output shows`,
          true,
        );
        problems.add(
          `${win.name} ${lang}: the status block, the lead, the label and the sentence on a recommended result`,
          await layoutFindings(page),
        );
        await readState(problems, `${win.name} ${lang} result`, env, lang, [], {
          result: await shownKind(page, lang),
        });
        // A visitor who chose the language by its button has it stored; a link carries no ?lang=.
        await page.evaluate(
          (/** @type {string} */ l) => localStorage.setItem("sai-lang", l),
          lang,
        );
        await page.locator("#demo .idea a").click();
        await page.waitForURL(`${origin}/how.html#describe-idea`);
        await pageReady(page, "/how.html", lang);
        const place = await page.evaluate(() => {
          const r = document
            .getElementById("describe-idea")
            ?.getBoundingClientRect();
          return r === undefined
            ? null
            : { top: r.top, bottom: r.bottom, h: window.innerHeight };
        });
        assert.ok(
          place !== null && place.bottom > 0 && place.top < place.h,
          `${win.name} ${lang}: the idea part is on the screen`,
        );
        await readState(problems, `${win.name} ${lang} idea`, env, lang);
        // The no-match result (five «Не знаю») shows the block, the lead and the label of the output as well.
        await page.goto(`${origin}/demo.html?lang=${lang}`);
        await pageReady(page, "/demo.html", lang);
        for (const q of intake.questions) {
          await waitHeading(page, q.title);
          await page.locator("#demo .card").nth(q.options.length).click();
        }
        await waitHeading(page, out("demo_result_title", lang));
        await page.waitForSelector("#demo .rc-nomatch");
        checkStatus(
          await readResult(page),
          lang,
          words,
          `${win.name} ${lang} no match: the output shows`,
          false,
        );
        problems.add(
          `${win.name} ${lang}: the status block, the lead, the label and the sentence on the no-match result`,
          await layoutFindings(page),
        );
        await readState(
          problems,
          `${win.name} ${lang} no match`,
          env,
          lang,
          [],
          {
            result: intake.noMatch,
          },
        );
      }
    }
    assert.deepEqual(problems.lines(), []);
  },
);
