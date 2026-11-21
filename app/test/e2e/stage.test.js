/* global CanvasRenderingContext2D, document, getComputedStyle, HTMLCanvasElement, innerWidth, window */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newPage,
  openBrowser,
  serveLocal,
  shownTextFindings,
} from "../fixtures/browser.js";
import {
  answerAndWait,
  atDesk,
  clearReports,
  collector,
  filled,
  frameCount,
  framesPass,
  hideTab,
  intakeIn,
  liveDesk,
  LOCAL_LANGS,
  norm,
  pageReady,
  placeLine,
  publicFiles,
  readState,
  reportedProblems,
  say,
  showTab,
  waitHeading,
  waitPlace,
  WINDOWS,
} from "../fixtures/e2e-kit.js";
import {
  finishWalk,
  labelFindings,
  layoutFindings,
  startWalkIn,
} from "../fixtures/page-checks.js";

// REQ-112 criteria 6 and 9 (the scene on the pages, automated; the caption under the scene): the tests ST-1 …
// ST-6 of the code design 10, one real Chrome, the local server on port 0. The scene is read through the hooks the
// design names — `data-frames` and `data-figure` of the stage, the text list `#stage-desks` and `#stage-you`, the
// custom property `--you` — and through the labels over the canvas. A walk is read by the test's own
// `requestAnimationFrame` loop in the page (`startWalkIn`), which sees every frame the page draws (design F51).

const STAGE_PAGES = Object.freeze(["/", "/how.html", "/demo.html"]);
/** The desks that ask question 1 … 5 (look 9.13). */
const ASKING_DESK = Object.freeze([1, 2, 3, 3, 4]);

/**
 * The desk the figure goes to when answer `i + 1` is given (`i` from 0): the desk that asks the next question,
 * and desk 4 (the result) after the fifth answer.
 * @param {number} i
 */
const deskAfterAnswer = (i) => (i < 4 ? ASKING_DESK[i + 1] : 4);
/**
 * The desk the figure stands at when answer `i + 1` is given: the door (null) before the first answer, else
 * the desk it went to after the answer before.
 * @param {number} i
 */
const deskBeforeAnswer = (i) => (i === 0 ? null : deskAfterAnswer(i - 1));

/**
 * Starts the walk loop (before the tap), runs `act` (the tap) and waits for the walk to end at the line `until`
 * (the deadline of ten seconds is red). Gives what the loop saw.
 * @param {import("playwright-core").Page} page
 * @param {string} until the place line that ends the walk
 * @param {() => Promise<unknown>} act
 * @returns {Promise<Awaited<ReturnType<typeof finishWalk>>>}
 */
async function watch(page, until, act) {
  await page.evaluate(startWalkIn, until);
  await act();
  return finishWalk(page);
}

/**
 * What the loop saw of a walk that is read frame by frame: a walk shows at least three values of `--you` (a loop
 * that saw fewer saw no walk, and is red), and no label is cut on any frame.
 * @param {Awaited<ReturnType<typeof finishWalk>>} samples
 * @returns {string[]}
 */
function walkLines(samples) {
  /** @type {string[]} */
  const lines = [];
  const values = new Set(samples.map((s) => s.you));
  if (values.size < 3)
    lines.push(
      `the loop saw ${values.size} value(s) of --you, no walk (fewer than 3)`,
    );
  for (const cut of new Set(samples.flatMap((s) => s.cut)))
    lines.push(`a label is cut during the walk: ${cut}`);
  return lines;
}

/**
 * Starts the walk loop, runs `act`, reads the walk (see `walkLines`).
 * @param {import("playwright-core").Page} page
 * @param {string} until
 * @param {() => Promise<unknown>} act
 * @returns {Promise<{ samples: Awaited<ReturnType<typeof finishWalk>>, lines: string[] }>}
 */
async function walk(page, until, act) {
  const samples = await watch(page, until, act);
  return { samples, lines: walkLines(samples) };
}

/** @param {import("playwright-core").Page} page */
const youValue = (page) =>
  page.evaluate(
    () =>
      document.getElementById("stage")?.style.getPropertyValue("--you") ?? "",
  );

/**
 * What the stage must be at rest in the window: no page scroll, the stage inside the window and clipping its canvas,
 * a figure of at least 20 CSS pixels, no label cut and no two labels overlapping («Вы» stands).
 * @param {import("playwright-core").Page} page
 * @returns {Promise<string[]>}
 */
