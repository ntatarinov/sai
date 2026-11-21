/* global document, requestAnimationFrame */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LANGS, TEXTS } from "../../public/shared/i18n/texts.js";
import { shownTextFindings } from "./browser.js";
import { APP } from "./helpers.js";

// The node side of the e2e tests of app/test/e2e (no test here; the code design 10): the matrix, the texts and the
// intake read as the test's own oracle, the one reading of what a browser page reported (console, requests,
// CSP records), and the small waits that every test shares. A wait is always a condition with a deadline or a
// count of frames the page draws; there is no sleep (decisions/0118 О17, AP-116).

/** The three windows of the matrix (REQ-111 criterion 12). */
export const WINDOWS = Object.freeze([
  { name: "1470x784", width: 1470, height: 784 },
  { name: "390x844", width: 390, height: 844 },
  { name: "320x568", width: 320, height: 568 },
]);

/** The languages of the local set. */
export const LOCAL_LANGS = LANGS;

/** The page title key of each page (the `data-t` of its `title` element). */
export const TITLE_KEY = Object.freeze({
  "/": "closed_test",
  "/how.html": "title_how",
  "/examples.html": "order_title_examples",
  "/demo.html": "title_demo",
  "/nope": "title_404",
  "/a/b/c.html": "title_404",
  "/x/y/": "title_404",
});

/** The declared console line of a page that the server answers with 404 (decisions/0118 О2, design F27). */
export const LINE_404 =
  "Failed to load resource: the server responded with a status of 404 (Not Found)";

/**
 * A text of the texts module in a language.
 * @param {string} key
 * @param {string} lang
 * @returns {string}
 */
export function say(key, lang) {
  const entry = /** @type {Record<string, Record<string, string>>} */ (TEXTS)[
    key
  ];
  if (entry === undefined || typeof entry[lang] !== "string")
    throw new Error(`no text ${key} in ${lang}`);
  return entry[lang];
}

/**
 * The placeholders `{name}` of a template filled.
 * @param {string} template
 * @param {Record<string, string | number>} values
 * @returns {string}
 */
export function filled(template, values) {
  return template.replace(/\{(\w+)\}/g, (_m, k) => String(values[k]));
}

/**
 * White space folded to one space and trimmed (what `innerText` and `textContent` of the same text differ in).
 * @param {string} s
 * @returns {string}
 */
export function norm(s) {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * The line of the text list that says where «Вы» stands at desk n, in a language.
 * @param {number} n
 * @param {string} lang
 * @returns {string}
 */
export function atDesk(n, lang) {
  return filled(say("you_at_desk", lang), {
    n,
    stage: say(`stage_${n}`, lang),
  });
}

/**
 * The live line of the how page after a walk to desk n.
 * @param {number} n
 * @param {string} lang
 * @returns {string}
 */
export function liveDesk(n, lang) {
  return filled(say("live_desk", lang), { n, stage: say(`stage_${n}`, lang) });
}

/** @typedef {{ id: string, title: string, options: Array<{ id: string, label: string }> }} Question */

/**
 * The intake file as the test's own oracle (the file the server reads, parsed here): the five questions of a
 * language, the names of the solutions and their `not_suitable_when`, the no-match text.
 * @param {string} lang
 * @returns {{ questions: Question[], solutions: Array<{ id: string, name: string, includes: string[], notFit: string[] }>, noMatch: string }}
 */
export function intakeIn(lang) {
  const file = JSON.parse(
    fs.readFileSync(path.join(APP, "content", "sai-intake.json"), "utf8"),
  );
  return {
    questions: file.questions.map((/** @type {any} */ q) => ({
      id: q.id,
      title: q.title[lang],
      options: q.options.map((/** @type {any} */ o) => ({
        id: o.id,
        label: o.label[lang],
      })),
    })),
    solutions: file.solutions.map((/** @type {any} */ s) => ({
      id: s.id,
      name: s.name[lang],
      includes: s.includes.map((/** @type {any} */ x) => x[lang]),
      notFit: s.not_suitable_when.map((/** @type {any} */ x) => x[lang]),
    })),
    noMatch: file.result.no_match_text[lang],
  };
}

/**
 * The answer fixtures of `content/sai-intake.answers/`, each `{ name, answers }` (question id → option id).
 * @returns {Array<{ name: string, answers: Record<string, string> }>}
 */
export function answerFixtures() {
  const dir = path.join(APP, "content", "sai-intake.answers");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({
      name: f.replace(/\.json$/, ""),
      answers: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
    }));
}

/**
 * The files of `app/public` as URL paths (`/index.html`, `/js/dom.js` …), for the rule that a page asks for
 * nothing else of the server but these and the demo routes.
 * @returns {Set<string>}
 */
export function publicFiles() {
  /** @type {Set<string>} */
  const out = new Set();
  /** @param {string} abs @param {string} rel */
  const walk = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true }))
      if (e.isDirectory()) walk(path.join(abs, e.name), `${rel}/${e.name}`);
      else out.add(`${rel}/${e.name}`);
  };
  walk(path.join(APP, "public"), "");
  return out;
}

