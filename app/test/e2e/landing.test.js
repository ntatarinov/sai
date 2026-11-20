/* global document, Node, window */
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
  collector,
  filled,
  framesPass,
  intakeIn,
  LINE_404,
  LOCAL_LANGS,
  norm,
  pageReady,
  placeLine,
  publicFiles,
  readState,
  reportedProblems,
  say,
  waitHeading,
  waitPlace,
  WINDOWS,
} from "../fixtures/e2e-kit.js";
import { startNode, waitFor } from "../fixtures/helpers.js";
import { avatarPixels, layoutFindings } from "../fixtures/page-checks.js";

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
  "LD-5 the survey: the first question at load, five taps to the result, Back keeps the answer, Не знаю goes on, the whole survey by keyboard, the lint after each state",
  {
    timeout: 240000,
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
      await readState(problems, "result", env, "ru");
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
      await readState(problems, "after Назад", env, "ru");
      await page.locator("#demo .back").click();
      await waitHeading(page, Q[0].title);
      assert.equal(
        await page.locator("#demo .card").nth(1).getAttribute("aria-pressed"),
        "true",
        "back to question 1: its answer is kept",
      );
      await waitPlace(page, say("you_at_door", "ru"));
      await readState(problems, "after Назад to 1", env, "ru");
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
      await readState(problems, "result after Не знаю", env, "ru");
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
      await readState(problems, "keyboard result", env, "ru");
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
      await readState(problems, "phone result", env, "en");
    }
    assert.deepEqual(problems.lines(), []);
  },
);

/**
 * Reads the result of the demo on the screen: the heading, the receipt, the lists of the result by their heading,
 * the idea panel's link and the chips.
 * @param {import("playwright-core").Page} page
 */
function readResult(page) {
  return page.evaluate(() => {
    const text = (/** @type {Element | null} */ e) =>
      (e?.textContent ?? "").replace(/\s+/g, " ").trim();
    const lists = [...document.querySelectorAll("#demo .r-lines section")].map(
      (s) => ({
        title: text(s.querySelector("h3")),
        items: [...s.querySelectorAll("li")].map(text),
      }),
    );
    const link = document.querySelector("#demo .idea a");
    return {
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
    };
  });
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
      const passes = [
        ...fixtures.map((f) => ({
          name: f.name,
          answers: /** @type {Record<string, string> | null} */ (f.answers),
        })),
        { name: "five Не знаю", answers: null },
      ];
      for (const [number, pass] of passes.entries()) {
        const where = `${lang} ${pass.name}`;
        await page.goto(`${origin}/demo.html?lang=${lang}`);
        await pageReady(page, "/demo.html", lang);
        const chosen = /** @type {Record<string, string>} */ ({});
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
          let index = q.options.length;
          if (pass.answers !== null) {
            index = q.options.findIndex((o) => o.id === pass.answers?.[q.id]);
            assert.ok(index >= 0, `${where}: the fixture answers ${q.id}`);
            chosen[q.id] = q.options[index].id;
          }
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
        assert.equal(
          got.chips.length,
          5,
          `${where}: five answers kept as chips`,
        );
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
        await readState(problems, `${where} result`, env, lang);
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
        await readState(problems, `${where} after Повторить`, env, "ru");
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
    /** @param {string} where @param {string} lang */
    const step = async (where, lang) => {
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
    await page.click('[data-lang="kk"]');
    lang = "kk";
    await waitHeading(page, intake.kk.questions[2].title);
    await step("to kk", lang);
    await page.locator("#demo .back").click();
    await waitHeading(page, intake.kk.questions[1].title);
    await step("back", lang);
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
    await step("result", lang);
    await page.click('[data-lang="ru"]');
    lang = "ru";
    await page.waitForFunction(
      (/** @type {string} */ want) =>
        document.querySelector("#demo .r-sum h2")?.textContent === want,
      say("demo_result_title", "ru"),
    );
    await page.waitForSelector("#demo .rc-kind, #demo .rc-nomatch");
    const local = await step("result in ru", lang);
    assert.deepEqual(Object.keys(local).sort(), ["sai-lang", "sai-theme"]);
    assert.equal(local["sai-lang"], "ru");
    assert.equal(local["sai-theme"], "auto");
    problems.add("the pass", reportedProblems(env));
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
          if (win === WINDOWS[0])
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
        await readState(problems, `${win.name} ${lang} result`, env, lang);
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
      }
    }
    assert.deepEqual(problems.lines(), []);
  },
);