async function restFindings(page) {
  const got = await page.evaluate(() => {
    const stage = /** @type {HTMLElement} */ (document.getElementById("stage"));
    const r = stage.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      left: r.left,
      right: r.right,
      overflowX: getComputedStyle(stage).overflowX,
      figure: Number(stage.getAttribute("data-figure")),
    };
  });
  /** @type {string[]} */
  const out = [];
  if (got.scrollWidth > got.innerWidth)
    out.push(
      `page scroll: scrollWidth ${got.scrollWidth} above innerWidth ${got.innerWidth}`,
    );
  if (got.left < 0 || got.right > got.innerWidth)
    out.push(
      `the stage lies outside the window: ${got.left} to ${got.right} of ${got.innerWidth}`,
    );
  if (!["hidden", "clip"].includes(got.overflowX))
    out.push(`the stage's overflow-x is ${got.overflowX}`);
  if (!(got.figure >= 20))
    out.push(`the figure is ${got.figure} CSS px tall, under 20`);
  return [...out, ...(await labelFindings(page, { overlap: true }))];
}

test(
  "ST-1 on index, how and demo: the canvas inside role=img with a name, the text list with the four stage words, the four role titles and where «Вы» stands, the caption under the scene",
  {
    timeout: 240000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    for (const win of WINDOWS) {
      const env = await newPage(browser, t, {
        port,
        viewport: { width: win.width, height: win.height },
      });
      for (const lang of LOCAL_LANGS)
        for (const pathname of STAGE_PAGES) {
          const where = `${win.name} ${lang} ${pathname}`;
          await env.page.goto(`${origin}${pathname}?lang=${lang}`);
          await pageReady(env.page, pathname, lang);
          const got = await env.page.evaluate(() => {
            const text = (/** @type {Element | null} */ e) =>
              (e?.textContent ?? "").replace(/\s+/g, " ").trim();
            const stage = document.getElementById("stage");
            const list = document.getElementById("stage-text");
            const canvas = stage?.querySelector("canvas");
            const caption = document.getElementById("scene-caption");
            const c = canvas?.getBoundingClientRect();
            return {
              role: stage?.getAttribute("role") ?? null,
              name: stage?.getAttribute("aria-label") ?? "",
              canvasSize: c === undefined ? null : [c.width, c.height],
              bitmap:
                canvas === undefined || canvas === null
                  ? null
                  : [canvas.width, canvas.height],
              textView: stage?.classList.contains("text-view") ?? null,
              listOutside:
                stage !== null && list !== null && !stage.contains(list),
              listRightAfter: stage?.nextElementSibling === list,
              captionRightAfterList: list?.nextElementSibling === caption,
              captionBelow:
                caption !== null &&
                stage !== null &&
                caption.getBoundingClientRect().top >=
                  stage.getBoundingClientRect().bottom - 1,
              captionText: text(caption),
              items: [...document.querySelectorAll("#stage-desks li")].map(
                text,
              ),
              you: text(document.getElementById("stage-you")),
              sign: [
                text(document.querySelector("#stage-labels .sign b")),
                text(document.querySelector("#stage-labels .sign i")),
              ],
              youLabel: text(document.querySelector("#stage-labels .you")),
              plates: [
                ...document.querySelectorAll("#stage-labels .plate"),
              ].map(text),
            };
          });
          const check = (
            /** @type {string} */ what,
            /** @type {unknown} */ a,
            /** @type {unknown} */ b,
          ) => {
            if (JSON.stringify(a) !== JSON.stringify(b))
              problems.add(where, [
                `${what}: ${JSON.stringify(a)} is not ${JSON.stringify(b)}`,
              ]);
          };
          check("role", got.role, "img");
          check("name", norm(got.name), norm(say("scene_alt", lang)));
          if (
            got.canvasSize === null ||
            got.canvasSize[0] <= 0 ||
            got.canvasSize[1] <= 0 ||
            got.bitmap === null ||
            got.bitmap[0] <= 0 ||
            got.bitmap[1] <= 0
          )
            problems.add(where, [
              `the canvas has no size: ${JSON.stringify([got.canvasSize, got.bitmap])}`,
            ]);
          check("the canvas draws (no text view)", got.textView, false);
          check(
            "the text list stands outside the role=img element",
            got.listOutside,
            true,
          );
          check(
            "the text list right after the stage",
            got.listRightAfter,
            true,
          );
          check(
            "the caption right after the list",
            got.captionRightAfterList,
            true,
          );
          check("the caption under the scene", got.captionBelow, true);
          check(
            "the caption",
            got.captionText,
            norm(say("scene_caption", lang)),
          );
          check(
            "the four desk lines (stage word and role title)",
            got.items,
            [1, 2, 3, 4].map((n) =>
              filled(say("desk_line", lang), {
                n,
                stage: say(`stage_${n}`, lang),
                role: say(`role_${n}`, lang),
              }),
            ),
          );
          check("where «Вы» stands", got.you, say("you_at_door", lang));
          check("the door sign", got.sign, [
            say("brand_name", lang),
            say("door_tagline", lang),
          ]);
          check("the «Вы» label", got.youLabel, say("you", lang));
          check(
            "the four plates",
            got.plates.map((p) => p.replace(/\s+/g, "")),
            [1, 2, 3, 4].map((n) =>
              `${n}·${say(`stage_${n}`, lang)}`.replace(/\s+/g, ""),
            ),
          );
          await readState(problems, where, env, lang);
        }
      // The two pages without the scene (the look's I7).
      for (const pathname of ["/examples.html", "/nope"]) {
        await env.page.goto(`${origin}${pathname}`);
        await pageReady(env.page, pathname, "ru");
        const count = await env.page.evaluate(
          () =>
            document.querySelectorAll("#stage, #stage-text, #scene-caption")
              .length,
        );
        if (count !== 0)
          problems.add(`${win.name} ${pathname}`, ["the page has a scene"]);
        clearReports(env);
      }
    }
    assert.deepEqual(problems.lines(), []);
  },
);