/**
 * What a page reported that no test allows, as lines: a request outside the local server, a
 * `securitypolicyviolation`, an uncaught error of the page, and every console line that is not one of `allowed`
 * (a line is allowed once per entry of `allowed`, matched by its text; a prefix of `…` is not a pattern).
 * @param {{ outside: string[], violations: string[], pageErrors: string[], consoleLines: Array<{ level: string, text: string, url: string }> }} env
 * @param {string[]} [allowed] the exact console texts that are declared, each allowed once
 * @returns {string[]}
 */
export function reportedProblems(env, allowed = []) {
  /** @type {string[]} */
  const out = [];
  for (const u of env.outside) out.push(`request outside the server: ${u}`);
  for (const v of env.violations) out.push(`CSP violation: ${v}`);
  for (const e of env.pageErrors) out.push(`page error: ${e}`);
  const left = [...allowed];
  for (const l of env.consoleLines) {
    const at = left.indexOf(l.text);
    if (at >= 0) left.splice(at, 1);
    else out.push(`console ${l.level}: ${l.text} (${l.url})`);
  }
  for (const l of left) out.push(`declared console line missing: ${l}`);
  return out;
}

/**
 * Empties the lists of a page's reports (after a state whose reports were read), so the next state is read alone.
 * @param {{ outside: string[], requested: string[], violations: string[], pageErrors: string[], consoleLines: unknown[] }} env
 * @returns {void}
 */
export function clearReports(env) {
  env.outside.length = 0;
  env.requested.length = 0;
  env.violations.length = 0;
  env.pageErrors.length = 0;
  env.consoleLines.length = 0;
}

/**
 * Waits until the page has run its script and shown its texts in `lang`: the document's title is the page's title
 * in that language and, on a page with the stage, the first frame is drawn (or the text view stands); on the demo
 * until the first question is on the screen (unless `survey` is false: a demo whose questionnaire fails shows a
 * message in its place).
 * @param {import("playwright-core").Page} page
 * @param {string} pathname
 * @param {string} lang
 * @param {{ survey?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function pageReady(page, pathname, lang, options = {}) {
  const key = /** @type {Record<string, string>} */ (TITLE_KEY)[pathname];
  if (key === undefined) throw new Error(`no title key for ${pathname}`);
  await page.waitForFunction(
    (/** @type {{ title: string, lang: string }} */ want) =>
      document.title === want.title &&
      document.documentElement.lang === want.lang,
    { title: say(key, lang), lang },
    { timeout: 15000 },
  );
  if (pathname === "/" || pathname === "/how.html" || pathname === "/demo.html")
    await page.waitForFunction(
      () => {
        const s = document.getElementById("stage");
        return (
          s !== null &&
          (s.getAttribute("data-frames") !== "0" ||
            s.classList.contains("text-view"))
        );
      },
      null,
      { timeout: 15000 },
    );
  if (pathname === "/demo.html" && options.survey !== false)
    await page.waitForSelector("#demo .card", { timeout: 15000 });
}

/**
 * Waits for `n` animation frames of the page to pass (a count of frames the page itself is given, not a sleep):
 * the way to show that nothing is drawn over a stretch of time.
 * @param {import("playwright-core").Page} page
 * @param {number} n
 * @returns {Promise<void>}
 */
