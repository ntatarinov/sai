/* global document */
import crypto from "node:crypto";
import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { getRequestListener } from "@hono/node-server";
import { chromium, errors } from "playwright-core";
import { PUBLIC_LANGS } from "../../public/shared/i18n/lang.js";
import { lintText, stripDeletionTerm } from "../../scripts/word-lists.js";
import { runBuild } from "../../scripts/vercel-build.js";
import { createApp } from "../../server/app.js";
import { originsFor } from "../../server/http/origin.js";
import { loadIntake } from "../../server/routes/demo.js";
import { loadStaticSite } from "../../server/static.js";
import { APP, startNode, tempDir } from "./helpers.js";

// The browser helpers of app/test/e2e (no test here; decisions/0124 О10; the code design 10, the helper
// `fixtures/browser.js`): the one real Chrome of the machine (`channel: "chrome"`), a page whose every
// request outside the local server is aborted and recorded, the local server and the server of the public
// set on a port of their own, and the one lint of the text that a page shows, so every LD test reads it the
// same way. Every browser, context and server is closed in `t.after`.

/**
 * The four words and the three phrases that no shown text may hold (REQ-109 criterion 7): the word ban of
 * decisions/0074 item 6 and the phrases of the sample that are not carried over. Each is built from parts, so
 * a search of the repository for the word itself finds the lists of the product, not this file (AP-093).
 */
const BANNED_WORDS = [
  ["hand", "off"],
  ["hand", "offs"],
  ["or", "ch"],
  ["decis", "ions"],
].map((p) => p.join(""));
const BANNED_PHRASES = [
  [
    ["Clau", "de"],
    ["Co", "de"],
  ],
  [["Око", "ло"], ["2"], ["мину", "т"]],
  [
    ["типо", "вой"],
    ["вари", "ант"],
  ],
].map((words) => words.map((w) => w.join("")));

/** A word ends at a sign that is no letter, digit or `_`, in any language. */
const BEFORE = "(?<![\\p{L}\\p{N}_])";
const AFTER = "(?![\\p{L}\\p{N}_])";
const WORD_RULES = BANNED_WORDS.map((w) => ({
  item: `word «${w}»`,
  re: new RegExp(`${BEFORE}${w}${AFTER}`, "iu"),
}));
const PHRASE_RULES = BANNED_PHRASES.map((words) => ({
  item: `phrase «${words.join(" ")}»`,
  re: new RegExp(`${BEFORE}${words.join("\\s+")}${AFTER}`, "iu"),
}));
const REQ_DIGIT = new RegExp(`${["RE", "Q"].join("")}-(?=\\d)`);

/**
 * The launched Chrome of the machine, closed when the test ends. A machine without Chrome fails here with
 * the message of playwright-core, never a skipped test. A launch that does not finish within 30 s (Chrome
 * hung once in a launch under load; the default wait of playwright-core is 180 s) is tried again, up to three
 * launches in all; any other error ends the call at once, and the last timeout is the error of the call.
 * @param {import("node:test").TestContext} t
 * @returns {Promise<import("playwright-core").Browser>}
 */
export async function openBrowser(t) {
  /** @type {unknown} */
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const browser = await chromium.launch({
        channel: "chrome",
        args: ["--use-mock-keychain"],
        timeout: 30000,
      });
      t.after(() => browser.close().catch(() => {}));
      return browser;
    } catch (e) {
      if (!(e instanceof errors.TimeoutError)) throw e;
      last = e;
    }
  }
  throw last;
}

/**
 * A page in a fresh context (no cookies, no storage of an earlier page). Every request whose address does not
 * start with `http://127.0.0.1:<port>/` is aborted and recorded in `outside`; every request in `requested`;
 * every console line with its level and the address that wrote it in `consoleLines`; every uncaught error of
 * the page in `pageErrors`; every `securitypolicyviolation` event of any frame in `violations` (an init script
 * reports each to the test through a binding, so the list survives a navigation).
 * @param {import("playwright-core").Browser} browser
 * @param {import("node:test").TestContext} t
 * @param {{ port: number, viewport?: { width: number, height: number }, colorScheme?: "light" | "dark", reducedMotion?: "reduce" | "no-preference", javaScript?: boolean }} o
 */