test(
  "ST-2 in every window and language: no page scroll, the stage inside the window and clipping, data-figure at least 20, no label cut at load, on every frame of each walk and after it, no two labels overlapping when «Вы» stands",
  {
    timeout: 900000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    for (const win of WINDOWS)
      for (const scheme of /** @type {const} */ (["light", "dark"])) {
        const env = await newPage(browser, t, {
          port,
          viewport: { width: win.width, height: win.height },
          colorScheme: scheme,
        });
        const { page } = env;
        for (const lang of LOCAL_LANGS) {
          const at = `${win.name} ${scheme} ${lang}`;
          // The landing at load.
          await page.goto(`${origin}/?lang=${lang}`);
          await pageReady(page, "/", lang);
          problems.add(`${at} index load`, await restFindings(page));
          // how: the taps on the steps 1, 2, 3 and 4 in turn (the door to desk 4).
          await page.goto(`${origin}/how.html?lang=${lang}`);
          await pageReady(page, "/how.html", lang);
          problems.add(`${at} how load`, await restFindings(page));
          for (const n of scheme === "light" ? [1, 2, 3, 4] : []) {
            const seen = await walk(page, atDesk(n, lang), () =>
              page.click(`button[data-step="${n}"]`),
            );
            problems.add(`${at} how step ${n}`, seen.lines);
            problems.add(`${at} how after step ${n}`, await restFindings(page));
          }
          // demo: the five answers of one pass (the door to desk 2, to desk 3, no walk, to desk 4, no walk).
          await page.goto(`${origin}/demo.html?lang=${lang}`);
          await pageReady(page, "/demo.html", lang);
          problems.add(`${at} demo load`, await restFindings(page));
          if (scheme !== "light") continue;
          const Q = intakeIn(lang).questions;
          for (let i = 0; i < 5; i++) {
            const next =
              i < 4 ? Q[i + 1].title : say("demo_result_title", lang);
            const moves = deskAfterAnswer(i) !== deskBeforeAnswer(i);
            if (moves) {
              const target = deskAfterAnswer(i);
              const seen = await walk(page, atDesk(target, lang), () =>
                page.locator("#demo .card").nth(0).click(),
              );
              problems.add(`${at} demo answer ${i + 1}`, seen.lines);
              await waitHeading(page, next);
            } else await answerAndWait(page, 0, next);
            problems.add(
              `${at} demo after answer ${i + 1}`,
              await restFindings(page),
            );
          }
        }
      }
    assert.deepEqual(problems.lines(), []);
  },
);