export async function framesPass(page, n) {
  await page.evaluate(
    (/** @type {number} */ count) =>
      new Promise((resolve) => {
        let k = 0;
        const step = () => {
          k += 1;
          if (k >= count) resolve(null);
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    n,
  );
}

/**
 * The page goes to the background as a tab does: `document.hidden` is true and `visibilitychange` fires (a headless
 * Chrome tab never leaves the foreground, so the page's own read is changed in the page).
 * @param {import("playwright-core").Page} page
 * @returns {Promise<void>}
 */
export async function hideTab(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/**
 * The tab comes back: the page's own read is restored and `visibilitychange` fires.
 * @param {import("playwright-core").Page} page
 * @returns {Promise<void>}
 */
export async function showTab(page) {
  await page.evaluate(() => {
    delete (/** @type {any} */ (document).hidden);
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/**
 * The stage's frame count (`data-frames`) now.
 * @param {import("playwright-core").Page} page
 * @returns {Promise<number>}
 */
export async function frameCount(page) {
  return Number(
    await page.evaluate(() =>
      document.getElementById("stage")?.getAttribute("data-frames"),
    ),
  );
}

/**
 * The text of the line that says where «Вы» stands.
 * @param {import("playwright-core").Page} page
 * @returns {Promise<string>}
 */
export async function placeLine(page) {
  return (
    (await page.evaluate(
      () => document.getElementById("stage-you")?.textContent,
    )) ?? ""
  );
}

/**
 * Waits until the line of the text list that says where «Вы» stands is `line` (the walk has ended there).
 * @param {import("playwright-core").Page} page
 * @param {string} line
 * @returns {Promise<void>}
 */
export async function waitPlace(page, line) {
  await page.waitForFunction(
    (/** @type {string} */ want) =>
      document.getElementById("stage-you")?.textContent === want,
    line,
    { timeout: 15000 },
  );
}

/**
 * Taps the answer card `index` (0-3 an option, 4 «Не знаю») of the question on the screen and waits until the
 * next view — the question `next` or the result heading — is the heading of the demo.
 * @param {import("playwright-core").Page} page
 * @param {number} index
 * @param {string} nextHeading
 * @returns {Promise<void>}
 */
export async function answerAndWait(page, index, nextHeading) {
  await page.locator("#demo .card").nth(index).click();
  await waitHeading(page, nextHeading);
}

/**
 * Waits until the heading of the survey's panel is `text`.
 * @param {import("playwright-core").Page} page
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function waitHeading(page, text) {
  await page.waitForFunction(
    (/** @type {string} */ want) =>
      document.querySelector("#demo h2")?.textContent === want,
    text,
    { timeout: 15000 },
  );
}

/**
 * A list of findings that grows while a test reads states, and is asserted empty at the end.
 * @returns {{ add: (where: string, lines: string[]) => void, lines: () => string[] }}
 */
export function collector() {
  /** @type {Map<string, string[]>} */
  const found = new Map();
  return {
    add(where, lines) {
      for (const line of lines) {
        const at = found.get(line) ?? [];
        at.push(where);
        found.set(line, at);
      }
    },
    lines() {
      return [...found].map(
        ([line, where]) =>
          `${line} (${where.length} x; e.g. ${where.slice(0, 3).join(" | ")})`,
      );
    },
  };
}

/**
 * The live line of the demo after the result is shown (the filled `live_result`).
 * @param {string} kind the solution's name or the no-match text
 * @param {string} lang
 * @returns {string}
 */
export function liveResult(kind, lang) {
  return filled(say("live_result", lang), { kind });
}

/**
 * The live line of the demo after «Назад» to question i (the filled `live_back`).
 * @param {number} i
 * @param {string} lang
 * @returns {string}
 */
export function liveBack(i, lang) {
  return filled(say("live_back", lang), { i });
}

/**
 * The name the receipt of the demo shows, once it shows one of the intake in `lang` (a solution's name or the
 * no-match text): the test's own list of names is the oracle, the page's receipt is read.
 * @param {import("playwright-core").Page} page
 * @param {string} lang
 * @returns {Promise<string>}
 */
export async function shownKind(page, lang) {
  const intake = intakeIn(lang);
  await page.waitForFunction(
    (/** @type {string[]} */ names) => {
      const e = document.querySelector("#demo .rc-kind, #demo .rc-nomatch");
      return e !== null && names.includes(e.textContent ?? "");
    },
    [...intake.solutions.map((s) => s.name), intake.noMatch],
    { timeout: 15000 },
  );
  return (
    (await page.evaluate(
      () =>
        document.querySelector("#demo .rc-kind, #demo .rc-nomatch")
          ?.textContent,
    )) ?? ""
  );
}

/**
 * Waits until the live line (`#live`) holds its announcement (the demo writes it ANNOUNCE_MS after the action, so a
 * read of the page right after the action sees an empty line: a condition, not a sleep) and asserts its text is
 * `expected`.
 * @param {import("playwright-core").Page} page
 * @param {string} expected
 * @param {string} where
 * @returns {Promise<void>}
 */
export async function waitLive(page, expected, where) {
  await page.waitForFunction(
    () => (document.getElementById("live")?.textContent ?? "") !== "",
    null,
    { timeout: 15000 },
  );
  assert.equal(
    await page.evaluate(() => document.getElementById("live")?.textContent),
    expected,
    `${where}: the live line`,
  );
}

/** @typedef {{ result: string } | { back: number }} LiveExpect what the live line must say: the result of the named solution (or the no-match text), or «Назад» to a question */

/**
 * The reads that every state gets: the lint of the shown text in the language of the page and what the page reported
 * (requests outside the server, CSP violations, page errors, console lines but the declared ones), then the
 * reports are emptied. A state that follows a result or a «Назад» says so in `live`: the read waits for the live
 * line and asserts its text first, so the lint sees the line (T1 of the gate pass 1).
 * @param {ReturnType<typeof collector>} problems
 * @param {string} where
 * @param {Awaited<ReturnType<typeof import("./browser.js").newPage>>} env
 * @param {string} lang
 * @param {string[]} [allowed] the declared console lines of this state
 * @param {LiveExpect} [live] the announcement this state holds in the live line
 */
export async function readState(
  problems,
  where,
  env,
  lang,
  allowed = [],
  live = undefined,
) {
  if (live !== undefined)
    await waitLive(
      env.page,
      "result" in live
        ? liveResult(live.result, lang)
        : liveBack(live.back, lang),
      where,
    );
  problems.add(where, await shownTextFindings(env.page, lang));
  problems.add(where, reportedProblems(env, allowed));
  clearReports(env);
}