export async function newPage(
  browser,
  t,
  {
    port,
    viewport = { width: 1280, height: 800 },
    colorScheme = "light",
    reducedMotion = "no-preference",
    javaScript = true,
  },
) {
  const context = await browser.newContext({
    viewport,
    colorScheme,
    reducedMotion,
    javaScriptEnabled: javaScript,
    serviceWorkers: "block",
    acceptDownloads: false,
    locale: "ru-RU",
  });
  t.after(() => context.close().catch(() => {}));
  const origin = `http://127.0.0.1:${port}/`;
  /** @type {string[]} */
  const outside = [];
  /** @type {string[]} */
  const requested = [];
  /** @type {Array<{ level: string, text: string, url: string }>} */
  const consoleLines = [];
  /** @type {string[]} */
  const pageErrors = [];
  /** @type {string[]} */
  const violations = [];
  await context.route("**/*", (route) => {
    const url = route.request().url();
    requested.push(url);
    if (url.startsWith(origin)) return route.continue();
    outside.push(url);
    return route.abort("blockedbyclient");
  });
  await context.exposeBinding("__saiViolation", (_source, line) => {
    violations.push(String(line));
  });
  await context.addInitScript(() => {
    document.addEventListener(
      "securitypolicyviolation",
      (e) => {
        globalThis.__saiViolation(
          `${e.effectiveDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`,
        );
      },
      true,
    );
  });
  const page = await context.newPage();
  page.on("console", (m) =>
    consoleLines.push({
      level: m.type(),
      text: m.text(),
      url: m.location().url,
    }),
  );
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  return {
    page,
    context,
    outside,
    requested,
    consoleLines,
    pageErrors,
    violations,
  };
}

/**
 * The local server: `node server/node-main.js` on port 0, the local set (every language, the examples page,
 * the demo in all three), stopped in `t.after`.
 * @param {import("node:test").TestContext} t
 * @returns {Promise<{ port: number, origin: string }>}
 */
export async function serveLocal(t) {
  const s = startNode(t, { PORT: "0" });
  const port = await s.ready;
  return { port, origin: `http://127.0.0.1:${port}` };
}

/**
 * The server of the accounts path (REQ-117 criterion 10, M2PROJ 7.2 and F18): `node server/node-main.js` on port 0
 * with a fresh in-memory PGlite (no DATABASE_URL), a SECRET_PEPPER and the sha256 of a setup token that this
 * function makes and gives back, so the test can run the first setup in the browser. Stopped in `t.after`.
 * @param {import("node:test").TestContext} t
 * @returns {Promise<{ port: number, origin: string, setupToken: string }>}
 */
export async function serveAccounts(t) {
  const setupToken = crypto.randomBytes(32).toString("base64url");
  const s = startNode(t, {
    PORT: "0",
    SECRET_PEPPER: crypto.randomBytes(32).toString("base64url"),
    SETUP_TOKEN_HASH: crypto
      .createHash("sha256")
      .update(setupToken, "utf8")
      .digest("hex"),
  });
  const port = await s.ready;
  return { port, origin: `http://127.0.0.1:${port}`, setupToken };
}

/**
 * The server of the public set: the open build (no database, check-public and the migration injected as
 * steps that pass) of the real `app/public` into a temporary folder, served by `createApp` with
 * `loadStaticSite(<output>)` and the public languages on `127.0.0.1:0`. Closed in `t.after`.
 * @param {import("node:test").TestContext} t
 * @returns {Promise<{ port: number, origin: string, dir: string }>}
 */