test(
  "ST-3 a step on how and an answer on demo move «Вы» to the step table's desk, nothing else moves it",
  {
    timeout: 300000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();

    // how: the line of the text list says where «Вы» stands after each walk, nothing else moves it.
    for (const lang of /** @type {const} */ (["ru", "en"])) {
      const env = await newPage(browser, t, { port });
      const { page } = env;
      await page.goto(`${origin}/how.html?lang=${lang}`);
      await pageReady(page, "/how.html", lang);
      const at = `how ${lang}`;
      assert.equal(await placeLine(page), say("you_at_door", lang));
      // Nothing is tapped: no frame and no move over sixty frames of the page.
      const f0 = await frameCount(page);
      const you0 = await page.evaluate(() =>
        document.getElementById("stage")?.style.getPropertyValue("--you"),
      );
      await framesPass(page, 60);
      assert.equal(await frameCount(page), f0, `${at}: no frame with no tap`);
      assert.equal(
        await page.evaluate(() =>
          document.getElementById("stage")?.style.getPropertyValue("--you"),
        ),
        you0,
      );
      for (const n of [2, 4, 1, 3]) {
        const before = await frameCount(page);
        const seen = await walk(page, atDesk(n, lang), () =>
          page.click(`button[data-step="${n}"]`),
        );
        problems.add(`${at} step ${n}`, seen.lines);
        // The live line says the new place after the walk, not at the tap (decisions/0124 O20).
        const final = seen.samples.at(-1)?.you;
        const early = seen.samples.filter((s) => s.you !== final);
        if (early.some((s) => s.live === liveDesk(n, lang)))
          problems.add(`${at} step ${n}`, [
            "the live line says the place before the walk ends",
          ]);
        if (seen.samples.at(-1)?.live !== liveDesk(n, lang))
          problems.add(`${at} step ${n}`, [
            `the live line after the walk is not ${liveDesk(n, lang)}`,
          ]);
        const pressed = await page.$$eval("button[data-step]", (els) =>
          els.map((e) => e.getAttribute("aria-pressed")),
        );
        assert.deepEqual(
          pressed,
          [1, 2, 3, 4].map((k) => String(k === n)),
          `${at}: the step pressed`,
        );
        assert.ok(
          (await frameCount(page)) > before,
          `${at}: frames were drawn for the walk`,
        );
        problems.add(
          `${at} after step ${n}`,
          await shownTextFindings(page, lang),
        );
      }
      // A tap on the step that is current draws nothing and moves nothing.
      const f1 = await frameCount(page);
      await page.click('button[data-step="3"]');
      await framesPass(page, 30);
      assert.equal(
        await frameCount(page),
        f1,
        `${at}: a tap to the drawn state draws no frame`,
      );
      assert.equal(await placeLine(page), atDesk(3, lang));
      // A change of the theme or of the language draws one frame and leaves «Вы» where it stands.
      const you1 = await page.evaluate(() =>
        document.getElementById("stage")?.style.getPropertyValue("--you"),
      );
      // Auto -> Light keeps the drawn theme on a light system (no frame); Light -> Dark changes it (one frame).
      await page.click("#theme");
      await page.click("#theme");
      await page.waitForFunction(
        (/** @type {number} */ n) =>
          Number(
            document.getElementById("stage")?.getAttribute("data-frames"),
          ) > n,
        f1,
      );
      await framesPass(page, 30);
      assert.equal(
        await frameCount(page),
        f1 + 1,
        `${at}: one frame after the theme change`,
      );
      const other = lang === "ru" ? "en" : "ru";
      await page.click(`[data-lang="${other}"]`);
      await page.waitForFunction(
        (/** @type {number} */ n) =>
          Number(
            document.getElementById("stage")?.getAttribute("data-frames"),
          ) > n,
        f1 + 1,
      );
      await framesPass(page, 30);
      assert.equal(
        await frameCount(page),
        f1 + 2,
        `${at}: one frame after the language change`,
      );
      assert.equal(
        await placeLine(page),
        atDesk(3, other),
        `${at}: «Вы» stays at desk 3, in ${other}`,
      );
      assert.equal(
        await page.evaluate(() =>
          document.getElementById("stage")?.style.getPropertyValue("--you"),
        ),
        you1,
        `${at}: the theme and language changes do not move «Вы»`,
      );
      await readState(problems, at, env, other);
    }

    // A tab sent to the background stops the drawing, and the walk goes on when it is back.
    {
      const env = await newPage(browser, t, { port });
      const { page } = env;
      await page.goto(`${origin}/how.html`);
      await pageReady(page, "/how.html", "ru");
      await page.evaluate(startWalkIn, atDesk(4, "ru"));
      await page.click('button[data-step="4"]');
      await page.waitForFunction(
        () =>
          Number(
            document.getElementById("stage")?.getAttribute("data-frames"),
          ) >= 6,
      );
      await hideTab(page);
      await framesPass(page, 3);
      const stood = await frameCount(page);
      const place = await page.evaluate(() =>
        document.getElementById("stage")?.style.getPropertyValue("--you"),
      );
      await framesPass(page, 40);
      assert.equal(
        await frameCount(page),
        stood,
        "no frame is drawn while the tab is hidden",
      );
      assert.equal(
        await page.evaluate(() =>
          document.getElementById("stage")?.style.getPropertyValue("--you"),
        ),
        place,
        "«Вы» does not move while the tab is hidden",
      );
      assert.notEqual(await placeLine(page), atDesk(4, "ru"));
      await showTab(page);
      const samples = await finishWalk(page);
      assert.equal(
        samples.at(-1)?.line,
        atDesk(4, "ru"),
        "the walk goes on when the tab is back",
      );
      await readState(problems, "hidden tab", env, "ru");
    }

    // demo: the five answers of one pass; the walks, and the two taps that walk nowhere.
    for (const lang of /** @type {const} */ (["ru", "kk"])) {
      const env = await newPage(browser, t, { port });
      const { page } = env;
      const Q = intakeIn(lang).questions;
      const at = `demo ${lang}`;
      await page.goto(`${origin}/demo.html?lang=${lang}`);
      await pageReady(page, "/demo.html", lang);
      assert.equal(await placeLine(page), say("you_at_door", lang));
      const f0 = await frameCount(page);
      await framesPass(page, 60);
      assert.equal(await frameCount(page), f0, `${at}: no frame with no tap`);
      for (let i = 0; i < 5; i++) {
        const next = i < 4 ? Q[i + 1].title : say("demo_result_title", lang);
        const target = deskAfterAnswer(i);
        const here = deskBeforeAnswer(i);
        const before = await frameCount(page);
        if (here === null || target !== here) {
          const seen = await walk(page, atDesk(target, lang), () =>
            page.locator("#demo .card").nth(0).click(),
          );
          problems.add(`${at} answer ${i + 1}`, seen.lines);
          await waitHeading(page, next);
        } else {
          // Question 3 to 4 (both at desk 3) draws no frame; question 5 to the result draws exactly one.
          await answerAndWait(page, 0, next);
          await framesPass(page, 30);
          const drew = (await frameCount(page)) - before;
          const want = i === 4 ? 1 : 0;
          if (drew !== want)
            problems.add(`${at} answer ${i + 1}`, [
              `${drew} frame(s) for a tap that walks nowhere, not ${want}`,
            ]);
        }
        assert.equal(
          await placeLine(page),
          atDesk(target, lang),
          `${at}: «Вы» at desk ${target} after answer ${i + 1}`,
        );
        problems.add(
          `${at} after answer ${i + 1}`,
          await shownTextFindings(page, lang),
        );
      }
      // A chip of the result (change question 1) walks «Вы» back to the asking desk of question 1: the door.
      await page.locator("#demo .chip").nth(0).click();
      await waitHeading(page, Q[0].title);
      await waitPlace(page, say("you_at_door", lang));
      await readState(problems, at, env, lang);
    }
    assert.deepEqual(problems.lines(), []);
  },
);

test(
  "ST-4 with reduced motion emulated «Вы» is at the target at once, in one frame with no place between; a change of the setting in the middle of a walk is followed",
  {
    timeout: 240000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();

    /**
     * One tap with reduced motion: the loop sees only the place before and the target, exactly one frame is drawn, and
     * the live line (on how) says the new place at once.
     * @param {string} where
     * @param {import("playwright-core").Page} page
     * @param {number} n the desk
     * @param {string} lang
     * @param {() => Promise<unknown>} act
     * @param {boolean} live whether the page says the place in the live region
     */
    const oneFrame = async (where, page, n, lang, act, live) => {
      const before = await frameCount(page);
      const from = await youValue(page);
      const samples = await watch(page, atDesk(n, lang), act);
      const target = samples.at(-1)?.you ?? "";
      const between = [...new Set(samples.map((s) => s.you))].filter(
        (v) => v !== from && v !== target,
      );
      if (target === from) problems.add(where, ["«Вы» did not move"]);
      if (between.length > 0)
        problems.add(where, [`a place between: --you ${between.join(", ")}`]);
      const drew = (await frameCount(page)) - before;
      if (drew !== 1) problems.add(where, [`${drew} frames drawn, not 1`]);
      const first = samples.find((s) => s.line === atDesk(n, lang));
      if (live && first?.live !== liveDesk(n, lang))
        problems.add(where, ["the live line does not say the place at once"]);
      problems.add(where, await shownTextFindings(page, lang));
    };

    for (const win of WINDOWS) {
      const env = await newPage(browser, t, {
        port,
        viewport: { width: win.width, height: win.height },
        reducedMotion: "reduce",
      });
      const { page } = env;
      // how: the taps on the steps 3, 4 and 1, each in one frame.
      await page.goto(`${origin}/how.html`);
      await pageReady(page, "/how.html", "ru");
      for (const n of [3, 4, 1])
        await oneFrame(
          `reduced ${win.name} how step ${n}`,
          page,
          n,
          "ru",
          () => page.click(`button[data-step="${n}"]`),
          true,
        );
      // demo: the answers that walk (to desk 2, to desk 3, to desk 4), each in one frame.
      await page.goto(`${origin}/demo.html`);
      await pageReady(page, "/demo.html", "ru");
      const Q = intakeIn("ru").questions;
      for (let i = 0; i < 5; i++) {
        const next = i < 4 ? Q[i + 1].title : say("demo_result_title", "ru");
        const target = deskAfterAnswer(i);
        const here = deskBeforeAnswer(i);
        if (here === null || target !== here)
          await oneFrame(
            `reduced ${win.name} demo answer ${i + 1}`,
            page,
            target,
            "ru",
            () => page.locator("#demo .card").nth(0).click(),
            false,
          );
        else await answerAndWait(page, 0, next);
        await waitHeading(page, next);
      }
      await readState(problems, `reduced ${win.name}`, env, "ru");
    }

    // The setting changes while «Вы» walks: the walk is cut short and «Вы» stands at the target (REQ-112 criterion 5).
    for (const win of [WINDOWS[0], WINDOWS[2]]) {
      const env = await newPage(browser, t, {
        port,
        viewport: { width: win.width, height: win.height },
      });
      const { page } = env;
      await page.goto(`${origin}/how.html`);
      await pageReady(page, "/how.html", "ru");
      await page.evaluate(startWalkIn, atDesk(4, "ru"));
      await page.click('button[data-step="4"]');
      await page.waitForFunction(
        () =>
          Number(
            document.getElementById("stage")?.getAttribute("data-frames"),
          ) >= 6,
      );
      const mark = await page.evaluate(() => {
        const w = /** @type {any} */ (window).__saiWalk;
        w.mark = w.samples.length;
        return w.samples.length;
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const samples = await finishWalk(page);
      const final = samples.at(-1)?.you ?? "";
      const atMark = samples[mark - 1]?.you;
      if (atMark === final)
        problems.add(`mid-walk ${win.name}`, [
          "the walk was over before the setting changed",
        ]);
      // A few frames after the change «Вы» stands at the target and no step of the walk follows.
      const late = samples.slice(mark + 30).filter((s) => s.you !== final);
      if (late.length > 0)
        problems.add(`mid-walk ${win.name}`, [
          `${late.length} frames after the change still show a place before the target`,
        ]);
      if (samples.at(-1)?.line !== atDesk(4, "ru"))
        problems.add(`mid-walk ${win.name}`, ["«Вы» is not at desk 4"]);
      await readState(problems, `mid-walk ${win.name}`, env, "ru");
    }
    assert.deepEqual(problems.lines(), []);
  },
);

/** The two canvas failures of E5 and E6, planted before the page's own script runs. */
const CANVAS_FAILURES = [
  {
    name: "getContext returns null",
    plant: () => {
      HTMLCanvasElement.prototype.getContext = function () {
        return null;
      };
    },
  },
  {
    name: "a drawing call throws",
    plant: () => {
      CanvasRenderingContext2D.prototype.fillRect = function () {
        throw new Error("planted: the drawing fails");
      };
    },
  },
];

test(
  "ST-5 a canvas that cannot draw, and no script: the text view stands, the text list says where «Вы» is, the page and the demo work, no exception, no console line",
  {
    timeout: 300000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const files = publicFiles();

    /**
     * The text view of look 9.16 as the page shows it: the stage is not shown, the list stands in its place with the
     * four desks and the line where «Вы» stands, and no frame is drawn.
     * @param {import("playwright-core").Page} page
     * @param {string} where
     * @param {string} lang
     * @param {string} line the line expected where «Вы» stands
     */
    const textView = async (page, where, lang, line) => {
      const got = await page.evaluate(() => {
        const text = (/** @type {Element | null} */ e) =>
          (e?.textContent ?? "").replace(/\s+/g, " ").trim();
        const stage = document.getElementById("stage");
        const list = document.getElementById("stage-text");
        const box = list?.getBoundingClientRect();
        return {
          stageShown:
            stage?.checkVisibility({ checkVisibilityCSS: true }) ?? null,
          listShown:
            list?.checkVisibility({ checkVisibilityCSS: true }) ?? null,
          height: box?.height ?? 0,
          width: box?.width ?? 0,
          items: [...document.querySelectorAll("#stage-desks li")].map(text),
          you: text(document.getElementById("stage-you")),
          frames: stage?.getAttribute("data-frames") ?? null,
        };
      });
      if (got.stageShown !== false)
        problems.add(where, ["the stage is still shown"]);
      if (got.listShown !== true || got.height <= 0 || got.width <= 0)
        problems.add(where, ["the text list is not shown"]);
      const items = [1, 2, 3, 4].map((n) =>
        filled(say("desk_line", lang), {
          n,
          stage: say(`stage_${n}`, lang),
          role: say(`role_${n}`, lang),
        }),
      );
      if (JSON.stringify(got.items) !== JSON.stringify(items))
        problems.add(where, [
          `the four desks read ${JSON.stringify(got.items)}`,
        ]);
      if (got.you !== line)
        problems.add(where, [
          `where «Вы» stands reads «${got.you}», not «${line}»`,
        ]);
      if (got.frames !== null && got.frames !== "0")
        problems.add(where, [`${got.frames} frames drawn`]);
    };

    for (const failure of CANVAS_FAILURES)
      for (const win of WINDOWS) {
        const env = await newPage(browser, t, {
          port,
          viewport: { width: win.width, height: win.height },
        });
        await env.context.addInitScript(failure.plant);
        const { page } = env;
        const at = `${failure.name} ${win.name}`;
        // The landing: the language switch follows.
        await page.goto(`${origin}/`);
        await page.waitForFunction(() =>
          document.getElementById("stage")?.classList.contains("text-view"),
        );
        await textView(page, `${at} index`, "ru", say("you_at_door", "ru"));
        problems.add(`${at} index`, await layoutFindings(page));
        await page.click('[data-lang="en"]');
        await pageReady(page, "/", "en");
        await textView(page, `${at} index en`, "en", say("you_at_door", "en"));
        await readState(problems, `${at} index`, env, "en");
        await page.click('[data-lang="ru"]');
        await pageReady(page, "/", "ru");
        // how: the steps still say where «Вы» is.
        await page.goto(`${origin}/how.html`);
        await page.waitForFunction(() =>
          document.getElementById("stage")?.classList.contains("text-view"),
        );
        await textView(page, `${at} how`, "ru", say("you_at_door", "ru"));
        for (const n of [3, 1]) {
          await page.click(`button[data-step="${n}"]`);
          await waitPlace(page, atDesk(n, "ru"));
        }
        await textView(page, `${at} how after taps`, "ru", atDesk(1, "ru"));
        problems.add(`${at} how`, await layoutFindings(page));
        await readState(problems, `${at} how`, env, "ru");
        // demo: the whole survey works and the line follows the desks.
        await page.goto(`${origin}/demo.html`);
        await pageReady(page, "/demo.html", "ru");
        await page.waitForFunction(() =>
          document.getElementById("stage")?.classList.contains("text-view"),
        );
        await textView(page, `${at} demo`, "ru", say("you_at_door", "ru"));
        const Q = intakeIn("ru").questions;
        for (let i = 0; i < 5; i++) {
          await answerAndWait(
            page,
            0,
            i < 4 ? Q[i + 1].title : say("demo_result_title", "ru"),
          );
          await waitPlace(page, atDesk(deskAfterAnswer(i), "ru"));
        }
        await page.waitForSelector("#demo .rc-kind, #demo .rc-nomatch");
        await textView(page, `${at} demo result`, "ru", atDesk(4, "ru"));
        await readState(problems, `${at} demo`, env, "ru");
        // The text view in the page's own language: the list is written by the view, not left as the static Russian.
        for (const lang of ["en", "kk"]) {
          await page.goto(`${origin}/how.html?lang=${lang}`);
          await page.waitForFunction(() =>
            document.getElementById("stage")?.classList.contains("text-view"),
          );
          await pageReady(page, "/how.html", lang);
          await textView(
            page,
            `${at} how ${lang}`,
            lang,
            say("you_at_door", lang),
          );
          await readState(problems, `${at} how ${lang}`, env, lang);
        }
      }

    // No script: the style sheet of the <noscript> element shows the text view; the demo says it needs script.
    for (const win of WINDOWS)
      for (const pathname of STAGE_PAGES) {
        const env = await newPage(browser, t, {
          port,
          viewport: { width: win.width, height: win.height },
          javaScript: false,
        });
        const { page } = env;
        const at = `no script ${win.name} ${pathname}`;
        await page.goto(`${origin}${pathname}`);
        await textView(page, at, "ru", say("you_at_door", "ru"));
        if (pathname === "/demo.html") {
          const msg = await page.evaluate(() => ({
            title: (
              document.querySelector("#main .msg-title")?.textContent ?? ""
            )
              .replace(/\s+/g, " ")
              .trim(),
            text: (document.querySelector("#main .msg-text")?.textContent ?? "")
              .replace(/\s+/g, " ")
              .trim(),
            link: [
              document.querySelector("#main .msg a")?.textContent ?? "",
              document.querySelector("#main .msg a")?.getAttribute("href") ??
                "",
            ],
            shown:
              document
                .querySelector("#main .msg")
                ?.checkVisibility({ checkVisibilityCSS: true }) ?? false,
          }));
          assert.deepEqual(
            msg,
            {
              title: say("demo_needs_js", "ru"),
              text: say("demo_needs_js_text", "ru"),
              link: [say("to_landing", "ru"), "/"],
              shown: true,
            },
            `${at}: the demo says it needs script`,
          );
        }
        problems.add(at, await layoutFindings(page));
        const asked = new Set(env.requested.map((u) => new URL(u).pathname));
        const allowed = new Set([
          pathname,
          "/css/tokens.css",
          "/css/site.css",
          "/css/noscript.css",
        ]);
        for (const p of asked)
          if (!allowed.has(p))
            problems.add(at, [
              `a request beyond the page and its style sheets: ${p}`,
            ]);
        for (const p of allowed)
          if (!asked.has(p))
            problems.add(at, [`the request for ${p} is missing`]);
        for (const p of asked)
          if (!(files.has(p) || p === "/"))
            problems.add(at, [`${p} is no file of app/public`]);
        problems.add(at, reportedProblems(env));
      }
    assert.deepEqual(problems.lines(), []);
  },
);

test(
  "ST-6 every request of the pages with the scene is a file of app/public or a demo route; no console error, no page error, no CSP violation, through the walks, the theme and the language",
  {
    timeout: 300000,
  },
  async (t) => {
    const { port, origin } = await serveLocal(t);
    const browser = await openBrowser(t);
    const problems = collector();
    const files = publicFiles();
    const routes = new Set(["/api/demo/questionnaire", "/api/demo/result"]);
    for (const win of [WINDOWS[0], WINDOWS[2]]) {
      const env = await newPage(browser, t, {
        port,
        viewport: { width: win.width, height: win.height },
      });
      const { page } = env;
      const at = `${win.name}`;
      // The landing: the theme goes round, the language goes round.
      await page.goto(`${origin}/`);
      await pageReady(page, "/", "ru");
      for (let k = 0; k < 3; k++) await page.click("#theme");
      for (const lang of ["kk", "en", "ru"]) {
        await page.click(`[data-lang="${lang}"]`);
        await pageReady(page, "/", lang);
      }
      // how: the four steps and back to the first.
      await page.goto(`${origin}/how.html`);
      await pageReady(page, "/how.html", "ru");
      for (const n of [1, 2, 3, 4, 1]) {
        await page.click(`button[data-step="${n}"]`);
        await waitPlace(page, atDesk(n, "ru"));
      }
      // demo: a whole pass, a chip, the result again.
      await page.goto(`${origin}/demo.html`);
      await pageReady(page, "/demo.html", "ru");
      const Q = intakeIn("ru").questions;
      for (let i = 0; i < 5; i++)
        await answerAndWait(
          page,
          0,
          i < 4 ? Q[i + 1].title : say("demo_result_title", "ru"),
        );
      await page.waitForSelector("#demo .rc-kind, #demo .rc-nomatch");
      await page.locator("#demo .chip").nth(2).click();
      await waitHeading(page, Q[2].title);
      await waitPlace(page, atDesk(3, "ru"));
      await page.locator("#demo .card").nth(0).click();
      await waitHeading(page, say("demo_result_title", "ru"));
      for (const u of env.requested) {
        const p = new URL(u).pathname;
        if (!(files.has(p) || routes.has(p) || p === "/"))
          problems.add(at, [
            `a request that is no file of app/public and no demo route: ${p}`,
          ]);
      }
      await readState(problems, at, env, "ru");
    }
    assert.deepEqual(problems.lines(), []);
  },
);