export async function servePublicSet(t) {
  const dir = path.join(tempDir(t), "public");
  /** @type {string[]} */
  const lines = [];
  const code = await runBuild({
    env: {},
    migrate: () => 0,
    checkPublic: () => 0,
    publicDir: path.join(APP, "public"),
    outDir: dir,
    log: (l) => lines.push(l),
  });
  if (code !== 0 || !fs.existsSync(path.join(dir, "index.html")))
    throw new Error(
      `the open build of the public set failed: ${lines.join(" | ")}`,
    );
  const intake = loadIntake();
  const server = createServer();
  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(null)),
  );
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const config = {
    siteGate: false,
    version: "dev",
    appOrigin: null,
    previewOrigin: null,
  };
  const app = createApp({
    config,
    origins: originsFor(config, port),
    db: null,
    site: loadStaticSite(dir),
    migrations: [],
    log: () => {},
    demo: { intake, langs: PUBLIC_LANGS },
  });
  server.on("request", getRequestListener(app.fetch));
  return { port, origin: `http://127.0.0.1:${port}`, dir };
}

/**
 * The lint of the text that the page shows now, in the page's language (criterion 12; decisions/0124 H7; the
 * code design 10): the `innerText` of the body (the visually hidden live line and text list included), the
 * title of the document, and the values of `alt`, `title` and `aria-label` of every element, each through the
 * lists Г, Б, В, П, Ц, С of `scripts/word-lists.js` and through the word ban and the three phrases of
 * REQ-109 criterion 7. A text that a page script writes is read here after the state that shows it. The five
 * consent elements of the invitation page (`#consent-1` … `#consent-5`, in the language of `#consent-text`) are read
 * through the narrow exception of the word lists (`stripDeletionTerm`: the deletion term of the fifth sentence is
 * taken out once) and the lists are applied to everything else (REQ-111 criterion 3 as amended; M2PROJ 4.8).
 * @param {import("playwright-core").Page} page
 * @param {string} lang
 * @returns {Promise<string[]>} one line per finding, `<where>: <item>`; empty when the page shows nothing forbidden
 */
export async function shownTextFindings(page, lang) {
  /** @type {Array<[string, string]>} */
  const shown = await page.evaluate(() => {
    // The consent sentences are linted apart (through the exception); the rest of the text without them.
    let body = document.body.innerText;
    /** @type {Array<[string, string]>} */
    const consent = [];
    const consentLang = document.getElementById("consent-text")?.lang ?? "";
    const flat = (/** @type {string} */ s) => s.replace(/\s+/g, " ").trim();
    for (let n = 1; n <= 5; n++) {
      const sentence = flat(
        document.getElementById(`consent-${n}`)?.textContent ?? "",
      );
      if (sentence === "") continue;
      consent.push([`consent sentence ${n} (${consentLang})`, sentence]);
      // The page's text has the sentences in it; they are read apart, so they are taken out here (the white
      // space of the rest is read as one space, which no list rule depends on).
      body = flat(body).replace(sentence, "");
    }
    /** @type {Array<[string, string]>} */
    const out = [
      ["text", body],
      ["document title", document.title],
      ...consent,
    ];
    for (const el of document.querySelectorAll("[alt], [title], [aria-label]"))
      for (const name of ["alt", "title", "aria-label"]) {
        const value = el.getAttribute(name);
        if (value !== null) out.push([`attribute ${name}`, value]);
      }
    return out;
  });
  /** @type {string[]} */
  const out = [];
  for (const [where, shownText] of shown) {
    // A consent sentence goes through the exception, in the language it is shown in.
    const sentence = /^consent sentence \d \((ru|kk|en)\)$/.exec(where);
    const text = sentence
      ? stripDeletionTerm(shownText, sentence[1])
      : shownText;
    const items = lintText(text, lang).map((f) => `list ${f.list} «${f.form}»`);
    for (const r of [...PHRASE_RULES, ...WORD_RULES])
      if (r.re.test(text)) items.push(r.item);
    if (REQ_DIGIT.test(text)) items.push("a requirement number");
    for (const item of items) out.push(`${where}: ${lang}: ${item}`);
  }
  return out;
}
